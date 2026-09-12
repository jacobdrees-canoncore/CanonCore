# Verification: every Plex claim in the decision log

Every factual claim about Plex made in `docs/adr/` (and the Plex claims in `SPEC.md` that the
ADRs summarise) checked against the source that owns it: Plex's own support articles, Plex's own
forums, and python-plexapi's source. Nothing here is confirmed from memory; every CONFIRMED
verdict carries a URL fetched during this run, the quote, the fetch date, and the page's own
`dateModified` where it publishes one.

Fetched with plain `curl` against `support.plex.tv` and against `forums.plex.tv`'s Discourse JSON
API (`https://forums.plex.tv/t/<id>.json`), which is publicly readable. User profile endpoints
(`/u/<name>.json`) are NOT publicly readable and return `invalid_access`, which limits what can be
established about a poster's affiliation.

Run date: 2026-09-09.

---

## 1. The file-identity hash — ADR 0023

**Claim.** Identity is `SHA1(ascii(decimal size) + hex(SHA1(first 64KB)) + hex(SHA1(last 64KB)))`,
no separators, last term omitted entirely for files of 64KB or smaller. "This is Plex's exact
algorithm."

**CONFIRMED.** https://forums.plex.tv/t/904178.json — topic "How is Plex hash calculated?",
post 5, by `gbooker02`, `created_at` 2025-02-12T14:12:44.350Z. Fetched 2026-09-09.

> There are a few steps:
> Create a string with the filesize in decimal
> Take the SHA1 hash of the first 64kB (65536 bytes) and append this to the string in hex.
> If the file is greater than 64kB, do the same with the last 64kB
> SHA1 hash this string

The worked example in the same post pins every detail the ADR asserts. File size 928670754; first
64kB SHA1 `87a82ca143a5d84ba4ba33f421f25fbac9811f89`; last 64kB SHA1
`ce2f3dd83c1cc4ffa4deda5588a9118be004ce09`; the string hashed is
`92867075487a82ca143a5d84ba4ba33f421f25fbac9811f89ce2f3dd83c1cc4ffa4deda5588a9118be004ce09` —
decimal size then two hex digests, **no separators**, exactly as the ADR states. The result
`782e3038c7290470c29320a840e5f92123912e56` "matches the hash column in the media_parts table".
"If the file is greater than 64kB, do the same with the last 64kB" is the conditional the ADR
renders as "the last term omitted entirely for files of 64KB or smaller" — same rule.

The date and the post number in the ADR are both right.

---

## 2. "Published by a Plex ENGINEER" — ADR 0023

**Claim.** The algorithm was "published by a Plex engineer on 2025-02-12".

**UNFOUNDED.** The date, the venue and the content are confirmed (section 1). The word
*engineer* is not. Plex's own forum does not present `gbooker02` as staff. The post JSON fetched
2026-09-09 from https://forums.plex.tv/t/904178.json carries, for post 5:

```
username: gbooker02   user_title: "Plex Pass"   staff: false   admin: false
moderator: false      trust_level: 2            primary_group_name: "plex-pass"
```

Contrast post 3 in the same thread, where the forum does flag its staff:
`user_title: "Plex Ninja (Moderator)", staff: true, moderator: true,
primary_group_name: "team-members"`. So the forum distinguishes staff from members and does not
place this poster among them.

What would settle it: a Plex-owned page naming gbooker02 as an employee, or a post of his carrying
a Plex staff flair. `https://forums.plex.tv/u/gbooker02.json` returns
`{"errors":["You are not permitted to view the requested resource."]}` — profiles are not public,
so the forum cannot settle it either way.

**What is safe to write instead:** "published on Plex's own forum on 2025-02-12". The
authority for the algorithm is that it reproduces the `media_parts.hash` column, which the post
demonstrates and the asker independently reproduced in post 6 — not the poster's job title.

---

## 3. "A moderator had refused to disclose it and given a wrong description" — ADR 0023

**Half CONFIRMED, half UNFOUNDED.**

*Gave a wrong description* — **CONFIRMED.** Same thread, post 3, `OttoKerner`, `user_title`
"Plex Ninja (Moderator)", `staff: true`, `moderator: true`, created 2025-02-11T11:33:11.078Z:

> Try reading 4 KB from the beginning and 4k from the end. Concatenate these and compute the
> overall hash.

That is wrong on three counts against post 5: 4 KB not 64 KB, the raw bytes not their hex digests,
and no file size term. Post 4 records it failing in practice: "I did that when I wrote the post
... Unfortunately the hash changes every time."

*Refused to disclose it* — **UNFOUNDED** in this thread. The moderator did not decline; he
answered, wrongly. The asker in post 1 references an earlier thread ("I only found this thread
that mentions what it is"), and a refusal may sit there, but it is not in topic 904178.
What would settle it: the id of the earlier thread and a quoted refusal in it.

---

## 4. Network mounts and the periodical-scan remedy — ADR 0050

**Claim.** "Plex's own documentation says content mounted via a network 'will also typically not
work'" and "Plex's remedy is the one we adopt — 'you may have to set a periodical scan or do it
manually'."

**CONFIRMED, both quotes verbatim and from one sentence pair.**
https://support.plex.tv/articles/200289526-library/ — "Library", under *Scan my library
automatically*. Fetched 2026-09-09; the page's own `dateModified` is 2025-05-04T16:15:26+00:00
(`datePublished` 2013-09-22).

> Note: This function relies on the computer's operating system providing the "something changed"
> trigger. Some operating systems don't provide this trigger and content mounted via a network
> **will also typically not work**. If your library doesn't automatically scan, **you may have to
> set a periodical scan or do it manually**.

A second Plex article says the same thing in stronger terms, which strengthens rather than
qualifies the ADR: https://support.plex.tv/articles/200289306-scanning-vs-refreshing-a-library/
(fetched 2026-09-09, `dateModified` 2019-07-31):

> Note: In most cases, this should work for content on local filesystems. It **will generally not
> work** for network shares mounted via SMB, NFS, AFP, or similar.

The ADR's separate assertion that "the same is reported for FUSE mounts" is not sourced to Plex
here and is not a Plex claim, so it is out of scope for this check.

---

## 5. The 16-week Continue Watching window — SPEC / CONTEXT

**Claim.** Plex's default 16-week Continue Watching window is admin-configurable, and is NOT a
resume expiry.

**CONFIRMED.** https://support.plex.tv/articles/200289526-library/, *Advanced Settings*. Fetched
2026-09-09; `dateModified` 2025-05-04T16:15:26+00:00.

> **Weeks to consider for Continue Watching** — Lets you choose how many weeks to check for
> content to be included in the Continue Watching data for a library. The default value of 16
> weeks is good for the vast majority of users. You can lower the value if your Continue Watching
> is particularly slow to appear. (Increasing the value can cause Continue Watching or app
> dashboards to be much slower to appear.)

Three things this settles:

- **16 weeks is the default**, stated as such.
- **It is admin-configurable**, per library, and it sits under *Advanced Settings* behind a
  "Show Advanced" toggle, which the same article prefaces with "Be careful when adjusting or
  using advanced settings."
- **It is not a resume expiry.** The wording is "how many weeks to check for content **to be
  included in** the Continue Watching data" — a window on what the shelf considers, not a
  deadline after which a stored resume position is discarded. The neighbouring setting confirms
  the reading by naming the window as something items fall *outside* without being lost:
  "Season premieres generally will fall outside of the number of weeks for Continue Watching for
  most people ... this setting makes episode one of a new season appear even if it falls outside
  of Weeks to consider for Continue Watching setting."

Two adjacent settings, worth knowing: **Maximum number of Continue Watching items which will
appear** ("Setting a very high number can negatively affect performance") and **Include season
premieres in Continue Watching** (enabled by default).

---

## 6. Plex's completion rule — SPEC ("90% crossed TOGETHER WITH a credits marker")

**Claim.** "Plex does not complete on a clock at all: it completes on 90% crossed TOGETHER WITH a
credits marker."

**CONTRADICTED on the conjunction.** Plex's default is the **EARLIEST of the two**, not both
together, and the whole behaviour is a four-way setting the admin picks — including a mode that
uses the percentage alone.

https://support.plex.tv/articles/200289526-library/, *Advanced Settings*. Fetched 2026-09-09;
`dateModified` 2025-05-04T16:15:26+00:00.

> **Video played threshold** — Set the progress percentage for video playback at which point the
> video will be marked as played. (Default threshold is 90%.)
>
> **Video play completion behavior** — Decide whether to use end credits markers to determine the
> "played" state of video items. **When markers are not available the selected threshold
> percentage (from the above setting) will be used.**
>
> - *at selected threshold percentage*: Base the "played" detection solely off of the completion
>   percentage of playback.
> - *at final credits marker*: Mark the item played when hitting the last credits (which would be
>   after any potential mid- or post-credits scenes).
> - *at first credits marker*: Mark the item played when hitting the first credits (which would be
>   before any potential mid- or post-credits scenes).
> - **earliest between threshold percent and first credits marker**: Use the first credits marker
>   only if it is earlier than the manually set percentage, otherwise use the manually set
>   percentage. **This is the default behavior.**

What the owner actually says, against each half of the claim:

- **"NOT a clock" — CONFIRMED.** Nothing here is time-remaining. It is a percentage, or a marker
  position, or the earlier of the two. The SPEC's wider point — that the time-remaining rule is
  ours and should be argued rather than attributed to the industry — survives intact.
- **"TOGETHER WITH" — CONTRADICTED.** The default is `min(90%, first credits marker)`, and Plex
  spells out the disjunction: "Use the first credits marker only if it is **earlier** than the
  manually set percentage, **otherwise** use the manually set percentage." "Together with" reads
  as a conjunction — both required — which would mean a film with no credits marker never
  completes. Plex says the opposite: "When markers are not available the selected threshold
  percentage will be used."
- **"90%" — CONFIRMED as the default**, and only as a default: it is a per-library admin setting,
  not a constant.

The repo already had this right elsewhere. `docs/research/resolve-counter-signals.md` records it as
"percentage (90%) `min`'d with a credits marker", which is accurate. The SPEC prose lost the `min`
in the retelling.

**Correct wording:** "Plex completes at the EARLIER of a 90% default threshold and the first
credits marker, both admin-configurable, falling back to the percentage where no marker exists."

---

*Sections 7 onward: run date 2026-09-10.*

---

## 7. The plug-in history — ADR 0031 / SPEC

**Claim.** "Plex opened plug-ins, shut the plug-in DIRECTORY in 2018 at under 2% usage while manual
installs kept working, let the legacy agents rot until they broke in 2024-25, and only reopened in
December 2025 as a plain HTTP contract."

**CONFIRMED on all four beats, with one wording correction: the 2024 evidence is a warning, the
breakage evidence is 2025.**

**a) 2018, under 2%, directory only, manual installs kept working.**
https://www.plex.tv/blog/subtitles-and-sunsets-big-improvements-little-housekeeping/ — "Subtitles
and Sunsets: Big Improvements, Little Housekeeping". Fetched 2026-09-10; `datePublished`
2018-09-25T16:51:47+00:00, `dateModified` 2018-11-29T14:23:16+00:00.

> 💀 **Plugins**: This was not a decision taken lightly, as they've been around for a long time, and
> we've had good times both writing and using them. But bluntly, **hardly anyone uses them (less
> than 2% of users)**, the ancient protocol they use is a continued pain for clients to support,
> and if we were to build the feature again, we'd do it very differently in this day and age. […]
> But don't panic — **while the Plugin Directory will soon be gone, you can still manually install
> plugins for the foreseeable future.**

Every element of the ADR's first clause is in that one paragraph: it is the *directory* that shut,
the figure is "less than 2% of users", and manual installs were explicitly preserved.

**b) The users' own reading of the 2% figure**, for what it is worth:
https://forums.plex.tv/t/312587.json — "Plugins removal?", opened 2018-09-26T05:44:59Z. The first
poster: "It might be that only ~2% of the users are using it, but they ARE using it."

**c) Legacy agents.** The rot is documented, and the two dates split as follows.

- *2024 — the warning.* https://forums.plex.tv/t/881510.json — "Please do not switch off legacy
  agents/scanners without a way of adding my own metadata", opened 2024-07-02T15:46:55Z. "I got a
  warning today that the **legacy agents will soon cease to work** and that media items in such
  libraries will no longer receive metadata." A Plex Employee (`hsousa`, 2024-07-03) replies:
  "There will be a way to have alternative metadata agents in Plex before we sunset the legacy
  ones. We will share more on the subject when it's ready." That promise took until December 2025
  to land — which is the ADR's point, and it is better evidence for it than a breakage would be.
- *2025 — the breakage.* https://forums.plex.tv/t/914518.json — "Legacy Agents Removed Already in
  PMS 1.41.7.9717 (2025-04-23)", opened 2025-04-23T21:45:33Z. "I just upgraded to the new beta
  build of PMS (1.41.7.9717) and now when I add new videos to my library their mp4 metadata is no
  longer being read and added to PMS… We knew this was coming, but we were assured that this would
  only happen after being notified in advance." Confirmed in the thread by another user: "it seems
  that the whole interaction between Plex an 3rd party metadata Agents doesn't work at all with the
  new Beta version." A Plex Employee (`Atomatth`) answers: "If you're seeing an issue then it's a
  bug."

