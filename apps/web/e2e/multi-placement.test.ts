import type { AppRouterClient } from "@canoncore/api/routers";
import { assertPlacement, createDb, type Database, sources } from "@canoncore/db";
import { anItem, aStatement } from "@canoncore/db/testing/catalogue";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { logInAt } from "./document";
import { HARNESS_CONNECTIONS } from "./instance";

/**
 * THE TEST THAT PROVES THIS IS NOT A TREE.
 *
 * One item, more than one placement, at a DIFFERENT POSITION IN EACH ORDERING --
 * with both positions stated by sources outside this product rather than read
 * back out of our own database. A test whose expectations come from the system
 * it is testing passes by comparing the system to itself and proves nothing.
 */

/** The wiki's containers, by the page ids ADR-0057's committed fixture holds. */
const SERIES_1 = "47650";
const SERIES_2 = "47651";

/**
 * WHERE THE WIKI PUTS *ROSE*, and it is the control rather than a sixth row of
 * the disagreement.
 *
 * The two sources match ONE TO ONE across all thirteen of series 1 -- measured
 * on both sides on 2026-09-11 -- so there is no offset here to find. Without a
 * row where the sources AGREE, this file cannot tell a detected disagreement
 * from a test that finds one wherever it looks.
 */
const WIKI_SERIES_1 = { rose: 1 };

/**
 * AND WHERE TMDB PUTS IT: `tv/57243` season 1, first, read the same day.
 *
 * IT GETS NO CONTAINER OF ITS OWN, and that is the decision this row turns on.
 * TMDB's season 1 and the wiki's series 1 hold the same thirteen stories in the
 * same order, so TMDB is asserting THE SAME PLACEMENT rather than a competing
 * one -- and ADR-0017 records agreement against ONE row with a source each,
 * because the same item at the same position twice is never a deliberate
 * duplicate, it is corroboration.
 *
 * Season 2 is the opposite case and gets its own container for the opposite
 * reason: fifteen members against thirteen is not one ordering two sources
 * describe.
 */
const TMDB_SEASON_1 = { rose: 1 };

/**
 * WHERE THE WIKI PUTS THESE STORIES, hardcoded here and asserted against what a
 * real `browse` answers.
 *
 * It reaches the catalogue by IMPORT: in CI's provider job the real
 * `provider-wiki` image serves ADR-0057's committed extract, so these numbers
 * are answerable to the archive rather than to this file.
 */
const WIKI_SERIES_2 = {
  bornAgain: 1,
  christmasInvasion: 2,
  newEarth: 3,
  fearHer: 13,
  doomsday: 15,
};

/**
 * WHAT TMDB SAYS ABOUT THE SAME STORIES -- `tv/57243`, at story level, one
 * episode to one wiki story.
 *
 * Read from `api.themoviedb.org/3/tv/57243/season/2` on 2026-09-11. THESE
 * NUMBERS ARE CACHED TMDB CONTENT SUBJECT TO THE PURGE DUTY (ADR-0036): a
 * committed expectation is a cache that never expires, so purging TMDB is two
 * acts rather than one, and the second is a hand edit against this file.
 */
const TMDB_SEASON_2 = {
  id: "season:57243:2",
  title: "Series 2",
  newEarth: 1,
  fearHer: 11,
  doomsday: 13,
};

/**
 * AND WHERE TMDB FILES THE TWO STORIES THE WIKI PUTS AT THE FRONT OF SERIES 2.
 * `tv/57243` season 0, read the same day and cached under the same duty.
 *
 * THIS IS WHY FIFTEEN IS NOT THIRTEEN. The wiki folds the Children in Need
 * mini-episode and the Christmas special into the series; TMDB files both under
 * Specials. Those two members are the whole of the offset every row above
 * asserts, and they are here as members of a THIRD container rather than as an
 * explanation in a comment.
 */
