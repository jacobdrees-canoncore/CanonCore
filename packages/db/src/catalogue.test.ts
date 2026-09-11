import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { type Database, items, readCatalogue } from "./index";
import { anItem, anItemTitled, aStatement, connect, ownerSource } from "./testing/catalogue";

/** Whether the catalogue lists one particular item. */
async function lists(db: Database, id: string): Promise<boolean> {
  const { entries } = await readCatalogue(db, { limit: 1000 });
  return entries.some((entry) => entry.id === id);
}

let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("readCatalogue", () => {
  it("answers with an item that is in the catalogue", async () => {
    const id = await anItemTitled(db, "A story the catalogue holds");

    const { entries } = await readCatalogue(db, { limit: 100 });

    expect(entries).toContainEqual(
      expect.objectContaining({ id, title: "A story the catalogue holds" }),
    );
  });

  it("leaves out an item that has been deleted", async () => {
    // ADR-0075: a tombstone nothing reads is half a mechanism. A deleted item is
    // gone to every reader, and the catalogue is the widest reader there is.
    const id = await anItemTitled(db, "A story that was deleted");
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, id));

    expect(await lists(db, id)).toBe(false);
  });

  it("orders on the sort name, and on the title where no sort name won", async () => {
    // ADR-0014 gives `sort_name` its own index for exactly this. The two titles
    // sort the OTHER WAY ROUND from the two sort keys, so a list ordered on the
    // title alone -- or on nothing -- fails this rather than passing by luck.
    //
    // WRITTEN IN THE ANSWER'S REVERSE ORDER, which is the half that makes it a
    // test: written the other way round it passed against a query with no
    // `order by` at all, because PostgreSQL handed back a small table in
    // insertion order and insertion order happened to be the right one.
    const genesis = await anItemTitled(db, "Genesis of the Daleks");
    const ark = await anItemTitled(db, "The Ark in Space");
    await aStatement(db, {
      subjectItemId: ark,
      property: "sort_name",
      valueLiteral: "Ark in Space, The",
      sourceId: await ownerSource(db),
    });

    const { entries } = await readCatalogue(db, { limit: 1000 });
    const order = entries.map((entry) => entry.id);

    expect(order.indexOf(ark)).toBeLessThan(order.indexOf(genesis));
  });

  it("counts the whole catalogue even when it answers with only part of it", async () => {
    // NO SILENT CAP. A page showing the first hundred of four thousand has to be
    // able to say so, and a count that only ever reported what it returned would
    // let it claim the hundred WAS the catalogue.
    //
    // MEASURED BY ADDING ONE rather than by counting the table a second way: a
    // second count written here would be this query's own rule restated, and
    // would agree with it however wrong both were.
    const before = await readCatalogue(db, { limit: 1000 });
    await anItemTitled(db, "One more story than there were");

    const after = await readCatalogue(db, { limit: 1 });

    expect(after.entries).toHaveLength(1);
    expect(after.total).toBe(before.total + 1);
  });

  it("says what kind each entry is, and whether it holds other items", async () => {
    // ADR-0005's kinds and ADR-0004's fold, together. A Person and a Work of the
    // same name are two rows a reader has to be able to tell apart (CNCORE-60's
    // story 12), and containers fold INTO `work` -- so the kind alone cannot
    // separate "The Daleks' Master Plan" from an ordering that holds it.
    //
    // THE ASSERTION IS ON THE LABEL RATHER THAN THE KEY, and `Time span` is the
    // pair that makes the difference visible: `CONTEXT.md` is binding on UI
    // copy and calls it that, where the column says `time_span`. Migration 1
    // seeds the label beside the kind, so this is a read of the catalogue's own
    // words rather than a map the app would have to keep in step.
    const person = await anItemTitled(db, "Verity Lambert", { kind: "person" });
    const era = await anItemTitled(db, "The Hartnell era", { kind: "time_span" });
    const ordering = await anItemTitled(db, "An ordering of stories", { isContainer: true });

    const { entries } = await readCatalogue(db, { limit: 1000 });
    const byId = new Map(entries.map((entry) => [entry.id, entry]));

    expect(byId.get(person)).toMatchObject({ kindLabel: "Person", isContainer: false });
    expect(byId.get(era)).toMatchObject({ kindLabel: "Time span" });
    expect(byId.get(ordering)).toMatchObject({ kindLabel: "Work", isContainer: true });
  });
});

