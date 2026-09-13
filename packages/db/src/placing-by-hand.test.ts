import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  assertPlacement,
  type Database,
  findPlacementsInContainer,
  findPlacementsOfItem,
  PlacementRefused,
  placeItemByHand,
  placementSources,
  placements,
  readWorks,
  removePlacementByHand,
  restorePlacementByHand,
} from "./index";
import { anItem, anItemTitled, aPlacement, aProvider, connect } from "./testing/catalogue";

/**
 * THE OWNER'S OWN HAND ON A CONTAINER'S MEMBERSHIP (CNCORE-72), which is
 * what was ADR-0061's explicitly unbuilt half: mutations naming a PLACEMENT
 * rather than an item.
 *
 * ASSERTED THROUGH THE READ PATH rather than by selecting from `placements`.
 * What an owner is owed is that the member appears in the container, and a test
 * that read the table would go on passing if the write were correct and the row
 * invisible to every reader -- which is the half that actually matters.
 */
let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("placeItemByHand", () => {
  it("puts an item in a container at a position, with the owner standing behind it", async () => {
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);

    const placementId = await placeItemByHand(db, {
      containerId: releaseOrder,
      itemId: story,
      position: 63,
    });

    // `assertedBy` NAMES THE OWNER, which is what makes a hand-placed member
    // distinguishable from an imported one (ADR-0017, ADR-0071). A placement
    // written with no source would render with no origin at all.
    expect(
      (await findPlacementsInContainer(db, releaseOrder, { limit: 100 })).rows,
    ).toStrictEqual([
      { id: placementId, itemId: story, title: null, position: 63, assertedBy: ["Owner"] },
    ]);
  });

  it("puts the same item in several containers, each at its own position", async () => {
    // THE PRODUCT'S CENTRAL CLAIM, now performed by the owner rather than
    // received from a provider (ADR-0009, ADR-0061). Each container owns its
    // membership outright, so placing into the second does not disturb the first.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const storyOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);

    await placeItemByHand(db, { containerId: releaseOrder, itemId: story, position: 63 });
    await placeItemByHand(db, { containerId: storyOrder, itemId: story, position: 1 });

    expect((await findPlacementsOfItem(db, story, { limit: 10 })).rows).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ containerId: releaseOrder, position: 63 }),
        expect.objectContaining({ containerId: storyOrder, position: 1 }),
      ]),
    );
  });

  it("puts the same item in one container twice, at DISTINCT positions -- a Repeat", async () => {
    // ADR-0009 licences it and CONTEXT.md names it: a recap at position 1 and
    // the episode at position 5 are one item, twice, on purpose. The
    // qualification is load-bearing -- see the refusal below, which is the same
    // gesture at ONE position.
    const season = await anItem(db, { isContainer: true, isOrdered: true });
    const episode = await anItem(db);

    const recap = await placeItemByHand(db, { containerId: season, itemId: episode, position: 1 });
    const shown = await placeItemByHand(db, { containerId: season, itemId: episode, position: 5 });

    expect(
      (await findPlacementsInContainer(db, season, { limit: 100 })).rows.map((p) => [
        p.id,
        p.position,
      ]),
    ).toStrictEqual([
      [recap, 1],
      [shown, 5],
    ]);
  });

  it("lets two DIFFERENT items share one position", async () => {
    // ADR-0009: a story-order container holding both a novel and the film
    // adapting it must place them at one point without inventing an order
    // between them. The absence of a unique on (container, position) is what
    // allows it, and this is the owner's hand reaching that.
    const storyOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const novel = await anItem(db);
    const film = await anItem(db);

    await placeItemByHand(db, { containerId: storyOrder, itemId: novel, position: 3 });
    await placeItemByHand(db, { containerId: storyOrder, itemId: film, position: 3 });

    const held = (await findPlacementsInContainer(db, storyOrder, { limit: 100 })).rows;
    expect(held.map((p) => p.position)).toStrictEqual([3, 3]);
    expect(new Set(held.map((p) => p.itemId))).toStrictEqual(new Set([novel, film]));
  });

  it("puts an item in a container with NO position, and it is still a member", async () => {
    // Migration 2, and CONTEXT.md's Unplaced: a member with no position is a
    // PLACEMENT WITH NO POSITION, never an absent one. The owner reaches the
    // same state a provider does when its ordering cannot place a member.
    const category = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);

    const placementId = await placeItemByHand(db, {
      containerId: category,
      itemId: story,
      position: null,
    });

    expect((await findPlacementsInContainer(db, category, { limit: 100 })).rows).toStrictEqual([
      { id: placementId, itemId: story, title: null, position: null, assertedBy: ["Owner"] },
    ]);
  });

  it("REFUSES the same item twice in one container at ONE position", async () => {
    // ADR-0116: the unique is `(owner, container, item, position)` with NULLS
    // NOT DISTINCT, so this gesture is refused by the database. It is refused
    // HERE as a typed refusal rather than as a driver error, because the
    // surface above has to tell "you already placed this there" from "the
    // catalogue is broken" -- the distinction `ItemRefused` exists to make.
    const season = await anItem(db, { isContainer: true, isOrdered: true });
    const episode = await anItem(db);
    await placeItemByHand(db, { containerId: season, itemId: episode, position: 1 });

    await expect(
      placeItemByHand(db, { containerId: season, itemId: episode, position: 1 }),
    ).rejects.toBeInstanceOf(PlacementRefused);
  });

  it("REFUSES the same item twice in one container with NO position, both times", async () => {
    // THE HALF `NULLS NOT DISTINCT` IS FOR, and the one an implementation
    // reading PostgreSQL's default would get wrong: two nulls are held EQUAL
    // here, so "a member, position unknown" twice is one claim rather than two.
    const category = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    await placeItemByHand(db, { containerId: category, itemId: story, position: null });

    await expect(
      placeItemByHand(db, { containerId: category, itemId: story, position: null }),
    ).rejects.toBeInstanceOf(PlacementRefused);
  });
});

