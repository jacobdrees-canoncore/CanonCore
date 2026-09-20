import { readdirSync, readFileSync } from "node:fs";
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

/**
 * A RECORD AND THE CODE THAT IMPLEMENTS IT, HELD TOGETHER BY A CITATION.
 *
 * The record above catches two records sharing a number. This catches the other
 * direction: a record whose own implementation never names it. Nothing is
 * broken when that happens, which is what makes it invisible -- the code works,
 * the record is true, and the only thing missing is the thread between them. A
 * reader who opens the file cannot find the reasoning, and a reader who opens
 * the record cannot find the code, so the next change to either is made without
 * the other.
 *
 * MEASURED RATHER THAN HYPOTHETICAL (CNCORE-248). `narrowedToTheKind` and its
 * two call sites landed in `queries.ts`, which cites its records heavily --
 * ADR-0077 among them, the record
 * [[0150-the-reader-chooses-the-order-and-the-kind-the-surface-keeps-the-question]]
 * exists to distinguish itself FROM -- and not the one that decided it.
 * `sort_name_v1()` and `derived:sort-name-v1` are read back through
 * `by-hand.ts`, which named its neighbours and not
 * [[0134-a-sort-name-is-derived-by-stripping-a-leading-article]].
 *
 * NEITHER SENTENCE COUNTS THOSE CITATIONS, and the first draft of this
 * docblock did -- "thirty-one records" and "eleven records", both made wrong by
 * the very commit that wrote them, because it added the thirty-second and the
 * twelfth. [[0153-a-figure-about-this-tree-is-derived-or-dated]] asks for a
 * figure to be derived or dated, and a count that is decoration is better
 * deleted than derived.
 *
 * BOTH SPELLINGS, AND THAT IS THE POINT RATHER THAN A DETAIL. This tree cites a
 * record two ways -- `ADR-0134` in a source comment, `[[0134-the-slug]]` in
 * prose -- and the sweep that found the two above matched only the first. It
 * reported ADR-0136 as cited nowhere when `ui-callers.test.ts` cites it in the
 * wiki-link form, so the method under-reported exactly the citations that are
 * hardest to find by eye. A checker that knew one spelling would licence the
 * same mistake.
 *
 * A ROLL CALL, NOT A SWEEP, which is [[0153-a-figure-about-this-tree-is-derived-or-dated]]'s
 * shape and its limit: a record missing from this table is not caught. The
 * alternative -- every `accepted` record must be named by some file -- asks the
 * wrong question, because a record can be whole with no code to cite it at all.
 * [[0072-no-visibility-system]] is the specimen: it decides that a thing does
 * NOT exist, so what makes it whole is an ABSENCE, and there is no file for an
 * absence to be cited from.
 */
type Implementation = {
  readonly adr: string;
  readonly file: string;
  readonly holds: string;
};

const IMPLEMENTED_BY: Implementation[] = [
  {
    adr: "0058",
    file: "apps/web/src/app/layout.tsx",
    holds: "the product's own name, where the generator left a lowercase placeholder",
  },
  {
    adr: "0132",
    file: ".claude/skills/closing-a-spec/SKILL.md",
    holds: "the gate a project passes before it is finished",
  },
  {
    adr: "0134",
    file: "packages/db/src/by-hand.ts",
    holds: "the Owner's sort name, standing beside the computed one it outranks",
  },
  {
    adr: "0150",
    file: "packages/db/src/queries.ts",
    holds: "`narrowedToTheKind`, and the two Listings that apply it",
  },
  {
    adr: "0168",
    file: "apps/web/live/live-import.test.ts",
    holds: "three claims that were printouts, each now asserting what its name says",
  },
];

/**
 * The slug a record is cited by in prose, or a throw naming the number.
 *
 * IT RESOLVES THROUGH THE TREE rather than holding the filename, so a record
 * RENAMED -- which changes the wiki-link form of every citation of it -- is
 * reported here instead of quietly making this checker look for a spelling
 * nothing uses any more.
 */
function slugOf(number: string): string {
  const [record, ...rest] = numbered().filter((found) => found.number === number);
  if (record === undefined || rest.length > 0) {
    throw new Error(
      `${rest.length + (record === undefined ? 0 : 1)} records are numbered ${number}, ` +
        "not 1, so no citation of it resolves",
    );
  }
  return record.file.replace(/\.md$/, "");
}

/** Whether a file names a record, in EITHER spelling this tree uses. */
function cites(file: string, number: string): boolean {
  const text = readFileSync(join(repoRoot, file), "utf8");
  return new RegExp(`ADR-${number}\\b`).test(text) || text.includes(`[[${slugOf(number)}]]`);
}

describe("a record and the code that implements it", () => {
  /**
   * BEFORE THE ROLL CALL, because a table whose files had moved would satisfy
   * "they all cite their record" by throwing on none of them -- and a read that
   * cannot find its subject is the failure `ui-callers.test.ts` raises at the
   * root of its own chain for the same reason.
   */
  it("names files this repository actually holds", () => {
    expect(IMPLEMENTED_BY.length).toBeGreaterThan(0);

    for (const { adr, file } of IMPLEMENTED_BY) {
      expect(() => cites(file, adr), `${file} or ADR-${adr} is gone`).not.toThrow();
    }
  });

  it("is named by the file that implements it", () => {
    const silent = IMPLEMENTED_BY.flatMap(({ adr, file, holds }) =>
      cites(file, adr) ? [] : [`${file} holds ${holds} and never names ADR-${adr}`],
    );
    expect(silent).toStrictEqual([]);
  });
});
