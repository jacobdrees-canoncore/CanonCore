import { describe, expect, it } from "vitest";
import { SERVER_CONNECTIONS, theServerEnvironment } from "./instance";

/**
 * WHAT EVERY SERVER UNDER TEST IS RUN WITH (CNCORE-137).
 *
 * THE ENVIRONMENT RATHER THAN THE SPAWN, because the spawn is `next start` and
 * a test that took one would be standing up an eleventh server to read a
 * variable off it. What is worth holding is the DECISION -- that a server in
 * this harness runs bounded, and at which number -- and that is this object.
 *
 * `theBuildServing` IS THE ONE PLACE IT CAN BE SAID. Ten of this suite's
 * servers come from `anInstanceServing` and the eleventh, the fresh install,
 * calls `theBuildServing` directly because it builds in between; both go
 * through the one function, so a bound applied there is a bound every server
 * has.
 */
describe("the environment a server under test runs with", () => {
  /**
   * FOUR, AND IT IS MEASURED RATHER THAN CHOSEN FOR ROUNDNESS. Sampling
   * `pg_stat_activity` through a full run on 2026-09-13, no server ever had
   * more than FOUR connections executing a statement at once -- 1,406 samples,
   * peak `state = 'active'` of 4 on the two busiest databases and 1 or 2 on the
   * rest. The other six of node-postgres's ten were idle slack, held against a
   * ceiling every other worktree is drawing on.
   *
   * THE LITERAL IS WRITTEN OUT rather than derived from the constant, so
   * changing the bound is a deliberate edit to a measured number rather than a
   * test that agrees with whatever it is told.
   */
  it("bounds a server's pool at the four a server was measured to use", () => {
    expect(theServerEnvironment({ NODE_ENV: "test" }).DATABASE_MAX_CONNECTIONS).toBe("4");
  });

  /**
   * AND IT IS ACTUALLY A BOUND. A value at or above node-postgres's own ten
   * would leave the suite exactly where it started while reading, from the
   * call site, as though something had been done about it.
   */
  it("bounds below the ten node-postgres would otherwise hold", () => {
    expect(SERVER_CONNECTIONS).toBeLessThan(10);
  });

  /**
   * IT ADDS ONE KEY AND DECIDES NOTHING ELSE. Each instance says what database
   * it reaches and whether anybody can log in to it, and a helper that
   * overwrote either would be answering questions the fixtures exist to ask.
   */
  it("leaves the instance's own environment as the caller wrote it", () => {
    const composed = theServerEnvironment({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://postgres:password@127.0.0.1:55432/somewhere",
      OWNER_PASSWORD: "",
    });

    expect(composed.DATABASE_URL).toBe("postgresql://postgres:password@127.0.0.1:55432/somewhere");
    expect(composed.OWNER_PASSWORD).toBe("");
  });
});
