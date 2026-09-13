import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("server env", () => {
  it("refuses to load without DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;

    // next.config.ts imports this module, so throwing here is what turns a
    // missing variable into a failed build instead of a failed request.
    await expect(import("./server")).rejects.toThrow();
  });

  it("refuses an empty DATABASE_URL, rather than treating it as set", async () => {
    process.env.DATABASE_URL = "";

    await expect(import("./server")).rejects.toThrow();
  });

  it("loads when DATABASE_URL is present", async () => {
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/canoncore";

    const { env } = await import("./server");
    expect(env.DATABASE_URL).toBe("postgresql://postgres:password@localhost:5432/canoncore");
  });

  /**
   * THE POOL BOUND (CNCORE-137). One PostgreSQL serves every worktree
   * (ADR-0104), so how many connections ONE process may hold is a deployment's
   * to size rather than node-postgres's to assume.
   *
   * A NUMBER OUT OF A STRING, because an environment holds only text. The
   * default is node-postgres's own ten, so an installation that sets nothing
   * gets exactly the pool it had before this variable existed.
   */
  it("defaults the pool bound to node-postgres's ten when nothing sets it", async () => {
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/canoncore";
    delete process.env.DATABASE_MAX_CONNECTIONS;

    const { env } = await import("./server");
    expect(env.DATABASE_MAX_CONNECTIONS).toBe(10);
  });

  it("reads the pool bound as a number rather than the text it arrives as", async () => {
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/canoncore";
    process.env.DATABASE_MAX_CONNECTIONS = "4";

    const { env } = await import("./server");
    expect(env.DATABASE_MAX_CONNECTIONS).toBe(4);
  });

  /**
   * A POOL OF NONE IS NOT A SMALL POOL, it is a process that can never reach
   * its database -- and it fails at the first query rather than at startup,
   * which is the failure this refuses to let start.
   */
  /**
   * THE CONTAINER'S OWN PATH, and it is the one that would break silently.
   * `compose.yaml` interpolates `${DATABASE_MAX_CONNECTIONS:-}`, so an
   * installation that sets nothing hands the container an EMPTY STRING rather
   * than an absent key. That reaches the default only because `createEnv` is
   * given `emptyStringAsUndefined: true`; bare zod would coerce `""` to 0, fail
   * `.positive()`, and refuse to start every container that never configured
   * this. Nothing else in the repository pins that flag, so this does.
   */
  it("takes an empty value as unset, which is what compose hands a container", async () => {
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/canoncore";
    process.env.DATABASE_MAX_CONNECTIONS = "";

    const { env } = await import("./server");
    expect(env.DATABASE_MAX_CONNECTIONS).toBe(10);
  });

  it.each(["0", "-1", "not a number"])("refuses a pool bound of %s", async (value) => {
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/canoncore";
    process.env.DATABASE_MAX_CONNECTIONS = value;

    await expect(import("./server")).rejects.toThrow();
  });
});
