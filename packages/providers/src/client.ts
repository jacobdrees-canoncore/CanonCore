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
  type CmppContainers,
  type CmppManifest,
  type CmppRecord,
  type CmppSearch,
  cmppBrowse,
  cmppContainers,
  cmppManifest,
  cmppRecord,
  cmppSearch,
} from "./cmpp";
import { bounded, REASON_MAX_LENGTH } from "./reason";

/**
 * EVERY VALUE THIS FILE INTERPOLATES INTO A REFUSAL GOES THROUGH `shortly`, with
 * no exception for one this app owns (ADR-0123, CNCORE-249).
 *
 * The cap does not BOUND a sentence assembled from a value of any length, it
 * TRUNCATES it, and what it takes is the END -- the half carrying the verdict
 * and the remedy. So the value is bounded WHERE IT ENTERS and the prose around
 * it is then fixed-length and always survives.
 *
 * THE FILE WAS WALKED WHOLE RATHER THAN PATCHED AT THE THREE SITES THAT WERE
 * FILED, and a fourth and fifth value were bounded with them. ADR-0123 under
 * "The rule had three sites in one file that broke it" carries the rest: which
 * values are the provider's and which the Owner's, why the Owner's own is
 * bounded too, the arithmetic at each site, and which two have no test and why.
 */

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
  /**
   * The containers the provider's source asserts, as records. OPTIONAL OF A
   * PROVIDER and declared, as `browse` is (ADR-0033), so a caller asks the
   * manifest before calling for the reason given there.
   */
  containers(): Promise<CmppContainers>;
  close(): Promise<void>;
}

/**
 * How many hops before the client gives up. A provider that redirects is
 * ordinary (ADR-0034 departs from OWASP deliberately on this); one that
 * redirects five times is a loop.
 */
const MAX_HOPS = 5;

/**
 * HOW LONG A PROVIDER MAY TAKE TO START ANSWERING, BY THE SIZE OF THE QUESTION.
 *
 * ONE CAP FOR EVERY OPERATION IS WHAT CNCORE-151 WAS. `browse` answers a whole
 * container AND its ordering in a single response (ADR-0033); the other three
 * answer something a few hundred bytes long. Those are not the same question and
 * they do not deserve the same cap. Measured against tardis.wiki on 2026-09-13,
 * time to FIRST BYTE through `provider-wiki`: a manifest 0.02s, a search 0.25s, a
 * browse of `Theory:Timeline - Melanie Bush` 1.9s, of the Eleventh Doctor's 8.9s,
 * and of `Theory:Timeline - Doctor Who universe/AHistory` -- the largest that
 * wiki holds, 2,913 members over 2,669 positions -- 25.7s. So the largest and
 * most valuable ordering on the wiki could not be imported AT ALL, and the Owner
 * saw `Internal server error`.
 *
 * THE ORIGINAL REASON IS UNCHANGED AND IS NOW ATTACHED TO THE RIGHT THING. "A
 * provider that stops answering must not hold the import open forever" is a
 * sentence about a provider that has STOPPED, and one still computing has not
 * stopped. undici already splits those two questions and this file was answering
 * both with one number: `headersTimeout` is the wait for a FIRST byte, and
 * `bodyTimeout` is the gap BETWEEN body chunks -- an inactivity guard rather than
 * a total. undici's own documented example sets the two apart
 * (`headersTimeout: 5_000, bodyTimeout: 30_000`), so this is its grain rather
 * than a departure from it.
 */
