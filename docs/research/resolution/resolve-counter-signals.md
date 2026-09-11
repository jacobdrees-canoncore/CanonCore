# Resolving R3–R13 — the eleven counter-signals against settled refusals

STATUS: complete — all eleven items resolved 2026-09-09. See Summary at the end.

Started 2026-09-09. Source of the eleven items:
`docs/research/competitor-sweep/CONSOLIDATED-FINDINGS.md` L1027–1270 (§ counter-signals R3–R13).
Spec under test: `SPEC.md` at this repo root. **All line numbers below are SPEC.md as it
stands today**, not the `prompt.md` line numbers the findings quote — the spec has moved since
(R1 and R2 have already landed, so `.nfo` reading and backup/restore are now IN the spec).

Precedents that bind this pass:
- **R1 (`.nfo`) was REVERSED** — Plex shipped the thing it had refused since 2008, and the refusal
  did not survive the last holdout moving. Bar cleared by: *the incumbent that held the position
  abandoned it*.
- **R2 (backup/restore) was NARROWED** — ten of eleven agents raised it independently, and the data
  cannot be re-derived from files. Bar cleared by: *convergent independent finding plus a
  first-principles argument the refusal's own reasoning implies*.
- **Seven other refusals came back CORROBORATED** and stay shut.

So the bar for MOVES is: evidence that the refusal is wrong **for users**, not that it is
unfashionable, and not that an incumbent does something different. An incumbent doing something
different is the start of the argument, not the end of it.

Method for each item, in order: (1) what Plex actually does, with URL and quote; (2) what Jellyfin
actually does, with source file and line or doc URL and quote; (3) industry standard or best
practice, said plainly where there is none; (4) SURVIVES or MOVES, judged on what is best for
users.

Every claim carries a URL or a file path plus the date it was checked. Where I could not verify
something, it says so in those words.

---

**Note on line numbers.** `SPEC.md` is being edited by another session while this pass runs — it went
from 1010 to 1066 lines between two reads on 2026-09-09. Line numbers below are as of **2026-09-09
18:18** and every citation also carries its anchor text, which is what to search for if they have
moved again.

---

## R3 · "ONE number clears the position" meets a first-class `text` medium

**Finding strength as filed:** MODERATE. **Verdict: MOVES** (narrowly — see §4).

*The rule under test,* SPEC.md L622 (as of 2026-09-09 18:18):
> "ONE number clears the position; do not add a second, higher threshold for that."

and L623–624:
> "Force-complete anything under five minutes so trailers never sit in Continue Watching."

against L210 — `medium (video|audio|text|image)`, closed — and L227 "MEDIUM IS A PLAYBACK MEDIUM…
it is four values, closed."

### 1. What Plex actually does

**Plex's threshold is named for a medium, and its default is two conditions combined, not one.**
Both settings live under Settings > Server > Library:

> "**Video played threshold** — Set the progress percentage for video playback at which point the
> video will be marked as played. (Default threshold is 90%.)"
>
> "**Video play completion behavior** — Decide whether to use end credits markers to determine the
> 'played' state of video items. When markers are not available the selected threshold percentage
> (from the above setting) will be used. … **earliest between threshold percent and first credits
> marker** : Use the first credits marker only if it is earlier than the manually set percentage,
> otherwise use the manually set percentage. **This is the default behavior.**"
> — https://support.plex.tv/articles/200289526-library/ (fetched 2026-09-09)

Two things follow. First, the setting is scoped by name: it is the *Video* played threshold, not the
played threshold. Second, Plex's **default** for video is literally `min(percentage, credits marker)`
— a second, *earlier* condition rather than a second higher one, but a second condition all the same.
Plex did not manage one number even for one medium.

**Plex has no `text` medium at all, so it cannot be the counter-example either way.** Library types
are enumerated exhaustively:

> "Select a type of media for this library … Available choices: **Movies / TV Shows / Music / Photos
> / Other Videos**"
> — https://support.plex.tv/articles/200288926-creating-libraries/ (fetched 2026-09-09)

**I could not verify any documented Plex rule for when a music track or a photo counts as played.**
The Library settings page has no music or photo equivalent of "Video played threshold", and
`201018487-mark-as-watched-or-unwatched` (last modified 5 December 2024, fetched 2026-09-09) describes
watched state only for movies, episodes, seasons and series. Saying more than that would be recall,
not verification.

### 2. What Jellyfin actually does

**Jellyfin ships three code paths keyed on medium, with five constants across them — and the third
path has no constants at all.** `Emby.Server.Implementations/Library/UserDataManager.cs`,
`UpdatePlayState`, lines 439–498 (fetched 2026-09-09), the branch conditions verbatim:

```csharp
// If a position has been reported, and if we know the duration
if (positionTicks > 0 && hasRuntime && item is not AudioBook && item is not Book)
{
    var pctIn = decimal.Divide(positionTicks, runtimeTicks) * 100;
    if (pctIn < _config.Configuration.MinResumePct)              { positionTicks = 0; }
    else if (pctIn > _config.Configuration.MaxResumePct
             || positionTicks >= (runtimeTicks - TimeSpan.TicksPerSecond))
                                { positionTicks = 0; data.Played = playedToCompletion = true; }
    else
    {
        // Enforce MinResumeDuration
        var durationSeconds = TimeSpan.FromTicks(runtimeTicks).TotalSeconds;
        if (durationSeconds < _config.Configuration.MinResumeDurationSeconds)
                                { positionTicks = 0; data.Played = playedToCompletion = true; }
    }
}
else if (positionTicks > 0 && hasRuntime && item is AudioBook)
{
    var playbackPositionInMinutes = TimeSpan.FromTicks(positionTicks).TotalMinutes;
    var remainingTimeInMinutes = TimeSpan.FromTicks(runtimeTicks - positionTicks).TotalMinutes;
    if (playbackPositionInMinutes < _config.Configuration.MinAudiobookResume) { positionTicks = 0; }
    else if (remainingTimeInMinutes < _config.Configuration.MaxAudiobookResume
             || positionTicks >= runtimeTicks)
                                { positionTicks = 0; data.Played = playedToCompletion = true; }
}
else if (!hasRuntime)
{
    // If we don't know the runtime we'll just have to assume it was fully played
    data.Played = playedToCompletion = true;
    positionTicks = 0;
}
```

The five constants, verbatim from `MediaBrowser.Model/Configuration/ServerConfiguration.cs`
lines 133–157 (fetched 2026-09-09) — the finding's numbers are **all five verified correct**:

```csharp
public int MinResumePct { get; set; } = 5;
public int MaxResumePct { get; set; } = 90;
public int MinResumeDurationSeconds { get; set; } = 300;
public int MinAudiobookResume { get; set; } = 5;   // minutes
public int MaxAudiobookResume { get; set; } = 5;   // minutes
```

**The finding missed the sharpest part of this.** `Book` is excluded from the video branch by
`item is not Book`, and it is not an `AudioBook`, and it *does* have a runtime, so it satisfies no
branch and falls out of `UpdatePlayState` with **no threshold applied at all** — the raw reported
position is stored and the item is never auto-completed. That is not because Jellyfin thinks books
are unplayable: `MediaBrowser.Controller/Entities/Book.cs` (fetched 2026-09-09) declares

```csharp
public override bool SupportsPlayedStatus => true;
public override bool SupportsPositionTicksResume => true;
```

against `BaseItem.cs:187–190` where both default to `false`. So Jellyfin's `text` medium is
explicitly resumable and explicitly completable, and the completion rule that governs video and
audiobooks **does not reach it**. Jellyfin needed a third answer for text and shipped the empty one.

Note also what the video branch *does* cover: plain `Audio` (music) is not excluded, so
`MinResumeDurationSeconds = 300` applies to every music track. In Jellyfin, a three-minute song played
past 5% is marked **played** and its position cleared. The same constant does opposite-signed work in
two media — right for music, wrong for a four-minute short film.

### 3. Industry standard / best practice

**There is no industry standard here, and the disagreement is not close: every project keys the rule
to the medium, and the *unit* changes with the medium.**

| Project | Medium | Completion rule | Source (all fetched 2026-09-09) |
|---|---|---|---|
| Plex | video | percentage (90%) `min`'d with a credits marker | support.plex.tv/articles/200289526-library/ |
| Plex | music, photo | not documented — could not verify | — |
| Jellyfin | video + music | 5% floor, 90% ceiling, 300s duration floor | `ServerConfiguration.cs:133-145` |
| Jellyfin | audiobook | 5 min floor, 5 min remaining ceiling (absolute) | `ServerConfiguration.cs:151-157` |
| Jellyfin | book | **no rule** | `UserDataManager.cs:449-492` |
| Audiobookshelf | audio | 10 seconds remaining, or an optional percentage | `server/models/MediaProgress.js` |
| Audiobookshelf | ebook | a separate `ebookProgress` float, no time rule | same file, lines 24-26, 71-72 |
| Komga | text | **pages**: `page in 1..media.pageCount`, `completed: Boolean` | `BookLifecycle.kt:406-442` |

Two rows are decisive for the question actually asked.

**Komga proves the unit itself is medium-dependent.** Its progress record is
`ReadProgress(bookId, userId, page: Int, completed: Boolean, …)`
(`komga/src/main/kotlin/org/gotson/komga/domain/model/ReadProgress.kt`), and its API documents
completion as derived from pages, not from a clock:

> "page can be omitted if completed is set to true. completed can be omitted, and will be set
> accordingly depending on the page passed and the total number of pages in the book."
> — `komga/src/main/kotlin/org/gotson/komga/interfaces/api/rest/BookController.kt:700`

There is no seconds-shaped number that could clear a reading position. A page count is not a
duration and cannot be compared to one.

**Audiobookshelf, the spec's own cited authority for the ten-second figure, ships two numbers and two
progress representations.** `applyProgressUpdate` in `server/models/MediaProgress.js`:

```js
// Check if progress is far enough to mark as finished
//   - If markAsFinishedPercentComplete is provided, use that otherwise use
//     markAsFinishedTimeRemaining (default 10 seconds)
```

and the row carries `currentTime`/`duration` for audio alongside `ebookLocation`/`ebookProgress` for
text — one table, two units, chosen by medium.

### 4. SURVIVES or MOVES

**MOVES — and only just, on a narrow axis. Most of the rule is corroborated, not contradicted.**

What **survives**, and is actively strengthened by the evidence:

- *"Do not add a second, higher threshold for that"* is right, and Jellyfin is the proof rather than
  the counter-example. Its `MinResumePct`/`MaxResumePct` pair is exactly the two-thresholds-fighting
  failure the rule names: below 5% the position is silently discarded, so a user who watches four
  minutes of a two-hour film and comes back gets nothing, and above 90% it is discarded again in the
  other direction. CanonCore's single absolute figure has neither hole.
- *Time-remaining rather than percentage* is the design Jellyfin had to migrate to under duress.
  Its audiobook branch exists because a percentage cannot serve a twelve-hour item, and it switched
  to absolute minutes to fix it. CanonCore starts where Jellyfin ended up, so **one number plausibly
  does serve both `video` and `audio`** — a claim neither incumbent's history contradicts.

What **moves**: the rule is stated as if one number could serve four media, and two of the four have
no clock to compare it against.

- `image` has no duration. There is nothing for a five-minute force-complete or a
  seconds-remaining threshold to read.
- `text` has a position, and the spec needs it to. Per-edition progress is justified in the spec by
  exactly this case — "finishing a novelisation must not mark the film watched" presupposes you can
  finish a novelisation — and the demo ships novels. But the position is a page or a locator, and
  Komga's `page in 1..pageCount` is what clears it. Jellyfin's silence here is not a design; it is
  the hole left where the video rule did not fit.

