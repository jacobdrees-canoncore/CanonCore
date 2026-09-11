# Verify: Jellyfin claims in ADR-0085, 0078, 0086, 0047, 0077

Run date: **2026-09-10**. Every verdict below rests on a lookup performed in this run; nothing is
carried over from memory or from the earlier `verify-adr-jellyfin.md`.

## What the owner was, and what state it was in

The owner is the Jellyfin source. Fixed points for this run:

| Repo | Ref | Head commit | Head date |
| --- | --- | --- | --- |
| `jellyfin/jellyfin` | `master` | `cf09de60e4e5844ad181d7ef9019151c54969d44` | 2026-09-08 |
| `jellyfin/jellyfin-web` | `master` | `3bddedd93993dcd3a723ef937ce5c8f1b7506ec3` | 2026-09-09 |

Version context, which matters for claim 4: the latest **stable release is v12.0**, published
2026-09-08 (`https://api.github.com/repos/jellyfin/jellyfin/releases/latest`). `master` declares
`AssemblyVersion("13.0.0")` in `SharedVersion.cs`. So 10.11 — the version the maintainer quoted in
claim 4 was talking about — is now two majors old, and everything below was checked on `master` and,
where identity is at stake, re-checked on the `v12.0` tag.

---

## Claim 1 — `if (!hasRuntime) { data.Played = true; }`

**Claim** (ADR-0085, Evidence): "Jellyfin's fallback in the no-duration case corrupts data:
`if (!hasRuntime) { data.Played = true; }` marks an item WATCHED on its first progress report."

**Verdict: CONTRADICTED as a code quote. CONFIRMED as behaviour.**

URL: https://github.com/jellyfin/jellyfin/blob/master/Emby.Server.Implementations/Library/UserDataManager.cs
Read 2026-09-10 at commit `cf09de60`.

The code is present, and it is in `UserDataManager.UpdatePlayState`. The actual text is:

```csharp
public bool UpdatePlayState(BaseItem item, UserItemData data, long? reportedPositionTicks)
{
    var playedToCompletion = false;

    var runtimeTicks = item.GetRunTimeTicksForPlayState();

    var positionTicks = reportedPositionTicks ?? runtimeTicks;
    var hasRuntime = runtimeTicks > 0;

    // If a position has been reported, and if we know the duration
    if (positionTicks > 0 && hasRuntime && item is not AudioBook && item is not Book)
    {
        ... // percentage branch: MinResumePct / MaxResumePct / MinResumeDurationSeconds
    }
    else if (positionTicks > 0 && hasRuntime && item is AudioBook)
    {
        ... // audiobook branch: MinAudiobookResume / MaxAudiobookResume, in minutes
    }
    else if (!hasRuntime)
    {
        // If we don't know the runtime we'll just have to assume it was fully played
        data.Played = playedToCompletion = true;
        positionTicks = 0;
    }

    if (!item.SupportsPlayedStatus)
    {
        positionTicks = 0;
        data.Played = false;
    }
    ...
}
```

Three differences from the ADR's quote, all real:

1. It is `else if`, not `if`. It is the terminal branch of a three-way chain, not a standalone guard.
   This is not cosmetic: it is what makes the branch a *fallback*, which is the ADR's own word for it,
   so the correct form is actually better evidence than the quoted one.
2. The assignment is `data.Played = playedToCompletion = true`, not `data.Played = true`. The dropped
   half is load-bearing downstream: `playedToCompletion` is the return value, it becomes
   `PlaybackStopEventArgs.PlayedToCompletion`, and `data.Played == true` also triggers
   `playedVideo.PropagatePlayedState(user, true)` in `SessionManager.OnPlaybackProgress`, marking
   *every alternate version* played.
3. `positionTicks = 0` is also in the block. The resume point is destroyed at the same moment.

