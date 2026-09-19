import type { TestProject } from "vitest/node";

import "../load-env";
import "./provided";
import { buildSuiteDatabase } from "./build-database";
import { suiteDatabaseSuffixAt } from "./suite-database";

/**
 * One database for the whole run, built from empty and migrated to head -- and
 * ONE PER SUITE rather than one for all of them (CNCORE-199).
 *
 * THREE SUITES SHARE THIS FILE and it used to build the same database for each,
 * because the suffix had a DEFAULT and none of them passed one. ADR-0104 records
 * what that cost and why turbo's topology was not protecting anybody.
 *
 * `project.config.root` IS THE PACKAGE DIRECTORY, which is what makes the claim
 * derivable rather than configured. `TestProject.name` would be the obvious
 * reading and is empty: vitest 5.0.0 documents it as "the name of the project or
 * an empty string if not set", and none of these configs sets one.
 */
export default async function setup(project: TestProject) {
  project.provide(
    "databaseUrl",
    await buildSuiteDatabase(suiteDatabaseSuffixAt(project.config.root)),
  );
}
