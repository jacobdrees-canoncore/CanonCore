import { defineConfig } from "vitest/config";

/**
 * ADR-0103 rules out EMPTY Vitest configs, not files carrying a setting
 * something actually needs. This suite needs a PostgreSQL database built from
 * empty before any worker starts, which is what `globalSetup` is for.
 *
 * The same two files are re-used by `packages/api`, so the two suites cannot
 * drift over how a test database is made.
 */
export default defineConfig({
  test: {
    // THE GATE FIRST HERE TOO, and for the same reason it is first below: a
    // global setup runs in the MAIN process, which `setupFiles` never reach, and
    // one listed ahead of the gate would run ahead of it.
    globalSetup: ["@canoncore/config/testing/gate-global-setup", "./src/testing/global-setup.ts"],
    // THE GATE FIRST, and the order is the point: a setup file that reached
    // out itself would do it before a gate listed after it was installed.
    setupFiles: ["@canoncore/config/testing/install-network-gate", "./src/testing/setup.ts"],
    // One database, shared by every file in this suite. Files run in sequence
    // because some of them assert on constraints that are global to it -- the
    // single owner row, the one global source order -- which two workers
    // writing at once would race rather than test.
    fileParallelism: false,
  },
});
