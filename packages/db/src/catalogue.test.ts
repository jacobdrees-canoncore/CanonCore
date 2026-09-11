import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { type Database, items, readCatalogue } from "./index";
import { anItemTitled, aStatement, connect, ownerSource } from "./testing/catalogue";

/** Whether the catalogue lists one particular item. */
async function lists(db: Database, id: string): Promise<boolean> {
  const { entries } = await readCatalogue(db, { limit: 1000 });
  return entries.some((entry) => entry.id === id);
}

let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("readCatalogue", () => {
  it("answers with an item that is in the catalogue", async () => {
    const id = await anItemTitled(db, "A story the catalogue holds");

    const { entries } = await readCatalogue(db, { limit: 100 });

    expect(entries).toContainEqual(
      expect.objectContaining({ id, title: "A story the catalogue holds" }),
    );
  });

  it("leaves out an item that has been deleted", async () => {
    // ADR-0075: a tombstone nothing reads is half a mechanism. A deleted item is
    // gone to every reader, and the catalogue is the widest reader there is.
    const id = await anItemTitled(db, "A story that was deleted");
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, id));

    expect(await lists(db, id)).toBe(false);
  });

  it("orders on the sort name, and on the title where no sort name won", async () => {
    // ADR-0014 gives `sort_name` its own index for exactly this. The two titles
    // sort the OTHER WAY ROUND from the two sort keys, so a list ordered on the
    // title alone -- or on nothing -- fails this rather than passing by luck.
    //
    // WRITTEN IN THE ANSWER'S REVERSE ORDER, which is the half that makes it a
    // test: written the other way round it passed against a query with no
    // `order by` at all, because PostgreSQL handed back a small table in
    // insertion order and insertion order happened to be the right one.
    const genesis = await anItemTitled(db, "Genesis of the Daleks");
    const ark = await anItemTitled(db, "The Ark in Space");
    await aStatement(db, {
      subjectItemId: ark,
      property: "sort_name",
      valueLiteral: "Ark in Space, The",
      sourceId: await ownerSource(db),
    });

    const { entries } = await readCatalogue(db, { limit: 1000 });
    const order = entries.map((entry) => entry.id);

    expect(order.indexOf(ark)).toBeLessThan(order.indexOf(genesis));
  });

  it("counts the whole catalogue even when it answers with only part of it", async () => {
    // NO SILENT CAP. A page showing the first hundred of four thousand has to be
    // able to say so, and a count that only ever reported what it returned would
    // let it claim the hundred WAS the catalogue.
    //
    // MEASURED BY ADDING ONE rather than by counting the table a second way: a
    // second count written here would be this query's own rule restated, and
    // would agree with it however wrong both were.
    const before = await readCatalogue(db, { limit: 1000 });
    await anItemTitled(db, "One more story than there were");

    const after = await readCatalogue(db, { limit: 1 });

    expect(after.entries).toHaveLength(1);
    expect(after.total).toBe(before.total + 1);
  });

  it("says what kind each entry is, and whether it holds other items", async () => {
    // ADR-0005's kinds and ADR-0004's fold, together. A Person and a Work of the
    // same name are two rows a reader has to be able to tell apart (CNCORE-60's
    // story 12), and containers fold INTO `work` -- so the kind alone cannot
    // separate "The Daleks' Master Plan" from an ordering that holds it.
    //
    // THE ASSERTION IS ON THE LABEL RATHER THAN THE KEY, and `Time span` is the
    // pair that makes the difference visible: `CONTEXT.md` is binding on UI
    // copy and calls it that, where the column says `time_span`. Migration 1
    // seeds the label beside the kind, so this is a read of the catalogue's own
    // words rather than a map the app would have to keep in step.
    const person = await anItemTitled(db, "Verity Lambert", { kind: "person" });
    const era = await anItemTitled(db, "The Hartnell era", { kind: "time_span" });
    const ordering = await anItemTitled(db, "An ordering of stories", { isContainer: true });

    const { entries } = await readCatalogue(db, { limit: 1000 });
    const byId = new Map(entries.map((entry) => [entry.id, entry]));

    expect(byId.get(person)).toMatchObject({ kind: "Person", isContainer: false });
    expect(byId.get(era)).toMatchObject({ kind: "Time span" });
    expect(byId.get(ordering)).toMatchObject({ kind: "Work", isContainer: true });
  });
});
