# Verify: Plex claims in ADR-0085, ADR-0086, ADR-0087, ADR-0033, ADR-0047

Run date: **2026-09-10**. Every lookup below was performed in this run. No verdict rests on memory
or on any earlier verification file in this repo.

## Who owns a Plex fact

Plex is closed source, so the owners are `support.plex.tv`, `developer.plex.tv` (the API reference,
which the plex.tv nav links as "API Documentation / Plex Media Server API"), and posts on
`forums.plex.tv` by accounts the forum flags as Plex.

The forum's own group definitions matter here, and they are stricter than "staff". From
**<https://forums.plex.tv/t/user-groups/273958>** (Forum FAQ & Guides, posted 2018-06-21):

> **Plex Ninja**
> Users in the Plex Ninja group are honored, carefully selected members of our community, who
> volunteer their time and effort to help make the forums a better, more productive place for all.
>
> **Team Member**
> Users in the Team Member group work for Plex as contractors.
>
> **Plex Employee**
> Users in the Plex Employee group are full-time employees of Plex and come from a variety of teams.

Consequence for this run: Discourse's `staff: true` flag on a Plex forum post means *moderator*, and
Plex Ninjas are moderators. **`staff: true` is NOT evidence that a poster speaks for Plex.** The only
poster flag that does is `user_title: "Plex Employee"` (group `employees`) or `"Team Member"`. Every
quotation below records the poster's actual group.

Support pages were retrieved with curl (WebFetch gets HTTP 403 from support.plex.tv). Publication and
modification dates are taken from each page's own JSON-LD `datePublished` / `dateModified` and
cross-checked against the visible "Last modified on:" line.

---

## Claim 1 — completion is min(90% threshold, first credits marker), both configurable, percentage fallback

**Where:** ADR-0085, Evidence section. "Plex does not complete on a clock at all: it completes at the
EARLIER of a 90% default threshold and the first credits marker, both admin-configurable, falling
back to the percentage where no marker exists, so it is min(), not both."

**Verdict: CONFIRMED — all four elements, and the wording matches almost word for word.**

**Source:** <https://support.plex.tv/articles/200289526-library/> ("Library", Plex Support).
`datePublished` 2013-09-22, `dateModified` 2025-05-04 ("Last modified on: May 4, 2025"). Official
Plex support article; no poster involved.

Verbatim, from the Advanced Settings section (these settings live under Settings > Server > Library,
i.e. server-owner scope):

> **Video played threshold**
> Set the progress percentage for video playback at which point the video will be marked as played.
> (Default threshold is 90%.)
>
> **Video play completion behavior**
> Decide whether to use end credits markers to determine the “played” state of video items. When
> markers are not available the selected threshold percentage (from the above setting) will be used.
>
> - at selected threshold percentage: Base the “played” detection solely off of the completion
>   percentage of playback.
> - at final credits marker: Mark the item played when hitting the last credits (which would be after
>   any potential mid- or post-credits scenes).
> - at first credits marker: Mark the item played when hitting the first credits (which would be
>   before any potential mid- or post-credits scenes).
> - earliest between threshold percent and first credits marker: Use the first credits marker only if
>   it is earlier than the manually set percentage, otherwise use the manually set percentage. **This
>   is the default behavior.**

Element by element:

| Element of the claim | Verdict | Owning text |
| --- | --- | --- |
| 90% default threshold | CONFIRMED | "(Default threshold is 90%.)" |
| a credits marker participates | CONFIRMED | "Decide whether to use end credits markers to determine the 'played' state" |
| both admin-configurable | CONFIRMED | both are named server settings under Settings > Server > Library |
| fallback to percentage where no marker exists | CONFIRMED | "When markers are not available the selected threshold percentage … will be used." |
| min(), not both | CONFIRMED | "earliest between threshold percent and first credits marker … This is the default behavior." |
| specifically the FIRST credits marker | CONFIRMED | the default option names the first marker; "at final credits marker" is a separate, non-default option |

Two precisions worth carrying, neither of which damages the claim:

- min() is the **default**, not the only mode. An admin can select pure-percentage or pure-marker
  (first or final). The ADR says "default", so it is right; but "Plex does min()" without the word
  "default" would be wrong.
- Credits markers are a Plex Pass feature. Same page: "Generate credits video markers (Plex Pass) …
  This feature requires an active Plex Pass subscription." So for a non-subscriber the marker never
  exists and Plex is always the bare percentage. This strengthens rather than weakens ADR-0085's
  point that a percentage is what Plex actually falls back on.

