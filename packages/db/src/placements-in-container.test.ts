import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  assertPlacement,
  type Database,
  findPlacementsInContainer,
  placementSources,
} from "./index";
import { anItemTitled, aPlacement, aProvider, connect, ownerSource } from "./testing/catalogue";

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

describe("findPlacementsInContainer, on who asserted each placement", () => {
  it("tells two sources disagreeing about position from one source saying it twice", async () => {
    // THE CRITERION, at the query. ADR-0017: "sources disagreeing about position
    // produce two placement rows", and ADR-0009 licences a Repeat -- which is
    // ALSO one item twice in one container at two positions. ADR-0017 says
    // outright that nothing STORED separates them: what does is who asserted
    // them, a repeat's rows coming from one source and a disagreement's from two.
    //
    // BOTH SHAPES IN ONE TEST, because either alone passes against a query
    // answering a constant. The difference between the two answers IS the
    // criterion, and a test that only ever saw one of them could not state it.
    const wiki = await aProvider(
      db,
      "https://provider.test/by-release",
      "A wiki that orders by release",
    );
    const broadcaster = await aProvider(
      db,
      "https://provider.test/by-broadcast",
      "A database that orders by broadcast",
    );
    const disputed = await anItemTitled(db, "An ordering two sources disagree about", {
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

    const agreed = await anItemTitled(db, "An ordering that opens with its own recap", {
      isContainer: true,
      isOrdered: true,
    });
    const recapped = await anItemTitled(db, "A story the wiki shows twice");
    await assertPlacement(db, {
      containerId: agreed,
      itemId: recapped,
      position: 1,
      sourceId: wiki,
    });
    await assertPlacement(db, {
      containerId: agreed,
      itemId: recapped,
      position: 5,
      sourceId: wiki,
    });

    const disagreement = await findPlacementsInContainer(db, disputed);
    const repeat = await findPlacementsInContainer(db, agreed);

    expect(disagreement.map((placement) => placement.assertedBy)).toStrictEqual([
      ["A database that orders by broadcast"],
      ["A wiki that orders by release"],
    ]);
    expect(repeat.map((placement) => placement.assertedBy)).toStrictEqual([
      ["A wiki that orders by release"],
      ["A wiki that orders by release"],
    ]);
  });

  it("names sources agreeing in the spokesman's order, so the one that speaks leads", async () => {
    // ADR-0017: sources AGREEING about a placement are recorded against ONE row,
    // and which of them speaks for it is decided by rank first (ADR-0024, the
    // favourite is the lock), then the one global source order (ADR-0025), then
    // a stable id. `spokesmanFor` applies those three terms to pick one name;
    // this list applies the same three to ORDER every name, so the two cannot
    // come to disagree about who is speaking.
    //
    // THE FAVOURITE IS CREATED SECOND AND RANKED UP, which is what makes this a
    // test: under insertion order, or under the source order alone, it comes
    // back second. Only rank-first puts it in front.
    const first = await aProvider(
      db,
      "https://provider.test/came-first",
      "A source that came first",
    );
    const later = await aProvider(
      db,
      "https://provider.test/came-later",
      "A source that came later and is preferred",
    );
    const container = await anItemTitled(db, "An ordering two sources corroborate", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItemTitled(db, "A story both of them place at one");
    await assertPlacement(db, {
      containerId: container,
      itemId: story,
      position: 1,
      sourceId: first,
    });
    const corroborated = await assertPlacement(db, {
      containerId: container,
      itemId: story,
      position: 1,
      sourceId: later,
    });
    // Set here rather than passed in, for the reason `placements.test.ts` gives:
    // nothing in the product sets a rank yet, and `assertPlacement` deliberately
    // takes no parameter for one.
    await db
      .update(placementSources)
      .set({ rank: "preferred" })
      .where(
        and(eq(placementSources.placementId, corroborated), eq(placementSources.sourceId, later)),
      );

    const held = await findPlacementsInContainer(db, container);

    expect(held.map((placement) => placement.assertedBy)).toStrictEqual([
      ["A source that came later and is preferred", "A source that came first"],
    ]);
  });

  it("still answers a placement no source stands behind, naming nobody", async () => {
    // A CLAIM NOBODY MADE IS STILL A ROW. `findPlacementsOfItem` joins its
    // spokesman LEFT for this exact reason -- an inner join would be the read
    // path deciding a placement does not exist because its provenance was never
    // recorded -- and the aggregate here has to make the same refusal.
    //
    // ONLY A FIXTURE CAN BUILD ONE, which ADR-0017 says outright: `aPlacement`
    // writes a placement with no source, and `assertPlacement` -- the one place
    // THE PRODUCT writes one -- cannot. That is what makes this worth pinning
    // rather than unreachable: the row shape exists, so the query meets it.
    const container = await anItemTitled(db, "An ordering nobody vouches for", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItemTitled(db, "A story placed by nobody");
    await aPlacement(db, { containerId: container, itemId: story, position: 1 });

    const held = await findPlacementsInContainer(db, container);

    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ title: "A story placed by nobody", assertedBy: [] });
  });
});