So "broke in 2024-25" is defensible as a span but imprecise as a citation: 2024 is when Plex told
users it was coming, 2025-04 is when it actually stopped working. **Suggested tightening:** "warned
in 2024 and broken in 2025".

**d) December 2025, a plain HTTP contract.**
https://forums.plex.tv/t/934384.json — "[Announcement] Custom Metadata Providers", posted
2025-12-09T16:15:33Z by `drzoidberg33`, flagged **Plex Employee**.

> Many of you know that we removed the old Plug-ins system from Plex Media Server (PMS) many years
> ago but have kept the legacy metadata agents which use this system around until we had a suitable
> replacement for those. […] The nomenclature is slightly updated with the introduction of
> "metadata providers," these are as the name suggests, providers of metadata, and are **just an
> HTTP API that returns metadata for library items in a standardized way** […] **Developers are not
> restricted by any one language or technology to write these providers, essentially anything that
> can serve an HTTP API can be used.** Distribution to users can also happen in any way you see fit,
> from local Docker containers, to self-contained binaries or publicly hosted on the internet.
> **All the user needs to install a metadata provider is a single URL** that their system can
> access.

"A plain HTTP contract" is exact, and "all the user needs is a single URL" is the same design
CanonCore records as *a provider is a URL*. Worth adding to the ADR as corroboration rather than
coincidence. Plex also states: "We plan to completely remove the legacy agents system from new PMS
releases in 2026", and lists as current gaps that only Movie and TV libraries are supported, only
unauthenticated requests work, stream/subtitle metadata is unimplemented, and provider-specific
preferences are unimplemented.

---

## 8. The view log and the state row — ADR 0019 / SPEC

**Claim.** "Plex does keep a view log — `metadata_item_views`, one row per viewing with its own
timestamp and device — and then ships **no feature that reads it** and a privacy control that
deletes it wholesale", while state lives in a separate row; "neither incumbent can tell you that
you watched something three times, or when."

**Split verdict. The schema half is CONFIRMED exactly. The "no feature reads it" half is
CONTRADICTED: Plex ships three Dashboard surfaces over it, one of which is literally a rewatch
count.**

### a) The two tables — CONFIRMED

https://forums.plex.tv/t/723488.json — "Move ViewHistory from One Install to Another", post 12 by
`Volts`, 2021-06-19T22:17:45Z, pasting the DDL out of a real PMS database (server 1.23.5.4702).
Fetched 2026-09-10.

> The structure for `metadata_item_views` is different from `metadata_item_settings`.
>
> ```sql
> CREATE TABLE IF NOT EXISTS "metadata_item_views" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
> "account_id" integer, "guid" varchar(255), "metadata_type" integer, "library_section_id" integer,
> "grandparent_title" varchar(255), "parent_index" integer, "parent_title" varchar(255),
> "index" integer, "title" varchar(255), "thumb_url" varchar(255), "viewed_at" datetime,
> 'grandparent_guid' varchar(255), 'originally_available_at' datetime, 'device_id' integer);
>
> CREATE TABLE IF NOT EXISTS "metadata_item_settings" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT
> NULL, "account_id" integer, "guid" varchar(255), "rating" float, "view_offset" integer,
> "view_count" integer, "last_viewed_at" datetime, "created_at" datetime, "updated_at" datetime,
> "skip_count" integer DEFAULT 0, "last_skipped_at" datetime DEFAULT NULL, "changed_at" integer(8)
> DEFAULT 0, 'extra_data' varchar(255), 'last_rated_at' datetime);
> ```

Every element of the SPEC's parenthesis is a column: `viewed_at` is the per-viewing timestamp,
`device_id` is the device. The state row is the other one: `view_count`, `view_offset`,
`last_viewed_at`. Corroborated by this repo's own `docs/research/plex-schema-dumps/` (a July 2025
or later build: `sqlite_tables.txt:56-57`, `pg_tables.txt:37-38`, `ml_tables.txt:56-57` all carry
both tables) and by Plex's own migration ladder in `migrations.tsv`, which migrates
`metadata_item_views.viewed_at` (`202205091600`) and `metadata_item_settings.last_viewed_at`
(`202204252330`) as separate steps.

A **Plex Employee** confirms the log's append-only intent:
https://forums.plex.tv/t/796327.json — "Stop storing Metadata in dashboard metadata_item_views
database table", 2022-06-09. `drzoidberg33` (flagged *Plex Employee*): "I believe this is
specifically done this way because **metadata items can get deleted but the history doesn't**."
The same thread's opening post: "The database table `metadata_item_views` **stores the view
history**."

### b) "Ships no feature that reads it" — CONTRADICTED

The same opening post, unchallenged by the Plex Employee who answered it, names the reader:

> When you use the **dashboard or the dash app to display the play history** for a movie, tv show,
> episode etc… **plex will query this table and display that information to the admin.**

And Plex's own documentation describes three Dashboard surfaces over it.
https://support.plex.tv/articles/200871837-status-and-dashboard/ — "Server Status and Dashboard".
Fetched 2026-09-10; `dateModified` 2023-11-27T18:39:58+00:00 ("Last modified on: November 27,
2023").

> **Play History (Plex Pass)** — Play History displays the historical amount of time users have
> spent playing items over the selected time frame. It can be filtered by media type as well as by
> individual user. […] Click on **"View Full History" to see a detailed sortable list of
> information.**
>
> **Top Played (Plex Pass)** — In the Top Played section, you can see quick information about the
> most "popular" (i.e. most commonly played) things for each media type. This shows both **the
> number of times an item has been played in total** as well as how many different users played it.
> You can adjust the time frame for the data being displayed.

That is fatal to two sentences as written:

- **"ships no feature that reads it"** — it ships at least *View Full History* (a per-viewing list)
  and *Top Played* (an aggregate over the log), both behind Plex Pass.
- **"neither incumbent can tell you that you watched something three times, or when"** — *Top
  Played* answers "three times" and *View Full History* answers "when". A third-party corroboration
  of the log being the source: https://forums.plex.tv/t/936455.json, 2026-02-17, where a user
  reports "duplicate played history on the dashboard" caused by `metadata_item_views` joining on a
  non-unique `guid`.

**What survives, and it is the argument the ADR actually needs.** The log exists but nothing is
*built on it as a product surface* for the viewer: it is an **admin** Dashboard, **Plex Pass only**,
scoped to time-windowed usage reporting rather than to a person's own rewatch history, and the
denormalised copies in the log go stale (the whole subject of topic 796327 — a row keeps the title
that was correct at view time and "NEVER gets updated"). The SPEC's own adjacent sentence — "what is
absent everywhere is a product surface built on one" — is the defensible claim; the two absolutes
around it are not.

**Correct wording:** "Plex keeps a per-viewing log (`metadata_item_views`, with `viewed_at` and
`device_id`) but reads it only from a Plex Pass admin Dashboard as time-windowed usage reporting,
never as a viewer-facing history; and a privacy control deletes it wholesale."

### c) "A privacy control that deletes it wholesale" — CONFIRMED

https://support.plex.tv/articles/sync-watch-state-and-ratings/ — "Sync Watch State and Ratings".
Fetched 2026-09-10; `datePublished` 2022-07-20T15:33:50+00:00, `dateModified`
2025-03-24T14:06:47+00:00.

> **Delete Data** — If you wish to remove this synced data stored on Plex the option to do so is in
> the Privacy settings for your account […] You will have the options to delete your **Watch
> History** and delete **Watch State & Ratings**.
>
> **Delete Watch History** — **This action will delete your entire Watch History.** This includes
> any watched activities visible to others on your Profile or via their activity feed. The watch
> counts on your profile will also be reset to zero. […] **This will not stop new watch history
> from being created, nor will it change the watch state.**
>
> **Delete Watch State & Ratings** — […] **Please note: This will not delete the Watched State &
> Ratings stored on Personal Media Servers, or your Watch History.**

Wholesale is right — there is no per-item or date-ranged option, only "delete your entire Watch
History" behind two confirmations. Note the precise scope, which the ADR should not overstate: this
control is on the **Plex account**, and Plex says explicitly it does not touch what is stored on
personal media servers. It is nonetheless a genuine independent confirmation of the ADR's structural
point, because Plex documents the log and the state as **two separately deletable stores** —
deleting one is documented as not changing the other, which is only meaningful if they are the two
different things ADR 0019 says they are.

---

## 9. Artwork is locked per role — ADR 0038 / SPEC

**Claim.** "`is_default` is per (item, role), which is how Plex locks `thumb`, `art` and
`clearLogo` separately."

**CONFIRMED, and the role list is longer than three.**

**a) Per-field locks exist and are what survives a refresh.**
https://support.plex.tv/articles/201272763-edit-details/ — "Edit Details". Fetched 2026-09-10;
`datePublished` 2013-12-08T13:33:57+00:00, `dateModified` 2026-08-19T14:34:34+00:00 (a live page,
edited three weeks before this run).

> Fields set to locked when manual changes are made indicated by the change of field title color
> and lock icon being a closed lock. **Locked fields will not update on metadata refreshes.**
> Unlock a field by clicking on the field title.
>
> **Change Artwork** — There are various types of artwork that can be changed depending on the type
> of media it is. Some of the types include **Posters/Thumbnails, Backgrounds, Title Art/Logo and
> Square Art**.

**b) The lock is addressed per artwork role by name, over the wire.**
https://forums.plex.tv/t/934177.json — "Logo - unselect image does not stick and returns upon a
metadata refresh", opened 2025-12-03. Post 6 by `dokuro`, 2025-12-08T11:48:00Z, pasting his own PMS
request log:

> ```
> DELETE /library/metadata/17857/clearLogo
> PUT /library/sections/2/all?clearLogo.locked=1&id=17857&type=2
> ```

`thumb.locked` and `art.locked` are the same shape and are all over the forum — e.g.
https://forums.plex.tv/t/680657 (2021-01-21): "`…/library/sections/1/all?type=1&thumb.locked=0…`
`…/library/sections/1/all?type=1&art.locked=0…` I guess 'thumb' is for Posters and 'art' is for…";
and https://forums.plex.tv/t/933825 (2025-12-07), which sets `{'thumb.locked': 0, 'art.locked': 0,
'banner.locked': 0}` in one call. So the lockable artwork roles observed are at least **thumb, art,
banner, clearLogo and squareArt** — the ADR names three of five, which understates rather than
misstates.

**c) A Plex Employee confirms the semantics in the same thread**, and — worth recording, because it
is direct support for ADR 0024 — confirms that the lock does not actually hold for two of those
roles. `Atomatth`, flagged **Plex Employee**, 2025-12-03 and 2025-12-08:

> "Nope… **the logo is still locked but it's still grabbing the first logo after a refresh.**"
>
> "This issue also happens for squareArt as well as logo." — "Yup just confirmed the same." […]
> "For clarity, posters and backgrounds after being deleted (**the delete call should also lock
> it**, so no need for the additional lock call) and then refreshing metadata will select a screen
> capture of the content. This is expected behavior because PMS wants to show something for these
> asset fields."

That is Plex's own staff, in December 2025, confirming a pinned artwork role being overwritten by
the next refresh. ADR 0024's sentence — "a pin the next refresh silently overwrites is not a pin" —
has a current, staff-acknowledged instance behind it, not only the 2011 thread.

---

## 10. "Set back after changing direction of Agents", since 2011, open in 2026 — ADR 0024 / SPEC

**Claim.** "The longest-running complaint against Plex's artwork picker, live since 2011 and still
open in 2026, in its users' own words: 'set back after changing direction of Agents'."

**Three parts, three verdicts: the quote is CONFIRMED but second-hand; "since 2011" is UNFOUNDED;
"still open in 2026" is CONFIRMED and is the strongest part of the claim.**

### a) The quote — CONFIRMED as quoted, but its own source is dead

https://forums.plex.tv/t/34002.json — "Request: Locked Posters", opened 2013-05-08T14:09:31Z by
`snickers_1`, last post 2018-03-04, 10 posts. Fetched 2026-09-10. The words appear as the slug of a
link in the opening post:

> `https://plexapp.lighthouseapp.com/projects/14382-plex/tickets/1450-bug-Already-changededited-Posters-set-back-after-changing-direction-of-Agents`

So the phrase is a **ticket title on Plex's own former issue tracker**, reproduced here as a URL.
`plexapp.lighthouseapp.com` no longer resolves (Lighthouse was retired), so the ticket cannot be
read. What can be read is the same complaint in the same thread in the same user's own prose, and
this is the better quotation for the ADR because it is directly retrievable:

> "there is no locked-function for Posters, like it is for other Informations (Genre etc.). **So the
> Posters are constantly switching, even if a have manually select another one.** This makes the
> whole 'Poster-change-feature' completely useless. **I have changed the Posters for about 300
> Movies, just to see that everyone was set back a few days later.**"

And, in post 7 (2013-05-10), the trigger the ADR's carve-out is actually about:

> "the first time, when the 300 Posters has changed, **it was definitely after changing the order of
> the Freebase-Agents**."

That sentence is a live, fetchable, first-hand statement that a **source-order change re-picked
pinned artwork**, which is precisely what ADR 0024 refuses. It should replace the dead-tracker slug
in the ADR.

