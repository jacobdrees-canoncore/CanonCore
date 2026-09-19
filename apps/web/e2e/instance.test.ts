import { connect } from "node:net";
import { buildTestDatabase } from "@canoncore/db/testing/build-database";
import { beforeAll, describe, expect, it } from "vitest";
import { SERVER_CONNECTIONS, settingUp, theBuildServing, theServerEnvironment } from "./instance";

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
 * A SETUP THAT STARTS SERVERS, AND WHAT BECOMES OF THEM (CNCORE-229).
 *
 * THIS ONE DOES STAND SERVERS UP, where the block above refuses to, because
 * the claim is about a PROCESS. A `next start` does not end when the process
 * that started it does, and one left running holds the output pipe it
 * inherited open, so a CI step reading that pipe never ends: ADR-0141's hang,
 * reached through `settingUp` rather than around it. A stand-in whose `close`
 * recorded a call would pass while the real server went on listening.
 *
 * A SURVIVOR IS FOUND BY ITS PORT, not by being a child of this process. The
 * orphans this ticket was filed over had parent pid 1, since a server's parent
 * changes the moment its starter dies, and a check that listed this process's
 * children would miss exactly them. A port is the server's own: while
 * anything still listens on one, the server is not gone.
 *
 * ON A DATABASE OF ITS OWN, `leak`, because a server start is not a read. The
 * scheduler starts with every server (ADR-0049) and closes whatever runs it
 * finds open, so pointed at `web` it could close the run `tasks-page.test.ts`
 * is in the middle of.
 */
describe("a setup that starts servers", () => {
  let env: NodeJS.ProcessEnv;

  beforeAll(async () => {
    env = { ...process.env, DATABASE_URL: await buildTestDatabase("leak"), OWNER_PASSWORD: "" };
  });

  it(
    "closes every server it had started when it throws part-way, then throws what it threw",
    async () => {
      const failure = new Error("the setup failed after its second server");
      const started: string[] = [];

      await expect(
        settingUp(async (owned) => {
          started.push((await theBuildServing(owned, env)).baseUrl);
          started.push((await theBuildServing(owned, env)).baseUrl);
          // THE CHECK BELOW CAN FAIL: both are listening at the moment of the throw.
          expect(await listeningOn(started)).toEqual([true, true]);
          throw failure;
        }),
      ).rejects.toBe(failure);

      expect(await listeningOn(started)).toEqual([false, false]);
    },
    TWO_SERVERS_MS,
  );

  it(
    "leaves its servers running past its own return, until the teardown it hands back",
    async () => {
      const started: string[] = [];

      const teardown = await settingUp(async (owned) => {
        started.push((await theBuildServing(owned, env)).baseUrl);
        started.push((await theBuildServing(owned, env)).baseUrl);
      });
      expect(await listeningOn(started)).toEqual([true, true]);

      await teardown();

      expect(await listeningOn(started)).toEqual([false, false]);
    },
    TWO_SERVERS_MS,
  );
});

/**
 * TWO SERVERS, each allowed the minute `waitUntilAnswering` gives one, and the
 * closing on top. A server answers in a second or two here; the ceiling is for
 * a slow runner, not the expected case.
 */
const TWO_SERVERS_MS = 2 * 60_000 + 10_000;

/** Whether anything accepts a connection on each server's port. */
function listeningOn(baseUrls: string[]): Promise<boolean[]> {
  return Promise.all(
    baseUrls.map((baseUrl) => {
      const { hostname, port } = new URL(baseUrl);
      return new Promise<boolean>((resolve) => {
        const socket = connect(Number(port), hostname);
        socket.once("connect", () => {
          socket.destroy();
          resolve(true);
        });
        socket.once("error", () => resolve(false));
      });
    }),
  );
}
