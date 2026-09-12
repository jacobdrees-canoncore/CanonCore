import { and, eq, isNull, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  annotateItemByHand,
  createDb,
  createItemByHand,
  type Database,
  findItem,
  findNoteOfItem,
  findStatementsOfItem,
  ItemRefused,
  importProvidedRecord,
  items,
  properties,
  retitleItemByHand,
  statements,
} from "./index";
import {
  anItem,
  anItemTitled,
  aProvider,
  aStatement,
  connect,
  readItem,
} from "./testing/catalogue";

let db: Database;

beforeAll(async () => {
  db = await connect();
});

/**
 * ADR-0003's claim made usable: an Item may be created with no Provider record
 * and no file, and always. A novel the owner does not own is a complete entry.
 */
describe("creating an Item by hand", () => {
  it("writes an Item the catalogue can find, titled by the Owner", async () => {
    const { itemId } = await createItemByHand(db, { kind: "work", title: "A novel I do not own" });

    expect((await findItem(db, itemId))?.title).toBe("A novel I do not own");
    expect(await findStatementsOfItem(db, itemId)).toEqual([
      {
        property: "title",
        value: "A novel I do not own",
        sourceKind: "owner",
        sourceLabel: "Owner",
      },
    ]);
  });
});

/**
 * ADR-0025: the owner sits at `source_order` 0, so their value outranks every
 * provider's before ranks are even considered. Asserted through the PROJECTION
 * rather than by reading the statement back, because the projection is what a
 * reader is actually shown (ADR-0014).
 */
describe("editing a title by hand", () => {
  it("beats a provider's title on the same item", async () => {
    const provider = await aProvider(db, "http://127.0.0.1:8201");
    const itemId = await anItem(db);
    await aStatement(db, {
      subjectItemId: itemId,
      property: "title",
      valueLiteral: "The Tenth Planet (TV story)",
      sourceId: provider,
    });

    await retitleItemByHand(db, { itemId, title: "The Tenth Planet" });

    expect((await findItem(db, itemId))?.title).toBe("The Tenth Planet");
    // AND THE PROVIDER'S CLAIM STILL STANDS. A source may only withdraw what it
    // said itself, so the owner's edit outranks the provider rather than
    // erasing it -- which is what makes the disagreement visible on the page.
    expect(await findStatementsOfItem(db, itemId)).toEqual([
      { property: "title", value: "The Tenth Planet", sourceKind: "owner", sourceLabel: "Owner" },
      {
        property: "title",
        value: "The Tenth Planet (TV story)",
        sourceKind: "provider",
        sourceLabel: "http://127.0.0.1:8201",
      },
    ]);
  });
});

/**
 * THE CRITERION THE WHOLE SOURCE MODEL EXISTS FOR: a refresh from the provider
 * must not undo the owner's judgement. Jellyfin's first-non-empty-wins merge
 * cannot express this at all -- the losing answer is discarded, so there is
 * nothing for a re-import to leave standing (ADR-0026).
 *
 * ASSERTED THROUGH THE REAL IMPORT rather than by re-asserting the provider's
 * claim by hand, because what is under test is `assertClaims` reaching ONLY its
 * own source's rows -- and a hand-written provider statement would exercise a
 * different path from the one an owner's refresh actually takes.
 */
describe("an Owner title meeting a re-import", () => {
  const RECORD = { externalId: "8301", title: "The Tenth Planet (TV story)", released: [] };
  const PROVIDER = {
    identity: "http://127.0.0.1:8301",
    label: "provider-wiki",
    attribution: null,
  };

  it("stands after the provider says its own title again", async () => {
    const { itemId } = await importProvidedRecord(db, { provider: PROVIDER, record: RECORD });
    await retitleItemByHand(db, { itemId, title: "The Tenth Planet" });

    const again = await importProvidedRecord(db, { provider: PROVIDER, record: RECORD });

    // The SAME item, found by the id the provider knows it by (ADR-0078).
    expect(again.itemId).toBe(itemId);
    expect((await findItem(db, itemId))?.title).toBe("The Tenth Planet");
    // THE TITLE CLAIMS ALONE, because the import writes an `external_id`
    // statement too (migration 3) and this test is about neither it nor the
    // order it happens to sort in.
    expect(await titleClaims(db, itemId)).toEqual([
      { property: "title", value: "The Tenth Planet", sourceKind: "owner", sourceLabel: "Owner" },
      {
        property: "title",
        value: "The Tenth Planet (TV story)",
        sourceKind: "provider",
        sourceLabel: "provider-wiki",
      },
    ]);
  });
});

