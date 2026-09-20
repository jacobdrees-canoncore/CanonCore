import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { markdownIn } from "./testing/markdown-corpus";
import { records } from "./testing/adr-records";
import { repoRoot } from "./testing/repo-root";

/**
 * A CITATION TO A RECORD THAT NEVER LANDED, DISCLOSED CENTRALLY RATHER THAN
 * REWRITTEN IN THE BODY (ADR-0167, CNCORE-259).
 *
 * `adr-numbering.test.ts` holds the records' own numbering -- two records
 * cannot share a number, and every record is numbered. This holds the other
 * direction: a number CITED as though it named a record, when the tree holds
 * none. Nothing is broken when that happens, which is what makes it invisible.
 * The sentence around it is usually true; only the pointer is dead, so it reads
 * as though it names something and costs every reader who tries to open it.
 *
 * MEASURED RATHER THAN HYPOTHETICAL. Seven numbers -- 0079, 0080, 0086, 0093,
 * 0095, 0098 and 0099 -- were cited 40 times across five files in
 * `docs/research/`, counting the three forms below, and have never existed in
 * `docs/adr/`. A sixth file names 0080 in the list form this does not match,
 * which is why the figure is "citations this check sees" and not "mentions".
 * They are not deleted
 * records. They were records on the 2026-09-10 branch that
 * `audit-new-adrs-internal.md` was auditing, and that audit is what caused each
 * to be folded elsewhere rather than merged: 0086's ten-second rule into record
 * 0019, 0080's `bestRating` into record 0012, 0093's instruction into
 * `CLAUDE.md`'s Principles. So the research is accurate about what was known
 * when it was written, and the numbers it cites are the proposals it was
 * evaluating.
 *
 * THE NUMBERS ABOVE ARE BARE ON PURPOSE, and a later reader should not tidy them
 * into the prefixed spelling. In source, that spelling is how a file says it
 * DEPENDS on a record -- it is the population `adr-as-built.test.ts` reads,
 * which then asks every `proposed` record so cited to declare which half was
 * built. This file depends on ADR-0167 and on nothing else; it merely NAMES
 * those records as destinations. Written with the prefix, two of them were
 * pulled into that check and it failed on records this file does not lean on --
 * which happened twice while writing this docblock, the second time on the
 * sentence warning against it.
 *
 * THE BODIES ARE LEFT AS WRITTEN, which is `docs/research/README.md`'s standing
 * decision and not a new one: "editing research to match a later deletion would
 * falsify the record of what was known when". `doc-line-citations.test.ts`
 * leans on that same sentence to leave 330 line citations legal. So the fix for
 * a dead number is the amnesty naming it and where its content went, and this
 * checks the amnesty covers every number the prose actually cites.
 *
 * IT ASKS THE TREE AND THE DOCUMENT rather than a list maintained here, which
 * is `adr-numbering.test.ts`'s own reason in its own words -- "a record added
 * without touching this file is still covered". The records come from
 * `docs/adr/`, the disclosures from the README's own amnesty section. A seven-
 * number array here would go stale on the eighth, and a check that goes stale
 * silently is the defect class it exists to remove.
 *
 * THREE SPELLINGS, AND THE EXCLUSION IS LOAD-BEARING RATHER THAN LAZINESS.
 * `ADR-0086` is the source form, `[[0086-the-slug]]` the prose form
 * (`adr-numbering.test.ts` states both), and `docs/adr/0080-...md` the path
 * form this corpus cites records by line through. What is NOT matched is the
 * space-separated list -- `ADR 0005, 0012, 0080` and the range `ADR-0073..0099`
 * -- where every number after the first is bare and indistinguishable from a
 * date or a count. A sweep that tried it read the `2026` of
 * `(ADR-0129, 2026-09-13)` as a record, in four places, which is the false
 * positive that decided this. Every one of the seven is still caught, because
 * each is cited at least once in one of the three forms.
 *
 * PROSE ONLY -- everything under `docs/` plus the markdown at the root, which
 * is `doc-line-citations.test.ts`'s established scope. It steps around a
 * measured false positive: CNCORE-247 counted record 0001 as cited when its only
 * match was the synthetic fixture `0001-a.md` inside
 * `doc-line-citations.test.ts`. Source comments are the population
 * `adr-as-built.test.ts` reads, and a dead one there is not caught here.
 */
/** The heading the amnesty lives under, in `docs/research/README.md`. */
const AMNESTY_HEADING = "## Citations to records that never landed";

const AMNESTY = join(repoRoot, "docs", "research", "README.md");

/**
 * The three spellings this tree cites a record by. The path form is anchored on
 * its trailing `-` so `docs/adr/0080-...md` matches and a bare directory does
 * not.
 */