const TMDB_SPECIALS = {
  id: "season:57243:0",
  title: "Specials",
  bornAgain: 1,
  christmasInvasion: 2,
};

let db: Database;
let client: AppRouterClient;
/** The wiki's `Series 2`, as the import wrote it. */
let wikiSeries2: string;
/** TMDB's `Season 2`, which is a DIFFERENT container and is never matched to it. */
let tmdbSeason2: string;
/** TMDB's `Specials`, where it files two of the wiki's `Series 2` members. */
let tmdbSpecials: string;
/** The wiki's `Series 1`, which TMDB agrees with one to one. */
let wikiSeries1: string;
let rose: string;
/** Every member of the wiki's `Series 2`, by the title the import gave it. */
let series2Items: Map<string, string>;

beforeAll(async () => {
  db = createDb(inject("databaseUrl"), { maxConnections: HARNESS_CONNECTIONS });
  // LOGGED IN, because a browse WRITES and writing is the owner's since
  // CNCORE-109. The cookie is the one the login page hands a browser.
  const cookie = await logInAt(inject("baseUrl"), inject("ownerPassword"));
  client = createORPCClient(
    new RPCLink({ url: `${inject("baseUrl")}/api/rpc`, headers: { cookie } }),
  );

  // THE WIKI'S HALF, IMPORTED FOR REAL, through the app and then over HTTP to
  // the provider. Nothing here writes a wiki position.
  const browsed = await client.provider.browse({
    baseUrl: inject("providerWikiUrl"),
    containerId: SERIES_2,
  });
  wikiSeries2 = browsed.containerId;
  series2Items = await itemsByTitle(browsed.placements);

  const series1 = await client.provider.browse({
    baseUrl: inject("providerWikiUrl"),
    containerId: SERIES_1,
  });
  wikiSeries1 = series1.containerId;
  const roseId = (await itemsByTitle(series1.placements)).get("Rose (TV story)");
  if (roseId === undefined) throw new Error("the browse of Series 1 placed no Rose");
  rose = roseId;

  /*
   * TMDB'S HALF, RECORDED AS TMDB'S CLAIM RATHER THAN BROWSED.
   *
   * Deciding that TMDB's record and the wiki's describe one story is MATCHING,
   * which ADR-0026 makes its own operation with its own endpoint and which
   * nothing has built -- so a real TMDB browse would mint its OWN `New Earth`
   * and leave one item in one ordering, which is the shape this test exists to
   * refuse. What is written below is what that operation's apply step would
   * write, performed here because nothing else can perform it.
   *
   * THE DAY MATCHING LANDS, THIS SHOULD BROWSE TMDB FOR REAL and delete these
   * lines. It is a test written in front of an operation that does not exist,
   * not a workaround to preserve. ADR-0026 carries the other end of this.
   */
  const tmdb = await tmdbSource();

  // TMDB'S AGREEMENT, RECORDED AGAINST THE WIKI'S OWN CONTAINER AND POSITION.
  // Deliberately not a container of its own: the two sources hold the same
  // thirteen stories in the same order, so this is one ordering two sources
  // assert rather than two orderings -- and ADR-0017 puts that on ONE row with
  // a source each. `assertPlacement` finds the row the browse already wrote.
  await assertPlacement(db, {
    containerId: wikiSeries1,
    itemId: rose,
    position: TMDB_SEASON_1.rose,
    sourceId: tmdb,
  });

  tmdbSeason2 = await containerClaimedBy(tmdb, TMDB_SEASON_2.id, TMDB_SEASON_2.title);
  await placeAll(tmdbSeason2, tmdb, [
    ["New Earth (TV story)", TMDB_SEASON_2.newEarth],
    ["Doomsday (TV story)", TMDB_SEASON_2.doomsday],
    ["Fear Her (TV story)", TMDB_SEASON_2.fearHer],
  ]);

  tmdbSpecials = await containerClaimedBy(tmdb, TMDB_SPECIALS.id, TMDB_SPECIALS.title);
  await placeAll(tmdbSpecials, tmdb, [
    ["Born Again (TV story)", TMDB_SPECIALS.bornAgain],
    ["The Christmas Invasion (TV story)", TMDB_SPECIALS.christmasInvasion],
  ]);
});

