Observed 11 Oct 2026 on Plex Media Server 1.43.4.10903-e5521bd8c (API version 1.2.3, bundled Plex Web 4.160.0, account with an active Plex Pass), macOS 27.0.1, REA not used, with curl 8.7.1, Python 3.14.7, ffmpeg 8.1.2 and sqlite3 3.54.0.

# Plex Media Server's behaviour, on stub media

This note records what Plex Media Server does with real-named stub media: how it matches and groups files, what it keeps when files move or disappear, how it stores Progress, and what its agents, users, search, transcoder, collections and events do. It was written for CC-288, the second ticket of the Plex sweep (ADR 0024), after CC-287's note on the API (`server-api.md`), whose server, tokens and helpers it reuses. It describes behaviour in CanonCore's own words (GLOSSARY.md). No Plex payload, file, database, code or frame is copied here. Every stub, capture, log and database copy stayed in `/private/tmp/claude-501/cc-288-scratch/`, outside every repository.

Each claim carries its evidence:

- **observed**: seen on this server or plex.tv on the date above, or read from the server's settings, its database (a read-only copy), or the static JavaScript of the bundled Plex Web.
- **documented**: stated by Plex, with the URL given.
- **disassembled**: not used. Native analysis belongs to CC-292.

A second client was using this server during the run: a Plex Web session with another client identifier played three stub items and changed one server preference (`AcceptedEULA`). No result below rests on its calls, but its play-state events are used once, as noted.

## Sources

