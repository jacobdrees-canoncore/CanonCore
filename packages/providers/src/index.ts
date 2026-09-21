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
  type AssertAddresses,
  allowsAnything,
  assertConfigAddresses,
  assertConfigUrl,
  assertContentAddress,
  assertContentAddresses,
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
