import type { Database } from "@canoncore/db";
import {
  anItem,
  anItemTitled,
  aStatement,
  connect,
  ownerSource,
  someStories,
} from "@canoncore/db/testing/catalogue";
import type { CataloguePublic } from "@canoncore/schemas";
import { call } from "@orpc/server";
import { beforeAll, describe, expect, it } from "vitest";

import { createContext } from "../context";
import { appRouter } from "./index";
import { A_PAGE } from "./listing";

/**
 * THE LISTING CONTRACT: what every Listing procedure answers, asked once.
 *
 * IT IS ONE BLOCK BECAUSE THE GUARANTEES WERE NOT INHERITED. `catalogue.list`
 * carried five cases, Catalogue search carried two of the same ones in
 * different wording, and work-browsing carried NONE -- one test, that a Person
 * is excluded. So the second Listing added to this shape inherited nothing of
 * the walk and a third would have inherited the same, while every one of them
 * is the same cap, the same cursor and the same `continuesAfter` (ADR-0119).
 * Each procedure now keeps the test of its own QUESTION and this block keeps
 * the rest.
 *
 * ADR-0103's second seam: the router called in the same process, with context
 * built by the real `createContext` rather than hand-copied from it. The db
 * seam has its own tests of each order's hard cases, and they are not repeated
 * here -- what this asserts is that each PROCEDURE is wired to them.
 */
const context = await createContext();

let db: Database;

beforeAll(async () => {
  db = await connect();
});

/** One Listing procedure, and what it takes to ask it for a page. */
interface AListing {
  /** The procedure, spelled the way a caller reaches it. */
  readonly procedure: string;
  /**
   * Rows this Listing holds, seeded so the walk has some of its own to arrive
   * at -- which is what keeps `total` from being an oracle marking its own work.
   */
  readonly holds: (db: Database) => Promise<string[]>;
  /** One page of it, however that Listing spells the rest of its question. */
  readonly page: (input: { limit?: number; after?: string }) => Promise<CataloguePublic>;
}

/** What Catalogue search is asked for, and what its own Rows are titled. */
const WHAT_A_READER_TYPED = "Walked by the Listing contract";

/** How many Rows of its own each Listing is given before it is walked. */
const A_RUN_OF_THEM = 5;

/**
 * EVERY LISTING PROCEDURE, AND ADDING A LISTING IS ADDING A LINE HERE. An entry
 * says which procedure it is, how to ask it for a page, and what to put in it;
 * everything else about a Listing is the block below and is not an entry's to
 * decide.
 *
 * THE THREE THAT ARE THEIR OWN SURFACE, and the two that are not are absent for
 * a reason rather than by oversight. A Container's members and "Also appears in"
 * are Listings by ADR-0119's first sentence, but they ride on `item.get` --
 * because a Container IS an Item (ADR-0004) and its page is the Item page, so a
 * `container.members` would be one thing at two addresses (ADR-0066). They
 * therefore take NO `limit`: the handler serves `A_PAGE` and a caller cannot ask
 * for anything else. The cap is a question they cannot be asked at all, and the
 * walk and the size would each cost a fixture of more than a hundred Placements,
 * because there is no smaller page to ask for.
 *
 * THE CURSOR IS THE EXCEPTION, AND IT IS SAID RATHER THAN GLOSSED. `after` and
 * `placedAfter` are plain optional strings on `item.get`, so asking those two
 * what a cursor naming nothing does would cost nothing here. They stay out
 * anyway, because a member that can answer one question of five is not a member
 * of ONE BLOCK -- and what that costs is a real gap rather than none. At the
 * package export a Container's members is asked all four; **"Also appears in"
 * is asked THREE**, and the one it is missing is exactly this one. Neither is
 * asked it at THIS seam either. CNCORE-198 carries both halves.
 */
