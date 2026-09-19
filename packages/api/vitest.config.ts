import { StableSequencer } from "@canoncore/config/testing/stable-sequencer";
import { defineConfig } from "vitest/config";

/**
 * The router reads the catalogue, so this suite needs a database. It re-uses
 * the two files `packages/db` publishes for the purpose rather than building a
 * second harness that could drift from the first.
 */
export default defineConfig({
  test: {
    /**
     * `src` AND NOT THE WHOLE PACKAGE, which is what keeps `corpus/` a project
     * of its own rather than a project of its own that this one also runs.
     *
     * Vitest's default include is every `*.test.ts` under the package, so
     * `corpus/corpus-stands.test.ts` was swept in here as well and reported as
     * a skip. It skipped only because `CANONCORE_AT` was unset: a machine with
     * that variable set -- the Owner's own, which is the whole point of it --
     * would have run a census against a live install from inside the suite CI
     * runs, asserting 465 Orderings in a job that has none.
     */
    include: ["src/**/*.test.ts"],
    // THE GATE FIRST HERE TOO, and for the same reason it is first below: a
    // global setup runs in the MAIN process, which `setupFiles` never reach.
    globalSetup: [
      "@canoncore/config/testing/gate-global-setup",
      "@canoncore/db/testing/global-setup",
    ],
    // THE GATE FIRST, and the order is the point: a setup file that reached
    // out itself would do it before a gate listed after it was installed.
    setupFiles: ["@canoncore/config/testing/install-network-gate", "@canoncore/db/testing/setup"],
    fileParallelism: false,
    // AND THE ORDER OF THOSE FILES DOES NOT MOVE (CNCORE-199): with one
    // catalogue and no parallelism, a file's POSITION is part of its fixture.
    // `stable-sequencer.ts` says what Vitest's own sequencer does instead.
    sequence: { sequencer: StableSequencer },
    /**
     * WHAT IS LEFT HERE IS THE ONE SETTING THAT IS STILL CONFIGURATION.
     *
     * ADR-0034's allowlist used to sit beside it and does not any more: it is a
     * row in the settings store since CNCORE-99, so the file that needs one
     * writes it (`provider.test.ts`) instead of the whole suite inheriting it
     * from here. The password stays because ADR-0044 keeps it out of the
     * database on purpose -- "no password column ships".
     */
    env: {
      /**
       * THE OWNER'S PASSWORD, because this suite asserts both sides of the door
       * CNCORE-109 put in: what a caller with a session may do, and what one
       * without it may not. An instance that set none could only assert the
       * second half -- which is ADR-0044's demo, and is covered by a test that
       * takes this value away rather than by the whole suite running without it.
       */
      OWNER_PASSWORD: "the owner's own password",
    },
  },
});
