import type { WhyNotNamed } from "@canoncore/providers";

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
 * THREE WORDS AND NOT THE PROCEDURE'S SENTENCE, which is the decision worth
 * reading twice. `?because=` sits in an address the OWNER can edit, so a value
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
} as const satisfies Record<string, WhyNotNamed>;

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
export function oneBecause(parameter: string | string[] | undefined): WhyNotNamed | undefined {
  const word = oneValue(parameter);
  return THE_THREE.find((known) => known === word);
}