const EVERY_LISTING: AListing[] = [
  {
    procedure: "catalogue.list",
    holds: (db) => aRunAndTheShapesTheOrderHas(db, "Walked by the catalogue's own contract"),
    page: (input) => call(appRouter.catalogue.list, input, { context }),
  },
  {
    procedure: "catalogue.works",
    holds: (db) => aRunAndTheShapesTheOrderHas(db, "Walked by work-browsing's contract"),
    page: (input) => call(appRouter.catalogue.works, input, { context }),
  },
  {
    procedure: "catalogue.search",
    /*
     * ROWS SHARING ONE TITLE, WHICH IS THIS ORDER'S HARD SHAPE AND NOT THE
     * CATALOGUE'S. A ranking has no keyless block to reach -- every Row it lists
     * matched `title ilike ...`, so every Row has a title, a closeness and a
     * sort key -- and what it has instead is TIES, which ADR-0120 makes the
     * common case rather than a corner of one. Rows sharing a title rank at
     * exactly 1 and tie on the sort key behind it, so only the id separates
     * them and every page boundary below cuts a tie.
     */
    holds: (db) => rowsSharingOneTitle(db, WHAT_A_READER_TYPED),
    page: (input) =>
      call(appRouter.catalogue.search, { ...input, query: WHAT_A_READER_TYPED }, { context }),
  },
];

/**
 * ROWS OF EVERY SHAPE THE CATALOGUE'S ORDER HAS, which a plain run is not.
 *
 * A WALK OVER DISTINCTLY-TITLED ROWS PASSES AGAINST A CURSOR THAT LOSES ROWS,
 * which is `aCatalogueLargerThanOnePage`'s own argument one package over.
 *
 * AND THIS SUITE'S SHARED CATALOGUE CANNOT STAND IN FOR THE PAIR, because WHICH
 * Rows it holds when this file runs is decided by vitest's file order and that
 * order is a CACHE. Read in `BaseSequencer.sort` (vitest 5.0.0, 2026-09-14): a
 * file that FAILED last run is promoted to FIRST, then files run longest-first,
 * and file size decides only where there are no cached stats at all. So a
 * Listing borrowing other files' Rows is moved to the front of the suite the
 * moment it goes red -- where nothing has run yet and it holds only its own.
 * A TEST THAT LOSES ITS FIXTURE BY FAILING IS THE WORST ARRANGEMENT THERE IS:
 * the run that would show you the failure is the run that no longer can.
 *
 * MEASURED 2026-09-14 with the pair below REMOVED and the catalogue's sort key
 * declared `everyRowHasIt`, which deletes the branch that reaches the Rows with
 * no key at all. One command, run twice: the first went RED, 466 Rows of a
 * `total` of 491 -- and failing moved the file to the front, so the SECOND run
 * of the same command went green. The mutant did not survive by being subtle.
 * It survived by breaking the test that caught it.
 *
 * WITH THE PAIR it is red in either position: 7 Rows of a `total` of 9 and 14 of
 * 18 with the file first -- work-browsing is four short because it lists this
 * block's pair as well as its own -- and 466 of 493 and 471 of 494 with the file
 * late. The figure moves; the shape does not.
 *
 * THE TIED PAIR IS SEEDED AND THE BOUNDARY IS NOT AIMED AT IT, said plainly
 * rather than left to be assumed. Two Rows sharing a sort name are separated by
 * their ids alone, and cutting a page AT that tie is ADR-0119's own rule for
 * testing a keyset walk -- but the page size below is a function of a shared
 * catalogue's size, so where the boundary falls is not this test's to choose.
 * Cutting at the tie is asserted at the package export, where the fixture and
 * the page size are both the test's own; Catalogue search's entry above ties on
 * EVERY Row, so the id is mutation-checked through a boundary here as well.
 */
