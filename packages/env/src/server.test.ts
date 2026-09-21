import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

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

  /**
   * A POOL OF NONE IS NOT A SMALL POOL, it is a process that can never reach
   * its database -- and it fails at the first query rather than at startup,
   * which is the failure this refuses to let start.
   */
  it.each(["0", "-1", "not a number"])("refuses a pool bound of %s", async (value) => {
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/canoncore";
    process.env.DATABASE_MAX_CONNECTIONS = value;

    await expect(import("./server")).rejects.toThrow();
  });
  /**
   * AND READING THE ENVIRONMENT DOES NOT EMPTY IT (CNCORE-270).
   *
   * `emptyStringAsUndefined` above is what makes an empty value mean unset, and
   * t3-env implements it by DELETING every empty-valued key -- from the object
   * it was handed, which was `process.env` ITSELF until this ticket. So reading
   * the environment took a variable out of it, and the next thing in that
   * process to load `dotenv/config` found an ABSENT key rather than an empty one
   * and filled it in from `apps/web/.env`. The case below is this same fact with
   * the file attached.
   *
   * MEASURED 2026-09-21, inside a real `next start` with a trap on
   * `process.env`: `createEnv` deleted `OWNER_PASSWORD` from
   * `packages/env/src/server.ts`, and dotenv's `populate` set it to the
   * developer's password a moment later, from the server bundle's own copy of
   * this module.
   *
   * NEITHER LOADER IS AT FAULT, AND BOTH WERE CHECKED RATHER THAN BLAMED.
   * dotenv leaves a key that is PRESENT alone whatever its value, and so does
   * `@next/env` 16.3.5 -- both measured the same day against an explicit empty
   * string. CNCORE-270 was filed blaming them, and `global-setup.ts`'s
   * `freshInstall` had blamed Next's loader since CNCORE-99; the deletion here
   * is what actually opened the door.
   */
  it("leaves an empty variable in the environment it read, rather than deleting it", async () => {
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/canoncore";
    process.env.OWNER_PASSWORD = "";

    await import("./server");

    expect(process.env.OWNER_PASSWORD).toBe("");
  });
  /**
   * AND THE SAME FACT WITH THE FILE ATTACHED, which is what CNCORE-270 was
   * filed as: a password in `apps/web/.env` reaching an instance the e2e
   * harness stood up WITHOUT one, so ADR-0044's read-only demo grew a login.
   *
   * TWO LOADS OF THIS MODULE, BECAUSE THAT IS WHAT A NEXT SERVER DOES. One
   * copy comes in through the require hook when `next.config.ts` is evaluated,
   * and the server bundle carries its own; each runs `dotenv/config` for
   * itself. The first used to empty `OWNER_PASSWORD` out of the process and
   * the second's dotenv then refilled it from the file. ONE LOAD CANNOT SHOW
   * IT -- which is why this defect survived a suite that loads this module in
   * every other case above.
   *
   * ITS OWN `.env`, IN A TEMPORARY DIRECTORY, AND NEVER `apps/web/.env`. That
   * file is the developer's own and `db:setup` writes this worktree's database
   * into it; the e2e suite also runs its files in PARALLEL by decision
   * (CNCORE-253), with `item-page-cost.test.ts` starting servers mid-run, so a
   * test that rewrote it would hand a real instance the wrong environment while
   * it booted.
   *
   * THE PASSWORD IN THE FILE IS A VALID ONE -- over the schema's twelve
   * characters -- so a leak arrives as a CONFIGURED instance rather than as a
   * validation error. A short one would fail this test for the wrong reason.
   */
  it("does not take a password from .env for a variable deliberately set empty", async () => {
    const directory = await mkdtemp(join(tmpdir(), "canoncore-env-"));
    onTestFinished(() => rm(directory, { recursive: true, force: true }));
    await writeFile(join(directory, ".env"), "OWNER_PASSWORD=the-developers-own-password\n");
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/canoncore";
    // ADR-0044's demo, as `apps/web/e2e/instance.ts` stands one up: empty on
    // purpose, so `session.logIn` refuses every password and nobody gets in.
    process.env.OWNER_PASSWORD = "";

    // The copy `next.config.ts` pulls in, which is the load that used to do the
    // deleting. Then the dotenv the SERVER BUNDLE's own copy runs, driven here
    // rather than imported: `dotenv/config` resolves its file from the working
    // directory and caches its options at first load, so a second `import` of
    // this module would read neither the file below nor a fresh option set.
    await import("./server");
    const { config } = await import("dotenv");
    config({ path: join(directory, ".env"), quiet: true });
    vi.resetModules();
    const { env } = await import("./server");

    expect(env.OWNER_PASSWORD).toBeUndefined();
  });
});
