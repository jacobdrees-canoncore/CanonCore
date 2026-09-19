import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { buildTestDatabase } from "@canoncore/db/testing/build-database";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SERVER_CONNECTIONS, settingUp, theBuildServing, theServerEnvironment } from "./instance";

/**
 * THE REAL `spawn`, WRAPPED SO ONE CASE CAN PUT ANOTHER PROCESS IN ITS WAY
 * (CNCORE-235). Every call goes through to Node's own until a case arms it, and
 * then only the next one is intercepted: see `aPortThief` below.
 */
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});

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

/**
 * EVERY SERVER BELOW STANDS ON `leak`, one at a time, for the two reasons the
 * next block gives: a server start is not a read, and two at once cost an agent.
 */
let env: NodeJS.ProcessEnv;

beforeAll(async () => {
  env = { ...process.env, DATABASE_URL: await buildTestDatabase("leak"), OWNER_PASSWORD: "" };
});

/**
 * A SETUP THAT STARTS SERVERS, AND WHAT BECOMES OF THEM (CNCORE-229).
 *
 * THIS ONE DOES STAND SERVERS UP, where the block above refuses to, because
 * the claim is about a PROCESS. A `next start` does not end when the process
 * that started it does, and one left running holds the output pipe it
 * inherited open, so a CI step reading that pipe never ends: ADR-0141's hang,
 * reached through `settingUp` rather than around it. A stand-in whose `close`
 * recorded a call would pass while the real server went on running.
 *
 * A SURVIVOR IS FOUND BY ITS OWN PID, not by being a child of this process. The
 * orphans this ticket was filed over had parent pid 1, since a server's parent
 * changes the moment its starter dies, and a check that listed this process's
 * children would miss exactly them. Nor by its port: Next stops listening when
 * it is signalled and exits only after its cleanup, so a free port can come
 * before the process has gone.
 *
 * POLLED RATHER THAN READ ONCE, because closing a server signals it and does
 * not wait (`theBuildServing` says why). A server that was signalled is gone
 * within seconds; one that was not is still running when the poll gives up.
 *
 * ON A DATABASE OF ITS OWN, `leak`, because a server start is not a read. The
 * scheduler starts with every server (ADR-0049) and closes whatever runs it
 * finds open, so pointed at `web` it could close the run `tasks-page.test.ts`
 * is in the middle of.
 *
 * ONE SERVER A CASE, AND THAT IS A BUDGET RATHER THAN A PREFERENCE. Each case
 * started two until it was measured: a server holds all four of its
 * connections while it answers, so the pair put the whole suite's peak at 75,
 * and ADR-0104's ceiling of four agents is 288 over that peak, floored. The
 * dispatcher chose one on 2026-09-19. What "every" adds is the stack's own
 * contract -- each server goes on it the same way, and it closes all it holds
 * -- and ADR-0103 records the real setup closing three.
 */
describe("a setup that starts servers", () => {
  it(
    "closes the server it had started when it throws part-way, then throws what it threw",
    async () => {
      const failure = new Error("the setup failed after its server started");
      let pid: number | undefined;

      await expect(
        settingUp(async (owned) => {
          ({ pid } = await theBuildServing(owned, env));
          // THE CHECK BELOW CAN FAIL: the server is running at the moment of the throw.
          expect(running(pid)).toBe(true);
          throw failure;
        }),
      ).rejects.toBe(failure);

      await expect.poll(() => running(pid), { timeout: STOPPING_MS }).toBe(false);
    },
    ONE_SERVER_MS,
  );

  it(
    "leaves its server running past its own return, until the teardown it hands back",
    async () => {
      let pid: number | undefined;

      const teardown = await settingUp(async (owned) => {
        ({ pid } = await theBuildServing(owned, env));
      });
      expect(running(pid)).toBe(true);

      await teardown();

      await expect.poll(() => running(pid), { timeout: STOPPING_MS }).toBe(false);
    },
    ONE_SERVER_MS,
  );
});

/**
 * A SERVER'S PORT, AND ANOTHER PROCESS THAT WANTS IT (CNCORE-235).
 *
 * THE HARNESS USED TO CHOOSE A PORT AND THEN HAND IT OVER. A probe bound one,
 * read its number and closed, and the number went to `next start`; from that
 * close until Next's own bind the port was free to anybody. On 2026-09-19, with
 * another worktree's suite running beside this one, something took it and the
 * server died on `EADDRINUSE` before it answered. The rerun passed, which is
 * what this defect looks like from outside.
 *
 * SO THE THIEF STRIKES AT THE WORST MOMENT THERE IS rather than waiting for a
 * busy machine to supply one: just before the server's process starts, it binds
 * whatever port that process was told to bind, where it would bind it. It is the
 * real `spawn` and a real server either way; only the order is forced. The
 * dispatcher chose this seam on 2026-09-19 as the one that holds both of the
 * ticket's causes.
 */