describe("readCatalogue, walked a page at a time", () => {
  it("visits every item exactly once, in the order the whole catalogue lists them in", async () => {
    // THE ACCEPTANCE CRITERION ITSELF: no item appears twice and none is
    // skipped. The oracle is the SAME catalogue read in one go, which is what
    // makes this an assertion rather than a restatement -- the walk and the
    // single read are two different code paths, and the un-paged order is the
    // one this file already holds to `sort_name`, then the title, then the id.
    await anItemTitled(db, "A story a walk has to pass through");

    const whole = await readCatalogue(db, { limit: 10_000 });

    expect(await walk(db, 3)).toStrictEqual(whole.entries.map((entry) => entry.id));
  });

  it("points at the next page only where there is one, and never at an empty one", async () => {
    // THE STOP CONDITION. Without it a walk either ends one page early -- the
    // reader never reaching the tail -- or offers a link to nothing, which is
    // the same dead end with an extra click in front of it.
    //
    // MEASURED AGAINST THE WHOLE CATALOGUE'S SIZE rather than against a number
    // written here, because this database is shared and its size is whatever
    // the files before this one left behind.
    const { total } = await readCatalogue(db, { limit: 1 });

    const exactly = await readCatalogue(db, { limit: total });
    const oneShort = await readCatalogue(db, { limit: total - 1 });

    // A page holding the whole catalogue is the end of it, even though it is
    // full -- which is the case a "the page came back full, so there is more"
    // rule gets wrong.
    expect(exactly.continuesAfter).toBeNull();
    expect(oneShort.continuesAfter).toBe(oneShort.entries.at(-1)?.id);
    const rest = await readCatalogue(db, { limit: total, after: oneShort.continuesAfter ?? "" });
    expect(rest.entries).toHaveLength(1);
  });

  it("steps from one item to the next where the two sort the same", async () => {
    // THE TIEBREAK, AND IT NEEDS ITS OWN TEST rather than riding on the walk
    // above. Measured: with the id comparison taken out of the cursor, that
    // walk passed on one run and failed on the next -- ids are random, so
    // whether a tied pair happens to straddle a page boundary is luck. A cursor
    // comparing keys alone steps straight over the second of a pair.
    //
    // SO THE PAGE IS CUT EXACTLY AT THE TIE rather than at a size that might
    // land there. The catalogue is read whole to find where the pair sits, and
    // a page asked for that many entries ends on the first of the two.
    const sortsAs = "Dalek Invasion of Earth, The";
    const pair: string[] = [];
    for (const title of ["The Dalek Invasion of Earth", "Doctor Who and the Daleks"]) {
      const id = await anItemTitled(db, title);
      await aStatement(db, {
        subjectItemId: id,
        property: "sort_name",
        valueLiteral: sortsAs,
        sourceId: await ownerSource(db),
      });
      pair.push(id);
    }

    const order = (await readCatalogue(db, { limit: 10_000 })).entries.map((entry) => entry.id);
    const first = Math.min(...pair.map((id) => order.indexOf(id)));
    const cutAtTheTie = await readCatalogue(db, { limit: first + 1 });

    expect(cutAtTheTie.entries.at(-1)?.id).toBe(order[first]);
    const next = await readCatalogue(db, {
      limit: 1,
      after: cutAtTheTie.continuesAfter ?? "",
    });
    // The OTHER half of the pair, which is the item a key-only cursor loses.
    expect(next.entries[0]?.id).toBe(order[first + 1]);
  });

  it("walks on into the items with no sort key at all, and through them", async () => {
    // AN ITEM NOBODY HAS TITLED IS STILL AN ITEM, and it has no sort key at all
    // (ADR-0014 projects both columns from statements, and there is no
    // statement to project). Those sort LAST, so they are the whole tail of the
    // walk -- and a cursor built on a plain row comparison loses every one of
    // them permanently, because `(null, x) > (k, y)` is NULL rather than true.
    //
    // TWO OF THEM, because the tail has two boundaries a cursor can get wrong:
    // stepping INTO it from an item that has a key, and stepping THROUGH it
    // from one that has none.
    await anItem(db);
    await anItem(db);

    // NOT "the ones with no title", which is what the first draft of this asked
    // and is a different set: an item carrying a `sort_name` and no title has a
    // key and sorts among the keyed ones, and this database holds several. The
    // key is `coalesce(sort_name, title)`, so the tail is where BOTH are absent.
    const keyless = new Set(
      (
        await db
          .select({ id: items.id })
          .from(items)
          .where(and(isNull(items.sortName), isNull(items.title), isNull(items.deletedAt)))
      ).map((row) => row.id),
    );
    const order = (await readCatalogue(db, { limit: 10_000 })).entries.map((entry) => entry.id);
    const tail = order.findIndex((id) => keyless.has(id));
    // THE TAIL IS ONE BLOCK AT THE END, which is what makes the two cuts below
    // land on the boundaries this test is named for rather than mid-order.
    expect(order.slice(tail).every((id) => keyless.has(id))).toBe(true);

    const upToTheTail = await readCatalogue(db, { limit: tail });
    const into = await readCatalogue(db, { limit: 1, after: upToTheTail.continuesAfter ?? "" });
    expect(into.entries[0]?.id).toBe(order[tail]);

    const oneIntoTheTail = await readCatalogue(db, { limit: tail + 1 });
    const through = await readCatalogue(db, {
      limit: 1,
      after: oneIntoTheTail.continuesAfter ?? "",
    });
    expect(through.entries[0]?.id).toBe(order[tail + 1]);
  });
});

/**
 * Every item the catalogue holds, reached a page at a time.
 *
 * A PAGE OF THREE rather than of a hundred, so the walk is many pages long
 * against a shared test database holding a few dozen items. How big a page is
 * belongs to the caller, which is what lets this ask for a small one.
 *
 * IT IS BOUNDED, and the bound is what makes a broken walk a FAILURE rather
 * than a hang: a cursor that does not advance repeats its first page forever,
 * and a test that only ever times out on it says nothing about what went wrong.
 */
async function walk(db: Database, pageSize: number): Promise<string[]> {
  const walked: string[] = [];
  let after: string | undefined;
  const { total } = await readCatalogue(db, { limit: 1 });
  for (let pages = 0; pages <= total; pages += 1) {
    const page = await readCatalogue(db, { limit: pageSize, after });
    if (page.entries.length === 0) return walked;
    walked.push(...page.entries.map((entry) => entry.id));
    after = page.entries.at(-1)?.id;
  }
  throw new Error(`the walk did not end after ${total} pages of ${pageSize}`);
}
