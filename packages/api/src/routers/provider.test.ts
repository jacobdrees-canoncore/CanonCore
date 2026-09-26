import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import {
  type Database,
  identifiers,
  items,
  placementSources,
  sources,
  statements,
  writeProviderSettings,
} from "@canoncore/db";
import { connect } from "@canoncore/db/testing/catalogue";
import { parseAllowlist, REASON_MAX_LENGTH } from "@canoncore/providers";
import { A_NARROWING } from "@canoncore/schemas";
import { call, isDefinedError, safe } from "@orpc/server";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createContext } from "../context";
import { aTokenForTheOwner } from "../testing/the-owner";
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
/** The CIDR this file's stub providers bind inside, and this suite's allowlist. */
const LOOPBACK = "127.0.0.0/8";

/**
 * WHAT THIS INSTANCE IS CONFIGURED TO REACH, WRITTEN BEFORE THE FIRST CONTEXT
 * IS BUILT.
 *
 * IT USED TO BE `vitest.config.ts`'s `env`, and it moved here with the settings
 * themselves (CNCORE-99): the allowlist is a row now, so a suite that needs one
 * writes it rather than exporting it. The value is unchanged and so is its
 * reason -- the stub providers below bind real sockets on 127.0.0.1, and
 * reaching them is legal only because a CIDR covering loopback is named, which
 * is ADR-0034's config boundary being exercised rather than bypassed.
 *
 * BOTH SETTINGS ARE WRITTEN, NOT JUST THE ONE THIS FILE CARES ABOUT. One row
 * holds the pair (migration 16) and the suite's files share one database, so a
 * file that set only the allowlist would inherit whatever providers another
 * file's last test had named -- and this file asserts on an instance that names
 * none.
 */
await writeProviderSettings(await connect(), {
  providerAllowlist: LOOPBACK,
  providerUrls: "",
});

/**
 * THE OWNER'S CONTEXT, because most of what this file drives WRITES: `import`,
 * `browse` and `purge` are behind `ownerProcedure` since CNCORE-109, and a
 * caller with no session is refused before it reaches any of the behaviour
 * asserted below.
 */
const context = await createContext({ sessionToken: await aTokenForTheOwner() });

/**
 * NOBODY AT ALL, which is what `provider.container` is now asserted to refuse.
 *
 * NAMED RATHER THAN BUILT INLINE, because the refusal below is about WHO is
 * asking and a `createContext()` sitting in the middle of a `call` reads as
 * incidental setup. `context` above is the owner's, so there was no visitor in
 * this file to be refused.
 */
const asAVisitor = await createContext();

/**
 * AN INSTANCE CONFIGURED TO REACH EXACTLY THIS, for a test that needs other
 * settings than the ones this file wrote above.
 *
 * A FUNCTION BECAUSE THE CONTEXT'S OWN IS (CNCORE-99). `createContext` reads the
 * settings when something asks for them rather than when a request arrives, so
 * most requests -- an item page, a health check, a refusal -- pay no query at
 * all; an override is therefore a function too, and stands in for the read.
 */
const reaching =
  ({ providers = [], allowlist = LOOPBACK }: { providers?: string[]; allowlist?: string }) =>
  async () => ({ allowlist: parseAllowlist(allowlist), urls: providers });

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

/**
 * THE ID INSIDE A PATH SEGMENT, DECODED, or `null` where it is not a segment.
 *
 * THE CLIENT PERCENT-ENCODES THE ID and this stub keys its fixtures on the
 * id itself, so the two only met while every id here was digits.
 * `provider-tmdb`'s are not: `movie:603` reaches this as `movie%3A603`, and a
 * stub comparing the raw segment answered 404 for a record it holds -- which
 * reads exactly like a provider that does not hold it (CNCORE-238).
 *
 * `null` RATHER THAN A THROW ON A MALFORMED ESCAPE. `decodeURIComponent("%")`
 * throws, and a stub that dies mid-request fails as a socket hangup rather than
 * as the 404 a provider would answer for an id addressing nothing.
 */
function theIdIn(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

async function stubProvider(
  records: Record<string, unknown> = { "265": TENTH_PLANET },
  {
    operations = ["search", "lookup", "browse"],
    containers = { "388305": VASHTA_NERADA } as Record<string, unknown>,
    /**
     * What `/containers` answers, IN THE ORDER GIVEN, for a provider declaring
     * the operation (CNCORE-187). A list rather than `containers`' keys, whose
     * order is not the insertion order: an object puts integer-like keys first,
     * ascending, and every wiki id is one.
     */
    listed = [] as unknown[],
    /**
     * The sentence `/containers` refuses with, `503`, where the manifest before
     * it answered: what `provider-wiki` with a lapsed Credential did at this
     * path when ADR-0033's CNCORE-186 section measured it live.
     */
    refusesContainersWith = undefined as string | undefined,
    attribution = null as typeof ATTRIBUTION | null,
    /** The image policy the manifest declares (ADR-0033). */
    images = MANIFEST.images,
    /** What the provider calls itself, for a test about what it may call itself. */
    name = MANIFEST.name,
    /** Seconds, or `null` for a source declaring no ceiling (ADR-0036). */
    maxCacheAge = MANIFEST.max_cache_age as number | null,
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
    if (path === "/") {
      return json({
        ...MANIFEST,
        name,
        operations,
        attribution,
        images,
        max_cache_age: maxCacheAge ?? undefined,
      });
    }
    // A PROVIDER THAT DECLINES THE OPERATION HAS NOTHING AT THIS PATH, which is
    // the `404` both real providers answer and ADR-0033 requires of a decliner.
    if (path === "/containers" && operations.includes("containers")) {
      if (refusesContainersWith !== undefined) {
        return json({ error: refusesContainersWith, provider: "a provider" }, 503);
      }
      return json({ containers: listed });
    }
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
      const id = theIdIn(path.slice("/browse/".length));
      return id !== null && Object.hasOwn(containers, id)
        ? json(containers[id])
        : json({ error: "no such container" }, 404);
    }
    const id = path.startsWith("/lookup/") ? theIdIn(path.slice("/lookup/".length)) : null;
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

/** The sentence the provider below fails with: the half an owner can act on. */
const LAPSED = "this Provider holds no tardis.wiki session. Supply one at /unlock.";

/**
 * A PROVIDER THAT IS UP, CANNOT ANSWER, AND SAYS WHY (CNCORE-140, ADR-0122).
 *
 * THE THIRD THING A PROVIDER CAN BE, beside one that answers and one on a port
 * nothing listens on. This one ANSWERS -- the socket opens and the status comes
 * back -- and the sentence the Owner has to act on is in the BODY, which is the
 * half `provider.import` and `provider.browse` threw away until CNCORE-149.
 *
 * `503` AND A BODY, which is what `packages/contract` holds every Provider
 * declaring a Credential to: up, answering nothing, and saying so. The body's
 * SHAPE is that file's one deliberate omission, and `{error}` here is the
 * spelling both real Providers happen to use rather than one CMPP requires.
 *
 * IT REFUSES EVERY PATH, manifest included, because that is what an expired
 * credential does: CNCORE-100's `cf_clearance` is a 503 on every operation, so
 * an import fails at the first request rather than part way through.
 */
async function stubProviderRefusingWith(said: string): Promise<string> {
  const server = createServer((_request, response) => {
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: said, provider: "a provider" }));
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
      { context: { ...context, providerSettings: reaching({ providers: [baseUrl] }) } },
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
      // THE ONE ROW HERE THE PROVIDER DID NOT CLAIM (CNCORE-173), and it says
      // so: the sort name is CanonCore's, computed from the title beneath it.
      // That is the point of this assertion rather than an exception to it --
      // every value reaches a reader with its real source attached, and a
      // computation the catalogue ran is not something to file under a provider.
      {
        property: "sort_name",
        value: "Tenth Planet (TV story)",
        sourceKind: "derived",
        sourceLabel: "CanonCore (sort name v1)",
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
    // AND AT A STATUS A PAGE CAN READ (CNCORE-152). The code alone is what a
    // caller narrows on, but it is the STATUS that decides whether the answer
    // reaches the owner at all: `answer.ts` rethrows at 500 and above, and oRPC
    // gives a code of our own 500 unless the declaration says otherwise. Without
    // this line the code below can be declared and the owner still gets the bare
    // `Internal Server Error`, which is exactly the state CNCORE-149 left here.
    expect(error.status).toBe(404);
  });

  /**
   * A PROVIDER THAT ANSWERED IS NOT A PROVIDER THAT WAS REFUSED, and until
   * CNCORE-149 only the second reached a caller. `client.ts` raises a plain
   * `Error` for a non-2xx, which is not an `OutboundRefused` and fell past the
   * one `catch` this procedure had -- so it arrived as the 500 that catch
   * exists to remove.
   *
   * THE READ SURFACES HAVE CARRIED THIS SENTENCE SINCE CNCORE-140 and these two
   * did not, which is the whole of the defect: an Owner who FOUND a record and
   * pressed Take on an expired Provider got a 500 where the read that found it
   * would have told them what to do.
   *
   * THE WHOLE SENTENCE, because the remedy is in the half the Provider wrote.
   * `/` is the manifest, which is the first thing an import asks for.
   */
  it("reports a provider that answered a non-2xx as a refusal, carrying what it said", async () => {
    const baseUrl = await stubProviderRefusingWith(LAPSED);

    const { error } = await safe(
      call(appRouter.provider.import, { baseUrl, recordId: "265" }, { context }),
    );

    if (!isDefinedError(error)) throw new Error(`expected a defined error, got ${String(error)}`);
    expect(error.code).toBe("PROVIDER_REFUSED");
    // BOUNDED AND ATTRIBUTED, which is the shape the read surfaces carry
    // (ADR-0123) and the shape a bare `message` string could not: a page has no
    // way to tell whose sentence it is holding without `wrote`.
    expect(error.data).toEqual({
      wrote: "provider",
      text: `/ answered 503: ${LAPSED}`,
    });
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
    // NARROWED BY THE CODE RATHER THAN ASSERTED ON IT, because `data` is typed
    // per code: a defined error here is a union of the two this procedure
    // declares, and only one of them carries a reason.
    if (error.code !== "PROVIDER_REFUSED") throw new Error(`it answered ${error.code}`);
    // AND IT IS CANONCORE'S OWN SENTENCE, which is the half a bare message could
    // not carry and the half the wrapper could quietly lose. ADR-0123 decides
    // `wrote` by WHICH BOUNDARY refused, and `askingTheProvider` maps the error
    // it caught rather than one of its own -- so a refusal of a URL the owner
    // typed stays this app telling them about their own settings, and does not
    // become a third party's text on the way through.
    expect(error.data.wrote).toBe("canoncore");
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

/**
 * The Tenth Planet with the picture its wiki page leads with -- ON LOOPBACK, which
 * the content boundary refuses with no exception ever (ADR-0034). So it is
 * refused before a socket opens, and the pair below can tell a picture that was
 * CHOSEN and refused from one that was never chosen at all.
 */
const TENTH_PLANET_PICTURED = {
  ...TENTH_PLANET,
  images: [
    {
      role: "page image",
      url: "http://127.0.0.1:9/Tenth_planet.jpg",
      description_url: "https://tardis.wiki/wiki/File:Tenth_planet.jpg",
      licences: ["Screenshot"],
    },
  ],
};

describe("a record's pictures (CNCORE-358)", () => {
  /**
   * A PICTURE THAT CANNOT BE FETCHED DOES NOT COST THE RECORD, AND IS COUNTED.
   * The import lands without it and says how many it could not bring, rather
   * than reporting success identically whether it brought the picture or not.
   */
  it("are fetched across the content boundary, so one a provider puts on loopback is refused and counted", async () => {
    const baseUrl = await stubProvider(
      { "265": TENTH_PLANET_PICTURED },
      { images: { stored_variant: null, per_role_limit: 5, quality_floor: 0 } },
    );

    const imported = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "265" },
      { context },
    );

    expect(imported.picturesNotFetched).toBe(1);
    expect((await call(appRouter.item.get, { id: imported.itemId }, { context })).artwork).toEqual(
      [],
    );
  });

  /**
   * `0` IS A DECLARATION THAT THE SOURCE SERVES NO IMAGES, so the picture is
   * never chosen -- and a picture never chosen is not one that failed.
   */
  it("are not asked for at all where the provider declares a limit of zero", async () => {
    const baseUrl = await stubProvider(
      { "265": TENTH_PLANET_PICTURED },
      { images: { stored_variant: null, per_role_limit: 0, quality_floor: 0 } },
    );

    const imported = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "265" },
      { context },
    );

    expect(imported.picturesNotFetched).toBe(0);
  });
});

