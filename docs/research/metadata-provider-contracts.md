# The contract between a catalogue and a metadata source, 2026-09-21

How fifteen other systems solved the problem CMPP has: nine catalogue-side contracts, two wide
sources and four standards families, all reading a source far wider than their own model. Primary
sources only — official documentation, published interface definitions, schemas and source code.
Where a claim rested on a blog post or a secondary write-up it is not here.

**Not a proposal.** Nothing below recommends anything for this repository. Where a source is silent
the note says so rather than inferring an answer, because "nobody documents this" is itself a finding
about how these contracts get built.

## The question, stated once

CMPP carries eight fields per record — `id`, `title`, `kind`, `released[]`, `writers[]`, `series`,
`url`, `images[]` — plus `series_id` and `external_ids` as optional extensions
(`packages/contract/src/cmpp.ts`). The sources behind it hold far more. Six questions drove the
reading:

1. **Fixed DTO or open property bag** — does anyone carry arbitrary source-defined properties?
2. **Typed relations** — how is "A relates to B with relation type R" carried, R being arbitrary?
3. **Required versus optional** — a documented rule, or accretion?
4. **Versioning** — how does a contract grow without breaking existing providers?
5. **Prose and translations** — multiple languages, multiple sources disagreeing.
6. **External ids** — single field, map, or list?

## The short answer

**The dominant pattern is a closed, flat DTO with exactly one open extension point, and that
extension point is always the external-id namespace.** Eight of the nine contracts surveyed do this;
the ninth, legacy Plex, has no open point at all and throws on an undeclared attribute. **Not one lets
a provider attach a source-defined property to a record.** Where pressure builds it vents through the
id namespace — and in two measured cases providers are already abusing it to smuggle non-identifier
data through.

**The real dissent is not a property bag. It is the shape of the unit.** Three systems refuse the fat
DTO outright and each refuses it differently: Navidrome splits the contract into eleven small
capability interfaces so a provider declares what it has by implementing it; MusicBrainz keeps a
closed vocabulary but makes the *response* a client-chosen projection; and OpenLibrary makes the
schema itself a record, so the type is data you can edit and read back.

**Typed relations are the biggest gap in the field, not just in ours.** Of the nine contracts, exactly
one (Kavita) can carry a typed edge between two records, and its vocabulary is a fifteen-member
numeric enum that already shows strain. Everywhere else, item-to-item structure is hard-coded
hierarchy and item-to-person is a role string. The standards solved this a decade ago and no
catalogue has adopted the solution.

---

## Comparison: the catalogues

| | Return shape | Property bag | Typed relation A→B | Required vs optional | Versioning | Prose / translations | External ids |
|---|---|---|---|---|---|---|---|
| **Jellyfin** | `MetadataResult<T>` where `T : BaseItem`, the server's own entity class (68 properties) | **No.** Only `Dictionary<string,string> ProviderIds` | **No.** Person only, typed by a closed 26-value enum + free `Role` string | Nothing required, nothing declared. One bool, `HasMetadata` | Plugin `targetAbi`: a floor on server version, filtered by the installer | `Overview`/`Tagline`, one value, **no language on the field**. Hand-written fallback for those two fields only | Open string→string map, keys partly format-validated and silently dropped when invalid |
| **Kodi** | `CVideoInfoTag` — the same object for XML scrapers, NFO files and Python scrapers | **No.** Only `m_uniqueIDs`, `m_ratings`, and artwork type names | **No.** `<actor><role>` is the only typed edge; `<showlink>` matches by **title**, not id | NFO required/optional documented in a table; nothing enforces it. `<details>` has **no** documented requirement | `xbmc.metadata` has been `2.1.0 / abi 1.0` since 2012, unchanged across the whole XML→Python transition | `<plot>`/`<outline>`, one value, **no `lang` attribute anywhere** | `<uniqueid type= default=>`, a map plus one nominated default. Key namespace open |
| **Plex (legacy)** | Framework model objects (`Movie`, `TV_Show`, `Season`, `Episode`) declared in `.pym` templates | **No, and it throws.** `objects.py` raises `FrameworkException` on an undeclared attribute | **No.** `Person(role, name, photo)`; `similar` is a set of plain strings | Not documented | Agents carved out of the 2018 plugin retirement; slated for removal "in 2026", hidden behind a setting today | `summary`, `tagline`, `trivia`, `quotes`; language is a **GUID argument** (`?lang=en`), so a different language is a different record and a different bundle | One `guid`, `{provider}://{id}?lang={lang}`. **No list**, so cross-provider identity is inexpressible |
| **Plex (modern)** | JSON `Metadata` object over HTTP, published 2025-12-09 | **No.** Grepped for "custom field", "arbitrary", "user-defined": zero hits | **No.** Hierarchy via `parent*`/`grandparent*`; `Similar[]` is guid+tag | **The only contract in the sweep with a per-field `Required` column on the wire** | Provider declares `version`; `Feature[]` and `Types[]` negotiate capability | `summary`, `originalTitle`, `OriginalImage[]`; language is a **request header**, `X-Plex-Language`. No item holds several | `Guid[]` — a **list** of `"provider://id"` strings. Namespace open |
| **calibre** | `Metadata` objects pushed onto a `Queue` by `Source.identify()` | **Technically yes, uselessly.** `__setattr__`'s final branch takes arbitrary attributes but they are not in `SERIALIZABLE_FIELDS` | **No.** `series` + `series_index` only | **`touched_fields`** — a per-plugin declaration of which fields it can supply. Load-bearing at merge time | Plugin `version` tuple + `minimum_calibre_version` | `comments` (HTML), `languages` list. No per-language variants | `identifiers` dict, scheme→value, namespace open |
| **Audiobookshelf** | JSON over HTTP, `{ "matches": [ BookMetadata ] }`, OpenAPI 0.1.0 | **No.** A 15-key destructuring whitelist under the comment `// re-map keys to throw out` | **No.** `series: [{series, sequence}]` only | `required: [title]` documented and **not enforced** | Spec pinned at 0.1.0 and the code has already drifted past it | `description` (sanitized HTML); `language` is a free string | Two named fields, `isbn` and `asin`. No map |
| **Komga** | `BookMetadataPatch` / `SeriesMetadataPatch`, Kotlin data classes | **No.** `tags: Set<String>` is the only free channel | **No.** Series/book hierarchy. `Author(name, role)` role is free text | **Everything nullable with `null` defaults, and `null` means "no opinion"** | In-process Kotlin; new nullable property + capability enum member | `summary`; `language` BCP-47-validated on series only | One field, `isbn`. Everything else through `links: List<WebLink>` |
| **Navidrome** | **Eleven small capability interfaces**, each returning a 3-to-8-field struct | **Yes, but scanner-side.** `Tags map[TagName][]string`; keys come from `mappings.yaml` + operator config, never from an agent | **Partly.** `Participants map[Role]ParticipantList`, closed 14-member `Role` + **open `SubRole` string**. Item↔item does not exist | **Dissolved.** A provider that has no biography does not implement `ArtistBiographyRetriever` | WASM plugin schema `version: v1-draft`; a missing export **is** "not implemented", not an error | Biography/description; **no language field at all** | MusicBrainz only, but thoroughly: `mbid` is a positional parameter on nearly every method |
| **Kavita** | Fixed C# records; external path is the paid hosted Kavita+ | **No.** `KPlusOverrides` is a list of a closed enum | **Yes — the only one.** `SeriesRelation {RelationKind, SeriesId, TargetSeriesId}`, R a 15-member numeric enum | Nullable refs on, but non-nullables default to empty, so absence and empty are conflated | Method suffix on the hosted API (`MatchSeriesV3Async`), both sides Kavita's | **Best of the nine.** `Dictionary<BCP-47, IList<LocalizedTitleDto>>`, best-first, `IsPrimary`/`IsOfficial` | **One nullable column per source** — `AniListId`, `MalId`, `HardcoverId`, `MetronId`, `ComicVineId`, `MangaBakaId`, `CbrId`. Adding one is a migration |

## Comparison: the sources and the standards

| | Wide-schema mechanism | Typed relation A→B | Required vs optional | External ids |
|---|---|---|---|---|
| **MusicBrainz** | **`inc=` projection.** Default response is the entity's own row and nothing else; the client names each subresource it models | **697 relationship types**, each with a **UUID**, organised by entity-type pair. A relationship carries type, type-id, direction, begin/end/ended, ordering-key, and **attributes with their own UUIDs, free-text values and credited-as names** | Vocabulary closed and governed by a BDFL plus a ticket queue; no third party can add a type | **Relationships to `url` entities**, not a map of id fields. So an external id is typed, dated and repeatable |
| **OpenLibrary** | **The schema is data.** `/type/edition` is a record at revision 37 with its own edit history, fetchable at the same API as a book | **Almost none.** `/type/author_role {author, role, as}` is the one typed edge, declared and largely unused. Everything else is a bare `{"key": "/works/OL…"}` | `unique: true|false` is the only modifier. No required flag, no cardinality | **Three shapes on three entity types**: `identifiers` list-map on editions, `remote_ids` scalar-map on authors, dedicated `isbn_10`/`lccn`/`oclc_numbers` fields |
| **schema.org** | **`additionalProperty` → `PropertyValue`** (`name`, `value`, `propertyID`, `unitCode`, `valueReference`), plus `additionalType` and JSON-LD prefix mixing | **`Role`** — the Role node sits in the object position of the same property, and the property is repeated inside it | **Nothing is required.** "The type/properties associations of schema.org are closer to 'guidelines' than to formal rules" | `identifier`, accepting `PropertyValue` so the scheme is a `propertyID`. **No registry of scheme names exists** |
| **Dublin Core** | Refinement by `rdfs:subPropertyOf`, plus the **dumb-down principle** | `dcterms:relation` and its refinements; no reified relation | **Nothing required in the vocabulary.** Obligation lives in a **DCTAP** profile: `propertyID`, `mandatory`, `repeatable`, `valueNodeType`, `valueDataType`, `valueConstraint` | `dcterms:identifier`, a plain literal |
| **BIBFRAME** | Work/Instance/Item, and subclassing rather than new properties | **`bf:relation` → `bf:Relation`**, a reified node carrying `bf:relationship` (a looked-up type resource) + `bf:associatedResource` + notes. Added 2022-2024 under GH116 | Not published | **`bf:identifiedBy` → 48 subclasses of `bf:Identifier`**, plus `bf:Local` + `bf:source` as the escape hatch. One property, many classes |
| **RDF / Wikidata** | **A property is a URI.** No schema change carries a new one | **Wikidata statements**: main snak + **qualifiers** (property-value pairs on the statement) + **references** (provenance on the statement) + **rank**. RDF 1.2 triple terms and `rdf:reifies` are the standards-track equivalent | **SHACL**, owned and versioned by the consumer: `sh:minCount`, `sh:maxCount`, `sh:datatype`, `sh:closed` | Wikidata: an external id is a Property like any other. RDF: a URI |

---

## Jellyfin

Read at `jellyfin/jellyfin` `master`. Paths below are in that repository.

### What a provider returns

`MediaBrowser.Controller/Providers/IRemoteMetadataProvider.cs` is the whole obligation:

```csharp
public interface IRemoteMetadataProvider<TItemType, in TLookupInfoType>
    : IMetadataProvider<TItemType>, IRemoteMetadataProvider, IRemoteSearchProvider<TLookupInfoType>
    where TItemType : BaseItem, IHasLookupInfo<TLookupInfoType>
{
    Task<MetadataResult<TItemType>> GetMetadata(TLookupInfoType info, CancellationToken cancellationToken);
}
```

**The return type is not a wire DTO.** `TItemType` is constrained to `BaseItem`, the server's own
persisted entity class, so a Jellyfin provider constructs the server's domain object directly. There
is no translation layer and no schema: the contract is a .NET type reference.

`MetadataResult<T>` (`MediaBrowser.Controller/Providers/MetadataResult.cs`) carries nine members:
`Item`, `People`, `Images`, `RemoteImages`, `HasMetadata`, `ResultLanguage`, `Provider`,
`QueriedById`. **`People` sits on the result, not on the item** — the one relation Jellyfin models is
hoisted out of the entity and carried beside it.

### No property bag, and four arrays of names

`MediaBrowser.Controller/Entities/BaseItem.cs` declares 68 public auto-properties. Grepping it for
`Dictionary<string` returns two hits, both the same member: `ProviderIds` and its initialiser.
Nothing else on the item is open.

`Studios`, `Genres`, `Tags` and `ProductionLocations` are `string[]` — arrays of **names, not
references**. A studio is a string. Nothing a provider returns can point at another record.

### External ids: one open map, partly policed

`MediaBrowser.Model/Entities/IHasProviderIds.cs` is the entire interface — a single
`Dictionary<string, string> ProviderIds`. It is implemented by `BaseItem`, `PersonInfo`,
`RemoteSearchResult` and `ItemLookupInfo`, so the same map is the id carrier on the request, the
search hit, the returned item and each person on it.

