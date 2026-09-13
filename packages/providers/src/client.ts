import { Agent, fetch } from "undici";
import type { z } from "zod";

import {
  type Allowlist,
  assertConfigAddress,
  assertConfigUrl,
  assertContentAddress,
  assertContentUrl,
  OutboundRefused,
  pinnedLookup,
  shortly,
} from "./boundary";
import {
  type CmppBrowse,
  type CmppManifest,
  type CmppRecord,
  type CmppSearch,
  cmppBrowse,
  cmppManifest,
  cmppRecord,
  cmppSearch,
} from "./cmpp";
import { bounded, REASON_MAX_LENGTH } from "./reason";

/**
 * A provider, as CanonCore knows it: a URL, and a validated response shape
 * (ADR-0031). Never a plugin, never code running inside the app.
 */
export interface ProviderClient {
  manifest(): Promise<CmppManifest>;
  /**
   * Candidates matching a query. REQUIRED OF EVERY PROVIDER (ADR-0033), so
   * unlike `browse` no caller asks the manifest whether this one offers it.
   *
   * An empty `results` is an answer -- a query nothing matched. A query that is
   * empty is not: it is the caller's mistake, and it travels to the provider
   * and comes back as the refusal the provider gives it.
   */
  search(query: string): Promise<CmppSearch>;
  /** One record by its stable id, or nothing when the provider holds none. */
  lookup(id: string): Promise<CmppRecord | null>;
  /**
   * A container and its ordering, or nothing when that id addresses no
   * container. OPTIONAL OF A PROVIDER (ADR-0033), so a caller asks the manifest
   * whether this one offers it before calling -- the client itself does not,
   * because "may I" and "how" are two questions and only the second is here.
   */
  browse(id: string): Promise<CmppBrowse | null>;
  close(): Promise<void>;
}

/**
 * How many hops before the client gives up. A provider that redirects is
 * ordinary (ADR-0034 departs from OWASP deliberately on this); one that
 * redirects five times is a loop.
 */
const MAX_HOPS = 5;

/**
 * A provider that stops answering must not hold the import open forever.
 * undici's own defaults are 300s, which is long enough to look like a hang.
 */
const TIMEOUT_MS = 10_000;

/**
 * How much of a provider's answer will be read before giving up on it.
 *
 * `bodyTimeout` caps how LONG a provider may take and says nothing about how
 * MUCH it may send, and on loopback ten seconds is a great deal of it. A CMPP
 * manifest is a few hundred bytes and a record is a few hundred more, so 4 MiB
 * is far past anything honest and far short of anything that hurts.
 */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * How much of a FAILING answer is read before the socket is let go (CNCORE-140).
 *
 * NOT `MAX_BODY_BYTES`, WHICH IS FOUR MEBIBYTES. What is wanted out of a failure
 * is ONE SENTENCE, and only `REASON_MAX_LENGTH` characters of it survive to the
 * page. UTF-8 spends at most four bytes on a character, so 1,200 bytes carries
 * the longest reason there can be; this is three times that, which leaves room
 * for the envelope around it and for a provider that writes its `error` after
 * other keys. A provider flooding a failure body is not sending a sentence, and
 * reading four mebibytes of it to print three hundred characters would hold the
 * socket open for exactly the reason the drain below exists to avoid.
 */
const MAX_REASON_BYTES = 4 * REASON_MAX_LENGTH;

