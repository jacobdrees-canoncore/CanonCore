import { defineConfig } from "vitest/config";

/**
 * ADR-0103 rules out EMPTY Vitest configs, not files carrying a setting
 * something needs. This one carries the network gate: every suite in the
 * repository installs it, so an unexpected outbound request from a test throws
 * instead of reaching the network.
 */
export default defineConfig({
  test: {
    setupFiles: ["@canoncore/config/testing/install-network-gate"],
  },
});
