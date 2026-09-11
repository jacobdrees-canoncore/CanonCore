/**
 * Runs the two checks Drizzle's migrator does not (ADR-0047), and fails.
 *
 *   pnpm db:check-ladder
 *
 * The journal check needs nothing, so it runs on every branch for free.
 *
 * The freeze check needs a database that has ALREADY RUN an older version of
 * the ladder. Against a database this branch built from empty it is vacuous:
 * the ledger was written from the very files it is being compared to. CI
 * arranges the version that means something -- migrate a database from the base
 * branch's ladder, then run this from the pull request's.
 *
 * Imports the source directly, with extensions, and reaches for `pg` rather
 * than the package's Drizzle handle. That is what lets bare `node` run it:
 * `ladder.ts` imports nothing but Node builtins, so no loader and no dependency
 * is needed for one script.
 */
import { Client } from "pg";

import "../src/load-env.ts";

import {
  type AppliedRung,
  checkAppliedRungsAreFrozen,
  checkJournalIsAppendOnly,
  readJournal,
} from "../src/ladder.ts";
import { migrationsFolder } from "../src/migrate.ts";

const problems: string[] = [];
problems.push(...checkJournalIsAppendOnly(await readJournal(migrationsFolder)));

const connectionString = process.env.DATABASE_URL;
if (connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    problems.push(
      ...(await checkAppliedRungsAreFrozen(async () => {
        const applied = await client.query<AppliedRung>(
          `select "hash", "created_at" from "drizzle"."__drizzle_migrations" order by "created_at"`,
        );
        return applied.rows;
      }, migrationsFolder)),
    );
  } finally {
    await client.end();
  }
} else {
  console.log("no DATABASE_URL: checked the journal only, not what any database has applied.");
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`migration ladder: ${problem}`);
  process.exit(1);
}

console.log("migration ladder: append-only at the head, and every applied rung is unchanged.");