### b) "Live since 2011" — UNFOUNDED

The only support is the same 2013 poster's own aside: "btw. this feature is already requested many
times (in the non-plexpass Forum). **The first time is from february 2011 (!!)**", followed by four
`forums.plexapp.com/index.php/topic/...` links. That host is dead too. So 2011 rests on one user's
recollection in 2013 about a forum that no longer exists, with nothing retrievable behind it.

**What would settle it:** a Wayback capture of `forums.plexapp.com` topic 23258 ("Lock Artwork
button in PMS") or lighthouseapp ticket 1450 carrying a 2011 date. I attempted the Wayback CDX API
during this run and it returned HTTP 429 (rate limited), so this is unresolved rather than
disproved. Until someone pulls that capture, the honest form is **"live since at least 2013"**,
which is fully evidenced above and loses nothing rhetorically.

### c) "Still open in 2026" — CONFIRMED, with room to spare

Fetched 2026-09-10, all `forums.plex.tv/t/<id>.json`:

- **t/936022** "Stop Plex from Overriding MY meta/naming/posters", opened 2026-02-03: "I've posted
  this over two years ago and never got any help and **it's still an on-going issue**. […] I have
  gone through my library of nearly 6000 movies and have altered/adjusted tags and changed the
  posters to what I want them to be. However, periodically I come back and **they're all changed
  again**."
- **t/936053** "Refresh all metadata – but no posters, please", opened 2026-02-04, server
  1.42.2.10156: "I do not want these posters to change at all. But **there seems to be no reliable
  way to prevent this** when refreshing all metadata."
- **t/932206** "Posters Reset", opened 2025-10-06: "**I thought Plex had sorted out this issue of
  messing with people's posters.** In fact my posters were rarely ever changed […] because I knew
  the 'pick one' trick to lock them and did that, but **that didn't save me this time.**"
- **t/870858** "Stop. Changing. My. Posters", opened 2024-02-29, **201 posts**, last post
  2025-07-21.
- And section 9 above: a **Plex Employee** confirming in December 2025 that a locked `clearLogo`
  and `squareArt` are still overwritten on refresh.

### d) A correction to this repo's earlier research

`docs/research/resolution/resolve-X7-X13.md` calls post 6 of that thread "**A Plex staff reply**".
The Discourse JSON gives post 6's author `mmccurdy` the `user_title` **"Plex Pass"**, not "Plex
Employee" — the same flair as the complainants. The quote itself ("This is already the default
behavior. In fact *all* posters, once initially set (even automatically by an agent), should not be
updated on subsequent scans/refreshes. What you guys are reporting here sounds like a bug to me. I
can't reproduce it") is verbatim and accurate; only the attribution to staff is unsupported by the
forum's own flagging. This is the same failure mode as section 2 above: the forum flags employees,
and it does not flag him.

---

## 11. The analysis pass and MediaInfo — ADR 0042 / SPEC

**Claim.** "Plex runs a distinct analysis pass storing exactly these fields ['to help determine
whether (and how) content can be played'] and ships MediaInfo alongside its own transcoder."

**CONFIRMED on both halves, including the SPEC's quotation, verbatim.**

**a) A distinct analysis pass, and the field list.**
https://support.plex.tv/articles/200289336-analyze-media/ — "Analyze Media". Fetched 2026-09-10;
`datePublished` 2013-09-22T08:41:56+00:00, `dateModified` 2019-04-16T21:30:55+00:00.

> **What Happens During Analysis?** — Whenever an item is added to one of your Libraries, the Plex
> Media Server performs some analysis on it to gather information.
>
> **Gather Media Properties** — The primary purpose of media analysis is to gather information about
> that media item. […] Useful properties of your media might include (but not be limited to) things
> such as:
> - **Container**: MP4, MKV, AVI, M4A, etc.
> - **Video Codec**: H.264, MPEG-2, VC-1, DivX, Xvid, etc.
> - **Audio Codec**: AAC, MP3, AC3, DTS, etc.
> - **Resolution**
> - **Duration**
> - **Bitrate**
> - Aspect Ratio
> - Language
>
> Why, though? What use are these media properties? Your Server, together with your Plex Apps, can
> use this information **to help determine whether (and how) content can be played.**

The SPEC's quoted fragment is exact. Two precision notes for the ADR: Plex's list is a **superset**
of the five CanonCore names (it adds aspect ratio and language) and Plex hedges it with "but not be
limited to", so "storing **exactly** these fields" overstates a match that is really "all five of
ours, plus more". And the pass is distinct in Plex's sense too — it is separately invocable
("Libraries menu → `…` → **Analyze**") and re-run when a new server version changes analysis
capability.

The same article also confirms the ADR's neighbouring design refusals are real trade-offs rather
than hypotheticals: Plex's analysis pass *also* generates default artwork from the video ("a
background image will be pulled out as well as a smaller image to be used for poster/thumbnail type
purposes") and video preview thumbnails ("a CPU-intensive process akin to transcoding the file") —
both of which CanonCore's pass declines to do.

**b) MediaInfo alongside its own transcoder — CONFIRMED, from Plex's own licence page, in one
list.**
https://support.plex.tv/articles/204096476-license-information/ — "License Information". Fetched
2026-09-10; `datePublished` 2014-12-23T17:12:58+00:00, `dateModified` 2021-05-15T06:11:31+00:00.
Under the heading **Plex Media Server**:

> MediaInfo – **BSD-2-Clause-FreeBSD**
> […]
> **'Plex New Transcoder' contains code from FFmpeg** – LGPL-2.1+

Both entries are under the same product heading, which is the claim exactly: MediaInfo is shipped
*in the server*, next to a named in-house transcoder built on FFmpeg. It also independently
confirms ADR 0042's licence statement — Plex lists MediaInfo as **BSD-2-Clause**, which is the
licence the ADR relies on.

**c) Plex distinguishes its own analysis from the MediaInfo tool**, which is worth knowing before
quoting this as "Plex uses MediaInfo for everything".
https://support.plex.tv/articles/201998867-investigate-media-information-and-formats/ — "Investigate
Media Information and Formats". Fetched 2026-09-10; `dateModified` 2020-04-16T01:30:25+00:00.

> **Note**: While the MediaInfo app can provide useful information to you, **it does not analyze
> media in the same way that Plex Media Server does**, so there may be differences in the reported
> information. The information shown within Plex is the actual info used by the server.

That is about the standalone **MediaInfo application** a user might run, not about the bundled
library, so it does not contradict (b). But it means the precedent ADR 0042 draws is "Plex ships
MediaInfo in the server", not "Plex's media analysis is MediaInfo's output".

---

## 12. "Eleven headers, of which X-Plex-Provides matters most" — ADR 0043 / SPEC

**Claim.** "Plex sends eleven headers of which `X-Plex-Provides` matters most" — and, in the SPEC,
that it is "the device saying what it can do", "what lets the server name the property that failed
instead of failing at play time", and "what casting from phone to TV depends on".

**"Eleven" is CONFIRMED exactly. "Of which `X-Plex-Provides`" is CONTRADICTED: it is not one of the
eleven, and it is not a codec-capability declaration. The capability channel Plex actually documents
for the direct-play decision is `X-Plex-Client-Profile-Name` / `X-Plex-Client-Profile-Extra`.**

### a) Eleven — CONFIRMED, and it is Plex's own table

https://developer.plex.tv/pms/ — "Plex Media Server", the official OpenAPI reference
(`info.version` "1.2.2"). Fetched 2026-09-10; the page publishes no date, so the spec version is
the only stamp available.

> **Headers** — PMS accept a variety of custom headers that follow the pattern `X-Plex-{name}`. **The
> full set of headers isn't enumerated here** since some may only apply to certain endpoints, but
> **common headers that can be included on all requests** include:

| Header | Description | Sample |
| --- | --- | --- |
| `X-Plex-Client-Identifier` | An opaque identifier unique to the client | abc123 |
| `X-Plex-Token` | An authentication token, obtained from plex.tv | XXXXXXXXXXXX |
| `X-Plex-Product` | The name of the client product | Plex for Roku |
| `X-Plex-Version` | The version of the client application | 2.4.1 |
| `X-Plex-Platform` | The platform of the client | Roku |
| `X-Plex-Platform-Version` | The version of the platform | 4.3 build 1057 |
| `X-Plex-Device` | A relatively friendly name for the client device | Roku 3 |
| `X-Plex-Model` | A potentially less friendly identifier for the device model | 4200X |
| `X-Plex-Device-Vendor` | The device vendor | Roku |
| `X-Plex-Device-Name` | A friendly name for the client | Living Room TV |
| `X-Plex-Marketplace` | The marketplace on which the client application is distributed | googlePlay |

That is **eleven rows**, which is where the number in the ADR comes from. Plex adds: "`X-Plex-Client-
Identifier` is typically required, as is `X-Plex-Token` for authentication", and "all `X-Plex-`
headers can also be sent as query string arguments."

### b) `X-Plex-Provides` is not among them — CONTRADICTED

`X-Plex-Provides` **does not appear anywhere on `developer.plex.tv/pms/`**. I grepped the whole
rendered document (5.1MB) for `X-Plex-[A-Za-z-]+` on 2026-09-10; the twenty-two distinct headers it
names are `Activity, Client-Identifier, Client-Profile-Extra, Client-Profile-Name,
Container-Focus-Key, Container-Size, Container-Start, Container-Total-Size, Country, Device,
Device-Name, Device-Vendor, Language, Marketplace, Model, Platform, Platform-Version, Pms-Api-Version,
Product, Session-Identifier, Token, Version`. `Provides` is not one of them.

So the ADR's phrasing joins two true-ish facts into a false one. The eleven are all **identity and
description**: who the client is, what it is called, where it came from. None of them is a
capability declaration. `X-Plex-Provides` is real — it is all over live PMS request logs — but it is
outside the documented eleven.

### c) What `X-Plex-Provides` actually declares: roles, not codecs

Every observed value is a list of **roles the device can play in the Plex topology**, never a codec
or container. All fetched 2026-09-10 from `forums.plex.tv/t/<id>.json`:

- **t/819563** (2023-01-14): "iPhone: `X-Plex-Provides: client,controller,sync-target,player,
  pubsub-player,provider-playback`"
- **t/814468** (2022-10-11, Plexamp, from a PMS log): "`X-Plex-Provides = > client,player,
  pubsub-player`"
- **t/439585** (2019-07-30, from a PMS log): "`X-Plex-Provides = > player,pubsub-player,controller`"
- **t/927617** (2025-07-31, a third-party app): "`X-Plex-Provides = > controller`"
- **t/894285** (2024-11-03, ChuckPa's server-claim script): `-H "X-Plex-Provides: server"`

So the SPEC's "what casting from phone to TV depends on" is **right** — `controller` and `player`
are exactly the cast relationship. But "the device saying what it can do" in the codec sense, and
"what lets the server name the property that failed instead of failing at play time", is **wrong**:
`provides=player` says a device can be a playback target, not which codecs it decodes.

### d) The real capability channel, from the same document

`developer.plex.tv/pms/`, section **API-Info → Profile Augmentations**, and the header table on the
universal-transcode endpoint:

> `X-Plex-Client-Profile-Name` — "**Which built in Client Profile to use in the decision.** Generally
> should only be used to specify the Generic profile." Example: `generic`.
>
> **Profile Augmentations** — "The universal transcode endpoint supports the following header or
> query string parameter: `X-Plex-Client-Profile-Extra`. […] `<Verb> ::= "add-direct-play-profile" |
> "add-limitation" | "add-transcode-target-codec" | "append-transcode-target-codec" |
> "add-transcode-target" | "add-settings"`"
>
> **add-direct-play-profile** — "This directive augments the set of **Direct Play** profiles in the
> client profile. The following parameters are required: `type` = "videoProfile" | "musicProfile" |
> "photoProfile" | "subtitleProfile"; `container` = * or a comma-separated list of containers;
> `videoCodec` = …; `audioCodec` = …; `subtitleCodec` = …"

Plex's documented sample value makes the point on its own:
`add-limitation(scope=videoCodec&scopeName=*&type=upperBound&name=video.frameRate&value=60&replace=true)+append-transcode-target-codec(type=videoProfile&context=streaming&videoCodec=h264,hevc&audioCodec=aac&protocol=dash)`

And Plex's decision responses name the failing property in exactly the way the SPEC wants — the
docs' own example: `"directPlayDecisionText": "App cannot direct play this item. Direct play is
disabled."`, `"generalDecisionText": "Direct play not available; Conversion OK."` That behaviour
comes from the client **profile**, not from `Provides`.

**Correct wording:** "Plex documents eleven common headers, all of them client identity; the
capability declaration that decides direct play is a separate channel — a named client profile
(`X-Plex-Client-Profile-Name`) plus per-request augmentations (`X-Plex-Client-Profile-Extra`) that
add direct-play profiles and codec limitations. `X-Plex-Provides` is a *role* declaration
(`player`, `controller`, `server`, `sync-target`) and is what casting depends on."

This does not weaken ADR 0043 — it strengthens it. The market leader treats "what this device can
decode" as a first-class, structured, per-request declaration with its own grammar, which is a
better precedent for "the capability declaration is load-bearing" than a role list would have been.

