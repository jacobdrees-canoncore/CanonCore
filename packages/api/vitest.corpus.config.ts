import { defineConfig } from "vitest/config";

/**
 * THE CORPUS CHECK, WHICH IS A PROJECT OF ITS OWN BECAUSE IT CANNOT RUN IN CI
 * (CNCORE-167).
 *
 * `vitest.config.ts` beside this one builds a database from empty and calls the
 * router in the same process, which is the right shape for CI: it needs no
 * network and no install. This one asserts against a RUNNING CanonCore holding
 * the Doctor Who corpus -- 465 Orderings that took five and a half hours to
 * import behind the Owner's wiki Credential, which no CI job may hold
 * (ADR-0122) and which expires within a day.
 *
 * IT IS NOT IN `pnpm test` AND MUST NOT BE, which is the sentence
 * `apps/web/vitest.live.config.ts` already wrote and the reason holds
 * unchanged: a check that cannot run in CI, listed beside checks that can, is a
 * red suite on every machine that lacks what it needs -- and the habit that
 * follows is ignoring the red, which costs the checks that were working.
 *
 * IT IS DELIBERATELY NOT A TURBO TASK. `turbo.json` declares `test:e2e` and
 * `test:contract`; there is no `test:corpus` and there must not be. A run of
 * this is never cacheable, because it asserts against an install whose
 * catalogue the Owner curates -- a replayed hit would report a corpus that was
 * true last week. And a turbo task FILTERS its environment, so `CANONCORE_AT`
 * would be filtered out and this would answer about a different install in
 * silence, which is CNCORE-143's shape exactly. Run it with `pnpm test:corpus`
 * from this package.
 *
 * THE NETWORK GATE IS INSTALLED, AND THIS IS THE ONE LOCAL-ONLY SUITE THAT
 * KEEPS IT. `apps/web/vitest.live.config.ts` drops it because reaching the real
 * internet is that file's entire point; here it is the opposite. This census
 * asks an install what it holds, and the one thing that would invalidate every
 * figure it reports is a request that went to tardis.wiki instead -- which is
 * CNCORE-159's whole finding, a harness measuring something other than what it
 * claimed. The gate admits `127.0.0.0/8`, `localhost` and `[::1]`, which is
 * every address an install on the Owner's own machine answers on.
 *
 * SO `CANONCORE_AT` MUST NAME A LOOPBACK ADDRESS, and an install somewhere else
 * on the network is refused by the gate rather than quietly measured. That is a
 * real limit and it is the right one today: ADR-0132's instance is wherever the
 * Owner runs it, and the Owner runs it here. Widening `LOOPBACK` would weaken
 * the gate for every other suite in the repository to serve an install nobody
 * has, so the day that install exists is the day to decide it -- loudly, rather
 * than having pre-weakened the control for it.
 *
 * NO DATABASE, though. Every other suite in this package builds one from the
 * ladder; this one holds a socket to an install that already exists and reads
 * it as any client would.
 *
 * WHAT IT IS NOT: a second `live-import.test.ts`. That file proves an import
 * CAN happen, and builds its own throwaway database to prove it in. This one
 * proves a corpus IS STANDING somewhere that persists, which is the half
 * ADR-0132 records as never having landed.
 */
export default defineConfig({
  test: {
    setupFiles: ["@canoncore/config/testing/install-network-gate"],
    include: ["corpus/**/*.test.ts"],
    /*
     * THE WALK IS THOUSANDS OF REQUESTS. 465 Orderings, 29,844 slots and a
     * hundred rows an answer is some eight hundred round trips before the last
     * assertion, and the largest Ordering alone is thirty of them.
     */
    testTimeout: 1_800_000,
    hookTimeout: 1_800_000,
    // One install, one census, no sharing: it is a proof, not a suite.
    fileParallelism: false,
  },
});
