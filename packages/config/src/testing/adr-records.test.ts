import { describe, expect, it } from "vitest";
import { records, unnumbered } from "./adr-records";
import { trackedFiles } from "./tracked-files";

/**
 * The enumeration of `docs/adr/` five suites in this package share.
 *
 * THE CORPUS IS CHECKED AGAINST GIT, not against a second `readdirSync`. This
 * reader walks the directory, so a test that walked it again would restate the
 * thing under test and pass wherever it was wrong. The index is a different
 * source of truth for the same question.
 */
describe("the decision records as one reader sees them", () => {
  it("reports the corpus", () => {
    expect(records().length).toBeGreaterThan(100);
  });

  /**
   * A KNOWN RECORD RESOLVES, so the rows above cannot be satisfied by a reader
   * returning plausible-looking nonsense. Two literals rather than one, and both
   * are records this package's own suites cite by number.
   */
  it("resolves a record by the number it is cited by", () => {
    const byNumber = new Map(records().map((record) => [record.number, record.file]));

    expect(byNumber.get("0136")).toBe(
      "0136-a-control-is-a-primitive-and-a-surfaces-words-sit-beside-its-pages.md",
    );
    expect(byNumber.get("0103")).toBe("0103-tests-bite-at-package-exports-and-the-router.md");
  });

  /**
   * THE NUMBER IS THE FILENAME'S OWN, checked per record rather than trusted.
   * This is the parse itself, held over the whole corpus: a number that did not
   * come off the front of the name is a citation pointing at the wrong record.
   */
  it("takes each number off the front of the filename it belongs to", () => {
    const wrong = records().filter(
      (record) =>
        !record.file.startsWith(`${record.number}-`) ||
        record.number.length !== 4 ||
        !/^\d{4}$/.test(record.number),
    );

    expect(wrong).toStrictEqual([]);
  });

  /** The path is repo-relative, the way `trackedFiles` reports one. */
  it("gives a repo-relative path for each record", () => {
    const wrong = records().filter((record) => record.path !== `docs/adr/${record.file}`);

    expect(wrong).toStrictEqual([]);
  });

  /**
   * ONE ENTRY PER FILE, WHICH IS WHY THIS IS A LIST AND NOT A MAP KEYED BY
   * NUMBER, and the distinction is load-bearing rather than stylistic.
   *
   * `adr-numbering.test.ts` exists to catch two records sharing one number --
   * measured on 2026-09-11, when CNCORE-66 and CNCORE-68 both took 0120 and git
   * merged them clean because the slugs differ. A reader keyed by number would
   * keep the last of the two and hand that suite a corpus in which the defect it
   * is looking for cannot be represented.
   */
  it("reports every file separately, so two records sharing a number are both visible", () => {
    const all = records();
    const files = new Set(all.map((record) => record.file));

    expect(files.size).toBe(all.length);
  });

  /** Only records: `docs/adr/` holds nothing else, and nothing else is read. */
  it("reads only markdown", () => {
    expect(records().filter((record) => !record.file.endsWith(".md"))).toStrictEqual([]);
  });

  /**
   * NOTHING IS SILENTLY DROPPED, which is the half that keeps
   * `adr-numbering.test.ts`'s guard real. That suite asks whether every record
   * is named with four digits; it can only ask it if the reader REPORTS the
   * ones it could not number instead of filtering them away.
   *
   * Checked in the direction that is robust: every record git holds is
   * accounted for, as numbered or as unnumbered. An untracked scratch file in
   * the directory adds to the reader's side and does not redden this.
   */
  it("accounts for every record git holds, numbered or not", () => {
    const seen = new Set([...records().map((record) => record.file), ...unnumbered()]);
    const missed = trackedFiles(["docs/adr/*.md"])
      .map((path) => path.slice(path.lastIndexOf("/") + 1))
      .filter((file) => !seen.has(file));

    expect(missed).toStrictEqual([]);
  });
});
