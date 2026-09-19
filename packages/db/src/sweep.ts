import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { Client } from "pg";

import { databaseNamedIn, holdingSetupLock } from "./setup-worktree.ts";
import { isNamedAfterABranch, MARKER, worktreeDatabaseName } from "./worktree-database.ts";

/**
 * Drops every database named after a branch that no worktree of `repository`
 * owns any more, from the container every worktree shares (CNCORE-231).
 *
 * `db:setup` RUNS IT, because every worktree runs that to join the container
 * and so nobody has to remember to. `orca worktree rm` takes a worktree's files
 * and nothing else, and before this the cluster only grew: 1,250 databases and
 * 11 GB on 2026-09-19, 1,151 of them a removed worktree's. Orca's archive
 * hook was the other place for it and is skipped unless `--run-hooks` is
 * passed, which is remembering by another name.
 *
 * WHAT IT MAY DROP IS NARROW ON PURPOSE: only a name `worktreeDatabaseName`
 * could have produced, with any tail the harness derives from it. The server's
 * own databases, the container's `canoncore`, the `canoncore_test…` a CI-style
 * DATABASE_URL derives and anything built by hand are never candidates,
 * whether or not anything wants them.
 *
 * NEVER `with (force)`. Nothing a live worktree reaches is ever handed to the
 * DROP, so a connection to a dead database is a leaked server or a person, and
 * the answer is to name it rather than to cut it off.
 *
 * THE LISTING IS READ BEFORE THE WORKTREES, so any database it lists was made
 * by a worktree that `git worktree list` already shows, if it is live.
 * `dropDatabases` asks again for each name under `db:setup`'s lock.
 */
export async function sweepDeadDatabases({
  serverUrl,
  repository,
}: {
  serverUrl: string;
  /** Any worktree of the repository; `git worktree list` answers for all of them. */
  repository: string;
}): Promise<Swept> {
  const admin = new Client({ connectionString: serverUrl });
  await admin.connect();
  let listing: string[];
  try {
    const { rows } = await admin.query<{ datname: string }>("select datname from pg_database");
    listing = rows.map((row) => row.datname);
  } finally {
    await admin.end();
  }
  return dropDatabases(
    serverUrl,
    deadDatabases(listing, ownedDatabases(repository)),
    (database) => deadDatabases([database], ownedDatabases(repository)).length === 1,
  );
}

/**
 * Every database a worktree of this repository owns, the main checkout's
 * included, read from `git worktree list` in any one of them.
 *
 * TWO PER WORKTREE, AND EITHER ALONE WOULD DROP A LIVE ONE. The branch names
 * the database `db:setup` makes, and is all there is before `.env` is written.
 * `.env` names the database the worktree actually USES -- which is what its
 * suites derive theirs from -- and it outlives a `git branch -m`, because
 * `db:setup` never overwrites it.
 */
export function ownedDatabases(repository: string): string[] {
  const listing = execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repository,
    encoding: "utf8",
  });
  return listing.split("\n\n").flatMap((record) => {
    const lines = record.split("\n");
    const path = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
    const branch = lines
      .find((line) => line.startsWith("branch refs/heads/"))
      ?.slice("branch refs/heads/".length);
    return [
      branch === undefined ? undefined : worktreeDatabaseName(branch),
      path === undefined ? undefined : databaseNamedIn(join(path, "apps", "web", ".env")),
    ].filter((database) => database !== undefined);
  });
}

/**
 * The databases a sweep of the shared container drops: those no live worktree
 * owns (CNCORE-231).
 */
export function deadDatabases(databases: readonly string[], owners: readonly string[]): string[] {
  return databases.filter(
    (database) =>
      isNamedAfterABranch(database) &&
      !owners.some((owner) => database === owner || database.startsWith(`${owner}${MARKER}`)),
  );
}

/** What a sweep did with each database it was handed. */
export interface Swept {
  dropped: string[];
  inUse: string[];
}

/** Drops each of `databases` that is still dead when its turn comes. */
export async function dropDatabases(
  serverUrl: string,
  databases: readonly string[],
  stillDead: (database: string) => boolean,
): Promise<Swept> {
  const swept: Swept = { dropped: [], inUse: [] };
  const admin = new Client({ connectionString: serverUrl });
  await admin.connect();
  try {
    for (const database of databases) {
      // UNDER `db:setup`'s OWN LOCK, and asked again inside it. A worktree
      // re-created on a branch whose database outlived the last one adopts that
      // database rather than making a new one, so the listing this sweep began
      // from can be out of date by the time it reaches a name. Setup holds this
      // lock across everything it does to a database: whichever order the two
      // meet in, the question below is answered after the adoption or before
      // the creation, never between.
      await holdingSetupLock(serverUrl, database, () => drop(database));
    }
  } finally {
    await admin.end();
  }
  return swept;

  async function drop(database: string): Promise<void> {
    if (!stillDead(database)) return;
    // ASKED FIRST, because a DROP against a database with a connection does
    // not fail at once: PostgreSQL waits about five seconds for the others
    // to leave, and one leaked e2e server holds eleven. The catch below is
    // for a connection arriving between this question and the DROP.
    const { rowCount } = await admin.query(
      "select 1 from pg_stat_activity where datname = $1 limit 1",
      [database],
    );
    if (rowCount !== 0) {
      swept.inUse.push(database);
      return;
    }
    try {
      // Never `with (force)`: see `sweepDeadDatabases`.
      await admin.query(`drop database if exists "${database}"`);
      swept.dropped.push(database);
    } catch (error) {
      if ((error as { code?: unknown })?.code !== "55006") throw error;
      swept.inUse.push(database);
    }
  }
}
