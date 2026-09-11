import type { Database } from "@canoncore/db";
import { anItemTitled, connect } from "@canoncore/db/testing/catalogue";
import { call } from "@orpc/server";
import { beforeAll, describe, expect, it } from "vitest";

import { createContext } from "../context";
import { appRouter } from "./index";

/**
 * ADR-0103's second seam: the router called in the same process, with context
 * built by the real `createContext` rather than hand-copied from it.
 */
const context = await createContext();

let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("catalogue.list", () => {
  it("answers with what the catalogue holds, and how much of it there is", async () => {
    const id = await anItemTitled(db, "A story on the front page");

    const catalogue = await call(appRouter.catalogue.list, {}, { context });

    expect(catalogue.entries).toContainEqual(
      expect.objectContaining({ id, title: "A story on the front page" }),
    );
    expect(catalogue.total).toBeGreaterThanOrEqual(catalogue.entries.length);
  });

  it("names every field an entry emits, and no internal one", async () => {
    // ADR-0045. The same enumeration oracle `item.get` carries, for the same
    // reason: never the query's row with fields removed, because a strip-list
    // works right up until somebody adds a column and forgets. `owner_id`, the
    // change sequence, the merge stamp and `holds_work` are all absent because
    // no line was written for them.
    await anItemTitled(db, "Named in a listing");

    const { entries } = await call(appRouter.catalogue.list, { limit: 1 }, { context });
    const [entry] = entries;
    if (!entry) throw new Error("the catalogue answered with nothing to enumerate");

    expect(Object.keys(entry).sort()).toStrictEqual(["id", "isContainer", "kind", "title"]);
  });

  it("carries a cursor onto the next page, and says where the catalogue ends", async () => {
    // THE OTHER HALF OF THE CAP. `total` already said what was not being shown;
    // this is what reaches it. The cursor is an ITEM ID rather than an encoded
    // sort key (ADR-0119), so nothing about the projection crosses this seam.
    await anItemTitled(db, "A story a reader has to page to");

    const first = await call(appRouter.catalogue.list, { limit: 1 }, { context });
    if (first.continuesAfter === null) throw new Error("a catalogue of one needs no paging");
    const second = await call(
      appRouter.catalogue.list,
      { limit: 1, after: first.continuesAfter },
      { context },
    );

    expect(second.entries[0]?.id).not.toBe(first.entries[0]?.id);
    // THE SAME LIBRARY FROM BOTH PAGES. A count taken after the cursor bit
    // would shrink page by page and tell an owner their catalogue was emptying
    // as they read it.
    expect(second.total).toBe(first.total);
  });

  it("starts at the beginning when the cursor names nothing", async () => {
    // ADR-0066's rule for a parameter that is not an identity: one naming
    // nothing matches nothing and changes nothing. A cursor is cut at an item,
    // and an owner who deletes that item should not find a bookmarked page
    // answering with an error -- they should find the catalogue.
    //
    // BOTH SHAPES, because they fail differently and only one of them looks
    // like a cursor. A well-formed id for no row is an empty query; a MALFORMED
    // one reaches a `uuid` column as PostgreSQL error 22P02, which is the
    // measured 500 ADR-0066 records against `item.get` before CNCORE-14 -- a
    // truncated id in a shared link reading as "this server is broken".
    const beginning = await call(appRouter.catalogue.list, { limit: 3 }, { context });

    const noSuchItem = await call(
      appRouter.catalogue.list,
      { limit: 3, after: crypto.randomUUID() },
      { context },
    );
    const notAnId = await call(
      appRouter.catalogue.list,
      { limit: 3, after: "page-two-please" },
      { context },
    );

    expect(noSuchItem.entries).toStrictEqual(beginning.entries);
    expect(notAnId.entries).toStrictEqual(beginning.entries);
  });

  it("refuses to answer with more than a page at a time", async () => {
    // THE CEILING IS THIS APP'S, not the caller's. A limit a request can raise
    // is not a cap on anything -- the cost of one answer would be a function of
    // what somebody asked for rather than of what this app chose to serve.
    const asked = call(appRouter.catalogue.list, { limit: 5_000 }, { context });

    await expect(asked).rejects.toThrow();
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
    const listed = works.entries.map((entry) => entry.id);

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

    expect(found.entries).toContainEqual(expect.objectContaining({ id: work, kind: "Work" }));
    expect(found.entries).toContainEqual(
      expect.objectContaining({ id: character, kind: "Character" }),
    );
  });

  it("answers an empty query with nothing", async () => {
    // Deliberate rather than accidental: an escaped empty query is the pattern
    // `%%` and matches every titled row, so the accidental behaviour of an
    // empty search box is the whole catalogue at its most expensive.
    await anItemTitled(db, "An item the empty query must not reach");

    const found = await call(appRouter.catalogue.search, { query: "" }, { context });

    expect(found).toEqual({ entries: [], total: 0 });
  });

  it("refuses a limit above a page, and accepts one at it", async () => {
    // The ceiling is what keeps one request's cost bounded by this app rather
    // than by whoever sends the request, which is the same rule `list` carries.
    //
    // BOTH HALVES, because the refusal alone is satisfied by a procedure that
    // refuses everything -- and while this was being written it was satisfied
    // by a procedure that did not exist at all, since calling `undefined`
    // throws as readily as a validator does. The pair is what makes it a test
    // of the ceiling rather than of whether anything threw.
    //
    // THE MESSAGE IS oRPC'S OWN and does not name the field: the input schema
    // rejects and the procedure answers "Input validation failed". Matched
    // rather than left bare so that a `TypeError` -- which is what calling a
    // procedure that is not there raises -- cannot satisfy it.
    await expect(
      call(appRouter.catalogue.search, { query: "anything", limit: 101 }, { context }),
    ).rejects.toThrow("Input validation failed");

    await expect(
      call(appRouter.catalogue.search, { query: "anything", limit: 100 }, { context }),
    ).resolves.toBeDefined();
  });
});
