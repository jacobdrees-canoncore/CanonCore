# Build-order research: self-hosted media catalogue projects

STATUS: complete (2026-09-05). All ten projects researched; all eight questions answered.
Started: 2026-09-05
Method: git history (GitHub API), release notes/tags, changelogs, issue trackers. Primary sources only; dated commits and release notes preferred over blog claims.

Projects in scope: Komga, Kavita, Audiobookshelf, Navidrome, Immich, Karakeep, Stash, Calibre-Web, Romm, Suwayomi.
Two caveats on "started from scratch": **Calibre-Web is a fork** (of `raphaelmutschler/calibreserver`, 2015-08-02) and inherits both its app and Calibre's schema — it is included because that inheritance is itself one of the most instructive findings. **Suwayomi is not a fork** but copied Tachiyomi's extension source verbatim in commit 1. Immich's public history begins with a squashed transfer from a private GitLab repo, so its true pre-launch build order is not recoverable.

## Contents
1. Komga · 2. Cross-cutting evidence log (demos, solo-maintainer, outcomes, mobile) · 3. Kavita · 4. Audiobookshelf · 5. Navidrome · 6. awesome-selfhosted 4-month rule · 7. Karakeep · 8. Stash · 9. Calibre-Web · 10. Q5 first-six-months tables & analysis · 11. Q6 mobile finding · 12. Q8 solo-developer findings · 13. Romm · 14. Immich · 15. Suwayomi · 16. **What the evidence suggests about build order** (final section)

Per-project source files were consolidated into this document and then deleted. Every
non-blank line of the nine section files was tested for a verbatim match here first; exactly one
failed, and only because this version drops the words "Research in progress." from a pass that had
finished. See `../supersession-check-2.md`.

---

## Komga (comics/manga, Kotlin + Spring Boot)

Repo: https://github.com/gotson/komga — single maintainer (Gauthier Roebroeck) for the first year.

### 1. First release: 19 days
- First commit `6b0d849` "initial commit", **2019-08-08**.
- First tag **v0.1.0, 2019-08-27** (19 days). Release notes, verbatim and complete:
  > "First release, support for `cbr` and `cbz` archives"
  https://github.com/gotson/komga/releases/tag/v0.1.0
- That is the ENTIRE release note. No web UI, no users, no metadata. It was a REST API + scanner + Docker image.
- Cadence after: v0.2.0 (PDF) 2019-08-30; v0.3.0 (WEBP thumbnails) 2019-09-06; v0.4.0 (OPDS) 2019-09-23. Four feature releases in the first 47 days.

### 2. Build order — scanner first, schema grown, UI last
Reconstructed from the first ~45 commits (all Aug 2019):
1. **Filesystem scanner** — commit #2, `b16d66a` 2019-08-10 "fix FileSystemScanner.kt". The scanner exists before anything else.
2. **Domain entities** — `57bfc54` 2019-08-13 "added updated time to Serie and Book". Two entities. Series + Book, nothing more.
3. **Rescan/idempotency** — `b83b1d0` 2019-08-13 (tests written before implementation), `e1af347` 2019-08-15 "rescan and persist, conserving ids".
4. **Archive extraction** — `5216881` / `08c78f6` 2019-08-16 (cbz then cbr).
5. **DTOs / HTTP layer** — `7fde944` 2019-08-18 "make URL as String in DTOs"; endpoints appear `656b89d` 2019-08-20 "add endpoint to get latest series".
6. **Migrations tooling added on day 11** — `1c67491` 2019-08-19 "added flyway for db migrations". Note the ordering: the model was written first, Flyway was bolted on once it existed.
7. **Thumbnails** `5c153bf` 2019-08-19; async parsing `cb867ff` 2019-08-20.
8. **Docker** `733c0ee` 2019-08-22 sample docker-compose; `cbaa3a0` 2019-08-27 gradle docker push — same day as v0.1.0.
9. **Web UI: `b059788` 2019-10-04 "first version of the webui"** — 57 days after first commit, **38 days after v0.1.0**.

The data model was grown, not designed up front, and this is explicit in the history: `ebad597` **2019-12-30** "rename book metadata to media, **to avoid confusion later on when proper metadata is added**". For the first five months "metadata" meant "parsed file structure". Real user-facing metadata (`f522142` series metadata status 2020-01-21, `5f0ccc5` webui metadata editing 2020-01-30) arrived ~5 months after v0.1.0.

### 3. Feature arrival, relative to v0.1.0 (2019-08-27)
| Capability | When | Delta |
|---|---|---|
| Docker image | 2019-08-27 (`cbaa3a0`) | day 0 |
| Third-party client works (Tachiyomi) | 2019-08-28 `7ca2880` "fixed a regression where Tachiyomi could not retrieve pages" | +1 day |
| OPDS feed w/ Page Streaming | commit `55fb8da` 2019-09-11, shipped v0.4.0 2019-09-23 | +27 days |
| Web UI | `b059788` 2019-10-04 | +38 days |
| **Multi-user accounts** | `c182165` 2019-10-15, shipped **v0.7.0 2019-10-22** | +56 days |
| Real metadata model/editing | 2020-01-21 … 2020-01-30 | +~5 months |
| **Official public demo** (demo.komga.org) | `24b2125` "feat: demo profile", **v0.19.0 2020-03-05** | **+191 days** |
| EPUB support | `0a06a6f` 2020-04-09 | +7.5 months |
| Kobo Sync | `210c7b1` 2024-08-27 | +5 years |
| Official mobile app | **never** — no official app; the docs point at the web UI, OPDS, and the OpenAPI spec. Third-party apps (Tachiyomi/Mihon extension, Panels, etc.) do the job. | n/a |

Note the shape: **a third-party mobile reader worked on day 1 after release, because Komga implemented OPDS rather than an app.** Multi-user was the first thing after the UI, and it shipped as a breaking change (v0.7.0: "`admin` and `user` users are deprecated and replaced by the User Management feature").

### 4. What they rewrote
Two full persistence-layer replacements inside the first year, both after ~40+ releases:
- **Hibernate/JPA → jOOQ**: `75e1079` "feat: migrate DAO from Hibernate to jOOQ", **v0.31.0, 2020-06-01** (+279 days). The whole DAO layer.
- **H2 → SQLite**: `20b2b39`, **v0.48.0, 2020-07-16** (+324 days). Release note, verbatim:
  > "This is a major change, but done transparently. If you need help, please check https://komga.org/faq/#migration-from-h2-to-sqlite. At startup, a migration from H2 to SQLite will be triggered … All the data will be transferred from H2 to SQLite before the startup of the application (before the API can serve any requests)."
  Followed by `f84ba17` 2020-07-21 "fix: fix database migration errors" — the migration was not painless.
- Note the *pattern*: the early data model was cheap enough to keep, but the ORM and the engine underneath it were both wrong choices that had to be swapped. The entities survived; the plumbing did not.

**Komga takeaway:** shipped a scanner + REST API + Docker image with two entities in 19 days, added a UI at day 57, users at day 56-after-release, metadata at ~5 months, a demo at ~6 months, and never built a mobile app at all.

---

## Cross-cutting evidence log (appended as gathered)

### Public demo instances — raw dated evidence