---

## Claim 2 — Plex's own API docs give 10 seconds for both LAN and WAN

**Where:** ADR-0086. "It is the interval Emby's client documentation tells developers to report at,
the same figure Plex's own API docs give for LAN and WAN, and what Jellyfin's web client ships."

**Verdict: CONFIRMED. Yes, LAN and WAN really are the same figure — the docs state them as a single
combined figure, "LAN/WAN". The ADR omits a third figure the same sentence gives.**

**Source:** <https://developer.plex.tv/pms/> — the Plex Media Server API reference, on Plex's own
developer domain, linked from the plex.tv site nav as "API Documentation / Plex Media Server API".
Page title "Plex Media Server", spec version shown as **Plex Media Server (1.2.2)**. The page carries
no publication date; retrieved 2026-09-10.

Endpoint: **Report media timeline** (`POST`, under the Timeline group). Verbatim:

> **Report media timeline**
> This endpoint is hit during media playback for an item. It must be hit whenever the play state
> changes, or in the absence of a play state change, in a regular fashion (generally this means every
> 10 seconds on a LAN/WAN, and every 20 seconds over cellular).

Notes:

- **"LAN/WAN" is one figure, not two agreeing figures.** Plex does not state 10 s for LAN and
  separately 10 s for WAN; it states 10 s for LAN/WAN as a single case. The ADR's sentence is true
  but slightly overstates the independence of the two numbers.
- **The docs give a third figure the ADR does not mention: 20 seconds over cellular.** If ADR-0086
  ever wants to say "the industry converges on 10 s", the honest form is "10 s on LAN/WAN, 20 s on
  cellular".
- **Bonus corroboration for the other half of ADR-0086.** The same sentence independently supports
  "ALSO report immediately on any user interaction": "It must be hit whenever the play state
  changes". Plex states the interaction rule first and the timer as a fallback. That is stronger
  support for ADR-0086's central point than the ADR currently claims, and it comes from Plex rather
  than from Emby.
- The "10 seconds as a CEILING rather than a floor" framing in ADR-0086 is attributed to Emby, not to
  Plex, and was out of scope for this run. Plex's word is "generally", which is guidance, and it sets
  no floor or ceiling.

---

## Claim 3 — "Extras store no watched status. You can't mark Extras watched or unwatched" is Plex's design rule

**Where:** ADR-0087. "Plex's own design rule in that thread is the shape we are refusing: 'Extras
store no watched status. You can't mark Extras watched or unwatched.'"

**Verdict: CONTRADICTED, twice over.**
**(a) The wording is accurate but the attribution is not — it was written by an ordinary forum user
with no Plex affiliation at all.**
**(b) The substance is stale — Plex has been shipping extras playback progress for years and added
progress indicators for local extras in May 2026.**

### (a) Who actually said it

**Source:** <https://forums.plex.tv/t/resume-behind-the-scenes-clips/542159> — topic "Resume Behind
the Scenes - clips", created 2020-02-14. The quote is **post #4** (post id 2589189), posted
2020-02-14T15:40:26Z.

Poster metadata as returned by the forum's own JSON:

```
username: JuiceWSA
user_title: null        (no group title)
primary_group_name: null
flair_name: null
staff: false   admin: false   moderator: false
trust_level: 0
```

Compare post #1 in the same topic, `oRBIT2002`, which does carry `user_title: "Plex Pass"` and
`flair: plex-pass` — so the forum's group titles were rendering normally in this thread. JuiceWSA
simply has no group. Not a Plex Employee, not a Team Member, not even a Plex Ninja moderator, and not
a Plex Pass subscriber.

Verbatim, the whole post:

> That’s not a ‘behind the scenes clip’ - that’s a Documentary.
> The ‘Extras’ feature is designed for short clips - Not Movie Versions or Documentaries.
> **Extras store no watched status**
> **You can’t mark Extras watched or unwatched**
> Extras generate no Video Preview Thumbnails
> I do have some videos that came on DVDs as ‘Extras’.
> They aren’t Extras - they’re Documentaries and I have them in the Movie Library as such, in their
> full versions, where they enjoy the same benefits a Movie does - 'cause they’re Movies.
> We don’t want Extras to behave like Movies.

