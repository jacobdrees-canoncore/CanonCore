import { type ChildProcess, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { createDb, type Database, writeProviderSettings } from "@canoncore/db";
import {
  buildTestDatabase,
  type FixtureDatabaseSuffix,
} from "@canoncore/db/testing/build-database";

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
 * ONE FUNCTION SO THE BOUND CANNOT BE FORGOTTEN AT A CALL SITE. Ten of this
 * suite's servers are started by `anInstanceServing` below and the eleventh -- the
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
 * A GLOBAL SETUP THAT OWNS WHAT IT STARTS, AND ITS TEARDOWN (CNCORE-229).
 *
 * `body` is handed `owned`, and everything it starts goes on it as it starts. If
 * `body` throws, everything on it is closed, the last started first, and the
 * error goes on as it was thrown -- inside a `SuppressedError`, which is the
 * platform's shape for it, if a close threw as well. If it completes, the same
 * stack is the teardown this hands back.
 *
 * WHY A THROW HAS TO CLOSE ANYTHING. A server here is a `next start` PROCESS,
 * and it does not end when the process that started it does: it is re-parented
 * to pid 1 and goes on holding the stderr it inherited (its stdout has been a
 * pipe into the harness since CNCORE-235). On a pipe that is a stream nothing
 * ever closes, so CI, which reads a step's output to the end,
 * waits on it until the job's ceiling (ADR-0141). Vitest calls a teardown only
 * if setup returned one, so a setup that threw part-way used to leave every
 * server it had already started running: seven after one run on 2026-09-19 and
 * six after the next, found with parent pid 1 in `apps/web`. Reproduced by
 * piping `pnpm test:e2e 2>&1` through `cat`.
 *
 * AND WHY THE TEARDOWN IS THE STACK RATHER THAN A LIST. The teardown used to be
 * a list of closes written by hand, and CNCORE-178 added an instance and not its
 * line: that server outlived the suite and hung CI the same way. A stack that
 * every server goes on as it starts has no line to forget.
 *
 * NODE'S OWN `AsyncDisposableStack`, which is the platform's answer to exactly
 * this: `await using` closes it on the way out of a throw, and `move()` hands it
 * on intact when there was none.
 *
 * IT CLOSES ONE THING AT A TIME, which is why closing a server only signals it
 * (`theBuildServing` says so). Vitest ends a teardown that runs past its
 * `teardownTimeout` with `process.exit()`, and a server not yet signalled then
 * is orphaned exactly as before.
 */
export async function settingUp(
  body: (owned: AsyncDisposableStack) => Promise<void>,
): Promise<() => Promise<void>> {
  await using owned = new AsyncDisposableStack();
  await body(owned);
  const teardown = owned.move();
  return () => teardown.disposeAsync();
}

/**
 * THE SERVER HALF, and every instance in this repository is made of it.
 *
 * Start the ONE build against the environment given, on a port the server
 * chooses itself, and wait until it answers. Nothing here knows about
 * databases, which is what lets `setup` use it directly: that instance runs
 * `next build` BETWEEN its database and its server, and a helper that did both
 * halves would have to take a flag saying whether to build. `anInstanceServing`
 * below is that helper for the four with nothing in between.
 *
 * THE SERVER GOES ON `owned` AS IT IS SPAWNED, before the wait, so there is no
 * way to start one in this harness that nothing will close (CNCORE-229) -- one
 * that never answers included. `close` is still handed back for a caller that
 * has to stop a server early, as `item-page-cost.test.ts` does inside a window;
 * closing one twice is a no-op.
 *
 * CLOSING SENDS SIGTERM AND DOES NOT WAIT FOR THE EXIT, and that was measured
 * rather than assumed. Waiting made the stack close its servers one exit at a
 * time: eleven took 3107ms, 87ms and 3090ms on three runs on 2026-09-19, where
 * signalling takes milliseconds, and each slow exit held back the signal for
 * every server behind it against Vitest's ten-second `teardownTimeout`. A server
 * signalled is one that stops -- Next exits on SIGTERM -- so the pipe is let go
 * a moment after the teardown ends, rather than never.
 *
 * NO PORT IS NAMED TO THE SERVER IN ADVANCE, AND IT LISTENS ONLY WHERE IT IS
 * REACHED (CNCORE-235). `SERVER_HOST` and `thePortItBound` below say why; ADR-0144
 * carries the measurements.
 */
export async function theBuildServing(
  owned: AsyncDisposableStack,
  env: NodeJS.ProcessEnv,
): Promise<{
  baseUrl: string;
  /** The process's own identity, which a check for a survivor needs: see `instance.test.ts`. */
  pid: number | undefined;
  close: () => void;
}> {
  /*
   * `next start`, AND NEXT WARNS ONCE PER SERVER THAT IT IS NOT THE ENTRY POINT
   * `output: "standalone"` SHIPS. The warning is expected here and is not a
   * fault to chase (ADR-0185, CNCORE-302).
   *
   * THE SHIPPED ENTRY POINT CANNOT TAKE AN EPHEMERAL PORT, which is what
   * decides this. `next build` writes the glue, and it reads
   * `parseInt(process.env.PORT, 10) || 3000` -- so `PORT=0` is not a request
   * for a port, it is 3000. Eleven servers would each need one named in
   * advance, which is exactly the window `thePortItBound` below exists to
   * close (ADR-0144), and on the Owner's machine 3000 is the live install:
   * measured, a standalone server bound beside it and served ITS callers this
   * suite's fixtures.
   *
   * SO THE ENTRY POINT THAT SHIPS IS PROVED WHERE IT CAN BE. CI's `image` job
   * runs the real image and asks a route that reads the database, which is the
   * one defect class this cannot see -- a module the app reaches that tracing
   * missed. `packages/config/src/image.test.ts` holds that job to it, because
   * this line is only acceptable while that one is true.
   */
  const server = spawn("next", ["start", "--hostname", SERVER_HOST, "--port", "0"], {
    cwd: webRoot,
    env: theServerEnvironment(env),
    stdio: ["inherit", "pipe", "inherit"],
  });
  const close = () => {
    server.kill("SIGTERM");
  };
  owned.defer(close);
  const deadline = Date.now() + STARTING_MS;
  const baseUrl = `http://${SERVER_HOST}:${await thePortItBound(server, NEXT_START, deadline)}`;
  await waitUntilAnswering(baseUrl, server, deadline);
  return { baseUrl, pid: server.pid, close };
}

/**
 * WHERE EVERY SERVER UNDER TEST LISTENS AND WHERE THE HARNESS REACHES IT: ONE
 * ADDRESS, NOT TWO (CNCORE-235).
 *
 * `next start` binds every address unless it is told one, and the harness
 * reaches it at `127.0.0.1`. That left the exact address open: Node sets
 * `SO_REUSEADDR`, so on macOS another process may still bind `127.0.0.1` on a
 * port a wildcard server holds, and a connection goes to the most specific
 * address bound, so that process answers the harness in the server's place.
 * Bound where it is reached, the server makes that bind `EADDRINUSE` instead --
 * and stops listening on the network, which a server under test never needed.
 *
 * `live/provider.ts` binds `provider-wiki` here too, and reaches it here (CNCORE-237).
 */
export const SERVER_HOST = "127.0.0.1";

/**
 * A server this harness starts as a process: what to call it in an error, and
 * the line it prints once it is listening, whose first group is the URL it bound.
 */
export type Announcement = { name: string; line: RegExp };

/** `next start`'s own line, printed from the address its listener reports. */
const NEXT_START: Announcement = { name: "next start", line: /- Local:\s+(\S+)\r?\n/ };

/**
 * THE PORT A SERVER BOUND, read off the line it announces it on (CNCORE-235).
 *
 * THE HARNESS USED TO CHOOSE THE PORT AND HAND IT OVER, and the handing over was
 * the defect. A probe bound port 0, read the number, closed, and passed it to
 * `--port`; from that close until Next's own bind the port was anybody's, and on
 * 2026-09-19, beside another worktree's suite, somebody took one and the server
 * died on `EADDRINUSE`. The OS does not hand out a port a live listener holds, so
 * a port chosen BY the bind that holds it has no window: Next is given `--port 0`
 * and says which port the OS chose.
 *
 * NEXT'S OWN HARNESS DOES EXACTLY THIS: its `next start` test mode spawns with
 * `PORT` 0 unless a test forces one, and reads the URL off the `- Local:` line.
 * Next prints that line once it is listening, from the address its listener
 * reports. Were a later Next to word it differently, every server here would fail
 * to start saying it named no port, rather than start somewhere unknown.
 *
 * AND IT IS NOT NEXT'S ALONE (CNCORE-237). The live suite starts `provider-wiki`,
 * another repository's server, and it had the same window through the same
 * probe. That provider takes `PORT` from its environment, listens, reads the port
 * back from its own listener and prints it, so it is given 0 and read the same
 * way, off its own line. `Announcement` is the one thing that differs.
 *
 * STDOUT IS PIPED TO READ IT AND PASSED ON, so a server's output still reaches
 * the run's own. Stderr is inherited as before, so an orphaned server still
 * holds the run's output open through it, which is why `settingUp` matters.
 */
export function thePortItBound(
  server: ChildProcess,
  { name, line }: Announcement,
  deadline = Date.now() + STARTING_MS,
): Promise<number> {
  const { stdout } = server;
  if (stdout === null) throw new Error(`${name} was spawned without a pipe on its stdout`);
  stdout.pipe(process.stdout, { end: false });
  return new Promise((resolve, reject) => {
    let heard = "";
    const hearing = (chunk: Buffer) => {
      heard += chunk.toString();
      const url = line.exec(stripVTControlCharacters(heard))?.[1];
      if (url === undefined) return;
      done();
      // A URL with no port of its own reads as port 0, which is not one it bound.
      const port = URL.canParse(url) ? Number(new URL(url).port) : 0;
      if (port > 0) resolve(port);
      else reject(new Error(`${name} announced ${url}, which names no port`));
    };
    const exited = (code: number | null) => {
      done();
      reject(new Error(`${name} exited with ${code} before it named its port`));
    };
    const failed = (error: Error) => {
      done();
      reject(error);
    };
    const giveUp = setTimeout(() => {
      done();
      reject(new Error(`${name} named no port within ${STARTING_MS / 1000}s`));
    }, deadline - Date.now());
    const done = () => {
      clearTimeout(giveUp);
      stdout.off("data", hearing);
      server.off("exit", exited);
      server.off("error", failed);
    };
    stdout.on("data", hearing);
    server.on("exit", exited);
    server.on("error", failed);
  });
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
 * database it is handed -- and `owned` still ends it, so no caller has to know
 * which kind it is.
 *
 * AND BOTH GO ON `owned` AS THEY ARE MADE, not when the instance is handed back
 * (CNCORE-229). A fixture can do work after its server answers --
 * `aCatalogueSafeToPurge` browses two providers through its app -- and a throw
 * there used to leave a server running that no teardown held.
 */
export async function anInstanceServing<Fixture>(
  owned: AsyncDisposableStack,
  {
    suffix,
    ownerPassword,
    allowlist,
    providers,
    fill,
  }: {
    suffix: FixtureDatabaseSuffix;
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
  },
): Promise<{
  baseUrl: string;
  db: Database;
  fixture: Fixture;
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
  owned.defer(() => db.$client.end());
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
  /*
   * AN INSTANCE PASSED THE EMPTY STRING IS ONE NOBODY CAN LOG IN TO, AND IT
   * STAYS ONE (ADR-0173, CNCORE-270).
   *
   * The empty string is passed rather than the key omitted for the reason the
   * docblock above gives, and that used to be undone further in: reading the
   * configuration deleted the empty key out of the server's own environment, and
   * the next `dotenv/config` in that process refilled it from `apps/web/.env`.
   * So a developer who had set a password to hand-walk a branch, which
   * `README.md` tells them to and `CLAUDE.md` requires, handed it to all three
   * of ADR-0044's read-only instances instead, and the failure surfaced as an
   * assertion about a header. ADR-0173 carries the mechanism and the
   * measurement; `packages/env/src/server.ts` holds the one line.
   */
  const server = await theBuildServing(owned, {
    ...process.env,
    DATABASE_URL: databaseUrl,
    OWNER_PASSWORD: ownerPassword,
  });
  return { baseUrl: server.baseUrl, db, fixture };
}

/** A server's minute to start: to bind, to say where, and to answer there. */
const STARTING_MS = 60_000;

async function waitUntilAnswering(
  baseUrl: string,
  server: ChildProcess,
  deadline = Date.now() + STARTING_MS,
): Promise<void> {
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
  throw new Error(`next start did not answer on ${baseUrl} within ${STARTING_MS / 1000}s`);
}

/**
 * `next build`, which every instance's server then serves.
 *
 * IT IS NOT PART OF `anInstanceServing`, and that is CNCORE-111's own reason
 * written the other way round: the page seam stands up ELEVEN instances off ONE
 * build, so a helper that built per instance would build eleven times. Each
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
