import { createServer, type Server } from "node:http";
import { type Database, items, sources } from "@canoncore/db";
import { connect } from "@canoncore/db/testing/catalogue";
import { env } from "@canoncore/env/server";
import { parseAllowlist, REASON_MAX_LENGTH } from "@canoncore/providers";
import { call, isDefinedError, safe } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createContext } from "../context";
import { appRouter } from "./index";

/**
 * ADR-0103's second seam again, with a REAL provider socket behind it.
 *
 * The provider is stubbed rather than mocked: a client that pins a connection
 * and judges a redirect does none of that against an intercepted fetch, and the
 * loopback address here is the one CanonCore's CI reaches the real provider on.
 * What the real image adds over this is the fixture's own data, and that is the
 * CI job's to prove rather than this suite's.
 */
/**
 * THE OWNER'S CONTEXT, because most of what this file drives WRITES: `import`,
 * `browse` and `purge` are behind `ownerProcedure` since CNCORE-109, and a
 * caller with no session is refused before it reaches any of the behaviour
 * asserted below.
 *
 * IT LOGS IN THROUGH THE ROUTER rather than assembling a session object, so the
 * context these tests run on is the one a real caller gets. A hand-made session
 * would keep passing on the day the shape of one changes, which is the day it
 * would matter most.
 */
const context = await createContext({ sessionToken: await aTokenForTheOwner() });

async function aTokenForTheOwner(): Promise<string> {
  const password = env.OWNER_PASSWORD;
  if (password === undefined) {
    throw new Error("this suite's vitest.config.ts sets OWNER_PASSWORD, and it is not set");
  }
  const { token } = await call(
    appRouter.session.logIn,
    { password },
    { context: await createContext() },
  );
  return token;
}

let db: Database;

beforeAll(async () => {
  db = await connect();
});

const servers: Server[] = [];

/**
 * AT THE END OF THE FILE RATHER THAN OF EACH TEST, because a stub's port is the
 * provider's IDENTITY (ADR-0031) and the rows keyed on it live as long as the
 * database does -- which here is the whole run. Closing after each test hands
 * the port back to the OS with those rows still standing, and the next stub to
 * be given it inherits them. The describe below is what holds this here.
 */