/**
 * A record carrying ids in other id spaces, and a property its source defines
 * (CNCORE-349). The ids are the real ones: `tt0133093` is The Matrix on IMDb and
 * `603` its TMDB id, which `provider-tmdb` sends as `external_ids` on a lookup.
 */
const MATRIX_WITH_IDS = {
  id: "movie:603",
  title: "The Matrix",
  kind: "movie",
  released: ["1999-03-31"],
  writers: [],
  series: null,
  url: "https://www.themoviedb.org/movie/603",
  external_ids: { tmdb: "603", imdb: "tt0133093" },
  production_code: "4B",
};

describe("a record's Identifiers", () => {
  it("reach the catalogue from an import and are read back on the Item, each with who said it", async () => {
    const baseUrl = await stubProvider({ "movie:603": MATRIX_WITH_IDS }, { name: "provider-tmdb" });

    const { itemId } = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "movie:603" },
      { context },
    );
    const item = await call(appRouter.item.get, { id: itemId }, { context });

    expect(item.identifiers).toEqual([
      { scheme: "imdb", value: "tt0133093", sourceKind: "provider", sourceLabel: "provider-tmdb" },
      { scheme: "tmdb", value: "603", sourceKind: "provider", sourceLabel: "provider-tmdb" },
    ]);
    // NO PROPERTY IS MINTED FOR EITHER, nor for the property the source defines:
    // an Identifier is not a Statement, and a claim the catalogue has no home for
    // is CNCORE-371's to hold rather than this import's to invent a field for.
    expect(item.statements.map((statement) => statement.property).sort()).toEqual([
      "external_id",
      "released",
      "sort_name",
      "title",
    ]);
  });

  it("are none for a record sending none, which is every record of a source with one id space", async () => {
    const baseUrl = await stubProvider();

    const { itemId } = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "265" },
      { context },
    );

    expect((await call(appRouter.item.get, { id: itemId }, { context })).identifiers).toEqual([]);
  });

  it("are refreshed by a second import rather than doubled, a new value replacing the old", async () => {
    const records: Record<string, unknown> = { "movie:603": MATRIX_WITH_IDS };
    const baseUrl = await stubProvider(records);
    await call(appRouter.provider.import, { baseUrl, recordId: "movie:603" }, { context });

    records["movie:603"] = { ...MATRIX_WITH_IDS, external_ids: { tmdb: "603", imdb: "tt9999999" } };
    const { itemId } = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "movie:603" },
      { context },
    );

    expect(
      (await call(appRouter.item.get, { id: itemId }, { context })).identifiers.map(
        ({ scheme, value }) => [scheme, value],
      ),
    ).toEqual([
      ["imdb", "tt9999999"],
      ["tmdb", "603"],
    ]);
  });

  /**
   * A THINNER ANSWER IS NOT A WITHDRAWAL, and CI found it against the real
   * image rather than the stand-in. `provider-tmdb` sends `imdb` on a lookup
   * and only `tmdb` on a browse of the collection a film sits in, so a browse
   * after the lookup read as the provider taking the IMDb id back.
   */
  it("keep a scheme a later, thinner answer leaves out", async () => {
    const baseUrl = await stubProvider(
      { "movie:603": MATRIX_WITH_IDS },
      {
        containers: {
          "collection:2344": {
            container: {
              ...MATRIX_WITH_IDS,
              id: "collection:2344",
              title: "The Matrix Collection",
              external_ids: { tmdb: "2344" },
            },
            ordering: [
              { position: 1, record: { ...MATRIX_WITH_IDS, external_ids: { tmdb: "603" } } },
            ],
            unplaced: [],
          },
        },
      },
    );
    const { itemId } = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "movie:603" },
      { context },
    );

    await call(appRouter.provider.browse, { baseUrl, containerId: "collection:2344" }, { context });

    expect(
      (await call(appRouter.item.get, { id: itemId }, { context })).identifiers.map(
        ({ scheme, value }) => [scheme, value],
      ),
    ).toEqual([
      ["imdb", "tt0133093"],
      ["tmdb", "603"],
    ]);
  });

  it("go with the provider that said them when it is purged, from an Item the Owner keeps", async () => {
    const baseUrl = await stubProvider({ "movie:603": MATRIX_WITH_IDS });
    const { itemId } = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "movie:603" },
      { context },
    );
    // KEPT, BY BEING IN A GROUP THE OWNER DREW. An Item nothing holds is deleted
    // by the purge and takes its Identifiers with it by cascade, so only an
    // Item that survives can show the provider's claims going without it.
    const { id: groupId } = await call(appRouter.group.create, { name: "Kept" }, { context });
    await call(appRouter.group.put, { groupId, itemId }, { context });

    await call(appRouter.provider.purge, { baseUrl }, { context });

    expect((await call(appRouter.item.get, { id: itemId }, { context })).identifiers).toEqual([]);
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

    const { containerId, placements } = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: "388305" },
      { context },
    );

    expect(placements).toHaveLength(2);
    for (const placement of placements) {
      const item = await call(appRouter.item.get, { id: placement.itemId }, { context });
      // IN THIS BROWSE'S CONTAINER. Other tests browse the same two stories from
      // other stubs, which are other Providers, and since CNCORE-361 those land
      // on the same Items -- so the Item also sits in their containers.
      expect(item.placements.rows.filter((row) => row.containerId === containerId)).toEqual([
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
    // AND NOT THE `404` ITS TWO NEIGHBOURS TAKE (CNCORE-152), which is the half
    // of this worth asserting rather than the number itself. Both statuses would
    // get the owner a page, so a test that only counted "below 500" would pass on
    // a 404 here -- and a 404 tells them the container is missing when nothing
    // ever asked about it. The status is the only place that distinction
    // survives the trip to the page.
    expect(error.status).toBe(422);
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
    // AT THE SAME STATUS AS `import`'s MISSING RECORD, AND ASSERTED HERE RATHER
    // THAN LEFT TO IT (CNCORE-152). These two procedures have twice now had one
    // defect with two sites -- the identical `catch` under CNCORE-149, the
    // identical missing status under this ticket -- so a witness for one of them
    // has repeatedly said nothing true about the other.
    expect(error.status).toBe(404);
  });

  /**
   * THE IDENTICAL CATCH AND THEREFORE THE IDENTICAL HOLE, which is why this is
   * asserted here rather than left to `import`'s witness above. ADR-0123 exists
   * because one defect already had two sites that each solved it separately;
   * two write procedures that narrowed to `OutboundRefused` in the same words
   * is that shape again, and only a test at each of them says the second was
   * fixed rather than assumed.
   */
  it("reports a provider that answered a non-2xx as a refusal, carrying what it said", async () => {
    const baseUrl = await stubProviderRefusingWith(LAPSED);

    const { error } = await safe(
      call(appRouter.provider.browse, { baseUrl, containerId: "388305" }, { context }),
    );

    if (!isDefinedError(error)) throw new Error(`expected a defined error, got ${String(error)}`);
    expect(error.code).toBe("PROVIDER_REFUSED");
    expect(error.data).toEqual({
      wrote: "provider",
      text: `/ answered 503: ${LAPSED}`,
    });
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
    if (error.code !== "PROVIDER_REFUSED") throw new Error(`it answered ${error.code}`);
    // CANONCORE'S OWN SENTENCE, as on `import` above and for the same reason.
    expect(error.data.wrote).toBe("canoncore");
  });
});

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

/**
 * AN ENTITY ARRIVES AS WHAT IT IS (CNCORE-367). A Provider says which of
 * ADR-0005's seven kinds a record is in `item_kind`, and the Item is written
 * under that kind rather than under `work`, which every import wrote before.
 *
 * SHAPED AS `provider-wiki` ANSWERS A BROWSE OF AN ENTITY INFOBOX: the wiki
 * asserts no order among the pages that carry one, so every member is
 * Unplaced. The titles are real Event pages; the ids are this stub's own.
 */
const EVENTS = {
  container: {
    id: "900001",
    title: "Template:Infobox Event or Exhibition",
    kind: "infobox",
    released: [],
    writers: [],
    series: null,
    url: "https://tardis.wiki/wiki/Template:Infobox_Event_or_Exhibition",
  },
  ordering: [],
  unplaced: ["Doctor Who Experience", "Doctor Who Live"].map((title, at) => ({
    id: String(900002 + at),
    title,
    kind: "event",
    item_kind: "time_span",
    released: [],
    writers: [],
    series: null,
    url: `https://tardis.wiki/wiki/${title.replaceAll(" ", "_")}`,
  })),
};

describe("a record's item kind", () => {
  it("files each member under the kind its Provider named, where the kind filter finds it", async () => {
    const baseUrl = await stubProvider({}, { containers: { "900001": EVENTS } });

    const { placements } = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: "900001" },
      { context },
    );
    const members = placements.map((placement) => placement.itemId);
    expect(members).toHaveLength(2);

    const narrowed = await call(
      appRouter.catalogue.list,
      { kind: "time_span", limit: 100 },
      { context },
    );
    for (const id of members) {
      expect((await call(appRouter.item.get, { id }, { context })).kind).toBe("Time span");
      expect(narrowed.rows).toContainEqual(expect.objectContaining({ id, kind: "Time span" }));
    }
    // And the question "what can I watch" still leaves them out (ADR-0077).
    const works = await call(appRouter.catalogue.works, { limit: 100 }, { context });
    expect(works.rows.map((row) => row.id)).toEqual(expect.not.arrayContaining(members));
  });
});

/**
 * A series as `provider-tmdb` browses it: the programme, and its seasons in
 * TMDB's own array order, specials first. Each season SAYS it is a container,
 * which is the only way CanonCore may know one is (`CONTEXT.md`'s Container:
 * "stored, never inferred from having members") -- its episodes are CNCORE-375's
 * and do not arrive here, so nothing else could say it.
 */
const A_SERIES = {
  container: {
    id: "tv:57243",
    title: "Doctor Who",
    kind: "tv",
    released: ["2005-03-26"],
    writers: [],
    series: null,
    url: "https://www.themoviedb.org/tv/57243",
    is_container: true,
  },
  ordering: [
    {
      position: 1,
      record: {
        id: "season:57243:0",
        title: "Specials",
        kind: "season",
        released: ["2005-11-18"],
        writers: [],
        series: "Doctor Who",
        series_id: "tv:57243",
        url: "https://www.themoviedb.org/tv/57243/season/0",
        is_container: true,
      },
    },
    {
      position: 2,
      record: {
        id: "season:57243:1",
        title: "Series 1",
        kind: "season",
        released: ["2005-03-26"],
        writers: [],
        series: "Doctor Who",
        series_id: "tv:57243",
        url: "https://www.themoviedb.org/tv/57243/season/1",
        is_container: true,
      },
    },
  ],
  unplaced: [],
};

