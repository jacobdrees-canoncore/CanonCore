import { createServer, type Server } from "node:http";
import type { AppRouterClient } from "@canoncore/api/routers";
import { assertPlacement, createDb, placeItemByHand, writeProviderSettings } from "@canoncore/db";
import { type SeededPlacement, seedOneItemInTwoOrderings } from "@canoncore/db/seed";
import { buildTestDatabase } from "@canoncore/db/testing/build-database";
import {
  aCatalogueLargerThanOnePage,
  aContainerLargerThanOnePage,
  anItemInMoreOrderingsThanOnePage,
  anItemTitled,
  aPlacement,
  aProvider,
  aStatement,
  ownerSource,
} from "@canoncore/db/testing/catalogue";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { TestProject } from "vitest/node";

import { logInAt } from "./document";
/*
 * THE INSTANCE HELPERS NOW LIVE BESIDE THIS FILE RATHER THAN IN IT (CNCORE-73),
 * because the browser suite is a second Vitest PROJECT that needs the same
 * thing. What they are and why is in `instance.ts`, unchanged by the move.
 */
import {
  anInstanceServing,
  HARNESS_CONNECTIONS,
  OWNER_PASSWORD,
  theAppBuilt,
  theBuildServing,
} from "./instance";
import { CONTAINERS, TENTH_PLANET, WIKI_MANIFEST } from "./wiki-fixture";

/**
 * Builds a database, seeds ONE item into TWO orderings, then builds and starts
 * the real Next server so the suite can make a real HTTP request at it.
 *
 * WHY NOT A BROWSER. ADR-0103 reserved Playwright for "a rendered page, on the
 * slice that first has one" -- but the sentence it reserved it with is "what
 * genuinely needs a browser", and a server-rendered title does not. The title
 * is in the HTML the server returns, so `fetch` observes exactly what a browser
 * would and costs no dependency and no browser binaries in CI.
 *
 * THAT RESERVATION IS NOW SPENT, AND NOT ON THIS PROJECT (CNCORE-73). A drag
 * is the first interactivity that genuinely needs one, and it has a Vitest
 * project of its own in `apps/web/browser` -- so nothing in THIS file launches
 * a browser and nothing in it ever will. The split is the point: a browser test
 * is the most expensive and most brittle thing in this repository, and keeping
 * it out of here is what stops a flake in it reddening the page seam.
 *
 * WHY A PRODUCTION BUILD rather than `next dev`. Dev-mode rendering is not what
 * ships, and the build turned out to cost about three seconds -- which is
 * cheaper than the class of bug it rules out.
 */

/**
 * An RPC client that has logged in, for the fixtures this harness fills through
 * the app.
 *
 * IT LOGS IN THROUGH THE PAGE and sends back the cookie it was given, which is
 * what a browser does. A token minted straight into the database would fill
 * these catalogues through a door the app never opened.
 */
async function asTheOwner(baseUrl: string): Promise<AppRouterClient> {
  const cookie = await logInAt(baseUrl, OWNER_PASSWORD);
  return createORPCClient(new RPCLink({ url: `${baseUrl}/api/rpc`, headers: { cookie } }));
}

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
  const lookupOnly = await aProviderThatDeclinesBrowse();
  const answersBadly = await aProviderThatAnswersBadly();

  /*
   * WHAT THIS INSTANCE REACHES, WRITTEN INTO ITS DATABASE (CNCORE-99). Both
   * settings are rows since migration 16, so the harness configures this
   * instance the way an owner does rather than through variables the app no
   * longer reads.
   *
   * ADR-0034's ALLOWLIST: loopback is legal here BY NAME, which is the whole
   * job of the config boundary; the content deny rule still refuses `loopback`
   * and goes on refusing it.
   *
   * AND WHICH PROVIDERS ARE SEARCHED (CNCORE-68), which is a SEPARATE setting
   * and not derivable from the one above -- `127.0.0.0/8` carries no scheme and
   * no port. The ones this harness stood up, named the way a self-hoster names
   * them, so the import surface fans out over the SAME providers the imports
   * below reach.
   */
  const configuring = createDb(databaseUrl, { maxConnections: HARNESS_CONNECTIONS });
  await writeProviderSettings(configuring, {
    providerAllowlist: "127.0.0.0/8",
    providerUrls: [
      provider.url,
      tmdb.url,
      lookupOnly.url,
      answersBadly.url,
      UNREACHABLE_PROVIDER,
    ].join("\n"),
  });
  await configuring.$client.end();

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    // THE OWNER'S PASSWORD, because this instance is IMPORTED INTO: the fixtures
    // below are filled through the app's own write path, which is the owner's.
    OWNER_PASSWORD,
  };
  await theAppBuilt(env);

  /*
   * THE ONE BUILD, STARTED HERE AND FOUR MORE TIMES BELOW. This instance takes
   * `theBuildServing` rather than `anInstanceServing` because the build sits
   * BETWEEN its database and its server and needs the environment carrying the
   * database -- so the helper that does both halves cannot serve it without a
   * flag. The four below have nothing between the two halves and use it.
   */
  const server = await theBuildServing(env);
  const { baseUrl } = server;
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
   * unconfigured allowlist are precisely what this one has (ADR-0094).
   *
   * THE SAME BUILD, a different database and a different environment. Next is
   * built once above and started twice, so what this proves is the SHIPPED page
   * meeting a fresh install rather than a second build of it.
   */
  const fresh = await freshInstall();
  project.provide("freshBaseUrl", fresh.baseUrl);

  // WHAT A TEST LOGS IN WITH. Everything that writes is the owner's, so a file
  // that presses a button needs this; `document.ts`'s `logInAt` takes it.
  project.provide("ownerPassword", OWNER_PASSWORD);

  const paged = await aCatalogueTooBigForOnePage();
  project.provide("pagedBaseUrl", paged.baseUrl);
  project.provide("pagedCatalogue", paged.fixture.every);
  /*
   * THE CATALOGUE'S OWN KEYLESS PAIR, AND THE TWO UNNAMED ORDERINGS WITH THEM
   * (CNCORE-125). This is the set Catalogue search cannot reach -- the match is
   * `title ilike ...`, which is NULL without a title -- so every untitled item
   * on the instance belongs in it, whichever fixture wrote it. Left out, the two
   * new ones would be in the catalogue's oracle and absent from the search's.
   */
  project.provide("pagedUntitled", [...paged.fixture.untitled, ...paged.fixture.appearsIn.unnamed]);
  project.provide("pagedContainer", paged.fixture.container);
  project.provide("pagedAppearsIn", paged.fixture.appearsIn);

  const purgeable = await aCatalogueSafeToPurge(provider.url, tmdb.url);
  project.provide("purgeableBaseUrl", purgeable.baseUrl);
  project.provide("purgeable", purgeable.fixture);

  const editable = await aCatalogueSafeToEdit(provider.url);
  project.provide("editableBaseUrl", editable.baseUrl);
  project.provide("editable", editable.fixture);

  const curatable = await aCatalogueSafeToCurate();
  project.provide("curatableBaseUrl", curatable.baseUrl);
  project.provide("curatable", curatable.fixture);

  const reorderable = await aCatalogueSafeToReorder();
  project.provide("reorderableBaseUrl", reorderable.baseUrl);
  project.provide("reorderable", reorderable.fixture);

  const still = await aCatalogueThatHoldsStill();
  project.provide("stillBaseUrl", still.baseUrl);
  project.provide("stillCatalogue", still.fixture);

  const configurable = await anInstanceSafeToConfigure();
  project.provide("configurableBaseUrl", configurable.baseUrl);

  project.provide("imported", await importThroughTheApp(baseUrl, provider.url));
  project.provide("attributed", await importFromTmdb(baseUrl, tmdb.url));
  const twoInstances = await twoInstancesOfOneProvider(baseUrl, databaseUrl);
  project.provide("twoInstances", twoInstances.fixture);
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
    declinesBrowse: lookupOnly.url,
    answersBadly: answersBadly.url,
  });
  const browsed = await browseThroughTheApp(baseUrl, provider.url, databaseUrl);
  project.provide("browsed", browsed.fixture);

  return async () => {
    server.close();
    await fresh.close();
    await paged.close();
    await purgeable.close();
    await still.close();
    await editable.close();
    await curatable.close();
    await reorderable.close();
    await configurable.close();
    // The seed ends its own client; this pool has to be ended too, or the run
    // holds an idle connection open against a database it is finished with.
    await twoOrigins.close();
    await twoInstances.close();
    await timeSpan.close();
    await workBrowsing.close();
    await browsed.close();
    await provider.close();
    await tmdb.close();
    await lookupOnly.close();
    await answersBadly.close();
  };
}

