import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "./testing/repo-root";

/**
 * An ADR's NUMBER is its identity, and two records cannot share one.
 *
 * `docs/adr/` is the authority (`CLAUDE.md`), and records are cited by number
 * from three places: other records as `[[0120-the-slug]]`, source comments as
 * `ADR-0120`, and tickets. All three resolve through the number, so two records
 * under one number make every citation of it ambiguous -- and the ambiguity is
 * silent, because each citation still reads as though it names something.
 *
 * WHY A TEST RATHER THAN CARE. Two agents working in parallel each pick the next
 * free number from the tree AS THEY SEE IT, and both are right at the moment they
 * pick. Whichever merges second lands a duplicate, and GIT CANNOT REPORT IT: the
 * filenames differ by their slugs, so the two files merge clean and no conflict
 * is ever raised. That is the shape `CLAUDE.md` warns about in as many words --
 * "parallel agents produce semantic contradictions that compile cleanly" -- and
 * it is the reason the instruction to read the diff before merging exists.
 *
 * MEASURED RATHER THAN HYPOTHETICAL: it happened on 2026-09-11 between CNCORE-66
 * and CNCORE-68, which both took 0120. It was caught by a reviewer reading the
 * diff, which is the thing this repo already decided not to rely on for the
 * competitor sweep's citations (`sweep-shard-citations.test.ts`) for the same
 * reason -- a corpus that drifted once under review is one review cannot be asked
 * to hold again by hand.
 *
 * IT ASKS THE TREE rather than a list somebody maintains, so a record added
 * without touching this file is still covered.
 */
const adrDirectory = join(repoRoot, "docs", "adr");

/** Every record's number, as the four digits its filename opens with. */
function numbered(): { number: string; file: string }[] {
  return readdirSync(adrDirectory)
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({ number: /^(\d{4})-/.exec(file)?.[1], file }))
    .flatMap(({ number, file }) => (number === undefined ? [] : [{ number, file }]));
}

describe("the decision records", () => {
  /**
   * And the reader above is one that can answer at all: an empty directory, or a
   * naming convention this stopped matching, would satisfy the uniqueness
   * assertion by having no subject.
   */
  it("are all named with a four-digit number", () => {
    const files = readdirSync(adrDirectory).filter((file) => file.endsWith(".md"));

    expect(files.length).toBeGreaterThan(0);
    expect(numbered().length).toBe(files.length);
  });

  it("use each number exactly once", () => {
    const seen = new Map<string, string[]>();
    for (const { number, file } of numbered()) {
      seen.set(number, [...(seen.get(number) ?? []), file]);
    }

    const shared = [...seen.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([number, files]) => `${number}: ${files.join(", ")}`);
    expect(shared).toStrictEqual([]);
  });
});
