import type { cmppBrowse } from "@canoncore/providers";
import type { z } from "zod";

import { LISTED_TIMELINES } from "./wiki-timelines";

/**
 * What `provider-wiki` answers, written out so a machine that cannot pull a
 * private image still runs this suite.
 *
 * THE STUB AND THE REAL IMAGE MUST ANSWER THE SAME THING, which is why the ids,
 * titles, positions and dates below are ADR-0057's committed extract as the
 * provider actually serves it rather than something plausible.
 *
 * THIS FILE IS USED IN BOTH CI RUNS, WHICH IS A CORRECTION (CNCORE-143). It
 * used to say `PROVIDER_WIKI_URL` points at the real image in CI's provider job
 * and none of this is used there -- but turbo filtered that variable out of
 * `test:e2e`, so both runs were this stub, and the divergence warned about
 * below had already happened: BOTH runs were a check of the harness against
 * itself. The wiki image is no longer in that job at all, because it needs a
 * Credential no CI job can hold (ADR-0122); `provider-tmdb` is the real image
 * the suite is now pointed at, and `provider-wiki` is held to the contract by
 * the `contract` job instead.
 *
 * SO THE OBLIGATION ABOVE IS UNCHANGED AND IS NOW THE ONLY THING CARRYING IT.
 * Nothing in this repository compares these records against the running
 * provider any more, so they are owed to it by hand: generated FROM the image
 * rather than typed, exactly as ADR-0103's CNCORE-9 section requires.
 *
 * IT IS ITS OWN MODULE because it is DATA. `global-setup.ts` is the arrangement
 * -- build a database, build Next, start it, import -- and dozens of records of
 * Doctor Who in the middle of that bury the arrangement in the fixture. The 465
 * timelines the provider lists are a module of their own, `wiki-timelines.ts`.
 */

/**
 * A browse AS A PROVIDER SENDS IT, before the app's reading fills in a default
 * -- the input to `cmppBrowse` and not its output. `provider-wiki` sends no
 * `series_id` key at all, and the output type requires one since CNCORE-187
 * stopped stripping it, so a stub typed by the output would have to send a key
 * the image does not.
 */
type Browsed = z.input<typeof cmppBrowse>;

/** ADR-0057's page 265, exactly as `provider-wiki` answers it. */
export const TENTH_PLANET = {
  id: "265",
  title: "The Tenth Planet (TV story)",
  kind: "TV story",
  released: ["1966-10-08"],
  writers: ["Gerry Davis", "Kit Pedler"],
  series: "Doctor Who television stories",
  url: "https://tardis.wiki/wiki/The_Tenth_Planet_(TV_story)",
};

/**
 * Where a page is on the live wiki, spelled as `provider-wiki` spells it.
 *
 * `encodeURIComponent`, NEVER a bare `replaceAll(" ", "_")`. The title is one
 * path segment, so `Love & Monsters` has to become `Love_%26_Monsters` -- and
 * the real provider's `wikiUrl` does exactly this, then puts `:` and `/` back
 * because MediaWiki keeps those readable in titles. Written out rather than
 * imported: `provider-wiki` is another repository and this is a stand-in for
 * what it serves, which is the one thing this file exists to match.
 */
const wikiUrl = (title: string) =>
  `https://tardis.wiki/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))
    .replaceAll("%3A", ":")
    .replaceAll("%2F", "/")}`;

/** A member of one of the containers below, as the wiki provider answers it. */
const story = (id: string, title: string, released: string[]) => ({
  id,
  title,
  kind: title.includes("(audio story)") ? "audio story" : "TV story",
  released,
  writers: [],
  series: null,
  url: wikiUrl(title),
});

/** A category, as the wiki provider answers it. A container is a record too. */
const category = (id: string, title: string) => ({
  id,
  title,
  kind: "category",
  released: [],
  writers: [],
  series: null,
  url: wikiUrl(title),
});

/**
 * A timeline, as `/containers` and `browse` both answer it: the one kind of
 * container `provider-wiki` LISTS (ADR-0033 under CNCORE-186). Every field but
 * the two it takes is the same for all 465, measured rather than assumed --
 * `wiki-timelines.ts` says how.
 */
const timeline = (id: string, title: string) => ({
  id,
  title,
  kind: "timeline",
  released: [],
  writers: [],
  series: null,
  url: wikiUrl(title),
  images: [],
});

/**
 * WHAT `GET /containers` ANSWERS: all 465 timelines, in the provider's order.
 *
 * ALL OF THEM AND NOT A SAMPLE, because a sample is the one thing that cannot
 * show the list being WALKED: a page is 100, and a list shorter than one page
 * never offers a `Next`.
 *
 * ONLY THE FIRST IS SERVED WHOLE BY `browse`, which is where this stub parts
 * from the image and is said so rather than hidden. The image browses every id
 * it lists; this stub browses `WAR_CHILD_MASTER` and answers `404` for the other
 * 464, because nothing captured what they hold. A test following any other row
 * is asking the stub a question it was never given the answer to.
 */
