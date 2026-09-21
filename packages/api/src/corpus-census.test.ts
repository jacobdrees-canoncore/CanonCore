import { anItemTitled, aPlacement, connect, emptyCatalogue } from "@canoncore/db/testing/catalogue";
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it } from "vitest";

import { createContext } from "./context";
import { readCorpusCensus } from "./corpus-census";
import { appRouter } from "./routers";

/**
 * ADR-0103's FIRST SEAM over its SECOND, which is the arrangement
 * `import-list.test.ts` argues for one file over: `readCorpusCensus` is a
 * package export driven here as one, and what stands behind it is the real
 * router called in the same process with the real `createContext`.
 *
 * WHY THIS FILE EXISTS RATHER THAN THE WALK LIVING IN THE LOCAL SUITE. The two
 * figures CNCORE-167 takes are the first anybody has counted, and the only
 * place they can be counted is an install holding a corpus -- which no CI job
 * can reach. Code that runs ONLY there is code nothing checks, so the walk is
 * here, over a corpus small enough to state by hand and shaped to hold every
 * case the real one does: multi-placement, a Repeat, an Unplaced, and an Item
 * in no Ordering at all.
 *
 * THE EXPECTED FIGURES ARE READ OFF THE FIXTURE ABOVE THEM, never recomputed
 * the way the walk computes them. Each `describe` below states its corpus as a
 * picture and then asserts the number that picture obviously has.
 */

/**
 * EACH TEST OWNS THE WHOLE CATALOGUE, which is forced by what is being counted
 * rather than chosen for tidiness. Every figure here is a fact about the
 * catalogue ENTIRE -- how many distinct Items sit in an Ordering, the most
 * Orderings any one sits in -- so another file's fixtures, or this file's own
 * previous test, would be inside the answer.
 */
beforeEach(async () => {
  await emptyCatalogue(await connect());
});

const theClient = async () =>
  createRouterClient(appRouter, { context: async () => createContext() });