**Was it ever exactly the quoted form?** No. Checked at tags `v10.7.7`, `v10.8.13`, `v10.9.11`,
`v10.10.7`, `v10.11.0` — all five carry the identical `else if (!hasRuntime)` block with
`data.Played = playedToCompletion = true; positionTicks = 0;`. The quoted form has never existed.

**"on its first progress report" — CONFIRMED.**
`Emby.Server.Implementations/Session/SessionManager.cs`, `OnPlaybackProgress`:

```csharp
private void OnPlaybackProgress(User user, BaseItem item, PlaybackProgressInfo info)
{
    var data = _userDataManager.GetUserData(user, item);
    var positionTicks = info.PositionTicks;
    var changed = false;

    if (positionTicks.HasValue)
    {
        _userDataManager.UpdatePlayState(item, data, positionTicks.Value);
        changed = true;
    }
    ...
    if (changed)
    {
        _userDataManager.SaveUserData(user, item, data, UserDataSaveReason.PlaybackProgress, CancellationToken.None);
        if (data.Played == true && item is Video playedVideo)
        {
            playedVideo.PropagatePlayedState(user, true);
        }
    }
}
```

The guard is `positionTicks.HasValue`, not `> 0`. A first progress report carrying position 0 on an
item with no runtime therefore lands in the `!hasRuntime` branch and is **saved** as played. The
runtime consulted is the server's own: `BaseItem.GetRunTimeTicksForPlayState()` returns
`RunTimeTicks ?? 0` (`MediaBrowser.Controller/Entities/BaseItem.cs:3044`). The client has no way to
supply one — see claim 10.

**Net:** the ADR's decision ("unknown is never a fabricated true") is supported exactly as it claims.
The code fragment printed in the ADR is a misquote and should be replaced with the real one.

---

## Claim 2 — Jellyfin keys people on their name

**Claim** (ADR-0078): "Jellyfin keys people on their name, so two people sharing a name merge
irreversibly, and two spellings of one person cannot be merged even when their external ids match."

**Verdict: CONFIRMED**, on `master` and on the released `v12.0` tag.

### The Person item's id is a hash of its name

`Emby.Server.Implementations/Library/LibraryManager.cs`
(https://github.com/jellyfin/jellyfin/blob/master/Emby.Server.Implementations/Library/LibraryManager.cs),
read 2026-09-10:

```csharp
public Guid GetPersonId(string name)
{
    return GetItemByNameId<Person>(Person.GetPath(name));   // line 1211-1213
}

private Guid GetItemByNameId<T>(string path)
      where T : BaseItem, new()
{
    var forceCaseInsensitiveId = _configurationManager.Configuration.EnableNormalizedItemByNameIds;
    return GetNewItemIdInternal(path, typeof(T), forceCaseInsensitiveId);   // line 1380-1385
}

private Guid GetNewItemIdInternal(string key, Type type, bool forceCaseInsensitive)
{
    ...
    key = type.FullName + key;
    return key.GetMD5();      // line 818
}
```

`Person.GetPath(name)` (`MediaBrowser.Controller/Entities/Person.cs`) builds a filesystem path from
the name and nothing else. So a Person's primary key is `MD5("MediaBrowser.Controller.Entities.Person"
+ <path derived from the name>)`. Same name, same Guid — the two people become one row. Different
spelling, different Guid — and there is no path back.

`GetOrCreatePerson` (line 1229) creates the item with `Id = GetItemByNameId<Person>(path)`. There is
no id allocation anywhere.

### The People lookup table has no external-id column at all

`src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/People.cs`, read 2026-09-10, in
full: `Id` (Guid), `Name` (required string), `PersonType` (string?), `BaseItems` (navigation). That
is the whole entity. No `ProviderIds`, no TMDb/IMDb column, nothing to match on.

### The write path dedupes on the lowered name

`Jellyfin.Server.Implementations/Item/PeopleRepository.cs`, `UpdatePeople`, read 2026-09-10:

```csharp
var credits = people.Select(e => (Person: e, LoweredName: e.Name.ToLowerInvariant(), PersonType: e.Type.ToString(), LoweredRole: e.Role.ToLowerInvariant()));
var distinctCredits = credits.DistinctBy(e => (e.LoweredName, e.PersonType, e.LoweredRole)).ToArray();
var distinctPersons = distinctCredits.DistinctBy(e => (e.LoweredName, e.PersonType)).ToArray();
var personKeys = distinctPersons.Select(e => e.LoweredName + "-" + e.PersonType).ToArray();

