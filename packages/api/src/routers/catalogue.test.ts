import { createGroupByHand, type Database, putItemInGroupByHand } from "@canoncore/db";
import { anItem, anItemTitled, aPlacement, connect } from "@canoncore/db/testing/catalogue";
import { env } from "@canoncore/env/server";
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
 * A SESSION THE OWNER'S OWN WRITES GO THROUGH, which this file needs since
 * CNCORE-292: the one path it asserts ends in `item.retitle`, and that is an
 * `ownerProcedure`.
 *
 * SPELLED HERE AS `group.test.ts` AND `provider.test.ts` SPELL IT, rather than
 * shared out to a fourth place from three. Folding the three into one helper is
 * a change to files this ticket does not otherwise touch.
 */
async function aTokenForTheOwner(): Promise<string> {
  const password = env.OWNER_PASSWORD;
  if (password === undefined) {
    throw new Error("this suite's vitest.config.ts sets OWNER_PASSWORD, and it is not set");
  }
  const { token } = await call(appRouter.session.logIn, { password }, { context });
  return token;
}

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

  it("says whether anything sorts before A, within the Group the reader narrowed to", async () => {
    // CNCORE-242. WHETHER THE JUMP BAR HAS AN ENTRY TO OFFER, which is the one
    // fact a browsed Listing carries that Catalogue search does not.
    //
    // THE RANGE ITSELF IS THE DB SEAM'S, measured there against the collation.
    // What this adds is the pair `holds` and `sitsIn` above each add: the field
    // SURVIVES THE SEAM. `.output()` strips whatever the schema does not
    // declare, so an answer that reached `asListing` and no further would be
    // invisible to every surface and to the db suite alike -- and it is a
    // second schema here rather than a field on `cataloguePublic`, so a
    // procedure wired to the wrong one drops it.
    //
    // AND IT IS ASKED WITHIN THE NARROWING, which is what a Group makes
    // observable: the shared suite catalogue holds Rows before A that other
    // files wrote, so a read that dropped the `group` would answer `true`
    // whatever this test put in its own scope.
    const has = await createGroupByHand(db, { name: "A scope with a Row before A" });
    const lacks = await createGroupByHand(db, { name: "A scope with none" });
    await putItemInGroupByHand(db, {
      groupId: has,
      itemId: await anItemTitled(db, "42 (a TV story on a narrowed front page)"),
    });
    await putItemInGroupByHand(db, {
      groupId: lacks,
      itemId: await anItemTitled(db, "Aliens of London, on a narrowed front page"),
    });

    const before = await call(appRouter.catalogue.list, { group: has }, { context });
    const none = await call(appRouter.catalogue.list, { group: lacks }, { context });

    expect(before.beforeTheAlphabet).toBe(true);
    expect(none.beforeTheAlphabet).toBe(false);
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

  it("says whether anything sorts before A, as the other browsed Listing does", async () => {
    // CNCORE-242, AND IT IS WIRED SEPARATELY: the two procedures share an
    // input schema and an output schema and are two handlers, so `works`
    // answering the field is not something `list` answering it proves. This is
    // the same argument the Group case above makes one procedure along.
    //
    // ITS OWN QUESTION NARROWS IT TOO, which is why the Row before A is a
    // Person: work-browsing excludes the entity kinds (ADR-0077), so a scope
    // whose only Row before A is one of them has nothing before A HERE while
    // the catalogue's answer over the same scope is `true`.
    const scope = await createGroupByHand(db, { name: "A scope whose Row before A is a Person" });
    for (const [title, kind] of [
      ["42 (a person on a narrowed works page)", "person"],
      ["Aliens of London, on a narrowed works page", "work"],
    ] as const) {
      await putItemInGroupByHand(db, {
        groupId: scope,
        itemId: await anItemTitled(db, title, { kind }),
      });
    }

    const works = await call(appRouter.catalogue.works, { group: scope }, { context });
    const catalogue = await call(appRouter.catalogue.list, { group: scope }, { context });

    expect(works.beforeTheAlphabet).toBe(false);
    expect(catalogue.beforeTheAlphabet).toBe(true);
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

    expect(found).toEqual({
      rows: [],
      total: 0,
      rowsBefore: 0,
      continuesAfter: null,
      continuesBefore: null,
    });
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

/**
 * WHAT AN OWNER DOES WITH AN UNTITLED ITEM (CNCORE-292, ADR-0189), asserted as
 * the one path rather than described in a record nothing holds up.
 *
 * THE STATE IS A PURGE'S, NOT A FIXTURE'S. Every Item the Owner still places
 * or still holds in a live Group survives a Provider purge with no title at
 * all, because every word it had was the Provider's (`import.test.ts`). So
 * this is the shape a catalogue wears the day a licence ends, and the question
 * the placement picker asks of it is a real one.
 *
 * THE ANSWER IS THAT THE OWNER TITLES IT FIRST, and this is the test that says
 * the remedy EXISTS -- which is the whole of what ADR-0165 was written about.
 * A record naming a remedy nobody asserted is the defect that record carries,
 * one surface along.
 */
describe("reaching an Item the catalogue has no title for", () => {
  it("is found by no search, reached by a jump, and searchable once the Owner titles it", async () => {
    const asTheOwner = await createContext({ sessionToken: await aTokenForTheOwner() });
    const scope = await createGroupByHand(db, { name: "What a purge left the Owner holding" });
    const survivor = await anItem(db);
    await putItemInGroupByHand(db, { groupId: scope, itemId: survivor });

    // ONE: NO QUERY REACHES IT, which is the honest scope of a search over
    // titles rather than an oversight in it. `title ilike ...` is NULL for a
    // row with no title, so the picker's own question cannot answer with this.
    const searchedBefore = await call(
      appRouter.catalogue.search,
      { query: "purge", group: scope },
      { context },
    );
    expect(searchedBefore.rows.map((row) => row.id)).toStrictEqual([]);

    // TWO: A JUMP REACHES IT ANYWAY. The keyless block rides on every seek, so
    // the Listing the Owner already has puts the Item in front of them without
    // a control of its own being built for it.
    const jumped = await call(appRouter.catalogue.list, { group: scope, letter: "A" }, { context });
    expect(jumped.rows.map((row) => row.id)).toStrictEqual([survivor]);
    // AND IT ANSWERS WITH NO TITLE rather than with a word this app made up,
    // which is what the surfaces render as "Untitled item" (ADR-0003).
    expect(jumped.rows[0]?.title).toBeNull();

    // THREE: THE OWNER TITLES IT, on the Item's own page, through the
    // procedure that already exists for correcting what an Item is called.
    await call(
      appRouter.item.retitle,
      { id: survivor, title: "The story the provider used to name" },
      { context: asTheOwner },
    );

    // FOUR: AND THE PICKER'S OWN QUESTION NOW ANSWERS WITH IT. This is the
    // reach CNCORE-256 built, arrived at rather than duplicated -- so the
    // second reach the ticket asked about would have been a second answer to a
    // question this one already answers.
    const searchedAfter = await call(
      appRouter.catalogue.search,
      { query: "used to name", group: scope },
      { context },
    );
    expect(searchedAfter.rows.map((row) => row.id)).toStrictEqual([survivor]);
  });
});