The key namespace is open in the type system and **half-closed in practice**.
`MediaBrowser.Model/Entities/MetadataProvider.cs` enumerates 16 known providers plus `Custom = 0`,
documented as "This metadata provider is for users and/or plugins to override the default merging
behaviour." `MediaBrowser.Model/Entities/ProviderIdsExtensions.cs` holds `_providerIdValidators`,
format checks for eleven of those keys — `Imdb` against a regex, `Tmdb` against `IsPositiveNumber`,
all six MusicBrainz keys against `IsGuid` under the comment "Every MusicBrainz id is an MBID."
`MediaBrowser.Providers/Manager/MetadataService.cs` then **silently drops** any id whose key has a
validator and whose value fails it: `MergeBaseItemData` skips it on the way in and sweeps the target
afterwards, removing every key for which `IsValidProviderId` is false. `LogInvalidProviderIds`
reports each to the log. **An unknown key survives; a known key with the wrong shape is deleted
without the provider being told.**

### Typed relations: one relation, to people only

`MediaBrowser.Controller/Entities/PersonInfo.cs` carries `Name`, `Role` (free string), `Type`
(`PersonKind`), `SortOrder`, `ImageUrl`, `ProviderIds`. `Jellyfin.Data/Enums/PersonKind.cs` is a
**closed enum of 26**: Unknown, Actor, Director, Composer, Writer, GuestStar, Producer, Conductor,
Lyricist, Arranger, Engineer, Mixer, Remixer, Creator, Artist, AlbumArtist, Author, Illustrator,
Penciller, Inker, Colorist, Letterer, CoverArtist, Editor, Translator, Narrator. A provider cannot add
a 27th. `Role` is the escape hatch, and `PersonInfo.IsType` matching a `PersonKind` against that
string case-insensitively is the only place it is interpreted.

**There is no arbitrary typed relation between two items.** Item-to-item structure is `ParentId`,
`IndexNumber`, `ParentIndexNumber` and nothing else.

### Nothing required, nothing declared

Every `BaseItem` property is nullable, a reference type defaulting to null, or an empty array. The
contract has one boolean of intent: `MetadataResult.HasMetadata`. When false,
`MetadataService.ExecuteRemoteProviders` discards the whole result and logs "{Provider} returned no
metadata for {Item}". There is no per-field declaration of what a provider supplies.

Jellyfin's own documentation is silent on any MUST. `https://jellyfin.org/docs/general/server/metadata/`
says only that "Jellyfin can get metadata for your media through multiple sources" and lists them,
with nothing about which fields a provider must produce, how sources combine, or field locking.
`https://jellyfin.org/docs/general/server/metadata/identifiers/` names only TMDB, TVDB and OMDB and
presents that as the complete set, which the source contradicts.

### Conflict resolution: first non-empty wins, per field

`MediaBrowser.Model/Configuration/MetadataOptions.cs` carries `MetadataFetcherOrder`, a `string[]` of
provider names scoped by `ItemType`. `ExecuteRemoteProviders` walks providers in that order and calls
`MergeData` after each. `MergeBaseItemData` guards every field with the same shape:

```csharp
if (replaceData || string.IsNullOrEmpty(target.Name)) { ... }
if (replaceData || !target.CommunityRating.HasValue) { ... }
if (replaceData || target.Genres.Length == 0) { ... }
```

A later provider fills only what an earlier one left empty. Precedence overall is local metadata,
then remote providers in configured order, then whatever is already stored; a provider the user chose
in Identify is sorted first via `options.SearchResult.SearchProviderName`.

**The consequence is structural: a Jellyfin record is a chimera.** No single provider's view survives
whole. `MergeData` calls only `MergeBaseItemData`, which never copies `Provider` or `ResultLanguage`
to the target — `result.Provider = provider.Name` is assigned once and read nowhere afterwards. **The
finished record cannot say where any of its values came from.**

### Locking: nine fields of 68

`MediaBrowser.Model/Entities/MetadataField.cs` is a closed enum of nine: `Cast`, `Genres`,
`ProductionLocations`, `Studios`, `Tags`, `Name`, `Overview`, `Runtime`, `OfficialRating`.
`BaseItem.LockedFields` is a `MetadataField[]` and `MergeBaseItemData` tests membership before
touching each. The other 59 properties — `Tagline`, `PremiereDate`, `CommunityRating`, `IndexNumber`,
`HomePageUrl` — cannot be defended against a provider at all, except by `BaseItem.IsLocked`, which
locks the whole item.

### Prose and translations: a hand-written patch for two fields

`Overview` and `Tagline` are plain `string`, one value each, **no language tag on the field**.
Language lives on the request (`ItemLookupInfo.MetadataLanguage`) and the result
(`MetadataResult.ResultLanguage`).

Because the contract has no language dimension, the fallback is written by hand for exactly two
fields. In `ExecuteRemoteProviders`, two local bools `overviewIsFallback` and `taglineIsFallback`
track whether the held value came from a wrong-language result; when a right-language result arrives
with a value, the held one is **discarded by nulling the field** so the first-non-empty rule lets the
new one through. Nothing else among the 68 properties gets this. A wrong-language `Name` or `Genres`
simply sticks.

Images, by contrast, do carry language: `MediaBrowser.Model/Providers/RemoteImageInfo.cs` has
`ProviderName`, `Url`, `ThumbnailUrl`, `Height`, `Width`, `CommunityRating`, `VoteCount`,
**`Language`**, `Type`, `RatingType`. So an image knows which provider it came from and what language
it is in, while the overview beside it knows neither. `MediaBrowser.Model/Entities/ImageType.cs` is a
closed enum of 13 roles.

### Versioning: a floor on the server version

There is no version on the contract. A plugin declares `targetAbi` in the repository manifest
(`MediaBrowser.Model/Updates/VersionInfo.cs`), and
`Emby.Server.Implementations/Updates/InstallationManager.cs` filters on it in `GetPackages`
("Only show plugins that are greater than or equal to targetAbi") and again in
`GetCompatibleVersions` (`string.IsNullOrEmpty(x.TargetAbi) || Version.Parse(x.TargetAbi) <= appVer`).
Compatibility is "this plugin needs at least server version X", asserted by the author and enforced
by the catalogue, never negotiated. Growing the contract means adding a property to `BaseItem`:
source-compatible for a compiled plugin, which simply never sets it.

### Preservation without comprehension

`MediaBrowser.XbmcMetadata/Savers/BaseNfoSaver.cs` does two things the in-memory contract does not.
It writes **every** provider id, known or not, as an element named by `GetTagForProviderKey`
(`providerKey.ToLowerInvariant() + "id"`), guarded by `XmlConvert.VerifyName` and swallowing the
exception so a bad key does not fail the save. And `AddCustomTags` re-reads the NFO on disk and copies
through every element neither in the static `_commonTags` set nor written this pass.

So Jellyfin **preserves** foreign metadata at the file level while understanding none of it. Nothing
reads those elements back into `BaseItem`, and a remote provider has no equivalent.

---

## Kodi

Read at `xbmc/xbmc` `master` (commit `0e06579f`). kodi.wiki is behind Cloudflare; its pages were read
through its own MediaWiki API, which returns page source verbatim.

### One parser for three surfaces

`xbmc/addons/Scraper.cpp`, `CScraper::GetVideoDetailsUncached`, requires a `<details>` root and hands
the element straight to `video.Load(pxeDetails, true)`. `CVideoInfoTag::Load` is a wrapper over
`ParseNative`. **The scraper's `<details>` vocabulary and the NFO file vocabulary are literally the
same parser**, and the root element's name is never checked — `<details>`, `<movie>`, `<tvshow>`,
`<episodedetails>` all go through the same code.

Python scrapers are not a separate channel either. `CScraper::PythonDetails` invokes the plugin by
URL and reads back a `CFileItem`, and the video specialisation is the whole story:

```cpp
template<>
bool DetailsFromFileItem<CVideoInfoTag>(const CFileItem& item, CVideoInfoTag& tag)
{
  if (item.HasVideoInfoTag()) { tag = *item.GetVideoInfoTag(); return true; }
  return false;
}
```

**Nothing else on the ListItem survives.** The Python video contract is exactly the C++
`CVideoInfoTag`.

### The set is fixed, and unknown elements vanish

`CVideoInfoTag::ParseNative` in `xbmc/video/VideoInfoTag.cpp` is a flat sequence of
`XMLUtils::GetString(movie, "<literal>", value)` calls. **There is no iteration over unknown children
anywhere in it and no `else` branch: an element the parser does not name is silently dropped with no
log line.** 61 top-level names are read — titles, `<ratings>`, numbering, `<outline>`/`<plot>`/
`<tagline>`, `<genre>`/`<country>`/`<tag>`/`<studio>`/`<mpaa>`, `<credits>`/`<director>`/`<actor>`,
dates, `<uniqueid>`, paths, playback state, `<thumb>`/`<fanart>`, `<namedseason>`/`<seasonplot>`,
`<set>`/`<showlink>`, video assets, `<fileinfo>`, `<originallanguage>`.

The Python replacement API, `InfoTagVideo` in `xbmc/interfaces/legacy/InfoTagVideo.h`, is a fixed list
of ~55 typed setters. **There is no generic key/value setter and no extra-fields escape hatch.** The
deprecated `ListItem.setInfo` is a fixed dictionary whose `else` branch is
`CLog::Log(LOGERROR, "NEWADDON Unknown Video Info Key \"{}\"", key)`.

**There is no XSD or DTD for the scraper `<details>` document or for NFO files.** Enumerating every
`.xsd`/`.dtd` in the repository (git tree API, untruncated, 12,740 paths) returns one scraper-related
schema, `addons/xbmc.metadata/scraper.xsd`, and it constrains `addon.xml`'s `<extension>` element
only.

### Unique ids: a map plus a nominated default

`xbmc/video/VideoInfoTag.h` declares `std::string m_strDefaultUniqueID` and
`std::map<std::string, std::string, std::less<>> m_uniqueIDs`. Reset seeds the default key to the
literal `"unknown"`. XML form is `<uniqueid type="…" default="true">`, with a guard: the `default`
attribute only takes effect while no default has yet been chosen. A bare `<id>` becomes the default
when no `<uniqueid>` element exists. Persisted as `CREATE TABLE uniqueid (uniqueid_id, media_id,
media_type, value, type)` in `xbmc/video/VideoDatabaseDDL.cpp`. The Python docs list `imdb`, `tvdb`,
`tmdb`, `anidb` as examples and say explicitly **"(any string possible)"**.

### Typed relations: `<role>` and nothing else

Every relation is a named element with a hard-coded meaning landing in a table whose name is a C++
string literal. `AddLinksToItem` in `xbmc/video/VideoDatabase.cpp` splices the relation kind into the
table name and is called only with `"genre"`, `"studio"`, `"country"`, `"tag"`.

Of all Kodi's relations, **only the cast credit carries a per-edge attribute**: `SActorInfo` is
`{strName, strRole, thumbUrl, thumb, order}`, landing in
`actor_link(actor_id, media_id, media_type, role, cast_order)`. A director is just a name in a
two-column link table.

`<showlink>` is worth naming as a cautionary case. `VideoDatabase.cpp` resolves it by **title**, at
write time, against whatever is already in the database, and drops the edge with a warning if the
show is absent. The wiki confirms the intent: "Connect movie to TV Show. Use the TV Show `<title>`
name."

Parent/child structure is not even carried in the metadata. `https://kodi.wiki/view/NFO_files/Episodes`
states it in bold: "Kodi determines the season and episode numbering (S01E01) from the episode
filename, not from the NFO file."

### Required: documented for NFO, absent for scrapers

The NFO pages document it as a table column — `https://kodi.wiki/view/NFO_files/TV_shows`: "Two XML
tags are required and are indicated in the table below. All other tags are optional." Nothing enforces
it. `ParseNative` performs no validation, and the only emptiness test on the tag is
`CVideoInfoTag::IsEmpty()`, used in one place.

**Kodi's docs are silent on what a `getdetails` response must contain**, and nothing in the code
requires any field of a `<details>` document, including `<title>`. The two places code does enforce
something are search results (an `<entity>` without both `<title>` and `<url>` is skipped) and the
episode list (an `<episode>` without `<url>`, `<season>` and a non-empty `<epnum>` is skipped).

### Versioning: the XML→Python transition bumped nothing

`addons/xbmc.metadata/addon.xml` declares `version="2.1.0"` with `<backwards-compatibility abi="1.0"/>`,
and has done since 2012. Checked at each release tag — 17.6-Krypton, 18.0-Leia, 19.0-Matrix,
20.0-Nexus, 21.0-Omega, 22.0b1-Piers, master — it is `2.1.0 / abi 1.0` throughout. Python scrapers
arrived without touching it.

**The kind of scraper is inferred from the file extension, not declared**:
`m_isPython = addonInfo->Type(addonType)->LibPath().ends_with(".py")` in `Scraper.cpp`. Backward
compatibility is total by construction, and both paths remain live in master today. Deprecation is
policy only — `https://kodi.wiki/view/Scrapers`: "their use has been deprecated, since the release of
Kodi v19 Matrix, in favour of Python based scrapers… no future XML scrapers will be accepted into the
official repository."

