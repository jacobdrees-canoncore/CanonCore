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

    const { entries: found } = await findPlacementsOfItem(db, story, { limit: 10 });

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

    const [found] = (await findPlacementsOfItem(db, story, { limit: 10 })).entries;

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

    const { entries: found } = await findPlacementsOfItem(db, story, { limit: 10 });

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

    const { entries: found } = await findPlacementsOfItem(db, story, { limit: 10 });

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

    const { entries: found } = await findPlacementsOfItem(db, story, { limit: 10 });

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

    const [found] = (await findPlacementsOfItem(db, story, { limit: 10 })).entries;

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
    expect((await findPlacementsOfItem(db, story, { limit: 10 })).entries).toHaveLength(1);
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

    const { entries: found } = await findPlacementsOfItem(db, story, { limit: 10 });

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

    const { entries: found } = await findPlacementsOfItem(db, story, { limit: 10 });

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

    const { entries: found } = await findPlacementsOfItem(db, story, { limit: 10 });

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

describe("findPlacementsOfItem, capped and walked", () => {
  it("caps the page and says how many orderings there are altogether", async () => {
    // ADR-0119's first sentence: every listing in CanonCore is capped. This was
    // the last one in the app that was not, and a cap with no count beside it is
    // the listing lying about its own extent.
    const story = await anItem(db);
    for (const position of [1, 2, 3]) {
      const ordering = await anItemTitled(db, `Capped ordering ${position}`, {
        isContainer: true,
        isOrdered: true,
      });
      await aPlacement(db, { containerId: ordering, itemId: story, position });
    }

    const { entries, total } = await findPlacementsOfItem(db, story, { limit: 2 });

    expect(entries).toHaveLength(2);
    expect(total).toBe(3);
  });

  it("hands over the placement it stopped at, and carries on after it", async () => {
    // ADR-0119: a listing is walked FORWARD, and the cursor is the row the page
    // before it showed. `continuesAfter` is null where the list ends, so a page
    // that answered null while orderings remained would be the silent cap.
    const story = await anItem(db);
    const written: string[] = [];
    for (const position of [1, 2, 3]) {
      const ordering = await anItemTitled(db, `Walked ordering ${position}`, {
        isContainer: true,
        isOrdered: true,
      });
      written.push(await aPlacement(db, { containerId: ordering, itemId: story, position }));
    }

    const first = await findPlacementsOfItem(db, story, { limit: 2 });
    const second = await findPlacementsOfItem(db, story, {
      limit: 2,
      after: first.continuesAfter ?? undefined,
    });

    expect(first.continuesAfter).toBe(first.entries.at(-1)?.id);
    expect(second.entries.map((placement) => placement.id)).toStrictEqual([written[2]]);
    // The list ends here, so there is nothing to hand on.
    expect(second.continuesAfter).toBeNull();
  });
});

/**
 * Two ids in a KNOWN order, so a test can say which of a tied pair sorts first.
 *
 * MINTED PER CALL rather than written as two constants, because this suite
 * shares ONE database across every file in it and accumulates: a pair of fixed
 * uuids reused by the five checks below would be the same primary key inserted
 * five times.
 */
let pairsMinted = 0;
function twoIdsInOrder(): { earlier: string; later: string } {
  const pair = String(++pairsMinted).padStart(6, "0");
  return {
    earlier: `00000000-0000-4000-8000-${pair}000001`,
    later: `00000000-0000-4000-8000-${pair}000002`,
  };
}

/** The whole listing, walked one row at a time from the beginning. */
async function walked(db: Database, itemId: string): Promise<string[]> {
  const reached: string[] = [];
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const { entries, continuesAfter } = await findPlacementsOfItem(db, itemId, { limit: 1, after });
    reached.push(...entries.map((placement) => placement.id));
    if (continuesAfter === null) return reached;
    after = continuesAfter;
  }
  throw new Error(`the walk never ended: ${reached.length} rows`);
}

/**
 * EVERY TERM OF THE ORDER IS A WAY TO LOSE ROWS, which is ADR-0119's rule about
 * a keyset walk applied to the order with the most terms in the app.
 *
 * "Also appears in" orders on FOUR keys and then the placement's id, where the
 * catalogue and a container's members order on one key and an id. A cursor that
 * names fewer terms than the `ORDER BY` does steps over rows silently, so each
 * of these cuts the page AT a tie on one term with the pair tied on every other
 * -- and each is mutation-checked by dropping that term from the comparison.
 */
