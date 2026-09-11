# Verification: the Kodi / Emby / Audiobookshelf / Komga / MusicBrainz / CAA / TMDB claims in ADRs 0085–0095

Ten claims from `docs/adr/0085`, `0086`, `0087`, `0089` and `0095`, each put back to the source
that owns it. For the open-source products (Kodi, Audiobookshelf, Komga) the owner is the source
code at a pinned commit, not a wiki, a blog or a forum thread. For the hosted ones (Emby, TMDB,
MusicBrainz, Cover Art Archive) it is the project's own documentation.

Verdicts used:

- **CONFIRMED** — the owner's own source says this, with the citation given.
- **CONTRADICTED** — the owner's own source says something materially different.
- **UNFOUNDED** — no source was found in this run that supports it.
- **JUDGEMENT** — a characterisation, not a checkable fact.

Nothing here is confirmed from memory. Every verdict carries a lookup performed during this run.

**Run date: 2026-09-10.**

Commits pinned during this run:

| Repository | HEAD at time of reading | Date |
|---|---|---|
| `xbmc/xbmc` | `8a83e4ad38e0461a8bec13de3686aad05972c6dd` | 2026-09-10 |
| `gotson/komga` | `d512b67d0186b519f1fe70c5ff8fb09d6311e1fd` | 2026-09-07 |
| `advplyr/audiobookshelf` | `0a797ab8bee15dc3ca92d1d76155259c46dbec62` | 2026-08-28 |
| `readium/architecture` | `48cefd99b7` (locator spec last changed `0d13e8058c6d`, 2024-02-05) | 2026-07-15 |

---

## 1. Kodi files an extra as a file role, not an item — ADR-0087

**The claim.** "It files an extra as a file role, one `videoversion` row keyed on `idFile` with
`itemType = EXTRA` — the same table and the same axis as an alternate version — and creates no item
row at all, so an extra there cannot carry its own progress."

### 1.1 The table, the key, the column and the value — CONFIRMED

`xbmc/video/VideoDatabaseDDL.cpp`, `CVideoDatabaseDDL::CreateTables`:

```cpp
  CLog::Log(LOGINFO, "create videoversion table");
  db.ExecuteQuery(
      "CREATE TABLE videoversion (idFile INTEGER PRIMARY KEY, idMedia INTEGER, media_type "
      "TEXT, itemType INTEGER, idType INTEGER)");
```

Every element of the structural claim checks out and the wording is exact rather than approximate:

- the table is named `videoversion`;
- `idFile` is not merely a column, it is the **PRIMARY KEY** — "keyed on `idFile`" is literally right;
- the discriminating column is named `itemType`.

`xbmc/video/VideoManagerTypes.h` gives the value:

```cpp
enum class VideoAssetType : int
{
  VERSIONSANDEXTRASFOLDER =
      -2, //!< reserved for nodes navigation, returns versions + extras virtual folder. do not use in the db.
  UNKNOWN = -1,
  ALL =
      0, //!< reserved for nodes navigation, returns all assets of all types. do not use in the db.
  VERSION = 1,
  EXTRA = 2,
};
```

`VERSION` and `EXTRA` are two values of one enum written into one column of one table, so "the same
table and the same axis as an alternate version" is right. `VideoDatabaseDDL.cpp`'s `movie_view`
proves `itemType` is that enum, discriminating the two in otherwise identical subqueries:

```cpp
      "  EXISTS( "
      "    SELECT 1 "
      "    FROM  videoversion vv "
      "    WHERE vv.idMedia = movie.idMovie "
      "    AND   vv.media_type = '%s' "
      "    AND   vv.itemType = %i "
      "    AND   vv.idFile <> movie.idFile "
      "  ) AS hasVideoVersions, "
      "  EXISTS( "
      "    SELECT 1 "
      "    FROM  videoversion vv "
      "    WHERE vv.idMedia = movie.idMovie "
      "    AND   vv.media_type = '%s' "
      "    AND   vv.itemType = %i "
      "  ) AS hasVideoExtras, "
...
      MediaTypeMovie, VideoAssetType::VERSION, MediaTypeMovie, VideoAssetType::EXTRA,
```

Note also `vv.idMedia = movie.idMovie`: an extra hangs off the **parent movie's** id.

### 1.2 "creates no item row at all" — CONFIRMED