var existingPersons = context.Peoples.Select(e => new
{
    item = e,
    SelectionKey = e.Name.ToLower() + "-" + e.PersonType
})
    .Where(p => personKeys.Contains(p.SelectionKey))
    .Select(f => f.item)
    .ToArray();
```

The identity key is `(lowered name, person type)`. External ids are never consulted.

The same file's read path matches people to items by name as well
(`BaseItemRepository.QueryBuilding.cs`, `ApplyItemByNameAccessFiltering`):
`context.Peoples.Any(p => p.Name == e.Name && ...)`.

### Jellyfin's own source says so

`Jellyfin.Server/Migrations/Routines/20260508130000_MergeDuplicatePeople.cs` (added 2026-05-08),
class summary, read 2026-09-10:

> Merges case-only duplicate people. Two passes:
> 1) Person BaseItems whose Name differs only by casing — **Person.GetPath hashes the name
>    verbatim**, so two casings produce two distinct Person rows in BaseItems.
> 2) Peoples lookup rows whose Name differs only by casing within the same PersonType —
>    UpdatePeople used to insert a second Peoples row when a metadata provider returned
>    a different casing than the row already in the table.

Note what this migration is and is not. It is a *repair* migration that merges case-only variants
after the fact. It does not add an external-id column, and it does not change the key. It is the
strongest corroboration available for the ADR: the owner's remedy for name-keying is a data cleanup
pass, not a schema change.

### Re-checked on the released v12.0

`v12.0` tag, 2026-09-10: `People.cs` still has exactly the four members; `PeopleRepository.cs` still
builds `SelectionKey = e.Name.ToLower() + "-" + e.PersonType`; `LibraryManager.GetPersonId` (line
1210) is still `GetItemByNameId<Person>(Person.GetPath(name))`. Nothing has moved.

---

## Claim 3 — the 2020 maintainer comment

**Claim** (ADR-0078): maintainers said in 2020 there was "no easy fix ... unlikely to be fixed before
the database rewrite".

**Verdict: CONFIRMED.** The elision is faithful.

Issue: **jellyfin/jellyfin#3356, "Actors with the same name appear as one person"**, opened
2020-06-16, **still open**, last activity 2026-07-16. Labels: `bug`, `confirmed`, `librarydb` ("On
hold until the Library Database has been migrated").

Comment by **cvium** (author_association: `MEMBER`), **2020-11-06T14:40:37Z**:
https://github.com/jellyfin/jellyfin/issues/3356#issuecomment-723115446

> There is unfortunately no easy fix for this. Actors are poorly handled by various metadata
> providers such as OMDB, where they are presented with only a name and thus we have no unique id to
> tie actors to movies, shows etc. When two actors share the exact same name this becomes a problem.
> TMDB seems to have id's for the actors, so we might be able to do more than name comparison.
>
> It's unlikely to be fixed before the database rewrite though.

Read via the GitHub issues API on 2026-09-10.

---

## Claim 4 — the October 2025 comment, and 10.11

**Claim** (ADR-0078): after the rewrite landed, a maintainer said in October 2025 that "the
underlying framework was changed, but that has no bearing on the data models. No work has been done
to fix this in 10.11".

**Verdict: CONFIRMED — the quote is verbatim, the date is 2025-10-20, the version is 10.11.**
But see the flag below: the ADR omits the comment's first sentence, and that omission changes what
the comment means.

Comment by **cvium** (`MEMBER`), **2025-10-20T13:10:31Z**:
https://github.com/jellyfin/jellyfin/issues/3356#issuecomment-3422005641

> \> Still broken after database redesign and release of 10.11.0. And still confusing Will Smith, the
> American star of "I Am Legend" and "I, Robot" with the British white bloke who's the
> writer/producer of, and Emmy winner for, "Slow Horses".
>
> **Database has not been redesigned.** The underlying framework was changed, but that has no bearing
> on the data models. No work has been done to fix this in 10.11.

The comment it quotes is https://github.com/jellyfin/jellyfin/issues/3356#issuecomment-3421783099
(NeuroDawg, 2025-10-20T12:03:21Z).

**The omitted sentence matters.** The ADR builds a claim on top of the quote: "The rewrite came and
went and the defect did not move, which is the stronger point." The maintainer's first sentence says
the opposite of the premise — *the rewrite did not come*. What landed in 10.11 was an EF Core
framework swap, not the data-model redesign the 2020 comment was waiting for. The 2020 promissory
note has not been called in; it is still outstanding.

The ADR's *conclusion* survives, and on the evidence gathered here it survives better than the ADR
argues it does. Six years after the 2020 comment and two majors past 10.11, `master` (13.0-dev, read
2026-09-10) still keys people on the name, and the only work done in the interim is a case-folding
repair migration (claim 2). "This is not a thing a later refactor rescues" is right. But the
sentence that carries it — "the rewrite came and went" — is contradicted by the source it cites.

Supporting later comments on the same issue, all read 2026-09-10:
- 2026-01-28, `#issuecomment-3810949284`: "still an issue for me in latest version 10.11.6"
- 2026-04-22, `#issuecomment-4293843748`: "still an issue for me on version 10.11.8 too" (Brian Cox)
- 2026-06-08 / 2026-06-09, `#issuecomment-4653997375` and `#issuecomment-4656891014`: the converse
  split, one person under two scripts, on 10.11.10

