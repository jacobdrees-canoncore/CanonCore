# Verifying the Jellyfin claims in `prompt.md`

STATUS: complete

Every factual claim about Jellyfin in `prompt.md`, checked against primary sources: the server
source (`jellyfin/jellyfin`), the web client (`jellyfin/jellyfin-web`), and the issue tracker.

Verdicts are appended as each claim is finished.

---

## Versions checked

- **Latest stable release: `v10.11.11`, published 2026-06-06** (`1fbd8739292cce610231be93daf43368733edf63`).
- **`master` = the 12.0 development line**, currently at `v12.0-rc7` (pre-release, 2026-08-31).
  HEAD checked: `66d038c4034b9e07a4ac39822e4f0080e9a2201a`, 2026-09-06.
- `jellyfin-web` `master` checked at the SHA noted per-claim.

12.0 is a large rewrite (EF Core database layer, new services). **Several claims below are true of
10.11 and no longer true of `master`.** Where they differ, both are given.

All permalinks below are pinned to one of those two SHAs.

---

## Claim 1 — an item cannot exist without a file; virtual items are only missing TV episodes

> "IN JELLYFIN AND PLEX AN ITEM CANNOT EXIST WITHOUT A FILE. Jellyfin's virtual items work only
> for missing TV episodes hanging off a real series."

**Verdict: CONFIRMED** (with one immaterial widening: virtual *seasons* and Live TV programs also
carry the flag).

Evidence, `master` @ `66d038c`:

