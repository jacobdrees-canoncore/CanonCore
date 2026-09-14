import { createServer, type Server } from "node:http";
import { writeProviderSettings } from "@canoncore/db";
import { connect } from "@canoncore/db/testing/catalogue";
import { env } from "@canoncore/env/server";
import { call, createRouterClient } from "@orpc/server";
import { afterAll, describe, expect, it } from "vitest";

import { createContext } from "./context";
import { importContainerList, theContainerIdsIn } from "./import-list";
import { appRouter } from "./routers";

/**
 * ADR-0103's FIRST SEAM over its SECOND. `importContainerList` is a package
 * export and it is driven here as one; what stands behind it is the real router,
 * called in the same process, with the real `createContext` -- so a change to
 * what a request carries reaches this file rather than a hand-made client
 * agreeing with itself forever.
 *
 * THE PROVIDER IS A REAL SOCKET, for the reason `provider.test.ts` gives: a
 * client that pins a connection and judges a redirect does none of that against
 * an intercepted fetch. It is a stub of this file's own because what this file
 * asks a Provider is not what that one asks. That one asks what a Provider SAYS;
 * this one asks HOW MANY QUESTIONS IT WAS ASKED AT ONCE, which is a fact about
 * the requests rather than about the answers, and no shape of answer can
 * witness it.
 */
const LOOPBACK = "127.0.0.0/8";

await writeProviderSettings(await connect(), {
  providerAllowlist: LOOPBACK,
  // BOTH SETTINGS, NOT ONLY THE ONE THIS FILE READS. One row holds the pair
  // (migration 16) and the suite's files share one database, so a file setting
  // only the allowlist inherits whatever Providers another file last named.
  providerUrls: "",
});

const password = env.OWNER_PASSWORD;
if (password === undefined) {
  throw new Error("this suite's vitest.config.ts sets OWNER_PASSWORD, and it is not set");
}
const { token } = await call(
  appRouter.session.logIn,
  { password },
  { context: await createContext() },
);

/**
 * THE APP AS THE DRIVER SEES IT. `createRouterClient` is ADR-0103's second seam
 * -- the router called in-process, no HTTP and no Next boot -- and the driver
 * takes exactly this type, so what the script builds over RPC and what this
 * file builds in memory are the same interface.
 */
const client = createRouterClient(appRouter, {
  context: async () => createContext({ sessionToken: token }),
});

const servers: Server[] = [];

/**
 * AT THE END OF THE FILE RATHER THAN OF EACH TEST, because a stub's port is the
 * Provider's IDENTITY (ADR-0031) and the rows keyed on it outlive the test that
 * wrote them.
 */