afterAll(async () => {
  // `db` is unset if `beforeAll` threw before it was assigned -- a browse that
  // could not reach the provider, most likely. Vitest reports that failure; a
  // second throw from here would bury it under one about an undefined client.
  await db?.$client.end();
});

describe("two sources that agree", () => {
  /*
   * THE CONTROL, and the row that makes every assertion above mean something.
   *
   * ONE PLACEMENT ROW CARRYING TWO SOURCES. A second row would be this product
   * counting corroboration as a competing claim, and a reader of "Also appears
   * in" would meet series 1 twice at position 1 with nothing to tell them apart.
   *
   * THE TWO HALVES ARE BOTH FALSIFIABLE THROUGH THE READ PATH. `positionIn`
   * refuses anything but exactly one placement in that container, so a model
   * that wrote agreement as two rows fails there. And TMDB is owed a notice on
   * this page for exactly one reason -- a TMDB placement source sits on this
   * item -- so a model that silently dropped the second source loses the
   * attribution with it. Neither half can go without the test saying so.
   */
  it("records Rose once in series 1, with the wiki and TMDB both behind it", async () => {
    const item = await client.item.get({ id: rose });

    // ONE ROW, and both sources put it at the same number. Asserted against each
    // of them separately rather than against one: what makes this a control is
    // that the wiki and TMDB independently say first, and a row checked against
    // only one of them would still read as a control after the other moved.
    expect(positionIn(item, wikiSeries1)).toBe(WIKI_SERIES_1.rose);
    expect(positionIn(item, wikiSeries1)).toBe(TMDB_SEASON_1.rose);

    // AND TMDB IS OWED A NOTICE HERE, which it can only be because a TMDB
    // placement source sits on this item (ADR-0036 reads the obligation off the
    // claims themselves). That is the second source, on the one row.
    expect(item.attribution.map((owed) => owed.sourceLabel)).toStrictEqual(["provider-tmdb"]);
  });
});

describe("one item, two orderings, two positions", () => {
  it("puts New Earth third on the wiki and first on TMDB, at once", async () => {
    const item = await client.item.get({ id: story("New Earth (TV story)") });

    expect(positionIn(item, wikiSeries2)).toBe(WIKI_SERIES_2.newEarth);
    expect(positionIn(item, tmdbSeason2)).toBe(TMDB_SEASON_2.newEarth);
  });

  /*
   * THE SAME OFFSET AT THE FAR END, so the test cannot pass by coincidence.
   * *New Earth* alone is two small numbers one apart from the front of two
   * orderings, which a model that simply lost a placement could still satisfy.
   * Fifteen against thirteen cannot be reached by accident.
   *
   * TWO ROWS RATHER THAN ONE, for two reasons that do not overlap. *Doomsday*
   * is the story the ticket names and the last member of both orderings;
   * *Fear Her* is a SINGLE-PART story, where ADR-0057's "one episode is one
   * story" holds outright -- only seven of these fifteen are, and *Doomsday*
   * is half of a two-parter TMDB titles `Doomsday (2)`.
   */
  it.each([
    ["Doomsday (TV story)", WIKI_SERIES_2.doomsday, TMDB_SEASON_2.doomsday],
    ["Fear Her (TV story)", WIKI_SERIES_2.fearHer, TMDB_SEASON_2.fearHer],
  ])(
    "keeps the offset at %s, deep in the ordering rather than at its head",
    async (title, wiki, tmdb) => {
      const item = await client.item.get({ id: story(title) });

      expect(positionIn(item, wikiSeries2)).toBe(wiki);
      expect(positionIn(item, tmdbSeason2)).toBe(tmdb);
    },
  );

  /*
   * DIFFERENT CONTAINERS RATHER THAN DIFFERENT POSITIONS, which is a distinct
   * claim and the reason these two rows are not a repeat of the ones above.
   * The numbers AGREE here -- second on the wiki, second on TMDB -- and the
   * disagreement is about WHICH ORDERING the story belongs to at all. Anything
   * that reconciled two sources by position would read these as one placement
   * and lose the fact entirely.
   */
  it.each([
    [
      "The Christmas Invasion (TV story)",
      WIKI_SERIES_2.christmasInvasion,
      TMDB_SPECIALS.christmasInvasion,
    ],
    ["Born Again (TV story)", WIKI_SERIES_2.bornAgain, TMDB_SPECIALS.bornAgain],
  ])("files %s in Series 2 on the wiki and in Specials on TMDB", async (title, wiki, tmdb) => {
    const item = await client.item.get({ id: story(title) });

    expect(positionIn(item, wikiSeries2)).toBe(wiki);
    expect(positionIn(item, tmdbSpecials)).toBe(tmdb);
    // AND NOWHERE IN TMDB'S SEASON 2, which is the membership difference itself
    // rather than a consequence of it: fifteen against thirteen is these two
    // stories, and without this line the offset above could be a renumbering.
    expect(
      item.placements.rows.filter((placement) => placement.containerId === tmdbSeason2),
    ).toStrictEqual([]);
  });
});

