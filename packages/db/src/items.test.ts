import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, inject, it } from "vitest";

import { createDb, type Database, findItem, items, owners } from "./index";
import { anItemTitled } from "./testing/catalogue";

let db: Database;
let ownerId: string;

beforeAll(async () => {
  db = createDb(inject("databaseUrl"));
  const [owner] = await db.select().from(owners);
  if (!owner) throw new Error("migration 1 should have seeded the single owner row");
  ownerId = owner.id;
});

describe("items", () => {
  it("stores an item and reads it back by id", async () => {
    const [written] = await db.insert(items).values({ ownerId, kind: "work" }).returning();
    if (!written) throw new Error("insert returned nothing");

    const [read] = await db.select().from(items).where(eq(items.id, written.id));

    expect(read?.kind).toBe("work");
  });
});

describe("findItem", () => {
  it("answers nothing for a string that cannot be an id at all", async () => {
    const found = await findItem(db, "not-a-uuid");

    expect(found).toBeUndefined();
  });

  it("answers with the kind in the reader's words as well as the key it is filed under", async () => {
    // CNCORE-83. `CONTEXT.md` is binding on UI copy and calls this a Time span,
    // where the column says `time_span` -- so the two are the pair that makes
    // the difference visible, and `work`/`Work` would hide it behind a capital.
    //
    // BOTH, UNDER NAMES THAT SAY WHICH IS WHICH. `kind` is the foreign key into
    // `item_kinds` and stays the key, because a row's `kind` meaning one thing
    // here and another from a different query is the hazard; the words a reader
    // is shown arrive beside it, read off the table migration 1 seeds them in.
    const era = await anItemTitled(db, "The Hartnell era", { kind: "time_span" });

    const found = await findItem(db, era);

    expect(found?.kind).toBe("time_span");
    expect(found?.kindLabel).toBe("Time span");
  });
});
