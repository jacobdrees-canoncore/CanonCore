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
 * NO NETWORK GATE HERE, which is the one thing this config really decides. Every other
 * suite installs `@canoncore/config/testing/install-network-gate`; this file is the single
 * place in the repository where reaching the real internet is the point.
 */
export default defineConfig({
  test: {
    include: ["live/**/*.test.ts"],
    // A Next build, two server starts and two live imports before the last assertion.
    testTimeout: 900_000,
    hookTimeout: 900_000,
    // One file, one instance, no sharing: it is a proof, not a suite.
    fileParallelism: false,
  },
});