The thread's other assertion of intent, post #2 ("This is by design - and we're all thankful it is"),
is the same account: `JuiceWSA`, `staff: false`, no group, `trust_level: 0`. **No Plex account posts
in this topic at all.** The only `staff: true` post is #5, the automatic 90-day closure by the
`system` account.

So "Plex's own design rule" is a misattribution. It is one user's assertion about Plex's design,
uncontradicted in the thread because no one from Plex was in it.

### (b) The substance no longer holds

Plex-owned evidence that extras do carry playback state, newest first:

1. **Plex Employee, official release notes, 2026-05-13.**
   <https://forums.plex.tv/t/plex-for-mobile-android-ios/909610/44> — posted by `PlexReleaser`,
   `user_title: "Plex Employee"`, `primary_group_name: "employees"`:

   > Plex for Android 2026.9.0 (Google Play)
   > Plex for iOS 2026.9.0 (App Store)
   > NEW:
   > **Add progress indicators to local extras on details screens.**

   Same line in the beta notes a week earlier, same author:
   <https://forums.plex.tv/t/plex-for-mobile-android-ios-beta-release-notes/912796/67>, 2026-05-04.

2. **Plex Ninja moderator, 2022-10-07.**
   <https://forums.plex.tv/t/remembering-watched-extras/813799> post #3, `OttoKerner`,
   `user_title: "Plex Ninja (Moderator)"` (volunteer, so weaker than an Employee post, but a
   moderator's factual report about shipped behaviour):

   > It actually depends on the used client type.
   > For instance, Plex Web does support storing playback position of and resuming extras, whereas
   > Plex HTPC does not.

3. **Plex Ninja moderator, 2021-07-15**, closing out the 2015 feature request (see Claim 4):
   <https://forums.plex.tv/t/resuming-playback-on-movie-extras/122412> post #3, `tom80H`,
   `user_title: "Plex Ninja"`: "2021 clean-up: implemented", with a screenshot.

4. **A 2026 user thread confirming the current shape of the gap.**
   <https://forums.plex.tv/t/add-watched-indicators-to-local-extras-on-details-screens/938779>,
   2026-05-13, `ShaGe` (Plex Pass, not staff):

   > Thanks so much for adding progress indicators to local extras in the latest release. Any chance
   > you can add watched indicators as well?

   That is the true 2026 position: **progress is stored and shown; a binary watched badge is not.**
   Not "no watched status" and certainly not "extras are hidden".

5. **Neither Plex support article on extras says anything about watched status.**
   <https://support.plex.tv/articles/local-files-for-trailers-and-extras/> (modified 2025-02-08) and
   <https://support.plex.tv/articles/local-files-for-tv-show-trailers-and-extras/> (modified
   2026-03-30) cover naming, directory layout, agents and per-client support matrices. Searched both
   in full for "watch", "played", "progress", "resume": no statement of any kind about watched state.
   There is no Plex-owned source anywhere that states the rule ADR-0087 attributes to Plex.

**What survives.** ADR-0087's *decision* is untouched and is arguably strengthened: Plex is moving
toward extras with their own progress, which is what ADR-0087 argues for. What fails is the
rhetorical move of naming that sentence "Plex's own design rule … the shape we are refusing". It is
neither Plex's nor current.

---

## Claim 4 — Plex users have been asking since 2020

**Where:** ADR-0087. "Plex's users have been asking since 2020 for extras to be tracked properly
rather than hidden."

**Verdict: CONTRADICTED. The earliest request I could actually retrieve is 2015-11-08 — four years
and three months earlier than the ADR's date.**

The scepticism the task asked for was warranted, but the error runs the other way from the earlier
"since 2011 → actually 2013" case: here the ADR is too *late*, not too early.

**Earliest retrieved:** <https://forums.plex.tv/t/resuming-playback-on-movie-extras/122412> —
"Resuming playback on movie extras", topic created **2015-11-08T02:22:12Z**. Post #1 by `fcapizzo`
(`user_title: "Plex Pass"`, `staff: false`):

> Currently PMS does not keep track of playback of movie extras, whether they are from online sources
> or locally added. I would definitely like to have playback supported for extras, at least for
> locally added extras.

That is precisely "asking for extras to be tracked properly", verbatim.

**Second-earliest, independent:**
<https://forums.plex.tv/t/fitness-videos-resume-short-not-possible/175799> — created
**2017-01-14T16:21:37Z**. Post #1 by `cncb` (`staff: false`):

> The problem is there seems to be no way to resume the shorts at least in the Web and Android TV
> clients. Is resume supposed to be supported for these “extras”?

