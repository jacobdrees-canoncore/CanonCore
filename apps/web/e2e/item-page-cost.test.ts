import type { AppRouterClient } from "@canoncore/api/routers";
import { createDb, retitleItemByHand } from "@canoncore/db";
import { statementsWhile } from "@canoncore/db/testing/statements";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { describe, expect, inject, it } from "vitest";

import { documentFrom } from "./document";
import { theBuildServing } from "./instance";

/**
 * WHAT AN ITEM PAGE COSTS THE DATABASE, at the fourth seam (ADR-0103) because
 * that is the only seam it is visible from.
 *
 * The page read its Item TWICE -- `generateMetadata` and the page each called
 * `item.get` -- and no test in the repository could see it. Everything else here
 * reads served markup, and the markup is identical either way: the second read
 * answers exactly what the first one did. So the page was correct and cost
 * double, which is the shape of defect that comes back unless something counts.
 */
const databaseUrl = inject("countedDatabaseUrl");
const { item, holdsAt, appearsAt } = inject("counted");

/**
 * A SERVER ON THE COUNTED CATALOGUE, which two things here need and neither owns:
 * the measurements below, which must stop one inside the window, and the
 * per-request check, which needs one that answers twice.
 */
function aServerOnTheCountedCatalogue() {
  return theBuildServing({ ...process.env, DATABASE_URL: databaseUrl, OWNER_PASSWORD: "" });
}

/**
 * ONE SERVER PER MEASUREMENT, STARTED AND STOPPED INSIDE IT.
 *
 * THE STOP IS NOT TIDINESS, IT IS THE READING. A PostgreSQL backend accumulates
 * what it did and publishes it on exit, so a count taken while the server still
 * holds its pool is a count of whatever happened to have been flushed --
 * `statements.ts` carries the measurement of how wrong that is. Ending the
 * server is what ends its backends, and `statementsWhile` refuses to answer
 * until they are gone.
 *
 * WHICH IS ALSO WHY THE INSTANCE IS A DATABASE RATHER THAN ONE OF
 * `global-setup.ts`'S SERVERS. A server standing for the whole run could never
 * be stopped inside a window.
 *
 * NO PASSWORD, so this is a visitor's page. Everything it renders is open
 * (ADR-0044), and the owner's one extra read -- the note (ADR-0096) -- would be
 * a second question on a page this file is asking about the first.
 */
async function costOf(asking: (baseUrl: string) => Promise<unknown>): Promise<number> {
  /*
   * THE SERVER IS STARTED BEFORE THE WINDOW AND STOPPED INSIDE IT, and both
   * halves of that are load-bearing.
   *
   * STOPPED INSIDE, because a PostgreSQL backend accumulates what it did and
   * publishes it on exit: a count taken while the server still holds its pool is
   * a count of whatever happened to have been flushed. `statements.ts` carries
   * the measurement of how wrong that is.
   *
   * STARTED BEFORE, because a server start is NOT a constant. It brings the
   * scheduler's own write (`instrumentation.ts`, ADR-0049) and however many
   * times `waitUntilAnswering` probed the front page before it answered -- and
   * that second number varies with how fast the machine was. Measured inside the
   * window it was a per-measurement offset masquerading as a constant, and it
   * put a ONE-statement difference between two measurements of the same page.
   * `statementsWhile` opens its window on an empty database, so starting the
   * server first puts all of it on the far side of the first reading: what is
   * counted is the request and nothing else.
   */
  const server = await aServerOnTheCountedCatalogue();
  let stopped = false;
  try {
    return await statementsWhile(databaseUrl, async () => {
      await asking(server.baseUrl);
      server.close();
      stopped = true;
    });
  } finally {
    if (!stopped) server.close();
  }
}

/**
 * LONGER THAN VITEST'S FIVE SECONDS, BECAUSE A MEASUREMENT STARTS A SERVER AND
 * THEN WAITS FOR ITS POOL TO LET GO. node-postgres holds an idle client for ten
 * seconds, and that wait is what keeps the server's own startup out of the
 * count. Two measurements is two of those, which is well past the default and
 * nowhere near the hook timeout this config already sets for a build.
 */
const LONG_ENOUGH_TO_SERVE_AND_STOP_MS = 120_000;

