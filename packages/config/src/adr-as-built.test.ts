import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "./testing/repo-root";

/**
 * `CLAUDE.md`'s rule about half a mechanism, held over the records code leans on.
 *
 * "A record whose mechanism you built only half of is not one you implemented:
 * leave it `proposed` and write into it which half landed and which did not. Half
 * a mechanism looks finished from outside, and the missing half surfaces later as
 * a false signal in whatever depends on it."
 *
 * THE CORPUS MOSTLY FOLLOWS IT ALREADY, which is what makes the gaps worth a
 * check rather than a rewrite: of the `proposed` records that source cites, most
 * carry an as-built note and a good half of those name a NOT BUILT half in as
 * many words. This holds the rest to the house style those set.
 *
 * IT ASKS THE TREE rather than a list somebody maintains, which is
 * `adr-numbering.test.ts`'s own reason in its own words -- "a record added
 * without touching this file is still covered". A named list of the eight
 * CNCORE-247 fixed would go stale on the ninth, and a check that goes stale
 * silently is the defect class this wave exists to remove. Decided by the
 * DISPATCHER on 2026-09-20, not by the Owner.
 *
 * WHAT COUNTS AS A CITATION IS THE SOURCE FORM `ADR-0081`, never `[[0081-slug]]`.
 * Records cite each other the second way and source comments use the first
 * (`adr-numbering.test.ts` states both), so reading the source form is what makes
 * this a question about CODE depending on a record rather than about prose
 * cross-referencing it. It also steps around a measured false positive: CNCORE-247
 * first counted ADR-0001 as cited, and its only match was the synthetic fixture
 * named `0001-a.md` inside `doc-line-citations.test.ts`.
 *
 * COMMENTS ARE NOT STRIPPED, which is the opposite of what `ui-callers.test.ts`
 * does and for the opposite reason. A citation of a record lives in a comment
 * almost by definition; stripping them here would empty the population and leave
 * this suite green having read nothing.
 *
 * A TEST FILE COUNTS AS A CITER. `ui-callers.test.ts` argues a test is not a
 * CALLER, and that argument does not carry here: a test citing ADR-0081 to say
 * what it pins is leaning on the record exactly as the migration beside it does,
 * and would go wrong in the same way if the record were wrong.
 *
 * WHAT THIS DOES NOT CATCH, said here rather than left to be discovered. It reads
 * whether a record DECLARES both halves, never whether the declaration is true --
 * no check can diff prose against a system. And `*.md` outside `docs/` is not
 * source, so root `CLAUDE.md` citing ADR-0055 does not put that record in the
 * population; that is CNCORE-247's own census boundary, kept deliberately.
 */
const adrDirectory = join(repoRoot, "docs", "adr");

/**
 * TEXT AS ONE LINE, so a pattern survives being re-wrapped.
 *
 * `corpus-figures.test.ts` states the reason and this file MEASURED it: the first
 * version of the ADR-0081 assertion below matched the raw bytes, and it passed on
 * the unfixed record. The sentence it was looking for is hard-wrapped at 100
 * columns, so "the" and "earliest" sit on either side of a newline and the
 * pattern simply did not match -- a check GREEN on the very defect it names,
 * which is the false signal `CLAUDE.md` is about.
 */
function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * A record's number, status, whole text and DECISION BLOCK, keyed by the four
 * digits it is cited by.
 *
 * THE DECISION BLOCK IS EVERYTHING ABOVE THE FIRST `##`, which is the unit
 * `.claude/rules/docs.md` already keys an ADR by -- "an ADR's opening decision
 * block, which is everything above its first `##`: name the record alone".
 *
 * THE TWO UNITS ARE NOT INTERCHANGEABLE, and this file learned that the hard way
 * rather than by design. The check that ADR-0081 no longer asserts a projection
 * nobody built was first run over the whole record, and it went red on the FIXED
 * record -- because the as-built note quotes the sentence it corrected, in as many
 * words, exactly as the house style asks. A record correcting itself has to be
 * able to say what it used to claim (ADR-0128 keeps superseded figures the same
 * way, labelled rather than deleted). So what a record ASSERTS is read from its
 * decision block, and what a record DECLARES about its halves is read from the
 * whole of it.
 */
function theRecords(): Map<
  string,
  { file: string; status: string; text: string; decision: string }
