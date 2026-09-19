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
    // One database, shared by every file here, for the reason `packages/db`
    // gives: two workers writing to it at once race rather than test.
    fileParallelism: false,
    // AND THE ORDER OF THOSE FILES DOES NOT MOVE (CNCORE-199): with one
    // catalogue and no parallelism, a file's POSITION is part of its fixture.
    // `stable-sequencer.ts` says what Vitest's own sequencer does instead.
    sequence: { sequencer: StableSequencer },
  },
});
