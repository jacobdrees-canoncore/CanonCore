import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  createDb,
  createGroupByHand,
  type Database,
  deleteGroupByHand,
  findPlacementsInContainer,
  findPlacementsOfItem,
  groups,
  items,
  placements,
  putItemInGroupByHand,
  readCatalogue,
  readWorks,
  searchCatalogue,
  takeItemOutOfGroupByHand,
} from "./index";
import { buildTestDatabase } from "./testing/build-database";
import {
  anItem,
  anItemTitled,
  aPlacement,
  aStatement,
  connect,
  ownerSource,
  someStories,
} from "./testing/catalogue";

/** Whether the catalogue lists one particular item. */
async function lists(db: Database, id: string): Promise<boolean> {
  const { rows } = await readCatalogue(db, { limit: 1000 });
  return rows.some((row) => row.id === id);
}

/** The one Row of the whole catalogue that lists an item, wherever it sorts. */
async function theRowOf(db: Database, id: string) {
  const { rows } = await readCatalogue(db, { limit: 1000 });
  return rows.find((row) => row.id === id);
}

/**
 * Two fresh ids, the first sorting before the second: for a test whose answer
 * must NOT fall out of id order. Random rather than counted, because every file
 * in this suite writes to one database and a counter restarts in each.
 */
function twoIdsInOrder(): { low: string; high: string } {
  return { low: `0${crypto.randomUUID().slice(1)}`, high: `f${crypto.randomUUID().slice(1)}` };
}

