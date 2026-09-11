# Resolving X7–X13: what Plex, Jellyfin and the wider ecosystem actually do

**STATUS: complete. X7, X8, X9 done 2026-09-07; X10, X11, X12, X13 done 2026-09-09.**

Started 2026-09-07. Source of the questions:
`docs/research/competitor-sweep/CONSOLIDATED-FINDINGS.md` section 2 (INTERNAL CONTRADICTIONS), items
X7–X13. Spec under test: `SPEC.md` in this repo (it was `prompt.md` in a separate directory
outside this repository when X7–X9 were written).

**`SPEC.md` was edited by other work while X10–X13 were being written** — it moved from 1010 lines to
1352 across five commits during the session, and X8's and X9's own resolutions landed in it mid-way.
Every line number below is stamped with the commit it was derived against. **Match on the quoted
sentence, not on the number.**

Method: primary sources only where obtainable. Plex support articles fetched with plain
`curl -s https://support.plex.tv/articles/<slug>/` (no User-Agent). Jellyfin source read via the
`gh` CLI against `jellyfin/jellyfin` and `jellyfin/jellyfin-web`. Ecosystem claims traced to the
project's own docs or source wherever possible. Every claim below carries a URL or a file path and
the date it was checked. Where the evidence is thin or absent, it says so.

Each item answers, in order: (1) what Plex does, (2) what Jellyfin does, (3) what the wider industry
does and whether there is a standard, then **VERDICT** — which resolution the evidence supports, and
whether there is a better option the finding did not name.

---

## X7 — Artwork has no rank and no pin

**The contradiction.** `prompt.md` L213-217 gives `editions.is_default` as the owner's pin and says
"Same mechanism as the source order and the field favourite, deliberately: one pattern used twice,
not two patterns." L344-357 defines `artwork` with role, licence, attribution and palette and **no
rank, no `is_default`, no pin**. L483-485 forbids picking by recency. Two providers each supplying a
poster therefore produce two rows and no rule.

### 1. What Plex actually does

**Plex has a candidate list with an explicit selected flag, and it is in the public API.** From
`python-plexapi` (the de facto reference implementation of the unofficial Plex API):

- `plexapi/mixins/resources.py` — `PosterMixin.posters()` fetches
  `GET /library/metadata/{ratingKey}/posters`; `ArtMixin.arts()` fetches `/arts`;
  `LogoMixin.logos()` fetches `/clearLogos`. Each artwork **role is its own endpoint and its own
  candidate list**.
  <https://raw.githubusercontent.com/pushingkarmaorg/python-plexapi/master/plexapi/mixins/resources.py>
  (checked 2026-09-07)
- `plexapi/media.py` L1039-1066, `class BaseResource` — every candidate carries
  `provider` ("The source of the resource. 'local' for local files (e.g. theme.mp3), None if
  uploaded or agent-/plugin-supplied"), `ratingKey`, and **`selected` (bool): "True if the resource
  is currently selected."** `select()` issues `PUT /library/metadata/{id}/posters?url={ratingKey}`.
  <https://github.com/pushingkarmaorg/python-plexapi/blob/master/plexapi/media.py> (checked 2026-09-07)
- `BaseResource.resourceFilepath` decodes the candidate's origin from its id prefix:
  `media://` = local file next to the media, `metadata://` = agent-supplied (stored under
  `Contents/_combined/`), `upload://` = owner upload. So Plex tags each candidate with a
  **provenance class**, not just a provider name.
- **The pin is separate from the selection.** `PosterLockMixin.lockPoster()` sets `thumb.locked=1`;
  `ArtLockMixin.lockArt()` sets `art.locked=1`; `LogoLockMixin.lockLogo()` sets `clearLogo.locked=1`.
  Artwork is lockable **per role**, exactly like a text field.

The picker UI is documented: "**Change Artwork** … Choose from existing options by scrolling
horizontally to make a choice. The chosen art is immediately saved and will have a check mark on its
top right corner. Add new artwork by clicking on the menu on the top right of the artwork type row.
Pick from the Web (paste in a URL to an image)" and, on Web, "each type of artwork available for the
media is on a different tab on the left side of editing window. **Chosen art has a colored border
around it with a check mark.**"
<https://support.plex.tv/articles/201272763-edit-details/> (fetched 2026-09-07, HTTP 200; article
"Last modified on: December 2, 2024")

Priority rules exist alongside the pin, as library settings, not as a per-row rank:
"**Prefer artwork based on library language**: Use localized posters when available"; "**Use local
assets**: When scanning this library, use local posters and artwork if present"; "**Prefer local
metadata**". <https://support.plex.tv/articles/advanced-settings-plex-movie-agent/> (fetched
2026-09-07, HTTP 200; "Last modified on: April 13, 2025")

Server-side, Plex's own metadata team describes poster choice as a **recomputed aggregation over a
per-source cache**: "we have built a component that is internally called the metadata cache. Here we
store the latest available representation for each movie/show from each source … **if today we change
the way posters are selected the cache helps us recompute the poster for all movies much faster**
than if we had to use all these external APIs in real time." And on selection generally: "Sometimes
the selection process is as simple as a **prioritized list of sources** and other times it's more
complex." <https://www.plex.tv/blog/pro-week-day-2-adriana/> (published 2022-09-20 per the page's
`datePublished`; fetched 2026-09-07, HTTP 200).
*Correction to the source finding:* `CONSOLIDATED-FINDINGS.md` and `sweep-plex-www-B.md` cite this
page as `plex-pro-week-22-day-2-adriana/`, which now **404s**. The live slug is
`https://www.plex.tv/blog/pro-week-day-2-adriana/`.

#### The historical claim in the finding is only half right, and the half that is wrong is the important half

The finding says Plex "fixed nondeterministic poster selection as a bug around 2010 and has had a
picker since 2012". Checked against the Plex forums (Discourse JSON API, `forums.plex.tv/t/{id}.json`,
fetched 2026-09-07):

- The **picker predates 2012**. Forum thread 34002 (2013-05-08) links four earlier requests, the
  oldest stated as February 2011, all of which presuppose that manual poster selection already
  existed. <https://forums.plex.tv/t/34002>
- The **pin did not exist in 2013**, and that is the whole failure: "there is no locked-function for
  Posters, like it is for other Informations (Genre etc.). **So the Posters are constantly switching,
  even if I have manually selected another one.** This makes the whole 'Poster-change-feature'
  completely useless. **I have changed the Posters for about 300 Movies, just to see that every one
  was set back a few days later.**"
- The reported trigger is precisely CanonCore's source order: "**it was definitely after changing the
  order of the Freebase-Agents**". One of the linked tickets is titled
  "*bug: Already changed/edited Posters set back after changing direction of Agents*"
  (plexapp.lighthouseapp.com ticket 1450 — the pre-2012 tracker, now dead, cited from the 2013 thread).
- A Plex staff reply in the same thread states the intended rule: "This is already the default
  behavior. In fact ***all* posters, once initially set (even automatically by an agent), should not
  be updated on subsequent scans/refreshes.** What you guys are reporting here sounds like a bug."
  So Plex's design rule is **first-write-wins-and-stick**, and every deviation is classed as a bug.
- It was **not fixed**. Live forum threads with the same complaint span the whole period:
  "[feature request] Lock artwork" (2014-08-30, t/75246); "Stop overwrite hand-picked-posters when
  changing agent" (2021-04-25, t/711791); "Lock Poster" (2021-07-04, t/726576); "Movie Posters are
  being Changed" (2022-11-24, t/819862); "Stop. Changing. My. Posters" (2024-02-29, t/870858);
  "Posters Reset" (2025-10-06, t/932206); "Stop Plex from Overriding MY meta/naming/posters"
  (2026-02-03, t/936022); "Refresh all metadata – but no posters, please" (2026-02-04, t/936053).
  (Titles and dates from `forums.plex.tv/search.json`, fetched 2026-09-07.)

**This strengthens the prompt's own claim** at L483-485 ("a display that changes after a refresh
nobody asked for is the single longest-standing complaint in this category"). The prompt dates it to
Jellyfin 2021. Plex's version of the same complaint is fifteen years old and still open.

### 2. What Jellyfin actually does

**Jellyfin does not keep candidates at all for a poster. It keeps one, and the first provider in a
declared order wins.**

- `MediaBrowser.Providers/Manager/ItemImageProvider.cs` L42-53 defines `_singularImages`:
  `Primary, Art, Banner, Box, BoxRear, Disc, Logo, Menu, Thumb`. Only `Backdrop` is multi-valued.
- L163-167: providers are iterated **in order**; L312-329 per provider:
  `if (!item.HasImage(imageType) || (refreshOptions.IsReplacingImage(imageType) && ...))` then
  download. Once any provider has supplied a Primary image, **every later provider is skipped for
  that type**. There is no second row, no rank, no tie-break — the losing answers are never stored.
  <https://github.com/jellyfin/jellyfin/blob/master/MediaBrowser.Providers/Manager/ItemImageProvider.cs>
  (checked 2026-09-07)
