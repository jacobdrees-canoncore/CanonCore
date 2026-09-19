import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  createDb,
  createGroupByHand,
  type Database,
  deleteGroupByHand,
  findPlacementsInContainer,
  items,
  placements,
  putItemInGroupByHand,
  readCatalogue,
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
} from "./testing/catalogue";

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
    // whose key a delete left standing still has a place, and a refusal on the
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
      expect(narrowed).toStrictEqual({ rows: [], total: 0, continuesAfter: null });
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
