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
     * (CNCORE-253). Five sibling configs set it -- `packages/db`,
     * `packages/api` twice, `packages/tasks` and `apps/web/vitest.live.config`
     * -- so its absence here reads as an oversight, and this suite's files do
     * genuinely write to an instance they share.
     *
     * THEY SET IT BECAUSE THEIR FILES SHARE ONE DATABASE AND NOTHING ELSE
     * SEPARATES THEM, so a file's POSITION decides what a query returns
     * (`stable-sequencer.ts` says the rest). This suite's answer to shared
     * state is a different one: FIVE INSTANCES, each with its own database and
     * its own contract -- the seeded one that most files ask, the fresh one,
     * the paged one, the scopable one, and `aCatalogueThatHoldsStill`, which
     * CNCORE-93 built precisely because a count is a fact about a whole
     * catalogue. A file needing quiet asks for an instance, not for a lock.
     *
     * AND SERIALISING WOULD NOT HAVE FIXED CNCORE-271, only hidden it. The
     * defect was an assertion that depended on catalogue-wide state; a suite
     * that never interleaves leaves that dependency in place and waiting for
     * the first person who runs two files at once. It is fixed where it was,
     * in what the assertion compares (`steadyMainOf`), and the timing that
     * used to be a bet is now forced every run by `aGroupArrives`.
     *
     * MEASURED 2026-09-20 on this Mac, 24 files: the run takes 143s of wall
     * clock against 671s summed across its files, so the parallelism is worth
     * about 4.7x here and serialising would cost roughly nine minutes a run.
     */
  },
});
