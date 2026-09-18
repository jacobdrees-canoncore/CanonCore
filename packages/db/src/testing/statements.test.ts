import { sql } from "drizzle-orm";
import { describe, expect, inject, it } from "vitest";

import { createDb } from "../index";
import { statementsWhile } from "./statements";

/**
 * THE INSTRUMENT'S OWN CALIBRATION, because everything CNCORE-176 asserts rests
 * on it and none of the arithmetic is obvious.
 *
 * What `statementsWhile` reads is not a count of statements. It is
 * `xact_commit + xact_rollback`, which is the statements PLUS one per session,
 * published on a schedule the counter does not control -- and both of those are
 * compensated for. A compensation nobody checks is a figure that drifts
 * silently, which is the exact failure the instrument exists to catch, one level
 * down.
 *
 * SO THE EXPECTED VALUES HERE ARE ISSUED RATHER THAN DERIVED. Each test runs a
 * number of statements it chose and expects that number back; nothing here
 * recomputes `statements.ts`'s arithmetic. THE POOL SIZE IS WHAT THESE VARY,
 * because that is the term the naive reading gets wrong: the same six
 * statements are worth seven transactions over one connection and ten over
 * four.
 *
 * EVERY POOL IS OPENED AND CLOSED INSIDE THE WINDOW, which is the instrument's
 * stated contract and is also what makes the count true at all.
 */
const databaseUrl = inject("databaseUrl");

describe("statementsWhile", () => {
  it("counts nothing for a window in which nothing asked anything", async () => {
    expect(await statementsWhile(databaseUrl, async () => {})).toBe(0);
  });

  it("counts nothing for connecting, which is not asking", async () => {
    const counted = await statementsWhile(databaseUrl, async () => {
      const db = createDb(databaseUrl, { maxConnections: 4 });
      await db.$client.connect().then((client) => client.release());
      await db.$client.end();
    });

    expect(counted).toBe(0);
  });

  it("counts the statements a caller makes, not the connection they arrive on", async () => {
    // ONE CONNECTION, SIX STATEMENTS. The naive reading of the counter answers
    // seven here, and did.
    const counted = await statementsWhile(databaseUrl, async () => {
      const db = createDb(databaseUrl, { maxConnections: 1 });
      for (let i = 0; i < 6; i++) await db.execute(sql`select 1`);
      await db.$client.end();
    });

    expect(counted).toBe(6);
  });

  it("counts the same statements however many connections they arrive over", async () => {
    // FOUR CONNECTIONS, THE SAME SIX STATEMENTS, which is the shape a real
    // handler has: `item.get` asks four questions at once. The naive reading
    // answers ten.
    const counted = await statementsWhile(databaseUrl, async () => {
      const db = createDb(databaseUrl, { maxConnections: 4 });
      await Promise.all(Array.from({ length: 6 }, () => db.execute(sql`select 1`)));
      await db.$client.end();
    });

    expect(counted).toBe(6);
  });

  it("waits out a pool that has not let go, which is what a server's boot relies on", async () => {
    /*
     * THE SHAPE THE PAGE SEAM RESTS ON, asserted here because that is where the
     * instrument's own contract lives.
     *
     * `item-page-cost.test.ts` STARTS its server before opening the window, so
     * that the scheduler's boot write and the harness's readiness probes land on
     * the far side of the first reading. What makes that work is this: the
     * window does not open until the database is empty, and a node-postgres pool
     * lets an idle client go after ten seconds -- so a connection still held
     * when `statementsWhile` is called is waited out rather than counted.
     *
     * IT USED TO ASSERT A REFUSAL, and that was wrong about its own subject: the
     * deadline is thirty seconds now, which outlasts the ten a pool takes to let
     * go, so work that "left a connection open" is tolerated rather than
     * refused. The refusal is still there for a database something else is
     * genuinely sitting on, and is not asserted -- it would cost thirty seconds
     * to check an error message.
     */
    const holding = createDb(databaseUrl, { maxConnections: 1 });
    await holding.execute(sql`select 1`);

    try {
      const counted = await statementsWhile(databaseUrl, async () => {
        const inside = createDb(databaseUrl, { maxConnections: 1 });
        await inside.execute(sql`select 1`);
        await inside.$client.end();
      });

      // ONE: the statement inside the window. The one before it is on the other
      // side of the first reading, which is the whole point.
      expect(counted).toBe(1);
    } finally {
      await holding.$client.end();
    }
    // LONGER THAN THE POOL'S IDLE TIMEOUT, which this test waits out on purpose.
  }, 45_000);
});
