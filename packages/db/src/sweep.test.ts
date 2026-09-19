import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import { afterEach, describe, expect, inject, it } from "vitest";

import { worktreeDatabaseName } from "./index";
import { holdingSetupLock } from "./setup-worktree";
import { deadDatabases, dropDatabases, type ListedDatabase, ownedDatabases } from "./sweep";

/**
 * What a sweep of the shared container drops, and what it may never touch
 * (CNCORE-231). Names here are real shapes from the container on 2026-09-19.
 */
describe("deadDatabases", () => {
  it("is a removed worktree's database with every test database derived from it", () => {
    const removed = "canoncore_cncore_181_scope_in_a_link_a604650f";
    const family = [removed, `${removed}_test`, `${removed}_test_api`, `${removed}_test_web`];

    expect(deadDatabases(family.map(aDayOld), ["canoncore_main_0d6e4079"])).toEqual(family);
  });

  it("is never a live worktree's database or anything derived from it", () => {
    const live = "canoncore_main_0d6e4079";
    const family = [live, `${live}_test`, `${live}_test_gone`, `${live}_test_tasks`];

    expect(deadDatabases(family.map(aDayOld), [live])).toEqual([]);
  });

  it("includes tails no suffix declares any more, which only a removed branch still has", () => {
    // `_test_test_gone` is the doubled tail CNCORE-150 took out, and
    // `_test_purgeable` the suffix CNCORE-93 shortened. Nothing derives either
    // now, so the suffix lists cannot be what decides what a sweep may drop.
    const removed = "canoncore_cncore_47_properties_validation_3c1f0a9e";
    const tails = [`${removed}_test_test_gone`, `${removed}_test_purgeable`];

    expect(deadDatabases(tails.map(aDayOld), [])).toEqual(tails);
  });

  it("is never a database this repository did not name after a branch", () => {
    // The server's own, the container's POSTGRES_DB, the family CI's name
    // derives, and databases agents built by hand with a DATABASE_URL of their
    // own choosing. `worktreeDatabaseName` never produced any of them, so no
    // worktree's absence says anything about whether they are wanted.
    const notNamedAfterABranch = [
      "postgres",
      "template0",
      "template1",
      "canoncore",
      "canoncore_test",
      "canoncore_test_web",
      "cncore8_upgrade",
      "cncore63_probe",
      "cncore202_test_rung",
    ];

    expect(deadDatabases(notNamedAfterABranch.map(aDayOld), [])).toEqual([]);
  });

  it("is never a database younger than an hour, which may be a setup still in flight", () => {
    // `setup-worktree.test.ts` builds `canoncore_db_setup_under_test_…` and
    // reads it back across tests with no worktree owning it, and a worktree
    // being made has a database before `git worktree list` can be relied on to
    // show it. `git gc` prunes only objects older than `gc.pruneExpire` for the
    // same reason: a sweep must not race what is still being made.
    const inFlight = worktreeDatabaseName("reviewer/db-setup-under-test");

    expect(
      deadDatabases(
        [
          { name: inFlight, ageInSeconds: 59 * 60 },
          { name: `${inFlight}_test`, ageInSeconds: 61 * 60 },
        ],
        [],
      ),
    ).toEqual([`${inFlight}_test`]);
  });

  it("is never a database whose age could not be read", () => {
    const removed = "canoncore_cncore_181_scope_in_a_link_a604650f";

    expect(deadDatabases([{ name: removed, ageInSeconds: null }], [])).toEqual([]);
  });
});

/** A database listed a day after it was made, which no grace period covers. */
function aDayOld(name: string): ListedDatabase {
  return { name, ageInSeconds: 24 * 60 * 60 };
}

/**
 * Who owns what, read from a throwaway repository with a real linked worktree
 * rather than from this one, whose worktrees are whatever is running today.
 */
