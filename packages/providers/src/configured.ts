/**
 * WHICH PROVIDERS THIS INSTANCE REACHES, read out of one configured string.
 *
 * Separate from `boundary.ts`, which owns ADR-0034's two boundaries. Those
 * answer "may this URL be reached"; this answers "which URLs are there", and
 * they are different questions about the same configuration: an allowlisted
 * host nothing names is no provider, and a provider on no allowlisted host is
 * refused at the boundary rather than here.
 */

import { OutboundRefused } from "./boundary";

/**
 * Reads the providers this instance searches out of one configured string:
 * entries separated by commas or whitespace, each a provider's base URL.
 *
 * AS WRITTEN, NEVER NORMALISED, and that is the decision rather than laziness.
 * ADR-0031 makes a provider's URL its IDENTITY, and the identity is what the
 * source row on every imported claim carries -- so rewriting `http://host:8080`
 * to `http://host:8080/` here would make one provider two, and the catalogue
 * would hold a second item for every record imported under the other spelling.
 * The configured spelling is therefore the single spelling, and the owner's.
 *
 * A MALFORMED ENTRY THROWS RATHER THAN BEING SKIPPED, for the reason
 * `parseAllowlist` gives of its own: silently dropping one leaves the owner
 * believing a provider is being searched when it is not, and they find out by
 * its answers never appearing rather than at the moment they typed it.
 */
export function parseProviderUrls(configured: string): string[] {
  const entries = configured.split(/[\s,]+/).filter(Boolean);
  for (const entry of entries) {
    // `new URL` THROWS A BARE `TypeError` on a string it cannot parse, and that
    // is the reason this check is here rather than left to the client: a
    // `TypeError` out of a request is not an answer an owner can act on, and
    // ADR-0034's refusals are answers.
    //
    // WHAT IT ASKS IS ONLY WHETHER THE ENTRY IS A URL. The scheme and the
    // allowlist are `assertConfigUrl`'s questions and are asked where it asks
    // them, in front of the request -- one rule in two places is two rules that
    // drift.
    if (!URL.canParse(entry)) {
      throw new OutboundRefused(
        `provider \`${entry}\` is not a URL. ADR-0031 makes a provider a URL and nothing more, so each entry is a provider's base URL.`,
      );
    }
  }
  return entries;
}
