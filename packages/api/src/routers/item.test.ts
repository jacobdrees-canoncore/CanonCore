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
    expect(item.kind).toBe("work");
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
    const unmintable = "c1eebc99-9c0b-4ef8-cb6d-6bb9bd380a11";
    await db.insert(items).values({ id: unmintable, ownerId: await theOwner(db), kind: "work" });

    const { error } = await safe(call(appRouter.item.get, { id: unmintable }, { context }));

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
