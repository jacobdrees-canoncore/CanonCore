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
  cmppBrowse,
  cmppManifest,
  cmppPlacement,
  cmppRecord,
} from "./cmpp";
