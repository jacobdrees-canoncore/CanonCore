import { createServer, type Server } from "node:http";
import { type Database, items, sources } from "@canoncore/db";
import { connect } from "@canoncore/db/testing/catalogue";
import { parseAllowlist } from "@canoncore/providers";
import { call, isDefinedError, safe } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

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
const context = await createContext();

let db: Database;

beforeAll(async () => {
  db = await connect();
});

const servers: Server[] = [];

afterEach(async () => {
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
  } = {},
) {
  const server = createServer((request, response) => {
    const json = (body: unknown, status = 200) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    const path = request.url ?? "/";
    if (path === "/") return json({ ...MANIFEST, operations, attribution });
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

    const { members } = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: "388305" },
      { context },
    );

    expect(members).toHaveLength(2);
    for (const member of members) {
      const item = await call(appRouter.item.get, { id: member.itemId }, { context });
      expect(item.placements).toEqual([
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

    const { members, quarantinedValues } = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: "388305" },
      { context },
    );

    // Both members land. Losing the container over one member's date is the
    // trade this ticket exists to refuse.
    expect(members).toHaveLength(2);
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

    expect(purged).toEqual({ statements: 0, placements: 0, items: 0 });
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