afterAll(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

const MANIFEST = {
  name: "provider-wiki",
  versions: [1],
  operations: ["search", "lookup"],
  max_cache_age: 2592000,
  images: { stored_variant: null, per_role_limit: 0, quality_floor: 0 },
};

/** Page 265 of ADR-0057's fixture, as the wiki provider answers it. */
const TENTH_PLANET = {
  id: "265",
  title: "The Tenth Planet (TV story)",
  kind: "TV story",
  released: ["1966-10-08"],
  writers: ["Gerry Davis", "Kit Pedler"],
  series: "Doctor Who television stories",
  url: "https://tardis.wiki/wiki/The_Tenth_Planet_(TV_story)",
};

/**
 * `Category:Vashta Nerada audio stories` (388305), as the wiki provider answers
 * a browse of it. Night and Day share position 1: two halves of one box set,
 * both dated 2017-07-27, and the archive orders neither ahead of the other.
 */
const VASHTA_NERADA = {
  container: {
    id: "388305",
    title: "Category:Vashta Nerada audio stories",
    kind: "category",
    released: [],
    writers: [],
    series: null,
    url: "https://tardis.wiki/wiki/Category:Vashta_Nerada_audio_stories",
  },
  ordering: [
    {
      position: 1,
      record: {
        id: "222467",
        title: "Night of the Vashta Nerada (audio story)",
        kind: "audio story",
        released: ["2017-07-27"],
        writers: ["John Dorney"],
        series: null,
        url: "https://tardis.wiki/wiki/Night_of_the_Vashta_Nerada_(audio_story)",
      },
    },
    {
      position: 1,
      record: {
        id: "222478",
        title: "Day of the Vashta Nerada (audio story)",
        kind: "audio story",
        released: ["2017-07-27"],
        writers: ["John Dorney"],
        series: null,
        url: "https://tardis.wiki/wiki/Day_of_the_Vashta_Nerada_(audio_story)",
      },
    },
  ],
  unplaced: [],
};

/**
 * What a source whose licence obliges the app to show something declares. TMDB's
 * notice verbatim; the mark is a one-pixel GIF, because what this suite asks is
 * whether the obligation reaches the catalogue, and whether the real bytes are
 * TMDB's mark is the contract test's question of the real provider.
 */
const ATTRIBUTION = {
  notice:
    "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
  logo: {
    data_uri: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
    alt: "The Movie Database (TMDB). TMDB does not endorse, certify or approve this application.",
  },
};

async function stubProvider(
  records: Record<string, unknown> = { "265": TENTH_PLANET },
  {
    operations = ["search", "lookup", "browse"],
    containers = { "388305": VASHTA_NERADA } as Record<string, unknown>,
    attribution = null as typeof ATTRIBUTION | null,
    /**
     * Every path this provider was asked for, in order, for a caller that needs
     * to assert what was NOT asked.
     *
     * ADR-0033 makes `browse` the operation a provider may decline, and
     * "declines it and is therefore not asked" is a claim about a request that
     * never happened -- which an answer cannot witness. A provider that answered
     * 404 on `/browse/...` and one that was never called produce the same value
     * at every other seam.
     */
    asked = [] as string[],
  } = {},
) {
  const server = createServer((request, response) => {
    const json = (body: unknown, status = 200) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    const path = request.url ?? "/";
    asked.push(path);
    if (path === "/") return json({ ...MANIFEST, operations, attribution });
    // `search`, MATCHED ON THE TITLE, which is the least a stub can do and still
    // be a search: a stub answering every query with everything could not tell a
    // query that found something from one that found nothing. A missing or empty
    // `q` is a `400` because that is the reading ADR-0033 settled under CNCORE-33
    // and both real providers answer it.
    if (path.startsWith("/search")) {
      const query = new URL(path, "http://provider.test").searchParams.get("q") ?? "";
      if (query.trim() === "") return json({ error: "a query is required" }, 400);
      const matching = Object.values(records).filter((record) =>
        String((record as { title: string }).title)
          .toLowerCase()
          .includes(query.toLowerCase()),
      );
      return json({ results: matching });
    }
    // `Object.hasOwn` rather than a bare index on both: the id is a path segment
    // the caller writes, and `/browse/constructor` otherwise finds `Object` on
    // the prototype and answers 200 with a body of `undefined`.
    if (path.startsWith("/browse/")) {
      const id = path.slice("/browse/".length);
      return Object.hasOwn(containers, id)
        ? json(containers[id])
        : json({ error: "no such container" }, 404);
    }
    const id = path.startsWith("/lookup/") ? path.slice("/lookup/".length) : null;
    return id !== null && Object.hasOwn(records, id)
      ? json(records[id])
      : json({ error: "no such record" }, 404);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) throw new Error("no port");
  return `http://127.0.0.1:${address.port}`;
}

/**
 * WHAT EVERY ASSERTION BELOW RESTS ON, asserted before any of them.
 *
 * A stub's base URL is not only where it listens. It is the PROVIDER'S IDENTITY
 * (ADR-0031), and every row an import writes is keyed on it -- so the identity
 * outlives the test that minted it, in a database this whole file shares. A
 * socket closed at the end of a test hands its port back to the OS while those
 * rows are still there, and the OS may hand that port to the next stub: two
 * tests then share one provider, and the earlier one's imports answer the
 * later one's lookups.
 *
 * SO THE SOCKET LIVES AS LONG AS THE IDENTITY DOES, which is the file. That is
 * not thrift about teardown, it is what makes two stubs two providers: no two
 * live listeners can hold one port, so no two stubs can mint one identity.
 *
 * MEASURED, NOT IMAGINED. Run 34711644736 ATTEMPT 1 read an Item's uuid where
 * `provider.search` asserts none is held yet, on a branch whose whole diff was
 * one Markdown file (CNCORE-126). The attempt is the half that matters: the
 * re-run passed, so the run itself now reads `success`.
 *
 * IT TAKES TWO TESTS TO SAY, and that is the claim rather than a smell: what
 * survives the END of a test is not something a single test can observe. They
 * run in order and the second reads what the first minted, so neither is worth
 * running alone.
 */
describe("a stub provider's identity", () => {
  let identity: string | undefined;

  /** ONE CHECK, so the only difference between the two tests is WHEN it runs. */
  async function answersASearch(baseUrl: string): Promise<void> {
    const { answered, failed } = await call(
      appRouter.provider.search,
      { query: "tenth planet" },
      { context: { ...context, providerUrls: [baseUrl] } },
    );

    expect(failed).toEqual([]);
    expect(answered.map(({ provider }) => provider.baseUrl)).toEqual([baseUrl]);
  }

  it("answers the search made by the test that minted it", async () => {
    identity = await stubProvider();

    await answersASearch(identity);
  });

  it("answers the next test's search too, so the OS cannot hand its port on", async () => {
    // SAID OUT LOUD RATHER THAN LET THROUGH. Run alone -- under `-t`, or an
    // `.only` on this one -- the test above never minted, and an `undefined`
    // reaches the router as a provider URL and comes back `fetch failed`: the
    // same words a socket closed too early produces, which is the one failure
    // this pair exists to tell apart from everything else.
    if (identity === undefined) {
      throw new Error("the test above mints this identity; the two run in order, neither alone");
    }

    await answersASearch(identity);
  });
});

describe("provider.import", () => {
  it("imports one record over HTTP and answers with the item it wrote", async () => {
    const baseUrl = await stubProvider();

    const { itemId } = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "265" },
      { context },
    );

    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    expect(item?.title).toBe("The Tenth Planet (TV story)");
    expect(item?.kind).toBe("work");
  });

  /**
   * The point of the whole slice, read back through the read path rather than
   * off the rows: what the page will render says the provider said it.
   */
  it("records the provider as the source of every imported value", async () => {
    const baseUrl = await stubProvider();

    const { itemId } = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "265" },
      { context },
    );
    const item = await call(appRouter.item.get, { id: itemId }, { context });

    expect(item.statements).toEqual([
      // The provider's OWN id for this record, which is what finds the item
      // again on a second import (CNCORE-28, migration 3). It is a value the
      // provider claimed, so it reaches a reader with its source attached
      // exactly as the title does -- and ADR-0045 is not breached by it: the
      // read path emits no INTERNAL id, and this one is the provider's, public
      // and already in the URL the owner typed.
      {
        property: "external_id",
        value: "265",
        sourceKind: "provider",
        sourceLabel: "provider-wiki",
      },
      {
        property: "released",
        value: "1966-10-08",
        sourceKind: "provider",
        sourceLabel: "provider-wiki",
      },
      {
        property: "title",
        value: "The Tenth Planet (TV story)",
        sourceKind: "provider",
        sourceLabel: "provider-wiki",
      },
    ]);
  });

  /**
   * The label is the provider's OWN name, from its manifest, rather than the
   * URL the owner happened to type. A reader seeing "provider-wiki" is being
   * told who said it; a reader seeing "http://127.0.0.1:39481" is being shown
   * a deployment detail.
   */
  it("labels the source with the name the provider declares for itself", async () => {
    const baseUrl = await stubProvider();

    const { itemId } = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "265" },
      { context },
    );
    const item = await call(appRouter.item.get, { id: itemId }, { context });

    expect(item.statements[0]?.sourceLabel).toBe("provider-wiki");
  });

  it("reports an id the provider does not hold as a missing record", async () => {
    const baseUrl = await stubProvider();

    const { error } = await safe(
      call(appRouter.provider.import, { baseUrl, recordId: "9999" }, { context }),
    );

    if (!isDefinedError(error)) throw new Error(`expected a defined error, got ${String(error)}`);
    expect(error.code).toBe("NO_SUCH_RECORD");
  });

  /**
   * ADR-0034's config boundary, reached through the router: a base URL the
   * owner never allowlisted is refused as a REFUSED error a caller can narrow
   * on, not as a 500. The owner typed the URL, so the answer has to be
   * something a UI can put in front of them.
   */
  it("refuses a base URL that is not on the allowlist", async () => {
    const { error } = await safe(
      call(
        appRouter.provider.import,
        { baseUrl: "http://169.254.169.254/", recordId: "265" },
        { context },
      ),
    );

    if (!isDefinedError(error)) throw new Error(`expected a defined error, got ${String(error)}`);
    expect(error.code).toBe("PROVIDER_REFUSED");
  });

  it("refuses a provider that redirects onto the metadata endpoint", async () => {
    const server = createServer((_, response) => {
      response.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
      response.end();
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address === "string" || address === null) throw new Error("no port");

    const { error } = await safe(
      call(
        appRouter.provider.import,
        { baseUrl: `http://127.0.0.1:${address.port}`, recordId: "265" },
        { context },
      ),
    );

    if (!isDefinedError(error)) throw new Error(`expected a defined error, got ${String(error)}`);
    expect(error.code).toBe("PROVIDER_REFUSED");
  });
});

