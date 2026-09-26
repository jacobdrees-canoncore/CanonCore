import type { AppRouterClient } from "@canoncore/api/routers";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { clientAt, logInAt } from "./document";

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
 * AND WHERE TMDB PUTS IT: `tv/57243` season 1, first, read the same day and
 * again on 2026-09-26.
 *
 * IN TMDB'S OWN CONTAINER SINCE CNCORE-361, and that changed what this row is.
 * It was written by hand into the WIKI's `Series 1`, as ADR-0017's one row with
 * a source each, because TMDB's season and the wiki's series hold the same
 * thirteen stories in the same order. A real browse cannot do that: matching
 * joins two Providers' WORKS, and nothing matches their Containers (ADR-0128
 * keeps two orderings apart). So TMDB's season is a Container of its own, and
 * the control is two orderings agreeing about one Item rather than one row.
 */
const TMDB_SEASON_1 = { id: "season:57243:1", rose: 1 };

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
 * Read from `api.themoviedb.org/3/tv/57243/season/2` on 2026-09-11 and again on
 * 2026-09-26. THESE NUMBERS ARE CACHED TMDB CONTENT SUBJECT TO THE PURGE DUTY
 * (ADR-0036): a committed expectation is a cache that never expires, so purging
 * TMDB is two acts rather than one, and the second is a hand edit against this
 * file. Since CNCORE-361 they are asserted against what a real browse answers
 * rather than written into the catalogue, so they are expectations only.
 */
const TMDB_SEASON_2 = {
  id: "season:57243:2",
  newEarth: 1,
  fearHer: 11,
  doomsday: 13,
};

/**
 * AND WHERE TMDB FILES THE TWO STORIES THE WIKI PUTS AT THE FRONT OF SERIES 2.
 * `tv/57243` season 0, read the same day and again on 2026-09-26, and cached
 * under the same duty.
 *
 * THIS IS WHY FIFTEEN IS NOT THIRTEEN. The wiki folds the Children in Need
 * mini-episode and the Christmas special into the series; TMDB files both under
 * Specials. Those two members are the whole of the offset every row above
 * asserts, and they are here as members of a THIRD container rather than as an
 * explanation in a comment.
 *
 * *BORN AGAIN* IS TMDB's `Children in Need: Born Again`, a title the wiki does
 * not give it. So the matcher scores it between the bars and OFFERS it rather
 * than applying it (ADR-0027): the wiki's Item and TMDB's stay two until the
 * Owner decides, which is CNCORE-363's.
 */
const TMDB_SPECIALS = {
  id: "season:57243:0",
  bornAgainTitle: "Children in Need: Born Again",
  christmasInvasion: 2,
};

let client: AppRouterClient;
/** The wiki's `Series 2`, as the import wrote it. */
let wikiSeries2: string;
/** TMDB's `Series 2`, which is a DIFFERENT container and is never matched to it. */
let tmdbSeason2: string;
/** TMDB's `Specials`, where it files two of the wiki's `Series 2` members. */
let tmdbSpecials: string;
/** The wiki's `Series 1`, which TMDB agrees with one to one. */
let wikiSeries1: string;
/** TMDB's `Series 1`, holding the same stories in the same order. */
let tmdbSeason1: string;
let rose: string;
/** Every member of the wiki's `Series 2`, by the title the import gave it. */
let series2Items: Map<string, string>;

beforeAll(async () => {
  // LOGGED IN, because a browse WRITES and writing is the owner's since
  // CNCORE-109. The cookie is the one the login page hands a browser.
  const cookie = await logInAt(inject("baseUrl"), inject("ownerPassword"));
  client = clientAt(inject("baseUrl"), cookie);

  // THE WIKI'S HALF, IMPORTED FOR REAL, through the app and then over HTTP to
  // the provider. Nothing here writes a wiki position.
  const browsed = await client.provider.browse({
    baseUrl: inject("providerWikiUrl"),
    containerId: SERIES_2,
  });
  wikiSeries2 = browsed.containerId!;
  series2Items = await itemsByTitle(browsed.placements);

  const series1 = await client.provider.browse({
    baseUrl: inject("providerWikiUrl"),
    containerId: SERIES_1,
  });
  wikiSeries1 = series1.containerId!;
  const roseId = (await itemsByTitle(series1.placements)).get("Rose (TV story)");
  if (roseId === undefined) throw new Error("the browse of Series 1 placed no Rose");
  rose = roseId;

  /*
   * AND TMDB'S HALF, BROWSED FOR REAL SINCE CNCORE-361.
   *
   * These lines used to write TMDB's claims by hand onto the Items the wiki
   * import had made, because deciding that TMDB's record and the wiki's describe
   * one story is MATCHING and nothing did it -- a real browse minted TMDB's own
   * `New Earth` and left one Item in one ordering. ADR-0026 said at its own site
   * that the hand step was the shape of a test written in front of an operation
   * that did not exist. The operation exists now: each browse below scores every
   * episode against the Items the wiki already holds, and one scoring above the
   * high bar lands on the wiki's Item rather than on a second.
   *
   * WIKI FIRST, THEN TMDB, which is the order the Owner's own instance meets
   * them in: 8,052 wiki Items already there, and TMDB's spine arriving after.
   */
  const tmdb = inject("providerTmdbUrl");
  tmdbSeason1 = (await client.provider.browse({ baseUrl: tmdb, containerId: TMDB_SEASON_1.id }))
    .containerId!;
  tmdbSeason2 = (await client.provider.browse({ baseUrl: tmdb, containerId: TMDB_SEASON_2.id }))
    .containerId!;
  tmdbSpecials = (await client.provider.browse({ baseUrl: tmdb, containerId: TMDB_SPECIALS.id }))
    .containerId!;
});