On the "two spellings ... even when their external ids match" half of ADR-0078: corroborated by
issue #8906 (closed as a duplicate of #3356) and by
https://github.com/jellyfin/jellyfin/issues/3356#issuecomment-2832945493 (2025-04-27), reporting
that Identify with distinct external ids filled in still merges the two people. The code reason is
in claim 2: the People entity has no external-id column to compare.

---

## Claim 5 — jellyfin-web reports progress every 10 seconds

**Verdict: CONFIRMED.**

`src/components/playback/playbackmanager.js`, `jellyfin-web` master (`3bddedd9`, 2026-09-09), read
2026-09-10:
https://github.com/jellyfin/jellyfin-web/blob/master/src/components/playback/playbackmanager.js

```js
function onPlayerProgressInterval() {                       // line 3343
    const player = this;
    sendProgressUpdate(player, 'timeupdate');
}

function startPlaybackProgressTimer(player) {               // line 3348
    stopPlaybackProgressTimer(player);

    player._progressInterval = setInterval(onPlayerProgressInterval.bind(player), 10000);
}
```

`10000` ms = 10 seconds.

**Bonus, and it corroborates the other half of ADR-0086.** The same file also fires a progress update
on every user interaction, not only on the timer:

```
3661:  sendProgressUpdate(player, 'timeupdate');
3666:  sendProgressUpdate(player, 'pause');
3671:  sendProgressUpdate(player, 'unpause');
3676:  sendProgressUpdate(player, 'volumechange');
3681:  sendProgressUpdate(player, 'repeatmodechange');
3686:  sendProgressUpdate(player, 'shufflequeuemodechange');
3691:  sendProgressUpdate(player, 'playlistitemmove', true);
3696:  sendProgressUpdate(player, 'playlistitemremove', true);
3701:  sendProgressUpdate(player, 'playlistitemadd', true);
```

