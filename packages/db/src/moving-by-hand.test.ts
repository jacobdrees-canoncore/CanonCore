import { beforeAll, describe, expect, it } from "vitest";

import {
  type Database,
  findPlacementsInContainer,
  movePlacementByHand,
  PlacementRefused,
  placeItemByHand,
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

/**
 * A container holding one placement per position given, in that order.
 *
 * `placed` RATHER THAN `members`, which `CONTEXT.md` rejects as a name for the
 * thing: "Members" is the reader's heading from the container's end and
 * Placement is the word in code, because a Repeat puts one item in one
 * container twice and only the placement tells those two rows apart.
 */
async function anOrderingOf(positions: number[]) {
  const container = await anItem(db, { isContainer: true, isOrdered: true });
  const placed = [];
  for (const position of positions) {
    const itemId = await anItem(db);
    placed.push({
      itemId,
      id: await placeItemByHand(db, { containerId: container, itemId, position }),
      position,
    });
  }
  return { container, placed };
}

/** The ordering as a reader reads it: each placement's position, in page order. */
async function orderingIn(container: string) {
  const { rows } = await findPlacementsInContainer(db, container, { limit: 100 });
  return rows.map(({ id, position }) => ({ id, position }));
}

describe("movePlacementByHand", () => {
  it("moves a member to a new position, and writes the siblings the drag passed", async () => {
    const { container, placed } = await anOrderingOf([1, 2, 3]);
    const [first, second, third] = placed;
    if (!first || !second || !third) throw new Error("the fixture seeded three placements");

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

    const recap = await placeItemByHand(db, {
      containerId: container,
      itemId: repeated,
      position: 1,
    });
    const between = await placeItemByHand(db, {
      containerId: container,
      itemId: other,
      position: 2,
    });
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

    const refused = await placeItemByHand(db, {
      containerId: container,
      itemId: container,
      position: 1,
    }).then(
      () => undefined,
      (cause: unknown) => cause,
    );

    /*
     * THE SELF-HOLD HALF OF `23514`, which is a SECOND raise inside
     * `refuse_placement_cycle` -- `container % cannot hold itself` at
     * `item_id = container_id`, beside the walk's `% already holds %`. Both
     * carry `ERRCODE = check_violation`, so one sentence reports both and it
     * has to hold for both. It named the walk alone until review of CNCORE-255.
     */
    expect(refused).toBeInstanceOf(PlacementRefused);
    expect(refused).toHaveProperty(
      "message",
      "A container cannot hold itself, or something it already sits inside.",
    );
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

describe("what a move may not reach", () => {
  it("leaves a sibling in ANOTHER container alone", async () => {
    /*
     * THE ARITHMETIC IS THE CALLER'S, THE SCOPE IS NOT (ADR-0116). That record
     * hands the client the job of working out which siblings moved, and in the
     * same breath says "the client guard is not the check" about the cycle. The
     * sibling SET is the same shape of guard: a request naming a placement in
     * another ordering would rewrite a position nobody dragged, in a container
     * the owner was not even looking at.
     *
     * Found by review, which read the `where` and saw it matched on id alone.
     */
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const elsewhere = await anItem(db, { isContainer: true, isOrdered: true });
    const here = await anItem(db);
    const there = await anItem(db);

    const moving = await placeItemByHand(db, { containerId: container, itemId: here, position: 1 });
    const untouched = await placeItemByHand(db, {
      containerId: elsewhere,
      itemId: there,
      position: 9,
    });

    await expect(
      movePlacementByHand(db, {
        id: moving,
        containerId: container,
        position: 2,
        siblings: [{ id: untouched, position: 400 }],
      }),
    ).rejects.toThrow(PlacementRefused);

    // AND NOTHING MOVED AT ALL, which is the half a rejection alone would not
    // give: the whole delta is one transaction, so a sibling it may not reach
    // takes the move down with it rather than half-applying.
    expect(await orderingIn(elsewhere)).toStrictEqual([{ id: untouched, position: 9 }]);
    expect(await orderingIn(container)).toStrictEqual([{ id: moving, position: 1 }]);
  });

  it("refuses a position the column cannot hold, as a refusal rather than a fault", async () => {
    // `position` is a 32-bit `integer` (migration 1) and the procedure's schema
    // accepts any safe integer, so the gap between them is reachable. It is the
    // owner asking for something impossible, which is what `PlacementRefused`
    // is for -- not a broken catalogue.
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    const placed = await placeItemByHand(db, {
      containerId: container,
      itemId: story,
      position: 1,
    });

    // THE SENTENCE NAMES THE OVERFLOW (CNCORE-255). This is the one cause of
    // the five that no router test drives, so the refusal's own words are where
    // it is pinned: a generic "the catalogue refused that move" would leave the
    // Owner with nothing to change.
    const refused = await movePlacementByHand(db, {
      id: placed,
      containerId: container,
      position: Number.MAX_SAFE_INTEGER,
      siblings: [],
    }).then(
      () => undefined,
      (cause: unknown) => cause,
    );

    // BOTH, AND `toThrow` GIVES NEITHER ON ITS OWN: passed a string it matches
    // a SUBSTRING and checks no class, so a plain `Error` carrying this text
    // would pass. The class is what tells a refusal from a broken catalogue.
    expect(refused).toBeInstanceOf(PlacementRefused);
    expect(refused).toHaveProperty(
      "message",
      "That position is outside the range the catalogue can store.",
    );
  });
});
