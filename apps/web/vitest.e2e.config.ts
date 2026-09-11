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
  },
});
