# Grill decisions: the rethink (2026-09-28)

**GRILL DONE (2026-09-28).** The frontier is empty, and the Owner confirmed shared understanding ("Yes, the grill is done"). Next is process step 4: draft the founding ADRs and CONTEXT.md, then `/handoff`, then clear.

The consolidated record of the 2026-09-28 grill. The Owner answered every question in the dispatch session.

- **Each decision appears once, in its final form, grouped by topic.** Amendments are merged into the sentence they amend. Superseded text is gone from here and stays in `grill-decisions-log.md`, the raw log in the order decided.
- **Ids:** each decision has a stable id `D-<n>`, numbered through this file. "was n" gives its number (or numbers) in the raw log. The log has no raw-log decision 102.
- **Words** follow `CONTEXT.md`. Where a decision names a Provider (TMDB, Tardis Fandom), it names one a user may install, never a default (D-5). "Series" appears only in Book series and Comic series (hierarchy levels) and where it names another product's own field.
- **"(precedent: none stated)"** marks a choice for which the grill cited no competitor or precedent. None has been invented.
- **Detail owned by a named spec** (the "DIP" items) is listed in `gaps-reconciled.md` and not repeated here.

## 1. Principles

D-1 (was the Ethos). **The ethos governs every decision in the rebuild.** The Owner: "Whatever the most impressive but best option it is for the users - this should be the ethos of the entire rebuild."
- The best option for the people using it comes first. Within that, choose what is most impressive to a software developer in September 2026.
- Every question is still put to the Owner (their correction). The ethos picks the (Recommended) option. The server shape (D-78) was proposed under the ethos and confirmed by the Owner ("yes").

D-2 (was the Criteria). **The Owner's criteria, in order:**
1. The best user access on Mac, iPhone and Apple TV (and now the web).
2. Most impressive to a software developer in September 2026.
3. Playback soon.

D-3 (was the everything-agnostic principle). **The product is EVERYTHING-agnostic.** The Owner: "CanonCore is not just host-agnostic but everything-agnostic, e.g. I love Doctor Who but many others won't."
- **Franchise-agnostic:** nothing in the core schema, the UI or the defaults names Doctor Who. Franchise pages, "As broadcast" / "As a timeline" and "Also in" work for any franchise: the MCU, Star Wars, Star Trek, the Arrowverse, a Book series. Doctor Who is the hardest TEST CASE, never the target. Its Providers (Tardis Fandom, TARDIS Guide, Big Finish) are the Owner's own installs, working through the same Store mechanism as anyone's.
- **Host-agnostic:** "We can't just focus on my use case." CanonCore is for anyone who self-hosts, on a NAS with a GPU, a Mac mini, a Linux box in Docker, a VPS or a seedbox. **Whatbox is ONE deployment, the Owner's, and he may move** (a cheaper or better host is being researched).
- **A host's limits become the product's SETTINGS or CAPABILITY CHECKS, never its rules.**
- **At product level:**
  - the server runs as a single process with SQLite;
  - it installs as a Node bundle or a Docker image (D-79);
  - it runs under whatever supervisor the host has (systemd, launchd, Docker restart, or cron on a seedbox);
  - transcoding is a capability the install turns on when its host allows it. It is off on Whatbox (D-55).
- The Owner's own deployment is D-78.

D-4 (was 37, 35, 36). **Schema first: the Library is CanonCore's own schema, built by the user from Providers, and media files are only matched to it.**
- **Providers PROPOSE through CMPP, into the strict schema:** a show, a film, a franchise and its members, a timeline. The user reviews each Proposal and IMPORTS what they choose, for example ticking Torchwood and unticking Doctor Who Confidential in the franchise Wikidata proposes. The precedent is MusicBrainz Picard: look up, compare, accept.
- **A media file NEVER creates an Item or seeds the Library.** It is MATCHED to an existing Item: Rose.mkv attaches to the Rose Item already imported. The Owner: "it should be focused on CanonCore schema, don't suggest via files".
- **The Library is what the user has imported, owned or not** (the Owner chose this over "owned first, unowned greyed"), so CanonCore is a reference as much as a player. Owned and playable Items are marked, and a filter like "Only what I can play" narrows any view.
- **Live Provider search** is how new things are found and proposed.
- **Never mirror whole Providers.** That is the old "way too much" problem.

