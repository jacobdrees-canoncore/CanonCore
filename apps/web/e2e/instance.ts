import { type ChildProcess, spawn } from "node:child_process";
import { createServer as createProbe } from "node:net";
import { fileURLToPath } from "node:url";
import { createDb, type Database } from "@canoncore/db";
import { buildTestDatabase, type TestDatabaseSuffix } from "@canoncore/db/testing/build-database";

/**
 * ONE INSTANCE OF CANONCORE, STOOD UP FOR A SUITE TO LOOK AT.
 *
 * EXTRACTED SO TWO PROJECTS CAN SHARE IT (CNCORE-73). `e2e/global-setup.ts`
 * declared this shape under CNCORE-111, when a fifth copy of the same run of
 * lines made it worth naming; the browser suite is a SIXTH caller in a
 * DIFFERENT Vitest project, and a second copy of the shape would be the exact
 * drift that extraction was performed to stop. Nothing about what an instance
 * IS changed in the move.
 */
export const webRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * THE OWNER'S PASSWORD, for the instances this harness has to WRITE to.
 *
 * Everything that changes a catalogue is behind a session since CNCORE-109, and
 * a session is what `OWNER_PASSWORD` is exchanged for (ADR-0044). So an instance
 * the harness fills -- or that a test file presses a button on -- is configured
 * with one, and every caller logs in through the page exactly as an owner
 * does.
 *
 * THE FRESH INSTALL IS DELIBERATELY WITHOUT ONE. That instance is what a
 * stranger's first run looks like, and it is also ADR-0044's demo: read-only,
 * with no login, because no password was set. It is passed an explicit empty
 * string for the reason its allowlist is -- this process inherits its own
 * environment, and an omitted key lets the parent's value through.
 */
export const OWNER_PASSWORD = "the owner's own password for the e2e suite";

/**
 * THE SERVER HALF, and every instance in this repository is made of it.
 *
 * Take a port nothing is on, start the ONE build against the environment given,
 * wait until it answers. Nothing here knows about databases, which is what lets
 * `setup` use it directly: that instance runs `next build` BETWEEN its database
 * and its server, and a helper that did both halves would have to take a flag
 * saying whether to build. `anInstanceServing` below is that helper for the four
 * with nothing in between.
 */
export async function theBuildServing(env: NodeJS.ProcessEnv): Promise<{
  baseUrl: string;
  close: () => void;
}> {
  const port = await freePort();
  const server = spawn("next", ["start", "--port", String(port)], {
    cwd: webRoot,
    env,
    stdio: "inherit",
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitUntilAnswering(baseUrl, server);
  return { baseUrl, close: () => server.kill("SIGTERM") };
}

/**
 * A DATABASE OF ITS OWN, WHATEVER FILLS IT, AND A SERVER ON IT (CNCORE-111).
 *
 * Four fixtures below spelled this out a line at a time, and the fifth copy is
 * what made the shape worth naming rather than the first. What each of them is
 * FOR stays in its own docblock, because that is the part worth reading and the
 * part an extraction must not swallow; what they share is only the plumbing.
 *
 * BOTH ENVIRONMENT VALUES ARE REQUIRED, WHICH IS THE POINT OF TAKING THEM. An
 * instance inherits this process's environment, so a key left out is not a key
 * unset -- it is a developer's `.env` reaching a fixture that was supposed to be
 * without it. `aCatalogueTooBigForOnePage` omitted `PROVIDER_URLS` for exactly
 * that reason and nothing said so. Now an instance that leaves either ambient
 * does not compile, which is the same mechanism `TEST_DATABASE_SUFFIXES` uses on
 * the suffix and not a second one to learn.
 *
 * THOSE TWO AND `DATABASE_URL`, AND NOTHING ELSE. The rest of this process's
 * environment is inherited on purpose -- the server needs `PATH` and the rest to
 * run at all -- so "cannot go ambient" is a claim about the three keys that
 * decide what an instance IS, not about the environment as a whole.
 *
 * `fill` RUNS BEFORE THE SERVER ANSWERS, so a suite never sees a half-filled
 * catalogue. An instance whose rows have to be written THROUGH the app cannot
 * use it -- the app is not up yet -- so it fills nothing here and does its work
 * on the returned `db` and `baseUrl` instead; `aCatalogueSafeToPurge` is the one
 * that does.
 *
 * The pool is lazy, so an instance that fills nothing opens no connection to the
 * database it is handed -- and `close` still ends it, so no caller has to know
 * which kind it is.
 */
export async function anInstanceServing<Fixture>({
  suffix,
  ownerPassword,
  allowlist,
  providers,
  fill,
}: {
  suffix: TestDatabaseSuffix;
  /**
   * ADR-0044's one password, or the empty string for an instance nobody can log
   * in to -- which is that record's demo, and is what a read-only instance is.
   * Required for the reason the two below are: a key left out is not a key
   * unset, it is this process's own environment reaching a fixture that was
   * meant to be without it, and an instance that became writable by inheritance
   * would take the whole point off the tests that assert a visitor sees no
   * button.
   */
  ownerPassword: string;
  /** ADR-0034's allowlist, as this instance's configuration. */
  allowlist: string;
  /** Which providers this instance searches (CNCORE-68), joined for the app. */
  providers: readonly string[];
  fill: (db: Database) => Promise<Fixture>;
}): Promise<{
  baseUrl: string;
  db: Database;
  fixture: Fixture;
  close: () => Promise<void>;
}> {
  const databaseUrl = await buildTestDatabase(suffix);
  const db = createDb(databaseUrl);
  const fixture = await fill(db);
  const server = await theBuildServing({
    ...process.env,
    DATABASE_URL: databaseUrl,
    OWNER_PASSWORD: ownerPassword,
    PROVIDER_ALLOWLIST: allowlist,
    PROVIDER_URLS: providers.join(","),
  });
  return {
    baseUrl: server.baseUrl,
    db,
    fixture,
    close: async () => {
      server.close();
      await db.$client.end();
    },
  };
}

/** Asks the operating system for a port nothing else is on. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createProbe();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        reject(new Error("could not read a port from the probe socket"));
        return;
      }
      probe.close(() => resolve(address.port));
    });
  });
}

export async function waitUntilAnswering(baseUrl: string, server: ChildProcess): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`next start exited with ${server.exitCode} before answering`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status < 500) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  server.kill("SIGTERM");
  throw new Error(`next start did not answer on ${baseUrl} within 60s`);
}


/**
 * `next build`, which every instance's server then serves.
 *
 * IT IS NOT PART OF `anInstanceServing`, and that is CNCORE-111's own reason
 * written the other way round: the page seam stands up SEVEN instances off ONE
 * build, so a helper that built per instance would build seven times. Each
 * PROJECT builds once and says so, which is why this is exported rather than
 * folded in.
 *
 * A PRODUCTION BUILD RATHER THAN `next dev`, because dev-mode rendering is not
 * what ships and the build costs about three seconds.
 *
 * THE ENVIRONMENT IS A REQUIRED PARAMETER for the reason an instance's is: a
 * key left out is not a key unset, it is whatever the developer's
 * `apps/web/.env` holds reaching a build that was meant to be without it.
 */
export function theAppBuilt(env: NodeJS.ProcessEnv): Promise<void> {
  return run("next", ["build"], env);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: webRoot, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`)),
    );
  });
}