`xbmc/video/VideoDatabase.cpp`, `CVideoDatabase::AddVideoAsset` (the one path the scanner uses for
extras, via `VideoInfoScanner.cpp`'s `AddVideoAsset(..., VideoAssetType::EXTRA, ...)`):

```cpp
    idFile =
        AddFile(item.GetDynPath(), "", tag->m_dateAdded, tag->GetPlayCount(), tag->m_lastPlayed);
...
    if (!AddOrUpdateVideoVersion(itemType, dbId, idFile, idVideoAsset, videoAssetType))
...
    if (item.HasVideoInfoTag() && item.GetVideoInfoTag()->HasStreamDetails() &&
        !SetStreamDetailsForFileId(item.GetVideoInfoTag()->m_streamDetails, idFile))
...
    if (!SetArtForItem(idFile, MediaTypeVideoVersion, item.GetArt()))
```

Adding an extra writes a `files` row, a `videoversion` row, `streamdetails` and `art`. It writes no
`movie`, `episode`, `tvshow` or `musicvideo` row. The claim is right.

### 1.3 "so an extra there cannot carry its own progress" — CONTRADICTED

This is the consequence clause, and Kodi's source does not support it. Kodi's watched state and its
resume point are both keyed on `idFile`, which is exactly what an extra has.

**Watched state** lives on the `files` table, not on the item table:

```cpp
  CLog::Log(LOGINFO, "create files table");
  db.ExecuteQuery(
      "CREATE TABLE files ( idFile integer primary key, idPath integer, strFilename text, "
      "playCount integer, lastPlayed text, dateAdded text)");
```

and `CVideoDatabase::SetPlayCount` writes to it by `idFile` alone:

```cpp
      strSQL = PrepareSQL("update files set playCount=%i,lastPlayed='%s' where idFile=%i", count,
                          lastPlayed.GetAsDBDateTime().c_str(), id);
```

**Resume state** lives on `bookmark`, also keyed on `idFile`:

```cpp
      "CREATE TABLE bookmark ( idBookmark integer primary key, idFile integer, "
      "timeInSeconds double, totalTimeInSeconds double, thumbNailImage text, player text, "
      "playerState text, type integer)\n"
```

and `xbmc/utils/SaveFileStateJob.cpp` saves it against the played file's own dyn path:

```cpp
  std::string progressTrackingFile = item.GetPath();
  if (CUtil::UseDynPathForAddOrUpdate(item))
  {
    progressTrackingFile = item.GetDynPath();
  }
...
              success = videodatabase.AddBookMarkToFile(progressTrackingFile, bookmark,
                                                        CBookmark::RESUME);
```

Kodi does not merely *permit* this; it reads it back and paints it. `CVideoDatabase::GetVideoVersions`
— the one function that lists both versions and extras, taking `videoAssetType` as its parameter —
sets a per-asset watched overlay straight from the asset's own file id:

```cpp
        infoTag.m_type = MediaTypeVideoVersion;
        infoTag.m_iDbId = idFile;
...
        item->SetOverlayImage(GetPlayCount(idFile) > 0 ? CGUIListItem::ICON_OVERLAY_WATCHED
                                                       : CGUIListItem::ICON_OVERLAY_UNWATCHED);
```

An extra in Kodi therefore carries its own playcount, its own `lastPlayed`, and its own resume
bookmark, and Kodi shows the resulting watched flag on it.

A second, smaller slip in the same ADR sentence-set: the ADR contrasts our extras having "its own
artwork" with Kodi's. Kodi stores per-asset artwork too, keyed on the same `idFile` under a
dedicated media type — `SetArtForItem(idFile, MediaTypeVideoVersion, item.GetArt())`, with a
matching cleanup trigger `DELETE FROM art WHERE media_id=old.idFile AND media_type='videoversion'`.

**The decision stands; this sentence of the evidence does not.** What Kodi actually withholds from
an extra is a **library item**: no `movie` row means no metadata, no page of its own, no cast, no
ratings, no uniqueids, and no independent standing in the library. The accurate version of the
warning is "creates no item row at all, so an extra there is a file hanging off its parent rather
than a work in its own right" — not "cannot carry its own progress", which the schema contradicts.

Sources, all read 2026-09-10 at `xbmc/xbmc` HEAD `8a83e4ad`:
`https://github.com/xbmc/xbmc/blob/master/xbmc/video/VideoDatabaseDDL.cpp`,
`https://github.com/xbmc/xbmc/blob/master/xbmc/video/VideoManagerTypes.h`,
`https://github.com/xbmc/xbmc/blob/master/xbmc/video/VideoDatabase.cpp`,
`https://github.com/xbmc/xbmc/blob/master/xbmc/utils/SaveFileStateJob.cpp`,
`https://github.com/xbmc/xbmc/blob/master/xbmc/video/VideoInfoScanner.cpp`.

---

## 2. Emby frames 10 seconds as a ceiling, not a floor — ADR-0086

**The claim.** "Emby frames 10 seconds as a CEILING rather than a floor, because its server already
increments progress every second by itself, so reporting more often buys nothing. It is the interval
Emby's client documentation tells developers to report at."

**CONFIRMED**, and the ceiling framing is Emby's own, almost word for word.

`https://dev.emby.media/doc/restapi/Playback-Check-ins.html` (Emby's client developer
documentation; page carries "Copyright 2022 © EMBY LLC"), read 2026-09-10:

> "Playback progress should be reported at the following times: Automatically every 10 seconds
> [and] Immediately following any user interaction with the player"

> "The server will automatically increment playback progress every second, so it is not necessary
> to automatically report more often than at 10 second intervals."

> "The progress reports coming from the app will be used to re-calibrate the automatic progress
> increment on the server."

Three things land at once:

1. **The ceiling framing is exact.** "it is not necessary to automatically report more often than
   at 10 second intervals" is a ceiling sentence, not a floor sentence. A floor would read "at
   least every 10 seconds".
2. **The reason given is the one the ADR gives.** The server increments every second by itself;
   reports re-calibrate that increment rather than constitute it.
3. **ADR-0086's second half is Emby's too.** "ALSO report immediately on any user interaction" is
   not our addition to Emby's rule — it is the second bullet of Emby's own list. The ADR presents
   the interaction rule as a correction to a timer-only reading ("The timer alone is half a rule"),
   which is fair as a corrective to *other* implementations, but Emby already pairs the two.

The same text is mirrored on Emby's own GitHub wiki at
`https://github.com/MediaBrowser/Emby/wiki/Playback-Check-ins`.

---

## 3. Audiobookshelf's ten seconds is a configurable default, not a constant — ADR-0085

**The claim as handed over.** "Audiobookshelf's ten-second **progress interval** is a CONFIGURABLE
DEFAULT rather than a constant."

**The claim as ADR-0085 actually makes it.** "Audiobookshelf's ten seconds is a configurable
default rather than a constant" — in an ADR whose entire subject is *completion*.

These are two different ten-second figures in Audiobookshelf, and they have opposite verdicts.

### 3.1 The completion threshold — CONFIRMED (this is what ADR-0085 asserts, and it is right)

`server/models/Library.js`:

```js
 * @property {number} markAsFinishedTimeRemaining Time remaining in seconds to mark as finished. (defaults to 10s)
 * @property {number} markAsFinishedPercentComplete Percent complete to mark as finished (0-100). If this is set it will be used over markAsFinishedTimeRemaining.
...
        markAsFinishedPercentComplete: null,
        markAsFinishedTimeRemaining: 10
```

It is a **per-library setting**, defaulted to 10 and settable by an admin: `LibraryController.js`
validates it on write (`key === 'markAsFinishedTimeRemaining' && ... Number(req.body.settings[key]) < 0`),
`PlaybackSessionManager.js` threads `library.librarySettings.markAsFinishedTimeRemaining` into every
progress payload, and `client/components/modals/libraries/LibrarySettings.vue` exposes it as a
dropdown plus a number field. `server/models/MediaProgress.js` applies it:

```js
        const markAsFinishedTimeRemaining = isNullOrNaN(progressPayload.markAsFinishedTimeRemaining) ? 10 : Number(progressPayload.markAsFinishedTimeRemaining)
        shouldMarkAsFinished = timeRemaining < markAsFinishedTimeRemaining
```

A configurable default, exactly as ADR-0085 says.

### 3.2 The progress-report interval — CONTRADICTED (this is what the claim as worded points at)

The interval at which the Audiobookshelf web client *reports* progress is a hardcoded constant with
no setting behind it. `client/players/PlayerHandler.js`:

```js
  /**
   * First sync happens after 20 seconds
   * subsequent syncs happen every 10 seconds
   */
  startPlayInterval() {
    clearInterval(this.playInterval)
    let lastTick = Date.now()
    this.playInterval = setInterval(() => {
...
      const TimeToWaitBeforeSync = this.lastSyncTime > 0 ? 10 : 20
      if (this.listeningTimeSinceSync >= TimeToWaitBeforeSync) {
        this.sendProgressSync(currentTime)
      }
    }, 1000)
  }
```

`10` and `20` are literals in the client. `server/objects/settings/ServerSettings.js` has no
sync-interval field at all — grepping the whole tree for `saveInterval`, `syncInterval`,
`progressSave`, `PROGRESS_SAVE` returns nothing.

**Net: ADR-0085 is correct as written.** The claim as handed to this run mislabels which ten
seconds is configurable. Anyone porting the sentence into a *reporting-interval* ADR (0086) would
be wrong to cite Audiobookshelf for it.

Sources, `advplyr/audiobookshelf` at `0a797ab8`, read 2026-09-10:
`server/models/Library.js`, `server/models/MediaProgress.js`, `server/controllers/LibraryController.js`,
`server/managers/PlaybackSessionManager.js`, `client/players/PlayerHandler.js`,
`server/objects/settings/ServerSettings.js`.

---

## 4. Audiobookshelf also ships a percentage-based completion mode — ADR-0085

**CONFIRMED**, and it is not a fringe option: it is a first-class per-library setting that
**overrides** the time-remaining rule when set.

`server/models/Library.js`:

```js
 * @property {number} markAsFinishedPercentComplete Percent complete to mark as finished (0-100). If this is set it will be used over markAsFinishedTimeRemaining.
```

`server/models/MediaProgress.js`, the whole decision:

```js
    const timeRemaining = this.duration - this.currentTime

    // Check if progress is far enough to mark as finished
    //   - If markAsFinishedPercentComplete is provided, use that otherwise use markAsFinishedTimeRemaining (default 10 seconds)
    let shouldMarkAsFinished = false
    if (this.duration) {
      if (!isNullOrNaN(progressPayload.markAsFinishedPercentComplete) && progressPayload.markAsFinishedPercentComplete > 0) {
        const markAsFinishedPercentComplete = Number(progressPayload.markAsFinishedPercentComplete) / 100
        shouldMarkAsFinished = markAsFinishedPercentComplete < this.progress
```

`LibraryController.js` validates the range 0–100; `LibrarySettings.vue` renders a
"Mark as finished when" dropdown whose second option takes a `%` value. So the mode the ADR set
rejects elsewhere is shipped, admin-selectable, and takes precedence over time-remaining when
chosen. ADR-0085's self-correction is right.

Two further readings of the same block, both load-bearing on ADR-0085:

- **Audiobookshelf's default is time-remaining, and percentage is opt-in.** `markAsFinishedPercentComplete`
  defaults to `null`. That is a point *for* ADR-0085's time-remaining rule, not against it, and the
  ADR undersells it by describing the finding only as a correction.
- **Audiobookshelf's completion is entirely inside `if (this.duration)`.** See §5.2 — this
  contradicts a different sentence of the same ADR.

---

## 5. Komga determines completion by a progression value crossing a threshold — ADR-0085

**The claim.** ADR-0085: "Where it does not [have a duration] — a book, a comic — completion is
`progression` crossing a threshold, which is the only thing available and is what Audiobookshelf and
Komga both do."

### 5.1 Komga, EPUB — CONFIRMED

`komga/src/main/kotlin/org/gotson/komga/domain/service/BookLifecycle.kt`, `markProgression`,
the `MediaProfile.EPUB` branch:

```kotlin
          val totalProgression = matchedPosition.locations?.totalProgression
          ReadProgress(
            book.id,
            user.id,
            totalProgression?.let { (media.pageCount * it).roundToInt() } ?: 0,
            totalProgression?.let { it >= 0.99F } ?: false,
```

The fourth positional argument is `ReadProgress.completed`. So for a reflowable book, completion is
`totalProgression >= 0.99F` — a normalised progression crossing a threshold, and not a time
calculation. Confirmed, and the threshold figure is 0.99.

### 5.2 Komga, comics — CONTRADICTED

The ADR names "a comic" in the same breath. Komga does not use a threshold for comics. Same
function, the `DIVINA` / `PDF` branch:

```kotlin
        MediaProfile.DIVINA,
        MediaProfile.PDF,
        -> {
          require(newProgression.locator.locations?.position in 1..media.pageCount) { ... }
          ReadProgress(
            book.id,
            user.id,
            newProgression.locator.locations!!.position!!,
            newProgression.locator.locations.position == media.pageCount,
```

Completion is `position == media.pageCount` — exact equality with the last page, not a threshold.
The same is true of the page-based REST path:

```kotlin
    val progress = ReadProgress(book.id, user.id, page, page == media.pageCount, locator = locator)
```

For a comic Komga completes on **reaching the last page**, full stop. A reader who stops on the
second-to-last page of a 200-page comic sits at 0.995 progression and is *not* complete.

### 5.3 Audiobookshelf, ebooks — CONTRADICTED

The ADR's "is what Audiobookshelf and Komga both do" is false for Audiobookshelf. Audiobookshelf
never auto-completes a book on progression. `server/models/MediaProgress.js`:

```js
  get progress() {
    // Value between 0 and 1
    if (!this.duration) return 0
    return Math.max(0, Math.min(this.currentTime / this.duration, 1))
  }
```

and the completion block is guarded:

```js
    let shouldMarkAsFinished = false
    if (this.duration) {
```

An ebook has no duration, so `this.progress` is `0` and `shouldMarkAsFinished` never becomes true.
`ebookProgress` appears nowhere in the completion decision — grepping the server for
`ebookProgress` finds it only in serialisation, migration and library-filter SQL. The only way an
Audiobookshelf ebook becomes finished is the user sending `isFinished` explicitly:

```js
    if (progressPayload.isFinished !== undefined) {
      if (progressPayload.isFinished && !this.isFinished) {
        this.finishedAt = progressPayload.finishedAt || Date.now()
```

and the client readers never send it — `EpubReader.vue`, `PdfReader.vue` and `ComicReader.vue` each
send only `ebookLocation` and `ebookProgress`.

**The decision stands; the attribution does not.** Progression-crossing-a-threshold for
duration-less media is a defensible rule, and Komga does it for EPUB. But it is one branch of one
product, not the settled industry practice the ADR's "what Audiobookshelf and Komga both do"
implies. Audiobookshelf's answer for a book is *no automatic completion at all* — which is closer
to ADR-0085's own "unknown is never a fabricated true" than the ADR notices.

Sources: `gotson/komga` at `d512b67d`, `komga/src/main/kotlin/org/gotson/komga/domain/service/BookLifecycle.kt`
(read 2026-09-10); `advplyr/audiobookshelf` at `0a797ab8`, `server/models/MediaProgress.js`,
`client/components/readers/*.vue`.

---

## 6. The four identifiers — `ebookProgress`, `ebookLocation`, page, `R2Locator`

**The claim.** "Audiobookshelf and Komga both use a normalised progression plus an opaque locator:
Audiobookshelf ships `ebookProgress` plus `ebookLocation` and Komga ships a page plus an `R2Locator`.
Verify these four identifiers exist."

**CONFIRMED — all four exist, spelled exactly as claimed.**

**Audiobookshelf.** `server/models/MediaProgress.js` serialises both:

```js
      ebookLocation: this.ebookLocation,
      ebookProgress: this.ebookProgress,
```

`server/models/User.js` accepts both on the update payload, and normalises the progression:

```js
        ebookLocation: progressPayload.ebookLocation || null,
        ebookProgress: isNullOrNaN(progressPayload.ebookProgress) ? 0 : Number(progressPayload.ebookProgress),
```

`ebookProgress` is 0..1. `client/components/readers/EpubReader.vue` sends
`ebookProgress: location.end.percentage`; `PdfReader.vue` and `ComicReader.vue` send
`Math.max(0, Math.min(1, (Number(this.page) - 1) / Number(this.numPages)))`.

**Komga.** `komga/src/main/kotlin/org/gotson/komga/domain/model/ReadProgress.kt`, in full:

```kotlin
data class ReadProgress(
  val bookId: String,
  val userId: String,
  val page: Int,
  val completed: Boolean,
  val readDate: LocalDateTime = LocalDateTime.now(),
  val deviceId: String = "",
  val deviceName: String = "",
  val locator: R2Locator? = null,
  ...
```

`page: Int` and `locator: R2Locator?` sit side by side, exactly as claimed, and `R2Locator` is a
real domain type at `komga/src/main/kotlin/org/gotson/komga/domain/model/R2Locator.kt`.

Two nuances worth keeping straight if this is used as a design precedent:

- **Komga's normalised progression is *inside* the locator, not alongside it.** `ReadProgress.page`
  is an integer page index, not 0..1. The 0..1 figure lives at `locator.locations.totalProgression`,
  whose own KDoc reads "Progression in the publication expressed as a percentage. Between 0 and 1."
  The pairing is therefore "an integer page plus a locator that carries its own progression", not
  "a progression plus an opaque locator". Komga even derives one from the other:
  `totalProgression?.let { (media.pageCount * it).roundToInt() }`.
- **Audiobookshelf's locator is opaque only for EPUB.** `ebookLocation` is a CFI string for EPUB
  (`ebookLocation: location.start.cfi`) but a bare page number for PDF and comics
  (`ebookLocation: this.page`).

---

## 7. MusicBrainz carries script as its own field, separate from language — ADR-0095 area

**CONFIRMED.**

`https://musicbrainz.org/doc/Release`, read 2026-09-10. The Release entity documents the two as
separate fields with separate standards behind them:

> **Language** — "The language the release title and track titles are written in. The possible
> values are taken from the ISO 639-3 standard."

> **Script** — "The script used to write the release title and track titles. The possible values
> are taken from the ISO 15924 standard."

Corroborated by the core-data inventory at `https://musicbrainz.org/doc/MusicBrainz_Database`, which
lists language among a Release's core fields, and by MusicBrainz modelling them against two
different ISO standards — 639-3 for language, 15924 for script — which is the structural reason they
cannot collapse into one field.

---

## 8. Cover Art Archive: CC0 metadata, licensed covers — ADR-0095

**The claim.** ADR-0095: "music comes from MusicBrainz and Cover Art Archive (CC0 metadata,
licensed covers)."

