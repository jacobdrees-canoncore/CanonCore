import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The unit suite: the catch-all route handler, driven directly. It needs no
 * server and no database, so it stays fast and runs on every `pnpm test`.
 *
 * `e2e/` AND `browser/` ARE EXCLUDED AND HAVE CONFIGS OF THEIR OWN, because
 * both build and start Next against a real PostgreSQL database and one of them
 * also launches a browser. Putting a production build in front of every local
 * test run is the cost that separation avoids.
 *
 * EXCLUDING A DIRECTORY IS NOT OPTIONAL TIDINESS. Vitest's default `include`
 * sweeps every `*.test.ts` under the package, so a new suite directory is IN
 * this config until it is named here -- and `browser/` picked up by the unit
 * run fails at its first `inject`, naming a variable rather than the config
 * that swept it. That is how CNCORE-73 met it.
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
    exclude: ["e2e/**", "browser/**", "node_modules/**", ".next/**"],
  },
});
