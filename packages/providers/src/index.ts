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
export { nameProvider, parseProviderUrls, removeProvider } from "./configured";
export {
  type DeclaredCredential,
  type ProviderReach,
  type Reach,
  reachProviders,
  unlockUrlFor,
} from "./credential";
export {
  bounded,
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
 * THE CUT AND NOT A CEILING, which is the whole of what CNCORE-269 decided and
 * the reason this one line is public while `shortly` and `bounded`'s numbers
 * stay where they are. A caller outside this package bounding a value it
 * interpolates into a refusal needs the CUT -- whole code points, the marker
 * inside the bound -- and its own ceiling, because that number is a fact about
 * its own sentences. `provider.beginImportRun` is the first such caller
 * (CNCORE-268): it quotes back a Container id it refused for being too long,
 * which is exactly the value that would otherwise eat the sentence explaining
 * itself.
 *
 * IT IS NOT AN INVITATION TO COPY THE CUT. `@canoncore/tasks` keeps one by hand
 * because ADR-0123 puts this package out of its reach deliberately -- it depends
 * on `@canoncore/db` alone -- and that copy fell out of step twice, at
 * CNCORE-272 and CNCORE-274. Anything that already depends on this package takes
 * the cut from here instead.
 */
export { shortenTo } from "./shorten";
