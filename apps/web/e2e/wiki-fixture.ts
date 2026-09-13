import type { CmppBrowse } from "@canoncore/providers";

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
 * -- build a database, build Next, start it, import -- and twenty-eight records
 * of Doctor Who in the middle of that buries the arrangement in the fixture.
 */

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
export const CONTAINERS: Record<string, CmppBrowse> = {
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
};

export const WIKI_MANIFEST = {
  name: "provider-wiki",
  versions: [1],
  // `browse` is declared as well as answered (ADR-0033), which is what CNCORE-17
  // added to the real image. The app reads this list to decide whether to call
  // at all, so a stub that stayed silent about it would refuse a browse here
  // while CI's real image allowed one -- the two runs disagreeing about the
  // contract they exist to hold each other to.
  operations: ["search", "lookup", "browse"],
  max_cache_age: 2592000,
  images: { stored_variant: null, per_role_limit: 0, quality_floor: 0 },
};
