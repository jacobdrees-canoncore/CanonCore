import { createGroupByHand, type Database, putItemInGroupByHand } from "@canoncore/db";
import {
  anItem,
  anItemTitled,
  aStatement,
  connect,
  ownerSource,
  someStories,
} from "@canoncore/db/testing/catalogue";
import { A_NARROWING, type CataloguePublic } from "@canoncore/schemas";
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
  /**
   * One page of it, however that Listing spells the rest of its question --
   * including the Group it is narrowed to, which every one of these takes
   * (CNCORE-180) and `narrowedToAGroup` below supplies.
   */
  readonly page: (input: {
    limit?: number;
    after?: string;
    before?: string;
    group?: string;
    kind?: string;
    letter?: string;
    order?: "name" | "added";
  }) => Promise<CataloguePublic>;
  /**
   * WHETHER ITS ROWS ARE FILED UNDER LETTERS, which is whether a jump to one
   * means anything (CNCORE-174). The two Listings ordered by sort name are;
   * Catalogue search ranks by closeness to what a reader typed, and nothing in
   * a ranking is filed under a letter, so it takes none.
   */
  readonly filedByName: boolean;
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
 * THE THREE THAT ARE THEIR OWN SURFACE, each walked twice -- as it is, and
 * narrowed to a Group -- and the two that are not are absent for a reason
 * rather than by oversight. A Container's members and "Also appears in"
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
 * anyway, because a member that can answer one question of EIGHT is not a
 * member of ONE BLOCK -- so `item.test.ts` asks the two of them beside it, and at
 * the package export both are asked all FIVE (CNCORE-198, which added this one to
 * "Also appears in"). It was one of six until CNCORE-174 added the step back and
 * the jump: the step back needs a page smaller than the cap to walk, which these
 * two cannot be asked for, so `item.test.ts` steps each back over a fixture
 * larger than one page instead, and neither is filed under a letter.
 *
 * THE COUNTS MOVED WITH CNCORE-172, which added the sixth question below and
 * the package-export assertion a Container's members was missing. "Also appears
 * in" needed neither: it is the Listing that already had the size's second
 * position asserted, which is how that gap was found.
 */
/**
 * THE THREE QUESTIONS THEMSELVES, before each is also asked narrowed to a Group.
 *
 * NAMED BECAUSE ONE BLOCK BELOW CANNOT USE THE NARROWED ENTRIES (CNCORE-309).
 * `narrowedToAGroup` spreads its own Group over the input it is handed, so a
 * test that drives `group` through one of those entries drives the fixture's id
 * and not its own value -- a premise that is not vacuous but INVERTED, which
 * would read as the ceiling failing to hold. The narrowing ceiling is a fact
 * about `listingInput`, which all three questions share, so asking it of the
 * three is asking it of every Listing here.
 */
const EVERY_QUESTION: AListing[] = [
  {
    procedure: "catalogue.list",
    holds: (db) => aRunAndTheShapesTheOrderHas(db, "Walked by the catalogue's own contract"),
    page: (input) => call(appRouter.catalogue.list, input, { context }),
    filedByName: true,
  },
  {
    procedure: "catalogue.works",
    holds: (db) => aRunAndTheShapesTheOrderHas(db, "Walked by work-browsing's contract"),
    page: (input) => call(appRouter.catalogue.works, input, { context }),
    filedByName: true,
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
    filedByName: false,
  },
];

const EVERY_LISTING: AListing[] = eachAlsoNarrowed(EVERY_QUESTION);

/** Every Listing above, followed by the same Listing narrowed to a Group. */
function eachAlsoNarrowed(listings: AListing[]): AListing[] {
  return listings.flatMap((listing) => [listing, narrowedToAGroup(listing)]);
}

/**
 * THE SAME LISTING NARROWED TO A GROUP, which is a Listing in its own right as
 * far as a walk is concerned: a Group holding all of Doctor Who is seven
 * thousand Rows, and a reader walks it exactly as they walk the Listing it was
 * narrowed out of. So each of the three is a line here rather than a test of
 * its own, and inherits every guarantee below by being one -- the Catalogue
 * since CNCORE-179, and work-browsing and Catalogue search since CNCORE-180.
 *
 * DERIVED FROM THE UNNARROWED ENTRY RATHER THAN WRITTEN BESIDE IT, so a fourth
 * Listing added above is walked narrowed without anybody remembering to add
 * it twice -- and so each narrowed walk meets THAT Listing's hard shapes inside
 * the Group: the tied pair and the keyless tail for the catalogue's order, and
 * the Rows tied on every key for Catalogue search's. A narrowing that walked
 * plain Rows would pass against a cursor that lost them, for the reason
 * `aRunAndTheShapesTheOrderHas` gives.
 *
 * THE GROUP IS HELD IN A BINDING OF ITS OWN, drawn when this entry's Rows are
 * seeded and read by every page it is asked for, because "within which Group"
 * is decided only once the database it lives in is reachable. `describe.each`
 * seeds each entry before it pages it, so no page is asked for with it still
 * empty. And nothing else knows the Group's id, so its Rows are exactly the
 * ones put in it: the one kind of entry here the shared catalogue cannot reach
 * into.
 */