/**
 * Every title anybody claims about one item, winner first.
 *
 * `findStatementsOfItem` ALREADY ORDERS BY THE WINNING TERMS -- rank, then the
 * global source order, then the id -- so filtering preserves the one property
 * these assertions are about: the owner's value comes first because it WINS,
 * not because a test sorted it there.
 */
async function titleClaims(db: Database, itemId: string) {
  const claims = await findStatementsOfItem(db, itemId);
  return claims.filter(({ property }) => property === "title");
}

/**
 * ADR-0004: a Container IS an Item, folded into the `work` kind -- there is no
 * collection kind. `CONTEXT.md`'s Container headword makes `is_container`
 * STORED rather than inferred
 * from having members, which is what lets an empty container exist at all.
 */
describe("creating a Container by hand", () => {
  it("marks it ordered when the owner says the sequence means something", async () => {
    const { itemId } = await createItemByHand(db, {
      kind: "work",
      title: "Season 4",
      isContainer: true,
      isOrdered: true,
    });

    const written = await readItem(db, itemId);

    expect(written?.isContainer).toBe(true);
    expect(written?.isOrdered).toBe(true);
  });

  /**
   * ADR-0018 puts ordering on the placement, so an UNORDERED container is a real
   * and different thing rather than one nobody has sequenced yet: "every Dalek
   * story" holds its members without claiming an order among them.
   */
  it("leaves it unordered when the owner does not", async () => {
    const { itemId } = await createItemByHand(db, {
      kind: "work",
      title: "Every Dalek story",
      isContainer: true,
    });

    const written = await readItem(db, itemId);

    expect(written?.isContainer).toBe(true);
    expect(written?.isOrdered).toBe(false);
  });
});

describe("what the catalogue refuses", () => {
  /**
   * ADR-0075: an item the owner deleted is gone to every reader, so retitling
   * one would write a claim about a grave and report success while the owner
   * sees nothing change.
   *
   * A REAL TOMBSTONE, NOT AN UNUSED ID. The NOT_FOUND case at the router seam
   * uses an id that addresses nothing, which exercises the same branch by a
   * different route -- this is the one that proves the `deleted_at` clause is
   * doing anything at all. Remove it from the query and this test alone fails.
   */
  it("refuses to retitle an Item the owner has deleted", async () => {
    const itemId = await anItemTitled(db, "Deleted, and not to be written about");
    await db.update(items).set({ deletedAt: sql`now()` }).where(eq(items.id, itemId));

    expect(await retitleItemByHand(db, { itemId, title: "A claim about a grave" })).toBe(false);
  });

  /**
   * The foreign key on `item_kinds` (ADR-0005 closes the list), surfaced as a
   * REFUSAL rather than as whatever the driver threw -- which is what lets the
   * router answer BAD_REQUEST for this and 500 for a fault.
   */
  it("refuses a kind that is not one of the seven", async () => {
    await expect(
      createItemByHand(db, { kind: "spaceship", title: "Not one of the seven" }),
    ).rejects.toBeInstanceOf(ItemRefused);
  });

  /** `items_ordered_implies_container` (migration 1): an ordering over nothing. */
  it("refuses an ordering on something that holds nothing", async () => {
    await expect(
      createItemByHand(db, { kind: "work", title: "Ordered, holding nothing", isOrdered: true }),
    ).rejects.toBeInstanceOf(ItemRefused);
  });

  /**
   * AND A FAULT IS STILL A FAULT, which is the half the narrowing exists for.
   * A bare `catch` in the router turned every failure into "No such kind of
   * item", so a dead pool told the owner their kind did not exist. `ItemRefused`
   * is what separates the two, and a test that only ever asserted the refusals
   * would pass just as well against the bare catch.
   */
  it("does not dress a fault up as a refusal", async () => {
    const broken = createDb("postgresql://nobody@127.0.0.1:1/nothing");
    try {
      await expect(
        createItemByHand(broken, { kind: "work", title: "Never written" }),
      ).rejects.not.toBeInstanceOf(ItemRefused);
    } finally {
      await broken.$client.end();
    }
  });
});