describe("not a tree", () => {
  /*
   * THE INVARIANT IN ITS OWN WORDS. Every assertion above reads a POSITION and
   * would still pass against a model that had quietly lost the second ordering
   * and started answering the first twice. This one asks the question the
   * product is built around: how many parents does this story have.
   *
   * It passes the day it is written, which is the point of it. Nothing here
   * drove new code -- the model, the read path and the import already do this
   * (ADR-0009, ADR-0018) -- and what this protects against is a REBUILD. An
   * item with a `series_index` on it, or a `parent_id`, cannot make it green.
   */
  it("gives New Earth two parents, at two positions, from two sources", async () => {
    const item = await client.item.get({ id: story("New Earth (TV story)") });

    // TWO ROWS, NOT ONE. `toHaveLength` rather than `toBeGreaterThan`, because
    // a collapse is the failure this exists to catch and "at least one" is what
    // a collapsed model answers.
    expect(item.placements.rows).toHaveLength(2);
    expect(
      item.placements.rows.map((placement) => placement.containerId).toSorted(),
    ).toStrictEqual([wikiSeries2, tmdbSeason2].toSorted());
    // And the two rows are two rows rather than one read twice.
    expect(new Set(item.placements.rows.map((placement) => placement.id)).size).toBe(2);
  });

  /*
   * AND THE TWO CONTAINERS ARE TWO CONTAINERS.
   *
   * Matching them would turn this into ADR-0017's POSITION DISAGREEMENT -- two
   * placement rows in ONE ordering, resolved by rank -- which is a different
   * mechanism that would leave multi-placement untested while every assertion
   * in this file still passed. Deciding two providers' records describe one
   * thing is ADR-0026's operation and nothing has built it.
   *
   * Read as the id each SOURCE knows its container by (ADR-0078): one item
   * carrying both would fail here, whichever way it had been merged.
   */
  it("holds the wiki's Series 2 and TMDB's Season 2 apart", async () => {
    expect(wikiSeries2).not.toBe(tmdbSeason2);

    const wiki = await client.item.get({ id: wikiSeries2 });
    const tmdb = await client.item.get({ id: tmdbSeason2 });

    expect(externalIdsOf(wiki)).toStrictEqual([{ sourceLabel: "provider-wiki", value: SERIES_2 }]);
    expect(externalIdsOf(tmdb)).toStrictEqual([
      { sourceLabel: "provider-tmdb", value: TMDB_SEASON_2.id },
    ]);
  });
});

