import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it, onTestFinished } from "vitest";

import { worktreeDatabaseName } from "./index";
import { setUpWorktreeDatabase } from "./setup-worktree";

/**
 * `pnpm db:setup` end to end, against the real container: it creates this
 * worktree's database, runs the whole ladder against it, seeds one item, and
 * writes `apps/web/.env`. One command in a fresh worktree.
 *
 * Driven through the package export rather than by spawning the script, so the
 * script stays a thin CLI over something the suite can actually reach.
 */
const branch = "reviewer/db-setup-under-test";
const database = worktreeDatabaseName(branch);
let serverUrl: string;
let envFile: string;
/** The directory holding `envFile`, kept so the `afterAll` below can remove it. */
let envDirectory: string;

beforeAll(async () => {
  const url = new URL(inject("databaseUrl"));
  url.pathname = "/postgres";
  serverUrl = url.toString();
  envDirectory = await mkdtemp(join(tmpdir(), "canoncore-setup-"));
  envFile = join(envDirectory, ".env");
});

afterAll(async () => {
  await rm(envDirectory, { recursive: true, force: true });
  const admin = new Client({ connectionString: serverUrl });
  await admin.connect();
  try {
    await admin.query(`drop database if exists "${database}" with (force)`);
  } finally {
    await admin.end();
  }
});

describe("setUpWorktreeDatabase", () => {
  it("creates the branch's database, migrates it, seeds it and writes .env", async () => {
    const result = await setUpWorktreeDatabase({ serverUrl, branch, envFile });

    expect(result.database).toBe(database);
    expect(result.created).toBe(true);
    expect(result.envWritten).toBe(true);
    // A title on the seeded item proves the LADDER ran, not just the insert:
    // the column is projected by a trigger that only migration 1 installs.
    expect(result.seeded?.projectedTitle).toBe("The Daleks' Master Plan");
    expect(await readFile(envFile, "utf8")).toContain(`/${database}`);
  });

  it("is safe to run again: it creates nothing, seeds nothing, drops nothing", async () => {
    // The command a fresh worktree runs is the command someone will run twice.
    // It must never be the one that wipes the database they were working in.
    const before = await itemCount();

    const again = await setUpWorktreeDatabase({ serverUrl, branch, envFile });

    expect(again.created).toBe(false);
    expect(again.seeded).toBeUndefined();
    expect(await itemCount()).toBe(before);
  });

  it("never overwrites a .env that already exists", async () => {
    // .env is the developer's own machine state and may point somewhere they
    // chose. Being wrong in this direction costs them their configuration;
    // being wrong the other way costs them running the command again.
    const directory = await mkdtemp(join(tmpdir(), "canoncore-setup-"));
    onTestFinished(() => rm(directory, { recursive: true, force: true }));
    const theirs = join(directory, ".env");
    await writeFile(theirs, "DATABASE_URL=postgresql://somewhere/they/chose\n");

    const result = await setUpWorktreeDatabase({ serverUrl, branch, envFile: theirs });

    expect(result.envWritten).toBe(false);
    expect(await readFile(theirs, "utf8")).toBe("DATABASE_URL=postgresql://somewhere/they/chose\n");
  });

  it("says whether the .env it left alone actually points at this database", async () => {
    // The trap this closes: a .env copied from an example names one shared
    // database, so setup leaves it alone, reports success, and the worktree
    // quietly goes on using the database every other worktree uses -- which is
    // the failure the whole change exists to end.
    const elsewhereDirectory = await mkdtemp(join(tmpdir(), "canoncore-setup-"));
    onTestFinished(() => rm(elsewhereDirectory, { recursive: true, force: true }));
    const elsewhere = join(elsewhereDirectory, ".env");
    await writeFile(
      elsewhere,
      "DATABASE_URL=postgresql://postgres@localhost:55432/canoncore_main\n",
    );
    const hereDirectory = await mkdtemp(join(tmpdir(), "canoncore-setup-"));
    onTestFinished(() => rm(hereDirectory, { recursive: true, force: true }));
    const here = join(hereDirectory, ".env");
    await writeFile(here, `DATABASE_URL=postgresql://postgres@localhost:55432/${database}\n`);

    const pointsAway = await setUpWorktreeDatabase({ serverUrl, branch, envFile: elsewhere });
    const pointsHere = await setUpWorktreeDatabase({ serverUrl, branch, envFile: here });

    expect(pointsAway.envNamesThisDatabase).toBe(false);
    expect(pointsHere.envNamesThisDatabase).toBe(true);
  });

  it("survives two setups racing to create the same database", async () => {
    // Check-then-create has a window: both see the database missing, both try
    // to create it, one gets 42P04. Reachable whenever two things run db:setup
    // at once -- an agent and a human, or a shell hook and a terminal.
    const racing = "reviewer/db-setup-raced";
    const raced = worktreeDatabaseName(racing);
    const envFiles = await Promise.all(
      [0, 1].map(async () => {
        const directory = await mkdtemp(join(tmpdir(), "canoncore-race-"));
        onTestFinished(() => rm(directory, { recursive: true, force: true }));
        return join(directory, ".env");
      }),
    );

    try {
      const results = await Promise.all(
        envFiles.map((file) => setUpWorktreeDatabase({ serverUrl, branch: racing, envFile: file })),
      );

      // Exactly one may claim to have created it; neither may throw.
      expect(results.filter((r) => r.created).length).toBeLessThanOrEqual(1);
      expect(results.every((r) => r.database === raced)).toBe(true);
    } finally {
      const admin = new Client({ connectionString: serverUrl });
      await admin.connect();
      try {
        await admin.query(`drop database if exists "${raced}" with (force)`);
      } finally {
        await admin.end();
      }
    }
  });
});

async function itemCount(): Promise<number> {
  const target = new URL(serverUrl);
  target.pathname = `/${database}`;
  const client = new Client({ connectionString: target.toString() });
  await client.connect();
  try {
    return Number((await client.query("select count(*) from items")).rows[0].count);
  } finally {
    await client.end();
  }
}
