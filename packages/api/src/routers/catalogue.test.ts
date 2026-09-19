import { createGroupByHand, type Database, putItemInGroupByHand } from "@canoncore/db";
import { anItemTitled, aPlacement, connect } from "@canoncore/db/testing/catalogue";
import type { CatalogueRowPublic } from "@canoncore/schemas";
import { call } from "@orpc/server";
import { beforeAll, describe, expect, it } from "vitest";

import { createContext } from "../context";
import { appRouter } from "./index";

/**
 * ADR-0103's second seam: the router called in the same process, with context
 * built by the real `createContext` rather than hand-copied from it.
 *
 * ONE TEST PER PROCEDURE, OF THE QUESTION THAT PROCEDURE ASKS. Everything these
 * three share -- the cap, the walk, the size across two pages, a cursor naming
 * nothing, and what a Row emits -- is asserted once over all of them in
 * `listing.test.ts` (CNCORE-171). It was asserted five times here for
 * `catalogue.list`, twice in different wording for Catalogue search, and not at
 * all for work-browsing, which is how the second Listing on this shape came to
 * inherit none of it.
 */
const context = await createContext();

let db: Database;

beforeAll(async () => {
  db = await connect();
});

/**
 * ONE ROW OF THE CATALOGUE, WALKED TO RATHER THAN EXPECTED ON THE FIRST PAGE.
 *
 * THE POSITION IS NOT THIS TEST'S TO CHOOSE. One suite database is written by
 * every file in this package at once, so how many Rows sort ahead of a fixture
 * is a property no test here declares -- and an assertion resting on one goes
 * red in CI having passed locally, which is CNCORE-173 exactly, one package
 * over. The cap is 100 and a caller may not raise it (`listingInput`), so the
 * honest way to reach a Row is the one a reader has: walk (ADR-0119).
 *
 * IT STOPS AT THE END OF THE LISTING rather than looping until a timeout says
 * something vague about it -- `continuesAfter: null` is where the catalogue
 * ends, and a Row not found by then is not in it.
 */
async function rowFor(id: string): Promise<CatalogueRowPublic | undefined> {
  for (let after: string | undefined; ; ) {
    const page = await call(appRouter.catalogue.list, { after }, { context });
    const found = page.rows.find((row) => row.id === id);
    if (found !== undefined || page.continuesAfter === null) return found;
    after = page.continuesAfter;
  }
}

describe("catalogue.list", () => {
  it("answers with a Person, which is the question work-browsing is not asking", async () => {
    // ADR-0077's two questions, and this is the WIDE one: "what is in this
    // catalogue" excludes nothing, where `works` below answers "what can I
    // watch" and keeps the cast out of it. A front page that hid People would
    // be answering the other question without saying so.
    //
    // THE PAIR IS WHAT MAKES EITHER OF THEM A TEST. One story listed says
    // nothing about which question was asked, since both list it; the Person is
    // the only row the two procedures disagree about.
    const story = await anItemTitled(db, "A story on the front page");
    const person = await anItemTitled(db, "A person on the front page", { kind: "person" });

    const catalogue = await call(appRouter.catalogue.list, {}, { context });
    const listed = catalogue.rows.map((row) => row.id);

    expect(listed).toContain(story);
    expect(listed).toContain(person);
  });

  it("says how much an Ordering holds, and a story that it holds nothing", async () => {
    // CNCORE-183. WHAT A ROW EMITS is asserted over all three Listings in
    // `listing.test.ts`, and that assertion is an ENUMERATION of keys: a
    // mapping that named the field and carried a constant into it would pass
    // there. This is the value, and one procedure is enough for it because
    // `asRow` is written once for all three -- the same argument that file
    // makes for keeping the shared facts out of this one.
    //
    // THE FIGURE IS THE DB SEAM'S, AND WHAT THIS ADDS IS THAT IT SURVIVES THE
    // SEAM: `.output(cataloguePublic)` strips a field the schema does not
    // declare, so a `holds` that reached `asRow` and no further would be
    // invisible to every reader and to the db suite alike.
    const held = await anItemTitled(db, "A story an ordering on the front page holds");
    const ordering = await anItemTitled(db, "An ordering on the front page", {
      isContainer: true,
    });
    await aPlacement(db, { containerId: ordering, itemId: held, position: 1 });

    expect(await rowFor(ordering)).toMatchObject({ holds: 1 });
    expect(await rowFor(held)).toMatchObject({ holds: 0 });
  });

  it("says where a story sits, and that a story in no Ordering sits in none", async () => {
    // CNCORE-184, THE VALUE, for the reason the case above gives about
    // `holds`: `listing.test.ts` enumerates the keys, and a mapping carrying a
    // constant would pass there. The db seam owns the order, the tombstones and
    // the cut; this is that the answer survives `.output(cataloguePublic)`.
    const placed = await anItemTitled(db, "A story the front page says is placed");
    const loose = await anItemTitled(db, "A story the front page says is placed nowhere");
    const ordering = await anItemTitled(db, "An ordering it sits in at 12", {
      isContainer: true,
    });
    await aPlacement(db, { containerId: ordering, itemId: placed, position: 12 });

    expect((await rowFor(placed))?.sitsIn).toStrictEqual({
      first: [
        { containerId: ordering, containerTitle: "An ordering it sits in at 12", position: 12 },
      ],
      total: 1,
    });
    expect((await rowFor(loose))?.sitsIn).toStrictEqual({ first: [], total: 0 });
  });

  it("answers within a Group it is handed, at the Group's own size", async () => {
    // CNCORE-179. The narrowing itself is the db seam's to hold, past both
    // tombstones and a Group that names nothing; what this adds is that the
    // procedure is WIRED to it. An input that parsed a `group` and dropped it
    // would answer the whole catalogue -- and would pass the Listing contract,
    // which walks whatever it is handed and cannot tell a narrowed Listing
    // from the catalogue it was narrowed out of.
    const scope = await createGroupByHand(db, { name: "A scope the front page narrows to" });
    const inside = await anItemTitled(db, "A story on a narrowed front page");
    await anItemTitled(db, "A story left off a narrowed front page");
    await putItemInGroupByHand(db, { groupId: scope, itemId: inside });

    const narrowed = await call(appRouter.catalogue.list, { group: scope }, { context });

    expect(narrowed.rows.map((row) => row.id)).toStrictEqual([inside]);
    expect(narrowed.total).toBe(1);
  });
});

