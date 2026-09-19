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
 * ONE SERVER PER WINDOW, STARTED BEFORE IT AND STOPPED INSIDE IT -- and a
 * figure is at least two windows, because `statementsWhile` answers only with a
 * figure it counted twice (CNCORE-218), so it is at least two servers.
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
   *
   * SO THE SERVER IS STARTED THROUGH `preparing`, which `statementsWhile` runs
   * before each window's wait for an empty database and never counts. Whichever
   * one is still running when this returns or throws is stopped here, since a
   * leaked `next start` is a CI job that never ends.
   */
  let running: Awaited<ReturnType<typeof aServerOnTheCountedCatalogue>> | undefined;
  try {
    return await statementsWhile(
      databaseUrl,
      async (server) => {
        await asking(server.baseUrl);
        server.close();
        running = undefined;
      },
      async () => {
        running = await aServerOnTheCountedCatalogue();
        return running;
      },
    );
  } finally {
    running?.close();
  }
}

/**
 * LONGER THAN VITEST'S FIVE SECONDS, BECAUSE A WINDOW STARTS A SERVER AND THEN
 * WAITS FOR ITS POOL TO LET GO. node-postgres holds an idle client for ten
 * seconds, and that wait is what keeps the server's own startup out of the
 * count. A figure is two windows, or three when autovacuum lands in one, so a
 * test's two figures are four to six of those: well past the default, and
 * inside this with room.
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

/**
 * WHAT A LISTING COSTS, WHICH IS THE OTHER HALF OF ADR-0140 (CNCORE-183).
 *
 * IN THIS FILE RATHER THAN A NEW ONE, because the whole instrument is here: the
 * counted database, the server started before the window and stopped inside it,
 * and the timeout that lets a pool go. A second file would have copied all
 * three to ask one question, and the thing being measured is the same thing --
 * how many times a page goes to the database.
 *
 * AND THE COUNTED CATALOGUE ALREADY HAS THE SHAPE IT NEEDS: three Items, TWO of
 * them Containers, which is what makes the two pages below differ in how many
 * Rows carry a figure at all.
 */
describe("what a Listing costs", () => {
  it(
    "costs the same over one Row as over every Row, so the figure is not a read per Row",
    async () => {
      /*
       * THE ACCEPTANCE CRITERION THAT NOTHING ELSE CAN SEE: "the figure comes
       * from the same read as the Row rather than a second one". Every other
       * test of it reads the NUMBER, and the number is identical either way --
       * a `findPlacementsInContainer` per Row answers exactly what the subquery
       * answers. What separates them is only ever the cost.
       *
       * THE ORACLE IS ONE PAGE AGAINST ANOTHER rather than a statement count
       * written down here, which is the shape the measurements above already
       * use: what a Listing costs moves as its read path changes, and no figure
       * in this file should have to be re-measured when it does. WHAT CANNOT
       * MOVE is that the cost is flat in the number of Rows -- a read per Row
       * makes the wide page dearer than the narrow one by however many
       * Containers it listed, and a subquery in the Listing's own statement
       * cannot.
       *
       * THE WIDE PAGE IS ASSERTED TO HOLD MORE CONTAINERS THAN THE NARROW ONE,
       * INSIDE THE WINDOW. Without it this passes on a catalogue whose Rows are
       * all stories -- there would be no second read to make even if the code
       * took one -- which is a green that means nothing.
       */
      const listing = (baseUrl: string, limit: number) => {
        const rpc: AppRouterClient = createORPCClient(new RPCLink({ url: `${baseUrl}/api/rpc` }));
        return rpc.catalogue.list({ limit });
      };

      let narrow = 0;
      let wide = 0;
      const overOneRow = await costOf(async (baseUrl) => {
        narrow = (await listing(baseUrl, 1)).rows.filter((row) => row.isContainer).length;
      });
      const overEveryRow = await costOf(async (baseUrl) => {
        wide = (await listing(baseUrl, 100)).rows.filter((row) => row.isContainer).length;
      });

      expect(wide).toBeGreaterThan(narrow);
      expect(overEveryRow).toBe(overOneRow);
    },
    LONG_ENOUGH_TO_SERVE_AND_STOP_MS,
  );
});
