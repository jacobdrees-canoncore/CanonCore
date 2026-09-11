# Verification: every non-Plex/Jellyfin/Emby product claim in the decision log

Every factual claim in `docs/adr/` about a product OTHER than Plex, Jellyfin and Emby, checked
against the source that owns it: the project's own repository, its own release notes, its own
issue tracker, its own documentation. Plex, Jellyfin and Emby claims are covered separately in
`verify-adr-plex.md` and `verify-adr-jellyfin.md`; standards claims (IFLA LRM, LRMoo, BIBFRAME,
schema.org, OAI-ORE, IIIF, PROV-O, Wikibase) in `verify-adr-standards.md`.

**Section 36 at the end is the summary**: the counts, and every CONTRADICTED and UNFOUNDED verdict
in one table with what the owner actually says.

Nothing here is confirmed from memory. Every CONFIRMED verdict carries a lookup performed during
this run — a `gh api` / `gh pr view` / `gh release view` call against the owning repository, or a
fetch of the owning documentation — with the exact figures and the date checked.

Verdicts used:

- **CONFIRMED** — the owner's own source says this, with the citation given.
- **CONTRADICTED** — the owner's own source says something materially different.
- **UNFOUNDED** — no source was found in this run that supports it.
- **JUDGEMENT** — a characterisation or a drifting number, not a checkable fact.

Run date: 2026-09-10.

---

## 1. Audiobookshelf — ADR 0043, ADR 0065

Repository `advplyr/audiobookshelf`. All lookups 2026-09-10.

### 1.1 "Audiobookshelf began from exactly our position — an opaque anonymous token with no row behind it" (0043)

**CONTRADICTED.** What Audiobookshelf moved off in PR #4444 was neither opaque nor anonymous, and
it did have a row.

`server/models/User.js` at tag `v2.25.1` (the last release before the new auth) declares
`token: DataTypes.STRING` on the users table (line 431), i.e. the token is persisted on the user
row. `server/Auth.js` at the same tag generates it as a signed JWT carrying the user's identity:

```js
generateAccessToken(user) {
  return jwt.sign({ userId: user.id, username: user.username }, global.ServerSettings.tokenSecret)
}
```

So the pre-#4444 credential was a never-expiring **JWT naming the user**, stored in a column on
the **users** row. What it lacked was a *session* row — one row per device — which is the thing
#4444 and later #5400 added. The accurate version of the claim is "a long-lived bearer token with
no session row behind it", not "an opaque anonymous token with no row behind it".

Checked: `gh api repos/advplyr/audiobookshelf/contents/server/models/User.js?ref=v2.25.1`,
`.../server/Auth.js?ref=v2.25.1`.

### 1.2 "moving off it took 52 files and 3,168 lines" — PR #4444, merged 2025-07-12 (0043)

**CONFIRMED.** `gh pr view 4444 --repo advplyr/audiobookshelf`:

```json
{"number":4444,"title":"Implement new JWT auth","state":"MERGED",
 "mergedAt":"2025-07-12T16:32:23Z","changedFiles":52,"additions":3168,"deletions":862}
```

52 files, +3,168 / −862, merged 2025-07-12. Every figure matches.
https://github.com/advplyr/audiobookshelf/pull/4444

### 1.3 "then ten months of session bugs" (0043)

**CONFIRMED** as a fair reading of the release notes. The new auth shipped in v2.26.0
(published 2025-07-12T19:31:21Z), and token/session defects were still being fixed in v2.35.1
(published 2026-05-28) — 10.5 months. From the release bodies, in order:

- v2.26.2 (2025-07-21): "Web client page load causing a token refresh #4509"
- v2.29.0 (2025-08-25): "Initial page load failing to load library (on token refreshes) #4567"
- v2.31.0 (2025-12-01): "Admin users unable to close sessions for other users #4746"; "Increase
  default access & refresh token expirations"
- v2.33.0 (2026-03-12): "IDOR vulnerabilities in listening sessions, media progress, and bookmark
  endpoints #5062"
- v2.35.0 (2026-05-17): "Access token refresh grace period (fixes frequently needing to re-login) #4630"
- v2.35.1 (2026-05-28): "Duplicate refresh tokens across sessions can cause unexpected logout #5253"

Checked: `gh api repos/advplyr/audiobookshelf/releases?per_page=60`.

### 1.4 "the per-device logout everyone actually wanted then cost 131 lines" — PR #5400, merged 2026-07-25 (0043)

**CONFIRMED for the PR's own figures**, with one qualification.

```json
{"number":5400,"title":"Account sessions table","state":"MERGED",
 "mergedAt":"2026-07-25T22:43:26Z","changedFiles":5,"additions":131,"deletions":2}
```

5 files, +131 / −2, merged 2026-07-25. Every figure matches.
https://github.com/advplyr/audiobookshelf/pull/5400

Qualification: #5400 shipped the sessions table and the `GET /api/me/sessions` endpoint. The
ability to log a single session out arrived alongside it in #5405 ("Delete auth session endpoint
& paginate sessions", +120/−9, merged 2026-07-26), and "log out all devices" in #5395 (+39/−7,
merged 2026-07-24). The v2.36.0 notes credit all three. The complete per-device logout feature is
therefore ~290 lines across three PRs; 131 is the sessions table alone.

### 1.5 "v2.36.0, 2026-07-27, auth sessions table" (0043)

**CONFIRMED.** `gh release view v2.36.0 --repo advplyr/audiobookshelf`:
`"tagName":"v2.36.0","publishedAt":"2026-07-27T22:59:30Z"`, and the body's Added section reads:

> - Logout all devices button on account page (in #5395)
> - Auth sessions table on account page w/ ability to logout of individual sessions (in #5400)

### 1.6 `ebookProgress` and `ebookLocation` (0020's neighbourhood, cited in the progress work)

**CONFIRMED.** `server/models/MediaProgress.js` at `v2.36.0` declares both as columns:

```js
ebookLocation: DataTypes.STRING,
ebookProgress: DataTypes.FLOAT,
```

and returns both in the model's JSON projection (lines 170–171). So Audiobookshelf carries a
normalised 0..1 float alongside an opaque per-format location string — the same two-part shape
the ADRs adopt from Readium.

Checked: `gh api repos/advplyr/audiobookshelf/contents/server/models/MediaProgress.js?ref=v2.36.0`.

### 1.7 "finished at ten seconds remaining is a configurable default, and it also ships a percentage mode"

**CONFIRMED.** `server/models/Library.js` at `v2.36.0` documents the two library settings:

> `@property {number} markAsFinishedTimeRemaining` Time remaining in seconds to mark as finished. (defaults to 10s)
> `@property {number} markAsFinishedPercentComplete` Percent complete to mark as finished (0-100). If this is set it will be used over markAsFinishedTimeRemaining.

`server/models/MediaProgress.js` implements the default inline:

```js
const markAsFinishedTimeRemaining = isNullOrNaN(progressPayload.markAsFinishedTimeRemaining) ? 10 : Number(progressPayload.markAsFinishedTimeRemaining)
shouldMarkAsFinished = timeRemaining < markAsFinishedTimeRemaining
```

and `client/components/modals/libraries/LibrarySettings.vue` exposes the choice as a
`markAsFinishedWhen` selector with values `'timeRemaining'` and `'percentComplete'`.
`client/components/modals/libraries/EditModal.vue` seeds a new library with
`markAsFinishedPercentComplete: null, markAsFinishedTimeRemaining: 10`.

So ten seconds is a **default**, per library, and a percentage mode ships alongside it and takes
precedence when set. Checked: `gh search code --repo advplyr/audiobookshelf markAsFinishedTimeRemaining`.

### 1.8 "two narrations of one book are two separate library items" (0065)

**CONFIRMED.** Issue #2396, "[Enhancement]: Same book, different narrators", opened 2023-12-11.
The reporter states the position plainly:

> I have audiobooks that are the same, but voiced by different narrators. ... I kept them within
> different subfolders within the book folder, but now with ABS I have to create a book folder
> for each narrator.

and the maintainer (`advplyr`, 2023-12-11) confirms the model cannot express it without new work:

> Yeah progress would be an issue here unless we tracked them separately and selecting a different
> narrator would show the progress for that narrator.

The same limitation is restated on #2315 by the maintainer (2023-11-18): "We would have to have a
way of grouping the same book together similar to how Plex groups movies."

https://github.com/advplyr/audiobookshelf/issues/2396

### 1.9 "users are told to put the narrator in the FILENAME" (0065)

**CONTRADICTED.** The narrator goes in the **folder** name, not the filename.

`server/utils/scandir.js` at `v2.36.0` parses it out of the directory name only:

```js
/**
 * Extract narrator from folder name
 */
function getNarrator(folder) {
  let pattern = /^(?<title>.*) \{(?<narrators>.*)\}$/
  ...
}
```

and the official documentation (audiobookshelf.org, Book Library → Directory Structure, fetched
2026-09-10) gives folder examples: `Wizards First Rule {Sam Tsoutsouvas}`,
`1994 - Volume 1. Wizards First Rule {Sam Tsoutsouvas}`,
`Vol. 1 - 1994 - Wizards First Rule - A Really Good Subtitle {Sam Tsoutsouvas}`.

The substance of the ADR's point survives — the narrator is encoded in the *path* rather than
modelled — but "filename" is the wrong noun. Fix it to "folder name".
https://audiobookshelf.org/docs/documentation/libraries/book-library/directory-structure

### 1.10 "and the feature is marked not planned" (0065)

**CONTRADICTED.** Nothing in the tracker marks it not planned.

- #2396 "[Enhancement]: Same book, different narrators" is **open**, `state_reason: null`, labelled
  `enhancement` and `backlog` (checked `gh api repos/advplyr/audiobookshelf/issues/2396`).
- #2315 "[Enhancement]: Support multiple file formats per audiobook" is **open**,
  `state_reason: null`, labelled `enhancement`, with comments as recent as 2026-07-02.
- The repository has no `not planned` label at all; its label list is `authentication, awaiting
  release, backlog, bug, chapter editor, config-issue, documentation, duplicate, ebooks,
  encoding/embedding, enhancement, good first issue, help wanted, invalid, listening sessions &
  progress, planned, possible plugin, progress sync, question, sorting/filtering/searching, unable
  to reproduce, upload, users & permissions, waiting, wontfix`.
- The one adjacent issue closed as `not_planned` is #2463, and it was closed as a **duplicate** of
  #2315 by the maintainer ("Duplicate of #2315"), not as a rejection of the feature.

What the record actually supports is a maintainer's discouraging comment, not a status. `advplyr`,
2023-12-11 on #2396:

> I can see this being useful but it's unlikely it gets added since it is a lot of work and only a
> small number of users would benefit from it.

That is the sentence to quote. "Marked not planned" claims a tracker state that does not exist.


---

## 2. Komga — ADR 0055, ADR 0020, ADR 0001

Repository `gotson/komga`. All lookups 2026-09-10.

### 2.1 "Komga shipped OPDS at day 34" (0055)

**CONFIRMED, exactly.**

- First commit: `6b0d849d` "initial commit", `2019-08-08T09:55:56Z`
  (`gh api "repos/gotson/komga/commits?until=2019-08-10T00:00:00Z"`). The repo's own
  `created_at` is `2019-08-08T09:48:49Z`.
- First OPDS commit: `55fb8da5` "support for OPDS feed with OpenSearch and Page Streaming
  Extension (https://vaemendis.net/opds-pse/)", `2019-09-11T07:19:25Z`, 10 files, adding
  `interfaces/web/opds/OpdsController.kt` plus the OPDS DTOs.

2019-08-08 → 2019-09-11 is 34 days. Day 34.

### 2.2 "a third-party mobile reader one day after first release" (0055)

**CONFIRMED, and the record is stronger than the claim.**

- First release `v0.1.0`, published `2019-08-27T14:14:14Z`.
- One day later, `7ca2880f`, `2019-08-28T01:08:10Z`: "fixed a regression where Tachiyomi could
  not retrieve pages without sessions". Tachiyomi is a third-party Android manga reader; the
  release `v0.1.1` went out 17 seconds later at `2019-08-28T01:08:27Z`.

The third-party reader in fact predates the first release. Komga issue #1, opened
`2019-08-22T17:07:23Z` — five days *before* v0.1.0 — is "How to get and configure the Tachiyomi
extension with Komga?" and cites an already-open PR against `inorichi/tachiyomi-extensions`
(#1409). Komga's maintainer answered the same day with a development APK.

So Komga had a third-party Android reader talking to it before it had a release, and was fixing
regressions for that reader one day after the first one.
(The tachiyomi-extensions repository is now 404 on GitHub, so the PR's authorship could not be
established in this run; the maintainer supplying the build suggests he wrote it, which would
make it "Komga's plugin inside a third-party reader" rather than "a third party wrote a reader".
The load-bearing point — an existing client protocol beat writing an app — is unaffected.)

### 2.3 "has never written an app in six years" (0055)

**CONFIRMED in substance; the number is now stale.** `gh api users/gotson/repos` lists no mobile
application: `komga` (Kotlin, server), `komga-website`, `mihon-extensions-source` (a fork holding
the Komga extension for a third-party reader), `R2D2BC` (a fork of a web reader), and unrelated
projects. There is no `komga` GitHub organisation.

The duration should be updated: the repo was created `2019-08-08` and last pushed
`2026-09-10T06:13:16Z`, which is **7 years 1 month**, not six.

### 2.4 "page + R2Locator" (0020's progress model)

**CONFIRMED.** `komga/src/main/kotlin/org/gotson/komga/domain/model/ReadProgress.kt`, on `master`:

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

`R2Locator.kt` is a faithful Readium locator — `href`, `type`, `title`, `locations`, `text` —
with `locations.progression` documented as "Progression in the resource expressed as a
percentage. Between 0 and 1." So Komga stores a page integer *and* a Readium locator on the same
progress row.

### 2.5 "completes text by page in 1..pageCount" (0020)

**CONFIRMED for the page endpoint, with a material qualification.** `BookLifecycle.kt`,
`markReadProgress`:

```kotlin
require(page in 1..media.pageCount) { "Page argument ($page) must be within 1 and book page count (${media.pageCount})" }
...
val progress = ReadProgress(book.id, user.id, page, page == media.pageCount, locator = locator)
```

For an EPUB this path additionally requires `media.epubDivinaCompatible` and resolves the page to
a locator via `extension.positions[page - 1]`.

The qualification: Komga has a **second** completion rule. `markProgression` — the Readium /
Kobo path — completes an EPUB on progression, not page:

```kotlin
totalProgression?.let { (media.pageCount * it).roundToInt() } ?: 0,
totalProgression?.let { it >= 0.99F } ?: false,
```

So text completes at `page == pageCount` when a client reports a page, and at
`totalProgression >= 0.99` when a client reports a Readium progression. Any ADR sentence that
says Komga completes text *only* by page is incomplete.

### 2.6 "Komga's first release note was 'First release, support for `cbr` and `cbz` archives'" (0001)

**CONFIRMED verbatim.** `gh release view v0.1.0 --repo gotson/komga`:

```json
{"tagName":"v0.1.0","name":"v0.1.0","publishedAt":"2019-08-27T14:14:14Z",
 "body":"First release, support for `cbr` and `cbz` archives"}
```

That is the entire body. First commit to first tag is 2019-08-08 → 2019-08-27 = 19 days, inside
the ADR's stated 4-to-39-day band.

### 2.7 "Komga was created 2019-08-08" (0001)

**CONFIRMED.** `gh api repos/gotson/komga` returns `"created_at":"2019-08-08T09:48:49Z"`.

---

## 3. Navidrome — ADR 0055

Repository `navidrome/navidrome` (originally `deluan/gosonic`). All lookups 2026-09-10.

### 3.1 "Navidrome implemented Subsonic from its second commit" (0055)

**CONFIRMED, exactly.** The repository's two oldest commits are:

1. `5d6fd4ee` "Initial project skeleton", `2016-02-23T23:41:35Z`
2. `b9e9d38a` "First endpoint: Ping", `2016-02-24T05:07:57Z`

and commit 2's diff adds `controllers/ping.go`:

```go
// @router /rest/ping.view [get]
func (this *PingController) Get() {
	this.Ctx.WriteString("<subsonic-response xmlns=\"http://subsonic.org/restapi\" status=\"ok\" version=\"1.0.0\"></subsonic-response>")
}
```

`/rest/ping.view` returning `<subsonic-response>` is the Subsonic API. Commit two.
Checked: `gh api repos/navidrome/navidrome/commits/b9e9d38a`.

### 3.2 "debugged against a third-party Android client six days in" (0055)

**CONFIRMED, exactly.** Commit `f760f892`, `2016-02-29T16:49:27Z`, message
**"DSub only works with POSTs..."**, changing the router so every Subsonic endpoint accepts any
method:

```go
-		beego.NSRouter("/ping.view", &api.PingController{}),
+		beego.NSRouter("/ping.view", &api.PingController{}, "*:Get"),
```

DSub is a third-party Android Subsonic client. 2016-02-23 → 2016-02-29 is 6 days.

### 3.3 "four years before a web UI" (0055)

**CONFIRMED as a rounding**, and worth stating precisely rather than rounding.

- First UI commit: `ea862389`, `2020-01-14T03:53:23Z`, "Add ui subfolder, bootstrapped a
  'hello-world' React-Admin app, changed Makefile to start both apps in dev mode".
- First browsable UI: `3a03284c` "Add routing for basic web ui" (2020-01-20),
  `b23175e3` "Initial support for album browsing from UI" (2020-01-22).
- First release of any kind: `v0.3.0`, published `2020-01-27T01:24:20Z`.

From the first commit (2016-02-23) that is **3 years 10.7 months** to the first UI commit and
**3 years 11.1 months** to the first release carrying it. "Four years" rounds up; "nearly four
years" is the accurate phrase.

### 3.4 The player table: created 2020-03-10, unique constraint dropped 2021-06-19, key changed username→user id 2024-08-02 (0055)

**CONFIRMED, all three, to the day.** `gh api repos/navidrome/navidrome/contents/db/migrations`
lists exactly these files, and their contents match the description:

- `20200310181627_add_transcoding_and_player_tables.go` — creates the table with a
  name-uniqueness constraint and a username key:

  ```sql
  create table player
  (
      id varchar(255) not null primary key,
      name varchar not null,
      ...
      user_name varchar not null,
      client varchar not null,
      ...
      unique (name),
  ```

- `20210619231716_drop_player_name_unique_constraint.go` — rebuilds `player` as `player_dg_tmp`
  with no `unique (name)` and renames it back. (SQLite cannot drop a constraint in place, hence
  the table swap.)

- `20240802044339_player_use_user_id_over_username.go` — rebuilds it again with
  `user_id varchar not null references user (id) on update cascade on delete cascade`,
  backfilling via `(select id from user where user_name = player.user_name)` and **deleting the
  rows that do not resolve**: `DELETE FROM player_dg_tmp WHERE user_id = 'UNKNOWN_USERNAME';`

That last detail is worth carrying into ADR 0047: Navidrome's key change silently discards
unmatchable rows, which is precisely the case the quarantine rule exists to handle.


---

## 4. Ubooquity and Kavita — ADR 0001

All lookups 2026-09-10.

### 4.1 "Ubooquity shipped 2.1.2 on 2018-10-11 and went quiet" (0001)

**CONFIRMED.** Ubooquity is closed-source with no repository; the owner's source is its own blog
feed, `https://vaemendis.net/ubooquity/feed/rss` (fetched 2026-09-10). The feed's eight items, in
order:

| Item | pubDate |
| --- | --- |
| Ubooquity 2.1.1, minor release | Fri, 22 Sep 2017 |
| **Ubooquity 2.1.2** | **Thu, 11 Oct 2018 21:35:00 +0200** |
| Ubooquity is not affected by Log4shell | Mon, 13 Dec 2021 |
| **Ubooquity 3 (BETA)** | **Sun, 15 Oct 2023 18:27:00 +0200** |
| Vulnerability in Ubooquity 2.1.2. Please update to 2.1.4. | Sun, 15 Sep 2024 |
| A small update for Ubooquity v2 (new 2.1.5 version) | Sun, 13 Oct 2024 |
| **Ubooquity 3.1.0** | **Mon, 18 Aug 2025 20:59:00 +0200** |
| Renegade Reader theme for Ubooquity v3 | Sun, 21 Sep 2025 |

2.1.2 on **2018-10-11**, and the only post in the following five years is a Log4shell
reassurance — no release at all between 2018-10-11 and 2023-10-15, a gap of 5 years and 4 days.

### 4.2 "3.0 beta 2023-10-15" (0001)

**CONFIRMED.** Feed item "Ubooquity 3 (BETA)", pubDate `Sun, 15 Oct 2023 18:27:00 +0200`, body
opening "A BETA version of **Ubooquity 3** is available."

### 4.3 "3.1.0 stable 2025-08-18" (0001)

**CONFIRMED, including "stable".** Feed item "Ubooquity 3.1.0", pubDate
`Mon, 18 Aug 2025 20:59:00 +0200`, body opening:

> Ubooquity 3.1.0 is available, this is the first stable version of Ubooquity v3 !

### 4.4 "Komga was created 2019-08-08 and Kavita 2020-12-12, both inside that gap" (0001)

**CONFIRMED.** `gh api repos/gotson/komga` → `"created_at":"2019-08-08T09:48:49Z"`;
`gh api repos/Kareadita/Kavita` → `"created_at":"2020-12-12T22:23:54Z"`. Both fall inside the
2018-10-11 → 2023-10-15 Ubooquity gap.

### 4.5 Kavita's maintainer states it exists "due to Ubooquity not having metadata" (0001)

**CONFIRMED verbatim.** Kavita issue #3392, "v0.8.4 - New Scanner + Browse Authors/Artists + Tons
of Bugfixes", opened by the maintainer `majora2007` on 2024-11-22:

> For those that have seen, we have hit over 65K active installs. It's absolutely amazing that a
> small project I started **due to Ubooquity not having metadata** has turned into such a massive
> project with a huge userbase.

The wording is his, in that order, and the ADR's quotation marks are earned.
https://github.com/Kareadita/Kavita/issues/3392

A second, independent statement of the same thing is in issue #2473 ("v0.7.11 - 3 Years of
Development", 2023-12-03): "Originally starting out after using Ubooquity and feeling limited by
the lack of metadata and other solutions not aligning with my sense of UX, I started this
project..."

---

## 5. Readarr and Sick Beard — ADR 0001

All lookups 2026-09-10.

### 5.1 "Readarr is archived at 3,471 stars" (0001)

**JUDGEMENT — the archival is a fact, the count is not.** `gh api repos/Readarr/Readarr`:

```json
{"archived":true,"created_at":"2020-02-29T20:05:55Z","pushed_at":"2025-06-27T10:17:54Z","stargazers_count":3470}
```

Archived: confirmed. Star count **today is 3,470**, one below the ADR's 3,471 — a star count is a
live number that drifts daily and cannot be "confirmed" for any date but the day it is read. If
the figure is to stay in the ADR, it needs "(as of <date>)" attached; otherwise drop it and say
"archived with ~3.5k stars".

### 5.2 "Sick Beard's final commit reads 'Officially sunset the repo' at 2,855" (0001)

**CONFIRMED for the commit; JUDGEMENT for the count.**
`gh api "repos/midgetspy/Sick-Beard/commits?per_page=3"` on the default branch `development`:

```
2024-10-27T04:30:44Z c36f21f8 Officially sunset the repo
2016-03-21T03:43:22Z 171a607e Merge pull request #937 ...
```

The head commit's message is exactly "Officially sunset the repo", dated 2024-10-27, and the
commit before it is from 2016-03-21 — eight and a half years earlier. The repository is *not*
GitHub-archived (`"archived":false`); the sunset is the commit message only.

`stargazers_count` today is **2,855**, matching the ADR exactly, but as above this is a drifting
number and should carry a date.

---

## 6. awesome-selfhosted — ADR 0001

### 6.1 "will not list a project until its first release is four months old", and the rejection text states the count "initiates only after a release has been created"

**CONFIRMED verbatim, both halves.** Submissions live in
`awesome-selfhosted/awesome-selfhosted-data` (the list repo's PR template says "Please do not
submit pull requests in this repository").

The rule, `.github/ISSUE_TEMPLATE/addition.md` line 56:

> - [ ] Any software project you are adding was first released more than 4 months ago.

The rejection text, `CONTRIBUTING.md` under "Canned replies" → "First release less than 4 months
old", lines 126–134:

> Currently, this project has a release, but it is not yet 4 months old. Our guidelines require
> that Any software project you are adding was first released more than 4 months ago. **This
> count initiates only after a release has been created** to ensure users need not rely on the
> latest development version to use the project.

and the adjacent "No tagged releases" reply: "Once this is done, the project may be resubmitted to
awesome-selfhosted when the first release reaches the age of 4 months."

Also confirmed from the same file, and worth knowing: "Software with no development activity for
6-12 months may be removed from the list."

Checked: `gh api repos/awesome-selfhosted/awesome-selfhosted-data/contents/CONTRIBUTING.md` and
`.../contents/.github/ISSUE_TEMPLATE/addition.md`.


---

## 7. Calibre — ADR 0018, 0027, 0040, 0065

Repository `kovidgoyal/calibre`; bug tracker `bugs.launchpad.net/calibre` (queried through the
Launchpad API, `https://api.launchpad.net/1.0/calibre?ws.op=searchTasks`). All lookups 2026-09-10.

### 7.1 "Calibre put `series_index` on the book with `UNIQUE(book)`" (0018)

**CONFIRMED, exactly.** `resources/metadata_sqlite.sql` on `master`:

```sql
CREATE TABLE books ( id      INTEGER PRIMARY KEY AUTOINCREMENT,
                     title     TEXT NOT NULL DEFAULT 'Unknown' COLLATE NOCASE,
                     sort      TEXT COLLATE NOCASE,
                     timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                     pubdate   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                     series_index REAL NOT NULL DEFAULT 1.0,
                     ...
CREATE TABLE books_series_link ( id INTEGER PRIMARY KEY,
                                 book INTEGER NOT NULL,
                                 series INTEGER NOT NULL,
                                 UNIQUE(book)
                               );
```

`series_index` is a column on the book row (so one index per book, not per series), and the link
table's `UNIQUE(book)` allows a book at most one series. Compare `books_authors_link`, which is
`UNIQUE(book, author)` — the schema demonstrates on its own face that the single-series
restriction was a choice, not a limitation of the modelling.

Checked: `gh api repos/kovidgoyal/calibre/contents/resources/metadata_sqlite.sql`.

### 7.2 "they work around it by creating five custom columns" (0018)

**UNFOUNDED.** Nothing found in this run says five, or any other specific number.

MobileRead threads on exactly this question (363613 "Best method to implement multiple series for
1 book", 352138 "How to handle Books that belong to multiple series?", 352961 "Book in multiple
series", 267382 "Books in multiple series", all fetched 2026-09-10) describe the workaround
without a count. What they do say:

- `theducks`, thread 363613: "I do have a Second (custom) Series column, for when 2 series play
  together" and "I know of folk that have MANY custom series type columns just because the book /
  bundle has so many."
- `BetterRed`, thread 352138: "Add a Custom Column like this", grouping "the built-in series and
  the new one".
- `ownedbycats`, thread 352961: "a custom series-like column"; `maddz`: "a sub-series column".

The workaround is real and the ADR's point survives; **"five" is not in any source found**. Either
cite the specific post the number came from, or change the sentence to "they work around it by
adding extra custom series columns, one per extra series".

### 7.3 "a modal per-book matching step deleted in 2011 for a background queue plus optional review" (0027)

**CONFIRMED for the deletion and the replacement.**

The deletion: commit `571f50be`, `2011-04-30T19:14:23Z`, "Get rid of the test_eight_code tweak.
That means the next release will be 0.8.0!". Among the 25 files it touches, these are `removed`:

```
src/calibre/gui2/dialogs/fetch_metadata.py     removed
src/calibre/gui2/dialogs/fetch_metadata.ui     removed
src/calibre/gui2/dialogs/metadata_single.py    removed
src/calibre/ebooks/metadata/fetch.py           removed
src/calibre/ebooks/metadata/amazon.py          removed   (and amazonfr, covers, douban,
                                                          fictionwise, google_books, isbndb,
                                                          nicebooks)
```

`fetch_metadata.py` at `571f50be~1` opens `''' GUI for fetching metadata from servers. '''` and is
a `QDialog` driving a `Matches(QAbstractTableModel)` — i.e. a modal dialog that made you pick one
match, per book. 0.8.0 was released 2011-05-06 (`Changelog.old.txt`, `{{{ 0.8.0 2011-05-06`).

The replacement queue: `src/calibre/gui2/metadata/bulk_download.py` runs the download as a
`ThreadedJob` submitted with `gui.job_manager.run_threaded_job(job)`, batched by
`split_jobs(ids, batch_size=100)`.

The review is optional, and is literally gated on a flag —
`src/calibre/gui2/actions/edit_metadata.py`:

```python
if review:
    ...
    d = CompareMany(
        set(id_map),
        get_metadata,
        db.field_metadata,
        parent=self.gui,
        window_title=_('Review downloaded metadata'),
        ...
```

Calibre's own release page for 0.8 states the same thing in user terms: "When downloading metadata
for multiple books, the download now happens in the background, allowing you to continue working
while the download is happening." (https://calibre-ebook.com/new-in/eight, fetched 2026-09-10.)

### 7.4 "and has twice refused to reinstate a staged mode" (0027)

**UNFOUNDED as stated.** Launchpad was searched across `Won't Fix`, `Opinion`, `Invalid`, `New`,
`Confirmed`, `Triaged` and `Fix Released` on ten phrasings of the request (a wizard, one book at a
time, step through, confirm each, preview before apply, manual match selection). No pair of
refusals to reinstate a staged/modal per-book mode was found.

The two nearest things, and they are not that:

- Bug #926524, "[Enhancement] Select metadata fields after downloading", 2012-02-04, **Won't Fix**.
  Request: "It would be nice to be able to preview the download metadata then choose the needed
  fields." Kovid Goyal, same day: "This is not worth the effort, for me. Usually only one or two
  fields have information worse than the old info, in which case you can just manually correct."
- Bug #2164442, "Suggestion: Put a limit on batch download metadata", 2026-08-19, **Won't Fix**,
  closed 34 minutes after it was filed. That asks for a *cap on batch size*, not a staged mode,
  and the refusal is about load on metadata sources, not workflow.

Either replace "twice refused to reinstate a staged mode" with the #926524 refusal (which is a
real refusal of a preview-then-apply step, quotable, and dated), or drop the count.

### 7.5 "preferred format if set and available, then a fixed fallback chain" (0065)

**CONFIRMED.** `src/calibre/gui2/actions/view.py`, the function that decides which file opens:

```python
def preferred_format(formats):
    formats = tuple(x.upper() for x in formats if x)
    fmt = formats[0]
    for format in prefs['input_format_order']:
        if format in formats:
            fmt = format
            break
    return fmt
```

`_view_calibre_books` calls it directly: `fmt = preferred_format(formats)`.

The chain is `input_format_order`, a user-reorderable preference (Preferences → Behaviour) whose
default is fixed in `src/calibre/utils/config_base.py` — 17 entries, in order:

> EPUB, AZW3, MOBI, LIT, PRC, FB2, HTML, HTM, XHTM, SHTML, XHTML, ZIP, DOCX, ODT, RTF, PDF, TXT

with `help=_('Ordered list of formats to prefer for input.')`. The last-resort fallback when the
book has none of them is `formats[0]`, the book's own first format.

**One correction for ADR 0065.** The ADR says Calibre "is exactly this shape", where the shape is
"`is_default` is the owner's pin — nullable, at most one per item — and where nothing is pinned a
single declared edition order decides". Calibre has the **second half only**. `preferred_format`
consults nothing per book; there is no per-book format pin anywhere in the view path, and
`preferred_format` is used identically by the catalogue, FTS, e-mail and device code
(`gui2/dialogs/catalog.py`, `gui2/fts/search.py`, `gui2/email.py`, `gui2/device.py`,
`gui2/library/models.py`, `pyj/book_list/book_details.pyj`). The accurate sentence is "Calibre
implements the declared-order half and has no per-item pin at all."

### 7.6 "Calibre has none" — no unmerge/split (0040)

**CONFIRMED.** Calibre ships three merges and no reverse.

The merges, `src/calibre/gui2/actions/edit_metadata.py`:

```python
cm2('merge delete', _('Merge into first selected book - delete others'), triggered=self.merge_books)
cm2('merge keep',   _('Merge into first selected book - keep others'), triggered=partial(self.merge_books, safe_merge=True))
cm2('merge formats',_('Merge only formats into first selected book - delete others'), ...)
self.action_merge = cm('merge', _('Merge book records'), icon='merge_books.png', shortcut=_('M'), ...)
```

The reverse: `gh api -X GET search/code -f q='unmerge repo:kovidgoyal/calibre'` returns
`"total_count": 0` — the string does not appear anywhere in the codebase — and a Launchpad search
for an unmerge/undo-merge bug returns `total_size: 0`.

Worth recording alongside it: "Merge into first selected book — **keep others**" leaves the source
records in place, so a Calibre user can recover by hand from that variant. That is not a split
feature; it is the merge declining to delete.


---

## 8. Karakeep — ADR 0058, ADR 0001

Repository `karakeep-app/karakeep` (formerly `hoarder-app/hoarder`). All lookups 2026-09-10.

### 8.1 "the rename cost Docker image continuity" (0058)

**CONFIRMED, from the project's own release notes and its own migration doc.**

Release `v0.23.1`, published `2025-04-05T15:37:45Z`, titled "0.23.1 (Hoarder is rebranding to
Karakeep)":

> It's still unclear whether I'll be able to continue updating the hoarder docker image after the
> repo name change, so I wanted what might potentially be the last stable release on this image to
> inform the people about the change in the image name. If it turns out that I can continue
> updating the image, I'll drop the banner.
>
> Please note that the new docker image will not yet be available until I execute the repo
> transfer.

And the permanent doc, `docs/docs/06-administration/08-hoarder-to-karakeep-migration.md`:

> Hoarder is rebranding to Karakeep. **Due to github limitations, the old docker image might not be
> getting new updates after the rebranding.** You might need to update your docker image to point
> to the new karakeep image instead by applying the following change in the docker compose file.
>
> ```diff
> -    image: ghcr.io/hoarder-app/hoarder:${HOARDER_VERSION:-release}
> +    image: ghcr.io/karakeep-app/karakeep:${HOARDER_VERSION:-release}
> ```

Every user had to edit their compose file by hand. The doc still ships in every versioned docs
snapshot from v0.28.0 to v0.33.0.

### 8.2 The Firefox extension — "we couldn't get the old one back... you MUST migrate to the new one manually" (0058)

**CONFIRMED verbatim.** Release `v0.24.0`, published `2025-04-27T18:55:48Z`:

> ### ⚠️ The firefox extension is back under a new name (Action Required) ⚠️
>
> After the rebranding unfortunatly we couldn't get the old Firefox extension back, so we had to
> publish a new one ([link](https://addons.mozilla.org/en-US/firefox/addon/karakeep/)).
> If you're using the old "firefox" extension, you MUST migrate to the new one manually otherwise
> you won't be getting future updates.

(The typo "unfortunatly" is theirs.) The ADR's ellipsis joins two sentences that are adjacent in
the original, and both halves are quoted exactly.

### 8.3 "one [rename commit] touching 230 files" (0058)

**CONFIRMED, exactly.** `gh api repos/karakeep-app/karakeep/commits/755fc36e`:

```
2025-04-12  755fc36e  chore: Rename hoarder packages to karakeep
files = 230   +654 / -644
```

230 files, to the number. The next largest is `4296e7f4` "chore: rename missing files/conf from
Hoarder to Karakeep (#1280)" (2025-04-21) at 122 files, +255/−255 — pure churn, no net change.

### 8.4 "27 rename commits" (0058)

**UNFOUNDED — the number could not be reproduced by any method tried.** Counting commits on the
default branch by message:

| Window | matches "hoarder\|karakeep" | matches "rename\|rebrand" |
| --- | --- | --- |
| 2025-03-20 → 2025-05-10 (1 sprint) | 16 | — |
| 2025-03-01 → 2025-09-01 (423 commits) | 22 | 12 |
| 2025-04-01 → 2026-09-10 (1,254 commits) | 34 | 13 |

The tight rename cluster is **14 commits**, 2025-04-05 to 2025-04-21, plus two stragglers
(`5b912508` "fix: renamed export filename to karakeep", 2025-08-20; `7ff5a46f` "fix: rename root
package to @karakeep/root", 2026-07-12) — 16.

One plausible route to a higher number: the repository squash-merges, so a PR's own commits do not
appear on the default branch. PR #1199 ("chore: Hoarder to Karakeep rebranding", merged
2025-04-05, 18 files, +124/−52) is one commit on `main` but four commits in the PR. Counting PR
commits rather than merged commits could reach the high twenties, but that is a guess at the
method, not a reproduction of it.

The ADR's argument does not need the count: "230 files in one commit, across three months, and it
still cost the Docker image and the Firefox extension" carries it. Either cite the query that
produced 27 or drop it.

### 8.5 "Karakeep's and Audiobookshelf's [first release notes] were empty" (0001)

**CONFIRMED, both.**

- `karakeep-app/karakeep` `v0.1.0`, published `2024-02-20T22:14:16Z`, body length **0**.
  (Repo created `2024-02-06T12:28:31Z` → 14 days first-commit-to-first-tag, inside the ADR's
  4-to-39-day band.)
- `advplyr/audiobookshelf` `v1.0.0`, published `2021-09-04T19:37:05Z`, body length **0**. The next
  three releases (v1.1.8, v1.1.9, v1.1.10) are also empty.

Checked by paging `gh api "repos/<repo>/releases?per_page=100&page=N"` and reading
`.body | length` on the earliest `published_at`.


---

## 9. Kodi — ADR 0021 (and the extras claim in SPEC.md)

Sources: the Kodi wiki via its MediaWiki API (`https://kodi.wiki/api.php?action=parse&page=…&prop=wikitext&format=json` — the HTML pages are behind Cloudflare and return 403 to `curl` and to WebFetch, but the API answers), and `xbmc/xbmc` on GitHub. All lookups 2026-09-10.

### 9.1 "Kodi's `S01E01E04` names episodes 1 and 4 and EXCLUDES 2 and 3" (0021)

**CONFIRMED verbatim, down to the filename.** Kodi wiki, *Naming video files/Episodes*,
"Multi-Episode Files":

> * Only the episodes in the file name will be added, e.g. **''Angel (1999) S01E01E04.mkv''** will
>   scrape episodes 1 and 4 but not include episodes 2 and 3.

The wiki's own headline example for v21-and-below uses `S01E01E02E04`:

> **S01E01E02E04** = Season 1, Episode 1, 2 & 4
> *Note that Episode 3 is not included*

**One update the ADR should absorb.** The page is stamped `{{updated|22}}` and now opens the
Multi-Episode section with:

> Starting with Kodi v22 you can now specify episode ranges.
>
> **S01E01-E04** = Season 1, Episode 1, 2, 3 & 4
> *Note that Episodes 2 and 3 are included*

So Kodi now has **both** notations: concatenation (`S01E01E04`) is a set, and the new hyphen form
(`S01E01-E04`) is an interval. The ADR's claim is still true and the set semantics is still the one
that forces coverage-as-a-set, but "Kodi's notation is a set, not an interval" is now "Kodi's
notation is a set; since v22 it also has a separate interval form".

### 9.2 "Kodi keeps N items over one file" (0021)

**CONFIRMED.** Kodi wiki, *Bookmarks and chapters* → "Episode bookmarks", step 1:

> When you have a multipart episode or ISO file scanned into the library then Kodi will
> automatically display that one file as multiple episodes.

### 9.3 "per-episode bookmarks" (0021)

**CONFIRMED.** Same page:

> Starting in v13, you can set "episode bookmarks" for video files or ISOs that contain multiple
> episodes. This will allow you to jump directly to the point when a given episode begins, from the
> library, even if it is in the middle of the video file.

and *Naming video files/Episodes*: "When using a single video file for multiple episodes it is
possible to set episode bookmarks for each episode in the file."

The mechanism in code: `CVideoDatabase::AddBookMarkForEpisode` (`xbmc/video/VideoDatabase.h`,
used from `VideoInfoScanner.cpp` and `dialogs/GUIDialogVideoBookmarks.cpp`).

### 9.4 "the honest cost, which Kodi documents: one playback offset across a shared file still marks the wrong parts watched" (0021)

**CONFIRMED verbatim.** Kodi wiki, *Bookmarks and chapters* → "Episode bookmarks", in a `{{note}}`
box directly under the feature it documents:

> * **Kodi won't automatically mark individual episodes as watched. Watching the last episode in
>   the file can also cause all the episodes to show up as watched, since Kodi is going off of the
>   whole video file, rather than individual sections.**
> * If you watch part of the file, say one episode but not another, both episodes will show as
>   being in-progress and will prompt for a resume point. However, if you select "start from the
>   beginning" then Kodi will correctly go to the episode bookmark for that episode.

Kodi states the defect in its own manual, next to the feature. That is exactly what the ADR says.

### 9.5 "repeated `<episodedetails>` is Kodi's convention" (0021)

**CONFIRMED.** Kodi wiki, *NFO files/Episodes*, in the tag table:

| NFO (xml) Tag | Required | Multiple | Notes |
| --- | --- | --- | --- |
| `<episodedetails></episodedetails>` | Yes | **No/Yes** | The top level parent tag for the nfo file. All other tags must be contained within these two tags. **Yes - When creating multi-episode nfo files.** No - In all other cases, a single instance is used. |
| `<season></season>` | No | No/Yes | Season number is read from filename in all cases. Not required for single nfo files. **Required for multi-episode nfo files to match the metadata to the correct episode.** |
| `<episode></episode>` | No | No/Yes | ... **Required for multi-episode nfo files to match the metadata to the correct episode.** |

So repeated `<episodedetails>` blocks in one `.nfo`, each carrying its own `<season>`/`<episode>`,
is the documented Kodi format for a multi-episode file.

### 9.6 "Kodi models extras as child items" (SPEC.md line 1143, not carried by any ADR)

**CONTRADICTED.** Kodi models an extra as a **file role on a relation to the parent movie**, which
is the shape SPEC.md says "none of them" use.

`xbmc/video/VideoDatabaseDDL.cpp`:

```cpp
CLog::Log(LOGINFO, "create videoversiontype table");
db.ExecuteQuery(
    "CREATE TABLE videoversiontype (id INTEGER PRIMARY KEY, name TEXT, owner INTEGER, "
    "itemType INTEGER)");
...
CLog::Log(LOGINFO, "create videoversion table");
db.ExecuteQuery(
    "CREATE TABLE videoversion (idFile INTEGER PRIMARY KEY, idMedia INTEGER, media_type "
    "TEXT, itemType INTEGER, idType INTEGER)");
```

`xbmc/video/VideoManagerTypes.h`:

```cpp
enum class VideoAssetType : int
{
  VERSIONSANDEXTRASFOLDER = -2, //!< reserved for nodes navigation ... do not use in the db.
  UNKNOWN = -1,
  ALL = 0,   //!< reserved for nodes navigation ... do not use in the db.
  VERSION = 1,
  EXTRA = 2,
};
```

And `CVideoDatabase::AddVideoAsset` (`VideoDatabase.cpp` line 13088) writes **a `files` row and a
`videoversion` row and nothing else** — no `movie` row is created for an extra:

```cpp
idFile = AddFile(item.GetDynPath(), "", tag->m_dateAdded, tag->GetPlayCount(), tag->m_lastPlayed);
...
if (!AddOrUpdateVideoVersion(itemType, dbId, idFile, idVideoAsset, videoAssetType))
...
if (!SetArtForItem(idFile, MediaTypeVideoVersion, item.GetArt()))
```

An extra is therefore one row in `videoversion`, keyed by `idFile`, pointing at the parent
(`idMedia`, `media_type`), carrying `itemType = EXTRA` and a named `idType` from the
`videoversiontype` lookup — *the same table and the same axis as an alternate version*. Extras are
browsable beneath the movie (`VideoAssetType::VERSIONSANDEXTRASFOLDER`,
`filesystem/VideoDatabaseDirectory/DirectoryNodeMovieAssets.cpp`), which is presumably where "child
item" came from, but navigation position is not the model.

This repo already records the correct reading in
`docs/research/resolution/resolve-X7-X13.md`: "Kodi's answer is: **one file-to-work relation
carrying a two-value axis (version vs extra)**", with `extra_type` as a lookup table. SPEC.md line
1143 contradicts the repo's own resolution document and should be corrected.


---

## 10. W3C Reconciliation Service API — ADR 0032

### 10.1 "retrofitted versioning at v0.2 with exactly [absence means version 1]"

**CONFIRMED for the prose rule, CONTRADICTED for "never make the field required".**

Source: *Reconciliation Service API v0.2*, W3C Community Group Final Report,
`https://www.w3.org/community/reports/reconciliation/CG-FINAL-specs-0.2-20230410/`
(reached by following `https://reconciliation-api.github.io/specs/latest/` → `/0.2/` → the W3C
report). Fetched 2026-09-10.

The retrofit, §1.4.2 "0.2 (This Version)", first bullet in the change list:

> Let manifests announce which versions of the protocol are supported by the service;

The absence rule, §3.1 Service Manifest:

> **versions** — The array of API versions supported by the endpoint, such as `["0.1", "0.2"]`.
> **Since this field did not exist in version 0.1, services which do not declare a `versions`
> field are expected to only support version 0.1.**

So: an array, retrofitted at 0.2, absence means the earlier version. Exactly as the ADR says.

**But** ADR 0032 also says "Never make the field required — all three precedents avoided that".
This precedent did not. The spec's own normative manifest JSON schema (Appendix A.1) ends:

```json
"required" : [ "versions", "name", "identifierSpace", "schemaSpace" ]
```

`versions` is in `required`. The spec therefore says both things: the prose tolerates its absence
and infers 0.1, and the schema rejects a manifest without it. The ADR's rule is still the right
one — it is what the *prose* does — but "all three precedents avoided that" is false of this one,
and the tension inside the spec is itself the argument for the rule. Rewrite as: "the
Reconciliation API's prose does exactly this, while its own JSON schema contradicts it by listing
`versions` as required — which is the mistake to avoid."

---

## 11. OWASP — ADR 0034

Source: OWASP Cheat Sheet Series, *Server Side Request Forgery Prevention Cheat Sheet*,
`https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html`.
Fetched 2026-09-10.

### 11.1 "That is OWASP's Case 1, an identified and trusted destination"

**CONFIRMED verbatim.** The cheat sheet's Cases section:

> Depending on the application's functionality and requirements, there are two basic cases in which
> SSRF can happen:
> **Application can send request only to identified and trusted applications**: Case when
> allowlist approach is available.
> **Application can send requests to ANY external IP address or domain name**: Case when allowlist
> approach is unavailable.

and the section heading: "**Case 1 - Application can send request only to identified and trusted
applications**".

### 11.2 "OWASP files the deny-list under 'Deny-list (Last Resort)' and opens it 'Deny-lists are bypass-prone. Prefer allow-lists.'"

**CONFIRMED verbatim, both halves.** The section heading is literally
`Deny-list (Last Resort)` and its first sentence is literally:

> Deny-lists are bypass-prone. Prefer allow-lists. When unavoidable, block these minimum ranges:

followed by a table naming `169.254.169.254` for AWS IMDS, GCP Metadata and Azure IMDS, plus
`127.0.0.0/8`, `0.0.0.0/8`, `::1/128`, RFC1918 and multicast ranges. The `169.254.169.254` address
the ADR names in its "no exception ever" argument is the first row of OWASP's own table.

---

## 12. TMDB — ADR 0036, ADR 0037

Source: `https://www.themoviedb.org/api-terms-of-use`, fetched 2026-09-10 (the ADR records a check
on 2026-09-07; this is an independent re-check three days later and the text is unchanged).

### 12.1 'forbids caching "for longer than 6 months" — a CEILING — and it covers "any information"' (0036)

**CONFIRMED verbatim.** Under §1.C "Restrictions … In addition, You must not:", one bullet reads:

> Cache, for longer than 6 months, any information obtained through or from TMDB or the TMDB APIs.

It is a prohibition on caching *beyond* six months, i.e. a ceiling and not an obligation to hold
anything, and its object is "any information" with no distinction between a poster and a runtime.

### 12.2 The attribution notice, verbatim and prominent (0036)

**CONFIRMED verbatim.** §3 Attribution:

> You must use the TMDB logo to identify Your use of TMDB, the TMDB APIs, or TMDB Content. Any use
> of any TMDB logos in Your Application **must be less prominent than the logos or marks that
> primarily describe or identify Your Application** and must make it clear that use of any TMDB
> logos does not imply any endorsement, certification, or other approval by TMDB. In addition, You
> must place the following notice **prominently** in or on Your Application: **"This [website,
> program, service, application, product] uses TMDB and the TMDB APIs but is not endorsed,
> certified, or otherwise approved by TMDB."**

Both the notice string and the "logo must be less prominent than ours" rule are exact.

### 12.3 "using TMDB 'as an image hosting service' is prohibited" (0036)

**CONTRADICTED as stated — the clause is narrower.** The restriction reads, in full:

> Use TMDB as an image hosting service **for banner advertisements, graphics, etc.**

The prohibition is scoped to using TMDB as image hosting *for advertising material*, not to
serving TMDB images to your own users generally. The ADR treats this as one of two clauses that
"must be settled with TMDB before the public demo ships"; on the text as written it is a weaker
constraint than the ADR implies. The hotlinking decision in ADR 0037 does not depend on it.

### 12.4 "'destination' website … or for driving traffic" counts as commercial use needing a written agreement, judged "in its sole discretion" (0036)

**CONFIRMED.** §2 "Commercial Use — A. Commercial Use Requires a Commercial Agreement" lists among
"Common examples (which are by no means exhaustive) of commercial uses":

> Using TMDB, the TMDB APIs, or TMDB Content on or in connection with a "destination" website,
> search engine, or interactive query-response system (including large language model (LLM),
> artificial intelligence, or any other machine learning based interactive query-response systems
> or chatbots) ("Chatbot(s)"), or for driving traffic or generating revenue for a website, search
> engine, or Chatbot …

and the same paragraph: "TMDB reserves the right to monitor Your use or Your Application to make
or revise its determination." "Sole discretion" appears throughout the document, including in the
termination clause.

Worth adding to the ADR: the clause now names LLMs and chatbots explicitly.

### 12.5 "Termination requires purging all cached TMDB content" (0036)

**CONFIRMED verbatim.** §Termination:

> If TMDB terminates Your license, or You terminate your license, You must immediately cease all
> use of the TMDB APIs, TMDB Content, and any TMDB API key(s), and you must **promptly delete or
> otherwise purge all TMDB Content, including any cached content.**

### 12.6 "TMDB's own documented example returns 142 images for ONE item, 109 of them posters across 15 languages" (0037)

**JUDGEMENT — the figure is live data and does not reproduce today.** The example on
`https://developer.themoviedb.org/reference/movie-images` is a live response for movie 550, and
its contents change whenever a contributor uploads or removes an image. Read on 2026-09-10 it
shows on the order of **122 images — roughly 42 backdrops, 28 logos and 52 posters** across a
couple of dozen languages, not 142/109/15.

The ADR's point — that one item returns more images than any UI can use, most of them posters,
spread across many languages, so a per-role limit and a quality floor are fetch-time policy — is
unaffected and is if anything supported. But the exact triple must either carry the date it was
read or be replaced with "over a hundred images for one film, dozens of them posters across two
dozen languages".

---

## 13. create-better-t-stack — ADR 0053

Repository `AmanVarshney01/create-better-t-stack` (5,708 stars, last push 2026-09-10T08:42:59Z).
Templates read from `packages/template-generator/templates/`, 2026-09-10.

### 13.1 "the generated db schema file is literally `export {}`"

**CONFIRMED, literally.** `templates/db/drizzle/base/src/schema/index.ts.hbs` is, in its entirety:

```hbs
{{#if (eq auth "better-auth")}}
export * from "./auth";
{{/if}}
{{#if (includes examples "todo")}}
export * from "./todo";
{{/if}}
export {};
```

Under the ADR's verified config — `auth none`, no examples — both conditionals are false and the
rendered file is exactly `export {};`.

### 13.2 "the API router is a four-line health check"

**CONFIRMED in substance.** `templates/api/orpc/server/src/routers/index.ts.hbs`, with
`api = orpc`, `auth = none` and no examples, renders to:

```ts
import { publicProcedure } from "../index";
import type { RouterClient } from "@orpc/server";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
```

The router body is one procedure returning the string `"OK"` — four lines from `export const
appRouter` to the closing `};`. Nothing else is generated to rip out. The ADR's claim that "there
is nothing to rip out" is exactly right.

---

## 14. The Tardis Wiki — ADR 0069, ADR 0057

### 14.1 "EXPECT A 403 FROM THE LIVE WIKI … Cloudflare bot protection, which answers any non-browser client regardless of permission" (0069)

**CONFIRMED, re-verified 2026-09-10** (the ADR records 2026-09-05).

```
$ curl -sI https://tardis.wiki/wiki/Main_Page
HTTP/2 403
date: Thu, 10 Sep 2026 09:17:17 GMT
cf-mitigated: challenge
server: cloudflare
content-security-policy: ... https://challenges.cloudflare.com ...
```

`cf-mitigated: challenge` is Cloudflare's own header naming the reason. A plain `GET` on an
article URL also returns 403. Adding a browser `User-Agent` does not help (tested against the same
host's sibling `kodi.wiki`, which behaves the same way). Permission and technical access are
indeed separate things.

### 14.2 "Its text is CC BY-SA and its images are third-party copyright and excluded" (0057)

**CONFIRMED verbatim.** `Tardis:Copyrights` (oldid 3898282), read via
`https://web.archive.org/web/2026/https://tardis.wiki/wiki/Tardis:Copyrights` because the live host
403s:

> All material appearing on the Tardis Wiki is available for distribution under the **Creative
> Commons Attribution-Share Alike License 3.0 (Unported) (CC-BY-SA)** with no invariant sections
> and no cover texts. Material taken from this site should also be available for distribution
> under said license and should carry a notice to that effect.

and, separately:

> **Images are licensed separately to text. Their licenses can be found on their respective
> pages.**

The same page enumerates the third-party rights holders: "Doctor Who … the BBC's copyright. The K9
series is copyright Metal Mutt Productions. The term 'TARDIS' is trademarked by the BBC. The
Daleks are trademarked by the estate of Terry Nation. Bernice Summerfield is copyright Paul
Cornell. Some characters deriving from Big Finish Productions are Big Finish copyright."

So the ADR's rule — BY-SA attribution on anything published from it, never redisplay its images —
follows directly from the wiki's own copyright page.

---

## 15. MARC 21, PROV-O and Wikidata — ADR 0071

### 15.1 "MARC 21 field 883's worked example carries a version for exactly this reason"

**CONFIRMED.** MARC 21 Format for Bibliographic Data, **883 — Metadata Provenance (R)**, May 2020
revision. Read via `https://web.archive.org/web/2026/https://www.loc.gov/marc/bibliographic/bd883.html`
because `loc.gov` returns 403 to non-browser clients. Fetched 2026-09-10.

`$a` is "Creation process — Identifies the process used to produce the data contained in the linked
field." The worked example under `$c - Confidence value`:

```
082   04$81\p$a004$222/ger$qNO-OsNB
883   0# $8 1\p $a deweyclassifierv0.1 $d 20120101 $x 20141231 $q NO-OsNB $c 0,75 $0 (DE-101)040268942
```

The process name is `deweyclassifierv0.1` — **the version is inside the process identifier**,
which is precisely the `derived:palette-v2` shape ADR 0071 argues for. The field also carries a
confidence value (`$c`, "a floating point value between 0 and 1"), a creation date (`$d`) and a
validity end date (`$x`) — three more things this repo's statement row already has.

### 15.2 "PROV-O gives `prov:Agent` three subclasses — Person, Organization, SoftwareAgent"

**CONFIRMED.** W3C PROV-O Recommendation, `https://www.w3.org/TR/prov-o/`, the `prov:Agent` class
entry, fetched 2026-09-10:

> has subclasses: prov:Organization, prov:Person, prov:SoftwareAgent

with "A software agent is running software." So a program does fill the same slot an organisation
does, exactly as the ADR argues.

### 15.3 'Wikidata puts "based on heuristic" and "inferred from" in the same reference slot as "stated in"'

**CONFIRMED.** Queried `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=<P>&props=labels|descriptions&languages=en&format=json`, 2026-09-10. The three properties' own English descriptions:

| Property | Label | Description (Wikidata's own) |
| --- | --- | --- |
| P248 | stated in | "to be used **in the references field** to refer to the information document or database in which a claim is made" |
| P887 | based on heuristic | "indicates that the property value is determined based on some heuristic (Q201413); **to be used as source**" |
| P3452 | inferred from | "statement added based on related statement found within the item, not the entity described by the item (**to be used in a reference field**)" |

All three are reference-slot properties by Wikidata's own definition. Widening the slot rather
than adding a column is what Wikidata did.


---

## 16. next-forge and start-ui-web — ADR 0053 (considered options)

All lookups 2026-09-10.

### 16.1 "next-forge: Prisma, no typed RPC, SaaS-shaped, ~30% survives"

**Prisma: CONFIRMED. No typed RPC: CONFIRMED. SaaS-shaped: CONFIRMED. "~30% survives": JUDGEMENT.**

`gh api repos/vercel/next-forge` → `vercel/next-forge`, 7,669 stars, last push
`2026-05-28T14:33:12Z`.

Prisma — from the repository tree:

```
packages/database/prisma.config.ts
packages/database/prisma/schema.prisma
docs/content/docs/migrations/database/prisma-postgres.mdx
```

No typed RPC — `gh api -X GET search/code -f q='"@trpc" repo:vercel/next-forge'` returns
`total_count: 0`, and the same query for `"@orpc"` returns `total_count: 0`.

SaaS-shaped — its 21 workspace packages are:
`ai, analytics, auth, cms, collaboration, database, design-system, email, feature-flags,
internationalization, next-config, notifications, observability, payments, rate-limit, security,
seo, storage, typescript-config, webhooks`. Payments, CMS, collaboration, feature flags and
webhooks are not things a single-owner catalogue needs.

"~30% survives" is an estimate of fit, not a measurable property of the repository. It cannot be
confirmed or contradicted; keep it, but label it as the reviewer's estimate.

### 16.2 "start-ui-web: ~15% survives"

**JUDGEMENT.** `gh api repos/BearStudio/start-ui-web` → 1,746 stars, last push
`2026-09-10T07:21:46Z` — actively maintained, contrary to nothing the ADR claims. The "~15%"
figure is, again, an estimate of fit and is not checkable.


---

## 17. "Median first-commit-to-first-tag across the ten was 4 to 39 days" — ADR 0001

**CONTRADICTED by one of the ADRs' own ten, and the statistic is mis-named.**

Two problems.

**(a) It is not a median.** A median is one number. "4 to 39 days" is a range. Say "the range
across the ten was N to M days", or give the actual median.

**(b) Navidrome falls far outside it**, and ADR 0055 names Navidrome as one of the ten. Measured
from each repository's first commit to its first published release:

| Project | First commit | First release | Days |
| --- | --- | --- | --- |
| Immich (`immich-app/immich`) | 2022-02-03 | `v0.2-dev` 2022-02-08 | **5** |
| Karakeep (`karakeep-app/karakeep`) | 2024-02-06 | `v0.1.0` 2024-02-20 | **14** |
| Audiobookshelf (`advplyr/audiobookshelf`) | 2021-08-17 | `v1.0.0` 2021-09-04 | **18** |
| Komga (`gotson/komga`) | 2019-08-08 | `v0.1.0` 2019-08-27 | **19** |
| Kavita (`Kareadita/Kavita`) | 2020-12-12 | `v0.1` 2021-01-20 | **39** |
| **Navidrome (`navidrome/navidrome`)** | **2016-02-23** | **`v0.3.0` 2020-01-27** | **1,434** |

Five of the six sit neatly inside 5–39 days, and Kavita hits the stated ceiling of 39 exactly.
Navidrome is 1,434 days — nearly four years — because the project (as `deluan/gosonic`) went
dormant for most of 2016 to 2019 and published nothing until the web UI landed. Its earliest git
tag is `v0.3.0`; there is no `v0.1.0` tag in the repository.

(First commits taken from `gh api "repos/<r>/commits?until=<early date>"` and repository
`created_at`; first releases by paging `gh api "repos/<r>/releases?per_page=100&page=N"` and taking
the earliest `published_at`. All 2026-09-10.)

Either exclude Navidrome from the statistic and say so, or widen the claim: "eight of the ten
tagged within 5 to 39 days; the two that did not are the two that went quiet."


---

## 18. Immich — ADR 0027

### 18.1 "Immich regenerates dismissed duplicate groups verbatim"

**CONFIRMED.** Immich stores no record that a duplicate group was dismissed. "Keep all" / resolve
simply nulls `asset.duplicateId`; re-running detection over all assets re-derives the identical
group from the embeddings. The feature request for a dismissal memory has been open since
2024-09-13.

There is no `duplicate` table and no dismissal column in the schema. The only duplicate state on an
asset is a nullable grouping id (`server/src/schema/tables/asset.table.ts`):

```ts
@Column({ type: 'uuid', nullable: true, index: true })
duplicateId!: string | null;
```

Resolving a group only clears that id — `server/src/services/duplicate.service.ts`, `resolveGroup()`:

```ts
} else if (idsToKeep.length > 0) {
  await this.assetRepository.updateAll(idsToKeep, { duplicateId: null });
}
```

and the explicit dismissal API (`DuplicateRepository.delete`,
`server/src/queries/duplicate.repository.sql`) is the same nulling operation:

```sql
-- DuplicateRepository.delete
update "asset" set "duplicateId" = $1 where "ownerId" = $2 and "duplicateId" = $3
```

Detection then rebuilds the group purely from vector distance with no exclusion list —
`DuplicateRepository.search` filters only on `deletedAt`, `type`, `stackId`, `visibility` and
`distance <= maxDistance`.

Tracking issue: `immich-app/immich` discussion **12633, "[Feature] duplicate detection blacklist"**,
opened 2024-09-13, still open on 2026-09-10:

> each time I run duplicate detect, they just being select out again and as me to keep or not

Recent bug reports are closed *as duplicates of it*, not as fixed: issue **24892** "Duplicates
resolved with 'Keep all' reappear after running Duplicate Detection job on all images again"
(server 2.4.1, opened and closed `state_reason: duplicate` 2025-12-28, member `bo0tzz` commenting
only `#12633`); likewise issue 18411 ("Tracked in #12633").

**One precision to carry into the ADR.** A *non-forced* re-run does skip them, but via a processing
marker rather than a dismissal: `AssetJobRepository.streamForSearchDuplicates`
(`server/src/queries/asset.job.repository.sql:385`) filters
`and "job_status"."duplicatesDetectedAt" is null`. The group regenerates verbatim on a forced /
"All" run, or as soon as a new near-identical asset re-runs the search across the old ones. That is
exactly why #24892 is phrased "after running Duplicate Detection job on all images again".

---

## 19. OpenRefine and the Reconciliation API — ADR 0026, ADR 0027

### 19.1 "OpenRefine has no 'not a match' state at all"

**CONFIRMED.** OpenRefine's reconciliation judgment is a four-value enum — `None`, `Matched`,
`New`, `Error` — and `None` is the *unjudged default*, not a recorded rejection.

`modules/core/src/main/java/com/google/refine/model/Recon.java`, lines 71–76:

```java
static public enum Judgment {
    @JsonProperty("none")
    None, @JsonProperty("matched")
    Matched, @JsonProperty("new")
    New, @JsonProperty("error")
    Error
}
```

`None` is the field default (`public Judgment judgment = Judgment.None;`, line 134) and the
constructor fallback (line 413). It is indistinguishable from "never looked at".

The docs say the same — https://openrefine.org/docs/manual/reconciling:

> There is also a 'judgment' facet created, which lets you filter for the cells that haven't been
> matched (pick 'none' in the facet). As you process each cell, its judgment changes from 'none' to
> 'matched' and it disappears from the view.

The complete Reconcile → Actions menu contains no rejection: "Match each cell to its best candidate
(by highest score) / Create a new item for each cell / Create one new item for similar cells /
Match all filtered cells to… / **Discard all reconciliation judgments (reverts back to multiple
candidates per cell…)** / Clear reconciliation data". The nearest thing moves *away* from a
decision. A rejected candidate leaves the cell at `None`, which is the state the queue selects on —
so the queue refills with the same question. Exactly the ADR's point.

### 19.2 "OpenRefine splits /reconcile from /extend"

**CONFIRMED, with a naming correction: the route is `/match`, not `/reconcile`.**

Ratified v0.2 (https://www.w3.org/community/reports/reconciliation/CG-FINAL-specs-0.2-20230410/)
keeps them as separate top-level sections with separate schemas and separate wire parameters:

> §4.3: A reconciliation service MUST support HTTP POST requests on its endpoint with
> `application/x-www-form-urlencoded` bodies containing a reconciliation query batch (serialized in
> JSON) in a form element named **queries**.

> §7.3: A data extension service MUST support HTTP POST requests with
> `application/x-www-form-urlencoded` bodies containing a data extension query in a form element
> named **extend**.

Extension is optional and separately advertised: "The fact that a reconciliation service offers data
extension MUST be announced by including a data extension metadata in the **extend** field of the
service manifest."

The 1.0 draft (https://reconciliation-api.github.io/specs/1.0-draft/, "Overview of Possible
Routes") makes the split literal paths:

> `/match` — The route used to submit reconciliation query batches, with the POST method. Services
> MUST support this route;
> `/extend` — The route used to submit data extension queries, with the POST method. Services MAY
> support this route, depending on the presence of a data extension metadata object in their
> manifest;
> `/extend/propose` — The route used to obtain data extension property proposals, with the GET method.

The substance holds. If the ADR quotes a literal path, `/reconcile` should read `/match`.

---

## 20. Koha — ADR 0026

### 20.1 "Koha evaluates overlay rules as a policy at commit"

**CONFIRMED.** Koha's record overlay rules are a declared, context-matched rule set stored in
administration and evaluated automatically when a record is written, including at staged-import
commit. There is no per-record interactive merge step.

Koha Manual (latest), https://koha-community.org/manual/latest/en/html/administration.html,
"Record overlay rules":

> Record overlay rules allow for defining rules for how incoming and original MARC records should be
> merged on a field tag and context basis when a MARC record is updated.

> Every time a record is updated i Koha, a context is set an filter values populated with context
> dependent values. [sic]

> Only the rules of one context, that is a module and filter combination, are applied. If multiple
> contexts matches they are not merged together.

> If no context matches the default behavior is to overwrite, the original

The supported `source` contexts are the write paths, `batchimport` first: "batchimport / z39.50 /
intranet / bulkmarcimport / import_lexile / batchmod".

The source agrees. `Koha/MarcOverlayRules.pm` resolves the rule set purely from context, with no
user prompt:

```perl
sub merge_records {
    my ( $self, $old_record, $incoming_record, $context ) = @_;
    my $rules = $self->context_rules($context);
    # Default when no rules found is to overwrite with incoming record
    return $incoming_record unless $rules;
```

`C4/ImportBatch.pm`, `BatchCommitRecords` (line 532 onward) reads the batch policy up front —
`GetImportBatchOverlayAction`, `GetImportBatchNoMatchAction`, `GetImportBatchItemAction` — and on
the `replace` branch hands the overlay context to `ModBiblio`:

```perl
my $context = { source => 'batchimport' };
ModBiblio( $marc_record, $recordid, $overlay_framework // $oldbiblio->frameworkcode,
           { overlay_context => $context, ... } );
```

`C4/Biblio.pm` lines 451–463 then applies the rules unconditionally when the preference is on:
`if (C4::Context->preference('MARCOverlayRules') && $biblionumber && exists $options->{overlay_context}) { $record = ApplyMarcOverlayRules(...) }`.

---

## 21. MusicBrainz — ADR 0040, ADR 0071

### 21.1 "MusicBrainz has eleven merge edit types and zero unmerge" (0040)

**CONFIRMED, exactly eleven and exactly zero.** `lib/MusicBrainz/Server/Constants.pm` on `master`:

```perl
Readonly our $EDIT_ARTIST_MERGE       => 4;     # line 184
Readonly our $EDIT_LABEL_MERGE        => 14;    # line 194
Readonly our $EDIT_RELEASEGROUP_MERGE => 24;    # line 204
Readonly our $EDIT_RELEASE_MERGE      => 311;   # line 220
Readonly our $EDIT_WORK_MERGE         => 44;    # line 234
Readonly our $EDIT_PLACE_MERGE        => 64;    # line 253
Readonly our $EDIT_RECORDING_MERGE    => 74;    # line 262
Readonly our $EDIT_AREA_MERGE         => 84;    # line 273
Readonly our $EDIT_SERIES_MERGE       => 143;   # line 293
Readonly our $EDIT_INSTRUMENT_MERGE   => 134;   # line 302
Readonly our $EDIT_EVENT_MERGE        => 153;   # line 311
```

Plus a reserved slot confirming the list is deliberate (line 324):
`# 163 reserved for EDIT_GENRE_MERGE if ever implemented`, and two historic no-longer-creatable
types, `$EDIT_HISTORIC_MERGE_RELEASE => 223` and `$EDIT_HISTORIC_MERGE_RELEASE_MAC => 225`.

`grep -ni "unmerge\|un_merge\|SPLIT"` over the same file returns **no matches**.

https://musicbrainz.org/doc/Edit_Types lists the same eleven — Merge areas, artists, events,
instruments, labels, places, recordings, releases, release groups, series, works — with no unmerge,
split or unmatch entry anywhere on the page.

### 21.2 "MusicBrainz's design, where a bot is an ordinary account distinguished only by its username" (0071)

**CONTRADICTED.** `$BOT_FLAG` is a real privilege bit on the editor record, publicly exposed, set
by an administrator through a form, and load-bearing in behaviour.

`lib/MusicBrainz/Server/Constants.pm`, lines 408–432:

```perl
Readonly our $AUTO_EDITOR_FLAG              => 1;
Readonly our $BOT_FLAG                      => 2;
Readonly our $UNTRUSTED_FLAG                => 4;
...
Readonly our $PUBLIC_PRIVILEGE_FLAGS        => $AUTO_EDITOR_FLAG |
                                               $BOT_FLAG |
                                               $RELATIONSHIP_EDITOR_FLAG | ...
```

`lib/MusicBrainz/Server/Entity/Editor.pm` documents it as identity, not convention:

```perl
sub is_bot
{
    my $mask = $BOT_FLAG;
    return (shift->privileges & $mask) > 0;
}
```
with the POD `=head2 is_bot` — "The editor is a bot, not a human being".

It changes behaviour in at least two places. Bots cannot vote (`Editor.pm`, `may_vote`:
`... && !$self->is_bot && ...`), and only bots may submit edits cross-origin
(`lib/MusicBrainz/Server/Controller/WS/js/Edit.pm:775`):

```perl
if ($c->is_cross_origin && !$c->user->is_bot) {
    $c->forward('/ws/js/detach_with_error', ['cross-origin requests are allowed only for bot accounts', 403]);
}
```

An administrator sets it with a checkbox (`Controller/Admin.pm:223`:
`+ ($values->{bot} // 0) * $BOT_FLAG`), and MusicBrainz publishes the holders as an official
roster — https://musicbrainz.org/privileged:

> **Bots** — The following 49 user accounts are bots: AgenticCommonsBot, area_bot, arturito,
> bbc_music_bot, … ModBot, … UserDeleter, yyoung_bot

That roster defeats the naming-convention reading on its own: `arturito`, `citripio`, `surge`,
`FreeDB`, `musicmoz`, `Likedis Auto`, `Harry Botter`, `ListenBrainz`, `MetaBrainz OAuth`,
`tags-lastfm` and `UserDeleter` carry no `_bot` suffix. The username is decoration; the bit is the
mechanism.

**What is true, and is probably what the ADR meant:** the flag lives on the **editor**, not on the
**edit**. There is no per-edit bot marker, so an edit is attributed to a bot only transitively
through its editor's flag, and the provenance still lives in the edit history rather than on the
value. The narrower sentence survives; the one written does not.


---

## 22. TheTVDB — ADR 0035

### 22.1 "The defensible pattern is TheTVDB's: the project holds its own licence and the user supplies their own subscription credential"

**CONFIRMED.** TheTVDB documents exactly two access models, and the user-supported one requires each
end user to hold their own subscription and pass their own PIN alongside the project's API key.

`gh api repos/thetvdb/v4-api/contents/README.md`, 2026-09-10:

> We have two models for API access, both that provide funding that allows us to continue running
> and improving the site. The first is our negotiated license model, which allows commercial
> companies to negotiate access with us. The second is a user-subscription model, which allows end
> users to access the API if they are subscribed.

Same README, Best Practices → Direct API Access From End Users:

> You should contact us in advance to negotiate a contract (generally requiring attribution) or use
> a subscriber-supported API key that requires that each of your users has a $12/year TheTVDB
> subscription.

The mechanism is in the API itself — `docs/swagger.yml` (v4.7.10), line 6:

> Use the `/login` endpoint and provide your API key as "apikey". If you have a user-supported key,
> also provide your subscriber PIN as "pin". Otherwise completely remove "pin" from your call.

`/login` requires `apikey` and takes optional `pin` (swagger.yml lines 17–32). https://thetvdb.com/subscribe
prices it at "$11.99 per year" and lists as a benefit: "PIN for use with subscription-based
projects (not required for most projects)". https://thetvdb.com/api-information lists the
commercial tiers: free under $50k/year revenue (requires attribution), $1,000/year for
$50k–$250k, $10,000/year for $250k–$1M, "Contact Us" above.

**Caveat.** No lookup in this run found an explicit prohibition on redistributing API keys. The
structure enforces it — the project key alone is useless without each user's own PIN — but the ADR
should not claim a redistribution clause exists unless one is quoted.

---

## 23. MediaInfoLib — ADR 0042, ADR 0039

Repository `MediaArea/MediaInfoLib`. All lookups 2026-09-10.

### 23.1 "MediaInfoLib is BSD-2-Clause" (0042)

**CONFIRMED.** `gh api repos/MediaArea/MediaInfoLib --jq '.license'`:

```json
{"key":"bsd-2-clause","name":"BSD 2-Clause \"Simplified\" License","spdx_id":"BSD-2-Clause"}
```

and the `LICENSE` file opens "BSD 2-Clause License / Copyright (c) 2002-2025, MediaArea.net SARL".

Worth knowing, from `License.html`: "You can relicense (including source headers change)
MediaInfoLib under Apache License 2.0 or later, and/or GNU Lesser General Public License 2.1 or
later, and/or GNU General Public License 2.0 or later, and/or Mozilla Public License 2.0 or later."
And the binary-redistribution attribution string: "This product uses MediaInfo library, Copyright
(c) 2002-2025 MediaArea.net SARL."

### 23.2 "MediaInfo over ffprobe because it contains NO ENCODER" (0042)

**CONFIRMED, and the evidence is stronger than the claim.** MediaInfoLib is read-only in practice,
because even its metadata-*writing* API is declared but unimplemented. `Source/MediaInfo/MediaInfo.h`:

```cpp
/// (NOT IMPLEMENTED YET) Save the file opened before with Open() (modifications of tags)
size_t Save ();

/// (NOT IMPLEMENTED YET) Set a piece of information about a file (parameter is an integer)
/// @warning Not yet implemented, do not use it
size_t Set (const String &ToSet, stream_t StreamKind, size_t StreamNumber, size_t Parameter, const String &OldValue=String());
```

The whole public API is `Open` / `Open_Buffer_*` / `Get` / `Inform` / `Option` / `Count_Get` /
`Close`. The `Source/MediaInfo/` tree is parsers (`File_*.cpp`) plus `Export/` serialisers that emit
text and XML reports, not media. There is no codec, muxer or encoder path. The library cannot
produce a media file, which is what makes "direct play only" structurally true rather than
policy-enforced.

### 23.3 "MediaInfoLib reads chapters" (0042)

**CONFIRMED.** Chapters are a first-class stream kind. `Source/MediaInfo/MediaInfo_Const.h`,
lines 61–71:

```cpp
enum stream_t
{
    Stream_General,                 ///< StreamKind = General
    Stream_Video,                   ///< StreamKind = Video
    Stream_Audio,                   ///< StreamKind = Audio
    Stream_Text,                    ///< StreamKind = Text
    Stream_Other,                   ///< StreamKind = Chapters
    Stream_Image,                   ///< StreamKind = Image
    Stream_Menu,                    ///< StreamKind = Menu
    Stream_Max
};
```

`Source/MediaInfo/Tag/File_VorbisCom.cpp` extracts them into the Menu stream:

```cpp
else if (Key.find(__T("CHAPTER"))==0)
{
    if (Count_Get(Stream_Menu)==0)
    {
        Stream_Prepare(Stream_Menu);
        Fill(Stream_Menu, StreamPos_Last, Menu_Chapters_Pos_Begin, Count_Get(Stream_Menu, StreamPos_Last), 10, true);
```

`Source/MediaInfo/Text/File_TimedText.cpp` does the same with `Menu_Chapters_Pos_End`.

### 23.4 "MediaInfoLib returns `Album`, `Album/Performer` and `Track/Position` in the same call as duration" (0039)

**CONFIRMED — all three exact identifiers are field names in the source.**

`Album` — `Source/MediaInfo/Tag/File_Id3v2.cpp:1364`:
```cpp
case Elements::TAL  : Fill(Stream_General, 0, "Album", Element_Value); break;
```
and `Source/MediaInfo/Multiple/File_Mpeg4.cpp:3112` / `:3155`:
```cpp
case Elements::moov_meta___alb : Parameter="Album"; Method=Method_String; break;
case Elements::moov_meta__albm : Parameter="Album"; Method=Method_String2; break;
```

`Album/Performer` — `Source/MediaInfo/Multiple/File_Mpeg4.cpp:3153` (the MP4 `aART` atom):
```cpp
case Elements::moov_meta__aART : Parameter="Album/Performer"; Method=Method_String2; break;
```
and `File_VorbisCom.cpp`:
```cpp
Fill(StreamKind_Common, 0, (Performers==Artists || Performers.empty())?"Album/Performer":"Album/Composer", AlbumArtists.Read());
```

`Track/Position` — `File_VorbisCom.cpp`:
```cpp
else if (Key==__T("TRACKNUMBER"))            Fill(StreamKind_Multiple, 0, "Track/Position", Value);
```
`File_Mk.cpp` maps Matroska's `PART_NUMBER` onto it, and `File_Dummy.cpp:130` pairs the enum with
the name: `Fill(Stream_General, 0, General_Track_Position, "Track/Position");`

Note from `Changes.txt`, in case older docs turn up: `"Track" is now "Track/Position". Be warned :
"Track" is used, but for other things`.

---

## 24. Splink — ADR 0028

### 24.1 "Splink documents [accuracy] as gameable by guessing the majority class"

**CONFIRMED, almost word for word.**
https://moj-analytical-services.github.io/splink/topic_guides/evaluation/edge_metrics.html,
fetched 2026-09-10:

> The simplest metric is Accuracy = (True Positives + True Negatives) / All Predictions. This
> measures the proportion of correct classifications (of any kind).

> This may be useful for balanced data but **high accuracy can be achieved by simply assuming the
> majority class for highly imbalanced data (e.g. assuming non-matches).**

The same page extends the critique to F-score: "F-score does not account for class imbalance in the
data, and is asymmetric (i.e. it considers the prediction of matching records, but ignores how well
the model correctly predicts non-matching records)."

Splink's parenthetical "(e.g. assuming non-matches)" is worth borrowing into the ADR, because it
names the exact degenerate strategy for record linkage — which is the reason the ADR insists the
labelled fixture contain rows whose correct answer is "no match".

---

## 25. Wikidata and Open Library undo-merge requests — ADR 0040

### 25.1 "Wikidata's request for an undo tool has been open since 2019 and Open Library's since 2021"

**CONFIRMED on existence, dates and status.**

Wikidata — Phabricator **T237262, "Tool for undoing Wikidata merges"**, authored by Jarekt on
**4 November 2019**, status **Open** (https://phabricator.wikimedia.org/T237262, checked 2026-09-10):

> One of the very common Wikidata task is item merging which in most parts works great.
> Unfortunately some fraction of the merges are wrong, for whatever reasons: cluelessness,
> vandalism, hasty merges, etc. […]
> We need a tool for easy un-merge. Right now un-merging involves:
> 1. Restoring merged item to the previous version
> 2. Restoring redirect to the previous version
> 3. The third step should be review of all the links to the new item to figure out which item to
>    assign it to. This step is especially painful.

Open Library — GitHub issue **internetarchive/openlibrary#5664, "Undo bad author merge"**, opened
**2021-09-16**, state **open**, last updated 2026-08-12, labelled `Module: Merging` / `Priority: 2` /
`Needs: Investigation`:

> A bad author merge cannot be reversed and is subsequently preventing the reversal of bad
> work/edition edits.
> * Actual: Sorry. There seems to be a problem with what you were just looking at.
> * Expected: Merge should be reversed.

### 25.2 "both naming the same cause"

**JUDGEMENT — overstated as written.** The tickets name *related* but not identical causes.
Wikidata's is that no undo tool exists and manual reversal is a three-step process whose hardest
step is re-attributing inbound links. Open Library's is that the existing "Undo All" action errors
out, and the failure cascades into blocking unrelated reversals.

The common ground the ADR is reaching for is real — a merge destroys the information needed to
reverse it, and the reverse operation was never built to match the forward one — but neither ticket
says that in those words. Reword to "both still open, and both trace it to reversal never having
been built to match the merge".

---

## 26. Spotify Web API — ADR 0066

### 26.1 "Spotify's API names the parameter `context` with an `offset`"

**CONFIRMED in substance, with a precision fix: the parameter is `context_uri`, not `context`, and
`offset` is a sibling object rather than a field inside it.**

https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
(PUT `/me/player/play`), checked 2026-09-10:

- **`context_uri`** (string, optional): "Spotify URI of the context to play. Valid contexts are
  albums, artists & playlists." Example: `{context_uri:"spotify:album:1Je1IMUlBXcx1Fz0WE7oPT"}`
- **`uris`** (array of strings, optional): "A JSON array of the Spotify track URIs to play."
- **`offset`** (object, optional): "Indicates from where in the context playback should start.
  **Only available when context_uri corresponds to an album or playlist object.**" Zero-based and
  non-negative; takes either `position` (index) or `uri` (a specific track).
  Example: `"offset": {"position": 5}`
- **`position_ms`** (integer, optional): starting position in milliseconds.

The ADR's point — that Spotify models "a place within a collection" as a context plus an offset,
which is the same shape as `?via=<placement-id>` plus a derived next — survives intact. Two edits:
`context` → `context_uri`, and note the offset-only-valid-with-album-or-playlist constraint, which
is a real restriction on the pattern.

---

## 27. Disney+ MCU chronology — ADR 0017

### 27.1 "Disney+ revised its own MCU chronology in August 2025, replacing the work at the head of the timeline"

**CONFIRMED via secondary source.** Disney+ replaced *Captain America: The First Avenger* with
*Eyes of Wakanda* at the head of its "Marvel Cinematic Universe in Timeline Order" collection on
1 August 2025.

https://thedirect.com/article/disney-mcu-timeline-order-replaced, published 1 August 2025, read
2026-09-10:

> At 3 a.m. on August 1, 2025, Disney+ added *Eyes of Wakanda* to the MCU Timeline Order, replacing
> 2011's *Captain America: The First Avenger*.

The chronology holds up independently: *Eyes of Wakanda* is a four-episode animated anthology set
in 1260 B.C., 1200 B.C., 1400 A.D. and 1896 A.D., all four episodes released to Disney+ on
1 August 2025, against *The First Avenger*'s 1940s setting.

**Source-quality caveat.** This is a secondary source. No lookup in this run reached a Disney or
Marvel primary statement about the collection's ordering, and the collection itself is a streaming
surface with no versioned public record — which is, ironically, the ADR's point about orderings
being dated claims by named sources. If the ADR leans on it, cite The Direct explicitly rather than
implying Disney documented the change.


---

## 28. Magento — ADR 0015

### 28.1 "Magento silently DELETES every scoped value when an attribute's scope changes, with no confirmation and no reverse"

**CONFIRMED on the delete and the absence of confirmation; CONTRADICTED on "an attribute's scope
changes" — the delete fires only when scope narrows TO Global.**

`app/code/Magento/Catalog/Model/ResourceModel/Attribute.php` on `2.4-develop`, lines 91–107,
checked 2026-09-10:

```php
protected function _clearUselessAttributeValues(\Magento\Framework\Model\AbstractModel $object)
{
    $origData = $object->getOrigData();

    if ($object->isScopeGlobal() && isset(
        $origData['is_global']
    ) && \Magento\Eav\Model\Entity\Attribute\ScopedAttributeInterface::SCOPE_GLOBAL != $origData['is_global']
    ) {
        $attributeStoreIds = array_keys($this->_storeManager->getStores());
        if (!empty($attributeStoreIds)) {
            $delCondition = [
                'attribute_id = ?' => (int)$object->getId(),
                'store_id IN(?)' => $attributeStoreIds,
            ];
            $this->getConnection()->delete($object->getBackendTable(), $delCondition);
        }
    }
```

It is called unconditionally from `_afterSave()`. `StoreManagerInterface::getStores($withDefault = false, …)`
excludes store 0, so the default row survives and every store-view override is destroyed by a raw
`delete()` with no backup table and no reverse.

**No confirmation exists.** The Scope control is a plain select whose only note is
`__('Declare attribute value saving scope.')`
(`Block/Adminhtml/Product/Attribute/Edit/Tab/Advanced.php` lines 251–262), and
`grep -c "confirm"` on `Controller/Adminhtml/Product/Attribute/Save.php` returns `0`. Adobe's admin
guide says only: "To indicate where in your store hierarchy the attribute can be used, set
**Scope**." — no warning, caution or note.

**The narrowing.** A Store View → Website change does *not* trigger the delete; only a change whose
new value is Global does. The ADR's sentence is broader than the code. Fix it to "when an
attribute's scope is narrowed to Global", which is also the sharper version of the argument: it is
the narrowing itself that makes the data unrepresentable.

---

## 29. Shopify — ADR 0015

### 29.1 "Shopify's validation-status field"

**CONFIRMED.** Shopify carries validation status at both the definition and the individual
metafield level, and existing invalid values are preserved rather than rejected.

https://shopify.dev/docs/api/admin-graphql/latest/objects/MetafieldDefinition, checked 2026-09-10:

> `validationStatus` — `MetafieldDefinitionValidationStatus!` (non-null) — "The validation status
> for the metafields that belong to the metafield definition."

`MetafieldDefinitionValidationStatus` — "Possible metafield definition validation statuses.":

> `ALL_VALID` — All of this definition's metafields are valid.
> `IN_PROGRESS` — Asynchronous validation of this definition's metafields is in progress.
> `SOME_INVALID` — Some of this definition's metafields are invalid.

`MetafieldValidationStatus` (per metafield): `ANY`, `INVALID` ("Invalid (according to
definition)."), `VALID`. It is an argument to `MetafieldDefinition.metafields(validationStatus)` and
`MetafieldDefinition.metafieldsCount(validationStatus)` — so the offenders are enumerable and
countable, which is precisely the "mark the property as having offenders and let you list them"
behaviour ADR 0015 adopts.

The preserve-don't-reject behaviour, from `metafieldDefinitionCreate`:

> When you create a new definition, the system validates any existing unstructured metafields
> matching the same owner type, namespace, and key against it. The system updates each valid
> metafield's type to match the definition. **Invalid metafields remain unchanged but must conform
> to the definition when updated.**

Validation is asynchronous: `metafieldDefinitionUpdate` returns `validationJob: Job`, "The
asynchronous job updating the metafield definition's validation_status."

**One correction for the ADR.** https://shopify.dev/docs/apps/build/metafields/definitions carries
a Caution: "Tightening validations may fail if existing metafields violate the new constraint." So
the mark-don't-reject guarantee is documented for definition *creation*; on *update* Shopify
reserves the right to refuse the tightening outright. ADR 0015 says "Tightening a rule never
rejects existing rows either" — of Shopify that is true on create and not guaranteed on update.

---

## 30. OpenMRS — ADR 0012

All lookups 2026-09-10. Primary source is OpenMRS's own forum, `talk.openmrs.org`, read through its
Discourse JSON API.

### 30.1 "OpenMRS let its observation table reach 27 million rows"

**CONFIRMED verbatim, and the PIH attribution is explicit in the same post.**
`https://talk.openmrs.org/t/…/16631.json`, post #2, Mark Goodrich, 2018-03-08T14:44:00.775Z:

> We have a obs table with 27 million obs in it, and there were five schema changes to it that each
> took close to an hour, if not more, to run.

and, in the same post: "We are in the process of upgrading the PIH EMR to 2.1.x…".

Note the framing: the source treats 27M as merely large enough to make DDL painful, not as a
failure. "Let it reach" is the ADR's editorial, not OpenMRS's.

### 30.2 "~260 million at AMPATH"

**CONFIRMED as a figure; the AMPATH attribution is inferred, not stated.** Same thread, post #6,
`achachiez` (Emmanuel Nyachoke), 2018-03-09T05:43:02.040Z:

> First there were changes in the obs table and when you have close to 260 millions rows in the obs
> table that is a challenge.

The post does not name the implementation. Post #7 by the same user links
`AMPATH/amrs-db-upgrade-scripts` (created 2018-02-06, "Upgrade scripts for amrs 1.11.x to 2.1.2"),
which is the same migration. The trajectory corroborates it: AMPATH reported "almost 220 millions
obs, almost 800K patient records, and almost 6 millions encounters" in March 2016
(talk.openmrs.org/t/platform-1-11-5-or-above-in-implementation/5067) and "over 123 million records"
in 2012 (OpenMRS Confluence, "Obs Table Efficiency Review").

### 30.3 "five schema changes, each costing about an hour of downtime"

**CONTRADICTED as written.** Five changesets at about an hour of *runtime* each is confirmed; the
downtime is the thing PIH refused to pay and engineered around.

Confirmed half — https://talk.openmrs.org/t/challenges-with-large-data-during-platform-upgrade/16340,
Goodrich, 2018-02-27:

> there are five changesets that modify the obs table, and on our database they take about an hour
> to run each.

Contradicting half — same thread, Goodrich, 2018-03-08:

> We've confirmed that 4 of the 5 changesets (the ones that ADD and DROP) can be run "online"
> without locks in MySQL 5.6 (though they still take about an hour each to run)… The changeset that
> alters the value_complex requires a full column copy and can take take 1-2 hours to run

> I was working yesterday on using Percona Toolkit to do this and have come up with something that
> appears to be working… it takes a few hours to run, but allows all 5 changesets to be run while
> the system is "online"…

and in thread 16631 post #2: "we couldn't afford to have 5+ hours of downtime."

Five hours of downtime is what PIH *avoided* with `pt-online-schema-change`. If ADR 0012 says PIH
absorbed it, fix the sentence to "each schema change cost about an hour to run, and PIH had to
adopt online-schema-change tooling to avoid five hours of downtime".

### 30.4 "every serious deployment independently built a flat ETL"

**JUDGEMENT — directionally supported, "every" unsupported.** Independent flat-table ETLs
verifiably exist and were built separately:

| Project | Created | Description |
| --- | --- | --- |
| `AMPATH/etl-rest-server` | 2015-09-30 | "This project hosts scripts to generate flat tables used for reporting purposes." |
| `Bahmni/bahmni-mart` | 2018-02-15 | |
| `ohs-foundation/fhir-data-pipes` | 2020-08-07 | |
| `openmrs/openmrs-module-mamba-etl` | 2023-03-02 | |

MambaETL's README states the underlying problem — "the Obs table quickly grows to millions of
records in fairly sized facilities making reporting and any analysis on such data incredibly
difficult and slow" — but frames itself as a starter reference, not as a consolidation of
duplicated work. No primary source asserts universality. Reword to "several major deployments each
built their own flat ETL", naming AMPATH, Bahmni and MambaETL.

---

## 31. Migration tools — ADR 0047

All lookups 2026-09-10.

### 31.1 The version tables

**CONFIRMED, all five, from each tool's own source or docs.**

| Tool | Table | Evidence |
| --- | --- | --- |
| Alembic | `alembic_version` | `alembic/runtime/migration.py` L182–183: `self.version_table = version_table = opts.get("version_table", "alembic_version")` |
| Flyway | `flyway_schema_history` | Red Gate docs, `flyway-namespace/flyway-table-setting`: "The name of Flyway's schema history table." Default `flyway_schema_history` |
| Rails | `schema_migrations` + `ar_internal_metadata` | `activerecord/lib/active_record/model_schema.rb` L169–170: `class_attribute :schema_migrations_table_name, … default: "schema_migrations"`; `… :internal_metadata_table_name, … default: "ar_internal_metadata"` |
| Django | `django_migrations` | `django/db/migrations/recorder.py` L40: `db_table = "django_migrations"` |
| EF Core | `__EFMigrationsHistory` | `src/EFCore.Relational/Migrations/HistoryRepository.cs` L31: `public const string DefaultTableName = "__EFMigrationsHistory";` |

### 31.2 "NONE has a quarantine concept"

**CONFIRMED.** `gh api -X GET search/code -f q="quarantine repo:<R>"` returns `total_count: 0` for
`sqlalchemy/alembic`, `django/django`, `rails/rails`, `dotnet/efcore`, `dotnet/EntityFramework.Docs`
and `flyway/flyway`, with live-index controls in the same run returning non-zero. A full enumeration
of Flyway's ~80-setting configuration namespace contains no row-level setting of any kind.

What each does on failure is abort-and-roll-back at *migration* granularity:

> **Flyway:** "Execute V001 / If success, commit and continue; else rollback (if possible) and stop
> - do not process any further pending migrations"
> **Rails:** "A transaction ensures that if a migration fails partway through, any changes that were
> successfully applied are rolled back, maintaining database consistency"
> **Django:** "if a migration fails to apply you will have to manually unpick the changes in order
> to try again (it's impossible to roll back to an earlier point)"
> **EF Core:** "The transaction handling and continue-on-error behavior of these tools are
> inconsistent and sometimes unexpected. This can leave your database in an undefined state if a
> failure occurs when applying migrations."

Name the nearest misses precisely, because they are not quarantines:

- Flyway's `errorOverrides` (Teams edition) — "Rules for the built-in error handler that let you
  override specific SQL states and errors codes in order to force specific errors or warnings to be
  treated as debug messages, info messages, warnings or errors." Keyed on SQL state and error code,
  tolerating every occurrence blindly, recording nothing and **counting nothing**.
- Django's `--fake` and Flyway's `skipExecutingMigrations` mark whole migrations applied without
  running them.
- Rails' `disable_ddl_transaction!` removes the safety net rather than adding a quarantine.

The ADR's "this is the one place we are ahead" holds.

---

## 32. GitLab — ADR 0034

### 32.1 The local-network allowlist shape

**CONFIRMED on all eight items**, from the docs, with the two numeric limits independently
corroborated in GitLab source. https://docs.gitlab.com/security/webhooks/, "Allow outbound requests
to certain IP addresses and domains", checked 2026-09-10. Entries can:

> Be separated by semicolons, commas, or whitespaces (including newlines).
> Be in different formats like hostnames, IP addresses, IP address ranges. IPv6 is supported.
> Hostnames that contain Unicode characters should use Internationalized Domain Names in
> Applications (IDNA) encoding.
> Include ports. For example, `127.0.0.1:8080` only allows connections to port 8080 on `127.0.0.1`.
> If no port is specified, all ports on that IP address or domain are allowed. An IP address range
> allows all ports on all IP addresses in that range.
> **Number no more than 1000 entries of no more than 255 characters for each entry.**
> **Not contain wildcards (for example, `*.example.com`).**

The doc's own example block settles CIDR and both IP families:

```
example.com;gitlab.example.com
127.0.0.1,1:0:0:0:0:0:0:1
127.0.0.0/8 1:0:0:0:0:0:0:0/124
[1:0:0:0:0:0:0:1]:8080
127.0.0.1:8080
example.com:8080
```

Corroboration in `gitlab-org/gitlab` source:

```ruby
# app/models/application_setting.rb:170
validates :outbound_local_requests_whitelist,
  length: { maximum: 1_000, message: N_('is too long (maximum is 1000 entries)') },
```

```ruby
# app/validators/qualified_domain_array_validator.rb:31
def validate_host_length(record, attribute, value)
  return unless value&.any? { |entry| entry.size > 255 }
  record.errors.add(attribute, _('entries cannot be larger than 255 characters'))
```

Hostnames ✓ IPv4 ✓ IPv6 ✓ CIDR ✓ host:port ✓ 1000 entries ✓ 255 characters ✓ no wildcards ✓.

---

## 33. Nielsen Norman Group — ADR 0046

### 33.1 '"Do not use confirmation dialogs for routine actions", reviewed 2026-08-07'

**CONFIRMED, sentence verbatim and review date exact.**
https://www.nngroup.com/articles/confirmation-dialog/ — "Confirmation Dialogs Can Prevent User
Errors — If Not Overused", Jakob Nielsen. Fetched 2026-09-10:

> **Do not use confirmation dialogs for routine actions.** Like in Aesop's fable, if you cry wolf
> too many times, people will stop paying attention to the question, and the confirmation dialog
> will lose its power to prevent errors.

Dates, from the byline and the page's JSON-LD:

> Jakob Nielsen — February 18, 2018 · Last reviewed Aug. 7, 2026

```json
"datePublished": "2018-02-18T17:00:00+0000", "dateModified": "2026-08-07T17:59:09+0000"
```

The ADR's stated review date of 2026-08-07 matches exactly.

---

## 34. Streamyfin, Expo and the client stack — ADR 0054

All lookups 2026-09-10.

### 34.1 "Streamyfin … wrote ~144KB of Swift around MPVKit — since grown to 538KB plus 634KB of Kotlin"

**CONFIRMED, all four parts — and the ~144KB figure pins to a date.**

`streamyfin/streamyfin`, 5,185 stars, description "A modern Jellyfin client built with Expo",
default branch `develop`. MPVKit is a real native dependency —
`modules/mpv-player/ios/MpvPlayer.podspec`:

```ruby
Pod::Spec.new do |s|
  s.name             = 'MpvPlayer'
  s.summary          = 'MPV-based video player for Streamyfin (Expo module)'
  s.platforms        = { :ios => '15.1', :tvos => '15.1' }
  s.dependency 'ExpoModulesCore'
  s.dependency 'MPVKit'
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
```

Current byte totals at HEAD `a637de22` (2026-09-10T09:00:33Z), via
`gh api "repos/streamyfin/streamyfin/git/trees/HEAD?recursive=1"`:

- `.swift`: **537,748 bytes** across 57 files → 538KB, exact.
- `.kt` + `.kts`: **634,101 bytes** across 66 files → 634KB, exact.

The largest Swift files are all MPV: `modules/mpv-player/ios/MPVLayerRenderer.swift` (70,993 bytes),
`modules/mpv-player/ios/NativePlayer/PlayerViewModel.swift` (57,687).

The ~144KB figure is exact and datable:

| Date | Commit | `.swift` bytes |
| --- | --- | --- |
| 2026-06-01 (`v0.54.1`) | — | 132,001 |
| 2026-08-02 | `592c4a61` | 140,513 |
| 2026-08-05 | `b7942505` | 140,821 |
| **2026-08-08** | **`d1a9ae8c`** | **143,874** |
| 2026-08-09 | `888dba46` | 332,191 |
| 2026-09-10 | `a637de22` | 537,748 |

143,874 bytes on 2026-08-08 is the ~144KB the ADR recorded. Swift grew 3.7× in five weeks.

### 34.2 "expo-video wraps AVPlayer with no MKV, no DTS or TrueHD and no PGS subtitles"

**AVPlayer half CONFIRMED from source. Format half is JUDGEMENT — Expo publishes no
supported-format list at all, so there is nothing to cite and nothing to contradict.**

`packages/expo-video/ios/VideoPlayer.swift`:

```swift
import AVFoundation
import MediaPlayer
import ExpoModulesCore

internal final class VideoPlayer: SharedRef<AVPlayer>, Hashable, VideoPlayerObserverDelegate {
```

`VideoPlayerItem.swift`: `import AVKit` / `class VideoPlayerItem: AVPlayerItem`. The docs corroborate
the AVKit dependency in passing, describing `VideoAssetTransport` as being for "when a source cannot
be handled by `AVKit` directly and needs native preprocessing."

Subtitles are AVFoundation media selection only — `ios/VideoPlayerSubtitles.swift`:

```swift
if let group = currentItem.asset.mediaSelectionGroup(forMediaCharacteristic: .legible) {
```

`availableSubtitleTracks` is populated purely by iterating `.legible` media selection groups. There
is no external-subtitle API: `VideoSource` (`src/VideoPlayer.types.ts`) exposes only `uri`,
`assetId`, `drm`, `metadata`, `headers`, `useCaching`, `contentType`, with
`ContentType = 'auto' | 'progressive' | 'hls' | 'dash' | 'smoothStreaming'`.

But on formats Expo says nothing either way. Grepping the full 487-line docs source
(`docs/pages/versions/unversioned/sdk/video.mdx`) for `mkv|matroska|dts|truehd|pgs|codec|container`
returns no matches; the live docs page carries no list of supported containers, codecs or subtitle
formats. The one supporting data point in `expo/expo` is issue #35643 (2025-03-22, closed): "MKV
video takes 10 seconds to load and stutters. It plays instantly in vlc and IINA player."

**Recommend rewording** to attribute the limits to AVFoundation — which the source proves
expo-video is built on — rather than to an Expo statement that does not exist.

### 34.3 "react-native-web has been frozen since October 2025"

**CONFIRMED.** Last commit and last release are the same day, 2025-10-16.

```
gh api repos/necolas/react-native-web --jq '{default_branch, pushed_at}'
{"default_branch":"master","pushed_at":"2025-10-16T15:10:21Z"}

commits: a9de220b 2025-10-16T15:08:40Z "0.21.2"
releases: 0.21.2 published 2025-10-16T15:10:42Z ; 0.21.1 published 2025-08-20T20:42:39Z
```

`gh api "repos/necolas/react-native-web/commits?sha=master&since=2025-10-16T15:08:41Z" --jq 'length'`
returns `0`. npm agrees: `dist-tags.latest` = `0.21.2`, published 2025-10-16T15:09:40.363Z. Just
under 11 months.

### 34.4 "Expo Router's architect left in May 2026"

**CONFIRMED, with a primary source.** Evan Bacon published "Farewell Expo" on 2026-05-30
(https://evanbacon.dev/blog/expo; the page's JSON-LD carries
`"datePublished":"2026-05-30T00:00:00.000Z"`):

> I just finished my last week at Expo. For the past nine years, this project has been the center
> of my life. I discovered the early Exponent app when I was a teenager… Getting to actually join
> the team at 19 felt unreal.

GitHub corroborates the timing: his last commit to `expo/expo` is `b48c394a`, 2026-05-28T21:27:15Z,
two days before the post; his public events since are personal repos, with one `expo/expo` issue
comment on 2026-08-18; his GitHub profile `company` field is now `null`.

**Caveat for the ADR.** The post is about leaving Expo the company, and describes work across Expo
Router *and* the Expo Dev Tools team. It is not a statement about Expo Router losing maintenance.
(Also: his site's meta description is stale and still reads "Currently reimagining mobile software
with Expo" — do not cite that as counter-evidence.)

### 34.5 "Solito v5 dropped react-native-web entirely"

**CONFIRMED, and the release notes say it in those words.**
`gh api repos/nandorojo/solito/releases/tags/v5.0.0` (published 2025-10-21T23:45:01Z):

> Solito 5 drops react-native-web as a dependency. It now works with zero special configuration on
> Web. On iOS and Android, nothing has changed.
>
> - Headless and unstyled on web. Solito no longer depends on React Native Web.
>
> This is the new source code for `solito/link` on Web:
> ```tsx
> export { default as Link } from 'next/link'
> ```

"Entirely" holds against the shipped package: `curl -s https://registry.npmjs.org/solito/latest`
gives version 5.0.0 with `dependencies: {"typescript": "^5.0.4"}` and no peerDependencies.
`react-native-web` appears in neither dependencies, peerDependencies nor devDependencies.

### 34.6 "Expo's own website runs Next.js"

**CONFIRMED.** `curl -sI https://expo.dev` — the `vary` header names four Next.js App Router request
headers:

```
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
link: <https://static.expo.dev/_next/static/chunks/3v_-qsqnfh_je.css>; rel=preload; as="style"
```

and `curl -s https://expo.dev | grep -o '/_next/[a-zA-Z0-9._/-]*'` returns `/_next/image` plus dozens
of `/_next/static/chunks/*`. `x-powered-by` is stripped, but `rsc` / `next-router-*` in `vary` is App
Router specific.

### 34.7 "Unistyles, whose podspec is iOS-only and cannot install on tvOS"

**CONFIRMED, and the maintainers state it outright — a better citation than the podspec.**

The podspec is the mechanism. `packages/unistyles/Unistyles.podspec` on `main` (v3.3.0):

```ruby
  s.platforms    = { :ios => min_ios_version_supported }
```

`tvos` does not appear. For contrast, Streamyfin's own MPV podspec declares
`{ :ios => '15.1', :tvos => '15.1' }`, so CocoaPods integrates that into a tvOS target and will not
integrate Unistyles.

The stronger source is the project's own FAQ,
`apps/docs/src/content/docs/v3/other/frequently-asked-questions.mdx`:

> ### What happened to `macOS`, `windows`, `visionOS`, `tvOS` support?
>
> For now they're not available. We're seeking sponsors to help us add support, as they are rarely
> used by our customers.

Cite that line rather than the build file. There is no open tvOS issue; the tvOS-specific ones are
all closed — #178 "feat: add support for tvOS" (2024-04-06), #216 "feat: use new core with tvos"
(2024-06-23), #938 "[tvOS] Crash on reload when using updateTheme" (2025-07-28) and #949
"React-native-tvos support for TV with expo" (2025-08-07, closed the next day) — and the last two
are people attempting it on the `react-native-tvos` fork and hitting autolinking and crash failures,
which supports the claim.

---

## 35. create-t3-turbo and ShipFullStack — ADR 0053

### 35.1 "create-t3-turbo: unmoved since 2025-12-12, pinning better-auth 1.4.0-beta.9 against a stable 1.7.2"

**CONFIRMED on the date and the pin; the stable version has ticked to 1.7.3.**

(a) Last commit on `main` is 2025-12-12, nine months ago:
`gh api repos/t3-oss/create-t3-turbo/branches/main` →
`{"sha":"8f945b7bb3bfb3ca8358d48b1ff0214079bc11ee","date":"2025-12-12T02:00:04Z","msg":"for real..."}`.
Preceding commits: `2025-12-12 bump react again (#1491)`, `2025-12-03 bump react (#1489)`.

**Do not quote the repo's `pushed_at`**, which reads `2026-09-10T02:03:35Z` — that is Renovate
pushing to its own branches (17 of 20 branches are `renovate/*`, including
`renovate/better-auth-monorepo`). `main` itself has not moved. This is, incidentally, the exact
mechanism the ADR complains about: "the review sites call it maintained BECAUSE THEY READ RENOVATE
BRANCHES."

(b) The pin, `pnpm-workspace.yaml`:

```yaml
catalog:
  "@better-auth/cli": 1.4.0-beta.9
  "@better-auth/expo": 1.4.0-beta.9
  better-auth: 1.4.0-beta.9
```

Four package.json files consume it via `"better-auth": "catalog:"` (`apps/expo`, `apps/nextjs`,
`apps/tanstack-start`, `packages/auth`); `pnpm-lock.yaml` line 4316 resolves `better-auth@1.4.0-beta.9`.

(c) Current stable on npm is **1.7.3**, published 2026-09-06 — four days ago.
`curl -s https://registry.npmjs.org/better-auth` →
`dist-tags: {latest: 1.7.3, beta: 1.7.0-beta.10, rc: 1.7.0-rc.6, release-1.4: 1.4.22, canary: 1.0.0-canary.14}`.

The ADR's "1.7.2" was right when written and has since ticked; a pinned npm version is a drifting
number and should carry its date. The gap is also wider than the version numbers suggest:
better-auth maintains a `release-1.4` line now at `1.4.22`, so the template is 22 patches behind
even on the branch its beta belongs to.

### 35.2 "ShipFullStack: frozen 2025-11-03, and no `packages/` directory at all"

**`packages/` half CONFIRMED. Freeze date CONTRADICTED in a minor but checkable way.**

The repo is `sunshineLixun/ShipFullStack` (116 stars, sole name match, created 2025-09-30, not
archived, single branch `master`), described as "A modern TypeScript stack that combines React,
TanStack Start, Hono, ORPC, Expo, and more."

`gh api "repos/sunshineLixun/ShipFullStack/commits?per_page=5"`:

```
f39f51f2 2026-05-28T01:11:21Z Update README.md
60045ada 2025-11-03T11:02:55Z refactor: remove sidebar wrapper from dashboard layout
0cfc34fe 2025-11-03T10:42:00Z feat: replace GitHub link with theme switcher in header
9343f7a6 2025-11-03T10:17:13Z feat: improve auth UI and update environment config
dbb90a3d 2025-11-02T15:25:18Z feat: add theme switcher component with light/dark modes
```

2025-11-03 is the last *code* commit, correct — but the tip commit is a README edit six months
later, so "frozen 2025-11-03" is falsifiable by anyone running `git log -1`. Reword to "no code
changes since 2025-11-03".

No `packages/` directory. `gh api "repos/sunshineLixun/ShipFullStack/git/trees/HEAD"` top level:

```
.augment  .claude  .cursor  .github  .gitignore  .husky  .kilocode  .kiro
.npmrc  .ruler  .rules  .vscode  .windsurf  GEMINI.md  README.md
apps  biome.json  bts.jsonc  package.json  pnpm-lock.yaml
pnpm-workspace.yaml  tsconfig.json  turbo.json
```

`apps` is the only workspace directory. It has `turbo.json` and `pnpm-workspace.yaml` but nothing
shared to put in them, which is the ADR's point. Incidental: nine AI-agent config directories at the
root against one `apps` directory.


---

## 36. Summary

**99 claims checked, one per `###` heading above.**

- **77** wholly CONFIRMED.
- **11** carry a CONTRADICTED element — 8 wholly contradicted, 3 contradicted in part
  (10.1 W3C Reconciliation, 28.1 Magento, 35.2 ShipFullStack).
- **3** UNFOUNDED.
- **8** carry a JUDGEMENT element — 5 wholly, 3 in part (5.2 Sick Beard's star count,
  16.1 next-forge's "~30%", 34.2 expo-video's format list).

Every CONFIRMED verdict above carries a lookup performed on 2026-09-10.

### The 11 CONTRADICTED

| # | ADR | Claim | What the owner actually says |
| --- | --- | --- | --- |
| 1.1 | 0043 | Audiobookshelf "began from an opaque anonymous token with no row behind it" | A signed JWT carrying `userId` and `username`, persisted in `users.token` (`User.js` v2.25.1 L431). It had a row; it had no *session* row. |
| 1.9 | 0065 | Audiobookshelf users "are told to put the narrator in the FILENAME" | The **folder** name. `scandir.js` `getNarrator()` matches `^(?<title>.*) \{(?<narrators>.*)\}$` against the directory; the docs' examples are folders. |
| 1.10 | 0065 | The multi-narration feature "is marked not planned" | #2396 is **open**, `state_reason: null`, labelled `enhancement`/`backlog`. The repo has no `not planned` label. What exists is a maintainer comment: "it's unlikely it gets added". |
| 9.6 | SPEC.md:1143 | "Plex, Jellyfin and **Kodi** all model an extra as a child item" | Kodi models it as a **file role**: one `videoversion` row keyed on `idFile` with `itemType = EXTRA`, in the same table and on the same axis as an alternate version. No `movie` row is created. This repo's own `resolve-X7-X13.md` already says so. |
| 10.1 | 0032 | "Never make the field required — **all three precedents avoided that**" | The Reconciliation API's own manifest JSON schema ends `"required": ["versions","name","identifierSpace","schemaSpace"]`. Its prose infers 0.1 from absence; its schema rejects absence. |
| 12.3 | 0036 | Using TMDB "as an image hosting service" is prohibited | The clause is narrower: "Use TMDB as an image hosting service **for banner advertisements, graphics, etc.**" |
| 17 | 0001 | "first-commit-to-first-tag across the ten was 4 to 39 days" | Navidrome, named as one of the ten in ADR 0055, is **1,434 days** (2016-02-23 → `v0.3.0` 2020-01-27). Also, "median" is used for what is a range. |
| 21.2 | 0071 | MusicBrainz, "where a bot is an ordinary account distinguished only by its username" | `$BOT_FLAG => 2` is a privilege bit (`Constants.pm` L408-432). It gates voting and cross-origin submission, an admin sets it with a checkbox, and MusicBrainz publishes the 49 holders at /privileged — many with no `_bot` in the name. |
| 28.1 | 0015 | Magento deletes scoped values "when an attribute's scope changes" | Only when scope is narrowed **to Global**. `_clearUselessAttributeValues` is guarded by `$object->isScopeGlobal() && … SCOPE_GLOBAL != $origData['is_global']`. Store View → Website is safe. |
| 30.3 | 0012 | "five schema changes … each cost about an hour of **downtime**" | About an hour of **runtime** each. PIH said "we couldn't afford to have 5+ hours of downtime" and ran all five online with Percona `pt-online-schema-change`. |
| 35.2 | 0053 | "ShipFullStack: **frozen 2025-11-03**" | Last *code* commit is 2025-11-03, but the tip commit is `f39f51f2 "Update README.md"`, 2026-05-28. "No code changes since 2025-11-03" is the version that survives a `git log -1`. |

### The 3 UNFOUNDED

| # | ADR | Claim | What was found instead |
| --- | --- | --- | --- |
| 7.2 | 0018 | Calibre users "work around it by creating **five** custom columns" | No source found in this run gives any number. Four MobileRead threads on exactly this question describe it without a count; the closest is `theducks`: "I know of folk that have MANY custom series type columns just because the book / bundle has so many." |
| 7.4 | 0027 | Calibre "has **twice** refused to reinstate a staged mode" | Launchpad searched across seven statuses on ten phrasings; no pair found. The nearest single refusal is bug #926524 (2012-02-04, Won't Fix), a preview-then-choose-fields request, refused with "This is not worth the effort, for me." |
| 8.4 | 0058 | Karakeep: "**27** rename commits" | Not reproducible by any method tried. Default-branch commits matching `hoarder\|karakeep`: 16 in the sprint, 22 over six months, 34 over seventeen. The tight rename cluster is 14 commits (2025-04-05 → 2025-04-21). The repo squash-merges, so a PR-commit count could reach the high twenties — but that is a guess at the method, not a reproduction of it. |

### The 8 JUDGEMENT calls

- **5.1, 5.2 (0001)** Readarr "3,471 stars" and Sick Beard "2,855" — star counts drift daily. Today: Readarr **3,470**, Sick Beard **2,855**. Attach a date or drop the digits. (Sick Beard's commit message "Officially sunset the repo", `c36f21f8`, 2024-10-27, is CONFIRMED.)
- **12.6 (0037)** TMDB's documented images example "142 images, 109 posters, 15 languages" — live data. Read 2026-09-10 it is roughly 122 images / 52 posters. The argument is unaffected; the triple needs a date.
- **16.1, 16.2 (0053)** next-forge "~30% survives", start-ui-web "~15% survives" — estimates of fit, not properties of the repositories. (next-forge's Prisma, its zero `@trpc`/`@orpc` references and its SaaS-shaped package list are all CONFIRMED.)
- **25.2 (0040)** Wikidata's and Open Library's undo requests "both naming the same cause" — both tickets exist, both are open, both dates are right, but they name related rather than identical causes.
- **30.4 (0012)** "**every** serious deployment independently built a flat ETL" — four independent ones verified (AMPATH `etl-rest-server` 2015, `Bahmni/bahmni-mart` 2018, `fhir-data-pipes` 2020, `openmrs-module-mamba-etl` 2023). No source asserts universality.
- **34.2 (0054)** expo-video "no MKV, no DTS or TrueHD and no PGS subtitles" — the AVPlayer wrapping is CONFIRMED from source; Expo publishes no supported-format list at all, so the limits are a correct inference from AVFoundation rather than an Expo statement.

### Numbers that have ticked since the ADRs were written

- ADR 0053: better-auth stable is now **1.7.3** (published 2026-09-06), not 1.7.2.
- ADR 0055: Komga has had no first-party app for **7 years 1 month**, not six years.
- ADR 0001: Readarr is at 3,470 stars, not 3,471.

### Also worth folding in

- **ADR 0021**: Kodi v22 added an inclusive range form, `S01E01-E04` = "Season 1, Episode 1, 2, 3 & 4 — *Note that Episodes 2 and 3 are included*". Concatenation remains a set; there are now two notations.
- **ADR 0026/0027**: the Reconciliation API route is `/match`, not `/reconcile`.
- **ADR 0066**: the Spotify parameter is `context_uri`, and `offset` is a sibling object valid only with an album or playlist context.
- **ADR 0065**: Calibre implements the *declared-order* half and has no per-item pin at all, so "exactly this shape" overstates it.
- **ADR 0015**: Shopify's preserve-don't-reject guarantee is documented for definition *creation*; on *update* the docs caution "Tightening validations may fail if existing metafields violate the new constraint."
- **ADR 0035**: no redistribution-prohibition clause was found in TheTVDB's terms; the two-key structure enforces it, but do not claim a clause exists.
- **ADR 0017**: the Disney+ change rests on a secondary source (The Direct, 2025-08-01); Disney published nothing.
- **ADR 0027**: Immich's non-forced re-run *does* skip already-processed assets, but via `job_status.duplicatesDetectedAt`, not a dismissal. The group regenerates verbatim on a forced/"All" run.
- **ADR 0053**: `create-t3-turbo`'s `pushed_at` reads 2026-09-10 because Renovate pushes to its own branches. `main` has not moved since 2025-12-12 — which is exactly the ADR's own point about review sites reading Renovate branches.

### Out of scope for this pass

Plex, Jellyfin and Emby claims (covered in `verify-adr-plex.md` and `verify-adr-jellyfin.md`);
standards documents rather than products (IFLA LRM, LRMoo, BIBFRAME, schema.org, Dublin Core,
OAI-ORE, IIIF, Wikibase, Readium); and claims about the owner's own DuckDB archive (ADR 0016's
category graph, ADR 0030's 70/1,566/6.7% measurements, ADR 0057's 2.3GB, ADR 0070's
11,089/8,212/851 credit counts), which cannot be checked from outside the repo.