function narrowedToAGroup({ procedure, holds, page, filedByName }: AListing): AListing {
  let group = "";
  return {
    procedure: `${procedure}, narrowed to a Group`,
    filedByName,
    holds: async (db) => {
      group = await createGroupByHand(db, { name: `Walked by ${procedure}, narrowed` });
      const rows = await holds(db);
      for (const itemId of rows) {
        await putItemInGroupByHand(db, { groupId: group, itemId });
      }
      return rows;
    },
    page: (input) => page({ ...input, group }),
  };
}

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

  // AND ONE FILED UNDER ANOTHER LETTER, ahead of the run, so a jump to the
  // run's own letter has something to land PAST (CNCORE-174). Without it every
  // Row here files under one letter or none, and a jump that ignored the
  // letter would land at the start and be right by accident.
  const elsewhere = await anItemTitled(db, `${FILED_EARLIER}, ${titled}`);

  return [...run, ...tied, ...keyless, elsewhere];
}

/**
 * THE LETTER THE CATALOGUE'S RUNS ARE FILED UNDER, and the words that file a
 * Row ahead of them. Both run titles open "Walked by", and a Row opening
 * "Another letter" is filed under A whichever way the collation reads it.
 */
const THE_RUNS_LETTER = "W";
const FILED_EARLIER = "Another letter";

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

/**
 * EVERY PAGE ONE LISTING IS WALKED IN, forward from the start: `everyRowWalked`,
 * keeping where each page began and ended, which is what a step back is
 * checked against.
 */
async function everyPageWalked(page: AListing["page"], total: number): Promise<string[][]> {
  const limit = aPageThatCuts(total);
  const pages: string[][] = [];
  for (let after: string | undefined; ; ) {
    const answer = await page({ limit, after });
    pages.push(answer.rows.map((row) => row.id));
    if (answer.continuesAfter === null) return pages;
    if (pages.length > total) throw new Error(`the walk ran past ${total} pages`);
    after = answer.continuesAfter;
  }
}

/*
 * A NARROWING IS BOUNDED, AND ON THE CAP'S OWN ARGUMENT (CNCORE-284, CNCORE-309,
 * ADR-0182). `limit` is the cost of one answer, which a caller may not choose;
 * `kind` and `group` are values a caller chooses the LENGTH of, carried into the
 * comparison this Listing runs per request and into every link the page that
 * asked is then built from.
 *
 * ASKED OF THE THREE QUESTIONS RATHER THAN OF EVERY ENTRY, for the reason
 * `EVERY_QUESTION` gives: all three share `listingInput`, and the narrowed
 * entries cannot be asked about `group` at all.
 *
 * BOTH HALVES, in the words the cap test uses of itself: a refusal alone is
 * satisfied by a procedure that refuses everything.
 */
describe.each(EVERY_QUESTION)("$procedure, on the narrowing ceiling", ({ page }) => {
  it("refuses a narrowing above the ceiling, and accepts one at it", async () => {
    // THE MESSAGE IS oRPC'S OWN, matched for the reason the cap test gives:
    // calling a procedure that is not there raises as readily as a validator.
    await expect(page({ kind: "x".repeat(A_NARROWING + 1) })).rejects.toThrow(
      "Input validation failed",
    );

    // AT THE CEILING IT IS A QUESTION WITH AN ANSWER, and the answer is nothing:
    // no kind is spelled `xxx...`, so the Listing narrows to nothing rather than
    // the seam refusing it. That is ADR-0066's rule for a parameter that is not
    // an identity, which a ceiling on its LENGTH does not change.
    await expect(page({ kind: "x".repeat(A_NARROWING) })).resolves.toBeDefined();

    // AND THE `group` BESIDE IT (CNCORE-309), asked here rather than in a block
    // of its own because it is not a second rule: one ceiling, one object, two
    // lines. A test naming only `kind` passes over the parameter that was
    // unbounded on the line above it, which is how this one came to be found.
    await expect(page({ group: "x".repeat(A_NARROWING + 1) })).rejects.toThrow(
      "Input validation failed",
    );
    await expect(page({ group: "x".repeat(A_NARROWING) })).resolves.toBeDefined();
  });
});

