/**
 * Reaching a provider, and the two outbound boundaries that stand in front of
 * every request to one.
 *
 * ADR-0103's first seam is what this file publishes, so it is an ENUMERATION
 * rather than a `export *`: a symbol is public here because a line was written
 * for it, and a helper added to `boundary.ts` tomorrow is private until
 * somebody decides otherwise.
 */
export {
  type Allowlist,
  type AssertAddress,
  allowsAnything,
  assertConfigAddress,
  assertConfigUrl,
  assertContentAddress,
  assertContentUrl,
  type Boundary,
  OutboundRefused,
  parseAllowlist,
  pinnedLookup,
  type Resolve,
  type ResolvedAddress,
} from "./boundary";
export { createProviderClient, type ProviderClient } from "./client";
export {
  type CmppBrowse,
  type CmppManifest,
  type CmppPlacement,
  type CmppRecord,
  type CmppSearch,
  cmppBrowse,
  cmppManifest,
  cmppPlacement,
  cmppRecord,
  cmppSearch,
} from "./cmpp";
export {
  nameProvider,
  ProviderNotNamed,
  parseProviderUrls,
  removeProvider,
  type WhyNotNamed,
} from "./configured";
export {
  type DeclaredCredential,
  type ProviderReach,
  type Reach,
  reachProviders,
  unlockUrlFor,
} from "./credential";
export {
  bounded,
  boundedTo,
  type FailureReason,
  failureReason,
  REASON_MAX_LENGTH,
  reasonFor,
} from "./reason";
export {
  type FailedProvider,
  type ProviderAnswer,
  type ProviderSearch,
  type SearchedProvider,
  searchProviders,
} from "./search";
/**
 * THE CUT ITSELF, AND NOT EITHER CEILING (CNCORE-269, CNCORE-268, CNCORE-262).
 *
 * `shortly` and `bounded` stay private -- `boundary.test.ts` says so of the
 * first in as many words -- because each carries a NUMBER that belongs beside
 * the sentences it bounds, and a caller outside this package is not bounding
 * one of those sentences. What a caller outside CAN need is the cut: ending on
 * a whole code point, with the marker inside the bound. `apps/web` reached for
 * it when the settings surface began echoing an address's own value into a
 * sentence, and the alternative was a fourth hand-maintained copy of the same
 * five lines -- which is the cost ADR-0123 records `packages/tasks` already
 * paying, and the drift CNCORE-269 merged two copies to end.
 *
 * TWO TICKETS PUBLISHED IT IN THE SAME HOUR AND FOR THE SAME REASON, which is
 * the strongest argument for it either could make. CNCORE-268 needed the cut to
 * bound a Container id inside the refusal that names it; CNCORE-262 needed it to
 * bound the entry `/settings` echoes back out of its own address. Neither knew
 * of the other, both arrived at "publish the cut, keep the ceilings private",
 * and this docblock is the two landing as one line rather than as two.
 */
export { shortenTo } from "./shorten";
