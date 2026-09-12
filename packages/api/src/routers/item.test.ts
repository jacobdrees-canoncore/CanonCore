import { aliases, type Database, items } from "@canoncore/db";
import {
  anItem,
  anItemTitled,
  aPlacement,
  aProvider,
  aStatement,
  connect,
  ownerSource,
  theOwner,
} from "@canoncore/db/testing/catalogue";
import { env } from "@canoncore/env/server";
import { call, isDefinedError, safe } from "@orpc/server";
import { eq } from "drizzle-orm";
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

describe("item.get", () => {
  it("answers with the item's projected title", async () => {
    const id = await anItemTitled(db, "The Daleks' Master Plan");

    const item = await call(appRouter.item.get, { id }, { context });

    expect(item.title).toBe("The Daleks' Master Plan");
    expect(item.id).toBe(id);
    expect(item.kind).toBe("Work");
  });

  it("says what kind it is in the reader's words rather than in the column's", async () => {
    // CNCORE-83. `CONTEXT.md` is binding on UI copy and calls this a Time span
    // where the column says `time_span`, so a read path answering with the key
    // is handing every one of its readers the schema to print.
    //
    // `Work` above and `Time span` here are the same rule, and this is the pair
    // that can tell whether it is being followed: a capital is all that
    // separates `work` from its label, and a test that only ever asked about
    // one of the seven kinds would pass on the key for six of them.
    //
    // THE CATALOGUE LISTING ALREADY ANSWERS IN THESE WORDS, so this is the
    // read path agreeing with itself rather than a second convention: `kind`
    // means the reader's word for it wherever the read path emits one.
    const era = await anItemTitled(db, "The Hartnell era", { kind: "time_span" });

    const item = await call(appRouter.item.get, { id: era }, { context });

    expect(item.kind).toBe("Time span");
  });

  it("names every field it emits, and no internal one", async () => {
    // ADR-0045. Never the owner payload with fields removed, because a
    // strip-list works until someone adds a field and forgets. A field added
    // later is private by default, and the enumeration oracle goes with the ids.
    const item = await call(
      appRouter.item.get,
      { id: await anItemTitled(db, "Named") },
      { context },
    );

    expect(Object.keys(item).sort()).toStrictEqual([
      // What this page owes for showing the rest (ADR-0036). Named here like
      // every other field, which is the point of this test: it went red when
      // `attribution` was added, which is the enumeration working.
      "attribution",
      // What this container HOLDS (CNCORE-67). It went red here when it was
      // added, for the same reason `attribution` did: the enumeration working --
      // and again when CNCORE-91 renamed it from `members`, which `CONTEXT.md`
      // rejects as a name for a list of placements.
      "holds",
      "id",
      "isContainer",
      "isOrdered",
      "kind",
      "placements",
      "releaseDate",
      "sortName",
      "statements",
      "title",
    ]);
  });

  it("names every field of a PLACEMENT too, since the rule is about the payload", async () => {
    // The same rule one level down. A nested object is where a strip-list is
    // most likely to be forgotten -- `owner_id` and the merge stamp are on the
    // placement row exactly as they are on the item's.
    const story = await anItem(db);
    const container = await anItemTitled(db, "An ordering", {
      isContainer: true,
      isOrdered: true,
    });
    await aPlacement(db, { containerId: container, itemId: story, position: 1 });

    const item = await call(appRouter.item.get, { id: story }, { context });

    expect(item.placements.map((placement) => Object.keys(placement).sort())).toStrictEqual([
      ["containerId", "containerTitle", "id", "placedBy", "position"],
    ]);
  });

  it("answers with every ordering the item sits in, and its position in each", async () => {
    // ADR-0009, the product's central claim: one item, two orderings, two
    // positions, both true at once. The page's "Also appears in" is this.
    const story = await anItemTitled(db, "The Daleks' Master Plan");
    const releaseOrder = await anItemTitled(db, "Release order", {
      isContainer: true,
      isOrdered: true,
    });
    const storyOrder = await anItemTitled(db, "Story order", {
      isContainer: true,
      isOrdered: true,
    });
    await aPlacement(db, {
      containerId: releaseOrder,
      itemId: story,
      position: 63,
      sourceId: await ownerSource(db),
    });
    await aPlacement(db, {
      containerId: storyOrder,
      itemId: story,
      position: 1,
      sourceId: await ownerSource(db),
    });

    const item = await call(appRouter.item.get, { id: story }, { context });

    expect(item.placements.map((p) => [p.containerTitle, p.position, p.placedBy])).toStrictEqual([
      ["Release order", 63, "owner"],
      ["Story order", 1, "owner"],
    ]);
  });

  it("follows an alias to the item that survived the merge", async () => {
    // ADR-0040. The loser stays a permanent alias, so no URL ever breaks. The
    // merge that mints one does not exist yet; the resolution it depends on
    // does, and it is here that it has to work.
    const survivor = await anItemTitled(db, "The item that survived");
    const mergedAway = crypto.randomUUID();
    await db
      .insert(aliases)
      .values({ ownerId: await theOwner(db), aliasItemId: mergedAway, itemId: survivor });
    const container = await anItemTitled(db, "An ordering the survivor is in", {
      isContainer: true,
      isOrdered: true,
    });
    await aPlacement(db, { containerId: container, itemId: survivor, position: 4 });

    const item = await call(appRouter.item.get, { id: mergedAway }, { context });

    // The CANONICAL id comes back, not the one that was asked for: the path is
    // identity (ADR-0066), and an alias is not the identity.
    expect(item.id).toBe(survivor);
    expect(item.title).toBe("The item that survived");
    // And the orderings come back with it. Reading them against the id that was
    // ASKED FOR would answer an empty list here, which reads as "this item is
    // in nothing" rather than as the bug it is.
    expect(item.placements.map((p) => p.containerTitle)).toStrictEqual([
      "An ordering the survivor is in",
    ]);
  });

  it("refuses a tombstoned item", async () => {
    // ADR-0075 puts a tombstone on every table. A tombstone no reader honours
    // looks like a delete and behaves like nothing.
    const id = await anItemTitled(db, "Deleted since");
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, id));

    const error = await call(appRouter.item.get, { id }, { context }).catch(
      (thrown: unknown) => thrown,
    );

    expect(isDefinedError(error)).toBe(true);
  });

  it("refuses an alias whose survivor has since been deleted", async () => {
    const survivor = await anItemTitled(db, "Survived a merge, then deleted");
    const mergedAway = crypto.randomUUID();
    await db
      .insert(aliases)
      .values({ ownerId: await theOwner(db), aliasItemId: mergedAway, itemId: survivor });
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, survivor));

    const error = await call(appRouter.item.get, { id: mergedAway }, { context }).catch(
      (thrown: unknown) => thrown,
    );

    expect(isDefinedError(error)).toBe(true);
  });

  it("refuses an id that is neither an item nor an alias", async () => {
    const error = await call(appRouter.item.get, { id: crypto.randomUUID() }, { context }).catch(
      (thrown: unknown) => thrown,
    );

    expect(isDefinedError(error)).toBe(true);
  });

  it("refuses a MALFORMED id the same way, and as a DEFINED error", async () => {
    // CNCORE-14. A string that is not shaped like an id addresses nothing, so
    // it gets the same answer as an id nobody minted (ADR-0066): the reader
    // cannot tell a typo from an unknown item, because neither names anything.
    //
    // "Defined" is the load-bearing half. An input-validation failure raises a
    // BAD_REQUEST that is NOT among this procedure's declared errors, which no
    // caller can narrow on -- and the page, which only converts a defined
    // NOT_FOUND into a 404, rethrows it as a 500.
    // `safe` rather than `.catch`, which is how the page reads this same call:
    // it types the error as the procedure's declared union, so `isDefinedError`
    // narrows it and `code` can be asserted on. A `catch` hands back `unknown`,
    // and `Extract<unknown, ORPCError>` is `never`.
    const { error } = await safe(call(appRouter.item.get, { id: "not-a-uuid" }, { context }));

    // The guard both asserts and NARROWS: `safe` types the error as the
    // procedure's declared union, so past this line `code` exists.
    if (!isDefinedError(error)) throw new Error(`expected a defined error, got ${String(error)}`);
    expect(error.code).toBe("NOT_FOUND");
  });

  it("refuses an id the read path could never emit, rather than failing on the way out", async () => {
    // THE GUARD AND THE OUTPUT SCHEMA MUST AGREE ON WHAT AN ID IS. `itemPublic`
    // declares `id` a uuid (ADR-0045), so an id that does not satisfy it cannot
    // be answered with -- and a guard looser than that schema would find the row
    // here and then fail validation one layer up, as an output-validation error
    // that is NOT a defined error. That is the 500 this ticket is about, moved
    // rather than fixed, and it is why `findItem` checks with the same `z.uuid()`.
    //
    // The witness is a variant-`c` GUID: Postgres stores it and RFC 9562 rejects
    // it. Nothing here mints one -- every id comes from `gen_random_uuid()` --
    // so the row has to be written by hand to test the disagreement at all.
    //
    // AND IT IS TAKEN BACK OUT AGAIN, which is not tidiness. This suite shares
    // one database, and a row the read path can never emit is a row every
    // CATALOGUE-WIDE read in it then has to cope with -- `catalogue.list` met
    // this one and failed output validation on the whole listing, which is one
    // test's witness breaking another test's subject. It exists for the length
    // of the call below and no longer.
    const unmintable = "c1eebc99-9c0b-4ef8-cb6d-6bb9bd380a11";
    await db.insert(items).values({ id: unmintable, ownerId: await theOwner(db), kind: "work" });

    const { error } = await safe(call(appRouter.item.get, { id: unmintable }, { context }));
    await db.delete(items).where(eq(items.id, unmintable));

    // The guard both asserts and NARROWS: `safe` types the error as the
    // procedure's declared union, so past this line `code` exists.
    if (!isDefinedError(error)) throw new Error(`expected a defined error, got ${String(error)}`);
    expect(error.code).toBe("NOT_FOUND");
  });
});