/**
 * CNCORE-360: the second Provider's series and its seasons arrive as their own
 * Containers, so the Owner can descend from one to the other and browse the way
 * the thing was published beside the way it happened (ADR-0128).
 */
describe("a series and its seasons", () => {
  it("arrive as Containers, and the Owner descends from the series to a season", async () => {
    const baseUrl = await stubProvider({}, { containers: { "tv:57243": A_SERIES } });

    const { containerId } = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: "tv:57243" },
      { context },
    );

    const series = await call(appRouter.item.get, { id: containerId }, { context });
    expect(series.isContainer).toBe(true);
    expect(series.holds.rows.map(({ title, position }) => [title, position])).toEqual([
      ["Specials", 1],
      ["Series 1", 2],
    ]);

    for (const { itemId } of series.holds.rows) {
      const season = await call(appRouter.item.get, { id: itemId }, { context });
      expect(season.isContainer).toBe(true);
    }
  });

  it("leaves a member that does not say it is a container a plain work", async () => {
    const { is_container: _, ...unsaid } = A_SERIES.ordering[1]!.record;
    const baseUrl = await stubProvider(
      {},
      {
        containers: {
          "tv:57243": { ...A_SERIES, ordering: [{ position: 1, record: unsaid }] },
        },
      },
    );

    const { placements } = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: "tv:57243" },
      { context },
    );

    const member = await call(appRouter.item.get, { id: placements[0]?.itemId ?? "" }, { context });
    expect(member.isContainer).toBe(false);
  });

  it("stays its own Container beside another Provider's ordering of the same stories", async () => {
    // ADR-0128: two Providers' orderings are two Containers, and neither may
    // improve the other. The wiki's timeline and TMDB's series both land, apart.
    const wiki = await stubProvider();
    const tmdb = await stubProvider({}, { containers: { "tv:57243": A_SERIES } });

    const timeline = await call(
      appRouter.provider.browse,
      { baseUrl: wiki, containerId: "388305" },
      { context },
    );
    const series = await call(
      appRouter.provider.browse,
      { baseUrl: tmdb, containerId: "tv:57243" },
      { context },
    );

    expect(series.containerId).not.toBe(timeline.containerId);
    const seriesPage = await call(appRouter.item.get, { id: series.containerId }, { context });
    const timelinePage = await call(appRouter.item.get, { id: timeline.containerId }, { context });
    expect(seriesPage.holds.rows.map(({ title }) => title)).toEqual(["Specials", "Series 1"]);
    // Both at position 1, which ties them (ADR-0009), so their order is no claim.
    expect(timelinePage.holds.rows.map(({ title }) => title).sort()).toEqual([
      "Day of the Vashta Nerada (audio story)",
      "Night of the Vashta Nerada (audio story)",
    ]);
  });
});

/** A wiki category holding these stories, as `provider-wiki` answers a browse of it. */
function aWikiCategory(id: string, stories: [id: string, title: string, released: string][]) {
  return {
    container: {
      id,
      title: `Category:${id}`,
      kind: "category",
      released: [],
      writers: [],
      series: null,
      url: `https://tardis.wiki/wiki/Category:${id}`,
    },
    ordering: stories.map(([storyId, title, released], at) => ({
      position: at + 1,
      record: {
        id: storyId,
        title,
        kind: "TV story",
        released: [released],
        writers: [],
        series: null,
        url: `https://tardis.wiki/wiki/${storyId}`,
      },
    })),
    unplaced: [],
  };
}

/** A TMDB season holding these episodes, in TMDB's order, as `provider-tmdb` browses one. */
function aTmdbSeason(id: string, episodes: [title: string, released: string][]) {
  const [, series, season] = id.split(":");
  return {
    container: {
      id,
      title: `Season ${season}`,
      kind: "season",
      released: [],
      writers: [],
      series: "Doctor Who",
      url: `https://www.themoviedb.org/tv/${series}/season/${season}`,
      is_container: true,
    },
    ordering: episodes.map(([title, released], at) => ({
      position: at + 1,
      record: {
        id: `episode:${series}:${season}:${at + 1}`,
        title,
        kind: "episode",
        released: [released],
        writers: [],
        series: "Doctor Who",
        series_id: `tv:${series}`,
        url: `https://www.themoviedb.org/tv/${series}/season/${season}/episode/${at + 1}`,
        is_container: false,
      },
    })),
    unplaced: [],
  };
}

/** The wiki's half and then TMDB's, each browsed for real, and the Items each placed. */
async function browseBoth(
  wiki: ReturnType<typeof aWikiCategory>,
  tmdb: ReturnType<typeof aTmdbSeason>,
) {
  const wikiUrl = await stubProvider({}, { containers: { [wiki.container.id]: wiki } });
  const tmdbUrl = await stubProvider(
    {},
    { containers: { [tmdb.container.id]: tmdb }, name: "provider-tmdb", attribution: ATTRIBUTION },
  );
  const fromWiki = await call(
    appRouter.provider.browse,
    { baseUrl: wikiUrl, containerId: wiki.container.id },
    { context },
  );
  const fromTmdb = await call(
    appRouter.provider.browse,
    { baseUrl: tmdbUrl, containerId: tmdb.container.id },
    { context },
  );
  return {
    wiki: fromWiki.placements.map(({ itemId }) => itemId),
    tmdb: fromTmdb.placements.map(({ itemId }) => itemId),
  };
}

/*
 * ADR-0026's OPERATION, AND ADR-0027's BARS (CNCORE-361). Each story here is one
 * no other test in this file browses, because the suite shares one database and
 * a story two tests both browsed would be matched ACROSS them -- which is the
 * feature, and would make each test's answer depend on the other's.
 */
describe("works matched across Providers", () => {
  it("lands a work both Providers describe on one Item, carrying both their ids", async () => {
    const both = await browseBoth(
      aWikiCategory("47651", [["1585", "New Earth (TV story)", "2006-04-15"]]),
      aTmdbSeason("season:57243:2", [["New Earth", "2006-04-15"]]),
    );

    expect(both.tmdb).toEqual(both.wiki);
    const item = await call(appRouter.item.get, { id: both.wiki[0] ?? "" }, { context });
    expect(
      item.statements
        .filter(({ property }) => property === "external_id")
        .map(({ sourceLabel, value }) => [sourceLabel, value])
        .sort(),
    ).toEqual([
      ["provider-tmdb", "episode:57243:2:1"],
      ["provider-wiki", "1585"],
    ]);
  });

  it("offers a match between the bars rather than applying it, naming the signals", async () => {
    const both = await browseBoth(
      aWikiCategory("47652", [["1672", "Born Again (TV story)", "2005-11-18"]]),
      aTmdbSeason("season:57243:0", [["Children in Need: Born Again", "2005-11-18"]]),
    );

    expect(both.tmdb).not.toEqual(both.wiki);
    const wiki = await call(appRouter.item.get, { id: both.wiki[0] ?? "" }, { context });
    expect(wiki.matchCandidates).toEqual([
      {
        itemId: both.tmdb[0],
        title: "Children in Need: Born Again",
        score: 0.7,
        signals: { title: "subtitle", released: "same", parts: "agree" },
        partsHeldElsewhere: [],
      },
    ]);
    // Offered from both ends: the pair is one question, whichever page it is met on.
    const tmdb = await call(appRouter.item.get, { id: both.tmdb[0] ?? "" }, { context });
    expect(tmdb.matchCandidates.map(({ itemId }) => itemId)).toEqual([both.wiki[0]]);
  });

  it("discards a match below the low bar, offering nothing", async () => {
    const both = await browseBoth(
      aWikiCategory("47653", [["1826", "Doomsday (TV story)", "2006-07-08"]]),
      aTmdbSeason("season:57243:9", [["Tardisode 13: Doomsday", "2006-07-01"]]),
    );

    expect(both.tmdb).not.toEqual(both.wiki);
    const wiki = await call(appRouter.item.get, { id: both.wiki[0] ?? "" }, { context });
    expect(wiki.matchCandidates).toEqual([]);
  });

  /*
   * THE PART-VERSUS-STORY CASE, which CNCORE-368's finding makes a NO MATCH:
   * TMDB's part 1 carries the story's title AND its date, so title and date
   * alone would apply it. TMDB's own `(n)` titles say it is one of four.
   */
  it("matches no single part to a story the other Provider holds as several", async () => {
    const both = await browseBoth(
      aWikiCategory("47654", [["1998", "The Smugglers (TV story)", "1966-09-10"]]),
      aTmdbSeason("season:121:4", [
        ["The Smugglers (1)", "1966-09-10"],
        ["The Smugglers (2)", "1966-09-17"],
        ["The Smugglers (3)", "1966-09-24"],
        ["The Smugglers (4)", "1966-10-01"],
      ]),
    );

    expect(both.tmdb).not.toContain(both.wiki[0]);
    const story = await call(appRouter.item.get, { id: both.wiki[0] ?? "" }, { context });
    expect(story.partsHeldElsewhere).toEqual([{ sourceLabel: "provider-tmdb", parts: 4 }]);
    expect(story.matchCandidates).toEqual([]);
  });

  it("forgets a part disagreement when the Provider holding the parts is purged", async () => {
    const wiki = aWikiCategory("47656", [["2010", "The Faceless Ones (TV story)", "1967-04-08"]]);
    const tmdb = aTmdbSeason("season:121:6", [
      ["The Faceless Ones (1)", "1967-04-08"],
      ["The Faceless Ones (2)", "1967-04-15"],
    ]);
    const wikiUrl = await stubProvider({}, { containers: { [wiki.container.id]: wiki } });
    const tmdbUrl = await stubProvider({}, { containers: { [tmdb.container.id]: tmdb } });
    const { placements } = await call(
      appRouter.provider.browse,
      { baseUrl: wikiUrl, containerId: wiki.container.id },
      { context },
    );
    await call(
      appRouter.provider.browse,
      { baseUrl: tmdbUrl, containerId: tmdb.container.id },
      { context },
    );

    await call(appRouter.provider.purge, { baseUrl: tmdbUrl }, { context });

    const story = await call(appRouter.item.get, { id: placements[0]?.itemId ?? "" }, { context });
    expect(story.partsHeldElsewhere).toEqual([]);
  });

  it("carries the part disagreement on a row that offers a candidate", async () => {
    const both = await browseBoth(
      aWikiCategory("47655", [["2001", "The Moonbase (TV story)", "1967-02-11"]]),
      aTmdbSeason("season:121:5", [
        ["The Moonbase (1)", "1967-02-11"],
        ["The Moonbase (2)", "1967-02-18"],
        ["Behind the Sofa: The Moonbase", "1967-02-11"],
      ]),
    );

    const offered = await call(appRouter.item.get, { id: both.tmdb[2] ?? "" }, { context });
    expect(offered.matchCandidates).toEqual([
      expect.objectContaining({
        itemId: both.wiki[0],
        partsHeldElsewhere: [{ sourceLabel: "provider-tmdb", parts: 2 }],
      }),
    ]);
  });
});

/**
 * Everything one Provider stored, made to have been taken `days` ago.
 *
 * AGED RATHER THAN WAITED FOR, which is the only way a six-month ceiling is
 * testable. It reaches the rows directly because the moment a value was taken
 * is the thing under test, and no procedure sets it to the past.
 */