async function aRunAndTheShapesTheOrderHas(db: Database, titled: string): Promise<string[]> {
  const run = await someStories(db, A_RUN_OF_THEM, titled);

  const tied = await Promise.all([
    anItemTitled(db, `${titled}, told twice (novel)`),
    anItemTitled(db, `${titled}, told twice (audio)`),
  ]);
  const owner = await ownerSource(db);
  for (const id of tied) {
    await aStatement(db, {
      subjectItemId: id,
      property: "sort_name",
      valueLiteral: `${titled}, told twice`,
      sourceId: owner,
    });
  }

  // NO STATEMENT AT ALL, which is the whole of this fixture: no title and no
  // sort name is no sort key (ADR-0014), and those sort last as one block that
  // a cursor written in one regime never reaches from any page.
  const keyless = await Promise.all([anItem(db), anItem(db)]);

  return [...run, ...tied, ...keyless];
}

/** Rows that tie on every key an order has, leaving only the id behind them. */
function rowsSharingOneTitle(db: Database, title: string): Promise<string[]> {
  return Promise.all(Array.from({ length: A_RUN_OF_THEM }, () => anItemTitled(db, title)));
}

/**
 * HOW MANY PAGES A WALK IS CUT INTO, whatever the Listing's size.
 *
 * THE PAGE SIZE IS DERIVED RATHER THAN WRITTEN DOWN, because these Listings
 * differ in size by two orders of magnitude and one number cannot serve both. A
 * small one is a hundred requests over the shared catalogue; a large one is a
 * single page over Catalogue search's five Rows, where a walk that never crosses
 * a boundary asserts nothing about walking. Derived, every Listing is cut at
 * several boundaries and none is cut at many.
 */
const PAGES_OF_IT = 4;

/** The page size that cuts a Listing of this size into `PAGES_OF_IT` pages. */
function aPageThatCuts(total: number): number {
  // CLAMPED TO THE CAP, which is the ceiling this app serves and not a number
  // the walk may raise for its own convenience -- a quarter of the catalogue is
  // past it the moment the catalogue passes four hundred Rows.
  return Math.min(A_PAGE, Math.max(1, Math.ceil(total / PAGES_OF_IT)));
}

/**
 * EVERY ROW ONE LISTING ANSWERS WITH, walked from the beginning to the end.
 *
 * IT IS BOUNDED BY THE LISTING'S OWN SIZE, because the failure this walks into
 * is a cursor that does not advance -- and an unbounded loop over one answers no
 * question, it hangs the suite until a timeout says something vague about it.
 */
async function everyRowWalked(page: AListing["page"], total: number): Promise<string[]> {
  const limit = aPageThatCuts(total);
  const walked: string[] = [];
  for (let after: string | undefined; ; ) {
    const answer = await page({ limit, after });
    walked.push(...answer.rows.map((row) => row.id));
    if (answer.continuesAfter === null) return walked;
    if (walked.length > total) {
      throw new Error(`the walk answered ${walked.length} Rows of a Listing holding ${total}`);
    }
    after = answer.continuesAfter;
  }
}