Split verdict. The second half is right. The first half is wrong about the Cover Art Archive
specifically, and right only about MusicBrainz.

### 8.1 "licensed covers" — the images are separately licensed — CONFIRMED

`https://coverartarchive.org/`, read 2026-09-10, the site's own closing lines:

> "All images are uploaded from users' computers directly to Internet Archive servers.
> All images are copyrighted by their respective copyright owners.
> If you have any questions regarding the images in coverartarchive.org, please email
> info [at] archive [dot] org."

`https://musicbrainz.org/doc/About/Data_License` (transcluded revision #68951), read 2026-09-10,
has a dedicated "Cover art" section that puts the images outside the MusicBrainz licence entirely:

> "The MusicBrainz dataset does not contain cover art. Cover art is provided by the Cover Art
> Archive."

`https://musicbrainz.org/doc/Cover_Art_Archive` adds "Use the images at your own risk. The Internet
Archive's policy can be read here." There is no blanket licence on CAA images: each is whatever its
copyright owner makes it.

### 8.2 "CC0 metadata" applied to the Cover Art Archive — CONTRADICTED

MusicBrainz's own download page states the licence file by file. `https://musicbrainz.org/doc/MusicBrainz_Database/Download`
(transcluded revision #77812), read 2026-09-10:

> **Public Domain** — "The following database dumps are distributed under the CC0 license, which is
> effectively placing the data into the Public Domain:"
> `mbdump.tar.bz2`
> `mbdump-cdstubs.tar.bz2`
>
> **Creative Commons** — "The following database dumps are distributed under the
> Attribution-NonCommercial-ShareAlike 3.0 license:"
> `mbdump-cover-art-archive.tar.bz2`
> `mbdump-derived.tar.bz2`
> `mbdump-edit.tar.bz2`
> `mbdump-editor.tar.bz2`
> `mbdump-event-art-archive.tar.bz2`
> `mbdump-stats.tar.bz2`

The same page describes what that dump is:

> "`mbdump-cover-art-archive.tar.bz2` — This dump includes the tables that show connections between
> MusicBrainz and the Cover Art Archive (keep in mind it does not include the actual images in the
> archive)."

So the Cover Art Archive's **metadata** — the image types, front/back flags, approval, comments, and
the release-to-image links, i.e. everything the CAA JSON API returns — is
**CC BY-NC-SA 3.0, not CC0**. It is explicitly non-commercial and explicitly share-alike. This is
the opposite of the ADR's parenthetical, and the non-commercial clause is the part that matters: it
is a real constraint on what a public demo instance may do with that metadata.

What *is* CC0 is **MusicBrainz core data**: `mbdump.tar.bz2`, itemised at
`https://musicbrainz.org/doc/MusicBrainz_Database` as areas, artists, events, genres, instruments,
labels, mediums, places, recordings, release groups, releases, series, works, relationships and URLs.
Releases' core fields include "Title, artist credit, type, status, language, date, country, label,
catalog number, barcode, medium(s), disc ID(s), ASIN, disambiguation comment, MBID".

**The decision stands; the parenthetical does not.** Sourcing music from MusicBrainz plus the Cover
Art Archive is fine, and the covers' being separately licensed is correctly stated. The accurate
parenthetical is "(CC0 MusicBrainz core metadata, CC BY-NC-SA cover-art metadata, separately
copyrighted covers)" — three tiers, not two. Note also that user tags and genre associations are
supplementary data under CC BY-NC-SA, so genre is not CC0 either.

Not found in this run, and therefore open: whether the CAA's *live JSON API* responses carry the
same CC BY-NC-SA terms as the dump. Neither `https://coverartarchive.org/` nor
`https://musicbrainz.org/doc/Cover_Art_Archive/API` states a licence for the API response. The dump
licence is the best available evidence and points the same way.

---

## 9. TMDB is film and television only — ADR-0095

**The claim.** "TMDB is film and television only, so the novels' covers, publishers, ISBNs and
publication dates come from neither provider the stop condition names."

**CONFIRMED**, from two independent parts of TMDB's own site, and there is no sign of TMDB having
added book or music coverage.

**The API surface.** `https://developer.themoviedb.org/llms.txt` (TMDB's own machine-readable index
of its documentation), fetched 2026-09-10. Every entity prefix in the entire API reference:

```
account authentication collection discover lists movie my person search translations tv
```

Grepping the whole index for `book`, `music`, `album`, `artist`, `isbn`, `podcast`, `audio` returns
**zero hits**. The getting-started page states the scope directly: "This is where you will find the
definitive list of currently available methods for our movie, tv, actor and image API."

**The content policy**, which is stronger evidence because it is an explicit exclusion list rather
than an absence. `https://www.themoviedb.org/bible/new_content?language=en-US`, section
"Not Supported", read 2026-09-10:

> "Below is a list of different types of content that we do NOT allow in the database."

with the list including:

> "Music videos" (rare exceptions: only extended music videos screened as a movie at a film
> festival ... Visual albums reviewed as a movie by professional critics (e.g. Lemonade) are also
> allowed in the movie section as movies.)

> "Audio-only content including audiobooks, narrative podcasts, radio dramas, and audio movies
> (e.g. Bullit et Riper)." (exception: motion comics are allowed.)

> "Blu-ray Pure Audio Discs"

Books are not on the exclusion list because they are not a candidate: TMDB has no book entity at
all. Books appear in the guidelines only as *source material* for films — the same page discusses
"the last book of a YA series" being split into two films, in the context of how to enter the
**films**.

This is directly load-bearing for ADR-0095: a Harry Potter demo group needs a book provider, and
audiobook editions are a category TMDB names as out of scope by policy, not merely absent.

---

## 10. Readium Locator is a published, current specification — ADR-0085 / ADR-0087 area

**The claim.** "Readium Locator is a published specification (not something invented for this
project) providing a normalised progression 0..1 plus a medium-dependent locator."

