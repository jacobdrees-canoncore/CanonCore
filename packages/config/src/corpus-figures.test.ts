import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "./testing/repo-root";

/**
 * ONE SIZE FOR ONE POPULATION ACROSS `docs/adr/`, which is `node-major.test.ts`'s
 * shape pointed at a measurement rather than at a version.
 *
 * `docs/adr/` is the authority (`CLAUDE.md`) and three adjacent records quote the
 * same corpus: ADR-0128's argument for reading a page's TITLE rather than its
 * namespace, and ADR-0129's and ADR-0130's counts of which timelines import. They
 * disagreed. ADR-0128 said 464 twice and the two beside it said 465 twice each,
 * so the authority asserted two sizes for one population and nothing anywhere
 * reported it (CNCORE-157).
 *
 * BOTH WERE RIGHT ON THE DAY THEY WERE WRITTEN, which is the worst shape a wrong
 * figure can take, because nothing is a defect and yet the records contradict
 * each other. 464 was counted against the archive on 2026-09-12; the wiki gained
 * a page and the live count is 465. A reader re-deriving either one had no way to
 * tell a drift from a mistake.
 *
 * THE SAME DEFECT ONE REPOSITORY ALONG. `provider-wiki` stated 464 in six files
 * while its own report said 465, and CNCORE-156 held them together with
 * `test/corpus-figures.test.ts`. This is that device on this side of the
 * boundary: no PR in `provider-wiki` can reach `docs/adr/`, so the records here
 * need a check of their own.
 */
const adrDirectory = join(repoRoot, "docs", "adr");

const ORDERING_AXIS = "0128-an-ordering-is-the-sources-own-axis-not-release-order.md";
const ARCHIVE_DELETED = "0129-the-archive-is-deleted-and-the-live-wiki-is-the-only-source.md";
const CAP_PER_QUESTION = "0130-a-providers-cap-is-per-kind-of-question.md";

/**
 * A RECORD AS ONE LINE, so a pattern survives being re-wrapped.
 *
 * Every figure below sits in prose hard-wrapped at 100 columns, and prose gets
 * re-wrapped whenever a word above it changes length. Matching raw bytes would
 * redden this suite on a reflow that changed no claim, and a check that cries
 * wolf on formatting is a check people learn to silence.
 */
function record(file: string): string {
  return readFileSync(join(adrDirectory, file), "utf8").replace(/\s+/g, " ").trim();
}

/**
 * A record as its SENTENCES, each flattened the same way.
 *
 * THE DATE AND THE POPULATION ARE ASSERTED AGAINST THE SENTENCE RATHER THAN THE
 * FILE OR THE PARAGRAPH, and both looser readings were tried here first.
 *
 * Per FILE is `provider-wiki`'s eleventh-pass finding: "every record quoting a
 * corpus figure states the date somewhere in it" is satisfied by a date belonging
 * to an unrelated measurement further down.
 *
 * Per PARAGRAPH fails the same way in this very record, which is why it is not
 * what this uses. ADR-0128's opening paragraph carries the corpus figure AND
 * CNCORE-102's 113-of-298 pairs measurement, taken 2026-09-12 on a different
 * question -- so a paragraph-level date assertion was GREEN on the unfixed
 * record, reading the pairs measurement's date as the corpus figure's. Measured
 * while writing this file. A check that passes on the defect it names is the
 * false signal `CLAUDE.md` is about, so the unit is the sentence the figure is
 * stated in.
 *
 * SPLIT ON A FULL STOP THAT ENDS A SENTENCE, which is a stop followed by space
 * and then a capital, a backtick or a bold marker. A stop inside `2026-09-13`,
 * inside `tardis.wiki` or closing a bold lead-in like `MATTERS.**` is followed by
 * something else, so none of them splits.
 */