Answered at post #2 (2017-01-16, `anon18523487`, `staff: false`): "The playback progress for extras
are not tracked by Plex, so it's not possible to resume."

**The thread the ADR cites** (542159) is 2020-02-14 — real, but the fourth-or-later instance, not the
first.

**Method, so the "earliest I could retrieve" is auditable.** Discourse search API at
`https://forums.plex.tv/search.json?q=…`, queries run 2026-09-10:
`extras watched status before:2020-01-01`, `extras mark watched before:2020-01-01`,
`extras resume playback progress before:2020-01-01`, `extras track watched before:2018-01-01`,
`extras watched status before:2017-01-01`, `trailers extras resume watched before:2016-01-01`,
`extras watched in:title`, `extras resume in:title`, `extras progress in:title`,
`mark extras watched`. The `before:2016-01-01` and `before:2017-01-01` sweeps surfaced nothing on
this subject earlier than 122412. Caveat stated plainly: the Plex forum was migrated to Discourse and
old post metadata is lumpy (several 2013-2015 posts carry `.000Z` timestamps, i.e. imported), so an
earlier request may exist that search will not return. What is *retrievable* is 2015-11-08.

**Also worth recording, because it changes the story ADR-0087 tells.** The 2015 request was marked
implemented in 2021 ("2021 clean-up: implemented", tom80H, Plex Ninja), and users are still asking
for the last piece in 2026 — <https://forums.plex.tv/t/parity-resuming-playback-for-long-featurettes-and-other-extras/938631>
(2026-05-07) and 938779 (2026-05-13). The accurate sentence is "Plex users have been asking since
**2015**, Plex began shipping it around 2021, and the remaining gap in 2026 is a watched *badge*, not
progress."

---

## Claim 5 — Plex models an extra as a CHILD ITEM (Plex half only)

**Where:** ADR-0087. "Plex and Jellyfin both model an extra as a child item."

**Verdict: CONFIRMED for Plex.**

**Source:** <https://developer.plex.tv/pms/>, spec version Plex Media Server (1.2.2), retrieved
2026-09-10.

Four independent pieces of the API say "item", not "file role":

1. **An extra is a metadata type.** The reference's "List of Metadata Types" table includes:

   > | clip | 12 |

   alongside movie 1, show 2, season 3, episode 4, trailer 5, artist 8, album 9, track 10. An extra
   is one of these, not an attribute hung off one.

2. **Extras have their own subtype vocabulary, refining a type.** From the same page:

   > Some elements may also include an optional **subtype** attribute. The subtype is meant to be a
   > refinement of the type, not a completely different type. … `type="clip" subtype="news"` passes
   > the test that "This is a clip, a news clip specifically."
   >
   > **Extras Subtypes**
   > trailer | deletedScene | interview | musicVideo | behindTheScenes | sceneOrSample |
   > liveMusicVideo | lyricMusicVideo | concert | featurette | short | other

   Note what this rules out: the extra type is carried on the *item*, as type+subtype, not on a media
   part or file row.

3. **Extras are addressed as children of a parent metadata item, with their own endpoints.**

   > **Get an item's extras** — Get the extras for a metadata item
   > `get /library/metadata/{ids}/extras`
   >
   > **Add to an item's extras** — Add an extra to a metadata item
   > `post /library/metadata/{ids}/extras`
   > query Parameters: `extraType` integer — *The metadata type of the extra*; `url` required; `title`
   > required

   `/extras` sits in the same shape as `/children` and `/grandchildren`, which the page describes
   thus: "One exception is the `/children` key for parents like shows and seasons. It will return a
   list of children even though the type describes the parent." The response is a `MediaContainer`
   with a `Metadata` array — items with `ratingKey` and `key`, not `Part` rows.

4. **The parent points at the extra by metadata key.** In the reference's own sample response, the
   parent movie carries:

   > `"primaryExtraKey": "/library/metadata/1073"`

   while the movie itself is `"ratingKey": "1049"`. The extra is a separate `/library/metadata/{id}`
   resource with its own identity — which is exactly what makes it able to carry its own progress,
   and exactly what ADR-0087 says Kodi's `videoversion`-row approach cannot do.

Also consistent: `includeExtras=1` is documented as a parameter on the metadata details endpoint —
extras are *included* into a parent's response, i.e. they exist separately and are joined in.

The Jellyfin half of the claim was not in scope for this run and is not verified here.