describe("provider.browse", () => {
  it("imports a container and its whole ordering in one call", async () => {
    // ADR-0033: `browse` returns a container AND its ordering together, so
    // browsing yields placements for free. That is the whole reason it exists,
    // and for a source with no public API it is the only viable bulk path.
    const baseUrl = await stubProvider();

    const { containerId } = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: "388305" },
      { context },
    );
    const container = await call(appRouter.item.get, { id: containerId }, { context });

    expect(container.title).toBe("Category:Vashta Nerada audio stories");
    expect(container.isContainer).toBe(true);
    expect(container.isOrdered).toBe(true);
  });

  it("records the provider as having asserted every placement it wrote", async () => {
    // ADR-0017: an ordering is a DATED CLAIM BY A NAMED SOURCE rather than a
    // neutral fact, so a placement written without one is a claim nobody made.
    const baseUrl = await stubProvider();

    const { placements } = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: "388305" },
      { context },
    );

    expect(placements).toHaveLength(2);
    for (const placement of placements) {
      const item = await call(appRouter.item.get, { id: placement.itemId }, { context });
      expect(item.placements.entries).toEqual([
        expect.objectContaining({ position: 1, placedBy: "provider" }),
      ]);
    }
  });

  /**
   * ADR-0033 makes `browse` OPTIONAL AND DECLARED, and the declaration is what
   * the app reads to decide whether to call at all. A provider that offers only
   * `search` and `lookup` still works -- everything else it does is untouched --
   * and this operation is refused without a request ever leaving the app.
   */
  it("does not call a provider that declares no browse, and says why", async () => {
    const baseUrl = await stubProvider(
      { "265": TENTH_PLANET },
      { operations: ["search", "lookup"] },
    );

    const { error } = await safe(
      call(appRouter.provider.browse, { baseUrl, containerId: "388305" }, { context }),
    );

    if (!isDefinedError(error)) throw new Error(`expected a defined error, got ${String(error)}`);
    expect(error.code).toBe("BROWSE_NOT_OFFERED");
  });

  it("goes on importing one record from a provider that declares no browse", async () => {
    // The other half of "still works", and the half that would be easy to
    // break: gating browse on the manifest must not gate anything else on it.
    const baseUrl = await stubProvider(
      { "265": TENTH_PLANET },
      { operations: ["search", "lookup"] },
    );

    const { itemId } = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "265" },
      { context },
    );

    const item = await call(appRouter.item.get, { id: itemId }, { context });
    expect(item.title).toBe("The Tenth Planet (TV story)");
  });

  it("reports an id that addresses no container as a missing container", async () => {
    const baseUrl = await stubProvider();

    const { error } = await safe(
      call(appRouter.provider.browse, { baseUrl, containerId: "265" }, { context }),
    );

    if (!isDefinedError(error)) throw new Error(`expected a defined error, got ${String(error)}`);
    expect(error.code).toBe("NO_SUCH_CONTAINER");
  });

  it("refuses a base URL that is not on the allowlist", async () => {
    const { error } = await safe(
      call(
        appRouter.provider.browse,
        { baseUrl: "http://169.254.169.254/", containerId: "388305" },
        { context },
      ),
    );

    if (!isDefinedError(error)) throw new Error(`expected a defined error, got ${String(error)}`);
    expect(error.code).toBe("PROVIDER_REFUSED");
  });
});