/**
 * ADR-0096: a note is a Statement with a `note` property, sourced to the Owner.
 * `CONTEXT.md` calls it "the owner's own free text about an item. Theirs alone:
 * nothing else can assert one."
 */
describe("annotating an Item by hand", () => {
  it("writes a note sourced to the Owner", async () => {
    const { itemId } = await createItemByHand(db, { kind: "work", title: "The Tenth Planet" });

    await annotateItemByHand(db, { itemId, note: "The one I always come back to" });

    expect(await findNoteOfItem(db, itemId)).toEqual({
      value: "The one I always come back to",
      sourceKind: "owner",
      sourceLabel: "Owner",
    });
  });

  /**
   * EDITING REPLACES, and the `single` cardinality migration 12 declares is
   * what that means: a note is the owner's own free text about an item, so a
   * second one is a correction rather than a rival value. `assertClaims` makes
   * what this source holds EQUAL to what it now claims, which is what withdraws
   * the first without anything having to name it.
   */
  it("replaces the note the owner wrote before, leaving one", async () => {
    const { itemId } = await createItemByHand(db, { kind: "work", title: "The Tenth Planet" });
    await annotateItemByHand(db, { itemId, note: "What I first thought of it" });

    await annotateItemByHand(db, { itemId, note: "What I think of it now" });

    expect(await findNoteOfItem(db, itemId)).toMatchObject({ value: "What I think of it now" });
    // AND THE FIRST IS GONE RATHER THAN OUTRANKED. Two live notes from one
    // mouth would tie on rank and on the source order and fall through to a
    // uuid, so which one the page showed would flip on nothing.
    expect(await liveNotesOn(itemId)).toBe(1);
  });

  it("removes the note when the owner clears it", async () => {
    const { itemId } = await createItemByHand(db, { kind: "work", title: "The Tenth Planet" });
    await annotateItemByHand(db, { itemId, note: "Something I later thought better of" });

    await annotateItemByHand(db, { itemId, note: "" });

    // NULL AND NOT AN EMPTY STRING, which is the difference between a note
    // removed and a note that renders as an empty box on the page.
    expect(await findNoteOfItem(db, itemId)).toBeNull();
  });

  it("refuses to annotate an Item the owner has deleted", async () => {
    const { itemId } = await createItemByHand(db, { kind: "work", title: "Gone" });
    await db.update(items).set({ deletedAt: sql`now()` }).where(eq(items.id, itemId));

    // ADR-0075, and the same answer `retitleItemByHand` gives: writing a claim
    // about a grave would report success while the owner sees nothing change.
    expect(await annotateItemByHand(db, { itemId, note: "A note on a grave" })).toBe(false);
  });
});

/**
 * How many notes stand on one item, counted PAST the read above.
 *
 * `findNoteOfItem` answers one by design, so it cannot tell one note from two
 * -- which is exactly what the replacement test has to know. Counting the rows
 * is reaching behind the seam on purpose and only here: the claim under test is
 * about what the catalogue HOLDS rather than about what a reader is served.
 */
async function liveNotesOn(itemId: string): Promise<number> {
  const rows = await db
    .select({ id: statements.id })
    .from(statements)
    .innerJoin(properties, eq(properties.id, statements.propertyId))
    .where(
      and(
        eq(statements.subjectItemId, itemId),
        eq(properties.name, "note"),
        isNull(statements.deletedAt),
      ),
    );
  return rows.length;
}