describe("findPlacementsOfItem, the terms of its order", () => {
  it("separates two orderings that tie on everything but the container's name", async () => {
    // ADR-0014's projected key leads, and the two placements are otherwise
    // identical: one source, one rank, one position between them.
    const { earlier, later } = twoIdsInOrder();
    const owner = await ownerSource(db);
    const story = await anItem(db);
    const alpha = await anItemTitled(db, "Term ordering alpha", { isContainer: true });
    const beta = await anItemTitled(db, "Term ordering beta", { isContainer: true });
    // The id order is the OPPOSITE of the key order, so a comparison that falls
    // through to the id loses beta rather than finding it by luck.
    await aPlacement(db, {
      id: later,
      containerId: alpha,
      itemId: story,
      position: 1,
      sourceId: owner,
    });
    await aPlacement(db, {
      id: earlier,
      containerId: beta,
      itemId: story,
      position: 1,
      sourceId: owner,
    });

    expect(await walked(db, story)).toStrictEqual([later, earlier]);
  });

  it("puts the rank that speaks first, ahead of the position it would sort by", async () => {
    // ADR-0017's FIRST term, and ADR-0024's reason: the owner's favourite is
    // the LOCK, so a preferred claim is met before a normal one -- and it is met
    // first even when the position would have put it last. Two sources claiming
    // different positions for one membership are two rows, both standing and
    // both answered, and the rank is what decides which of them SPEAKS.
    const { earlier, later } = twoIdsInOrder();
    const owner = await ownerSource(db);
    const story = await anItem(db);
    const ordering = await anItemTitled(db, "Term ordering by rank", { isContainer: true });
    // THE PREFERRED ROW SORTS LAST BY POSITION, which is what makes this a test
    // of the rank rather than of the term behind it: drop the rank and the
    // comparison falls through to a position that is already past this one.
    await aPlacement(db, {
      id: later,
      containerId: ordering,
      itemId: story,
      position: 5,
      sourceId: owner,
      rank: "preferred",
    });
    await aPlacement(db, {
      id: earlier,
      containerId: ordering,
      itemId: story,
      position: 1,
      sourceId: owner,
      rank: "normal",
    });

    expect(await walked(db, story)).toStrictEqual([later, earlier]);
  });

  it("puts the source that speaks first, ahead of the position it would sort by", async () => {
    // ADR-0025's one global order, ADR-0017's second term. Same container, same
    // rank: two sources disagreeing about where this item sits, and the source
    // order is the whole difference. `aProvider` allocates `max + 1`, so it
    // sits behind the owner -- and as above, behind it by POSITION too.
    const { earlier, later } = twoIdsInOrder();
    const owner = await ownerSource(db);
    const behindTheOwner = await aProvider(db, "provider-term-order");
    const story = await anItem(db);
    const ordering = await anItemTitled(db, "Term ordering by source", { isContainer: true });
    await aPlacement(db, {
      id: later,
      containerId: ordering,
      itemId: story,
      position: 5,
      sourceId: owner,
    });
    await aPlacement(db, {
      id: earlier,
      containerId: ordering,
      itemId: story,
      position: 1,
      sourceId: behindTheOwner,
    });

    expect(await walked(db, story)).toStrictEqual([later, earlier]);
  });

  it("separates a Repeat's two rows, which tie on everything but the position", async () => {
    // CONTEXT.md's Repeat: one item twice in one container, on purpose -- "a
    // recap at position 1 and the episode at position 5". One source asserted
    // both, so ADR-0017's two terms tie and only ADR-0018's position is left.
    const { earlier, later } = twoIdsInOrder();
    const owner = await ownerSource(db);
    const story = await anItem(db);
    const ordering = await anItemTitled(db, "Term ordering with a repeat", { isContainer: true });
    await aPlacement(db, {
      id: later,
      containerId: ordering,
      itemId: story,
      position: 1,
      sourceId: owner,
    });
    await aPlacement(db, {
      id: earlier,
      containerId: ordering,
      itemId: story,
      position: 5,
      sourceId: owner,
    });

    expect(await walked(db, story)).toStrictEqual([later, earlier]);
  });

  it("separates two rows that tie on all four keys, by the placement's id", async () => {
    // TWO CONTAINERS SHARING ONE NAME, which is what an outright tie has to be
    // here: migration 1 keeps a unique constraint on
    // (owner, container, item, position), so one item cannot sit twice in ONE
    // container at one point. Two orderings that sort alike, asserted by one
    // source at one rank and one position, tie on every key there is.
    const { earlier, later } = twoIdsInOrder();
    const owner = await ownerSource(db);
    const story = await anItem(db);
    const one = await anItemTitled(db, "Term ordering tied outright", { isContainer: true });
    const other = await anItemTitled(db, "Term ordering tied outright", { isContainer: true });
    await aPlacement(db, {
      id: earlier,
      containerId: one,
      itemId: story,
      position: 1,
      sourceId: owner,
    });
    await aPlacement(db, {
      id: later,
      containerId: other,
      itemId: story,
      position: 1,
      sourceId: owner,
    });

    expect(await walked(db, story)).toStrictEqual([earlier, later]);
  });
});

