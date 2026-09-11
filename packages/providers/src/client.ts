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
} from "./boundary";
import {
  type CmppBrowse,
  type CmppManifest,
  type CmppRecord,
  cmppBrowse,
  cmppManifest,
  cmppRecord,
} from "./cmpp";

/**
 * A provider, as CanonCore knows it: a URL, and a validated response shape
 * (ADR-0031). Never a plugin, never code running inside the app.
 */
export interface ProviderClient {
  manifest(): Promise<CmppManifest>;
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

/*
 * NO `search` HERE, AND ITS ABSENCE IS DELIBERATE. ADR-0033 makes `search`
 * required OF A PROVIDER, which `provider-wiki` answers; that is a different
 * claim from this app needing to CALL it. Nothing in CanonCore searches yet --
 * an import names a record by id -- so a client method with only tests behind it
 * would be an abstraction ahead of a need. It arrives with the surface that
 * searches.
 */

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
    if (!response.ok) {
      // Drained before throwing, or the socket is held until the dispatcher
      // times it out.
      await response.body?.cancel();
      throw new Error(`${base.origin}${path} answered ${response.status}.`);
    }
    return schema.parse(await readJson(response));
  }

  async function read<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
    const response = await get(path);
    if (!response.ok) {
      // Drained before throwing, or the socket is held until the dispatcher
      // times it out -- the same reason the redirect hop above drains.
      await response.body?.cancel();
      throw new Error(`${base.origin}${path} answered ${response.status}.`);
    }
    return schema.parse(await readJson(response));
  }

  return {
    manifest: () => read("/", cmppManifest),
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
