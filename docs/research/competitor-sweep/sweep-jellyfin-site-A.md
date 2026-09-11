# Sweep: jellyfin.org site, shard A (107 URLs)

STATUS: complete

Page-by-page extraction of every product capability, setting, behaviour and concept
documented on the 107 jellyfin.org URLs in `urls/shards/jellyfin-aa`, classified against `prompt.md`.

Classification key:
- **ADOPTED** — the prompt takes the same position.
- **REFUSED** — the prompt explicitly rules it out (WHAT NOT TO BUILD / STANDING RULES).
- **DIVERGENT** — the prompt knows about this and deliberately does it differently.
- **ABSENT** — the prompt says nothing at all. Rated LOW / MEDIUM / HIGH for whether a
  self-hosted media catalogue genuinely needs it.

---

## Progress log

(pages completed appended below in batches of 5)

---

## 1. https://jellyfin.org/
Marketing home page. Documents the *shape* of the product: seven advertised capability
pillars — Movies, Shows, Music, **Live TV & DVR**, Books, **Photos**, **SyncPlay**
("Sharing a movie night remotely"). Four project stances: GPL Free Software; community
built; "No Fees ... no costs, hidden or otherwise"; "**Privacy Focused** — Jellyfin has no
tracking, phone-home, or central servers collecting your data." Also: home screen
"sections can be customized to each user's individual preferences"; library screen has
"options to filter and sort"; a public **Try the Demo** instance.

- Public demo instance → **ADOPTED** (prompt: "ONE public read-only demo instance").
- Home-screen sections / shelves → **DIVERGENT-deferred**: prompt says "No shelf type ...
  decided when screens exist."
- SyncPlay (synchronised group playback) → **ABSENT**. LOW — a single-owner catalogue with
  no multi-user has nobody to sync with.
- Live TV / DVR → **ABSENT**. LOW — CanonCore never stores media and does no transcoding;
  a tuner is a different product.
- Photos as a media type → **ABSENT**. LOW — `image` is already an edition medium; a photo
  library is not a catalogue of works.
- Software licence (GPL) → **ABSENT**. **HIGH** — the prompt calls CanonCore "SELF-HOSTED
  software ... software someone else runs" and mandates provider repos in an org, but never
  names a licence; without one nobody may legally run or fork it, and the BY-SA obligation on
  archive-derived output is stated while the code licence is not.
- Telemetry / phone-home stance → **ABSENT**. MEDIUM — the prompt hardens *inbound*
  user-supplied URLs (Safe External Fetch) but says nothing about what the app itself calls
  out to (update checks, provider pings, error reporting), which is the thing self-hosters
  actually audit.

## 2. https://jellyfin.org/contact
Community contact surfaces: Matrix (preferred) with ~15 named rooms, a bridged Discord
("Matrix is the preferred chat platform. Discord messages may be missed or delayed due to
bridge instability"), Forum, Mastodon, Twitter. Pure project-governance page, no product
capability. Not applicable to CanonCore's model — **ABSENT**, LOW (single-owner software
needs no community infrastructure at v1).

## 3. https://jellyfin.org/contribute
Contributor funnel (Code / Translations / Other) plus a sponsors block (JetBrains).
Governance only, no product capability. **ABSENT**, LOW.
Note in passing: **Translations** is called out as a first-class contribution lane — see
§4/§27 below; i18n is a recurring absent theme.

## 4. https://jellyfin.org/docs/
Documentation index. Restates identity ("descended from Emby's 3.5.2 release and ported to
the .NET Core framework"). Enumerates the admin surface a media server is expected to have:
Migrating, Backup and Restore, Plugins, Networking, Monitoring, Hardware Acceleration; and
the contribution surface: Contribution Guide, **Plugin Guide**, Reporting Bugs, Requesting
Features. Stated caveat: "Jellyfin is a fast-moving project that is in its early stages, and
this documentation as well as the code may change frequently."

- Plugins (code running in-process) → **REFUSED**: prompt, "A provider is a URL answering a
  contract — not a plugin, not a repo, and never code running inside the app."
- Hardware acceleration → **REFUSED**: "No transcoding, no ffmpeg, no quality ladders."
- **Backup and restore** → **ABSENT**. **HIGH** — CanonCore's owner data (statements, ranks,
  placements, review-queue rejections) is hand-curated and unrecoverable from providers, so a
  documented backup/restore path is the difference between a catalogue and a liability. See §6.
- **Migrating between machines** → **ABSENT**. MEDIUM — the prompt has a rigorous *schema*
  migration ladder but nothing on moving an instance's data+config to new hardware. See §9.
- Monitoring / external observability → **ABSENT**. LOW at v1. See §50.

## 5. https://jellyfin.org/docs/general/about
Project history and governance: forked from Emby in Dec 2018 over the 4.x closed-sourcing,
"previously-reported GPL violations", "the addition of a paywall for gratis users". Names a
**Core Team** with "merge permissions ... and thus have the ultimate decision authority",
each member holding a named area (Server, Web, Clients, Plugins).
No product capability. **ABSENT**, LOW — but the structural lesson is one the prompt already
internalises independently: a fork happened because the upstream closed a source others
depended on, which is the same risk the prompt's "every provider we write lives in a separate
repo ... the decoupling is the repo boundary" rule mitigates.

## 6. https://jellyfin.org/docs/general/administration/backup-and-restore
Documents both a built-in and a manual backup path.
Rules, verbatim: "**Jellyfin does not have a downgrade mechanism.** ... once your Jellyfin
instance has been started with a new version, any pending migrations are immediately applied,
and your Jellyfin data will no longer work with the old version. The only way to restore your
active instance back to the old version is to restore a backup."
Built-in backup (Feature History: "10.11: Builtin Backup feature was added") runs online, no
shutdown; four selectable components — **Database (always enabled)**, Metadata, Subtitles,
Trickplay; "The Backup system will check for at least **5GB of free space** in the backup
folder"; output is a zip in `<data>/backups`. Restore either from the web UI (server
"will immediately restart ... and will be unavailable for that time") or by launching with
`--restore-archive PATH_TO_BACKUP_ZIP`. Manual backup requires a clean shutdown first
("otherwise the database will be locked and might not be recoverable"), and restore says
"Copy - do not move or rename - your backup".

- Forward-only migration with no downgrade → **ADOPTED** in spirit: the prompt mandates
  "an ORDERED, FORWARD-APPLICABLE LADDER" and no backward compatibility.
- **Backup / restore of owner data** → **ABSENT**. **HIGH** — this is the direct consequence
  of the prompt's own forward-only ladder: with no downgrade, a backup is the *only* rollback,
  and CanonCore's most valuable data (owner statements, `rank` favourites, hand-built
  placements, remembered rejections) exists nowhere else and cannot be re-derived from any
  provider. The prompt specifies the ladder and never specifies the escape hatch.
- Restore-by-CLI-flag (`--restore-archive`) → **ABSENT**. LOW as a mechanism, but note the
  pattern: recovery must not require the web UI to be working.

