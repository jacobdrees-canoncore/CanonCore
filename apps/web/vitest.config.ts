import { defineConfig } from "vitest/config";

/**
 * The unit suite: the catch-all route handler, driven directly. It needs no
 * server and no database, so it stays fast and runs on every `pnpm test`.
 *
 * `e2e/` is excluded and has a config of its own, because it builds and starts
 * Next against a real PostgreSQL database. Putting a production build in front
 * of every local test run is the cost that separation avoids.
 */
export default defineConfig({
  test: {
    setupFiles: ["@canoncore/config/testing/install-network-gate"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
