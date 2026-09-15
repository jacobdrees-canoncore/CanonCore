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
  /** 465 `Theory:Timeline` pages, counted by `provider-wiki`'s own parser (CNCORE-159). */
  orderings: 460,
  /** 29,844 slots across them (CNCORE-159). */
  slots: 29_000,
  /**
   * AHistory, the largest the wiki holds: 2,913 members at 2,669 distinct
   * Positions with 454 Repeats, measured 2026-09-13. It is here because it is
   * the Ordering a single page cap could silently truncate.
   */
  largestOrdering: 2_500,
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
   * MULTI-PLACEMENT IS THE PRODUCT'S ENTIRE ARGUMENT, and this is the first
   * time anything has been able to check it at the size it was designed for.
   * Across the whole wiki 96.8% of stories sit in more than one category
   * (CNCORE-159); an Ordering is a narrower thing than a category, so this
   * asserts only that the shape is real and records the figure it found.
   */
  it("holds Items sitting in several Orderings at once", () => {
    expect(census.mostPlaced).not.toBeNull();
    expect(census.mostPlaced?.orderings).toBeGreaterThan(1);
  });
});
