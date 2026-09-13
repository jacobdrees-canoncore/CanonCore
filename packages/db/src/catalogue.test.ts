import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { createDb, type Database, items, readCatalogue } from "./index";
import { buildTestDatabase } from "./testing/build-database";
import { anItem, anItemTitled, aStatement, connect, ownerSource } from "./testing/catalogue";

/** Whether the catalogue lists one particular item. */
async function lists(db: Database, id: string): Promise<boolean> {
  const { rows } = await readCatalogue(db, { limit: 1000 });
  return rows.some((row) => row.id === id);
}

let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("readCatalogue", () => {
  it("answers with an item that is in the catalogue", async () => {
    const id = await anItemTitled(db, "A story the catalogue holds");

    const { rows } = await readCatalogue(db, { limit: 100 });

    expect(rows).toContainEqual(
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

    const { rows } = await readCatalogue(db, { limit: 1000 });
    const order = rows.map((row) => row.id);

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

    expect(after.rows).toHaveLength(1);
    expect(after.total).toBe(before.total + 1);
  });

  it("says what kind each row is, and whether it holds other items", async () => {
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

    const { rows } = await readCatalogue(db, { limit: 1000 });
    const byId = new Map(rows.map((row) => [row.id, row]));

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

    expect(await walk(db, 3)).toStrictEqual(whole.rows.map((row) => row.id));
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
    expect(oneShort.continuesAfter).toBe(oneShort.rows.at(-1)?.id);
    const rest = await readCatalogue(db, { limit: total, after: oneShort.continuesAfter ?? "" });
    expect(rest.rows).toHaveLength(1);
  });

  it("reports the size of the catalogue on every page, not of what is left", async () => {
    // A WINDOW COUNT IS TAKEN AFTER `where`, so `count(*) over ()` beside a
    // keyset predicate counts the items PAST THE CURSOR -- and an owner paging
    // through their library would watch it shrink as they read. Measured: with
    // the window count back in place the walk above still passes, so the
    // property needs saying here rather than being assumed from it.
    const first = await readCatalogue(db, { limit: 2 });

    const second = await readCatalogue(db, { limit: 2, after: first.continuesAfter ?? "" });

    expect(second.total).toBe(first.total);
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
    // a page asked for that many rows ends on the first of the two.
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

    const order = (await readCatalogue(db, { limit: 10_000 })).rows.map((row) => row.id);
    const first = Math.min(...pair.map((id) => order.indexOf(id)));
    const cutAtTheTie = await readCatalogue(db, { limit: first + 1 });

    expect(cutAtTheTie.rows.at(-1)?.id).toBe(order[first]);
    const next = await readCatalogue(db, {
      limit: 1,
      after: cutAtTheTie.continuesAfter ?? "",
    });
    // The OTHER half of the pair, which is the item a key-only cursor loses.
    expect(next.rows[0]?.id).toBe(order[first + 1]);
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
    const order = (await readCatalogue(db, { limit: 10_000 })).rows.map((row) => row.id);
    const tail = order.findIndex((id) => keyless.has(id));
    // THE TAIL IS ONE BLOCK AT THE END, which is what makes the two cuts below
    // land on the boundaries this test is named for rather than mid-order.
    expect(order.slice(tail).every((id) => keyless.has(id))).toBe(true);

    const upToTheTail = await readCatalogue(db, { limit: tail });
    const into = await readCatalogue(db, { limit: 1, after: upToTheTail.continuesAfter ?? "" });
    expect(into.rows[0]?.id).toBe(order[tail]);

    const oneIntoTheTail = await readCatalogue(db, { limit: tail + 1 });
    const through = await readCatalogue(db, {
      limit: 1,
      after: oneIntoTheTail.continuesAfter ?? "",
    });
    expect(through.rows[0]?.id).toBe(order[tail + 1]);
  });

  it("starts the catalogue over, where the item a page was cut at has since been deleted", async () => {
    // A DELETED ITEM HAS NO SORT KEY, which is the fact this rests on and it is
    // not obvious. Migration 5 tombstones every statement of a deleted item,
    // that re-fires the projection, and the projection over no live statements
    // is NULL (ADR-0014) -- so `title` and `sort_name` are GONE rather than
    // merely hidden, and the anchor a kept link names has no place left in the
    // order at all.
    //
    // SO IT NAMES NO POSITION, AND THE WALK STARTS AT THE BEGINNING: the answer
    // ADR-0066 already gives an id that names nothing, and the one Catalogue
    // search gives this same fact. A reader following a kept link is shown the
    // catalogue again and can walk it again -- every item still reachable and
    // none skipped, which is the criterion.
    //
    // MEASURED BEFORE THE FIX: the walk read that null as "already among the
    // items with no sort key" and resumed from the UNTITLED TAIL, skipping
    // every titled item between the reader's page and it.
    //
    // THE TAIL IS REACHABLE FROM THE ANCHOR BY CONSTRUCTION, which is what
    // makes this the catalogue that resumes from a tail rather than the one
    // beside it that answers with nothing. That regime is `id > the anchor's`,
    // so the id is chosen rather than drawn: `LAST_ID` is the largest uuid
    // there is of the version `gen_random_uuid` mints, so every anchor's id is
    // below it and the tail is past every one of them.
    await anItem(db, { id: LAST_ID });
    const anchorId = await anItemTitled(db, "A story a kept link was cut at");

    const order = (await readCatalogue(db, { limit: 10_000 })).rows.map((row) => row.id);
    const cut = await readCatalogue(db, { limit: order.indexOf(anchorId) + 1 });
    // THE PAGE ENDS ON THE ANCHOR, so what follows is a cursor a reader was
    // actually handed rather than an id written here.
    expect(cut.continuesAfter).toBe(anchorId);
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, anchorId));

    const kept = await readCatalogue(db, { limit: 10_000, after: cut.continuesAfter ?? "" });

    // THE CATALOGUE OVER AGAIN, oracled against the same catalogue read in one
    // go -- a different code path from the walk, which is what makes this an
    // assertion rather than the walk marking its own work.
    const fromTheStart = await readCatalogue(db, { limit: 10_000 });
    expect(kept.rows.map((row) => row.id)).toStrictEqual(
      fromTheStart.rows.map((row) => row.id),
    );
  });

  it("says so on a catalogue with no untitled tail, which is the shape that reads as an ending", async () => {
    // THE SAME DEFECT'S OTHER FACE, AND THE WORSE ONE. The walk above resumed
    // from the untitled tail, so it answered with rows and skipped the ones
    // between. Where a catalogue has no untitled item at all there is nothing
    // for that regime to find, so page two came back EMPTY -- and an empty page
    // with a null cursor is what `/` renders as "The catalogue ends here"
    // (`PastTheEnd`), over a catalogue with items still unseen. A listing that
    // lies about where it ends is the silent cap ADR-0119 exists to refuse,
    // reached through that record's own claim about a kept link.
    //
    // SO THIS IS ASSERTED ON A CATALOGUE OF ITS OWN. The suite's database holds
    // untitled items -- the walk above needs them, and so do the two tests
    // before it -- and "no untitled item anywhere" is a property of a whole
    // catalogue rather than of a query, so no listing over that database can
    // have it. It is the reason ADR-0119's own page-level walk is asserted
    // against a third instance rather than either existing one.
    //
    // FIVE ITEMS WALKED TWO AT A TIME, which is the measurement the ticket
    // carries, so what this asserts and what was reported are one thing.
    const own = createDb(await buildTestDatabase("gone"));
    for (const title of ["The Sensorites", "The Aztecs", "The Chase", "The Keys of Marinus"]) {
      await anItemTitled(own, title);
    }
    const anchorId = await anItemTitled(own, "The Edge of Destruction");

    // THE FIXTURE'S OWN PRECONDITION, asserted rather than assumed: a fresh
    // install starts empty (ADR-0094), and the day a migration seeds an item
    // with no title this test would go on passing while testing the case
    // beside it.
    const untitled = await own
      .select({ id: items.id })
      .from(items)
      .where(and(isNull(items.title), isNull(items.sortName), isNull(items.deletedAt)));
    expect(untitled).toHaveLength(0);

    const order = (await readCatalogue(own, { limit: 10_000 })).rows.map((row) => row.id);
    const cut = await readCatalogue(own, { limit: order.indexOf(anchorId) + 1 });
    expect(cut.continuesAfter).toBe(anchorId);
    await own.update(items).set({ deletedAt: new Date() }).where(eq(items.id, anchorId));

    const kept = await readCatalogue(own, { limit: 2, after: cut.continuesAfter ?? "" });

    // A PAGE OF THE CATALOGUE FROM THE TOP, and a page rather than the whole of
    // it: two of the four still there, with a cursor onto the rest. Measured
    // before the fix, this was `[]` with a null cursor and a `total` of 4 --
    // a page claiming the catalogue ended while reporting four items in it.
    const theRest = (await readCatalogue(own, { limit: 10_000 })).rows.map((row) => row.id);
    expect(theRest).toHaveLength(4);
    expect(kept.rows.map((row) => row.id)).toStrictEqual(theRest.slice(0, 2));
    expect(kept.continuesAfter).toBe(theRest[1]);
    expect(kept.total).toBe(4);
  });
});