---

## Claim 6 — PhotoTranscoder cache, weekly sweep, and *why*

**Where:** ADR-0033, "What the declared variant buys". "Plex's separate PhotoTranscoder cache and its
weekly sweep exist because it did the opposite: a store bounded at runtime needs a sweeper, and the
sweeper is the tell."

**Verdict: split. Existence CONFIRMED. Weekly sweep CONFIRMED. The "because" is JUDGEMENT — an
undocumented inference about motive that has been fused onto two documented facts.**

### PhotoTranscoder exists — CONFIRMED

**Source:**
<https://support.plex.tv/articles/204041406-where-are-plex-media-server-cached-images-stored-on-my-computer/>
— "Where are Plex Media Server cached images stored on my computer?". `datePublished` 2014-12-04,
`dateModified` 2019-02-28 ("Last modified on: February 28, 2019"). Official Plex support article.

> As various Plex apps request images from your Plex Media Server, they will be generated as needed
> and then cached for future use.
>
> **Windows** `%LOCALAPPDATA%\Plex Media Server\Cache\PhotoTranscoder`
> **OS X** `~/Library/Caches/PlexMediaServer/PhotoTranscoder/`
> **Linux** `$PLEX_HOME/Library/Application Support/Plex Media Server/Cache/PhotoTranscoder/`
> **QNAP** `/share/MD0_DATA/.qpkg/PlexMediaServer/Library/Plex Media Server/Cache/PhotoTranscoder`
> **Synology** `/Volume1/Plex/Library/Application Support/Plex Media Server/Cache/PhotoTranscoder`

Plex names the directory `PhotoTranscoder`, on every platform, and it sits under `Cache/`, separate
from the metadata bundles. "Separate PhotoTranscoder cache": confirmed.

### A weekly sweep exists — CONFIRMED

**Source:** <https://support.plex.tv/articles/201553286-scheduled-tasks/> — "Scheduled Tasks".
`datePublished` 2014-02-24, `dateModified` 2025-07-31 ("Last modified on: July 31, 2025").

> **Remove old cache files every week**
> When the image processor inside the Plex Media Server processes images (e.g. to resize them), a
> cached version of the transformed file is kept around for quick access later. This task cleans up
> files which were created over a month ago.

Two precisions:

- **Plex does not use the word "PhotoTranscoder" on the Scheduled Tasks page.** It says "the image
  processor … a cached version of the transformed file". Joining that to the `PhotoTranscoder`
  directory named on the other page is a one-step inference. It is a safe one — Plex has exactly one
  documented image cache and the description matches it exactly — but the ADR's sentence reads as
  though a single Plex page says "PhotoTranscoder is swept weekly", and no page does.
- **Weekly is Plex's general maintenance cadence, not something special about images.** The same page
  lists "Optimize database every week" and "Remove old bundles every week". So the *weekliness* is
  not itself the tell; the existence of any sweeper at all is. Also on that page: "Note: Due to the
  way scheduling is calculated, tasks which occur every three days or every week may not occur for
  the first time until a few days after scheduling is enabled."

### The "because" — JUDGEMENT, and a fused fact/motive

Plex nowhere states *why* it has an image cache with a sweeper. It never contrasts a runtime-bounded
store with a design-time-bounded one, and it publishes no rationale for the cache's existence.

What the documentation *does* support is the mechanism the inference rests on: "As various Plex apps
request images from your Plex Media Server, they will be **generated as needed**" and the image
processor "processes images (e.g. to resize them)". So images are produced per request, at whatever
size the requesting client asks for, and retained — which is precisely a store whose size is
determined at runtime by client behaviour rather than at design time by a declared variant. The
inference is well-founded and I would not ask ADR-0033 to drop it.

The flag is on the *form*. "Plex's separate PhotoTranscoder cache and its weekly sweep exist because
it did the opposite" states a documented fact and an undocumented motive in one clause, with no seam
between them. A reader cannot tell which half Plex owns. It should read as two sentences: Plex
generates image variants on demand and caches them (documented), and sweeps that cache on a weekly
schedule (documented); we infer that a store whose contents are decided at request time is what makes
a sweeper necessary (ours).

---

## Claim 7 — Plex freezes rather than migrates: 2019, "existing content will not change by default", per-artist opt-in

**Where:** ADR-0047, "A third strategy, and it is not a worse one". "Plex avoids migrating
heterogeneous data by FREEZING it. When it changed metadata providers in 2019, 'existing content will
not change by default' and the user opts in per artist."