afterAll(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

/** What one Container of this stub's corpus looks like: a Container and one member. */
const aContainerOf = (id: string) => ({
  container: {
    id,
    title: `Theory:Timeline ${id}`,
    kind: "category",
    released: [],
    writers: [],
    series: null,
    url: `https://tardis.wiki/wiki/Theory:Timeline_${id}`,
  },
  ordering: [
    {
      position: 1,
      record: {
        id: `${id}-1`,
        title: `A story in ${id}`,
        kind: "TV story",
        released: ["1966-10-08"],
        writers: [],
        series: null,
        url: `https://tardis.wiki/wiki/story_${id}`,
      },
    },
  ],
  unplaced: [],
});

/**
 * A Provider that holds these Containers, and COUNTS HOW MANY QUESTIONS IT IS
 * ANSWERING AT ONCE.
 *
 * WHY IT IS SLOW ON PURPOSE. A concurrency counter over instant answers proves
 * nothing: two requests that never overlap in time look identical to two that
 * were never made together. The delay is what gives an overlapping caller
 * somewhere to overlap, and it is the shape of the real thing -- `provider-wiki`
 * takes 43.8s over the largest Ordering, which is why two at once were measured
 * at 49.1s each against 25.5s alone (2026-09-13).
 */
async function aStubProviderCounting(
  ids: string[],
  counted: { atOnce: number; inFlight: number },
  { operations = ["search", "lookup", "browse"] } = {},
) {
  const containers = new Map(ids.map((id) => [id, aContainerOf(id)]));
  const server = createServer((request, response) => {
    counted.inFlight += 1;
    counted.atOnce = Math.max(counted.atOnce, counted.inFlight);
    const answer = (body: unknown, status = 200) => {
      setTimeout(() => {
        counted.inFlight -= 1;
        response.writeHead(status, { "content-type": "application/json" });
        response.end(JSON.stringify(body));
      }, 15);
    };
    const path = request.url ?? "/";
    if (path === "/") {
      return answer({
        name: "provider-wiki",
        versions: [1],
        operations,
        max_cache_age: 2592000,
        images: { stored_variant: null, per_role_limit: 0, quality_floor: 0 },
        attribution: null,
      });
    }
    if (path.startsWith("/browse/")) {
      const id = path.slice("/browse/".length);
      const held = containers.get(id);
      return held ? answer(held) : answer({ error: "no such container" }, 404);
    }
    return answer({ error: "no such record" }, 404);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) throw new Error("no port");
  return `http://127.0.0.1:${address.port}`;
}

const counting = () => ({ atOnce: 0, inFlight: 0 });

describe("importContainerList", () => {
  it("imports every Container of the list in one run, in the order the Owner listed them", async () => {
    const counted = counting();
    // NOT ALPHABETICAL, so a walk that lost the Owner's order and fell back on
    // the ids would answer these the other way round.
    const containerIds = ["402219", "226288", "105893"];
    const baseUrl = await aStubProviderCounting(containerIds, counted);

    const stepped: string[] = [];
    await importContainerList(
      client,
      { baseUrl, containerIds },
      { onStepped: (step) => stepped.push(step.containerId) },
    );

    expect(stepped).toEqual(containerIds);
  });

  /**
   * CNCORE-166'S LAST CRITERION, AND THE ONE THE SPEC MEASURED. `provider-wiki`
   * is one Node process: two concurrent browses of the largest Ordering took
   * 49.1s each against 25.5s alone (2026-09-13), so parallelism here is slower
   * as well as ruder. This counts what the PROVIDER saw rather than what the
   * driver intended, which is the only side of that question a Provider has.
   */
  it("never asks the Provider two questions at once", async () => {
    const counted = counting();
    const containerIds = ["402219", "226288", "105893"];
    const baseUrl = await aStubProviderCounting(containerIds, counted);

    await importContainerList(client, { baseUrl, containerIds });

    expect(counted.atOnce).toBe(1);
  });

  it("answers what landed and what refused, with the reason each refusal carried", async () => {
    const counted = counting();
    const baseUrl = await aStubProviderCounting(["402219"], counted);

    const report = await importContainerList(client, {
      baseUrl,
      containerIds: ["402219", "999999"],
    });

    expect(report.containers).toEqual([
      { containerId: "402219", outcome: "landed", placements: 1, quarantinedValues: 0 },
      {
        containerId: "999999",
        outcome: "refused",
        reason: { wrote: "canoncore", text: expect.stringContaining("999999") },
      },
    ]);
  });

  /**
   * THE WHOLE POINT OF A RUN BEING ROWS. A walk of 465 Containers is about five
   * and a half hours, and what interrupts it is ordinary: ADR-0122's Credential
   * lapses within a day. Handing the same list over again has to cost the
   * remainder rather than the whole.
   */
  it("carries on where a stopped run stopped, rather than importing what already landed again", async () => {
    const counted = counting();
    const containerIds = ["402219", "226288"];
    const baseUrl = await aStubProviderCounting(containerIds, counted);

    // A RUN STOPPED PARTWAY, which is what a killed process leaves behind: the
    // first Container landed and the second was never asked for.
    const { runId } = await client.provider.beginImportRun({ baseUrl, containerIds });
    await client.provider.importNextContainer({ runId });

    const askedAgain: string[] = [];
    const report = await importContainerList(
      client,
      { baseUrl, containerIds },
      { onStepped: (step) => askedAgain.push(step.containerId) },
    );

    expect(askedAgain).toEqual(["226288"]);
    expect(report.runId).toBe(runId);
    expect(report.containers.map((container) => container.outcome)).toEqual(["landed", "landed"]);
  });

  /**
   * A RE-IMPORT REFRESHES RATHER THAN DOUBLING, which ADR-0026 and ADR-0078
   * already guarantee one layer down: a second browse finds the Container and
   * every member by the ids the Provider knows them by. What this asserts is
   * that the run does not stand in the way of it -- a finished run is history,
   * and the same list handed over again really does import again.
   */
  it("leaves the catalogue as the first run left it when the same list runs twice", async () => {
    const counted = counting();
    const containerIds = ["402219"];
    const baseUrl = await aStubProviderCounting(containerIds, counted);

    const first = await importContainerList(client, { baseUrl, containerIds });
    const stepped: string[] = [];
    const second = await importContainerList(
      client,
      { baseUrl, containerIds },
      { onStepped: (step) => stepped.push(step.containerId) },
    );

    // It really ran again rather than finding nothing to do.
    expect(stepped).toEqual(["402219"]);
    expect(second.runId).not.toBe(first.runId);
    // And the Container the second run wrote is the one the first run wrote.
    const landedIn = (report: Awaited<ReturnType<typeof importContainerList>>) =>
      report.containers.flatMap((container) =>
        container.outcome === "landed" ? [container.placements] : [],
      );
    expect(landedIn(second)).toEqual(landedIn(first));
    const held = await client.provider.held({ baseUrl, recordIds: containerIds });
    expect(held.items).toHaveLength(1);
  });

  it("says what it is carrying on with, so a resumed run is not a silent one", async () => {
    const counted = counting();
    const containerIds = ["402219", "226288"];
    const baseUrl = await aStubProviderCounting(containerIds, counted);
    const { runId } = await client.provider.beginImportRun({ baseUrl, containerIds });
    await client.provider.importNextContainer({ runId });

    let opened: { runId: string; landed: number; toAskFor: number } | undefined;
    await importContainerList(
      client,
      { baseUrl, containerIds },
      { onOpened: (run) => (opened = run) },
    );

    expect(opened).toEqual({ runId, landed: 1, toAskFor: 1 });
  });
});

/**
 * WHERE A FIVE-AND-A-HALF-HOUR MISTAKE WOULD HIDE. A run is resumed by matching
 * the list it is walking, so a reader that answered a different list for the
 * same file -- one trailing blank line, one stray space -- would not resume: it
 * would silently open a SECOND run over all 465 Containers and browse every one
 * of them again. That is why this is a tested function rather than three lines
 * inside a script.
 */
describe("theContainerIdsIn", () => {
  it("takes one Container id a line", () => {
    expect(theContainerIdsIn("249643\n105893\n226288")).toEqual(["249643", "105893", "226288"]);
  });

  it("reads a file the same way however it ends, so a resume still recognises its list", () => {
    expect(theContainerIdsIn("249643\n105893\n")).toEqual(theContainerIdsIn("249643\n105893"));
  });

  it("ignores blank lines and surrounding space, which is what a hand-edited list has in it", () => {
    expect(theContainerIdsIn("  249643  \n\n\t105893\n   \n")).toEqual(["249643", "105893"]);
  });

  /**
   * A LIST OF 465 IDS IS UNREADABLE WITHOUT THEM. The ids are the Provider's
   * own, so the only way to tell one line from another is a note beside it.
   */
  it("ignores a commented line, so a list can say what its ids are", () => {
    expect(theContainerIdsIn("# the Doctor Who corpus\n249643 \n# and the rest")).toEqual([
      "249643",
    ]);
  });

  it("reads a file that carries Windows line endings", () => {
    expect(theContainerIdsIn("249643\r\n105893\r\n")).toEqual(["249643", "105893"]);
  });
});