let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("readCatalogue", () => {
  it("answers with an item that is in the catalogue", async () => {
    const id = await anItemTitled(db, "A story the catalogue holds");

    // THE WHOLE CATALOGUE, NOT ITS FIRST PAGE, which is what this test is
    // actually about: whether the item is LISTED, never where it sorts. The
    // bound used to be 100, and the fixture's leading `A` was carrying it --
    // the title sat near the front of the alphabet, so the first page happened
    // to hold it. CNCORE-173 files it under `story the catalogue holds` and it
    // moved to the S's, past a shared database that CI fills with more than a
    // hundred items. It went red in CI having passed locally, which is the tell
    // for an assertion resting on a position nobody chose: the shared database
    // is written by every file in this suite at once, so how many items sit
    // ahead of this one was never a property any test declared.
    const { rows } = await readCatalogue(db, { limit: 1000 });

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

  /**
   * CNCORE-173's fourth criterion, asserted as a LISTING over real corpus Rows
   * rather than as a string function over invented ones.
   *
   * THE TITLES ARE COPIED FROM `apps/web/e2e/wiki-fixture.ts`, WHICH IS WHAT
   * `provider-wiki` ACTUALLY SERVES -- suffix included. `(TV story)` is part of
   * the real title, not decoration, and an earlier version of this test dropped
   * it and claimed the fixture's provenance anyway. Review caught that; it is
   * the exact shape `CLAUDE.md` warns about, an unchecked claim travelling.
   *
   * THE `an` AND `a` ARMS OF THE RULE ARE NOT ASSERTED HERE, because this
   * fixture has no title that opens with either -- all thirty are `The` or no
   * article at all. They are covered in `sort-name.test.ts` and
   * `by-hand.test.ts` over titles that are real stories but are NOT rows this
   * repository holds a provider's own copy of, which is a weaker claim and is
   * made there rather than borrowed here.
   *
   * FOUR OF THE SIX OPEN WITH AN ARTICLE AND THEY LAND IN FOUR DIFFERENT
   * PLACES, which is what makes this a test of the rule rather than of one
   * example. Ordered by raw title the answer is Aliens, Rose, The Daleks', The
   * Empty Child, The Unquiet Dead, Tooth -- every article-led row bunched into
   * one block under T. That is the defect this ticket exists to fix, and it
   * differs from the sequence below at five of six positions.
   */
  it("files a leading article under the word after it, over real corpus Rows", async () => {
    const unquiet = await anItemTitled(db, "The Unquiet Dead (TV story)");
    const aliens = await anItemTitled(db, "Aliens of London (TV story)");
    const daleks = await anItemTitled(db, "The Daleks' Master Plan (TV story)");
    const rose = await anItemTitled(db, "Rose (TV story)");
    const tooth = await anItemTitled(db, "Tooth and Claw (TV story)");
    const empty = await anItemTitled(db, "The Empty Child (TV story)");

    const { rows } = await readCatalogue(db, { limit: 1000 });
    const these = new Set([unquiet, aliens, daleks, rose, tooth, empty]);
    const order = rows.map((row) => row.id).filter((id) => these.has(id));

    // WRITTEN OUT RATHER THAN SORTED, so the expectation cannot agree with the
    // code by construction: A, D, E, R, T, U -- and `The Daleks' Master Plan`
    // sits second, under D, where the ticket says it belongs.
    expect(order).toEqual([aliens, daleks, empty, rose, tooth, unquiet]);
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

  it("says how much each Ordering holds, and that a story holds nothing", async () => {
    // CNCORE-183. `isContainer` says a Row IS an ordering and cannot say how
    // big one is, so a reader scanning the catalogue cannot tell a container
    // from its contents at a glance.
    //
    // THE STORY IS ASSERTED TOO, and it is the half that says this is a count
    // rather than a flag: a subquery correlated on the wrong id answers the
    // whole placements table on every Row, which is right for nobody and
    // looks right on the container.
    const stories = [
      await anItemTitled(db, "An Unearthly Child"),
      await anItemTitled(db, "The Cave of Skulls"),
      await anItemTitled(db, "The Forest of Fear"),
    ];
    const ordering = await anItemTitled(db, "An ordering holding three", { isContainer: true });
    for (const [at, itemId] of stories.entries()) {
      await aPlacement(db, { containerId: ordering, itemId, position: at + 1 });
    }

    const { rows } = await readCatalogue(db, { limit: 1000 });
    const byId = new Map(rows.map((row) => [row.id, row]));

    expect(byId.get(ordering)).toMatchObject({ holds: 3 });
    expect(byId.get(stories[0] as string)).toMatchObject({ holds: 0 });
  });

  it("counts what the container's own page would list, past both tombstones", async () => {
    // ADR-0075 TWICE OVER, which is the half a count gets wrong on its own: a
    // container stops listing a placement whose ITEM was deleted as surely as
    // one deleted itself, so a figure reading only `placements.deleted_at`
    // promises members no reader can reach.
    //
    // THE ORACLE IS THE CONTAINER'S OWN PAGE rather than arithmetic done here,
    // because the defect this guards is the two surfaces DISAGREEING -- the
    // catalogue saying 2,913 where the page lists 2,900, with nothing to say
    // which lied. The literal beside it is what stops the pair agreeing while
    // both are wrong.
    const held = await anItemTitled(db, "A story that stays held");
    const gone = await anItemTitled(db, "A story deleted out from under it");
    const withdrawn = await anItemTitled(db, "A story whose placement was withdrawn");
    const stillThere = await anItemTitled(db, "A second story that stays held");
    const ordering = await anItemTitled(db, "An ordering read past two tombstones", {
      isContainer: true,
    });

    for (const [at, itemId] of [held, gone, withdrawn, stillThere].entries()) {
      const placement = await aPlacement(db, { containerId: ordering, itemId, position: at + 1 });
      if (itemId === withdrawn) {
        await db
          .update(placements)
          .set({ deletedAt: new Date() })
          .where(eq(placements.id, placement));
      }
    }
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, gone));

    const { rows } = await readCatalogue(db, { limit: 1000 });
    const row = rows.find((each) => each.id === ordering);
    const page = await findPlacementsInContainer(db, ordering, { limit: 100 });

    expect(row?.holds).toBe(2);
    expect(row?.holds).toBe(page.total);
    expect(page.rows).toHaveLength(2);
  });

  it("says which Orderings a story sits in, and at what Position in each", async () => {
    // CNCORE-184. The Day of the Doctor is the case the ticket designs against:
    // fiftieth-anniversary special on screen, the Time War in the Doctor's own
    // chronology. Where it sits is one fact, and the Row says it.
    //
    // PLACED, AND IDENTIFIED, IN THE REVERSE OF THE ORDER EXPECTED, so a Row
    // that came back in insertion order or in id order fails this rather than
    // passing by luck.
    const { low, high } = twoIdsInOrder();
    const story = await anItemTitled(db, "The Day of the Doctor");
    const chronology = await anItemTitled(db, "The Doctor's own chronology", {
      id: low,
      isContainer: true,
    });
    const broadcast = await anItemTitled(db, "Broadcast order", { id: high, isContainer: true });
    await aPlacement(db, { containerId: chronology, itemId: story, position: 1 });
    await aPlacement(db, { containerId: broadcast, itemId: story, position: 240 });

    const row = await theRowOf(db, story);

    expect(row?.sitsIn).toStrictEqual({
      first: [
        { containerId: broadcast, containerTitle: "Broadcast order", position: 240 },
        { containerId: chronology, containerTitle: "The Doctor's own chronology", position: 1 },
      ],
      total: 2,
    });
  });

  it("says a story in no Ordering sits in none, rather than saying nothing", async () => {
    // ADR-0062: root is the ABSENCE of a placement, so this is a real answer
    // with nothing in it -- and the Row carries it as one, not as a gap.
    const story = await anItemTitled(db, "A story nobody has placed");

    const row = await theRowOf(db, story);

    expect(row?.sitsIn).toStrictEqual({ first: [], total: 0 });
  });

  it("says where a story sits as its own page would, past both tombstones", async () => {
    // ADR-0075 TWICE OVER, the mirror of the container's figure above: a
    // placement withdrawn is gone, and so is one in a container that was
    // deleted, because a deleted container is gone to every reader and an item
    // cannot go on claiming membership of it.
    //
    // THE ORACLE IS THE STORY'S OWN "ALSO APPEARS IN", for ADR-0140's reason:
    // the defect is two surfaces disagreeing about one story. The literal is
    // what stops the pair agreeing while both are wrong.
    const story = await anItemTitled(db, "A story read past two tombstones");
    const kept = await anItemTitled(db, "An ordering that keeps it", { isContainer: true });
    const withdrawnFrom = await anItemTitled(db, "An ordering it was withdrawn from", {
      isContainer: true,
    });
    const deleted = await anItemTitled(db, "An ordering deleted around it", {
      isContainer: true,
    });
    await aPlacement(db, { containerId: kept, itemId: story, position: 3 });
    const withdrawn = await aPlacement(db, {
      containerId: withdrawnFrom,
      itemId: story,
      position: 1,
    });
    await aPlacement(db, { containerId: deleted, itemId: story, position: 2 });
    await db.update(placements).set({ deletedAt: new Date() }).where(eq(placements.id, withdrawn));
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, deleted));

    const row = await theRowOf(db, story);
    const page = await findPlacementsOfItem(db, story, { limit: 100 });

    expect(row?.sitsIn).toStrictEqual({
      first: [{ containerId: kept, containerTitle: "An ordering that keeps it", position: 3 }],
      total: 1,
    });
    expect(row?.sitsIn.total).toBe(page.total);
  });

  it("shows both Positions of a Repeat rather than collapsing it into one", async () => {
    // ADR-0009 allows one item twice in one container -- a recap at 1 and the
    // episode at 5 -- and a Row that said it once would be a lie about both.
    //
    // THE IDS SORT THE OTHER WAY ROUND FROM THE POSITIONS, so an order that
    // fell through to the placement's id reads 5 before 1 rather than passing
    // by luck. Unpinned, a Row with no Position key passed this.
    const story = await anItemTitled(db, "A story recapped at the start");
    const ordering = await anItemTitled(db, "An ordering with a Repeat in it", {
      isContainer: true,
    });
    const { low, high } = twoIdsInOrder();
    await aPlacement(db, { id: low, containerId: ordering, itemId: story, position: 5 });
    await aPlacement(db, { id: high, containerId: ordering, itemId: story, position: 1 });

    const row = await theRowOf(db, story);

    expect(row?.sitsIn).toStrictEqual({
      first: [
        { containerId: ordering, containerTitle: "An ordering with a Repeat in it", position: 1 },
        { containerId: ordering, containerTitle: "An ordering with a Repeat in it", position: 5 },
      ],
      total: 2,
    });
  });

  it("carries the first five Positions of a long membership, and counts every one", async () => {
    // CNCORE-184's truncation, chosen against the Owner's corpus: the widest
    // story sits in 48 Orderings, the longest Row is 61 Placements, and ONE
    // story sits at 43 Positions in ONE Ordering (UNIT HQ, in Petronella
    // Osgood's timeline). That last is this fixture's shape, and it is why the
    // cut counts Placements: cut at five ORDERINGS, this Row would carry seven.
    const story = await anItemTitled(db, "A story placed seven times in one ordering");
    const ordering = await anItemTitled(db, "An ordering it recurs through", {
      isContainer: true,
    });
    for (const position of [7, 6, 5, 4, 3, 2, 1]) {
      await aPlacement(db, { containerId: ordering, itemId: story, position });
    }

    const row = await theRowOf(db, story);

    expect(row?.sitsIn.first.map(({ position }) => position)).toStrictEqual([1, 2, 3, 4, 5]);
    expect(row?.sitsIn.total).toBe(7);
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

  it("says how many Rows come before every page, from the first to the last", async () => {
    // WHERE THE READER IS (ADR-0133), which a size alone cannot say: "100 of
    // 7,000" reads the same on page one and on page seventy. The oracle is the
    // walk itself -- how many Rows the pages before this one actually handed
    // out -- which is a different thing from the count the Listing answers
    // with, so the two agreeing is an assertion rather than a restatement.
    await someStories(db, 7, "A story a reader is told the place of");

    const said: number[] = [];
    const handedOut: number[] = [];
    let walked = 0;
    let after: string | undefined;
    const { total } = await readCatalogue(db, { limit: 1 });
    for (let pages = 0; pages <= total; pages += 1) {
      const page = await readCatalogue(db, { limit: 3, after });
      said.push(page.rowsBefore);
      handedOut.push(walked);
      walked += page.rows.length;
      if (page.continuesAfter === null) break;
      after = page.continuesAfter;
    }

    expect(said).toStrictEqual(handedOut);
    // THE TWO ENDS, said as literals as well: nothing before the first page,
    // and everything but the last page before the last.
    expect(said[0]).toBe(0);
    expect(said.at(-1)).toBe(total - (walked - (handedOut.at(-1) ?? 0)));
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
    // merely hidden, and the item a kept link names is no anchor in the order
    // at all.
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
    expect(kept.rows.map((row) => row.id)).toStrictEqual(fromTheStart.rows.map((row) => row.id));
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

  it("resumes past a deleted item that has its key again, because the key is what a delete takes", async () => {
    // THE OTHER HALF OF THE PAIR the two tests above rest on. A deleted anchor
    // is refused because its KEY is gone, not because its row is: an anchor
    // whose key a delete left standing is still one, and a refusal on the
    // tombstone alone would send this reader back to the top for nothing.
    //
    // A STATEMENT WRITTEN AFTER THE DELETE IS HOW THAT ROW EXISTS. Migration 5
    // tombstones an item's statements only as `deleted_at` is SET, so a title
    // asserted afterwards is live and the projection writes the key back.
    // Until CNCORE-195 this half went untested while ADR-0119 said both were.
    const anchorId = await anItemTitled(db, "A story deleted and then titled again");
    const order = (await readCatalogue(db, { limit: 10_000 })).rows.map((row) => row.id);
    const cut = await readCatalogue(db, { limit: order.indexOf(anchorId) + 1 });
    expect(cut.continuesAfter).toBe(anchorId);
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, anchorId));
    await aStatement(db, {
      subjectItemId: anchorId,
      property: "title",
      valueLiteral: "A story deleted and then titled again",
      sourceId: await ownerSource(db),
    });

    // THE FIXTURE'S OWN PRECONDITION, asserted rather than assumed: the row is
    // deleted AND keyed. Were the projection ever to consult the tombstone,
    // this would be the deleted anchor of the tests above and prove nothing.
    const [anchor] = await db
      .select({ deletedAt: items.deletedAt, title: items.title })
      .from(items)
      .where(eq(items.id, anchorId));
    expect(anchor?.deletedAt).not.toBeNull();
    expect(anchor?.title).toBe("A story deleted and then titled again");

    const kept = await readCatalogue(db, { limit: 1, after: cut.continuesAfter ?? "" });

    // RESUMED, not started over: the item after the anchor, as the order stood
    // when the reader was handed the cursor.
    const next = order[order.indexOf(anchorId) + 1];
    expect(next).toBeDefined();
    expect(kept.rows.map((row) => row.id)).toStrictEqual([next]);
  });
});

/**
 * THE CATALOGUE STEPPED BACK A PAGE AT A TIME (CNCORE-174): `before` is the
 * first Row of the page a reader is on, and the answer is the page before it.
 *
 * ORACLED AGAINST THE WALK FORWARD, which is a different statement read the
 * other way round. A step back that agrees with it page for page is the reverse
 * comparison and the reverse order agreeing with the forward ones, which is the
 * only thing a second direction can get wrong.
 */
describe("readCatalogue, stepped back a page at a time", () => {
  it("answers the page the reader came from, all the way back to the first", async () => {
    // SEVEN OF ITS OWN, so the walk is at least three pages of three whatever
    // else the shared catalogue holds when this runs. Two pages cannot tell a
    // step back from a start over, since the page before the second IS the
    // first -- which is how this test first passed with `before` ignored.
    await someStories(db, 7, "A story a step back has to pass through");

    const forward = await pagesOf(db, 3);
    expect(forward.length).toBeGreaterThanOrEqual(3);
    const back: string[][] = [];
    for (const page of forward.slice(1)) {
      const answer = await readCatalogue(db, { limit: 3, before: page[0] });
      back.push(answer.rows.map((row) => row.id));
    }

    // EVERY PAGE BUT THE LAST, in the order the walk met them: each is the one
    // a reader stepping back from the page after it is shown.
    expect(back).toStrictEqual(forward.slice(0, -1));
  });

  it("steps back from every Row to the one before it, across a tie and the untitled tail", async () => {
    // A PAGE OF ONE FROM EVERY ROW, so every boundary the order has is one a
    // step back crosses -- rather than whichever few a page size happens to
    // cut at, which is ADR-0119's rule for testing a walk. The two that a
    // backward order gets wrong are both here by construction: a tied pair,
    // which only the id behind the key separates, and the untitled tail, whose
    // Rows sort LAST forward and so come FIRST read backward.
    const owner = await ownerSource(db);
    for (const title of ["The Web Planet", "Web Planet (novel)"]) {
      const id = await anItemTitled(db, title);
      await aStatement(db, {
        subjectItemId: id,
        property: "sort_name",
        valueLiteral: "Web Planet, stepped back through",
        sourceId: owner,
      });
    }
    await anItem(db);
    await anItem(db);

    const order = (await readCatalogue(db, { limit: 10_000 })).rows.map((row) => row.id);
    const wrong: string[] = [];
    for (const [at, id] of order.entries()) {
      if (at === 0) continue;
      const { rows } = await readCatalogue(db, { limit: 1, before: id });
      if (rows[0]?.id !== order[at - 1]) wrong.push(`${at}: ${rows[0]?.id} for ${order[at - 1]}`);
    }

    // NAMED RATHER THAN COUNTED, so a failure says where the order broke.
    expect(wrong).toStrictEqual([]);
  });

  it("says how many Rows come before a page, from every Row either way, across a tie and the untitled tail", async () => {
    // WHERE THE READER IS (ADR-0133), asked from every Row rather than from
    // whichever few a page size cuts at: forward past each, and back from each.
    // The count is the Rows BEHIND the Cut, the complement of the ones ahead,
    // so the shapes that decide which side a Row falls on are the ones to cross
    // -- a tied pair only the id separates, and the untitled tail, whose Rows a
    // comparison that went NULL on them would count on neither side.
    const owner = await ownerSource(db);
    for (const title of ["The Keys of Marinus", "Keys of Marinus (novel)"]) {
      const id = await anItemTitled(db, title);
      await aStatement(db, {
        subjectItemId: id,
        property: "sort_name",
        valueLiteral: "Keys of Marinus, counted past",
        sourceId: owner,
      });
    }
    await anItem(db);
    await anItem(db);

    const order = (await readCatalogue(db, { limit: 10_000 })).rows.map((row) => row.id);
    const wrong: string[] = [];
    for (const [at, id] of order.entries()) {
      // PAST THE ROW, the page begins right after it, so the Row itself and
      // every one before it sort before the page -- and past the LAST Row the
      // page is empty, with the whole Listing behind it.
      const past = await readCatalogue(db, { limit: 1, after: id });
      if (past.rowsBefore !== at + 1) wrong.push(`past ${at}: ${past.rowsBefore}`);
      if (at === 0) continue;
      // BACK FROM THE ROW, the page is the one Row before it, and the Rows
      // before that one sort before the page. From the second Row that is the
      // start, whole, which has nothing before it either way.
      const back = await readCatalogue(db, { limit: 1, before: id });
      if (back.rowsBefore !== at - 1) wrong.push(`back from ${at}: ${back.rowsBefore}`);
    }

    // NAMED RATHER THAN COUNTED, so a failure says where the order broke.
    expect(wrong).toStrictEqual([]);
  });

  it("offers a step back from every page but the first, whichever way it was reached", async () => {
    // `continuesBefore` IS `continuesAfter` TURNED ROUND: the first Row of a
    // page where something comes before it, and `null` where nothing does. A
    // page is reached three ways and each has to say it: from the start, by
    // walking forward, and by stepping back.
    await someStories(db, 7, "A story a step back is offered around");
    const [first, second, third] = await pagesOf(db, 3);
    if (!first || !second || !third) throw new Error("the walk is not three pages long");

    const fromTheStart = await readCatalogue(db, { limit: 3 });
    const walkedTo = await readCatalogue(db, { limit: 3, after: first.at(-1) });
    const steppedBackTo = await readCatalogue(db, { limit: 3, before: third[0] });

    expect(fromTheStart.continuesBefore).toBeNull();
    expect(walkedTo.continuesBefore).toBe(second[0]);
    expect(steppedBackTo.rows.map((row) => row.id)).toStrictEqual(second);
    expect(steppedBackTo.continuesBefore).toBe(second[0]);
    // AND FORWARD FROM A PAGE STEPPED BACK TO, which is the direction that
    // page did not read: the Row it ends on, since the page it left is ahead.
    expect(steppedBackTo.continuesAfter).toBe(second.at(-1));
  });

  it("answers the first page whole where a step back reaches the start", async () => {
    // A STEP BACK THAT RUNS OUT OF ROWS IS THE START, and the start is a full
    // page rather than whatever was left. Stepping back from the third Row
    // finds two before it; answering those two alone would be a page nobody
    // walking forward was ever shown, and the one after it would begin
    // mid-page. So a step back that reaches the start answers the start --
    // ADR-0119's answer for a cursor that names no position, which is the same
    // place: nothing is behind it.
    await someStories(db, 4, "A story a step back runs out at");
    const [first] = await pagesOf(db, 3);
    if (!first || first.length < 3) throw new Error("the first page is not full");

    const short = await readCatalogue(db, { limit: 3, before: first[2] });

    expect(short.rows.map((row) => row.id)).toStrictEqual(first);
    expect(short.continuesBefore).toBeNull();
  });
});

/**
 * THE CATALOGUE JUMPED TO A LETTER (CNCORE-174): the first Row filed under it,
 * reached by a SEEK on the sort key rather than by counting pages.
 *
 * IN A GROUP OF ITS OWN, which is what lets the answer be EXACT: the shared
 * catalogue holds whatever every other file filed under M, and a Group nobody
 * else knows the id of holds these Rows and no others. The seek is the same
 * one either way; a Group only narrows what it seeks among.
 */
describe("readCatalogue, jumped to a letter", () => {
  /** Rows filed under several letters, in a Group of their own, by title. */
  async function aGroupFiledUnder(titles: string[]): Promise<{ group: string; ids: string[] }> {
    const group = await createGroupByHand(db, { name: "Filed under several letters" });
    const ids: string[] = [];
    for (const title of titles) {
      const id = await anItemTitled(db, title);
      await putItemInGroupByHand(db, { groupId: group, itemId: id });
      ids.push(id);
    }
    return { group, ids };
  }

  it("lands at the first Row filed under the letter, whatever case or mark it opens with", async () => {
    // FILED UNDER, WHICH IS THE COLLATION'S WORD AND NOT THE FIRST CHARACTER'S.
    // A quoted title files under the letter inside the quote and a lower-case
    // one under its capital, so a jump that compared first characters would
    // put `"Ma"` under a quotation mark and `m` after every capital. The
    // Owner's own catalogue has both shapes: `"Death to the Daleks!"` files
    // under D, and three titles open lower case (measured 2026-09-19).
    //
    // WRITTEN IN AN ORDER THAT IS NOT THE ANSWER'S, so insertion order cannot
    // stand in for the seek.
    const { group, ids } = await aGroupFiledUnder([
      "Peri and the Piscon Paradox",
      "mary had a Dalek",
      "Aliens of London",
      '"Ma" and the Daleks',
      "Nyssa's story",
      "m",
      "Lz, filed last under L",
    ]);
    const [peri, mary, , quoted, nyssa, m] = ids;

    const jumped = await readCatalogue(db, { limit: 10, group, letter: "M" });

    expect(jumped.rows.map((row) => row.id)).toStrictEqual([m, quoted, mary, nyssa, peri]);
    // Something IS filed before M, so the page offers a step back to it.
    expect(jumped.continuesBefore).toBe(m);
    // AND SAYS HOW MUCH: Aliens and Lz, which is where the reader has landed
    // (ADR-0133) -- a jump is a seek, and the place is counted rather than
    // walked to.
    expect(jumped.rowsBefore).toBe(2);
  });

  it("lands at the next letter along where nothing is filed under the one asked for", async () => {
    // A SEEK, NOT A FILTER: "at or past O" where nothing opens with O is the
    // first Row after it, which is where a reader looking for O would look.
    // An empty page here would be a filter's answer, and a dead end.
    const { group, ids } = await aGroupFiledUnder(["Nyssa's story", "Peri and the Piscon Paradox"]);

    const jumped = await readCatalogue(db, { limit: 10, group, letter: "O" });

    expect(jumped.rows.map((row) => row.id)).toStrictEqual([ids[1]]);
  });

  it("offers no step back where nothing is filed before the letter", async () => {
    // THE PAGE A JUMP LANDS ON IS THE START where nothing sorts ahead of the
    // letter, and it must say so rather than offer a step back to itself. A
    // cursor alone cannot tell: the jump names a point, and whether anything
    // sits behind that point is a question the Listing has to be asked.
    const { group, ids } = await aGroupFiledUnder(["Nyssa's story", "Peri and the Piscon Paradox"]);

    const jumped = await readCatalogue(db, { limit: 10, group, letter: "A" });

    expect(jumped.rows.map((row) => row.id)).toStrictEqual(ids);
    expect(jumped.continuesBefore).toBeNull();
  });

  it("starts over where a cursor names nothing, whatever letter the address also carries", async () => {
    // A CURSOR IS THE MORE EXACT OF THE TWO, AND ONE NAMING NOTHING STARTS THE
    // LISTING OVER (ADR-0066). No link this app writes carries both, so this is
    // an address typed or kept by hand -- and it read as a jump until review
    // caught the cursor falling through to the letter.
    const { group, ids } = await aGroupFiledUnder(["Nyssa's story", "Peri and the Piscon Paradox"]);

    const asked = await readCatalogue(db, {
      limit: 10,
      group,
      after: crypto.randomUUID(),
      letter: "P",
    });

    expect(asked.rows.map((row) => row.id)).toStrictEqual(ids);
  });
});

/**
 * THE CATALOGUE NARROWED TO ONE GROUP (CNCORE-179, ADR-0010): one universe at
 * a time, rather than every one on a single front page.
 *
 * EVERY GROUP HERE IS DRAWN BY THE TEST THAT READS IT, which is what lets these
 * assertions be EXACT where the rest of this file has to say "contains". The
 * catalogue is shared by every file in the suite and its size is whatever they
 * left behind; a Group nobody else knows the id of holds what this test put in
 * it and nothing more.
 */
describe("readCatalogue, narrowed to a Group", () => {
  it("answers the Items in that Group and no others, at the Group's own size", async () => {
    // THE SIZE IS THE HALF THAT HAS GONE WRONG BEFORE, twice (CNCORE-129,
    // CNCORE-172): a narrowing added to the Rows and not to the count reports
    // the whole catalogue over a narrowed page. So the Rows and the size are
    // asserted together, against a literal rather than against each other --
    // a pair that agreed while both counted the catalogue would pass that.
    const scope = await createGroupByHand(db, { name: "A scope with two stories in it" });
    const inside = [
      await anItemTitled(db, "A story inside the scope"),
      await anItemTitled(db, "Another story inside the scope"),
    ];
    await anItemTitled(db, "A story outside the scope");
    for (const itemId of inside) await putItemInGroupByHand(db, { groupId: scope, itemId });

    const narrowed = await readCatalogue(db, { limit: 1000, group: scope });

    expect(narrowed.rows.map((row) => row.id).sort()).toStrictEqual([...inside].sort());
    expect(narrowed.total).toBe(2);
  });

  it("lists an Item in two Groups under each of them, because a crossover belongs to both", async () => {
    // ADR-0010's WHOLE CASE, read back through a Listing. A column on `items`
    // would put this Item under one scope and hide it from the other, which is
    // the partition that record refuses.
    const who = await createGroupByHand(db, { name: "A universe with a crossover in it" });
    const avengers = await createGroupByHand(db, { name: "The other universe it crosses" });
    const crossover = await anItemTitled(db, "A story two universes share");
    await putItemInGroupByHand(db, { groupId: who, itemId: crossover });
    await putItemInGroupByHand(db, { groupId: avengers, itemId: crossover });

    for (const group of [who, avengers]) {
      const narrowed = await readCatalogue(db, { limit: 1000, group });
      expect(narrowed.rows.map((row) => row.id)).toStrictEqual([crossover]);
    }
  });

  it("leaves out an Item the Owner took back out, and counts it out too", async () => {
    // A MEMBERSHIP IS A TOMBSTONE WHEN IT GOES (ADR-0075), so the row is still
    // in `group_items` -- and a narrowing that forgot to read `deleted_at`
    // would go on listing an Item the Owner removed from the scope.
    const scope = await createGroupByHand(db, { name: "A scope an Item left" });
    const stays = await anItemTitled(db, "A story that stays in its scope");
    const leaves = await anItemTitled(db, "A story taken out of its scope");
    await putItemInGroupByHand(db, { groupId: scope, itemId: stays });
    await putItemInGroupByHand(db, { groupId: scope, itemId: leaves });
    await takeItemOutOfGroupByHand(db, { groupId: scope, itemId: leaves });

    const narrowed = await readCatalogue(db, { limit: 1000, group: scope });

    expect(narrowed.rows.map((row) => row.id)).toStrictEqual([stays]);
    expect(narrowed.total).toBe(1);
  });

  it("leaves out an Item deleted from the catalogue while it sat in the Group", async () => {
    // THE OTHER TOMBSTONE, which a narrowing must not REPLACE. The membership
    // is still live -- deleting an Item names no Group -- so a scope that
    // stood in for the catalogue's own rule rather than narrowing it would
    // list an Item every other surface has stopped showing.
    const scope = await createGroupByHand(db, { name: "A scope one of whose Items was deleted" });
    const live = await anItemTitled(db, "A story still in the catalogue");
    const deleted = await anItemTitled(db, "A story deleted from the catalogue");
    await putItemInGroupByHand(db, { groupId: scope, itemId: live });
    await putItemInGroupByHand(db, { groupId: scope, itemId: deleted });
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, deleted));

    const narrowed = await readCatalogue(db, { limit: 1000, group: scope });

    expect(narrowed.rows.map((row) => row.id)).toStrictEqual([live]);
    expect(narrowed.total).toBe(1);
  });

  it("narrows to nothing once the Group is deleted, and takes none of its Items with it", async () => {
    // STORY 34 FROM THE LISTING'S END. Deleting a scope empties the scope --
    // a link kept to it now narrows to nothing -- and every Item it held is
    // exactly where it was in the catalogue. A scope is not a container.
    const scope = await createGroupByHand(db, { name: "A scope the Owner deleted" });
    const held = await anItemTitled(db, "A story in a scope that was deleted");
    await putItemInGroupByHand(db, { groupId: scope, itemId: held });
    await deleteGroupByHand(db, scope);

    const narrowed = await readCatalogue(db, { limit: 1000, group: scope });

    expect(narrowed.rows).toStrictEqual([]);
    expect(narrowed.total).toBe(0);
    expect(await lists(db, held)).toBe(true);
  });

  it("narrows every Listing to nothing where a membership outlived its Group, which is what a race leaves", async () => {
    // THE STATE A DELETION RACING A PUT LEAVES BEHIND (CNCORE-230): the put
    // read the Group live, the deletion tombstoned it and its memberships, and
    // the put's insert landed after. A tombstone is not a DELETE, so no foreign
    // key refuses that insert. Built here by tombstoning the Group alone, as
    // `groups.test.ts` builds the same leftover for `group_providers`, because
    // the interleaving itself cannot be scheduled from a test.
    //
    // ALL THREE LISTINGS, because the ticket's claim is about "any", and each
    // is asked with the Item listed first: an answer of nothing is only worth
    // something from a Listing that answered the Item a moment before.
    const scope = await createGroupByHand(db, { name: "A scope deleted mid-put" });
    const held = await anItemTitled(db, "Kinda, in a scope deleted mid-put");
    await putItemInGroupByHand(db, { groupId: scope, itemId: held });
    const narrowed = () =>
      Promise.all([
        readCatalogue(db, { limit: 1000, group: scope }),
        readWorks(db, { limit: 1000, group: scope }),
        searchCatalogue(db, { query: "deleted mid-put", limit: 1000, group: scope }),
      ]);

    for (const listing of await narrowed()) {
      expect(listing.rows.map((row) => row.id)).toStrictEqual([held]);
    }

    await db.update(groups).set({ deletedAt: new Date() }).where(eq(groups.id, scope));

    for (const listing of await narrowed()) {
      expect(listing).toStrictEqual({
        rows: [],
        total: 0,
        rowsBefore: 0,
        continuesAfter: null,
        continuesBefore: null,
      });
    }
  });

  it("narrows to nothing where the Group names nothing, whatever shape the id is", async () => {
    // ADR-0066's RULE FOR A PARAMETER THAT IS NOT AN IDENTITY: whether it
    // names anything is what the ANSWER says. A Group narrows, so one naming
    // nothing narrows to nothing -- where a cursor naming nothing starts over,
    // because a cursor is a position and this is a question.
    //
    // BOTH SHAPES, because they fail differently. A malformed id reaches a
    // `uuid` column as PostgreSQL error 22P02, which is a typo in a shared link
    // reading as "this server is broken" (ADR-0066 under CNCORE-14).
    for (const group of [crypto.randomUUID(), "doctor-who"]) {
      const narrowed = await readCatalogue(db, { limit: 1000, group });
      expect(narrowed).toStrictEqual({
        rows: [],
        total: 0,
        rowsBefore: 0,
        continuesAfter: null,
        continuesBefore: null,
      });
    }
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

/**
 * Every page the catalogue is walked in, forward from the start: `walk` above,
 * keeping where each page began and ended.
 */
async function pagesOf(db: Database, pageSize: number): Promise<string[][]> {
  const pages: string[][] = [];
  let after: string | undefined;
  const { total } = await readCatalogue(db, { limit: 1 });
  for (let walked = 0; walked <= total; walked += 1) {
    const page = await readCatalogue(db, { limit: pageSize, after });
    pages.push(page.rows.map((row) => row.id));
    if (page.continuesAfter === null) return pages;
    after = page.continuesAfter;
  }
  throw new Error(`the walk did not end after ${total} pages of ${pageSize}`);
}
