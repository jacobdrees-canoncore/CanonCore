import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { records as numberedRecords } from "./testing/adr-records";
import { flatten } from "./testing/flatten";
import { repoRoot } from "./testing/repo-root";
import { isTrackedAs, trackedFiles } from "./testing/tracked-files";

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
 * named `0001-a.md` inside `doc-line-citations.test.ts`, which is in
 * `testing/markdown-corpus.test.ts` since CNCORE-313.
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
type AdrRecord = { file: string; status: string; raw: string; text: string; decision: string };

function theRecords(): Map<string, AdrRecord> {
  const records = new Map<string, AdrRecord>();
  for (const { number, file, path } of numberedRecords()) {
    const raw = readFileSync(join(repoRoot, path), "utf8");
    records.set(number, {
      file,
      // THE FRONTMATTER BLOCK, not any line that opens `status:`. Anchored to the
      // leading `---` fence because these records discuss their own statuses in
      // prose, and a body line beginning with the word would otherwise be read as
      // the record's status.
      status: /^---\n(?:.*\n)*?status:\s*(\S+)/.exec(raw)?.[1] ?? "unstated",
      raw,
      text: flatten(raw),
      decision: flatten(raw.split(/^## /m)[0] ?? ""),
    });
  }
  return records;
}

/**
 * A record DECLARES its halves if it carries a bolded run naming BUILT, or a
 * section heading that does.
 *
 * THE WORD ALONE IS NOT THE NOTE, which is the measurement CNCORE-273 came out
 * of. CNCORE-247's census asked `grep -ciE built` and counted 24 records as
 * noted; asking for a DECLARATION instead drops four of them, because "a product
 * built on multi-placement" and "ADR-0066 as built" are prose about other things.
 * A check satisfied by the word would pass a record that says nothing about its
 * own halves, which is the whole defect.
 *
 * TWO FORMS RATHER THAN ONE, because the corpus genuinely uses both and neither
 * is wrong. `**NOT BUILT: the artwork half.**` is the commonest; ADR-0048 writes
 * `**WHAT WAS BUILT IS THE DUMP ...**`, and headings run from `## As built, under
 * CNCORE-4` to `## Half built, under CNCORE-6`. Narrowing to one spelling would
 * be this check legislating a house style rather than reading the one that exists.
 *
 * `stays PROPOSED` IS A HEADING THIS READS TOO, and ADR-0153 is why it had to be.
 * That record landed from CNCORE-252 while CNCORE-247 was in flight, and this
 * check went red on it the moment it arrived -- which is the derived population
 * working exactly as `adr-numbering.test.ts` argues a population should. Reading
 * it, `## Why this stays PROPOSED` declares BOTH halves as squarely as any `## As
 * built` does: "**Half the mechanism landed**", the derived half runs, the dated
 * half is a convention. So the heading is read rather than the record reformatted.
 *
 * THAT IS NOT THE SAME CONCESSION THE DISPATCHER REFUSED for ADR-0046. What is
 * accepted here is a SECTION whose subject is the record's own unfinished half; a
 * bare sentence in the middle of a section is not that, however true it is, and
 * accepting one would put this check back to matching a word in prose.
 */
const DECLARATION = /\*\*[^*]*\bBUILT\b/;
const AS_BUILT_HEADING = /^#{2,3} .*(\bbuilt\b|stays PROPOSED)/i;

/**
 * AND THE HEADING'S OWN SECTION HAS TO SAY SOMETHING, which closes the hole the
 * widening above would otherwise open.
 *
 * `## Why this stays PROPOSED` over an empty section would pass a record that
 * declares nothing, which is the word-level proxy this file refuses one function
 * up -- so the section under such a heading must carry a bolded run, the thing
 * every real note in this corpus uses to mark the halves. Measured before it was
 * adopted: ADR-0153 is the only record in the population that passes by heading
 * alone today, and its section carries `**Half the mechanism landed.**`, so this
 * reddens nothing that was green.
 */
function declaresItsHalves(record: AdrRecord): boolean {
  if (DECLARATION.test(record.text)) return true;

  return record.raw
    .split(/^(?=#{2,3} )/m)
    .filter((section) => AS_BUILT_HEADING.test(section))
    .some((section) => section.includes("**"));
}

/**
 * The records in the population that declare nothing ON PURPOSE, each with the
 * reason, because an unexplained exception is the thing this file exists to
 * refuse one level up.
 *
 * BOTH ARE THE HONEST-PENDING CASE and CNCORE-247 argues them: ADR-0028's
 * one citation explains why `external_ids` exists so that matching needs no
 * confidence score, and no scorer exists, so there is no half to declare;
 * ADR-0065's citation is a cross-reference justifying an omission from a unique
 * key. They are settled and are not reopened here.
 *
 * THREE MORE LEFT THIS MAP UNDER CNCORE-248, and they left because the check
 * below MADE them rather than because anybody remembered. ADR-0058, ADR-0072 and
 * ADR-0132 were parked here by CNCORE-247, which could see the defect and did not
 * own the records. All three are `accepted` now, an accepted record is never asked
 * for an as-built note, and the entries could not outlive the work they waited on.
 *
 * NOTHING HERE IS A TODO, and that is deliberate. CNCORE-273 opened with four
 * more records in this map behind a `TODO`, and they were folded into CNCORE-247's
 * pass instead: a map of work somebody could have done is a backlog wearing an
 * exception's clothes, and the next reader cannot tell it from a record that
 * genuinely has no half to declare.
 *
 * ADR-0046 IS WHY THE RULE DID NOT WIDEN. It said "Nothing here is built." in as
 * many words, which is a complete declaration that this check could not read, and
 * the cheap fix was to accept a bare sentence. The DISPATCHER ruled against it on
 * 2026-09-20: a bare sentence reintroduces the word-level proxy this work exists
 * to replace, and one record taking the bold is cheaper than a weaker check.
 */
const SILENT_ON_PURPOSE: Readonly<Record<string, string>> = {
  "0065": "its citation is a cross-reference justifying an omission, not a dependency (CNCORE-247)",
};

/**
 * ADR-0097 IS NAMED RATHER THAN DERIVED, and the naming is the point.
 *
 * Its only citer is `provider-wiki`'s `src/cmpp.ts`, which holds this record's
 * `source` word reservation. No PR on this side can see that tree, so a purely
 * derived population would leave ADR-0097 out and READ AS COVERAGE IT DOES NOT
 * HAVE -- the same boundary `corpus-figures.test.ts` states it cannot close, in
 * its own words: "rename either there and this stays GREEN while ADR-0128 points
 * at nothing". Naming the exception with its reason is the check stating its own
 * edge. Decided by the DISPATCHER on 2026-09-20, not by the Owner.
 */
const CITED_ACROSS_THE_BOUNDARY = ["0097"];

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
 *
 * THE WALK IS `trackedFiles`, which this file was the fourth copy of and which
 * CNCORE-277 folded at five. [[0171-the-fold-is-of-the-read-not-of-the-question-it-answers]]
 * carries that decision and the measurement that settled it.
 *
 * WHAT STAYED HERE IS WHAT THIS READ WANTS AND THE OTHERS DO NOT: the pathspec,
 * the comments and test files KEPT rather than stripped for the reasons argued
 * above, and the non-emptiness guard worded for this population. Those were
 * always the disagreement; the three lines under them were not.
 *
 * AND IT EXCLUDES ITSELF, which is not tidiness but a defect this file HAD. The
 * comments above name ADR-0001 and ADR-0055 to explain what they are not, and
 * that alone put both records into the population and demanded an as-built note
 * of each. A check that recruits a record by discussing it would grow its own
 * subject every time somebody explained it.
 */
const THIS_FILE = "packages/config/src/adr-as-built.test.ts";

function citedBySource(): Set<string> {
  const tracked = trackedFiles([
    ".",
    ":(exclude)docs/**",
    ":(exclude)*.md",
    `:(exclude)${THIS_FILE}`,
  ]);

  const cited = new Set<string>();
  for (const path of tracked) {
    for (const [, number] of readFileSync(join(repoRoot, path), "utf8").matchAll(/ADR-(\d{4})/g)) {
      if (number !== undefined) cited.add(number);
    }
  }

  if (cited.size === 0) {
    throw new Error(
      "no tracked source file cites a record, so the as-built rule has no subject. Either the " +
        "pathspec stopped matching or the citation form moved away from `ADR-0081`.",
    );
  }

  // THE SELF-EXCLUSION IS CHECKED RATHER THAN TRUSTED. It is a literal path, so
  // renaming this file would leave the exclusion matching nothing and quietly
  // hand its own prose back to the population -- an exclusion that stops
  // excluding reports nothing by its nature.
  if (!isTrackedAs(THIS_FILE)) {
    throw new Error(
      `${THIS_FILE} is not tracked under that path, so this suite no longer excludes itself and ` +
        "every record its comments name is now in the population it enforces.",
    );
  }

  return cited;
}

describe("a proposed record that source leans on", () => {
  /**
   * THE RULE ITSELF, over every `proposed` record this repository's code cites.
   *
   * `accepted` records are not asked: `CLAUDE.md` reads that status as "its
   * MECHANISM is whole", so there is no missing half to declare. `proposed` means
   * DECIDED BUT NOT YET IMPLEMENTED, and a proposed record that code already
   * leans on is exactly the case where a reader cannot tell which sentences
   * describe behaviour and which describe intent.
   */
  it("declares which half was built, or is named here as silent with its reason", () => {
    const records = theRecords();
    const population = [...citedBySource(), ...CITED_ACROSS_THE_BOUNDARY]
      .filter((number) => records.get(number)?.status === "proposed")
      .sort();

    // THE POPULATION IS REPORTED BEFORE IT IS JUDGED, so a reader of a failure
    // can tell "none are silent" from "none were asked". The floor is the size of
    // the exception map rather than a number somebody picked: a population that
    // had shrunk to its own exceptions would satisfy the assertion below by
    // excusing everything it asked.
    expect(
      population.length,
      "the cited proposed records are no more numerous than the exceptions granted to them, so " +
        "this check is excusing everything it asks",
    ).toBeGreaterThan(Object.keys(SILENT_ON_PURPOSE).length);

    const silent = population.filter((number) => {
      const record = records.get(number);
      return record !== undefined && !declaresItsHalves(record);
    });

    expect(
      silent.filter((number) => SILENT_ON_PURPOSE[number] === undefined),
      `${silent.length} cited proposed records declare neither half, and these are not named as ` +
        "deliberate. Each needs a note in the house style the corpus already uses -- a `## As " +
        "built, under CNCORE-n` section with a bolded `**BUILT: ...**` and `**NOT BUILT: ...**` " +
        "-- or an entry in SILENT_ON_PURPOSE saying why it has no half to declare. Half a " +
        "mechanism looks finished from outside (CLAUDE.md).",
    ).toEqual([]);
  });

  /**
   * AN EXCEPTION THAT NO LONGER APPLIES IS THE DEFECT ONE LEVEL UP.
   *
   * Every name in `SILENT_ON_PURPOSE` has to still BE in the population, still be
   * `proposed`, and still declare nothing. Without this, a record that gained a
   * note keeps its excuse, a record that went `accepted` keeps an entry nothing
   * reads, and the map drifts into a list of names somebody once wrote down --
   * which is precisely what a derived population was chosen over.
   *
   * IT IS THE HALF THAT MADE CNCORE-248 CHEAP, AND IT FIRED. When that ticket
   * flipped ADR-0058, ADR-0072 and ADR-0132 to `accepted`, this went red naming
   * each one -- "an accepted record is not asked for an as-built note at all, so
   * the entry should go" -- until the three lines were deleted. The map could not
   * outlive the work it was waiting on, which is the property a TODO does not have.
   */
  it("keeps no exception that has stopped applying", () => {
    const records = theRecords();
    const population = new Set(citedBySource());

    for (const [number, reason] of Object.entries(SILENT_ON_PURPOSE)) {
      const record = records.get(number);
      expect(record, `SILENT_ON_PURPOSE names ADR-${number}, which is not a record`).toBeDefined();
      if (record === undefined) continue;

      // A REASON IS A TICKET OR A SENTENCE, and a length floor alone is not the
      // test: `CNCORE-248` is a complete reason in ten characters -- it says who
      // owns the record and when the entry goes -- and an early version of this
      // line reddened it for being short.
      expect(
        /CNCORE-\d+/.test(reason) || reason.length >= 20,
        `SILENT_ON_PURPOSE gives ADR-${number} the reason "${reason}", which neither names the ` +
          "ticket that owns it nor says why it has no half to declare.",
      ).toBe(true);
      expect(
        population.has(number),
        `SILENT_ON_PURPOSE excuses ADR-${number}, which no source file cites any more. The ` +
          "exception is excusing nothing and should go.",
      ).toBe(true);
      expect(
        record.status,
        `SILENT_ON_PURPOSE excuses ADR-${number}, which is now \`${record.status}\`. An accepted ` +
          "record is not asked for an as-built note at all, so the entry should go.",
      ).toBe("proposed");
      expect(
        declaresItsHalves(record),
        `ADR-${number} now declares its halves, so its SILENT_ON_PURPOSE entry is stale and has ` +
          "to be deleted -- an excuse outliving its reason is what this map must not become.",
      ).toBe(false);
    }
  });

  /**
   * AND THE CROSS-REPO ENTRY STAYS HONEST. ADR-0097 is named because no source in
   * THIS tree cites it; the day one does, the derived population covers it and the
   * hand-kept entry is a second mechanism for one job.
   */
  it("names across the boundary only what this tree cannot see", () => {
    const records = theRecords();
    const population = citedBySource();

    for (const number of CITED_ACROSS_THE_BOUNDARY) {
      expect(
        records.get(number),
        `CITED_ACROSS_THE_BOUNDARY names ADR-${number}, which is not a record`,
      ).toBeDefined();
      expect(
        population.has(number),
        `ADR-${number} is named as cited only from another repository, but source here cites it ` +
          "now. The derived population already covers it, so the hand-kept name should go.",
      ).toBe(false);
    }
  });

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