**Verdict: CONFIRMED on all three checkable elements (quote, year, per-artist opt-in), but the
quotation is truncated in a way that reverses Plex's stated intent. Flagged as fused fact + motive:
the decision stands; the framing that Plex *chose freezing as a strategy* is not what Plex says.**

**Source:** <https://support.plex.tv/articles/upgrade-music-libraries-new-metadata-system/> —
"Upgrading Music Libraries to the New Metadata System". `datePublished` **2019-10-02**, `dateModified`
**2026-06-09** ("Last modified on: June 9, 2026"). Official Plex support article.

### The year — CONFIRMED

> At the end of June, 2019, we switched metadata providers for some of the metadata we provide.
> Specifically, this primarily affected electronic program guide data for our Live TV & DVR feature
> as well as metadata available for our “premium” music libraries.

2019, and it was a provider switch. Both correct.

### The quote — CONFIRMED verbatim, but cut mid-sentence

Plex's actual sentence, from "What to Do After You Upgrade":

> New content added to the library from this point forward will use the new system.
> **Existing content will not change by default for now.** To upgrade an existing artist (and
> albums/tracks belonging to the artist), you need to take explicit action to Refresh the content, as
> noted below.

The ADR quotes "existing content will not change by default" and stops. Plex wrote "…**for now**".

And twice elsewhere on the same page Plex states an intention to un-freeze:

> Once the library is upgraded, nothing is going to change immediately with the content itself,
> though. Instead, you’ll need to choose to upgrade that content yourself for now (see below).
> **In the future, we’ll have existing content automatically upgrade, but that won’t happen to
> start.**

(That paragraph appears twice, once for Premium and once for Basic libraries.)

### Per-artist opt-in — CONFIRMED, and it is emphatically per-artist

> To upgrade an existing artist in your music library, simply Refresh Metadata for that artist. Doing
> so will match the artist using the new system and gather all the new metadata. **It’s important to
> do the Refresh Metadata at the artist level and not the album level** (refreshing an album will not
> upgrade anything until you’ve refreshed the artist itself).
>
> Tip!: If you wish to refresh individual content, you must refresh at the artist level. If you have
> not refreshed the artist to upgrade it, then refreshing an individual album will not upgrade
> things.

A bulk escape hatch exists but is still an explicit user action: "you can do a Refresh All Metadata on
the entire library at once. That will upgrade all artists."

### What the truncation costs, and what rescues it

ADR-0047 presents freezing as a deliberate third strategy alongside migrate-everything and
quarantine-what-fails, on a par with them: "Migrate everything, quarantine what fails, or freeze the
old semantics and let the owner choose. All three are legitimate." Plex's own text does not present
it as a strategy at all. It presents it as a **temporary default while automatic upgrade is not yet
built**, and promises the automatic upgrade. Cutting "for now" makes a stopgap read as a design.

That matters more than usual in this repo, because CLAUDE.md's own principle is "Do not accept a
stopgap that only works for now and is meant to be replaced later" — and "for now … in the future
we'll have existing content automatically upgrade" is that stopgap, described in those words.

What rescues the ADR's *decision*, and should be the evidence it actually cites: **the page's
`dateModified` is 2026-06-09 and the "for now" wording is still there.** Seven years after the
provider switch, Plex has not shipped the promised automatic upgrade and the freeze is still the
shipped behaviour. That is a far better argument for freezing being a durable, legitimate strategy
than the truncated quote is — it is evidence from what Plex *did* over seven years rather than from
what Plex *said* it would do. The ADR should make that the claim: not "Plex chose to freeze", but
"Plex froze in 2019 intending to auto-upgrade later, and as of mid-2026 the freeze has stood".

---

## Claim 8 — Plex locks thumb, art and clearLogo separately; the artwork pin is per-role

**Where:** ADR-0038 (`0038-artwork-is-a-table.md`, line 12): "(item, role), which is how Plex locks
thumb, art and clearLogo separately".

**Verdict: CONFIRMED, and the ADR understates it — Plex has seven separately addressable artwork
elements, not three.**

**Source:** <https://developer.plex.tv/pms/>, spec version Plex Media Server (1.2.2), retrieved
2026-09-10.

Each artwork role is a path parameter, i.e. a separately addressable resource:

> **Set an item's artwork, theme, etc** — Set the artwork, thumb, element for a metadata item
> path Parameters: `ids` required string; **`element` required string — Enum: "thumb" "art"
> "clearLogo" "squareArt" "banner" "poster" "theme"**
> `post /library/metadata/{ids}/{element}` and `put /library/metadata/{ids}/{element}`

And setting one locks that one:

> **Delete an item's artwork, theme, etc** — Delete the artwork, thumb, element for a metadata item.
> **This operation will also lock the field.** 'thumb' images for video items will be reset to a
> screengrab of the video after a refresh.
> path Parameters: `element` required string — Enum: "thumb" "art" "clearLogo" "squareArt" "banner"
> "poster" "theme"

The lock itself is per-field, in the bulk-edit endpoint (`PUT /library/sections/{sectionId}/all`):

> `field.value` string — Set the specified field to a new value
> **`field.locked` integer — Enum: 0 1 — Set the specified field to locked (or unlocked if set to 0)**

i.e. the lock is keyed on `(item, field)` and artwork roles are fields. That is exactly ADR-0038's
`(item, role)` shape.

**User-facing confirmation**, <https://support.plex.tv/articles/201272763-edit-details/> ("Edit
Details", `dateModified` 2026-08-19):

> Fields set to locked when manual changes are made indicated by the change of lock icon color to
> orange. **Locked fields will not update on metadata refreshes.** Unlock a field by clicking on the
> lock icon returning it to grey.
>
> **Change Artwork** — There are various types of artwork that can be changed depending on the type
> of media it is. Some of the types include Posters/Thumbnails, Backgrounds, Title Art/Logo and
> Square Art.

Nothing anywhere offers an item-level artwork lock. The pin is per-role. Confirmed.

Optional improvement for ADR-0038: naming three of seven roles invites a reader to think the set is
three. `thumb`, `art`, `clearLogo`, `squareArt`, `banner`, `poster`, `theme` is the documented enum.

---

## Claim 9 — a stored poster is roughly 50-150KB

**Where:** ADR-0033, "What the declared variant buys". "Declaring the stored variant (a w500 poster,
a w780 backdrop) is what makes the image store bounded BY THE CATALOGUE at design time — roughly
50-150KB each, a few hundred megabytes across the archive extract's 11,285 stories."

**Verdict: UNFOUNDED. No source owns this figure — not Plex, not TMDB, not anyone. It is an
unattributed estimate presented in the same breath as facts that do have owners.**

**What I looked for and did not find:**

