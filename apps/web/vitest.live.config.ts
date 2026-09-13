import { defineConfig } from "vitest/config";

/**
 * THE LIVE CHECK, WHICH IS A PROJECT OF ITS OWN BECAUSE IT CANNOT RUN IN CI (CNCORE-103).
 *
 * `vitest.e2e.config.ts` stands the app up against a STUB provider, and it is the right
 * shape for CI: it needs no credential and no network. This one stands the app up against
 * the REAL `provider-wiki` talking to the REAL wiki, so it needs the Owner's Credential --
 * which no CI job holds (ADR-0122) and which expires within a day.
 *
 * IT IS NOT IN `test:e2e` AND MUST NOT BE. A check that cannot run in CI, listed beside
 * checks that can, is a red suite on every machine that lacks the credential -- and the
 * habit that follows is ignoring the red, which costs the checks that were working.
 *
 * IT IS DELIBERATELY NOT A TURBO TASK, and that absence is a decision rather than an
 * omission. `turbo.json` declares `test:e2e` and `test:contract`; there is no `test:live`
 * and there must not be. Two reasons, and the second is the one with a history:
 *
 * A RUN OF THIS IS NEVER CACHEABLE. It asserts against a LIVE wiki that editors edit, so a
 * replayed hit would report a catalogue that was true last week -- which is the opposite of
 * what the file is for.
 *
 * AND A TURBO TASK FILTERS ITS ENVIRONMENT. `PROVIDER_WIKI_REPO` is how this file finds the
 * provider to spawn, and a task that did not declare it would have that variable filtered
 * out and answer a different question in silence. That is CNCORE-143's shape exactly: the
 * "against the real provider" job ran against the stub for want of a declared variable, and
 * nothing went red. Run with `pnpm test:live` from this package, never through turbo.
 *
 * NO NETWORK GATE HERE, which is the other thing this config really decides. Every other
 * suite installs `@canoncore/config/testing/install-network-gate`; this file is the single
 * place in the repository where reaching the real internet is the point.
 */
export default defineConfig({
  test: {
    include: ["live/**/*.test.ts"],
    // A Next build, two server starts and three live imports before the last
    // assertion -- and the third is AHistory, which is most of the minute.
    testTimeout: 900_000,
    hookTimeout: 900_000,
    // One file, one instance, no sharing: it is a proof, not a suite.
    fileParallelism: false,
  },
});