ADR-0086's rule ("save every 10 seconds, and ALSO report immediately on any user interaction") is
exactly what jellyfin-web ships. The ADR only claims the 10 seconds from Jellyfin; it could claim the
interaction half too.

---

## Claim 6 — `pragma_table_xinfo` schema fingerprinting

**Claim** (ADR-0047): "Jellyfin's own check has to fingerprint the schema by probing
`pragma_table_xinfo` for three columns that happen to have arrived in the right releases, because its
old database carries no version stamp at all."

**Verdict: CONFIRMED**, mechanism and column count. The "no version stamp" clause is confirmed by
absence — see below.

File: `Jellyfin.Server/Migrations/Routines/20250420193000_MigrateLibraryDbCompatibilityCheck.cs`
https://github.com/jellyfin/jellyfin/blob/master/Jellyfin.Server/Migrations/Routines/20250420193000_MigrateLibraryDbCompatibilityCheck.cs
Read 2026-09-10 at commit `cf09de60`.

**The names**, since the task asked for them: class `MigrateLibraryDbCompatibilityCheck`, method
`CheckMigratableVersion`, and inside it a local static function `CheckColumnExistance` (spelled that
way in the source).

```csharp
private static void CheckMigratableVersion(SqliteConnection connection)
{
    CheckColumnExistance(connection, "TypedBaseItems", "lufs");
    CheckColumnExistance(connection, "TypedBaseItems", "normalizationgain");
    CheckColumnExistance(connection, "mediastreams", "dvversionmajor");

    static void CheckColumnExistance(SqliteConnection connection, string table, string column)
    {
        using (var cmd = connection.CreateCommand())
        {
#pragma warning disable CA2100 // Review SQL queries for security vulnerabilities
            cmd.CommandText = $"Select COUNT(1) FROM pragma_table_xinfo('{table}') WHERE lower(name) = '{column}';";
#pragma warning restore CA2100 // Review SQL queries for security vulnerabilities
            var result = cmd.ExecuteScalar()!;
            if (!result.Equals(1L))
            {
                throw new InvalidOperationException("Your database does not meet the required standard. Only upgrades from server version 10.9.11 or above are supported. Please upgrade first to server version 10.10.7 before attempting to upgrade afterwards to 10.11");
            }
        }
    }
}
```

Three columns, across two tables, probed with `pragma_table_xinfo`. Confirmed exactly. The error
message confirms the ADR's reading of the intent: the probe is standing in for "which release wrote
this file", and the answer it can give is only a floor ("10.9.11 or above").

**The causal clause.** ADR-0047 says the probe exists *because* library.db has no version stamp. The
ADR does not cite this, so I checked it directly: at tag `v10.10.7` — the last release that owned
library.db — `Emby.Server.Implementations/Data/SqliteItemRepository.cs` (5,971 lines),
`BaseSqliteRepository.cs`, and `SqliteExtensions.cs` contain **no** occurrence of `user_version`,
`schema_version`, `SchemaVersion` or `DbVersion`, case-insensitive. There is no stamp to read. The
ADR's causal claim is a sound inference from the owner's code, and this is the citation it lacks.

---

## Claim 7 — `RunMigrationOnSetup` is opt-in, default false

**Verdict: CONFIRMED**, name, default, and semantics.

**The flag.** `Jellyfin.Server/Migrations/JellyfinMigrationAttribute.cs`, read 2026-09-10:

```csharp
/// <summary>
/// Gets or Sets a value indicating whether the annoated migration should be executed on a fresh install.
/// </summary>
public bool RunMigrationOnSetup { get; set; }
```

A `bool` auto-property with no initialiser: **the default is `false`**. Opt-in, as claimed.

**The semantics.** `Jellyfin.Server/Migrations/JellyfinMigrationService.cs`,
`CheckFirstTimeRunOrMigration`, read 2026-09-10:

```csharp
if (!serverConfig.IsStartupWizardCompleted || startupOptions.StartupMode is Configuration.StartupMode.SeedSystem)
{
    logger.LogInformation("System initialization detected. Seed data. Startup mode is: {StartupMode}", ...);
    var flatApplyMigrations = Migrations.SelectMany(e => e.Where(f => !f.Metadata.RunMigrationOnSetup)).ToArray();
    ...
        var startupScripts = flatApplyMigrations
            .Where(...)
            .Select(e => (Migration: e.Metadata, Script: historyRepository.GetInsertScript(new HistoryRow(e.BuildCodeMigrationId(), GetJellyfinVersion()))))
            .ToArray();
        foreach (var item in startupScripts)
        {
            logger.LogInformation("Seed migration {Key}-{Name}.", item.Migration.Key, item.Migration.Name);
            await dbContext.Database.ExecuteSqlRawAsync(item.Script).ConfigureAwait(false);
        }
}
```

The mechanism is exactly as the ADR describes. On a fresh install, every migration *without*
`RunMigrationOnSetup` is written straight into the EF history table as already applied — an INSERT of
a `HistoryRow`, never a `Perform`. It is stamped, not run. Migrations *with*
`RunMigrationOnSetup = true` are left out of the stamping set and so actually execute later.

So the default of `false` is precisely what stops a repair migration replaying on an empty database.
The six migrations that opt in on `master` are all seed-data, not repair: `AddDefaultCastReceivers`,
`AddDefaultPluginRepository`, `ReaddDefaultPluginRepository`, `UpdateDefaultPluginRepository`,
`MoveTrickplayFiles`.

---

## Claim 8 — "people have no container parent"

**Claim** (ADR-0077): "Jellyfin's mechanism is that people have no container parent."

**Verdict: CONFIRMED, and materially incomplete.** Jellyfin's mechanism is a *pair*: no container
parent AND an explicit exclude-by-kind list. The second half is the very design ADR-0077 proposes as
its departure from Jellyfin.

### The owner says it in as many words

`Jellyfin.Server.Implementations/Item/BaseItemRepository.QueryBuilding.cs`, read 2026-09-10,
doc comment on `GetExemptedItemByNameTypes`:

> Returns the by-name types a query asks for, **which carry no TopParentId to filter on.**

### How the parentlessness arises

- `MediaBrowser.Controller/Entities/Person.cs`: `public override bool SupportsAncestors => false;`
  (also on `Genre`, `MusicGenre`, `Studio`, `Year`, `LiveTvProgram`; base is `true`).
- `Jellyfin.Server.Implementations/Item/ItemPersistenceService.cs`:
  `var ancestorIds = item.SupportsAncestors ? item.GetAncestorIds().Distinct().ToList() : ...` — no
  ancestor rows are written for people.
- `LibraryManager.GetOrCreatePerson` calls `CreateItem(item, null)`: a null parent.

### How that excludes them from browse

`LibraryManager.AddUserToQuery` (line 2080): any user-scoped query with no explicit parent, ancestor,
channel, item-id or owner filter has `query.TopParentIds` forced to the user's library views.

`BaseItemRepository.QueryBuilding.cs`, `ApplyTopParentFiltering`:

```csharp
var queryTopParentIds = filter.TopParentIds;
if (queryTopParentIds.Length == 0)
{
    return baseQuery;
}

var exemptedItemByNameTypes = GetExemptedItemByNameTypes(filter);
if (exemptedItemByNameTypes.Count == 0)
{
    return baseQuery.WhereOneOrMany(queryTopParentIds, e => e.TopParentId!.Value);
}

baseQuery = baseQuery.Where(e => exemptedItemByNameTypes.Contains(e.Type) || queryTopParentIds.Any(w => w == e.TopParentId!.Value));
```

A person's `TopParentId` is null, so the first return excludes it. That is the ADR's claim, confirmed.

### The half the ADR does not mention

The escape hatch is **by kind**:

```csharp
private List<string> GetExemptedItemByNameTypes(InternalItemsQuery filter)
{
    var includedItemByNameTypes = GetItemByNameTypesInQuery(filter);
    if ((filter.IncludeItemsByName ?? false) && includedItemByNameTypes.Count > 0)
    {
        return includedItemByNameTypes;
    }

    return _itemByNameKinds.Where(filter.IncludeItemTypes.Contains).Select(e => _itemTypeLookup.BaseItemKindNames[e]!).ToList();
}
```

with, in `BaseItemRepository.cs` line 49:

```csharp
private static readonly BaseItemKind[] _itemByNameKinds =
[
    BaseItemKind.Person,
    BaseItemKind.Genre,
    BaseItemKind.MusicGenre,
    BaseItemKind.MusicArtist,
    BaseItemKind.Studio
];
```

A surface gets people back only by naming the kind (`IncludeItemTypes`) or setting
`IncludeItemsByName`. That is exclude-by-kind with an opt-in, which is what ADR-0077 decides on. The
ADR frames its by-kind rule as a *departure* forced by CanonCore's ordered entity containers. The
departure is real and the reason is sound, but the destination is where Jellyfin already is, and the
ADR would be stronger saying so than presenting by-kind as an invention.

There is also a per-user access filter for by-name rows, `ApplyItemByNameAccessFiltering`, which
keeps a person only when at least one credited item is reachable for that user. CanonCore has no
equivalent problem yet, but it is the third piece of Jellyfin's mechanism and is worth knowing exists.

---

## Claim 9 — five backup targets

**Claim** (ADR-0047): "Jellyfin's equivalent names five targets and includes on-disk artefact
directories, not just the database."

**Verdict: CONFIRMED.** Exactly five.

`Jellyfin.Server/Migrations/JellyfinMigrationBackupAttribute.cs`, read 2026-09-10, in full:

| Property | What it backs up |
| --- | --- |
| `LegacyLibraryDb` | the old `library.db` file |
| `JellyfinDb` | the current database |
| `Metadata` | the metadata folder |
| `Trickplay` | the trickplay folder |
| `Subtitles` | the subtitles folder |

Three of the five are on-disk artefact directories. The count and the character of the list are both
as the ADR states.

The attribute is `AllowMultiple = true`, and `JellyfinMigrationService.MergeBackupAttributes` ORs the
flags across every pending migration, so the union of what the pending ladder declares is what gets
backed up. `PrepareSystemForMigration` then routes them: `LegacyLibraryDb` to a `.bakN` file copy,
`JellyfinDb` to `IJellyfinDatabaseProvider.MigrationBackupFast`, and the three folder flags to
`IBackupService.CreateBackupAsync(new BackupOptionsDto { Metadata, Subtitles, Trickplay, Database = false })`.
On failure, `MigrateStepAsync` rolls all three back independently. This is a stronger version of the
ADR's point than the ADR makes: the declaration is not just a list, it drives three different backup
and rollback mechanisms.

---

## Claim 10 — `PlaybackProgressInfo` carries no duration field (control)

**Verdict: CONFIRMED**, with one nuance worth stating.

`MediaBrowser.Model/Session/PlaybackProgressInfo.cs`, read 2026-09-10, complete member list:

`CanSeek`, `Item` (`BaseItemDto`), `ItemId`, `SessionId`, `MediaSourceId`, `AudioStreamIndex`,
`SubtitleStreamIndex`, `IsPaused`, `IsMuted`, `PositionTicks`, `PlaybackStartTimeTicks`,
`VolumeLevel`, `Brightness`, `AspectRatio`, `PlayMethod`, `LiveStreamId`, `PlaySessionId`,
`RepeatMode`, `PlaybackOrder`, `NowPlayingQueue`, `PlaylistItemId`.

No `RunTimeTicks`, no `Duration`, no duration under any name. Position, but never the thing a
position would be a fraction of.

