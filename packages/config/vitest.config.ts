import { defineConfig } from "vitest/config";

/**
 * ADR-0103 rules out EMPTY Vitest configs, not files carrying a setting
 * something needs. This one carries the network gate: every suite in the
 * repository installs it, so an unexpected outbound request from a test throws
 * instead of reaching the network.
 *
 * This package is where the gate itself lives, and it is listed here by the
 * same public specifier every other suite uses -- never by a relative path.
 * The specifier is what the other fourteen configs are checked against, so a suite
 * spelling it differently would be a suite this one could not vouch for.
 */
export default defineConfig({
  test: {
    setupFiles: ["@canoncore/config/testing/install-network-gate"],
  },
});
