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

/**
 * What separates the entries this file writes back.
 *
 * A NEWLINE RATHER THAN A COMMA, because the string is read by a person only
 * when something has gone wrong with it -- a row in a database, a value in a
 * log -- and one provider per line is what reads there. `parseProviderUrls`
 * splits on either (ADR-0121), so this is a choice about legibility and never
 * about meaning.
 *
 * IT SEPARATES, AND THAT IS ALL IT TOUCHES. Every entry on either side of it is
 * the owner's own spelling, byte for byte: this rejoins a list, it does not
 * rewrite one.
 */
const BETWEEN_ENTRIES = "\n";

/**
 * Names one more provider, answering the configuration the owner now has.
 *
 * IT VALIDATES THROUGH `parseProviderUrls` RATHER THAN BESIDE IT. Whether an
 * entry is a URL is that function's question and it throws `OutboundRefused`
 * with a sentence the owner can act on; asking it again here in different words
 * would be two rules for one fact, and the settings surface would refuse things
 * a configured instance accepts.
 *
 * A REPEAT IS NOT AN ADDITION. A provider named twice is searched twice, so an
 * owner who types one they already have gets the configuration they already
 * had. The comparison is EXACT, because a provider's URL is its identity
 * (ADR-0031) and two spellings of one host are two identities to every source
 * row in the catalogue.
 */
export function nameProvider(configured: string, baseUrl: string): string {
  const named = parseProviderUrls(configured);
  // The entry is parsed rather than trusted: `parseProviderUrls` is what refuses
  // one that is not a URL, and what strips the whitespace around what the owner
  // typed into a form.
  const [entry, ...rest] = parseProviderUrls(baseUrl);
  if (entry === undefined || rest.length > 0) {
    throw new OutboundRefused(
      `\`${baseUrl}\` is not one provider. A provider is a URL and nothing more (ADR-0031), so name them one at a time.`,
    );
  }
  if (named.includes(entry)) return configured;
  return [...named, entry].join(BETWEEN_ENTRIES);
}

/**
 * Stops this instance naming one provider, answering the configuration the
 * owner now has.
 *
 * IT REMOVES THE PROVIDER FROM THE LIST, NOT FROM THE CATALOGUE. `CONTEXT.md`
 * keeps Purge for the second thing and it is a different operation with a
 * different confirmation (ADR-0046): everything this provider ever claimed
 * stays, attributed to it, and the only change is that nothing asks it again.
 *
 * AN EXACT MATCH, for the reason `nameProvider` above is exact. A provider's URL
 * is its identity (ADR-0031), so removing `http://host:8080/` when the owner
 * named `http://host:8080` would be this app deciding the two were one -- which
 * is the same decision the store refuses to make by never normalising an entry.
 *
 * REMOVING WHAT WAS NEVER NAMED CHANGES NOTHING, rather than refusing. The
 * configuration the owner asked for is the one they already have, and a second
 * click on a Remove button is not an error.
 */
export function removeProvider(configured: string, baseUrl: string): string {
  const [entry] = parseProviderUrls(baseUrl);
  return parseProviderUrls(configured)
    .filter((named) => named !== entry)
    .join(BETWEEN_ENTRIES);
}