describe("what /items/<id> costs", () => {
  it(
    "reads the Item once, so the page costs what one read costs",
    async () => {
      /*
       * THE COMPARISON IS AGAINST THE READ PATH ITSELF rather than a number
       * written here, which is what keeps this from becoming a figure somebody
       * has to come back and edit. `item.get` gets cheaper or dearer as the
       * catalogue's read path changes -- a listing gains a count, a lateral folds
       * into its query -- and every one of those moves BOTH sides. What cannot
       * move is the multiple: a page that reads its Item twice costs twice what
       * one read costs, whatever one read happens to cost that week.
       *
       * THE RPC MOUNT IS THE SAME PROCEDURE WITH NO PAGE AROUND IT. A route
       * handler carries no layout, and neither request sends a cookie, so
       * neither reads a session and the two are comparable.
       */
      const perRead = await costOf(async (baseUrl) => {
        const rpc: AppRouterClient = createORPCClient(new RPCLink({ url: `${baseUrl}/api/rpc` }));
        await rpc.item.get({ id: item });
      });
      const perPage = await costOf(async (baseUrl) => {
        const { status } = await documentFrom(baseUrl, `/items/${item}`);
        // ASSERTED INSIDE THE MEASUREMENT, because a 404 is cheap and would
        // otherwise read as a page that had become wonderfully efficient.
        expect(status).toBe(200);
      });

      expect(perPage).toBe(perRead);
    },
    LONG_ENOUGH_TO_SERVE_AND_STOP_MS,
  );

  it(
    "reads it once at a NARROWED address too, which is the half a bare URL cannot show",
    async () => {
      /*
       * THE BARE ADDRESS IS THE EASY HALF AND WOULD PASS ON ITS OWN. The read is
       * keyed on the narrowing and both cursors as well as on the item, so a
       * `generateMetadata` that stopped reading the query -- or read two of the
       * three -- would go on costing ONE read at `/items/<id>` and TWO at every
       * address carrying a parameter. The test above cannot tell those apart;
       * this one is what makes `theAddressAsks` asserted rather than merely
       * present.
       *
       * ALL THREE AT ONCE, because a key is only as shared as its least-shared
       * term.
       */
      const asked = { id: item, placed: "owner", after: holdsAt, placedAfter: appearsAt };
      const perRead = await costOf(async (baseUrl) => {
        const rpc: AppRouterClient = createORPCClient(new RPCLink({ url: `${baseUrl}/api/rpc` }));
        await rpc.item.get(asked);
      });
      const perPage = await costOf(async (baseUrl) => {
        const { status } = await documentFrom(
          baseUrl,
          `/items/${item}?placed=${asked.placed}&after=${asked.after}&placedAfter=${asked.placedAfter}`,
        );
        expect(status).toBe(200);
      });

      expect(perPage).toBe(perRead);
    },
    LONG_ENOUGH_TO_SERVE_AND_STOP_MS,
  );

  it(
    "reads it again for the next reader, because the memo is one render wide",
    async () => {
      /*
       * ADR-0117, AND THE HALF OF CNCORE-176 THAT COULD HAVE GONE WRONG. What
       * makes the page cost one read is React's `cache`, and the word invites
       * exactly the defect that record exists to prevent: a page that answers
       * from something it kept. Next's own glossary scopes the memo to "a render
       * pass (request)", and this is that scope asserted rather than trusted.
       *
       * ONE SERVER ANSWERING TWICE, WITH A WRITE BETWEEN, which ADR-0117 records
       * as the STRONGER of its two shapes: two instances differing prove the
       * HTML is not frozen at build time, where one instance changing its own
       * answer proves that AND that the read reaches the database on every
       * request.
       *
       * THE TITLE IS WHAT MOVES, because it is the one field both halves of this
       * render read -- `generateMetadata` puts it in `<title>` and the page puts
       * it in the heading. A memo that outlived the request would strand them
       * together, so asserting both is asserting the whole of what was shared.
       */
      const server = await aServerOnTheCountedCatalogue();
      const db = createDb(databaseUrl, { maxConnections: 1 });
      try {
        /*
         * THE NEW TITLE IS UNIQUE TO THIS RUN rather than a literal, so nothing
         * here depends on what the fixture seeded or on this being the first
         * time the file has run against this database. A retitle is not undone.
         */
        const renamed = `The item read a second time ${crypto.randomUUID()}`;
        const before = await documentFrom(server.baseUrl, `/items/${item}`);
        expect(before.text).not.toContain(renamed);

        await retitleItemByHand(db, { itemId: item, title: renamed });

        const after = await documentFrom(server.baseUrl, `/items/${item}`);
        // BOTH HALVES OF THE SHARED READ. `generateMetadata` puts the title in
        // `<title>` and the page puts it in the heading, so a memo that outlived
        // the request would strand them together -- and asserting only one would
        // miss a memo that had stranded the other.
        expect(after.text).toContain(`>${renamed}</h1>`);
        expect(after.text).toContain(`<title>${renamed}</title>`);
      } finally {
        await db.$client.end();
        server.close();
      }
    },
    LONG_ENOUGH_TO_SERVE_AND_STOP_MS,
  );
});