/**
 * ADR-0012: a statement carries its property, its value and its SOURCE, and
 * that is the whole reason a value is a statement rather than a column. The
 * read path emits it so the page can say who claimed what -- which is what
 * "imported, with the provider recorded as its source" looks like to a reader.
 */
describe("item.get, on what each source claimed", () => {
  it("carries the value, the property and the source that asserted it", async () => {
    const id = await anItem(db);
    const provider = await aProvider(db, "http://127.0.0.1:8201");
    await aStatement(db, {
      subjectItemId: id,
      property: "title",
      valueLiteral: "The Tenth Planet (TV story)",
      sourceId: provider,
    });
    await aStatement(db, {
      subjectItemId: id,
      property: "released",
      valueLiteral: "1966-10-08",
      sourceId: provider,
    });

    const item = await call(appRouter.item.get, { id }, { context });

    expect(item.statements).toEqual([
      {
        property: "released",
        value: "1966-10-08",
        sourceKind: "provider",
        sourceLabel: "http://127.0.0.1:8201",
      },
      {
        property: "title",
        value: "The Tenth Planet (TV story)",
        sourceKind: "provider",
        sourceLabel: "http://127.0.0.1:8201",
      },
    ]);
  });

  it("names every field of a statement it emits, and no internal one", async () => {
    // ADR-0045 again, one level down. A statement's own id, its property id and
    // its source id are all internal: a reader can do nothing with them and
    // they are what an enumeration oracle is made of.
    const id = await anItem(db);
    await aStatement(db, {
      subjectItemId: id,
      property: "title",
      valueLiteral: "Named",
      sourceId: await ownerSource(db),
    });

    const item = await call(appRouter.item.get, { id }, { context });
    const [statement] = item.statements;

    expect(statement && Object.keys(statement).sort()).toStrictEqual([
      "property",
      "sourceKind",
      "sourceLabel",
      "value",
    ]);
  });

  it("answers with an empty list for an item nobody has claimed anything about", async () => {
    const item = await call(appRouter.item.get, { id: await anItem(db) }, { context });

    expect(item.statements).toEqual([]);
  });

  /**
   * Read against the CANONICAL id rather than the one asked for, exactly as the
   * placements are (ADR-0040): an alias reaching a merged-away item answers with
   * the survivor's values rather than with none.
   */
  it("answers an alias with the survivor's values", async () => {
    const survivor = await anItemTitled(db, "The survivor");
    const merged = "0f2b8d4a-1c3e-4b5f-9a7d-2e6c8b0f4a11";
    await db
      .insert(aliases)
      .values({ ownerId: await theOwner(db), aliasItemId: merged, itemId: survivor });

    const item = await call(appRouter.item.get, { id: merged }, { context });

    expect(item.statements.map((claim) => claim.value)).toEqual(["The survivor"]);
  });
});

