/**
 * Everything a worktree needs to have a database of its own.
 *
 *   pnpm db:setup
 *
 * A thin CLI over `setUpWorktreeDatabase`, which is where the behaviour lives
 * and where the suite reaches it. This file resolves the two things only a
 * running process knows -- the branch and the server -- and prints the result.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import "../src/load-env.ts";
import { setUpWorktreeDatabase } from "../src/setup-worktree.ts";

// CANONCORE_DB_PORT is a SHELL variable, not an apps/web/.env one: Compose
// reads the shell (or packages/db/.env) and would not see a value set only in
// the app's file, which is the same silent mismatch this whole change is about.
const port = process.env.CANONCORE_DB_PORT ?? "55432";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error(`CANONCORE_DB_PORT is ${JSON.stringify(port)}, which is not a port.`);
  process.exit(1);
}
const serverUrl = `postgresql://postgres:password@localhost:${port}/postgres`;
const envFile = fileURLToPath(new URL("../../../apps/web/.env", import.meta.url));

let branch: string;
try {
  branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
} catch (cause) {
  throw new Error("could not read the current branch; is this a git worktree?", { cause });
}

// A detached HEAD answers `HEAD`, which names no worktree and would put every
// detached checkout on one database.
if (branch === "HEAD") {
  console.error("detached HEAD: check out a branch before running db:setup.");
  process.exit(1);
}

// Only a refused CONNECTION gets the "run db:start" advice. Wrapping every
// failure in it reported a broken migration, an unwritable .env and an
// unnameable branch as a database that was not running.
const result = await setUpWorktreeDatabase({ serverUrl, branch, envFile }).catch(
  (cause: unknown) => {
    const code = (cause as { code?: unknown })?.code;
    if (code === "ECONNREFUSED" || code === "ENOTFOUND") {
      throw new Error(
        `nothing is listening on port ${port}. Run \`pnpm db:start\` first. ` +
          `(If something else already holds ${port}, set CANONCORE_DB_PORT in your shell.)`,
        { cause },
      );
    }
    throw cause;
  },
);

console.log(`branch    ${branch}`);
console.log(`database  ${result.database} ${result.created ? "(created)" : "(already there)"}`);
if (result.seeded) {
  const { projectedTitle } = result.seeded;
  console.log(`seeded    ${projectedTitle ?? "(no title -- the projection did not run)"}`);
}

if (result.envWritten) {
  console.log("env       wrote apps/web/.env");
  if (result.seeded) console.log(`page      http://localhost:3001/items/${result.seeded.id}`);
} else if (result.envNamesThisDatabase) {
  console.log("env       apps/web/.env already points here, left alone");
  if (result.seeded) console.log(`page      http://localhost:3001/items/${result.seeded.id}`);
} else {
  // Printing a URL that 404s is worse than printing none: the reader concludes
  // the page is broken rather than that .env points somewhere else.
  console.log(`env       apps/web/.env points at another database, left alone`);
  console.log(`          the app will NOT serve ${result.database} until you change it`);
}