async function ageEverythingFrom(baseUrl: string, days: number) {
  const [source] = await db.select().from(sources).where(eq(sources.identity, baseUrl));
  if (!source) throw new Error(`nothing was imported from ${baseUrl}`);
  const taken = sql`now() - make_interval(days => ${days})`;
  await db.update(statements).set({ observedAt: taken }).where(eq(statements.sourceId, source.id));
  await db
    .update(identifiers)
    .set({ observedAt: taken })
    .where(eq(identifiers.sourceId, source.id));
  await db
    .update(placementSources)
    .set({ observedAt: taken })
    .where(eq(placementSources.sourceId, source.id));
}

/**
 * ADR-0036: TMDB forbids caching "any information" for longer than six months,
 * and declares it as `max_cache_age`. Until CNCORE-360 nothing read the
 * declaration, so the ceiling was honoured by not caching. Now every stored
 * value carries the moment it was taken, and a read refuses one older than its
 * Provider allows.
 */
describe("a Provider's cache ceiling", () => {
  // `MANIFEST` declares thirty days.
  const record = { ...TENTH_PLANET, external_ids: { imdb: "tt0000265" } };

  async function importedAndBrowsed(options: { maxCacheAge?: number | null } = {}) {
    const baseUrl = await stubProvider({ "265": record }, options);
    const { itemId } = await call(
      appRouter.provider.import,
      { baseUrl, recordId: "265" },
      { context },
    );
    const { containerId } = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: "388305" },
      { context },
    );
    return { baseUrl, itemId, containerId };
  }

  const fromTheProvider = (item: { statements: { sourceKind: string }[] }) =>
    item.statements.filter(({ sourceKind }) => sourceKind === "provider");

  it("refuses on read every value stored past the age the Provider declares", async () => {
    const { baseUrl, itemId, containerId } = await importedAndBrowsed();

    await ageEverythingFrom(baseUrl, 31);

    const item = await call(appRouter.item.get, { id: itemId }, { context });
    expect(fromTheProvider(item)).toEqual([]);
    expect(item.identifiers).toEqual([]);
    const container = await call(appRouter.item.get, { id: containerId }, { context });
    expect(container.holds.rows).toEqual([]);
  });

  it("serves what was stored inside that age", async () => {
    const { baseUrl, itemId, containerId } = await importedAndBrowsed();

    await ageEverythingFrom(baseUrl, 29);

    const item = await call(appRouter.item.get, { id: itemId }, { context });
    expect(fromTheProvider(item).length).toBeGreaterThan(0);
    expect(item.identifiers.map(({ scheme }) => scheme)).toEqual(["imdb"]);
    const container = await call(appRouter.item.get, { id: containerId }, { context });
    expect(container.holds.rows).toHaveLength(2);
  });

  it("takes a value afresh when the Provider says it again", async () => {
    const { baseUrl, itemId, containerId } = await importedAndBrowsed();
    await ageEverythingFrom(baseUrl, 31);

    await call(appRouter.provider.import, { baseUrl, recordId: "265" }, { context });
    await call(appRouter.provider.browse, { baseUrl, containerId: "388305" }, { context });

    const item = await call(appRouter.item.get, { id: itemId }, { context });
    expect(fromTheProvider(item).length).toBeGreaterThan(0);
    expect(item.identifiers.map(({ scheme }) => scheme)).toEqual(["imdb"]);
    const container = await call(appRouter.item.get, { id: containerId }, { context });
    expect(container.holds.rows).toHaveLength(2);
  });

  it("refuses nothing from a Provider that declares no ceiling", async () => {
    const { baseUrl, itemId, containerId } = await importedAndBrowsed({ maxCacheAge: null });

    await ageEverythingFrom(baseUrl, 3650);

    const item = await call(appRouter.item.get, { id: itemId }, { context });
    expect(fromTheProvider(item).length).toBeGreaterThan(0);
    expect(item.identifiers).toHaveLength(1);
    const container = await call(appRouter.item.get, { id: containerId }, { context });
    expect(container.holds.rows).toHaveLength(2);
  });
});

/**
 * ADR-0033: "a third party's licence terms stay declared fields rather than
 * special cases in our core", and ADR-0036 is the licence that makes it concrete.
 * The app takes the obligation off the manifest and writes it beside the source
 * that imposed it, so every claim that source made can be traced back to the
 * words the app owes for showing it.
 */
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

  /**
   * A NOTICE THIS APP CANNOT PRINT REFUSES THE PROVIDER WHOLE, AND THE ROW IS
   * WHERE THAT IS PROVED (ADR-0123, CNCORE-213).
   *
   * The parse test shows the manifest is refused. What it cannot show is that
   * nothing was written anyway: content arriving with no notice this app will
   * print is the breach the refusal exists to prevent. Every row an import
   * writes names its Source, so no Source row means nothing arrived from it.
   */
  it("writes nothing from a Provider whose notice runs past the ceiling, and says which field", async () => {
    const baseUrl = await stubProvider(undefined, {
      attribution: { ...ATTRIBUTION, notice: "n".repeat(1_001) },
    });

    const { error } = await safe(
      call(appRouter.provider.import, { baseUrl, recordId: "265" }, { context }),
    );

    if (!isDefinedError(error)) throw new Error(`expected a defined error, got ${String(error)}`);
    expect(error.code).toBe("PROVIDER_REFUSED");
    // THE PROVIDER'S FAULT, IN WORDS THAT NAME THE FIELD, which is what the
    // Owner reads. It is zod's issue list, so the path is what says why.
    expect(error.data).toMatchObject({
      wrote: "provider",
      text: expect.stringContaining('"attribution", "notice"'),
    });
    expect(await db.select().from(sources).where(eq(sources.identity, baseUrl))).toEqual([]);
  });
});

/**
 * A PROVIDER'S DECLARED NAME IS THE SOURCE'S LABEL, AND THE LABEL IS ON EVERY
 * ITEM PAGE (ADR-0123, CNCORE-165).
 *
 * ASSERTED ON THE ROW AND NOT ONLY ON THE PARSE, because the row is what
 * outlives the request. `@canoncore/providers` proves the manifest is bounded
 * where it is read; what it cannot prove is that nothing between that read and
 * this write went back for the raw value -- and a label written once is printed
 * beside every value that source ever claimed, on pages the provider does not
 * own, for as long as the row exists.
 */
