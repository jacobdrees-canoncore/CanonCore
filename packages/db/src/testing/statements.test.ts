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

  it("refuses to answer for work that left a connection open", async () => {
    // THE CONTRACT, ASSERTED RATHER THAN DOCUMENTED. A window that ends with a
    // pool still holding connections is one whose statistics are still pending,
    // and the honest answer is a refusal rather than the partial count that
    // would otherwise come back.
    const db = createDb(databaseUrl, { maxConnections: 1 });
    try {
      await expect(
        statementsWhile(databaseUrl, async () => {
          await db.execute(sql`select 1`);
        }),
      ).rejects.toThrow(/still connected/);
    } finally {
      await db.$client.end();
    }
    // LONGER THAN THE INSTRUMENT'S OWN DEADLINE, because what this asserts is
    // that deadline being reached. Vitest's five seconds would time out first
    // and report the test rather than the refusal.
  }, 20_000);
});
