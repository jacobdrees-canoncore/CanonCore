import { cp, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  createDb,
  type Database,
  properties,
  retitleItemByHand,
  sources,
  statements,
} from "./index";
import { readJournal } from "./ladder";
import { migrateToHead, migrationsFolder } from "./migrate";
import { buildTestDatabase } from "./testing/build-database";
import { anItemTitled, aStatement, connect, ownerSource, readItem } from "./testing/catalogue";

/**
 * CNCORE-173. Nothing in this product ever asserted a sort name, so every
 * Listing fell through to the raw title and `The Daleks' Master Plan` filed
 * under T.
 *
 * A SORT NAME IS A STATEMENT LIKE ANY OTHER, which is what ADR-0071 buys: the
 * computation is a SOURCE, it names its own version, and it competes in the one
 * global source order rather than sitting in a column nobody can dispute. So
 * every test here writes a statement and reads statements back, and the
 * projected column is checked as the consequence rather than as the mechanism.
 */
let db: Database;

beforeAll(async () => {
  db = await connect();
});

/** Every live `sort_name` statement about one item, best-placed first. */
async function sortNamesOf(db: Database, itemId: string) {
  return db
    .select({
      value: statements.valueLiteral,
      sourceKind: sources.kind,
      sourceIdentity: sources.identity,
    })
    .from(statements)
    .innerJoin(properties, eq(properties.id, statements.propertyId))
    .innerJoin(sources, eq(sources.id, statements.sourceId))
    .where(
      and(
        eq(statements.subjectItemId, itemId),
        eq(properties.name, "sort_name"),
        isNull(statements.deletedAt),
      ),
    )
    .orderBy(sources.sourceOrder);
}

/** The one live `title` statement an `anItemTitled` fixture wrote. */
async function theTitleStatementOf(db: Database, itemId: string): Promise<string> {
  const [found] = await db
    .select({ id: statements.id })
    .from(statements)
    .innerJoin(properties, eq(properties.id, statements.propertyId))
    .where(
      and(
        eq(statements.subjectItemId, itemId),
        eq(properties.name, "title"),
        isNull(statements.deletedAt),
      ),
    );
  if (!found) throw new Error("the fixture wrote no live title statement");
  return found.id;
}

