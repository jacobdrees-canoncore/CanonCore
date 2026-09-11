import { beforeAll, describe, expect, it } from "vitest";

import { type Database, readCatalogue, readWorks } from "./index";
import { anItemTitled, aPlacement, connect, ownerSource } from "./testing/catalogue";

/** Whether work-browsing lists one particular item. */
async function lists(db: Database, id: string): Promise<boolean> {
  const { entries } = await readWorks(db, { limit: 1000 });
  return entries.some((entry) => entry.id === id);
}

let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("readWorks", () => {
  it("answers with a work and leaves out a person", async () => {
    // ADR-0077's first half. The record's own failure is "people flood the
    // browse grid", and the two items here are exactly that pair: one thing
    // somebody can watch, and one member of its cast.
    const story = await anItemTitled(db, "The Tenth Planet");
    const person = await anItemTitled(db, "William Hartnell", { kind: "person" });

    expect(await lists(db, story)).toBe(true);
    expect(await lists(db, person)).toBe(false);
  });

  it("leaves out a container that holds no work, and keeps one that does", async () => {
    // ADR-0077's second half, and the record is explicit that an earlier version
    // of itself stopped at the kind filter and FAILED ON ITS OWN EXAMPLE:
    // containers fold into `work` (ADR-0004), so "the Doctors, in order" is
    // itself an item of kind `work` and no kind filter can exclude it.
    //
    // THE TWO CONTAINERS DIFFER ONLY IN WHAT THEY HOLD. Both are kind `work` and
    // both are containers, so nothing but `holds_work` can separate them -- which
    // is what makes this a test of the column rather than of the kind.
    const owner = await ownerSource(db);
    const doctors = await anItemTitled(db, "The Doctors, in order", { isContainer: true });
    const season = await anItemTitled(db, "Season 4", { isContainer: true });
    const hartnell = await anItemTitled(db, "The First Doctor", { kind: "character" });
    const smugglers = await anItemTitled(db, "The Smugglers");
    await aPlacement(db, {
      containerId: doctors,
      itemId: hartnell,
      position: 1,
      sourceId: owner,
    });
    await aPlacement(db, { containerId: season, itemId: smugglers, position: 1, sourceId: owner });

    expect(await lists(db, doctors)).toBe(false);
    expect(await lists(db, season)).toBe(true);
  });

  it("counts what it shows rather than what the catalogue holds", async () => {
    // THE SIZE HAS TO ANSWER THE SAME QUESTION THE ENTRIES DO. `total` exists so
    // a capped listing can say what it is not showing, and a work-browsing
    // surface reporting the CATALOGUE's size would tell an owner it was hiding
    // items it was never asked to show -- the same lie the cap exists to
    // prevent, told by the number instead of by the list.
    //
    // THE TWO NUMBERS HAVE TO DIFFER FOR THIS TO BITE, so it seeds the entity
    // that separates them rather than trusting the shared database to hold one.
    await anItemTitled(db, "One more person than there were", { kind: "person" });

    const works = await readWorks(db, { limit: 1 });
    const catalogue = await readCatalogue(db, { limit: 1 });

    expect(works.total).toBeLessThan(catalogue.total);
  });

  it("walks past its own first page without skipping a work", async () => {
    // ADR-0119: a listing is walked forward from the last item it showed, and
    // the cursor is an item's id rather than an offset. Work-browsing is a
    // listing that can exceed a page, so it takes that shape rather than a
    // second one of its own.
    //
    // ASKED ONE AT A TIME, which is what makes the walk observable at all: the
    // whole catalogue fits in a page here, so a walk taken a page at a time
    // would finish in one step and prove nothing.
    const first = await readWorks(db, { limit: 1 });
    if (first.continuesAfter === null) throw new Error("too few works to walk");

    const second = await readWorks(db, { limit: 1, after: first.continuesAfter });

    expect(second.entries).toHaveLength(1);
    // NOT THE SAME ITEM AGAIN, which is the failure a cursor off by one gives,
    // and the two pages agree about how big the listing is.
    expect(second.entries[0]?.id).not.toBe(first.entries[0]?.id);
    expect(second.total).toBe(first.total);
  });
});
