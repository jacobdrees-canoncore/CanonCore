# Sweep: jellyfin.org shard B (106 URLs) vs the CanonCore prompt

STATUS: complete

Method: every URL in `shards/jellyfin-ab` fetched and read page-by-page, no relevance
pre-filter. Each block records what the page documents, any concrete rule/limit/default,
and a classification against the CanonCore prompt:

- **ADOPTED** — prompt already says the same thing.
- **REFUSED** — prompt explicitly rules it out (WHAT NOT TO BUILD / STANDING RULES).
- **DIVERGENT** — prompt deliberately does it differently.
- **ABSENT** — prompt says nothing at all. Rated LOW / MEDIUM / HIGH for whether a
  self-hosted media catalogue genuinely needs it.

Progress log at the bottom. Consolidated gaps at the end.

---

## Pages

### 1. https://jellyfin.org/downloads/clients/all
Curated directory of every client, tagged **Official / Third Party / Beta** and by platform
(Android, iOS, Apple TV, Roku, LG, Samsung, Kodi, Discord, Linux). ~40 entries. Notes a hard
store constraint verbatim: "Due to a technical limitation of the Roku store, the Jellyfin app
for Roku may state that a cable or satellite subscription is required."
Reveals capability surface by implication: book/comic clients (JellyBook), music-only clients
(Supersonic, Feishin, Fintunes, Jellify, Gelly), a Kodi add-on that "syncs metadata from
selected Jellyfin libraries into the local Kodi database", Discord bots, a terminal REPL client
(jftui), a Mopidy backend plugin.
- **ABSENT** — a published, curated, tiered third-party client directory. **LOW.** CanonCore has
  a curated *provider* store (CMPP Store, "ACCEPTED rather than open"); nothing about clients,
  and with one web client there is nothing to list yet.
- **REFUSED (adjacent)** — the Kodi metadata-sync add-on mirrors the catalogue into a foreign
  local database. "No fork, no export, no import, no cross-instance sharing."
- Note: the sheer volume of *third-party* clients here exists because Jellyfin's HTTP API is
  public and stable. CanonCore's prompt argues the opposite lesson (implement an existing
  protocol) but says nothing about whether CanonCore's own API is a **public, documented,
  versioned client contract**. See gaps.

### 2. https://jellyfin.org/downloads/docker
Docker distribution. Concrete defaults quoted: "Example commands store data in `/srv/jellyfin`
and assume your media is stored under `/media`." Ships on both Docker Hub and GHCR.
- **ABSENT** — packaging and distribution of the server itself; the separation of *config/data
  dir* from *media dir*; container images; publishing to two registries. **MEDIUM.** Self-hosted
  software that has no install artefact is not self-hostable; the prompt covers storage paths
  for media but never where CanonCore's own state lives or how it is shipped.

### 3. https://jellyfin.org/downloads/dotnet
".NET portable version can be run on any system with a .NET runtime using `jellyfin.dll`".
Flagged "Custom FFmpeg Unavailable".
- **ABSENT** — a runtime-portable/no-installer build. **LOW.**
- The "Custom FFmpeg Unavailable" flag is **REFUSED** territory: "No transcoding, no ffmpeg."

### 4. https://jellyfin.org/downloads/linux
Distro matrix with a support-tier vocabulary: **Official** (Debian/Ubuntu APT + .deb, generic
tar.gz), **OS Package** (Arch, Gentoo), **Community** (Fedora/CentOS via RPMFusion). Per-entry
flag "Custom FFmpeg Unavailable". Site-wide toggle: **Unstable / Stable**.
- **ABSENT** — (a) a *tiered* support promise per distribution channel, (b) a **stable vs
  unstable release channel** split. **MEDIUM** for release channels: the prompt mandates a
  forward-only migration ladder and says a released version must always migrate forward, which
  implies released versions exist, but never defines what a release *is* or whether there is a
  pre-release channel. **LOW** for distro packaging tiers.

### 5. https://jellyfin.org/downloads/macos
Installers (.dmg) and manual TAR archives (.tar.xz). Nothing else. Thin download page.
- **ABSENT** — desktop-OS install artefacts. **LOW.**

### 6. https://jellyfin.org/posts
Blog index (page 1 of 7). Establishes the cadence and the roles: named leads per surface
("Core Team, Android Lead", "Core Team, Web and iOS Lead", "Project Leader", "Server Team",
"Roku Team"). Concrete stated rule from the 10.11.0 entry: "throwing our planned **6-month
release schedule** completely out of whack" after "over 6 months of development and another
**6 months of RC testing**".
- **ABSENT** — a release cadence, an RC/testing period, and a public changelog channel.
  **MEDIUM.** The prompt requires a forward-applicable migration ladder because "a released
  version can always migrate forward", but never says what a release is, how often, or how
  users learn what changed.

### 7. https://jellyfin.org/posts/2022/12/24/android-tv-15
Android TV 0.15 release notes. Capabilities surfaced:
- **Pictures are a first-class media type.** "Jellyfin is a media server that not only supports
  audio and video, but also pictures" — with a picture viewer, on-screen controls and a
  **slideshow**.
- Player: a "previous" button (previous episode *or playlist item*); a **quality button that
  adjusts maximum bitrate during playback**; **audio night mode** (loudness normalisation),
  "turned off by default".