describe("ownedDatabases", () => {
  it("is the database each worktree's branch names, the main checkout's included", () => {
    const { main } = repositoryWithAWorktree("reviewer/sweep-linked");

    const owned = ownedDatabases(main);

    expect(owned).toContain(worktreeDatabaseName("trunk"));
    expect(owned).toContain(worktreeDatabaseName("reviewer/sweep-linked"));
  });

  it("is also the database a worktree's .env names, which a renamed branch no longer derives", () => {
    // `db:setup` never overwrites `.env`, so after `git branch -m` a worktree
    // goes on using the database its OLD branch named -- and that is the one its
    // suites derive their own from. The branch alone would call it dead.
    const { linked } = repositoryWithAWorktree("reviewer/sweep-renamed");
    git(linked, "branch", "-m", "reviewer/sweep-renamed-since");
    const named = worktreeDatabaseName("reviewer/sweep-renamed");
    mkdirSync(join(linked, "apps", "web"), { recursive: true });
    writeFileSync(
      join(linked, "apps", "web", ".env"),
      `DATABASE_URL=postgresql://postgres:password@localhost:55432/${named}\n`,
    );

    expect(ownedDatabases(linked)).toContain(named);
  });

  it("reads a .env the way the app does, quoted, exported or commented", () => {
    // The app and the suites read `.env` through dotenv. A reading of it that
    // disagrees loses an owner the worktree still has, and what the sweep does
    // with a lost owner is drop its database.
    const written = [
      'DATABASE_URL="postgresql://postgres@localhost:55432/canoncore_quoted_0123abcd"',
      "export DATABASE_URL=postgresql://postgres@localhost:55432/canoncore_exported_0123abcd",
      "DATABASE_URL=postgresql://postgres@localhost:55432/canoncore_commented_0123abcd # mine",
    ];
    const owned = written.map((line, n) => {
      const { linked } = repositoryWithAWorktree(`reviewer/sweep-env-${n}`);
      mkdirSync(join(linked, "apps", "web"), { recursive: true });
      writeFileSync(join(linked, "apps", "web", ".env"), `${line}\n`);
      return ownedDatabases(linked);
    });

    expect(owned[0]).toContain("canoncore_quoted_0123abcd");
    expect(owned[1]).toContain("canoncore_exported_0123abcd");
    expect(owned[2]).toContain("canoncore_commented_0123abcd");
  });

  it("is nothing of a worktree once it is removed, though its branch may live on", () => {
    // `orca worktree rm` keeps a branch it cannot prove merged, so a surviving
    // BRANCH says nothing; only a checkout reaches a database.
    const { main, linked } = repositoryWithAWorktree("reviewer/sweep-removed");
    git(main, "worktree", "remove", linked);

    expect(ownedDatabases(main)).not.toContain(worktreeDatabaseName("reviewer/sweep-removed"));
  });
});

/**
 * Dropping, against the real container. EVERY PROBE IS NAMED OFF THIS SUITE'S
 * OWN RUN DATABASE, which puts it in this worktree's family: a `db:setup` in
 * another worktree sweeping at the same moment leaves it alone, and it fits
 * the 63 bytes on the longest branch (52 + `_test` + `_swpN`).
 */
