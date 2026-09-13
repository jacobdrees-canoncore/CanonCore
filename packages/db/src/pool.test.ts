import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WHAT `getDb` HANDS THE POOL, which is the one place the application's own
 * bound is decided (CNCORE-137).
 *
 * NO DATABASE IS REACHED HERE and none needs to be: node-postgres fills a pool
 * lazily, so a handle built and never queried opens no connection. That is what
 * lets this assert on a real `getDb()` rather than on a mock of it -- the seam
 * is the pool the application would actually use.
 *
 * THE MODULE IS RE-IMPORTED PER TEST because `getDb` memoises, deliberately:
 * one pool per process is the whole point of it, so a second call in the same
 * module instance answers with the first call's bound whatever the environment
 * now says.
 */
const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env.DATABASE_URL = "postgresql://postgres:password@127.0.0.1:1/nothing";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("the pool the application holds", () => {
  it("holds node-postgres's ten when the environment names no bound", async () => {
    delete process.env.DATABASE_MAX_CONNECTIONS;

    const { getDb } = await import("./index");
    expect(getDb().$client.options.max).toBe(10);
  });

  /**
   * THE BOUND ARRIVING AT THE POOL, which is the half that was missing. The
   * option has been on `createDb` since CNCORE-99 and the harness has passed it
   * since; what nothing wired was the APPLICATION's own pool to anything an
   * operator could set, so the ten servers `pnpm test:e2e` stands up each took
   * the default and the suite spent the container's whole budget.
   */
  it("holds the bound the environment names", async () => {
    process.env.DATABASE_MAX_CONNECTIONS = "4";

    const { getDb } = await import("./index");
    expect(getDb().$client.options.max).toBe(4);
  });
});