describe("a Provider's declared name", () => {
  it("reaches the Source it names bounded, whatever length the provider chose", async () => {
    const baseUrl = await stubProvider(undefined, { name: "n".repeat(100_000) });

    await call(appRouter.provider.import, { baseUrl, recordId: "265" }, { context });

    const [source] = await db.select().from(sources).where(eq(sources.identity, baseUrl));
    expect(source?.label.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
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
    const walledOff = { ...context, providerSettings: reaching({ allowlist: "" }) };
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

    const walledOff = { ...context, providerSettings: reaching({ allowlist: "" }) };
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
    // The DEFAULT, parsed by the real parser: an instance nobody has configured
    // holds the empty string, and the empty string refuses everything.
    const unconfigured = { ...context, providerSettings: reaching({ allowlist: "" }) };

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
    const searching = { ...context, providerSettings: reaching({ providers: [baseUrl] }) };

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
    const searching = {
      ...context,
      providerSettings: reaching({ providers: [refused, answering] }),
    };

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
    const searching = { ...context, providerSettings: reaching({ providers: [baseUrl] }) };

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
    const searching = { ...context, providerSettings: reaching({ providers: [baseUrl] }) };

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
 * WHICH PROVIDERS ARE ASKED FOLLOWS THE GROUP (ADR-0025, ADR-0010, CNCORE-182).
 *
 * A Group picks which Providers are asked on its behalf, which is what delivers
 * "this Group prefers the wiki": a Group that never asks TMDB is never answered
 * by it. Asserted by what each stub was ASKED rather than only by what came
 * back, because "not asked" is a claim about a request that never happened, and
 * a Provider that was asked and failed would otherwise look the same.
 */
describe("provider.search within a Group", () => {
  /*
   * THE GROUP IS BOUNDED HERE TOO (CNCORE-309, ADR-0182), and this is the THIRD
   * seam rather than a repeat of the catalogue's two.
   *
   * `/import` READS IT WITH THE SAME `oneGroup` the three listings do, and the
   * declaration above this one says so in its own words -- "for the reason
   * `listingInput` gives for the same parameter". It is not a parameter that
   * RESEMBLES that one; it is that one, arriving at a different router. A
   * ceiling that stopped at `catalogue.ts` would have left the same value
   * unbounded one page over, which is ADR-0160's stated cost -- "a caller
   * reaching it directly does not inherit the bound" -- reappearing at the seam
   * nobody had counted.
   *
   * FOUND BY REVIEW OF THIS PASS rather than by either ticket: CNCORE-284 named
   * the read path and the links, CNCORE-309 named the parameter beside it, and
   * neither counted the routers. The as-built block of ADR-0182 claimed both
   * seams were closed while this one was open.
   */
  it("refuses a Group above the ceiling, and accepts one at it", async () => {
    await expect(
      call(
        appRouter.provider.search,
        { query: "tenth planet", group: "x".repeat(A_NARROWING + 1) },
        { context },
      ),
    ).rejects.toThrow("Input validation failed");

    // AT THE CEILING IT ASKS NOBODY, which is what a Group naming nothing does
    // here: the answer rather than a BAD_REQUEST, exactly as the declaration
    // says. A ceiling on the LENGTH does not change that.
    await expect(
      call(
        appRouter.provider.search,
        { query: "tenth planet", group: "x".repeat(A_NARROWING) },
        { context },
      ),
    ).resolves.toBeDefined();
  });

  it("asks only the Providers the Group asks, and none of the others this instance searches", async () => {
    const wikiAsked: string[] = [];
    const tmdbAsked: string[] = [];
    const wiki = await stubProvider(undefined, { asked: wikiAsked });
    const tmdb = await stubProvider(undefined, { name: "provider-tmdb", asked: tmdbAsked });
    const searching = { ...context, providerSettings: reaching({ providers: [wiki, tmdb] }) };
    const { id: group } = await call(
      appRouter.group.create,
      { name: "Doctor Who, asking the wiki" },
      { context },
    );
    await call(appRouter.group.ask, { id: group, baseUrl: wiki }, { context: searching });

    const { answered, failed } = await call(
      appRouter.provider.search,
      { query: "tenth planet", group },
      { context: searching },
    );

    expect(answered.map(({ provider: p }) => p.baseUrl)).toStrictEqual([wiki]);
    expect(failed).toStrictEqual([]);
    expect(tmdbAsked).toStrictEqual([]);
    expect(wikiAsked).not.toStrictEqual([]);
  });

  it("asks the Group's Providers among those this instance still names, in its order", async () => {
    // A GROUP PICKS AMONG THE CONFIGURED PROVIDERS RATHER THAN ADDING TO THEM.
    // One the Owner has since removed from settings is asked by nothing, Group
    // or not. And the answer comes back in the INSTANCE's order rather than the
    // Group's, which is ADR-0025 at the size of a results page: nothing about
    // a Provider's standing changes with the scope it is asked from.
    const wikiAsked: string[] = [];
    const wiki = await stubProvider(undefined, { asked: wikiAsked });
    // AND ONE THE GROUP NEVER ASKS, still configured, so the narrowing itself is
    // under test here and not only the filter: a search that forgot the Group
    // would ask it, where this one must not. Review found the test passing
    // with the narrowing deleted, because settings alone left the wiki out.
    const unaskedAsked: string[] = [];
    const unasked = await stubProvider(undefined, { asked: unaskedAsked });
    const [first, second] = [await stubProvider(), await stubProvider()].sort().reverse();
    if (first === undefined || second === undefined) throw new Error("two stubs, two URLs");
    const everything = {
      ...context,
      providerSettings: reaching({ providers: [wiki, first, second] }),
    };
    const { id: group } = await call(
      appRouter.group.create,
      { name: "Asks three, one since removed" },
      { context },
    );
    // ASKED IN THE REVERSE OF THE INSTANCE'S ORDER, so the answer's order is
    // the instance's and not the order these writes happened to land in.
    for (const baseUrl of [second, first, wiki]) {
      await call(appRouter.group.ask, { id: group, baseUrl }, { context: everything });
    }

    const { answered } = await call(
      appRouter.provider.search,
      { query: "tenth planet", group },
      {
        context: {
          ...context,
          providerSettings: reaching({ providers: [first, unasked, second] }),
        },
      },
    );

    expect(answered.map(({ provider: p }) => p.baseUrl)).toStrictEqual([first, second]);
    expect(wikiAsked).toStrictEqual([]);
    expect(unaskedAsked).toStrictEqual([]);
  });

  it("stops asking a Provider the Owner told the Group to stop asking", async () => {
    const asked: string[] = [];
    const wiki = await stubProvider(undefined, { asked });
    const searching = { ...context, providerSettings: reaching({ providers: [wiki] }) };
    const { id: group } = await call(
      appRouter.group.create,
      { name: "Asked the wiki, then stopped" },
      { context },
    );
    await call(appRouter.group.ask, { id: group, baseUrl: wiki }, { context: searching });

    await call(appRouter.group.stopAsking, { id: group, baseUrl: wiki }, { context: searching });

    expect(
      await call(
        appRouter.provider.search,
        { query: "tenth planet", group },
        { context: searching },
      ),
    ).toStrictEqual({ answered: [], failed: [] });
    expect(asked).toStrictEqual([]);
  });

  it("asks nobody within a Group that asks no Provider, or that is not there", async () => {
    // ADR-0025's sentence read literally: a Group the Owner never told to ask
    // anything is answered by nothing. Every configured Provider would be the
    // other reading, and it would make every new scope ask TMDB until the Owner
    // thought to say otherwise. A Group that names nothing -- deleted since the
    // link was kept, or no id at all -- is the same answer, for ADR-0066's
    // reason: whether it names anything is what the answer says, so a typo in a
    // shared link is not a 500.
    const asked: string[] = [];
    const wiki = await stubProvider(undefined, { asked });
    const searching = { ...context, providerSettings: reaching({ providers: [wiki] }) };
    const { id: toldNothing } = await call(
      appRouter.group.create,
      { name: "A scope that asks nobody" },
      { context },
    );

    for (const group of [toldNothing, crypto.randomUUID(), "not-a-group"]) {
      expect(
        await call(
          appRouter.provider.search,
          { query: "tenth planet", group },
          { context: searching },
        ),
      ).toStrictEqual({ answered: [], failed: [] });
    }
    expect(asked).toStrictEqual([]);
  });
});

/**
 * AND THE SOURCE ORDER IS THE SAME IN EVERY GROUP (ADR-0025).
 *
 * A Group chooses who is ASKED on its behalf. It does not choose whose claims
 * are READ, and it never re-ranks them: an Item in two Groups is one Item with
 * one title, at one address. Per-Group ranking is refused because the Item in
 * both would otherwise have two answers for one field -- so these are the cases
 * a per-Group reading would get wrong, asserted where the Owner meets them: the
 * Catalogue, narrowed to each Group in turn.
 */
describe("the source order within a Group", () => {
  /** The one Item, narrowed to each Group in turn, as the Catalogue titles it. */
  async function titledWithin(groups: string[], item: string) {
    return Promise.all(
      groups.map(async (group) => {
        const { rows } = await call(appRouter.catalogue.list, { group }, { context });
        return rows.find(({ id }) => id === item)?.title;
      }),
    );
  }

  /** An Item imported from `wiki`, in a Group that asks the wiki and one that asks nobody. */
  async function inTwoScopes() {
    const wiki = await stubProvider();
    const asking = { ...context, providerSettings: reaching({ providers: [wiki] }) };
    const { itemId } = await call(
      appRouter.provider.import,
      { baseUrl: wiki, recordId: "265" },
      { context },
    );
    const scopes = [];
    for (const name of ["Asks the wiki", "Asks nobody"]) {
      const { id } = await call(appRouter.group.create, { name }, { context });
      await call(appRouter.group.put, { groupId: id, itemId }, { context });
      scopes.push(id);
    }
    const [asksTheWiki] = scopes;
    if (asksTheWiki === undefined) throw new Error("two scopes were drawn");
    await call(appRouter.group.ask, { id: asksTheWiki, baseUrl: wiki }, { context: asking });
    return { itemId, scopes };
  }

  it("reads a Provider's claim in a Group that never asks that Provider", async () => {
    // THE ACCEPTED COST, AT ITS SHARPEST. The wiki's claim came in by import,
    // which names one Provider and no Group, and it is the catalogue's now: the
    // scope that asks nobody reads the same title as the scope that asks the
    // wiki, because a Group filters who is asked and not what the catalogue
    // holds. Nothing this ticket built makes this pass; it guards against a
    // per-Group reading of claims arriving later.
    const { itemId, scopes } = await inTwoScopes();

    expect(await titledWithin(scopes, itemId)).toStrictEqual([
      "The Tenth Planet (TV story)",
      "The Tenth Planet (TV story)",
    ]);
  });

  it("ranks the Owner's title above the Provider's in every Group, whoever each asks", async () => {
    // TWO SOURCES FOR ONE FIELD, and the order between them is the instance's:
    // the Owner at 0, the Provider after. Neither scope moves it, including the
    // one that asks the Provider and so might be read as preferring it.
    const { itemId, scopes } = await inTwoScopes();

    await call(appRouter.item.retitle, { id: itemId, title: "The Tenth Planet" }, { context });

    expect(await titledWithin(scopes, itemId)).toStrictEqual([
      "The Tenth Planet",
      "The Tenth Planet",
    ]);
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
      context: { ...context, providerSettings: reaching({ providers: [baseUrl] }) },
    });

    expect(answer).toStrictEqual({ providers: [baseUrl] });
  });

  it("answers with none where none is configured, rather than refusing", async () => {
    // An instance that has named none is the empty string, which names no
    // provider. That is an ANSWER a surface has to be able to put in front of an
    // owner -- an instance nobody has configured and one that is broken look
    // identical otherwise -- rather than an error.
    const answer = await call(appRouter.provider.configured, undefined, {
      context: { ...context, providerSettings: reaching({ providers: [] }) },
    });

    expect(answer).toStrictEqual({ providers: [] });
  });
});

/**
 * WHAT THIS CATALOGUE ALREADY HOLDS OF ONE PROVIDER'S RECORDS, asked about ids the
 * owner names rather than about a query.
 *
 * `search` answers the same question for the candidates IT found. This is for the
 * record the owner names themselves -- a container id, picked from what a
 * provider lists or typed where it lists nothing (ADR-0033) -- so there is no
 * search to carry the answer.
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

  it("refuses a visitor with no session, because answering costs a whole browse", async () => {
    /*
     * THE ONE READ ON THIS SURFACE THAT IS THE OWNER'S (ADR-0131, CNCORE-154).
     * Every other `openProcedure` here answers out of this catalogue's own rows;
     * this one answers by asking a third party, and it answers by running the
     * WHOLE browse -- the same work `provider.browse` does, which is an
     * `ownerProcedure`. CNCORE-151 raised that browse's cap to 60s, so an open
     * procedure could hold a provider for a minute per call for anyone who could
     * reach the instance.
     *
     * REFUSED BEFORE THE PROVIDER IS REACHED, which is the whole point and is
     * what this asserts by giving a `baseUrl` no socket is listening on: a guard
     * that ran after the fetch would answer `unreachable` here rather than
     * `UNAUTHORIZED`, and would have spent the browse it exists to save.
     */
    const { error } = await safe(
      call(
        appRouter.provider.container,
        { baseUrl: "http://127.0.0.1:1/", containerId: "388305" },
        { context: asAVisitor },
      ),
    );

    expect((error as { code?: string })?.code).toBe("UNAUTHORIZED");
  });
});

/**
 * A container as `/containers` answers it: a record like any other (ADR-0004),
 * and on the wiki a timeline -- the one kind that provider lists (ADR-0033
 * under CNCORE-186).
 */
const aTimeline = (id: string, subject: string) => ({
  id,
  title: `Theory:Timeline - ${subject}`,
  kind: "timeline",
  released: [],
  writers: [],
  series: null,
  url: `https://tardis.wiki/wiki/Theory:Timeline_-_${subject.replaceAll(" ", "_")}`,
});

/** Five timelines, IN THE PROVIDER'S ORDER, which is not the order of their ids. */
const FIVE_TIMELINES = [
  aTimeline("416127", "Scaroth"),
  aTimeline("258752", "107 Baker Street"),
  aTimeline("286338", "War Child Master"),
  aTimeline("300001", "Sarah Jane Smith"),
  aTimeline("112233", "Brigadier"),
];

/** A provider declaring the operation, holding these. */
const aProviderListing = (listed: unknown[], asked: string[] = []) =>
  stubProvider(
    { "265": TENTH_PLANET },
    { operations: ["search", "lookup", "browse", "containers"], listed, asked },
  );