- **Subtitle customisation**: size, background, **stroke width, position, text colour**.
- **RTL (right-to-left) layout support**, switching automatically on the app language.
- Classification: bitrate/quality button is **REFUSED** ("Direct play only. No transcoding, no
  quality ladders"). Audio night mode is **REFUSED** by the same rule (it is a DSP filter).
- **ABSENT** — image/photo as a consumable medium *with a renderer and a slideshow*. CanonCore
  has `image` in the edition medium enum but says nothing about an image renderer. **LOW**
  (prompt explicitly says a renderer is needed only when a file is attached and play is pressed).
- **ABSENT** — **subtitle rendering and per-user subtitle appearance settings**. **MEDIUM.**
  CanonCore's `files` table has a `subtitle` role and sidecars with a language, but nothing about
  choosing, rendering or styling them, and direct-play-only makes subtitle handling the client's
  whole job.
- **ABSENT** — **RTL and internationalisation of the UI**. **MEDIUM.** See gaps: there is no
  localisation position anywhere in the prompt.

### 8. https://jellyfin.org/posts/2022/12/29/swiftfin
Swiftfin (native Swift, SwiftUI + VLCKit) reaches the App Store. Concrete facts:
- "written from the ground up using modern technologies like Swift UI, and VLCKit"; minimum
  "iOS/iPadOS/tvOS 15.0 or later".
- Left TestFlight because "the beta program filled up (that's over 9,000 users!)" — TestFlight's
  10,000-tester ceiling in practice.
- "Right now, Swiftfin is also **video only**, so it does not handle Audiobooks, Photos, or
  Music." A native client that covers one medium and defers the rest to another client.
- An **Experimental settings section** gating an alpha feature ("Settings → Experimental →
  Live TV (Alpha)").
- **ADOPTED (strongly corroborating)** — CanonCore's decision that "the player is native Swift
  under every option" and that Streamyfin still wrote Swift around MPVKit. Jellyfin's own Apple
  client is Swift + VLCKit for exactly the codec-coverage reason the prompt gives.
- **ABSENT** — **beta distribution channel for the client apps** (TestFlight, Play beta track)
  and its tester cap. **LOW.**
- **ABSENT** — an in-app **experimental/alpha feature gate**. **LOW**, and arguably **REFUSED**
  in spirit: "Do not introduce a configuration option, feature flag, or environment variable
  unless something in the repo reads it in the same change" (CLAUDE.md).

### 9. https://jellyfin.org/posts/a-call-for-developers
Governance/recruitment essay, October 2023. Not a product page, but it states the project's
constitution as rules:
- "We are explicitly **anti-commercial**." "No one gets paid for Jellyfin work, by design."
- "we do take donations, these only cover our infrastructure costs ... we don't pay developers
  out of donations, and never will"; "actively avoid bug bounties".
- Scale figure: "our core contributor base is actually fairly small, **at most about 30 active
  people**, for everything - the core server, the webUI, and all of our clients", flat for 3 years.
- "probably the biggest complaints about Jellyfin are about the **lack of client support**, and
  the rough edges/lack of polish."
- **ABSENT** — project governance, funding posture, contribution policy, maintainer succession.
  **LOW** for the first version (single author, self-hosted), but see gaps: CanonCore *does*
  plan a public demo instance and a curated CMPP Store, both of which are ongoing obligations
  with a cost, and the prompt never says who pays or who accepts store submissions.
- Corroborates the prompt's client argument from the other side: 30 volunteers could not keep
  ~15 official clients polished. CanonCore plans three clients with one author.

### 10. https://jellyfin.org/posts/a-note-about-privacy-and-expo
April 2021. The single most directly relevant post in this shard to a CanonCore decision.
- Stated guarantee: "we guarantee that there is no involuntary tracking, from the server to the
  mobile apps."
- The concrete failure: Apple has required Privacy Information on every app submission since
  December 2020. Jellyfin declared "Data Not Collected", got the badge, then Apple contacted
  them: **Expo's managed workflow "automatically includes base code for a variety of different
  items, which includes code that can be used to provide analytics and tracking information"**
  (Branch, Facebook, Segment, Amplitude), "Even though we don't use any of these functions, this
  code is included in the final app binary, so we are now forced to declare that app can access
  the **Device Identifier**."
- Their resolution: "we are looking to **'eject' from Expo** in the future, which means we can
  completely control the build process by ourselves."
- **ABSENT** — (a) a **no-telemetry / no-analytics guarantee** for CanonCore server and clients;
  (b) **App Store privacy declarations** and what a dependency drags into the binary.
  **MEDIUM.** CanonCore has chosen Expo for the phone app on entirely different grounds
  (react-native-web is frozen, Expo Router's architect left) and has a REFUSED entry about
  Unistyles' iOS-only podspec, so the prompt already reasons about Expo's binary-level
  constraints — but only about tvOS installability, never about what Expo injects. The specific
  2021 Facebook-SDK issue is long fixed by EAS/prebuild; the *class* (an app-store privacy
  declaration you cannot honestly make because of a dependency) is live and unaddressed.

### 11. https://jellyfin.org/posts/android-betas
Policy post explaining the Android beta programmes. Rules stated verbatim:
- "Do not use a beta version if you are unable to provide bug reports with app-logs and
  reproducible steps."
- "The beta releases are only available on the Google Play store or in our own repository."
- "**The Amazon Appstore has no options for beta apps.** Therefore, we unfortunately cannot
  provide beta versions of the app to users who do not have a Play Store on their device."
- **ABSENT** — a per-store beta channel and its per-store availability limits. **LOW.**

### 12. https://jellyfin.org/posts/android-next
Oct 2020. Cordova webview client replaced by a native Kotlin client. Concrete migration cost
stated: "you'll have to add your server and credentials again since we couldn't pull the
information from Cordova. **Local user settings such as the theme will also be reset** after the
update." Translations restart from zero on **Weblate** ("this client has a new set of
translations"). ExoPlayer "currently disabled by default". Missing at the time: "bitrate
limiting and SyncPlay".
The load-bearing line: "the included **device profile** still needs some tweaking to actually
mark every codec that the phone supports as supported to the server."
- **ABSENT — DEVICE PROFILES / CLIENT CAPABILITY NEGOTIATION. HIGH.** This is the mechanism by
  which a server decides whether a given client can play a given file. CanonCore is direct-play
  only and says "When a file will not play, say so plainly", and it names codec coverage as the
  reason the TV player must be native Swift — so it reasons about codecs on the client and never
  about how anything *knows* before playback starts. Without a declared client capability set
  there is no way to badge an item as unplayable on this device, no way to pick between editions
  by playability, and "say so plainly" can only ever be a post-failure message.
- **ABSENT** — translation infrastructure (Weblate) and the fact that a client rewrite discards
  the translation corpus. **MEDIUM** (see i18n in gaps).
- **ABSENT** — client-local user settings and what happens to them across a rewrite. **LOW.**

### 13. https://jellyfin.org/posts/android-on-fdroid
March 2021, F-Droid listing. Three hard constraints, all quotable:
- "The F-Droid version does not contain any proprietary libraries and **builds are fully
  reproducible**."
- "the library required for **casting** support is proprietary ... we had to remove it in the
  F-Droid version. Fortunately, the **remote control** feature still works."
- "the **Android Auto** integration does not work because Google does not allow apps to integrate
  with it when the app was not installed from the Google Play store."
- **ABSENT — casting and remote control.** **MEDIUM.** "Play this on that screen" and "control
  the TV from my phone" are baseline expectations of a self-hosted media product with three
  planned clients; CanonCore's prompt has playback through an opaque-id route and nothing about
  a second device being either target or controller.
- **ABSENT** — reproducible builds / no-proprietary-dependency build variant. **LOW.**
- **ABSENT** — car/OS integrations (Android Auto, CarPlay). **LOW.**

### 14. https://jellyfin.org/posts/android-tv-11
Feb 2020. Notable for a stated privacy rule around crash reporting:
- "We don't want to force users to report their logs to a third-party and therefore **we won't
  report anything by default**. When a crash occured the app will show a dialog and ask to report
  the logs."
- "**All crash reports are retained for 30 days** and can only be reviewed by a small group of
  developers inside the Android TV team."
- Also: OS-level "Next Up" home-screen channel integration; a home screen whose "sections you
  have chosen under your 'Home' preferences" are configurable — but "changing sections is only
  available in the web version for now" (settings edited on one client, honoured by another).
- **ABSENT** — crash/error reporting with an explicit opt-in and a stated retention period.
  **MEDIUM.** A self-hosted product that ships mobile and TV binaries will get crash reports or
  it will get nothing; the prompt has no telemetry position at all, in either direction.
- **ABSENT** — OS home-screen / "up next" channel integration. **LOW.**
- Configurable home sections: **deferred, not absent** — "No shelf type ... decided when screens
  exist." But note the cross-client wrinkle: server-stored display preferences edited on one
  client and read by another. CanonCore has no server-side user-preferences store.

### 15. https://jellyfin.org/posts/android-tv-12
Sept 2021, the app's largest release ("Over 400 pull requests containing 2400+ commits, 750+
changed files with 54000+ changed lines of code by roughly 50 contributors"). Capabilities:
- **Server auto-discovery on the network**: "The auto-discovery feature of the app now shows all
  servers instead of the first one, you can select one of those or manually enter your server
  address."
- **Multiple servers and multiple users in one client**, with "Users are automatically saved now
  with auto-login enabled by default", and a toolbar action to "switch to a different user".
- **Themes**: "three themes: Muted Purple together with Dark (Default) and Classic Emerald".
- **Feature flags**: "We're using feature flags for this so we can work on this code while still
  being able to publish new versions."
- A first-party **SDK** "that is already used in our Android app and **third party apps**".
- **ABSENT — server discovery and the connect flow.** **MEDIUM.** Every self-hosted client has to
  answer "which server, and how do I prove who I am"; CanonCore has one owner, one password and
  no signup, but no stated client connection or credential-storage model.
- **ABSENT** — multi-server / user switching in a client. **MEDIUM** for multi-server (a
  household with a phone and a demo instance is two servers on day one), **LOW** for user
  switching, which follows the single-owner decision.
- **ABSENT** — user-selectable themes. **LOW**; the prompt fixes design tokens as plain
  TypeScript from commit one, which is where a theme would live.
- **SDK for third parties**: partially **ADOPTED** — the prompt keeps the oRPC OpenAPI handler
  precisely for "a free OpenAPI reference", but never says the API is a supported public contract.

### 16. https://jellyfin.org/posts/android-tv-13
March 2022. Notable capabilities:
- **Version selection**: "A new button is now shown on the details page for a movie/episode/video
  that can be used to select which version to play." Jellyfin's "versions" are CanonCore's
  editions, surfaced as a picker on the item page. **ADOPTED / DIVERGENT** — CanonCore has
  editions with a pin (`is_default`) plus a declared order, and explicitly warns about "an
  edition picker nobody can use" if too many editions exist. Jellyfin has the picker and no
  default-selection rule at all.
- **Playback speed control**: "The set speed is remembered so the next video plays at the same
  speed, until you restart the app or manually change it back. Speed control is not available for
  Live TV." **ABSENT — MEDIUM.** The prompt commits to audiobooks as first-class (three Harry
  Potter audio renderings as editions); speed control is table stakes for spoken audio, and its
  persistence scope is a real decision (per session? per edition? per medium?).
- **Subtitle preferences**: size, and "toggle between a black background or text outline. These
  preferences work for **all text based subtitles**. Image based subtitles like SubStation Alpha
  and VobSub still use their own styling." (A concrete text-vs-image subtitle split.)
- **Screen saver** showing "random series and movies with their backdrop"; **OS-level search
  integration** ("press the 'Available on Jellyfin' button"). Both **ABSENT — LOW.**
- "the licenses of third party libraries are now shown in the about section" — **ADOPTED** in
  spirit: CanonCore must show the TMDb attribution string "in an About or Credits section".
- Transcoding tweaks and added audio codecs: **REFUSED** (no transcoding). But note the
  underlying fact — DD/DD+/TrueHD/DTS/LPCM are "commonly found on DVDs and Blu-rays"; on a
  direct-play-only product these are exactly the files that will not play.

### 17. https://jellyfin.org/posts/android-tv-14
Aug 2022. Densest capability page in the shard.
- **Quick Connect**: "you no longer need to enter a password and instead will be prompted to open
  Jellyfin on another device, like your phone or computer, to enter a **6 digit code**. This way
  of authentication is an alternative to passwords while keeping your server secure."
  **ABSENT — HIGH.** CanonCore plans a native tvOS app and the prompt already identifies TV text
  entry as broken ("React Native's TextInput is not built around the tvOS focus engine and the
  issue has been open since 2020"). A single-owner instance with one password still has to get
  that password onto a TV remote. Device-code pairing is the industry answer and there is no
  position on it.
- **Minimum server version enforced by the client**: "only version 10.8 or newer is supported. By
  dropping support for 10.7 we were able to add new features." **ABSENT — MEDIUM.** Three clients
  versioning independently against one API and one migration ladder, with no compatibility policy.
- **Crash reporting reversal.** 0.11 (2020) said "we won't report anything by default". 0.14 says
  the reporting "now sends all reports to **your own Jellyfin server**" and "**Crash reporting is
  now turned on by default.** ... On fresh installations the report is queued until connecting to
  a server." The reversal was made acceptable by removing the third party, not by changing the
  privacy stance. **ABSENT — MEDIUM**, and this is the design that makes it acceptable: telemetry
  that never leaves the user's own server is not telemetry.
- **Markdown and HTML in item and server descriptions**: "The support for basic HTML elements in
  item descriptions is extended to now also support Markdown. The same HTML and Markdown support
  is also added to server descriptions." **ABSENT — MEDIUM.** CanonCore's synopses and notes are
  statements holding provider- or owner-supplied strings that get rendered in a browser. The
  prompt's security section covers SSRF (Safe External Fetch) and the public read path field
  allowlist, but has no position on whether text values are plain or rich, nor on sanitising
  provider-supplied markup. Plain-text-only is a free safe default, but it must be *chosen*.
- **External trailers**: "playback of trailers from YouTube, Vimeo and other video services.
  Previously only local trailers could be played ... only available when a browser or video
  service app is installed". **ABSENT — LOW.** CanonCore says "a source is a reference" but only
  in the sense of not storing bytes; an item whose only source is a third-party web URL is an
  unhandled shape.
- **Live TV guide** (EPG, channels, sorting, filters). **ABSENT — LOW.** Genuinely out of scope
  for a catalogue of works, but worth recording that every comparable product has it.
- **WebSocket rewrite** enabling "instant updates of items on the home screen, and SyncPlay".
  **ABSENT — MEDIUM** for live/push updates (a background enrichment run that never surfaces its
  results without a manual refresh is a bad experience); **LOW** for SyncPlay (synchronised group
  playback), which is multi-user and therefore post-cap by the prompt's own logic.
- **Grid image sizes** "smallest and extra large", "sizing is now based on the actual size of your
  device, fixing some bugs on 4K displays". **ABSENT — LOW.**
- Reverse-proxy troubleshooting is linked as its own documentation area. **ABSENT — MEDIUM**
  (base URL / forwarded headers / TLS termination; see gaps).

### 18. https://jellyfin.org/posts/android-v2.1.0
Oct 2020. "Jellyfin in your car" — Android Auto for music: "browsing your music library in
multiple categories: latest, albums, artists, songs and genres. It allows **shuffling** your
albums and shows thumbnails when available."
- Stated limitation: "since we do not have **offline-support** at the moment all music playback
  needs an active network connection ... this may cause additional charges in your mobile plan."
- Connectivity fixes name real deployment realities: outdated-server warning, "Users with
  **self-signed certificates** should be able to use the app again", device names with special
  characters causing "endless loading".
- Player: **gesture zoom to remove black bars**; **Picture-in-Picture**; "a new option in the
  settings to select which **external player** to use. The listed players should also **report
  playback status back to Jellyfin** to track what you watch and allow the app to resume playback."
- **ABSENT — OFFLINE / DOWNLOAD-AND-PLAY. MEDIUM-HIGH.** See gaps; recurs across this shard.
- **ABSENT — EXTERNAL PLAYER HANDOFF WITH PROGRESS REPORTED BACK. MEDIUM.** This is the direct-
  play escape hatch: hand the stream to VLC/MPV/Infuse and still record progress. For a product
  that has ruled out transcoding, an external-player handoff is the only answer for a file the
  built-in player cannot decode, and it needs a progress-reporting endpoint to work.
- **ABSENT** — self-signed certificate handling. **MEDIUM**; a self-hosted LAN instance without a
  public DNS name is the common case, and a client that refuses its certificate is unusable.
- **ABSENT** — shuffle / random play, and browse-by-facet for audio (albums, artists, genres).
  **LOW**; the prompt defers shelves and browsing surfaces until screens exist.

### 19. https://jellyfin.org/posts/android-v2.3.0
Aug 2021. Rule stated verbatim: "**the new version of the app only supports servers of version
10.7.0 or later**" — a second instance of a client-imposed minimum server version, this time
forced by an SDK/library change rather than a feature.
- Player: **playlists** ("so that you can binge-watch your shows more easily"), **playback
  speed**, "an option in the client settings to remember the **screen brightness** applied through
  gestures", PiP respecting media aspect ratio.
- "you'll also be able to select a **bitrate limit to force transcoded streaming and reduce data
  usage**" — **REFUSED** (no transcoding, no quality ladders).
- "You can now set the **location to download content to** in the client settings" — offline
  downloads again, with a user-chosen destination.
- **ABSENT — QUEUE / PLAYLIST / AUTOPLAY-NEXT. MEDIUM.** CanonCore has ordered containers and
  placements, which is a richer structure than a playlist, but nothing turns an ordering into a
  play queue, and "what plays next" is undefined when an item sits in several orderings at once.
  This is the playback-side twin of the multi-placement problem and the prompt does not name it.

### 20. https://jellyfin.org/posts/android-v2.4.0
Nov 2021, small release. Adds Dolby Digital / Digital Plus / TrueHD / DTS / LPCM / AAC decoding
"allowing even more media to **direct play** on your device"; the player "now follows the
rewind/fast forward preferences selected in the Jellyfin settings"; connection timeouts handled
with a progress indicator "thus it won't be stuck on black screen anymore".
- **ADOPTED (corroborating)** — direct play coverage is a function of client codec support, which
  is precisely the prompt's stated reason for a native Swift player.
- **ABSENT** — server-stored playback preferences (skip interval) honoured by every client.
  **LOW**, but it is the same "no server-side user preferences store" gap as #14.

### 21. https://jellyfin.org/posts/android-v2.5.0
May 2023. Player detail, most of it in CanonCore's REFUSED zone but with two exceptions worth
recording.
- "**bitrate selection** so that you can transcode to lower resolutions" — **REFUSED**.
- "a new playback option was added to pick between **hardware and software decoding**, if the
  default hardware decoder causes issues" — **ABSENT — LOW**, but it is the direct-play escape
  hatch that does not require a server transcode.
- "allow choosing whether you want video with **SSA subtitles** to be transcoded (for full styling
  support) or not (**to direct play with limited styling**)" — an explicit, user-visible trade
  between fidelity and direct play. The prompt has no equivalent framing.
- "the subtitle settings in the Jellyfin settings only apply to the **web player** due to technical
  reasons" and there is "a link to the operating system's subtitle customization settings, which
  the integrated player uses" — subtitle styling is not portable across clients. Concrete warning
  for any product planning web + phone + TV.
- "the player now supports the **PGSSUB** codec without transcoding" — the prompt already names
  "no PGS subtitles" as an expo-video limitation, so this is **ADOPTED** reasoning confirmed.
- Splash screen, cancel-while-connecting, monochrome launcher icon: **ABSENT — LOW**.

### 22. https://jellyfin.org/posts/android-v2.6.0
Dec 2023, maintenance release. One capability: "the improved connection screen that now
**remembers your previously connected servers**, making it a lot easier to switch between them."
- Reinforces #15: multi-server memory in the client. **ABSENT — MEDIUM.**
- Otherwise a duplicate of the release-post template (contributors, Weblate, beta programme).

### 23. https://jellyfin.org/posts/android-v2.7
Aug 2026, the newest post in the shard and the densest for capabilities.
- **Offline downloads, redesigned**: "It is now possible to see all your downloads inside the app
  and play them. Video files are played with the app's own video player, other media types will
  open in a compatible external app. **The first time you download something, the app will ask you
  to choose a folder to store all your downloads in. Unfortunately, your existing downloads cannot
  be migrated.**" Roadmap: "**improved offline support where your watch state will be synchronized
  with the server once you're back online**."
- **Android Auto**: "You can now browse your large music libraries **without being limited to just
  250 results**" and "added support for **audiobooks**".
- **Player default flipped**: "Hidden in the app's settings is an option to change the app's video
  player implementation. Until now, this has always been set to the 'web' player ... Starting with
  version 2.7, that's changing. The **native video player is now the default**." A reversal a
  changelog reveals and no doc would.
- Native player gains: "**TrickPlay images while scrubbing**", a seek gesture, "supports **media
  segments for skipping**", "a better **fallback mechanism when a video fails to play**".
- "targets Android 16 (SDK 36) and supports Android's **per-app language preferences**, allowing
  Jellyfin to use a different language than the rest of your device."
- Deprecation rule with a number: "This release will be the last to support Android 5 and
  Android 5.1 due to updated vendor requirements. Based on our limited statistics, **this affects
  fewer than 1% of our users**. You'll still be able to use Jellyfin, but won't be able to receive
  future app updates."
- **ABSENT — OFFLINE DOWNLOAD + WATCH-STATE RECONCILIATION. HIGH.** See gaps. CanonCore's progress
  model is an append-only event log with a maintained state row, which is the *right* substrate
  for offline reconciliation, but the prompt never says progress can be recorded off-server and
  merged later, and event ordering/clock skew across devices is exactly where that design earns
  its keep or breaks.
- **ABSENT — MEDIA SEGMENTS (skip intro / skip credits / recap / commercial).** **MEDIUM.**
  CanonCore has timed intervals only as `edition_coverage`, which means "what part of the work
  this edition covers" — an entirely different axis. Skip-intro is the most-requested feature in
  this category and there is no place to put a segment.
- **TrickPlay: REFUSED by consequence.** Scrub-preview thumbnail sheets are generated by decoding
  the video; with "no transcoding, no ffmpeg" CanonCore cannot produce them. Worth stating
  explicitly, because it is a user-visible cost of the ffmpeg refusal that the prompt does not name.
- **ABSENT** — per-app language override, i.e. UI language independent of the device. **MEDIUM**
  (see i18n in gaps).
- **ABSENT** — a platform-support floor and a stated deprecation policy with a usage threshold.
  **LOW.**

### 24. https://jellyfin.org/posts/androidtv-v0.16.0
Dec 2023. Playback code rewritten from scratch, music first.
- "**media sessions**, this allows you to play/pause from other applications on your TV or even
  your smartphone" — OS-level transport control. **ABSENT — LOW/MEDIUM**, overlaps with the
  casting/remote-control gap (#13).
- "**Improved codec detection** should reduce transcoding and use direct play more often resulting
  in faster playback with less strain on the Jellyfin server." Third mention of codec detection as
  the thing that decides direct play — reinforces the **device profile** gap (#12, HIGH).
- Planned: "showing **lyrics**, enabling SyncPlay and **gapless playback** support."
  **ABSENT — LOW** each. Lyrics are structurally the same shape as subtitles (time-aligned text
  accompanying an edition), which CanonCore's `files` roles do not cover.
- **Screensaver** enabled by default in-app, and "works when the video player is paused".
  **ABSENT — LOW.**
- **Search**: "It will now **cancel any pending search requests while typing** and use a different
  method for getting the results ... a search on a large server is now noticeably faster and no
  flickering occurs anymore." **ABSENT — LOW** as a UI detail, but note the sizing implication: a
  catalogue of the prompt's stated scale (11,285 stories, 373,513 pages in the fixture archive)
  will hit exactly this.

### 25. https://jellyfin.org/posts/androidtv-v0.17.0
Aug 2024. "over 100 changes from 13 contributors."
- **Age-rating filter, on by default**: "The screensaver now includes a feature to filter items
  based on their age rating. **By default, only items with an age rating up to 13 will be
  displayed**, ensuring a family-friendly environment." **ABSENT — LOW.** Content rating as a
  *field* is just a statement in CanonCore's model; content rating as a *restriction* is a
  visibility system, which the prompt refuses outright until multi-user arrives.
- **Special features / extras**: "Series and seasons now display their respective special features,
  which were previously available only for movies." **ABSENT — MEDIUM.** Deleted scenes, behind-
  the-scenes, interviews and featurettes are files that belong to a work without being the work.
  In CanonCore they are neither an edition (they are not the same content differently rendered)
  nor obviously a separate `work` item, and the adaptation-versus-edition section — which is where
  this line would be drawn — does not mention them.
- **Audio normalisation** requiring "the **LUFS scan** for your music library" — **REFUSED by
  consequence**: a loudness scan means decoding every audio file, which the no-ffmpeg rule forbids.
- Third client-imposed server floor: "the app now requires **Jellyfin 10.9 or newer** and older
  versions are no longer supported." Reinforces the client/server compatibility gap (#17, MEDIUM).
- Search widened "to include results for Live TV channels, playlists, collections, photo albums,
  and individual photos" — search spanning every entity type at once. CanonCore scopes search by
  group and excludes entity kinds from work-browsing surfaces; whether *search* is a work-browsing
  surface is not stated. Small but real ambiguity in an existing rule.

### 26. https://jellyfin.org/posts/androidtv-v0.18.0
Nov 2024. The most specification-like release post in the shard.
- **Media segments, fully specified.** "A segment provides metadata for specific parts of a video
  or audio file. This can be used to mark an intro in your episode or the credits of a movie ...
  **All media segment types are supported: intro, outro, preview, recap and commercial** with
  three actions to choose from: **Skip** ('Immediately skips the playback forward to the end of
  the segment, or the next episode'), **Ask to skip** ('Shows a popup ... and **disappears after
  8 seconds**'), **Do nothing**." Default: "the app will ask to skip intros and outros".
  Segments are a *server* feature added in Jellyfin 10.10 and consumed by clients.
  **ABSENT — MEDIUM** (see #23). Note the type list is a five-value closed vocabulary, exactly the
  shape CanonCore uses for `medium` and file `role`.
- **Embedded subtitles.** "Previously the app did not support embedded subtitles and forced the
  server to extract them from video files first. This is a resource-heavy process and often causes
  subtitles to not show up or with a big delay. A workaround for this was to use the '**Subtitle
  Extract**' plugin that will do this extraction ahead of time."
  **ABSENT — HIGH, and this is the biggest structural finding on this page.** CanonCore models
  subtitles only as *sidecar files* ("a sidecar references the file it accompanies plus a
  language"). Real media carries subtitle and audio tracks *inside* the container. Enumerating
  them requires probing the file — and the prompt forbids ffmpeg. So CanonCore currently cannot
  know an MKV has three audio tracks and eight subtitle tracks, cannot offer track selection, and
  cannot tell the user why. See the "media introspection" entry in gaps.
- **Lyrics**: "2 types of lyrics are supported: **timed lyrics**, which will highlight the current
  line of the vocal track, and **untimed lyrics**, which will automatically scroll based on the
  track duration", sourced "by a plugin or on your file system". **ABSENT — LOW/MEDIUM**;
  structurally a fourth sidecar role alongside subtitle/audio/chapters.
- **Trickplay** shipped as an experimental preference, with the caveat "Make sure the Trickplay
  feature is enabled on your **libraries** for the previews to show up" — i.e. it is a per-library
  server-side generation job. **REFUSED by consequence** for CanonCore (needs ffmpeg).
- Sort key "last played" for TV shows. Minor; reinforces that sort keys are per-library settings.
- An experimental "Prefer FFmpeg for audio playback" toggle — a second decoder path in the client.

### 27. https://jellyfin.org/posts/androidtv-v0.19.0
Oct 2025.
- **"Are you still watching?"** — "When enabled in the app preferences it will ask you if you're
  still watching TV when **no input has been detected for a configurable amount of time or number
  of episodes**. If you don't choose to continue watching the app will automatically close the
  video player, **preventing entire series from being marked as watched overnight when you fall
  asleep!**" **ABSENT — MEDIUM, and it directly attacks CanonCore's progress rules.** The prompt
  fixes the completion rule (time remaining under a small absolute figure), the save interval
  (10s) and force-complete under five minutes — but never decides whether anything autoplays, and
  without an idle guard an unattended session writes a night of false watch events into an
  append-only log that is defined as the truth.
- **Device profiles, named explicitly**: "a new button in the advanced playback preferences to
  send a '**media capability report**' to the server. This report contains information about your
  device and its capabilities, together with the '**device profile**' that is sent to the Jellyfin
  server to decide whether transcoding or remuxing is necessary." Also "significant improvements
  in the detection of device **HDR** capabilities", with Dolby Vision requiring 10.11 and "media
  has to be **rescanned** for these changes to fully work". Reinforces the HIGH device-profile gap.
- **Two server versions supported at once**: "this app release supports both Jellyfin 10.10 and
  10.11, giving you the time to upgrade at your own pace." A softer compatibility policy than the
  hard floors in #17/#19/#25 — worth noting both shapes exist.
- **Voice search**; planned "search suggestions, in-library search". **ABSENT — LOW.**
- Music: manual seek and queue management "including remote control support". Photos: viewer now
  "shows the file and album name". Both **LOW**.
- Repeat of the Android 5 deprecation notice with the "less than 1%" threshold.

### 28. https://jellyfin.org/posts/archive
Chronological index of every blog post, 2019-12-25 to 2026-08-02. No product content. Useful only
as a map: it confirms this shard's blog set is complete and shows the cadence — roughly 8-12
posts a year, with server releases at 10.5.0 (2020-03), 10.6.0 (2020-07), 10.8.0 (2022-06),
10.9.0 (2024-05), 10.10.0 (2024-10), 10.11.0 (2025-10). Note the **two-year gap between 10.6 and
10.8** and the near-two-year gap between 10.8 and 10.9.
- No classification. Index page.

### 29. https://jellyfin.org/posts/authors
Author index with post counts and role titles: Jellyfin Team (1), 1hitsong (5, Roku Team),
Anthony Lavado (7, Core Team), dkanada (2), Fernando Fernández (1, Vue Lead), Izzie Walton (2,
Desktop Applications Lead), Joshua Boniface (16, Project Leader), Matt Carlton (1, Kodi Lead),
Max Rumpf (4, Android Mobile Lead), Niels van Velzen (14, Core Team, Android Lead), Tim Eisele (1,
Server Team), Jean-Pierre Bachmann (3, Server Team), Bill Thornton (3, Core Team, Web and iOS Lead).
- Not a product page. Only signal: **13 authors, 60 posts, and a named lead per client surface**
  — the organisational cost of the client matrix CanonCore's prompt explicitly weighs. LOW.

### 30. https://jellyfin.org/posts/authors/nielsvanvelzen
Author archive, page 1 of 2 for the Android lead (14 posts). Pure listing of posts already covered
individually (#7, #11, #12, #13, #14, #15, #16, #17, #22, #23, #24, #25, #26, #27). Duplicate.

### 31. https://jellyfin.org/posts/authors/nielsvanvelzen/page/2
Page 2 of the same author archive (posts 11-14: Android TV 0.13, 0.12, 0.11, F-Droid). Pure
pagination. Duplicate of #30.

### 32. https://jellyfin.org/posts/authors/thornbill
Author archive, Web and iOS Lead, 3 posts (State of the Fin 2026-01-06, iOS 1.7.0, iOS 1.6.0).
One line worth noting from the summary text: "Jellyfin for iOS is back with the first release in
**nearly 3 years**" — the maintenance cost of a client surface with one owner. Otherwise a
duplicate listing.

### 33. https://jellyfin.org/posts/client-infuse
May 2020, "Client Spotlight" for **Infuse** (Firecore), a **commercial third-party** Apple client
with official Jellyfin support. Capability list:
- "automatic server discovery"; "**direct playback (no transcoding required) for almost all
  formats**"; hardware-decoded H.264/H.265; "Direct play of 4K video with HDR"; "Dolby Vision
  (single-layer) and Dolby Atmos".
- "**Playback position sync with Jellyfin, and Trakt**".
- "**Sync videos for offline playback**"; "Adjustable playback speed"; "PiP and Split View support
  on iPadOS".
- Paywalled tier (Infuse Pro): "High res audio decoding (Dolby True HD, DTS-HD MA)", "**AirPlay
  and Google Cast** support".
- **ABSENT — SCROBBLING TO A THIRD-PARTY TRACKER (Trakt, Last.fm, ListenBrainz). MEDIUM.** This
  is the one place a media catalogue conventionally does push data outward, and CanonCore refuses
  export and cross-instance sharing in general terms without ever saying whether "send my watch
  history to Trakt" falls under that refusal. It probably does, but the refusal list does not name
  it and it is the first thing users ask for.
- **ADOPTED (strongly corroborating)** — a third-party native Apple client achieves "direct
  playback for almost all formats" by owning the decoder stack. Exactly the prompt's argument for
  native Swift on TV, made by a commercial product with a paid audience.
- Note the shape: an **existing, polished, paid client adopting a server's API** is precisely the
  leverage the prompt describes for OPDS/Subsonic — and Jellyfin got it *without* implementing a
  standard protocol, by being popular enough to be worth a bespoke integration. The prompt's
  argument holds for a new project; this is the counter-case at scale.

### 34. https://jellyfin.org/posts/client-jmp
April 2021, **Jellyfin Media Player** — desktop client that "takes the user interface from
jellyfin-web, including the playback interface, and combines it with the extensive codec support
from **MPV**", "Building on the open source foundation of **Plex Media Player**".
- "support for selecting **audio devices** and configuring **audio passthrough**"; "supports
  changing the **refresh rate of your display to match the video content**".
- "You can control the client with some **remote controls, game controllers, and media keys**
  through jellyfin-web's **TV display mode**, in addition to remote control through the Jellyfin
  mobile apps."
- "the `mpv.conf` file may be used to install **scripts and shaders**".
- "all features of the web client are available as usual, **including server management**. The
  client can connect to and **switch between multiple separate servers**."
- Distribution: Windows/macOS/Linux, "All release builds are automated through GitHub Actions",
  Debian/Ubuntu/Flatpak/AUR packages, Wayland.
- **DIVERGENT (important)** — "jellyfin-web's **TV display mode**" is the alternative architecture
  CanonCore's prompt argues against: one web UI with a ten-foot mode, wrapped in a native shell
  that supplies the decoder. The prompt commits to native Swift on tvOS for focus-engine and codec
  reasons and tells the reader not to re-argue it, so this is a deliberate divergence rather than
  a gap. Worth recording that Jellyfin's *own* desktop and TV story is web-UI-plus-native-player,
  and that this is also how the desktop client gets MKV/DTS/PGS coverage without writing a UI.
- **ABSENT** — audio device selection, passthrough, display refresh-rate matching. **LOW/MEDIUM**;
  all are the native player's business, but they are the reason people choose a desktop client.
- **ABSENT** — server administration *from inside a client*. **LOW.**

### 35. https://jellyfin.org/posts/client-mpv
Feb 2020, **Jellyfin MPV Shim**: "a lightweight **cast-only** client that allows you to cast
videos from Jellyfin to the MPV Media Player. It runs in the system tray."
- The casting flow named concretely: "Open the **Play On** menu in the Jellyfin web or mobile
  clients and select Jellyfin MPV Shim. Then play media normally. You'll be able to control most
  aspects of playback from the web application."
- The standout feature: "**there is a menu option that allows setting subtitles and audio
  preferences over an entire season of TV at once** ... instead of having to change the settings
  each time the episode changes."
- "full support for 10-bit HEVC video with subtitles" (anime is called out by name).
- "Use the Preferences menu to adjust the default playback settings and **remote video quality**."
- **ABSENT — "PLAY ON" / SERVER-MEDIATED REMOTE PLAYBACK. MEDIUM.** Same gap as #13 casting, but
  here the mechanism is visible: the server keeps a registry of connected sessions, and any client
  can direct playback to any other. That is a server-side concept (sessions), not a client one,
  and CanonCore has no session model at all beyond a single-password cookie.
- **ABSENT — TRACK PREFERENCES THAT PERSIST ACROSS A CONTAINER.** **MEDIUM.** "I want Japanese
  audio with English subtitles for this whole series" is the single most-requested preference in
  this category. In CanonCore's model the natural home is a statement on the *container* or on a
  *placement* — and placements being legitimate statement subjects is already a decided rule, so
  the substrate exists and nothing points at it.

### 36. https://jellyfin.org/downloads/server
Server download hub. Navigation only: Linux / Docker / Windows / macOS / .NET, plus a
site-wide **Unstable / Stable** toggle and a "Full Repository" link. No content.
- Duplicate of #2-#5. Only recorded signal is the two-channel release toggle (see #4).

### 37. https://jellyfin.org/downloads/windows
"Both installers (.exe) and manual ZIP archives (.zip) are provided." Tier: **Official**.
- **ABSENT** — Windows install artefacts. **LOW.** Same class as #5.

### 38. https://jellyfin.org/posts/client-videotape
Aug 2020 Client Spotlight for **Videotape**, a native UWP video player for Windows 10 and Xbox
that added Jellyfin support in its 3.0. Features: "Direct play almost all files, both from
Jellyfin and other local files", overlay/always-on-top modes, adjustable playback speed.
Carries an editorial update in place: "Update 2022-09-14 — Unfortunately this client is no
longer available on the Microsoft store."
- The Client Spotlight series is described as existing to "highlight some of the amazing
  projects created by our community".
- **ABSENT** — third-party client ecosystem and the editorial surface that promotes it.
  **LOW** (see #1). The dead-client update is the more useful signal: a curated directory is a
  standing maintenance obligation, and CanonCore's CMPP Store is the same shape.
- Note: "direct play almost all files" from a UWP player again confirms the prompt's reasoning
  that direct-play coverage is a property of the client's decoder, not the server.

### 39. https://jellyfin.org/posts/efcore-refactoring-incoming
Nov 2024, Project Leader. **The single most relevant page in this shard to CanonCore's
migration-ladder rule**, and it is a warning written from inside the failure.
Concrete statements, verbatim:
- "Our original database code was written by Emby in a time long before .NET Core existed ...
  it handled the database poorly: **SQLite queries embedded directly in the code, and a fairly
  horrific schema with no migration capabilities.**"
- Named consequences of that schema: "very slow search, problems adding new media types (or
  deprecating old ones), and lots of complexity inside the codebase around handling
  'non-standard' (i.e. not Movies/TV Shows/Music Albums) media types, resulting in bugs."
- "Once we merge this massive change set, **there will be bugs. This is certain.** And these
  bugs may completely trash your library database."
- The compatibility promise is asymmetric and stated as such: "Our primary goal will be to
  ensure that **stable-to-stable migrations between 10.10.x and 10.11.x will work without a
  hitch** ... The downside of this is, though, that we might not be able to cleanly implement
  **unstable-to-unstable** migrations in a way that will work properly. While we will try to do
  this, **we cannot guarantee it**."
- Recovery instructions given to users: "if you have a failing migration, **restore an older
  database version first and try to re-run it**. If it still fails, try your oldest (ideally,
  10.9.11 or 10.10.0 stable) backup as well."
- **ADOPTED (strongly corroborating)** — CanonCore's "MIGRATIONS ARE AN ORDERED,
  FORWARD-APPLICABLE LADDER FROM THE FIRST COMMIT ... Cheap now; expensive the moment anyone
  other than you is running it" is exactly the bill Jellyfin is paying here, ten years late.
  Note also the second half of the prompt's claim confirmed: the schema that could not migrate
  is also the schema where "problems adding new media types" and slow search live.
- **ABSENT — BACKUP AND RESTORE. MEDIUM.** Jellyfin's entire mitigation plan for a risky
  migration is "ensure you have a robust backup strategy" and "restore an older database
  version". CanonCore has a forward-only ladder and no reverse, which is the right call, but a
  forward-only ladder without a backup story means a failed migration on someone else's
  machine has no recovery at all. The prompt never mentions backup, restore, or a pre-migration
  snapshot.
- **ABSENT** — an explicit oldest-supported-version floor for migrations. See #40.

### 40. https://jellyfin.org/posts/efcore-refactoring
Jan 2025, Server Team. The follow-up that reports what actually happened.
- "all SQL builders that targeted SQLite directly have been removed from code."
- Rules with numbers: "Unstable builds will be temporarily turned off this week, **skipping the
  20250127 unstable to provide a full week of in-master testing**."
- **A hard migration floor, stated verbatim**: "The migration will aggregate the old
  `library.db` into the `jellyfin.db` file and then rename it to `library.db.old`, so the
  unstable builds **will no longer be compatible with the previous versions**. To migrate, we
  explicitly **do not support versions older than 10.10.3.**"
- "the current code does **not** add support for alternative database providers on its own ...
  when introduced, will likely remain **highly experimental** for quite some time."
- "we have not yet optimized the rest of Jellyfin to work with the new database access. That
  means it is possible that **unstable builds may be significantly slower**."
- "The new architecture also allows for a proper way of **backing up Jellyfin instances while
  they are running**, something that was previously impossible to do reliably."
- **ABSENT — A MIGRATION FLOOR / "OLDEST VERSION WE WILL MIGRATE FROM". MEDIUM.** CanonCore's
  ladder says "a released version can always migrate forward", with no floor and no expiry.
  That is a stronger promise than Jellyfin could keep, and it is unbounded: every migration
  ever written must keep applying to every schema state ever released, forever. Real projects
  bound it. The prompt should say whether it means "any released version, forever" or "the
  last N".
- **ADOPTED (corroborating, on ORM choice)** — "The new code uses EntityFramework migrations,
  which is the industry standard for database migrations in the C# ecosystem." CanonCore uses
  Drizzle, the same posture in the TypeScript ecosystem, rather than hand-rolled SQL.
- Note the *rename-not-drop* pattern (`library.db.old`): the destructive step is made
  recoverable by keeping the old artefact. Cheap, and CanonCore has no equivalent rule.

### 41. https://jellyfin.org/posts/ios-update-150
June 2022. A dependency upgrade forcing a platform floor: "With our next app release, we move
to **Expo 43**, which fully supports iOS 15, but must also **drop support for iOS 10 and 11**.
As a result, starting with version 1.5.0 of our Apple app, **iOS/iPadOS 12 or newer is
required**."
- The fallback advice offered to stranded users is itself a capability statement: "If your
  server is local (on your home network), try **VLC media player**. It still supports devices
  as old as iOS 9, and can access the **DLNA server built-in to Jellyfin**."
- Their own framing of the Expo choice: "It offers a unique take on a 'managed' React Native
  experience that allows anyone to develop an app for iOS, **even without using a Mac**. It
  allowed us to get an app out quickly, and **use the web interface that is a part of every
  Jellyfin install**."
- **DIVERGENT (deliberate, and worth recording)** — Jellyfin's iOS app is an Expo shell around
  the *web* interface. CanonCore's prompt chooses Expo for the phone app on the opposite
  reasoning (react-native-web is frozen; the web half is Next.js and separate). Both projects
  land on Expo for phone; only Jellyfin reuses the web UI inside it.
- **ABSENT — DLNA (or any standard discovery/streaming protocol) AS THE FALLBACK CLIENT PATH.
  MEDIUM.** This is the CLIENTS section's own argument arriving from the other direction:
  Jellyfin's answer to "our app no longer runs on your device" is a standard protocol that
  third-party players already speak. The prompt argues at length that implementing an existing
  client protocol (OPDS, Subsonic) is the highest-leverage client work in this category, then
  decides to build apps anyway and says not to re-argue it — but it never says whether
  CanonCore serves *any* standard protocol at all. That is a distinct question from "do we
  write apps", and it is unanswered.
- **ABSENT** — a dependency upgrade forcing an OS-support floor. **LOW** (same class as #23).

### 42. https://jellyfin.org/posts/ios-v1.6.0
Feb 2025. "Jellyfin for iOS is back with the **first release in nearly 3 years**."
Reasons given, all of them project-health facts rather than product ones:
- "the toolkit we use to build the app made some changes that essentially prevented my
  continued development of the app **without access to a modern Mac**" — resolved by expensing
  a Mac Mini from the open collective.
- "the build system provided by the toolkit we were using **had been discontinued**. We have
  now replaced that build system with a **fully automated GitHub Action workflow** that builds
  and publishes the app to TestFlight on demand." (Expo's classic build service being retired
  in favour of EAS, felt as a three-year outage.)
- Bug fixes worth noting as capability facts: "Removed an incorrect check for (e)ac3 audio
  support"; "Added user device name entitlement so the app can report the correct device name
  on iOS 16+"; "**Excluded unused features from the build so the app no longer requests access
  to permissions it doesn't need (like fitness data)**" — the same Expo-drags-things-into-the-
  binary problem as #10, four years later and still being cleaned up.
- Offline: "Few people are probably aware that I **started working on offline support 3 years
  ago**! Unfortunately it wasn't quite ready for this release."
- Floor pre-announced: "we will be updating our core dependencies which will force us to
  increase our minimum supported version to **iOS 15.1**."
- **ABSENT — CLIENT RELEASE AUTOMATION (CI that builds and ships the mobile binary). MEDIUM.**
  CanonCore plans three clients with one author. The three-year gap here was caused entirely by
  toolchain and build-pipeline rot, not by a lack of feature ideas, and the prompt's clients
  section reasons carefully about frameworks and never about how a binary gets built and
  shipped repeatedly by one person.
- **ADOPTED (corroborating)** — reinforces the prompt's own warning that Expo's build/tooling
  surface is a live risk, and gives a second concrete instance of an Expo dependency changing
  the shipped binary's declared permissions.
- **ABSENT** — a device-name / session-identification concept (the app "report the correct
  device name"). **LOW**, but it is the same missing session model as #35.

### 43. https://jellyfin.org/posts/ios-v1.7.0
Sept 2025. Downloads land on iOS.
- "Direct downloads of all media types are now supported ... an entry will appear in the new
  Downloads tab." From it users can "**Open downloaded media in the Files app**", "**Share
  directly to other apps (like VLC) for viewing/playing**", and delete. "downloaded media can
  be browsed directly from within the **Files app**."
- Permission-gated: "The download option will be presented in the standard UI **for users with
  appropriate server permissions.**"
- **Transcoded downloads**: "transitioned from an **experimental** to an **alpha** setting ...
  This feature enables transcoding of audio and video that cannot be played directly by the iOS
  media engine." Caveats stated: "Server-side support for transcoded downloads is currently
  very basic ... there are **no options to control download quality**, and in some cases,
  **transcoded files may be significantly larger than the original source files**."
- "State management within the app has been migrated to **zustand** from mobx, **resolving a
  major blocker for upgrading to the latest Expo and React Native versions**."
- "This release ... will be the last major update to support iOS 12."
- Transcoding-on-download: **REFUSED** ("No transcoding, no ffmpeg").
- **ABSENT — OFFLINE DOWNLOADS. MEDIUM-HIGH.** Third independent appearance in this shard
  (#18, #23, #42, now #43). See gaps.
- **ABSENT — HANDING A FILE TO THE OS / EXTERNAL APP (Files app, share sheet, "open in VLC").
  MEDIUM.** This is direct-play's escape hatch and it costs almost nothing: when the built-in
  player cannot decode a file, hand the bytes to something that can. For a product whose stated
  failure mode is "when a file will not play, say so plainly", handing off is the strictly
  better answer, and the prompt does not consider it.
- **ABSENT** — a per-user permission to download. **LOW** here (single owner), but it is the
  first sighting in this shard of granular per-user capabilities, which the prompt defers with
  "No visibility system ... Add it when multi-user arrives."
- Note the migration-off-mobx detail: a state library became "a major blocker for upgrading"
  the whole framework. Relevant to the prompt's Unistyles refusal, which is the same class of
  finding one release earlier in the chain.

### 44. https://jellyfin.org/posts/jellyfin-10-5-0
March 2020, "over 200 contributions and over 500 issues closed". Server + web release.
- **Fonts as an i18n decision**: "The web client now uses the **Noto Sans** font for all the
  languages we ship with ... ensures that **multilingual libraries look unified**. Jellyfin
  10.5.0 ships with the **Latin, Greek, Chinese, Japanese, Korean, Arabic, Cyrillic, Hebrew,
  Vietnamese and Devanagari** versions of the Noto font, optimized for the web."
  **ABSENT — MEDIUM.** Not UI translation: *item titles* in a catalogue are in whatever script
  the work is in. CanonCore's design tokens are plain TypeScript from commit one, which is
  exactly where a font stack lives, and the prompt does not mention one.
- **SSA/ASS subtitles rendered in the browser**: "Through the use of **asm.js and Web
  Assembly**, we now provide improved rendering for these formats ... Note that this feature is
  still experimental. If you notice lag ... you can enable **burn-in**." Client-side ASS
  rendering is the direct-play-compatible answer; burn-in is the transcode. **REFUSED** for
  burn-in; the WASM renderer is **ABSENT — MEDIUM** (see the subtitle gap, #7/#26).
- **Provider base URL made configurable, with the reason stated**: "MusicBrainz is now a
  **default plugin** and allows you to **configure the URL of the instance** you want to pull
  data from. This allows you to **host an instance of MusicBrainz and sidestep the global rate
  limiting** enforced by the main service."
  **ADOPTED (strongly corroborating)** — CanonCore's "a provider is a URL answering a contract"
  plus "BUNDLED DEFAULTS ... ALL DISABLED BY DEFAULT" is this design, generalised. Jellyfin
  arrived at it by necessity; the prompt starts there.
- "As part of a project to **move the core metadata providers to plugins**" — **ADOPTED**;
  same direction as "EVERY PROVIDER WE WRITE LIVES IN A SEPARATE REPO".
- "It is now also possible to **upload artwork in WEBP format**" — **REFUSED** ("No artwork
  uploads").
- "We now provide an extensive **Codec Support** list" as published documentation.
  **ABSENT — MEDIUM.** A direct-play-only product's single most important user-facing document
  is which files will play. The prompt says "when a file will not play, say so plainly" and
  never mentions telling anyone in advance.
- "help on **CSS Customization**, with examples ... to apply to your server via the
  Administration dashboard" — user-injected CSS. **ABSENT — LOW**, and arguably **REFUSED** in
  spirit (design tokens are plain TypeScript, not a themeable surface).
- ".NET Core 3.1 ... support for **ARM64** for Linux, compatibility with **TLS v1.3** and
  better garbage collection on Docker." **ABSENT — LOW** (runtime/arch support matrix).

### 45. https://jellyfin.org/posts/jellyfin-10-6-0
July 2020, "more than 500 pull requests". The densest server release in the shard.
- **SyncPlay** is the headline: "create rooms that other users or clients can join in order to
  share a common viewing experience. There is **no limit on the number of users in a room** and
  you are free to join the same room with the same user from **multiple clients**." Achieved "a
  delay between clients of only a couple of milliseconds". **ABSENT — LOW** (multi-user, so
  post-cap by the prompt's own logic), but note it needs the same session registry as #35.
- **The EF Core migration described from the inside, and it is a description of the
  antipattern CanonCore's model is built to avoid**: "Previously, Jellyfin used a combination of
  SQLite databases (**yes, multiple ones**), **XML files** and C# spaghetti to perform database
  operations. **Information was split in multiple places, sometimes even duplicated and
  generally filtered in C# instead of using the database engine's faster processing.**"
  And the cost: "our current inherited custom ORM **caching everything in memory** to make up
  for its slowness. For large databases, this could result in **hundreds of megabytes of memory
  lost to caching**."
  **ADOPTED (strongly corroborating)** — the prompt's load-bearing claim is that "the test that
  separates a sound attribute model from the antipattern is whether a metadata catalogue lives
  in the DATABASE rather than in code". Jellyfin's own post-mortem says the filtering lived in
  C#, and names it as the reason the thing was unfixable.
- "Your databases will be **automatically migrated** when you first launch Jellyfin 10.6 ...
  To prevent any data loss, please **backup your existing data files** before starting the
  migration process." Second independent sighting of backup-before-migrate (see #39).
- **Ebook reader shipped**: "improved support for ebooks by adding an **EPUB reader based on
  epub.js**. Reader support for more formats is in progress for future versions, including
  **CBZ/CBR and PDF**."
  **ABSENT — MEDIUM.** CanonCore's medium enum includes `text` and the demo ships Harry Potter
  novels, and "a renderer is needed only when a file is attached and someone presses play" is a
  standing rule — but text is one of only four playback media, so *some* text renderer is
  eventually mandatory, and epub/cbz/pdf are three different renderers, not one.
- **Blurhash**: "implemented **Blurhash** placeholder support on **both the server and the web
  client**." Structurally identical to CanonCore's palette rule — a small derived value computed
  once at fetch time and stored on the image row. **ADOPTED in pattern**, absent in kind.
- "a **configuration option for the number of items per page** in libraries" — pagination as a
  user setting. **ABSENT — LOW**, but at 11,285 stories it is not optional.
- "support for **multiple plugin repositories**" — **DIVERGENT.** CanonCore's distribution has
  four tiers with exactly one curated store plus arbitrary private URLs; Jellyfin allows
  arbitrary *repositories*, i.e. third parties running their own stores. The prompt's "ACCEPTED
  rather than open" is a deliberately narrower position.
- "rewritten **image viewer**" — again pictures as a first-class medium (see #7).
- Financial posture stated as a rule: "Jellyfin and its features will **never** be hidden behind
  a paywall ... won't give you any exclusive access to features or support, **nor will it change
  the priority of your feature requests**." **ABSENT — LOW** (see #9).
- Web build modernisation (Gulp, Babel, RequireJS → ES modules, "start our migration to Vue")
  is project history, not product. **LOW.**

### 46. https://jellyfin.org/posts/jellyfin-10-8-0
June 2022. "All of the changes, accumulated over **nearly the last two years**". A near-complete
changelog, and the richest single page in the shard for concrete rules.
Security and defaults:
- "**passwords are now hashed with 120000 iterations of PBKDF2-SHA512 instead of 1000 iterations
  of PBKDF2-SHA1**, old passwords are **migrated automatically on login**."
  **ABSENT — MEDIUM.** CanonCore is "one password, no signup" and the prompt never says how it
  is stored. The *migrate-on-login* pattern is the transferable part: a credential format cannot
  be migrated by the forward-only ladder because the plaintext only exists at login.
- "**disable DLNA server by default to avoid security risks**"; "**disable UPnP by default (only
  applies to new setups)**"; "add config option to **disable automatic server discovery**".
  **ABSENT — MEDIUM.** Two rules here: secure-by-default for anything that listens, and the fact
  that changing a default **only applies to new installs** — an existing instance keeps the old
  value. CanonCore's forward-only ladder will hit exactly this question the first time a default
  changes, and the prompt does not answer it.
- "**escape most HTML**" in the web client, and "allow **markdown** in login disclaimer".
  Reinforces the rich-text/sanitisation gap from #17. **ABSENT — MEDIUM.**
- "**return path to pinfile on password reset**" — recovery for a forgotten password via a file
  written on the server the owner already controls. **ABSENT — MEDIUM.** A single-password
  self-hosted instance with no email and no signup has no other recovery route, and the prompt
  does not mention one.
- "proper **network interface binding** and handling of **proxied requests**"; "proper handling
  of **published server URLs**". **ABSENT — MEDIUM** (reverse proxy / base URL / forwarded
  headers; third sighting, see #17).
Providers and import:
- Per-provider import policy knobs, all TMDb: "add ability to **disable adult content**", "make
  **tag import and maxCastMembers configurable**", "add ability to **configure image scale**",
  "add option to configure **season name importing**", "fetch TMDB **parental rating**", "enable
  fetching additional **series states**", "add ability to fetch **logos**".
  **ABSENT — MEDIUM.** CanonCore's enrichment has exactly two global numbers (the high and low
  thresholds) plus a global source order, and a group chooses *which* providers are asked. There
  is no per-provider import policy at all — no "take images but not cast", no cap on how many
  values one provider may propose. With "unmatched fields DROPPED AT THE DOOR AND COUNTED" the
  owner is told about fields that do not exist, but not given a way to decline fields that do.
- "add support for **TMDB absolute and TV order**" — Jellyfin exposing TMDb's alternate episode
  orderings. **ADOPTED (corroborating the product thesis)**: the prompt's reason #2 for
  CanonCore existing is that Jellyfin's TMDb episode groups "require renaming the files" and
  hard-lock one ordering. This line is Jellyfin adding a *second* ordering as a global toggle,
  which is precisely the one-ordering-at-a-time ceiling the prompt describes.
- "**improve metadata merging**" — the first-non-empty-wins merge the prompt refuses by name.
  **DIVERGENT (deliberate).**
- NFO block: "extended NFO metadata import", "**proper importing of watched state**", "proper
  parsing of ratings", "add support for fanart tag", "add parsing of additional ids".
  **REFUSED** — "no `.nfo` reading". Worth noting what is being refused: NFO is how users
  migrate *watch history* between servers, and the prompt refuses import wholesale.
- "refactor **extras** parsing (way faster)"; "display **series level extras** on series page".
  Second sighting of extras/special features (see #25). **ABSENT — MEDIUM.**
- "**external audio and subtitle support including container (mks, mka)**" and "extraction of
  attached fonts for subtitle transcoding/burn-in". Sidecars that are themselves containers, and
  fonts embedded in a subtitle track. **ADOPTED in part** — CanonCore's `files` roles cover
  media|subtitle|audio|chapters with a language; there is no `font` role and no notion that a
  sidecar can be a container holding several tracks.
- "enhanced detection and handling of **DVD/BD ISOs and folders**"; "**extended plain folder
  parsing**"; "refactor and harden parsing of plain folders (**all movies in one folder**)";
  "add **ID parsing from folder names**", "extend ID parsing from filenames".
  **ABSENT — MEDIUM.** This is the scanner's real job and it is mostly *filename and folder
  convention parsing*. CanonCore's scanner rules say what it must never do (never writes
  storage, no `.nfo`, no artwork scanning) and nothing about how it derives anything from a
  path. A multi-disc/ISO/folder-as-one-work case has no home in the file identity model, which
  is per-file SHA1.
Playback:
- "overhaul streaming logic to **only transcode incompatible streams**" — direct play preferred
  where possible; Jellyfin converging on CanonCore's default. **ADOPTED (corroborating).**
- "add **keyframe extraction** for better seeking (**WARNING: this is a really long running
  task**)" — **REFUSED by consequence** (ffmpeg). Note the user-visible cost: accurate seeking
  in a long file, alongside trickplay (#23).
- "**save playback speed between media**" — third sighting of speed control (see #16, #19).
- "**save pdf 'playback' on page finish**" and "**book player improvements and new Continue
  Reading section**".
  **ABSENT — HIGH. Progress for a text edition has no unit in CanonCore's model.** The prompt
  fixes completion as "TIME REMAINING under a small absolute figure ... Percentage is the
  fallback only where duration is unknown", saves every 10 seconds, and force-completes anything
  under five minutes. Every one of those is a clock. A book has no clock: its position is a page,
  a CFI or a byte offset, its "save every 10 seconds" is "save on page turn", and "force-complete
  anything under five minutes" is meaningless. `text` is one of only four media, the demo ships
  Harry Potter novels, and the archive's own medium field is full of prose works — so this is not
  an edge case. Jellyfin ships a separate **Continue Reading** rail for exactly this reason, and
  CanonCore's Continue Watching is defined as a single computed list.
- "add **rewatching** to next up" — re-watch as a first-class state. **ADOPTED (corroborating)**:
  the prompt's append-only event log exists precisely because "Jellyfin has a play count but no
  dates, and Plex's unscrobble zeroes the count. The event log is what makes re-watches real."
- "**unify duration display**"; "**add track sorting for videos**"; "fix album track sorting if
  audio files have **SortName** tags" — **ADOPTED**: `sort_name` is a column in CanonCore for
  this exact reason.
Platform:
- "proper generation and **publishing of OpenAPI spec**" — **ADOPTED**; the prompt keeps the
  oRPC OpenAPI handler for "a free OpenAPI reference".
- "add **health check** to Docker images"; "remove unused docker volume for /media"; "upgrade
  Docker images to Debian 11". **ABSENT — LOW/MEDIUM** (see #2, packaging).
- "**automatically migrate and cleanup config files**" — configuration itself carries a migration
  ladder, not just the database. **ABSENT — MEDIUM.** CanonCore's ladder is explicitly a
  *schema* ladder; nothing says what happens to on-disk config across versions.
- "properly name generated bundles for **cache-invalidation on update**" — **ABSENT — LOW**, but
  a stale client bundle against a new API is a real self-hosted failure mode.
- "**tackle accessibility issues**". **ABSENT — MEDIUM.** The prompt has one adjacent rule
  ("Every accelerator has an equivalent visible UI path") and no accessibility position, across
  three planned clients including a TV app whose entire interaction model is focus traversal.
- "splashscreen in **branding API** (although **not in use by any client yet**)" — a server
  supplying branding to its clients. **ABSENT — LOW.**

### 47. https://jellyfin.org/posts/jellyfin-apt-key
Nov 2020, operations notice. The project's Debian/Ubuntu repo signing key was about to expire:
"this was an oversight when we first set up this repo, and **we never provided any convenient
way to update this**. As a remedy, we've **removed the expiry on the key** ... This brings us
into line with numerous other 3rd-party Debian repositories, such as the Microsoft .NET and
Docker repositories which also use an **expiry-less key**." Users had to run a manual
`apt-key add` before December 15th "or you will find that `apt update` no longer works".
- **ABSENT** — package signing, key rotation and the fact that a self-hosted distribution
  channel carries a credential with an expiry date. **LOW** for CanonCore's first version
  (no distribution channel exists yet), but the underlying rule generalises: any expiring
  secret in a shipped artefact needs a rotation path designed before it is issued, and the
  project's own fix was to remove the expiry entirely rather than build the rotation.

### 48. https://jellyfin.org/posts/jellyfin-in-2019
Jan 2020, first-anniversary retrospective. Project history rather than product.
- Origin stated plainly: a fork of Emby, "Emby having just cut us off from their clients out of
  spite". "a truly FLOSS media server, one which **refuses to bow to the pressures of
  commercialization**."
- Scale figures: "5 'major' releases and over a dozen hotfix revisions" in 2019; Docker "with
  over **52 million pulls**"; "**over 20** plugins now available".
- The 2020 plan is the same database rewrite that finally landed in 2025 (#39/#40): "our
  long-term plans continue to include a **full database rewrite**, permitting far better
  performance, **backup/restore flexibility**, and support for additional database engines".
  It took five years. Worth recording next to the prompt's "Per-field provenance CANNOT be
  retrofitted ... exist from the first migration or they never work."
- Client history: "We started 2019 **without a single client**". Then four in a year, plus "an
  **iOS Expo App** ... currently in TestFlight Beta". Roku "had to be **started from scratch**,
  due to issues with the forked code". WebOS "**must be side-loaded**".
- "though work on our **new React client** has been slow, we have high hopes for this to replace
  most of the disparate clients we have now" — a plan to collapse the client matrix into one web
  client that never happened. **DIVERGENT (informative)**: CanonCore's prompt makes the opposite
  bet deliberately (Next.js web, Expo phone, native Swift TV) and tells the reader not to
  re-argue it; this is the record of the bet Jellyfin made and lost.
- **ABSENT** — a feature-request intake ("Our **Fider** feature request center"). **LOW.**

### 49. https://jellyfin.org/posts/jellyfin-release-10.10.0
Oct 2024. Stable release, with a **Breaking Changes** section written as rules.
- Backup, third independent sighting: "**ensure you back up your Jellyfin data and configuration
  directories before upgrading**. With a major release, it's possible you will hit a bug and want
  to revert, and **to do so, you will need to restore from a backup**."
- Client compatibility promise: "**Most clients should continue to work as-is** without any
  issues or any forced upgrades, though this may change in the future. The sole exception is
  Jellyfin4Kodi." A server release that does not break clients, stated as an intention rather
  than a guarantee. Complements the client-side floors in #17/#19/#25/#27.
- **Deprecation announced one version ahead of removal**: "we are looking to deprecate 32-bit ARM
  support ... **for 10.10.0 and later, with a goal to remove 32-bit ARM support in 10.11.0**."
  **ABSENT — LOW/MEDIUM.** A deprecation window is the only humane way to remove something from
  software other people run; CanonCore's constraint is "Do not preserve backward compatibility.
  Remove obsolete paths" with no notice period, which is right pre-release and wrong after.
- **Removal of a long-deprecated feature, executed**: "**Network paths in libraries have been
  fully removed and will no longer work.** This functionality has been deprecated for a long
  time ... Third-party clients relying on this functionality should be able to re-implement it as
  required." **ADOPTED (corroborating)** — this is CanonCore's "Remove obsolete paths instead of
  adding compatibility layers" actually carried out.
- **Fail-fast on a broken dependency**: "The server will now **refuse to start if `ffmpeg` cannot
  be found, is an incorrect version, or does not function properly** (missing extensions, etc.).
  With how critical ffmpeg is to Jellyfin, this has become very important to **avoid mis-reported
  issues**. **This can be explicitly bypassed if needed.**"
  **ADOPTED in pattern** — the prompt keeps "an env package validated at the top of next.config
  so a missing variable fails the BUILD and not the request", which is the same instinct one
  layer earlier. Note the escape hatch: even a hard check ships with a bypass.
- **A migration that blocks startup**: "Systems with Trickplay enabled may see a **relatively
  long migration occurring during the upgrade**. If Jellyfin seems to hang starting up after
  upgrading, please observe the logs and wait for the migration to complete."
  **ABSENT — MEDIUM.** CanonCore's ladder is "an ordered, forward-applicable ladder" and says
  nothing about *when* it runs, whether the app serves traffic during it, or what a multi-hour
  backfill over a 373,513-row archive does to a startup. With a wholesale read-projection rebuild
  in the design, this is a question the prompt will meet immediately.
- **Media Segments as a server feature, with the split named**: "we store some additional
  information for **certain time-spans on a video** that clients can then use to provide
  additional actions ... For 10.10, we only provide the **general structure to store** those
  Media Segments, and **you will still require a plugin to create them**. We have created one
  plugin that does this, **based on the Chapter names**."
  **ABSENT — MEDIUM** (see #23/#26). The structural point for CanonCore: this is a *provider*
  writing time-interval rows into a first-class table. Under CanonCore's rules "a provider may
  only propose values for fields that already exist" and "Only the product adds fields", so a
  segment table would have to be a product-defined shape before any provider could fill it —
  which is the right answer, and it means the table has to exist before it is needed.
- **Per-capability provider selection**: "It is now possible to **select which plugins can
  provide lyrics** to your music libraries, **similar to how you can select the plugins providing
  metadata**."
  **DIVERGENT / ABSENT — MEDIUM.** CanonCore decided a group chooses its providers wholesale and
  that "A GROUP CHOOSES ITS PROVIDERS; IT DOES NOT RE-RANK THEM". Jellyfin's finer grain is
  per-*capability* selection (metadata vs lyrics vs images), not re-ranking, so it does not hit
  the two-answers-on-one-page problem the prompt rejects re-ranking for. The prompt closes the
  ranking question and never considers the capability question.
- "client-side rendering of **PGS subtitles**" in the web client — the prompt names "no PGS
  subtitles" as an expo-video limitation; here the web client solves it in JavaScript. Reinforces
  that subtitle support differs per client (#21) and that PGS is not universally out of reach.
- "support for **CBT and CB7 books**"; "**auto-scrolling lyrics** as well as a **lyrics editor**".
  Text and lyrics renderers again (#26, #45). **ABSENT — MEDIUM** for the text renderer.
- Trickplay keyframe extraction "can boost image generating time significantly (**around 100x**)
  at the cost of some frame accuracy ... **must be explicitly enabled**". **REFUSED** (ffmpeg).
- **A published roadmap with dates**: "Target 10.11.z development window: **November 2024 to
  March 2025**. Target **feature freeze: second week of April 2025**. Target release date: **end
  April 2025**." With the candid admission "Our faster release cadence has generally been
  received fairly positively within the team, though **lack of structure has been a bit of a
  problem**." (Note against #6: 10.11.0 actually shipped October 2025, six months late.)
  **ABSENT — MEDIUM** (release cadence, see #6).


### 50. https://jellyfin.org/posts/jellyfin-release-10.11.0
Oct 2025. The biggest release in the project's history, and the single most useful page in this
shard. "over 6 months of development and another 6 months of RC testing, throwing our planned
6-month release schedule completely out of whack."
- **A REQUIRED UPGRADE PATH, stated as a rule**: "You **MUST be running Jellyfin 10.10.7** before
  upgrading to 10.11.0! ... Upgrading from any other versions is **NOT supported and WILL fail**;
  upgrade to 10.10.7 first, then upgrade to 10.11.0."
  **ABSENT — HIGH.** CanonCore's rule is "MIGRATIONS ARE AN ORDERED, FORWARD-APPLICABLE LADDER
  FROM THE FIRST COMMIT ... a released version can always migrate forward." Jellyfin, ten years
  in, could not honour that and had to publish a **stepping-stone version**. The prompt states
  the ladder as an invariant but names no mechanism that keeps it true: no floor version
  recorded in the database, no refusal to start when the on-disk schema is older than the oldest
  migration the binary still carries, no test that replays the whole ladder from empty. Without
  one of those, "always migrates forward" is an aspiration the first destructive migration
  breaks silently. This is the highest-value single finding in the shard.
- **THE MIGRATION IS THE RELEASE.** "MULTIPLE LONG-RUNNING MIGRATIONS that may take up to
  **several hours** depending on your library size and state. **DO NOT CANCEL OR INTERRUPT THE
  SYSTEM** during these migrations; let them run **overnight** if possible."
  And the reason it cannot be estimated: "a database with **300,000 entries but no issues** can
  migrate in a matter of **minutes**, while one with **just 30 series but severe inconsistencies**
  can take **multiple hours**." Cost scales with dirtiness, not with size.
  **ABSENT — HIGH**, and it lands directly on CanonCore. The archive is 373,513 pages / 518,768
  triples / 4.5M links, and the prompt's own FACTS section says imports are dirty and vocabularies
  need quarantine. A migration whose duration is a function of how corrupt the data is, run on a
  ladder that must apply cleanly, over a read projection rebuilt WHOLESALE, is the exact shape
  CanonCore has designed and the prompt says nothing about what the app does while it runs.
- **A ROLLBACK ARTEFACT MADE BY THE MIGRATION ITSELF**: "The upgrade will make a backup of your
  existing `library.db` file named **`library.db.old`**. This file can be used to recover should
  the upgrade fail ... **If you need to try the migrations again due to a failure, stop Jellyfin,
  rename this file back to `library.db`, then start Jellyfin again, and the migration will be
  re-attempted.**" A named, documented, user-executable retry path. **ABSENT — MEDIUM.**
- **THE MIGRATION MUST REPAIR, NOT JUST MOVE**: "the migration itself creates **proper relational
  cross-references in the database, including foreign keys, for the first time** ... The migration
  must not only restructure the data but **fix these logical corruptions and clean up any data
  that 'doesn't make sense' anymore**, for example **Media items with no parent** or **duplicated
  People data** for multiple sets of media."
  **DIVERGENT / partly ADOPTED.** "Media items with no parent" is precisely what CanonCore's
  "ROOT IS THE ABSENCE OF A ROW, never a parentless one" is designed to make unrepresentable, and
  "duplicated People data" is exactly what "ENTITY IDENTITY IS A SURROGATE ID ... NEVER A NAME"
  prevents. Both CanonCore rules are here vindicated by the ten-year cleanup bill of getting them
  wrong. Worth recording as corroboration, not as a gap.
- **A STARTUP UI THAT EXISTS ONLY TO SHOW THE MIGRATION**: "while Jellyfin was starting up and
  running through e.g. migrations, the system would **appear dead** ... The Startup UI changes this
  by providing a simple startup WebUI which is **only accessible in your configured local
  networks**, and which will display the current status of the startup process and log messages."
  **ABSENT — MEDIUM.** The answer to the previous two items: a second, smaller surface that serves
  while the real one cannot, scoped to the local network so it is not an exposure.
- **Internal backup and restore**, and its scope limit stated: "The backup and restore system
  **can only restore systems on which the backup was originally made**, so this is **not a tool to
  migrate** from other OS's or 3rd party containers." A backup deliberately not made into an
  export. **ABSENT — MEDIUM**, and note it does not violate CanonCore's "No fork, no export, no
  import" — this is same-instance restore, which that rule does not cover either way.
- **FREE SPACE AS A START CONDITION**: "If you have **less than 2GB of free space** in each data
  directory, Jellyfin now **refuses to start** to prevent data corruption. Additionally, checks
  are implemented to prevent certain **path misconfigurations** that are known to cause issues."
  Same fail-fast instinct as the ffmpeg check in #49, now with a number. **ABSENT — MEDIUM.**
- **Memory is now a stated cost**: "tuned to **aggressively cache metadata in memory** ... Jellyfin
  will use more RAM than before, **up to the full size of your Library database**." A read
  projection with an explicit memory budget. **ABSENT — LOW/MEDIUM**; relevant because CanonCore's
  projection is a first-class component and nothing says where it lives.
- **DEPRECATION ANNOUNCED ONE RELEASE AHEAD, TWICE MORE**: internal TLS/SSL "we are planning to
  remove in **Jellyfin 10.12.0**"; deprecated authorization methods "We're planning to remove old
  authorization methods in **10.12.0**", shipped with "a new option for developers to **test their
  client with deprecated authorization methods disabled**" — a *flag that lets a client verify it
  survives the removal before the removal ships*. **ABSENT — MEDIUM**, and the test-the-future flag
  is the non-obvious half.
- **ARM32 removal executed exactly as announced in 10.10.0** (#49). The deprecation window worked.
- **API deprecations named in pairs**: "`OnPlaybackStart`, `OnPlaybackProgress` and
  `OnPlaybackStopped` operations are now **deprecated**. Use the `ReportPlaybackStart`,
  `ReportPlaybackProgress` and `ReportPlaybackStopped` operations instead."
- **A 503 CONTRACT FOR CLIENTS**: "The server may now return **503 Service Unavailable** when a
  server startup/shutdown/restart is in progress. Clients should expect this code, **react to the
  `Retry-After: sec` header**, and retry the operation as needed."
  **ABSENT — MEDIUM.** CanonCore has three planned clients and a projection rebuild; a documented
  "I am not ready, come back in N seconds" is the cheapest thing that stops three client codebases
  each inventing their own retry.
- **Plugins lose raw SQL**: "All database access must now be done through EF Core. **Raw SQL will
  no longer be accepted by the server.**" **ADOPTED by construction** — CanonCore providers are
  URLs and never run in-process, so this failure mode cannot exist.
- **Per-library media segment providers**: "Media segment providers can be configured **per library**
  similar to other metadata providers." The per-capability provider selection from #49, now also
  per-library. **DIVERGENT** — CanonCore's group chooses providers wholesale and never re-ranks.
- "**Parental ratings have now moved to the new `ratingScore` property which allows for subscores**"
  — a scalar field replaced by a structured one. **ABSENT — LOW**; CanonCore has no ratings model
  and a `category` statement covers it.
- "**Lyrics now contain cues to allow timing for individual words**"; "Guest stars can be assigned
  roles, e.g., **Kelsey Grammer as Captain Morgan Bateson**." The second is CanonCore's
  `portrayed_by` with a qualifier, exactly. **ADOPTED (corroborating).**
- "When replacing files, Jellyfin will now **recognize this and prune related data** (chapters,
  trickplay files and extracted subtitles and attachments) on scan, making sure that these data
  will be **re-generated**, matching the new file." Derived data invalidated by file identity
  change. **ABSENT — MEDIUM**; CanonCore's file identity is content-hash based, which makes the
  detection trivial, but nothing says what derived rows a changed hash invalidates.
- Branding: "**custom CSS**", "**splash screen**", "extended disclaimer support". **REFUSED** in
  spirit (no visibility system, no shelf types, no theming decided yet).
- FFmpeg 7.1, HDR tone-mapping, AV1 VideoToolbox, Dolby Vision Profile 5. **REFUSED** (no
  transcoding, no ffmpeg).

### 51. https://jellyfin.org/posts/jellyfin-release-10.9.0
May 2024. "over two years in the making ... well over **1100 pull requests**."
- Backup instruction repeated verbatim for the fourth time. **ABSENT — MEDIUM** (see the gaps
  section; this is now a settled pattern, not a one-off).
- **PLATFORM SUPPORT NARROWED, WITH THE WORK PUSHED TO A THIRD PARTY**: non-LTS Ubuntu builds
  dropped; official RPM packages dropped entirely — "we suggest switching to the **3rd-party
  RPMFusion repository** ... Support for RHEL-like distributions has been a **major pain point for
  us for a very long time**, and we feel that **letting the community over at RPMFusion handle
  this is in our best interest**." Deliberately shipping less. **ADOPTED in spirit** (CanonCore's
  "CUT SCOPE INSIDE THIS REPOSITORY"), and a concrete precedent for how.
- **A CORE FEATURE DEMOTED TO A PLUGIN**: "**DLNA support is now provided by a plugin and has been
  removed from the core server.** ... it **will not be enabled for anyone unless they want it** and
  explicitly install the plugin; and third, it **reduces the potential of security holes**."
  **ABSENT — MEDIUM.** The reverse of the usual direction: moving surface *out* of the core to
  shrink the attack surface. CanonCore's providers-are-URLs boundary is the same instinct applied
  before the fact rather than after.
- **A FEATURE REMOVED FOR BEING A SECURITY RISK**: "The **EasyPassword (PIN) feature has been
  removed** as this was a big security risk especially for administrator accounts."
- "**User playlists are now private by default**" and "The **visibility of playlists can now be
  made private**". **REFUSED** — "No visibility system. Not a column, not propagation, not a
  resolution rule."
- "**Invalid items will be automatically removed from playlists.**" Silent membership deletion.
  **DIVERGENT.** CanonCore says the opposite: staleness "is a curation fact for the review queue,
  not a schema problem", and DELETE is "the one place data is actually lost", previewed with
  counts. Jellyfin's auto-prune is what CanonCore's review queue exists to avoid.
- "**Tags are now accounted for during searches**". CanonCore has no tag table (a tag is a
  `category` statement), so searchable tags fall out of statement search. **ADOPTED by
  construction.**
- ".NET upgraded to **version 8**"; "minimum FFmpeg version bumped from **4.0 to 4.4**";
  "SQLite database now supports **connection pooling**"; in-process restart replacing "the old
  hacky `restart.sh` method". Infrastructure. **REFUSED/N-A.**
- "**We're working on playlist sharing for a future release**" — cross-user sharing, **REFUSED**
  (single user, no multi-tenancy).
- Release cadence promise: "our plan is for the next major version (10.10.0) to be released **at
  most 6 months from now**" — kept for 10.10.0, missed by six months for 10.11.0 (#50).

### 52. https://jellyfin.org/posts/jellyfin-security-and-you
Nov 2023. Security release 10.8.13, and the most quotable governance page in the shard.
- **A SETTING DISABLED IN A PATCH RELEASE, KNOWINGLY BREAKING SEMVER**: the FFmpeg-path GUI option
  "has been **disabled**, and will be fully replaced in the next major version ... **Editing this
  value in the GUI in 10.8.13 or later will not change it.**" And, plainly: "**We are aware that
  this change violates Semantic versioning standards**, but after having several vulnerabilities in
  10.8 that either include or potentially include this endpoint as a vector, we have decided to
  remove it now."
  **ABSENT — MEDIUM.** A stated rule for when security outranks a compatibility promise. CanonCore
  has no versioning policy at all, which is fine pre-release, but the *reasoning* — say out loud
  which promise you are breaking and why — is the transferable part.
- The change is scoped so it cannot hurt existing installs: "The change **does not affect existing
  installs or non-default configurations** of this value; those are preserved, and **only future
  changes in the GUI are blocked**." Disabling the write path while leaving stored values intact.
  **ABSENT — LOW/MEDIUM**, and a genuinely clever pattern.
- **THE ADMIN-IS-SHELL RULE, verbatim**: "granting administrator access to a Jellyfin server is, in
  many ways, **tantamount to granting them shell access**. An administrative user has the power to
  do many dangerous and destructive actions ... **plugins may also grant even more access, including
  full shell access should the plugin decide to.**"
  **ADOPTED by construction, and it is the load-bearing justification for CanonCore's provider
  design.** CanonCore's "A provider is a URL answering a contract — not a plugin, not a repo, and
  never code running inside the app" is exactly the refusal of the second sentence. This page is
  the primary-source evidence for why that decision is right; it is the project that took the
  other path saying so itself.
- "we recommend that you **do not use an administrative user for day-to-day usage**." A privilege
  split. **REFUSED/N-A** — one owner row, no roles, by decision.

### 53. https://jellyfin.org/posts/jellyfin-xbox
Apr 2020, later edited in place. **A CLIENT WITHDRAWN FROM A STORE**: "Due to **long standing
issues** with this current release of the Xbox client beta, and **incompatibility with the latest
release of Jellyfin**, we've made the decision to **remove it from the store**. We hope to return
soon, with an updated client. In the meanwhile, please try using the **Edge browser**, or Kodi."
- **ABSENT — MEDIUM.** A client that falls behind the server becomes a support liability and the
  remedy was deletion plus a redirect to the web UI. CanonCore plans three clients from one
  contract and has no statement of what happens when one of them cannot keep up — and note the
  fallback offered here is the browser, which is exactly CanonCore's day-one client.
- Notable that the announcement post was **rewritten to lead with the retraction** rather than
  taken down; the original text survives underneath.

### 54. https://jellyfin.org/posts/kodi-0-5-0
Mar 2020, third-party-platform client release. Kodi 19 "Matrix" / Python 3 support; "sync times
well below half of their previous values"; full notes deferred to GitHub.
- One hard upgrade rule: "please make sure you are either **upgrading from version 0.4.1**, or
  **restart Kodi after upgrading** to 0.5.0. There are some **incompatibilities with new libraries
  that can't be resolved at runtime** and require either the previous version or a restart."
  Another stepping-stone constraint (#50), here at plugin scale. Reinforces the HIGH rating there.
- Otherwise a client-sync page with nothing CanonCore-shaped.

### 55. https://jellyfin.org/posts/mirrorbits-cdn
Apr 2021, 16-minute infrastructure write-up. How the project built its own download CDN with
VideoLAN's Mirrorbits after 10.6.0 exposed slow global downloads: an origin VPS (`build1`,
Toronto) plus four geographic mirrors (Toronto, San Francisco, Frankfurt, Singapore), rsync
daemon on port 873, cron sync every 15 minutes at deliberately offset times ("12,27,42,57") so
third-party mirrors syncing on the hour are never behind, NGiNX + Let's Encrypt, and the repo
split into two rsync components (`mirror` = stable only, excludes `*unstable* *archive*`;
`mirror-full` = everything).
- Stated refusal of the easy answer: "I wasn't content to simply throw **CloudFlare** in front of
  the repo ... I wanted something we could control."
- The rsync endpoint is left deliberately open: "since we wanted to open this up to anyone, I left
  the rsync endpoint **completely exposed**. Thus, if you want to host a local Jellyfin mirror -
  you can."
- **ABSENT — LOW** for CanonCore, which has no binary distribution channel and one demo instance.
  Recorded because it is the third piece of evidence (with #47 and #59) that this project spends
  real engineering on *distribution* rather than on the product, which is a cost CanonCore avoids
  entirely by being source-first with no signed artefacts.

### 56. https://jellyfin.org/posts/new-ci-new-repo
Mar 2024, 15-minute post. Rebuild of the whole release pipeline ahead of 10.9.0. Mostly project
infrastructure, but three items are transferable.
- **THE BUS-FACTOR ADMISSION, verbatim**: "Major releases would often take me **over 20 man-hours**
  to prepare for and execute, while point releases would take **at least 4-6 hours** ... **No
  project should be so dependent on one person, but we were, for a very long time.**" The fix was
  automation of the administrative half (changelogs, version bumps, release drafts, release posts)
  via a chatbot, explicitly so "it can easily be performed by others".
- **NO BETA OR RC TAGS FOR A CYCLE**: "we will **not be producing explicit 'beta' releases**.
  Instead, we will test using our new **Weekly Unstable builds**." The reason is a merge-direction
  problem worth quoting: it avoids "the major burden we found with 10.8.0 of trying to
  **continually backport the fixes** for the upcoming stable release back into master, while also
  **forward-porting bugfixes in the other direction** when they were accidentally mis-targeted."
  **ADOPTED (corroborating).** This is CanonCore's CLAUDE.md rule "The PR branch is the integration
  branch ... Merge ticket branches into it, verify there, and only then to `main`" arrived at from
  the opposite direction, by a project that let two long-lived branches diverge and paid for it.
- **UNSTABLE CADENCE CHANGED TWICE, IN BOTH DIRECTIONS**: nightly → per-merged-PR (#59, 2020) →
  **weekly** (here, 2024), because per-PR builds "were effectively **unusable for normal people**
  as they changed so often", and daily "felt a little too quick". A reversal the docs never
  mention. **ABSENT — LOW.**
- Also: unified packaging into one repo consuming the two code repos as submodules; per-distro
  package suffixes (`-deb12`, `-ubu2204`) "to ensure smooth dependency handling for shared
  libraries like LibSSL"; non-development packaging removed from the main repos "leaving just a
  simple Dockerfile".

### 57. https://jellyfin.org/posts/new-forum
Jun 2023. Community-infrastructure post: a new MyBB forum, and the permanent closure of the
subreddit after Reddit's third-party-client API changes. Reasoning is about platform dependence
("not beholden to other platforms and their whims"), forum software choice (phpBB vs MyBB;
Discourse rejected as "gamified"), a four-tier moderation structure, and the forum's category
layout. Nothing product-shaped.
- One incidental fact worth carrying: feature requests live on a separate **Fider** instance and
  the forum only hosts long-form discussion *about* them. Third sighting of Fider (#48). CanonCore
  has no feature-request intake and needs none. **ABSENT — LOW.**

### 58. https://jellyfin.org/posts/new-website
Oct 2022, two-minute post. Three repos (`jellyfin-blog`, `jellyfin-docs`, `jellyfin.github.io`)
merged into one `jellyfin.org` repo, migrated to Docusaurus, old site left up at
`old.jellyfin.org`. Pure project housekeeping; explains why every page in this shard has the same
shell. Nothing for CanonCore.

### 59. https://jellyfin.org/posts/packaging-updates
Jun 2020. The 10.6.0 packaging rework, and the origin of several things later reversed.
- **SPLIT BUILDS**: server and web built independently, then recombined into a `jellyfin`
  **metapackage / metaimage** whose only function "is to have dependencies on these two component
  packages". Users keep installing one thing.
  **REVERSED in 2024** (#56): "we now provide **just a single image**, `jellyfin/jellyfin`, that
  was built all at once and **does not rely on two intermediate images**, another very error-prone
  process." Four years of split-then-recombine, undone. A clean instance of a decomposition that
  cost more than it bought.
- **UNSTABLE BUILDS INTRODUCED HERE**, per merged PR, replacing nightlies — "build 'unstable'
  releases for **every merged PR**" — the exact thing #56 later calls unusable. Versioned as
  `[date].[id]` (e.g. `20200620.12`) so a binary names the CI build that made it.
  **ABSENT — LOW/MEDIUM**: a version string that resolves to the exact commit/PR is cheap and is
  the thing that makes a bug report actionable; CanonCore says nothing about build identification.
- A genuine trap documented: enabling the unstable APT component gives you "very high" version
  numbers, so "**to disable unstable builds, you must remove this extra line, run `apt update`,
  remove the old package(s), then install the stable version**" — a channel you cannot leave by
  reversing the switch that put you in it. **ABSENT — LOW**, but the general rule (a
  one-way-by-accident setting is a bug) is worth having.

### 60-65. Blog index pagination (6 URLs)
`https://jellyfin.org/posts/page/2` · `https://jellyfin.org/posts/page/3` ·
`https://jellyfin.org/posts/page/4` · `https://jellyfin.org/posts/page/5` ·
`https://jellyfin.org/posts/page/6` · `https://jellyfin.org/posts/page/7`

Blog index pages 2 through 7, ten posts per page, newest first, each entry showing title, date,
read time, author and the post's lede. No content of their own; every post they list is covered
individually elsewhere in this sweep. Page 7 holds a single post (25 Dec 2019, #104), which fixes
the corpus: **61 posts over seven years**, roughly nine a year.
- One structural observation worth keeping: the index shows the **lede paragraph**, not an excerpt
  cut at N characters, so every release post opens with a hand-written summary that reads
  correctly out of context. **ABSENT — LOW.**

### 66. https://jellyfin.org/posts/plugin-updates
Jul 2020. Third-party plugin repositories introduced, and the closest thing in this shard to
CanonCore's provider-distribution question.
- **REPOSITORIES ARE JUST URLS TO A JSON MANIFEST**: "the only required change is a **JSON manifest
  at any location** with versions that point to **binary releases at any location**. **We don't
  require any specific method for hosting these files, as that would go against the ideals of the
  project.**" And the official one can be deleted: "**Even the official repository can be removed**
  if you'd prefer to avoid external calls to our server."
  **DIVERGENT, and the divergence is deliberate on CanonCore's side.** CanonCore's four-tier
  distribution has BUNDLED DEFAULTS (all disabled), a **CMPP STORE that is "ACCEPTED rather than
  open. Curated."**, private URLs, and single-licensee providers that never leave the instance.
  Jellyfin's model is tier 3 only, for *executable code*. Recording it because it is the concrete
  alternative CanonCore rejected: uncurated + arbitrary hosting + binaries, which is precisely the
  combination that makes the "admin is shell access" warning of #52 true.
- The manifest shape is worth having as prior art for the CMPP store's index: `category`, `guid`,
  `name`, `description`, `owner`, `overview`, and a `versions` array of
  `{checksum, changelog, targetAbi, sourceUrl, timestamp, version}`.
  **`targetAbi` is the interesting field** — each plugin *version* declares the minimum server
  version it runs against, so compatibility is data in the index rather than a runtime failure.
  **ABSENT — MEDIUM.** CanonCore's providers answer a contract over HTTP, and nothing in the prompt
  says how a provider declares which contract version it speaks. The prompt requires "same search,
  lookup and browse shapes, same claim structure, same failure modes" proven by a test across two
  providers — that test pins the contract at one version and says nothing about the second one.
- "the **GUID must be unique** (both in the manifest and the plugin itself) if you want to avoid
  conflicts with other plugins" — identity minted by the author, collisions unpoliced.
  **DIVERGENT**: CanonCore's providers are keyed by URL, which is unique by construction.
- **A MANIFEST FORMAT CHANGE THAT SILENTLY STRANDS OLD SERVERS**: "You can also find the
  **deprecated manifest** on the same domain for the old format. However, **all new plugin updates
  will go to the new manifest, so older versions of Jellyfin won't receive plugin updates.**"
  Two live index formats, with the old one frozen rather than removed. **ABSENT — LOW.**
- ABI breakage listed as a bare rename table (`IExternalID.Name -> IExternalID.ProviderName`,
  `MediaBrowser.Controller.Entities.User -> Jellyfin.Data.Entities.User`, and six more). This is
  what "a plugin is code in your process" costs at every release. **REFUSED by design.**

### 67. https://jellyfin.org/posts/release-roadmap-10.10.0
Sep 2024. **The most transferable process document on the site**: a release run as a sequence of
named freezes, each landing on a dated weekly unstable build.
- The ladder, verbatim in structure: **Feature PR last-call** (Sep 9) → **Feature freeze** (Sep 16,
  "Any new feature PRs after this point must wait until 10.11.0 (in another ~6 months)") → **API
  freeze** (Sep 23, "API is now soft-frozen so that **client developers can begin confidently
  working on any client support changes**") → **API lock** (Sep 30, "Only non-API-changing bugfixes
  after this point") → final unstable (Oct 7) → release (Oct 12).
  **ABSENT — MEDIUM/HIGH.** The API freeze is the part CanonCore actually needs. The prompt commits
  to three clients built against one contract and to a public demo, and the whole client argument
  ("direct-play-only makes client codec coverage load-bearing") assumes a contract the clients can
  target. There is no moment in CanonCore's process at which the contract stops moving, which is
  the thing that makes parallel client work possible at all — and CLAUDE.md's parallel-worktree
  model has the same shape one level down.
- **THE SLIP IS BUILT IN, AND NAMED IN ADVANCE**: "if we find it's not, **we reserve the right to
  add an extra week in one or both of the following places**: After the Feature freeze ... After
  the API lock", with the resulting dates enumerated. Then, editing the same post: "**EDIT
  2024-10-12: We have opted to take the two week delay** due to pending changes in Web."
  A schedule that pre-declares where it may slip and then slips exactly there. **ABSENT — MEDIUM.**
- **NO DOWNGRADE, STATED AS A PROPERTY OF THE DATABASE**: "ensure that you **back up your existing
  server configuration**. **It is not possible to downgrade in-place as there are database
  changes.**" Fifth sighting of the backup rule, and the first that gives the reason in schema
  terms rather than as caution.
- **A SEPARATE PLUGIN MANIFEST FOR PRE-RELEASE BUILDS**: "Due to compatibility issues, we
  distribute plugins for unstable in a **separate manifest**, so this must be added manually ...
  We also recommend that you **disable/remove the Stable repository** at this time, as it's
  possible they will conflict."
  **ABSENT — MEDIUM.** The generalisation for CanonCore: a pre-release server and the third-party
  extensions built for it need a *parallel index*, because the same index cannot serve two contract
  versions. Pairs with `targetAbi` in #66.
- Bug-report requirements: include the exact "**Build Version**" from the dashboard, and say
  whether this is an upgrade or a fresh install. Cheap, and both are things a self-hosted app must
  surface deliberately. **ABSENT — LOW/MEDIUM.**
- "Bugfix PRs will target the **master** branch until the final release, at which point they will
  target the **release-10.10.z** branch." The branch model the project later says caused it real
  pain when maintained across a long cycle (#56).

### 68. https://jellyfin.org/posts/roku-163
Jan 2023, Roku client 1.6.3. Mostly a bug list, three items worth keeping.
- "Fix **TV season list crash when showing 27+ episodes**" — a client that fell over on ordinary
  container sizes. A reminder that "a container holds N members" is a real limit somewhere.
- "Create **'What's New' popup that tells users what's changed the first time they run a new
  version**" — in-app release notes as a feature. **ABSENT — LOW.**
- "**Draw homepage continue watching percent complete bar** instead of using image API" — the
  progress bar had previously been rendered *server-side into an image*. **DIVERGENT** and worth
  noting against CanonCore's "Continue Watching is computed, never stored": Jellyfin's version was
  not merely stored, it was baked into a bitmap.
- "Set maximum bitrates values based on Roku guidelines"; "Hide subtitles that might transcode".
  **REFUSED** (no transcoding).

### 69. https://jellyfin.org/posts/roku-164
Apr 2023, Roku 1.6.4. "**Requires minimum server version of 10.8.1**" stated at the top — the
client-floor pattern seen throughout this shard (#17/#19/#25/#27/#49). Contents are bug fixes,
new filters (genres, parental ratings, years), phase-1 CJK subtitles and phase-1 playlists.
- "Show '**Actor**' when an actor has no role" — a display fallback for a missing qualifier value.
  Small, but it is exactly the shape of CanonCore's `portrayed_by` + qualifier: the qualifier is
  frequently absent and the UI needs an answer for that. **ABSENT — LOW.**
- Notable process detail: "Make CI **throw error for duplicate translation entries**" and "Add
  workflow to **validate XML translation files**" — schema checks on content files, in CI.

### 70. https://jellyfin.org/posts/roku-200
Dec 2023, Roku 2.0.0. A ground-up rewrite: "updating **every single file in the app** to support a
new programming language". Three findings.
- **THE NEAREST THING JELLYFIN HAS TO EDITIONS, AND ITS ADMISSION**: "**TV Episode Version
  Support** — Have different versions of a TV episode? You can now select and watch the version you
  want ... **Note: As of this writing, the only way to generate episode versions is in the Android
  app or using the API.**"
  **DIVERGENT — and it corroborates the prompt's reason for editions existing.** Jellyfin has a
  version picker with no way to create versions from the main UI, reachable only through one
  client or by hand against the API. CanonCore makes editions a first-class table with a declared
  order and an owner pin; this page is what the alternative looks like after the fact.
  Also note the chained-selection wart: "If one of the Videos has different audio options, the user
  must **select the desired video version, exit options, then press \* again** to see the updated
  audio options" — the audio track list depends on which version is picked, and the UI cannot
  express that in one pass.
- **A CONCRETE QUEUE CAP**: "Simply highlight an item and press play ... The client will then
  **queue up to 2000 items** and start playing." **ABSENT — LOW**, but it is the only hard
  collection-size number anywhere in this shard.
- "**Search Honors Library Permissions.** If a user doesn't have access to a library, items in that
  library are no longer returned in search results" — shipped as a *feature in a client release*,
  meaning search results had been leaking across the permission boundary until then.
  **ADOPTED by construction and worth recording as a warning.** CanonCore refuses a visibility
  system outright and its public read path "NAMES every field it emits", which removes this class
  of bug — but the same rule has to hold for *search*, and the prompt only ever describes the read
  path in terms of an item payload. Search is a second read path.
- "**Boxsets now sorted by release date by default**" — an ordered container falling back to a
  derived sort. CanonCore's placements carry explicit positions and a rule-derived container
  "carries NO order", so this case is closed already. **ADOPTED.**

### 71. https://jellyfin.org/posts/roku-300
Mar 2025, Roku 3.0.0. The densest client release in the shard.
- **THE TAXONOMY ADMISSION, verbatim**: "**Audiobooks are books (though there's discussion about
  changing that in Jellyfin), but not all books are audiobooks.** Jellyfin on Roku now has basic
  audiobook support so you can listen to your collection."
  **ADOPTED — this is the strongest external corroboration of the prompt's edition/medium split
  found in this shard.** Jellyfin's item type has to be *either* book or audiobook, so the audio
  rendering of a text work is a different kind of thing from the work, and the project is openly
  arguing with itself about which. CanonCore already answers it: one `work` item, editions with
  `medium` in (video|audio|text|image), and "MEDIUM IS A PLAYBACK MEDIUM, NOT A WORK TAXONOMY".
  The prompt's Harry Potter case (three audio renderings as three editions) is the same shape.
  This page is the counterexample: what happens when medium is baked into the item type instead.
- **A WATCH-LATER LIST**: "**My List — Your Own Personal 'Watch Later' list** ... Currently, **only
  video files are supported** by My List."
  **ABSENT — MEDIUM.** CanonCore has Continue Watching (computed, no dismissal, offered never
  auto-played) and nothing for intent-to-watch. It is not the same thing: Continue Watching is
  derived from progress and cannot hold an item you have never started. Under CanonCore's own rules
  the answer already exists — a `category` statement sourced to the Owner, or an ordinary
  hand-placed container — which is worth writing down before someone adds a table for it.
- **Media segments consumed on the client, with the policy in client settings**: "the video player
  will recognize the segments and take whatever action you set in the Roku settings. **Auto-skip?
  Display a skip button? Nothing? You have the power to decide.**" The server stores the intervals
  (#49) and the client decides what to do with them. **ABSENT — MEDIUM** (fourth sighting; see the
  gaps section).
- **Subtitles downloaded to the server from the client**: "click the manage subtitles button ...
  search for subtitle files to download and use. The selected subtitle file will **download to your
  server** ... **Note: the manage subtitles button will only display for users who are allowed to
  edit subtitles.**" A client action that writes to server storage.
  **REFUSED, twice over** — "The scanner NEVER writes storage", and CanonCore fetches nothing but
  provider metadata through the Safe External Fetch boundary.
- "**Force Transcoding Options** ... Sometimes you have media Roku believes it can directplay, but
  can't." **REFUSED** — CanonCore is "Direct play only ... When a file will not play, say so
  plainly", and this page is exactly the failure mode that rule accepts: the device lies about what
  it can decode. Worth knowing the prompt's answer here is "say so plainly", not "force it".
- Trickplay tile geometry as a device-dependent setting: "Older Roku devices ... will likely
  require your trickplay tiles be a **5x5 grid and not the default 10x10 grid**." **REFUSED**
  (ffmpeg).
- Timed lyrics; audio mini-player; an item option menu bound to `*` because "**On Roku you can't
  right-click on an item to get an option menu, so we made one using the `*` button**".
  That last is CanonCore's standing rule inverted — Jellyfin invented an accelerator *because*
  there was no visible path. **ADOPTED (contrast)**: "Every accelerator has an equivalent visible
  UI path."

### 72. https://jellyfin.org/posts/roku-v1.5.0
Jul 2022, Roku 1.5.0. Short feature list: Quick Connect, music playback, network/genre views,
pre-roll videos, and five new user settings including "Use splashscreen image as home background"
and "Blur unwatched episode images". Client preferences and cosmetics; nothing model-shaped.
- "Transcoding issue resulting from **10.8.0 server update**" listed under bugs — a server release
  breaking a client, which is the risk #49's compatibility promise is about.

### 73. https://jellyfin.org/posts/SQLite-locking
Oct 2025, 8-minute engineering post by the developer who did the EF Core conversion. The most
technically substantive page in this shard after #50.
- **THE ROOT CAUSE WAS THE SCANNER, NOT THE DATABASE**: "In versions prior to 10.11 Jellyfin had a
  **bug in its parallel task limit which resulted in exponential overscheduling of library scan
  operations** which hammered the database engine with **thousands of parallel write requests** that
  an SQLite engine is simply not able to handle. That and **very long running and frankly
  unoptimized transactions** could lead to the database just being overloaded."
  **ABSENT — MEDIUM/HIGH.** CanonCore has a scanner, a wholesale projection rebuild, and an
  enrichment pass that "reaches ALL connected providers at once" — three unbounded fan-outs — and
  the prompt sets no concurrency limit anywhere, for anything. The lesson here is not about SQLite:
  it is that an unbounded parallel scan is a *self-inflicted* load spike that looks like a database
  fault, and that it went undiagnosed for years because it only manifested on some machines.
- **THE FAILURE WAS NON-DETERMINISTIC AND THAT WAS THE WORST PART**: "it does **not happen
  reliably**. So far we only have **one team member where this can be (somewhat) reliably
  reproduced** which makes this an even worse a bug ... this issue happens **across all operating
  systems, drive speeds and with or without virtualization**. So we do **not have any deciding
  factor identified**."
- **THREE SELECTABLE LOCKING STRATEGIES, with the default chosen against the fix**: No-Lock,
  Optimistic, Pessimistic. "As a default, the **no-lock** behavior does exactly what the name
  implies. **Nothing.** This is the default because my research shows that **for 99% all of this is
  not an issue** and every interaction at this level will slow down the whole application."
  Optimistic = retry via **Polly**, "and will **only retry operations it will find have been locked
  due to this exact issue**". Pessimistic = a **`ReaderWriterLockSlim`**, "**Jellyfin can only ever
  perform a single write to the database**, even if it technically does not need to ... unlimited
  reads concurrently while only one write may ever be done."
  **DIVERGENT (mostly not applicable).** CanonCore is Postgres via Drizzle, so file-lock contention
  is not its problem. Two things do transfer: a *narrow* retry that only retries the one error class
  it understands, rather than a blanket retry; and shipping a correctness/performance trade-off as
  a **setting whose default is the fast one**, with the safe one available to the minority who need
  it. Both are worth having and the prompt has neither. **ABSENT — MEDIUM** for the narrow-retry
  rule specifically.
- WAL explained correctly and then honestly qualified: "This is **not a foolproof solution**; there
  are still scenarios where WAL does not prevent locking conflicts."
- Written to be reusable: "Jellyfin's implementation of the locking behaviors should be a
  **copy-paste solution** for everyone having the same issues as it's using interceptors and **the
  caller has no idea of the actual locking behavior**." The seam is an EF Core interceptor, i.e.
  the concern is solved once at the data-access boundary rather than at every query — which is
  CanonCore's "Keep components modular and concerns clearly separated" applied to exactly the layer
  where it pays. **ADOPTED in pattern.**

### 74. https://jellyfin.org/posts/state-of-the-fin-2026-01-06
Jan 2026, first of a new recurring "State of the Fin" series stating project direction. Written
four months after 10.11.0 shipped, and it is the honest post-mortem the release post could not be.
- **THE MIGRATION'S RESIDUE, admitted**: "issues were expected given the scale of the database
  change ... tracked on GitHub across **three categories: General bugs, Performance bugs, Migration
  and database bugs** ... we have delivered **four additional point releases with over 100 changes**
  since the initial 10.11.0 release. The **remaining migration issues are largely isolated, one-off
  cases and are unlikely to be resolved.**"
  **ABSENT — HIGH, and it is the sharpest version of the #50 finding.** A data migration over
  heterogeneous real-world data does not converge: some instances are left permanently broken and
  the project says so out loud. CanonCore's ladder rule assumes every migration applies cleanly;
  this is the primary-source evidence that on real user data, some do not, and that the honest
  end state is a bucket of unfixable cases rather than a clean sweep. Anything CanonCore builds
  that transforms archive-scale data needs to decide, in advance, what it does with rows it cannot
  migrate — quarantine (which the prompt already has for vocabularies) is the obvious answer and
  the prompt never extends it to migrations.
- **A DATA LOSS BUG NAMED**: "the next bug-fix release is expected to include additional fixes for
  music metadata display issues and for **watched status not being preserved when media is replaced
  or renamed**."
  **DIVERGENT — CanonCore has already closed this, and this is the evidence it was worth closing.**
  Progress is per (owner, edition), and file identity is `SHA1(size + SHA1(first 64KB) + SHA1(last
  64KB))` with "PATH IS LOCATION, NOT IDENTITY, so a moved file is the same file". Jellyfin loses
  watch state on a rename because identity runs through the path. Record this next to the files
  rule as its justification.
- **A VERSION SCHEME ABOUT TO BE CHANGED IN RESPONSE TO USER PERCEPTION**: "substantial feedback
  regarding our versioning scheme following the 10.11 release, particularly concerning **the
  stability of what are perceived as 'minor' version updates** ... we are considering **'dropping'
  the major version 10, which would make the next release 12.0**." A ten-year-frozen leading `10.`
  had trained users to read a breaking release as a minor one. **ABSENT — LOW/MEDIUM**; the general
  rule is that a version number that never moves stops carrying information.
- **PERFORMANCE BLAMED ON CLIENT-SIDE WORK**: "We are continuing to investigate ways to mitigate
  performance issues caused by **client-side enumeration and filtering of large datasets**."
  **ABSENT — MEDIUM.** The web client pulls lists and filters them in the browser. CanonCore's
  archive is 373,513 pages and its clients are three separate codebases against one contract; if
  filtering is not in the contract it will be re-implemented three times, in the wrong place, and
  this is what that costs.
- **A CLIENT THAT HARD-BREAKS OLD SERVERS TO GAIN A FEATURE**: Xbox gamepad support "**requires a
  server version of 10.11 or higher** to work. However **as we cannot switch the input mode type
  while the app is running**, the Jellyfin for Xbox app **can no longer connect to older versions
  than 10.11**." A client floor imposed by a *client* implementation constraint rather than by a
  server API change. **ABSENT — MEDIUM** (see gaps).
- **A DELIBERATELY THIN CLIENT, defended**: "I always planned on keeping the app as a **web
  wrapper** because while the app is certainly more popular than most think, **it does not have
  enough support in development to be a full UWP app**."
  **DIVERGENT (informative).** This is the "implement a protocol / reuse the web UI rather than
  write an app" argument from the prompt's CLIENTS section, made from inside the project, and the
  costs of the other path are visible on the same page: Tizen "**was submitted for review, but
  unfortunately failed testing**"; Desktop stuck on a Qt migration with memory leaks and no
  Windows or macOS stable builds; "**Saved servers and settings will not be migrated** from
  Jellyfin Media Player". The prompt says do not re-argue the three-client decision; this is the
  file of what it is being argued against.
- Swiftfin ships **milestones as the public roadmap** (`Version 1.5`, `tvOS Resync`) with a stated
  rule for which bucket an issue lands in. **ABSENT — LOW.**

### 75. https://jellyfin.org/posts/state-of-the-fin-2026-05-24
May 2026, second edition, 14 minutes, and the most recent page in this shard. Frank about project
health in a way release notes never are.
- **AN LLM/AI CONTRIBUTION POLICY, and why**: "we have been **inundated with AI-authored pull
  requests of varying quality**. This has **vastly increased the amount of work the team has** ...
  The tl;dr is AI use isn't completely forbidden ... however **you must understand HOW it does what
  it does**, and any posts to a pull request/issue **should be written by the user. You cannot
  function as a go-between between your AI and our questions/comments**, just copy-pasting whatever
  the AI tells you."
  **ABSENT — LOW for the product, but directly relevant to how CanonCore itself is built.** Note the
  policy's actual test is comprehension and the ability to answer review questions in your own
  words, not provenance of the diff.
- **BURNOUT NAMED AS A DELIVERY RISK**: "the increased support requests, combined with the AI code
  submissions, have led to **burnout at various levels of the development and admin team**. Abuse
  from users when something isn't working or a change isn't accepted only increases the loss of
  motivation. **This has already led to delays in client and server improvements.**"
- **A FEATURE-BEFORE-CODE RULE**: "**Bug fixes are always welcome as-is; but features require a bit
  more work** ... if you want to work on a feature, the short answer is: **please ask us before you
  start implementing it** and work with the team on a full design/scope discussion to help ensure
  your work will be accepted." Plus, in the docs section, "a new **feature proposal guideline**".
  **ADOPTED in spirit** — CanonCore's whole prompt is that document written up front.
- Twelve months of activity published as a chart: **182-434 PRs merged/month, 238-504 issues
  closed/month, 46-75 contributors/month**. Useful calibration for what a mature self-hosted media
  project actually sustains.
- **THE PRE-RELEASE UPGRADE INSTRUCTIONS, which are a list of things a good design would not need**:
  "a **full backup of the data directory is strongly recommended**, as **this release includes
  database changes that prevent rolling back without a full restore**"; "**Installed repository
  plugins (anything not built-in) should also be removed before migrating**"; then afterwards
  "**Perform a full library scan to restore alternative versions**" and "**Run the 'Optimize
  database' scheduled task**".
  **ABSENT — MEDIUM/HIGH.** "Perform a full library scan to restore alternative versions" is the
  one to keep: *editions were lost by the migration and are recovered by re-deriving them from
  disk*. That is only possible because Jellyfin's versions are inferred from filenames — a
  CanonCore edition is owner data with statements attached and cannot be re-derived from anything.
  The general rule: any state that can only be re-created by a rescan must be state the product
  is willing to lose, and CanonCore's model has almost none of that.
- **A BREAKING API CHANGE REVERTED MID-CYCLE BECAUSE THE PROJECT'S OWN CLIENTS WERE NOT READY**:
  "the API will no longer allow deprecated authorization mechanisms by default ... That said, **we've
  temporarily reverted the default enforcement during the testing phase, since some of our official
  clients are still in the process of completing the transition.**" And, concretely: "In the final
  version of Jellyfin 12.0, **Swiftfin tvOS will not be able to authenticate** without enabling
  legacy authentication."
  **ABSENT — MEDIUM/HIGH**, and it is the cost the prompt should see. A deprecation announced two
  releases ahead (#50), with a test flag, still could not be enforced on schedule because the
  first-party clients lagged. CanonCore plans three first-party clients on one contract with the
  TV app explicitly last; the same trap is already laid.
- **API CHANGES DEFERRED TO GIVE CLIENTS A STABLE TARGET**: "Any new API changes or breaking
  modifications not already in progress will now be **deferred to 13.0**, allowing client developers
  to **begin targeting a stable API surface ahead of release**." The API-freeze idea from #67,
  extended to a whole release. **ABSENT — MEDIUM/HIGH** (see gaps).
- **A NEW SERVER RELEASE BROKE A FIRST-PARTY CLIENT OUTRIGHT**: "The mobile Android app **stopped
  working after the recent 10.11.7 server update** and was quickly resolved in 10.11.8. To keep the
  same problem from recurring, **the app itself was also patched** in the 2.6.4 release." Fixed on
  both sides, which is the right answer. Note also "The 2.6.4 build is **not available on the Google
  Play store for technical reasons**" — a fix that could not be shipped through the store.
- **A CLIENT RELEASE HELD BACK BY COMMUNITY FEEDBACK**: Android TV 0.20 "will **require Jellyfin
  server 10.11 or newer**. **Due to community feedback, we have postponed the release until Jellyfin
  12.0 is released.** However, the beta versions of the app will likely start earlier and **the app
  already notifies people about updating their server**." A client that warns about the floor before
  it enforces it. **ABSENT — MEDIUM.**
- **A SECOND FULL DESKTOP REWRITE**: Qt/QtWebEngine replaced with CEF, libmpv replaced with the
  standalone-mpv pipeline, "The removal of Qt means we are **no longer bound to a dependency that
  has historically been problematic**". Known issues: "**Some features found in v1.x and v2.x are
  missing.**" A rewrite that ships with a capability regression, stated.
- Scanner work explicitly deferred: "**scanner optimization itself was not a primary focus** of this
  release. More substantial work in that area is planned for 13.0." Read with #73, the scanner has
  been the known problem area for two major versions.
- Two new client platforms started (Amazon **Vega OS**, Philips **Titan OS**), with the reason for
  Vega being that users "buy the devices thinking they can use our Android TV app and end up not
  finding Jellyfin". The client matrix keeps growing.
- Closing statement of direction: "Jellyfin was originally forked from Emby, however **the projects
  have different goals and directions**. For Jellyfin, this includes some **very deep rewrites of
  core code**, which takes a lot of time and effort. It is necessary to help the codebase mature."

### 76. https://jellyfin.org/posts/tags
Tag index for the blog. Twenty-two tags with counts: `release 28`, `android-tv 10`, `roku 5`,
`android 3`, `ios 3`, `efcore 2`, `infrastructure 2`, `state-of-the-fin 2`, `unstable 2`,
`warning 2`, and twelve single-post tags (`apple`, `apple-tv`, `jellyfin`, `locked-database`,
`project`, `security`, `server`, `SQLite`, `testing`, `uwp`, `vue`, `xbox`).
- Navigation only, but the shape is informative: **28 of 61 posts are release announcements**, and
  the tag vocabulary is uncontrolled — `jellyfin`, `server` and `SQLite`/`sq-lite` are one-use tags
  that duplicate other axes, and casing is inconsistent between the label (`SQLite`) and the slug
  (`sq-lite`).
  **ADOPTED (corroborating).** This is precisely why CanonCore has **no tag table**: "A tag is an
  owner-authored `category` statement, which gets provenance for free", and every vocabulary is a
  lookup table with `retired` and `quarantine`. A free-text tag list with twelve one-use values and
  a casing mismatch, on a 61-item corpus, is the small version of the archive's "71 distinct values
  of which about 50 are one-use wreckage".

### 77-100. Tag listing pages (24 URLs)
`https://jellyfin.org/posts/tags/android` · `https://jellyfin.org/posts/tags/android-tv` · `https://jellyfin.org/posts/tags/apple` ·
`https://jellyfin.org/posts/tags/apple-tv` · `https://jellyfin.org/posts/tags/efcore` · `https://jellyfin.org/posts/tags/infrastructure` ·
`https://jellyfin.org/posts/tags/ios` · `https://jellyfin.org/posts/tags/jellyfin` · `https://jellyfin.org/posts/tags/locked-database` ·
`https://jellyfin.org/posts/tags/project` · `https://jellyfin.org/posts/tags/release` · `https://jellyfin.org/posts/tags/release/page/2` ·
`https://jellyfin.org/posts/tags/release/page/3` · `https://jellyfin.org/posts/tags/roku` · `https://jellyfin.org/posts/tags/security` ·
`https://jellyfin.org/posts/tags/server` · `https://jellyfin.org/posts/tags/sq-lite` · `https://jellyfin.org/posts/tags/state-of-the-fin` ·
`https://jellyfin.org/posts/tags/testing` · `https://jellyfin.org/posts/tags/unstable` · `https://jellyfin.org/posts/tags/uwp` ·
`https://jellyfin.org/posts/tags/vue` · `https://jellyfin.org/posts/tags/warning` · `https://jellyfin.org/posts/tags/xbox`

Tag listing pages. Each renders "N posts tagged with X", a "View All Tags" link, and the same
title/date/author/lede cards as the blog index (#60-65). No unique content on any of them; every
post they list is covered individually above.
- `/tags/android` (3) · `/tags/android-tv` (10) · `/tags/apple` (1) · `/tags/apple-tv` (1) ·
  `/tags/efcore` (2) · `/tags/infrastructure` (2) · `/tags/ios` (3) · `/tags/jellyfin` (1) ·
  `/tags/locked-database` (1) · `/tags/project` (1) · `/tags/release` (28) + `/page/2` + `/page/3` ·
  `/tags/roku` (5) · `/tags/security` (1) · `/tags/server` (1) · `/tags/sq-lite` (1) ·
  `/tags/state-of-the-fin` (2) · `/tags/testing` (1) · `/tags/unstable` (2) · `/tags/uwp` (1) ·
  `/tags/vue` (1) · `/tags/warning` (2) · `/tags/xbox` (1).
- Two are exact duplicates of each other in content (`jellyfin`, `locked-database` and `sq-lite`
  all list only the SQLite post; `apple` and `apple-tv` both list only the Swiftfin post), which is
  the free-text-tag problem from #76 made visible. **ADOPTED (corroborating)** — CanonCore has no
  tag table by decision.
- One structural note: the tag pages paginate at 10 (`release` spans three pages) using the same
  `/page/N` scheme as the main index, so a tag is a browsing scope over the same corpus rather
  than a separate collection — which is exactly CanonCore's "groups are a BROWSING SCOPE, not a
  wall". **ADOPTED.**

### 101. https://jellyfin.org/posts/testing-10.9.0
Mar 2024. The 10.9.0 feature-freeze announcement, and the post where the beta/RC decision is
stated as a policy rather than a one-off.
- **PRE-RELEASE TAGS ABANDONED, verbatim**: "The last few major releases, we went back and forth
  between various versions of `-beta` and `-rc` tags, but ultimately due to the complexity of
  10.8.0 nearly two years ago, we've **decided to abandon that idea going forward**. As nice as it
  is to publish pre-release tags, we feel that **doing so is not worth the burden and headache**
  during this period and after, when we already have a better solution in our weekly unstable
  builds. So, in effect, **our weekly unstable builds are now working double-duty as our
  beta/release candidate versions.**"
  A named artefact class deleted and its job given to something that already existed.
  **ADOPTED in spirit** — this is CanonCore's "Choose the simplest implementation that fully meets
  the current requirements" and "Prefer deletion" applied to a release process.
- The map from unstable builds to release stages is published as dates (`20240325` = first beta …
  `20240422` = final RC, release weekend of Apr 26-28), then edited in place: "**Update
  (2024-05-04): Due to some critical issues, we've decided to delay the release**". Same
  pre-declared-slip pattern as #67, this time slipping past its own announced window.
- "**It is not possible to downgrade as there are a significant number of database changes.**"
  Sixth sighting of the backup/no-downgrade rule.
- Otherwise near-identical to #67 (same unstable-install walkthrough, same separate plugin
  manifest URL, same Build Version bug-report requirement). One addition: "under 10.9.0 **the
  repository URL will change**", i.e. the plugin index address itself is versioned.

### 102. https://jellyfin.org/posts/vue-vue3
Apr 2023. Jellyfin Vue, the *alternative* web client, completes a Vue 2 → Vue 3 migration:
"**280 commits, +28000 lines added, +43000 lines removed** since November 2022."
- **WHY THE SECOND CLIENT EXISTS, verbatim**: "Jellyfin Web had a lot of **maintainability
  problems**, so we thought it might be a good idea to **start a new client** with modern web
  development technologies in its stack and use it as a **playground for testing some cool features
  that might not make the cut (or would've been impossible to make) in Jellyfin Web**."
  **DIVERGENT (informative).** A rewrite launched as a parallel product rather than a replacement,
  begun 2020 and still an "alternative" in 2026 (#74 has the *original* web client getting a
  vNext instead). CanonCore's constraint answers this directly: "When an audit says the remaining
  work is larger than expected, the answer is to **CUT SCOPE INSIDE THIS REPOSITORY. Never to start
  another one.**" This is the case that rule is written against, observed over six years.
- **A FRAMEWORK CHOICE REVERSED**: "we used **Nuxt** and Vue 2 ... Nuxt has been an amazing tool to
  scaffold our project ... **However, it forced a really rigid structure on us, besides SSR turned
  out to be a burden.** We had even to use some **hacks to avoid killing playback while
  transitioning between pages.**"
  **ABSENT — MEDIUM, and it is aimed squarely at CanonCore's stack.** The prompt commits to Next.js
  and a scaffold ("SCAFFOLD ONCE, THEN OWN THE OUTPUT ... never depend on it again"), which handles
  the "rigid structure" half. The half it does not address is the specific failure named here:
  **an SSR framework's page transitions tearing down a running player**. CanonCore is
  direct-play-only with progress saved every 10 seconds, so a route change that unmounts the video
  element loses position. Worth knowing before the first playback screen exists.
- **A BROWSER FLOOR RAISED AND TVs DROPPED**: "Vue 3 only supports ES6-compatible browsers. We also
  use some syntax that's only compatible with **ES2022** ... we also **deprecated all legacy support
  for outdated browsers. That include the majority of TVs.** ... **You can still run the pre-Vue3
  version ... although it will not receive any support from us.**" A whole device class dropped, with
  a frozen last-good build left behind. **ABSENT — LOW/MEDIUM.**
- **THE ROADMAP ITEM IS A DIRECT CONTRADICTION OF CANONCORE**: "a **media-type driven design**,
  where your media feels at home every time. **The current approach of most Jellyfin clients is to
  be too generic in order to be suitable for all media types possible**, but when you're listening
  to music you don't feel you're in a music player (like Spotify) or in Netflix when watching TV."
  **DIVERGENT — and this is a real, considered argument against the prompt's position.** CanonCore
  is domain-general by decision, groups are "NEVER typed by medium ... a Plex library is typed, and
  that is exactly what stops a container holding mixed media", and the demo deliberately mixes text,
  video and audio in one group. Jellyfin Vue's lead concluded from years of building the generic
  version that generic UI is the problem. Both can be true: the prompt's rule is about the *model
  and the browsing scope*, not about rendering, and nothing in it forbids a per-medium renderer —
  "a renderer is needed only when a file is attached and someone presses play". Worth writing down
  so the two are not confused when the first music screen is designed.

### 103. https://jellyfin.org/posts/webos-july2022
Jul 2022. Jellyfin ships on LG's Content Store for webOS 6+; older TVs (webOS 2-5) must side-load.
- **THE THIN-CLIENT ARGUMENT STATED PLAINLY**: "it's important to note that **the app itself is a
  wrapper around our server's web interface**, so when you keep your Jellyfin server up to date,
  **you automatically get a lot of the fixes right away**. While the TV app will directly get
  occasional fixes, **we don't anticipate having to update it very often.**"
  **DIVERGENT (informative), and the strongest single-sentence case against the prompt's client
  plan.** A wrapper inherits server fixes for free and needs almost no store releases; a native app
  needs one per fix, through a review queue. The prompt already knows this ("Five of the ten never
  built an app at all, and two of those are the healthiest projects in the set") and chooses the
  apps deliberately. This is the mechanism behind that statistic, said by the person paying for it.
- **THE PUBLISHING BURDEN, from the one person carrying it**: "That's what happens when you're the
  person in charge of **App Publishing to Google, Apple, Amazon, LG, Samsung, Microsoft, and
  Roku**." Signed off as "Core Team member, App Publisher, Community/Social/Dev Relations manager,
  and macOS/Windows Tray maintainer". Seven store relationships, one volunteer.
  **ABSENT — MEDIUM.** CanonCore plans an Expo phone app and a native Swift TV app, which is two
  store relationships (Apple twice) plus Google, and the prompt costs the *engineering* of the
  split precisely while saying nothing about the recurring cost of shipping through review.
- Device-floor detail worth keeping: getting back to webOS 3.x "brings us as far back as TVs from
  **2016 (running Chromium 38 from 2014!)**". A TV browser is frozen at its ship date.

### 104. https://jellyfin.org/posts/welcome
Dec 25 2019, the first post on the blog, one minute long. The site moves to **Hugo**, and the blog
is introduced: "where you'll be able to hear more about Jellyfin's new releases, future
development, and goals." Superseded by #58 (Docusaurus, 2022). Nothing for CanonCore beyond the
fact that the whole 61-post corpus swept here starts on this date.

### 105. https://jellyfin.org/posts/xbox-v0.9.0
Apr 2025. **A client resurrected after five years without a release.** "The Jellyfin app on Xbox
has been unmaintained for quite a while. While it was **on lifesupport** for the last couple of
years, we were occasionally fixing bugs. With the last release now **5 years old**, and the
continued interest ... I decided to take over at least the **superficial duties** of keeping it
operational."
- Closes the arc that #53 opened in 2020 (client pulled from the store) — the store listing came
  back, but only after five years and only because one person volunteered.
- The substantive change is a runtime swap: "the switch of the web browser engine the Xbox app is
  using, to a **newer and more feature rich Chromium-based** browser implementation instead of the
  old, legacy Edge one. This allows us to expand support to formats such as **HEVC/4K and HDR**."
  Codec coverage delivered by changing the *host engine*, not the app — again the wrapper argument
  (#103).
- **NO SCHEDULE PROMISED**: "If there are enough features and bug fixes done and merged, you can
  expect more releases in the future, though **I will not give a definitive timeline for that**."
- **ABSENT — MEDIUM.** The pattern across #53 → #105 → #74 is one client, three maintainers, two
  five-year gaps, one store withdrawal, and a hard server floor imposed at the end. It is the
  concrete answer to "what happens to the third client", and CanonCore's prompt orders the clients
  (web, then phone, then TV) without saying what an unmaintained one does.

### 106. https://jellyfin.org/search
The documentation search page: a heading, a "Skip to main content" link, and an empty query box.
All content is loaded client-side, so the fetched page carries nothing. No content to classify.

---

## GAPS — ABSENT FROM CANONCORE

Consolidated across all 106 URLs. MEDIUM and HIGH only; LOW findings stay in their page blocks.
Each gap names the entries it was seen in, so a claim can be checked against the source page.
A gap here means **the prompt says nothing** — not that the prompt is wrong. Several of these are
things CanonCore should decide to *refuse*, and the refusal is the missing artefact.

### HIGH

**H1. The migration ladder has no mechanism, only a promise.** (#50, #40, #74, #39)
The prompt states "MIGRATIONS ARE AN ORDERED, FORWARD-APPLICABLE LADDER FROM THE FIRST COMMIT ...
a released version can always migrate forward" and stops there. Jellyfin, ten years in, could not
keep that promise and had to publish a stepping-stone: "You **MUST be running Jellyfin 10.10.7**
before upgrading to 10.11.0 ... Upgrading from any other versions is **NOT supported and WILL
fail**." Nothing in CanonCore records the schema version on disk, refuses to start when it is
older than the oldest migration the binary carries, or replays the whole ladder from empty in CI.
Without one of those, the invariant is an aspiration that the first destructive migration breaks
silently. Three sub-decisions are missing and all three are cheap now: the **floor** (oldest
version we migrate from, and whether it expires), the **check** (fail at startup, not mid-ladder),
and the **test** (empty → head, every release, in CI).

**H2. Nothing says what the app does while a migration runs.** (#50, #74, #46)
Jellyfin's 10.11.0 migration takes "up to **several hours**", must not be interrupted, and its
duration is a function of *dirtiness rather than size*: "a database with 300,000 entries but no
issues can migrate in a matter of minutes, while one with just 30 series but severe
inconsistencies can take multiple hours." CanonCore has a wholesale read-projection rebuild, a
373,513-page archive as its fixture, and its own FACTS section saying imports are dirty. The
prompt fixes revision-id versioning so a stale rebuild cannot overwrite a newer one, and says
nothing about whether the app serves traffic during the rebuild, what it shows, or whether the
projection can be rebuilt while the old one is still readable. Jellyfin's answer — a **Startup UI
and Log Viewer**, local-network only, whose whole job is to show migration progress on a server
that would otherwise "appear dead" — is a real design and CanonCore has no equivalent position.

**H3. Migrations over real data do not converge, and there is no quarantine for the rows that
fail.** (#74, #50)
Four months after 10.11.0: "we have delivered four additional point releases with over 100 changes
... The **remaining migration issues are largely isolated, one-off cases and are unlikely to be
resolved.**" Some instances are permanently broken and the project says so. CanonCore already has
exactly the right primitive — every vocabulary has a `quarantine` state "separate from retired"
because "imports need somewhere to put values that are simply broken" — and never extends it to
migrations. The decision to take now: a migration that cannot transform a row **quarantines it and
counts it**, the same way enrichment drops unmatched fields at the door and counts them. That is
one pattern used three times, which is the shape the prompt already prefers.

**H4. Media introspection: the model cannot see inside a container file.** (#26, #46, #12)
CanonCore models subtitles and audio only as *sidecar* files ("a sidecar references the file it
accompanies plus a language"). Real media carries subtitle and audio tracks inside the MKV/MP4.
Jellyfin's Android TV app spent years forcing the server to *extract* embedded subtitles before it
could show them — "a resource-heavy process" with a dedicated plugin to pre-run it. Enumerating
embedded tracks requires probing the file, and the prompt forbids ffmpeg. So CanonCore cannot know
an MKV has three audio tracks and eight subtitle tracks, cannot offer track selection, and cannot
explain why. This needs an explicit decision, and "we do not read inside files, and here is what
the UI says instead" is a legitimate one — but it must be written down, because the scanner, the
files table, the edition model and the player all assume an answer.

**H5. Client capability negotiation does not exist.** (#12, #26, #35, #71)
Direct-play-only makes codec coverage load-bearing — the prompt says so, and uses it to justify
native Swift on TV. But it reasons about codecs entirely on the client, and never about how
anything *knows* before playback starts. Jellyfin's mechanism is the **device profile** / "media
capability report" the client sends to the server. Without one, CanonCore cannot badge an item as
unplayable on this device, cannot choose between editions by what the current client can decode,
and its stated failure mode ("when a file will not play, say so plainly") can only fire *after*
the user presses play. Roku 3.0.0 shows the other end of it: "Sometimes you have media Roku
believes it can directplay, but can't" — devices lie, so whatever is built has to tolerate that.

**H6. Getting the password onto a TV.** (#17, #46, #72)
One owner, one password, no signup — and a tvOS remote. The prompt already knows TV text entry is
broken ("React Native's TextInput is not built around the tvOS focus engine and the issue has been
open since 2020"). Jellyfin's answer, shipped across every client in this shard, is **Quick
Connect**: a 6-digit code entered on a device that has a keyboard. There is no position on device
pairing anywhere in the prompt, and the TV client cannot ship without one.

**H7. Progress has no unit for a text edition.** (#46, #45, #49)
Completion is "TIME REMAINING under a small absolute figure", saved every 10 seconds, force-completed
under five minutes. Every one of those is a clock. `text` is one of four media, the demo ships Harry
Potter novels, and the archive is full of prose. A book's position is a page, a CFI or a byte
offset; its save trigger is a page turn; "under five minutes" means nothing. Jellyfin ships a
separate **Continue Reading** rail precisely because the two cannot share a rule, while CanonCore
defines Continue Watching as one computed list. Either the completion rule gets a per-medium
variant or `text` editions are declared non-playable — but the prompt currently implies the first
and provides the second's silence.

**H8. Offline download and watch-state reconciliation.** (#18, #23, #42, #43)
The single most-recurring absence in this shard, in four independent client releases. CanonCore's
append-only event log with a maintained state row is the *correct* substrate for merging progress
recorded off-server — it is the reason the prompt gives for having an event log at all — but the
prompt never says progress may be recorded off-server, never addresses event ordering or clock
skew across devices, and never says whether bytes may leave the server. That last is a real
product decision (a catalogue that never stores media handing out files is a different product),
and refusing it explicitly is a fine outcome.

### MEDIUM-HIGH

**M1. There is no moment when the contract stops moving.** (#67, #75, #66, #101)
Jellyfin runs releases as named freezes — feature last-call, feature freeze, **API freeze** ("so
that client developers can begin confidently working on any client support changes"), API lock,
final RC — and even then could not enforce an auth deprecation on schedule because its own clients
lagged: "we've **temporarily reverted the default enforcement** during the testing phase, since
some of our official clients are still in the process of completing the transition." CanonCore
plans three first-party clients against one contract, with the TV app deliberately last, and has
no API-freeze concept, no contract version a provider or client can declare (Jellyfin's plugin
manifest carries `targetAbi` per version), and no parallel index for pre-release. The same trap is
already laid, one level down, in CLAUDE.md's parallel-worktree model.

**M2. Backup, restore, and the fact that a forward-only ladder has no recovery without one.**
(#39, #49, #50, #51, #67, #101)
Six independent sightings, always in the same words: "**ensure you back up your Jellyfin data and
configuration directories before upgrading** ... to do so, you will need to restore from a backup",
and "**It is not possible to downgrade in-place as there are database changes.**" CanonCore is
forward-only by decision, which is right — but forward-only *without* a backup story means a failed
migration on someone else's machine has no recovery at all. Note the two mechanisms Jellyfin
eventually built: the migration itself writes `library.db.old` and documents the rename-and-retry
path, and 10.11.0 added live backup/restore scoped so it is explicitly **not** an export ("can only
restore systems on which the backup was originally made"). That scoping matters: it does not
violate CanonCore's "No fork, no export, no import".

**M3. No concurrency limit anywhere.** (#73, #74)
Jellyfin's years-long "database is locked" plague turned out to be self-inflicted: "a **bug in its
parallel task limit** which resulted in **exponential overscheduling of library scan operations**
which hammered the database engine with thousands of parallel write requests." It was invisible
for years because it only manifested on some machines. CanonCore has three unbounded fan-outs — the
scanner, the wholesale projection rebuild, and enrichment that "reaches ALL connected providers at
once" — and sets no limit on any of them. Related and cheap: Jellyfin's retry is deliberately
narrow, retrying "**only** operations it will find have been locked due to this exact issue", which
is the right default for the Safe External Fetch boundary too.

**M4. State that can only be recovered by a rescan.** (#75, #50)
The 12.0 upgrade instructions include "**Perform a full library scan to restore alternative
versions**" — i.e. the migration lost the version/edition links and they are re-derived from
filenames. CanonCore editions are owner data with statements, provenance and pins attached; nothing
about them can be re-derived from disk. The transferable rule: any state recoverable only by
rescanning is state the product is willing to lose, and CanonCore's model has almost none of that,
which raises rather than lowers the bar on H1-H3.

### MEDIUM

Grouped by theme. Each is genuinely unmentioned in the prompt.

**Model and metadata**
- **Media segments** — intro/outro/recap/commercial time-spans on a video, stored server-side as a
  first-class shape and consumed by clients with a per-client policy (auto-skip / ask / nothing).
  CanonCore's only interval type is `edition_coverage`, a different axis entirely. (#23, #26, #49,
  #50, #71)
- **Extras / special features** — deleted scenes, behind-the-scenes, trailers attached to a work
  or a season. Neither an edition nor a placement under current rules. (#25, #45, #70)
- **Per-capability provider selection** — Jellyfin lets a library choose which plugins supply
  *lyrics* separately from which supply *metadata*, and (10.11) which supply segments. CanonCore
  closed the *ranking* question ("A GROUP CHOOSES ITS PROVIDERS; IT DOES NOT RE-RANK THEM") and
  never considered the *capability* question, which does not hit the two-answers-on-one-page
  problem ranking was refused for. (#49, #50)
- **Titles in other scripts, and UI internationalisation including RTL** — item titles in a
  catalogue are in whatever script the work uses, independent of UI language. (#7, #44)
- **Derived-data invalidation when a file changes** — Jellyfin now prunes chapters, trickplay and
  extracted subtitles on replace "making sure that these data will be re-generated". CanonCore's
  content-hash identity makes detection trivial and says nothing about what a changed hash
  invalidates. (#50)
- **Threshold granularity** — CanonCore has exactly two global numbers for enrichment; nothing
  says whether they can differ per provider or per property. (#44)
- **Text renderer** — a reader for `text` editions, paired with H7. (#45, #49)

**Playback and clients**
- **Casting / "play on another device" / remote control.** (#13, #35)
- **External player handoff with progress reported back** — direct play's only escape hatch for a
  file the built-in player cannot decode. (#18, #43)
- **Queue, autoplay-next, and an idle guard.** Jellyfin's "**Are you still watching?**" exists to
  stop "entire series from being marked as watched overnight when you fall asleep" — which, against
  an append-only event log defined as the truth, is data corruption. (#20, #27)
- **Track preferences that persist across a container** ("Japanese audio, English subs, for this
  whole series"). (#35)
- **Server discovery and the connect flow**, and remembering more than one server. (#15, #19)
- **Subtitle rendering and per-user subtitle appearance settings.** (#7, #26, #46)
- **A watch-later list.** Continue Watching is derived from progress and cannot hold something you
  have never started. CanonCore's own rules already answer this (an Owner-sourced `category`
  statement, or a hand-placed container) and should say so before someone adds a table. (#71)
- **SSR page transitions tearing down a running player** — Jellyfin Vue had to hack around exactly
  this under Nuxt, and CanonCore is Next.js with progress saved every 10 seconds. (#102)
- **Client-side enumeration and filtering of large datasets** — named by Jellyfin as its current
  performance problem. If filtering is not in the contract it gets re-implemented three times, in
  the wrong place. (#74)
- **What happens to an unmaintained client** — one Jellyfin client was pulled from a store, sat
  five years without a release, came back on a volunteer, then imposed a hard server floor. The
  prompt orders three clients and says nothing about the third going quiet. (#53, #105, #74)
- **The recurring cost of store publishing** — seven store relationships carried by one volunteer,
  a fix that "is not available on the Google Play store for technical reasons", a Tizen submission
  that "failed testing". The prompt costs the engineering of the client split precisely and the
  shipping of it not at all. (#103, #74, #75)

**Release and operations**
- **A deprecation window.** CanonCore's constraint is "Remove obsolete paths" with no notice
  period — correct pre-release, wrong the moment anyone else runs it. Jellyfin's pattern: announce
  one release ahead, ship a flag that lets clients **test with the removal already applied**, then
  remove. (#49, #50, #75)
- **A client floor and how it is communicated** — "requires server 10.11 or newer", surfaced by the
  client as a notice *before* it becomes an error. (#17, #19, #25, #27, #69, #74, #75)
- **Fail-fast startup checks with a documented bypass** — refuse to start on a missing/incorrect
  ffmpeg, or on less than 2GB free in a data directory. The prompt has the same instinct one layer
  earlier (env validated at build time) and nothing at runtime. (#49, #50)
- **A 503 + `Retry-After` contract** so three clients do not each invent a retry policy. (#50)
- **Release cadence and a published roadmap with dates.** (#6, #49, #67, #101)
- **Build identification in bug reports** — the exact build version, and whether this is an upgrade
  or a fresh install. (#59, #67, #101)
- **A pre-release index for third-party extensions**, because one index cannot serve two contract
  versions. (#66, #67, #101)
- **Reverse proxy, base URL and published server URLs.** (#17, #44)
- **Secure-by-default for anything that listens, and a password policy.** (#44)
- **Sanitisation of user-supplied rich text.** (#17, #44)
- **Accessibility** — no position at all, across three clients including a TV app whose entire
  interaction model is focus traversal. (#46)
- **Scrobbling to a third-party tracker (Trakt, Last.fm, ListenBrainz)** — the one place a
  catalogue conventionally pushes data outward. The refusal list almost certainly covers it and
  does not name it. (#33)
- **Telemetry / crash reporting posture**, stated either way. (#10, #16, #20)
- **DLNA or any standard protocol as the fallback client path** — the CLIENTS argument arriving
  from the other direction. (#41)

---

## PROGRESS LOG

- Entries **1-38**: first pass (docs and early client posts).
- Entries **39-49**: second pass, interrupted after `jellyfin-release-10.10.0`.
- Entries **50-106**: third pass, this session. Batched fetches of 15-20 URLs via `curl -sL`
  against `jellyfin.org` (plain curl works; no Cloudflare interstitial on this host), HTML
  stripped to text locally. Coverage verified programmatically: every one of the 106 URLs in
  `shards/jellyfin-ab` appears verbatim in this file.
- Consolidated gaps written from all 106 blocks, MEDIUM/HIGH only.

STATUS: complete
