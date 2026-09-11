# Verification: every Jellyfin and Emby claim in the decision log

Every factual claim about Jellyfin or Emby made in `docs/adr/` (72 ADRs) and in `SPEC.md`, checked
against the source that owns it: the `jellyfin/jellyfin` and `jellyfin/jellyfin-web` source at a
named tag, the projects' own issue tracker and advisories, `jellyfin.org`, and — for Emby — the
`MediaBrowser/Emby` repository and Emby's own developer documentation.

Nothing here is confirmed from memory. Every CONFIRMED verdict carries a fetch performed during
this run: a `gh api` call against a named ref, a `gh` issue/release read, or a `curl` of a public
page, with the quote and the date checked.

**Method.** Files were fetched individually, never cloned:

```
gh api repos/jellyfin/jellyfin/contents/<path>?ref=v12.0 --jq '.content' | base64 -d
gh search code '<term> repo:jellyfin/jellyfin'
gh api repos/jellyfin/jellyfin/security-advisories
curl -s https://jellyfin.org/posts/<slug>/
```

**Version baseline, established first so every later verdict is anchored.** Checked 2026-09-10
against `gh api repos/jellyfin/jellyfin/releases`:

| Tag | Published |
|---|---|
| `v12.0` | 2026-09-08T01:38:39Z |
| `v10.11.11` | 2026-06-06T16:18:54Z |
| `v10.11.0` | 2025-10-20T00:45:19Z |

So the current release at the time of this run is 12.0, released two days before it, and the
10.11 line runs from 2025-10-20. Claims written in the present tense are checked against `v12.0`;
claims explicitly about 10.11 are checked against `v10.11.0` or the 10.11 release notes.

Run date: 2026-09-10.

---

## 1. `MetadataResult.Provider` exists, is written once, and is never persisted — ADR 0026

**Claim.** ADR 0026: a single primary source with others filling gaps "is Jellyfin's design ... and it is
why Jellyfin can never say where a value came from". The supporting detail under test: Jellyfin's
`MetadataResult` carries a `Provider` field, but it lives on a transient object and is never stored.

**CONFIRMED.** Fetched 2026-09-10 at ref `v12.0`:

```
gh api "repos/jellyfin/jellyfin/contents/MediaBrowser.Controller/Providers/MetadataResult.cs?ref=v12.0" --jq '.content' | base64 -d
```

`MediaBrowser.Controller/Providers/MetadataResult.cs` declares the field, line 46:

```csharp
46:        public string Provider { get; set; }
```

It is assigned in exactly one place, `MediaBrowser.Providers/Manager/MetadataService.cs` line 974,
inside the per-provider loop of `ExecuteRemoteProviders`:

```csharp
972                    if (result.HasMetadata)
973                    {
974                        result.Provider = provider.Name;
...
998                        MergeData(result, temp, [], replaceData, false);
```

and the merge on line 998 copies only fields of `result.Item` into `temp`. `MergeBaseItemData`
(MetadataService.cs:1136-1396) never reads `sourceResult.Provider` and never writes
`targetResult.Provider`, so the value assigned on line 974 is discarded when the loop moves to the
next provider. `grep -n` over the whole of `MetadataService.cs` and `ProviderManager.cs` at `v12.0`
returns no other reference to it.

The persistence side is settled by the schema. The stored item entity
(`src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/BaseItemEntity.cs`, line 177) has
exactly one provider-shaped member:

```csharp
177:    public ICollection<BaseItemProvider>? Provider { get; set; }
```

and `BaseItemProvider` is an external-id pair, not a provenance record — the whole class, lines 8-29:

```csharp
 8: public class BaseItemProvider
13:     public Guid ItemId { get; set; }
18:     public required BaseItemEntity Item { get; set; }
23:     public required string ProviderId { get; set; }
28:     public required string ProviderValue { get; set; }
```

So Jellyfin persists "this item is tmdb:1234", never "this item's Overview came from TMDb". The
ADR's conclusion holds, and the reason is sharper than the ADR states: the information exists
in memory for the length of one loop iteration and is then dropped on the floor.

---

## 2. Jellyfin merges first-non-empty-wins and discards the losing answers — ADR 0026, SPEC "HOW ENRICHMENT WORKS"

**Claim.** "it merges first-non-empty-wins and DISCARDS the losing answers".

**CONFIRMED, with one qualification worth carrying.** `MediaBrowser.Providers/Manager/MetadataService.cs`
at ref `v12.0`, fetched 2026-09-10. `MergeBaseItemData` is a flat run of guards in exactly this
shape, one per field (lines 1149-1395). Representative, verbatim:

```csharp
1161            if (replaceData || string.IsNullOrEmpty(target.OriginalTitle))
1162            {
1163                target.OriginalTitle = source.OriginalTitle;
1164            }
...
1176            if (replaceData || !target.CommunityRating.HasValue)
1177            {
1178                target.CommunityRating = source.CommunityRating;
1179            }
```

Providers are iterated in configured order (`ExecuteRemoteProviders`, line 963:
`foreach (var provider in providers)`), each result merged into the same accumulator `temp` on line
998. With `replaceData` false — the ordinary refresh — a field is written only while the accumulator
is still empty, so the first provider with a non-empty value wins and every later answer for that
field is evaluated and thrown away. There is no second slot to put it in: see section 1.

**The qualification.** Not every field is scalar-overwrite. Four list fields union instead of
dropping, when not replacing — `Studios` (1266-1276), `Tags` (1278-1288), `ProductionLocations`
(1290-1300) and `RemoteTrailers` (1338-1345), each of the form:

```csharp
1272                else
1273                {
1274                    target.Studios = target.Studios.Concat(source.Studios).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
1275                }
```

That is still not provenance — the union has no record of which provider contributed which member —
but "DISCARDS the losing answers" is precisely true of scalars and false of those four lists. If the
sentence is doing argumentative work, say "discards the losing answer for every single-valued field".

---

## 3. `IndexNumber` is merged first-non-empty-wins and is not among the nine lockable `MetadataField` values — not asserted in the repo

**Where it appears.** Neither `docs/adr/` nor `SPEC.md` makes this claim; `grep -n -i "IndexNumber|lockable|locked field"`
over both returns nothing. It arrived with the verification brief, so it is checked here for the
record rather than as a correction to anything.

**CONFIRMED.** `MediaBrowser.Model/Entities/MetadataField.cs` at ref `v12.0`, fetched 2026-09-10,
is nine members and nothing else:

```csharp
11:        Cast,
16:        Genres,
21:        ProductionLocations,
26:        Studios,
31:        Tags,
36:        Name,
41:        Overview,
46:        Runtime,
51:        OfficialRating
```

`IndexNumber` — the episode or track number — is not among them, and its merge in
`MetadataService.cs` (lines 1194-1197) carries no lock check at all, unlike its neighbours:

```csharp
1194            if (replaceData || !target.IndexNumber.HasValue)
1195            {
1196                target.IndexNumber = source.IndexNumber;
1197            }
```

Compare line 1186, `if (!lockedFields.Contains(MetadataField.Genres))`, which wraps the identical
shape. So a user can lock a title, an overview or a runtime against the next refresh, and cannot
lock the number that decides where the episode sits in its season. This is direct support for
ADR 0018 and ADR 0022: the ordinal is exactly the field the incumbents leave underprotected.

---

## 4. `ImageFetcherOrder`, `ImageOption {Type, Limit, MinWidth}`, the null-width escape, and the refresh backfill — SPEC `providers` and `artwork`

**Claims.** Three, all in `SPEC.md`: a per-role image limit and quality floor "following Jellyfin's
`ImageOption {Type, Limit, MinWidth}` including its null-width escape"; artwork source order is
"Jellyfin's ImageFetcherOrder"; and width, height and blurhash are re-derivable, "which is exactly
how Jellyfin backfills them on refresh".

**CONFIRMED, all three.** All fetched 2026-09-10 at ref `v12.0`.

`MediaBrowser.Model/Configuration/ImageOption.cs` is the whole class, three properties, limit
defaulting to one:

```csharp
 9:        public ImageOption()
10:        {
11:            Limit = 1;
12:        }
18:        public ImageType Type { get; set; }
24:        public int Limit { get; set; }
30:        public int MinWidth { get; set; }
```

`MediaBrowser.Model/Configuration/TypeOptions.cs` carries the ordering lists and the per-type
accessors — line 324 `public string[] ImageFetcherOrder { get; set; }`, alongside
`MetadataFetcherOrder` (320), with `GetLimit` (356) and `GetMinWidth` (361) resolving per
`ImageType` and falling back to `DefaultImageOptions` (line 14) and then to `DefaultInstance`
(line 12). The shipped defaults set `MinWidth = 1280` for backdrops (lines 22, 71, 120, 162).

**The null-width escape is real and is the interesting part.**
`MediaBrowser.Providers/Manager/ItemImageProvider.cs` line 559:

```csharp
558            var eligibleImages = images
559                .Where(i => i.Type == type && (i.Width is null || i.Width >= minWidth))
```

An image whose width the provider did not report passes the floor rather than failing it. The
multi-image path says the same thing the other way round, line 674:

```csharp
674                if (image.Width.HasValue && image.Width.Value < minWidth)
675                {
676                    continue;
677                }
```

Unknown width is never a rejection. That is the escape SPEC.md means, and it is worth copying for
the same reason: a floor that rejects unknowns silently empties the candidate set for any provider
that omits dimensions.

**The backfill.** `Emby.Server.Implementations/Library/LibraryManager.cs`, line 2519:

```csharp
2519        private bool ImageNeedsRefresh(ItemImageInfo image)
2520        {
2521            if (image.Path is not null && image.IsLocalFile)
2522            {
2523                if (image.Width == 0 || image.Height == 0 || string.IsNullOrEmpty(image.BlurHash))
2524                {
2525                    return true;
2526                }
```

and `UpdateImagesAsync` (2543), which selects `item.ImageInfos.Where(ImageNeedsRefresh)` (2549) and
re-derives all three off the stored bytes:

```csharp
2605                    size = _imageProcessor.GetImageDimensions(item, image);
2606                    image.Width = size.Width;
2607                    image.Height = size.Height;
...
2619                    var blurhash = _imageProcessor.GetImageBlurHash(image.Path, size);
2620                    image.BlurHash = blurhash;
```

Note the precondition on line 2521: `image.IsLocalFile`. The backfill works because Jellyfin has the
file. That is precisely SPEC.md's argument for storing the bytes rather than hotlinking, and it is
evidence for the decision rather than merely an analogy to it.

---

## 5. The 10.11 migration framework: ISO8601 order, three stages, `RunMigrationOnSetup`, five backup booleans — ADR 0047, SPEC "MIGRATIONS"

**Claim.** ADR 0047 and SPEC.md both take the mechanics from Jellyfin: an ISO8601 ordering key rather
than an integer, three stages "following Jellyfin's names and order", `RunMigrationOnSetup` as the
fresh-install rule, and a backup declaration whose "Jellyfin equivalent names five targets and
includes on-disk artefact directories, not just the database".

**CONFIRMED on every structural point; one sub-claim CONTRADICTED on the sense of the flag.**
Fetched 2026-09-10 at ref `v10.11.0` (the release that introduced it) and re-fetched at `v12.0`,
where all three files are byte-identical. Note the real path is `Jellyfin.Server/Migrations/`, not
`Jellyfin.Server.Migrations/`.

`Jellyfin.Server/Migrations/JellyfinMigrationAttribute.cs`:

```csharp
18:    /// <param name="order">The ordering this migration should be applied to. Must be a valid DateTime ISO8601 formatted string.</param>
33:    public JellyfinMigrationAttribute(string order, string name, string? key)
34:    {
35:        Order = DateTime.Parse(order, CultureInfo.InvariantCulture);
57:    public DateTime Order { get; }
```

with real usage in `Jellyfin.Server/Migrations/Routines/MigrateLibraryDbCompatibilityCheck.cs`
line 17: `[JellyfinMigration("2025-04-20T19:30:00", nameof(MigrateLibraryDbCompatibilityCheck))]`.

`Jellyfin.Server/Migrations/Stages/JellyfinMigrationStageTypes.cs` — exactly three, in this order,
in the British spelling SPEC.md copies:

```csharp
14:    PreInitialisation = 1,
20:    CoreInitialisation = 2,
25:    AppInitialisation = 3
```

`Jellyfin.Server/Migrations/JellyfinMigrationBackupAttribute.cs` — exactly five booleans, three of
them on-disk artefact directories:

```csharp
14:    public bool LegacyLibraryDb { get; set; }
19:    public bool JellyfinDb { get; set; }
24:    public bool Metadata { get; set; }
29:    public bool Trickplay { get; set; }
34:    public bool Subtitles { get; set; }
```

**The correction.** `RunMigrationOnSetup` means the opposite of what a reader of SPEC.md's sentence
"Each migration declares whether it runs on a new database ... Jellyfin's `RunMigrationOnSetup`"
would guess from the surrounding argument. The attribute (lines 45-47) documents it as "whether the
annoated migration should be executed on a fresh install", and `JellyfinMigrationService.cs`
lines 101-104 shows the default (`false`) is what suppresses replay:

```csharp
101        if (!serverConfig.IsStartupWizardCompleted)
102        {
103            logger.LogInformation("System initialisation detected. Seed data.");
104            var flatApplyMigrations = Migrations.SelectMany(e => e.Where(f => !f.Metadata.RunMigrationOnSetup)).ToArray();
```

Those are then written into the history table as already-applied so they never run. So the flag is
opt-IN to running on setup, not opt-out. SPEC.md's mechanism is right and its citation is right;
only a reader who assumed the flag's polarity from the name would get it backwards.

---

## 6. The startup compatibility check probes `pragma_table_xinfo` for three columns — SPEC "MIGRATIONS"

**Claim.** "Jellyfin's own check has to fingerprint the schema by probing `pragma_table_xinfo` for
three columns that happen to have arrived in the right releases, because its old database carries no
version stamp at all."

