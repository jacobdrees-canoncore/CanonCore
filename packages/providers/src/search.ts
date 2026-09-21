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
  /**
   * Named by the URL, because at this point nothing has read a name for it --
   * reading the name is one of the things that failed.
   *
   * NOT THE INCONSISTENCY IT LOOKS LIKE beside `SearchedProvider`, which
   * carries a name precisely so a URL need not be shown. The contract test's
   * rule is about a READER of the catalogue, who is handed a source's claims
   * and has no business being handed its deployment address. This is for the
   * OWNER, who typed these URLs, is the only person who can fix one, and cannot
   * act on "a provider you configured is down".
   */
  baseUrl: string;
  /**
   * AS IT WAS THROWN, WHICH IS WHY THIS IS `unknown` (ADR-0183).
   *
   * It was `Error`, and an `asError` here wrapped anything else in
   * `new Error(String(thrown))` BEFORE `reasonFor` saw it -- so a wordless
   * throw arrived at `packages/api` already spelled, as an `Error` whose
   * message was the word `undefined`, and the branch ADR-0183 added could
   * never fire on this surface. The wrap's own argument was that `reasonFor`
   * needed an `Error` to read a message off; it does not, and takes `unknown`.
   *
   * THE ERROR STILL TRAVELS WHOLE, which is what this field was always for: a
   * caller tells an `OutboundRefused` from a provider that answered badly, and
   * `packages/api` maps the first onto a declared error rather than a 500
   * (ADR-0034). Widening the type takes nothing away from that -- it stops one
   * value being narrowed by being rewritten.
   */
  reason: unknown;
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
  //
  // TRIMMED FIRST, because a box a user tabbed through holds spaces rather than
  // nothing and the two are the same mistake. Both real providers trim before
  // they judge -- `?q=%20%20%20` answers `400` on each, checked against the
  // running images rather than assumed -- so an untrimmed check here would let
  // exactly the outcome above through for the commonest spelling of the
  // mistake.
  if (query.trim() === "") {
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
        return { failure: { baseUrl, reason: error } };
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
 * One provider's answer, with the name it gives itself.
 *
 * THE MANIFEST IS READ FOR THE NAME, because a source answers "who said this"
 * and `http://127.0.0.1:39481` shows a reader a deployment detail -- the same
 * reason an import reads it before writing a source row.
 *
 * SO A PROVIDER WHOSE MANIFEST IS UNREADABLE FAILS EVEN IF ITS `search` WOULD
 * HAVE ANSWERED, and that is the right answer rather than a gap in the
 * tolerance above. A claim is a DATED CLAIM BY A NAMED SOURCE (ADR-0017), and
 * these candidates exist to be imported as exactly that -- so a candidate
 * nothing can attribute is not a lesser answer, it is one with no use to put it
 * to. The available fallback makes the case: naming the provider by its base
 * URL would hand a reader the deployment detail the contract test exists to
 * keep away from them.
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
