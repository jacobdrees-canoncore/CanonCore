// Importing the server env here is what makes a missing DATABASE_URL fail
// `pnpm build` rather than the first request that touches the database. The
// generator imported an empty client schema instead, which validated nothing.
import "@canoncore/env/server";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  /**
   * What the image ships (CNCORE-63). `standalone` writes a server and the
   * subset of `node_modules` it actually reaches, which is what lets the runner
   * stage carry no pnpm and no dev dependencies at all.
   */
  output: "standalone",
  /**
   * THE REPOSITORY ROOT, stated rather than inferred. Next infers it correctly
   * here -- measured on 16.3.4, 30 traced packages and no warning -- but the
   * inference walks up looking for a lockfile, so it is one stray `package.json`
   * away from choosing `apps/web` and shipping a server missing every workspace
   * package. One line removes the doubt.
   */
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
};

export default nextConfig;