describe("a server whose port another process wants", () => {
  it(
    "starts even when another process takes, just before it binds, any port it was told to use",
    async () => {
      await using owned = new AsyncDisposableStack();
      aPortThief(owned);

      const { baseUrl } = await theBuildServing(owned, env);

      expect((await fetch(baseUrl)).status).toBeLessThan(500);
    },
    ONE_SERVER_MS,
  );

  /**
   * AND ONCE IT HAS BOUND, THE ADDRESS THE HARNESS REACHES IT AT IS ITS OWN.
   * The harness reaches every server at `127.0.0.1`, and a server bound to every
   * address instead leaves that exact one open to another listener -- which, on
   * the Mac four agents share, then answers the harness in the server's place,
   * because a connection goes to the most specific address bound. Measured on
   * 2026-09-19 with two listeners and one port, whichever bound first.
   */
  it(
    "holds the address the harness reaches it at, so nothing else can listen there while it runs",
    async () => {
      await using owned = new AsyncDisposableStack();
      const { baseUrl } = await theBuildServing(owned, env);
      const { hostname, port } = new URL(baseUrl);

      await expect(anotherListener(owned, Number(port), hostname)).rejects.toMatchObject({
        code: "EADDRINUSE",
      });
    },
    ONE_SERVER_MS,
  );
});

/**
 * ARMS THE NEXT `spawn` WITH ANOTHER PROCESS'S BIND. Whatever port the command
 * names -- `--port` or `-p`, or `PORT` in its environment, the three places
 * `next start` reads one -- this process binds before the real `spawn` runs, on
 * the host the command names or on Node's default without one, which is exactly
 * where the server would bind it. A port of 0 names nothing, so it takes nothing.
 * What it holds goes on `owned`.
 *
 * BOUND BEFORE THE SERVER HAS LOADED NODE, let alone Next: with no host the bind
 * is synchronous, and with one it waits only on the lookup's next tick.
 */
function aPortThief(owned: AsyncDisposableStack): void {
  const real = vi.mocked(spawn).getMockImplementation();
  if (real === undefined) throw new Error("`spawn` is not the wrapper `vi.mock` installs above");
  vi.mocked(spawn).mockImplementationOnce((command, args, options) => {
    const port = Number(named(args, "--port", "-p") ?? options.env?.PORT ?? 0);
    if (port !== 0) void anotherListener(owned, port, named(args, "--hostname", "-H"));
    return real(command, args, options);
  });
}

/**
 * A LISTENER THAT IS NOT THE SERVER, on this port and host, or on Node's default
 * address without one. It hangs up on whatever connects, so nothing mistakes it
 * for an app that answered. Settles once it is listening, or on why it could not;
 * either way it is closed with `owned`.
 */
function anotherListener(owned: AsyncDisposableStack, port: number, host?: string): Promise<void> {
  const other = createServer((socket) => socket.destroy());
  owned.defer(() => new Promise<void>((resolve) => other.close(() => resolve())));
  return new Promise((resolve, reject) => {
    other.once("error", reject);
    other.listen(port, host, resolve);
  });
}

/** The value a command line gives an option, under either of its spellings. */
function named(args: readonly string[], long: string, short: string): string | undefined {
  const at = args.findIndex((arg) => arg === long || arg === short);
  return at === -1 ? undefined : args[at + 1];
}

/**
 * HOW LONG A SIGNALLED SERVER MAY TAKE TO BE GONE. Eleven stopped one after
 * another took at most 3107ms on 2026-09-19, so one takes less; five times that
 * is room for a slow runner, and a server nobody signalled is still running at
 * the end of it.
 */
const STOPPING_MS = 15_000;

/**
 * ONE SERVER, allowed the minute `waitUntilAnswering` gives it, and the stopping
 * on top. A server answers in a second or two here; the ceiling is for a slow
 * runner, not the expected case.
 */
const ONE_SERVER_MS = 60_000 + STOPPING_MS;

/** Whether the process with this pid is still running, whoever its parent is now. */
function running(pid: number | undefined): boolean {
  if (pid === undefined) throw new Error("that server was never given a pid");
  try {
    process.kill(pid, 0);
    return true;
  } catch (cause) {
    if ((cause as { code?: unknown }).code === "ESRCH") return false;
    throw cause;
  }
}
