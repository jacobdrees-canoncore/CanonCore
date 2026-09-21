import { describe, expect, it } from "vitest";

import {
  carriesItsCorrection,
  filesSwept,
  statementsInFrozenProse,
  statementsOfTheSupersededCost,
  statementsReadingAsALiveCost,
  statesTheSupersededCost,
  THE_FROZEN_RUNG,
} from "./testing/corpus-import-cost";

/**
 * THE SPELLINGS, AS ROWS RATHER THAN AS A CLAIM THAT SOMEBODY CHECKED.
 *
 * The first version of this suite argued every one of these from a hand plant
 * into `import-runs.ts` on 2026-09-21: four forms pasted in one at a time, each
 * compared against a grep, then the file restored. That measurement proved the
 * patterns and then stopped existing. These rows run it on every push.
 *
 * THE NEAR MISSES ARE HALF OF IT. Two sentences in this tree wear these words
 * and are not this figure -- ADR-0133's "five and a half TIMES" and a research
 * document's "five and a half YEARS" -- so the unit is what separates them, and
 * a pattern that swept those in would be a check nobody could keep green.
 */
describe("a sentence stating the superseded cost", () => {
  it.each([
    ["the words", "the whole list is about five and a half hours"],
    ["shouted", "A WALK OF 465 CONTAINERS TAKES ABOUT FIVE AND A HALF HOURS"],
    ["hyphenated", "the split is what makes a five-and-a-half-hour import possible"],
    ["half hyphenated", "the five-and-a-half hours this record estimated further up"],
    [
      "a wrap, already flattened by the caller",
      "is about five and a half hours, and what interrupts",
    ],
    ["the arithmetic, with no words at all", "the corpus is 465 Containers at 43.8s each"],
    ["the arithmetic, reversed", "43.8s a Container over the corpus's 465"],
    ["the arithmetic, with a decimal in between", "465 Containers, each 25.5s to 43.8s"],
    ["a decimal spelling", "the corpus takes about 5.5 hours to import"],
    ["a fraction", "the corpus takes about 5 1/2 hours"],
    ["a vulgar half", "the corpus takes about 5½ hours"],
    ["words for the decimal", "the corpus takes about five point five hours"],
    ["abbreviated", "the corpus takes about five and a half hrs"],
    ["a non-ASCII hyphen", "a five\u2011and\u2011a\u2011half\u2011hour import"],
  ])("is recognised: %s", (_, sentence) => {
    expect(statesTheSupersededCost(sentence)).toBe(true);
  });

  it.each([
    ["a ratio, which is ADR-0133's", "five and a half times on Catalogue search"],
    [
      "a span of years, which is a research document's",
      "production, open for five and a half years",
    ],
    ["the per-page cost alone, which is TRUE", "the largest took 43.8s end to end"],
    ["the count alone, which is TRUE", "importing the wiki's corpus is 465 Containers"],
    ["the two figures in different sentences", "the corpus is 465 Containers"],
  ])("is not read into: %s", (_, sentence) => {
    expect(statesTheSupersededCost(sentence)).toBe(false);
  });
});

/**
 * WHAT COUNTS AS THE CORRECTION, held to rows for the reason above. Every phrase
 * is ADR-0135's or ADR-0137's own; `mistake` is the one this deliberately
 * refuses, because conceding a figure is wrong while still spending the
 * reader's attention on it is the site CNCORE-327 was filed about.
 */
describe("a correction beside the figure", () => {
  it.each([
    ["the measured total", "the whole corpus landed in roughly eleven minutes"],
    ["the total in digits", "about 11 minutes for the corpus"],
    ["the factor named as the worst case", "43.8s is the cost of the LARGEST page on the wiki"],
    ["the product refused", "multiplying it by 465 is not a bound on the list"],
    ["the product named a different thing", "it is a different quantity"],
  ])("is recognised: %s", (_, sentence) => {
    expect(carriesItsCorrection(sentence)).toBe(true);
  });

  it.each([
    [
      "conceding it is a mistake, which corrects nothing",
      "WHERE A FIVE-AND-A-HALF-HOUR MISTAKE WOULD HIDE",
    ],
    ["saying nothing about it", "a walk of 465 Containers is about five and a half hours"],
  ])("is not read into: %s", (_, sentence) => {
    expect(carriesItsCorrection(sentence)).toBe(false);
  });
});

describe("the superseded cost of importing the corpus", () => {
  it("is found in the tree at all", () => {
    expect(statementsOfTheSupersededCost().length).toBeGreaterThan(0);
  });

  /**
   * THE ONE PLACE A CORRECTION CANNOT LAND, HELD TO BEING THE ONLY ONE
   * (ADR-0047, ADR-0195).
   *
   * Migration 18's prose carries this figure and always will. ADR-0047's freeze
   * check hashes every applied rung against Drizzle's ledger, so editing a
   * shipped rung fails `db:check-ladder` on every database that has run it --
   * the Owner's install included. ADR-0134 met the identical wall from the
   * other side and named it: the rung "was frozen the moment a release applied
   * it, which is that record's rule working rather than an obstacle to route
   * around".
   *
   * SO THE EXEMPTION IS EXECUTED RATHER THAN WRITTEN DOWN, which is
   * `bounded-parameters.test.ts`'s rule in its own words: "an exemption nothing
   * executes is an exemption nobody can check." Held to EXACTLY this rung and
   * not to the ladder, so the two ways it could rot both redden. A NEW rung
   * stating the figure is caught while it can still be edited, which is the
   * only window there is; and a reader that stopped matching the rung's
   * spelling would empty this set rather than quietly shrinking the rule below.
   */
  it("stands in the frozen rung, which is the only prose that cannot be corrected", () => {
    expect(statementsInFrozenProse().map(({ path }) => path)).toStrictEqual([THE_FROZEN_RUNG]);
  });

  /**
   * BEFORE THE RULE, because a sweep that opened nothing would satisfy "no
   * statement reads as a live cost" by having no subject -- the vacuous pass
   * CNCORE-298 and CNCORE-314 each paid for. `trackedFiles` says in its own
   * docblock that it does not guard against an empty answer and leaves that to
   * its callers; this is this caller's half of that.
   */
  it("is looked for across the whole tracked tree", () => {
    expect(filesSwept()).toBeGreaterThan(500);
  });

  it("is never stated as a live cost", () => {
    expect(
      statementsReadingAsALiveCost().map(({ path, sentence }) => `${path}: ${sentence}`),
    ).toStrictEqual([]);
  });
});
