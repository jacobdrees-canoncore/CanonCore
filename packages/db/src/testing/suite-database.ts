import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SUITE_DATABASE_SUFFIXES, type TestDatabaseSuffix } from "./build-database";

/**
 * WHICH TEST DATABASE THE PACKAGE ROOTED HERE CLAIMS, read from its manifest.
 *
 * `global-setup.ts` is shared by three suites and had no way to tell which one
 * was running it, so it built the bare `<worktree>_test` for all of them --
 * dropping it `with (force)` on the way in. This is what it asks instead.
 *
 * THE MANIFEST IS THE IDENTITY BECAUSE VITEST DOES NOT CARRY ONE.
 * `TestProject.name` is "the name of the project or an empty string if not set"
 * and none of these configs sets one, measured on vitest 5.0.0 here on
 * 2026-09-18: `name=""`, `root=<repo>/packages/api`. The root is the package
 * directory, so the package's own `name` is one read away and is the identity
 * the workspace already uses everywhere else.
 *
 * IT REFUSES RATHER THAN DEFAULTS, which is the half that makes the claim hold
 * for a package nobody has written yet. Defaulting is what the old call did, and
 * what it defaulted onto was another suite's database.
 */
export function suiteDatabaseSuffixAt(root: string): TestDatabaseSuffix {
  const { name } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    name?: string;
  };
  const claimed = SUITE_DATABASE_SUFFIXES[name ?? ""];
  if (claimed === undefined) {
    throw new Error(
      `${name ?? root} takes @canoncore/db/testing/global-setup and claims no test database ` +
        `of its own. Declare one in SUITE_DATABASE_SUFFIXES rather than sharing another ` +
        `suite's, which this global setup DROPS on the way in.`,
    );
  }
  return claimed;
}
