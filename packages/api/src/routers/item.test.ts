import { aliases, type Database, items } from "@canoncore/db";
import {
  aContainerLargerThanOnePage,
  anItem,
  anItemInMoreOrderingsThanOnePage,
  anItemTitled,
  aPlacement,
  aProvider,
  aStatement,
  connect,
  ownerSource,
  someStories,
  theOwner,
} from "@canoncore/db/testing/catalogue";
import { env } from "@canoncore/env/server";
import { placementsInContainerPublic, placementsOfItemPublic } from "@canoncore/schemas";
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

    expect(item.placements.entries.map((placement) => Object.keys(placement).sort())).toStrictEqual(
      [
        // It went red here when CNCORE-121 added `assertedBy`, exactly as the
        // members listing below went red when CNCORE-90 added it there. The
        // enumeration working: who asserted a placement is emitted because a line
        // was written for it, and the sources' own ids still are not.
        ["assertedBy", "containerId", "containerTitle", "id", "placedBy", "position"],
      ],
    );
  });

  it("names the sources behind each ordering, so a Repeat reads apart from a disagreement", async () => {
    // THE CRITERION AT THE ROUTER (CNCORE-121), the mirror of the one the
    // members listing carries below. Two PROVIDERS disagreeing about position
    // is the disagreement this catalogue actually holds -- the wiki's series
    // against TMDB's season -- and `placedBy` answers "provider" for both, so
    // the payload has to carry the names for a reader to tell them apart.
    const wiki = await aProvider(db, "https://payload.test/wiki", "A wiki this payload asked");
    const broadcaster = await aProvider(
      db,
      "https://payload.test/broadcaster",
      "A broadcaster this payload asked",
    );
    const season = await anItemTitled(db, "An ordering the payload disagrees about", {
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

    const item = await call(appRouter.item.get, { id: argued }, { context });

    // RANK STILL LEADS (ADR-0017): the wiki holds the lower source order and so
    // speaks first, though the broadcaster put the story earlier. Naming the
    // sources does not reorder the list.
    expect(
      item.placements.entries.map((p) => [p.position, p.placedBy, p.assertedBy]),
    ).toStrictEqual([
      [3, "provider", ["A wiki this payload asked"]],
      [1, "provider", ["A broadcaster this payload asked"]],
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

    expect(
      item.placements.entries.map((p) => [p.containerTitle, p.position, p.placedBy]),
    ).toStrictEqual([
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
    expect(item.placements.entries.map((p) => p.containerTitle)).toStrictEqual([
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

    expect(container.holds.entries.map((placement) => placement.itemId)).toStrictEqual([
      first,
      second,
    ]);
    expect(container.holds.entries[0]).toMatchObject({ title: "Its first story", position: 1 });
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

    expect(container.holds.entries.map((placement) => placement.assertedBy)).toStrictEqual([
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

    expect(item.holds.entries.map((placement) => Object.keys(placement).sort())).toStrictEqual([
      // It went red here when CNCORE-90 added `assertedBy`, which is the
      // enumeration working: who asserted a placement is emitted because a line
      // was written for it, and the sources' own ids still are not.
      ["assertedBy", "id", "itemId", "position", "title"],
    ]);
  });

  it('names every field the "Also appears in" listing itself emits', () => {
    // THE SAME THREE FACTS, one listing over (ADR-0045, ADR-0119). This was a
    // bare array until CNCORE-125 and it was the last one in the app that was:
    // an array can carry the page and cannot carry what the page is not showing.
    expect(Object.keys(placementsOfItemPublic.shape).sort()).toStrictEqual([
      "continuesAfter",
      "entries",
      // IT WENT RED HERE WHEN CNCORE-129 ADDED `everyPlacedBy`, which is the
      // enumeration working: a listing a reader can narrow has to say what it
      // can be narrowed TO, and that is a field because it is a second question
      // rather than something derivable from the rows.
      "everyPlacedBy",
      "total",
    ]);
  });

  it("names every field the members listing itself emits", () => {
    // THE LISTING AROUND THE ROWS IS PART OF THE CONTRACT TOO (ADR-0045), and
    // it is the same three facts the catalogue, work-browsing and Catalogue
    // search all answer with: what this page carries, how much there is, and
    // where to carry on from. A `holds` that was still a bare array would fail
    // this, which is the enumeration working.
    expect(Object.keys(placementsInContainerPublic.shape).sort()).toStrictEqual([
      "continuesAfter",
      "entries",
      "total",
    ]);
  });
});

describe("item.get on a container larger than one page", () => {
  it("caps the members it answers with, and says how much it is not showing", async () => {
    // ADR-0119, and the cap is this seam's rather than the caller's: `A_PAGE` is
    // what this app will serve in one answer, and `item.get` takes no `limit` to
    // raise or lower it.
    //
    // `total` IS THE OTHER HALF. A page that reported only what it listed would
    // tell an owner their ordering is a hundred long however much it holds,
    // which is the silent cap ADR-0119 exists to refuse.
    const { id, holds } = await aContainerLargerThanOnePage(db, {
      title: "An ordering the router has to cap",
      holding: await someStories(db, 120, "A story the router caps"),
    });

    const container = await call(appRouter.item.get, { id }, { context });

    expect(container.holds.entries).toHaveLength(100);
    expect(container.holds.total).toBe(holds.length);
    expect(container.holds.continuesAfter).toBe(container.holds.entries.at(-1)?.id);
  });

  it("reaches every member by walking, and lands on none of them twice", async () => {
    // THE OTHER HALF OF THE CAP (ADR-0119): a surface that says "Showing 100 of
    // 121" and offers no way to reach member 101 has told the owner the size of
    // an ordering it will not let them see.
    //
    // THE ORACLE IS THE PLACEMENTS THE FIXTURE WROTE rather than a second
    // reading of the container: asking the read path to say what should have
    // been walked is asking the mechanism under test to mark its own work.
    //
    // AND THE FIXTURE HOLDS A REPEAT, which is what says the cursor is a
    // PLACEMENT's id. One item twice in one container is two rows sharing an
    // `itemId`, so an item-id cursor could not tell which of them a page ended
    // on -- it would serve one twice or skip the other, and the no-repeats line
    // below is what catches that.
    const { id, holds } = await aContainerLargerThanOnePage(db, {
      title: "An ordering the router has to walk",
      holding: await someStories(db, 120, "A story the router walks"),
    });

    const walked: string[] = [];
    let after: string | undefined;
    // BOUNDED, so a cursor that does not advance FAILS rather than hangs.
    for (let pages = 0; pages <= holds.length; pages += 1) {
      const page = await call(appRouter.item.get, { id, after }, { context });
      walked.push(...page.holds.entries.map((placement) => placement.id));
      if (page.holds.continuesAfter === null) break;
      after = page.holds.continuesAfter;
    }

    expect([...walked].sort()).toStrictEqual([...holds].sort());
    // SORTED SETS COMPARE EQUAL EVEN WITH A REPEAT IN THEM, so the one criterion
    // the comparison above cannot see gets its own line.
    expect(new Set(walked).size).toBe(walked.length);
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

/**
 * ADR-0096: a note is a Statement with a `note` property, sourced to the Owner.
 * ADR-0045: the public read path carries no notes, so it has a procedure of its
 * own rather than a field on `item.get`.
 */
describe("item.annotate and item.note", () => {
  it("answers with the note and the Owner as its source", async () => {
    const id = await anItemTitled(db, "The Tenth Planet");

    await call(
      appRouter.item.annotate,
      { id, note: "The one I always come back to" },
      { context: asTheOwner },
    );

    expect(await call(appRouter.item.note, { id }, { context: asTheOwner })).toEqual({
      value: "The one I always come back to",
      sourceLabel: "Owner",
    });
  });

  /**
   * `noteByHand` TRIMS, so a box holding nothing but whitespace removes the
   * note rather than writing a blank one. Asserted here because the trim is
   * this seam's: `annotateItemByHand` is handed what came out of it.
   */
  it("removes the note when nothing but whitespace is submitted", async () => {
    const id = await anItemTitled(db, "An item annotated in error");
    await call(
      appRouter.item.annotate,
      { id, note: "What I thought at the time" },
      { context: asTheOwner },
    );

    await call(appRouter.item.annotate, { id, note: "   \n  " }, { context: asTheOwner });

    expect(await call(appRouter.item.note, { id }, { context: asTheOwner })).toBeNull();
  });

  /**
   * AND THE LINE BREAKS INSIDE ONE SURVIVE IT, which is the other half of the
   * trim: it reaches the ends of the value and nothing else, because a
   * paragraph break is something the owner typed on purpose.
   */
  it("keeps the owner's own line breaks inside a note", async () => {
    const id = await anItemTitled(db, "An item I wrote paragraphs about");

    await call(
      appRouter.item.annotate,
      { id, note: "  The first thing.\n\nThe second thing.  " },
      { context: asTheOwner },
    );

    expect(await call(appRouter.item.note, { id }, { context: asTheOwner })).toMatchObject({
      value: "The first thing.\n\nThe second thing.",
    });
  });

  /**
   * ADR-0045'S OWN SENTENCE, AT THE SEAM IT IS ABOUT: the public read path
   * "carries no internal ids, no owner id and NO NOTES". `item.get` is open
   * (ADR-0044), so a note reaching its `statements` list is a note on every
   * item page a stranger opens -- and it would arrive there sourced to the
   * owner, which is the one claim the owner most plainly did not publish.
   *
   * THE OWNER'S OWN CONTEXT IS USED FOR THE READ, not a visitor's, which is
   * what makes this the stricter assertion. A test asking as a visitor would
   * pass against a handler that emitted the note conditionally on the session;
   * asking as the owner and getting nothing says the payload has no note in it
   * AT ALL.
   */
  it("keeps the note out of `item.get`, which anyone may call", async () => {
    const id = await anItemTitled(db, "The Tenth Planet (TV story)");
    await call(
      appRouter.item.annotate,
      { id, note: "Not for anybody else to read" },
      { context: asTheOwner },
    );

    const item = await call(appRouter.item.get, { id }, { context: asTheOwner });

    expect(item.statements.map(({ property }) => property)).toEqual(["title"]);
    expect(JSON.stringify(item)).not.toContain("Not for anybody else to read");
  });

  it("removes the note when the owner clears it", async () => {
    const id = await anItemTitled(db, "Something I thought better of");
    await call(
      appRouter.item.annotate,
      { id, note: "What I thought at the time" },
      { context: asTheOwner },
    );

    await call(appRouter.item.annotate, { id, note: "" }, { context: asTheOwner });

    // NULL RATHER THAN AN EMPTY NOTE, which is the difference between a note
    // removed and a page rendering an empty box under a heading.
    expect(await call(appRouter.item.note, { id }, { context: asTheOwner })).toBeNull();
  });

  it("answers null for an item nobody has written a note about", async () => {
    const id = await anItemTitled(db, "Nothing said about it");

    expect(await call(appRouter.item.note, { id }, { context: asTheOwner })).toBeNull();
  });

  /**
   * AND `null` FOR A WELL-FORMED ID THAT ADDRESSES NOTHING, which is the half
   * of that answer the docstring makes a claim about: an owner asking about a
   * deleted item and one asking about an item they have said nothing about get
   * the same page, and neither is an error (ADR-0066).
   */
  it("answers null for a well-formed id that addresses nothing", async () => {
    expect(
      await call(
        appRouter.item.note,
        { id: "00000000-0000-4000-8000-000000000000" },
        { context: asTheOwner },
      ),
    ).toBeNull();
  });

  /**
   * A MALFORMED ID IS A BAD_REQUEST HERE, WHERE `item.get` ANSWERS NOT_FOUND --
   * and the difference is who does the asking rather than an inconsistency.
   * CNCORE-14's argument is about an id A READER TYPED OR SHARED, reached at
   * `/items/<id>`; nothing types an id at this procedure, because the page calls
   * it with the canonical id `item.get` just answered with. So "that is not an
   * id" is the honest answer to a client composing a request by hand, and this
   * pins it rather than leaving the pair to read as a slip.
   */
  it("refuses a malformed id rather than answering null for one", async () => {
    const { error, data } = await safe(
      call(appRouter.item.note, { id: "not-a-uuid" }, { context: asTheOwner }),
    );

    expect(data).toBeUndefined();
    expect((error as { code?: string })?.code).toBe("BAD_REQUEST");
  });

  it("answers NOT_FOUND when the id addresses nothing to annotate", async () => {
    const { error } = await safe(
      call(
        appRouter.item.annotate,
        { id: "00000000-0000-4000-8000-000000000000", note: "A note on nothing" },
        { context: asTheOwner },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("NOT_FOUND");
  });

  it("refuses to write a note for a caller with no session", async () => {
    const id = await anItemTitled(db, "Not yours to annotate");

    const { error } = await safe(
      call(appRouter.item.annotate, { id, note: "Mine now" }, { context }),
    );

    expect((error as { code?: string })?.code).toBe("UNAUTHORIZED");
    expect(await call(appRouter.item.note, { id }, { context: asTheOwner })).toBeNull();
  });

  /**
   * THE ONLY READ ON THIS ROUTER A VISITOR IS REFUSED, and the refusal is the
   * other half of keeping notes out of the public payload: a procedure a
   * stranger could call would publish what `item.get` was careful not to.
   */
  it("refuses to read a note to a caller with no session", async () => {
    const id = await anItemTitled(db, "Annotated, and not for you");
    await call(
      appRouter.item.annotate,
      { id, note: "Between me and the catalogue" },
      { context: asTheOwner },
    );

    const { error } = await safe(call(appRouter.item.note, { id }, { context }));

    expect((error as { code?: string })?.code).toBe("UNAUTHORIZED");
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

describe("item.get on an item in more orderings than one page", () => {
  /**
   * ONE FIXTURE FOR THE WHOLE BLOCK, and that is a cost rather than tidiness.
   * This suite shares ONE catalogue and each of these mints a hundred and twenty
   * containers into it, so a fixture per test puts hundreds of items in front of
   * every listing assertion in the package -- which is how CNCORE-129 first
   * found the front page's own test failing on a fixture it had never heard of.
   *
   * IT IS READ AND NEVER WRITTEN TO, which is what makes sharing safe here: each
   * test below asks this item a different question and none of them changes it.
   */
  let paged: Awaited<ReturnType<typeof anItemInMoreOrderingsThanOnePage>>;

  beforeAll(async () => {
    paged = await anItemInMoreOrderingsThanOnePage(db, {
      // THE TITLE SORTS AFTER the items the catalogue's own tests assert are on
      // its first page, which is not a coincidence to be re-derived: a hundred
      // and twenty containers named ahead of one push it off a capped listing.
      title: "A story the router has to walk",
      orderings: 120,
    });
  });

  it("caps the orderings it answers with, and says how many there are", async () => {
    // ADR-0119, and the cap is this seam's rather than the caller's: `item.get`
    // takes no `limit`, so a caller may not raise it and nothing wants it lower.
    //
    // `total` IS THE OTHER HALF, and on this listing it is the one number that
    // must not be wrong: multi-placement is the product's central claim, so a
    // page reporting a hundred orderings over three hundred would understate
    // exactly what the product exists to show.
    const { id, sitsIn } = paged;

    const item = await call(appRouter.item.get, { id }, { context });

    expect(item.placements.entries).toHaveLength(100);
    expect(item.placements.total).toBe(sitsIn.length);
    expect(item.placements.continuesAfter).toBe(item.placements.entries.at(-1)?.id);
  });

  it("reaches every ordering by walking, and lands on none of them twice", async () => {
    // THE OTHER HALF OF THE CAP (ADR-0119): a page that says "Showing 100 of
    // 121" and offers no way to reach the hundred-and-first has told the reader
    // the size of a list it will not let them see.
    //
    // THE ORACLE IS THE PLACEMENTS THE FIXTURE WROTE rather than a second
    // reading of the item: asking the read path to say what should have been
    // walked is asking the mechanism under test to mark its own work.
    const { id, sitsIn } = paged;

    const walked: string[] = [];
    let placedAfter: string | undefined;
    // BOUNDED, so a cursor that does not advance FAILS rather than hangs.
    for (let pages = 0; pages <= sitsIn.length; pages += 1) {
      const page = await call(appRouter.item.get, { id, placedAfter }, { context });
      walked.push(...page.placements.entries.map((placement) => placement.id));
      if (page.placements.continuesAfter === null) break;
      placedAfter = page.placements.continuesAfter;
    }

    expect([...walked].sort()).toStrictEqual(sitsIn.map((p) => p.id).sort());
    expect(new Set(walked).size).toBe(walked.length);
  });

  it("narrows to one origin at the query, and counts what the narrowing holds", async () => {
    // CNCORE-129. `?placed=` reached this listing as a filter over whatever page
    // the cap had handed the surface, which was every ordering the item sits in
    // only while the listing was uncapped. Asked here it is the listing that is
    // narrow, so its size, its cap and its walk are its own.
    const { id, imported } = paged;

    const item = await call(appRouter.item.get, { id, placed: "provider" }, { context });

    // ONE ORDERING OUT OF A HUNDRED AND TWENTY-ONE, and the fixture puts it past
    // the first page on purpose: a filter over the rows the page carried would
    // answer nothing at all here.
    expect(item.placements.entries.map((placement) => placement.containerId)).toStrictEqual([
      imported.containerId,
    ]);
    expect(item.placements.total).toBe(1);
    expect(item.placements.continuesAfter).toBeNull();
  });

  it("names every origin it has a placement from, on a page holding one of them", async () => {
    // THE SECOND READ (ADR-0045): the chips are what a reader narrows WITH, so
    // they cannot be read off the rows the narrowing answered. This page carries
    // the hand-placed hundred and no imported row at all, and has to offer both.
    const { id } = paged;

    const whole = await call(appRouter.item.get, { id }, { context });
    const narrowed = await call(appRouter.item.get, { id, placed: "provider" }, { context });

    expect(whole.placements.entries.map((placement) => placement.placedBy)).not.toContain(
      "provider",
    );
    expect(whole.placements.everyPlacedBy).toStrictEqual(["owner", "provider"]);
    // AND NARROWED TO ONE OF THEM IT STILL OFFERS BOTH, which is the way back to
    // All: chips derived from a narrowed page would hold only the origin the
    // reader had already chosen.
    expect(narrowed.placements.everyPlacedBy).toStrictEqual(["owner", "provider"]);
  });

  it("answers an empty listing for an origin it has nothing from, and the chips all the same", async () => {
    // ADR-0066: a non-identifying parameter that names nothing narrows to
    // nothing rather than erroring -- and the origins beside it are what makes
    // that recoverable instead of a dead end.
    // A SMALL ITEM RATHER THAN THE FIXTURE ABOVE, because nothing here needs a
    // listing larger than a page: what is under test is an origin with no rows,
    // and the cap has no part in it.
    const story = await anItem(db);
    const ordering = await anItemTitled(db, "An ordering nothing derived", { isContainer: true });
    await aPlacement(db, {
      containerId: ordering,
      itemId: story,
      position: 1,
      sourceId: await ownerSource(db),
    });

    const item = await call(appRouter.item.get, { id: story, placed: "derived" }, { context });

    expect(item.placements.entries).toStrictEqual([]);
    expect(item.placements.total).toBe(0);
    expect(item.placements.everyPlacedBy).toStrictEqual(["owner"]);
  });
});
