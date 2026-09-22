import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "./testing/repo-root";
import { type TemporaryDirectorySite, temporaryDirectoriesIn } from "./testing/temp-directories";
import { isTrackedAs, trackedFiles } from "./testing/tracked-files";

/**
 * A SUITE CLEANS UP THE TEMPORARY DIRECTORIES IT MAKES (ADR-0200).
 *
 * `mkdtemp` and `mkdtempSync` create a directory and hand back its path. Nothing
 * removes it: not the process exiting, not Vitest, not the operating system
 * inside any useful window. So a suite that makes one per test and never removes
 * it leaves one behind per test, per run, forever.
 *
 * MEASURED RATHER THAN HYPOTHETICAL (CNCORE-336). 7,547 of them, 1.36 GB, had
 * accumulated in `/private/tmp` by 11:10 on 2026-09-21, the oldest from 04:24 the
 * same morning -- one day of dispatch on one machine. They were removed by hand,
 * because nothing in this repository would have.
 *
 * DATED AND WITH ITS QUERY, which is ADR-0153's rule for a figure the tree
 * cannot re-derive: this one counts a directory outside the repository, on one
 * machine, on one morning. Taking it again is
 * `find /private/tmp -maxdepth 1 -type d \( -name 'merge-gate-*' -o -name
 * 'canoncore-*' -o -name 'dispatch-monitor-*' \) | wc -l`, and the before and
 * after in PR #257 were taken by running the suites with `TMPDIR` pointed at an
 * empty directory and counting what was left in it.
 *
 * `/private/tmp` RATHER THAN THE USER'S OWN `TMPDIR`, and the reason is turbo:
 * with no `envMode` in `turbo.json` it runs tasks in STRICT mode, which does not
 * pass `TMPDIR` to a task. `os.tmpdir()` falls back to `/tmp` when it is unset,
 * so every directory a suite leaks under `pnpm test` lands in the one place a
 * developer never looks.
 *
 * IT IS SILENT, which is why it reached 7,547 -- a leaked directory fails
 * nothing, so no run has ever reported it. That is what makes it a check rather
 * than a note: the failure has no other way to become visible.
 *
 * IT ASKS THE TREE rather than a list somebody maintains, which is
 * `adr-numbering.test.ts`'s reason in its own words: a site added without
 * touching this file is still covered. A list would have to be edited by the
 * same change that adds the site, by the same author who did not think about
 * removal.
 */
const SOURCE = [":(glob)**/*.ts", ":(glob)**/*.tsx"];

/**
 * The fixtures there are SOURCE IN A STRING rather than prose, so `withoutComments`
 * keeps them and the sweep reads them as the call sites they are spelled as. No
 * count of them is given here: it would be a figure about a file this suite does
 * not otherwise measure, made wrong by the next fixture added to it.
 *
 * `isTrackedAs` GUARDS THE EXCLUSION, which is `adr-as-built.test.ts`'s shape and
 * its reason in its own words: "an exclusion that stops excluding reports nothing
 * by its nature". Renaming that file would otherwise hand its fixtures back to
 * the sweep as leaks, and this suite would then be red about its own prose.
 */
const FIXTURES = "packages/config/src/testing/temp-directories.test.ts";

/**
 * EVERY REASON IS A DIFFERENT EDIT, so the message names which one. A site with
 * no binding needs one introduced; a site sharing a name needs a rename; a site
 * with neither problem needs the removal itself.
 */
function whyItLeaks(site: TemporaryDirectorySite): string {
  if (site.bound === null) return "is not bound to a name, so nothing can remove it";
  if (site.sitesSharingItsName > 1) {
    return (
      `binds ${site.bound}, a name ${site.sitesSharingItsName} sites here share against ` +
      `${site.removals} removals: pair them one to one, or give this one its own name`
    );
  }
  return `binds ${site.bound}, which nothing removes`;
}

function sourcesUnderTheSweep(): string[] {
  return trackedFiles(SOURCE).filter((path) => path !== FIXTURES);
}

describe("the temporary directories this repository's suites make", () => {
  /**
   * BEFORE THE SWEEP, because a sweep that found no call site at all would
   * satisfy "none of them leaks" by having no subject -- the vacuous pass
   * CNCORE-160 spent a ticket removing from this package.
   */
  it("are found at all, and a known one resolves", () => {
    expect(isTrackedAs(FIXTURES)).toBe(true);
    expect(sourcesUnderTheSweep().length).toBeGreaterThan(0);

    // A KNOWN FILE RATHER THAN A COUNT, which is `adr-records.test.ts`'s shape:
    // a floor is a number somebody wrote down, and CNCORE-160 spent a ticket
    // taking those out of this package. What has to be true is that the reader
    // answers about a file this suite can name, so a reader returning nothing --
    // or plausible-looking nonsense -- cannot satisfy the sweep below by having
    // no subject.
    const known = temporaryDirectoriesIn(
      readFileSync(join(repoRoot, "packages/config/src/run-suite.test.ts"), "utf8"),
    );
    expect(known.length).toBeGreaterThan(0);
    expect(known.map((site) => site.bound)).not.toContain(null);
  });

  it("are every one of them removed by the file that makes them", () => {
    const leaking = sourcesUnderTheSweep().flatMap((path) =>
      temporaryDirectoriesIn(readFileSync(join(repoRoot, path), "utf8"))
        .filter((site) => !site.removed)
        .map((site) => `${path}:${site.line} ${site.call} ${whyItLeaks(site)}`),
    );

    expect(leaking).toStrictEqual([]);
  });
});