**Why this is best for users, not merely tidier.** The failure the current wording produces is
concrete and one-directional: a novel edition either gets no completion rule at all (Jellyfin's
outcome — reading progress that never finishes) or gets a seconds-based one that can never fire
(unknown duration → the spec's own "COMPLETION IS UNKNOWN"). Either way a user who finishes a Target
novelisation cannot get the work marked read, and "Have I watched this WORK" then unions an empty
set. That is the demo's central question failing on the demo's own data.

**Recommended edit, minimal.** Keep the sentence and scope it: *one number per medium, and the number
is in that medium's own unit*. Then state the two consequences already true of what the product
ships — `image` has no resume position, and `text` completes on the owner's act or a reader's page
count rather than a clock. The five-minute force-complete is a **video-and-audio** rule and should say
so; applied to `text` it is meaningless and applied to `image` it is undefined.

Do **not** reverse the "no second, higher threshold" half. That half is the one the sweep's own
evidence defends.

---

## R4 · "Groups are NEVER typed by medium"

**Finding strength as filed:** MODERATE. **Verdict: SURVIVES**, and the sweep's headline evidence
against it has since been withdrawn by the company that produced it.

*The rule under test,* SPEC.md L125–128 (as of 2026-09-09 18:18):
> "WHY a scope and not a partition: a partition means an item belongs to exactly one group, and
> multi-placement is the entire product. WHY never typed by medium: a Plex library is typed, and
> that is exactly what stops a container holding mixed media."

### 1. What Plex actually does

**Plex libraries are typed, and there are exactly five types with no `text` among them.**

> "Select a type of media for this library … Available choices: **Movies / TV Shows / Music /
> Photos / Other Videos**"
> — https://support.plex.tv/articles/200288926-creating-libraries/ (fetched 2026-09-09)

**But Plex's *collection* — its grouping construct, the real analogue of a CanonCore group — is
already fighting the library typing, and Plex documents the workaround itself.** From the Collections
article (fetched 2026-09-09):

> "The collections details page contains all the items in that library that belong to the collection.
> **It can also include items from other libraries that are in a collection with the exact same
> name.** By adding items in different libraries to identically-named collections, you can relate
> them to each other. **For instance, you can have Star Wars movies, TV shows, and music albums all
> in a 'Star Wars' collection so they're related to each other.**"
> — https://support.plex.tv/articles/201273953-collections/

That is Plex reaching for exactly the container the spec says a typed library prevents, and getting
there by string-matching a tag across three typed libraries. The spec's stated reason is confirmed
first-hand: the typing is the obstacle, and Plex's answer to it is a join on a name.

**The 2.5% / 0.2% evidence is real, is dated 2024 not 2025, and Plex publicly reversed the decision
it justified.**

The figures, verbatim:
> "Currently, music playback is utilized by only **2.5%** of our users, while photos are accessed by
> just **0.2%** on a monthly basis. This means that we are including resources and technical debt
> within the Plex app that only a small fraction of our users engage with."
> — https://www.plex.tv/blog/the-future-of-plex-focused-streamlined-and-ready-for-feedback/,
> `datePublished` **2024-09-12T14:03:32+00:00** in the page's own JSON-LD (fetched 2026-09-09).
> **Correction to the finding, which dates this 2025.**

Ten months later, from Plex's own account, signed "Your Friends at Plex":

> "In the second half of 2024, we shared our plans to create a new experience in the Plex app,
> focused solely on movies, shows, and Live TV. … We intended to better cater to the needs of our
> users, ensuring that each app is focused on its specific media type. … The feedback that we
> received immediately thereafter and since was loud and clear. **In hindsight, we recognize this
> wasn't the right approach. Many of you let us know that you'd prefer to keep music and photos in
> the Plex app, instead of accessing this functionality in companion apps. We listened. We learned.
> We are adjusting.** So starting TODAY, the new experience preview for Roku (Ver 8.4.0) brings back
> support for music and photo libraries."
> — https://forums.plex.tv/t/music-photos-are-back-check-them-out-in-the-new-roku-preview/926067,
> posted by `PlexInfo` **2025-07-16T11:39:13Z** (fetched 2026-09-09 via the Discourse `.json`
> endpoint)

The reason given for the reversal is the one that matters here: users would not accept a
medium-partitioned surface even when the usage data said only 2.5% of them wanted the other media.
Low usage of a medium did not license splitting it out.

Two further things in the 2024 post cut the same way and the sweep did not report them. Plex used the
same post to announce **"support for custom media types"** and a developer program — *"Whether you're
interested in developing a new app for ebooks, podcasts, or even niche media types, open APIs will
provide the tools you need"* — i.e. Plex naming its own closed type list as the constraint it wanted
to open.

### 2. What Jellyfin actually does

**Jellyfin types libraries and does NOT type collections. The split is exactly the one the finding
says the spec should make.**

Libraries are typed, twelve real types, in `Jellyfin.Data/Enums/CollectionType.cs` (fetched
2026-09-09): `unknown, movies, tvshows, music, musicvideos, trailers, homevideos, boxsets, books,
photos, livetv, playlists, folders` (ids 0–12), plus 15 internal view pseudo-types (`tvgenres`,
`movieresume`, …) marked `[OpenApiIgnoreEnum]`.

Collections are not. `Emby.Server.Implementations/Collections/CollectionManager.cs`,
`AddToCollectionAsync` (fetched 2026-09-09), performs **no type check of any kind** — the only
validation is existence:

```csharp
foreach (var id in ids)
{
    var item = _libraryManager.GetItemById(id);
    if (item is null)
    {
        throw new ArgumentException("No item exists with the supplied Id " + id);
    }
    if (!currentLinkedChildrenIds.Contains(id))
    {
        (itemList ??= new()).Add(item);
        linkedChildrenList.Add(item);
    }
}
```

Any `BaseItem` may be linked into any `BoxSet`. `BoxSet` itself is a plain `Folder` holding
`LinkedChildren` (`MediaBrowser.Controller/Entities/Movies/BoxSet.cs`, fetched 2026-09-09).

**The genuinely awkward evidence for the spec — and it needs stating — is that Jellyfin's untyped
*library* is discouraged by its own documentation:**

> "If you have several types of media in a single folder you can also label it as **mixed**, which
> will be a generic folder view that displays all files in the library.
> *note* **Use of the mixed library type is currently discouraged due to unreliable metadata
> results.** We encourage the use of the dedicated library types."
> — https://jellyfin.org/docs/general/server/libraries/ (fetched 2026-09-09)

Read the stated cause, though. It is **"unreliable metadata results"** — a scraper problem. Jellyfin
picks a metadata agent chain per library from its type, so an untyped library has no chain to pick
and the lookup guesses. Nothing in that sentence is about the model, the browsing scope, or the
user's mental picture of their catalogue.

### 3. Industry standard / best practice

**The incumbents agree, and their agreement is finer-grained than either side of the sweep's
argument.** Both Plex and Jellyfin type the *scanning and metadata scope* and leave the *grouping
construct* untyped:

| | scanning/metadata scope | grouping construct |
|---|---|---|
| Plex | Library — typed, 5 closed types | Collection — untyped in effect; cross-library by identical name, documented |
| Jellyfin | Library — typed, 12 types; `mixed` exists and is discouraged *for metadata reasons* | BoxSet/Collection — no type check in `AddToCollectionAsync` |

A CanonCore `group` is described at L114–116 as scoping "browsing, search, WHICH PROVIDERS ARE ASKED,
scanner roots, and the review queue" — which straddles both columns. It is a grouping construct
(untyped in both incumbents) that also carries provider selection (typed in both incumbents, and the
one thing Jellyfin's docs say the typing is *for*).

There is no third-party standard here; this is a product-design convention, not a specification.

### 4. SURVIVES or MOVES

**SURVIVES.** The strongest evidence the sweep produced against it has been retracted by its author.

- Plex's own 2.5%/0.2% argument for medium-partitioning a surface was tried on real users at the
  largest scale in the category, and Plex reversed it in July 2025 with *"in hindsight, we recognize
  this wasn't the right approach."* An argument the market leader ran and abandoned is not a reason
  to adopt it here.
- Plex's Collections documentation independently states the spec's own reason back to it: a typed
  library **is** what stops a container holding mixed media, and Plex's users want that container
  badly enough that Plex documents a name-matching hack to fake it.
- Jellyfin does not type its collections at all, and CanonCore's `groups` are collections, not
  libraries.

**And the rebuttal the sweep asked for is sound but should be stated more precisely than it filed
it.** Jellyfin Vue's line is verified verbatim and is worth recording as a real design position:

> "a **media-type driven design**, where your media feels at home every time. The current approach of
> most Jellyfin clients is to be **too generic in order to be suitable for all media types
> possible**, but when you're listening to music you don't feel you're in a music player (like
> Spotify) or in Netflix when watching TV Shows and Movies"
> — https://jellyfin.org/posts/vue-vue3/, Fernando Fernández, Vue Lead, **4 April 2023** (fetched
> 2026-09-09)

That is an argument about **rendering**, not about grouping or about the model — it is in a paragraph
titled "What's next?" about a *client's* roadmap. The spec already grants it at the standing rule
"Cataloguing and displaying are separable: a renderer is needed only when a file is attached and
someone presses play." Nothing in "groups are never typed by medium" forbids a music screen that
looks like a music screen.

**One thing genuinely worth adding, on the users' side rather than the model's.** Jellyfin's stated
reason for discouraging mixed libraries — metadata reliability — lands on the *one* thing CanonCore's
groups do carry that Jellyfin's collections do not: `WHICH PROVIDERS ARE ASKED` (L114). A group
holding text, video and audio must ask a books provider, a film provider and a music provider, and a
provider asked about the wrong medium returns confident nonsense. The spec's answer already exists —
matching and applying are separate operations, unmatched values are "DROPPED AT THE DOOR AND COUNTED",
and the middle confidence band goes to a review queue — so the failure Jellyfin gets is caught by
CanonCore's design rather than shipped to the user. **Recommended:** one clause at L127 saying so,
because "a Plex library is typed" answers the partition objection and does not answer the metadata
one, and the metadata one is the objection an implementer who has run Jellyfin will actually raise.

---

## R5 · The strongest objection on record to the enrichment design

**Finding strength as filed:** MODERATE (a settled design, not strictly a refusal).
**Verdict: SURVIVES.** The objection's headline quote could not be verified, and the verifiable
record from the same company now runs the other way.

*The design under test,* SPEC.md L524–545 and L559–567 (as of 2026-09-09 18:18): enrichment reaches
all connected providers at once, a field can hold several values at once all live and visible, the
owner marks a favourite, and until then "a single declared SOURCE ORDER decides, with the Owner
first."

*The objection as filed:* Plex, dated 2019-11-20, explaining why it replaced per-server agents with a
central service — *"basically everyone just wants the best metadata we can find. It turns out they're
not interested in a part-time job managing metadata agent settings."*

### 1. What Plex actually does

**I could not verify the quote.** Searched 2026-09-09: the Plex forums' own Discourse search API for
`"part time job"`, `"part-time job"`, `"best metadata we can find"`, `"managing metadata agent
settings"` and `"basically everyone just wants"` (`https://forums.plex.tv/search.json?q=…`); the
plex.tv blog post sitemap for anything published or modified in November 2019 (nothing); the two
Plex agent announcement threads (`593269`, 2020-05-21; `615989`, 2020-07-22); and two web searches.
The phrase does not appear in any of them. It may exist in a source I did not reach — a deleted post,
a podcast, a Reddit AMA — but **on the evidence available it is not attributable, and it should not
be used to justify a design change.**

What *is* verifiable is a chronology that reverses the objection.

**2010: Plex shipped CanonCore's design, in detail.** From "Metadata Update", `datePublished`
2010-09-21T00:23:22+00:00 in the page's own JSON-LD (https://www.plex.tv/blog/metadata-update/,
fetched 2026-09-09):

> "massive amounts of data, all structured … and all **completely up to you as to how you use them**.
> Like TheMovieDB summaries? **Drag it to the top of the list of agents.** Prefer your summaries in
> Swedish? Make sure Wikipedia is above TheMovieDB, so its internationalized summaries will take
> precedence."
>
> "if you hate the Wikipedia summaries, and prefer English plot summaries, drag TheMovieDB above
> Wikipedia. **If you leave Wikipedia enabled, summaries that aren't found from TheMovieDB will be
> filled in by Wikipedia.**"
>
> "In the near future, we'll allow you to **fully customize any of the data for your media and lock it
> in place**, so that it won't be overwritten by new data from the Internet."

A declared source order, drag-to-reorder, gap-filling down the order, per-item override, and a lock.
That is the CanonCore design, minus multi-value.

**2020: Plex replaced it with a cloud service — and kept the lock.** "Introducing the new Plex Movie
agent", `drzoidberg33`, 2020-07-22T20:38:20Z
(https://forums.plex.tv/t/introducing-the-new-plex-movie-agent/615989, fetched 2026-09-09):

> "a cloud-based metadata service that does all the heavy lifting to bring together multiple metadata
> sources such as IMDb, TheMovieDb, Rotten Tomatoes, and more" (from the preview thread `593269`,
> 2020-05-21) … "**Metadata fields you have locked will not be changed however.**"

So Plex centralised the *merge* and retained the *lock*. The thing it removed was the user-facing
ordering, not the owner's ability to pin.