> {
  const records = new Map<
    string,
    { file: string; status: string; text: string; decision: string }
  >();
  for (const file of readdirSync(adrDirectory).filter((name) => name.endsWith(".md"))) {
    const number = /^(\d{4})-/.exec(file)?.[1];
    if (number === undefined) continue;
    const raw = readFileSync(join(adrDirectory, file), "utf8");
    records.set(number, {
      file,
      status: /^status:\s*(\S+)/m.exec(raw)?.[1] ?? "unstated",
      text: flatten(raw),
      decision: flatten(raw.split(/^## /m)[0] ?? ""),
    });
  }
  return records;
}

/**
 * Every record number the repository's SOURCE cites, as `ADR-0081`.
 *
 * `-z` RATHER THAN LINES, so a path is whatever git says it is --
 * `ui-callers.test.ts`'s finding, where `core.quotePath` octal-escapes a
 * non-ASCII filename into one that then fails to open.
 *
 * IT THROWS ON AN EMPTY POPULATION rather than reporting that every record is
 * fine. A pathspec that stopped matching would turn this whole file green having
 * asked nothing, which is the shape both `ui-callers.test.ts` and
 * `corpus-figures.test.ts` raise at the root of their own chains.
 */
function citedBySource(): Set<string> {
  const tracked = execFileSync(
    "git",
    ["ls-files", "-z", "--", ".", ":(exclude)docs/**", ":(exclude)*.md"],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  )
    .split("\0")
    .filter((path) => path.length > 0);

  const cited = new Set<string>();
  for (const path of tracked) {
    for (const [, number] of readFileSync(join(repoRoot, path), "utf8").matchAll(
      /ADR-(\d{4})/g,
    )) {
      if (number !== undefined) cited.add(number);
    }
  }

  if (cited.size === 0) {
    throw new Error(
      "no tracked source file cites a record, so the as-built rule has no subject. Either the " +
        "pathspec stopped matching or the citation form moved away from `ADR-0081`.",
    );
  }
  return cited;
}

describe("a proposed record that source leans on", () => {
  /**
   * CNCORE-247's SHARPEST FINDING, and the one that is a CORRECTION rather than
   * an addition: ADR-0081 stated as present fact something its own migration
   * says is deliberately false.
   *
   * The record said "the item's projected `release_date` column is the earliest
   * of them". The column ships empty and is excluded from the projection on
   * purpose -- `project_item()` sets `title` and `sort_name` and nothing else,
   * the migration says so in as many words, and `projection.test.ts` pins it: a
   * `released` statement on an item leaves `releaseDate` null.
   *
   * BOTH HALVES OF THE CORRECTION ARE ASSERTED, because either alone passes on a
   * wrong record. Deleting the sentence would satisfy "does not claim the column
   * holds it" while throwing away the decision the record exists to make, and
   * CNCORE-247 asked for the sentence FIXED WHERE IT STANDS. So the definition
   * has to survive and the false present tense has to go.
   */
  it("does not claim ADR-0081's column holds a value the projection never writes", () => {
    const record = theRecords().get("0081");
    if (record === undefined) throw new Error("ADR-0081 is missing from docs/adr/");

    // THE DECISION SURVIVES THE CORRECTION. This record exists to define the
    // term, and that definition is not what was wrong with it.
    expect(
      record.text,
      "ADR-0081 no longer defines release_date as the earliest known release of any edition, " +
        "which is the decision the record exists to make rather than the claim that was wrong.",
    ).toMatch(/earliest known release/i);

    expect(
      record.decision,
      "ADR-0081's decision block still states that the projected `release_date` column IS the " +
        "earliest of the edition dates. `project_item()` sets `title` and `sort_name` only, the " +
        "migration excludes the column deliberately, and `projection.test.ts` pins it null.",
    ).not.toMatch(/projected `release_date` column is the earliest/);

    // AND THE CORRECTION IS RECORDED rather than quietly swapped, which is what
    // keeps a reader who remembers the old sentence from reading the new one as a
    // drift. ADR-0092 does the same for a version number it had wrong.
    expect(
      record.text,
      "ADR-0081 was corrected without saying so, so a reader who remembers the old sentence " +
        "cannot tell a fix from a rewrite.",
    ).toMatch(/CNCORE-247/);
  });
});
