import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SUITE_DATABASE_SUFFIXES, type SuiteDatabaseSuffix } from "./build-database";

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
 *
 * `Object.hasOwn` RATHER THAN A LOOKUP AGAINST `undefined`, because the value
 * being read is a name off a `package.json` on disk and the table is an object
 * literal. `SUITE_DATABASE_SUFFIXES["toString"]` is an inherited function rather
 * than `undefined`, so a package named `toString`, `constructor` or `__proto__`
 * would walk PAST the refusal above and carry a non-suffix into a name this
 * harness then DROPS. No package here is called any of those, which is exactly
 * why the check has to be the shape that does not depend on it.
 */
export function suiteDatabaseSuffixAt(root: string): SuiteDatabaseSuffix {
  const name = packageNameAt(root);
  if (name === undefined || !Object.hasOwn(SUITE_DATABASE_SUFFIXES, name)) {
    throw new Error(
      `${name ?? root} takes @canoncore/db/testing/global-setup and claims no test database ` +
        `of its own. Declare one in SUITE_DATABASE_SUFFIXES rather than sharing another ` +
        `suite's, which this global setup DROPS on the way in.`,
    );
  }
  return SUITE_DATABASE_SUFFIXES[name as keyof typeof SUITE_DATABASE_SUFFIXES];
}

/**
 * What the package rooted here is called, which is the vocabulary both this
 * lookup and `suite-database-wiring.test.ts` say a suite in. Exported so the
 * sweep names the offender the way `SUITE_DATABASE_SUFFIXES` does -- a directory
 * on one side of that comparison and a package name on the other is a mismatch
 * the reader has to translate before they can act on it.
 */
export function packageNameAt(root: string): string | undefined {
  return (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { name?: string }).name;
}
