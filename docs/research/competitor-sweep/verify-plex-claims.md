# Verifying the Plex and Emby claims in `prompt.md`

STATUS: complete (2026-09-06)

Every factual claim about Plex (and the one about Emby) in `prompt.md`, checked against primary
sources.

**Access note (corrected during the session).** Every `plex.tv` host — support, forums, developer,
blog — fails direct WebFetch, with a TLS `unable to get local issuer certificate` error rather
than the 403 originally assumed. What works: **`curl -sL "https://r.jina.ai/<url>"`** for all four
hosts, and the Playwright MCP browser for support.plex.tv. Use curl rather than WebFetch on the
jina proxy, because WebFetch summarises and destroys the verbatim wording needed for quoting.
Discourse threads render only the first post through the proxy; individual post permalinks
(`/t/<slug>/<id>/<post-number>`) render in full.

Primary sources used, in rough order of reliability for the data model:

- **python-plexapi** (https://python-plexapi.readthedocs.io/, source
  https://github.com/pkkid/python-plexapi) — the most faithful public description of Plex's
  actual object model. Evidence here is release **4.18.2** (2026-07-10).
- **developer.plex.tv/pms** — the official PMS API documentation, spec version 1.2.2.
- Plex support articles, the Plex blog, and Plex staff posts on forums.plex.tv.
- The local schema dumps in `docs/research/plex-schema-dumps/` are **bare table-name
  lists**, not full schemas — they confirm a table exists and (via `migrations.tsv`) date the
  build, and nothing more. They carry no column definitions.

Verdicts are appended as each claim is finished.

---

**Evidence baseline.** Current PMS is the 1.43.x line (1.43.2.10687 / 1.43.4.10903 betas
circulating in 2026). python-plexapi evidence is from `master` as fetched 2026-09-06; latest
PyPI release 4.18.2 (2026-07-10). The local schema dumps in
`docs/research/plex-schema-dumps/` are from a PMS whose migration ladder ends at
`202507311200`, i.e. a build from **July 2025 or later**.

Dead link to be aware of: `https://support.plex.tv/articles/207124326-episode-ordering/` is gone;
the live article is `advanced-setting-plex-tv-series-agent`.

**Sections are in the order they were finished, not numeric order.** Index:

| # | Claim | Verdict | Line |
|---|---|---|---|
| 1 | Item cannot exist without a file | CONFIRMED | 421 |
| 2 | Episode ordering one global setting per library | **OUTDATED** | 63 |
| 3 | Cross-library collections by exact same NAME | CONFIRMED | 123 |
| 4 | Library typed by medium | CONFIRMED / partly on wording | 480 |
| 5 | Smart collections not hand-orderable | PARTLY CONFIRMED | 158 |
| 6 | File identity hash | **CONFIRMED, reproduced byte-exactly** | 216 |
| 7 | `edition_title`; editions vs versions | PARTLY CONFIRMED, 2 errors | 749 |
| 8 | Unscrobble zeroes the count | PARTLY CONFIRMED | 892 |
| 9 | `isPlayed = viewedLeafCount == leafCount` | CONFIRMED | 532 |
| 10 | Plug-ins closed 2018, reopened 2025 | PARTLY CONFIRMED, 1 clause **WRONG** | 584 |
| 11 | "will typically not work" | PARTLY CONFIRMED, misquote | 673 |
| 12 | 10s/20s save; 16-week window | CONFIRMED with corrections | 703 |
| 13 | Multi-version pick | CONFIRMED | 961 |
| 14 | Emby: 10s requirement; HTML core + native Apple TV | PARTLY CONFIRMED both halves | 1003 |

Full summary and the corrections prompt.md should absorb are at the end of this file.

---

## Claim 2 — "Plex's episode ordering is ONE GLOBAL SETTING PER LIBRARY"

Prompt line 51 (WHY THIS DOES NOT ALREADY EXIST, reason 2 "ORDERING LIVES IN FILENAMES").

**Verdict: OUTDATED.** True historically; not true since PMS **1.40.4** (July 2024).

Primary evidence — per-show ordering exists:

> "As of Plex Media Server version 1.40.4 (and when using the **Plex TV Series** agent), it is
> possible to set the appropriate episode order for a TV series (based on alternate orders
> available from The TVDB for that series), after it has been successfully matched. **This is
> available from the Advanced tab, when editing the TV show.**"
>
> — PlexInfo (tagged *Plex Employee*), "TVDB Alternate Orders", Plex Forum Announcements,
> **2024-07-10**. https://forums.plex.tv/t/tvdb-alternate-orders/882249

The same post shows the UI for *Iron Chef*: "we can see the different options available from
**the Episode ordering preference, when editing that show**", with `TheTVDB (US)` selected.

The library-level setting also still exists, so it is *both*, not either/or:

> "**Episode Ordering**: How episodes are named/numbered on disk. If your naming follows The
> MovieDB or TheTVDB choose that here."
>
> — https://support.plex.tv/articles/advanced-setting-plex-tv-series-agent/ (retrieved 2026-09-06)

These are two different settings sharing a name. The **library** one is a scanner/matching hint
about which database your *filenames* follow. The **per-show** one selects which of TheTVDB's
published alternate orders Plex presents for that series.

**What is true NOW:** a library-wide "Episode Ordering" default under the TV library's Advanced
tab, **plus** a per-show "Episode ordering" override on the individual show's Advanced edit tab,
added in PMS 1.40.4 (2024-07).

Conditions that keep the underlying CanonCore point alive:

- The per-show override requires the **Plex TV Series** agent; not available on legacy agents.
- The options are **not** a fixed aired/DVD/absolute menu. They are whatever alternate orders
  TheTVDB publishes *for that series* (TVDB "Flexible Seasons"), so the dropdown differs per show
  and is empty for series with only one published order.
- A metadata refresh is required before new orders appear.
- **TMDB episode groups are still NOT implemented.** The canonical thread is titled "Support
  Alternate Order / Flexible Seasons (TVDB) **[implemented]** and Episode Groups (TMDB)
  **[open]**"; a Plex representative: "I know it is being looked into but I cannot promise any
  sort of ETA or even if it will definitely be implemented or not."
  https://forums.plex.tv/t/support-alternate-order-flexible-seasons-tvdb-implemented-and-episode-groups-tmdb-open/537737
  (latest post seen 2025-02-25)
- No evidence of a per-show "custom seasons" feature.

**Effect on the CanonCore decision.** The decision it supports — multiple orderings per item,
order living on the placement — is **NOT affected**. Plex still gives you exactly ONE ordering
in force per show at a time: picking TheTVDB (US) order replaces the aired order, it does not
sit alongside it. But the prompt's *stated reason* is now factually wrong as written and will
be caught by anyone who checks.

**Suggested rewrite for prompt.md line 51:**
`Plex allows ONE episode ordering in force at a time — a library default plus, since PMS 1.40.4, a per-show override — never two orderings at once.`

---

## Claim 3 — "A Plex collection can only appear to span libraries when the collections carry exactly the same NAME, matched as strings"

Prompt lines 56–59 (reason 4, "NOTHING LINKS ACROSS LIBRARIES").

**Verdict: CONFIRMED.** Plex's own documentation uses the phrase "exact same name".

> "The collections details page contains all the items in **that library** that belong to the
> collection. It **can also include items from other libraries that are in a collection with the
> exact same name**. By adding items in different libraries to identically-named collections, you
> can relate them to each other. For instance, you can have Star Wars movies, TV shows, and music
> albums all in a 'Star Wars' collection so they're related to each other."
>
> — https://support.plex.tv/articles/201273953-collections/ (article last modified
> **2024-12-27**, retrieved 2026-09-06)