describe("dropDatabases", () => {
  const run = new URL(inject("databaseUrl"));
  const serverUrl = Object.assign(new URL(run), { pathname: "/postgres" }).toString();
  const probe = (n: number) => `${decodeURIComponent(run.pathname.slice(1))}_swp${n}`;
  const quoted = `${decodeURIComponent(run.pathname.slice(1))}_sw"q`;

  afterEach(async () => {
    await admin((client) =>
      Promise.all(
        [probe(1), probe(2), probe(3), quoted].map((database) =>
          client.query(`drop database if exists "${database.replaceAll('"', '""')}" with (force)`),
        ),
      ),
    );
  });

  it("drops each database it is handed that nobody is using", async () => {
    await create(probe(1), probe(2));

    const swept = await dropDatabases(serverUrl, [probe(1), probe(2)], () => true);

    expect(swept).toEqual({ dropped: [probe(1), probe(2)], inUse: [] });
    expect(await existing(probe(1), probe(2))).toEqual([]);
  });

  it("reports only what it dropped, not a database another sweep took first", async () => {
    // Two worktrees running `db:setup` at once meet on the same names, one at a
    // time under the lock, and the second finds each already gone.
    await create(probe(1));

    const swept = await dropDatabases(serverUrl, [probe(1), probe(2)], () => true);

    expect(swept).toEqual({ dropped: [probe(1)], inUse: [] });
  });

  it("drops a name carrying a double quote as that name, rather than as SQL", async () => {
    // The names come from `pg_database`, which holds whatever anybody created.
    // Only the caller's filter keeps them to [a-z0-9_] today, and the guard
    // belongs at the point of destruction, where `build-database.ts` keeps its
    // own, rather than one call away from it.
    await admin((client) => client.query(`create database "${quoted.replaceAll('"', '""')}"`));

    const swept = await dropDatabases(serverUrl, [quoted], () => true);

    expect(swept).toEqual({ dropped: [quoted], inUse: [] });
    expect(await existing(quoted)).toEqual([]);
  });

  it("leaves a database somebody is connected to, and says so", async () => {
    // Never `with (force)`. Nothing a live worktree reaches is ever handed
    // over, so a connection to a dead one is a leaked server or a person with
    // psql open -- worth naming, and not this sweep's to terminate.
    await create(probe(1), probe(2));
    const holding = new Client({
      connectionString: Object.assign(new URL(run), { pathname: `/${probe(1)}` }).toString(),
    });
    await holding.connect();

    try {
      const swept = await dropDatabases(serverUrl, [probe(1), probe(2)], () => true);

      expect(swept).toEqual({ dropped: [probe(2)], inUse: [probe(1)] });
      expect(await existing(probe(1), probe(2))).toEqual([probe(1)]);
    } finally {
      await holding.end();
    }
  });

  it("leaves a database a worktree claimed while the sweep waited on db:setup's lock", async () => {
    // A re-dispatched ticket reuses its branch, so a new worktree's setup can
    // find the old database still there and adopt it -- between a sweep
    // reading the worktrees and dropping. `db:setup` holds this lock across
    // everything it does to a database, so asking again INSIDE it is what
    // closes that window.
    await create(probe(1));
    let claimed = false;
    let lockTaken!: () => void;
    const taken = new Promise<void>((resolve) => {
      lockTaken = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const setup = holdingSetupLock(serverUrl, probe(1), async () => {
      lockTaken();
      await released;
      claimed = true;
    });
    await taken;

    const sweeping = dropDatabases(serverUrl, [probe(1)], () => !claimed);
    await somebodyWaitingOnAnAdvisoryLock();
    release();
    await setup;

    expect(await sweeping).toEqual({ dropped: [], inUse: [] });
    expect(await existing(probe(1))).toEqual([probe(1)]);
  });

  /** Until a backend is queued behind an advisory lock another one holds. */
  async function somebodyWaitingOnAnAdvisoryLock(): Promise<void> {
    for (;;) {
      const { rowCount } = await admin((client) =>
        client.query(
          `select 1 from pg_locks waiting
             join pg_locks holding using (locktype, classid, objid, objsubid)
            where locktype = 'advisory' and not waiting.granted and holding.granted`,
        ),
      );
      if (rowCount !== 0) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  async function create(...databases: string[]): Promise<void> {
    await admin(async (client) => {
      for (const database of databases) await client.query(`create database "${database}"`);
    });
  }

  async function existing(...databases: string[]): Promise<string[]> {
    return admin(async (client) =>
      (
        await client.query<{ datname: string }>(
          "select datname from pg_database where datname = any($1) order by datname",
          [databases],
        )
      ).rows.map((row) => row.datname),
    );
  }

  async function admin<T>(work: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: serverUrl });
    await client.connect();
    try {
      return await work(client);
    } finally {
      await client.end();
    }
  }
});

/** A repository on `trunk` with one linked worktree on `branch`. */
function repositoryWithAWorktree(branch: string): { main: string; linked: string } {
  const root = mkdtempSync(join(tmpdir(), "canoncore-sweep-"));
  const main = join(root, "main");
  const linked = join(root, "linked");
  mkdirSync(main);
  git(main, "init", "--quiet", "--initial-branch", "trunk");
  git(main, "commit", "--quiet", "--allow-empty", "--message", "empty");
  git(main, "worktree", "add", "--quiet", "-b", branch, linked);
  return { main, linked };
}

function git(cwd: string, ...args: string[]): void {
  execFileSync(
    "git",
    ["-c", "user.name=Sweep", "-c", "user.email=sweep@example.invalid", ...args],
    { cwd, stdio: "ignore" },
  );
}
