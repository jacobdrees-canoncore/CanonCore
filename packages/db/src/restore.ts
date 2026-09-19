import { execFileSync, spawnSync } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { stat } from "node:fs/promises";
import { Client } from "pg";

import { type AppliedRung, checkAppliedRungsAreFrozen, readJournal } from "./ladder.ts";
import { migrateToHead, migrationsFolder } from "./migrate.ts";
import { holdingSetupLock } from "./setup-worktree.ts";

/**
 * A worktree's COPY of a catalogue, created from a dump (CNCORE-168, ADR-0048).
 *
 * Relative imports carry `.ts` for the reason `setup-worktree.ts` gives:
 * `scripts/restore.ts` runs this under bare `node`.
 */

export interface DatabaseRestore {
  /** The PostgreSQL server, naming any database that already exists on it. */
  serverUrl: string;
  /** The database the copy becomes. DROPPED first if it exists. */
  database: string;
  /** A `pg_dump --format=custom` archive, on disk. */
  dump: string;
}

export interface RestoredDatabase {
  url: string;
  /** The rung the dump had reached, and the head this worktree carried it to. */
  ladder: { dumped: string; head: string };
}

/**
 * Creates `database` FROM the dump: dropped if it exists, created empty, and
 * restored with `pg_restore` run INSIDE the container serving it. Then held to
 * this worktree's ladder and carried up to its head.
 *
 * EVERYTHING THAT CAN REFUSE WITHOUT THE DROP REFUSES BEFORE IT: the name, the
 * file, the server, and the archive read back whole. A refusal after the drop
 * -- a ladder this code cannot carry, a restore that failed -- leaves NO
 * database behind, so nothing is left reading a half-made copy.
 */
export async function restoreDatabase({
  serverUrl,
  database,
  dump,
}: DatabaseRestore): Promise<RestoredDatabase> {
  // HELD TO WHAT `worktreeDatabaseName` PRODUCES rather than trusted to arrive
  // that way. `pg_restore --dbname` reads a value holding `=` or a URI prefix as
  // a connection string, and PostgreSQL truncates a name past 63 bytes SILENTLY,
  // onto whatever database the shorter name is -- and this is about to drop it.
  // So the SQL below may interpolate it as `setup-worktree.ts` does.
  if (!/^[a-z0-9_]{1,63}$/.test(database)) {
    throw new Error(`${JSON.stringify(database)} is not a database this restore will name.`);
  }
  // A COPY IS THE ONLY THING A WORKTREE READS. A connection string names a
  // catalogue rather than a dump of one.
  if (!(await stat(dump).catch(() => undefined))?.isFile()) {
    throw new Error(`${dump} is not a dump on disk. A restore reads a copy, never a catalogue.`);
  }
  const container = containerServing(serverUrl);
  // READ BACK WHOLE, and `--list` is not that: it reads only the table of
  // contents at the front, and passed an archive cut to half its length. A
  // script sent nowhere reads every entry and touches no database.
  const readBack = pgRestore(container, dump, ["--file=/dev/null"]);
  if (readBack.status !== 0) {
    throw new Error(`${dump} is not a dump on disk that pg_restore can read: ${readBack.stderr}`);
  }

  const target = new URL(serverUrl);
  target.pathname = `/${database}`;
  const url = target.toString();

  // `db:setup`'s own lock, so the two cannot interleave on one database: a
  // setup finding the empty one mid-restore would migrate it underneath.
  return holdingSetupLock(serverUrl, database, async () => {
    await onServer(serverUrl, async (admin) => {
      await admin.query(`drop database if exists "${database}" with (force)`);
      await admin.query(`create database "${database}" template template0`);
    });
    try {
      const restored = pgRestore(container, dump, [
        "--single-transaction",
        "--no-owner",
        "--no-privileges",
        "--username",
        decodeURIComponent(target.username),
        "--dbname",
        database,
      ]);
      if (restored.status !== 0) throw new Error(`pg_restore refused the dump: ${restored.stderr}`);

      const applied = await appliedRungsIn(url);
      const problems = await checkAppliedRungsAreFrozen(async () => applied, migrationsFolder);
      if (problems.length > 0) {
        throw new Error(`this worktree's ladder cannot carry the dump:\n${problems.join("\n")}`);
      }
      const journal = await readJournal(migrationsFolder);
      const newest = Math.max(...applied.map((rung) => Number(rung.created_at)));
      const dumped = journal.find((entry) => entry.when === newest);
      const head = journal.at(-1);
      if (dumped === undefined || head === undefined) {
        throw new Error("the dump has run no rung of this ladder at all");
      }

      await migrateToHead(url);
      return { url, ladder: { dumped: dumped.tag, head: head.tag } };
    } catch (error) {
      await onServer(serverUrl, (admin) =>
        admin.query(`drop database if exists "${database}" with (force)`),
      );
      throw error;
    }
  });
}

/** `pg_restore` inside `container`, reading the archive on its stdin. */
function pgRestore(container: string, dump: string, args: string[]) {
  const archive = openSync(dump, "r");
  try {
    return spawnSync("docker", ["exec", "--interactive", container, "pg_restore", ...args], {
      stdio: [archive, "ignore", "pipe"],
      encoding: "utf8",
    });
  } finally {
    closeSync(archive);
  }
}

/** Every rung a database's own ledger says it has run. */
async function appliedRungsIn(url: string): Promise<AppliedRung[]> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<AppliedRung>(
      "select hash, created_at from drizzle.__drizzle_migrations",
    );
    return rows;
  } finally {
    await client.end();
  }
}

async function onServer(serverUrl: string, work: (admin: Client) => Promise<unknown>) {
  const admin = new Client({ connectionString: serverUrl });
  await admin.connect();
  try {
    await work(admin);
  } finally {
    await admin.end();
  }
}

/**
 * The one container on this machine publishing the port a server URL names,
 * which is where `pg_restore` runs: the SERVER'S OWN BINARY, rather than
 * whatever the host has. That was Homebrew's 17.11 here against an 18 server,
 * and PostgreSQL promises nothing about an older release reading a newer
 * archive. 17.11 did list this repository's 18 archives when tried (2026-09-19),
 * which is luck rather than a guarantee, and CI's runner carries no matching
 * client at all (ADR-0047).
 *
 * A SERVER ELSEWHERE IS REFUSED rather than matched on its port alone, because
 * a local container publishing the same number is a different server.
 */
export function containerServing(serverUrl: string): string {
  const { hostname, port } = new URL(serverUrl);
  if (!/^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(hostname)) {
    throw new Error(
      `${hostname} is not on this machine, so no container here is serving it. ` +
        "A restore runs pg_restore inside the container that serves the copy.",
    );
  }
  const published = port || "5432";
  const names = execFileSync(
    "docker",
    ["ps", "--filter", `publish=${published}`, "--format", "{{.Names}}"],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
  const [name] = names;
  if (names.length !== 1 || name === undefined) {
    throw new Error(
      `expected one running container publishing port ${published}, found ${names.length}. ` +
        "Check `docker ps` for the development database; `pnpm db:start` starts it if it is " +
        "stopped and never recreates one (ADR-0104).",
    );
  }
  return name;
}