- `IsVirtualItem = true` is written in exactly four non-test places in the whole server:
  - [`TmdbMissingEpisodeProvider.cs#L241`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Plugins/Tmdb/TV/TmdbMissingEpisodeProvider.cs#L241) — virtual **season**
  - [`TmdbMissingEpisodeProvider.cs#L593`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Plugins/Tmdb/TV/TmdbMissingEpisodeProvider.cs#L593) — virtual **episode**
  - [`TmdbUpcomingEpisodesTask.cs#L170,L189`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Plugins/Tmdb/TV/TmdbUpcomingEpisodesTask.cs#L170) — unaired episodes
  - [`LiveTvProgram.cs#L26-L29`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/LiveTv/LiveTvProgram.cs#L26) — every EPG program row is a virtual item
- The missing-episode provider is `ICustomMetadataProvider<Series>` and refuses anything else:
  `return item is Series series && series.HasProviderId(MetadataProvider.Tmdb);`
  ([`#L67`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Plugins/Tmdb/TV/TmdbMissingEpisodeProvider.cs#L67)).
  So a virtual item requires a **real, TMDb-matched Series** to hang off. Exactly the claim.
- There is **no API to create a library item**. The only creating `HttpPost` in the whole API
  surface is `CollectionController.CreateCollection`, and even that writes a real directory:
  `var info = Directory.CreateDirectory(path);` then `new BoxSet { ..., Path = path, ... }`
  ([`CollectionManager.cs#L157-L190`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Collections/CollectionManager.cs#L157)).
  Jellyfin's own container type is a folder on disk under `<data>/collections`.

**What is true now:** unchanged. **Decision affected:** none. "Items are MEDIA-INDEPENDENT. An item
exists with zero files" remains a real divergence from Jellyfin.

---

## Claim 2 — TMDb episode groups require renaming files, and hard-lock one ordering (FR #1733, ~54 votes)

> "ORDERING LIVES IN FILENAMES. Jellyfin's TMDb episode groups 'require renaming the files to
> match the requested episode grouping order' and hard-lock you into one ordering."

**Verdict: CONFIRMED.** Number, vote count and status all check out exactly.

The feature request is on Jellyfin's Fider instance, not GitHub:
<https://features.jellyfin.org/posts/1733/advanced-tmdb-episode-grouping-options>
— "Advanced TMDB Episode Grouping options", opened **2022-08-21**. Fider API
(`https://features.jellyfin.org/api/v1/posts/1733`, fetched 2026-09-06) returns:

```
"number":1733, "votesCount":54, "commentsCount":14, "status":"open", "isApproved":true
```

**54 votes, still `open`, four years on.** The quoted phrase is verbatim from the post body:
"While the feature works, it requires renaming the files to match the requested episode grouping
order." The hard-lock is the post's own point 2: "It hard locks the user into a specific order that
can not be changed without renaming all their files."

The source corroborates the mechanism, `master` @ `66d038c`:

- [`Series.cs#L63`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/TV/Series.cs#L63) — `public string DisplayOrder { get; set; }`. **One string, one series, server-wide.** Not per user, not per view.
- [`TmdbClientManager.GetSeriesGroupAsync`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Plugins/Tmdb/TmdbClientManager.cs#L174) maps that one string to one `TvGroupType` (`originalAirDate`/`absolute`/`dvd`/`digital`/`storyArc`/`production`/`tv`).
- [`TmdbEpisodeProvider.cs#L115`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Plugins/Tmdb/TV/TmdbEpisodeProvider.cs#L115) — the season/episode numbers passed to the lookup are the ones parsed off the **file path**, and `DisplayOrder` only picks which TMDb grouping those numbers index into. That is precisely why changing the order means renaming the files.

**What is true now:** unchanged as of 12.0-rc7. **Decision affected:** none. Order-lives-on-the-
placement, not on the item or the filename, still has no equivalent upstream.

---

## Claim 3 — `MetadataResult.Provider` is transient and never persisted

> "NOBODY STORES PER-FIELD PROVENANCE... Jellyfin's own MetadataResult.Provider exists on a
> transient object and is never persisted."

**Verdict: CONFIRMED, and stronger than stated — it is never even *read*.**

`master` @ `66d038c`:

- [`MetadataResult<T>.Provider`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Providers/MetadataResult.cs#L46) is a bare `public string Provider { get; set; }` on a plain in-memory generic class. No entity, no `DbSet`, no mapper.
- A repo-wide regex for reads and writes of that member (`(result|metadataResult|temp)\.Provider`) returns **exactly one hit in the entire codebase**, and it is a write:
  [`MetadataService.cs#L974`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Manager/MetadataService.cs#L974) — `result.Provider = provider.Name;`.
  It is assigned inside `ExecuteRemoteProviders` and then discarded when the local is collected.
  Nothing reads it. It is dead state.
- The persisted item entity has no provenance column. [`BaseItemEntity`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/BaseItemEntity.cs) has 98 properties and the only one named `Provider` is `ICollection<BaseItemProvider>? Provider` — which is the **external-ID** table (`ProviderId="Tmdb"`, `ProviderValue="1396"`), i.e. *which record this is*, never *where this field came from*.

**What is true now:** unchanged, including through the whole 12.0 EF Core database rewrite — the new
schema had every opportunity to add provenance and did not. **Decision affected:** none. The
`statements` table with `source` per claim remains unmatched.

---

## Claim 4 — Jellyfin cannot link collections across libraries at all; three FRs unbuilt for years

> "NOTHING LINKS ACROSS LIBRARIES. ... Jellyfin cannot do it at all, and its three feature requests
> asking for it have sat unbuilt for years."

**Verdict: WRONG on the substantive half. The three feature requests exist with the stated vote
counts, but they do not ask for what the sentence says, and one of the three is two months old.**

### Jellyfin BoxSets *do* span libraries — the code is explicitly built for it

`master` @ `66d038c`, and identical in stable `v10.11.11`:

- [`BoxSet.GetLibraryFolderIds()`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/Movies/BoxSet.cs#L242) walks the collection's members and returns
  `.SelectMany(LibraryManager.GetCollectionFolders).Select(i => i.Id).Distinct().ToArray()`.
  A **`Guid[]`, distinct, plural** — a BoxSet's set of source libraries is a first-class computed
  value. It would be a scalar if a BoxSet could only live in one library.
- [`BoxSet.IsVisible`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/Movies/BoxSet.cs#L171-L182) shows the set if the user can see **any** of those libraries: `if (!userLibraryFolderIds.Any(i => libraryFolderIds.Contains(i))) return false;`
- [`AddToCollectionAsync`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Collections/CollectionManager.cs#L229) does `_libraryManager.GetItemById(id)` and appends a `LinkedChild`. **No library check of any kind.**
- Both `Movie` and `Series` implement [`ISupportsBoxSetGrouping`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/ISupportsBoxSetGrouping.cs).
- The web client offers "Add to collection" for everything except `Genre, MusicGenre, Studio, UserView, CollectionFolder, Audio, Program, Timer, SeriesTimer` and photos — no library gate: [`itemHelper.js#L57-L64`](https://github.com/jellyfin/jellyfin-web/blob/a1c2e13286103953b417966f1c5cc75ddefdecbc/src/components/itemHelper.js#L57), `jellyfin-web` @ `a1c2e13` (2026-09-06).
- `BoxSet.FlattenItems` even recurses into a nested `BoxSet` with a visited-set cycle guard, so
  collection-in-collection resolves at the data layer too.

Comments on FR #1004 confirm the practice: a user in 2021-01-11 replies that they already combine
Stargate, the Arrowverse and the MCU across TV and film — "You can add movies and shows together
utilizing the playlists" — and the request is about *automatic, metadata-driven* franchise building,
not about whether the link can be made.

### The three feature requests (all figures fetched from the Fider API 2026-09-06)

| # | Title | Votes | Status | Opened |
|---|---|---|---|---|
| [1004](https://features.jellyfin.org/posts/1004/cross-library-collections) | Cross-library collections | **44** | open | 2021-01-08 |
| [3392](https://features.jellyfin.org/posts/3392/multiple-sets-of-collections) | Multiple sets of Collections | **45** | open | 2025-07-20 |
| [4039](https://features.jellyfin.org/posts/4039/support-nested-collections-collections-within-collections) | Support Nested Collections (Collections within Collections) | **38** | open | **2026-07-16** |

The vote counts 45/44/38 match the prompt's figures exactly, so these are the three intended. But:

- Only **#1004** is about crossing libraries, and it asks for *automatic* franchise collections
  driven by a filesystem marker or by metadata, not for the basic ability.
- **#3392** asks for multiple *named sets* of collections (franchises vs. actors vs. genres) — a
  namespacing request, nothing to do with libraries.
- **#4039** asks for nesting, and was **opened 2026-07-16, seven weeks before this was written**.
  "Sat unbuilt for years" is false of it.

### What is true now, and what to write instead

Jellyfin's real limits, all verifiable above, are narrower and different:

1. A BoxSet is **one flat ordered membership list**, and its order is a single
   `BoxSet.DisplayOrder` string on the set — same single-ordering problem as claim 2, not a
   library problem.
2. There is **no second set of collections** — one global Collections namespace (#3392, 45 votes,
   open since 2025-07).
3. Automatic collection building is provider-driven per-item (TMDb collection id), so it cannot
   assemble a franchise that spans media types on its own (#1004, 44 votes, open since 2021).

**Decision affected:** the *decisions* survive — `groups` as a browsing scope rather than a
partition, and placements as their own table, are still justified by claims 2, 5 and 6. But the
**reason as written in the prompt is not defensible** and will be caught by anyone who checks. The
sentence "Jellyfin cannot do it at all" should be replaced with something like: *"Jellyfin's
collections do cross libraries, but a collection is one flat list with one global display order, and
there is only one collections namespace — 45 votes have been asking for a second since 2025."*

---

## Claim 5 — Jellyfin's placement key is literally `(ParentId, SortOrder)`

> "STABLE SURROGATE ID, because a key made of (parent, position) — which is what Jellyfin actually
> uses — means reordering changes the key and every external reference goes stale."

**Verdict: CONFIRMED for `master` / 12.0 — and it is *literally* that pair. NOT TRUE of the current
stable release, where there is no key at all because there is no table.**

### `master` @ `66d038c` (12.0-rc7)

[`LinkedChildConfiguration.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/ModelConfiguration/LinkedChildConfiguration.cs#L16):

```csharp
builder.ToTable("LinkedChildren");
builder.HasKey(e => new { e.ParentId, e.SortOrder });
```

[`LinkedChildEntity`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/LinkedChildEntity.cs) is `{ ParentId, ChildId, ChildType, SortOrder }` with **no surrogate id**. New rows take
`SortOrder = MAX(SortOrder) + 1` ([`LinkedChildrenService.cs#L183-L192`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Item/LinkedChildrenService.cs#L183)).
Reordering a container therefore rewrites primary keys. Exactly the failure the prompt names.

### But: this table is brand new, and stable Jellyfin is *worse*

- The table did not exist until migration
  [`20260113102337_AddLinkedChildrenTable`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Providers.Sqlite/Migrations/20260113102337_AddLinkedChildrenTable.cs) — **2026-01-13**, master only.
- In stable **`v10.11.11`** there is no `LinkedChildEntity` and no `LinkedChildren` table.
  `LinkedChild` is `{ Path, Type, LibraryItemId, ItemId }` — [no `SortOrder` field at all](https://github.com/jellyfin/jellyfin/blob/1fbd8739292cce610231be93daf43368733edf63/MediaBrowser.Controller/Entities/LinkedChild.cs) — serialised as a **JSON array inside the `BaseItems.Data` blob**. Position is the array index. There is no addressable placement whatsoever, so an external reference to one is not merely fragile, it is impossible.

**What is true now:** on the release line, membership is an unaddressable JSON array position. On the
next major, it is a primary key made of `(ParentId, SortOrder)`. **Both** vindicate the decision.
**Decision affected:** none. If anything the prompt understates it; the sentence is accurate for the
12.0 line and could add "and in the shipping release it is a position in a JSON blob".

---

## Claim 6 — the key deliberately omits ChildId, so duplicates in one container are allowed

**Verdict: CONFIRMED, with an unusually clean paper trail. This is `master` only, and it is six weeks
old.**

The key was **changed** from `(ParentId, ChildId)` to `(ParentId, SortOrder)` by migration
[`20260723111547_AllowDuplicatePlaylistChildren`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Providers.Sqlite/Migrations/20260723111547_AllowDuplicatePlaylistChildren.cs)
(**2026-07-23**), landed by [PR #17416 "Allow duplicate LinkedChildren for Playlists"](https://github.com/jellyfin/jellyfin/pull/17416), merged **2026-08-01**, fixing issue #17415. The PR body is one line:

> "Playlists can have one child linked at multiple positions."

The intent is spelled out in the migration's own `Down()` comment:

> "The (ParentId, ChildId) primary key **cannot represent the same child more than once per parent**.
> Drop any duplicate entries (keeping the first by SortOrder) ... This is lossy by nature — duplicate
> playlist entries cannot survive a downgrade."

So ChildId was dropped from the key for exactly the reason the prompt gives, and the maintainers
documented that a downgrade destroys data because of it.

**Caveat worth knowing:** the *database* now permits duplicates, but the *application* still forbids
them for collections — [`CollectionManager.AddToCollectionAsync`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Collections/CollectionManager.cs#L240) skips any id already in
`currentLinkedChildrenIds`. Duplicates are a **playlist** capability only. CanonCore's "the same item
may appear twice in one container" for *ordered containers generally* is still a divergence.

**Decision affected:** none, and this strengthens the design: Jellyfin arrived at the same conclusion
(duplicates need position in the key) in July 2026, and paid for it with a lossy migration and a
`(parent, position)` key — which is precisely the cost the surrogate `placements.id` avoids.

---

## Claim 7 — `BoxSet` is the only real precedent for containers-as-items

> "Containers are Items. ORE Aggregations and IIIF Ranges are their own classes; Jellyfin's BoxSet
> is the only real precedent and it is a codebase, not a spec."

**Verdict: PARTLY CONFIRMED.** The *pattern* is real and correctly identified. "Only" is wrong even
within Jellyfin — `Playlist` is the better citation, and it is the one where the pattern is
load-bearing.

`master` @ `66d038c`:

- [`Folder : BaseItem`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/Folder.cs#L43), and `Folder` is what carries `public LinkedChild[] LinkedChildren` ([#L62](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/Folder.cs#L62)). Containership is a property of an item, not a separate class. This is the precedent, and it is real.
- [`BoxSet : Folder`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/Movies/BoxSet.cs#L22) **and** [`Playlist : Folder, IHasShares`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Playlists/Playlist.cs#L24). Both are containers-as-items. So are `Series`, `Season`, `MusicAlbum`, `PhotoAlbum`.
- [`BaseItemKind`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Data/Enums/BaseItemKind.cs) is **one flat enum of 36 kinds** in which `BoxSet`, `Playlist`, `Person`, `Genre`, `Studio` and `Year` all sit next to `Movie` and `Episode`. Jellyfin's single-table, single-kind-enum model is the same shape as CanonCore's `items.kind`.

**Better citation:** `Playlist` is where the container-as-item pattern is doing real work — it is the
only Jellyfin container that supports duplicate members and hand ordering (claim 6), and the only one
with `IHasShares`. If the prompt wants one name, `Playlist` is stronger than `BoxSet`; if it wants
accuracy, "Jellyfin's `Folder` subclasses are the only real precedent" covers both.

**Decision affected:** none — containers fold into `work` regardless. Only the wording "only real
precedent" is loose. Note also that Jellyfin's `BaseItemKind` is a live counter-example to
CanonCore's "eight kinds, no enum creep" rule: it reached 36 values.

---

## Claim 8 — enrichment merges first-non-empty-wins and discards the losing answers

> "A single primary source with others filling gaps is REFUSED: that is Jellyfin's design, it merges
> first-non-empty-wins and DISCARDS the losing answers, and it is why Jellyfin can never say where a
> value came from."

**Verdict: CONFIRMED, verbatim in the code.**

`master` @ `66d038c`,
[`MetadataService.MergeBaseItemData`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Manager/MetadataService.cs#L1136).
The same shape is repeated for every single field on the item:

```csharp
if (replaceData || string.IsNullOrEmpty(target.OriginalTitle))  { target.OriginalTitle = source.OriginalTitle; }
if (replaceData || string.IsNullOrEmpty(target.HomePageUrl))    { target.HomePageUrl   = source.HomePageUrl; }
if (replaceData || !target.CommunityRating.HasValue)            { target.CommunityRating = source.CommunityRating; }
if (replaceData || !target.EndDate.HasValue)                    { target.EndDate = source.EndDate; }
if (!lockedFields.Contains(MetadataField.Genres))
{ if (replaceData || target.Genres.Length == 0)                 { target.Genres = source.Genres; } }
```

Providers are iterated in registration order in
[`ExecuteRemoteProviders`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Manager/MetadataService.cs#L949) and each result is `MergeData`'d into one shared `temp`.
**First non-empty wins; the second provider's answer is evaluated, found to have nowhere to go, and
dropped on the floor.** There is no list, no runner-up, no record that a second answer existed.
Combined with claim 3 (`result.Provider` written and never read), Jellyfin genuinely cannot answer
"where did this come from".

Two extras worth having in hand:

- **The boolean-lock ceiling is real and small.** [`MetadataField`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Entities/MetadataField.cs) is a **nine-value enum** — `Cast, Genres, ProductionLocations, Studios, Tags, Name, Overview, Runtime, OfficialRating`. That is the entire lock vocabulary: nine coarse booleans for the whole model, and only those nine fields can be locked at all. Everything else is unconditionally overwritable.
- **A few list fields do union rather than first-wins** (`ProductionLocations`, `RemoteTrailers`, `LockedFields` use `.Concat(...).Distinct(...)`), but the union is unattributed — it merges the *values* and keeps nothing about which provider contributed which. So it does not weaken the claim; it is a multi-value field with no provenance, which is exactly the antipattern `statements.source` exists to avoid.

**What is true now:** unchanged. **Decision affected:** none. The prompt's sentence is accurate and
could be sharpened with "and its entire lock vocabulary is nine booleans".

---

## Claim 9 — a display that changes after an unrequested refresh: open on Jellyfin since 2021

> "Do NOT pick the winner by recency: a display that changes after a refresh nobody asked for is the
> single longest-standing complaint in this category, open on Jellyfin since 2021."
> (and, at `editions`: "a display that changes after a refresh nobody asked for is the
> longest-standing complaint in this category")

**Verdict: CONFIRMED on the fact. The superlative "single longest-standing in this category" is not
provable and is not worth defending; the fact alone carries the point.**

[jellyfin/jellyfin#6709](https://github.com/jellyfin/jellyfin/issues/6709) — "Some custom primary
images/art seem to have automatically reverted or replaced with defaults".

| | |
|---|---|
| Opened | **2021-10-17** |
| State | **open** (checked 2026-09-06) |
| Age | **4 years 10 months** |
| Comments | 39 |
| Reactions | 13 |
| Label | `bug` |
| Last activity | **2026-09-04** — two days before this check |

The report is exactly the failure mode the prompt describes. From the body:

> "I have **never** done a manual 'replace metadata/images' scan in the past few weeks... none of my
> libraries have automatic data refresh active"

**Still live, and still unfixed.** A user commented "+1" on 2026-09-04 and opened
[PR #17781](https://github.com/jellyfin/jellyfin/pull/17781) "Preserve manually edited images during
library rescans" the same day — **which is already closed unmerged**. So as of the day this was
checked, the 2021 complaint has an attempted fix that did not land.

Two side-findings that reinforce other claims:

- The workaround users give each other in the thread (2026-05-14, 2026-06-02) is *"Lock this item to
  prevent future metadata changes"* — i.e. the coarse boolean lock from claim 8. It locks the whole
  item, and a commenter (2026-06-12) objects: *"I don't want to lock the entire library, because when
  I add new items..."*. That is precisely the "boolean lock answers 'may I overwrite this?' and never
  'where did this come from?'" argument, stated by Jellyfin's own users.
- Diagnosis in the thread (2026-06-30) is that a local `poster.jpg`/same-named `.jpg` silently wins
  over the user's pick on every rescan. A recency/precedence rule with no record of the displaced
  choice — the same shape as claim 8.

**What is true now:** unchanged, and freshly poked at. **Decision affected:** none. Recommend
dropping "single longest-standing" for the defensible "open on Jellyfin since 2021 and still open,
with a fix attempt closed unmerged in September 2026".

---

## Claim 10 — play count exists but no dates are kept

> "Note that every media server surveyed keeps only a mutable state row: Jellyfin has a play count
> but no dates, and Plex's unscrobble zeroes the count. The event log is what makes re-watches real."

**Verdict: WRONG as literally worded — Jellyfin keeps exactly one date, `LastPlayedDate`. The
argument it supports is nevertheless correct, and the real evidence is better than the claim.**

`master` @ `66d038c`. [`UserData`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/UserData.cs) is one mutable row per `(UserId, ItemId, CustomDataKey)`:

```csharp
public long PlaybackPositionTicks { get; set; }
public int PlayCount { get; set; }
public bool Played { get; set; }
public DateTime? LastPlayedDate { get; set; }   // <-- one date, singular
```

So "no dates" is not right. What is right, and sharper:

- **The date is singular and is overwritten every play.**
  [`BaseItem.MarkPlayed`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/BaseItem.cs#L2178):
  `data.PlayCount++;` then `data.LastPlayedDate = datePlayed ?? data.LastPlayedDate ?? DateTime.UtcNow;`
  A count of *n* plays and the date of the most recent one. The other *n-1* dates never existed.
- **Jellyfin's unmark does exactly what the prompt attributes to Plex.**
  [`BaseItem.ResetPlayedState`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/BaseItem.cs#L2234), called by `MarkUnplayed`:

  ```csharp
  data.PlayCount = 0;
  data.PlaybackPositionTicks = 0;
  data.LastPlayedDate = null;
  data.Played = false;
  ```

  One click destroys the count *and* the only date, irreversibly. The prompt gives this behaviour to
  Plex alone; Jellyfin does it too, which makes the point stronger, not weaker.
- **There is no watch-event table anywhere in the schema.** The full `DbSet` list on
  [`JellyfinDbContext`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/JellyfinDbContext.cs) is 31 sets and contains no playback history. The nearest thing is `ActivityLogs`, which is a general admin log and is **deleted after 30 days by default** (`ActivityLogRetentionDays = 30`, [`ServerConfiguration.cs#L241`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/ServerConfiguration.cs#L241), swept by `CleanActivityLogTask`). Per-play history in Jellyfin is a third-party plugin (Playback Reporting), not core.

**What is true now:** as above. **Decision affected:** none — append-only watch events remain the
divergence. **Fix the wording** to: *"Jellyfin keeps one mutable row per user and item: a play count
and a single `LastPlayedDate` that each play overwrites, and marking something unwatched sets the
count to 0 and the date to null. Plex's unscrobble does the same. Neither can tell you that you
watched it three times, or when."*

---

## Claim 11 — `IsCountableLeaf = b => !b.IsFolder && !b.IsVirtualItem`, so virtual items are excluded from rollups even when the user asked to see them

> "Jellyfin materialises the missing parts and then excludes them from the percentage anyway."

**Verdict: CONFIRMED, verbatim, and the "even when the user asked to see them" half is provable from
two methods in the same file.**

`master` @ `66d038c`,
[`DescendantQueryHelper.cs#L16-L22`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/DescendantQueryHelper.cs#L16):

```csharp
/// Gets the predicate identifying items that count toward played/total aggregation:
/// real leaf media, i.e. neither folders nor virtual items (missing or unaired episodes).
/// Shared by the per-item and batched count paths so they cannot diverge.
public static Expression<Func<BaseItemEntity, bool>> IsCountableLeaf { get; } =
    b => !b.IsFolder && !b.IsVirtualItem;
```

Exactly the expression quoted, with Jellyfin's own comment confirming what it is for.

**The inconsistency, in one file:**
[`ItemCountService.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Item/ItemCountService.cs)

- `GetPlayedAndTotalCount…` (#L340, #L355, #L491) applies `IsCountableLeaf` and takes **no user
  preference into account at all** — virtual items are unconditionally out of the played/total ratio.
- `GetChildCountBatch` (#L375), forty lines below, does the opposite:
  `var includeVirtual = user is null || user.DisplayMissingEpisodes;` — the **child count** honours
  the preference.

So a user who turns on `DisplayMissingEpisodes` sees the missing episodes listed, sees them counted
in the child count, and sees them silently dropped from the watched percentage. That is the claim,
demonstrated by the divergence between two methods rather than by inference.

**Also true in stable.** `IsCountableLeaf` as a named helper is new to `master`, but the predicate is
the same in `v10.11.11`, inlined: `GetIsPlayed` uses
`.Where(e => folderList.Contains(e.ParentId!.Value) && !e.IsFolder && !e.IsVirtualItem)`
([`BaseItemRepository.cs#L2640`](https://github.com/jellyfin/jellyfin/blob/1fbd8739292cce610231be93daf43368733edf63/Jellyfin.Server.Implementations/Item/BaseItemRepository.cs#L2640)) and the `IsPlayed` series filter uses
`.Where(e => e.IsFolder == false && e.IsVirtualItem == false)` (#L2078). The 12.0 rewrite kept the
behaviour and gave it a name.

**What is true now:** unchanged. **Decision affected:** none. "Have I watched this WORK" from
coverage intervals against a sourced `extent` statement, with **unknown** as a real answer, stands as
the divergence — and note that Jellyfin cannot report unknown at all, because its denominator is
"leaf rows that are not virtual", which is always a number.

---

## Claim 12 — Jellyfin's dedup is correct only because of an assumption written into its own source

> "The dedup matters here in a way it does not elsewhere. Jellyfin's equivalent is correct only
> because of an assumption written into its own source — that members of a group are distinct folders
> whose leaves cannot overlap. Ours overlap by design, so the dedup is load-bearing rather than
> incidental."

**Verdict: CONFIRMED. The comment exists and is close to verbatim.**

`master` @ `66d038c`,
[`ItemCountService.GetPlayedAndTotalCountBatch`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Item/ItemCountService.cs#L549) (method begins #L472), line **549**:

```csharp
// Members of a group are distinct folders, so their leaves cannot overlap.
foreach (var member in members)
{
    if (countsByFolder.TryGetValue(member, out var counts))
    {
        played += counts.Played;
        total  += counts.Total;
    }
}
```

The prompt's paraphrase is almost the comment's own wording. Precisely as characterised: the
cross-member rollup is a **bare `+=` sum with no dedup**, and the only thing making it correct is
that one sentence.

Worth noting what the "group" is: `GetPresentationKeyGroups` (#L568) groups folders by
`PresentationUniqueKey` — e.g. one series split across two library folders. So Jellyfin *does* have a
multi-parent case, and it handles it by asserting the parents are disjoint.

Note also that within a single folder Jellyfin *does* dedup —
`Total = g.Select(x => x.Id).Distinct().Count()` (#L537) — because `ancestorLeaves`, `linkedLeaves`
and `linkedFolderLeaves` are `Union`ed and a leaf can be reached by more than one path *inside* one
folder. So Jellyfin knows the problem exists; it just assumes it stops at the folder boundary.

**New in 12.0.** `git grep` for the comment in `v10.11.11` finds nothing; `ItemCountService` is part
of the 12.0 rewrite.

**Decision affected:** none, and this is the sharpest single citation in the whole set.
"Container progress ... deduped with `COUNT(DISTINCT item)`" is exactly the assumption CanonCore
cannot make, and Jellyfin wrote down why in one line.

---

## Claim 13 — `SupportsUserDataFromChildren` is false for collection folders, commented "These are just far too slow"

**Verdict: CONFIRMED, verbatim, and present in *both* the stable release and `master`.**

[`Folder.SupportsUserDataFromChildren`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/Folder.cs#L159), `master` @ `66d038c` (and `v10.11.11` [#L139](https://github.com/jellyfin/jellyfin/blob/1fbd8739292cce610231be93daf43368733edf63/MediaBrowser.Controller/Entities/Folder.cs#L139), character-identical):

```csharp
public virtual bool SupportsUserDataFromChildren
{
    get
    {
        // These are just far too slow.
        if (this is ICollectionFolder) { return false; }
        if (this is UserView)          { return false; }
        if (this is UserRootFolder)    { return false; }
        if (this is Channel)           { return false; }
        if (SourceType != SourceType.Library) { return false; }
        ...
    }
}
```

The comment is exactly "`// These are just far too slow.`" and it guards four early returns.

**Read the scope carefully.** In Jellyfin, `ICollectionFolder` is implemented by
[`CollectionFolder`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/CollectionFolder.cs#L32) and `BasePluginFolder` — that is a **top-level library**, not a `BoxSet`. So what this
disables is the watched rollup on the *library* tile and on user views; a `BoxSet` is an ordinary
`Folder` and does still get one.

The consumer is [`Folder.FillUserDataDtoValues`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/Folder.cs#L1946), which bails immediately when the flag is false, and
[`DtoService.cs#L204`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Dto/DtoService.cs#L204), which uses it to decide which folders even enter the batch count.

**What is true now:** unchanged, though `master` has since added a batched `GetPlayedAndTotalCountBatch`
path "to avoid N+1 queries" (`DtoService.cs#L199`) — i.e. Jellyfin is still fighting the same cost,
which is itself the evidence that computing rollups on read is the hard part.

**Decision affected:** none, but it is a **warning against** the CanonCore decision it sits near:
"Container progress is computed on read from the ancestor closure, deduped with
`COUNT(DISTINCT item)`, never stored." Jellyfin computes on read too and had to switch it off for its
largest containers on performance grounds. The decision stands (count-based, never
duration-weighted, and CanonCore is single-user), but the ancestor closure and the batch path are
where this will bite, and Jellyfin's comment is the primary source saying so.

---

## Claim 14 — Jellyfin ships ONE hardcoded API key used by thousands of strangers

> "SHIP NO API KEYS. ... Jellyfin ships one hardcoded key that thousands of strangers use, which is
> tolerated rather than authorised and looks like sublicensing."

**Verdict: CONFIRMED, and understated — it ships at least three, and the override is deliberately
hidden from the UI.**

`master` @ `66d038c` (the TMDb key is byte-identical in `v10.11.11`):

| Service | Key | Location |
|---|---|---|
| TMDb | `<32-hex-key, redacted here>` | [`TmdbUtils.cs#L34`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Plugins/Tmdb/TmdbUtils.cs#L34) — `public const string ApiKey` |
| AudioDb | `195003` | [`AudioDbArtistProvider.cs#L32`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Plugins/AudioDb/AudioDbArtistProvider.cs#L32) — `private const string ApiKey` |
| OMDb | `2c9d9507` | [`OmdbProvider.cs#L260`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Plugins/Omdb/OmdbProvider.cs#L260) — inlined straight into the URL string |

**The damning part is the override.** A per-instance TMDb key field exists, and
[`PluginConfiguration.cs#L12-L16`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Plugins/Tmdb/Configuration/PluginConfiguration.cs#L12) says why you cannot reach it:

```csharp
/// Gets or sets a value to use as the API key for accessing TMDb. This is intentionally excluded
/// from the settings page as the API key should not need to be changed by most users.
public string TmdbApiKey { get; set; } = string.Empty;
```

`grep -c TmdbApiKey MediaBrowser.Providers/Plugins/Tmdb/Configuration/config.html` returns **0** —
the field is genuinely absent from the settings page. And the fallback
([`TmdbClientManager.cs#L42-L43`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Plugins/Tmdb/TmdbClientManager.cs#L42)) is:

```csharp
var apiKey = Plugin.Instance.Configuration.TmdbApiKey;
apiKey = string.IsNullOrEmpty(apiKey) ? TmdbUtils.ApiKey : apiKey;
```

Default empty, hidden from the UI, silent fallback to the shared key. **Every default Jellyfin
install on earth is calling TMDb as the same customer.**

The only unverifiable word is "thousands" — install counts are not published. "Every default
install" is both stronger and checkable.

**What is true now:** unchanged. **Decision affected:** none. "BUNDLED DEFAULTS — known provider
definitions ship with CanonCore, ALL DISABLED BY DEFAULT. Shipping a definition is not shipping a
key" is directly vindicated, and the prompt could cite the "intentionally excluded from the settings
page" comment as the sharpest single line.

---

## Claim 15 — people deliberately have no `TopParentId`, keeping them out of library-scoped queries

> "Entities must not leak into work-browsing surfaces. Jellyfin's mechanism is that people have no
> container parent, and it is the right instinct but it CANNOT be copied literally here..."

**Verdict: CONFIRMED, and Jellyfin says so in a doc comment.**

`master` @ `66d038c`:

- People are created **parentless**. [`LibraryManager.GetOrCreatePerson`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Library/LibraryManager.cs#L1226) ends `CreateItem(item, null);` — the second argument is the parent.
- `TopParentId` is derived from ancestry: `entity.TopParentId = item.TopParent?.Id;` ([`ItemPersistenceService.cs#L276`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Item/ItemPersistenceService.cs#L276)), and [`GetTopParent()`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/BaseItem.cs#L2885) is `GetParents().FirstOrDefault(p => p.IsTopParent)` → **null** for a parentless Person.
- A library-scoped query is *literally* a `TopParentId` filter:
  `return baseQuery.WhereOneOrMany(queryTopParentIds, e => e.TopParentId!.Value);`
  ([`BaseItemRepository.QueryBuilding.cs#L499`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Item/BaseItemRepository.QueryBuilding.cs#L499)). A null `TopParentId` cannot match, so people fall out automatically.
- **The deliberateness is documented.** [`GetExemptedItemByNameTypes`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Item/BaseItemRepository.QueryBuilding.cs#L512) carries the comment:

  > "Returns the by-name types a query asks for, **which carry no TopParentId to filter on**."

  and the five by-name kinds are ([`BaseItemRepository.cs#L49`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Item/BaseItemRepository.cs#L49)):
  `Person, Genre, MusicGenre, MusicArtist, Studio`. To make them appear *at all*, Jellyfin must
  explicitly exempt them: `e => exemptedItemByNameTypes.Contains(e.Type) || queryTopParentIds.Any(...)`.

**Confirms the prompt's reading exactly, including why it cannot be copied.** Jellyfin's exclusion is
a side effect of parentlessness, so an *ordered container whose members are entities* — "the Doctors,
in order" — is unrepresentable there: giving the Person a container parent would put it straight back
into every library query. CanonCore's "exclude BY KIND, not by absence of a parent" is the correct
repair, and the prompt already states it.

Small correction to the wording: it is not only people. All five by-name kinds work this way, and
the mechanism is the *null `TopParentId`* rather than the absence of a parent per se.

**Decision affected:** none.

---

## Claim 16 — person identity IS the name; the maintainer quote

> "ENTITY IDENTITY IS A SURROGATE ID with external-id mappings, NEVER A NAME. Jellyfin keys people on
> their name, so two people sharing a name merge irreversibly, and two spellings of one person cannot
> be merged even when their external ids match. Its maintainers say there is no fix without a
> redesign."
>
> Quote to verify: *"the database currently uses a person's name as their unique identifier...
> There's no fix for this currently until the database has been redesigned."*

**Verdict on the behaviour: CONFIRMED, decisively.
Verdict on the quote: UNVERIFIABLE AS WORDED — that exact sentence does not exist anywhere in the
`jellyfin` GitHub organisation. Real maintainer statements saying the same thing do exist; use those.**

### The behaviour — a person's id is an MD5 of their name

`master` @ `66d038c`:

```csharp
public Guid GetPersonId(string name)
    => GetItemByNameId<Person>(Person.GetPath(name));      // LibraryManager.cs#L1208

private Guid GetNewItemIdInternal(string key, Type type, bool forceCaseInsensitive)
{
    ...
    if (forceCaseInsensitive || !config.EnableCaseSensitiveItemIds) { key = key.ToLowerInvariant(); }
    key = type.FullName + key;
    return key.GetMD5();                                    // LibraryManager.cs#L816
}
```

([`GetPersonId`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Library/LibraryManager.cs#L1208), [`GetNewItemIdInternal`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Library/LibraryManager.cs#L795))

A person's primary key is **`MD5("MediaBrowser.Controller.Entities.Person" + <path derived from the name>)`**. It is not merely *keyed on* the name; it is a pure function of the name. Both halves of the
prompt's claim follow arithmetically: same name → same Guid → **one merged person, irreversibly**;
different spelling → different Guid → **two people that can never be merged**.

Supporting evidence:

- The `People` table cannot hold an external id. The entity is *four members*:
  `{ Guid Id, string Name, string? PersonType, ICollection<PeopleBaseItemMap>? BaseItems }`
  ([`People.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/People.cs)). There is no provider-id column and no link to `BaseItemProviders`.
- `PersonInfo` *does* carry `ProviderIds` ([`PersonInfo.cs#L56`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/PersonInfo.cs#L56)) — and [`PeopleRepository.Map`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Item/PeopleRepository.cs#L346) throws them away, writing only `Name`, `PersonType`, `Id`. **TMDb hands Jellyfin the person id and Jellyfin drops it on the floor.** That is the precise mechanism behind "cannot be merged even when their external ids match".
- Matching is by lowered name + type throughout:
  `personKeys = distinctPersons.Select(e => e.LoweredName + "-" + e.PersonType)` ([`UpdatePeople`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Item/PeopleRepository.cs#L130)), with the comment
  "The Peoples table can hold case-only duplicates, so keep the first match per key".
- `GetOrCreatePerson` also does `Directory.CreateDirectory(path)` — every person is a **folder on
  disk named after them**, which is why a rename orphans the entity.

### The quote

Exhaustive GitHub search across `org:jellyfin` for `"person's name as their unique identifier"`,
`"a person's name as their"`, `"name as their unique identifier"`, `"no fix for this currently"` and
`"until the database has been redesigned"` returns **zero results** (checked 2026-09-06). The phrasing
is not on GitHub. It may come from a forum, Reddit or Discord; as an unattributed quotation in a
document that is meant to be self-sufficient, it is a liability.

**Use these instead — both are maintainer (`cvium`) comments on the canonical issue,
[jellyfin/jellyfin#3356 "Actors with the same name appear as one person"](https://github.com/jellyfin/jellyfin/issues/3356)** (opened **2020-06-16**, **still open**, 27 comments, 12 reactions, labels `bug` / `confirmed` / `librarydb`, last activity 2026-07-16):

> **2020-11-06** — "There is unfortunately no easy fix for this. Actors are poorly handled by various
> metadata providers such as OMDB, where they are presented with only a name and thus we have no
> unique id to tie actors to movies, shows etc. When two actors share the exact same name this
> becomes a problem. TMDB seems to have id's for the actors, so we might be able to do more than name
> comparison. **It's unlikely to be fixed before the database rewrite though.**"
> ([comment](https://github.com/jellyfin/jellyfin/issues/3356#issuecomment-723115446))

> **2025-10-20**, answering a user who assumed 10.11 had fixed it — "**Database has not been
> redesigned.** The underlying framework was changed, but that has no bearing on the data models. **No
> work has been done to fix this in 10.11.**"
> ([comment](https://github.com/jellyfin/jellyfin/issues/3356#issuecomment-3422005641))

Together those say exactly what the prompt's paraphrase says, from a maintainer, with permalinks —
and the second is *better*, because it confirms the 12.0-era database work did **not** fix it.

The "two spellings cannot be merged" half has its own issue:
[#8906 "Multiple entries(Profiles?) same actor/actress"](https://github.com/jellyfin/jellyfin/issues/8906)
(2022-12-14), which states "Jellyfin seems to create actor/actress pages based on their names rather
than an ID such as IMDB ID or MovieDB ID, and sometimes people will change the spelling ... causing
multiple pages for the same person" — **closed 2023-01-07 as `not_planned`**, duplicate of #3356.

**What is true now:** unchanged, and confirmed unchanged by a maintainer as recently as 2025-10.
**Decision affected:** none — "ENTITY IDENTITY IS A SURROGATE ID ... NEVER A NAME" is well founded.
**Action:** replace the unattributed quotation with the two `cvium` comments above.

---

## Claim 17 — `Video.GetUserDataKeys()` puts IMDb then TMDb at index 0, path GUID only as fallback

**Verdict: PARTLY CONFIRMED. The structure is exactly as described — provider ids first, path GUID
last. The stated *order* of IMDb and TMDb is backwards for ordinary videos, and reverses again for
extras.**

`master` @ `66d038c`, [`Video.GetUserDataKeys()`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/Video.cs#L293):

```csharp
var list = base.GetUserDataKeys();
if (EnableDefaultVideoUserDataKeys)
{
    if (ExtraType.HasValue)
    {
        var key = this.GetProviderId(MetadataProvider.Tmdb);
        if (!string.IsNullOrEmpty(key)) { list.Insert(0, GetUserDataKey(key)); }
        key = this.GetProviderId(MetadataProvider.Imdb);
        if (!string.IsNullOrEmpty(key)) { list.Insert(0, GetUserDataKey(key)); }
    }
    else
    {
        var key = this.GetProviderId(MetadataProvider.Imdb);
        if (!string.IsNullOrEmpty(key)) { list.Insert(0, key); }
        key = this.GetProviderId(MetadataProvider.Tmdb);
        if (!string.IsNullOrEmpty(key)) { list.Insert(0, key); }
    }
}
return list;
```

Both are `Insert(0, …)`, so **the last one inserted ends up at index 0**:

| case | index 0 | index 1 | last |
|---|---|---|---|
| ordinary video (movie) | **TMDb** | IMDb | path GUID |
| extra (trailer etc.) | **IMDb** | TMDb | path GUID |

So the insert *sequence* is "IMDb then TMDb" for a movie, but the resulting *priority* is TMDb first.
For extras it is the other way round. The claim's "IMDb then TMDb at index 0" describes the sequence,
not the outcome; if it is meant as priority it is wrong for the common case. The inconsistency
between the two branches looks unintentional and is worth not repeating.

**The load-bearing half is correct.** `base.GetUserDataKeys()`
([`BaseItem.cs#L1704`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/BaseItem.cs#L1704)) contributes only `list.Add(Id.ToString())`, and that `Id` **is** the path:
`item.Id = libraryManager.GetNewItemId(item.Path, item.GetType());`
([`ResolverHelper.cs#L36`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Library/ResolverHelper.cs#L36)), which is `MD5(type.FullName + path)`. So the path GUID is genuinely the
**last-resort** key.

And it works: [`UserDataManager.ResolveUserDataRow`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Library/UserDataManager.cs#L370) walks `item.GetUserDataKeys()` in order and returns the
first row whose `CustomDataKey` matches, while writes go to `GetUserDataKeys()[0]` — with the comment
"so rows left behind under keys from older metadata don't take priority over the rows the write path
updates". A movie with a TMDb id therefore keeps its watch state across a move; a movie with no
provider id is keyed on its path and **loses watch state when moved**.

**Relevance to CanonCore.** This is the one place Jellyfin gets the identity question right, and it
is worth citing *in favour of* the prompt's "PATH IS LOCATION, NOT IDENTITY, so a moved file is the
same file" rather than against it. Note the limit: Jellyfin's escape only works when a provider
matched. CanonCore's content hash `SHA1(size + SHA1(first 64KB) + SHA1(last 64KB))` works with no
provider at all.

**Decision affected:** none.

---

## Claim 18 — save progress every 10 seconds; "the industry floor, which Emby states as a requirement"

> "Save every 10 seconds — the industry floor, which Emby states as a requirement."

**Verdict: CONFIRMED on the number, from two independent primary sources. PARTLY CONFIRMED on the
characterisation — Emby documents 10 seconds as a *ceiling on useful frequency*, not as a floor.**

### Jellyfin actually does it: 10,000 ms, one line

`jellyfin-web` @ `a1c2e13` (2026-09-06),
[`playbackmanager.js#L3264-L3268`](https://github.com/jellyfin/jellyfin-web/blob/a1c2e13286103953b417966f1c5cc75ddefdecbc/src/components/playback/playbackmanager.js#L3264):

```js
function startPlaybackProgressTimer(player) {
    stopPlaybackProgressTimer(player);
    player._progressInterval = setInterval(onPlayerProgressInterval.bind(player), 10000);
}
```

`onPlayerProgressInterval` calls `sendProgressUpdate(player, 'timeupdate')`, which reaches
`reportPlaybackProgress` ([`#L3701`](https://github.com/jellyfin/jellyfin-web/blob/a1c2e13286103953b417966f1c5cc75ddefdecbc/src/components/playback/playbackmanager.js#L3701)). This is the only progress timer in the client; there is no
second, faster path.

The server persists on each such report. `master` @ `66d038c`,
[`SessionManager.OnPlaybackProgress`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Session/SessionManager.cs#L897):

```csharp
// only update saved user data on actual check-ins, not automated ones
if (libraryItem is not null && !isAutomated)
{
    var progressItem = GetProgressItem(libraryItem, info.MediaSourceId);
    foreach (var user in users) { OnPlaybackProgress(user, progressItem, info); }
}
```

So a client check-in every 10 s **is** the durable save interval; the server's own automated
in-memory ticks deliberately do not write.

### Emby's wording, fetched 2026-09-06

<https://dev.emby.media/doc/restapi/Playback-Check-ins.html> — "Playback Check-ins", the API
reference clients are told to implement against. Verbatim:

> "Playback progress should be reported at the following times:
> **Automatically every 10 seconds**
> Immediately following any user interaction with the player, for example, pause, un-pause, etc."

and, two paragraphs down:

> "The server will automatically increment playback progress every second, so it is **not necessary
> to automatically report more often than at 10 second intervals**. The progress reports coming from
> the app will be used to re-calibrate the automatic progress increment on the server."

So Emby does state 10 seconds, as a `should` in a normative API doc. But its *reason* is the
opposite of "floor": the server extrapolates position at 1 Hz on its own, so 10 s is the point past
which reporting more often buys nothing. Emby is capping chatter, not setting a minimum fidelity.

**What is true now:** the number is right and is what both Jellyfin and Emby ship. **Decision
affected:** none — 10 s is well evidenced. **Wording fix:** "the industry floor, which Emby states
as a requirement" overstates it twice. Defensible replacement: *"Save every 10 seconds. Emby's API
reference tells clients to report progress 'automatically every 10 seconds' plus immediately on any
user interaction, and Jellyfin's web client ships exactly that interval."* Note the second half of
Emby's rule — **report immediately on user interaction as well as on the timer** — is the part
CanonCore should actually copy, and the prompt currently omits it. A 10-second timer alone loses up
to 10 seconds on a pause-and-close, which is the common case.

---

## Claim 19 — separate audiobook constants measured in MINUTES; `MinResumeDurationSeconds = 300`

> "Completion is TIME REMAINING under a small absolute figure, not a percentage... ONE number clears
> the position; do not add a second, higher threshold for that. Force-complete anything under five
> minutes so trailers never sit in Continue Watching."

**Verdict: CONFIRMED, exactly. Identical in stable `v10.11.11` and in `master`. And it is a stronger
citation than the prompt currently uses it as — Jellyfin is the worked counter-example for the "ONE
number" rule, because it has five.**

### The constants

[`ServerConfiguration.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/ServerConfiguration.cs#L133), `master` @ `66d038c`. Byte-identical at the same line numbers in
[`v10.11.11`](https://github.com/jellyfin/jellyfin/blob/1fbd8739292cce610231be93daf43368733edf63/MediaBrowser.Model/Configuration/ServerConfiguration.cs#L133) (checked via the contents API, 2026-09-06):

| line | constant | default | unit |
|---|---|---|---|
| [L133](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/ServerConfiguration.cs#L133) | `MinResumePct` | 5 | **percent** |
| [L139](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/ServerConfiguration.cs#L139) | `MaxResumePct` | 90 | **percent** |
| [L145](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/ServerConfiguration.cs#L145) | `MinResumeDurationSeconds` | **300** | seconds |
| [L151](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/ServerConfiguration.cs#L151) | `MinAudiobookResume` | 5 | **minutes** |
| [L157](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/ServerConfiguration.cs#L157) | `MaxAudiobookResume` | 5 | **minutes** |

`MinResumeDurationSeconds = 300` is exactly the prompt's "force-complete anything under five
minutes", and Jellyfin's doc comment says why: *"the minimum duration that an item must have in
order to be eligible for playstate updates."* The two audiobook constants are genuinely in minutes,
and Jellyfin's own doc comments say so — *"the minimum minutes of a book that must be played"* and
*"the remaining time in minutes"*.

### The unit switch is the interesting part

[`UserDataManager.UpdatePlayState`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Library/UserDataManager.cs#L439) has two entirely separate branches, split on type:

```csharp
if (positionTicks > 0 && hasRuntime && item is not AudioBook && item is not Book)
{
    var pctIn = decimal.Divide(positionTicks, runtimeTicks) * 100;
    if (pctIn < MinResumePct)                    { positionTicks = 0; }                       // ignore the beginning
    else if (pctIn > MaxResumePct || positionTicks >= runtimeTicks - TimeSpan.TicksPerSecond)
                                                 { positionTicks = 0; data.Played = true; }   // close to the end
    else if (durationSeconds < MinResumeDurationSeconds)
                                                 { positionTicks = 0; data.Played = true; }   // too short to resume
}
else if (positionTicks > 0 && hasRuntime && item is AudioBook)
{
    var playbackPositionInMinutes = TimeSpan.FromTicks(positionTicks).TotalMinutes;
    var remainingTimeInMinutes    = TimeSpan.FromTicks(runtimeTicks - positionTicks).TotalMinutes;
    if (playbackPositionInMinutes < MinAudiobookResume)      { positionTicks = 0; }
    else if (remainingTimeInMinutes < MaxAudiobookResume ...) { positionTicks = 0; data.Played = true; }
}
```

**Video is judged by percentage; audiobooks are judged by absolute minutes remaining.** That is the
prompt's own argument, discovered independently by Jellyfin and bolted on as a second code path the
moment long-form content arrived: a percentage does not survive contact with a six-hour item, so
they switched to `remainingTimeInMinutes` for the one media type where the problem is unmissable —
and left video on the percentage it was already wrong for.

### And it is the counter-example for "ONE number clears the position"

Five configurable numbers zero `positionTicks` in one method. Three of them apply to video
(`MinResumePct`, `MaxResumePct`, `MinResumeDurationSeconds`) and two to audiobooks, and two of the
five *also* set `Played = true` while a third silently does not. `MinAudiobookResume` and
`MaxAudiobookResume` share a default of 5 and mean completely different things (minutes elapsed vs.
minutes remaining). This is precisely the sprawl the prompt's one-sentence rule refuses.

**What is true now:** unchanged across both lines. **Decision affected:** none — this *supports*
"time remaining under a small absolute figure, not a percentage" and "ONE number clears the
position". **Suggested addition to the prompt:** cite it. One line would do: *"Jellyfin ships five
such numbers and needed a second code path in absolute minutes as soon as audiobooks arrived; video
is still judged on a percentage."*

---

## Claim 20 — Jellyfin's React rewrite excludes TV: "Modern App... Does not currently support TV layout!"

**Verdict: CONFIRMED, verbatim in Jellyfin's own contributor documentation, and enforced in code by a
hard-coded set. Note it is NOT currently cited in `prompt.md` — see "where this belongs" below.**

### The quote

[`jellyfin-web/CONTRIBUTING.md#L78-L88`](https://github.com/jellyfin/jellyfin-web/blob/a1c2e13286103953b417966f1c5cc75ddefdecbc/CONTRIBUTING.md#L78), `master` @ `a1c2e13` (2026-09-06),
under "Application Components":

```markdown
* Modern App `src/apps/modern`
  * Ongoing rewrite of the main user interface using MUI components
  * Currently reuses content from the Legacy App to maintain parity
  * Does not currently support TV layout!
* Legacy App `src/apps/legacy`
  * Main user application
  * Supports TV layout
* Dashboard App `src/apps/dashboard`
  * Admin dashboard and metadata editor pages
  * Almost completely rewritten using MUI components
  * No TV support (dashboard pages are not available)
```

Exact wording, exclamation mark included. The line was added by
[`f682a3a20a` "Update contributing guide", 2026-06-30](https://github.com/jellyfin/jellyfin-web/commit/f682a3a20a); the file itself only dates from
2026-03-12, so this is a current, deliberate statement rather than a stale note.

Two things worth having beyond the quote: it says **two** of the four apps have no TV support (the
dashboard has none at all, and its admin pages are simply unreachable from a TV), and the rewrite is
described as "currently reuses content from the Legacy App to maintain parity" — i.e. after several
years it is still a shell over the old code.

### It is enforced, not merely documented

`master` @ `a1c2e13`:

- [`constants/layoutMode.ts#L19-L24`](https://github.com/jellyfin/jellyfin-web/blob/a1c2e13286103953b417966f1c5cc75ddefdecbc/src/constants/layoutMode.ts#L19) — TV is hard-coded as a *legacy* layout:

  ```ts
  /** The layout modes that use the legacy app. */
  export const LegacyLayoutModes = new Set([
      LayoutMode.DesktopLegacy,
      LayoutMode.MobileLegacy,
      LayoutMode.Tv
  ]);
  ```

- [`layoutManager.js#L28,L41`](https://github.com/jellyfin/jellyfin-web/blob/a1c2e13286103953b417966f1c5cc75ddefdecbc/src/components/layoutManager.js#L28) — `const isLegacyLayout = LegacyLayoutModes.has(layoutValue); ... this.modern = !isLegacyLayout;`
- [`RootAppRouter.tsx#L26`](https://github.com/jellyfin/jellyfin-web/blob/a1c2e13286103953b417966f1c5cc75ddefdecbc/src/RootAppRouter.tsx#L26) — the whole route table forks on it:
  `...(layoutManager.modern ? MODERN_APP_ROUTES : LEGACY_APP_ROUTES)`

Choosing the TV layout therefore serves the entire pre-React application. There is no partial
adoption and no shared route set.

### The stable release is the same, under the old name

In `v10.11.11` the directories are `src/apps/{stable,experimental,dashboard,wizard}` and the mode is
called `experimental`, but the mutual exclusion is identical:
[`layoutManager.js`](https://github.com/jellyfin/jellyfin-web/blob/v10.11.11/src/components/layoutManager.js) sets `this.experimental = layout === 'experimental'` and then immediately
substitutes a *legacy* desktop or mobile layout underneath it. `tv` and `experimental` are separate,
non-overlapping values of one setting. The 12.0 line renamed `experimental`→`modern` and
`stable`→`legacy` and kept the exclusion.

### How long this has been true

The React rewrite has shipped under a TV-excluding flag for years and the exclusion has outlasted a
rename and a major version. That is the useful shape of the fact: **a mature, well-staffed media
server rewrote its web client in React and, several years in, still cannot put the TV layout on
it** — because TV is not a CSS breakpoint, it is a focus engine.

### Where this belongs in `prompt.md`

`grep -in "react\|tv layout\|modern app" prompt.md` shows this claim is **not currently in the
document**. The place it argues for is the CLIENTS section (`prompt.md` L748-768), which already
says "THE ORDER IS PHONE, THEN TV... the TV app carries the tvOS focus-engine work and a UIKit
budget that the phone app does not", supported by React Native/tvOS specifics.

This is a second, independent witness for the same conclusion from a different stack: Jellyfin's is
a *web* client with no React Native anywhere, and TV still forced a separate application. Suggested
one-line addition after the existing tvOS argument: *"Jellyfin's own web client makes the same
split for the same reason — its React rewrite has excluded the TV layout since it began, and its
contributing guide still says so: 'Modern App ... Does not currently support TV layout!'"*

**Decision affected:** none. It strengthens phone-before-TV and the refusal to treat TV as a
responsive breakpoint of an existing app.

---

# SUMMARY

All twenty claims checked. Jellyfin versions: stable **`v10.11.11`** (`1fbd873`, released 2026-06-06)
and **`master` = the 12.0 line at `v12.0-rc7`** (`66d038c`, 2026-09-06); `jellyfin-web` `master`
at `a1c2e13` (2026-09-06). Feature-request figures from the Fider API, GitHub figures from the
GitHub API, both fetched 2026-09-06.

| # | Claim (short) | Verdict | Decision it supports |
|---|---|---|---|
| 1 | Item cannot exist without a file; virtual items are missing TV episodes only | **CONFIRMED** | safe |
| 2 | TMDb episode groups require renaming files; FR #1733, 54 votes | **CONFIRMED** | safe |
| 3 | `MetadataResult.Provider` transient, never persisted | **CONFIRMED** (never even read) | safe |
| 4 | Jellyfin cannot link collections across libraries; 3 FRs unbuilt for years | **WRONG** | safe, reason must be rewritten |
| 5 | Placement key is `(ParentId, SortOrder)` | **CONFIRMED** (12.0; stable is worse — a JSON array index) | safe |
| 6 | Key omits ChildId so duplicates are allowed | **CONFIRMED** (migration `20260723111547`, PR #17416) | safe, strengthened |
| 7 | `BoxSet` is the only real precedent for containers-as-items | **PARTLY CONFIRMED** — `Playlist` is the better citation | safe, wording loose |
| 8 | Enrichment is first-non-empty-wins and discards losers | **CONFIRMED** verbatim | safe |
| 9 | Display changes after an unrequested refresh; open since 2021 (#6709) | **CONFIRMED** on fact; superlative unprovable | safe |
| 10 | Play count but no dates | **WRONG** — one `LastPlayedDate`, overwritten each play | safe, reason must be rewritten |
| 11 | `IsCountableLeaf = b => !b.IsFolder && !b.IsVirtualItem` | **CONFIRMED** verbatim | safe |
| 12 | Dedup rests on "members of a group are distinct folders" comment | **CONFIRMED** verbatim | safe, sharpest citation in the set |
| 13 | `SupportsUserDataFromChildren` false, "These are just far too slow" | **CONFIRMED** verbatim, both lines | safe, but read it as a warning |
| 14 | Ships ONE hardcoded API key used by thousands of strangers | **CONFIRMED**, understated — three keys, override hidden | safe; "thousands" unprovable |
| 15 | People deliberately have no `TopParentId` | **CONFIRMED**, documented in a comment | safe |
| 16 | Person identity is the name; maintainer quote | Behaviour **CONFIRMED**; the verbatim quote is **UNVERIFIABLE** | safe (prompt paraphrases, so it is not exposed) |
| 17 | `Video.GetUserDataKeys()` puts IMDb then TMDb at index 0 | **PARTLY CONFIRMED** — order is TMDb-first for video, IMDb-first for extras | not in prompt.md |
| 18 | Save interval 10 seconds, Emby states it as a requirement | **CONFIRMED** on the number; **PARTLY** on "floor"/"requirement" | safe |
| 19 | Audiobook constants in MINUTES; `MinResumeDurationSeconds=300` | **CONFIRMED** exactly, both lines | safe, strengthened |
| 20 | React rewrite excludes TV ("Does not currently support TV layout!") | **CONFIRMED** verbatim, and enforced in code | not in prompt.md; worth adding |

**Two WRONG (4, 10), three PARTLY (7, 17, 18), one unverifiable quotation (16), fifteen clean.**

In every case the **decision survives**; what rots is the **reason**. Claims 4 and 10 are the only
two where the sentence as written would be caught out by anyone who checks, and both are fixable
without touching a decision.

---

# LINE-BY-LINE EDITS `prompt.md` SHOULD ABSORB

Line numbers are against `prompt.md` as read on 2026-09-06 (888 lines).

### Must fix — the claim as written is false

**1. L56-59 (claim 4).** Replace:

> "NOTHING LINKS ACROSS LIBRARIES. A Plex collection can only appear to span libraries when the
> collections carry exactly the same NAME, matched as strings. Jellyfin cannot do it at all, and its
> three feature requests asking for it have sat unbuilt for years."

with:

> "NOTHING GIVES A COLLECTION A SECOND ORDERING. A Plex collection can only appear to span libraries
> when the collections carry exactly the same NAME, matched as strings. Jellyfin's collections do
> cross libraries, but a collection is one flat membership list with one global display order, and
> there is only one Collections namespace — 45 votes have been asking for a second since 2025."

Jellyfin's `BoxSet.GetLibraryFolderIds()` returns a distinct `Guid[]` and `AddToCollectionAsync`
performs no library check at all, so "cannot do it at all" is refuted by four lines of its own
source. Of the three feature requests, one (#4039, nested collections) was opened 2026-07-16 —
seven weeks before the prompt was written — so "sat unbuilt for years" is false of it.

**2. L341-342 (claim 10).** Replace:

> "Jellyfin has a play count but no dates, and Plex's unscrobble zeroes the count."

with:

> "Jellyfin keeps one mutable row per user and item: a play count and a single `LastPlayedDate` that
> every play overwrites, and marking something unwatched sets the count to 0 and the date to null.
> Plex's unscrobble does the same. Neither can tell you that you watched it three times, or when."

`UserData` does carry `LastPlayedDate`. "No dates" is checkable and false; the corrected version is
a stronger argument for the event log, because it shows both products destroying history on one
click rather than merely failing to record it.

### Should fix — true but overstated, and cheap to make bulletproof

**3. L221 and L483-485 (claim 9).** Drop the superlative in both places. "the longest-standing
complaint in this category" / "the single longest-standing complaint in this category" is not
provable. Keep the fact, which is: jellyfin/jellyfin#6709, opened 2021-10-17, still open,
39 comments, last activity 2026-09-04, with a fix attempt (PR #17781) closed unmerged that same day.

**4. L435 (claim 7).** "Jellyfin's BoxSet is the only real precedent" — `Playlist` is the better
example and `Folder` is the accurate one. Either say "Jellyfin's `Folder` subclasses are the only
real precedent", or cite `Playlist`, which is the one where the pattern is load-bearing (it is the
only Jellyfin container that allows duplicate members and hand ordering). Also worth knowing as a
live counter-example to the prompt's own "eight kinds, no enum creep" rule: Jellyfin's
`BaseItemKind` reached **36 values**.

**5. L539-540 (claim 18).** "the industry floor, which Emby states as a requirement" overstates it
twice. Emby's API reference says progress "should be reported ... Automatically every 10 seconds",
and its stated reason is a *ceiling* — "not necessary to automatically report more often than at 10
second intervals", because the server extrapolates at 1 Hz. Suggested: *"Save every 10 seconds.
Emby's API reference tells clients to report 'automatically every 10 seconds' plus immediately on any
user interaction, and Jellyfin's web client ships exactly that interval."*
**And add the second half of Emby's rule, which the prompt omits: report immediately on user
interaction as well as on the timer.** A 10-second timer alone loses up to 10 seconds on a
pause-and-close, the common case.

**6. L589 (claim 14).** "thousands of strangers" is unprovable (install counts are not published)
and unnecessary. "Every default Jellyfin install calls TMDb as the same customer" is both stronger
and checkable.

### Additions that make existing sentences citable

**7. L50-51 (claim 2).** Add the reference: Jellyfin feature request **#1733**, 54 votes, open since
2022-08-21, at features.jellyfin.org. The quoted phrase is verbatim from the post body.

**8. L54-55 (claim 3).** Can be sharpened: `MetadataResult.Provider` is not merely unpersisted, it is
**never read anywhere in the codebase** — one write at `MetadataService.cs#L974`, zero reads. And the
12.0 EF Core rewrite had every opportunity to add a provenance column and did not.

**9. L463-464 (claim 8).** Add: "and its entire lock vocabulary is nine booleans" —
`MetadataField` is a nine-value enum (`Cast, Genres, ProductionLocations, Studios, Tags, Name,
Overview, Runtime, OfficialRating`), and nothing outside those nine fields can be locked at all.

**10. L589-590 (claim 14).** The sharpest single line available is Jellyfin's own comment on the
per-instance TMDb key: *"This is intentionally excluded from the settings page as the API key should
not need to be changed by most users."* Default empty, absent from `config.html`, silent fallback to
the shared key.

**11. L182-183 (claim 5).** The sentence is accurate for the 12.0 line and could add: "and in the
shipping release it is not even a key — membership is a position in a JSON array inside a blob
column, so an external reference to a placement is not fragile, it is impossible."

**12. L539-542 (claim 19).** Cite Jellyfin as the worked counter-example for "ONE number clears the
position": it ships **five** such numbers (`MinResumePct` 5, `MaxResumePct` 90,
`MinResumeDurationSeconds` 300, `MinAudiobookResume` 5 min, `MaxAudiobookResume` 5 min), needed a
second code path in **absolute minutes** as soon as audiobooks arrived, and still judges video on a
percentage. `MinResumeDurationSeconds = 300` is exactly the prompt's five-minute force-complete.

**13. L560 (claim 11).** The predicate can be quoted directly:
`IsCountableLeaf = b => !b.IsFolder && !b.IsVirtualItem`. The inconsistency is provable inside one
file: `ItemCountService.GetPlayedAndTotalCount…` ignores the user's preference entirely, while
`GetChildCountBatch` forty lines below honours it (`var includeVirtual = user is null ||
user.DisplayMissingEpisodes;`). So a user who turns on "display missing episodes" sees them listed,
sees them in the child count, and sees them dropped from the watched percentage.

**14. L566-569 (claim 12).** The comment can be quoted verbatim: *"// Members of a group are distinct
folders, so their leaves cannot overlap."* — `ItemCountService.cs#L549`, guarding a bare `+=` sum
with no dedup. This is the single best citation in the whole set.

**15. L681-684 (claim 16).** The prompt's paraphrase is sound and does **not** carry the unverifiable
quotation, so nothing is broken. To make it citable, attach the two maintainer (`cvium`) comments on
jellyfin/jellyfin#3356 (opened 2020-06-16, still open): 2020-11-06 *"It's unlikely to be fixed before
the database rewrite though"*, and 2025-10-20 *"Database has not been redesigned... No work has been
done to fix this in 10.11."* The second is the valuable one — it confirms the 12.0-era database work
did not fix it. **Do not** introduce the sentence "the database currently uses a person's name as
their unique identifier... There's no fix for this currently until the database has been redesigned"
into the document: it appears nowhere in the `jellyfin` GitHub organisation.

**16. L748-768, CLIENTS (claim 20).** Not currently in the document, and it is the cheapest available
support for phone-before-TV from a second, independent stack. Add after the tvOS argument:
*"Jellyfin's own web client makes the same split for the same reason — its React rewrite has excluded
the TV layout since it began, and its contributing guide still says so: 'Modern App ... Does not
currently support TV layout!'"* It is enforced in code, not just documented: `LegacyLayoutModes`
hard-codes TV as a legacy layout and `RootAppRouter` forks the entire route table on it.

### Warning, not an edit

**L562-565 (claim 13).** "Container progress is computed on read from the ancestor closure, deduped
with `COUNT(DISTINCT item)`, never stored" is the decision Jellyfin's
`SupportsUserDataFromChildren` comment argues *against*. Jellyfin computes on read too, and had to
switch it off for its largest containers with the comment "// These are just far too slow.", then in
12.0 add a batched path "to avoid N+1 queries". The decision stands (count-based, single-user), but
the ancestor closure and the batch path are where it will bite, and Jellyfin's comment is the primary
source saying so. Worth a sentence in the prompt so it is not discovered late.

---

*Checked 2026-09-06 against `jellyfin/jellyfin` `66d038c` (12.0-rc7) and `1fbd873` (v10.11.11), and
`jellyfin/jellyfin-web` `a1c2e13`.*
