import { defineConfig } from "vitest/config";

/** The app over real HTTP. See `e2e/global-setup.ts` for what it stands up. */
export default defineConfig({
  test: {
    include: ["e2e/**/*.test.ts"],
    globalSetup: ["@canoncore/config/testing/gate-global-setup", "./e2e/global-setup.ts"],
    /**
     * The gate, which this suite needs the loopback carve-out for: the test
     * files below fetch the Next server `global-setup.ts` started on
     * 127.0.0.1.
     *
     * IT DOES NOT COVER `globalSetup`, which is why the gate is listed there
     * too: Vitest runs setup files in each test WORKER and a global setup in
     * the MAIN process, so this line alone leaves the build-and-start above
     * ungated. It was an open gap until CNCORE-30 and is now two lines rather
     * than one.
     */
    setupFiles: ["@canoncore/config/testing/install-network-gate"],
    // A Next build and a server start, before the first assertion.
    hookTimeout: 180_000,
    /*
     * NO `fileParallelism: false`, AND THAT IS DECIDED RATHER THAN OMITTED
     * (CNCORE-253). Five sibling configs set it, so its absence here reads as
     * an oversight -- and the files of this suite really do write to an
     * instance they share, which is the condition the setting answers.
     *
     * THEY SET IT BECAUSE THEIR FILES SHARE ONE DATABASE AND NOTHING ELSE
     * SEPARATES THEM, so a file's POSITION decides what a query returns
     * (`stable-sequencer.ts` carries the rest of that argument). This suite
     * answers shared state a different way: SEPARATE INSTANCES, each with its
     * own database and its own contract -- and where a fact genuinely needs a
     * catalogue that does not move, CNCORE-93 built
     * `aCatalogueThatHoldsStill` rather than reaching for a lock. A file
     * needing quiet here asks for an instance.
     *
     * AND SERIALISING WOULD NOT HAVE FIXED CNCORE-271, ONLY HIDDEN IT. The
     * defect was an assertion that depended on catalogue-wide state. A suite
     * that never interleaves leaves that dependency standing and waiting for
     * whoever runs two files at once; it is fixed where it was, in what the
     * assertion compares (`steadyMainOf`), and the timing that used to be a
     * bet is forced every run by `aGroupArrivesAt`.
     *
     * WHAT THE PARALLELISM IS WORTH HERE WAS NOT MEASURED, and saying so is
     * the honest half: the serial run needed to price it was not taken, so no
     * ratio is stated. What IS known is the parallel side -- the whole suite
     * ran in a little over two minutes on this Mac on 2026-09-20, load average
     * around 9 with other agents working, every file of it standing up or
     * sharing a real Next server. `time pnpm test:e2e` takes it again.
     *
     * NO FILE OR TEST COUNT IS QUOTED HERE ON PURPOSE. Those move with every
     * merge -- this sentence said 341, then 342, then 343 across one
     * afternoon's rebases -- and a figure that rots weekly is ADR-0153's
     * defect, not its remedy. The duration and the conditions are what the
     * decision rests on; `tree-figures.ts` derives the counts that matter.
     */
  },
});
