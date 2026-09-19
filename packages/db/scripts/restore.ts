/**
 * Makes this worktree's own database a COPY of a catalogue, from a dump of it.
 *
 *   pnpm db:restore ~/Documents/CanonCore\ backups/<newest>.dump
 *
 * HOW DEVELOPMENT READS REAL DATA (CNCORE-168). A worktree never points at the
 * Owner's catalogue: it restores a dump of it into the database it already
 * owns (ADR-0104), which `restoreDatabase` drops and creates FROM the dump --
 * so the copy carries the dump's Owner id rather than one of its own, which is
 * ADR-0048's first route. Where the dump comes from is outside this repository,
 * and that record says how it is taken.
 *
 * A thin CLI over `restoreDatabase`, which is where the behaviour lives and
 * where the suite reaches it.
 */
import { isAbsolute } from "node:path";
import { Client } from "pg";

import "../src/load-env.ts";
import { restoreDatabase } from "../src/restore.ts";
import { pointEnvFileAt } from "../src/setup-worktree.ts";
import { worktreeDatabaseName } from "../src/worktree-database.ts";
import { branch, envFile, serverUrl } from "./worktree.ts";

const [dump] = process.argv.slice(2);
if (dump === undefined) {
  console.error("usage: pnpm db:restore <dump>, a `pg_dump --format=custom` archive on disk.");
  process.exit(1);
}
// AN ABSOLUTE PATH OR NOTHING. Turbo runs this from `packages/db`, and the one
// variable that would say where pnpm was invoked, INIT_CWD, reaches it rewritten
// to `packages/db` by the inner `pnpm run` -- measured, with it passed through.
// A relative path would be read from somewhere the reader did not type it.
if (!isAbsolute(dump)) {
  console.error(`${dump} is relative, and turbo runs this from packages/db. Give its full path.`);
  process.exit(1);
}

const database = worktreeDatabaseName(branch);
const { url, ladder } = await restoreDatabase({ serverUrl, database, dump });
const env = pointEnvFileAt(envFile, url, database);

// WHAT THE COPY HOLDS, read back from it, so the report is the worktree
// reading the catalogue rather than the restore asserting it did.
const client = new Client({ connectionString: url });
await client.connect();
const { rows } = await client.query<{ owner: string; items: string; placements: string }>(
  `select (select id from owners) as owner,
          (select count(*) from items) as items,
          (select count(*) from placements) as placements`,
);
await client.end();
const read = rows[0];

console.log(`branch      ${branch}`);
console.log(`database    ${database} (replaced from ${dump})`);
console.log(`ladder      dumped at ${ladder.dumped}`);
console.log(`            carried to ${ladder.head}`);
console.log(`owner       ${read?.owner}`);
console.log(`holds       ${read?.items} Items, ${read?.placements} Placements`);
if (env.envWritten) console.log("env         wrote apps/web/.env");
else if (env.envNamesThisDatabase) console.log("env         apps/web/.env already points here");
else {
  console.log("env         apps/web/.env points at another database, left alone");
  console.log(`            the app will NOT serve ${database} until you change it`);
}
