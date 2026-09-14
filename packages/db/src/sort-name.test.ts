import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { type Database, properties, sources, statements } from "./index";
import { anItem, anItemTitled, aStatement, connect, ownerSource } from "./testing/catalogue";

/**
 * CNCORE-173. Nothing in this product ever asserted a sort name, so every
 * Listing fell through to the raw title and `The Daleks' Master Plan` filed
 * under T.
 *
 * A SORT NAME IS A STATEMENT LIKE ANY OTHER, which is what ADR-0071 buys: the
 * computation is a SOURCE, it names its own version, and it competes in the one
 * global source order rather than sitting in a column nobody can dispute. So
 * every test here writes a statement and reads statements back, and the
 * projected column is checked as the consequence rather than as the mechanism.
 */
let db: Database;

beforeAll(async () => {
  db = await connect();
});

/** Every live `sort_name` statement about one item, best-placed first. */
async function sortNamesOf(db: Database, itemId: string) {
  return db
    .select({
      value: statements.valueLiteral,
      sourceKind: sources.kind,
      sourceIdentity: sources.identity,
    })
    .from(statements)
    .innerJoin(properties, eq(properties.id, statements.propertyId))
    .innerJoin(sources, eq(sources.id, statements.sourceId))
    .where(
      and(
        eq(statements.subjectItemId, itemId),
        eq(properties.name, "sort_name"),
        isNull(statements.deletedAt),
      ),
    )
    .orderBy(sources.sourceOrder);
}

describe("the derived sort name", () => {
  it("files itself as a derived source naming its computation and its version", async () => {
    // ADR-0071: `derived` names the computation AND ITS VERSION --
    // `derived:palette-v2`, never a bare `derived` -- because invalidating a
    // computed claim when the algorithm changes is the only operation ever
    // performed on one, and a flag cannot answer "which rows does the new
    // extractor invalidate?".
    const item = await anItemTitled(db, "The Daleks' Master Plan");

    expect(await sortNamesOf(db, item)).toEqual([
      { value: "Daleks' Master Plan", sourceKind: "derived", sourceIdentity: "derived:sort-name-v1" },
    ]);
  });
});