const CITATION = /ADR-(\d{4})\b|docs\/adr\/(\d{4})-|\[\[(\d{4})-/g;

/**
 * Every record's number, as the four digits its filename opens with.
 *
 * THE PARSE IS `adr-records.ts`'s SINCE CNCORE-294, which is where the TODO
 * that used to sit here pointed. It named three other copies; there were four,
 * and `ADR-0169` carries the fold.
 */
function heldNumbers(): Set<string> {
  return new Set(records().map((record) => record.number));
}

/**
 * Every markdown document the rule governs: all of `docs/`, plus the root's own.
 *
 * THROUGH `markdownIn`, WHICH IS THE ONLY READER ALLOWED TO ANSWER THIS
 * (ADR-0103). The first draft of this file enumerated the corpus itself, with
 * `readdirSync(docs, { recursive: true })` filtered on `isFile()`. Both halves
 * are what that record refuses: node DESCENDS a symlinked directory and takes
 * no option not to, returning paths git does not hold, and `isFile()` is lstat
 * so it drops a symlinked DOCUMENT in silence. A cycle returned 99 entries
 * without throwing when ADR-0103 measured it. Nothing here reported any of it,
 * because a tree with no links answers the same either way -- which is exactly
 * why the rule is a shared reader rather than a thing each sweep remembers.
 */
function prose(): string[] {
  return [
    ...markdownIn(join(repoRoot, "docs"), { recursive: true }).map((path) =>
      join(repoRoot, "docs", path),
    ),
    ...markdownIn(repoRoot).map((path) => join(repoRoot, path)),
  ].sort();
}

type Citation = { readonly file: string; readonly line: number; readonly number: string };

function citations(): Citation[] {
  const found: Citation[] = [];
  for (const file of prose()) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((text, index) => {
        for (const match of text.matchAll(CITATION)) {
          const number = match[1] ?? match[2] ?? match[3];
          if (number !== undefined) {
            found.push({ file: file.slice(repoRoot.length + 1), line: index + 1, number });
          }
        }
      });
  }
  return found;
}

/**
 * The numbers the amnesty discloses, read from the section itself rather than
 * held here. It ends at the next heading of the same level, so a section added
 * after it does not silently widen the amnesty.
 *
 * THE TABLE IS THE REGISTER, NOT THE PROSE AROUND IT, and that is a measured
 * distinction rather than a tidy one. The section's own paragraphs quote the
 * audit's title, "ADR-0073..0099", and a reader that took every number in the
 * section enrolled ADR-0073 -- a live record -- into the amnesty on the first
 * run of the check below. A disclosure is a row that says where the content
 * went; a number in a sentence is a sentence.
 */
function disclosed(): Set<string> {
  const readme = readFileSync(AMNESTY, "utf8");
  const opens = readme.indexOf(AMNESTY_HEADING);
  if (opens === -1) {
    return new Set();
  }
  const body = readme.slice(opens + AMNESTY_HEADING.length);
  const ends = body.indexOf("\n## ");
  const section = ends === -1 ? body : body.slice(0, ends);

  return new Set(
    section
      .split("\n")
      .filter((line) => line.trimStart().startsWith("|"))
      .flatMap((row) => [...row.matchAll(/ADR-(\d{4})\b/g)].flatMap((found) => found[1] ?? [])),
  );
}

describe("an ADR number a document cites", () => {
  /**
   * BEFORE THE RULE, because the rule passes by having no subject. A regex that
   * stopped matching, a `docs/` this could not list, or a heading renamed out
   * from under the amnesty reader all end in an empty list compared against an
   * empty list -- which is GREEN, and says the opposite of what it checked.
   * This is the failure `sweep-shard-citations.test.ts` and
   * `doc-line-citations.test.ts` each raise at the root of their own chain.
   */
  it("is read at all, so a green run cannot mean the reader went silent", () => {
    expect(heldNumbers().size).toBeGreaterThan(0);
    expect(prose().length).toBeGreaterThan(0);
    expect(citations().length).toBeGreaterThan(0);
    expect(
      disclosed().size,
      `${AMNESTY_HEADING} is gone from docs/research/README.md`,
    ).toBeGreaterThan(0);
  });

  it("names a record this tree holds, or one the amnesty accounts for", () => {
    const held = heldNumbers();
    const accounted = disclosed();

    const dangling = citations()
      .filter(({ number }) => !held.has(number) && !accounted.has(number))
      .map(
        ({ file, line, number }) => `${file}:${line} cites ADR-${number}, which is not a record`,
      );

    expect(dangling).toStrictEqual([]);
  });

  /**
   * THE AMNESTY IS NOT AN ALLOWLIST, and this is what keeps the difference. A
   * number accounted for here is one the tree has never held; if a later record
   * TAKES one of these numbers, the entry stops being a disclosure and starts
   * masking a live record -- every citation of it would resolve through the
   * amnesty and never be read as naming the record that now exists. The entry
   * is to be deleted when that happens, and this is what says so.
   */
  it("is not accounted for by the amnesty once a record takes the number", () => {
    const held = heldNumbers();

    const masked = [...disclosed()]
      .filter((number) => held.has(number))
      .map((number) => `the amnesty accounts for ADR-${number}, which is now a record`);

    expect(masked).toStrictEqual([]);
  });
});