describe("the derived sort name", () => {
  it("files itself as a derived source naming its computation and its version", async () => {
    // ADR-0071: `derived` names the computation AND ITS VERSION --
    // `derived:palette-v2`, never a bare `derived` -- because invalidating a
    // computed claim when the algorithm changes is the only operation ever
    // performed on one, and a flag cannot answer "which rows does the new
    // extractor invalidate?".
    const item = await anItemTitled(db, "The Daleks' Master Plan");

    expect(await sortNamesOf(db, item)).toEqual([
      {
        value: "Daleks' Master Plan",
        sourceKind: "derived",
        sourceIdentity: "derived:sort-name-v1",
      },
    ]);
  });

  it("loses to the Owner's own, and goes on standing beside it", async () => {
    // ADR-0025's whole point, on the second projected column. The owner sits at
    // `source_order` 0 and the computation was allocated behind them, so this
    // needs no rank set -- and the computed claim is STILL THERE, because a
    // source may only withdraw what it said itself (ADR-0075). An owner who
    // disagrees with the computation does not delete it.
    const item = await anItemTitled(db, "The Daleks' Master Plan");

    await aStatement(db, {
      subjectItemId: item,
      property: "sort_name",
      valueLiteral: "Dalek Masterplan",
      sourceId: await ownerSource(db),
    });

    expect((await readItem(db, item))?.sortName).toBe("Dalek Masterplan");
    expect(await sortNamesOf(db, item)).toEqual([
      { value: "Dalek Masterplan", sourceKind: "owner", sourceIdentity: "owner" },
      {
        value: "Daleks' Master Plan",
        sourceKind: "derived",
        sourceIdentity: "derived:sort-name-v1",
      },
    ]);
  });

  it("follows the title it was computed from when the Owner retitles the item", async () => {
    // THE COMPUTATION IS A FUNCTION OF THE WINNING TITLE, so a title that moves
    // takes the sort name with it. A derived value left standing over a title
    // nobody claims any more would file the item under a word the page does not
    // say -- and `retitleItemByHand` is the write path an owner actually uses.
    const item = await anItemTitled(db, "The Daleks' Master Plan");

    await retitleItemByHand(db, { itemId: item, title: "An Unearthly Child" });

    // ONE ROW, NOT TWO. The old value is withdrawn rather than left beside the
    // new one: a source competing with itself ties on rank and source order and
    // falls through to a random uuid, which is `claims.ts`'s own argument.
    expect(await sortNamesOf(db, item)).toEqual([
      { value: "Unearthly Child", sourceKind: "derived", sourceIdentity: "derived:sort-name-v1" },
    ]);
    expect((await readItem(db, item))?.sortName).toBe("Unearthly Child");
  });

  it("is withdrawn with the last title statement, rather than outliving it", async () => {
    // ADR-0003 lets an item exist with nothing said about it, and its heading
    // says "Untitled item" honestly. A sort name left behind would alphabetise
    // it under a word that appears nowhere on its page.
    const item = await anItemTitled(db, "The Tenth Planet");
    expect((await readItem(db, item))?.sortName).toBe("Tenth Planet");

    await db
      .update(statements)
      .set({ deletedAt: new Date() })
      .where(eq(statements.id, await theTitleStatementOf(db, item)));

    expect(await sortNamesOf(db, item)).toEqual([]);
    expect((await readItem(db, item))?.sortName).toBeNull();
  });

  it("files nothing at all for a title that is only whitespace", async () => {
    // FOUND BY REVIEW, AND IT BREAKS THIS RUNG'S OWN GUARANTEE. `btrim` first
    // makes the result non-empty for a title that is nothing but an ARTICLE --
    // `The` keeps its word, because nothing follows it for `\s+` to match --
    // and that argument does not reach a title that is nothing but SPACE, which
    // trims to `''` and stays `''`.
    //
    // AND IT IS REACHABLE FROM OUTSIDE. `cmppRecord` declares a provider's
    // title `z.string().min(1)` with no trim, so `"   "` is a title this
    // catalogue accepts over the wire. An empty sort name is the one value that
    // is WORSE than none: it sorts ahead of the entire catalogue, so one
    // malformed record from one provider would take the top of every Listing.
    //
    // NOTHING is the honest answer rather than the raw title, because there is
    // no word to file such an item under. It then reads as an item with no sort
    // name at all, which `coalesce(sort_name, title)` already knows how to walk.
    const item = await anItemTitled(db, "   ");

    expect(await sortNamesOf(db, item)).toEqual([]);
    expect((await readItem(db, item))?.sortName).toBeNull();
  });
});

/**
 * THE UPGRADE PATH, WHICH IS THE ONE AN EMPTY-TO-HEAD GATE CANNOT SEE.
 *
 * `buildTestDatabase` runs the whole ladder against an empty database, so every
 * item any other test in this file makes is created AFTER the rung that derives
 * its sort name and gets one from the trigger. That proves nothing about the
 * rows an installation ALREADY HELD, which is where this ticket's defect
 * actually lives: seven thousand Items titled before anything computed a sort
 * name. `migrateToHead` takes a folder for exactly this reason.
 */
describe("an install that already had a catalogue", () => {
  it("gives an Item that already existed a sort name rather than leaving it behind", async () => {
    const url = await buildTestDatabase("rung", await theLadderBeforeItsLastRung());
    const upgrading = createDb(url);
    const item = await anItemTitled(upgrading, "The Tenth Planet");

    // THE DEFECT ITSELF, ASSERTED BEFORE IT IS FIXED. Without this line the
    // test would pass against a rung that did nothing, because the item would
    // simply have had a sort name all along.
    expect((await readItem(upgrading, item))?.sortName).toBeNull();

    await migrateToHead(url);

    expect((await readItem(upgrading, item))?.sortName).toBe("Tenth Planet");
  });
});

/**
 * This repository's ladder with its head rung removed, in a folder of its own.
 *
 * TRUNCATING THE JOURNAL IS WHAT REMOVES A RUNG, because the journal is what
 * Drizzle reads -- `ladder.test.ts` removes one the same way, and leaving the
 * `.sql` beside it is harmless for the same reason.
 */
async function theLadderBeforeItsLastRung(): Promise<string> {
  const folder = join(await mkdtemp(join(tmpdir(), "canoncore-sort-name-")), "migrations");
  await cp(migrationsFolder, folder, { recursive: true });
  const entries = await readJournal(folder);
  await writeFile(
    join(folder, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "postgresql", entries: entries.slice(0, -1) }),
  );
  return folder;
}