describe("item.get on a container", () => {
  it("answers with what the container holds, in its own order", async () => {
    // A Container IS an Item (ADR-0004), so its page is the Item page and this
    // is where browsing into one lands. The mirror of `placements` above: that
    // answers every ordering this item sits IN, and this answers every item
    // this ordering HOLDS.
    const owner = await ownerSource(db);
    const season = await anItemTitled(db, "An ordering read from the inside", {
      isContainer: true,
      isOrdered: true,
    });
    const second = await anItemTitled(db, "Its second story");
    const first = await anItemTitled(db, "Its first story");
    await aPlacement(db, { containerId: season, itemId: second, position: 2, sourceId: owner });
    await aPlacement(db, { containerId: season, itemId: first, position: 1, sourceId: owner });

    const container = await call(appRouter.item.get, { id: season }, { context });

    expect(container.holds.map((placement) => placement.itemId)).toStrictEqual([first, second]);
    expect(container.holds[0]).toMatchObject({ title: "Its first story", position: 1 });
  });

  it("carries who asserted each member, so a repeat is not a disagreement", async () => {
    // ADR-0017, read through the payload. Two sources claiming different
    // positions for one membership are two rows, and so is a Repeat (ADR-0009)
    // -- one source placing one item twice on purpose. Nothing STORED tells them
    // apart, so the payload has to carry who asserted each row or the page
    // cannot either.
    const wiki = await aProvider(
      db,
      "https://provider.test/router-wiki",
      "A wiki this router asked",
    );
    const broadcaster = await aProvider(
      db,
      "https://provider.test/router-broadcaster",
      "A broadcaster this router asked",
    );
    const season = await anItemTitled(db, "A season the payload disagrees about", {
      isContainer: true,
      isOrdered: true,
    });
    const argued = await anItemTitled(db, "A story the payload places twice");
    await aPlacement(db, {
      containerId: season,
      itemId: argued,
      position: 1,
      sourceId: broadcaster,
    });
    await aPlacement(db, { containerId: season, itemId: argued, position: 3, sourceId: wiki });

    const container = await call(appRouter.item.get, { id: season }, { context });

    expect(container.holds.map((placement) => placement.assertedBy)).toStrictEqual([
      ["A broadcaster this router asked"],
      ["A wiki this router asked"],
    ]);
  });

  it("names every field a placement in a container emits, and no internal one", async () => {
    // ADR-0045's enumeration oracle, one level down, exactly as `placements`
    // carries one. `owner_id`, the change sequence and `edition_id` are absent
    // because no line was written for them.
    const story = await anItemTitled(db, "A story to enumerate");
    const container = await anItemTitled(db, "An ordering to enumerate", { isContainer: true });
    await aPlacement(db, {
      containerId: container,
      itemId: story,
      position: 1,
      sourceId: await ownerSource(db),
    });

    const item = await call(appRouter.item.get, { id: container }, { context });

    expect(item.holds.map((placement) => Object.keys(placement).sort())).toStrictEqual([
      // It went red here when CNCORE-90 added `assertedBy`, which is the
      // enumeration working: who asserted a placement is emitted because a line
      // was written for it, and the sources' own ids still are not.
      ["assertedBy", "id", "itemId", "position", "title"],
    ]);
  });
});