- **Plex's API reference**, <https://developer.plex.tv/pms/>, including its "Metadata Providers", "MediaProvider Response" and "GUID construction" sections (read from the OpenAPI document CC-287 extracted).
- **Plex support articles**, read through the `r.jina.ai` reader because `support.plex.tv` refuses plain fetches (HTTP 403). Quotes were copied from the reader's text:
  - [Naming and organizing your Movie files](https://support.plex.tv/articles/naming-and-organizing-your-movie-media-files/)
  - [Naming and organizing your TV Show files](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/)
  - [Multiple editions](https://support.plex.tv/articles/multiple-editions/) and [for TV shows](https://support.plex.tv/articles/multiple-editions-tv-shows/)
  - [Multi-version movies](https://support.plex.tv/articles/200381043-multi-version-movies/)
  - [Local files for trailers and extras](https://support.plex.tv/articles/local-files-for-trailers-and-extras/)
  - [Adding music media from folders](https://support.plex.tv/articles/200265296-adding-music-media-from-folders/)
  - [Advanced, hidden server settings](https://support.plex.tv/articles/201105343-advanced-hidden-server-settings/)
  - [Plex Movie agent advanced settings](https://support.plex.tv/articles/advanced-settings-plex-movie-agent/)
  - [Upgrading to the new Plex Movie agent](https://support.plex.tv/articles/upgrading-a-movie-library-to-the-use-the-new-plex-movie-agent/)
  - [Local Media Assets](https://support.plex.tv/articles/200220677-local-media-assets-movies/)
  - [Using NFO metadata files with Plex](https://support.plex.tv/articles/using-nfo-metadata-files-with-plex/)
  - [Emptying library trash](https://support.plex.tv/articles/200289326-emptying-library-trash/)
  - [Library settings](https://support.plex.tv/articles/200289526-library/)
  - [Collections](https://support.plex.tv/articles/201273953-collections/)
  - [What is Plex Home](https://support.plex.tv/articles/203815766-what-is-plex-home/), [Managed users](https://support.plex.tv/articles/203948776-managed-users/) and [Fast user switching](https://support.plex.tv/articles/204232453-fast-user-switching/)
  - [Direct Play and Direct Stream](https://support.plex.tv/articles/200250387-streaming-media-direct-play-and-direct-stream/)
  - [Webhooks](https://support.plex.tv/articles/115002267687-webhooks/) and [Push notifications](https://support.plex.tv/articles/push-notifications/)
- **Plex forum and blog**:
  - [Announcement: Custom Metadata Providers](https://forums.plex.tv/t/announcement-custom-metadata-providers/934384), 9 Dec 2025, with Plex's [example provider](https://github.com/plexinc/tmdb-example-provider).
  - The Plex Media Server release notes for [1.43.0 beta](https://forums.plex.tv/t/plex-media-server/30447/695) (3 Dec 2025) and [1.43.0 public](https://forums.plex.tv/t/plex-media-server/30447/699) (11 Feb 2026).
  - [New Search Release](https://forums.plex.tv/t/new-search-release/853473), 13 Sep 2023.
  - [2025 Plex Rewind](https://www.plex.tv/blog/2025-plex-rewind/).
- **Observation**:
  - **Libraries.** Four libraries were made on ffmpeg stubs (160×90 test pattern, sine audio, 10 s to 10 min) and three tagged MP3s: Movies, TV, Music, and a Provider Test library.
  - **Event logs.** A local webhook receiver and a logger on `/:/eventsource/notifications` ran for the whole session.
  - **Provider stub.** A stub Custom Metadata Provider on `127.0.0.1:32489` logged every request the server made to it.
  - **Database.** Copies of the server's library database (with its WAL) were read with `sqlite3 -readonly`.
  - **Plex Web.** The bundle's JavaScript was read for the timeline interval, the profile augmentations and the user calls.

## 1. The stub cases and what Plex did with them

All movie stubs were in one library on the default agent, Plex Movie (`tv.plex.agents.movie`). Every one matched online, and the match is shown by a `plex://movie/…` guid.

| Case | File name (under the library root) | What Plex did (observed) |
|---|---|---|
| Plain film, leading article | `The Godfather (1972)/The Godfather (1972).mp4` | Matched to The Godfather (1972). Title "The Godfather", sort title "Godfather". |
| Accented title | `Amélie (2001)/Amélie (2001).mp4` | Matched to Amélie (2001). Sort title "Amelie", with the accent folded. |
| `{tmdb-…}` hint with a wrong title | `Mystery Stub (1999) {tmdb-603}/Mystery Stub (1999) {tmdb-603}.mp4` | Matched to The Matrix (1999), TMDB 603. The hint beat the title, and the sort title became "Matrix". |
| Editions | `Blade Runner (1982)/Blade Runner (1982).mkv` (300 s) and `Blade Runner (1982) {edition-Final Cut}/Blade Runner (1982) {edition-Final Cut}.mkv` (330 s) | **Two separate items.** Both carry the same public guid, and the second has `editionTitle` "Final Cut". Inside, the second item's guid has the edition appended (`…/edition/Final%20Cut`). |
| Versions (PAL and NTSC) | `Casablanca (1942)/Casablanca (1942) - PAL.mkv` (25 fps, 576 s) and `… - NTSC.mkv` (23.976 fps, 600 s) | **One item with two Media**, each with its own duration and frame rate ("PAL" and "24p"). The item's duration is the first Media's (600 s). |
| Extras by suffix | `Heat (1995)/Heat (1995)-trailer.mp4`, `-behindthescenes`, `-deleted`, `-featurette`, `-interview`, `-scene`, `-short`, `-other` | Eight Extras of Heat, each a `clip` with a subtype: trailer, behindTheScenes, deletedScene, featurette, interview, sceneOrSample, short, other. Each is titled with the film's name, not the suffix. |
| Extras by folder | `Jaws (1975)/Trailers/`, `Behind The Scenes/`, `Deleted Scenes/`, `Featurettes/`, `Interviews/`, `Scenes/`, `Shorts/`, `Other/` | Eight Extras of Jaws with the same subtypes, each titled from its file name. |
| Online extras | (none on disk) | With "Find extras" on (the default), Plex also added online trailers and scenes from Internet Video Archive: 6 for Heat and 21 for Jaws, mixed in the same Extras list. |
| Plain show (real) | `Friends/Season 01/Friends - S01E01.mkv`, `S01E04`, `S01E05`, `Season 02/Friends - S02E03.mkv` | Matched to Friends (1994). Each Episode got its online title, such as "Pilot" and "The One Where Heckles Dies". |
| Multi-episode file | `Friends/Season 01/Friends - S01E02-E03.mkv` | **Two Episode items** (E2 "The One with the Sonogram at the End", E3 "The One with the Thumb"). Each has its own Media and Part rows pointing at the same file, with the whole file's duration. See section 6. |
| NFO beside a film | `Fargo (1996)/Fargo (1996).nfo` and `movie.nfo` (Kodi format, different title, plot and genre) | **Ignored**, with "Prefer local metadata" off and on. See section 8. |
| Embedded tags in a film | `Fargo (1996).mp4` with an MP4 title and genre tag | Ignored with "Prefer local metadata" off. With it on, the tag's title and genre won. |
| Music, tags differing from online | `Radiohead/OK Computer/01 - Airbag.mp3` and two more, tagged album "OK Computer (Local Tag Album)", titles "… (local tag)", year 2001, genre "CC288 Local Genre" | Matched to Radiohead / OK Computer (1997) through the artist's MusicBrainz id. The online values won until "Prefer local metadata" was switched on. See section 8. |

What Plex documents for these cases:

- **Hints.** The id hint "must follow the form `{[source]-[id]}`" ([movie naming](https://support.plex.tv/articles/naming-and-organizing-your-movie-media-files/)), and TV folders accept TMDB, TVDB or IMDb ids ([TV naming](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/)).
- **Extras.** The suffixes and the folder names are listed in [Local files for trailers and extras](https://support.plex.tv/articles/local-files-for-trailers-and-extras/), and they match what was observed.
- **Editions.** "The ability to specify different editions for a movie requires a Plex Pass subscription for Server admin account" ([Multiple editions](https://support.plex.tv/articles/multiple-editions/)). The account has one, so the Plex Pass gate itself was not tested.
- **Versions.** When an app plays a collapsed item, "it will automatically request and play the most suitable item by default" ([Multi-version movies](https://support.plex.tv/articles/200381043-multi-version-movies/)).

## 2. File identity: rename, move, missing

These tests were all observed. "State" means the account's watch count and offset.

| Change, then a scan | Result |
|---|---|
| Rename a file inside its folder (Clue) | Same item, same Media and Part ids, state kept. |
| Rename the film's folder (Heat) | Same item, a **new** Media/Part row, state kept. |
| Move a film's file into a differently named folder (Blade Runner) | A **new** item (the old ratingKey returned 404), and **state kept** (the offset reappeared). |
| Remove one Version (Casablanca PAL), with "Empty trash automatically after every scan" on (the default) | The Media row was dropped at the scan. Restoring the file made a new Media row. State kept. |
| Remove a whole film, with auto-empty off | The item stayed in the library with `deletedAt` set on the item and its Media. The `trash=1` filter listed it, and `checkFiles=1` showed the Part as not `accessible` and not `exists`. Restoring the file brought back the same item and Part id with `deletedAt` cleared. |
| Remove a whole film, with auto-empty on | The item was deleted, and the event stream announced the item as deleted (timeline state 9). Restoring made a new item (ratingKey 8 became 121) **with its watched count intact**. |

**Why state survives.** Watch state lives in a per-account table keyed by **account and guid**, not by item, Media or file (observed in the database). A film or Episode that matches the same online record again finds its state. What did not survive is anything keyed by item id: a manual collection or a playlist that held the old ratingKey. The state of an unmatched item is keyed by a `local://<id>` guid, so it would not survive re-creation. That is an inference from the key; it was not tested.

**Trash.** Plex documents that a missing file puts the item "into the "trash"", that "it can be restored back to the Library by making the file for the library item available again at the expected location", and warns that with auto-empty on "content will be removed from your Library immediately with no chance to simply restore it" ([Emptying library trash](https://support.plex.tv/articles/200289326-emptying-library-trash/)). Plex documents no rename or move behaviour.

**The file hash.**

- Each Part row carries two hashes: `hash` (40 hex characters) and `open_subtitle_hash` (16 hex characters). Both are indexed (`index_media_parts_on_hash`), as are `file` and `size` (observed).
- `open_subtitle_hash` equals the public OpenSubtitles hash (file size plus 64-bit sums of the first and last 64 KiB) for all three files tested (observed).
- `hash` is **not** a SHA-1 or MD5 of the whole file, of its first or last 1 KiB to 10 MiB, of the two together, of the middle, or of any of those combined with the size in several encodings (observed, by comparison). Its algorithm is left to CC-292.
- The server sends `hash` to a Custom Metadata Provider in every match request (observed, section 7).
- Plex's reference shows both hashes on `MediaPart` in its `/library/metadata/{id}/tree` example and describes `computeHashes` as computing "Plex and OpenSubtitle hashes" (documented, CC-287).

**ADR 0015 verdict: confirmed in direction, with corrections.**

- Plex keeps a rename inside a folder in place.
- Plex keeps watch state across moves and deletions, because the state is keyed by the online guid.
- With auto-empty off, Plex keeps a missing item as trash (CanonCore's Offline), restorable when the file returns.
- But its default (auto-empty on) deletes the missing item at the next scan. A move between folders made a new item, so item-keyed membership (collections, playlists) is lost.
- "Neither Plex nor Emby documents its file hash" is contradicted as worded: Plex documents that the hashes exist (CC-287). It holds for the algorithm, which Plex does not document. One of the two hashes is the public OpenSubtitles hash.

## 3. Editions and Versions: shared Progress

All observed:

- **Versions share one offset.** The offset is stored once per item, in milliseconds, in the account and guid row. Both Casablanca Media read the same `viewOffset` (100000). No Media carried an offset of its own.
- **The offset ignores which Version played.** A transcode decision with `mediaIndex=0` returned the NTSC Media (600 s) and `mediaIndex=1` the PAL Media (576 s), and both carried the item's single `viewOffset`. `/:/timeline` takes no Media id, and Plex Web sends `time` in milliseconds of the Version it played.
- **So switching Version resumes at the same milliseconds, not the same scene.** The two copies differ by 4% in runtime, so 100 s into PAL is about 104 s into NTSC.
- **Editions keep separate state.** Progress reported on Blade Runner (default Edition) did not appear on "Final Cut". The state row's key includes the edition suffix.
- **Plex documents that Editions are tracked separately.** "their watched status, user ratings, etc. are all tracked separately", and syncing of watch state "does not currently work with "editions" of movies" ([Multiple editions](https://support.plex.tv/articles/multiple-editions/)). Plex documents nothing for Versions.

**ADR 0006 verdict: confirmed.**

- The quotation is Plex's own wording: "Versions all represent the same release of an item" and "Editions represent different releases of an item" ([Multiple editions](https://support.plex.tv/articles/multiple-editions/), [Multi-version movies](https://support.plex.tv/articles/200381043-multi-version-movies/)).
- The server shows the same split. An Edition is its own item with its own runtime and state, and Versions are Media of one item.

**ADR 0013 verdict: confirmed.**

- "Versions of one Edition share Progress while a different Edition has its own, as in Plex": confirmed (observed, and documented for Editions).
- "Plex shares one offset in milliseconds (`viewOffset`) across the versions of an item": confirmed (observed). The shared value is raw milliseconds with no runtime scaling, which is the problem ADR 0013's proportion solves.

## 4. Progress: what a player reports, and how often

**Calls.**

- `POST /:/timeline` reports `state` (playing, paused, buffering, stopped), `time` and `duration` in milliseconds (documented, CC-287).
- `PUT /:/scrobble` marks an item watched, and `/:/unscrobble` reverses it (documented).
- `GET /:/progress` is an older call that is not in the reference (observed, CC-287).

**Interval.**

- Plex documents that a client must call the timeline "whenever the play state changes, or in the absence of a play state change, in a regular fashion (generally this means every 10 seconds on a LAN/WAN, and every 20 seconds over cellular)" ([developer.plex.tv/pms](https://developer.plex.tv/pms/), "Report media timeline").
- **Plex Web 4.160.0 does this.** Its player runs a one-second tick and sends the timeline when the elapsed seconds are a multiple of 10 (observed in the bundle).
- The other client on this server reported at 0 s and 9 s and then stopped. That is consistent with this interval but too short a run to measure it.

**What the server keeps.**

- **The first 60 s are ignored.** Any report with `time` up to 60000 ms got `playbackState=ignore`, and nothing was stored. That held for items of 120 s, 300 s, 576 s and 600 s alike. 61000 ms was stored (observed).
- **Plex Web applies the same rule.** It updates its local `viewOffset` only when `time` is over 60000 (observed in the bundle).
- **Watched at 90% within one session.** Crossing the played threshold during one session (539 s to 560 s of 600 s) returned `playbackState=complete`, set `viewCount` to 1, cleared the offset, and fired `media.scrobble` (observed).
- **Starting past the threshold does nothing.** A new session whose first report was already past 90% (541 s) got `ignore` and was not marked watched (observed).
- **The setting.** The threshold is "Video played threshold", default 90%. "Video play completion behaviour" (default: the earliest of that threshold and the first credits marker) can end it earlier (documented in [Library settings](https://support.plex.tv/articles/200289526-library/), observed in `/:/prefs`).
- **A rewatch keeps "watched".** An item that was already watched kept `viewCount` 1 while a rewatch stored a new offset, and it appeared in Continue Watching with both (observed).

## 5. Plex Pass

Active:

- plex.tv's user object showed `subscription.active` true, status "Canceled" (it lapses about 11 Nov 2026), plan monthly, `roles` containing `plexpass`, and `webhooks` among its features (observed).
- The server's event stream reported `hasPlexPass: true` (observed).
- Webhooks and Editions worked (observed).

## 6. Multi-episode files

Observed:

- `S01E02-E03` became two Episode items. Each has its own Media and Part row, and both rows point at the same file with the whole file's duration (480 s). Neither row has a start time, an end time or an offset.
- A transcode decision for either Episode returned the whole file from the start.
- Each Episode kept its own offset: playing E03 to 200 s left E02 with none.
- **Finishing one Episode marked both watched.** Completing E02 set `viewCount` 1 on E03 as well.
- Continue Watching then showed S1E4.

**ADR 0006 verdict on "playing any of the represented episodes will play the full file": confirmed.** The sentence is Plex's own, from [TV naming](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/) (documented), and both Episodes are served the whole file (observed). Plex also links their watched state, which ADR 0006's Segments avoid.

## 7. Custom Metadata Providers

**What Plex documents.**

- **Installing by URL.** The forum announcement says: "Go to Settings → Metadata Agents → Add Provider → Enter the URL for the locally running provider". A provider is "just an HTTP API that returns metadata for library items in a standardized way", and it needs Plex Media Server 1.43.0 ([announcement](https://forums.plex.tv/t/announcement-custom-metadata-providers/934384), forum).
- **The provider's root.** It returns a `MediaProvider` with `identifier` (which must start `tv.plex.agents.custom.`, using only `[a-zA-Z0-9.]` after the prefix), `title`, an optional `version`, and `Types`. Each type is movie 1, show 2, season 3 or episode 4, with a `Scheme` equal to the identifier.
- **Features.** Two are required: `metadata` (`GET {key}/{ratingKey}`) and `match` (`POST` with a JSON body of `type`, `title`, `year`, `guid`, `index`, `parentIndex`, `filename`, `date`, `manual`, `includeAdult`, `includeChildren`).
- **Other endpoints.** Shows and seasons also need `/children` and `/grandchildren`, paged with `X-Plex-Container-Size` and `-Start`, and `/images` is recommended.
- **Guids.** Items' guids are `{identifier}://{type}/{ratingKey}`.
- **Scope.** Music is not supported ("music libraries are currently not supported").
- **Combining providers.** Providers are combined in a Metadata Agent, an ordered group whose first item is the primary.
- All of this is from [developer.plex.tv/pms](https://developer.plex.tv/pms/), "Metadata Providers" and "MediaProvider Response".

**What the server did with a stub provider** (all observed):

1. **Registration.** `POST /media/providers/metadata?uri=http://127.0.0.1:32489` made the server `GET /` (no Plex headers), and it listed the provider (id 7, `agentType` primary, `online` true).
2. **Grouping.** `POST /media/providers/metadata/group?title=…&primaryIdentifier=…` made a Metadata Agent (group 5). `PUT …/group/5/items/{providerId}` added Plex Movie and Plex Local Media, and `after=-1` moved an item to the front. Items carry a float `order`.
3. **Binding a library.** A library was created with `agent=<identifier>` and `metadataAgentProviderGroupId=5`. Plex Web sends both fields (observed in the bundle).
4. **The scan's requests to the provider:**
   - `GET /?includePreferences=1`.
   - `POST /library/metadata/matches` with a JSON body of `type`, `title`, `year`, `filename` (relative), **`hash`** (the Part's Plex hash) and `excludeElements=Media`.
   - `GET /library/metadata/{ratingKey}?excludeElements=Collection&includeReviews=1`.
   - `GET /library/metadata/{ratingKey}/extras`, paged at 50.
   - All of them carried the server's identity headers (`X-Plex-Provides: server`, product, version, platform and device), `X-Plex-Language` (the library's language), `X-Plex-Country` and `X-Plex-Text-Format: markdown`, and no token.
5. **The result.** The item took the provider's guid, `tv.plex.agents.custom.canoncore.cc288stub://movie/heat-1995`. Its title, summary, genre and cast came from the stub, and Plex Movie, lower in the group, **filled the fields the stub left empty**: studio, content rating, poster, and imdb, tvdb and plex ids. The stub's `tmdb://` id was what let Plex Movie find the film.
6. **Reordering.** With Plex Movie moved to the front and the item refreshed, every field the two providers both supplied (title, summary, genres, cast) came from Plex Movie. The item kept the primary's guid.

**ADR 0003 verdict: confirmed.** The quotation is Plex's own (forum announcement), and a provider installs by URL alone: the server reads the root `MediaProvider` and calls the declared paths (documented, observed). What Plex asks of a provider (match by title, year, file name and file hash; then metadata, extras and images) is what the table above records.

## 8. Metadata agents

**The settings each library offers** (observed in `/library/sections/{id}/prefs`):

- **Movies.** "Use local assets" (on), "Prefer local metadata" (`respectTags`, off), "Find extras" (on), "Ratings Source" (Rotten Tomatoes by default; IMDb; The Movie Database), "Collections" (three modes), "Minimum automatic collection size", "Use original titles", "Certification Country", and marker and analysis switches.
- **TV.** Adds "Episode ordering" (The Movie Database by default, or TheTVDB), "Use season titles" and "Seasons" (show or hide), with the same "Prefer local metadata" (off).
- **Music.** "Prefer local metadata" (off), "Genres" (None, Plex Music, or Embedded Tags), "Album Art" (Plex Music only, Local files only, or both), "Artist Bios", "Album Reviews and Critic Ratings", "Popular Tracks", "Find Lyrics", "Concerts", and "Store track progress".

**Ratings Source.** One setting per movie library, with three values. It is not a per-field choice (observed). Plex: "Select the rating source for this library" ([Plex Movie agent settings](https://support.plex.tv/articles/advanced-settings-plex-movie-agent/), documented).

**Prefer local metadata** (observed):

- **Music.** With it off, the album, track titles, year and genre came from Plex Music. With it on and a refresh, the tag values won for album, titles and year, but **genre stayed online** until the separate "Genres" setting was set to Embedded Tags.
- **Video.** The behaviour is the same: an MP4's embedded title and genre were ignored with it off and won with it on.
- **Plex's advice.** For movies Plex says of this option "We don't recommend ever enabling this option" ([upgrading article](https://support.plex.tv/articles/upgrading-a-movie-library-to-the-use-the-new-plex-movie-agent/), documented).

**NFO.**

- **Ignored on this server.** A Kodi-format `.nfo` and `movie.nfo` beside a film were ignored by Plex Movie with "Prefer local metadata" off and on (observed).
- **A separate agent.** Plex documents NFO support as its own agent, "Plex NFO Movie" or "Plex NFO Series", which "Requires Plex Media Server version 1.43.1 or newer". It is chosen as a library's agent, or put into a Metadata Agent as primary, and "Music NFO support is not currently available" ([Using NFO files](https://support.plex.tv/articles/using-nfo-metadata-files-with-plex/), documented).
- **Not present here.** On this 1.43.4 macOS server no NFO provider existed: not in `/media/providers/metadata`, `/system/agents` or the providers table (observed). Why it is absent is unsettled.

**Source ordering.** Current libraries are bound to a Metadata Agent: an ordered group of providers. The built-in groups each hold one provider, and the user can make groups from Plex Movie or Series, Plex Local Media and custom providers. Group order decides the winner for **all fields at once**: the first provider with a value wins, and the later ones fill gaps (observed, section 7).

**Legacy agents.**

- Hidden by default behind "Show legacy agents during library setup" (`AllowLegacyAgents`, off by default) (observed).
- Plex's release notes say: "Visibility of legacy agents during library setup must be explicitly enabled in global library settings (PM-3605)". This shipped in the 1.43.0 beta of 3 Dec 2025 and went public in 1.43.0.10492 on 11 Feb 2026 ([forum release notes](https://forums.plex.tv/t/plex-media-server/30447/699), documented).
- The legacy agents are still installed (`com.plexapp.agents.imdb`, `themoviedb`, `thetvdb`, `lastfm`, `localmedia` and others in `/system/agents`) (observed).

**Online sources.**

- Plex Movie returned ids for IMDb, TMDB and TVDB on every film, and its online extras come from Internet Video Archive (observed).
- The TV agent's default episode ordering is "The Movie Database", with TheTVDB the alternative (observed).
- The music agent identified the artist by MusicBrainz id, and a hidden MusicBrainz provider exists in the database (observed).
- Plex does not document which sources the agents read.

**ADR 0002 verdicts.**

- **"matching Plex and Jellyfin for video, where a local NFO overrides online data": contradicted for Plex.** Plex's default video agents ignore NFO files entirely (observed). NFO is read only by a separate, opt-in agent (documented), which this server does not even offer. Even embedded tags win only with "Prefer local metadata" on, which is off by default.
- **"Plex's music library is the exception: there its online agent wins unless "Prefer local metadata" is switched on": contradicted as an exception.** The behaviour holds for music (observed). But video libraries behave the same: online wins unless the same setting is on (observed). Even with the setting on, music genre and album art follow their own per-field settings.

**ADR 0004 verdicts.**

- **"Jellyfin and Plex keep only the winner", and "Keep only the winning value, as Plex and Jellyfin do": confirmed for Plex.** An item has one value per field, and the providers' other values are not kept or shown. Only the winning Metadata appears in the API, and a refresh after reordering replaced the values (observed). Whether the server caches each provider's full response internally is CC-292's question.
- **"Plex's current agents have no source ordering, only a per-field "Ratings Source", and its legacy ordered agents are hidden for new libraries since Server 1.43.0": contradicted in two parts.**
  - Since 1.43.0, current libraries have source ordering through Metadata Agents (ordered provider groups, observed and documented).
  - "Ratings Source" is per library, not per field (observed, documented).
  - The legacy half is confirmed: legacy agents are hidden during setup since 1.43.0 (documented, observed).

## 9. Users: Plex Home, managed users, the last admin

These were observed with the one agent account.

**Creating a managed user.**

- `POST plex.tv/api/v2/home/users/restricted` with a JSON `friendlyName` and `restrictionProfile` (Plex Web's call) returned 201 and **created a Plex Home on the fly**: the account became a Home admin of a Home called "<username>'s home".
- The managed user had no server access until libraries were shared. Plex Web shares them with `POST /api/v2/shared_servers` (`invitedId`, `librarySectionIds` from plex.tv's own section ids, `machineIdentifier`, `settings`).
- After that, the managed user's server token came from `/api/v2/resources`. It differs from the token that `/switch` returns.

**What a managed user may do on the server** (unrestricted profile, with a client identifier sent):

- Allowed:
  - browse the shared libraries;
  - keep its **own** watch state (empty at first, separate from the owner's);
  - report Progress;
  - scrobble and rate (`media.rate` fired);
  - create its own playlist.
- Refused (403): editing metadata, creating or deleting collections, unmatching, refreshing a library, and writing prefs.
- Reading `/:/prefs` returned only two settings, the played threshold and completion behaviour.
- With the "little kid" profile, R-rated items returned 404 and 403.

**Collections and playlists.** Playlists are owned per account: the owner and the managed user each saw only their own, and the database ties a playlist to an account. Collections belong to the library and have no owner. Plex: "only the admin of the server can delete a collection" ([Collections](https://support.plex.tv/articles/201273953-collections/), documented).

**The last admin.**

- `DELETE /api/v2/home/users/{admin id}` was refused: 403, code 1043, "This action is not available for this user".
- The **legacy** `DELETE /api/home/users/{admin id}` answered "Successfully removed user from home". It **dissolved the whole Home**: the managed user was deleted (its tokens returned 401), its library share vanished, and the account went back to no Home.
- So Plex never leaves a Home without its admin, but one legacy call removes the admin by deleting the Home and everyone in it.
- Plex documents a single admin per Home, "the user that created the Home originally" ([What is Plex Home](https://support.plex.tv/articles/203815766-what-is-plex-home/)), and no way to transfer it. The server owner (account 1 on the server) cannot be changed through the server API. Community advice for moving a server is to unclaim and reclaim it (forum only).

**The profile picker.** Plex documents a user prompt at app start when the app "was previously last signed in to a protected user", which can be turned off per device ([Fast user switching](https://support.plex.tv/articles/204232453-fast-user-switching/)). Plex apps were not run here (CC-289 and later).

**Not settled.** Inviting a second, full Plex account (shared server, friend) needs another account, so it was not done.

## 10. Search

All observed on `/hubs/search` (and `/library/search` where noted):

| Query | Result |
|---|---|
| `Amélie`, `amelie`, `AMELIE` | Amélie: case and accents are folded. |
| `ame` | Amélie: prefix of a word. |
| `méli` | Not Amélie. People whose names start with "Meli" matched on `/library/search`, so matching is by word prefix, not substring. |
| `god`, `godfather`, `the godfather` | The Godfather. |
| `mat`, `the mat`, `matrix` | The Matrix (`/library/search` scored "the mat" 0.53). A leading "The" in the query is harmless. |
| `frien` | Friends (show). |
| `sonogram` | The Episode "The One with the Sonogram at the End". |
| `paranoid`, `local tag` | The Track and the Album, by their tag-sourced titles. |
| `de niro`, `pacino` | A person hub (Robert De Niro), and Heat and The Godfather with a `reason` of actor. |
| `heta` | Nothing: no typo tolerance, although the database holds spellfix tables. |
| `final cut`, `blade runner final` | Nothing: edition titles are not searched. |

So the index covers titles of films, shows, Episodes, Albums and Tracks, and people credited (actors, directors and so on). It folds case and accents and matches word prefixes. The database keeps FTS4 title tables in two forms (plain and ICU) and spellfix vocabularies for titles and tags.

Plex documents little: "Results are ranked based on relevance to your search term" and "Items that exist in multiple locations will be merged into a single result" ([New Search Release](https://forums.plex.tv/t/new-search-release/853473), forum).

## 11. Transcoding

**How the decision works** (observed with `/video/:/transcode/universal/decision` on an H.264 and AAC MKV and MP4):

- The server decides from a built-in client profile, chosen by `X-Plex-Platform` and `X-Plex-Product` or named by `X-Plex-Client-Profile-Name`, plus the client's `X-Plex-Client-Profile-Extra` augmentations.

**Results by profile** (observed):

| Client declares | Result |
|---|---|
| Platform `iOS`, product "Plex for iOS" | **Direct play** (1000) of the MP4. |
| Platform `Chrome` (with or without product "Plex Web"), protocol hls, dash or http | **No direct play** (3000: "No direct play video profile exists"). Instead "Conversion OK" (1001) with video and audio **copied**: a remux (direct stream) into MPEG-TS for HLS, MP4 for DASH, or MKV for http. |
| Chrome plus Profile-Extra `add-direct-play-profile(type=videoProfile&container=mkv&videoCodec=h264&audioCodec=aac)` | Direct play of the MKV. |
| Chrome with `directPlay=0 directStream=0` | Video **transcoded**, audio copied. |
| Chrome plus `add-limitation(… video.width upperBound 64)` | Video transcoded, audio copied. |
| Profile `Generic` | 4005, "No conversion profile found for protocol hls": nothing playable. |

**What Plex Web adds.** Plex Web builds `X-Plex-Client-Profile-Extra` at run time from the browser's capabilities: `add-limitation`, `add-transcode-target` and `append-transcode-target-codec` appear in the bundle (observed). Which augmentations it sends in practice, and when a browser direct-plays, is CC-289's question.

**Settings.** The server has "Disable video stream transcoding" (`TranscoderCanOnlyRemuxVideo`, off by default) and caps on simultaneous transcodes (observed in prefs).

**What Plex documents.** "Media can be Direct Played on a device if the source media is compatible with the client's playback capabilities", "Direct Streaming a file uses very little processing power without any loss in video quality", and incompatible subtitles get burned in ([Direct Play and Direct Stream](https://support.plex.tv/articles/200250387-streaming-media-direct-play-and-direct-stream/)).

**ADR 0010 verdict on "Server transcoding as the fallback every client leans on, as Plex…": confirmed.**

- Every client sends the server its capabilities and the server picks direct play, remux or transcode. Where the profile cannot direct play, the server remuxes or transcodes (observed).
- The fallback includes the remux step that ADR 0010 also chooses: for the Chrome profile, the default was a remux with no video transcode.
- A client with no matching profile gets nothing, rather than a decode on the device.

## 12. Collections, smart collections, playlists, Continue Watching

**Collections** (observed):

- **Manual.** Made with `POST /library/collections` (`smart=0`, a `server://…/library/metadata/10,9` uri), it held its two films.
- **Smart.** Made with `smart=1` and a filter uri (`year<<=1979`), it stores the query and filled live with Casablanca, The Godfather and Jaws. Plex documents smart collections from Server 1.22.3 ([Collections](https://support.plex.tv/articles/201273953-collections/)).

**Collection modes.**

- Each library has "Collections" with three modes: "Hide collections but show their items", "Hide items which are in collections" and "Show collections and their items" (default) (observed, documented).
- Each collection also has its own "Collection Mode" (Library default, Hide items in this collection, Show this collection and its items, Hide this collection but show its items) and "Collection order" (release date, alphabetical, custom) (observed).
- Setting a collection's own mode changed the library list that Plex Web requests (`/library/sections/{id}/all?includeCollections=1&includeExternalMedia=1`). Hiding items removed Heat and Fargo, and hiding the collection removed the collection (observed).
- Changing the **library-wide** mode changed nothing in that list (observed). Whether clients apply the library mode themselves is CC-289's question.

**Playlists.** Manual and smart (`smart=1` with a filter uri) playlists were created. A playlist is owned by the account that made it (see section 9).

**Continue Watching and On Deck** (observed):

- `/hubs/continueWatching`, `/library/onDeck` and `/hubs/home/onDeck` list started films with their offset, plus the next Episode of a show whose last Episode was finished.
- After S1E1 was finished, **S1E2** appeared. After the S1E2-E3 file was finished, which marked both watched, **S1E4** appeared.
- The settings are "Weeks to consider for Continue Watching" (16), "Maximum number of Continue Watching items" (40) and "Include season premieres in Continue Watching" (on) (observed, documented in [Library settings](https://support.plex.tv/articles/200289526-library/)).
- An Episode with an offset showed in Continue Watching in its own right.

## 13. Webhooks, notifications and the event stream

**Webhooks.**

- Registered on plex.tv (`/api/v2/user/webhooks`), the server POSTs `multipart/form-data` with user agent `PlexMediaServer/<version>` and a JSON `payload` part (observed).
- Play-type events also carry a `thumb` JPEG part (observed).

**Events observed** once items were longer than 60 s:

| Event | When |
|---|---|
| `media.play` | First progress of a session. |
| `media.pause` | State paused. |
| `media.resume` | Playing again after a pause. |
| `media.stop` | Stopped. |
| `media.scrobble` | Crossing the played threshold. |
| `media.rate` | The managed user's rating. |
| `playback.started` | When the managed user played; for the owner, about another user. |
| `device.new` | A new client identifier. |
| `library.new` | Only once: when a deleted film was re-added. The first scans of three new libraries sent none. |

`library.on.deck`, `admin.database.backup` and `admin.database.corrupted` did not occur. Plex documents all 12 events and requires Plex Pass on the owner's account ([Webhooks](https://support.plex.tv/articles/115002267687-webhooks/)).

**Push notifications.**

- Push notifications are a server preference, off by default (`PushNotificationsEnabled`) (observed).
- Plex documents them as a Plex Pass feature covering "New Content Added to Library", "New Episode in Continue Watching", "Playback Started", "New Devices", "Database Corruption Detected" and "Database Backed Up" ([Push notifications](https://support.plex.tv/articles/push-notifications/)).
- They were not exercised, because they go to Plex's mobile apps.

**The event stream** (`/:/eventsource/notifications`, about 1,200 events, observed):

- **During scans.**
  - `activity` events (`library.update.section`, `library.refresh.items`, `library.update.item.metadata`, `media.generate.credits` and `media.generate.intros`, `provider.subscriptions.process`, each started, updated, ended).
  - A `status` "Scanning the … section" (`LIBRARY_UPDATE`).
  - `timeline` entries per item, moving through `metadataState` created, processing, loading, with numeric `state` 0, 1, 4, 5.
- **During file changes.** A deleted item announced `state` 9 with `metadataState` "deleted". A re-added item went through the same states as a new one.
- **During playback.**
  - `playing` (`PlaySessionStateNotification`: `sessionKey`, `clientIdentifier`, `ratingKey`, `viewOffset`, `state`, `playQueueID`, `transcodeSession`).
  - `transcodeSession.start` and `.end`, and `progress`.
- **Otherwise.** `preference` when a setting changes (with its new value), `account` (`hasPlexPass`), `reachability`, `backgroundProcessingQueue`, `update.statechange` and `ping` about every 10 s.

The WebSocket carries the same notifications (CC-287). It was not logged separately here.

## 14. The database, in words

All observed from a read-only copy of the library database:

- **Items.** One table holds every item: films, shows, seasons, Episodes, artists, albums, tracks, extras (type 12), playlists (15) and collections (18).
  - Each row carries its library, parent, type, `guid`, title and sort title, year, duration, summary, `edition_title`, a `hash`, a `metadata_agent_provider_group_id`, and timestamps including `deleted_at`.
  - An Edition is a separate item row. Its guid is the film's guid with `/edition/<title>` appended.
  - A film's Versions are not separate items.
- **Media.** One row per Version of an item, with its own duration, size, bitrate, container, codecs, frame rate, `deleted_at` and DVR `begins_at` and `ends_at`. Casablanca has two Media rows under one item.
- **Parts.** One row per file of a Media: `file`, `size`, `duration`, `hash`, `open_subtitle_hash`, `deleted_at`. The hash, file and size are indexed. A multi-episode file appears once per Episode, as separate Media and Part rows with the same path.
- **Streams.** One row per audio, video or subtitle stream of a Part.
- **Extras.** Item rows of type 12. Local extras use a `file://` guid, and online ones an Internet Video Archive guid. They link to their film through a relations table, whose relation type matches the extra's subtype (1 trailer, 2 deleted, 3 interview, 5 behind the scenes, 6 scene, 10 featurette, 11 short, 12 other).
- **Watch state.**
  - One row per **account and guid**: rating, `view_offset`, `view_count`, `last_viewed_at`, `skip_count`.
  - A history table logs each view with account, guid, titles, time and device.
  - Per-account choices for a Media or Part (selected audio and subtitle stream) sit in their own tables.
- **Tags.** Tags (genres, collections, people and more, typed by `tag_type`) and taggings join them to items. A cast tagging stores the **character as a text string** beside the person tag.
- **Providers.** Tables for metadata providers, provider groups and group items (with `order`).
- **Accounts.** A server-side accounts table includes managed users who have played.
- **Search.** FTS4 tables over titles and tags (plain and ICU), and spellfix tables.

## 15. Open questions for CC-292 (the inside view)

- **The Plex `hash` algorithm** on Part rows. It is not a plain SHA-1 or MD5 of the file or its ends. Plex sends it to providers at match.
- **Whether a move is matched by hash.** A renamed folder kept its item, a moved file did not. Does the scanner reuse an item on a hash match, and what decides between the two?
- **Why the library-wide "Collections" mode** did not change the server's list, while a collection's own mode did.
- **Why no NFO agent exists** on this 1.43.4 macOS build, when Plex documents one from 1.43.1. Is it a server feature flag?
- **Whether providers' losing values are kept** anywhere inside, such as cached responses.
- **What `library.new` waits for.** It fired once (on a re-add) and never on first scans.
- **The ignore rules.** The 60 s floor, and the "ignore" for a session that starts past the threshold, as coded.
- **The meaning of the numeric timeline `state` values** (0, 1, 4, 5, 9) and relation types beyond the extras.
- **Whether the hidden MusicBrainz provider** (agent type 2) is a contributor the music agent always consults.

## 16. Nothing of Plex's committed

This change adds this note only. Stub media, logs, the webhook and SSE captures, the provider stub and its log, and the database copies are in `/private/tmp/claude-501/cc-288-scratch/` and in no repository. Tokens were held in mode-600 files there and never printed.

**Server state afterwards.**

- Removed: the four CC-288 libraries (with their collections), the owner's two playlists, the provider group and the custom provider, and the webhook (list empty).
- `autoEmptyTrash` is back on.
- The managed user and its Home are gone, through the legacy delete in section 9: the account is again in no Home.
- **Left behind** (the server offers no call to remove them):
  - The managed user's server-side account row (`/accounts` lists it, and `DELETE /accounts/{id}` returned 404).
  - The playlist it created ("Managed PL"; the owner's `DELETE /playlists/{id}` returned 404).
  - The owner's watch-state rows for the stubs' guids, which by design outlive the deleted libraries.
- The CC-287 library and its items were not touched.

## Verdicts

- **0001, "Media files seed the Library, as in Plex and Jellyfin": confirmed.** Every stub file became an item from its name alone, matched online or not (observed).
- **0002, "matching Plex and Jellyfin for video, where a local NFO overrides online data": contradicted for Plex.** Plex's video agents ignore NFO (observed). NFO needs a separate agent (documented) that this server lacks.
- **0002, "Plex's music library is the exception…": contradicted as an exception.** True for music, but video works the same way (observed). See section 8.
- **0003, Plex Custom Metadata Providers ("enter the URL for the locally running provider"): confirmed.** Documented in the forum announcement, and observed working by URL.
- **0004, "Jellyfin and Plex keep only the winner": confirmed for Plex,** as far as the API shows (section 8).
- **0004, "Plex's current agents have no source ordering, only a per-field "Ratings Source"…": contradicted.**
  - Metadata Agents order providers.
  - Ratings Source is per library.
  - The legacy-hidden-since-1.43.0 part is confirmed.
- **0004, "Keep only the winning value, as Plex and Jellyfin do": confirmed for Plex,** as above.
- **0005, "an ordinary show like Friends looks exactly like Plex": confirmed as precedent.** Friends matched to Show, Season and Episode with online titles (observed).
- **0006, "Versions all represent the same release… Editions represent different releases": confirmed.** Plex's own words, matching the server's item and Media split.
- **0006, "playing any of the represented episodes will play the full file": confirmed.** Plex's own words, and observed. Plex also marks both Episodes watched when one finishes.
- **0010, "Server transcoding as the fallback every client leans on, as Plex…": confirmed** (section 11).
- **0011, "Plex … show their own picker": confirmed as documented** (fast user switching prompt). Not observed in an app.
- **0013, "Versions of one Edition share Progress while a different Edition has its own, as in Plex": confirmed** (observed, and documented for Editions).
- **0013, "Plex shares one offset in milliseconds (`viewOffset`) across the versions of an item": confirmed** (observed).
- **0013, "Plex's Rewind is platform-wide, not per user": confirmed as documented.** The 2025 Rewind is charts "Based on total minutes streamed" across Plex ([blog](https://www.plex.tv/blog/2025-plex-rewind/)). No per-user Rewind was found. Not a server feature.
- **0014, "Fetching per screen, as Plex and Jellyfin do": unsettled.** Nothing here observes a Plex client's fetching (CC-289).
- **0015, "neither Plex nor Emby documents its file hash": contradicted as worded, holds for the algorithm.** Plex documents that the hashes exist. One of them is the public OpenSubtitles hash, and the other's algorithm is unknown (section 2).
- **CC-2, "Plex renders the label as "S2 · E3"": unsettled.** It is client rendering, and no Plex source was found. For CC-289.
- **CC-2, Plex's three collection modes: confirmed** (observed, documented). Each collection can also override the mode.
- **CC-2, "Plex strips leading articles" (sort title): confirmed.** "The Godfather" sorts as "Godfather" (observed). The list is the hidden `ArticleStrings` setting, "removed in sort titles", default `the, das, der, a, an, el, la` ([hidden settings](https://support.plex.tv/articles/201105343-advanced-hidden-server-settings/)).
- **CC-2, Plex's suffix and `{edition-…}` naming: confirmed** (observed, documented).
- **CC-4, "Last-Admin precedent, unverified for Plex": now observed.** plex.tv refuses to remove the Home admin through the current API (403). The legacy call removes the admin only by dissolving the whole Home, deleting its managed users. Plex documents one admin per Home and no transfer.
- **CC-4, "owner-only edits, per-user playlists": confirmed.** A managed user cannot edit metadata or collections (403), and playlists are per account (observed).
- **CC-4, Plex has "no documented per-item favourite": confirmed for video and music items.** No favourite field or call was seen. The only Plex mention of hearts found is for photos (a 2017 blog post, [heart your photos](https://www.plex.tv/blog/heart-your-photos/), seen only through search results and not re-read), and per-item ratings (`/:/rate`) exist instead.
- **CC-7, Plex's music library prefers the online agent unless "Prefer local metadata" is on: confirmed** (observed). Genre and album art have their own settings.
- **CC-10, Custom Metadata Providers install by URL: confirmed.**
- **CC-10, Plex's default agent uses TMDB: partly confirmed.**
  - Plex Movie returns TMDB, IMDb and TVDB ids, the TV agent's default ordering is labelled "The Movie Database", and "The Movie Database" is a Ratings Source.
  - Plex does not document its agents' sources.
- **CC-13, Plex smart collections as precedent: confirmed.** A smart collection stores a filter and fills live (observed, documented).
- **CC-13, "Plex … keep the character as a string" (actor role): confirmed.** A `Role` has `tag` (person) and `role` (character text) in the API (documented in the reference, observed), and the database stores the character as text on the tagging.
- **CC-8, Plex webhooks and Plex push notifications as precedents: confirmed** (section 13). `library.new` fired less often than expected.
- **CC-266, Suggested Matches resting on `{tmdb-…}`: confirmed.** The hint overrode a wrong title (observed).
- **CC-266, Extras by suffix and by folder: confirmed.** All eight of each (observed).
- **CC-266, non-default Edition from the `{edition-…}` label: confirmed** (observed). Plex Pass is required by Plex's documentation.
- **Prototype snapshot, the Plex Extra suffix and folder table: confirmed.** The server titles suffix extras with the film's name and folder extras with their file name (observed).
- **Prototype snapshot, "as Plex and Jellyfin keep an Item watched while a rewatch is part way": confirmed for Plex** (observed).
- **Prototype snapshot, "The next Episode in Continue Watching, as Plex shows it": confirmed.** After an Episode finished, the next one appeared, and after a multi-episode file it skipped past both Episodes (observed).

**Not settled here:** the hash algorithm and move logic, the library-wide collection mode, the missing NFO agent, `library.new`'s trigger, the "S2 · E3" label, per-screen fetching, inviting a second account, push-notification delivery, and the profile picker in a real app (sections 9, 13 and 15).