**CONFIRMED.** `Jellyfin.Server/Migrations/Routines/MigrateLibraryDbCompatibilityCheck.cs` at ref
`v10.11.0`, fetched 2026-09-10 (same file at `v12.0`, renamed
`20250420193000_MigrateLibraryDbCompatibilityCheck.cs`, identical body):

```csharp
52:    private static void CheckMigratableVersion(SqliteConnection connection)
53:    {
54:        CheckColumnExistance(connection, "TypedBaseItems", "lufs");
55:        CheckColumnExistance(connection, "TypedBaseItems", "normalizationgain");
56:        CheckColumnExistance(connection, "mediastreams", "dvversionmajor");
...
63:                cmd.CommandText = $"Select COUNT(1) FROM pragma_table_xinfo('{table}') WHERE lower(name) = '{column}';";
...
68:                    throw new InvalidOperationException("Your database does not meet the required standard. Only upgrades from server version 10.9.11 or above are supported. Please upgrade first to server version 10.10.7 before attempting to upgrade afterwards to 10.11");
```

Three columns exactly: `TypedBaseItems.lufs`, `TypedBaseItems.normalizationgain`,
`mediastreams.dvversionmajor`.

The "no version stamp at all" half checks out two ways at `v10.10.7`. The applied-migration list
lived in a config file rather than the database — `Jellyfin.Server/Migrations/MigrationsListStore.cs`
lines 5-13, "A configuration that lists all the migration routines that were applied",
`StoreKey = "migrations"`, with `MigrationOptions.cs` line 24
`public List<(Guid Id, string Name)> Applied { get; }`. And the old SQLite layer sets no version
pragma: `Emby.Server.Implementations/Data/BaseSqliteRepository.cs` uses only `cache_size`,
`locking_mode`, `journal_mode`, `journal_size_limit`, `synchronous`, `page_size`, `temp_store` and
`PRAGMA table_info`. So an arbitrary `library.db` handed to 10.11 really does carry nothing to read a
version from, and column-probing is the only fingerprint available. This is the strongest available
argument for SPEC.md's version table.

---

## 7. "Added in 2025 to a 2018 codebase, across hundreds of thousands of installs" — ADR 0047

**Dates CONFIRMED; the install count UNFOUNDED.**

The framework landed 2025-04-28:

```
gh api "repos/jellyfin/jellyfin/commits?path=Jellyfin.Server/Migrations/JellyfinMigrationAttribute.cs&per_page=100" \
  --jq '.[-1] | {sha, date: .commit.committer.date, message: .commit.message}'
{"date":"2025-04-28T00:18:08Z","message":"Unified migration handling (#13950)","sha":"e66c76fc3405512b90735b5669278410f7974b1f"}
```