/**
 * ADR-0033: "a third party's licence terms stay declared fields rather than
 * special cases in our core", and ADR-0036 is the licence that makes it concrete.
 * The app takes the obligation off the manifest and writes it beside the source
 * that imposed it, so every claim that source made can be traced back to the
 * words the app owes for showing it.
 */
/**
 * CNCORE-29. ADR-0073 says a date is an EDTF string; the wire schema is
 * `z.array(z.string())`, so until now `soon` travelled the whole path and was
 * rendered on the item page verbatim. It is now quarantined at the catalogue's
 * door -- and the operation SAYS SO, because a mark nothing reports is the
 * "silently" half of this ticket left standing.
 */
describe("a provider whose dates are not EDTF", () => {
  it("imports the record and reports the dates it held back", async () => {
    const baseUrl = await stubProvider({
      "265": { ...TENTH_PLANET, released: ["soon", "1966-10-08"] },
    });

    const { itemId, quarantinedValues } = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "265" },
      { context },
    );

    expect(quarantinedValues).toBe(1);
    // The record still arrives: one bad date is not grounds to lose the rest of
    // what the provider said.
    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    expect(item?.title).toBe(TENTH_PLANET.title);
  });

  it("browses the whole container and reports what it held back across it", async () => {
    const container = {
      ...VASHTA_NERADA,
      ordering: [
        VASHTA_NERADA.ordering[0],
        {
          position: 2,
          record: { ...VASHTA_NERADA.ordering[1]!.record, released: ["12/03/66"] },
        },
      ],
    };
    const baseUrl = await stubProvider({}, { containers: { "388305": container } });

    const { placements, quarantinedValues } = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: "388305" },
      { context },
    );

    // Both placements land. Losing the container over one story's date is the
    // trade this ticket exists to refuse.
    expect(placements).toHaveLength(2);
    expect(quarantinedValues).toBe(1);
  });
});

describe("the attribution an import carries with it", () => {
  it("writes what the provider declares onto the source it creates", async () => {
    const baseUrl = await stubProvider(undefined, { attribution: ATTRIBUTION });

    await call(appRouter.provider.import, { baseUrl, recordId: "265" }, { context });

    const [source] = await db.select().from(sources).where(eq(sources.identity, baseUrl));
    expect(source?.attributionNotice).toBe(ATTRIBUTION.notice);
    expect(source?.attributionLogo).toBe(ATTRIBUTION.logo.data_uri);
    expect(source?.attributionLogoAlt).toBe(ATTRIBUTION.logo.alt);
  });

  /** The wiki's case, and the ordinary one: a source that owes nothing. */
  it("leaves a source whose licence obliges nothing carrying nothing", async () => {
    const baseUrl = await stubProvider();

    await call(appRouter.provider.import, { baseUrl, recordId: "265" }, { context });

    const [source] = await db.select().from(sources).where(eq(sources.identity, baseUrl));
    expect(source?.attributionNotice).toBeNull();
    expect(source?.attributionLogo).toBeNull();
  });
});

/**
 * ADR-0036: TMDB's terms end in termination, and termination "requires purging
 * all cached TMDB content". The criterion this satisfies says it is "one delete
 * rather than a feature", which is a claim about the MODEL -- every row that can
 * carry a claim already names who made it -- and this is the one call that proves
 * the claim rather than a subsystem that works around its being false.
 */