**2025: Plex is putting the ordering back.** "[Announcement] Custom Metadata Providers",
`drzoidberg33`, **2025-12-09T16:15:33Z**
(https://forums.plex.tv/t/announcement-custom-metadata-providers/934384, fetched 2026-09-09):

> "The new updated 'metadata agents' are just a collection of one or more metadata providers which can
> be defined in the media server. If you are familiar with how the legacy agents worked, then this
> will be very similar in the way you can **add multiple sources (via metadata providers) and re-order
> them to define the priority of the data from those sources**. Developers only really need to work on
> the metadata provider side, as **the metadata agents are just a user-defined list of providers**."
>
> "**We plan to completely remove the legacy agents system from new PMS releases in 2026.**"

A provider is "just an HTTP API that returns metadata for library items in a standardized way", and
"All the user needs to install a metadata provider is a single URL that their system can access."
That is CanonCore's provider contract and CanonCore's source order, announced by Plex nine months ago.

**And the ordering never actually went away for legacy agents.** Still live in the current support
docs (https://support.plex.tv/articles/200241558-agents/, fetched 2026-09-09):

> "**Source Priority** — You can adjust the order of the metadata sources, which sets their priority.
> To do so, grab the 'handle' indicator on the left and drag up or down to re-arrange the source
> order. … **If a piece of metadata isn't available from your first source, then the agent will
> fallback down the priority list until it finds a source with that information.**"
>
> "In most situations, people will prefer to have **Local Media Assets as the first metadata source**
> so that things like local artwork files will be used."

The second sentence is Plex independently arriving at "the Owner sits first in the source order".

**The one genuine point on the objection's side, verified.** Plex's best agent has no configuration
surface at all — same article:

> "**Plex Music**: The default agent for music libraries. It pulls in data from a variety of sources,
> including best-in-class AllMusic and MusicBrainz data. **Note: This is a special, advanced agent and
> does not appear under Settings > Server > Agents for configuration.** It is the default option when
> creating a music library, though."

So Plex does believe the *default* path must require zero configuration. It does not believe ordering
should not exist.

### 2. What Jellyfin actually does

**Jellyfin merges first-non-empty-wins, field by field, and the losing value is gone.** The spec's
characterisation at L544–545 is verified verbatim.
`MediaBrowser.Providers/Manager/MetadataService.cs`, `MergeBaseItemData`, lines 1136+ (fetched
2026-09-09) — the pattern repeats for every field:

```csharp
if (replaceData || string.IsNullOrEmpty(target.OriginalTitle))
{
    target.OriginalTitle = source.OriginalTitle;
}
if (replaceData || !target.CommunityRating.HasValue)
{
    target.CommunityRating = source.CommunityRating;
}
if (!lockedFields.Contains(MetadataField.Genres))
{
    if (replaceData || target.Genres.Length == 0)
    {
        target.Genres = source.Genres;
    }
}
```

Providers are walked in order in `ExecuteRemoteProviders` (line 950+), and the only provenance kept is
`result.Provider = provider.Name` on the *whole result* — discarded field-by-field by the merge above.
There is no structure in which two values for one field can both exist.

**And Jellyfin has already had to bolt a special case onto it,** which is worth recording because it
is the failure mode CanonCore's multi-value design avoids by construction. In the same method:

```csharp
var overviewIsFallback = false;
var taglineIsFallback = false;
…
if (MetadataLanguageUtils.MatchesPreferredLanguage(result.ResultLanguage, preferredLanguage))
{
    if (overviewIsFallback && !string.IsNullOrEmpty(result.Item.Overview))
    {
        temp.Item.Overview = null;      // throw away the earlier winner
        overviewIsFallback = false;
    }
    …
}
```

Two fields, and only two, get a second chance: a wrong-language value that won by being first is
nulled out so a later preferred-language provider can win. Every other field keeps the first
non-empty answer regardless. That is not a design; it is a patch on the place where losing the
alternative hurt most.

Jellyfin also carries a per-field `lockedFields` array, threaded through every merge call — a separate
lock flag, which is exactly what the spec refuses at "THE FAVOURITE IS THE LOCK."

### 3. Industry standard / best practice

**There is no standard, and the two incumbents are converging on CanonCore's side of it, not away
from it.**

- **Plex**: ordered multi-source with gap-fill (2010–2020), centralised merge with a lock (2020–2025),
  back to an explicitly "user-defined list of providers" (announced 2025-12-09, legacy removed 2026).
- **Jellyfin**: ordered multi-source, first-non-empty-wins, per-field locks, no provenance.
- The record-linkage convention the spec already cites (an auto-link threshold, a clerical-review
  threshold, a human in the uncertain band; `/reconcile` separate from `/extend`) is the
  general-purpose answer and is not media-server-specific.

Where the two disagree is only on **whether the merge is visible**, and both hide it by default.
Neither ships anything like multi-value-with-a-favourite; that part of the CanonCore design has no
precedent in this category and no counter-example either.

### 4. SURVIVES or MOVES

**SURVIVES, unchanged.** The evidence for moving does not exist in the form the sweep filed it, and
the evidence that does exist supports the design:

- The quote is unattributable after a deliberate search, so it cannot carry a design decision. The R1
  precedent — reverse when the incumbent that held the position abandons it — requires a verified
  incumbent position. There isn't one here.
- Plex's actual position, dated nine months ago, is that a metadata agent **is** a user-defined,
  re-orderable list of providers, and that legacy agents are being deleted in favour of that. If
  anything the sweep found the objection backwards.
- Jellyfin's merge is the design the spec explicitly refuses, and reading the code shows it failing in
  the specific way the refusal predicts — the `overviewIsFallback` patch exists only because a
  discarded alternative could not be recovered.

**What the sweep got right, and what to do about it.** The finding's real content is not "the design
is wrong" but "an implementer will meet this objection and needs the answer next to it." That is a
documentation fix, and one line of it is now better-sourced than before: Plex's own best agent, Plex
Music, "does not appear under Settings > Server > Agents for configuration" — the *default* costs the
user nothing. The spec already commits to the same thing at "Nothing is stored per field until the
owner cares" and a single global order with the Owner first.

**Recommended:** at L559–567, add one clause noting that the zero-configuration path is the default
and curation is opt-in per field, citing Plex Music as the precedent for a no-configuration default
and Plex's 2025 custom-provider announcement as the precedent for the ordered list underneath it.
**Do not** cite the unverified 2019 quote anywhere; it will not survive a check.

---

## R6 · "Container progress computed on read, never stored"

**Finding strength as filed:** MODERATE (filed by its finder as "warning, not an edit").
**Verdict: SURVIVES**, with two factual corrections to the finding and one genuinely new datum:
**Jellyfin 12.0, released 2026-09-08, now ships CanonCore's exact query.**

*The decision under test,* SPEC.md L778–785 (as of 2026-09-09 18:30, the file having moved to 1211
lines mid-session):
> "Container progress is computed on read from the ancestor closure, deduped with COUNT(DISTINCT
> item), never stored. … The dedup matters here in a way it does not elsewhere. Jellyfin's equivalent
> is correct only because of an assumption written into its own source — that members of a group are
> distinct folders whose leaves cannot overlap. Ours overlap by design, so the dedup is load-bearing
> rather than incidental."

### 1. What Plex actually does

Plex exposes container progress as a pair of counts on the container itself. From python-plexapi's
documentation of the `Show` and `Season` `Directory` elements (fetched 2026-09-09,
https://raw.githubusercontent.com/pkkid/python-plexapi/master/plexapi/video.py):

> `leafCount (int): Number of items in the show view.` (line 567; line 796 for the season)
> `viewedLeafCount (int): Number of items marked as played in the show view.` (line 590)

and the derived predicate, line 683–686:

```python
@property
def isPlayed(self):
    """ Returns True if the show is fully played. """
    return bool(self.viewedLeafCount == self.leafCount)
```

This confirms the spec's existing claim at "NOBODY IN THE INDUSTRY DOES THIS": `leafCount` is *items
in the view*, i.e. what is on disk, so a thirteen-episode season of which three are present and
watched satisfies `viewedLeafCount == leafCount` and reports as fully played.

**I could not verify whether Plex computes these on read or stores them.** The attributes are present
on every container response and no Plex documentation I found says which. Two adjacent settings hint
at read-time work elsewhere in the product — "Increasing the value can cause Continue Watching or app
dashboards to be much slower to appear" and "Setting a very high number can negatively affect
performance" (https://support.plex.tv/articles/200289526-library/, fetched 2026-09-09) — but that is
about hub assembly, not leaf counts, and inferring from it would be a guess. Recorded as unverified.

### 2. What Jellyfin actually does

**Correction 1 to the finding: `// These are just far too slow.` is not about collections.** The
comment is verified verbatim, in `MediaBrowser.Controller/Entities/Folder.cs:159–197` (fetched
2026-09-09):

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
        …
        return true;
    }
}
```

But `ICollectionFolder` is not Jellyfin's collection. Its own definition
(`MediaBrowser.Controller/Entities/ICollectionFolder.cs`, fetched 2026-09-09):

> "This is just a marker interface to denote **top level folders**."

`CollectionFolder` is a *library root*. Jellyfin's collection is `BoxSet`, which is a plain `Folder`
and gets `SupportsUserDataFromChildren == true`. So what Jellyfin found "far too slow" was rolling
child play state up to whole **libraries** and user views — not up to containers. Every series,
season and box set does compute on read. That makes Jellyfin a *supporting* precedent for the
CanonCore decision, not a cautionary one, with one specific carve-out at the very top of the tree.

**Correction 2: the "distinct folders" assumption is narrower than the finding says, and does not
govern the container path.** The comment is real, verbatim, at
`Jellyfin.Server.Implementations/Item/ItemCountService.cs:658` (fetched 2026-09-09):

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

but the `groups` it iterates come from `GetPresentationKeyGroups` — Jellyfin's **merged folders**, the
case where the same series appears in two libraries and is shown as one item. The assumption is that
two *libraries* holding the same show do not share leaf rows. It is not an assumption about
containers, and it is applied only after each folder's own count has already been deduped.

**The new datum, and it is the important one.** The count that actually serves containers,
immediately above at `ItemCountService.cs:600–650`, unions three traversals and then dedups by item
id — which is `COUNT(DISTINCT item)` over an ancestor closure, the CanonCore design verbatim:

```csharp
var ancestorLeaves = dbContext.AncestorIds …          // hierarchical closure
var linkedLeaves = dbContext.LinkedChildren …          // direct associations
var linkedFolderLeaves = dbContext.LinkedChildren      // association → folder → its closure
    .Join(dbContext.BaseItems.Where(b => b.IsFolder), …)
    .Join(dbContext.AncestorIds, …)
    .Join(playedLeafItems, …);

var countsByFolder = ancestorLeaves
    .Union(linkedLeaves)
    .Union(linkedFolderLeaves)
    .GroupBy(x => x.FolderId)
    .Select(g => new
    {
        FolderId = g.Key,
        Total  = g.Select(x => x.Id).Distinct().Count(),
        Played = g.Where(x => x.Played).Select(x => x.Id).Distinct().Count()
    })