describe("removePlacementByHand", () => {
  it("takes the member out of that container and leaves every other placement standing", async () => {
    // ADR-0061: every container owns its membership outright, so taking an item
    // out of one ordering is not taking it out of the catalogue. This is the
    // claim that separates this product from a folder tree, run backwards.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const storyOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    const inRelease = await placeItemByHand(db, {
      containerId: releaseOrder,
      itemId: story,
      position: 63,
    });
    await placeItemByHand(db, { containerId: storyOrder, itemId: story, position: 1 });

    expect(await removePlacementByHand(db, inRelease)).toBe(true);

    expect(
      (await findPlacementsInContainer(db, releaseOrder, { limit: 100 })).rows,
    ).toStrictEqual([]);
    expect((await findPlacementsOfItem(db, story, { limit: 10 })).rows).toStrictEqual([
      expect.objectContaining({ containerId: storyOrder, position: 1 }),
    ]);
  });

  it("answers false for a placement that is not there, rather than failing", async () => {
    // The posture `retitleItemByHand` takes for an id addressing no live item
    // (ADR-0066): an answer rather than a fault, so a stale undo button or a
    // double-submitted form is not a 500.
    expect(await removePlacementByHand(db, crypto.randomUUID())).toBe(false);
  });
});

describe("restorePlacementByHand", () => {
  it("undoes a removal: the placement returns with its position AND its origin", async () => {
    // ADR-0046 makes removing a placement the one edit that gets no dialog and
    // an undo instead, because it is the most frequent editing act in a product
    // built on multi-placement.
    //
    // WITH ITS ORIGIN IS HALF THE ASSERTION. Clearing the tombstone gives the
    // row back; `assertedBy` is what proves the member did not come back as a
    // claim nobody made, which is what a removal that tombstoned the sources
    // would have produced.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    const placementId = await placeItemByHand(db, {
      containerId: releaseOrder,
      itemId: story,
      position: 63,
    });
    await removePlacementByHand(db, placementId);

    expect(await restorePlacementByHand(db, placementId)).toBe(true);

    expect(
      (await findPlacementsInContainer(db, releaseOrder, { limit: 100 })).rows,
    ).toStrictEqual([
      { id: placementId, itemId: story, title: null, position: 63, assertedBy: ["Owner"] },
    ]);
  });

  it("keeps a provider's claim standing across the whole round trip", async () => {
    // THE RULE THE REMOVAL IS WRITTEN TO OBEY (ADR-0017): a source may take back
    // only what it said itself, so an owner's removal must not mark a provider's
    // claim withdrawn. If the removal tombstoned `placement_sources`, this
    // member would return anonymous -- and would be indistinguishable from one
    // the provider really had withdrawn.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    const wiki = await aProvider(db, "https://wiki.example.com", "The Wiki");
    const placementId = await assertPlacement(db, {
      containerId: releaseOrder,
      itemId: story,
      position: 63,
      sourceId: wiki,
    });

    await removePlacementByHand(db, placementId);
    await restorePlacementByHand(db, placementId);

    expect(
      (await findPlacementsInContainer(db, releaseOrder, { limit: 100 })).rows,
    ).toStrictEqual([
      { id: placementId, itemId: story, title: null, position: 63, assertedBy: ["The Wiki"] },
    ]);
  });
});

