import { StableSequencer } from "@canoncore/config/testing/stable-sequencer";
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
    // One database, shared by every file in this suite. Files run in sequence
    // because some of them assert on constraints that are global to it -- the
    // single owner row, the one global source order -- which two workers
    // writing at once would race rather than test.
    fileParallelism: false,
    // AND THE ORDER OF THOSE FILES DOES NOT MOVE (CNCORE-199): with one
    // catalogue and no parallelism, a file's POSITION is part of its fixture.
    // `stable-sequencer.ts` says what Vitest's own sequencer does instead.
    sequence: { sequencer: StableSequencer },
  },
});