describe("provider.purge", () => {
  it("removes everything one provider said, in one call", async () => {
    const baseUrl = await stubProvider(undefined, { attribution: ATTRIBUTION });
    const { containerId } = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: "388305" },
      { context },
    );

    const purged = await call(appRouter.provider.purge, { baseUrl }, { context });

    expect(purged.statements).toBeGreaterThan(0);
    expect(purged.placements).toBe(2);
    // The container the browse wrote is gone, and so is the source row that
    // carried the licence the instance no longer holds.
    expect(await db.select().from(items).where(eq(items.id, containerId))).toEqual([]);
    expect(await db.select().from(sources).where(eq(sources.identity, baseUrl))).toEqual([]);
  });

  /**
   * AN OWNER MAY REASONABLY RUN THIS TWICE, and the second run must not read as a
   * failure. It is also what an owner types when they are not sure whether a
   * provider was ever imported from at all.
   */
  it("answers zero for a provider this catalogue never imported from", async () => {
    const purged = await call(
      appRouter.provider.purge,
      { baseUrl: "http://127.0.0.1:9911" },
      { context },
    );

    // AND NOTHING STAYS EITHER, which is a different zero and worth pinning as
    // one: `keptItems` counts the provider's OWN items that survive, so a
    // provider that never wrote any has none to leave behind (CNCORE-69).
    expect(purged).toEqual({ statements: 0, placements: 0, items: 0, keptItems: 0 });
  });

  /**
   * NO REQUEST LEAVES THE APP. A purge is about rows this catalogue holds, and a
   * provider whose licence has just been terminated is exactly the one that must
   * not be called -- so the base URL is an IDENTITY here rather than an address,
   * and the allowlist has no say in it. That is the opposite of `import`, and it
   * is the reason this procedure declares no PROVIDER_REFUSED.
   */
  it("purges a provider the allowlist would refuse to reach", async () => {
    const baseUrl = await stubProvider(undefined, { attribution: ATTRIBUTION });
    await call(appRouter.provider.import, { baseUrl, recordId: "265" }, { context });

    // The same URL, purged through a context whose allowlist admits nothing.
    const walledOff = { ...context, providerAllowlist: parseAllowlist("") };
    const purged = await call(appRouter.provider.purge, { baseUrl }, { context: walledOff });

    expect(purged.statements).toBeGreaterThan(0);
  });
});

/**
 * ADR-0046 puts counts in front of a permanent delete. `purge` answered them
 * AFTERWARDS, which was not a violation while nothing put a button in front of
 * it -- and this is what whatever does put one there calls first.
 */
describe("provider.previewPurge", () => {
  it("answers what the purge then takes, and takes nothing", async () => {
    const baseUrl = await stubProvider(undefined, { attribution: ATTRIBUTION });
    const { containerId } = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: "388305" },
      { context },
    );

    const preview = await call(appRouter.provider.previewPurge, { baseUrl }, { context });

    // EVERY ROW IS WHERE IT WAS. An owner asking what a purge would cost has not
    // yet decided to pay it.
    expect(await db.select().from(items).where(eq(items.id, containerId))).toHaveLength(1);
    expect(await db.select().from(sources).where(eq(sources.identity, baseUrl))).toHaveLength(1);

    // And what it said would go, goes.
    expect(preview.placements).toBe(2);
    expect(await call(appRouter.provider.purge, { baseUrl }, { context })).toEqual(preview);
  });

  /**
   * NO REQUEST LEAVES THE APP, for the same reason `purge` makes none: the
   * provider whose licence just ended is the one an owner most needs to ask
   * about and the one they can least afford to call. A preview that reached for
   * the provider would fail exactly when it is wanted.
   */
  it("previews a provider the allowlist would refuse to reach", async () => {
    const baseUrl = await stubProvider(undefined, { attribution: ATTRIBUTION });
    await call(appRouter.provider.import, { baseUrl, recordId: "265" }, { context });

    const walledOff = { ...context, providerAllowlist: parseAllowlist("") };
    const preview = await call(
      appRouter.provider.previewPurge,
      { baseUrl },
      { context: walledOff },
    );

    expect(preview.statements).toBeGreaterThan(0);
  });
});

/**
 * ADR-0034's allowlist is empty by default and that refuses every provider, so
 * an unconfigured instance and a broken one look identical from a page: nothing
 * imports, and nothing says why. ADR-0094 names that as a failure in its own
 * right -- "an install that starts empty WITHOUT SAYING WHAT TO DO NEXT" -- and
 * this is the fact a page says it with.
 */
describe("provider.allowlisted", () => {
  it("says an instance whose allowlist names a destination can reach one", async () => {
    // The suite's own configuration, which is the loopback CIDR the stub above
    // is reached on -- so this is the real allowlist rather than a stand-in.
    const answer = await call(appRouter.provider.allowlisted, undefined, { context });

    expect(answer).toStrictEqual({ any: true });
  });

  it("says an instance with the default empty allowlist can reach none", async () => {
    // The DEFAULT, parsed by the real parser: `PROVIDER_ALLOWLIST` unset is the
    // empty string, and the empty string refuses everything.
    const unconfigured = { ...context, providerAllowlist: parseAllowlist("") };

    const answer = await call(appRouter.provider.allowlisted, undefined, {
      context: unconfigured,
    });

    expect(answer).toStrictEqual({ any: false });
  });
});

/**
 * THE FAN-OUT BEHIND A PROCEDURE (ADR-0033, CNCORE-68).
 *
 * `searchProviders` reaches several providers at once and `@canoncore/providers`
 * has had it since CNCORE-77 with a test for its only caller. This is the
 * operation: the owner's query, every configured provider asked, and -- the part
 * neither the fan-out nor the client can answer -- which of the candidates this
 * catalogue already holds.
 */