```

Note what Jellyfin needed here: an explicit **`AncestorIds` table** (a materialised ancestor closure,
not a `ParentId` walk), a **`LinkedChildren`** association table alongside it, a union of the two,
and `Distinct()` on both the total and the played count *because the three traversals can reach the
same leaf*. That is the same shape as CanonCore's placements-plus-closure model, and Jellyfin arrived
at it independently.

**The batch path is real and the comment is verbatim.** `Folder.cs:1946–1994`:

```csharp
if (precomputedCounts.HasValue)
{
    // Use batch-fetched counts (avoids N+1 queries)
    (playedCount, totalCount) = precomputedCounts.Value;
}
else
{
    // Fall back to per-item query when no batch data is available
    …
}
```

**Dating it.** `v12.0` was published **2026-09-08** (`gh api repos/jellyfin/jellyfin/releases`,
fetched 2026-09-09) — one day before this pass. The file is under active repair right up to the
release: the five most recent commits touching `ItemCountService.cs` are dated 2026-08-27 through
**2026-09-07**, titled *"Fix By-Name item count handling"*, *"Count a season's episodes by the season
they belong to"*, *"Fix by-name item counts"*, *"Expose optimized ItemCounts for byName items"* and
*"Count distinct items for byName ItemCounts and batch every kind"*. Read-time container counting is
not a solved problem in the incumbent; it is a live one.

### 3. Industry standard / best practice

**Both incumbents compute container progress from child state rather than maintaining a stored
aggregate, and both hit performance walls doing it.** There is no third position and no standard.

The evidence for the difficulty is Jellyfin's, and it is unambiguous: an `AncestorIds` closure table,
three-way union, `Distinct()` twice, an N+1 fallback path, a batch path, a hard `false` at the library
root with the comment "These are just far too slow", and five bug-fix commits in the twelve days
before 12.0 shipped. The `IsCountableLeaf` predicate carries its own warning about the same class of
bug: *"Shared by the per-item and batched count paths so they cannot diverge."*

### 4. SURVIVES or MOVES

**SURVIVES**, and is better supported now than when it was written.

- Computing on read is what both incumbents do for containers. Jellyfin's only stored-vs-computed
  retreat is at the library root, which CanonCore does not have.
- `COUNT(DISTINCT item)` over an ancestor closure is not a novel or risky construction: it is,
  line for line, what Jellyfin 12.0 shipped last week for the same job, arrived at independently.
- Count-based rather than duration-weighted is untouched by anything found here.

**Two corrections the spec should absorb, because as written it cites Jellyfin slightly wrong and an
implementer who opens the file will notice.**

1. L782–785 says Jellyfin's dedup "is correct only because of" the distinct-folders assumption. That
   is true of *one* path — the merged-folder roll-up at `ItemCountService.cs:658` — and false of the
   container path immediately above it, which dedups explicitly with `Distinct()`. The honest and
   stronger version: **Jellyfin dedups for exactly the reason CanonCore does, and its one
   non-deduping path is guarded by an assumption CanonCore cannot make.**
2. The "far too slow" comment governs library roots, not collections. Quoting it as a warning against
   computing container progress on read overstates it.

**And one warning worth keeping, restated from better evidence.** The risk is not the dedup; it is the
closure. Jellyfin needs a materialised `AncestorIds` table to make this query tractable at all, and it
still needed a batch path to escape N+1. CanonCore's closure is over a cyclic category graph 22 levels
deep with 93.4% multi-placement, so the closure is larger and the cycle is a termination condition
Jellyfin never has to handle. **Recommended:** one sentence at L778 naming the materialised closure
and the batch read as the two things that have to exist for this decision to hold, so neither is
discovered late. That is the finding's own recommendation, and the evidence for it is now first-hand.

---

## R7 · The thin-client argument

**Finding strength as filed:** MODERATE, and explicitly pre-empted.
**Verdict: SURVIVES.** The wrapper's benefit is verified and real; four years of Jellyfin's own
history since that quote runs against it, and one number in the spec is now stale in the spec's own
favour.

*The decision under test,* SPEC.md L1080–1103 (as of 2026-09-09 18:35; the file is now 1234 lines):
three first-party clients, phone then TV, native Swift on TV, "Do not re-argue it, and do not quietly
drop them either."

### 1. What Plex actually does

**I could not verify Plex's client architecture from a primary source.** Plex publishes no engineering
account of how its apps are built. Third-party reporting describes the current rewrite as giving "a
unified codebase for easier, faster app development"
(https://www.howtogeek.com/plex-photos-music-returning-to-core-app/, 17 July 2025, fetched
2026-09-09), but that is a journalist's characterisation, not Plex's, and I am not treating it as
evidence.

What is verifiable from Plex's own material is the *breadth* of the surface: the April 2026 update to
Plex's own pricing post lists "Amazon Fire TV devices and supported TVs like Samsung, LG, Vizio,
PlayStation, Xbox gaming consoles and more … in addition to the requirement already being in effect
for Plex apps on multiple other platforms"
(https://www.plex.tv/blog/important-2025-plex-updates/, update dated 29 April 2026, fetched
2026-09-09). Plex ships to at least eight platform families and staffs it commercially.

### 2. What Jellyfin actually does

**The wrapper quote is verified verbatim, and the seven-store quote is in the same paragraph pair.**
"Jellyfin for webOS - July 2022 Update", Anthony Lavado, Core Team, `datetime="2022-07-08"`
(https://jellyfin.org/posts/webos-july2022/, fetched 2026-09-09):

> "It's important to note that **the app itself is a wrapper around our server's web interface**, so
> when you keep your Jellyfin server up to date, **you automatically get a lot of the fixes right
> away**. While the TV app will directly get occasional fixes, **we don't anticipate having to update
> it very often.**"
>
> "That's what happens when you're **the person in charge of App Publishing to Google, Apple, Amazon,
> LG, Samsung, Microsoft, and Roku.**"

Seven named stores, one volunteer, one paragraph apart. The claim is still current: the
`jellyfin-webos` README today reads *"This is a small wrapper around the web interface provided by the
server … so most of the development happens there."* (fetched 2026-09-09 via `gh api`).

**But look at what happened to the wrappers over the following four years.** Repo figures fetched
2026-09-09 with `gh api`:

| Client | Kind | Stars | Last push | Composition |
|---|---|---|---|---|
| `jellyfin/Swiftfin` | **native Swift**, iOS + tvOS | **4,150** | 2026-09-06 | Swift 3,450,796 B (100%) |
| `fredrikburmester/streamyfin` | Expo, third-party | **5,184** | 2026-09-09 | TS 3,649,342 B; **Kotlin 634,101 B; Swift 537,748 B** |
| `jellyfin/jellyfin-expo` ("Jellyfin Mobile", iOS) | **WebView wrapper** | 592 | 2026-09-09 | JS 152,999 B; TS 124,711 B; Swift 113 B |
| `jellyfin/jellyfin-webos` | **wrapper** | 861 | **2026-07-14** | JavaScript |
| `jellyfin/jellyfin-tizen` | **wrapper** | 1,711 | 2026-09-09 | JavaScript |
| `jellyfin/jellyfin-androidtv` | native Kotlin | 4,527 | 2026-09-09 | Kotlin |

The two clients users actually adopt are the native Swift one and the Expo one that is a third
native code. The official thin wrapper for iOS has 592 stars against Swiftfin's 4,150 — and Swiftfin
is now an official Jellyfin client with its own section, roadmap and milestones in State of the Fin
(https://jellyfin.org/posts/state-of-the-fin-2026-01-06/, fetched 2026-09-09).

**Correction to the spec, in the spec's own favour.** L1099 says *"Streamyfin, the flagship Expo
Jellyfin client, still wrote ~144KB of Swift around MPVKit."* As of 2026-09-09 the figure is
**537,748 bytes of Swift plus 634,101 bytes of Kotlin** — 1.17 MB of native code, roughly 24% of the
repository by bytes. The escape hatch did not stay small.

**And Jellyfin is currently rewriting a wrapper *out* of the product for the exact reason the spec
gives.** State of the Fin, 2026-05-24 (https://jellyfin.org/posts/state-of-the-fin-2026-05-24/,
fetched 2026-09-09), on Jellyfin Desktop:

> "Jellyfin Desktop is being **completely rewritten** to address several performance, feature, and
> maintainability issues. **Qt and its Chromium-based QtWebEngine have been replaced with Chromium
> Embedded Framework (CEF) to drastically improve responsiveness.** … we've switched from the legacy
> libmpv pipeline to the same modern pipeline that standalone mpv uses. This enables both better GPU
> acceleration (`vo=gpu-next`) and **native HDR playback** (Wayland/macOS/Windows). CEF and mpv are
> integrated via platform-native mechanisms."

A web wrapper, rewritten for responsiveness, with a native playback pipeline bolted underneath it to
reach HDR. That is the spec's "the player is native Swift under every option" argument, arrived at by
the incumbent from the other direction.

**The shipping costs the sweep priced are verified, and there is a new one.**

- *Google Play block*, State of the Fin 2026-05-24: "**The 2.6.4 build is not available on the Google
  Play store for technical reasons.**"
- *Tizen rejection*, State of the Fin 2026-01-06: "The Tizen app **was submitted for review, but
  unfortunately failed testing**. Additional work is needed to replicate the reported issues and
  correct them." By 2026-05-24 it had landed: "The Tizen Jellyfin client for Tizen 6 and newer has
  been released to the Samsung Tizen Store!" — roughly five months and one rejection for one store.
- *New, and the sweep did not have it.* State of the Fin 2026-05-24, under a heading called
  "Burnout / Remember the Person": "the increased support requests, combined with the AI code
  submissions, **have led to burnout at various levels of the development and admin team** … **This
  has already led to delays in client and server improvements.**" The cost of a wide client surface
  is not only store queues; it is the people.

### 3. Industry standard / best practice

**The two incumbents disagree, and the disagreement is about who is paying.**

Jellyfin uses wrappers where a volunteer has to carry a store relationship (webOS, Tizen, iOS
"Mobile") and native code where playback quality decides adoption (Android TV in Kotlin, Swiftfin in
Swift, Roku in BrighterScript, Desktop being rewritten onto CEF + mpv). Plex ships to eight-plus
platform families with paid staff. There is no standard; there is a resourcing constraint, and the
wrapper is what a volunteer project does when it runs out of people.

The relevant *user-facing* fact is that on Jellyfin, the thin wrapper and the native client exist
side by side on the same platform, and users pick the native one by a factor of seven.

### 4. SURVIVES or MOVES

**SURVIVES.** The decision is not reopened, and the evidence found here is not neutral — it points
the same way the decision already does.

- The wrapper's advertised benefit is real and verified: server-side fixes reach the TV app for free,
  and store submissions become rare. Nothing found contradicts that.
- But the benefit is bounded exactly where the spec says it is. Jellyfin's wrapper-shaped desktop
  client is being rewritten for responsiveness with a native playback pipeline; its Expo phone client
  is a quarter native code; and its 100%-Swift client is the one users install. Direct-play-only makes
  codec coverage load-bearing, and codec coverage is precisely the thing a WebView cannot be argued
  into.
- CanonCore's web client *is* the thin path. Next.js first, phone and TV later, "nothing in the first
  version is gated on them" — the product already gets the wrapper's cheapness for the period in which
  cheapness matters most.

**What should change is one number and one clause, not the decision.**

1. **L1099 is stale and understates its own case.** Replace "~144KB of Swift" with the current figures
   — Streamyfin carries 537,748 bytes of Swift *and* 634,101 bytes of Kotlin (`gh api
   repos/fredrikburmester/streamyfin/languages`, 2026-09-09). Quoting a four-year-old number that has
   grown eightfold invites the reader to check it and find the spec behind.
2. **Add the shipping cost to the reason, as the finding recommends.** The sweep's framing is correct:
   the spec prices the engineering of the client split exactly and the *shipping* of it at zero. The
   citable facts are one volunteer publishing to seven named stores, a build blocked on Google Play
   "for technical reasons", a Tizen submission that failed review and took five months, and a project
   that names burnout as a cause of client delays. Three first-party clients is three store
   relationships CanonCore will own forever, and that belongs next to the decision rather than
   discovered after the phone app ships.

---

## R8 · "The confirmation is never dismissible by accident"

**Finding strength as filed:** WEAK-MODERATE. **Verdict: MOVES**, on a narrow point: the
*dismissibility* rule survives intact for the irreversible outcome, and should stop governing the
routine one. Both incumbents and the only documented best practice in this area agree.

*The rule under test,* SPEC.md L961–967 (as of 2026-09-09 18:40):
> "Three outcomes, previewed with counts before acting: Cancel, Remove from this container (offered
> ONLY when multi-placed), Delete permanently. Show what would happen first: containers left, children
> orphaned, survivors. … The confirmation is never dismissible by accident: never a drawer, never a
> swipe-away sheet."

### 1. What Plex actually does

**Plex ships both patterns, keyed to stakes, and documents them in the same sentence.**

Deleting *media* — the irreversible act — is a modal confirmation, on every client. Apple TV
(https://support.plex.tv/articles/213807738-how-do-i-delete-content-using-the-apple-tv-app/, last
modified 27 February 2019, fetched 2026-09-09):

> "Click and hold the trackpad on the remote to bring up the context menu / Select **Delete** from the
> context menu / Select **Yes to confirm** the delete action"

with the warning that "Deleting an item this way will immediately remove it from your Library and will
**also delete the corresponding media file**."

Deleting a *subtitle file* — small, cheap, frequent — is a swipe, and the safety net is
platform-specific (https://support.plex.tv/articles/import-or-delete-a-subtitle-file/, last modified
28 February 2019, fetched 2026-09-09):

> "From the subtitle selection **swipe left** on a supported subtitle. **On iOS you must click the
> Delete button to confirm** the subtitle removal. **On Android after swiping it you will have a few
> seconds to UNDO the action.**"

The finding's characterisation is verified exactly. **One caveat it did not report:** the same article
also says "**Warning: Subtitles files are deleted from computer immediately.**" Read together, Plex's
undo window is either a deferred commit or a UI affordance over an act already performed, and the
article does not say which. Do not cite Plex's undo as proof that undo implies recoverability.

**Plex also has a third tier the finding did not mention, and it is the one closest to CanonCore's
tombstones** (https://support.plex.tv/articles/202606363-how-do-i-delete-something-from-my-library/,
last modified 12 January 2026, fetched 2026-09-09):

> "Depending on your server settings, the content may not be immediately removed from your library.
> Instead, it would be placed in the '**Trash**'. **When in the Trash, you can restore things simply
> by putting the content back in its original location.**"

So Plex's actual answer is three tiers: recoverable-by-default (Trash), confirm-then-lose (media
delete), and swipe-with-undo (subtitles).

### 2. What Jellyfin actually does

**Jellyfin makes exactly the split the finding proposes, and goes further than the finding asks: its
routine removal has no confirmation at all.**

Delete, from `src/scripts/deleteHelper.js` (fetched 2026-09-09), is a blocking confirm with
type-specific, count-bearing text:

```js
function getDeletionConfirmContent(item) {
    if (item.Type === BaseItemKind.Series) {
        const totalEpisodes = item.RecursiveItemCount;
        return {
            title: globalize.translate('HeaderDeleteSeries'),
            text: globalize.translate('ConfirmDeleteSeries', totalEpisodes),
            confirmText: globalize.translate('DeleteEntireSeries', totalEpisodes),
            primary: 'delete'
        };
    }
    …
}