describe("provider.containers", () => {
  it("offers the containers a provider holds, in its own order and by their titles", async () => {
    /*
     * WHAT THE OWNER PICKS FROM, rather than an id they have to have found
     * somewhere outside the product (CNCORE-187). The provider's order is kept:
     * the wiki answers its timelines by title, and a list re-sorted here by id
     * would put `112233` first.
     */
    const baseUrl = await aProviderListing(FIVE_TIMELINES);

    const answer = await call(appRouter.provider.containers, { baseUrl }, { context });

    if (answer.answer !== "containers") throw new Error(`answered ${answer.answer}`);
    expect(answer.providerName).toBe("provider-wiki");
    expect(answer.containers.map(({ containerId, title }) => [containerId, title])).toEqual(
      FIVE_TIMELINES.map(({ id, title }) => [id, title]),
    );
    expect(answer.containers[0]).toMatchObject({ kind: "timeline", itemId: null });
    expect(answer).toMatchObject({ total: 5, continuesAfter: null, continuesBefore: null });
  });

  it("walks the list a page at a time, repeating none and skipping none", async () => {
    /*
     * WALKED RATHER THAN RENDERED WHOLE, because a provider may hold hundreds
     * -- the wiki holds 465 -- and ADR-0119's cursor is the walk every list in
     * this product takes: the provider's own id for the last container a page
     * showed. The provider answers all of them at once, since the operation
     * carries no cursor (ADR-0033), so the walk is this app's over that answer.
     */
    const baseUrl = await aProviderListing(FIVE_TIMELINES);
    const page = async (at: { after?: string; before?: string }) => {
      const answer = await call(
        appRouter.provider.containers,
        { baseUrl, limit: 2, ...at },
        { context },
      );
      if (answer.answer !== "containers") throw new Error(`answered ${answer.answer}`);
      return answer;
    };

    const first = await page({});
    const second = await page({ after: first.continuesAfter ?? "" });
    const third = await page({ after: second.continuesAfter ?? "" });

    expect(
      [first, second, third].map(({ containers }) => containers.map((c) => c.containerId)),
    ).toEqual([["416127", "258752"], ["286338", "300001"], ["112233"]]);
    expect([first, second, third].map(({ total }) => total)).toEqual([5, 5, 5]);
    // AND EACH SAYS WHICH OF THEM IT IS SHOWING (ADR-0133). Here the count is
    // free: the provider answered the whole list, so where a page starts in it
    // is the index the page was cut at rather than a second query.
    expect([first, second, third].map(({ rowsBefore }) => rowsBefore)).toEqual([0, 2, 4]);
    expect(first).toMatchObject({ continuesBefore: null, continuesAfter: "258752" });
    expect(third).toMatchObject({ continuesBefore: "112233", continuesAfter: null });

    // AND A STEP BACK IS THE PAGE IT CAME FROM (CNCORE-174), not the start.
    const back = await page({ before: third.continuesBefore ?? "" });
    expect(back.containers).toEqual(second.containers);
    expect(back.rowsBefore).toBe(2);
    // BUT ONE THAT WOULD RUN PAST THE START ANSWERS THE FIRST PAGE WHOLE, the
    // cursor's own container included, rather than the one short of it.
    const toTheStart = await page({ before: "258752" });
    expect(toTheStart).toMatchObject({
      containers: first.containers,
      continuesBefore: null,
      rowsBefore: 0,
    });
  });

  it("starts at the beginning from a cursor naming nothing, and refuses a page past the cap", async () => {
    // THE LISTING CONTRACT'S TWO REMAINING QUESTIONS, asked here because this
    // walk is not a catalogue Listing and `listing.test.ts` cannot reach it: a
    // bookmark outliving the container it was cut at gets the list rather than
    // an error (ADR-0119), and the ceiling is this app's rather than a caller's.
    const baseUrl = await aProviderListing(FIVE_TIMELINES);

    const gone = await call(
      appRouter.provider.containers,
      { baseUrl, limit: 2, after: "a container it no longer lists" },
      { context },
    );
    const { error } = await safe(
      call(appRouter.provider.containers, { baseUrl, limit: 101 }, { context }),
    );

    expect(gone).toMatchObject({
      answer: "containers",
      containers: [{ containerId: "416127" }, { containerId: "258752" }],
      continuesBefore: null,
    });
    expect((error as { code?: string })?.code).toBe("BAD_REQUEST");
  });

  it("offers a container the provider answered twice once, so the walk still ends", async () => {
    /*
     * THE CURSOR IS AN ID, SO THE WALK NEEDS EACH ID ONCE, and nothing in CMPP
     * says a provider's answer has that. Found by review of CNCORE-187: with a
     * repeat, `Next` from the page ending on the second copy found the FIRST
     * copy and served the same page again, forever. A container offered twice
     * is no more pickable than one offered once, so the first copy stands.
     */
    const [scaroth, bakerStreet, warChild] = FIVE_TIMELINES;
    const baseUrl = await aProviderListing([scaroth, bakerStreet, warChild, bakerStreet]);
    const seen: string[] = [];
    let after: string | undefined;
    for (let turns = 0; turns < 5; turns++) {
      const answer = await call(
        appRouter.provider.containers,
        { baseUrl, limit: 2, after },
        { context },
      );
      if (answer.answer !== "containers") throw new Error(`answered ${answer.answer}`);
      seen.push(...answer.containers.map(({ containerId }) => containerId));
      if (answer.continuesAfter === null) break;
      after = answer.continuesAfter;
    }

    expect(seen).toEqual(["416127", "258752", "286338"]);
  });

  it("says a provider does not offer them, and does not ask it for them", async () => {
    /*
     * AN ABSENT CAPABILITY IS NOT AN EMPTY ANSWER (ADR-0033 under CNCORE-185),
     * which is the Owner's own story 60. `provider-tmdb` declines, because TMDB
     * publishes nothing that lists its collections and series -- and a page
     * reading "holds no containers" about it would be false.
     *
     * THE MANIFEST DECIDES, as it does for `browse`: a decliner is never asked.
     */
    const asked: string[] = [];
    const baseUrl = await stubProvider(
      { "265": TENTH_PLANET },
      { operations: ["search", "lookup", "browse"], asked },
    );

    const answer = await call(appRouter.provider.containers, { baseUrl }, { context });

    expect(answer).toEqual({ answer: "containers-not-offered", providerName: "provider-wiki" });
    expect(asked).toEqual(["/"]);
  });

  it("says a provider could not answer, in its own words, rather than that it holds none", async () => {
    /*
     * THE THIRD ANSWER, AND THE ONE ADR-0033 SAW LIVE: `provider-wiki` with a
     * lapsed Credential answered its manifest, declaring the operation, and
     * then `503` at `/containers` naming `/unlock`. An empty list here would
     * tell the Owner their provider holds nothing, when what it needs is a
     * session -- so the reason travels, attributed to the provider that wrote
     * it (ADR-0123). Review of CNCORE-187 found this test refusing at the
     * MANIFEST while its comment claimed this path; the case below is that one.
     */
    const baseUrl = await stubProvider(
      {},
      { operations: ["search", "lookup", "browse", "containers"], refusesContainersWith: LAPSED },
    );

    const answer = await call(appRouter.provider.containers, { baseUrl }, { context });

    expect(answer).toMatchObject({
      answer: "unreachable",
      reason: { wrote: "provider", text: expect.stringContaining(LAPSED) },
    });
  });

  it("says so too when the provider refuses before it has said what it offers", async () => {
    // A `503` ON EVERY PATH, the manifest included, which is CNCORE-100's
    // expired `cf_clearance`: nothing is known about the operation at all, and
    // that is still not a provider holding none.
    const baseUrl = await stubProviderRefusingWith(LAPSED);

    const answer = await call(appRouter.provider.containers, { baseUrl }, { context });

    expect(answer).toMatchObject({
      answer: "unreachable",
      reason: { wrote: "provider", text: expect.stringContaining(LAPSED) },
    });
  });

  it("offers ids a browse takes, and names the Item one landed as", async () => {
    /*
     * PICKED FROM THE LIST, IMPORTED BY ID: the id this answers is the one
     * `browse` takes, so an import from the list is a browse by id and lands
     * what one lands (CNCORE-187). ADR-0033's conformance witness asserts the
     * provider's half -- an id it listed is an id it will browse -- and this is
     * the app's.
     */
    const baseUrl = await stubProvider(
      {},
      {
        operations: ["search", "lookup", "browse", "containers"],
        containers: { "388305": VASHTA_NERADA },
        listed: [VASHTA_NERADA.container],
      },
    );
    const before = await call(appRouter.provider.containers, { baseUrl }, { context });
    if (before.answer !== "containers") throw new Error(`answered ${before.answer}`);
    const [offered] = before.containers;
    if (!offered) throw new Error("the provider listed nothing");

    const landed = await call(
      appRouter.provider.browse,
      { baseUrl, containerId: offered.containerId },
      { context },
    );
    const after = await call(appRouter.provider.containers, { baseUrl }, { context });

    expect(offered.itemId).toBeNull();
    expect(landed.placements).toHaveLength(2);
    expect(after).toMatchObject({
      containers: [{ containerId: "388305", itemId: landed.containerId }],
    });
  });

  it("answers a visitor too, because it costs a search's time and not a browse's", async () => {
    // ADR-0131's LINE IS THE `patient` CAP, and this operation is `brief`: the
    // demo is shown what a provider holds as it is shown what a search matched.
    const baseUrl = await aProviderListing(FIVE_TIMELINES);

    const answer = await call(appRouter.provider.containers, { baseUrl }, { context: asAVisitor });

    expect(answer).toMatchObject({ answer: "containers", total: 5 });
  });
});

/**
 * A SECOND CONTAINER, so that a walk has somewhere to walk TO. One container
 * proves a browse; two prove an order.
 */
const SONTARAN_STORIES = {
  container: {
    id: "402219",
    title: "Category:Sontaran television stories",
    kind: "category",
    released: [],
    writers: [],
    series: null,
    url: "https://tardis.wiki/wiki/Category:Sontaran_television_stories",
  },
  ordering: [
    {
      position: 1,
      record: {
        id: "104112",
        title: "The Time Warrior (TV story)",
        kind: "TV story",
        released: ["1973-12-15"],
        writers: ["Robert Holmes"],
        series: null,
        url: "https://tardis.wiki/wiki/The_Time_Warrior_(TV_story)",
      },
    },
  ],
  unplaced: [],
};

/** A provider holding both containers, which is the least a list needs. */
const aProviderOfTwoContainers = (asked: string[] = []) =>
  stubProvider(
    { "265": TENTH_PLANET },
    { containers: { "388305": VASHTA_NERADA, "402219": SONTARAN_STORIES }, asked },
  );

/**
 * THE LIST, IN AN ORDER THAT IS NOT THE ORDER ANYTHING ELSE WOULD PUT IT IN.
 * Sorted, these read 388305 then 402219 -- so a walk that lost the Owner's own
 * order and fell back on the ids would answer the other way round.
 */
const THE_LIST = ["402219", "388305"];

/**
 * A CONTAINER ID SHAPED LIKE A PAGE TITLE, which is the shape CNCORE-268's
 * ceiling leaves room for: `provider-wiki` sends pageids, but CMPP declares an
 * id as `z.string().min(1)` and a Provider may send a title instead. The
 * padding below is derived from it rather than written out, so the fixtures
 * cannot drift from the prefix and quietly stop being the lengths they claim.
 */
const A_TITLE = "Theory:Timeline - ";

/**
 * A RECORD THAT NAMES THE CONTAINER IT SITS IN, which is TMDB's shape rather
 * than the wiki's (CNCORE-238).
 *
 * A record that SITS IN a Container carries `series_id` on a lookup and a
 * browse and never on a search; a record that IS one carries none (ADR-0149).
 * `provider-tmdb`'s `searchResultToRecord` hardcodes `null` at `46a1189`
 * because TMDB's multi-search carries no collection and filling one would cost
 * a request per result. This sentence said "on a LOOKUP and never on a search"
 * until CNCORE-264, which left out the browse half entirely. `TENTH_PLANET` above is the other shape and is the fixture for a
 * record that names none: `provider-wiki` sends no `series_id` at all, since a
 * story sits in many timelines at once.
 */
const THE_MATRIX = {
  id: "movie:603",
  title: "The Matrix",
  kind: "movie",
  released: ["1999-03-31"],
  writers: ["Lana Wachowski", "Lilly Wachowski"],
  series: "The Matrix Collection",
  series_id: "collection:2344",
  url: "https://www.themoviedb.org/movie/603",
};