function sentences(file: string): string[] {
  return readFileSync(join(adrDirectory, file), "utf8")
    .replace(/\s+/g, " ")
    .split(/(?<=\.)\s+(?=[A-Z`*])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * ADR-0128's namespace partition, as three separate counts over ONE listing of
 * `ns 114, non-redirect`: the whole namespace, the timelines in it, and the pages
 * in it that are not timelines.
 *
 * THE THIRD ONE IS THE WHOLE REASON THIS EXISTS. It was the only figure in the
 * record that had never been counted, and it is now stated rather than left to be
 * derived from the two beside it.
 */
const NAMESPACE_WHOLE = /holds \*\*([\d,]+) non-redirect pages/g;
const NAMESPACE_TIMELINES = /of which ([\d,]+) are timelines/g;
const NAMESPACE_NOT_TIMELINES = /and the other ([\d,]+) are not\*\*/g;

/**
 * Every sentence in `docs/adr/` that states the size of the `Theory:Timeline`
 * corpus, and the pattern that reads the figure out of it.
 *
 * ANCHORED TO THE SENTENCE RATHER THAN TO A BARE NUMBER, because these records
 * legitimately quote other counts in the hundreds -- 463 that import, 446 reached
 * by name, 426 distinct stories -- and a looser match would read one of those as
 * the corpus and fail on correct prose.
 *
 * A PATTERN THAT STOPS MATCHING THROWS rather than quietly covering nothing. That
 * is the actionlint probe's lesson and `node-major.test.ts`'s: an assertion that
 * something must BE there cannot fail by no longer matching, so a reworded
 * sentence goes red and this table has to follow it.
 */
const CORPUS_SIZE_STATED: { file: string; pattern: RegExp }[] = [
  { file: ORDERING_AXIS, pattern: /tardis\.wiki writes ([\d,]+) `Theory:Timeline` pages/g },
  { file: ORDERING_AXIS, pattern: NAMESPACE_TIMELINES },
  { file: ARCHIVE_DELETED, pattern: /IT IS TWO OF ([\d,]+), AND THE TAIL IS MEASURED/g },
  { file: ARCHIVE_DELETED, pattern: /463 of ([\d,]+) orderings import/g },
  { file: CAP_PER_QUESTION, pattern: /AND CAUGHT TWO PAGES OF ([\d,]+)\./g },
  { file: CAP_PER_QUESTION, pattern: /\*\*463 of ([\d,]+) imported\.\*\*/g },
];

/**
 * The wiki's own unplaced sections, counted over the corpus rather than the
 * namespace -- a DIFFERENT population from the partition above, and the reason
 * the population goes into the sentence rather than being assumed from the record.
 */
const UNPLACED_BULLETS = /unplaced sections hold \*\*([\d,]+) story bullets/g;

/**
 * The figures ADR-0128 keeps as the ARCHIVE's rather than refreshing, each of
 * which has to say so where it is stated.
 *
 * A SUPERSEDED FIGURE IS KEPT ON PURPOSE HERE, and ADR-0129 is why: "the live
 * figures are not corrections of the archive's and must not be read as such",
 * because the two were counted over different populations on different days. So
 * the old figure stays visible rather than being written over -- and a figure
 * that stays visible without saying WHICH corpus it came from is the defect
 * CNCORE-157 was raised for, not the fix for it.
 *
 * `~/tardis-pipeline` IS GONE (ADR-0129), so neither of these is re-derivable by
 * anybody, ever again. That is precisely why the label has to be in the sentence:
 * a reader who tries to reproduce one against the live wiki will not get it, and
 * the only thing that can tell them they are not looking at a mistake is the word
 * beside the number.
 */
const ARCHIVE_ERA_FIGURES: RegExp[] = [
  /`1,240 - 464`/g,
  /\*\*703 story bullets across 125 pages\*\*/g,
];

/**
 * EVERY CORPUS FIGURE ADR-0128 STATES, which is what criterion one is held to.
 *
 * The two corpus sizes, the two halves of the namespace partition beside them,
 * and the wiki's own unplaced bullets. Four of the five are counted over
 * `ns 114, non-redirect` or the `Theory:Timeline` corpus inside it; the fifth is
 * counted over the corpus alone. That they sit in one record and belong to two
 * populations is exactly why each states which.
 *
 * A FIGURE MISSING FROM THIS LIST IS NOT CAUGHT, said here rather than left to be
 * discovered -- a new sentence quoting the corpus is covered only by being added,
 * exactly as a new place stating the Node major is covered only by being added to
 * `node-major.test.ts`. What IS caught is one of these being reworded, because a
 * pattern that stops matching throws rather than quietly covering nothing.
 */
const ADR_0128_CORPUS_FIGURES: RegExp[] = [
  ...CORPUS_SIZE_STATED.filter(({ file }) => file === ORDERING_AXIS).map(({ pattern }) => pattern),
  NAMESPACE_WHOLE,
  NAMESPACE_NOT_TIMELINES,
  UNPLACED_BULLETS,
];

/**
 * The one figure a pattern reads out of a record, or a throw naming the pattern.
 *
 * EXACTLY ONE MATCH, never the first of several: a sentence duplicated by a copy
 * edit is two statements of the figure that are then refreshed one at a time,
 * which is the defect this file exists for in miniature.
 */
function sizeStated({ file, pattern }: { file: string; pattern: RegExp }): number {
  const found = [...record(file).matchAll(pattern)];
  if (found.length !== 1) {
    throw new Error(
      `docs/adr/${file} has ${found.length} sentences matching ${pattern}, not 1. Either the ` +
        "sentence was reworded and this table has to follow it, or the figure is now stated twice.",
    );
  }
  return Number((found[0] as RegExpMatchArray)[1]?.replace(/,/g, ""));
}

/**
 * The sentence a figure is stated in, or a throw naming the pattern.
 *
 * ONE SENTENCE, never the first of several, for the reason `sizeStated` gives.
 */
function sentenceStating({ file, pattern }: { file: string; pattern: RegExp }): string {
  const found = sentences(file).filter((sentence) => [...sentence.matchAll(pattern)].length > 0);
  if (found.length !== 1) {
    throw new Error(`docs/adr/${file} has ${found.length} sentences matching ${pattern}, not 1`);
  }
  return found[0] as string;
}

describe("the Theory:Timeline corpus as docs/adr/ states it", () => {
  /**
   * BEFORE ANY COMPARISON, because a table that matched nothing would satisfy
   * "they all agree" by having no subject -- the eleventh pass's finding in
   * `provider-wiki`, and `adr-numbering.test.ts`'s reason for asking the tree
   * whether it can be read at all.
   */
  it("is read out of more than one record, and every figure is a count", () => {
    expect(CORPUS_SIZE_STATED.length).toBeGreaterThan(1);
    expect(new Set(CORPUS_SIZE_STATED.map(({ file }) => file)).size).toBeGreaterThan(1);

    for (const stated of CORPUS_SIZE_STATED) {
      const size = sizeStated(stated);
      expect(Number.isInteger(size), `${stated.file} states ${size}`).toBe(true);
      expect(size, `${stated.file} states ${size}`).toBeGreaterThan(0);
    }
  });

  /**
   * THE DEFECT ITSELF. `docs/adr/` is one authority and a population has one
   * size in it, whatever the sentence around the figure happens to be arguing.
   */
  it("is one size, stated the same in every record that states it", () => {
    const stated = CORPUS_SIZE_STATED.map((entry) => ({
      file: entry.file,
      size: sizeStated(entry),
    }));
    const distinct = [...new Set(stated.map(({ size }) => size))];

    expect(
      distinct,
      `docs/adr/ states ${distinct.join(" and ")} for one population: ` +
        `${stated.map(({ file, size }) => `${file.slice(0, 4)}=${size}`).join(", ")}. ` +
        "The live count is in provider-wiki's fixture/timeline/COVERAGE.md, regenerated by " +
        "`pnpm measure:timelines`; a figure deliberately kept as the archive's says so beside it.",
    ).toHaveLength(1);
  });

  /**
   * CRITERION THREE, AND THE ONE FIGURE IN ADR-0128 NOBODY HAD EVER COUNTED.
   *
   * `the other 776` was `1,240 - 464`, and it survived because it kept producing
   * the right answer: the namespace and the corpus each gained the same one page,
   * so the remainder was still 776 when both of its inputs had moved. A method
   * that is wrong and right at the same time is one nothing can catch by checking
   * the answer, which is why this checks the SHAPE instead -- all three counts
   * stated, and the two halves adding to the whole.
   *
   * NOT A CHECK ON ANYBODY'S ARITHMETIC. The three figures are read out of the
   * record's own prose, and they add up only because one listing was counted twice
   * over. Refresh one of them alone and this goes red, which is the point: a
   * partition refreshed a third at a time is three figures from three populations.
   */
  it("partitions the namespace by counting both halves, never by subtracting one", () => {
    const whole = sizeStated({ file: ORDERING_AXIS, pattern: NAMESPACE_WHOLE });
    const timelines = sizeStated({ file: ORDERING_AXIS, pattern: NAMESPACE_TIMELINES });
    const notTimelines = sizeStated({ file: ORDERING_AXIS, pattern: NAMESPACE_NOT_TIMELINES });

    expect(
      timelines + notTimelines,
      `docs/adr/${ORDERING_AXIS} states ${timelines} timelines and ${notTimelines} other pages ` +
        `in a namespace of ${whole}. Both halves are counted over one listing of the namespace ` +
        "in provider-wiki's fixture/timeline/COVERAGE.md, so they add up; a remainder is not a " +
        "count of anything.",
    ).toBe(whole);
  });

  /**
   * CRITERION ONE, AND THE THING THAT MAKES A DRIFT TELLABLE FROM A MISTAKE.
   *
   * A bare number says nothing about what was counted or when, so a reader who
   * re-derives it and gets something else cannot tell which of the two of them is
   * wrong. ADR-0128's argument rests on TWO populations that differ by a factor of
   * nearly three -- `ns 114, non-redirect` and the `Theory:Timeline` corpus inside
   * it -- and the defect CNCORE-156 was raised for one repository along is a
   * sentence whose number came from one population while its words described
   * another.
   *
   * ADR-0128 ONLY, and that is the ticket rather than an oversight. ADR-0129's and
   * ADR-0130's figures are about which timelines IMPORT and both records date
   * their measurement in the prose around it; holding them to the population
   * string as well is a rewrite of two records that are correct, and CNCORE-157
   * asked for ADR-0128's copy.
   */
  it("carries the population and the measurement date in ADR-0128's own sentences", () => {
    expect(ADR_0128_CORPUS_FIGURES.length).toBeGreaterThan(3);

    for (const pattern of ADR_0128_CORPUS_FIGURES) {
      const entry = { file: ORDERING_AXIS, pattern };
      const sentence = sentenceStating(entry);

      expect(
        sentence,
        `a corpus figure in docs/adr/${entry.file} names no measurement date: ${sentence}`,
      ).toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
      expect(
        sentence,
        `a corpus figure in docs/adr/${entry.file} names no population: ${sentence}`,
      ).toMatch(/`ns 114[^`]*non-redirect`/);
    }
  });

  /**
   * CRITERION FOUR: A FIGURE THE RECORD DID NOT MEASURE NAMES WHAT REGENERATES IT.
   *
   * Every corpus figure ADR-0128 quotes belongs to `provider-wiki` -- CanonCore
   * asks the wiki nothing and counts nothing -- so a reader who wants to check one
   * has to know where it comes from. `fixture/timeline/COVERAGE.md` is committed
   * and needs no Credential to READ, which is what makes it the right pointer: the
   * script behind it needs the Owner's (ADR-0122) and so is not something a reader
   * can be sent to instead.
   *
   * ONCE PER RECORD RATHER THAN BESIDE EACH FIGURE, unlike the date and the
   * population above. There is one report and four figures, and a pointer repeated
   * four times is four things to edit when the path moves. The date cannot be
   * shared that way because a record legitimately quotes several, measured on
   * different days for different questions -- which is the trap this file's
   * `sentences` comment records.
   */
  it("names the report that regenerates the figures it did not measure", () => {
    const axis = record(ORDERING_AXIS);

    expect(
      axis,
      `docs/adr/${ORDERING_AXIS} quotes provider-side corpus figures and never names the ` +
        "committed report they come from.",
    ).toContain("fixture/timeline/COVERAGE.md");
    expect(
      axis,
      `docs/adr/${ORDERING_AXIS} names the report but not the command that regenerates it, so a ` +
        "reader who finds it stale cannot refresh it.",
    ).toContain("pnpm measure:timelines");
  });

  /**
   * CRITERION TWO. ADR-0128 records a decision TAKEN against the archive, so
   * relabelling a figure is a real answer here and sometimes the only honest one.
   * What it may not do is keep the old number unlabelled beside refreshed ones,
   * which is how one record comes to assert two populations on its own.
   */
  it("says so wherever it keeps a figure as the archive's", () => {
    expect(ARCHIVE_ERA_FIGURES.length).toBeGreaterThan(1);

    for (const pattern of ARCHIVE_ERA_FIGURES) {
      const sentence = sentenceStating({ file: ORDERING_AXIS, pattern });

      expect(
        sentence,
        `docs/adr/${ORDERING_AXIS} keeps an archive-era figure without saying it is one, so a ` +
          `reader cannot tell it from a live count that has drifted: ${sentence}`,
      ).toMatch(/archive/i);
    }
  });
});