export function deleteItem(options) {
    …
    return confirm(getDeletionConfirmContent(item)).then(function () {
        return apiClient.deleteItem(item.Id).then(…);
    });
}
```

`confirm` (`src/components/confirm/confirm.ts`) builds a two-button dialog whose confirm button is
typed `'delete'` and whose label is the *action*, not "OK":

```ts
items.push({ name: options.cancelText || globalize.translate('ButtonCancel'), id: 'cancel', type: 'cancel' });
items.push({ name: options.confirmText || globalize.translate('ButtonOk'),
             id: 'ok', type: options.primary === 'delete' ? 'delete' : 'submit' });
```

Removing an item from a collection, from `src/components/itemContextMenu.js:641–651` (fetched
2026-09-09), has **no dialog, no undo, nothing**:

```js
case 'removefromcollection':
    apiClient.ajax({
        type: 'DELETE',
        url: apiClient.getUrl('Collections/' + options.collectionId + '/Items', {
            Ids: [item.Id].join(',')
        })
    }).then(function () {
        getResolveFunction(resolve, id, true)();
    });
    break;
```

Same context menu, same file, two entries apart: `delete` goes through `deleteItem` and its
confirmation; `removefromcollection` fires immediately. Jellyfin has already concluded that removing
a placement is not an act worth interrupting anyone for.

### 3. Industry standard / best practice

**Here there is a real, current standard, and it says the opposite of "one rule for both".** Nielsen
Norman Group, "Confirmation Dialogs Can Prevent User Errors — If Not Overused", Jakob Nielsen,
18 February 2018, **last reviewed 7 August 2026**
(https://www.nngroup.com/articles/confirmation-dialog/, fetched 2026-09-09). The guidelines, verbatim:

> "**Use a confirmation dialog before committing to actions with serious consequences** — such as
> destroying users' work or costing large amounts of money. In particular, consider a confirmation
> dialog **before actions that cannot be undone**."
>
> "**Do not use confirmation dialogs for routine actions.** Like in Aesop's fable, if you cry wolf too
> many times, people will stop paying attention to the question, and **the confirmation dialog will
> lose its power to prevent errors**."
>
> "Instead of Yes/No answers, **provide response options that summarize what will happen for each
> possible response**. For example, in the case of file deletion, use buttons labeled *Delete file*
> and *Keep file*."
>
> "**For particularly dangerous operations, require a nonstandard action from the user to confirm.**
> Rather than simply clicking an OK button … have people do something they would normally not do."
>
> "Finally, for improved total user experience … **do go to great lengths to provide undo**, because
> some user errors will remain despite even the best of confirmation dialogs."

Two of these the spec already satisfies and should be credited for: named outcomes rather than
Yes/No, and specificity ("previewed with counts … containers left, children orphaned, survivors").
The one it does not satisfy is guideline #2.

### 4. SURVIVES or MOVES

**MOVES, narrowly.** Precisely one clause changes; the rule's core is untouched and corroborated.

**What survives.** "Never dismissible by accident: never a drawer, never a swipe-away sheet" is
correct and well supported for **Delete permanently**. Both incumbents use a blocking modal for
irreversible media deletion, and NN/g's guideline #1 and its "nonstandard action" guideline both point
harder in that direction, not softer.

**What moves, and why it is a users' problem rather than a taste problem.** The spec's Delete flow has
three outcomes and one of them, "Remove from this container", is not a deletion at all — the spec says
so itself two lines above: "Deleting a container NEVER deletes its members; they lose one placement."
Multi-placement is the product's central feature at 93.4% multi-placement, so removing a placement is
the single most routine mutation the catalogue has. Guarding it with the same non-dismissible modal
as permanent loss is guideline #2's failure mode by construction: the modal that appears constantly is
the modal nobody reads, and the one time it guards permanent loss is the time it gets clicked
through. **Over-using the confirmation makes Delete permanently *less* safe, not more.**

Jellyfin has reached the same conclusion in code and gives placement removal no dialog at all.

**Recommended edit, one clause.** Keep the sentence and scope it: *the confirmation for **Delete
permanently** is never dismissible by accident — never a drawer, never a swipe-away sheet.* Then say
what governs the reversible outcome. Two options, both defensible:

- **Undo window** (Plex Android's pattern, NN/g's closing recommendation). Requires that a removed
  placement is restorable, which the spec does not currently say. `tombstones` exist on every table
  (L523) and there is a "tombstone compaction" scheduled task (L911), so the row survives; but nothing
  states that a tombstoned placement can be brought back, and without that an undo button is a lie.
  **This is the dependency the finding flagged as G68 and it is still open** — verified 2026-09-09 by
  grepping SPEC.md for `tombstone`, `undo` and `restorable`.
- **No confirmation at all** (Jellyfin's shipped answer). Cheaper, needs no restore path, and is
  defensible because the act is genuinely reversible by re-adding the placement.

The choice between them is a product call. What is not defensible is the current wording, which
applies the permanent-loss ceremony to the product's most frequent action and, in doing so, erodes the
protection on the action that actually needs it.

---

## R9 · "No time window, no dismissal" on Continue Watching, and the abandoned film

**Finding strength as filed:** WEAK. **Verdict: SURVIVES** — both refusals hold, and one is now
directly corroborated by Jellyfin shipping the identical design. **But the hole the finding names is
real and currently unanswered**, and the answer the finding proposes is not quite the right one.

*The rule under test,* SPEC.md L862–863 (as of 2026-09-09 18:45):
> "Continue Watching is computed, never stored. No time window, no dismissal. It is offered, never
> auto-played."

### 1. What Plex actually does

**Plex has all four: a window, a cap, a carve-out, and a dismissal.** All from
https://support.plex.tv/articles/200289526-library/ (fetched 2026-09-09), under Advanced Settings —
note that the feature is now called "Continue Watching" in Plex's own docs, not "On Deck":

> "**Weeks to consider for Continue Watching** — Lets you choose how many weeks to check for content
> to be included in the Continue Watching data for a library. **The default value of 16 weeks** is
> good for the vast majority of users. You can lower the value if your Continue Watching is
> particularly slow to appear. (Increasing the value can cause Continue Watching or app dashboards to
> be much slower to appear.)"
>
> "**Maximum number of Continue Watching items which will appear** — Choose the maximum number of
> shows that can appear in Continue Watching. Setting a very high number can negatively affect
> performance."
>
> "**Include season premieres in Continue Watching** — Season premieres generally will fall outside of
> the number of weeks for Continue Watching for most people, since it can be several months before a
> new season starts. **Enabled by default**, this setting makes episode one of a new season appear
> even if it falls outside of Weeks to consider for Continue Watching setting."

**Correction to the finding, and it matters.** The finding reads the 16-week window as evidence that
"the incumbent found a window necessary" for curation. Plex's own text says otherwise: **both
knobs are framed as performance controls**, and both sentences that explain them are about speed
("particularly slow to appear", "can negatively affect performance"). The season-premiere carve-out
then exists because a performance control was silently breaking a correctness case. That is a
different argument from the one the finding makes, and it is weaker.

**The dismissal is real and is a first-class server action.** Verified in python-plexapi
(https://raw.githubusercontent.com/pkkid/python-plexapi/master/plexapi/video.py, fetched 2026-09-09),
defined on `Movie` at line 515 and on `Episode` at line 1230:

```python
def removeFromContinueWatching(self):
    """ Remove the movie from continue watching. """
    key = '/actions/removeFromContinueWatching'
```

**And the cost of that dismissal is documented by Plex's own users, which is the part the finding did
not price.** From the Plex forums (fetched 2026-09-09 via the Discourse `.json` endpoint):

> "Either allow option to DISABLE or CONFIRM when 'Remove from Continue Watching' is selected.
> **Several times I've accidentally hit 'Remove from Continue Watching' and is a pain to restore**,
> and is causing problems."
> — `DragonCue`, thread 716534, 2021-05-18, and again 2022-02-09: "An accidental selection is a PAIN
> to resolve and want ability to DISABLE it as an option on my server, or at least require a
> CONFIRMATION!!"

> "I have some TV shows I wanted to lay-off for a while so I used the 'Remove From Continue Watching'
> option, but **now I can't find the option to bring them back anywhere**, even tried resetting the
> customizations."
> — `E_N_Y`, thread 768314, 2022-01-03

A dismissal flag that is easy to hit and hard to undo is a worse user outcome than the abandoned film
it was meant to fix. (This is the same stakes-vs-frequency problem as R8, arriving from the other
side.)

### 2. What Jellyfin actually does

**Jellyfin ships CanonCore's rule exactly: no window, no dismissal.** `Jellyfin.Api/Controllers/
ItemsController.cs`, `GetResumeItems` (fetched 2026-09-09) — the entire query:

```csharp
var itemsResult = _libraryManager.GetItemsResult(new InternalItemsQuery(user)
{
    OrderBy = [(ItemSortBy.DatePlayed, SortOrder.Descending)],
    IsResumable = true,
    StartIndex = startIndex,
    Limit = limit,
    …
    ExcludeItemIds = excludeItemIds
});
```

No date predicate anywhere. No dismissal field. The only bounds are the client's `limit` and, at write
time, the `MinResumePct = 5` / `MaxResumePct = 90` gates verified under R3 above. Searching the
repository for `hideFromResume`, `RemoveFromResume` and `ContinueWatching` returns **no server-side
dismissal of any kind** (only localisation strings for the client's label).

Jellyfin therefore has the identical hole, and has had it for the life of the project.

The one thing Jellyfin does that the spec does not mention: `excludeActiveSessions`, with a comment
worth knowing about because it is a bug CanonCore's multi-edition model can also hit —

```csharp
// NowPlayingItem.Id is the displayed/primary id, but resume queries surface the actually-played
// alternate version's own id. Expand each active session to every version id so an in-progress
// alternate is excluded too, instead of leaking back into the resume list.
```

### 3. Industry standard / best practice

**No standard, and the two incumbents flatly disagree.** Plex: window + cap + carve-out + dismissal.
Jellyfin: sort by date, filter by resumable, cap by client limit, nothing else.

**The best-designed dismissal in the survey belongs to neither of them.** Audiobookshelf carries
`hideFromContinueListening` as a boolean on the progress row (`server/models/MediaProgress.js`,
fetched 2026-09-09), and — unlike Plex — clears it automatically:

```js
// Reset hideFromContinueListening if the progress has changed
if (this.changed('currentTime') && !progressPayload.hideFromContinueListening) {
    this.hideFromContinueListening = false
}
```

Dismiss it and it stays dismissed; play it again and it comes back. That is the version of the feature
that does not strand the user the way Plex's does. It is still a **stored** flag on the progress row,
which is what the spec refuses.

### 4. SURVIVES or MOVES

**SURVIVES.** Both halves of the refusal hold, on user grounds rather than tidiness.

- **No time window.** Plex's window is a performance control for a multi-user server with a
   hundred-thousand-item library, and Plex says so in the same sentence twice. CanonCore is
  single-user over one person's catalogue; the cost the window buys does not exist here, and the cost
  it imposes — a film you left in March vanishing in July with no notice — does. Jellyfin, the closer
  comparator in scale and audience, has never had one.
- **No dismissal.** Plex has one and its own users describe it as easy to hit by accident and
  effectively irreversible. Adding a hidden per-item flag to a product whose entire premise is that
  every fact is a sourced, provenanced statement would be the one piece of invisible state in the
  system.

**But the hole is real, and the spec currently has no answer to it.** Force-complete-under-five-minutes
handles trailers. Nothing handles a three-hour film abandoned at forty minutes: it is well below any
time-remaining threshold, so it is not complete; there is no window to age it out; and there is no
dismissal. It sits in Continue Watching for the life of the instance. Verified 2026-09-09 by reading
the whole PLAYBACK section: no rule addresses it.

**The finding's proposed answer is close but not right.** It suggests "let the owner write a watch
event by hand … which is a curation act rather than a dismissal flag". Writing a *watched* event
solves the display problem by lying: the append-only log is the truth for "Have I watched this WORK",
and a fabricated completion propagates into the coverage-interval union and into container progress.
The spec is explicit elsewhere that "Unknown is never a fabricated true"; a fabricated *true* is worse.

**Recommended.** Name a second watch-event outcome — *stopped*, *abandoned*, *set aside*, whatever it
is called — that the owner can write by hand and that removes the edition from Continue Watching
without asserting completion. It costs nothing structurally: watch events already exist, are already
append-only, and already carry provenance; this is one more value in a column, not a new flag and not
new state. It keeps Continue Watching computed rather than stored (the rule is derived from the log,
as it already is), it keeps the refusal of a hidden dismissal, and it is honest about what happened —
which is exactly the property the spec's event log exists to preserve. Audiobookshelf's
auto-clear-on-next-play behaviour comes free: a later play event supersedes the abandonment in the log
without anything having to reset a flag.

That the owner may write watch events by hand at all is not currently stated anywhere in SPEC.md
(verified 2026-09-09); it needs saying either way.

---

## R10 · "No transcoding, no ffmpeg" bans REMUX by side effect

**Finding strength as filed:** MODERATE. **Verdict: SURVIVES** — and the finding's framing needs one
correction: remux is not banned "by side effect". Jellyfin's own taxonomy puts it on the transcoding
side of the line, so "no transcoding" already covers it. What the spec still owes the reader is the
cost, and the cost is larger than the finding priced it.

*The refusal under test,* SPEC.md L801 (as of 2026-09-09 18:50):
> "Direct play only. No transcoding, no quality ladders, no ffmpeg."

and L944, "- No transcoding."

### 1. What Plex actually does

**Plex ships remux under the name "Direct Stream", describes it exactly, and says it costs almost
nothing.** From https://support.plex.tv/articles/200250387-streaming-media-direct-play-and-direct-stream/
(last modified 27 March 2019, fetched 2026-09-09):

> "**Direct Stream** — You may have some media that is compatible with your device regarding
> resolution and media type (H.264, AC3, etc.), but is **in an incompatible file container (.mkv,
> .avi, .wmv, etc.)**. In this case, the file can be Direct Streamed to your device. This means:
> The video and audio tracks are extracted from the original file; The streams are **saved back into a
> compatible file container**; and the Plex Media Server **repackages the content on-the-fly** before
> streaming it.
>
> **Direct Streaming a file uses very little processing power without any loss in video quality.**"

Plex also documents a fourth mode the finding did not name — "**Partially-Transcoded Direct
Stream**": "The Audio track will be transcoded from the standard DTS core audio track to AC3; The
original Video track will not be touched." So Plex opens the article saying "There are 3 types of
possible outcomes" and then documents four.

**The subtitle case, twice in the same article, verbatim:**

> "Even if a file's audio, video, and container are all compatible with a Plex App, **if a subtitle
> stream is selected and is not compatible with the Plex App, then the Server will 'burn in' the
> subtitle text within the video. This requires a full transcode of the video stream.**"

Under a no-transcoder ban this does not become a hard failure — it becomes *no subtitles for that
stream*. Worth stating precisely, because the finding implies a wider failure than this one produces.

### 2. What Jellyfin actually does

**The four-way taxonomy is verified verbatim, and the framing sentence corrects the finding.**
https://jellyfin.org/docs/general/post-install/transcoding/ (fetched 2026-09-09):

> "**Types of Transcoding** — There are four types of playback; **three of which involve
> transcoding**. The type being used will be listed in the dashboard when playing a file. They are
> ordered below from lowest to highest load on the server:
> - **Direct Play**: Delivers the file without transcoding. There is no modification to the file and
>   almost no additional load on the server.
> - **Remux**: Changes the container but leaves both audio and video streams untouched.
> - **Direct Stream**: Transcodes audio but leaves original video untouched.
> - **Transcode**: Transcodes the video stream."

"Three of which involve transcoding" includes Remux. Jellyfin classifies remux as transcoding. So the
spec's "No transcoding" reaches it directly, by the incumbent's own definition of the word — not, as
the finding puts it, "by side effect" of the separate ffmpeg ban.

**And in Jellyfin, remux is ffmpeg.** `MediaBrowser.Controller/MediaEncoding/EncodingHelper.cs`
(fetched 2026-09-09) builds the same ffmpeg command line for remux as for transcode, differing only in
the codec argument:

```csharp
state.OutputVideoCodec = "copy";      // line 7221, 7230
state.OutputAudioCodec = "copy";      // line 7244, 7253

