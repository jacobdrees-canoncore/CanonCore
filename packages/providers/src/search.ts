import type { Allowlist } from "./boundary";
import { createProviderClient } from "./client";
import type { CmppRecord } from "./cmpp";

/** Which provider answered: its URL, which IS its identity (ADR-0031), and its own name for itself. */
export interface SearchedProvider {
  baseUrl: string;
  name: string;
}

/** One provider's candidates, and who it was that offered them. */
export interface ProviderAnswer {
  provider: SearchedProvider;
  results: CmppRecord[];
}

/**
 * A provider that could not be asked, or that answered badly.
 *
 * THE ERROR ITSELF rather than a sentence about it, so that a caller can still
 * tell an `OutboundRefused` -- a URL this instance may not reach -- from a
 * provider that was reached and fell over. `packages/api` maps the first onto a
 * declared error and not a 500 (ADR-0034), and a string would have thrown that
 * away here.
 */
export interface FailedProvider {
  /** Named by the URL, because at this point nothing has read a name for it. */
  baseUrl: string;
  reason: Error;
}

/**
 * What every provider between them said, AND WHICH OF THEM DID NOT SAY IT.
 *
 * TWO LISTS RATHER THAN ONE SHORT ONE. A provider that is down and a provider
 * that matched nothing are different answers, and a fan-out that swallowed the
 * first would report them identically -- which is how an owner concludes their
 * query was wrong when their provider was merely offline.
 */
export interface ProviderSearch {
  answered: ProviderAnswer[];
  failed: FailedProvider[];
}

/**
 * One provider's turn, settled either way.
 *
 * WRITTEN OUT RATHER THAN INFERRED, because the type TypeScript infers from the
 * two returns below carries each key as optional on the other branch -- so
 * `"answer" in outcome` narrows to `ProviderAnswer | undefined` and the
 * partition below stops typechecking. Naming the union is what makes the `in`
 * check a discriminant.
 */
type Outcome = { readonly answer: ProviderAnswer } | { readonly failure: FailedProvider };

/**
 * Reaching every named provider's `search` at once.
 *
 * THE CALLER NAMES THE URLS, and there is no registry to consult because
 * ADR-0031 makes a provider a URL and nothing more.
 */
export async function searchProviders(
  { baseUrls, allowlist }: { baseUrls: string[]; allowlist: Allowlist },
  query: string,
): Promise<ProviderSearch> {
  // AN EMPTY QUERY IS THE CALLER'S MISTAKE AND IS REFUSED HERE, before a socket
  // opens. Every provider answers `?q=` with a `400` (ADR-0033, CNCORE-33) and
  // every failure below is tolerated, so fanning one out would answer `{
  // answered: [], failed: [...] }` -- an owner reads that as "nothing matched",
  // and the mistake is hidden by the very leniency that makes a fan-out worth
  // having. The client itself still sends it, which is what keeps this app a
  // caller of `?q=` rather than a stranger to it.
  if (query === "") {
    throw new Error("an empty query is not a query: `searchProviders` was given nothing to find.");
  }

  // EACH PROVIDER CATCHES ITS OWN, which is what `Promise.all` cannot do for
  // us: it rejects on the first failure, so one provider having a bad day would
  // empty a search of every OTHER provider's answers -- and it would do it
  // non-deterministically, whichever of them lost the race deciding.
  const outcomes = await Promise.all(
    baseUrls.map(async (baseUrl): Promise<Outcome> => {
      try {
        return { answer: await askOneProvider(baseUrl, allowlist, query) };
      } catch (error) {
        return { failure: { baseUrl, reason: asError(error) } };
      }
    }),
  );

  // IN THE ORDER THE CALLER NAMED THEM. Pushing as each settles would order
  // these by which provider was quickest, which is a different list on every
  // run and reads as flakiness to whatever asserts on it.
  const answered: ProviderAnswer[] = [];
  const failed: FailedProvider[] = [];
  for (const outcome of outcomes) {
    if ("answer" in outcome) answered.push(outcome.answer);
    else failed.push(outcome.failure);
  }
  return { answered, failed };
}

/**
 * What was thrown, as an `Error`.
 *
 * A `catch` catches whatever was thrown and that is not necessarily an `Error`
 * at all. Wrapping rather than asserting keeps `reason.message` a sentence a
 * caller can show, whatever a provider's client library decided to throw.
 */
function asError(thrown: unknown): Error {
  return thrown instanceof Error ? thrown : new Error(String(thrown));
}

/**
 * One provider's answer, with the name it gives itself.
 *
 * THE MANIFEST IS READ FOR THE NAME, because a source answers "who said this"
 * and `http://127.0.0.1:39481` shows a reader a deployment detail -- the same
 * reason an import reads it before writing a source row.
 */
async function askOneProvider(
  baseUrl: string,
  allowlist: Allowlist,
  query: string,
): Promise<ProviderAnswer> {
  const client = createProviderClient({ baseUrl, allowlist });
  try {
    const manifest = await client.manifest();
    const { results } = await client.search(query);
    return { provider: { baseUrl, name: manifest.name }, results };
  } finally {
    // Two undici agents and therefore two connection pools. Left open they keep
    // sockets alive long after the one search that needed them.
    await client.close();
  }
}
