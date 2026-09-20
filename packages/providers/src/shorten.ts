/**
 * What stands in for the part of a string its reader does not get to read.
 *
 * INSIDE THE BOUND RATHER THAN ADDED TO IT, which is what makes the ceiling a
 * ceiling: a caller that asked for at most `max` characters and got `max` plus a
 * marker has been handed a value past the limit it stated.
 */
const MARKER = "…";

/**
 * A stranger's string at no more than `max` characters INCLUDING the marker that
 * says it was cut, ending on a WHOLE CHARACTER.
 *
 * CUT ON A WHOLE CHARACTER. `slice` counts UTF-16 units, so a cut landing
 * between the two halves of an astral character leaves a lone surrogate that
 * renders as a replacement glyph -- and a provider picks the offsets here by
 * choosing what it sends. Dropping a trailing high surrogate costs one character
 * of a string that was being cut anyway.
 *
 * ONE FUNCTION FOR BOTH CEILINGS, which is ADR-0123's own lesson applied to the
 * cut itself (CNCORE-269). `shortly` bounds a value where it ENTERS a refusal at
 * 80 and `bounded` bounds the whole sentence on its way to a page at 300; they
 * are two numbers and one rule, and written twice they were two rules -- one
 * carried the hazard above in a comment and guarded it, the other did neither,
 * and the gap held only by accident of which callers happened to pass ASCII. The
 * numbers stay where they are decided, beside the sentences they bound; what is
 * shared is the cut, and this is the one place saying why.
 */
export function shortenTo(text: string, max: number): string {
  if (text.length <= max) return text;
  const kept = text.slice(0, max - MARKER.length);
  const last = kept.charCodeAt(kept.length - 1);
  const whole = last >= 0xd800 && last <= 0xdbff ? kept.slice(0, -1) : kept;
  return `${whole}${MARKER}`;
}
