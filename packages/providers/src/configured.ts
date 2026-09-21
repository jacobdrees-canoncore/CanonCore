/**
 * WHICH PROVIDERS THIS INSTANCE REACHES, read out of one configured string.
 *
 * Separate from `boundary.ts`, which owns ADR-0034's two boundaries. Those
 * answer "may this URL be reached"; this answers "which URLs are there", and
 * they are different questions about the same configuration: an allowlisted
 * host nothing names is no provider, and a provider on no allowlisted host is
 * refused at the boundary rather than here.
 */

import { OutboundRefused, SettingNotRead, shortly } from "./boundary";

/**
 * WHICH REFUSAL AN ENTRY MET, as a word rather than as a sentence (CNCORE-262).
 *
 * THREE MISTAKES WITH THREE DIFFERENT REMEDIES, and the whole reason this type
 * exists is that they must never be told alike. An entry that is nothing, an
 * entry that is several and an entry that is not a URL send the Owner to three
 * different corrections -- type one, name them one at a time, and include the
 * scheme -- so a surface that collapsed any two of them would hand out the
 * wrong one. That is `ReachNotice`'s argument on the settings page already,
 * arriving at the field directly above it.
 *
 * A WORD AND NOT THE SENTENCE, because the sentence is the SURFACE'S. ADR-0123
 * settles whose words a reader is being shown, and a refusal raised here is
 * read by an API caller, a log and a page that each say it differently; a
 * message copied out of this file into an address is a sentence nobody owns,
 * which is the rule `settings/actions.ts` already states in its own words.
 */
export type WhyNotNamed = "nothing-named" | "not-one-provider" | "not-a-url";

/**
 * An entry the Owner typed that names no one provider, AND WHICH OF THE THREE
 * WAYS it failed to (CNCORE-262).
 *
 * A SUBCLASS RATHER THAN A FIELD ON `OutboundRefused`, because `why` is a fact
 * about ONE question -- "is this text one provider" -- and that class answers
 * ADR-0034's two boundaries for every outbound request there is. A field added
 * there would be `undefined` at every site but these three and would read as
 * something every refusal ought to carry.
 *
 * `config` AS THE BOUNDARY, which is what this refusal actually is: it judges a
 * URL THE OWNER TYPED, so it is this app talking to them about a setting only
 * they can change, rather than a provider's claim quoted back.
 */
export class ProviderNotNamed extends OutboundRefused {
  readonly why: WhyNotNamed;

  constructor(message: string, why: WhyNotNamed) {
    super(message, "config");
    this.name = "ProviderNotNamed";
    this.why = why;
  }
}

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
      // THROUGH `shortly`, like every other value this package interpolates
      // into a refusal (ADR-0123, CNCORE-249). It was raw here while the
      // sibling refusal below was bounded, which is one rule obeyed in one of
      // two places -- and the value is the owner's own configured string, so
      // its length is not something this package gets to assume.
      throw new SettingNotRead(
        `provider \`${shortly(entry)}\` is not a URL. ADR-0031 makes a provider a URL and nothing more, so each entry is a provider's base URL.`,
        "not-a-url",
        entry,
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
  const [entry, ...rest] = whatWasNamed(baseUrl);
  /*
   * NOTHING NAMED AND SEVERAL NAMED ARE TWO MISTAKES, and one `if` answered
   * both until CNCORE-262. `parseProviderUrls` splits whitespace away, so a box
   * of spaces is NO entries -- the absence an empty box is, wearing another
   * spelling -- and it met the sentence written for the owner who pasted two,
   * telling them to "name them one at a time" about a mistake they had not
   * made. The remedies are opposites: type one, or type fewer.
   */
  if (entry === undefined) {
    throw new ProviderNotNamed(
      "no provider was named. A provider is a URL and nothing more (ADR-0031), so name it by its base URL.",
      "nothing-named",
    );
  }
  if (rest.length > 0) {
    throw new ProviderNotNamed(
      `\`${shortly(baseUrl)}\` is not one provider. A provider is a URL and nothing more (ADR-0031), so name them one at a time.`,
      "not-one-provider",
    );
  }
  if (named.includes(entry)) return configured;
  return [...named, entry].join(BETWEEN_ENTRIES);
}

/**
 * The entries ONE THING THE OWNER TYPED splits into, with a refusal that says
 * WHICH mistake it was rather than only that there was one (CNCORE-262).
 *
 * IT RE-RAISES RATHER THAN RE-ASKS. Whether an entry is a URL stays
 * `parseProviderUrls`'s question and is asked exactly once; what this adds is
 * the word `not-a-url`, so all three refusals the naming path can raise carry
 * the same discriminator and the surface reads one field instead of three
 * shapes. Asking the question a second time here would be the second rule this
 * file's own docstring refuses.
 */
function whatWasNamed(baseUrl: string): string[] {
  try {
    return parseProviderUrls(baseUrl);
  } catch (cause) {
    if (cause instanceof OutboundRefused) throw new ProviderNotNamed(cause.message, "not-a-url");
    throw cause;
  }
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
