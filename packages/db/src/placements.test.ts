import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  assertPlacement,
  type Database,
  findPlacementsOfItem,
  items,
  placementSources,
  placements,
} from "./index";
import {
  anItem,
  anItemTitled,
  aPlacement,
  aProvider,
  connect,
  ownerSource,
} from "./testing/catalogue";

let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("findPlacementsOfItem", () => {
  it("answers every ordering the item sits in, with its position in each", async () => {
    // THE PRODUCT'S CENTRAL CLAIM (ADR-0009): one item, two orderings, two
    // positions, both true at once. The archive is 93.44% multi-placement, so
    // this is the common case rather than a feature.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const storyOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    await aPlacement(db, { containerId: releaseOrder, itemId: story, position: 63 });
    await aPlacement(db, { containerId: storyOrder, itemId: story, position: 1 });

    const found = await findPlacementsOfItem(db, story);

    expect(found.map((p) => [p.containerId, p.position])).toStrictEqual(
      expect.arrayContaining([
        [releaseOrder, 63],
        [storyOrder, 1],
      ]),
    );
    expect(found).toHaveLength(2);
  });

  it("names each container, so the reader sees a title rather than an id", async () => {
    // The title is a PROJECTION (ADR-0014): a cached copy of whichever title
    // statement currently wins. Reading the column here rather than resolving
    // the statement is the whole point of having projected it.
    const releaseOrder = await anItemTitled(db, "Release order", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItem(db);
    await aPlacement(db, { containerId: releaseOrder, itemId: story, position: 63 });

    const [found] = await findPlacementsOfItem(db, story);

    expect(found?.containerTitle).toBe("Release order");
  });

  it("honours the tombstone, on the placement and on the container alike", async () => {
    // ADR-0075 puts a tombstone on every table, and a tombstone nothing reads
    // looks like a delete and behaves like nothing. A deleted container is gone
    // to every reader, so an item cannot go on claiming membership of it.
    const withdrawn = await anItemTitled(db, "Withdrawn ordering", {
      isContainer: true,
      isOrdered: true,
    });
    const kept = await anItemTitled(db, "Kept ordering", { isContainer: true, isOrdered: true });
    const removed = await anItemTitled(db, "Ordering it was taken out of", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItem(db);
    await aPlacement(db, { containerId: withdrawn, itemId: story, position: 1 });
    await aPlacement(db, { containerId: kept, itemId: story, position: 2 });
    const lifted = await aPlacement(db, { containerId: removed, itemId: story, position: 3 });

    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, withdrawn));
    await db.update(placements).set({ deletedAt: new Date() }).where(eq(placements.id, lifted));

    const found = await findPlacementsOfItem(db, story);

    expect(found.map((p) => p.containerTitle)).toStrictEqual(["Kept ordering"]);
  });

  it("says who put the item there, so hand-placed and imported are told apart", async () => {
    // ADR-0017. An ordering is a DATED CLAIM BY A NAMED SOURCE, not a neutral
    // fact, and three origins write this table: a provider's browse, the
    // scanner, and the owner's own hand. Which of them a placement came from is
    // the difference the reader is being offered.
    const byHand = await anItemTitled(db, "Hand-placed ordering", {
      isContainer: true,
      isOrdered: true,
    });
    const imported = await anItemTitled(db, "Imported ordering", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItem(db);
    await aPlacement(db, {
      containerId: byHand,
      itemId: story,
      position: 1,
      sourceId: await ownerSource(db),
    });
    await aPlacement(db, {
      containerId: imported,
      itemId: story,
      position: 2,
      sourceId: await aProvider(db, "https://provider.test/placed-by"),
    });

    const found = await findPlacementsOfItem(db, story);

    expect(found.map((p) => [p.containerTitle, p.placedBy])).toStrictEqual(
      expect.arrayContaining([
        ["Hand-placed ordering", "owner"],
        ["Imported ordering", "provider"],
      ]),
    );
  });

  it("comes back in one settled order, so the page does not shuffle between reads", async () => {
    // Without an order, PostgreSQL returns rows in whatever order it likes, and
    // the page's list would reshuffle on a read nobody changed anything with.
    // Sorted the way the catalogue sorts (ADR-0014): the sort name when there
    // is one, the title otherwise, and the position to separate a REPEAT --
    // the same item twice in one container, at two positions, on purpose.
    const zed = await anItemTitled(db, "Zed order", { isContainer: true, isOrdered: true });
    const alpha = await anItemTitled(db, "Alpha order", { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    await aPlacement(db, { containerId: zed, itemId: story, position: 1 });
    await aPlacement(db, { containerId: alpha, itemId: story, position: 5 });
    await aPlacement(db, { containerId: alpha, itemId: story, position: 2 });

    const found = await findPlacementsOfItem(db, story);

    expect(found.map((p) => [p.containerTitle, p.position])).toStrictEqual([
      ["Alpha order", 2],
      ["Alpha order", 5],
      ["Zed order", 1],
    ]);
  });
});

describe("a member with no position", () => {
  /**
   * Migration 2. A member the source asserts no position for is still a member,
   * and the read path has to say so rather than either hiding it or printing a
   * number nobody claimed.
   *
   * IT COMES LAST, which is a consequence rather than a claim about where it
   * belongs: PostgreSQL sorts NULLs last ascending, and the ordering says only
   * that a placement with no asserted position cannot outrank one that has one.
   */
  it("answers a member the source could not place, after the ones it could", async () => {
    const container = await anItemTitled(db, "An ordering with a member it cannot place", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItem(db);
    const wiki = await aProvider(db, "https://unplaced.test/wiki");
    await assertPlacement(db, {
      containerId: container,
      itemId: story,
      position: null,
      sourceId: wiki,
    });

    const placed = await anItem(db);
    await assertPlacement(db, {
      containerId: container,
      itemId: placed,
      position: 1,
      sourceId: wiki,
    });

    const [found] = await findPlacementsOfItem(db, story);

    expect(found).toMatchObject({ position: null, placedBy: "provider" });
  });

  /**
   * ADR-0017's agreement rule reaches the least certain fact in the table.
   * Two sources both saying "a member, position unknown" agree, and agreement
   * is ONE row with a source each -- which is what NULLS NOT DISTINCT buys.
   */
  it("records two sources who agree there is no position against one placement", async () => {
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    const wiki = await aProvider(db, "https://unplaced.test/one");
    const tmdb = await aProvider(db, "https://unplaced.test/two");

    const first = await assertPlacement(db, {
      containerId: container,
      itemId: story,
      position: null,
      sourceId: wiki,
    });
    const second = await assertPlacement(db, {
      containerId: container,
      itemId: story,
      position: null,
      sourceId: tmdb,
    });

    expect(second).toBe(first);
    expect(await findPlacementsOfItem(db, story)).toHaveLength(1);
  });
});

describe("two sources disagreeing about position", () => {
  /**
   * ADR-0017: sources disagreeing about position produce two rows RESOLVED BY
   * RANK, the same way two competing statements are. Both rows stand and both
   * are answered -- what rank decides is which of them SPEAKS, and a reader
   * sees that as the order they come back in.
   *
   * The three terms are `winning_literal`'s, in its order and for its reasons:
   * rank first because the owner's favourite is the lock (ADR-0024), then the
   * one global source order (ADR-0025), then a stable id. Recency is
   * deliberately absent from both.
   *
   * THE POSITIONS ARE CHOSEN SO THE OLD ORDER IS WRONG. Sorting by position
   * would put the provider's 1 ahead of the owner's 63, which is the answer
   * this rule exists to overturn -- so a test where the winner also happens to
   * sit earlier would pass with nothing resolved.
   */
  it("answers with the winning claim first, by the global source order", async () => {
    const container = await anItemTitled(db, "An ordering two sources disagree about", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItem(db);
    await assertPlacement(db, {
      containerId: container,
      itemId: story,
      position: 1,
      sourceId: await aProvider(db, "https://rank.test/order"),
    });
    await assertPlacement(db, {
      containerId: container,
      itemId: story,
      position: 63,
      sourceId: await ownerSource(db),
    });

    const found = await findPlacementsOfItem(db, story);

    expect(found.map((p) => [p.position, p.placedBy])).toStrictEqual([
      [63, "owner"],
      [1, "provider"],
    ]);
  });

  /**
   * ADR-0024: the owner's favourite is the LOCK, and it outranks the whole
   * source order. So a placement ranked `preferred` wins even when its source
   * sits last, which is the half a source-order-only rule gets wrong.
   */
  it("lets rank outrank the source order, because the favourite is the lock", async () => {
    const container = await anItemTitled(db, "An ordering with a favourite", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItem(db);
    const favourite = await assertPlacement(db, {
      containerId: container,
      itemId: story,
      position: 5,
      sourceId: await aProvider(db, "https://rank.test/favourite"),
    });
    // THE RANK IS SET HERE RATHER THAN PASSED IN, because nothing in the
    // product sets one: there is no surface where an owner locks a placement
    // against a provider that disagrees, so `assertPlacement` takes no `rank`.
    // This is what the read path will do the day something does.
    await db
      .update(placementSources)
      .set({ rank: "preferred" })
      .where(eq(placementSources.placementId, favourite));
    await assertPlacement(db, {
      containerId: container,
      itemId: story,
      position: 2,
      sourceId: await ownerSource(db),
    });

    const found = await findPlacementsOfItem(db, story);

    expect(found.map((p) => [p.position, p.placedBy])).toStrictEqual([
      [5, "provider"],
      [2, "owner"],
    ]);
  });

  /**
   * A REPEAT is not a disagreement, and the difference is invisible in the
   * schema: both are one item twice in one container at two positions. What
   * tells them apart is that a repeat's rows are asserted by ONE source, so
   * they tie on every term rank can decide and fall through to position -- and
   * a recap at 1 still reads before the episode at 5 (ADR-0009, CONTEXT.md).
   */
  it("leaves a repeat in its container's own order, since one source asserts both", async () => {
    const container = await anItemTitled(db, "An ordering with a recap in it", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItem(db);
    const owner = await ownerSource(db);
    await assertPlacement(db, {
      containerId: container,
      itemId: story,
      position: 5,
      sourceId: owner,
    });
    await assertPlacement(db, {
      containerId: container,
      itemId: story,
      position: 1,
      sourceId: owner,
    });

    const found = await findPlacementsOfItem(db, story);

    expect(found.map((p) => p.position)).toStrictEqual([1, 5]);
  });
});

describe("a placement several sources assert", () => {
  /**
   * ADR-0017. Sources AGREEING about a placement are recorded against ONE row,
   * because the same item at the same position twice is never a deliberate
   * duplicate -- it is always agreement, and agreement is corroboration rather
   * than noise. Two rows would turn a second provider confirming an ordering
   * into a second claim for a reader to tell apart from the first.
   */
  it("records two providers who agree against one placement, with a source each", async () => {
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const item = await anItem(db);
    const wiki = await aProvider(db, "https://agree.test/wiki");
    const tmdb = await aProvider(db, "https://agree.test/tmdb");

    const first = await assertPlacement(db, {
      containerId: container,
      itemId: item,
      position: 3,
      sourceId: wiki,
    });
    const second = await assertPlacement(db, {
      containerId: container,
      itemId: item,
      position: 3,
      sourceId: tmdb,
    });

    expect(second).toBe(first);
    const rows = await db
      .select({ id: placements.id })
      .from(placements)
      .where(and(eq(placements.containerId, container), eq(placements.itemId, item)));
    expect(rows).toHaveLength(1);
    const asserted = await db
      .select({ sourceId: placementSources.sourceId })
      .from(placementSources)
      .where(eq(placementSources.placementId, first));
    expect(asserted.map((row) => row.sourceId).sort()).toEqual([wiki, tmdb].sort());
  });

  /**
   * The same provider saying the same thing twice is one claim, not two. A
   * second browse of a container it already asserted has to add nothing rather
   * than fail on `placement_sources_placement_source`.
   */
  it("adds nothing when one source asserts the same placement twice", async () => {
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const item = await anItem(db);
    const wiki = await aProvider(db, "https://agree.test/twice");

    const first = await assertPlacement(db, {
      containerId: container,
      itemId: item,
      position: 1,
      sourceId: wiki,
    });
    const again = await assertPlacement(db, {
      containerId: container,
      itemId: item,
      position: 1,
      sourceId: wiki,
    });

    expect(again).toBe(first);
    const asserted = await db
      .select({ id: placementSources.id })
      .from(placementSources)
      .where(eq(placementSources.placementId, first));
    expect(asserted).toHaveLength(1);
  });

  /**
   * A source DISAGREEING about position is the other case, and it is a
   * different placement rather than a correction of the first: two rows, both
   * standing, and which of them speaks is decided at read time by rank
   * (ADR-0017).
   */
  it("writes a second placement when a source disagrees about position", async () => {
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const item = await anItem(db);
    const wiki = await aProvider(db, "https://disagree.test/wiki");

    const atThree = await assertPlacement(db, {
      containerId: container,
      itemId: item,
      position: 3,
      sourceId: wiki,
    });
    const atFive = await assertPlacement(db, {
      containerId: container,
      itemId: item,
      position: 5,
      sourceId: await ownerSource(db),
    });

    expect(atFive).not.toBe(atThree);
    const rows = await db
      .select({ position: placements.position })
      .from(placements)
      .where(and(eq(placements.containerId, container), eq(placements.itemId, item)))
      .orderBy(placements.position);
    expect(rows.map((row) => row.position)).toEqual([3, 5]);
  });
});
