import { defineConfig } from "vitest/config";

/**
 * The router reads the catalogue, so this suite needs a database. It re-uses
 * the two files `packages/db` publishes for the purpose rather than building a
 * second harness that could drift from the first.
 */
export default defineConfig({
  test: {
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
    /**
     * ADR-0034's allowlist, as this suite's configuration. The stub provider
     * binds a real socket on 127.0.0.1, and reaching it is legal only because
     * a CIDR covering it is named here -- which is the config boundary being
     * exercised rather than bypassed.
     */
    env: {
      PROVIDER_ALLOWLIST: "127.0.0.0/8",
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
