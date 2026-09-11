import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, inject, it } from "vitest";

import { createDb, type Database, findItem, items, owners } from "./index";

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
});
