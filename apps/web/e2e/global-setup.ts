import { type ChildProcess, spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { createServer as createProbe } from "node:net";
import { fileURLToPath } from "node:url";
import type { AppRouterClient } from "@canoncore/api/routers";
import { assertPlacement, createDb } from "@canoncore/db";
import { type SeededPlacement, seedOneItemInTwoOrderings } from "@canoncore/db/seed";
import { buildTestDatabase } from "@canoncore/db/testing/build-database";
import {
  aCatalogueLargerThanOnePage,
  anItemTitled,
  aPlacement,
  aProvider,
  ownerSource,
} from "@canoncore/db/testing/catalogue";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { TestProject } from "vitest/node";

import { CONTAINERS, TENTH_PLANET, WIKI_MANIFEST } from "./wiki-fixture";

/**
 * Builds a database, seeds ONE item into TWO orderings, then builds and starts
 * the real Next server so the suite can make a real HTTP request at it.
 *
 * WHY NOT A BROWSER. ADR-0103 reserved Playwright for "a rendered page, on the
 * slice that first has one" -- but the sentence it reserved it with is "what
 * genuinely needs a browser", and a server-rendered title does not. The title
 * is in the HTML the server returns, so `fetch` observes exactly what a browser
 * would and costs no dependency and no browser binaries in CI. Playwright is
 * still the answer for the first slice with real interactivity.
 *
 * WHY A PRODUCTION BUILD rather than `next dev`. Dev-mode rendering is not what
 * ships, and the build turned out to cost about three seconds -- which is
 * cheaper than the class of bug it rules out.
 */
const webRoot = fileURLToPath(new URL("..", import.meta.url));

export default async function setup(project: TestProject) {
  const databaseUrl = await buildTestDatabase("web");
  // The SAME seed `pnpm db:seed` runs: raw SQL that writes `title` statements
  // and never touches the projected columns (ADR-0014). If the trigger stops
  // running, the page has no title to render and the suite says so.
  const seeded = await seedOneItemInTwoOrderings(databaseUrl);
  project.provide("itemId", seeded.id);
  project.provide("itemTitle", seeded.title);
  project.provide("placements", seeded.placements);
  const twoOrigins = await anItemPlacedTwoWays(databaseUrl);
  project.provide("twoOrigins", twoOrigins.fixture);
  const timeSpan = await anItemOfAKindWhoseLabelDiffers(databaseUrl);
  project.provide("timeSpan", timeSpan.fixture);
  const workBrowsing = await theThingsWorkBrowsingHasToTellApart(databaseUrl);
  project.provide("workBrowsing", workBrowsing.fixture);

  // The providers have to exist before the server starts, because the server is
  // given the allowlist that makes them reachable.
  const provider = await theProvider();
  const tmdb = await theTmdbProvider();

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    // ADR-0034. The app's OWN allowlist, read by the app's own environment --
    // not a value the harness holds. Loopback is legal here BY NAME, which is
    // the whole job of the config boundary; the content deny rule still refuses
    // `loopback` and goes on refusing it.
    PROVIDER_ALLOWLIST: "127.0.0.0/8",
    /*
     * WHICH PROVIDERS THIS INSTANCE SEARCHES (CNCORE-68). The two this harness
     * stood up, named to the app the way a self-hoster names them -- so the
     * import surface fans out over the SAME providers the imports below reach,
     * and a candidate it offers is one the catalogue can be asked about.
     *
     * A SEPARATE SETTING FROM THE ALLOWLIST ABOVE, and both are needed: the
     * allowlist says loopback MAY be reached and this says which addresses on it
     * to ask. Neither is derivable from the other -- `127.0.0.0/8` carries no
     * scheme and no port.
     */
    PROVIDER_URLS: [provider.url, tmdb.url, UNREACHABLE_PROVIDER].join(","),
  };
  await run("next", ["build"], env);

  const port = await freePort();
  const server = spawn("next", ["start", "--port", String(port)], {
    cwd: webRoot,
    env,
    stdio: "inherit",
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitUntilAnswering(baseUrl, server);
  project.provide("baseUrl", baseUrl);

  /*
   * THE PROVIDERS AND THE DATABASE, handed over rather than re-derived.
   *
   * `multi-placement.test.ts` browses two of the wiki's containers for itself
   * and records what TMDB says about the same stories, and both of those need
   * addresses this function is the only holder of. It does that work in its own
   * file rather than here BECAUSE OF WHERE THE NUMBERS HAVE TO LIVE: CNCORE-9's
   * criterion is that TMDB's positions sit beside the assertion that reads them,
   * and an expectation set up one file away from its assertion is one nobody can
   * check against the source it came from.
   */
  project.provide("databaseUrl", databaseUrl);
  project.provide("providerWikiUrl", provider.url);
  project.provide("providerTmdbUrl", tmdb.url);

  /*
   * A SECOND INSTANCE, AND IT IS WHAT A STRANGER ACTUALLY GETS. The seeded
   * server above has a catalogue and an allowlist, so two of the front page's
   * four criteria have no state to be asserted in: an empty catalogue and an
   * unconfigured `PROVIDER_ALLOWLIST` are precisely what this one has (ADR-0094).
   *
   * THE SAME BUILD, a different database and a different environment. Next is
   * built once above and started twice, so what this proves is the SHIPPED page
   * meeting a fresh install rather than a second build of it.
   */
  const fresh = await freshInstall();
  project.provide("freshBaseUrl", fresh.baseUrl);

  const paged = await aCatalogueTooBigForOnePage();
  project.provide("pagedBaseUrl", paged.baseUrl);
  project.provide("pagedCatalogue", paged.fixture);

  project.provide("imported", await importThroughTheApp(baseUrl, provider.url));
  project.provide("attributed", await importFromTmdb(baseUrl, tmdb.url));
  /*
   * WHAT THE IMPORT SURFACE SEARCHES FOR, and which of the answers this harness
   * has already imported. Both are facts about what was set up rather than
   * expectations, which is why they are handed over from here: a test cannot know
   * that one Matrix film is held and another is not without being told, and that
   * state is made above rather than in the test.
   */
  project.provide("providerSearch", {
    query: MATRIX_QUERY,
    held: THE_MATRIX.title,
    unreachable: UNREACHABLE_PROVIDER,
    browsable: { provider: tmdb.url, container: MATRIX_COLLECTION },
  });
  const browsed = await browseThroughTheApp(baseUrl, provider.url, databaseUrl);
  project.provide("browsed", browsed.fixture);

  return async () => {
    server.kill("SIGTERM");
    fresh.close();
    await paged.close();
    // The seed ends its own client; this pool has to be ended too, or the run
    // holds an idle connection open against a database it is finished with.
    await twoOrigins.close();
    await timeSpan.close();
    await workBrowsing.close();
    await browsed.close();
    await provider.close();
    await tmdb.close();
  };
}

/**
 * A CanonCore nobody has configured and nobody has filled: the state ADR-0094
 * governs, standing up on its own port.
 *
 * NO `PROVIDER_ALLOWLIST` AT ALL, which is not the same as one this harness
 * chose to leave narrow. ADR-0034 makes the variable default to the empty
 * string and the empty string refuse every provider, so ABSENT is the
 * configuration under test -- and it is passed as an explicit empty string
 * rather than omitted, because this process inherits its own environment and an
 * omitted key would let the parent's value through.
 *
 * The database is built from empty by the same ladder every other suite runs,
 * and nothing seeds it. That is the whole fixture: the emptiness IS the state.
 */
async function freshInstall(): Promise<{ baseUrl: string; close: () => void }> {
  const databaseUrl = await buildTestDatabase("fresh");
  const port = await freePort();
  const server = spawn("next", ["start", "--port", String(port)], {
    cwd: webRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PROVIDER_ALLOWLIST: "",
      /*
       * AND NO PROVIDER NAMED EITHER, which is the second half of the same first
       * run. `PROVIDER_URLS` defaults to the empty string and the empty string
       * names nothing, so a stranger's instance searches no provider -- and the
       * import surface has to SAY that rather than show an empty result
       * (ADR-0094). Passed explicitly rather than omitted, for the reason the
       * allowlist is: this process inherits its own environment, and an omitted
       * key would let the parent's value through.
       */
      PROVIDER_URLS: "",
    },
    stdio: "inherit",
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitUntilAnswering(baseUrl, server);
  return { baseUrl, close: () => server.kill("SIGTERM") };
}

/**
 * A THIRD INSTANCE, and what is new about it is the STATE rather than the
 * surface: a catalogue LARGER THAN ONE PAGE.
 *
 * Neither server above can be it. The seeded one is read by every other file
 * here for an item it can find on the front page, and a catalogue of several
 * hundred pushes that item off it; the fresh one's emptiness IS its fixture
 * (ADR-0094). Paging is invisible in both -- everything they hold arrives on
 * the first page -- so a page-over-HTTP assertion about reaching item 101 has
 * nowhere to be made.
 *
 * THE SAME BUILD AGAIN, started a third time. ADR-0117 makes the point about
 * the second one: what a second environment proves is the SHIPPED page meeting
 * a state, rather than a second build of it.
 */
async function aCatalogueTooBigForOnePage() {
  const databaseUrl = await buildTestDatabase("paged");
  const db = createDb(databaseUrl);
  /*
   * TWO AND A HALF PAGES, not one and a bit. Three pages is the smallest walk
   * with a MIDDLE one -- reached by a cursor and handing one on -- and the
   * middle is where a cursor that works at the edges still fails.
   */
  const catalogue = await aCatalogueLargerThanOnePage(db, 254);
  const port = await freePort();
  const server = spawn("next", ["start", "--port", String(port)], {
    cwd: webRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl, PROVIDER_ALLOWLIST: "127.0.0.0/8" },
    stdio: "inherit",
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitUntilAnswering(baseUrl, server);
  return {
    baseUrl,
    fixture: catalogue,
    close: async () => {
      server.kill("SIGTERM");
      await db.$client.end();
    },
  };
}

/**
 * THE SLICE, and it goes through the APP rather than round it.
 *
 * An earlier version of this called the import function in-process with an
 * allowlist the harness held. That proved the library and left the app's own
 * path untested: `provider.import`, the real `createContext`, and the real
 * `PROVIDER_ALLOWLIST` were never exercised against a provider. Found in
 * review, and it mattered -- the ticket's criterion is that THE APP imports.
 *
 * So this is an oRPC call over real HTTP into the running production build,
 * which then reaches the provider over HTTP itself. Two hops, both real.
 */
async function importThroughTheApp(baseUrl: string, providerUrl: string) {
  const client: AppRouterClient = createORPCClient(new RPCLink({ url: `${baseUrl}/api/rpc` }));
  const { itemId } = await client.provider.import({
    baseUrl: providerUrl,
    recordId: TENTH_PLANET.id,
  });
  return {
    id: itemId,
    title: TENTH_PLANET.title,
    released: TENTH_PLANET.released[0] as string,
    providerLabel: "provider-wiki",
  };
}

/**
 * THE STOP CONDITION: a REAL IMPORTED item sitting in more than one ordering,
 * on a page a person can open and read both from.
 *
 * Two orderings that arrived by two DIFFERENT routes, which is the point. The
 * first is `browse`'s -- one call, five stories placed, the provider recorded
 * as having asserted every one of them. The second is the owner's own hand,
 * placing the SAME imported item somewhere else at a different position. A
 * `series_index` column holds one of those and locks the reader out of the
 * other forever (ADR-0018); this holds both, and the page prints both.
 *
 * IT GOES THROUGH THE APP rather than round it, for the reason the import above
 * does: `provider.browse`, the real `createContext` and the real
 * `PROVIDER_ALLOWLIST` are what the ticket says must work, and calling the
 * library in-process would prove none of them.
 */
async function browseThroughTheApp(baseUrl: string, providerUrl: string, databaseUrl: string) {
  const client: AppRouterClient = createORPCClient(new RPCLink({ url: `${baseUrl}/api/rpc` }));

  const missingEpisodes = await client.provider.browse({
    baseUrl: providerUrl,
    containerId: "91997",
  });
  const vashtaNerada = await client.provider.browse({
    baseUrl: providerUrl,
    containerId: "388305",
  });

  // FOUND BY TITLE rather than by index. The members come back in the order the
  // provider gave them, so `members[2]` would work -- and would also pass if the
  // ordering silently changed, which is the one thing this fixture is about.
  const tenthPlanet = await memberTitled(client, missingEpisodes.members, TENTH_PLANET.title);
  const operationDusk = await memberTitled(
    client,
    vashtaNerada.members,
    "Operation Dusk (audio story)",
  );

  // The owner's own hand, on the item the provider just imported. A second
  // ordering that disagrees with the first about where the story sits, because
  // a demo where both orderings agree proves nothing a `series_index` could not.
  const db = createDb(databaseUrl);
  const byHand = await anItemTitled(db, "A story order the owner keeps", {
    isContainer: true,
    isOrdered: true,
  });
  await assertPlacement(db, {
    containerId: byHand,
    itemId: tenthPlanet,
    position: 1,
    sourceId: await ownerSource(db),
  });

  return {
    fixture: {
      /**
       * The real imported story, now in two orderings by two different routes.
       *
       * AND IT IS THE ITEM `importThroughTheApp` ALREADY IMPORTED (CNCORE-28).
       * The lookup above took page 265 by its own id, and this browse of 91997
       * meets the same record again as a member -- so the import finds it by the
       * id the provider knows it by rather than writing a second story. Before
       * that mapping existed this suite produced two items for one story.
       */
      inTwoOrderings: tenthPlanet,
      title: TENTH_PLANET.title,
      /** The provider's own id for it, which is what found it again. */
      externalId: TENTH_PLANET.id,
      imported: "Category:Stories with missing episodes",
      /**
       * The container's own id, so a test can open the ordering rather than
       * only the story inside it. `browse` hands it back, which is what makes
       * this the ordering the provider actually wrote rather than one found by
       * searching the page for a title.
       */
      importedContainerId: missingEpisodes.containerId,
      /*
       * SECOND, NOT THIRD, AND THAT IS THE FIXTURE MOVING RATHER THAN A TYPO.
       * ADR-0057 moved the fixture era to new Who and cut the missing-episode
       * roster from five stories to two, because NOT ONE of the 29 members of
       * `Stories with missing episodes` is a new Who story. *Marco Polo* used
       * to sit ahead of *The Tenth Planet* in this ordering and no longer
       * exists in the extract, so the position it computes to moved with it.
       *
       * It was 3 here and stayed 3 after that landed in `provider-wiki`, which
       * the stub below could not notice and the real image would have: the two
       * runs of this suite would have disagreed about a number, which is
       * precisely the divergence the stub is written to make impossible.
       */
      importedPosition: 2,
      byHand: "A story order the owner keeps",
      byHandPosition: 1,
      /** A member of a container whose ordering could not place it. */
      unplaced: operationDusk,
      unplacedIn: "Category:Vashta Nerada audio stories",
      /** That container's own id, for a test that opens it. */
      unplacedInId: vashtaNerada.containerId,
    },
    close: () => db.$client.end(),
  };
}

/** The member of a browse whose imported item carries this title. */
async function memberTitled(
  client: AppRouterClient,
  members: { itemId: string }[],
  title: string,
): Promise<string> {
  for (const member of members) {
    const item = await client.item.get({ id: member.itemId });
    if (item.title === title) return member.itemId;
  }
  throw new Error(`the browse placed no member titled ${title}`);
}

/**
 * The SECOND provider, whose source charges for its data in obligations.
 *
 * Whatever `PROVIDER_TMDB_URL` names, and a stub on loopback when it names
 * nothing -- the same arrangement as the wiki provider above, for the same
 * reason: in CI that variable points at the real `provider-tmdb` image running
 * as a service container, so this code and these assertions hold the real image
 * to the contract, and the difference between the two runs is which process
 * answers CMPP and nothing else.
 *
 * WHY A SECOND PROVIDER IS HERE AT ALL. The wiki's source imposes no notice and
 * no mark, so with it alone the attribution path would be a branch nothing ever
 * takes. TMDB is the first source that obliges the app to show anything, which
 * is why ADR-0036 exists and why this suite needs two providers rather than one.
 */
async function theTmdbProvider(): Promise<{ url: string; close: () => Promise<void> }> {
  const configured = process.env.PROVIDER_TMDB_URL;
  if (configured) return { url: configured, close: async () => {} };
  return stubTmdbProvider();
}

/** ADR-0036's notice, verbatim, as `provider-tmdb` declares it. */
const TMDB_NOTICE =
  "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";

/**
 * The film this suite imports through TMDB. A real TMDB id, because in CI the
 * real image answers this and reaches the real API for it.
 *
 * ONLY THE ID AND THE TITLE ARE PINNED. Everything else about a TMDB record --
 * its writers, its images, the collection it belongs to -- is TMDB's data and
 * moves without warning, and a suite asserting on it would go red for a reason
 * that is not a defect. The title of a 1999 film does not move.
 */
const THE_MATRIX = { id: "movie:603", title: "The Matrix" };

/**
 * A THIRD PROVIDER THAT CANNOT BE REACHED, configured on purpose.
 *
 * ONE PROVIDER FAILING MUST NOT EMPTY A SEARCH (ADR-0033 under CNCORE-77), and
 * that cannot be asserted on an instance where every provider works. So the
 * seeded server is configured with a provider it will never reach, and every
 * search it serves has to go on answering with what the other two said.
 *
 * A HOST THAT IS NOT ALLOWLISTED rather than a dead port, and the difference is
 * determinism: a port nothing listens on is a port something else may take
 * between this harness choosing it and the test running, whereas this fails at
 * ADR-0034's config boundary before a socket is opened -- no DNS, no connection,
 * the same refusal every run. `.invalid` is reserved by RFC 2606 for exactly
 * this, so it is also a name that cannot one day resolve.
 *
 * AND IT IS THE COMMONEST REAL MISCONFIGURATION, which is why it is the failure
 * worth rendering: naming a provider in `PROVIDER_URLS` and forgetting to
 * allowlist its host is the mistake two settings make easy to walk into.
 */
const UNREACHABLE_PROVIDER = "http://provider.invalid";

/**
 * The query the import surface searches, and a SECOND film it finds.
 *
 * WHY A SECOND ONE EXISTS AT ALL (CNCORE-68). Every record this harness imports
 * is held by the catalogue before the first assertion runs, so a search that
 * found only those would show an Item link on every row BEFORE anything was
 * imported -- and an Import button wired to nothing would pass every assertion
 * about it. The surface needs one candidate the catalogue does NOT hold, and
 * this is it: `THE_MATRIX` above is imported at setup and this one never is.
 *
 * MEASURED AGAINST TMDB'S OWN API on 2026-09-11, not recalled:
 * `/3/search/movie?query=The%20Matrix` answers 603 (`The Matrix`, 1999-03-31)
 * first and 604 (`The Matrix Reloaded`, 2003-05-15) second. So the real image in
 * CI offers both for this query and the stub below offers the same two.
 *
 * THE ASSERTIONS READ THE UNHELD ROW OFF THE PAGE rather than naming it, which
 * is what keeps the two runs indistinguishable: the real image answers several
 * more films for this query and the suite cannot tell, because it asks the page
 * which candidate it is not holding instead of saying which one that should be.
 */
const MATRIX_QUERY = "The Matrix";
const THE_MATRIX_RELOADED = { id: "movie:604", title: "The Matrix Reloaded" };

/**
 * The COLLECTION the import surface browses, and the one container in this suite
 * that nothing else has already taken.
 *
 * IT IS NOT A CHOICE THIS FILE IS MAKING. `packages/contract/src/participants.ts`
 * names `collection:2344` as "a container id this provider really holds" for
 * `provider-tmdb`, and the contract suite holds the real image to it -- so this is
 * that fact reused rather than an assumption about what TMDB can be browsed by.
 *
 * WHY NOT A WIKI CATEGORY. Every container in `wiki-fixture.ts` is browsed before
 * the first assertion runs: 91997 and 388305 by this file, 47650 and 47651 by
 * `multi-placement.test.ts`. A browse of one of those could not show an ORDERING
 * ARRIVING, because it had already arrived -- and a button wired to nothing would
 * pass. This collection is browsed by nothing else, so the transition is real.
 *
 * MEASURED AGAINST TMDB'S OWN API on 2026-09-11: `/3/collection/2344` is `The
 * Matrix Collection` and its parts are 603, 604, 605 and 624860. The stub answers
 * the first two of those, which is enough for an ordering to exist; the real image
 * answers all four and no assertion can tell, because none of them counts members.
 */
const MATRIX_COLLECTION = "collection:2344";

/**
 * A stand-in for the real image, for a machine that cannot pull a private one.
 *
 * The manifest is the real one's, `attribution` included, because that is the
 * field this suite is here for. The logo is a one-pixel GIF rather than TMDB's
 * 2,297-byte wordmark: what the page has to prove is that it renders the bytes
 * it was handed at a size less prominent than our own mark, and whether those
 * bytes are TMDB's mark is the contract test's question of the real provider.
 */
async function stubTmdbProvider(): Promise<{ url: string; close: () => Promise<void> }> {
  const manifest = {
    name: "provider-tmdb",
    versions: [1],
    operations: ["search", "lookup", "browse"],
    max_cache_age: 15552000,
    images: {
      stored_variant: { poster: "w500", backdrop: "w780", still: "w300" },
      per_role_limit: 1,
      quality_floor: 300,
    },
    attribution: {
      notice: TMDB_NOTICE,
      logo: {
        data_uri: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
        alt: "The Movie Database (TMDB). TMDB does not endorse, certify or approve this application.",
      },
    },
  };
  const record = {
    id: THE_MATRIX.id,
    title: THE_MATRIX.title,
    kind: "movie",
    released: ["1999-03-31"],
    writers: ["Lana Wachowski", "Lilly Wachowski"],
    series: "The Matrix Collection",
    series_id: "collection:2344",
    url: "https://www.themoviedb.org/movie/603",
    images: [],
    external_ids: { tmdb: "603", imdb: "tt0133093" },
  };
  /** The sequel, which nothing here imports. See `THE_MATRIX_RELOADED`. */
  const reloaded = {
    id: THE_MATRIX_RELOADED.id,
    title: THE_MATRIX_RELOADED.title,
    kind: "movie",
    released: ["2003-05-15"],
    writers: ["Lana Wachowski", "Lilly Wachowski"],
    series: "The Matrix Collection",
    series_id: "collection:2344",
    url: "https://www.themoviedb.org/movie/604",
    images: [],
    external_ids: { tmdb: "604", imdb: "tt0234215" },
  };
  const records = [record, reloaded];
  /**
   * The collection as a browse answers it: the container, and its parts in
   * release order.
   *
   * THE CONTAINER IS A RECORD TOO (ADR-0004), which is why it carries the same
   * fields as a film. Its `kind` is the provider's own word for what it is.
   */
  const collection = {
    container: {
      id: MATRIX_COLLECTION,
      title: "The Matrix Collection",
      kind: "collection",
      released: [],
      writers: [],
      series: null,
      url: "https://www.themoviedb.org/collection/2344",
      images: [],
      external_ids: { tmdb: "2344" },
    },
    ordering: [
      { position: 1, record },
      { position: 2, record: reloaded },
    ],
    unplaced: [],
  };
  return onLoopback((path, answer) => {
    if (path === "/") return answer(manifest, 200);
    if (path.startsWith("/search")) return answer(searchOver(records, path), searchStatus(path));
    if (path === `/browse/${encodeURIComponent(MATRIX_COLLECTION)}`) {
      return answer(collection, 200);
    }
    if (path === `/lookup/${encodeURIComponent(THE_MATRIX.id)}`) return answer(record, 200);
    if (path === `/lookup/${encodeURIComponent(THE_MATRIX_RELOADED.id)}`) {
      return answer(reloaded, 200);
    }
    return answer({ error: "no such record" }, 404);
  });
}

/** What a stub answers one request with: a JSON body and a status. */
type Answer = (body: unknown, status: number) => void;

/** The `q` of a `/search` path, which is the only parameter CMPP's search takes. */
function queryOf(path: string): string {
  return new URL(path, "http://provider.test").searchParams.get("q") ?? "";
}

/**
 * `search`, over whatever records a stub holds, MATCHED ON THE TITLE.
 *
 * THE LEAST A STUB CAN DO AND STILL BE A SEARCH. One answering every query with
 * everything could not tell a query that found something from one that found
 * nothing, so the page's "nothing matched" branch would never be reached here
 * while CI reached it for real.
 *
 * SHARED BY BOTH STUBS, because a second copy is where the two quietly stop
 * agreeing about what a CMPP search does -- the reason `onLoopback` below is
 * shared.
 */
function searchOver(records: { title: string }[], path: string): unknown {
  const query = queryOf(path);
  if (query.trim() === "") return { error: "a query is required" };
  return {
    results: records.filter((record) => record.title.toLowerCase().includes(query.toLowerCase())),
  };
}

/**
 * `400` FOR A MISSING OR EMPTY QUERY, which is ADR-0033's reading as CNCORE-33
 * settled it: an empty RESULT is an answer and a missing QUERY is a mistake, and
 * `?q=` is the absent case wearing a different spelling. Both real providers
 * answer it that way, so a stub that answered `200 {"results":[]}` would make
 * this suite's two runs disagree about the contract they exist to hold each other
 * to -- which is the exact divergence ADR-0110 records the contract test finding.
 */
function searchStatus(path: string): number {
  return queryOf(path).trim() === "" ? 400 : 200;
}

/**
 * A JSON server on a loopback port the operating system picks.
 *
 * Shared by the two stubs, which had written it out twice -- the `createServer`,
 * the `writeHead`, the `listen(0)` and the four lines of narrowing `address()`
 * back to a port. None of that is what either stub is about, and a second copy is
 * where the two quietly stop agreeing about what a CMPP stub does.
 */
async function onLoopback(
  route: (path: string, answer: Answer) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((request, response) => {
    route(request.url ?? "/", (body, status) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * THE SECOND SLICE, and it goes through the app exactly as the first does.
 *
 * What it adds over `importThroughTheApp` is the licence: TMDB declares a notice
 * and a mark, so this import is the one that makes the page owe something.
 */
async function importFromTmdb(baseUrl: string, providerUrl: string) {
  const client: AppRouterClient = createORPCClient(new RPCLink({ url: `${baseUrl}/api/rpc` }));
  const { itemId } = await client.provider.import({
    baseUrl: providerUrl,
    recordId: THE_MATRIX.id,
  });
  return { id: itemId, title: THE_MATRIX.title, notice: TMDB_NOTICE };
}

/**
 * Whatever `PROVIDER_WIKI_URL` names, and a stub on loopback when it names
 * nothing. In CI that variable points at the real `provider-wiki` image running
 * as a service container, so this same code and these same assertions hold the
 * real image to the contract -- the difference between the two runs is which
 * process answers CMPP, and nothing else.
 */
async function theProvider(): Promise<{ url: string; close: () => Promise<void> }> {
  const configured = process.env.PROVIDER_WIKI_URL;
  if (configured) return { url: configured, close: async () => {} };
  return stubWikiProvider();
}

/** A stand-in for the real image, for a machine that cannot pull a private one. */
async function stubWikiProvider(): Promise<{ url: string; close: () => Promise<void> }> {
  /**
   * Everything this stub can be asked for by name: the looked-up story, every
   * container, and every member of every container.
   *
   * THE CONTAINERS ARE IN IT TOO, because a container is a record like any other
   * (ADR-0004) and the real provider's search does not hide one.
   */
  const searchable = [
    TENTH_PLANET,
    ...Object.values(CONTAINERS).flatMap((browsed) => [
      browsed.container,
      ...browsed.ordering.map(({ record }) => record),
      ...browsed.unplaced,
    ]),
  ];
  return onLoopback((path, answer) => {
    if (path === "/") return answer(WIKI_MANIFEST, 200);
    if (path.startsWith("/search")) return answer(searchOver(searchable, path), searchStatus(path));
    if (path.startsWith("/browse/")) {
      // `Object.hasOwn` rather than a bare index: the id is a path segment, and
      // `/browse/constructor` otherwise finds `Object` on the prototype and
      // answers 200 with a body of `undefined`.
      const id = path.slice("/browse/".length);
      if (!Object.hasOwn(CONTAINERS, id)) return answer({ error: "no such container" }, 404);
      return answer(CONTAINERS[id], 200);
    }
    if (path === `/lookup/${TENTH_PLANET.id}`) return answer(TENTH_PLANET, 200);
    return answer({ error: "no such record" }, 404);
  });
}

/**
 * A FIXTURE, not part of the demo: one item in two orderings that arrived by
 * two DIFFERENT routes, one from the owner's hand and one from a provider.
 *
 * It is a second item rather than more rows on the seeded one, and that is the
 * whole reason it exists here instead of in the seed. The demo is hand-placed
 * on purpose -- CNCORE-5 seeds it that way to prove the model without waiting
 * for a provider -- so writing a provider-sourced row into it would be
 * pretending an import happened. Until CNCORE-7's browse writes real ones, this
 * is the only place two origins meet, and the filter needs two to narrow.
 */
async function anItemPlacedTwoWays(databaseUrl: string) {
  const db = createDb(databaseUrl);
  const item = await anItemTitled(db, "An item placed two ways");
  const byHand = await anItemTitled(db, "An ordering filled by hand", {
    isContainer: true,
    isOrdered: true,
  });
  const imported = await anItemTitled(db, "An ordering that was imported", {
    isContainer: true,
    isOrdered: true,
  });
  await aPlacement(db, {
    containerId: byHand,
    itemId: item,
    position: 1,
    sourceId: await ownerSource(db),
  });
  await aPlacement(db, {
    containerId: imported,
    itemId: item,
    position: 2,
    sourceId: await aProvider(db, "https://provider.test/e2e"),
  });
  return {
    fixture: {
      id: item,
      byHand: "An ordering filled by hand",
      imported: "An ordering that was imported",
    },
    // The seed ends its own client; this pool has to be ended too, or the run
    // holds an idle connection open against a database it has finished with.
    close: () => db.$client.end(),
  };
}

/**
 * An item whose KIND'S LABEL DIFFERS FROM ITS KEY, which is the only pair that
 * can tell whether a page is printing the reader's word or the column.
 *
 * `time_span` is the key it is seeded with, and the demo item's `work` is why a
 * second item is needed at all: `Work` is a capital away from `work`, so a page
 * printing the column would satisfy an assertion made on that one either way.
 *
 * WHAT THE WORDS SHOULD BE IS NOT HERE. This hands over the key it wrote, which
 * is a fact about the fixture; `Time span` is an expectation, and it is written
 * beside the assertion that reads it for the reason this file already gives of
 * TMDB's positions -- an expectation set up one file away from its assertion is
 * one nobody can check against the source it came from, which here is
 * `CONTEXT.md`.
 */
async function anItemOfAKindWhoseLabelDiffers(databaseUrl: string) {
  const db = createDb(databaseUrl);
  const title = "The Hartnell era";
  const kind = "time_span";
  const id = await anItemTitled(db, title, { kind });
  return {
    fixture: { id, title, kind },
    // The seed ends its own client; this pool has to be ended too, or the run
    // holds an idle connection open against a database it has finished with.
    close: () => db.$client.end(),
  };
}

/**
 * THE FOUR ITEMS ADR-0077 IS ABOUT, which no other fixture here holds.
 *
 * The record's rule is `kind = 'work' AND (NOT is_container OR holds_work)`, and
 * it names the two ways of getting it wrong: "either people flood the browse
 * grid, or the containers that justified the single-table decision cannot be
 * built". A surface can only be shown to avoid both if both are reachable, so
 * this seeds one of each.
 *
 * THE TWO CONTAINERS ARE THE HALF THAT MATTERS, and they are deliberately
 * identical except in what they hold. Both are kind `work`, because ADR-0004
 * folds containers into it; only `holds_work` separates them. A page filtering
 * on the kind alone passes the person half of this and fails here, which is
 * exactly the failure the record says its own first draft had.
 *
 * `The Doctors, in order` is the record's OWN example, and it is the case that
 * stopped a kind filter being enough.
 */
async function theThingsWorkBrowsingHasToTellApart(databaseUrl: string) {
  const db = createDb(databaseUrl);
  const owner = await ownerSource(db);

  // Placed in nothing, which is the point: a person floods the grid by being
  // in the catalogue at all, not by being in a container.
  await anItemTitled(db, "A person in the cast", { kind: "person" });
  const character = await anItemTitled(db, "A character somebody plays", { kind: "character" });

  const entityContainer = await anItemTitled(db, "The Doctors, in order", {
    isContainer: true,
    isOrdered: true,
  });
  await aPlacement(db, {
    containerId: entityContainer,
    itemId: character,
    position: 1,
    sourceId: owner,
  });

  const workContainer = await anItemTitled(db, "A season that holds stories", {
    isContainer: true,
    isOrdered: true,
  });
  const story = await anItemTitled(db, "A story in that season");
  /*
   * WRITTEN IN THE ANSWER'S REVERSE ORDER, which is the half that makes a
   * position-order assertion a test rather than a coincidence.
   *
   * The browsed containers this suite already holds were INSERTED in position
   * order, because that is the order the provider handed them over in -- so
   * PostgreSQL returns them correctly ordered from a query carrying no `order
   * by` at all, and an assertion against one cannot tell a sorted answer from an
   * unsorted one. Measured: removing the `orderBy` from `findMembersOfContainer`
   * left every page-level assertion passing. These three are written third,
   * first, second for that reason.
   */
  await aPlacement(db, {
    containerId: workContainer,
    itemId: story,
    position: 3,
    sourceId: owner,
  });
  const opener = await anItemTitled(db, "The story that opens that season");
  const middle = await anItemTitled(db, "The story in the middle of that season");
  await aPlacement(db, {
    containerId: workContainer,
    itemId: opener,
    position: 1,
    sourceId: owner,
  });
  await aPlacement(db, {
    containerId: workContainer,
    itemId: middle,
    position: 2,
    sourceId: owner,
  });

  /*
   * A REPEAT, which CONTEXT.md defines and ADR-0009 licences: the same item
   * twice in one container, "a recap at position 1 and the episode at position
   * 5". It is seeded rather than browsed because no provider in this suite
   * hands one over -- the wiki's categories hold each story once.
   */
  const withARecap = await anItemTitled(db, "An ordering that opens with its own recap", {
    isContainer: true,
    isOrdered: true,
  });
  const shownTwice = await anItemTitled(db, "A story shown twice in one ordering");
  await aPlacement(db, {
    containerId: withARecap,
    itemId: shownTwice,
    position: 1,
    sourceId: owner,
  });
  await aPlacement(db, {
    containerId: withARecap,
    itemId: shownTwice,
    position: 5,
    sourceId: owner,
  });

  return {
    fixture: {
      person: "A person in the cast",
      character: "A character somebody plays",
      entityContainer: "The Doctors, in order",
      entityContainerId: entityContainer,
      workContainer: "A season that holds stories",
      workContainerId: workContainer,
      story: "A story in that season",
      /** Its members, in the order the container puts them -- NOT the order they were written. */
      inPositionOrder: [
        "The story that opens that season",
        "The story in the middle of that season",
        "A story in that season",
      ],
      withARecapId: withARecap,
      repeated: "A story shown twice in one ordering",
      repeatedId: shownTwice,
    },
    // The seed ends its own client; this pool has to be ended too, or the run
    // holds an idle connection open against a database it has finished with.
    close: () => db.$client.end(),
  };
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

/** Asks the operating system for a port nothing else is on. */
function freePort(): Promise<number> {
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

async function waitUntilAnswering(baseUrl: string, server: ChildProcess): Promise<void> {
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

declare module "vitest" {
  interface ProvidedContext {
    baseUrl: string;
    /**
     * The SAME BUILD serving an empty database with no allowlist: what a
     * stranger's first run of CanonCore is (ADR-0094).
     */
    freshBaseUrl: string;
    /** The same build again, serving a catalogue of several hundred items. */
    pagedBaseUrl: string;
    /** Every item that instance holds: the set a walk has to arrive at, exactly. */
    pagedCatalogue: string[];
    /** The wiki provider this run stood up: the real image in CI, a stub here. */
    providerWikiUrl: string;
    /** The TMDB provider, whose source row is what a TMDB claim is recorded against. */
    providerTmdbUrl: string;
    itemId: string;
    itemTitle: string;
    /** Every ordering the seeded item sits in, and where. */
    placements: SeededPlacement[];
    /** The fixture item, in one ordering filled by hand and one imported. */
    twoOrigins: { id: string; byHand: string; imported: string };
    /** An item whose kind a reader and the column call by different names. */
    timeSpan: { id: string; title: string; kind: string };
    /** The items work-browsing has to tell apart, and the containers that prove it (ADR-0077). */
    workBrowsing: {
      person: string;
      character: string;
      entityContainer: string;
      entityContainerId: string;
      workContainer: string;
      workContainerId: string;
      story: string;
      inPositionOrder: string[];
      withARecapId: string;
      repeated: string;
      repeatedId: string;
    };
    /** The story imported from a CMPP provider over HTTP, and what it claimed. */
    imported: { id: string; title: string; released: string; providerLabel: string };
    /**
     * An item imported from the SECOND provider, whose licence obliges the app to
     * show a notice and a mark (ADR-0036).
     */
    attributed: { id: string; title: string; notice: string };
    /**
     * A query the import surface can be driven with: one answer this catalogue
     * already holds, and at least one it does not.
     */
    providerSearch: {
      query: string;
      held: string;
      /** A provider this instance is configured with and can never reach. */
      unreachable: string;
      /** A container nothing in this suite has browsed, and who holds it. */
      browsable: { provider: string; container: string };
    };
    /** A real browsed story in two orderings, and the two shapes browse hands over. */
    browsed: {
      inTwoOrderings: string;
      title: string;
      externalId: string;
      imported: string;
      importedPosition: number;
      byHand: string;
      byHandPosition: number;
      unplaced: string;
      unplacedIn: string;
      importedContainerId: string;
      unplacedInId: string;
    };
  }
}