---

## 13. Completion compares against the children you happen to own — ADR 0060 / SPEC (and ADR 0003)

**Claim.** "Plex compares watched children against the children that exist only because you own a
file, so owning three episodes of a thirteen-episode season and watching them reports the season
fully watched."

**CONFIRMED, as a two-step chain both of whose steps come from Plex. Plex nowhere states the
conclusion in those words, so record it as an inference with its premises named rather than as a
quotation.**

**Step 1 — the container's state is computed from the unwatched count of the episodes in the
library.** https://support.plex.tv/articles/201018487-mark-as-watched-or-unwatched/ — "Mark as
Watched or Unwatched". Fetched 2026-09-10; `datePublished` 2013-12-08T13:35:15+00:00, `dateModified`
2024-12-05T19:44:37+00:00.

> **Unwatched** — For movies and individual episodes content that has not been watched does not have
> any particular indicator. Instead, the **lack** of a progress bar or a watched label indicates that
> the item has not been watched. **For TV, if looking at a show or season poster, then it will
> display the number of unwatched episodes.**

There is no other quantity: a season is "done" when its unwatched count reaches zero, and that count
is over episodes the server has.

**Step 2 — Plex has no representation of an episode you do not own.** This is the twelve-year-old,
still-open feature request for one. https://forums.plex.tv/t/77834.json — "Option to show MISSING
seasons and episodes", opened 2014-09-29T14:35:09Z, **90 posts**, last post 2026-08-16T03:58:19Z.
Fetched 2026-09-10.

> (opening post, 2014) "every time I go into a episode 'folder' I have to carefully look if there
> are missing ones before starting to watch anything […] It would be so much easier if there was an
> option in Plex […] **The missing episodes could be just listed as normal ones that are not
> missing, but un-selectable and faded out** […] These sources already know how many episodes are in
> what season."
>
> (post 87, 2025-12-09) "**After 11 years and a zillion duplicate threads, how is this still not a
> thing?**"
>
> (post 88, 2026-02-18) "It is also very high in the most voted list, any idea why this hasn't been
> implemented yet?"
>
> (post 90, 2026-08-16) "This is incredibly useful in jellyfin and should be in plex as well."

A second, independent thread makes the same absence visible from the playback side:
https://forums.plex.tv/t/153862.json — "REQ: Insert placeholders or track missing TV episodes and
stop autoplay", 2016-08-05: "If we watch episode 1 and it finishes, but episode 2 is not downloaded
yet, **Plex will autoplay the next unwatched episode. Could be episode 3 or episode 12.** […] We
watched Silicon Valley that I thought was complete but actually was missing 3 episodes. We were very
confused/lost on some of the later episodes."

Put the two together and the ADR's sentence follows necessarily: the denominator is the episodes on
disk, the missing ones are not rows at all, so three of thirteen watched is three of three watched.
Plex's own metadata agent knows the season has thirteen — that is the last poster's complaint in
2014, "these sources already know how many episodes are in what season" — and Plex declines to
materialise them. That is the exact gap ADR 0060 fills by making extent a **statement** rather than a
count of rows.

**Bonus: ADR 0003's "in both, an item cannot exist without a file" — CONFIRMED for Plex** by the same
two threads. Twelve years of users asking for an entry with no file behind it, and the answer is
still no. (The Jellyfin half of ADR 0003 is out of scope for this file; ADR 0060 already records
that Jellyfin materialises the missing parts and then excludes them from the percentage, which is a
different failure and is not checked here.)

---

## 14. "Reversed medium typing on 2025-07-16" — ADR 0010 / SPEC

**Claim.** "A group is also never typed by medium: Plex ran that argument on real users and reversed
it on 2025-07-16, in its own words, 'in hindsight, we recognize this wasn't the right approach'."

**Quote, date and attribution CONFIRMED verbatim. But what Plex reversed was medium-typed *apps*,
not medium-typed *libraries* — the libraries are still typed, and the SPEC's separate claim that the
typing repeats at every level below is also CONFIRMED. The ADR as worded invites the wrong reading.**

**a) The reversal — CONFIRMED.**
https://forums.plex.tv/t/926067.json — "Music & Photos are BACK! Check them out in the new Roku
Preview!", posted **2025-07-16T11:39:13Z** by `PlexInfo`, flagged **Plex Employee**. Fetched
2026-09-10.

> **Music and Photos are coming BACK to the Plex app**
>
> In the second half of 2024, we shared our plans to create a new experience in the Plex app,
> focused solely on movies, shows, and Live TV. We also rolled out a dedicated companion app for
> photos, Plex Photos, and migrated all support for music collections to our custom music player,
> Plexamp. We intended to better cater to the needs of our users, ensuring that **each app is
> focused on its specific media type**.
>
> Since then, we've shipped our new app experience on mobile and started the TV preview release.
> The feedback that we received immediately thereafter and since was loud and clear. **In hindsight,
> we recognize this wasn't the right approach.** Many of you let us know that you'd prefer to keep
> music and photos in the Plex app, instead of accessing this functionality in companion apps.
>
> **We listened. We learned. We are adjusting.**

**b) What was reversed.** The thing being undone is the September 2024 plan:
https://www.plex.tv/blog/the-future-of-plex-focused-streamlined-and-ready-for-feedback/ — "The
Future of Plex: Focused, Streamlined, and Ready for Feedback". Fetched 2026-09-10; `datePublished`
2024-09-12T14:03:32+00:00.

> "As we continue to streamline the Plex app […] **we will be migrating music and photos support to
> their own dedicated companion applications.**" […] "Currently, **music playback is utilized by only
> 2.5% of our users, while photos are accessed by just 0.2%** on a monthly basis." […] "**The success
> of Plexamp has shown us the benefits of focusing on specific media types.**"

So this is Plex splitting the **client application** by medium, on a usage argument, and then
withdrawing it ten months later after user feedback. It is a genuinely on-point precedent for ADR
0010 — the argument Plex ran and lost is "media types want separate containers" — but it is about
apps, not about the library type or the group table.

**c) Plex's medium typing of libraries and containers was NOT reversed, and the SPEC is right that
it repeats at every level.** From the official API reference (https://developer.plex.tv/pms/,
`info.version` "1.2.2", fetched 2026-09-10):

> `playlistType` — `{"type":"string","enum":["audio","video","photo"],"description":"The type of the
> playlist."}`
>
> PlayQueue creation, `type` — `{"type":"string","enum":["audio","video","photo"],"required":true,
> "description":"The type of play queue to create"}`

A playlist carries a medium; a play queue **must** be created with one. Combined with the library
type and the per-collection subtype, that is the SPEC's "whole stack, not the library type alone",
and it is still exactly how Plex works in 2026. The July 2025 reversal changed which app renders
them, not how they are typed.

**Correct wording for ADR 0010:** "Plex split its *clients* by medium on a usage argument in
September 2024 and reversed it on 2025-07-16 — 'in hindsight, we recognize this wasn't the right
approach'. Its *libraries*, playlists and play queues remain medium-typed to this day, which is the
partition CanonCore refuses."

---

## 15. "A library language change cannot retroactively update existing titles" — ADR 0014 / SPEC

**Claim.** "Plex concedes a library language change 'cannot retroactively update' existing titles."

**CONFIRMED verbatim, from Plex's own support documentation.**

https://support.plex.tv/articles/200289266-editing-libraries/ — "Editing Libraries". Fetched
2026-09-10; `datePublished` 2013-09-22T14:37:59+00:00, `dateModified` 2019-07-31T21:52:09+00:00.

> **Language** — The language to use for metadata gathered from the internet. Each Library has a
> Primary Language that controls the information gathered from the Internet. If a Library's language
> is set to French, for example, the French plot summary, etc., will be downloaded when available.
>
> **Note**: While you can change the language for a Library, **you cannot retroactively update the
> language used for existing items. The new language will only apply to newly-added content.**

The quoted fragment is exact. One scoping note: Plex says "existing **items**" and "the language
used", not "titles" specifically — but title is plainly inside the scope ("the French plot summary,
etc."), and the failure ADR 0014 names is the general one, so the ADR's paraphrase is fair.

**The same page also confirms the surrounding shape of the problem**, which is worth having in the
ADR because it is the structural cause rather than a bug: "When editing a Library, you can change
every setting **except the type** (Movie, TV Show, etc.)." A Plex library's language and type are
both properties of the *container*, applied at write time to a single-valued column on the item —
which is precisely why the change cannot be applied backwards. CanonCore's title-as-projection makes
the same change a re-read of statements that were all kept.

**Adjacent and separately confirmed** — the same "write-time, never retroactive" rule applies to the
metadata agent. https://support.plex.tv/articles/200241558-agents/ — "Metadata Agents", fetched
2026-09-10; `dateModified` 2025-11-18T15:41:13+00:00: "**Changing the metadata agent for an existing
library will only affect future content. It does not retroactively change the agent used for
existing library content.**" Two separate settings, one identical concession, ten years apart. That
is a stronger form of the ADR's point than the language note alone.

---

## 16. Smart collections cannot be hand-ordered — SPEC (ADR 0061 area)

**Claim.** "This is the split Plex ships as manual versus smart collections, and its smart
collections cannot be hand-ordered because a smart collection stores a filter rather than a member
list."

**CONFIRMED, including the causal half, in Plex's own words.**

https://support.plex.tv/articles/201273953-collections/ — "Collections". Fetched 2026-09-10;
`datePublished` 2013-12-09T16:49:33+00:00, `dateModified` 2024-12-27T18:35:15+00:00.

> **Custom Collection Order** — The content of regular "dumb" collections can be reordered in any
> arbitrary way the server admin chooses. This requires Plex Web App v4.61.2 or newer. When on the
> collection details page, the posters of items in the collection will have a drag handle on the top
> center when hovering over them. Simply drag-and-drop the items to the desired order. **This is not
> available for "smart" collections, which are always ordered by the sort chosen when creating or
> editing the filter for the smart collection.**

And the reason it stores a filter, stated as the defining behaviour of the smart kind:

> **Creating a Smart Collection** — Creating a "smart" collection is much like creating a smart
> playlist: **Create a filter/sort based on the criteria you wish** […] **Any future items that meet
> the filter criteria will automatically be included and things which no longer meet the criteria
> will no longer be shown in the collection.**

Both halves of the SPEC sentence are Plex's: no hand-ordering for smart, and the ordering is a
property of the saved filter rather than of a stored membership. The SPEC's wider rule — "a
rule-derived container carries NO order, because a rule produces a set, not a sequence" — is exactly
the constraint Plex hit and documented.

Note the one difference worth keeping straight: Plex's *manual* collection is not a member list
either, it is a **tag** — "You can manually create a collection by adding a `Collections` tag to an
item. Add other items to a collection by giving them the same collection tag." Plex hand-orders that
tag's members with a separate stored order. CanonCore's placement row carries the membership and the
order in one object, which is a different (and stronger) shape than either of Plex's.

---

## 17. Cross-library collections match on the name, as a string — ADR 0016 / SPEC

**Claim.** "Plex's cross-library collections […] can only appear to span libraries when the
collections carry the same NAME, matched as strings."

**CONFIRMED verbatim, from the same page.**

https://support.plex.tv/articles/201273953-collections/ — "Collections". Fetched 2026-09-10;
`dateModified` 2024-12-27T18:35:15+00:00.

> **Collections Details Page** — The collections details page contains all the items in that library
> that belong to the collection. **It can also include items from other libraries that are in a
> collection with the exact same name. By adding items in different libraries to identically-named
> collections, you can relate them to each other.** For instance, you can have Star Wars movies, TV
> shows, and music albums all in a "Star Wars" collection so they're related to each other.

"The exact same name" is Plex's phrase, and "identically-named collections" is the mechanism stated
outright. There is no shared id, no join, and no cross-library object: the relation exists because
two strings are equal.

The string-ness goes one level deeper than the ADR says, which strengthens it. A Plex collection is
not an entity that items are added to — it is **a tag written onto each item**:

> **Creating a Manual Collection** — You can manually create a collection by **adding a
> `Collections` tag to an item. Add other items to a collection by giving them the same collection
> tag.** You do this from the library item's Edit Details screen. […] If the collection already
> exists, choose it from the list. If not, **type the name and hit enter**.

So the failure ADR 0016 refuses — "a rule-derived container matching 'everything with category X'
would match a STRING" — is not an incidental limitation of Plex's cross-library feature. It is the
whole data model: rename the collection in one library and the cross-library relation silently
dissolves, because there was never anything but the matching text holding it together. That is the
argument for categories being **items with ids**, and it is stronger stated this way.

---

## 18. PlayQueue carries `playQueueSourceURI`, `playQueueItemID`, `continuous` — ADR 0066 / SPEC

**Claim.** "Plex ships `playQueueSourceURI` and `playQueueItemID` for the same job" — and, in the
wider record, a `continuous` flag.

**CONFIRMED, all three, from the official API reference.** https://developer.plex.tv/pms/,
`info.version` "1.2.2". Fetched 2026-09-10.

- **`playQueueSourceURI`** — `{"type":"string","description":"The original URI used to create the
  play queue."}`
