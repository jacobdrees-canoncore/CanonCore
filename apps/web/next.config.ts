// Importing the server env here is what makes a missing DATABASE_URL fail
// `pnpm build` rather than the first request that touches the database. The
// generator imported an empty client schema instead, which validated nothing.
import "@canoncore/env/server";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;
