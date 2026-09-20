import { shortenTo, type WhyNotNamed } from "@canoncore/providers";

import { oneValue } from "@/components/query-params";

/**
 * WHICH REFUSAL A REDIRECT IS CARRYING, written once because two ends read it
 * -- `/login/refusal.ts`'s arrangement at the other surface that has to report
 * a refusal through an address (CNCORE-262).
 *
 * `nameProvider` builds the address and the settings page reads it back, and as
 * one string spelled out in each file a rename on either side COMPILES CLEANLY
 * and renders nothing at all: a page silently missing the one sentence it
 * exists to say. That is the defect this ticket is fixing, so it is not one to
 * leave a fresh way of reaching.
 *
 * THE NAME IS SHARED WITH CNCORE-255, which reached the same shape
 * independently on `/items/<id>`: `?refused=<what>&because=<code>` reads as the
 * sentence it is, and `CONTEXT.md` binds names in code and UI copy alike. Two
 * parameters meaning one thing on two surfaces is the divergence this wave
 * keeps finding, and a shipped parameter name is hard to take back.
 *
 * THREE WORDS AND NOT THE PROCEDURE'S SENTENCE, which is ADR-0156 and is the
 * decision worth reading twice. `?because=` sits in an address the OWNER can edit, so a value
 * copied out of a refusal's message would be a way to put a sentence of
 * somebody else's choosing in front of a reader under CanonCore's own styling
 * -- `/login/page.tsx` already states that rule of its own parameter, and
 * ADR-0123 makes whose words a reader is shown the question this app answers at
 * every seam. A closed set of three cannot say anything this page did not
 * write, and the page owns every sentence below.
 */
export const REFUSED = {
  /** The box held nothing, or nothing but whitespace. */
  nothing: "nothing-named",
  /** More than one entry: a paste of two Providers, named at once. */
  several: "not-one-provider",
  /** One entry, and it is not a URL -- commonly a host with no scheme. */
  notAUrl: "not-a-url",
  /**
   * NOT ABOUT THE ENTRY AT ALL: the Providers already stored would not parse,
   * so there was no list to add one to.
   *
   * IT IS HERE SO THAT NOTHING FALLS THROUGH SILENTLY. The three above are the
   * refusals the Owner's own text can raise; this is every other refusal the
   * procedure can answer with, and without it an action matching on three
   * codes would simply return -- rendering the unchanged page that this whole
   * ticket exists to stop. `WhyNotNamed` does not carry it, because
   * `@canoncore/providers` never raises it: it is the SURFACE's word for "a
   * refusal that was not about what you typed".
   */
  unreadable: "setting-unreadable",
} as const;

/** The three, as the page matches what an address carries against them. */
const THE_THREE = Object.values(REFUSED);

/**
 * WHICH OF THE THREE AN ADDRESS NAMES, or nothing at all.
 *
 * ANYTHING ELSE IS NOTHING, which is what keeps `?because=` from being an opening.
 * It is read exactly as `oneValue` reads every other parameter -- a repeated or
 * blank one names nothing -- and then held to the closed set, so a hand-edited
 * address renders the page with no notice rather than a notice of the editor's
 * choosing.
 */
export type WhyItWasRefused = (typeof REFUSED)[keyof typeof REFUSED];

/**
 * THE THREE `@canoncore/providers` RAISES, held against its own type, so a
 * fourth added there without a word here fails to compile rather than arriving
 * on the page as whatever the last branch happened to be.
 */
const _theProvidersPackageAgrees: Record<WhyNotNamed, WhyItWasRefused> = {
  "nothing-named": REFUSED.nothing,
  "not-one-provider": REFUSED.several,
  "not-a-url": REFUSED.notAUrl,
};
void _theProvidersPackageAgrees;

export function oneBecause(parameter: string | string[] | undefined): WhyItWasRefused | undefined {
  const word = oneValue(parameter);
  return THE_THREE.find((known) => known === word);
}

/**
 * HOW MUCH OF THE REFUSED ENTRY THE SENTENCE QUOTES BACK.
 *
 * THE SAME 80 `shortly` USES INSIDE `@canoncore/providers`, and decided here
 * rather than imported, which is ADR-0123's own arrangement: the cut is shared
 * and each ceiling sits beside the sentences it bounds. An Owner who typed a
 * long base URL still recognises its opening, and what they cannot do without
 * is the clause saying what to do -- which is exactly what keeping the value
 * short protects.
 */
const ENTRY_MAX = 80;

/**
 * THE ENTRY A REFUSAL IS ABOUT, AT A LENGTH THIS PAGE CHOSE.
 *
 * BOUNDED AT THE SEAM, WHICH FOR A QUERY PARAMETER IS HERE. `Reason` states the
 * rule -- "the LENGTH is not the Provider's to choose either, and that is
 * settled before it arrives: `reasonFor` caps it at the seam rather than the
 * page truncating what it was handed" -- and a value off the address has no
 * earlier seam than the read. It never passes through the Server Action at all:
 * a hand-typed `/settings?refused=...` reaches this page having touched
 * nothing else, so a bound applied where the redirect is BUILT would guard the
 * one path that was never the problem.
 *
 * AND THAT IS WHY IT IS BOUNDED RATHER THAN LEFT TO `TheirWords`. That
 * component says of itself that it does not "quote, bound or attribute" -- it
 * settles WIDTH, by breaking a long word, and a value of any length still
 * occupies the page. ADR-0142 fixes how somebody else's text is laid out;
 * ADR-0123 fixes how much of it this app repeats, and they are two questions.
 *
 * WITHOUT IT A FORGEABLE ADDRESS PUTS AN UNBOUNDED STRING INSIDE A SENTENCE
 * THIS PAGE SPEAKS IN ITS OWN VOICE, which is the harm the closed set above
 * exists to prevent, arriving through the other parameter. Holding one and not
 * the other would leave the door open beside the lock.
 */
export function theEntryRefused(parameter: string | string[] | undefined): string | undefined {
  const entry = oneValue(parameter);
  return entry === undefined ? undefined : shortenTo(entry, ENTRY_MAX);
}
