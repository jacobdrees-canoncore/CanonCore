/**
 * THE DOCTOR WHO CORPUS, STANDING IN AN INSTALL THAT PERSISTS (CNCORE-167).
 *
 * THIS IS THE SENTENCE THREE PROJECTS CLAIMED AND NONE OF THEM DELIVERED.
 * CNCORE-96 said "the Owner points CanonCore at their own wiki Provider,
 * browses a timeline, and gets a real catalogue", and tickets 98 to 103 all
 * read Done -- but the import landed in `buildTestDatabase("web")`, which the
 * next run drops, so no catalogue persisted anywhere and the Owner never had
 * one (ADR-0132). What is asserted below is a catalogue in a named volume, on
 * an install brought up with `docker compose up -d`, that survives the stack
 * being restarted and the directory being renamed.
 *
 * IT ASSERTS RATHER THAN PRINTS, which is the rule `live-import.test.ts` set
 * and the reason is the same: a script that prints what landed proves nothing
 * the day it stops landing. The figures below are floors, so a future run says
 * which one broke.
 *
 * LOCAL ONLY, AND IN A PROJECT OF ITS OWN. Filling the install needs the
 * Owner's wiki Credential, which no CI job may hold (ADR-0122) and which
 * expires within a day; `vitest.corpus.config.ts` says why that separation is
 * the point rather than an inconvenience.
 *
 *   CANONCORE_AT=http://localhost:3000 pnpm test:corpus
 *
 * NO PASSWORD, AND THAT IS ADR-0044 SHOWING THROUGH. Every procedure this
 * census calls is open, because reading a catalogue needs no session and only
 * writing does -- so this suite proves what a VISITOR to the Owner's instance
 * can see, not what the Owner alone can.
 */

import { type CorpusCensus, readCorpusCensus } from "@canoncore/api/corpus-census";
import type { AppRouterClient } from "@canoncore/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * WHICH INSTALL, AND THERE IS NO DEFAULT.
 *
 * REQUIRED, FOR THE REASON `live-import.test.ts` LEARNED ABOUT `PROVIDER_WIKI_REPO`:
 * machine state is not repo state, and an address that exists on one Mac is not
 * a value this repository knows. `http://localhost:3000` looks like a safe
 * default and is not -- it is also where a contributor's throwaway stack
 * answers, so a default would quietly assert the corpus against whatever
 * happened to be on that port.
 *
 * UNSET IS A SKIP RATHER THAN A FAILURE, and that is CNCORE-167's own
 * criterion: nothing here reddens when the Credential is absent. An unset
 * address means nobody asked this suite to check an install, which is different
 * from asking and being told no -- and the difference is worth keeping, because
 * the second is a defect and the first is a Tuesday.
 *
 * IT MUST BE A LOOPBACK ADDRESS, because this suite keeps the network gate and
 * that gate admits `127.0.0.0/8`, `localhost` and `[::1]` and nothing else. An
 * install elsewhere on the network is REFUSED here rather than measured;
 * `vitest.corpus.config.ts` says why that limit is the right one to have today
 * and what would have to be decided to lift it.
 */
const AT = process.env.CANONCORE_AT?.replace(/\/$/, "");

/**
 * AND THE LOOPBACK CLAIM IS CHECKED HERE RATHER THAN ONLY STATED.
 *
 * The gate in `vitest.corpus.config.ts` is what ENFORCES it, by refusing the
 * socket. This refuses the ADDRESS, and the difference matters: review pointed
 * out that both docblocks assert "it must be a loopback address" while nothing
 * in this file could tell. Drop the `setupFiles` line by accident and the gate
 * goes with it, leaving a census that would quietly walk any host it was
 * pointed at. This says so in the one place a reader is looking.
 */
function refuseAnythingButLoopback(url: string): void {
  const host = new URL(url).hostname;
  if (!/^(127\.\d+\.\d+\.\d+|localhost|\[?::1\]?)$/.test(host)) {
    throw new Error(
      `CANONCORE_AT is ${url}, whose host is ${host}. This suite keeps the network gate, ` +
        "which admits 127.0.0.0/8, localhost and [::1] and nothing else, so an install " +
        "elsewhere on the network cannot be measured from here. vitest.corpus.config.ts " +
        "says what would have to be decided to lift that.",
    );
  }
}

/**
 * WHAT THE WIKI HELD WHEN THE CORPUS WAS TAKEN, measured 2026-09-15 against the
 * live wiki through the install's own API -- and every one is a FLOOR set a
 * little under what was measured.
 *
 * FLOORS RATHER THAN EXACT COUNTS, which is `live-import.test.ts`'s rule and
 * its reason: these are figures about a LIVE wiki that editors edit, so an
 * exact count reddens on the next edit while a floor still catches a
 * truncation. What a floor cannot catch is the corpus GROWING, and nothing
 * needs it to.
 */