**CONFIRMED.**

The specification is published at `https://readium.org/architecture/models/locators/`, sourced from
`readium/architecture` at `models/locators/README.md`. Read 2026-09-10. It uses RFC 2119 keywords
(`must`, `may`, `must not`) marked up as such, and it defines exactly the two halves claimed.

**Normalised progression 0..1** — the `location` object:

| Key | Definition | Format | Required |
|---|---|---|---|
| `fragments` | Contains one or more fragment in the resource referenced by the Locator Object. | Array of strings | No |
| `progression` | Progression in the resource expressed as a percentage. | Float between 0 and 1 | No |
| `position` | An index in the publication. | Integer where the value is > 0 | No |
| `totalProgression` | Progression in the publication expressed as a percentage. | Float between 0 and 1 | No |

**Medium-dependent locator** — the spec's own framing:

> "Given the flexible nature of the Readium Web Publication Manifest, we need the ability to provide
> locations into all sorts of resources (text, audio, video, images). Fragments are flexible enough
> to achieve that goal. They also provide a natural extension point for our locator model since any
> media-type can define its own fragment identifiers. They're by nature media-specific and should
> always be understood in the context of the resource that the locator points to (by looking at
> `href` and `type`)."

with a table binding each medium to an existing standard: HTML (`id`), Media Fragment URI 1.0 for
audio, video and images (`t=67`, `xywh=160,120,320,240`), and RFC 3778 for PDF (`page=12`,
`viewrect=50,50,640,480`).