/**
 * THE OWNER'S CONTEXT, because everything below WRITES. `item.create` and
 * `item.retitle` are `ownerProcedure`s (CNCORE-109, ADR-0043), so a caller with
 * no session is refused before reaching any of the behaviour asserted here.
 *
 * IT LOGS IN THROUGH THE ROUTER rather than assembling a session object, for
 * the reason `provider.test.ts` gives: a hand-made session would keep passing
 * on the day the shape of one changes.
 */
const asTheOwner = await createContext({ sessionToken: await aTokenForTheOwner() });

async function aTokenForTheOwner(): Promise<string> {
  const password = env.OWNER_PASSWORD;
  if (password === undefined) {
    throw new Error("this suite's vitest.config.ts sets OWNER_PASSWORD, and it is not set");
  }
  const { token } = await call(appRouter.session.logIn, { password }, { context });
  return token;
}

/**
 * ADR-0003 made usable: an Item with no Provider record and no file is a
 * COMPLETE entry, and the criterion is that it is reachable afterwards -- so
 * the assertion goes back through `item.get` rather than reading the row.
 */
describe("item.create", () => {
  it("creates an Item reachable at its own id, titled by the Owner", async () => {
    const { id } = await call(
      appRouter.item.create,
      { kind: "concept", title: "A novel nobody has catalogued" },
      { context: asTheOwner },
    );

    const item = await call(appRouter.item.get, { id }, { context });

    expect(item.title).toBe("A novel nobody has catalogued");
    // The reader's word for the kind, which is what the read path emits
    // everywhere (ADR-0045, CNCORE-83).
    expect(item.kind).toBe("Concept");
    expect(item.statements).toEqual([
      {
        property: "title",
        value: "A novel nobody has catalogued",
        sourceKind: "owner",
        sourceLabel: "Owner",
      },
    ]);
  });

  it("refuses a caller with no session", async () => {
    // ADR-0044: the demo is read-only with no login, so a write reached by
    // anyone who can reach the process is the hole CNCORE-109 closed.
    const { error } = await safe(
      call(appRouter.item.create, { kind: "work", title: "Uninvited" }, { context }),
    );

    expect((error as { code?: string })?.code).toBe("UNAUTHORIZED");
  });
});