The backup attribute followed six weeks later, `d5672ce4`, 2025-06-03, "Add declarative backups for
migrations (#14135)". Both shipped in 10.11.0 on 2025-10-20. The repository's own age:
`gh api repos/jellyfin/jellyfin --jq '{created_at, pushed_at}'` returns
`{"created_at":"2018-12-09T06:36:45Z", ...}`, corroborated by jellyfin.org/docs/general/about:
"The Jellyfin project was started in early December 2018 primarily as a result of Emby's decision to
take their next release (4.x) closed-source." Both checked 2026-09-10.

Carry one caveat: Jellyfin is a fork of Emby, so the *code* is older than the 2018 repository. "A
2018 codebase" is right for the repo and understates the code.

**"Hundreds of thousands of installs" has no source.** jellyfin.org's front page, its about page, the
10.11.0 release post and the January 2026 State of the Fin publish no install, user, server or
instance count, and the project ships no telemetry by design. The nearest public number is a
different quantity: Docker Hub reports `pull_count: 416,673,407` for `jellyfin/jellyfin`
(`curl -s https://hub.docker.com/v2/repositories/jellyfin/jellyfin/`, 2026-09-10), which counts CI
runs and re-pulls and excludes the Debian, RPM, Windows and portable channels entirely.

What would settle it: a figure published by Jellyfin itself, from `repo.jellyfin.org` fetch logs or
plugin-manifest request logs. Neither is published. The fix is to drop the number or to cite the
Docker pull count as what it is.

---

## 8. Jellyfin "uses precisely this, having migrated away from GUID keys to get it" — SPEC "MIGRATIONS"

**CONFIRMED, in the project's own words.** The old interface at ref `v10.10.7`,
`Jellyfin.Server/Migrations/IMigrationRoutine.cs`:

```csharp
 8:    internal interface IMigrationRoutine
11:        /// Gets the unique id for this migration. This should never be modified after the migration has been created.
13:        public Guid Id { get; }
...
21:        /// Gets a value indicating whether to perform migration on a new install.
23:        public bool PerformOnNewInstall { get; }
```

It was deleted by the same commit `e66c76f` that added the timestamp attribute, and is absent from
the `v12.0` tree. The GUID survives only as a deprecated legacy path —
`JellyfinMigrationAttribute.cs` lines 31-32 and 67:

```csharp
31:    /// <param name="key">[ONLY FOR LEGACY MIGRATIONS]The unique key of this migration. Must be a valid Guid formatted string.</param>
32:    [Obsolete("This Constructor should only be used for Legacy migrations. Use the (Order,Name) one for all new ones instead.")]
67:    public Guid? Key { get; }
```

PR jellyfin/jellyfin#13950 (merged 2025-04-28) states the reason itself:

> "Switched declaration of CodeMigrations from a Key(GUID) based system to a Date one to bring in
> line with EFCore"

Also worth recording for section 5: `PerformOnNewInstall` → `RunMigrationOnSetup` is a rename of the
same concept, which is why the new flag reads "do run on setup".

---

## 9. "You MUST be running Jellyfin 10.10.7 before upgrading", and the `library.db.old` recipe — not asserted in the repo

**Where it appears.** Neither ADR 0047/0048 nor SPEC.md carries these sentences; they came with the
verification brief. Checked anyway, because ADR 0047's "a declared floor — the oldest version we
will migrate from" is argued from this case.

**Both CONFIRMED verbatim**, https://jellyfin.org/posts/jellyfin-release-10.11.0
(`article:published_time` 2025-10-19), fetched with `curl -sL` on 2026-09-10. TL;DR section:

> "You MUST be running Jellyfin 10.10.7 before upgrading to 10.11.0! You may be fine with Jellyfin
> 10.9.11 but this is less-extensively tested. Upgrading from any other versions is NOT supported and
> WILL fail; upgrade to 10.10.7 first, then upgrade to 10.11.0."

> "The upgrade will make a backup of your existing library.db file named library.db.old. This file
> can be used to recover should the upgrade fail. Once you have successfully upgraded and Jellyfin
> 10.11.0 is running smoothly, you may delete this backup. If you need to try the migrations again
> due to a failure, stop Jellyfin, rename this file back to library.db, then start Jellyfin again,
> and the migration will be re-attempted."

Two precisions. The GitHub release `v10.11.0` does not carry the 10.10.7 sentence — it says
"**WARNING**: There are **very important release notes** to review before upgrading!" and links the
post, so cite the blog URL. And `library.db.old` is published as a **migration-retry** mechanism, not
a downgrade path to a running 10.10; the documented route back to 10.10 is the full restore in
section 12.

---

## 10. "The remaining migration issues ... are unlikely to be resolved" — ADR 0047, SPEC "MIGRATIONS"

**Claim.** SPEC.md: "Jellyfin's honest outcome without one is that 'the remaining migration issues ...
are unlikely to be resolved' — some instances simply stay broken." ADR 0047 says the same in
paraphrase.

**CONFIRMED verbatim, and the ellipsis is doing work that should be disclosed.** Post: *State of the
Fin*, https://jellyfin.org/posts/state-of-the-fin-2026-01-06, published date per its own JSON-LD
`2026-01-06T00:00:00.000Z`, fetched 2026-09-10. The sentence:

> "The remaining migration issues are largely isolated, one-off cases and are unlikely to be
> resolved."

Its immediate context:

> "We have been moving quickly to address these issues, delivering four additional point releases
> with over 100 changes since the initial 10.11.0 release. To date, most point releases have focused
> on resolving general and migration-related issues. The remaining migration issues are largely
> isolated, one-off cases and are unlikely to be resolved. Most general issues have already been
> fixed…"

The quote is real and the reading — some instances simply stay broken — survives. But the elided
words are "largely isolated, one-off cases", which is a scoping the ellipsis hides. Quote the
sentence whole, or quote the preceding sentence with it; the argument for a quarantine state does not
need the harsher reading.

---

## 11. The 10.11 backup "can only restore systems on which the backup was originally made" — ADR 0048, SPEC

**CONFIRMED verbatim.** https://jellyfin.org/posts/jellyfin-release-10.11.0, section "Internal Backup
& Restore Support", fetched 2026-09-10:

> "The backup and restore system can only restore systems on which the backup was originally made, so
> this is not a tool to migrate from other OS's or 3rd party containers."

The docs page https://jellyfin.org/docs/general/administration/backup-and-restore does not repeat the
sentence, so cite the release post. That page does corroborate section 5's backup attribute from the
user side: "Feature History: 10.11: Builtin Backup feature was added", with selectable contents
"Database. Always enabled.", "Metadata.", "Subtitles.", "Trickplay." — four of the five booleans,
`LegacyLibraryDb` being the migration-only fifth.

---

## 12. "Restore is the only path back from a bad upgrade — the exact consequence Jellyfin documents for its own users" — ADR 0048, SPEC

**CONFIRMED, in two places.** Both fetched 2026-09-10.

https://jellyfin.org/docs/general/administration/backup-and-restore, "Why Backing Up is Important":

> "In addition, Jellyfin does not have a downgrade mechanism. This is very important to understand;
> once your Jellyfin instance has been started with a new version, any pending migrations are
> immediately applied, and your Jellyfin data will no longer work with the old version. The only way
> to restore your active instance back to the old version is to restore a backup."

https://jellyfin.org/posts/jellyfin-release-10.11.0, TL;DR:

> "This is a second reminder to take a full backup before upgrading, as this is the only way to
> downgrade back to a previous version if you find that you need to."

The docs also state the mechanism ADR 0047 relies on: migrations apply on first start of the new
version, and from that moment the data is no longer readable by the old one. A forward-only ladder
and "restore is the only way back" are the same fact stated twice.

---

## 13. "Jellyfin's 27 `TranscodeReason` values are each a comparison against a profile the client sent" — ADR 0041, SPEC "PLAYBACK"

**CONTRADICTED, twice over.** Both the count and the "each" fail. Fetched 2026-09-10.

**The count is 28 at `v12.0`.** `MediaBrowser.Model/Session/TranscodeReason.cs` declares 28 members
(lines 11-46). A name-level diff against `v10.11.11` returns exactly one added line,
`VideoRotationNotSupported = 1 << 27` (line 27). So 27 was correct for the 10.11 line and went stale
when 12.0 shipped on 2026-09-08 — two days before this run. Any number written into a spec here
rots on Jellyfin's release cadence; write "roughly thirty" or cite the ref.

**"Each is a comparison against a client-sent profile" is false for at least four members.**
`GetTranscodeReasonForFailedCondition` (`MediaBrowser.Model/Dlna/StreamBuilder.cs`:307-398) does map
a failed `ProfileCondition` to a reason, and the profile is genuinely client-supplied —
`Jellyfin.Api/Controllers/MediaInfoController.cs`:135-145 takes `playbackInfoDto?.DeviceProfile` from
the request body, falling back to the session's stored capabilities. But:

- `UnknownVideoStreamInfo` and `UnknownAudioStreamInfo` are **dead values**. A code search returns
  exactly one file for each — the declaration itself; `grep -c` over `StreamBuilder.cs` at `v12.0`
  returns 0.
- `AudioIsExternal` is a property of the media alone, `StreamBuilder.cs`:2485-2488:
  ```csharp
  2485            if (audioStream.IsExternal)
  2486            {
  2487                failures |= TranscodeReason.AudioIsExternal;
  2488            }
  ```
- `DirectPlayError` is the "no reason found" fallback, `StreamBuilder.cs`:1423-1426:
  ```csharp
  1423            if (failureReasons == 0)
  1424            {
  1425                failureReasons = TranscodeReason.DirectPlayError;
  1426            }
  ```

Six further `ProfileConditionValue` cases are stubbed to return `0` with a `// TODO` (`Has64BitOffsets`,
`IsAvc`, `NumAudioStreams`, `NumVideoStreams`, `PacketLength`, `VideoTimestamp`), so some profile
comparisons fail and name nothing.

**What survives, and it is the half ADR 0041 actually needs.** Playability in Jellyfin is computed as
the file's probed properties checked against a device profile the client sent, and the failure is
reported as a named reason. That is intact. What is not true is that the reason list is a clean
closed set of comparisons: it has dead entries, a catch-all, and a media-only member. If anything
that strengthens the ADR — the escape hatch Jellyfin needed is exactly the "we could not say" case
CanonCore has to name honestly.

---

## 14. "Jellyfin's `PlaybackProgressInfo` carries no duration field at all" — ADR 0042, SPEC "PLAYBACK"

**CONFIRMED.** `MediaBrowser.Model/Session/PlaybackProgressInfo.cs` at ref `v12.0` (120 lines,
fetched 2026-09-10) declares exactly 21 properties: `CanSeek`, `Item`, `ItemId`, `SessionId`,
`MediaSourceId`, `AudioStreamIndex`, `SubtitleStreamIndex`, `IsPaused`, `IsMuted`, `PositionTicks`,
`PlaybackStartTimeTicks`, `VolumeLevel`, `Brightness`, `AspectRatio`, `PlayMethod`, `LiveStreamId`,
`PlaySessionId`, `RepeatMode`, `PlaybackOrder`, `NowPlayingQueue`, `PlaylistItemId`. No duration,
runtime or length. `PositionTicks` is a cursor; `PlaybackStartTimeTicks` is a wall-clock stamp.
The file is identical at `v10.11.11`.

The neighbours close the loophole. `PlaybackStartInfo.cs`:6 is
`public class PlaybackStartInfo : PlaybackProgressInfo { }` — an empty subclass. `PlaybackStopInfo`
is a separate ten-property class with no duration either. The `Item` property is a `BaseItemDto`,
which does carry `RunTimeTicks`, but the server never uses the client's copy for play state:
`SessionManager.OnPlaybackProgress` passes the **library** item, and `UserDataManager.cs`:443 reads
`item.GetRunTimeTicksForPlayState()`, which is `BaseItem.cs`:3044-3047, `return RunTimeTicks ?? 0;` —
the server's own metadata.

So ADR 0042's sentence is exactly right, and the reason it matters is the next section: when the
server's own runtime is missing, there is no channel by which the client could supply one.

---

## 15. `if (!hasRuntime) { data.Played = true; }` marks an item watched on its first progress report — SPEC "PLAYBACK"

**CONFIRMED, including the load-bearing part: it fires on a progress report, not only on stop.**
Fetched 2026-09-10 at ref `v12.0`.

`Emby.Server.Implementations/Library/UserDataManager.cs`:

```csharp
 439        public bool UpdatePlayState(BaseItem item, UserItemData data, long? reportedPositionTicks)
 443            var runtimeTicks = item.GetRunTimeTicksForPlayState();
 445            var positionTicks = reportedPositionTicks ?? runtimeTicks;
 446            var hasRuntime = runtimeTicks > 0;
...
 492            else if (!hasRuntime)
 493            {
 494                // If we don't know the runtime we'll just have to assume it was fully played
 495                data.Played = playedToCompletion = true;
 496                positionTicks = 0;
 497            }
```

The comment is Jellyfin's own. The progress path reaches it —
`Emby.Server.Implementations/Session/SessionManager.cs`:

```csharp
 965        private void OnPlaybackProgress(User user, BaseItem item, PlaybackProgressInfo info)
 973            if (positionTicks.HasValue)
 974            {
 975                _userDataManager.UpdatePlayState(item, data, positionTicks.Value);
 976                changed = true;
...
 986            {
 987                _userDataManager.SaveUserData(user, item, data, UserDataSaveReason.PlaybackProgress, CancellationToken.None);
```

so a single progress report against an item with no runtime sets `Played = true` and persists it
under `UserDataSaveReason.PlaybackProgress`. Two qualifications: line 923 guards with
`if (libraryItem is not null && !isAutomated)` (the server's own keep-alive ticks are skipped, real
client reports are not), and `PlayCount` is not incremented on this branch — only `Played` is set.

**v12.0 widens the blast radius**, `SessionManager.cs`:992-995:

```csharp
 992                if (data.Played == true && item is Video playedVideo)
 993                {
 994                    playedVideo.PropagatePlayedState(user, true);
 995                }
```

A spurious `Played = true` now propagates to every alternate version of the item and clears their
resume points. `v10.11.11` has the identical `!hasRuntime` block (`UserDataManager.cs`:349-354) and
no propagation. SPEC.md's "fabricated true" is not a hypothetical: it is shipped behaviour that got
worse two days ago.

---

## 16. One `LastPlayedDate` that every play overwrites; marking unwatched clears count and date — ADR 0019, SPEC "progress"

**CONFIRMED, with a precision correction on "one row per user and item".** Fetched 2026-09-10 at ref
`v12.0`.

The stored fields, `src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/UserData.cs`:

```csharp
  26    public long PlaybackPositionTicks { get; set; }
  32    public int PlayCount { get; set; }
  44    public DateTime? LastPlayedDate { get; set; }
  50    public bool Played { get; set; }
```

Every play overwrites, `SessionManager.cs`:844-849:

```csharp
 844        private void OnPlaybackStart(User user, BaseItem item)
 846            var data = _userDataManager.GetUserData(user, item);
 848            data.PlayCount++;
 849            data.LastPlayedDate = DateTime.UtcNow;
```

Marking unwatched clears both, `MediaBrowser.Controller/Entities/BaseItem.cs`:2233-2240:

```csharp
2233        protected static void ResetPlayedState(UserItemData data)
2237            data.PlayCount = 0;
2238            data.PlaybackPositionTicks = 0;
2239            data.LastPlayedDate = null;
2240            data.Played = false;
```

**The correction.** The primary key is three columns, not two —
`ModelConfiguration/UserDataConfiguration.cs`:15,
`builder.HasKey(d => new { d.ItemId, d.UserId, d.CustomDataKey })`. `CustomDataKey` is a
metadata-derived identity key, not a per-viewing discriminator: `UserDataManager.cs`:370-388 picks a
single row by walking `item.GetUserDataKeys()` in order, and its own comment (364-365) says extra
rows are leftovers "under keys from older metadata". One row is live per user and item, which is what
ADR 0019 means; the phrasing "one row per user and item" is loose about the key.

**No append-only history exists anywhere in core.** All 76 entity files under
`Jellyfin.Database.Implementations/Entities/` were listed; the only log-shaped table is
`ActivityLog.cs`, a server audit log with no positions or durations. Per-play history in the Jellyfin
ecosystem lives in the out-of-tree Playback Reporting plugin. ADR 0019's "every media server surveyed
READS FROM a mutable state row" holds for Jellyfin, and the stronger form — Jellyfin *stores* nothing
else — holds too.

---

## 17. "Save every 10 seconds ... what Jellyfin's web client ships" — SPEC "PLAYBACK"

**CONFIRMED.** `jellyfin-web`, `src/components/playback/playbackmanager.js` at ref `v12.0`, fetched
2026-09-10:

```javascript
3343        function onPlayerProgressInterval() {
3344            const player = this;
3345            sendProgressUpdate(player, 'timeupdate');
3346        }
3348        function startPlaybackProgressTimer(player) {
3349            stopPlaybackProgressTimer(player);
3351            player._progressInterval = setInterval(onPlayerProgressInterval.bind(player), 10000);
3352        }
```

Identical at `v10.11.11`, same file, line 3251. `sendProgressUpdate` reaches the server at line 3785
via `reportPlaybackProgress`, guarded by `if (streamInfo?.started && !streamInfo.ended)`.

---

## 18. The ebook reader returns `duration() { return 1000 }` — ADR 0020, SPEC "progress"

**CONFIRMED verbatim, and unchanged in the release that shipped two days ago.** `jellyfin-web`,
`src/plugins/bookPlayer/plugin.js`, fetched 2026-09-10 at three refs — `master`
(head `3bddedd93993dcd3a723ef937ce5c8f1b7506ec3`, 2026-09-09), `v12.0`, and `v10.11.11` — identical
text at all three. At `master` and `v12.0`, lines 111-117:

```javascript
111	    currentTime() {
112	        return this.progress * 1000;
113	    }
114
115	    duration() {
116	        return 1000;
117	    }
```

(the same two methods at `v10.11.11`, lines 103-109). `this.progress` is a 0..1 fraction, set at line
369 from `book.locations.percentageFromCfi(...)` and initialised `this.progress = 0;` at line 59. So
every book does report as exactly 1000 ms long, as ADR 0020 and SPEC.md both say, quoted exactly
rather than paraphrased.

Worth knowing: the neighbouring stubs are the same shape — `getBufferedRanges()` returns a fixed
`{start: 0, end: 10000000}` (lines 119-124) and `volume()` returns 100. The whole clock-shaped
surface is faked, not just these two methods. That is the argument for a medium-agnostic locator in
one line: the interface demanded a clock, so the book player invented one.

---

## 19. "jellyfin-web#2582 has been open on it since 2021" — SPEC "progress"

**The metadata is CONFIRMED; the characterisation is off and should be tightened.**
`gh api repos/jellyfin/jellyfin-web/issues/2582`, fetched 2026-09-10:

```json
{"number":2582,"title":"Book Position Not Remembered","state":"open",
 "created_at":"2021-04-11T15:20:46Z","closed_at":null,"comments":13,
 "labels":["confirmed","playback"]}
```

Open since 2021-04-11, still open, labelled `confirmed`. But the issue is titled "Book Position Not
Remembered" and its body is about position not persisting — "the book player plugin seems to have
support for restoring the position … The problem is that `startPositionTicks` is never populated."
It is not an issue filed against `duration()`.

The connection is made inside the thread, not in the title. RemcoSchrijver, 2022-08-25:

> "the problem is that epubjs progress reporting is on a chapter-by-chapter basis … So I proposed the
> following fix in #3791 so instead of saving a number for progress saving a string would fix these
> issues. But I am not sure if there is a field we can repurpose for that."

That last sentence is the actual evidence — the numeric progress field is the obstacle, and there is
nowhere to put a locator. SPEC.md currently reads as though #2582 were filed about the thousand
milliseconds. Rephrase to: an issue about book position not persisting, whose thread identifies the
numeric progress field as the obstacle.

---

## 20. jellyfin/jellyfin#5236, "Metadata in English, not in selected language", open since 2021 — ADR 0014, SPEC

**CONFIRMED, including the TMDB-and-TVDB detail.** `gh api repos/jellyfin/jellyfin/issues/5236`,
fetched 2026-09-10:

```json
{"number":5236,"title":"Metadata in English, not in selected language","state":"open",
 "created_at":"2021-02-14T18:09:02Z","closed_at":null,"comments":36}
```

Title verbatim as ADR 0014 quotes it, open 5.6 years. The body names both providers itself:

> "I noticed that metadata is in English in my library instead of French. If I manually identify each
> video I get metadata in French. But when automatic metadata refresh runs, it overwrite metadata to
> English. I'm using TMDB and TVDB as sources."

Note what the reporter describes: a refresh *overwrites* the localised value. That is section 2's
merge — one column, first non-empty wins, nothing kept — seen from the user's side. ADR 0014's use of
this issue as the live cost of a single title column is sound.

---

## 21. jellyfin/jellyfin#6709 and PR #17781 — SPEC "HOW ENRICHMENT WORKS"

**Every number CONFIRMED; the stated mechanism CONTRADICTED.** All fetched 2026-09-10.

The issue: `created_at` `2021-10-17T14:40:31Z`, `state` `open`, `closed_at` `null`, `comments` **39**
(the comments array length is 39 too). Opened 2021-10-17, still open, 39 comments — exactly as
SPEC.md states.

The PR: `gh api repos/jellyfin/jellyfin/pulls/17781` returns

```json
{"number":17781,"title":"Preserve manually edited images during library rescans.",
 "state":"closed","created_at":"2026-09-04T12:57:50Z",
 "closed_at":"2026-09-04T13:21:12Z","merged_at":null,"merged":false}
```

Closed unmerged on 2026-09-04, by its own author, 24 minutes after opening, after two reviewers
objected ("This PR looks very specific to your setup"; "a `FullRefresh` should be a full refresh!").
It does reference the issue: the PR body links
`https://github.com/jellyfin/jellyfin/issues/6709`, and #6709's last comment (2026-09-04T13:00:11Z)
reads "made a pr here: https://github.com/jellyfin/jellyfin/pull/17781".

**What fails is the mechanism.** SPEC.md cites #6709 under "Do NOT pick the winner by recency: a
display that changes after a refresh nobody asked for". The symptom matches; recency does not. The
issue is titled "Some custom primary images/art seem to have automatically reverted or replaced with
defaults", and the 39-comment thread establishes **local-file precedence** instead — sjorge,
2024-01-07: "Do you guys perhaps have a poster.jpg in the media's directory too? … It seems to me
that a poster.jpg on disk will always take priority on any kind of scan", confirmed by two other
reporters, one as recently as 2026-06-30. PR #17781's own body says the same: "`MergeImages` was
replacing those images with local files such as `cover.jpg` or `poster.jpg` found in the item's media
folder."

So the citation supports "a pin that the next refresh silently overwrites is not a pin" and does not
support "picked by recency". Replace the mechanism clause with on-disk artwork taking precedence on
any scan. The conclusion SPEC.md draws — that re-picking must never touch what the owner pinned —
is untouched and is if anything better supported: Jellyfin's overwrite is not even a judgement about
which image is better, it is a scan order.

---

## 22. "Jellyfin ships no dialog for [remove-from-collection] at all" — SPEC "DELETE"

**CONFIRMED, and the asymmetry is sharper than SPEC.md states.** `jellyfin-web`,
`src/components/itemContextMenu.js` at `master` (head `3bddedd9`, 2026-09-09), cross-checked at
`v10.11.11`, fetched 2026-09-10:

```javascript
641	            case 'removefromcollection':
642	                apiClient.ajax({
643	                    type: 'DELETE',
644	                    url: apiClient.getUrl('Collections/' + options.collectionId + '/Items', {
645
646	                        Ids: [item.Id].join(',')
647	                    })
648	                }).then(function () {
649	                    getResolveFunction(resolve, id, true)();
650	                });
651	                break;
```

No confirm, no dialog, no undo: the click fires the DELETE. Identical at `v10.11.11` (lines 638-647).

The contrast is in the same file. `case 'delete'` (line 582) routes through
`src/scripts/deleteHelper.js`, which is gated at line 57:

```javascript
 57    return confirm(getDeletionConfirmContent(item)).then(function () {
 58        return apiClient.deleteItem(item.Id).then(function () {
```

with per-type copy at lines 14-49. Two corroborations: `src/strings/en-us.json` carries
`ConfirmDeleteImage`, `ConfirmDeleteItem`, `ConfirmDeleteItemByName`, `ConfirmDeleteCollection`,
`ConfirmDeletePlaylist`, `ConfirmDeleteSeries`, `ConfirmDeleteItems`, `ConfirmDeleteLyrics`,
`ConfirmDeleteRepository` (lines 188-197) and **no** `ConfirmRemoveFromCollection`;
`RemoveFromCollection` at line 1524 is only the menu label, `"Remove from collection"`. The dialog
copy was never written because the dialog was never built. `removefromplaylist` (lines 615-624) is
equally unguarded.

So Jellyfin gates destroying a file on disk behind a typed confirmation and treats detaching an item
from a curation container as a no-consequence click, which is exactly the weighting ADR 0046 adopts.
One thing to keep honest: ADR 0046 pairs "no dialog" with **undo**, and Jellyfin ships no undo — the
precedent covers the first half of the decision, not the second.

---

## 23. "Emby retrofitted exactly this into a shipped provider contract in one commit in 2016" — ADR 0033, SPEC `providers`

**Claim.** ADR 0033: "Language is an optional parameter in both directions and never required. Emby
retrofitted exactly this into a shipped provider contract in one commit in 2016." SPEC.md adds
"backfilling every existing provider to English". The brief supplies the commit:
`896cc599367894ff15405412ca824c447b6ed814`, 2016-09-14.

**CONTRADICTED on the citation and on "both directions"; CONFIRMED on the substance.** All checked
2026-09-10.

**The SHA is not an Emby commit.** `gh api repos/MediaBrowser/Emby/commits/896cc599367894ff15405412ca824c447b6ed814`
returns `No commit found for SHA (HTTP 422)`. A commit search for that hash returns 60 hits, every
one a Jellyfin fork. It resolves in `jellyfin/jellyfin`:

```json
{"sha":"896cc599367894ff15405412ca824c447b6ed814",
 "author_date":"2016-05-14T01:55:46Z","committer_date":"2016-09-14T20:42:24Z",
 "message":"Prioritize metadata merging by preferred language","stats":{"additions":82,"deletions":13},"file_count":6}
```

Emby's own hash for the identical commit — same author date, same committer date, same message, same
six files, same 82/13 stats — is `d169da7de03ca11dd62863e9c40937d752218274`. Jellyfin's history
rewrite renumbered it. Citing `896cc59…` as an Emby commit cites Jellyfin's copy of Emby's history.

**The date is right**, on the committer date. The author date is 2016-05-14: written in May, landed
in September.

**`ResultLanguage` and the English default: CONFIRMED**, `MediaBrowser.Controller/Providers/MetadataResult.cs`
at ref `d169da7`:

```csharp
13        public MetadataResult()
14        {
15            Images = new List<LocalImageInfo>();
16            ResultLanguage = "en";
17        }
23        public string ResultLanguage { get; set; }
```

with one provider hardcoding it in its English-fallback path (`MovieDbSeriesProvider.cs`,
`mainResult.ResultLanguage = "en";`) and another inferring it by heuristic
(`MovieDbEpisodeProvider.cs`: `// if overview is non-empty, we can assume that localized data was returned`).
Six files changed, four of them providers. **The "backfill" is one line in a base constructor**, not
an edit to every provider — every untouched provider keeps answering `"en"` because it never assigns
the property. Cheaper than SPEC.md implies, and the same lesson.

**"In both directions" is CONTRADICTED.** The request side already existed. At the commit's parent,
`MediaBrowser.Controller/Providers/ItemLookupInfo.cs` lines 14-18 already declares
`public string MetadataLanguage { get; set; }`. The commit *consumes* `info.MetadataLanguage`; it does
not add it. So what was retrofitted in one commit is the **response** direction only.

**Two findings the ADR should want.** The commit shipped dead code: it builds an `orderedResults`
list to prioritise language matches and then iterates `results` in the final merge loop, so the
prioritisation is computed and discarded. And Emby later removed the approach entirely — at `master`
(3.5.3, 2018) `MetadataService.cs`:872-876 is back to merging inline in provider order with no
`ResultLanguage` mention in the file:

```csharp
872                    if (result.HasMetadata)
873                    {
874                        result.Provider = provider.Name;
875
876                        MergeData(result, temp, new MetadataFields[] { }, false, false);
```

Note line 874: `result.Provider = provider.Name;` is the same orphan field as section 1, alive in
2018 and still alive in Jellyfin at v12.0, never read in either.

**What the ADR should say.** The retrofit precedent survives and is worth keeping — a response-side
language field added to a shipped contract in a single commit, made compatible by a default rather
than by touching every implementer. Fix the SHA (`d169da7…` in `MediaBrowser/Emby`), drop "in both
directions", and know that the shipped version of the feature did not work and was later removed.

---

## 24. Emby frames 10 seconds as a ceiling because its server increments every second — SPEC "PLAYBACK"

**Claim.** "Save every 10 seconds — the interval Emby's client documentation tells developers to
report at ... Emby frames 10 seconds as a CEILING rather than a floor, because its server already
increments progress every second by itself." Plus: "THE TIMER IS ONLY HALF OF IT — ALSO REPORT
IMMEDIATELY ON ANY USER INTERACTION."

**CONFIRMED, all three parts, verbatim from Emby's own wiki.** Source
https://github.com/MediaBrowser/Emby/wiki/Playback-Check-ins, fetched 2026-09-10 as raw markdown via
`curl -sL https://raw.githubusercontent.com/wiki/MediaBrowser/Emby/Playback-Check-ins.md` (page
footer "© 2019 Emby LLC"). Lines 54-57:

> Playback progress should be reported at the following times:
>
> * Automatically every 10 seconds
> * Immediately following any user interaction with the player, for example, pause, un-pause, etc.

Both halves of SPEC.md's rule are in the same list, which is a stronger citation than SPEC.md gives
itself. The ceiling framing and its reason are line 75, complete:

> The server will automatically increment playback progress every second, so it is not necessary to
> automatically report more often than at 10 second intervals. The progress reports coming from the
> app will be used to re-calibrate the automatic progress increment on the server.

"Not necessary to report more often than" is the ceiling, in Emby's words. One detail SPEC.md omits
and should carry: client reports **re-calibrate** the server's own counter rather than being the
counter.

**The 1-second timer is in Emby's own source**, `MediaBrowser/Emby` at ref
`27451c26e3e14d10a24030465bf931e3d16fbf55` (2018-05-04, the last ref before `MediaBrowser.Controller`
was stripped from the open snapshot), `MediaBrowser.Controller/Session/SessionInfo.cs`:

```csharp
250        public void StartAutomaticProgress(ITimerFactory timerFactory, PlaybackProgressInfo progressInfo)
263                    _progressTimer = timerFactory.Create(OnProgressTimerCallback, null, 1000, 1000);
272        // 1 second
273        private const long ProgressIncrement = 10000000;
...
298            var newPositionTicks = positionTicks + ProgressIncrement;
303            if (runtimeTicks.HasValue && newPositionTicks >= runtimeTicks.Value)
305                return;   // Don't report beyond the runtime
312            await _sessionManager.OnPlaybackProgress(progressInfo, true).ConfigureAwait(false);
```

`1000, 1000` is due-time and period in milliseconds; `10000000` is one second in .NET ticks, with the
comment saying so; the `true` is the `isAutomated` flag that section 15 shows Jellyfin still honours.
The documentation describes something the code actually does.

---

## 25. "Kodi, Emby and Jellyfin all read `.nfo` already" — ADR 0039, SPEC "THE SCANNER"

**CONFIRMED for the Emby half.** `MediaBrowser/Emby` at `master` (3.5.3, the last open snapshot)
ships a whole project for it, `MediaBrowser.XbmcMetadata`: five parsers (`BaseNfoParser`,
`EpisodeNfoParser`, `MovieNfoParser`, `SeasonNfoParser`, `SeriesNfoParser`), eight providers and
seven savers. Reading, not only writing — `MediaBrowser.XbmcMetadata/Providers/BaseNfoProvider.cs`:

```csharp
11    public abstract class BaseNfoProvider<T> : ILocalMetadataProvider<T>, IHasItemChangeMonitor
16        public async Task<MetadataResult<T>> GetMetadata(ItemInfo info, ...
22            var file = GetXmlFile(info, directoryService);
35                Fetch(result, path, cancellationToken);
36                result.HasMetadata = true;
```

with a change monitor at lines 59-68 and Kodi's own naming rules cited in the source
(`MovieNfoSaver.cs`:46-47, `// http://kodi.wiki/view/NFO_files/Movies`). Fetched 2026-09-10.

Currency caveat, and it is the reason this is filed as CONFIRMED rather than CONFIRMED-and-current:
`MediaBrowser/Emby` was last pushed 2024-03-27 but its last `master` commit is 3.5.3 from 2018-09-20,
and a 2018-05-25 commit (`7511c86`, +415/−51813) stripped `MediaBrowser.Controller` and
`MediaBrowser.Model` from the tree. Emby's current builds are closed source, so "Emby reads .nfo
today" cannot be verified from a repository — only "Emby read .nfo in the last source it published".
ADR 0039's argument rests on Plex being the last holdout, and that half is a Plex claim checked
elsewhere.

---

## 26. Plugin repositories fetch an arbitrary admin-supplied URL with no validation — background to ADR 0031 and ADR 0034

**Where it appears.** Not asserted in `docs/adr/` or `SPEC.md`. It is the evidence behind ADR 0031
("a provider is a URL answering CMPP, never a plugin") and ADR 0034's config-URL boundary, so it is
checked here.

**CONFIRMED, and unchanged in 12.0.** Fetched 2026-09-10 at ref `v12.0`.
`Emby.Server.Implementations/Updates/InstallationManager.cs`:

```csharp
104:        public async Task<PackageInfo[]> GetPackages(string manifestName, string manifest, bool filterIncompatible, CancellationToken cancellationToken = default)
105:        {
106:            try
107:            {
108:                PackageInfo[]? packages = await _httpClientFactory.CreateClient(NamedClient.Default)
109:                        .GetFromJsonAsync<PackageInfo[]>(new Uri(manifest), _jsonSerializerOptions, cancellationToken).ConfigureAwait(false);
```

The URL is admin configuration (`:180-185`, `_config.Configuration.PluginRepositories`), written by
`Jellyfin.Api/Controllers/PackageController.cs`:178-181 straight into configuration with no
validation, from a `RepositoryInfo` whose `Url` is a bare `public string? Url { get; set; }`
(`MediaBrowser.Model/Updates/RepositoryInfo.cs`:18) carrying no attributes and no validators.

The only URL-related code is exception handling *after* the request is attempted — `catch
(UriFormatException)` at `:159` and `catch (NotSupportedException)` at `:164` ("The URL scheme
configured for the plugin repository is not supported"), the latter being `HttpClient` refusing
non-http schemes at send time. So `file://` fails incidentally, and **any** `http(s)://` target is
fetched: loopback, RFC1918, `169.254.169.254`, internal hostnames. Redirects are followed:
`Jellyfin.Server/Startup.cs`:87-107 builds `NamedClient.Default` on a `SocketsHttpHandler` that sets
only `AutomaticDecompression`, `RequestHeaderEncodingSelector` and a dual-stack `ConnectCallback`;
`AllowAutoRedirect` is never set, so .NET's default `true` applies.

**The honest framing, which matters more than the finding.** Jellyfin's own fix for the analogous
SSRF (GHSA-8fw7-f233-ffr8, section 28) was an **authorization** change, not URL validation:
`AddTunerHost` in `Jellyfin.Api/Controllers/LiveTvController.cs`:986 moved from
`[Authorize(Policy = Policies.LiveTvManagement)]` at `v10.11.6` to
`[Authorize(Policy = Policies.RequiresElevation)]` at `v10.11.7`, and at `v12.0`
`src/Jellyfin.LiveTv/TunerHosts/M3uParser.cs`:52-54 still does `AsyncFile.OpenRead(info.Url)` for
any non-http URL. Jellyfin's threat model treats "an admin can point the server at a URL" as
acceptable. ADR 0034 takes the same position deliberately — a config URL is OWASP's Case 1 and a
private address is legal there by name — so this is a precedent for the decision, not a defect to
avoid. The part Jellyfin does not have and ADR 0034 does is the second boundary: the deny-list with
no exception on URLs that arrive *inside a response*.

---

## 27. "Jellyfin runs the same rule in code, treating an empty target ABI as compatible" — ADR 0032, SPEC "CMPP"

**CONFIRMED, at three call sites, by two different mechanisms.** Ref `v12.0`, fetched 2026-09-10;
identical at `v10.11.11` (lines 126, 196, 266).

`Emby.Server.Implementations/Updates/InstallationManager.cs`:

```csharp
270:            var availableVersions = package.Versions
271:                .Where(x => string.IsNullOrEmpty(x.TargetAbi) || Version.Parse(x.TargetAbi) <= appVer);
```

```csharp
116:                var minimumVersion = new Version(0, 0, 0, 1);
131:                        if (!Version.TryParse(ver.TargetAbi, out var targetAbi))
132:                        {
133:                            targetAbi = minimumVersion;
134:                        }
```

```csharp
201:                            if (Version.TryParse(version.TargetAbi, out var targetAbi) && _applicationHost.ApplicationVersion < targetAbi)
```

Absent short-circuits the check at 271, defaults to the lowest possible version `0.0.0.1` at 133, and
fails to trigger the incompatibility branch at 201. Absence means compatible, three ways.

This is a closer match to ADR 0032 than the ADR claims. ADR 0032's rule is "absence means version 1";
Jellyfin literally substitutes the version `0.0.0.1` for a missing value. Same mechanism, same
reason: a required field would break every plugin manifest already published on the day it landed.

---

## 28. The SSRF advisories GHSA-rgjw-4fwc-9v96, GHSA-8fw7-f233-ffr8, GHSA-jh22-fw8w-2v9x — background to ADR 0034

**Where they appear.** Not cited in `docs/adr/` or `SPEC.md`. They are the evidence that ADR 0034's
outbound boundaries are a live risk in this product category rather than a theoretical one.

**All three CONFIRMED: they exist, they are Jellyfin's, they are SSRF.**
`gh api repos/jellyfin/jellyfin/security-advisories`, fetched 2026-09-10:

| GHSA | CVE | Severity | Published | Summary (verbatim) |
|---|---|---|---|---|
| GHSA-rgjw-4fwc-9v96 | CVE-2021-29490 | medium | 2021-05-05T00:57:46Z | Unauthenticated GET requests through Remote Image endpoints |
| GHSA-8fw7-f233-ffr8 | CVE-2026-35032 | high | 2026-04-14T21:13:49Z | Potential SSRF + Arbitrary file read via LiveTV M3U tuner |
| GHSA-jh22-fw8w-2v9x | CVE-2026-35033 | high | 2026-04-14T21:13:59Z | Potential SSRF + Arbitrary file read via stream argument injection |

The 2021 one does not say SSRF in its title but does in its body: "are vulnerable to unauthenticated
Server-Side Request Forgery (SSRF) attacks via the imageUrl parameter" (patched 10.7.3). The two 2026
ones were patched in 10.11.7, five months ago.

Fetch note for anyone re-checking: `gh api /advisories/<GHSA_ID>` returns 404 for all three. Only the
repo-scoped endpoint returns them.

Context, since the count matters for how hard to lean on this: `jellyfin/jellyfin` has 17 advisories
in total and `jellyfin-web` one (GHSA-89hp-h43h-r5pq, stored XSS, critical, 2023-04-23). Three of the
17 are SSRF; the dominant themes are FFmpeg or argument injection (four) and path traversal (four).
The 2021 advisory is directly on the artwork path ADR 0034 names as live — a remote image URL fetched
by the server — which is the strongest single reason to keep the content-URL deny-list absolute.

---

## 29. "Jellyfin ships hardcoded keys — three of them, with the per-instance override hidden" — ADR 0035, SPEC "SECURITY"

**CONTRADICTED as written; every component is true of something else.** ADR 0035 says "three of them"
of TMDb; SPEC.md line 1184 says "one hardcoded key" and then "There are three such keys". Both
numbers are defensible about different subjects, and the ADR's sentence attaches the wrong one.
All fetched 2026-09-10 at ref `v12.0`.

**There is exactly ONE hardcoded TMDb key.** All 29 `.cs`/`.html` files under
`MediaBrowser.Providers/Plugins/Tmdb/` were fetched and grepped; one hit:

```csharp
MediaBrowser.Providers/Plugins/Tmdb/TmdbUtils.cs
32:        /// <summary>
33:        /// API key to use when performing an API call.
34:        /// </summary>
35:        public const string ApiKey = "<32-hex-key, redacted here>";
```

Same single key at `v10.11.11`:29. There is no release in either line carrying three TMDb keys.

**There are THREE hardcoded provider keys in total, one each, across three services:**

| Service | Location | Per-instance override |
|---|---|---|
| TMDb | `MediaBrowser.Providers/Plugins/Tmdb/TmdbUtils.cs:35` | yes, hidden |
| TheAudioDb | `MediaBrowser.Providers/Plugins/AudioDb/AudioDbArtistProvider.cs:32` (`private const string ApiKey = "195003";`) | none |
| OMDb | `MediaBrowser.Providers/Plugins/Omdb/OmdbProvider.cs:260` (`const string Url = "https://www.omdbapi.com?apikey=2c9d9507";`) | none |

All 53 `.cs`/`.html` files under `Plugins/{AudioDb,Omdb,MusicBrainz,StudioImages,ListenBrainz}/` were
checked; MusicBrainz, ListenBrainz and StudioImages ship no keys. TheTVDB is not in this repo at all
at `v12.0` — the only `tvdb` path in the 3,071-entry tree is a test fixture — so no TVDB key ships.

**"The per-instance override is hidden" is CONFIRMED, and Jellyfin says so in a code comment:**

```csharp
MediaBrowser.Providers/Plugins/Tmdb/Configuration/PluginConfiguration.cs
12:        /// <summary>
13:        /// Gets or sets a value to use as the API key for accessing TMDb. This is intentionally excluded from the
14:        /// settings page as the API key should not need to be changed by most users.
15:        /// </summary>
16:        public string TmdbApiKey { get; set; } = string.Empty;
```

consumed with the same absent-means-fallback shape as section 27
(`TmdbClientManager.cs`:42-44: `apiKey = string.IsNullOrEmpty(apiKey) ? TmdbUtils.ApiKey : apiKey;`).
The TMDb settings page (`Configuration/config.html`, 286 lines, read in full) exposes `includeAdult`,
tag excludes, season and episode import options, cast and crew caps, similar-items cache and five
image-size selects, and no API-key input; its submit handler (`:251-277`) never writes
`config.TmdbApiKey`. jellyfin-web has no TMDb page at all (`grep -i tmdb` over its full master tree
returns nothing), so there is no second surface. The override is reachable only through
`POST /Plugins/{id}/Configuration` or by hand-editing the plugin XML.

**The fix.** ADR 0035 should read: Jellyfin ships one hardcoded TMDb key, with a per-instance
override that its own source says is "intentionally excluded from the settings page"; three of its
bundled providers ship a hardcoded key in total, and two of those three have no override at all. The
argument is unchanged and slightly stronger — the two keyed providers with no override are worse than
the one the ADR complains about.

---

## 30. "Jellyfin 12.0, released 2026-09-08, ships `COUNT(DISTINCT)` over an `AncestorIds` closure" — ADR 0068, SPEC

**CONFIRMED in shape and in timing; the literal `COUNT(DISTINCT)` string is an inference, not an
observation.** Fetched 2026-09-10.

The computation is `Jellyfin.Server.Implementations/Item/ItemCountService.cs` at `v12.0`, method
`GetPlayedAndTotalCountBatch` (581-675):

```csharp
606:        var ancestorLeaves = dbContext.AncestorIds
607:            .WhereOneOrMany(folderIdsArray, a => a.ParentItemId)
608:            .Join(
609:                playedLeafItems,
...
640:        var countsByFolder = ancestorLeaves
641:            .Union(linkedLeaves)
642:            .Union(linkedFolderLeaves)
643:            .GroupBy(x => x.FolderId)
644:            .Select(g => new
645:            {
646:                FolderId = g.Key,
647:                Total = g.Select(x => x.Id).Distinct().Count(),
648:                Played = g.Where(x => x.Played).Select(x => x.Id).Distinct().Count()
649:            })
```

`AncestorIds` is genuinely a closure: `DescendantQueryHelper.cs`:249-261 contains a method named
`ClosureDescendants` with the comment "An item carries its own chain plus its collection folders,
never the UserRootFolder."

**Three qualifications, all worth carrying into ADR 0068.**

1. This is LINQ, not SQL. A code search for `COUNT(DISTINCT` across the repository returns zero hits;
   `.Distinct().Count()` over group elements is a form EF Core translates, but the emitted SQL was
   not observed in this run. `.Union()` (rather than `.Concat()`) already dedupes in SQL, so two
   dedup mechanisms are stacked. Write "dedupes with DISTINCT over an ancestor closure", not
   "ships `COUNT(DISTINCT)`".
2. The dedup is in the batch path only. The per-item fallback (`GetPlayedAndTotalCountFromQuery`,
   719-733) uses a plain `g.Count()` because it pre-resolves descendants into a `HashSet` first
   (`DescendantQueryHelper.cs`:58-60, `.Distinct().ToHashSet()`).
3. **It really is new in 12.0.** `ItemCountService.cs`, `DescendantQueryHelper.cs` and
   `ItemCountBuilder.cs` do not exist at `v10.11.11`. At 10.11.11 the job was one count query per
   folder in `MediaBrowser.Controller/Entities/Folder.cs`:1810-1837, and no DISTINCT was needed
   because ancestors were filtered with an EXISTS rather than a join (`BaseItemRepository.cs`:2503).
   The join-plus-DISTINCT shape arrived with PR jellyfin/jellyfin#16062, "Query Performance
   Improvements", merged 2026-05-03.

So ADR 0068's "the same query, arrived at independently" holds, dated to within four months, with the
wording tightened.

---

## 31. "Members of a group are distinct folders whose leaves cannot overlap" — ADR 0068, SPEC

**CONFIRMED verbatim. The assumption is a comment in Jellyfin's own source.**
`Jellyfin.Server.Implementations/Item/ItemCountService.cs` at `v12.0`, fetched 2026-09-10:

```csharp
653:        foreach (var (folderId, members) in groups)
654:        {
655:            var played = 0;
656:            var total = 0;
657:
658:            // Members of a group are distinct folders, so their leaves cannot overlap.
659:            foreach (var member in members)
660:            {
661:                if (countsByFolder.TryGetValue(member, out var counts))
662:                {
663:                    played += counts.Played;
664:                    total += counts.Total;
665:                }
666:            }
```

The structure is exactly what ADR 0068 asserts. *Within* one folder, overlap is handled in the
database by `Union` plus `Distinct().Count()` (section 30). *Across* the members of a merged-series
group, the per-member counts are summed in C# with plain `+=`, and nothing dedupes — line 658 is the
whole justification for that. Groups are built by `GetPresentationKeyGroups` (677-716), folders
sharing a `PresentationUniqueKey`. Two tests pin the behaviour:
`tests/Jellyfin.Server.Implementations.Tests/Item/ItemCountServiceTests.cs`,
`GetCounts_MergedFolders_CountLeavesOfEveryFolderInTheGroup` (155) and
`GetCounts_UnmergedFolder_CountsOnlyItsOwnLeaves` (177).

This is the strongest confirmation in this document, because it is not an inference from behaviour:
Jellyfin wrote the precondition down. CanonCore's containers violate it by design, which is precisely
why ADR 0068 makes the dedup load-bearing rather than incidental.

---

## 32. "Jellyfin materialises the missing parts and then excludes them from the percentage anyway" — ADR 0060, SPEC

**CONFIRMED, and the reality is sharper than the claim.** Fetched 2026-09-10 at ref `v12.0`.

**It materialises them.** `MediaBrowser.Providers/Plugins/Tmdb/TV/TmdbMissingEpisodeProvider.cs`:19,
"Creates virtual (metadata-only) entries for missing and unaired episodes", setting
`IsVirtualItem = true` at lines 241 (virtual season) and 593 (virtual episode). This provider is new
in 12.0 — no `MissingEpisode*` file exists in the `v10.11.11` tree — and the user setting is
`User.DisplayMissingEpisodes`.

**It excludes them from the percentage.**
`src/Jellyfin.Database/Jellyfin.Database.Implementations/DescendantQueryHelper.cs`:16-22:

```csharp
16:    /// <summary>
17:    /// Gets the predicate identifying items that count toward played/total aggregation:
18:    /// real leaf media, i.e. neither folders nor virtual items (missing or unaired episodes).
19:    /// Shared by the per-item and batched count paths so they cannot diverge.
20:    /// </summary>
21:    public static Expression<Func<BaseItemEntity, bool>> IsCountableLeaf { get; } =
22:        b => !b.IsFolder && !b.IsVirtualItem;
```

applied at `ItemCountService.cs`:449, 464 and 600 — every played and total path.

**The sharper part, which ADR 0060 should have.** The exclusion is *unconditional*: it never consults
`DisplayMissingEpisodes`. The child count in the same file does honour the setting
(`ItemCountService.cs`:484, `var includeVirtual = user is null || user.DisplayMissingEpisodes;`, used
at 487, 497, 545, 551). So a user who has explicitly asked to see missing episodes sees them in the
child count and in the UI, and they are still struck from the played percentage. The tests encode the
asymmetry: `GetChildCountBatch_MissingEpisodes_CountedUnlessTheUserHidesThem` (261) exists; no
counterpart exists for the played path, because that path has no branch to test. At `v10.11.11` the
same exclusion lived inline as `IsVirtualItem = false` (Folder.cs:707, 1816), so only the
centralisation is new.

ADR 0060's use of this stands: Jellyfin has the missing parts, in the database, and still reports a
percentage that pretends they are not there.

---

## 33. "Computing rather than storing was challenged as the thing Jellyfin switched off for performance" — ADR 0068

**The challenge is HALF RIGHT, and ADR 0068's rebuttal survives — but the guard it should cite is
different from the one implied.** Fetched 2026-09-10.

There is a performance switch-off, right in the played path.
`MediaBrowser.Controller/Entities/Folder.cs` at `v12.0`:

```csharp
159:        public virtual bool SupportsUserDataFromChildren
160:        {
161:            get
162:            {
163:                // These are just far too slow.
164:                if (this is ICollectionFolder)
165:                {
166:                    return false;
167:                }
169:                if (this is UserView)
174:                if (this is UserRootFolder)
179:                if (this is Channel)
```

It is the first thing `FillUserDataDtoValues` checks (`:1946`) and it gates the batch path too
(`Emby.Server.Implementations/Dto/DtoService.cs`:211). So Jellyfin computes container progress for
Series, Season, BoxSet and Playlist, and refuses to compute it for library roots, user views and
channels, explicitly on performance grounds.

**Three corrections to the challenge.**

1. **Nothing was switched off.** The identical block, comment included, is present at `v10.11.11`
   (Folder.cs:139-179) and `grep -c 'These are just far too slow'` returns 1 at `v10.8.0`, `v10.5.0`
   and `v10.0.0` — Jellyfin's first release, 2019-01-25. It is inherited from Emby. There is no event
   in which a working feature was disabled.
2. **The scope is library-level aggregates**, not container progress generally. The Series/Season/
   BoxSet case ADR 0068 is about is still computed on every request.
3. **12.0 moved the other way.** Three performance complaints aimed at exactly this computation —
   jellyfin/jellyfin#14616 (2025-08-09, which names the `FillUserDataDtoValues` path and notes
   `enableUserData=false` makes it instant), #15063 and #15090 "Collections library very slow to load
   since 10.11 upgrade" (both 2025-10-21) — were all closed as completed on 2026-05-03 by PR #16062,
   which **kept the computation and batched it** ("prevents N+1 DB roundtrips"). An earlier PR
   #15687, "Don't list every item just to get count", was closed unmerged.

So the honest form of the counter-evidence is: Jellyfin has never computed progress for library
roots, on performance grounds, since 2019. That is a real limit and ADR 0068 should name it, because
CanonCore's "seen everything that survives / seen the whole work" at a top-level container is exactly
the case Jellyfin declines. The rebuttal — that 12.0 arrived independently at the deduped closure
query — is confirmed in section 30 and is if anything strengthened by #16062 keeping the computation
under direct performance pressure.

---

## 34. "Named trigger types rather than raw cron, and `Aborted` distinct from `Failed`" — ADR 0049, SPEC "THE SCHEDULER"

**CONFIRMED, and the enum is richer than the ADR says.** Ref `v12.0`, fetched 2026-09-10.

`MediaBrowser.Model/Tasks/TaskTriggerInfoType.cs`, lines 6-27, exactly four named kinds:

```csharp
    DailyTrigger,      // 11
    WeeklyTrigger,     // 16
    IntervalTrigger,   // 21
    StartupTrigger     // 26
```

`MediaBrowser.Model/Tasks/TaskCompletionStatus.cs`, lines 6-27:

```csharp
    Completed,   // 11
    Failed,      // 16
    /// <summary>Manually cancelled by the user.</summary>
    Cancelled,   // 21
    /// <summary>Aborted due to a system failure or shutdown.</summary>
    Aborted      // 26
```

**No raw cron anywhere.** `TaskTriggerInfo.cs`:15-39 carries only `Type`, `TimeOfDayTicks`,
`IntervalTicks`, `DayOfWeek`, `MaxRuntimeTicks` — no expression string — and the factory
(`ScheduledTaskWorker.cs`:612-659) is a closed if-chain ending
`throw new ArgumentException("Unrecognized trigger type: " + info.Type);`. `grep -ci cron` over the
whole `v12.0` tree returns 0.

**Improve the ADR here.** There are three non-success outcomes, not two, and the third is the one
worth copying: `Cancelled` ("manually cancelled by the user") is distinct from `Aborted` ("due to a
system failure or shutdown"), both distinct from `Failed`. ADR 0049's reasoning — "a job that was
killed and a job that broke need different answers" — actually argues for the three-way split
Jellyfin ships, since a job the owner stopped and a job the machine stopped are different answers too.

---

## 35. "Jellyfin's re-points collection references on merge and never re-points them back" — ADR 0040, SPEC "DELETE"

**CONFIRMED, precisely.** Ref `v12.0`, fetched 2026-09-10.

Jellyfin has no generic item merge. It has **merge versions** for alternate video versions
(`POST /Videos/MergeVersions`, `Jellyfin.Api/Controllers/VideosController.cs`:183-256), and it does
ship a split. The merge re-points, lines 226-227:

```csharp
// Re-route any playlist/collection references from this item to the primary
await _libraryManager.RerouteLinkedChildReferencesAsync(item.Id, primaryVersion.Id).ConfigureAwait(false);
```

`Emby.Server.Implementations/Library/LibraryManager.cs`:4096-4116 rewrites `lc.ItemId = toChildId` on
every affected parent folder and re-saves the NFO. The old id is overwritten in place and recorded
nowhere.

The split — `DELETE /Videos/{itemId}/AlternateSources`, lines 143-174 — undoes the version linkage:

```csharp
foreach (var link in _libraryManager.GetLinkedAlternateVersions(item))
{
    link.SetPrimaryVersionId(null);
    link.LinkedAlternateVersions = Array.Empty<LinkedChild>();
    await link.UpdateToRepositoryAsync(...);
}
item.LinkedAlternateVersions = Array.Empty<LinkedChild>();
item.SetPrimaryVersionId(null);
```

There is no `RerouteLinkedChildReferencesAsync` call in it, and no stored record of what was
re-pointed. So a split leaves every collection and playlist entry pointing at the primary. ADR 0040's
sentence is exactly right, and its argument lands: the information needed to reverse the operation is
destroyed by the operation, so a product that ships the reverse operation without recording anything
still cannot restore what it re-pointed.

---

## 36. "In both, an item cannot exist without a file" — ADR 0003, SPEC "WHAT CANONCORE IS"

**CONTRADICTED in letter, CONFIRMED in substance.** Ref `v12.0`, fetched 2026-09-10.

Pathlessness is a first-class state. `MediaBrowser.Controller/Entities/BaseItem.cs`:271 is a plain
`public virtual string Path { get; set; }` with no requirement, and lines 331-349 make the empty case
meaningful:

```csharp
        if (string.IsNullOrEmpty(path))
        {
            if (SourceType == SourceType.Channel) { return LocationType.Remote; }
344:            return LocationType.Virtual;
```

with `public bool IsVirtualItem { get; set; }` at line 143. The TMDb missing-episode provider says it
outright (`TmdbMissingEpisodeProvider.cs`:582):

```csharp
// Leaving Path unset makes the item a virtual (metadata-only) episode.
```

**But the ADR's conclusion holds.** There is no generic create-an-item endpoint —
`gh search code --repo jellyfin/jellyfin 'HttpPost("Items")'` returns nothing — and every
user-initiated creation path materialises a real directory first:
`CollectionManager.cs`:179 `var info = Directory.CreateDirectory(path);` before
`new BoxSet { ..., Path = path }`, and `LibraryManager.cs`:1364 the same for item-by-name creation.
Virtual items exist only as a side effect of a provider filling gaps in a series you partly own.

**The fix is one clause.** ADR 0003 should say: in Plex and Jellyfin an item cannot be *created* by
the user without a file. Saying "cannot exist" is falsifiable in one line of Jellyfin's source, and
a reader who finds `IsVirtualItem` will discount the whole ADR for it. The precise version is also
better evidence, because Jellyfin's virtual items are exactly the thing ADR 0060 criticises: the
product will materialise a missing part when a provider tells it to, and will not let the owner
assert one.

---

## 37. "Jellyfin's mechanism is that people have no container parent" — SPEC "WHAT NOT TO BUILD"

**CONFIRMED, structurally, in three places.** Ref `v12.0`, fetched 2026-09-10.

A `Person` **is** a `BaseItem` (`MediaBrowser.Controller/Entities/Person.cs`:19), so the exclusion
has to be structural, and it is:

```csharp
Person.cs
38:    [JsonIgnore]
39:    public override bool SupportsAncestors => false;
```

Created with a null parent — `LibraryManager.cs`:1337-1377, `CreateItemByName<T>` calls
`CreateItem(item, null);` (line 1374) against
`public void CreateItem(BaseItem item, BaseItem? parent)` (2430). Kept out of the ancestor table —
`Jellyfin.Server.Implementations/Item/ItemPersistenceService.cs`:255-257:

```csharp
var ancestorIds = item.SupportsAncestors ?
    item.GetAncestorIds().Distinct().ToList() :
    null;
```

So both browse filters miss: `BaseItemRepository.TranslateQuery.cs`:320-322 filters on `ParentId` and
1098-1100 joins `AncestorId.ParentItemId`. People are reachable only through the dedicated
`PersonsController`. The same `SupportsAncestors => false` override appears on `Genre`, `MusicGenre`,
`Studio` and `Year` — the whole `IItemByName` family. In the v12.0 schema people additionally have
their own table (`Entities/People.cs`: `Id`, `Name`, `PersonType`, `BaseItems`, no parent column),
mapped to items through `PeopleBaseItemMap`.

SPEC.md's reading is right, including its conclusion that the mechanism cannot be copied literally:
the exclusion IS parentlessness, and CanonCore's "the Doctors, in order" is a container whose members
are entities, which is precisely what Jellyfin's mechanism forbids.

---

## 38. "Search ... grouped by kind with works first — which is what Plex, Jellyfin and Kodi all chose" — SPEC

**CONFIRMED for the Jellyfin half, with the grouping located in the client rather than the server.**
Ref `v12.0`, fetched 2026-09-10.

Entities are in by default — `Jellyfin.Api/Controllers/SearchController.cs`:97-101:

```csharp
[FromQuery] bool includePeople = true,
[FromQuery] bool includeMedia = true,
[FromQuery] bool includeGenres = true,
[FromQuery] bool includeStudios = true,
[FromQuery] bool includeArtists = true)
```

The server returns a flat `SearchHint[]` carrying `Type = item.GetBaseItemKind()` (line 145), ordered
by relevance. The works-first grouping is the web client's —
`jellyfin-web`, `src/apps/legacy/features/search/constants/sectionSortOrder.ts`:1-19:

```ts
export const SEARCH_SECTIONS_SORT_ORDER = [
    'Movies', 'Shows', 'Episodes', 'People', 'Studios', 'Playlists',
    'Artists', 'Albums', 'Songs', 'HeaderVideos', 'Programs', 'Channels',
    'HeaderPhotoAlbums', 'Photos', 'HeaderAudioBooks', 'Books', 'Collections'
];
```

Movies, Shows and Episodes precede People, Studios and Artists. Note for SPEC.md: "grouped by kind
with works first" is a **client** decision over a flat scored API. That is the better split for
CanonCore too — the API answers the question, the surface decides the grouping — and it is worth
saying so rather than implying the server groups.

---

## 39. "Uniqueness sits on the raw value, as Jellyfin's does" — ADR 0030, SPEC

**CONFIRMED for genres, tags, studios and artists — and Jellyfin does exactly what ADR 0030 argues
for, computing a normalised key without constraining on it. Not enforced at all for people.**
Ref `v12.0`, fetched 2026-09-10.

`src/Jellyfin.Database/Jellyfin.Database.Implementations/ModelConfiguration/ItemValuesConfiguration.cs`:13-18:

```csharp
    builder.HasKey(e => e.ItemValueId);
16:    builder.HasIndex(e => new { e.Type, e.CleanValue });              // NOT unique
17:    builder.HasIndex(e => new { e.Type, e.Value }).IsUnique();        // unique on the RAW value
```

`Entities/ItemValue.cs` carries both columns — `Value` (24) and `CleanValue` (29, "the sanitized
Value") — and `ItemValueType` covers `Artist`, `AlbumArtist`, `Genre`, `Studios`, `Tags`,
`InheritedTags`. So "Sci-Fi" and "sci-fi" are two rows sharing a `CleanValue`, exactly the shape
ADR 0030 chooses.

**One correction.** People are not covered by it. `PeopleConfiguration.cs`:13-18:

```csharp
    builder.HasKey(e => e.Id);
16:    builder.HasIndex(e => e.Name);   // no .IsUnique()
```

No uniqueness on person names at all, raw or normalised. If ADR 0030's "as Jellyfin's is" is meant to
cover vocabularies generally, it is right; if it is read as covering people, it is wrong, and the
people story is section 40's problem instead.

---

## 40. "Streamyfin ... wrote ~144KB of Swift around MPVKit — since grown to 538KB plus 634KB of Kotlin" — ADR 0054, SPEC

**The current figures are CONFIRMED to three digits; "~144KB originally" is CONTRADICTED.**
`streamyfin/streamyfin`, default branch `develop`, HEAD `1ac1447a` dated 2026-09-09, measured
2026-09-10 by summing blob sizes from one recursive tree call:

| | files | bytes | KB |
|---|---|---|---|
| `.swift` | 57 | 537,748 | 537.7 |
| `.kt` | 66 | 634,101 | 634.1 |

MPVKit is a real dependency: `modules/mpv-player/ios/MpvPlayer.podspec`:11-12 declares
`s.dependency 'MPVKit'`, and `app.json`:183-184 pins Streamyfin's own fork
(`https://raw.githubusercontent.com/streamyfin/MPVKit/0.41.0-av5/MPVKit.podspec`). The Swift is
concentrated there — `modules/mpv-player/ios/MPVLayerRenderer.swift` alone is 70,993 bytes.

**The history does not support "originally ~144KB".** The mpv module arrived 2026-01-10 in commit
`f1575ca4` ("feat: MPV player for both Android and iOS with added HW decoding PiP (with subtitles)
(#1332)"), at which point total Swift was **74,316 bytes**, of which the module was 62,338. Measured
trajectory:

| ref | date | Swift | Kotlin |
|---|---|---|---|
| v0.47.1 | 2025-11-12 | 49 KB | 38 KB |
| `f1575ca4` (mpv added) | 2026-01-10 | 74 KB | 71 KB |
| v0.51.0 | 2026-01-05 | 196 KB | 47 KB |
| v0.54.1 | 2026-06-01 | 132 KB | 104 KB |
| (2026-07-19) | 2026-07-19 | 140 KB | 132 KB |
| (2026-08-09) | 2026-08-09 | 419 KB | 192 KB |
| `develop` HEAD | 2026-09-09 | **538 KB** | **634 KB** |

144 KB corresponds to roughly late July 2026, not to when the Swift was first written around MPVKit.
The series is also non-monotonic (196 KB at v0.51.0, 132 KB at v0.54.1), so any single-point
comparison is fragile. **Fix:** drop "~144KB" or replace it with the real origin — a flagship Expo
Jellyfin client wrote 74 KB of Swift the day it adopted MPVKit and carries 538 KB of Swift plus
634 KB of Kotlin eight months later. The trend is the argument; the starting number was wrong and the
trend is steeper than the ADR claims.

---

## 41. "Plex and Jellyfin both carry [country and language] separately" — SPEC `statements`

**CONFIRMED for Jellyfin.** `MediaBrowser.Model/Configuration/ServerConfiguration.cs` at `v12.0`,
fetched 2026-09-10:

```csharp
103:        public string PreferredMetadataLanguage { get; set; } = "en";
109:        public string MetadataCountryCode { get; set; } = "US";
```

Two independent fields with different defaults, and both are also carried per item —
`Entities/BaseItemEntity.cs`:67 `PreferredMetadataLanguage`, :69 `PreferredMetadataCountryCode`. For
the record, `MetadataOptions.cs` does not hold them; it is fetcher and saver ordering only.

---

## 42. "Both incumbents proxy" artwork — SPEC `artwork`

**CONFIRMED for Jellyfin.** Ref `v12.0`, fetched 2026-09-10. Download —
`MediaBrowser.Providers/Manager/ProviderManager.cs`:188-215:

```csharp
210:        var httpClient = _httpClientFactory.CreateClient(NamedClient.Default);
211:        using var response = await httpClient.GetAsync(url, cancellationToken);
```

Persist — `MediaBrowser.Providers/Manager/ImageSaver.cs`:288 `Directory.CreateDirectory(...)`, :300
`new FileStream(path, fileStreamOptions)`. Serve from the server's own routes —
`Jellyfin.Api/Controllers/ImageController.cs`:552, 553, 630, 708, all
`Items/{itemId}/Images/{imageType}...`. The remote URL is only ever an input:
`RemoteImageController.cs`:151-171, `POST Items/{itemId}/RemoteImages/Download`, which hands the URL
to `SaveImage`. A client never receives a TMDb URL.

This is the same shape SPEC.md chooses — store the bytes, serve them, keep the URL as provenance —
and section 4's `ImageNeedsRefresh` backfill is the payoff.

---

## 43. "Plex, Jellyfin and Kodi all model an extra as a child item and none of them as a file role" — SPEC "PLAYBACK"

**CONFIRMED for Jellyfin.** `MediaBrowser.Model/Entities/ExtraType.cs` at `v12.0`, twelve members:
`Unknown, Clip, Trailer, BehindTheScenes, DeletedScene, Interview, Scene, Sample, ThemeSong,
ThemeVideo, Featurette, Short`.

An extra is its own `BaseItem` with its own id: `MediaBrowser.Controller/Entities/BaseItem.cs`:219
`public ExtraType? ExtraType { get; set; }` is a property of the extra itself, :242
`public Guid OwnerId { get; set; }` is the ownership link, and :3019 `GetExtras` fetches them with a
library query on `OwnerIds`. Line 1650 shows extras are owned but unparented in the browse tree
(`if (!i.OwnerId.Equals(ownerId) || !i.ParentId.IsEmpty() || ...)`). There is a dedicated join table,
`Entities/BaseItemExtraType.cs`.

So SPEC.md's rule — an extra is a work related to another work, with its own progress and page — is
what the incumbent already does, and the disagreement is only about whether it shows in Continue
Watching.

---

## 44. "Plex carries three title columns, Jellyfin four" — ADR 0014, SPEC

**CONFIRMED as an undercount: the honest stored figure is five.** Ref `v12.0`, fetched 2026-09-10.
`src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/BaseItemEntity.cs`:

```csharp
35:    public string? Name { get; set; }
51:    public string? SortName { get; set; }
53:    public string? ForcedSortName { get; set; }
93:    public string? CleanName { get; set; }
97:    public string? OriginalTitle { get; set; }
```

The ADR's four are Name, OriginalTitle, SortName and ForcedSortName. It omits `CleanName`, the
normalised search key, which is a real persisted column and is what search matches against
(`SqlSearchProvider.cs`:111, `e.CleanName!.Contains(cleanSearchTerm)`). Three further title-ish
columns on the same table belong to *other* items — `EpisodeTitle` (63), `SeriesName` (113),
`SeasonName` (115) — so a maximal count is eight.

One nuance in the other direction: in the C# domain model `SortName` is computed and cached rather
than plainly stored (`BaseItem.cs`:540-553, returning `ForcedSortName` if set, else `CreateSortName()`),
so "four columns in the object model" is defensible while "four columns in the database" is an
undercount.

Either way ADR 0014's point stands and gets stronger: title is single-valued nowhere, and Jellyfin
needs five columns to say what one statement table with a language and a rank would say.

---

## 45. "Jellyfin's `BaseItemKind` has reached 36 values" — SPEC "DELIBERATE DIVERGENCES", ADR 0004

**CONTRADICTED: it is 37, in both release lines.** `Jellyfin.Data/Enums/BaseItemKind.cs` at ref
`v12.0`, fetched 2026-09-10, declares 37 members (lines 14-203):

`AggregateFolder`, `Audio`, `AudioBook`, `BasePluginFolder`, `Book`, `BoxSet`, `Channel`,
`ChannelFolderItem`, `CollectionFolder`, `Episode`, `Folder`, `Genre`, `ManualPlaylistsFolder`,
`Movie`, `LiveTvChannel`, `LiveTvProgram`, `MusicAlbum`, `MusicArtist`, `MusicGenre`, `MusicVideo`,
`Person`, `Photo`, `PhotoAlbum`, `Playlist`, `PlaylistsFolder`, `Program`, `Recording`, `Season`,
`Series`, `Studio`, `Trailer`, `TvChannel`, `TvProgram`, `UserRootFolder`, `UserView`, `Video`,
`Year`.

`v10.11.11` is also 37, identical list and identical line numbers — so 36 is not version skew, it was
wrong when written. The file's own remark (lines 6-8) explains the growth mechanism and is the part
SPEC.md should quote instead of a number: "This enum is generated from all classes that inherit from
`BaseItem`." The kind list is not a designed vocabulary at all; it is whatever the class hierarchy
happens to contain. That is a far better argument for CanonCore's seven fixed kinds than the count is,
and it does not rot.

---

## 46. "Jellyfin's `Folder` subclasses are the real precedent, and `Playlist` the closest analogue — the one Jellyfin container allowing duplicate members AND hand ordering" — SPEC, ADR 0004

**CONFIRMED, and Jellyfin's own source says "the one" in a comment.** Ref `v12.0`, fetched
2026-09-10.

**The subclasses.** Thirteen direct subclasses of `Folder`: `BasePluginFolder` (abstract),
`AggregateFolder`, `BoxSet`, `Channel`, `CollectionFolder`, `MusicAlbum`, `MusicArtist`,
`PhotoAlbum`, `Playlist`, `Season`, `Series`, `UserRootFolder`, `UserView`; plus one transitive,
`PlaylistsFolder : BasePluginFolder`. (`ManualPlaylistsFolder` and `ChannelFolderItem` are not
classes — they are type-name string overrides, `PlaylistsFolder.cs`:53.)

**Duplicates, in Jellyfin's words.** `Jellyfin.Server.Implementations/Item/ItemPersistenceService.cs`:538-547:

```csharp
538                // Playlists may legitimately contain the same item multiple times (e.g. a song repeated
539                // in an .m3u file). Every other container type keeps a single entry per child.
540                var isPlaylist = folder is Playlist;
541                if (!isPlaylist)
542                {
543                    resolvedChildren = resolvedChildren
544                        .GroupBy(c => c.ChildId)
545                        .Select(g => g.Last())
546                        .ToList();
547                }
```

The add path has no membership check at all (`PlaylistManager.cs`:259,
`playlist.LinkedChildren = [.. playlist.LinkedChildren, .. childrenToAdd];`).

**Hand ordering.** `Playlist.cs`:81-82 `public override bool IsPreSorted => true;`, plus a dedicated
endpoint `PlaylistsController.cs`:408 `[HttpPost("{playlistId}/Items/{itemId}/Move/{newIndex}")]`
whose implementation splices the array (`PlaylistManager.MoveItemAsync`:346-358).

**BoxSet has neither.** It dedupes on add (`CollectionManager.cs`:250,
`if (!currentLinkedChildrenIds.Contains(id))`) and sorts on read by a fixed key
(`BoxSet.cs`:26 `DisplayOrder = "PremiereDate";`, :116-134 `Sort(...)` applied in `GetChildren`),
and `CollectionController.cs` has no move endpoint. One caveat: `BoxSet.Sort` returns items unchanged
when `DisplayOrder` parses to `ItemSortBy.Default`, so a BoxSet can display in insertion order — but
insertion order is not hand order, because nothing reorders it.

Dated evidence that duplicates are a recent, deliberate concession:
`src/Jellyfin.Database/Jellyfin.Database.Providers.Sqlite/Migrations/20260723111547_AllowDuplicatePlaylistChildren.cs`
(2026-07-23, v12.0 only), lines 54-57:

```
54            // The (ParentId, ChildId) primary key cannot represent the same child more than once per
55            // parent. Drop any duplicate entries (keeping the first by SortOrder) ...
57            // nature — duplicate playlist entries cannot survive a downgrade.
```

That is worth having in ADR 0009: the incumbent needed a schema migration in 2026 to permit what
CanonCore's placement table permits from commit one, and it granted it to exactly one container type.

---

## 47. "Jellyfin keys people on their name, so two people sharing a name merge irreversibly ... Its maintainers say there is no fix without a redesign" — SPEC

**CONFIRMED on the mechanism; the maintainer quote is real but is weaker than SPEC.md's paraphrase.**
Ref `v12.0`, fetched 2026-09-10.

**Identity is the name.** The people entity carries no external id at all —
`src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/People.cs`:11-32 is `Id`, `Name`,
`PersonType`, `BaseItems`, and nothing else. `PeopleConfiguration.cs`:15-16 keys on `Id` with a
non-unique index on `Name`. But lookup never uses the surrogate —
`Jellyfin.Server.Implementations/Item/PeopleRepository.cs`:129-139 matches on
`e.LoweredName + "-" + e.PersonType`, and its own comment (49-52) explains the collapse: "keeping the
lowest id per lowercased name so case-only duplicates collapse together".

And the `Person` BaseItem's Guid **is** the hashed name: `LibraryManager.cs`:1210
`GetPersonId(string name) => GetItemByNameId<Person>(Person.GetPath(name))`, resolving through
`GetNewItemIdInternal` to `key = type.FullName + key; return key.GetMD5();` (:816-818), with
`Person.cs`:45 building that key from `GetType().Name + "-" + Name.RemoveDiacritics()`.

So same name → same MD5 → one row, with no record that two people were merged; different spelling →
two rows, with nothing to merge them on, because `People` stores no provider ids. Both halves of
SPEC.md's sentence hold.

**The maintainer statement.** Issue jellyfin/jellyfin#3356, "Actors with the same name appear as one
person", opened 2020-06-16, **still open**, labels `bug, confirmed, librarydb`, 27 comments. `cvium`
(association `MEMBER`), 2020-11-06:

> "There is unfortunately no easy fix for this. Actors are poorly handled by various metadata
> providers such as OMDB, where they are presented with only a name and thus we have no unique id to
> tie actors to movies, shows etc. When two actors share the exact same name this becomes a problem.
> TMDB seems to have id's for the actors, so we might be able to do more than name comparison. It's
> unlikely to be fixed before the database rewrite though."

and the same maintainer on 2025-10-20, after the rewrite:

> "Database has not been redesigned. The underlying framework was changed, but that has no bearing on
> the data models. No work has been done to fix this in 10.11."

**Tighten SPEC.md's wording.** What was said is "no *easy* fix" and "unlikely to be fixed before the
database rewrite", followed five years later by "the underlying framework was changed, but that has
no bearing on the data models". That is a stronger story than the paraphrase, not a weaker one — the
redesign happened and the defect survived it — but it is not the sentence "there is no fix without a
redesign". Quote the two comments instead.

Worth knowing: `Jellyfin.Server/Migrations/Routines/20260508130000_MergeDuplicatePeople.cs` in v12.0
merges *case-only* duplicates. A narrow patch, six years on, not the redesign.

---

## 48. "Jellyfin's NFO parser joins N episode titles with ' / '" — ADR 0021, SPEC `files`

**CONFIRMED, with the separator verbatim and the one-item outcome pinned by Jellyfin's own tests.**
`MediaBrowser.XbmcMetadata/Parsers/EpisodeNfoParser.cs` at ref `v12.0`, fetched 2026-09-10:

```csharp
 95                // Concatenate the name, originalTitle and overview tags of the remaining episodes with the first one
 96                // and take the highest episode number as the last episode of the file
 97                var name = new StringBuilder(item.Item.Name);
100                for (var i = 1; i < episodes.Count; i++)
104                    if (!string.IsNullOrEmpty(additionalEpisode.Item.Name))
105                    {
106                        name.Append(" / ").Append(additionalEpisode.Item.Name);
...
121                        item.Item.IndexNumberEnd = Math.Max((int)additionalEpisode.Item.IndexNumber, ...);
125                item.Item.Name = name.ToString();
```

(the same `" / "` append for `Overview` at 111 and `OriginalTitle` at 116). The signature is
`protected override void Fetch(MetadataResult<Episode> item, ...)` — one result, one `.Item`,
mutated. `tests/Jellyfin.XbmcMetadata.Tests/Parsers/EpisodeNfoProviderTests.cs` asserts the outcome
directly:

```csharp
117            Assert.Equal("Rising (1) / Rising (2)", item.Name);
118            Assert.Equal(1, item.IndexNumber);
119            Assert.Equal(2, item.IndexNumberEnd);
...
159            Assert.Equal("Rising / Hide and Seek / Thirty-Eight Minutes", item.Name);
162            Assert.Equal(1, item.IndexNumber);
163            Assert.Equal(4, item.IndexNumberEnd);
```

Four episodes become one `Episode` spanning `IndexNumber 1 … IndexNumberEnd 4`. ADR 0021's
"Rose / The End of the World" is the right shape; the real test fixture is Stargate Atlantis, and the
behaviour is deliberate enough to be tested rather than an accident. Note the ADR could go further:
the `Overview` is concatenated too, so the second episode's synopsis is also fused into the first.

---

## 49. "`TmdbUtils.FindBestMatch` opens with `bestScore = 0` and `best = results[0]` ... no 'no good match' return path at all" — ADR 0028, SPEC

**CONFIRMED on the mechanics; the "matching nothing still wins" framing needs one qualifier, and the
whole method is new in 12.0.** `MediaBrowser.Providers/Plugins/Tmdb/TmdbUtils.cs` at ref `v12.0`,
fetched 2026-09-10:

```csharp
193            if (results is null || results.Count == 0)
194            {
195                return null;
196            }
198            var normalizedName = NormalizeTitle(name);
199            if (normalizedName.Length == 0)
201                return results[0];
204            var best = results[0];
205            var bestScore = 0;
207            foreach (var result in results)
209                var score = Math.Max(
210                        ScoreTitle(normalizedName, titleSelector(result)),
211                        ScoreTitle(normalizedName, originalTitleSelector(result)))
212                    + ScoreYear(year, releaseDateSelector(result)?.Year);
214                // Strictly greater, so ties keep the earlier, more relevant result.
215                if (score > bestScore)
222            return best;
```

`bestScore = 0` and `best = results[0]` are exactly as ADR 0028 quotes them, and the only `null`
return is the empty-input guard at 193-196. A field where every candidate scores zero returns
`results[0]`. There is no minimum-score threshold anywhere.

**The qualifier.** The fallback is deliberate and documented, not an oversight — the method's own
remarks (177-182) say "When nothing matches at all TMDb's own ordering is kept, so a name that needs
fuzzy matching, such as 'A Christmas No. 1' for 'A Christmas Number One', still resolves", and a test
pins it (`tests/Jellyfin.Providers.Tests/Tmdb/TmdbUtilsTests.cs`:198-203, "Nothing matches the name,
so TMDb's own ordering is kept"). So the honest sentence is: a candidate matching nothing still wins,
because the design decides that TMDb's relevance ordering is a better answer than admitting no match.
That is the same defect ADR 0028 names — there is no way for the scorer to fail — arrived at on
purpose rather than by accident, which is a stronger argument for a committed falsifiable test, not a
weaker one.

**Version note that matters for the ADR's present tense.** `FindBestMatch` does not exist at
`v10.11.11`; it is new in `v12.0`, along with its scoring constants (`TitleExactScore = 8`,
`TitlePrefixScore = 4`, `YearExactScore = 2`, `YearAdjacentScore = 1`). "Jellyfin ships the defect
today" is true as of 12.0. It was not shipping this code when the ADR's sweep was likely run, so the
citation should carry the ref.

---

## 50. "Jellyfin keeps two arrays" for parts and variants — ADR 0022, SPEC `files`

**CONTRADICTED: there are three.** `MediaBrowser.Controller/Entities/Video.cs` at ref `v12.0`,
fetched 2026-09-10 (identical three at `v10.11.11`:45-49, so this is not version skew):

```csharp
 47        public string[] AdditionalParts { get; set; }
 49        public string[] LocalAlternateVersions { get; set; }
 51        public LinkedChild[] LinkedAlternateVersions { get; set; }
```

- `AdditionalParts` — file paths of the *stacked* parts of one presentation, CD1/CD2 of a film.
  `Video.cs`:162 `public bool IsStacked => AdditionalParts.Length > 0;`. This is the part array.
- `LocalAlternateVersions` — alternate *encodings* found on disk beside the primary file. Persisted
  as `LinkedChildType.LocalAlternateVersion`, documented "Local alternate version (same item,
  different file path)".
- `LinkedAlternateVersions` — alternate encodings the *user* merged from elsewhere in the library.
  Persisted as `LinkedChildType.LinkedAlternateVersion`, "Linked alternate version (different item
  ID)".

So ADR 0022's distinction — a part continues the edition, a variant is the same edition encoded
differently — is real and is exactly the line Jellyfin draws. What it gets wrong is the count: the
variant side is itself split in two by provenance, local-file versus user-linked. That is worth
knowing rather than merely correcting, because it is a third axis CanonCore folds into one: our
variant relation carries provenance on the row, so "found on disk" and "linked by the owner" are a
source value rather than two arrays.

---

## 51. "A key made of (parent, position) — which is what Jellyfin actually uses" — ADR 0018, SPEC `placements`

**CONFIRMED, literally, in the v12.0 schema.**
`src/Jellyfin.Database/Jellyfin.Database.Implementations/ModelConfiguration/LinkedChildConfiguration.cs`:15-18,
fetched 2026-09-10:

```csharp
15        builder.ToTable("LinkedChildren");
16        builder.HasKey(e => new { e.ParentId, e.SortOrder });
```

set by the migration `20260723111547_AllowDuplicatePlaylistChildren.cs`:45-48, which replaced the
previous key `(ParentId, ChildId)`. There is no surrogate id on a membership row:
`MediaBrowser.Controller/Entities/LinkedChild.cs` has `Path` (obsolete), `Type`, `LibraryItemId`
(obsolete) and `ItemId` — and `ItemId` is the **child's** id, described in
`ItemPersistenceService.cs`:477 as "only a cache".

And `SortOrder` is re-derived from array position on every save, after deleting the whole set:

```csharp
462                var staleLinks = item.Item is Folder ? existingLinks
470                    context.LinkedChildren.RemoveRange(staleLinks);
...
557                var sortOrder = 0;
558                foreach (var (linkedChild, childId) in resolvedChildren)
573                    context.LinkedChildren.Add(new LinkedChildEntity()
576                        ChildId = childId,
578                        SortOrder = sortOrder
581                    sortOrder++;
```

So one move rewrites the key of every row from the move point onward, which is precisely ADR 0018's
objection. The API-facing `PlaylistItemId` is not a rescue: `PlaylistsController.cs`:559 sets it to
the child item's Guid, so with duplicates permitted (section 46) a move targets only the first copy
(`MoveItemAsync`:338 uses `FirstOrDefault`) and removing one copy removes all copies
(`RemoveItemFromPlaylistAsync`:287-291 filters by that id).

**One historical correction.** At `v10.11.11` there was no `LinkedChildren` table at all —
`Folder.LinkedChildren` was a serialised array property on the item, where position was the *only*
identity. v12.0 made the (parent, position) key explicit in SQL rather than implicit in an array. So
ADR 0018's "which is what Jellyfin actually uses" is more true now than when it was written, and the
consequence it predicts — every external reference goes stale on a reorder — is now enforced by a
primary key.

---

## 52. "Both incumbents parse [the part ordinal] from the filename and neither can correct a mis-parse" — ADR 0022, SPEC `files`

**CONFIRMED for the Jellyfin half.** Ref `v12.0`, fetched 2026-09-10.

The ordinal is a regex over the filename. `Emby.Naming/Video/FileStackRule.cs`:6-21:

```csharp
 6/// <summary>
 7/// Regex based rule for file stacking (eg. disc1, disc2).
 8/// </summary>
 9public class FileStackRule
11    private readonly Regex _tokenRegex;
18    public FileStackRule(string token, bool isNumerical)
20        _tokenRegex = new Regex(token, RegexOptions.IgnoreCase | RegexOptions.Compiled);
```

with `Match` returning `(string StackName, string PartType, string PartNumber)` (line 35).
`Emby.Naming/Video/StackResolver.cs` collects the matches into a
`Dictionary<string, FileSystemMetadata> Parts` keyed by the parsed part number (line 119), rejects a
file whose part type disagrees or whose number is already present (107-108), requires at least two
parts (126), and emits the ordered paths (131).

The result is written **once, at scan time**, and only there:
`Emby.Server.Implementations/Library/Resolvers/Movies/MovieResolver.cs`:307 and 574,
`AdditionalParts = additionalParts,`. The only API surface is read-only —
`Jellyfin.Api/Controllers/VideosController.cs`:94, `[HttpGet("{itemId}/AdditionalParts")]`. There is
no POST, PUT or PATCH anywhere that sets `AdditionalParts`, and `Video.AdditionalParts` is a bare
`string[]` of paths (section 50) with no ordinal column, no manual-verification flag and no exclude
flag to correct.

So a mis-parsed disc order in Jellyfin is fixed by renaming the files, which is the escape hatch
CanonCore closes by forbidding the scanner to write storage. ADR 0022's "the correction has to live
in the database" follows directly.

---

## 53. "It forced the container into client memory only — Jellyfin's design" — ADR 0066, SPEC `placements`

**CONFIRMED.** Fetched 2026-09-10.

`jellyfin-web`, `src/components/playback/playqueuemanager.js` at ref `v12.0` — the queue is a plain
in-memory class, and the identity it hands out is a module-level counter:

```javascript
 3	let currentId = 0;
 4	function addUniquePlaylistItemId(item) {
 5	    if (!item.PlaylistItemId) {
 6	        item.PlaylistItemId = 'playlistItem' + currentId;
 7	        currentId++;
 8	    }
 9	}
21	class PlayQueueManager {
22	    constructor() {
23	        this._sortedPlaylist = [];
24	        this._playlist = [];
```

A page refresh reloads the module: the counter resets to 0 and both arrays are empty. Nothing is
persisted and nothing is addressable, so the ordering the reader arrived through cannot survive a
reload or be shared in a URL.

The server has no substitute for a general container. `Jellyfin.Api/Controllers/TvShowsController.cs`:75
exposes `[HttpGet("NextUp")]` with an optional `seriesId` filter (line 82) — next-up is scoped to a
series, not to whatever ordering you were browsing. So for a chronology, a reading order or any
hand-built container, Jellyfin's next-up has nothing to compute from, which is exactly the failure
ADR 0066 describes as "next-up either stopped working or silently switched".

This is the ADR's own correction confirmed at source: the earlier "never encoded in it" rule would
have reproduced Jellyfin's design, and `?via=<placement-id>` is what avoids it.

---

## 54. "Both incumbents reached the same place independently and chose to document their own API within eighteen months" — SPEC "A STANDARD READ PROTOCOL IS REFUSED"

**Half CONFIRMED, the quantifier UNFOUNDED.** Checked 2026-09-10.

Jellyfin does publish its own documented API rather than adopting a standard read protocol:
`curl -sSL https://api.jellyfin.org/` returns HTTP 200 and the page loads
`openapi/jellyfin-openapi-stable.json` and `openapi/jellyfin-openapi-unstable.json` — a generated
OpenAPI specification, versioned stable and unstable. That is Jellyfin's own contract, published as
its own documentation.

**"Within eighteen months" has no referent in the sentence** — eighteen months from what? Founding,
first release, or each other? Nothing in this run establishes a start point, and I found no dated
statement from Jellyfin choosing its own API over OPDS or Subsonic. What would settle it: the commit
or PR that introduced the OpenAPI generation (with its date), set against a stated baseline, plus a
project statement declining a standard protocol. Until then the clause should be dropped or replaced
with the plain fact: Jellyfin documents its own OpenAPI contract at `api.jellyfin.org` and ships no
OPDS or Subsonic endpoint in core.

---

## Summary

**54 numbered checks**, every one fetched 2026-09-10 against `v12.0`, `v10.11.x`, jellyfin.org, the
GitHub API, and — for Emby — `MediaBrowser/Emby` and Emby's own wiki. Sections are counted by their
primary verdict; several CONFIRMED sections carry a qualification named in the section itself.

| Verdict | Count | Sections |
|---|---|---|
| CONFIRMED | 41 | all not listed below |
| CONTRADICTED, in whole or in a named part | 9 | 5, 13, 21, 23, 29, 36, 40, 45, 50 |
| UNFOUNDED, in a named part | 3 | 7, 47, 54 |
| JUDGEMENT | 1 | 33 |

**No decision was falsified.** Every ADR whose supporting claim moved keeps its conclusion; what
moved was a number, a citation, or a mechanism.

### CONTRADICTED

| Claim | Where | What is actually true |
|---|---|---|
| 27 `TranscodeReason` values, each a client-profile comparison | ADR 0041, SPEC | 28 at v12.0 (27 at 10.11); four members are not profile comparisons, two of those are dead code — section 13 |
| `BaseItemKind` has reached 36 values | SPEC divergence 3 | 37, in both release lines — section 45 |
| Jellyfin ships three hardcoded TMDb keys | ADR 0035 | One TMDb key; three hardcoded provider keys in total (TMDb, TheAudioDb, OMDb), two with no override at all — section 29 |
| "Jellyfin keeps two arrays" for parts and variants | ADR 0022, SPEC | Three: `AdditionalParts`, `LocalAlternateVersions`, `LinkedAlternateVersions` — section 50 |
| Emby commit `896cc599…`, and "language in both directions" | ADR 0033, SPEC | That SHA is Jellyfin's; Emby's is `d169da7d…`. Only the response side was retrofitted; `ItemLookupInfo.MetadataLanguage` predates it — section 23 |
| Streamyfin "wrote ~144KB of Swift" originally | ADR 0054, SPEC | 74 KB the day MPVKit landed (2026-01-10); 144 KB corresponds to late July 2026. Current 538 KB / 634 KB confirmed — section 40 |
| #6709 is a display "picked by recency" | SPEC | On-disk artwork (`poster.jpg`) takes precedence on any scan; every number in the citation is right — section 21 |
| "In both, an item cannot exist without a file" | ADR 0003, SPEC | Virtual items exist (`IsVirtualItem`, missing episodes). True as "cannot be *created* by the user without a file" — section 36 |
| `RunMigrationOnSetup` means "do not replay on a fresh install" | SPEC MIGRATIONS | The flag is opt-IN to running on setup; the default `false` is what suppresses replay — section 5 |

### UNFOUNDED

| Claim | Where | What would settle it |
|---|---|---|
| "hundreds of thousands of installs" | ADR 0047 | A figure published by Jellyfin. It publishes none and ships no telemetry. Docker Hub's 416,673,407 pulls is a different quantity — section 7 |
| "chose to document their own API within eighteen months" | SPEC | The quantifier has no referent. The OpenAPI-generation commit date against a stated baseline — section 54 |
| "Its maintainers say there is no fix without a redesign" (people) | SPEC | What was said is "no *easy* fix … unlikely before the database rewrite" (2020) and "no bearing on the data models … no work has been done" (2025). Quote those instead — section 47 |

### The three findings worth acting on beyond a wording fix

1. **Section 31** is the strongest confirmation here and it is not an inference: Jellyfin wrote the
   precondition into a comment — "Members of a group are distinct folders, so their leaves cannot
   overlap." ADR 0068's dedup is load-bearing for exactly the reason the ADR gives.
2. **Section 15** got worse two days ago: v12.0 now propagates a spurious `Played = true` to every
   alternate version of the item.
3. **Section 30** dates ADR 0068's convergence claim precisely — the deduped ancestor-closure query
   arrived in PR #16062, merged 2026-05-03, under direct performance pressure, and Jellyfin kept the
   computation rather than storing it.