/**
 * The largest id this catalogue can hold, for the one rule that compares them.
 *
 * `gen_random_uuid` mints version 4, whose version and variant nibbles are
 * fixed: `4`, and one of `8` `9` `a` `b`. This is every other nibble at `f` and
 * those two at the top of their range, so no id this catalogue MINTS is above
 * it and a fixture naming it is past every drawn id rather than probably past
 * them. The `uuid` type itself holds larger values -- `ffffffff-...-ffff` is
 * one -- and only another fixture naming its own id could produce one.
 */
const LAST_ID = "ffffffff-ffff-4fff-bfff-ffffffffffff";

/**
 * Every item the catalogue holds, reached a page at a time.
 *
 * A PAGE OF THREE rather than of a hundred, so the walk is many pages long
 * against a shared test database holding a few dozen items. How big a page is
 * belongs to the caller, which is what lets this ask for a small one.
 *
 * IT FOLLOWS `continuesAfter` RATHER THAN THE LAST ROW IT SAW, which is the
 * difference between modelling a caller and modelling the query. Measured: an
 * earlier version advanced on `rows.at(-1)` and stopped on an empty page, so
 * a `continuesAfter` that was ALWAYS NULL left this test passing -- it was
 * walking a route no caller has, because a caller is only ever handed the one
 * this answers with.
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
    walked.push(...page.rows.map((row) => row.id));
    if (page.continuesAfter === null) return walked;
    after = page.continuesAfter;
  }
  throw new Error(`the walk did not end after ${total} pages of ${pageSize}`);
}
