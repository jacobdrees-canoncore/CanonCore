import { fileURLToPath } from "node:url";
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
  /**
   * `@/` AS THE APP RESOLVES IT. Next reads the alias out of `tsconfig.json`'s
   * `paths` and Vitest does not, so a file under test that imports `@/session`
   * -- as the route handler does, for the session cookie's name -- fails to
   * resolve at all rather than failing an assertion. One alias here rather than
   * a relative path in the source, because the source is what ships.
   */
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    setupFiles: ["@canoncore/config/testing/install-network-gate"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
