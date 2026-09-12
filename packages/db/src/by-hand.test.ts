import { beforeAll, describe, expect, it } from "vitest";

import {
  createItemByHand,
  type Database,
  findItem,
  findStatementsOfItem,
  importProvidedRecord,
  retitleItemByHand,
} from "./index";
import { anItem, aProvider, aStatement, connect, readItem } from "./testing/catalogue";

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
 * collection kind. ADR-0009 makes `is_container` STORED rather than inferred
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
