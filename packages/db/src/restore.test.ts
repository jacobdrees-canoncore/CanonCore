import { spawnSync } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { asc } from "drizzle-orm";
import { Client } from "pg";
import { describe, expect, it, onTestFinished } from "vitest";

import { createDb, items, owners, placements } from "./index";
import { readJournal } from "./ladder";
import { migrationsFolder } from "./migrate";
import { containerServing, restoreDatabase } from "./restore";
import { seedOneItemInTwoOrderings } from "./seed";
import { buildTestDatabase } from "./testing/build-database";

/**
 * CNCORE-168. The Owner's curation exists nowhere but one volume, and a
 * worktree that wants real data restores a COPY of it rather than pointing at
 * the catalogue itself. ADR-0048 is the record this rehearses.
 *
 * EVERY DUMP HERE IS TAKEN THE WAY THE OWNER'S IS: `pg_dump -Fc` inside the
 * container serving the database, so the archive is written by the server's
 * own major. That is the only contract between the job that dumps (which lives
 * outside this repository) and the restore (which lives in it).
 */

/** A custom-format dump of the database a URL names, on disk. */
async function dumpOf(url: string): Promise<string> {
  const { username, pathname } = new URL(url);
  const directory = await mkdtemp(join(tmpdir(), "canoncore-dump-"));
  onTestFinished(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "catalogue.dump");
  const out = openSync(file, "w");
  try {
    const dumped = spawnSync(
      "docker",
      [
        "exec",
        containerServing(url),
        "pg_dump",
        "--format=custom",
        "--username",
        decodeURIComponent(username),
        "--dbname",
        decodeURIComponent(pathname.slice(1)),
      ],
      { stdio: ["ignore", out, "pipe"] },
    );
    if (dumped.status !== 0) throw new Error(`pg_dump failed: ${dumped.stderr}`);
  } finally {
    closeSync(out);
  }
  return file;
}

/** The server a database URL is on, as `restoreDatabase` takes it. */
function serverOf(url: string): string {
  const server = new URL(url);
  server.pathname = "/postgres";
  return server.toString();
}

function databaseNameOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

/** What a catalogue holds, read through the package's own schema. */
async function catalogueAt(url: string) {
  const db = createDb(url);
  try {
    return {
      owners: await db.select({ id: owners.id }).from(owners),
      items: await db
        .select({ id: items.id, title: items.title })
        .from(items)
        .orderBy(asc(items.id)),
      placements: await db
        .select({
          id: placements.id,
          containerId: placements.containerId,
          itemId: placements.itemId,
          position: placements.position,
        })
        .from(placements)
        .orderBy(asc(placements.id)),
    };
  } finally {
    await db.$client.end();
  }
}

/** How many rungs a database's own ledger says it has run. */
async function rungsAppliedTo(url: string): Promise<number> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ count: string }>(
      "select count(*) from drizzle.__drizzle_migrations",
    );
    return Number(rows[0]?.count);
  } finally {
    await client.end();
  }
}

/**
 * This ladder with its head rung taken off, which is what an install behind
 * this branch is running. The Owner's own was two migrations behind `main` the
 * day this was written: its ledger stopped at migration 18 while `main` held 20.
 */
async function theLadderBelowItsHead(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "canoncore-restore-"));
  onTestFinished(() => rm(directory, { recursive: true, force: true }));
  const folder = join(directory, "migrations");
  await cp(migrationsFolder, folder, { recursive: true });
  const entries = await readJournal(folder);
  await writeFile(
    join(folder, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "postgresql", entries: entries.slice(0, -1) }),
  );
  return folder;
}

/** Whether the server a URL is on holds a database of this name at all. */
async function databaseExists(url: string): Promise<boolean> {
  const client = new Client({ connectionString: serverOf(url) });
  await client.connect();
  try {
    const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [
      databaseNameOf(url),
    ]);
    return rowCount !== 0;
  } finally {
    await client.end();
  }
}