public static bool IsCopyCodec(string codec)     // line 7972
{
    return string.Equals(codec, "copy", StringComparison.OrdinalIgnoreCase);
}
```

and the encoder binary is the one verified in the earlier X1 pass:
`MediaBrowser.MediaEncoding/Encoder/MediaEncoder.cs:221` derives `ffprobe` from `_ffmpegPath`. There
is no lightweight remux path in Jellyfin; there is ffmpeg with `-c copy`.

### 3. Industry standard / best practice

**Every implementation in this category does remux with ffmpeg, and the tool CanonCore has chosen
cannot do it at all.**

MediaInfo, the spec's chosen analysis binary, is read-only by its own description:

> "MediaInfo is a convenient unified display of the most relevant technical and tag data for video and
> audio files."
> — https://mediaarea.net/en/MediaInfo (fetched 2026-09-09). The page lists reading and display
> capabilities and no conversion, editing or repackaging function of any kind.

So the finding's "honest reading" is confirmed twice over: remux needs a muxer, the only muxer in this
category's practice is ffmpeg, and MediaInfoLib is not one. The spec's stated reason for choosing
MediaInfo — "it contains no encoder, so 'direct play only' becomes **structurally true rather than
policy-enforced**" — is the same decision reached from the other end.

**The cost is larger than the finding priced, and the primary source is MDN.** MDN's container guide
enumerates the containers with browser support: 3GP, ADTS, FLAC, MPEG-1/2, MP4, Ogg, QuickTime, WAV
and WebM (https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers, fetched
2026-09-09). **Matroska is not on the list**; it appears only as the format WebM is derived from.
CanonCore's first and, for the first version, only client is a browser. So under this refusal, MKV —
the dominant container for archived and ripped video, and the first container Plex names in its own
"incompatible file container (.mkv, .avi, .wmv)" list — does not play in the CanonCore web client, and
there is no fallback.

### 4. SURVIVES or MOVES

**SURVIVES.** The refusal is internally consistent, the alternative is not cheap, and the accepted
cost is a product-scope decision rather than an oversight.

- **Remux is not free, and "just a container rewrite" understates it.** Both incumbents implement it
  as ffmpeg with `-c copy` through the identical pipeline as full transcoding: same binary in the
  install, same process supervision, same temp-directory management, same failure surface. Admitting
  remux means shipping the transcoder and then promising not to use most of it. That is the exact
  situation the spec's MediaInfo choice was made to avoid, and "structurally true rather than
  policy-enforced" is a property worth more than the containers it costs.
- **The product is a catalogue first.** The spec's own standing rule — "Cataloguing and displaying are
  separable: a renderer is needed only when a file is attached and someone presses play. A novel with
  no reader is a complete entry" — is the answer to "but MKV won't play." An MKV that will not play is
  still a fully catalogued edition with its placements, statements and provenance intact. Nothing
  about the product's actual purpose degrades.
- **"Say so plainly" is a real answer and the spec has since strengthened it.** L803–807 now requires
  naming the property that failed, checked against a declared device capability. A user told "this
  file is Matroska and your browser cannot open Matroska" is better served than one silently handed a
  re-encoded stream — which is Plex's outcome, and Plex's transcoder is the single largest source of
  complaint in its own support surface.

**What must change is the writing, and the finding is right about it.** Two edits:

1. **Name remux in the refusal.** As written, a reader can accept "no transcoding" and separately
   believe remux is available, because Plex calls it "Direct Stream" and describes it as costing "very
   little processing power without any loss in video quality". One clause — *remux and container
   rewriting are refused with the rest; Jellyfin counts remux as one of its three transcoding modes* —
   closes the door properly and cites the incumbent doing the classifying.
2. **State the cost that is being accepted, as the artwork cost is stated.** The spec already accepts
   "a private instance with no provider connected has no artwork" in those words. The equivalent
   sentence here is that MKV, AVI and WMV will not play in the browser client (MDN's supported-container
   list), that an incompatible subtitle stream means that subtitle is unavailable rather than burned in
   (Plex's documented behaviour), and that a mismatch is a named failure rather than a fallback. The
   refusal survives; what does not survive is leaving that unwritten, because the reader who discovers
   it at the first MKV will reopen the decision from the worst possible position.

**If the ban is ever revisited, this is the first thing it should reopen** — and the trigger to watch
for is browser MKV support, not the ffmpeg dependency, since the dependency is what the refusal is
actually protecting against.

---

## R11 · The `.nfo` refusal read wider than it is, and embedded media tags

**Finding strength as filed:** MODERATE. **Verdict: MOVES.** The scanner should read embedded tags,
and the case for it is now stronger than the case that reversed `.nfo` (R1) — because the spec has
since committed to a scan-time MediaInfo pass, and **MediaInfo already parses these tags in the same
call that produces duration and container**.

*The refusal under test,* SPEC.md L960 (as of 2026-09-09 18:55):
> "It takes media files, playback sidecars, and `.nfo` files. Nothing else."

and, in the artwork table:
> "The scanner reads `.nfo` (see THE SCANNER) but takes **NO ARTWORK** from one, **embedded** or by
> following a local image path it names; that refusal is untouched. A private instance with no
> provider connected has no artwork."

Note precisely what is and is not said. Embedded **artwork** is refused by name. Embedded **tags** are
not mentioned anywhere in SPEC.md — verified 2026-09-09 by grepping for `embedded`, `ID3`, `EXIF`,
`Vorbis`, `Matroska` and `atom`. The only hit is the artwork clause.

### 1. What Plex actually does

**Plex treats embedded music tags as a first-class metadata source with an explicit toggle, and warns
hard about it.** https://support.plex.tv/articles/200381093-identifying-music-media-using-embedded-metadata/
(last modified 22 April 2020, fetched 2026-09-09), the finding's quote verified verbatim and with its
neighbours, which matter:

> "Plex allows you to tell your music library to use the metadata that's embedded in your music files.
> However, if you enable that option, that basically means that you're **prioritizing local embedded
> tags over online information** as well as committing to having accurate tags for your entire music
> library."
>
> "Broadly speaking, it means that Plex will expect that you have embedded metadata tags for
> **Track, Album, and Artist (and potentially Album Artist) for each track**. These will be used
> instead of what we would normally provide with regular matching for the content."
>
> "Importantly, if this option is enabled, then it basically means that **you're promising that not
> only is your entire music library tagged with embedded metadata, but also that it's tagged
> correctly**."
>
> "**Tip!** Most users should not enable this option and we do not recommend doing so by default. Only
> enable the preference if you really know that you need it."

Read the mechanism, not just the warning. Plex's toggle is called "Prefer local metadata" and it is a
**per-library, all-or-nothing priority switch**: on, and embedded tags beat every online source for
every field of every track; off, and they are ignored. The whole of Plex's warning is about the
consequences of that switch — it is not a warning that embedded tags are bad data.

Plex also reads embedded tags without the switch, through its legacy Personal Media agents: "*If Local
Media Assets is enabled for the agent, any embedded metadata in the files will be used*" and "*Metadata
embedded in most music file formats will be read and used if Local Media Assets is enabled*"
(https://support.plex.tv/articles/200241558-agents/, fetched 2026-09-09).

### 2. What Jellyfin actually does

**Jellyfin reads embedded tags by default, for audio and for photos, using two dedicated tag
libraries.** From `Directory.Packages.props` (fetched 2026-09-09):

```xml
<PackageVersion Include="TagLibSharp" Version="2.3.0" />
<PackageVersion Include="z440.atl.core" Version="7.16.0" />
```

*Audio* — `MediaBrowser.Providers/MediaInfo/AudioFileProber.cs` (704 lines, `using ATL;` at line 7,
fetched 2026-09-09) maps embedded tags straight onto the item:

```csharp
var trackAlbum       = (string.IsNullOrEmpty(track.Album) ? mediaInfo.Album : track.Album)?.Trim();
var trackTrackNumber = track.TrackNumber is null or 0 ? mediaInfo.IndexNumber : track.TrackNumber;
var trackDiscNumber  = track.DiscNumber  is null or 0 ? mediaInfo.ParentIndexNumber : track.DiscNumber;
…
audio.Album            = trackAlbum;
audio.IndexNumber      = trackTrackNumber;
audio.ParentIndexNumber= trackDiscNumber;
audio.AlbumArtists     = albumArtists;
```

It goes considerably further than titles: ReplayGain (`REPLAYGAIN_ALBUM_GAIN`), MusicBrainz release and
release-artist ids read out of the tags (`MusicBrainz Album Id`, `MusicBrainz Album Artist Id`), and an
audiobook special case — "*For audiobooks: AlbumArtists/Performers = Author, NARRATOR tag = Narrator*".

*Photos* — `Emby.Photos/PhotoProvider.cs` (`using TagLib.IFD;`, fetched 2026-09-09) reads EXIF
directly: `ExifEntryTag.ApertureValue`, `ExifEntryTag.ShutterSpeedValue`, `image.ImageTag.DateTime`,
`image.ImageTag.Orientation`, `image.ImageTag.Latitude`, `Longitude`.

There is no toggle. This is Jellyfin's default scanner behaviour.

### 3. Industry standard / best practice

**Reading embedded tags is universal in this category, and the decisive fact is that CanonCore's own
chosen binary already does it.**

The spec commits to a scan-time MediaInfo pass writing duration, container, codecs, resolution and
bitrate onto the file row. **MediaInfoLib's own General-stream field table already contains the music
tag fields** — `Source/Resource/Text/Stream/General.csv` in the MediaArea/MediaInfoLib repository
(359 fields, fetched 2026-09-09), verbatim rows:

```
Album;;;Y YTY;;;Name of the album (e.g. The Joshua Tree);;Title
Album/Performer;;;Y YTY;;;Album performer/artist of this file;;Entity
Album/Sort;;;Y YTY;;;Alternate name of the album, optimized for sorting purposes …
Track/Position;;;Y YIY;;;Number of this Track;;Title
```

alongside `Title`, `Track`, `Part/Position`, `Recorded_Date` and the rest. MediaInfo's own product page
describes itself as "a convenient unified display of the most relevant **technical and tag data** for
video and audio files" (https://mediaarea.net/en/MediaInfo, fetched 2026-09-09).

So the scanner will already open every media file, hand it to MediaInfo, and receive the album,
performer and track number **in the same response as the duration**. Refusing embedded tags is not
refusing to do work; it is discarding data already in hand.

Elsewhere in the ecosystem, verified in the earlier X1 pass: Navidrome's default extractor is a pure-Go
TagLib reading tags with no native dependency, and Audiobookshelf, Beets and Picard are built on tag
reading. **I found no project in this category that refuses embedded tags.**

### 4. SURVIVES or MOVES

**MOVES.** The scanner should read embedded tags. Four reasons, in order of weight, judged on users:

1. **The consequence of refusing is much larger than the one the spec states and accepts.** The spec
   accepts, explicitly and in writing, that "a private instance with no provider connected has no
   artwork." It has never accepted that such an instance has **no track titles, no album, no artist and
   no track numbers** — which is what refusing embedded tags means, because a music file's filename is
   frequently `01 - track.mp3` and there is nothing else in it. `audio` is a first-class medium, the
   demo ships music, and the product's own premise is that a catalogue entry is complete without a
   provider. A music library that shows nothing but filenames is not a complete catalogue entry.

2. **The R1 precedent applies, and applies harder.** `.nfo` was reversed because Plex, the last
   holdout, shipped it after eighteen years, and because "a catalogue that will not read the file
   sitting next to the media is asking every user to retype what they have." Embedded tags are the
   *easier* case on every axis the reversal turned on: they are inside the file the scanner already
   opens rather than a separate file it must be taught to find; they are usually the owner's own
   tagging work rather than "some other scraper's output from years ago"; and both incumbents have read
   them since before Jellyfin existed. Reversing on `.nfo` and holding on embedded tags is not a
   coherent pair of positions.

3. **The cost is zero and there is no new dependency.** MediaInfo is already a committed dependency
   and already parses these fields. No new file is opened, no new parser is added, no new attack
   surface: the same bytes, the same library, the same call. Compare the actual cost of `.nfo`, which
   needed a new file discovery rule, an XML parser and a third source kind.

4. **Plex's warning does not transfer, and this is the important part.** Plex's danger is its
   *mechanism*: one library-wide switch that makes embedded tags beat everything for every field, so a
   single badly tagged album poisons the library and the only remedy is turning the switch off for
   everything. CanonCore has no such switch. A source sits in the one global source order and is
   beatable per field by a provider or by the owner, values are multi-valued and live, and the
   favourite is the lock. **The failure Plex warns about is structurally impossible in CanonCore's
   model** — and the spec should say so where it makes this decision, because the Plex article is the
   first thing an implementer will find.

**What stays refused, unchanged.** Embedded **artwork**. That refusal is stated, has a reason
(artwork carries a provider's licence and attribution string, and an embedded APIC frame carries
neither), and nothing found here touches it. Keep the sentence exactly as it is.

**Two things the edit has to settle, or it will be settled badly later.**

- **Which source kind.** The spec has three: provider, Owner, sidecar. An embedded tag is not the
  Owner — the reasoning at `statements` for why an `.nfo` is not the Owner ("usually some other
  scraper's output … filing it as the Owner would silently hand stale third-party data the top rank
  in the source order and make it unbeatable by a live provider") applies to a tag written by iTunes
  in 2009 just as well. It is also not a sidecar *file*. Either widen `sidecar` to mean "read from the
  media on disk, not from a contract" and say so, or add a fourth kind. Widening is simpler and the
  provenance reads correctly either way.
- **Which tags, named.** ID3v2 and ID3v1 (MP3), Vorbis comments (FLAC, Ogg), MP4/iTunes atoms
  (M4A, M4B), Matroska tags (MKV), and EXIF for `image`. Naming them stops the same argument
  recurring one container at a time, and MediaInfo covers all of them from the one pass.

**Finally, the finding's own warning is the one to heed.** It flags that "the most likely failure is
that a reader drops it as already-refused." With `.nfo` reading now *in* the spec, that risk is higher
than when the sweep filed it: a reader who sees the scanner reading sidecars will assume tags come with
them, and nothing in the document says they do not. Whichever way this is decided, it has to be
decided **in writing**.

---

## R12 · A standard read protocol as a client path

**Finding strength as filed:** MODERATE. **Verdict: SURVIVES** — a standard read protocol should be
**refused**, not merely deferred, and there is a decisive reason for it that the sweep did not find.
But the finding is right that the spec must say so: as written an implementer cannot tell.

*The decision under test,* SPEC.md L1204–1212 (as of 2026-09-09 19:00; the file is now 1352 lines):
> "Across ten comparable self-hosted projects the highest-leverage client work by a wide margin was
> implementing an EXISTING CLIENT PROTOCOL rather than writing an app: Komga shipped OPDS at day 34 …
> Navidrome implemented Subsonic from its second commit … The apps are being built anyway,
> deliberately. Do not re-argue it, and do not quietly drop them either."

The finding's point is internal: "Do not re-argue it" is scoped to *whether to build the apps*, and
two sweeps read it as also foreclosing *shipping a read protocol alongside them* — a different
question the spec never asks.

### 1. What Plex actually does

**Plex still ships DLNA in core, and its answer to third-party clients is a documented proprietary
API, not a standard protocol.**

DLNA is live: https://support.plex.tv/articles/200350536-dlna/ (last modified 27 March 2021, present
in Plex's live article sitemap and fetched successfully 2026-09-09) documents a full settings page —
"Your Plex Media Server can function as a DLNA (Digital Living Network Alliance) server in addition to
its normal Plex functions. This allows regular DLNA clients to be able to access content from the
Server" — with `DLNA enabled`, client preferences, timeline reporting, `GetProtocolInfo` strings, SSDP
lease time and renderer discovery interval.

The bigger move is September 2025. From "Plex Pro Week '25: API Unlocked", by Kevin Wanke and Marcelo
(https://www.plex.tv/blog/plex-pro-week-25-api-unlocked/, fetched 2026-09-09):

> "it has possibly been the worst-kept secret that an API exists on every Plex Media Server. … Today,
> we are here to take your efforts to the next level. **For the first time, we are publishing official
> API documentation for your Plex Media Server!**"
>
> "instead of us saying no to each of these worthy ideas, maybe there is someone out there … who wants
> to tackle these opportunities."
>
> "Why can't a PMS store and stream out audiobooks? **Why can't we embrace a common schema for
> different media types** and give you more ways to curate and stream more of the media that is
> important to you?"

Plus JWT authentication, a dev-community forum section, and docs at `https://developer.plex.tv`. Plex
also committed to this in its April 2025 roadmap post: "**An open and documented API for server
integrations**, along with the ability to create custom metadata agents"
(https://www.plex.tv/blog/important-2025-plex-updates/, fetched 2026-09-09).

So the incumbent's chosen path to third-party clients, decided in 2025, is: **document your own API**.
Not adopt someone else's.

### 2. What Jellyfin actually does

**Jellyfin moved away from the standard-protocol path, and the sweep's characterisation is verified
verbatim.** https://jellyfin.org/docs/general/post-install/networking/dlna/ (fetched 2026-09-09):

> "**DLNA support has been moved to a first party plugin and is not included in a Jellyfin base
> install since 10.9.** If you want to use DLNA, please install the plugin from the official Plugin
> catalog."
>
> "Requirements: **Docker Host-networking** (if Docker is used) / **1900 udp** … Since UPnP is a
> standard Protocol expected to be on UDP port 1900, **its not possible to configure this**."
>
> "DLNA discovery works by sending a broadcast to the current subnet … **Using DLNA remotely is not
> possible.**"

Jellyfin's own client path is the same as Plex's new one: a documented, OpenAPI-described first-party
HTTP API, which is what every Jellyfin client in the R7 table consumes.

**Jellyfin ships no OPDS and no Subsonic** — verified 2026-09-09 by searching the `jellyfin/jellyfin`
repository; the only standard read protocol it has ever shipped is the one it demoted.

### 3. Industry standard / best practice

**Both candidate protocols are alive, maintained, and — decisively — medium-specific.**

- **OPDS** is a live community standard (https://opds.io/, fetched 2026-09-09): "A standard for
  digital content distribution … discovering and downloading **digital content** … The official
  specifications are managed by the community on Github." It is a catalogue-and-acquisition feed for
  **publications**.
- **OpenSubsonic** is a live maintained fork of the Subsonic API (https://opensubsonic.netlify.app/,
  fetched 2026-09-09) with its own extension set. Its published endpoint list is
  `getPodcastEpisode`, `Song Lyrics`, `Top songs by artist ID`, `Sonic similarity`,
  `createInternetRadioStation`, `createBookmark`, `createPodcastChannel`… It is **music**, top to
  bottom.
- **DLNA/UPnP** is the video-shaped one, and it is the one both incumbents have now sidelined.

The spec's two citations are verified and both are single-medium products whose data model *is* the
protocol's model:

- **Komga** ships OPDS **v1 and v2**: `komga/src/main/kotlin/org/gotson/komga/interfaces/api/opds/`
  contains `OpdsCommonController.kt`, `v1/` and `v2/` (fetched 2026-09-09 via `gh api`). Komga is
  comics and books; OPDS is comics and books.
- **Navidrome** ships a full Subsonic server: `server/subsonic/` with `album_lists.go`, `bookmarks.go`,
  `api.go` and the rest (fetched 2026-09-09). Navidrome is music; Subsonic is music.

### 4. SURVIVES or MOVES

**SURVIVES, and should be written down as a refusal rather than a silence.** The finding asked for one
sentence saying which; the evidence says the sentence should say **refused**, and there are three
reasons, the first of which is new.

**1. Every candidate protocol types the catalogue by medium — so shipping one reintroduces the exact
thing R4 refuses, through the back door.** OPDS sees publications. Subsonic sees artists, albums and
songs. DLNA sees video containers. There is no untyped read protocol, because no untyped catalogue
existed for anyone to standardise. Serving OPDS means answering "what does the text half of this
catalogue look like as a book feed?"; serving Subsonic means answering the same for the audio half.
Two protocols, two medium-shaped views, and the Harry Potter group — text, video and audio in one
container — is expressible in neither. Komga and Navidrome can adopt a protocol wholesale precisely
because they are the single-medium products CanonCore is deliberately not.

**2. The spec already refuses this, in a different costume, and gives the reason.** Under BACKUP,
RESTORE AND THE DUMP: "REFUSED: exporting to `.nfo` or to a bibliographic standard. **No existing
format expresses multi-placement, so that export would silently drop the product.**" An OPDS feed is a
read-shaped export to a bibliographic standard. The same sentence answers it. A protocol is also a
compatibility promise — "an interchange format is a compatibility promise, which this document refuses
outright elsewhere" — and a third-party reader built against CanonCore's OPDS is a permanent
constraint on the model in return for a benefit the spec has already declared hypothetical ("there is
no ecosystem to implement it").

**3. Both incumbents have chosen the other path within the last eighteen months, in the same
direction.** Jellyfin demoted its only standard protocol out of core at 10.9. Plex published
first-party API documentation in September 2025 rather than adopting anything. When the two products
that disagree about nearly everything else in this survey both answer "document your own API", that is
the closest thing to a standard practice available.

**What is true in the finding, and worth keeping.** The leverage data is real — Komga had a
third-party reader one day after its first release, and Navidrome was being debugged against a
third-party Android client six days in. The mechanism that produced that leverage was **an existing
population of clients**, and it exists for OPDS and Subsonic only because those protocols match
single-medium products that already had readers. It does not transfer to a catalogue whose defining
feature no protocol can express. That is why the paragraph should keep the evidence and add the reason
it does not apply, rather than deleting either.

**Recommended edit, one sentence, at L1212.** After "Do not re-argue it, and do not quietly drop them
either", add: *a standard read protocol is refused as well, and for the same reason as the
bibliographic export — every candidate (OPDS, Subsonic, DLNA) is typed by medium and none expresses
multi-placement, so serving one would present a medium-shaped slice of the catalogue as if it were the
catalogue. The client path is CanonCore's own documented API, which is what both Plex (developer.plex.tv,
2025) and Jellyfin have converged on.* That closes the ambiguity the sweep found without weakening the
paragraph's own evidence.

---

## R13 · Scrobbling and any outbound push

**Finding strength as filed:** WEAK-MODERATE. **Verdict: MOVES** — not to build it, but the refusal
list must stop being read as covering it. Outbound push should be **explicitly deferred and named**,
because the sentence the sweep points at genuinely does not reach it and the whole self-hosted
automation ecosystem hangs off the thing it does not reach.

*The refusal under test,* SPEC.md L1089–1092 (as of 2026-09-09 19:05):
> "No fork, no cross-instance sharing, no merge semantics between instances, and no import — from
> another CanonCore or from any other product. **The refusal is of INSTANCE-TO-INSTANCE INTERCHANGE**,
> and it is NOT a refusal to let the owner have their own data."

Note that the R2 narrowing has already made this sentence *more* clearly not about outbound push: it
now says in its own words that it governs instance-to-instance interchange. Pushing a watch event to
Trakt is neither an instance nor an interchange. Verified 2026-09-09: searching SPEC.md for
`scrobbl`, `Trakt`, `Last.fm`, `ListenBrainz`, `webhook`, `push` and `outbound` returns **nothing**.
The subject is absent from the document, not decided in it.

### 1. What Plex actually does

**Plex has shipped webhooks since server v1.3.4, gates them behind Plex Pass, and one of the twelve
events is literally called `media.scrobble`.** From
https://support.plex.tv/articles/115002267687-webhooks/ (fetched 2026-09-09) — the finding's "12 named
events" is verified exactly, all twelve:

> **New Content** — `library.on.deck`, `library.new`
> **Playback** — `media.pause`, `media.play`, `media.rate`, **`media.scrobble` – Media is viewed
> (played past the 90% mark)**, `media.resume`, `media.stop`
> **Server Owner** — `admin.database.backup`, `admin.database.corrupted`, `device.new`,
> `playback.started`

Design details worth stealing or rejecting deliberately:

> "Webhooks are configured under Account settings … and are **tied to a specific user**. Servers
> receive webhooks for the user who is signed into the server, as well as webhooks for shared users.
> In this way, **your webhooks 'travel' with you**, so regardless of the server you're playing content
> from … the webhooks will be hit."
>
> "The webhooks are processed by **posting a JSON payload to the configured URL**. For some events, a
> small thumbnail JPEG is also included in a multipart message."
>
> "**Tip!** Webhooks are a premium feature and require an active Plex Pass subscription."

The payload has five parts (`event`/`user`/`owner` at top level, plus `Account`, `Server`, `Player`,
`Metadata`) and Plex publishes a worked example. Plex also ran a Pro Week 2025 piece titled "Webhooks
101" (https://www.plex.tv/blog/plex-pro-week-25-webhooks-101/, in the live blog sitemap 2026-09-09),
so the finding's "keeps a live blog category for them" is corroborated.

### 2. What Jellyfin actually does

**Jellyfin ships a first-party Webhook plugin and a first-party Trakt plugin, both actively
maintained.** `gh api`, fetched 2026-09-09:

| Repo | Stars | Last push |
|---|---|---|
| `jellyfin/jellyfin-plugin-webhook` | 246 | 2026-09-08 |
| `jellyfin/jellyfin-plugin-trakt` | 295 | **2026-09-09** |

Both under the `jellyfin` organisation, neither archived; the Trakt plugin was pushed to on the day of
this check. The Webhook plugin has its own page in the official server guide
(https://jellyfin.org/docs/general/server/notifications, fetched 2026-09-09): "Jellyfin will show
notifications on the dashboard by default, but you can send notifications via the Webhook Plugin to
additional messaging services."

**Correction to the finding.** It says Jellyfin's "only documented route for preserving watch state
across a rebuild is a third-party scrobbler". The actual wording is scripts against the API, not a
scrobbler — https://jellyfin.org/docs/general/administration/migrate/ (fetched 2026-09-09):

> "**Jellyfins internal databases cannot be copied or adjusted easily.**"
>
> "**Watched Status Migration** — There are **third-party scripts available that will use the API** to
> copy watched status and users from one instance to another. This can be done from Plex, Emby or
> another Jellyfin instance."

The substance survives the correction and arguably sharpens: Jellyfin's answer to "my watch history"
is *someone else's script talking to the API*, which is what happens when a product owns the data and
ships no way out of it.

### 3. Industry standard / best practice

**Outbound push is the one convention in this category that is genuinely universal, and the
best-engineered example is not a plugin.**

**Navidrome ships scrobbling in core, with the hard part solved.** `core/scrobbler/` (fetched
2026-09-09) contains `play_tracker.go`, `nowplaying_worker.go`, `playbackreport_worker.go` and
`buffered_scrobbler.go`; `adapters/` contains `lastfm/` and `listenbrainz/` alongside `deezer` and
`gotaglib`. The buffering is the interesting part, because it is exactly the failure mode an outbound
push creates:

```go
const (
    minRetryDelay = 5 * time.Second
    maxRetryDelay = 4 * time.Minute
    // maxRetryShift caps the exponent so the shift never overflows int64.
    // minRetryDelay<<6 = 320s already exceeds maxRetryDelay, so 6 reaches the ceiling.
    maxRetryShift = 6
)

// backoffDelay returns the delay for a zero-based retry index (0 = first retry):
// minRetryDelay doubled per prior failure, clamped to maxRetryDelay.
```

A scrobble that fails must be retried, which means it must be durable, which means the product needs a
log of plays it has not yet pushed. Navidrome had to build that buffer. **CanonCore already has it**:
an append-only watch event log plus a change sequence on every table. The half of this feature that
costs money is the half CanonCore has already committed to for other reasons.

There is no *protocol* standard — Trakt, Last.fm and ListenBrainz each have their own API — so the
convention is "ship an adapter per service", either in core (Navidrome) or as a plugin (Jellyfin,
Plex-via-webhook).

### 4. SURVIVES or MOVES

**MOVES** — as a documentation decision, which is what the finding asked for. Nothing here justifies
building it now, and it should not be built now. What has to change is the silence.

**Why it cannot be left silent.**

1. **The refusal genuinely does not cover it, and now says so out loud.** After the R2 narrowing the
   sentence reads "The refusal is of INSTANCE-TO-INSTANCE INTERCHANGE". Trakt is not an instance.
   An implementer reading the list will correctly conclude the subject is undecided, and will decide
   it themselves — in one direction or the other, silently. That is precisely the shape the sweep
   named: "almost certainly covers it and does not name it, which is precisely the ambiguity that gets
   resolved silently."
2. **It is the single most conventional outbound feature in the category, and CanonCore already owns
   the expensive half.** Both incumbents ship it (Plex in core behind a subscription, Jellyfin as two
   first-party plugins). The one product that put it in core had to build a durable, backing-off retry
   buffer to make it work; CanonCore's append-only watch event log is a better substrate for that than
   anything either incumbent has, because it records *every* viewing rather than a mutable
   last-played row.
3. **The security boundary is already specified and already applies.** "ONE Safe External Fetch
   boundary for every user-supplied URL" — HTTPS only, deny localhost/RFC1918/link-local/cloud
   metadata, re-validate at every redirect hop, cap the response, set a timeout. A webhook target is a
   user-supplied URL. The rule that makes outbound push safe exists and needs no extension.

**But do not build it, and say why.** Three costs that are not obvious:

- **It is a compatibility promise to a third party.** A Trakt adapter is pinned to Trakt's API for as
  long as it exists, and the spec refuses compatibility promises elsewhere on exactly that reasoning.
- **It is per-service, not generic.** Trakt, Last.fm and ListenBrainz have three different APIs and
  three different auth flows; there is no standard to implement once. Navidrome carries a separate
  `adapters/` package per service.
- **Plex's webhook design is user-scoped and CanonCore is single-user**, so the "webhooks travel with
  you" property that makes Plex's version valuable does not exist here. The single-user case is the
  weakest one for this feature, which is a reason to defer rather than a reason to refuse.

**Recommended edit, one line in WHAT NOT TO BUILD.** Not a refusal — a named deferral:
*Outbound push (webhooks, and scrobbling to Trakt, Last.fm or ListenBrainz) is not refused; it is not
in this version. It is not covered by the interchange refusal above, which governs CanonCore-to-CanonCore
instances. When it is built, the append-only watch event log is the substrate and the Safe External
Fetch boundary already applies to the target URL.* Two sentences close the ambiguity permanently and
cost nothing to ship.

---

## Summary

| Item | Verdict | One line |
|---|---|---|
| **R3** one number, four media | **MOVES** (narrow) | The "no second, higher threshold" half is right and Jellyfin proves it; "one number" across four media is not, because `text` completes in pages (Komga) and `image` has no clock. Scope it per medium. |
| **R4** groups never typed by medium | **SURVIVES** | Plex ran the medium-partitioning argument on real users and reversed it in July 2025 — "in hindsight, we recognize this wasn't the right approach". Jellyfin doesn't type collections either, only libraries. |
| **R5** enrichment design | **SURVIVES** | The objection's quote is unverifiable after a deliberate search; Plex's actual December 2025 position is that a metadata agent *is* "a user-defined list of providers", and it is deleting the alternative in 2026. |
| **R6** container progress on read | **SURVIVES** | Jellyfin 12.0, released 2026-09-08, ships `COUNT(DISTINCT)` over an `AncestorIds` closure — the same query. Two citations in the spec need correcting; the decision does not. |
| **R7** thin client | **SURVIVES** | The wrapper's benefit is verified, but Jellyfin's own trajectory since 2022 runs the other way: native Swift beats the wrapper 7:1 on adoption, and its wrapper-shaped desktop client is being rewritten for responsiveness. |
| **R8** confirmation never dismissible | **MOVES** (narrow) | Right for Delete permanently, wrong for the product's most frequent act. NN/g (reviewed 2026-08-07): "Do not use confirmation dialogs for routine actions." Jellyfin gives placement removal no dialog at all. |
| **R9** no window, no dismissal | **SURVIVES** | Jellyfin's resume query has neither; Plex's window is a performance control by its own text, and its dismissal is a documented user-complaint generator. But the abandoned film needs an answer, and "mark it watched" is a fabricated true. |
| **R10** remux banned by side effect | **SURVIVES** | Not "by side effect": Jellyfin classifies Remux as one of "three [types] which involve transcoding", and implements it as ffmpeg `-c copy`. Cost is bigger than filed — MDN lists no browser support for Matroska. |
| **R11** embedded tags | **MOVES** | MediaInfo — already a committed dependency — parses `Album`, `Album/Performer` and `Track/Position` in the same call that returns duration. Refusing them is discarding data already in hand, for no track titles at all. |
| **R12** standard read protocol | **SURVIVES** | Every candidate protocol is typed by medium (OPDS→text, Subsonic→audio, DLNA→video), so shipping one reintroduces R4's refusal sideways. Both incumbents chose "document your own API" in the last 18 months. |
| **R13** outbound push | **MOVES** (documentation) | The refusal now says in its own words that it governs instance-to-instance interchange, so it does not reach Trakt. Defer it by name; CanonCore already owns the expensive half (the durable event log Navidrome had to build). |

**Score: 8 survive, 3 move** — and of the three, R8 and R13 are one-clause writing fixes rather than
design changes. R11 is the only substantive reversal, and it is the direct successor to R1 on
strictly easier ground.

**Corrections to CONSOLIDATED-FINDINGS made in this pass, each verified:**

1. **R4** dates Plex's unbundling post to 2025; the page's own JSON-LD says `2024-09-12`.
2. **R4** does not record that Plex **reversed** the unbundling on 2025-07-16.
3. **R5**'s central quote could not be attributed to any Plex source after searching the forums'
   search API, the blog sitemap and two web searches.
4. **R6** reads `// These are just far too slow.` as being about collections; `ICollectionFolder` is
   Jellyfin's marker for *top-level library folders*, and box sets do compute on read.
5. **R6** says Jellyfin's dedup rests on the distinct-folders assumption; that governs only the
   merged-folder roll-up. The container path dedups explicitly.
6. **R7**'s "~144KB of Swift" in Streamyfin is now 537,748 bytes of Swift plus 634,101 of Kotlin.
7. **R9** reads Plex's 16-week window as a curation decision; Plex's own text frames both it and the
   item cap as performance controls.
8. **R10** says the ffmpeg ban catches remux "by side effect"; Jellyfin's own taxonomy puts remux on
   the transcoding side of the line, so "no transcoding" reaches it directly.
9. **R13** says Jellyfin's documented route for watch state is a third-party *scrobbler*; the doc says
   third-party *scripts using the API*.

**Things I could not verify, stated as such:**

- Whether Plex computes or stores `viewedLeafCount` (R6).
- Plex's client architecture from any primary source (R7).
- Any Plex rule for when a music track or photo counts as played (R3).
- The "part-time job managing metadata agent settings" quote (R5).

STATUS: complete. Finished 2026-09-09.
