import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  assertPlacement,
  type Database,
  findPlacementsInContainer,
  items,
  placementSources,
  placements,
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

    const { rows: held } = await findPlacementsInContainer(db, season, { limit: 10 });

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

    const { rows: held } = await findPlacementsInContainer(db, container, { limit: 10 });

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

    const { rows: held } = await findPlacementsInContainer(db, container, { limit: 10 });

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

    const { rows: held } = await findPlacementsInContainer(db, container, { limit: 10 });

    expect(held.map((placement) => placement.id)).toEqual([recap, episode]);
  });
});

describe("findPlacementsInContainer, walked", () => {
  it("caps what it answers with, and says how much it is not showing", async () => {
    // ADR-0119's first sentence: "every listing in CanonCore is capped". This
    // was the one listing in the app that was not -- `browse` imports a whole
    // category in one call and ADR-0077 measures one at 1,049 stories, so an
    // ordinary imported Container rendered a thousand rows.
    //
    // `total` IS THE OTHER HALF OF THE CAP. A listing that could only count
    // what it returned would report the first page as the whole container,
    // which is the one lie an ordering must not tell about itself.
    const owner = await ownerSource(db);
    const container = await anItemTitled(db, "An ordering of three, capped at two", {
      isContainer: true,
      isOrdered: true,
    });
    for (const position of [1, 2, 3]) {
      const story = await anItemTitled(db, `Story ${position} of the capped ordering`);
      await aPlacement(db, { containerId: container, itemId: story, position, sourceId: owner });
    }

    const held = await findPlacementsInContainer(db, container, { limit: 2 });

    expect(held.rows).toHaveLength(2);
    expect(held.total).toBe(3);
    // The id to walk on from, which is the LAST PLACEMENT THIS PAGE SHOWED.
    expect(held.continuesAfter).toBe(held.rows.at(-1)?.id);
  });

  it("reaches every member by walking, and lands on none of them twice", async () => {
    // ADR-0119's criterion, over a container's own ordering: every member
    // reachable however many there are, none twice and none skipped.
    //
    // THE PAGE IS CUT AT A TIE rather than at a size that might land on one,
    // which is that record's own rule about testing a keyset walk. ADR-0009
    // keeps no unique constraint on (container_id, position), so two placements
    // may share one -- and a cursor comparing only the position steps over the
    // second of them. Two at position 2 with a page of two puts the boundary
    // between them whichever way their ids fall.
    //
    // AND THE UNPLACED MEMBER IS PAST IT, which is the other regime: a position
    // nothing asserted is NULL, and `(null, x) > (k, y)` is NULL rather than
    // true -- so a plain row comparison loses the whole Unplaced block
    // permanently, from every page.
    const owner = await ownerSource(db);
    const container = await anItemTitled(db, "An ordering walked to its end", {
      isContainer: true,
      isOrdered: true,
    });
    const written: string[] = [];
    for (const position of [1, 2, 2, null]) {
      const story = await anItemTitled(db, `A story of the walked ordering at ${position}`);
      written.push(
        await assertPlacement(db, {
          containerId: container,
          itemId: story,
          position,
          sourceId: owner,
        }),
      );
    }

    const walked = await walkEveryMemberOf(container, 2);

    expect([...walked].sort()).toStrictEqual([...written].sort());
    expect(new Set(walked).size).toBe(walked.length);
  });

  it("reports the ordering's size past its end too, where no Row carries it", async () => {
    // THE SIZE'S OTHER POSITION. `total` rides on the Rows -- one statement,
    // one snapshot, so a page cannot list 42 members and report 41 -- and a
    // page with NO Rows has nothing for it to ride on. It is counted by a
    // second query there, and that second query has to answer the SAME
    // question: this Listing spelled it in raw SQL on the Rows, with the join
    // between `placements` and `items` written out by hand, and in the query
    // builder beside it.
    //
    // A CURSOR AT THE LAST MEMBER is where an ordering is empty with a
    // container still behind it: the reader pressed Next on the last page, or
    // kept the link it gave them. What the size must not do there is drop to
    // zero, or answer for some other question this container was never asked.
    const owner = await ownerSource(db);
    const container = await anItemTitled(db, "An ordering asked its size past its end", {
      isContainer: true,
      isOrdered: true,
    });
    const deleted = await anItemTitled(db, "A story deleted out of the counted ordering");
    // A MEMBER THE ORDERING NO LONGER HOLDS, because the two spellings differ
    // in exactly the join that reaches it: the count has to walk to `items` to
    // see this tombstone, and a count that did not would answer four.
    await aPlacement(db, { containerId: container, itemId: deleted, position: 1, sourceId: owner });
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, deleted));
    for (const position of [2, 3, 4]) {
      const story = await anItemTitled(db, `A story of the counted ordering at ${position}`);
      await aPlacement(db, { containerId: container, itemId: story, position, sourceId: owner });
    }

    const whole = await findPlacementsInContainer(db, container, { limit: 10 });
    const beyond = await findPlacementsInContainer(db, container, {
      limit: 10,
      after: whole.rows.at(-1)?.id,
    });

    expect(whole.rows).toHaveLength(3);
    expect(whole.total).toBe(3);
    expect(beyond.rows).toStrictEqual([]);
    expect(beyond.continuesAfter).toBeNull();
    expect(beyond.total).toBe(3);
  });

  it("RESUMES past an anchor whose item was deleted, rather than starting over", async () => {
    // THE CASE ADR-0119 PREDICTED AND HAD NO INSTANCE OF, which is why it is
    // asserted here rather than reasoned about in the record.
    //
    // That record splits its tombstone exception in two and says so: the
    // catalogue's own order is `coalesce(sort_name, title)`, and a deleted item
    // has NEITHER column left -- the projection over no live statements is NULL
    // (ADR-0014) -- so its anchor names no position and the walk has to start
    // the listing over. Its own words for the other half are that "an order this
    // app does not yet hold ... reads a column a delete does NOT destroy, so its
    // anchor still has a place and can still be resumed from".
    //
    // `placements.position` IS THAT COLUMN. No tombstone touches it, so a reader
    // five pages into a container is not sent back to its first page because one
    // member went away under them.
    const owner = await ownerSource(db);
    const container = await anItemTitled(db, "An ordering a member left", {
      isContainer: true,
      isOrdered: true,
    });
    const written: string[] = [];
    for (const position of [1, 2, 3, 4]) {
      const story = await anItemTitled(db, `A story of the ordering a member left, ${position}`);
      written.push(
        await assertPlacement(db, {
          containerId: container,
          itemId: story,
          position,
          sourceId: owner,
        }),
      );
    }
    const cut = await findPlacementsInContainer(db, container, { limit: 2 });
    // THE PAGE ENDS ON THE ANCHOR, so what follows is a cursor a reader was
    // actually handed rather than an id written here.
    expect(cut.continuesAfter).toBe(written[1]);
    const anchor = cut.rows[1];
    if (!anchor) throw new Error("the page carried no second row to cut at");
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, anchor.itemId));

    const kept = await findPlacementsInContainer(db, container, {
      limit: 10,
      after: cut.continuesAfter ?? "",
    });

    // THE TWO MEMBERS AFTER IT, and not the ordering over again.
    expect(kept.rows.map((placement) => placement.id)).toStrictEqual(written.slice(2));
    // AND THE DELETED MEMBER IS GONE TO THE READER (ADR-0075), which is what
    // separates "the anchor keeps its place" from "the anchor is still shown".
    expect(kept.total).toBe(3);
  });

  it("RESUMES past an anchor whose PLACEMENT was deleted, which is the other tombstone", async () => {
    // THE SECOND HALF OF THE CLAIM ADR-0119 MAKES, asserted because the record
    // said "tombstoning the placement leaves its position standing too" and only
    // the ITEM half was tested -- which review of CNCORE-89 found. The two
    // tombstones are different rows: the test above deletes the member's Item,
    // and this deletes the membership itself while the Item goes on existing.
    //
    // BOTH MUST RESUME, and for the same reason: `placements.position` is a
    // stored column, so neither delete destroys the anchor's place in this
    // ordering the way a delete destroys `coalesce(sort_name, title)`.
    const owner = await ownerSource(db);
    const container = await anItemTitled(db, "An ordering a membership left", {
      isContainer: true,
      isOrdered: true,
    });
    const written: string[] = [];
    for (const position of [1, 2, 3, 4]) {
      const story = await anItemTitled(
        db,
        `A story of the ordering a membership left, ${position}`,
      );
      written.push(
        await assertPlacement(db, {
          containerId: container,
          itemId: story,
          position,
          sourceId: owner,
        }),
      );
    }
    const cut = await findPlacementsInContainer(db, container, { limit: 2 });
    expect(cut.continuesAfter).toBe(written[1]);
    await db
      .update(placements)
      .set({ deletedAt: new Date() })
      .where(eq(placements.id, cut.continuesAfter ?? ""));

    const kept = await findPlacementsInContainer(db, container, {
      limit: 10,
      after: cut.continuesAfter ?? "",
    });

    expect(kept.rows.map((placement) => placement.id)).toStrictEqual(written.slice(2));
    expect(kept.total).toBe(3);
  });

  it("starts at the beginning for a cursor naming no placement of THIS container", async () => {
    // ADR-0066's rule for a parameter that is not an identity: one that names
    // nothing names no position either, so the walk starts at the beginning
    // rather than erroring. A reader whose bookmark outlived the member it was
    // cut at gets the ordering rather than an error page.
    //
    // THREE WAYS TO NAME NOTHING, AND THE THIRD IS THE ONE THIS QUERY ADDS. A
    // malformed id and a well-formed one nobody minted are the pair `findItem`
    // already answers together. The third is a placement that EXISTS and
    // belongs to a DIFFERENT container: a position is a number inside one
    // ordering, so resuming at it would cut this container at a number its
    // reader never saw -- measured below as "the members from position 2
    // onwards", where the whole ordering is what is owed.
    const owner = await ownerSource(db);
    const container = await anItemTitled(db, "An ordering asked with a foreign cursor", {
      isContainer: true,
      isOrdered: true,
    });
    const elsewhere = await anItemTitled(db, "Another ordering entirely", {
      isContainer: true,
      isOrdered: true,
    });
    for (const position of [1, 2, 3]) {
      const story = await anItemTitled(db, `A story of the foreign-cursor ordering, ${position}`);
      await assertPlacement(db, {
        containerId: container,
        itemId: story,
        position,
        sourceId: owner,
      });
    }
    // ITS POSITION IS CHOSEN RATHER THAN DRAWN, which is ADR-0119's own rule
    // about ties applied to a mutant instead of to a page boundary. At the
    // ordering's LAST position an unscoped anchor cuts this container to
    // nothing; at its first it cuts to two of three, and whether the third
    // survives on the tie branch is decided by which uuids were handed out --
    // so the check passed or failed on luck. Measured: with the anchor read
    // unscoped and this at position 1, the mutant passed.
    const stranger = await assertPlacement(db, {
      containerId: elsewhere,
      itemId: await anItemTitled(db, "A story of another ordering entirely"),
      position: 3,
      sourceId: owner,
    });

    const whole = await findPlacementsInContainer(db, container, { limit: 10 });
    for (const after of ["not-a-uuid", crypto.randomUUID(), stranger]) {
      const asked = await findPlacementsInContainer(db, container, { limit: 10, after });

      expect(asked.rows.map((placement) => placement.id)).toStrictEqual(
        whole.rows.map((placement) => placement.id),
      );
    }
  });
});