- Plex publishes no figure for stored image sizes anywhere I could reach. The one page that discusses
  the image cache
  (<https://support.plex.tv/articles/204041406-where-are-plex-media-server-cached-images-stored-on-my-computer/>)
  gives directory paths only, no sizes, no bounds, no per-image figures.
- TMDB, whose `w500` / `w780` naming the ADR borrows, documents the size *names* only.
  <https://developer.themoviedb.org/docs/image-basics> (retrieved 2026-09-10) explains that an image
  URL is built from "a `base_url`, a `file_size` and a `file_path`", that the first two come from the
  `/configuration` endpoint, and gives `https://image.tmdb.org/t/p/w500/…` as its worked example. It
  states no byte size anywhere, and TMDB has no reason to: JPEG size at a fixed width varies
  several-fold with content and encoder quality.
- WebSearch for a TMDB or Plex-owned figure returned only community forum threads about which width
  to use, none of which state byte sizes and none of which are owners anyway.

**What would settle it:** nothing external can, because no owner exists. The figure can only become
sound by being *measured against our own pipeline* and labelled as our measurement — i.e. once we
have chosen a variant and a JPEG quality, fetch a sample of the actual images we intend to store and
report the observed distribution.

**A measurement I made this run, offered as illustration and explicitly not as a source.** The nine
TMDB image paths that appear in Plex's own API reference samples, re-requested at `w500` and read
from `Content-Length` (HEAD requests, 2026-09-10):

| bytes | path (`https://image.tmdb.org/t/p/w500/…`) |
| --- | --- |
| 18,295 | mhhq4BXNmnZZfzfqsBvZwMvcngt.jpg |
| 18,311 | qgKsxcwvkDbAIjUceuDrv2AgtOF.jpg |
| 25,378 | fvREJ2bNoXM2WAGVPCGa3ryQtJs.jpg |
| 31,668 | 3WXclCno2MYKhdnUidQVsPSpolk.jpg |
| 32,678 | 3uE9SUywNbj1qSAuYCGgbTTYku5.jpg |
| 48,045 | w8mYplN3ysIJ5DIYYgmfGTvuNzd.jpg |
| 53,557 | zIDoU6YZXE3oz9MNBjE2Ld94Xuu.jpg |
| 106,806 | qk3eQ8jW4opJ48gFWYUXWaMT4l.jpg |
| 119,341 | rIi0lY2UftYuKDJ4OlIefDdijve.png (a clearLogo PNG, not a poster) |

Observed range 18-119 KB, median ~33 KB. The sample is small and mixes posters with backdrops and one
PNG logo, so it settles nothing — but it does suggest the ADR's band is pitched high at the bottom
end, and that the derived "a few hundred megabytes across 11,285 stories" is a ceiling rather than an
estimate. If ADR-0033 keeps a number at all, "tens of KB, occasionally over 100 KB" is closer to what
a w500 JPEG actually is.

The ADR's *decision* — declare the stored variant so the store is bounded at design time — does not
need this number and is unaffected by dropping it.

---

## Summary table

| # | Claim | ADR | Verdict |
| --- | --- | --- | --- |
| 1 | min(90% default, first credits marker), both configurable, percentage fallback | 0085 | **CONFIRMED** (all four elements; min() is the *default* mode) |
| 2 | Plex API docs give 10 s for LAN and WAN | 0086 | **CONFIRMED** (stated as one "LAN/WAN" figure; docs also give 20 s cellular) |
| 3 | "Extras store no watched status…" is Plex's design rule | 0087 | **CONTRADICTED** (non-staff user, `trust_level: 0`; and stale — Plex shipped extras progress indicators 2026-05) |
| 4 | Users asking since 2020 | 0087 | **CONTRADICTED** (earliest retrievable 2015-11-08) |
| 5 | Plex models an extra as a child item | 0087 | **CONFIRMED** (type `clip`=12, Extras Subtypes, `/library/metadata/{ids}/extras`, `primaryExtraKey`) |
| 6 | PhotoTranscoder + weekly sweep, *because* runtime-bounded | 0033 | **CONFIRMED** / **CONFIRMED** / **JUDGEMENT** on the "because" |
| 7 | 2019 freeze, "existing content will not change by default", per-artist | 0047 | **CONFIRMED** on all three; quote truncated — Plex wrote "for now" and promised auto-upgrade |
| 8 | Locks thumb, art, clearLogo separately | 0038 | **CONFIRMED** (seven elements, not three) |
| 9 | Stored poster roughly 50-150KB | 0033 | **UNFOUNDED** (no owner; own measurement 18-119 KB, median ~33 KB) |

## Decision stands, stated evidence does not

- **ADR-0087.** The decision (an extra is a work with its own progress and its own page) stands and is
  now *better* supported than the ADR claims: Plex is actively shipping extras progress, which makes
  it a precedent rather than a foil. Two evidence sentences fail — the "Plex's own design rule"
  attribution and the "since 2020" date. Rewriting them makes the ADR stronger, not weaker.
- **ADR-0033.** The declared-variant decision stands. The "50-150KB" figure has no owner and should
  go or be relabelled as our own estimate; the PhotoTranscoder "because" should be split into fact and
  inference.
- **ADR-0047.** The third-strategy decision stands. The supporting quote is truncated in a way that
  inverts Plex's stated intent; the seven-year-old unchanged "for now" is the evidence that actually
  carries the argument.
- **ADR-0085 and ADR-0086** are fully sourced and need no change. ADR-0086 can additionally cite Plex
  rather than only Emby for its "report on every interaction" half.

## Documented fact fused with undocumented motive

Three places state an owned fact and an unowned inference in one clause, with no seam:

1. **ADR-0033 / Claim 6.** "Plex's separate PhotoTranscoder cache and its weekly sweep **exist
   because** it did the opposite." Cache and sweep: documented. "Because bounded at runtime":
   inference, sound but ours.
2. **ADR-0087 / Claim 3.** A verbatim, correctly transcribed quotation fused with "**Plex's own**
   design rule". The quotation is real; the attribution is invented. This is the most damaging of the
   three, because the fusion is what makes the sentence do rhetorical work.
3. **ADR-0047 / Claim 7.** "Plex **avoids migrating** heterogeneous data **by FREEZING it**" fuses a
   documented behaviour with an inferred intent that Plex's own page contradicts ("for now", "in the
   future we'll have existing content automatically upgrade").