describe("readCorpusCensus", () => {
  /**
   * THE CORPUS, AS A PICTURE:
   *
   *   Ordering A  ->  The Tenth Planet, The Web of Fear
   *   Ordering B  ->  The Tenth Planet, The Mind Robber
   *
   * Three distinct Items sit in an Ordering. `The Tenth Planet` sits in two,
   * which is CONTEXT.md's Multi-placement and the product's entire argument.
   */
  it("counts the DISTINCT Items placed across the corpus's Orderings, never the slots", async () => {
    const db = await connect();
    const a = await anItemTitled(db, "Ordering A", { isContainer: true });
    const b = await anItemTitled(db, "Ordering B", { isContainer: true });
    const tenthPlanet = await anItemTitled(db, "The Tenth Planet");
    const webOfFear = await anItemTitled(db, "The Web of Fear");
    const mindRobber = await anItemTitled(db, "The Mind Robber");
    await aPlacement(db, { containerId: a, itemId: tenthPlanet, position: 1 });
    await aPlacement(db, { containerId: a, itemId: webOfFear, position: 2 });
    await aPlacement(db, { containerId: b, itemId: tenthPlanet, position: 1 });
    await aPlacement(db, { containerId: b, itemId: mindRobber, position: 2 });

    const census = await readCorpusCensus(await theClient());

    // FOUR SLOTS AND THREE ITEMS, which is the whole distinction this figure
    // carries: a count of Placements would answer four.
    expect(census.placements).toBe(4);
    expect(census.itemsPlaced).toBe(3);
  });

  /**
   * THE CORPUS, AS A PICTURE:
   *
   *   Ordering A  ->  The Five Doctors at 1, The Five Doctors AGAIN at 5
   *   Ordering B  ->  The Five Doctors
   *   Ordering C  ->  The Five Doctors
   *   Ordering C  ->  Logopolis
   *
   * `The Five Doctors` has FOUR slots and sits in THREE Orderings. The two in
   * Ordering A are CONTEXT.md's Repeat -- one Item placed twice in one
   * container, which ADR-0009 allows for recaps and bookends -- and they are
   * one Ordering however many times they appear in it.
   *
   * THIS IS THE FIGURE CNCORE-184 CANNOT CHOOSE ITS TRUNCATION WITHOUT, so a
   * Repeat counted twice here would hand that ticket a number too large by
   * however many recaps the wiki's editors wrote.
   */
  it("answers the greatest number of DISTINCT Orderings one Item sits in, counting a Repeat once", async () => {
    const db = await connect();
    const a = await anItemTitled(db, "Ordering A", { isContainer: true });
    const b = await anItemTitled(db, "Ordering B", { isContainer: true });
    const c = await anItemTitled(db, "Ordering C", { isContainer: true });
    const fiveDoctors = await anItemTitled(db, "The Five Doctors");
    const logopolis = await anItemTitled(db, "Logopolis");
    await aPlacement(db, { containerId: a, itemId: fiveDoctors, position: 1 });
    await aPlacement(db, { containerId: a, itemId: fiveDoctors, position: 5 });
    await aPlacement(db, { containerId: b, itemId: fiveDoctors, position: 1 });
    await aPlacement(db, { containerId: c, itemId: fiveDoctors, position: 1 });
    await aPlacement(db, { containerId: c, itemId: logopolis, position: 2 });

    const census = await readCorpusCensus(await theClient());

    expect(census.placements).toBe(5);
    expect(census.mostPlaced).toEqual({
      itemId: fiveDoctors,
      // THE ITEM'S OWN TITLE, which is what makes the figure readable rather
      // than a uuid somebody has to go and look up.
      title: "The Five Doctors",
      orderings: 3,
    });
  });

  /**
   * THE ONE DEFECT THAT WOULD MAKE EVERY FIGURE ABOVE WRONG AND LOOK RIGHT.
   *
   * Both listings this census walks are capped at `A_PAGE`, which is 100
   * (ADR-0119, and the cap is never silent). A census that read one page of
   * each would answer 100 slots for AHistory's 2,913, and it would answer it
   * confidently -- CNCORE-159's whole finding is figures nobody checked.
   *
   * SO THE FIXTURE IS DELIBERATELY JUST OVER THE CAP, in both dimensions at
   * once: 101 Orderings past the catalogue's page, and one of them holding 101
   * slots past the members' page. A walk that stopped at either boundary
   * reports a number this test can name.
   */
  it("walks PAST the page cap in both listings, so nothing is truncated at 100", async () => {
    const db = await connect();
    const big = await anItemTitled(db, "An Ordering past the cap", { isContainer: true });
    for (let position = 1; position <= 101; position += 1) {
      const story = await anItemTitled(db, `Story ${position}`);
      await aPlacement(db, { containerId: big, itemId: story, position });
    }
    // A HUNDRED MORE ORDERINGS, so the catalogue listing itself needs a second
    // page before it has even seen them all.
    for (let nth = 1; nth <= 100; nth += 1) {
      await anItemTitled(db, `Ordering ${nth}`, { isContainer: true });
    }

    const census = await readCorpusCensus(await theClient());

    expect(census.placements).toBe(101);
    expect(census.itemsPlaced).toBe(101);
  });

  /**
   * THE CORPUS, AS A PICTURE:
   *
   *   Ordering A  ->  The Tenth Planet at 1, Shada with NO POSITION
   *   (and Susan Foreman, a Character, in no Ordering at all)
   *
   * TWO ITEMS ARE PLACED, NOT ONE AND NOT THREE, and the two edges are
   * different words in CONTEXT.md.
   *
   * `Shada` IS UNPLACED, WHICH IS A PLACEMENT WITH NO POSITION rather than an
   * absent one -- the glossary is explicit that "dropping it shrinks the
   * container silently". A Provider that gave a Container's ordering without
   * placing every member is the normal case, not an odd one: `browse` answers
   * an `unplaced` list beside its `ordering`.
   *
   * `Susan Foreman` IS IN NO ORDERING, so she is in the catalogue and not in
   * the corpus's Orderings. CNCORE-167's figure is what the Orderings HOLD
   * BETWEEN THEM, and the catalogue is wider than that: ADR-0077 keeps People
   * and Time spans findable where Work-browsing hides them.
   */
  it("counts an Unplaced member and excludes an Item that sits in no Ordering", async () => {
    const db = await connect();
    const a = await anItemTitled(db, "Ordering A", { isContainer: true });
    const tenthPlanet = await anItemTitled(db, "The Tenth Planet");
    const shada = await anItemTitled(db, "Shada");
    await anItemTitled(db, "Susan Foreman", { kind: "character" });
    await aPlacement(db, { containerId: a, itemId: tenthPlanet, position: 1 });
    await aPlacement(db, { containerId: a, itemId: shada, position: null });

    const census = await readCorpusCensus(await theClient());

    expect(census.placements).toBe(2);
    expect(census.itemsPlaced).toBe(2);
  });

  /**
   * WHAT LANDED, IN THE CATALOGUE'S OWN TERMS, which is the other half of what
   * CNCORE-167 has to record: how big the catalogue is and how many Orderings
   * are in it.
   *
   * THE CATALOGUE IS WIDER THAN THE CORPUS AND THE TWO FIGURES SAY SO. Six
   * Items here: two Orderings, three stories and a Character nothing placed.
   * `items` is every one of them because `catalogue.list` excludes nothing
   * (ADR-0077), where `itemsPlaced` is three.
   *
   * `items` IS THE LISTING'S OWN `total` RATHER THAN A COUNT OF ROWS WALKED,
   * which is the figure a reader sees on the front page -- so if the two ever
   * disagreed, this would be reading the catalogue's claim about itself and
   * that is the claim worth checking.
   */
  it("reports the catalogue's own size and how many Orderings are in it", async () => {
    const db = await connect();
    const a = await anItemTitled(db, "Ordering A", { isContainer: true });
    const b = await anItemTitled(db, "Ordering B", { isContainer: true });
    const tenthPlanet = await anItemTitled(db, "The Tenth Planet");
    const webOfFear = await anItemTitled(db, "The Web of Fear");
    const mindRobber = await anItemTitled(db, "The Mind Robber");
    await anItemTitled(db, "Susan Foreman", { kind: "character" });
    await aPlacement(db, { containerId: a, itemId: tenthPlanet, position: 1 });
    await aPlacement(db, { containerId: a, itemId: webOfFear, position: 2 });
    await aPlacement(db, { containerId: b, itemId: mindRobber, position: 1 });

    const census = await readCorpusCensus(await theClient());

    expect(census.items).toBe(6);
    expect(census.orderings).toBe(2);
    expect(census.itemsPlaced).toBe(3);
    // LARGEST FIRST, because what the front page faces is the biggest Ordering
    // rather than the average one -- CNCORE-183 and CNCORE-184 are both sized
    // against it.
    expect(census.largest.map((ordering) => [ordering.title, ordering.placements])).toEqual([
      ["Ordering A", 2],
      ["Ordering B", 1],
    ]);
  });

  /**
   * AN EMPTY CATALOGUE, which the type allows for and nothing else exercises:
   * `mostPlaced` is `MostPlaced | null` and the null arm is reachable from a
   * fresh install (ADR-0094: a fresh install starts empty).
   *
   * IT IS THE STATE THE CENSUS IS FIRST RUN IN. CNCORE-167's own install
   * answered exactly this before the corpus landed, and a census that threw
   * here would have failed on the one run that was meant to show it failing
   * honestly.
   */
  it("answers a whole census over an empty catalogue rather than throwing", async () => {
    const census = await readCorpusCensus(await theClient());

    expect(census).toEqual({
      items: 0,
      orderings: 0,
      placements: 0,
      itemsPlaced: 0,
      orderingsPlaced: 0,
      mostPlaced: null,
      largest: [],
    });
  });

  /**
   * IS ANY ORDERING ITSELF PLACED IN ANOTHER? -- asked directly, because the
   * figure above is called "Items placed" and CNCORE-167 wants DISTINCT STORIES.
   * The two are the same number only when nothing placed is a Container.
   *
   * IT REPLACES AN ARITHMETIC CHECK THAT DID NOT HOLD. Review found that
   * `orderings + itemsPlaced === items` proves nothing on its own: one nested
   * Ordering and one Item in no Ordering cancel exactly, since `items` counts
   * the unplaced one and `itemsPlaced` counts the nested one. This fixture is
   * that exact cancellation -- one of each -- so a census answering by
   * subtraction passes it and this test fails it.
   *
   *   Ordering A  ->  The Tenth Planet, Ordering B (a CONTAINER, nested)
   *   Ordering B  ->  (nothing)
   *   Shada       ->  in no Ordering at all
   */
  it("says how many placed Items are themselves Orderings, rather than leaving it to arithmetic", async () => {
    const db = await connect();
    const a = await anItemTitled(db, "Ordering A", { isContainer: true });
    const b = await anItemTitled(db, "Ordering B", { isContainer: true });
    const tenthPlanet = await anItemTitled(db, "The Tenth Planet");
    await anItemTitled(db, "Shada");
    await aPlacement(db, { containerId: a, itemId: tenthPlanet, position: 1 });
    await aPlacement(db, { containerId: a, itemId: b, position: 2 });

    const census = await readCorpusCensus(await theClient());

    expect(census.orderingsPlaced).toBe(1);
    // AND THE CANCELLATION IS REAL, which is what made the old check useless:
    // 2 Orderings + 2 Items placed === 4 Items, and one of those placed Items
    // is an Ordering.
    expect(census.orderings + census.itemsPlaced).toBe(census.items);
  });

  /**
   * IT SAYS WHERE IT HAS GOT TO, which `import-list.ts` argues for one file
   * over: the corpus is 465 Orderings and the walk is thousands of requests, so
   * a census that reported only at the end is one nobody could tell from a hung
   * one.
   *
   * THE COUNT DOWN IS WHAT MAKES IT READABLE. Each Ordering says how many are
   * left, which is the same shape the import driver prints -- so an Owner
   * watching both reads one progression rather than two.
   */
  it("says which Ordering it is walking and how many are left", async () => {
    const db = await connect();
    const a = await anItemTitled(db, "Ordering A", { isContainer: true });
    const b = await anItemTitled(db, "Ordering B", { isContainer: true });
    const tenthPlanet = await anItemTitled(db, "The Tenth Planet");
    await aPlacement(db, { containerId: a, itemId: tenthPlanet, position: 1 });
    await aPlacement(db, { containerId: b, itemId: tenthPlanet, position: 1 });

    const found: Array<{ orderings: number; items: number }> = [];
    const walked: Array<{ title: string; placements: number; remaining: number }> = [];
    await readCorpusCensus(await theClient(), {
      onOrderingsFound: (it) => found.push(it),
      onOrderingWalked: ({ title, placements, remaining }) =>
        walked.push({ title, placements, remaining }),
    });

    // FOUND BEFORE ANY IS WALKED, so an Owner knows the size of the job rather
    // than watching an unbounded count go up.
    expect(found).toEqual([{ orderings: 2, items: 3 }]);
    expect(walked).toEqual([
      { title: "Ordering A", placements: 1, remaining: 1 },
      { title: "Ordering B", placements: 1, remaining: 0 },
    ]);
  });
});