const MEASURED = {
  /** 8,052 Items: the 465 Orderings and the 7,587 stories they hold between them. */
  items: 7_800,
  /** 465 `Theory:Timeline` pages, every one of which landed. */
  orderings: 450,
  /**
   * 30,896 Placements across them, against the 29,844 "slots" CNCORE-159
   * counted two days earlier -- and the two are NOT established to be counting
   * the same thing, so the difference is not evidence of anything. 701 of ours
   * carry no Position (CONTEXT.md's Unplaced) and whether that spec's partition
   * included its own is not recorded.
   */
  placements: 30_000,
  /**
   * AHistory, the largest the wiki holds, landed at 2,907 against the 2,913
   * members CNCORE-159 counted on 2026-09-13 -- six pages of editing in two
   * days. It is here because it is the Ordering a single page cap could
   * silently truncate.
   */
  largestOrdering: 2_750,
  /**
   * THE FIRST OF THE TWO FIGURES CNCORE-167 WAS WRITTEN TO TAKE: 7,587 distinct
   * Items sit in an Ordering. CNCORE-159 guessed "about seven thousand" and
   * said plainly that nothing computed it.
   */
  itemsPlaced: 7_400,
  /**
   * AND THE SECOND: the most Orderings any one Item sits in is 48 --
   * `Endgame (POT comic story)`. An earlier draft of CNCORE-159 said
   * thirty-six and nothing measured it; ADR-0119 says twice that nothing counts
   * an Item's placements. CNCORE-184 cannot choose where a Row's membership
   * list truncates without this number.
   */
  mostOrderings: 45,
  /**
   * THE FIRST ENTITY KIND, CNCORE-367's WALKING SKELETON: 595 Time spans, the
   * pages carrying `Infobox Event or Conflict` (555 of its 560, five being
   * under the wiki's out-of-universe branch) or `Infobox Event or Exhibition`
   * (40), counted from the live wiki on 2026-09-26 into a DEVELOPMENT install
   * and read back through the kind filter (ADR-0137). The Owner's install
   * holds them once it is rebuilt; until then this reddens there, which is the
   * rebuild being owed rather than the suite being wrong. 580 is the floor
   * convention above: a little under, so an edit to the wiki does not redden it.
   */
  timeSpans: 580,
};

let census: CorpusCensus;
let client: AppRouterClient;

/*
 * THE WHOLE SUITE SKIPS WHEN NO INSTALL WAS NAMED, rather than each test
 * deciding for itself -- so the reason is printed once and the run says
 * "skipped" rather than "passed", which a suite that quietly asserted nothing
 * would not.
 */
const asked = AT !== undefined;

describe.skipIf(!asked)("the Doctor Who corpus stands in the Owner's own install", () => {
  beforeAll(async () => {
    // AT is defined here: the describe is skipped otherwise.
    refuseAnythingButLoopback(AT as string);
    client = createORPCClient<AppRouterClient>(new RPCLink({ url: `${AT}/api/rpc` }));
    census = await readCorpusCensus(client, {
      onOrderingsFound: ({ orderings, items }) =>
        console.log(`  ${items} Items in the catalogue, ${orderings} of them Orderings`),
      onOrderingWalked: ({ title, placements, remaining }) => {
        // EVERY HUNDREDTH, because 465 lines of progress is not progress.
        if (remaining % 100 === 0) console.log(`  ${remaining} to walk -- ${title}: ${placements}`);
      },
    });
    console.log(`  census: ${JSON.stringify({ ...census, largest: census.largest.slice(0, 3) })}`);
  });

  it("holds the wiki's whole timeline corpus, not a sample of it", () => {
    expect(census.items).toBeGreaterThanOrEqual(MEASURED.items);
    expect(census.orderings).toBeGreaterThanOrEqual(MEASURED.orderings);
    expect(census.placements).toBeGreaterThanOrEqual(MEASURED.placements);
  });

  /**
   * THE ORDERING THAT COULD NOT BE IMPORTED AT ALL UNTIL CNCORE-151, and the
   * one a page cap would truncate without saying so. A floor of "more than
   * none" would pass on a hundred of its 2,913.
   */
  it("holds the largest Ordering on the wiki WHOLE", () => {
    const [largest] = census.largest;
    expect(largest?.placements).toBeGreaterThanOrEqual(MEASURED.largestOrdering);
  });

  /**
   * THE TWO FIGURES THIS TICKET EXISTS TO TAKE, now that they have been taken.
   *
   * MULTI-PLACEMENT IS THE PRODUCT'S ENTIRE ARGUMENT and this is the first time
   * anything has checked it at the size it was designed for: one Item sits in
   * 48 of these 465 Orderings.
   *
   * AND NOTHING PLACED IS ITSELF AN ORDERING, which is what makes `itemsPlaced`
   * readable as a count of STORIES -- the question the ticket actually asks.
   *
   * IT IS ASKED DIRECTLY, AND THAT IS A CORRECTION REVIEW FORCED. This was
   * `orderings + itemsPlaced === items`, which proves nothing on its own: one
   * nested Ordering and one Item in no Ordering cancel exactly. It was also an
   * EXACT equality in a file whose own rule is floors, so the Owner adding a
   * single unplaced Item by hand -- a Group, a Person -- would have reddened it.
   */
  it("holds the two figures CNCORE-167 was written to take", () => {
    expect(census.itemsPlaced).toBeGreaterThanOrEqual(MEASURED.itemsPlaced);
    expect(census.mostPlaced?.orderings).toBeGreaterThanOrEqual(MEASURED.mostOrderings);
    expect(census.orderingsPlaced).toBe(0);
  });

  /*
   * THROUGH THE KIND FILTER A READER USES, rather than a count of rows: the
   * claim is that a reader narrowing to Time span finds them, and the filter's
   * own `total` is the number it shows them (CNCORE-367).
   */
  it("holds the Time spans the wiki types, found by narrowing to their kind", async () => {
    const narrowed = await client.catalogue.list({ kind: "time_span", limit: 1 });
    expect(narrowed.total).toBeGreaterThanOrEqual(MEASURED.timeSpans);
    expect(narrowed.rows[0]?.kind).toBe("Time span");
  });
});