/**
 * A CanonCore nobody has configured and nobody has filled: the state ADR-0094
 * governs, standing up on its own port.
 *
 * AN EMPTY ALLOWLIST, which is not the same as one this harness chose to leave
 * narrow. ADR-0034 makes it empty by default and the empty value refuse every
 * provider, so an instance nobody has configured is the state under test. It is
 * written explicitly rather than left out, because "what this instance reaches"
 * is what an instance IS here and a reader should not have to infer it.
 *
 * The database is built from empty by the same ladder every other suite runs,
 * and nothing seeds it. That is the whole fixture: the emptiness IS the state.
 */
function freshInstall() {
  return anInstanceServing({
    suffix: "fresh",
    /*
     * AND NO OWNER PASSWORD, which makes this instance ADR-0044's DEMO as well as
     * ADR-0094's fresh install: read-only, with no login, because nobody set one.
     * Empty rather than omitted for the reason the two below are, and
     * `anInstanceServing` is what makes that structural -- an omitted key here
     * would let a developer's `.env` through and quietly make the demo writable.
     */
    ownerPassword: "",
    allowlist: "",
    /*
     * AND NO PROVIDER NAMED EITHER, which is the second half of the same first
     * run: an instance that names none searches none -- and the import surface
     * has to SAY that rather than show an empty result (ADR-0094).
     *
     * THE AFTERNOON THIS USED TO COST IS GONE, and it is worth recording what
     * ended it. While these were environment variables, a value for either in
     * `apps/web/.env` REACHED THIS SERVER ANYWAY and the instance stopped being
     * a fresh install: both notices vanished and four tests here failed
     * together, pointing at the page rather than at the file. It was not dotenv
     * doing it -- that leaves an explicit empty string alone (checked on
     * 17.4.2) -- but Next's own env loading inside the server, and CI never saw
     * it because a fresh checkout has no `.env`. They are rows now (CNCORE-99),
     * and nothing on a developer's machine can put one in this instance's
     * database.
     */
    providers: [],
    // NOTHING SEEDS IT, and that is the fixture rather than an omission: the
    // emptiness IS the state under test. Said here rather than left off, so an
    // instance that forgot to seed and one that must not read differently.
    fill: async () => {},
  });
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
function aCatalogueTooBigForOnePage() {
  return anInstanceServing({
    suffix: "paged",
    // NOBODY WRITES TO IT, so nobody logs in to it: this instance exists to be
    // walked, and a password it never uses would be a value nothing reads.
    ownerPassword: "",
    allowlist: "127.0.0.0/8",
    // EXPLICIT AND EMPTY, WHERE IT USED TO BE NEITHER (CNCORE-111). This was the
    // one instance that omitted the setting while it was an environment
    // variable, so a developer with providers in `apps/web/.env` gave it ones CI
    // never has. Nothing here imports, so the difference was invisible rather
    // than harmless.
    providers: [],
    /*
     * TWO AND A HALF PAGES, not one and a bit. Three pages is the smallest walk
     * with a MIDDLE one -- reached by a cursor and handing one on -- and the
     * middle is where a cursor that works at the edges still fails.
     *
     * AND THE SAME ITEMS ARE A CONTAINER'S MEMBERS TOO (CNCORE-89), because a
     * members listing larger than one page is the same family of state this
     * instance already exists for and neither other server can hold it: the
     * seeded one is read by every file here for an item on its front page, and
     * the fresh one's emptiness is its fixture (ADR-0094).
     *
     * IT HOLDS WHAT THE CATALOGUE ALREADY WROTE, so the ordering costs ONE new
     * item rather than two hundred and fifty. That matters because `every` below
     * is an exact oracle: `front-page.test.ts` walks the catalogue and compares
     * the set, and `search.test.ts` walks it minus the untitled pair. So the
     * catalogue is asked for one item short and the container is the one that
     * makes it up.
     *
     * AND ITS TITLE CARRIES `story`, which is not decoration: that is the query
     * `search.test.ts` walks this instance with, and every other titled item
     * here matches it. A container that did not would be an item in the
     * catalogue's oracle and absent from the search's, for no reason a reader of
     * either file could see.
     */
    fill: async (db) => {
      const catalogue = await aCatalogueLargerThanOnePage(db, 253);
      const container = await aContainerLargerThanOnePage(db, {
        title: "Every story here, in one ordering",
        holding: catalogue.every,
      });
      /*
       * AND ONE STORY IN MORE ORDERINGS THAN ONE PAGE (CNCORE-125), which is
       * the MIRROR state and the only one in which "Also appears in" can be
       * walked at all. Neither other server can hold it for the reason the
       * catalogue above gives, and it belongs on this one because a page over
       * two listings is where the two cursors have to be seen not to move each
       * other.
       *
       * IT COSTS ITS OWN ITEMS WHERE THE CONTAINER ABOVE COST ONE, and the
       * asymmetry is forced rather than careless: that fixture could reuse the
       * catalogue because a container's members are ORDINARY ITEMS, and this one
       * needs a hundred and more CONTAINERS, which a catalogue of plain stories
       * holds none of. So they are counted into `every` below, which is what
       * keeps `front-page.test.ts`'s set oracle exact.
       *
       * AND EVERY ONE OF THEM CARRIES `story`, for the reason the container's
       * title does: that is the query `search.test.ts` walks this instance with,
       * and an item in the catalogue's oracle but absent from the search's would
       * be a difference no reader of either file could see.
       */
      const appearsIn = await anItemInMoreOrderingsThanOnePage(db, {
        title: "A story in more orderings than one page",
        orderings: 210,
      });
      return {
        ...catalogue,
        every: [...catalogue.every, container.id, appearsIn.id, ...appearsIn.containers],
        container,
        appearsIn,
      };
    },
  });
}

/**
 * A FOURTH INSTANCE, and what is new about it is that IT CAN BE DESTROYED.
 *
 * A purge deletes everything one provider ever said, so asserting one against
 * the seeded server would delete the fixtures every other file here reads --
 * mid-run, in whatever order the files happened to start. The emptiness of the
 * fresh install and the 254 items of the paged catalogue are each somebody's
 * fixture too. So the state under test is a catalogue NOBODY ELSE READS, filled
 * by the same two providers through the same app, and what a test takes from it
 * is gone for that file alone.
 *
 * THE SAME PROVIDERS, NOT NEW ONES. The stubs are already running and a purge is
 * about rows in a CATALOGUE rather than anything at a provider, so a second pair
 * would be two more processes proving nothing -- and in CI these two are the real
 * images, which is the whole reason they are passed in rather than stood up here.
 *
 * TWO PROVIDERS WITH CONTENT, AND THE DIVISION IS WHAT KEEPS THE FILE ORDERLESS.
 * One of them is previewed and declined and never purged, so the tests that must
 * find a catalogue still standing cannot be made to fail by a test that ran
 * first; the other is the one the destructive test takes. A single provider would
 * make every assertion in the file depend on the order vitest happened to run it.
 *
 * AND A THIRD THAT WAS NEVER IMPORTED FROM, which is not a gap in the fixture but
 * a state the ticket names: a purge that would remove nothing has to say so
 * rather than present an empty confirmation. `provider.invalid` is unreachable,
 * which costs nothing here -- a purge makes no request, so this is the one
 * surface where an unreachable provider is fully operable, and that is ADR-0046's
 * own motivating case rather than an edge of it.
 */
async function aCatalogueSafeToPurge(wikiUrl: string, tmdbUrl: string) {
  const instance = await anInstanceServing({
    // `purge` RATHER THAN `purgeable`, WHICH IS A LENGTH AND NOT A PREFERENCE:
    // `_test_purgeable` is four characters past the budget `worktree-database.ts`
    // reserves, so on a branch whose stem ran to the limit the whole e2e suite
    // died before its first assertion. The word is now a declared member of
    // `TEST_DATABASE_SUFFIXES` rather than a literal, so the budget is checked
    // rather than remembered (CNCORE-112).
    suffix: "purge",
    // FILLED THROUGH THE APP AND THEN PURGED THROUGH THE PAGE, both of which are
    // the owner's since CNCORE-109.
    ownerPassword: OWNER_PASSWORD,
    allowlist: "127.0.0.0/8",
    providers: [wikiUrl, tmdbUrl, UNREACHABLE_PROVIDER],
    // NOTHING BEFORE THE SERVER, because everything this fixture holds has to go
    // in THROUGH the app and the app is not up yet. The filling is below.
    fill: async () => {},
  });
  const { baseUrl, db } = instance;

  // FILLED THROUGH THE APP, for the reason every other fixture here is: the
  // rows a purge deletes have to be rows the app's own import path wrote, or
  // what is purged is the harness's idea of an import.
  const client = await asTheOwner(baseUrl);
  const previewed = await client.provider.browse({ baseUrl: wikiUrl, containerId: "388305" });
  const purged = await client.provider.browse({
    baseUrl: tmdbUrl,
    containerId: MATRIX_COLLECTION,
  });

  /*
   * AND THEN THE OWNER PUTS THEIR OWN HAND ON ONE MEMBER OF EACH.
   *
   * THIS IS THE FIXTURE FOR THE CRITERION ABOUT ITEMS THE OWNER HAS EDITED. An
   * item a provider wrote and the owner ALSO places does not go when the
   * provider does: the owner's placement is the owner's claim, and a licence
   * ending has no bearing on it (ADR-0046). Without a member in that state the
   * preview would report every item as removed and the criterion would have no
   * state to be asserted in -- the numbers would be right for a catalogue nobody
   * had curated, which is the one catalogue this product is not for.
   */
  const owner = await ownerSource(db);
  /*
   * A PLACEMENT AND A TITLE, because the criterion says EDITED and those are two
   * different ways for the owner to have a claim on a provider's item. A
   * placement is the owner saying where it sits; a title of their own is the
   * owner OVERRIDING what the provider said, which is the literal reading of
   * "items the Owner has edited" and is CNCORE-60's user story 25. Either keeps
   * the item standing when the provider goes, and a fixture with only the first
   * would leave the literal case asserted nowhere at this seam.
   *
   * `title` RATHER THAN `note`, WHICH IS NOT A CHOICE ABOUT WHICH IS TIDIER.
   * THE FIRST REASON GIVEN FOR IT HAS EXPIRED: it said ADR-0096's `note`
   * property was not seeded and that a fixture written against it would fail at
   * `propertyNamed`. Migration 12 seeds it (CNCORE-74), so that is no longer
   * true -- and the reason that remains is the one that was always the stronger
   * half. `title` is the claim an owner's edit and a provider's actually COMPETE
   * over (ADR-0025 seeds the owner at `source_order` 0, so the owner's title
   * outranks the provider's), which is the literal reading of "items the Owner
   * has edited". A note cannot express that at all: migration 12 declares it
   * assertable by the owner alone, so there is no provider claim for one to beat.
   *
   * NOT THROUGH A SURFACE, AND SINCE CNCORE-71 THAT IS A CHOICE RATHER THAN THE
   * ONLY OPTION. This used to read "because there is not one yet"; there is one
   * now -- `/new` and the title form on an item page -- and this fixture still
   * does not use it, because what these tests need is an item in that STATE and
   * going through the page would make every purge assertion depend on the edit
   * path staying green. `item-write.test.ts` is where editing is tested, on an
   * instance of its own.
   */
  const kept = async (itemId: string, ordering: string): Promise<string> => {
    await assertPlacement(db, {
      containerId: await anItemTitled(db, ordering, { isContainer: true, isOrdered: true }),
      itemId,
      position: 1,
      sourceId: owner,
    });
    await aStatement(db, {
      subjectItemId: itemId,
      property: "title",
      valueLiteral: `${ordering}: the owner's own title for it`,
      sourceId: owner,
    });
    return itemId;
  };

  return {
    baseUrl,
    fixture: {
      /** Previewed, declined, and never purged -- so this half always stands. */
      previewed: wikiUrl,
      /** The one the destructive test takes. */
      purged: tmdbUrl,
      /** Configured, and nothing was ever imported from it. */
      neverImported: UNREACHABLE_PROVIDER,
      /** A story from each, which the owner also places and which therefore stays. */
      keptFromPreviewed: await kept(
        firstItemPlacedBy(previewed),
        "An ordering the owner keeps, of stories",
      ),
      keptFromPurged: await kept(
        firstItemPlacedBy(purged),
        "An ordering the owner keeps, of films",
      ),
    },
    close: instance.close,
  };
}

/**
 * EVERY ITEM THE FIFTH INSTANCE HOLDS, and so how much it holds.
 *
 * THREE, WHICH IS NOT ONE. `Holding` says "1 item" and "3 items" from different
 * arms of one expression, so a fixture of one would assert the SINGULAR while
 * claiming to be about the count. Nothing asserts the singular arm yet.
 */
const HOLDING_STILL = [
  "A catalogue nobody is filling",
  "An item that arrived before the run",
  "And a third, so the plural is a plural",
];

/**
 * A FIFTH INSTANCE, and what is new about it is that NOTHING WRITES TO IT.
 *
 * CNCORE-93. "How much does this catalogue hold" is a fact about a WHOLE
 * catalogue and cannot be narrowed to one record the way a re-import's claim
 * can, so the only way to assert it honestly is against a catalogue that does
 * not move while it is being read. Every other instance here moves: two files
 * import into the seeded one from their own workers, and the purgeable one
 * exists precisely to be written to.
 *
 * NO INSTANCE ALREADY RUNNING COULD TAKE IT, which is worth writing down because
 * reusing one is the first thing to try. The count is gated on a non-empty
 * listing, so the FRESH instance renders no count at all -- an empty catalogue
 * shows what to do next instead (ADR-0094). The PAGED one is written to by
 * nothing and would serve, except that 254 items is more than a page, so it
 * renders `Holding`'s OTHER arm -- "Showing 100 of 254 items", which
 * `front-page.test.ts` already asserts. The plain-total arm needs a catalogue
 * that is NON-EMPTY, SMALLER THAN ONE PAGE and WRITTEN TO BY NOTHING, and that
 * is the whole of this fixture.
 *
 * THE COUNT IS A PROPERTY OF `HOLDING_STILL` rather than a number asked of the
 * router. On a shared instance it had to be read back from `catalogue.list`
 * because nothing here could know it; here the fixture knows it, and
 * page-agrees-with-router was the weaker assertion anyway -- the page reads its
 * total THROUGH that procedure, so the two agreeing is one code path agreeing
 * with itself.
 */
function aCatalogueThatHoldsStill() {
  return anInstanceServing({
    suffix: "still",
    // NO PASSWORD, WHICH IS PART OF THIS FIXTURE'S CONTRACT rather than a
    // setting it happens not to need: "nothing writes to it" is what it is for,
    // and an instance nobody can log in to cannot be written to at all
    // (CNCORE-109). The same reasoning as the empty provider list below, one
    // channel over.
    ownerPassword: "",
    allowlist: "127.0.0.0/8",
    // EXPLICIT, NOT OMITTED, for the reason `freshInstall` spells out above:
    // this process inherits its own environment, so an omitted key lets a
    // developer's `.env` through. Nothing here imports, so a leaked provider
    // could not actually write -- but "nothing writes to it" is this fixture's
    // whole contract, and leaving the one channel open that could make that
    // false locally is how a fixture stops meaning what it says.
    providers: [],
    fill: async (db) => {
      // In series, because `anItemTitled` writes a statement and reads the owner
      // back for it -- and what this fixture is for is the COUNT, so two of them
      // racing to the same number is the one thing it must not do.
      for (const title of HOLDING_STILL) await anItemTitled(db, title);
      return HOLDING_STILL;
    },
  });
}

/**
 * AN INSTANCE WHOSE CONFIGURATION A TEST MAY WRITE (CNCORE-99).
 *
 * THE SETTINGS SURFACE CHANGES WHAT AN INSTANCE REACHES, so no other instance
 * here can carry it. Three files assert on which providers are configured --
 * the import surface's two notices and the purge page's rows -- and a suite
 * that named a provider on the instance they read would be CNCORE-93's shape
 * exactly: an assertion reading shared state across a write it does not own.
 *
 * IT STARTS AS AN INSTANCE NOBODY HAS CONFIGURED, which is more than a default
 * here: the page has to render the empty case, and the first thing the file
 * does is name something.
 *
 * A PASSWORD, BECAUSE CONFIGURING IS WRITING. Everything that changes an
 * instance is behind a session (CNCORE-109), and the settings surface is no
 * exception -- what a visitor sees here is one of the things the file asserts.
 *
 * NOTHING SEEDS IT. What this instance is for is its settings, and a catalogue
 * in it would be a fixture nobody reads.
 */
function anInstanceSafeToConfigure() {
  return anInstanceServing({
    suffix: "conf",
    ownerPassword: OWNER_PASSWORD,
    allowlist: "",
    providers: [],
    fill: async () => {},
  });
}

/**
 * One item a browse placed, whichever came first.
 *
 * WHICH ONE DOES NOT MATTER HERE, and that is deliberate rather than lazy: what
 * the fixture needs is an item in the state "this provider wrote it AND the
 * owner claims it", and every placed story is equally able to be put in it. Naming a
 * particular story would also be naming one the real provider images have to go
 * on holding, which is a promise this fixture does not need to make.
 */
function firstItemPlacedBy({ placements }: { placements: { itemId: string }[] }): string {
  const [first] = placements;
  if (!first) throw new Error("that browse wrote no placements, so nothing can be kept from it");
  return first.itemId;
}

/**
 * THE SLICE, and it goes through the APP rather than round it.
 *
 * An earlier version of this called the import function in-process with an
 * allowlist the harness held. That proved the library and left the app's own
 * path untested: `provider.import`, the real `createContext`, and this
 * instance's own allowlist were never exercised against a provider. Found in
 * review, and it mattered -- the ticket's criterion is that THE APP imports.
 *
 * So this is an oRPC call over real HTTP into the running production build,
 * which then reaches the provider over HTTP itself. Two hops, both real.
 */
async function importThroughTheApp(baseUrl: string, providerUrl: string) {
  const client = await asTheOwner(baseUrl);
  const { itemId } = await client.provider.import({
    baseUrl: providerUrl,
    recordId: TENTH_PLANET.id,
  });
  return {
    id: itemId,
    // THE PROVIDER'S OWN ID FOR IT, as well as the Item's. A surface that takes
    // an id from the owner has to be askable about one the catalogue already
    // holds, and this record is the only one this harness imports by hand.
    recordId: TENTH_PLANET.id,
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
 * does: `provider.browse`, the real `createContext` and this instance's own
 * allowlist are what the ticket says must work, and calling the
 * library in-process would prove none of them.
 */
async function browseThroughTheApp(baseUrl: string, providerUrl: string, databaseUrl: string) {
  const client = await asTheOwner(baseUrl);

  const missingEpisodes = await client.provider.browse({
    baseUrl: providerUrl,
    containerId: "91997",
  });
  const vashtaNerada = await client.provider.browse({
    baseUrl: providerUrl,
    containerId: "388305",
  });

  // FOUND BY TITLE rather than by index. The placements come back in the order
  // the provider gave them, so `placements[2]` would work -- and would also pass
  // if the ordering silently changed, which is the one thing this fixture is about.
  const tenthPlanet = await itemPlacedTitled(
    client,
    missingEpisodes.placements,
    TENTH_PLANET.title,
  );
  const operationDusk = await itemPlacedTitled(
    client,
    vashtaNerada.placements,
    "Operation Dusk (audio story)",
  );

  // The owner's own hand, on the item the provider just imported. A second
  // ordering that disagrees with the first about where the story sits, because
  // a demo where both orderings agree proves nothing a `series_index` could not.
  const db = createDb(databaseUrl, { maxConnections: HARNESS_CONNECTIONS });
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
       * roster from five stories to two, because NOT ONE of the 29 stories in
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

/** The id of the item a browse placed under this title. */
async function itemPlacedTitled(
  client: AppRouterClient,
  placements: { itemId: string }[],
  title: string,
): Promise<string> {
  for (const placement of placements) {
    const item = await client.item.get({ id: placement.itemId });
    if (item.title === title) return placement.itemId;
  }
  throw new Error(`the browse placed nothing titled ${title}`);
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
 * worth rendering: naming a provider and forgetting to allowlist its host is
 * the mistake two settings make easy to walk into.
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
 * answers all four and no assertion can tell, because none of them counts rows.
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

/**
 * A CONFORMANCE WITNESS: a provider that satisfies CMPP while DECLINING the one
 * operation ADR-0033 lets a provider decline.
 *
 * IT IS A STUB EVEN IN CI, WHERE THE OTHER TWO ARE REAL IMAGES, and that is not
 * a gap in the arrangement -- it is the reason this exists.
 * `packages/contract/src/participants.ts` carries the same witness for the same
 * reason and says why: `provider-wiki` and `provider-tmdb` both declare `browse`
 * since CNCORE-17, so NO REAL PROVIDER LACKS IT and there is nothing else in
 * version one exercising the optionality. A surface that must say "this provider
 * does not do that" has nothing to say it about otherwise.
 *
 * IT IS NOT A STAND-IN FOR A REAL PROVIDER and must not grow into one. It stands
 * for one claim -- that a provider may decline `browse` and still be well-formed
 * -- and this instance names it like any other, so the import page
 * fans out over it and has to handle it.
 *
 * `browse` IS NOT ROUTED AT ALL, deliberately: a provider that does not DECLARE
 * the operation is under no obligation about what the path does, so an app that
 * asked it anyway would get the 404 an unrouted path answers -- which is how
 * `asked` in `provider.test.ts` tells "declined" from "asked and refused".
 */
async function aProviderThatDeclinesBrowse(): Promise<{ url: string; close: () => Promise<void> }> {
  const manifest = {
    name: "provider-lookup-only",
    versions: [1],
    operations: ["search", "lookup"],
    max_cache_age: 86400,
    images: { stored_variant: null, per_role_limit: 0, quality_floor: 0 },
  };
  const record = {
    id: "1",
    title: "A work this provider holds",
    kind: "a kind of its own",
    released: ["1999"],
    writers: [],
    series: null,
    url: "https://example.invalid/1",
  };
  return onLoopback((path, answer) => {
    if (path === "/") return answer(manifest, 200);
    if (path.startsWith("/search")) return answer(searchOver([record], path), searchStatus(path));
    if (path === `/lookup/${record.id}`) return answer(record, 200);
    return answer({ error: "no such record" }, 404);
  });
}

/**
 * A provider that is REACHED and answers a body CMPP does not accept.
 *
 * THE THIRD THING AN `unreachable` ANSWER CARRIES, and the only one of the three
 * with no witness here before: a URL ADR-0034 refused is `UNREACHABLE_PROVIDER`,
 * a dead socket needs no stub, and a provider that ANSWERED BADLY is what makes
 * the reason a THIRD PARTY'S TEXT rather than this app's prose (ADR-0123). The
 * page renders those two differently -- CanonCore's sentence plainly, anything
 * else quoted beside the provider -- and without this nothing renders the second.
 *
 * ITS MANIFEST IS THE MALFORMED PART, because that is the first thing every
 * operation reads: one bad answer reaches `search` and `container` alike without
 * the stub implementing the rest of CMPP correctly to get there.
 *
 * IT IS NOT A STAND-IN FOR A REAL PROVIDER and must not grow into one, exactly
 * as `aProviderThatDeclinesBrowse` is not. It stands for one claim.
 */
async function aProviderThatAnswersBadly(): Promise<{ url: string; close: () => Promise<void> }> {
  // Well-formed JSON and not a CMPP manifest: every field is the wrong type, so
  // `cmppManifest` refuses it and zod's report -- not this app's prose -- is
  // what travels back to the page.
  return onLoopback((_path, answer) =>
    answer({ name: 12345, versions: "one", operations: 7 }, 200),
  );
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
  const client = await asTheOwner(baseUrl);
  const { itemId } = await client.provider.import({
    baseUrl: providerUrl,
    recordId: THE_MATRIX.id,
  });
  return { id: itemId, title: THE_MATRIX.title, notice: TMDB_NOTICE };
}

/**
 * TWO INSTANCES OF ONE PROVIDER, EACH OWED A NOTICE ON ONE ITEM (CNCORE-130).
 *
 * `sources` is unique on `(owner_id, kind, identity)` and nothing constrains the
 * label, which for a provider is its own `name` off its manifest -- so two
 * instances of one provider are two sources under ONE name, and each is owed its
 * own notice. This is the state ADR-0036's keying section is about, and the only
 * fixture here in which two notices fall due on one page.
 *
 * BOTH ARE STUBS, EVEN IN CI, WHERE `theTmdbProvider` ANSWERS A REAL IMAGE. That
 * helper answers ONE url, and one url is one identity and therefore one source;
 * what this needs is two ADDRESSES under one NAME. What is under test here is
 * CanonCore's answer to that, not the image's.
 *
 * OWED THROUGH THE CONTAINER'S TITLE, which is the clause that needs no second
 * copy of the item: each instance browses the same collection into a container of
 * its own, and an item placed in both is a page showing both instances' words.
 * A second import would give the second instance its own item instead (the
 * mapping is per source), which is not one page owing two notices.
 *
 * ITS OWN ITEM, TOUCHING NO OTHER FIXTURE. `attributed` is read by four
 * assertions about the notice, the mark and its size, and giving it a second
 * ordering and a second notice would change the page underneath all of them.
 */
async function twoInstancesOfOneProvider(baseUrl: string, databaseUrl: string) {
  const first = await stubTmdbProvider();
  const second = await stubTmdbProvider();
  const db = createDb(databaseUrl, { maxConnections: HARNESS_CONNECTIONS });
  try {
    const client = await asTheOwner(baseUrl);
    const one = await client.provider.browse({
      baseUrl: first.url,
      containerId: MATRIX_COLLECTION,
    });
    const two = await client.provider.browse({
      baseUrl: second.url,
      containerId: MATRIX_COLLECTION,
    });

    const itemId = await anItemTitled(db, "A story two instances of one provider both hold");
    const owner = await ownerSource(db);
    // PAST THE COLLECTION'S OWN TWO, so this row is the owner's addition rather
    // than a position either browse already claimed.
    for (const containerId of [one.containerId, two.containerId]) {
      await assertPlacement(db, { containerId, itemId, position: 9, sourceId: owner });
    }

    return { fixture: { id: itemId, notice: TMDB_NOTICE }, close: () => db.$client.end() };
  } finally {
    // The servers have done their work by here: the sources and the containers
    // are in the database, and nothing reads a manifest again.
    await first.close();
    await second.close();
  }
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
 * A SEVENTH INSTANCE, and what is new about it is that ITS MEMBERSHIP MOVES.
 *
 * `aCatalogueSafeToEdit`'s reason, one operation along. Placing and removing
 * CHANGE WHAT A CONTAINER HOLDS, and every container on the seeded instance is
 * somebody's fixture -- `container-page.test.ts` asserts its ordering row by row
 * and `multi-placement.test.ts` counts what the seeded item sits in. So the
 * state under test is a catalogue nobody else reads, and what
 * `placement-write.test.ts` places and removes is gone for that file alone.
 *
 * TWO CONTAINERS, BECAUSE THE TICKET'S CENTRAL CRITERION NEEDS TWO. CNCORE-72
 * asks that one item sit in several orderings at different positions and that
 * removing it from one leave the others standing -- neither of which can be
 * asserted against a catalogue with one ordering in it.
 *
 * EMPTY, AND FILLED THROUGH THE PAGE. What these containers hold is what the
 * test puts in them, because putting it there IS the behaviour under test --
 * a fixture that pre-placed the members would asserting the removal against
 * rows the harness wrote rather than against the owner's own hand.
 *
 * NO PROVIDER, so this instance reaches nothing: every claim on it is the
 * owner's, which is exactly the state `assertedBy` is read in.
 */
async function aCatalogueSafeToCurate() {
  const instance = await anInstanceServing({
    suffix: "place",
    ownerPassword: OWNER_PASSWORD,
    // ADR-0034's default: an instance nobody has configured reaches nothing.
    allowlist: "",
    providers: [],
    fill: async (db) => ({
      releaseOrder: await anItemTitled(db, "Release order", {
        isContainer: true,
        isOrdered: true,
      }),
      storyOrder: await anItemTitled(db, "Story order", { isContainer: true, isOrdered: true }),
      story: await anItemTitled(db, "The Tenth Planet"),
      otherStory: await anItemTitled(db, "The Daleks"),
    }),
  });

  return {
    baseUrl: instance.baseUrl,
    close: instance.close,
    fixture: {
      ...instance.fixture,
      storyTitle: "The Tenth Planet",
      otherTitle: "The Daleks",
      releaseOrderTitle: "Release order",
      storyOrderTitle: "Story order",
    },
  };
}

/**
 * AN INSTANCE WHOSE ORDERINGS A TEST MAY REARRANGE.
 *
 * `aCatalogueSafeToCurate`'s reason, one operation along -- and the operation is
 * what makes this a seventh instance rather than two more containers on the
 * sixth. A REORDER MOVES THE POSITIONS EVERY OTHER ASSERTION IS WRITTEN AGAINST:
 * `placement-write.test.ts` reads its rows back by `#63` and `#77`, and a
 * reorder running beside it in another worker would put those numbers on other
 * rows. The two files would fail each other at random, which is the one failure
 * mode a fixture instance exists to remove.
 *
 * POSITIONS 1, 5 AND 63, AND A FOURTH WITH NONE. The GAPS are the fixture: an
 * ordering of 1, 2, 3 cannot tell a permutation of asserted positions from a
 * renumbering that happens to agree with it, and ADR-0116 refuses to confuse
 * those two. The fourth is CONTEXT.md's Unplaced, so the boundary a reorder can
 * cross is on the page rather than imagined.
 *
 * `placeItemByHand` RATHER THAN `aPlacement`, because that helper's `position`
 * is a `number` and the whole point of the fourth row is that it has none.
 * Going through the owner's own mutation also gives every row the Owner as its
 * source, which is the state the page renders.
 */
async function aCatalogueSafeToReorder() {
  const instance = await anInstanceServing({
    suffix: "order",
    ownerPassword: OWNER_PASSWORD,
    // ADR-0034's default: an instance nobody has configured reaches nothing.
    allowlist: "",
    providers: [],
    fill: async (db) => {
      const releaseOrder = await anItemTitled(db, "Release order", {
        isContainer: true,
        isOrdered: true,
      });
      const storyOrder = await anItemTitled(db, "Story order", {
        isContainer: true,
        isOrdered: true,
      });

      const held = [
        { title: "An Unearthly Child", position: 1 },
        { title: "The Daleks", position: 5 },
        { title: "The Edge of Destruction", position: 63 },
        { title: "Mission to the Unknown", position: null },
      ];
      const placed: Record<string, string> = {};
      for (const { title, position } of held) {
        const itemId = await anItemTitled(db, title);
        placed[title] = itemId;
        await placeItemByHand(db, { containerId: releaseOrder, itemId, position });
      }

      /*
       * AND ONE OF THEM IN A SECOND ORDERING, which is the ticket's third
       * criterion: reordering one container must not move the item in another.
       * Read back from the OTHER container's page, so the claim is about what a
       * reader sees rather than about what the reordered page happened to say.
       */
      const alsoElsewhere = placed["The Daleks"];
      if (!alsoElsewhere) throw new Error("the fixture placed nothing titled The Daleks");
      await placeItemByHand(db, { containerId: storyOrder, itemId: alsoElsewhere, position: 29 });

      return {
        releaseOrder,
        storyOrder,
        first: "An Unearthly Child",
        second: "The Daleks",
        third: "The Edge of Destruction",
        unplaced: "Mission to the Unknown",
        secondPositionElsewhere: 29,
      };
    },
  });

  return { baseUrl: instance.baseUrl, close: instance.close, fixture: instance.fixture };
}

/**
 * A SIXTH INSTANCE, and what is new about it is that IT CAN BE EDITED.
 *
 * `aCatalogueSafeToPurge`'s reason, one operation along. Editing a title
 * REPLACES what a page shows, and the seeded instance's titles are all somebody
 * else's fixture -- `item-page.test.ts` asserts the imported item's down to its
 * `<h1>`, and the seeded item's is what `front-page.test.ts` reads. So the
 * state under test is a catalogue nobody else reads, and what `item-write`
 * changes is gone for that file alone.
 *
 * TWO ITEMS, BECAUSE THE TICKET HAS TWO CRITERIA ABOUT WHOSE VALUE WINS. One is
 * made BY HAND and carries only the owner's own title -- ADR-0003's item with
 * no provider record and no file, which is what proves an edit needs no
 * provider to have gone first. The other is IMPORTED, so its title is a
 * provider's and the owner's edit has something to beat (ADR-0025).
 *
 * THE IMPORT GOES THROUGH THE APP, for the reason every other fixture here
 * does: a provider title written by hand would assert the owner's edit against
 * the harness's idea of an import rather than against one.
 *
 * THE HAND-MADE ONE DOES NOT, and that is not an inconsistency. It is written
 * before the server starts, through `@canoncore/db`'s own export, because what
 * this file needs is an item in that STATE rather than a second test of the
 * create path -- `item-write.test.ts` creates items through the page itself,
 * which is where creating is actually asserted.
 */
async function aCatalogueSafeToEdit(wikiUrl: string) {
  const handTitle = "A title only the owner has ever given anything";
  let hand = "";
  const instance = await anInstanceServing({
    suffix: "edit",
    // FILLED AND THEN EDITED THROUGH THE PAGE, both of which are the owner's.
    ownerPassword: OWNER_PASSWORD,
    allowlist: "127.0.0.0/8",
    providers: [wikiUrl],
    fill: async (db) => {
      hand = await anItemTitled(db, handTitle);
    },
  });

  const client = await asTheOwner(instance.baseUrl);
  const { itemId } = await client.provider.import({
    baseUrl: wikiUrl,
    recordId: TENTH_PLANET.id,
  });

  return {
    baseUrl: instance.baseUrl,
    close: instance.close,
    fixture: {
      hand,
      handTitle,
      imported: itemId,
      importedTitle: TENTH_PLANET.title,
      providerLabel: "provider-wiki",
      providerUrl: wikiUrl,
      /*
       * THE CONTAINER THAT HOLDS THE IMPORTED RECORD, so the re-import can be
       * driven through `/import`'s browse form rather than through the client.
       * 91997 carries 265 in its ordering (`wiki-fixture.ts`), and browsing it
       * re-asserts every member -- which is the refresh an owner performs when a
       * provider has updated a season, and the only re-import a PAGE can do: the
       * import surface offers no button for a record already held.
       */
      container: "91997",
    },
  };
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
  const db = createDb(databaseUrl, { maxConnections: HARNESS_CONNECTIONS });
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
  const db = createDb(databaseUrl, { maxConnections: HARNESS_CONNECTIONS });
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
  const db = createDb(databaseUrl, { maxConnections: HARNESS_CONNECTIONS });
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
   * unsorted one. Measured: removing the `orderBy` from `findPlacementsInContainer`
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
  const byRelease = await aProvider(
    db,
    "https://provider.test/by-release",
    "A wiki that orders by release",
  );

  const withARecap = await anItemTitled(db, "An ordering that opens with its own recap", {
    isContainer: true,
    isOrdered: true,
  });
  const shownTwice = await anItemTitled(db, "A story shown twice in one ordering");
  /*
   * THE SAME SOURCE ASSERTS BOTH ROWS, and it is a PROVIDER rather than the
   * owner on purpose. What the page has to show is one-source-twice against
   * two-sources-once-each, and a recap sourced to the owner would differ from
   * the disagreement below in TWO ways at once -- how many sources, and whether
   * they are the owner's hand -- so a page that had merely learnt to print
   * "Owner" would satisfy the comparison. It is the wiki both times, and the
   * count is the only thing left that differs.
   */
  await aPlacement(db, {
    containerId: withARecap,
    itemId: shownTwice,
    position: 1,
    sourceId: byRelease,
  });
  await aPlacement(db, {
    containerId: withARecap,
    itemId: shownTwice,
    position: 5,
    sourceId: byRelease,
  });

  /*
   * A DISAGREEMENT, which is the thing the repeat above renders identically to
   * until the rows name their sources: ADR-0017 has two sources claiming
   * different positions for one membership producing TWO placement rows, which
   * is the recap's own shape -- one item, twice, at two positions.
   *
   * SEEDED RATHER THAN WRITTEN BY THE PRODUCT, because nothing in the product
   * can write one. `browse` writes one source's claims per call and the owner's
   * hand has no surface that places anything yet, which ADR-0017 says in its own
   * words -- so this is the one place in the suite where the two shapes can be
   * put side by side and told apart.
   *
   * TWO PROVIDERS RATHER THAN THE OWNER AND A PROVIDER, and that is the half
   * that makes it bite. A kind would separate `owner` from `provider`; it
   * cannot separate a wiki from a broadcaster, and two providers disagreeing is
   * what this catalogue actually holds -- the wiki's series against TMDB's
   * season. The rows have to name the sources, not their kinds.
   */
  const disagreedAbout = await anItemTitled(db, "An ordering two sources disagree about", {
    isContainer: true,
    isOrdered: true,
  });
  const argued = await anItemTitled(db, "A story two sources place differently");
  /*
   * THE BETTER-PLACED SOURCE CLAIMS THE LATER POSITION, and that is what makes
   * the page assertion a test rather than a coincidence. `aProvider` allocates
   * the next place in the global source order, so the wiki created above
   * outranks the broadcaster created here -- and it is the wiki that says 3.
   * A member list that let rank lead, which is what `findPlacementsOfItem` does
   * on the item's end and what ADR-0018 forbids here, would therefore render #3
   * before #1. MEASURED: with both sources the other way round, the same page
   * assertion passed against exactly that mutation.
   */
  const byTransmission = await aProvider(
    db,
    "https://provider.test/by-transmission",
    "A broadcaster that orders by transmission",
  );
  await aPlacement(db, {
    containerId: disagreedAbout,
    itemId: argued,
    position: 1,
    sourceId: byTransmission,
  });
  await aPlacement(db, {
    containerId: disagreedAbout,
    itemId: argued,
    position: 3,
    sourceId: byRelease,
  });
  /*
   * AND ONE MEMBER THE TWO AGREE ABOUT, which is the other half of ADR-0017:
   * sources agreeing land on ONE placement row carrying a source each, and that
   * record carries "corroboration is invisible to every reader" as a named gap.
   * Invisible is what it stays unless a page somewhere renders both names, so
   * this is the row that proves it does.
   */
  const agreedOn = await anItemTitled(db, "A story both sources place at two");
  for (const sourceId of [byRelease, byTransmission]) {
    await assertPlacement(db, {
      containerId: disagreedAbout,
      itemId: agreedOn,
      position: 2,
      sourceId,
    });
  }

  /*
   * AND ONE MEMBER A SINGLE SOURCE PLACES, WHOSE OWN NAME CARRIES A COMMA
   * (CNCORE-128, and ADR-0017's section for it says why a comma in a label
   * forged corroboration).
   *
   * IN THE SAME CONTAINER AS THE OTHER TWO SHAPES, because the criterion is a
   * DIFFERENCE: a page holding only this row passes against a list that still
   * joins on a comma, and a page holding only `agreedOn` passes against one
   * that never separates names at all.
   *
   * AND IT IS SEEDED LAST, so the source it creates takes the next place in the
   * global order (ADR-0025) and leaves the wiki still ahead of the broadcaster
   * -- which is what the rank-order assertions either side of it read.
   */
  const callsItselfAcme = "A wiki that calls itself Acme, Inc.";
  const acme = await aProvider(db, "https://provider.test/acme", callsItselfAcme);
  const placedByOne = await anItemTitled(db, "A story one source places");
  await assertPlacement(db, {
    containerId: disagreedAbout,
    itemId: placedByOne,
    position: 4,
    sourceId: acme,
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
      /** What it holds, in the order the container puts them -- NOT the order they were written. */
      inPositionOrder: [
        "The story that opens that season",
        "The story in the middle of that season",
        "A story in that season",
      ],
      withARecapId: withARecap,
      repeated: "A story shown twice in one ordering",
      repeatedId: shownTwice,
      /** Who asserted BOTH of the recap's rows, which is what makes it a repeat. */
      repeatedBy: "A wiki that orders by release",
      disagreedAboutId: disagreedAbout,
      argued: "A story two sources place differently",
      /**
       * THE ARGUED STORY'S OWN PAGE, which is where CNCORE-121 reads the same
       * disagreement from the other end: the container's list shows it twice in
       * POSITION order, and "Also appears in" shows the same two rows with rank
       * leading. One fixture, both ends, so the two cannot be seeded apart.
       */
      arguedId: argued,
      /** The two sources that place it apart, in the positions they claim. */
      arguedBy: ["A broadcaster that orders by transmission", "A wiki that orders by release"],
      agreedOn: "A story both sources place at two",
      /** The corroborated story's own page, for the same reason `arguedId` is here. */
      agreedOnId: agreedOn,
      singlySourced: "A story one source places",
      /** Its own page, for the same reason `arguedId` is here: both ends, one fixture. */
      singlySourcedId: placedByOne,
      /** The ONE source behind it, whose own name carries the comma that joined two. */
      singlySourcedBy: callsItselfAcme,
    },
    // The seed ends its own client; this pool has to be ended too, or the run
    // holds an idle connection open against a database it has finished with.
    close: () => db.$client.end(),
  };
}

declare module "vitest" {
  interface ProvidedContext {
    baseUrl: string;
    /**
     * The SAME BUILD serving an empty database with no allowlist: what a
     * stranger's first run of CanonCore is (ADR-0094).
     */
    freshBaseUrl: string;
    /**
     * What the owner logs in with on every instance that has a password. The
     * fresh one above deliberately has none, which is what ADR-0044's demo is.
     */
    ownerPassword: string;
    /** The same build again, serving a catalogue of several hundred items. */
    pagedBaseUrl: string;
    /**
     * And again, serving a catalogue NOBODY ELSE READS -- so a test may delete
     * from it. Every other instance here is somebody's fixture.
     */
    purgeableBaseUrl: string;
    /** Which provider on it may be purged, which may not, and what survives one. */
    purgeable: {
      /** Previewed and declined, never purged, so this half always stands. */
      previewed: string;
      /** The one the destructive test takes. */
      purged: string;
      /** Configured, and nothing was ever imported from it. */
      neverImported: string;
      /** An item the previewed provider wrote AND the owner places: it stays. */
      keptFromPreviewed: string;
      /** The same state, on the provider that gets purged. */
      keptFromPurged: string;
    };
    /**
     * And again, serving a catalogue NOBODY ELSE READS -- so a test may EDIT
     * it. `item-write.test.ts` retitles a provider's item, and every title on
     * the seeded instance is somebody's fixture (`item-page.test.ts` asserts
     * the imported one down to its `<h1>`).
     */
    editableBaseUrl: string;
    /** The two items on it, and what they are titled before anything edits them. */
    editable: {
      /** Made by hand, with no provider record and no file (ADR-0003). */
      hand: string;
      handTitle: string;
      /** Imported, so its title is a PROVIDER's and the owner's can beat it. */
      imported: string;
      importedTitle: string;
      /** What the provider calls itself, which is what a Values row shows. */
      providerLabel: string;
      /** Where it was imported from, for a re-import driven through `/import`. */
      providerUrl: string;
      /** A container holding that record, so browsing it re-asserts the record. */
      container: string;
    };
    /**
     * And again, serving a catalogue NOBODY ELSE READS -- so a test may change
     * WHAT ITS CONTAINERS HOLD. Every container on the seeded instance is
     * somebody's fixture, asserted row by row.
     */
    curatableBaseUrl: string;
    /** Two empty orderings and two items, for the owner's own hand to place. */
    curatable: {
      releaseOrder: string;
      storyOrder: string;
      story: string;
      otherStory: string;
      storyTitle: string;
      otherTitle: string;
      releaseOrderTitle: string;
      storyOrderTitle: string;
    };
    /**
     * And again, serving a catalogue whose ORDERINGS a test may rearrange. A
     * reorder moves the positions every other assertion is written against, so
     * it cannot share an instance even with the one that places.
     */
    reorderableBaseUrl: string;
    /** An ordering with gaps and an unplaced tail, and one member in a second ordering. */
    reorderable: {
      releaseOrder: string;
      storyOrder: string;
      /** The titles, in the order the page shows them: 1, 5, 63, then no position given. */
      first: string;
      second: string;
      third: string;
      unplaced: string;
      /** Where `second` sits in `storyOrder`, which reordering the other must not touch. */
      secondPositionElsewhere: number;
    };
    /** Every item that instance holds: the set a walk has to arrive at, exactly. */
    pagedCatalogue: string[];
    /**
     * The two of those with NO TITLE, which is the set Catalogue search cannot
     * reach: the match is `title ilike ...`, and that is NULL without a title.
     * So a search walk's oracle is `pagedCatalogue` minus these.
     */
    pagedUntitled: string[];
    /**
     * The ONE item on that instance that holds all the others: an ordering
     * larger than one page, which is the only state a members walk is
     * observable in (ADR-0119, CNCORE-89).
     *
     * `holds` IS EVERY PLACEMENT IT WROTE, as a SET rather than in order -- the
     * ordering ties two of them on one position and which comes first is
     * decided by the uuids that were handed out. A walk is oracled against the
     * set it must arrive at exactly, which is the criterion anyway.
     */
    pagedContainer: { id: string; holds: string[] };
    /**
     * The ONE item on that instance sitting in more orderings than one page --
     * the mirror of `pagedContainer` above, and the only state in which "Also
     * appears in" is walkable at all (ADR-0119, CNCORE-125).
     *
     * `containers` IS EVERY ORDERING IT MINTED, which the caller counts into
     * `pagedCatalogue`: they are items too, and a catalogue oracle that did not
     * know about them would be exact about a catalogue that no longer exists.
     *
     * `sitsIn` IS EVERY PLACEMENT IT WROTE, as a SET rather than in order --
     * two of the orderings share a name and which of them comes first is
     * decided by the uuids that were handed out. A walk is oracled against the
     * set it must arrive at exactly, which is the criterion anyway.
     */
    pagedAppearsIn: {
      id: string;
      containers: string[];
      unnamed: string[];
      sitsIn: { id: string; containerId: string }[];
      /**
       * The ONE of those a PROVIDER asserted, where every other is the owner's
       * own hand -- so this item has two origins, and one of them is a single
       * row sitting past the first page (CNCORE-129).
       */
      imported: { id: string; containerId: string };
      /** The placement that sorts last, which is where the end of the walk is. */
      endsAt: string;
    };
    /**
     * And again, serving a catalogue NOTHING WRITES TO -- the one state in which
     * "how much this catalogue holds" can be asserted at all (CNCORE-93).
     */
    stillBaseUrl: string;
    /**
     * And again, serving an instance whose own CONFIGURATION a test may write:
     * the only one the settings surface may be used on (CNCORE-99).
     */
    configurableBaseUrl: string;
    /**
     * Every item it holds, as `pagedCatalogue` above does -- so how much it holds
     * comes from the fixture that wrote them rather than from the app.
     */
    stillCatalogue: string[];
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
      repeatedBy: string;
      disagreedAboutId: string;
      argued: string;
      arguedId: string;
      arguedBy: string[];
      agreedOn: string;
      agreedOnId: string;
      singlySourced: string;
      singlySourcedId: string;
      singlySourcedBy: string;
    };
    /** The story imported from a CMPP provider over HTTP, and what it claimed. */
    imported: {
      id: string;
      /** The provider's own id for it, which is what `lookup` and `browse` take. */
      recordId: string;
      title: string;
      released: string;
      providerLabel: string;
    };
    /**
     * An item imported from the SECOND provider, whose licence obliges the app to
     * show a notice and a mark (ADR-0036).
     */
    attributed: { id: string; title: string; notice: string };
    /** One item two instances of one provider each owe a notice on (CNCORE-130). */
    twoInstances: { id: string; notice: string };
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
      /**
       * A provider this instance searches that declares no `browse`, which
       * ADR-0033 makes well-formed. No real provider lacks it, so this is the
       * conformance witness rather than one of the images.
       */
      declinesBrowse: string;
      /**
       * A provider this instance searches that IS REACHED and answers a body
       * CMPP does not accept -- the third thing an `unreachable` answer carries,
       * beside a refused URL and a dead socket (ADR-0123). Its reason is a third
       * party's text rather than this app's, which is the case no image
       * produces and the one the page has to QUOTE rather than speak.
       */
      answersBadly: string;
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
