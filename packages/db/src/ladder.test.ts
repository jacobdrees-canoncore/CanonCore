import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import type { Database } from "./index";
import {
  type AppliedRung,
  checkAppliedRungsAreFrozen,
  checkJournalIsAppendOnly,
  readJournal,
} from "./ladder";
import { migrationsFolder } from "./migrate";
import { connect } from "./testing/catalogue";

/**
 * ADR-0047. Drizzle applies migrations by HIGH-WATER MARK, not set membership:
 * it reads `when` from the journal and selects `order by created_at desc limit
 * 1`. A rung inserted below that mark is SILENTLY SKIPPED and the run reports
 * success -- demonstrated against real Postgres, where one migration folder
 * produced two different schemas on two databases, both green.
 *
 * And it never reads back the SHA-256 it stores, so a rung edited after it
 * shipped passes silently too.
 *
 * These are the two checks the runner lacks. They read the same ledger table
 * and run in one pass, which is what the record asks for.
 */
let db: Database;

/**
 * Drizzle's ledger. `ladder.ts` takes a reader rather than a database handle so
 * that it imports nothing but Node builtins, which is what lets the CI script
 * run it under bare `node` with no loader.
 */
const applied = () => async () =>
  (
    await db.execute<AppliedRung>(
      sql`select "hash", "created_at" from "drizzle"."__drizzle_migrations" order by "created_at"`,
    )
  ).rows;

beforeAll(async () => {
  db = await connect();
});

const rung = (when: number, tag: string) => ({ when, tag });

describe("the journal is append-only at the head", () => {
  it("accepts rungs whose times strictly increase", () => {
    expect(
      checkJournalIsAppendOnly([rung(1000, "a"), rung(2000, "b"), rung(3000, "c")]),
    ).toStrictEqual([]);
  });

  it("catches a rung spliced in below the high-water mark", () => {
    // The exact shape that goes green on an empty database and is skipped
    // forever on a populated one.
    const problems = checkJournalIsAppendOnly([
      rung(1000, "a"),
      rung(3000, "c"),
      rung(2000, "spliced_in_underneath"),
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/spliced_in_underneath/);
  });

  it("catches two rungs sharing an ordering key", () => {
    const problems = checkJournalIsAppendOnly([rung(1000, "a"), rung(1000, "b")]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/undecidable/);
  });

  it("catches two journal entries naming one file", () => {
    // The `timestamp` prefix is UTC at one-second granularity, so two rungs
    // generated inside one second get the same filename and one overwrites the
    // other on disk. Different `when` values, so the ordering check is happy.
    const problems = checkJournalIsAppendOnly([
      rung(1000, "20260910145304_same_second"),
      rung(1400, "20260910145304_same_second"),
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/appears twice/);
  });

  it("passes this repository's own ladder", async () => {
    expect(checkJournalIsAppendOnly(await readJournal(migrationsFolder))).toStrictEqual([]);
  });
});

describe("a rung that has shipped is frozen", () => {
  it("finds nothing wrong with the ladder that built this database", async () => {
    expect(await checkAppliedRungsAreFrozen(applied(), migrationsFolder)).toStrictEqual([]);
  });

  it("catches a rung edited after it was applied", async () => {
    // Drizzle writes this SHA-256 and never reads it back, unlike Flyway. The
    // data is already there; nothing checks it.
    const folder = join(await mkdtemp(join(tmpdir(), "canoncore-ladder-")), "migrations");
    await cp(migrationsFolder, folder, { recursive: true });
    const [first] = await readJournal(folder);
    const edited = join(folder, `${first!.tag}.sql`);
    await writeFile(edited, `${await readFile(edited, "utf8")}\n-- a later hand\n`);

    const problems = await checkAppliedRungsAreFrozen(applied(), folder);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(new RegExp(first!.tag));
  });

  it("catches a rung that a database has run but the ladder no longer holds", async () => {
    const folder = join(await mkdtemp(join(tmpdir(), "canoncore-ladder-")), "migrations");
    await cp(migrationsFolder, folder, { recursive: true });
    const journal = await readJournal(folder);
    await writeFile(
      join(folder, "meta", "_journal.json"),
      JSON.stringify({ version: "7", dialect: "postgresql", entries: journal.slice(0, -1) }),
    );

    const problems = await checkAppliedRungsAreFrozen(applied(), folder);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/no longer in the ladder|has run/);
  });
});