- **`playQueueItemID`** — from the *Create a play queue* endpoint description: "Makes a new play
  queue for a device. The source of the playqueue can either be a URI, or a playlist. The response
  is a media container with the initial items in the queue. **Each item in the queue will be a
  regular item but with `playQueueItemID` — a unique ID since the queue could have repeated items
  with the same `ratingKey`.**"
- **`continuous`** — a query parameter on play-queue creation:
  `{"type":"integer","enum":[0,1],"description":"Whether to create a continuous play queue (e.g.
  from an episode), defaults to 0."}`

**And the rest of the table is the argument for ADR 0066's refusal.** A Plex play queue is not two
fields, it is a stored, versioned object with its own identity and its own drift problem:

- `playQueueID` — "The ID of the play queue, which is used in subsequent requests."
- `playQueueVersion` — "**It increments every time a change is made to the play queue to assist
  clients in knowing when to refresh.**"
- `playQueueSelectedItemID` — "The queue item ID of the currently selected item."
- `playQueueSelectedMetadataItemID` — "The metadata item ID of the currently selected item (matches
  `ratingKey` attribute in metadata item if the media provider is a library)."
- `playQueueTotalCount`, `playQueueShuffled`
- `playQueueLastAddedItemID` — "Defines where the 'Up Next' region starts."
- Creation parameters beyond `continuous`: `shuffle` (0|1), `repeat` — "If the PQ is bigger than the
  window, fill any empty space with wraparound items", `extrasPrefixCount` — "Number of trailers to
  prepend a movie with not including the pre-roll."

`playQueueVersion` existing *at all* is the cost ADR 0066 declines to pay: it exists because the
stored queue and the library can disagree, and clients have to be told when to re-fetch. CanonCore's
"next is DERIVED, never stored" removes the field and the class of bug it exists to manage. That is
a stronger justification than "Plex ships two fields for the same job", and the ADR should say it.

Also worth noting for ADR 0063 / section 14 above: creating a play queue **requires** a medium —
`type`, `{"enum":["audio","video","photo"],"required":true,"description":"The type of play queue to
create"}`. Plex's medium typing reaches all the way into the playback session.

---

## 19. Plex freezes rather than migrates — ADR 0047 / SPEC

**Claim.** "Plex avoids migrating heterogeneous data by FREEZING it. When it changed metadata
providers in 2019, 'existing content will not change by default' and the user opts in per artist."

**CONFIRMED — the year, the quote and the per-artist opt-in. One qualifier the SPEC drops changes
the reading, and it makes the point better, not worse.**

https://support.plex.tv/articles/upgrade-music-libraries-new-metadata-system/ — "Upgrading Music
Libraries to the New Metadata System". Fetched 2026-09-10; `datePublished`
2019-10-02T14:09:53+00:00, `dateModified` **2026-06-09T14:31:11+00:00**.

> **What's Going On With Music Library Upgrades?** — **At the end of June, 2019, we switched metadata
> providers** for some of the metadata we provide. Specifically, this primarily affected electronic
> program guide data for our Live TV & DVR feature as well as metadata available for our "premium"
> music libraries.
>
> **What to Do After You Upgrade** — Once a library has been upgraded, it's important to note two
> things:
> - New content added to the library from this point forward will use the new system.
> - **Existing content will not change by default for now. To upgrade an existing artist (and
>   albums/tracks belonging to the artist), you need to take explicit action to Refresh the
>   content**, as noted below.

And, twice on the same page, once for each library kind:

> "Once the library is upgraded, **nothing is going to change immediately with the content itself**,
> though. Instead, **you'll need to choose to upgrade that content yourself for now**. **In the
> future, we'll have existing content automatically upgrade, but that won't happen to start.**"

**The qualifier.** Plex's sentence is "existing content will not change by default **for now**", and
Plex explicitly framed the freeze as **temporary** — a migration deferred, not a strategy chosen.
The SPEC quotes it without "for now", which reads as a settled design decision.

**The qualifier is worth keeping, because seven years later it is still true.** The page carries a
`dateModified` of 2026-06-09 — Plex was editing this article three months before this run — and it
still says "for now" and still says the automatic upgrade is a future thing. So the honest version
of the ADR's point is sharper than the one it makes: **a freeze announced as temporary is a freeze**.
Plex has run the old and new music semantics side by side, per artist, since 2019, and the promised
migration has not arrived in seven years. That is a better argument for ADR 0047's rule that a
migration should *state* which of the three strategies it uses than "Plex chose to freeze" would be,
because Plex did not choose it: it deferred, and the deferral became the design.

The rest of the SPEC paragraph — "Migrate everything, quarantine what fails, or freeze the old
semantics and let the owner choose — all three are legitimate" — is CanonCore's own framing and is
not a claim about Plex, so nothing to check.

---

## 20. "Merges versions but picks by client decode capability, not by what is canonical" — ADR 0065 / SPEC

**Claim.** "Plex merges versions but picks by what the client can decode rather than by what is
canonical, and its users are still asking for a way to set the one they want."

**CONFIRMED on both halves, with a caveat the ADR should absorb: Plex *does* have a canonical-cut
concept (Editions) — it just does not merge them, which is a different and arguably worse failure.**

**a) The pick is by device suitability — CONFIRMED.**
https://support.plex.tv/articles/200381043-multi-version-movies/ — "Multi-Version Movies". Fetched
2026-09-10; `datePublished` 2013-09-19T04:03:59+00:00, `dateModified` 2022-08-22T17:38:32+00:00.

> **Multiple Versions of the Same Movie** — You can gather multiple versions of the same movie
> together (that have different resolutions or encoding formats) and collapse them to a single item.
> For example, you can have 3 versions: ones suitable for a mobile phone, a tablet, and a 1080p TV.
> The multiple versions will be collapsed to a single item in the library. **When a Plex app goes to
> play the collapsed item, it will automatically request and play the most suitable item by
> default.** Many apps will also allow you to select a `Play Version` action, where you can choose
> which version to play.
>
> **Note**: **Not all Plex apps will allow you to manually choose which version to play. You should
> not rely on a choice being presented.**

"Most suitable item", where suitability is the device — "SD for a phone", "use the best file for a
mobile app". Nothing about which is authoritative. And the manual override is explicitly not
guaranteed to exist, which is the SPEC's point sharpened.

**b) Users are still asking — CONFIRMED, and the thread is six and a half years old.**
https://forums.plex.tv/t/546532.json — "Default Play Version", opened 2020-02-23, last post
**2026-07-26**. Fetched 2026-09-10.

> (2020) "Could a feature be added to allow a player to set a default play version to play when
> multiple versions of a video is available? […] **Right now it seems to always pick the highest
> resolution if multiples exist.**"
>
> (2026-02-03) "Problem is my users often forget to check to see if I have different versions […]
> **I'd love it if I could default everyone to the smaller file vs the bigger one.**"
>
> (2026-07-26) "Came here to request this very feature. **A shame it was requested six and a half
> years ago but was never implemented.**"

Two more, both closed as duplicates of it: https://forums.plex.tv/t/863040.json (2023-12-16)
"Currently, Plex automatically selects a version based on quality and resolution. **However, there
is no option for users to set a default version preference**"; and
https://forums.plex.tv/t/865868.json (2024-01-10) "Currently it picks the best one. If I am on
something I know won't play 4k well, **I have no choice.**"

**c) The caveat: Plex separates "version" from "edition", and does not merge editions at all.**
https://support.plex.tv/articles/multiple-editions/ — "Multiple Editions - Movies". Fetched
2026-09-10; `datePublished` 2022-08-15T18:52:23+00:00, `dateModified` **2026-07-07T17:52:48+00:00**.

> **Versions** all represent the same release of an item. […] **Editions** represent different
> releases of an item. So, the "theatrical release" vs the "Special Edition" of *The Empire Strikes
> Back*. Or "Theatrical" vs "Director's Cut" vs "Final Cut" of *Blade Runner*.
>
> In cases where you have multiple editions of the same movie, **they can all be added to your
> library, where their watched status, user ratings, etc. are all tracked separately.**
>
> **Currently, all editions of a movie you've added to your server will be displayed in the library
> grid** when viewing the library. As such, **most users will prefer to edit each library item to
> choose or provide an appropriate poster, to help differentiate them.**

So Plex's answer to "which cut is canonical" is: they are separate library items, side by side in
the grid, and the workaround Plex itself recommends is to hand-edit posters so you can tell them
apart. That is the **Audiobookshelf failure**, which the SPEC attributes only to Audiobookshelf, not
to Plex. Users are asking for the merge too: https://forums.plex.tv/t/804954.json — "Possibility to
hide editions from grid", opened 2022-08-18, **30 posts**, last post **2026-08-23**; and
https://forums.plex.tv/t/805141.json (2022-08-19) — "**I can't figure out a way to choose the
'default' version showing on the library.** I currently have the Theatrical version of Fellowship of
the ring and the Extended of Two towers and ROTK — which is really bugging me!", answered by a Plex
Ninja with "You'll need to change the poster or displayed title of one or both."

**Correct wording:** "Plex splits the problem in two and gets neither half right. Merged *versions*
(same cut, different encodes) are picked by device suitability with no owner preference — a request
open since 2020-02-23 and still open 2026-07-26. Separate *editions* (different cuts) are not merged
at all: they sit as separate grid entries with separately tracked watch state, and Plex's own advice
is to hand-edit the posters to tell them apart." Per-edition progress is the one thing Plex and
CanonCore agree on; the chooser is the thing only CanonCore has.

---

## 21. "Plex's own API docs give 10 seconds for LAN and WAN" — SPEC

**Claim.** "Save every 10 seconds — the interval Emby's client documentation tells developers to
report at, **the same figure Plex's own API docs give for LAN and WAN**, and what Jellyfin's web
client ships." (The Emby and Jellyfin halves are out of scope for this file.)

**CONFIRMED verbatim — and the same sentence independently confirms the SPEC's next rule, "also
report immediately on any user interaction". One figure the SPEC omits: 20 seconds on cellular.**

https://developer.plex.tv/pms/, endpoint `POST /:/timeline` — "Report media timeline",
`operationId: timelinePostSlash`. `info.version` "1.2.2". Fetched 2026-09-10.

> This endpoint is hit during media playback for an item. **It must be hit whenever the play state
> changes, or in the absence of a play state change, in a regular fashion (generally this means every
> 10 seconds on a LAN/WAN, and every 20 seconds over cellular).**

Three things fall out of that one sentence, all of which the SPEC either says or should:

1. **"10 seconds on a LAN/WAN"** — exactly the SPEC's phrasing, and Plex writes it as one figure
   covering both, not two.
2. **"It must be hit whenever the play state changes"** comes *first* in Plex's sentence, and the
   timer is the fallback "**in the absence of** a play state change". That is the SPEC's "THE TIMER
   IS ONLY HALF OF IT — ALSO REPORT IMMEDIATELY ON ANY USER INTERACTION", stated by the market leader
   in the stronger order: the event is the rule, the timer is the backstop. The SPEC should cite
   this rather than argue the point from first principles.
3. **"every 20 seconds over cellular"** — a network-conditioned relaxation the SPEC does not
   mention. Worth a line if CanonCore ever ships a phone client, which ADR 0055 says it will.

The endpoint's `state` parameter is also worth recording, because it is the vocabulary CanonCore's
progress events need and it is four values, closed:
`{"type":"string","enum":["stopped","buffering","playing","paused"]}`.

---

## 22. "Only Plex ships a split at all" — ADR 0040 / SPEC

**Claim.** "Note what the field actually does here, because the sweep claimed otherwise: only Plex
ships a split at all. Calibre has none, MusicBrainz has eleven merge edit types and zero unmerge,
and Jellyfin's re-points collection references on merge and never re-points them back."

**The Plex half is CONFIRMED. The other three products are outside this file's scope and are NOT
checked here — the "only" is therefore only as good as the sweep it came from.**

https://support.plex.tv/articles/201018248-merge-or-split-items/ — "Merge or Split Items". Fetched
2026-09-10; `datePublished` 2013-12-09T08:49:56+00:00, `dateModified` 2019-02-28T07:27:20+00:00.

> **Split Apart Items** — In some cases "Merged" items can be split apart to reveal the individual
> items. Splitting can be done to: **Movies; TV Shows/Series (not individual episodes); Music
> Artist.** To do this: Open the Merged Item details view → Click the **More…** button in the top
> action bar (ellipses) → Choose **Split Apart** → Confirm the action and the items are split.

So Plex genuinely ships an unmerge, and its scope is worth recording because it is narrower than the
ADR implies: **three kinds of container, and explicitly not individual episodes**. Plex also states
the merge's asymmetry, which is exactly the destruction ADR 0040 is about: "**The first item you
select is what all selected items will be merged into.**" One item's identity survives; the others'
do not, and the article says nothing about what is restored on a split.

**What this file cannot settle.** "Only Plex" is a claim about Calibre, MusicBrainz and Jellyfin, and
this document verifies Plex claims only. **What would settle it:** MusicBrainz's edit-type list
(`musicbrainz.org/doc/Edit_Types`) for the eleven-merges-zero-unmerges count; Calibre's manual for
the absence; and Jellyfin's `MediaBrowser.Controller`/`Emby.Server.Implementations` merge code path
for the collection-reference re-pointing. Until those three are checked with the same rigour, the
sentence should read "**Plex is the only one of the four we checked that ships a split**", which is
both true and defensible.