/**
 * EVERY ONE OF THE FOUR KEYS IS NULLABLE, so every one of them has a block of
 * rows behind it that a plain row comparison loses PERMANENTLY, from every page:
 * `(null, x) > (k, y)` is NULL rather than true. ADR-0119 calls that the two
 * regimes and records it as the half of a keyset walk that gets built wrong.
 *
 * The catalogue has one such block (an item nobody has titled) and a container
 * has one (CONTEXT.md's Unplaced). This listing has THREE, because the row it
 * lists is a placement joined to its container and both ends can be silent: a
 * container nobody has named, a placement no source stands behind, and a
 * placement no source gave a position.
 */
describe("findPlacementsOfItem, the rows with no key at all", () => {
  it("reaches an ordering nobody has named, and walks on through that block", async () => {
    // ADR-0014: the key is the projection, and an item with no title statement
    // has neither column -- so the container has no key and sorts last as one
    // block. TWO of them, so the walk has to resume from an anchor that has no
    // key either, which is the other half of the comparison.
    const owner = await ownerSource(db);
    const story = await anItem(db);
    const named = await anItemTitled(db, "Keyless test, a named ordering", { isContainer: true });
    const unnamed = await anItem(db, { isContainer: true });
    const alsoUnnamed = await anItem(db, { isContainer: true });
    const inTheNamedOne = await aPlacement(db, {
      containerId: named,
      itemId: story,
      position: 1,
      sourceId: owner,
    });
    const nameless = new Set<string>();
    for (const containerId of [unnamed, alsoUnnamed]) {
      nameless.add(
        await aPlacement(db, { containerId, itemId: story, position: 1, sourceId: owner }),
      );
    }

    const found = await walked(db, story);

    // The named one leads; the two nameless ones are the block behind it, and
    // the order WITHIN that block is their ids, which this does not claim to know.
    expect(found[0]).toBe(inTheNamedOne);
    expect(new Set(found.slice(1))).toStrictEqual(nameless);
  });

  it("reaches a placement no source stands behind", async () => {
    // A claim nobody made is still a placement, so the read path does not get to
    // drop it (ADR-0017) -- and the two terms deciding which source SPEAKS are
    // both null for it, which puts it behind every row that has one.
    const owner = await ownerSource(db);
    const story = await anItem(db);
    const ordering = await anItemTitled(db, "Keyless test, an unsourced row", {
      isContainer: true,
    });
    const claimed = await aPlacement(db, {
      containerId: ordering,
      itemId: story,
      position: 5,
      sourceId: owner,
    });
    // NO `sourceId`, so no `placement_sources` row and no spokesman at all.
    const unclaimed = await aPlacement(db, { containerId: ordering, itemId: story, position: 1 });

    expect(await walked(db, story)).toStrictEqual([claimed, unclaimed]);
  });

  it("reaches an Unplaced ordering, which is a placement with no position", async () => {
    // CONTEXT.md: an Unplaced member is a PLACEMENT WITH NO POSITION, never an
    // absent placement. The wiki's release order leaves a sixth of the archive's
    // stories without one, so this block is the ordinary case rather than an edge.
    const owner = await ownerSource(db);
    const story = await anItem(db);
    const ordering = await anItemTitled(db, "Keyless test, an unplaced row", {
      isContainer: true,
    });
    const placed = await aPlacement(db, {
      containerId: ordering,
      itemId: story,
      position: 1,
      sourceId: owner,
    });
    const unplaced = await aPlacement(db, {
      id: twoIdsInOrder().later,
      containerId: ordering,
      itemId: story,
      position: null,
      sourceId: owner,
    });

    expect(await walked(db, story)).toStrictEqual([placed, unplaced]);
  });
});