describe("a removal and a re-placement meeting over one tuple", () => {
  /*
   * THE COLLISION CNCORE-72 ASKED TO HAVE DECIDED, arriving through the door the
   * brief did not expect. It anticipated an UNDO colliding with a recreated
   * placement; that cannot happen, because a tombstoned row goes on occupying
   * its tuple and so nothing can recreate it. What an owner really meets is the
   * other order: they remove a member and then put it back where it was, and the
   * row standing in the way is one they cannot see.
   *
   * THE DECISION: the re-placement RESURRECTS that placement rather than being
   * refused by it. Refusing would be the product reporting a conflict with
   * something invisible -- "a UI that permits the gesture and then fails the
   * write is worse than one that refuses the gesture" (ADR-0116), and here
   * there is no gesture to refuse, because the member is not on the page.
   */
  it("puts a removed member back where it was, rather than refusing over its tombstone", async () => {
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    const placementId = await placeItemByHand(db, {
      containerId: releaseOrder,
      itemId: story,
      position: 63,
    });
    await removePlacementByHand(db, placementId);

    const replaced = await placeItemByHand(db, {
      containerId: releaseOrder,
      itemId: story,
      position: 63,
    });

    // THE SAME PLACEMENT RETURNING, not a second one: the tuple admits one row
    // and the id is a stable surrogate every external reference already holds.
    expect(replaced).toBe(placementId);
    expect(
      (await findPlacementsInContainer(db, releaseOrder, { limit: 100 })).rows,
    ).toStrictEqual([
      { id: placementId, itemId: story, title: null, position: 63, assertedBy: ["Owner"] },
    ]);
  });

  it("leaves ONE live member when an undo lands after that re-placement", async () => {
    // THE DECIDED OUTCOME, stated as what the owner is left holding. The undo
    // arrives at a placement the re-placement already brought back, so it clears
    // a tombstone that is no longer set and the container holds one member --
    // never two rows, and never a refusal the owner cannot act on.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    const placementId = await placeItemByHand(db, {
      containerId: releaseOrder,
      itemId: story,
      position: 63,
    });
    await removePlacementByHand(db, placementId);
    await placeItemByHand(db, { containerId: releaseOrder, itemId: story, position: 63 });

    await restorePlacementByHand(db, placementId);

    expect(
      (await findPlacementsInContainer(db, releaseOrder, { limit: 100 })).rows,
    ).toStrictEqual([
      { id: placementId, itemId: story, title: null, position: 63, assertedBy: ["Owner"] },
    ]);
  });
});