- The order is user-declared per library and per item type:
  `MediaBrowser.Model/Configuration/TypeOptions.cs` L318-330 — `MetadataFetchers`,
  `MetadataFetcherOrder`, `ImageFetchers`, `ImageFetcherOrder`, `ImageOptions`.
  `ImageOption` carries `Limit` and `MinWidth` per type (Movie defaults: Backdrop `Limit = 1,
  MinWidth = 1280`; Primary `Limit = 1`; Art/Disc/Banner `Limit = 0` "Don't download this by default
  as it's rarely used").
- `MediaBrowser.Providers/Manager/ProviderManager.cs` L401-408 resolves the order:
  `.OrderBy(i => GetConfiguredOrder(fetcherOrder, i.Name)).ThenBy(GetDefaultOrder)`, where
  `GetConfiguredOrder` (L615-626) returns the array index, or `int.MaxValue` for a provider not in
  the list ("default to end"), and `GetDefaultOrder` (L628-638) falls back to `IHasOrder.Order`,
  default 50.
- Within one provider, candidates are ordered by language: L363
  `return result.OrderByLanguageDescending(preferredLanguage);`.
- **There is no image lock.** `MediaBrowser.Model/Entities/MetadataField.cs` — the complete lockable
  set is `Cast, Genres, ProductionLocations, Studios, Tags, Name, Overview, Runtime, OfficialRating`.
  Images are not lockable. The only protection is that a default refresh will not replace an image
  that already exists; `ReplaceAllImages` blows away the owner's choice with no per-item override.
- There **is** a picker, but it resolves by materialising, not by pinning:
  `Jellyfin.Api/Controllers/RemoteImageController.cs` — `GET /Items/{itemId}/RemoteImages`,
  `GET /Items/{itemId}/RemoteImages/Providers`, `POST /Items/{itemId}/RemoteImages/Download`.
  The chosen candidate is **downloaded into the single slot**; the alternatives are not persisted.

So Jellyfin's answer to "two providers, two posters" is first-non-empty-wins in a declared order,
with the loser discarded — structurally identical to the metadata merge the prompt already refuses
at L462-465 ("A single primary source with others filling gaps is REFUSED: that is Jellyfin's
design, it merges first-non-empty-wins and DISCARDS the losing answers").

### 3. Industry standard / best practice

There is **no specification** for this. There is, however, a strikingly consistent convergent
pattern, and the incumbents split cleanly into two camps.

**Camp A — keep every candidate, one boolean pin per slot (the pattern CanonCore already uses for
`editions.is_default`).**

- **Plex**: candidate list per role, `selected` boolean per candidate, `select()` writes the pin,
  and a *separate* `.locked` flag per role. Two mechanisms: a pin and a lock.
- **Komga** is the closest and cleanest analogue, and it is worth reading as a reference
  implementation of the exact fix X7 proposes. `ThumbnailSeries` / `ThumbnailBook`
  (`komga/src/main/kotlin/org/gotson/komga/domain/model/Thumbnail{Series,Book}.kt`) are:
  `(thumbnail: ByteArray?, url: URL?, selected: Boolean, type: Type, mediaType, fileSize, dimension,
  id, seriesId/bookId, createdDate, lastModifiedDate)` where
  `Type = SIDECAR | USER_UPLOADED` (series) and `GENERATED | SIDECAR | USER_UPLOADED` (book).
  So: **a pin plus a provenance class on the same row.**
  `SeriesLifecycle.addThumbnailForSeries(thumbnail, markSelected: MarkSelectedPreference)` takes an
  explicit write-time policy — `YES`, `NO`, or **`IF_NONE_OR_GENERATED`** (pin it only if nothing is
  pinned). `thumbnailsHouseKeeping` enforces the invariant directly: more than one selected →
  keep the first and unselect the rest; none selected and candidates exist → "Series has no selected
  thumbnail, choosing one automatically". Deleting is restricted to `USER_UPLOADED`.
  <https://github.com/gotson/komga/blob/master/komga/src/main/kotlin/org/gotson/komga/domain/service/SeriesLifecycle.kt>
  (checked 2026-09-07)

**Camp B — one slot, first-writer-wins, no candidates kept.** Jellyfin (above), and Emby, from which
Jellyfin forked in 2018 — the `ImageFetcherOrder` / `TypeOptions` shape is inherited Emby code, so
Emby is not independent evidence.

**Kodi** sits between: it stores art rows keyed `(media_id, media_type, type, url)` in its `art`
table — one URL per art *type*, with a "Choose art" dialog offering the alternatives the scrapers
returned. It is closer to camp A in the UI and camp B in the schema. (Thin evidence — I did not
verify Kodi's schema against source in this pass; treat as indicative, not established.)

**The cross-domain standard, where one exists, is camp A.** MusicBrainz's Cover Art Archive gives
each image an id and a **set of types** plus explicit `front`/`back` booleans, so "which is the front
cover" is a stored per-image flag rather than an ordering accident
(<https://musicbrainz.org/doc/Cover_Art_Archive/API> — types and the `front`/`back` designation).
Wikidata models the same thing as a statement with a rank: `P18` (image) can have several values on
one item and the display picks the one with **preferred rank**
(<https://www.wikidata.org/wiki/Help:Ranking>). IIIF Presentation 3.0 — one of the prompt's own named
standards — makes it structural: a resource's `thumbnail` is an **ordered array**, and
"the first item in the array should be the most appropriate" (<https://iiif.io/api/presentation/3.0/#thumbnail>).
Every one of these says: keep them all, and put the choice **in the data**.

### VERDICT

**The evidence supports the fix the finding already names, and adds one column to it.**

The minimum is a nullable `is_default` on `artwork`, at most one per `(item_id, role)`, reusing the
`editions.is_default` sentence verbatim. That is defensible on Plex's `selected`, Komga's `selected`,
Wikidata's preferred rank and IIIF's ordered thumbnail array. Do this.

But the Plex history says the pin alone is not sufficient, and this is the part the finding misses.
Plex has had a picker since at least 2011 and the complaint is still live in 2026, because **a pin
that is silently overwritten by the next refresh is not a pin**. Two further things are needed, both
already present elsewhere in the prompt:

1. **A default rule for the unpinned case that is not recency.** The prompt already has the right
   one: the declared source order (L478-482). Artwork should use it, not invent a second rule. That
   is exactly Jellyfin's `ImageFetcherOrder` and Plex's "prioritized list of sources", and it means
   `artwork` needs no `rank` column — the source order does the work, and `is_default` overrides it.
   Cheaper than the finding's "rank *and* pin".
2. **The pin must survive a source-order change.** This is the actual Plex bug, verbatim: "set back
   after changing direction of Agents". CanonCore has "re-ordering the source list re-picks the
   whole catalogue at once" as a *feature* — that sentence, applied to artwork without a carve-out,
   reproduces the fifteen-year-old Plex complaint on day one. State that a set `is_default` (and a
   set field favourite) is **not** re-picked by a source-order change.

**A better option the finding did not name:** borrow Komga's `MarkSelectedPreference`. Making the
write-time policy an explicit three-valued argument on "artwork arrived" (`YES` / `NO` /
`IF_NONE_OR_GENERATED`) is what turns "first-write-wins-and-stick" from an emergent behaviour into a
stated one, and it is the difference between Komga's model working and Plex's leaking. In CanonCore
terms: an import pins only if nothing is pinned; an owner action always pins; a refresh never pins.
One enum, no extra table.

Also worth taking from Plex: it locks artwork **per role** (`thumb.locked`, `art.locked`,
`clearLogo.locked`), not per item. `at most one per (item, role)` — as the finding says — is right,
and the uniqueness constraint should be written that way.

**Not supported by the evidence:** the finding's dates. Plex did not fix this around 2010; there is
no evidence it has been fixed at all. Cite the Plex forum record instead, which is a stronger
argument for the column than a fix would have been.

---

## X8 — `source` names a provider or the owner, and there is no third kind

**The contradiction.** `prompt.md` L284-286: "`source` NAMES A PROVIDER OR THE OWNER." L354: "Extract
the palette when the artwork is fetched, onto this row." The palette is computed by CanonCore. So
are normalised values, derived extents and confidence scores. None of them is a provider and none is
the owner.

### 1. What Plex actually does

Plex records **the algorithm version and nothing else**. From `python-plexapi`, `plexapi/media.py`
L1145-1176, `class Marker` (Plex's computed intro/credits markers):

> Attributes: `end`, `final` (True if the marker is the final credits marker), `id`, `type`,
> `start`, **`version` (int): "The Plex marker version."**

`_loadData` reads it from a nested `<Attributes version="…">` element.
<https://github.com/pushingkarmaorg/python-plexapi/blob/master/plexapi/media.py> (checked 2026-09-07)

There is no source field on a marker, no confidence, and no way to ask where it came from. What Plex
keeps is the one thing it actually needs: **which build of the detector produced this, so it knows
what to recompute when the detector changes.** The same instinct appears in the artwork candidate
list, where `BaseResource.provider` is `'local'` for local files and `None` for "uploaded or
agent-/plugin-supplied" — i.e. Plex tags origin as a *class* (local / uploaded / agent), not only as
a name (see X7).

Plex's aggregation blog post confirms that server-side values are computed rather than quoted:
summaries are chosen partly by a **score** ("the length of the summary also adds a score and we
penalize summaries that end mid-sentence"), and the whole aggregate is recomputable from a per-source
cache. <https://www.plex.tv/blog/pro-week-day-2-adriana/> (2022-09-20, fetched 2026-09-07). The
displayed value is therefore derived, and Plex does not record that it is.

### 2. What Jellyfin actually does

For ordinary metadata, Jellyfin persists **no provenance at all** — the prompt already says so at
L52-55, and `MetadataResult.Provider` living on a transient object is the reason. What is worth
adding is that **the one time Jellyfin needed to store a computed claim, it minted a provider id for
the computation.**

`src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/MediaSegment.cs` (added by migration
`20240729140605_AddMediaSegments`, i.e. July 2024, shipped in 10.10):

```
public Guid Id; public Guid ItemId; public MediaSegmentType Type;
public long StartTicks; public long EndTicks;
public required string SegmentProviderId;
```

`SegmentProviderId` is **required**. `Jellyfin.Server.Implementations/MediaSegments/MediaSegmentManager.cs`
derives it from the provider's name (`GetProviderId(provider.Name)`), keeps rows from different
providers side by side rather than merging them (L99: existing segments are scoped
`&& e.SegmentProviderId == GetProviderId(provider.Name)`), orders providers by
`libraryOptions.MediaSegmentProviderOrder` (L58-60), and filters reads by which providers the
library has enabled (L238-246). Intro and credit detection is *computation*, not a lookup — and
Jellyfin modelled the computing plugin as an ordinary named provider. (All checked 2026-09-07 at
<https://github.com/jellyfin/jellyfin>.)

One caveat worth noting because CanonCore will hit it: `MediaBrowser.Model/MediaSegments/MediaSegmentDto.cs`
— the API model — carries `Id, ItemId, Type, StartTicks, EndTicks` and **not** `SegmentProviderId`.
Jellyfin stores the provenance and does not expose it.

### 3. Industry standard / best practice

**There is a standard, it is old, and it is in the family the prompt already names.**

**PROV-O (W3C Recommendation, the prompt's own list).** `prov:Agent` has exactly three subclasses:
**`prov:Person`, `prov:Organization`, `prov:SoftwareAgent`** — "Three subclasses of Agent
(`prov:Person`, `prov:Organization`, and `prov:SoftwareAgent`) and three subclasses of Entity are
provided". Responsibility for a value is `prov:wasAttributedTo` an Agent; a computed value is
attributed to a `SoftwareAgent`. Separately, `prov:wasDerivedFrom` ("A derivation is a transformation
of one entity into another") and `prov:hadPrimarySource` distinguish a derived entity from a quoted
one, with `prov:qualifiedDerivation` for the elaborated form.
<https://www.w3.org/TR/prov-o/> (fetched 2026-09-07)

**So PROV-O's answer is not "add a third kind of source".** It is: *the source slot already takes
three kinds of agent, and one of them is a program*; and derivation is additionally a **relation to
the inputs**, not a flag. That second half is the part CanonCore's `source` column cannot express and
should not pretend to.

**Wikidata.** A reference is a set of properties, and the vocabulary distinguishes asserted from
derived explicitly (labels/descriptions fetched live from the Wikidata API, 2026-09-07):

| Property | Label | Description (verbatim) |
|---|---|---|
| `P248` | stated in | "to be used in the references field to refer to the information document or database in which a claim is made" |
| `P887` | **based on heuristic** | "indicates that the property value is determined based on some heuristic (Q201413); **to be used as source**" |
| `P3452` | **inferred from** | "statement added based on related statement found within the item, not the entity described by the item (**to be used in a reference field**)" |

Both derived forms are explicitly *sources*, occupying the same slot as `stated in`, and both **name
the specific heuristic or the specific input statement**. This is close to decisive: the mature
open-data model with per-statement provenance solved X8 by widening what may fill the source slot,
not by adding a parallel column.

**MARC 21 field 883 — "Metadata Provenance", NEW in 2012, renamed 2020.** This is the closest thing
to a formal specification of exactly CanonCore's problem, at *per-field* granularity:

- **First indicator (method of assignment): `0` Fully machine-generated, `1` Partially
  machine-generated, `2` Not machine-generated.**
- `$a` Creation process — "Identifies the process used to produce the data contained in the linked
  field" (worked examples: `classify`, `autodewey`, `deweyclassifierv0.1`, `viafgerman`,
  `parallelrecordcopy`) — note `deweyclassifierv0.1` carries **a version**.
- `$c` **Confidence value** — "a floating point value between 0 and 1. … 0 means no confidence and 1
  means full confidence."
- `$d` Creation date, "This also serves as the beginning of the period of validity."
- `$q` Assigning or generating agency.
- `$x` **Validity end date** — "expected end of period of validity for the data in the linked field."
- `$u` URI identifying the process, which "can lead to a textual or structured description of the
  process, or the URL that was used to generate the linked field's content can be provided directly,
  i.e., a URL invoking a web service or conveying an API call."
- Content designator history: "Field 883 - **Machine-generated Metadata Provenance [NEW, 2012]** …
  [RENAMED, 2020] Field 883 was renamed to allow the recording of non-machine-generated content."

<https://www.loc.gov/marc/bibliographic/bd883.html> — loc.gov returns **403 to curl and to WebFetch**
(Cloudflare); read via <http://web.archive.org/web/2024/https://www.loc.gov/marc/bibliographic/bd883.html>
(fetched 2026-09-07; page dated "May 2020").

**MusicBrainz has no answer.** Automated edits are made by ordinary editor accounts distinguished
only by a naming convention: "This page is about programs written by editors that automatically enter
edits into the database, called 'bots'. … create a new account with a name that shows other editors
that a) it is a bot and b) you are running it (e.g. 'YOUR-NICK_bot')."
<https://musicbrainz.org/doc/Bots> (fetched 2026-09-07). Provenance lives in the edit history (who
changed what, when), not on the value, and a bot is not distinguishable from a human in the schema —
only by convention in the username. **This is a counter-example, not a model.** It is also the
failure mode CanonCore would inherit if it forced derived claims into the existing `source` column as
if they were providers, with only a naming convention to tell them apart.

### VERDICT

**Add the third kind — but the evidence says make it a source *identity*, not a source *flag*.**

The finding proposes "a third source kind, `derived`, naming the computation". The evidence supports
that and sharpens it in three ways:

1. **Widen the slot, do not add a column.** Wikidata (`P248` / `P887` / `P3452` all fill the same
   reference slot) and PROV-O (`Person` / `Organization` / `SoftwareAgent` all fill `prov:Agent`)
   both put the computation *in* the source position. CanonCore's `source` is already a reference to
   a first-class thing — the Owner "is a first-class source and sits first in the source order"
   (L286-288). A computation is a third first-class source in the same list. That costs one row in a
   vocabulary table, not a migration, and it keeps "one pattern used twice, not two patterns" intact.
2. **The derived source must name the computation *and its version*.** This is the part the finding
   does not name and it is the load-bearing part. Plex keeps a marker `version` and nothing else.
   MARC's worked example is `deweyclassifierv0.1`. The only operation you ever perform on a derived
   claim is *invalidate and recompute it when the algorithm changes*, and a bare `derived` flag
   cannot answer "which rows does the new palette extractor invalidate?". `source = derived:palette-v2`
   can. Without the version, X8's fix buys provenance display and not the thing provenance is for.
3. **Sit the source order on top of it.** If `derived` is a source, it takes a place in the declared
   source order for free, and "a provider's runtime beats our derived guess" becomes a config line
   rather than special-case code.

**A better option the finding did not name, worth doing at the same time because it costs nothing
later and a migration now:** MARC 883 shows that the same per-field record carries, together, the
generation process, a **confidence value 0..1**, a creation date and a **validity end date**. Three
of CanonCore's open problems live in that one shape:

- the derived source kind (X8),
- **a confidence value on the claim** — X13 needs somewhere to record what the scorer said about a
  statement, and this is where the standards put it,
- **a per-claim validity end date** — X9 needs an expiry and has no scheduler; an expiry stored on
  the row is checked on read, and needs no job at all (see X9).

`statements` already has `source`, `observed_at` and `rank`. Adding `valid_until` (nullable) and
`confidence` (nullable) makes the row the same shape as a MARC 883 record, and the standards
justification is a single field definition rather than three separate arguments.

**On the palette specifically:** it needs none of this. Palette is a *column on the artwork row*, and
its provenance is structural — the column exists only because that row's bytes were fetched, so
"where did this come from" is answered by the row's own `source`. The prompt is not wrong at L354; it
is only wrong to conclude from it that nothing else is ever computed. Do not attach a `derived`
source to the palette. Attach it to computed **statements**, which is where the question actually
has no answer today.

---

## X9 — The six-month cache rule, with no cache and no scheduler

**The contradiction.** `prompt.md` L80-84 makes "done" depend on TMDB working "with the attribution
string and the **six-month cache rule honoured**". L344-346 makes artwork a "Provider-supplied URL"
and never says the bytes are kept. There is no scheduler anywhere in the document.

### 0. What TMDB's licence actually says (this is the load-bearing fact and the finding does not quote it)

From the TMDB API Terms of Use, section **1.C. Restrictions — "In addition, You must not:"**
(fetched 2026-09-07, HTTP 200, <https://www.themoviedb.org/api-terms-of-use>; note
`https://www.themoviedb.org/documentation/api/terms-of-use` 301-redirects here):

> **"Cache, for longer than 6 months, any information obtained through or from TMDB or the TMDB APIs."**

**It is a ceiling, not a floor.** Nothing in the licence requires caching. "Honouring the six-month
cache rule" is satisfied by not caching at all, and satisfied by caching with an expiry ≤ 6 months.
It is violated only by caching indefinitely. The finding treats it as an obligation to hold a cache;
it is the opposite.

Three further clauses from the same document bear directly on CanonCore's public demo:

- **Scope.** The clause says "any information", not "any image". A cached poster and a cached JSON
  runtime are covered identically.
- **Termination.** "If TMDB terminates Your license, or You terminate your license, You must
  immediately cease all use of the TMDB APIs, TMDB Content, and any TMDB API key(s), and **you must
  promptly delete or otherwise purge all TMDB Content, including any cached content**." So there
  must be a way to purge everything sourced from one provider on demand — which CanonCore gets for
  free from `source` on every statement and artwork row, and should say so.
- **Attribution, verbatim and mandatory.** "You must use the TMDB logo… less prominent than the logos
  or marks that primarily describe or identify Your Application… In addition, you must place the
  following notice prominently in or on Your Application: **'This [website, program, service,
  application, product] uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise
  approved by TMDB.'**"
- **Two clauses to check before the public demo ships**, neither of which the prompt mentions:
  "Use TMDB as an **image hosting service** for banner advertisements, graphics, etc." is prohibited
  (aimed at ad banners, but it is the clause a hotlinking design has to argue against); and the
  commercial-use section lists "Using TMDB, the TMDB APIs, or TMDB Content on or in connection with a
  **'destination' website**… or for driving traffic" as a commercial use requiring a separate written
  agreement. A free, public, read-only demo is not obviously a destination website, but this is a
  judgement TMDB reserves "in its sole discretion", and it is worth a sentence in the prompt rather
  than a surprise.

TMDB's own image documentation shows a public CDN with size variants
(`https://image.tmdb.org/t/p/w500/<file_path>.jpg`, base URL and sizes from `/configuration`) and
says nothing about hotlinking either way. <https://developer.themoviedb.org/docs/image-basics>
(fetched 2026-09-07; page "Updated 11 months ago").

### 1. What Plex actually does

**Caches locally, serves from its own host, and evicts on a scheduler.**

- Provider artwork is downloaded into the item's metadata bundle. `python-plexapi`'s
  `BaseResource.resourceFilepath` decodes the storage layout: `metadata://…` →
  `<metadataDirectory>/Contents/_combined/…`, `upload://…` → `<metadataDirectory>/Uploads/…`,
  `media://…` → `Media/localhost/…`. Nothing points at the provider's CDN.
- Resized derivatives go in a second, separate cache: "As various Plex apps request images from your
  Plex Media Server, they will be generated as needed and then cached for future use…
  `%LOCALAPPDATA%\Plex Media Server\Cache\PhotoTranscoder` … `~/Library/Caches/PlexMediaServer/PhotoTranscoder/`".
  <https://support.plex.tv/articles/204041406-where-are-plex-media-server-cached-images-stored-on-my-computer/>
  (fetched 2026-09-07, HTTP 200; "Last modified on: February 28, 2019")
- Clients fetch images from the Plex server, not from the provider: `plexapi`'s `thumbUrl` is
  `self._server.url(thumb, includeToken=True)`. **No visitor ever contacts the metadata provider.**
- **Eviction is a scheduled task, and it is a first-class product feature.** "Your Plex Media Server
  can be scheduled to perform certain maintenance tasks for you… Settings > Server > Scheduled Tasks…
  Choose the start and end times for maintenance". The task list includes: "Back up database every
  three days", "Optimize database every week", "**Remove old bundles every week**", "**Remove old
  cache files every week**", "**Refresh local metadata every three days**", "Update all libraries
  during maintenance". <https://support.plex.tv/articles/202197488-scheduled-server-maintenance/>
  (fetched 2026-09-07, HTTP 200)

So the answer to "there is no scheduler anywhere in the prompt" is that the comparable product has a
user-visible scheduler with a maintenance window and six named periodic jobs, and treats it as
ordinary.

### 2. What Jellyfin actually does

**Also caches locally and serves from its own host — and its expiry policy tells you exactly where
the industry draws the line.**

- Images are written to disk. `MediaBrowser.Providers/Manager/ImageSaver.cs` → `GetSavePaths` /
  `GetStandardSavePath` writes either next to the media (`saveLocally`, e.g. `poster.jpg`,
  `season01-poster.jpg`) or under `_config.ApplicationPaths.InternalMetadataPath`.
  `ProviderManager.SaveImage(BaseItem, string url, …)` downloads the URL and hands the stream to
  `ImageSaver`. There is no code path that stores a provider URL for later display.
- Images are served from Jellyfin: `Jellyfin.Api/Controllers/ImageController.cs` —
  `GET /Items/{itemId}/Images/{imageType}[/{imageIndex}]`. Again, **the browser never contacts the
  provider**.
- **API responses are cached for one hour, in memory.**
  `MediaBrowser.Providers/Plugins/Tmdb/TmdbClientManager.cs` L26: `private const int
  CacheDurationInHours = 1;` used as
  `AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(CacheDurationInHours)` on a size-limited
  `MemoryCache`. Comfortably inside TMDB's six months, by three orders of magnitude, and lost on
  restart.
- **Image bytes have no expiry at all.** They sit on disk until the item is deleted or the user runs
  a refresh with `ReplaceAllImages`. `Emby.Server.Implementations/ScheduledTasks/Tasks/DeleteCacheFileTask.cs`
  ("Clean Cache Directory", an `IntervalTrigger`) uses `var minDateModified = DateTime.UtcNow.AddDays(-30);`
  — but that is the *cache* directory, not the metadata directory where downloaded artwork lives.
- Jellyfin has a full scheduled-task framework, which is the relevant structural point:
  `Emby.Server.Implementations/ScheduledTasks/Tasks/` contains `AudioNormalizationTask`,
  `ChapterImagesTask`, `CleanActivityLogTask`, `CleanupUserDataTask`, `DeleteCacheFileTask`,
  `DeleteLogFileTask`, `DeleteTranscodeFileTask`, `MediaSegmentExtractionTask`,
  `OptimizeDatabaseTask`, `PeopleValidationTask`, `PluginUpdateTask`, `RefreshMediaLibraryTask`.

(All Jellyfin paths checked 2026-09-07 against `master` at <https://github.com/jellyfin/jellyfin>.)

**Jellyfin therefore does not honour TMDB's six-month rule for images**, and it also ships one
hardcoded TMDB key for all users — which the prompt already calls out at L590-593. Its behaviour is
the norm, not a model.

### 3. Industry standard / best practice

**Local caching is universal in this category, and hot-linking is not done by anyone.**

- Plex: metadata bundle + PhotoTranscoder cache (above).
- Jellyfin / Emby: `ImageSaver` to the metadata path or beside the media (above).
- Audiobookshelf: `server/managers/CoverManager.js` — `downloadCoverFromUrlNew(url, libraryItemId,
  libraryItemPath, forceLibraryItemFolder)` plus `uploadCover`, `saveEmbeddedCoverArt`,
  `saveEbookCoverArt`, `removeOldCovers`. Provider covers are fetched to local storage.
  <https://github.com/advplyr/audiobookshelf/blob/master/server/managers/CoverManager.js> (checked 2026-09-07)
- Komga: `ThumbnailSeries`/`ThumbnailBook` hold either `thumbnail: ByteArray?` **or** `url: URL?`,
  and `exists()` resolves the URL as a **local filesystem path** (`Files.exists(Paths.get(url.toURI()))`)
  — so even Komga's "URL" variant is a local sidecar, not a remote reference (see X7 for the file
  path).

**There is no standard for eviction and no convergent number.** The practices observed are:
Plex's weekly "remove old cache files"/"remove old bundles" inside a user-chosen maintenance window;
Jellyfin's 30-day sweep of a cache directory that does not contain the artwork; and, for the
artwork itself, nobody expires anything. The **only** formal expiry mechanism found anywhere in this
whole investigation is MARC 21 field 883 `$x` — "Validity end date … expected end of period of
validity for the data in the linked field", stored **on the record**, alongside `$d` creation date
(which "also serves as the beginning of the period of validity")
(<http://web.archive.org/web/2024/https://www.loc.gov/marc/bibliographic/bd883.html>, fetched
2026-09-07 — loc.gov itself 403s to curl and WebFetch). That is a per-row expiry evaluated by
whoever reads the row, with no job.

**On the privacy half of the finding, the evidence is decisive.** Both Plex and Jellyfin proxy every
image through their own host (`/library/metadata/…/thumb` with a Plex token;
`/Items/{id}/Images/{type}`). A hotlinking design would make CanonCore the only product in the
category that discloses each viewer's IP address and browsing to a third party — on the one surface
where it is a publisher. The finding is right to flag it; the evidence is that nobody does it.

### VERDICT

**Cache the bytes, serve them from CanonCore, and give the row an expiry date instead of giving the
system a scheduler.** This resolves the contradiction without adding the thing the prompt has
deliberately not got.

The reasoning, in order:

1. **Hotlinking is out.** Not because TMDB forbids it (it does not clearly), but because it is
   unique in the category, it leaks every demo visitor to a third party, and it makes the page break
   whenever a provider rotates a path. Both incumbents proxy. Do what they do.
2. **Storing bytes therefore happens, and the six-month rule becomes real.** It is a ceiling, so the
   requirement is: *no cached provider content older than the provider's declared maximum*.
3. **An expiry does not need a job.** The finding asserts "an expiry needs a job". That is only true
   if expiry means *deletion*. If expiry means *not serving stale content*, it is a read-time check:
   store `fetched_at` on the artwork row, and treat a row past its provider's ceiling as absent —
   re-fetch on next enrichment, fall back to no artwork until then. This is exactly MARC 883's `$d`
   + `$x` shape, and it is a `WHERE` clause, not a scheduler. Byte deletion can then ride on the
   existing tombstone/orphan sweep whenever one is built, without the correctness of the licence
   term depending on it.
4. **Put the ceiling in the provider contract, not in TMDB-specific code.** CMPP already declares
   capabilities per provider ("browse OPTIONAL and DECLARED", L327-331). A declared
   `max_cache_age` — absent for the wiki provider, six months for TMDB — is one more declared field,
   it keeps a third party's licence out of CanonCore's core, and it is the shape the prompt already
   uses. This is also the honest way to satisfy stop condition 1's "six-month cache rule honoured":
   the rule is *implemented generally* and *configured* by the TMDB provider.
5. **State the purge path.** Termination requires purging all TMDB content on demand. `source` on
   every statement and artwork row already makes that one `DELETE … WHERE source = …`. Say so; it
   turns a licence obligation into a property of the model that is already there.

**A better option the finding did not name:** the size question the finding calls "unbudgeted,
unbounded" is neither, and saying so removes the reason to hesitate. TMDB serves poster variants
(`w92 … w500 … original`) selected by the caller. Caching one `w500` poster and one `w780` backdrop
per item, at roughly 50-150KB each, is a bounded few hundred megabytes for a catalogue the size of
the Tardis archive extract (11,285 stories) — and it is bounded *by the catalogue*, which is exactly
the property "unbounded" claims it lacks. Declare the stored size variant in the provider contract
alongside the cache ceiling, and the store is budgeted at design time rather than discovered at
runtime. Plex's separate `PhotoTranscoder` cache exists because it did the opposite and had to add a
weekly sweep for the derivatives.

**One thing the prompt should stop saying:** L344-346 calling artwork a "Provider-supplied URL" is
the source of the contradiction. Once the bytes are stored, the URL is *where it came from*, not
*what is displayed* — the same distinction the model already makes for files ("PATH IS LOCATION, NOT
IDENTITY"). Rewrite the artwork row as: the provider URL it came from, the locally stored bytes, the
fetch time, the licence and attribution, the role, the palette. That is one sentence and it removes
the ambiguity permanently.

---

## X10 — File roles are closed at `media|subtitle|audio|chapters`

**Note on line numbers from here on.** X7–X9 above cite `prompt.md`. That document now lives in this
repo as `SPEC.md`. Every bare `L…` reference in X10–X13 is a line of **`SPEC.md`**.

**`SPEC.md` is being edited by other work while this file is being written, so line numbers here are
indicative and the quoted text is authoritative.** X10–X13 numbers were derived on 2026-09-09 against
`SPEC.md` at commit `3194ba2` (1255 lines); the file moved again to commit `094206e` (1266 lines)
during the writing of X11. The source finding's own numbers had already gone stale before I started —
its `L271-272` for the file role was L289-290 at `3194ba2`, and its `L670-680` for the
browse-exclusion rule was L1026-1036. **Match on the quoted sentence, never on the number**, and
re-derive before editing the spec.

**The contradiction.** `SPEC.md` L289-290: "Files carry a role: media|subtitle|audio|chapters, and a
sidecar references the file it accompanies plus a language." L801-802: "Force-complete anything under
five minutes so trailers never sit in Continue Watching." A trailer is therefore a playable thing that
accrues per-edition progress, and there is no role for it. Separately, `chapters` sits in the closed
set with no data model, no display and no stated source: the analysis pass at L760-764 writes
"duration, container, codecs, resolution and bitrate" and nothing else, and no other line in the
document mentions a chapter.

### 1. What Plex actually does

**Plex has no file-role enum at all.** It has four separate mechanisms, and none of them is a role on
a file. Everything below was checked on 2026-09-09.

**(a) An extra is its own metadata item, not a role on a file.** python-plexapi `plexapi/video.py`
L1245-1281, `class Clip(Video, Playable, ClipMixins)`: `TAG = 'Video'`, `TYPE = 'clip'`,
`METADATA_TYPE = 'clip'`, with attributes `extraType (int)`, `subtype (str): Type of clip (trailer,
behindTheScenes, sceneOrSample, etc.)`, `media (List<Media>)`, `index`, `duration`, `year`,
**`viewOffset (int): View offset in milliseconds`**. L1309-1320, `class Extra(Clip)` — "Represents a
single Extra (trailer, behindTheScenes, etc.)" — inherits `librarySectionID` from its parent item.
<https://github.com/pushingkarmaorg/python-plexapi/blob/master/plexapi/video.py>

So in Plex a trailer is: a child object of the movie, of a *different metadata type* from the movie,
addressable, playable, carrying its own view offset, and never a row in the movie library's own list.

**(b) The naming rules, and the point the finding will care about most — extras attach per edition.**
<https://support.plex.tv/articles/local-files-for-trailers-and-extras/> (fetched 2026-09-09, HTTP 200,
"Last modified on: February 8, 2025"):

> Local extras can be located alongside the main movie file in a directory named for the movie.
> They're indicated by using specific naming at the end of the filename. … Where `-Extra_Type` is one
> of: `-behindthescenes`, `-deleted`, `-featurette`, `-interview`, `-scene`, `-short`, `-trailer`,
> `-other`. **Note**: The filename must end in the `-Extra_Type` value exactly.

and the subdirectory form, `Behind The Scenes / Deleted Scenes / Featurettes / Interviews / Scenes /
Shorts / Trailers / Other`. Eight types either way. And:

> **Note**: If you're making use of multiple editions for movies, you need to make sure that each
> edition is stored in its own named movie directory. **The local trailers and extras can then be
> placed inside that specific edition folder**, like normal.

That is Plex saying an extra belongs to *one edition*, not to the work — which is the attachment
point `files` already has in L284 ("Attached to item or edition").

**(c) Subtitle and audio are not file roles either. They are stream types on a part.** `plexapi/media.py`
L105-136, `class MediaPart` — "Represents a single media part (often a single file)", with `file` ("The
path to this file on disk"), `container`, `size`, `key`, and `streams`. L233-273, `class MediaPartStream`:
"Base class for media streams. These consist of video, audio, subtitles, and lyrics", with
`streamType (int): The stream type (1= VideoStream, 2= AudioStream, 3= SubtitleStream)` and
`key (str): API URL (/library/streams/<id>)`. L480-500 adds `LyricStream` with `STREAMTYPE = 4`.
An external `.srt` next to the video does not become a Part with a role; it becomes a `Stream` on the
video's Part.

`SubtitleStream` (L435-470) carries more than the language L290 gives a sidecar:
`forced (bool)`, `hearingImpaired (bool): True if this is a hearing impaired (SDH) subtitle`,
`default (bool)`, `format`, plus the on-demand-download fields `providerTitle`, `score`, `userID`.
<https://github.com/pushingkarmaorg/python-plexapi/blob/master/plexapi/media.py>

**(d) Chapters are not a file and were never going to be.** `plexapi/video.py` L342-343 (Movie) and
L972-973 (Episode) both declare:

> `chapters (List<Chapter>)`: List of chapter objects.
> `chapterSource (str)`: Chapter source (**agent; media; mixed**).

`plexapi/media.py` L1109-1141, `class Chapter` — a *media tag* on the video:
`(id, index, tag, title, start, end, thumb, filter)`, start and end in milliseconds, `thumb` being the
chapter thumbnail URL. Chapters come from the metadata agent or from the container, they are stored
against the video, and there is no chapter file in the model.

### 2. What Jellyfin actually does

Read against `jellyfin/jellyfin` at `master` = `cf09de60e4e5` (2026-09-08), fetched 2026-09-09.

**(a) The extra-type enum has twelve values, three more than Plex's eight.**
`MediaBrowser.Model/Entities/ExtraType.cs` L5-19, complete file:

```csharp
public enum ExtraType
{
    Unknown = 0, Clip = 1, Trailer = 2, BehindTheScenes = 3, DeletedScene = 4,
    Interview = 5, Scene = 6, Sample = 7, ThemeSong = 8, ThemeVideo = 9,
    Featurette = 10, Short = 11
}
```

`ThemeSong` and `ThemeVideo` are the interesting additions: an extra in Jellyfin is not necessarily a
thing you press play on, it can be background audio or video for the item's own page.
`Emby.Naming/Common/NamingOptions.cs` L495-708 maps these to directory names (`trailers`, `backdrops`,
`theme-music`, `behind the scenes`, `deleted scenes`, `interviews`, `scenes`, `samples`, `shorts`,
`featurettes`, `extras`, `extra`, `other`, `clips`) and to filename suffixes (`-trailer`, `.trailer`,
`_trailer`, `- trailer`, …) via `ExtraRule(ExtraType, ExtraRuleType.DirectoryName|Filename|Suffix,
token, MediaType)`. L708: `AllExtrasTypesFolderNames = VideoExtraRules…`.

**(b) An extra is a row in the items table, owned by its parent — not a file with a role.**
`Jellyfin.Server.Implementations/Item/BaseItemRepository.TranslateQuery.cs` L806-814:

```csharp
else if (filter.OwnerIds.Length == 0 && filter.ExtraTypes.Length == 0 && !filter.IncludeOwnedItems)
{
    // Exclude owned non-extra items from general queries.
    // Extras (trailers, etc.) have OwnerId set but also have ExtraType set - keep those.
    // Alternate versions (PrimaryVersionId set) are normally excluded too, but resume queries
    // keep them so the actually-played version can surface instead of collapsing onto the primary.
    baseQuery = filter.IsResumable == true
        ? baseQuery.Where(e => e.OwnerId == null || e.ExtraType != null)
        : baseQuery.Where(e => e.PrimaryVersionId == null && (e.OwnerId == null || e.ExtraType != null));
}
```

So the discriminator is a pair of nullable columns on the item row: `OwnerId` (who owns me) and
`ExtraType` (what kind of extra I am). Alternate *versions* — Jellyfin's word for what `SPEC.md` calls
editions — are discriminated on the same row by a third column, `PrimaryVersionId`. One table, three
nullable columns, no role enum on the file.

**(c) Jellyfin's resume query does not exclude extras.** `Jellyfin.Api/Controllers/ItemsController.cs`
L978-996 builds the Continue Watching query with `IsResumable = true`, `IsVirtualItem = false`,
`CollapseBoxSetItems = false` and **`IncludeOwnedItems = true`** — which is precisely the flag that
switches off the block quoted above. A partially watched trailer is therefore eligible for the resume
list at the server. (This is a reading of the query builder; I did not run a server to confirm what
the web client renders. Stated as code, not as observed behaviour.)

**(d) External subtitle and audio files are first-class, and the "role" they get is a stream type with
six values.** `MediaBrowser.Providers/MediaInfo/` contains `SubtitleResolver.cs`, `AudioResolver.cs`
and `LyricResolver.cs`, all subclasses of `MediaInfoResolver` — "Resolves external files for `Video`"
(`MediaInfoResolver.cs` L22-26). Each resolved file becomes a `MediaStream` whose
`MediaBrowser.Model/Entities/MediaStreamType.cs` is one of `Audio, Video, Subtitle, EmbeddedImage,
Data, Lyric` — six values, and `MediaStream.cs` carries `IsExternal` (L590), `IsDefault` (L495),
`IsForced` (L501), `IsHearingImpaired` (L507). Language is one field of several.

**(e) There is no external chapter file, and there is no chapter provider.**
`MediaBrowser.Model/Entities/ChapterInfo.cs` is the whole model:
`(StartPositionTicks, Name, ImagePath, ImageDateModified, ImageTag)` — a start offset, a name and an
image. It is populated in `MediaBrowser.MediaEncoding/Probing/ProbeResultNormalizer.cs` L197-199
(`if (data.Chapters is not null) { info.Chapters = data.Chapters.Select(GetChapterInfo).ToArray(); }`)
— i.e. straight out of the ffprobe result for the container — and persisted by
`Jellyfin.Server.Implementations/Item/ChapterRepository.cs` into a chapters table keyed on the item.
`MediaBrowser.Providers/Chapters/` does not exist (`gh api …/contents/MediaBrowser.Providers/Chapters`
→ 404, 2026-09-09) and a repo-wide code search for `IChapterProvider` returns nothing.

### 3. Industry standard / best practice

**There is no standard, and no product in the category models an extra as a role on a file.** Three
independent designs, three spellings, one shape.

| | extra is… | edition/version is… | extra type vocabulary |
|---|---|---|---|
| Plex | a child metadata item, `TYPE='clip'`, own `viewOffset` | a separate movie directory | closed, 8 values |
| Jellyfin | an item row with `OwnerId` + `ExtraType` set | an item row with `PrimaryVersionId` set | closed enum, 12 values |
| Kodi | a `videoversion` row with `itemType = EXTRA` | a `videoversion` row with `itemType = VERSION` | **open lookup table** |

**Kodi is the strongest data point, because it is the most recent design and it put extras and
editions on the same axis deliberately.** `xbmc/video/VideoManagerTypes.h` (added 2023, read at
`master` on 2026-09-09):

```cpp
enum class VideoAssetTypeOwner { UNKNOWN = -1, SYSTEM = 0, AUTO = 1, USER = 2 };
enum class VideoAssetType : int { VERSIONSANDEXTRASFOLDER = -2, UNKNOWN = -1, ALL = 0, VERSION = 1, EXTRA = 2 };
```

and `xbmc/video/VideoDatabaseDDL.cpp` L186-197:

```
CREATE TABLE videoversiontype (id INTEGER PRIMARY KEY, name TEXT, owner INTEGER, itemType INTEGER)
CREATE TABLE videoversion (idFile INTEGER PRIMARY KEY, idMedia INTEGER, media_type TEXT, itemType INTEGER, idType INTEGER)
```

`InitializeVideoVersionTypeTable` (L22-45) seeds ids 40400-40800 from the localised string table with
`owner = VideoAssetTypeOwner::SYSTEM`; the `USER` owner value exists so an owner can add their own
type name. So Kodi's answer is: **one file-to-work relation carrying a two-value axis (version vs
extra) plus an extensible type name**, and the type vocabulary is data in a table, not an enum in code.

**Emby is not independent evidence.** Jellyfin forked from it in 2018 and `ExtraType`/`ExtraRule` is
inherited Emby code.

**On `chapters` specifically, there is no external-file convention to be compatible with.** Chapters
live in the container: Matroska has a chapters element, MP4/M4B has `chpl`/a text track, and both Plex
and Jellyfin read them from there (Plex's `chapterSource` = `media`) or from the metadata provider
(Plex's `chapterSource` = `agent`). The one widely deployed *external* chapters file in any adjacent
domain is the Podcasting 2.0 `<podcast:chapters>` element, which points at a JSON document —
<https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#chapters> (checked
2026-09-09) — and that is a podcast RSS extension, not a media-server convention. Nothing in the
self-hosted media category reads a chapter file off disk.

**The user complaint that actually exists is the opposite of the one L801-802 is defending
against.** Plex forum topic 756262, "Local Extras in 'continue watching'", opened 2021-11-08 and still
attracting replies in 2024 (fetched via `forums.plex.tv/t/756262.json`, 2026-09-09):

> I'm missing able to see what extras I've partially watched in 'continue watching'. is there an
> option for this? If not, can one be added?

> today the Extras behave like simple videos, without metadata, **without the possibility of picking
> up where we left off previously** or even a "V" logo to know that we viewed it. (2024-03-03)

> It'd be fantastic if, in general, extras tracked watched/unwatched and we could easily see when a
> library item has unwatched extras! … **Extras in general still feel like too much of a second-class
> citizen in Plex.** (2024-08-15)

> I agree that this is needed. **Absolutely no way currently of knowing which extras you've watched**,
> especially frustrating when a film has a lot. (2024-11-10)

Users are not asking for trailers to be kept out of progress tracking. They are asking for extras to
have progress *of their own*, surfaced on the item's page. The thing they object to is extras
polluting the *main* rail, not extras being tracked.

### VERDICT

**Two separate answers. Delete `chapters`; give extras their own relation rather than a file role.**

**Half one: `chapters` comes out of the role set, and nothing replaces it as a role.**

No product in the category has a chapter file. Both incumbents read chapters out of the container
during the analysis pass and store them keyed on the item, with a name, a start offset and a thumbnail.
`SPEC.md` already has the exact place for this and does not need a new concept: L317-322 —
"TECHNICAL PROPERTIES LIVE HERE, written by the analysis pass … MEASURED OFF THE BYTES rather than
claimed by anybody — re-measuring the same file gives the same answer, so there is nothing to disagree
about and nothing to give provenance to." Chapters read out of a Matroska or MP4 container satisfy
that test word for word. If chapters are wanted at all, they are rows keyed on the file — `(file_id,
index, start_ms, end_ms, title)` — written by the same pass that writes duration, not a role.

If they are not wanted in v1, delete the word and lose nothing: no user has a chapters file, because
no tool in the category produces one.

*Checked, because the answer changes which option is cheap:* **MediaInfoLib does read container
chapters**, so this is free with the analysis pass L766 already commits to.
`MediaArea/MediaInfoLib`, `Source/MediaInfo/Multiple/File_Mk.cpp` (master, read 2026-09-09) parses the
whole Matroska chapters tree — L427-446 declare `Segment_Chapters_EditionEntry_ChapterAtom` and its
children `ChapterTimeStart`, `ChapterTimeEnd`, `ChapterDisplay_ChapString`, `ChapLanguage` — and
L1462-1497 emits them: `Stream_Prepare(Stream_Menu)` per edition entry, then one
`Fill(Stream_Menu, StreamPos_Last, Time.To_UTF8().c_str(), Text)` per chapter atom, keyed on the
start time and valued with the chapter name (multi-language names joined). `MediaInfo_Config_Automatic.cpp`
L275-280 registers `Chapters`, `ChaptersCount` and `Chapters_Pos_Begin`/`_End` as reportable fields.

Two caveats worth knowing before relying on it. First, MediaInfo emits chapters as a **flat map of
start-time to name** inside a `Menu` stream, not as structured `(start, end)` pairs — it parses
`ChapterTimeEnd` but does not emit it, so an end offset has to be inferred from the next chapter's
start. Second, this is verified for **Matroska**; I did not check MP4 `chpl`, and that should be
confirmed against `File_Mpeg4.cpp` if MP4 chapters matter. Jellyfin gets structured start offsets
because ffprobe's `-show_chapters` gives them directly. Neither incumbent stores an end offset either
(`ChapterInfo` has only `StartPositionTicks`; Plex's `Chapter` has both), so the flat form is enough
to match Jellyfin.

**Half two: an extra is not a file role. It is a small relation of its own, and the five-minute rule
is patching a modelling gap rather than a real requirement.**

Adding `extra` to the role set is the cheapest edit and it is the wrong one, on the spec's own
reasoning. L290-293 states why the role set exists: "This keeps Edition meaning 'a different version of
the work' rather than 'a different file': one video plus two subtitle tracks is ONE thing to watch,
whereas a second cut is a second edition." A role is for files that are part of *the same thing to
watch*. A trailer is a different thing to watch — with its own duration, its own end, and its own
resume point. Give it a role and its progress lands on the parent edition, which is exactly the bug
L801-802's five-minute force-complete is mopping up.

The finding is also right to reject making an extra a `work` item: the browse-exclusion rule at
L1026-1036 filters **by kind**, an extra's kind would be `work`, and every extra would land in the browse
grid and in "latest".

**The spec has already taken this exact decision once, in the paragraph immediately below the role
line, and it should be applied a second time.** L294-301, added to `SPEC.md` after the X10 finding was
written: "A FILE IS A PART OR A VARIANT, and **those are two relations rather than one column**. A PART
continues the edition — part 2 of a two-part film, disc 3 of forty. A VARIANT is the same edition
encoded differently … Jellyfin keeps two arrays and Plex nests them separately; collapsing them loses
the difference between 'the film continues here' and 'the same film, in H.264'." That is the same
argument, on the same table, about the same kind of distinction. Part, variant and extra are three
different answers to "how does this file relate to the edition", and the spec has already ruled that
two of them are relations. An extra is the third, and it is the one that additionally needs its own
progress.

So: **a third attachment, alongside `files` and `editions`.** Rows of
`(id, owner_id, item_id | edition_id, file_id, extra_type_id, title, position)`, where:

- **The attachment point is item *or* edition**, matching `files` at L284 and matching Plex's
  documented rule that extras go inside the specific edition folder.
- **`extra_type` is a lookup table, not an enum**, seeded in a migration. That is Kodi's
  `videoversiontype` with its `SYSTEM`/`USER` owner column, and it is also `SPEC.md`'s own standing
  rule at L165-167: "Finer typing is a `category` statement, never an enum value: a category statement
  can be sourced and disputed, a kind column cannot." A closed enum here would need a migration the
  first time someone catalogues a "making of" that is not a featurette. Seed it with the eight values
  Plex and Jellyfin agree on — trailer, behind the scenes, deleted scene, interview, scene, featurette,
  short, other — and note that Jellyfin's `ThemeSong`/`ThemeVideo` are a different thing (page
  furniture, not something you press play on) and are out of scope.
- **Progress attaches to the extra row, not to the parent edition.** This is what the Plex forum thread
  has been asking for since 2021 and has not got.
- **Extras never appear on a browse surface or in Continue Watching**, because they are not items and
  the browse rule at L1032-1033 queries `items` for kind `work`. The exclusion is structural, which is
  the same property the entity-exclusion rule is praised for, and it needs no filter to remember.

**What this does to L801-802.** "Force-complete anything under five minutes so trailers never sit in
Continue Watching" stops being about trailers, because a trailer can no longer reach Continue Watching
by construction. Keep the rule if it is wanted for genuinely short *works* — a two-minute short film is
a real case in a Doctor Who catalogue — but change the justification, because as written it is the only
line in the document that tells an implementer trailers are editions.

**One smaller thing the finding did not raise, in the same sentence.** L290 says a sidecar "references
the file it accompanies plus a language". Language alone does not identify a subtitle track to a user.
Plex's `SubtitleStream` carries `forced` and `hearingImpaired` ("SDH") alongside `language`, and
Jellyfin's `MediaStream` carries `IsForced`, `IsHearingImpaired`, `IsDefault` and `IsExternal`. Both
incumbents converged on the same two flags because a user with one English subtitle file for forced
foreign dialogue and one full English SDH track cannot otherwise tell them apart. Two booleans, same
sentence.

---

## X11 — "It never stores media: a source is a reference" versus a `files` table keyed on a SHA1 over local bytes

**The contradiction.** L30-33: "It is a media server in its own right, not a client of Plex
or Jellyfin, and **it never stores media: a source is a reference**, and playback goes through an
app-owned opaque-id route so access control and progress work." L284-288: "`files` — bytes. Attached
to item or edition … **Identity is SHA1(size + SHA1(first 64KB) + SHA1(last 64KB))**. PATH IS
LOCATION, NOT IDENTITY, so a moved file is the same file … Cost is 128KB per file." STORAGE: "**Build
against a FILESYSTEM PATH.** Document rclone and mergerfs for cloud storage rather than implementing
any cloud integration." The question "may a `file` be a remote URL?" has no answer, and it changes the
identity algorithm, the scanner and the playback route.

### 0. The spec's own Plex claim, checked — it is exactly right, and this is the first time it has been

L285-288 asserts the identity algorithm is "Plex's exact algorithm". **Verified.** The
algorithm is not in any Plex documentation; a Plex forum moderator explicitly refused to give it
("They have a routine which generates the hash. **I can't share it because it's proprietary C++**" —
ChuckPa, forums.plex.tv topic 803621, 2022-08-08) and gave a wrong description ("first block (4K)")
that two separate users failed to reproduce. It was eventually published on 2025-02-12 by `gbooker02`
in forums.plex.tv topic 904178 post 5, "How is Plex hash calculated?" (fetched via
`forums.plex.tv/t/904178.json`, 2026-09-09):

> There are a few steps:
> - Create a string with the filesize in decimal
> - Take the SHA1 hash of the first 64kB (65536 bytes) and append this to the string in hex.
> - If the file is greater than 64kB, do the same with the last 64kB
> - SHA1 hash this string
>
> As an example, let's look at a copy of Big Buck Bunny: The file size is 928670754 bytes. The first
> 64kB has a SHA1 hash of `87a82ca143a5d84ba4ba33f421f25fbac9811f89`. The last 64kB has a SHA1 hash of
> `ce2f3dd83c1cc4ffa4deda5588a9118be004ce09`. Take the SHA1 hash of
> `92867075487a82ca143a5d84ba4ba33f421f25fbac9811f89ce2f3dd83c1cc4ffa4deda5588a9118be004ce09`. This is
> `782e3038c7290470c29320a840e5f92123912e56` **which matches the hash column in the media_parts table**
> if you add this exact file to it.

The original poster then reproduced it independently across multiple files. Two things follow that
matter here. First, L285's formula is correct to the byte, and the "128KB per file" cost at
L268 is correct. Second, **the algorithm is defined over local bytes at known offsets**: it needs
`size`, byte range `[0, 65536)` and byte range `[size-65536, size)`. That is trivially cheap on a
filesystem and is three requests plus a `HEAD` against a URL — assuming the server honours Range and
returns a stable `Content-Length`, which for a signed cloud URL it may not.

`media_parts` also carries a **second, separate** hash column, `open_subtitle_hash` — confirmed by
`berthozero` and `dane22` in forums.plex.tv topic 902591 (2025-01-17), who identify it as the
OpenSubtitles `moviehash`. So Plex stores two content hashes per part and uses neither for relinking.

### 1. What Plex actually does

**Plex is local-path-only, it has refused remote references for over a decade, and it tried
cloud-hosted media once and killed it.** All checked 2026-09-09.

- `MediaPart.file` is documented as "The path to this file on disk (ex: `/media/Movies/Cars (2006)/
  Cars (2006).mkv`)" — python-plexapi `plexapi/media.py` L105-136. There is no URL variant.
- **`.strm` is not supported and the requests are unbroken since at least 2018.** forums.plex.tv topics
  233040 "STRM support" (2018-04-18), 233521 "[REQ] ADD STRM Support" (2018-04-23), 471091 ".STRM file
  support" (2019-10-04), 688359 ".strm Support" (2021-02-08), 835684 "ADD STRM Support" (2023-03-25),
  854519 "Add Strm support" (2023-09-22), 862274 "Support STRM Files and play url direct" (2023-12-09).
  Titles and dates from `forums.plex.tv/search.json`. Moderators close each as a duplicate of a
  standing feature request rather than pointing at an implementation.
- The 2019 request is phrased as a regression — "Please bring back .strm support. **Don't understand
  why did you remove it?**" (Noustaa, topic 471091, 2019-10-04) — and topic 33168 (2013-04-21, "Plex
  STRM file support flawed") shows a user in 2013 getting a `.strm` as far as `PlexTranscoder.exe`.
  So there was *something* once. I could not find a Plex statement of what it was or when it was
  removed, and I am not asserting one.
- **The user's own comparison is the finding's question, asked by a real user.** Topic 862274,
  2023-12-09: "I don't have enough local space to store video files, so I store a lot of video files
  in my netdisk … Currently I am using **rclone to mount** the files … but in this case, when I watch
  the video, the media files are **relayed through the plex server**, and the server bandwidth is not
  enough, the playback will be lagged. After testing, **Emby and jellyfin both support strm direct
  link**, local storage strm file (text file, the content is the video file URL), but not store the
  video file … and emby and jellyfin clients are direct link URL video file playback, **it will not be
  relayed through the server**."
- **Plex Cloud — media in the owner's cloud drive, server run by Plex — was shut down on 30 November
  2018.** Quoted from the Plex announcement inside forums.plex.tv topic 440460 (2019-08-01): "We've
  made the difficult decision to shut down the Plex Cloud service on November 30th, 2018. As you may
  know, we haven't allowed any new Plex Cloud servers since February of this year, and since then
  we've been actively working on ways to address various issues while keeping costs under control …
  we haven't found a solution capable of delivering a truly first class Plex experience to Plex Cloud
  users." (The announcement topic itself was not directly reachable; this is the quoted text as it
  appears in the 2019 thread, fetched 2026-09-09.)
- **And the hash does not relink moves, exactly as L286-287 says.** forums.plex.tv topic
  766452, "How to retain Date Added and Watched State info when moving files between drives"
  (2021-12-26): "I'd like to add a new drive … and redistribute the files evenly amongst all of the
  drives. **But I dont want to lose the Date Added or Watched List info. Each time ive moved a few it
  adds it to the top of the Date Added list** and id like to avoid this." Every answer in the thread is
  a workaround — don't move files, or use drive pooling so the path does not change. Nobody says
  "Plex will match it by hash", because it will not.

### 2. What Jellyfin actually does

**Jellyfin supports remote media, and the way it does it is the whole answer to X11: the catalogue
entry is a local file, and the remote URL is its *content*.** Read against `jellyfin/jellyfin` at
`master` = `cf09de60e4e5` (2026-09-08), fetched 2026-09-09.

**(a) `.strm` is a video file extension.** `Emby.Naming/Common/NamingOptions.cs` lists `".strm"` in
`VideoFileExtensions` (L67) *and* in `AudioFileExtensions` (L285). So the scanner picks it up as an
ordinary media file with an ordinary path.

**(b) The remote-ness is a flag on the item, not a different kind of item.**
`Emby.Server.Implementations/Library/Resolvers/BaseVideoResolver.cs` L147:

```csharp
video.IsShortcut = extension.Equals(".strm", StringComparison.OrdinalIgnoreCase);
```

`MediaBrowser.Controller/Entities/BaseItem.cs` L406-408 declares `public bool IsShortcut` and
`public string ShortcutPath`.

**(c) The URL is read out of the file, and only remote schemes are accepted — with the reason stated
in the code.** `MediaBrowser.Providers/MediaInfo/ProbeProvider.cs` L318-341:

```csharp
private void FetchShortcutInfo(BaseItem item)
{
    var shortcutPath = File.ReadAllLines(item.Path)
        .Select(NormalizeStrmLine)
        .FirstOrDefault(i => !string.IsNullOrWhiteSpace(i) && !i.StartsWith('#'));
    …
    // Only allow remote URLs in .strm files to prevent local file access
    if (Uri.TryCreate(shortcutPath, UriKind.Absolute, out var uri)
        && (string.Equals(uri.Scheme, "http", …) || string.Equals(uri.Scheme, "https", …)
            || string.Equals(uri.Scheme, "rtsp", …) || string.Equals(uri.Scheme, "rtp", …)))
    { item.ShortcutPath = shortcutPath; }
    else
    { _logger.LogWarning("Ignoring invalid or non-remote .strm path in {File}: {Path}", …); }
}
```

and again at the media-source layer, `BaseItem.cs` L1239-1250:

```csharp
if (video.IsShortcut && !string.IsNullOrEmpty(video.ShortcutPath))
{
    var shortcutProtocol = MediaSourceManager.GetPathProtocol(video.ShortcutPath);
    // Only allow remote shortcut paths — local file paths in .strm files
    // could be used to read arbitrary files from the server.
    if (shortcutProtocol != MediaProtocol.File)
    {
        info.IsRemote = true;
        info.Path = video.ShortcutPath;
        info.Protocol = shortcutProtocol;
    }
}
```

Two independent places in the codebase enforce "remote schemes only", both with a comment naming the
attack. That is a file-read primitive handed to whoever can write into a scanned directory.

**(d) The protocol vocabulary is seven values.** `MediaBrowser.Model/MediaInfo/MediaProtocol.cs`:
`File = 0, Http = 1, Rtmp = 2, Rtsp = 3, Udp = 4, Rtp = 5, Ftp = 6`.
`MediaSourceManager.GetPathProtocol` (L240-277) derives it from the URL prefix and falls back to
`_fileSystem.IsPathFile(path) ? MediaProtocol.File : MediaProtocol.Http`.

**(e) The cost, and this is the part that decides X11: a remote item has no technical properties until
someone plays it.** `MediaBrowser.Providers/MediaInfo/FFProbeVideoInfo.cs` L87:

```csharp
if (!item.IsShortcut || options.EnableRemoteContentProbe)
```

`EnableRemoteContentProbe` is a plain `bool` on `MetadataRefreshOptions` (L65), default `false`, and
the library scan does not set it. So a `.strm` scanned into a Jellyfin library has **no duration, no
codecs, no resolution, no bitrate and no chapters**. Jellyfin's answer is to probe lazily, at the
moment of playback — `Emby.Server.Implementations/Library/MediaSourceManager.cs` L177-195:

```csharp
// If file is strm or main media stream is missing, force a metadata refresh with remote probing
if (allowMediaProbe && mediaSources[0].Type != MediaSourceType.Placeholder
    && (item.Path.EndsWith(".strm", StringComparison.OrdinalIgnoreCase) || …))
{
    await item.RefreshMetadata(
        new MetadataRefreshOptions(_directoryService)
        { EnableRemoteContentProbe = true, MetadataRefreshMode = MetadataRefreshMode.FullRefresh },
        cancellationToken).ConfigureAwait(false);
```

**(f) Jellyfin has no content hash at all — its identity *is* the path.**
`Emby.Server.Implementations/Library/LibraryManager.cs` L792-819:

```csharp
private Guid GetNewItemIdInternal(string key, Type type, bool forceCaseInsensitive)
{
    … key = type.FullName + key;
    return key.GetMD5();
}
```

MD5 over the .NET type name concatenated with the path, lower-cased unless
`EnableCaseSensitiveItemIds`. A moved file is a new item and its watch state is gone. This is why
Jellyfin *can* accept a remote URL cheaply: it never had a content-derived identity to lose.

### 3. Industry standard / best practice

**On remote references the incumbents disagree, and the disagreement is not close.** Jellyfin, Emby
and Kodi all read `.strm`; Plex does not and has refused for years.

- **Kodi** treats `.strm` as a playlist format (`xbmc/playlists/PlayListFactory.cpp` L93, L155, L161 —
  `".m3u|.m3u8|.b4s|.pls|.strm|.wpl|.asx|.ram|.url|.pxml|.xspf"`) and then **carves it out of the
  "skip playlists" rule in the library scanner** so it becomes a library item.
  `xbmc/video/VideoInfoScanner.cpp` L1435 and L1684, identically:
  `(PLAYLIST::IsPlayList(*pItem) && !URIUtils::HasExtension(pItem->GetPath(), ".strm"))`.
  (Read at `master`, 2026-09-09.)
- **Emby** is not independent evidence — Jellyfin forked from it in 2018 and `IsShortcut`/`ShortcutPath`
  is inherited Emby code. The user in Plex topic 862274 names both because they behave identically.
- **Nobody makes the URL the file's identity.** In every implementation the library row is a *local
  file* — a `.strm` of a few dozen bytes at a real path — and the URL is that file's *content*,
  resolved to a media source at playback. This is the single most useful fact in X11: remote playback
  and filesystem identity are not in conflict anywhere in the category, because the remote-ness lives
  one layer below the catalogue.

**On file identity there is no standard and CanonCore's design is better than all three incumbents.**
Kodi keys files on path, split across two tables — `xbmc/video/VideoDatabaseDDL.cpp` L99-107:
`CREATE TABLE path (idPath integer primary key, strPath text, …)` and
`CREATE TABLE files (idFile integer primary key, idPath integer, strFilename text, playCount integer,
lastPlayed text, dateAdded text)`. Jellyfin keys on MD5-of-path. Plex computes the content hash and
then keys on path anyway. Three products, three ways of losing your watch state when you reorganise a
drive, and one of them has the hash sitting in the database while it happens. L286-287 is
the only design of the four that would actually survive a `mv`.

**On the security question there is a clear best practice and Jellyfin states it twice.** Any
mechanism that lets a scanned file name a playback location is a server-side file-read and
request-forgery primitive. Jellyfin's mitigation is a scheme allowlist (`http`, `https`, `rtsp`, `rtp`)
applied at both the probe and the media-source layer. `SPEC.md`'s outbound-request section already specifies the harder version of this for provider URLs —
"EXCEPTION EVER: HTTPS only; deny localhost, RFC1918, link-local and cloud metadata addresses;
re-validate at every redirect hop; cap the response size; set a timeout" (L867 at commit `094206e`;
the section around it was rewritten mid-session into a two-boundary allow-list model, so re-read it
rather than trusting this line number) — which is strictly stronger than what Jellyfin does.

### VERDICT

**The answer to "may a `file` be a remote URL?" is no — and the two halves of the contradiction are
not actually about the same thing, which is why neither had to give way.**

**First, L30-33 is not a claim about remote media at all, and the word that makes it look like one is a
word this document has already defined to mean something else.** The `statements` block fixes the term
(L362-366 at commit `094206e`, restated since X8 landed): "`source` NAMES A PROVIDER, THE OWNER, A
SIDECAR, OR A DERIVED COMPUTATION — **four kinds**, all ranked in the one global source order."
L31-32's "a source is a reference" uses `source` in a *fifth* sense — a media location — which is none
of the four. Read with that definition in force, the sentence is incoherent rather than contradictory,
and X8's resolution widening `source` from three kinds to four makes the clash worse rather than
better: the word now has a settled, enumerated meaning that L31-32 does not use.

What it is *trying* to say is already said twice elsewhere, precisely: "PATH IS LOCATION, NOT IDENTITY"
(L286) and "The scanner NEVER writes storage. It never creates folders, never moves files, never writes
an `.nfo` back, and never writes its structure to disk" (L1017-1021). CanonCore does not ingest, copy,
transcode or host media; it points at bytes the owner already has. **Rewrite L31-32 to say that, in
those words, and stop it using `source`.** That is the whole of half one, and it costs a sentence.

**Second, on the substantive question, the evidence supports local-only for v1 — but the reason is not
the one an implementer would guess, and it is worth writing down so it is not relitigated.**

The cheap reason ("hashing a URL is hard") is not the real one; a `HEAD` plus two ranged `GET`s would
produce the same hash for a well-behaved server. The real reasons are three, in order of how much a
user would feel them:

1. **A remote file has no duration, and three completion rules depend on duration.** L761-764:
   "There is a SCAN-TIME ANALYSIS PASS, writing duration, container, codecs, resolution and bitrate
   onto the file row. **Duration above all: three of the completion rules below are inert without it.**"
   Jellyfin proves the failure mode rather than avoiding it: `FFProbeVideoInfo.cs` L87 skips probing
   for every `.strm` unless remote probing is explicitly enabled, so remote items sit in the library
   with no duration until first play, and Jellyfin has to force a full metadata refresh mid-playback
   (`MediaSourceManager.cs` L177-195) to recover. CanonCore would inherit the same hole in "have I
   watched this WORK" (L804-806) and in the five-minute force-complete (L801-802), for an unbounded
   subset of the catalogue.
2. **The one benefit users actually ask for is already foreclosed by an earlier decision.** The Plex
   user in topic 862274 wants `.strm` so playback is "not relayed through the server". L32-33
   has already ruled that out for everything: "playback goes through an app-owned opaque-id route so
   access control and progress work." CanonCore proxies by design. So a remote `file` would deliver
   the storage saving of rclone with none of the bandwidth saving that makes users prefer `.strm` over
   rclone in the first place — and rclone is already the documented answer under STORAGE ("Build against a FILESYSTEM PATH.
   Document rclone and mergerfs for cloud storage rather than implementing any cloud integration").
3. **It opens a file-read and SSRF primitive on the scanner, which is currently the one component with
   no network surface at all.** Jellyfin guards this in two separate places with the same comment.
   The "EXCEPTION EVER: HTTPS only; deny localhost, RFC1918, link-local and cloud metadata addresses"
   rule already has the stronger guard written, but it is scoped to provider URLs; using
   it here would mean the scanner grows an HTTP client, and "the scanner takes media files, playback
   sidecars, and `.nfo` files. Nothing else" (THE SCANNER, L899 at `094206e`) stops being true.

**So: state it, in the schema, in one line.** `files` are local bytes at a filesystem path. This is
not a gap; it is the same decision "Build against a FILESYSTEM PATH" already took for cloud storage, and it should sit next to the
identity sentence where an implementer will actually read it.

**A better option the finding did not name, and the one to take if remote media is ever wanted.** Do
not make `file.path` polymorphic. Copy Jellyfin's shape exactly, because it is the only one in the
category that does not disturb the identity model: a remote reference is **a real local file whose
content is a URL**. The `files` row keeps its real path, its real size and its real SHA1 — computed
over the few dozen bytes of the reference file, which is correct: two references to the same URL are
the same file, and moving the reference keeps its identity, both of which are what the owner means.
The URL becomes a resolved *media location* at playback, one layer below the catalogue, exactly where
Jellyfin puts it. The role vocabulary from X10 is where it would be declared, not a second path type.

Concretely, if it is ever built: one new file role or a nullable `remote_url` column populated by the
scanner from the reference file's first non-comment line; the provider-URL allow-list rules applied at
both read and playback; and the technical-properties columns explicitly nullable with the analysis pass
deferred to first play. That is Jellyfin's design with CanonCore's identity intact. **It is not needed
in v1 and should not be built in v1** — but writing the shape down now is what stops the first person
who wants it from making `path` mean two things.

**Not supported by the evidence:** nothing in the finding. Both halves of X11 as stated are real, the
Plex algorithm claim at L285-288 checks out to the byte, and the claim at L286-287 that Plex computes
it and does not relink moves is confirmed by users losing watch state on every drive reshuffle.

---

## X12 — Entities are excluded from browsing "by kind", and search is the one surface where the kinds meet

**Line numbers below are as of `SPEC.md` at commit `4202c0a` (1289 lines), 2026-09-09.** The file moved
twice more during X11. Match on quoted text.

**The contradiction.** The standing rule (L1060-1070): "Entities must not leak into work-browsing
surfaces. Jellyfin's mechanism is that people have no container parent … So **exclude BY KIND**, not by
absence of a parent: work-browsing surfaces query for `work` and ignore the entity kinds, and entity
containers are reached deliberately rather than turning up in 'latest'." It never says whether search
is a work-browsing surface. Read literally by an implementer, it produces a catalogue whose people,
characters and places exist and cannot be found.

**Two corrections to the finding before anything else, both from re-reading the current spec.**

1. **It is seven kinds now, not eight.** L157-159: "SEVEN kinds, standards-derived: work, person (REAL
   HUMANS ONLY), organisation, place, time_span, character (includes species), concept." L166 adds
   "THERE IS NO `nomen` KIND." The finding's "all eight kinds" is stale; the shape of the problem is
   unchanged.
2. **The more serious problem is that there is no search surface in the spec at all.** A full-document
   grep for "search" at `4202c0a` returns nine hits and **not one of them is a catalogue search screen**:
   L3 and L10 are prose about this document; L79 and L436-462 and L759 are the *provider* contract's
   `search` operation ("search + lookup REQUIRED"); L701 is narrowing an enrichment run to one provider;
   L134 is the group scope ("Scopes browsing, **search**, WHICH PROVIDERS ARE ASKED, scanner roots").
   L134 is the only line that implies an in-app search exists, and it implies it in passing while
   describing something else. So the finding's premise — "search is the one surface where all the kinds
   belong" — is a claim about a surface the document has not specified. **The ambiguity is not that the
   browse rule fails to carve search out; it is that there is nothing for it to carve out.** An
   implementer reading this document has no instruction to build search at all, and the one rule that
   mentions kinds tells them to exclude entities.

### 1. What Plex actually does

**Plex's search covers people and every other non-work kind, it is the flagship feature of the search
they shipped, and it is a separate endpoint from browsing.** Checked 2026-09-09.

The endpoint is `GET /hubs/search`, and the result is a set of **hubs, one per type** — python-plexapi
`plexapi/server.py` L761-797:

```python
def search(self, query, mediatype=None, limit=None, sectionId=None):
    """ Returns a list of media items or filter categories from the resulting
        Hub Search against all items in your Plex library. This searches genres,
        actors, directors, playlists, as well as all the obvious media titles. …
        mediatype (str, optional): Limit your search to the specified media type.
            actor, album, artist, autotag, collection, director, episode, game, genre,
            movie, photo, photoalbum, place, playlist, shared, show, tag, track
    """
    …
    key = f'/hubs/search?{urlencode(params)}'
    for hub in self.fetchItems(key, Hub):
```

Eighteen searchable media types. Six of them are things CanonCore would call entities — `actor`,
`director`, `artist`, `genre`, `tag`, `place` — and `place` is there for the same reason CanonCore has
a `place` kind. Note also `sectionId`, which scopes a search to one library: the same
scope-or-global distinction CanonCore's groups make at L134.

The Plex blog post that shipped this states the design intent (`plexapi` links it directly;
<https://www.plex.tv/blog/seek-plex-shall-find-leveling-web-app/>, fetched 2026-09-09, HTTP 200):

> **Complete**: We search genres, actors, directors, playlists, as well as all the obvious media
> titles. It's never been easier to jump to all of Ahh-nold's movies, or see all your Jazz.

> **Intelligent**: … if you search for "Pernice", we'll return "Pernice Brothers" as the artist result,
> but we'll also go ahead and return your most-listened to albums and tracks from the artist. **If you
> type "Arnold" you'll get a result for the actor, but also the most recently added movies he's in.**

Two things follow that bear directly on the verdict. First, the entity result and the works reachable
*through* it are returned together — an entity hit is a navigation affordance, not a dead end. Second,
Plex is describing a search that returns entities as the headline feature of the release, not as an
edge case someone remembered.

### 2. What Jellyfin actually does

**Jellyfin includes entity kinds in search by default, excludes structural kinds unconditionally, and
does it with one boolean per entity kind so a caller can opt out.** Read at `master` = `cf09de60e4e5`
(2026-09-08), fetched 2026-09-09.

`MediaBrowser.Model/Search/SearchQuery.cs` L10-20 — the defaults are the whole answer:

```csharp
public SearchQuery()
{
    IncludeArtists = true;
    IncludeGenres = true;
    IncludeMedia = true;
    IncludePeople = true;
    IncludeStudios = true;
    …
}
```

`Emby.Server.Implementations/Library/Search/SearchManager.cs` L379-409 turns those into a type filter,
and the asymmetry between the two lists is the design:

```csharp
private static List<BaseItemKind> BuildExcludeItemTypes(SearchQuery query)
{
    …
    excludeItemTypes.Add(BaseItemKind.Year);
    excludeItemTypes.Add(BaseItemKind.Folder);
    excludeItemTypes.Add(BaseItemKind.CollectionFolder);

    if (!query.IncludeGenres) { AddIfMissing(excludeItemTypes, BaseItemKind.Genre); … }
    if (!query.IncludePeople) { AddIfMissing(excludeItemTypes, BaseItemKind.Person); }
    if (!query.IncludeStudios) { AddIfMissing(excludeItemTypes, BaseItemKind.Studio); }
    if (!query.IncludeArtists) { AddIfMissing(excludeItemTypes, BaseItemKind.MusicArtist); }
```

`Year`, `Folder` and `CollectionFolder` — the structural furniture — are excluded with no way to ask for
them. `Person`, `Genre`, `Studio` and `MusicArtist` are included unless the caller says otherwise.
**Two different categories of "not a work", handled two different ways.**

**Global search includes entities; a search scoped to a library folder does not.** L194 of the same
file:

```csharp
IncludeItemsByName = !query.ParentId.HasValue,
```

`IItemByName` is the interface `Person`, `Genre`, `Studio` and `MusicArtist` implement. A search with a
`ParentId` is a search *inside* something, and entities have no place inside a folder — which is the
same fact that keeps them out of browse.

**The browse-side mechanism the spec cites is confirmed.** `MediaBrowser.Controller/Entities/Person.cs`:
`public class Person : BaseItem, IItemByName, IHasLookupInfo<PersonLookupInfo>` with
`public override bool SupportsAncestors => false;`. `SPEC.md` L1060-1061's "Jellyfin's mechanism is that
people have no container parent" is accurate.

*(Incidentally this file also confirms `SPEC.md` L1071-1074 on entity identity, which no finding asked
me to check: `GetUserDataKeys()` inserts `GetType().Name + "-" + (Name ?? string.Empty).RemoveDiacritics()`
and `CreatePresentationUniqueKey()` returns that key, while `Person.GetPath(name)` builds the person's
storage path out of their name. A person's stable identity in Jellyfin is their name, exactly as the
spec says.)*

**The client answer is a fixed section order, and People ranks fourth.**
`jellyfin/jellyfin-web`, `src/apps/legacy/features/search/constants/sectionSortOrder.ts` (master, read
2026-09-09), complete file:

```ts
export const SEARCH_SECTIONS_SORT_ORDER = [
    'Movies', 'Shows', 'Episodes', 'People', 'Studios', 'Playlists', 'Artists',
    'Albums', 'Songs', 'HeaderVideos', 'Programs', 'Channels',
    'HeaderPhotoAlbums', 'Photos', 'HeaderAudioBooks', 'Books', 'Collections'
];
```

Seventeen sections, works first, entities immediately after, everything grouped and labelled by kind.
`api/usePeopleSearch.ts`, `api/useStudiosSearch.ts` and `api/useArtistsSearch.ts` are separate hooks
firing separate requests, merged into that order client-side.

### 3. Industry standard / best practice

**There is no specification, and this time the incumbents do not disagree at all.** Every catalogue
product in and adjacent to this category does the same three things: browse is typed, search is not,
and search results are grouped and labelled by type.

**Kodi is the third independent implementation and the most explicit.**
`xbmc/video/windows/GUIWindowVideoNav.cpp` L642-698 (master, read 2026-09-09) is one array of eighteen
lambdas, run in order, merged into one result list:

```cpp
const auto entries = std::array{
    Entry{20338, […]{ m_database.GetMoviesByName(strSearch, tempItems); }},
    Entry{20359, […]{ m_database.GetEpisodesByName(strSearch, tempItems); }},
    Entry{20364, […]{ m_database.GetTvShowsByName(strSearch, tempItems); }},
    Entry{20391, […]{ m_database.GetMusicVideosByName(strSearch, tempItems); }},
    Entry{558,   […]{ m_database.GetMusicVideosByAlbum(strSearch, tempItems); }},
    Entry{20342, […]{ m_database.GetMovieGenresByName(strSearch, tempItems); }, 515},
    …
    Entry{20342, […]{ m_database.GetMovieActorsByName(strSearch, tempItems); }, 20337},
    Entry{20343, […]{ m_database.GetTvShowsActorsByName(strSearch, tempItems); }, 20337},
    Entry{20389, […]{ m_database.GetMusicVideoArtistsByName(strSearch, tempItems); }, 20337},
    Entry{20342, […]{ m_database.GetMovieDirectorsByName(strSearch, tempItems); }, 20339},
    …
    Entry{20365, […]{ m_database.GetEpisodesByPlot(strSearch, tempItems); }},
    Entry{20323, […]{ m_database.GetMoviesByPlot(strSearch, tempItems); }},
    Entry{40211, […]{ m_database.GetMovieExtrasByName(strSearch, tempItems); }},
};
```

Works, entity kinds (genres, actors, artists, directors), free-text plot, and — relevant to X10 —
**extras**, all in one search. The third field of each `Entry` is a `prefix` string id, and L689-693
formats it into the displayed label:
`msg = fmt::format("[{} - {}] ", …)`. So Kodi's answer to "how does a user tell a person result from a
film result" is: put the kind in the row.

`xbmc/video/VideoDatabase.h` L626-658 is the full method list, and it is worth reading as the
vocabulary of what a catalogue search is expected to cover: `GetMoviesByActor`, `GetTvShowsByActor`,
`GetMusicVideosByArtist`, `GetMovieGenresByName`, `GetMovieCountriesByName`, `GetMovieActorsByName`,
`GetTvShowsActorsByName`, `GetMovieDirectorsByName`, `GetMoviesByName`, `GetEpisodesByName`,
`GetMovieExtrasByName`, `GetEpisodesByPlot`, `GetMoviesByPlot`.

**Summary of the three:**

| | entities in browse | entities in search | how results are distinguished |
|---|---|---|---|
| Plex | no (typed libraries) | yes — 6 of 18 searchable types | one hub per type |
| Jellyfin | no (`SupportsAncestors => false`) | yes, on by default, opt-out per kind | 17 named sections, fixed order |
| Kodi | no (separate nav nodes) | yes — actors, directors, artists, genres, countries | `[Kind - name]` prefix on the row |

**The one pattern that has no exception: what gets excluded from search is structural furniture, not
entities.** Jellyfin's unconditional exclusions are `Year`, `Folder`, `CollectionFolder`. Nobody
excludes a person. The distinction that matters is not work-vs-entity; it is
addressable-thing-a-user-might-name versus container-machinery.

### VERDICT

**The finding's fix is right and it is one sentence, but the sentence it needs is not the one the
finding proposes, because the surface it would exempt does not exist yet.**

**First, the spec has to say there is a search.** Right now an implementer can read the whole document
and never build one, and the one rule that mentions kinds tells them to filter entities out. That is
not a gap in the standing rule; it is a missing surface. It belongs in the schema or the clients
section, not as a carve-out buried in a standing rule, and it should say what search covers: **every
kind, works and entities alike, across the whole catalogue, scoped by group** — which L134 already
implies ("Scopes browsing, **search**, …") and never delivers.

**Second, the standing rule then needs its exemption, and the wording should name the reason rather
than the surface.** "Work-browsing surfaces" is the phrase doing the damage, because it is defined
nowhere and an implementer will apply it to anything that lists items. The rule should distinguish the
two cases explicitly: **a surface that answers "what is in my catalogue" filters to `work`; a surface
that answers "where is the thing I named" does not.** Browse, "latest", a container's children and any
grid are the first. Search is the second, and so is following a link from one item to another.

That framing also settles the case the finding did not raise and that Jellyfin has already hit: an
entity's *own page* — "everything Tom Baker is in" — is neither. It lists works while being reached
through an entity, which is exactly `Person.GetTaggedItems(query)` in Jellyfin
(`query.PersonIds = new[] { Id }; return LibraryManager.GetItemList(query);`). A rule phrased around
surfaces cannot classify it; a rule phrased around the question being asked can.

**Third — the part where the evidence goes beyond the finding — search results must carry their kind,
and all three incumbents solved that the same way.** Plex returns one hub per type; Jellyfin renders 17
named sections in a fixed order with works first; Kodi prefixes each row with `[Kind - name]`. A flat,
unlabelled list mixing "The Doctor" the character, "Tom Baker" the person and "Doctor Who" the work is
the one design none of them chose. **Group by kind, works first, entities after** — that is the whole
UI decision, it is free, and it is what makes a single mixed result list usable rather than confusing.
This matters more for CanonCore than for any of them: seven kinds all live in one `items` table with
one id space and one URL shape, so without a kind label a search result gives the user nothing to
discriminate on.

**Fourth, adopt Jellyfin's asymmetry rather than a single flag.** Jellyfin excludes `Year`, `Folder`
and `CollectionFolder` from search unconditionally, and includes `Person`, `Genre`, `Studio` and
`MusicArtist` by default with a per-kind opt-out. CanonCore's equivalent of the unconditional
exclusions is not a kind at all — it is `is_container` on a `work` row, and specifically the
rule-derived and structural containers. Worth stating that a container is searchable (a user names
"Series 12" as readily as they name an episode) while making the per-kind narrowing available as a
filter, because "search only people" is a real query in a catalogue with 500k statements and it costs
one boolean per kind.

**Fifth, the scope question has a precedent and CanonCore should take it.** Jellyfin's
`IncludeItemsByName = !query.ParentId.HasValue` says: a global search returns entities, a search inside
a container does not. Plex has the same distinction as `sectionId`. CanonCore's groups already scope
search (L134), so the rule is: a group-scoped search still returns entities of that group; a search
*within a container* returns only its members. That is one line and it prevents the obvious wrong
implementation, where searching inside "Series 12" returns Tom Baker.

**One thing not supported by the evidence:** the finding calls this an ambiguity "in the standing rule,
which is the part of the document most likely to be applied mechanically". That is right about the
risk and wrong about the cause. The rule is not ambiguous — read mechanically it is perfectly clear,
and it excludes entities from every list in the product. The defect is that the document specifies
exactly one way to reach an item by kind and it is the excluding one. Adding a sentence to the standing
rule without adding the search surface leaves the catalogue in the same state.

---

## X13 — "The confidence score MUST be capable of failing" with nothing that could ever observe it

**Line numbers below are as of `SPEC.md` at commit `3eed2fc` (1352 lines), 2026-09-09.** Match on
quoted text.

**The contradiction.** L767-769: "THE CONFIDENCE SCORE MUST BE CAPABLE OF FAILING. A scorer that
awards points for conditions that are always true reaches its threshold before comparing anything, and
'100% enriched' then means nothing." The requirement is stated and no mechanism is given. A scorer
capable of failing that is never measured is indistinguishable from one that is not.

**Two things have changed under this finding since it was written, and both help.**

1. **There is now somewhere to put the number.** L373-380: "THE ROW IS SHAPED LIKE A MARC 21 FIELD
   883 … it carries the creation process, **a confidence value 0..1**, a creation date and a validity
   end date together … so they are solved by one field definition rather than three arguments — the
   derived source below, **somewhere for the confidence score to be recorded**, and a per-claim
   expiry." Recording is a precondition for measuring, and it is now specified.
2. **That also exposes an ambiguity the finding did not name.** L748-750 separates the two operations:
   "Matching (which external record this is) and applying (which values to take) are SEPARATE
   OPERATIONS WITH SEPARATE ENDPOINTS." There are therefore **two** confidence scores — a *match*
   confidence, which is what the two thresholds at L759-763 gate, and a *per-claim* confidence, which
   is what the MARC 883 field at L375 stores. L767's "THE CONFIDENCE SCORE" does not say which, and
   they are measured completely differently: a match score is measured against known-correct pairings,
   a claim score is measured against known-correct values. **Say which one L767 governs.** The evidence
   below is about the match score, because that is what the two thresholds act on and what Plex
   measures.

### 1. What Plex actually does

**Plex runs a labelled regression set daily and alerts on accuracy regression — the finding's quote is
verbatim and correct.** Verified 2026-09-09 at
<https://www.plex.tv/blog/pro-week-day-2-adriana/> (HTTP 200; an interview with a Plex software
engineer on the metadata team, published during Plex "Pro Week '22"):

> File matching is an interesting challenge and one that we constantly try to improve. While we stick
> to our guidebook on how files should be named, we do try to make an effort to support as many
> variations as we can. **Changes done in that area of the codebase can be very subtle yet make a
> strong impact so we have a test set of about 60k filenames for movies and episodes that we run
> matching against every day and get alerted quickly if our accuracy level were to decrease.**

Three properties of that sentence are the design, and all three are cheap to copy: it is a **fixed
labelled corpus**, it runs on a **schedule rather than on demand**, and the alarm is on **a decrease
from the previous level**, not on an absolute floor.

The same interview gives two further things the finding did not use.

**Plex's scorers have negative terms, which is what makes them capable of failing:**

> The simplest example I can give are summaries: we prefer some sources over others, but **the length
> of the summary also adds a score and we penalize summaries that end mid-sentence.**

A scorer built only from positive signals that are usually present is exactly the failure L767-769
describes. A scorer with a penalty term can rank a candidate below where it started.

**And Plex says plainly that cross-source matching is the hard part, not filename parsing:**

> Because we use aggregated data among multiple sources … we need to be able to match IDs across those
> sources … It gets tricky when these sources contradict themselves, when for instance a TVDB show and
> a TMDB show link to each other, but their IMDb IDs differ. **It's a brainteaser to figure out whom
> you believe in every edge case and sometimes we use our own matching logic to solve that problem.**

That is `SPEC.md`'s own design at L751-753 ("agreeing identifiers between providers are evidence they
describe the same work"), and Plex is saying the identifiers *disagree* often enough to need its own
resolution logic. Any accuracy measure CanonCore builds should include a case where two providers'
cross-references contradict, because that is the case the incumbent calls hardest.

### 2. What Jellyfin actually does

**Jellyfin has a match scorer, it has a small hand-curated gold set for it, and the scorer is
structurally incapable of failing.** This is a live, current instance of exactly the defect L767-769
names. Read at `master` = `cf09de60e4e5` (2026-09-08), fetched 2026-09-09.

**(a) There is no confidence field on the wire.** `MediaBrowser.Model/Providers/RemoteSearchResult.cs`
carries `Name`, `ProviderIds`, `ProductionYear`, `IndexNumber`, `IndexNumberEnd`, `ParentIndexNumber`,
`PremiereDate`, `ImageUrl`, `SearchProviderName`, `Overview`, `AlbumArtist`, `Artists` — **and no score
and no match flag**. So when Jellyfin presents candidates to a user for manual identification, it
cannot say how good any of them is.

**(b) There is a scorer inside the TMDb provider.** `MediaBrowser.Providers/Plugins/Tmdb/TmdbUtils.cs`
L37-40 and L184-253:

```csharp
private const int TitleExactScore = 8;
private const int TitlePrefixScore = 4;
private const int YearExactScore = 2;
private const int YearAdjacentScore = 1;
```

```csharp
var best = results[0];
var bestScore = 0;

foreach (var result in results)
{
    var score = Math.Max(
            ScoreTitle(normalizedName, titleSelector(result)),
            ScoreTitle(normalizedName, originalTitleSelector(result)))
        + ScoreYear(year, releaseDateSelector(result)?.Year);

    // Strictly greater, so ties keep the earlier, more relevant result.
    if (score > bestScore) { bestScore = score; best = result; }
}

return best;
```

with the reason in the doc comment (L176-183):

> TMDb's year parameter only nudges relevance, it does not filter, so the first hit is regularly a
> different film or show that happens to share the title - searching for "Mulan" with year 2020
> returns the 1998 film first. A title that matches outranks one that does not, and the year only
> separates candidates that are otherwise equally good. **When nothing matches at all TMDb's own
> ordering is kept**, so a name that needs fuzzy matching, such as "A Christmas No. 1" for "A Christmas
> Number One", still resolves.

**(c) That last sentence is the failure.** `best` is initialised to `results[0]` and `bestScore` to
`0`. `ScoreTitle` returns `0` unless the normalised title is exactly equal or a whole-word prefix;
`ScoreYear` returns `0` unless the years are within one. So a candidate that matches *nothing* still
wins, and `FindBestMatch` **has no return path that means "no good match"** except when TMDb returned
no candidates at all. There is no threshold, no `match` boolean, and no clerical-review band. Jellyfin
has a score, and the score cannot reject.

The tests confirm the intent rather than catching it —
`tests/Jellyfin.Providers.Tests/Tmdb/TmdbUtilsTests.cs` L134-141:

```csharp
[Fact]
public static void FindBestMatch_NoResults_ReturnsNull()
{
    Assert.Null(TmdbUtils.FindBestMatch(Array.Empty<SearchMovie>(), "Mulan", 2020));
    …
}
```

"No results" is the only null. "No *good* result" is not a state that exists.

**(d) The gold set is the right shape and two orders of magnitude smaller than Plex's.**
`FindBestMatch_Movies_TestData()` (L143 onward) is a `TheoryData` of real TMDb responses, each entry
carrying a `description` string that is asserted on failure —
`Assert.True(expectedId == match.Id, $"{description}: expected {expectedId} but matched {match.Id}")`
— and each chosen for the trap it encodes, with the trap written in a comment:

```csharp
// TMDb's year parameter does not filter, so the remake and the original both come back and
// the wrong one is first. Results are in the order the live API returned them.
{ "Mulan (2020)", "Mulan", 2020,
  [Movie(10674, "Mulan", "Mulan", 1998), Movie(337401, "Mulan", "Mulan", 2020),
   Movie(752662, "Hua Mulan", "花木兰", 2020)], 337401 },
…
// A featurette outranks the film it belongs to. The interpunct must not stop "WALL-E" from
// matching "WALL·E", or the prefix match on the featurette wins.
{ "WALL-E (2008)", "WALL-E", 2008,
  [Movie(877268, "WALL·E's Treasures & Trinkets", …, 2008), Movie(10681, "WALL·E", …, 2008),
   Movie(10673, "Wall Street", …, 1987)], 10681 },
```

**This is `SPEC.md` L1193-1194 already implemented by someone else**: "Choose fixture rows for the
invariant they prove, and name each one after it, so a failing test says which claim broke."

For scale: the whole of `tests/Jellyfin.Naming.Tests` — every filename-parsing case Jellyfin has, across
28 files covering TV, Video, Music, AudioBook, Book and ExternalFiles — is **567 `[InlineData]` cases**
across 160 `[Fact]`/`[Theory]` methods (counted 2026-09-09 by fetching every file in the directory).
Plex runs about 60,000 filenames daily. Jellyfin's is a unit-test suite; Plex's is a monitored
regression corpus. They are not the same kind of thing.

### 3. Industry standard / best practice

**Here there genuinely is a standard, in two parts, and it is older and better specified than anything
in the media-server category.**

**Part one — the output of a matcher is a score *and* a decision, and the decision is the part that can
say no.** The W3C Reconciliation Service API 0.2 (Community Group Final Report, 10 April 2023 —
<https://www.w3.org/community/reports/reconciliation/CG-FINAL-specs-0.2-20230410/>, fetched 2026-09-09;
this is the API OpenRefine speaks, which `SPEC.md` L748-752 already cites for the match/apply split)
defines a candidate as carrying:

> **score** — A numeral indicating how well this candidate entity matches the query: a higher score
> indicates a better match;
> **features** — An optional array of matching features;
> **match** — A boolean matching decision, which indicates whether the service considers this candidate
> **good enough to be chosen as a correct match**.

and, on features:

> A matching feature is a numerical or boolean value which can be used to determine how likely it is
> for the candidate to be the correct entity. It contains the following fields: **id** — A string which
> identifies the feature, such as `"name_tfidf"` or `"pagerank"` … **value** — The value of the feature
> for the candidate … Multiple matching features are often used in combination to provide the final
> matching score (available in the `score` field). By exposing individual features in their responses,
> services make it possible for clients to compute matching scores which fit their use cases better …
> **This also makes the global candidate scores less opaque.**

Two things to take. First, `score` and `match` are separate fields, so "how good" and "good enough" are
not the same answer — Jellyfin has the first without the second. Second, and this is the direct answer
to X13's "nothing that could ever observe it": **the standard's own remedy for an unobservable score is
to publish its components.** A score that arrives as one number cannot be debugged; a score that
arrives as a named list of contributing features can be, by a human and by a test.

**Part two — a matcher is measured against labelled ground truth, with precision and recall, and the
threshold is chosen from that measurement.** Splink is the UK Ministry of Justice's open-source
probabilistic record-linkage library and its evaluation guides are explicit
(<https://moj-analytical-services.github.io/splink/topic_guides/evaluation/edge_metrics.html> and
`…/edge_overview.html`, both fetched 2026-09-09):

> **All of these metrics are dependent on having a "ground truth" to compare against.** This is
> generally provided by Clerical Labelling (i.e. labels created by a human).

> Any Edge (Link) within a Splink model will fall into one of four categories: True Positive … True
> Negative … False Positive (Also known as: False Link, Type I Error) … False Negative (Also known as:
> False Non-link, Missed Link, Type II Error).

> Threshold selection is a key decision point within a linkage pipeline. One of the major benefits of
> probabilistic linkage versus a deterministic (i.e. rules-based) approach is the ability to choose the
> amount of evidence required for two records to be considered a match (i.e. a threshold) … **The
> Threshold Selection Tool requires labelled data to act as a "ground truth"** to compare your linkage
> results against.

And a warning that lands squarely on the naive version of X13's own proposed fix:

> **Accuracy** … This measures the proportion of correct classifications (of any kind). This may be
> useful for balanced data but **high accuracy can be achieved by simply assuming the majority class
> for highly imbalanced data** (e.g. assuming non-matches).

So "assert an accuracy floor in CI" is itself gameable in exactly the way L767-769 objects to. An
accuracy number over a fixture of near-misses tells you nothing; **precision and recall over a fixture
that contains known non-matches tells you something**, because a scorer that says yes to everything
loses precision and a scorer that says no to everything loses recall.

**Where there is no standard, plainly:** nobody in the self-hosted media category measures matching
accuracy at all except Plex, and Plex does not publish its corpus or its numbers. Jellyfin, Kodi and
Emby ship unit tests over filenames and nothing over match outcomes. There is no benchmark, no shared
labelled set, and no published accuracy figure for any of them. CanonCore cannot compare itself to the
category; it can only measure itself against itself over time, which is what Plex does.

### VERDICT

**The finding's fix is the right shape and needs three changes: measure precision and recall rather
than accuracy, include known non-matches in the fixture, and make the score's components visible.**

**1. The fixture already exists and the labelled subset is a handful of rows.** L1185-1194 mandates "a
SMALL, DETERMINISTIC EXTRACT … the specific rows that exercise the hard cases, not a sample" and
"Choose fixture rows for the invariant they prove, and name each one after it, so a failing test says
which claim broke." Jellyfin's `FindBestMatch_Movies_TestData` is that rule, implemented, for a
matcher — a dozen entries, each a real provider response, each with a one-line description asserted on
failure. Copy the shape.

**2. The fixture must contain rows whose correct answer is "no match", or the test cannot detect the
defect it exists to detect.** This is the single most important change to the finding, and it is what
`FindBestMatch_NoResults_ReturnsNull` gets wrong: testing that an *empty* candidate list yields null
proves nothing about a scorer. The rows that matter are the ones where candidates come back and none of
them is right — a wiki story with no TMDB record at all, a title that collides with a different work,
a provider result whose year is a decade off. Without those rows a scorer that says yes to everything
passes every test, which is L767-769's exact complaint restated as a test-design rule.

**3. Assert precision and recall separately, not an accuracy floor.** Splink's warning is decisive: a
single accuracy number over an imbalanced set is satisfied by guessing the majority class. Two numbers
cannot both be gamed by a constant answer: a scorer that always matches has recall 1 and precision at
the base rate; a scorer that never matches has precision undefined and recall 0. Asserting a floor on
both is what makes "capable of failing" observable, and it is the same amount of CI as one number.

**4. Make the score's parts visible, because a single opaque number is the condition that let the
defect exist.** The Reconciliation API's `features` array is the standard's own answer, and CanonCore
has a stronger version available for free: L373-380 already puts the score on a MARC 883-shaped row
next to `derived:<algorithm>-v<n>`. **Record the named signals that produced the score, not only the
total** — "title exact", "year within one", "shared IMDb id", "runtime within 2 minutes" — and the
review queue at L759-763 stops being a list of numbers the owner has to trust and becomes a list of
reasons the owner can check. This also makes the CI assertion diagnosable: a failing accuracy figure
says the scorer got worse, a failing feature distribution says which signal stopped firing.

**5. State that a decision is not a score.** The Reconciliation API separates `score` from `match` for
the reason X13 exists. CanonCore's two thresholds (L759-763) already imply three decisions — apply,
review, discard — so the scorer's *output* is a band, not a number, and the requirement at L767 should
be phrased as: **there must exist a real input for which the scorer returns "discard", and it must be
in the committed fixture.** That is one testable sentence, it is not a metric anyone can argue about,
and it is strictly weaker and cheaper than an accuracy floor while catching the exact failure named.

**6. Do not put a scheduled 60k-row job in v1, and say why in the document so it is not mistaken for an
omission.** Plex's corpus is a daily job with alerting and it is proportionate to Plex's scale. The
CanonCore equivalent at v1 scale is: the labelled subset of the committed fixture, asserted in CI on
every change, the way the two stop-condition tests at L73-82 are. L1192 already draws exactly this line
— "Anything needing the full archive is a local-only check, never a CI gate" — so a large-corpus
accuracy run over the 11,285-story archive is a local check that can exist later, and the CI gate is
the small labelled fixture. The Plex quote is the argument for *having* a regression corpus, not for
having a 60,000-row one.

**One thing the finding gets slightly wrong.** It says "the cheapest fix is a labelled subset of it
with an accuracy floor asserted in CI — which is the same shape as the two committed tests already
required." The shape is right, the metric is not (see 3), and there is a scoping problem it does not
mention: **the stop condition does not currently require enrichment to have run at all.** L86-91 is
explicit that the four conditions "do not touch FILES, FILE IDENTITY, THE SCANNER, EDITION COVERAGE,
PROGRESS, WATCH EVENTS OR PLAYBACK", and matching is not in that list — but conditions 3 and 4 (L73-82)
assert placements and contract shape, not match quality. Adding an accuracy test to CI is therefore
either a **fifth stop condition**, which L95-99 says must be "an explicit written decision naming what
it proves that the four do not — never by an implementer concluding mid-build that something else
obviously belongs", or it is a test that runs in CI without gating the cap. Pick one deliberately.
The honest reading is the second: the confidence scorer is part of enrichment, enrichment is required
by stop condition 1 (two working providers), and a test that the scorer can say no is a property of
that provider work rather than a new condition.

---