const PATIENCE = {
  /**
   * A manifest, a search, a lookup. UNCHANGED at ten seconds -- what changed is
   * that it is no longer also the cap on a browse.
   *
   * IT IS NOT FREE TO GROW. `/settings` reads every configured provider's
   * manifest to report its reach and its credential state, so a provider that
   * accepts a connection and then never answers holds that page for exactly this
   * long (ADR-0122) -- and `/settings` is the page where such a provider is
   * removed. Raising the cap globally, which is the obvious fix for CNCORE-151
   * and the wrong one, would have paid for a browse with that page.
   */
  brief: 10_000,
  /**
   * A whole container. 2.3x the largest browse the wiki can be asked for, and a
   * fifth of undici's own 300s default -- which the sentence this replaces
   * rightly called long enough to look like a hang.
   *
   * THE SINGLE-BROWSE FIGURE IS STABLE AND THE HEADROOM IS NOT. Five clean runs
   * of AHistory on 2026-09-13 gave 25.5, 25.6, 25.9, 26.1 and 26.4s -- under a
   * second of spread. But TWO of them at once took 49.1s EACH, measured the same
   * afternoon: this provider is one Node process and two large browses roughly
   * double each other. So the margin over a single browse is 2.3x and the margin
   * over two at once is 1.2x, and it is CONTENTION rather than page size that
   * eats it. A third concurrent browse would not fit, and the answer to that is a
   * faster provider or an ordering that arrives in pages rather than whole --
   * which ADR-0130 records as the direction and ADR-0033 would have to be
   * reopened to take. NOT a bigger number here, which buys a little headroom and
   * spends it on the concurrency margin two paragraphs down.
   *
   * NOBODY BUT THE OWNER CAN SPEND IT, WHICH IS WHAT CNCORE-154 SETTLED. This
   * paragraph carried a TODO saying `provider.container` was an `openProcedure`
   * that answered "how many placements would this import?" by doing the whole
   * browse -- so the number here was also the longest a STRANGER could hold this
   * provider for, once a request. ADR-0131 moved that read behind the Owner, and
   * the fix was that surface's rather than this constant's exactly as the TODO
   * said. What is left is a bound on what the Owner's own pages wait for.
   *
   * IT IS STILL NOT LARGER, AND THE REASON CHANGED RATHER THAN LAPSED. The
   * margin is 1.2x over two concurrent browses, and the Owner can open two tabs
   * as easily as anyone -- so raising this still spends that margin, which is
   * what the first paragraph refuses. The answer to a third concurrent browse is
   * still a faster provider or a paged ordering.
   *
   * IT BOUNDS A PROVIDER'S THINKING RATHER THAN AN IMPORT'S RUNNING. What comes
   * back is one response, so this is not a budget for the whole import: a
   * catalogue of fifty timelines spends this per browse, not across them.
   */
  patient: 60_000,
} as const;

/** Which of the two caps an operation asks for. */
type Patience = keyof typeof PATIENCE;

/**
 * How long a provider may go SILENT in the middle of answering.
 *
 * TEN SECONDS WHATEVER THE QUESTION, because this one does not scale with the
 * size of the answer the way `PATIENCE` does. It is the gap BETWEEN chunks, and a
 * provider sending a megabyte sends it in chunks milliseconds apart: measured on
 * the same live browses, all 1,340,208 bytes of AHistory arrived within 5.7ms of
 * its first byte. A ten-second gap is a provider that has stopped, at any size.
 */
const SILENCE_MS = 10_000;

/**
 * How much of a provider's answer will be read before giving up on it.
 *
 * NEITHER CAP ABOVE BOUNDS THIS ONE. `SILENCE_MS` caps the GAP between chunks and
 * `PATIENCE` the wait for the first, so a provider that keeps sending, promptly,
 * satisfies both forever -- ten seconds of steady loopback is a great deal of
 * bytes. A CMPP manifest is a few hundred bytes and a record is a few hundred
 * more, so 4 MiB is far past anything honest and far short of anything that
 * hurts.
 *
 * A BROWSE IS THE ONE ANSWER THAT APPROACHES IT. Measured live on 2026-09-13, the
 * largest timeline the wiki holds browses to 1,340,208 bytes -- a third of this,
 * and the only measured answer within an order of magnitude of it.
 */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * How much of a FAILING answer is read before the socket is let go (CNCORE-140).
 *
 * NOT `MAX_BODY_BYTES`, WHICH IS FOUR MEBIBYTES. What is wanted out of a failure
 * is ONE SENTENCE, and only `REASON_MAX_LENGTH` of it survives to a page.
 *
 * THE ARITHMETIC, SPELLED OUT BECAUSE AN EARLIER VERSION OF THIS COMMENT GOT IT
 * WRONG: it claimed 1,200 bytes carried the longest reason and that the constant
 * was "three times that" while the constant WAS 1,200. Twelve is three times
 * four, and both halves are measured rather than assumed. `REASON_MAX_LENGTH`
 * counts UTF-16 UNITS, and a unit costs AT MOST THREE UTF-8 BYTES -- that is a
 * BMP character, and an astral one is four bytes spread across two units, so it
 * is cheaper per unit rather than dearer. So 900 bytes carries the longest
 * reason there can be, and the remaining three quarters is headroom for the
 * envelope around it and for a provider that writes other keys ahead of its
 * `error`.
 *
 * IT BOUNDS WHAT IS ASKED FOR RATHER THAN CUTTING AT AN EXACT BYTE. The read
 * stops requesting chunks once it holds this much and keeps whole the chunk that
 * took it there, so a small body arrives entire and a flood stops within one
 * chunk of the bound. That is all this number is for: a provider flooding a
 * failure body is not sending a sentence, and reading four mebibytes of one to
 * print three hundred characters would hold the socket open for exactly the
 * reason the drain existed.
 */
const MAX_REASON_BYTES = 12 * REASON_MAX_LENGTH;