**The nuance:** there is a nested `Item` of type `BaseItemDto`, and `BaseItemDto` does have
`RunTimeTicks`. It changes nothing. `UpdatePlayState` reads
`item.GetRunTimeTicksForPlayState()` off the server's own `BaseItem`, never off `info.Item`. So a
client that knows the duration has no way to tell the server, and the `!hasRuntime` branch in claim 1
fires regardless.

The control behaves as a control should: claims 1 and 10 are the same fact seen from two ends. The
protocol has no slot for a client-supplied duration, so the server's only options when its own
runtime is 0 are "unknown" or a fabricated `true`, and Jellyfin picked the second.

---

## Incidental finding, outside the ten claims

**ADR-0047's "three stages" paragraph has the default wrong.** The ADR says: "CORE INITIALISATION for
the database migrations themselves (**the default**)".

The three stage names and their order are right —
`Jellyfin.Server/Migrations/Stages/JellyfinMigrationStageTypes.cs`, read 2026-09-10:
`PreInitialisation = 1`, `CoreInitialisation = 2`, `AppInitialisation = 3`, with doc comments
matching the ADR's descriptions.

But the effective default for a code migration is `AppInitialisation`, not `CoreInitialisation`.
`JellyfinMigrationAttribute` declares `Stage` with an initialiser of `CoreInitialisation` and a doc
comment saying so — and then **overwrites it in the constructor body**, which in C# runs after the
property initialiser:

```csharp
public JellyfinMigrationAttribute(string order, string name, string? key)
{
    Order = DateTime.Parse(order, CultureInfo.InvariantCulture);
    Name = name;
    Stage = JellyfinMigrationStageTypes.AppInitialisation;
    ...
}
```

Both public constructors funnel through it. A code search for `"Stage = JellyfinMigrationStageTypes"`
across the repo (2026-09-10) returns three hits: this constructor, and two routines that set
`AppInitialisation` explicitly and redundantly (`CleanupOrphanedExtras`,
`EnableLocalSimilarityProviders`). **No routine anywhere sets `CoreInitialisation`.** Spot-checked
`MigrateLibraryDbCompatibilityCheck`, `MigrateLibraryDb`, `DisableTranscodingThrottling` and
`MergeDuplicatePeople`: none declares a stage, so all four run at App.

What actually runs at `CoreInitialisation` is the EF-generated *schema* migrations —
`MigrateStepAsync` only populates `pendingDatabaseMigrations` when
`stage is JellyfinMigrationStageTypes.CoreInitialisation`. So Core is for schema, App is for code
routines, and the XML doc comment on `Stage` is stale. ADR-0047 inherited the stale comment.

This is a documentation-level correction, not a design one: the ADR's decision to have three stages
in that order is untouched. Only the parenthetical "(the default)" is wrong, and it is attached to
the wrong stage.

---

## Summary table

| # | Claim | Verdict |
| --- | --- | --- |
| 1 | `if (!hasRuntime) { data.Played = true; }` | **CONTRADICTED** as a quote; behaviour confirmed |
| 2 | People keyed on name, no external ids | CONFIRMED |
| 3 | 2020: "no easy fix ... before the database rewrite" | CONFIRMED |
| 4 | Oct 2025: "no bearing on the data models ... 10.11" | CONFIRMED (quote); framing around it flagged |
| 5 | jellyfin-web reports every 10 s | CONFIRMED |
| 6 | `pragma_table_xinfo`, three columns, no version stamp | CONFIRMED |
| 7 | `RunMigrationOnSetup`, opt-in, default false | CONFIRMED |
| 8 | "people have no container parent" | CONFIRMED, materially incomplete |
| 9 | Five backup targets incl. artefact directories | CONFIRMED |
| 10 | `PlaybackProgressInfo` has no duration | CONFIRMED |
| — | (incidental) CoreInitialisation is "the default" | **CONTRADICTED** |