D-5 (was 56). **No default Provider.** The Owner: "No CMPP provider should be default, as users can install whatever."
- **Every Provider is installed by the user from the Store,** TMDB included. A fresh install has none, apart from the always-on Local metadata Provider (D-43).
- **What the Store offers per medium (D-36 to D-41) is coverage, not a product preference.** Any "primary", "secondary" or "opt-in" there describes coverage.
- **The hierarchy's numbering follows the Provider the user imported that show from.** Another Provider's numbering (TheTVDB's DVD order, air order with specials) is importable as an Ordering.
- **Per-field priority is the user's to set (D-50).** The product ships no global ranking.
- (precedent: none stated)

## 2. Product and clients

D-6 (was 1). **The core: a great Library first, with Orderings (multi-placement) as the standout.**
- It works like Plex by default: films, shows, seasons, episodes, playing.
- The distinctive feature is choosing a watch order and playing through it: an official story order, an in-universe Timeline, the Owner's own.
- The alternative, making Orderings the whole point, was rejected.

D-7 (was 12, 12a). **Everything playable: every medium plays on every client.**
- Video (TV, films), audio (Big Finish, audiobooks), novels (an EPUB reader) and comics (a CBZ/CBR reader): Plex, Audiobookshelf and Komga in one.
- Video, audio, EPUB and CBZ play on the web, iOS, macOS and tvOS. That is the meaning, not "every codec" (codecs are D-55).
- Every timeline entry can open when its file is in the Library. "Only what I can play" still hides the rest.
- The roadmap phases it: video first ("playback soon"), then audio, then the readers (D-88).

D-8 (was 2). **The Apple app: one SwiftUI multiplatform app for Apple TV, iPhone and Mac, with no Jellyfin-compatible adapter.** It plays through AVPlayer, with an on-device software player for anything else (D-55).
- **Why no Jellyfin-compatible adapter (the Owner, 2026-09-28):** "Jellyfin is a competitor." CanonCore is its own product, so it does not imitate a competitor's API. Doing so would bind CanonCore's shape to theirs and hand the experience to their apps.
- (precedent: none stated)

D-9 (was 4). **The web: a full web client from the start, including playback** (hls.js outside Safari; D-14). What it cannot decode is covered by D-55.
- (precedent: none stated)

D-10 (was 5). **Every client does everything** (the Owner: "all need all").
- The web, Apple TV, iPhone and Mac each browse, play and curate.
- One API serves all of them. Its contract is typed and checked in CI: OpenAPI to a generated Swift client, and TypeScript types for the web.
- Curation on Apple TV needs a design made for a remote.
- (precedent: none stated)

D-11 (was 6). **Apple Developer Program: the Owner is ALREADY a member.** TestFlight (each build lasts 90 days; invited people are external testers, which needs Beta App Review), signing and notarisation are available now, at no new spend.

## 3. Stack (evidence in `stack-research.md`)

D-12 (was 24). **Server: Node 24 with Hono 4 on @hono/node-server.**
- Routes are declared with **Zod 4** schemas through **@hono/zod-openapi**, and the OpenAPI 3.1 spec is generated from them (code-first, like Jellyfin, Immich, Kavita and Komga).
- The spec feeds **swift-openapi-generator** (1.13.1) for the Apple app and the web's types.
- Fastify was the runner-up.

D-13 (was 25). **Database: SQLite through Kysely** (0.29, with its Migrator) on **better-sqlite3 13**, which ships prebuilt binaries.
- Move to `node:sqlite` once it is Stable.
- Drizzle was passed over because it is still 0.x (1.0 is RC).
- (precedent: none stated)

D-14 (was 27). **Web: React 19 + Vite + TanStack Router** as a single-page app served by the same Node process.
- **hls.js 1.7** plays the streams, with the **Media Chrome 4** player UI.
- Next.js was passed over (static export cannot serve runtime routes). TanStack Start is RC, and the SvelteKit SPA carries a performance warning.
- (precedent: none stated)

## 4. Schema

D-15 (was 32). **Structure: a fixed hierarchy per medium, with Orderings on top** (the Owner agreed after the prototype on branch `prototype/schema-structure`, to which project 1's seed issue points).
- **Hierarchies:** Show → Season → Episode (with a Story level where chosen, D-17); Artist → Album → Track; Book series → Book; Comic series → Issue; Film, optionally in a Collection.
- **The hierarchy is "As broadcast",** so an ordinary show (Friends) looks exactly like Plex, with seasons, "S2E3", next episode and Continue Watching.
- **Orderings are a separate layer** (Ordering + Placement), holding Timelines, lists and TheTVDB alternate orders, across media. They appear on franchise pages as "As a timeline", and on every Item as "Also in" beside its fixed HOME.
- **Every fact carries its Source,** through a Statement table.
- **Rejected:** "everything is an ordering" (the old Containers), which makes ordinary shows generic and takes away the Timelines' special status.

D-16 (was 31, 31a). **Item → Edition → Version, Plex's split.**
- **An Edition is a different cut.** It carries its own runtime and watch state: broadcast against remastered, extended, or the director's cut.
- **A Version is a copy of one Edition:** 1080p, 4K or NTSC. It is backed by a media file or by a time span of one (D-60).
- **Every Item has a default Edition,** so ordinary shows look unchanged.
- **Orderings place the ITEM,** so "Also in" covers whichever cut is watched.
- **Precedent:** Plex says "Versions all represent the same release… Editions represent different releases", and each edition keeps its own watched state. Jellyfin and Kodi have only versions. Evidence: `competitor-data-models.md`.
- **The Owner's files already carry the labels:** `{edition-Blu-Ray}`, "Remastered Version", "NTSC Blu-Ray Version".

D-17 (was 83, 43). **A show's structure is chosen at import, per show, from what its Provider offers.**
- **The options** are the default numbering, or one of the Provider's groupings: TMDB episode groups such as "Story Order", or TheTVDB's alternate orders.
- **Choosing a story grouping gives the show a Story level: Show › Season › Story › Part.** The Story is the Item, and its Parts are episodes beneath it. Episodes that are not multi-part (modern episodes) stay one level. Every other grouping stays available as an Ordering.
- **Shows without groupings** (Friends) just use the default.
- **Timelines place the Story. Per-Part watch state is kept.** A file covering several Parts follows D-60.
- **The Doctor Who case:** TMDB's "Story Order" episode group (type 5, id 6211072396670e006ba4e521). Measured 2026-09-28: 156 story groups, 713 episodes, with The Trial of a Time Lord as one 14-episode group and Shada as group 108.5. The old "154 of 159" is replaced. The project 2 spec counts Stories against a named story list.
- **Unmeasured:** how modern two-parters (Aliens of London / World War Three) are grouped. Measure in the project 2 spec.
- **This reconciles the hierarchy, the Story level, Ordering sources and "no default Provider",** with nothing Doctor Who-specific in the core. The episode counts shown in the example were illustrative.
- **Precedent:** TMDB episode groups and TheTVDB alternate orders.

D-18 (was 44). **Extras are Items owned by a parent,** following Jellyfin's `OwnerId` + `ExtraType`.
- **Types:** trailer, featurette, interview, behind the scenes, deleted scene, commentary, short, sample, clip, other.
- **Owners:** an episode, Story, season, show, film or franchise.
- **Each Extra has its own Versions, metadata and watch state.** They show in an "Extras" row and are left out of Continue Watching.
- **Files are matched using Plex and Jellyfin naming:** Plex's `-trailer -featurette -behindthescenes -deleted -interview -scene -short -other` and folders, plus Jellyfin's `-clip -deletedscene -extra -sample`.
- **An Extra can be placed in an Ordering** when it matters, such as a prequel minisode.

D-19 (was 77). **Missing and reconstructed episodes.**
- **A lost episode is an ordinary Item with no file,** marked Missing (broadcast lost), so seasons and Timelines stay complete and honest.
- **A reconstruction is an Edition of that episode (D-16),** with its own Versions and watched state, like a remaster: animated, telesnap or fan recon.
- **There is no separate coverage concept.** Old ADR-0060, 0082 and 0088 (canoncore-history) are dropped.
- The Power of the Daleks animation (2016) in the example is from memory.
- (precedent: none stated)

D-20 (was 76). **Dates carry a precision and an optional country.**
- **Precision is day, month or year,** as Wikidata stores dates. "2010" shows as 2010, never as 1 Jan 2010.
- **A film can hold several country releases.**
- **Date sorting respects precision.**
- **The Item shows the Profile's country date** when there is one, otherwise the earliest.
- **Each date is a sourced value (D-50).** The Endgame dates in the example were illustrative, not verified.

D-21 (was 67). **Every Item has a sort title.**
- **Leading articles are dropped** ("The Christmas Invasion" files under C), and punctuation is ignored.
- **Titles starting with a digit** group under "#" in the A-Z jump bar (old CNCORE-242, 446).
- **It is a sourced value,** which the user can set and Lock (D-50); for example, to keep a title under "T".
- Precedent: Plex and Jellyfin behave this way, unconfirmed (Open items).

D-22 (was 40, 89). **Franchises are imported like anything else (D-4).**
- **Providers propose a franchise and its members.** Wikidata, where installed (D-42), reads its three links (P8345 media franchise, P1434 fictional universe and P179 part of the series), and TMDB collections cover films. The Fandom and curated-list Providers can propose too.
- **Without Wikidata,** franchises are added BY HAND, or proposed by another Provider (Tardis Fandom, TMDB collections).
- **The user ticks what to import,** for example unticking the Wizarding World fan films.
- **Measured 2026-09-28,** as films / TV with TMDB ids across the three links:
  - Doctor Who: 23 / 17. Good.
  - Star Wars: 29 / 26. Good.
  - MCU: 49 / 27. Good.
  - Star Trek: 25 / 12. Good.
  - Wizarding World: 14 / 0, including fan films.
  - The Conjuring: 3 / 0, weak.
- (precedent: none stated beyond D-4's Picard)

D-23 (was 65). **Franchises can nest.**
- **Torchwood** is its own franchise page (its show, its Big Finish audios, its novels, its Timelines) AND sits inside Doctor Who.
- **The parent page** shows "Franchises within: Torchwood · The Sarah Jane Adventures · Class". Its "As broadcast" can include or hide the spin-offs.
- **Membership arrives by Proposal (D-22).**
- **Precedent:** Wikidata puts the spin-offs inside the Doctor Who franchise, and Marvel holds the MCU. This supersedes the flat, hand-made Group of old ADR-0010 and 0202 (canoncore-history), not the Group Entity kind of D-33.

D-24 (was 78). **Continuity has no concept of its own.**
- **An alternative continuity is a nested franchise (D-23) with its own Orderings.** For example, Star Wars › Legends with a Legends Timeline.
- **The word "continuity" stays reserved** (old CLAUDE.md), and is not built.
- (precedent: none stated)

## 5. Orderings

D-25 (was 11). **The Library model** (the Owner: "okay yeah i love", after the real-data prototype on branch `prototype/library-model`, to which project 2's seed issue points).
- **ONE combined Library, not Provider modes.** Each story is one thing holding facts from every Provider, each labelled with its Source (provenance shown).
- **A franchise page (Doctor Who) offers two ways to watch:**
  - **As broadcast:** every show from the importing Provider together (Doctor Who 1963-89 grouped into Stories, 2005-22 with specials, 2023-), season by season.
  - **As a timeline:** you PICK a Timeline (a Doctor or companion, from Tardis Fandom), then walk it era by era. Non-TV entries (audio, novels, comics) sit between episodes, greyed out when there is nothing to play, with an "Only what I can play" filter.
- **Every story shows "Also in":** each Ordering it sits in, with its Position (e.g. The Beast Below: Series 5 E2, #4 of 603 in the Eleventh Doctor's Timeline, #7 of 311 in Amy's), each linking into that Ordering.
- **Rejected:** Provider modes (variant A) and timeline-first (variant C).
- **Measured in the prototype:** 8 real Timelines matched to TMDB at 70-100% of their TV entries (lowest: the Fifteenth Doctor, 16 of 23; recomputed by the audit, 2026-09-28) (First Doctor 37 of 40 using TMDB's "Story Order" group; River Song 20 of 20). The misses are mostly stories outside the three TMDB shows fetched (Sarah Jane Adventures crossovers, mini-episodes).
- (precedent: none stated)

D-26 (was 29, 34). **Where Orderings come from, for any franchise:** layered Providers plus shareable lists. Evidence: `ordering-sources.md`.
- **As broadcast:** TMDB collections, episode groups and v4 lists, plus TheTVDB's alternate orders (e.g. Firefly's DVD order).
- **As a timeline:**
  - Fandom wikis: ONE Provider, with a small adapter per wiki page format (the MCU wiki's table, Wookieepedia's `MediaRow`, Tardis's `Theory:Timeline`). Each wiki's licence is honoured; Memory Alpha is non-commercial.
  - MDBList community lists (free key; Kometa's source).
  - Orderings the user builds.
- **Sharing:** every Ordering imports and exports as an ordered list of provider-neutral ids, each written `provider:id` (a TMDB, TheTVDB or IMDb id, for example), after Kometa's `text` builder.
- **Ordinary shows** (Friends) just show As broadcast.
- **The Owner's Doctor Who Providers** (Tardis `Theory:Timeline`, TARDIS Guide) plug in the same way.
- **Avoided as defaults:** Trakt (a draft policy against mirroring), IMDb (scraping forbidden), Letterboxd (no API for personal projects).

D-27 (was 74). **Positions in an Ordering.**
- **Every entry has a whole-number Position.**
- **An entry can be flagged "at the same time as the previous one",** shown as a bracket. Playing straight through still plays them in sequence.
- **Entries a Provider cannot place** go in a final "Placement unknown" section, still shown and playable.
- **Reordering by hand stays a drag.** The MCU examples in the question were illustrative, not sourced placements.
- (precedent: none stated)

D-28 (was 62). **Repeats are allowed, shown as Repeats, and counted once.**
- **An Item may appear more than once in one Ordering.** The later appearance shows "Repeat of #3", so it never reads as an error or a Provider disagreement (old CNCORE-90, 121).
- **"Also in" lists each Ordering once, with all its Positions:** "Eleventh Doctor #3, #15". It counts Orderings, not Placements (old CNCORE-236).
- **Playing straight through plays it each time,** and the watch state is shared.
- **Precedent:** old ADR-0009 (canoncore-history), repeats for recaps and bookends.

D-29 (was 97). **Smart Orderings: a saved filter plus a sort that fills itself** (old CNCORE-344 story 28).
- **It updates as the Library changes, and cannot be hand-reordered.**
- **Examples:** "every Star Trek episode with the Borg, by air date"; "unwatched stories with Rose Tyler".
- **Precedent:** Plex smart collections, Navidrome smart playlists.
- **Project 2.**

D-30 (was 75). **Up Next follows the Ordering the user started from.** Playing from a Timeline "walks" it.
- **The next entry plays next.**
- **An entry the user can't play** (a novel or comic they don't own) shows as a card with Skip and Open. It is never silently jumped. An owned EPUB or CBZ opens in the reader (D-7).
- **Continue Watching remembers the Ordering being walked,** e.g. "Amy Pond's timeline · #9".
- **Starting from a show's page walks the show as normal.**
- This is the core of D-6.
- (precedent: none stated)

D-31 (was 61, 88). **Importing an Ordering is ONE Proposal, ticked by medium, and its entries become Items.**
- **The Proposal shows what it would add, grouped by medium** (TV, novels, comics, audio…) with checkboxes. The user accepts once.
- **Ticked entries with no matching Item become Library Items of the right kind:** novel, comic, audio, episode, home video.
  - Each carries what the Provider says (title, medium, source link), marked "from <provider> only".
  - Each gets a page, "Also in", and search.
- **Unticked entries stay in the Ordering as text entries marked "not imported",** and can be imported later.
- **Rejections are remembered (D-52).**
- **A later Provider Proposal enriches an Item,** with no duplicate. For example, Open Library proposes Apollo 23 by Justin Richards, the user accepts, and it gains a cover and an ISBN.
- **The same entry twice in one Timeline is one Item placed twice (D-28):** Meanwhile in the TARDIS is at #3 and #15 of the Eleventh Doctor Timeline.
- **Real data:** of the first 15 Eleventh Doctor entries, 5 match TMDB and 10 do not. The counts in the Proposal example were illustrative.
- (precedent: none stated)

## 6. Entities and Relationships

D-32 (was 41). **Character and Person are real Entities.**
- Both are Library Entities with their own pages and sourced Statements, imported by Proposal like anything else.
- **A Credit is Person × Item × role × Character,** optionally with an incarnation (the Tenth Doctor), as Wikidata's P4649 does.
- **A Timeline can belong to a Character,** such as "Rose Tyler's timeline".
- **Precedent:** Wikidata, where the Doctor Q34358 has 15 performers qualified by incarnation, Metron and TheTVDB. Plex, Jellyfin, Kodi and TMDB keep the character as a string, and TMDB splits the Doctor ("Doctor Who" against "The Doctor").

D-33 (was 73). **Entity kinds, franchise-agnostic** (the Owner: "yes" to the best-for-the-user option). Beyond Person and Character (D-32):
- **Group:** a team or organisation, such as the Avengers, Starfleet or S.H.I.E.L.D.
- **Place:** Gotham, Hogwarts, Tatooine. This ties into the filming-locations map (D-83).
- **Company:** studios, networks, publishers, such as the BBC, Marvel Studios or Big Finish.
- **Any Entity can have a page, appearances, and its own Timelines.**
- **Species or origin, concepts and objects wait** until Providers commonly supply them.
- **Precedent, UNVERIFIED:** the entity lists of Comic Vine (character, team, location, concept, object, origin, story arc) and Metron (character, team, universe, arc, creator) are from memory (Open items). TMDB's companies and networks were read earlier in the session.

D-34 (was 42, 89). **Relationships: typed, directed, sourced links between Items, from a SMALL FIXED vocabulary.**
- **The vocabulary:** adaptation of / based on, spin-off of, soundtrack of, remake of, version of, crossover with.
- **Sequel and prequel are NOT stored,** because Orderings already say what comes next.
- **With Wikidata installed, they are imported by Proposal:** P144 based on, P4969 derivative work, P2512 has spin-off, P406 soundtrack release.
- **Without it,** cross-media Relationships (the Rose novel based on the Rose episode) are added BY HAND, or proposed by another Provider (Tardis Fandom, TMDB collections).
- **They are editable,** and show as "Based on" and "Adapted as".
- **Precedent:** Wikidata, MusicBrainz and Kavita `RelationKind`. Plex and Jellyfin have none.

D-35 (was 98). **Entities link to each other with a small fixed vocabulary, plus the Provider's own wording** (old CNCORE-344 stories 14 and 15).
- **The vocabulary:**
  - family: parent, child, sibling, spouse;
  - member of (a Group);
  - located in (a Place);
  - "other", which carries the Provider's own label ("companion of", "nemesis").
- **Links are sourced and editable,** show on Entity pages, and feed Smart Orderings (D-29).
- **Project 2.**
- (precedent: none stated)

## 7. Providers, CMPP and the Store

D-36 (was 14, 56). **What the Store offers: a standard set per medium, with franchise Providers on top.**
- The Owner: "Don't think about Doctor Who specific ones. We need a standard list that the others all do, with Doctor Who ones on top."
- **Every departure from the competitors' default is recorded with its reason** (audit 2026-09-28).
- **The standard layer covers every medium:** film/TV, music/audio, books/audiobooks, comics, identity (a crosswalk) and local files.
- **The franchise layer** is Tardis Fandom (Timelines) and TARDIS Guide (curated orders; D-47).
- **HARD RULE: NO PAID PROVIDERS.** Nothing the Owner or any user must pay for. Free with strings attached (non-commercial terms, no image licence) is flagged per Provider.
- **D-37 to D-41 list what the Store offers.** Nothing in them is installed by default (D-5), and their wording describes coverage.

D-37 (was 15, 15a). **Film and TV offerings.**
- **TMDB:** Items, images, film Collections, episode groups including Story Order. The project ships its key, and a user may use their own instead. TMDB's terms apply: attribution, non-commercial use, a 6-month cache ceiling.
- **TheTVDB,** beside TMDB. It ships with the project's free key and attribution, and a user's subscriber PIN is optional, as in Jellyfin. Plex, Emby and Jellyfin all use it, and TheTVDB says it is free under $50k/yr with attribution. Its alternate episode orders become more Orderings.
- **TVmaze** is the TV cross-check (CC BY-SA, keyless), strong on UK specials.
- **Wikidata** is the id bridge and the order of films in a Collection (D-42).
- **Local files:** NFO, artwork, and `{tmdb-}` / `[tmdbid-]` hints, read by Local metadata (D-43).
- **fanart.tv** is OPT-IN, labelled "no image licence".
- **Out:** OMDb, IMDb datasets and Trakt.

D-38 (was 16). **Music and audio offerings.**
- **MusicBrainz** (primary in coverage): identity, release groups, its "series" with ordering, the "Audio drama" type.
- **Cover Art Archive** for covers.
- **Embedded audio tags** (including several series in one tag, separated by `;`) are read by Local metadata (D-43).
- **AcoustID + Chromaprint** fingerprint untagged files.
- **Wikidata** is the id bridge.
- **Discogs monthly CC0 dumps** for credits, never the live API.
- **Deezer** is the keyless artwork fallback.
- **Out:** Spotify, TheAudioDB, Last.fm images, iTunes.

D-39 (was 17). **Big Finish: CanonCore builds its OWN Provider.** The Owner: "Build our own. They've let me."
- **The Owner states Big Finish has given permission.** The grant's text is not yet on file (Open items).
- **It discovers releases from `sitemap.xml`** and reads release pages politely, with an honest User-Agent. It caches each page once and never uses the robots-disallowed `/api/`.
- **The sitemap lists 1,083 release URLs, while MusicBrainz holds 2,796 Big Finish releases,** so the sitemap's coverage is checked against the Library before sitemap-only discovery is relied on (audit 2026-09-28).
- **abs-agg's parser (AGPL) may be learned from.** abs-agg itself is not a dependency.
- **It is a private install on the Owner's server (D-44).**
- (precedent: none stated)

D-40 (was 18, 18a). **Books and audiobooks offerings.**
- **The files' own metadata, read by Local metadata (D-43):** EPUB OPF, both calibre series and EPUB 3.3 `belongs-to-collection` with `group-position`, several allowed; M4B tags and embedded chapters.
- **Open Library** for editions, ISBNs and covers (1 req/s anonymous, 3 req/s with an app name and contact in the User-Agent; the monthly dumps are used for bulk).
- **Wikidata** for Book series order (all 55 NSA novels numbered).
- **Hardcover** (secondary in coverage): the Owner's own free token, server-side only. It is in beta and "may reset tokens without notice", with limits of 60/min and 5,000/day; other users supplying theirs would need OAuth.
- **iTunes Search** for audiobook discovery only, with its artwork displayed and not stored.
- **Audiobooks:** M4B tags and chapters, then Open Library and Wikidata, then Hardcover, with iTunes Search for display-only art.
- **AudiobookDB is dropped:** its terms say "Programmatic access ... commercial integration ... require a separate licensing agreement", and "The API license does not cover cover art or book descriptions". It is in alpha.
- **Out:** Google Books as stored data, Audible and Audnexus, Goodreads, StoryGraph, ISBNdb.

D-41 (was 19, 19a). **Comics offerings.**
- **ComicInfo.xml in the files, read by Local metadata (D-43).** `StoryArc`/`StoryArcNumber` pairs arrive as a Proposal of an Ordering, which the user accepts. `StoryArcNumber` is in the v2.1 draft.
- **Comic Vine:** each user supplies their own free key, as in Mylar3 and Kapowarr. Every comics competitor (Mylar3, Kapowarr, Komf, Calibre-web, Booklore) uses Comic Vine, and none uses Metron. It is labelled with its terms: non-commercial, "no competing products", no redistribution in other formats. It covers Titan's Doctor Who.
- **Metron,** on top, for its ordered, typed, source-attributed reading lists, which feed Orderings. CC BY-SA 4.0, 20/min and 5,000/day per authenticated user; every endpoint needs auth, so each install needs its own free Metron account.
- **The GCD dump** (CC BY-SA) is optional, for depth. Its unstable API is not used.
- **CBL reading lists** can be imported, flagged as unlicensed.
- **TARDIS Guide** supplies the Doctor Who (Titan) reading order (D-47).
- **Out:** League of Comic Geeks (no API), Marvel API (dead).

D-42 (was 20, 89). **Identity, and Wikidata as an ordinary, optional Provider.**
- **Every Provider id is stored as a sourced Statement. Wikidata's QID is an optional bridge, never the primary key.**
- **With Wikidata installed,** it proposes franchises (D-22), Relationships (D-34) and cross-media ids.
  - For films, shows, books and Book and Comic series, ids resolve through Wikidata by external id, batched, with a descriptive UA and a cache.
- **At episode and issue level,** CanonCore relies on the Providers' own cross-ids (TMDB external ids; Metron `cv_id`/`gcd_id`) and on filename hints.
- **Without Wikidata,** TV and film still line up across Providers through shared ids (TMDB lists TheTVDB and IMDb ids).
- **First run says what Wikidata adds.**
- **Measured:** 903 of 905 Doctor Who episodes have an IMDb id, but only 19 a TMDB id. 511 items carry a Tardis Fandom id.
- (precedent: none stated)

D-43 (was 86, 20). **"Local metadata" is a built-in Provider, ALWAYS ON, and ranked FIRST by default.** Its Statements (NFO title, M4B chapters and narrator, ComicInfo) beat online Providers until the user reorders a field, matching Plex and Jellyfin, where local NFO overrides online data. The downside was accepted: badly tagged files also win until they are reordered or locked. The Owner settled this reading on 2026-09-28.
- **It speaks CMPP** like any Provider, reading tags, NFO, ComicInfo and EPUB metadata.
- **It READS everything and WRITES nothing:** Kodi NFO, ComicInfo.xml, EPUB OPF, embedded audio tags, CBL, local artwork names, and both filename-id syntaxes (`{tmdb-…}` and `[tmdbid-…]`). CanonCore never modifies media files. Its richer data lives in its own database, which is backed up.
- **Its facts are Statements from Source "local file",** ranked by install order (D-50); it can be ranked last.
- **Anything structural** (an Ordering from a ComicInfo story arc) is a Proposal the user accepts.
- **Files still never create Items (D-4).** Matching (D-53) reads filenames and tags only to suggest which Item a file belongs to.
- **It is the ONE exception to "no default Provider" (D-5),** because it only reads the user's own files. The Owner chose "always on" over "installed like any other".
- **Exporting Orderings** (CBL or ComicInfo arcs) may come later as an explicit action.
- (precedent: none stated)

D-44 (was 21, 21a, 82). **The Store, and how Providers run.** The Owner: "Store has every provider, with an option for users to install private ones too for their CanonCore."
- **CMPP is an HTTP protocol with a manifest URL,** and the Store lists manifest URLs: every PUBLIC Provider (TMDB, TVmaze, MusicBrainz, Metron and so on).
- **A PRIVATE Provider is installed by pasting its URL,** unlisted, and can be written in any language and hosted anywhere. Tardis Fandom and Big Finish, which rest on permission given to the Owner personally, are private installs on the Owner's server.
- **First-party Providers implement the same interface but load in-process,** so a shared host like Whatbox runs no always-on process per Provider.
- **Only trusted code runs in-process:** Node 24's permission model is Stable, but its docs say "Malicious code can bypass the permission model", so strangers' code always stays behind a URL.
- **The Owner reviews each Store listing;** a manifest carries a semver `version`; adding an unlisted URL shows a trust warning, as Jellyfin does for third-party repositories (audit 2026-09-28).
- **Project 1 ships a minimal Store (store v0):** first run lists Providers (TMDB first), with Install, a key field where needed, and "Add provider by URL". Nothing is installed until the user chooses, so D-5 holds from day one.
- **Project 4 grows it:** TheTVDB, TVmaze, updates, trust warnings and browsing.
- **Precedent, verified 2026-09-28:**
  - Plex Custom Metadata Providers (announced 2025-12-09): "enter the URL for the locally running provider".
  - Stremio addons: a manifest URL plus a central catalogue.
  - Audiobookshelf custom providers: a URL plus a token, with an OpenAPI spec.
  - Jellyfin: in-process DLLs from manifest repositories, the older model.

D-45 (was 59). **CMPP: a manifest plus declared capabilities,** like Stremio's resources.
- **The capabilities:**
  - search (text);
  - lookup (the Provider's full record by id);
  - children (seasons, episodes, Parts);
  - orderings (a Timeline or list, with sections);
  - related (franchise members, spin-off, based-on);
  - match (suggest an Item for a filename or tags);
  - artwork.
- **Each returns data in the CanonCore schema,** with a Source on every value. The manifest also names the Provider's kinds, version and terms.
- **A Provider implements only what it has:** TMDB search, lookup, children and artwork; Tardis Fandom orderings and related; Wikidata related.
- **Precedent:** Plex Custom Metadata Providers (match + metadata), Stremio (declared resources), Audiobookshelf (search).

D-46 (was 68). **Providers declare their credential and rate limit, and the server enforces them** (the Owner: "the best for the user").
- **The manifest declares** the credential (none, a user-pasted key, or a shipped project key) and the rate limit.
- **The server runs one limiter per Provider:**
  - it honours "retry later" replies;
  - it pauses and resumes long imports;
  - it records "refused" separately from "nothing found" (old CNCORE-373, 166, 254).
- **Setup shows what each Provider needs** before it is installed.
- (precedent: none stated)

D-47 (was 14, 19). **TARDIS Guide: curated orders, API access granted.** It supplies curated Doctor Who orders (sets, playlists and prerequisites, which Shaun added to the API), including the Titan comics reading order.
- **Access:** API beta access was GRANTED on 2026-09-28 for the Owner's Bronze Patron account Jacobrees (Shaun Robinson: "I've added access to the API beta!").
- **Permission:** there is no separate written "yes" to CanonCore use. It was granted after the Owner's email described CanonCore; confirming it in writing is optional (Open items).
- **When:** it arrives in project 2 (D-88).

D-48 (was 80). **Fandom images come server-side with a Referer header, and only that.**
- **The Owner's condition:** "no images from Fandom, unless there's a good way round Cloudflare", and not the old iteration's browser-session workaround.
- **Measured 2026-09-28:** `static.wikia.nocookie.net/.../Apollo_23.jpg` returns **403** without a Referer and **200 image/webp** with `Referer: https://tardis.fandom.com/`, from both Whatbox and the Mac. There are no cookies and no session to expire.
- **If the challenge returns,** the Provider marks "image unavailable" and moves on. It never falls back to a browser session.
- **Other Providers' covers** (Open Library, Comic Vine, TMDB, Big Finish) are used where installed, under the user's priority (D-50, D-5).
- (precedent: none stated)

D-49 (was 105). **CanonCore helps users compare Providers on their own Library.** This replaces the originally asked provider-choosing prototype.
- **Before install, the Store shows coverage:** "TMDB knows 212 of your 214 Items". The figures in the example were illustrative.
- **Item pages can show every Provider's Statements side by side (D-50).**
- **The Store core arrives in project 1 (D-44).** Coverage and comparison are project 4, measured on the Doctor Who corpus.
- (precedent: none stated)

## 8. Provenance

D-50 (was 33, 84). **Provider conflicts: keep every value; install order ranks them; the user's Statement locks.**
- **Every Provider's value is stored as a sourced Statement,** and nothing is discarded.
- **Before the user sets any priority, INSTALL ORDER decides:** the first-installed Provider's Statement wins, for every field.
- **Settings › Providers reorders it per field,** e.g. Tardis Fandom first for story facts. No ranking ships as a default (D-5).
- **The user's own Statement always wins and LOCKS the field,** like Jellyfin's lock.
- **The Item page can show every Provider's value side by side.**
- **Precedent:** Jellyfin and Plex use a priority order and a lock but keep only the winner. We go further, because the Source badges need every value.

D-51 (was 39). **After import, facts about imported Items refresh on their own:** overview, poster, air date and runtime.
- **Each value is a sourced Statement,** and the user's edits always win (D-50).
- **Anything that would ADD to or restructure the Library arrives as a Proposal:** a new episode, a new franchise member, a changed Timeline order.
- (precedent: none stated)

D-52 (was 57). **Rejections are remembered, and every decision is undoable.**
- **Rejecting or unticking** part of a Proposal records a Rejection against that Provider's id. It is not proposed again unless the Provider's data changes meaningfully, or the user clears it.
- **Settings › Rejected** lists everything turned down, with Undo, like Sonarr's import list exclusions. The partial precedent is beets' `incremental_skip_later`, which remembers skipped directories but not rejected matches.
- **Accepted imports and Matches can be undone too** (old CNCORE-441: about 3% of the old merges were wrong and irreversible).
- **Why:** old ADR-0027 (canoncore-history) found that almost nothing remembered rejections.
- Picard's rejection memory is unfounded, since its docs are silent. beets remembers skipped directories only (verified 2026-09-28).

D-53 (was 38). **Matching files: suggested, then confirmed.**
- **The scanner suggests.** It reads the filename, the folder, embedded tags, an NFO or a `{tmdb-…}` hint, and suggests "file → Item" against Items ALREADY in the Library.
- **Confident Matches confirm in bulk.** An exact Provider id, or S01E01 inside an imported show, can be confirmed with one click.
- **Unmatched files wait.** They sit in "Unmatched files" until the user matches them, or imports the Item first.
- **A file never creates an Item (D-4).**
- (precedent: none stated)

D-54 (was 51). **A file is recognised by a content fingerprint, and a missing file goes Offline.**
- **The fingerprint:** size plus hashes of a few chunks, so a rename or move keeps the file's Match, Edition and progress, as in old ADR-0023 (canoncore-history). This is OUR design: neither Plex nor Emby documents its file hash (verify found only a non-staff 2013 forum post about `media_parts.hash`).
- **A missing file is marked Offline,** never deleted, and comes back when the file returns. Removal is deliberate only.
- **Why:** Jellyfin deletes rows during a storage blip (old where-it-runs.md (canoncore-history) §6.6).
- **Scans run on a schedule and on demand,** because file-change events are unreliable on network disks, as in old ADR-0050 (canoncore-history).

## 9. Playback

D-55 (was 2, 4, 7, 12b). **Codecs are handled both ways, as Swiftfin does, on any host.**
- **The server remuxes to HLS and converts audio** (DTS and TrueHD are not in Apple's HLS spec). Direct play, remux and audio-only conversion need no video transcode.
- **Apple apps:** Apple's player (AVPlayer) for anything in the HLS spec. A built-in software player (VLCKit or MPVKit) decodes everything else on the device, with no server work: VC-1, MPEG-2, VP9, 10-bit H.264, interlaced, PGS/VobSub.
- **Web:** HEVC plays in Safari, Chrome and Edge with hardware decode.
- **Server:** transcoding (ffmpeg, with hardware acceleration where the host has it) is a capability each install turns on or off. When on, it serves the web and acts as a fallback. When off, a file the web cannot play (such as HEVC in Firefox) shows "open in the app", with the reason shown.
- **Whatbox:** transcoding is off. Whatbox bans 4K HEVC transcoding, and a shared CPU risks the "burdening" clause. Odd files play in the Apple apps, and the web shows "open in the app".
- **Precedent:** Plex, Jellyfin and Emby transcode on the server, Infuse decodes on the device, and Swiftfin does both (audit 2026-09-28).

D-56 (was 48). **Streams are authenticated with short-lived signed URLs.**
- **The flow:** the app starts a playback session through the API with its normal bearer token. The server returns an HLS URL signed for that Item, that session and a few hours.
- **Segment URLs carry the signature,** never the Account's token, so a leaked URL expires and grants nothing else.
- **It works the same** in AVPlayer, hls.js and AirPlay.
- **Precedent:** CloudFront and Mux signed URLs.
- **Rejected:** Account tokens in stream URLs, and cookies everywhere. Plex documents passing `?X-Plex-Token=` as a URL parameter, and Jellyfin's AuthorizationContext reads `api_key` from the query string (both verified 2026-09-28).
- **This reconciles** the no-token-in-URL rule of old ADR-0108 (canoncore-history) with D-70's bearer tokens.

D-57 (was 49). **Subtitles.**
- **Text subtitles** (SRT and ASS, embedded or in sidecar files) are converted to WebVTT in the HLS stream. That works everywhere with no transcode.
- **Image subtitles** (PGS and VobSub) play in the Apple app's on-device player (D-55). They are burned in where the host has transcoding on. Otherwise the web shows "open in the app".
- **Default tracks:** the Profile's language, "forced" subtitles on automatically, and SDH tracks labelled.
- **Precedent:** Plex and Jellyfin convert text subtitles and burn in image ones with a full transcode.

D-58 (was 70). **Default audio track: the one the file marks as default** (the Owner chose this over "profile language, never extras"). Other tracks are switched by hand.
- (precedent: none stated)

D-59 (was 50, 93). **Progress is kept per Profile, per EDITION, as an append-only event log.**
- **Versions of one Edition** (1080p, 4K, NTSC) share Progress. A different Edition (Remastered) has its own. This matches Plex.
- **Players report about every 10 seconds.** Position and "watched" are derived from the log, so history is never lost and sync conflicts resolve by time, as in old ADR-0019 (canoncore-history).
- **Each event carries a position suited to its medium:**
  - video and audio: seconds;
  - EPUB: a location in the book (EPUB CFI or a Readium locator), so it survives a font-size change;
  - comics: a page.
- **"Finished" is defined per medium:** about the last 2 minutes remaining, measured as time remaining, not a percentage, as in old ADR-0085 (canoncore-history); or the last chapter or page.
- **Watched and unwatched can be set by hand.**
- **Watch events also carry a source field** (the app, or an import), so a later history import (project 3) fits in.
- **Edge case for the spec:** a PAL and an NTSC Version of one Edition differ in runtime (PAL speed-up), so a resume point must be mapped by proportion, not by seconds.
- **Precedent:** Plex (per-edition watched state); Kavita's two-way progress sync with KOReader (its wiki, via the completeness sweep).
- The glossary's Progress entry is widened accordingly.

D-60 (was 66, 85, 43). **One rule for files that cover several Items: segments.**
- **The file is matched to each Part or episode with a start and end time,** and each keeps its own Progress and watched state. Playing an episode plays only its span.
- **Where the Parts form a Story, "Play story" plays the whole file** (a fan omnibus, say).
- **The Match is found from the filename** (`S04E12-E13`) or chapters, and confirmed like any Match (D-53).
- **A Version is backed by a file, or by a time span of one** (D-16).
- **Precedent:** this avoids Jellyfin's merged-item trap, recorded in old ADR-0021 (canoncore-history), and goes further than Plex, where "playing any of the represented episodes will play the full file" (support.plex.tv naming guide, verified 2026-09-28). The times in the examples were illustrative.

## 10. Clients

D-61 (was 55, 90). **Apps keep a local copy of the Library, fed by a change feed.**
- **Every table carries a change number, and deletions leave a tombstone,** as in old ADR-0075 (canoncore-history). Clients ask "what changed since N".
- **iPhone, iPad and Mac keep a permanent copy on the device. The web app keeps it in the browser.**
- **On Apple TV the copy is a rebuildable cache.** tvOS guarantees only 500 KB of persistent storage, and "all other data must be purgeable" (Apple's tvOS guide, confirmed 2026-09-28). After a wipe:
  - sign-in and the server address survive (Keychain and persistent defaults);
  - screens load live from the server, and search uses the server's index;
  - the copy rebuilds from the change feed in the background.
- **Browsing and search are instant,** and a 603-entry Timeline scrolls smoothly. Playback streams from the server as normal.
- **Progress made offline is queued,** and merges by time through the event log (D-59).
- **The Owner normally has good wifi,** so the choice is about speed and craft, not offline use.
- **Precedent:** Infuse keeps a full local library; Plex and Jellyfin fetch per screen. Swiftfin keeps its store in the tvOS caches directory and reads the server live (confirmed from its source). Infuse's tvOS approach is partly unconfirmed.

D-62 (was 60). **Search runs on the device, with an FTS5 index on the server.**
- **Apps search their local copy (D-61) as the user types:** titles, alternate titles, Characters and Persons. Search ignores accents and case, and matches prefixes (old CNCORE-469 was accents normalised on only one side).
- **The web searches its local copy too, and falls back to the server** while that copy is not ready.
- **The server** keeps the same index in SQLite FTS5, for that fallback, for clients still syncing, and for the Apple TV after a wipe.
- **Results are grouped by kind:** shows, episodes, films, books, Characters, Orderings.
- **"Search providers"** finds things not yet imported (D-4).
- **Replaces** pg_trgm, from old ADR-0120 (canoncore-history).
- (precedent: none stated)

D-63 (was 91). **A new device finds the server by invite link, iCloud sync, or local-network discovery.**
- **An invite link carries the server address.** Opened on an iPhone, it adds the server.
- **The server list syncs across the same Apple ID's devices** through `NSUbiquitousKeyValueStore` (tvOS 9+, iOS, macOS; 1 MB total; confirmed 2026-09-28).
- **On the same network, the app discovers the server,** as Jellyfin does with UDP 7359 (confirmed).
- **Typing the address is the fallback.**
- **The device then pairs by code (D-68).**
- **Several servers are supported from day one.**
- **There is no central CanonCore service.** How Plex's apps find servers after plex.tv/link is an inference (via the account's server list), not a Plex statement.

D-64 (was 92). **The API is additive-only within a major version, and CI enforces it.**
- **An old app keeps working with a newer server.**
- **CI runs `oasdiff breaking`** against the last release's OpenAPI spec and fails any breaking change. oasdiff v1.32.1 detects breaking changes and has a GitHub Action (confirmed 2026-09-28).
- **A truly breaking change bumps the major version.** The server then advertises a minimum app version, and old apps show "Please update CanonCore" instead of erroring.
- (precedent: none stated)

D-65 (was 69). **Accessibility gates every merge.**
- **Web:** WCAG 2.2 AA, checked by axe in the Playwright tests. Zero violations are required.
- **Apple:** every control has a VoiceOver label, text follows Dynamic Type, and focus works with the Apple TV remote and Switch Control. This is checked with Xcode's accessibility audits in the UI tests (the XCUITest audit API is confirmed for iOS 17, tvOS 17 and macOS 14).
- (precedent: none stated)

D-66 (was 64). **Design is decided later, through a design prototype on ALL clients** (the Owner, 2026-09-28): the web, iPhone, Mac and Apple TV.
- It runs after the grill output and before project 1's spec. "This will take a while and is when we'll decide design really."
- It is not decided in the grill. The native-Apple-first option was offered as a starting point for the prototype, not chosen.
- **The design prototype plan:**
  - It is Matt's `prototype` UI.md sub-shape B (no app exists yet), on real data (the library-model fetch).
  - Web: variants on a `?variant=` search param with a floating switcher. SwiftUI: an equivalent variant picker, hidden in release builds.
  - 3 variants by default, capped at 5.
  - It lives on a `prototype/design` branch (prototype rule 6), in its own Orca worktree, bridged by `/handoff` out and back. The handoff files go to the OS temp directory and point at `grill-decisions.md`, `CONTEXT.md` and the ADRs by path.

D-67 (was 103). **The Apple app goes on the App Store (project 10), with a public demo server of public-domain content.**
- **The demo** is fully usable without the user's own server, serves as the App Store reviewer's demo account (Review Guidelines, updated 8 June 2026), and doubles as the portfolio showcase.
- **Constraints to respect:**
  - It must NOT run on Whatbox, whose AUP bans public video libraries. A small separate host is needed (Oracle Always Free's 200 GB fits a small demo).
  - Its metadata must avoid TMDB's "destination website" clause. Use public-domain Local metadata or Wikidata.
- **Friends meanwhile use TestFlight.**

## 11. Accounts and security

D-68 (was 8, 10, 13). **Invited Accounts, each with Profiles.**
- **Who connects** (the Owner): "wants to be from Whatbox, and any person's Mac, iOS, Apple TV can connect". ANY invited person connects from their OWN Mac, iPhone or Apple TV, not only the Owner's devices.
- **Admins invite people,** like sharing a Plex library. Each person has their own login on their own devices, and each Account can hold Profiles (a household sharing one Apple TV, like Plex Home or Netflix).
- **Watched state, Progress, Continue Watching and personal Orderings belong to each Profile,** keyed that way from migration 1.
- **Admins keep settings and curation (D-69).**
- **Each device pairs by a code** shown on screen and approved from a signed-in device: a device-code flow like plex.tv/link and Jellyfin Quick Connect (neither of which is RFC 8628), built to RFC 8628.
- **This supersedes the one owner with one password** of old ADR-0044 (canoncore-history).
- Whatbox's permission for the Owner's install is in D-78.

D-69 (was 34). **Who can change what.**
- **Admins** (the Owner, plus anyone he grants it to) edit metadata, set Locks, add Providers and invite people. Their edits apply to everyone.
- **Any Profile builds its own Orderings.** They are private by default, and can be shared with the whole install or exported as an id list (D-26).
- **Provider Timelines** (Fandom, TARDIS Guide) are install-wide.
- **Watch state** is always per Profile, and a kids Profile can be restricted to watching.
- **This overturns old ADR-0072 (canoncore-history).**
- **Precedent:** Plex (owner-only edits, per-user playlists) and Jellyfin (permissioned edits, shareable playlists).

D-70 (was 26). **Auth: Better Auth with our own Profiles** (re-decided by the Owner the same day, after "which is more impressive?").
- **Better Auth** handles Accounts, passwords, sessions, device-code pairing (its `device-authorization` plugin, RFC 8628), bearer tokens and API keys (`@better-auth/api-key`), on SQLite through its Kysely adapter.
- **Profiles** are our own tables under an Account, chosen after login like Netflix. Every piece of watch state is keyed by Profile.
- **Passkeys and 2FA on SQLite through Kysely** are confirmed in Better Auth's docs (docs only, 2026-09-28).
- **Why:** "don't roll your own auth" is the 2026 norm a reviewer looks for. The product-specific part (Profiles, pairing an Apple TV) stays ours.
- **Risk accepted:** Vercel has owned Better Auth since 2026-07-07. It is open source, and the data stays in our tables.
- **Rejected:** hand-rolled auth like Jellyfin and Kavita.

D-71 (was 47, 87). **Sign-in works on every host, and login protection slows down, never locks out.**
- **Setup always creates a password.** On a secure HTTPS domain (the Owner's `finestarling.box.ca`, a Tailscale HTTPS name) it offers "Add a passkey", and passkeys become the fast way in. On a plain http:// LAN install, the passkey option is hidden.
- **2FA is optional,** with its lockout disabled: Better Auth's 2FA plugin LOCKS accounts by default (`ACCOUNT_TEMPORARILY_LOCKED`, "Enabled by default"), so CanonCore sets its lockout `enabled: false`.
- **Rate limits:** Better Auth's limiter is per IP and per path, in a fixed window (`window`, `max`, `X-Retry-After`), and sets no account lock (verified in v1.7.6 source and docs, 2026-09-28). The per-Account limit and the growing delays are OURS to build, through `customStorage` or a hook. `ipAddressHeaders` must be set behind the Whatbox proxy.
- **No lockout ever,** because Jellyfin-style lockout lets an attacker lock out the only admin.
- **Sessions** expire, and can be revoked per device (Settings › Devices).
- **Every route requires auth** except login and health.
- **Evidence:** old ADR-0125 (canoncore-history) measured 70,299 guesses a second; old CNCORE-109, 116 and 117.

D-72 (was 46). **Outbound URL safety (SSRF): safe by default.**
- **Only admins add Provider URLs.**
- **Refused:** private, loopback, link-local and cloud-metadata addresses, `file://`, and redirects into any of them. The check runs after DNS resolution and on every redirect.
- **Public hosts need HTTPS,** and responses are capped in size and time.
- **An admin can explicitly allow a local Provider** (the same box, or a Tailscale address) behind a warning.
- **URLs a Provider returns** (images, links) pass the same check.
- **Precedent in the old records:** old ADR-0034 (canoncore-history), with an allowlist and a deny-list, and old access-layer.md (canoncore-history) §5.3 on Tailscale and loopback.

D-73 (was 99). **Friends' privacy: an admin sees live sessions only, never history** (project 3).
- **Each Account can export its own data:** its watch history and Orderings, as JSON plus the id-list format.
- **Each Account can delete itself.** Its shared Orderings are given to the admin or deleted, as their owner chooses.
- **This departs from Plex,** which shows friends' activity to the server's admin. The reason: friends' privacy.

D-74 (was 100). **Per-Account stream limits, a usage view, and a cellular warning** (project 3).
- **Admins set per Account:** the number of streams at once, plus a maximum bitrate where transcoding is on.
- **Settings shows "Now streaming"** with each stream's bitrate, and this cycle's upload total against the host's allowance.
- **On cellular, the app warns before playing a large file that can't be transcoded.**
- **Precedent:** Jellyfin's per-user bitrate limits, unverified (Open items).

D-75 (was 101). **Per Profile: favourites, a watchlist and 1 to 5 star ratings** (project 3).
- **Anything can be favourited:** an Item, an Entity or an Ordering.
- **They feed home rows and filters,** and stay private to the Profile.
- **There is no recommendation engine.**
- **Precedent, unverified:** Plex, Jellyfin and Infuse favourites, watchlist and ratings are from memory (Open items).

D-76 (was 94, 95). **Admins are told when something fails: an in-app banner everywhere, and a push where an APNs key is configured.**
- **Covers:** failed backups, a Provider key rejected or expired, failed scans, and the host's upload allowance nearing its cap.
- **The banner appears at the top of every app for admins,** on every install.
- **Push needs the app developer's APNs key,** which a self-hosted server run by someone else cannot hold. The Owner's install holds his APNs key and pushes to his iPhone. Other installs get banners.
- **An optional push relay may come in project 10. There is no central service now (D-63).**
- **Outbound webhooks come later (project 10).**
- **Precedent:** Plex webhooks (a Plex Pass feature, confirmed). That Plex and Home Assistant run central push relays is from memory (Open items).

D-77 (was 96). **Security housekeeping ships in project 1.**
- **A SECURITY.md,** with GitHub's private vulnerability reporting switched on.
- **Renovate** opens grouped weekly dependency updates through the affected-only CI (D-86).
- **No telemetry.** The only call home is an update check against GitHub Releases, which can be switched off.
- (precedent: none stated)

## 12. Ops and hosting

D-78 (was 3, 7, 10a). **The Owner's deployment: the server runs on his Whatbox slot** (yuzu.whatbox.ca), not on the Mac. The Mac is a client. This is ONE deployment (D-3).
- **The shape:** a plain Node 24 process with a SQLite file.
  - A cron watchdog (`@reboot` plus `*/5`, like slskd) keeps it running. That `@reboot` fires is unmeasured (Open items).
  - It is exposed as a Whatbox managed link over HTTPS, and CanonCore requires its OWN login on every route.
  - Playback is direct play, remux, or audio-only conversion, with transcoding off (D-55).
  - No containers ("may stop working"), and no Postgres process to babysit.
  - The dispatcher chose this under the ethos, which the Owner delegated, and the Owner confirmed it ("yes").
- **Inspected read-only 2026-09-28:**
  - Node 24.14, pnpm 11, ffmpeg and ffprobe 8.1.2, SQLite 3.53, Postgres server binaries, and rootless Podman 6.1.
  - Whatbox's nginx serves a wildcard certificate for `*.finestarling.box.ca`.
  - Cron works; slskd uses a `*/5` watchdog. There is no systemd and no usable GPU.
  - The host is a shared 64-core EPYC at load about 140. The home directory is empty apart from `~/apps/slskd`.
- **Whatbox's rules, read at source on 2026-09-28:**
  - "Can I run my own apps? Yes." The AUP bans "IPTV hosting ... VOD hosting, VOD sharing, public media streaming, public video libraries". "VOD hosting" and "VOD sharing" have NO "public" qualifier. The AUP also forbids "20 or more concurrent Plex streams".
  - HTTPS comes through a managed link, `<name>.finestarling.box.ca`, with the wildcard certificate, no body cap (100G) and a `proxy_read_timeout` of 10m between reads, as measured in old ADR-0109 (canoncore-history).
  - The upload allowance is per plan (10 to 40 TB on HDD, 50 TB+ on NVMe; the Owner's plan is unchecked), then "100 Mbps unmetered". CanonCore's streams COUNT against the upload allowance. Only FTP, SSH/SFTP, HTTPS from the pre-provided directories, OpenVPN, Plex and Jellyfin are exempt (whatbox.ca/faq, verified 2026-09-28). The "log into it" line in /policies/traffic refers to the same named list. Past 10 TB, upload drops to 100 Mbit/s for the rest of the cycle, with no fee. Downloads to the server are never counted. The 5 Mbit/s figure in older notes was Pulsed Media's, not Whatbox's.
  - The FAQ says "You may not transcode 4K HEVC video streams", and there is a "burdening the server" clause.
  - Containers "may stop working at any time" (from /wiki/Bookshelf, not the FAQ or AUP). The wildcard certificate, the 10m timeout and "no body cap" are measurements, not published rules.
- **Permission:** the Owner says Whatbox has ALLOWED his personal use AND inviting friends. The text is to be saved beside the other grants when the Owner forwards it (Open items). Any other person running CanonCore on their own Whatbox slot must ask Whatbox themselves; the install docs say so.

D-79 (was 53, the host-agnostic principle). **Deploys are versioned releases with a one-command update.**
- **Each merge to main** builds a versioned release in CI: a Node bundle with the web app inside, and a Docker image for other hosts. An install uses either.
- **`canoncore update`** downloads the release, backs up the database, runs migrations, swaps the folder, restarts, and checks health. `canoncore rollback` returns to the last release.
- **Migrations** are forward-only. The server refuses to start on a database newer than it knows, as in old ADR-0047 (canoncore-history).
- **Later,** CI may deploy to the Owner's slot automatically over SSH after each release.
- **Rejected:** building on the Whatbox (a shared, loaded CPU), and containers on Whatbox ("may stop working").
- (precedent: none stated)

D-80 (was 52). **Backups run nightly, go off the host, and are encrypted.**
- **Snapshot:** CanonCore takes a consistent SQLite snapshot with SQLite's online backup, and keeps 7 daily and 4 weekly copies locally.
- **Off-host copy:** an encrypted copy is pushed with restic to a destination the admin chooses (the Mac over SSH, Backblaze B2, and so on). B2's free tier is 10 GB, enough for the database, not for media (verified 2026-09-28).
- **Restore is one command, and is tested in CI.**
- **Only the Library is backed up,** not the media.
- **Settings › Backups** shows the last result, with "Back up now" and "Restore".
- **Why:** a seedbox can be suspended within 24 hours (old where-it-runs.md (canoncore-history) §9.4), and it was the old sweep's most repeated finding (old sweep G12).
- **For the Owner:** the Mac isn't always online (he travels), so an always-on destination is better for his install. It is chosen in project 1 (Open items).
- (precedent: none stated)

D-81 (was 54). **A built-in task scheduler with its own page.**
- **Jobs live in a SQLite table,** so they survive restarts and never run twice.
- **Settings › Tasks** lists each job with its last run, result, next run and "Run now", like Jellyfin's Scheduled Tasks.
- **The jobs:** Provider refresh (D-51), expiry of each Provider's cached data at the cache ceiling its manifest declares (TMDB's is 6 months, D-37), nightly backup (D-80), scans (D-54) and session cleanup.
- **Long jobs report progress live,** fixing old CNCORE-365's "progress did not update until a reload".
- **Cron stays only as the watchdog.**

D-82 (was 45). **Licence: the code is AGPL-3.0** (as before, and as Immich uses).
- **Why AGPL (the Owner, 2026-09-28):** anyone running a modified CanonCore for others must publish their changes, so it cannot become a closed hosted service. MIT would allow that, and GPL does not reach a server that is only run over a network.
- **Provider data** is used under each Provider's own terms, most of them non-commercial. The README says so, and each Provider's attribution is shown in the app (Settings › About, plus TMDB's logo and notice).
- **Competitor licences, verified with the GitHub API on 2026-09-28:** Jellyfin GPL-2.0, Audiobookshelf GPL-3.0, Navidrome GPL-3.0, Immich AGPL-3.0.

## 13. Features

D-83 (was 22). **Filming locations on a map.** The Owner asked for "filming locations via an API and Mapbox". Evidence: `filming-locations.md`.
- **Data:** Wikidata P915 (coordinates, CC0) plus Tardis Fandom's per-story "Filming locations" sections. Only places below city level are kept.
- **Geocoding:** each place is geocoded once by a one-off job against a configurable geocoder endpoint, and stored. Nominatim serves the Owner's own install (its limits count all installs together, and periodic app requests are "strongly discouraged"); self-hosted Photon otherwise.
- **The map:** MapLibre GL JS on the web (OpenFreeMap tiles to start, a self-served PMTiles extract later) and native MapKit on iPhone, Mac and Apple TV. OpenFreeMap offers no SLA and "may discontinue it at any time", so the PMTiles fallback stays.
- **Mapbox is out:** its real free tier needs a card, every install needs its own account, and it has no tvOS.
- (precedent: none stated)

D-84 (was 23). **Songs in an episode.** The Owner asked for "finding songs that are playing, e.g. these songs play in this episode". Evidence: `songs-in-episodes.md`.
- **Every film and show shows its soundtrack ALBUM,** from Wikidata P406 and the MusicBrainz release group (1,850 films and 546 TV shows linked, measured 2026-09-28), and any Track in the Library plays.
- **Per-episode songs are stored as sourced links** (episode, recording, time, duration, order: Wikidata P10664's shape) and imported where P10664 exists.
- **The server LISTENS for songs with Olaf** (AGPL-3.0), which fingerprints the Library's own music, matches each episode's audio and suggests what plays when. A person confirms each suggestion, and hand entry fills the rest. It finds only songs the Library holds.
- **Accuracy under dialogue is unmeasured,** so one real episode is tested before the feature is promised.
- **Olaf 3.2.2** (2026-09-27) is built with Zig and needs ffmpeg at run time. It is installed to a user prefix, and one Whatbox build is proven first.
- **Out:** Tunefind and WhatSong (paid or closed), AcoustID (not built for fragments), AudD/ACRCloud (paid).
- (precedent: none stated)

## 14. Testing and CI

D-85 (was 63). **Testing: a fixture corpus, layered tests, and a mutation check.**
- **Each test gets its own throwaway SQLite file.** Nothing is shared (old CNCORE-93, 253, 271, 464, 468).
- **CI fixtures:** a small checked-in set of tiny GENERATED files with the same shapes as the Owner's Doctor Who corpus:
  - two Editions;
  - a 4-part Story and an omnibus;
  - PGS subtitles;
  - an M4B with chapters;
  - an EPUB and a CBZ;
  - an Extra.
- **The manual walk:** the REAL Doctor Who corpus on Whatbox (`~/fixtures-work/selection.json`, 124 files) is walked before a project closes.
- **Layers:**
  - unit tests (Vitest);
  - the API contract (the OpenAPI spec checked);
  - end-to-end on the web (Playwright);
  - end-to-end on the Apple app (XCUITest on the tvOS, iOS and macOS simulators).
- **Every new test is mutation-checked:** delete the feature and watch the test fail, as in old ADR-0168 (canoncore-history).
- **A skipped suite fails CI** (old CNCORE-160, 370).
- **Every CI job has a timeout** (old CNCORE-219).
- **macOS CI is free:** "GitHub Actions usage is free for … public repositories that use standard GitHub-hosted runners", and the repo is public (verified 2026-09-28). Stay on standard `macos-*` runners, because larger runners are never free. For contrast, private-repo rates are macOS $0.062/min and Linux $0.006/min.

D-86 (was 72). **CI: affected-only and tiered.** The repo is a pnpm + Turborepo monorepo.
- **A docs-only change runs docs checks only.**
- **A code change runs typecheck, lint and unit tests for affected packages only,** through `turbo run … --affected`. That covers changed packages and their dependents; it needs full git history, and a shallow clone falls back to running everything (verified in the Turborepo docs, 2026-09-28). The target is under about 5 minutes.
- **Playwright + axe run only when web code is affected. Xcode build + XCUITest run only when Apple code is affected,** on free standard macOS runners.
- **A nightly job runs everything.**
- **A merge requires CI to have passed on the exact commit that lands:** a merge queue if the repo's plan allows it, otherwise "branch must be up to date" (Open items).
- **Caching is added only where measurement shows it helps.** Whether Turborepo's remote cache is free is unverified (Open items).
- **At setup (D-98 step 6), `/setup-orca-linear-project`'s template `ci.yml` lands as is.** It runs gitleaks and asserts the CLAUDE.md length and the `docs/agents/` files. The affected-only Turborepo tiers above are added in project 1's first ticket, with gitleaks and the docs job kept in the docs-only tier.
- (precedent: none stated beyond D-96's industry practice)

## 15. Roadmap

D-87 (was R1). **Project 1: "Play Rose on every device"**, a thin end-to-end slice.
- **Server:** runs on Whatbox (Hono, SQLite, Better Auth), with the Owner's Account only.
- **Import and match:** the Owner installs TMDB from store v0 (D-44), it proposes a show or film, and the Owner imports it. Files are matched by suggestion.
- **Playback:** direct play plus a remux to HLS.
- **Clients:** ONE SwiftUI app for Apple TV, iPhone and Mac, plus the web player.
- **Done when:** the Owner imports Doctor Who (2005), matches Rose.mkv, watches it on the Apple TV, and resumes it on the iPhone, the Mac and the web.
- Every later project is a layer on top.

D-88 (was R2, 79, 12). **The order after project 1** (the Owner chose the draft):
1. Play Rose on every device.
2. **Orderings and franchises**, the standout:
   - Wikidata franchise proposals;
   - the Fandom Provider with adapters, starting with Tardis `Theory:Timeline`;
   - TARDIS Guide sets (API access granted 2026-09-28);
   - "As a timeline" and "Also in";
   - id-list import and export;
   - Smart Orderings (D-29) and Entity links (D-35).
3. **Friends and profiles:** invites, Profiles, device-code pairing; privacy (D-73), stream limits (D-74), favourites and ratings (D-75).
4. **The CMPP Store and more TV/film Providers:** TheTVDB, TVmaze, URL Providers; coverage and comparison (D-49).
5. **Music,** including the Owner's Big Finish Provider, since audio lands here.
6. **Books and audiobooks.**
7. **Comics.**
8. **Playback polish and odd codecs:** the on-device player, server transcoding as a capability, skip intro and credits, trickplay, chapters, offline downloads, Chromecast and spoiler control.
9. **Filming locations and songs.**
10. **Public release:** a Docker image, install docs, the "ask your host" note for seedboxes, localisation, local-network discovery and the support log bundle; also the App Store (D-67), outbound webhooks and an optional push relay (D-76).
- The placement of the Doctor Who Providers inside 2 and 5 is the dispatcher's allocation, to be confirmed in each project's spec.

D-89 (was 104). **The ease-of-use gate is the Owner's own walk-through.**
- **Each project closes only after the Owner has walked it on his own install,** as with the old "used on the Owner's instance" rule. Stalls become tickets before close.
- **The Owner chose this over "a real person does it unaided".**
- **The accessibility gate (D-65) still applies.**
- (precedent: none stated)

D-90 (was 106). **The README showcase starts in project 1 and grows with every project,** serving criterion 2 (impressive to a developer).
- **Each project's close adds:**
  - a short screen recording (project 1: Rose on the Apple TV, resumed on the iPhone);
  - an architecture diagram;
  - links to the founding ADRs.
- (precedent: none stated)

D-91 (was none; the Owner, 2026-09-28). **Every roadmap project (1 to 10) becomes a Linear PROJECT in team CC, seeded with ONE `to-spec` issue.**
- **Each project gets ONE issue labelled `to-spec` (state Backlog)** carrying POINTERS to that project's slice of the grill, never copies of it:
  - its goal;
  - the D-ids that shape it (the per-project seed, section 19);
  - its open items;
  - its "done when";
  - the Owner's walk-through gate (D-89).
- **When a project's turn comes, `/to-spec` REWRITES that issue's body into Matt's to-spec template sections:** Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes. It swaps the `to-spec` label for `ready-for-agent` and keeps the issue as the parent of the spec's tickets. `/wayfinder` runs first if the project is still foggy.
- **`to-spec` is a kind label,** not a role.
- **They are created in process step 7** (founding records, D-98), after team CC exists and `/setup-matt-pocock-skills` has run.
- (precedent: none stated)

## 16. Process

D-92 (was 9, 30). **All current code is archived in a separate repo and not reused.** The Owner: "We will drop all current CanonCore and provider repo code, or archive and not use it."
- **It covers** the CanonCore app, provider-wiki and provider-tmdb.
- **The rebuild starts fresh in a NEW GitHub repo,** inside the same Linear workspace. Amended 2026-09-28 during step 5, the Owner: "i dont mind deleting and reconnecting". The old repo is renamed `canoncore-v0`, made private and archived, so its git history, releases v0.1.0 and v0.2.0 and PR pages survive; the name `CanonCore` is then free for the new repo, created by `/setup-orca-linear-project` in step 6. Prototype branches move as single commits holding only their files, so no old history enters the new repo.
- **The whole old tree goes to the private `canoncore-history` repo,** which already holds the pre-publication history and the forensic record. It goes in as snapshot folders on that repo's main (`final/canoncore/`, `final/provider-wiki/`, `final/provider-tmdb/`, and `final/install/` from `~/canoncore/` without its `.env`); git history stays in `canoncore-v0` and the archived provider repos. The new repo's first commit holds `docs/rethink/`, LICENSE, `.claude/settings.json` and a short interim README; the old CLAUDE.md and `.claude/rules/` are not carried.
- **Prototypes live only on their `prototype/<name>` branches,** never on main (Matt's prototype rule 6). The untracked local `prototypes/` folder is deleted once those branches are confirmed.
- **The provider repos** (provider-wiki and provider-tmdb) are archived the same way: pushed to `canoncore-history` or set read-only. That detail is settled when it is executed.
- **Carried out only after the grill,** and shown to the Owner before anything is removed.
- **How the old material is used** (the Owner): "We can learn from old CanonCore code and issues and tickets and docs, but only when you think so, and prefer new stuff." The old code, Linear issues, ADRs and docs are a reference, consulted when judged useful for a specific decision, as EVIDENCE and lessons, not binding rules. Nothing old is reused or ported unless there is a stated reason.

D-93 (was 28). **A fresh slate for EVERYTHING.** The Owner: "We need new everything. Fresh slate."
- **Records:** new ADRs from 0001, a new CONTEXT.md and a new CLAUDE.md. The old ones are archived as evidence only.
- **Process:** rebuilt fresh too. What survives from the old process is chosen on purpose, not carried over.
- **Standing rule (the Owner):** every spec and ticket starts from what competitors do and verifies its claims.

D-94 (was P1, 28). **Linear: a NEW team with key CC** (CC-1, CC-2 …) in the paid `jacobrees-canoncore` workspace, so issues start from 1 (team numbering can't be reset).
- **The old CNCORE team is exported to CSV and RETIRED:** read-only, restorable, and its CNCORE-n ids stay valid as history. It is never deleted or rekeyed.
- **The "delete the old team" advice** in the setup skill and the memory is corrected to "retire". Evidence: `linear-fresh-start.md`.

D-95 (was P2). **Records follow Matt Pocock's current setup, plus our verify step.** Evidence: `matt-pocock-setup.md`.
- **Founding ADRs:** this grill becomes about 15 ADRs numbered from 0001, one paragraph each (the map is at the end of this file). Later ADRs are written only when a choice is hard to reverse, surprising, and a real trade-off.
- **CLAUDE.md** is a pointer file of about 40 lines: what CanonCore is, the commands, and pointers into `docs/agents/`.
- **Repeated gotchas become checks** (lint, hooks, CI) through his `retro` skill, not prose. `retro` is NOT installed: install `retro` (and optionally `pr` and `setup-pre-commit`) from mattpocock/skills, or drop the reference.
- **One CONTEXT.md glossary.**
- **The flow is grill → spec → tickets → implement.** Our addition: a competitor check and `/verify` before a spec publishes and during `/to-tickets`, before publishing.
- **Tickets are born in Todo as sub-issues** of their spec (`--parent <spec>`), with blocked-by relations. The new CLAUDE.md must NOT carry the old repo's "parent links dropped" rule.
- **Counts at the time:** the old records were 193 ADRs (134 accepted, 59 proposed) and a 199-line CLAUDE.md.

D-96 (was 71). **Process rules follow INDUSTRY PRACTICE, not the old repo's rules.** The Owner: "whatever is industry practice, don't focus on the old repo".
- **CI speed is a first-class requirement.** The Owner: "the CI/CD pipeline was a bottleneck of how fast we could go last time". Before, a docs change ran the whole pipeline.
- **The CI design is D-86.**

D-97 (was 81). **The canonical words, agreed term by term,** live in `CONTEXT.md`, which governs names in code, UI and tickets.
- **Ordering** is the umbrella word, and a Timeline is one kind of Ordering.
- **Library** means EVERYTHING imported, owned or not. The Owner chose it over "catalogue" plus "library".
- **Edition** is a cut, and **Version** is a copy (Plex's word).
- **Match** is attaching a media file. "Link" is reserved for Relationships.
- **A Statement comes from a Source.**

D-98 (was P3; revised by the Owner, 2026-09-28, after Matt Pocock's /ask-matt). **The order from here:**
1. **Finish the grill:** the history in/out question, then the Owner's shared-understanding confirmation.
2. **Validate everything** against the installed Matt Pocock skills (a subagent).
3. **Capture the prototypes** on `prototype/<name>` branches with their verdicts (his prototype rule 6). Both are captured and pushed: `prototype/library-model` (cffd3fac) and `prototype/schema-structure` (0e838604). Prototypes live ONLY on those branches, never on main; the untracked local `prototypes/` folder is deleted once the branches are confirmed. The pointers go in the seed issues: `prototype/schema-structure` in project 1's (D-15), `prototype/library-model` in project 2's (D-25).
4. **Phase boundary:** first draft the founding ADRs and the corrected CONTEXT.md in `docs/rethink/`. Then run **`/handoff`** (the Owner's choice, 2026-09-28, over `/compact`). It writes a portable file to the OS temp directory that points by path to grill-decisions.md, CONTEXT.md, the ADR drafts, clear-the-slate.md and this process order. Then **clear**, and continue from the handoff file in a fresh session with step 5.
5. **Clear the slate:** archive to `canoncore-history` (D-92) and retire CNCORE (D-94). The agreed checklist is `docs/rethink/clear-the-slate.md`. Team CC is NOT created by hand here: step 6 creates it.
6. **The Owner invokes `/setup-orca-linear-project`** (user-only), reuse-a-workspace path. It creates team CC, labels, the GitHub integration and PR automation, and Orca registration, runs `/setup-matt-pocock-skills` as its step 14 (choosing its dedicated "Linear (via Orca)" tracker option, `issue-tracker-linear-orca.md`, for team CC, NOT "Other"), then verifies the chain with one real ticket. Three deliberate adjustments when running it:
   - (a) the pointer-sized CLAUDE.md (D-95) is written at the skill's step 13, NOT from its long template;
   - (b) its template `ci.yml` lands as is (gitleaks, the CLAUDE.md length and the `docs/agents/` files); the affected-only Turborepo tiers (D-86) are added in project 1's first ticket, with gitleaks and the docs job kept in the docs-only tier;
   - (c) its repo-creation step RUNS and creates the new `CanonCore` repo (D-92 as amended 2026-09-28); the Actions secret `TMDB_READ_ACCESS_TOKEN` is re-added there from `~/.config/canoncore/tmdb-read-token`.
7. **Write the founding records:** move the ADRs drafted in step 4 (under the three gates, D-95) into `docs/adr/` and the corrected CONTEXT.md to the root, now that the old `docs/adr/` is archived (step 5); then create the ten Linear projects with their `to-spec` seed issues (D-91, section 19).
8. **`/handoff` out,** `/prototype` the design on all four clients in a fresh session (D-66), `/handoff` back.
9. **`/to-spec` project 1,** agreeing the test seams with the Owner during `/to-spec` and writing them into its Testing Decisions (Matt's tdd: "No test is written at an unconfirmed seam"); then `/to-tickets` with blocking edges, then `/implement` per ticket with `/clear` between tickets (`/tdd` and `/code-review` inside).
- **Deliberate deviations from Matt's flow:**
  - his steps 1 to 3 (grill, spec, tickets) did NOT fit one context window, so this consolidated record plus CONTEXT.md are the primary source the spec reads;
  - `/wayfinder` is the on-ramp for any later project that turns out foggy.

## 17. Open items

Only what is genuinely open, each with an owner.

**Questions**
- **History in or out** (D-98 step 1). Research is running; see `history-in-out.md` when it exists. Owner: the Owner, on the research's report.

**Unverified precedents** (owner: `/verify` before the founding ADR that cites them, or the named spec)
- Comic Vine's and Metron's entity lists (D-33). Owner: `/verify` before the ADR.
- Plex and Home Assistant central push relays (D-76). Owner: `/verify` before the ADR.
- Plex, Jellyfin and Infuse favourites, watchlist and ratings (D-75). Owner: the project 3 spec.
- Jellyfin's per-user bitrate limit (D-74). Owner: the project 3 spec.
- Plex and Jellyfin sort-title behaviour (D-21). Owner: the project 1 spec.
- Infuse's tvOS storage approach, partly unconfirmed (D-61). Owner: `/verify` before the ADR.

**Unmeasured**
- That `@reboot` fires on Whatbox (D-78; skipped by /verify, needs a real reboot; the probe is re-added). Owner: the project 1 spec.
- The Owner's Whatbox plan and its upload allowance (D-78). Owner: the project 1 spec (its bandwidth budget).
- Modern two-parter grouping (D-17). Owner: the project 2 spec.
- The Big Finish sitemap's coverage against MusicBrainz (D-39). Owner: the project 5 spec.
- Olaf's accuracy under dialogue, and one Whatbox build (D-84). Owner: the project 9 spec.

**Setup**
- The merge queue: whether the repo's plan allows one, else "branch must be up to date" (D-86). Owner: CI setup in project 1.
- Whether Turborepo's remote cache is free (D-86). Owner: CI setup in project 1.
- The backup destination for the Owner's install (D-80). Owner: project 1.
- `canoncore-history` is ALREADY archived (read-only): it must be unarchived before the old tree can be pushed (D-92). Owner: clear the slate (D-98 step 5).
- Vercel/Neon: unknown whether anything is live; ask the Owner. Owner: clear the slate (D-98 step 5).

**Grants and permissions**
- The Whatbox grant text is not on file (D-78). Owner: the Owner forwards it; it is saved as a research note.
- The Big Finish grant text is not on file (D-39). Owner: the Owner forwards it; it is saved as a research note.
- TARDIS Guide: API beta access is granted (2026-09-28, Jacobrees). An explicit written OK for CanonCore use is optional. Owner: the Owner, if wanted. The key is created under My Account → API and stored in ~/.config/canoncore/.

**Readings to confirm** (all four SETTLED by the Owner on 2026-09-28; Owner: the Owner, at the shared-understanding confirmation)
- ~~Local metadata "first"~~ SETTLED 2026-09-28: Local metadata ranks FIRST by default (D-43).
- ~~Shared-ordering ids~~ SETTLED 2026-09-28: export writes `provider:id` (tmdb:1726, openlibrary:…, comicvine:…), and import ALSO accepts Kometa's bare-id lists (D-26).
- ~~Cache ceiling~~ SETTLED 2026-09-28: a manifest field (e.g. `cache: { maxAge: "P6M" }`) that the scheduler enforces automatically and the Store displays (D-81, D-45).
- ~~Greyed entries~~ SETTLED 2026-09-28: three looks. Playable is normal. Imported with nothing to play is dimmed with its medium icon, and still opens its page. Not imported is faded text with an Import button (D-25, D-31).

D-99 (new, 2026-09-28). **Trakt sync is a Store Provider speaking CMPP, and CMPP gains a HISTORY capability.**
- **The capability:** import the user's watch history, and send out watches, as sourced events (D-59).
- **Connection is per profile, through the Provider's own device-code login.** It is optional, off by default, and private: admins never see it (D-73).
- **Trakt is the first history Provider (project 3).** Simkl, Hardcover (reading) and ListenBrainz (music; its listens are public CC0, so opting in needs a warning) can follow through the same capability.
- **Facts (history-in-out.md, checked 2026-09-28):**
  - Trakt removed the VIP requirement for creating an app (PR #945, merged 2026-09-23); a verified GitHub account is required instead.
  - Its draft policy (#941) permits a self-hosted tool syncing the user's own activity.
  - Free users can connect two community apps, and an app unused for 30 days is auto-deleted.
- **This supersedes the raw log's "no Trakt".**

D-100 (new, 2026-09-28). **TARDIS Guide is a Store Provider that needs the user's own key** (project 2).
- **Listed in the Store,** marked "needs a TARDIS Guide Patron key". Anyone can use it with their OWN key; the Owner's key is never shared.
- **Its guides (sets, playlists) arrive as Orderings,** imported by Proposal.
- **Prerequisites show on Items** ("Watch first: …").
- **It is credited and linked back to TARDIS Guide,** as promised in the Owner's email.
- **Optional:** ask Shaun whether non-Patrons could get free or read-only keys for CanonCore use.
- **The Owner's key is stored in `~/.config/canoncore/tardis-guide.env`** (2026-09-28).

D-101 (new, 2026-09-28). **Linear triage uses labels only; the Triage inbox is off** (the closest to Matt Pocock's labels-only `triage-labels.md`).
- **The labels:** `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`. `wontfix` is Linear's Canceled state.
- **Beside the triage roles, plain labels mark kind and area** (the Owner, 2026-09-29). Kinds: `to-spec`, `spike`, `skills-repo`. Areas: `server`; the clients `web`, `swift` (shared SwiftUI code, all three Apple clients), `ios`, `macos`, `tvos`; and one `provider-<name>` per Provider (`provider-tmdb`, `provider-big-finish`), each created when that Provider's first ticket is filed, never ahead of it. The old `provider-repo` is not carried: first-party Providers load in-process in the monorepo (D-44).
- **None of the area labels is a Linear label group,** because "only one label from a given label group can be applied to an issue at a time" (linear.app/docs/labels, verified 2026-09-28), and a ticket may touch `web` and `tvos`, or two Providers, at once.
- **This resolves a conflict between two local skills.** `setup-orca-linear-project` (inbox off) wins over the local `setup-matt-pocock-skills/triage-labels-linear-hybrid.md` (inbox on).
- **The local hybrid file is corrected** through the skills repo's own worktree, at process step 6.
- **Triage applies only to issues the Owner didn't create;** `/to-tickets` output skips it.
- **`to-spec` is a kind label,** not a triage role.


## 18. Founding ADR map

18 founding ADRs, each passing the three gates: hard to reverse, surprising, a real trade-off. Everything else stays in this record.

| ADR | Title | Covers |
|---|---|---|
| 0001 | The Library is a strict schema the Admin imports, and files are only matched to it | D-4, D-53, D-31 |
| 0002 | No Provider is a default, and Local metadata is the one always-on exception | D-5, D-36, D-43 |
| 0003 | Providers speak CMPP over HTTP from a Store of manifest URLs, and only first-party ones load in-process | D-44, D-45, D-46 |
| 0004 | Every value is kept as a sourced Statement, ranked by install order, and a Lock wins | D-50, D-51, D-52 |
| 0005 | A fixed hierarchy per medium, with Orderings as a separate layer on top, and no separate continuity concept | D-15, D-17, D-24, D-26 |
| 0006 | Item, Edition and Version follow Plex's split, and a Version can be a time span of a file | D-16, D-19, D-60 |
| 0007 | An Item may appear more than once in an Ordering (Repeats); Positions are detail | D-27, D-28, D-30 |
| 0008 | The product is host- and franchise-agnostic: one process with SQLite, and host limits are settings | D-3, D-79, D-13 |
| 0009 | One SwiftUI app for every Apple device plus a full web client, with no Jellyfin adapter | D-8, D-9, D-10 |
| 0010 | Odd codecs are decoded on the device, and server transcoding is an optional capability | D-55, D-57 |
| 0011 | Invited Accounts with our own Profiles on Better Auth; login slows down and never locks out (a Consequence) | D-68, D-69, D-70, D-71 |
| 0012 | Streams use short-lived signed URLs, never Account tokens | D-56 |
| 0013 | Progress is an append-only event log per Profile and Edition | D-59 |
| 0014 | Clients keep a local Library copy fed by a change feed, and on Apple TV it is a cache | D-61, D-62 |
| 0015 | A missing file goes Offline and is recognised again by fingerprint | D-54 |
| 0016 | A pnpm + Turborepo monorepo, with the OpenAPI contract generated from Zod code and fed to the Swift client | D-12, D-86 |
| 0017 | The API is additive-only within a major version | D-64 |
| 0018 | The code is AGPL-3.0 | D-82 |

Settled with the Owner on 2026-09-28, after validation against Matt Pocock's installed skills. The login ADR was folded into 0011 (a setting, so not hard to reverse). Whatbox (D-78) was taken out of 0008 (the Owner's deployment is reversible). Three ADRs were added: the monorepo, additive-only API, and licence ADRs. "No default Provider" (0002) was kept for the deliberate "no" it records. D-25 was swapped for D-24 in 0005 (the Owner, same day): the franchise page's views stay in this record, and the ADR records the deliberate "no".

## 19. Per-project seed

What process step 7 files: one `to-spec` issue per Linear project (D-91), carrying pointers to these D-ids. D-1 to D-5, D-89 and D-90 apply to every project and are not repeated. Project 1's seed also points to the `prototype/schema-structure` branch (D-15), and project 2's to `prototype/library-model` (D-25).

| Project | Name | D-ids |
|---|---|---|
| 1 | Play Rose on every device | D-6 to D-18, D-20, D-21, D-37, D-43 to D-46, D-50 to D-72, D-76 to D-82, D-85 to D-87 |
| 2 | Orderings and franchises | D-17, D-19, D-22 to D-35, D-42, D-47, D-48 |
| 3 | Friends and profiles | D-59, D-68, D-69, D-73 to D-75 |
| 4 | The CMPP Store and more TV/film Providers | D-36, D-37, D-44, D-49 |
| 5 | Music, with the Big Finish Provider | D-7, D-38, D-39 |
| 6 | Books and audiobooks | D-7, D-40, D-59 |
| 7 | Comics | D-7, D-41, D-59 |
| 8 | Playback polish and odd codecs | D-55, D-57 |
| 9 | Filming locations and songs | D-83, D-84 |
| 10 | Public release | D-3, D-63, D-67, D-76, D-79, D-82 |