/**
 * WHAT A KEPT LINK INTO THIS LISTING DOES WHEN ITS ANCHOR GOES, which is
 * ADR-0119's tombstone split meeting the first order in the app that has BOTH
 * KINDS OF TERM IN IT.
 *
 * That record reads the anchor WITHOUT the tombstone filter, deliberately, and
 * then lets each order decide what it found: an order built on ADR-0014's
 * projection loses its anchor's place to a delete, because the projection over
 * no live statements is NULL and the columns are GONE rather than hidden; an
 * order on a stored column a delete does not touch keeps it, which is why a kept
 * link into a container RESUMES.
 *
 * This order leads on the projection and continues on three stored columns. The
 * leading term is what decides, because a place that has lost its first term has
 * lost the whole place.
 */
describe("findPlacementsOfItem, an anchor that has gone", () => {
  it("starts the listing over when the ordering the link was cut at is deleted", async () => {
    // The anchor's key is the CONTAINER's projected key, and deleting the
    // container destroys it (migration 5 tombstones every statement, that
    // re-fires the projection, and the projection over none is NULL). Resuming
    // from a null key would resume from the nameless block with every named
    // ordering between SKIPPED -- the dead end CNCORE-110 measured on `/`.
    const owner = await ownerSource(db);
    const story = await anItem(db);
    const first = await anItemTitled(db, "Gone anchor, ordering one", { isContainer: true });
    const second = await anItemTitled(db, "Gone anchor, ordering two", { isContainer: true });
    const cutAt = await aPlacement(db, {
      containerId: first,
      itemId: story,
      position: 1,
      sourceId: owner,
    });
    const behindIt = await aPlacement(db, {
      containerId: second,
      itemId: story,
      position: 1,
      sourceId: owner,
    });
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, first));

    const { entries } = await findPlacementsOfItem(db, story, { limit: 10, after: cutAt });

    // THE LISTING FROM THE TOP, not an empty page and not the tail. Nothing is
    // skipped and nothing is lost, which is the criterion the cap exists to
    // keep; what it costs is that a reader deep in the list walks it again.
    expect(entries.map((placement) => placement.id)).toStrictEqual([behindIt]);
  });

  it("resumes past an anchor whose own placement was removed", async () => {
    // The PLACEMENT's tombstone takes the row out of the listing and leaves
    // every column the order reads standing -- the container's key included,
    // since the container is untouched. So this anchor keeps its place, which
    // is the half of ADR-0119's split that RESUMES.
    const owner = await ownerSource(db);
    const story = await anItem(db);
    const first = await anItemTitled(db, "Removed anchor, ordering one", { isContainer: true });
    const second = await anItemTitled(db, "Removed anchor, ordering two", { isContainer: true });
    const cutAt = await aPlacement(db, {
      containerId: first,
      itemId: story,
      position: 1,
      sourceId: owner,
    });
    const behindIt = await aPlacement(db, {
      containerId: second,
      itemId: story,
      position: 1,
      sourceId: owner,
    });
    await db.update(placements).set({ deletedAt: new Date() }).where(eq(placements.id, cutAt));

    const { entries, total } = await findPlacementsOfItem(db, story, { limit: 10, after: cutAt });

    expect(entries.map((placement) => placement.id)).toStrictEqual([behindIt]);
    // The removed one is gone from the count as well as from the page.
    expect(total).toBe(1);
  });

  it("still resumes from an ordering nobody has named, which is not the same absence", async () => {
    // A container with no key because nobody NAMED it sits at the end of the
    // order as one block and is resumed from by the three keys behind it. A
    // container with no key because it is DELETED has lost its place. The two
    // are one predicate apart, so the guard tests the PAIR rather than the
    // tombstone alone.
    const owner = await ownerSource(db);
    const story = await anItem(db);
    const unnamed = await anItem(db, { isContainer: true });
    const cutAt = await aPlacement(db, {
      containerId: unnamed,
      itemId: story,
      position: 1,
      sourceId: owner,
    });
    const behindIt = await aPlacement(db, {
      containerId: unnamed,
      itemId: story,
      position: 5,
      sourceId: owner,
    });

    const { entries } = await findPlacementsOfItem(db, story, { limit: 10, after: cutAt });

    // RESUMED, not started over: one row rather than both.
    expect(entries.map((placement) => placement.id)).toStrictEqual([behindIt]);
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

    const { entries: disagreement } = await findPlacementsOfItem(db, argued, { limit: 10 });
    const { entries: repeat } = await findPlacementsOfItem(db, recapped, { limit: 10 });

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

    const { entries: found } = await findPlacementsOfItem(db, story, { limit: 10 });

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

    const { entries: found } = await findPlacementsOfItem(db, story, { limit: 10 });

    expect(found.map((placement) => placement.assertedBy)).toStrictEqual([[]]);
  });
});