---

## 23. "Plex's advice is to go merge the files" — ADR 0022 / SPEC

**Claim.** "Both incumbents derive the ordinal from the filename at scan time and neither can correct
a mis-parse, which is where Plex's public retreat comes from: 'we strongly encourage you to instead
use a tool to join/merge'."

**CONFIRMED verbatim, and the surrounding warning is stronger than the quote alone suggests.**

https://support.plex.tv/articles/naming-and-organizing-your-movie-media-files/ — "Naming and
organizing your Movie files". Fetched 2026-09-10; `datePublished` 2019-05-21T17:44:57+00:00,
`dateModified` **2026-05-22T17:09:09+00:00** (a page Plex was editing four months before this run).

> **Movies Split Across Multiple Files**
>
> **Warning!**: While Plex does have **limited support** for content split across multiple files,
> **it is not the expected way to handle content.** Doing this **may negatively impact usage of
> various Plex features** (including, but not limited to, preview thumbnails, chapter images,
> audio/subtitle stream selection across parts, and more). **We recommend users instead join the
> files together.**
>
> […] Name the files as follows: `/Movies/MovieName (release year)/MovieName (release year) –
> Split_Name.ext` Where `Split_Name` is one of the following: `cdX`, `discX`, `diskX`, `dvdX`,
> `partX`, `ptX`.
>
> **Notes**: Not all Plex apps support playback of stacked media; All parts must be of the same file
> format (e.g. all MP4 or all MKV); All parts should have identical audio and subtitle streams in the
> same order; **Only stacks up to 8 parts are supported**; "Other Videos" libraries or those using
> the "Plex Video Files Scanner" do not support stacked content.
>
> Not all features will work correctly when using "split" files. To get a better overall experience,
> **we strongly encourage you to instead use a tool to join/merge the individual files into a single
> video.**

The quote is exact. Two additions the ADR should take:

- **The ordinal really is parsed from the filename**, and from a closed vocabulary of six prefixes
  (`cd`/`disc`/`disk`/`dvd`/`part`/`pt` + a number). There is no field to correct it in, which is the
  ADR's premise stated by the vendor.
- **"Only stacks up to 8 parts are supported."** ADR 0022's worked case is "disc 3 of forty". Plex
  cannot represent that at all. That is a harder failure than a mis-parse and it is a better example
  than the one the ADR uses.

---

## 24. NFO support shipped in PMS v1.43.1, "last holdout", "declined since 2008" — ADR 0039 / SPEC

**Claim.** "It did not survive Plex shipping NFO support in PMS v1.43.1 for portability — Plex was
the last holdout, having declined since 2008, while Kodi, Emby and Jellyfin all read it."

**Version CONFIRMED exactly. "For portability" is CONTRADICTED as Plex's stated reason. "Declined
since 2008" is UNFOUNDED.**

**a) v1.43.1 — CONFIRMED.**
https://support.plex.tv/articles/using-nfo-metadata-files-with-plex/ — "Using NFO Metadata Files with
Plex". Fetched 2026-09-10; `datePublished` **2026-04-08T14:02:19+00:00**, `dateModified`
2026-07-14T14:26:20+00:00.

> **Requires Plex Media Server version 1.43.1 or newer.**
>
> The Plex NFO Agent lets you use locally stored NFO metadata files to populate your movie and TV
> show libraries, rather than relying on online metadata sources. […] The Plex NFO Agent is
> **compliant with the widely used Kodi/XBMC NFO format.**

Note the article was first published **2026-04-08** — five months before this run. The reversal ADR
0039 is built on is very recent, which is worth stating in the ADR rather than leaving implicit.

**b) "For portability" — CONTRADICTED as Plex's own reason.** Plex gives three motivations and
portability is not among them:

> "This is particularly useful for **personal media collections, content not found in online
> databases, or when you simply prefer full control over your metadata**."

The nearest thing to a portability statement is scoped to **rescans on the same server**, not to
moving between servers:

> **Unique IDs and Watch State** — The Plex NFO Agent builds a stable internal identifier (GUID) from
> the IDs present in your NFO files. This means that as long as your NFO files contain consistent
> IDs, **your watch status and play history will be preserved across rescans**.

So "for portability" is CanonCore's reading of why it matters, not Plex's stated reason, and the ADR
should not attribute it to Plex. (It is a *good* reading — but it belongs in the argument, not in
the citation.) Incidentally this passage is direct support for **ADR 0023**: Plex's newest agent
derives item identity from a stable id in a sidecar precisely because its default identity is not
stable across rescans.

**c) "Declined since 2008" — UNFOUNDED.** The earliest NFO-shaped request I can retrieve on Plex's
live forum is https://forums.plex.tv/t/27352.json — "Feature Request: plex-nfo", **2013-01-18**
("let PLEX generate a special 'Plex Info File' […] if you decide to move your films (files and
folder), PLEX can read the info.plex file for faster identifying the correct details"). Other early
ones: t/49995 "Store metadata next to the movie files (e.g. nfo)" (2013-12-15), t/77411 (2014-09-25),
t/191227 (2017-05-07). Nothing from 2008 is reachable: `forums.plexapp.com` is dead and Plex's
Discourse instance does not carry pre-2011 content with original dates intact.

Tracing it inside this repo, the date comes from
`docs/research/competitor-sweep/CONSOLIDATED-FINDINGS.md` §4, "COUNTER-SIGNALS AGAINST
SETTLED REFUSALS" — "The company that has refused sidecar metadata files since 2008 reversed it in
2026" — where **2008 is Plex's founding year**, not
the date of a refusal. That is a rhetorical "since forever", and it reads in the ADR as a citation.

**What would settle it:** a Wayback capture of `forums.plexapp.com` carrying a 2008-dated NFO
request and a Plex reply declining it. **Suggested wording until then:** "Plex declined it for over a
decade — the earliest retrievable request is 2013 — and shipped it in PMS v1.43.1 in April 2026."

**d) "While Kodi, Emby and Jellyfin all read it"** is a claim about three other products and is not
checked in this file. Plex's own article does corroborate one half of it obliquely, by naming the
format it adopted: "compliant with the widely used **Kodi/XBMC NFO format**".

**e) Scope limits worth carrying into ADR 0039**, since the ADR commits the scanner to reading
`.nfo`. Plex's agent, in Plex's words: "**Music NFO support is not currently available**";
"**Multi-part files**: Movies split across multiple files (pt1, pt2) are **not currently supported**
by the NFO Agent"; "**Extras**: NFO metadata for local extras (trailers, behind-the-scenes, etc.) is
not supported"; and "Libraries using this agent **will not work with Syncing Watch State and
Ratings**." The last one is the interesting one: Plex could not make its own NFO identity coexist
with its cloud watch-state sync.

---

## 25. "Plex ships the smaller complete version: one maintenance window, one setting" — SPEC (ADR 0049)

**Claim.** Against Jellyfin's named trigger types and run history: "Plex ships the smaller complete
version: one maintenance window, one setting."

**CONTRADICTED on "one setting". It is one window plus at least eight independently toggleable
tasks, each with its own fixed cadence.**

https://support.plex.tv/articles/201553286-scheduled-tasks/ — "Scheduled Tasks". Fetched 2026-09-10;
`datePublished` 2014-02-24T22:03:28+00:00, `dateModified` 2025-07-31T16:37:12+00:00.

> **Schedule Time** — You can choose the (local to the server) hour at which the background
> maintenance tasks should start and end. **This defaults to starting at 3am and ending at 6am.**

That is the one window, and it is right. But the page then lists the tasks, each a separate setting
with a cadence baked into its own name:

> - **Backup database every three days** — "a backup of your core SQL database file will be created
>   (if it is not already corrupted) […] Up to three backup copies will be kept in a rotating
>   manner."
> - **Optimize database every week**
> - **Remove old bundles every week** — "This task removes the bundle packages associated with items
>   no longer in your library."
> - **Remove old cache files every week**
> - **Refresh local metadata every three days**
> - **Update all libraries during maintenance** — "(Disabled by default.)"
> - **Upgrade media analysis during maintenance** — "We do extensive media analysis on every file to
>   ensure correct playback across the huge range of devices and apps. Occasionally we fix a bug in
>   media analysis, or update things to capture some additional data."
> - **Refresh metadata periodically** — "Over the course of the month, the server will refresh the
>   metadata for musical artists and TV shows in your library."

Plus a scheduling caveat Plex publishes as a Note: "**Due to the way scheduling is calculated, tasks
which occur every three days or every week may not occur for the first time until a few days after
scheduling is enabled.**"

**Correct wording:** "Plex ships one maintenance window (3am–6am by default) and a fixed list of
about eight toggleable tasks with hard-coded cadences — no custom trigger types, no cron, and no run
history. The window is the small idea worth copying; the fixed cadences and the absent run history
are not." The SPEC's actual rule — "THE MINIMUM IS THAT LAST NIGHT'S FAILURE IS VISIBLE" — is
untouched by this and is still a genuine gap in Plex: nothing on this page reports outcomes.

**Bonus, same page — the SPEC's PhotoTranscoder claim, CONFIRMED in substance.** SPEC: "Plex's
separate PhotoTranscoder cache and its weekly sweep exist because it did the opposite."

> **Remove old cache files every week** — "When the **image processor** inside the Plex Media Server
> processes images (e.g. to resize them), **a cached version of the transformed file is kept around
> for quick access later.** This task **cleans up files which were created over a month ago.**"

An unbounded, runtime-discovered derivative image cache with a scheduled sweep — which is exactly the
design CanonCore's "store the stored variant too, so the image store is bounded BY THE CATALOGUE at
design time" avoids. Two precision notes: Plex does not use the name **PhotoTranscoder** on this page
(that is the on-disk folder name, not Plex's documented term), and the sweep is **weekly with a
one-month retention**, not a weekly purge.

---

## 26. "Plex's 'prioritized list of sources'" — SPEC (ADR 0025 / 0038)

**Claim.** The artwork default where nothing is pinned follows the declared source order — "This is
Jellyfin's `ImageFetcherOrder` and Plex's 'prioritized list of sources'."

**CONFIRMED in substance; the quoted phrase is not Plex's wording.** Plex calls it **"Source
Priority"**.

https://support.plex.tv/articles/200241558-agents/ — "Metadata Agents". Fetched 2026-09-10;
`datePublished` 2013-09-24T13:17:51+00:00, `dateModified` 2025-11-18T15:41:13+00:00.

> **Source Priority** — You can adjust the order of the metadata sources, which sets their priority.
> To do so, **grab the "handle" indicator on the left and drag up or down to re-arrange the source
> order.** The priority helps determine from where you get your metadata. For example, in the "Plex
> Movie" metadata agent for movies, **both Fanart.tv and CineMaterial are included as possible
> sources for artwork. If you prefer artwork from Fanart.tv more, then you can put that as a higher
> priority. If a piece of metadata isn't available from your first source, then the agent will
> fallback down the priority list until it finds a source with that information.**

That is CanonCore's declared source order with a fallback chain, in the incumbent, for artwork
specifically. Two things to carry over:

- The quotation marks in the SPEC should go, or the phrase should become **"Source Priority"**.
- The same page states the re-pick trigger that ADR 0024's carve-out has to survive: "**If you adjust
  the agent settings here and wish for the changes to apply to existing library content, you must
  Refresh All Metadata for the library.**" So in Plex a source-order change does *not* re-pick by
  itself — a full refresh does. CanonCore's "re-ordering the source list re-picks the whole
  catalogue" is therefore a **stronger** commitment than Plex's, which makes the pin carve-out more
  load-bearing here than it is there, not less.

---

## 27. "Plex avoids the problem by having no text library type at all" — SPEC

**Claim.** On progress for text media: "Plex avoids the problem by having no text library type at
all, which is not available to us because text is a first-class medium here."

**CONFIRMED, from two independent Plex sources.**

https://support.plex.tv/articles/200241558-agents/ — "Metadata Agents", fetched 2026-09-10:

> **Metadata Agent Types** — There are several types of metadata agent, **which correlate to the
> different library types: Movie; Music (both for Artists and Albums); Shows; Photos.**

And the library-section objects in the official API reference (https://developer.plex.tv/pms/,
`info.version` "1.2.2", fetched 2026-09-10) carry `type` values `movie`, `show`, `artist`, `photo` —
e.g. `{"type":"artist","title":"Music","agent":"tv.plex.agents.music","scanner":"Plex Music"}`. There
is no book, ebook, audiobook or text type anywhere in the enumeration. (Plex's "Other Videos" is a
movie-type library with the Personal Media agent, not a fifth kind.)

Worth noting for the SPEC's wider argument: Plex's September 2024 developer announcement explicitly
framed new media types as a *third-party* job — "Whether you're interested in developing a new app
for **ebooks**, podcasts, or even niche media types, open APIs will provide the tools you need"
(https://www.plex.tv/blog/the-future-of-plex-focused-streamlined-and-ready-for-feedback/,
`datePublished` 2024-09-12). Text is not a thing Plex intends to model itself.

---

## 28. "Plex keeps a marker version too" — SPEC (ADR 0012 / provenance)

**Claim.** On carrying an algorithm version with a derived claim: "MARC's own worked example carries
a version (`deweyclassifierv0.1`) for exactly this reason, and Plex keeps a marker version too."

**CONFIRMED, but the source is python-plexapi's reading of Plex's XML, not a Plex document. Plex's
own OpenAPI reference does not publish the field.**

`python-plexapi`, `plexapi/media.py`, `class Marker` (L1145-1176), fetched from
https://raw.githubusercontent.com/pushingkarmaorg/python-plexapi/master/plexapi/media.py on
2026-09-10:

> ```python
> class Marker(PlexObject):
>     """ Represents a single Marker media tag.
>         Attributes:
>             end (int): The end time of the marker in milliseconds.
>             final (bool): True if the marker is the final credits marker.
>             id (int): The ID of the marker.
>             type (str): The type of marker.
>             start (int): The start time of the marker in milliseconds.
>             version (int): The Plex marker version.
>     """
>     def _loadData(self, data):
>         …
>         attributes = data.find('Attributes')
>         self.version = attributes.attrib.get('version')
> ```

The library reads `version` off a nested `<Attributes>` element on every `<Marker>`, which is only
possible if Plex Media Server emits it. That is good evidence, but it is **third-party evidence about
Plex's wire format**, so it should be cited as such.

**Plex's own reference does not document it.** https://developer.plex.tv/pms/ (`info.version` "1.2.2",
fetched 2026-09-10) gives the Marker schema as
`{"id":integer,"type":{"enum":["intro","commercial","bookmark","resume","credit"]},
"startTimeOffset":integer,"endTimeOffset":integer,"title":string,"color":string}` with
`"additionalProperties": true` — the `additionalProperties` escape hatch is where `Attributes/version`
lives, undocumented. The PMS database carries a matching table, `metadata_item_setting_markers`
(`docs/research/plex-schema-dumps/sqlite_tables.txt:55`, and a 2023 migration against it at
`migrations.tsv:349`).

