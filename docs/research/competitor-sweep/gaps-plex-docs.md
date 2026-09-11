# Plex feature sweep — complete inventory and CanonCore gaps

STATUS: complete

Sweep of Plex's documented feature surface against `prompt.md`.

**Access note.** `support.plex.tv` returns HTTP 403 to direct fetching. Primary sources used
instead, in order of reliability for the data model:

- python-plexapi reference docs (https://python-plexapi.readthedocs.io/) — wraps the real
  Plex HTTP API comprehensively, so it is the most faithful public description of Plex's
  actual object model.
- The unofficial Plex API wiki (https://github.com/Arcanemagus/plex-api/wiki).
- `https://r.jina.ai/<url>` as a text-extraction proxy for support.plex.tv articles.
- Plex forums, release notes and blog for feature announcements.

Every feature is rated against the CanonCore prompt:

- **ADOPTED** — the prompt does the same thing.
- **REFUSED** — the prompt explicitly rules it out (WHAT NOT TO BUILD / STANDING RULES).
- **DIVERGENT** — the prompt deliberately does something different.
- **ABSENT** — the prompt says nothing at all. Rated LOW / MEDIUM / HIGH for whether a
  self-hosted media catalogue genuinely needs it.

---

## 1. Libraries and library types

Source: https://python-plexapi.readthedocs.io/en/latest/modules/library.html

| Plex feature | What it is | CanonCore |
|---|---|---|
| `LibrarySection` typed by medium (`MovieSection` type=movie, `ShowSection` type=show, `MusicSection` type=artist, `PhotoSection` type=photo) | A library is a typed container; its type fixes which item classes and which agents/scanners are legal inside it | **DIVERGENT.** Prompt: "WHY never typed by medium: a Plex library is typed, and that is exactly what stops a container holding mixed media." Groups are untyped browsing scopes. |
| `LibrarySection.locations` / `addLocations()` / `removeLocations()` — a section has N filesystem roots | Multiple folders map into one library | **ADOPTED in spirit.** Prompt: groups scope "scanner roots". Not spelled out as multi-root, but implied. |
| `Library.sections()` / `sectionByID()` / `section(title)` | Sections addressed by id and by title | ABSENT (trivial). LOW. |
| `LibrarySection.uuid` | Every section carries a stable UUID distinct from its numeric id | **ABSENT.** MEDIUM — CanonCore has owner_id + surrogate ids everywhere but says nothing about a stable external identifier for a *group*; the alias table covers items only. |
| `LibrarySection.totalSize`, `totalDuration`, `totalStorage`, `totalViewSize(libtype, includeCollections)` | Per-library aggregate counts, runtime and bytes-on-disk | **ABSENT.** MEDIUM — every media manager shows "1,234 movies, 3.2 TB"; CanonCore's prompt never mentions library-level statistics of any kind. |
| `LibrarySection.refreshing` (bool) | A library exposes whether a scan is currently running | **ABSENT.** HIGH — see §Scanning below; the prompt has a scanner but no notion of scan state visible to the UI. |
| `LibrarySection.allowSync` | Per-library flag controlling whether shared users may download | ABSENT. LOW for CanonCore (single user, no sync — see §Sync). |
| `LibrarySection.language` | Per-library metadata language, drives agent queries | **ABSENT.** MEDIUM — CanonCore reaches all providers at once and never says what language it asks them in, or what happens when two providers answer in different languages. |
| `LibrarySection.filters` (bool) | Whether the section supports the filter UI | LOW. |
| `Library.tags(tag)` and the `LibraryMediaTag` hierarchy: `Genre`, `Collection`, `Director`, `Producer`, `Country`, `Chapter`, `Label`, `Marker`, `Make`, `Model`, `Aperture`, `Exposure`, `ISO`, `Lens`, `Device`, `Autotag`, `Mood`, `Format`, `Concert`, `Poster`, `Art`, `Guid`, `RatingImage`, `Review`, `Place`, `Network`, `MediaProcessingTarget` | Plex has ~25 hardcoded tag *classes*, each a first-class browsable entity with `count`, `id`, `key`, `thumb`, `items()` | **DIVERGENT.** CanonCore folds all of these into statements against a `properties` catalogue, which is strictly more general. Note Plex's tags are *browsable* (`tag.items()` → everything carrying it) — CanonCore's prompt never says a statement value is browsable back to its subjects. That reverse index is **ABSENT**, MEDIUM. |
| `LibrarySection.folders()` | Browse the library by its on-disk folder tree, alongside the metadata view | **ABSENT.** MEDIUM — a "browse by folder" escape hatch is how users find things the scanner mis-filed. CanonCore's scanner never writes storage, but nothing says the folder tree is *readable* as a view. |
| `LibrarySection.lockAllField(field, libtype)` / `unlockAllField()` | Bulk lock/unlock one metadata field across a whole library | **REFUSED.** Prompt: "No per-field lock flag. The favourite does that job." But note the *bulk* operation has no CanonCore analogue — see `multiEdit` below. |
| `LibrarySection.multiEdit(items, **kwargs)`, `batchMultiEdits(items)`, `saveMultiEdits()`, `common(items)` | Edit a metadata field across many selected items in one request; `common()` returns the fields all selected items agree on | **ABSENT.** HIGH — bulk edit is the single most-used curation affordance in every catalogue tool. CanonCore's statements model makes a bulk owner-authored statement natural, and the prompt never mentions selecting more than one item at a time. |
| `LibrarySection.edit(agent, **kwargs)`, `editAdvanced(**kwargs)`, `defaultAdvanced()` | Per-library advanced settings, with a documented "reset to defaults" | **ABSENT.** MEDIUM — a per-group settings surface at all. `defaultAdvanced()` (restore defaults) is the notable part. |
| `LibrarySection.settings()` | Enumerate the settings a library exposes, with types and defaults, as data | **ABSENT.** MEDIUM — Plex's settings are self-describing. CanonCore has a `properties` catalogue for item fields but nothing equivalent for its own configuration. |
| `LibrarySection.delete()` | Deleting a library | **ABSENT.** MEDIUM — CanonCore's DELETE section covers items and containers in detail and says nothing about deleting a *group*, which is the same "preview counts, what survives" problem one level up. |
| `LibrarySection.getWebURL(base, tab, key)` | Deep link into a client UI | LOW. |
| `Library.add()` | Creating a library, choosing type/agent/scanner/language at creation | ABSENT. LOW (creation of a group is trivial in CanonCore's model). |


### Access correction

`support.plex.tv` is **DNS-blocked by OpenDNS on this machine** (system resolver returns
`146.112.61.106`, the OpenDNS block page; Cloudflare DNS returns the real `104.18.36.51`).
That is why direct fetches and the Playwright browser both fail here with
`ERR_CERT_AUTHORITY_INVALID` / 403. `https://r.jina.ai/<url>` reaches the real articles and is
used as the primary source for support.plex.tv content below. Article content quoted is the
real article, not a block page.

---

## 2. Scanners and agents

Sources: <https://support.plex.tv/articles/200241548-scanners/> (via r.jina.ai),
<https://support.plex.tv/articles/200241558-agents/> (via r.jina.ai),
<https://forums.plex.tv/t/announcement-custom-metadata-providers/934384>,
<https://www.howtogeek.com/plex-is-overhauling-custom-metadata-providers/>

**The scanner/agent split.** Plex separates *identifying files* (scanner) from *fetching
metadata* (agent). Scanners shipped: Plex Movie, Plex Movie Scanner (Legacy), **Plex Video Files
Scanner** ("less strict", for home video, no internet metadata), Plex TV Series, Plex Series
Scanner (Legacy), Plex Music (directory + tags + **acoustic fingerprinting**), Plex Music Scanner
(Legacy), and one photo scanner. Agents shipped: Plex Movie / Plex Movie (Legacy) / TMDb (Legacy)
/ Personal Media (Legacy); Plex Series / TheTVDB (Legacy) / TMDb (Legacy) / Personal Media Shows;
Plex Music (AllMusic + MusicBrainz) / Last.fm (deprecated) / Personal Media Artists+Albums; one
photo agent. Server 1.43.0+ hides legacy agents when creating new libraries.

| Plex feature | What it is | CanonCore |
|---|---|---|
| **Scanner ≠ agent** — file identification and metadata enrichment are two separately-chosen components | You pick a scanner and an agent per library, independently | **ADOPTED implicitly.** CanonCore has a scanner and separately has providers. But the prompt never *names* the split or says the scanner produces a candidate identity that enrichment then matches. |
| **A "less strict" scanner for personal media** (Plex Video Files Scanner) with **no internet metadata at all** | An explicit mode for content that will never match an online source | **ABSENT.** MEDIUM — CanonCore's archive is largely unmatched-by-any-provider content. Nothing says what happens to a file no provider can identify, beyond "review queue". |
| **Acoustic fingerprinting** in the music scanner | Content-based identification, not filename-based | **ABSENT.** LOW — CanonCore is direct-play-only with a SHA1-of-chunks file identity, which is a *file* fingerprint not a *content* fingerprint. Not needed for v1. |
| **Agent priority list with fallback** — "if a piece of metadata isn't available from your first source, then the agent will fallback down the priority list" | First-non-empty-wins across ordered sources | **REFUSED / DIVERGENT.** Prompt: "A single primary source with others filling gaps is REFUSED... it merges first-non-empty-wins and DISCARDS the losing answers." CanonCore keeps all values with a source order deciding display. Note the prompt attributes this design to Jellyfin; **Plex does exactly the same thing**, which strengthens the argument. |
| **Local Media Assets** ranked first in the agent priority list | Local files/embedded tags beat online sources by default | **REFUSED.** Prompt: "no artwork uploads, no artwork scanning, no `.nfo` reading. The scanner takes media files and playback sidecars, and nothing else." |
| **"Agents don't retroactively update existing content when changed — only future additions are affected"** | Changing the agent does not re-enrich what is already there | **DIVERGENT (CanonCore better).** Prompt: "re-ordering the source list re-picks the whole catalogue at once." This is a genuine CanonCore advantage worth keeping visible. |
| **Per-agent preferences** (gear icon per source in the priority list) | Each source in the chain has its own settings | **ABSENT.** MEDIUM — CanonCore's providers take "a URL, a credential and a validated response shape". Provider-specific configuration (e.g. TMDB language, include-adult) has no home. Note Plex's *new* CMP system explicitly lists "provider-specific preferences" as **not yet working**, so Plex considers it necessary and hard. |
| **Custom Metadata Providers (announced 2025, beta in PMS 1.43.0, rollout January 2026, full agent replacement "sometime in 2026")** — "Developers are not restricted by any one language or technology to write these providers, essentially anything that can serve an HTTP API can be used." Deployed as a Docker container, a self-contained binary, or hosted online; the user adds a single URL. | Plex's replacement for plug-in agents: a plain HTTP contract | **ADOPTED — this is exactly CMPP.** The prompt's claim ("reopened in 2025 as a plain HTTP contract") is **confirmed**. CanonCore's design is the same shape and arrived independently. |
| **What Plex's new CMP contract still cannot do**, stated by Plex: music libraries, authenticated requests, stream metadata (subtitles), provider-specific preferences | The gaps in a real, shipping HTTP metadata contract | **Useful negative evidence.** CanonCore's contract must handle *authenticated* providers from day one (TMDB key) and *does* — the prompt is ahead of Plex here. "Stream metadata (subtitles)" — providers supplying subtitle tracks — is **ABSENT** from CanonCore, MEDIUM. |
| **A provider may be run as a container the user hosts** | The provider is infrastructure the user operates | **ADOPTED.** Prompt: "ONE service, run on a machine the owner controls." |


## 3. Editions and multiple Versions

Sources: <https://support.plex.tv/articles/multiple-editions/> (via r.jina.ai),
<https://support.plex.tv/articles/200381043-multi-version-movies/> (via r.jina.ai),
python-plexapi `Movie.editionTitle`, `Video.media`.

Plex has **two** distinct axes where CanonCore has one:

- **Edition** — "different releases of an item", e.g. theatrical vs director's cut, 2D vs 3D.
  Declared by a `{edition-Name}` filename token (`Blade Runner (1982) {edition-Director's Cut}.mp4`)
  **or** by hand in Plex Web 4.87.1+ via the item's edit dialog. Surfaces as `editionTitle`,
  a single free-text string on the item. **Movies only** — "Editions are supported only for movies."
- **Version** — the *same* release in different encodings: `1080p` vs `480p`, HEVC vs H.264,
  MP4 vs MKV. Declared by a ` - ArbitraryText` filename suffix. The suffix text is
  **not shown**; Plex displays the detected resolution instead. Both axes compose: several
  versions inside one edition.

| Plex feature | What it is | CanonCore |
|---|---|---|
| Edition = a different *release*; Version = a different *encoding* | Two-level split, both below the item | **DIVERGENT.** CanonCore has one `editions` level (BIBFRAME collapse) and puts encodings in `files`. Plex's split is the same distinction CanonCore draws between edition and file — no gap, and CanonCore's is cleaner because Plex's edition is a *string*, not a row. |
| `editionTitle` is **free text on the item**, not an entity | An edition has no id, no dates, no coverage, no own metadata | **DIVERGENT (CanonCore far better).** Confirms the prompt's claim: "Plex merges versions but its automatic pick is about what the client can decode, not about which is canonical". |
| **Editions are movies-only** | The mechanism does not exist for TV, music or books | **DIVERGENT.** CanonCore's editions are medium-agnostic (video/audio/text/image) and the Taylor Swift and Harry Potter demo groups depend on it. |
| **"Plex will automatically request and play the most suitable item by default"**; "not all Plex apps will allow you to manually choose which version to play" | The default pick is a client-capability decision, and some clients cannot override it | **DIVERGENT — confirmed.** Prompt's `is_default` pin + declared edition order is the fix. Also note the *second* half of that Plex sentence is a UI gap CanonCore should not repeat: the picker must exist on every client. |
| **Watch state is per-edition** in Plex too ("that item will not be included in syncing" once edition info is added; each edition tracks watched independently) | Editions do not share progress | **ADOPTED.** Prompt: "PER EDITION, not per item". Plex agrees. Good corroboration. |
| Splitting and merging matched items (`Split Apart` / `Match` / `Merge` in the UI) | Plex ships an explicit split/merge pair for wrongly-grouped items | **PARTIAL.** CanonCore has **merge** (loser becomes a permanent alias) but **no SPLIT**. **ABSENT — HIGH.** Every catalogue mis-groups two works as one; without split the only recovery is delete-and-reimport, and the alias table makes merge deliberately irreversible. Plex, Jellyfin, Calibre and MusicBrainz all ship split. |
| `Media` / `MediaPart` / `MediaPartStream` hierarchy under an item | One item → N media (versions) → N parts (discs/files) → N streams (video/audio/subtitle tracks) | **PARTIAL.** CanonCore's `files` table is flat with a role. **ABSENT — MEDIUM/HIGH:** the *part* level (one edition spanning several files in order) and the *stream* level (tracks inside one file) have no representation, so a two-disc film and an embedded-subtitle picker are both unmodelled. |

---

## 4. Collections and playlists

Sources: <https://python-plexapi.readthedocs.io/en/latest/modules/collection.html>,
<https://python-plexapi.readthedocs.io/en/latest/modules/playlist.html>

| Plex feature | What it is | CanonCore |
|---|---|---|
| **Manual vs smart collection**, and smart collections raise `BadRequest` on `addItems`/`removeItems`/`moveItem` | A collection is either hand-curated or rule-derived, never both | **ADOPTED, explicitly.** Prompt: "A container is EITHER hand-placed OR rule-derived; a rule-derived container carries NO order... This is the split Plex ships as manual versus smart collections, and its smart collections deliberately cannot be hand-ordered." **Confirmed by the API surface.** |
| `Collection.content` — the smart filter stored as a **filter URI string** | The rule is a serialised query | **ABSENT (mechanism).** MEDIUM — CanonCore says rule-derived containers exist but never says what a rule *is*, how it is stored, or what it can express. That is a whole unspecified subsystem. |
| `Collection.moveItem(item, after=None)` | Manual reordering by "put this after that", not by rewriting indices | **ABSENT (mechanism).** MEDIUM — CanonCore's `placements.position` is an integer with no uniqueness constraint; the prompt never says how a reorder is expressed or how positions are rebalanced. |
| `Collection.collectionSort` via `sortUpdate(sort)` — **"release" / "alpha" / "custom"** | A manual collection can *still* choose to display in release or alphabetical order instead of its hand order | **ABSENT.** MEDIUM — CanonCore ties ordering to the placement rows only. Plex lets one container be viewed in three orders without changing membership. |
| `Collection.collectionMode` via `modeUpdate(mode)` — **"default" / "hide" / "hideItems" / "showItems"** | Controls whether the collection, and/or its member items, appear in the library grid | **ABSENT — HIGH.** This is Plex's answer to "my browse grid is now full of both the collection and its 8 members". CanonCore's standing rule keeps *entities* out of work-browsing surfaces by kind, but says nothing about containers-vs-their-members. With 93.4% multi-placement the browse grid duplication problem is *worse* in CanonCore than in Plex. |
| `Collection.collectionPublished` | Whether the collection is pinned to the home screen | ABSENT. LOW (subset of the hubs gap, §7). |
| `Collection.collectionFilterBasedOnUser` / `filterUserUpdate(user)` | A smart collection can filter on *another user's* watch state | ABSENT. LOW — single-user product. |
| `Collection.subtype` — "movie, show, artist, or album" | A collection is homogeneous by media type | **DIVERGENT.** CanonCore containers are deliberately mixed-media. |
| `Collection.maxYear` / `minYear` / `childCount` | Derived aggregates on the container row | ABSENT. LOW. |
| **Collections are per-library and cross-library only by identical name** | Confirms the prompt's reason #4 | **Corroborates the prompt.** No action. |
| `Playlist` separate from `Collection`, with `playlistType` (audio/video/photo) and `smart` | Plex has *two* ordered-container concepts with near-identical APIs | **DIVERGENT (CanonCore better).** CanonCore has one: containers are items. Worth noting Plex's duplication is exactly the redundancy CanonCore's "containers fold into `work`" rule avoids. |
| `Playlist.create(... m3ufilepath=...)` — **import an m3u** | Bulk-create an ordering from a standard file format | **REFUSED-adjacent.** Prompt: "No fork, no export, no import." But m3u import is *ordering* import, not instance sync. **ABSENT — MEDIUM:** building a 200-position chronology by hand in a web UI is the most tedious thing in the product, and every ordering CanonCore cares about already exists as a list somewhere. |
| `Playlist.copyToUser()` | Duplicate a playlist into another account | ABSENT. LOW (single user). |
| `Playlist.duration` / `durationInSeconds` / `leafCount` | Aggregate runtime of an ordering | ABSENT. LOW — prompt explicitly refuses duration-weighting ("runtime is missing for most of any real catalogue"). |


## 5. Watch state, play history and PlayQueues

Sources: <https://python-plexapi.readthedocs.io/en/latest/modules/video.html>,
<https://python-plexapi.readthedocs.io/en/latest/modules/playqueue.html>,
<https://python-plexapi.readthedocs.io/en/latest/modules/server.html>

| Plex feature | What it is | CanonCore |
|---|---|---|
| `viewCount`, `viewOffset`, `lastViewedAt`, `skipCount` — a **mutable state row** per item per account | Watch state is a counter and a timestamp, not a log | **DIVERGENT (CanonCore better).** Prompt: "every media server surveyed keeps only a mutable state row... Plex's unscrobble zeroes the count. The event log is what makes re-watches real." Confirmed: the API exposes exactly these four scalars and no per-play rows on the item. |
| `PlexServer.history()` / `LibrarySection.history(maxresults, mindate)` / `MyPlexAccount.history()` and the `MovieHistory` / `EpisodeHistory` / `ClipHistory` classes | Plex **does** keep a separate append-only play-history table, queryable by account, section, date and ratingKey | **PARTIAL CORRECTION to the prompt.** The prompt says Plex keeps "only a mutable state row"; that is true of the *item's* watch fields but Plex additionally has a full play history. The prompt's underlying point still holds (the state row and the history are not reconciled, and unscrobble zeroes `viewCount` while history persists), but the flat claim overstates it. CanonCore's event log is still the better design. |
| `markPlayed()` / `markUnplayed()` / `isPlayed` | Explicit manual watch-state override | **ABSENT.** HIGH — CanonCore's progress is derived from append-only watch events. Nothing says how the owner asserts "I watched this years ago, before I owned this software", or "un-mark this". With an event log the answer is a synthetic event, but the prompt never says so, and a catalogue seeded from 11,285 archive stories needs bulk mark-watched on day one. |
| `updateProgress(timeOffset)` / `updateTimeline(...)` | Two separate progress-write paths: a simple offset write, and a full timeline ping carrying state/duration/playQueueItemID | **ADOPTED in part.** Prompt: "Save every 10 seconds". The *timeline* concept (a heartbeat carrying player state, not just an offset) is **ABSENT**, LOW. |
| `removeFromContinueWatching()` — on `Movie` and `Episode` | Per-item dismissal from Continue Watching | **REFUSED.** Prompt: "Continue Watching is computed, never stored. No time window, no dismissal." Note Plex added dismissal because users demanded it; the prompt's refusal is deliberate and reasoned. |
| `LibrarySection.onDeck()` vs `continueWatching()` — **two different hubs** | On Deck = next unwatched episode of a started show; Continue Watching = partially-played items | **ABSENT (the On Deck half).** MEDIUM — "next unwatched episode in an ordering I have started" is a different question from "resume this file", and in CanonCore it is *harder* because an item is in many orderings and "next" depends on which one. The prompt gives Continue Watching a rule and never mentions next-up at all. |
| `Show.onDeck()`, `Season.onDeck()`, `Show.watched()`, `Show.unwatched()` | Per-container next-up and watched/unwatched partitions | **ABSENT.** MEDIUM — same gap, at container level. |
| `Show.leafCount` / `viewedLeafCount` (stored) | Plex stores rollup counts on the container | **DIVERGENT.** Prompt: "Container progress is computed on read from the ancestor closure, deduped with COUNT(DISTINCT item), never stored." Deliberate. |
| `Show.autoDeletionItemPolicyUnwatched` / `autoDeletionItemPolicyWatched` | Auto-delete episodes after watching / after N unwatched accumulate | **REFUSED-adjacent.** CanonCore's scanner never writes storage; deleting media files is out of scope. LOW. |
| **PlayQueue** — a first-class server-side object (`playQueueID`, `playQueueVersion`, `playQueueSelectedItemID`, `playQueueSelectedItemOffset`, `playQueueShuffled`, `playQueueLastAddedItemID`, `playQueueSourceURI`, `playQueueTotalCount`), with `create(shuffle, repeat, continuous)`, `addItem` (to "Up Next"), `moveItem`, `removeItem`, `clear`, `refresh` | The "what plays next" construct, distinct from a playlist: transient, versioned, server-held so any client can take it over | **ABSENT — HIGH.** CanonCore has no concept of a play session at all. "Play this container from position 4 and keep going" needs *somewhere* to live, and CanonCore's multi-placement makes it worse: the queue must remember **which container you were playing through**, and the prompt explicitly says the container "is navigation state carried alongside the address, never encoded in it". Nothing says where that state lives once playback starts. `playQueueSourceURI` is exactly the field Plex uses for this. |
| `PlayQueue.create(continuous=True)` — auto-advance loads the next episodes | Auto-play next | **PARTIALLY REFUSED.** Prompt: Continue Watching "is offered, never auto-played." That is about *resuming*, not about advancing within a session; auto-advance is **ABSENT**, MEDIUM. |
| `PlexServer.sessions()`, `PlexSession`, `transcodeSessions()` | Live view of what is playing right now, on which device, by whom | **ABSENT.** LOW for single-user, MEDIUM once multi-user arrives. |
| `MyPlexAccount.viewStateSync` / `enableViewStateSync()` | Watch state syncs to plex.tv across servers | **REFUSED.** "No cross-instance sharing." |
| `Video.userRating` (0.0–10.0), `lastRatedAt`, plus `rating`, `audienceRating`, `ratings` (list of `Rating` objects with type and image) | Plex separates owner rating, critic rating and audience rating, and stores a *list* of ratings each with a provenance image | **PARTIAL.** CanonCore's statements table handles multi-valued ratings with provenance natively and better. But **the owner's own rating** is not in the seed property list ("category, portrayed_by, appears_in, based_on, created_by, released, part_of, image") — **ABSENT**, MEDIUM. A personal catalogue without a personal rating is an odd omission. |

---

## 6. Sharing, Plex Home and managed users

Sources: <https://support.plex.tv/articles/203948776-managed-users/> (via r.jina.ai),
<https://python-plexapi.readthedocs.io/en/latest/modules/myplex.html>

CanonCore is explicitly single-user ("owners — ONE row. Single user, one password, no signup,
no multi-tenancy, no RLS"), with `owner_id` on every table so multi-user is "a later migration
rather than a rewrite", and "No visibility system... Add it when multi-user arrives". So most of
this section is **deliberately deferred rather than absent**. The value here is in what the
deferral will have to cover, and in the two or three places Plex's design would force a *schema*
decision that has to be made now.

| Plex feature | What it is | CanonCore |
|---|---|---|
| **Friends** (own Plex account, own server) vs **Home / managed users** (no email, no password, cannot sign in independently, switch from an authenticated Home member) | Two distinct account kinds with different identity requirements | **DEFERRED.** Note the managed-user shape — a profile with no credential — is the one that would matter first for a household catalogue, and it is the one that *does* need `owner_id` to point at something that is not a login. |
| `MyPlexServerShare` with `allLibraries` / `numLibraries` / `sections()` | Sharing is granted **per library**, not per item | **This is the decision `groups` will have to carry.** Prompt: groups are "a BROWSING SCOPE, not a wall" and "Groups never partition". When multi-user arrives, per-group sharing is the obvious mechanism and the prompt has pre-emptively said groups are not walls. **The tension is unresolved and unmentioned — MEDIUM/HIGH for the multi-user migration.** |
| `filterMovies` / `filterTelevision` / `filterMusic` — restrict a share by **content rating or label** | Sharing filtered by a metadata value, not by an explicit list | **ABSENT.** MEDIUM (post-multi-user). In CanonCore this would be "share everything matching this rule", i.e. the same rule engine as smart containers (§4) — another reason the rule format needs specifying. |
| `allowSync`, `allowCameraUpload`, `allowChannels`, `allowSubtitleAdmin` | Per-share capability flags | LOW / REFUSED (no sync, no uploads). |
| `restricted`, `home`, `protected` on `MyPlexUser`; `setPin()`, `removePin()`, `setManagedUserPin()` | A PIN gates user switching | ABSENT. LOW now. |
| `MyPlexPinLogin` / `MyPlexJWTLogin` (ED25519 keypair, token refresh) / `createToken(type, scope)` | Device-code login for TV apps, and scoped temporary tokens | **ABSENT — HIGH.** The prompt commits to a **native Swift TV app**. Typing a password on a TV remote is the standard failure, and every comparable product ships a device-code / PIN pairing flow. The prompt says "one password, no signup" and nothing about how a TV authenticates. This is a first-version-adjacent gap that the auth design must not preclude. |
| `MyPlexAccount.ping()` (refresh token), `signout()` (invalidate) | Session lifetime and revocation | **ABSENT.** MEDIUM — "a single-password cookie session" is named in the prompt as the seam; nothing says how long it lives or how it is revoked. |
| `MyPlexAccount.devices()` / `MyPlexDevice.delete()` | Enumerate and revoke the devices holding a token | **ABSENT.** MEDIUM — with a TV app and a phone app, "log this device out" is a real requirement. |
| `MyPlexResource` / `ResourceConnection` (local address, public address, **relay**) and server discovery | How a client finds the server on LAN or over the internet | **ABSENT — HIGH.** See §Remote access below. Three clients (web, phone, TV) and nothing in the prompt says how the phone finds the server. |
| `optOut()` / `onlineMediaSources()` / `AccountOptOut` | Turn off Plex's own online catalogue mixed into your library | **REFUSED implicitly.** CanonCore has no vendor catalogue to opt out of. Worth noting as an anti-pattern CanonCore avoids by construction. |
| `MyPlexAccount.watchlist()` / `addToWatchlist()` / `onWatchlist()` | A want-to-watch list independent of owned files | **ABSENT.** MEDIUM — CanonCore's items are media-independent, which makes a watchlist almost free (an owner-authored statement or a container), and it is the single most-requested feature in this category. Not needed for v1. |


## 7. Sync and Downloads

Source: <https://python-plexapi.readthedocs.io/en/latest/modules/sync.html>

Plex's sync model: a **SyncItem** binds a server + a client device + a `Policy` + a
`MediaSettings`; a **SyncList** is one client's aggregate sync state across servers; **Status**
carries `itemsCount`, `itemsCompleteCount`, `itemsDownloadedCount`, `itemsReadyCount`,
`itemsSuccessfulCount`, `totalSize`, `state` (completed/pending/empty) and failure info.
`Policy` = `scope` ("count" | "all") + `value` (n) + `unwatched` (bool).
`MediaSettings` = `videoQuality` (0–100), `videoResolution` (WxH), `videoBitrate`,
`audioBoost`, `musicBitrate`, `photoQuality` (0–100), `photoResolution`, `subtitleSize`,
`videoDeviceProfile`.

| Plex feature | What it is | CanonCore |
|---|---|---|
| Sync transcodes to a device profile | Downloads are re-encoded for the target | **REFUSED.** "Direct play only. No transcoding, no ffmpeg, no quality ladders." |
| **Offline download of the original file** (Plex's "Downloads" as distinct from Sync) | Take a file with you without re-encoding | **ABSENT.** MEDIUM — direct-play-only makes this trivial (it is a byte copy) and it is the one sync feature that survives the no-transcoding rule. The prompt refuses transcoding, not offline access. |
| `Policy(scope="count", value=n, unwatched=True)` — "keep the next 3 unwatched episodes" | A standing rule that maintains a local set | ABSENT. LOW. |
| `Status` with per-item counts and a failure count | A long-running background job with observable progress and per-item failure | **ABSENT — HIGH, generalised.** Not sync specifically: **CanonCore has no job/progress model at all.** Scanning, enrichment against all providers, artwork fetch + palette extraction, and projection rebuild are all long-running background work, and the prompt describes each behaviour without ever saying there is a jobs table, a progress surface, or a per-item failure record. `PlexServer.activities` and `LibrarySection.refreshing` are Plex's version. |

---

## 8. Webhooks and notifications

Sources: <https://support.plex.tv/articles/115002267687-webhooks/> (via r.jina.ai),
`PlexServer.startAlertListener` in <https://python-plexapi.readthedocs.io/en/latest/modules/server.html>

Plex webhooks are **Plex Pass only**, configured **per user** in account settings (they travel
with the user across servers, not per server). Events:

- `library.on.deck` — item added to On Deck (payload includes poster)
- `library.new` — new item added to a library the user can see (poster)
- `media.play`, `media.pause`, `media.resume`, `media.stop`
- `media.scrobble` — fired past the 90% mark
- `media.rate` — item rated
- Server-owner only: `admin.database.backup` (scheduled backup completed),
  `admin.database.corrupted`, `device.new`, `playback.started`

Payload has five sections: event/user/owner flags, account, server, player, and full media
metadata.

Separately, `PlexServer.startAlertListener(callback, callbackError)` opens a **websocket**
carrying live server notifications — media scan progress, transcode updates, activity.

| Plex feature | What it is | CanonCore |
|---|---|---|
| Outbound HTTP webhooks on a fixed event vocabulary | Fire-and-forget POST to a user URL on library and playback events | **ABSENT — MEDIUM/HIGH.** The whole *arr / Tautulli / notification ecosystem hangs off this hook. CanonCore has a change sequence on every table (the hard half) and says nothing about emitting it. Note the Safe External Fetch boundary in the prompt covers *outbound fetches to user-supplied URLs* and would apply directly. |
| `admin.database.corrupted` as a first-class event | The server tells you its database is broken | **ABSENT — HIGH.** See §10. |
| `media.scrobble` at 90% | A "finished" event distinct from "stopped" | **DIVERGENT.** Prompt: completion is time-remaining under a small absolute figure, not a percentage, "because a six-hour release at 90% still has thirty-six minutes to run". Plex's 90% is precisely the design the prompt rejects — good corroboration. |
| Websocket live notifications (`startAlertListener`) | Push, not poll, for scan progress and activity | **ABSENT.** MEDIUM — a Next.js UI showing scan/enrichment progress needs either polling or a stream, and the prompt specifies neither. |


## 9. Library scanning: scan vs refresh, triggers, trash

Sources: <https://support.plex.tv/articles/200289306-scanning-vs-refreshing-a-library/>,
<https://support.plex.tv/articles/200289526-library/>,
<https://support.plex.tv/articles/200289326-emptying-library-trash/> (all via r.jina.ai)

**Plex's central distinction**, which CanonCore's prompt never draws:

- **Scan Library Files** = "check for new or changed content and get metadata for it if needed".
  Run it after adding/deleting files, adding/removing folders, renaming, or moving files.
- **Refresh Metadata** = "update metadata for the requested item even if it already has some".
  Run it after changing agent options, adding local assets, or when a poster is broken.
  "Refresh All Metadata" is a Refresh applied to a whole library, and "can take a lot of time".

Refresh is scoped: a whole library, a single item, a TV series (which also partial-scans its
directory if `Run a partial scan when changes are detected` is on), or an artist/album.

**Triggers.** `Scan my library automatically` (filesystem change notification — "Some operating
systems don't provide this trigger and content mounted via a network will also typically not
work"); `Scan my library periodically` with `Library scan interval` ∈ {15 min, 30 min, hourly,
2h, 6h, 12h, daily}, measured from server start; `Update all libraries during maintenance`
(disabled by default); and manual.

**Trash.** "If you move or delete the file for a library item or if the file somehow becomes
unavailable, then the library item will be placed into the 'trash'." The item stays, marked with
an indicator over its poster, until Empty Trash. "If an item is currently in the trash, it can be
restored back to the Library by making the file for the library item available again at the
expected location." `Empty trash automatically after every scan` is a per-server setting; Empty
Trash can also be run per-library or server-wide. Explicit rationale: it "can be particularly
helpful in situations where a drive or network share where content is stored isn't available
when a Library Update occurs."

| Plex feature | What it is | CanonCore |
|---|---|---|
| **Scan vs Refresh as two distinct verbs** | "find new files" and "re-ask the sources" are separate, differently-scoped operations | **ABSENT — HIGH.** CanonCore has a scanner and has enrichment, and never says they are separate operations with separate triggers and separate scopes. Without the distinction, "I changed the source order, re-pick everything" and "I added 40 files" collapse into one button. The prompt *does* promise "re-ordering the source list re-picks the whole catalogue at once", which is exactly Refresh All — and it has no name, no trigger and no scope in the document. |
| **Refresh scoped to one item / one series / one library** | The user chooses how much to re-ask | **ABSENT — HIGH.** Same gap, and the scoping matters more in CanonCore because enrichment fans out to *all* connected providers and TMDB is rate-limited. |
| `Scan my library automatically` + the network-share caveat | FS notifications, with the documented failure | **ADOPTED, verbatim.** Prompt: "DO NOT ASSUME FILESYSTEM CHANGE NOTIFICATIONS FIRE. Plex's own documentation says content mounted over a network 'will typically not work'... Support explicit periodic scans." **Confirmed** — quote located in the Library settings article. |
| `Library scan interval` — a **fixed enum** of intervals, from server start | Periodic scanning is configured, not cron | **ABSENT (detail).** LOW — but note Plex deliberately offers an enum rather than a cron expression. |
| `Run a partial scan when changes are detected` | Scan only the changed folder, not the whole root | **ABSENT.** MEDIUM — with a large archive a full rescan is expensive; Plex ships incremental scanning as an advanced option. |
| **Trash: a missing file marks the item, it does not delete it, and restoring the file restores the item** | Absence of a file is a *state*, not a deletion | **ABSENT — HIGH.** CanonCore items are media-independent, so an item with a vanished file is not a crisis the way it is in Plex — but the *file* row still has to go somewhere, and the prompt's DELETE section covers only deliberate deletion. Nothing says what happens when a scan finds a file gone: silently drop the row (losing the edition's only evidence), keep it and lie about availability, or mark it missing. An unmounted drive would otherwise destroy the catalogue's file layer on one scan. This is the single clearest ABSENT+HIGH in the scanner half. |
| `Empty trash automatically after every scan` | Whether the destructive step is automatic | **ABSENT.** Follows from the above. |
| `Allow media deletion` (off by default; owner only; deletes the actual file) | Deleting from the catalogue optionally deletes from disk | **REFUSED, consistently.** "The scanner NEVER writes storage." CanonCore's delete removes catalogue rows only. Worth stating explicitly somewhere, because Plex, Jellyfin and Emby all offer file deletion and users will expect it. |

---

## 10. Scheduled tasks, maintenance and backup

Sources: <https://support.plex.tv/articles/201553286-scheduled-tasks/> (last modified 31 July 2025),
<https://support.plex.tv/articles/201539237-backing-up-plex-media-server-data/>,
`PlexServer.butlerTasks()` / `runButlerTask()` in python-plexapi.

Plex's full scheduled-task surface, verbatim labels and stated defaults:

- **Schedule time** — start/end hour for background maintenance, local to the server.
  **Defaults to 3am–6am.**
- **Backup database every three days** — copies the core SQL database "if it is not already
  corrupted". "**Up to three backup copies will be kept in a rotating manner.**" Warned as *not*
  a substitute for a real backup.
- **Optimize database every week** — "ensures the database is running as quickly as possible.
  Especially after lots of additions or deletions."
- **Remove old bundles every week** — deletes metadata/artwork bundles for items no longer in
  the library (bundles are retained after removal so an item can be restored).
- **Remove old cache files every week** — cleans image-processor cache files older than a month.
- **Refresh local metadata every three days** — picks up new local subtitle/cover files.
  "This setting does *not* download new metadata for your content."
- **Update all libraries during maintenance** — *(disabled by default.)*
- **Upgrade media analysis during maintenance** — re-run analysis when Plex fixes an analysis bug.
- **Refresh metadata periodically** — over a month, re-refresh music artists and TV shows;
  "currently only occurs for music and TV libraries".
- **Perform extensive media analysis during maintenance** — bitrate analysis for bandwidth control.
- **Fetch missing location names for items in photo sections.**
- Advanced: **Backup directory** — "Plex Media Server will not create the directory automatically."
- Caveat: "tasks which occur every three days or every week may not occur for the first time
  until a few days after scheduling is enabled."

Backups: back up the whole PMS data directory; Windows also needs
`HKEY_CURRENT_USER\Software\Plex, Inc.\Plex Media Server`, macOS also needs
`com.plexapp.plexmediaserver.plist`, Linux/NAS keeps everything in `preferences.xml`.
Restore = put the data directory back and reinstall. Explicit warning not to put the backup
archive inside the data directory, "If PMS sees an unknown file or directory it could
potentially delete it".

| Plex feature | What it is | CanonCore |
|---|---|---|
| **A maintenance window** (default 3am–6am) that all heavy work runs inside | Expensive background work is time-boxed to when nobody is watching | **ABSENT — HIGH.** CanonCore has at least four expensive background processes (scan, enrichment across all providers, artwork fetch + palette extraction, wholesale projection rebuild) and no scheduling concept whatsoever. Palette extraction across thousands of images and a full projection rebuild are exactly the work Plex learned to confine to a window. |
| **Automatic database backup, rotating, N kept** | The server protects its own database on a schedule | **ABSENT — HIGH.** CanonCore is Postgres with an append-only statements table, a migration ladder and a rebuildable projection — i.e. the *authoritative* data is small and the derived data is large, which is the ideal backup shape. The prompt never mentions backup, restore, or what a user does after a disk failure. For a self-hosted product this is table stakes, and it is the one gap where getting it wrong loses the user's data permanently. |
| **"if it is not already corrupted"** — Plex checks integrity before overwriting the backup | A corrupt backup is worse than none | ABSENT (detail). MEDIUM — the failure mode is real. |
| **`admin.database.corrupted` webhook + a documented restore procedure** | Corruption is detected, announced, and recoverable by documented steps | **ABSENT — HIGH.** Pairs with the above. |
| **Optimize database weekly** (VACUUM/ANALYZE equivalent) | Routine storage maintenance | **ABSENT.** MEDIUM — Postgres autovacuum covers most of it, but an append-only event log plus a wholesale-rebuilt projection will bloat, and the prompt's own FACTS section warns "Production EAV ALWAYS grows a denormalised read side... OpenMRS let its observation table reach 27 million rows". |
| **Remove old bundles / remove old cache files** — GC for derived artefacts | Derived data is cleaned up on a schedule | **ABSENT.** MEDIUM — CanonCore caches provider artwork and the prompt sets a **six-month TMDB cache rule** it must honour. Nothing says what enforces expiry. That is a licence obligation, not a nicety. |
| **Tombstoned rows and old projection revisions accumulate** | — | The prompt mandates "Timestamps, tombstones and a change sequence on every table" and never says anything is ever reaped. **ABSENT**, MEDIUM. |
| `butlerTasks()` / `runButlerTask(task)` — every scheduled task is also **runnable on demand** | The user is never stuck waiting for the window | **ABSENT.** MEDIUM. |
| **Settings are self-describing** (`Setting.id/label/summary/type/default/value/hidden/advanced/group/enumValues`), grouped into General / Scheduled Tasks / Channels / DLNA / Extras / Library / Network / Transcoder / Misc, with a normal/advanced split | The server's own configuration is data with types, defaults and a visibility tier | **ABSENT — MEDIUM/HIGH.** CanonCore has *no configuration surface described at all*, yet it needs: provider credentials, the source order, the edition order, the two matching thresholds ("Both numbers tunable"), the completion threshold, the 10-second save interval, scanner roots, and the demo's read-only mode. The prompt names these values individually and never says where they live or how they are edited. The **normal/advanced split** is the specific idea worth stealing. |


## 11. Artwork and other visual resources

Sources: <https://python-plexapi.readthedocs.io/en/latest/modules/mixins.html>,
<https://python-plexapi.readthedocs.io/en/latest/modules/media.html>

Plex has **five** resource kinds per item, each with an identical five-method surface:
`posters()` / `arts()` / `logos()` / `squareArts()` / `themes()`, plus `upload*`, `set*`,
`delete*`, `lock*`, `unlock*`. Each resource is a `BaseResource` with
`key`, `provider` (`'local'` or `None`), `ratingKey`, `selected`, `thumb`.

| Plex feature | What it is | CanonCore |
|---|---|---|
| Five roles: poster, art (backdrop), **logo**, **squareArt**, **theme** | More roles than CanonCore's four | **PARTIAL.** CanonCore has `poster` / `backdrop` / `title-logo` / `still`. `squareArt` (music) and `theme` (a video/audio file, not an image) are **ABSENT** — LOW each, but `theme` shows a "resource" can be a *media file*, which CanonCore's artwork table cannot hold. |
| **`selected`** — the chosen resource among several candidates, per role | Plex keeps *all* provider candidates and marks one selected | **ABSENT — MEDIUM/HIGH.** CanonCore's artwork table has role + licence + attribution + palette and **no chosen-one flag and no ordering**. This is the exact problem the prompt solves for statements (`rank` = the favourite = the lock) and for editions (`is_default`) and does *not* solve for artwork, even though artwork is the field users most want to override. Given the prompt's own principle — "one pattern used twice, not two patterns" — this looks like an oversight rather than a decision. |
| `uploadPoster()` / `deletePoster()` | Artwork can be uploaded and deleted | **REFUSED.** "No artwork uploads, no artwork scanning, no `.nfo`." Note this makes the missing `selected` flag *more* important, not less: if the owner cannot upload, choosing among provider candidates is their only control. |
| `lockPoster()` / `unlockPoster()` per resource role | An artwork choice survives a refresh | **ABSENT.** Follows from the above. |
| `provider` = `'local'` or `None` on each resource | Provenance per artwork asset | **ADOPTED and extended.** CanonCore stores licence + attribution + palette per asset, which is more than Plex. |
| `Video.ultraBlurColors` and `thumbBlurHash` / `artBlurHash` | Plex extracts a colour treatment and a blurhash placeholder from artwork | **ADOPTED (palette).** Corroborates the prompt's palette rule: Plex derives colour per-asset too. `blurHash` (a low-res placeholder for progressive loading) is **ABSENT**, LOW. |

---

## 12. Subtitles, audio tracks and the stream level

Sources: <https://python-plexapi.readthedocs.io/en/latest/modules/media.html>,
<https://support.plex.tv/articles/200471133-adding-local-subtitles-to-your-media/> (via r.jina.ai),
`Video.searchSubtitles/uploadSubtitles/downloadSubtitles/removeSubtitles` in the video module.

Plex's hierarchy is **item → Media (version) → MediaPart (file) → MediaPartStream (track)**.
`SubtitleStream` carries `forced`, `hearingImpaired`, `canAutoSync`, `format`, `container`,
`providerTitle`, `perfectMatch`, `score`. `AudioStream` carries `audioChannelLayout`, `channels`,
`visualImpaired`, plus loudness fields. Every stream has `default`, `selected`, `index`,
`language`, `languageCode`, `languageTag`, `title`, `displayTitle`, `extendedDisplayTitle`.
`MediaPart.setSelectedAudioStream()` / `setSelectedSubtitleStream()` /
`resetSelectedSubtitleStream()` persist the choice.

| Plex feature | What it is | CanonCore |
|---|---|---|
| **The stream level exists at all** — tracks *inside* a file are first-class rows | You can list, name, select and remember one of eight audio tracks | **ABSENT — HIGH.** CanonCore's `files` table has role `media / subtitle / audio / chapters` with a sidecar reference and a language. That models **external** sidecars only. An MKV with three audio tracks and six subtitle tracks — the normal case for the direct-play-only library the prompt targets — has **no representation**, so no track picker can be built. Direct-play-only makes this *more* important, not less: track selection is the only playback control left. |
| `forced`, `hearingImpaired`, `visualImpaired`, `default`, `title` on a track | Subtitle/audio semantics beyond language | **ABSENT — MEDIUM/HIGH.** Language alone cannot distinguish "English", "English (forced)" and "English SDH", and a viewer picking blind gets signs-only subtitles for the whole film. |
| **A remembered per-user track preference** (`setSelectedAudioStream`, and `Show.audioLanguage` / `subtitleLanguage` / `subtitleMode` on the container) | "Always Japanese audio with English subs for this show" | **ABSENT — MEDIUM.** A per-container playback preference. |
| `searchSubtitles(language, hearingImpaired, forced)` / `downloadSubtitles()` — **fetch subtitles from an online source** | Subtitles as a provider-supplied asset | **ABSENT — MEDIUM.** Note Plex's *new* CMP contract explicitly lists "metadata for streams (subtitles)" as not yet supported, so Plex considers this part of the metadata-provider contract. CanonCore's CMPP has no notion of a provider returning a file. |
| `uploadSubtitles()` / `removeSubtitles()` | Sideload a subtitle without touching the media folder | **ABSENT.** LOW–MEDIUM; sits against "the scanner NEVER writes storage". |
| `canAutoSync` + voice-activity analysis to resync subtitles | Automatic subtitle timing correction | ABSENT. LOW. |

---

## 13. The per-item metadata editing surface: match, unmatch, split, merge, locks

Source: <https://python-plexapi.readthedocs.io/en/latest/modules/mixins.html>

Plex exposes, per item: `matches(agent, title, year, language)` → candidate `SearchResult`s;
`fixMatch(searchResult, auto, agent)` to rebind; `unmatch()` to strip the match entirely;
`split()` to separate wrongly-merged items; `merge(ratingKeys)` to combine them; and a
**per-field lock** on every editable field (`editTitle(title, locked=True)`,
`lockArt()`, `Field(name, locked)`).

| Plex feature | What it is | CanonCore |
|---|---|---|
| **`matches()` then `fixMatch()`** — list candidates, pick one, rebind | Matching is a separate, re-runnable, human-driven operation from applying | **ADOPTED.** Prompt: "Matching... and applying... are SEPARATE OPERATIONS WITH SEPARATE ENDPOINTS." Plex's UI is the same shape; CanonCore puts it in the contract, which is stronger. |
| **`unmatch()`** — return an item to unmatched with no provider identity | Undo a match without deleting the item | **ABSENT — MEDIUM/HIGH.** CanonCore remembers *rejections* ("REJECTIONS ARE REMEMBERED") but never says how an accepted-and-wrong match is undone. Statements would have to be retracted per-provider, and the prompt's statements table is append-only-ish with no retraction verb described. |
| **`split()`** | Separate an item that was wrongly merged | **ABSENT — HIGH.** Restated from §3 because it is the highest-value single gap: CanonCore's merge is explicitly permanent ("the loser becomes a PERMANENT ALIAS and stays resolvable forever"), so a mis-merge is unrecoverable. Plex, Jellyfin, Calibre and MusicBrainz all ship split. |
| **Per-field `locked` flag**, set implicitly by *any* hand edit (`locked=True` is the default on every `edit*` method) | Touching a field pins it against future refreshes | **REFUSED, and CanonCore's reason is better.** "THE FAVOURITE IS THE LOCK." But note the *ergonomic* point Plex gets right: editing a field locks it **without a second gesture**. CanonCore must make setting a value and preferring it one action, or the owner will hand-edit and be overwritten. Not stated in the prompt — **ABSENT (interaction rule)**, MEDIUM. |
| The sheer size of the editable field surface — ~14 scalar `edit*Mixin`s and ~11 tag mixins | Everything a user can change has a named, addressable operation | **ADOPTED by construction** (statements + properties catalogue). CanonCore's model is strictly better here; no gap. |
| `AdvancedSettingsMixin` **on an item** — `preferences()`, `editAdvanced()`, `defaultAdvanced()` (this is where `showOrdering`, `flattenSeasons`, `episodeSort`, `languageOverride`, `useOriginalTitle`, `enableCreditsMarkerGeneration` live) | Per-item overrides of library-wide behaviour | **DIVERGENT / corroborating.** `Show.showOrdering` is per-*show* in Plex, not per-library — which **partially contradicts the prompt's claim** that "Plex's episode ordering is ONE GLOBAL SETTING PER LIBRARY". See §Corrections below. |
| `Marker` (`type`, `start`, `end`, `final`, `first`) and `Chapter` (`tag`, `title`, `start`, `end`, `index`, `thumb`) | Intra-item time structure: intro/credits/ad markers and chapter lists | **PARTIAL.** CanonCore has a file role `chapters` and nothing else. **ABSENT — MEDIUM:** markers and chapters as *rows* rather than a sidecar file, which is what a skip-intro button or a chapter list needs. Also note `Chapter` is the natural place for CanonCore's *part* boundaries in a serial, which `edition_coverage` intervals reference numerically with no anchor in the file. |
| `Guid` — external ids (`imdb://`, `tmdb://`, `tvdb://`, `mbid://`) as a **list** on the item, plus `LibrarySection.getGuid(guid)` lookup | External ids are multi-valued and reverse-indexed | **ADOPTED.** Prompt: identifiers are statements with a scheme, "Shared identifiers then become MATCHING SIGNALS between providers." The **reverse lookup by identifier** (`getGuid`) is the operation that makes them matching signals; it is implied but never named. LOW. |


## 14. Hubs, recommendations and discovery

Sources: `Hub` and `ManagedHub` in
<https://github.com/pkkid/python-plexapi/blob/master/plexapi/library.py>,
<https://python-plexapi.readthedocs.io/en/latest/modules/library.html>

A **Hub** is a titled, styled row of items: `context`, `hubIdentifier`, `hubKey`, `key`, `title`,
`type`, `style`, `size`, `more` (whether there is a "see all"), `random`, `items()`, `section()`.
Hubs exist at three levels: `Library.hubs()` (server home), `LibrarySection.hubs()`
(library recommended page), and `item.hubs()` (related rows on an item page).

A **ManagedHub** is a hub the owner has promoted and can order and hide:
`identifier`, `title`, `deletable`, `promotedToOwnHome`, `promotedToSharedHome`,
`promotedToRecommended`, **`homeVisibility` ∈ {none, all, admin, shared}**,
`recommendationsVisibility` ∈ {none, all}, plus `move(after=...)`, `remove()`,
`updateVisibility(recommended, home, shared)`, and
`LibrarySection.resetManagedHubs()`.

| Plex feature | What it is | CanonCore |
|---|---|---|
| **A home screen made of ordered, named rows** rather than a single grid | Discovery is a curated list of queries, not one list | **ABSENT — HIGH.** The prompt's stop condition is "a rendered page in a browser" showing one item in two orderings, and it says "No shelf type... those are decided when screens exist." So the *concept* is deferred by name ("shelf") — but everything that would feed a home screen (recently added, continue watching, "also appears in") is specified piecemeal with no surface that assembles them. This is the biggest first-screen design question and the prompt hands it over unowned. |
| `ManagedHub.move(after=...)` and `updateVisibility()` — **the owner reorders and hides the rows** | Home-screen layout is user data, not a hardcoded template | **ABSENT — MEDIUM.** |
| `homeVisibility` ∈ none / all / **admin** / **shared** — a row can be visible only to the owner | Per-row audience | Deferred with the visibility system. LOW now. |
| `resetManagedHubs()` | Restore the default home layout | ABSENT. LOW. |
| `item.hubs()` — related rows on an item page ("more like this", "from the same director") | Item-page discovery, computed | **ABSENT.** MEDIUM — CanonCore's "Also appears in" is one such row and is specified in detail; nothing else is. With a statements model, "other items with this `created_by`" is nearly free and is the strongest thing CanonCore could show that Plex cannot. |
| `Video.similar` / `Show.similar` | Provider-supplied similarity | ABSENT. LOW. |
| `Library.recentlyAdded()` / `LibrarySection.recentlyAdded(maxresults, libtype)` | The default first row | **ABSENT (as a named surface).** The prompt mentions "latest" once, only to say entity containers must not turn up in it. MEDIUM. |
| `LibrarySection.hubSearch()` / `PlexServer.search()` — one query, results **grouped by type** into hubs, with spell-checking | Search returns typed groups, not a flat list | **ABSENT — MEDIUM/HIGH.** CanonCore's items table holds works, people, characters, places, time-spans, organisations and containers all at once, and its standing rule is that entities must be excluded from work-browsing surfaces *by kind*. Search is the one surface where you *do* want all eight kinds — grouped. Nothing in the prompt says how search results are shaped. |
| `Library.onDeck()` at server level | Cross-library continue watching | See §5. |

---

## 15. Filters, sorting and search

Source: `FilteringType`, `FilteringFilter`, `FilteringSort`, `FilteringField`,
`FilteringFieldType`, `FilteringOperator`, `FilterChoice` in
<https://github.com/pkkid/python-plexapi/blob/master/plexapi/library.py>;
<https://python-plexapi.readthedocs.io/en/latest/modules/library.html>

Plex's filter system is **self-describing metadata served by the server**, not hardcoded in the
client. `LibrarySection.filterTypes()` → per libtype: available `filters`, `sorts`, `fields`.
`listOperators(fieldType)` → the operators legal for a field's type. `listFilterChoices(field)` →
the actual values present. A `FilteringSort` carries `key`, `title`, `defaultDirection`,
`descKey`, `activeDirection`, and **`firstCharacterKey`** — an endpoint powering the A–Z jump bar
(`LibrarySection.firstCharacter()`).

Operators: no-operator (`is`/`contains`), `!` (is not / does not contain), `>>`, `<<`, `=`, `!=`,
`<`, `>`, `&`. Filters include `actor`, `addedAt`, `audioLanguage`, `collection`, `contentRating`,
`country`, `decade`, `director`, **`duplicate`**, `genre`, `hdr`, `inProgress`, `label`,
`lastViewedAt`, `mood`, `producer`, `resolution`, `studio`, `style`, `subtitleLanguage`,
**`unmatched`**, `unwatched`, `userRating`, `writer`, `year`. Advanced filters are **and/or
trees** of nested dictionaries.

| Plex feature | What it is | CanonCore |
|---|---|---|
| **The filter/sort vocabulary is served by the server, per type, with operators derived from field datatype** | Clients discover what they can filter on | **ABSENT — HIGH, and it is nearly free for CanonCore.** The `properties` table already holds datatype, value-kind, cardinality and validation — exactly the input this needs. The prompt calls `properties` "THE LOAD-BEARING TABLE" and never once says it drives a filter UI. Three clients (web, phone, TV) against a user-extensible-by-product field set makes a hardcoded filter list untenable. |
| **Boolean and/or filter trees** | Filters compose, not just AND | **ABSENT.** MEDIUM — and this is also the missing rule format for rule-derived containers (§4), so one design answers both. |
| `listFilterChoices(field)` — only the values actually present | Filter menus show real values with counts | **ABSENT.** MEDIUM. |
| `firstCharacterKey` / `firstCharacter()` — the A–Z jump bar | Navigating 11,285 items without scrolling | **ABSENT.** MEDIUM — the archive is 11,285 stories; paging and alphabet-jump are not optional at that size. The prompt says nothing about pagination anywhere. |
| `defaultDirection` per sort | Each sort knows its sensible direction (title asc, addedAt desc) | ABSENT. LOW. |
| **`titleSort` / `sortTitle` as a distinct field** | "The Matrix" sorts under M | **ADOPTED.** `sort_name` is a column in CanonCore. |
| Filter `duplicate` | Find items with several versions | **REFUSED (terminology).** Standing rule: "Never 'duplicate'. Two files with the same content are a REDUNDANT FILE." |
| Filter `unmatched` | Find items no agent could identify | **ABSENT — MEDIUM/HIGH.** CanonCore has a review queue for the *uncertain* band and discards below the low bar. "Show me everything no provider matched" is a different and necessary view; without it, unmatched items are invisible. |
| Filter `inProgress`, `unwatched` | Filter by watch state | ABSENT. LOW–MEDIUM. |
| `MediaContainer` with `offset`, `size`, `totalSize` — **every list response is paginated** | Server-side paging is in the wire format | **ABSENT — HIGH.** The prompt specifies a read projection, an ancestor closure and a 4.5-million-edge stress dataset, and never mentions pagination, cursors or result limits in the API contract. Retrofitting paging into an oRPC contract consumed by three clients is expensive. |


## 16. Media optimisation and transcoding

Sources: <https://python-plexapi.readthedocs.io/en/latest/modules/media.html>,
<https://python-plexapi.readthedocs.io/en/latest/modules/server.html>,
setting ids `transcodeCountLimit`, `wanPerStreamMaxUploadRate` and the "Transcoder Settings"
group in <https://python-plexapi.readthedocs.io/en/latest/modules/settings.html>

Plex has two separate things: **live transcoding** (`TranscodeSession` with `videoDecision` /
`audioDecision` / `subtitleDecision` ∈ transcode/copy/directplay, `throttled`, `speed`,
`progress`, `transcodeHwDecoding`/`Encoding`/`FullPipeline`/`Requested`), and **optimisation**
(`Video.optimize()`, `PlexServer.optimizedItems()`, `conversions()`,
`currentBackgroundProcess()`) — pre-generating a second file at a target profile, held in a
reorderable queue (`Conversion.move()`, `Optimized.reprocess()/rename()/remove()`).

| Plex feature | What it is | CanonCore |
|---|---|---|
| Live transcoding | — | **REFUSED.** "Direct play only. No transcoding, no ffmpeg, no quality ladders." |
| Optimised versions as a queue of background jobs | — | **REFUSED.** Same rule. |
| `videoDecision` / `audioDecision` / `subtitleDecision` reported per stream | The server tells you *why* it is transcoding, per track | **The idea worth keeping.** The prompt says "When a file will not play, say so plainly." Plex's per-track decision field is the shape of that message, and it needs the stream-level rows CanonCore does not have (§12). Reinforces the stream-level gap. |
| Bandwidth/quality limits (`transcodeCountLimit`, `wanPerStreamMaxUploadRate`) | — | REFUSED / N/A. |
| `TranscodeSession.throttled` | Background work backs off under load | **ABSENT (generalised).** MEDIUM — CanonCore's palette extraction, scanning and enrichment all compete with playback; nothing says any of it yields. |

---

## 17. Live TV and DVR

Source: <https://support.plex.tv/articles/225877347-live-tv-dvr/> (via r.jina.ai)

Requires a tuner and (for recording) a Plex Pass. Setup wizard: discover tuner on the network or
enter its address manually → pick signal type, country and postal code → channel scan →
**map scanned channels to EPG channels, and uncheck channels to exclude**. Plus recording
scheduling, commercial detection ("Generate ad video markers"), and an EPG lineup.

| Plex feature | What it is | CanonCore |
|---|---|---|
| Live TV, tuners, EPG, recording | Broadcast capture and scheduling | **Out of scope — effectively REFUSED by construction.** CanonCore's sources are references, never captures; nothing in the prompt suggests broadcast. No gap. |
| **Channel-to-lineup mapping with an uncheck-to-exclude list** | A manual reconciliation step between what the device found and what the catalogue thinks exists | **The transferable idea.** This is the same shape as CanonCore's review queue, applied to *bulk import* rather than per-item matching: import 500 rows from a provider's `browse`, show them mapped against existing items, let the owner uncheck. The prompt specifies `browse` returning "a container AND its ordering, so browsing a range yields placements for free" and never says the result is reviewed before it lands. **ABSENT — MEDIUM/HIGH:** a bulk-import preview/reconciliation step. |
| "Generate ad video markers" | Detect commercials in recordings | N/A. |

---

## 18. Watch Together

Source: <https://support.plex.tv/articles/watch-together/> (via r.jina.ai)

Synchronised playback across friends: a lobby, ready-checks, and shared transport control
("any member of the session can pause/start playback as well as skip or scrub within the
playback timeline. Doing so will adjust playback for all members"). Requires an existing friend
relationship and, for personal media, that the content is already shared.

**Plex is retiring it.** Dated note on the article, **2025-02-25**: "As we debut our new Plex
experience, we are ending support for some features we've grown to love, like Watch Together.
While this feature won't be available for most platforms as they get the new experience, you can
continue using the feature in our web app for the foreseeable future."

| Plex feature | What it is | CanonCore |
|---|---|---|
| Synchronised group playback | — | **ABSENT — LOW.** Single-user product, and Plex itself is withdrawing it after ~5 years. Useful as evidence that this class of feature does not pay for itself. |

---

## 19. Remote access, networking and server identity

Sources: <https://support.plex.tv/articles/200289506-remote-access/> (via r.jina.ai),
`MyPlexResource` / `ResourceConnection` / `PlexServer.identity()` / `claim()` / `unclaim()` /
`createToken()` in python-plexapi.

Plex: server signs in to a Plex account (required for remote access); tries **UPnP / NAT-PMP**
automatically; falls back to a manually specified public port forwarded to internal `32400`;
plex.tv brokers discovery, publishing a set of `ResourceConnection`s (local address, public
address, **relay**) that a client tries in order; `claim()` binds a server to an account with a
short-lived claim token; `identity()` exposes a machine identifier.

| Plex feature | What it is | CanonCore |
|---|---|---|
| **A discovery broker so clients find the server without the user typing an IP** | plex.tv holds the server's addresses; clients ask it | **ABSENT — HIGH.** CanonCore ships a phone app and a TV app and has no central service by design ("no cross-instance sharing"). So the user must type a URL on a TV remote, or CanonCore must do LAN discovery (mDNS/Bonjour). Neither is mentioned. This is the concrete blocker on the phone-then-TV client plan. |
| **Relay** — a fallback tunnel when no port is open | Works behind CGNAT | **ABSENT — MEDIUM.** Requires a hosted service CanonCore has deliberately refused. Worth stating as a known limitation ("document reverse proxy / Tailscale", the same posture the prompt takes on cloud storage: "Document rclone and mergerfs... rather than implementing any cloud integration"). |
| UPnP / NAT-PMP auto port forwarding | — | **ABSENT.** LOW–MEDIUM; usually delegated to a reverse proxy now. |
| A stable **machine identifier** for the server | Clients recognise a server across address changes | **ABSENT.** MEDIUM — the phone app needs to distinguish "same server, new IP" from "different server". |
| Certificate / HTTPS handling for a self-hosted server | Plex ships a wildcard-signed cert per server (`*.<hash>.plex.direct`) | **ABSENT — MEDIUM/HIGH.** The prompt mandates "HTTPS only" for the Safe External Fetch boundary but says nothing about how the *server itself* is served over TLS to a phone on a LAN. A native app talking to plain HTTP on a LAN is an App Transport Security problem on iOS specifically. |

---

## 20. Logging, diagnostics and troubleshooting

Source: <https://support.plex.tv/articles/200250417-plex-media-server-log-files/> (via r.jina.ai),
`PlexServer.downloadLogs()` / `downloadDatabases()` / `activities` / `bandwidth()` /
`resources()` in python-plexapi.

Plex: several log types in a per-platform `Logs` directory; **Settings > Manage >
Troubleshooting > Download Logs** produces a zip in one click, explicitly so it can be attached
to a forum post; `logDebug` is a server setting; plugin logs live separately in `PMS Plugin Logs`
and are deliberately excluded from the zip. `downloadDatabases()` exports the database.
Dashboard statistics: `bandwidth(timespan, ...)` and `resources()` (CPU/memory over time).

| Plex feature | What it is | CanonCore |
|---|---|---|
| **One-click "download logs" bundle for bug reports** | The support path is a first-class product feature | **ABSENT — MEDIUM/HIGH.** CanonCore is self-hosted software other people will run and file issues about. Without this every bug report is a conversation about how to find logs on six platforms. Cheap to build, and it is the single feature that most reduces support cost. |
| A `logDebug` toggle in settings | Verbose logging switchable at runtime, not restart | **ABSENT.** MEDIUM. |
| `downloadDatabases()` | Export the database for diagnosis | ABSENT. LOW (pairs with backup, §10). |
| `PlexServer.activities` | What the server is doing right now, as data | **ABSENT — HIGH** (restated: this is the jobs/progress gap from §7). |
| `bandwidth()` / `resources()` dashboard history | Historical resource use | ABSENT. LOW. |
| Logs are excluded from the bundle for third-party code | A boundary between server logs and plugin logs | N/A — CanonCore runs no third-party code in-process by design. |


## 21. Upgrade and migration

Sources: <https://support.plex.tv/articles/201370363-move-an-install-to-another-system/>,
<https://support.plex.tv/articles/202915258-where-is-the-plex-media-server-data-directory-located/>
(both via r.jina.ai); `PlexServer.isLatest()` / `canInstallUpdate()` / `checkForUpdate(force,
download)` / `installUpdate()` in python-plexapi.

Plex's documented move procedure: install on the destination → **sign out of the account** and
stop the server there → stop the server on the source → copy the whole data directory (tip: tar
it; the `Cache` directory can be excluded) → copy the platform-specific extras (Windows registry
key, macOS plist; Linux/NAS need nothing extra) → replace the destination's files → reboot
(**necessary** on macOS Yosemite+ because plists are held in memory) → start, sign in, and fix
the library paths. In-place updates: `checkForUpdate()`, `canInstallUpdate()`, `installUpdate()`,
with a release-channel setting.

| Plex feature | What it is | CanonCore |
|---|---|---|
| **A documented move-to-another-machine procedure** | Self-hosted software must survive a hardware change | **ABSENT — MEDIUM/HIGH.** CanonCore is Postgres + a filesystem path + provider credentials; the move is `pg_dump` plus a config file, but *nobody knows that unless it is written down and tested*. The prompt has a whole section on what exists outside the repo and nothing on how an instance moves. |
| **Library paths must be re-pointed after a move** | The catalogue references absolute paths that changed | **PARTLY ADOPTED.** Prompt: "PATH IS LOCATION, NOT IDENTITY, so a moved file is the same file." CanonCore's content-hash identity solves the file-level half. **ABSENT:** the *root* level — nothing says a group's scanner roots can be rewritten in bulk, which is what a move actually needs. MEDIUM. |
| `isLatest()` / `checkForUpdate()` / `installUpdate()` and a release channel | The server knows and can apply its own updates | **ABSENT.** LOW–MEDIUM for a Docker-distributed product, but "am I running the latest?" is a real question. |
| **Migrations must apply forward cleanly across versions** | Upgrading N versions at once must work | **ADOPTED, strongly.** Prompt: "MIGRATIONS ARE AN ORDERED, FORWARD-APPLICABLE LADDER FROM THE FIRST COMMIT... a released version can always migrate forward." Better than Plex, which has no public statement on this. |
| **A migration is never tested against real data before it runs** | — | **ABSENT.** MEDIUM — the prompt mandates the ladder and never mentions taking a backup before applying one. Pairs with §10. |

---

## 22. Labels and sharing restrictions

Sources: <https://support.plex.tv/articles/201105738-creating-and-managing-server-shares/>
(via r.jina.ai), `LabelMixin` in python-plexapi.

Plex's `Label` is an owner-authored, free-text tag with **no provider involvement**, and its
purpose is load-bearing: a share can be restricted to, or from, specific labels, and a managed
user's access can be filtered by label. So a label is simultaneously a curation tag and an ACL
primitive.

| Plex feature | What it is | CanonCore |
|---|---|---|
| A dedicated owner-only tag type distinct from provider-supplied genres | The owner's own vocabulary is not mixed with the sources' | **DIVERGENT (CanonCore better).** "No tag table. A tag is an owner-authored `category` statement, which gets provenance for free." The Owner is a first-class source, so the distinction falls out of provenance instead of needing a separate table. |
| **Labels used as an access-control primitive** | Sharing filters on a metadata value | Deferred with multi-user (§6). Worth flagging that when it arrives, the natural CanonCore answer is "share everything matching this rule" — the same rule engine as smart containers and as filters (§4, §15). **Three separate features want one rule format, and the prompt specifies none of them.** |
| Share invitation flow: invite by username/email, non-users can create an account on accept, an "accept" link you can pass out of band, a pending-invites list | The share is a two-party handshake with its own states | Deferred. LOW now. |
| Removing library access ≠ removing friendship | Two independent relations | Deferred. LOW. |

---

## 23. Corrections to claims the CanonCore prompt makes about Plex

The prompt says the reasons it carries are the whole record, so it matters where one is
overstated. Three found:

1. **"Plex's episode ordering is ONE GLOBAL SETTING PER LIBRARY"** — *inaccurate as stated.*
   `showOrdering` is a **per-show** attribute in the Plex API
   ([`plexapi/video.py` L576, L623](https://github.com/pkkid/python-plexapi/blob/master/plexapi/video.py):
   `showOrdering (str): Setting that indicates the episode ordering for the show`), exposed
   through the show's Advanced settings, with the library setting acting as the default.
   Likewise `episodeSort` and `flattenSeasons` are per-show.
   **The substance of the argument survives and should be restated rather than dropped:** a show
   has exactly *one* active ordering at a time. You cannot view Firefly in aired order and
   production order simultaneously, and switching re-matches the library rather than adding a
   second view. That is the real contrast with placements, and it is a stronger claim than the
   one in the prompt because it is about simultaneity rather than scope.

2. **"every media server surveyed keeps only a mutable state row"** — *overstated for Plex.*
   Plex keeps the mutable fields (`viewCount`, `viewOffset`, `lastViewedAt`, `skipCount`) **and**
   a separate play-history table, exposed as `PlexServer.history()`,
   `LibrarySection.history(maxresults, mindate)`, `MyPlexAccount.history()` and the
   `MovieHistory` / `EpisodeHistory` / `ClipHistory` classes
   (<https://python-plexapi.readthedocs.io/en/latest/modules/server.html>).
   The prompt's *conclusion* still holds — the two are not reconciled, unscrobble zeroes the
   counter while history persists, and the state row is what every read goes through — but
   "only a mutable state row" is not accurate for Plex.

3. **"Plex opened plug-ins, closed them in 2018 at under 2% usage, stranded the ecosystem for
   seven years, then reopened in 2025 as a plain HTTP contract"** — *confirmed, with dates worth
   tightening.* The replacement is called **Custom Metadata Providers**, announced on the Plex
   forum and covered 2025; it is in beta in **PMS 1.43.0**, with rollout stated as **January
   2026** and full replacement of agents "sometime in 2026"
   (<https://www.howtogeek.com/plex-is-overhauling-custom-metadata-providers/>,
   <https://forums.plex.tv/t/announcement-custom-metadata-providers/934384>). So at the time of
   writing agents are **not yet replaced**, and the new contract still cannot do music,
   authenticated requests, stream metadata or provider preferences. CanonCore's CMPP handling
   authenticated providers from day one is ahead of Plex, not level with it.

Not a correction, but worth recording as **corroboration**: the prompt attributes
first-non-empty-wins merging to Jellyfin. **Plex does the same thing** — "If a piece of metadata
isn't available from your first source, then the agent will fallback down the priority list"
(<https://support.plex.tv/articles/200241558-agents/>). The refusal is therefore a refusal of the
whole category's default design, not of one product's mistake.


---

# GAPS — ABSENT FROM CANONCORE

Everything the CanonCore prompt says **nothing at all** about, that Plex has a position on,
rated MEDIUM or above. Ordered by how expensive it is to discover late.

## HIGH — the prompt's own decisions create these, and they are cheap now and expensive later

| # | Gap | Why it is HIGH | §|
|---|---|---|---|
| H1 | **What happens when a scan finds a file gone.** Plex marks the item, keeps it, and restores it if the file comes back (Trash); `MediaPart.exists` / `accessible` are explicit attributes. | The prompt's DELETE section covers deliberate deletion only. An unmounted drive or a renamed folder currently has three possible behaviours and no chosen one, and the wrong choice destroys the file layer on a single scan. Content-hash identity solves *moves*, not *absence*. | 9 |
| H2 | **Backup and restore.** Plex backs up its database every three days, keeps three rotating copies, checks integrity first, has a documented restore, and emits `admin.database.corrupted`. | Self-hosted software whose users lose data has no recovery story. CanonCore's shape is ideal for this (small authoritative core, large rebuildable projection) and the prompt never mentions backup, restore, or corruption once. | 10 |
| H3 | **Split — undoing a merge or a wrong match.** Plex ships `split()`, `unmatch()` and `fixMatch()`. | CanonCore's merge is deliberately irreversible ("the loser becomes a PERMANENT ALIAS... forever"). With no split, one mis-merge is permanent. Plex, Jellyfin, Calibre and MusicBrainz all ship it. | 3, 13 |
| H4 | **A job / background-work model with observable progress and per-item failures.** Plex: `PlexServer.activities`, `LibrarySection.refreshing`, sync `Status` with per-item counts, `TranscodeSession.throttled`. | CanonCore has at least five long-running processes (scan, fan-out enrichment across all providers, artwork fetch, palette extraction, wholesale projection rebuild) and no jobs table, no progress surface, no failure record and no back-pressure. Every one of its background behaviours is specified without saying where the work lives. | 7, 10, 20 |
| H5 | **A maintenance window.** Plex confines heavy work to a configurable window, default 3am–6am. | Palette extraction across thousands of images and a wholesale projection rebuild are exactly the work Plex learned to time-box. Nothing in the prompt schedules anything. | 10 |
| H6 | **Scan vs Refresh as two distinct, differently-scoped verbs.** "Check for new files" and "re-ask the sources even for things that already have answers" are separate operations in Plex, each scoped to an item, a series or a whole library. | The prompt promises "re-ordering the source list re-picks the whole catalogue at once" — that *is* Refresh All — and gives it no name, no trigger and no scope. Enrichment fans out to all providers and TMDB is rate-limited, so scoping is not cosmetic. | 9 |
| H7 | **The stream level: audio and subtitle tracks inside a file.** Plex models item → Media → MediaPart → MediaPartStream, with `forced`, `hearingImpaired`, `default`, `title`, `language` per track and a persisted selection. | CanonCore's `files` table models external sidecars only. An MKV with three audio and six subtitle tracks — the normal case for a direct-play library — has no representation, so no track picker can exist. Direct-play-only makes track selection the *only* playback control left. | 12 |
| H8 | **A play session / PlayQueue.** Plex's PlayQueue is a first-class server-side object with a version, a selected item, an offset, an Up Next region and a `playQueueSourceURI`. | CanonCore has no concept of "playing through" anything. Multi-placement makes it worse: the queue must remember *which container* you are traversing, and the prompt explicitly forbids encoding that in the URL while never saying where else it lives. | 5 |
| H9 | **Pagination in the API contract.** Every Plex list response carries `offset`, `size`, `totalSize`. | An 11,285-item stress dataset with a 4.5M-edge graph, and an oRPC contract consumed by three clients. Retrofitting cursors across a shared contract package is the expensive kind of change. | 15 |
| H10 | **A server-driven filter and sort vocabulary.** Plex serves `filterTypes()`, `listSorts()`, `listFields()`, `listOperators(fieldType)`, `listFilterChoices(field)` as data, derived from field datatypes. | CanonCore already has the input: the `properties` table holds datatype, value-kind, cardinality and validation, and the prompt calls it "THE LOAD-BEARING TABLE". It never says that table drives a filter UI. With a product-extensible field set and three clients, a hardcoded filter list cannot work. | 15 |
| H11 | **Bulk edit / multi-select.** `multiEdit(items, **kwargs)`, `batchMultiEdits`, `saveMultiEdits`, `common(items)`, `lockAllField`. | The most-used curation affordance in every catalogue tool. Seeding 11,285 archive stories and then correcting them one at a time is not viable, and the statements model makes bulk owner-authored statements natural. The prompt never mentions selecting more than one item. | 1 |
| H12 | **What the home screen is made of.** Plex composes named, ordered, individually-hideable rows (`Hub` / `ManagedHub` with `move()` and `updateVisibility()`). | The prompt defers "shelf type" by name, then specifies every ingredient (recently added, continue watching, also-appears-in) with no surface that assembles them. The stop condition is "a rendered page", so this is the first screen, not a later one. | 14 |
| H13 | **How a TV app authenticates.** Plex ships PIN/device-code login (`MyPlexPinLogin`, `MyPlexJWTLogin`, `createToken(type, scope)`). | The prompt commits to a native Swift TV app and to "one password, no signup". Typing a password on a TV remote is the standard failure of this category, and the auth design must not preclude a pairing flow. | 6 |
| H14 | **How a phone or TV finds the server.** Plex brokers discovery through plex.tv, publishing local, public and relay connections, plus a stable machine identifier. | CanonCore has no central service by design, so either the user types a URL on a TV remote or CanonCore does LAN discovery (mDNS). Neither is mentioned, and it is the concrete blocker on the phone-then-TV plan. | 19 |
| H15 | **Asserting watch state by hand.** `markPlayed()` / `markUnplayed()` / `isPlayed`. | Progress is derived from append-only events, so "I watched this before I owned this software" and "un-mark this" have no verb. A catalogue seeded from an existing archive needs bulk mark-watched on day one. | 5 |
| H16 | **Container-versus-member visibility in browse surfaces.** `collectionMode` ∈ default / hide / hideItems / showItems. | The prompt keeps *entities* out of browse by kind and says nothing about containers and their members both appearing. At 93.4% multi-placement the grid-duplication problem is worse in CanonCore than in Plex. | 4 |
| H17 | **Detecting and reporting that the database is broken.** Plex checks integrity before backing up and emits `admin.database.corrupted`. | Pairs with H2; a backup taken over a corrupt database is worse than no backup. | 10 |

## MEDIUM/HIGH

| # | Gap | Why | § |
|---|---|---|---|
| M1 | **One rule format, wanted by three features.** Smart-container membership, the filter UI, and (at multi-user) share restrictions all need a serialisable boolean predicate over statements. Plex has one (`content` filter URIs, and/or trees). | The prompt names rule-derived containers as a core concept and never says what a rule *is*, how it is stored, or what it can express. Deciding it once serves all three. | 4, 15, 22 |
| M2 | **Artwork has no chosen-one flag and no ordering.** Plex keeps every candidate per role and marks one `selected`, per role, lockable. | CanonCore solves exactly this for statements (`rank`) and editions (`is_default`) and not for artwork — the field users most want to override, and where uploads are refused so choosing among candidates is the owner's only control. Against the prompt's own "one pattern used twice, not two patterns". | 11 |
| M3 | **`unmatch` — retracting an accepted-but-wrong match.** | Rejections are remembered; *acceptances* have no undo. Statements from that provider would have to be retracted, and the prompt describes no retraction verb. | 13 |
| M4 | **A one-click log bundle.** Plex: Settings > Manage > Troubleshooting > Download Logs, explicitly for attaching to a bug report. | Self-hosted software collects bug reports from strangers. Cheapest possible reduction in support cost; nothing in the prompt mentions logging at all. | 20 |
| M5 | **A configuration surface.** Plex settings are self-describing data (`id/label/summary/type/default/value/hidden/advanced/group/enumValues`) with a normal/advanced split. | CanonCore needs a home for provider credentials, the source order, the edition order, the two matching thresholds ("Both numbers tunable"), the completion threshold, the save interval, scanner roots and demo read-only mode. The prompt names every one of those values and never says where they live. | 10 |
| M6 | **Bulk-import preview and reconciliation.** Plex's DVR channel-mapping screen is the pattern: show what was found, mapped against what exists, uncheck to exclude. | The prompt says `browse` "yields placements for free" and never says the result is reviewed before landing. Importing a 500-row range unreviewed is how a catalogue gets wrecked. | 17 |
| M7 | **Search result shaping.** Plex's `hubSearch` returns results grouped by type. | CanonCore's items table holds eight kinds at once and its standing rule excludes entities from work-browsing *by kind* — but search is the one surface where all eight belong, grouped. Nothing says how results are shaped. | 14 |
| M8 | **An `unmatched` view.** Plex ships it as a filter. | The review queue covers the uncertain band; below the low bar values are "discarded". "Show me everything no provider could identify" is a different question and currently has no answer. | 15 |
| M9 | **Outbound events / webhooks.** Plex fires 12 named events to a user URL. | CanonCore already has the hard half (a change sequence on every table) and never says it is emitted. The Safe External Fetch boundary applies directly. The whole automation ecosystem in this category hangs off this hook. | 8 |
| M10 | **Multi-part media: one edition spanning several files, in order.** Plex's `MediaPart` level. | A two-disc film, a 30-file audiobook, a serial split across files. `files` is flat with no ordering and no "these N files are one thing to play". Progress across parts is undefined. | 3 |
| M11 | **Reverse lookup from a value to its subjects.** Every Plex tag is browsable: `tag.items()`. | "Everything created_by this person" is the strongest thing a statements model can do that Plex cannot, and it is never stated as a requirement, so it may not be indexed for. | 1 |
| M12 | **TLS for LAN clients.** Plex issues each server a signed `*.plex.direct` certificate. | "HTTPS only" in the prompt governs *outbound* fetches. A native iOS app talking to plain HTTP on a LAN is an App Transport Security problem. | 19 |
| M13 | **Moving an instance to another machine, and re-pointing scanner roots in bulk.** | Content-hash identity solves moved *files*; it does not solve a changed *root*. Nothing documents the move. | 21 |
| M14 | **Subtitle/audio track semantics beyond language** (`forced`, `hearingImpaired`, `default`, free-text title). | Language alone cannot distinguish English, English (forced) and English SDH; picking blind gives signs-only subtitles for a whole film. | 12 |

## MEDIUM

| Gap | § |
|---|---|
| Editing a field should pin it in one gesture, not two (Plex's `locked=True` default on every edit) — otherwise the owner hand-edits and gets overwritten | 13 |
| Per-provider configuration (Plex's per-agent preferences; Plex's own new CMP contract lists this as missing) | 2 |
| Markers and chapters as rows, not a sidecar file — also the natural anchor for `edition_coverage` part boundaries | 13 |
| Provider-supplied subtitle files (`searchSubtitles` / `downloadSubtitles`); Plex treats this as part of the metadata contract | 12 |
| Deleting a *group*, with the same preview-what-survives treatment items get | 1 |
| Per-library aggregate statistics (`totalSize`, `totalDuration`, `totalStorage`) | 1 |
| Browse-by-folder as an escape hatch when the scanner mis-files something | 1 |
| Metadata language: which language providers are asked in, and what happens when two answer differently | 1 |
| A stable external identifier for a group (Plex's section `uuid`) | 1 |
| Incremental / partial scanning of only the changed folder | 9 |
| Cache expiry enforcement — TMDB's six-month rule is a licence obligation with no stated enforcer; and GC for tombstones, old projection revisions and derived artefacts | 10 |
| Database optimisation/vacuum for an append-only log plus a rebuilt projection (the prompt's own FACTS warn about EAV growth) | 10 |
| Running a scheduled task on demand instead of waiting for the window | 10 |
| A/Z jump bar (`firstCharacter`) and filter choices with counts, at 11,285 items | 15 |
| "On Deck" / next-unwatched-in-this-ordering, which is a different question from Continue Watching and harder under multi-placement | 5 |
| Auto-advance within a play session (distinct from the refused auto-*resume*) | 5 |
| The owner's own rating — not in the seed property list | 5 |
| A watchlist (nearly free given media-independent items) | 6 |
| A per-container playback preference ("always Japanese audio, English subs for this show") | 12 |
| Item-page related rows beyond "Also appears in" | 14 |
| Manual reordering expressed as "move after X" rather than integer rewriting, and how positions rebalance | 4 |
| Viewing one hand-ordered container in release or alphabetical order without changing membership (`collectionSort`) | 4 |
| m3u-style bulk ordering import — building a 200-position chronology by hand is the most tedious act in the product | 4 |
| Offline download of the original file (survives the no-transcoding rule; it is a byte copy) | 7 |
| A live/push channel for scan and enrichment progress in the web UI | 8 |
| Session lifetime, revocation, and per-device logout for three clients | 6 |
| Taking a backup before applying a migration | 21 |
| Per-group settings, and a "restore defaults" (Plex's `defaultAdvanced()`) | 1 |
| Update-available checking | 21 |
| A debug-logging toggle at runtime | 20 |
| Background work yielding under playback load (`throttled`) | 16 |
| Per-group sharing versus "groups are never walls" — an unresolved tension the multi-user migration will hit | 6 |

## Explicitly NOT gaps

Refused or diverged from with a stated reason, and Plex's implementation corroborates the
refusal rather than undermining it: typed libraries (§1), agent priority with
first-non-empty-wins (§2 — **Plex does this too, not just Jellyfin**), per-field locks (§13),
`.nfo` / local media assets / artwork upload (§2, §11), transcoding and optimisation (§16),
duration-weighted progress (§4), Continue Watching dismissal (§5), cross-instance watch-state
sync (§5), Live TV and DVR (§17), Watch Together (§18 — **Plex began retiring it 2025-02-25**),
media deletion from disk (§9), and the word "duplicate" (§15).

STATUS: complete