/** The id each source knows this item by, and which source knows it. */
function externalIdsOf(
  item: Awaited<ReturnType<AppRouterClient["item"]["get"]>>,
): { sourceLabel: string; value: string }[] {
  return item.statements
    .filter((statement) => statement.property === "external_id")
    .map(({ sourceLabel, value }) => ({ sourceLabel, value }));
}

/**
 * Every placement one TMDB ordering asserts, against the items already here.
 *
 * `story` resolves each title to the item the WIKI's import wrote, which is the
 * whole point: these rows go onto the stories the catalogue already holds rather
 * than onto records of TMDB's own.
 */
async function placeAll(
  containerId: string,
  sourceId: string,
  rows: readonly (readonly [title: string, position: number])[],
): Promise<void> {
  for (const [title, position] of rows) {
    await assertPlacement(db, { containerId, itemId: story(title), position, sourceId });
  }
}

/**
 * What the read path says about where this item sits in one container.
 *
 * IT REFUSES ANYTHING BUT EXACTLY ONE, which is an assertion rather than
 * defensive tidying: two rows for one item in one container is either a REPEAT
 * (ADR-0009) or agreement written as a competing claim, and neither is what any
 * caller here is asking about.
 */
function positionIn(
  item: Awaited<ReturnType<AppRouterClient["item"]["get"]>>,
  containerId: string,
): number | null {
  const [only, ...rest] = item.placements.rows.filter(
    (placement) => placement.containerId === containerId,
  );
  if (only === undefined || rest.length > 0) {
    throw new Error(
      `${rest.length + (only === undefined ? 0 : 1)} placements in ${containerId}, expected exactly one`,
    );
  }
  return only.position;
}

/**
 * Every item a browse placed, by title.
 *
 * BY TITLE RATHER THAN BY INDEX. `placements[2]` would work and would also go on
 * working if the ordering silently changed, which is the one thing this fixture
 * is about.
 */
async function itemsByTitle(placements: { itemId: string }[]): Promise<Map<string, string>> {
  const byTitle = new Map<string, string>();
  for (const placement of placements) {
    const item = await client.item.get({ id: placement.itemId });
    if (item.title !== null) byTitle.set(item.title, placement.itemId);
  }
  return byTitle;
}

/** One of the wiki's `Series 2` stories, by the title the archive gives it. */
function story(title: string): string {
  const id = series2Items.get(title);
  if (id === undefined) throw new Error(`the browse of Series 2 placed no ${title}`);
  return id;
}

/** The source row `importFromTmdb` made, which a TMDB claim is recorded against. */
async function tmdbSource(): Promise<string> {
  const [source] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.identity, inject("providerTmdbUrl")));
  if (!source) throw new Error("no TMDB source; the suite imports from TMDB before this runs");
  return source.id;
}

/**
 * A container as ONE source states it: its own item, carrying that source's own
 * id for it (ADR-0078) and that source's own title for it.
 *
 * ITS OWN ITEM, NEVER THE OTHER SOURCE'S. The wiki's `Series 2` holds fifteen
 * members and TMDB's holds thirteen, so they are two containers that disagree
 * about membership rather than one container two sources describe. Matching them
 * would make this ADR-0017's POSITION DISAGREEMENT -- two placement rows in one
 * ordering, resolved by rank -- which is a different mechanism, and
 * multi-placement would go untested while every assertion here still passed.
 */
async function containerClaimedBy(
  sourceId: string,
  externalId: string,
  title: string,
): Promise<string> {
  const id = await anItem(db, { isContainer: true, isOrdered: true });
  await aStatement(db, {
    subjectItemId: id,
    property: "external_id",
    valueLiteral: externalId,
    sourceId,
  });
  await aStatement(db, { subjectItemId: id, property: "title", valueLiteral: title, sourceId });
  return id;
}
