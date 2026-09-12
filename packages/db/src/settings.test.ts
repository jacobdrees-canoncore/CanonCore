import { beforeAll, describe, expect, it } from "vitest";

import { type Database, readProviderSettings, writeProviderSettings } from "./index";
import { settings } from "./schema";
import { connect } from "./testing/catalogue";

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
});
