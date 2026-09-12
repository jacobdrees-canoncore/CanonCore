import { beforeAll, describe, expect, it } from "vitest";

import { assertPlacement, type Database, findPlacementsInContainer } from "./index";
import { anItemTitled, aPlacement, connect, ownerSource } from "./testing/catalogue";

let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("findPlacementsInContainer", () => {
  it("answers with what the container holds, in position order", async () => {
    // ADR-0018: the ordering lives on the PLACEMENT, so this is the container's
    // own sequence rather than any global fact about the items in it.
    //
    // WRITTEN IN THE ANSWER'S REVERSE ORDER, which is what makes it a test:
    // written in order it would pass against a query with no `order by` at all,
    // because PostgreSQL hands a small table back in insertion order.
    const owner = await ownerSource(db);
    const season = await anItemTitled(db, "An ordering with three stories", {
      isContainer: true,
      isOrdered: true,
    });
    const third = await anItemTitled(db, "The third story");
    const first = await anItemTitled(db, "The first story");
    const second = await anItemTitled(db, "The second story");
    await aPlacement(db, { containerId: season, itemId: third, position: 3, sourceId: owner });
    await aPlacement(db, { containerId: season, itemId: first, position: 1, sourceId: owner });
    await aPlacement(db, { containerId: season, itemId: second, position: 2, sourceId: owner });

    const held = await findPlacementsInContainer(db, season);

    expect(held.map((placement) => placement.itemId)).toEqual([first, second, third]);
    expect(held[0]).toMatchObject({ title: "The first story", position: 1 });
  });

  it("keeps a placement the source could not position, after the ones it could", async () => {
    // CONTEXT.md: an Unplaced member is a PLACEMENT WITH NO POSITION, never an
    // absent placement -- "dropping it shrinks the container silently and
    // numbering it last asserts an order the source never gave". So it is
    // answered, and answered with the absence intact.
    //
    // IT COMES LAST, and that is a consequence rather than a claim about where
    // it belongs: PostgreSQL sorts NULLs last ascending, and the ordering says
    // only that a placement with no asserted position cannot outrank one that
    // has one. `placements.test.ts` states the same consequence for the mirror
    // query.
    const owner = await ownerSource(db);
    const container = await anItemTitled(db, "An ordering with a story it cannot place", {
      isContainer: true,
      isOrdered: true,
    });
    const unplaceable = await anItemTitled(db, "A story with no release date");
    const placed = await anItemTitled(db, "A story the ordering can place");
    await assertPlacement(db, {
      containerId: container,
      itemId: unplaceable,
      position: null,
      sourceId: owner,
    });
    await assertPlacement(db, {
      containerId: container,
      itemId: placed,
      position: 1,
      sourceId: owner,
    });

    const held = await findPlacementsInContainer(db, container);

    expect(held).toHaveLength(2);
    expect(held.map((placement) => placement.itemId)).toEqual([placed, unplaceable]);
    expect(held[1]).toMatchObject({ position: null });
  });

  it("answers a repeat twice, once at each position", async () => {
    // CONTEXT.md's Repeat, and ADR-0009 is why it is allowed: "a recap at
    // position 1 and the episode at position 5 are one item, twice, on purpose".
    // The word `duplicate` is banned for it precisely because collapsing the two
    // is the mistake.
    //
    // A JOIN IS WHERE THIS GOES WRONG QUIETLY. The query joins `items` to get a
    // title, and one item matching two placements is two rows -- so anything
    // that deduplicated by item id would swallow the recap and leave the
    // container looking a story short.
    const owner = await ownerSource(db);
    const container = await anItemTitled(db, "An ordering that opens with a recap", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItemTitled(db, "A story shown twice");
    await aPlacement(db, { containerId: container, itemId: story, position: 1, sourceId: owner });
    await aPlacement(db, { containerId: container, itemId: story, position: 5, sourceId: owner });

    const held = await findPlacementsInContainer(db, container);

    expect(held.map((placement) => placement.itemId)).toEqual([story, story]);
    expect(held.map((placement) => placement.position)).toEqual([1, 5]);
  });

  it("names the placement each row is reached through", async () => {
    // ADR-0066: the path is identity and the QUERY is the route, so a link out
    // of this list carries `?via=<placement-id>` to say which ordering the
    // reader arrived through. The id has to come from here, because the
    // container is the only place that knows which of an item's placements this
    // one is -- and a repeat proves it: both rows are the same item, so the item
    // id cannot tell the two arrivals apart and only the placement id can.
    const owner = await ownerSource(db);
    const container = await anItemTitled(db, "An ordering reached through", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItemTitled(db, "A story reached two ways");
    const recap = await aPlacement(db, {
      containerId: container,
      itemId: story,
      position: 1,
      sourceId: owner,
    });
    const episode = await aPlacement(db, {
      containerId: container,
      itemId: story,
      position: 5,
      sourceId: owner,
    });

    const held = await findPlacementsInContainer(db, container);

    expect(held.map((placement) => placement.id)).toEqual([recap, episode]);
  });
});