describe("provider.search", () => {
  it("finds a record by name, with no id known in advance, and says who answered", async () => {
    const baseUrl = await stubProvider();
    const searching = { ...context, providerUrls: [baseUrl] };

    const { answered } = await call(
      appRouter.provider.search,
      { query: "tenth planet" },
      { context: searching },
    );

    // THE PROVIDER'S OWN NAME FOR ITSELF, read off its manifest. A source
    // answers "who said this", and `http://127.0.0.1:39481` shows an owner a
    // deployment detail where `provider-wiki` answers the question.
    expect(answered).toEqual([
      {
        provider: { baseUrl, name: "provider-wiki" },
        results: [
          {
            recordId: "265",
            title: "The Tenth Planet (TV story)",
            kind: "TV story",
            released: ["1966-10-08"],
            url: "https://tardis.wiki/wiki/The_Tenth_Planet_(TV_story)",
            // Nothing has imported it, so there is no Item to reach yet --
            // and "nothing" means nothing under THIS STUB'S IDENTITY, which is
            // its `127.0.0.1:<port>` (ADR-0031) rather than the catalogue as a
            // whole. That is why every stub in this file holds its socket to
            // the end of the file: this line read an Item's uuid in CI when an
            // earlier test's stub had been handed the same port (CNCORE-126).
            itemId: null,
          },
        ],
      },
    ]);
  });

  /**
   * EVERY PROVIDER, AND ONE OF THEM BEING DOWN IS NOT THE SEARCH BEING DOWN.
   *
   * The failure here is a REFUSAL rather than a dead socket, because a refusal is
   * the one that would plausibly be raised as the whole search's error: it is
   * ADR-0034's answer to a URL this instance may not reach, and `import` below
   * quite rightly turns it into a declared error of its own. Raising it here
   * would throw away every other provider's answers because one URL was not
   * allowlisted -- and it would do it non-deterministically, whichever provider
   * lost the race deciding.
   */
  it("answers with what the other providers said when one of them fails", async () => {
    const answering = await stubProvider();
    // A URL this instance may not reach: the suite allowlists loopback by name,
    // and this is a public host that is on no allowlisted entry.
    const refused = "http://provider.invalid";
    const searching = { ...context, providerUrls: [refused, answering] };

    const { answered, failed } = await call(
      appRouter.provider.search,
      { query: "tenth planet" },
      { context: searching },
    );

    expect(answered.map(({ provider: p }) => p.baseUrl)).toEqual([answering]);
    expect(answered[0]?.results.map((r) => r.recordId)).toEqual(["265"]);
    // WHO, AND WHY, rather than a shorter list. A provider that is down and a
    // provider that matched nothing are different answers, and an owner who
    // cannot tell them apart concludes their query was wrong.
    expect(failed).toHaveLength(1);
    expect(failed[0]?.baseUrl).toBe(refused);
    // AND IT IS CANONCORE'S OWN SENTENCE, WHOLE (ADR-0123). ADR-0034's config
    // boundary refused a URL the OWNER typed, so the refusal names the setting
    // only they can change -- it is not a provider's text, it is not cut, and a
    // page does not attribute it to the provider.
    expect(failed[0]?.reason.wrote).toBe("canoncore");
    expect(failed[0]?.reason.text).toContain("not an allowlisted host");
    expect(failed[0]?.reason.text).toContain("a parent domain does not cover it");
  });

  /**
   * AND A CANDIDATE THE CATALOGUE ALREADY HOLDS SAYS WHICH ITEM IT IS.
   *
   * This is the field a page has no other way to get. Without it the surface
   * shows an identical row before and after an import, so nothing reports that
   * the import happened -- and the alternative, redirecting to the new Item,
   * emits a URL Next does not rewrite (ADR-0109; measured on 16.3.4).
   *
   * IT IS ALSO WHAT MAKES "re-importing changes nothing" VISIBLE. The second
   * import answers the same item as the first, so the same row names the same
   * Item rather than a second one.
   */
  it("names the item a candidate is already held as, and the same one on a re-import", async () => {
    const baseUrl = await stubProvider();
    const searching = { ...context, providerUrls: [baseUrl] };

    const first = await call(appRouter.provider.import, { baseUrl, recordId: "265" }, { context });
    const again = await call(appRouter.provider.import, { baseUrl, recordId: "265" }, { context });
    const { answered } = await call(
      appRouter.provider.search,
      { query: "tenth planet" },
      { context: searching },
    );

    expect(again.itemId).toBe(first.itemId);
    expect(answered[0]?.results[0]?.itemId).toBe(first.itemId);
  });

  /**
   * AND A PROVIDER DOES NOT GET TO CHOOSE HOW MUCH OF THE OWNER'S PAGE IT FILLS
   * (ADR-0123, CNCORE-95).
   *
   * THE PAYLOAD IS THE LEVER, NOT THE PROSE. `cmppSearch.parse` refuses a
   * malformed body, and a `ZodError`'s message is the ISSUE LIST serialised as
   * JSON -- one issue per bad field per record. So the provider sets the length
   * by how many bad records it sends. THE PAYLOAD BELOW IS MEASURED, not
   * imagined: uncapped it is a 151,362-character reason, and `MAX_BODY_BYTES`
   * lets a provider send 4 MiB of such records rather than the 200 used here.
   *
   * THIS IS NOT WHAT CNCORE-95 SAID THE MECHANISM WAS. Its words are "a zod
   * message that serialises the received value", and zod 4.5.4 does not put the
   * received value in the message at all -- it puts `code`, `expected`, `path`
   * and its own sentence. The defect is real and is LARGER than that reading;
   * only the route to it was misdescribed. ADR-0123 carries the correction.
   */
  it("caps what a provider's malformed payload puts on the Owner's page", async () => {
    const malformed = Object.fromEntries(
      // Each one matches the query on its title and is refused on every other
      // field, so the body is well-formed JSON that CMPP does not accept.
      Array.from({ length: 200 }, (_, n) => [
        String(n),
        { id: n, title: "tenth planet", kind: n, released: n, url: n },
      ]),
    );
    const baseUrl = await stubProvider(malformed);
    const searching = { ...context, providerUrls: [baseUrl] };

    const { answered, failed } = await call(
      appRouter.provider.search,
      { query: "tenth planet" },
      { context: searching },
    );

    // REFUSED RATHER THAN PARTLY ACCEPTED: a body CMPP does not accept is a
    // provider that answered badly, which is a failure and not an empty result.
    expect(answered).toEqual([]);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.reason.text.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
    // AND IT IS THE PROVIDER'S CLAIM, not CanonCore's sentence about a setting.
    expect(failed[0]?.reason.wrote).toBe("provider");
  });
});

