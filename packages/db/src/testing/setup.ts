import { inject } from "vitest";

import "../load-env";
import "./provided";

/**
 * Points the validated environment at the database `global-setup` built, before
 * any test file is imported and so before `@canoncore/env` is first evaluated.
 *
 * This is what lets a suite build its context with the REAL `createContext`
 * rather than a hand-copy of it (ADR-0103): the application reads
 * `env.DATABASE_URL` exactly as it does in production, and finds the test
 * database there.
 */
process.env.DATABASE_URL = inject("databaseUrl");