describe("item.retitle", () => {
  it("shows the Owner as the source of the new value", async () => {
    const id = await anItemTitled(db, "The Tenth Planet (TV story)");

    await call(appRouter.item.retitle, { id, title: "The Tenth Planet" }, { context: asTheOwner });

    const item = await call(appRouter.item.get, { id }, { context });
    expect(item.title).toBe("The Tenth Planet");
    expect(item.statements).toContainEqual({
      property: "title",
      value: "The Tenth Planet",
      sourceKind: "owner",
      sourceLabel: "Owner",
    });
  });

  it("beats a provider's title on the same property", async () => {
    // ADR-0025: the owner is at `source_order` 0, so this needs no rank set.
    // The winner comes FIRST in `statements` by the same three terms the
    // projection uses, so the heading and the list cannot disagree.
    const id = await anItem(db);
    await aStatement(db, {
      subjectItemId: id,
      property: "title",
      valueLiteral: "Marco Polo (TV story)",
      sourceId: await aProvider(db, "http://127.0.0.1:8402"),
    });

    await call(appRouter.item.retitle, { id, title: "Marco Polo" }, { context: asTheOwner });

    const item = await call(appRouter.item.get, { id }, { context });
    expect(item.title).toBe("Marco Polo");
    expect(item.statements.map(({ value, sourceLabel }) => [value, sourceLabel])).toEqual([
      ["Marco Polo", "Owner"],
      ["Marco Polo (TV story)", "http://127.0.0.1:8402"],
    ]);
  });

  it("answers NOT_FOUND for an id that addresses nothing", async () => {
    // ADR-0066: an id that names nothing is an ANSWER rather than a failure,
    // which is what lets the page render a 404 instead of a 500.
    const { error } = await safe(
      call(
        appRouter.item.retitle,
        { id: "00000000-0000-4000-8000-000000000000", title: "Nowhere" },
        { context: asTheOwner },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("NOT_FOUND");
  });

  it("refuses a caller with no session", async () => {
    const id = await anItemTitled(db, "Not yours to edit");

    const { error } = await safe(
      call(appRouter.item.retitle, { id, title: "Mine now" }, { context }),
    );

    expect((error as { code?: string })?.code).toBe("UNAUTHORIZED");
    expect((await call(appRouter.item.get, { id }, { context })).title).toBe("Not yours to edit");
  });
});

describe("item.kinds", () => {
  it("offers all seven of ADR-0005's kinds, in the reader's words", async () => {
    const { kinds } = await call(appRouter.item.kinds, undefined, { context });

    // THE SEVEN ARE NAMED HERE because ADR-0005 says the list is CLOSED: an
    // eighth arriving is a decision somebody has to take, and this is what
    // makes them take it rather than discover it. The pairing is the point --
    // `time_span` is what a form submits and `Time span` is what a reader is
    // shown (CNCORE-83), and a surface that confused them would print the
    // column at somebody.
    expect(kinds).toEqual([
      { value: "character", label: "Character" },
      { value: "concept", label: "Concept" },
      { value: "organisation", label: "Organisation" },
      { value: "person", label: "Person" },
      { value: "place", label: "Place" },
      { value: "time_span", label: "Time span" },
      { value: "work", label: "Work" },
    ]);
  });
});