describe("what placing and removing does to work browsing", () => {
  it("keeps `holds_work` true while a work sits there, and false once it is removed", async () => {
    // ADR-0077: a container folds into `work` and is offered for browsing only
    // when it HOLDS one, which `maintain_holds_work` recomputes on every
    // placement write (migration 1). The owner's hand reaches that trigger the
    // same way an import does -- a removal is an UPDATE of `deleted_at`, and the
    // trigger counts only live placements.
    //
    // ASSERTED THROUGH `readWorks` rather than off the column, because the
    // column is not the claim: what matters is whether the container is offered
    // to a reader asking what they can watch.
    const boxSet = await anItemTitled(db, "A box set", { isContainer: true, isOrdered: true });
    const film = await anItem(db, { kind: "work" });

    const placementId = await placeItemByHand(db, {
      containerId: boxSet,
      itemId: film,
      position: 1,
    });
    const offered = await readWorks(db, { limit: 100 });
    expect(offered.rows.map((row) => row.id)).toContain(boxSet);

    await removePlacementByHand(db, placementId);

    const afterwards = await readWorks(db, { limit: 100 });
    expect(afterwards.rows.map((row) => row.id)).not.toContain(boxSet);
  });
});

describe("what a restore will NOT bring back", () => {
  it("refuses a placement a PROVIDER withdrew, which is not the owner's removal to undo", async () => {
    // FOUND BY REVIEW. `restorePlacementByHand` cleared `deleted_at` on any
    // placement id at all, and `import.ts` tombstones a placement too -- when a
    // provider stops asserting a member, its `placement_sources` go first and
    // the placement follows once nothing stands behind it.
    //
    // So an undo pointed at one of those revived a member with NO live source:
    // `assertedBy: []`, a claim nobody makes, contradicting the withdrawal the
    // provider actually performed. That is the state "clear both" was written to
    // prevent, arriving through the other door.
    //
    // THE RULE: a placement with sources, none of them live, is one a source
    // withdrew -- and a source may take back only what it said itself (ADR-0017),
    // which cuts both ways. The owner does not get to put the provider's words
    // back either.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    const wiki = await aProvider(
      db,
      "https://withdrawn.example.com",
      "A wiki that changed its mind",
    );
    const placementId = await assertPlacement(db, {
      containerId: releaseOrder,
      itemId: story,
      position: 63,
      sourceId: wiki,
    });

    // The withdrawal as `import.ts` performs it: the claim, then the placement.
    await db
      .update(placementSources)
      .set({ deletedAt: sql`now()` })
      .where(eq(placementSources.placementId, placementId));
    await db
      .update(placements)
      .set({ deletedAt: sql`now()` })
      .where(eq(placements.id, placementId));

    expect(await restorePlacementByHand(db, placementId)).toBe(false);
    expect(
      (await findPlacementsInContainer(db, releaseOrder, { limit: 100 })).rows,
    ).toStrictEqual([]);
  });

  it("still restores a placement NO source ever asserted, which is a real state", async () => {
    // THE CASE THE RULE ABOVE MUST NOT CATCH. A placement with no source rows at
    // all is one nobody ever claimed -- `findPlacementsInContainer` renders it
    // with an empty `assertedBy` rather than dropping it, because "the read path
    // does not get to decide a row does not exist because its provenance was
    // never recorded". An owner removing one may undo that like any other.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    const placementId = await aPlacement(db, {
      containerId: releaseOrder,
      itemId: story,
      position: 7,
    });
    await removePlacementByHand(db, placementId);

    expect(await restorePlacementByHand(db, placementId)).toBe(true);
    expect(
      (await findPlacementsInContainer(db, releaseOrder, { limit: 100 })).rows,
    ).toStrictEqual([{ id: placementId, itemId: story, title: null, position: 7, assertedBy: [] }]);
  });
});