export function createProviderClient({
  baseUrl,
  allowlist,
  patience = PATIENCE,
}: {
  baseUrl: string;
  allowlist: Allowlist;
  /**
   * `PATIENCE`'S TWO CAPS, OVERRIDDEN BY THE SUITE THAT TESTS THEM AND BY NOTHING
   * ELSE. No caller in the app passes this and none should: the numbers are this
   * client's own contract with a provider, not a knob an instance tunes.
   *
   * IT IS HERE BECAUSE THE BEHAVIOUR IS OTHERWISE UNTESTABLE IN CI. What the suite
   * has to pin is that a browse OUTLIVES what a search dies at, and at the real
   * values the cheapest honest proof of that waits ten seconds -- thirty times
   * this package's whole run, and half a second clear of a real boundary, which is
   * where flakes come from. The relation holds at any scale, so the suite proves
   * it small: ~2s rather than ~12s, which is as far down as undici's timer
   * granularity allows and the test says why.
   */
  patience?: Record<Patience, number>;
}): ProviderClient {
  const base = new URL(baseUrl);

  /**
   * FOUR DISPATCHERS ON TWO AXES, and neither axis is optional.
   *
   * THE BOUNDARY AXIS IS ADR-0034'S AND UNCHANGED. The config dispatcher may
   * reach an address the owner allowlisted -- that is what makes a loopback or
   * tailnet provider legal by name. The content dispatcher may not, ever,
   * whatever the allowlist says. They cannot be one because a single agent's
   * lookup hook cannot tell which hop it is on.
   *
   * THE PATIENCE AXIS IS CNCORE-151'S, AND IT IS ON THE DISPATCHER BECAUSE UNDICI
   * PUTS IT THERE. `fetch`'s `RequestInit` has no `headersTimeout` -- measured
   * against undici 8 on 2026-09-13, one passed per request is accepted in silence
   * and IGNORED, and the dispatcher's value is what fires. So a cap that varies
   * by operation means a dispatcher per class of operation; there is no per-call
   * spelling of it to reach for instead.
   *
   * PATIENCE FOLLOWS THE OPERATION ACROSS EVERY HOP, which is why the content
   * side carries both too. A browse that redirects is still a browse, and the hop
   * that finally answers it is the one doing the thinking.
   *
   * Named `dispatcher` and not `agent` although the undici type is `Agent`:
   * CONTEXT.md is binding on names and lists `agent` under what a Provider must
   * not be called, and `dispatcher` is undici's own word for the thing anyway --
   * it is the option these are passed as.
   */
  const dispatchersFor = (lookup: ReturnType<typeof pinnedLookup>) => ({
    brief: new Agent({
      connect: { lookup },
      headersTimeout: patience.brief,
      bodyTimeout: SILENCE_MS,
    }),
    patient: new Agent({
      connect: { lookup },
      headersTimeout: patience.patient,
      bodyTimeout: SILENCE_MS,
    }),
  });

  const configDispatchers = dispatchersFor(pinnedLookup(assertConfigAddress(allowlist)));
  const contentDispatchers = dispatchersFor(pinnedLookup(assertContentAddress));

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
  async function get(path: string, waiting: Patience): Promise<Response> {
    // The FIRST hop is the config URL the owner typed. Checked before the
    // socket opens: refusing after connecting has already told an
    // unallowlisted host that this instance exists.
    let url = new URL(path, base);
    assertConfigUrl(url, allowlist);
    let dispatcher = configDispatchers[waiting];

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
      dispatcher = contentDispatchers[waiting];
    }

    throw new OutboundRefused(`refused ${shortly(base.origin)}: more than ${MAX_HOPS} redirects.`);
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
    waiting: Patience,
  ): Promise<z.infer<T> | null> {
    const response = await get(path, waiting);
    if (response.status === 404) {
      await response.body?.cancel();
      return null;
    }
    if (!response.ok) throw await failed(response, path);
    return schema.parse(await readJson(response));
  }

  async function read<T extends z.ZodType>(
    path: string,
    schema: T,
    waiting: Patience,
  ): Promise<z.infer<T>> {
    const response = await get(path, waiting);
    if (!response.ok) throw await failed(response, path);
    return schema.parse(await readJson(response));
  }

  return {
    manifest: () => read("/", cmppManifest, "brief"),
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
    search: (query) => read(`/search?q=${encodeURIComponent(query)}`, cmppSearch, "brief"),
    // A record the provider does not hold is an ANSWER, not a failure: it is
    // what `search` returning an ambiguous candidate looks like once the
    // candidate turns out to be gone (ADR-0033).
    lookup: (id) => readOrNull(`/lookup/${encodeURIComponent(id)}`, cmppRecord, "brief"),
    // And neither is a page that addresses no container. ADR-0066: an id that
    // cannot BE an identity addresses nothing, exactly as one nobody minted
    // does, and a caller must not be able to tell the two apart.
    //
    // THE ONE PATIENT OPERATION, AND THE ONLY ONE THAT ANSWERS A WHOLE CONTAINER.
    // `PATIENCE` carries the measurements; what belongs here is that the two go
    // together -- an operation gets the longer cap BECAUSE it returns an ordering
    // whose size is the source's business rather than this client's.
    browse: (id) => readOrNull(`/browse/${encodeURIComponent(id)}`, cmppBrowse, "patient"),
    // BRIEF, BECAUSE IT IS MEASURED AS BRIEF. `provider-wiki` answered all 465
    // of its timelines in 0.26s to first byte and 90,683 bytes on 2026-09-19,
    // beside a search's 0.25s. A provider that cannot answer its containers in
    // one quick call declines the operation (ADR-0033 under CNCORE-186).
    containers: () => read("/containers", cmppContainers, "brief"),
    async close() {
      // ALL FOUR, and a missed one leaks its sockets until the process ends. The
      // grid is walked rather than listed for exactly that reason: a fifth
      // dispatcher would otherwise have to remember to add itself here.
      await Promise.all(
        [configDispatchers, contentDispatchers].flatMap((boundary) =>
          Object.values(boundary).map((dispatcher) => dispatcher.close()),
        ),
      );
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
      `refused a redirect from ${shortly(from.origin)}: \`${shortly(location)}\` is not a URL.`,
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
  // BOUNDED HERE AND NOT ONLY ON THE WAY TO A PAGE, which is not the same cap
  // twice. `reasonFor` bounds what a page RENDERS; this Error is also carried
  // whole by `FailedProvider`, whose `reason.message` `search.ts` reads
  // directly -- so a provider's text left unbounded here reaches that consumer
  // at whatever length it chose. ADR-0123's rule is that the value is bounded
  // WHERE IT ENTERS the sentence, and this is where it enters.
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
  // AN EMPTY ONE IS STILL AN ANSWER, and returning `null` for it would send the
  // envelope to be quoted with its braces showing. A provider that wrote the
  // field and put nothing in it has said nothing, which `failed` already has a
  // sentence for.
  return typeof said === "string" ? said : null;
}

/**
 * The first `MAX_REASON_BYTES` of a body, as text, or nothing.
 *
 * A READ THAT THROWS PART-WAY HAS NO SENTENCE TO QUOTE. A provider that died
 * mid-body left a fragment of one, and `failed` already says the honest thing
 * about a provider that said nothing. The socket is released either way, in
 * `readAtMost`'s own `finally`.
 */
async function firstBytesOf(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return "";
  try {
    const { bytes } = await readAtMost(body, MAX_REASON_BYTES);
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
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
  if (!body)
    throw new OutboundRefused(`refused ${shortly(response.url)}: the response carried no body.`);

  const { bytes, cut } = await readAtMost(body, MAX_BODY_BYTES);
  if (cut) {
    throw new OutboundRefused(
      `refused ${shortly(response.url)}: the response body is larger than the ${MAX_BODY_BYTES}-byte size this client will read.`,
    );
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * A body's bytes up to `limit`, AND WHETHER THERE WERE MORE OF THEM.
 *
 * ONE READ LOOP FOR THE TWO BOUNDS THIS FILE HOLDS A PROVIDER TO, because they
 * are the same loop and differ only in what the caller does at the ceiling:
 * `readJson` REFUSES a body past `MAX_BODY_BYTES`, and `firstBytesOf` keeps what
 * it has and walks away. Written twice, the two would quietly stop agreeing
 * about the part that is hard -- which is the release below rather than the
 * counting.
 *
 * `cancel()` IN A `finally` IS WHAT RELEASES THE SOCKET. A body read to its end
 * is already closed and cancelling it again is a no-op; a body abandoned at the
 * ceiling has the rest of itself still arriving, and this is what reclaims that
 * socket rather than leaving it to `bodyTimeout`. The lock is released first,
 * which is what lets the cancel through.
 *
 * IT READS ONE CHUNK PAST `limit` ON PURPOSE. `cut` has to distinguish a body
 * that ENDED at the ceiling from one that merely reached it, and nothing but
 * asking for the next chunk can tell those apart -- so `readJson` refusing a
 * body of exactly `MAX_BODY_BYTES` would be a refusal of a body that was fine.
 */
async function readAtMost(
  body: ReadableStream<Uint8Array>,
  limit: number,
): Promise<{ bytes: Uint8Array; cut: boolean }> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size <= limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    // Releasing the lock lets `cancel()` reclaim the socket when the read was
    // abandoned part-way, which is exactly the oversized case.
    reader.releaseLock();
    await body.cancel().catch(() => {});
  }

  return { bytes: concat(chunks, size), cut: size > limit };
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