/**
 * ADR-0094's first run, from the other end. The allowlist being empty is one way
 * an instance reaches no provider; having no provider NAMED is the other, and
 * the two are separate settings with separate remedies.
 */
describe("provider.configured", () => {
  it("names the providers this instance searches", async () => {
    const baseUrl = await stubProvider();

    const answer = await call(appRouter.provider.configured, undefined, {
      context: { ...context, providerUrls: [baseUrl] },
    });

    expect(answer).toStrictEqual({ providers: [baseUrl] });
  });

  it("answers with none where none is configured, rather than refusing", async () => {
    // `PROVIDER_URLS` unset is the empty string, and the empty string names no
    // provider. That is an ANSWER a surface has to be able to put in front of an
    // owner -- an instance nobody has configured and one that is broken look
    // identical otherwise -- rather than an error.
    const answer = await call(appRouter.provider.configured, undefined, {
      context: { ...context, providerUrls: [] },
    });

    expect(answer).toStrictEqual({ providers: [] });
  });
});

/**
 * WHAT THIS CATALOGUE ALREADY HOLDS OF ONE PROVIDER'S RECORDS, asked about ids the
 * owner names rather than about a query.
 *
 * `search` answers the same question for the candidates IT found. This is for the
 * record the owner names themselves -- a container id, which nothing in CMPP hands
 * over (ADR-0033) -- so there is no search to carry the answer.
 */
describe("provider.held", () => {
  it("answers the item one of a provider's records is held as, and omits the rest", async () => {
    const baseUrl = await stubProvider();
    const { itemId } = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "265" },
      { context },
    );

    const { items: held } = await call(
      appRouter.provider.held,
      { baseUrl, recordIds: ["265", "a record this catalogue has never seen"] },
      { context },
    );

    // OMITTED RATHER THAN NULL for a record that is not held. The caller asked
    // "which of these do you have", and a row per id with nothing in it is a
    // longer way of saying the same thing.
    expect(held).toEqual([{ recordId: "265", itemId }]);
  });
});

/**
 * WHAT THE PROVIDER SAYS ABOUT A CONTAINER, ASKED BEFORE ANYTHING IS WRITTEN.
 *
 * `provider.browse` declares three refusals so that each is an ANSWER rather
 * than a fault (ADR-0033), and a POST is the wrong place to find any of them
 * out: a Server Action that throws during a form submission with no script
 * answers a bare 500, and Next redacts the message before a boundary could
 * read it. So the question is asked on the GET instead, where a read belongs,
 * and every one of the three arrives as a value a page can print.
 */
