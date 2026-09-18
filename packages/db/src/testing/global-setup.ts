import type { TestProject } from "vitest/node";

import "../load-env";
import "./provided";
import { buildTestDatabase } from "./build-database";
import { suiteDatabaseSuffixAt } from "./suite-database";

/**
 * One database for the whole run, built from empty and migrated to head -- and
 * ONE PER SUITE rather than one for all of them (CNCORE-199).
 *
 * THREE SUITES SHARE THIS FILE and it used to build the same database for each:
 * `buildTestDatabase()` with no suffix is `<worktree>_test`, which that function
 * DROPS `with (force)` and recreates. `packages/db`, `packages/api` and
 * `packages/tasks` all list it, so each run took the previous one's database out
 * from under it -- harmless only because `turbo.json`'s `dependsOn: ["^test"]`
 * happens to serialise those three, which is topology rather than a lock.
 *
 * `project.config.root` IS THE PACKAGE DIRECTORY, which is what makes the claim
 * derivable rather than configured. `TestProject.name` would be the obvious
 * reading and is empty: vitest 5.0.0 documents it as "the name of the project or
 * an empty string if not set", and none of these configs sets one.
 */
export default async function setup(project: TestProject) {
  project.provide(
    "databaseUrl",
    await buildTestDatabase(suiteDatabaseSuffixAt(project.config.root)),
  );
}