describe("restoring a dump into a database of its own", () => {
  it("holds the dumped catalogue, under the dumped Owner rather than one of its own", async () => {
    const source = await buildTestDatabase("dump");
    await seedOneItemInTwoOrderings(source);
    const dump = await dumpOf(source);

    // THE TARGET ALREADY EXISTS AND HAS AN OWNER OF ITS OWN, because migration 1
    // generates one per database. That is the case ADR-0048 decides: the copy is
    // CREATED FROM the dump and inherits its owner id, rather than receiving the
    // dump into an instance that already had one.
    const target = await buildTestDatabase("copy");
    const before = await catalogueAt(target);
    const wanted = await catalogueAt(source);
    expect(before.owners).not.toEqual(wanted.owners);

    await restoreDatabase({ serverUrl: serverOf(target), database: databaseNameOf(target), dump });

    const copy = await catalogueAt(target);
    expect(copy.owners).toEqual(wanted.owners);
    expect(copy.items).toEqual(wanted.items);
    expect(copy.items.map((item) => item.title)).toContain("The Daleks' Master Plan");
    expect(copy.placements).toEqual(wanted.placements);
    expect(copy.placements.map((placement) => placement.position)).toEqual(
      expect.arrayContaining([1, 63]),
    );
  });

  it("carries a dump taken on an older ladder up to this worktree's head", async () => {
    const source = await buildTestDatabase("dump", await theLadderBelowItsHead());
    await seedOneItemInTwoOrderings(source);
    const dump = await dumpOf(source);
    const target = await buildTestDatabase("copy");

    const restored = await restoreDatabase({
      serverUrl: serverOf(target),
      database: databaseNameOf(target),
      dump,
    });

    const ladder = await readJournal(migrationsFolder);
    expect(restored.ladder).toEqual({ dumped: ladder.at(-2)?.tag, head: ladder.at(-1)?.tag });
    expect(await rungsAppliedTo(target)).toBe(ladder.length);
    expect((await catalogueAt(target)).items.map((item) => item.title)).toContain(
      "The Daleks' Master Plan",
    );
  });

  it("refuses a dump that has run a rung this ladder does not hold, and leaves no copy", async () => {
    // AN INSTALL AHEAD OF THIS BRANCH: its ledger has run a rung that is not in
    // this worktree's journal. Migrating it forward is not a thing this ladder
    // can do, and serving it would put code on a schema it has never seen.
    const source = await buildTestDatabase("dump");
    const ahead = new Client({ connectionString: source });
    await ahead.connect();
    try {
      await ahead.query(
        `insert into drizzle.__drizzle_migrations (hash, created_at)
         select 'a rung from a later ladder', max(created_at) + 1 from drizzle.__drizzle_migrations`,
      );
    } finally {
      await ahead.end();
    }
    const dump = await dumpOf(source);
    const target = await buildTestDatabase("copy");

    await expect(
      restoreDatabase({ serverUrl: serverOf(target), database: databaseNameOf(target), dump }),
    ).rejects.toThrow(/no longer in the ladder/);
    expect(await databaseExists(target)).toBe(false);
  });

  it("reads a dump on disk and nothing else, refusing a connection before it touches anything", async () => {
    // A COPY IS THE ONLY THING A WORKTREE READS (CNCORE-168). Handed the address
    // of a catalogue rather than a dump of one, the restore refuses -- and it
    // refuses FIRST, so the database it was about to replace is still there.
    const target = await buildTestDatabase("copy");
    const before = await catalogueAt(target);

    for (const notADump of ["postgresql://canoncore@localhost:5432/canoncore", tmpdir()]) {
      await expect(
        restoreDatabase({
          serverUrl: serverOf(target),
          database: databaseNameOf(target),
          dump: notADump,
        }),
      ).rejects.toThrow(/not a dump on disk/);
    }
    expect(await catalogueAt(target)).toEqual(before);
  });

  it("refuses a server on another machine, whose container it could not be running in", async () => {
    // `pg_restore` runs inside the container PUBLISHING the port, found on this
    // machine. A server elsewhere would have its database dropped and created
    // over the wire while a local container on the same port restored into
    // something else entirely.
    const target = await buildTestDatabase("copy");
    const elsewhere = new URL(serverOf(target));
    elsewhere.hostname = "catalogue.example.invalid";

    await expect(
      restoreDatabase({
        serverUrl: elsewhere.toString(),
        database: databaseNameOf(target),
        dump: await dumpOf(target),
      }),
    ).rejects.toThrow(/not on this machine/);
  });

  it("reads a file back whole before it drops anything, refusing one that is not a whole dump", async () => {
    // THE DROP IS THE EXPENSIVE STEP, so nothing is dropped for a file that
    // cannot become the copy: a mistyped path to some other file, or a dump
    // cut short -- which `pg_restore --list` passes, because it reads only the
    // table of contents at the front of the archive.
    const target = await buildTestDatabase("copy");
    const before = await catalogueAt(target);
    const whole = await readFile(await dumpOf(target));
    const directory = await mkdtemp(join(tmpdir(), "canoncore-not-a-dump-"));
    onTestFinished(() => rm(directory, { recursive: true, force: true }));
    const notADump = join(directory, "notes.txt");
    await writeFile(notADump, "this is not an archive\n");
    const cutShort = join(directory, "cut-short.dump");
    await writeFile(cutShort, whole.subarray(0, Math.floor(whole.length / 2)));

    for (const dump of [notADump, cutShort]) {
      await expect(
        restoreDatabase({ serverUrl: serverOf(target), database: databaseNameOf(target), dump }),
      ).rejects.toThrow(/not a dump on disk/);
    }
    expect(await catalogueAt(target)).toEqual(before);
  });

  it("refuses a database name that is not a plain identifier, before it touches anything", async () => {
    // `pg_restore --dbname` reads a value holding `=` or a URI prefix as a
    // CONNECTION STRING, so a name is held to what `worktreeDatabaseName`
    // produces rather than trusted to arrive that way.
    const target = await buildTestDatabase("copy");
    const before = await catalogueAt(target);

    for (const database of [`${databaseNameOf(target)} host=elsewhere`, "postgresql://x/y", ""]) {
      await expect(
        restoreDatabase({ serverUrl: serverOf(target), database, dump: await dumpOf(target) }),
      ).rejects.toThrow(/not a database this restore will name/);
    }
    expect(await catalogueAt(target)).toEqual(before);
  });
});