export const TIMELINES = LISTED_TIMELINES.map(([id, title]) => timeline(id, title));

/**
 * A comic story, as `provider-wiki` answers one inside a browse -- minus its
 * `images`, which the app's own reading of CMPP strips.
 */
const comic = (id: string, title: string, released: string, writers: string[]) => ({
  id,
  title,
  kind: "comic story",
  released: [released],
  writers,
  series: "Doctor Who: The Eleventh Doctor",
  url: wikiUrl(title),
});

/**
 * `Theory:Timeline - "War Child" Master` (286338), the first container the wiki
 * lists and the one this suite imports FROM THE LIST (CNCORE-187). Browsed from
 * the published image on 2026-09-19.
 *
 * FIVE MEMBERS, SO IMPORTING IT FROM THE LIST ADDS LITTLE to the instance every
 * other file reads, and nothing else imports it, so the transition is real.
 *
 * AND ITS ORDER IS NOT RELEASE ORDER, which is what a timeline is for: *Outrun*
 * is first and came out after *The Then and the Now*, second. A category's
 * positions are computed from release dates; these are the wiki's own claim.
 */
export const WAR_CHILD_MASTER: Browsed = {
  container: timeline("286338", 'Theory:Timeline - "War Child" Master'),
  ordering: [
    {
      position: 1,
      record: comic("187555", "Outrun (comic story)", "2015-12-23", ["Rob Williams"]),
    },
    {
      position: 2,
      record: comic("181342", "The Then and the Now (comic story)", "2015-10-07", [
        "Rob Williams",
        "Si Spurrier",
      ]),
    },
    {
      position: 3,
      record: comic("196544", "The Organ Grinder (comic story)", "2016-07-27", ["Si Spurrier"]),
    },
    {
      position: 4,
      record: comic("197687", "Kill God (comic story)", "2016-08-31", ["Rob Williams"]),
    },
    {
      position: 5,
      record: comic("198649", "Fast Asleep (comic story)", "2016-09-28", ["Rob Williams"]),
    },
  ],
  unplaced: [],
};

/** A page carrying `Infobox Event or Conflict`, as a browse of that infobox answers it. */
const conflict = (id: string, title: string) => ({
  id,
  title,
  kind: "Event or Conflict",
  released: [],
  writers: [],
  series: null,
  item_kind: "time_span" as const,
  url: wikiUrl(title),
});

/**
 * `Template:Infobox Event or Conflict` (8103), the entity infobox a Time span
 * import browses through (CNCORE-367).
 *
 * FOUR OF ITS 555 PAGES, AND THAT IS A SAMPLE, said so rather than hidden. The
 * guard this serves is about the infobox, which is stored as nothing whatever it
 * reaches, and 555 Time spans on the instance every other file reads would move
 * their counts for no gain. The ids and titles are the provider's own, read off
 * the Owner's install that `provider-wiki` imported them into on 2026-09-26;
 * none of them carries a release date there.
 *
 * THE INFOBOX SAYS IT HOLDS NOTHING, which is what this suite browses it for
 * (CNCORE-432): it is how the pages are reached, not an ordering anybody wrote,
 * so the app stores no Container for it and a reader never meets a `Template:`
 * title as a place a Time span appears.
 */
export const EVENTS_OR_CONFLICTS: Browsed = {
  container: {
    id: "8103",
    title: "Template:Infobox Event or Conflict",
    kind: "infobox",
    released: [],
    writers: [],
    series: null,
    is_container: false,
    url: wikiUrl("Template:Infobox Event or Conflict"),
  },
  ordering: [],
  unplaced: [
    conflict("5169", "Battle of Canary Wharf"),
    conflict("7293", "Last Great Time War"),
    conflict("11020", "Dalek-Movellan War"),
    conflict("147984", "Siege of Trenzalore"),
  ],
};

/**
 * The fixture containers this suite browses.
 *
 * 91997 carries the missing-episode roster, which ADR-0057 reduced to two rows
 * when the fixture era moved to new Who. 388305 carries the two shapes an
 * ordering has to survive: two stories sharing a position, and a member the
 * ordering cannot place at all.
 *
 * 47651 IS CNCORE-9's, AND IT IS HERE WHOLE. A position in a wiki category is
 * COMPUTED -- the provider numbers densely over release order -- so a sampled
 * container reports positions the archive never gave. *New Earth* is third only
 * because *Born Again* and *The Christmas Invasion* sit ahead of it, and that
 * offset against TMDB is the whole of what the multi-placement test reads this
 * for. Fifteen members, or the disagreement disappears.
 */