### Prose, translations and merging

`<plot>` and `<outline>` are single `std::string`s read with a bare `XMLUtils::GetString` — **no
`lang` attribute is read, there or anywhere in the tag**. `<originallanguage>` is the work's spoken
language, not the metadata's. Language selection lives in the addon.xml `language` attribute and
per-scraper settings. **Kodi stores one language's text and has nowhere to put a second.**

There is no reconciliation across providers because the situation does not arise:
`CVideoDatabase::GetScraperForPath` returns a single `ScraperPtr`. Within one scraper run, chained
documents append — lists accumulate unless an element carries `clear="true"`, scalars are last-document-wins.
An NFO over a scraper is re-applied with `prioritise=true`, which clears lists before appending.
Refresh is **delete-and-replace**: `VideoLibraryRefreshingJob.cpp` calls `db.DeleteMovie(...)` before
rescanning, under the comment "remove any existing data for the item we're going to refresh".

### The three open key spaces

Unique-ID source names, rating source names, and artwork type names. All three hold a single string
with no schema. `ListItem.setProperty` exists but does **not** reach video metadata — for a video
scraper those properties are dropped, because `DetailsFromFileItem<CVideoInfoTag>` copies only the
tag. Three narrow exceptions read a property: `relevance` in search, `video.sub_episode` in the
episode list, and the **music** scrapers, which use properties as their entire transport against a
hard-coded key list (`album.musicbrainzid`, `artist.biography`, …) — an open-looking namespace with a
closed reader.

---

## Plex

### Legacy: the Plug-in Framework

The model definitions are shipped Python templates. `Framework/api/common_models.pym`:

```python
class MetadataModel(Template.Model, Template.Abstract):
  guid_args = ['lang']
  genres = Template.Set(Template.String())
  tags = Template.Set(Template.String())
  collections = Template.Set(Template.String())
  reviews = Template.Set(Review())
  duration = Template.Integer()
  rating = Template.Float()
  audience_rating = Template.Float()
  ...
```

`Movie` adds `title`, `year`, `originally_available_at`, `studio`, `tagline`, `summary`, `trivia`,
`quotes`, `content_rating`, `content_rating_age`, `writers`, `directors`, `producers`, `roles`,
`countries`, poster/art/banner/theme containers, `chapters`, `extras`, `similar`. `TV_Show`, `Season`
and `Episode` are declared the same way in `tv_models.pym`; `Person` is `{role, name, photo}`,
`Review` is `{author, source, image, link, text}`, `Chapter` is
`{title, start_time_offset, end_time_offset}`.

**Fixed declarations throughout, and the closure is enforced at runtime.**
`Framework/modelling/objects.py`:

```python
def __setattr__(self, name, value):
    if name[0] != '_':
      if self._attribute_list != None and name not in self._attribute_list:
          raise Framework.exceptions.FrameworkException(
              "Object of type '%s' has no attribute named '%s'" % (str(type(self)), name))
```

**Setting an undeclared attribute on a metadata model throws.** This is the strictest treatment of an
unknown field in the whole sweep — everywhere else it is silently dropped.

`Season` is worth naming separately: `summary`, the image containers, `episodes` and `extras` are
agent-settable, and everything else on it (`title`, `index`, `show`, `thumb`, `episode_count`, …) is
marked `is_synthetic`, which `BundleCombiner._combine_attr` skips outright — interface-only, not
settable by an agent.