describe("provider.containerOf", () => {
  it("answers the container a record names, by the id a browse takes", async () => {
    /*
     * THE ID, WHICH IS THE WHOLE OF WHAT THE OWNER CANNOT SEE. A search
     * candidate carries no `series_id` (ADR-0033 under CNCORE-187), so until
     * this the only way from a found record to its container was typing an id
     * the provider never showed anyone. The NAME travels beside it because a
     * name can be renamed out from under an import and the id cannot.
     */
    const baseUrl = await stubProvider({ "movie:603": THE_MATRIX });

    const answer = await call(
      appRouter.provider.containerOf,
      { baseUrl, recordId: "movie:603" },
      { context },
    );

    expect(answer).toEqual({
      answer: "container",
      providerName: "provider-wiki",
      recordTitle: "The Matrix",
      containerId: "collection:2344",
      containerTitle: "The Matrix Collection",
    });
  });

  it("says a provider names no container for a record, rather than answering one", async () => {
    /*
     * THE ORDINARY ANSWER AT `provider-wiki`, not the exceptional one. A story
     * sits in MANY timelines at once, so that provider sends no `series_id` for
     * any record it holds -- `TENTH_PLANET` names a `series` and no id, which
     * is the shape (ADR-0033).
     *
     * IT MUST NOT READ AS "the provider could not be reached" OR AS a container
     * whose id is empty: the page's whole job here is to offer a way onward
     * only where one exists, and a link to nothing is worse than a sentence.
     */
    const baseUrl = await stubProvider();

    const answer = await call(
      appRouter.provider.containerOf,
      { baseUrl, recordId: "265" },
      { context },
    );

    expect(answer).toEqual({
      answer: "no-container",
      providerName: "provider-wiki",
      recordTitle: "The Tenth Planet (TV story)",
    });
  });

  it("reads an empty container id as naming none, rather than answering a 500", async () => {
    /*
     * A WELL-FORMED CMPP ANSWER THIS UNION HAD NO ARM FOR. `cmppRecord` holds
     * `series_id` to `z.string().nullable()` with NO `.min(1)`, so `""` parses
     * clean and reaches the handler as a string -- past a `=== null` guard, into
     * the `container` arm, and onto an output schema demanding `.min(1)`.
     *
     * WHICH FAILS OUTSIDE THE `try`, because oRPC validates what the handler
     * RETURNED. So the one thing this procedure exists to prevent -- a provider
     * having a bad day taking `/import` down with a 500 -- is exactly what an
     * empty string did. Found by review; this is the assertion that was missing.
     *
     * AN EMPTY ID NAMES NO CONTAINER, which is ADR-0066's reading: an id that
     * cannot BE an identity addresses nothing, exactly as one nobody minted
     * does. So it is the answer beside it rather than a fourth arm.
     */
    const baseUrl = await stubProvider({
      "movie:603": { ...THE_MATRIX, series: "", series_id: "" },
    });

    const answer = await call(
      appRouter.provider.containerOf,
      { baseUrl, recordId: "movie:603" },
      { context },
    );

    expect(answer).toEqual({
      answer: "no-container",
      providerName: "provider-wiki",
      recordTitle: "The Matrix",
    });
  });

  it("carries no name for a container the provider named an id and no name for", async () => {
    /*
     * THE TWO FIELDS ARE INDEPENDENT, and a provider sending an id with no name
     * is well-formed. The id is what a browse takes, so the way onward exists;
     * what is absent is the words to render it under, and `null` is how the
     * page is told to fall back rather than link an empty string.
     *
     * `""` AND `null` ARRIVE AS ONE ANSWER HERE, because a name nobody can read
     * is not a name -- and the alternative is an output schema that refuses it
     * and a 500 for the trouble.
     */
    const baseUrl = await stubProvider({
      "movie:603": { ...THE_MATRIX, series: "" },
    });

    const answer = await call(
      appRouter.provider.containerOf,
      { baseUrl, recordId: "movie:603" },
      { context },
    );

    expect(answer).toMatchObject({
      answer: "container",
      containerId: "collection:2344",
      containerTitle: null,
    });
  });

  it("costs one lookup and no browse, which is what makes it the Owner's to ask for", async () => {
    /*
     * WHAT THE READ COSTS, ASSERTED RATHER THAN INTENDED. The design of this
     * ticket is that reaching a container costs ONE lookup on a click instead
     * of one per search result -- and the cheap half of that is only true while
     * nothing here browses. A procedure that resolved the id and then previewed
     * it would spend ADR-0130's `patient` cap on a read ADR-0131 leaves open,
     * which is the exact trade that record refuses.
     *
     * THE PATHS ARE THE WITNESS. An answer cannot show what was NOT asked: a
     * provider that was never browsed and one that answered a browse look the
     * same from the union above.
     */
    const asked: string[] = [];
    const baseUrl = await stubProvider({ "movie:603": THE_MATRIX }, { asked });

    const answer = await call(
      appRouter.provider.containerOf,
      { baseUrl, recordId: "movie:603" },
      { context },
    );

    expect(answer).toMatchObject({ answer: "container", containerId: "collection:2344" });
    // THE MANIFEST AND THE ONE LOOKUP. The manifest is first and serial, which
    // is what makes ADR-0131's sum for this procedure two `brief` operations.
    expect(asked).toEqual(["/", "/lookup/movie%3A603"]);
  });

  it("is a visitor's to ask, which is the line ADR-0131 draws at the patient cap", async () => {
    /*
     * ADR-0131's RULE APPLIED, NOT ITS CONCLUSION COPIED. That record put
     * `provider.container` behind the Owner because it runs a whole browse --
     * the only operation on the 60-second `patient` cap -- and said in terms
     * that the test to apply to the next read is what it SPENDS. A `lookup` is
     * `brief` (ADR-0130), so this is `provider.search`'s case: open, and a
     * visitor to ADR-0044's demo may follow a record to the container it names
     * exactly as they may search for the record.
     *
     * WHAT STAYS SHUT IS THE PREVIEW THIS LEADS TO, which is still the browse
     * and still `provider.container`'s. This widens nothing.
     */
    const baseUrl = await stubProvider({ "movie:603": THE_MATRIX });

    const answer = await call(
      appRouter.provider.containerOf,
      { baseUrl, recordId: "movie:603" },
      { context: asAVisitor },
    );

    expect(answer).toMatchObject({ answer: "container", containerId: "collection:2344" });
  });

  it("says the provider holds no record at that id, and not that it names no container", async () => {
    /*
     * TWO ANSWERS THAT MUST NOT READ ALIKE. "this record names no container"
     * is a claim about a record the provider HAS; this is the provider saying
     * it has none, which ADR-0066 makes an answer rather than a failure -- and
     * an owner told the wrong one of the two goes looking for the wrong fix.
     */
    const baseUrl = await stubProvider();

    const answer = await call(
      appRouter.provider.containerOf,
      { baseUrl, recordId: "nothing-is-here" },
      { context },
    );

    expect(answer).toEqual({ answer: "no-such-record", providerName: "provider-wiki" });
  });

  it("says a provider could not be reached, in the words the owner can act on", async () => {
    /*
     * THE SAME RULE AS `provider.search`'s `failed` LIST AND `provider.container`'s
     * fourth arm (ADR-0123): bounded, and attributed to whoever wrote it. This
     * URL is refused by ADR-0034's allowlist before a socket opens, which is a
     * different thing to fix from a provider that is down.
     */
    const answer = await call(
      appRouter.provider.containerOf,
      { baseUrl: "http://169.254.169.254/", recordId: "movie:603" },
      { context },
    );

    expect(answer.answer).toBe("unreachable");
    expect(answer).toMatchObject({
      reason: { wrote: "canoncore", text: expect.stringContaining("allowlisted") },
    });
  });
});

