import { beforeAll, describe, expect, it } from "vitest";

import {
  type Database,
  findPlacementsInContainer,
  movePlacementByHand,
  placeItemByHand,
  PlacementRefused,
} from "./index";
import { anItem, connect } from "./testing/catalogue";

/**
 * THE FOURTH OF THE OWNER'S FOUR MUTATIONS (CNCORE-73), and the one ADR-0116 is
 * actually about: `place`, `remove` and `restore` landed under CNCORE-72 and
 * `move` arrives with the drag that needs it.
 *
 * IT WRITES THE DELTA RATHER THAN THE ORDERING. The placement that moved, and
 * the siblings whose Position actually changed -- never the rebuilt list. A
 * whole-ordering write rewrites every Placement in the container on every drop,
 * which destroys the distinction between a Position somebody asserted and one a
 * drag recomputed (ADR-0116, ADR-0017).
 *
 * ASSERTED THROUGH THE READ PATH rather than by selecting from `placements`,
 * which is `placing-by-hand.test.ts`'s reason: what an owner is owed is that
 * the ordering reads differently, and a test against the table would go on
 * passing if the write were correct and invisible.
 */
let db: Database;

beforeAll(async () => {
  db = await connect();
});

/** A container holding three members at the positions given, in that order. */
async function anOrderingOf(positions: number[]) {
  const container = await anItem(db, { isContainer: true, isOrdered: true });
  const members = [];
  for (const position of positions) {
    const itemId = await anItem(db);
    members.push({
      itemId,
      id: await placeItemByHand(db, { containerId: container, itemId, position }),
      position,
    });
  }
  return { container, members };
}

/** The ordering as a reader reads it: each member's position, in page order. */
async function orderingIn(container: string) {
  const { entries } = await findPlacementsInContainer(db, container, { limit: 100 });
  return entries.map(({ id, position }) => ({ id, position }));
}

describe("movePlacementByHand", () => {
  it("moves a member to a new position, and writes the siblings the drag passed", async () => {
    const { container, members } = await anOrderingOf([1, 2, 3]);
    const [first, second, third] = members;
    if (!first || !second || !third) throw new Error("the fixture seeded three members");

    // The last member dragged to the top. ADR-0116: the client computes which
    // siblings moved, and this is that delta -- the two it passed, and nothing
    // else in the container.
    await movePlacementByHand(db, {
      id: third.id,
      containerId: container,
      position: 1,
      siblings: [
        { id: first.id, position: 2 },
        { id: second.id, position: 3 },
      ],
    });

    expect(await orderingIn(container)).toStrictEqual([
      { id: third.id, position: 1 },
      { id: first.id, position: 2 },
      { id: second.id, position: 3 },
    ]);
  });
});

describe("a Repeat reordered past its own other copy", () => {
  it("permutes the positions even though one copy passes through the other's", async () => {
    /*
     * THE UNIQUE IS `(owner, container, item, position)`, so a Repeat is the one
     * shape where a reorder's INTERMEDIATE state can break a rule its END state
     * keeps (ADR-0009 licences the Repeat; ADR-0116 names the tuple). Three rows
     * whose positions rotate are three UPDATEs, and a plain unique is checked
     * row by row -- so whichever copy moves first lands on the other's tuple.
     *
     * A recap at the top and the episode further down is the real gesture: an
     * owner dragging the episode above its own recap.
     */
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const repeated = await anItem(db);
    const other = await anItem(db);

    const recap = await placeItemByHand(db, { containerId: container, itemId: repeated, position: 1 });
    const between = await placeItemByHand(db, { containerId: container, itemId: other, position: 2 });
    const episode = await placeItemByHand(db, {
      containerId: container,
      itemId: repeated,
      position: 3,
    });

    await movePlacementByHand(db, {
      id: episode,
      containerId: container,
      position: 1,
      siblings: [
        { id: recap, position: 2 },
        { id: between, position: 3 },
      ],
    });

    expect(await orderingIn(container)).toStrictEqual([
      { id: episode, position: 1 },
      { id: recap, position: 2 },
      { id: between, position: 3 },
    ]);
  });
});

describe("a Placement cycle", () => {
  it("refuses a move that would put a container inside something it already holds", async () => {
    /*
     * ADR-0074's container half, which ADR-0116 says is the SERVER's job and
     * not the drag's. The reference implementation removes a node's descendants
     * from the drop targets for the duration of a drag, so the gesture cannot
     * express a cycle -- correct interaction and worthless as an invariant,
     * because a crafted call to this mutation still writes one and the database
     * stores it happily.
     *
     * ASSERTED THROUGH THE MUTATION RATHER THAN THE UI, deliberately: a UI guard
     * with no server check reads as an enforced rule to everyone except the
     * person who bypasses it.
     */
    const outer = await anItem(db, { isContainer: true, isOrdered: true });
    const inner = await anItem(db, { isContainer: true, isOrdered: true });
    const elsewhere = await anItem(db, { isContainer: true, isOrdered: true });

    // `outer` holds `inner`.
    await placeItemByHand(db, { containerId: outer, itemId: inner, position: 1 });
    // `outer` also sits somewhere harmless, so there is a placement to drag.
    const stray = await placeItemByHand(db, {
      containerId: elsewhere,
      itemId: outer,
      position: 1,
    });

    // Dragging it into `inner` would close outer -> inner -> outer.
    await expect(
      movePlacementByHand(db, { id: stray, containerId: inner, position: 1, siblings: [] }),
    ).rejects.toThrow(PlacementRefused);
  });

  it("refuses placing a container inside itself", async () => {
    const container = await anItem(db, { isContainer: true, isOrdered: true });

    await expect(
      placeItemByHand(db, { containerId: container, itemId: container, position: 1 }),
    ).rejects.toThrow(PlacementRefused);
  });

  it("refuses placing a container inside one it already holds, two levels down", async () => {
    // The walk, not merely the self-check: outer -> middle -> inner, and then
    // inner asked to hold outer.
    const outer = await anItem(db, { isContainer: true, isOrdered: true });
    const middle = await anItem(db, { isContainer: true, isOrdered: true });
    const inner = await anItem(db, { isContainer: true, isOrdered: true });

    await placeItemByHand(db, { containerId: outer, itemId: middle, position: 1 });
    await placeItemByHand(db, { containerId: middle, itemId: inner, position: 1 });

    await expect(
      placeItemByHand(db, { containerId: inner, itemId: outer, position: 1 }),
    ).rejects.toThrow(PlacementRefused);
  });

  it("lets the same item sit in two orderings that do not reach each other", async () => {
    // THE REFUSAL MUST NOT EAT MULTI-PLACEMENT, which is the product's central
    // claim (ADR-0009). Two containers both holding one item is a diamond, not
    // a cycle, and a walk that refused it would refuse the thing this catalogue
    // is for.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const storyOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const season = await anItem(db, { isContainer: true, isOrdered: true });

    await placeItemByHand(db, { containerId: releaseOrder, itemId: season, position: 1 });

    await expect(
      placeItemByHand(db, { containerId: storyOrder, itemId: season, position: 1 }),
    ).resolves.toEqual(expect.any(String));
  });
});
