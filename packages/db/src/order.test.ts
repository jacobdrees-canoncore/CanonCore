import { and, eq, inArray, type SQL } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { type Database, items } from "./index";
import { type AnchorIn, type TheOrder, theAnchorIn } from "./order";
import { IN_THE_CATALOGUE, SORT_KEY, walkListing } from "./queries";
import { anItemTitled, connect } from "./testing/catalogue";

let db: Database;

beforeAll(async () => {
  db = await connect();
});

/**
 * THE FOUR ITEMS THIS SUITE WALKS, WRITTEN IN AN ORDER THAT IS NEITHER ANSWER.
 *
 * THE IDS ARE PINNED AND RUN OPPOSITE TO THE TITLES, and that is half the test.
 * Every order here ends on the id, so a comparison that has lost a key in front
 * of it falls through to one that still works -- and whether that loses a row
 * is then decided by whichever uuids `gen_random_uuid` handed out. Reversed,
 * the id is guaranteed to disagree with the key in front of it, so a walk
 * reading the id alone answers wrongly every time rather than half the time.
 *
 * AND THE INSERTION ORDER IS A THIRD ORDER AGAIN, which is the other half. A
 * fixture written in the order it is read back passes with the ordering
 * removed, because rows come off a fresh table roughly as they went in: the
 * expected sequences below would then be asserting nothing. Neither of them is
 * this list.
 */
const FOUR = [
  { id: "01690000-0000-4000-8000-000000000002", title: "Marco Polo", sortsAs: "Marco Polo" },
  {
    id: "01690000-0000-4000-8000-000000000004",
    title: "An Unearthly Child",
    sortsAs: "Unearthly Child",
  },
  {
    id: "01690000-0000-4000-8000-000000000001",
    title: "The Keys of Marinus",
    sortsAs: "Keys of Marinus",
  },
  {
    id: "01690000-0000-4000-8000-000000000003",
    title: "Inside the Spaceship",
    sortsAs: "Inside the Spaceship",
  },
];

/**
 * The four in SORT-KEY order, which is what a key on `SORT_KEY` answers.
 *
 * `sortsAs` IS WORKED OUT BY HAND ABOVE RATHER THAN COMPUTED (CNCORE-173), and
 * writing it down is what keeps this a test. Three of these titles open with an
 * article, so the derived sort name files them under the word after it and the
 * answer is NOT title order: sorting on `title` here would put `An Unearthly
 * Child` first, and the walk puts it last. Re-deriving the key with the
 * product's own rule would make the expectation agree with the code by
 * construction whatever either said.
 */
const BY_SORT_KEY = [...FOUR]
  .sort((a, b) => a.sortsAs.localeCompare(b.sortsAs))
  .map(({ id }) => id);

/** The four in ID order, which is what the id alone answers once keys tie. */
const BY_ID = [...FOUR].sort((a, b) => a.id.localeCompare(b.id)).map(({ id }) => id);

/** Just these four, so the walk is a fixture rather than the whole database. */
const THESE_FOUR = and(
  IN_THE_CATALOGUE,
  inArray(
    items.id,
    FOUR.map(({ id }) => id),
  ),
) as SQL;

/**
 * ONE LISTING WALKED TO ITS END, a page at a time, in whatever order it is
 * given -- which is how a skipped row shows up as a missing one and a repeated
 * row as a doubled one.
 *
 * ONE ROW AT A TIME, so every step of the walk goes through the cursor. A
 * bigger page would let a fixture this size arrive whole and assert nothing
 * about the comparison at all.
 */
async function walked<O extends TheOrder>(order: O, within: SQL): Promise<string[]> {
  const seen: string[] = [];
  let after: string | undefined;
  for (;;) {
    const anchor = after === undefined ? undefined : await anchorIn(order, after);
    const page = await walkListing(db, { within, order, cut: anchor && { after: anchor }, limit: 1 });
    seen.push(...page.rows.map((row) => row.id));
    if (page.continuesAfter === null) return seen;
    after = page.continuesAfter;
    // A listing of four cannot need more than five pages; anything more is the
    // walk looping rather than this loop being too tight.
    if (seen.length > FOUR.length) return seen;
  }
}

/**
 * WHERE ONE ROW SITS IN ONE ORDER, read by the order's OWN keys rather than by
 * a list this suite writes out beside them. A key added to an order reaches
 * this read too, which is the third place the old shape could leave one behind.
 */
async function anchorIn<O extends TheOrder>(order: O, id: string): Promise<AnchorIn<O>> {
  const [anchor] = await db.select(theAnchorIn(order)).from(items).where(eq(items.id, id));
  if (anchor === undefined) throw new Error(`no row at ${id}`);
  // CAST BECAUSE THIS HELPER IS GENERIC, not because the shape is in doubt: the
  // fields ARE the order's keys, and Drizzle cannot infer their types through an
  // order it only knows as `TheOrder`. Measured: without it the select infers
  // `{ id: unknown }`.
  return anchor as AnchorIn<O>;
}

/**
 * ONE ORDER PER LISTING, DERIVING BOTH THE ORDER AND THE COMPARISON THAT WALKS
 * IT (CNCORE-169). The two were separate things that had to be kept naming the
 * same terms by a sentence, and four defects came from them disagreeing --
 * CNCORE-88, 110, 113 and 125.
 */
describe("an order a listing is walked in", () => {
  beforeAll(async () => {
    for (const { id, title } of FOUR) await anItemTitled(db, title, { id });
  });

  it("walks every row of a one-key order exactly once, in that order", async () => {
    // THE KEY THEY ALL TIE ON, so the id behind it is what separates them --
    // and the ids run the opposite way from the titles, so this sequence is
    // one no other order here produces.
    const byKind = { keys: { kind: items.kind }, id: items.id } satisfies TheOrder;

    expect(await walked(byKind, THESE_FOUR)).toEqual(BY_ID);
  });

  it("honours a key added to an order, rather than ordering by it and walking without it", async () => {
    // THE SAME ORDER WITH A KEY ADDED BEHIND THE ONE THEY TIE ON, which is the
    // shape all four defects had: the ORDER BY named a term the comparison did
    // not, so rows tied with the anchor on the terms it DID name were stepped
    // over. CNCORE-88 measured exactly this -- "a four-row fixture sharing one
    // title walked to ONE of them" -- and this fixture is that one.
    //
    // WITH THE KEY LEFT OUT the comparison falls through to `id > the anchor's`
    // from a first row that holds the LARGEST id, so nothing is past it and
    // this walk answers one row. It cannot be left out: the order below is the
    // only place the keys are written, and both halves are read off it.
    const byKindThenTitle = {
      keys: { kind: items.kind, sortKey: SORT_KEY },
      id: items.id,
    } satisfies TheOrder;

    expect(await walked(byKindThenTitle, THESE_FOUR)).toEqual(BY_SORT_KEY);
  });
});