Structural confirmation from python-plexapi (`master`, fetched 2026-09-06,
https://github.com/pkkid/python-plexapi/blob/master/plexapi/collection.py): a `Collection`
carries exactly one library section (`librarySectionID`, `librarySectionKey`,
`librarySectionTitle`), and creation requires exactly one `sectionId` for both manual and smart
collections. A collection cannot even mix media *types* within one library — `addItems` raises
`BadRequest(f'Can not mix media types when building a collection: {self.subtype} and {item.type}')`.

What actually happens in the UI: a *related-items row* on the collection details page, not a
merged collection. You still have N separate collection objects, one per library; filtering, the
library Collections tab and the collection's own item list all stay library-scoped.

Nuance: music is second-class ("there are no 'collection details page' screens in music
libraries"), and "Collection tags cannot be added to photos" at all. The widely repeated forum
claim that same-named *smart* collections began cross-referencing like manual ones in 2024 is
**unverified** — the support article does not distinguish smart from manual in that paragraph.

**Effect on the CanonCore decision:** none. The claim stands as written.

---

## Claim 5 — "the split Plex ships as manual versus smart collections, and its smart collections deliberately cannot be hand-ordered"

Prompt lines 195–198 (placements, hand-placed vs rule-derived containers).

**Verdict: PARTLY CONFIRMED.** Both factual halves are correct. The word **"deliberately" is not
evidenced** — it is a documented and enforced limitation, not a stated design intent.

(a) Both kinds ship — CONFIRMED. The Collections article has distinct "Creating a Manual
Collection" and "Creating a Smart Collection" sections (smart requires "Plex Media Server 1.22.3
or newer, Plex Web 4.56.3 or newer"). python-plexapi mirrors this with a `smart` boolean and
separate `_createCollection` / `_createSmartCollection` paths.

(b) Smart collections cannot be hand-ordered, manual ones can — CONFIRMED by Plex directly:

> "**Custom Collection Order** — The content of regular 'dumb' collections can be reordered in any
> arbitrary way the server admin chooses. This requires Plex Web App v4.61.2 or newer. When on the
> collection details page, the posters of items in the collection will have a drag handle on the
> top center when hovering over them. Simply drag-and-drop the items to the desired order. **This
> is not available for 'smart' collections, which are always ordered by the sort chosen when
> creating or editing the filter for the smart collection.**"
>
> — https://support.plex.tv/articles/201273953-collections/ (last modified 2024-12-27)

python-plexapi enforces exactly this:

```python
def sortUpdate(self, sort=None):
    if self.smart:
        raise BadRequest('Cannot change collection order for a smart collection.')
    sort_dict = {'release': 0, 'alpha': 1, 'custom': 2}

def moveItem(self, item, after=None):
    if self.smart:
        raise BadRequest('Cannot move items in a smart collection.')
```

Independent confirmation — Kometa: "The only downside of using smart collections is that they are
**unable to be sorted by `custom`** (which uses the order of the original builder)."
https://kometa.wiki/en/latest/files/settings/ (retrieved 2026-09-06)

Still true in late 2025: "Add Collection sorting option to smart collections", Plex Feature
Suggestions, posted **2025-11-19**,
https://forums.plex.tv/t/add-collection-sorting-option-to-smart-collections/933639 — still open,
answered only by a community member with a workaround.

**Why "deliberately" fails.** No Plex statement of intent exists. The support article states the
behaviour with no rationale; the 2025 feature request sits open in Feature Suggestions rather
than closed as wont-fix. There is also a plainly mechanical explanation that undercuts the word:
a smart collection stores a filter URI (`content`), not a membership list, so there is no
persisted per-item row on which an arbitrary index could hang.

**Effect on the CanonCore decision:** none — the rule ("a rule-derived container carries NO
order") is unaffected. But **drop the word "deliberately"** from prompt.md line 198. If a causal
claim is wanted, "because a smart collection stores a filter rather than a member list" is
defensible.

---

## Claim 6 — File identity: `SHA1(size + SHA1(first 64KB) + SHA1(last 64KB))`

Prompt lines 266–275 (`files` table). This is the highest-stakes claim: the prompt reproduces
the algorithm byte-exactly as an implementation instruction.

**Verdict: CONFIRMED** — positive algorithm, **reproduced byte-exactly this session against real
file bytes**. **CONFIRMED** that the widely repeated "Plex hashes the first 4KB" is wrong.
**PARTLY CONFIRMED** on the irony claim (see 6c).

**The algorithm in prompt.md is safe to implement**, with two encoding details that must be added
or two implementations will disagree — see "Effect on the CanonCore decision" at the end.

### 6a. The algorithm — CONFIRMED

The authoritative public statement, with a worked example, is from **gbooker02** (Plex staff
developer; Grayson Booker) on the Plex forum:

> "There are a few steps:
> - Create a string with the filesize in decimal
> - Take the SHA1 hash of the first 64kB (65536 bytes) and append this to the string in hex.
> - If the file is greater than 64kB, do the same with the last 64kB
> - SHA1 hash this string
>
> As an example, let's look at a copy of Big Buck Bunny:
> - The file size is 928670754 bytes
> - The first 64kB has a SHA1 hash of `87a82ca143a5d84ba4ba33f421f25fbac9811f89`
> - The last 64kB has a SHA1 hash of `ce2f3dd83c1cc4ffa4deda5588a9118be004ce09`
> - Take the SHA1 hash of
>   `92867075487a82ca143a5d84ba4ba33f421f25fbac9811f89ce2f3dd83c1cc4ffa4deda5588a9118be004ce09`
> - This is `782e3038c7290470c29320a840e5f92123912e56` **which matches the `hash` column in the
>   `media_parts` table** if you add this exact file to it."
>
> — gbooker02, "How is Plex hash calculated?", Plex Forum, **2025-02-12**.
> https://forums.plex.tv/t/how-is-plex-hash-calculated/904178 (thread closed 2025-05-13)

This matches the prompt's `SHA1(size + SHA1(first 64KB) + SHA1(last 64KB))` exactly, and it
names `media_parts.hash` as the destination column, which is the claim decisions.md makes.

**Format details the prompt's one-line form does not carry, and an implementer needs:**

1. The size is the **decimal file size rendered as ASCII digits**, not a packed integer.
2. The two digests are appended as **lowercase hex strings**, not raw bytes.
3. There are **no separators** and **no trailing newline** — the input is one concatenated
   ASCII string of `len(str(size)) + 40 + 40` characters.
4. **The last-64KB term is conditional.** gbooker02: "*If the file is greater than 64kB*, do the
   same with the last 64kB." For a file of 64KB or smaller the input is size + one digest only.
   The prompt's unconditional form is wrong for small files. Note this is an edge case for a
   media catalogue but it is exactly the kind of thing that makes two implementations disagree.
5. It is unspecified in that post whether the boundary test is `> 65536` or `>= 65536`, and
   whether a file between 64KB and 128KB overlaps its two windows (it must — the last 64KB of a
   100KB file overlaps the first 64KB). Decide this deliberately in CanonCore and write it down.

**Independent corroboration that the value is a 40-hex SHA1 exposed on `MediaPart`** — a real
`/library/metadata/<id>/tree` response posted on the Plex forum:

> `<MediaPart id="152394" file="/share/CACHEDEV1_DATA/video/movies/2 Minutes Later (2007) {imdb-tt0892033}/2 Minutes Later {imdb-tt0892033}.avi" size="734126080" openSubtitleHash="984c8c89827d1183" hash="78f6d4b11c856296ddf624b1eee47fe71110dfd7" duration="4094136">`
>
> — dane22, "What algorithm does plex use to get database hash value?", **2022-08**.
> https://forums.plex.tv/t/what-algorithm-does-plex-use-to-get-database-hash-value/803621

Note in that same XML that Plex ALSO stores `openSubtitleHash` (the 16-hex OpenSubtitles hash),
which is a *different* algorithm — do not confuse the two. `size`, `hash` and `openSubtitleHash`
are all first-class attributes on a media part.

**Column existence — confirmed from real DDL, not a forum post.** Four independent sources carry
the identical `media_parts` definition:

```sql
CREATE TABLE IF NOT EXISTS "media_parts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "media_item_id" integer,
  "directory_id" integer, "hash" varchar(255), "open_subtitle_hash" varchar(255),
  "file" varchar(255), "index" integer, "size" integer(8), "duration" integer,
  "created_at" dt_integer(8), "updated_at" dt_integer(8), "deleted_at" dt_integer(8),
  "extra_data" varchar(255));
CREATE INDEX "index_media_parts_on_directory_id" ON "media_parts" ("directory_id");
CREATE INDEX "index_media_parts_on_media_item_id" ON "media_parts" ("media_item_id");
CREATE INDEX "index_media_parts_on_hash" ON "media_parts" ("hash");
```

— `danrahn/MarkerEditorForPlex`, `Test/TestHelpers.js` (a maintained Plex tool that replicates the
live schema); corroborated verbatim by `cgnl/plex-postgresql` (`schema/sqlite_schema.sql`, and a
Postgres translation with `hash text`), `mutanthost/plex_schema` (`plexschema.sql`,
`hash VARCHAR (255)`), and a sample `com.plexapp.plugins.library.sqlite3` in
`alberanid/medialocator`.

Two things follow directly. **`index_media_parts_on_hash` exists**, which confirms decisions.md's
"stores it in an indexed column" — the data to solve move detection is not merely present but
indexed for lookup. And `media_parts.media_item_id` is an FK to `media_items`, which bears on
claim 7 (see below).

The local dumps in `docs/research/plex-schema-dumps/` confirm only that the `media_parts`
**table** exists in a PMS whose migration ladder ends `202507311200` (July 2025+); they are bare
table-name lists with no column definitions.

**Encoding verified byte-exactly this session (2026-09-06).** Taking gbooker02's two stated
intermediate digests, the final step reproduces his published result exactly, and only in one
encoding:

```
$ printf '%s' "92867075487a82ca143a5d84ba4ba33f421f25fbac9811f89ce2f3dd83c1cc4ffa4deda5588a9118be004ce09" | shasum -a 1
782e3038c7290470c29320a840e5f92123912e56     <-- matches
$ printf '%s\n' "<same string>" | shasum -a 1
a0d8510aa7c60ed960a8fbb9b2cc002ebe0fb8e3     <-- trailing newline breaks it
$ <same string, uppercase hex> | shasum -a 1
61163826c988387ccd5f3859dab54044272a0a9a     <-- uppercase hex breaks it
```

So the concatenation format is settled: **ASCII decimal size, lowercase hex digests, no
separators, no trailing newline.** What this does *not* prove is that the two intermediate
digests came from the real file — for that, see below.

**Reproduced byte-exactly against the real file bytes, 2026-09-06.** The bare
`big_buck_bunny_1080p_surround.avi` URL is now HTTP 404 (Blender re-published that directory as
`.zip` archives; the nluug and clarkson mirrors 404 too). But the `.zip` stores the AVI
**uncompressed** — its local file header reads `method=0 (stored)`,
`usize=928670754` (which independently corroborates gbooker02's stated file size), data beginning
at byte 91 — so both 64KB windows are reachable by HTTP range request without downloading 886MB:

```
$ curl -sI .../big_buck_bunny_1080p_surround.avi.zip     -> accept-ranges: bytes
$ curl -s -r 0-199 <zip>  ->  PK\x03\x04, method=0, csize=usize=928670754, data offset 91

$ curl -s -r 91-65626 <zip> | shasum -a 1
87a82ca143a5d84ba4ba33f421f25fbac9811f89     == gbooker02's first-64KB digest
$ curl -s -r 928605309-928670844 <zip> | shasum -a 1
ce2f3dd83c1cc4ffa4deda5588a9118be004ce09     == gbooker02's last-64KB digest
$ printf '%s' "928670754""87a82ca1…1f89""ce2f3dd8…ce09" | shasum -a 1
782e3038c7290470c29320a840e5f92123912e56     == gbooker02's published Plex hash
```

All three digests match on real bytes. Total transfer: 128KB plus a 200-byte header read — which
also demonstrates the prompt's "128KB per file" cost figure in practice.

**The one residual gap, stated plainly.** This proves the *algorithm as published by a Plex
developer* reproduces his published `media_parts.hash` value. It does not independently prove that
a live Plex server writes that value, because there is no Plex Media Server on this machine (no
`~/Library/Application Support/Plex Media Server`, no Plex.app, no Docker) to compare against.
The remaining link rests on gbooker02's statement "which matches the `hash` column in the
`media_parts` table if you add this exact file to it", plus decisions.md's record that an earlier
session reproduced it against a known file. **What would close it:** on any running Plex server,
compute this over a library file and compare with `media_parts.hash`, or call
`GET /library/hashes?url=file://<path>`, which returns the same value.

### 6b. The negative claim — "Plex hashes the first 4KB" is WRONG — CONFIRMED

The myth is traceable to a single wrong answer from a community moderator, and the thread itself
records that it does not reproduce:

> "Plex reads the first block from the file (4K) and generates the hash from there. It doesn't
> make sense to hash the entire file as that would be wasteful and resource intensive."
>
> — ChuckPa (community moderator, **not** Plex staff), **2022-08-07**.
> https://forums.plex.tv/t/what-algorithm-does-plex-use-to-get-database-hash-value/803621

The asker immediately tried it and it failed: `dd count=1 ibs=4k < "$file" | openssl sha1` gave
`b024d1b7910d423fdb59b5687bcf97519f056771`, which did not match the database. A second user
falsified it independently three years later:

> "I added some media to Plex, grabbed the hash and wrote a quick program that reads one byte at
> a time, then calculates the hash and there was seemingly no match… Then to test the theory
> found in the other post where they claimed Plex only takes the first 4K block, so I used dd on
> the original file to produce a file with the same beginning, just cut off after 10 MB and the
> hash was different… So it can't be just that."
>
> — diniboy, **2025-01-31**. https://forums.plex.tv/t/how-is-plex-hash-calculated/904178

A third suggestion in that thread — "Try reading 4 KB from the beginning and 4k from the end.
Concatenate these and compute the overall hash" (OttoKerner, 2025-02-11) — also failed. The
correct answer arrived only when a Plex developer posted it. So: the 4KB claim is **WRONG**, it
is **widely repeated**, and the prompt is right to say so.

### 6c. The irony claim — PARTLY CONFIRMED

The prompt (line 269–270) says Plex "computes this on every file and then does not use it to
relink moves". decisions.md adds that Plex's analysis bundle is content-addressed, so thumbnails
and the BIF index survive a move while the library item is destroyed.

- **"Computes it on every file and does not use it to relink moves"** — supported. The hash is
  present on every scanned `MediaPart` (see the XML above) and is an indexed column, yet moving a
  file produces a new item and loses watch state; that is the universally reported behaviour and
  the reason both threads above exist (diniboy was trying to *rebuild* a library from hashes
  precisely because Plex would not do it). Treated as CONFIRMED in substance.
- **The content-addressed analysis bundle** — the bundle path shape is confirmed by a real
  example: hash `76f2d227168c81291c7a1bc7a21af5b5cef654fe` maps to
  `Media/localhost/7/6f2d227168c81291c7a1bc7a21af5b5cef654fe.bundle` (first hex char as the
  shard directory), from "Sharing info", Plex Forum Dev/API Corner, 2013/2014,
  https://forums.plex.tv/t/sharing-info/47258. That establishes bundles are addressed by a hash,
  **but I did not confirm that the addressing hash is the `media_parts.hash` content hash rather
  than a hash of the item GUID**, and I did not confirm that thumbnails/BIF survive a move.
  **That sub-claim is UNVERIFIABLE from what I found.** It does not appear in prompt.md — only in
  decisions.md — so it is not load-bearing for the prompt.

### Effect on the CanonCore decision

**The decision stands and the algorithm in prompt.md is safe to implement**, with two
corrections that should be made to prompt.md line 267 so an implementer cannot get it wrong:

1. State the encoding: `SHA1(ascii(decimal size) + hex(SHA1(first 64KB)) + hex(SHA1(last 64KB)))`,
   no separators, no trailing newline.
2. State that the last-64KB term is **omitted for files of 64KB or smaller**, per Plex.

The "128KB per file" cost figure (line 270) is correct for files over 128KB.

---

## Claim 1 — "IN JELLYFIN AND PLEX AN ITEM CANNOT EXIST WITHOUT A FILE"

Prompt lines 46–48 (reason 1). Only the Plex half is assessed here.

**Verdict: CONFIRMED.** Plex is a *stronger* example for this point than the prompt realises.

Evidence:

- The item is a projection of the file. *Emptying Library Trash*,
  https://support.plex.tv/articles/200289326-emptying-library-trash/ (last updated **2025-03-25**):
  > "If you move or delete the file for a library item or if the file somehow becomes unavailable,
  > then the library item will be placed into the 'trash' on your Plex Media Server." … "If you
  > perform an 'Empty Trash' on your Server, then the item is discarded from the trash and can no
  > longer be automatically restored."
- Unowned content is **not a library item at all**. *Discover Source*,
  https://support.plex.tv/articles/discover/ (last updated **2025-11-07**): "the Plex app asks the
  Plex Media Servers you have access to whether there are any items matching what you're viewing",
  and Plex "does not maintain lists of server contents." Discover/Watchlist rows are cloud objects
  on different hosts — python-plexapi `myplex.py:128-129` declares
  `DISCOVER = 'https://discover.provider.plex.tv'` and
  `METADATA = 'https://metadata.provider.plex.tv'`. The Universal Details page **is** the cloud
  item and your server is queried as a *source* for it. Watch state on those rows is a per-account
  cloud `UserState` read from `{METADATA}/library/metadata/{ratingKey}/userState`
  (`myplex.py:1030`), not the library's `viewCount`. The only mutations are
  `addToWatchlist`/`removeFromWatchlist`; there is no metadata-edit path, because plexapi's edit
  mixins operate on `/library/sections/<id>/all`, which a Discover item has no membership in.

**Precise answer to "real item vs placeholder": neither.** Plex renders no placeholder for an
unowned episode. There is no library `ratingKey`, no section row, no owner-editable metadata.

**Correction to a premise, worth carrying into the report.** The "Show missing episodes" /
"Include missing" setting is an **Emby/Jellyfin** feature, not a Plex one. In Plex it is a
12-year-old unimplemented request: https://forums.plex.tv/t/option-to-show-missing-seasons-and-episodes/77834
(opened **2014-09-29**, still open), with the 2019 duplicate
https://forums.plex.tv/t/feature-suggestion-show-missing-episodes-in-library-show-warning-if-auto-play-will-skip-a-missing-episode/427998
closed same day by a Plex Ninja as a duplicate. The current Plex TV Series agent advanced-settings
list (https://support.plex.tv/articles/advanced-setting-plex-tv-series-agent/) contains no such
option, and `grep -ri "includeMissing|missing|unavailable|placeholder"` across python-plexapi
returns nothing. A **2026-07-19** request,
https://forums.plex.tv/t/showing-the-availability-on-new-episodes-and-seasons-on-tv-shows/940795,
is still asking for unowned episodes to be surfaced on a library show page.

Nuance:

1. **Container items genuinely have no file of their own** — `Show`, `Season`, `Artist`, `Album`,
   `Photoalbum`, `Collection` are first-class rows with their own ratingKey and editable metadata
   and no media. plexapi encodes this: `Movie`/`Episode`/`Clip` are `Playable`, `Show`/`Season`
   are not (`video.py:332-333, 530-531, 780-781, 962-963`). But they are created by scanning
   descendants that do have files and vanish when the last one goes. The claim holds in the sense
   the prompt means it: nothing in a Plex library exists that is not rooted in a file you own.
2. Transient exception: between deleting a file and emptying the trash the item outlives its file.
   That is a pending-deletion state, not a catalogue entry.
3. DVR scheduled recordings live in the DVR Schedule, a separate surface, not the library
   (https://support.plex.tv/articles/225976308-manage-your-recordings/, updated 2024-10-10).

**Effect on the CanonCore decision:** none. Claim stands as written.

---

## Claim 4 — "a Plex library is typed, and that is exactly what stops a container holding mixed media"

Prompt lines 141–142 (`groups`, WHY never typed by medium).

**Verdict: CONFIRMED on the facts; PARTLY CONFIRMED on the causal wording** "that is exactly what
stops".

Libraries are typed and the type is fixed at creation:

- *Creating Libraries*, https://support.plex.tv/articles/200288926-creating-libraries/ (last
  updated **2025-04-13**): five UI types — Movies, TV Shows, Music, Photos, Other Videos — and the
  user must "Choose the basic type of media this library represents."
- Only **four** API `section_type` values exist. python-plexapi `library.py:46-57`:
  `{'movie': MovieSection, 'show': ShowSection, 'artist': MusicSection, 'photo': PhotoSection}`.
  "Other Videos" is `type=movie` with agent `com.plexapp.agents.none` and the Plex Video Files
  Scanner — https://www.plexopedia.com/plex-media-server/api/library/add/ ("when using the Web app
  to add a library, there are five types, but two use the same type when using the API"),
  corroborated at https://forums.plex.tv/t/personal-media-agent-changes-library-type/752561
  (2021-10-23).
- *Editing Libraries*, https://support.plex.tv/articles/200289266-editing-libraries/: "When editing
  a Library, you can change every setting except the type (Movie, TV Show, etc.)." Still true —
  the standing request https://forums.plex.tv/t/let-us-change-the-library-type-after-creation/642403
  is open and `LibrarySection.edit()` exposes no type change.

Mixed media is refused at container level too:

```python
# plexapi/collection.py:324-325
if item.type != self.subtype:
    raise BadRequest(f'Can not mix media types when building a collection: {self.subtype} and {item.type}')
# plexapi/playlist.py:257-259
if item.listType != self.playlistType:
    raise BadRequest(f'Can not mix media types when building a playlist: ...')
```

**Where the wording overstates.** Three different type systems are doing the work at three levels,
so "that is exactly what stops" over-attributes it to the library:

1. A **Photos library genuinely holds mixed media** — home videos alongside photos, with a library
   setting for home-video previews. Movie libraries also hold extras/trailers (`Clip`, type 12);
   Music libraries hold artist music videos.
2. **Playlists are gated by `listType` (audio/video/photo), which is coarser than library type** —
   a video playlist *can* mix a movie and a TV episode from two different libraries.
3. Collections are constrained by `sectionId` **and** `subtype`, i.e. two mechanisms of which
   library type is only one.

**Effect on the CanonCore decision:** none — "never typed by medium" survives, and Plex is still
the right cautionary example. Wording that survives scrutiny:
`a Plex library is typed by medium and the type is fixed at creation, and Plex then repeats that typing at every level below it — a collection by subtype, a playlist by audio/video/photo.`

---

## Claim 9 — Completion is `isPlayed = viewedLeafCount == leafCount`, counting what you own

Prompt lines 557–560 ("NOBODY IN THE INDUSTRY DOES THIS").

**Verdict: CONFIRMED**, including the thirteen-episode worked example, and it is **not**
conditional on any setting.

`isPlayed` is literally the count comparison — python-plexapi 4.18.2 (released 2026-07-10),
https://github.com/pkkid/python-plexapi/blob/master/plexapi/video.py:

```python
# Show.isPlayed, video.py:683-686
@property
def isPlayed(self):
    """ Returns True if the show is fully played. """
    return bool(self.viewedLeafCount == self.leafCount)

# Season.isPlayed, video.py:876-879 — byte-identical logic
```

Both counters come straight off the server's XML (`video.py:617, 631, 827, 840`):
`self.leafCount = utils.cast(int, data.attrib.get('leafCount'))` and likewise
`viewedLeafCount`. Docstrings: "leafCount (int): Number of items in the season view."
"viewedLeafCount (int): Number of items marked as played in the season view."

**This is the server's model, not a plexapi convenience.** `Show` and `Season` carry no
`viewCount` at all — only the `Video` base class reads one (`video.py:29, 64`), and it lands on
`Movie`/`Episode`/`Clip`. The server ships `leafCount`/`viewedLeafCount` on the Directory elements
and no per-container play flag, so *any* client's "fully watched" for a season is necessarily
derived from those two integers.

**`leafCount` counts only what was scanned**, which follows decisively from Claim 1: Plex has no
representation for an episode it has not scanned — no placeholders, no `includeMissing`, no
setting. Own 3 of 13, watch all 3, and `viewedLeafCount == leafCount == 3` → `isPlayed` is True
and the season shows fully watched with no unwatched badge. **The prompt's worked example is
exactly right, and unconditional across every library and agent.**

Wording nuance: **"files on disk" is loose.** `leafCount` counts episode *metadata items*, not
files, and the two diverge both ways — one episode with several versions is several files but one
leaf; one file holding `S01E01-E02` is one file but two leaves. Accurate phrasing:
`children that exist only because you own a file`. Also: `viewedLeafCount` is per-user (Plex Home
managed users each have their own), so `isPlayed` is per-viewer.

"Silently" is if anything understated — Plex *does* know the real episode count, on the Universal
Details page served from `metadata.provider.plex.tv`. The library item simply never reconciles
against it. The information is one hop away and is never surfaced as a gap.

**Effect on the CanonCore decision:** none, and the prompt could sharpen the sentence with
"children that exist only because you own a file" in place of "files on disk".

---

## Claim 10 — Plug-ins: opened, closed 2018 at under 2%, seven years, reopened 2025 as a plain HTTP contract

Prompt lines 525–528.

**Verdict: PARTLY CONFIRMED.** The 2% figure and the December 2025 HTTP contract are both real and
the numbers check out, **including the 90-second timeout**. "Closed them in 2018" is wrong: 2018
killed the *directory*, not the framework.

### (a) The 2018 announcement and the 2% figure — CONFIRMED

Plex blog, "Subtitles and Sunsets: Big Improvements, Little Housekeeping", **2018-09-25**,
https://www.plex.tv/blog/subtitles-and-sunsets-big-improvements-little-housekeeping/:

> "💀 **Plugins**: This was not a decision taken lightly … But bluntly, hardly anyone uses them
> (**less than 2% of users**), the ancient protocol they use is a continued pain for clients to
> support, and if we were to build the feature again, we'd do it very differently in this day and
> age. … But don't panic—while the Plugin Directory will soon be gone, **you can still manually
> install plugins for the foreseeable future**."

### (b) "Closed them in 2018" — WRONG as stated

The same paragraph refutes it. What ended in 2018 was the Plugin **Directory**; the companion
forum announcement https://forums.plex.tv/t/discontinuation-of-plugins-watch-later-recommended-and-cloud-sync/312312
(**2018-09-25**) gives the removal date as **2018-10-09**. The real removal ladder:

| Date | Event | Version |
|---|---|---|
| 2018-09-25 | Blog announcement; Plugin Directory to close | — |
| 2018-10-09 | Directory removed; manual sideloading still works | — |
| 2020-02-15 | Support "Overview" still says only that Plex will "slowly remov[e] plugin support … over time" | — |
| 2024-07-25 | Python plug-ins and legacy agents removed, **Android/Nvidia Shield first**; Plex "committed to not remove Python-based plugins from the main operating systems supported by PMS without first providing a viable alternative" (https://forums.plex.tv/t/important-information-for-users-running-plex-media-server-on-nvidia-shield-devices/883484) | 1.41.0 |
| 2025-04-23 | Third-party agents stop working on desktop; Plex staff call it a bug, not a planned removal (https://forums.plex.tv/t/legacy-agents-removed-already-in-pms-1-41-7-9717-2025-04-23/914518) | 1.41.7.9717 |
| 2025-11-18 | "As of Server version 1.43.0 Legacy agents wil not longer be shown when creating new libraries…" (https://support.plex.tv/articles/200241558-agents/) | 1.43.0 |
| 2025-12-09 | Custom Metadata Providers announced; legacy agents to be "completely remove[d] … in 2026" | 1.43.0 beta |

No evidence was found for the framing that 2018 "disabled unsupported plug-ins by default".

### (c) The December 2025 HTTP contract — CONFIRMED, with two corrections

"[Announcement] Custom Metadata Providers", drzoidberg33 (Plex staff), **2025-12-09**,
https://forums.plex.tv/t/announcement-custom-metadata-providers/934384:

> "Many of you know that we removed the old Plug-ins system from Plex Media Server (PMS) many years
> ago but have kept the legacy metadata agents which use this system around until we had a suitable
> replacement … We plan to completely remove the legacy agents system from new PMS releases in
> 2026. … This requires Plex Media Server 1.43.0, which is currently in beta … **Developers are not
> restricted by any one language or technology to write these providers, essentially anything that
> can serve an HTTP API can be used.**"

- **Date — CONFIRMED**, 2025-12-09.
- **Plain HTTP, not sandboxed code — CONFIRMED.** Providers are out-of-process HTTP APIs reached by
  URL: "from local Docker containers, to self-contained binaries or publicly hosted on the
  internet. All the user needs to install a metadata provider is a single URL."
- **`metadata` / `match` feature names — CONFIRMED.** Official API docs,
  https://developer.plex.tv/pms/ (spec version 1.2.2), "Feature Array (Required)", both Required:
  `metadata` — "Path to retrieve metadata for a specific piece of content by its id" (GET);
  `match` — "Path to return a potential match for a specific piece of content using contextual
  hints" (POST with a JSON body).
- **90-second timeout — number CONFIRMED, but NOT documented.** Grepping the full 310 KB of
  developer.plex.tv/pms for "timeout" returns **zero** hits. The only source is a staff aside,
  post #25, **2025-12-11**, https://forums.plex.tv/t/announcement-custom-metadata-providers/934384/25:
  > "Our current timeout on these requests **looks to be** 90 seconds, we **could** make this
  > configurable - how long are you expecting to wait?"
  Presenting 90s as part of the published contract overstates it.
- **No local file access — PARTLY CONFIRMED / overstated.** Same post: "In a sense yes, that's no
  longer possible. However it wouldn't be impossible if your provider was running locally and had
  access to the same files … we already pass hints in the match requests with one of those being
  the filename". So it is a loss of *granted* access, not an enforced sandbox.
- **No scanner hook — CONFIRMED.** Only `metadata` and `match` exist; there is no scanner feature,
  and the July 2024 announcement offered no timeline for third-party scanners.

**Current state (thread activity through April 2026):** still a developer preview. Movie and TV
libraries only (music "No ETA yet, but it will get done at some point", 2026-04-23),
**unauthenticated requests only**, no stream/subtitle metadata, no provider-specific preferences,
"Expect some bugs early on." Custom EPG providers explicitly out of scope (2026-02-10).

### (d) "Stranded the ecosystem for seven years" — arithmetic OK, characterisation misleading

2018-09 to 2025-12 is 7 years 3 months, so "seven years" rounds correctly. But manual installs were
explicitly blessed in 2018 and legacy Python agents kept working on desktop until roughly
2024-2025. The real functional gap is closer to **one to two years** (mid-2024 to Dec 2025).

**Effect on the CanonCore decision:** none — the conclusion ("build it because the model needs many
sources, not as a moat") is if anything reinforced. But the sentence as written contains a
falsifiable error. Suggested rewrite for prompt.md lines 525–528:
`Plex opened plug-ins, shut the plug-in directory in 2018 at under 2% usage, let the legacy agents rot until they broke in 2024-25, and only reopened in December 2025 as a plain HTTP contract.`

---

## Claim 11 — Plex's docs say network-mounted content "will typically not work"

Prompt lines 600–602.

**Verdict: PARTLY CONFIRMED — the finding is right, the quotation is off by one word.**

"Library | Plex Support", https://support.plex.tv/articles/200289526-library/, **last modified
2025-05-04**, under the setting **"Scan my library automatically"**:

> "**Scan my library automatically** — When a change is detected in the source location for a
> library's content, the appropriate library will be scanned.
> **Note**: This function relies on the computer's operating system providing the 'something
> changed' trigger. Some operating systems don't provide this trigger and content mounted via a
> network **will also typically not work**. If your library doesn't automatically scan, you may
> have to set a periodical scan or do it manually."

Corrections:

1. The exact string **"will typically not work" is not a contiguous substring** — Plex wrote "will
   **also** typically not work". prompt.md line 601 presents it inside quotation marks, so **it is
   a misquote by one word.** Fix: quote `"content mounted via a network will also typically not work"`.
2. The setting is called **"Scan my library automatically"**, not "Update my library automatically"
   (the older name).
3. The substance is fully supported, and Plex's own remedy is the one CanonCore adopts: "you may
   have to set a periodical scan or do it manually."

**Effect on the CanonCore decision:** none. Fix the quotation only.

---

## Claim 12 — Save interval 10s LAN / 20s cellular; Plex's 16-week resume window

Prompt line 539 carries only the Emby half (see Claim 14a). The Plex figures live in
decisions.md §3.13 and §3.17; verified here because they underpin "Save every 10 seconds — the
industry floor" and the rejection of a Continue Watching time window.

### (a) 10s LAN / 20s cellular — CONFIRMED, one wording correction

Official PMS API documentation, https://developer.plex.tv/pms/ (spec version 1.2.2), endpoint
**`POST /:/timeline`**, "Report media timeline":

> "This endpoint is hit during media playback for an item. It must be hit whenever the play state
> changes, or in the absence of a play state change, in a regular fashion (generally this means
> **every 10 seconds on a LAN/WAN, and every 20 seconds over cellular**)."

Corrections: Plex says **"LAN/WAN"**, not "LAN" — the 10-second interval covers remote-over-internet
playback too, and only cellular gets 20s. And "generally this means" makes it **guidance to client
implementers**, not a server-enforced interval; what is *required* is a report on every play-state
change.

### (b) 16-week window — CONFIRMED as a number, but it is not a resume-point expiry

https://support.plex.tv/articles/200289526-library/ (last modified 2025-05-04), setting
**"Weeks to consider for Continue Watching"**:

> "Lets you choose how many weeks to check for content to be included in the Continue Watching data
> for a library. **The default value of 16 weeks** is good for the vast majority of users. You can
> lower the value if your Continue Watching is particularly slow to appear."

Three nuances make the claim conditional:

1. It is a **lookback window for inclusion in the Continue Watching row**, not an expiry of the
   resume point. Nothing documents the stored view offset being deleted at 16 weeks. Calling it a
   "resume window" overstates what Plex documents.
2. It is **per-library and admin-configurable**; 16 is the default, not the rule.
3. There is a documented carve-out immediately below it: "Include season premieres in Continue
   Watching … makes episode one of a new season appear even if it falls outside of Weeks to
   consider for Continue Watching".

**Effect on the CanonCore decision:** none. The direction survives — Plex applies a time window to
Continue Watching by default and CanonCore's "No time window, no dismissal" is a genuine
divergence. Describe it as "Plex's default 16-week Continue Watching window (admin-configurable)"
rather than a hard resume-point expiry.

---

## Claim 7 — `metadata_items.edition_title`; editions are rows, versions are not

From decisions.md §2.2 (not prompt.md): "Plex Editions has `metadata_items.edition_title`: each
EDITION is its own row with its own GUID and watch state, each VERSION is another `media_parts`
row under one row. That is the structural reason editions have independent watch status and
versions do not."

**Verdict: PARTLY CONFIRMED.** The observable behaviour is right and `edition_title` is real, but
**the stated structural reason is wrong on two counts**: editions do NOT have their own GUID, and
a version is another `media_items` row, not another `media_parts` row. Both matter, because the
sentence is offered as *the structural reason* for the watch-state difference and as written it
names a structure that would predict the opposite of the observed behaviour.

### `metadata_items.edition_title` exists — CONFIRMED from real DDL

```sql
-- column
INSERT INTO plex.sqlite_column_types VALUES ('metadata_items', 'edition_title', 'VARCHAR(255)');
-- and it is indexed
CREATE INDEX "index_metadata_items_on_edition_title" ON "metadata_items" ("edition_title");
```

Sources, all independent and mutually consistent: `cgnl/plex-postgresql`
(`schema/sqlite_column_types.sql`, `schema/sqlite_schema.sql`, and `schema/plex_schema.sql` where
the Postgres translation reads `edition_title text`), a sample
`com.plexapp.plugins.library.sqlite3` in `alberanid/medialocator`, and
`flaskfarm/plex_mate` (`page_copy_make.py`, which drops
`index_metadata_items_on_edition_title` by name). Live read/write usage in third-party tools:
`iansutherland74/Plex-Database-Editor…` issues `UPDATE metadata_items SET edition_title = …`, and
`txarlye/find_video_duplicates` selects `edition_title` from `metadata_items`.

**The column sits on `metadata_items`**, i.e. on the item row itself, which is the structural
point the claim is making: an edition is a metadata item, so it necessarily carries its own id,
its own GUID and its own watch state.

### A version is another `media_items` row, NOT another `media_parts` row — CORRECTION

The real chain is `metadata_items` → `media_items` → `media_parts`. `media_parts` carries
`media_item_id` (see the DDL quoted under Claim 6), and `media_items` carries `metadata_item_id`.
`danrahn/MarkerEditorForPlex` (`Server/PlexQueryManager.js`) joins exactly that way while reading
the edition:

```sql
SELECT ... movies.edition_title AS edition, MAX(files.duration) AS duration
  FROM metadata_items movies
  INNER JOIN media_items files ON movies.id=files.metadata_item_id
```

So the three levels mean three different things, and conflating the lower two matters:

| Level | What multiple rows mean |
|---|---|
| `metadata_items` | a separate item — a separate **edition**, with its own GUID and watch state |
| `media_items` | a **version** of one item — the 1080p and the 4K of the same film |
| `media_parts` | **parts of one version** — a film split across `CD1`/`CD2` files |

Describing a version as "another `media_parts` row" names the multi-file/stacked-file case, which
is a different feature. **decisions.md §2.2 should say `media_items`.** The conclusion it draws is
unaffected and in fact better supported: versions share one `metadata_items` row, therefore one
watch state; editions are separate `metadata_items` rows, therefore independent watch state.

### The Editions feature itself — CONFIRMED, and newer than the note assumes

> "Blade Runner (1982) {edition-Director's Cut}.mp4" … "The ability to specify different editions
> for a movie requires a Plex Pass subscription for Server admin account."
>
> — https://support.plex.tv/articles/multiple-editions/, **last modified 2026-07-07**

Introduced with the non-legacy Plex Movie agent in **PMS 1.28.1** (Aug 2022); web-app editing of
the Edition field arrived in Plex Web 4.87.1. `editionTitle` is a real python-plexapi attribute in
**4.18.2** — `plexapi/video.py:395` `self.editionTitle = data.attrib.get('editionTitle')`, with the
docstring at line 350 "The edition title of the movie (e.g. Director's Cut, Extended Edition,
etc.)", and it is present on `Show`, `Season` and `Episode` too (lines 610, 824, 1025).

**Currency note.** The movies article still says "There is not support for Editions of TV Shows or
Episodes at this time", but Plex has since shipped TV editions:
https://support.plex.tv/articles/multiple-editions-tv-shows/, **last modified 2026-07-14** —
"Edition display is live now in Plex Web (4.160) and rolling out in the iOS and Android apps
(version 2026.13.0). Roku support is coming in the next release."

### SECOND ERROR — editions do NOT have their own GUID

They **share one GUID** and differ by `ratingKey`. python-plexapi 4.18.2
`plexapi/mixins/editions.py` finds sibling editions by *equal GUID, different ratingKey*:

```python
def editions(self):
    """ Returns a list of ... objects for other editions of the same media. """
    filters = {'guid': self.guid, 'id!': self.ratingKey}
    return self.section().search(libtype=self.TYPE, filters=filters)
```

This matters more than a nitpick, because **the structure the sentence names would predict the
opposite of the observed behaviour**. Watch state lives in `metadata_item_settings`, which is
keyed on **`account_id` + `guid`**, not on the metadata item id:

```sql
CREATE TABLE plex.metadata_item_settings (
    id integer NOT NULL, account_id integer, guid text, rating double precision,
    view_offset integer, view_count integer, last_viewed_at bigint, ... );
```

(`cgnl/plex-postgresql`; the conflict key is stated explicitly in that repo's
`rust/plex-pg-core/src/upsert.rs`: `"metadata_item_settings" => Some(vec!["account_id", "guid"])`.)
And GUID-sharing sibling rows are *observed to share* watch state — on split movies (two
`metadata_items` rows, one GUID), Plex Forum **2025-09-24**: "Plex considers them different
versions of the same movie, so they have the same progress, watched status, etc."
https://forums.plex.tv/t/split-movie-shows-same-progress-and-watched-unwatched-state/931666

### Independent watch state — behaviourally CONFIRMED, mechanism UNVERIFIABLE

Plex documents the behaviour plainly (https://support.plex.tv/articles/multiple-editions/,
2026-07-07):

> "In cases where you have multiple editions of the same movie, they can all be added to your
> library, where their **watched status, user ratings, etc. are all tracked separately**."
> "**Note**: If you rename the file for an existing library item, it will be treated as a new
> library item after the next scan. Any watched status or customization of the metadata you had
> previously done for this movie will not carry over to this new 'Edition'."

So editions do get independent watch state — but **not because each has its own GUID, because it
doesn't.** What discriminates edition watch state could not be established from public sources, so
the mechanism is **UNVERIFIABLE**. Supporting circumstantial point: editions are excluded from
Plex's GUID-keyed cloud watch-state sync — "if you have set edition information for a movie in a
personal library, that item will not be synced. Only 'non-edition' movies can be synced"
(https://support.plex.tv/articles/sync-watch-state-and-ratings/, last modified 2025-03-24).

**What would settle it:** on a live PMS with two editions of one film,
`SELECT id, guid, edition_title FROM metadata_items WHERE title='Blade Runner';` alongside
`SELECT guid, view_count FROM metadata_item_settings;`.

### Effect on the CanonCore decision

**None — and the underlying point survives in better shape.** Versions share one `metadata_items`
row and therefore one watch state; editions are separate `metadata_items` rows and are documented
as tracked separately. That is still independent validation of CanonCore's progress-per-edition
decision. Only the mechanism named is wrong.

**Corrected wording for decisions.md §2.2:**
`each EDITION is its own metadata_items row with its own ratingKey (editions share a GUID), each VERSION is another media_items row under one metadata_items row.`

---

## Claim 8 — "Plex's unscrobble ZEROES the play count"

Prompt lines 340–342 (`progress`): "every media server surveyed keeps only a mutable state row:
Jellyfin has a play count but no dates, and Plex's unscrobble zeroes the count."

**Verdict: PARTLY CONFIRMED.** The direction is right — unscrobble *clears* rather than
decrements — and the state-vs-history distinction the argument rests on is confirmed verbatim by
Plex. But "zeroes" as a hard mechanism is not provable from public sources.

**What is solid.** `markUnplayed()` / `markUnwatched()` are thin wrappers over the endpoint with
no client-side count arithmetic — python-plexapi 4.18.2, `plexapi/mixins/played_unplayed.py`:

```python
@property
def isPlayed(self):
    return bool(self.viewCount > 0) if self.viewCount else False

def markUnplayed(self):
    key = '/:/unscrobble'
    params = {'key': self.ratingKey, 'identifier': 'com.plexapp.plugins.library'}
    self._server.query(key, params=params)
    return self
```

Note what this forces: `isPlayed` is `viewCount > 0`. If unscrobble merely *decremented*, an item
watched three times would come back `viewCount=2` and still read as played — marking unwatched
would be a no-op. Clearing behaviour is required for the endpoint to work at all. Third-party
implementers document it as clearing: `GLinnik21/plx-native`, `rust-modules/src/plex/library.rs`
— `/// GET /:/unscrobble — mark unwatched (clears viewCount + viewOffset).`

**The related documented behaviour — CONFIRMED verbatim.**
https://support.plex.tv/articles/sync-watch-state-and-ratings/ (**last modified 2025-03-24**),
under "Delete Watch History":

> "This action will delete your entire Watch History. … The watch counts on your profile will also
> be reset to zero. … **This will not stop new watch history from being created, nor will it
> change the watch state.**"

and the distinction itself, in Plex's own words:

> "**What's the difference between watch state and watch history?** 'Watch state' is simply the
> current value indicating whether the title is watched or unwatched field. … 'Watch history' is
> the ongoing log of changes to watch state."

The two-table shape is confirmed in the schema: `metadata_item_settings` (state — `view_count`,
`view_offset`, `last_viewed_at`, keyed `account_id`+`guid`) versus `metadata_item_views` (history
log — `viewed_at`, `device_id`, `view_type`, one row per viewing). Deleting from the log does not
touch `view_count`, and vice versa.

**Nuance that makes the claim conditional.** The quoted support text is about the **Plex
account/cloud** watch history (the Delete Data privacy control), not the server's local
`metadata_item_views` table. The claim is safe as a general state-vs-history point; it would be
wrong if it implied that article describes server-side SQLite behaviour.

**Trap avoided, recorded so nobody re-treads it.** A WebSearch snippet attributes to
technicalramblings.com the line "mark as unwatched will not decrease / remove the view count".
The page was fetched directly (published 2019-04-07, updated 2021-12-18) and **contains no such
sentence** — a search-engine confabulation. It would have flipped this verdict. Discount it.

**What would settle it:** on a live PMS, scrobble an item three times, read `viewCount` from
`/library/metadata/<key>`, call `/:/unscrobble`, re-read. Zero or absent proves the claim; `2`
disproves it.

**Effect on the CanonCore decision:** none. The event-log decision rests on "every media server
surveyed keeps only a mutable state row", which is confirmed, and Plex's own docs draw the
state/history line exactly where the argument needs it.

---

## Claim 13 — Multi-version pick is about decoding, not canonicity, and users still ask for a default

Prompt lines 226–229 (`editions`, industry check).

**Verdict: CONFIRMED. No material change — Plex has *not* added a way to set a default or
preferred version, as of evidence dated 2026-07-26.**

(a) Selection is capability/suitability-driven, with no user input —
https://support.plex.tv/articles/200381043-multi-version-movies/ (last modified 2022-08-22, still
the live article):

> "The multiple versions will be collapsed to a single item in the library. When a Plex app goes
> to play the collapsed item, **it will automatically request and play the most suitable item by
> default.** Many apps will also allow you to select a Play Version action…
> **Note**: Not all Plex apps will allow you to manually choose which version to play. **You
> should not rely on a choice being presented.**"

Nothing documents a user-facing input to "most suitable". Users report it as opaque and
resolution/HDR-driven: https://forums.plex.tv/t/multiple-version-movies-wrong-default-selection-by-plex/838911
(2023-04-24) — "it comes down to HDR vs. SDR support for the decision, not to the resolution" —
and the practical consequence, "I can cancel playback and manually select the 1080p version …
but I'd have to do this in every case of multiple versions of a movie and on every playback".

(b) Users are still asking — the canonical request,
**https://forums.plex.tv/t/default-play-version/546532**, opened **2020-02-23**: "Could a feature
be added to allow a player to set a default play version to play when multiple versions of a video
is available?" Most recent reply **2026-07-26**: **"A shame it was requested six and a half years
ago but was never implemented."** No Plex staff post in the thread says it exists or is planned.
A 2023-12-16 duplicate (thread 863040) was closed by a moderator to funnel votes back to the 2020
thread; its opening post states current behaviour: "Currently, Plex automatically selects a version
based on quality and resolution. **However, there is no option for users to set a default version
preference.**"

Nuance: per-client quality/bitrate settings and "Play Version" pickers exist in some apps, so a
user is not entirely without influence — but that is a per-playback manual override or a bandwidth
cap, not a persisted designation, and it is explicitly not guaranteed to be offered.

**Effect on the CanonCore decision:** none. The claim stands as written, and the `is_default` pin
remains a genuine differentiator.

---

## Claim 14 — EMBY

### (a) "Save every 10 seconds — the industry floor, which Emby states as a requirement"

Prompt lines 539–540. This is the only Emby claim in the prompt itself.

**Verdict: PARTLY CONFIRMED — the number is right, the word "requirement" is WRONG, and the
direction is backwards.**

Emby *recommends* it, in "should" language, and frames 10 seconds as a **ceiling on how often to
report**, not a floor on save resolution. https://dev.emby.media/doc/restapi/Playback-Check-ins.html
(fetched 2026-09-06; page footer "Copyright 2022 © EMBY LLC"):

> "Playback progress **should** be reported at the following times:
> Automatically every 10 seconds
> Immediately following any user interaction with the player, for example, pause, un-pause, etc."

and, on the same page:

> "The server will automatically increment playback progress every second, so it is **not necessary
> to automatically report more often than at 10 second intervals**. The progress reports coming
> from the app will be used to re-calibrate the automatic progress increment on the server."

The page contains **"should" three times and zero occurrences of "must", "required" or "need to"**.
The identical text is mirrored at https://github.com/MediaBrowser/Emby/wiki/Playback-Check-ins
(last edited 2020-09-22). There is no other candidate page: dev.emby.media's REST API index lists
only "API Key Authentication", "User Authentication", "REST API Clients" and this page, and Emby
publishes no separate client-development or media-playback guide.

The 10-second constant in Emby's JS client is a **throttle, not a heartbeat** —
`MediaBrowser/Emby.ApiClient.Javascript`, `apiclient.js`, `reportPlaybackProgress()` (HEAD
`fdd0939`, last pushed 2023-12-09) suppresses routine `timeupdate` reports arriving less than
10 s after the last one unless the position has drifted more than 5 s from the server's
extrapolation; pause, seek and track-change bypass it entirely.

**Why the direction matters.** Because Emby's server increments position itself once per second
and re-calibrates from client reports, 10 s is Emby's stated **maximum useful reporting
frequency**. Effective resume resolution on Emby is roughly 1 s, not 10 s. So Emby is not evidence
for a 10-second *floor*; it is evidence that 10 s of client chatter is *enough* given a server that
interpolates. "The industry floor" is the prompt's own characterisation and Emby says nothing of
the kind.

**Effect on the CanonCore decision.** The 10-second save interval survives — Jellyfin uses 10 s,
Plex's own API docs say 10 s on LAN/WAN (Claim 12a), and Emby's docs say report every 10 s. But
**the prompt's justification is misattributed**: Emby does not "state it as a requirement".
Suggested rewrite for prompt.md line 539–540:
`Save every 10 seconds — the interval Emby's client documentation tells developers to report at, and the same figure Plex's own API docs give for LAN/WAN.`

### (b) "Emby is converging on a shared HTML core, and carved out Apple TV as genuinely native, dual AVFoundation + mpv"

From decisions.md, not prompt.md — lower stakes.

**Verdict: PARTLY CONFIRMED.** The shared HTML core is real and confirmed by Emby staff. But
"deliberately converging" is the less current half: since **December 2024** Emby has been moving
the other way on playback, wrapping the shared HTML UI in increasingly *native* shells and
replacing the HTML video element with native players. "Admin confirmed" is not literally satisfied
— the confirmations come from Emby's app developer (softworkz) and Emby's own documentation, not
from Luke or ebr.

Shared HTML core — confirmed. Emby's official Windows FAQ
(https://emby.media/support/articles/apps/windows/Emby-Windows-FAQ.html, footer 2026): "It is
running the app code from an online URL to access **our common code base**". Emby Linux flags doc:
"**nompv** — Disables playback via MPV player in a separate window and switches Emby Linux to use
the **HTML video player** instead." ebr (**Administrator**), 2024-08-13, on the standard Android
app versus the LG webOS app: "**It should be nearly identical to what you have on LG.**"
(https://emby.media/community/topic/125946-apple-tv-app-missing-basic-features/)

The countervailing, more recent direction. softworkz, official Emby blog, **2024-12-19**
(https://emby.media/community/blogs/entry/578-the-new-emby-app-for-windows-xbox/): "With a fully
redeveloped **native foundation**… In the new Xbox app, we have a new playback implementation which
is based on ffmpeg and **takes place of the HTML video playbaback**". Emby Linux public beta,
**2026-01-06**: "there are limits to what a browser-based player can achieve… **delivering that
consistently requires a native application**."

Apple TV genuinely native, dual players — CONFIRMED and current. Luke (**Administrator**),
**2026-08-19**, https://emby.media/community/topic/149237-whats-the-current-state-of-the-mvp-vs-native-player-in-the-appletv-client/:
"I would leave it on auto. **We've put a lot of work into choosing the best player depending on the
situation.**" The app exposes Native / MPV / Auto. It is not the HTML core — an Emby developer on
the tvOS app, 2025-11-11: "we don't have as much control of the dynamic loading of images/items
when scrolling long lists **as we do in the web client**", and Luke repeatedly describes the tvOS
app as needing to be "caught up" to the other apps, which a shared-core app would not.
Current version: **Emby for TV 2.0.9, released 2026-08-28**.

**The one unconfirmed word: "AVFoundation".** Emby never uses it in any official source — docs,
blog, release notes or staff post. Emby's own vocabulary is "the native player" / "ATV native
player". The only AVFoundation attribution is a community member (vdatanet, 2026-08-19, same
thread): "Native player – **Goes through AVFoundation**… it's the only path that can output HEVC
HDR/Dolby Vision properly… MKV isn't one of them." Technically almost certainly right, and Luke
did not correct it when he replied in that thread minutes later, but it is an outside inference,
not an Emby statement. "Swift/Objective-C" is likewise inference: `MediaBrowser/Emby.ApiClient.Swift`
is **archived, last pushed 2023-12-09**, and Emby does not publish the tvOS app's source.

**Effect on the CanonCore decision:** none. This supports the clients decision (native Swift on TV)
and it still holds — but it is a stated programme with more platforms to come, so it is the claim
in this set most likely to age. Suggested rewording:
`Emby runs one shared HTML/JS UI across web, Samsung, LG, iOS, Android, Windows, Xbox and Linux (Emby's own docs call it "our common code base"), while deliberately moving playback OUT of HTML into native players — and Apple TV is a separate native app entirely, with two playback engines (the tvOS native player and MPV) plus an auto-selector.`

---

## SUMMARY

| # | Claim | Verdict |
|---|---|---|
| 1 | Plex item cannot exist without a file | **CONFIRMED** |
| 2 | Episode ordering is one global setting per library | **OUTDATED** — per-show override since PMS 1.40.4 (2024-07) |
| 3 | Cross-library collections only by exact same NAME | **CONFIRMED** — Plex's docs say "exact same name" |
| 4 | Library typed by medium, which stops mixed media | **CONFIRMED** on facts, PARTLY on "that is exactly what stops" |
| 5 | Manual vs smart; smart deliberately not hand-orderable | **PARTLY CONFIRMED** — "deliberately" unevidenced |
| 6 | `SHA1(size + SHA1(first 64KB) + SHA1(last 64KB))` | **CONFIRMED**, reproduced byte-exactly; "first 4KB" is WRONG, as claimed |
| 7 | Editions are rows with own GUID; versions are `media_parts` | **PARTLY CONFIRMED** — two structural errors (see below) |
| 8 | Unscrobble zeroes the play count | **PARTLY CONFIRMED** — direction right, "zeroes" unprovable |
| 9 | `isPlayed = viewedLeafCount == leafCount` over owned files | **CONFIRMED**, and unconditional |
| 10 | Plug-ins closed 2018 at <2%, reopened 2025 as HTTP contract | **PARTLY CONFIRMED** — "closed in 2018" WRONG |
| 11 | Docs say network mounts "will typically not work" | **PARTLY CONFIRMED** — misquote by one word |
| 12 | 10s LAN / 20s cellular; 16-week resume window | **CONFIRMED** (a, "LAN/WAN"); **CONFIRMED as a number** (b), but it is a Continue Watching lookback, not a resume expiry |
| 13 | Version pick is about decoding; users still asking | **CONFIRMED**, no material change |
| 14a | Emby states 10s as a requirement | **PARTLY CONFIRMED** — Emby says "should", and it is a ceiling not a floor |
| 14b | Emby shared HTML core; Apple TV native, AVFoundation + mpv | **PARTLY CONFIRMED** — playback is moving OUT of HTML since Dec 2024; "AVFoundation" is community inference |

### The claims that are actually WRONG or OUTDATED

1. **Claim 2 — OUTDATED.** prompt.md line 51. Per-show episode ordering has existed since PMS
   1.40.4 (2024-07). The DECISION is unaffected: Plex still allows only one ordering in force at
   a time.
2. **Claim 10 — one clause WRONG.** prompt.md line 525. Plex did not close plug-ins in 2018; it
   closed the plug-in *directory* and explicitly blessed manual installs. Legacy agents worked
   until 2024-25. The DECISION is unaffected and the Dec 2025 HTTP contract checks out, 90-second
   timeout included (though that number is a staff aside, not documented).
3. **Claim 11 — misquote.** prompt.md line 601. Plex wrote "will **also** typically not work".
   Substance unaffected.
4. **Claim 7 — two structural errors** (decisions.md §2.2, not prompt.md). Editions share a GUID
   and differ by `ratingKey`; a version is another **`media_items`** row, not `media_parts`. The
   conclusion — progress per edition — is unaffected and better supported once corrected.
5. **Claim 14a — misattributed.** prompt.md line 540. Emby does not "state it as a requirement";
   its docs say "should", and frame 10 s as a maximum useful reporting frequency, not a floor.

### Corrections prompt.md should absorb

- Line 51 — rewrite as "Plex allows ONE episode ordering in force at a time — a library default
  plus, since PMS 1.40.4, a per-show override — never two orderings at once."
- Line 198 — drop "deliberately" from the smart-collections sentence.
- Line 267 — state the encoding: ASCII decimal size, lowercase hex digests, no separators, no
  trailing newline; and that the last-64KB term is omitted for files of 64KB or smaller.
- Line 525 — "shut the plug-in directory in 2018 … reopened in December 2025".
- Line 540 — "the interval Emby's client documentation tells developers to report at".
- Line 558 — "children that exist only because you own a file" rather than "files on disk".
- Line 601 — quote "content mounted via a network will also typically not work".

### Nothing here changes a CanonCore decision

Every rotted claim rots a *reason*, not a conclusion. Multi-placement, order-on-the-placement,
progress-per-edition, the file-identity hash, the two-figure completion rollup, no Continue
Watching window, and provider-as-URL all survive intact.