describe.each(EVERY_LISTING)(
  "$procedure, on the Listing contract",
  ({ holds, page, filedByName }) => {
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

    it("reports that size past its end too, where no Row is left to carry it", async () => {
      // THE SIZE'S OTHER POSITION, AND UNTIL THIS IT WAS ASKED OF ONE LISTING IN
      // FIVE. `total` rides on the Rows, in the same statement and therefore in
      // the same snapshot -- so a page with NO Rows has nothing to ride on, and
      // the size is counted by a SECOND query instead. That second query is the
      // half no contract has ever read: the test above walks two pages that both
      // have Rows, so a count written twice could disagree in the position
      // neither of them reaches.
      //
      // A PAGE CAN BE EMPTY WITH A LISTING STILL BEHIND IT, which is the state
      // this reaches: the cursor names the LAST Row of the whole Listing, so
      // there is nothing past it and the Listing is as big as it ever was. An
      // owner arrives here by pressing Next on the last page, or by keeping the
      // link it gave them.
      const { total } = await page({ limit: 1 });

      const walked = await everyRowWalked(page, total);
      const theLastRow = walked.at(-1);
      if (theLastRow === undefined) throw new Error("a Listing of no Rows has no end to walk past");
      const beyond = await page({ limit: 1, after: theLastRow });

      expect(beyond.rows).toStrictEqual([]);
      expect(beyond.continuesAfter).toBeNull();
      expect(beyond.total).toBe(total);
    });

    it("steps back to the page the reader came from, from every page of the walk", async () => {
      // THE STEP BACK (CNCORE-174), ORACLED AGAINST THE WALK FORWARD rather than
      // against a second reading of the same thing: a different statement, read
      // the other way round, has to hand back each page the forward walk handed
      // out. Every page past the first is stepped back from, so a Listing's hard
      // shapes -- the tie, the keyless tail, the Rows tied on every key -- are
      // crossed backward wherever the walk crossed them forward.
      const { total } = await page({ limit: 1 });
      const forward = await everyPageWalked(page, total);
      const limit = aPageThatCuts(total);

      const back: string[][] = [];
      const offered: (string | null)[] = [];
      for (const [at, leaving] of forward.entries()) {
        if (at === 0) continue;
        const answer = await page({ limit, before: leaving[0] });
        back.push(answer.rows.map((row) => row.id));
        offered.push(answer.continuesBefore);
      }

      expect(forward.length).toBeGreaterThan(1);
      expect(back).toStrictEqual(forward.slice(0, -1));
      // AND EACH SAYS WHETHER THERE IS A STEP BACK FROM IT IN TURN: from every
      // page but the first, and from its own first Row.
      expect(offered).toStrictEqual(
        forward.slice(0, -1).map((rows, at) => (at === 0 ? null : rows[0])),
      );
    });

    it("says which Rows each page shows, walked to, stepped back to, and past the end", async () => {
      // WHERE THE READER IS (ADR-0133): how many Rows sort before the page, so
      // a surface can say "Rows 3,201 to 3,300 of 7,000". ORACLED AGAINST THE
      // WALK -- how many Rows the pages before this one handed out -- which is
      // not the count the Listing answers with, so the two agreeing is the
      // assertion. Every way a page is reached: from the start, walking on,
      // stepping back, and pressing Next on the last page.
      const { total } = await page({ limit: 1 });
      const forward = await everyPageWalked(page, total);
      const limit = aPageThatCuts(total);
      const handedOutBefore = forward.map((_, at) => forward.slice(0, at).flat().length);

      const walkedTo: number[] = [];
      const steppedBackTo: number[] = [];
      for (const [at, rows] of forward.entries()) {
        const after = forward[at - 1]?.at(-1);
        walkedTo.push((await page({ limit, after })).rowsBefore);
        if (at === 0) continue;
        steppedBackTo.push((await page({ limit, before: rows[0] })).rowsBefore);
      }
      const beyond = await page({ limit, after: forward.at(-1)?.at(-1) });

      expect(forward.length).toBeGreaterThan(1);
      expect(walkedTo).toStrictEqual(handedOutBefore);
      expect(steppedBackTo).toStrictEqual(handedOutBefore.slice(0, -1));
      // AN EMPTY PAGE PAST THE END HAS THE WHOLE LISTING BEFORE IT.
      expect(beyond.rows).toStrictEqual([]);
      expect(beyond.rowsBefore).toBe(total);
    });

    /*
     * NARROWED TO ONE KIND (CNCORE-175), asked of every Listing here because a
     * narrowing that reached two of them and not the third would be one control
     * meaning different things on three surfaces -- which is the argument
     * `withinTheGroup` already makes about a Group, applied to the other axis.
     *
     * WHAT THIS SEAM ASSERTS IS THE WIRING, and the read path's own tests hold
     * the narrowing itself (`catalogue.test.ts`). So the fixture is the one
     * fact every entry in the table above shares -- its Rows are Works -- and
     * the assertion is that a kind they ARE keeps them and a kind they are NOT
     * drops them. A procedure that dropped the parameter on the floor answers
     * both alike and fails.
     *
     * RELATIVE TO THE LISTING'S OWN ROWS RATHER THAN TO AN EXACT TOTAL, because
     * three of the six entries are unnarrowed and this suite's catalogue is
     * shared: how many Time spans some other file has seeded is not a number
     * this test may pin.
     */
    it("narrows to one kind, and the size follows what it narrowed to", async () => {
      const everyKind = await page({ limit: A_PAGE });
      const asWorks = await page({ limit: A_PAGE, kind: "work" });
      const asTimeSpans = await page({ limit: A_PAGE, kind: "time_span" });

      expect(asWorks.total).toBeGreaterThanOrEqual(ofItsOwn.length);
      expect(asWorks.total).toBeLessThanOrEqual(everyKind.total);
      // THE SIZE FOLLOWS, which is story 26: a narrowed page that reported the
      // unnarrowed total would be reporting a total it is not showing from.
      expect(asTimeSpans.total).toBeLessThan(everyKind.total);
      expect(asTimeSpans.rows.map((row) => row.id)).toEqual(expect.not.arrayContaining(ofItsOwn));
    });

    /*
     * THE ORDER A READER CHOSE (CNCORE-175), on the two Listings that take one.
     * Catalogue search's order is a ranking on what the reader typed
     * (ADR-0120), so it is not offered one and does not appear here.
     *
     * THE WALK IS THE ASSERTION, not the first page: a second order reopens the
     * seam every defect in ADR-0119 came through -- the sort and the cursor
     * comparison naming different terms -- and a first page agrees with any
     * comparison at all. Reaching exactly `total` DISTINCT Rows is the two
     * halves agreeing, which is the oracle the walk above already uses.
     */
    it.runIf(filedByName)(
      "walks the whole Listing in the order a reader chose, skipping and repeating nothing",
      async () => {
        const inTheChosenOrder: AListing["page"] = (input) => page({ ...input, order: "added" });
        const { total } = await inTheChosenOrder({ limit: 1 });

        const walked = await everyRowWalked(inTheChosenOrder, total);

        expect(walked).toHaveLength(total);
        expect(new Set(walked).size).toBe(total);
        expect(walked).toEqual(expect.arrayContaining(ofItsOwn));
      },
    );

    it.runIf(filedByName)("lands a jump to a letter at the first Row filed under it", async () => {
      // THE JUMP (CNCORE-174) IS A SEEK INTO THE SAME ORDER, not a filter over
      // it: the page it lands on is a run of the walk, from some Row onward.
      // Where that Row falls is bracketed by the Rows this Listing was given --
      // the one filed under an earlier letter behind it, the run filed under
      // this one at or past it.
      //
      // BRACKETED RATHER THAN PINNED, where the Listing is the whole catalogue:
      // what else is filed under W there is whatever other files left, so the
      // exact Row a jump lands on is not this test's to know. A Group holds only
      // what was put in it, so narrowed the bracket closes to one Row. The exact
      // landing over Rows opening in a mark or in lower case is asserted at the
      // package export, where the fixture is the test's own.
      const { total } = await page({ limit: 1 });
      const walked = (await everyPageWalked(page, total)).flat();
      const limit = aPageThatCuts(total);

      const jumped = await page({ limit, letter: THE_RUNS_LETTER });
      const landed = walked.indexOf(jumped.rows[0]?.id ?? "");

      expect(landed).toBeGreaterThan(-1);
      expect(jumped.rows.map((row) => row.id)).toStrictEqual(walked.slice(landed, landed + limit));
      const [elsewhere, ...filedUnderIt] = [ofItsOwn.at(-1), ...ofItsOwn.slice(0, -1)];
      expect(walked.indexOf(elsewhere ?? "")).toBeLessThan(landed);
      for (const id of filedUnderIt) expect(walked.indexOf(id)).toBeGreaterThanOrEqual(landed);
      expect(jumped.continuesBefore).toBe(jumped.rows[0]?.id);
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

      expect(Object.keys(row).sort()).toStrictEqual([
        "holds",
        "id",
        "isContainer",
        "kind",
        "sitsIn",
        "title",
      ]);
    });
  },
);
