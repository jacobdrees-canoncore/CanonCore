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

describe("findPlacementsOfItem, on who asserted each placement", () => {
  it("tells two sources disagreeing about position from one source saying it twice", async () => {
    // THE CRITERION, at the query, and the MIRROR of the one CNCORE-90 pinned at
    // the container's end. ADR-0017: "sources disagreeing about position produce
    // two placement rows", and ADR-0009 licences a Repeat -- which is ALSO one
    // item twice in one container at two positions. Nothing STORED separates
    // them; what does is who asserted them, a repeat's rows coming from one
    // source and a disagreement's from two.
    //
    // BOTH SHAPES IN ONE TEST, because either alone passes against a query
    // answering a constant. The difference between the two answers IS the
    // criterion, and a test that only ever saw one of them could not state it.
    //
    // AND BOTH ARE TWO PROVIDERS, which is where `placedBy` gives out: the
    // disagreement this catalogue actually holds is the wiki's series against
    // TMDB's season, so the KIND prints "Imported" on both rows and the reader
    // is back where they started.
    const wiki = await aProvider(
      db,
      "https://item-end.test/by-release",
      "A wiki that orders by release",
    );
    const broadcaster = await aProvider(
      db,
      "https://item-end.test/by-broadcast",
      "A database that orders by broadcast",
    );
    const disputed = await anItemTitled(db, "An ordering the item's end disagrees about", {
      isContainer: true,
      isOrdered: true,
    });
    const argued = await anItemTitled(db, "A story the two of them place apart");
    await assertPlacement(db, {
      containerId: disputed,
      itemId: argued,
      position: 1,
      sourceId: broadcaster,
    });
    await assertPlacement(db, {
      containerId: disputed,
      itemId: argued,
      position: 3,
      sourceId: wiki,
    });

    const repeated = await anItemTitled(db, "An ordering the item's end sees a recap in", {
      isContainer: true,
      isOrdered: true,
    });
    const recapped = await anItemTitled(db, "A story the wiki shows twice");
    await assertPlacement(db, {
      containerId: repeated,
      itemId: recapped,
      position: 1,
      sourceId: wiki,
    });
    await assertPlacement(db, {
      containerId: repeated,
      itemId: recapped,
      position: 5,
      sourceId: wiki,
    });

    const disagreement = await findPlacementsOfItem(db, argued);
    const repeat = await findPlacementsOfItem(db, recapped);

    // THE WIKI LEADS BECAUSE IT SPEAKS, NOT BECAUSE IT SITS FIRST -- it holds
    // the lower `source_order` and the broadcaster put the story at position 1.
    // This is where the two ends differ and the difference is ADR-0017's: the
    // container's end is in POSITION order (ADR-0018), and here rank leads, so
    // the winning claim is the one a reader meets first. Naming the sources
    // does not get to reorder that.
    expect(
      disagreement.map((placement) => [placement.position, placement.assertedBy]),
    ).toStrictEqual([
      [3, ["A wiki that orders by release"]],
      [1, ["A database that orders by broadcast"]],
    ]);
    expect(repeat.map((placement) => placement.assertedBy)).toStrictEqual([
      ["A wiki that orders by release"],
      ["A wiki that orders by release"],
    ]);
    // AND THE KIND CANNOT TELL THEM APART, which is why this field exists.
    expect(disagreement.map((placement) => placement.placedBy)).toStrictEqual([
      "provider",
      "provider",
    ]);
  });

  it("shows two sources corroborating ONE placement as two, in the spokesman's order", async () => {
    // ADR-0017'S NAMED GAP, from the end it was still open at: "a placement two
    // providers corroborate and a placement one provider asserts are
    // indistinguishable to every reader". CNCORE-90 closed it at the container's
    // end; this is the other half. Agreement lands on ONE row carrying a source
    // each, so corroboration is only ever visible as two NAMES on one placement
    // -- never as two rows, which would be the disagreement above.
    //
    // THE FAVOURITE IS CREATED SECOND AND RANKED UP, which is what makes the
    // order a test rather than an accident: under insertion order, or under the
    // source order alone, it comes back second. Only rank-first (ADR-0024, the
    // favourite is the lock) puts it in front, and that is `spokesmanFor`'s own
    // first term applied to ORDER the names instead of to pick one.
    const first = await aProvider(
      db,
      "https://item-end.test/came-first",
      "A source the item's end saw first",
    );
    const later = await aProvider(
      db,
      "https://item-end.test/came-later",
      "A source the item's end saw later",
    );
    const agreed = await anItemTitled(db, "An ordering two sources corroborate", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItemTitled(db, "A story both of them place the same way");
    await assertPlacement(db, { containerId: agreed, itemId: story, position: 2, sourceId: first });
    const corroborated = await assertPlacement(db, {
      containerId: agreed,
      itemId: story,
      position: 2,
      sourceId: later,
    });
    await db
      .update(placementSources)
      .set({ rank: "preferred" })
      .where(
        and(eq(placementSources.placementId, corroborated), eq(placementSources.sourceId, later)),
      );

    const found = await findPlacementsOfItem(db, story);

    // ONE PLACEMENT, TWO NAMES -- the corroboration, visible at last.
    expect(found.map((placement) => placement.assertedBy)).toStrictEqual([
      ["A source the item's end saw later", "A source the item's end saw first"],
    ]);
  });

  it("still answers a placement no source stands behind, naming nobody", async () => {
    // A CLAIM NOBODY MADE IS STILL A PLACEMENT, and the read path does not get
    // to decide a row does not exist because its provenance was never recorded.
    // `aPlacement` can build one where `assertPlacement` cannot, which is what
    // ADR-0017 says test fixtures are for.
    const container = await anItemTitled(db, "An ordering nobody claims from the item's end", {
      isContainer: true,
    });
    const story = await anItemTitled(db, "A story nobody claims from the item's end");
    await aPlacement(db, { containerId: container, itemId: story, position: 1 });

    const found = await findPlacementsOfItem(db, story);

    expect(found.map((placement) => placement.assertedBy)).toStrictEqual([[]]);
  });
});
