import type { Database } from "@canoncore/db";
import { anItemTitled, connect } from "@canoncore/db/testing/catalogue";
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
});