describe("provider.container", () => {
  it("answers the container's own title, and the name of the provider that holds it", async () => {
    const baseUrl = await stubProvider();

    const answer = await call(
      appRouter.provider.container,
      { baseUrl, containerId: "388305" },
      { context },
    );

    // THE TITLE IS THE WHOLE POINT OF ASKING EARLY. A browse writes a
    // container's worth of placements, and until this the only thing naming
    // the one about to be written was an id the owner typed.
    expect(answer).toMatchObject({
      answer: "container",
      providerName: "provider-wiki",
      title: "Category:Vashta Nerada audio stories",
    });
  });

  it("counts every placement a browse would write, the ones it cannot position included", async () => {
    /*
     * WHAT PRESSING THE BUTTON COSTS, said before it is pressed. One call writes
     * a container's worth of placements -- that is why `browse` exists at all
     * (ADR-0033) -- and the owner's only description of it beforehand is this.
     *
     * THE UNPLACED ONES ARE MEMBERS TOO (ADR-0009, and `importBrowsedContainer`
     * writes them with a null position). They are PLACEMENTS WITH NO POSITION
     * rather than non-members, so a count that left them out would understate
     * what arrives -- for the wiki, by about a sixth.
     */
    const baseUrl = await stubProvider(
      {},
      {
        containers: {
          "388305": {
            ...VASHTA_NERADA,
            unplaced: [
              {
                id: "355593",
                title: "Operation Dusk (audio story)",
                kind: "audio story",
                released: [],
                writers: [],
                series: null,
                url: "https://tardis.wiki/wiki/Operation_Dusk_(audio_story)",
              },
            ],
          },
        },
      },
    );

    const answer = await call(
      appRouter.provider.container,
      { baseUrl, containerId: "388305" },
      { context },
    );

    // TWO IN THE ORDERING AND ONE OUTSIDE IT.
    expect(answer).toMatchObject({ answer: "container", placements: 3 });
  });

  it("says a provider holds no container at that id, rather than throwing", async () => {
    const baseUrl = await stubProvider();

    // AN ID THIS PROVIDER REALLY HOLDS, AND NOT AS A CONTAINER. `265` is a
    // story, which is the case an owner reaches by typing a record id into the
    // box that wants a container's -- and the case a `lookup` could not tell
    // from a container, since it would answer with the story's own title and
    // offer a browse the provider then refuses.
    const answer = await call(
      appRouter.provider.container,
      { baseUrl, containerId: "265" },
      { context },
    );

    expect(answer).toEqual({ answer: "no-such-container", providerName: "provider-wiki" });
  });

  it("says a provider declares no browse, and does not ask it for one", async () => {
    /*
     * THE OPTIONALITY BEING HONOURED (ADR-0033) rather than an optimisation.
     * `browse` is the operation a provider may decline, and a provider that
     * offers only `search` and `lookup` is perfectly well-formed -- so the
     * manifest decides whether to call at all, and the owner is told that this
     * provider does not do it rather than that their id was wrong.
     */
    const asked: string[] = [];
    const baseUrl = await stubProvider(
      { "265": TENTH_PLANET },
      { operations: ["search", "lookup"], asked },
    );

    const answer = await call(
      appRouter.provider.container,
      { baseUrl, containerId: "388305" },
      { context },
    );

    expect(answer).toEqual({ answer: "browse-not-offered", providerName: "provider-wiki" });
    // THE MANIFEST, AND NOTHING ELSE. A `/browse/388305` here would be the
    // declaration read and then ignored.
    expect(asked).toEqual(["/"]);
  });

  it("says a provider could not be reached, and not that it holds nothing", async () => {
    /*
     * A PROVIDER THAT IS DOWN AND A PROVIDER THAT HOLDS NOTHING ARE DIFFERENT
     * ANSWERS, which is the distinction this codebase keeps everywhere else --
     * `provider.search` answers two lists for the same reason. An owner who
     * cannot tell them apart goes back to check an id that was right all along.
     *
     * THE REASON TRAVELS WITH IT because it is the only part they can act on:
     * this URL is refused by ADR-0034's allowlist rather than being offline, and
     * those are two different things to go and fix.
     */
    const answer = await call(
      appRouter.provider.container,
      { baseUrl: "http://169.254.169.254/", containerId: "388305" },
      { context },
    );

    expect(answer.answer).toBe("unreachable");
    // THE SAME RULE AS `provider.search`'s `failed` LIST, at the other procedure
    // (ADR-0123). One rule applied to the newer of the two would have left this
    // surface exactly as CNCORE-95 found it.
    expect(answer).toMatchObject({
      reason: { wrote: "canoncore", text: expect.stringContaining("allowlisted") },
    });
  });

  /**
   * AND THE CAP HOLDS HERE TOO, asserted at this procedure rather than inferred
   * from `provider.search` (ADR-0123, CNCORE-95).
   *
   * THE TWO GREW THE FIELD SEPARATELY -- CNCORE-68 and CNCORE-92 -- and each
   * mapped its own catch, which is how one defect came to have two sites. A rule
   * proven only at the newer of them would leave the older surface as it was,
   * which is the thing the ticket asks for by name.
   *
   * MEASURED: uncapped, the payload below is a 78,287-character reason.
   */
  it("caps a provider's malformed container payload too, and calls it the provider's", async () => {
    const baseUrl = await stubProvider(
      {},
      {
        containers: {
          // A body that is well-formed JSON and is not a CMPP browse: one zod
          // issue per bad story, so the provider sets the length.
          "388305": {
            container: { id: 388305, title: 388305, kind: 388305, released: 388305, url: 388305 },
            ordering: Array.from({ length: 200 }, (_, n) => ({ position: "x", record: n })),
            unplaced: [],
          },
        },
      },
    );

    const answer = await call(
      appRouter.provider.container,
      { baseUrl, containerId: "388305" },
      { context },
    );

    if (answer.answer !== "unreachable") {
      throw new Error(`a provider that answered badly was reported ${answer.answer}`);
    }
    expect(answer.reason.text.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
    expect(answer.reason.wrote).toBe("provider");
  });
});
