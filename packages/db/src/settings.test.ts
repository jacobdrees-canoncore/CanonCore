import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { type Database, readProviderSettings, type Writer, writeProviderSettings } from "./index";
import { settings } from "./schema";
import { connect, theOwner } from "./testing/catalogue";

let db: Database;

beforeAll(async () => {
  db = await connect();
});

/**
 * THE ONE ROW EVERY TEST IN THIS FILE SHARES, taken away rather than assumed
 * absent.
 *
 * There is exactly one settings row on an instance, so every test here writes
 * the same row and a test that merely RAN FIRST would be asserting on an
 * arrangement the next edit could take away. CNCORE-93 is open on that shape at
 * the page seam and it reaches this one too: the precondition is arranged where
 * the assertion is, never inherited from the order the file happens to run in.
 */
async function anInstanceNobodyHasConfigured() {
  await db.delete(settings);
}

describe("what an instance reaches before anybody configures it", () => {
  it("names no provider and allows nothing", async () => {
    await anInstanceNobodyHasConfigured();

    /*
     * THE EMPTY STRING RATHER THAN NULL OR AN ABSENT ROW, because the empty
     * string is what `parseProviderUrls` and `parseAllowlist` already answer
     * nothing to (ADR-0034, ADR-0121) -- so an instance nobody has configured
     * reaches nothing through the parsers that were already there, rather than
     * through a second rule about missing settings.
     */
    expect(await readProviderSettings(db)).toEqual({
      providerUrls: "",
      providerAllowlist: "",
    });
  });
});

describe("what the owner configured", () => {
  it("is there again on the next read", async () => {
    await anInstanceNobodyHasConfigured();

    await writeProviderSettings(db, {
      providerUrls: "http://wiki.test:8080",
      providerAllowlist: "wiki.test",
    });

    /*
     * A SECOND READ RATHER THAN THE WRITE'S OWN ANSWER. What the ticket asks is
     * that the configuration SURVIVES, and a function returning what it was
     * just handed proves nothing about the row. The page seam reloads a browser
     * against a running server for the same reason; this is that question asked
     * where it is cheap.
     */
    expect(await readProviderSettings(db)).toEqual({
      providerUrls: "http://wiki.test:8080",
      providerAllowlist: "wiki.test",
    });
  });

  it("keeps an entry exactly as it was typed", async () => {
    await anInstanceNobodyHasConfigured();

    /*
     * NO TRAILING SLASH, AND THAT IS THE ASSERTION. A provider's URL is its
     * IDENTITY (ADR-0031) and the identity is what the source row on every
     * imported claim carries, so a store that "tidied" this into
     * `http://wiki.test:8080/` would make one provider two and the catalogue
     * would hold a second item for everything imported under the other
     * spelling. The same goes for the case of the host and for a port nobody
     * had to write.
     */
    const asTyped = "http://Wiki.Test:8080/base?v=1";
    await writeProviderSettings(db, { providerUrls: asTyped });

    expect((await readProviderSettings(db)).providerUrls).toBe(asTyped);
  });

  it("leaves the setting the owner did not change alone", async () => {
    await anInstanceNobodyHasConfigured();
    await writeProviderSettings(db, {
      providerUrls: "http://wiki.test:8080",
      providerAllowlist: "wiki.test",
    });

    // EDITING THE ALLOWLIST IS NOT NAMING A PROVIDER. They are two settings for
    // one concept (ADR-0121) and neither is derivable from the other, so a
    // surface that edits one must not answer for the other.
    await writeProviderSettings(db, { providerAllowlist: "wiki.test, 127.0.0.0/8" });

    expect(await readProviderSettings(db)).toEqual({
      providerUrls: "http://wiki.test:8080",
      providerAllowlist: "wiki.test, 127.0.0.0/8",
    });
  });

  /**
   * TWO WRITES AT ONCE, ONE SETTING EACH, AND BOTH SURVIVE (CNCORE-386).
   *
   * THE ORDER IS FORCED RATHER THAN HOPED FOR, and that is why this test can
   * fail where the `Promise.all` race CNCORE-386 describes could not. The
   * allowlist's write stays open in a transaction holding the row, so the
   * provider's write reads the row as it stood before, and parks on its UPDATE
   * until the allowlist commits. A write that puts both columns back then
   * writes the allowlist it read, which is the allowlist from before, and the
   * owner's edit is gone with no error anywhere.
   */
  it("leaves it alone when the other is saved at the same moment", async () => {
    await anInstanceNobodyHasConfigured();
    // A ROW TO UPDATE, because the insert race on an unconfigured instance is a
    // different one, and `settings_single_row` already makes it loud.
    await writeProviderSettings(db, { providerUrls: "", providerAllowlist: "" });

    // Two handles, so the two writes are two connections rather than two turns
    // on one.
    const editing = await connect();
    const naming = await connect();
    try {
      let named!: Promise<unknown>;
      await editing.transaction(async (tx) => {
        await writeProviderSettings(tx, { providerAllowlist: "wiki.test" });
        named = writeProviderSettings(naming, { providerUrls: "http://wiki.test:8080" });
        // Awaited below; this only stops a failure inside it reading as an
        // unhandled rejection during the wait.
        named.catch(() => {});
        await untilSomebodyWaitsOn(tx);
      });
      await named;

      expect(await readProviderSettings(db)).toEqual({
        providerUrls: "http://wiki.test:8080",
        providerAllowlist: "wiki.test",
      });
    } finally {
      await editing.$client.end();
      await naming.$client.end();
    }
  });
});