describe("provider.beginImportRun", () => {
  it("opens a run over the list the Owner handed over, with nothing asked for yet", async () => {
    const baseUrl = await aProviderOfTwoContainers();

    const run = await call(
      appRouter.provider.beginImportRun,
      { baseUrl, containerIds: THE_LIST },
      { context },
    );

    expect(run.containers).toEqual([
      { containerId: "402219", outcome: "pending" },
      { containerId: "388305", outcome: "pending" },
    ]);
  });

  /**
   * NO REQUEST LEAVES THE APP HERE, which is what separates opening a run from
   * walking one. Opening writes down a list; it is `importNextContainer` that
   * spends a third party's time (ADR-0131), and an Owner who typed a list of 465
   * would otherwise wait out the whole walk before the first row of it existed.
   */
  it("asks the Provider nothing, because opening a run is writing a list down", async () => {
    const asked: string[] = [];
    const baseUrl = await aProviderOfTwoContainers(asked);

    await call(appRouter.provider.beginImportRun, { baseUrl, containerIds: THE_LIST }, { context });

    expect(asked).toEqual([]);
  });
  /**
   * WHAT THE OWNER MET INSTEAD WAS A 500, AND FOR THE WHOLE LIST. An unnarrowed
   * 23505 from `import_run_containers_named_once` escaped as a
   * `DrizzleQueryError`, which is not an `ORPCError`, so the mount logged it as
   * a fault and oRPC answered 500 -- "something broke" for a list the Owner
   * could have fixed in one edit, with none of the other 464 Containers
   * imported (CNCORE-254).
   *
   * `ImportRunRefused` TRANSLATED, AND NOTHING ELSE: a dead pool stays a fault,
   * which is the rule `group.put` and `item.create` each record about their
   * own.
   */
  it("answers BAD_REQUEST for a list naming one Container twice", async () => {
    const baseUrl = await aProviderOfTwoContainers();

    const { error } = await safe(
      call(
        appRouter.provider.beginImportRun,
        { baseUrl, containerIds: ["402219", "388305", "402219"] },
        { context },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
    /*
     * AND THE SENTENCE ITSELF, because the code alone is what let this ship
     * half-built: `ORPCError.toJSON` serialises `{defined, code, status,
     * message, data}` and drops `cause`, so a handler passing only the cause
     * answers the DECLARED sentence -- which names no id. A test asserting
     * `error.code` would pass on that, and the Owner would still be reading
     * "that list cannot be imported" with no way to find the repeat.
     */
    expect(error?.message).toBe("402219 is listed twice, at positions 1 and 3");
  });

  /**
   * AN ID'S LENGTH IS REFUSED HERE, AND THE SENTENCE SAYS SO (CNCORE-268).
   *
   * Nothing bounded it until now: `containerIds` was
   * `z.array(z.string().min(1)).min(1)`, a minimum and no maximum, so an
   * ordinary list reached `import_run_containers_named_once` -- a btree, which
   * cannot index a value over 2704 bytes. CNCORE-254 caught the 54000 that
   * comes back and turned it into a BAD_REQUEST, which stopped the 500 and left
   * a sentence that does not say why: the Owner read "the catalogue refused
   * that list" and was told neither which id nor that its length was the
   * problem.
   *
   * THE OPENING OF THE ID, NOT THE WHOLE OF IT. ADR-0123's rule is that a value
   * is bounded WHERE IT ENTERS a sentence, so the prose around it is
   * fixed-length and cannot be cut -- and an id refused for its length is
   * precisely the value that would eat the sentence explaining itself. 80 is
   * that record's ceiling for an interpolated value and the marker is one
   * character of it, so 79 of this id survive: 18 of `Theory:Timeline - ` and
   * 61 of the padding. Written out here rather than computed, so the assertion
   * cannot agree with the code by sharing its arithmetic.
   *
   * AND WHERE IT SITS, because the id the Owner reads back is cut and a cut id
   * is not something they can search their own file for. That is ADR-0154's
   * reading of the repeat's positions, one constraint over: a position in the
   * LIST, not a line of the file, since `theContainerIdsIn` drops blank lines
   * and `#` comments before an id reaches here.
   */
  it("answers BAD_REQUEST for a Container id longer than a Container id may be", async () => {
    const baseUrl = await aProviderOfTwoContainers();
    const overlong = A_TITLE + "x".repeat(300 - A_TITLE.length);

    const { error } = await safe(
      call(
        appRouter.provider.beginImportRun,
        { baseUrl, containerIds: ["402219", overlong] },
        { context },
      ),
    );

    expect(overlong).toHaveLength(300);
    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe(
      `Theory:Timeline - ${"x".repeat(61)}… is 300 characters, at position 2, and a Container id is at most 255`,
    );
  });

  /**
   * THE SECOND OF ADR-0123's TWO LEVERS, WHICH THIS TOOK ONLY ONE OF UNTIL
   * REVIEW. The cut answers how MUCH of a stranger's value lands in a sentence;
   * `CONTROLS` answers what that value may DO to the words around it. A
   * bidirectional override re-orders the glyphs on either side of itself, so an
   * id carrying one runs the clause naming the ceiling that refused it
   * backwards through the Owner's page -- and the cut alone does not touch it.
   *
   * THIS IS NOT A HYPOTHETICAL PROVIDER. `/import` lists a Provider's own
   * Containers for the Owner to pick from since CNCORE-187, so the id in this
   * sentence can be one a Provider chose rather than one the Owner typed, which
   * is exactly the "stranger choosing text on a page it does not own" ADR-0123
   * opens with.
   *
   * IT IS THE SAME HALF `@canoncore/tasks` WAS MISSING (CNCORE-274), found in a
   * fresh copy one ticket later, which is the argument for `boundedTo` applying
   * both levers in one call rather than publishing the cut for callers to
   * compose.
   */
  it("strips a bidirectional override from the id it quotes back", async () => {
    const baseUrl = await aProviderOfTwoContainers();
    // U+202E, right-to-left override: everything after it renders reversed.
    const reversing = `${A_TITLE}\u202e${"x".repeat(300 - A_TITLE.length - 1)}`;

    const { error } = await safe(
      call(appRouter.provider.beginImportRun, { baseUrl, containerIds: [reversing] }, { context }),
    );

    expect(reversing).toHaveLength(300);
    expect(error?.message).not.toContain("\u202e");
    expect(error?.message).toBe(
      `Theory:Timeline - ${"x".repeat(61)}… is 300 characters, at position 1, and a Container id is at most 255`,
    );
  });

  /**
   * THE SAME STRIP, TAKING EVERY CHARACTER THERE WAS (ADR-0179). The test above
   * proves the controls come out of an id with glyphs either side of them. An
   * id made of NOTHING BUT them bounds to the empty string, and this sentence
   * then opens with nothing -- " is 256 characters, at position 1, and a
   * Container id is at most 255", which names no id for the Owner to find.
   *
   * IT REACHES THIS SENTENCE RATHER THAN THE REPEAT'S, and that is why the
   * words cannot live at one site. 256 zero-width spaces are refused HERE for
   * their length, before `beginImportRun` ever sees the list (ADR-0160), so the
   * fix landing only in `@canoncore/db` would leave this half standing.
   *
   * THE WHOLE SENTENCE IS ASSERTED, as the two beside it are: what the fallback
   * protects is the SUBJECT of the clause, and a test checking only that the
   * message was non-empty would pass on a refusal that had lost it.
   */
  it("says the id was made only of characters that cannot be shown, rather than quoting nothing", async () => {
    const baseUrl = await aProviderOfTwoContainers();
    const unshowable = "\u200b".repeat(256);

    const { error } = await safe(
      call(appRouter.provider.beginImportRun, { baseUrl, containerIds: [unshowable] }, { context }),
    );

    expect(unshowable).toHaveLength(256);
    expect(error?.message).toBe(
      "an id made only of characters that cannot be shown is 256 characters, " +
        "at position 1, and a Container id is at most 255",
    );
  });

  /**
   * THE BOUND ITSELF, AND THE SIDE OF IT A LEGAL ID SITS ON. 255 is the longest
   * a Container id may be, not the first length refused, and a bound asserted
   * only from above passes just as well when it is written one character tight
   * -- which would refuse an id a Provider is entitled to use.
   *
   * IT ALSO WRITES, which is the half the refusal test cannot show. A bound
   * that let nothing through would satisfy every assertion about what it turns
   * away, so this one carries its id all the way into the run and reads it back
   * off `import_run_containers` through the report. 255 ASCII characters index
   * comfortably: `import_run_containers_named_once` refuses at 2704 BYTES, and
   * the test below writes the dearest id the bound admits, at 765.
   */
  it("opens a run over a Container id of exactly the length one may be", async () => {
    const baseUrl = await aProviderOfTwoContainers();
    const theLongest = A_TITLE + "x".repeat(255 - A_TITLE.length);

    const run = await call(
      appRouter.provider.beginImportRun,
      { baseUrl, containerIds: [theLongest] },
      { context },
    );

    expect(theLongest).toHaveLength(255);
    expect(run.containers).toEqual([{ containerId: theLongest, outcome: "pending" }]);
  });

  /**
   * THE BOUND CANNOT REACH THE CONSTRAINT IT PROTECTS, AT THE WORST ID IT
   * ADMITS. ADR-0160 rests on that: it is why 54000 stays a backstop in
   * `import-runs.ts` rather than a path the Owner can still walk, and it is
   * arithmetic until something writes one.
   *
   * THE WORST CASE IS NOT THE OBVIOUS ONE. `A_CONTAINER_ID` counts UTF-16
   * units, and a 4-byte character spends two of them, so an emoji id is
   * CHEAPER per unit than this. Three bytes in one unit is the dearest an id
   * can be, which is the CJK block: 255 units, 765 bytes, measured.
   *
   * AND INCOMPRESSIBLE, which is the trap CNCORE-268 was filed with. TOAST
   * compresses before the index sees the value, so `repeat('9', 3000)` writes
   * perfectly well and an id built that way would prove nothing about its
   * length -- reproduced on this tree's PostgreSQL 18.6, where the compressible
   * 3000-character value inserted and an 8000-character hash string did not.
   * These code points are drawn off a sha256 stream so the row cannot be
   * rescued that way, and deterministically so the fixture is the same one on
   * every run.
   */
  it("indexes the dearest id the bound admits, incompressible and at full stretch", async () => {
    const baseUrl = await aProviderOfTwoContainers();
    let dearest = "";
    for (let block = 0; dearest.length < 255; block += 1) {
      for (const byte of createHash("sha256").update(String(block)).digest()) {
        if (dearest.length < 255) dearest += String.fromCodePoint(0x4e00 + byte * 20);
      }
    }

    const run = await call(
      appRouter.provider.beginImportRun,
      { baseUrl, containerIds: [dearest] },
      { context },
    );

    expect(Buffer.byteLength(dearest, "utf8")).toBe(765);
    expect(run.containers).toEqual([{ containerId: dearest, outcome: "pending" }]);
  });
});

describe("provider.importNextContainer", () => {
  it("browses the Container the Owner listed FIRST, and lands it", async () => {
    const baseUrl = await aProviderOfTwoContainers();
    const { runId } = await call(
      appRouter.provider.beginImportRun,
      { baseUrl, containerIds: THE_LIST },
      { context },
    );

    const stepped = await call(appRouter.provider.importNextContainer, { runId }, { context });

    expect(stepped).toMatchObject({ answer: "landed", containerId: "402219", placements: 1 });
  });

  it("walks the whole list, in the Owner's order, and then says it is done", async () => {
    const baseUrl = await aProviderOfTwoContainers();
    const { runId } = await call(
      appRouter.provider.beginImportRun,
      { baseUrl, containerIds: THE_LIST },
      { context },
    );

    const walked = [
      await call(appRouter.provider.importNextContainer, { runId }, { context }),
      await call(appRouter.provider.importNextContainer, { runId }, { context }),
      await call(appRouter.provider.importNextContainer, { runId }, { context }),
    ];

    expect(walked.map((step) => ("containerId" in step ? step.containerId : step.answer))).toEqual([
      "402219",
      "388305",
      "done",
    ]);
  });

  /**
   * A PROVIDER THAT CANNOT ANSWER IS ONE CONTAINER'S FAILURE, NOT THE RUN'S
   * (ADR-0123). The sentence is the third party's and is carried as such, which
   * is what lets the Owner tell a lapsed Credential from an id they typed wrong.
   */
  it("records a Provider's own reason against the Container that refused", async () => {
    const baseUrl = await stubProviderRefusingWith(LAPSED);
    const { runId } = await call(
      appRouter.provider.beginImportRun,
      { baseUrl, containerIds: ["402219"] },
      { context },
    );

    const stepped = await call(appRouter.provider.importNextContainer, { runId }, { context });

    expect(stepped).toMatchObject({
      answer: "refused",
      containerId: "402219",
      reason: { wrote: "provider", text: expect.stringContaining(LAPSED) },
    });
  });

  /**
   * ADR-0066 makes an id that addresses nothing an ANSWER rather than a failure,
   * and the sentence saying so is CanonCore's own: nothing went wrong at the
   * Provider, so attributing it to one would tell the Owner to go and look at a
   * machine that is working.
   */
  it("refuses a Container the Provider holds nothing at, in CanonCore's own voice", async () => {
    const baseUrl = await aProviderOfTwoContainers();
    const { runId } = await call(
      appRouter.provider.beginImportRun,
      { baseUrl, containerIds: ["999999"] },
      { context },
    );

    const stepped = await call(appRouter.provider.importNextContainer, { runId }, { context });

    expect(stepped).toMatchObject({ answer: "refused", reason: { wrote: "canoncore" } });
  });

  /**
   * AND THAT SENTENCE NAMES THE ID, OR SAYS WHY IT CANNOT (ADR-0179). This is
   * the THIRD refusal quoting a Container id, and the one a grep for
   * `boundedTo` does not find: it reaches the levers through `bounded`, the
   * wrapper `@canoncore/providers` publishes, so the sweep that fixed the other
   * two walked straight past it.
   *
   * IT IS REACHABLE ON THE OWNER'S OWN LIST. `containerId` is bounded by
   * `z.string().min(1)`, which three zero-width spaces satisfy, and the id
   * travels from `beginImportRun`'s list -- where 3 characters clears ADR-0160's
   * 255 ceiling -- to this sentence. The Provider holds nothing at it, which is
   * ADR-0066's ANSWER rather than a failure, and unpatched the Owner reads
   * "That Provider holds no Container at ." with a bare full stop where their
   * id should be.
   */
  it("names an unshowable id in the sentence saying nothing is held at it", async () => {
    const baseUrl = await aProviderOfTwoContainers();
    const { runId } = await call(
      appRouter.provider.beginImportRun,
      { baseUrl, containerIds: ["\u200b\u200b\u200b"] },
      { context },
    );

    const stepped = await call(appRouter.provider.importNextContainer, { runId }, { context });

    expect(stepped).toMatchObject({
      answer: "refused",
      reason: {
        wrote: "canoncore",
        text: "That Provider holds no Container at an id made only of characters that cannot be shown.",
      },
    });
  });

  /**
   * ADR-0033 makes `browse` the operation a Provider may DECLINE, so a Provider
   * offering only `search` and `lookup` is well-formed. The run says so against
   * every Container rather than reading as a Provider that is broken.
   */
  it("refuses against a Provider that declares no browse, without asking it for one", async () => {
    const asked: string[] = [];
    const baseUrl = await stubProvider(
      { "265": TENTH_PLANET },
      { operations: ["search", "lookup"], asked },
    );
    const { runId } = await call(
      appRouter.provider.beginImportRun,
      { baseUrl, containerIds: ["402219"] },
      { context },
    );

    const stepped = await call(appRouter.provider.importNextContainer, { runId }, { context });

    expect(stepped).toMatchObject({ answer: "refused", reason: { wrote: "canoncore" } });
    expect(asked.filter((path) => path.startsWith("/browse/"))).toEqual([]);
  });

  /**
   * THE RUN IS WHAT REPORTS, and it has to still be reporting after the walk has
   * finished: the Owner reads "which of my 465 refused" once, at the end, rather
   * than by scrolling back through a whole walk's output.
   */
  it("leaves the run reporting what landed and what refused, with each reason", async () => {
    const baseUrl = await aProviderOfTwoContainers();
    const { runId } = await call(
      appRouter.provider.beginImportRun,
      { baseUrl, containerIds: ["402219", "999999"] },
      { context },
    );

    await call(appRouter.provider.importNextContainer, { runId }, { context });
    await call(appRouter.provider.importNextContainer, { runId }, { context });
    const reported = await call(appRouter.provider.readImportRun, { runId }, { context });

    expect(reported.containers).toEqual([
      { containerId: "402219", outcome: "landed", placements: 1, quarantinedValues: 0 },
      {
        containerId: "999999",
        outcome: "refused",
        reason: { wrote: "canoncore", text: expect.stringContaining("999999") },
      },
    ]);
  });
});