export const CONTAINERS: Record<string, Browsed> = {
  "91997": {
    container: category("91997", "Category:Stories with missing episodes"),
    ordering: [
      { position: 1, record: story("257", "The Daleks' Master Plan (TV story)", ["1965-11-13"]) },
      { position: 2, record: story("265", "The Tenth Planet (TV story)", ["1966-10-08"]) },
    ],
    unplaced: [],
  },
  "388305": {
    container: category("388305", "Category:Vashta Nerada audio stories"),
    ordering: [
      {
        position: 1,
        record: story("222467", "Night of the Vashta Nerada (audio story)", ["2017-07-27"]),
      },
      {
        position: 1,
        record: story("222478", "Day of the Vashta Nerada (audio story)", ["2017-07-27"]),
      },
      { position: 2, record: story("324096", "Red Darkness (audio story)", ["2023-02-08"]) },
    ],
    // Operation Dusk carries no release date, and the archive's ordering for a
    // category IS release order -- so this ordering cannot place it.
    unplaced: [story("355593", "Operation Dusk (audio story)", [])],
  },
  /*
   * 47650 IS THE CONTROL'S CONTAINER, and it is here whole for the same reason
   * as 47651 and one more. ADR-0057's claim about it is that the wiki and TMDB
   * agree one to one on ALL THIRTEEN, which a container carrying a sample
   * cannot say -- and a sample would also renumber *Rose*'s neighbours while
   * leaving *Rose* itself at one, so the sampling would be invisible.
   */
  "47650": {
    container: category("47650", "Category:Series 1 (Doctor Who) stories"),
    ordering: [
      { position: 1, record: story("195", "Rose (TV story)", ["2005-03-26"]) },
      { position: 2, record: story("204", "The End of the World (TV story)", ["2005-04-02"]) },
      { position: 3, record: story("530", "The Unquiet Dead (TV story)", ["2005-04-09"]) },
      { position: 4, record: story("531", "Aliens of London (TV story)", ["2005-04-16"]) },
      { position: 5, record: story("532", "World War Three (TV story)", ["2005-04-23"]) },
      { position: 6, record: story("533", "Dalek (TV story)", ["2005-04-30"]) },
      { position: 7, record: story("534", "The Long Game (TV story)", ["2005-05-07"]) },
      { position: 8, record: story("352", "Father's Day (TV story)", ["2005-05-14"]) },
      { position: 9, record: story("390", "The Empty Child (TV story)", ["2005-05-21"]) },
      { position: 10, record: story("536", "The Doctor Dances (TV story)", ["2005-05-28"]) },
      { position: 11, record: story("537", "Boom Town (TV story)", ["2005-06-04"]) },
      { position: 12, record: story("538", "Bad Wolf (TV story)", ["2005-06-11"]) },
      { position: 13, record: story("539", "The Parting of the Ways (TV story)", ["2005-06-18"]) },
    ],
    unplaced: [],
  },
  "47651": {
    container: category("47651", "Category:Series 2 (Doctor Who) stories"),
    ordering: [
      { position: 1, record: story("1672", "Born Again (TV story)", ["2005-11-18"]) },
      { position: 2, record: story("1573", "The Christmas Invasion (TV story)", ["2005-12-25"]) },
      { position: 3, record: story("1585", "New Earth (TV story)", ["2006-04-15"]) },
      { position: 4, record: story("1586", "Tooth and Claw (TV story)", ["2006-04-22"]) },
      { position: 5, record: story("1587", "School Reunion (TV story)", ["2006-04-29"]) },
      {
        position: 6,
        record: story("1588", "The Girl in the Fireplace (TV story)", ["2006-05-06"]),
      },
      { position: 7, record: story("3311", "Rise of the Cybermen (TV story)", ["2006-05-13"]) },
      { position: 8, record: story("3312", "The Age of Steel (TV story)", ["2006-05-20"]) },
      { position: 9, record: story("1825", "The Idiot's Lantern (TV story)", ["2006-05-27"]) },
      { position: 10, record: story("4137", "The Impossible Planet (TV story)", ["2006-06-03"]) },
      { position: 11, record: story("1590", "The Satan Pit (TV story)", ["2006-06-10"]) },
      { position: 12, record: story("3391", "Love & Monsters (TV story)", ["2006-06-17"]) },
      { position: 13, record: story("4303", "Fear Her (TV story)", ["2006-06-24"]) },
      { position: 14, record: story("1627", "Army of Ghosts (TV story)", ["2006-07-01"]) },
      { position: 15, record: story("1826", "Doomsday (TV story)", ["2006-07-08"]) },
    ],
    unplaced: [],
  },
  "286338": WAR_CHILD_MASTER,
  "8103": EVENTS_OR_CONFLICTS,
};

export const WIKI_MANIFEST = {
  name: "provider-wiki",
  versions: [1],
  // `browse` is declared as well as answered (ADR-0033), which is what CNCORE-17
  // added to the real image. The app reads this list to decide whether to call
  // at all, so a stub that stayed silent about it would refuse a browse here
  // while CI's real image allowed one -- the two runs disagreeing about the
  // contract they exist to hold each other to.
  //
  // AND `containers` SINCE CNCORE-186, which the published image declares: read
  // off its manifest on 2026-09-19 as `["search","lookup","browse","containers"]`.
  operations: ["search", "lookup", "browse", "containers"],
  max_cache_age: 2592000,
  images: { stored_variant: null, per_role_limit: 0, quality_floor: 0 },
};