/**
 * Until some backend is blocked by the one `holder` runs on.
 *
 * BLOCKED BY THAT ONE, NOT MERELY WAITING ON SOME LOCK. Any lock wait in the
 * database would let the holder commit before the other write had read, and
 * the test would then pass against the merging version too.
 *
 * NO LIMIT OF ITS OWN. The other write opens its connection inside this wait,
 * and a first connection has taken 5,004ms on a busy machine (CNCORE-280), so
 * the test's thirty-second timeout is the bound.
 */
async function untilSomebodyWaitsOn(holder: Writer): Promise<void> {
  const { rows } = await holder.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
  const pid = rows[0]?.pid;
  for (;;) {
    const { rowCount } = await db.execute(
      sql`select 1 from pg_stat_activity where ${pid}::int = any(pg_blocking_pids(pid))`,
    );
    if (rowCount !== 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/**
 * THE CEREMONY ADR-0075 ASKS OF EVERY TABLE, on the one this rung adds.
 *
 * IT IS NOT COVERED BY THE TESTS ABOVE, WHICH IS WHY IT IS HERE. Those read
 * what the store answers, and the store answers the two settings -- so the owner
 * id, the timestamps and the change sequence could all be absent and every one
 * of them would pass. Migration 16 attaches `settings_touch` itself, because
 * migration 1's loop named the eleven tables that existed then: a rung that
 * forgot would carry the columns and advance none of them, and nothing else in
 * this repository would notice.
 */
describe("what the settings row carries besides the settings", () => {
  it("belongs to the owner, and is stamped the moment it is written", async () => {
    await anInstanceNobodyHasConfigured();
    await writeProviderSettings(db, { providerAllowlist: "wiki.test" });

    const [row] = await db.select().from(settings);
    const owner = await theOwner(db);

    expect(row?.ownerId).toBe(owner);
    expect(row?.changeSequence).toBeGreaterThan(0);
    expect(row?.deletedAt).toBeNull();
  });

  it("advances the change sequence on every change the owner makes", async () => {
    /*
     * ADR-0075's SUBSTRATE, and this table is where it is easiest to lose. Every
     * change an Owner makes is an UPDATE of ONE row, so the change sequence is
     * the only record that the configuration changed at all: without the
     * trigger the row would read as though it had always said what it says now.
     */
    await anInstanceNobodyHasConfigured();
    await writeProviderSettings(db, { providerUrls: "http://wiki.test:8080" });
    const [first] = await db.select().from(settings);

    await writeProviderSettings(db, { providerUrls: "http://tmdb.test:8080" });
    const [second] = await db.select().from(settings);

    expect(second?.changeSequence).toBeGreaterThan(first?.changeSequence ?? 0);
    // `updated_at` IS THE TRIGGER'S OTHER HALF, and it advances by the database's
    // own clock rather than by whoever wrote the row -- which is the reason
    // ADR-0075 gives for the trigger existing: a write that forgets is exactly
    // the write a reversal query needs to find.
    expect(second?.updatedAt.getTime()).toBeGreaterThan(first?.updatedAt.getTime() ?? 0);
  });
});