export function createProviderClient({
  baseUrl,
  allowlist,
}: {
  baseUrl: string;
  allowlist: Allowlist;
}): ProviderClient {
  const base = new URL(baseUrl);

  /**
   * TWO DISPATCHERS, ONE PER BOUNDARY, because the two boundaries ask different
   * questions and a single agent's lookup hook cannot tell which hop it is on.
   *
   * The config dispatcher may reach an address the owner allowlisted -- that is
   * what makes a loopback or tailnet provider legal by name. The content
   * dispatcher may not, ever, whatever the allowlist says.
   *
   * Named `dispatcher` and not `agent` although the undici type is `Agent`:
   * CONTEXT.md is binding on names and lists `agent` under what a Provider must
   * not be called, and `dispatcher` is undici's own word for the thing anyway --
   * it is the option these are passed as.
   */
  const configDispatcher = new Agent({
    connect: { lookup: pinnedLookup(assertConfigAddress(allowlist)) },
    headersTimeout: TIMEOUT_MS,
    bodyTimeout: TIMEOUT_MS,
  });
  const contentDispatcher = new Agent({
    connect: { lookup: pinnedLookup(assertContentAddress) },
    headersTimeout: TIMEOUT_MS,
    bodyTimeout: TIMEOUT_MS,
  });

  /**
   * One request, following redirects and re-validating EVERY hop.
   *
   * `redirect: "manual"` rather than undici's own following, because the
   * following is where the rule lives: an automatic follower reaches the next
   * host before anything has judged it. ADR-0034 departs from OWASP here on
   * purpose -- OWASP says twice to disable redirects entirely, and a provider
   * that redirects is ordinary -- so this follows them and checks each one,
   * written down as a departure rather than left as an omission.
   */
  async function get(path: string): Promise<Response> {
    // The FIRST hop is the config URL the owner typed. Checked before the
    // socket opens: refusing after connecting has already told an
    // unallowlisted host that this instance exists.
    let url = new URL(path, base);
    assertConfigUrl(url, allowlist);
    let dispatcher = configDispatcher;

    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const response = await fetch(url, {
        dispatcher,
        redirect: "manual",
        headers: { accept: "application/json" },
      });

      const location = response.headers.get("location");
      if (!isRedirect(response.status) || location === null) return response as unknown as Response;

      // Drain the body of the hop being left behind, or the connection is
      // held open until the agent times it out.
      await response.body?.cancel();

      // EVERY HOP AFTER THE FIRST IS A CONTENT URL, with no exception ever --
      // not for a same-origin hop, and not for one the allowlist happens to
      // cover. An allowlisted provider that is compromised or merely buggy is
      // exactly what this stops.
      // A `Location` THE PROVIDER WROTE, so it is not necessarily a URL at all.
      // `new URL` throws a bare TypeError on one it cannot parse, and a
      // TypeError is not an OutboundRefused -- so it escaped the router's error
      // mapping and became a 500. A provider must not be able to crash the
      // request that is reading it.
      url = hopTo(location, url);
      assertContentUrl(url);
      dispatcher = contentDispatcher;
    }

    throw new OutboundRefused(`refused ${base.origin}: more than ${MAX_HOPS} redirects.`);
  }

  /**
   * One resource, or `null` when the provider says it holds none.
   *
   * SHARED BY `lookup` AND `browse` because 404 means the same thing to both --
   * an address with nothing at it -- and the two drifting apart is how one of
   * them ends up throwing on the ordinary answer.
   */
  async function readOrNull<T extends z.ZodType>(
    path: string,
    schema: T,
  ): Promise<z.infer<T> | null> {
    const response = await get(path);
    if (response.status === 404) {
      await response.body?.cancel();
      return null;
    }
    if (!response.ok) throw await failed(response, path);
    return schema.parse(await readJson(response));
  }

  async function read<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
    const response = await get(path);
    if (!response.ok) throw await failed(response, path);
    return schema.parse(await readJson(response));
  }

  return {
    manifest: () => read("/", cmppManifest),
    // `encodeURIComponent` RATHER THAN `URLSearchParams`, which is the obvious
    // choice and spells a space `+`. `%20` is the spelling the contract test
    // reaches both real providers with and is therefore the one proven against
    // them; `+` is proven against neither.
    //
    // AN EMPTY QUERY IS SENT RATHER THAN REFUSED HERE, which is the reading
    // ADR-0033 fixed and CNCORE-33 settled: `?q=` is the caller's mistake, both
    // providers answer it `400`, and `read` turns that into a throw. Refusing
    // it locally would make this client the one caller of `?q=` that never
    // asks -- and the day a provider changed its mind about it, nothing on this
    // side would notice.
    search: (query) => read(`/search?q=${encodeURIComponent(query)}`, cmppSearch),
    // A record the provider does not hold is an ANSWER, not a failure: it is
    // what `search` returning an ambiguous candidate looks like once the
    // candidate turns out to be gone (ADR-0033).
    lookup: (id) => readOrNull(`/lookup/${encodeURIComponent(id)}`, cmppRecord),
    // And neither is a page that addresses no container. ADR-0066: an id that
    // cannot BE an identity addresses nothing, exactly as one nobody minted
    // does, and a caller must not be able to tell the two apart.
    browse: (id) => readOrNull(`/browse/${encodeURIComponent(id)}`, cmppBrowse),
    async close() {
      await Promise.all([configDispatcher.close(), contentDispatcher.close()]);
    },
  };
}

/**
 * The next hop, from a `Location` the provider wrote.
 *
 * A refusal rather than a TypeError, because everything downstream of the base
 * URL is the PROVIDER'S text and an unreadable one is a provider misbehaving --
 * which is a thing to report, not a thing to crash on.
 */
function hopTo(location: string, from: URL): URL {
  try {
    return new URL(location, from);
  } catch {
    throw new OutboundRefused(
      `refused a redirect from ${from.origin}: \`${location}\` is not a URL.`,
    );
  }
}

/**
 * WHAT A PROVIDER SAID WHEN IT COULD NOT ANSWER, as an error a caller may report.
 *
 * DRAINING AND READING ARE NOT THE SAME THING, WHICH IS THE WHOLE OF CNCORE-140.
 * Both of these sites used to `cancel()` the body and throw the status alone,
 * with the drain's reason written beside them -- and the reason for the drain is
 * sound: an undrained body holds the socket until the dispatcher times it out.
 * What was wrong was the conclusion. A bounded read releases the socket exactly
 * as a cancel does, and ADR-0123's cap is what makes bounding it possible.
 *
 * ONE FUNCTION FOR BOTH SITES, which is ADR-0123's own lesson at the seam below
 * the one it was learned at: `provider.search` and `provider.container` had one
 * defect twice because each mapped its own catch, and `read` and `readOrNull`
 * were two copies of this sentence for the same reason.
 *
 * THE PATH AND NOT THE ORIGIN, and the missing origin is deliberate. This
 * sentence is capped at `REASON_MAX_LENGTH` by `reasonFor` on its way to a page,
 * and ADR-0123 records what happens when a variable-length value is interpolated
 * AHEAD of the half naming the remedy: the cap eats the remedy. The origin is
 * the longest such value here and it is also the one every reason surface prints
 * in its own lead sentence already -- `/import` rendered it twice. Without it the
 * framing is at most 95 characters at full stretch, so a provider's remedy
 * arrives whole and only a provider that floods is cut.
 */