describe.each(EVERY_LISTING)("$procedure, on the Listing contract", ({ holds, page }) => {
  let ofItsOwn: string[];

  beforeAll(async () => {
    ofItsOwn = await holds(db);
  });

  it("refuses a page above the cap, and accepts one at it", async () => {
    // THE CEILING IS THIS APP'S, not the caller's. A limit a request can raise
    // is not a cap on anything -- the cost of one answer would be a function of
    // what somebody asked for rather than of what this app chose to serve.
    //
    // BOTH HALVES, because the refusal alone is satisfied by a procedure that
    // refuses everything -- and while the first of these was being written it
    // was satisfied by a procedure that did not exist at all, since calling
    // `undefined` throws as readily as a validator does.
    //
    // THE MESSAGE IS oRPC'S OWN and does not name the field: the input schema
    // rejects and the procedure answers "Input validation failed". Matched
    // rather than left bare so that a `TypeError` -- which is what calling a
    // procedure that is not there raises -- cannot satisfy it.
    await expect(page({ limit: A_PAGE + 1 })).rejects.toThrow("Input validation failed");

    await expect(page({ limit: A_PAGE })).resolves.toBeDefined();
  });

  it("walks without repeating or skipping a Row", async () => {
    // THE ORACLE IS THE LISTING'S OWN SIZE, which is not the walk marking its
    // own work: `total` is a count over the same predicate in a different
    // statement (ADR-0119), so arriving at exactly that many DISTINCT Rows is
    // the two halves agreeing. Repeats and skips are one assertion apart -- a
    // walk that repeats overruns the count, one that skips falls short -- and
    // the Rows this Listing was given are what say the count is not zero.
    const { total } = await page({ limit: 1 });

    const walked = await everyRowWalked(page, total);

    expect(walked).toHaveLength(total);
    expect(new Set(walked).size).toBe(total);
    expect(walked).toEqual(expect.arrayContaining(ofItsOwn));
  });

  it("reports one size from both pages", async () => {
    // A COUNT TAKEN AFTER THE CURSOR BIT would shrink page by page and tell an
    // owner their catalogue was emptying as they read it. It is the half that
    // has already gone wrong twice, one file apart: a window count is taken
    // AFTER `where`, correct exactly until the Listing gained a cursor
    // (CNCORE-82, then CNCORE-88 in the copy that had been left standing).
    const first = await page({ limit: 1 });
    if (first.continuesAfter === null) throw new Error("a Listing of one has no second page");

    const second = await page({ limit: 1, after: first.continuesAfter });

    expect(second.rows).toHaveLength(1);
    expect(second.rows[0]?.id).not.toBe(first.rows[0]?.id);
    expect(second.total).toBe(first.total);
  });

  it("starts at the beginning when the cursor names nothing", async () => {
    // ADR-0066's rule for a parameter that is not an identity: one naming
    // nothing matches nothing and changes nothing. A cursor is cut at a Row, and
    // an owner who deletes that Row should not find a bookmarked page answering
    // with an error -- they should find the Listing.
    //
    // BOTH SHAPES, because they fail differently and only one of them looks like
    // a cursor. A well-formed id for no Row is an empty query; a MALFORMED one
    // reaches a `uuid` column as PostgreSQL error 22P02, which is the measured
    // 500 ADR-0066 records against `item.get` before CNCORE-14 -- a truncated id
    // in a shared link reading as "this server is broken".
    const beginning = await page({ limit: 3 });

    const noSuchRow = await page({ limit: 3, after: crypto.randomUUID() });
    const notAnId = await page({ limit: 3, after: "page-two-please" });

    expect(noSuchRow.rows).toStrictEqual(beginning.rows);
    expect(notAnId.rows).toStrictEqual(beginning.rows);
  });

  it("names every field its Rows emit, and no internal one", async () => {
    // ADR-0045, AND IT IS A FIFTH WHERE THE TICKET NAMES FOUR. It is here rather
    // than on `catalogue.list` because it is a fact about what a Listing's Row
    // IS rather than about the question any one of them asks, and leaving it on
    // one procedure is what left the other two unasked -- the same shape as the
    // walk above, one assertion smaller.
    //
    // WHAT IT GUARDS AT THIS SEAM IS THE SCHEMA, measured rather than assumed:
    // a field added to `asRow` alone is STRIPPED by `.output(cataloguePublic)`
    // and this stays green, where a field added to `catalogueRowPublic` reaches
    // the reader and fails all three. Both halves were run. The enumeration
    // oracle is still the point -- never the query's row with fields removed --
    // and the seam that enforces it here is the declaration, not the mapping.
    const { rows } = await page({ limit: 1 });
    const [row] = rows;
    if (!row) throw new Error("the Listing answered with nothing to enumerate");

    expect(Object.keys(row).sort()).toStrictEqual(["id", "isContainer", "kind", "title"]);
  });
});
