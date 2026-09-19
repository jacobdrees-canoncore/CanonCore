import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Client } from "pg";

/**
 * Relative imports carry `.ts` here because `scripts/setup.ts` runs this under
 * bare `node`, whose ESM resolver needs the extension that bundler resolution
 * omits. Same rule `ladder.ts` follows, and the reason this module is NOT on
 * the package's root export: it reaches for `node:fs`, `pg` and the migrator,
 * and the root export is what the web app bundles.
 */
import { migrateToHead } from "./migrate.ts";
import { type SeededItem, seedOneItemInTwoOrderings } from "./seed.ts";
import { worktreeDatabaseName } from "./worktree-database.ts";

export interface WorktreeDatabaseSetup {
  /** The PostgreSQL server, naming any database that already exists on it. */
  serverUrl: string;
  branch: string;
  /** Written only if it does not already exist. */
  envFile: string;
}

export interface WorktreeDatabase {
  database: string;
  url: string;
  created: boolean;
  /** Only when the database was created; an existing one is left alone. */
  seeded?: SeededItem;
  envWritten: boolean;
  /**
   * Whether the `.env` now on disk actually names this worktree's database.
   *
   * False means the worktree will go on talking to a database this setup did
   * not prepare -- which is how a `.env` copied from somewhere else quietly
   * puts two worktrees back on one database, the failure this all exists to
   * end. The caller is expected to say so rather than report plain success.
   */
  envNamesThisDatabase: boolean;
}

/**
 * Everything a worktree needs to have a database of its own: created inside the
 * shared container, migrated to head, seeded with one item in two orderings,
 * and named in `apps/web/.env`.
 *
 * IDEMPOTENT, and deliberately conservative about it. It never drops anything
 * and never overwrites an existing `.env`, because the cost of being wrong in
 * that direction is a developer's work and the cost of being wrong the other
 * way is running it again.
 */
export async function setUpWorktreeDatabase({
  serverUrl,
  branch,
  envFile,
}: WorktreeDatabaseSetup): Promise<WorktreeDatabase> {
  const database = worktreeDatabaseName(branch);
  const target = new URL(serverUrl);
  target.pathname = `/${database}`;
  const url = target.toString();

  // ONE setup at a time per database, held across create AND migrate. Creating
  // is not the only thing that races: two migrators against one fresh database
  // both try to create the `drizzle` schema, and the loser dies on
  // `pg_namespace_nspname_index`. Measured, not guessed -- catching the create
  // collision alone left the test red on exactly that.
  //
  // A session advisory lock rather than a table: there is no table yet when the
  // database is being created, which is the moment that needs the lock most.
  // Rails and Django lock their migrations the same way.
  const { created, seeded } = await holdingSetupLock(serverUrl, database, async () => {
    const created = await createDatabaseIfAbsent(serverUrl, database);
    await migrateToHead(url);
    return { created, seeded: created ? await seedOneItemInTwoOrderings(url) : undefined };
  });

  return { database, url, created, seeded, ...pointEnvFileAt(envFile, url, database) };
}

/**
 * Names `url` in the app's `.env` if there is no `.env` yet, and says whether
 * the one on disk now names `database`. Shared with `pnpm db:restore`, which
 * replaces the same database and owes the same answer about it.
 */
export function pointEnvFileAt(
  envFile: string,
  url: string,
  database: string,
): Pick<WorktreeDatabase, "envWritten" | "envNamesThisDatabase"> {
  // Never overwritten. `.env` is the developer's own machine state and may
  // point somewhere they chose deliberately.
  let envWritten = false;
  if (!existsSync(envFile)) {
    writeFileSync(envFile, `DATABASE_URL=${url}\n`);
    envWritten = true;
  }
  return { envWritten, envNamesThisDatabase: envWritten || envFileNames(envFile, database) };
}

/**
 * Runs `work` while holding a PostgreSQL advisory lock keyed on the database
 * name, on a connection to the server rather than to the database being set up
 * -- which may not exist yet. `restore.ts` takes the same lock, so a setup and
 * a restore of one database cannot interleave.
 */
export async function holdingSetupLock<T>(
  serverUrl: string,
  database: string,
  work: () => Promise<T>,
): Promise<T> {
  const key = lockKeyFor(database);
  const client = new Client({ connectionString: serverUrl });
  await client.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [key]);
    try {
      return await work();
    } finally {
      await client.query("select pg_advisory_unlock($1)", [key]);
    }
  } finally {
    await client.end();
  }
}

/** A stable signed 64-bit key from the database name, which is what the lock takes. */
function lockKeyFor(database: string): string {
  const digest = createHash("sha256").update(database).digest();
  // Clear the top bit so the value fits a signed bigint without wrapping.
  return (digest.readBigUInt64BE(0) >> 1n).toString();
}

async function createDatabaseIfAbsent(serverUrl: string, database: string): Promise<boolean> {
  const admin = new Client({ connectionString: serverUrl });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("select 1 from pg_database where datname = $1", [
      database,
    ]);
    if (rowCount !== 0) return false;
    try {
      // A database name is an identifier, not a parameter, so it cannot be
      // bound. `worktreeDatabaseName` is what constrains it to [a-z0-9_].
      await admin.query(`create database "${database}"`);
      return true;
    } catch (error) {
      // Somebody else created it between the check above and this line.
      // Check-then-create always has that window, and two things running
      // `db:setup` at once is ordinary here -- an agent and a human, a shell
      // hook and a terminal. Losing the race is not an error.
      //
      // TWO codes, measured rather than assumed. Postgres answers 42P04
      // (duplicate_database) when the loser's CREATE starts after the winner's
      // committed, and 23505 on `pg_database_datname_index` when the two
      // overlap in the catalogue. Catching only 42P04 left the test red.
      if (isAlreadyCreated(error)) return false;
      throw error;
    }
  } finally {
    await admin.end();
  }
}

/** Whether the DATABASE_URL in a .env file names this database. */
function envFileNames(envFile: string, database: string): boolean {
  if (!existsSync(envFile)) return false;
  const line = readFileSync(envFile, "utf8").match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m)?.[1];
  if (line === undefined) return false;
  try {
    return decodeURIComponent(new URL(line).pathname.slice(1)) === database;
  } catch {
    return false;
  }
}

/** Both ways PostgreSQL reports that this database was created underneath us. */
function isAlreadyCreated(error: unknown): boolean {
  const { code, constraint } = (error ?? {}) as { code?: unknown; constraint?: unknown };
  if (code === "42P04") return true;
  return code === "23505" && constraint === "pg_database_datname_index";
}
