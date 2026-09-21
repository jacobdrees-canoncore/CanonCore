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
    // A FRESH MODULE GRAPH, because `env` is a copy of the environment taken
    // when that module first loads, which is how `session.test.ts` builds its
    // demo instance too.
    vi.stubEnv("OWNER_PASSWORD", undefined);
    vi.resetModules();
    const { aTokenForTheOwner } = await import("./the-owner");

    await expect(aTokenForTheOwner()).rejects.toThrow(
      "this suite's vitest.config.ts sets OWNER_PASSWORD, and it is not set",
    );
  });
});