| Project | Demo? | First dated evidence |
|---|---|---|
| Komga | Yes, demo.komga.org | `24b2125` "feat: demo profile", **v0.19.0 2020-03-05** — 191 days after v0.1.0. Docs: "A demonstration website is available at: https://demo.komga.org" with public creds demo@komga.org / komga-demo (https://komga.org/docs/introduction/) |
| Kavita | Yes | `b0b64cf` "Added demo to readme", **2021-06-26** |
| Navidrome | Yes, demo.navidrome.org | `ca10e80` "Add demo site to README.md", **2020-07-14**; still maintained — `1e4e3ea` "fix: update Makefile with new demo URLs (#4080)" 2025-05-19 |
| Immich | Yes, demo.immich.app | Requested in issue #720 "[Feature]: Web Demo" opened **2022-09-19** by @meichthys ("a web demo that potential users could use to get a quick look and feel"). A demo already existed by then but was "temporarily offline … just not linked to from anywhere yet". Dedicated repo `immich-app/demo` created **2023-01-11** (`6c6e688` "Initial commit", `1cd6bcf` "Move files from old repo" — so the demo predates the repo). Uploads later disabled due to abuse; setup since folded into immich-app/devtools. |
| Karakeep (ex-hoarder) | Yes | `96829e3` "feature: Basic support for demo mode" **2024-02-20**; `64fb87d` "feature(web): Add support for demo mode" 2024-03-19; `d9d6725` "fix(web): Only show demo mode banner in demo mode" 2024-03-19 |
| Audiobookshelf | **No demo commits found** in the server repo (searched `repo:advplyr/audiobookshelf demo`, zero commit hits). Evidence for an official demo is absent. |
| Calibre-Web | **No demo commits found** (`repo:janeczku/calibre-web demo`, zero hits); the README has no demo section or link. |
| Romm | Yes — docs.romm.app links "Website · Demo · Discord" → https://demo.romm.app. First-appearance date not established. |
| Stash | **No live demo.** README offers only a recorded SFW walkthrough video (Vimeo). |
| Suwayomi | **No demo found** — no demo section or link in the README (plausibly deliberate, given the content it indexes). |

**Reading:** demo mode is consistently a *feature you build into the app* (a read-only/reset profile), not just a hosted copy — Komga, Karakeep and Immich all added explicit demo-mode code. It arrives **6 months to 2 years after first release**, never before it. No project in this set launched with a demo. Evidence that a demo *drives* adoption is **thin to non-existent**: nobody publishes conversion data, and the only causal claim available is that Immich's demo was requested by a user who could not evaluate it otherwise (issue #720). Treat "demo drives adoption" as unproven; treat "people ask for one once you have something worth showing" as documented.

### Solo-maintainer sustainability — dated evidence

- **Immich went from unpaid to funded at ~2 years.** "Immich Joins FUTO", immich.app blog, **2024-05-01**: "Over the past two years, it has taken significant dedication, time, and effort." FUTO now "pay the core team to work on Immich full-time"; donations were stopped in favour of a paid option. https://immich.app/blog/immich-joins-futo — i.e. the single most successful project in this set treated *funding the maintainer* as a first-class milestone, not the feature set.
- **BookLore (self-hosted ebook/comic library) is the counter-example that died.** Per XDA, "Single-maintainer open source is a ticking time bomb, and Booklore just detonated" (https://www.xda-developers.com/single-maintainer-open-source-ticking-time-bomb/): the sole maintainer deleted the GitHub repo, Discord and website in **March 2026** after a dispute; it vanished from the TrueNAS app catalogue the same day; a contributor fork ("Grimmory") took over. Note: the article cites **no statistical data**, only this one case. Do not over-read it.
- **General burnout data is real but not media-project-specific**: Socket's maintainer survey reports ~60% of maintainers unpaid, ~60% having considered quitting, 61% of unpaid maintainers working alone (https://socket.dev/blog/the-unpaid-backbone-of-open-source). This is background, not evidence about build order.
- **No "what I learned building X" retrospectives found** from gotson (Komga), advplyr (Audiobookshelf), or majora2007 (Kavita) despite targeted searching. **The maintainer-retrospective evidence base for this genre is thin.** What exists is the commit and release record, which is why this report leans on it.

### Mobile clients — raw dated evidence (running)

Official app or not, per project:

| Project | Official mobile app? | Evidence |
|---|---|---|
| Komga | **No.** Never built one in 6 years. | Docs point to web UI + OPDS + OpenAPI. Third-party Tachiyomi extension was working **2019-08-28**, one day after v0.1.0 (`7ca2880`). Kobo Sync (`210c7b1` 2024-08-27) was the eventual "device" story, 5 years in. |
| Kavita | **No, still not, ~5 years on.** | Kavita's own wiki has a page titled "Kavita Dedicated 3rd Party Apps" (https://wiki.kavitareader.com/guides/3rdparty/kavita-dedicated/) listing community apps — Inkita (Android), Kover (cross-platform), Turnleaf (Android), Kamigura (Android) — with the disclaimer "Kavita team does not manually validate each app." No official app is listed anywhere on it. Roadmap statements say a native app comes *after* other work. |
| Navidrome | **No, deliberately.** | Docs: Navidrome "can also work as a lightweight Subsonic-API compatible server, that can be used with any Subsonic compatible client", and the site ships a *client apps directory* instead of an app (https://www.navidrome.org/docs/overview/). Implementing someone else's protocol gave it a mature mobile ecosystem on day one at zero mobile cost. |
| Stash | **No.** 7 years, none. | README install matrix lists Windows/macOS/Linux/Docker only; the only "mobile" work is responsive layout and a PWA add-to-homescreen request (#1303, 2021-04-14). No mobile repo in the `stashapp` org. |
| Calibre-Web | **No.** 11 years, none. | README (2026-09-05) contains no mention of "mobile", "Android app" or "iOS app". Its device story is OPDS clients plus Kobo device sync (`5357867`, 2019-11-05). |
| Immich | **Yes — and it came first, before the web UI.** | Flutter app present in the first public commit (`568cc24`, 2022-02-03); the project's first git tag is named `first-android-release` (2022-02-06). iOS App Store link in README 2022-03-12, Play Store 2022-04-05. The **web UI did not exist until day 107** (PR #167, 2022-05-21). |
| Audiobookshelf | **Yes**, separate repo `advplyr/audiobookshelf-app`. | Repo created 2021-09-02 (`495af35` "init"), 16 days after the server's first commit and 2 days before the server's v1.0.0. App Store submission visible by 2022-01-06 (`7273202`). |
| Karakeep | **Yes**, React Native/Expo in the monorepo. | Merged in `2b72040` 2024-03-11; announced in v0.7.0 (2024-03-21): "A new mobile app got introduced" — +29 days after v0.1.0. |
| Romm | **Yes, but very late** — `rommapp/argosy-launcher` (Android), repo created 2025-12-06, ~2y8m after v1.0. An *unofficial* community app (mattsays/romm-android) shipped ~5 months earlier and was credited in Romm's own v4.0.0 notes (2025-07-20). Handheld clients (`miyoo-mini-app` 2025-01-04, `muos-app` 2025-01-23, `grout` 2025-11-15) and a Playnite plugin (2024-03-19) came first. |
| Suwayomi | **No first-party app from the server team.** Separate org repos: `Suwayomi-JUI` (Compose Multiplatform desktop, created 2021-03-23) and `Tachidesk-Sorayomi` (created 2022-01-16), superseded by `Suwayomi-Tsumiru` (2026-06-19). And Mihon/Tachiyomi itself can talk to it. |

**Provisional reading (to be finalised):** 7 of 10 have no official mobile app at all, and several of those are the healthiest projects in the set. The three that do either (a) were mobile-first by design and *had no choice* (Immich — a photo backup app is worthless without a phone client) or (b) serve a listening/reading-on-the-move use case where offline sync is the product (Audiobookshelf, Karakeep). The rest bought a mobile ecosystem by implementing an **existing open protocol** — OPDS (Komga, Kavita, Calibre-Web) or Subsonic (Navidrome) — which is the cheapest mobile strategy in the dataset by an enormous margin.

### Navidrome first-tag outlier (early note)
Navidrome's first commit is `5d6fd4e` "Initial project skeleton" **2016-02-23**; its first tag `v0.3.0` is **2020-01-27** — **~4 years**. It ran unversioned as "cloudsonic/sonic-server" and was renamed in `bee55c04` "Rename project to Navidrome" **2020-01-23/24**, tagging three days later. Its first release body is literally just "ci: create binaries with goreleaser". This is the clearest case in the set of *usable long before tagged*: the tag marked the decision to distribute, not the decision to be useful.


---

## Kavita

Research into the build order of Kavita (self-hosted manga/comic/book server), GitHub
`Kareadita/Kavita` (backend, .NET) and `Kareadita/Kavita-webui` (frontend, Angular). All evidence
below is dated commits (via `gh api repos/.../commits`), GitHub Releases (`gh api
repos/.../releases`), and repo metadata, pulled live via `gh` CLI on 2026-09-05. Every claim below
carries a sha/tag/date/URL. Status: COMPLETE first pass.

### 1. First release

- First commit: `a2e6d03`, 2020-12-12T23:03:06Z, "Initial commit" (Joseph Milazzo, the project's
  sole founder/lead dev, later GitHub handle `majora2007`). Repo `Kareadita/Kavita` created
  2020-12-12T22:23:54Z; the content of this commit is a bare, unmodified ASP.NET Core Web API
  scaffold (`API/Controllers/WeatherForecastController.cs` — the dotnet template's default
  controller). https://github.com/Kareadita/Kavita/commit/a2e6d03
- The companion frontend repo `Kareadita/Kavita-webui` (Angular) was created 3 minutes later,
  2020-12-12T22:26:56Z, confirmed via `gh api users/Kareadita/repos`.
- First tagged release: `v0.1`, published 2021-01-20T16:09:39Z, GitHub-flagged `prerelease: true`.
  https://github.com/Kareadita/Kavita/releases/tag/v0.1
- **Time from first commit to first release: ~39 days** (38 days, 17 hours: 2020-12-12 23:03 UTC
  to 2021-01-20 16:09 UTC).
- I count v0.1 as "first usable" — it is GitHub-flagged prerelease, but it is the project's actual
  first public release (no earlier tag exists), and the release notes themselves say "you can
  actually use server".
- v0.1 release notes, quoted verbatim (`gh api repos/Kareadita/Kavita/releases/tags/v0.1 --jq .body`):

  > First release of Kavita. This release is more of a milestone than a proper release (although you can actually use server). This release allows for:
  > * User creation with Roles (admin/non-admin)
  > * Role based access to Libraries
  > * Segregation of Manga in different Libraries for whatever your needs
  > * Ability to rate manga
  > * Ability to track read progress
  > * Ability to read archive-based manga (cbz, cbr, zip)
  > * Ability to scan libraries ad-hoc
  > * Cache management
  > * Ability to read manga (no split page support)
  >
  > While a lot was accomplished, a lot of the work is preliminary. This is the foundation for the next releases and polishing efforts.

  Notably: **multi-user accounts with admin/non-admin roles shipped in the very first release**,
  not added later (see section 3).

### 2. Build order (reconstructed from the first ~100 commits of both repos)

The backend (ASP.NET Core/.NET) and frontend (Angular, separate repo) were built in lockstep,
feature by feature — each backend capability has a same-day or next-day UI commit in
`Kavita-webui` — not "backend fully first, then a UI layered on top". Source:
`bash early.sh Kareadita/Kavita 100` and `bash early.sh Kareadita/Kavita-webui 40` (both walking
`gh api repos/<repo>/commits`).

Chronological order of backend capabilities (dates = `commit.author.date`, all shas from
`repos/Kareadita/Kavita/commits`):

1. **2020-12-12** `a2e6d03` — bare ASP.NET Core Web API scaffold. Confirms the stack from commit 1:
   **.NET/ASP.NET Core backend + Angular frontend** (from `Kavita-webui` `0b85a1b`, 2020-12-12).
2. **2020-12-13** `2b52192`, `5da41ea` — basic login, `User` entity + first EF Core migration,
   register (non-admin by default).
3. **2020-12-14** `13ed323` — "Member" API (User-shaped DTO for frontend consumption).
4. **2020-12-18** `b6e0e05` — `Library` entity + many-to-many User↔Library EF migration ("Add
   Library now works").
5. **2020-12-21** `f8d7581`, `8f7df85` — admin-exists API; token auth refactored onto ASP.NET
   Identity/Core framework.
6. **2020-12-24** `b899157` — `DirectoryService` (folder listing, excludes system/hidden folders)
   — first sign of the **file scanner**.
7. **2020-12-26** `b3f210a` — Hangfire (background job framework) added + "basic directory
   scanning implementation".
8. **2020-12-27** `8c80ed0` — basic filename **parser** + unit tests, built and tested standalone
   before being wired into scanning.
9. **2020-12-29** `0a49b07` — parallelized scan loop producing an in-memory series→parsed-file map
   (no DB writes yet).
10. **2020-12-30** `380c3e7` — "Rough version of Saving Series, Volumes, and MangaFiles to the DB"
    — the **Series/Volume/MangaFile schema was created to fit what the scanner had already
    produced**, not designed upfront; commit message calls it "rough" and notes it relies on
    cascade deletes rather than diffing existing rows.
11. **2021-01-01** `c429c50` — first APIs for the frontend to navigate down to Volume level.
12. **2021-01-04** `451d459` — cover image extraction.
13. **2021-01-07 to 01-09** — on-disk cache service + page thumbnailing.
14. **2021-01-10** `f737f66` — Windows-style natural file sort.
15. **2021-01-11** `28ce2bb` — chapter-based volume/page handling (reader logic taking shape).
16. **2021-01-17** `effdf07` — read-progress tracking ("Very messy code... needs major cleanup"
    per the commit's own message).
17. **2021-01-18** `825afd8`, `26660a9` — repository/UnitOfWork refactor, TaskScheduler
    consolidation — first internal architecture cleanup pass, ~5 weeks in.
18. **2021-01-19/20** `ac993a5` — ratings/reviews API; `925a009` "Prepare for deployment of v0.1".

**Data model conclusion**: they did NOT define a full schema up front. History shows
User → Library → (Series/Volume/MangaFile added only once the scanner needed somewhere to persist
what it found, explicitly labelled "rough" in the commit message) → fields bolted on incrementally
(cover image path, read-progress, ratings). And per section 4, this "rough" schema/scanner pair was
then explicitly rewritten twice more within the following year (v0.2, then a PR literally titled
"ScanLibrary rewrite" three weeks after that).

**Overall build order**: auth/users → library CRUD → directory listing → background job runner
(Hangfire) → filename parser (unit-tested standalone) → scan loop (in-memory) → DB persistence of
scan results ("rough") → reader-facing APIs (cover images, cache/thumbnails, pagination, natural
sort) → read-progress/ratings → first release. UI was built in parallel throughout, not after.

### 3. Timing of later capabilities relative to first release (v0.1, 2021-01-20)

| Capability | Date | Days after v0.1 | Evidence |
|---|---|---|---|
| Multi-user accounts (admin/non-admin roles) | 2021-01-20 (in v0.1 itself) | 0 | v0.1 release notes, quoted above |
| Official public demo instance | 2021-06-26T16:33:30-05:00, commit `b0b64cf` "Added demo to readme", linking `https://demo.kavitareader.com/` with demo credentials | ~157 days | https://github.com/Kareadita/Kavita/commit/b0b64cf |
| Docker: Dockerfiles added to main repo | 2021-05-19T15:03:00Z, PR #225 "Added Dockerfiles to main repo", commit `7b02ddf` | ~119 days | https://github.com/Kareadita/Kavita/commit/7b02ddf |
| Docker: merged into stable release | v0.4.1, published 2021-06-05T20:23:25Z (README docker instructions already added 2021-05-19, PR #226) | ~136 days | https://github.com/Kareadita/Kavita/releases/tag/v0.4.1 |
| Image format conversion (WebP support) — the closest Kavita has to "transcoding", since it serves static images/archives, not video | commit `2725e60`, 2021-09-15T17:25:18-07:00, "WebP Support (#581)", released in v0.4.6 (2021-09-26T17:34:22Z) | ~249 days | https://github.com/Kareadita/Kavita/commit/2725e60 |
| **No evidence found** of video transcoding — Kavita's domain (manga/comic archives + ebooks) has no video-transcode use case; no commits, releases, or issues use the word "transcode" | — | — | `gh api "search/commits?q=repo:Kareadita/Kavita+transcode"` returns 0 results |
| OPDS feed (documented, machine-consumable API for third-party reader apps) | commit `6069d93`, 2021-08-27T10:19:25-07:00, "OPDS Support (#526)", released in v0.4.5 (2021-08-31T17:07:48Z) | ~223 days | https://github.com/Kareadita/Kavita/commit/6069d93 |
| Third-party mobile client support (Tachiyomi/Mihon extension API — **no official native Kavita mobile app exists**; `gh api users/Kareadita/repos` lists no mobile-app repo) | API work starts commit `384ebce` "Tachiyomi Enhancements (#845)", 2021-12-10T15:04:52-06:00, continuing through `480cd94` "API for Tachiyomi Progress Sync (#996)", 2022-01-26, and `302599c` "Added support for Tachiyomi volume progress tracking (#1044)", 2022-02-07 (v0.5.1, 2022-02-11) | ~324–383 days | https://github.com/Kareadita/Kavita/commit/384ebce |
| PWA (installable web app — Kavita's substitute for a native mobile client) | v0.6.0, published 2022-10-22T16:34:43Z | ~641 days | https://github.com/Kareadita/Kavita/releases/tag/v0.6.0 |
| Metadata providers / plugins as an official feature (Kavita+: scrobbling to AniList, external reviews/ratings, recommendations — paid add-on subscription) | v0.7.4, published 2023-07-11T18:22:02Z, commit `a8ee1d2` "v0.7.4 - Kavita+ Launch (#2117)" | ~902 days (~2.5 years) | https://github.com/Kareadita/Kavita/releases/tag/v0.7.4 |
| Metadata *downloading* (as opposed to scrobbling) added to Kavita+ | v0.8.5 release notes: "I sneaked in metadata downloading, something I..." (date of v0.8.5 not independently pulled in this pass; flagged for follow-up) | evidence thin — exact date not confirmed | `releases.tsv` grep, tag v0.8.5 |

Notes:
- "No-authentication mode" (an admin could disable login entirely) existed early — issue #465
  "Disabling Authentication for the server", opened 2021-08-09T14:57:29Z
  (https://github.com/Kareadita/Kavita/issues/465) — and was later fully deleted from the codebase;
  see section 4, since this is really a regret/removal, not a durable capability.
- Kavita+ is a paid subscription add-on ($4/month/server per the v0.7.4 notes), not a free plugin
  ecosystem; the closest thing to "metadata providers/plugins" is this. There is no evidence of an
  earlier, free/open metadata-provider or plugin system that Kavita+ replaced.

### 4. Regrets / rewrites

Kavita's own release notes are unusually candid about rewrites — several are self-described in
these words, not inferred:

1. **DB + scanner rewrite, v0.2** (published 2021-02-15T19:29:03Z, ~26 days after v0.1). Verbatim:
   > "This release originally was aimed at stabilizing and testing against a real library. During
   > this, a ton of bugs were found that led to a complete rewrite to the DB structure and Scanning
   > code."
   https://github.com/Kareadita/Kavita/releases/tag/v0.2 — i.e., the "rough" schema from commit
   `380c3e7` (2020-12-30) was rewritten within about 7 weeks of being introduced.

2. **"ScanLibrary rewrite" PR**, #55, opened 2021-02-10T18:51:03Z, titled "Partial Chapter support
   + ScanLibrary rewrite" — a second, explicitly-named scanner rewrite landing in the same window
   as the v0.2 DB rewrite above. https://github.com/Kareadita/Kavita/pull/55

3. **"No Authentication mode" built, then fully removed.** Feature requested/discussed from issue
   #465 (opened 2021-08-09). Removal tracked in issue #982 "Remove No Authentication mode from
   Kavita" (opened 2022-01-23T15:52:18Z) and shipped in PR #1006 (merged 2022-01-31, commit
   `c8de3fb`), released in v0.5.1 (2022-02-11T15:42:01Z). The PR's own commit log includes: "Removed
   all code around disabling authentication. Users that were already disabled can look up their
   password on the wiki." https://github.com/Kareadita/Kavita/pull/1006 — a capability built early
   and deliberately deleted about a year later, with a manual, wiki-documented user migration step.

4. **Docker breaking change: config directory path**, v0.4.8 (published 2021-11-04T12:17:13Z, PR
   #698/#715 "Breaking Changes: Docker Parity", commit `a29b11c` 2021-11-03). Verbatim from release
   notes:
   > "**Breaking Change**: Note that in this release, I have changed where all the config for the
   > application lives... If you are a docker user, all you need to do is change your mount point
   > from ... `/kavita/data/directory:/kavita/data` to ... `/kavita/data/directory:/kavita/config`
   > ... If you forget this step, Kavita will notice and kill the server so you don't loose data."
   https://github.com/Kareadita/Kavita/releases/tag/v0.4.8

5. **Full scan-loop rewrite, v0.5.6** (published 2022-09-02T12:37:44Z), described as a 3-month
   effort. Verbatim:
   > "For the past 3 months, I have been working tirelessly to rebuild our main scan loop, which is
   > not only the most complicated part of Kavita but also the most critical... The reasoning for
   > this drastic shift is that the old method failed to scale on users with massive libraries...
   > I quit 3 times, but finally made it through."
   This rewrite also removed a previously-supported end-user behavior: series could no longer have
   "loose leaf" files outside their own folder — a capability regression forced by the rewrite.
   https://github.com/Kareadita/Kavita/releases/tag/v0.5.6

6. **Data-corruption bug requiring a manual DB restore, v0.7.11** (published 2023-12-03T21:15:49Z).
   Verbatim: "**Warning: There is a bug identified that causes minor data skewing. An update will be
   published soon (before 8th) with the hotfix. If you have updated, copy one of your backups from
   config/backups for the day of the update and restore the DB.**"
   https://github.com/Kareadita/Kavita/releases/tag/v0.7.11 — functionally the "reset your
   database"/restore-from-backup scenario the brief asked about, though not in those exact words.

7. **"Foundation" rewrite, v0.8.0** (published 2024-04-12T22:26:31Z), 48K lines added / 5.5K
   removed across 400 files. Verbatim:
   > "Have you ever thought to yourself that you'd like to switch the foundation of your house from
   > slab to pier and beam? ... Some features were added with limited knowledge, like comics, and
   > that lack of knowledge in the beginning became a problem for heavy comic collectors. In order
   > to build towards my vision of being the best, I had to rewrite large portions of how Kavita
   > functions..."
   This rewrote the original 'Comic' library type into a new 'Comic Vine'-aligned type, changing
   how volume numbers and series titles are derived. https://github.com/Kareadita/Kavita/releases/tag/v0.8.0
   Follow-on release v0.8.4 (bug-fix release) opens with: "After rewriting 50K lines of code last
   release, I decided it was best to take a break and focus on the bugs that resulted."

8. **"CBL v2 (new schema)"**, v0.8.2 (published 2024-07-07T12:38:32Z) — release notes list "CBL v2
   (new schema)" as one of three headline goals, i.e. a second schema rewrite for the
   Comic-Book-List reading-list import format. https://github.com/Kareadita/Kavita/releases/tag/v0.8.2

9. **Kavita+ "massive overhaul"**, v0.9.1.0 (published 2026-08-28T15:50:43Z), ~3 years after the
   Kavita+ launch (v0.7.4, 2023-07-11). Verbatim: "I started Kavita+ 3 years ago with a split goal
   of bringing some of my initial vision of Kavita to fruition... the Kavita+ in this release is a
   day and night difference to what we've known before."
   https://github.com/Kareadita/Kavita/releases/tag/v0.9.1.0

No hits for "deprecat*" across any release notes (`grep -in deprecat releases.tsv` → 0 matches) or
via `gh api search/issues ... deprecat` (0 results) — evidence thin/none found for that specific
term, despite the many rewrites documented above under other names ("rewrite", "Breaking Change",
"complete rewrite").

### Sources / method

- `gh api repos/Kareadita/Kavita/commits` (and `Kavita-webui`), walked oldest-first via the
  provided `early.sh` helper.
- `gh api repos/Kareadita/Kavita/releases?per_page=100 --paginate` for all 78 releases and their
  verbatim bodies (saved locally to `releases.tsv` during research for full-text grep).
- `gh api search/commits` and `gh api search/issues` for keyword-dated feature arrivals
  (docker, OPDS, tachiyomi, mobile, webp, transcode, breaking change, rewrite, deprecat, migrat,
  "reset your database").
- `gh api users/Kareadita/repos` to confirm no separate official mobile-app repo exists.

---

### Survivorship warning + outcome table (measured 2026-09-05, `gh api repos/<r>`)

| Repo | Stars | Repo created | Last push | Archived |
|---|---:|---|---|---|
| immich-app/immich | 113,469 | 2022-02-03 | 2026-09-05 | no |
| karakeep-app/karakeep | 28,834 | 2024-02-06 | 2026-08-31 | no |
| navidrome/navidrome | 23,359 | 2016-02-24 | 2026-09-05 | no |
| janeczku/calibre-web | 18,113 | 2015-08-02 | 2026-09-02 | no |
| advplyr/audiobookshelf | 14,249 | 2021-08-17 | 2026-08-28 | no |
| stashapp/stash | 12,925 | 2018-06-04 | 2026-09-02 | no |
| rommapp/romm | 12,636 | 2023-03-08 | 2026-09-05 | no |
| Kareadita/Kavita | 11,611 | 2020-12-12 | 2026-09-05 | no |
| Suwayomi/Suwayomi-Server | 7,554 | 2020-12-23 | 2026-09-04 | no |
| gotson/komga | 6,633 | 2019-08-08 | 2026-09-03 | no |
| advplyr/audiobookshelf-app (mobile) | 2,679 | **2021-09-02** | 2026-08-11 | no |

**All ten are alive. This is a survivorship-biased sample and every conclusion below inherits that bias.** The question "what kills solo self-hosted projects" cannot be answered from these ten, because none of them died. What *can* be shown is what the survivors did, and separately what happened to nearby projects that stalled:

- **airsonic/airsonic — archived**, created 2017-07-04, last push **2021-08-11**. The community Subsonic fork that Navidrome displaced. Its own successor fork airsonic-advanced/airsonic-advanced last pushed **2024-04-24** and is also effectively dormant.
- **popeen/Booksonic-Air** — the Airsonic-derived audiobook server, created 2020-07-24, last push **2023-03-31**. Its README carries the warning "the code here might not be ready for release. Feel free to compile it yourself…". Audiobookshelf (repo created 2021-08-17, still shipping) took the niche.
- **BookLore** — deleted outright by its sole maintainer in March 2026 (see solo-maintainer section above).

The pattern in the *dead* set is not "wrong build order". It is: forks of a big legacy codebase (Airsonic/Booksonic) that nobody could keep up with, and a single maintainer who walked away (BookLore). Note also `advplyr/audiobookshelf-app`: the **mobile repo was created 16 days after the server repo** (2021-09-02 vs 2021-08-17) — one of the two genuinely mobile-early projects here.


---

## Audiobookshelf

Evidence-only, citing dated commits/tags/releases from
`advplyr/audiobookshelf` (server) and `advplyr/audiobookshelf-app` (mobile client).

### 1. First release

- First commit: `6930e69` (also mirrored as `a0c60a9`, same author/timestamp — repo has
  paired commits by "advplyr" and "Mark Cooper", evidently the same person/two remotes),
  2021-08-17T22:01:11Z, message "Init".
  https://github.com/advplyr/audiobookshelf/commit/6930e69
- First git tag: `0.9.61-beta` on commit `343657f`, 2021-08-21T18:15:45Z — **4 days** after
  first commit. Commit message: "Release 0.9.61-beta". A second pre-1.0 tag
  `0.9.61-beta.0` followed same day at 18:28:32Z (commit `6967669`).
- First GitHub **Release** object: `v1.0.0`, published_at 2021-09-04T19:37:05Z — **18 days**
  after the first commit (2021-08-17 -> 2021-09-04). Release body is EMPTY (no release notes
  text stored against this tag via the GitHub Releases API as of this check).
  https://github.com/advplyr/audiobookshelf/releases/tag/v1.0.0
- What was in it: reconstructed from commits up to that tag (see Build order below) —
  Express HTTP API + Nuxt.js web client, njodb (JSON-file) storage of audiobooks/users/settings,
  a directory scanner, chokidar file watcher, HLS transcoding via fluent-ffmpeg, basic
  single/multi-user auth (root user), audiobook player with playback-speed control, cover-art
  matching (including a LibGen metadata provider), global search, genre/series filtering,
  batch update/delete, Docker template. Note: package.json at the *very first* commit already
  declares `"version": "1.0.0"` even though the repo hadn't tagged it yet — so "1.0.0" as a
  target version predates the beta tags.
- Evidence quality: solid for dates/commits; thin for prose "release notes" — none exist for
  v1.0.0 via the Releases API (checked verbatim, body field empty).

### 2. Build order (from first ~100 commits + initial tree)

Direct read of the tree at the first commit (`6930e69`, 2021-08-17) already shows a fairly
complete vertical slice, not an incremental crawl from empty:
`server/` contains `Db.js`, `Scanner.js`, `Watcher.js`, `Server.js`, `ApiController.js`,
`Stream.js`, `StreamManager.js`, `HlsController.js`, `BookFinder.js` (+ `providers/`),
`Audiobook.js`, `Book.js`, `AudioTrack.js`, `User.js`, `Auth.js`, `Logger.js`.
`client/` is a Nuxt.js app (`.nuxt` build artifacts checked in already).
Root `package.json` dependencies at init include: `express`, `fluent-ffmpeg`, `njodb`,
`socket.io`, `chokidar`, `bcryptjs`, `jsonwebtoken`, `libgen`, `node-dir`, `fs-extra`.
https://github.com/advplyr/audiobookshelf/blob/6930e69/package.json (via git blob, same commit)

So: **the initial commit already bundles data store + scanner + HTTP API + web UI + transcoding
scaffolding together** — this is not "schema first, then scanner, then API" in sequence; those
layers arrived as one working slice in commit 1, then commits 2 onward (all same day/next few
days) refine each layer. Reconstructing what came first *within* the following days from commit
subjects (oldest first, deduplicated pairs):
- 2021-08-17 22:01 `6930e69` Init (full slice above)
- 2021-08-17 22:19 `4736fa1` Update Logo, Add docker template — Docker present within hours of init
- 2021-08-17 22:43 `033cc3f` Update cover url, audiobook player speed
- 2021-08-18 11:50 `30ca0bb` Sorting, fix user object bug, add settings module
- 2021-08-18 23:31 `7e48235` Adding files tables, fixing loading when switching streams
- 2021-08-19 01:18 `1c88c0a` Sorting and filtering
- 2021-08-20 00:14 `08c3f84` Supporting more file structures for series and publish year
- 2021-08-20 23:29 `744aacb` Adding audio playback speed control, updating volume control UI, fix stream play for small streams
- 2021-08-21 14:15 `30700c1` Update book finder and cover matching - includes LibGen provider
- 2021-08-21 18:15 `343657f` **Release 0.9.61-beta** (first tag)
- 2021-08-21 21:23 `0990c61` Add global search, add reset all audiobooks
- 2021-08-22 13:52 `c3fd904` Series as a dropdown and filter
- 2021-08-22 15:46 `5ecfaa8` Reset password and users table on settings page — first explicit multi-user-ish admin feature (users table on settings page)
- 2021-08-23 19:08 `73a7868` Fix scan for audiobook directories in root dir
- 2021-08-23 23:31 `7ef977b` Moving settings to be **user specific**, adding playbackRate setting
- 2021-08-24 00:37 `bf38004` Fix dynamic route requests, **add auth middleware**
- 2021-08-24 12:15 `bda0c0c` Scanner update - remove and update audiobooks on scans
- 2021-08-25 22:36 `63cae5b` Adding inode to files ... setting up watcher and removing chokidar (note: chokidar was in from init, then reworked here)
- 2021-08-26 23:32 `88c7c16` Batch updating and deleting, multi-select
- 2021-08-27 12:01 `23f343f` **Adding and deleting users** (explicit multi-user account management commit)
All: https://github.com/advplyr/audiobookshelf/commits/main (browse by sha above)

- **Storage confirmed as JSON-file store, not SQL, from the very first commit.** `server/Db.js`
  at `6930e69` uses `njodb` (a pure JS/JSON flat-file database library) for three stores:
  `audiobooksDb`, `usersDb`, `settingsDb`, each `new njodb.Database(path)`. Verbatim:
  `this.audiobooksDb = new njodb.Database(this.AudiobooksPath)`. This matches the task's
  "JSON/LevelDB-style storage" premise — specifically njodb, not LevelDB itself.
- Data model: **not** fully specified up front as a formal schema — it grew organically.
  Evidence: commit `30ca0bb` (2021-08-18) "add settings module"; `7e48235` (2021-08-18) "Adding
  files tables"; `7ef977b` (2021-08-23) "Moving settings to be user specific, adding
  playbackRate setting"; entities (`Audiobook.js`, `User.js`, `Book.js`, `AudioTrack.js`) exist
  as plain JS classes from commit 1 but fields are added commit-by-commit rather than a single
  up-front schema design commit.
- Stack: **Node.js + Express** (server, confirmed via `express` dependency + `Server.js`/
  `ApiController.js`) and **Nuxt.js** (client, confirmed via checked-in `client/.nuxt/*` build
  output) from the first commit. Real-time updates via `socket.io` also present at init.
- Transcoding: **ffmpeg-based HLS transcoding was present in the very first commit**, not added
  later — `fluent-ffmpeg` is a root dependency at `6930e69`, and `server/HlsController.js`,
  `Stream.js`, `StreamManager.js` all exist in the initial tree. This contradicts an assumption
  that transcoding was a later add — see section 3 for confirmation this stayed core rather than
  bolted on.

### 3. Timing of specific features relative to first release (v1.0.0, 2021-09-04)

- **Transcoding (ffmpeg/HLS): before first release, in fact present at the very first commit**
  (2021-08-17, `6930e69`, dependency `fluent-ffmpeg` + `HlsController.js`/`Stream.js`). Evidence
  strong (direct tree read).
- **Multi-user accounts: before first release.** Commit `5ecfaa8` (2021-08-22) "Reset password
  and users table on settings page"; commit `bf38004` (2021-08-24) "add auth middleware"; commit
  `23f343f` (2021-08-27) "Adding and deleting users" — all predate the 2021-09-04 v1.0.0 release.
  Root/default-user scaffolding (`getDefaultUser`) was in `Db.js` from commit 1.
- **Docker image: before first release**, in fact commit 2 of the whole repo. `4736fa1` /
  `8fbdc15` (2021-08-17T22:19:57Z, ~18 minutes after init) "Update Logo, Add docker template" —
  a `Dockerfile` is also present in the very first commit's tree (`6930e69`).
- **Metadata providers beyond LibGen: both added after first release.**
  - Google Books: commit `ad4dad1`, 2021-10-28T14:41:42-05:00, "Add: experimental match tab with
    google books search #59" — **54 days after** v1.0.0 (2021-09-04).
    https://github.com/advplyr/audiobookshelf/commit/ad4dad1
  - Audible: commit `ae80468`, 2021-11-21T10:59:32-08:00, "Added support for audible metadata"
    (merged via PR #190) — **78 days after** v1.0.0.
    https://github.com/advplyr/audiobookshelf/commit/ae80468
  - So at launch (v1.0.0) the only metadata provider was LibGen (present since commit `30700c1`,
    2021-08-21, pre-dating v1.0.0); Google Books and Audible came ~2-3 months later.
- **Official mobile app (advplyr/audiobookshelf-app): repo created after first release, but
  development started before it.** Repo `created_at` 2021-09-02T01:06:39Z (per GitHub repo
  metadata); first commit `495af35` "init", 2021-09-02T01:07:11Z. Since server v1.0.0 published
  2021-09-04T19:37:05Z, **app development began ~2.7 days before the server's first tagged
  GitHub Release**, but ~16 days after the server's very first commit (2021-08-17). iOS-specific
  work: commit `fda8e9a` "Ios", 2021-09-03T19:41:00Z. Android icons commit `9807692`,
  2021-09-03T20:48:49Z — same day, iOS worked on first by about an hour, so no clear
  iOS-vs-Android priority beyond that.
  - App repo's own first tag: `v0.2.1-beta`, published 2021-09-02T12:58:41Z (same day as first
    commit); an earlier `v0.1.0-beta` tag exists but has no dated GitHub Release object (tag
    only, no publish timestamp returned by the API in this check).
  - First store listing (App Store / Play Store) date: **evidence thin, not found directly.**
    No commits in either repo mention "TestFlight" or "Play Store" (checked via GitHub code
    search). Indirect evidence: by 2022-01-16, issue #85 "Flac doesn't work on iOS" and by
    2022-01-06 commit `7273202` "Change:Remove android auto reference for apple app store
    approval" (2022-01-06T17:11:09-06:00) shows an **active Apple App Store submission in
    progress by Jan 2022**, ~4 months after the app's first commit, implying real users running
    the iOS app by then (likely via TestFlight beforehand). No equivalently dated Play Store
    submission commit was found. Exact store-listing "went live" dates are not present in either
    repo's history and would need App Store/Play Store metadata (not queried in this pass).
- **Official public demo instance: not confirmed as officially first-party; a community-hosted
  demo exists.** Current `readme.md` (2026-09-05 fetch) contains: "Check out the web client
  demo: https://audiobooks.dev/ (thanks for hosting @Vito0912!)" with username/password
  `demo`/`demo`. This reads as a **community-hosted** instance (credited to contributor
  Vito0912), not an advplyr-run official demo. The exact commit/date this was added to the
  readme was not pinned down in this pass (readme.md has 117 historical commits; the specific
  one adding the demo line was not isolated) — **evidence thin on dating, but content itself
  confirms it is community- not vendor-hosted**, contradicting any assumption of an official
  first-party demo instance.
- **Docker image: capability present at first commit (2021-08-17, Dockerfile in initial tree,
  plus commit `4736fa1`/`8fbdc15` "Add docker template" ~18 min later); automated CI-published
  image came much later.** Timeline:
  - 2021-08-17T22:19:57Z `4736fa1`/`8fbdc15` "Add docker template" (manual/self-build Dockerfile)
  - 2021-10-31T09:54:58-05:00 `8a684cc` "Add: Docker compose example and readme #164"
  - 2022-04-28T18:40:29-05:00 `e220b28` **"Add docker-build workflow"** — first CI workflow to
    build/publish a Docker image automatically, **236 days after** v1.0.0 (2021-09-04).
    https://github.com/advplyr/audiobookshelf/commit/e220b28
  So: hand-buildable Docker support existed from day 1; an automated, presumably
  registry-published image is a 2022-04-28 addition.
- **Documented public API for third parties: added roughly 2.7 years after first release, via
  an OpenAPI spec.**
  - First proposal: PR #2671 "Initial OpenAPI spec - Collection endpoints", opened
    2024-02-27T01:40:22Z, **never merged** (`merged_at: null`).
    https://github.com/advplyr/audiobookshelf/pull/2671
  - First merged OpenAPI work: PR #3012 "Initial library endpoints", opened 2024-05-25T20:45:40Z,
    merged 2024-06-13T22:09:02Z (commit `baf5f7f`) — this introduced `docs/openapi.json` to the
    repo. **~648 days after** v1.0.0 (2021-09-04 to 2024-06-13).
    https://github.com/advplyr/audiobookshelf/pull/3012
  - A CI lint workflow for the spec (`.github/workflows/lint-openapi.yml`) was fixed up shortly
    after, commit `627ddd2` "Fix: OpenAPI lint workflow trigger", 2024-08-18T19:07:18-07:00.
  - Before this, the HTTP API existed (used internally by the official web/mobile clients from
    commit 1) but had no first-party OpenAPI/formal spec for third-party consumers until mid-2024.

### 4. Regrets / rewrites — SQLite migration

**Two separate attempts, roughly 4 months apart — the first was abandoned, not shipped.**

- **First attempt (abandoned):** branch `sqlite` (still present on GitHub, unmerged into
  master). First commit `b8ab72a` "Sequelize and sqlite init with test user model",
  2023-03-08T18:33:52Z. 19 commits total on this branch (per
  `git compare master...sqlite`), ending at `b4dc1c1` "Merge branch 'master' into sqlite",
  2023-03-22T17:18:02Z. Work included model definitions (`bed3758` "PlaybackSession, Playlist,
  PlaylistMediaItem, Device data models", `c7f457d` "Feed and Setting models"), a migration file
  (`c738e35` "Starting db migration file", `243bc7b` "Complete migration file"), and route/db
  structure changes — then the branch simply stops (last activity 2023-03-22) and was never
  merged. https://github.com/advplyr/audiobookshelf/compare/master...sqlite
- **Second attempt (shipped):** branch `sqlite_2`, first commit `cf7fd31` "Init sqlite take 2",
  2023-07-04T18:14:44-05:00 — note the commit message explicitly says **"take 2"**, i.e. the
  team's own words acknowledge this is a redo of the abandoned March attempt, **~3.5 months**
  after the first attempt stalled. Merged via PR #1907 "Migration to use sqlite3"
  (created 2023-07-14T20:08:59Z, merged 2023-07-14T20:11:23Z, 3 minutes later — self-merged, no
  body/description on the PR). https://github.com/advplyr/audiobookshelf/pull/1907
- **Shipped in release v2.3.0**, published 2023-07-15T21:46:20Z — **1 day after merge**, and
  **679 days after v1.0.0** (2021-09-04 to 2023-07-15). Release notes (verbatim, "Changed"
  section): "Database to sqlite3 (fixes #1712 #1326 #1419)".
  https://github.com/advplyr/audiobookshelf/releases/tag/v2.3.0
- **Migration-pain evidence — the three issues the release explicitly says the migration
  fixes**, all bugs in the old njodb-based flat-file store:
  - #1712 "[Bug]: lockfile compromised. mtime is not ours", created 2023-04-24T04:30:13Z
  - #1326 "[Bug]: Lock file is already being held", created 2022-12-28T08:37:47Z
  - #1419 "[Bug]: User account deleted", created 2023-01-21T17:03:46Z
  These are file-locking/corruption-class bugs consistent with njodb's flat-file JSON approach
  under concurrent access — i.e. the SQL migration was motivated by, and its release notes cite,
  concrete data-integrity bugs in the original store, not a purely speculative rewrite.
  (Note: #1326 predates the *first* sqlite attempt by ~2.5 months, i.e. these bugs had already
  been open for months before work on the rewrite began.)
- Sequelize (the ORM used with sqlite3) continued to need follow-up performance/correctness
  fixes well after the rewrite shipped, e.g. commit `1c40af3` "Update:Sequelize transactionType
  to IMMEDIATE to fix SQLITE_BUSY #1910" (2023-07-22, a week after v2.3.0), and commit `456bb87`
  "Update:Find one library item endpoint sequelize query split into two queries to improve
  performance #2073 #2075" (2023-12-30) — evidence the migration had ongoing performance-tuning
  costs for months afterward, not a one-shot fix.
- No evidence found of the word "rewrite" being used by the maintainers to describe this change
  in any commit message or release note checked (release notes call it "Database to sqlite3",
  commits call it "Migration to use sqlite3" / "Init sqlite take 2") — so "rewrite" is this
  report's characterization of the abandon-and-redo pattern, not the project's own term.

---
*Status: complete for all four questions with dated, cited evidence, except two explicitly
flagged thin points: (a) the exact date the community demo (audiobooks.dev) was added to the
readme, and (b) exact App Store / Play Store first-listing dates for the mobile app (only
indirect evidence — Jan 2022 App Store submission activity and iOS bug reports — was found).
Both are marked "evidence thin" in place above rather than guessed.*

---

## Navidrome

Self-hosted music server. Go backend + SQLite + React (react-admin) web UI, Subsonic-API-compatible. All dates/shas verified against `github.com/navidrome/navidrome` (full local clone) and the GitHub API on 2026-09-05.

### Identity: three names, one continuous repo
- **2016-02-23T23:41:35Z** — first commit, sha `5d6fd4e`, "Initial project skeleton", author Deluan (solo dev throughout this whole section). https://github.com/navidrome/navidrome/commit/5d6fd4ee6b0efd114acb2c4174e17902d4b692d5. Project was unnamed at birth; README at this point calls it nothing yet, code lives under `github.com/deluan/gosonic`.
- Name #1, **"GoSonic"** (`deluan/gosonic`) — from commit 1 to:
- **2017-04-01T13:47:14Z** — sha `c417a00e`, "Renamed project to CloudSonic". Diff shows old README: "GoSonic is an application that implements the Subsonic API... instead of having its own music library like the original Subsonic application, it interacts directly with your iTunes library." New README: same, renamed. Repo becomes `cloudsonic/sonic-server`. Also literally states at this point: **"This is still a work in progress, and has no releases available"** — 14 months in, zero releases. https://github.com/navidrome/navidrome/commit/c417a00e62886ceb6839b185549fbb25e89ecb2b
- Name #2, **"CloudSonic"** (`cloudsonic/sonic-server`) — for the next **1,027 days** (~2.8 years).
- **2020-01-23T19:44:08-05:00 (2020-01-24T00:44:08Z)** — sha `bee55c04`, "Rename project to Navidrome". https://github.com/navidrome/navidrome/commit/bee55c04c8e62befd8fbcb42483e8451636d6e62
- Name #3, **"Navidrome"** — ever since. Same GitHub repo throughout (renamed in place, `navidrome/navidrome` today); full commit history from 2016 is intact and browsable.
- **First commit -> Navidrome rename: 1,430 days (3.92 years)** of pre-Navidrome life as GoSonic/CloudSonic.
- Notable: **issue/PR #1** on this repo is dated **2020-01-06** (a Dependabot bump of `astaxie/beego`), 17 days *before* the Navidrome rename. No GitHub Issues/PRs exist from the ~4 years of GoSonic/CloudSonic — it was a solo side project with no public collaboration surface until right around the rename.

### 1. FIRST RELEASE
- **First git tag ever: `v0.3.0`**, published **2020-01-27T01:24:20Z** — only **3 days after** the Navidrome rename, and it is the *only* kind of tagged/versioned release this project has ever had (goreleaser CI was added the same week — commit `476c695c "ci: create versions with goreleaser"`).
- **Days from first commit (2016-02-23) to first tagged release (v0.3.0, 2020-01-27): 1,433 days (≈3.93 years)."**
- Verbatim v0.3.0 release notes (the entire body): "## Changelog\n\n476c695 ci: create binaries with goreleaser\n\n" — i.e. the first ever tagged release's own changelog is literally "we added CI to build binaries." https://github.com/navidrome/navidrome/releases/tag/v0.3.0
- **"First tag" vs "0.x people actually ran":** there is no meaningful gap here to report the way there might be for other projects — evidence indicates the pre-Navidrome era (GoSonic 2016-2017, CloudSonic 2017-2020, ~4 years) had **zero packaged releases of any kind**: no git tags (confirmed — 119 tags total in the repo today, and the earliest is `v0.3.0`; there is no `v0.1.0`/`v0.2.0`), no Docker image (first Docker support commit `dee8e5c5`, 2020-01-22, i.e. 2 days *before* the Navidrome rename), and no GitHub releases. Users in 2016-2020 could only run it by building from source. So the honest answer is: **the first release anyone could actually run without building from source is the same as the first tag, v0.3.0 (2020-01-27)** — evidence thin on any earlier informal binary distribution; none found in commit history, tags, or issues.
- Versioning oddity: starts at v0.3.0 not v0.1.0 — evidence thin on why; no v0.1/v0.2 tag or reference found anywhere in 119 tags or commit messages.
- Project is **still pre-1.0** as of the most recent release checked, **v0.63.2 (2026-07-11T13:42:52Z)** — over 10 years after the first commit and 6.5 years after the Navidrome rename, it has never cut a 1.0.

### 2. BUILD ORDER (from the first ~120 commits, 2016-02-23 to 2016-03-03)
Order, verbatim commit messages, oldest first:
1. **API-first, and Subsonic-API-first specifically.** Commit 2 (`b9e9d38`, 2016-02-24) is "First endpoint: Ping" — the Subsonic API's `ping.view`. Commit 4 "implemented getLicense", commit 6 "started getMusicFolders endpoint" — all Subsonic endpoints, all within the first 24 hours. The README from day one describes the project as implementing an **existing** API (Subsonic) rather than inventing one.
2. **Data model did NOT arrive whole — it churned through three storage backends before landing on SQLite:**
   - Commit 7 (2016-02-24) "Experiments with bleve, repositories and parsing itunes" — earliest persistence attempt used [tiedot](https://github.com/HouzuoGuo/tiedot) (embedded doc DB).
   - `c659b70` (2016-02-28) "removed tiedot, introduced ledisdb" — switch #1, to LedisDB (Redis-like embedded KV store).
   - LedisDB stays in place for **almost 4 years**.
   - `536244bc` (2020-01-13) "Removed LedisDB persistence layer" and `67eeb218` (2020-01-19) "Big Refactor: Create model.DataStore ... Implemented persistence.SQLStore — Removed iTunes Bridge/Importer support" — switch #2, to **SQLite**, in the same week as the Navidrome rename. SQLite has been the datastore ever since (still is).
   - So: the schema/storage model grew and was rebuilt twice, not designed whole up front. And original design deliberately avoided owning a music library at all — it read Apple's iTunes XML library file directly (see iTunes bridge commits 2016-02-24 through 2020-01-19) rather than scanning files on disk; the file-scanning-owned-DB model that Navidrome uses today only replaced the iTunes-XML-import model in January 2020, ~4 years in.
3. **Scanner**: basic file/library scanning appears very early too — `14e5257` (2016-02-28) "Scanning artists and albums too", `5152796` (2016-02-28) "Basic scanning working" — but this initial scanner was scanning/parsing the iTunes XML library, not walking the filesystem independently.
4. **Auth**: `975327a6` (2016-02-24) "Handling request validation/authentication" (day 1) and `f58c5aa5` (2016-03-24) "Token-based authentication implemented" — i.e. basic auth needed for the Subsonic API existed from the very start (Subsonic clients require it), well before there was any web UI to authenticate into.
5. **Web UI (React/react-admin)**: did not exist for **~4 years**. First commit: `ea862389` (2020-01-13T22:53:23-05:00) "Add ui subfolder, bootstrapped a 'hello-world' React-Admin app, changed Makefile to start both apps in dev mode" — same week as the LedisDB removal, SQLite switch, and Navidrome rename. Login page for that UI: `c661ac88` (2020-01-19) "Add a login page (not been used yet)"; `e717d997` (2020-01-20) "Authenticate UI".
6. **Stack, confirmed**: Go throughout (originally using the [Beego](https://beego.wiki) framework — README instructs `bee run`, and issue #1 in 2020 is a Dependabot bump of `astaxie/beego`); SQLite since Jan 2020 (`mattn/go-sqlite3`); web UI is React + [react-admin](https://marmelab.com/react-admin/) since Jan 2020.

**Summary of build order**: Subsonic API surface first (day 1) -> auth (day 1, required by that API) -> storage experiments (tiedot -> LedisDB, first week) -> scanning/import against an *external* iTunes library (first week, and for ~4 years) -> ... 4-year gap, effectively a solo hobby project with no releases and no web UI ... -> a ~2-week "everything at once" pivot in January 2020 (own SQLite-backed data model, drop iTunes dependency, bootstrap React web UI, add Docker, rename to Navidrome, start tagging releases).

### 3. TIMING relative to first release (v0.3.0, 2020-01-27)
- **Mobile clients (no official one — confirmed)**: Navidrome/CloudSonic/GoSonic has never shipped an official mobile app; the docs describe it as relying on the third-party Subsonic/OpenSubsonic client ecosystem (navidrome.org/docs/overview lists a client-apps directory rather than bundling an app). Concretely, this worked **years before v0.3.0 even existed**: commit `f760f892` (2016-02-29T16:49:27Z, six days after the first commit) is literally "DSub only works with POSTs..." — [DSub](https://f-droid.org/packages/github.dsub.donations/) is a third-party Android Subsonic client, and the project was already being debugged against it in its first week. This is the strongest evidence for the brief's point: implementing an existing API meant existing mobile clients worked from day one, long before there was any first-party UI or release process.
- **Subsonic API "first working"**: `ping.view` day 1 (2016-02-24); by **2016-03-03** (`757e199`, `838d4bf`) `getMusicDirectory` was "bare bones... working" for artists/albums — a browsable library over the API inside the first 10 days.
- **Built-in web UI (React/react-admin) arrival**: **2020-01-13** (`ea862389`), ~4 years after the Subsonic API was already usable by real clients (DSub). Multi-user login *to the web UI* specifically: `6978790e` (2020-02-05) "allow regular users to login to the UI" and `abb99a85` (2020-02-06) "add authentication via JWT token" — both **after** v0.3.0 (2020-01-27), so the very first tagged release predates general multi-user web-UI login by about 10 days.
- **Docker image**: `dee8e5c5` (2020-01-22) "Initial docker support" — 2 days *before* the Navidrome rename and 5 days before v0.3.0. Effectively simultaneous with the rename/relaunch.
- **Public demo (demo.navidrome.org)**: `ca10e800` (2020-07-14) "Add demo site to README.md", linking `https://www.navidrome.org/demo/` — **172 days (≈5.7 months) after** the Navidrome rename / v0.3.0. (Evidence thin on the exact day the demo server itself first went live vs. when it was announced in the README; this is the README-announcement date.)
- **Metadata providers**:
  - Last.fm: `eb74dad7` (2020-10-17) "Add initial last.fm client implementation" — ~9 months after v0.3.0.
  - Spotify (artist images): `19ead8f7` (2020-10-18), the very next day.
  - ListenBrainz scrobbling: `a56d5bc8` (2021-10-30), PR #1424 — about a year after Last.fm/Spotify.
  - (Contrast: an *iTunes* "scrobble" existed as early as 2016-03-11, `d23f5ca6` "Scrobble working!!! I mean, iTunes scrobble, not Last.FM (for now)" — but that's local iTunes play-count scrobbling, not the Last.fm network integration.)
- **Transcoding**: present in some form from very early (Subsonic API's `stream.view`/`download.view` needed it — `cc31366c` era notes they were initially identical because "we don't have transcoding configuration on the server side" yet), but was rebuilt multiple times: `f394de66` (2020-02-24) is literally titled "refactor: new transcoding engine. third (fourth?) time is a charm!" — i.e. the author's own commit message says this is at least the third rewrite of transcoding, about a month after v0.3.0.
- **Third-party APIs**:
  - Subsonic API: the project's *raison d'être* from commit 1 (2016-02-23) — this is not a "third-party API added later," it's the founding API.
  - Native REST API (used by the react-admin web UI, distinct from Subsonic): grows alongside the UI from Jan 2020; explicitly named/extended later, e.g. `af210c89` (2021-06-09) "Add Native Sharing REST API (#1150)" and `03efc481` (2021-06-13) "Refactor routing, changes API URLs (#1171)" — over a year after v0.3.0.

### 4. REGRETS / REWRITES
- **Storage layer rewritten twice**: tiedot -> LedisDB (within the first week, 2016-02-28) -> SQLite (2020-01-13/19, ~4 years later, in the same week as the Navidrome rename). Commit message for the Ledis removal is candid: `536244bc` "Removed LedisDB persistence layer. May reimplement in the future (not likely thou)".
- **Transcoding rewritten at least 3 times**: `f394de66` (2020-02-24) "refactor: new transcoding engine. third (fourth?) time is a charm!"
- **Data-source rewrite**: dropped iTunes-XML-library import in favor of an independent filesystem scanner + owned SQLite schema, same Big Refactor week of Jan 2020 (`67eeb218`, "Removed iTunes Bridge/Importer support").
- **The major scanner rewrite ("BFR" = Big Refactor), confirmed at v0.55/v0.56 as the task predicted:**
  - PR #2709, "BFR: Big Refactor (new scanner and DB schema changes)", merged **2025-02-20T01:35:18Z**. https://github.com/navidrome/navidrome/pull/2709. PR body opens with: **"⚠️ If you want to try it, be sure to backup your DB first! ⚠️ ... This is the branch/PR that holds the new Scanner implementation and changes in the Database schema. This will require a big refactor in large chunks of the codebase."**
  - Shipped in **v0.55.0**, released **2025-03-09T23:32:16Z** — 17 days after the PR merged. Release notes ("Navidrome 0.55.0 - Big Refactor (BFR) Release Notes") explicitly list a **"Breaking Changes"** section: *"Artist favourites and artist ratings will be lost after the upgrade. Albums may move around (change grouping), as the default disambiguation logic is slightly different than the previous version."*
  - Upgrade instructions in the same release notes: *"1. Backup Database... 4. Start Navidrome to automatically migrate the database schema. The upgrade process will trigger a **full scan of your library**, which may take some time... **Please don't report any bugs until this full scan is complete**."* This is the exact "full scan required" / schema-reset event the brief asked about. https://github.com/navidrome/navidrome/releases/tag/v0.55.0
  - Background/announcement thread: https://github.com/navidrome/navidrome/discussions/3676
  - v0.56.0 (2025-05-28) followed up with a security advisory for a SQL-injection bug introduced in the new scanner's artist-role filtering (GHSA-5wgp-vjxm-3x2r) — i.e. the rewrite had at least one immediate security regression that needed a fast-follow fix.
- No other full schema resets found in the history search (`rewrite`, `breaking`, `migration`, `full scan required` as search terms) beyond the ones above — the BFR (2025) is the only project-wide "back up your DB, expect a full rescan" event on record.

### Sources / method
- Full local clone of `github.com/navidrome/navidrome` (5,078 commits on default branch) used for `git log --grep`/`--diff-filter` history search.
- GitHub REST API (`gh api repos/navidrome/navidrome/...`) for releases, tags, and PR/issue metadata.
- `https://www.navidrome.org/docs/overview/` fetched for current mobile-client/API positioning.
- All shas above are abbreviated to 7-8 chars for readability; full sha and `html_url` given for the load-bearing ones.

---

### Mobile: did anyone regret the timing? (dated evidence)

- **Immich rebuilt its mobile app's data layer ~3.5 years in.** `v1.136.0`, published **2025-07-24T16:42:30Z** (`gh api repos/immich-app/immich/releases/tags/v1.136.0`), shipped a new timeline + "Sync v2" mechanism in beta — an on-device database and a streaming (JSON Lines) sync protocol replacing the original approach, because the old one loaded whole metadata chunks into memory and caused freezes, crashes, and battery drain. Release discussion: https://github.com/immich-app/immich/discussions/20133. Users then reported the new timeline endlessly re-syncing and duplicating (https://github.com/immich-app/immich/discussions/22996). So: mobile-first did not exempt Immich from a mobile rewrite; it just moved the rewrite to the client.
- **No maintainer statement of regret about mobile timing was found for any project.** I searched for advplyr (Audiobookshelf) commenting on mobile-app maintenance burden or update lag and found only user-side bug threads, no maintainer retrospective. **Say this plainly: the "did they regret it" question has no direct evidence either way.** What the record shows is cost, not stated regret: two codebases, two release cadences, two app-store review processes, and a client-side rewrite anyway.
- **The counter-evidence is strong and structural, though.** Navidrome had a working third-party Android client (DSub) being debugged against it on **2016-02-29, six days after the first commit** (`f760f892` "DSub only works with POSTs...") — four years before it had a web UI or a release. Komga had Tachiyomi working **one day after v0.1.0** (`7ca2880` 2019-08-28). Neither project ever wrote a line of mobile code. That is the single largest leverage difference in this dataset.


---

### Discovery-channel evidence: the 4-month rule (this is the strongest dated evidence on *why* to tag early)

`awesome-selfhosted` is the primary discovery list for this genre. Its contribution rules are explicit and mechanical (https://github.com/awesome-selfhosted/awesome-selfhosted-data/blob/master/CONTRIBUTING.md and `.github/ISSUE_TEMPLATE/addition.md`, both fetched 2026-09-05):

- Mandatory checkbox: **"Any software project you are adding was first released more than 4 months ago."**
- The rejection boilerplate in the same file spells out the mechanism verbatim:
  > "However, there are no tagged releases for this project. Our guidelines require that _Any software project you are adding was first released more than 4 months ago._ … Once this is done, the project may be resubmitted to awesome-selfhosted when the first release reaches the age of 4 months."
  and
  > "Currently, this project has a release, but it is not yet 4 months old. … This count initiates only after a release has been created to ensure users need not rely on the latest development version to use the project."
- Curation rule: **"Software with no development activity for 6-12 months may be removed from the list"**; "Unmaintained software without an active community may be removed."
- The entry schema treats a demo as **optional**: `# (optional) link to an interactive demo of the software / demo_url:` — as is `related_software_url` ("link to a list of clients/addons/plugins/apps/bots").

**Measured today** on the awesome-selfhosted README (`gh api .../contents/README.md`): **1,258 entries; 991 carry a Source Code link; 377 (30%) carry a Demo link.** So a demo is a real but minority attribute — 70% of listed self-hosted projects get by without one.

**Implication, and it is a hard one:** the discovery clock does not start at your first commit, or at your first working build. It starts at your **first tagged release**, and it runs for four months before you are even eligible to be listed. Every day you spend polishing before you cut `v0.1.0` is a day added to that clock. This is the clearest mechanical argument in the whole dataset for tagging something small and early — and it is exactly what Komga (19 days), Audiobookshelf (4 days), Karakeep (16 days) and Kavita (39 days) did.


---

## Karakeep

Repo: https://github.com/karakeep-app/karakeep (formerly `hoarder-app/hoarder`, same repo, transferred/renamed). Stack: Next.js web app + Prisma/SQLite, tRPC (API originally REST), BullMQ workers (Node), Puppeteer crawler, React Native/Expo mobile app, browser extension. Author: MohamedBassem.

### Original name, first commit, rename

- Original name: **Hoarder**. First commit: `fd25679` "Initial commit from Create Next App", 2024-02-04T23:30:32Z.
  https://github.com/karakeep-app/karakeep/commit/fd256793f165595fdb078d9ab52f06d79e776fdd
- Rename to **Karakeep** shipped in release **v0.23.1**, published 2025-04-05T15:37:45Z, titled "0.23.1 (Hoarder is rebranding to Karakeep)". Core rebrand commit: `16866d8` "chore: Hoarder to Karakeep rebranding (#1199)".
  https://github.com/karakeep-app/karakeep/releases/tag/v0.23.1
- Release notes quote (verbatim, v0.23.1): "This is not a typical release. Hoarder is rebranding to Karakeep. For context about the rebranding, check out the reddit announcement [here]... It's still unclear whether I'll be able to continue updating the hoarder docker image after the repo name change... Please note that the new docker image will not yet be available until I execute the repo transfer."
- The GitHub org itself is still reachable as `hoarder-app` (created 2024-05-19, `public_repos: 0` — all repos moved out to `karakeep-app`), confirming a real org/repo transfer, not just a re-tag. https://api.github.com/users/hoarder-app
- Rename cleanup dragged for weeks after the rebrand release, e.g. `4296e7f` "chore: rename missing files/conf from Hoarder to Karakeep (#1280)" merged 2025-04-21T19:59:40+02:00, and `5b91250` "fix: renamed export filename to karakeep (#1829)" as late as 2025-08-20 — evidence the rename was not a single atomic cutover.
- v0.24.0 (2025-04-27T18:55:48Z) is the first "full" post-rebrand feature release and confirms fallout: "⚠️ The Firefox extension is back under a new name (Action Required) ⚠️ ... After the rebranding unfortunately we couldn't get the old Firefox extension back, so we had to publish a new one." https://github.com/karakeep-app/karakeep/releases/tag/v0.24.0

### 1. First release

- First commit 2024-02-04T23:30:32Z → first tag **v0.1.0** published 2024-02-20T22:14:16Z = **16 days**, 85 commits (`gh api repos/karakeep-app/karakeep/compare/fd25679...v0.1.0 --jq .total_commits` = 85).
  https://github.com/karakeep-app/karakeep/releases/tag/v0.1.0
- v0.1.0 (and v0.2.0) have **empty release-note bodies** — evidence thin on "what shipped" via notes; reconstructed instead from the 85 commits leading up to it:
  Next.js scaffold (`fd25679`) → Prisma init (`61b08ab`, 02-05) → NextAuth (`b7fc334`, 02-05) → shadcn UI (`e47bfb0`, 02-05) → bookmark data model in Prisma (`81531a4`, 02-06) → REST `POST/GET /api/v1/links` (`d10b76b`/`e5b79e8`, 02-06) → Dockerfile (`b792121`, 02-06) → BullMQ workers package (`e035c2f`, 02-06) → Puppeteer-based metadata crawler (`baf48af`, 02-06) → bookmarks grid UI (`daebbf0`, 02-07) → delete support (`3745443`, 02-07) → **OpenAI tag extraction** (`8970b3a`, 02-07) → sidebar (`2659da5`, 02-08) → tRPC migration replacing the REST routes (`c2f1d6d` 02-10, `2c2d05f` 02-11) → API keys (`6aacc0c`, 02-12) → browser-extension scaffold (`e2bdccd`, 02-12) → login page (`c883bee`, 02-13) → tags/all-tags page (`da03fce`, 02-13). First tagged release v0.1.0 lands 6 days after that.

### 2. Build order (first ~100 commits)

Order was: **framework/auth scaffold → data model (Prisma) → API (REST, then rewritten to tRPC within days) → ingestion (BullMQ + Puppeteer crawler) → AI tagging → web UI → browser extension → mobile app**.
- Data model did **not** arrive whole: it started as a single `Bookmark`/link Prisma model (`81531a4`, 02-06) and was explicitly refactored to be generic days later: `08a5694` "[refactor] Extract the bookmark model to be a high level model to support other type of bookmarks" (2024-02-09T01:50:35Z) — i.e. bookmark types (link/text/image) were a deliberate, dated generalization, not present from day one.
- API arrived twice: a REST `api/v1/links` endpoint shipped on day 2 (`d10b76b`/`e5b79e8`, 2024-02-06), then was abandoned in favor of tRPC just 4 days later (`c2f1d6d` "Init trpc in prep for a migration", 2024-02-10; `2c2d05f` "refactor: Migrating to trpc instead of next's route handers", 2024-02-11). A documented, third-party-facing OpenAPI/REST layer only reappeared much later: `6ffa51d` "docs: Generate OpenAPI docs", 2024-10-20 — about 8 months after v0.1.0.
- Ingestion/scanning: BullMQ worker package initialized 2024-02-06 (`e035c2f`), Puppeteer crawling implemented same day (`baf48af`), later hardened against browser disconnects (`c80ac83`, 2024-02-14).
- Stack confirmed from repo metadata: TypeScript monorepo (yarn workspaces), Next.js (web/landing), Prisma, tRPC, BullMQ, Puppeteer, React Native/Expo (mobile), plus a browser extension package.

### 3. Timing relative to first release (v0.1.0, 2024-02-20)

- **Multi-user/accounts**: present from the start via NextAuth (`b7fc334`, day 1 area); an opt-out for public signups (single-admin mode) was added shortly after v0.1.0: `95fc3a0` "feature: Add an option to disable new signups" (2024-03-22), documented in `4977ef2` (2024-03-27, "Fixes #8"). So multi-user was the default from day one; single-user lockdown was the thing added later.
- **Official mobile app (React Native/Expo)**: scaffolding pre-dates v0.1.0 only slightly — mobile package was developed semi-separately and merged into the monorepo at `2b72040` "mobile: Prepare to merge into main repo" (2024-03-11T01:37:22Z, path `packages/mobile`). Its public introduction is confirmed in release notes: **v0.7.0** (published 2024-03-21T04:16:58Z) says verbatim "A new mobile app got introduced" — 29 days after v0.1.0. The monorepo's own mobile version tags only start at `mobile-v1.4.0` (commit dated 2024-04-17), implying versions 1.0-1.3 were pre-merge/pre-monorepo. A separate `karakeep-app/mobile-releases` repo (created 2025-06-01) now tracks store releases 1.6.9 → 1.9.4 (as of 2026-05-13).
- **AI tagging**: shipped extremely early, **before** the first release — `8970b3a` "[feature] Add openAI integration for extracting tags from articles", 2024-02-07T21:05:57Z, i.e. day 3 of the project and 13 days before v0.1.0.
- **Transcoding**: not applicable to Karakeep (no ffmpeg/media-transcode pipeline); closest analog is offline video archiving via yt-dlp, added much later: `4a13c36` "feature: Archive videos using yt-dlp. Fixes #215 (#525)", 2024-10-28.
- **Official public demo instance**: **yes, confirmed** — current README states "You can access the demo at https://try.karakeep.app" with a read-only seeded demo login. https://github.com/karakeep-app/karakeep (README, live as of research date; exact commit that added the demo not isolated — evidence thin on the add-date, but the instance's existence is directly confirmed from the source of truth).
- **Docker image**: present from day 6, before any tag — `b792121` "Add dockerfile", 2024-02-06T12:23:26Z, 14 days before v0.1.0.
- **Documented public API (REST/tRPC) for third parties**: OpenAPI docs generated 2024-10-20 (`6ffa51d`), ~8 months post-v0.1.0; API docs were reworked again in 2025 (`ae76f946` "docs: Release the new API docs", cited in v0.24.0 notes, 2025-04-27).

### 4. Regrets / rewrites

- **The rename itself was the biggest "migration" event.** Evidence of real pain across multiple releases and months, not a single clean cutover:
  - v0.23.1 (2025-04-05) ships the rebrand but hedges: "It's still unclear whether I'll be able to continue updating the hoarder docker image after the repo name change... the new docker image will not yet be available until I execute the repo transfer."
  - v0.24.0 (2025-04-27): Firefox extension had to be re-published under a new listing because "we couldn't get the old Firefox extension back" — users told they "MUST migrate to the new one manually."
  - Cleanup commits continued for months: `755fc36` "chore: Rename hoarder packages to karakeep" (2025-04-12), `4296e7f` (PR #1280, merged 2025-04-21), `5b91250` (PR #1829, merged 2025-08-20) — nearly 4.5 months of straggling rename fixes after the v0.23.1 announcement.
  - Passwords/config: `HOARDER_VERSION` env var upgrade path is explicitly called out in issue #1202 (2025-04-05) — users had `HOARDER_VERSION` pinned in existing docker-compose files that needed manual updating.
- **API deprecation, not rewrite**: v0.24.0 notes flag a breaking default-value change on a schedule: "For backward compatibility, this [`includeContent`] defaults to `true`, but starting from the next release, this will default to `false`." Also `0b769c35` "Deprecate the updateBookmarkText trpc endpoint and replace it with updateBookmark" (cited in v0.24.0, merged before 2025-04-27).
- **Auth rewrite**: PR #2057 "feat: Migrate from next-auth to better-auth" opened 2025-10-19 — a full auth-library migration roughly 18 months after the original NextAuth-based scaffold. https://github.com/karakeep-app/karakeep/pull/2057
- No evidence found of a database-engine migration (e.g. off SQLite) or a data-model rewrite comparable to Stash's folders/files refactor — Karakeep's schema changes so far read as additive (Prisma migrations), not a ladder rewrite. Evidence thin here; not confirmed either way beyond "no such issue/PR found" via `rewrite`/`schema` keyword search.

---

## Stash

Repo: https://github.com/stashapp/stash. Self-hosted adult-media organiser. Stack: Go backend, gqlgen-based GraphQL API (schema-first), React web UI (originally Angular), SQLite, ffmpeg for transcoding.

### Pre-history (not in the prompt's ask, but load-bearing for "build order")

The current `stash` GitHub repo was **created 2018-06-04** but its **first commit is dated 2019-02-09** (`87eeed7`, "Initial commit") — an 8-month gap between repo creation and first code, suggesting private development before any public history. https://github.com/stashapp/stash/commit/87eeed7e71965278bf3ecaad535850cabd4bac8a

More importantly, `stashapp` org hosts three earlier, now-archived attempts that predate the current codebase entirely:
- `stashapp/StashOSX` (Swift, native macOS app) created 2017-01-03, last push 2018-06-04. Archived. https://github.com/stashapp/StashOSX
- `stashapp/StashServer` ("Rails based organizer for your porn", Ruby) created 2017-03-04, last push **2019-02-11** — i.e. still being pushed to *two days after* the current Go repo's first commit, implying a brief handoff overlap. Archived, 228 pages of commit history. https://github.com/stashapp/StashServer
- `stashapp/StashFrontend` (TypeScript) created 2017-08-11, last push 2018-11-25. Archived. https://github.com/stashapp/StashFrontend

Read plainly: before the Go+GraphQL+React app that shipped, Stash went through at least a native-Swift attempt and a Ruby-on-Rails-backend attempt, both abandoned. This is evidence-based, not inferred from opinion — dates and archive status are from the GitHub API.

### 1. First release

Two candidate "first releases," both worth citing since they tell different stories:
- **`v0.0.0-alpha`**, published 2019-02-10T03:54:46Z — **one day** after the first commit. But this tag's own release name is "Early Preview (This is always the latest master branch)", `"prerelease": true`, and its body field just contains a rolling timestamp ("2019-11-18 02:31:46 UTC" as last observed) — i.e. it is a **floating nightly tag that gets overwritten**, not a dated snapshot. Citing "1 day to first release" would be misleading.
  https://github.com/stashapp/stash/releases/tag/v0.0.0-alpha
- **`v0.1.0`**, published 2020-02-24T05:02:13Z, `"prerelease": false` — the first real numbered release. First commit (2019-02-09) to v0.1.0 = **380 days**, spanning 365 commits (`gh api repos/stashapp/stash/compare/87eeed7...v0.1.0 --jq .total_commits` = 365).
  https://github.com/stashapp/stash/releases/tag/v0.1.0
- What was in v0.1.0 (verbatim from release notes): "Configurable custom performer scrapers" (#203, #333), "Support looping of short videos" and "Optionally auto-start videos" (#230), "Add scene auto-tagging from filename" (#204), "Configurable custom scene metadata scrapers" (#236, #285, #333), "Add 'O-' (or 'splooge-') counter" (#334), "Support scraping from other stash instances" (#269), plus dozens of UI/bugfix items. By its first real release, Stash already had a mature, configurable scraper system — this did not arrive in v0.1.0 from nothing; see build order below.

### 2. Build order (first ~100 commits, and the initial commit itself)

Unlike an app that grows a feature at a time in public, **Stash's first public commit (`87eeed7`, 2019-02-09, 300 files) already contained essentially the whole stack at once**:
- GraphQL schema-first API: `schema/schema.graphql`, `gqlgen.yml` (Go gqlgen codegen config), plus per-entity `.graphql` documents (`scene.graphql`, `performer.graphql`, `studio.graphql`, `tag.graphql`, `gallery.graphql`, `scene-marker.graphql`) — all present day one.
- Import/export & jsonschema: `internal/manager/jsonschema/{config,performer,scene,scraped,studio}.go` — present day one.
- Scanner: `internal/manager/task_scan.go` — present day one.
- Transcoding: `internal/ffmpeg/{encoder,ffprobe,types}.go` — ffmpeg integration present day one.
- A working web client already existed on day one too: `ui/v1` — an **Angular** app (`angular.json`) with a GraphQL-codegen'd client (`graphql-generated.ts`).

So: **schema arrived first and whole, not grown** — the opposite of an organically-built app. The one big rewrite in the earliest history is the **UI**, not the schema: 6 days later, `66d2c5c` "UI V2" (2019-02-15T17:15:00Z) replaces the entire `ui/v1` Angular app with a new **React** SPA (`ui/v2`, create-react-app conventions, `.tsx`, its own GraphQL codegen). The commit message shows it was squash-merged from 51 separate "stuff" commits on a side branch — i.e. developed in parallel and dropped in whole, not iterated on in Stash's visible public history. Framework choice (Angular → React) was reconsidered within the first week, before any tagged release existed.
https://github.com/stashapp/stash/commit/66d2c5c

Ingestion/scraping did grow, unlike the schema: a hardcoded FreeOnes performer-suggest scraper shipped in the UI V2 squash (`FreeOnesPerformerSuggest.tsx`, 2019-02-15) and was patched for bugs by 2019-04-11 (`bcc70af`), but the **generic, user-configurable scraper system** highlighted in v0.1.0's release notes didn't land until `1724706` "Generic performer scrapers (#203)" (2019-11-19) and `5078402` "Change scraper config to yaml (#256)" (2019-12-13) — i.e. roughly 9 months after the first hardcoded scraper.

Stack confirmed: Go (backend, gqlgen, ffmpeg wrapper), SQLite, GraphQL (schema-first, not code-first — schema and gqlgen scaffold predate any resolver logic being iterated in public), React (from day 6) served by embedded Go binary/Docker image.

### 3. Timing relative to first release (v0.1.0, 2020-02-24)

- **Multi-user accounts: does not exist, and the maintainers have declined to add it.** Only a single optional password gate exists: `5a891d0` "Add basic username/password authentication" (2019-07-28), later replaced by `15e7756` "Replace basic auth with cookie authentication (#440)" (2020-04-08, ~6 weeks after v0.1.0). True per-user accounts have been requested repeatedly and refused: issue #3119 "[Feature] Multiple accounts and users" (opened 2022-11-11) was closed same day with `state_reason: "not_planned"`; issue #2337 "Support multiple users with configurable permissions" (opened 2022-02-21) remains **open** with 27 comments and no resolution as of this research. https://github.com/stashapp/stash/issues/3119 https://github.com/stashapp/stash/issues/2337
- **Official mobile app: confirmed none.** README's install matrix lists only Windows / macOS / Linux / Docker; the only "mobile" mention in the codebase is responsive-layout / touch-gesture support inside the web UI (e.g. PR #357 "Add new v2.5 UI", 2020-02-09; issue #1303 "[Feature] A2HS Support" i.e. add-to-homescreen PWA support, 2021-04-14) — a responsive web app, not a native/React-Native client. No mobile app repo exists under the `stashapp` org.
- **Metadata providers/scrapers**: present in primitive (hardcoded FreeOnes) form from the first week (2019-02-15) but only became the documented, configurable "scraper" system by `1724706` (2019-11-19) — roughly 3 months before v0.1.0 and codified as its headline feature. A parallel, structured metadata API (`stash-box`, a separate repo/service) was created 2019-11-12 — essentially the same week as the generic scraper system, and also pre-dates v0.1.0.
- **Transcoding (ffmpeg)**: present from the **first public commit** (2019-02-09) — `internal/ffmpeg/*` — and an ffmpeg auto-download feature shipped day 2: `2565173` "FFMPEG auto download" (2019-02-11T06:39:21Z). A dedicated "Added transcode task" commit landed the same day (`4f80dec`, 2019-02-11T20:12:08Z). Transcoding is therefore older than the first release by over a year, and older than any tagged release at all.
- **Official public demo instance: no.** The current README offers only a recorded walkthrough — "You can watch a SFW demo video" (Vimeo link) — not a live, browsable instance. No `try.stashapp` or similar has been found in README/docs search. Evidence: current README content, https://github.com/stashapp/stash (README.md).
- **Docker image**: `83ee83c` "Dockerfile for production. (#44)" merged 2019-04-24 — about 2.5 months after the first commit and about 10 months before v0.1.0. Docker Hub badge (`stashapp/stash`) is advertised in the current README.
- **Documented GraphQl API for third parties**: because the API is schema-first from commit 1, a browsable API (GraphQL Playground) has existed essentially since the beginning; it needed CSP/security hardening much later (`65b8a3f`, 2021-12-18; `ed08dd4`, 2022-04-06) once it was clearly being used by external tooling/browsers. Formal prose documentation moved to its own repo late: `stashapp/Stash-Docs` created 2022-12-01, i.e. **~2 years 9 months after v0.1.0** — the schema was queryable from day one, but a dedicated docs site came much later.

### 4. Regrets / rewrites

- **Pre-Go rewrites (biggest, least visible regret)**: as covered in "Pre-history" above — a Swift native app (`StashOSX`, 2017) and a Ruby-on-Rails backend (`StashServer`, 2017-2019) were both abandoned in favour of the current Go/GraphQL/React app, whose own first commit is 2019-02-09. Evidence: repo creation/archive metadata via GitHub API, not opinion.
- **Angular → React UI rewrite**: `66d2c5c` "UI V2" (2019-02-15), 6 days after the current codebase's first commit — the entire web client was replaced before any release existed. See build order above.
- **The "files refactor" (v0.17.0 / v0.18.0), the schema migration the prompt asked about, is real and well documented**:
  - PR **#2676** "File storage rewrite" opened 2022-06-16, merged **2022-07-13T06:30:54Z**. Verbatim from the PR body: "This PR is a significant rewrite of the underlying object model for scenes, images and galleries... File-specific fields have been removed or deprecated from scenes, images and galleries, replaced with relationships to files and folders... This PR is likely to have many regressions and will need extensive testing... import/export functionality is currently disabled. Needs further design." https://github.com/stashapp/stash/pull/2676
  - Shipped in **v0.17.0**, published 2022-10-19 (`releases/tags/v0.17.0`). Verbatim release-note warnings: "This release includes a migration that significantly changes the way that stash stores information about your files... To prevent timeout errors, please run the migration with a direct connection and not via reverse proxy. The migration can take a long time on larger systems... 💥 Import/export schema has changed and is incompatible with the previous version." https://github.com/stashapp/stash/releases/tag/v0.17.0
  - Real user pain, dated: issue **#2939** "develop build creates empty galleries when encountering duplicates" (2022-09-22, pre-release bug against the `develop` build) and issue **#2941** "[Bug Report] Migration failed error" (2022-09-23) — a user's migration failed outright with `UNIQUE constraint failed: files.parent_folder_id, files.basename`, requiring Stash's own auto-rollback ("backup database file was automatically renamed to restore the database"). The migration SQL (visible in the issue) drops and rebuilds `scenes`, `images`, `galleries` tables entirely, replacing single `path`/`checksum` columns with normalized `files`/`folders`/`*_files` join tables.
  - v0.18.0 (published 2022-11-30) continued building on the new model (split/merge scenes, reassign files, scenes-without-files) rather than reverting anything — evidence the rewrite was a deliberate, sustained architectural direction, not a rollback.
- **No evidence found** of an equivalent GraphQL *schema* rewrite (schema-first was a stable choice from commit 1) — the big breaking migrations are all data-layer (SQLite table structure), not API-contract rewrites. Search for "deprecat" turned up routine field-level deprecations (individual scan flags, e.g. `Set name, date, details from embedded file metadata` retired in v0.17.0) rather than a wholesale API rewrite — evidence thin/none for API-contract breakage beyond that.

---

## 5. Is there a common shape to the first six months? (partial table — updated as sections land)

### First commit → first release

| Project | First commit | First release | Days | What the first release actually contained |
|---|---|---|---:|---|
| Audiobookshelf | 2021-08-17 `6930e69` "Init" | `0.9.61-beta` 2021-08-21 (tag) / `v1.0.0` 2021-09-04 (GH release) | **4** / 18 | Whole vertical slice, present in commit 1: njodb JSON store, scanner, chokidar watcher, Express API, Nuxt web UI, ffmpeg/HLS transcoding, Dockerfile. Multi-user by v1.0.0. Release body empty. |
| Immich | 2022-02-03 `af2efbd` / `568cc24` (squashed transfer from private GitLab) | `first-android-release` tag 2022-02-06 (day 3); `v0.2-dev` 2022-02-08 | **3** / 5 | **An APK.** Every feature in the v0.2-dev notes is a mobile feature (Auto Backup, Group Selection, Multiple Selection, Video Player). No server-side changelog entry at all, though the server code existed. |
| Romm | 2023-03-08 `eb325b9` | `v1.0` 2023-03-28 | **19** | Release notes in full: *"## Added / - Birth of RomM / ### Docker image v1.0"*. FastAPI + raw SQL over MariaDB + Vue, with IGDB and SteamGridDB ids baked into the schema from commit 1. No multi-user until +213 days. |
| Calibre-Web | 2015-08-02 `64a9cbc` "Initial Fork from …calibreserver" | `0.6.0` tag 2019-01-27, GH release 2019-04-20 | **1,274 / 1,357** | An already-complete app inherited by fork. Its first release notes list 13 features including "User management", "OPDS feed", "Support for converting eBooks through Calibre binaries". Never left the 0.6.x line (0.6.0 → 0.6.27). |
| Karakeep (Hoarder) | 2024-02-04 `fd25679` "Initial commit from Create Next App" | `v0.1.0` 2024-02-20 | **16** | 85 commits: Next.js + Prisma + NextAuth + REST→tRPC + BullMQ/Puppeteer crawler + OpenAI tagging + grid UI + Dockerfile + browser-extension scaffold. Release body **empty**. |
| Komga | 2019-08-08 `6b0d849` | `v0.1.0` 2019-08-27 | **19** | Two entities (Series, Book), scanner, cbz/cbr extraction, thumbnails, REST API, Docker. Full release note: *"First release, support for `cbr` and `cbz` archives"*. |
| Kavita | 2020-12-12 `a2e6d03` (bare dotnet scaffold) | `v0.1` 2021-01-20 (prerelease-flagged) | **39** | Users+roles, per-library access, cbz/cbr/zip reading, ad-hoc scan, ratings, read progress, cache. Notes: *"more of a milestone than a proper release … a lot of the work is preliminary."* |
| Stash | 2019-02-09 `87eeed7` (300 files) | floating `v0.0.0-alpha` nightly at day 1; real `v0.1.0` 2020-02-24 | **380** | Whole stack in commit 1: GraphQL schema, scanner, ffmpeg, Angular UI. v0.1.0 headline was the *configurable scraper system*. |
| Navidrome | 2016-02-23 `5d6fd4e` | `v0.3.0` 2020-01-27 | **1,433** | Changelog in full: *"476c695 ci: create binaries with goreleaser"*. |

**The median for a project that intends to be released is 4–39 days.** The two long ones are explained, not counterexamples: Navidrome ran four years as a personal Subsonic-API implementation with no releases, no web UI and no GitHub issues before a two-week January-2020 pivot (own SQLite schema, React UI, Docker, rename, first tag) — the tag marked the decision to *distribute*; Stash cut a floating nightly on day 1 and only numbered it a year later, after two abandoned prior codebases (Swift `StashOSX`, Rails `StashServer`).

**Nobody in this set waited to be finished.** Two shipped release notes that were literally one line; two shipped release notes that were literally *empty*; one called its own release "more of a milestone than a proper release"; one's entire changelog was "we added CI to build binaries".


---

## Calibre-Web

Repo: `janeczku/calibre-web`. All dates from `gh api repos/janeczku/calibre-web/...` (commits, tags, releases), retrieved 2026-09-05.

### 1. First release

- **First commit**: `64a9cbc`, 2015-08-02T18:59:11Z, message "Initial Fork from https://bitbucket.org/raphaelmutschler/calibreserver/" (Jan Broer). It lands the whole app in one commit (233,749 additions: `cps.py`, `cps/db.py`, `cps/ub.py`, `cps/config.py`, `cps/helper.py`, full Bootstrap templates/static assets).
  https://github.com/janeczku/calibre-web/commit/64a9cbc
- **First tag/release**: `0.6.0` — tag commit dated 2019-01-27T07:32:26Z, GitHub Release published 2019-04-20T10:09:26Z.
  https://github.com/janeczku/calibre-web/releases/tag/0.6.0
- **Gap**: 1,274 days (commit → tag) / 1,357 days (commit → published release) — about 3.7 years. Calibre-Web ran for years as an unversioned, continuously-developed fork before its first formal tagged release; only 27 tags exist in total (0.6.0 through 0.6.27, current as of 2026-08-08), i.e. it has never left the "0.6.x" line in its entire release history.
- **Verbatim release notes, `0.6.0`, "Initial Release"** (https://github.com/janeczku/calibre-web/releases/tag/0.6.0):
  > - Bootstrap 3 HTML5 interface
  > - full graphical setup
  > - User management
  > - OPDS feed for eBook reader apps
  > - Filter and search by titles, authors, tags, series and language
  > - Create custom book collection (shelves)
  > - Support for editing eBook metadata and deleting eBooks from Calibre library
  > - Support for converting eBooks through Calibre binaries
  > - Send eBooks to Kindle devices with the click of a button
  > - Support for reading eBooks directly in the browser (.txt, .epub, .pdf, .cbr, .cbt, .cbz)
  > - Upload new books in many formats
  > - Support for Calibre custom columns
  > - Self update capability

  Note the release body itself frames the app as working against "Calibre library" / "Calibre custom columns" — i.e. even the first formal release describes itself as a client of Calibre's data, not an owner of a schema.

### 2. Build order / schema provenance

Calibre-Web does not have a "schema arrives whole vs. grows" story in the usual sense, because **it never designed a book schema at all** — it forked an existing app that already read Calibre's `metadata.db`.

- `cps/db.py` at the first commit (`64a9cbc`) already does:
  ```python
  dbpath = os.path.join(config.DB_ROOT, "metadata.db")
  engine = create_engine('sqlite:///{0}'.format(dbpath), echo=False)
  ```
  and declares SQLAlchemy classes mapped straight onto Calibre's own tables: `books_authors_link`, `books_tags_link`, `books_series_link`, `books_ratings_link`, `Comments`, `Tags`, `Authors`, `Series` — these are Calibre's table names, not names Calibre-Web invented.
  https://github.com/janeczku/calibre-web/blob/64a9cbc/cps/db.py
- The *only* schema Calibre-Web's authors actually designed from day one is a second, separate SQLite database for app concerns: `cps/ub.py` (also present at `64a9cbc`) opens `app.db` and defines its own `User` model (`ROLE_USER = 0`, `ROLE_ADMIN = 1`, `nickname`, `email`, `password`, `kindle_mail`, relationships to `Shelf`/`Whislist`/`Downloads`). This is genuinely Calibre-Web's own schema, and it existed from commit 1.
  https://github.com/janeczku/calibre-web/blob/64a9cbc/cps/ub.py
- There is no "scanner" to build: Calibre itself scans and writes `metadata.db`; Calibre-Web only reads/queries it (and writes back edits via the same schema). So the build order is: **borrowed data layer (day 0, inherited via fork) → web UI/templates (day 0, inherited) → own auxiliary user/shelf schema (day 0, inherited) → incremental feature layer on top** (OPDS docs 2015-10-12; Kindle send by 2015-08-04; PDF upload April 2016; ebook conversion via Calibre binaries July–Sep 2018; Kobo device sync Nov–Dec 2019; a real pluggable metadata-search layer only in July 2021 — see §3).
- Stack (as of first commit): Python (Flask, given `cps.py`), SQLAlchemy ORM over SQLite, Bootstrap 3 HTML5 templates, jQuery-era JS. Confirmed by file listing at `64a9cbc`.

Docs confirming the borrowed-schema/borrowed-library relationship (current README, retrieved 2026-09-05):
> "3. **Database Setup**: If you do not have a Calibre database, download a sample from: https://github.com/janeczku/calibre-web/raw/master/library/metadata.db"
> "4. **Configure Calibre Database**: In the admin interface, set the `Location of Calibre database` to the path of the folder containing your Calibre library (where `metadata.db` is located) and click 'Save'."
https://github.com/janeczku/calibre-web/blob/master/README.md (lines ~105–110)

### 3. Feature timing relative to first release (0.6.0, published 2019-04-20)

| Feature | First evidence | Relative to 0.6.0 |
|---|---|---|
| Multi-user accounts (roles) | `cps/ub.py`, commit `64a9cbc`, 2015-08-02 | ~1,357 days **before** release (present since the fork) |
| OPDS feed | Present at fork; docs added `9d22eb1`, 2015-10-12 ("Add instructions for OPDS feed"); HTTP-Basic auth for OPDS `3502856`, 2015-10-13; renamed/hardened `157a2e6`, 2016-12-28 | Before release — OPDS is Calibre-Web's documented third-party API and was inherited/working from day one |
| Ebook conversion via Calibre binaries | `2449b40`, 2018-07-18, "Enable calibre's ebook-convert as converter for mobi files"; background conversion `7be328c`, 2018-08-12; refactor `c3b0492`, 2018-08-31 | ~9 months before release; shipped as a headline 0.6.0 feature |
| Google Books / Kobo external links | `b6fccbd`, 2017-04-27, "Added Google Books and Kobo links" | Before release, but this was just outbound links, not a metadata-fetch provider |
| Metadata fetch (single provider, Douban) | `80e6311`, 2017-02-21, "fetch metadata from douban while editing metadata" | Before release |
| Real pluggable metadata-provider mechanism (Amazon, Comicvine, Douban, Google, LubimyCzytac, Scholar) | `94da61c` "Basic Metadata mechanism in python", 2021-07-05; Google added `aa2d3d2`, 2021-07-07 | **~2 years 3 months after** first release |
| Kobo device sync (reading-device sync, not a Calibre-Web mobile app) | `5357867`, 2019-11-05, "Add initial support for Kobo device Sync endpoint"; auth token added `9ede01f`, 2019-12-07 | ~7 months after release |
| Official mobile app | No evidence found. README (current, retrieved 2026-09-05) has no mention of "mobile", "Android app", or "iOS app". Calibre-Web's third-party-app story is OPDS-client compatibility, not a first-party app. |
| Public demo instance | No evidence found. README has no "demo" section/link. |
| Docker image | README already links Docker Hub at `6e26c08`, 2015-08-05 — 3 days after the fork (an existing image from the pre-fork project) |
| Documented third-party API | OPDS, present from the fork (see above) — this is Calibre-Web's answer to "API for third parties"; there is no separate REST/GraphQL API for third parties. |

### 4. Regrets / rewrites / the borrowed-schema constraint

- **No rewrite, no major-version break in the codebase itself.** The project has shipped exactly one tag lineage, 0.6.0 → 0.6.27 (latest as of 2026-08-08), across more than 7 years of tagged releases and 10+ years of total history. Search for "rewrite"/"breaking change" in issues turns up only incidental false positives (e.g. an IIS "rewrite module" question, #490) — no evidence of a planned rewrite or schema migration for Calibre-Web's own data model.
  https://github.com/janeczku/calibre-web/issues/490
- **The borrowed-schema dependency is a real, demonstrated constraint, not just a design footnote.** Issue #1633 (created 2020-09-25, reported against Calibre-Web 0.6.9 alpha): when Calibre itself shipped v5.0, it added new tables (`annotations*`, full-text-search tables) to `metadata.db` using SQLite syntax Calibre-Web's older SQLite couldn't parse, crashing Calibre-Web outright:
  > `[2020-09-26 00:48:17,323] ERROR {cps.config_sql:315} (sqlite3.DatabaseError) malformed database schema (annotations_fts_stemmed_config)-near "WITHOUT": syntax error`
  > `[SQL: attach database '/ebook/database/metadata.db' as calibre;]`
  https://github.com/janeczku/calibre-web/issues/1633
  This is direct, dated proof that Calibre-Web has no control over its own core data model's evolution — a schema change made unilaterally by an upstream, unrelated project (Calibre) can break Calibre-Web, and did.
- No evidence of Alembic-style migrations for the `app.db` (user/shelf) schema was found in this pass; that schema has grown by ad hoc `ALTER`/version-check code in `cps/db.py`/`cps/config_sql.py` rather than a migration framework (worth a follow-up pass if this detail is load-bearing).

### 7 (continued). What a demo actually costs, and whether it pays

- **A demo is infrastructure, not a link.** The `immich-app/demo` repo (archived; setup now under `immich-app/devtools/kubernetes/apps/preview/demo`) documents the real work: a separate docker-compose stack, `run-geocoder.sh`, `download-library.sh`, `create-dummy-gps.py` to fabricate plausible GPS data for the dummy library, and a `demo-restart.sh` reset script. Komga, Karakeep and Immich all had to add **demo-mode code paths inside the application** (Komga `24b2125` "feat: demo profile"; Karakeep `96829e3`/`64fb87d`/`d9d6725`; Immich later disabled uploads after abuse).
- **Komga's own README does not mention the demo at all** (`gh api repos/gotson/komga/contents/README.md`, grep "demo" → no matches); it lives only on the docs site. So even where a demo exists it is often not in the primary funnel.
- **Direct evidence that a demo drives adoption: none found.** No project publishes traffic, conversion or install numbers attributable to a demo. The only causal artefact is a user *asking* for one (Immich #720, 2022-09-19). Combined with the awesome-selfhosted measurement (70% of 1,258 listed projects have no demo link), the honest conclusion is: **a demo is a nice-to-have that arrives after product-market fit, not a growth lever you build early.** Anyone claiming otherwise is expressing an opinion, not citing data.


---

## Romm

Repo: `rommapp/romm` (originally `zurdi15/romm`). All dates from `gh api repos/rommapp/romm/...` (commits, tags, releases, PRs, issues) and `docs.romm.app`, retrieved 2026-09-05.

### 1. First release

- **First commit**: `eb325b9`, 2023-03-08T16:11:12Z, "initial commit" (zurdi zurdo). Lands 1,893 lines across a FastAPI backend (`backend/src/main.py`, `handler/db_handler.py`, `handler/igdb_handler.py`, `handler/sgdb_handler.py`, `data/data.py`) and a Vue.js frontend (`frontend/App.vue`, `components/Game.vue`, Vite config).
  https://github.com/rommapp/romm/commit/eb325b9
- **First tagged release**: `v1.0`, published 2023-03-28T00:26:55Z.
  https://github.com/rommapp/romm/releases/tag/v1.0
- **Gap**: ~19.3 days.
- **Verbatim release notes, `v1.0`**:
  > ## Added
  > - Birth of RomM
  > ### Docker image [v1.0](https://hub.docker.com/layers/zurdi15/romm/1.0/images/sha256-b8550b2b0c68c7d7847b0fac94c34b3749cf50b73a439f4c6070aeac6dc089ef?context=repo)

  Terse, but load-bearing: a Docker image shipped alongside the very first tagged release (day 19).

### 2. Build order / schema

Unlike Calibre-Web, Romm designed its own schema from the start — but the schema and the IGDB/SGDB metadata integration arrived **together**, not schema-then-providers.

- First commit's `backend/src/data/data.py` already defines Romm's own dataclasses:
  ```python
  @dataclass
  class Platform:
      igdb_id: str = ""
      sgdb_id: str = ""
      slug: str = ""
      name: str = ""
      path_logo: str = DEFAULT_IMAGE_PATH

  @dataclass
  class Rom:
      igdb_id: str = ""
      sgdb_id: str = ""
      platform_igdb_id: str = ""
      platform_sgdb_id: str = ""
      filename: str = ""
      name: str = ""
      path_cover: str = DEFAULT_IMAGE_PATH
  ```
  https://github.com/rommapp/romm/blob/eb325b9/backend/src/data/data.py
  Note the `igdb_id`/`sgdb_id` fields are baked into the schema from the first line of code — the metadata-provider relationship is not an add-on, it's designed into the table shape itself.
- `backend/src/handler/db_handler.py` (first commit) hand-rolls raw SQL against MariaDB (`create table if not exists romm.platform (...)`, `create table if not exists romm.rom (...)`) — Romm's own schema, own tables, no borrowed database.
  https://github.com/rommapp/romm/blob/eb325b9/backend/src/handler/db_handler.py
- `backend/src/main.py` (first commit) already wires a `/scan` endpoint that walks the filesystem (`fs.get_platforms()`), calls IGDB for platform metadata, downloads logos, and writes to the DB, plus a `/platforms` read endpoint — i.e. **scanner + metadata provider + API arrived in the same commit**, before there was a UI to speak of beyond a Vue mockup.
  https://github.com/rommapp/romm/blob/eb325b9/backend/src/main.py
- Second commit, same day (`2359b6b`, 2023-03-08T17:09:49Z): "fixed twitch token check when using igdb handler" — IGDB's Twitch-OAuth quirk was already being debugged within the hour.
- Stack: Python/FastAPI + MariaDB (raw SQL) on the backend, Vue 3/Vite (Vuetify added `03aac67`, 2023-03-09) on the frontend.
- **Schema then grew and was rewritten repeatedly** — this is the opposite trajectory from Calibre-Web:
  - `45c2dfb`, 2023-03-22, "changed to ORM database models with sqlalchemy" — raw SQL → SQLAlchemy, 14 days after the first commit, 6 days *before* v1.0 shipped.
  - `ae7d00d`, 2023-04-10, "alembic migrations system added" — 13 days after v1.0; this is when Romm got real schema-migration tooling.
  - `3.0.0` (2024-03-11) release notes: "Dropped support for build-in SQLite database" — Romm had briefly supported SQLite as an alternative store and cut it, a backward-incompatible storage decision.
  - PR #954, merged 2024-06-25, "misc: Migrate to SQLAlchemy declarative models" — a second, more disciplined ORM rewrite over a year after the first.
    https://github.com/rommapp/romm/pull/954

### 3. Feature timing relative to first release (v1.0, 2023-03-28)

| Feature | First evidence | Relative to v1.0 |
|---|---|---|
| IGDB metadata provider | `eb325b9`/`2359b6b`, 2023-03-08 (`handler/igdb_handler.py` in the initial commit) | Present **before** v1.0 — it predates the first release by ~20 days; IGDB is foundational, not added later |
| SteamGridDB (cover art) | `eb325b9`, 2023-03-08 (`handler/sgdb_handler.py` in the initial commit) | Same — foundational |
| Multi-user accounts/roles | v2.0.0, published 2023-10-27: "Authentication and user management system (#24)" | **~213 days after** v1.0 — Romm shipped v1.0 *without* multi-user auth and added it as a headline, breaking v2.0 feature |
| Alembic schema migrations | `ae7d00d`, 2023-04-10 | 13 days after v1.0 |
| Frontend rewrite to TypeScript | PR #565, merged 2024-01-04 | ~9 months after v1.0 |
| EmulatorJS in-browser play (transcoding/emulation-adjacent) | v3.0.0, published 2024-03-11 | ~11.5 months after v1.0 |
| MobyGames metadata provider | Issue #661 opened 2024-02-13, merged 2024-03-26 | ~1 year after v1.0 |
| ScreenScraper metadata provider | Requested in issue #212 (2023-04-28, ~1 month after v1.0!) but not shipped until PR #1416, merged 2025-02-17 | ~22 months after v1.0 (feature requested almost immediately; took ~21 months to land) |
| Documented REST API + OpenAPI ("API Reference," "Client API Tokens," "Consuming OpenAPI") | Present in current docs (docs.romm.app, retrieved 2026-09-05); per-user API keys tracked as a feature request in issue #2082, opened 2025-07-15 (~2 years 4 months after v1.0) | API docs pages exist now; dedicated per-user API keys are a mid-2025+ addition |
| Public demo instance | Current docs: "Website · Demo · Discord" — https://demo.romm.app | Present now; no first-appearance date established this pass |
| Official ("first-party") Android app — Argosy Launcher | `rommapp/argosy-launcher` GitHub repo created 2025-12-06 ("A native Android client for RomM for syncing, installing, and launching games on any of your mobile devices") | **~2 years 8 months after** v1.0 |
| Community (unofficial) Android app | v4.0.0 release notes (published 2025-07-20) explicitly: "Community member ... has just released an **unofficial** companion app for RomM ... not yet available on the Google Play Store" (mattsays/romm-android) | ~2 years 4 months after v1.0 — i.e. an unofficial app existed ~5 months before the official one |
| Handheld clients (muOS/Miyoo Mini) | `rommapp/miyoo-mini-app` created 2025-01-04; `rommapp/muos-app` created 2025-01-23; `rommapp/grout` (first-party muOS/NextUI sync client) created 2025-11-15 | ~1 year 9–10 months after v1.0 |
| Windows desktop client | `rommapp/playnite-plugin` (Playnite library plugin) created 2024-03-19 | ~1 year after v1.0 |
| Docker image | Present at v1.0 itself (2023-03-28) | Day of first release |

### 4. Regrets / rewrites / breaking releases

- **v2.0.0** (2023-10-27) — explicit "BREAKING CHANGES" section: exposed port changed 80→8080, `CLIENT_ID`/`CLIENT_SECRET` env vars renamed to `IGDB_CLIENT_ID`/`IGDB_CLIENT_SECRET`. Also where multi-user auth landed.
  https://github.com/rommapp/romm/releases/tag/v2.0.0
- **v3.0.0** (2024-03-11) — new AGPL-3.0 license (from a presumably more permissive/unlicensed start), dropped built-in SQLite support, "Reworked the authentication system to reduce CSRF and login issues."
  https://github.com/rommapp/romm/releases/tag/3.0.0
- **v4.0.0** (2025-07-20) — release notes lead with a security disclosure: "This release fixes a **critical** authenticated arbitrary file write vulnerability (CVE-2025-54071) in all API endpoints that accept uploaded files, which can lead to remote code execution on the system. All previous versions are affected."
  https://github.com/rommapp/romm/security/advisories/GHSA-fgxf-hggc-qqmq
  https://github.com/rommapp/romm/releases/tag/4.0.0
- **Release-process maturation**: v1.0→v2.0.0→3.0.0 shipped as single tags with no pre-release candidates. v4.0.0 (2025-07-20) and v5.0.0 (2026-07-15) each went through multi-week alpha/beta/rc cycles (4.0.0-alpha.1 on 2025-07-08 through 4.0.0 on 2025-07-20; 5.0.0-alpha.1 on 2026-06-23 through 5.0.0 on 2026-07-15) — evidence the project adopted a more cautious release process for its largest/breaking changes as it matured.
- **ORM/schema churn**: raw SQL (day 0) → SQLAlchemy (day 14) → Alembic migrations (+13 days post-v1.0) → SQLAlchemy declarative-models rewrite (PR #954, merged 2024-06-25) → SQLite support dropped (3.0.0, 2024-03-11). Four distinct data-layer changes inside ~15 months, versus Calibre-Web's zero (because Calibre-Web never owned the schema to begin with).
- Frontend also rewritten: PR #565 "Typescript rewrite of front end," merged 2024-01-04, ~9 months after v1.0.

---

## 6. Mobile client early vs late — the finding

**Who has an official mobile app, and when it arrived relative to the server's first release:**

| Project | Official app | Arrived |
|---|---|---|
| Immich | Yes (Flutter) | **Before everything.** The mobile app is in the very first public commit (`568cc24` 2022-02-03, transferred from GitLab); the project's *first git tag is literally named* `first-android-release` (2022-02-06, day 3). Mobile was the product; the server existed to serve it. |
| Audiobookshelf | Yes (Capacitor/Vue, separate repo) | Mobile repo created **2021-09-02**, 16 days after the server's first commit and 2 days *before* the server's v1.0.0 GitHub release. App Store submission activity visible by **2022-01-06** (`7273202` "Remove android auto reference for apple app store approval"). |
| Karakeep | Yes (React Native/Expo) | Merged into the monorepo `2b72040` 2024-03-11; announced in **v0.7.0 2024-03-21** — "A new mobile app got introduced" — **+29 days** after v0.1.0. |
| Romm | Yes, eventually (`rommapp/argosy-launcher`, Android) | Repo created **2025-12-06**, ~2 years 8 months after v1.0. Notably an **unofficial** community app (mattsays/romm-android) shipped ~5 months earlier and was credited in Romm's own v4.0.0 notes (2025-07-20). |
| Komga | **No** | 6 years, none. |
| Kavita | **No** | ~5 years, none; official wiki page lists four community apps instead. |
| Navidrome | **No, by design** | ~10 years, none; ships a client-apps *directory*. |
| Stash | **No** | 7 years, none; responsive web UI + PWA only. |
| Calibre-Web | **No** | 11 years, none. |

**What the evidence actually shows:**

1. **The split is not early-vs-late, it is necessary-vs-not.** Immich is a phone-backup product: without a phone client there is no product at all, which is why the app predates the server's public history and the first tag is named after an Android release. Audiobookshelf and Karakeep are consume-on-the-move products where offline sync *is* the feature. The five projects with no app are all "sit at a screen and browse a library" products where the web UI suffices.
2. **The five with no official app are not disadvantaged — three of them bought a mobile ecosystem with a protocol instead.** Navidrome was being debugged against the third-party Android client DSub on **2016-02-29, six days after its first commit** (`f760f892`), four years before it had a web UI. Komga had Tachiyomi working **one day after v0.1.0** (`7ca2880` 2019-08-28) and shipped OPDS at +27 days. Calibre-Web inherited OPDS on day 0. Kavita shipped OPDS at +223 days and Tachiyomi sync at +324. **Implementing an existing client protocol is the highest-leverage mobile decision in this dataset and costs a fraction of an app.**
3. **Nobody who built an app early said they regretted it — and nobody said they didn't.** No maintainer retrospective on this exists for any of these projects; I looked and did not find one. **State that as thin evidence, not as a conclusion.**
4. **What is documented is the recurring cost.** Immich rewrote its mobile data layer and sync protocol in **v1.136.0, 2025-07-24** (new on-device DB, streaming JSON-Lines "Sync v2"), roughly 3.5 years in, and users immediately reported endless re-sync and duplicates (discussions #20133, #22996). Building the client early did not avoid the rewrite; it relocated it.
5. **Romm is the cleanest natural experiment.** It waited 2 years 8 months for an official app — and in the meantime the community built one. Waiting cost it nothing and gained it a free client.


---

## 8. For a solo developer — what the evidence says about sequencing

**Caveat first: there are no maintainer retrospectives.** I searched specifically for "what I learned building X" style posts from gotson (Komga), advplyr (Audiobookshelf), majora2007 (Kavita) and deluan (Navidrome) and found none. The usable first-person evidence is release notes and commit messages, which turn out to be unusually candid in this genre. Everything below is drawn from those.

### 8.1 Ship a tagged release fast; the discovery clock starts there
`awesome-selfhosted` will not list you until your **first release is 4 months old**, and the count "initiates only after a release has been created" (CONTRIBUTING.md, verbatim). Median first-commit-to-first-release across the projects that intended to release: **4–39 days**. Nobody waited to be good.

### 8.2 Everybody rewrote the data layer. The only project that didn't is the one that didn't design one.

| Project | Data-layer rewrites |
|---|---|
| Navidrome | tiedot → LedisDB (day 5!) → SQLite (2020-01, ~4 years). Transcoding engine rewritten "third (fourth?) time" (`f394de66` 2020-02-24). Scanner + schema "BFR" rewrite PR #2709 merged 2025-02-20, shipped v0.55.0 2025-03-09 with "Breaking Changes … Artist favourites and artist ratings will be lost after the upgrade" and a mandatory full rescan. |
| Komga | Hibernate/JPA → jOOQ (v0.31.0, 2020-06-01); H2 → SQLite (v0.48.0, 2020-07-16), followed by `f84ba17` "fix: fix database migration errors". Both inside year one. |
| Kavita | "a complete rewrite to the DB structure and Scanning code" in **v0.2, 26 days after v0.1**; a second scanner rewrite PR #55 three weeks later; a 3-month scan-loop rewrite in v0.5.6 (2022-09-02); a 48K-line "foundation" rewrite in v0.8.0 (2024-04-12); a "CBL v2 (new schema)" in v0.8.2. |
| Audiobookshelf | njodb JSON files → SQLite/Sequelize. **First attempt abandoned** (branch `sqlite`, 2023-03-08 → stalled 2023-03-22); second attempt literally committed as "Init sqlite take 2" (2023-07-04), shipped v2.3.0 2023-07-15, citing three data-corruption/file-locking bugs (#1712, #1326, #1419). Sequelize perf fixes for months after. |
| Romm | raw SQL → SQLAlchemy (day 14) → Alembic (v1.0+13d) → declarative-models rewrite (PR #954, 2024-06-25); SQLite support dropped in 3.0.0. Front end rewritten to TypeScript (PR #565). |
| Stash | Two entire prior codebases abandoned before the current one (Swift `StashOSX`, Rails `StashServer`, both archived); Angular → React **six days** into the current repo; "File storage rewrite" PR #2676 → v0.17.0 with "a migration that significantly changes the way that stash stores information about your files … can take a long time on larger systems", plus real migration failures (#2941, `UNIQUE constraint failed: files.parent_folder_id, files.basename`). |
| Karakeep | REST → tRPC **four days** in; NextAuth → better-auth 18 months in (PR #2057). No engine migration yet. |
| Immich | see Immich section (TypeORM→Kysely, container consolidation, mobile Sync v2). |
| **Calibre-Web** | **None. Zero. In eleven years.** One tag lineage, 0.6.0 → 0.6.27. Because it never designed a book schema — it reads Calibre's `metadata.db` and only owns a small auxiliary `app.db` for users/shelves. |

Two conclusions follow, and they pull in opposite directions:
- **Expect to rewrite the persistence layer. Plan the release process around that, not around avoiding it.** The projects that shipped a thin model in weeks and rewrote it later are the successful ones. Nobody in this set got the data model right first time; several got it wrong twice.
- **Calibre-Web is the one clean escape.** The cost of that escape is total loss of control: when Calibre 5.0 changed `metadata.db`, Calibre-Web crashed outright with `malformed database schema (annotations_fts_stemmed_config)` (issue #1633, 2020-09-25). Borrowing a schema buys you eleven years without a migration and hands your roadmap to someone else.

### 8.3 Multi-user is not the early requirement it looks like

| Project | Multi-user accounts |
|---|---|
| Kavita | In **v0.1 itself** (roles + per-library access) |
| Karakeep | Day 1 (NextAuth); the thing added *later* was an option to **disable** signups (`95fc3a0`, 2024-03-22) |
| Calibre-Web | Day 0 (inherited in the fork) |
| Audiobookshelf | Pre-v1.0 (`23f343f` "Adding and deleting users", 2021-08-27) |
| Navidrome | ~10 days *after* first tag (`6978790e` 2020-02-05 "allow regular users to login to the UI") |
| Komga | **+56 days** after v0.1.0 (v0.7.0, 2019-10-22) — and it shipped as a breaking change replacing hardcoded `admin`/`user` accounts |
| Romm | **+213 days** (v2.0.0, 2023-10-27), as a headline breaking feature |
| Stash | **Never.** Issue #3119 "Multiple accounts and users" closed `not_planned` the day it was opened (2022-11-11); #2337 open since 2022-02-21 with 27 comments and no resolution. Stash has ~13k stars without it. |

Komga's v0.7.0 note is the cheapest lesson available here: it shipped with two hardcoded accounts and deprecated them 8 weeks later. That cost one breaking-change line in a release note.

### 8.4 The candid maintainer quotes (all from release notes, all dated)
- Kavita v0.5.6, 2022-09-02: *"For the past 3 months, I have been working tirelessly to rebuild our main scan loop… The reasoning for this drastic shift is that the old method failed to scale on users with massive libraries… **I quit 3 times, but finally made it through.**"*
- Kavita v0.8.0, 2024-04-12: *"Some features were added with limited knowledge, like comics, and that lack of knowledge in the beginning became a problem for heavy comic collectors. In order to build towards my vision of being the best, I had to rewrite large portions of how Kavita functions…"*
- Kavita v0.8.4: *"After rewriting 50K lines of code last release, I decided it was best to take a break and focus on the bugs that resulted."*
- Kavita v0.1, 2021-01-20: *"This release is more of a milestone than a proper release… While a lot was accomplished, a lot of the work is preliminary."*
- Navidrome BFR PR #2709: *"⚠️ If you want to try it, be sure to backup your DB first! ⚠️"*
- Immich blog, 2024-05-01: *"Over the past two years, it has taken significant dedication, time, and effort."*

### 8.5 What actually kills these projects — honestly
**The dataset cannot answer this, because all ten survived.** What is documented nearby:
- **Abandoned forks of large legacy codebases**: airsonic (archived, last push 2021-08-11), airsonic-advanced (dormant since 2024-04-24), Booksonic-Air (last push 2023-03-31, README warns its code "might not be ready for release"). Navidrome and Audiobookshelf, both greenfield, took those niches.
- **A single maintainer walking away**: BookLore, deleted outright in March 2026 (repo, Discord, website, TrueNAS catalogue entry, same day), forked by contributors as Grimmory. One case, no data behind it.
- **Funding as a survival milestone**: Immich's core team went full-time via FUTO on 2024-05-01, ~2 years in.
- Background survey data (Socket): ~60% of maintainers unpaid, ~60% have considered quitting, 61% of unpaid maintainers work alone. Not specific to this genre.

**No evidence found that build order kills projects.** The failure modes on record are abandonment and inherited complexity, not sequencing mistakes.


---

## Immich

Source: `immich-app/immich` on GitHub (originally `alextran1502/immich`, later transferred to
the `immich-app` org). Researched via `gh api` (commits, tags, releases, search) and a local
partial clone (`git log`/`git show` for path-history forensics). All claims below are dated and
sourced; "evidence thin" is flagged where the public record runs out.

### 1. First release

- First commit: `af2efbd` "Initial commit" (LICENSE file only), 2022-02-03T15:56:28Z.
  https://github.com/immich-app/immich/commit/af2efbdbbddc27cd06142f22253ccbbbbeec1f55
- Effectively the real first commit: `568cc24` "Transfer repository from Gitlab",
  2022-02-03T16:06:44Z — same day, 10 minutes later. This single commit already contains a
  working Flutter mobile app skeleton (`mobile/`) **and** a NestJS + TypeORM + Postgres server
  (`server/`) with `asset`, `user`, `auth`, `device-info` modules and an
  `image-optimize`/`machine-learning` processor already wired up. This means the public GitHub
  history does not start from zero — it starts from a snapshot of prior private GitLab work.
  https://github.com/immich-app/immich/commit/568cc243f0ad03a1928e6643ae21ecc5793c65b7
- First **tag**: `first-android-release`, a lightweight tag with no release notes, pointing at
  commit `e2904a0` (2022-02-06T19:06:01Z, "Update readme, remove apk file in repo") — 3 days after
  the initial commit. No GitHub Release object exists for it (404 on
  `releases/tags/first-android-release`).
- First tag **with published release notes**: `v0.2-dev`, published 2022-02-08T20:24:47Z — **5
  days** after the first commit (2022-02-03 → 2022-02-08). Verbatim body:

  > ## Features
  > * Auto Backup
  > * Group Selection
  > * Multiple Selection
  > * Video Player
  >
  > ## What's Changed
  > * Automated multi-platform build and DockerHub publication by @schklom in .../pull/8
  > * Implemented reload when pop back from backup controller page by @alextran1502 in .../pull/9
  > * Implemented auto backup by @alextran1502 in .../pull/11
  > * Implemented multi-select interaction by @alextran1502 in .../pull/13
  >
  > **Full Changelog**: compare/first-android-release...v0.2-dev

  Source: `gh api repos/immich-app/immich/releases/tags/v0.2-dev`. Note the release is an **APK**
  (`app-release.apk` asset) — a mobile app release, not a server release. Every feature listed is
  a mobile-app feature (backup, multi-select, video player). There is no server-side changelog
  entry in this first release at all, even though the server code already existed in the repo.

### 2. Build order (first ~120 commits, 2022-02-03 to 2022-03-30)

Chronology (dated, from `git log`/commit search, oldest first):

| Date | SHA | What |
|---|---|---|
| 2022-02-03 | `568cc24` | Repo transfer from private GitLab: `mobile/` (Flutter, Android+iOS scaffolding) AND `server/` (NestJS 8, `@nestjs/typeorm` 0.2.41, `pg` 8.7.1) arrive **together**, in one commit. |
| 2022-02-03 | `85b83f9` | "Added successfully built docker-compose and dockerFile" |
| 2022-02-04 | `56c92cd`,`0d8fddf` | Google-Photos-style scroll bar (mobile UI) |
| 2022-02-05 | `b6a7d40` | Added fluent-ffmpeg (server, video transcoding groundwork) |
| 2022-02-06 | `97dc766` | Video upload and player (PR #2) |
| 2022-02-08 | `919928a` | Auto backup (PR #11) |
| 2022-02-08 | `328f382` | Multi-select (PR #13) |
| 2022-02-10 | `38c968d` | HEIC/HEIF support (PR #16) |
| 2022-02-11 | `de1dbce` | EXIF store and display (PR #19) |
| 2022-02-13 | `897d49f` | Delete asset on device + database (PR #22) |
| 2022-02-14 | `c234c95` | WebSocket upload notification (PR #25) |
| 2022-02-20 | `619735f` | Image tagging via TensorFlow InceptionV3 — **first ML feature** (PR #28) |
| 2022-02-21 | `f181dba` | Refactor Python ML modules (PR #29) |
| 2022-03-02 | `5990a28` | Search results page (PR #37) |
| 2022-03-10 | `026f3c2` | Reverse geocoding + map view (PR #43) |
| 2022-03-25 | `fe693db` | "Added nestjs microservice" (splitting a microservices process out of the monolith) |
| 2022-03-27 | `dd9c524` | Machine-learning microservice + object detection (PR #76) |
| 2022-05-21 | `a779c38` | **First commit touching `web/`** — "Add web interface with admin functionality" (PR #167) |

Key findings:

- **Schema arrived non-trivial, not incrementally grown from an empty model.** At the very first
  visible commit, `server/src/api-v1/asset/entities/asset.entity.ts` already defines a full
  `AssetEntity` (uuid PK, `deviceAssetId`/`userId`/`deviceId` composite-unique, type enum
  IMAGE/VIDEO/AUDIO/OTHER, `originalPath`/`resizePath`, `isFavorite`, lat/lon, mimeType) and
  `UserEntity` (uuid, email, password, salt — single-tenant, no `isAdmin` field yet). TypeORM +
  Postgres was the schema choice from day one; it did not start on SQLite or a document store.
  Confirmed via `git show 568cc243:server/src/api-v1/asset/entities/asset.entity.ts`.
- **Mobile app and server were built together, not server-first.** Both `mobile/` and `server/`
  land in the same single commit. Since this is a squashed transfer from a private GitLab
  history, the *public* commit graph cannot show which was written first inside that private
  repo — but the ordering of the visible feature work (auto backup, multi-select, HEIC, EXIF —
  all mobile client concerns) for the first ~3 weeks confirms the project's public-facing energy
  was mobile-first. Evidence thin on the true pre-GitHub build order (private GitLab history is
  not accessible).
- **Web UI came 3.5 months after the first commit and ~3 months after the first release.** First
  commit touching `web/` is 2022-05-21 (PR #167, "Add web interface with admin functionality") —
  107 days after the 2022-02-03 initial commit, and 102 days after the first `v0.2-dev` release
  on 2022-02-08. Before this, the *only* client was the Flutter mobile app; there was no
  browser-based way to use Immich for over three months of public history.
- **ML/object-recognition arrived very early relative to web**, not last: TensorFlow image
  tagging landed 2022-02-20 (PR #28), a full three months before the web UI existed at all.
- Order overall: **mobile app + Postgres/TypeORM server schema (simultaneous, day 1) → transcoding
  groundwork (day 2) → ML tagging (day 17) → ML as its own microservice (day 52) → web UI (day
  107)**.

### 3. Timing relative to first release (2022-02-08, v0.2-dev)

All "+N days" figures below are measured from the 2022-02-03 initial commit unless stated.

- **Docker Compose distribution: day 0.** `docker-compose` + Dockerfile landed in commit
  `85b83f9` "Added successfully built docker-compose and dockerFile", same day as the initial
  commit (2022-02-03). Immich was containerized before it had a single tagged release.
- **Mobile app store listings.**
  - iOS App Store: link/QR code added to README 2022-03-12 (commit `424845d9`, "Update readme
    with appstore and sponsorship info") — **+37 days** from first commit, **+32 days** from
    v0.2-dev. App id `1613945652`.
    https://github.com/immich-app/immich/commit/424845d9246b3cf7e73fe2ac7fdb9c6e1e15a82b
  - Google Play Store: link added to README 2022-04-05 (commit `0eb548f1`) — **+62 days**,
    with the caveat "*The App version might be lagging behind the latest release due to the
    review process*". https://github.com/immich-app/immich/commit/0eb548f115c4e6818e160b4850e99ea244b6d7b3
  - The Flutter mobile app itself was already functional and building APKs from the very first
    commit (2022-02-03); store listings followed 5-9 weeks later once the app was polished
    enough to pass review.
- **Multi-user accounts: +107 days.** Landed in the same PR that added the web UI, #167 "Add
  web interface with admin functionality", merged 2022-05-21. Before this, `UserEntity` had no
  `isAdmin` column — Immich was architecturally single-user for its first ~3.5 months.
  https://github.com/immich-app/immich/pull/167
- **Video transcoding (ffmpeg) for web playback: +121 days.** `fluent-ffmpeg` dependency was
  added on day 2 (`b6a7d40`, 2022-02-05) for the mobile video player, but the first real
  transcode-on-upload job for browser playback is PR #200 "20 video conversion for web view",
  merged 2022-06-04 — addressing bug #20 ("Raw MOV file cannot be played... Need to transcode",
  filed 2022-02-11, 8 days after first commit). https://github.com/immich-app/immich/pull/200
- **Documented API for third parties (OpenAPI spec): +154 days.** PR #320 "Add OpenAPI Specs and
  Response DTOs" merged 2022-07-07T02:26Z. Web (#326) and mobile (#336) were then refactored to
  consume the generated SDK within the following week — i.e. even Immich's own first-party
  clients moved onto the documented API almost immediately.
  https://github.com/immich-app/immich/pull/320
- **Official public demo (demo.immich.app): evidence thin, bracketed to Jul-Nov 2022.** PR #329
  "Add message to login screen (useful for demo instances)" merged 2022-07-10 shows a demo
  concept already existed informally by then. Issue #720 "[Feature]: Web Demo" was filed
  2022-09-19 requesting an *official* one. Wayback Machine's earliest available capture of
  `demo.immich.app` is 2022-11-12 (HTTP 200). So the official subdomain went live sometime in
  the ~8-week window between the feature request (Sep 19) and that first crawl (Nov 12) — call
  it **+220 to +282 days** from first commit. Exact launch-day evidence not found.
- **CLIP free-text search ("smart search"): +408 days.** Feature request issue #1269 filed
  2023-01-08; PR #1939 "feat(server): CLIP search integration" merged 2023-03-18.
  https://github.com/immich-app/immich/pull/1939
- **Facial recognition: +468 days.** PR #2180 "feat: facial recognition" merged 2023-05-17,
  followed by mobile-side work through PR #2507 (2023-05-21).
  https://github.com/immich-app/immich/pull/2180
- Ordering: **Docker Compose (day 0) → mobile app functional (day 0, private-history dependent)
  → iOS listing (day 37) → Play Store listing (day 62) → multi-user + web UI (day 107) →
  transcoding-for-web (day 121) → OpenAPI spec (day 154) → public demo (~day 220-282) → CLIP
  search (day 408) → facial recognition (day 468).** ML tagging (TensorFlow, day 17) predates
  all of these except Docker Compose and the mobile app itself — see section 2.

### 4. Regrets / rewrites

- **The "NOT READY FOR PRODUCTION" warning: added day 3, removed day 275 (9 months).**
  Introduced in commit `07fdf510` (2022-02-06): *"**!! NOT READY FOR PRODUCTION! DO NOT USE TO
  STORE YOUR ASSETS !!** This project is under heavy development..."* Removed from README in PR
  #927 "chore: Update repo readme", merged 2022-11-04.
  https://github.com/immich-app/immich/commit/07fdf510694586d4868a3454be4bfdb9bb8496fb ·
  https://github.com/immich-app/immich/pull/927
  — But removing the *text* did not mean the project considered itself production-ready: see
  below, it took **another 3 years** to formally call a release "stable".
- **Maintainer's own stability estimate, missed by ~3 years.** Issue #652 ("very rough estimate
  for when this app will be 'stable'"), filed 2022-09-09. Maintainer @alextran1502 replied
  2022-09-11: *"With the current pace of development, I think the first stable release **might**
  be sometimes during Q1 2023."* The actual first release formally called stable was **v2.0.0,
  published 2025-10-01** — roughly **3 years and 3 quarters** later than his own estimate.
  https://github.com/immich-app/immich/issues/652#issuecomment-1243258347
- **v2.0.0 (2025-10-01) — "the first stable version of Immich".** Release notes state this
  explicitly and link an announcement blog post
  (https://github.com/immich-app/immich/discussions/22546) explaining what "stable" means and
  Immich's future plans. Prior to this, versioning stayed on `v1.x` for 3 years 8 months (from
  `v0.2-dev` in Feb 2022 through `v1.144.1`); there was no `v1.0.0` in the conventional sense —
  the project jumped straight from `v1.144.1` to `v2.0.0`.
  https://github.com/immich-app/immich/releases/tag/v2.0.0
- **`immich_microservices` container removed: 2024-05-17, PR #9551 "feat: microservices be
  gone".** The separate microservices container had existed since commit `fe693db`/PR #76 in
  March 2022 (added specifically because "we couldn't run background tasks within the main
  server as that would introduce contention for the API itself" — direct quote from the PR
  body). It was folded into a single-container "workers" model (`IMMICH_WORKERS_INCLUDE` /
  `IMMICH_WORKERS_EXCLUDE` env vars, an `api` worker + a `microservices` worker in the same
  process/container by default), first validated in the v1.105.0 release (2024-05-14) and
  shipped in v1.106.x (first release 2024-06-11). This is a straight reversal of the original
  "split it into microservices" architecture decision, 26 months after it was made.
  https://github.com/immich-app/immich/pull/9551
- **TypeORM → Kysely migration: ~11 months of piecemeal rewrite, Sep 2024 - Sep 2025.**
  - TypeORM (`^0.2.41`, with `@nestjs/typeorm`) was the schema layer from the very first commit
    (2022-02-03) and had several *earlier* breaking-change episodes of its own, e.g. PR #1782
    "infra(server)!: fix typeorm asset entity relations" (2023-02-18, marked breaking with `!`).
  - PR #12857 "refactor(server): use kysely" merged 2024-09-23 — Kysely introduced alongside
    TypeORM.
  - A cascade of ~12 "migrate X repository to kysely" PRs landed in a five-day span,
    2025-01-09 to 2025-01-14 (activity, api-keys, system-metadata, trash, person,
    version-history, sessions, audit, library, shared-link, user, memory, move repositories).
  - PR #20366 "feat!: remove typeorm" merged 2025-07-29, with an explicit `CAUTION` banner:
    *"This update requires applications to have started up at least once on `1.132.0+`."*
  - PR #21754 "chore: remove typeorm dependency" merged 2025-09-10 — final removal from
    `package.json`.
  - **The "database is not compatible" reset this produced:** users who skipped the required
    v1.132.0+ stepping-stone and jumped straight to v1.136+ hit `Invalid upgrade path` (see
    `https://immich.app/errors#typeorm-upgrade`) followed by a second error, `multiple primary
    keys for table "geodata_places" are not allowed`, if they misread the advice and upgraded to
    v1.136 anyway. Documented and admitted directly in PR #22033 "chore(docs): TypeORM error:
    force recommend v1.132.3 and avoid v1.136" (merged 2025-09-16), which cites real user
    breakage reports from 2025-09-08, 2025-09-14 and 2025-09-15.
    https://github.com/immich-app/immich/pull/20366 ·
    https://github.com/immich-app/immich/pull/22033
- **Vector-search Postgres extension churn: three different extensions in three years.**
  1. `pgvector` (implicit/default in early Postgres image).
  2. → **pgvecto.rs**, PR #3605 "feat: use pgvecto.rs", merged 2023-08-08 (required swapping the
     Postgres Docker image to a `tensorchord/pgvecto-rs` fork). Later needed its own breaking
     migration, PR #6785 "feat(server)!: pgvecto.rs 0.2 and pgvector compatibility" (2024-01-31).
  3. → **VectorChord**, PR #18042 "feat: vectorchord", merged 2025-05-02 — pgvecto.rs is
     unmaintained upstream, so Immich migrated again.
  4. **v3.0.0 (2026-07-02) drops pgvecto.rs support entirely.** Release notes warn: *"`v3.0.0`
     drops support for pgvecto.rs. If you run Immich before `v1.133.0` and haven't done the
     migration step yet, see the migration guide"* (docs: migrating-to-vectorchord).
     https://github.com/immich-app/immich/pull/3605 ·
     https://github.com/immich-app/immich/pull/18042 ·
     https://github.com/immich-app/immich/releases/tag/v3.0.0
- **`immich-machine-learning` model-runtime rewrite.** PR #3809 "feat(ml)!: switch image
  classification and CLIP models to ONNX", merged 2023-08-21 (breaking-change marker `!`) —
  moved off the original TensorFlow-based pipeline (present since day 17, PR #28) onto ONNX
  Runtime.
- **Versioning after "stable" kept moving fast, not slowing down.** Post-v2.0.0 (Oct 2025), the
  project shipped v2.1-v2.7 through April 2026, then a `v3.0.0-rc.*` prerelease cycle (first ever
  use of release candidates, per the v3.0.0 notes) from mid-June 2026, reaching v3.0.0 on
  2026-07-02 and v3.2.0-rc.3 by 2026-09-04 (the latest data available as of this research). "Stable"
  did not mean "slower-moving" for this project — v3.0.0 itself shipped with an explicit
  breaking-changes migration guide (`immich.app/blog/v3-migration`).

**Summary of the regrets pattern:** almost every major subsystem present at Immich's public
launch — the Postgres access layer (TypeORM), the vector-search extension (pgvector-family), the
service topology (separate microservices container), and the ML runtime (TensorFlow) — was
later replaced wholesale, each replacement taking many months and at least one documented,
user-visible breakage. The one exception is the original choice of Postgres itself and the
core `assets`/`users` entity split, both of which survived from the 2022-02-03 transfer commit
through to the "stable" v2.0.0 in 2025 and the current v3.x line.


---

## 5 (analysis). The common shape of the first six months

Laying the timelines side by side, measured in days from **first commit**:

| | Komga | Kavita | Audiobookshelf | Immich | Karakeep | Romm | Stash |
|---|---:|---:|---:|---:|---:|---:|---:|
| Docker present | 14 | 158 | **0** | **0** | 2 | 19 | 74 |
| First tag | 19 | 39 | **4** | **3** | 16 | 19 | 1 (floating) |
| Scanner working | ~2 | ~17 | **0** | **0** | 2 | **0** | **0** |
| Web UI | 57 | ~0 (parallel) | **0** | **107** | ~3 | **0** | **0** (Angular), 6 (React) |
| Multi-user | 75 | 39 (in v0.1) | ~10 | **107** | ~1 | 233 | never |
| Metadata providers | ~150 | ~900 | 72 (Google Books) | 17 (ML tags) | **3** (AI tags) | **0** (IGDB) | ~280 (generic scrapers) |
| Third-party API | 34 (OPDS) | 223 (OPDS) | 1,031 (OpenAPI) | 154 (OpenAPI) | 260 (OpenAPI) | ~800+ | **0** (GraphQL) |
| Official demo | 210 | 196 | none (community) | ~220-282 | ~unknown, exists | exists, date unknown | none |
| First major rewrite | 298 (Hibernate→jOOQ) | 65 (DB + scanner) | 568 (SQLite attempt 1, abandoned) | ~960 (microservices reversal) | 6 (REST→tRPC) | 14 (raw SQL→ORM) | 6 (Angular→React) |

### What is common

1. **Docker is decided almost immediately, and often before the first tag.** Four of seven had it inside 20 days; two had it in the initial commit. Distribution is not a later concern in this genre — it *is* the install story.
2. **The first tag lands in 3–39 days, and it is embarrassing.** One-line notes, empty notes, "more of a milestone than a proper release", "we added CI to build binaries", a bare APK. Every single one of them shipped before it was good.
3. **The scanner is the first real feature, and it is narrow.** Komga started with `FileSystemScanner.kt` in commit #2 and supported exactly `cbz` and `cbr`. Kavita built a filename parser as a standalone unit-tested component (`8c80ed0`, 2020-12-27) *before* wiring it into scanning. Nobody built a general ingestion framework.
4. **The data model is grown, and its inadequacy is anticipated in writing.** Komga: `ebad597` "rename book metadata to media, **to avoid confusion later on when proper metadata is added**". Kavita: `380c3e7` "**Rough** version of Saving Series, Volumes, and MangaFiles to the DB". Karakeep: `08a5694` "[refactor] Extract the bookmark model to be a high level model to support other type of bookmarks", five days after the model existed. The pattern is a two-or-three-entity model that names the domain and defers everything else.
5. **The web UI is not sacred.** Komga shipped 38 days *after* its first release without one. Immich went 107 days. Navidrome went four years. Where the UI is in commit 1 it is scaffolding (create-react-app, Nuxt, Angular), and in Stash's case it was thrown away within six days.
6. **The first serious rewrite arrives inside months 1–12, and it is almost always persistence or scanning.** Kavita's was at day 65; Romm's at day 14; Karakeep's at day 6; Komga's at day 298; Audiobookshelf's first attempt at day 568 (and failed). Plan for it.
7. **Everything that looks like "table stakes" is late.** Documented third-party API: 154–1,031 days, except where the API *is* the architecture (Stash GraphQL day 0, Navidrome Subsonic day 0, OPDS at 34/223 days). Official public demo: 196–282 days, or never. Official mobile app: never, for five of ten.

### What is not common (and therefore not required)
- A finished data model. Nobody had one.
- A web UI at launch. Three shipped without one.
- Multi-user at launch. Komga, Romm, Immich and Navidrome all added it later; Stash refused.
- Metadata providers at launch. Late everywhere except where metadata *is* the product (Romm/IGDB, Karakeep/AI).
- A demo. Never at launch, in any of the ten.
- A mobile app. Never, in five of ten.


---

## Suwayomi

Repo: `Suwayomi/Suwayomi-Server` (originally `AriaMoradi/Tachidesk`, then `Tachidesk-Server`). All dates from `gh api repos/Suwayomi/Suwayomi-Server/...` (commits, tags, releases, issues, PRs) and the current README, retrieved 2026-09-05.

### 1. First release

- **First commit**: `960ffd2`, 2020-12-23T14:22:05Z, "initial commit, eu.kanade.tachiyomi.srource packge build works" (Aria Moradi). 1,661 lines added, and almost all of them are **Tachiyomi's own source code, copied in verbatim** under Tachiyomi's own Java package name: `app/src/main/kotlin/eu/kanade/tachiyomi/source/{CatalogueSource,Source,SourceFactory,SourceManager}.kt`, `.../source/model/{SManga,SChapter,MangasPage,Page,Filter,FilterList}.kt`, `.../source/online/{HttpSource,ParsedHttpSource,HttpSourceFetcher}.kt`, plus Tachiyomi's `network/` helpers. The only new file the author wrote was a single entry point, `ir/armor/tachidesk/Main.kt` (the project's original package name, before the later `org.suwayomi` rename).
  https://github.com/Suwayomi/Suwayomi-Server/commit/960ffd2
- **First tagged release**: `v0.0.1`, published 2021-01-19T23:49:52Z. Release body, verbatim: "All the things that are a must are implemented."
  https://github.com/Suwayomi/Suwayomi-Server/releases/tag/v0.0.1
- **Gap**: ~27.4 days.

### 2. Build order / metadata-provider reuse vs. own schema

Suwayomi splits cleanly into two different provenance stories, and they should not be conflated:

- **The metadata-provider layer (Tachiyomi's "sources"/extensions) was reused wholesale from commit 1**, down to the literal source code and Android APK packaging — not merely a compatible protocol.
  - `960ffd2` (day 0): Tachiyomi's `Source`/`HttpSource`/`ParsedHttpSource` interfaces copied in unmodified (see above).
  - `ded9cc9` (day 0, +30 min): "add Extension stuff."
  - `40305d8`/`42c56f1` (day 0, evening): "dex extractor" / "dex2jar" — tooling to unpack Tachiyomi's compiled Android `.apk` extensions and convert their Dalvik bytecode (`.dex`) to JVM-runnable `.jar`s, so a desktop/server JVM (not an Android device) can execute Tachiyomi's existing extension binaries directly.
  - `f16bead`/`5ddc087` (day 0, night): "apk installation" / "installation done" — the extension *installation* mechanism operates on real Tachiyomi extension `.apk` files.
  - `1e46a0c`, 2021-01-02: "android support! thanks to TachiWeb devs." — explicit credit to a prior, related project (TachiWeb) for groundwork.
  - Current README (retrieved 2026-09-05) states this plainly:
    > "A free and open source manga reader server that runs extensions built for [Mihon (Tachiyomi)](https://mihon.app/)."
    > "Suwayomi is an independent Mihon (Tachiyomi) compatible software and is **not a Fork of** Mihon (Tachiyomi)."
    > "- Installing and executing Mihon (Tachiyomi)'s Extensions, So you'll get the same sources"
    > "- Backup and restore support powered by Mihon (Tachiyomi)-compatible Backups"
    > "Parts of [Mihon (Tachiyomi)](https://github.com/mihonapp/mihon) is adopted into this codebase, also licensed under `Apache License Version 2.0`..."
    https://github.com/Suwayomi/Suwayomi-Server/blob/master/README.md
  - (Tachiyomi itself was later renamed/succeeded by a fork called "Mihon" in the wider community — the README's parenthetical naming reflects that, not a Suwayomi-side rename.)
  - This reuse was later named explicitly as deliberate project strategy, in issue #534 (2023-04-05, see §4): "...the only common ground we really have with Tachiyomi is support for its Extensions and backups."

- **The library schema itself (Manga/Chapter/Source tables) was designed and built by the Suwayomi team from scratch** — it is not borrowed from Tachiyomi (Tachiyomi's own schema lived inside an Android app's local SQLite/Storio store and wasn't reusable server-side):
  - `bb94e63`, 2020-12-25T09:30:18Z, "refactor database classes" — first dedicated DB commit: `database/table/{ExtensionTable,SourcesTable}.kt`, `entity/{ExtensionEntity,SourceEntity}.kt`, `dataclass/{ExtensionDataClass,SourceDataClass}.kt`.
  - `ab33a0e`, 2020-12-25T13:46:26Z, "Manga database classes, api url change, fix source id" — adds `MangasTable.kt`, `MangaEntity.kt`, `MangaDataClass.kt`, plus `util/APK.kt` (APK-based extension loading) and `util/{MangaList,SourceList}.kt`.
  - `590be4f`, 2021-01-19T12:32:23Z, "rename tables" — schema still being reshaped the same day the first release shipped.
  - This is Suwayomi's own schema and it kept changing: see §4 for the later "redo the database structure" rework plan.

- **Frontend**: the team first tried reusing an existing project, then abandoned it same day: `ae5e8fd` "add TachiWeb-React" → `1f5351e` "remove TachiWeb-React from root" → `94f6a53` "removed submodule" → `c71cf58` "ditching TachiWeb-React and starting anew," all within ~2020-12-23T22:06–22:59Z. A fresh React frontend (later ported to TypeScript same day by a second contributor, `efbb2a8`, "Port to typescript") was built afterward.

- **Stack** (from file listing at first commit and subsequent days): Kotlin/JVM backend (Gradle, `app/build.gradle.kts`), reusing Tachiyomi's OkHttp/Jsoup-based extension interfaces; React (soon TypeScript) web frontend; Exposed (JetBrains Kotlin SQL library) for the ORM, per the org's later `exposed-migrations` repo (created 2021-08-05).

- **Order overall**: metadata-provider/extension reuse (commit 1, hours) → APK/dex loading tooling (commit 1, same day) → own web UI (started, abandoned a reused one, restarted, day 0) → own DB schema (Extension/Source tables day 2, Manga tables day 2) → API endpoints (sources API `7baca45` day 2; popular manga API `c9c96e7` day 2) → chapters/pages (2021-01-19, the day of first release).

### 3. Feature timing relative to first release (v0.0.1, 2021-01-19)

| Feature | First evidence | Relative to v0.0.1 |
|---|---|---|
| Tachiyomi extension reuse | `960ffd2`, 2020-12-23 | Before release — foundational, not added later |
| Docker image | `Suwayomi-Server-docker` org repo created 2021-06-05 | ~4.5 months after v0.0.1 |
| Compose-Multiplatform client (Suwayomi-JUI) | `Suwayomi-JUI` org repo created 2021-03-23, "A Suwayomi-Server client built in Compose Multiplatform" | ~2 months after v0.0.1 |
| Dedicated mobile manga-reader client (Tachidesk-Sorayomi, later folded into "Suwayomi-Tsumiru") | `Tachidesk-Sorayomi` org repo created 2022-01-16, "A free and open source manga reader app to read manga from a Tachidesk-Server instance"; superseded by `Suwayomi-Tsumiru` (created 2026-06-19), "enhanced fork of Tachidesk-Sorayomi, with a rebuilt reader and offline download support" | ~1 year after v0.0.1 (Sorayomi); ~5.4 years after (Tsumiru) |
| Multi-user accounts | **Still not shipped as of 2026-09-05.** Feature request issue #298 ("Add Users Accounts on web login") opened 2022-02-22, still open. PR #623 ("User Accounts") opened 2023-07-29, still open/unmerged. Multi-user was explicitly scoped into the "1.x rework" plan (issue #534, 2023-04-05: "Support for multi-user") but has not landed even in the current v2.x line. | Requested ~13 months after v0.0.1; still absent almost 5.5 years after v0.0.1 |
| REST API | Present from the early build (implicit in the FastAPI-less, Javalin-based Kotlin server; explicitly named as the thing being replaced in issue #534) | Present before/at release |
| Move from REST to GraphQL | Planned in issue #534 (2023-04-05: "Move from REST API to GraphQL, remove Javalin"); implemented in PR #547 "add graphql," opened and merged same day, 2023-05-13; declared complete in the `v1.0.0` release (2024-02-23): "We have redone our whole API in GraphQL... provides much more flexibility than our previous REST API." | ~2 years 4 months after v0.0.1 (proposal); GraphQL landed ~2 years 4 months after v0.0.1; declared "whole API" complete at v1.0.0, ~3 years 1 month after v0.0.1 |
| Rename Tachidesk → Suwayomi | Proposed in issue #534 (2023-04-05: "Drop the name Tachidesk, rebrand as Suwayomi"); executed in PR #795 "Rename to Suwayomi," opened 2023-12-17, **merged 2024-01-05T19:12:35Z**; announced in the `v1.0.0` release notes (2024-02-23): "We've had the rename in the works for a while... We ended up deciding on Suwayomi, which is a shorthand for Suwariyomi (sitting reading)." | Renamed ~3 years after v0.0.1 |
| First major version (v1.0.0) | Published 2024-02-23T18:55:02Z | ~3 years 1 month after v0.0.1 |
| Public demo instance | No evidence found — current README has no "demo" section or link (plausibly avoided given copyrighted manga content) | n/a |
| Official Docker package | README (current): "Check our Official Docker release [Suwayomi Container]" via `Suwayomi/docker-tachidesk` | Present now; first Docker repo 2021-06-05 (see above) |

### 4. Regrets / rewrites / the rename

- **Issue #534**, "[Meta] Tachidesk-Server 1.x," opened 2023-04-05, is an explicit, dated "rework" plan and is the single best primary source for this project's self-assessed regrets:
  > "There are some early design decisions in the app that we can't change or is too complex or too substantial/fundamental to change with smaller incremental patches; Having these changes would call for a 'rework' of the app."
  > "...it's a different solution to different problems and needs, so we should create a new vision as the only common ground we really have with Tachiyomi is support for its Extensions and backups."

  Planned changes explicitly listed: rebrand Tachidesk → Suwayomi; move REST → GraphQL and remove Javalin; add proper authorization/authentication; **support for multi-user**; change ORM away from Exposed; support PostgreSQL instead of H2; rename base package `suwayomi.tachidesk` → `org.suwayomi`.
  https://github.com/Suwayomi/Suwayomi-Server/issues/534
- **Of that plan, GraphQL and the rename shipped** (PR #547, merged 2023-05-13; PR #795, merged 2024-01-05; both declared done in the `v1.0.0` release, 2024-02-23). **Multi-user did not** — PR #623 ("User Accounts," opened 2023-07-29) remains open and unmerged as of 2026-09-05, more than three years later, and the original 2022-02-22 feature-request issue (#298) is likewise still open. This is a concrete, dated example of a named architectural intent that has not been delivered.
- **No evidence of a schema-borrowing constraint** analogous to Calibre-Web's — Suwayomi owns its Manga/Chapter/Source schema outright, so it has been free to redesign it (table renames on day 27 alone: `590be4f`), unlike Calibre-Web which is permanently downstream of an external project's schema decisions.
- **Versioning oddity, not a rewrite**: post-`v1.0.0`, the project moved to embedding a running build number in the "patch" slot (e.g. `v2.0.1727` published 2025-04-21, `v2.3.2243` published 2026-07-13, the latest as of this pass) rather than semver-style patch increments — worth noting only as a documentation-literalism trap, not a breaking change in itself.

---

# What the evidence suggests about build order

A suggested sequence for a solo developer building a self-hosted catalogue, with the evidence behind each step. Day numbers are from first commit.

### Days 0–3 — Containerise, and pick persistence you are willing to throw away
Docker was present in the initial commit for Audiobookshelf (`6930e69`) and Immich (`85b83f9`), day 2 for Karakeep (`b792121`), day 14 for Komga (`733c0ee`). In this genre the container *is* the install instructions. Meanwhile **every project that owned its schema rewrote its persistence layer** — Navidrome twice, Komga twice, Audiobookshelf once after one failed attempt, Romm three times, Immich (TypeORM→Kysely) over eleven months, Stash's whole file model. So choose the boring option and treat it as temporary. SQLite is what Komga, Kavita, Stash, Karakeep and Navidrome all converged on, and two of them converged *from* something else.

### Days 1–20 — Scanner first, two or three entities, read-only HTTP API
Komga's second commit was `FileSystemScanner.kt`; its model was `Serie` and `Book` and nothing more; endpoints appeared on day 12. Kavita built its filename parser as a standalone unit-tested component (`8c80ed0`) before wiring it into scanning, then persisted the result into a model its own commit called "**Rough**" (`380c3e7`). Komga added Flyway on day 11 — *after* the model existed, not before. **Do not model the domain fully.** The commit record shows the successful projects naming two entities and deferring everything else, in writing: Komga's `ebad597` renames "book metadata" to "media" explicitly "to avoid confusion later on when proper metadata is added".

### By day ~30 — Tag `v0.1.0` and publish an image, however embarrassing
Median first-commit-to-first-tag for projects that intended to release: **4–39 days** (Audiobookshelf 4, Immich 3, Karakeep 16, Komga 19, Romm 19, Suwayomi 27, Kavita 39). Komga's entire release note was *"First release, support for `cbr` and `cbz` archives"*. Karakeep's and Audiobookshelf's were **empty**. Suwayomi's was *"All the things that are a must are implemented."* Navidrome's was *"ci: create binaries with goreleaser"*.

The mechanical reason to do this is not vanity: **awesome-selfhosted will not list you until your first release is four months old**, and its own rejection text says the count "initiates only after a release has been created". Every week you delay the tag is a week added to your discovery clock.

### Days 20–60 — Give it a client, and prefer an existing protocol to writing one
This is the single highest-leverage finding in the study. Komga shipped OPDS at day 34 and had Tachiyomi working **one day after v0.1.0**; its web UI came at day 57 and it has never written a mobile app in six years. Navidrome implemented Subsonic from commit 2 and was being debugged against the third-party Android client DSub **six days in**, four years before it had any web UI. Calibre-Web inherited OPDS. Suwayomi went further and ran Tachiyomi's *compiled extension APKs* on a JVM via dex2jar, on day 1.

If a standard client protocol exists in your domain, implement it before you build UI. If one doesn't, a minimal web UI at day 30–60 is normal; three projects shipped their first release with no UI at all.

### Days 40–90 — Multi-user, only if you actually need it
Komga added it at day 75 as a breaking change that deprecated two hardcoded accounts (v0.7.0). Romm added it at day 233 as a breaking v2.0.0 feature. Immich was architecturally single-user for 107 days. **Stash refused it outright** (#3119 closed `not_planned` the day it opened) and has ~13k stars. **Suwayomi still hasn't shipped it** — requested 2022-02-22 (#298), PR #623 open since 2023-07-29, unmerged. Where it *was* free — a framework's auth (Karakeep/NextAuth, Kavita/ASP.NET Identity) — it was there on day one. So: take it if your framework gives it to you, otherwise defer it and accept one breaking-change line later.

### Months 3–6 — Metadata enrichment
Late everywhere except where enrichment *is* the product. Komga's real metadata model: ~5 months. Audiobookshelf's Google Books +54 days, Audible +78. Navidrome's Last.fm +9 months. Calibre-Web's pluggable provider mechanism: **+2 years 3 months**. Kavita's: **+2.5 years** (and paid). The exceptions prove the rule — Romm baked `igdb_id`/`sgdb_id` into its very first dataclass because a ROM library without box art is nothing, and Karakeep shipped OpenAI tagging on day 3 because that was the pitch.

### Month 6+ — Documented public API, demo, mobile
Documented third-party API arrived at +154 days (Immich), +223 (Kavita OPDS), +260 (Karakeep OpenAPI), +648 (Audiobookshelf OpenAPI), ~+1,000 (Stash's docs site) — unless the API was the architecture from day 0 (Stash GraphQL, Navidrome Subsonic). Official demo: +196 to +282 days, or never. Official mobile app: never, for five of ten.

---

## What the evidence does NOT support — read this part

1. **Mobile-first does not generalise.** Immich is the only mobile-first project here and its product is *phone photo backup*: without a phone client there is literally no product, which is why its first tag is named `first-android-release`. Do not read Immich's success as evidence for building an app early. Five of ten never built one, and two of those (Navidrome, Komga) are among the healthiest in the set.
2. **There is no evidence a public demo drives adoption.** Nobody publishes numbers. 70% of the 1,258 projects listed on awesome-selfhosted have no demo link. The only causal artefact in the whole dataset is a user *asking* for one (Immich #720). A demo is also real infrastructure — a separate stack, a seeded dummy library, a reset script, in-app demo-mode code, and in Immich's case an abuse problem that forced uploads off.
3. **"Grow the schema" is what everyone did, but the evidence does not say it was cheap.** Every project that owned a schema paid with at least one rewrite, several with two or three, and several with user-visible data loss (Navidrome v0.55.0: "Artist favourites and artist ratings will be lost after the upgrade"; Stash v0.17.0 migration failures; Kavita v0.7.11 restore-from-backup). The supportable claim is "grow it and budget for the rewrite", **not** "growing it is free".
4. **The one project that never rewrote anything is the one that never designed a schema** — Calibre-Web, eleven years on a single 0.6.x line, because it reads Calibre's `metadata.db`. The price is documented: Calibre 5.0's schema change crashed it outright (#1633). That is a genuine trade-off, but **n = 1**. Do not treat it as a proven pattern.
5. **No evidence that build order causes or prevents project death.** All ten in the sample survived; the sample is survivorship-biased and cannot answer the question. The nearby deaths — airsonic (archived 2021), Booksonic-Air (stalled 2023), BookLore (deleted 2026) — failed from fork-maintenance burden or a maintainer walking away, not from sequencing.
6. **No maintainer retrospectives exist for these projects.** I searched specifically for them and found none from gotson, advplyr, majora2007 or deluan. Anything you read claiming "what the Komga author learned" is not sourced from the author. The candid material is all in release notes and commit messages, quoted above.
7. **Test-first at the scanner seam: suggestive, not proven.** Komga wrote failing rescan tests before the implementation on day 5 (`b83b1d0`), and Kavita unit-tested its filename parser standalone before wiring it in (`8c80ed0`). Both then rewrote their scanners anyway. n = 2 and it did not prevent the rewrite.
8. **"Ship in a month" is a median, not a law.** Navidrome took 1,433 days to its first tag and is the third most-starred project here; Stash took 380 days after two abandoned prior codebases. Both were *usable* long before they were *released* — the tag marked the decision to distribute. If you are building for yourself first, the clock that matters is the discovery clock, and it does not start until you tag.

