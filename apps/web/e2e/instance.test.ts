import { describe, expect, it } from "vitest";
import { SERVER_CONNECTIONS, theServerEnvironment } from "./instance";

/**
 * WHAT EVERY SERVER UNDER TEST IS RUN WITH (CNCORE-137).
 *
 * THE ENVIRONMENT RATHER THAN THE SPAWN, because the spawn is `next start` and
 * a test that took one would be standing up an eleventh server to read a
 * variable off it. What is worth holding is the DECISION -- that a server in
 * this harness runs bounded, and at which number -- and that is this object.
 * Why the bound exists and why it is not the default everywhere is in
 * `instance.ts` beside the constant, and in ADR-0104.
 */
describe("the environment a server under test runs with", () => {
  /**
   * FOUR, AND IT IS MEASURED RATHER THAN CHOSEN FOR ROUNDNESS -- the peak
   * `state = 'active'` one server reached across a full unbounded run. The
   * measurement and the ceiling it moves live in ADR-0104, under "Raising the
   * ceiling was the wrong lever, and bounding the demand was the right one",
   * rather than being restated here where a correction would have to find them.
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
   * would leave the suite exactly where it started while reading, from the call
   * site, as though something had been done about it.
   */
  it("bounds below the ten node-postgres would otherwise hold", () => {
    expect(SERVER_CONNECTIONS).toBeLessThan(10);
  });

  /**
   * THE BOUND WINS OVER AN INHERITED ONE, which is what makes the number above
   * true of a developer's machine and not only of CI. `anInstanceServing`
   * spreads `process.env`, so a value set in the surrounding shell reaches here
   * and must not survive.
   */
  it("overrides a bound inherited from the surrounding environment", () => {
    const composed = theServerEnvironment({
      NODE_ENV: "test",
      DATABASE_MAX_CONNECTIONS: "50",
    });

    expect(composed.DATABASE_MAX_CONNECTIONS).toBe("4");
  });

  /**
   * IT DECIDES ONE KEY AND NOTHING ELSE. Each instance says what database it
   * reaches and whether anybody can log in to it, and a helper that overwrote
   * either would be answering questions the fixtures exist to ask.
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
