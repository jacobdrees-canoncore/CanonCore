/**
 * TEXT AS ONE LINE, so a pattern survives being re-wrapped.
 *
 * Every corpus this package reads sits in prose hard-wrapped at 100 columns,
 * and prose gets re-wrapped whenever a word above it changes length. Matching
 * raw bytes would redden a suite on a reflow that changed no claim, and a check
 * that cries wolf on formatting is a check people learn to silence.
 *
 * THE COST OF NOT DOING IT WAS MEASURED, which is why this is a module rather
 * than a line each caller writes for itself. `adr-as-built.test.ts` ran the
 * first version of its ADR-0081 assertion against the raw bytes and it PASSED
 * ON THE UNFIXED RECORD: the sentence it looked for is wrapped at 100 columns,
 * so "the" and "earliest" sat either side of a newline and the pattern simply
 * did not match. A check GREEN on the very defect it names is the false signal
 * `CLAUDE.md` is about.
 *
 * A MODULE OF ITS OWN rather than a second export from the reader that first
 * needed it, which is `repo-root.ts`'s shape and its reason (CNCORE-58). What
 * is worth one home here is not the expression -- a reader verifies that on
 * sight -- but the paragraph above it. Three copies of a one-line body is three
 * places for the REASON to be lost, and a caller that inherits the line without
 * the reason is a caller that will match raw bytes again the next time the
 * expression looks avoidable.
 *
 * IT IS NOT `@canoncore/text`'s `oneLine`, and that is a graph fact rather than
 * a preference. That function is the same collapse with control characters
 * stripped first, for a stranger's text rather than this repository's own prose,
 * and reaching it from here would mean `@canoncore/config` depending on
 * `@canoncore/text` -- which devDepends on this package, closing a cycle
 * `turbo.json`'s `test` task (`dependsOn: ["^test"]`) would refuse to build a
 * graph for. It is the cycle `repo-root.ts` names for `@canoncore/env`.
 *
 * A CALLER THAT NEEDS MORE WRAPS THIS rather than rewriting it:
 * `tree-figures.ts` strips the ` * ` and ` # ` leaders a wrap inserts into a
 * JSDoc or YAML comment, then flattens what is left.
 */
export function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
