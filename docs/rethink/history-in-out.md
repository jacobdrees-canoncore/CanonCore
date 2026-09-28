# History in and out: importing and sharing what a profile watched, heard and read (research, 2026-09-28)

The question: in September 2026, what are the most impressive and user-friendly ways for a self-hosted, any-medium Library and player to bring watch, listen and read history IN, and to share it OUT?

CanonCore's constraints, which every option below is judged against:
- **No paid providers.**
- **No central CanonCore service.** Each install stands alone.
- **An admin never sees a friend's history** (grill decision 99).
- Every profile keeps its own watch-event log, and each event has a `source` field (grill decision on watch events).

Key:
- **F** means read at the owner (docs, terms, source code or first-party page) on 2026-09-28, or measured that day.
- **J** means judgement.
- **U** means unverified.

Every page cited below was read on **2026-09-28** unless another date is given.

---

## 1. Trakt (film and TV): now possible free, and the new policy names our case

**What it does.** Trakt is the de facto watch-history hub for film and TV. It has scrobble (start, pause and stop), check-in, history sync, ratings and watchlist, and players and media servers report to it.

**Cost.**
- **Creating an API app no longer needs VIP (F).** PR #945, "require a verified GitHub account to create an app", **merged 2026-09-23**. Its body says: "The VIP restriction on creating apps is removed at the same time." (https://github.com/trakt/trakt-api/pull/945)
  - This corrects `providers.md`, which says the ungating PR "was closed unmerged". That was true of an earlier attempt, not of #945.
- **It is live (F).** On 2026-09-28 the live portal bundle at https://developer.trakt.tv has the strings `github_required: "Connect your GitHub account before creating an app."` and five other GitHub-link errors. It has no app-creation VIP gate.
  - The `create-an-app` guide on `main`, updated 2026-09-23, says: "Creating an app requires a verified GitHub account."
  - https://github.com/trakt/trakt-api/blob/main/projects/developer/src/lib/guides/create-an-app.md
- **Free Trakt users can connect two "Community Apps", up from one (F).** Official Trakt apps do not count toward that limit. Announcement dated 2026-09-18: https://github.com/trakt/trakt-api/discussions/943
  - So for a free friend, CanonCore would take one of their two slots.
- Some endpoints are "🔥 VIP Only" (they return 426) or "VIP Enhanced" (they return 420 over an account limit) (F): https://github.com/trakt/trakt-api/blob/main/projects/developer/src/lib/guides/vip-methods.md
  - Which history endpoints carry those tags was not checked (U).
- **Rate limits (F):** POST is 1 per second per user. Authenticated GET is 500 per 5 minutes. Unauthenticated GET is 500 per 5 minutes per app. Guide updated 2026-08-21: `.../guides/rate-limiting.md`

**Terms for a self-hosted personal tool.**
- **The draft "API Use Policy" is PR #941 (F).** It is open and unmerged. The file is dated 2026-09-22. https://github.com/trakt/trakt-api/pull/941
- Its permitted list names our cases word for word:
  - "A media player integration that scrobbles playback to the user's connected Trakt account."
  - "A personal or self-hosted tool that syncs a user's media server activity with their own Trakt account."
  - "A one-off personal script that helps a user export or migrate their own watch history."
  - "An app's popularity, where it runs, or whether it uses a backend does not determine whether it is permitted."
  - "using your own credentials for an otherwise permitted personal or self-hosted tool is allowed."
- It forbids:
  - mirroring Trakt's catalogue, community activity, ratings or lists;
  - redistributing Trakt data as a feed for other services;
  - "Giving other services access to Trakt through your app's credentials";
  - working around restrictions.