## 7. https://jellyfin.org/docs/general/administration/configuration
Static (pre-start) configuration, distinct from runtime Dashboard settings.
Concrete rules: five directory roles — **Data, Configuration, Cache, Web, Log** — each resolved
by a stated precedence chain (CLI flag > `JELLYFIN_*` env var > platform default >
`$XDG_*_HOME/jellyfin` > `$HOME/...`), "In general, the XDG specification is followed by default
for non-Windows systems". Config layering is ASP.NET-tiered: hard-coded defaults <
`logging.default.json` (reserved, never user-edited) < `logging.json` (user, **"can be changed
at runtime, which will automatically reload the configuration and apply the changes
immediately"**) < env vars (`JELLYFIN_Section__Key` double-underscore nesting) < CLI options.
Named defaults: `hostwebclient=True`, `FFmpeg:probesize="1G"`, `FFmpeg:analyzeduration="200M"`,
`PublishedServerUrl`. Database section (10.11+) exposes SQLite tuning via optional
`database.xml` — keys `path`, `cacheSize`, `lockingmode` (NORMAL), `journalsizelimit`
(134217728), `tempstoremode` (2), `syncmode` (1), `pooling` (True), `command-timeout` (60), plus
arbitrary `#PRAGMA:` passthrough — carrying the warning "**These options are not part of the
stable API. Jellyfin can change or remove them in any release. Jellyfin does not migrate the
values you set.**" Fallback fonts for ASS subtitle glyphs are "**limited to a total size of
20 MB**, since all of them will be always preloaded in the browser", woff2 recommended.

- Env-validated config → partially **ADOPTED**: the prompt keeps "an env package validated at
  the top of next.config so a missing variable fails the BUILD and not the request."
- **Documented data/config/cache/log directory layout and precedence** → **ABSENT**. MEDIUM —
  software other people run needs a stated answer to "where does my data live and how do I
  point it somewhere else"; the prompt only ever names a media *filesystem path*.
- **Logging: a log directory, a configurable level, hot-reloadable logging config** →
  **ABSENT**. MEDIUM-HIGH — a background enrichment queue, a scanner and provider HTTP calls
  are all invisible failure surfaces, and the prompt has no diagnostics story at all.
- Marking a config surface explicitly unstable and unmigrated → **ABSENT**. LOW, but a good
  pattern for the two tunable thresholds the prompt does specify.
- Subtitle-rendering font fallback → **ABSENT**. LOW — but direct-play-only plus
  `role: subtitle` sidecars means CJK "tofu" is a real client-side outcome nobody has ruled on.

## 8. https://jellyfin.org/docs/general/administration/hardware-selection
Hardware buying guide, almost entirely a function of transcoding: encoder-quality ranking
across vendors, ReBAR, HDR→SDR tone-mapping cost ("Tone-mapping 4K 60fps Dolby Vision content
... requires a Ryzen 9 5950X for faster than real-time"), per-vendor codec matrices, "Starting
with Jellyfin 10.11, X86 CPUs that support the SSE4.1 instruction set is a requirement".
Almost all **REFUSED** by "Direct play only. No transcoding, no ffmpeg, no quality ladders."
Three non-transcoding items survive:
- "**Jellyfin Server is not designed to be exposed directly to the internet.** Ensure it
  remains protected behind a properly configured firewall or other secure network
  environment." → **ABSENT**. MEDIUM — CanonCore ships a single-password owner login and a
  public demo, and never states whether a private instance is expected to be internet-facing;
  that single sentence is the difference between "put it behind Tailscale" and "we hardened it".
- Server-side **bandwidth limit** setting ("a bandwidth limit of 70% of your upload speed ...
  can be found in the Jellyfin Server Dashboard") → **ABSENT**. LOW.
- Storage advice: SSD for app files, "AVOID mechanical drives that use SMR" → **ABSENT**. LOW.

## 9. https://jellyfin.org/docs/general/administration/migrate
Instance migration. Verbatim: "Jellyfins internal databases cannot be copied or adjusted
easily." And: "**Direct database migration from Emby (of any version) to Jellyfin is NOT
SUPPORTED.** We have found many subtle bugs due to the inconsistent database schemas ... we
strongly recommend that all Jellyfin users migrating from Emby start with a fresh database and
library scan." The only supported cross-instance transfer is **watched status**, and only via
third-party API scripts (from Plex, Emby, or another Jellyfin). Linux→Docker migration works
only if "You need to have exactly matching paths for your files inside the docker container!"
A security footnote: leaving `IsStartupWizardCompleted=false` "can be a security risk
especially if remote access is enabled".

- Import / cross-instance migration → **REFUSED**: "No fork, no export, no import, no
  cross-instance sharing, no merge semantics between instances."
- Worth recording the tension: the *one* thing Jellyfin's users demand across instances is
  **watch history**, and the prompt's append-only watch-event log is exactly the artefact that
  would make that trivially portable. The refusal is deliberate; the pressure is real.
- Path-identity fragility ("exactly matching paths") → **DIVERGENT/ADOPTED**: the prompt
  already fixes this with "PATH IS LOCATION, NOT IDENTITY, so a moved file is the same file."
- Incomplete-setup-is-a-security-risk → see §59 (setup wizard).

## 10. https://jellyfin.org/docs/general/administration/storage
Storage requirements. Verbatim rules:
"Jellyfin is designed to **directly read media from the filesystem**. A network storage device
that is using samba or NFS **must be directly mounted to the OS**. The Jellyfin database should
also be stored locally and not on a network storage device."
"**There are scheduled maintenance tasks which remove items from your library if triggered
while your media storage is unavailable.**"
"**rclone** is a popular choice for integrating cloud storage ... can be paired with another
program such as **mergerfs**." "When using cloud storage, it is recommended to **disable image
extraction as it requires downloading the entire file**."
Sizing: "A database for a moderate-sized library can grow anywhere from 10 to 100 GB."
ZFS: recordsize 4K–8K for the SQLite dataset, ~1M for media datasets, and changing recordsize
does not rewrite existing data.

- Filesystem path + rclone/mergerfs, no native cloud integration → **ADOPTED**, essentially
  word for word ("Document rclone and mergerfs for cloud storage rather than implementing any
  cloud integration").
- **Unavailable storage must not be read as deletion** → **ABSENT**. **HIGH** — this is a
  documented data-loss mode in the incumbent, and CanonCore is only half-protected: items are
  media-independent so an item survives, but nothing in the prompt says what the scanner does
  to `files` rows when a root is unmounted, and "the scanner NEVER writes storage" constrains
  the filesystem side only, not the database side. A scan against an empty mount must be a
  no-op with an error, never a reconciliation.
- Whole-file reads are hostile to network/cloud mounts → **ADOPTED by construction**: the
  prompt's file identity is "SHA1(size + SHA1(first 64KB) + SHA1(last 64KB)) ... Cost is 128KB
  per file", which is exactly the cheap-probe shape this warning asks for.
- Database-on-local-disk / filesystem tuning guidance → **ABSENT**. LOW (Postgres, not SQLite).

## 11. https://jellyfin.org/docs/general/administration/troubleshooting
The single densest page so far. Distinct mechanisms documented:
1. **Debug logging** via Serilog `logging.json` (`MinimumLevel.Default: "Debug"`), default is
   `Information` with `Microsoft`/`System` overridden to `Warning`. Warning: "simply loading
   the homepage will generate **over 4000 lines of logs** with the debug configuration".
   Hot-reload caveat: if `logging.json` did not exist at last server start, a restart is needed.
2. **Real Time Monitoring** — "This will let Jellyfin automatically update libraries when files
   are added or modified. Unfortunately, this feature is **only supported on certain
   filesystems**. ... **NFS and rclone do not support inotify**". Documented failure:
   "The configured user limit (**8192**) on the number of inotify watches has been reached",
   fixed by `fs.inotify.max_user_watches=524288`.
3. **Account lockout and manual unlock** — `UPDATE Users SET InvalidLoginAttemptCount = 0` when
   "the admin account is locked out and the **Forgot Password** feature is not working".
4. **Permission repair** — a `Permissions` table keyed by a `PermissionKind` enum, Kind 0–21.
5. Font "tofu" (☐☐☐) for missing glyphs, server fonts for cover images, client fonts for subs.
6. Active-device progress not showing → **system clock out of sync** (`timedatectl set-ntp true`).
7. **Database Locked** → "check your **parallel scan task limit** in your admin dashboard and
   set that lower. If its set to 0 set it to 1/2 your cores", then `LockingBehavior`
   NoLock (default) / Optimistic / Pessimistic, the last "comes with a significant performance
   impact". LXC explicitly unsupported for this class of bug.

- inotify unreliability → **ADOPTED**, and this page is the corroborating source for the
  prompt's "DO NOT ASSUME FILESYSTEM CHANGE NOTIFICATIONS FIRE ... Support explicit periodic
  scans." The prompt cites Plex and FUSE; Jellyfin independently reports NFS and rclone.
  New detail the prompt lacks: watches are a **finite kernel resource** (8192 default) — a
  large catalogue silently exceeds it, so watch-based scanning degrades rather than fails loudly.
- **Login brute-force protection / account lockout / password recovery** → **ABSENT**. **HIGH** —
  the prompt specifies "Single user, one password, no signup" and a SECURITY section covering
  the public read path and SSRF, but never rate limiting, lockout, or what happens when the
  one password is lost. On a single-password instance the login form *is* the entire attack
  surface, and with no recovery path a forgotten password is a total lockout with no
  documented escape (Jellyfin's escape is hand-editing the database).
- **Bounded scanner/enrichment concurrency** → **ABSENT**. MEDIUM — the prompt runs enrichment
  "in the background against the thresholds" across all connected providers at once and
  rebuilds a read projection wholesale, with no stated concurrency cap; Jellyfin's most common
  data-integrity complaint is exactly unbounded parallel scan tasks fighting the database.
- Diagnostics generally (log level, log location, "how do I see what the background job did")
  → **ABSENT**. MEDIUM-HIGH, same gap as §7.

## 12. https://jellyfin.org/docs/general/clients/
Governs the third-party client ecosystem. **Five inclusion requirements**, verbatim in gist:
server URL must be configurable (not tied to one instance); developers in good standing under
community standards and branding guidelines; "must be Free and Open Source, released under a
license listed as 'Free Software' by the Free Software Foundation"; "at least 1 year of active
development; or, evidence of significant user interest"; and "must provide at least one
novel/unique feature not found in other already-listed or official clients ... Said feature
must actively exist in a public release and not be 'under development'." Removal criteria are
stated too, including unilateral removal without notice for "malware distribution or violations
of community guidelines". **Supported browsers**: "our goal is to provide support for the two
most recent versions of these browsers" — Firefox, Firefox ESR, Chrome, Chrome for Android,
Safari (macOS/iOS), Edge.

- A curated, criteria-based third-party register with a stated removal policy → structurally
  **ADOPTED** by analogy: the prompt's "THE CMPP STORE — publicly addable providers, ACCEPTED
  rather than open. Curated." But the *criteria* and the *removal* half are **ABSENT**.
  MEDIUM — "curated" without written acceptance criteria and a delisting rule is a policy
  vacuum the moment the second submission arrives, and a provider is a URL that can turn
  hostile after acceptance.
- **A declared browser support target** → **ABSENT**. MEDIUM — the prompt fixes Next.js, native
  Swift and Expo but never says which browsers the web client must work on, which is the thing
  that decides whether modern CSS/JS features are usable.

## 13. https://jellyfin.org/docs/general/clients/codec-support
The playback-compatibility taxonomy, and it is a three-way one, not two:
"The goal is to **Direct Play** all media. This means the container, video, audio and subtitles
are all compatible with the client. If the media is incompatible for any reason, Jellyfin will
convert the media to a format that the client can process. **Direct Stream** will occur if the
audio, container or subtitles happen to not be supported. If the video codec is unsupported,
this will result in **video transcoding**. Subtitles can be tricky because they can cause Direct
Stream (subtitles are remuxed) or video transcoding (burning in subtitles) to occur."
Then a large per-client × per-codec matrix (Chrome/Edge/Firefox/Safari/Android/Android TV/iOS/
Swiftfin/Roku/Kodi/JMP × MPEG-4 SP/ASP, H.264 8/10-bit, H.265 8/10-bit, VP9, AV1) with a
four-state legend (Not supported / depends on device or settings / software decode only / fully
supported), plus HDR support caveats per device class.

- Transcoding and Direct Stream (remux) → **REFUSED**: "Direct play only."
- The **matrix itself** is the interesting artefact. **ABSENT**, MEDIUM: the prompt says "When
  a file will not play, say so plainly", which requires knowing *before* the user presses play
  that this container/codec/subtitle combination cannot work on this client. Nothing in the
  prompt models client capability at all, so "say so plainly" currently has no data to say it
  from — the only honest implementation is failing at the `<video>` element and reporting it.
- The subtitle sub-case is the sharpest: a media file that direct-plays fine can still be
  unplayable *as configured* because its subtitle format needs burn-in. Under direct-play-only
  the answer must be "the subtitle track is unavailable on this client", not "the file won't
  play" — a distinction the prompt's `role: subtitle` sidecar model makes expressible and
  never states.

## 14. https://jellyfin.org/docs/general/clients/css-customization
Custom CSS injection: "navigate to **Dashboard > Branding** and enter your stylesheet in the
'Custom CSS' field. Custom CSS is **loaded after Jellyfin's default styles**, allowing you to
override existing rules". Also available **per-user** under Settings > Display. Stated
constraint: "Support is not provided for issues caused by custom CSS", it "is only applied to
clients that use Jellyfin Web", and "**External resources referenced by custom CSS are loaded
by the client, not the Jellyfin server** ... can also affect offline functionality."

- Server-wide branding and per-user theming → **ABSENT**. LOW-MEDIUM — the prompt commits to
  "design tokens as PLAIN TYPESCRIPT rather than a Tailwind config", which is the compile-time
  half of the same concern and arguably the deliberate answer. Worth noting the adjacency: the
  prompt already extracts an **artwork palette** per asset, which is a per-item theming input
  with nowhere declared to surface.
- Arbitrary user-supplied CSS loading external resources → a genuine data-exfiltration and
  offline-breakage vector; the prompt's Safe External Fetch boundary covers server-side fetches
  only. **ABSENT**, LOW (because CanonCore has no custom CSS field to begin with).

## 15. https://jellyfin.org/docs/general/clients/jellyfin-vue
An **alternative, experimental browser client** for the same server, deployed separately as its
own container. Explicit: "Jellyfin Vue is not planned or targeted to replace the main Jellyfin
Web client, and is not feature-complete"; "stable releases don't exist"; "Only the latest
unstable image is supported." Ships a **hosted instance** anyone can point at their own server,
and a public demo server at `https://demo.jellyfin.org/stable`. Key architectural fact stated
plainly: "Since Jellyfin Vue is just an interface for a Jellyfin server" and "The server
address you need to type is **relative to the device you're accessing Jellyfin Vue** [from]".

- A client that is a separate deployment pointed at a **user-entered server URL** → **ABSENT**.
  MEDIUM — the prompt names three clients (Next.js web, Expo phone, Swift TV) and settles the
  technology choice thoroughly, but never states how a client finds its server, whether the web
  client is served by the server or deployable separately, or how the phone/TV apps
  authenticate against a single-password instance. That is the first thing the phone app needs
  and it is unspecified.
- A publicly hosted client that talks to *your* server → the same shape as the prompt's public
  demo, but inverted (their demo is a server; this is a client). No conflict; **ABSENT**, LOW.

## 16. https://jellyfin.org/docs/general/clients/kodi
Two fundamentally different integration architectures for the same server, described side by
side — this is the most product-relevant page in the clients section.
1. **Jellyfin for Kodi** "syncs metadata from selected Jellyfin libraries into the local Kodi
   database ... virtually no delay ... However, it also tends to consume the database and not
   share well". Kept in sync two ways: "**Startup sync** — Each time Kodi starts, it will reach
   out to the **Kodi Sync Queue** plugin in the server and request **all updated media since
   its last check-in time**"; and "**Live sync** ... When the server updates an item, it will
   send a notification to Kodi over a **websocket connection**."
2. **JellyCon** "Behaves more like a standard Kodi streaming add-on ... allows easier switching
   between multiple Jellyfin servers or users since it doesn't have to rely on syncing all the
   metadata down", at the cost of "a bit more time when you are browsing".
Also: **server auto-discovery** ("If a Jellyfin server is detected on your local network, it
will be displayed in a dialog"), otherwise manual host entry; **default port 8096**; an
optional **baseurl** subpath appended to the host; and **Add-on mode vs Native mode** —
"Native mode accesses your media files **directly from the filesystem, bypassing the Jellyfin
server during playback** ... requires your media to be available to the device Kodi is running
on over either NFS or Samba".
Constraint: "Remote Kodi databases, like MySQL, are not supported. A local SQLite database is
required."

- Native mode (client bypasses the server to read files) → **REFUSED** by the prompt:
  "playback goes through an app-owned opaque-id route so access control and progress work."
  Jellyfin's own docs concede the cost — bypassing the server means the server cannot see it.
- **An incremental change feed ("everything updated since my last check-in")** → **ABSENT**,
  MEDIUM, and this is a near-miss: the prompt already mandates "**Timestamps, tombstones and a
  change sequence on every table**", which is precisely the primitive a delta-sync API needs,
  and then never exposes it. A phone or TV client that wants offline browsing has no other
  shape available, and retrofitting a change feed onto a projection that was rebuilt
  "WHOLESALE, never incrementally" is awkward.
- **Websocket / server-push live updates** → **ABSENT**. MEDIUM — the prompt's enrichment is a
  background queue and the projection is rebuilt wholesale, so a page showing an item mid-import
  has no stated way to learn that its data changed.
- **LAN server auto-discovery** → **ABSENT**. LOW-MEDIUM — cheap, and it is what stops the
  phone app's first screen being "type an IP address".
- **Serving under a base path / subpath** (`/jellyfin`) behind a reverse proxy → **ABSENT**.
  MEDIUM — Next.js `basePath` is a build-time decision, so a self-hoster who wants CanonCore at
  `example.com/canoncore` needs this designed in, not discovered later. See §52–57.
- The sync-locally vs query-live tradeoff itself → **ABSENT**. LOW at v1 (web only).

## 17. https://jellyfin.org/docs/general/clients/mopidy
A third-party **Mopidy extension** (`mopidy-jellyfin`, pip-installed) that exposes a Jellyfin
music library over the **MPD protocol**, so any MPD client (ncmpcpp, M.A.L.P.) and any Mopidy
web client can play from it. Config keys: `libraries` (which Jellyfin libraries to expose,
"will default to 'Music'"), `albumartistsort` ("changes whether the media library populates
based on 'Artist' or 'Album Artist' metadata", default True), `album_format` (a display
template, "the only really usable fields are ProductionYear and Name"). Security note: "Mopidy
provides no security on open ports."

- Bridging to an **existing client protocol** so third-party apps work for free → the prompt
  knows this exact argument and rules on it: Komga/OPDS and Navidrome/Subsonic are cited as
  "the highest-leverage client work by a wide margin", and CanonCore nonetheless builds apps
  "deliberately. Do not re-argue it." → **DIVERGENT**, knowingly.
- **Artist vs Album Artist** as a distinct sort axis → **ABSENT**. LOW-MEDIUM — it is the
  canonical case of "the display name and the sort/grouping name are different claims about the
  same thing", which CanonCore expresses as two statements plus `sort_name`; worth checking
  that a compilation album (many artists, one album artist) has an answer.
- A display-format **template** as user configuration → **ABSENT**. LOW.

## 18. https://jellyfin.org/docs/general/clients/web-config
The web client has its own `config.json` **in the webroot**, separate from server config:
"unlike most other components of this directory, **it will not be created automatically**".
Two customisation classes:
- **Custom menu links** (10.8+): `menuLinks` array of `{name, url, icon}`, icon named from
  Material Design Icons, "By default, the 'link' icon will be used."
- **"Privacy-focused changes"** — the shipped defaults include two third-party integrations the
  docs tell privacy-minded users to remove: `plugins/chromecastPlayer/plugin` ("This requires
  **downloading files from Google servers**") and `plugins/youtubePlayer/plugin` (auto-loading
  movie trailers from YouTube; "disabled within Jellyfin by default, but the resources are
  included in the Web config to make enabling the feature easy").

- Client-side third-party asset loading, opt-out rather than opt-in → **ABSENT**. MEDIUM,
  and it sharpens §1's telemetry gap: the prompt's Safe External Fetch boundary governs
  *server-side* fetches of user-supplied URLs, and says nothing about what the **browser** is
  told to load. A provider-supplied artwork URL rendered as `<img src>` in the client is
  exactly this hole: it leaks the viewer's IP to the provider, and on the public demo it leaks
  every visitor's IP to TMDB. That is a real decision the prompt has not taken (proxy artwork
  through the app, or accept the leak).
- Custom navigation links / user-extensible chrome → **ABSENT**. LOW.
- Trailers and other externally-streamed extras → **ABSENT**. LOW — the prompt acknowledges
  trailers exist ("Force-complete anything under five minutes so trailers never sit in Continue
  Watching") without ever saying where a trailer comes from.

## 19. https://jellyfin.org/docs/general/community-standards/
Mission statement, code of conduct, and a moderation ladder (informal guidance → private
warning → public warning → temporary ban → permanent ban, under a "**second-chance-only**"
policy). Mission: "the best free and open-source media streaming platform possible, without any
proprietary/locked features or **unreasonable centralization**" and "not and will never be
under the control of any corporation or profit-driven entity".
Two rules with product consequences, not just social ones:
- Anti-piracy: "**Jellyfin is a media server system for your own media collection**; how you
  obtain media is not our concern and is not to be discussed in our communities in any form."
- Third-party ToS: "**Do not suggest, encourage, or discuss configurations that may violate the
  Terms of Service (TOS) of any other platforms.** Jellyfin can interface with multiple
  external services, both internally (e.g. **Metadata providers**) and by user configuration,
  each of which has its own requirements and TOS to protect itself. ... As a concrete example,
  **the Cloudflare Terms Of Service forbid video streaming behind a normal Cloudflare tunnel**;
  thus, suggesting a user run their instance in this way is a violation of this rule."

- Honouring a metadata provider's ToS → **ADOPTED**: the prompt does this for TMDB explicitly
  (attribution string, six-month cache, non-commercial) and for the licence status of the
  archive. Jellyfin generalises it into a rule that binds *documentation* too, which the
  prompt does not.
- **The Cloudflare-tunnel streaming prohibition** → **ABSENT**. MEDIUM — CanonCore is
  self-hosted, streams bytes over an opaque-id route, and the Cloudflare tunnel is the single
  most common way self-hosters expose an app to the internet without opening a port. It is
  also a second, unrelated Cloudflare interaction the prompt already deals with (the 403 in
  front of tardis.wiki). Worth one documented sentence.
- Governance / project neutrality / anti-centralisation → **ABSENT**, LOW at v1 (single owner).

## 20. https://jellyfin.org/docs/general/community-standards/chat
Chat room rules v2.0. Community governance only; no product capability. **ABSENT**, LOW.
Two items worth one line each: bans "**Post verbatim replies from 'AI' Chat systems (e.g.
ChatGPT) as answers**" (see §29, the LLM policy page), and formalises **Technical
Misinformation** as a punishable category, "Definition ... Information about technology that
can be objectively proven wrong ... reserved for users who repeatedly demonstrate their
unwillingness / inability to do basic research".

## 21. https://jellyfin.org/docs/general/community-standards/commercial-support
Commercial policy: "Jellyfin is an explicitly **anti-commercial** project ... Will not
commercialize the software ourselves. Do not provide payment for development. **Do not support
bug bounties** or other such systems of paid support. Collect donations purely to cover
infrastructure and other incidental costs." Notes that GPL "does not prevent or preclude
commercial uses" but that volunteers may decline to support commercial deployments.
No product capability. **ABSENT**, LOW — CanonCore has one owner and one demo; a commercial
posture is not a v1 question. The one transferable point is that a licence choice
(§1, ABSENT-HIGH) is what makes this statement possible at all.

## 22. https://jellyfin.org/docs/general/community-standards/servers
Server policy for people running instances for others. "The Jellyfin Project itself, and
members of the Jellyfin team, **do not provide servers for you to use, with the sole exception
of our demo server for evaluation and testing**." If you run one for others: "ensure that your
users are aware that you are their contact for help and support, not us as a project ... **You
are not 'Jellyfin'**." Warns that shared paid servers are "almost unequivocally piracy".
The concrete mechanism offered: "**use the 'Branding' -> 'Login disclaimer' field in the
server 'General' settings**. In this field, give your users a help link, contact form, or
something that directs them to you."

- Exactly one project-run instance, a demo, and nothing else → **ADOPTED**, near-identically:
  "It is SELF-HOSTED software, plus ONE public read-only demo instance. The demo is the only
  surface on which CanonCore is a publisher."
- A **login disclaimer / branding text field** rendered before authentication → **ABSENT**.
  LOW-MEDIUM. Adjacent to something the prompt *does* require: TMDB's attribution string
  "shown prominently, and attribution in an About or Credits section". The prompt mandates the
  obligation and never names the surface that carries it, and on the demo (read-only, no
  login) there is no login screen to hang it on.

## 23. https://jellyfin.org/docs/general/contributing/
Contribution overview. "Jellyfin follows a '**fork and PR**' methodology." Documentation is
Docusaurus in a separate repository. **Translation is a first-class, tooled workflow**: "we use
**Weblate** running at translate.jellyfin.org to handle translations. These are collected in
the **translations branches** of the various repositories and are **merged into the master
branches before each release**." Testing is framed as the lowest-barrier contribution.

- **Internationalisation / localisation** → **ABSENT**. MEDIUM. Not the translation *workflow*
  (single-owner, no community), but the structural precondition: whether UI strings are
  extractable and whether the data model can carry a language. CanonCore's model has a real
  need the prompt does not address — a `nomen` kind exists for names, editions have dubs and
  translations, and `edition_coverage` describes "a different translation", so the catalogue
  is explicitly multilingual in its **data** while the prompt never says whether a statement
  value carries a language tag. Schema.org, BIBFRAME and Wikibase all tag literals with a
  language; adding that later is a statements-table migration, which the prompt elsewhere
  calls out as the thing that cannot be retrofitted.
- Doc-site-as-separate-repo, fork-and-PR → **ABSENT**, LOW.

## 24. https://jellyfin.org/docs/general/contributing/branding
Trademark and identity policy. "The name 'Jellyfin' is reserved for the Jellyfin project itself
and its official clients ... **3rd party developers should not use the name Jellyfin directly.**
Additionally, we discourage projects from using the combination of 'Jelly[word]' or '[word]fin'
... You may reference Jellyfin in a subtitle, description, etc. as an indication of
interoperability. For example, '**Floostream, a Jellyfin client**' is ideal." Logo may not be
reused, rotated, or nested; the **colour gradient** is explicitly permitted to third parties
"To help facilitate a common design language even among 3rd party clients". Writing style rules
("Avoid 'JellyFin'"; lowercase in repo and file names). Concrete tokens: Gradient
`#AA5CC3`→`#00A4DC`, background `#000B25`, theme background `#101010`, accent `#00A4DC`, banner
font Plus Jakarta Sans. Notes an in-progress rebrand making the guidelines outdated.

- A written naming rule that reserves a word → structurally **ADOPTED**: "Canon is the
  product's name and nothing else — not a field, not a UI word. If continuities ever need
  distinguishing, the word is `continuity`." CanonCore reserves a word *internally*; Jellyfin
  reserves one *externally*.
- **A trademark/naming policy for third-party providers** → **ABSENT**. LOW-MEDIUM — the
  prompt creates a CMPP store of third-party-supplied providers with no rule on whether a
  provider may call itself "CanonCore something", which is the same confusion Jellyfin wrote
  this page to stop.
- Design tokens as a published, fixed list → **ADOPTED in mechanism**: "design tokens as PLAIN
  TYPESCRIPT rather than a Tailwind config."

## 25. https://jellyfin.org/docs/general/contributing/development
Development process. Stack: "**.NET 9 and C#**" server, "Jellyfin Web: The main client
application built for browsers, **but also used in some of our other clients that are just
wrappers**." Rules: "'**fork, feature-branch, and PR**' model"; "New features or substantial
changes to existing behavior affecting multiple sub-projects should **first be proposed as a
Jellyfin Meta discussion**"; "If there isn't already an issue dealing with the changes you want
to make, **please create an issue to track it first**, then ensure your PR(s) reference the
issue"; add yourself to `CONTRIBUTORS.md` "if the code leaves GitHub ... for copyright or
praise". Branch policy: **feature branches** for multi-PR work ("This helps allow the work to
progress without breaking master for long periods"), merged "in one shot into master"; master
is the target for all PRs except emergency hotfixes, and "no PR should break master". Dev
setup wires the web client in by `JELLYFIN_WEB_DIR` pointing at the built `dist`.

- Feature branch as an **integration branch**, merged in one shot → **ADOPTED** independently
  by this repo's own working conventions ("The PR branch is the integration branch").
- "Web client ... also used in some of our other clients that are just wrappers" →
  **DIVERGENT**: the prompt refuses the wrapper route on codec grounds ("direct-play-only makes
  client codec coverage load-bearing ... the player is native Swift under every option") and
  refuses a second Expo app for TV. Jellyfin's own answer to the same problem is a webview
  wrapper, which is exactly what the prompt rules out.
- Written contribution/branch policy → **ABSENT** from the prompt, LOW (lives in CLAUDE.md and
  the Orca conventions, not in the product spec).

## 26. https://jellyfin.org/docs/general/contributing/direct-donations
A table of individual maintainers with per-person donation links, "**intentionally randomly
ordered to avoid any appearance of favoring any one developer**", plus a "Pick for me, just
somebody" randomiser. Inclusion rule: "being a currently active member of the Jellyfin Team and
having shown a long term commitment". Reveals the **subproject-lead** structure (Web, iOS, Roku,
Kodi, Vue, Android TV, Xbox, Swiftfin each have a named lead).
Governance only. **ABSENT**, LOW.

## 27. https://jellyfin.org/docs/general/contributing/documentation
Documentation process. Notable rules: self-review with a spellchecker first ("**AI is fine for
this though please use it sparingly for generating content**"); **peer copyediting** in a
collaborative editor before the PR for large changes; **reciprocal peer review** ("find another
PR from another person ... and perform a thorough readthrough"); and "**Blog posts are
exclusively written by our team members; we do not accept outside blog posts under any
circumstances** ... the date should always reflect the final (expected) publishing date."
No product capability. **ABSENT**, LOW.

## 28. https://jellyfin.org/docs/general/contributing/issues
Issue policy. "**Issues should only detail software bug reports.**" Feature requests are
explicitly moved off GitHub: "feature and enhancement requests should be directed towards our
**Fider** instance for tracking, **voting**, and reporting." Duplicate policy is a 👍 reaction,
not a comment. Bugs must be reproducible and tagged `[bug]`. A documented label taxonomy:
categories (`backend`, `build`), criticality (`regression` = "immediate attention due to a
regression from the last build", `bug`), management (`good first issue`, `help wanted`,
`roadmap`, `investigation`), and PR-only (`requires testing`).
Also a branch fact that contradicts §25's "all PRs should target master": "since PRs go into
**dev** first but releases are built from **master**".
Project process, not product. **ABSENT**, LOW. One transferable idea: a **separate,
vote-ordered feature backlog** kept off the bug tracker, which is a cleaner split than the
`needs-triage`/`ready-for-agent` label scheme this repo uses.

## 29. https://jellyfin.org/docs/general/contributing/llm-policies
A formal **LLM/AI development policy**, and unusually specific. Verbatim rules:
"LLM output is **expressly prohibited for any direct communication**" — issues, feature
requests, PR bodies, forum/chat posts — "the output must be your own words ... **We expect you
to understand what you're posting.** Violating this rule will result in closure/deletion".
Exception for LLM-assisted translation if declared. For code: "**pure 'vibe coding' will be
rejected**" and "**you are responsible for what you commit**"; PRs must be focused ("If the PR
claims to target X, and is also touching unrelated Y and Z, it will be rejected ... a hallmark
of poorly-worded or too-general prompts"); "**do not commit LLM metafiles (e.g. `.claude`
configs)**"; you must be able to explain the change without LLM output; it must build, run and
be explicitly tested; you must be able to act on review feedback yourself; large changes need
"multiple discrete commits"; "The final discretion always lies with the reviewers."
Motivation stated: Jellyfin inherited a codebase that "was extremely fragile, spaghettified,
and prone to over-engineered complexity" and the policy defends against re-creating it.
No product capability. **ABSENT**, LOW as a product matter. Two notes:
- The "focused PR, explain it in your own words, test it, no unrelated changes" set is
  effectively what this repo's own CLAUDE.md already enforces.
- **Direct conflict of practice**: Jellyfin bans committing `.claude` configs; this repo commits
  agent config deliberately (`733f43d Add agent config, CI, and Orca/Linear working
  conventions`). Worth knowing before contributing anything upstream, and worth knowing if
  CanonCore ever accepts outside provider contributions.

## 30. https://jellyfin.org/docs/general/contributing/release-procedure
The release contract, published "to ensure transparency". Rules:
**Semantic versioning** `X.Y.Z` from 10.0.0, with the meanings spelled out:
- "**X: Major Versions** — Breaks compatibility with the **HTTP or plugin APIs**"
- "**Y: Minor Versions** — Introduces new features; Makes minor backwards-compatible API changes"
- "**Z: Hotfix Versions** — Critical bug fixes or minor changes"
And a standing caveat: "the 10.Y.Z release chain represents the 'cleanup' of the codebase, so it
should be accepted that **10.Y.Z breaks all compatibility, at some point**, with previous
Emby-compatible interfaces, and may also break compatibility with previous 10.Y releases".
Process: releases "on Sundays 'when ready'"; a "**golden nightly**" announcement, then a full
**PR freeze**, then "**at least 48 hours of testing time**", restarting if breaking bugs appear.
Release branches `release-X.Y.z` (literal `z`), tags `vX.Y.Z`. Hotfixes are cherry-picked
backports selected by a **`stable-backport` label** (`git cherry-pick -sx -m1 <merge-commit>`),
with "If there are significant merge conflicts, this likely indicates that the fix is too large
for backporting." Release notes have a **fixed structure**: New Features and Major Improvements
(with in-line Fider links), Important Release Notes categorised by platform (`[All]`,
`[Windows]`), an FFmpeg section, and a full changelog split by repository.

- **A versioning policy for the public contract** → **ABSENT**. **HIGH**, and this is the
  sharpest structural gap this page exposes. Jellyfin's major-version trigger is defined
  entirely as "breaks the HTTP or plugin APIs" — because third parties build against it.
  CanonCore has exactly the same exposure and more of it: **CMPP is a contract that third
  parties implement in their own repos, on their own deploy cadence**, and the prompt says
  "Do not preserve backward compatibility. Remove obsolete paths." Those two facts cannot both
  hold without a declared contract version: an unversioned contract plus a no-compatibility
  rule means every CanonCore release silently breaks every third-party provider, with no way
  for either side to detect it. The prompt versions the *database* rigorously (a forward-only
  migration ladder from the first commit) and does not version the *interface* at all.
- **Release notes, a changelog and an update path for self-hosters** → **ABSENT**. MEDIUM —
  self-hosted software that migrates the database on start-up must tell the operator what
  changed before they upgrade, especially given the prompt's no-downgrade posture (§6).
- Golden nightly / PR freeze / 48-hour soak → **ABSENT**, LOW at v1.

## 31. https://jellyfin.org/docs/general/contributing/source-tree
A directory-by-directory map of the server and web repos. Read as an inventory of subsystems a
media server turns out to need, it is the most useful page in the contributing section:
`Emby.Naming` "parsers for the media filenames" · `Emby.Drawing` "**image processor managing the
image encoder and image cache paths**" · `Jellyfin.Drawing.Skia` "image manipulation like
resizing images, **making image collages**" · `Emby.Notifications` "listening for events and
sending the associated notification" · `ScheduledTasks` · `Emby.Dlna` + `Profiles` "DLNA
Profiles for clients" · `RSSDP` "**SSDP** protocol" for discovery · `MediaInfoHelper.cs` "logic
for the **stream builder that determines method of playback such as Direct Play or
Transcoding**" · `MediaBrowser.Providers` "managing multiple metadata sources" ·
`MediaBrowser.LocalMetadata` "metadata provider and saver for **local images, local Collections
and Playlists**" · `MediaBrowser.XbmcMetadata` "metadata provider and saver for local `.nfo`
files" · `apiclient` "files used for **generating the axios API client**" · web `src/strings`
"translations for the entire interface" · `src/themes` · `src/splash` "**progressive web apps**
will show these splash screens" · `src/legacy` "polyfills ... backwards compatibility".

- `.nfo` reading/writing → **REFUSED** ("no `.nfo` reading").
- A generated API client from the OpenAPI document → **ADOPTED**: the prompt keeps "the oRPC
  RPC and OpenAPI handlers behind one catch-all route ... yields a free OpenAPI reference."
- **A server-side image processor: cache, resize, and a stable local URL for artwork** →
  **ABSENT**. **HIGH**. The prompt's artwork table stores a "Provider-supplied URL" and an
  extracted palette, and nothing else. That means (a) the client hotlinks the provider, leaking
  every viewer's IP to TMDB including on the public demo, (b) artwork breaks permanently when a
  provider rotates or expires a URL, with no local copy, (c) no thumbnails, so a grid of 200
  posters pulls 200 full-size images, and (d) the palette is extracted server-side from a fetch
  the prompt describes but never says is retained. The prompt already had to invent a whole
  table for artwork because it carries four attributes; the fifth attribute — the bytes — is
  the one it left out. Note this is a *policy* decision as much as a technical one, since TMDB
  "grants no rights in the underlying images".
- **A scheduled-task subsystem** → **ABSENT**. MEDIUM. See §95.
- **A notification subsystem** → **ABSENT**. LOW-MEDIUM. See §89.
- PWA / splash / offline shell → **ABSENT**. LOW-MEDIUM.
- Per-client **device profiles** (DLNA Profiles) as a data-driven capability table →
  **ABSENT**. MEDIUM; the missing input for §13's "say so plainly".

## 32. https://jellyfin.org/docs/general/faq
FAQ. Product-relevant answer, verbatim: "**Why is my media not showing up in Jellyfin?** This
normally comes down to one of the following issues: **File permissions are not properly
configured on your media.** Your media does not follow the **organizational requirements** for
Jellyfin's scanner to properly identify media."
Also: feature requests tracked and upvoted on Fider, with the caveat "the Fider does not
guarantee prioritization"; "We make releases only when the team feels that it is ready";
donations via OpenCollective "only used for infrastructure".

- **Scanner failure diagnostics — permissions and unreadable paths** → **ABSENT**. MEDIUM.
  This is documented as the single most common user-facing failure in the whole product, and it
  is not a bug but an unreported condition. The prompt says the scanner "NEVER writes storage"
  and supports periodic scans, but never says what a scan *reports*: how many files it could
  not read, which roots were empty, which paths were denied. Combined with §10's
  delete-on-unavailable-storage hazard, "the scan found nothing" must be distinguishable from
  "the scan could not look".
- A **layout/naming requirement imposed on the user's filesystem** → **DIVERGENT**, and
  deliberately: CanonCore items are media-independent and ordering never lives in filenames
  ("ORDERING LIVES IN FILENAMES" is reason #2 the prompt exists). See §76–83.

## 33. https://jellyfin.org/docs/general/getting-help
A four-line stub pointing at Community Standards and the Contact page. No content.
**ABSENT**, LOW.

## 34. https://jellyfin.org/docs/general/installation/
Installation index, and a **platform support matrix stated as policy**: "**FreeBSD and its
derivatives, such as TrueNAS CORE, are NOT supported by Jellyfin due to .NET officially not
being compatible with these platforms.** Even though there are builds available online for
these platforms, they are unofficial ... TrueNAS SCALE is based on Linux and therefore
officially supported. Please install the Jellyfin app from its app repository. **This app is not
officially maintained by the Jellyfin team**, therefore please use the TrueNAS support channels
for help first." Nine documented install targets.

- **A declared supported-platform matrix, and a stated position on third-party packages** →
  **ABSENT**. MEDIUM — the prompt fixes the stack (Next.js, Postgres, pnpm/Turborepo) but never
  says what a person needs to run it, which is the first question a self-hoster asks. Note the
  tiering here is the same shape as the prompt's own four provider tiers: official / officially
  supported but not maintained by us / unofficial / unsupported.

## 35. https://jellyfin.org/docs/general/installation/advanced/community
Community-maintained distro packages: Alpine, Arch (`jellyfin-server` has "a **hard dependency
on jellyfin-ffmpeg**"), Fedora/RPM Fusion ("Official packages are no longer provided starting
with 10.9"), Gentoo, NixOS (`services.jellyfin.enable = true;`), Flatpak ("provided for
convenience only, and **may be deprecated at any time** ... **Flatpak themselves don't recommend
the use of Flatpak for server applications**"), FreeBSD (third-party; "Issues reported to
Jellyfin about this package will be **closed without further investigation**").
Concrete network facts, stated as firewall rules: "**8096 TCP**, used by default for HTTP
traffic; you can change this in the dashboard. **8920 TCP**, used by default for HTTPS traffic.
**1900 UDP**, used for service auto-discovery; **this is not configurable**. **7359 UDP**, used
for auto-discovery; **this is not configurable**."

- **A distribution and packaging story** → **ABSENT**. **HIGH** — the prompt's opening claim is
  "It is SELF-HOSTED software ... software someone else runs", and nothing anywhere says how
  they get it: no container image, no compose file, no install command. This is legitimately
  *after* the four stop conditions (which end at a rendered page), but it is the difference
  between the product as described and a repo you clone. A single published container image
  plus a compose file is the whole of it.
- Splitting server and web into separately installable packages → **ABSENT**, LOW (Next.js
  makes them one thing).
- Fixed, non-configurable discovery ports → see §16; **ABSENT**, LOW-MEDIUM.

## 36. https://jellyfin.org/docs/general/installation/advanced/kubernetes
Kubernetes deployment via an official Helm chart (`helm repo add jellyfin https://jellyfin.github.io/jellyfin-helm`). Concrete facts: two separate persistent volumes with different storage classes — `config: 5Gi / fast-ssd`, `media: 100Gi / slow-hdd`; resource limits `2000m CPU / 4Gi` limit, `500m / 1Gi` request; **a `/health` HTTP endpoint** driving liveness (`initialDelaySeconds: 30, periodSeconds: 10`) and readiness (`5s/5s`) probes; an **optional Prometheus `metrics` + `serviceMonitor`** block; a Traefik middleware `buffering: maxRequestBodyBytes: 0` needed for large uploads; `JELLYFIN_PublishedServerUrl` passed as an env var because the server does not otherwise know its own external URL.

- **A `/health` endpoint** → **ABSENT**. MEDIUM — every container orchestrator, Docker's own `HEALTHCHECK`, and any reverse proxy in front of a self-hosted app want one, and the scaffold the prompt adopts (`create-better-t-stack`) already ships "a single four-line health check" in its API router, so this is nearly free and currently unnamed.
- **A published external URL setting** → **ABSENT**. MEDIUM — the same gap as §16's basePath. An app that mints absolute links (artwork proxy, share URLs, OpenAPI server field) behind a reverse proxy must be told its public origin; Next.js will not infer it.
- Prometheus metrics → **ABSENT**. LOW at v1.
- Separate fast/slow storage classes for config vs media → **ABSENT**, LOW (Postgres and a media path are already separate things).

## 37. https://jellyfin.org/docs/general/installation/advanced/manual
Manual/portable installs for Windows, macOS, Linux, plus the Debian repo setup. The interesting content is not the commands but the **rollback recipe**, stated as a first-class documented procedure: "Portable Windows Rollback — Stop Jellyfin. Delete the `system` folder. Rename `system-bak` to `system`. Run `jellyfin.bat`." Also the CLI directory flags in the wild (`-d data -C cache -c config -l log --ffmpeg`), a systemd unit template, `-noautorunwebapp`, and a supply-chain note on `extrepo`: it exists so users need not run "the `curl | sudo bash` combo ... The risk with that command is that it relies on the security of the webserver ... So there is a chain of trust from Debian all the way to the Jellyfin repo information." Platform exclusion: "Microsoft does not provide a .NET for 32-bit x86 Linux systems, and hence Jellyfin is not supported on the i386 architecture."

- **A documented rollback procedure** → **ABSENT**. **HIGH**, and it sharpens §6 rather than repeating it. Jellyfin can document binary rollback *only because* the binaries are separable from the data; its database is explicitly one-way (§6). CanonCore inherits the same asymmetry from "MIGRATIONS ARE AN ORDERED, FORWARD-APPLICABLE LADDER" plus "Do not preserve backward compatibility" — so a self-hoster who upgrades into a broken release has, as specified today, no route back at all: the old image will not open the migrated database and no backup is mandated. One documented sentence ("restore the database dump taken before upgrading, then pin the previous image tag") closes it, and it costs nothing to say now.
- Supply-chain posture on the install path (signed repo, checksum, chain of trust) → **ABSENT**. MEDIUM — CanonCore's equivalent is the container image and, more sharply, the **CMPP store**: a store that hands out third-party provider URLs with no signing, pinning or integrity story is the same `curl | bash` risk one level up.
- systemd unit / run-as-non-root → **ABSENT**, LOW-MEDIUM (part of the §35 packaging gap).

## 38. https://jellyfin.org/docs/general/installation/advanced/source
Building from source. One structural fact worth keeping: **packaging lives in its own repository** (`jellyfin/jellyfin-packaging`), pulling the server in as a git submodule, with a `build.py auto docker` entry point and a per-platform `./build <platform> all`. Windows builds live in a third repo (`jellyfin-server-windows`), and the docs twice note "This will very likely be split out into a separate repository at some point in the future."
- Separating build/packaging from application source → **ABSENT**. LOW — a monorepo with Turborepo is the prompt's answer and a container build is one Dockerfile; noted only because the prompt's repo-boundary instinct ("the decoupling is the repo boundary") is the same reasoning applied to providers.

## 39. https://jellyfin.org/docs/general/installation/advanced/synology
Synology NAS install via Container Manager, entirely a GUI walkthrough of the Docker image from §42. Warning repeated at the top: "Many pre-built NAS devices are underpowered. We generally do not recommend running Jellyfin on those devices." Recommends "all CPU resources and at least 4GB of ram". No new product capability — a packaging duplicate. **ABSENT**, LOW.

## 40. https://jellyfin.org/docs/general/installation/advanced/truenas
TrueNAS SCALE install, two supported routes (Custom App via Compose YAML, or the ix-systems community app), both on the official Docker image. Rules with content beyond packaging:
"The official Jellyfin Docker image internally creates the following necessary directories: **cache, config, cache/transcodes**."
"It is recommended to set Jellyfin's **config** directory to an accessible dataset. This will make it easy to **backup/restore** your server." Config and cache on an SSD pool; transcodes never in RAM ("If there isn't enough memory available in RAM for a transcode, the transcode will fail").
Permissions: a container-run user/group defaulting to `568:568`, and the pointed clarification "**The user & group you set are only to run the container. They are not used to create a Jellyfin account.**" Render group added by GID for hardware acceleration.
- Transcode scratch space → **REFUSED** (no transcoding).
- **A cache directory that is explicitly disposable, held separate from config/data** → **ABSENT**. MEDIUM. The prompt has three things that are derived and rebuildable — the read projection ("rebuild WHOLESALE"), extracted palettes, and any fetched artwork — and three that are irreplaceable (statements, placements, remembered rejections). Nothing states which storage is which, so an operator cannot know what is safe to delete when a disk fills, nor what actually needs backing up. Naming a cache boundary is what makes the §6 backup gap tractable rather than "back up everything".
- OS-user vs application-account confusion → **ABSENT**, LOW — but CanonCore has a sharper version of the same trap: `owners` is ONE row with one password, and nothing says what happens on first boot if the container runs as a different UID than the one that wrote the data directory.

## 41. https://jellyfin.org/docs/general/installation/advanced/windows
Windows service install. Product-relevant only in its **least-privilege permission model**, stated as an explicit tiering of what write access buys you: run as **Network Service**, not Local System ("preferred ... for the principle of least privilege"); on the media folder, "**Read & execute (Recommended)**: Allows Jellyfin to see and play your media. This is the safest option as it prevents the server from accidentally deleting or modifying your original movie files. **Modify**: Required only if you want to use Delete from within the Jellyfin UI, or if you want Jellyfin to save subtitles and `.nfo` metadata files directly into your movie folders. **Full Control**: Not recommended for media folders."
- **A media library mounted read-only, as the documented default** → **ADOPTED, and this page is strong corroboration**: the prompt's "The scanner NEVER writes storage. It never creates folders, never moves files, never writes its structure to disk" is exactly what makes the recommended posture achievable. Jellyfin has to caveat it because `.nfo` saving and in-UI delete need write; CanonCore refuses both (`no .nfo reading`, delete is a database operation), so it can state read-only mounting unconditionally — a genuine advantage the prompt never claims out loud.
- Troubleshooting note "ensure the account has at least **List folder contents** permissions on the parent directory" → the §32 scanner-diagnostics gap again; **ABSENT**, MEDIUM.

## 42. https://jellyfin.org/docs/general/installation/container
The container page, and the most directly transferable page in this section. Official images on Docker Hub and `ghcr.io`, Debian-based, multi-arch. **A published tag policy**, verbatim: "`latest` always tracks the latest stable release, including through major and minor version bumps · `X` (e.g. 10) tracks the major version · `X.Y` (e.g. 10.11) tracks the minor version · `X.Y.Z` tracks a specific release · `X.Y.Z.YYYYMMDD-HHMMSS` tracks a specific packaging build." Platform policy: "**You WILL NOT receive any support for running Jellyfin in a Container on platforms other than Linux**", naming Docker-on-macOS scanning as a known-broken case. Volumes: `/config`, `/cache`, media bind-mounted, with `readonly` shown for extra libraries. Ports `8096/tcp` + `7359/udp`. `--user uid:gid`. `JELLYFIN_PublishedServerUrl` again, labelled "alternative address used for autodiscovery". Podman section is notable for going further than Docker's: rootless by default, `--userns keep-id`, SELinux `:Z` relabelling, quadlet systemd units, and `io.containers.autoupdate=registry` with the warning that auto-update means "a backup will be required to restore a previous version".
- **Publishing a container image with a documented tag policy** → **ABSENT**. **HIGH** — this is §35's packaging gap made concrete and cheap. The prompt commits to self-hosted software and to a no-backward-compatibility rule; the tag policy is what lets an operator pin `X.Y` and not be migrated into a breaking release by an unattended `latest` pull. Jellyfin's own auto-update warning ("a backup will be required to restore a previous version") is the exact failure the prompt's forward-only ladder guarantees.
- Bind-mounting media **readonly** in the published example → **ADOPTED** by construction (see §41).
- Docker-on-macOS scanning known-broken → **ABSENT**, LOW-MEDIUM: worth knowing that filesystem scanning across a container boundary on non-Linux hosts is a documented failure class, given the prompt's scanner is path-based and already distrusts inotify.

## 43. https://jellyfin.org/docs/general/installation/linux
Linux install: a checksum-verified BASH script (`curl` the script *and* its `.sha256sum`, `sha256sum -c`, then run), with an explicit alternative for people who will not run a script as root. Closing policy line: "**For other distributions, containers are the recommended way to install Jellyfin.**"
- "Containers are the recommended way" as the single stated install answer → the cheapest possible resolution of §35/§42; **ABSENT**, folded into those. Verify-then-execute rather than `curl | bash` → see §37.

## 44. https://jellyfin.org/docs/general/installation/macos
Three-step DMG install, update and uninstall. One fact: "For Apple Silicon Macs below macOS 14, please update to a newer version of macOS or download the x86 release." No product capability; packaging duplicate. **ABSENT**, LOW.

## 45. https://jellyfin.org/docs/general/installation/windows
Installer-based Windows install/update/uninstall. Notable only for contradicting §41 in passing — "(Optional) When installing as a service (**not recommended**), pick the service account type" — where the dedicated service page calls the same thing "ideal for dedicated servers". Packaging duplicate. **ABSENT**, LOW.

## 46. https://jellyfin.org/docs/general/post-install/networking/
The networking contract. Framing sentence: "As a fully self-hosted software, Jellyfin runs independently from the Internet. **You do not have to make your server accessible through the internet.** Neither does Jellyfin require an internet connection to run; however you should note that **it will load metadata from various Providers, which will not work without an Internet connection.**"
Port table, with a Configurable column: `8096/TCP` HTTP ✔, `8920/TCP` HTTPS ✔, `7359/UDP` client discovery ✘. Discovery detail: "A broadcast message to this port will return detailed information about your server that includes **name, ip-address and ID**."
Access control: "External access can either be completely disabled or **selectively enabled for individual users**", requiring `Networking -> Local Networks` as "comma-separated CIDR notation entries" for the server to know what "local" means; per-user "Allow remote connections to this server". Warning: "External access settings through a reverse proxy will only work if **known proxies** are set up correctly!"
HTTPS: disabled by default, "**Self-signed certificates pose security and compatibility issues and are strongly discouraged**", and "While Jellyfin supports HTTPS, it is **strongly recommended to handle HTTPS termination separately on a reverse proxy**."
**Base URL** section, in full detail: supported, "known to break HDHomeRun, the DLNA plugin, Sonarr, Radarr, and MrMC"; normalised to include a leading `/`; "**This setting requires a server restart to change**, in order to avoid invalidating existing paths until the administrator is ready"; setting or changing one auto-redirects, but "entirely removing a Base URL ... will not — **all URLs with the old Base URL path will become invalid and throw 404 errors**"; and "Client applications generally, for now, **do not handle the Base URL redirects implicitly**", so the Android TV app's Host field must include it.

- **A stated "works with no internet, except providers" posture** → **ADOPTED implicitly and worth making explicit**: the prompt already says "A private instance with no provider connected has no artwork", which is the same claim about one surface. The generalisation — the catalogue is fully usable offline, enrichment is the only thing that needs the network — is exactly CanonCore's shape and is never stated.
- **Base path / subpath hosting** → **ABSENT**. MEDIUM (raised at §16, now with the full cost visible). Next.js `basePath` is build-time, so a self-hoster cannot change it in a settings screen at all; Jellyfin's own experience is that removing one 404s every old URL, and that clients must be told about it manually. Either CanonCore declares "root path only, put it on a subdomain" or it bakes basePath into the image build. Both are one sentence; discovering it after the phone app exists is not.
- **A local-network CIDR concept and a per-user remote-access toggle** → **ABSENT**. LOW-MEDIUM at v1 (one user, no visibility system by decision), but the *reason* Jellyfin needs it is the reason CanonCore will: the public demo and a private instance are the same binary, and "is this request local" is the only cheap way to distinguish them without a visibility system.
- HTTPS terminated at a reverse proxy rather than in-app → **ABSENT**. MEDIUM — the prompt's cookie session, the opaque-id playback route and any provider credential in a form all assume TLS, and nothing says who provides it. "Terminate TLS at a reverse proxy; the app assumes it is behind one" is the whole decision.
- LAN discovery broadcasting server name/IP/ID unauthenticated → **ABSENT**, LOW.

## 47. https://jellyfin.org/docs/general/post-install/networking/advanced/fail2ban
Brute-force protection, achieved entirely **outside the application** by log-scraping. The mechanism, verbatim: filter `failregex = ^.*Authentication request for .* has been denied \(IP: "<ADDR>"\)\.`; jail `maxretry = 3`, `bantime = 86400`, `findtime = 43200`. Two hard prerequisites that are themselves product requirements: "**Knowing where the logs for Jellyfin are stored**: by default `/var/log/jellyfin/` for desktop and `/config/log/` for docker containers" and "**Jellyfin log level set to Info** (failed authentication entries are not logged at Error)". Operational wart: "Jellyfin rotates logs daily and fail2ban cannot detect the newly created log files without service restart", requiring a systemd timer at 00:45 to reload the jail. Plus a long section on banning at an upstream proxy over SSH, and the reminder that Known Proxies must be configured or every log line shows the proxy's IP.

- **Login rate limiting / brute-force protection** → **ABSENT**. **HIGH**, and this page changes the shape of the §11 finding rather than repeating it. Jellyfin's answer to brute force is *not in the product*: it is a log line, in a known place, at a known level, in a stable format, that an external tool matches with a regex. CanonCore's exposure is strictly worse than Jellyfin's — "Single user, one password, no signup" means there is exactly one credential, no username to guess, and no account-lockout backstop, so an unthrottled login endpoint is the entire authentication story. The prompt's SECURITY section covers the public read path and SSRF and says nothing here. Two things are needed and neither is expensive: an in-app attempt limiter (Jellyfin has one too, per §11), **and** a structured auth-failure log line carrying the client IP, because the deployed reality of self-hosted software is that operators put fail2ban or CrowdSec in front of it. The second is impossible without the §7/§11 logging gap being closed first — which makes logging load-bearing for security, not just for diagnostics.
- **Trusting `X-Forwarded-For` only from configured known proxies** → **ABSENT**. MEDIUM. Any IP-based limiter behind a reverse proxy is trivially defeated by a spoofed header, and Next.js does not solve this for you. This is the concrete design rule the point above depends on.
- Log rotation as a documented behaviour → **ABSENT**, LOW-MEDIUM (part of the logging gap; unbounded logs on a self-hosted box fill the disk).

## 48. https://jellyfin.org/docs/general/post-install/networking/advanced/ipban
IPBan, a cross-platform fail2ban equivalent, configured against the **same two log lines** — a `FailedLoginRegex` and a `SuccessfulLoginRegex` both matching `Authentication request for <user> has been denied/succeeded (IP: "...")`, plus `MaxFileSize 16777216` and a dated log filename pattern `log_{year-local}{month-local}{day-local}.log`.
- Confirms §47 from a second tool: the product's real security integration surface is **a stable, greppable auth log line containing the IP and the outcome**, for both failure *and* success. **ABSENT**, folded into §47's HIGH. The success line matters independently: it is how an operator detects a breach that succeeded, which no lockout counter can tell them.
- Predictable dated log filenames as an interface → **ABSENT**, LOW.

## 49. https://jellyfin.org/docs/general/post-install/networking/advanced/letsencrypt
Certbot recipes per reverse proxy (Apache plugin and webroot, HAProxy standalone with concatenated `fullchain+privkey`, Nginx `--redirect --hsts --staple-ocsp`), plus cron renewal hooks and the linuxserver/swag container. One notable line: "**Caddy automatically handles obtaining an SSL certificate from Let's Encrypt when provided with a domain name. No manual action is required.**" Certificate operations only, no application capability.
- Certificate management → **ABSENT**, LOW as an application concern (§46 already places TLS at the proxy). Documentation-shaped: the one-line answer for CanonCore is "put Caddy in front", which is the same conclusion Jellyfin reaches on the next page.

## 50. https://jellyfin.org/docs/general/post-install/networking/advanced/monitoring
Short and directly relevant. "Jellyfin has **two monitoring and metrics endpoints built-in**: a basic health check endpoint and a Prometheus-compatible metrics endpoint."
`/health` — "Currently this will verify **HTTP and database connectivity** and return a `200 OK` response if successful." With a caution: "**The health endpoint will not function as expected while the server is still starting up. Monitoring/Watchdog programs could therefore kill the server when its running migrations.**"
`/metrics` — Prometheus, "**turned off by default to avoid unintentionally leaking this information on the public internet**", enabled by `<EnableMetrics>true</EnableMetrics>`, with advice to block it at the reverse proxy.

- **A health endpoint that checks database connectivity** → **ABSENT**. MEDIUM (raised at §36, now with the sharp edge attached). The caveat is the valuable part and it lands precisely on CanonCore's design: the prompt mandates a forward-only migration ladder applied by a released version, so **an upgrade that runs a long migration is exactly when a naive health check reports unhealthy and an orchestrator restarts the container mid-migration**. A health check must distinguish "starting/migrating" from "broken" — a readiness/liveness split, or a startup probe — or the migration ladder acquires a failure mode that has nothing to do with the schema.
- Metrics off by default because they leak → **ABSENT**. LOW at v1, but the default-deny reasoning is the same one the prompt applies to the public read path ("A field added later is private by default"), and any diagnostics surface added later inherits it.

## 51. https://jellyfin.org/docs/general/post-install/networking/dlna
DLNA. The headline is a **capability reversal**: "**DLNA support has been moved to a first party plugin and is not included in a Jellyfin base install since 10.9.**" Requires host networking and `1900/udp`, non-configurable because "UPnP is a standard Protocol expected to be on UDP port 1900". "DLNA discovery works by sending a broadcast to the current subnet ... **Using DLNA remotely is not possible.**" Troubleshooting: `[ERR] Failed to bind to port 1900: "Address already in use". DLNA will be unavailable`; and "**If a base URL is set, try removing it and restarting the server.**"
- DLNA/UPnP as a serving protocol → **ABSENT**. LOW — CanonCore's clients are its own, and §17 already records the "implement an existing client protocol" argument as knowingly DIVERGENT.
- The **reversal itself** is the transferable fact: a shipped, advertised feature was demoted out of the core into an optional plugin at 10.9. Read against the prompt's "Remove obsolete paths instead of adding compatibility layers", this is the incumbent doing exactly that — and it is only survivable because there is a plugin system to demote things *into*. CanonCore's equivalent escape hatch is the provider repo boundary, which is why "every provider we write lives in a separate repo" is load-bearing rather than tidy.
- Base URL breaking a subsystem → confirms §46: subpath hosting has real blast radius. **ABSENT**, MEDIUM, folded into §46.

## 52. https://jellyfin.org/docs/general/post-install/networking/reverse-proxy/
The reverse-proxy contract, and the most security-relevant page in the networking section. Three rules stated as things the application must cope with:
1. **Logging leaks credentials**: "Jellyfin sometimes sends **authentication information as part of the URL** (e.g. `api_key` parameter), so logging the full request path can expose secrets to your logfile. We recommend that you either protect your logfiles or do not log full request URLs or censor sensitive data."
2. **Forwarded-For**: "When traffic is forwarded through a reverse proxy, Jellyfin sees the proxy's IP address rather than the client's. This introduces potential security risks and can also break compatibility ... **if set up incorrectly, all limitations for external access will not work.** ... **By default, Jellyfin will discard all forwarded-for headers that do not originate from a 'known Proxy'.** This is so that malicious devices will not be able to hide their IP address by providing a forwarded-for header."
3. **Websockets**: "Jellyfin makes use of Websockets for various things. Not all reverse proxies allow this by default."
Recommendation: "We recommend using **Caddy** for its ease of use, especially with https." Ports 80/443 TCP, plus UDP 443 for HTTP/3.

- **Never put a credential in a URL** → **ABSENT**. **HIGH**, and it lands directly on a mechanism the prompt does specify. The prompt routes playback "through an app-owned **opaque-id route** so access control and progress work" — that route is exactly where a media server is tempted to put a token in the query string, because `<video src>`, `<img src>` and a download link cannot carry an Authorization header. Jellyfin took that path and now has to warn every operator that its own URLs leak secrets into nginx access logs, browser history, and `Referer` headers. CanonCore is not yet committed either way and can simply decide: the session cookie authorises the media route (same-origin, `SameSite`), and if a bearer token is ever unavoidable it is short-lived, single-resource and scoped to that opaque id. Deciding this before the route is built costs nothing; Jellyfin's position is unfixable without breaking every client.
- **Trust `X-Forwarded-For` only from configured known proxies, discard it otherwise** → **ABSENT**. MEDIUM-HIGH (raised at §47, and this is the canonical statement of it). Note the second-order consequence Jellyfin spells out: get it wrong and *every* IP-derived rule silently stops working — rate limits, local-vs-remote, and the audit log all degrade to "the proxy did it", with no error anywhere.
- **Websocket support as a deployment requirement** → **ABSENT**. MEDIUM, and it is the deployment half of §16's server-push gap: if CanonCore ever wants live enrichment progress, it inherits a documentation obligation, because a reverse proxy that has not been told to upgrade connections fails silently.
- Recommending exactly one reverse proxy rather than documenting five → a documentation-shape lesson; the four pages that follow are the cost of not doing so.

## 53. https://jellyfin.org/docs/general/post-install/networking/reverse-proxy/apache
Apache vhost. Concrete items: `ProxyPreserveHost On`; `RequestHeader set X-Forwarded-Proto "https"` and `X-Forwarded-Port "443"` set by hand; a `RewriteCond %{HTTP:Upgrade} =websocket` pair routing `/socket` to `ws://`; `ProxyPass "/.well-known/" "!"` so ACME challenges bypass the proxy; TLS hardening (`SSLProtocol all -SSLv2 -SSLv3 -TLSv1 -TLSv1.1`, `Protocols h2 http/1.1`); a subpath variant requiring the server's Base URL to be set to match. One product-revealing comment: "**Sometimes, Jellyfin requires clients to empty their cache to display and function correctly.** This header tells clients not to keep any cache", offering `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` as a workaround (commented out).
- **Client-side cache invalidation across upgrades** → **ABSENT**. MEDIUM. A stale web client talking to an upgraded server is a real self-hosted failure mode, and the incumbent's documented workaround is to disable caching entirely, which costs every page load. Next.js solves this properly with content-hashed build assets, which is a genuine advantage — worth naming so nobody reaches for the `no-store` hammer.
- Everything else is proxy configuration; **ABSENT**, LOW.

## 54. https://jellyfin.org/docs/general/post-install/networking/reverse-proxy/caddy
Caddy, the recommended proxy. "either method offers **automatic HTTPS** if you want to use your public domain name" — the whole config is `example.com { reverse_proxy 127.0.0.1:8096 }`, or one command `caddy reverse-proxy --from example.com --to 127.0.0.1:8096`. Subpath form: `redir /jellyfin /jellyfin/` + `reverse_proxy /jellyfin/* 127.0.0.1:8096`, requiring the server's Base URL to match, settable in `<Configuration Directory>/network.xml` if the UI is unreachable. Caution against pasting a DNS provider API token into the Caddyfile: "This is **NOT required for automatic HTTPS** in most cases ... **API keys should only be granted the least permissions required**."
- **A single recommended deployment recipe short enough to paste** → **ABSENT**. MEDIUM. The §35/§42 packaging gap has a two-line answer here (a compose file plus five lines of Caddyfile), and this page is the evidence that documenting one recommended path beats documenting five.
- **A settings escape hatch that does not require the UI** (edit `network.xml` when you have locked yourself out at the network layer) → **ABSENT**. MEDIUM. This is the same pattern as §6's `--restore-archive` and §11's `UPDATE Users SET InvalidLoginAttemptCount = 0`: three independent pages now say recovery must not depend on the web UI working. CanonCore's version is the forgotten single password (§11) and any misconfigured base path or origin.
- Least-privilege credential scoping → the same instinct as the prompt's "SHIP NO API KEYS"; **ADOPTED** in spirit.

## 55. https://jellyfin.org/docs/general/post-install/networking/reverse-proxy/haproxy
HAProxy config, short. The one item worth extracting is the health check wired into load balancing: `option httpchk` / `http-check send meth GET uri /health` / `http-check expect string Healthy` — so `/health` returns a body string, not just a 200, and a proxy will pull the backend out of rotation on it.
- Confirms §36/§50: **a health endpoint is consumed by three different layers** (orchestrator probes, watchdogs, load balancers). **ABSENT**, MEDIUM, folded into §50.
- `option forwardfor` — the proxy must be told to send the header at all, which is the other half of §52's known-proxies rule.

## 56. https://jellyfin.org/docs/general/post-install/networking/reverse-proxy/nginx
The densest proxy page, because its example carries **application-level headers the app itself does not set**:
- `client_max_body_size 20M;` with the comment "The default `client_max_body_size` is 1M, **this might not be enough for some posters, etc.**"
- `add_header X-Content-Type-Options "nosniff";`
- a very long `Permissions-Policy` disabling ~25 browser features (`camera=(), geolocation=(), interest-cohort=(), local-fonts=(), usb=()` …)
- a **Content-Security-Policy**, verbatim: `default-src https: data: blob: ; img-src 'self' https://* ; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.youtube.com blob:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; font-src 'self'` — with the note "External Javascript (such as `cast_sender.js` for Chromecast) **must be whitelisted**."
- `proxy_buffering off;` "when the nginx proxy gets very resource heavy upon streaming"
- `ssl_protocols TLSv1.3 TLSv1.2;`
- the log-censoring `map`/`log_format` pair that rewrites `api_key=` and `ApiKey=` URL parameters to `***` in the access log.

- **Security response headers (CSP, Permissions-Policy, nosniff, HSTS) as a stated part of the product** → **ABSENT**. MEDIUM-HIGH. Two things make this worse than generic hardening advice for CanonCore. First, `img-src 'self' https://*` is Jellyfin's admission that it cannot lock down image origins — and CanonCore's artwork model is *provider-supplied URLs rendered by the client* (§31, §18), so it has the identical hole, on a **public demo** where it leaks every visitor's IP to TMDB. A server-side artwork cache would let CSP be `img-src 'self'`, which is the security argument for §31's HIGH finding, independent of the availability argument. Second, the prompt's Safe External Fetch boundary is entirely server-side; CSP is the client-side half and nothing names it.
- **`proxy_buffering off` for the byte-serving route** → **ABSENT**. MEDIUM. Direct play means range requests streaming multi-GB files through Next.js. If a proxy buffers, or the app's own route reads a whole file into memory before responding, seeking breaks and memory blows up. The prompt commits hard to direct play and never states that the media route must stream with `Range`/`206` support and no buffering — the single most implementation-sensitive thing in the playback half.
- **Log censoring of `api_key` URL parameters** → the operator-side patch for the flaw in §52; **ABSENT**, HIGH there, not repeated here.
- Upload body-size limit needed "for some posters" → CanonCore refuses artwork uploads outright, so **REFUSED** and the limit never arises.

## 57. https://jellyfin.org/docs/general/post-install/networking/reverse-proxy/traefik
The longest proxy page: a full Traefik v2 stack (`docker-compose.yml`, `traefik.toml`, `traefik-provider.toml`, `.env`, `acme.json`), ACME via HTTP-01 or DNS-01/RFC2136, and a middleware block enumerating response headers one by one — `STSSeconds=315360000` with `STSIncludeSubdomains`/`STSPreload`/`forceSTSHeader`, `frameDeny=true` (X-Frame-Options DENY), `contentTypeNosniff`, `X-XSS-PROTECTION`, `SSLRedirect`, `SSLForceHost`, `passHostHeader=true`, and `customResponseHeaders.X-Robots-Tag=noindex,nofollow,nosnippet,noarchive,notranslate,noimageindex`. Operational cautions: secure or disable the Traefik dashboard ("**Pay attention to accessibility via IPv6, as even systems on an internal home network may be directly accessible over IPv6**"), `chmod 600 acme.json`, "TOML files can't support environment variables, so all values must be hard coded", and a closing suggestion to firewall port 8096 so the app cannot be reached bypassing the proxy.
- Duplicate of §56's header set in another syntax, plus HSTS. **ABSENT**, folded into §56.
- **`X-Robots-Tag: noindex, nofollow` on a self-hosted instance** → **ABSENT**. MEDIUM, and it is a genuinely CanonCore-shaped decision the prompt has not taken. CanonCore ships *two* deployments from one binary with opposite requirements: a private instance must never be indexed (a catalogue reveals what you own and what you have watched), while **the public demo is a publisher surface that presumably wants indexing**. That is a per-deployment robots policy plus a `robots.txt`, and the safe default is noindex with the demo opting in. Related: the demo carries a BY-SA attribution obligation on any archive-derived output, so what search engines may ingest is not purely a marketing question.
- Bypass risk: the app is still reachable on its own port unless firewalled → **ABSENT**, LOW-MEDIUM.

## 58. https://jellyfin.org/docs/general/post-install/networking/tailscale
Tailscale as the alternative to opening ports: "It provides an effective alternative in situations where opening ports is undesirable or not feasible, such as when the network is behind a **carrier-grade NAT (CGNAT)**, or if your ISP blocks incoming traffic." Two topologies documented — every client joins the tailnet and connects to `100.x.y.z:8096` directly, or the tailnet links the server to a **remote reverse proxy** (e.g. a VPS running Caddy), in which case "Add the reverse proxy Tailscale IP to the **known proxies** setting". Honest cons list: "Every client needs to have the Tailscale software installed · Needs extra, complex configuration to block clients from connecting to each other · **Requires an account with a 3rd party provider.**"
- **A documented "do not expose it, use a VPN overlay" option** → **ABSENT**. MEDIUM, and it is the constructive answer to §8's unresolved question of whether a CanonCore instance is expected to be internet-facing. Given the prompt ships one password, no signup, no lockout and no rate limiting (§47), the honest recommended posture for a private instance is an overlay network or LAN only, with internet exposure documented as a deliberate step that requires a reverse proxy in front. That is one paragraph and it changes the threat model the login form has to survive.
- Known-proxies again on a third page → confirms §52; the app must know which upstream addresses it trusts, whatever the topology.

## 59. https://jellyfin.org/docs/general/post-install/setup-wizard
The first-run wizard, five steps: **Select Language** ("This setting only affects the client you are using. Server-wide language settings will be configured later"); **Setup Administrator Account** ("Choose a strong password"); **Add Media Libraries** — a Content Type dropdown, a Display Name, and one or more folders, with "Alternatively, click 'Next' without adding anything to **skip this step and add media later**" and "If you don't see your media folders listed, **you might have permission issues**"; **Preferred Metadata Language** — "a preferred language and region for metadata fetching as the **server-wide default**. Metadata from other language/regions may be fetched if metadata is not available with your preferred settings. This **can be further customized on a per-library basis**"; **Networking** — "it is recommended to **disable** [automatic port mapping] unless it is specifically required" because UPnP is "a protocol commonly associated with security concerns".

- **A first-run flow that creates the single account** → **ABSENT**. MEDIUM. The prompt says `owners` is "ONE row. Single user, one password, no signup" and never says how that row comes to exist: an env var read at boot, a first-request claim flow, or a CLI command. It matters more than it looks — §9 recorded that Jellyfin's `IsStartupWizardCompleted=false` "can be a security risk especially if remote access is enabled", i.e. an instance that is reachable before its owner exists is claimable by whoever finds it first. CanonCore's public demo makes this concrete: the same image runs read-only-no-login and owner-with-password, and nothing states how the two are distinguished at boot.
- **The wizard is skippable and every step is revisitable** → worth noting against the prompt's "It is NOT A WIZARD" rule, which is scoped to *enrichment*, not to setup. Jellyfin's setup wizard is the one place a wizard is legitimate — it is once-per-install and linear by nature — so this is not a contradiction, and a first-run flow does not reopen the enrichment decision.
- **A preferred metadata language, server-wide with per-library override** → **ABSENT**. MEDIUM-HIGH, and it is the sharpest form of the i18n gap first raised at §23. This is the incumbent's answer to a question CanonCore's model asks more insistently than Jellyfin's: with multi-valued statements and per-field provenance, "the title in French from TMDB" and "the title in English from the wiki" are two statements about one item that CanonCore currently cannot tell apart, because nothing says a statement value carries a language tag. Jellyfin discards the losers so it only needs one setting; CanonCore keeps them all and therefore *needs* the tag to display the right one. Schema.org, BIBFRAME and Wikibase all tag literals with a language, so the governing rule points the same way. Adding it later is a statements-table migration, which the prompt itself names as the thing that cannot be retrofitted.
- Library "Content Type" chosen at creation → **DIVERGENT**, deliberately: "WHY never typed by medium: a Plex library is typed, and that is exactly what stops a container holding mixed media."
- UPnP automatic port mapping → **ABSENT**, LOW (and the incumbent recommends against its own feature).

## 60. https://jellyfin.org/docs/general/post-install/transcoding/
Transcoding settings overview. **REFUSED** wholesale ("Direct play only. No transcoding, no ffmpeg, no quality ladders"). Two things survive extraction:
1. **The four-way playback taxonomy, ordered by server load**: "Direct Play: Delivers the file without transcoding ... **Remux**: Changes the container but leaves both audio and video streams untouched. **Direct Stream**: Transcodes audio but leaves original video untouched. **Transcode**: Transcodes the video stream." (Note this contradicts §13, which used "Direct Stream" for the remux case — the incumbent's own docs are inconsistent about its central vocabulary, which is an argument for the prompt's `record`/`edge`-style banned-word discipline.)
2. **Who decides**: "Transcoding of local sources is **always requested by the client**. The client will send transcoding profile(s) to the server containing information about its capabilities, such as supported codecs, resolutions, bitrate and additional constraints. The server will then pick the settings with the best quality within its capabilities."
- **The client declares its capabilities to the server** → **ABSENT**. MEDIUM. Under direct-play-only the negotiation collapses to a yes/no, but the *input* is the same and CanonCore has none of it (§13, §31 device profiles). Without a declared client profile, "When a file will not play, say so plainly" can only be implemented as a post-hoc `<video>` error handler. That may be an acceptable answer — but it is a decision, and the prompt reads as though the honest message were free.
- Thread count, bitrate, resolution, HDR tone-mapping → **REFUSED**.

## 61. https://jellyfin.org/docs/general/post-install/transcoding/downmix
Stereo downmix algorithms used when a client cannot play surround: `None` (ffmpeg's own matrix, the default and fallback), `Dave750`, `NightmodeDialogue` ("strongly emphasizes the center channel", for clear dialogue), `RFC7845` (the Opus spec's matrix), each documented with explicit **Strengths and Weaknesses**. Entirely a transcoding feature → **REFUSED**.
- One transferable observation, not a gap: the page is a model of how to present a **tunable with no correct default** — name each option, state what it optimises for, and state its weakness. The prompt has exactly two such tunables ("Both numbers tunable" for the enrichment high and low bars) plus the source order and the edition order, and a confidence threshold with no stated calibration is the closest thing in the design to an unexplained knob. **ABSENT** as a documentation obligation, LOW-MEDIUM.

## 62. https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/
Hardware acceleration overview: six HWA methods (QSV, NVENC, AMF, VA-API, VideoToolbox, RKMPP), a six-stage transcoding pipeline (decode → deinterlace → scale/format → tone-map → subtitle burn-in → encode, plus zero-copy), a vendor × OS matrix, and the requirement to use the patched `jellyfin-ffmpeg` ("Using FFmpeg binaries downloaded from somewhere else will result in **partial acceleration**"). **REFUSED** by "No transcoding, no ffmpeg".
- One item is not about transcoding and is worth recording: **`rffmpeg`, remote hardware acceleration** — "If your Jellyfin server does not support hardware acceleration, but you have another machine that does, you can leverage rffmpeg to delegate the transcoding to another machine ... requires SSH between the machines, as well as **shared storage for media and the Jellyfin data directory**." The shape — offload an expensive job to a second machine that shares the storage — is the only *architectural* idea in this section, and it is the same shape as the prompt's own resolution of the Cloudflare problem ("ONE service, run on a machine the owner controls, is the only thing that ever touches tardis.wiki"). No gap; noted as a convergent pattern.

## 63. https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/amd
AMD HWA setup (AMF on Windows, VA-API + Vulkan interop on Linux), Mesa driver installation, `/dev/dri` device passthrough for containers, per-generation codec support tables. Entirely transcoding → **REFUSED**.

## 64. https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/apple
VideoToolbox on macOS, with two tone-mapping backends (Metal vs VideoToolbox Native) each given pros and cons, and the fallback rule "When both methods are enabled, VideoToolbox Native will be used for most videos, and **Metal will only be used as a fallback for Dolby Vision Profile 5 videos**". Hardware support gated by model year ("all Macs from 2017 and later, with the exception of the MacBook Air (13-inch, 2017)"). **REFUSED**.
- Passing note, not a gap: the pattern "a preferred method plus a declared fallback used only for the cases the preferred one cannot handle" is the same shape as the prompt's edition-default rule (`is_default` pin, then a declared edition order) and its source order. Convergent, already ADOPTED.

## 65. https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/intel
The longest page in the section: QSV and VA-API across Windows and Linux, kernel and firmware requirements per GPU generation, Low-Power encoding, Docker device passthrough, verification commands. **REFUSED**.

## 66. https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/known-issues
A catalogue of driver, kernel and firmware bugs by vendor and version — "Intel 11th Gen and newer ... driver issue ranging from 31.0.101.5186 to 31.0.101.5534 ... green or blue screen but normal sound"; "The default kernel 5.15 that comes with Ubuntu 22.04 LTS has a regression"; "**Resizable-BAR is mandatory** for hardware acceleration on BMG / ARC B-series cards, or the media driver will crash the transcoder"; distros that strip H.264/HEVC from Mesa. **REFUSED** in content.
- Worth one line as a **maintenance-cost exhibit**: this page is what "we support hardware transcoding" actually costs — a permanently-maintained matrix of third-party driver and kernel version bugs, none of them the project's own fault or within its power to fix. It is the strongest single piece of evidence for the prompt's "Direct play only. No transcoding, no ffmpeg, no quality ladders", and it is a page CanonCore will never have to write.

## 67. https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/nvidia
NVENC/NVDEC setup: driver versions, the NVIDIA Container Toolkit, `--gpus all`, per-architecture encoder session limits and codec matrices. **REFUSED**.

## 68. https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/rockchip
RKMPP on Rockchip SoCs (RK3588/3588S), kernel and MPP library requirements, device nodes, ARM SBC specifics. **REFUSED**.

## 69. https://jellyfin.org/docs/general/quick-start
Three-line quick start: install, run the setup wizard, "Enjoy your media!", plus optional client install and remote access. Marketing-shaped stub with no rules. **ABSENT**, LOW.
- One line worth noting: the entire onboarding narrative is **install → wizard → media**, i.e. the shortest path from nothing to a working instance is three steps. CanonCore's equivalent path has an extra mandatory step nobody has written down — connect a provider — because the prompt states that "A fresh install by anyone else starts EMPTY, with no content of any kind" and "A private instance with no provider connected has no artwork". The empty state is therefore the first screen every new self-hoster sees, and what it says is undecided (see the §35/§42 packaging gap and §59's first-run gap).

## 70. https://jellyfin.org/docs/general/server/devices
A **device register**: "You can view all devices that have connected to the server ... This will include both currently connected devices and any that have connected in the past." One option, editing the display name, with "The original name will stay visible in the options if you modify the value." Removal "does not hide the device forever, it simply cleans out old entries" — a device that reconnects reappears.
- **A device / session register** → **ABSENT**. MEDIUM. Three separate prompt decisions imply it and none names it: the phone and TV clients need somewhere to authenticate from (§15), progress is per (owner, edition) with an **append-only event log** whose events plainly come from *somewhere*, and a single shared password with no lockout (§47) means "which devices are currently holding a session" is the only way an owner can detect misuse or revoke access without changing the one password. Jellyfin's version is deliberately thin — a list, a rename, a delete that does not blacklist — and even that thin version is more than CanonCore specifies.
- The rename pattern (an owner-supplied display name that never destroys the original) → the same instinct as the prompt's alias table and its "two claims rather than a lost value" merge rule. Convergent, no gap.

## 71. https://jellyfin.org/docs/general/server/libraries
Libraries. Definition, verbatim: "**Libraries are virtual collections of media and can contain files from several different locations on the server**", and "You can add **multiple paths** that will all be shown under the same library." Content types: movies, shows, music are "the three most common ... These will have the best support in client apps", plus books and photos, plus **mixed** — with the caution "**Use of the mixed library type is currently discouraged due to unreliable metadata results. We encourage the use of the dedicated library types.**"
- **A typed library** → **DIVERGENT**, deliberately, and this page is the incumbent conceding the exact cost the prompt cites: Jellyfin ships a mixed type and then tells you not to use it, because its metadata pipeline is keyed on the library's declared type. The prompt's rule — "WHY never typed by medium: a Plex library is typed, and that is exactly what stops a container holding mixed media" — is confirmed here by Jellyfin as well as Plex. CanonCore's `groups` are "a BROWSING SCOPE, not a wall" and untyped, so the mixed case is the *default* rather than a discouraged option.
- **Multiple filesystem roots per scope** → **ADOPTED** in shape: the prompt scopes "scanner roots" by group, which is the same many-paths-to-one-scope relation.
- Scanning progress shown live ("There will be a progress bar at the top of the page indicating its progress") → **ABSENT**. MEDIUM, and the same gap as §16's server-push: the prompt's enrichment "runs in the background against the thresholds" and the projection rebuilds wholesale, with no stated way for a page to show that anything is happening. On a first import of a large catalogue, an empty screen with no progress is the entire first-run experience (§69).

## 72. https://jellyfin.org/docs/general/server/live-tv/
Live TV and DVR. Two tuner types built in (**HDHomeRun**, auto-detected on the LAN; **M3U** for IPTV playlists), "Additional tuner types are available via plugins". Two guide-data formats built in (**Schedules Direct**, a paid non-profit service; **XMLTV**), which "will need to be **mapped to their corresponding channels**". A tuner status page with manual refresh, and guide data "refreshed periodically".
- Live TV / DVR as a product area → **ABSENT**, LOW (already settled at §1: CanonCore never stores media and does no transcoding).
- The one structurally interesting item: **the channel-mapping step**. Guide metadata and the physical stream arrive from two unrelated sources and a human must state which record corresponds to which — that is a **reconciliation UI**, and it is precisely CanonCore's review queue in another domain. Jellyfin builds it here and nowhere else; the prompt builds it once, generally, with remembered rejections. No gap, a confirmation that the mid-confidence band always needs a human surface.

## 73. https://jellyfin.org/docs/general/server/live-tv/internet-radio
Adding internet radio via the M3U tuner. Rules: each stream needs an `#EXTINF:0,<title>` line "to give it a 'channel' entry ... Failing to add this line will cause the station to not show up"; and the honest failure note — "Adding an M3U HTTP link instead of a locally created M3U file will **almost certainly fail** ... Pretty much no Internet radio will include this directive in their M3U files. Besides that, **many radio stations use AJAX to dynamically update the M3U-files while listening, something that is not handled by Jellyfin.**"
- Live streams as catalogue entries → **ABSENT**, LOW. A stream has no extent, no completion and no edition; it is outside the prompt's model by construction (`files` are bytes with a content hash, which a live stream cannot have).
- Worth one line as a **documentation-honesty exhibit**: the page tells you plainly that the supported path mostly will not work, and why. That is the same posture the prompt asks for in "When a file will not play, say so plainly" and in the Cloudflare 403 rule ("EXPECT A 403 FROM THE LIVE WIKI, AND DO NOT TREAT IT AS A BUG").

## 74. https://jellyfin.org/docs/general/server/live-tv/post-process
DVR recording post-processing: the server runs an operator-supplied executable when a recording finishes, passing `{path}` as an argument — `"/path/to/run_post_process.sh" "\"/path/to/LiveTV/.../Episode.ts\""`. Warnings: "Quote interpretation is one of the hardest things to manage when using a post-processor script", and "**any output to stdout/stderror will not be seen in the Jellyfin logs**", so the script must do its own logging. Suggested uses: transcode, extract subtitles, remove commercials, "Post transcode progress to a Slack/Discord channel".
- **An operator-configurable hook that executes an arbitrary local command** → **REFUSED** in spirit by the prompt's provider rule ("not a plugin, not a repo, and **never code running inside the app**") and by "No transcoding". Recording it deliberately: a shell-out hook is the cheapest possible extension point and it is exactly the kind of thing that gets proposed later as "just a post-import script". It is also a straight command-injection surface (Jellyfin's own docs cannot get the quoting right) and it writes to the filesystem, which the prompt forbids ("The scanner NEVER writes storage").
- The notification idea (tell Slack when a long job finishes) → the same want as §31's notification subsystem; **ABSENT**, LOW-MEDIUM, see §89.

## 75. https://jellyfin.org/docs/general/server/live-tv/setup-guide
Step-by-step tuner and guide setup. Details worth keeping: automatic LAN discovery of tuners with a manual fallback; per-tuner options including "**Restrict to channels marked as favorite**" (an import filter set on the *source*, not in Jellyfin) and "**Simultaneous stream limit** will restrict the number of streams the server can have open at one time. Setting this value to '0' will allow for unlimited streams"; an M3U **User agent** field "needed in special cases where you need to supply a custom HTTP header to access the remotely stored M3U8 playlist"; "You currently **cannot use both** [guide providers] at the same time"; then the manual channel-mapping pass.
- **A per-source concurrency limit** → **ABSENT**. MEDIUM, and it sharpens §11's unbounded-concurrency finding into something provider-shaped. The prompt's enrichment "reaches ALL connected providers at once" and TMDB is explicitly "rate-limited", yet no per-provider concurrency or request-rate cap is specified anywhere — and a rate limit that lives only in the provider's own repo cannot protect a source that two groups both ask. This is a contract-level field (declared by the provider, honoured by CanonCore), not an implementation detail.
- **A configurable User-Agent / custom header per source** → **ABSENT**. LOW-MEDIUM, but it is the exact shape of the tardis.wiki Cloudflare problem the prompt already documents. The prompt's answer is architectural (one owner-controlled service is the only thing that touches the wiki) rather than a header field, which is the stronger answer; noting that the incumbent's cheap version exists and is not sufficient.
- **Only one guide provider at a time** → **DIVERGENT**, and it is the single-primary-source design the prompt explicitly refuses: "A single primary source with others filling gaps is REFUSED: that is Jellyfin's design, it merges first-non-empty-wins and DISCARDS the losing answers." Here Jellyfin cannot even do that much — a second source is not connectable at all.

## 76. https://jellyfin.org/docs/general/server/media/books
Books. Two rules dominate, both verbatim: "**The bookshelf plugin is required for books libraries**" and "**Online metadata is not supported for the books library type.**" Organisation is "by type (Audiobooks, Books, Comics), then optionally by Author. Each book should be in their own folder." Formats: `azw, azw3, cb7, cbr, cbt, cbz, epub, mobi, pdf, zip, rar, 7z`, plus common audio for audiobooks. "**Read-along audiobooks are not supported by Jellyfin.**" Metadata comes from embedded epub metadata, or an external `content.opf` / `metadata.opf` / `ComicInfo.xml` (ComicRack and ComicBookLover formats), or from the filename: "information about year and issue number can be provided in the file names", with the rule "**For comics or magazines with issues across multiple years, the year of the first issue should be used.**"
- **Books as a second-class medium** → **DIVERGENT**, and this page is the sharpest single piece of evidence for CanonCore's domain-general claim. In Jellyfin the *medium decides whether metadata exists at all*: movies and shows get a provider pipeline, books get a plugin and a hand-written XML file. CanonCore's providers are attached to groups and answer a medium-agnostic contract, and `edition.medium` is explicitly "a PLAYBACK MEDIUM, NOT A WORK TAXONOMY" — so a text edition of a work reaches the same search/lookup/browse contract a video edition does. The incumbent's structure makes "text, video and audio in one place" (the demo's Harry Potter group, verbatim) impossible by construction.
- Ordering from filename again: **issue number in the filename**, and the "year of the first issue" convention exists purely so a string sorts correctly. Same disease as `S01E01`, in a medium with no seasons.
- **Read-along (synchronised text + audio)** → **ABSENT**. LOW — it is a renderer feature, and the prompt already separates cataloguing from displaying ("a renderer is needed only when a file is attached and someone presses play").
- **`content.opf` / `ComicInfo.xml` as a metadata source** → **REFUSED** by extension of the `.nfo` rule: "No artwork uploads, no artwork scanning, no `.nfo` reading. The scanner takes media files and playback sidecars, and nothing else." These are `.nfo` under other names. Recording them because they are the ones an implementer would not recognise as `.nfo` and might wave through as "standard formats".

## 77. https://jellyfin.org/docs/general/server/media/excluding-directory
Scan exclusion. Mechanism, verbatim: "To exclude an entire directory, place an **empty file named `.ignore`** inside the directory. This directory, and all files and subdirectories within it, will be excluded." And, newly: "When a `.ignore` file is **not empty, it is treated as a list of items to ignore using the same format as a Git `.gitignore` file**" — `*.avi`, `sample.mkv`, `specials/`. Carrying a migration warning: "This is a new feature in **Jellyfin 10.11.x and later**; older versions did not care about the contents of `.ignore` files. **Legacy non-empty `.ignore` files must be manually corrected or they will stop functioning as expected.**" Plus the operational note that a rescan is required for a change to apply.
- **Scan exclusion of any kind** → **ABSENT**. **MEDIUM.** The prompt scopes "scanner roots" by group and says nothing about excluding anything beneath one; every real media tree has sample files, work-in-progress folders, `@eaDir`, `.Trash`, and rips being encoded, and without exclusion they all become catalogue rows the owner must delete by hand.
- Note the mechanism CanonCore must NOT copy: `.ignore` is a file **on disk**, and the standing rule is "The scanner NEVER writes storage. It never creates folders, never moves files, never writes its structure to disk." Reading a config file is not writing one, so a dot-file convention is not literally forbidden — but the exclusion list belongs in the database next to the scanner root, where it can be edited from the UI, versioned by the change sequence, and backed up with everything else. A rule that lives only on the media volume is invisible to the product and lost with the mount.
- **A behavioural change to the on-disk convention that silently breaks existing installs** → a maintenance-cost exhibit. The prompt's migration ladder is rigorous about the *schema* ("MIGRATIONS ARE AN ORDERED, FORWARD-APPLICABLE LADDER FROM THE FIRST COMMIT") and has nothing to say about conventions the product asks users to encode outside the database, because on the prompt's design there are none. That is the payoff: an exclusion list in a table gets migrated; a `.ignore` grammar cannot be, and Jellyfin's own docs can only tell users to go and fix their files.

## 78. https://jellyfin.org/docs/general/server/media/mixed-movies-and-shows
The entire page, verbatim: "**This library type is broken and deprecated. It is not recommended to use this.**"
- This is an **escalation of §71**, and worth recording as such. On the Libraries page the mixed type is "currently discouraged due to unreliable metadata results"; on its own page it is *broken and deprecated*, and the page has been reduced to one sentence with no documentation left at all. A media server whose libraries are typed cannot hold mixed media, and after enough years the honest thing is to say so.
- → **DIVERGENT**, and it retires the argument. The prompt's rule — "WHY never typed by medium: a Plex library is typed, and that is exactly what stops a container holding mixed media" — is now confirmed by both incumbents, and by Jellyfin twice, in its own words. CanonCore `groups` are "a BROWSING SCOPE, not a wall", untyped, so the mixed case is the default rather than a deprecated option. The demo's Harry Potter group (text, video and audio in one place) is precisely the library Jellyfin has given up on building.

## 79. https://jellyfin.org/docs/general/server/media/movies
**The most important page in this shard.** It is Jellyfin's filesystem-organisation model stated in full: how a file becomes an item, how versions are recognised, and what the filename must encode. Read as a specification of what CanonCore refuses, it is also a specification of what CanonCore has not yet written down.

The rules, verbatim where they are rules:

- **The folder is the item.** "Movies should be organized into individual folders for each movie." Item identity is a *path*.
- **Naming grammar**: "The folder containing the movie should be named in the following format: `Movie Name (year) [metadata provider id]`. The year and metadata provider id fields are optional, but they will help identify media more reliably." And "The video files within the folder should have the same name as the folder."
- **Reserved characters**: "certain characters cannot be used as they are reserved by jellyfin. Including them WILL cause problems. The following characters are known to cause issues: `<, >, :, ", /, \, |, ?, *`" — the filesystem's reserved set becomes the *catalogue's* reserved set, so a title containing a colon cannot be spelled correctly anywhere in the system.
- **Multiple versions** (Jellyfin's editions): "Each file must begin **exactly** with the parent folder name — including any year and/or metadata provider IDs — before adding a version label. This prefix must match **character-for-character**; otherwise, the files will be treated as separate movies." The label grammar is rigid: "each filename needs to have a space, hyphen, space, and then a label. Labels are not predetermined and can be made up by the user. **The hyphen is required. Periods, commas and other characters are not supported.**" Optional brackets. And the failure mode, stated plainly: "If labels are not added to the end of filenames ... each file will be treated as a unique movie and not a version of the same movie."
- **Which version opens**, verbatim: "Movie versions are presented in an **alphabetically sorted list**. An exception applies to resolution names, which are sorted in descending order from highest to lowest resolution. **A version name qualifies as a resolution name when ending with either a `p` or an `i`.** The **first movie version in the list is the one selected by default.**" Worked example given: "Extended Cut, Cinematic Cut, Director's Cut → Cinematic Cut, Director's Cut, Extended Cut".
- **Manual escape hatch**: "To group media manually, long-click or right-click media to highlight then select additional media to merge. Use the new bar that appears to 'Group Versions'."
- **Multiple parts (stacking)**: `Movie Name-cd1.mkv` … `-cd3.mkv`. "The separator is optional between `<parttype>` and `<partnumber>`. `<partnumber>` can be any number, or the letters a-d." Part types: `cd, dvd, part, pt, disc, disk`. Separators: space, `.`, `-`, `_`. And the limit: "**This does not work with multiple versions or merging.**"
- **3D**: a closed flag vocabulary `hsbs, fsbs, htab, ftab, mvc` ("Anaglyph — Not Supported"), case-insensitive, "must be surrounded by either a space, hyphen `-`, dot `.`, or underscore `_`".
- **Sidecars**: `Film.default.en.forced.ass`, `Film.en.sdh.srt`, `Film.English Commentary.en.mp3`. Flags: `default`; `forced, foreign`; `sdh, cc, hi`. The collision rule is documented: "`hi` collides with the Hindi language abbreviation. `hi` by itself will resolve as a Hindi language track, while `hi` in addition to another language identifier (such as `title.en.hi.srt`) will use the other language and tag it as hearing impaired." Then: "**Flags are ignored on containers with more than one stream**", and "Any arbitrary text not parsable to a language or flag will be combined and used as the **title of the stream** (if there is not a stream title already embedded in the file metadata)."
- **Extras**: eleven magic folder names (`behind the scenes, deleted scenes, interviews, scenes, samples, shorts, featurettes, clips, other, extras, trailers`, plus `theme-music`, `backdrops`), two magic filenames (`trailer`, `sample`), and thirteen filename suffixes (`-trailer, .trailer, _trailer, ` trailer`, -sample, .sample, _sample, ` sample`, -scene, -clip, -interview, -behindthescenes, -deleted, -deletedscene, -featurette, -short, -other, -extra`), with the warning "with a few noted exceptions, these suffixes DO NOT contain any spaces".
- **Theme media**: `theme.ext`, `theme-music/*`, `backdrops/*`; "In case both Theme songs and Theme videos are found and enabled, **Theme videos will be preferred**"; "if there are multiple Theme media found, they will be **shuffled** when opening the listing. **This cannot be changed.**"
- **Artwork scanning**: eighteen magic filenames mapped to five used types across seven content types, usable standalone or as a suffix; "When external images are provided ... **they will take precedence over other sources**"; multi-backdrop ordering by numeric filename suffix (`backdrop-1.jpg`, `backdrop2.jpg`); and eight image types listed as **Unused** (`Art, Disc, Box, Menu, Chapter, BoxRear, Profile, Screenshot — Unused, Deprecated`) that the scanner still recognises.

Classification and what it exposes:

- **The whole model — path as identity, ordering and version in the filename** → **REFUSED**, and it is the founding refusal. The prompt's reason #2 for existing is "ORDERING LIVES IN FILENAMES", and the standing rule is "The scanner NEVER writes storage ... Every catalogue that writes the filesystem has a single-parent model, and that is a requirement rather than a coincidence." This page is that coincidence stated as a product manual: a file has exactly one path, one path has exactly one parent, so a filesystem-organised catalogue is a tree, and multi-placement is unreachable from here. Every rule above follows from it.
- **`is_default` versus alphabetical sort** → **DIVERGENT**, decisively in CanonCore's favour, and worse than the prompt anticipated. The prompt refuses picking the default edition by recency ("importing a remaster would silently flip every default"). Jellyfin does not use recency — it uses **alphabetical order**, with a heuristic special case for strings ending in `p` or `i`. So the canonical cut of a film is whichever cut's name sorts first, "Cinematic Cut" beats "Director's Cut" on the letter C, and a version named `Rip` sorts as a resolution. The prompt's mechanism — "`is_default` is the owner's PIN — nullable, at most one per item — and where nothing is pinned a single declared edition order decides" — is exactly the missing piece, and Calibre is correctly cited as the only mature precedent.
- **Character-for-character prefix matching as version identity** → the same failure the prompt names in reason #4 ("A Plex collection can only appear to span libraries when the collections carry exactly the same NAME, matched as strings"), reproduced *inside a single folder*. A one-character difference does not produce an error; it silently produces two movies. CanonCore's editions are rows with foreign keys, so the class of bug does not exist.
- **`.nfo`, artwork scanning, extras folders, theme media, 3D flags** → **REFUSED** wholesale: "No artwork uploads, no artwork scanning, no `.nfo` reading. The scanner takes media files and playback sidecars, and nothing else. Artwork comes ONLY from providers." The artwork filename table is the strongest argument for that refusal on the site — eighteen filenames × seven content types, a precedence rule with no provenance ("they will take precedence over other sources" — over *which* source, asserted by whom, is unanswerable in Jellyfin and is precisely reason #3 for CanonCore existing), and eight recognised-but-unused types kept alive because removing them would break somebody. CanonCore's artwork table carries "the licence and attribution string it came with", which no filename can.
- **A closed magic-string vocabulary for supplementary material** → the counter-example to the prompt's `category` statement design. Jellyfin needs 11 folder names + 13 suffixes to say "this is a featurette"; CanonCore says it with one `category` statement that can be sourced, disputed and retired.

**The gaps this page opens in CanonCore.** Refusing the mechanism does not remove the requirement it was meeting, and four of these have no answer anywhere in the prompt:

- **How a scanned file binds to an item or edition** → **ABSENT**. **HIGH.** This is the single largest hole this shard finds. The prompt fully specifies file *identity* — "Identity is SHA1(size + SHA1(first 64KB) + SHA1(last 64KB))" and "PATH IS LOCATION, NOT IDENTITY, so a moved file is the same file" — and fully specifies where a file *ends up*: "Attached to item or edition, NEVER to a placement." It never says how the scanner gets from one to the other. Jellyfin's answer is the path; CanonCore has explicitly thrown the path away as an identity signal and put nothing in its place, and it cannot fall back on the provider contract, because a provider matches *records*, not bytes on the owner's disk. The stop condition conceals this: it ends at a rendered page, and "THE SCANNER" is named in the list of things the four conditions deliberately do not touch — so this ships built and unproven, and it is the first thing that will be found broken. At minimum the model needs a stated answer to "an unbound file arrives; what happens?" — most likely an unmatched-files queue reusing the review queue and its remembered rejections, which is the mechanism the prompt already owns.
- **One edition spread across several files (stacking)** → **ABSENT**. **HIGH.** `-cd1/-cd2/-cd3` is a real and common shape (disc rips, tape captures, the archive's own multi-part serials). CanonCore's `files` row carries bytes, an attachment point and a role — and **no part index and no ordering**. Two files attached to one edition therefore have no defined play order, and `edition_coverage` cannot supply one: it is "a SET OF INTERVALS" describing what fraction *of the work* an edition covers, deliberately at the level of the work's parts, not of file segments. Note Jellyfin's own limit here, verbatim: "This does not work with multiple versions or merging" — stacking and versioning are mutually exclusive in the incumbent, so a two-disc director's cut is unrepresentable there. CanonCore has the structure to do better (an ordinal on `files`) and has not specified it.
- **Sidecar association and language** → **ABSENT**. **MEDIUM.** The prompt says files carry "role: media|subtitle|audio|chapters, and a sidecar references the file it accompanies plus a language", which is the data model but not the discovery rule: how the scanner decides a given `.srt` accompanies a given `.mkv`, where the language comes from, and what happens to `forced`, `default` and `sdh`. Jellyfin encodes all of it in the filename, documents the `hi`/Hindi collision as a known ambiguity, and then admits "Flags are ignored on containers with more than one stream". CanonCore needs the flags as fields on the file row — they are playback facts, not `category` statements — and needs to say where they come from when the only available signal is a filename it refuses to treat as authoritative.
- **Extras and supplementary material** → **ABSENT**. **MEDIUM**, and it contains an internal inconsistency in the prompt worth naming. Trailers, commentaries, featurettes and deleted scenes are not editions ("AN EDITION EXISTS WHEN IT CHANGES WHAT YOU WOULD CONSUME OR HOW"), are not adaptations, and the `files` role vocabulary is closed at `media|subtitle|audio|chapters` with no `extra`. Yet the playback section says "**Force-complete anything under five minutes so trailers never sit in Continue Watching**" — so trailers demonstrably play, and demonstrably accrue progress, and progress is "per (owner, edition)". A trailer must therefore already be an edition of something, and nothing in the prompt says of what. Either extras are items with their own editions linked by a statement, or the role vocabulary opens; it needs deciding rather than discovering.
- **Which extensions and container shapes the scanner accepts** → **ABSENT**. MEDIUM. Jellyfin names its edges (`VIDEO_TS` and `BDMV` folders supported but "do not support multiple versions, multiple parts or external subtitle/audio tracks"; "`.iso` files and other disc image formats should work, but are not supported"). CanonCore names no accepted set at all, and "direct play only" makes the answer client-dependent rather than server-dependent, which is a harder question, not an absent one.
- **Where duration comes from** → **ABSENT**. **HIGH**, and this one bites a rule the prompt states as settled. Completion is "TIME REMAINING under a small absolute figure, not a percentage", with "Percentage is the fallback only where duration is unknown", and "Force-complete anything under five minutes" — three rules that all need the duration of the file in front of the user. A provider can supply a *work's* runtime, but not the runtime of the owner's particular file, which is what a player needs; the usual answer is `ffprobe`, and the prompt says "**No transcoding, no ffmpeg**". Either the ban is on the transcoding half of ffmpeg and probing is allowed, or duration comes from the client at playback time, or these three rules are unimplementable. Say which.

## 80. https://jellyfin.org/docs/general/server/media/music
Music, and the one library type organised by **embedded tags rather than by filename**: "Filenames generally do not matter since the info will be scraped from the embedded metadata of the tracks. If no other metadata was found, Jellyfin uses the file names as track titles." The one structural constraint remains a folder rule: "**one folder containing one and only one album**", though "Jellyfin does not care how you organize albums together". Multi-disc albums "are identified by the metadata tags with the disc number and total discs fields ... They can optionally be separated into disc folders, but **embedded metadata takes priority**". Lyrics are sidecars matched by exact basename — `.lrc`, `.elrc` or `.txt` — synchronised (`[00:10.89]Line 1`) or not, with click-to-seek. Container gotchas are enumerated: audio-only `.mp4` → rename to `.m4a`, audio-only `.mkv`/`.webm` → `.mka`, `.weba` unsupported; FLAC with embedded WebP or ID3 tags "may fail to play in Chromium based browsers"; "**Files with ID3v1 tags have a length limit of 30 bytes for most fields. Anything longer will be truncated.**"
- **Reading embedded tags from the media file** → **ABSENT**, and it is the ambiguity in the prompt's own refusal. "No `.nfo` reading. The scanner takes media files and playback sidecars, and nothing else" bans the *sidecar* metadata file and says nothing either way about metadata carried *inside* the media file. Rated with §79's duration finding: the same question, and one answer should cover both. **MEDIUM** on its own — an owner's ripped library has its entire track, disc and album structure in ID3/Vorbis tags and nowhere else, and a provider cannot supply "which track of which disc this file is".
- The `one folder = one album` rule → the tree again, this time as the *only* surviving filesystem constraint after everything else moved into tags. Even the library type that tries hardest to escape the filesystem cannot drop the folder as the grouping unit, because there is no other place to put the grouping. CanonCore's placements table is that place.
- **`disc number` / `total discs` as first-class fields** → in CanonCore these are ordinary statements on the edition (or placements in an ordered container), and the "total" half is the extent question the prompt already settles: "EXTENT IS A STATEMENT, not a column ... DO NOT DERIVE EXTENT from the maximum part covered by any edition." Jellyfin derives exactly that, from a tag, per file.
- **Lyrics as a recognised sidecar kind** → **ABSENT**. LOW. The `files` role vocabulary is `media|subtitle|audio|chapters`; lyrics fit the same shape (a timed text track accompanying one media file) and would be a fifth role, not a new mechanism.
- ID3v1's 30-byte truncation → a small exhibit for the prompt's "Imports are dirty" and vocabulary quarantine: silently truncated fields are exactly the "one-use wreckage" the quarantine state exists to hold.

## 81. https://jellyfin.org/docs/general/server/media/music-videos
Music videos: "organized mostly the same as movies, with a few key differences — **no external metadata providers are available by default, and multi layer folders are supported**". Naming, verbatim: "The folders and video files can be named however you want, **since no metadata fetching is performed. The folder and file names will be displayed as the name of the item in Jellyfin.**" Otherwise it repeats the movies page: versions by ` - Label` suffix, 3D flags, stacking, sidecar flags, extras, artwork.
- **A content type with no provider at all** → **DIVERGENT**, and the second half of §76's finding. Two of Jellyfin's six library types (books, music videos) have no metadata pipeline, and the reason is architectural: providers are written against a *library type*, so a type nobody wrote providers for has none, and the item's title is then literally its filename. CanonCore's contract is medium-agnostic and provider-supplied fields are matched against a field set the product owns, so a new medium costs a `category` statement rather than a new provider ecosystem. This is what "It is domain-general" buys, stated as the cost of not having it.
- "Multi layer folders are supported" → worth one line: the arbitrary-depth case is treated as an *exception* granted to one library type, because everywhere else the depth is fixed by the naming convention (`Library / Movie (year) / file`, `Library / Series / Season NN / file`). A schema whose depth is a filesystem convention cannot express a chronology 22 levels deep, which is what the archive actually contains — and the prompt's answer is "An acyclicity constraint and an ancestor closure", i.e. depth is data.
- **Named versions with no work to hang them on** → the `Song 1 Version 1/2/3.mp4` example is three editions of one item, expressed only as three sibling files. Same finding as §79's binding gap; no new gap.

## 82. https://jellyfin.org/docs/general/server/media/placeholders
**Media placeholders** — Jellyfin's answer to the item-without-a-file problem, and therefore the direct test of the prompt's reason #1 for existing. Verbatim: "Media placeholders let you add video items to a Jellyfin library **without providing a playable video file**. These can be used to represent media that is unavailable, not currently present, or otherwise should exist in the library without an actual video file." The mechanism: "**Create an empty file** using the normal naming convention for the media, with **`.disc` as the file extension**" — e.g. `Blade Runner (1982).disc`. "The contents of the `.disc` file are not used." An optional physical-format keyword sits immediately before the extension: `dvd, hddvd, bluray, brrip, bd25, bd50, vhs, hdtv, pdtv, dsr`, and "The type **must be directly before** `.disc`. For example, `MyMovie.bluray.disc` is recognized as a Blu-ray placeholder, while `MyMovie.bluray.custom.disc` is still a placeholder but does not have a recognized type." Works for episodes too. "Jellyfin adds placeholders to the library like other media items, allowing them to have metadata and artwork. The item is marked as a placeholder instead of playable media." And: "`.disc`-Files will be treated as a real media file."
- **Media-independent items** → **ADOPTED**, and this page settles the argument the prompt opens rather than weakening it. The prompt's reason #1 says "IN JELLYFIN AND PLEX AN ITEM CANNOT EXIST WITHOUT A FILE. Jellyfin's virtual items work only for missing TV episodes hanging off a real series." Placeholders are a *second* mechanism the prompt does not mention, and they are broader than virtual episodes — a placeholder movie needs no parent series. But the claim survives intact and is arguably strengthened, because **the placeholder is still a file**: to catalogue a work you do not own, you must create a zero-byte file, at a path, named in the convention, on a volume the server can write. The item still cannot exist without a file; the file has merely been emptied. Jellyfin's own docs say so in one line — "`.disc`-Files will be treated as a real media file."
- Two consequences worth recording. First, this is the only place in the docs where the *user* is instructed to write into the media tree to create catalogue state, which is what CanonCore's "The scanner NEVER writes storage" prevents on the read side and what its media-independent items make unnecessary on the write side: in CanonCore an unreleased or lost work is an INSERT, and "EDITIONS ARE 0..n, NOT 1..n. Unproduced and unreleased works are real and have no edition at all". Second, the placeholder cannot be *searched for* — it exists only if the owner already knew to type its name into a filename — whereas a provider `lookup` can create the same row from a match.
- **A physical-carrier vocabulary** (`dvd/bluray/vhs/hdtv`) → **DIVERGENT** by design. In CanonCore this is a `category` statement on the edition, not an enum and not a filename token: the prompt's rule is "Finer typing is a `category` statement, never an enum value: a category statement can be sourced and disputed, a kind column cannot", and `medium` is closed at four playback values precisely so `vhs` cannot get in. Jellyfin's ten keywords are the enum creep the prompt is guarding against, arriving through the filename parser.
- **"Unavailable / not currently present" as a first-class state** → **ABSENT**. LOW-MEDIUM. CanonCore represents *not owning a file* natively (zero editions, or an edition with no file), but the neighbouring case — an edition that exists, is known, and whose file is on a disconnected drive — has no stated representation, and it is different from both "no file" and "file missing, delete the row". The archive shape this matters for is the prompt's own: a serial with lost episodes, where `edition_coverage` says what survives, but nothing says what the owner *has to hand*.

## 83. https://jellyfin.org/docs/general/server/media/shows
Shows — the page where **ordering lives in filenames** is stated outright, and the page carrying the incumbent's one attempt at a second ordering.

The naming rules, verbatim:
- Structure: "Shows should be organized into **series folders, then into season folders** under each series." Series folder: `Series Name (year) [metadata provider id]`.
- Season folders: "should be named `Season *`, with `*` being any number. **Do not abbreviate the Season name to S01 or SE01.** For the best results, please pad the season number with 0s at the front to make sure each entry has the same number of digits. For example: `Season 5 -> Season 05`. Also **do not mix Season folders with episodes in the Shows folder**."
- Episodes: `Series Name A S01E01.mkv`. Multi-episode files: `Series Name A S01E01-E02.mkv`, with the consequence "Each video file may contain multiple episodes. However, **they will be shown as a single entry containing metadata from multiple episodes.** It is recommended that the video files be split into individual episodes using a tool like MKVToolNix."
- Multi-part episodes: `Series Name A (2025) S01E01-part-1.mkv` / `-part-2.mkv`.
- **Specials** live in `Season 00`, and: "In case your metadata provider does not provide information about the special, it is recommended to use a name which describes the content of the special **instead of** naming it `Series Name S00Exy.mkv`. This is done to avoid wrong metadata being pulled." Plus the honest admission "**Episode numbering for specials may vary from metadata provider to metadata provider.**"

**The specials-placement mechanism**, which deserves reading in full because it is the closest thing in either incumbent to CanonCore's placements:
- "Specials can also be shown within a season if so desired. This can be helpful when they are part of a continued storyline during the season. **This requires 2 settings**: The option **Display specials within their series they aired in** under Dashboard -> Library -> Display must be enabled; and the season and episode they aired before/after **must be set within the metadata** ... in the Metadata editor or in an NFO using the **`airsbefore_season`, `airsafter_season`, and `airsbefore_episode`** tags."
- Resolution rules, verbatim: "When the **Airs before season** field is set but Airs before episode is not set, the special will play at the start of the specified season, before the first episode." — "if Airs before season is set to 2 and Airs before episode is set to 7, the special will play between S02E06 and S02E07." — "With **Airs after series** set the Special will be shown (and played) at the end of the specified Season. **This will take priority over** the Airs before season/episode fields if they are set."
- Tie-break: "When multiple specials have the same position, they will play in the order in which they are **stored in the specials season**. For example, if S00E01 and S00E03 both have Airs before season set to 3 and Airs before episode set to 7, the order the content will play in is: S03E06 → S00E01 → S00E03 → S03E07."
- And the payoff line: "Note that this will show them in **both** the Specials season, as well as the season specified."

Classification:

- **Ordering encoded in the filename** (`S01E01`, `Season 05`, zero-padding advised so strings sort) → **REFUSED**, and this is the literal referent of the prompt's reason #2. Note what the padding advice concedes: the sort key is a *string*, so correctness depends on the user typing consistent digits. CanonCore's `placements.position` is an integer on a join row, and "ORDER LIVES HERE, never on the item", with OAI-ORE quoted for the principle that sequencing "is only true in the context of the specific Aggregation, and is not a 'global' fact".
- **The specials mechanism** → **DIVERGENT**, and it is the best single confirmation on this site that CanonCore's central feature is a real requirement rather than an invented one. Every element of multi-placement is present, in miniature and hard-coded:
  - an item appearing in **two orderings at once** — "this will show them in both the Specials season, as well as the season specified" — which is the prompt's "Also appears in" list, and Jellyfin's own docs treat the duplicate appearance as correct rather than as a bug;
  - a **position relative to other members** rather than a global index (`airsbefore_episode: 7`);
  - a **tie-break for two items at one position**, which is exactly the prompt's "NO UNIQUE CONSTRAINT ON (container_id, position) EITHER — two DIFFERENT items may share a position";
  - a **precedence rule between competing placement fields** ("Airs after series ... will take priority").
  And every one of them is bought at a cost the prompt's design does not pay: it works **only for specials**, **only within one series**, requires a **server-wide display toggle** before it renders at all, stores the ordering in **`.nfo` tags on the item** rather than on the pairing (so an episode carries its position as a property of itself, which is the thing OAI-ORE says is not a global fact), and is capped at three fields with no room for a fourth ordering. A "story order" spanning three series — the prompt's Breaking Bad / Better Call Saul / El Camino stop condition — is unreachable from here in principle, not just in practice.
- **Season 00 as the home for anything that does not fit** → the structural tell. When a tree cannot express a relation, the convention grows a reserved slot: season zero, which is not a season. CanonCore has no equivalent because a chronology is an ordinary container.
- **"Episode numbering for specials may vary from metadata provider to metadata provider"** → **ADOPTED**, and stated by the incumbent as a shrug. This is provider disagreement about ordering, admitted in the docs, with no mechanism to record both answers — Jellyfin merges first-non-empty-wins and cannot say which provider claimed what. It is reason #3 for CanonCore existing, observed in the wild: in CanonCore two providers claiming different positions produce two statements on the placement (a legitimate subject: "This placement is part 4"), with `rank` for the owner's choice, and the loser is kept rather than discarded.
- **One file containing two episodes** (`S01E01-E02`) → **ABSENT**. **MEDIUM.** Jellyfin's answer is to collapse them into "a single entry containing metadata from multiple episodes" and then advise you to split the file. CanonCore's `files` row attaches to exactly one item or edition, and `edition_coverage` describes intervals *within one work's* extent — so a single file that is genuinely two works has no representation, and the natural workaround (make the double episode its own item) then needs a relation to the two it contains and a rule for whether watching it marks both watched. That last part matters because the prompt is otherwise precise here: "'Have I watched this WORK' is computed by unioning the coverage intervals of watched editions against the work's extent."
- **Multi-part episodes** (`-part-1`/`-part-2`) → same as §79's stacking gap. HIGH, already rated.

## 84. https://jellyfin.org/docs/general/server/metadata/
Metadata index. The bundled provider set, verbatim: "By default, Jellyfin ships with the following providers: **The Movie Database (TMDb)**, **The Open Movie Database API (OMDb API)**, **Local .nfo files**", with the footnote "OMDb API only provides English metadata". More via the Plugin Catalog (TheTVDB, fanart.tv, AniDB) "or you could even develop your own with our **Plugin API**". Then a notice absent from every other page on the site: "Because of external factors, certain metadata providers may not be accessible in mainland China ... Below is a list of known inaccessible providers: The Movie Database (TMDb), TheTVDB."
- **Providers as plugins** → **REFUSED**: "A provider is a URL answering a contract — not a plugin, not a repo, and never code running inside the app."
- **Bundled provider definitions** → **ADOPTED** in shape, **DIVERGENT** in the key: the prompt's tier 1 is "BUNDLED DEFAULTS — known provider definitions ship with CanonCore, **ALL DISABLED BY DEFAULT**. Shipping a definition is not shipping a key." Jellyfin ships TMDb *enabled with a hardcoded key*, which the prompt names directly under SHIP NO API KEYS ("thousands of strangers use [it], which is tolerated rather than authorised and looks like sublicensing").
- **Local `.nfo` listed as a peer of TMDb and OMDb** → the tell that on-disk metadata is not a sidecar feature in Jellyfin but a *provider*, ranked among the others. §88 shows it is ranked above them and cannot be turned off. **REFUSED**.
- **A provider that is unreachable from some jurisdictions** → **ABSENT**. MEDIUM. Nothing in the prompt says what a connected-but-unreachable provider looks like: enrichment "reaches ALL connected providers at once", and a provider that times out for every request in one country needs a durable *degraded* state rather than a per-request failure, or the review queue fills with false low-confidence results and the owner is told nothing about why. Related to §75's per-source concurrency finding — both are contract-level provider health, which the prompt does not model.
- A one-line note on the alternative CanonCore has and Jellyfin does not: because a provider here is a URL the owner controls, the mainland-China case is solved by *self-hosting the provider*, which is the same move the prompt already makes for tardis.wiki's Cloudflare block ("ONE service, run on a machine the owner controls, is the only thing that ever touches tardis.wiki"). The HTTP-contract design answers a problem the plugin design cannot.

## 85. https://jellyfin.org/docs/general/server/metadata/chapter-images
Chapter images — thumbnails at chapter timestamps. Distinguished up front from chapters themselves: "Not to be confused with chapters, which are the ticks you see in the timeline when watching a video. Chapter Images must be enabled to be displayed; chapters can be displayed even when Chapter Images are disabled." Storage: "Jellyfin stores the chapter images **within the metadata directory**, which should be located inside your server's config directory." Enabled per library. Two scheduling modes — its own `Extract Chapter Images` task, or folded into `Scan Media Library` — with the warning "Extracting chapter images can be computationally intensive and **slow down library scans significantly** - especially on large libraries." Two dashboard settings: an **Interval** which "creates dummy chapters at a given interval (0 will disable dummy chapters) **if no chapters are detected in the media file**", and a **Resolution**.
- **Chapter image extraction** → **REFUSED**, as ffmpeg work ("No transcoding, no ffmpeg"), and the page is a small exhibit for why: an image-extraction pass is the thing that makes a library scan unusably slow, and it is optional value.
- **Chapters themselves** → partially **ADOPTED**: `chapters` is already one of the four file roles in the prompt (`media|subtitle|audio|chapters`), so a chapter sidecar has a home. Nothing says what the product does with it, but that is a renderer question and the prompt separates them ("Cataloguing and displaying are separable").
- **Fabricated data presented as real** → worth recording as an anti-pattern the prompt already forbids in another form. "Dummy chapters at a given interval" invents chapter marks that do not exist in the media and displays them identically to real ones, with no provenance distinguishing the two. The prompt's equivalent rule is absolute: "WHERE THE EXTENT IS UNKNOWN THE ANSWER IS UNKNOWN — never false, never a fabricated true", and every value in CanonCore carries a `source`. A derived-but-unmarked value is exactly what the statements table exists to prevent.
- Server-side derived assets stored in a config directory → the backup surface again (§6): these are regenerable, which is what makes them *not* the thing that needs backing up, and the distinction between regenerable and unrecoverable data is the one the prompt's backup gap turns on.

## 86. https://jellyfin.org/docs/general/server/metadata/identifiers
Metadata provider identifiers embedded in file and folder names. Verbatim: "Each metadata provider uses a unique identifier for its content, and adding these identifiers **greatly improves media identification**. Identifiers can be specified in your movie/show file or folder name. **Multiple identifiers can be specified.**" Example: `Best_Movie_Ever (1994) [tmdbid-680] [imdbid-1234]`. Supported: TMDB, **TVDB (Shows Only)**, OMDB (English Only, "uses Internet Movie Database (IMDB) IDs as identifiers"). Instructions per provider on where to find the id in a URL or page.
- **External identifiers as matching signals** → **ADOPTED**, and this is the closest the incumbent comes to CanonCore's design. The prompt: "A SCHEME is what an identifier IS (ISBN, MusicBrainz MBID); a PROVIDER is who asserted it. An identifier statement records both, and scheme folds in here as an external-id datatype. **Shared identifiers then become MATCHING SIGNALS between providers.**" Jellyfin has the same insight and three problems CanonCore does not: the identifier lives in a **filename** rather than a row, so it cannot be edited without renaming files and cannot be *asserted by a provider* (only by the user); the scheme set is closed to three; and the identifier records the scheme but never who claimed it, so `[tmdbid-680]` is an anonymous fact.
- **Multiple identifiers on one item** → **ADOPTED**, and note it is exactly the cross-provider agreement signal the prompt relies on: "agreeing identifiers between providers are evidence they describe the same work." Jellyfin collects them and does not use them that way — each provider matches independently against its own id and the agreement is never scored.
- **A provider restricted to one content type** ("TVDB — Shows Only") → the §76/§81 finding once more: provider capability is keyed on library type. CanonCore's contract declares `search` + `lookup` required and `browse` "OPTIONAL and DECLARED", with no medium dimension at all, which is what lets one provider serve a group holding text, video and audio.
- **Manual identifier entry as the accuracy escape hatch** → **ABSENT** as a UI, MEDIUM-LOW. The prompt has the data model (an identifier statement sourced to the Owner, who "is a first-class source and sits first in the source order") and the reason lookup exists ("a refresh by search can silently rebind a record to the wrong thing"), so "paste the TMDB id for this item" is the obvious owner action and nothing names it. Folded into the review-queue surface rather than rated separately.

## 87. https://jellyfin.org/docs/general/server/metadata/media-segments
**Media segments**, "first introduced in 10.10" — typed time intervals over a media file. Verbatim: "Unlike chapters, which have no type, media segments **can contain type information, allowing different actions based on the type of each segment**." Worked example: a 16-minute video with an `Intro` 00:00:00–00:03:08, a `Commercial` 00:08:03–00:08:59, an `Outro` 00:14:30–00:16:00. Types, closed: **Commercial, Preview, Recap, Outro, Intro**. Segments are "provided by plugins ... they include a begin and end-Timestamp, followed by a type", created by a `Media segment scan` task, and — the design note — "Jellyfin can store this information and **provide it to clients. Clients can then decide what they want to do** with the provided information ... This approach **generalizes how segments are handled, so more platforms can be easily supported, without custom modifications to clients.**" An official Chapter Segments Provider plugin derives segments from chapter names.
- **Typed intervals over an edition's timeline (skip intro / skip recap)** → **ABSENT**. **MEDIUM.** This is the one genuinely modern capability in the metadata section and CanonCore has no construct for it. `edition_coverage` is intervals, but over the *work's parts* ("part_from, part_to, kind") and explicitly for expressing what is missing — "COVERAGE EXPRESSES MISSING PARTS, NOT ABRIDGEMENT" — not positions on a playback timeline. Statements can carry qualifiers but a per-second interval set is a table, by the same argument the prompt uses for artwork ("a statement carrying a role AND a palette AND a licence AND an attribution is a table wearing a statement's name"). Skip-intro is the feature users of this category ask for most after basic playback, and a design that has to retrofit an interval table later will find the same problem the prompt names for provenance: cheap now, awkward later.
- Two things Jellyfin gets right here that CanonCore should copy if it builds this: the **server stores facts and the client decides the action**, which is the same separation as "Cataloguing and displaying are separable"; and the segment is **provider-supplied**, which in CanonCore means it arrives as a claim with a `source` and can be disputed — Jellyfin's cannot, so two segment plugins disagreeing about where the intro ends has no representation.
- The closed five-value type list → in CanonCore this is a vocabulary lookup table with `retired` and `quarantine`, per "NO database enums anywhere: an enum accumulates values nothing reads and cannot be retired".

## 88. https://jellyfin.org/docs/general/server/metadata/nfo
**Local `.nfo` metadata** — the page the prompt's refusal is aimed at, and the one that supplies the verbatim evidence for CanonCore's third reason for existing. Jellyfin "can **read and write** local .nfo metadata files to import or export metadata from and to other programs and tools" (Kodi format). Filenames are fixed per media type: `movie.nfo` / `VIDEO_TS.nfo` / `<filename>.nfo`, `tvshow.nfo`, `season.nfo`, `<episode filename>.nfo`, `artist.nfo`, `album.nfo`.

Three rules, all verbatim, all load-bearing:
- "**It's currently not possible to disable .nfo metadata. Local metadata will always be fetched and has priority over remote metadata providers like TMDb.**"
- "If there are multiple tags that map to the same internal Jellyfin data like `plot` and `review`, **the last of these tags in the file will have priority**."
- "**Artwork defined in .nfo files with local paths or URLs have priority over remote image providers and images in the media folders**", and "Jellyfin supports **only one image for each artwork type**. This means that only the first `thumb` tag for each artwork type is used."
Plus: "**User data importing is only possible for a single user.** This user can be set in the .nfo settings" — `watched`, `playcount`, `lastplayed` are importable, for one user only.

The read vocabulary is ~45 tags including `name/title/localtitle` (three spellings of one field), `plot/biography/review` (three more), `rating` "same as customrating", `uniqueid` with a "type attribute specifies id provider", `displayorder`, and — the two that matter most — **`lockedfields`** and **`lockdata`**. The write vocabulary is ~50 tags including `airsafter_season`, `airsbefore_episode`, `airsbefore_season`, `displayepisode` ("which episode this special airs before"), `displayseason`, `collectionnumber` ("TMDb collection id"), `set` ("collection name; only for movies"), and a dozen provider-id tags (`imdbid`, `tvdbid`, `tmdbid`, `musicbrainzalbumid`, `zap2itid`, `tvrageid`, `audiodbartistid` …).

- **`.nfo` reading and writing** → **REFUSED**, explicitly and by name: "No artwork uploads, no artwork scanning, **no `.nfo` reading**. The scanner takes media files and playback sidecars, and nothing else." The *writing* half is refused twice over by the standing rule "The scanner NEVER writes storage. It never creates folders, never moves files, **never writes its structure to disk**."
- **`lockedfields` / `lockdata`** → the verbatim confirmation of CanonCore's reason #3 for existing: "NOBODY STORES PER-FIELD PROVENANCE. **The ceiling across every comparable tool is a boolean lock**, which answers 'may I overwrite this?' and never 'where did this come from?'." Here is that ceiling, in the incumbent's own file format: a list of field names that may not be overwritten, and no record of what wrote them. The prompt's replacement is one line — "THE FAVOURITE IS THE LOCK. There is no separate per-field lock flag" — and it works because `rank` sits on a statement that already knows its `source` and `observed_at`.
- **A non-disableable source that outranks every other** → the sharpest version of the design the prompt refuses. "A single primary source with others filling gaps is REFUSED: that is Jellyfin's design, it merges first-non-empty-wins and DISCARDS the losing answers, and it is why Jellyfin can never say where a value came from." `.nfo` is not even a *configurable* primary: it always wins, it cannot be turned off, and the losing TMDb value is gone. CanonCore's equivalent is the source order with the Owner first — the same *effect*, since owner-authored values outrank providers — but every other claim survives as a row, and "re-ordering the source list re-picks the whole catalogue at once".
- **Last-tag-wins and first-thumb-wins** → two more silent, unprovenanced precedence rules, one per data shape. Note the artwork one is a hard cardinality limit — "only one image for each artwork type" — where CanonCore's artwork table is many rows per item per role, each with its own licence, attribution and palette.
- **`set` / `collectionnumber`** → collections written into a file, keyed by *name* or by a TMDb collection id. This is reason #4 for CanonCore existing, in file form: cross-library membership expressed as a string in a sidecar.
- **`airsbefore_season` / `displayseason`** → the §83 specials mechanism, confirmed as being *persisted to disk per episode*. The ordering is a property of the item, written into a file next to it, which is precisely what "ORDER LIVES HERE [on the placement], never on the item" refuses and what OAI-ORE says is not a global fact.
- **`watched` / `playcount` / `lastplayed`, single user only** → the prompt's progress model is strictly better and says why: "every media server surveyed keeps only a mutable state row: **Jellyfin has a play count but no dates**, and Plex's unscrobble zeroes the count. The event log is what makes re-watches real." Confirmed here — `lastplayed` is one timestamp, `playcount` one integer, and there is nowhere to put a second viewing.
- **Import/export of metadata to other tools** → **REFUSED** by "No fork, no export, no import, no cross-instance sharing, no merge semantics between instances." Recording the trade honestly: `.nfo` is the reason a Jellyfin library survives being rebuilt or moved to Kodi, and CanonCore's answer to that need is the backup/restore path it has not yet specified (§6, §9), not an interchange format.
- **Three spellings for one field** (`name`/`title`/`localtitle`, `plot`/`biography`/`review`) → the accumulated-alias problem the prompt's `properties` table exists to prevent: "WITHOUT IT THIS DESIGN IS wp_postmeta ... whether a metadata catalogue lives in the DATABASE rather than in code". Jellyfin's field catalogue is a hardcoded tag-to-property map with historical aliases nobody can remove.

## 89. https://jellyfin.org/docs/general/server/notifications
Notifications, and the page title gives the answer away: "**Webhook Plugin for Notifications**". "Jellyfin will show notifications on the dashboard by default, but you can send notifications via the Webhook Plugin to additional messaging services." Configuration: "All notification types will be shown in a list as well as their current status. They can be **enabled individually** and can be set to **only monitor specific users**. Any installed notification services will show up in a list." Templates for popular services live on the plugin's GitHub.
- **Outbound notifications** → **ABSENT**. LOW at v1, and this is the third sighting (§31's notification subsystem, §74's "Post transcode progress to a Slack/Discord channel"), so recording it once here rather than three times. A single-owner catalogue with no long transcodes has little to notify about; the honest candidate events are "a scan finished", "a provider started failing" and "the review queue has N items", and all three are better served by the in-app surfaces the prompt already needs.
- The shape worth keeping if it is ever built: **an event type list with per-type toggles**, which is a vocabulary table, not code.
- One line on what this page reveals about the incumbent's architecture: notifications, books, media segments, most metadata providers and all Live TV tuners beyond two are plugins. The core is smaller than the product, and the prompt's refusal of plugins ("never code running inside the app") means every one of those decisions has to be *in or out* rather than deferred to an ecosystem. That is a cost as well as a benefit, and the four-tier provider distribution is the prompt's answer for the one axis where deferral is genuinely needed.

## 90. https://jellyfin.org/docs/general/server/plugins/
The plugin catalogue — the page that shows what Jellyfin's core deliberately is not. Six categories, verbatim: "**Authentication**: Add new authentication providers, such as LDAP. **Channels**: Allow streaming remote audio or video content. **General**: Plugins that serve general purposes, such as sync with Trakt.tv, or Kodi. **Live TV**: Plugins that help with connecting to tuners. **Metadata**: Scrape metadata from a new source or modify existing metadata. **Notifications**: Allow notifications to connect to many different services." Distribution is by **manifest URL** — an official repo plus fourteen third-party ones, each a raw GitHub JSON file — and installation drops a DLL into a plugins folder, with configuration in `plugins/configurations/*.xml`, requiring a server restart. Honest caveat: "At the moment many of these are still being updated frequently so **the version number may not be accurate**."
- **Plugins as the extension mechanism** → **REFUSED**, the prompt's most-repeated refusal. What this page adds is the *distribution* comparison: Jellyfin's model is already "a manifest at a URL", so the gap between it and CanonCore's CMPP store is smaller than it looks — the difference is that Jellyfin's manifest points at compiled code that runs in-process, and CanonCore's points at "a URL, a credential and a validated response shape". The four-tier distribution in the prompt (bundled-disabled, curated store, private URL, licensed-to-one-person) maps almost exactly onto what Jellyfin has organically grown, minus the code execution.
- **The individual plugins are the real finding.** Several are load-bearing evidence for prompt decisions:
  - **TMDb Box Sets** — "Automatically create movie box sets based on TMDb collections. **Configurable minimum number of films to be considered a boxset.** Boxsets are created as collections and includes a scheduled task to ensure that new media is automatically put into boxsets." This is a **rule-derived container sourced from a provider**, which is exactly the prompt's split ("A container is EITHER hand-placed OR rule-derived; a rule-derived container carries NO order, because a rule produces a set, not a sequence") — and note the incumbent needs a plugin, a threshold and a scheduled task to get there, and still cannot order the result.
  - **Merge Versions** — "Automatically group every repeated movie." A third-party plugin whose entire purpose is to work around §79's character-for-character filename prefix rule. Its existence is the measurement of how badly that rule fails in real libraries.
  - **Playback Reporting** — "Collect and show user playback statistics, such as total time watched, media watched, **time of day watched**, and time of week watched. **Can keep information for as long as you want** or can cull older information automatically." This is **the watch event log, shipped as a plugin**, and it is direct confirmation of the prompt's progress design: "every media server surveyed keeps only a mutable state row: Jellyfin has a play count but no dates ... The event log is what makes re-watches real." Jellyfin's users wanted the log badly enough to build it outside the core, where it cannot inform completion, Continue Watching or anything else.
  - **Trakt**, **Last.FM**, **Ani-Sync** — three scrobblers pushing watch state to external services. **ABSENT** from the prompt, LOW: with an append-only event log the data is already in the right shape, and outbound sync is a later, optional integration rather than a model question.
  - **SmartCovers** — "Fallback cover-image provider for books, audiobooks, and PDFs. Extracts covers from files locally (EPUB, PDF, audio embedded art) and fetches from Open Library and Google Books when local extraction fails." A fallback *chain* across a local extractor and two remote sources, with no record of which one answered. The prompt's artwork table carries "the licence and attribution string it came with" precisely so this question is answerable.
  - **LDAP**, **9p4's SSO** — external authentication, both third-party. **ABSENT**, LOW: the prompt is "Single user, one password, no signup, no multi-tenancy", and says so deliberately, with `owner_id` on every table "so multi-user is a later migration rather than a rewrite".
  - **WhisperSubs** ("Local AI-powered subtitle generation using whisper.cpp ... no cloud APIs") and **Subtitle Extract** — subtitle generation and extraction. **REFUSED**-adjacent (ffmpeg, and the scanner writing to disk).
  - **Skin Manager**, **Themerr**, **Local Intros** — cosmetics; note §14's CSS-customisation finding is the same want.
- One line worth keeping about the shape of the ecosystem: of the ~15 third-party plugins listed, **nine are metadata sources** (Anilist, Anidb, Anisearch, Kitsu, Kinopoisk, YouTube, TubeArchivist, Shokofin, Last.FM). The overwhelming demand on any extension point in this category is *another source of claims*, which is the one axis CanonCore opens deliberately and the reason the provider contract is the only extension point it needs.

## 91. https://jellyfin.org/docs/general/server/plugins/open-subtitles
Three sentences: the plugin downloads subtitles from OpenSubtitles.com "for any video file on your server", installed from the catalog, and "you will need to enter your **OpenSubtitles.com account info** in the plugin configuration page". The catalogue entry adds "You can configure the languages it downloads on a **per-library basis**."
- **The user supplies their own credential** → **ADOPTED**, and it is the pattern the prompt names as defensible: "SHIP NO API KEYS. A self-hosted instance supplies its own provider credentials. The defensible pattern is TheTVDB's: the project holds its own licence, the user supplies their own subscription credential." Jellyfin does it correctly here and incorrectly for TMDb (§84), in the same product.
- **Per-library language configuration** → the group-scoped-providers shape: "Scopes browsing, search, **WHICH PROVIDERS ARE ASKED**, scanner roots, and the review queue." Convergent; no gap.
- **Downloading subtitle files into the media folder** → **REFUSED** by "The scanner NEVER writes storage." Recording it because subtitle fetching is the single most requested write-to-disk feature in this category, and it will be proposed. If CanonCore ever wants it, the sidecar has to land somewhere the product owns, not next to the media, and the file row's `role: subtitle` plus a language already describes it.

## 92. https://jellyfin.org/docs/general/server/plugins/tvheadend
A step-by-step integration guide for a third-party PVR backend: create a dedicated TVHeadend user with an exact permission set ("The parameters Change parameters, Streaming and Video recorder **must be marked as shown**. Otherwise, Jellyfin can connect to TVHeadend but problems may arise when reproducing the content"), prefer `127.0.0.1` over `localhost`, and — the operative constraint — "even if Jellyfin manages to connect to TVHeadend, **the guide will not be synchronized because there has to be a number assigned to the channels** in TVHeadend ... this number must be nonzero", with manual and automatic numbering modes. Then "Refresh guide data", and "If the guide is not updated, **restart the Jellyfin server**".
- Live TV / PVR → **ABSENT**, LOW, settled at §1 and §72.
- Two things worth one line each, both about integration failure modes the prompt's contract design has to handle:
  - **A dedicated service account with a minimum permission set** — the correct pattern for any credentialed provider, and the prompt has the credential ("a URL, a credential and a validated response shape") without saying anything about least privilege on the far side. Not a gap in the model; a documentation obligation for each provider repo.
  - **A silent partial success**: connected, authenticated, and returning nothing usable because a field on the *remote* side is unset. The prompt's contract validation is shape-level ("bounded primitive validators, never provider-supplied regex"), which catches malformed responses and not empty-but-valid ones. This is the same finding as §84's unreachable-provider gap seen from the other direction — provider *health* is not modelled, and "connected but returning nothing" is the state an owner most needs told about.
- "Restart the server if the guide is not updated" → the honest end state of a cache with no invalidation story. The prompt's projection rules are stronger by design ("Rebuild the read projection WHOLESALE, never incrementally, with revision-id versioning on projection writes so a stale rebuild cannot overwrite a newer one").

## 93. https://jellyfin.org/docs/general/server/quick-connect
**Quick Connect** — device pairing without typing a password, and the most directly applicable ABSENT capability in this shard. Verbatim: "a temporary Quick Connect code is generated and used to authorize login from an already authenticated client. This feature streamlines the sign-in process, **especially on devices with limited input options (like TVs or set-top boxes)**." The flow: Device A (new) shows "a **6-character code**"; Device B (already authenticated) goes to Settings > Quick Connect and enters it; Device A is logged in. "By default, Quick Connect is **enabled**", with a server switch to disable. A support matrix of fourteen clients splits the capability in two — **Log In** and **Authorize Others** — and several clients can do the first but not the second (Android TV, Roku, Swiftfin tvOS log in but cannot authorise), which is the correct asymmetry: the constrained device is the one that needs the flow and the last one that should be able to grant it.
- **A device-pairing / code-authorisation flow** → **ABSENT**. **MEDIUM**, and it is squarely inside CanonCore's committed scope rather than adjacent to it. The prompt commits to "Expo for phone and native Swift for TV", and it commits to "Single user, **one password**, no signup". Those two decisions collide on the first TV launch: the owner must type their only credential — the one that protects everything — on a tvOS remote, and on a shared screen. Jellyfin's answer needs no extra identity model, only a short-lived code, an authenticated device to approve it, and a session issued to the new device; it composes exactly with the single-owner design and with §70's device register, which is where a granted session would be listed and revoked.
- **Enabled by default** → **DIVERGENT** if built. A pairing flow that is on by default on a LAN-exposed server is a standing invitation; the prompt's posture elsewhere is the opposite (bundled providers "ALL DISABLED BY DEFAULT", "A field added later is private by default"), so the default here should be off, or scoped to the local network.
- The two-capability matrix is the transferable design detail: **logging in and authorising are separate capabilities**, and a client may hold one without the other. That is the same instinct as the prompt's split of matching from applying — "SEPARATE OPERATIONS WITH SEPARATE ENDPOINTS. The split lives in the CONTRACT, not in a screen."

## 94. https://jellyfin.org/docs/general/server/settings
General server settings, four of them, and one is a documented pre-authentication information leak. **Server Name** ("The default value will be the hostname of the computer"). **Splash Screen Image**, verbatim: "The default image is generated from images of the content on your server and **is visible without authenticating and therefore can expose what content may be present on your server**. Only content with a rating equivalent to **PG-13 or lower** is used for generating the image, **but this depends on the content having accurate rating data.**" **Login Disclaimer** ("This message will be shown to users when they login"). **Custom Style** (custom CSS, see §14).
- **The splash screen** → the best security exhibit on the site, and it is exactly the failure mode the prompt's public read path is built to prevent. Read the shape of it: a feature that is **on by default**, emits **derived content** from private data on an **unauthenticated** surface, and is made safe by a **denylist** — one that filters on a field supplied by a third-party metadata provider and admits in the same sentence that it "depends on the content having accurate rating data". So the privacy of an unauthenticated endpoint depends on TMDb's certification data being complete for every item in the library. The prompt's rule is the direct answer: "**The public read path NAMES every field it emits. It is never the owner payload with fields removed, because a strip-list works until someone adds a field and forgets.** It carries no internal ids, no owner id and no notes. **A field added later is private by default.**" Jellyfin's splash screen is the strip-list, one layer up: not a field that was forgotten, but a *derivation* nobody classified.
- **Applied to CanonCore's demo**, this matters more than it first appears. The demo is "ONE public read-only instance, the only surface where CanonCore is a publisher", and the prompt already carries a licence obligation on it (BY-SA attribution on anything archive-derived; "its images must never be redisplayed"). Any generated or aggregate artefact on the public surface — a montage, a poster wall, an OG preview image, a stats line — is a *new* emission and is not covered by a field-naming rule that only governs the payload. **ABSENT**: the rule names fields but not derived assets. MEDIUM.
- **Login Disclaimer** and **Server Name** → **ABSENT**, LOW. Instance-identity settings are ordinary and unspecified rather than missing; the prompt leaves them to judgement ("Everything this document does NOT mention is simply UNSPECIFIED").
- **Custom CSS** → **ABSENT**, LOW, already covered at §14: the prompt's answer is stronger and already decided — "design tokens as PLAIN TYPESCRIPT rather than a Tailwind config", shared across clients from the first commit.

## 95. https://jellyfin.org/docs/general/server/tasks
Scheduled tasks: "operations that are scheduled to run periodically. They can also be **triggered manually** by clicking the run button." The default list, grouped: **Libraries** — Download Missing Subtitles, Refresh Users, Extract Chapter Images, **Scan Library**, Extract Key Frames; **Application** — Update Plugins; **Maintenance** — Optimize Database, Clear Log Folder, Clear Cache Folder, Clear Activity Logs, Clear Transcodes Folder, **Clean up collections and playlists**. "Plugins can add their own tasks."

And then, in a note, the most alarming sentence in this shard, verbatim: "**If your media files are unavailable when the Clean up collections and playlists task runs (e.g. a network share not yet mounted) your playlists will be lost. By default it runs at Jellyfin startup.**"

- **That note is the strongest single argument on this site for CanonCore's whole premise**, and it should be read alongside two rules the prompt already states. First, the storage rule: "**DO NOT ASSUME FILESYSTEM CHANGE NOTIFICATIONS FIRE.** Plex's own documentation says content mounted over a network 'will typically not work' ... Support explicit periodic scans." Second, the delete rule: "DELETE — **The one place data is actually lost.** Three outcomes, previewed with counts before acting." Jellyfin's cleanup task violates both at once: it treats *absence of a file* as authority to destroy **hand-curated membership data**, it runs unattended, at startup, by default, before the mount is guaranteed, with no preview and no confirmation, and the destroyed data — a playlist, a collection — cannot be recovered from any provider because no provider ever knew it.
- **What the scanner does when a file disappears** → **ABSENT**. **HIGH.** The prompt never says. Every ingredient for getting this wrong is present: an item is media-independent, files attach to items and editions, the scanner runs periodically rather than on notification, and network mounts are an explicitly supported target ("Document rclone and mergerfs for cloud storage"). A missing file must therefore be a *state on the file row*, never a deletion — and certainly never a deletion that cascades to a placement, since placements are the product. This is the counterpart to the §79 binding gap: one is "an unknown file arrives", this is "a known file vanishes", and both are unspecified in a design whose central asset is manual curation.
- **A visible scheduled-task surface with manual triggers** → **ABSENT**. **MEDIUM.** CanonCore has background work by design — enrichment "runs in the background against the thresholds", the projection "rebuild[s] WHOLESALE", scans are periodic — and no stated place to see it, run it now, or read its last result. This is the same gap as §71's scan progress bar and §16's server-push finding, and one surface answers all three. Note the shape Jellyfin gets right and is cheap to copy: every background operation is a **row in a list**, with a schedule, a last-run result and a run-now button, including plugin-contributed ones.
- **Maintenance tasks over regenerable data** (log, cache, transcodes, activity logs) → **ABSENT**, LOW, and mostly not applicable: CanonCore has no transcodes and its projection is rebuilt wholesale rather than pruned. The one that transfers is log/activity retention, which is a privacy setting as much as a maintenance one.
- **Optimize Database** as a user-visible task → a SQLite tell. CanonCore is Postgres per the scaffold config ("database postgres, orm drizzle"), where vacuum is the database's problem and not the product's. No gap.

## 96. https://jellyfin.org/docs/general/server/users/
Users overview. Opens with the privacy stance: "Jellyfin users are entirely local and **no information or metadata will ever be sent to remote servers during the login process**." Then per-user capability toggles: administrator ("full access to all pages and features on the site so be careful who gets access"), transcoding permission per audio/video, and three that matter here.
- **Deletion**, verbatim and important: "Users can delete media from the library with this option, **which will also remove them from the filesystem**. If your server doesn't have write permission to the media files, **they will be removed temporarily but picked up on the next library scan**."
- **Lockout**: "You can set a maximum of failed login attempts before a user gets locked out ... The user will no longer be able to login until the server administrator **manually unlocks** the account."
- **Hiding accounts**: "you can hide a user from the login screen and require manual entry of both the username and password. This will prevent users from knowing what accounts have been created on the server."

Findings:
- **Deletion writing to the filesystem** → **REFUSED**, twice: "The scanner NEVER writes storage" and the DELETE section's three outcomes, all of which are catalogue operations ("Deleting a container NEVER deletes its members; they lose one placement"). CanonCore never deletes bytes, so the destructive-permission question does not arise.
- **"Removed temporarily but picked up on the next library scan"** → the deepest structural observation in this shard, and it generalises. In a catalogue *derived* from a source, **no curation decision is durable unless it is written back to the source**. A delete that cannot write the filesystem is undone by the next scan; §70's device removal "does not hide the device forever" and a reconnecting device reappears; §77's exclusions have to live on the media volume for the same reason. The prompt already owns the one mechanism that fixes this class of bug — "**REJECTIONS ARE REMEMBERED**, or the queue refills with the same questions forever. Almost nothing does this: Immich regenerates dismissed duplicate groups verbatim, and OpenRefine has no 'not a match' state at all" — and this page shows the incumbent failing it a third way. Worth stating as a general rule for CanonCore: **every negative curation decision needs a durable row**, not only the review queue's. Deleting a scanned file's row, dismissing a redundant-file suggestion (the standing rule: "Two files with the same content are a REDUNDANT FILE, surfaced as a suggestion and never auto-deleted") and ignoring a path must all survive the next scan, and only the review-queue case is currently specified. **ABSENT**: durable negative decisions outside the review queue. **MEDIUM.**
- **Hidden accounts / no user enumeration** → **ADOPTED** in spirit; the prompt reaches the same place from the other end: "Dropping internal ids also removes the enumeration oracle."
- **The privacy claim** ("no information ever sent to remote servers during login") → still **ABSENT** from the prompt as an explicit stance, as flagged at §1. MEDIUM there; not re-rated.

## 97. https://jellyfin.org/docs/general/server/users/adding-managing-users
The full per-user settings surface, and the page carrying two verbatim numbers plus the incumbent's version of a feature the prompt explicitly refuses.

Concrete rules and defaults:
- **Lockout**, verbatim: "Failed login attempts before user is locked out ... **`0` means inheriting the default of 3 for non-admin and 5 for admin, `-1` disables lockout**." Unlocking is manual by an administrator, and the lockout event "appears on the activity feed on the administrator dashboard".
- The lockout error is *wrong*, and documented as such: a locked-out user sees "Connection Failure — We're unable to connect to the selected server right now. Please ensure it is running and try again."
- "**All newly created users are hidden by default**" from login screens.
- "Enable access from all devices ... disabling this option will enable you to give the user access rights per device and **logins from new devices are blocked until they've been approved here**."
- **Parental control**: "Maximum allowed parental rating"; "**Block items with no or unrecognized rating information**"; "**Block items with tags**"; "**Allow items with tags**"; "Access Schedule ... media can only play during the timeframe and **will be stopped past it**".
- "Allow social media sharing — Allows this user to share the url to web pages containing media information."
- "Reset Password will allow the user to **log in without giving a password**."
- Authentication Provider is per user, and for LDAP "the username needs to be **identical to the user's UID in LDAP, including capitalization**".

Findings:
- **Login rate limiting / lockout** → **ABSENT**. **MEDIUM**, and now with the incumbent's numbers to borrow (3 attempts, 5 for admin). The prompt is "Single user, **one password**, no signup" with a public read-only demo, which means exactly one credential guards everything and it is exposed on whatever surface the owner opens to the internet. A lockout on a single-user system needs care — locking the only account out is a denial of service on yourself, and Jellyfin's answer (an administrator unlocks it) does not exist here — so the shape is probably a delay rather than a lock. That it needs deciding is the finding.
- **Per-device approval** → **ABSENT**, folded into §70's device register and §93's pairing flow. One surface answers all three: a list of devices, each with a granted session, approvable and revocable. Rated once, at §93, MEDIUM.
- **Parental control / content restriction by rating and tag** → **REFUSED**, and this page vindicates the prompt's reasoning rather than merely agreeing with it. "**No visibility system. Not a column, not propagation, not a resolution rule** ... '**Inherit from which parent?**' has no answer once an item is multi-placed. Add it when multi-user arrives, which is when it first means anything." Note *how* Jellyfin implements restriction: as a **flat predicate over the item** (its rating, its tags), never as an inherited property of its container. That is the only shape that survives an item having several parents — and it is evidence that when CanonCore does reach multi-user, the answer is a predicate over statements (which is free: a tag is already "an owner-authored `category` statement"), not a visibility column with propagation. The prompt's refusal is right and its eventual replacement is already implied by the model.
- **"Block items with no or unrecognized rating information"** → a **fail-closed default over unknown data**, and the direct counterpart to §94's splash screen, which fails *open* over the same field, in the same product. It is also the same instinct as the prompt's hardest completion rule: "WHERE THE EXTENT IS UNKNOWN THE ANSWER IS UNKNOWN — never false, never a fabricated true." Unknown must be a third answer everywhere it appears, and the safe default depends on which side of the boundary the answer lands.
- **"Reset Password will allow the user to log in without giving a password"** → a passwordless state reachable from an admin screen. On a single-owner instance with one credential this shape is not survivable; recording it as the failure mode a password-reset flow must not have. **ABSENT**: credential recovery. MEDIUM — "one password" needs a stated answer for *forgotten*, and on self-hosted software the honest one is a documented local CLI or config reset, not an email loop.
- **LDAP username must match "including capitalization"** → **name as identity**, the exact failure the standing rule names: "ENTITY IDENTITY IS A SURROGATE ID with external-id mappings, **NEVER A NAME**. Jellyfin keys people on their name, so two people sharing a name merge irreversibly." Here the same mistake is made for *user accounts*, against an external directory, case-sensitively.
- **A user-visible activity feed** (where the lockout appears) → **ABSENT**, LOW-MEDIUM, and the same surface as §95's task list: one place where the instance reports what it has been doing.
- **Social-media sharing of item URLs** → **ABSENT**, LOW. The prompt's public surface is exactly one instance ("the only surface on which CanonCore is a publisher"), and a private instance sharing item URLs would need the visibility system it refuses.

## 98. https://jellyfin.org/docs/general/style-guides/
Two sentences: "This section documents the code style used for the different languages used by Jellyfin. If the language you are looking for does not have a style guide yet, **respect the style of the surrounding code in the files you are editing.**"
- Project convention only, no product capability. **ABSENT**, LOW.
- One line worth keeping: the fallback rule is the right one and the prompt has no equivalent, because CanonCore's answer is upstream of it — a single scaffolded toolchain with the linter and formatter config generated rather than argued ("SCAFFOLD ONCE, THEN OWN THE OUTPUT"), plus `noUncheckedIndexedAccess` and `verbatimModuleSyntax` named explicitly. Convention enforced by tooling beats convention documented in prose, and that is already the prompt's posture.

## 99. https://jellyfin.org/docs/general/style-guides/javascript
The only language style guide on the site. "Filenames must be **camel case** and may not include underscores (`_`) or dashes (`-`). The filename's extensions must be **`.js`**." A prescribed module skeleton with optional-but-preferred JSDoc, named exports plus a default export object. "All files must be encoded in **UTF-8** and use **LF** line endings when committed." Non-ASCII: "For printable characters, use the actual Unicode character directly in your code. For non-printable characters, use the hexadecimal or Unicode escape."
- Project convention, no product capability. **ABSENT**, LOW.
- Two observations that are actually about architecture, not style. First, **the web client is JavaScript with JSDoc**, not TypeScript — which is why the whole API surface between server and client is untyped and why `.nfo` tag maps and provider ids are string-keyed. The prompt's opposite decision is load-bearing and stated as such: "Build these as real workspace packages from the FIRST COMMIT ... the API contract, the database schema, the Zod schemas, and design tokens as PLAIN TYPESCRIPT". Second, the fifth generated-output defect the prompt lists — "No drizzle-zod, so 'Zod derived from the schema' is unwired. Given a statements table you probably want hand-written Zod anyway — **decide that deliberately, not by omission**" — is the same class of decision this style guide makes by omission and then documents forever.
- Filename casing rules → nothing to adopt, but note the contrast with §79: Jellyfin regulates the casing of its *source* filenames in a documented standard, while the casing and punctuation of its users' *media* filenames carries semantics with no validator at all. The strictness is applied to the file set that matters least.

## 100. https://jellyfin.org/docs/general/testing/
Community testing guide. Rules for testers, verbatim: "**Make regular backups. Changes from testing might be irreversible.**" — "**Keep everything local.** It is generally not a good idea to expose testing environments to the wider internet." — "Expect things to break, especially with non-release versions." Two kinds of testing: finding new bugs, and "**Reproduction of unconfirmed issues** ... Any issue that hasn't been labeled `confirmed` means that it hasn't been confirmed yet", including re-testing confirmed issues that "[haven't] been tested since the last major release". Reporting flows through GitHub with a Triage Team, and an unsuccessful reproduction is itself a reportable result: "If you have attempted to reproduce an unconfirmed issue but failed to do so, also comment on the original issue."
- Community QA process → **ABSENT**, LOW. Not applicable to single-author software at v1, and the prompt's stop condition is two committed tests rather than a test community.
- **The one transferable idea**: a **negative result is recorded**, and an issue carries a `confirmed` state that expires against a release. That is the same instinct as "REJECTIONS ARE REMEMBERED" applied to a bug tracker — a failed reproduction is data, and confirmation goes stale. Worth one line because the prompt's own repo conventions live in Linear with triage labels, and "we tried and could not reproduce" is exactly the state most trackers throw away.
- "Make regular backups. Changes from testing might be irreversible" → the third page in this shard whose advice is *back up first*, after §4 and §103. Reinforces the §6 backup gap rather than adding to it.

## 101. https://jellyfin.org/docs/general/testing/server/
Short index for server testing. "**Unstable often makes irreversible changes to existing Jellyfin setups. Please make regular backups.**" Weekly unstable builds "are generated **every Monday 5:00 AM UTC**", and "Testing using the Unstable builds can not only test Jellyfin itself, but also **help identify issues with packaging**". A master-branch path exists and is "only intended for developers".
- Release-channel mechanics → **ABSENT**, LOW at v1 (single author, no users to break).
- **Packaging as a distinct thing that needs testing** → worth one line, and it connects to the §35/§42 packaging gap the predecessor found: a self-hosted product's release artefact is a *package*, and it breaks independently of the code. The prompt's stop condition ends at "a rendered page in a browser" on the author's machine and names no artefact anyone else could install, which is consistent with the cap and is the first thing after it — alongside the scanner half the prompt already flags as shipping "built and unproven".

## 102. https://jellyfin.org/docs/general/testing/server/macos
macOS unstable testing, and the page quietly documents the true cost of the transcoding decision. Back up `~/.config/jellyfin/`, `~/.local/share/jellyfin/`, `~/Library/Application Support/Jellyfin/`. Unstable macOS builds "do not come with a packaged installer or application. Instead, they have to be ran from the command line". Then: "**The unstable builds don't come with FFmpeg bundled. Instead, the binaries have to be downloaded separately.** Jellyfin's **custom FFmpeg build** for macOS is available from the Jellyfin FFmpeg macOS repository. **Select the version corresponding to the unstable version of the server.**" Gatekeeper handling is manual — `xattr -rd com.apple.quarantine .`, `codesign -fs - --deep jellyfin` — and the server is launched as `jellyfin --ffmpeg /path/to/ffmpeg`.
- **REFUSED** in content, and the single sharpest measurement of what "No transcoding, no ffmpeg" saves. It is not a library dependency: the project maintains **its own FFmpeg fork, built per platform, version-locked to the server release**, distributed from its own repository, and passed in by path at startup. §66's driver-bug matrix is the running cost; this is the build-and-distribute cost, and both are permanent.
- Three config directories on one platform → the §6/§9 backup and migration gaps again. Nothing new; noting that even the incumbent's own testing docs cannot state the data location in one line.
- Ad-hoc signing and quarantine removal → **ABSENT**, LOW, and only relevant much later: the prompt commits to "native Swift for TV", which means Apple developer signing and notarisation eventually, but nothing in v1 ships a binary.

## 103. https://jellyfin.org/docs/general/testing/upgrades
Upgrades and downgrades — **the migration page**, and it states CanonCore's migration rule and its cost in the incumbent's own words.

The core rule, verbatim: "Generally, once you've upgraded to an Unstable version from a given Stable version, **you can't simply downgrade back to that original Stable version. This is because Unstable versions will likely have made changes to the database schemas, configuration entries, and other metadata, which the older Stable version cannot handle. The only way to downgrade from an Unstable to an older Stable is to restore from a backup, or to completely clear out your data and start again.**" With the exception that upgrading Unstable → the newly released Stable works, in a 1-2 week window during which weekly builds are paused.

Also on the page:
- **No beta builds**, with the reasoning: "Because of the massive complexity of packaging Jellyfin for multiple unique platforms ... we have decided **not to provide explicitly tagged pre-release builds. This is quite unusual for free-and-open-source software, but is a practical necessity** to streamline our major releases and increase their cadence." Compensated by a feature-freeze window mapping weekly Unstable builds onto notional beta and release-candidate weeks.
- **Stable's contract**: "A particular major release (e.g. 10.8.z, 10.9.z) will not introduce, remove, or change major features or functionality (with minor caveats for security)."
- **Plugin versioning across channels**: separate Stable and Unstable plugin repositories, with a scheme chosen so a version can travel both ways — "13.0.0.0 Stable -> 13.2024.0429.0 Unstable -> 14.0.0.0 Stable".
- "We generally **recommend against automatic updates in general even on Stable**, as it can result in missed release notes from new versions."
- And the line that matters most for CanonCore: for preserving watch state across a rollback, "You can utilize certain plugins to help with this, for instance the **Trakt plugin to synchronize watched status, but this will not necessarily preserve everything.**"

Findings:
- **Forward-only migrations** → **ADOPTED**, and this is the prompt's rule confirmed by the incumbent along with its full price. "MIGRATIONS ARE AN ORDERED, FORWARD-APPLICABLE LADDER FROM THE FIRST COMMIT. Every schema change is a numbered migration that applies cleanly on top of the last, and **a released version can always migrate forward**. Cheap now; expensive the moment anyone other than you is running it, because from then on you cannot edit history." Jellyfin has exactly this and no down-migrations, and the consequence is stated plainly: the only rollback is a restore. Nothing here suggests the prompt should add down-migrations — the industry answer is that a backup *is* the downgrade path.
- Which makes the **backup gap the load-bearing one**, and this page is why. Forward-only migrations are only survivable if restoring is a documented, tested operation, so the §4/§6 finding is not a nice-to-have adjacent to the migration ladder — **it is the other half of it**. Rated HIGH at §6; this page is the argument for that rating, from the incumbent, and it is reinforced by the Trakt line: the only way Jellyfin can preserve *watch state* across a rollback is a third-party scrobbler that "will not necessarily preserve everything". CanonCore's watch events are append-only and its statements carry provenance, so its data is far more recoverable in principle and far more valuable to lose — hand-curated placements, ranks and remembered rejections exist nowhere else, by design.
- **Release channels and a stated stability contract per major version** → **ABSENT**, LOW at v1 and MEDIUM the moment a second person runs it. Note the prompt already carries the trigger: the migration rule's whole justification is "the moment anyone other than you is running it".
- **"Recommend against automatic updates"** → and yet §11's troubleshooting and §35's packaging pages assume users update through a package manager. The tension is real and unresolved in the incumbent; CanonCore has no update mechanism specified at all, which is the same LOW/MEDIUM as the packaging gap and folded into it.
- The plugin cross-channel version scheme → clever and inapplicable: CanonCore's providers are separate services at URLs, with "Separate deploy, separate lifecycle, no shared code", so a provider's version and the app's version are independent by construction. Recording it as a problem the architecture removes rather than solves.

## 104. https://jellyfin.org/docs/general/testing/web/
Testing the web clients. Per-PR preview deployments: "Each pull request of Jellyfin Web and Jellyfin Vue is automatically deployed to **Cloudflare Pages** ... there should be a comment from `jellyfin-bot` with a link to a deployed version." Previews are wired to a shared demo server — "For Jellyfin Web, it will be **linked automatically to our demo server**" — and Jellyfin Vue connects to `https://demo.jellyfin.org/unstable/` with "credentials ... provided on the login page". "Jellyfin web clients can be hosted as a **standalone application without being associated with a Jellyfin server**."

Two warnings, both verbatim and both worth keeping:
- "**Using a development version of clients may lead to data corruption or loss on the server.** Please use a dedicated test server and make regular backups."
- "Although Cloudflare Pages deployments from Pull Requests are built into our CI/CD workflow in a completely transparent and auditable manner, **some of them may come from external contributors that might not be good actors!** By default, never trust any artifacts given by anyone outside the official channels if you can't inspect the source code first. **They might compromise your system or track your activity!**"

Findings:
- **Per-PR preview deployments** → **ABSENT**, LOW-MEDIUM. Ordinary modern practice, unspecified rather than refused, and the prompt's stack (Next.js, Turborepo) makes it nearly free. Worth noting only because the prompt's stop condition is "a rendered page in a browser" and a reviewable URL per branch is the cheapest way to make that condition checkable by someone other than the author.
- **A public demo used as the backend for client testing** → directly relevant. The prompt's demo is "ONE public read-only instance, the only surface where CanonCore is a publisher", and read-only is what makes this use safe: Jellyfin's demo hands out credentials on the login page and its own docs then warn that a dev client "may lead to data corruption or loss on the server". A read-only demo cannot be corrupted by a client, which is a second, unstated benefit of a decision the prompt took for licensing and publishing reasons. **ADOPTED**, and stronger than the incumbent's.
- **Untrusted build artefacts from external contributors** → **ABSENT**, LOW at v1 and the correct instinct to record. It is the supply-chain form of the prompt's provider stance: "a provider IS a user-supplied URL", handled by "ONE Safe External Fetch boundary". A PR preview is a user-supplied *build*, and the reason CanonCore is less exposed is again the refusal of plugins — there is no artefact a third party can get a user to install.
- "Web clients can be hosted standalone without being associated with a server" → a **decoupled client that names its server at runtime**. CanonCore's phone and TV clients will need exactly this (a server URL entered at first run), and the monorepo decision — "the API contract, the database schema, the Zod schemas, and design tokens" as workspace packages "from the FIRST COMMIT" — is what makes a shared client against an arbitrary instance tractable. Convergent; no gap.

## 105. https://jellyfin.org/docs/project/branding
The **legal and trademark** page, and the one that supplies the missing half of §1's licence finding. "The name 'Jellyfin' and the primary logo ... are **trademarks in Canada, the United States, the European Union, and China of 'Jellyfin, Inc.', an Ontario, Canada-based not-for-profit corporation.**" A "perpetual, no cost license" to the team; for everyone else, permission is required, with exceptions:
- "Any instance of the Jellyfin software running for any purpose accessible for **no fee** to its users is granted an implicit license to use the name and logo ... **If you charge for access to your server in any form, you are required to change the branding** of the server in some way to clearly identify that the server owner is not 'Jellyfin' as a project, **and provide at least one method of contact** for the server." (§94's Login Disclaimer is named as the mechanism, and from 10.11.x the logo and name can be changed too.)
- Affix use is allowed — "'Awesome Client for Jellyfin' is permitted. You may not use the name directly, in a way that makes the program appear to be an official client; for example 'Jellyfin MyPlatform' is not permitted." Sub-word derivatives are fine ("Jellyseer", "Audiofin").
- "**Any fork of Jellyfin or an official client application for public distribution must use a different name and logo.**"
- "The logo colours are **not subject to trademark**, and the purple-blue gradient theme may be used with another logo shape."
Plus writing-style rules ("It is not 'JellyFin', 'Jelly Fin'"), a per-context casing table, and design tokens: Gradient `#AA5CC3` → `#00A4DC`, Background `#000B25`, Theme background `#101010`, accent `#00A4DC`, Plus Jakarta Sans. Carrying a live warning: "**Jellyfin is currently rebranding, as such these guidelines (including the logo) are outdated.**"

Findings:
- **A licence for the code, and a name/mark policy** → **ABSENT**, and this page raises §1's rating rather than repeating it. The prompt commits to shipping "SELF-HOSTED software ... software someone else runs", to a public demo, to a **CanonCore organisation** holding provider repos, and to a **CMPP store** that "ACCEPT[S] rather than open[s]" third-party providers — four things that each presuppose a legal footing the prompt never establishes. Without a code licence nobody may run or fork it; without a mark policy the store has no basis to accept or refuse anyone, and "CanonCore-compatible provider" has no defined meaning. **HIGH**, same rating as §1, now with the second half named: it is not only a licence that is missing, it is the entity and the policy that a distribution tier and an acceptance decision both require.
- The **fee-based rebranding clause** is the transferable idea, and an unusually good one: free instances may carry the project's identity, paid instances must visibly identify their operator and provide contact. It solves for the exact case CanonCore's demo creates — one instance where the project is the publisher, and many where it is not — and it needs no infrastructure beyond a settings field.
- **"Any fork ... must use a different name and logo"** → the clean separation of *code licence* from *mark licence*: fork the software freely, but not the identity. The prompt's own naming standing rule ("Canon is the product's name and nothing else — not a field, not a UI word") is an internal-vocabulary rule and does not do this job.
- **Design tokens published as literal hex values** → convergent with "design tokens as PLAIN TYPESCRIPT rather than a Tailwind config", and the "guidelines (including the logo) are outdated" warning is the argument for the prompt's version: tokens that live in a shared package are updated once, whereas tokens documented in prose go stale in exactly this way.

## 106. https://jellyfin.org/downloads/
## 107. https://jellyfin.org/downloads/clients/
The same page — `/downloads/` renders the clients view by default, and the two URLs return byte-identical content (verified). A client-side filtered catalogue with tabs **Clients / Server / Full Repository** and a Recommended/All toggle, so the server half never appears in the fetched markup.

The official client roster, which is the substantive content: **Jellyfin Media Player** (desktop), **JellyCon** (Kodi add-on), **Jellyfin for Android**, **Jellyfin for iOS**, **Jellyfin for Android TV** (and Fire TV), **Jellyfin for Roku**, **Jellyfin for WebOS** (LG), **Jellyfin for Tizen** (Samsung), **Jellyfin for Xbox** — nine official clients across eight store channels (F-Droid, Amazon Appstore, Play Store, App Store, Roku Channel Store, LG Content Store, Samsung Smart TV App Store, Microsoft Store), plus GitHub for every one. And one store-friction note, verbatim: "**Due to a technical limitation of the Roku store, the Jellyfin app for Roku may state that a cable or satellite subscription is required. However, no subscription of any form is required** to use the Jellyfin server or any official client."

Findings:
- **Nine first-party clients** → **DIVERGENT**, deliberately and with the reasoning already written down. The prompt commits to web now, "Expo for phone and native Swift for TV ... later", and explicitly weighs this against the alternative: "Across ten comparable self-hosted projects the highest-leverage client work by a wide margin was implementing an EXISTING CLIENT PROTOCOL rather than writing an app ... Five of the ten never built an app at all, and two of those are the healthiest projects in the set. The apps are being built anyway, deliberately. **Do not re-argue it, and do not quietly drop them either.**" This page is what the other road looks like: nine codebases, eight store relationships, and §93's capability matrix showing they do not even agree on which auth flows they support. Nothing to re-argue; recording the scale.
- **App-store distribution as a hard external dependency** → **ABSENT**. **MEDIUM**, and it is the first constraint in the prompt's client plan that is not under the author's control. The prompt names the *engineering* reasons for native Swift on TV in detail (focus engine, `TextInput`, codec coverage, `expo-video`'s missing MKV/DTS/PGS) and says nothing about how either app reaches a device. That matters most for the committed TV app, because tvOS has **no sideload path at all** — no F-Droid, no APK, no equivalent of the eight channels above — so a self-hosted TV client is App Store or TestFlight or nothing, under review by a party with opinions about apps that play arbitrary user media. Jellyfin's Roku note is a small taste of the same friction. Not a v1 issue by the prompt's own sequencing ("nothing in the first version is gated on them"), but it is a gate on a decision already taken, and it should be checked before the phone app ships rather than after the TV app is written.
- **A downloads page that is a filtered catalogue with a Full Repository tab** → **ABSENT**, LOW; a project-website concern, and CanonCore has no released artefact yet (§101).
- One line on the shape: every client links to **GitHub first** and a store second. The distribution story for self-hosted software is source plus a store listing, and the store listing is the part that costs.

---

# GAPS — ABSENT FROM CANONCORE

Consolidated from all 107 pages. **MEDIUM and HIGH only**; LOW findings stay in their sections.
Each entry names the thing, where it was found, and why it matters. Nothing here is a
disagreement with the prompt — every one is something the prompt says *nothing* about.

Read the HIGH list as an ordered set of decisions still to take, not as a backlog. Several
are cheap to state and expensive to retrofit, which is the same shape as the prompt's own
"Per-field provenance CANNOT be retrofitted".

## HIGH

**The scanner half is unspecified where it is not merely unproven.**
The prompt already flags that files, file identity, the scanner, edition coverage, progress,
watch events and playback "ship built and unproven" because the stop condition ends at a
rendered page. That is a *testing* caveat. These four are different: they are questions the
model does not answer at all, and three of them can be settled in a paragraph each.

1. **How a scanned file binds to an item or edition.** §79.
   File *identity* is fully specified (SHA1 of size + first/last 64KB) and the attachment point
   is fully specified ("Attached to item or edition, NEVER to a placement"). Nothing says how the
   scanner gets from bytes on disk to the right row. Jellyfin's answer is the path; CanonCore
   discards the path as identity and puts nothing in its place, and a provider matches *records*,
   not the owner's files. Needs at minimum a stated answer to "an unbound file arrives; what
   happens?" — most likely an unmatched-files queue reusing the review queue and its remembered
   rejections, which the prompt already owns.
2. **What happens when a known file disappears.** §10, §95, §96.
   Jellyfin's `Clean up collections and playlists` task destroys hand-curated playlists when a
   network share is late mounting, unattended, at startup, by default. CanonCore has every
   ingredient for the same bug — periodic scans, network mounts explicitly supported, media-
   independent items — and its irreplaceable asset *is* the hand-curated data. A missing file must
   be a state on the file row, never a deletion, and never a cascade to a placement.
3. **One edition spread across several files.** §79, §83.
   `-cd1/-cd2/-cd3` and `S01E01-part-1/-part-2` are ordinary. The `files` row has bytes, an
   attachment point and a role, and **no part index and no ordering**, so two files on one edition
   have no play order. `edition_coverage` cannot supply it: it describes intervals over the
   *work's* parts, deliberately. An ordinal on `files` is the whole fix. Note Jellyfin cannot do
   this at all — "This does not work with multiple versions or merging".
4. **Where duration comes from.** §79.
   Three settled playback rules need the duration of the owner's specific file: time-remaining
   completion, the percentage fallback "where duration is unknown", and force-complete under five
   minutes. A provider supplies a *work's* runtime, not this file's. The usual answer is `ffprobe`
   and the prompt says "No transcoding, no ffmpeg". Either probing is outside the ban, or duration
   arrives from the client at playback time, or the three rules are unimplementable. Say which.

**Operating the software someone else runs.**

5. **A licence for the code, a legal footing, and a name/mark policy.** §1, §105.
   The prompt commits to self-hosted software, a public demo where CanonCore is the publisher, a
   **CanonCore organisation** holding provider repos, and a **CMPP store** that "ACCEPT[S] rather
   than open[s]" providers. All four presuppose a licence and an entity that are never named.
   Without a licence nobody may legally run or fork it; without a mark policy the store has no
   basis to accept or refuse anyone and "CanonCore-compatible provider" means nothing. The
   BY-SA obligation on archive-derived output is stated while the code licence is not.
   Jellyfin's fee-based rebranding clause (free instances carry the identity; paid instances must
   identify their operator and give a contact) is the transferable half.
6. **Backup and restore of owner data.** §4, §6, §100, §103.
   The single most-repeated finding on the site. CanonCore's owner data — statements, ranks,
   placements, remembered rejections, watch events — is hand-curated and recoverable from no
   provider. §103 is why this is not optional: **forward-only migrations are only survivable if
   restoring is documented and tested**, and the prompt's migration ladder is explicitly
   forward-only. Jellyfin states the same consequence in its own words ("The only way to downgrade
   ... is to restore from a backup"), and its only route for watch state is a third-party
   scrobbler that "will not necessarily preserve everything".
7. **A documented rollback procedure.** §37, and the other half of (6).
   Binaries roll back only because they are separable from data. The database is one-way by design.
8. **A distribution and packaging story, and a container image with a tag policy.** §35, §42, §101.
   "Software someone else runs" has no artefact anyone else can install. The tag policy is the
   cheap, concrete half: a no-backward-compatibility rule needs a tag that pins a major line.
9. **A versioning policy for the public contract.** §30.
   CMPP is implemented by third parties, in their own repos, on their own deploy cadence. Jellyfin's
   major-version trigger is defined entirely as "breaks the HTTP or plugin APIs" for exactly this
   reason. The prompt's "Do not preserve backward compatibility" is a rule for *this* repo and
   cannot govern a contract other people build against without a stated version and deprecation path.
10. **Login brute-force protection, lockout, and credential recovery.** §11, §47, §97.
    One password guards everything, and the prompt's own security section hardens only outbound
    fetches. Jellyfin's numbers are there to borrow (3 attempts, 5 for admin, `-1` disables), but
    its *shape* does not transfer: locking out the only account is self-inflicted denial of
    service with no administrator to unlock it, so the answer is probably escalating delay.
    Recovery needs a stated answer too — for self-hosted software, a local CLI or config reset,
    never an email loop, and never Jellyfin's "log in without giving a password" state.
11. **Never put a credential in a URL.** §52.
    This lands on a mechanism the prompt *does* specify: playback goes "through an app-owned
    opaque-id route". A token in a query string is logged by every proxy in the path, sits in
    referrer headers, and is what forces Jellyfin's operators to write log-censoring rules.
12. **A server-side image processor: cache, resize, and a stable local URL for artwork.** §31.
    The artwork table stores a provider URL and a palette. Hotlinking leaks every viewer's IP to
    TMDB *including on the public demo*, breaks permanently when a provider rotates a URL, and
    ships no thumbnails. The palette is already extracted at fetch time, so the fetch already exists.

## MEDIUM-HIGH

13. **Bounded concurrency and resource limits for scans and enrichment.** §7, §9, §75, §84.
    Enrichment "reaches ALL connected providers at once", TMDB is "rate-limited", and no per-provider
    request-rate or concurrency cap is specified anywhere. A limit that lives only in a provider's own
    repo cannot protect a source two groups both ask. This is a contract-level field — declared by the
    provider, honoured by CanonCore.
14. **Trust `X-Forwarded-For` only from configured known proxies.** §52, §56.
    Any IP-based limit behind a reverse proxy is trivially defeated without it, and (10) depends on it.
15. **Security response headers as a stated part of the product.** §56.
    Sharpened by CanonCore's own design: artwork loads from third-party origins, so a CSP has to name
    them, and the public demo is an unauthenticated surface.
16. **A preferred metadata language, server-wide with per-group override.** §23, §59.
    The incumbent's answer to a question CanonCore's model asks *harder*, because multi-valued fields
    with provenance mean two languages are two live claims rather than one overwrite.

## MEDIUM

Grouped by where the decision belongs.

**Scanner and files** — §77 scan exclusion of any kind (and it belongs in a table next to the
scanner root, not in a dot-file on the media volume); §79 sidecar association and language,
including where `forced`/`default`/`sdh` live as fields on the file row; §79 extras and
supplementary material, which contains an inconsistency to resolve — the file roles are closed at
`media|subtitle|audio|chapters` with no `extra`, yet the completion rule says trailers play and
therefore accrue per-edition progress; §79 which extensions and container shapes the scanner
accepts; §80 whether embedded tags inside a media file are readable, which is the same question as
(4) and should get the same answer; §83 a single file containing two works.

**Providers and enrichment** — §84 a connected-but-unreachable or persistently-failing provider
needs a durable degraded state, not a per-request failure; §92 the same seen from the other side, a
provider that is connected, authenticated and returning nothing usable; §86 manual identifier entry
as the owner's accuracy escape hatch.

**Model** — §87 typed intervals over an edition's playback timeline (skip intro / recap / outro).
The one genuinely modern capability in the metadata section, with no construct in the model:
`edition_coverage` is intervals over the *work's* parts and explicitly for expressing what is
missing. Copy two things from Jellyfin's version — the server stores facts and the client decides
the action, and the segment is provider-supplied so it arrives as a disputable claim.

**Curation durability** — §96 every negative curation decision needs a durable row, not only the
review queue's. "Removed temporarily but picked up on the next library scan" is Jellyfin's third
instance of the same bug (deleted media returns, removed devices return, exclusions must live on
the media volume), and it generalises: in a derived catalogue, no negative decision survives unless
it is written somewhere the derivation reads. The prompt gets this right once, for match rejections,
and the same rule has to cover dismissed redundant-file suggestions and ignored paths.

**Surfaces the product needs and has not named** — §71, §95 a visible scheduled-task and
background-work surface, with last-run results and run-now, which also answers §71's scan progress
and §16's server-push want; §70, §93, §97 one device/session register covering pairing, approval and
revocation; §93 specifically a code-based device-authorisation flow, which is inside committed scope
because the prompt commits to a native TV app *and* to a single password typed on a remote — and it
should default to off, unlike Jellyfin's; §59 a first-run flow that creates the single account;
§97 a user-visible activity feed.

**Deployment and operation** — §7 documented data/config/cache/log directory layout with an
explicitly disposable cache; §36, §50, §55 a `/health` endpoint that checks database connectivity,
consumed by orchestrator probes, watchdogs and load balancers; §16, §46, §53 base-path/subpath
hosting and a published external URL setting; §56 `proxy_buffering off` for the byte-serving route,
which direct-play makes load-bearing; §52 websocket support as a deployment requirement if
server-push is ever built; §53 client-side cache invalidation across upgrades; §35, §57 one
recommended deployment recipe short enough to paste; §58 a documented "do not expose it, use a VPN
overlay" option; §37 a settings escape hatch that does not need the UI; §41 supply-chain posture on
the install path; §11 scanner failure diagnostics for permissions and unreadable paths; §30 release
notes, a changelog and an update path; §9 migrating an instance between machines.

**Public surface and privacy** — §1 a telemetry / phone-home stance, which is the thing
self-hosters actually audit and the prompt only hardens the inbound direction; §94 the public read
path's field-naming rule covers *fields* and not **derived assets** — a montage, a poster wall, an
OG preview image or a stats line on the demo is a new emission the rule does not reach, and
Jellyfin's default-on splash screen is precisely that failure; §56 `X-Robots-Tag: noindex` on a
self-hosted instance; §22 the Cloudflare-tunnel streaming prohibition, which constrains where a
self-hoster may put this.

**Clients** — §13 a declared browser support target; §69 the client declares its capabilities to
the server, which direct-play-only collapses to a yes/no but still needs; §106/§107 app-store
distribution as a hard external dependency, and it is the first constraint in the committed client
plan outside the author's control: tvOS has no sideload path at all, so a self-hosted TV client is
App Store or TestFlight or nothing. Not a v1 issue by the prompt's own sequencing, but it gates a
decision already taken and should be checked before the phone app ships, not after the TV app is
written.

**Project** — §23 internationalisation, recurring across the contribution pages; §103 release
channels and a stability contract, LOW at v1 and MEDIUM the moment a second person runs it.

---

## Closing note on this shard

The eight media/naming pages (§76–§83) are the centre of gravity. Together they are a complete
specification of the model CanonCore refuses — path as identity, ordering in filenames, versions as
string prefixes matched character-for-character, artwork and metadata scraped from magic filenames —
and reading them as a specification of *requirements* rather than of mechanisms is what produced
four of the fifteen HIGH gaps above. The refusals hold up: every one of the prompt's four stated
reasons for existing was confirmed verbatim somewhere in this shard, three of them by Jellyfin's own
documentation admitting the limitation (§78 "broken and deprecated", §88 `lockedfields`, §83
"Episode numbering for specials may vary from metadata provider to metadata provider"). But
refusing a mechanism does not remove the requirement it was meeting, and the gaps are almost
entirely in that space.

STATUS: complete
