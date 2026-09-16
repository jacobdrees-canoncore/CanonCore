import { type ChildProcess, spawn } from "node:child_process";
import { createServer as createProbe } from "node:net";
import { fileURLToPath } from "node:url";
import { createDb, type Database, writeProviderSettings } from "@canoncore/db";
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
 * HOW MANY CONNECTIONS ONE HARNESS HANDLE MAY HOLD.
 *
 * TWO RATHER THAN node-postgres's TEN, because a fixture does one thing at a
 * time and the connections it would otherwise hold idle are ones the SERVERS
 * under test cannot have. Shared by every handle this suite opens, so the
 * budget is one number rather than a decision taken eight times.
 */
export const HARNESS_CONNECTIONS = 2;

/**
 * HOW MANY CONNECTIONS ONE SERVER UNDER TEST MAY HOLD (CNCORE-137).
 *
 * FOUR RATHER THAN node-postgres's TEN, and the four is MEASURED: sampling
 * `pg_stat_activity` through an unbounded run, no server ever had more than
 * FOUR connections executing a statement at once. ADR-0104 carries the
 * measurement, the before-and-after totals and the agent ceiling they imply,
 * under "Raising the ceiling was the wrong lever, and bounding the demand was
 * the right one" -- one place rather than five, so a correction lands once.
 *
 * THE HARNESS'S OWN HANDLES WERE ALREADY BOUNDED AND WERE NEVER THE PROBLEM.
 * `HARNESS_CONNECTIONS` has held them at two since CNCORE-99. What nothing
 * bounded was the SERVER PROCESSES this file starts, each a real CanonCore
 * calling `getDb()` and so taking node-postgres's default ten.
 *
 * IT IS SET HERE AND NOT LOWERED IN `packages/env`, which is CNCORE-137's one
 * real decision. The measurement is taken from servers running ONE test file
 * each, SEQUENTIALLY -- so four is the peak of a sequential workload, and an
 * instance serving several readers at once would be throttled by it. The
 * default stays the ten every deployment already had.
 */
export const SERVER_CONNECTIONS = 4;

/**
 * THE ENVIRONMENT EVERY SERVER UNDER TEST RUNS WITH.
 *
 * ONE FUNCTION SO THE BOUND CANNOT BE FORGOTTEN AT A CALL SITE. Nine of this
 * suite's servers are started by `anInstanceServing` below and the tenth -- the
 * fresh install, which builds between its database and its server -- calls
 * `theBuildServing` directly. Both reach the spawn through this function, so
 * there is no way to start a server in this harness that is not bounded.
 *
 * IT OVERWRITES THE BOUND ON PURPOSE, and that is the one key it decides.
 * `anInstanceServing` spreads `process.env` into what it passes, so a developer
 * with `DATABASE_MAX_CONNECTIONS` set in their own environment would otherwise
 * hand every server under test a number CI never had -- the same class of leak
 * `freshInstall` records an afternoon lost to. What an instance REACHES and
 * whether anybody can log in to it stay the fixtures' own to answer, and this
 * is not a second place they get decided.
 */
export function theServerEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...env, DATABASE_MAX_CONNECTIONS: String(SERVER_CONNECTIONS) };
}

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
    env: theServerEnvironment(env),
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
 * WHAT THIS INSTANCE REACHES IS WRITTEN INTO ITS DATABASE, NOT ITS ENVIRONMENT
 * (CNCORE-99). Both settings are rows now (migration 16), so the harness
 * configures an instance the way an owner does -- through the store the settings
 * surface writes -- rather than through variables the app no longer reads.
 *
 * AND THAT ENDED A WHOLE CLASS OF LEAK RATHER THAN MOVING IT. While they were
 * environment variables an omitted key was not an unset one: this process
 * inherits its own environment, so a developer with providers in
 * `apps/web/.env` gave a fixture ones CI never had, and `freshInstall`'s
 * comment below records an afternoon lost to exactly that. A row is written or
 * it is not, and nothing on this machine can put one there.
 *
 * BOTH VALUES ARE STILL REQUIRED, WHICH IS THE POINT OF TAKING THEM: an
 * instance that did not say what it reaches would be one whose configuration a
 * reader has to go and find. That is the same mechanism `TEST_DATABASE_SUFFIXES`
 * uses on the suffix and not a second one to learn.
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
  /** ADR-0034's allowlist, written into this instance's settings. */
  allowlist: string;
  /** Which providers this instance searches (CNCORE-68, ADR-0121). */
  providers: readonly string[];
  fill: (db: Database) => Promise<Fixture>;
}): Promise<{
  baseUrl: string;
  /**
   * WHICH DATABASE THIS INSTANCE IS ON, for a suite that has to ask PostgreSQL
   * about it rather than ask the app (CNCORE-176). What an Item page COSTS is
   * read off `pg_stat_database`, which is keyed by the database's NAME -- and
   * the name is built in here, so a caller that could not see it would have to
   * rebuild it from `testDatabaseNameFor` and hope the two agreed.
   */
  databaseUrl: string;
  db: Database;
  fixture: Fixture;
  close: () => Promise<void>;
}> {
  const databaseUrl = await buildTestDatabase(suffix);
  /*
   * A HANDLE THE HARNESS HOLDS, BOUNDED (CNCORE-99). One PostgreSQL serves
   * every server this suite stands up and every handle it holds itself, and a
   * fixture pool uses one connection at a time -- so the ten node-postgres
   * would open are nine held against a ceiling the servers are also drawing on.
   * Measured: the ninth instance took a run past PostgreSQL's default hundred,
   * and the failures landed in whichever file happened to be reading.
   */
  const db = createDb(databaseUrl, { maxConnections: HARNESS_CONNECTIONS });
  /*
   * BEFORE THE SERVER ANSWERS, like the fixture below it, so no suite ever sees
   * an instance half-configured. It is written first because `fill` may IMPORT
   * -- and an import reaches a provider through the very allowlist this line
   * writes.
   */
  await writeProviderSettings(db, {
    providerAllowlist: allowlist,
    providerUrls: providers.join("\n"),
  });
  const fixture = await fill(db);
  const server = await theBuildServing({
    ...process.env,
    DATABASE_URL: databaseUrl,
    OWNER_PASSWORD: ownerPassword,
  });
  return {
    baseUrl: server.baseUrl,
    databaseUrl,
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