**Not invented here, and current.** The spec predates this project by years and is in active third-
party use: Komga's `R2Locator.kt` is a direct Kotlin transcription, carrying the spec's wording
verbatim in its KDoc ("Progression in the publication expressed as a percentage. Between 0 and 1."),
and Komga's `komga-webui/src/types/readium.ts` mirrors the same four `location` keys. The repository
is maintained — HEAD `48cefd99b7`, 2026-07-15, with substantive spec commits through 2025-11-26 —
and the locator document itself was last corrected on 2024-02-05 (`0d13e8058c6d`, "Fix Locator's
position format"). A spec that is quiet because it is stable, in a repo that is not.

The one framing caveat: `readium.org/architecture` is a community specification published by the
Readium Foundation, not a W3C/IETF standards-track document. It carries no version number or dated
status block. That is the correct thing to say about it — "a published, actively maintained
community specification" rather than "a standard".

---

## 11. Summary

| # | Claim | Verdict |
|---|---|---|
| 1a | Kodi: `videoversion` row keyed on `idFile`, `itemType = EXTRA`, same table and axis as a version | **CONFIRMED** |
| 1b | Kodi: creates no item row at all | **CONFIRMED** |
| 1c | Kodi: "so an extra there cannot carry its own progress" | **CONTRADICTED** |
| 2 | Emby frames 10s as a ceiling because the server increments every second | **CONFIRMED** |
| 3a | Audiobookshelf's completion threshold (10s) is a configurable default — what ADR-0085 says | **CONFIRMED** |
| 3b | Audiobookshelf's progress-*report* interval is configurable — what the claim as worded says | **CONTRADICTED** |
| 4 | Audiobookshelf ships a percentage-based completion mode | **CONFIRMED** |
| 5a | Komga completes EPUB on progression crossing a threshold (`>= 0.99F`) | **CONFIRMED** |
| 5b | Komga completes a comic on a threshold | **CONTRADICTED** (`position == pageCount`) |
| 5c | Audiobookshelf completes a book on progression crossing a threshold | **CONTRADICTED** (never auto-completes) |
| 6 | `ebookProgress`, `ebookLocation`, `page`, `R2Locator` all exist | **CONFIRMED** |
| 7 | MusicBrainz carries script separately from language | **CONFIRMED** |
| 8a | Cover Art Archive images are separately licensed | **CONFIRMED** |
| 8b | Cover Art Archive **metadata** is CC0 | **CONTRADICTED** (CC BY-NC-SA 3.0) |
| 9 | TMDB is film and television only | **CONFIRMED** |
| 10 | Readium Locator is a published, current spec with 0..1 progression and a medium-dependent locator | **CONFIRMED** |

**Counts: 10 confirmed, 5 contradicted, 0 unfounded, 0 judgement.**

No decision in ADRs 0085, 0086, 0087, 0089 or 0095 was falsified by this run. Every contradiction is
a citation, a consequence clause or a licence tier — the shape the previous verification passes
found too. Three of them change what the ADRs should *say*:

1. **ADR-0087** should stop claiming Kodi's model makes per-extra progress impossible. It makes
   per-extra *identity* impossible, which is the better argument and the one the ADR actually needs.
2. **ADR-0085** should stop attributing the progression-threshold rule to "Audiobookshelf and Komga
   both". It is Komga's EPUB branch alone. Audiobookshelf declines to auto-complete a book at all,
   which is a point in the ADR's favour rather than against it.
3. **ADR-0095** should say three licence tiers, not two, and should name the non-commercial clause
   on Cover Art Archive metadata, because a public demo instance is exactly the case it constrains.

**ADR-0089** (four distribution tiers) contained no claim about any product in this owner group and
was not tested by this run; it was read for context only.
