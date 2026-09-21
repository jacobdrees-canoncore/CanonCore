import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * THE GUARD, which is the half of `aTokenForTheOwner` nothing else reaches. The
 * other half, the token opening the Owner's door, is asserted by every suite
 * that imports it: a token that opened nothing would fail each of their owner
 * tests before it reached what they assert.
 */
describe("a token for the Owner", () => {
  it("names the config that sets the password, when nothing has", async () => {
    // EMPTY RATHER THAN DELETED, because `dotenv` fills an ABSENT key from a
    // developer's `.env` and leaves a present one alone, and `@canoncore/env`
    // reads an empty value as unset (ADR-0173). A FRESH MODULE GRAPH, because
    // `env` is a copy taken when that module first loads.
    vi.stubEnv("OWNER_PASSWORD", "");
    vi.resetModules();
    const { aTokenForTheOwner } = await import("./the-owner");

    await expect(aTokenForTheOwner()).rejects.toThrow(
      "this suite's vitest.config.ts sets OWNER_PASSWORD, and it is not set",
    );
  });
});
