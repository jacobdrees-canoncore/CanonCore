import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { type Database, findStatementsOfItem, statements } from "./index";
import { anItem, aProvider, aStatement, connect, ownerSource } from "./testing/catalogue";

let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("the values claimed about one item", () => {
  it("answers with the property, the value, and who said it", async () => {
    const itemId = await anItem(db);
    const provider = await aProvider(db, "http://127.0.0.1:8101");
    await aStatement(db, {
      subjectItemId: itemId,
      property: "title",
      valueLiteral: "The Tenth Planet (TV story)",
      sourceId: provider,
    });

    expect(await findStatementsOfItem(db, itemId)).toEqual([
      {
        property: "title",
        value: "The Tenth Planet (TV story)",
        sourceKind: "provider",
        sourceLabel: "http://127.0.0.1:8101",
      },
    ]);
  });

  /**
   * Every release date, not one. ADR-0081 makes the earliest known release the
   * catalogue's question and editions are what answer it, so until they exist
   * the honest thing is to show what the provider actually said.
   */
  it("keeps every value of a multiple-valued property", async () => {
    const itemId = await anItem(db);
    const provider = await aProvider(db, "http://127.0.0.1:8102");
    for (const released of ["2007-01-07", "2007-03"]) {
      await aStatement(db, {
        subjectItemId: itemId,
        property: "released",
        valueLiteral: released,
        sourceId: provider,
      });
    }

    const values = (await findStatementsOfItem(db, itemId)).map((claim) => claim.value);

    expect(values).toEqual(["2007-01-07", "2007-03"]);
  });

  /**
   * TWO SOURCES DISAGREEING ARE BOTH SHOWN, and the winner comes FIRST -- by the
   * same three terms `winning_literal` uses, in the same order: rank, then the
   * one global source order (ADR-0025), then a stable id. Sorting any other way
   * would put a row at the top that disagrees with the projected title in the
   * heading above it, on the same page.
   */
  it("puts the value that wins the projection first", async () => {
    const itemId = await anItem(db);
    const provider = await aProvider(db, "http://127.0.0.1:8103");
    await aStatement(db, {
      subjectItemId: itemId,
      property: "title",
      valueLiteral: "What the provider says",
      sourceId: provider,
    });
    await aStatement(db, {
      subjectItemId: itemId,
      property: "title",
      valueLiteral: "What the owner says",
      sourceId: await ownerSource(db),
    });

    const [first] = await findStatementsOfItem(db, itemId);

    expect(first?.value).toBe("What the owner says");
    expect(first?.sourceKind).toBe("owner");
  });

  /**
   * ADR-0024: the favourite is the LOCK, so a preferred rank beats the whole
   * source order -- a provider the owner pinned outranks the owner's own words.
   */
  it("lets a preferred rank beat the source order", async () => {
    const itemId = await anItem(db);
    const provider = await aProvider(db, "http://127.0.0.1:8104");
    await aStatement(db, {
      subjectItemId: itemId,
      property: "title",
      valueLiteral: "The pinned one",
      sourceId: provider,
      rank: "preferred",
    });
    await aStatement(db, {
      subjectItemId: itemId,
      property: "title",
      valueLiteral: "What the owner says",
      sourceId: await ownerSource(db),
    });

    const [first] = await findStatementsOfItem(db, itemId);

    expect(first?.value).toBe("The pinned one");
  });

  it("answers with nothing for an item nobody has claimed anything about", async () => {
    expect(await findStatementsOfItem(db, await anItem(db))).toEqual([]);
  });

  /**
   * ADR-0075: a deleted statement is gone to every reader. A tombstone nothing
   * reads is half a mechanism -- it looks like a delete and behaves like nothing.
   */
  it("honours a deleted statement's tombstone", async () => {
    const itemId = await anItem(db);
    const provider = await aProvider(db, "http://127.0.0.1:8105");
    const id = await aStatement(db, {
      subjectItemId: itemId,
      property: "title",
      valueLiteral: "Withdrawn",
      sourceId: provider,
    });
    await db.update(statements).set({ deletedAt: new Date() }).where(eq(statements.id, id));

    expect(await findStatementsOfItem(db, itemId)).toEqual([]);
  });

  /**
   * CNCORE-29. A quarantined statement is a value that arrived broken from an
   * import (migration 6), and the WHOLE POINT of marking it is that no reader
   * shows it as good. A mark nothing reads is half a mechanism: it looks like a
   * check and behaves like nothing, which is worse than no check at all,
   * because it reads from outside as though the door were guarded.
   *
   * DISTINCT FROM THE TOMBSTONE ABOVE, and that is why both tests are here. The
   * withdrawn statement is gone because its source took it back; this one is
   * gone because the catalogue cannot read it, while the source still stands
   * behind it.
   */
  it("leaves out a statement quarantined at the door", async () => {
    const itemId = await anItem(db);
    const provider = await aProvider(db, "http://127.0.0.1:8106");
    await aStatement(db, {
      subjectItemId: itemId,
      property: "released",
      valueLiteral: "soon",
      sourceId: provider,
      quarantined: true,
    });

    expect(await findStatementsOfItem(db, itemId)).toEqual([]);
  });

  /**
   * An ITEM-valued statement is not a literal and has no business in a list of
   * values: `created_by` points at a person, and rendering it here would print
   * an empty cell or, worse, an internal id (ADR-0045).
   */
  it("leaves out a statement whose value is another item", async () => {
    const itemId = await anItem(db);
    const person = await anItem(db, { kind: "person" });
    await aStatement(db, {
      subjectItemId: itemId,
      property: "created_by",
      valueItemId: person,
      sourceId: await ownerSource(db),
    });

    expect(await findStatementsOfItem(db, itemId)).toEqual([]);
  });
});