async function failed(response: Response, path: string): Promise<Error> {
  const said = await saidBy(response);
  const answered = `${shortly(path)} answered ${response.status}`;
  // A BODY IS THE PROVIDER'S CHOICE AND AN EMPTY ONE IS A CHOICE IT MAY MAKE.
  // Said nothing, so there is nothing to introduce: the sentence stops where it
  // stopped before CNCORE-140 rather than trailing a colon into blank space.
  return new Error(said === "" ? `${answered}.` : `${answered}: ${said}`);
}

/**
 * The provider's own sentence about its failure, bounded (ADR-0123).
 *
 * `error` IS UNWRAPPED WHERE IT IS THERE AND NOTHING IS REQUIRED OF A PROVIDER
 * THAT SPELLS IT OTHERWISE. `packages/contract` refuses to make the failure
 * body's shape part of CMPP on purpose -- requiring `{error, provider}` would be
 * writing "be provider-wiki" into an intersection two providers have to satisfy
 * -- so this READS that spelling opportunistically rather than depending on it,
 * which is the same arrangement `cmpp.ts` is under as a CONSUMER'S schema.
 *
 * IT IS THE CAP'S ARGUMENT AND NOT A TIDINESS ONE. ADR-0123 found the 300
 * characters being spent on a `ZodError`'s indentation and handing the Owner a
 * fragment of a stack of braces; a JSON envelope spends them the same way, on
 * punctuation and on a `provider` key the page names in its own lead sentence.
 */
async function saidBy(response: Response): Promise<string> {
  const text = await firstBytesOf(response);
  return bounded(errorIn(text) ?? text);
}

/**
 * A JSON body's `error`, where the body is JSON and `error` is a sentence.
 *
 * TRUNCATED JSON DOES NOT PARSE AND THAT IS THE FALLBACK WORKING. A provider
 * that sent more than `MAX_REASON_BYTES` leaves this with a fragment, which
 * `JSON.parse` refuses -- and the fragment itself is then quoted, bounded, as
 * whatever it is. Honest, and the alternative is inventing a sentence.
 */
function errorIn(text: string): string | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) return null;
  const said = (body as { error?: unknown }).error;
  return typeof said === "string" && said !== "" ? said : null;
}

/**
 * The first `MAX_REASON_BYTES` of a body, WITH THE SOCKET LET GO EITHER WAY.
 *
 * `cancel()` IN A `finally` IS WHAT PRESERVES THE REASON THE DRAIN EXISTED FOR.
 * A body read to its end is already closed and cancelling it again is a no-op; a
 * body cut off at the cap has the rest of itself still arriving, and this is
 * what reclaims that socket instead of leaving it to `bodyTimeout`. The lock is
 * released first, which is what lets the cancel through -- the same pairing
 * `readJson` uses for the oversized case.
 *
 * A READ THAT THROWS PART-WAY STILL ANSWERS. A provider that dies mid-sentence
 * has said whatever arrived before it did, and the failure worth reporting to
 * the Owner is the one that got this far rather than the socket's account of it.
 */
async function firstBytesOf(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < MAX_REASON_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } catch {
    // Whatever arrived is still the provider's answer.
  } finally {
    reader.releaseLock();
    await body.cancel().catch(() => {});
  }

  return new TextDecoder().decode(concat(chunks, size));
}

/**
 * The response body as JSON, reading no more than `MAX_BODY_BYTES` of it.
 *
 * `response.json()` reads whatever arrives, and what arrives is the provider's
 * choice. Counted while streaming rather than trusting `content-length`, which
 * is also the provider's and may simply be absent.
 */
async function readJson(response: Response): Promise<unknown> {
  const body = response.body;
  if (!body) throw new OutboundRefused(`refused ${response.url}: the response carried no body.`);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        throw new OutboundRefused(
          `refused ${response.url}: the response body is larger than the ${MAX_BODY_BYTES}-byte size this client will read.`,
        );
      }
      chunks.push(value);
    }
  } finally {
    // Releasing the lock lets `cancel()` reclaim the socket when the read was
    // abandoned part-way, which is exactly the oversized case.
    reader.releaseLock();
    if (size > MAX_BODY_BYTES) await body.cancel().catch(() => {});
  }

  return JSON.parse(new TextDecoder().decode(concat(chunks, size)));
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const all = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.byteLength;
  }
  return all;
}

/** The statuses that carry a `Location` worth following. */
function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