describe("two sources that agree", () => {
  /*
   * THE CONTROL, and the row that makes every assertion below mean something.
   *
   * ONE ITEM, BOTH SOURCES' IDS ON IT, FIRST IN EACH ORDERING. The two are
   * falsifiable separately through the read path: `positionIn` refuses anything
   * but exactly one placement in a container, so a Rose that TMDB's browse had
   * minted as a second Item fails there, having no placement in the wiki's
   * series at all. And TMDB is owed a notice on this page for exactly one
   * reason -- a TMDB claim sits on this Item.
   */
  it("puts Rose first in the wiki's Series 1 and in TMDB's, on one Item", async () => {
    const item = await client.item.get({ id: rose });

    expect(positionIn(item, wikiSeries1)).toBe(WIKI_SERIES_1.rose);
    expect(positionIn(item, tmdbSeason1)).toBe(TMDB_SEASON_1.rose);
    expect(
      externalIdsOf(item)
        .map(({ sourceLabel }) => sourceLabel)
        .toSorted(),
    ).toStrictEqual(["provider-tmdb", "provider-wiki"]);

    // AND TMDB IS OWED A NOTICE HERE (ADR-0036 reads the obligation off the
    // claims themselves).
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
  it("files The Christmas Invasion in Series 2 on the wiki and in Specials on TMDB", async () => {
    const item = await client.item.get({ id: story("The Christmas Invasion (TV story)") });

    expect(positionIn(item, wikiSeries2)).toBe(WIKI_SERIES_2.christmasInvasion);
    expect(positionIn(item, tmdbSpecials)).toBe(TMDB_SPECIALS.christmasInvasion);
    // AND NOWHERE IN TMDB'S SEASON 2, which is the membership difference itself
    // rather than a consequence of it: fifteen against thirteen is this story
    // and Born Again, and without this line the offset above could be a
    // renumbering.
    expect(
      item.placements.rows.filter((placement) => placement.containerId === tmdbSeason2),
    ).toStrictEqual([]);
  });

  /*
   * THE OTHER HALF OF THE OFFSET, AND THE BAND BETWEEN THE BARS. TMDB titles
   * this story `Children in Need: Born Again`, so the wiki's title is what
   * follows TMDB's colon rather than the same title, and the matcher offers the
   * pair instead of applying it (ADR-0027). It was written by hand onto the
   * wiki's Item before CNCORE-361; what a real browse does is leave it offered.
   */
  it("offers TMDB's Born Again to the wiki's rather than applying it", async () => {
    const item = await client.item.get({ id: story("Born Again (TV story)") });

    expect(positionIn(item, wikiSeries2)).toBe(WIKI_SERIES_2.bornAgain);
    expect(
      item.placements.rows.filter((placement) => placement.containerId === tmdbSpecials),
    ).toStrictEqual([]);
    expect(item.matchCandidates.map(({ title, signals }) => ({ title, signals }))).toStrictEqual([
      {
        title: TMDB_SPECIALS.bornAgainTitle,
        signals: { title: "subtitle", released: "same", instalments: "agree" },
      },
    ]);
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
    expect(item.placements.rows.map((placement) => placement.containerId).toSorted()).toStrictEqual(
      [wikiSeries2, tmdbSeason2].toSorted(),
    );
    // And the two rows are two rows rather than one read twice.
    expect(new Set(item.placements.rows.map((placement) => placement.id)).size).toBe(2);
  });

  /*
   * AND THE TWO CONTAINERS ARE TWO CONTAINERS.
   *
   * Matching them would turn this into ADR-0017's POSITION DISAGREEMENT -- two
   * placement rows in ONE ordering, resolved by rank -- which is a different
   * mechanism that would leave multi-placement untested while every assertion
   * in this file still passed. ADR-0026's matching, built under CNCORE-361,
   * joins WORKS and never Containers, and this is what holds it to that.
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