describe("catalogue.works", () => {
  it("answers with a work and not with a person", async () => {
    // ADR-0077's two questions, and this is the narrow one. `catalogue.list`
    // above answers "what is in this catalogue" and hides nothing; this answers
    // "what can I watch", so the cast stays out of it.
    const story = await anItemTitled(db, "A story somebody can watch");
    const person = await anItemTitled(db, "Somebody in its cast", { kind: "person" });

    const works = await call(appRouter.catalogue.works, {}, { context });
    const listed = works.rows.map((row) => row.id);

    expect(listed).toContain(story);
    expect(listed).not.toContain(person);
  });

  it("answers within a Group it is handed, at the Group's own size", async () => {
    // CNCORE-180, and the reason `catalogue.list` gives for its own: the
    // narrowing is the db seam's to hold, and what this adds is that the
    // procedure is WIRED to it. An input that parsed a `group` and dropped it
    // would answer the whole of work-browsing and pass the Listing contract.
    //
    // THE PERSON IS IN THE GROUP, so the answer being one Row says both that
    // the scope narrowed and that this procedure's own question survived it.
    const scope = await createGroupByHand(db, { name: "A scope work-browsing narrows to" });
    const inside = await anItemTitled(db, "A story on a narrowed work-browsing page");
    const cast = await anItemTitled(db, "Its cast, in the same scope", { kind: "person" });
    await anItemTitled(db, "A story left off a narrowed work-browsing page");
    for (const itemId of [inside, cast]) {
      await putItemInGroupByHand(db, { groupId: scope, itemId });
    }

    const narrowed = await call(appRouter.catalogue.works, { group: scope }, { context });

    expect(narrowed.rows.map((row) => row.id)).toStrictEqual([inside]);
    expect(narrowed.total).toBe(1);
  });
});

describe("catalogue.search", () => {
  it("finds a Work and an Entity alike, each saying which kind it is", async () => {
    // The ticket's own case. A Character's name has to work as well as a
    // Work's, and the kind is what keeps two things sharing a name apart -- in
    // the READER'S words, because `CONTEXT.md` is binding on UI copy and the
    // key stays below this seam (ADR-0045).
    const work = await anItemTitled(db, "The Web Planet");
    const character = await anItemTitled(db, "The Web Planet's Zarbi", { kind: "character" });

    const found = await call(appRouter.catalogue.search, { query: "Web Planet" }, { context });

    expect(found.rows).toContainEqual(expect.objectContaining({ id: work, kind: "Work" }));
    expect(found.rows).toContainEqual(
      expect.objectContaining({ id: character, kind: "Character" }),
    );
  });

  it("answers an empty query with nothing", async () => {
    // Deliberate rather than accidental: an escaped empty query is the pattern
    // `%%` and matches every titled row, so an empty search box would otherwise
    // answer with the whole catalogue (ADR-0120).
    //
    // THE SECOND TEST THIS PROCEDURE KEEPS, and it is about the question rather
    // than the walk: what a reader typed is what separates Catalogue search
    // from `list`, and the empty string is the one thing they can type that
    // this must answer with a Listing of nothing rather than with everything.
    await anItemTitled(db, "An item the empty query must not reach");

    const found = await call(appRouter.catalogue.search, { query: "" }, { context });

    expect(found).toEqual({ rows: [], total: 0, continuesAfter: null });
  });

  it("searches within a Group it is handed, at the size of what it searched", async () => {
    // CNCORE-180: searching Doctor Who does not return Iron Man. The match and
    // the scope are the db seam's; what this adds is that the procedure is
    // WIRED to the Group rather than parsing one and searching everything.
    const scope = await createGroupByHand(db, { name: "A scope Catalogue search narrows to" });
    const inside = await anItemTitled(db, "The Keys of Marinus, searched within a scope");
    await anItemTitled(db, "The Keys of Marinus, left outside the scope");
    await putItemInGroupByHand(db, { groupId: scope, itemId: inside });

    const found = await call(
      appRouter.catalogue.search,
      { query: "Keys of Marinus", group: scope },
      { context },
    );

    expect(found.rows.map((row) => row.id)).toStrictEqual([inside]);
    expect(found.total).toBe(1);
  });
});