/**
 * Every placement one container holds, reached by FOLLOWING `continuesAfter`
 * rather than by reading the answer's last row.
 *
 * THE TWO ARE NOT THE SAME, and `catalogue.test.ts` says why in its own words:
 * a `continuesAfter` that was always null would leave a walk that followed the
 * last row passing, having asserted nothing about the cursor at all.
 *
 * BOUNDED, so a cursor that does not advance fails rather than hangs.
 */
async function walkEveryMemberOf(containerId: string, limit: number): Promise<string[]> {
  const walked: string[] = [];
  let after: string | undefined;
  for (let pages = 0; pages < 100; pages += 1) {
    const page = await findPlacementsInContainer(db, containerId, { limit, after });
    walked.push(...page.rows.map((placement) => placement.id));
    if (page.continuesAfter === null) return walked;
    after = page.continuesAfter;
  }
  throw new Error(`the walk never ended: ${walked.length} placements`);
}

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

    const disagreement = (await findPlacementsInContainer(db, disputed, { limit: 10 })).rows;
    const repeat = (await findPlacementsInContainer(db, agreed, { limit: 10 })).rows;

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

    const held = (await findPlacementsInContainer(db, container, { limit: 10 })).rows;

    expect(held.map((placement) => placement.assertedBy)).toStrictEqual([
      ["A source that came later and is preferred", "A source that came first"],
    ]);
  });

  it("stops naming a source that withdrew its claim", async () => {
    // ADR-0075's tombstone, on the row that carries the claim. ADR-0017 is
    // precise about WHICH tombstone this list honours: the placement source's
    // own, "the exact analogue of the statement's own that `winning_literal`
    // checks" -- and deliberately NOT `sources.deleted_at`, which neither that
    // function nor the spokesman checks either, because one query locally more
    // correct than its twins makes one field's provenance disagree with another's.
    //
    // THE PLACEMENT ITSELF SURVIVES, which is the half worth pinning. A source
    // withdrawing its claim does not un-place the item: the other source still
    // says it sits here, so the row stands and stops naming the one that left.
    const stayed = await aProvider(db, "https://provider.test/stayed", "A source that stayed");
    const left = await aProvider(db, "https://provider.test/left", "A source that withdrew");
    const container = await anItemTitled(db, "An ordering one source walked away from", {
      isContainer: true,
      isOrdered: true,
    });
    const story = await anItemTitled(db, "A story two sources placed, then one");
    for (const sourceId of [stayed, left]) {
      await assertPlacement(db, { containerId: container, itemId: story, position: 1, sourceId });
    }
    await db
      .update(placementSources)
      .set({ deletedAt: new Date() })
      .where(eq(placementSources.sourceId, left));

    const held = (await findPlacementsInContainer(db, container, { limit: 10 })).rows;

    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ assertedBy: ["A source that stayed"] });
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

    const held = (await findPlacementsInContainer(db, container, { limit: 10 })).rows;

    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ title: "A story placed by nobody", assertedBy: [] });
  });
});
