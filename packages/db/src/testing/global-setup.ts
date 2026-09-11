import type { TestProject } from "vitest/node";

import "../load-env";
import "./provided";
import { buildTestDatabase } from "./build-database";

/** One database for the whole run, built from empty and migrated to head. */
export default async function setup(project: TestProject) {
  project.provide("databaseUrl", await buildTestDatabase());
}
