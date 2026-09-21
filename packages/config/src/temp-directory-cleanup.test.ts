import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "./testing/repo-root";
import { temporaryDirectoriesIn } from "./testing/temp-directories";
import { isTrackedAs, trackedFiles } from "./testing/tracked-files";

/**
 * A SUITE CLEANS UP THE TEMPORARY DIRECTORIES IT MAKES.
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
 * The fixtures below are SOURCE IN A STRING rather than prose, so `withoutComments`
 * keeps them and the sweep reads them as the call sites they are spelled as.
 *
 * `isTrackedAs` GUARDS THE EXCLUSION, which is `adr-as-built.test.ts`'s shape and
 * its reason in its own words: "an exclusion that stops excluding reports nothing
 * by its nature". Renaming that file would otherwise hand its fixtures back to the
 * sweep as fifteen new leaks.
 */
const FIXTURES = "packages/config/src/testing/temp-directories.test.ts";

function sourcesUnderTheSweep(): string[] {
  return trackedFiles(SOURCE).filter((path) => path !== FIXTURES);
}

describe("the temporary directories this repository's suites make", () => {
  /**
   * BEFORE THE SWEEP, because a sweep that found no call site at all would
   * satisfy "none of them leaks" by having no subject -- the vacuous pass
   * CNCORE-160 spent a ticket removing from this package.
   */
  it("are found at all, and the fixtures are still excluded by name", () => {
    expect(isTrackedAs(FIXTURES)).toBe(true);

    const sites = sourcesUnderTheSweep().flatMap((path) =>
      temporaryDirectoriesIn(readFileSync(join(repoRoot, path), "utf8")),
    );
    expect(sites.length).toBeGreaterThan(10);
  });

  it("are every one of them removed by the file that makes them", () => {
    const leaking = sourcesUnderTheSweep().flatMap((path) =>
      temporaryDirectoriesIn(readFileSync(join(repoRoot, path), "utf8"))
        .filter((site) => !site.removed)
        .map(
          (site) =>
            `${path}:${site.line} ${site.call} ` +
            (site.bound === null
              ? "is not bound to a name, so nothing can remove it"
              : `binds ${site.bound}, which nothing removes`),
        ),
    );

    expect(leaking).toStrictEqual([]);
  });
});