**What would settle it directly:** one `GET /library/metadata/<id>?includeMarkers=1` response from a
running PMS showing `<Marker><Attributes version="…"/></Marker>`. Not available in this run, and the
claim is small enough that the python-plexapi citation is proportionate — but the ADR should say
"python-plexapi reads a `version` attribute off every Plex marker", not "Plex keeps a marker
version", because the second implies a Plex document that does not exist.

---

## 29. "Country is a second axis, not a synonym for language" — SPEC (ADR 0012 area)

**Claim.** "COUNTRY IS A SECOND AXIS, NOT A SYNONYM FOR LANGUAGE. Plex and Jellyfin both carry the
two separately because content ratings key on country while artwork keys on language."

**CONFIRMED for Plex, in Plex's own words, including the reason.** (The Jellyfin half is not checked
here.)

https://developer.plex.tv/pms/ — the Custom Metadata Providers section, headers a provider receives.
`info.version` "1.2.2". Fetched 2026-09-10.

| Header | Support Required? | Description |
| --- | --- | --- |
| `X-Plex-Language` | No | **IETF language tag including the region subtag** (e.g. 'en-US', 'de-DE'). Used for localization. |
| `X-Plex-Country` | No | **ISO 3166 two-letter country code. Used primarily to define the country for certification data**, or can be used to determine release dates for the specific country. |

Two separate headers, two separate standards (IETF BCP 47 vs ISO 3166), and Plex names the exact
rationale the SPEC gives: **certification data** — i.e. content ratings — is what country is for.
Note also that `X-Plex-Language` already carries a region subtag, so Plex is not splitting them for
want of one; it splits them because the questions are different.

**Corroborating detail from the same document:** in the provider response schema, Plex encodes the
country *inside* the rating string rather than as a field —

> `contentRating` (string) — "Age rating/certification (e.g., 'PG', 'R', 'PG-13'). **For non-US
> ratings please prepend 2-letter country code followed by a forward slash (e.g. `za/15`)**."

That is a country axis smuggled into a string, which is worth knowing before copying the shape:
Plex asks for country as a header and then returns it glued to the value.

---

## 30. "Plex carries three title columns" — ADR 0014 / SPEC

**Claim.** "Title is single-valued nowhere in the field: Plex carries three title columns, Jellyfin
four, schema.org three, and BIBFRAME a Title class with six variant subclasses."

**CONFIRMED for Plex — three, named, in the current provider contract.** (Jellyfin, schema.org and
BIBFRAME are not checked here.)

https://developer.plex.tv/pms/ — Custom Metadata Providers, the item metadata fields a provider
returns. Fetched 2026-09-10.

| Field | Type | Required? | Description |
| --- | --- | --- | --- |
| `title` | string | — | (the item title) |
| `originalTitle` | string | No | **"If the request is made for language that is different to the original language of the release, return the title in its original language."** |
| `titleSort` | string | No | **"Returned if the content should be sorted by a different value, e.g. 'Quiet Place, A'. This will be added automatically by the media server, so its inclusion is only necessary if you require a specific sorting value which the media server does not accommodate."** |

Three title fields, and the `originalTitle` description is ADR 0014's whole argument stated by Plex:
the title depends on the language of the *request*, so a single column cannot hold the answer, so
Plex bolted a second one on for the original-language case. `titleSort` is the third, and it is the
one ADR 0014 names as travelling with title ("`sort_name` with it, because sort order is
language-specific") — Plex confirms that too by making it a per-request, provider-supplied override.

A real Plex payload from the same document shows all three in use:
`{"duration":5165210,"key":"/library/metadata/1025","originalTitle":"Neco z Alenky",
"originallyAvailableAt":"1988-08-03","rating":6.9,…}`.

---

## 31. "Plex computes the hash and does not use it to relink moves … confirmed by users losing watch state on drive reshuffles" — ADR 0023

**Claim (second half of ADR 0023, not covered in sections 1-3).** "Plex computes this on every file
and then does not use it to relink moves, which is confirmed by users losing watch state on drive
reshuffles."

**The mechanism is CONFIRMED — Plex relinks by metadata GUID, never by the file hash. The evidential
framing is CONTRADICTED: a Plex Employee says on the record that a move should NOT lose watch state,
and the user in the cited pattern never reproduced it.**

https://forums.plex.tv/t/927526.json — "PLEX's Media Watched Status is IGNORANT!", opened
2025-07-30. Fetched 2026-09-10.

The user's report is exactly the ADR's sentence:

> "The only problem I consistently run into is when I **migrate media to a new directory** to get
> archived or vaulted with new encoding settings, **PLEX loses the media's WATCHED STATUS!** I don't
> know what or why this made sense to the developers to store the watched status in the media's
> storage location."

`drzoidberg33`, flagged **Plex Employee**, replies the same day:

> "**This is definitely not how it should work. Watch state is stored independently by the item's
> GUID, removing the files should not affect this.** The only reason an item should lose its watch
> state is **if it gets identified as a different piece of media completely** — this could maybe be
> because it was previously matched with a different agent and never had its metadata refreshed, or
> it was manually tagged as a different edition before. The only other way is if the watched state
> was removed from the database, but **this data is retained even after deleting a piece of media**."

And the reporter (post 3): "I'll reproduce it with screen grabs and logs." No reproduction was posted;
the thread ends at 13 posts on 2025-07-31.

**What this establishes, and it is the better version of the ADR's point.** Plex's continuity key is
**the metadata GUID, not the content hash**. The hash exists on `media_parts` and is not the thing
that survives a move; identity survives a move only if the *re-match* lands on the same GUID, and
Plex's own engineer names the failure mode — "if it gets identified as a different piece of media
completely". So the ADR's "computes it and then does not use it to relink" is correct, and the
consequence is sharper than "users lose watch state": **continuity depends on a metadata match
re-running the same way, which is a network- and provider-dependent operation**, where CanonCore's
depends on 128KB of the file.

**What to change:** "confirmed by users losing watch state on drive reshuffles" should not be stated
as confirmed. Users report it; Plex disputes it; the one thread that got a staff answer produced no
reproduction. **Suggested wording:** "Plex computes this on every file and then relinks by metadata
GUID rather than by the hash — Plex's own engineer confirms watch state is 'stored independently by
the item's GUID', so continuity survives a move only if the re-match reaches the same identification."

---

## 32. Extras: "Plex's users have been asking since 2021 for extras to be tracked properly" — SPEC

**Claim.** "Plex, Jellyfin and Kodi all model an extra as a child item and none of them as a file
role, and Plex's users have been asking since 2021 for extras to be tracked properly rather than
hidden."

**"Since 2021" is CONTRADICTED as the start date — the same request is on the forum from 2020-02-14,
and Plex's behaviour is documented as deliberate. The substance (extras carry no watch state) is
CONFIRMED, from a Plex support article and from users.**

**a) The earliest request is 2020, not 2021.** https://forums.plex.tv/t/542159.json — "Resume Behind
the Scenes - clips", **2020-02-14**. Fetched 2026-09-10.

> "I've ripped my 'The Hobbit' collection with the behind-the-scenes clips, but **I find no way to
> quickly resume a 'behind the scene' clip** […] Behind-the-scenes does not appear in 'recently
> watched'."

Another user answers with the design rule, stated flatly:

> "**This is by design** […] The 'Extras' feature is designed for short clips — Not Movie Versions or
> Documentaries. **Extras store no watched status. You can't mark Extras watched or unwatched. Extras
> generate no Video Preview Thumbnails.**"

**b) It is still being asked in 2025.** https://forums.plex.tv/t/924252.json — "Watch State for Local
Extras", **2025-06-27**, one post, no replies: "Would be nice if **local extras such as featurettes
and interviews were marked as watched when they were completed.** An option for them to have preview
images generated would be ideal too."

**c) Plex's own documentation confirms the exclusion**, in the NFO article (section 24):
"**Extras**: NFO metadata for local extras (trailers, behind-the-scenes, etc.) is **not supported**."

**d) A wrinkle worth knowing.** https://forums.plex.tv/t/742599.json (2021-09-12) reports the
opposite for one extra type: "-featurette tagged files have a new Preplay screen […] **I also now
notice these are also saving their progress** which is great". So Plex's treatment is not uniform
across extra kinds, which is itself an argument for the SPEC's rule — if an extra is a work related
to another work, it has progress by construction and no per-kind exception is needed.

**Correct wording:** "since 2020" rather than "since 2021", and "Plex documents extras as storing no
watch state at all, with at least one kind (`-featurette`) behaving differently, which is the
inconsistency an extra-as-file-role produces."

---

## 33. "Plex and Kodi both keep N items over one file" — ADR 0021 / SPEC

**Claim (Plex half).** "Plex and Kodi both keep N items over one file."

**CONFIRMED verbatim — and Plex's coverage model is an INTERVAL, not a set, which is a sharper
version of the ADR's own point.**

https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/ — "Naming and Organizing
Your TV Show Files". Fetched 2026-09-10; `datePublished` 2019-05-21T22:33:07+00:00, `dateModified`
**2026-05-22T17:09:04+00:00**.

> …season, episode numbers (**the first and last episode covered in the file**), and file extension.
> For example, `s02e18-e19`.
>
> **Note**: **Multi-episode files will show up individually in Plex apps when viewing your library,
> but playing any of the represented episodes will play the full file.** If you want episodes to
> behave truly independently, you're best off using a tool to split the file into individual
> episodes. To get a better overall experience, we recommend that you use a tool to split the video
> so that each episode has its own individual file.

Three things, all directly usable:

1. **N items over one file — CONFIRMED.** "Multi-episode files will show up **individually**."
2. **The honest cost the SPEC names is Plex's too, in Plex's own sentence**: "playing any of the
   represented episodes **will play the full file**" — one offset, wrong parts marked. The SPEC
   attributes this cost to Kodi's documentation; Plex documents it as well.
3. **Plex can only express a contiguous range.** `s02e18-e19` is "the first and last episode covered
   in the file". ADR 0021's argument is that coverage is a **SET, not an interval** — Kodi's
   `S01E01E04` naming episodes 1 and 4 while excluding 2 and 3. **Plex cannot say that at all.** That
   is a better illustration of the ADR's point than the Kodi example alone, because it shows the
   market leader having picked the weaker model.

And, as with movies (section 23), Plex's advice is to go change the files: "we recommend that you use
a tool to **split** the video" for multi-episode files, and "we strongly encourage you to instead use
a tool to **join/merge**" for split ones. A scanner forbidden to rename cannot take either escape
hatch, which is ADR 0039's constraint colliding with ADR 0021's problem.

---

## 34. "Jellyfin keeps two arrays and Plex nests them separately" — ADR 0022 / SPEC

**Claim (Plex half).** Versions and parts are distinct: "Jellyfin keeps two arrays and Plex nests
them separately."

**CONFIRMED, from the schema.** https://developer.plex.tv/pms/, `info.version` "1.2.2". Fetched
2026-09-10.

> `"Media": {"type":"array","items":{"$ref":"#/components/schemas/media"}}`
>
> and inside the `media` schema:
> `"Part": {"type":"array","items":{"$ref":"#/components/schemas/part"}}`

