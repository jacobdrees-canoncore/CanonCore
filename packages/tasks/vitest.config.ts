import { StableSequencer } from "@canoncore/config/testing/stable-sequencer";
import { defineConfig } from "vitest/config";

/**
 * The run history is a table, so this suite needs a database -- and it takes
 * the two files `packages/db` publishes for the purpose rather than standing up
 * a second harness that could drift from the first, which is the reason
 * `packages/api` takes them too.
 */
export default defineConfig({
  test: {
    // THE GATE FIRST IN BOTH LISTS. A global setup runs in the MAIN process,
    // which `setupFiles` never reach, so the gate is named in both.
    globalSetup: [
      "@canoncore/config/testing/gate-global-setup",
      "@canoncore/db/testing/global-setup",
    ],
    setupFiles: ["@canoncore/config/testing/install-network-gate", "@canoncore/db/testing/setup"],
    /**
     * A BUDGET FOR A SERVER THIS SUITE DOES NOT HAVE TO ITSELF (ADR-0184).
     *
     * Vitest's default is 5,000ms, and CNCORE-280 caught a test dying at
     * 5,004ms -- the FIRST test in its file, where the other ten passed in 6 to
     * 24ms each. Nothing was wrong with it: four worktrees' suites share one
     * PostgreSQL (ADR-0104), and the first test to reach the catalogue pays the
     * connection while the rest of the machine is busy. A budget that tight is
     * a measurement of the machine rather than of the code under test.
     *
     * THIRTY SECONDS IS `packages/contract`'s FIGURE, taken rather than invented:
     * that is the other suite here whose work happens outside its own process.
     * A genuinely hung query still fails, thirty seconds later, in a suite whose
     * whole run is about that long -- which is loud enough.
     */
    testTimeout: 30_000,
    // One database, shared by every file here, for the reason `packages/db`
    // gives: two workers writing to it at once race rather than test.
    fileParallelism: false,
    // AND THE ORDER OF THOSE FILES DOES NOT MOVE (CNCORE-199): with one
    // catalogue and no parallelism, a file's POSITION is part of its fixture.
    // `stable-sequencer.ts` says what Vitest's own sequencer does instead.
    sequence: { sequencer: StableSequencer },
  },
});
