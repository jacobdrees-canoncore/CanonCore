/**
 * Everything a worktree needs to have a database of its own.
 *
 *   pnpm db:setup
 *
 * A thin CLI over `setUpWorktreeDatabase` and then `sweepDeadDatabases`, which
 * is where the behaviour lives and where the suite reaches it. This file
 * resolves what only a running process knows -- the branch, the server and the
 * repository -- and prints the result.
 */
import "../src/load-env.ts";
import { setUpWorktreeDatabase } from "../src/setup-worktree.ts";
import { sweepDeadDatabases } from "../src/sweep.ts";
import { branch, envFile, port, repository, serverUrl } from "./worktree.ts";

// Only a refused CONNECTION gets the "run db:start" advice. Wrapping every
// failure in it reported a broken migration, an unwritable .env and an
// unnameable branch as a database that was not running.
const result = await setUpWorktreeDatabase({ serverUrl, branch, envFile }).catch(
  (cause: unknown) => {
    const code = (cause as { code?: unknown })?.code;
    if (code === "ECONNREFUSED" || code === "ENOTFOUND") {
      throw new Error(
        `nothing is listening on port ${port}. Run \`pnpm db:start\` first. ` +
          "The container keeps the port it was created with, so if it answers `Running`, " +
          `it publishes another port than ${port} and CANONCORE_DB_PORT should name that one. ` +
          `(If something else holds ${port}, the container has to be created on another: ` +
          "see ADR-0104.)",
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

// AFTER this worktree's own database, so a sweep that fails cannot cost the
// setup it rides on (CNCORE-231). `sweep.ts` says what it may drop and why.
const swept = await sweepDeadDatabases({ serverUrl, repository });
console.log(`swept     ${swept.dropped.length} databases no live worktree owns`);
for (const database of swept.inUse) {
  console.log(`          left ${database}: no worktree owns it, but something is connected to it`);
}
