import { describe, expect, it } from "vitest";

import {
  filesSwept,
  statementsInFrozenProse,
  statementsOfTheSupersededCost,
  statementsReadingAsALiveCost,
  THE_FROZEN_RUNG,
} from "./testing/corpus-import-cost";

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
