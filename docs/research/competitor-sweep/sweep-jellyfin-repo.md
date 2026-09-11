# Jellyfin source-code sweep — capabilities absent from the CanonCore prompt

STATUS: complete

Gap-finding exercise against the Jellyfin **source code** (not the docs, not the prompt's
claims — another agent verifies those). Every capability found in the code is classified
against CanonCore's prompt:

- **ADOPTED** — the prompt already specifies this.
- **REFUSED** — the prompt explicitly rules it out (WHAT NOT TO BUILD / STANDING RULES).
- **DIVERGENT** — the prompt does something deliberately different.
- **ABSENT** — the prompt says nothing. Rated LOW / MEDIUM / HIGH on whether a
  self-hosted media catalogue genuinely needs it.

The ABSENT+HIGH list at the end is the point of the document.

Swept version/commit: pinned in the provenance table below — `jellyfin/jellyfin` @ `66d038c4034b9e07a4ac39822e4f0080e9a2201a`.

---

## Sweep provenance

| What | Value |
|---|---|
| `jellyfin/jellyfin` (C# server) | `master` @ **`66d038c4034b9e07a4ac39822e4f0080e9a2201a`**, committed 2026-09-06 |
| Assembly version in that tree | **12.0.0** (`SharedVersion.cs`) — i.e. the v12 line, pre-release (`v12.0-rc7` is the newest tag) |
| Latest *stable* release | v10.11.11, 2026-06-06 |
| `jellyfin/jellyfin-web` | `master` @ **`a1c2e13286103953b417966f1c5cc75ddefdecbc`**, 2026-09-06 |
| OpenAPI spec | `openapi.json` served by that build, `info.version` = `12.0.0` |

Permalink form used throughout:
`https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/<path>`

**Why v12 matters for this sweep.** v12 is the release where Jellyfin replaced its hand-rolled
SQLite `library.db` with an EF Core entity model and pluggable database providers. So the entity
model in section 3 is Jellyfin's *considered* schema, not its legacy one — it is the fairest
possible comparison against CanonCore's ten tables.

---

## 1. THE SERVER CONFIGURATION SURFACE

Every option below is a decision Jellyfin was forced into by real deployments. The unit of
analysis is "what question does this option answer", not "should CanonCore have this knob".

### 1.1 `ServerConfiguration` — the global server settings

[`MediaBrowser.Model/Configuration/ServerConfiguration.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/ServerConfiguration.cs)

| Option | What it controls | Classification |
|---|---|---|
| `EnableMetrics` (L70) | Exposes a Prometheus `/metrics` endpoint. | **ABSENT — LOW.** Nice for a fleet; a single-owner instance has no scrape target. |
| `IsPortAuthorized`, `QuickConnectAvailable` (L78, L83) | Quick Connect = pair a TV by typing a 6-digit code instead of a password on a remote. | **ABSENT — MEDIUM.** The prompt ships a TV app and a single password; typing a password on a tvOS focus-engine keyboard is the exact pain Quick Connect exists to remove. |
| `EnableCaseSensitiveItemIds` (L89) | Whether item GUIDs are derived case-sensitively from paths. | DIVERGENT — CanonCore mints surrogate ids, so path-derived identity does not arise. |
| `MetadataPath` (L97) | Where downloaded metadata/images are cached on disk. | **ABSENT — MEDIUM.** CanonCore's artwork table stores a provider URL; nothing in the prompt says whether images are proxied/cached locally or hot-linked, and hot-linking a TMDB CDN from a TV app is a real availability decision. |
| `PreferredMetadataLanguage`, `MetadataCountryCode` (L103, L109) | Which language/region to request from providers; also the fallback when a library does not override. | **ABSENT — HIGH.** See §1.7. |
| `SortReplaceCharacters`, `SortRemoveCharacters`, `SortRemoveWords` (L115–L127) | How `sort_name` is *derived* when nobody supplied one: strip `.`/`+`/`%`, drop `,&-{}'`, drop leading "the/a/an". | **ABSENT — MEDIUM.** CanonCore has `sort_name` as a column but says nothing about who fills it. Defaults matter: a catalogue where "The Empty Child" files under T is visibly wrong, and the article list is language-specific. |
| `MinResumePct` = 5, `MaxResumePct` = 90, `MinResumeDurationSeconds` = 300 (L133–L145) | Playstate thresholds for video. | DIVERGENT (deliberate) — the prompt replaces percentage with *time remaining*, keeps the 5-minute force-complete floor. Note Jellyfin's `MinResumePct`: below 5% it does not save a position at all, which CanonCore has no equivalent of. **The "don't save a position at all near the start" rule is ABSENT — LOW.** |
| `MinAudiobookResume` = 5, `MaxAudiobookResume` = 5 (L151, L157) | Separate, *minute-based* thresholds for books, because percentage is useless on a 30-hour audiobook. | **ABSENT — MEDIUM.** The prompt's "time remaining under a small absolute figure" already generalises this, but it specifies ONE number for all media. Jellyfin needed a per-medium number. A 10-second threshold for a 25-minute episode and for a 30-hour audiobook are not the same product decision. |
| `InactiveSessionThreshold` (L164) | Auto-close a playback session that has stopped reporting, 0 = disabled. | **ABSENT — MEDIUM.** Without this, a TV that loses power leaves a session pinned forever and "currently watching" lies. |
| `LibraryMonitorDelay` = 60 (L172) | Debounce after a filesystem event before scanning, because file creation is not atomic. | **ABSENT — HIGH.** The prompt says "do not assume filesystem change notifications fire" and mandates periodic scans, but says nothing about debouncing the ones that *do*. A copy-in-progress file scanned at 3 bytes is the classic scanner bug. |
| `LibraryUpdateDuration` = 30 (L178) | Coalescing window before firing a "library changed" notification to clients. | **ABSENT — LOW.** |
| `CacheSize` = `ProcessorCount * 100` (L183) | In-memory item cache size. | **ABSENT — LOW.** |
| `ImageSavingConvention` (L189) | Legacy vs Compatible on-disk image naming. | REFUSED-adjacent — no artwork scanning/writing in CanonCore. |
| `MetadataOptions[]` (L191) | Per-item-type provider ordering; see §1.3. | Partly DIVERGENT, see §1.3. |
| `ServerName` (L195) | The instance's display name, distinct from the machine hostname. | **ABSENT — MEDIUM.** A self-hosted instance that shows up in a client's server list needs a name the owner chose. |
| `UICulture` = "en-US" (L197) | UI language, separate from metadata language. | **ABSENT — MEDIUM.** The *separation* is the insight: which language the chrome is in and which language you want synopses in are independent settings. |
| `SaveMetadataHidden` (L199) | Whether sidecar files are written with the hidden attribute. | REFUSED — no `.nfo` writing. |
| `ContentTypes` (L201) | Per-path override of what kind of content lives there. | **ABSENT — MEDIUM.** CanonCore's scanner needs *some* answer to "what is this folder", and the prompt's groups scope scanner roots but do not type them. |
| `RemoteClientBitrateLimit` (L203) | Cap for off-LAN clients. | REFUSED — no transcoding, so no bitrate ladder. |
| `EnableFolderView` (L205) | Expose the raw folder tree as an extra library view. | DIVERGENT — a folder tree is the thing CanonCore refuses. |
| `EnableGroupingMoviesIntoCollections`, `EnableGroupingShowsIntoCollections` (L207, L209) | Auto-create a BoxSet when a provider says two films share a collection. | **ABSENT — HIGH.** This is *automatic container creation from provider data*, and CanonCore's whole product is containers. A TMDB collection or a wiki category is a ready-made ordering; the prompt never says whether an import may mint a container. |
| `DisplaySpecialsWithinSeasons` (L211) | Whether S00 specials interleave into the season they aired between. | **ABSENT — HIGH.** This is literally a second ordering of the same items, shipped as a boolean because Jellyfin has nowhere to put it. CanonCore's model *can* express it as two placements — but the prompt never names the case, and it is the single most common real-world multi-ordering demand in TV. |
| `CodecsUsed` (L213) | Telemetry-ish record of which codecs clients used. | **ABSENT — LOW.** |
| `PluginRepositories` (L215) | Plugin repo URLs. | REFUSED — providers are URLs, not plugins. |
| `EnableExternalContentInSuggestions` (L217) | Allow trailers/extras from the internet in recommendation rows. | **ABSENT — LOW.** |
| `ImageExtractionTimeoutMs` (L219) | Timeout for ffmpeg image extraction. | REFUSED — no ffmpeg. |
| `PathSubstitutions[]` (L221) | Rewrite a stored path before handing it to a client, e.g. server `/mnt/media` → client `\\NAS\media`. | **ABSENT — MEDIUM.** Matters the moment the same library is reachable at two different paths (a Docker bind mount vs the host, or direct-play from a SMB share). CanonCore is direct-play-only, which makes it *more* exposed to this, not less. |
| `EnableSlowResponseWarning`, `SlowResponseThresholdMs` = 500 (L226, L231) | Log a warning when a request exceeds a threshold. | **ABSENT — MEDIUM.** Cheap self-diagnosis for a product whose read path is a projection that can silently rot. |
| `CorsHosts` = `["*"]` (L236) | CORS allowlist. | **ABSENT — MEDIUM.** The prompt has a Safe External Fetch boundary for *outbound* URLs and nothing about *inbound* origin policy. |
| `ActivityLogRetentionDays` = 30 (L241) | How long the activity log is kept. | **ABSENT — MEDIUM.** Presupposes an activity log, which CanonCore has no equivalent of (see §3 and §4). |
| `LibraryScanFanoutConcurrency`, `LibraryMetadataRefreshConcurrency` (L246, L251) | Parallelism caps for scanning and for provider refresh. | **ABSENT — HIGH.** CanonCore reaches **all connected providers at once** for every item, in the background, against thresholds. With no concurrency cap that is an unbounded fan-out that will rate-limit TMDB on the first bulk import. |
| `AllowClientLogUpload` (L256) | Let clients POST their logs to the server. | **ABSENT — LOW.** |
| `DummyChapterDuration`, `ChapterImageResolution` (L262, L268) | Synthesise chapter marks every N seconds when a file has none. | REFUSED — no ffmpeg. |
| `ParallelImageEncodingLimit` (L274) | Cap on concurrent image encodes. | **ABSENT — MEDIUM.** CanonCore extracts a palette per artwork at fetch time; that is an image decode per asset with no stated bound. |
| `CastReceiverApplications` (L279) | Registered Chromecast receiver app IDs. | **ABSENT — LOW.** |
| `TrickplayOptions` (L285) | See §1.5. | REFUSED — no ffmpeg. |
| `EnableLegacyAuthorization` (L290) | Accept the old `X-Emby-Authorization` header form. | REFUSED — no backward compatibility. |

From [`BaseApplicationConfiguration.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/BaseApplicationConfiguration.cs):

| Option | What it controls | Classification |
|---|---|---|
| `LogFileRetentionDays` (L25) | Log rotation. | **ABSENT — MEDIUM.** Self-hosted software that never prunes its own logs fills a disk. |
| `IsStartupWizardCompleted` (L31) | Whether first-run setup has been done. | **ABSENT — HIGH.** CanonCore has "no signup, one password" and *nothing* about how that password first gets set, or how a fresh empty install becomes a usable one. See §6. |
| `CachePath` (L37) | Where the disposable cache lives, separately from data. | **ABSENT — MEDIUM.** The three-way split (config / data / cache) is what makes "safe to delete" and "must back up" distinguishable. |
| `PreviousVersion` / `PreviousVersionStr` (L44, L51) | The last version that ran, persisted so upgrade code can branch on it. | **ABSENT — HIGH.** The prompt mandates a forward-applicable migration ladder but never says the *installed version is recorded*. That record is what makes a ladder runnable and an upgrade auditable. |

### 1.2 `LibraryOptions` — per-library settings

[`MediaBrowser.Model/Configuration/LibraryOptions.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/LibraryOptions.cs)

CanonCore's nearest analogue is a **group**, which the prompt defines as a browsing scope that
chooses providers and scanner roots and explicitly does *not* scope the field set, vocabularies,
progress, entities, or source order. Jellyfin's per-library option set is therefore the sharpest
available test of whether that list is complete. It is not:

| Option | What it controls | Classification |
|---|---|---|
| `Enabled` (L43) | Disable a library without deleting it. | **ABSENT — MEDIUM.** "Stop scanning this, keep the data" has no expression in the prompt. |
| `EnableRealtimeMonitor` (L47) | Per-library filesystem watching on/off. | **ABSENT — HIGH.** The prompt says watchers may not fire on network mounts. Jellyfin's answer is a *per-library* toggle, because one instance routinely has both a local disk and an SMB mount. A single global setting cannot be right for both. |
| `AutomaticRefreshIntervalDays` (L74) | How often to re-ask providers for this library, 0 = never. | **ABSENT — HIGH.** CanonCore has a six-month TMDB cache rule and providers that go stale, but no stated refresh cadence and no place to configure one. |
| `PreferredMetadataLanguage`, `MetadataCountryCode` (L80, L86) | Per-library language override. | **ABSENT — HIGH.** A group holding a Japanese archive and a group holding an English one want different answers. The prompt scopes *which providers are asked* per group but not *what is asked of them*. |
| `MetadataSavers`, `DisabledLocalMetadataReaders`, `LocalMetadataReaderOrder` (L90–L95) | `.nfo` read/write policy. | REFUSED — no `.nfo`. |
| `EnableInternetProviders` (L64) | Master switch for remote metadata on this library. | ADOPTED in spirit (a group chooses its providers). |
| `DisabledSubtitleFetchers`, `SubtitleFetcherOrder`, `SubtitleDownloadLanguages`, `RequirePerfectSubtitleMatch`, `SkipSubtitlesIfEmbeddedSubtitlesPresent`, `SkipSubtitlesIfAudioTrackMatches`, `SaveSubtitlesWithMedia` (L96–L113) | Automatic subtitle acquisition from remote services. | **ABSENT — MEDIUM.** CanonCore models subtitles as *files with a sidecar role*, found by the scanner. It has no concept of fetching one. For a direct-play-only product where the file may simply not have subs, that is a live gap — but it is arguably a provider's job under CMPP. |
| `DisabledLyricFetchers`, `LyricFetcherOrder`, `SaveLyricsWithMedia` (L115–L122) | Same for lyrics. | **ABSENT — LOW.** |
| `DisabledMediaSegmentProviders`, `MediaSegmentProviderOrder` (L100, L102) | Providers that supply **intro / outro / recap / preview / commercial** time ranges within a file. | **ABSENT — MEDIUM.** This is the "skip intro" feature as a first-class provider-supplied data type. CanonCore's `edition_coverage` is intervals over a *work*; this is intervals over an *edition's timeline*, a different axis it has no table for. |
| `EnableEmbeddedTitles`, `EnableEmbeddedExtrasTitles`, `EnableEmbeddedEpisodeInfos` (L68–L72) | Trust metadata baked into the container. | **ABSENT — MEDIUM.** An MKV knows its own title and often its episode numbers. CanonCore's scanner reads bytes and hashes; whether embedded tags are a *source* (which would need a provenance entry) is unaddressed. Note this would be a source that is neither the Owner nor a provider. |
| `EnableAutomaticSeriesGrouping` (L66) | Merge one series split across multiple folders/paths. | **ABSENT — MEDIUM.** |
| `SeasonZeroDisplayName` (L88) | What to call the specials season. | **ABSENT — LOW.** |
| `PreferNonstandardArtistsTag`, `UseCustomTagDelimiters`, `CustomTagDelimiters`, `DelimiterWhitelist` (L125–L132) | How to split a multi-value tag string like `"Lennon/McCartney"`, plus an allowlist of names that must NOT be split (e.g. "AC/DC"). | **ABSENT — HIGH.** This is a *provenance-preserving import* problem and CanonCore will hit it immediately: the Tardis archive's Semantic MediaWiki properties are exactly this shape. The delimiter-whitelist detail — that splitting is wrong for specific literal values — is the kind of thing only a shipped product learns. |
| `AutomaticallyAddToCollection` (L134) | On import, auto-add to a collection if the provider names one. | **ABSENT — HIGH.** Same finding as `EnableGroupingMoviesIntoCollections`: may an import *create placements*? Undecided in the prompt. |
| `AllowEmbeddedSubtitles` (L136) | Enum: AllowAll / AllowText / AllowImage / AllowNone. | **ABSENT — LOW.** |
| `EnablePhotos` (L45) | Treat image files as library items. | REFUSED-adjacent — the scanner takes media + playback sidecars only. |
| `EnableLUFSScan` (L49) | Measure loudness for volume normalisation. | REFUSED — no ffmpeg. |
| `EnableChapterImageExtraction`, `ExtractChapterImagesDuringLibraryScan`, `EnableTrickplayImageExtraction`, `ExtractTrickplayImagesDuringLibraryScan`, `SaveTrickplayWithMedia` (L51–L58, L118) | ffmpeg-derived assets, and crucially *whether they run during the scan or after it*. | REFUSED (ffmpeg) — but the **during-scan vs after-scan split is ABSENT — MEDIUM** and applies to CanonCore's palette extraction and projection rebuild for the same reason: expensive work must not block the scan. |
| `PathInfos[]` (L59) | Multiple roots per library, each with its own network path. | **ABSENT — MEDIUM.** The prompt gives groups "scanner roots" (plural) but no per-root structure. |
| `TypeOptions[]` (L138) | Per-item-type artwork policy; see §1.4. | See §1.4. |

### 1.3 `MetadataOptions` — per-item-type provider ranking

[`MediaBrowser.Model/Configuration/MetadataOptions.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/MetadataOptions.cs) —
seven fields: `ItemType`, plus `MetadataFetcherOrder` / `DisabledMetadataFetchers`,
`ImageFetcherOrder` / `DisabledImageFetchers`, `LocalMetadataReaderOrder` /
`DisabledMetadataSavers`.

The structural finding is **the ordering is per item type and separately per data class**:
Jellyfin ranks metadata providers and *image* providers independently, and does it once per
`ItemType` (`Book`, `Movie`, `MusicVideo`, `Series`, `MusicAlbum`, `MusicArtist`, `BoxSet`,
`Season`, `Episode` — the default set at
[ServerConfiguration.cs#L20-L66](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/ServerConfiguration.cs#L20-L66)).
The shipped defaults even disable specific pairings — OMDb is disabled for MusicVideo, TheAudioDB
for MusicAlbum and MusicArtist — because a provider good at one type is wrong for another.

- **Per-item-type source ordering:** DIVERGENT, and the prompt argues the case. CanonCore has ONE
  global source order, deliberately, because a per-group order gives two answers for one field on
  one page. That reasoning covers *groups*. It does **not** cover *kinds*: an item has exactly one
  `kind`, so a per-kind source order has a single answer per page and does not hit the stated
  objection at all. **ABSENT — MEDIUM**, and worth an explicit refusal rather than silence, because
  the prompt's own justification does not reach it.
- **Separate ordering for images vs facts:** **ABSENT — MEDIUM.** CanonCore's artwork is a table,
  not a statement, and therefore sits *outside* the statements/source-order/favourite mechanism
  entirely. Which provider's poster wins is undecided; there is no `rank` on the artwork table.

### 1.4 `TypeOptions` / `ImageOption` — the artwork policy

[`MediaBrowser.Model/Configuration/TypeOptions.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/TypeOptions.cs),
[`ImageOption.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/ImageOption.cs)

An `ImageOption` is `{ Type, Limit, MinWidth }`, and the defaults are a matrix of item type ×
image type. Movie backdrops: `Limit = 1, MinWidth = 1280`. Movie Art and Disc: `Limit = 0`, with
the comment *"Don't download this by default as it's rarely used."* MusicArtist banner: `Limit = 0`
with the comment that most artists won't have one so a banner view isn't possible.

**Classification: ABSENT — HIGH.** CanonCore's artwork table has role, licence, attribution and
palette, and no policy at all. The three decisions Jellyfin was forced to make and CanonCore has
not are:
1. **How many** assets per role to keep (`Limit`) — a provider will return dozens of posters.
2. **A minimum quality bar** (`MinWidth`) — otherwise a thumbnail lands as a backdrop.
3. **Which roles to fetch at all**, per kind — fetching everything for everything is the naive
   default and it is wrong on both bandwidth and usefulness.

The prompt's `role` enum is `poster|backdrop|title-logo|still`; Jellyfin's `ImageType` is a wider
set including `Art`, `Disc`, `Banner`, `Menu`, `Chapter`, `BoxRear`, `Profile`. That narrowing is
a fine decision, but the *limit and floor* are not narrowing decisions — they are missing ones.

### 1.5 `EncodingOptions`, `TrickplayOptions`

[`EncodingOptions.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/EncodingOptions.cs)
carries 41 properties — hardware acceleration type, VAAPI/QSV device paths, tonemapping algorithm
and five tuning constants, encoder preset, deinterlace method, throttling, HLS segment deletion,
subtitle extraction timeout, fallback font path.
[`TrickplayOptions.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Configuration/TrickplayOptions.cs)
carries 11 — tile geometry, jpeg quality, ffmpeg process priority and thread count, and a
`ScanBehavior` of Blocking/NonBlocking.

**Classification: REFUSED, correctly and at large saving.** "No transcoding, no ffmpeg, no quality
ladders" deletes ~52 configuration options and the entire hardware-support matrix behind them.
This is the single largest thing the prompt's refusals buy.

Two residues survive the refusal:
- `EnableFallbackFont` / `FallbackFontPath` — the answer to "the subtitle track uses a font the
  client does not have". Direct play does not remove that problem, it relocates it to the client.
  **ABSENT — LOW.**
- `TrickplayOptions.ScanBehavior = Blocking | NonBlocking` — the general principle that derived-asset
  generation must be able to run *outside* the scan. Applies to palette extraction. **ABSENT — MEDIUM**
  (already noted in §1.2).

### 1.6 `NetworkConfiguration`

[`MediaBrowser.Common/Net/NetworkConfiguration.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Common/Net/NetworkConfiguration.cs)
— 24 properties: `BaseUrl` (serve under a subpath), `EnableHttps` / `RequireHttps` /
`CertificatePath` / `CertificatePassword`, internal vs **public** HTTP/HTTPS ports (they differ
behind a NAT), `AutoDiscovery` (UDP broadcast so clients find the server without typing a URL),
`EnableUPnP`, `EnableIPv4` / `EnableIPv6`, `EnableRemoteAccess`, `LocalNetworkSubnets` /
`LocalNetworkAddresses`, `KnownProxies`, `IgnoreVirtualInterfaces` / `VirtualInterfaceNames`
(defaulting to `veth`, i.e. Docker), `EnablePublishedServerUriByRequest`,
`PublishedServerUriBySubnet`, `RemoteIPFilter` + `IsRemoteIPFilterBlacklist`.

| Capability | Classification |
|---|---|
| `BaseUrl` — serve the app under `/jellyfin` rather than `/` | **ABSENT — HIGH.** Self-hosted software is put behind a reverse proxy on a shared domain as a matter of course. Next.js can do this (`basePath`) but only if it is decided before the first commit; retrofitting it means auditing every hard-coded `/` in the app and the API client. |
| `KnownProxies` + `RemoteIPFilter` + local-subnet definition | **ABSENT — HIGH.** Behind a reverse proxy, every request appears to come from `127.0.0.1` unless you configure trusted proxies. Get it wrong and rate-limits, "local network" checks and audit logs are all keyed on the wrong address. |
| `PublicHttpPort` vs `InternalHttpPort`, `EnablePublishedServerUriByRequest`, `PublishedServerUriBySubnet` | **ABSENT — MEDIUM.** The server must know the URL a *client* should use, which is not the URL it is listening on. Directly relevant to CanonCore's opaque-id playback route: the URL handed to a TV must be reachable from the TV. |
| `EnableHttps` / cert paths | **ABSENT — MEDIUM.** Usually delegated to the proxy, but "usually" is a documented decision, not a silent one. |
| `AutoDiscovery` (UDP) | **ABSENT — MEDIUM.** How does the tvOS app find the server? The prompt ships two native clients and never says. |
| `IgnoreVirtualInterfaces` defaulting to `veth` | **ABSENT — LOW**, but a good tell: Docker is the deployment substrate and it leaks into the network layer. |
| `EnableRemoteAccess` | **ABSENT — MEDIUM.** LAN-only mode is the safest default posture for a single-owner catalogue. |

### 1.7 Language and region as a first-class axis

Threaded through `ServerConfiguration.PreferredMetadataLanguage` / `MetadataCountryCode`,
overridden by `LibraryOptions.PreferredMetadataLanguage` / `MetadataCountryCode`, and again by
`UserConfiguration.AudioLanguagePreference` / `SubtitleLanguagePreference` / `SubtitleMode`.

**Classification: ABSENT — HIGH, and this is one of the largest structural gaps found.**

The prompt is a *bibliographic* design and language is a bibliographic primitive: LRM, BIBFRAME
and Dublin Core all carry it. But the prompt mentions language exactly twice, both times as an
attribute of a subtitle sidecar file. Consequences:
- A `title` column with no language means the catalogue cannot hold the Japanese and the English
  title of one work as peers. The prompt's own three-audiobook example is monolingual; "80+
  translations" is named as an *edition* explosion to be dropped at the door, which is correct for
  editions and leaves the *titles* problem untouched.
- `PreferredMetadataLanguage` is what a provider request is *parameterised by*. CMPP's search /
  lookup / browse contract has no stated language parameter, so two instances asking TMDB the same
  question get different answers with no way to say which they wanted.
- A statement has `source`, `observed_at` and `rank` but no language, so two synopses in two
  languages are two indistinguishable competing claims and the source order picks one arbitrarily.

### 1.8 Database configuration

[`DatabaseConfigurationOptions.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/DbConfiguration/DatabaseConfigurationOptions.cs)
— `DatabaseType`, `CustomProviderOptions` (a plugin name + assembly + connection string, so a
plugin can supply a database provider), and `LockingBehavior` ∈ NoLock / Pessimistic / Optimistic.

| Capability | Classification |
|---|---|
| Pluggable database backend | DIVERGENT — CanonCore fixes Postgres, correctly (simplest implementation). |
| **Explicit locking-behaviour setting** | **ABSENT — MEDIUM.** Jellyfin needed a *configurable* concurrency posture. CanonCore's read projection already needs revision-id versioning on writes, so it has half of an optimistic-concurrency design; the other half (what happens when two writers collide on a statement) is unstated. |

### 1.9 Backup

[`BackupOptions.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/FullSystemBackup/BackupOptions.cs)
— four booleans selecting archive contents: `Metadata`, `Trickplay`, `Subtitles`, `Database`.
Restore is a first-class startup path: `--restore-archive <path>`
([`StartupOptions.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/StartupOptions.cs)).

**Classification: ABSENT — HIGH.** The prompt has "no export, no import, no cross-instance sharing"
under WHAT NOT TO BUILD — but that refusal is about *federation and interchange*, not about an
owner's ability to back up and restore their own catalogue. They are different features with
different threat models, and reading the refusal as covering backup would leave a self-hosted
product where the owner's hand-curated placements exist in exactly one place. Note Jellyfin makes
restore a **startup mode**, before the app is up, because you cannot restore a database from inside
an app that is using it.

### 1.10 Process/CLI surface

[`StartupOptions.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/StartupOptions.cs):
`--datadir`, `--configdir`, `--cachedir`, `--logdir`, `--webdir`, `--nowebclient`, `--ffmpeg`,
`--service`, `--package-name`, `--published-server-url`, `--nonetchange`, `--restore-archive`,
`--mode`.
[`ConfigurationOptions.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/ConfigurationOptions.cs)
adds appsettings/env keys: `HostWebClient`, `DefaultRedirect`, `BindToUnixSocket`, `SqliteCacheSize`.

| Capability | Classification |
|---|---|
| **Four separate directories** — config, data, cache, logs — each independently relocatable | **ABSENT — MEDIUM.** Determines what a Docker user has to mount, and what is safe to wipe. |
| A `--mode` flag selecting what the process does on start (normal run vs restore vs migrate) | **ABSENT — MEDIUM.** The migration ladder needs a way to run without serving traffic. |
| `BindToUnixSocket` | **ABSENT — LOW.** |
| Serving the web client from the same process, toggleable off | **ABSENT — LOW.** Next.js makes this the default anyway. |

---

## 2. THE PUBLIC API SURFACE

**Size:** 60 controllers in
[`Jellyfin.Api/Controllers/`](https://github.com/jellyfin/jellyfin/tree/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers),
**381 HTTP action methods**; the generated OpenAPI document reports **294 paths / 364 operations /
357 schemas / 46 tags**.

Controllers, largest first (verb-attribute counts from source): Image 45, LiveTv 40, Library 25,
SyncPlay 22, UserLibrary 20, User 18, Session 16, Playstate 14, Playlists 11, ItemLookup 11,
System 10, Subtitle 10, Plugins 9, DynamicHls 9, LibraryStructure 8, Items 8, InstantMix 8,
Videos 7, Startup 7, Package 6, Lyrics 6, Configuration 6, ScheduledTasks 5, MediaInfo 5,
HlsSegment 5, Environment 5, Devices 5, Channels 5, UserViews 4, TvShows 4, QuickConnect 4,
Localization 4, Backup 4, Audio 4, RemoteImage 3, ItemUpdate 3, Collection 3, Branding 3,
Artists 3, ApiKey 3, then 20 controllers with 1–2.

### 2.1 Capability areas, grouped

| Area | Controllers | Classification |
|---|---|---|
| **Transcoding / streaming** | DynamicHls, HlsSegment, UniversalAudio, Audio, Videos, MediaInfo, Trickplay, VideoAttachments | **REFUSED** — direct play only. Deletes ~40 endpoints and the whole HLS/segment machinery. |
| **Live TV / DVR** | LiveTv (40 endpoints: tuners, listings providers, guide, timers, series timers, recordings) | **REFUSED** in effect — nothing in the prompt is about broadcast. Note LiveTv alone is >10% of Jellyfin's API. |
| **Images** | Image (45), RemoteImage (3) | Partly ADOPTED (artwork table), partly REFUSED (no uploads). See §2.4. |
| **Group watch** | SyncPlay (22) | **ABSENT — LOW.** Real feature, genuinely out of scope for a catalogue. |
| **Remote control / casting** | Session (16) — send a play command to another device, message it, issue system commands | **ABSENT — MEDIUM.** "Play this on the TV from my phone" is table stakes in this category, and the prompt ships a phone app and a TV app. |
| **Sessions / devices / keys** | Devices (5), ApiKey (3), QuickConnect (4) | **ABSENT — HIGH.** See §2.2. |
| **Setup** | Startup (7) | **ABSENT — HIGH.** See §2.3. |
| **Filesystem browsing** | Environment (5) | **ABSENT — HIGH.** See §2.5. |
| **Server operations** | System (10: Info, Info/Storage, Info/Public, Restart, Shutdown, Logs, Logs/Log, Endpoint), ActivityLog (1), ClientLog (1), ScheduledTasks (5), Backup (4) | **ABSENT — HIGH** collectively. See §2.6. |
| **Branding** | Branding (3): a config blob, custom CSS, a login disclaimer | **ABSENT — LOW/MEDIUM.** Custom CSS on a self-hosted instance is how users get the look they want without a fork. |
| **Localization** | Localization (4): countries, cultures, parental ratings, localization options | **ABSENT — MEDIUM.** Reference data the product must ship; see §1.7. |
| **Per-user UI state** | DisplayPreferences (2) | **ABSENT — MEDIUM.** See §2.7. |
| **Discovery** | Suggestions (2), InstantMix (8), `Items/{id}/Similar`, `Items/Latest`, `TvShows/NextUp`, `TvShows/Upcoming` | Mostly **ABSENT — MEDIUM**, one item **HIGH**. See §2.8. |
| **Matching / applying** | ItemLookup (11) | **ADOPTED** — and Jellyfin's split is the same one the prompt mandates. See §2.9. |
| **Query** | Items (8) with 88 query parameters | See §2.10. |

### 2.2 Sessions, devices and API keys

- [`DevicesController`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/DevicesController.cs)
  — list devices, get device info, get/set per-device **options** (a custom name), and **DELETE a
  device**, which revokes it.
- [`ApiKeyController`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/ApiKeyController.cs)
  — `GET/POST /Auth/Keys`, `DELETE /Auth/Keys/{key}`: long-lived keys for third-party tools,
  a separate credential class from a user session.
- [`SessionController`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/SessionController.cs)
  — `GET /Sessions` lists live sessions; `POST /Sessions/Logout` kills one.
- [`QuickConnectController`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/QuickConnectController.cs)
  — `Initiate` / `Connect` / `Authorize` / `Enabled`, plus `POST /Users/AuthenticateWithQuickConnect`.

**Classification: ABSENT — HIGH.** The prompt says "one password, no signup" and stops. That leaves
undecided: whether a session is a cookie or a token, how long it lasts, whether the owner can see
what is logged in, whether a lost TV can be revoked without changing the password, and how a native
app authenticates at all (a cookie session is awkward for a Swift client). The prompt explicitly
puts a **single-password cookie session** into the scaffold seam, which answers the web case and
leaves the two native clients it also commits to unaddressed. Device revocation in particular is
the difference between "my TV was stolen" costing one click and costing a password rotation across
every device.

### 2.3 The setup path

[`StartupController`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/StartupController.cs)
— `GET/POST /Startup/Configuration` (UI culture, metadata language, metadata country),
`GET/POST /Startup/User` (create the first user), `POST /Startup/RemoteAccess`,
`POST /Startup/Complete`. Gated by `IsStartupWizardCompleted` on the server config, and these are
the only endpoints reachable before it flips.

**Classification: ABSENT — HIGH.** A self-hosted product's first five minutes are unspecified in
the prompt: how the single password is set, what the app does before it is set, and how the
pre-setup endpoints are prevented from being an open door. Note this is *not* the "enrichment
wizard" the prompt refuses — that refusal is about a compulsory per-item metadata flow, a
completely different thing from first-run installation.

### 2.4 Image endpoints

45 endpoints on
[`ImageController`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/ImageController.cs).
Beyond upload/delete (REFUSED), the surviving ideas are:

- **Server-side resizing on the URL**: `/Items/{id}/Images/{type}/{index}/{tag}/{format}/{maxWidth}/{maxHeight}/...`
  — the client asks for the size it wants and the server caches the result.
  **ABSENT — HIGH.** CanonCore stores a provider URL. A TV grid rendering 60 posters either
  downloads 60 full-size images from a third-party CDN or the server resizes. Neither is decided,
  and this interacts with the licence terms the prompt already tracks (TMDB grants no rights in
  images, so proxying vs hot-linking is a legal posture as well as a performance one).
- **`{tag}` in the path**: an image content-hash in the URL, so images are immutable and can be
  cached forever. **ABSENT — MEDIUM**, and cheap.
- **`POST /Items/{id}/Images/{type}/{index}/Index`** — reorder multiple images of the same role.
  **ABSENT — MEDIUM.** With several posters per item, which one is *the* poster is a rank, and
  CanonCore's artwork table has no rank column while its statements table does.
- **`RemoteImageController`** — `GET /Items/{id}/RemoteImages` (browse candidate images from every
  provider), `/RemoteImages/Providers`, `POST /RemoteImages/Download`. i.e. **choosing an image is
  an explicit owner action distinct from automatic fetching**. **ABSENT — MEDIUM.**

### 2.5 `EnvironmentController` — the server-side file browser

`GET /Environment/DirectoryContents`, `POST /Environment/ValidatePath`, `GET /Environment/Drives`,
`GET /Environment/ParentPath`, `GET /Environment/DefaultDirectoryBrowser`
([source](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/EnvironmentController.cs)).

**Classification: ABSENT — HIGH.** CanonCore builds against a filesystem path and gives groups
scanner roots. Somebody has to enter those paths, in a browser, for a server that is usually in
Docker where the container's view of the filesystem is not the user's. Every product in this
category ships a directory picker for exactly this reason. It is also a **serious security
surface** — an authenticated directory-listing API over the whole host — and the prompt's Safe
External Fetch boundary covers outbound URLs only, so this is a second, unmentioned boundary that
needs its own rules.

### 2.6 Server operations endpoints

| Endpoint | What it does | Classification |
|---|---|---|
| `GET /System/Info` | Version, OS, architecture, paths, whether an update is pending | **ABSENT — MEDIUM.** |
| `GET /System/Info/Public` | The *unauthenticated* subset: server name, version, id, startup-wizard state | **ABSENT — MEDIUM.** How a client discovers what it is talking to before logging in. Note the deliberate two-tier split, which is exactly the prompt's own "name every field the public path emits" instinct applied to system info. |
| `GET /System/Info/Storage` | Free space per configured path | **ABSENT — MEDIUM.** |
| `POST /System/Restart`, `POST /System/Shutdown` | Lifecycle from the API | **ABSENT — LOW.** |
| `GET /System/Logs`, `GET /System/Logs/Log` | List and download log files from the UI | **ABSENT — MEDIUM.** The realistic support path for self-hosted software: "send me your log" must not require shell access. |
| `GET /System/ActivityLog/Entries` | A paged, severity-tagged, user-attributed audit log | **ABSENT — HIGH.** See §3 and §4 — Jellyfin persists this as an entity and prunes it on a schedule. For CanonCore the corresponding question is sharper: the product is built on *provenance*, and it records where a value came from while recording nothing about what the owner did. "Why did this item change last Tuesday" is unanswerable. |
| `POST /ClientLog/Document` | Clients upload their own logs | **ABSENT — LOW.** |
| `POST /Backup/Create`, `POST /Backup/Restore`, `GET /Backup`, `GET /Backup/Manifest` | Backup as an API | **ABSENT — HIGH** (see §1.9). |
| `GET /ScheduledTasks`, `POST /ScheduledTasks/Running/{id}`, `DELETE`, `POST /ScheduledTasks/{id}/Triggers` | See §4 | **ABSENT — HIGH.** |

### 2.7 `DisplayPreferences` — server-stored per-user view state

`GET/POST /DisplayPreferences/{id}` with `userId` and `client`
([source](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/DisplayPreferencesController.cs)),
backed by real tables (§3): view mode, sort by, sort order, index by, whether to remember sorting,
scroll direction, whether to show sidebar/backdrop, plus an open-ended
`CustomItemDisplayPreferences` key/value store.

**Classification: ABSENT — MEDIUM, rising to HIGH given the client plan.** Sort order and view mode
are stored **server-side, per user, per view, per client**, so a shelf sorted on the phone comes up
sorted on the TV. With three clients committed and `localStorage` unavailable on tvOS, this is the
only place that state can live. The prompt defers "no shelf type… decided when screens exist",
which is a reasonable deferral of *what* the preferences are — but the storage location is an API
and schema decision, not a screen decision.

### 2.8 Discovery surfaces

- **`GET /Shows/NextUp`** — the next unwatched episode of each series the user is partway through.
  **ABSENT — HIGH.** Distinct from Continue Watching (which resumes a *partially watched* item);
  Next Up answers "what comes after the thing I finished", which is a **query over the ordering** —
  precisely CanonCore's core competence, and precisely the surface where multi-placement changes
  the answer. An item in a Release-order container and a Story-order container has *two* next-ups,
  and the prompt's rule that "the container you arrived through is navigation state, never
  identity" makes this genuinely hard. It is the most CanonCore-shaped feature in Jellyfin's API
  and the prompt does not name it.
- `GET /Shows/Upcoming` — unreleased items with a future premiere date. **ABSENT — MEDIUM**, and
  cheap for a catalogue that explicitly models unproduced works with zero editions.
- `GET /Items/Latest`, `sortBy=DateLastContentAdded` — recently added, including "series with new
  episodes" rather than just new items. **ABSENT — MEDIUM.**
- `GET /Items/{id}/Similar`, `GET /Items/Suggestions`, InstantMix (8 endpoints) —
  recommendations. **ABSENT — LOW.**
- `GET /Search/Hints` — typeahead across all types with a per-type breakdown. **ABSENT — MEDIUM.**

### 2.9 `ItemLookup` — match, then apply

`POST /Items/RemoteSearch/{Movie|Trailer|MusicVideo|Series|BoxSet|MusicArtist|MusicAlbum|Person|Book}`
returns candidates; `POST /Items/RemoteSearch/Apply/{itemId}` commits one;
`GET /Items/{itemId}/ExternalIdInfos` lists which external id schemes apply to this item
([source](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/ItemLookupController.cs)).

**Classification: ADOPTED.** The prompt already mandates the search/apply split and cites
OpenRefine. Two details it does not have:
1. **Remote search is typed** — a separate endpoint per item kind, because the query shape and the
   scoring differ. CMPP declares one `search`. **ABSENT — MEDIUM**: the prompt's own argument that
   "one title is routinely a TV story, a novelisation and a character at once" is an argument
   *for* passing the expected kind.
2. **`ExternalIdInfos` is introspectable** — the client can ask which id schemes are meaningful for
   this item and get back name, key, type and a URL format string. CanonCore folds scheme into an
   external-id datatype on the properties table, which is the better model; **exposing it for
   introspection is ABSENT — LOW**.

### 2.10 The query surface: `GET /Items` has 88 query parameters

[`ItemsController.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/ItemsController.cs).
Structural features worth extracting, ignoring the domain-specific ones:

| Feature | Detail | Classification |
|---|---|---|
| **Sparse fieldsets** — `fields` | 49-value `ItemFields` enum; the client names what it wants and pays for nothing else | **ABSENT — HIGH.** CanonCore's item payload is assembled from a statements table plus a projection; without a fields parameter every list request materialises every statement for every row. The prompt names the projection as a first-class component and never says what shape a *list* row is versus a *detail* row. |
| `enableTotalRecordCount` | Turn off `COUNT(*)`, because it is the expensive half of a paged query | **ABSENT — MEDIUM.** |
| `startIndex` / `limit` | Offset pagination throughout | **ABSENT — MEDIUM.** Nothing in the prompt says how a 373,513-page archive is paged, and offset pagination degrades exactly at that size. |
| `minDateLastSaved`, `minDateLastSavedForUser`, and the `DateLastSaved` / `DateLastRefreshed` / `RefreshState` fields | **Delta sync**: fetch only what changed since a timestamp | **Partly ADOPTED** — the prompt mandates "a change sequence on every table", which is a *better* mechanism than a timestamp. But it never says the change sequence is *exposed*, which is the whole point of having one. **ABSENT — MEDIUM.** |
| `Etag` field | HTTP-level caching per item | **ABSENT — LOW.** |
| `nameStartsWith`, `nameStartsWithOrGreater`, `nameLessThan` | Alphabet-jump navigation for lists too long to scroll | **ABSENT — MEDIUM.** A remote control cannot scroll 11,285 stories. |
| `adjacentTo` | "give me the items either side of this one in its parent" — prev/next | **ABSENT — HIGH.** In CanonCore prev/next is *placement*-relative, not item-relative, and has a different answer per container. Directly implied by the model and not named in the prompt. |
| `recursive` | Descend the container tree or not | **ABSENT — MEDIUM.** Interacts with the ancestor closure and with the dedup rule the prompt already flags as load-bearing. |
| `filters` (`ItemFilter`: IsFolder, IsNotFolder, IsUnplayed, IsPlayed, IsFavorite, IsResumable, Likes, Dislikes, IsFavoriteOrLikes) | User-data filters as first-class query terms | Partly **ABSENT — MEDIUM**: `IsResumable` and `IsPlayed` are computable from CanonCore's progress model; **favourites and likes/dislikes are a whole missing feature** — see §3. |
| `sortBy` (30-value `ItemSortBy`, multi-valued) incl. `Random`, `SortName`, `DateCreated`, `DatePlayed`, `SeriesDatePlayed`, `DateLastContentAdded`, `AiredEpisodeOrder`, `IndexNumber`, `ParentIndexNumber` | Multi-key sorting, and sorts over *derived* values | **ABSENT — MEDIUM.** Note `AiredEpisodeOrder` and `IndexNumber`/`ParentIndexNumber` are Jellyfin's way of expressing "sort by position", which for CanonCore is just placement order — but only *inside* a container. Sorting a cross-container result set has no natural position and the prompt does not say what happens. |
| `imageTypeLimit`, `enableImageTypes`, `enableImages` | Control how much artwork rides along in a list response | **ABSENT — MEDIUM.** |
| `excludeItemTypes` / `includeItemTypes` (`BaseItemKind`, 37 values) | Kind filtering on every query | **ADOPTED** — the prompt's "work-browsing surfaces query for `work` and ignore the entity kinds" is exactly this, and the prompt is right that it must be by kind rather than by parent. |

### 2.11 Two enums that are findings in their own right

- **`LocationType` = FileSystem, Remote, Virtual, `Offline`**
  ([schema](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Entities/LocationType.cs)).
  `Virtual` is the missing-episode case the prompt already knows about. **`Offline` is the
  finding: ABSENT — HIGH.** It is the state "this file exists but its volume is not mounted right
  now", and it is what stops a scan against an unmounted NAS from deleting the library. CanonCore's
  file identity is content-derived and path is explicitly "location, not identity", which handles
  a *moved* file beautifully and says nothing about a *temporarily absent* one. A scanner with no
  Offline state and a periodic schedule is one failed mount away from a mass delete.
- **`MetadataField` = Cast, Genres, ProductionLocations, Studios, Tags, Name, Overview, Runtime,
  OfficialRating** — this is Jellyfin's per-field lock list, and it is *nine hardcoded fields*,
  not the real field set. **REFUSED** by the prompt, correctly and with a better mechanism (the
  favourite is the lock). Worth recording that the ceiling the prompt describes is even lower than
  "a boolean lock": it is a boolean lock on nine of them.
- **`ExtraType` = Clip, Trailer, BehindTheScenes, DeletedScene, Interview, Scene, Sample,
  ThemeSong, ThemeVideo, Featurette, Short** — "extras" hang off an item without being members of
  any ordering, and `ItemFields` carries `ExtraIds`, `LocalTrailerCount`, `SpecialFeatureCount`.
  **ABSENT — MEDIUM.** A deleted scene is not an edition of the film (different content) and
  putting it in the release-order container is wrong (it never aired). CanonCore's model *can*
  express it — a separate `work` item with a `category` statement, placed in an extras container —
  but the prompt never walks the case, and "which container does a featurette go in" is a question
  a cataloguer hits on day one.

---

## 3. THE DATABASE ENTITY MODEL

Two models live in this tree at once: the **31 registered `DbSet`s** that Jellyfin actually runs
on, and a **complete 36-class normalised schema that compiles, is registered on nothing, and has
sat unreachable since 2020**. The second is the more interesting document, because it is Jellyfin's
attempt at approximately the model CanonCore is building — abandoned.

[`JellyfinDbContext.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/JellyfinDbContext.cs)
— 31 live `DbSet` properties (L29–L174), then a **83-line commented-out block (L176–L258)**
declaring 41 more.

### 3.1 The live model: one flat table with a JSON blob in it

[`BaseItemEntity.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/BaseItemEntity.cs)
— **65 scalar columns and 24 navigation collections**, one table for every item type, discriminated
by a `Type` string (L13). Every movie, series, season, episode, album, track, person-as-item,
box set and playlist is a row in it.

| Feature | Detail | Classification |
|---|---|---|
| `Data` (L15) — a **serialised JSON blob of the whole object**, alongside 65 typed columns | The columns are a *query index over the blob*; the blob is the record | DIVERGENT, and the inverse of CanonCore. CanonCore stores atomised statements and builds a denormalised projection *for* reading. Jellyfin stores the object and denormalises columns *out of* it. Worth naming because the prompt's "budget the projection as a first-class component" is the same admission arrived at from the other direction. |
| `PresentationUniqueKey`, `SeriesPresentationUniqueKey` (L95, L133) | A derived string that collapses rows judged to be "the same thing" | DIVERGENT — CanonCore uses surrogate ids plus an alias table, which is strictly better. But see `UserData` below: this derived key is load-bearing for *progress*. |
| `PrimaryVersionId` (L101) + [`LinkedChildType`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/LinkedChildType.cs) `= Manual, Shortcut, LocalAlternateVersion, LinkedAlternateVersion` | **This is Jellyfin's entire edition mechanism**: a self-join on the item table plus a link-type enum. There is no edition entity. | DIVERGENT, and this is the clearest possible evidence for CanonCore's editions table. "Editions bolted on afterwards" looks exactly like this: two of the four values of a membership enum. |
| `IsVirtualItem` (L111) | The missing-episode flag | ADOPTED in spirit — CanonCore's items are media-independent by default, so it needs no flag. |
| `InheritedParentalRatingValue`, `InheritedParentalRatingSubValue` (L85, L87) | Materialised inheritance of the parent's rating down the tree | See `InheritedTags` below. |
| `PreferredMetadataLanguage`, `PreferredMetadataCountryCode` (L67, L69) | **Per-item** language override, below the per-library one, below the server one | **ABSENT — HIGH.** Three-level language cascade. Reinforces §1.7: this is not a setting, it is an axis running the full depth of the model. |
| `DateLastRefreshed`, `DateLastSaved`, `DateCreated`, `DateModified`, `DateLastMediaAdded` (L57–L73, L103) | Five distinct timestamps, each answering a different question | **ABSENT — MEDIUM.** CanonCore mandates "timestamps… on every table" without saying which. `DateLastRefreshed` (when a provider last spoke) versus `DateModified` (when the record changed) is the pair that makes a refresh cadence implementable. |
| `IsLocked` (L33) + `BaseItemMetadataField` child table | The per-item and per-field lock | REFUSED — the favourite is the lock. |
| `OwnerId` / `Extras` (L137, L147) | Extras hang off an owner item, outside any ordering | **ABSENT — MEDIUM** (already raised at §2.11). |
| `ExternalId`, `ExternalSeriesId`, `ExternalServiceId` (L79, L117, L131) as columns **and** `BaseItemProvider` as a child table | Both a denormalised copy and a normalised one | ADOPTED — CanonCore's identifier statements are the normalised half only, correctly. |

### 3.2 `LinkedChildren` — the placement analogue, and the prompt's claim verified

[`LinkedChildEntity.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/LinkedChildEntity.cs)
is `(ParentId, ChildId, ChildType, SortOrder)`, and
[`LinkedChildConfiguration.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/ModelConfiguration/LinkedChildConfiguration.cs)
declares:

```csharp
builder.HasKey(e => new { e.ParentId, e.SortOrder });
```

**The prompt's claim that Jellyfin keys placements on `(parent, position)` is verified exactly, in
the v12 EF Core schema, not the legacy one.** Three consequences follow from that one line, and all
three are things CanonCore's surrogate-id placement buys back:

1. Reordering rewrites the primary key, so any external reference to a placement goes stale.
2. Two different items **cannot** share a position in one container — the prompt's novel-and-its-film
   case is unrepresentable.
3. `ON DELETE` is `NoAction` on both ends, meaning Jellyfin has to clean these up by hand.

Note also `ChildType = Manual | Shortcut | …`: the *provenance of the membership* is on the join
row. CanonCore's equivalent — hand-placed versus rule-derived — is a property of the container, not
of the placement. Both work; Jellyfin's is finer-grained and CanonCore's is simpler, and the prompt
already argues the case.

### 3.3 `AncestorIds`, `ItemValues` and materialised inheritance

- [`AncestorId`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/AncestorId.cs)
  is `(ParentItemId, ItemId)` — the transitive closure, as its own table. **ADOPTED**; the prompt
  mandates an ancestor closure.
- [`ItemValue`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/ItemValue.cs)
  is `(ItemValueId, Type, Value, **CleanValue**)` with
  [`ItemValueMap`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/ItemValueMap.cs)
  joining it many-to-many to items. It is Jellyfin's single store for genres, studios, artists,
  album-artists and tags, typed by
  [`ItemValueType = Artist, AlbumArtist, Genre, Studios, Tags, InheritedTags`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/ItemValueType.cs).

Two findings in that one table:

| Feature | Classification |
|---|---|
| **`CleanValue`** — a normalised match key stored beside the raw value | **ABSENT — HIGH.** CanonCore's vocabularies have `retired` and `quarantine` states but no normalised form. The archive has "71 distinct values of which about 50 are one-use wreckage"; distinguishing `Sci-Fi` / `sci fi` / `Science Fiction ` *at all* requires a normalised key, and storing it beside the raw value is what lets the original survive for provenance while the normalised one does the matching. This is the mechanism that makes quarantine actionable rather than a bucket. |
| **`InheritedTags = 6`** — tags materialised down the tree as ordinary rows, distinguished only by type | **ABSENT — MEDIUM.** The prompt's ancestor closure is used only for the progress rollup. Nothing says whether anything else inherits down it. Note Jellyfin can materialise this because its containers form a tree; CanonCore's DAG with duplicates means an inherited value can arrive by several paths at once, so "does anything inherit" needs a deliberate answer rather than a silent no. |

### 3.4 `UserData` — the whole of Jellyfin's per-user state, in ten columns

[`UserData.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/UserData.cs),
keyed `(ItemId, UserId, CustomDataKey)`
([config](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/ModelConfiguration/UserDataConfiguration.cs)),
with **eight indexes** on it.

| Column | Classification |
|---|---|
| `PlaybackPositionTicks`, `PlayCount`, `Played`, `LastPlayedDate` | ADOPTED as a state row — and the prompt's claim is confirmed: **one mutable row, no event log, one `LastPlayedDate` so re-watches are unrecoverable.** |
| **`CustomDataKey` in the primary key** | **ABSENT — MEDIUM, and a design the prompt should refuse explicitly.** This third key part is how Jellyfin shares one progress row between item rows that are "the same thing" — i.e. progress deliberately crossing the version boundary. CanonCore is per-edition by policy, so this is DIVERGENT; but the prompt justifies per-edition against *novelisations* and never against *two encodes of one film*, which is the case where users actually want the sharing. Deciding it once is cheaper than discovering it. |
| **`AudioStreamIndex`, `SubtitleStreamIndex`** | **ABSENT — MEDIUM.** Remembered track selection per user per item. Direct-play-only makes this *more* relevant, not less: the client cannot pick a track the server chose, so the last-used track is the only place the preference can live. |
| **`Rating` (double), `Likes` (bool?), `IsFavorite`** | **ABSENT — MEDIUM.** Three separate user-authored evaluations of an *item*. CanonCore's `rank` favourite is a *field-value* preference — a different thing entirely, sharing only the word. There is currently nowhere for "I liked this" to go. It is expressible as an Owner-sourced statement, which is probably right, but the prompt never says so and "favourite" is already taken. |
| `RetentionDate` | **ABSENT — LOW.** DVR-adjacent. |

No `owner_id`-equivalent problem here: Jellyfin was multi-user from the start, and every per-user
table carries `UserId`. CanonCore's "keep `owner_id` on every table so multi-user is a later
migration" is the same shape reached from a single-user start, and the eight indexes above are what
it costs to query it.

### 3.5 `BaseItemImageInfo` — Blurhash

[`BaseItemImageInfo.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/BaseItemImageInfo.cs)
— `Path`, `DateModified`, `ImageType`, `Width`, `Height`, **`Blurhash` (byte[])**.

**Classification: ABSENT — MEDIUM.** A blurhash is a ~30-byte encoding of an image that renders as a
blurred placeholder before the real one loads. It is computed **at fetch time onto the row** —
structurally the identical decision to CanonCore's palette rule, made for the identical reason
("cheap then, awkward to backfill"). CanonCore extracts a palette at that moment and not a
placeholder, and a grid of remote poster URLs on a TV is exactly the case a placeholder exists for.
Also note `Width` and `Height` are stored: CanonCore's artwork table has neither, and without them
a layout cannot reserve space and §1.4's `MinWidth` floor cannot be enforced after the fact.

### 3.6 `MediaSegment` — provider-supplied intervals over a timeline

[`MediaSegment.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/MediaSegment.cs)
— `(Id, ItemId, Type, StartTicks, EndTicks, SegmentProviderId)`, with
[`MediaSegmentType = Unknown, Commercial, Preview, Recap, Outro, Intro`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Enums/MediaSegmentType.cs).

**Classification: ABSENT — MEDIUM.** Note the shape: an interval, typed from a closed vocabulary,
**carrying the id of the provider that asserted it**. That is a statement with a provenance column
and an interval value — CanonCore's `edition_coverage` is intervals with no provenance and no type
vocabulary beyond `kind`, and its statements table has provenance but no interval datatype. The two
halves exist separately. Whether "intervals within an edition's runtime, from a provider" is
coverage, a statement, or a third table is undecided.

### 3.7 `ActivityLog` — the audit table

[`ActivityLog.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/ActivityLog.cs)
— `Name`, `Overview`, `ShortOverview`, `Type`, `UserId`, `ItemId`, `DateCreated`, `LogSeverity`.

**Classification: ABSENT — HIGH.** Restating §2.6 with the schema in hand: it is user-attributed,
item-attributed, severity-tagged, typed by a machine-readable `Type` string and carrying a
human-readable `Name`/`Overview` pair. For a product whose thesis is provenance, having no record
of *owner* actions — which placements were made, which merges ran, which review-queue items were
rejected — is a hole in the thesis and not merely a missing feature. The rejections the prompt
already requires to be remembered need somewhere to live, and this is its shape.

### 3.8 The abandoned normalised schema — 36 classes, no DbSet

This is the find. `JellyfinDbContext.cs` L176–L258 comments out 41 `DbSet` declarations, and the
entity classes they refer to **still exist and still compile**, in
[`Entities/Libraries/`](https://github.com/jellyfin/jellyfin/tree/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Libraries)
— 36 files: `Artwork`, `Book`, `BookMetadata`, `Chapter`, `Collection`, `CollectionItem`, `Company`,
`CompanyMetadata`, `CustomItem`, `CustomItemMetadata`, `Episode`, `EpisodeMetadata`, `Genre`,
`ItemMetadata`, `Library`, `LibraryItem`, `MediaFile`, `MediaFileStream`, `MetadataProvider`,
`MetadataProviderId`, `Movie`, `MovieMetadata`, `MusicAlbum`, `MusicAlbumMetadata`, `Person`,
`PersonRole`, `Photo`, `PhotoMetadata`, `Rating`, `RatingSource`, `Release`, `Season`,
`SeasonMetadata`, `Series`, `SeriesMetadata`, `Track`, `TrackMetadata`.

**What it is: a four-level bibliographic model.** The ladder is
`Library → LibraryItem → Release → MediaFile → MediaFileStream`, with metadata hanging off the item
as a *collection*:

- [`LibraryItem`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Libraries/LibraryItem.cs)
  is abstract — `Id`, `DateAdded`, `RowVersion`, `Library`. Subclassed by `Movie`, `Episode`,
  `Season`, `Series`, `Book`, `Track`, `MusicAlbum`, `Photo`, `CustomItem`.
- [`Movie`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Libraries/Movie.cs)
  is `LibraryItem, IHasReleases` with `ICollection<Release>` **and** `ICollection<MovieMetadata>`.
- [`Release`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Libraries/Release.cs)
  is `Name` + `ICollection<MediaFile>` + `ICollection<Chapter>`.
- [`MediaFile`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Libraries/MediaFile.cs)
  is `Path` + `Kind`.

**That is CanonCore's items → editions → files, with the level CanonCore collapses still present.**
Jellyfin's `Release` is CanonCore's `edition`; its `MediaFile` is CanonCore's `file`. The
classification of the whole schema is therefore not ABSENT — it is **the same design, attempted by
this product, and abandoned in place**. It is the strongest available evidence both *for* the model
(a mature media server independently reached it) and *for* the prompt's scope discipline (they
reached it and could not land it, and the shipped product is a 65-column flat table instead).

Seven specific findings inside it:

| Finding | Detail | Classification |
|---|---|---|
| **`ItemMetadata.Language` is a required 3-char column, and metadata is a `ICollection<>` per item** ([source](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Libraries/ItemMetadata.cs)) | One title / sort-title / plot / tagline **record per language**, plus `OriginalTitle` and `OriginalLanguage` as separate fields | **ABSENT — HIGH, and this settles §1.7.** Jellyfin's *considered* schema made language mandatory and metadata multi-valued over it; its *shipped* schema has one `Name` column. CanonCore has one `title` column and no language anywhere. The abandoned design is the right one and the shipped one is the compromise. |
| **`ItemMetadata.Sources : ICollection<MetadataProviderId>`** | Provenance to *record* granularity — this metadata record came from these providers | Confirms the prompt's claim 3 with a wrinkle: Jellyfin got within one level of per-field provenance and stopped. Per-*record* provenance still cannot answer "where did the runtime come from" when one record carries title, plot, tagline and country. CanonCore's per-statement granularity is the correct finer cut, and this is the near-miss that proves the cut matters. |
| **`Rating` + `RatingSource`** ([Rating](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Libraries/Rating.cs), [RatingSource](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Libraries/RatingSource.cs)) | A rating is `Value` + `Votes`, pointing at a `RatingSource` that carries `Name`, `MinimumValue`, `MaximumValue` **and its own `MetadataProviderId`** | **ABSENT — MEDIUM/HIGH.** A rating without its scale is meaningless: TMDB is 0–10, Rotten Tomatoes 0–100, and both assert "rating". CanonCore's statements carry a value and a source; the *scale* would have to live on the property definition, which forces one scale per property and therefore one rating property per provider — the exact provider-shaped schema the design refuses. `Votes` (the sample size) has nowhere to go at all except a qualifier. |
| **`MediaFileKind = Main, Sidecar, AdditionalPart, AlternativeFormat, AdditionalStream`** ([source](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Enums/MediaFileKind.cs)) | Compare CanonCore's file role `media\|subtitle\|audio\|chapters` | **`AdditionalPart` is ABSENT — MEDIUM/HIGH.** A film split as `CD1`/`CD2`, or a serial ripped one part per file: *one* thing to watch, several media files, in order. In CanonCore those are two rows with role `media` on one edition, and nothing says they are consecutive parts of one runtime or which comes first. Very common in real libraries, and it interacts with completion (two files, one position) and with `edition_coverage`. |
| **`CollectionItem.Next` / `.Previous`** ([source](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Libraries/CollectionItem.cs)) | Ordering as a **doubly linked list**, not an integer position | Not a gap — a **road not taken, and worth recording as such.** A linked list gives O(1) insertion with no renumbering, which is the real cost of integer positions. It also makes "position #63" an O(n) walk and makes *two different items at the same position* structurally impossible — which is a stated CanonCore requirement. The prompt's integer `position` is right; this is the argument it never had to make. |
| **`PersonRole`** ([source](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Libraries/PersonRole.cs)) | The credit is reified: `Role` string + `PersonRoleType` enum + `Person` + **its own `Artwork`** + **its own `Sources`** | **ADOPTED** — CanonCore's "a placement is a legitimate subject" and statement qualifiers cover this, and cover it better (the role is a statement, not an enum). Note the live model degraded this to a free `Role` string on [`PeopleBaseItemMap`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/PeopleBaseItemMap.cs) with **two** order columns, `SortOrder` and `ListOrder`. |
| **`CustomItem` / `CustomItemMetadata`** | A concrete item class meaning "a thing we have no class for" | DIVERGENT, and CanonCore is right to refuse it. This is what an open kind enum becomes: rather than model the unclassifiable, the schema grows a class for it. CanonCore's answer — eight closed kinds, finer typing as a sourced `category` statement — is the alternative, and the fact that Jellyfin's own normalised design needed an escape hatch is the evidence for keeping the enum closed. |

One more, structural rather than per-class: `IHasArtwork` is implemented by `ItemMetadata` **and by
`PersonRole`**, so artwork attaches to a *credit*, not only to an item. And
[`Artwork`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Libraries/Artwork.cs)
carries only `Path` + `ArtKind` — no licence, no attribution, no palette. CanonCore's artwork table
is richer than either Jellyfin model, which is a point in its favour and the reason the missing
`Width`/`Height`/`rank`/limit policy from §1.4 and §3.5 stands out.

### 3.9 The migration ladder

55 migrations in
[`Jellyfin.Database.Providers.Sqlite/Migrations/`](https://github.com/jellyfin/jellyfin/tree/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Providers.Sqlite/Migrations),
dated `20200514181226_AddActivityLog` through `20260815063607_RemoveOrphanedUserPermissionsAndPreferences`
— an unbroken forward ladder over six years. **ADOPTED**: the prompt mandates exactly this.

The finding is in
[`src/Jellyfin.Database/readme.md`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/readme.md):
*"Each provider has its own set of migrations… When creating a new migration, you always have to
create migrations for all providers."* Pluggable database backends multiply the ladder by the
number of providers, forever. CanonCore fixing Postgres avoids this entirely, and the readme is the
receipt for that decision being correct.


---

## 4. SCHEDULED TASKS

**18 `IScheduledTask` implementations**, plus a framework around them. The CanonCore prompt's entire
treatment of recurring maintenance is one line — *"Support explicit periodic scans"* — plus a
reconciliation loop mentioned once in FACTS. This is the richest seam in the sweep.

### 4.1 The framework, which is the larger finding

[`IScheduledTask.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Tasks/IScheduledTask.cs)
is five members: `Name`, **`Key`**, `Description`, `Category`,
`ExecuteAsync(IProgress<double>, CancellationToken)`, `GetDefaultTriggers()`.
[`IConfigurableScheduledTask.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Tasks/IConfigurableScheduledTask.cs)
adds `IsHidden`, `IsEnabled`, `IsLogged`.

| Element | Detail | Classification |
|---|---|---|
| **A named, keyed, categorised task registry with an API** (§2.6: `GET /ScheduledTasks`, `POST /ScheduledTasks/Running/{id}`, `DELETE` to cancel, `POST /ScheduledTasks/{id}/Triggers`) | Every recurring job is a first-class, visible, individually runnable and individually cancellable object | **ABSENT — HIGH.** CanonCore has at minimum four recurring jobs implied by the prompt (periodic scan, provider refresh, six-month cache eviction, projection reconciliation) and no place to see, run, cancel or reschedule any of them. A self-hosted product where the owner cannot say "re-scan now" without restarting is not finished. |
| [`TaskTriggerInfoType`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Tasks/TaskTriggerInfoType.cs) `= DailyTrigger, WeeklyTrigger, IntervalTrigger, StartupTrigger` | Four trigger shapes, not cron. **`StartupTrigger`** is the one worth noting: some work must happen once per process start, not on a clock. | **ABSENT — MEDIUM.** Deliberately *not* cron — four shapes cover everything a media server needs and none of them require a cron parser or a timezone argument. |
| **`GetDefaultTriggers()` is code; the actual triggers are persisted JSON** ([`ScheduledTaskWorker.cs` L454, L490](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/ScheduledTasks/ScheduledTaskWorker.cs)) | The shipped schedule is a default the owner overwrites, and the override survives upgrade | **ABSENT — MEDIUM**, and the right shape: a hardcoded interval is a decision taken away from the operator. |
| **`MaxRuntimeTicks` lives on the *trigger*, not the task** ([`TaskTriggerInfo.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Tasks/TaskTriggerInfo.cs); enforced at `ScheduledTaskWorker.ExecuteInternal` via `CancelAfter`) | The same task gets a 4-hour cap when it fires at 2am and no cap when the owner runs it by hand | **ABSENT — MEDIUM.** A subtle and correct distinction. An unbounded background job on a 373,513-page archive is how a scan becomes permanent. |
| [`TaskCompletionStatus`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Tasks/TaskCompletionStatus.cs) `= Completed, Failed, Cancelled, Aborted` | **`Aborted` is separate from `Failed`**: it is written when the process died mid-task, so "we never found out" is distinguishable from "it went wrong" | **ABSENT — MEDIUM.** Three outcomes is the naive set; the fourth is what a shipped product learns. |
| `LastExecutionResult` persisted per task (start, end, status, error message, long error message) | The task list shows when each job last ran and whether it worked | **ABSENT — MEDIUM.** |
| `IProgress<double>` threaded through every task, surfaced over WebSocket ([`ScheduledTasksWebSocketListener`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/WebSocketListeners/ScheduledTasksWebSocketListener.cs)) | Live progress, pushed | **ABSENT — MEDIUM.** The prompt's enrichment "runs in the background against the thresholds" with no stated way to watch it. |
| [`TaskManager`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/ScheduledTasks/TaskManager.cs): a queue, plus `QueueIfNotRunning<T>()` and `CancelIfRunningAndQueue<T>()` | **Two named restart policies.** "Skip if already going" and "kill it and start again" are different answers and both are needed. | **ABSENT — MEDIUM.** Relevant to the projection rebuild: the prompt mandates revision-id versioning so a stale rebuild cannot overwrite a newer one, which is the *data* half of this problem; the *scheduling* half — may two rebuilds overlap at all — is unstated. |
| `IsHidden` computed at runtime — e.g. `IsHidden => _channelManager.Channels.Length == 0` ([RefreshChannels](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.LiveTv/Channels/RefreshChannelsScheduledTask.cs#L52)) | The task list only shows jobs that apply to *this* install's configuration | **ABSENT — LOW**, but a good pattern: an instance with no providers connected should not show a provider-refresh job. |

### 4.2 The tasks themselves

Cadences below are the shipped defaults.

| Task | Cadence | What it does | Classification |
|---|---|---|---|
| [`RefreshMediaLibraryTask`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/ScheduledTasks/Tasks/RefreshMediaLibraryTask.cs) | **every 12h** | The periodic scan | **ADOPTED in principle** — the prompt mandates periodic scans. **The number is ABSENT — MEDIUM:** 12 hours is a real decision (fast enough that new files appear the same day, slow enough not to hammer a spinning NAS) and CanonCore states none. |
| [`PeopleValidationTask`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/ScheduledTasks/Tasks/PeopleValidationTask.cs) | **every 7 days** | Phase 1 deduplicates `Peoples` grouped by `(Name, PersonType)` and **removes orphans**; later phases revalidate | **ABSENT — HIGH.** Two separate findings. (a) Jellyfin needs a *weekly job* to clean up entities because it keys people on name — which CanonCore's surrogate ids make unnecessary, and this is the receipt for that decision. (b) **Orphan removal is not**: CanonCore mints `person`, `character`, `place` and `organisation` items from imports, and when the statements that referenced them are superseded or their placements deleted, nothing collects them. An entity with no statements, no placements and no files is invisible in every surface and permanent in the database. |
| [`CleanupUserDataTask`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/ScheduledTasks/Tasks/CleanupUserDataTask.cs) | no default trigger | Deletes `UserData` rows that were **detached** (re-pointed at `BaseItemRepository.PlaceholderId`) more than **90 days** ago | **ABSENT — HIGH, and this is the best single idea in the section.** When an item is deleted, Jellyfin does **not** delete your watch history: it detaches it and holds it for 90 days, so a file removed and re-added restores your progress. CanonCore's DELETE section previews counts and then removes; nothing says what happens to `progress` and watch events for a deleted edition. Given the prompt's own position that the event log is the truth and "the event log is what makes re-watches real", destroying it on a delete is the one irreversible loss in a product otherwise built on aliases and tombstones. |
| [`SubtitleScheduledTask`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/MediaInfo/SubtitleScheduledTask.cs) / [`LyricScheduledTask`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Lyric/LyricScheduledTask.cs) | every 24h | **"Download missing X"** — a recurring job that finds records with a gap and asks providers to fill it | **ABSENT — HIGH** as a *pattern*, independent of subtitles. CanonCore enrichment is described as running once on import against thresholds. Nothing re-asks. But providers gain data continuously (a wiki page gets a synopsis next month; TMDB adds a poster), and the prompt's own six-month TMDB cache rule presupposes something re-fetching. A "fill the gaps" job, scoped to fields that are still empty, is a different job from "refresh everything" and much cheaper. |
| [`TmdbUpcomingEpisodesTask`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Providers/Plugins/Tmdb/TV/TmdbUpcomingEpisodesTask.cs) | configurable, in days | Checks TMDB for newly announced episodes and **creates virtual items** for unaired and missing ones — and **when the option is turned off, removes the virtual entries it previously created** | **ABSENT — HIGH.** Two things at once. (a) *A provider creating items on a schedule*, which is the same undecided question as §1.1's `EnableGroupingMoviesIntoCollections` and §1.2's `AutomaticallyAddToCollection`: may an import mint rows the owner did not ask for? CanonCore models unproduced works as first-class (a `work` with zero editions), so this is squarely in range. (b) **The reverse operation.** Because the rows are attributable to the job that made them, turning the job off can un-make exactly those and nothing else. CanonCore's statements carry `source`, so it has the attribution to do this; the prompt never says a source can be *withdrawn*, and "I connected TMDB, I regret it, take its rows back out" is a question an owner will ask. |
| [`OptimizeDatabaseTask`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/ScheduledTasks/Tasks/OptimizeDatabaseTask.cs) | every 6h | VACUUM / checkpoint | **ABSENT — LOW.** Postgres autovacuums; the SQLite-specific need does not transfer. **But the guard clause does** — see §4.3. |
| [`DeleteLogFileTask`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/ScheduledTasks/Tasks/DeleteLogFileTask.cs) | every 24h | Prunes to `LogFileRetentionDays`, and **skips any file whose name starts with `log_`** because Serilog rotates those itself | **ABSENT — MEDIUM.** The comment is the finding: two rotation mechanisms over one directory will fight, and the fix is an explicit carve-out. |
| [`DeleteCacheFileTask`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/ScheduledTasks/Tasks/DeleteCacheFileTask.cs) | every 24h | Cache files older than **30 days**, temp files older than **1 day** — two retentions for two directories | **ABSENT — MEDIUM.** Directly relevant if CanonCore ever caches provider responses or artwork locally (§1.1 `MetadataPath`), and the six-month TMDB cache rule is exactly a retention policy with no job behind it. |
| [`CleanActivityLogTask`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/ScheduledTasks/Tasks/CleanActivityLogTask.cs) | no default trigger | Prunes the activity log to `ActivityLogRetentionDays`, and **throws** if the setting is negative rather than guessing | **ABSENT — MEDIUM**, contingent on §3.7. |
| `AudioNormalizationTask`, [`ChapterImagesTask`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/ScheduledTasks/Tasks/ChapterImagesTask.cs), `KeyframeExtractionScheduledTask`, `TrickplayImagesTask`, `TrickplayMoveImagesTask`, `MediaSegmentExtractionTask`, `DeleteTranscodeFileTask` | daily 02:00 / daily 03:00 / etc. | ffmpeg-derived assets | **REFUSED.** Seven of eighteen tasks disappear with "no transcoding, no ffmpeg". |
| `RefreshChannelsScheduledTask`, `RefreshGuideScheduledTask` | every 24h | Live TV | **REFUSED.** |

### 4.3 Four cross-cutting patterns worth extracting

1. **Heavy jobs defer to the scan rather than contending with it.** Both `OptimizeDatabaseTask` and
   `PeopleValidationTask` open with `if (_libraryManager.IsScanRunning) { log; return; }`, and the
   comment on the first says why: *"Vacuuming/checkpointing requires an exclusive lock… Running it
   while a library scan is in progress causes both operations to contend for the database and can
   stall the scan… The task will run again on its next trigger."* **ABSENT — HIGH.** CanonCore has a
   scanner, a background enrichment run, a wholesale projection rebuild and a review queue, all
   writing the same tables with no stated ordering between them. Note the resolution is *skip, do
   not queue* — the next trigger is soon enough, and a queue of deferred heavy jobs all firing when
   the scan ends is worse than skipping.
2. **A persistent failure memo.** `ChapterImagesTask` keeps `chapter-failures.txt` in the cache
   directory and will not retry a file it has already failed on. **ABSENT — MEDIUM.** This is the
   *system* counterpart of the prompt's "REJECTIONS ARE REMEMBERED": the owner's rejections are
   remembered, but a provider lookup that fails permanently (a 404 that will always be a 404, an
   unparseable date) will be retried on every single run forever. Same failure mode, same fix,
   different actor.
3. **Staggered default clock times.** Chapter images at 02:00, trickplay at 03:00. **ABSENT — LOW**,
   but free: two heavy jobs defaulted to the same hour is a bug that only appears on other people's
   hardware.
4. **Paging inside the task.** `MediaSegmentExtractionTask` walks the library with
   `Limit = 100` and an advancing `StartIndex` rather than materialising the set. **ABSENT —
   MEDIUM**, and load-bearing at 373,513 rows.

### 4.4 The jobs CanonCore's own prompt implies and does not name

Consolidating, the prompt commits to work that must recur and gives it no home:

| Implied by the prompt | Where it says so | Status |
|---|---|---|
| Periodic filesystem scan | *"Support explicit periodic scans"* | Named, **uncadenced and unschedulable** |
| Six-month TMDB cache eviction | *"the six-month cache rule honoured"* | **A retention policy with no job.** This is a licence term, so the job is a compliance requirement, not a nicety. |
| Projection reconciliation | FACTS: *"Budget the projection as a first-class component with a reconciliation loop"* | Named once as a component, **never as a schedule** |
| Provider re-refresh | Implied by staleness and by §1.2 `AutomaticRefreshIntervalDays` | **ABSENT entirely** |
| Orphan collection for entities and statements | Implied by imports minting entities | **ABSENT entirely** |
| Tombstone / alias compaction | *"Timestamps, tombstones and a change sequence on every table"* | Tombstones accumulate forever with nothing to prune them |


---

## 5. THE PLUGIN SURFACE

**Overall classification: REFUSED, and the prompt already argues the case** (*"a provider is a URL
answering a contract — not a plugin, not a repo, and never code running inside the app"*, plus the
Plex 2018–2025 plugin history). Everything below confirms that refusal is well founded — plugins
here are unsandboxed .NET assemblies loaded into the server process, and they can add HTTP
controllers to the server's own API.

The finding is not the mechanism. It is the **taxonomy of extension points**, because that taxonomy
is a list of every job Jellyfin found a third party needs to do — and CMPP covers three of them.

### 5.1 What a plugin is, mechanically

[`IPlugin.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Common/Plugins/IPlugin.cs)
— `Name`, `Description`, `Id` (Guid), `Version`, `AssemblyFilePath`, `CanUninstall`,
**`DataFolderPath`**, `GetPluginInfo()`, **`OnUninstalling()`**.
[`PluginManifest.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Common/Plugins/PluginManifest.cs)
— `category`, `changelog`, `description`, `guid`, `name`, `overview`, **`owner`**, **`targetAbi`**,
`timestamp`, `version`, `status`, **`autoUpdate` (default `true`)**, `imagePath`, `assemblies`.

Loaded via
[`PluginLoadContext : AssemblyLoadContext`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Plugins/PluginLoadContext.cs),
in-process, full trust, no sandbox — and
[`ApiServiceCollectionExtensions.cs#L160`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/Extensions/ApiServiceCollectionExtensions.cs#L160)
does `mvcBuilder.AddApplicationPart(pluginAssembly)`, so **a plugin mounts its own routes on the
server's public API**. `IHasWebPages` / `PluginPageInfo` additionally lets it inject HTML
configuration pages into the web client. This is the maximal version of the thing CanonCore
refuses, and the refusal buys the whole ABI-compatibility problem (`targetAbi`, with a
`_minimumVersion` fallback at [`PluginManager.cs#L702`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Plugins/PluginManager.cs#L702))
along with it.

Three details survive the refusal and apply to CMPP providers:

| Detail | Classification |
|---|---|
| [`PluginStatus`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Common/Plugins/PluginStatus.cs) `= Active(0), Restart(1), Disabled(-1), NotSupported(-2), **Malfunctioned(-3)**, Superseded(-4), Deleted(-5)` | **ABSENT — MEDIUM.** `Malfunctioned` is a *recorded* state: the server noticed this thing keeps failing and stopped trusting it. CanonCore reaches **all connected providers at once** for every item, in the background, with no circuit breaker and no state to record "this URL has 500'd on the last two hundred calls". A provider is a user-supplied URL; a dead one must be able to be marked dead without the owner disabling it by hand. |
| `DataFolderPath` + `CanUninstall` + `OnUninstalling()` | **ABSENT — MEDIUM.** An extension owns a scoped data area and gets a hook when it is removed. This is the third independent appearance in this sweep of *withdraw what this source created* (see §4.2 `TmdbUpcomingEpisodesTask` and §5.2 `CleanupExtractedData`). CanonCore's statements all carry `source`, so it has the attribution; the prompt never says a source can be disconnected and its claims retracted. |
| `owner` and `category` on the manifest, plus `autoUpdate` defaulting to `true` | **ABSENT — LOW.** The prompt's CMPP store is "curated, accepted rather than open"; a manifest is what curation reads. Note the auto-update default: Jellyfin ships extensions that update themselves without asking, which for a URL-based provider contract is a non-issue — one more point for the design. |

### 5.2 The extension points, which is the real finding

Registered at
[`ApplicationHost.FindParts()`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/ApplicationHost.cs#L719-L749)
— 17 exported types, plus provider interfaces resolved elsewhere. Grouped against CMPP's
`search` / `lookup` / `browse`:

| Extension point | What a third party can do with it | Classification |
|---|---|---|
| [`IRemoteMetadataProvider<TItem, TLookupInfo>`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Providers/IRemoteMetadataProvider.cs) — `GetSearchResults(searchInfo)` **+** `GetMetadata(info)` | Search and lookup, as two methods on one interface | **ADOPTED.** This is precisely CMPP's required pair, and Jellyfin reached the same split. |
| [`IRemoteImageProvider`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Providers/IRemoteImageProvider.cs) — `GetSupportedImages(item)`, `GetImages(item)`, `GetImageResponse(url)` | **A provider declares which image roles it can supply, per item.** And it fetches the bytes itself, so provider-specific auth/referer requirements stay inside the provider. | **ABSENT — MEDIUM.** CMPP declares only whether `browse` is supported. Whether a provider supplies artwork at all, and which of `poster\|backdrop\|title-logo\|still`, is undeclared — so CanonCore must ask every provider for everything and discard. `GetImageResponse` is also the clean answer to §2.4's proxy-versus-hot-link question: the fetch belongs to whoever holds the terms. |
| [`IHasItemChangeMonitor`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Providers/IHasItemChangeMonitor.cs) — `bool HasChanged(item, directoryService)` | **Ask a provider whether its answer has changed before paying to refetch it** | **ABSENT — HIGH.** The cheap half of every refresh policy. CanonCore has a six-month TMDB cache rule and no refresh cadence (§1.2, §4.4); a `HasChanged`-shaped call — or its HTTP equivalent, an ETag / `If-Modified-Since` on the CMPP lookup — turns "re-ask 373,513 items every N days" into something an instance can actually run. Nothing in CMPP's contract admits conditional requests. |
| [`IMediaSegmentProvider`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/MediaSegments/IMediaSegmentProvider.cs) — `Supports(item)`, `GetMediaSegments(request)`, **`CleanupExtractedData(itemId)`** | Per-item capability declaration, plus a **mandatory retraction method** | **ABSENT — MEDIUM.** The retraction method is required by the interface, not optional: a provider that can write must be able to un-write. |
| [`ISearchProvider`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Library/ISearchProvider.cs), `ISimilarItemsProvider`, `IIntroProvider` | Provider-supplied search, recommendations, and pre-roll | **ABSENT — LOW.** Discovery is already §2.8. |
| `IItemResolver` + `IResolverIgnoreRule` | **The scanner's "what is this path" decision, as an extension point** | **ABSENT — MEDIUM.** CanonCore's scanner reads bytes and hashes and the prompt never says how a path becomes a candidate item, or how a path is excluded. Both halves — recognise and ignore — are needed, and `.DS_Store`, `@eaDir`, `.Trash-1000` and sample files are what the ignore rule is for. |
| `ILibraryPostScanTask` | Work that runs **after** a scan completes, as a distinct phase | **ABSENT — MEDIUM.** Same principle as §1.2's during-scan-vs-after-scan split: CanonCore's palette extraction, projection rebuild and enrichment all want to be post-scan phases rather than inline work. |
| `IBaseItemComparer` | Pluggable sort orders | **ABSENT — LOW.** |
| [`IExternalUrlProvider`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Providers/IExternalUrlProvider.cs) — `GetExternalUrls(item)` | "Link out to this record on the source's own site" | **ABSENT — LOW/MEDIUM.** Cheap, and it is the natural rendering of the attribution CanonCore already stores. |
| [`IExternalId`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Providers/IExternalId.cs) — `ProviderName`, `Key`, `Type`, `Supports(item)` | An id **scheme** as a registered object, declaring which item types it applies to | **ADOPTED with a better model** — CanonCore folds scheme into an external-id datatype on the properties table. Note the `// TODO: This property is not actually unique across the concrete types at the moment` on `Key`: Jellyfin's scheme registry has no unique key, which is the failure mode a properties table prevents. |
| `IAuthenticationProvider` (+ `IRequiresResolvedUser`, `IHasNewUserPolicy`), `IPasswordResetProvider` | Pluggable auth (LDAP) and password recovery | **REFUSED** on the auth half (one password). See §6 for the `IHasNewUserPolicy` half. |
| `IMetadataSaver`, `ILocalMetadataProvider` | `.nfo` read/write | **REFUSED.** |
| `IConfigurationFactory` | A plugin registers a whole new configuration store | **REFUSED** — the prompt forbids speculative configuration. |
| `IMediaSourceProvider`, `ISubtitleProvider`, `ILyricProvider`, `IChannel`, `IJellyfinDatabaseProvider` | Alternative media sources, subtitle/lyric fetching, content channels, database backends | **REFUSED / ABSENT — LOW**, all covered elsewhere. |

### 5.3 `MetadataResult<T>` — three fields CMPP does not have

[`MetadataResult.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Providers/MetadataResult.cs)
is the shape every provider returns: `Item`, `People`, `Images`, `RemoteImages` as `(Url, ImageType)`
pairs, `HasMetadata`, and then:

| Field | Classification |
|---|---|
| **`Provider`** | **The prompt's claim 3 is verified exactly.** `MetadataResult<T>` is a plain class returned from `GetMetadata`, registered on no `DbSet` (§3), and consumed by a merge that keeps values and drops their origin. Jellyfin knows the provider at the moment of the answer and has nowhere to put it. Cite this file for the claim. |
| **`ResultLanguage`** | **ABSENT — HIGH.** The provider declares *what language it answered in*. This is the contract half of §1.7: even if CanonCore put a language on titles and synopses, CMPP responses carry no language field, so nothing could populate it. Adding it to the contract later is a breaking change to every provider. |
| **`QueriedById`** | **ABSENT — MEDIUM/HIGH.** The result records **whether the match came from an identifier lookup or from a name search**. That is a first-class confidence signal, and the prompt requires a confidence score that "must be capable of failing" while listing only agreeing identifiers as evidence. CanonCore's search/lookup split hands it this distinction for free — a claim arrived at by identifier is categorically stronger than one arrived at by title — but nothing says the applied statement records which route produced it. |

Two adjacent enums:

- [`MetadataRefreshMode = None, ValidationOnly, Default, FullRefresh`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Providers/MetadataRefreshMode.cs)
  — **four refresh intensities**, where `ValidationOnly` means "check the record is still coherent
  without asking anyone anything". **ABSENT — MEDIUM.** CanonCore has one enrichment operation with
  two thresholds; "re-verify without refetching" and "throw away everything and re-ask" are
  different buttons an owner will want.
- [`RefreshPriority = High, Normal, Low`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Providers/RefreshPriority.cs)
  — a priority on the refresh queue. **ABSENT — MEDIUM.** The item the owner is looking at right now
  must jump ahead of the 373,512 behind it, and with a background queue that is the only way it can.
- [`IForcedProvider`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Providers/IForcedProvider.cs)
  — a marker meaning "run even when internet providers are disabled for this library".
  **ABSENT — LOW.**
- [`IHasOrder.Order`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Providers/IHasOrder.cs)
  — **providers rank themselves**. DIVERGENT, and CanonCore is right: the source order is
  owner-declared, and a provider asserting its own precedence is not evidence.

---

## 6. THE USER AND PERMISSION MODEL

CanonCore is deliberately single-user: *"ONE row. Single user, one password, no signup, no
multi-tenancy, no RLS, no database roles, no transaction-scoped owner context. owner_id stays on
every table so multi-user is a later migration rather than a rewrite."* The useful question is not
"should CanonCore have Jellyfin's permission model" — it should not — but **what a later CanonCore
migration would have to invent, and whether anything in Jellyfin's shape says the deferral is or is
not safe.**

The answer, stated up front: **the `owner_id`-everywhere deferral is safe for the storage layer and
not safe for two other things** — the *enforcement* layer (§6.4), which cannot be retrofitted onto a
multi-placement DAG the way Jellyfin retrofits it onto a tree, and *authentication* (§6.5–§6.8),
which is not deferred at all because the product ships three clients in the first version.

### 6.1 The `User` entity — 25 scalar columns on the user row itself

[`Entities/User.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/User.cs)

| Group | Columns | Note |
|---|---|---|
| Identity | `Id` (Guid), `Username`, **`NormalizedUsername`** (L84, `ToUpperInvariant`), `Password`, `MustUpdatePassword` | The normalised-username column is the same idea as `ItemValue.CleanValue` (§3.3) applied to logins, and there is a 2026 migration `20260522092304_UpdateNormalizedUsername` that exists because it was got wrong. |
| Auth routing | `AuthenticationProviderId`, `PasswordResetProviderId` (L122, L132) | Which provider authenticates *this* user, stored per user. |
| Lockout | `InvalidLoginAttemptCount` (L140), `LoginAttemptsBeforeLockout` (L155) | See §6.8. |
| Activity | `LastActivityDate`, `LastLoginDate` (L145, L150) | Distinct: last seen versus last authenticated. |
| Session cap | `MaxActiveSessions` (L160) | 0 = unlimited. |
| Parental | `MaxParentalRatingScore`, `MaxParentalRatingSubScore` (L263, L268) | See §6.4. |
| Playback prefs | `SubtitleMode`, `PlayDefaultAudioTrack`, `AudioLanguagePreference`, `SubtitleLanguagePreference`, `RememberAudioSelections`, `RememberSubtitleSelections`, `EnableNextEpisodeAutoPlay`, `CastReceiverId` | |
| UI prefs | `DisplayMissingEpisodes`, `DisplayCollectionsView`, `HidePlayedInLatest`, `EnableUserPreferenceAccess`, `EnableAutoLogin`, `EnableLocalPassword` | |
| Concurrency | **`RowVersion` (L306) with `[ConcurrencyCheck]` and `OnSavingChanges()`** | |

**`RowVersion` is a finding in its own right — ABSENT, MEDIUM.** `User`, `Group`, `Permission`,
`Preference` and the abandoned `LibraryItem` all implement `IHasConcurrencyToken`: an integer
bumped on every save and checked on every update, i.e. **optimistic concurrency as an entity
contract**. §1.8 recorded that Jellyfin makes locking behaviour *configurable*; this is the other
half, and it is the same mechanism CanonCore already reaches for on the read projection
(*"revision-id versioning on projection writes"*). The prompt has it on one table and Jellyfin has
it on the ones two writers actually collide on. Worth deciding once whether it is a projection
detail or a row contract.

### 6.2 Permissions and preferences — two child tables, not columns

[`Permission.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Permission.cs)
is `(Id, UserId, Kind, Value bool, RowVersion)`;
[`Preference.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Preference.cs)
is the same shape with a string value.

- [`PermissionKind`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Enums/PermissionKind.cs)
  — **24 booleans**: `IsAdministrator`, `IsHidden`, `IsDisabled`, `EnableSharedDeviceControl`,
  `EnableRemoteAccess`, `EnableLiveTvManagement`, `EnableLiveTvAccess`, `EnableMediaPlayback`,
  `EnableAudioPlaybackTranscoding`, `EnableVideoPlaybackTranscoding`, `EnableContentDeletion`,
  `EnableContentDownloading`, `EnableSyncTranscoding`, `EnableMediaConversion`, `EnableAllDevices`,
  `EnableAllChannels`, `EnableAllFolders`, `EnablePublicSharing`,
  `EnableRemoteControlOfOtherUsers`, `EnablePlaybackRemuxing`, `ForceRemoteSourceTranscoding`,
  `EnableCollectionManagement`, `EnableSubtitleManagement`, `EnableLyricManagement`.
- [`PreferenceKind`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Enums/PreferenceKind.cs)
  — **13 list-valued** settings: `BlockedTags`, `AllowedTags`, `BlockedChannels`,
  `BlockedMediaFolders`, `EnabledDevices`, `EnabledChannels`, `EnabledFolders`,
  `EnableContentDeletionFromFolders`, `LatestItemExcludes`, `MyMediaExcludes`, `GroupedFolders`,
  `BlockUnratedItems`, `OrderedViews`.

**Classification: mostly REFUSED by construction, with three structural findings that survive.**

| Finding | Classification |
|---|---|
| **Permissions are ROWS, not columns.** Adding a permission is an INSERT into a lookup-keyed child table, not a migration on `users`. | **ABSENT — MEDIUM, and it is the same argument the prompt already makes for `properties`.** CanonCore's whole thesis is "a metadata catalogue lives in the DATABASE rather than in code"; Jellyfin arrived at the identical shape for permissions. If multi-user ever lands, the permission set should be a table for the reason the field set is. Note the wrinkle: Jellyfin's `Kind` is a C# enum persisted as an int, so it is *half* the pattern — the rows are data, the vocabulary is code. CanonCore's own rule (*"NO database enums anywhere"*, every vocabulary a lookup table with `retired` and `quarantine`) is the finished version. |
| **Half the enum is transcoding, Live TV or sync.** `EnableAudioPlaybackTranscoding`, `EnableVideoPlaybackTranscoding`, `EnableSyncTranscoding`, `EnableMediaConversion`, `EnablePlaybackRemuxing`, `ForceRemoteSourceTranscoding`, `EnableLiveTvAccess`, `EnableLiveTvManagement` — 8 of 24. | **REFUSED.** The prompt's transcoding and Live TV refusals delete a third of the permission model before it is written. |
| **The genuinely domain-shaped permissions are four**: `EnableContentDeletion` (+ `EnableContentDeletionFromFolders`), `EnableCollectionManagement`, `EnableAllFolders`/`EnabledFolders`/`BlockedMediaFolders`, `AllowedTags`/`BlockedTags`. | These are the four a CanonCore multi-user migration would actually have to invent, and **three of the four have no CanonCore analogue that works** — see §6.4. |

### 6.3 The abandoned schema had a GROUP model too — and it is the permission half of §3.8

[`Entities/Group.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Group.cs)
exists, compiles, and is `Group : IHasPermissions, IHasConcurrencyToken` with `Name`, its own
`ICollection<Permission>` and its own `ICollection<Preference>`. It is registered on **no** live
`DbSet` — its declaration sits in the commented block at
[`JellyfinDbContext.cs#L202`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/JellyfinDbContext.cs#L202)
as `public DbSet<Group> Groups => Set<Groups>();` — and the corresponding
`public virtual ICollection<Group> Groups` on `User` is commented out at
[`User.cs#L318-L323`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/User.cs#L318-L323),
alongside a commented `ICollection<ProviderMapping> ProviderMappings` (L330–L335).

Three things follow, and they extend §3.8 rather than repeat it:

1. **The abandoned schema is not only a bibliographic model, it is also a ROLE model.** `Group`
   holds permissions and preferences with exactly the shape `User` does, so the design was
   user-in-groups-with-inherited-permissions — the standard RBAC shape. Jellyfin shipped
   permissions-per-user instead, and the practical consequence is visible in the live product:
   configuring five family members means setting 24 booleans and 13 lists five times.
2. **`ProviderMapping` is external-identity federation** — the row that says "this local user is
   that LDAP/OAuth subject". Also drafted, also abandoned. The shipped substitute is the
   `AuthenticationProviderId` string column on `User` (§6.1), which can name a provider but cannot
   record an external subject id, so a plugin that authenticates against a directory has nowhere to
   store the mapping and must key on username.
3. **The commented block does not compile.** `Set<Groups>()`, `Set<LibraryItems>()`,
   `Set<MediaFiles>()` and `Set<SeriesMetadata()` are all syntactically wrong. This is the receipt
   for §3.8's "abandoned in place": the block has not been touched, let alone built, since it was
   commented out. The *entity classes* still compile because they are ordinary files the compiler
   still sees; the wiring has been dead for six years.

**Classification: DIVERGENT, and it is evidence for CanonCore's deferral rather than against it.**
Jellyfin drafted groups-with-roles, could not land it, and shipped flat per-user permissions.
CanonCore deferring the whole question to a later migration is the same call made earlier and more
cheaply — with one caveat, §6.4, which is the part the deferral does not cover.

### 6.4 How access is actually enforced — and the one thing that does NOT defer cleanly

Two layers.

**Layer 1, the HTTP policy layer.** Nine named policies registered at
[`ApiServiceCollectionExtensions.cs#L70-L88`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/Extensions/ApiServiceCollectionExtensions.cs#L70-L88):
`AnonymousLanAccess`, `CollectionManagement`, `Download`, `FirstTimeSetupOrDefault`,
`FirstTimeSetupOrElevated`, `FirstTimeSetupOrIgnoreParentalControl`, `IgnoreParentalControl`,
`LiveTvAccess`, `LiveTvManagement`, `LocalAccessOrRequiresElevation`, `RequiresElevation`,
`SubtitleManagement`, `LyricManagement`, four SyncPlay policies. Every one is an attribute on a
controller action. Three of these are structural rather than domain-specific:

| Policy | What it is | Classification |
|---|---|---|
| [`AnonymousLanAccessHandler`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Auth/AnonymousLanAccessPolicy/AnonymousLanAccessHandler.cs) — succeed with **no token at all** if the caller is on the local network | An unauthenticated-but-LAN-only tier, distinct from public and from authenticated | **ABSENT — MEDIUM.** CanonCore has exactly two tiers, owner and public-demo. A third — "on my LAN, no login" — is the posture most self-hosted single-owner installs actually want, and it is a policy decision that has to exist before the routes are written. |
| [`FirstTimeSetupHandler`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Auth/FirstTimeSetupPolicy/FirstTimeSetupHandler.cs) — succeed unconditionally while `IsStartupWizardCompleted` is false, then fall through to the normal admin check | **The setup door is a policy, not a route set.** The same endpoints serve setup and administration; the flag decides which rules apply. | **ABSENT — HIGH**, and it is the mechanism §2.3 was missing. This is a much better answer than a separate `/setup` route tree, because there is exactly one place the door can be left open. |
| [`DefaultAuthorizationHandler`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Auth/DefaultAuthorizationPolicy/DefaultAuthorizationHandler.cs) — the base check every authenticated route runs: remote-access permission, admin bypass, then parental *schedule* | A default-deny baseline that individual policies extend rather than replace | **ABSENT — MEDIUM.** |

**Layer 2, the per-item visibility check**, and this is where the finding is.
[`BaseItem.IsParentalAllowed(user, skipAllowedTagsCheck)`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/BaseItem.cs#L1836)
runs `IsVisibleViaTags` (L1922) then a parental-rating score comparison; `Folder` overrides it to
add the enabled/blocked-folder check
([`Folder.cs#L252-L275`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/Folder.cs#L252-L275)).
The query-side mirror is
[`InternalItemsQuery.SetUser(user)`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/InternalItemsQuery.cs#L519),
which turns the user's preferences into `ExcludeInheritedTags` / `IncludeInheritedTags` /
`MaxParentalRating` / `BlockUnratedItems` query terms.

Four findings, in ascending order of importance to CanonCore:

1. **`UserHasContentRestrictions`** ([same file, L517](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/InternalItemsQuery.cs#L517))
   — a precomputed boolean whose doc comment is *"Filters that only exist to hide content can be
   skipped entirely when this is false."* **ABSENT — LOW**, but it is the tell: per-user filtering
   is expensive enough that a mature product ships a fast path for the unrestricted case. A
   single-owner CanonCore is permanently on that fast path, which is a real cost the deferral avoids.
2. **Tag matching normalises with `RemoveDiacritics().ToLowerInvariant()`** at both the entity and
   query sides. Third independent appearance of "you cannot match user strings without a normalised
   form" (§3.3 `CleanValue`, §6.1 `NormalizedUsername`). Reinforces the §3.3 finding rather than
   adding one.
3. **`skipAllowedTagsCheck` exists solely for entities, and the comment says why.**
   [`Person.IsVisible`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Entities/Person.cs#L79-L87)
   is overridden to force it true, with:

   > *People don't carry the tags of the media they appear in, so the allowed tags check is skipped
   > for them; otherwise no person would be visible to users with allowed tags configured.*

   **ABSENT — MEDIUM/HIGH, and it lands directly on a rule CanonCore already has.** The prompt says
   entities live in the items table and are kept out of work-browsing surfaces **by kind**. Jellyfin
   proves the same split is needed a second time, in the *access* layer, and that it cannot be
   derived — a person carries none of the properties the filter tests, so an allow-list filter
   silently erases every person. Any CanonCore access rule written over statements will hit this on
   day one, and CanonCore's version is worse: its entity containers are real ordered containers
   ("the Doctors, in order"), so "entities are unreachable, therefore safe" is not available either.
4. **Tag-based access depends on `InheritedTags` — the materialised inheritance from §3.3 — and
   CanonCore structurally cannot have it.** This is the sharpest finding in §6.
   `ExcludeInheritedTags` / `IncludeInheritedTags` test *inherited* tags, and §3.3 established that
   `ItemValueType.InheritedTags = 6` is tags copied down the container tree as ordinary rows.
   Jellyfin can materialise that because **its containers form a tree and every item has one
   parent**. CanonCore's placements are a multi-parent DAG with duplicates allowed, so an inherited
   value arrives by several paths at once and "blocked via one parent, allowed via another" has no
   answer.

   **Classification: the prompt's refusal is CORRECT and now has a receipt.** WHAT NOT TO BUILD says
   *"No visibility system… 'Inherit from which parent?' has no answer once an item is multi-placed.
   Add it when multi-user arrives, which is when it first means anything."* Jellyfin's
   implementation is the proof: the only shipped inheritance-based access system in this category
   is built on an assumption CanonCore deliberately breaks.

   **But the deferral is only half safe, and this is the ABSENT part — MEDIUM/HIGH.** The prompt
   treats visibility as deferrable because `owner_id` is on every table. `owner_id` defers
   *ownership*. It does not defer *the enforcement mechanism*, and the enforcement mechanism is the
   part that has no design. When multi-user arrives, the question "how does a second user get
   restricted access to a DAG" will be new work with no precedent in this category to copy, because
   the one precedent depends on being a tree. That is worth writing down now as a known-hard
   follow-on, not discovering later as a surprise.

5. **Policy changes retroactively revoke live sessions.**
   [`DeviceAccessHost`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Users/DeviceAccessHost.cs)
   is a hosted service that subscribes to `OnUserUpdated` and logs out every device the user's new
   permissions no longer allow. `UpdateUserPolicy` does the same on disable
   ([`UserController.cs#L441-L449`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/UserController.cs#L441-L449)).
   **ABSENT — MEDIUM.** A permission system whose decisions are cached in a live token is wrong
   until something invalidates the token; this is that something.

6. **Three "last one standing" invariants**, enforced in the controller
   ([`UserController.cs#L428-L449`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/UserController.cs#L428-L449)):
   *"There must be at least one user in the system with administrative access"*, *"Administrators
   cannot be disabled"*, *"There must be at least one enabled user in the system."*
   **ABSENT — LOW today, MEDIUM at multi-user.** Every multi-user system independently discovers
   that the admin can lock themselves out. CanonCore's single `owners` row makes this vacuous now
   and unavoidable later.

### 6.5 Authentication: a session IS a device row

This is the whole of it, and it is smaller and better than expected.

[`Entities/Security/Device.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Security/Device.cs)
— `(Id, UserId, AccessToken, AppName, AppVersion, DeviceName, DeviceId, IsActive, DateCreated,
DateModified, DateLastActivity)`. The `AccessToken` is a `Guid.NewGuid().ToString("N")`, minted in
the constructor.

**There is no session table. The device row is the session, and the token is a column on it.**
Everything else follows:

| Mechanism | Where | Classification |
|---|---|---|
| The auth header carries **client identity, not just a credential**: `Authorization: MediaBrowser Client="…", Device="…", DeviceId="…", Version="…", Token="…"` ([`AuthorizationContext.GetAuthorization`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Security/AuthorizationContext.cs)) | Every request self-declares which app on which device it is | **ABSENT — HIGH.** This is what makes a device list, per-device revocation, per-device display preferences (§2.7) and "play this on the TV" (§2.2) all possible from one mechanism. A bare bearer token gives none of them. CanonCore ships a web app, a phone app and a TV app; without a client identity on the request the server cannot tell them apart, and every one of those features has to be retrofitted. Cheap now: it is four extra header fields and four columns. |
| Token is looked up as a device; failing that, as an **API key** ([same file](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Security/AuthorizationContext.cs)) | One credential slot, two credential classes | **ABSENT — MEDIUM.** |
| `DateLastActivity` is written at most **once every 3 minutes** per device | A write-amplification guard on the hot auth path | **ABSENT — LOW**, but exactly the kind of thing a "last seen" column costs if nobody thinks about it. |
| `CustomAuthenticationHandler` mints claims for `UserId`, `DeviceId`, `Device`, `Client`, `Version`, `Token`, `IsApiKey`, plus a **role** of `Administrator`/`User` ([source](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Auth/CustomAuthenticationHandler.cs)) | Auth resolves once per request into a principal every policy reads | **ABSENT — MEDIUM.** The prompt drops "a single-password cookie session" into the generated oRPC context's two null fields. What goes in those fields is exactly this list, and deciding it once is cheaper than three clients discovering it separately. |
| Re-authenticating the **same `DeviceId`** logs out the previous token for that device first ([`SessionManager.GetAuthorizationToken`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Session/SessionManager.cs)) | One live token per (user, device), not an unbounded pile | **ABSENT — MEDIUM.** |
| `MaxActiveSessions` enforced at authenticate time, 0 = unlimited | | **ABSENT — LOW.** |
| `RevokeUserTokens(userId, currentAccessToken)` — revoke everything **except the session doing the revoking** | Called on password change, on user delete, and on disable ([`UserController.cs` L163, L315, L451](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/UserController.cs)) | **ABSENT — HIGH.** "Change the password and sign out everywhere but here" is the single most important account-security operation, and for CanonCore it is the *answer to a question the prompt raises and does not close*: with one password and a TV in the living room, the only recovery from a lost device is a password rotation, and a rotation that also logs you out of the machine you are typing on is a product that fights its owner. |

### 6.6 API keys — a second credential class, deliberately unscoped

[`Entities/Security/ApiKey.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Security/ApiKey.cs)
— `(Id, Name, AccessToken, DateCreated, DateLastActivity)`. **No `UserId`.** `Name` is capped at 64
characters and is the only thing distinguishing one key from another.
[`ApiKeyController`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/ApiKeyController.cs)
is `GET/POST /Auth/Keys`, `DELETE /Auth/Keys/{key}`.

And they are **unrestricted**, said twice in the source:
[`DefaultAuthorizationHandler.cs#L53`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Auth/DefaultAuthorizationPolicy/DefaultAuthorizationHandler.cs#L53)
*"Api keys are unrestricted"*, and
[`UserPermissionHandler.cs#L30`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Auth/UserPermissionPolicy/UserPermissionHandler.cs#L30)
*"Api keys have global permissions"*. `CustomAuthenticationHandler` gives every API key the
`Administrator` role.

**Classification: ABSENT — HIGH for the capability, and the *design* is a warning rather than a
model.** CanonCore's whole ecosystem story is third-party tooling against a documented contract
(oRPC + a free OpenAPI reference is named as worth keeping from the scaffold), and a cookie session
is unusable from a script, a cron job, or a native app's background refresh. Something has to be the
non-interactive credential. But note what Jellyfin's version costs: a key is an unattributed,
unscoped, permanent root credential whose only metadata is a name a human typed. For a product that
is *about provenance* — where `source` on a statement names who asserted it — a credential class
that cannot say who or what it is, is the wrong shape. The right one is visible in the same file:
`Device` has a user, an app name, a version and a last-activity date, and API keys have none of it
because they were bolted on beside it.

### 6.7 Quick Connect — a hand-rolled device-code flow

[`QuickConnectManager.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/QuickConnect/QuickConnectManager.cs),
[`QuickConnectController`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/QuickConnectController.cs).

The flow, exactly: the TV calls `Initiate` and gets back a **6-digit code** and a **32-byte hex
secret**; the TV displays the code and polls `Connect?secret=…`; the owner, already signed in on a
phone or browser, calls `Authorize` with the code; the server runs `AuthenticateDirect` for that
user with **the TV's** `DeviceId`/`DeviceName`/`App`/`AppVersion`, and the TV's next poll returns a
real access token.

Details that are decisions:

- **10-minute expiry** (`Timeout = 10`), and authorising a request pushes its expiry *forward* by
  one minute rather than deleting it, *"as otherwise some clients wouldn't ever see that they have
  been authenticated"* — a race a naive implementation loses.
- Codes and secrets live in `ConcurrentDictionary` only: **nothing is persisted**, so a restart
  invalidates every pending pairing. Correct, and the reason it is safe to hold them in memory.
- The code is the *public* half (typed by a human, guessable-ish, 10^6 space) and the secret is the
  *private* half (only the initiating device has it). Polling is by secret, authorising is by code.
  Getting that backwards is the classic device-flow bug.
- `TryConnect` **throws unless `DeviceId`, `Device`, `Client` and `Version` are all present** — i.e.
  the flow is only possible because §6.5's client identity is on the request.
- Gated by `QuickConnectAvailable` on the server config (§1.1) and off by default.

**Classification: ABSENT — HIGH, upgraded from §1.1's MEDIUM now that the mechanism is visible.**
The prompt commits to a native Swift tvOS app and a single password. Typing a password on a tvOS
focus-engine keyboard is the exact pain this removes, and the prompt's own client analysis already
notes that React Native's `TextInput` is not built around the tvOS focus engine — text entry on that
platform is a known-bad surface the design goes out of its way to avoid elsewhere. This is ~150
lines, needs no persistence, and depends only on the client-identity header from §6.5. It is the
highest value-per-line item in this section.

### 6.8 Lockout and rate limiting — and what Jellyfin does NOT have

Lockout, at [`UserManager.cs#L677-L700`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Users/UserManager.cs):
on a failed authenticate, `InvalidLoginAttemptCount++`; if it reaches `LoginAttemptsBeforeLockout`,
`SetPermission(PermissionKind.IsDisabled, true)` and a `UserLockedOutEventArgs` is published. On
success the counter is reset to 0.

Three things about it:

1. **Lockout is permanent, not timed.** It sets the same `IsDisabled` flag an admin sets by hand.
   There is no cooldown and no self-service unlock: a locked-out user needs an administrator, and on
   a single-admin install a locked-out admin needs the database. Compare CanonCore: **one password,
   one owner, no second account to unlock the first.** A copied lockout design is an unrecoverable
   self-lockout.
2. **The default is no lockout at all.** [`UserPolicy.cs#L50`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Users/UserPolicy.cs#L50)
   sets `LoginAttemptsBeforeLockout = -1`, which
   [`UpdatePolicyAsync`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Users/UserManager.cs#L861-L866)
   maps to `null` — and `null` means the check never fires. (The comment on that switch is worth
   reading for its own sake: *"The default number of login attempts is 3, but for some god forsaken
   reason it's sent to the server as 0"* — the wire protocol overloads 0 to mean "default" and -1 to
   mean "off".)
3. **There is no rate limiting anywhere.** No ASP.NET rate limiter is registered; grep for
   `AddRateLimiter` in `Jellyfin.Server` and `Jellyfin.Api` returns nothing. Login is an unthrottled
   POST. Failed attempts are recorded — with the source IP — into the activity log
   ([`AuthenticationFailedLogger`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Events/Consumers/Security/AuthenticationFailedLogger.cs)),
   which is detection, not prevention.

**Classification: ABSENT — HIGH, and this is a place to diverge rather than copy.** CanonCore's
posture — **one password, one owner, an instance often exposed to the internet through a reverse
proxy** — is the worst case for an unthrottled login and the worst case for account lockout at the
same time. The two mechanisms that fit a single-owner product are the two Jellyfin does not have:
**throttle by source IP** (which needs `KnownProxies` from §1.6 to be correct, or every request
looks like `127.0.0.1` and the limiter is either useless or locks out everyone at once), and **an
exponential backoff on the password check itself**, which slows an attacker without ever creating a
state only a second administrator could clear. Note also §6.5: Jellyfin's PBKDF2 verify is not
constant-time-cheap, so the throttle and the hash cost interact.

For completeness, the credential handling itself is sound and worth copying:
[`CryptographyProvider`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Cryptography/CryptographyProvider.cs)
is **PBKDF2-SHA512, 210,000 iterations, 128-bit salt, 512-bit output**
([`Constants.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Cryptography/Constants.cs)),
stored as a self-describing PHC-style string (`$id$params$salt$hash`, parsed by
[`PasswordHash`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Cryptography/PasswordHash.cs))
so the algorithm and its parameters travel *with* the hash — and
[`DefaultAuthenticationProvider`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Users/DefaultAuthenticationProvider.cs)
**re-hashes on successful login** whenever the stored hash's algorithm or iteration count is not the
current default. **ABSENT — MEDIUM:** the self-describing hash plus rehash-on-login is what makes
"raise the iteration count in 2029" a one-line change instead of a forced password reset, and it is
free if decided at the first commit and expensive afterwards. (The 210,000 figure and the algorithm
choice should be re-verified against current OWASP guidance at implementation time rather than
copied from here.)

Two adjacent capabilities, both **ABSENT — LOW** for a single-owner product but worth naming so the
omission is deliberate: `IPasswordResetProvider` / `POST /Users/ForgotPassword` /
`ForgotPassword/Pin` (a PIN written to a file on the server, redeemable to reset a password — the
self-hosted answer to "no email service"), and `MustUpdatePassword` (a forced rotation flag).
`GET /Users/Public` is worth one line too: an **unauthenticated** list of non-hidden, non-disabled
users so a login screen can show avatars — and it returns *all* users, including hidden ones, while
`IsStartupWizardCompleted` is false
([`UserController.cs#L107-L118`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Api/Controllers/UserController.cs#L107-L118)).
CanonCore has one owner and nothing to enumerate, so this is **REFUSED-adjacent** — but it is a good
illustration of §2.6's two-tier public/private split being a decision made per endpoint.

### 6.9 What a later CanonCore multi-user migration would have to invent — the summary

| Thing | Deferrable behind `owner_id`? |
|---|---|
| Ownership of every row | **Yes.** This is what `owner_id` buys, and it is genuinely bought. |
| A permission vocabulary | **Yes**, and it should be a lookup table (§6.2), not an enum, by CanonCore's own rule. |
| Roles/groups | **Yes.** Jellyfin drafted them, abandoned them, and shipped without them for six years (§6.3). |
| Per-user progress and per-user display preferences | **Yes** — both already key on the owner. |
| **A per-item access decision over a multi-parent DAG** | **No.** §6.4.4: the only shipped design in this category depends on containers being a tree. This is new work whenever it happens, and nothing about the current schema makes it easier or harder — it just does not exist. |
| **Excluding entity kinds from the access filter** | **No, and it is not obvious.** §6.4.3: a filter written over statements silently erases every person, place and character, because they carry none of the properties it tests. The prompt already excludes entities from *browsing* by kind; the access layer needs the identical carve-out and nothing says so. |
| **Session/device identity** | **Not deferred at all** — §6.5. It is needed in the first version, for three clients, and it is the cheap enabler for revocation, Quick Connect, per-client display preferences and remote control. |


---

## 7. OTHER STRUCTURALLY SIGNIFICANT FINDINGS

Things encountered while sweeping that do not belong to any section above.

### 7.1 The migration system is TWO interleaved ladders, staged, backed up, and rollback-capable

This is the largest finding outside §3, and it lands directly on a decision the prompt has already
taken: *"MIGRATIONS ARE AN ORDERED, FORWARD-APPLICABLE LADDER FROM THE FIRST COMMIT… Cheap now;
expensive the moment anyone other than you is running it."* The prompt is right, and Jellyfin's
implementation says what "a ladder" has to grow into.

§3.9 recorded the 55 EF Core **schema** migrations. There is a second ladder beside it:
[`Jellyfin.Server/Migrations/Routines/`](https://github.com/jellyfin/jellyfin/tree/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/Migrations/Routines)
holds **40 code migrations**, and
[`PreStartupRoutines/`](https://github.com/jellyfin/jellyfin/tree/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/Migrations/PreStartupRoutines)
holds 5 more. They are things a schema migration cannot do: `MigrateUserDb`, `MigrateActivityLogDb`,
`MigrateLibraryDb` (the whole SQLite→EF cutover), `RemoveDuplicateExtras`, `FixPlaylistOwner`,
`MergeDuplicatePeople`, `CleanupOrphanedExtras`, `CleanupOrphanedExternalData`,
`RefreshCleanNamesAndValues`, `MigrateRatingLevels`, `UpdateNormalizedUsername`,
`RecomputeSeriesPresentationKey`, `MoveExtractedFiles`, `DisableLegacyAuthorization`.

| Mechanism | Detail | Classification |
|---|---|---|
| **One order across both ladders.** [`JellyfinMigrationAttribute`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/Migrations/JellyfinMigrationAttribute.cs) carries `Order` as a **`DateTime` parsed from a string**, matching the EF migration timestamp format, so a code migration and a schema migration sort into one sequence. | Data fixes and schema changes interleave — which they must, because a fix-up depends on the column existing and the next schema change depends on the data being clean. | **ABSENT — HIGH.** The prompt says "every schema change is a numbered migration". Half of what a real ladder carries is not a schema change. Two independently-numbered ladders is a bug waiting; one order over both is the design. |
| **Three stages**, [`JellyfinMigrationStageTypes`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/Migrations/Stages/JellyfinMigrationStageTypes.cs): `PreInitialisation` (before services exist — *"Should be avoided if possible"*), `CoreInitialisation` (with the DB migrations), `AppInitialisation` (after services are registered, last step before serving). | A migration declares how much of the application it needs to be alive. | **ABSENT — MEDIUM/HIGH.** CanonCore's ladder will contain migrations that need nothing but SQL and migrations that need the projection builder or the Safe External Fetch client. Those cannot run at the same point, and discovering that later means reordering a shipped ladder — which is exactly what the prompt says you cannot do. |
| **`RunMigrationOnSetup`** — a flag meaning "on a fresh install, mark this applied without running it". Used by `AddDefaultPluginRepository`, `AddDefaultCastReceivers`, `MoveTrickplayFiles`, etc. ([`JellyfinMigrationService.cs#L101-L104`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/Migrations/JellyfinMigrationService.cs#L101-L104)) | A fresh database does not need "fix the bad rows v10.8 wrote". Seeding happens once, from current defaults, and the historical ladder is stamped as done. | **ABSENT — HIGH.** Without this, a fresh install replays six years of data repair against an empty database, and every one of those migrations has to be written to be a no-op on empty. This is the difference between a ladder that stays cheap and one that becomes the slowest part of a first run. Note it is gated on the same `IsStartupWizardCompleted` flag as §6.4 — first-run state is load-bearing in a third place. |
| **`[JellyfinMigrationBackup]`** ([source](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/Migrations/JellyfinMigrationBackupAttribute.cs)) — a migration **declares what must be backed up before it runs** (`JellyfinDb`, `LegacyLibraryDb`, `Metadata`, `Trickplay`, `Subtitles`). The service merges the declarations across a stage, takes one backup, and **restores it if any migration in the stage throws** ([`JellyfinMigrationService.cs` L356-L404, L273-L290](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/Migrations/JellyfinMigrationService.cs)). | Rollback for migrations that cannot be transactionally rolled back, expressed as data on the migration itself. | **ABSENT — HIGH**, and it is the operational half of §1.9's backup finding. "Forward-applicable ladder" says what happens when it works. This says what happens when it does not — and a failed migration on someone else's instance, with no down-migration and no backup, is the one failure mode that loses a hand-curated catalogue. Note the logging when even the rollback fails: *"Manual intervention might be required to restore an operational state."* |
| `--mode` selects [`StartupMode`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/Configuration/StartupMode.cs) `= MediaServer, MigrateSystem, SeedSystem` — *migrate and shut down*, or *re-run seeding regardless of setup state*. | | **ABSENT — MEDIUM**, promoted from §1.10 now that the values are known. `MigrateSystem` is what a container orchestrator runs as an init step so the app never starts against an unmigrated database. |

### 7.2 A second HTTP server runs while the real one is starting or migrating

[`Jellyfin.Server/ServerSetupApp/SetupServer.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/ServerSetupApp/SetupServer.cs).

Before the application host exists, Jellyfin binds the configured port with a **minimal Kestrel
host** that: serves a templated status page
([`index.mstemplate.html`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/ServerSetupApp/index.mstemplate.html));
answers everything else **`503 Service Unavailable` with a `Retry-After: 005` header**; exposes
`/health`; exposes `/startup/logger` (the newest log file) **only to callers on the local network**;
and reports a coarse activity string from
[`StartupActivity`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/ServerSetupApp/StartupActivity.cs)
— `Starting up`, `Checking storage`, `Initializing server`, `Preparing migrations`,
`Restoring backup`, `Initializing services`, `Finishing startup`, and
`Running migration {n} of {total}`.

**Classification: ABSENT — MEDIUM/HIGH.** Three separate problems solved by one component, and all
three are CanonCore's: a long migration on a large catalogue is a black box unless something reports
progress; a client (or a reverse proxy, or a healthcheck) hitting a not-yet-started server needs a
`503` + `Retry-After` rather than a connection refused, or it will mark the instance dead; and
"send me your log" needs to work when the app is exactly the thing that will not start. Note the
LAN-only gate on the log endpoint — the same third tier as §6.4's `AnonymousLanAccessPolicy`, used
here because there is no user database to authenticate against yet.

### 7.3 An event bus where every event has a persisting consumer and a pushing consumer

[`IEventManager`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Events/IEventManager.cs)
is two methods (`Publish` / `PublishAsync`), and
[`Events/Consumers/`](https://github.com/jellyfin/jellyfin/tree/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server.Implementations/Events/Consumers)
holds **26 `IEventConsumer<T>` implementations in five folders** (Library, Security, Session, System,
Updates, Users). The naming is the finding: they come in two families.

- **`*Logger`** — writes an `ActivityLog` row. `AuthenticationFailedLogger`,
  `AuthenticationSucceededLogger`, `UserLockedOutLogger`, `UserPasswordChangedLogger`,
  `UserCreatedLogger`, `UserDeletedLogger`, `PlaybackStartLogger`, `PlaybackStopLogger`,
  `SessionStartedLogger`, `SessionEndedLogger`, `TaskCompletedLogger`,
  `SubtitleDownloadFailureLogger`, `LyricDownloadFailureLogger`, the plugin ones.
- **`*Notifier`** — pushes a WebSocket message. `UserUpdatedNotifier`, `UserDeletedNotifier`,
  `TaskCompletedNotifier`, `PendingRestartNotifier`, the plugin ones.

**Classification: ABSENT — MEDIUM, and it is the missing implementation half of §3.7.** §3.7 rated
the activity log ABSENT—HIGH as a *table*. This is how the table gets filled without every call site
knowing about it: the operation publishes a typed event, and *separately registered* consumers
decide to persist it, push it, or both. For CanonCore that shape matters more than usual, because
the events worth recording — a merge, a placement created, a review-queue rejection, a provider
disconnected, a statement superseded — are spread across the scanner, the enrichment run, the review
queue and the UI, and threading an audit-log write through all four by hand is how the log ends up
half-populated. Also note `AuthenticationFailedLogger` records the **source IP** in the entry's
`ShortOverview` — the audit log is where §6.8's missing rate limiter's evidence would live.

### 7.4 The WebSocket protocol: 34 message types with explicit per-stream subscription

[`SessionMessageType`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Model/Session/SessionMessageType.cs)
— `ForceKeepAlive`, `KeepAlive`, `GeneralCommand`, `UserDataChanged`, `Sessions`, `Play`,
`Playstate`, `SyncPlayCommand`, `SyncPlayGroupUpdate`, `RestartRequired`, `ServerShuttingDown`,
`ServerRestarting`, `LibraryChanged`, `UserDeleted`, `UserUpdated`, `RefreshProgress`,
`ScheduledTaskEnded`, `ScheduledTasksInfo`, `ActivityLogEntry`, five `Package*` messages, and then
the pairs: **`ActivityLogEntryStart`/`Stop`, `SessionsStart`/`Stop`,
`ScheduledTasksInfoStart`/`Stop`**.

| Feature | Classification |
|---|---|
| The subscribe/unsubscribe pairs — a client **opts in** to an expensive push stream rather than receiving everything on one socket | **ABSENT — MEDIUM.** The admin dashboard wants live scheduled-task progress; a TV does not, and pushing it costs the server a timer per connection. |
| `ForceKeepAlive` (server→client) as well as `KeepAlive` (client→server) | **ABSENT — LOW.** The server telling the client how often to ping is what survives a proxy with an idle timeout. |
| `LibraryChanged` and `RefreshProgress` as push messages, coalesced by `LibraryUpdateDuration` (§1.1) | **ABSENT — MEDIUM.** CanonCore rebuilds its read projection *wholesale*; a client holding a stale page has no way to learn it is stale, and polling a projection that changes rarely is the wrong shape. |

The prompt commits to background enrichment, background scans and a wholesale projection rebuild,
and specifies no push channel at all — so every "is it done yet" surface in three clients is a poll.
Worth a deliberate decision rather than silence.

### 7.5 `Emby.Naming` — filename parsing is its own assembly, and it is big

48 source files under
[`Emby.Naming/`](https://github.com/jellyfin/jellyfin/tree/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Naming),
fronted by
[`NamingOptions.cs`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Naming/Common/NamingOptions.cs)
— **924 lines that are almost entirely regex tables**: `EpisodeExpressions` (~35 patterns,
annotated with the Kodi conventions they implement), `MultipleEpisodeExpressions`,
`AudioBookPartsExpressions`, `CleanDateTimes`, `CleanStrings`, `VideoFileStackingRules`,
`StubTypes`, `Format3DRules`, `ExtraRules`, plus extension lists for video, audio, subtitle and
album-art files.

§5.2 rated `IItemResolver`/`IResolverIgnoreRule` ABSENT—MEDIUM. This is the same gap sized:
**"how does a path become a candidate item" is a library, not a function.** Four specifics:

| Finding | Classification |
|---|---|
| **`CleanStrings`** — a regex stripping `1080p`, `x265`, `BluRay`, `WEB-DL`, `PROPER`, `REPACK`, `DTS`, `HDR`, `[release-group]`, trailing ` - 07` and the `-trailer`/`-sample`/`-deletedscene` suffixes out of a filename before it is used as a title | **ABSENT — MEDIUM.** Every scanner needs this and nobody wants to write it. Directly feeds CanonCore's `sort_name` question from §1.1 and the matching confidence score: a title of `Movie.2019.1080p.BluRay.x265-GROUP` matched against a provider is a guaranteed low score for a reason that is not the provider's fault. |
| **`VideoFileStackingRules`** — two regexes recognising `…cd1`/`…part2`/`…disc-a` as consecutive parts of one runtime, resolved by [`StackResolver`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Naming/Video/StackResolver.cs) | **ABSENT — MEDIUM/HIGH**, and it is the mechanism behind §3.8's `MediaFileKind.AdditionalPart`. Two rows with role `media` on one CanonCore edition carry no statement that they are consecutive parts of one thing to watch, which breaks completion (two files, one position) and interacts with `edition_coverage`. |
| **`ExtraRuleType = Suffix, Filename, Regex, DirectoryName`** ([source](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Naming/Video/ExtraRuleType.cs)) — four *kinds* of rule for recognising an extra, because a trailer is `movie-trailer.mkv` in one library and `Trailers/whatever.mkv` in another | **ABSENT — LOW**, but a good shape: the recogniser is data with a rule-kind, not a chain of `if`. |
| **`.disc` stub files** — [`StubResolver`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Naming/Video/StubResolver.cs) + `StubFileExtensions = [".disc"]` + 20-odd `StubTypeRule`s (`dvd`, `bluray`, `hddvd`, `tv`, `vhs`, …). A **zero-byte file named `MyMovie.bluray.disc`** creates a library item with no playable media, typed by the physical format it stands for. | **This is the corroboration of the prompt's reason #1 for existing.** The prompt says *"IN JELLYFIN AND PLEX AN ITEM CANNOT EXIST WITHOUT A FILE"*, and this is the workaround Jellyfin's users are given: a fake file, in the media directory, whose extension encodes the medium — with the item's identity, sort order and container membership all still derived from a path. It is the strongest single piece of evidence in this sweep that media-independent items are a real unmet need, and that bolting them on afterwards produces this. **Classification: ADOPTED-by-contrast** — CanonCore's items are media-independent by default and need no equivalent. |

### 7.6 Shipped reference data — 45 rating tables, 105 translations, ISO country and language lists

[`Emby.Server.Implementations/Localization/`](https://github.com/jellyfin/jellyfin/tree/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Localization):

- **`Ratings/` — 45 JSON files, one per country** (`gb.json`, `us.json`, `jp.json`, …) plus a
  `0-prefer.json` fallback. Each maps rating *strings* to a numeric `{score, subScore}`, with
  multiple strings collapsing to one score (`gb.json`: `["0+", "All", "E", "G", "U"] → score 0`) and
  a `supportsSubScores` flag per country.
- **`Core/` — 105 translation files.**
- **`countries.json`** (ISO 3166 with display names and both alpha-2 and alpha-3),
  **`iso6392.txt`** (ISO 639-2 language codes).

**Classification: ABSENT — MEDIUM, and it is §1.7 and §2.6 arriving as *files* rather than as
settings.** Two things worth extracting independently of parental ratings, which CanonCore does not
need:

1. **A vocabulary that is a scale, not a set.** `{score, subScore}` exists because "is 15 stricter
   than PG-13" is not answerable by string comparison, and the sub-score exists because some
   countries' ratings tie at the same level. §3.8 found the same problem in `RatingSource`
   (`MinimumValue`/`MaximumValue`, so a TMDB 7/10 and a Rotten Tomatoes 70/100 are comparable).
   **CanonCore's `properties` table has `datatype`, `cardinality` and `validation` and nothing that
   says a vocabulary is ordered.** That is a live gap for any orderable lookup, and the fix is cheap
   at the properties table and awkward later.
2. **Reference data is versioned content that ships with the product and is not owner data.** The
   prompt's standing rule — *"A reference table holds no owner data and nothing minted outside a
   migration"* — already anticipates this; what it does not say is that the reference *content*
   (language lists, country lists, any ordered vocabulary) has to come from somewhere and be
   updatable, which in Jellyfin means a migration whenever a file changes
   (`20260302090000_MigrateRatingLevels` is exactly that). **ABSENT — LOW**, but it is the reason
   the seed-versus-migration boundary needs to be decided once.

### 7.7 Smaller things, recorded so they are not re-found

| Finding | Where | Classification |
|---|---|---|
| **`RemoteAccessPolicyResult = Allow, RejectDueToRemoteAccessDisabled, RejectDueToIPBlocklist, RejectDueToNotAllowlistedRemoteIP`** — a rejection carries *which rule* rejected it, not a bare bool | [source](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Common/Net/RemoteAccessPolicyResult.cs) | **ABSENT — LOW/MEDIUM.** The same instinct as §4.1's `TaskCompletionStatus` having four values instead of three: a security refusal that cannot say why is unsupportable. Applies to CanonCore's Safe External Fetch boundary, which has at least five distinct reasons to refuse a URL (scheme, RFC1918, redirect hop, size cap, timeout) and no stated way to report which. |
| **`/health` endpoint**, registered both on the real server ([`Startup.cs#L127`, `#L254`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Jellyfin.Server/Startup.cs)) and on the setup server (§7.2), so the path answers at every point in the lifecycle | | **ABSENT — MEDIUM.** Docker's `HEALTHCHECK`, a reverse proxy's upstream check and a `depends_on: service_healthy` all need one, and the detail that matters is that it must answer *before* the app is ready, with an honest answer. |
| **PBKDF2 hash strings are self-describing and re-hashed on login** | §6.8 | **ABSENT — MEDIUM** (recorded there). |
| **`InternalId` on `User`**, commented *"a temporary stopgap for until the library db is migrated… the index of this user in the library db"* | [`User.cs#L280`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/User.cs#L280) | Not a gap — a reminder. A surrogate key from a superseded storage layer, still in the shipped v12 entity six years after the comment was written, because something still joins on it. This is what "we will remove the compatibility column later" looks like at the end, and the prompt's *"Do not preserve backward compatibility. Remove obsolete paths"* is the rule that avoids it. |
| **`DeviceId.cs`** — the server generates and persists its own machine id to a file | [source](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/Emby.Server.Implementations/Devices/DeviceId.cs) | **ABSENT — LOW.** A stable instance identity, distinct from a hostname and from any config value, is what `System/Info/Public` reports and what a client keys its saved-server list on. |


---

# GAPS — ABSENT FROM CANONCORE

Everything the sweep classified **ABSENT**, consolidated and ranked. The ranking criterion is
**cost of deferral × certainty it will be needed**, not size. An item is high because deciding it
later is expensive or impossible, not because it is a lot of work.

Nothing here is a proposal to widen the stop condition. The prompt is explicit: *"Once all four are
green, further schema work is a NEW decision"*, and *"Reject on sight any proposal that grows the
document phase without bringing the render forward."* Tier A is the only part that argues for
touching the first commit, and it argues for **columns and contract fields**, not features.

---

## TIER A — decide before the first commit, because retrofitting is expensive or impossible

These are the ones where the prompt's own logic applies: *"Per-field provenance CANNOT be
retrofitted. The statements table and the properties catalogue exist from the first migration or
they never work."* Each of these has the same shape.

**A1. Language, at every level of the model and in the CMPP contract.**
§1.7, §1.2, §3.1, §3.8, §5.3. The single largest structural gap found.
The prompt is a bibliographic design and language is a bibliographic primitive that LRM, BIBFRAME
and Dublin Core all carry; it appears in the prompt exactly twice, both as an attribute of a
subtitle file. Four places it is missing, and they are one decision:
- **`statements` has no language column.** Two synopses in two languages are two indistinguishable
  competing claims and the source order picks one arbitrarily.
- **`title` is a column with no language**, so the Japanese and English titles of one work cannot be
  peers. Jellyfin's *abandoned* schema made `ItemMetadata.Language` a **required** 3-char column with
  metadata as a `ICollection<>` per item, plus separate `OriginalTitle`/`OriginalLanguage` — its
  shipped schema has one `Name` column, and the abandoned one is the right design (§3.8).
- **CMPP has no language parameter and no language in the response.** Jellyfin's
  `MetadataResult.ResultLanguage` is the provider declaring what language it answered in (§5.3).
  Adding either later is a breaking change to every provider, which is the definition of a
  first-commit decision.
- **There is no preference cascade.** Jellyfin has three levels — server, library, item (§3.1) —
  and CanonCore's groups scope *which providers are asked* but not *what is asked of them*.

**A2. Session and device identity on the request.**
§6.5, §2.2. The prompt commits to three clients and specifies *"a single-password cookie session"*.
A cookie is unusable from a Swift TV client and from a script. Jellyfin's request carries
`Client`, `Device`, `DeviceId`, `Version` and `Token`, and a **device row is the session** — one
table, one token column. That one decision is the sole prerequisite for: a visible device list,
per-device revocation without a password rotation (§6.5 `RevokeUserTokens`), Quick Connect (§6.7),
per-client display preferences (§2.7), and "play this on the TV from my phone" (§2.2). Every one of
those is a retrofit if the token is opaque and anonymous. Four header fields and four columns, now.

**A3. The migration ladder is two interleaved ladders, staged, with a declared backup.**
§7.1. The prompt already mandates *"an ordered, forward-applicable ladder from the first commit"* and
is right about why. What it does not say, and what a shipped ladder needs from day one:
one **order across schema migrations and data-fix migrations** (Jellyfin sorts both on a DateTime);
a **stage** on each migration saying how much of the app must be alive; **`RunMigrationOnSetup`**, so
a fresh install stamps the historical ladder applied instead of replaying six years of repair
against an empty database; and a **declared backup with automatic rollback on failure**, because a
forward-only ladder with no down-migration and no backup loses a hand-curated catalogue the first
time a migration throws on someone else's machine. Also §1.1: `PreviousVersion` must be *recorded*
or the ladder cannot know where it is.

**A4. Ordered vocabularies, and a normalised match key beside every raw value.**
§3.3, §7.6. Two gaps in the `properties`/vocabulary design, both cheap now:
- **`CleanValue`** — Jellyfin stores a normalised form beside the raw value so `Sci-Fi`, `sci fi`
  and `Science Fiction ` can be matched while the original survives for provenance. The same
  instinct appears three more times in the codebase (`NormalizedUsername` §6.1, diacritic-stripped
  tag matching §6.4, `RefreshCleanNamesAndValues` §7.1). CanonCore has `retired` and `quarantine`
  and no normalised form — and the archive's 71-value `medium` field with ~50 pieces of one-use
  wreckage is exactly what a normalised key makes actionable rather than a bucket.
- **A vocabulary that is a scale.** Jellyfin's rating tables carry `{score, subScore}` and
  `RatingSource` carries `MinimumValue`/`MaximumValue`, because "is 15 stricter than PG-13" and "is
  TMDB 7/10 better than RT 70/100" are not string comparisons. `properties` has `datatype`,
  `cardinality` and `validation` and nothing that says a lookup is ordered.

**A5. Artwork policy: rank, dimensions, a per-role limit and a quality floor.**
§1.4, §2.4, §3.5. The artwork table has role, licence, attribution and palette, and **no policy**.
Four missing columns/decisions, all awkward to backfill across thousands of fetched images:
`rank` (which of five posters is *the* poster — statements have `rank`, artwork does not);
`Width`/`Height` (Jellyfin stores both; without them no layout can reserve space and §1.4's
`MinWidth` floor cannot be enforced after the fact); a **`Limit` per role per kind** (a provider
returns dozens); and a **`MinWidth` floor** (otherwise a thumbnail lands as a backdrop). Jellyfin's
shipped defaults even set `Limit = 0` for roles it judged not worth fetching, with the reason in a
comment. Adjacent and equally cheap-now: a **blurhash** (§3.5) is computed at fetch time onto the
row for precisely the reason CanonCore extracts a palette at fetch time.

**A6. `BaseUrl` — serving under a subpath.**
§1.6. Self-hosted software goes behind a reverse proxy on a shared domain as a matter of course.
Next.js supports it (`basePath`) but only if it is set before anything hard-codes `/`; retrofitting
means auditing every route, every asset path and the API client. Pair it with **`KnownProxies` /
trusted-proxy configuration**, without which every request appears to come from `127.0.0.1` and any
rate limit, LAN check or audit log is keyed on the wrong address.

---

## TIER B — the product is not operable or not safe without these, but they can land after the cap

**B1. First-run setup, and the setup door as a *policy*.** §2.3, §1.1, §6.4.
*"One password, no signup"* does not say how the password is first set, what the app does before it
is set, or what stops the pre-setup surface being an open door. Jellyfin's answer is one flag
(`IsStartupWizardCompleted`) read by an authorization policy, so the same endpoints serve setup and
administration and there is exactly one place the door can be left open. The same flag also gates
§7.1's `RunMigrationOnSetup` and §6.7's public-user listing — first-run state is load-bearing in
three places.

**B2. Login throttling — and *not* Jellyfin's lockout.** §6.8.
Jellyfin has **no rate limiting at all** and a lockout that is off by default and, when on, sets the
permanent `IsDisabled` flag an admin must clear. CanonCore has one password, one owner, and **no
second account to unlock the first**, so a copied lockout is an unrecoverable self-lockout. The two
mechanisms that fit are the two Jellyfin lacks: throttle by source IP (needs A6's trusted proxies to
be correct) and exponential backoff on the password check. Credential handling itself is worth
copying: a self-describing PHC-style hash string plus **rehash-on-login**, so raising the iteration
count later is a one-line change rather than a forced reset.

**B3. Backup and restore of the owner's own catalogue.** §1.9, §2.6, §7.1.
WHAT NOT TO BUILD refuses *export, import and cross-instance sharing* — federation and interchange.
Backup is a different feature with a different threat model, and reading the refusal as covering it
leaves a self-hosted product where hand-curated placements exist in exactly one place. Note Jellyfin
makes **restore a startup mode** (`--restore-archive`), before the app is up, because a database
cannot be restored from inside an app that is using it — and its migration system takes a backup
*automatically* before risky migrations (A3).

**B4. A scheduled-task registry that is visible, runnable and cancellable.** §4.1, §4.4, §2.6.
The prompt commits to at least six recurring jobs and names none of them as schedulable: the
periodic scan (uncadenced), the **six-month TMDB cache eviction** (a licence term, so the job is a
compliance requirement), projection reconciliation, provider re-refresh, orphan collection, and
tombstone compaction. A self-hosted product where the owner cannot say "re-scan now" without
restarting is not finished. Jellyfin's framework is the shape: keyed and categorised tasks, four
trigger types (not cron), persisted triggers overriding code defaults, `MaxRuntimeTicks` **on the
trigger rather than the task**, a four-value completion status where `Aborted` ("we never found
out") is distinct from `Failed`, a persisted last-run result, and named restart policies
(`QueueIfNotRunning` vs `CancelIfRunningAndQueue`).

**B5. Contention rules between the scanner, enrichment, the projection rebuild and the review queue.**
§4.3. CanonCore has four things writing the same tables with no stated ordering. Jellyfin's rule is
explicit and its comment says why: heavy jobs open with `if (IsScanRunning) { log; return; }` —
**skip, do not queue**, because a queue of deferred heavy jobs all firing when the scan ends is
worse than skipping. Related and separate: expensive derived work must be able to run **outside**
the scan (§1.2, §5.2 `ILibraryPostScanTask`), which applies to palette extraction and the projection
rebuild for the same reason.

**B6. The scanner's missing states and rules.**
- **`LocationType.Offline`** (§2.11) — "this file exists but its volume is not mounted". CanonCore's
  content-derived identity handles a *moved* file beautifully and says nothing about a *temporarily
  absent* one. **A scanner with no Offline state and a periodic schedule is one failed mount away
  from a mass delete.**
- **Debounce filesystem events** (§1.1, `LibraryMonitorDelay` = 60s). The prompt says watchers may
  not fire; it says nothing about the ones that do, and a copy-in-progress file scanned at 3 bytes
  is the classic scanner bug.
- **Per-root watcher toggle** (§1.2) — one instance routinely has a local disk *and* an SMB mount,
  and a single global setting cannot be right for both.
- **What a path is, and what to ignore** (§5.2, §7.5) — `.DS_Store`, `@eaDir`, `.Trash-1000`,
  sample files. In Jellyfin this is a 48-file assembly.
- **Multi-part files** (§7.5, §3.8 `AdditionalPart`) — `cd1`/`cd2`/`part2` are one thing to watch,
  in order. Two CanonCore rows with role `media` on one edition say neither.

**B7. Concurrency caps on provider fan-out.** §1.1.
CanonCore reaches **all connected providers at once** for every item, in the background. With no
cap that is an unbounded fan-out that will rate-limit TMDB on the first bulk import — against a key
the owner supplied, under terms the product is responsible for honouring. Jellyfin has two separate
caps (scan fan-out, metadata refresh) and a third for image encoding (§1.1
`ParallelImageEncodingLimit`), which applies to CanonCore's per-artwork palette extraction.

**B8. Refresh: a cadence, a conditional request, and a "fill the gaps" job.**
§1.2, §5.2, §4.2, §5.3.
The six-month cache rule presupposes something re-fetching and nothing does. Three separate pieces:
a configurable **cadence** (`AutomaticRefreshIntervalDays`, 0 = never); a **conditional request** —
Jellyfin's `IHasItemChangeMonitor.HasChanged(item)`, or its HTTP equivalent (ETag /
`If-Modified-Since`) on the CMPP lookup, which is what turns "re-ask 373,513 items every N days"
into something an instance can run; and a **gap-fill job** scoped to fields that are still empty,
which is a different and much cheaper job than "refresh everything". Also §5.3's
`MetadataRefreshMode` — "re-verify without refetching" and "throw it all away and re-ask" are
different buttons — and `RefreshPriority`, because the item the owner is looking at now must jump
ahead of the 373,512 behind it.

**B9. Deleting must not destroy the watch-event log.** §4.2 `CleanupUserDataTask`.
The best single idea in the sweep. When an item is deleted Jellyfin **detaches** its user data and
holds it for **90 days**, so a file removed and re-added restores your progress. CanonCore's DELETE
section previews counts and then removes, and says nothing about `progress` or watch events for a
deleted edition. Given the prompt's own position that the event log is the truth and *"the event log
is what makes re-watches real"*, destroying it on delete is the one irreversible loss in a product
otherwise built on aliases and tombstones.

**B10. An owner-action audit log.** §3.7, §2.6, §7.3.
For a product whose thesis is provenance, recording where every *value* came from while recording
nothing about what the *owner* did is a hole in the thesis. "Why did this item change last Tuesday"
is unanswerable. The prompt already requires that **rejections are remembered** (§4.3's persistent
failure memo is the system-side twin: a provider lookup that fails permanently is otherwise retried
forever) and this is where they live. Jellyfin's shape: user-attributed, item-attributed,
severity-tagged, machine-readable `Type` plus a human-readable name, pruned on a schedule — filled
by **event consumers** (§7.3) rather than by threading a log write through the scanner, the
enrichment run, the review queue and the UI by hand.

**B11. May an import create rows the owner did not ask for — and can they be taken back?**
§1.1, §1.2, §4.2, §5.1, §5.2. Asked five times by five different mechanisms and never answered:
`EnableGroupingMoviesIntoCollections`, `AutomaticallyAddToCollection`, `TmdbUpcomingEpisodesTask`
creating virtual items on a schedule, `IMediaSegmentProvider.CleanupExtractedData` as a *mandatory*
interface method, and `IPlugin.OnUninstalling`. Containers are CanonCore's entire product and a TMDB
collection or a wiki category is a ready-made ordering, so "may an import mint a container or a
placement" is squarely in range. The **reverse operation** is the half that is easy to miss:
Jellyfin's virtual items are attributable to the job that made them, so turning the job off un-makes
exactly those and nothing else. CanonCore's statements all carry `source`, so it *has* the
attribution — but the prompt never says a source can be disconnected and its claims retracted, and
"I connected TMDB, I regret it, take its rows back out" is a question an owner will ask.

**B12. Orphan collection for minted entities.** §4.2 `PeopleValidationTask`.
Imports mint `person`, `character`, `place` and `organisation` items. When the statements that
referenced them are superseded or their placements deleted, nothing collects them: an entity with no
statements, no placements and no files is invisible in every surface and permanent in the database.
(The *other* half of that task — weekly de-duplication of people keyed on name — is the receipt for
CanonCore's surrogate-id decision being right, and is work CanonCore never has to do.)

**B13. Enough of a provider health model to stop trusting a dead URL.** §5.1 `PluginStatus.Malfunctioned`.
A provider is a user-supplied URL, reached for every item, in the background, with no circuit
breaker and no state recording "this has 500'd on the last two hundred calls". Jellyfin records
`Malfunctioned` as a first-class state. A dead provider must be markable dead without the owner
disabling it by hand.

---

## TIER C — real gaps the prompt's own commitments imply, sized smaller

**C1. `NextUp`** (§2.8) — *the most CanonCore-shaped feature in Jellyfin's API and the prompt does
not name it.* "What comes after the thing I finished" is a query over the ordering, and an item in a
Release-order container and a Story-order container has **two** next-ups. The prompt's rule that the
container is navigation state and never identity makes this genuinely hard, which is the argument
for naming it rather than against.

**C2. `adjacentTo` — prev/next** (§2.10). Same family as C1, and directly implied by the model:
prev/next in CanonCore is *placement*-relative with a different answer per container.

**C3. Sparse fieldsets on list queries** (§2.10). Jellyfin's `fields` is a 49-value enum. CanonCore
assembles an item payload from a statements table plus a projection, and nothing says what a **list
row** is versus a **detail row** — so without it every list request materialises every statement for
every row.

**C4. Exposing the change sequence** (§2.10). The prompt mandates a change sequence on every table,
which is a better mechanism than Jellyfin's `minDateLastSaved` timestamp — and never says it is
*exposed*, which is the entire point of having one.

**C5. Pagination that survives 373,513 rows** (§2.10) — offset pagination degrades exactly at that
size — plus **alphabet-jump navigation** (`nameStartsWith`), because a remote control cannot scroll
11,285 stories.

**C6. A push channel** (§7.4). Background enrichment, background scans and a wholesale projection
rebuild, across three clients, with no way to learn that a page is stale. Jellyfin pushes
`LibraryChanged`, `RefreshProgress` and task progress over a WebSocket with explicit per-stream
subscription.

**C7. Server-stored display preferences, per user per view per client** (§2.7). A shelf sorted on
the phone comes up sorted on the TV. With `localStorage` unavailable on tvOS this is the only place
that state can live, and the storage location is an API and schema decision rather than a screen
decision.

**C8. Server-side image resizing, or a decision not to** (§2.4). A TV grid of 60 posters either
pulls 60 full-size images from a third-party CDN or the server resizes. This is a **legal** posture
as much as a performance one — TMDB grants no rights in images — and §5.2's
`IRemoteImageProvider.GetImageResponse` is the clean answer: the fetch belongs to whoever holds the
terms. Pair with an immutable content-hash in the image URL so images cache forever (§2.4).

**C9. A directory picker, and the boundary it needs** (§2.5). Somebody has to type scanner-root
paths into a browser, for a server usually in Docker where the container's view of the filesystem is
not the user's. Every product in this category ships one. It is also an authenticated
directory-listing API over the whole host — a **second** security boundary, and the prompt's Safe
External Fetch boundary covers outbound URLs only.

**C10. Multi-value import splitting, with a delimiter allowlist** (§1.2). `"Lennon/McCartney"`
splits and `"AC/DC"` must not. The Tardis archive's Semantic MediaWiki properties are exactly this
shape, so CanonCore hits it on the first import. The allowlist detail — that splitting is wrong for
specific literal values — is the kind of thing only a shipped product learns.

**C11. Match provenance: identifier-lookup versus name-search** (§5.3 `QueriedById`). A claim
arrived at by identifier is categorically stronger than one arrived at by title. CanonCore's
search/lookup split hands it this distinction for free and nothing records which route produced an
applied statement — and the prompt separately requires a confidence score *capable of failing*.

**C12. Per-kind source order, or an explicit refusal** (§1.3). The prompt argues correctly that a
per-*group* source order gives two answers for one field on one page. That argument does not reach
**kinds**: an item has exactly one `kind`, so a per-kind order has a single answer per page. Worth
an explicit refusal rather than silence. Same section: **which provider's poster wins is undecided**,
because artwork sits outside the statements/source-order mechanism entirely (see A5's `rank`).

**C13. Intervals over an edition's timeline, from a provider** (§1.2, §3.6 `MediaSegment`).
Intro/outro/recap/preview ranges. CanonCore has intervals without provenance (`edition_coverage`)
and provenance without an interval datatype (`statements`). The two halves exist separately and
nothing says which one this is, or whether it is a third table.

**C14. Extras** (§2.11, §3.1). A deleted scene is not an edition (different content) and does not
belong in the release-order container (it never aired). The model *can* express it — a `work` item
with a `category` statement in an extras container — and the prompt never walks the case. "Which
container does a featurette go in" is a day-one question. Jellyfin needed a migration
(`CleanupOrphanedExtras`) and a `RemoveDuplicateExtras` routine to clean up getting it wrong.

**C15. A LAN-only access tier** (§6.4). CanonCore has two tiers, owner and public demo. "On my LAN,
no login" is the posture most single-owner installs want and is a policy decision that has to exist
before routes are written. Related: `EnableRemoteAccess` (§1.6) as a whole-instance switch.

**C16. Distinguishing timestamps** (§3.1). The prompt mandates *"timestamps… on every table"*
without saying which. Jellyfin has five, and the pair that matters is `DateLastRefreshed` (when a
provider last spoke) versus `DateModified` (when the record changed) — without it B8's refresh
cadence is not implementable.

**C17. Operational surfaces** (§2.6, §7.2, §7.7): `System/Info` and its **unauthenticated public
subset**; free space per path; log listing and download from the UI (the realistic support path for
self-hosted software, and it must work when the app is what will not start); a `/health` endpoint
that answers honestly *before* the app is ready; a startup status page returning `503` +
`Retry-After` with migration progress (§7.2); and a stable instance id distinct from the hostname.

**C18. Config/data/cache/log as four independently relocatable directories** (§1.10, §1.1).
Determines what a Docker user has to mount and what is safe to wipe — and log and cache retention
need jobs behind them (§4.2), because self-hosted software that never prunes its own logs fills a
disk.

**C19. A named instance, a UI culture separate from the metadata language, and a CORS policy**
(§1.1). The *separation* in the second is the insight: which language the chrome is in and which
language you want synopses in are independent settings.

**C20. Path substitution** (§1.6 `PathSubstitutions`). The same library reachable at two paths — a
Docker bind mount versus the host, or direct play from an SMB share. Direct-play-only makes
CanonCore **more** exposed to this, not less. Adjacent: the URL a *client* should use is not the URL
the server listens on.

**C21. Server discovery** (§1.6 `AutoDiscovery`). The prompt ships two native clients and never says
how either finds the server.

**C22. Per-item and per-container "second ordering" cases the model can express and the prompt never
names** (§1.1 `DisplaySpecialsWithinSeasons`). Specials interleaved into the season they aired
between is shipped by Jellyfin as a boolean because it has nowhere to put it; it is the single most
common real-world multi-ordering demand in TV, and it is CanonCore's core competence.

**C23. Enrichment observability** (§4.1). Applying *"runs in the background against the thresholds"*
with no stated way to watch it, cancel it, or see that it finished.

---

## Lower priority, recorded so the omission is deliberate

Remote control / cast a session to another device (§2.2) · similar items, suggestions, instant mix
(§2.8) · search typeahead with per-type breakdown (§2.8) · upcoming/unreleased items (§2.8, cheap
given the model already has zero-edition works) · recently-added including "series with new
episodes" (§2.8) · subtitle and lyric fetching as provider capabilities (§1.2) · a provider
declaring *which image roles it supplies* (§5.2) · external-URL providers, "view this on the
source's site" (§5.2) · embedded container metadata as a source, which would be a source that is
neither the Owner nor a provider (§1.2) · automatic series grouping across folders (§1.2) ·
`ExternalIdInfos` introspection (§2.9) · typed remote search per kind (§2.9) · per-user
ratings/likes/favourites as distinct from the field-value `rank` favourite (§3.4) · remembered
audio/subtitle track selection (§3.4) · progress deliberately shared across two encodes of one film
(§3.4 `CustomDataKey`) · `IsResumable`/`IsPlayed` as query filters (§2.10) · ETags per item (§2.10)
· branding and custom CSS (§2.3) · client log upload (§2.6) · Prometheus metrics (§1.1) ·
`BindToUnixSocket` (§1.10) · SyncPlay / group watch (§2.1) · inactive-session auto-close (§1.1) ·
slow-response warning threshold (§1.1) · staggered default clock times for heavy jobs (§4.3) ·
per-medium completion thresholds (§1.1) · "do not save a position at all near the start" (§1.1) ·
`IsHidden` tasks computed from configuration (§4.1) · a fallback font for subtitle rendering (§1.5)
· rejection reasons carried as an enum rather than a bool, applied to Safe External Fetch (§7.7) ·
password reset / forced rotation (§6.8) · last-admin invariants (§6.4, vacuous until multi-user).

---

## What the prompt REFUSES, and what the refusals buy

Recorded because the sweep quantified it, and because a refusal that is paying is worth knowing.

| Refusal | What it deletes |
|---|---|
| No transcoding, no ffmpeg, no quality ladders | **~52 configuration options** and the whole hardware-acceleration matrix (§1.5); ~40 API endpoints and the HLS/segment machinery (§2.1); **7 of 18 scheduled tasks** (§4.2); 6 of 24 permission flags (§6.2) |
| Nothing about broadcast | LiveTv alone is **>10% of Jellyfin's API** — 40 endpoints — plus 2 scheduled tasks and 2 permission flags (§2.1, §4.2, §6.2) |
| A provider is a URL, not a plugin | The entire ABI-compatibility problem (`targetAbi`, minimum-version fallbacks), in-process untrusted assemblies, plugins mounting routes on the server's own API, and plugin-injected HTML config pages (§5.1) |
| No `.nfo`, no artwork scanning, no uploads | `MetadataSavers`, `LocalMetadataReaderOrder`, `ImageSavingConvention`, `SaveMetadataHidden`, and the image upload/delete half of a 45-endpoint controller (§1.2, §2.4) |
| Fixed Postgres, not a pluggable database | *"When creating a new migration, you always have to create migrations for all providers"* — the ladder multiplied by the number of backends, forever (§3.9) |
| The favourite is the lock; no per-field lock flag | Jellyfin's ceiling is **a boolean lock on nine hardcoded fields** (§2.11 `MetadataField`) |
| No visibility system | §6.4: the only shipped design in this category depends on containers being a tree, which CanonCore deliberately is not. The refusal is correct and now has a receipt |
| Surrogate entity ids, not names | A **weekly scheduled task** that de-duplicates people by name and deletes orphans, plus two 2026 migrations merging duplicate people and artists (§4.2, §7.1) |
| No backward compatibility | `EnableLegacyAuthorization`, `X-Emby-*` headers, and `User.InternalId` — *"a temporary stopgap"* still shipping six years later (§6.5, §7.7) |

## What the sweep CONFIRMS about the prompt's four claims

- **Claim 2, ordering lives in filenames / one global ordering.** Verified structurally:
  [`LinkedChildConfiguration`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/src/Jellyfin.Database/Jellyfin.Database.Implementations/ModelConfiguration/LinkedChildConfiguration.cs)
  declares `HasKey(e => new { e.ParentId, e.SortOrder })` in the **v12 EF schema**, so reordering
  rewrites the primary key and two items cannot share a position (§3.2).
- **Claim 3, nobody stores per-field provenance.** Verified exactly:
  [`MetadataResult.Provider`](https://github.com/jellyfin/jellyfin/blob/66d038c4034b9e07a4ac39822e4f0080e9a2201a/MediaBrowser.Controller/Providers/MetadataResult.cs)
  is a field on a transient class registered on no `DbSet` (§5.3). The abandoned schema got within
  one level — per-*record* provenance via `ItemMetadata.Sources` — and stopped, which is the
  near-miss that proves the finer cut matters (§3.8).
- **Claim 1, an item cannot exist without a file.** Verified, and the workaround is the evidence:
  **zero-byte `.disc` stub files** whose extension encodes the physical medium (§7.5).
- **The abandoned normalised schema is the strongest artefact in the sweep** (§3.8, §6.3): 36 entity
  classes that still compile, wired to a `DbSet` block that has not compiled in six years,
  describing `Library → LibraryItem → Release → MediaFile` with per-language metadata collections,
  reified credits, rating scales, and a `Group`-based role model. **That is approximately CanonCore's
  items → editions → files, attempted by this product and abandoned in place.** It is simultaneously
  the strongest evidence *for* the model and the strongest evidence for the prompt's scope
  discipline — they reached it, could not land it, and shipped a 65-column flat table with a JSON
  blob in it instead.

---

STATUS: complete
