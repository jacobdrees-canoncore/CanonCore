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

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { beforeAll, describe, expect, it } from "vitest";

import { type CorpusCensus, readCorpusCensus } from "../src/corpus-census";
import type { AppRouterClient } from "../src/routers";

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
  /** 30,896 slots across them, against CNCORE-159's 29,844 counted two days earlier. */
  slots: 30_000,
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
  storiesPlaced: 7_400,
  /**
   * AND THE SECOND: the most Orderings any one Item sits in is 48 --
   * `Endgame (POT comic story)`. An earlier draft of CNCORE-159 said
   * thirty-six and nothing measured it; ADR-0119 says twice that nothing counts
   * an Item's placements. CNCORE-184 cannot choose where a Row's membership
   * list truncates without this number.
   */
  mostOrderings: 45,
};

let census: CorpusCensus;

/*
 * THE WHOLE SUITE SKIPS WHEN NO INSTALL WAS NAMED, rather than each test
 * deciding for itself -- so the reason is printed once and the run says
 * "skipped" rather than "passed", which a suite that quietly asserted nothing
 * would not.
 */
const asked = AT !== undefined;

describe.skipIf(!asked)("the Doctor Who corpus stands in the Owner's own install", () => {
  beforeAll(async () => {
    const client = createORPCClient<AppRouterClient>(new RPCLink({ url: `${AT}/api/rpc` }));
    census = await readCorpusCensus(client, {
      onOrderingsFound: ({ orderings, items }) =>
        console.log(`  ${items} Items in the catalogue, ${orderings} of them Orderings`),
      onOrderingWalked: ({ title, slots, remaining }) => {
        // EVERY HUNDREDTH, because 465 lines of progress is not progress.
        if (remaining % 100 === 0) console.log(`  ${remaining} to walk -- ${title}: ${slots}`);
      },
    });
    console.log(`  census: ${JSON.stringify({ ...census, largest: census.largest.slice(0, 3) })}`);
  });

  it("holds the wiki's whole timeline corpus, not a sample of it", () => {
    expect(census.items).toBeGreaterThanOrEqual(MEASURED.items);
    expect(census.orderings).toBeGreaterThanOrEqual(MEASURED.orderings);
    expect(census.slots).toBeGreaterThanOrEqual(MEASURED.slots);
  });

  /**
   * THE ORDERING THAT COULD NOT BE IMPORTED AT ALL UNTIL CNCORE-151, and the
   * one a page cap would truncate without saying so. A floor of "more than
   * none" would pass on a hundred of its 2,913.
   */
  it("holds the largest Ordering on the wiki WHOLE", () => {
    const [largest] = census.largest;
    expect(largest?.slots).toBeGreaterThanOrEqual(MEASURED.largestOrdering);
  });

  /**
   * THE TWO FIGURES THIS TICKET EXISTS TO TAKE, now that they have been taken.
   *
   * MULTI-PLACEMENT IS THE PRODUCT'S ENTIRE ARGUMENT and this is the first time
   * anything has checked it at the size it was designed for: one Item sits in
   * 48 of these 465 Orderings.
   *
   * AND THE ACCOUNTING IS EXACT, which is the assertion that makes
   * `storiesPlaced` mean what its name says. 465 + 7,587 = 8,052, so every
   * Item in the catalogue is either an Ordering or a story inside one: nothing
   * is loose, and no Ordering sits inside another. Were a `Theory:Timeline`
   * page ever to link another one, that Container would be counted on both
   * sides and this sum would exceed the catalogue.
   */
  it("holds the two figures CNCORE-167 was written to take", () => {
    expect(census.storiesPlaced).toBeGreaterThanOrEqual(MEASURED.storiesPlaced);
    expect(census.mostPlaced?.orderings).toBeGreaterThanOrEqual(MEASURED.mostOrderings);
    expect(census.orderings + census.storiesPlaced).toBe(census.items);
  });
});
