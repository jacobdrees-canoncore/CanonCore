import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  createGroupByHand,
  type Database,
  items,
  putItemInGroupByHand,
  readCatalogue,
  readWorks,
} from "./index";
import { anItem, anItemTitled, aPlacement, connect, ownerSource } from "./testing/catalogue";

/** Whether work-browsing lists one particular item. */
async function lists(db: Database, id: string): Promise<boolean> {
  const { rows } = await readWorks(db, { limit: 1000 });
  return rows.some((row) => row.id === id);
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
    // THE SIZE HAS TO ANSWER THE SAME QUESTION THE ROWS DO. `total` exists so
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

    expect(second.rows).toHaveLength(1);
    // NOT THE SAME ITEM AGAIN, which is the failure a cursor off by one gives,
    // and the two pages agree about how big the listing is.
    expect(second.rows[0]?.id).not.toBe(first.rows[0]?.id);
    expect(second.total).toBe(first.total);
  });

  it("starts over, where the work a page was cut at has since been deleted", async () => {
    // THE SAME WALK, WHICH IS WHAT THIS ASSERTS rather than a second rule of
    // its own: `readWorks` and `readCatalogue` differ in their WHERE and in
    // nothing else, so what a listing does with an anchor that has lost its
    // place is one decision taken in one place (ADR-0119). A deleted item has
    // no title and no sort name -- `catalogue.test.ts` carries the mechanism
    // and both shapes of the failure -- so this order has no place left for it,
    // it names no position, and the walk starts at the beginning.
    //
    // THE TICKET NAMES THIS SURFACE, which is why it is asserted here and not
    // left to the shared function: `/works` walked the same defect, and a fix
    // reported for the catalogue alone would leave a reader wondering which of
    // the two was fixed.
    const anchorId = await anItemTitled(db, "A work a kept link was cut at");
    // AND A WORK AFTER IT, WHICH THE SHARED CATALOGUE WAS QUIETLY SUPPLYING.
    // The derived sort name drops the article, so the anchor files under W --
    // LAST of the Works in this file, and with this file run alone the page
    // cut at it had nothing after it: `continuesAfter` was null and the walk
    // below was never reached. An untitled Work has no sort key and sorts
    // after every one that has, so the anchor is never the end.
    await anItem(db);

    const order = (await readWorks(db, { limit: 10_000 })).rows.map((row) => row.id);
    const cut = await readWorks(db, { limit: order.indexOf(anchorId) + 1 });
    expect(cut.continuesAfter).toBe(anchorId);
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, anchorId));

    const kept = await readWorks(db, { limit: 10_000, after: cut.continuesAfter ?? "" });

    // WORK-BROWSING OVER AGAIN, oracled against the same listing read in one go
    // -- two code paths, which is what makes this an assertion rather than the
    // walk marking its own work. NOT against the catalogue's own read: these
    // two listings hold different sets, and only this one answers the question
    // `readWorks` was asked.
    expect(kept.rows.map((row) => row.id)).toStrictEqual(
      (await readWorks(db, { limit: 10_000 })).rows.map((row) => row.id),
    );
  });
});

/**
 * WORK-BROWSING NARROWED TO ONE GROUP (CNCORE-180, ADR-0010): what can I watch,
 * asked about one universe rather than about every one at once.
 *
 * EVERY GROUP HERE IS DRAWN BY THE TEST THAT READS IT, which is what lets these
 * assertions be EXACT where the rest of this file has to say "less than". The
 * catalogue is shared by every file in the suite; a Group nobody else knows the
 * id of holds what this test put in it and nothing more.
 *
 * THE TOMBSTONES AND THE GROUP THAT NAMES NOTHING ARE NOT ASKED AGAIN HERE.
 * They are the predicate's, and `catalogue.test.ts` asks them of the one
 * predicate every Listing `and`s on. What is this file's is that work-browsing
 * `and`s it on too, and keeps its own question while it does.
 */
describe("readWorks, narrowed to a Group", () => {
  it("answers the Works in that Group and hides its entities, at the Group's own size", async () => {
    // THE SAME GROUP, TWO QUESTIONS, which is ADR-0077 surviving the narrowing.
    // A Person the Owner put in a scope is in the scope: the Catalogue narrowed
    // to it lists them, and work-browsing narrowed to it leaves them out
    // exactly as it does unnarrowed. A narrowing that REPLACED work-browsing's
    // predicate rather than joining it would list the Person on both.
    //
    // AND THE SIZE BESIDE THE ROWS, against a literal: a Group narrowing the
    // Rows and not the count reports the whole of work-browsing over a page of
    // one Work.
    const scope = await createGroupByHand(db, { name: "A scope with a story and its cast" });
    const story = await anItemTitled(db, "A story inside a narrowed work-browsing");
    const person = await anItemTitled(db, "A person inside a narrowed work-browsing", {
      kind: "person",
    });
    await anItemTitled(db, "A story outside a narrowed work-browsing");
    for (const itemId of [story, person]) {
      await putItemInGroupByHand(db, { groupId: scope, itemId });
    }

    const works = await readWorks(db, { limit: 1000, group: scope });
    const catalogue = await readCatalogue(db, { limit: 1000, group: scope });

    expect(works.rows.map((row) => row.id)).toStrictEqual([story]);
    expect(works.total).toBe(1);
    expect(catalogue.rows.map((row) => row.id).sort()).toStrictEqual([story, person].sort());
    expect(catalogue.total).toBe(2);
  });
});