So an item carries **`Media[]`** — the versions, the "same film in H.264" axis — and each `Media`
carries **`Part[]`** — the parts, the "the film continues here" axis. Two levels, not one array, and
not one flat list. That is exactly the distinction ADR 0022 says collapsing would destroy, and Plex's
own playback-decision payload shows both levels carrying independent decisions:
`"Part":[{…,"decision":{"enum":["directplay","transcode","none"]},"selected":boolean,"Stream":[…]}]`.

**Bonus for ADR 0038 / section 9 — the artwork role vocabulary, from the same schema:**
`"image": {"type": {"enum":["background","banner","clearLogo","coverPoster","snapshot"]},
"description":"Describes both the purpose and intended presentation of the image."}` Five roles in
the current provider contract. ADR 0038 names three of them.

---

## 35. "Plex re-derives its data by rescanning files" — ADR 0048 / SPEC

**Claim.** "Plex re-derives its data by rescanning files. Ours cannot: placements, statements,
favourites and the whole provenance record exist nowhere but the database."

**CONTRADICTED as stated. Plex's own documentation says the opposite about the half that matters:
watch state lives only in the database, which is why Plex ships a scheduled database backup.**

https://support.plex.tv/articles/201553286-scheduled-tasks/ — "Scheduled Tasks". Fetched 2026-09-10;
`dateModified` 2025-07-31T16:37:12+00:00.

> **Backup database every three days** — Every three days, a backup of your core SQL database file
> will be created (if it is not already corrupted). **This is the database that holds your media
> viewstate and other critical information.** A backup can help protect against corruption which can
> occur in rare cases when a machine is powered down unexpectedly, for example. Up to three backup
> copies will be kept in a rotating manner.
>
> **Warning!**: This is only a backup of your core database; **it is not a backup of all of your
> metadata content. This should not be considered a replacement for having a backup of your Plex
> Media Server data.**

Plex is drawing the same line CanonCore draws, and drawing it in the same place: **metadata content
(bundles, artwork) is re-derivable and is not backed up; viewstate is not re-derivable and is backed
up on a three-day rotation by default.** Plex also ships a restore path for it
(`support.plex.tv/articles/…restore-a-database-backed-up-via-scheduled-tasks/`, linked from that
page). Section 31's Plex Employee makes the same point from the other side: watch state "is retained
even after deleting a piece of media".

So ADR 0048's *conclusion* is right and its *contrast* is wrong. The argument does not need the
contrast at all — it is stronger without it:

**Correct wording:** "Even Plex, whose metadata is re-derivable by rescanning, backs up its database
on a schedule, because viewstate is not re-derivable. Ours has far more in that category —
placements, statements, favourites and the whole provenance record — so the same reasoning applies
with more force, and a forward-only ladder makes restore the only way back from a bad upgrade."

That also removes an internal tension in the repo: `docs/adr/0047` (forward-only migrations) and
`docs/adr/0048` currently rest on Plex being able to rebuild from files, while `docs/adr/0023` rests
on Plex *not* being able to re-establish identity after a move. Both cannot be leaned on at once.

---

## 36. Two smaller claims, checked and left short

### a) "Plex's unscrobble clears the same way" — SPEC — **UNFOUNDED**

**Claim.** After describing Jellyfin's `LastPlayedDate` being cleared by marking something unwatched:
"Plex's unscrobble clears the same way."

The endpoints exist and are named. https://developer.plex.tv/pms/, fetched 2026-09-10:
`{"scrobbleKey":"/:/scrobble","unscrobbleKey":"/:/unscrobble","key":"/:/timeline","type":"timeline"}`
— summarised as "**Mark an item as played**" and "**Mark an item as unplayed**", with the provider
`timeline` feature described as "The feature may additionally specify the `scrobbleKey` and
`unscrobbleKey` attributes, which represent the endpoints which **allow marking a piece of media
played or unplayed**."

But **nothing in Plex's documentation says what `unscrobble` writes.** "Marks unplayed" is compatible
with clearing `view_count` and `last_viewed_at` outright, and equally compatible with decrementing or
with leaving the log untouched. Given section 8's finding that `metadata_item_views` (the log) and
`metadata_item_settings` (the state) are separate stores and that Plex documents deleting one as not
affecting the other, the SPEC's assertion is a guess about the wrong table's behaviour.

**What would settle it:** `SELECT view_count, last_viewed_at FROM metadata_item_settings` plus
`SELECT count(*) FROM metadata_item_views` on a real PMS, before and after a `PUT /:/unscrobble`.
Ten minutes with a server; not available in this run.

### b) "Search returns all kinds grouped by kind with works first — which is what Plex, Jellyfin and Kodi all chose" — SPEC — **PARTIALLY CONFIRMED for Plex**

The "**all kinds**" half is CONFIRMED: Plex's search returns people, not only works.
https://support.plex.tv/articles/discover-credits/ — "Discover Credits". Fetched 2026-09-10;
`datePublished` 2022-11-03T16:08:14+00:00, `dateModified` 2025-04-13T14:18:47+00:00.

> "Discover Credits can be accessed by either selecting their image in the cast hub on a details
> page, **or in the People section of search results.**"

A named "People section of search results" is grouping by kind, and a person having a destination
page of their own ("An image, biography, and social media links […] Filmography: A list of all media
we know they were involved with") is the entity-as-first-class-item shape CanonCore takes further.

The "**works first**" half is **not evidenced** by any Plex document I could reach — no support
article states the ordering of search result groups. It is observable in the product, so it is not
wrong; it is just uncited. **What would settle it:** a `GET /hubs/search?query=…` response from a
real PMS, whose hub order is the answer.

---

## 37. "Plex's client echoes the server's analysed value rather than informing it" — ADR 0042 / SPEC

**Claim.** "Letting the client be the only source of duration was refused and checked rather than
assumed — Jellyfin's `PlaybackProgressInfo` carries no duration field at all, and **Plex's client
echoes the server's analysed value rather than informing it.**" And, in the SPEC: "**Neither
incumbent has the channel this would need.**"

**CONTRADICTED. Plex's client reports `duration` to the server on every timeline call, and Plex
documents it as a required-shaped parameter of the endpoint. The channel exists.**

https://developer.plex.tv/pms/, `POST /:/timeline` ("Report media timeline"), `info.version` "1.2.2".
Fetched 2026-09-10. Its query parameters, in full:

| Parameter | Type | Description |
| --- | --- | --- |
| `key` | string | The details key for the item. |
| `ratingKey` | string | The rating key attribute for the item. |
| `state` | enum | `stopped` / `buffering` / `playing` / `paused` |
| `playQueueItemID` | string | If playing media from a play queue, the play queue's ID. |
| `time` | integer | The current time offset of playback in ms. |
| **`duration`** | **integer** | **"The total duration of the item in ms."** |
| `continuing` | 0/1 | When state is `stopped`, whether the client is going to continue playing another item. |
| `updated` | integer | Used when a sync client comes online… |
| `offline` | 0/1 | …a timeline being synced from offline, as opposed to "live". |
| `timeToFirstFrame` | integer | Time till first frame is displayed. Sent only on the first playing timeline request. |
| `timeStalled` | integer | Time spent buffering since last request. |
| `bandwidth` | integer | Bandwidth in kbps as estimated by the client. |
| `bufferedTime` / `bufferedSize` | integer | Amount buffered by the client. |

`duration` sits right next to `time` and is documented in the client's own voice, as something the
client sends. Whether PMS *trusts* it, or overwrites it with the analysed value, is a separate
question that Plex's documentation does not answer — and that unanswered question is the whole of the
ADR's claim.

**What survives.** The design decision is untouched: ADR 0042's rule ("the probe is the source of
truth and the client is the fallback") is the right one, and its reason is unaffected — "a client
cannot answer in advance, because it only reports once playback has already started". What breaks is
the supporting evidence. Two sentences must change:

- "Plex's client echoes the server's analysed value rather than informing it" — **not established.**
  Plex's client sends a duration; Plex does not publish what the server does with it.
- "Neither incumbent has the channel this would need" — **false for Plex.** The channel is
  `duration` on `POST /:/timeline`, and CanonCore's own backfill ("where the probe cannot open a
  file, the client's first progress report BACKFILLS duration") is the same channel by another name.

**What would settle the remaining question:** analyse an item, note `Media.duration`, then POST a
timeline with a deliberately wrong `duration`, and re-read the item. Not available in this run.

---

## Index of sections 7-37

| § | Claim | Where | Verdict |
| --- | --- | --- | --- |
| 7 | Plug-in directory shut 2018 at <2%, manual installs kept, agents broke, reopened Dec 2025 as HTTP | ADR 0031 | **CONFIRMED** (say "warned 2024, broken 2025") |
| 8a | `metadata_item_views` + `metadata_item_settings`, per-viewing timestamp and device | ADR 0019 | **CONFIRMED** |
| 8b | "Ships no feature that reads the log" / "can't tell you three times, or when" | ADR 0019 / SPEC | **CONTRADICTED** |
| 8c | A privacy control deletes it wholesale | ADR 0019 | **CONFIRMED** (account-scoped) |
| 9 | Locks `thumb`, `art`, `clearLogo` separately | ADR 0038 | **CONFIRMED** (five roles, not three) |
| 10a | "Set back after changing direction of Agents" | ADR 0024 | **CONFIRMED**, but second-hand via a dead tracker |
| 10b | "Live since 2011" | ADR 0024 | **UNFOUNDED** — use "since at least 2013" |
| 10c | "Still open in 2026" | ADR 0024 | **CONFIRMED** |
| 11 | Analysis pass stores those fields; ships MediaInfo beside its own transcoder | ADR 0042 | **CONFIRMED** ("exactly these fields" → "all of ours, plus more") |
| 12a | "Eleven headers" | ADR 0043 | **CONFIRMED** |
| 12b | "Of which `X-Plex-Provides` matters most", as capability declaration | ADR 0043 / SPEC | **CONTRADICTED** |
| 13 | Completion compares against children you own | ADR 0060 | **CONFIRMED** (inference from two Plex premises) |
| 14 | Reversed medium typing 2025-07-16, "in hindsight…" | ADR 0010 | **CONFIRMED** quote; apps not libraries |
| 15 | Language change "cannot retroactively update" | ADR 0014 | **CONFIRMED** |
| 16 | Smart collections cannot be hand-ordered | SPEC | **CONFIRMED** |
| 17 | Cross-library collections match on name as strings | ADR 0016 | **CONFIRMED** |
| 18 | `playQueueSourceURI`, `playQueueItemID`, `continuous` | ADR 0066 | **CONFIRMED** |
| 19 | Freezes: "existing content will not change by default" | ADR 0047 | **CONFIRMED** (Plex says "for now") |
| 20 | Merges versions, picks by decode capability; users still asking | ADR 0065 | **CONFIRMED** (+ editions are not merged at all) |
| 21 | API docs give 10 seconds for LAN and WAN | SPEC | **CONFIRMED** |
| 22 | "Only Plex ships a split at all" | ADR 0040 | Plex half **CONFIRMED**; the "only" is unchecked |
| 23 | "We strongly encourage you to instead use a tool to join/merge" | ADR 0022 | **CONFIRMED** |
| 24a | NFO shipped in PMS v1.43.1 | ADR 0039 | **CONFIRMED** |
| 24b | "For portability" | ADR 0039 | **CONTRADICTED** as Plex's stated reason |
| 24c | "Declined since 2008" | ADR 0039 | **UNFOUNDED** |
| 25 | "One maintenance window, one setting" | SPEC | **CONTRADICTED** on "one setting" |
| 26 | Plex's "prioritized list of sources" | SPEC | **CONFIRMED** in substance; Plex says "Source Priority" |
| 27 | No text library type | SPEC | **CONFIRMED** |
| 28 | "Plex keeps a marker version too" | SPEC | **CONFIRMED** via python-plexapi, not a Plex document |
| 29 | Country and language carried separately | SPEC | **CONFIRMED** |
| 30 | Three title columns | ADR 0014 | **CONFIRMED** |
| 31 | Hash not used to relink; "confirmed by users losing watch state" | ADR 0023 | Mechanism **CONFIRMED**; the evidence **CONTRADICTED** |
| 32 | Extras asked for "since 2021" | SPEC | **CONTRADICTED** — 2020-02-14 |
| 33 | N items over one file | ADR 0021 | **CONFIRMED** (Plex's coverage is an interval, not a set) |
| 34 | Versions and parts nested separately | ADR 0022 | **CONFIRMED** |
| 35 | "Plex re-derives its data by rescanning files" | ADR 0048 | **CONTRADICTED** |
| 36a | "Plex's unscrobble clears the same way" | SPEC | **UNFOUNDED** |
| 36b | Search grouped by kind, works first | SPEC | Kinds **CONFIRMED**; "works first" **UNFOUNDED** |
| 37 | Client echoes the analysed duration; "neither incumbent has the channel" | ADR 0042 / SPEC | **CONTRADICTED** |

**Not checked in this file** (claims about non-Plex products made in the same sentences as Plex
claims): Jellyfin's `LastPlayedDate`, `ImageFetcherOrder`, `PlaybackProgressInfo`, NFO parser and
10.11 backup scope; Calibre; MusicBrainz's edit types; Kodi's `S01E01E04` and its documented cost;
Audiobookshelf; Emby's 10-second ceiling; Spotify's `context`/`offset`; schema.org and BIBFRAME title
shapes.