The agent class itself (`Framework/api/agentkit.py`, `class BaseAgent`) declares the contributor
model: `primary_provider` ("Primary providers can be selected as the main source of metadata for a
particular media type. If an agent is secondary… it will only be able to contribute to data provided
by another primary agent"), `contributes_to`, `accepts_from`, `fallback_agent`, `languages`,
`version`, and two methods, `search` and `update`. The docs note that "The list of available
contributors for a particular agent is a composite of the `accepts_from` and `contributes_to`
attributes of the various agents involved, and is computed at runtime."

`MetadataSearchResult` is five attributes — `id` ("This can be in any format"), `name`, `year`,
`score` ("between 0 and 100… Results with a score of 85 or greater are considered 'good enough' for
automatic matching") and `lang`.

The GUID is where language lives, and this is the striking part. `Framework/modelling/model.py`:

```python
self._uid = '%s://%s?lang=%s' % (self.provider, id, lang)
```

and `make_guid` enforces the argument list against `guid_args`, raising
`FrameworkException("Invalid GUID argument '%s' for model %s")` for anything else. **So under legacy
Plex a different language is a different record**, addressed by a different GUID, stored in a
different bundle (the path is a SHA-1 of the uid). That is one answer to translations: make the
language part of identity rather than a field.

One agent produces exactly one guid per item and **there is no guid list**, so cross-provider identity
is inexpressible: a TVDB agent and a TMDB agent produce two unrelated guids and two unrelated bundles.
The nearest thing is `metadata.contributors`, which is a **directory listing** of the item's bundle,
and `metadata.contribution(identifier)` to read one contributor's version.

The format strained early. `Framework/modelling/combination.py` splits on `://` and carries a
hardcoded exception list:

```python
agents_that_happen_to_do_things_a_little_differently = ['mbid', 'plex', 'com.plexapp.agents.lastfm',
    'com.plexapp.agents.allmusic', 'com.plexapp.agents.plexmusic']
```

plus special-casing for TMDB and TVDB, whose ids contain `/`
(`com.plexapp.agents.thetvdb://12345/seasons/1/episodes/1`).

### Legacy merging: override by default, even for sets

`support.plex.tv/articles/200241558-agents/` describes source priority in prose — "If a piece of
metadata isn't available from your first source, then the agent will fallback down the priority list
until it finds a source with that information" — and **never says what happens when two sources both
have a value**. The code settles it. `BundleCombiner._combine_attr`:

```python
if rule_action == None:
  if isinstance(attr, (templates.MapTemplate, templates.ObjectContainerTemplate)):
    rule_action = 'merge'
  else:
    rule_action = 'override'
```

So **Sets default to `override` too**: `genres` from the top-priority source wins wholesale rather
than unioning, unless the agent's config XML supplies a per-attribute `merge` rule. Rating fields move
as a unit — `self._linked_attributes = {"rating": ["rating_image", "audience_rating",
"audience_rating_image"]}`, with the dependents never picked independently.

**There is no `touched_fields` analogue.** Contributing sources are *discovered after the fact*, by
listing the bundle directory in `combine()`, and `_combine_attr` then drops any source with no
candidate for the attribute in hand. An agent never declares what it supplies.

### Modern: a published HTTP provider contract

Plex published a public provider contract on 2025-12-09 at `https://developer.plex.tv/pms/`, with an
official reference implementation at `plexinc/tmdb-example-provider` (a genuine `plexinc` repo,
TypeScript, not archived). Any record asserting that Plex has no public provider interface is out of
date.

**Two deprecation events, and conflating them is the common error.** On **2018-09-25**
`forums.plex.tv/t/discontinuation-of-plugins-watch-later-recommended-and-cloud-sync/312312` (posted
by `PlexInfo`, `staff: true`) retired *browsable* plugins and explicitly carved agents out: "While
support for browsable plugins is being discontinued, **nothing is happening to scanners and metadata
agents with this announcement**." On **2025-12-09**
`forums.plex.tv/t/announcement-custom-metadata-providers/934384` (`drzoidberg33`, `staff: true`) is
the one that kills agents: "**We plan to completely remove the legacy agents system from new PMS
releases in 2026.** This requires Plex Media Server 1.43.0."

**As of 2026-09-21 they are hidden, not removed.** `support.plex.tv/articles/200241558-agents/`,
modified 18 November 2025: "As of Server version 1.43.0 Legacy agents wil not longer be shown when
creating new libraries or editing libraries using modern agents based on the setting Server
Settings>Library>Show Legacy Agent during library set up. If there are already libraries with those
legacy agents enabled those libraries will have the options displayed." Current PMS is
**1.43.4.10903-e5521bd8c, released 2026-08-17** on both channels (`https://plex.tv/api/downloads/5.json`);
there is no 1.44 and no release note announcing removal.

From the 2025-12-09 announcement, on what a provider now is: "these are as the name suggests,
providers of metadata, and are just an HTTP API that returns metadata for library items in a
standardized way… Developers are not restricted by any one language or technology to write these
providers, essentially anything that can serve an HTTP API can be used… All the user needs to install
a metadata provider is a single URL."

A provider serves a `MediaProvider` root document — `identifier` (required), `title` (required),
`version`, `Feature[]` (`metadata`, `match`), `Types[]`. Custom providers "need to provide an
identifier using a scheme with the `tv.plex.agents.custom.` prefix", and the docs warn to "avoid
using very generic suffixes like tmdb, tvdb, etc."

Endpoints, from the example provider's `docs/API Endpoints.md`: `GET {key}/{ratingKey}` (required),
`POST {key}` for match (required), `GET {key}/{ratingKey}/children` (required for shows and seasons,
**must** support paging), `GET {key}/{ratingKey}/grandchildren` (required for shows), and
`GET {key}/{ratingKey}/images` (recommended). Paging support via `X-Plex-Container-Size` and
`X-Plex-Container-Start` is **required**; `X-Plex-Language` and `X-Plex-Country` support is not.

**The Metadata object is the only contract in this whole sweep with a per-field `Required` column on
the wire.** Core attributes applicable to all types: `ratingKey` (Yes), `key` (Yes), `guid` (Yes),
`type` (Yes), `title` (Yes), `originallyAvailableAt` (**Yes**), then `thumb`, `art`, `contentRating`,
`originalTitle`, `titleSort`, `year`, `summary`, `isAdult` (all No). Season and Episode add a required
`parentRatingKey`, `parentKey`, `parentGuid`, `parentType`, `parentTitle`, `index`; Episode adds
required `grandparent*` and `parentIndex`. Arrays: `Image[]` (Highly Recommended), `OriginalImage[]`,
`Genre[]`, `Guid[]`, `Collection[]`, `Country[]`, `Role[]`/`Director[]`/`Producer[]`/`Writer[]`,
`Similar[]`, `Studio[]`, `Rating[]`, `Network[]`, `SeasonType[]`, `Children`.

Two details worth carrying. **`SeasonType[]`** lets a show declare several episode orderings
(`{id, source, tag, title}`), selected by an `episodeOrder` query parameter — a source publishing
*several competing sequences over the same members* and letting the client name one. And **`Rating[]`
is closed**: the image identifiers are `imdb://image.rating`, `themoviedb://image.rating`,
`rottentomatoes://image.rating.ripe`, `rottentomatoes://image.rating.upright`, with "Adding new types
is not currently supported."

Which arrays a type may carry is itself fixed, and **Season is nearly bare**. From the reference
implementation's TypeScript interfaces: Movie takes `Image`, `OriginalImage`, `Genre`, `Guid`,
`Collection`, `Country`, `Role`, `Director`, `Producer`, `Writer`, `Similar`, `Studio`, `Rating`; Show
takes the same minus `Collection` plus `Network`, `SeasonType`, `Children`; Episode takes `Image`,
`OriginalImage`, `Guid`, `Rating`, `Role`, `Director`, `Producer`, `Writer`; **Season takes only
`Image`, `OriginalImage`, `Guid` and `Children`.**

`Guid[]` is a **list** of `"provider://id"` strings — `imdb`, `tmdb`, `tvdb` internally supported,
namespace otherwise open. The GUID a provider mints is
`{scheme}://{metadataType}/{ratingKey}`, e.g. `tv.plex.agents.custom.johnz.tmdb://movie/tmdb-movie-19934`,
with `ratingKey` restricted to `[a-zA-Z0-9_-]`.

### Identity and priority are orthogonal

PMS's own OpenAPI defines `metadataAgentProvider.agentType` as an enum, verbatim:

> "- primary: A metadata provider which provides a unique identifier (guid) for each item.
> - contributor: A metadata provider which provides additional metadata for items but does not have a
> unique item identifier."

An agent is a **group** with a `primaryIdentifier` ("the identifier of the MetadataAgentProvider which
will provide the item guids") and per-item `order`. So **one provider owns the item's identity while a
different one owns most of its fields** — legacy Plex conflated these in `primary_provider`. On
refresh, PMS issues a `metadata` GET to the primary and a `match` POST to each other provider, then
stores each provider's guid so the item is never re-matched.

There is a measured gap: external ids returned in `Guid[]` are stored but not fed back on subsequent
match requests, and the published match table still carries a **singular** `guid`. A `guids[]` array
was proposed in the developer thread and was still unimplemented as of 2026-02-06.

Merging is array-level replacement, not per-element merge. A developer reported that returning an
`Image` array from a higher-priority provider "made Plex completely ignore all images from the Plex
Movie agent… resulting in my movies no longer having any `background`, `clearLogo` etc." Plex did not
dispute it.

### Language and prose

Modern: language is a **request header**, `X-Plex-Language` (IETF tag with region), alongside
`X-Plex-Country` for certification data. `originalTitle` and `OriginalImage[]` exist precisely because
the request may be in a language other than the original. **No item holds several translations** —
confirmed by the contract and by `python-plexapi`'s `languageOverride (str)` being a single per-item
setting. A user asked in-thread for multi-language cast data and got no reply.

### Property bag

Grepping the provider spec for "custom field", "arbitrary", "user-defined", "additional attribute",
"extra attribute" returns **zero hits**. One trap: PMS's own OpenAPI `metadata` schema sets
`additionalProperties: true`, which is only that schema declining to forbid unknown keys on PMS's
*responses*. It is not an extension point and nothing says PMS stores or surfaces unknown keys. The
single genuinely open slot is `Guid[]`, where Plex staff confirmed custom schemes like `mal://1234`
are acceptable "if providers understand them".

**What the new system does not yet cover**, per the announcement's own list and later staff replies in
the same thread: music libraries ("No ETA yet, but it will get done at some point", 2026-04-23),
authentication, streams and subtitles, provider-specific preferences ("not yet implemented"),
collections ("is something that can be done" but "just isn't currently implemented"), extras ("No,
extras are not supported"), custom rating badges, and custom EPG providers. The thread ran to 90
posts, last 2026-05-08.

**`support.plex.tv` is silent on the whole new system.** There is no article on Metadata Providers or
the Settings → Metadata Agents pane; it exists only on developer.plex.tv and in the forum thread.

---

## calibre

Read at `kovidgoyal/calibre` `master`.

### `touched_fields`: a per-plugin declaration of what it supplies

`src/calibre/ebooks/metadata/sources/base.py`, class `Source`:

```python
#: Set of capabilities supported by this plugin.
#: Useful capabilities are: 'identify', 'cover'
capabilities = frozenset()

#: List of metadata fields that can potentially be download by this plugin
#: during the identify phase
touched_fields = frozenset()
```

**This is the sharpest single idea in the whole sweep.** A real declaration, from
`src/calibre/ebooks/metadata/sources/goodreads.py`:

```python
capabilities = frozenset(['identify', 'cover'])
touched_fields = frozenset(['title', 'authors', 'identifier:goodreads',
    'identifier:grrating', 'identifier:grvotes',
    'identifier:isbn', 'rating', 'comments', 'publisher', 'pubdate',
    'tags', 'series', 'languages'])
```

Note the form `identifier:<scheme>` — a plugin declares not only which fields but which **id schemes**
it can supply. `Source.test_fields` uses it to find the first declared field the plugin failed to
produce.

And note `identifier:grrating` and `identifier:grvotes`. **Goodreads is stuffing a rating and a vote
count into the identifier map**, because the identifier map is the only open namespace in the
contract. That is the property-bag pressure venting through the id field, measured in a shipped
plugin.

### `identify()` returns `Metadata` objects on a Queue

```python
def identify(self, log, result_queue, abort, title=None, authors=None, identifiers={}, timeout=30):
```

with the documented obligation: "Every Metadata object put into result_queue by this method must have
a `source_relevance` attribute that is an integer indicating the order in which the results were
returned by the metadata source for this query."

### The field lists

`src/calibre/ebooks/metadata/book/__init__.py`, whose header reads "All fields must have a NULL value
represented as None for simple types, an empty list/dictionary for complex types and (None, None) for
cover_data":

- **`SOCIAL_METADATA_FIELDS`** — `tags`, `rating`, `comments`, `series`, `series_index`, `identifiers`
- **`PUBLICATION_METADATA_FIELDS`** — `title`, `title_sort`, `authors`, `author_sort_map`,
  `author_sort`, `book_producer`, `timestamp`, `pubdate`, `last_modified`, `rights`,
  `publication_type`, `uuid`, `languages`, `publisher`, `cover`, `cover_data`, `thumbnail`
- **`BOOK_STRUCTURE_FIELDS`** — `toc`, `spine`, `guide`, `manifest`
- **`USER_METADATA_FIELDS`** — `user_metadata`
- **`DEVICE_METADATA_FIELDS`** — `device_collections`, `lpath`, `size`, `mime`
- **`CALIBRE_METADATA_FIELDS`** — `application_id`, `db_id`, `formats`, `user_categories`,
  `link_maps`, `pages`
- **`ALL_METADATA_FIELDS`** is the union of all six; **`STANDARD_METADATA_FIELDS`** is the same union
  minus `USER_METADATA_FIELDS` — i.e. "all fields except custom fields", as the comment says.

`TOP_LEVEL_IDENTIFIERS = frozenset(('isbn',))` is the one id promoted to an attribute, and
`Metadata.__getattribute__` routes `mi.isbn` to `_data['identifiers']['isbn']`.

### Custom columns: reachable, narrowly, and undocumented

Custom columns live in `_data['user_metadata']`, keyed `#name`, each value a **field-definition dict**
(`datatype`, `is_multiple`, `display`, …) carrying the value inline under `#value#`.
`Metadata.set_user_metadata` in `src/calibre/ebooks/metadata/book/base.py` enforces the prefix:

```python
if not field.startswith('#'):
    raise AttributeError(f"Custom field name {field!r} must begin with '#'")
```

and `__setattr__` routes a `#`-prefixed name into `user_metadata` **only if the key is already
there**. Otherwise it falls to the last branch:

```python
else:
    # You are allowed to stick arbitrary attributes onto this object as
    # long as they don't conflict with global or user metadata names
    # Don't abuse this privilege
    self.__dict__[field] = val
```

That is a real property bag, and it is not a custom column — the value is a plain Python attribute and
nothing warns.

**Whether a source plugin can write a custom column is undocumented, and the answer is "narrowly
yes".** Traced end to end:

- Nothing strips `user_metadata` between the plugin's queue and the merge.
- **`ISBNMerge.merge` destroys it.** It builds a fresh `ans = Metadata(_('Unknown'))` whose
  `user_metadata` is `{}`, so the `touched_fields` catch-all's `setattr(ans, '#col', v)` lands in
  `__dict__` and is dropped. And `merge_isbn_results` calls `merge()` for **every** pool including
  single-result pools, so **any result carrying an ISBN loses its custom columns even when nothing was
  merged**. `merge_metadata_results` does the same to any group sharing a lowercased
  `(title, authors)` key.
- A result with **no ISBN and no title/author collision survives**, because `finalize` appends the
  original object rather than a merged one.
- The OPF round-trip preserves it across the worker process: `opf2.py`'s `metadata_to_opf` calls
  `serialize_user_metadata`, emitting `<meta name="calibre:user_metadata:#col" content="{json}">` with
  `#value#` inside, and `OPF.read_user_metadata` reads it back.
- The write is gated. `src/calibre/db/cache.py`, `Cache.set_metadata`, writes a custom key only when
  it already exists in `field_metadata` **and** its `datatype` matches **and** (for text) its
  `is_multiple` matches.

**So a plugin can never create a column.** It can only write into one the user already made, with an
exactly matching datatype, and only if its result escaped the merge. The manual is silent:
`manual/plugins.rst` is autodoc only, has no `Metadata` autoclass, and mentions custom columns,
`user_metadata` and `identifiers` zero times.

That is why plugin authors abuse `identifiers` instead — the Goodreads plugin's
`identifier:grrating` and `identifier:grvotes` are exactly this pressure finding the only open door.

### Merging: per-field heuristics, and `touched_fields` doing real work

`src/calibre/ebooks/metadata/sources/identify.py`, `ISBNMerge.merge`. This is the most explicit
reconciliation in the sweep and it is worth reading whole:

```python
# We assume the shortest title has the least cruft in it
ans.title = self.length_merge('title', results, null_value=ans.title)
# No harm in having extra authors, maybe something useful like an editor or translator
ans.authors = self.length_merge('authors', results, null_value=ans.authors, shortest=False)
# We assume the shortest publisher has the least cruft in it
ans.publisher = self.length_merge('publisher', results, null_value=ans.publisher)
# We assume the smallest set of tags has the least cruft in it
ans.tags = self.length_merge('tags', results, null_value=ans.tags, shortest=msprefs['fewer_tags'])
# We assume the longest series has the most info in it
ans.series = self.length_merge('series', results, null_value=ans.series, shortest=False)
...
# Average the rating over all sources
if ratings: ans.rating = round(sum(ratings) / len(ratings))
# Smallest language is likely to be valid
ans.language = self.length_merge('language', results, null_value=ans.language)
# Choose longest comments
ans.comments = self.length_merge('comments', results, null_value=ans.comments, shortest=False)
...
# Identifiers
for r in results:
    ans.identifiers.update(r.identifiers)
```

Then the part that makes `touched_fields` load-bearing rather than documentation:

```python
touched_fields = set()
for r in results:
    if hasattr(r, 'identify_plugin'):
        touched_fields |= r.identify_plugin.touched_fields

for f in touched_fields:
    if f.startswith('identifier:') or not ans.is_null(f):
        continue
    setattr(ans, f, self.random_merge(f, results, null_value=getattr(ans, f)))
```

**The union of every contributing plugin's declaration decides which fields get merged at all.** A
field no plugin declared is never looked at.

Identity is reconstructed every run rather than stored. `ISBNMerge.add_result` pools results by ISBN;
`merge_metadata_results` then groups the ISBN-less remainder by lowercased `(title, tuple(authors))`
and merges each group. The old xISBN expansion is dead code (`self.use_xisbn = False`, with the
decommission notice in a comment).

**There is no per-source priority for identify.** `InternalMetadataCompareKeyGen`'s own docstring says
so: "This is used only to compare results from the same metadata source, **not across different
sources**." Its seven ranking terms are: same identifier as the query, cached cover URL, **all
available fields filled in** (i.e. `test_fields` against the plugin's own `touched_fields`), UI
language match, exact title match, longer comments, then the source's own relevance.

The one real per-source priority in calibre is **covers only**,
`src/calibre/ebooks/metadata/sources/prefs.py`:

```python
# Google covers are often poor quality (scans/errors) but they have high
# resolution, so they trump covers from better sources. So make sure they
# are only used if no other covers are found.
msprefs.defaults['cover_priorities'] = {'Google': 2, 'Google Images': 2, 'Big Book Search': 2}
```

User controls are otherwise subtractive rather than ordering: per-plugin and global `ignore_fields`
blank a field before merging, and `prefer_results_with_isbn` drops ISBN-less results from a source
that also returned ISBN-bearing ones.

`identifiers` is an open scheme→value dict with **no registry, no allowlist and no validation**. The
only normalisation is two functions:

```python
def ck(typ): return icu_lower(typ).strip().replace(':', '').replace(',', '')
def cv(val): return val.strip().replace(',', '|')
```

The merge is a plain `update()`, so **the last result in group order wins per scheme** with no
provenance.

**Typed relations: none.** `series` + `series_index` is the only ordering relation and it points at a
**string**, not another book record. A custom column of `datatype == 'series'` gives a user
arbitrarily many parallel series axes, each auto-getting a `#label_index` float — the closest thing in
calibre to multi-placement, still string-keyed. The plausible-looking `link_maps` is not a
record-to-record relation: `Cache.get_all_link_maps_for_book` maps a field *value* to a URL
(`{'authors':{'A':'X'}, 'tags':{'T','G'}}`), and a source plugin cannot write it in any case — it is
consumed only in `_add_books`, never in `set_metadata`. **There is no book-to-book edge of any kind in
`ALL_METADATA_FIELDS`.**

### Two documentation defects worth recording

`Source.identify`'s docstring says `source_relevance` "will be used by
:meth:`compare_identify_results`" — **and `compare_identify_results` does not exist anywhere in the
codebase.** `source_relevance` is read only as the final tiebreak in
`InternalMetadataCompareKeyGen.__init__` and defaults to 0, so it is not genuinely mandatory; the
field the merge machinery actually uses is `relevance_in_source`, which the framework assigns after
sorting. Two similarly named fields, one documented and one real.

And `prefer_author_sort` **does not exist** in `sources/base.py`, `identify.py` or `worker.py`. There
is an `author_sort_map` field and an `msprefs['swap_author_names']` toggle, and nothing else. Any
ticket or record citing `prefer_author_sort` is wrong.

The published manual page is the docstrings and nothing more: `manual/plugins.rst` is
`.. autoclass:: Source :members: :member-order: bysource`, which is why the typo in
`touched_fields`'s comment ("can potentially be download by this plugin") is reproduced verbatim at
`manual.calibre-ebook.com/plugins.html`.

---

## The four smaller servers

### Audiobookshelf — the only real pluggable HTTP contract of the four

Published as OpenAPI 3.0.0 at the repo root, `advplyr/audiobookshelf` →
`custom-metadata-provider-specification.yaml`, `info.version: 0.1.0`. `GET /search?query=&author=`
returns `{ "matches": [ BookMetadata ] }` with `required: [title]` and fourteen optional fields:
`subtitle`, `author` (a single comma-joined string, not a list), `narrator`, `publisher`,
`publishedYear`, `description`, `cover`, `isbn`, `asin`, `genres`, `tags`, `series`
(`SeriesMetadata[]` of `{series, sequence}`), `language`, `duration`.

**Validation is a destructuring statement**, in `server/providers/CustomProviderAdapter.js`, under a
comment that says exactly what it does:

```js
// re-map keys to throw out
return matches.map((match) => {
  const { title, subtitle, author, narrator, publisher, publishedYear, description,
          cover, isbn, asin, genres, tags, series, language, duration } = match
```

Values then pass a coercer (`toStringOrUndefined` accepts a number, and joins an array of strings with
commas) and any key that fails is deleted. **Unknown fields vanish without a log line, and the `title`
requirement is not enforced** — a titleless match yields `{}`. The only structural rejection is
`if (!res?.data || !Array.isArray(res.data.matches)) return null`, surfacing as
`throw new Error('Custom provider returned malformed response')`.

Two drifts worth recording. The adapter sends four query params (`mediaType`, `query`, `author`,
`isbn`) where the 0.1.0 spec documents two. And the built-in providers are richer than the third-party
contract: `server/providers/Audible.js` returns `region`, `rating` and `abridged`, three fields the
custom schema has no slot for and the whitelist would discard.

Dispatch is exclusive-or, not a merge: `server/finders/BookFinder.js` —
`// Custom providers are assumed to be correct` — returns the custom provider's results directly,
bypassing the fuzzy matching the built-ins get.

### Komga — no pluggable remote provider, and the lock as the integration point

Every implementation of Komga's provider interfaces reads a file already on disk:
`comicrack/ComicInfoProvider.kt`, `comicrack/ReadListProvider.kt`, `epub/EpubMetadataProvider.kt`,
`mylar/MylarSeriesProvider.kt`, `barcode/IsbnBarcodeProvider.kt`, `localartwork/LocalArtworkProvider.kt`,
`oneshot/OneShotSeriesProvider.kt`. There is no plugin loader and no HTTP client in the metadata
package. Komga's own docs route the need outward: `https://komga.org/docs/community/` lists **Komf**
("Komga and Kavita Metadata Fetcher") as a third-party tool that drives Komga's REST API from outside.

The interfaces are tiny:

```kotlin
interface BookMetadataProvider : MetadataProvider {
  val capabilities: Set<BookMetadataPatchCapability>
  fun getBookMetadataFromBook(book: BookWithMedia): BookMetadataPatch?
}
```

`BookMetadataPatch` is **every field nullable with a `null` default**, so "I have no opinion about
this field" is expressible per field — the cleanest treatment of absence in the sweep.

`MetadataApplier.kt` is the entire reconciliation:

```kotlin
private fun <T> getIfNotLocked(original: T, patched: T?, lock: Boolean): T =
  if (patched != null && !lock) patched else original
```

**No ranking, no precedence, no confidence.** For an unlocked field the last provider with a non-null
value wins; for a locked field nothing ever wins. `SeriesMetadata.kt` carries **fourteen** `*Lock`
booleans and `BookMetadata.kt` nine — and three of the series locks (`sharingLabels`, `links`,
`alternateTitles`) have no corresponding field on the patch, so no provider can set them at all.

**The locks are the integration point.** `SeriesMetadataUpdateDto.kt` exposes every `*Lock` as a
writable REST field, which is exactly how Komf writes remote metadata in and stops the next scan
reverting it.

`ComicInfo.kt` is annotated `@JsonIgnoreProperties(ignoreUnknown = true)` and carries 36
`@JsonProperty` fields. `Author(name, role)` has a **free-form lowercased String role**, so
item↔person is typed with an open vocabulary while item↔item is not typed at all.

### Navidrome — eleven small interfaces, and the one real property bag

`core/agents/interfaces.go` declares **eleven** capability interfaces:
`AlbumInfoRetriever`, `AlbumImageRetriever`, `ArtistMBIDRetriever`, `ArtistURLRetriever`,
`ArtistBiographyRetriever`, `ArtistSimilarRetriever`, `ArtistImageRetriever`,
`ArtistTopSongsRetriever`, `SimilarSongsByTrackRetriever`, `SimilarSongsByAlbumRetriever`,
`SimilarSongsByArtistRetriever`. The return types are deliberately small:

```go
type AlbumInfo struct { Name, MBID, Description, URL string }
type Artist        struct { ID, Name, MBID string }
type ExternalImage struct { URL string; Size int }
```

**Optionality is the interface boundary, not a nullable field.** Last.fm implements nine of eleven,
Deezer four. There is no "provider does not support this" sentinel in the data because there is no
data. The error vocabulary is split three ways with care — `ErrNotFound` ("answered and had nothing"),
`*RetryLaterError` (back off), and `errUnsupported` (never ran, so it neither answered nor throttled)
— with a per-agent cooldown map.

Dispatch is a fallback chain, not a merge: `callAgent` walks `conf.Server.Agents` in the user's
configured order and returns the first usable answer.

**The property bag is real and it is scanner-side.** `model/tag.go`:

```go
type TagName string
type RawTags map[string][]string
type Tags map[TagName][]string
```

carried on both `model/mediafile.go` and `model/album.go` as
`Tags Tags \`structs:"tags" json:"tags,omitempty" hash:"ignore"\` // All imported tags from the original file`.

But the key namespace is **closed at runtime and open at configuration time**.
`model/metadata/metadata.go`'s `clean()` iterates the *mapping table*, not the file's tags, so an
unmapped tag is dropped. `resources/mappings.yaml` declares the namespace in two tiers: `main:` (~70
names Navidrome handles directly) and `additional:` (`asin`, `barcode`, `copyright`, `grouping`,
`isrc`, `language`, `license`, `movement`, `recordlabel`, `musicbrainz_discid`, `musicbrainz_workid`,
`releasecountry`, `releasestatus`, `script`, `subtitle`, `website`, `work`, …, described as "available
as fields for smart playlists"). `loadTagMappings()` merges `conf.Server.Tags` over the embedded YAML,
so the **server operator** can extend the namespace; a provider cannot.

Typed relations: `model/participants.go` has `Participants map[Role]ParticipantList` with a **closed
14-member `Role`** (the struct's field is unexported, so it cannot be constructed outside the package)
and an **open `SubRole` string** — that is where `performer:guitar` lives.

Versioning is the most deliberate of the nine. `plugins/capabilities/metadata_agent.yaml` carries
`version: v1-draft` and eleven exports mirroring the Go interfaces one-to-one. Response schemas mark
**every** property `required`, which is only coherent because absence is signalled by not exporting
the function. The source comment states the rule:

```go
// agentErr keeps a plugin fault distinguishable from a definitive miss: a method the plugin
// simply does not implement has answered, so it must not count against a caller's back-off.
```

**No language field exists anywhere** on artist or album; `language` is only an `additional:` file
tag.

### Kavita — the only typed item-to-item relation, and the best translation model

The external path is the paid hosted Kavita+; the provider list is a compiled-in enum
(`MetadataProvider { Hardcover = 2, Mangabaka = 3, ComicBookRoundup = 4 }`) with a hard-coded
per-`LibraryType` allow-list. **There is no interface a third party can implement.**

The typed relation:

```csharp
public sealed record SeriesRelationship {
    [EnumDataType(typeof(RelationKind))] public RelationKind Relation { get; set; }
    ...
}
```

persisted as `SeriesRelation { Id, RelationKind, SeriesId, TargetSeriesId }`, documented as
"Series ---kind---> target". `RelationKind` has 15 members: `Prequel=1, Sequel=2, SpinOff=3,
Adaptation=4, SideStory=5, Character=6, Contains=7, Other=8, AlternativeSetting=9,
AlternativeVersion=10, Doujinshi=11, Parent=12, Edition=13, Annual=14, Cameo=16`.

**The strain is visible in the numbering.** The gap at 15, and `Cameo=16` sitting inside a
`#region MangaBaka Only`, show provider-specific vocabulary being pushed into a shared global enum.
Because the values are numeric, adding a kind is a migration rather than a data change. `Other=8` is
the escape hatch and it is lossy: the original label is not retained.

External ids are one nullable column per source on both `Series` and `Chapter` — `AniListId`,
`MalId`, `HardcoverId`, `MetronId`, `ComicVineId`, `MangaBakaId`, `MangaBakaEditionId`, `CbrId` — with
a matching interface commented "Provides a set of optional (non-API breaking) fields for updating
external metadata ids". The cost is in the migration names: `20260313194040_ExternalMetadataIdsForEntities`,
`20260502195543_MoreExternalMetadataIds`. `ExternalSeriesMetadata.cs` still carries the same ids
marked `[Obsolete("Use Series.AniListId")]` — the id set has already moved house once.

Translations are the best of the nine:

```csharp
/// Every known title, grouped by normalized BCP-47 language tag ("en", "ja", "ja-Latn", "pt-BR", "zh-HK").
/// Each list is ordered best-first, so a client honoring a language preference can take [0] and stop.
/// Empty for providers that do not expose per-language titles.
public Dictionary<string, IList<LocalizedTitleDto>> LocalizedTitles { get; set; } = [];
```

with `LocalizedTitleDto { Title, IsPrimary, IsOfficial }` distinguishing provider-preferred from
licensed-versus-fan. Resolution is a server-configured BCP-47 priority list
(`GlobalLanguageTitleSettings`, default `en` / `ja-Latn`) with per-library overrides that fully
replace rather than prepend.

Kavita is also the only one of the nine with **per-field provenance**: `KPlusOverrides` records which
fields the external provider set, `MetadataSettingsDto.Overrides` is "a list of overrides that will
enable writing to locked fields", and `SeriesMetadataPeople.KavitaPlusConnection` tracks it per
person.

---

## MusicBrainz

The wide source that answers the question by projection rather than by narrowing.

### `inc=`: nothing crosses the wire unless the client names it

`https://musicbrainz.org/doc/MusicBrainz_API`. The default (no `inc`) release lookup returns the
entity's own columns and nothing else — `packaging`, `release-events`, `title`, `disambiguation`,
`asin`, `date`, `quality`, `id`, `packaging-id`, `barcode`, `status-id`, `country`,
`text-representation`, `cover-art-archive`, `status`. **No artist credit, no tracklist, no
relationships, no aliases, no tags.** A default recording lookup is six fields.

Subquery includes are per entity (`artist` takes `recordings`, `releases`, `release-groups`, `works`);
misc includes are `aliases`, `annotation`, `tags`, `ratings`, `genres` and their `user-` variants; and
relationships come through thirteen per-target-type includes (`artist-rels`, `recording-rels`,
`url-rels`, …) plus three depth switches (`recording-level-rels`, `release-group-level-rels`,
`work-level-rels`). Linked entities in a lookup are capped at 25; beyond that a browse request is
required.

The doc is explicit that this is not "give me everything": "keep in mind requesting 'artist-rels' for
an artist, 'release-rels' for a release, etc. will not load all the relationships for the entity, just
the ones to other entities of the same type."

### 697 relationship types, each with a UUID

The vocabulary is organised strictly by ordered entity-type pair, one page per pair, indexed as a
13×13 lower-triangular matrix at `https://musicbrainz.org/relationships`. Fetching all 91 pair pages
and counting the UUID labels gives **697 relationship types**, of which 71 pairs are non-empty, 9 are
marked deprecated, and 42 carry `Description: (none)` and act as grouping parents. No type appears
under two pairs. Largest pairs: artist-release 59, artist-recording 54, artist-url 48, label-url 34.

Each type page publishes forward and reverse link phrases, a long link phrase, a description,
cardinality on both ends, and a **UUID**. The link phrases embed attribute placeholders —
"member of band" is `{additional} {original} {eponymous} member of` — which is how attributes compose
into rendered prose.

The schema is in `admin/sql/CreateTables.sql`: `link` (type + date period + attribute count + `ended`),
`link_type` (`gid UUID`, `entity_type0`, `entity_type1`, three phrases, `is_deprecated`, `has_dates`,
two cardinalities), `link_attribute_type` (a **tree**, with `parent` and `root`), and three opt-in
tables — `link_type_attribute_type` (min/max per type), `link_creditable_attribute_type`, and
`link_text_attribute_type`. "Carries free text" and "is creditable" are modelled as membership of a
table rather than as booleans on the type row.

### What a relationship carries, measured

From `lib/MusicBrainz/Server/WebService/Serializer/JSON/2/Relationship.pm` and confirmed against live
responses:

```json
{"type":"vocal","type-id":"0fdbe3c6-7700-4a31-ae54-b53f06ae1cfa",
 "direction":"backward","begin":"1975-08-24","end":"1975-09-14","ended":true,
 "attributes":["other vocals"],
 "attribute-ids":{"other vocals":"c359be96-620a-435c-bd25-2eb0ce81a22e"},
 "attribute-values":{},
 "attribute-credits":{"other vocals":"operatic vocals"},
 "target-type":"artist","artist":{"name":"Brian May", ...},
 "source-credit":"","target-credit":""}
```

and, with a free-text attribute value, on a series:

```json
{"type":"part of","type-id":"01018437-91d8-36b9-bf89-3f885d53b5bd",
 "direction":"backward","ordering-key":1,
 "attributes":["number"],
 "attribute-ids":{"number":"a59c5830-5ec7-38fe-9a21-c7ea54f6650a"},
 "attribute-values":{"number":"1"},
 "target-type":"release_group","release_group":{...}}
```

`https://musicbrainz.org/relationship-attributes` lists **48 attribute roots**, each with a UUID and a
doc page stating its behaviour — the Instrument attribute's page says "This attribute supports free
text credits" and "The possible values for this attribute can be seen from the instrument list", so
the whole instrument vocabulary is that attribute's child tree.

One asymmetry a client must handle: attribute maps are **keyed by attribute name, not UUID**, so the
UUID is a value in a parallel map rather than the key.

### External ids are relationships to URL entities

`url` is one of the thirteen core entity types, with its own MBID, its own endpoint, and a reverse
lookup `/ws/2/url?resource=<URL>`. **There is no map of id fields on an artist.** Requesting
`inc=url-rels` on Radiohead returns typed edges to URL entities: `allmusic`, `discogs`, `wikidata`,
`VIAF`, `IMDb`, plus catch-alls `other databases` and `social network`.

Consequences visible in the data: the same type repeats (four `streaming` links, one per service); a
provider with no dedicated type falls into `other databases`; and because it is a relationship it
carries `begin`/`end`/`ended`, so a dead official homepage is expressible.

The one exception is standards-body codes, which stay as first-class arrays — a default artist lookup
returns `"ipis": []` and `"isnis": ["0000000115475162"]`, and there are `isrc` / `iswc` endpoints. The
split is: **an identifier that resolves to a web page is a URL relationship; a standards-body code is
a field.**

### Governance and versioning

A third party cannot add a relationship type. `https://musicbrainz.org/doc/Proposals` describes a
three-stage process — request via a tracker ticket, decision by "The Style Leader/BDFL (reosarevok)",
update posted on the blog — and states that "any vote called by the Style Leader will not be binding".
`https://musicbrainz.org/doc/Style_Council` records that the council model ended in October 2014.

The version is a path segment, `/ws/2/`. v1 "was deprecated in 2011… and after running (without
further updates) for several years to avoid breaking any tools using it, it was finally taken down in
2019." The compatibility promise is deliberately weak, quoted whole: **"Do you ever make breaking
changes? We try to avoid that, but sometimes we might need to do so. In those cases, they will be
announced on our blog, so consider following that!"**

### Prose: almost none, by design

`CREATE TABLE artist` has `comment VARCHAR(255)` — the disambiguation comment — and **no description
column**. The two escape hatches are the **annotation** (`id, editor, text, changelog, created` —
note, **no `locale` column**, so it is monolingual, and only the latest is served) and a **Wikidata URL
relationship**, which the style guideline directs editors to prefer over per-language Wikipedia links
because it "serves as a bridge for all languages".

The only per-locale field in the core model is on aliases: `locale` plus `primary_for_locale`. So "the
Japanese name for this artist" is modelled; **"the Japanese description of this artist" is not.**

---

## OpenLibrary

The wide source that answers the question by making the schema data.

### The type is a record, at revision 37, with an edit history

`GET https://openlibrary.org/type/edition.json` returns a document whose `type` is
`{"key": "/type/type"}`, whose `properties` array holds 47 embedded `/type/property` objects, and
whose `revision` is **37**. `?v=1` returns the 2008 original with **30** properties. `?m=history`
returns ordinary edit records with human authors and comments — revision 37 by `/people/hornc`:
*"remove incorrectly added book metadata to prevent further incorrect matches"*, revision 36 by
`/people/horncBot` with action `edit-book`. **A bot import wrote book fields onto the schema page**,
which is the sharpest possible demonstration that schema and data share a table.

The metamodel bottoms out in itself: `/type/type` is a record listing five properties, `/type/property`
one listing three (`name`, `expected_type`, `unique`). A property declaration is just:

```json
{"name":"authors","expected_type":{"key":"/type/author"},
 "type":{"key":"/type/property"},"unique":false}
```

`unique` is the **only** modifier — no cardinality bound, no ordering declaration, no
required/optional flag, no default.

The vocabularies are data too: `https://openlibrary.org/config/edition.json` is a live record at
**revision 957** holding 16 classifications, an identifiers list, and a ~170-entry `roles` vocabulary
("Illustrator", "Translator", "Narrator/Reader", "Cover Photographer", "Librorum Censor", …), read at
runtime by `openlibrary/plugins/upstream/utils.py`.

### Undeclared properties are stored, indexed and served

This is the finding. Comparing live records against their own types:

| record | properties its type does not declare |
|---|---|
| `/books/OL7353617M` | `classifications`, `covers`, `identifiers`, `local_id` |
| `/works/OL45804W` | `genres`, `location` |
| `/authors/OL23919A` | `entity_type`, `fuller_name`, `photos`, `remote_ids`, `source_records` |

`identifiers` and `remote_ids` are OpenLibrary's **entire external-id story**, and neither is in its
type.

The write path, `infogami/infobase/writequery.py`, has exactly two gates — a name regex
(`^[a-z][a-z0-9_]*$`) and a type check **for declared properties only**:

```python
p = self.get_property(type, k)
if p:   d[k] = self.process_value(v, p, prefix=prefix)   # type/unique checked
else:   d[k] = v                                          # stored as-is
```

`_dbstore/save.py` then serialises the whole document into one JSON column, and
`_dbstore/indexer.py` derives the index from the **document**, never consulting the type — so
undeclared properties are fully queryable through `/query.json`.

**Infogami neither rejects nor ignores an undeclared property: it stores it, indexes it and serves it.
The type record is a display and coercion contract, not a validity contract.**

A stricter schema exists and is dead code. `openlibrary/schemata/edition.schema.json` sets
`"additionalProperties": false` and a `required` list, and is *closer to reality* than the Infogami
type — but there is no `jsonschema` import anywhere in the repository and nothing loads those files.
The one validator that runs, `openlibrary/plugins/importapi/import_validator.py`, is a small pydantic
model covering the import API's minimum.

### Three external-id shapes on three entity types

- Editions/works: `identifiers` — scheme → **list** of values (`{"goodreads": ["1507552"],
  "librarything": ["6446"]}`), plus a parallel `classifications` map.
- Authors: `remote_ids` — scheme → **single string** (`{"viaf": "116796842", "wikidata": "Q34660",
  "imdb": "nm0746830", …}`).
- Dedicated fields: `isbn_10`, `isbn_13`, `lccn`, `oclc_numbers`, `ocaid`.

The split is explicit in `openlibrary/plugins/upstream/models.py`, `Edition.set_identifiers`, which
names five fields and routes everything else to the open map. And the open map is **genuinely open**:
`_process_identifiers` falls back to `web.storage(name=name, label=name, url_format=None)` for an
unregistered scheme, so it is stored and rendered, just without a label or a resolvable URL. The
registry is three YAML files in the repo — 83 edition schemes, 20 author schemes, 9 work schemes —
each `{label, name, url, website, notes}`, with the note that "Any changes to /config/{identifier}
page require restarting the app".

### Relations are bare references, with one exception

`"works": [{"key": "/works/OL45804W"}]`, `"authors": [{"key": "/authors/OL34184A"}]`,
`"languages": [{"key": "/languages/eng"}]` — a reference carries nothing but the key.

The exception is `/type/work.authors`, typed as `/type/author_role`:

```json
{"key":"/type/author_role","kind":"embeddable","properties":[
  {"name":"author","expected_type":{"key":"/type/author"},"unique":true},
  {"name":"role","expected_type":{"key":"/type/string"},"unique":true},
  {"name":"as","expected_type":{"key":"/type/string"},"unique":true}]}
```

Structurally the same idea as MusicBrainz's typed relation with a credit — **and largely unused**. On
`/works/OL45804W` both entries are bare `{"author":{"key":"/authors/OL34184A"},"type":{"key":"/type/author_role"}}`,
while the same book's *edition* records the illustrator as an untyped string in `contributions`:
`["Tony Ross (Illustrator)"]`.

There is **no arbitrary typed relation mechanism**. Relation meaning lives in property names —
`translation_of`, `translated_from`, `cover_edition`, `collections` — and adding one means editing the
type record, which anonymous clients cannot do.

### Prose and languages

`/type/text` is canonically `{"type": "/type/text", "value": "…"}`, but **the served data is
inconsistent**: `/works/OL45804W` returns `description` as a bare JSON string despite `/type/work`
declaring it `/type/text`. A client must accept both shapes for every such field.

Prose fields are `description`, `first_sentence`, `notes`, `bio` — all `unique: true`, **one value,
no language tag**. Language handling is thorough for the *work*: `edition.languages`,
`edition.translated_from`, `work.original_languages` are all `/type/language` references with MARC21
three-letter codes. But `edition.translation_of` is a **`/type/string`, not a reference** — live,
`"translation_of": "\"B\" Is for Burglar"` — so the "what this translates" half is a free-text title,
not a link. `work.translated_titles` (`/type/translated_string` = `{language, text}`) is the **only**
per-locale structured field in the model, and it covers titles only.

**OpenLibrary models which language a book is in thoroughly and which language a description is in not
at all.**

### Versioning: silent

`https://openlibrary.org/developers/api` documents rate limits (1 req/s anonymous, 3 req/s with a
User-Agent naming the app and a contact email) and asks that clients cache. **It says nothing about
versions, deprecation windows, or breaking-change policy**, and no documented endpoint carries a
version segment. The only deprecation language is informal, on the Books API page: "Please consider
using the Book Search API above; this is a legacy endpoint and may be phased out in the future."

What *is* versioned is every record: `revision` / `latest_revision`, `?v=<n>`, `?m=history`. That lets
you pin a record, not a schema.

---

## The standards

### schema.org

Current release V30.1, dated 2026-09-16; "826 Types, 1540 Properties 19 Datatypes, 96 Enumerations and
544 Enumeration members" (`https://schema.org/docs/schemas.html`).

The authoritative statement is the **"Extensibility Mechanisms"** section of
`https://schema.org/docs/howwework.html`, not `extension.html`:

> Schema.org provides the PropertyValue which can be used to expose arbitrary property/value data
> pairs within a larger schema.org description. This is used e.g. on e-commerce sites to expose
> key/value information that does not map easily into schema.org terminology.
>
> Schema.org provides the Role mechanism which allows any piece of schema.org to be arbitrarily
> annotated with extra information.
>
> […] no community approval, agreement or steering group consensus is needed to make use of these
> mechanisms.

**That last clause is the design point: the property bag and the role annotation sit deliberately
outside the release process.**

`https://schema.org/PropertyValue` — "A property-value pair, e.g. representing a feature of a product
or place. Use the 'name' property for the name of the property." Its properties: `name`, `value`,
**`propertyID`** ("A commonly used identifier for the characteristic represented by the property, e.g.
a manufacturer or a standard code for a property"), `unitCode`, `unitText`, `valueReference`,
`minValue`/`maxValue`, `measurementTechnique`/`measurementMethod`, `valueGroup` (new in V30.1).
**The bag key is a `propertyID`, not a bare string.**

`additionalProperty` (`https://schema.org/additionalProperty`) is the slot it hangs off — "another
characteristic for which there is no matching property in schema.org" — but its **domain is narrow**:
MerchantReturnPolicy, Offer, Place, Product, QualitativeValue, QuantitativeValue. It is not on `Thing`
and not on `CreativeWork`. schema.org's property bag was designed for commerce.

`identifier` (`https://schema.org/identifier`) accepts `PropertyValue`, `Text` or `URL` on `Thing`.
`https://schema.org/docs/datamodel.html` is candid about the gap: "In the most complex case, there is
sometimes a need to represent the type of an identifier. In this case, a PropertyValue pair ('name',
'identifier') pair can be used… **We do not currently have a recommended identifier scheme for
identifier schemes**, but in most cases there is a conventional short name."

**`Role`** (`https://schema.org/Role`) — "Represents additional information about a relationship or
property… Such properties can be attached to a Role entity, which is then associated with the main
entities using ordinary properties like 'member' or 'actor'." Its own properties are `roleName`,
`startDate`, `endDate`. The pattern, from schema.org's own example, is that the property appears
**twice** — once pointing at the Role, once inside it pointing at the real target:

```json
{"@type": "Organization", "name": "Cryptography Users",
 "member": {"@type": "OrganizationRole",
            "member": {"@type": "Person", "name": "Alice"},
            "startDate": "1977"}}
```

so a consumer that does not understand Role can still find the target by following `member` twice.

**Nothing is required, and this is stated three ways.** The `meta` section contains exactly six terms
(`Class`, `Property`, `domainIncludes`, `inverseOf`, `rangeIncludes`, `supersededBy`) — no
`minCardinality`, no `required`. The Conformance section says schema.org "take[s] a pragmatic view of
conformance", that validators "are not obliged to treat unexpected structures as errors", and that
**"The type/properties associations of schema.org are closer to 'guidelines' than to formal rules"**.
The FAQ: "It is fine to mark up only some properties of an item - markup is not an all-or-nothing
choice."

Versioning: "**It is exceptionally rare for a property, type or enumerated value to be
deleted/removed without leaving it in the system as 'supersededBy' another**," and "Consumers of
schema.org data can generally rely on schema.org term meanings not changing dramatically." Retired
terms go to the **attic**, which "may be updated at any time without the need for a full release".
Publishers are encouraged to use unversioned URLs; `schemaVersion` exists for documents that need to
pin.

**Correction to a common belief: there is no schema.org "/terms" external-vocabulary mechanism.**
`schema.org/docs/terms.html` is the legal Terms and Conditions page. What does exist is the JSON-LD
context — 3,103 entries with `"@vocab": "http://schema.org/"` and pre-declared prefixes including
`dc`, `dct`, `skos`, `foaf`, `owl`, `bibo`, `gs1` — so a publisher writes `"dct:provenance": "…"`
beside `"name": "…"` and both are globally identified.

### Dublin Core

DCMI Metadata Terms (`https://www.dublincore.org/specifications/dublin-core/dcmi-terms/`), DCMI
Recommendation, issued 2020-01-20. Fifteen core elements in `/elements/1.1/`; **55 properties** in
`/terms/`, plus 9 Vocabulary Encoding Schemes, 12 Syntax Encoding Schemes, 22 Classes and the
12-member DCMI Type Vocabulary.

**The dumb-down principle**, from DCMI Qualifiers (2000-07-11),
`https://www.dublincore.org/specifications/dublin-core/dcmes-qualifiers/`, verbatim:

> The guiding principle for the qualification of Dublin Core™ elements, colloquially known as the
> Dumb-Down Principle, is that a client should be able to ignore any qualifier and use the description
> as if it were unqualified. While this may result in some loss of specificity, the remaining element
> value (without the qualifier) should continue to be generally correct and useful for discovery.

**And it has since been superseded in practice — this matters and is easy to miss.** DCMI's own
glossary, `https://www.dublincore.org/resources/glossary/dumb-down_principle/`:

> This notion of Dumb-Down faded as the Dublin Core™ community shifted to an RDF-based interpretation
> of qualifiers, such that `http://purl.org/dc/terms/alternative`, for example, actually meant
> "alternative title" and not just "alternative"… **Such a sub-property could be resolved to its
> better-known superproperty… (in the spirit of Dumb-Down), but it could not simply be ignored.**

So the modern mechanism for a narrow consumer reading a wide source is **`rdfs:subPropertyOf`
walking**, not qualifier-stripping. A specific property is read by climbing to a superproperty you do
know. Ignoring is not safe; resolving upward is.

Nothing is required in DC itself: "**Each Dublin Core™ element is optional and repeatable, and there
is no defined order of elements**" (`https://www.dublincore.org/specifications/dublin-core/usageguide/`).

**Obligation lives in a profile, not in the vocabulary.** DCTAP
(`https://www.dublincore.org/specifications/dctap/elements/`, December 2022, **status: Draft - Request
for Comments**, not a Recommendation) defines twelve columns, of which the load-bearing ones are:

- `propertyID` (cardinality **one**) — "An IRI or literal that identifies the property."
- `mandatory` — "Indicates whether or not the metadata must contain a statement that is consistent
  with this statement template."
- `repeatable`, `valueNodeType` ("IRI", "literal", "bnode"), `valueDataType`, `valueShape`,
  `valueConstraint`, `valueConstraintType` ("picklist", "IRIstem", "pattern", "languageTag",
  "minLength", "maxLength", "minInclusive", "maxInclusive"), `note`.

The profile is a CSV, with `dctap-python` plus TAP-to-SHACL and TAP-to-ShEx converters shipped. The
Singapore Framework states the separation: "**the semantics of the terms used in application profiles
is carried by their definitions, which are independent of any application profile.** Semantic
interoperability is addressed outside of the realm of application profiles."

### BIBFRAME

Current version **3.0.1, issued 2025-12-03**, from the `owl:Ontology` header of
`https://id.loc.gov/ontologies/bibframe.rdf` (`owl:versionInfo 3.0.1`, `owl:versionIRI`,
`owl:priorVersion`). 455 terms carry `rdf:about` IRIs.

Work / Instance / Item, linked by `bf:hasInstance`/`bf:instanceOf` and `bf:hasItem`/`bf:itemOf`, each
declared `rdfs:subPropertyOf bf:relatedTo`.

**`bf:relatedTo`** is the symmetric root — "Any relationship between Work, Instance, Item, and Event
resources" — with 23 subproperties. The **reified** form was added 2022-2024 under GitHub issue GH116,
as four terms:

- `bf:relation` (object property, range `bf:Relation`) — "Associated resource and its relationship to
  the resource being described"
- `bf:Relation` (class, new 2024-07-10)
- `bf:relationship` (domain `bf:Relation`, range `bf:Relationship`) — "Type of relationship between
  resources"
- `bf:Relationship` (class) and `bf:associatedResource` (domain `bf:Relation`)

So the shape is `<Work> bf:relation [ a bf:Relation ; bf:relationship <a Relationship instance> ;
bf:associatedResource <the other Work> ; bf:note [...] ]`. **Note the split: `bf:relationship` is the
property, `bf:Relationship` is the class of relationship types — the type is a looked-up resource, not
a string.** The same pattern exists, older, for agents: `bf:contribution` → `bf:Contribution` carrying
`bf:agent` and `bf:role` → `bf:Role`, where `bf:role` was "Changed from data to object property" on
2017-02-03.

**Identifiers are reified, and the inversion is stated outright.** From the BIBFRAME 2.0 "What's New"
page: "**Remodeling of identifiers.** … identifier types are distinguished by class rather than
property. (1.0 had many identifier properties and a single identifier class. 2.0 has a single
identifier property and many identifier classes.)" There are **48 subclasses of `bf:Identifier`** —
Isbn, Issn, Doi, Lccn, OclcNumber, Ean, Eidr, Isan, Isni, Isrc, Iswc, Upc, Urn, `Local`, … — plus
`bf:source`, scoped as "source within which an identifier is unique". That is the exact opposite of a
field per provider.

**On backward compatibility LoC is silent.** No published deprecation policy, no `owl:deprecated`
usage, no equivalent of schema.org's `supersededBy` promise. Change is recorded per term as dated
`dcterms:modified` strings with GitHub issue references, e.g. `bf:source`: `2016-04-21 (New)`,
`2021-06-09 (Broadened range [GH63])`, `2025-01-23 (Ontological correction … [GH121])`,
`2025-07-09 (Expected value fix [GH132])`. Terms appear to be revised in place; the record of the
revision is that trail.

### RDF, and the property-bag designs

**A property is a URI, and no schema change is needed to carry a new one.** RDF 1.1 Concepts
(`https://www.w3.org/TR/rdf11-concepts/`, W3C Recommendation 25 February 2014) §1.4: "An RDF
vocabulary is a collection of IRIs intended for use in RDF graphs… **Namespace IRIs and namespace
prefixes are not a formal part of the RDF data model. They are merely a syntactic convenience for
abbreviating IRIs.**" A vocabulary is not a schema you install; it is a set of IRIs someone published.

**Classic reification is weak and the spec says so.** RDF Schema 1.1 §5.3 is explicitly marked "This
section is non-normative", and states: "The 2004 RDF specification did not assign a normative formal
semantics to this vocabulary." Four triples to describe one, no defined semantics, and explicitly no
identity ("Different individual `rdf:Statement` instances may have the same values for their
`rdf:predicate`, `rdf:subject` and `rdf:object` properties").

**RDF 1.2 / RDF-star status as of 2026-09-21: Candidate Recommendation Snapshot, 07 April 2026 — not
a Recommendation.** `https://www.w3.org/TR/rdf12-concepts/` carries "This Candidate Recommendation is
not expected to advance to Recommendation any earlier than 05 May 2026", and more than four months
past that date it still serves the April snapshot. The concrete syntax is further behind: **RDF 1.2
Turtle is a W3C Working Draft dated 14 September 2026**, one week old. The working group
(`https://www.w3.org/groups/wg/rdf-star/`, now "RDF & SPARQL Working Group") is chartered to
30 April 2027.

The mechanism: the triple definition becomes recursive, so a triple can be the object of another
triple (a **triple term**). A **reifying triple** has predicate `rdf:reifies` and a triple term as
object; its subject is a **reifier**. The spec's own framing is the interesting part:

> By using non-asserted triple terms… one can make statements about unasserted statements; for
> example, if one is unsure whether :Alice's family name is actually "Liddell".
>
> **There can be multiple, distinct reifiers related to the same abstract proposition, such as
> statements with different sources, or situations with different characteristics.**
>
> Because of this diversity, **the meaning of the `rdf:reifies` property is deliberately generic.**

Turtle syntax is `<<( s p o )>>` for a triple term and the `{| ... |}` annotation block:

```turtle
<#spiderman> foaf:name "Spiderman",
   "الرجل العنكبوت"@ar--rtl {| dct:source <https://www.wikidata.org/> |} .
```

**Named graphs are the standards answer to multiple sources disagreeing — with a caveat the spec is
explicit about.** RDF 1.1 Concepts §4 defines an RDF dataset as one default graph plus zero or more
named graphs, motivated in §1.6: "it is sometimes desirable to work with multiple RDF graphs while
keeping their contents separate… One such use is to hold snapshots of multiple RDF sources." But:

> **Despite the use of the word "name" in "named graph", the graph name is not required to denote the
> graph. It is merely syntactically paired with the graph. RDF does not place any formal restrictions
> on what resource the graph name may denote, nor on the relationship between that resource and the
> graph.**

So "each source's statements go in that source's graph" is an application convention that RDF supports
mechanically and declines to give semantics to.

**SHACL is the standards answer to required-versus-optional.** W3C Recommendation 20 July 2017,
`https://www.w3.org/TR/shacl/`. The separation is in the abstract: a **shapes graph** validates a
**data graph**, and shapes "can also be viewed as a description of the data graphs that do satisfy
these conditions". `sh:minCount` — "**TEXTUAL DEFINITION: If the number of value nodes is less than
$minCount, there is a validation result**"; `sh:maxCount` the mirror; both are **property-shape-only**
("Node shapes cannot have any value for `sh:minCount`"). `sh:closed` plus `sh:ignoredProperties` is
the opt-in switch that shuts the open world for one shape; absent it, a data graph may carry any
property at all and still validate. **The vocabulary stays permissive and stable; a separate shapes
graph, owned and versioned by the consumer, says what that consumer needs.**

**JSON-LD's cost, quoted exactly** (`https://www.w3.org/TR/json-ld11/`, W3C Recommendation 16 July
2020):

> JSON-LD documents MAY contain data that cannot be represented by the data model defined above.
> Unless otherwise specified, **such data is ignored when a JSON-LD document is being processed. One
> result of this rule is that properties which are not mapped to an IRI, a blank node, or keyword will
> be ignored.**

A key the context does not define **vanishes silently on expansion** — no error, no warning. The two
escape hatches are `@vocab` (unmapped keys expand against a default vocabulary instead of being
dropped) and setting a term explicitly to `null` to opt back out.

**And the escape hatch has its own cost.** schema.org's published context sets
`"@vocab": "http://schema.org/"`, so in a document using it an unrecognised key is not dropped — it
silently expands to `http://schema.org/<key>`, minting a schema.org IRI for a term schema.org never
defined. **Any design leaning on `@vocab` to avoid silent loss trades it for silent
misattribution.**

**Wikidata is the strongest working example**, `https://www.mediawiki.org/wiki/Wikibase/DataModel`
(self-described as "a living document… not a specification of any concrete binding, implementation,
mapping, or serialization"). A **Snak** is the atomic assertion and comes in three kinds:
`PropertyValueSnak`, `PropertyNoValueSnak` ("we want to emphasize that a property value has not just
been left out (or not entered yet) but that it really does not exist"), and `PropertySomeValueSnak`
("if the value of a property is unknown"). **Unknown, none and not-yet-entered are three different
states, not one null.**

A **Statement** is `subject + mainSnak + rank + referenceRecords + qualifierSnaks`. The documented
example is directly on point:

> "Harry Potter and the Philosopher's Stone was starring Emma Watson in the role of Hermione Granger":
> mainSnak with property "starring" and value "Emma Watson"; **qualifier Snak with property "played
> character", and value "Hermione Granger"**

Qualifiers are not a string-keyed side bag — they are the same `Property → Value` machinery applied to
the statement instead of the entity, and "**Properties are defined by users, so any Property can be
created.**" A **ReferenceRecord** is "a set of Snaks" carrying provenance on the statement.
**Rank** is Preferred / Normal / Deprecated, and the doc is explicit that a preferred statement may be
multiple and may indicate "a disagreement (diverging population figures given by different sources)",
while a deprecated statement "is not wrong — the historic document that is given as a reference really
made the erroneous claim — yet the statement should not be used in most cases".

**Wikidata does not resolve conflicts. It stores them all, attaches a source to each, and ranks them
so a consumer can pick one.** The model is also deliberately loose about typing: "it is not required
that Value belongs to the Datatype that is currently given to the Property in the system… **This is
the main reason for not limiting the data model to strictly typed Properties.**"

---

## Synthesis

### The dominant pattern

**A closed, flat DTO with one open extension point, and the extension point is always the id
namespace.** Every catalogue surveyed does this. The DTO is the consumer's own model, not a negotiated
interchange format, and a provider's job is to fill it. Jellyfin makes this literal by typing the
return as `BaseItem`; Kodi makes it literal by running scraper output through the same parser as NFO
files; Plex legacy makes it literal by declaring the model in shipped templates a plug-in imports.

Three consequences follow, and all three are visible in the field:

**The id map becomes the pressure valve, and it leaks.** calibre's Goodreads plugin declares
`identifier:grrating` and `identifier:grvotes` — a rating and a vote count inside the id map, because
nothing else is open. Kodi's wiki suggests using `<uniqueid>` for "non-scraped items… simple values
like 'home', 'sport', 'doco'". Plex staff confirm custom `Guid[]` schemes "if providers understand
them". The id map is the only place a provider can put something the contract did not anticipate, so
that is where non-identifier data goes.

**The record becomes a chimera with no provenance.** Jellyfin merges per field, first non-empty wins,
and `MergeBaseItemData` never copies `Provider` to the target, so a finished record cannot say where
any value came from. calibre merges per field with per-field heuristics (shortest title, longest
comments, averaged rating) and the result belongs to no source. Komga's `getIfNotLocked` is last-write-wins
per field. Of the nine contracts, **only Kavita records which fields an external provider set**.

**Language ends up outside the field, and then gets patched back in by hand.** Jellyfin puts language
on the result, then writes bespoke fallback logic for exactly `Overview` and `Tagline` — nulling a
held value so the first-non-empty rule lets a right-language one through — while the other 59
properties get nothing. Kodi has no `lang` attribute anywhere in the tag. Plex legacy made language
part of the **GUID**, so a translation is a different record entirely; modern Plex made it a request
**header**, so an item never holds two. Navidrome has no language field at all. Only Kavita models it
in the data, as `Dictionary<BCP-47, IList<LocalizedTitleDto>>` — and only for titles.

### The real dissent

**Not property bags. Nobody in the catalogue half has one at the provider boundary.** Navidrome's
`Tags map[TagName][]string` is the closest thing and it belongs to the *file scanner*; `clean()`
iterates the mapping table rather than the file's tags, so an unmapped key is dropped, and the
namespace is extended by the **server operator** in `conf.Server.Tags`, never by a provider. calibre's
`__setattr__` will take an arbitrary attribute under the comment "Don't abuse this privilege" — and
`SERIALIZABLE_FIELDS` excludes it, so it never persists.

The genuine dissent is **about the shape of the unit**, and there are three positions:

**1. Many small interfaces instead of one fat DTO (Navidrome).** Eleven capability interfaces, each
returning a three-to-eight-field struct. Optionality is the interface boundary, so there are no
nullable "provider does not support this" fields and no convention to document. Last.fm implements
nine, Deezer four, and the contract does not notice. It survives the jump out of process unchanged,
because "did not export this function" is the same signal as "does not implement this interface", and
the WASM schema can therefore mark **every** response property `required`.

**2. Closed vocabulary, open projection (MusicBrainz).** The vocabulary is closed, governed and
UUID-addressed — 697 relationship types, 48 attribute roots, a BDFL and a ticket queue. What is open is
the *response*: `inc=` means a client with a narrow model asks for exactly the slice it models and the
default is the entity's own row and nothing else. The wide schema costs a narrow client nothing
because the client never sees it.

**3. The schema is data (OpenLibrary).** `/type/edition` is a record at revision 37 with a human edit
history, and an undeclared property is stored, indexed and served. The type is a display and coercion
contract, not a validity contract — and the live data has drifted meaningfully past it, with
`identifiers` and `remote_ids`, the entire external-id story, absent from the types that carry them.

**On required-versus-optional there is one clear outlier and it is recent.** Modern Plex, published
2025-12-09, is the only contract in the sweep with a per-field `Required` column on the wire. calibre
is the only one where a provider *declares* what it can supply, via `touched_fields` — and that
declaration does real work at merge time, since the union of every contributing plugin's
`touched_fields` decides which fields get merged at all. Everywhere else the answer is "everything is
nullable and nothing is declared", and Komga is the only one that makes `null` mean something
deliberate ("no opinion", distinct from "empty").

**And the standards answered all of this a decade or more ago, with a consistent shape no catalogue
has adopted.** The property becomes a value rather than a column — a `propertyID`, a user-created
Wikidata Property, a bare IRI. The relation becomes a node — `Role`, `bf:Relation`, `bf:Contribution`,
a Wikidata Statement, an RDF-star reifier — reached by a property and carrying a type and its own
attributes. The external id becomes a reified pair — `PropertyValue(propertyID, value)`, or one
`bf:identifiedBy` property with 48 `bf:Identifier` subclasses, LoC having *inverted* the field-per-scheme
design deliberately in BIBFRAME 2.0. And obligation lives outside the vocabulary entirely, in a DCTAP
row or a SHACL property shape the consumer owns and versions.

### What each design costs

**The closed DTO** costs everything the source holds that the DTO does not name, silently. Kodi's
`ParseNative` drops an unknown element with **no log line at all**. Audiobookshelf's destructuring
whitelist discards unknown keys without telling the provider, and its own built-in Audible provider
returns three fields (`region`, `rating`, `abridged`) the third-party schema has no slot for. Jellyfin
drops an id whose key has a validator and whose value fails it, logging it but not telling the
provider. The provider cannot detect the loss, so the contract's bottleneck is invisible from the
outside.

**The one system that makes the loss visible is legacy Plex, and it does so by throwing.**
`Framework/modelling/objects.py` raises `FrameworkException("Object of type '%s' has no attribute
named '%s'")` on an undeclared attribute. That is the opposite trade: a provider learns immediately,
and cannot ship a field ahead of the contract at all.

**The field-per-source id design** costs a migration per source and a house move eventually. Kavita
has `AniListId`, `MalId`, `HardcoverId`, `MetronId`, `ComicVineId`, `MangaBakaId`,
`MangaBakaEditionId`, `CbrId`, two migrations named for the pain
(`ExternalMetadataIdsForEntities`, `MoreExternalMetadataIds`), and an `ExternalSeriesMetadata` class
still carrying the same ids marked `[Obsolete("Use Series.AniListId")]`.

**The open id map** costs validation and provenance. Jellyfin polices eleven known keys and silently
deletes what fails; an unknown key is unpoliced. calibre's merge is a plain `identifiers.update()`, so
the last result in group order wins per scheme with nothing recorded.

**The closed relation enum** costs a migration per relation kind and turns provider-specific
vocabulary into shared global vocabulary. Kavita's `RelationKind` has a gap at 15 and a
`#region MangaBaka Only` around `Cameo=16`, with `Other=8` as a lossy escape hatch that does not
retain the original label. Jellyfin's `PersonKind` is 26 values and a free-text `Role` beside it.
Navidrome's `Role` is 14 values with an open `SubRole` string. **The free-text escape hatch always
appears, and it always has no identity.**

**Relation-by-name** costs you the edge when the name does not resolve. Kodi's `<showlink>` matches by
**title**, at write time, against whatever is already in the database, and logs a warning and drops
the edge when the show is absent.

**Many small interfaces** cost round trips and thinness. "Give me everything about this artist" is
eleven calls in Navidrome, and `AlbumInfo` at four fields is thinner than any other product's album
shape.

**Projection (`inc=`)** costs the client a decision it must get right, and it caps out: MusicBrainz
limits linked entities in a lookup to 25 and pushes you to a browse request beyond that. It also means
the default response is nearly useless on its own — six fields for a recording.

**Schema-as-data** costs enforcement. OpenLibrary's types and its live data have diverged; its own
stricter JSON Schemas exist in the repo and nothing loads them; and even `/type/text` is served
inconsistently, sometimes as `{type, value}` and sometimes as a bare string, so a client must accept
both shapes for every prose field.

**The property bag as a standard** costs silent loss or silent misattribution, and JSON-LD documents
both. An unmapped key is **ignored** on expansion with no error; set `@vocab` to stop that and an
unrecognised key silently expands into a namespace that never defined it. Dublin Core's answer —
climb to the superproperty — is safer but requires the consumer to hold the vocabulary's hierarchy,
and DCMI itself records that the simpler "just ignore the qualifier" reading **no longer holds** under
the RDF interpretation.

**Reified relations** cost a standards-track dependency that is still moving. RDF 1.2 Concepts has sat
in Candidate Recommendation since 07 April 2026, past its own earliest-advance date of 05 May 2026,
and RDF 1.2 Turtle is a Working Draft one week old at the time of writing.

**Locks** — the convergent answer to disagreeing sources in the smaller servers, 23 booleans in Komga
and 19-plus per entity in Kavita — cost you reconciliation entirely. Neither ranks sources nor merges;
both let a user freeze a field forever. Komga has three locks (`sharingLabels`, `links`,
`alternateTitles`) whose fields no provider can set at all.

---

## Where the sources are silent

- **Jellyfin** documents no rule about what a provider must return; its user docs do not mention how
  sources are combined or that field locking exists, and name three providers as the complete set
  where the source names sixteen.
- **Kodi** documents no required fields for a `<details>` document, and no XSD or DTD exists for it or
  for NFO files — verified by enumerating every `.xsd`/`.dtd` in the repository. No version or
  capability negotiation distinguishes an XML scraper from a Python one; it is the file extension.
- **Plex**: `support.plex.tv` has no article on the modern provider system at all. There is no
  published JSON Schema for the provider response — `openapi.json`, `spec.json`, `swagger.json` and
  `openapi.yaml` all 404, and the OpenAPI embedded in the portal describes PMS's own API, not what a
  provider must return. Legacy agent removal is announced nowhere; they are hidden behind a setting.
- **calibre** documents no source priority for `identify` and no rule about what a source must return.
- **Audiobookshelf**'s spec is at `info.version: 0.1.0` and the code has drifted past it; there is no
  custom-provider path for podcasts, stated in `CustomMetadataProvider.js` as "Currently only
  available for 'book' media type".
- **schema.org** publishes no identifier-scheme registry, by its own admission, and no formal
  compatibility guarantee — "exceptionally rare" and "can generally rely on… not changing
  dramatically" are the strongest words used. There is no "/terms" external-vocabulary mechanism;
  that page is legal boilerplate.
- **BIBFRAME**: LoC publishes no deprecation or compatibility policy. Versions are distinguished by
  `owl:versionIRI`; nothing says what a consumer may rely on across them.
- **OpenLibrary** publishes **no API version and no compatibility promise**. Records are versioned;
  the interface is not.
- **RDF** explicitly declines to say what a named-graph name denotes, so source attribution by graph
  is a convention the standard supports and does not define. Classic reification has no normative
  semantics, stated in the section that defines it.
- **DCTAP** is a Draft - Request for Comments, not a Recommendation.

---

## Method and sourcing

Read 2026-09-21 by one coordinator and five parallel agents, against source at `master` and against
the standards bodies' own servers. Jellyfin was read at `jellyfin/jellyfin` `master`; Kodi at
`xbmc/xbmc` commit `0e06579f`; OpenLibrary at `internetarchive/openlibrary` `88b03b5b` and
`internetarchive/infogami` `7cb5b9e0`.

Three fetch obstacles, recorded so the next pass does not repeat them:

- **loc.gov returns 403 to everything** from this environment (a Cloudflare challenge, not a missing
  page). `id.loc.gov` was reached directly for the BIBFRAME ontology; the two `www.loc.gov/bibframe/docs/`
  prose pages came from the Internet Archive's capture of 2026-07-27 and are labelled as such above.
  This matches the existing note in `docs/research/README.md`.
- **kodi.wiki is behind Cloudflare.** Its pages were read through its own MediaWiki API
  (`https://kodi.wiki/api.php?action=parse&page=<Page>&prop=wikitext`), which returns page source
  verbatim.
- **Plex support articles** need plain `curl`, not WebFetch, per the recipe already in
  `docs/research/README.md`. The legacy `dev.plexapp.com` framework docs are dead and were read from
  the shipped framework source (`Framework/api/*.pym`, `Framework/modelling/model.py`) rather than
  from the archive, which is stronger evidence than the docs were.

One received premise was falsified by measurement and is corrected in the body rather than beneath it:
**Plex has not closed its provider interface.** It published a public HTTP provider contract on
2025-12-09 with an official reference implementation at `plexinc/tmdb-example-provider`, and legacy
agents are hidden behind a setting rather than removed as of PMS 1.43.4.10903-e5521bd8c (2026-08-17).

Two secondary-source caveats. `python-plexapi` (v4.18.2) is third-party, but it is a published
interface definition reflecting Plex's own API and is cited only for attribute lists, which were
cross-checked against the contract docs. The Plex developer forum thread is cited twice, both times
for posts carrying the `staff` flag, which is exposed by appending `.json` to a topic URL.