- **It auto-deletes an app after 30 consecutive days with no usage.** It also adds: "A personal tool in regular use counts as an active app, even if it serves only one person."
- Discussion #943 says Trakt does not support "another service using Trakt's data and resources to build a competing platform". A commenter asks where that line falls, and the thread gives no answer (F).
- **Reading (J):** a self-hosted CanonCore that imports and scrobbles each profile's OWN history fits the draft. Using Trakt as a catalogue source does not, and we do not need it for that.
- **The shipped-key question (J):** CanonCore could ship one project client id, as the Jellyfin plugin does. Its `TraktURIs.cs` hard-codes a shared `ClientId` and `ClientSecret` (F: https://github.com/jellyfin/jellyfin-plugin-trakt/blob/master/Trakt/Api/TraktURIs.cs).
  - The alternative is to ask each Owner to create their own app, which is now free.
  - A per-install app risks the 30-day deletion on a quiet install.
  - A shared app risks being blocked for everyone at once.
  - **Recommend:** a shipped project app, plus an optional per-install override, as with TMDB in `providers.md`.

**Competitors (F).**
- The Jellyfin Trakt plugin v33 was released 2026-09-15 (https://github.com/jellyfin/jellyfin-plugin-trakt).
- Also: Plex's third-party scrobblers, Kodi, Infuse, Simkl's importers, and multi-scrobbler (https://github.com/FoxxMD/multi-scrobbler, 0.19.1 released 2026-09-28).

**How impressive (J):** high for film and TV people. "Connect Trakt" imports years of history on day one, and scrobbling keeps their Trakt profile alive while they move to CanonCore.

**Privacy (J):**
- Tokens are held per profile.
- Scrobbling out is opt-in per profile, and never set by an admin.
- Trakt profiles can be public, and that is the friend's choice on Trakt.

---

## 2. Simkl (film, TV, anime): the friendliest free alternative to Trakt

- **Free (F)** "for non-commercial apps and personal projects", and for commercial apps under $150 a month in revenue: https://api.simkl.org/api-rules.md
- **Rules (F), from the same page:**
  - Link back to the item's Simkl page.
  - **Rule 2:** a tracker that syncs with another tracker "may use the Simkl API only if you also offer Simkl login and sync alongside". "If you're integrating Simkl as one of multiple supported services in a media app, you're good."
  - Use TVDB or TMDB for raw metadata.
  - Caps are 10 GET per second and 1 POST per second. Sustained overage means suspension "without warning, no appeal".
- **Features (F), from https://api.simkl.org/llms.txt:**
  - scrobble start, pause, stop and checkin;
  - cross-device resumable playback;
  - **PIN auth for "TVs, consoles, CLIs, and media-server plugins"**, which suits Apple TV sign-in;
  - "Find an item by file name";
  - rewatch sessions, which need Simkl PRO or VIP;
  - Custom Lists, which need PRO or VIP.
- AUTH V1 is being retired "around April 2027". Build on AUTH V2 with PKCE.
- The Apiary docs are frozen as of 2026-05-22, and "Apiary … is being sunset by Oracle in October 2026". Use api.simkl.org, not Apiary (F: https://simkl.docs.apiary.io).
- **Privacy (J):** the same as Trakt. It is opt-in per profile.

---

## 3. Letterboxd (film): file-only, but it works both ways

- **API: closed to us (F).** "Access to the Letterboxd API is available by request only… we are not granting access for … private or personal projects, or for any usage that recreates current or planned features of our paid subscription tiers." https://letterboxd.com/api-beta/
- **The same page offers** "import and export facilities, and every member profile has an RSS feed of new diary entries, reviews and lists."
- **Import format (F):** a UTF-8 CSV with columns `LetterboxdURI`, **`tmdbID`**, `imdbID`, `Title`, `Year`, `Directors`, `Rating`/`Rating10`, `WatchedDate`, `Rewatch`, `Tags` and `Review`. `WatchedDate` is a calendar date, not a timestamp. https://letterboxd.com/about/importing-data/
- **So CanonCore can do (J):**
  - **IN:** read the user's Letterboxd export ZIP (the diary CSV) once, and optionally poll their public diary RSS.
  - **OUT:** generate a Letterboxd-format CSV keyed by `tmdbID`, which the user uploads themselves.
  - Both are free and both are allowed. Neither needs a key.
- The contents of the export ZIP were not read here, because it needs a login (U).

---

## 4. Serializd (TV)

- **No public API was found (U).** The homepage fetched on 2026-09-28 mentions no API, and `/api` returned 403.
- Its import page and terms sit behind a Cloudflare challenge and could not be read.
- A third-party blog (achriom.com, 2026-08-12, not the owner) says it has "no export button and no official API".
- A Reddit post reports a beta TV Time importer at serializd.com/import-tvtime-data.
- **Recommend (J):** skip Serializd until it publishes an export.

---

## 5. AniList and MyAnimeList (anime and manga): terms rule them out as sync targets

- **AniList (F),** from https://docs.anilist.co/guide/terms-of-use:
  - "Using the AniList API as a backup or data storage service is strictly prohibited."
  - "Use of the AniList API within competing, non-complementary services of the same nature is prohibited. This includes … anime and manga list or tracker services. The restriction applies to all data … including both user data and media data."
  - It is free for non-commercial use.
  - The rate limit is 90 requests a minute, currently "degraded… 30 requests per minute" (https://docs.anilist.co/guide/rate-limiting).
  - **Reading (J):** CanonCore keeps its own watch log, so it is plausibly a "tracker service". Importing AniList history into our log is close to "backup or data storage". **Avoid, or at most scrobble OUT and ask AniList first.**
- **MyAnimeList (F),** from https://myanimelist.net/static/apiagreement.html:
  - It is free for non-commercial use, and open source counts as non-commercial.
  - But: "You may not maintain, store or process any MyAnimeList Content that consists of personal information of MyAnimeList users or content generated by such users … on the server-side of Your Applications". Such content may be kept only client-side and temporarily.
  - **Reading (J):** importing a MAL list into a CanonCore server is exactly server-side storage of user-generated content. **Import is ruled out.** Scrobbling a watched episode OUT to MAL is the only fit.
- **Recommend (J):** leave both out of the first build. Anime history comes in through Trakt or Simkl, and Simkl has first-class anime support.

---

## 6. Reading: Hardcover yes; StoryGraph and Goodreads are file-only

- **Hardcover (F):**
  - **OAuth now exists.** The docs added standard PKCE and the **Device Authorization Grant (RFC 8628)** on 2026-09-24 (commit "Oauth doc and guides (#185)").
  - The device grant sends the user to `hardcover.app/link` with a code like "ABCD-1234", and offers a QR code. That suits Apple TV and e-readers.
  - https://github.com/hardcoverapp/hardcover-docs/blob/main/src/content/docs/api/OAuth.mdx
  - Scoped tokens have existed since August 2026.
  - The free plan allows **5,000 requests a day, a burst of 10, and 60 a minute**. Its intended use is "Personal ownership, progress sync, personal use".
  - Queries "must be run in an environment where the token can be kept secure", which means server-side.
  - A "commercial product, or … publicly accessible website … may not use data owned by users".
  - It forbids training public or commercial LLMs.
  - The API is "in beta" (https://github.com/hardcoverapp/hardcover-docs/blob/main/src/content/docs/api/Getting-Started.mdx).
  - It has guides for reading progress: `UpdatingABooksProgress`, `UpdatingReadingJournal` and `GettingBooksWithStatus`.
  - **This is the only two-way, free, OAuth reading-history API in the set.**
- **StoryGraph (F):** no API. The roadmap item "An API" (opened 14 Mar 2021) is marked "Long-term": https://roadmap.thestorygraph.com/features/posts/an-api
  - Users can export a CSV from the User Export page, per the owner's roadmap replies.
  - **IN is by CSV only.**
- **Goodreads (F):** "Goodreads no longer issues new developer keys for our public developer API and plans to retire the current version." Users export from My Books, then Import and export: https://help.goodreads.com/s/article/Does-Goodreads-support-the-use-of-APIs
  - `goodreads.com/api` now 302-redirects to the homepage.
  - **IN is by CSV only.**
- **Competitors (F):** BookWyrm has importers for Goodreads, StoryGraph, LibraryThing, OpenReads, Calibre, Open Library and BookWyrm itself (https://github.com/bookwyrm-social/bookwyrm/tree/main/bookwyrm/importers). NeoDB imports Goodreads and StoryGraph lists.
  - **So the Goodreads and StoryGraph CSVs are the de facto reading-history interchange (J).**

---

## 7. Music scrobbling: ListenBrainz and Last.fm

- **ListenBrainz (F):**
  - Submissions are JSON documents with `listen_type` set to `single`, `playing_now` or `import`, plus `payload[]`.
  - Each listen carries `listened_at` and `track_metadata`: artist, track and release names, and `additional_info` with MBIDs, `media_player`, `submission_client`, `submission_client_version` and `duration_ms`.
  - Navidrome's own example uses these fields.
  - https://listenbrainz.readthedocs.io/en/latest/users/json.html
  - **This is the nearest thing to an open listen-history format**, and it maps directly onto our event log, where `source` is the `submission_client`.
- **Its import side is new (F):**
  - A **User history exports** API: request a ZIP of a user's full history with their own token, rather than paging `/listens`. https://listenbrainz.readthedocs.io/en/latest/users/api/export.html
  - Separately, "Connecting music services from another application" lets an approved app start a Spotify connection on ListenBrainz. It needs a MetaBrainz-approved scope, so it is not for us. https://listenbrainz.readthedocs.io/en/latest/users/connect-music-services.html
- **Privacy, the load-bearing point (F):** "User listen data and text is made public under the Creative Commons Zero (CC0) license." Its anti-goals list: "A store for people's private listen history." https://listenbrainz.org/about/
  - **So scrobbling OUT publishes a friend's listening under CC0.** CanonCore must say so at the opt-in (J).
- **Self-hosting (F):** the ListenBrainz server is GPL-2.0 and released 2026-09-28. Koito (MIT) and Maloja (GPL-3.0) are self-hosted scrobble stores that accept a ListenBrainz-compatible URL.
  - teal.fm has a WIP "ListenBrainz compatible API" (`teal-fm/inscriber`).
  - **The ListenBrainz submit API is therefore a de facto inbound protocol (J).** If CanonCore accepted it, every existing scrobbler (Web Scrobbler, Pano and others, U) could post listens INTO a profile.
- **Last.fm (F),** from https://www.last.fm/api/tos:
  - The licence is free but "solely for non-commercial purposes".
  - Last.fm must be credited and linked.
  - "You agree to only give public access to pages using Last.fm's web services that have been previously approved by Last.fm in writing."
  - A "Reasonable Usage Cap" of 100 MB of Last.fm data applies.
  - The scrobble rules: a track over 30 seconds, played for half its length or 4 minutes; batches of up to 50; cache and retry in order (https://www.last.fm/api/scrobbling).
  - **Reading (J):** scrobbling OUT is fine and expected (Navidrome and Plexamp do it). Importing a big Last.fm history INTO a server hits the 100 MB cap and the approval clause, so steer imports to the user's own export or to ListenBrainz's Last.fm importer instead (U).
  - How an open-source project ships a Last.fm shared secret was not checked (U).

---

## 8. Plex and Jellyfin as sources, and what they do socially

- **Plex (F):**
  - `GET /status/sessions/history/all` is described as "List all playback history (**Admin can see all users, others can only see their own**)" (https://developer.plex.tv/pms/).
  - **So an import must run with each FRIEND's own Plex token, never the admin's.** Otherwise the admin path reads everyone's history, against rule 99 (J).
- **Plex social (F):**
  - "Sync Watch State and Ratings" pushes watched state to the Plex account across servers (support article modified 2025-03-24: https://support.plex.tv/articles/sync-watch-state-and-ratings/).
  - The **Activity Feed**, part of Discover Together, shows friends' watched, rated, watchlisted and binge events. Each type has its own privacy setting (modified 2025-01-22: https://support.plex.tv/articles/activity-feed/).
  - The profile shows a lifetime watch count, and "Privacy Settings: Control who will be able to view your Watch History, Ratings, Watchlist activity" (https://support.plex.tv/articles/profile/).
  - **Watch Together is being ended:** "As we debut our new Plex experience, we are ending support for some features… like Watch Together" (note dated 2025-02-25: https://support.plex.tv/articles/watch-together/).
  - Webhooks are "a premium feature and require a Plex Pass subscription", so they are **paid** (https://support.plex.tv/articles/webhooks/).
  - **Plex Pro Week** is a September blog and video week (2025: Sept 21, including "Webhooks 101"), not a history feature (https://www.plex.tv/en-gb/blog/category/pro-week/).
  - A per-user Plex "year in review" was **not found**: the 2026-09-09 "A Plex Year in Review" post is an editorial best-films list (U that none exists).
  - Community tools fill the gap: Plex Unwrapped (built on Tautulli), and Tautulli v2.18.2 released 2026-09-28.
- **Jellyfin (F):**
  - The Trakt plugin v33 was released 2026-09-15.
  - Playback Reporting v19 was released 2026-09-08. It is a server-wide play log, so it is admin-level data.
  - Webhook v22 was released 2026-09-08.
  - The server's latest release is v12.1 (2026-09-15).
  - SyncPlay (watch together) is in the server (`Emby.Server.Implementations/SyncPlay`).
  - "Wrapped" projects: **Jellyfin Rewind** (377 stars, "Review Your Music of 2025", richer with Playback Reporting installed: https://github.com/Chaphasilor/jellyfin-rewind), `johnpc/jellyfin-wrapped` and `jellyfin-replay`.
- **Import rule (J):** import Jellyfin history per user, with that user's credentials and from that user's own played state, not from the Playback Reporting table. The per-user endpoint was not re-read this session (U).

---

## 9. Apple platform integration

| Surface | What it gives CanonCore | Status (F) | Verdict (J) |
|---|---|---|---|
| **Apple TV app "Up Next" / "Watch Now"** (Apple Video Partner Program, Video Subscriber Account) | A slot in Apple's TV app | **Closed to us.** "This program is designed for apps that deliver premium subscription video entertainment services"; eligibility needs the app's primary function "to deliver your own subscription service for premium video entertainment content", plus In-App Purchase. https://developer.apple.com/programs/video-partner/ | No. |
| **Top Shelf** (`TVTopShelfContentProvider`, tvOS 13; carousel, sectioned and inset content) | The row above our app icon on the Apple TV home screen: "Continue watching", "Next in this Ordering" | Open to any tvOS app. https://developer.apple.com/documentation/tvservices | **Yes.** This is our "Up Next", and it is free. |
| **Apple TV users mapped to profiles** (User Management entitlement, tvOS 16+) | Each Apple TV user lands straight in their own CanonCore profile, with per-user keychain and storage | "Mapping Apple TV users to app profiles" (https://developer.apple.com/documentation/tvservices/mapping-apple-tv-users-to-app-profiles); `TVUserManager` from tvOS 13 | **Yes.** It is the Apple-native half of project 3. |
| **`MPNowPlayingInfoCenter`** (iOS 5, macOS 10.12.2, tvOS 5, watchOS 5, visionOS 1) | Lock screen, Control Center, Watch, AirPods and the Apple TV now-playing card, with artwork and position | Open. https://developer.apple.com/documentation/mediaplayer/mpnowplayinginfocenter | **Must-have.** It is table stakes for every player. |
| **SharePlay** (Group Activities with `AVPlaybackCoordinator`; iOS 15, tvOS 15, macOS 12) | Synchronised watching and listening over FaceTime, with rate and seek propagated | Open. Needs the `group-session` entitlement; participants must each have the app and access to the item. https://developer.apple.com/documentation/avfoundation/supporting-coordinated-media-playback. visionOS 26 adds nearby participants. | **Yes, for project 8.** Friends on the same server all have access, and Plex has just dropped Watch Together. |
| **App Intents / Siri / Shortcuts** (`AppEntity`, iOS 16, tvOS 16, macOS 13) | "Play the next Doctor Who in my Ordering", Shortcuts actions | Open. The `AssistantSchemas` domains list has **no video or music domain** (books, reader, photos, browser and others only). https://developer.apple.com/documentation/appintents/assistantschemas | Yes for plain intents. The Books/Reader schemas may suit project 6 (U). |
| **Spotlight** (`IndexedEntity`: iOS 18, macOS 15, visionOS 2; `CSSearchableItem`) | Items and Orderings findable from system search | Open; **no tvOS** listed for either | Nice, but low. |
| **Live Activities** (ActivityKit: iOS 16.1, iPadOS, Mac Catalyst; shown on "iPhone, iPad, Apple Watch, and the Mac") | A lock-screen card for a long import, a watch-party countdown, or what is playing on the Apple TV | Open; **no tvOS** | Low: a garnish once playback exists. |

(All read at developer.apple.com's documentation JSON on 2026-09-28.)

---

## 10. A year in review of our own ("Rewind")

- **Competitors (F):**
  - Jellyfin Rewind is music only, and a separate web app with CORS pain, per its README.
  - Plex Unwrapped depends on Tautulli.
  - Letterboxd has a "Year in Review" link in its site footer (seen on the letterboxd.com pages fetched).
  - Plex's profile shows lifetime stats.
  - No self-hosted product was found doing it **across film, TV, music, audio drama and books at once (J/U).**
- **Why it fits (J):**
  - It is computed from our own event log, so it needs no provider and no terms.
  - It is private per profile by construction.
  - It is the most shareable single screen we could build, as a card or image the friend chooses to post.
  - It is uniquely ours in its "Orderings completed" and "time through the Doctor Who timeline" angles.
- **Privacy (J):**
  - Generated per profile.
  - An admin sees only server-wide aggregates, if anything: counts, never titles per friend.
  - Sharing is an explicit export.

---

## 11. Cross-server sync between two CanonCore installs

- **Nothing in the ecosystem to adopt (J).** Plex does this through its central account, which our no-central-service rule forbids. Jellyfin has nothing native.
- **Recommend (J):**
  - Build profile **export and import**, already decided in grill 99 as JSON plus the id-list format.
  - Its events carry provider ids (TMDB, MusicBrainz, ISBN or Open Library) and `source`, so the same file re-imports on another install and dedupes by (item ids, timestamp).
  - A live pairing, where one install pushes a profile's events to a friend's install by token, is a later layer (project 10). Do not federate.
- **Open formats worth matching (F):**
  - ListenBrainz listen JSON (music).
  - Letterboxd CSV (film).
  - Goodreads CSV (books).
  - teal.fm's ATProto lexicon `fm.teal.feed.play`, whose fields include `trackName`, `artistNames`, `recordingMbId`, `releaseMbId`, `isrc`, `duration`, `playedTime` and `submissionClientAgent` (https://github.com/teal-fm/teal/blob/main/lexicons/fm.teal/feed/play.json).
  - **No cross-medium open watch-history standard exists (J/U).**

---

## 12. Fediverse and ATProto (2025 to 2026)

- **NeoDB (F):**
  - AGPL. Release 0.19.4.1 on 2026-09-26.
  - Covers books, film, TV, music, games, podcasts and performances.
  - Federates over ActivityPub **and ATProto**, and bridges Popfeed and BookHive records.
  - Each activity can be self-only, followers-only or public.
  - Has a REST API with OpenAPI, and imports Goodreads, Letterboxd and StoryGraph lists.
  - https://github.com/neodb-social/neodb
  - `neodb-social/skybridge` (pushed 2026-09-22) bridges Popfeed, BookHive and teal.fm ATProto records into the fediverse as NeoDB-compatible activities.
- **BookWyrm (F):** ActivityPub social reading, v0.9.3 released 2026-09-09.
- **teal.fm (F):** ATProto scrobbling, "coming soon" (326 stars, pushed 2026-09-26).
- **Other self-hosted trackers that are direct competitors (F):**
  - Ryot (GPL-3.0, v10.5.0): "Roll your own tracker!"
  - Yamtrack (AGPL, v0.26.3).
  - Movary (film).
  - multi-scrobbler: many sources to many clients.
- **Recommend (J):**
  - Do NOT run an ActivityPub server inside CanonCore. It is a public, always-on surface, and it conflicts with the "private by default, admin sees nothing" stance.
  - If friends want it, an opt-in per-profile **"post to my NeoDB account"** through NeoDB's API is the fediverse on-ramp that fits every medium we cover (project 10). Its API terms were not read (U).

---

## Ranked recommendation for CanonCore (all J)

1. **Our own Rewind (year in review) and profile stats, built on the event log.**
   - Most impressive, zero dependencies, private by design.
   - Fits: **project 3** (per-profile), polished in **project 10**.
2. **Apple-native playback surfaces.**
   - `MPNowPlayingInfoCenter`, then Top Shelf "Continue / Next in Ordering", then Apple TV user-to-profile mapping.
   - Free, first-party, and seen every day.
   - Fits: **project 8** (Now Playing, Top Shelf) and **project 3** (user mapping).
3. **File imports that cost nothing and break no terms.**
   - Letterboxd export and diary RSS in, Letterboxd CSV out.
   - Goodreads and StoryGraph CSV in.
   - ListenBrainz export ZIP in.
   - Plex and Jellyfin history in, **each with the friend's own token**.
   - Fits: **3** (film and TV), **5** (music), **6** (books).
4. **Trakt connect** (import, then scrobble out, per profile, device-code sign-in, shipped app id plus override).
   - Unblocked since 2026-09-23. Keep it to the user's OWN data per draft #941.
   - Fits: **project 3**.
5. **ListenBrainz: scrobble out, opt-in with a CC0-public warning, and accept its submit API inbound** so existing scrobblers feed CanonCore.
   - Last.fm scrobble-out alongside.
   - Fits: **project 5**.
6. **SharePlay watch-together** on Apple TV, iPhone and Mac.
   - A differentiator now that Plex is ending Watch Together.
   - Fits: **project 8**.
7. **Hardcover OAuth two-way reading progress** (device grant on Apple TV and e-readers).
   - Fits: **project 6**.
8. **Simkl connect** as a second film, TV and anime tracker. It needs "Simkl login and sync" offered, which is the case.
   - Fits: **project 3**, later.
9. **Portable profile export as a CanonCore-to-CanonCore sync file**, and later push-pairing.
   - Fits: **project 10**.
10. **App Intents, Spotlight and Live Activities**: garnish.
    - Fits: **project 8** or **10**.
11. **NeoDB posting (opt-in)**: last.
    - Fits: **project 10**.

**Avoid:**
- AniList (tracker ban, no storage).
- MAL import (no server-side user content).
- The Letterboxd API (no personal projects).
- The Goodreads API (closed).
- StoryGraph and Serializd APIs (none exist).
- Plex webhooks (Plex Pass is paid).
- The Apple TV app Up Next (premium subscription services only).
- Any admin-level history source (Plex admin history, Jellyfin Playback Reporting) as an import path.

## Unverified (U)

- Which Trakt history endpoints are VIP-tagged, and whether a free account's history is capped.
- Serializd's export and API status at the owner (behind a Cloudflare wall).
- The contents of Letterboxd's and StoryGraph's export files.
- How open-source apps ship a Last.fm shared secret, and whether ListenBrainz's Last.fm importer covers a full history.
- Jellyfin's per-user played-state endpoint for import (not re-read this session).
- Whether any Plex per-user year in review exists.
- NeoDB's API terms.
- Whether the Books/Reader assistant schemas fit audio drama or comics.
- Whether a cross-medium open watch-history standard exists anywhere (none found).
