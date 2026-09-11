# Sweep: Plex Support articles (shard `plex-support-ac`) vs the CanonCore prompt

STATUS: complete

Source list: `shards/plex-support-ac` (110 URLs).
Method: articles 001-080 via plain `curl` through the `r.jina.ai` extraction proxy; articles
081-110 via plain `curl` direct to support.plex.tv (HTTP 200, no proxy, no User-Agent header) with
local HTML extraction, since the remaining URLs are category indexes whose value is the article
list. Appended every 5 articles. Consolidated GAPS section at the end.

Classification key:
- **ADOPTED** — the prompt already says the same thing, or explicitly builds it.
- **REFUSED** — the prompt explicitly rules it out (WHAT NOT TO BUILD / STANDING RULES).
- **DIVERGENT** — the prompt takes a deliberately different position on the same problem.
- **ABSENT** — the prompt says nothing at all. Rated LOW / MEDIUM / HIGH for whether a
  self-hosted media catalogue genuinely needs it.

## Progress log

(URLs completed are listed under each batch heading below; a resume can start after the last one.)

---

## Batch 1 — articles 001–005

### 001 https://support.plex.tv/articles/205744257-getting-started-with-plex-music/
Music library as a first-class media type: browse artists/albums, sort by genre, Popular Tracks,
Similar Artists, upcoming tour dates, music videos, multi-disc albums, per-artist/album/track
editing, sharing. Plex Pass premium: automatic lyrics (LyricFind), loudness levelling, "Sweet
Fades" crossfade, visualizers.
- Rule: premium features gated on a subscription signed in at both app and server.
- **DIVERGENT** on library typing — prompt: groups are "never typed by medium … a Plex library is
  typed, and that is exactly what stops a container holding mixed media." Music is just items with
  `audio` editions.
- **ABSENT**: artist-level derived surfaces (popular tracks, similar artists), tour dates,
  lyrics, loudness levelling, crossfade, visualizers. Need: **LOW** — these are renderer/discovery
  extras, and the prompt caps at a rendered page with direct play only.
- **ABSENT**: track/album/artist as a *shape* (a three-level music hierarchy). Need: **LOW** —
  the container/placement model already expresses it without new kinds.

### 002 https://support.plex.tv/articles/205748387-how-do-i-use-multi-disc-support-for-my-music-libraries/
Multi-disc albums. Disc/track numbers come from embedded file tags at scan time.
- Rule, verbatim: "The disc information about tracks and albums is gathered during the scan when
  the content is first added to your library. If you have existing content in your music library
  that isn't set correctly with multiple discs, then Refreshing the album or doing an Update on
  the library won't do anything for you." (i.e. re-add to re-derive)
- **DIVERGENT**: a multi-disc album is a container of containers with per-placement positions —
  exactly the thing the prompt puts on `placements`. Plex needs a special case because ordering
  lives in tags; CanonCore does not.
- **ABSENT**: reading embedded metadata tags (ID3/Vorbis/MP4 atoms) from media files at scan time.
  The prompt bans `.nfo` and artwork scanning but says nothing about embedded tags. Need:
  **MEDIUM** — for a private instance with no provider connected, embedded tags are the only
  metadata that exists; this is a real "where does data come from with zero providers" hole.
  (See GAPS.)
- **ABSENT**: a scan is not re-runnable for derived structure. CanonCore's equivalent question —
  what a re-scan of an already-known file is allowed to change — is unaddressed. Need: **MEDIUM**.

### 003 https://support.plex.tv/articles/205976358-purchasing-a-plex-pass-subscription-through-itunes/
In-app purchase of a subscription through the App Store; managing, upgrading, restoring purchases.
- Rule, verbatim: "Plex subscriptions purchased through the app _cannot_ be refunded by us."
- **REFUSED / out of scope**: CanonCore is self-hosted software plus one read-only demo. There is
  no subscription, no account service, no billing. Nothing to adopt.
- Need: **LOW** (n/a).

### 004 https://support.plex.tv/articles/206225077-how-to-use-secure-server-connections/
TLS for a self-hosted server: Plex mints Let's Encrypt certs per server and resolves them through
a wildcard `*.plex.direct` DNS scheme so a cert can follow changing LAN/WAN IPs. Setting
`Secure connections` has three states, default `Preferred`. DNS-rebinding protection on routers
breaks it; documented `rebind-domain-ok=/plex.direct/` and pfSense `private-domain: "plex.direct"`
workarounds.
- Rule, verbatim: "By default the Secure Connections setting on your Plex Media Server is set to
  `Preferred`. That means that secure connections will always be used when one is available."
- **ABSENT**: how a self-hosted CanonCore instance is reached over TLS at all. The prompt's only
  security content is the public read path field allow-list and the Safe External Fetch boundary
  (outbound). There is no inbound story: no cert, no hostname, no reverse-proxy guidance, no
  remote access. Need: **MEDIUM** — the phone and TV clients in the prompt cannot connect to a
  home instance over the internet without one, and the prompt commits to both apps. (See GAPS.)
- **ABSENT**: an explicit "which addresses does this server publish itself on" concept
  (LAN vs WAN vs manual). Need: **LOW** at the render-a-page cap, MEDIUM once the phone app lands.

### 005 https://support.plex.tv/articles/206239048-xbox-one-logs/
Client-side logging: an app setting ("Log to Media Server") makes the client stream its log lines
into the server's own `Plex Media Server.log`, so one bundle carries both sides of a bug.
- **ABSENT**: logging and diagnostics generally — no log file, no log level, no "download a
  diagnostics bundle", no client-to-server log relay anywhere in the prompt. Need: **MEDIUM** —
  self-hosted software's only support channel is the operator reading a log; the prompt has an
  import/enrichment pipeline with a review queue and drop counts and nowhere to see what actually
  happened during a run. (See GAPS.)

## Batch 2 — articles 006–010

### 006 https://support.plex.tv/articles/206318037-what-are-the-features-and-limitations-without-unlocking-the-app/
App activation / freemium gating in the client itself.
- Rule, verbatim: "Video is limited to one minute of playback / Music is limited to one minute of
  playback / Photos will have a watermark added" until the app is unlocked.
- **REFUSED / out of scope**: no licensing, no client activation, no watermark.
- Also documents a **PHOTOS** media type with its own viewer. CanonCore's `medium` is
  `video|audio|text|image` (closed), so `image` exists — but there is no photo/gallery surface
  described anywhere. Need: **LOW** — an `image` edition renders as a page, which the prompt
  already implies.

### 007 https://support.plex.tv/articles/206721658-using-plex-tv-resources-information-to-troubleshoot-app-connections/
A central account service holds a per-account *resources* directory (`/api/resources`) listing
every server and client, each with its addresses, so clients can discover servers. Auth is a
bearer `X-Plex-Token`. Diagnostics walk that XML.
- **DIVERGENT**: CanonCore has no central directory (self-hosted, single owner, no account
  service). Discovery is the user typing a URL.
- **ABSENT**: the auth token model for non-browser clients. The prompt says "one password" and
  a "single-password cookie session" — a cookie is a browser mechanism; the committed Expo and
  Swift clients need a token. Need: **HIGH**. (See GAPS.)
- **ABSENT**: server/client identity at all — no device id, no "which app is connected", no
  session listing. Need: **LOW** while single-user.

### 008 https://support.plex.tv/articles/206910047-windows-repeated-crashes-of-plex-media-server/
Pure platform troubleshooting: Winsock LSP DLLs from adware crash the server; a ~40-entry DLL
blocklist and a TCP-stack reset.
- **ABSENT / not applicable**: OS-level crash forensics. Need: **LOW**.
- The one transferable idea: Plex maintains a *known-bad-environment list* in support docs rather
  than in code. CanonCore has no equivalent notion of environment preflight. Need: **LOW**.

### 009 https://support.plex.tv/articles/206940077-xbox-one-controller-mapping/
A published, complete input map for a game controller, with two modes (navigation vs playback) and
different meanings for the same key in each. Playback: left = back 10s, right = forward 30s,
up = +10 min, down = -10 min; LB/RB cycle 1x/2x/3x rewind/FF.
- Note the asymmetry as a real design fact: **skip back is 10s, skip forward is 30s**.
- **ADOPTED in principle**: the prompt's standing rule "Every accelerator has an equivalent
  visible UI path" is the same family of concern.
- **ABSENT**: any keyboard/remote/controller map, and the skip-interval values. Need: **MEDIUM**
  for the TV client (tvOS focus engine work is already committed), **LOW** for the first version.
- **ABSENT**: variable-speed playback (rewind/FF rates) and skip intervals as settings. Need: **LOW**.

### 010 https://support.plex.tv/articles/207197477-is-plex-like-netflix/
Positioning article. Distinguishes "your own content" from Plex-supplied ad-supported VOD and 250+
free live-TV channels. Enumerates the Plex Pass feature list: offline Downloads, DVR, Plex Home
with content restrictions and user switching, automatic trailers and extras, lyrics.
- **REFUSED**: Plex-supplied catalogue content — CanonCore "never stores media: a source is a
  reference" and is a publisher only on the demo.
- **ABSENT**: **offline download / sync to a device**. Nothing in the prompt. Need: **MEDIUM** —
  a phone client for a home server is used on trains and planes; every comparable product has it,
  and it interacts with the progress model (offline events must reconcile). (See GAPS.)
- **ABSENT**: **trailers and extras** attached to a work. This is a genuine modelling question the
  prompt does not answer: is a trailer an edition, a separate item, or neither? Under the prompt's
  own rule ("AN EDITION EXISTS WHEN IT CHANGES WHAT YOU WOULD CONSUME OR HOW") a trailer is
  neither — it is different content, so a separate item — but then it floods work-browsing.
  Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: content restrictions / parental ratings. Prompt refuses a visibility system, but
  age-rating is a different axis. Need: **LOW** while single-user.

## Batch 3 — articles 011–015

### 011 https://support.plex.tv/articles/208017237-is-plex-for-roku-open-source/
One-word article. Rule, verbatim: "No. Our current-generation Plex channel is custom, written from
the ground up, and developed entirely by Plex. This app is _not_ open source."
- **ABSENT**: CanonCore's own licensing posture is not stated anywhere in the prompt — not for the
  server, not for the clients, not for the CMPP contract, not for a bundled provider definition.
  Need: **MEDIUM** — "self-hosted software plus a CMPP store of third-party providers" is a
  licence-shaped decision (contract spec licence vs code licence), and it is cheap now and
  contentious later. (See GAPS.)

### 012 https://support.plex.tv/articles/208584807-do-i-need-a-plex-account-to-use-the-roku-channel/
Whether an account is required. Notes local discovery (GDM/subnet broadcast) exists but fails
across subnets, so the account directory is the reliable path.
- Rule, verbatim: "Many Plex apps (such as PlayStation, Smart TVs, and Xbox) will _only_ work when
  both the app and server are signed in."
- **DIVERGENT / ADOPTED**: prompt has "one password, no signup" and a read-only demo with no login,
  which is deliberately the opposite posture.
- **ABSENT**: **local network discovery of the server by a client** (mDNS/Bonjour or a broadcast
  beacon). The phone/TV clients are committed, and every one of them has to be told an address by
  hand without it. Need: **MEDIUM**. (See GAPS.)

### 013 https://support.plex.tv/articles/212438978-conversion-queue/
A visible, user-manageable **background job queue**: Activity > Conversion lists in-progress and
queued jobs, each row showing item, profile, and status (converting / waiting / paused), with
per-row actions to promote to next-in-queue or delete the job (with a confirm).
- **REFUSED** in its subject matter: transcoding/optimisation is explicitly out.
- **ABSENT** in its *shape*, and this is the transferable part: CanonCore has at least four
  long-running background processes — the scanner, provider enrichment ("Applying runs in the
  background against the thresholds"), the wholesale read-projection rebuild, and file hashing —
  and the prompt names none of the operator surface for them. No queue, no status, no progress, no
  cancel, no reorder, no "what is this server doing right now". Need: **HIGH**. (See GAPS.)
- Concrete borrowable rules: queue is reorderable; deleting a job is confirmed; a deleted job is
  re-enqueueable from the settings page that owns it.

### 014 https://support.plex.tv/articles/212639598-apple-tv-logs/
Client log retrieval over the LAN: enabling a setting exposes `http://[device]:32500/logging`.
- Rule, verbatim: "The ability to access the logs over the network will remain active for 20
  minutes." — a self-expiring debug endpoint, which is a nice security pattern.
- **ABSENT**: same gap as 005 (logging/diagnostics). The time-boxed debug endpoint is a specific
  idea worth stealing. Need: **MEDIUM**.

### 015 https://support.plex.tv/articles/212643067-faq-general-using-manual-server-connections/
**404 — article retired.** Title indicates it covered manually adding a server connection
(explicit host:port entry in a client). Only the cookie banner was served.
- Same territory as 004/012: **ABSENT** — no manual-connection / explicit-address concept.
  Need: **MEDIUM** (it is the fallback when discovery fails).
- Worth noting for the sweep: the shard contains at least one dead URL.

## Batch 4 — articles 016–020

### 016 https://support.plex.tv/articles/212840428-do-i-need-a-plex-account-to-use-the-apple-tv-app/
Same content as 012, for Apple TV, where the answer is "yes" — account required.
- **DIVERGENT**: CanonCore has no account service; this is settled by "one password, no signup".
- Reinforces the 012 gap: **ABSENT** cross-subnet discovery. Need: **MEDIUM**.

### 017 https://support.plex.tv/articles/213095317-creating-optimized-versions/
Media Optimizer setup. Transcoding is refused, but three orthogonal mechanisms are documented here.
- **(a) A bulk action driven off the current filter/sort.** Verbatim: "It will also work when you
  filter and sort content, which means you could create an optimization for the '5 most recently
  added comedy movies'". A *saved query with a limit* is the job's definition, re-evaluated over
  time, not a fixed item list.
- **(b) A live, self-maintaining job:** "Unwatched Only … once an item has become 'watched' it will
  no longer be part of the optimization job … the optimized version for that particular movie
  would automatically get removed." A rule-derived set that reacts to progress state.
- **(c) A named job**: "Select a title to identify this optimization."
- **REFUSED**: transcoding, quality profiles, bitrate caps, burned-in subtitles.
- **ABSENT**: **bulk operations over a selection or a filter**. The prompt has no batch anything —
  no multi-select, no "apply to all matching", no bulk enrichment target, no bulk placement. For a
  catalogue with 11,285 stories in the stress-test archive this is not optional. Need: **HIGH**.
  (See GAPS.)
- **ABSENT**: rule-derived containers *reacting to progress* (an "unwatched" predicate). The prompt
  has rule-derived containers but never says what predicates a rule may use, or when it
  re-evaluates. Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: a *storage-location choice* for anything the product writes. Prompt's standing rule
  "The scanner NEVER writes storage" covers the scanner; nothing else is stated. Consistent, not a
  gap. Need: **LOW**.

### 018 https://support.plex.tv/articles/213097057-optimized-versions/
Management surface for the objects created in 017: a table of name / profile / status, click a row
for detail, hover for edit and delete, delete is confirmed.
- **REFUSED** in subject; the *pattern* (a settings page listing every long-lived derived artefact
  the server maintains, each editable and deletable) is the same HIGH gap as 013. Need: **HIGH**.

### 019 https://support.plex.tv/articles/213379118-how-do-i-get-plex-content-to-show-up-in-the-top-shelf/
Platform integration: publishing content into the tvOS Top Shelf, with a documented list of
preconditions.
- Rule, verbatim: the app must be "in the first row of apps on your home screen"; a Home member
  must either auto-sign-in or have no PIN; "Your router must not have DNS Rebind Protection
  enabled."
- **ABSENT**: OS-level surfaces generally — Top Shelf, Siri/Spotlight/handoff, widgets, Now Playing
  lock-screen metadata, Android quick-resume. Need: **LOW** now, **MEDIUM** when the TV app ships,
  because Top Shelf is the tvOS equivalent of Continue Watching and the prompt already computes
  Continue Watching.

### 020 https://support.plex.tv/articles/213807738-how-do-i-delete-content-using-the-apple-tv-app/
Delete from a client. Two-stage: a **server-side setting must first enable deletion at all**, then
a per-item context-menu delete with a Yes/No confirm.
- Rule, verbatim: "Deleting an item this way will immediately remove it from your Library and will
  _also_ delete the corresponding media file. This will usually place it in your operating system's
  Recycle Bin or Trash, but it could immediately and permanently delete the item from your disk."
- **ADOPTED, partly**: prompt's DELETE section is far stronger — three outcomes previewed with
  counts, "Remove from this container" offered only when multi-placed, never dismissible by
  accident.
- **ABSENT**: does CanonCore's "Delete permanently" ever touch the **file on disk**? The prompt
  says the scanner never writes storage, but delete is not the scanner, and the prompt's three
  outcomes are all catalogue-side. An unanswered question with real consequences. Need: **HIGH**.
  (See GAPS.)
- **ABSENT**: a server-level "allow destructive actions" master switch, so a TV remote in a
  living room cannot destroy the library. Need: **MEDIUM**.

## Batch 5 — articles 021–025

### 021 https://support.plex.tv/articles/214079318-media-optimizer-overview/
Overview of pre-transcoding into an alternate "version" of the same library item, chosen
automatically at play time. Named use cases include "Always have optimized episodes for On Deck
television content."
- Rule, verbatim: "the server and app then work together and use the most appropriate version of
  the item to give you the best experience."
- **DIVERGENT**: CanonCore has editions with an explicit pick rule ("A DECLARED ORDER DECIDES UNTIL
  THE OWNER PINS ONE") and the prompt already criticises Plex's version pick — "its automatic pick
  is about what the client can decode, not about which is canonical". This article is the primary
  evidence for that claim and it holds up.
- Introduces **On Deck** — a next-up queue distinct from Continue Watching (Continue Watching =
  partially played; On Deck = the next unwatched episode of a series you are working through).
  **ABSENT**: CanonCore computes Continue Watching but has no "next up / what comes after this"
  concept. Under multi-placement "next" is genuinely ambiguous (next in *which* ordering?), which
  makes it a real design question rather than a feature request. Need: **HIGH**. (See GAPS.)

### 022 https://support.plex.tv/articles/214079348-example-media-optimizer-usage/
Walkthrough of 017. Notable line: "When you play something, the appropriate version will
automatically be selected **or you can manually choose it in many apps**", from a `…` menu on the
preplay screen.
- **ADOPTED**: an explicit per-playback edition override is consistent with the prompt's
  is_default pin, though the prompt only describes the *stored* pin and not a one-shot override.
- **ABSENT**: a **preplay screen** as a distinct surface — the thing between "browse" and "play"
  that shows editions, files, subtitle tracks, and progress. The prompt says "No fixed item-page
  tab structure … decided when screens exist", so this is deliberately deferred, not missed.
  Need: **LOW** (already scoped out).

### 023 https://support.plex.tv/articles/214577427-is-4k-content-supported-on-the-roku/
Per-client codec/resolution capability matrix. Rule, verbatim: "Resolution: 3840×2160 or smaller /
Video Encoding: `H.265` (HEVC; both 8-bit and 10-bit) or `VP9`"; anything else "cannot be played at
4K and will instead be transcoded down to a maximum of 1080p."
- **DIVERGENT / directly relevant**: CanonCore is direct-play only, and the prompt already
  recognises the consequence — "direct-play-only makes client codec coverage load-bearing".
- **ABSENT**: **the client capability profile itself** — how a client tells the server what it can
  decode, and how the server decides a file is playable *before* the user presses play. The
  prompt's rule is "When a file will not play, say so plainly", which requires exactly this
  information and does not say where it comes from. Need: **HIGH**. (See GAPS.)
- **ABSENT**: technical stream metadata on a file at all (codec, resolution, bit depth, channels,
  container). `files` in the prompt carries identity, path and role, and nothing about content.
  Without it neither "say so plainly" nor an edition picker can work. Need: **HIGH**. (See GAPS.)

### 024 https://support.plex.tv/articles/215238778-automatic-lyrics-from-lyricfind/
A third-party licensed-content provider (LyricFind) wired in as an automatic enrichment, with
timed and plain variants, per-app display support, and a hard geographic licence restriction.
- Rule, verbatim: "You will only have content from LyricFind added to your music library if you're
  in a supported country. The tracks/lyrics available can vary from country to country based on
  their license agreements." (~95 listed countries.)
- Rule, verbatim, on backfilling existing libraries: "So long as you have the Refresh metadata
  periodically Scheduled Tasks option enabled, your server will slowly update your library over
  the course of a month to bring in the lyrics." — a deliberately *rate-spread* background
  refresh, plus an immediate "Refresh All" escape hatch.
- **ADOPTED in spirit**: a provider supplying values into the catalogue is exactly CMPP.
- **ABSENT**: **scheduled / periodic re-enrichment**, and its rate-spreading. CanonCore has a
  six-month TMDB cache rule (so refresh *must* happen) and no scheduler, no "refresh all", no
  spread. Need: **HIGH**. (See GAPS.)
- **ABSENT**: a provider declaring **territorial or eligibility constraints** on its data. CMPP
  declares `browse` as optional; nothing declares "this provider cannot answer for you here".
  Need: **LOW**.
- **ABSENT**: lyrics/transcripts as a **time-synchronised sidecar** distinct from subtitles. The
  prompt's file roles are `media|subtitle|audio|chapters`; timed lyrics are a fifth. Need: **LOW**
  — a lyrics file is a subtitle-shaped sidecar and the role vocabulary is a lookup table, so an
  INSERT covers it.

### 025 https://support.plex.tv/articles/215609417-windows-local-plex-web-app-times-out-or-never-loads/
Windows loopback/TCP autotuning breaking the local web app. Pure environment troubleshooting.
- Notable only for the deployment shape it assumes: **the web app is served by the server itself on
  a fixed port (32400), reachable at localhost, at a LAN IP, and hosted remotely** — three
  addresses for one UI.
- **ABSENT**: CanonCore's deployment shape is not stated. Next.js web + oRPC API is decided, but
  not whether they are one process, what port, whether there is a container image, or how a
  non-developer installs it. For "SELF-HOSTED software" this is the distribution question.
  Need: **HIGH**. (See GAPS.)

## Batch 6 — articles 026–030

### 026 https://support.plex.tv/articles/215741688-can-i-airplay-if-i-require-secure-connections-and-have-dns-rebinding-protection/
An interaction bug between two settings: `Secure connections = Required` plus router DNS-rebinding
protection makes AirPlay fail, because the AirPlay receiver cannot reach the server securely.
- **ABSENT**: **casting / AirPlay / external-renderer playback** — sending a stream to a device
  that is not the app. Prompt is silent. Need: **LOW** at the cap, **MEDIUM** for the phone app
  (a phone client for a home library without AirPlay/Cast is unusual).
- Transferable observation: a setting whose strict mode silently disables a feature elsewhere.
  CanonCore has one such candidate already — the Safe External Fetch boundary denying RFC1918 will
  block a provider running on the same LAN as the instance, which is exactly the first-provider
  topology the prompt describes ("ONE service, run on a machine the owner controls"). Need:
  **HIGH** — this is a contradiction inside the prompt, not just a gap. (See GAPS.)

### 027 https://support.plex.tv/articles/215916117-adding-local-lyrics/
Sidecar file conventions. Concrete and quotable.
- Rule, verbatim: "The lyric file _**must**_ be in the same directory as the corresponding music
  track and must be named _identically_, aside from the file extension." Formats: `.lrc` (timed),
  `.txt` (plain).
- Rule, verbatim: "Lyrics embedded in track metadata (such as ID3 tags) are not currently
  supported."
- Local artwork by filename convention, with **enumerated accepted basenames** per role:
  artist poster (`artist`, `artist-cover`, `artist-default`, `artist-folder`, `artist-poster`,
  `cover`, `default`, `folder`, `poster`), artist background (`art`, `artist-art`,
  `artist-backdrop`, `artist-background`, `artist-fanart`, `backdrop`, `background`, `fanart`),
  album poster, album background; extensions `.jpg .jpeg .png .tbn`; square vs 16:9 expectations;
  and a documented fallback — "If no separate background image is provided, then the 'artist'
  background will be used instead."
- Also states the library-layout requirement: "We _strongly_ recommend separating movie and
  television content into separate main directories."
- **REFUSED**, explicitly and by name: "No artwork uploads, no artwork scanning, no `.nfo`
  reading. The scanner takes media files and playback sidecars, and nothing else."
- **ADOPTED**: sidecar-by-adjacent-identical-name is exactly how CanonCore's `files` sidecars must
  be discovered, and the prompt does not say how. **ABSENT**: the *matching rule* for sidecars —
  how the scanner decides a `.srt` accompanies a given media file, and how it derives the
  language. Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: an artwork **role fallback chain** (backdrop falls back to the parent's backdrop).
  CanonCore has `artwork.role` and multi-placement, so "which parent do I inherit a backdrop from"
  is the same unanswerable question the prompt already refuses for visibility. Consistent to leave
  absent. Need: **LOW**.

### 028 https://support.plex.tv/articles/216766168-accessing-a-server-through-relay/
**Relay**: a vendor-run tunnel used when a client cannot reach the server directly. The server
opens an outbound secure connection to a relay host and the client connects to the same host;
end-to-end encrypted, "The connection is not terminated on our servers and only your Plex Media
Server has the certificate."
- Rule, verbatim: "Connections are limited to 2 Mbps maximum for streams"; downloads cannot use
  Relay; Relay requires Secure connections set to Preferred or Required.
- Rule, verbatim: "Relay is enabled by default so you will be able to have some remote access."
- **REFUSED by implication**: a relay requires a vendor-run service, and CanonCore explicitly has
  no cross-instance infrastructure ("No fork, no export, no import, no cross-instance sharing").
- **ABSENT**: remote access at all (port forwarding, UPnP, reverse proxy, Tailscale/WireGuard
  guidance). Same MEDIUM gap as 004. The right CanonCore answer is almost certainly *documentation*
  (as with rclone/mergerfs for storage) rather than a feature, which is a decision worth writing
  down explicitly so nobody builds a relay. Need: **MEDIUM**. (See GAPS.)

### 029 https://support.plex.tv/articles/216955788-logging-for-smart-tvs-tivo/
Client logging again, with two extra ideas: an **on-screen console log overlay** for when no server
is reachable, and an explicit **logging level** setting.
- Rule, verbatim: "leave the Logging Level setting at the default of Debug, unless specifically
  requested otherwise"; and "The logging can be pretty active, so we we recommend you only enable
  it when reproducing an issue."
- **ABSENT**: log levels, and a toggleable verbose mode. Rolls into the logging gap from 005/014.
  Need: **MEDIUM**.

### 030 https://support.plex.tv/articles/217563477-purchasing-a-plex-pass-subscription-through-google-play/
Google Play billing variant of 003. Monthly / yearly / **lifetime** tiers.
- **REFUSED / out of scope**: no subscription, no billing, no account service.
- Need: **LOW** (n/a).

## Batch 7 — articles 031–035

### 031 https://support.plex.tv/articles/218136308-why-is-there-an-unclaimed-media-server-on-my-network/
**Server claiming**: a freshly installed server is unowned and broadcasts as such; any app on the
LAN offers "An unclaimed media server has been found on your network. Claim it now". Claiming binds
it to an account and unlocks certs and features.
- **HIGHLY RELEVANT and ABSENT**. CanonCore's `owners` table is "ONE row. Single user, one
  password, no signup". The prompt never says **how that one row comes to exist**. There is no
  first-run flow, no initial-password mechanism, and no statement of what an instance does between
  `docker run` and the owner existing. Every self-hosted product has to answer this and getting it
  wrong is a real vulnerability: an unclaimed instance on a LAN is claimable by whoever reaches it
  first, which is precisely the risk Plex's claim-token flow manages. Need: **HIGH**. (See GAPS.)

### 032 https://support.plex.tv/articles/218168838-navigating-plex-for-sonos/
Browsing model for a constrained (voice/speaker) client: pick a library, then browse by artist, by
album, by playlist, Shuffle All, or a **Discover** view of suggestions ("more content from an
artist you played recently, top albums from a particular year, more content in a recent genre, or
even artists that are currently on tour").
- **ABSENT**: **playlists**. This is a distinct concept from CanonCore's containers and the prompt
  never mentions it. Arguably a playlist *is* an ordered container in CanonCore's model — which
  would be an elegant answer — but the prompt does not say so, and a playlist has properties a
  catalogue container does not (ephemeral, personal, shuffled, queue-like). Need: **HIGH**.
  (See GAPS.)
- **ABSENT**: **a play queue** — the ordered list of what plays next, editable during playback.
  Distinct from both a container and Continue Watching. Need: **HIGH**. (See GAPS.)
- **ABSENT**: recommendations / "Discover" / similar-items. Need: **LOW** — discovery surfaces are
  exactly the sort of thing the prompt defers ("No shelf type, no command palette yet").
- **ABSENT**: shuffle / random play. Need: **LOW**.

### 033 https://support.plex.tv/articles/218168898-installing-plex-for-sonos/
Installing a Plex "service" into a third-party ecosystem app (Sonos) and linking accounts.
- **REFUSED / out of scope**: no third-party ecosystem integrations, no OAuth linking.
- Interesting contrast with the prompt's own CLIENTS section, which explicitly weighs implementing
  an **existing client protocol** (OPDS, Subsonic) against writing apps, and chooses apps
  "deliberately. Do not re-argue it." Sonos here is the *server side* of exactly that trade: Plex
  implemented Sonos's music-service contract instead of writing a Sonos app. Need: **LOW**
  (already decided and explicitly closed).

### 034 https://support.plex.tv/articles/218169418-playback/
Sonos playback semantics. Two distinct playback modes with different capabilities.
- Rule, verbatim, on the Radio mode: "You can't open the Queue or view upcoming tracks / It is not
  possible to go back to a previous item / You can't seek within a track during playback."
- **ABSENT**: the **queue as a first-class object** with its own capability set (view, jump, go
  back, seek). Reinforces 032. Need: **HIGH**.
- **ABSENT**: remote control of one client from another ("Plex Pass subscribers can use a regular
  Plex app to control Sonos"). Need: **LOW**.

### 035 https://support.plex.tv/articles/218171737-purchasing-a-plex-pass-subscription-through-amazon/
Amazon Appstore billing variant of 003/030. Lifetime tier gated on app version 6.6+.
- **REFUSED / out of scope**. Need: **LOW** (n/a).
- The only transferable line is a versioning one: a feature is documented as available "as of
  version 6.6 of Plex for Android", i.e. **per-client minimum-version gating**. CanonCore's
  server and three clients will version independently. **ABSENT**: any API versioning or
  client-compatibility statement. The prompt's "Do not preserve backward compatibility. Remove
  obsolete paths" is a repo-internal rule and cannot hold across a shipped TV app the owner has
  not updated. Need: **MEDIUM**. (See GAPS.)

## Batch 8 — articles 036–040

*(Resumed 2026-09-06 by a second agent. Fetch method changed: plain `curl` direct to
support.plex.tv — the earlier 403s were a network-level DNS block, not Plex. No proxy.)*

### 036 https://support.plex.tv/articles/218237558-requirements-for-using-plex-for-sonos/
Preconditions for a third-party integration to reach the server: minimum server version, Remote
Access enabled (or Relay as fallback), and **NAT Loopback** on the router.
- Rule, verbatim: "You need to be running Plex Media Server version 1.10.0 or newer to use the
  Plex service for Sonos."
- Rule, verbatim: "Your network router must support 'NAT Loopback' … if a device on your network
  (such as a Sonos) makes a network call to your public WAN address, the router knows how to
  handle that without the network request needing to actually go 'out over the internet'".
- **ABSENT**: a **minimum-server-version handshake** between a client/integration and the server.
  Rolls into the API-versioning gap from 035. Need: **MEDIUM**.
- **ABSENT**: the hairpin/split-horizon problem — a LAN client given a WAN address. Only bites once
  remote access exists, which the prompt does not have. Need: **LOW**.

### 037 https://support.plex.tv/articles/218294587-logging-for-playstation/
Third client-logging article (cf. 005, 014, 029). Same two knobs: `Advanced > Logging Level = Debug`
and `Privacy > Log to Media Server`.
- Rule, verbatim: "The logging can be pretty verbose, so we don't generally encourage leaving it
  enabled all the time. Instead, you should normally use it when reproducing an issue."
- Note the placement: **client log shipping sits under Privacy**, not under Advanced. That is a
  deliberate classification — shipping your logs somewhere is a privacy decision, not a debug one.
- **ABSENT**: same logging gap (005/014/029). The privacy framing is the new detail. Need: **MEDIUM**.

### 038 https://support.plex.tv/articles/218697747-can-i-use-the-in-app-purchase-with-family-sharing/
Apple Family Sharing applied to the one-time app-unlock IAP.
- **REFUSED / out of scope**: no licensing, no IAP, no account service. Need: **LOW** (n/a).
- One transferable line: "This article only applies to Plex for iOS version 8.45 and below" — a
  support doc **scoped to a version range**. CanonCore has no doc-versioning notion either, but
  self-hosted software where the user chooses when to update needs one. Rolls into 035. Need: **LOW**.

### 039 https://support.plex.tv/articles/219867627-purchasing-a-plex-pass-subscription-through-the-roku-app/
Roku billing variant of 003/030/035. Monthly only on this channel.
- **REFUSED / out of scope**. Need: **LOW** (n/a).

### 040 https://support.plex.tv/articles/220347688-accessing-shield-storage/
Where the server's own data directory lives on a fixed-appliance host, and how the operator reaches
it (enable SMB on the device, then `smb://IP`). Named locations: `/Plex Media Server/Logs`,
`/Plex Media Server/Logs/PMS Plugin Logs`.
- **ABSENT**: **the server data directory as a named, documented, relocatable thing**. CanonCore
  will have a Postgres database, a read projection, artwork the palette extractor fetched, and file
  hashes. The prompt never says where any of that lives on disk, whether it is one directory, or
  how an operator backs it up. Need: **HIGH** — for self-hosted software "what do I back up, and
  what do I copy to move to a new machine" is a first-class question, and the prompt's `docker run`
  shape (unstated, per 025) makes it worse. (See GAPS.)
- Reinforces the logging gap: logs are a *directory the operator opens*, not an in-app view.

## Batch 9 — articles 041–045

### 041 https://support.plex.tv/articles/220391808-media-storage-options-for-nvidia-shield/
Storage topology for an appliance server: internal, USB/microSD, SMB network share. Documents
supported filesystems (exFAT, HFS+, NTFS), a **writable-subtree restriction**, and an anti-recipe.
- Rule, verbatim: "a new NVIDIA_SHIELD folder is automatically created on the drive … Only content
  in that folder (and its sub-folders) will be writable. All other content on the drive will still
  be read-only."
- Rule, verbatim: "it is advised that SMB Opportunistic Locking (oplock) is not enabled on the SMB
  mounted drives commonly found on NAS systems. The use of Opportunistic Locking has been seen to
  give rise to issues such as delayed start of playback".
- **ADOPTED**: "Build against a FILESYSTEM PATH" plus documenting rclone/mergerfs is exactly this
  article's posture — mount it yourself, we read a path. Plex reaches the same answer.
- **ABSENT**: **network-mount gotchas as shipped documentation** (oplock, SMB vs NFS, permissions,
  case sensitivity). The prompt commits to documenting rclone and mergerfs but names no failure
  modes. Need: **MEDIUM** — the prompt already knows change notifications do not fire over network
  mounts, and this is the same family of problem one layer down.
- **ABSENT**: **read-only vs writable roots**. CanonCore's scanner "NEVER writes storage", which
  means every scanner root can be mounted read-only — a genuinely strong security property that
  the prompt states as a rule but never converts into an operational guarantee ("mount your media
  ro"). Need: **MEDIUM**, and it is nearly free. (See GAPS.)

### 042 https://support.plex.tv/articles/221099648-limitations-when-running-plex-media-server-on-nvidia-shield/
Capacity and disk-space limits of a constrained server host. Transcoding numbers are refused, but
three non-transcoding facts are relevant.
- Rule, verbatim: "space is needed to store information such as the database, metadata about library
  items, posters and background art for the content, and more. The amount of space required can
  vary dramatically based both on how many items you have in your media libraries as well as what
  options you turn on".
- Rule, verbatim, on a derived-artefact feature: "enabling the Video Preview Thumbnails feature can
  give you a richer experience in your apps, but the files that get generated for it can potentially
  require significant amounts of space".
- Rule, verbatim, on distribution: "you can't arbitrarily update the server version … it is not
  possible to downgrade server versions."
- **ABSENT**: **artwork caching and its disk cost.** This one is concrete and unresolved in the
  prompt. Artwork is "Provider-supplied URL" and the palette is "extracted when the artwork is
  fetched" — so CanonCore *does* fetch images. It never says whether the bytes are kept. If not
  kept, every page load hot-links a third-party CDN (bad for TMDB's terms and for a demo instance);
  if kept, there is an unbounded on-disk image cache the prompt has not budgeted, sized, or given
  an eviction rule. Need: **HIGH**. (See GAPS.)
- **ABSENT**: **a downgrade / rollback statement.** The prompt commits to a forward-applicable
  migration ladder, which by construction makes downgrade impossible, but never says so out loud.
  Plex says it plainly. Need: **MEDIUM** — the operator needs to be told before they try. (See GAPS.)
- **ABSENT**: any statement of what CanonCore *costs* to run (disk per 10k items, memory). Need:
  **LOW** at this stage.

### 043 https://support.plex.tv/articles/221099988-setting-up-and-managing-plex-media-server-on-nvidia-shield/
**First-run setup flow**, in full. This is the concrete version of the gap article 031 opened.
The sequence: server detected → operator opts in to running it → **prompted whether to create a
set of default libraries** → OS storage permission requested with an explicit reason → setup runs
("can take up to a few minutes") → confirmation page → manage from the web app thereafter.
Default library roots are named up front (`/Movies`, `/Music`, `/TV Shows`, `/Home Videos`,
`/Pictures`) and the doc tells you to put content there *before* setup if you want it found.
- Rule, verbatim: "Don't worry if your content isn't ready yet! You can always add the content
  later or edit your libraries." — i.e. **first run must complete with an empty library**.
- **ABSENT**: CanonCore's first-run experience. The prompt guarantees "A fresh install by anyone
  else starts EMPTY, with no content of any kind" but says nothing about what the operator sees at
  that moment. With no providers enabled by default (tier 1: "ALL DISABLED BY DEFAULT"), no seed
  data, no artwork, and no scanner root, a fresh CanonCore is an empty page. Every decision in the
  prompt is individually right and together they produce the worst possible first five minutes.
  Need: **HIGH**. (See GAPS.)
- **ABSENT**: two more addresses for the web UI — hosted (`plex.tv/web`) vs bundled
  (`http://ip:32400/web`). Same deployment-shape gap as 025.

### 044 https://support.plex.tv/articles/221104248-western-digital-my-passport-wireless-pro/
A **deliberately non-transcoding server appliance** — the closest thing in Plex's docs to
CanonCore's direct-play-only posture, and it is instructive that Plex treats it as a limitation
requiring a documented workaround rather than a design.
- Rule, verbatim: "The My Passport Wireless Pro does not support transcoding of video. To get the
  most out of it, you will want to use media that has already been optimized and can be Direct
  Played by the Plex apps you'll be using for playback."
- Rule, verbatim, and directly load-bearing for CanonCore: "Image-based subtitles (PGS or VOBSUB)
  will not work because they will usually require video transcoding. / Text-based subtitles (SRT,
  tx3g, etc.) will work for many apps. … even for text-based subtitles, not all Plex apps will
  always be able to play them without transcoding."
- **ADOPTED / DIVERGENT**: CanonCore is direct-play-only by choice. But this article is the
  evidence that **subtitles are where direct-play-only actually breaks**, not video codecs. The
  prompt's own client reasoning already names "no PGS subtitles" as a reason expo-video fails, so
  it knows this — and then the `files` role vocabulary carries `subtitle` with no format field and
  no playability statement. Need: **HIGH** as part of the stream-metadata gap opened at 023.
- **ABSENT**: an offline / no-internet operating mode. Rule, verbatim: internet is needed "When you
  add content to your library, as the server gathers metadata for your media". CanonCore's
  equivalent — an instance with no providers connected — is explicitly contemplated ("A private
  instance with no provider connected has no artwork") but never described as a supported mode with
  its own expectations. Need: **MEDIUM**. (See GAPS.)

### 045 https://support.plex.tv/articles/221755547-changelogs-and-release-notes/
Two sentences: changelogs live in the support forum, one topic per product, appended per release.
- **ABSENT**: release notes / changelog / "what changed in this version" as a product artefact.
  For self-hosted software the operator decides when to update, so the changelog is the entire
  basis for that decision. The prompt's "Do not preserve backward compatibility. Remove obsolete
  paths" makes a changelog more necessary, not less. Need: **MEDIUM**. (See GAPS.)
- Note the shape Plex chose: changelogs are **not in the app** and not in the repo — they are forum
  posts. That is a cheap answer CanonCore could copy (GitHub Releases).

## Batch 10 — articles 046–050

*(Articles 046–052 are the DVR/Live-TV cluster. The subject matter is comprehensively out of
scope — CanonCore never records, never stores media, has no tuner and no broadcast. Recorded
below only for the transferable mechanisms, of which there are several genuinely good ones.)*

### 046 https://support.plex.tv/articles/225877347-live-tv-dvr/
DVR setup and settings. Four transferable mechanisms.
- **(a) A device-discovery-then-manual-fallback wizard.** Verbatim: "your server will automatically
  search the network to try and find any compatible devices … If your DVR device isn't automatically
  detected, you can click the link to allow you to manually specify the device's location."
- **(b) A user-supplied executable hook, sandboxed by directory.** Verbatim: "Postprocessing Script
  … Beginning with Plex Media Server v1.19.3, the script must be located inside the /Scripts
  subdirectory of the main server data directory."
- **(c) A periodic refresh toggle** — "Perform refresh of program guide data: Have the server
  periodically refresh guide data", with a manual "Refresh Guide" alongside it.
- **(d) A setting whose blast radius exceeds its name**, flagged in the doc itself. Verbatim:
  "Replace lower resolution items … Be aware that enabling this can replace any item in your
  library, not just previous DVR recordings."
- **REFUSED**: DVR, tuners, EPG, commercial detection, transcoder quality.
- **REFUSED, correctly and by implication**: (b). CanonCore's whole provider posture is "not a
  plugin, not a repo, and never code running inside the app". Plex's `/Scripts` hook is exactly the
  thing that posture rejects, and this article is evidence for it — Plex had to add a directory
  constraint to a hook that shipped without one.
- **ABSENT**: (c) again — **scheduled background refresh with a manual override**. Third
  independent sighting (024, 046, and the guide-refresh setting here). CanonCore's six-month TMDB
  cache rule makes this mandatory and there is no scheduler in the prompt. Need: **HIGH**.
- **ABSENT**: (d) as a *convention* — naming, in the UI, when a setting's effect is wider than the
  screen it sits on. The prompt has one obvious candidate: re-ordering the source list "re-picks
  the whole catalogue at once". Need: **MEDIUM** — the prompt states the behaviour and never says
  the owner is warned before doing it. (See GAPS.)

### 047 https://support.plex.tv/articles/225877387-program-guide/
Browsing a large time-ordered corpus. Three surfaces over one dataset: a **Grid** (channel × time
scroll), a **Recommended** page of named rows, and **search**.
- Rule, verbatim, on search scope: "Even if you're somewhere else in the app and search, the full
  results will also contain Guide items." — one search box, results spanning corpora.
- Rule, verbatim, on customisation: "Mark any channel as a 'favorite' and then view those favorites
  all in a single, consolidated location / Re-order the favorites however you want / Enable or
  disable a live TV source (if you have more than one …) to appear in the guide".
- **ABSENT**: **pinning / favouriting a container for quick access, and hand-ordering the pins**.
  CanonCore has `rank` as a favourite *on a statement value* and nothing that favourites an item or
  a container. For a catalogue where 93.4% of stories sit in a median of 4 containers, "the six
  orderings I actually use" is the primary navigation problem. Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: **enable/disable a source's contribution to a surface** without disconnecting it.
  CanonCore's group-chooses-its-providers is close but coarser (connect or do not). Need: **LOW**.
- **ADOPTED, adjacent**: the Recommended page is a set of named rule-derived rows over one corpus,
  which is what CanonCore's rule-derived containers are. The prompt defers the shelf question
  explicitly ("No shelf type … decided when screens exist"), so this is scoped out, not missed.

### 048 https://support.plex.tv/articles/225877427-supported-dvr-tuners-and-antennas/
A published **hardware compatibility matrix** — device × OS × region, maintained in support docs.
- Rule, verbatim: "When connecting a tuner device to your Plex Media Server, the server expects
  that it will have exclusive access to the tuner. That means that if you use other programs or
  devices to access the tuner, you may experience unexpected behavior".
- **REFUSED / n/a**: no hardware. Need: **LOW**.
- The transferable idea is the same as 008: a **maintained compatibility matrix outside the code**.
  CanonCore's version of it is a *client codec matrix*, which is exactly the HIGH gap opened at 023
  — direct-play-only means "which of my files will play on my Apple TV" is a question the product
  must answer, and Plex answers the analogous question with a published table. Need: **HIGH**
  (already counted under 023).
- **ABSENT**: exclusive access / locking on a shared external resource. CanonCore's nearest analogue
  is two enrichment runs hitting one rate-limited provider at once. Need: **LOW**.

### 049 https://support.plex.tv/articles/225976308-manage-your-recordings/
**Contention resolution by a hand-ordered global priority list.** The best mechanism in this cluster
and structurally identical to something CanonCore already has.
- Rule, verbatim: "items that are higher in the Recording Priority list will take precedence over
  lower items when it comes to what will be recorded."
- Rule, verbatim, on the resolution dialog: "Cancel This – Choose not to schedule the recording at
  all. / Prefer This – Choose to prefer this recording, which moves it to the top of the Recording
  Priority list."
- Two views over the same schedule (Calendar and Agenda), explicitly identical in content.
- **ADOPTED, strongly**: this is the same shape as CanonCore's **source order** — one global,
  hand-ordered, drag-reorderable list that settles every conflict without a per-conflict decision,
  plus a per-conflict escape hatch that *edits the global list* rather than storing an exception.
  "Prefer This" moving the item to the top of the global list, rather than recording a local
  override, is precisely the prompt's "Nothing is stored per field until the owner cares" instinct.
  Independent convergence on the prompt's design; worth knowing it has a precedent.
- **ABSENT**: **conflict as a first-class, surfaced, resolvable object.** Plex shows a `!` badge on
  the affected row, a dialog naming exactly what it collides with, and two one-click resolutions.
  CanonCore's review queue is the analogous surface but the prompt only ever describes it holding
  *match* uncertainty. It says nothing about surfacing the other conflicts the model guarantees:
  two providers disagreeing on a single-cardinality field, a placement gone stale after a container
  was re-derived ("the resulting staleness is a curation fact for the review queue"), a property
  tightened with existing offenders, or a quarantined vocabulary value. Need: **HIGH** — the prompt
  names all four of those consequences and never says where the owner sees them. (See GAPS.)

### 050 https://support.plex.tv/articles/226074728-setting-up-recordings/
Per-subscription recording options. The important half is **retention**: automatic deletion driven
by progress state.
- Rule, verbatim: "Keep: Set the maximum number of unwatched episodes to keep for the show.
  Available options: All episodes / 5 episodes / 3 episodes / 1 episode / Episodes from the past 3
  days / Episodes from the past 7 days / Episodes from the past 30 days".
- Rule, verbatim: "Delete Episodes After Watching … Never / After a day / After a week … episodes
  will automatically be deleted X number of days after the server admin account has watched them."
- Rule, verbatim, and a genuine design warning: "This is based on the server admin account. If this
  value is set and the server admin watches an episode, it will be deleted after X days even if a
  shared user has not watched it."
- Rule, verbatim, on scheduled work: "Ensure the computer / NAS the Plex Media Server runs on does
  not sleep / hibernate … Plex Media Server will not bring the system out of sleep to start a
  scheduled recording."
- **REFUSED**: retention rules on media files. CanonCore never stores media and never deletes files
  (or does it — see the unresolved question at 020).
- **ABSENT**: **a stated non-guarantee about scheduled work on a host that sleeps.** The prompt
  commits to "Support explicit periodic scans" and to a six-month cache rule that implies scheduled
  refresh, and says nothing about what happens when the machine was asleep at the appointed time —
  skip, catch up, or run once on wake. Every scheduler has to answer this. Need: **MEDIUM**.
  (See GAPS.)
- **ABSENT**: **any rule-driven mutation of the catalogue at all.** Every write in the prompt is
  either an import, an enrichment application against a threshold, or a hand action. There is no
  concept of a standing rule the owner sets that changes data later. Rule-derived containers are
  read-side only. This is probably correct and deliberate, but the prompt never says so, and
  "single-user, one owner, no automation" is worth writing down as a decision so nobody adds a
  rules engine. Need: **MEDIUM**. (See GAPS.)

## Batch 11 — articles 051–055

### 051 https://support.plex.tv/articles/226117668-plex-media-server-resource-management/
**404 — article retired.** Second dead URL in the shard (after 015). The page's own upsell footer
still names it: "Plex Media Server Resource Management is a premium feature and requires a Plex
Pass subscription."
- Title indicates it covered **capping what the server is allowed to consume** (CPU/scheduling for
  background work).
- **ABSENT**: any resource budget for CanonCore's background work. The prompt has a scanner that
  hashes 128KB per file across a 373,513-page archive, a wholesale projection rebuild, palette
  extraction on every fetched image, and rate-limited provider calls — and no statement anywhere
  about concurrency limits, throttling, or nice-ness. Need: **MEDIUM** — a background job that
  saturates the box is how self-hosted software gets uninstalled. (See GAPS.)

### 052 https://support.plex.tv/articles/226463767-frequently-asked-questions-dvr-live-tv/
DVR FAQ. Mostly refused subject matter; four transferable lines.
- Rule, verbatim, on scheduling cadence: "Your Plex Media Server will refresh program guide data
  daily as part of the Scheduled Tasks maintenance period." — a **named maintenance window** that
  every periodic job hangs off, rather than each feature owning its own timer.
- Rule, verbatim, restating 050: "Plex Media Server would not bring the system out of sleep to
  start a scheduled recording."
- Rule, verbatim, on unsupported-but-workable inputs: "Even if we don't have official support for a
  tuner, you may still be able to use it with Plex. You can choose to try an 'unsupported tuner'."
- Rule, verbatim, on user-supplied data where the vendor's own is unavailable: "For countries that
  we don't officially support … users can provide their own XMLTV guide data."
- **ABSENT**: **a single named maintenance window** that all periodic work runs in. This is the
  concrete shape of the scheduler gap (024/046) and it is a better answer than per-feature timers:
  one window, one setting, one place the operator looks. Need: **HIGH** (counted with the scheduler
  gap). (See GAPS.)
- **ADOPTED, adjacent**: "try an unsupported tuner" and "supply your own XMLTV" are exactly the
  posture of CanonCore's provider tiers — bundled/curated/private, with tier 3 being "any URL added
  directly, bypassing the store". Independent convergence.
- **ABSENT**: a *supported-versus-unsupported* label on a connected provider, so the owner knows
  which of their four providers CanonCore stands behind. Need: **LOW**.

### 053 https://support.plex.tv/articles/226836308-help/
**Settings > Troubleshooting**: the operator's self-service maintenance panel. Four buttons, and
this is the single most directly transferable article in the shard so far.
- **Optimize Database.** Verbatim: "cleans up the server database from unused or fragmented data.
  For example, if you have deleted or added an entire library or many items in a library, you may
  like to optimize the database. Confirmation is given once the optimization … is complete."
- **Clean Bundles.** Verbatim: "Poster images and other metadata for items in your library are kept
  in 'bundle' packages. When you remove items from your library, these bundles aren't immediately
  removed. Removing these old bundles can reduce the size of your install … By default, your server
  will automatically clean up old bundles once a week as part of Scheduled Tasks."
- **Download Logs.** Verbatim: "have the server generate a zip file for your browser to download,
  which contains: Core server logs / Scanner logs / DLNA logs / Default metadata agent logs / Plex
  system framework logs", with an explicit statement of what it does *not* contain.
- **Download Database.** Verbatim: "your Plex Media Server will zip up the current server database
  for your browser to download … this process may take a little while … Tip!: In most cases, a
  database is not needed when investigating an issue, so you should only provide one when
  specifically requested."
- **ABSENT**: **a diagnostics/maintenance surface of any kind.** This closes the logging gap
  (005/014/029/037/040) into something concrete and buildable: one settings page with a
  download-logs button that produces one shareable zip. Need: **HIGH**, upgraded from MEDIUM.
  (See GAPS.)
- **ABSENT**: **orphaned-artefact cleanup.** "Clean Bundles" exists because Plex's deletes leave
  derived files behind. CanonCore's DELETE section is careful about catalogue rows and silent about
  everything derived from them — the read projection, the artwork rows and any cached image bytes,
  the ancestor closure, statements whose subject placement was removed. Need: **HIGH**. (See GAPS.)
- **ABSENT**: **backup and restore.** The Download Database button plus the linked "Restore a
  Database Backed Up via Scheduled Tasks" is a scheduled DB backup with a documented restore path.
  CanonCore has no backup story at all, and it holds the only copy of every hand-made placement,
  every owner statement and every rank the owner set — none of which is re-derivable from any
  provider. Need: **HIGH**. (See GAPS.)

### 054 https://support.plex.tv/articles/227341367-windows-key-not-valid-for-use-in-specified-state-error-and-transcoding-analysis-issues/
Windows crypto-keystore corruption breaking the transcoder and **media analysis**.
- Rule, verbatim, on how the user identifies their own bug: "look inside your Plex Media Server.log
  or Plex Media Scanner Analysis.log files and then search for 'Key not valid for use in specified
  state'".
- **REFUSED / n/a**: transcoding, Windows.
- Two things worth noting. First, a symptom listed verbatim: "Media analysis fails and you don't
  see media format information on item details/preplay screens" — confirming **media analysis is a
  separate pass from scanning**, with its own log file, that populates the stream metadata a
  preplay screen shows. That is the 023 gap named as a pipeline stage: scan (identity/path) then
  analyse (codec/resolution/duration). CanonCore's scanner produces a hash, a path and a role and
  there is no analysis stage at all. Need: **HIGH** (counted with 023).
- Second, the support pattern: **the user is told to grep their own log for a specific string**.
  That only works because the log exists, is findable, and has stable messages. Need: **MEDIUM**
  (counted with the logging gap).

### 055 https://support.plex.tv/articles/227555787-why-does-itunes-launch-when-plex-media-server-is-started/
An integration reading a **third-party application's local library file** (`iTunes Music Library.xml`)
at startup, with a configurable path setting for non-default installs, and a side effect (launching
iTunes) when the file is unreadable.
- Rule, verbatim: "you only need to set a value for the preference if your iTunes installation is
  not in the default location."
- **DIVERGENT / REFUSED**: CanonCore's only metadata inputs are providers-over-HTTP and the
  scanner's media files. Reading another local application's database is neither, and the prompt's
  "no `.nfo` reading" rule points the same way.
- **ABSENT**: **importing an existing catalogue from another tool.** The prompt refuses import
  between CanonCore instances ("No fork, no export, no import, no cross-instance sharing"), which
  is a different question from importing *from Plex/Jellyfin/Calibre*. Given the product's pitch is
  "every existing tool makes you pick one", the realistic user already has a library in one of
  those. Need: **MEDIUM** — probably still the right refusal, but the prompt has not made it,
  and the sentence that looks like it does is about a different thing. (See GAPS.)
- **ADOPTED, adjacent**: "a setting you only touch when the default is wrong" is the right default
  posture and matches the prompt's general minimalism.

## Batch 12 — articles 056–060

### 056 https://support.plex.tv/articles/227715247-server-settings-bandwidth-and-transcoding-limits/
Resource limits. The transcoding half is refused; the **Deep Analysis** half is the important part
and it is the clearest statement anywhere in this shard of a gap CanonCore has.
- Rule, verbatim: "your Plex Media Server will perform a 'Deep Analysis' on files. This goes through
  the file and maps all those spikes and valleys in the bitrate throughout the video to get a much
  more complete picture of what goes on."
- Rule, verbatim: "This 'Deep Analysis' for files is automatically performed by your server as part
  of the regular nightly maintenance period."
- Rule, verbatim, and this is the pattern worth stealing: "If the deep analysis for a file hasn't
  yet been performed, your Plex Media Server will assume a [2 x average bitrate] value if it's
  needed for streaming limitation calculations." — **a derived value has a documented, explicitly
  conservative fallback for the window before it is computed.**
- Rule, verbatim, on headroom: "The Plex Media Server is smart enough to prevent saturating the
  bandwidth value specified here. It will only use 80% of this for streams".
- **REFUSED**: transcode limits, bitrate ladders, remote quality caps.
- **ABSENT**: **a per-file analysis pass distinct from the scan, and a stated fallback while it has
  not run.** CanonCore's scanner computes an identity hash and stores a path and a role. Nothing
  computes duration — and duration is load-bearing three times over in the prompt: completion is
  "TIME REMAINING under a small absolute figure", force-complete is "anything under five minutes",
  and the percentage fallback exists "only where duration is unknown". The prompt names the
  unknown-duration case and never says where duration comes from. Need: **HIGH**. (See GAPS.)
- **ABSENT**: the deliberate-headroom idea (use 80% of what you are allowed) for any bounded
  resource — provider rate limits especially. Need: **LOW**.

### 057 https://support.plex.tv/articles/230934267-netgear-nighthawk-x10-router/
Server on a router appliance. Mostly hardware-specific, three transferable lines.
- Rule, verbatim: "there is a Enable Automatic Plex Version Update checkbox … the device will
  perform automatic polls to plex.tv for a new version. Note!: This feature is gated by Netgear so
  a new public version will not appear until they have approved the release".
- Rule, verbatim: "All Plex Media Server data is stored on the connected USB drive … Warning!: Do
  not remove the connected USB drive unless Plex Media Server is shut down".
- Rule, verbatim, repeating 044 almost word for word: "Image-based subtitles (PGS or VOBSUB) may
  have trouble … Text-based subtitles (SRT, tx3g, etc.) will work for many apps."
- **ABSENT**: **update checking / notification.** Self-hosted software that never tells the operator
  a version exists is software that stays on the version it was installed at. Rolls into the
  distribution gap (025/043/058). Need: **MEDIUM**.
- Third independent sighting of the subtitle-format playability problem (044, 057, and the prompt's
  own client reasoning). Counted under 023.

### 058 https://support.plex.tv/articles/235974187-enable-repository-updating-for-supported-linux-server-distributions/
**Distribution, concretely.** Signed apt and rpm repositories, published key fingerprints, a
one-line installer, and a documented migration off the old repo. This is the answer to the
deployment-shape gap that 025 and 043 opened.
- Rule, verbatim: "Public key: 6EFFEB478A6559D75C7C4FE706C521790B9CFFDE / Signing subkey:
  B406F0897A39A570804260540A05F1E6E7AFD573", with `gpg --show-keys --with-subkey-fingerprints` given
  so the user can verify them independently.
- Rule, verbatim, on the key choice: "We chose Ed25519 for the new key because it offers equivalent
  or stronger practical security than RSA-4096 with significantly better performance … a 256-bit
  Ed25519 key provides security comparable to a 3072–4096-bit RSA key".
- The easy path is `curl -LsSf https://repo.plex.tv/scripts/setupRepo.sh | sudo bash`; the manual
  path is spelled out for people who will not pipe a script to root.
- Rule, verbatim, on scope: "Repository updating is currently only supported for public releases of
  Plex Media Server. It is not currently possible to use it for Plex Pass preview/beta releases."
- **ABSENT**: **how anyone installs CanonCore, and how they get updates.** The prompt is extremely
  precise about the monorepo, the scaffold tool, the five defects to fix on day one and the pnpm
  catalog — and says nothing about the artefact a user runs. There is no container image, no
  release channel, no signature, no update path. "SELF-HOSTED software" is the product's first
  sentence about itself. Need: **HIGH**. (See GAPS.)
- Worth copying regardless of mechanism: **publish the signing key fingerprint in the docs, and
  offer both the one-liner and the manual steps.** The two-path pattern costs nothing and is what
  makes a `curl | sudo bash` acceptable.

### 059 https://support.plex.tv/articles/account-requires-password-reset/
Password reset on a central account, plus how devices re-authenticate afterwards.
- Rule, verbatim, on reset-token invalidation: "only the reset link in the most recent reset email
  we send will work … Requesting a new reset will invalidate all previous ones."
- Rule, verbatim, on session revocation: "You can optionally enable the Sign out connected devices
  after password change checkbox … That helps secure the Plex account by signing all your player
  apps and any Plex Media Server you own out."
- Rule, verbatim, and this is the genuinely valuable one: "Our big screen apps (such as Android TV,
  Apple TV, smart TVs, etc.) generally allow you to connect the app to your account by way of a
  **4-character link code**. This allows you to connect to your account without having to
  laboriously enter login credentials via an on-screen keyboard".
- **REFUSED / mostly out of scope**: no account service, no email, no password-reset email flow.
  CanonCore has "one password, no signup" and a single owner row.
- **ABSENT, and it matters**: **how the committed native TV client authenticates.** The prompt's
  auth is "a single-password cookie session", which is a browser mechanism. Typing a password on a
  tvOS on-screen keyboard with a Siri Remote is exactly the problem Plex's link code solves. This
  is the concrete, cheap answer to the token gap opened at 007: the TV app shows a short code, the
  owner enters it in the web app, the TV gets a long-lived token. Need: **HIGH**, and the design
  is already known so it is cheap to decide now. (See GAPS.)
- **ABSENT**: **session revocation** — "sign out all devices". With one password and no signup, the
  owner's only remedy after a lost tablet is changing the password, and the prompt does not say
  whether that invalidates existing sessions. Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: password reset / recovery at all. For a self-hosted single-password instance the
  answer is almost certainly a CLI command on the host, which is fine — but it has to exist and be
  documented, or a forgotten password is an unrecoverable install. Need: **MEDIUM**. (See GAPS.)

### 060 https://support.plex.tv/articles/activity-feed/
A social activity feed. Overwhelmingly refused subject matter — friends, sharing, comments,
reactions, reporting, mute and block are all multi-user features and CanonCore is single-user with
no cross-instance anything. Three mechanisms transfer anyway, all about **the shape of the watch
event log**, which CanonCore does have.
- Rule, verbatim, on collapsing rapid repeats: "If the same action is taken within 10 minutes of
  each other the more recent will replace the first."
- Rule, verbatim, on merging different event types: "When marking as watched and rating activities
  happen within a 12 hour period, they will be combined into a single activity card."
- Rule, verbatim, on grouping: "Watching multiple episodes of the same show within a short period
  … will have a card with all the episodes. It will display the episode number of the last one
  watched and a count of how many other episodes." (a "Binge" event)
- Rule, verbatim, on retroactive correction: "Edit the watched date on Watch activities, if it
  happened on a different day than it was marked."
- **REFUSED**: the feed, friends, sharing, notifications, reporting.
- **ABSENT**: **anything that reads the watch event log.** This is a sharp one. The prompt commits
  to append-only watch events and justifies them precisely because "The event log is what makes
  re-watches real" — and then the only reader named anywhere is the maintained state row and
  Continue Watching. There is no history view, no "when did I last watch this", no re-watch count
  surfaced, no per-item timeline. The product pays the full cost of event sourcing and spends none
  of it. Need: **HIGH**. (See GAPS.)
- **ABSENT**: **correcting or deleting a watch event.** An append-only log plus a real user means
  "I marked the wrong episode watched" and "this play was my flatmate" need an answer, and under
  append-only the answer is a compensating event rather than a delete — which is a decision to
  make, not an omission to leave. Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: event **collapsing/debounce windows**. The prompt says "Save every 10 seconds", so a
  two-hour film writes 720 progress writes. Whether those are 720 events in the append-only log or
  one event with a moving position is unspecified, and it is the difference between a log that
  grows at 360 rows/hour/viewer and one that grows at 1. Need: **HIGH** — this is a storage-model
  question the prompt's own numbers force. (See GAPS.)

## Batch 13 — articles 061–065

### 061 https://support.plex.tv/articles/advanced-setting-plex-tv-series-agent/
**The TV metadata agent's settings list.** Densest article in the shard for CanonCore's enrichment
design, and it contains the direct confirmation of one of the prompt's four founding claims.
- Rule, verbatim, and this is claim 2 of "WHY THIS DOES NOT ALREADY EXIST" in Plex's own words:
  "**Episode Ordering**: How episodes are named/numbered on disk. If your naming follows The
  MovieDB or TheTVDB choose that here." — one setting, per library, for the whole library's
  ordering. The prompt's "Plex's episode ordering is ONE GLOBAL SETTING PER LIBRARY" is exact.
  **ADOPTED / confirmed.**
- Rule, verbatim: "**Visibility**: Restrict where content from this library should appear. Include
  in global search / Exclude in global search".
- Rule, verbatim: "**Prefer local metadata**: When scanning this library, prefer embedded tags and
  local files if present." and "**Use local assets**: … use local posters and artwork if present.
  (Local subtitles files will be used whether this is enabled or not.)"
- Rule, verbatim: "**Seasons**: Choose whether to display seasons. Show / Hide for single-season
  series / Hide".
- Rule, verbatim: "**Certification Country**: This will influence which content rating system is
  used. Changing this setting will require refreshing the metadata for new information to be
  reflected on items."
- Also: Collections display mode (Disabled / Hide items which are in collections / Show collections
  and their items); Episode Sorting (Oldest/Newest first); intro, credits, ad and voice-activity
  detection, all Plex Pass and all requiring a matching server-level setting.
- **REFUSED, correctly**: Visibility (prompt: "No visibility system. Not a column, not propagation,
  not a resolution rule"); embedded tags and local artwork ("no artwork scanning, no `.nfo`
  reading"); intro/credits/ad detection (requires decoding, and there is no ffmpeg).
- **DIVERGENT, and better**: Episode Ordering. CanonCore's whole answer is that ordering lives on
  the placement and a work sits in as many orderings as you build.
- **ABSENT**: **language / locale for metadata.** "Prefer artwork based on library language", "Use
  original titles", "library language setting", "Localized subtitles" — Plex has four settings here
  and CanonCore's prompt does not contain the word. This is a real hole in a design whose central
  feature is multi-valued fields: TMDB will return a title in each of thirty languages, and under
  "A field can hold SEVERAL VALUES AT ONCE" they are all live, all visible, and all competing for
  one favourite, with the source order unable to separate them because they came from one source.
  Language is the obvious `statement_qualifiers` use and the prompt never says so. Need: **HIGH**.
  (See GAPS.)
- **ABSENT**: **collapsing a degenerate hierarchy level** ("Hide for single-season series"). Under
  multi-placement, a container with one member that is itself a container is a real and frequent
  shape. Need: **MEDIUM**.
- **ABSENT**: **how a container's members appear in browse** — the three-way Collections setting.
  The prompt has "Also appears in" as one list with a filter, which is the inverse direction; the
  forward direction (does browsing a group show the containers, the items, or both) is unstated.
  Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: **a setting whose change requires a re-fetch to take effect**, stated as such. Same
  family as 046(d). Need: **LOW**.

### 062 https://support.plex.tv/articles/advanced-settings-plex-movie-agent/
The movie agent's settings. Overlaps 061; three settings are new and all three are relevant.
- Rule, verbatim: "**Ratings Source**: Select the rating source for this library (critic/user review
  rating, not content rating). Rotten Tomatoes / IMDb / The Movie Database".
- Rule, verbatim: "**Minimum automatic collection size**: Automatically create collections when
  there are more than the selected number of items for an available collection. Changing this value
  will have no effect on any existing collections. ('Disabled' means there is no minimum.)
  Disabled, 1, 2, 3, 4".
- Rule, verbatim: "**Visibility** … Include in home screen and global search / Exclude from home
  screen / Exclude from home screen and global search".
- **DIVERGENT, deliberately**: Ratings Source is a **per-field source preference**, and the prompt
  refuses exactly this — "A GROUP CHOOSES ITS PROVIDERS; IT DOES NOT RE-RANK THEM. The source order
  is single and global." Plex here does per-library, per-field ranking, which is the thing the
  prompt argues produces "two answers for one field, on one page, reached by one URL". Useful as
  the counter-example the prompt is arguing against; no change needed.
- **ABSENT**: **auto-created containers with a size threshold, and the statement that changing the
  threshold does not retro-apply.** CanonCore has rule-derived containers and never says what
  creates one, whether the product ever creates one unasked, or what happens to existing ones when
  the rule changes. Plex answers all three in one sentence. Need: **MEDIUM**. (See GAPS.)

### 063 https://support.plex.tv/articles/audio-configuration/
Client-side audio device configuration: device selection, device kind (Basic / Optical S-PDIF /
HDMI), channel layout, and per-codec passthrough.
- Rule, verbatim: "**Passthrough Codecs**: Audio streams encoded with certain codecs can be passed
  through, untouched, to the selected audio device. … Streams with codecs not selected for
  passthrough are provided to the output device as PCM audio."
- Rule, verbatim, on defaults: "We do not recommend enabling passthrough as the first thing you do.
  Only do that if you are very well informed about what it entails".
- Rule, verbatim, on the debug procedure: "Start your testing by unchecking all passthrough formats.
  If things work, enable options one at a time until you determine which causes problems."
- **ABSENT**: **player settings of any kind.** CanonCore is direct-play-only, which means the
  *client* is where every compatibility decision lands, and the prompt has no player-settings
  surface at all — no audio track default, no subtitle default, no device configuration. The
  prompt's own client analysis is entirely about which codecs each framework supports and never
  about the user telling it which to prefer. Need: **MEDIUM**, rising with the TV app. (See GAPS.)
- Note the pattern for CanonCore's "When a file will not play, say so plainly": Plex's fallback here
  is a *documented degradation* (unsupported codec becomes PCM), not a failure. Direct-play-only
  removes that option, which makes the plain-statement rule carry more weight than it looks.

### 064 https://support.plex.tv/articles/audio-description-videos/
**Accessibility**: audio-description narration as a selectable alternate audio stream, with the
per-device path to the track picker documented for eight clients, and a contact address for
accessibility inquiries. Links to "Plex's Accessibility Statement".
- Rule, verbatim: "You'll typically only be able to access the audio stream selection if there are
  actually multiple audio streams available."
- **ABSENT**: **accessibility, entirely.** The prompt contains no accessibility content of any kind
  — no statement, no keyboard-navigation commitment beyond "Every accelerator has an equivalent
  visible UI path", no screen-reader consideration, no captions posture, no colour-contrast rule
  (notable given the palette is extracted from artwork and presumably drives UI colour). Need:
  **HIGH** — it is far cheaper to decide at the design-token stage the prompt is already
  committing to than to retrofit across a web app, a phone app and a tvOS app. (See GAPS.)
- **ABSENT**: **track purpose on a sidecar.** CanonCore's file roles are `media|subtitle|audio|
  chapters` plus a language. An audio-description track, a director's commentary, a dub and an
  alternate mix are all role `audio` with the same language and are not the same thing. Similarly
  forced-narrative vs full subtitles, and SDH vs standard. Need: **MEDIUM** — and cheap, since the
  prompt already treats role as a lookup table where "adding one is an INSERT". (See GAPS.)

### 065 https://support.plex.tv/articles/auto-sync-subtitles/
Subtitle auto-sync via voice-activity analysis. The feature is refused (it needs audio decoding),
but the article contains the single best scheduling model in the shard and an unexpected direct
endorsement of CanonCore's edition design.
- Rule, verbatim, on **per-pass scheduling policy**: "choose when you would like the server to
  Generate voice activity data … never: Never analyze … / as a scheduled task: Perform the analysis
  during the regular server maintenance period. / as a scheduled task and when media is added:
  Perform the analysis for new items when they're added and for existing items during the regular
  server maintenance period. This is the default behavior."
- Rule, verbatim, on **why a control is greyed out**: "The option in players will be not be there,
  or will be greyed out and not selectable if: The video file has not yet been processed … The
  currently playing subtitle is not supported, such as an internal/embedded subtitle or a format
  other than SRT."
- Rule, verbatim, on **why it can fail even when everything is enabled**: "The overall offset of the
  subtitle is greater than 30 seconds. / The external subtitle file may be malformed or corrupted.
  / The calculated offset is too inconsistent … **The subtitles are for a different edition of the
  title (e.g. Extended Edition vs Theatrical release or vice-versa)**".
- **ADOPTED / strongly confirming**: that last line is Plex documenting, as an unfixable failure
  mode, the exact problem CanonCore's edition model solves by construction. A subtitle in
  CanonCore is a file with role `subtitle` attached to the edition it accompanies, so "the subtitle
  is for the other cut" cannot silently happen. Worth recording as evidence the edition split earns
  its keep on the playback half too — which matters, because the prompt admits the playback half
  ships "built and unproven".
- **ABSENT**: **a per-background-pass scheduling policy with those three values.** This is the
  concrete, buildable form of the scheduler gap (024/046/052/056). Every expensive derived thing
  CanonCore has — hashing, palette extraction, provider re-enrichment against the six-month cache
  rule, projection rebuild — wants exactly `never | scheduled | scheduled and on add`. Need: **HIGH**
  (counted with the scheduler gap). (See GAPS.)
- **ABSENT**: **explaining why an action is unavailable.** Plex enumerates, in the support doc and
  by implication in the UI, each precondition that greys a control out. CanonCore's "When a file
  will not play, say so plainly" is the same instinct applied to one case only; the general rule is
  not stated. Need: **MEDIUM**. (See GAPS.)

## Batch 14 — articles 066–070

*(Articles 066–110 are **category index pages**: they carry no prose of their own, only a complete
inventory of what Plex documents in that area. For an absence sweep that is arguably the most
useful shape in the shard — a capability taxonomy is exactly the thing you cannot find by asking
"is X missing", because you do not have the word for X yet. Each is recorded as its inventory,
with the fixed six-link "popular articles" tail ignored. Where a named capability was already
covered by a full article above it is cross-referenced rather than re-argued.)*

### 066 https://support.plex.tv/articles/categories/features/
The top-level **feature taxonomy**: nine areas — Casting/Flinging/Remote Control, Live TV & DVR,
Media Optimizer, Downloads for Offline Use, Music Functionality, Plex Home, Remote Access &
Granting Library Access, Watch Together, Other Features (16 articles).
Seven capabilities appear here whose names do not occur anywhere in the CanonCore prompt:
- **Webhooks.** Outbound HTTP notification on library and playback events. **ABSENT**. Need:
  **MEDIUM** — self-hosted users automate; and CanonCore already has the exact machinery, since a
  webhook target is a user-supplied URL and the Safe External Fetch boundary is specified for
  precisely that, just in the inbound direction. (See GAPS.)
- **Universal Watchlist.** A want-to-consume list, separate from progress and from any container.
  **ABSENT**. CanonCore has watched/unwatched via progress and nothing expressing intent. Under the
  model a watchlist is an ordered container the owner keeps, which is a good answer — but it is
  also the single most-used feature of every comparable product and the prompt does not name it.
  Need: **MEDIUM**. (See GAPS.)
- **Play Queues** and **Play Queue Post-Play Screen**. **ABSENT**; reinforces 032/034. Need: **HIGH**.
- **Sync Watch State and Ratings.** **Ratings** are a first-class thing here. **ABSENT** from the
  prompt entirely. A star rating is cleanly a statement with a `rating` property sourced to the
  Owner, which is elegant and free — but the prompt's seed list of a dozen properties does not
  include it and no surface mentions it. Need: **MEDIUM**. (See GAPS.)
- **Push Notifications.** **ABSENT**. Need: **LOW** now, MEDIUM once the phone app exists.
- **Video Playback Speed Controls.** **ABSENT**. Need: **LOW**, though for a text/audio catalogue
  (audiobooks are a named demo case) speed control is close to mandatory. (See GAPS.)
- **Bug Bounty / Reporting Security Issues.** **ABSENT**: no security-disclosure policy, no
  `SECURITY.md`, no stated contact. Need: **MEDIUM** — CanonCore ships a public demo instance and a
  curated third-party provider store, so it has two attack surfaces and no way to be told about
  them. (See GAPS.)
Also inventoried and already classified: Cinema Trailers & Extras (**ABSENT**, see 010, MEDIUM);
Skip TV Show Intros / Credits Detection / HDR-to-SDR Tone Mapping / Video Preview Thumbnails / Sonic
Analysis (**REFUSED** — all require decoding media, and there is no ffmpeg); Watch Together,
Managing Library Access, Common Sense Media, Discover Credits (**REFUSED** — multi-user, sharing,
or vendor-supplied catalogue).

### 067 https://support.plex.tv/articles/categories/features/casting-flinging-remote-control/
Inventory: Chromecast/AirPlay/Casting, Overview, Supported Plex Companion Apps, Choose a Player,
Fling Media, Controlling Flung Media, Companion Remote Control Issues.
- The vocabulary is worth noting: Plex distinguishes **casting** (client hands a stream to a
  device) from **flinging** (one Plex app tells *another Plex app* to play something) from
  **remote control** (one app drives another's transport). Three different things, three docs.
- **ABSENT**: all three. Reinforces 026 and 034. CanonCore's committed client set is web + phone +
  TV in one household, which is exactly the topology where "play this on the TV from my phone" is
  the obvious ask. Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: "Choose a Player" — the idea that a *target device* is a selectable thing in the UI at
  all. Need: **LOW** standalone, but it is the surface the above needs.

### 068 https://support.plex.tv/articles/categories/features/live-tv-dvr/
Inventory of the DVR cluster: the seven articles already covered at 046–052, plus three not in this
shard — Watching Live TV, Removing Commercials, Using XMLTV for guide data, Community Supported
Tuners.
- **REFUSED** in full: no broadcast, no recording, no tuner. Need: **LOW**.
- The two not-in-shard titles that generalise were already captured: user-supplied guide data
  (=tier-3 private providers, 052) and unsupported-but-usable devices (052).

### 069 https://support.plex.tv/articles/categories/features/media-optimizer/
Inventory: Media Optimizer Overview, Example Usage, Creating Optimized Versions, Conversion Queue —
all four already covered at 013, 017, 018, 021, 022.
- **REFUSED** in subject (transcoding). The **shape** — a background job queue with a management
  page listing every long-lived derived artefact — remains the **HIGH** gap opened at 013/018.
- Worth noting for the sweep record: Plex devotes an entire top-level feature category to *managing
  the things the server generates in the background*. CanonCore generates at least five such things
  and has no category for them at all.

### 070 https://support.plex.tv/articles/categories/features/mobile-sync/
Inventory: Downloads Overview, Downloads FAQ, Downloads for iOS and Android Mobile, **Downloads for
Windows, macOS, Linux Desktop**.
- **ABSENT**: **offline downloads**, already raised at 010 as MEDIUM. This page raises it, because
  it shows Plex treats offline as a *four-article, cross-platform, desktop-included* capability
  rather than a mobile convenience — and because it interacts with two things CanonCore has
  decided. First, progress: an offline session produces watch events that must reconcile with an
  append-only log written elsewhere, which is a genuinely hard ordering problem the prompt has not
  seen. Second, "it never stores media: a source is a reference" — a download is the one operation
  that makes CanonCore hold bytes, so it is arguably refused by that sentence, and if so the
  refusal should be explicit because the phone app will otherwise grow it. Need: **MEDIUM**,
  and it wants a written decision rather than a feature. (See GAPS.)

## Batch 15 — articles 071–075

### 071 https://support.plex.tv/articles/categories/features/other-features/
The grab-bag category, and the highest-yield inventory in the shard: Universal Watchlist, Discover
Credits, Skip TV Show Intros, Credits Detection, Sync Watch State and Ratings, Cinema Trailers &
Extras & Related Albums, Push Notifications, HDR to SDR Tone Mapping, Video Preview Thumbnails,
Webhooks, Play Queues, Play Queue Post-Play Screen, "Why won't trailers or extras play?",
Common Sense Media, Video Playback Speed Controls, Bug Bounty.
- All sixteen classified at 066. The two worth re-stating because the category page is where they
  become visible as a *set*:
- **ABSENT**: **Play Queue Post-Play Screen** — a distinct surface for the moment playback ends,
  which is where "next episode", "back to the container", and re-watch decisions live. CanonCore
  computes Continue Watching and is silent on what happens at the end of a file. Under
  multi-placement, "what comes next" is genuinely ambiguous and therefore a design question rather
  than a feature request. Need: **HIGH** (counted with the On Deck / next-up gap from 021).
- **ABSENT**: **Related Albums** (the "Cinema Trailers, Extras, & Related Albums" article title) —
  a work's associated-but-separate satellites: trailers, featurettes, soundtracks, companion
  volumes. Under the prompt's own edition rule these are all separate items linked by statements,
  which is correct — but nothing says how they are kept out of the main browse grid, and the
  prompt's only exclusion mechanism is "exclude BY KIND", which cannot help because a trailer and
  a film are both `work`. Need: **MEDIUM**, and it is a real hole in the entity-exclusion rule.
  (See GAPS.)

### 072 https://support.plex.tv/articles/categories/features/plex-home/
Inventory: What is Plex Home, Creating a Plex Home, Example Setup, **Managed Accounts**, **Fast User
Switching**, **Parental Controls**, How do I leave a Plex Home, **Plex Home Security Changes**,
**Consequences of Being in a Plex Home**, PIN reset.
- **REFUSED / deferred, correctly**: CanonCore is "ONE row. Single user, one password, no signup, no
  multi-tenancy", with `owner_id` retained "so multi-user is a later migration rather than a
  rewrite". This category is a precise map of what that later migration has to contain, and it is
  larger than a column: managed (non-credentialed) accounts, a PIN-based switch on a shared TV,
  per-account restrictions, and a documented list of what joining costs you.
- The genuinely useful signal for CanonCore now: **two of the ten articles are about the
  consequences and security changes of joining** — i.e. Plex found that the hard part of household
  multi-user was not the mechanism but explaining what you give up. That is an argument *for* the
  prompt's decision to defer it, and it is worth noting that the prompt's other deferral,
  visibility ("Add it when multi-user arrives, which is when it first means anything"), is
  correctly coupled to this one.
- **ABSENT**: **fast user switching / a PIN on a shared living-room device**. Need: **LOW** while
  single-user, but it is the first thing the TV app will want if the instance ever grows a second
  person, and the prompt's cookie session has no shape for it. (Counted with 059.)

### 073 https://support.plex.tv/articles/categories/features/plex-music/
Inventory: Sonic Analysis for Music, **Upgrading Music Libraries to the New Metadata System**,
**Correcting Your Music Content Matches**, Automatic Lyrics from LyricFind (=024),
**Changing Artist, Album, or Track Information**.
- **REFUSED**: Sonic Analysis (audio decoding); lyrics as a premium licensed feed (=024).
- **ABSENT, and this is the important one**: **correcting a wrong match.** Plex has a whole article
  per media type for it, and the "Fix Match / Match" article recurs across three other categories
  (081, 082, 083). CanonCore splits matching from applying into separate contract endpoints, has a
  review queue for the uncertain band, and remembers rejections — and never describes the
  operation on an item that matched *above* the high bar and matched **wrongly**. That item is now
  silently carrying another work's statements, and the prompt's own justification for requiring
  `lookup` is precisely this failure ("a refresh by search can silently rebind a record to the
  wrong thing"). It identifies the risk and never names the remedy. Need: **HIGH**. (See GAPS.)
- **ABSENT**: **a user-visible metadata-model migration.** "Upgrading Music Libraries to the New
  Metadata System" is a *content* migration the operator opts into and which can go wrong,
  distinct from a schema migration. CanonCore's ladder covers schema; nothing covers re-deriving
  statements when the field set or a vocabulary changes — and the prompt guarantees that will
  happen, since "Adding one is an INSERT" and properties stay editable for cardinality, range and
  options. Need: **MEDIUM**. (See GAPS.)
- **ADOPTED**: "Changing Artist, Album, or Track Information" is hand-editing over provider data.
  The prompt does this better — an owner edit is a statement sourced to the Owner at rank
  preferred, which is simultaneously the value, the provenance and the lock.

### 074 https://support.plex.tv/articles/categories/features/remote-access-server-sharing/
Inventory: Remote Streaming (Setting Up Remote Access), Managing Library Access, **Restrictions on
Library Access**, Requirements for Remote Playback of Personal Media, Troubleshooting Remote
Access, **Single Item Access**, Extended Trial for Remote Watch Pass.
- **REFUSED**: sharing a library with other accounts (no multi-user, no account service).
- **ABSENT**: **remote access**, third sighting (004, 028, here). The category's existence — five
  articles, one of them a dedicated troubleshooting guide — is the measure of how much of a
  self-hosted product's support burden this is. CanonCore's answer is probably "document a reverse
  proxy or Tailscale", exactly as it documents rclone for storage, and that decision needs writing
  down before someone builds a relay. Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: **Single Item Access** — a shareable link to one item, without an account. Genuinely
  interesting against CanonCore's model: the prompt refuses a visibility system outright and has a
  public read path that "NAMES every field it emits" and carries no internal ids. A per-item share
  link is the one form of sharing that needs neither multi-user nor a visibility column — it is a
  capability URL over the existing public read path. Need: **MEDIUM** — and note it sits close to
  the demo instance, which is already that read path running in public. (See GAPS.)

### 075 https://support.plex.tv/articles/categories/features/watch-together/
Inventory: Watch Together, and its FAQ. Synchronised playback across viewers in different places.
- **REFUSED**: requires multi-user, an account service and cross-instance coordination, all three
  of which the prompt rules out ("No fork, no export, no import, no cross-instance sharing").
- Need: **LOW**. Recorded for completeness; nothing transfers.

## Batch 16 — articles 076–080

### 076 https://support.plex.tv/articles/categories/general-topics/
**404 — retired.** Third dead URL (after 015, 051).

### 077 https://support.plex.tv/articles/categories/general-topics/agents-only/
**404 — retired.** The slug is the interesting part: an "agents" category once existed. Plex's
metadata **agents** are the direct ancestor of CMPP, and the category's removal matches the history
the prompt already records — plug-ins opened, closed in 2018, reopened in 2025 as a plain HTTP
contract. Nothing further to extract.

### 078 https://support.plex.tv/articles/categories/general-topics/staging-area/
**404 — retired.** A "staging area" category, also gone. No content served.
- Worth one line for the sweep as a whole: **four of the 110 URLs in this shard are dead**
  (015, 051, 076, 077, 078 — five). A support corpus decays, and Plex has no redirects for retired
  categories. Not a CanonCore gap; a note on the source's reliability.

### 079 https://support.plex.tv/articles/categories/intro-to-plex/
The **onboarding taxonomy**: Quick Start, System Requirements, Subscriptions, Account Information,
Common Questions, Guides (49 links). Six capability names here are absent from the prompt.
- **Two-Factor Authentication** ("Secure Your Account with Two-Factor Authentication").
  **ABSENT**. CanonCore is one password, no signup, and — once remote access exists in any form —
  internet-reachable with a single secret. TOTP is a well-trodden addition and the `owners` table is
  the natural home. Need: **MEDIUM**. (See GAPS.)
- **Federated sign-in** ("Use Google or Apple to Sign in with Plex"). **REFUSED** by "no signup, no
  account service" and by the self-hosted posture. Need: **LOW**.
- **Account Audio/Subtitle Language Settings.** **ABSENT**, and this is the *third distinct language
  axis*, which is what makes the language gap serious rather than cosmetic:
  (i) metadata language — which title/synopsis a provider returns (061);
  (ii) playback track language — which audio and subtitle track opens by default (here);
  (iii) UI language — see "Helping Translate/Localize Plex Apps and Websites" below.
  The prompt addresses none of the three. `files` carry a language on sidecars, so (ii) has the
  data and no rule. Need: **HIGH**. (See GAPS.)
- **Localization / translation** ("Helping Translate/Localize Plex Apps and Websites").
  **ABSENT**: no i18n of the UI itself, and no statement that it is deliberately English-only. The
  prompt commits to design tokens as plain TypeScript from the first commit precisely because such
  things are expensive to retrofit; string externalisation is in the same class and is not
  mentioned. Need: **MEDIUM**. (See GAPS.)
- **System requirements** ("Plex Media Server Requirements", "Internet and Network Requirements").
  **ABSENT**: no minimum spec, no supported-platform list, no network prerequisites. Need:
  **MEDIUM** (rolls into distribution). 
- **License Information.** **ABSENT**: no third-party/OSS attribution page and, per 011, no licence
  posture for CanonCore itself. Two different things, both missing. Need: **MEDIUM**.
- Also inventoried: "Early Access & Beta Releases" (**ABSENT**: no release channels — rolls into
  distribution, 058); "Log Files" as a top-level common question (**ABSENT**, the logging gap
  again); "Why is some of my content not found?" (**ABSENT**: no scanner-diagnostics doc or
  surface — a scanner that silently skips a file is the commonest support case in this category,
  and CanonCore's scanner has hashing, sidecar matching and root scoping to go wrong in);
  "Move Media Content to a New Location" — see 081.

### 080 https://support.plex.tv/articles/categories/intro-to-plex/account-information/
Inventory of the account surface: Plex Accounts, Sign in, Two-Factor Authentication, Federated
sign-in, Sync Watch State and Ratings, Account Audio/Subtitle Language Settings, **Edit Profile**,
Password reset (=059), PIN reset.
- **REFUSED** in bulk: there is no account service, no profile, no PIN, no federation.
- The residue after removing everything account-shaped is exactly three things, and all three are
  **ABSENT** from CanonCore: **2FA**, **playback language preferences**, and **ratings**. Each is a
  per-owner *preference*, and that points at the real structural gap underneath:
- **ABSENT**: **an owner preferences surface at all.** The prompt's `owners` table is described
  solely as an identity row ("ONE row. Single user, one password"). Every preference the design
  already implies has nowhere to live: the two enrichment thresholds ("Both numbers tunable"), the
  source order, the edition order, the completion threshold, scanner roots, the periodic scan
  interval. The prompt names these as tunable and never says where a tuned value is stored or how
  it is edited. Need: **HIGH**. (See GAPS.)


## Batch 17 — articles 081–085

Note on method for the remaining category indexes: each page carries a boilerplate "popular
articles" block of five or six links (rotating between {Which Smart TV models, Quick-Start,
Why can't the Plex app find…, Remote Streaming, Troubleshooting Remote Access} and {Skip TV Show
Intros, Plex: Free vs Paid, Getting Started with Plex Music, Supported DVR Tuners, Troubleshooting
Remote Access}, plus Bug Bounty on every page). Those are stripped from the inventories below;
what is listed is the category's own contents.

### 081 https://support.plex.tv/articles/categories/intro-to-plex/common-questions/
Inventory (15): Why can't the app find/connect to the server · Why is my video stream buffering ·
How do I choose the right Streaming Quality · **Why is some of my content not found?** ·
Is Plex like Netflix? · Changelogs and Release Notes (=045) · **Log Files** · **Why don't videos
from iTunes, Amazon, etc. play?** · plex.tv resources troubleshooting (=007) · **Is Plex legal?** ·
Media Optimizer Overview (=021) · **How do I delete something from my Library?** · Relay (=028) ·
**Library** · **Uninstall Plex Media Server** · **Reporting Security Issues**.
- This is the "what do users actually ask" list, and it is worth reading as a ranking. Four of
  fifteen are connectivity, three are transcoding, two are "the scanner did not find my file".
- **ADOPTED**: "Why don't videos from iTunes, Amazon, etc. play?" is DRM, and the answer is that
  they never will. The prompt's rule — "When a file will not play, say so plainly" — is exactly
  right, and DRM is the case that proves it is not a temporary limitation to be engineered around.
- **ADOPTED**: "Is Plex like Netflix?" answers "no content is included". CanonCore's equivalent is
  already decided and stronger: "A fresh install by anyone else starts EMPTY, with no content of
  any kind."
- **REFUSED**: Streaming Quality, Media Optimizer, buffering — all transcoding.
- **ABSENT, and the sharpest thing in this batch**: **does "Delete permanently" delete the file on
  disk?** The prompt's DELETE section is careful and complete about the *catalogue* — Cancel,
  Remove from this container, Delete permanently, with counts previewed — and never says whether
  the bytes go. The standing rule that covers writes ("The scanner NEVER writes storage") is scoped
  to the scanner, so it does not answer this. Plex needs a whole article plus a server-level
  "Allow media deletion" toggle for it. Need: **HIGH** — the prompt itself calls delete "the one
  place data is actually lost", and it is ambiguous about which data. (See GAPS.)
- **ABSENT**: **a security-disclosure path.** Plex's Bug Bounty article is linked from every single
  page in this corpus. CanonCore is self-hosted software with a Safe External Fetch boundary, a
  single-password cookie session and third-party provider URLs, and has no stated way to report a
  vulnerability. Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: **uninstall / where my data lives.** No statement of what a CanonCore install puts on
  disk or how to remove it. Rolls into distribution (058, 079). Need: **MEDIUM**.
- **ABSENT**: "Is Plex legal?" — a legal-posture page. Distinct from licensing (011): this is the
  statement that the software does not supply content and the operator is responsible for what they
  catalogue. Need: **LOW** as a product feature, but it is one paragraph and the demo makes
  CanonCore a publisher, so it is cheap.

### 082 https://support.plex.tv/articles/categories/intro-to-plex/guides/
Inventory (14): Connect a Player App to Your Account · Hardware-Accelerated Streaming ·
Automatically Adjust Quality · **How to Use Secure Server Connections** (=004) · Bandwidth and
Transcoding Limits (=056) · Relay (=028) · Reporting Security Issues · Getting Started with Plex
Music (=001) · **License Information** · Playback Quality Suggestions · **Helping
Translate/Localize** · **Audio Description for Movies and TV Episodes** (=064) · Which Smart TV
models are supported · **Quick-Start & Step by Step Guides**.
- **REFUSED**: hardware acceleration, quality adjustment, bandwidth limits — all transcoding.
- **ABSENT**: **first-run setup.** Plex's "Quick-Start & Step by Step Guides" and its Basic Setup
  Wizard (see 107) exist because a media server's first ten minutes are its hardest. CanonCore is
  "single user, one password, no signup" and never says **how the first password is set**. That is
  not a UX nicety: an install that is reachable before a password exists is the "unclaimed media
  server" problem (031) with the door open. Need: **HIGH**. (See GAPS.)
- **ABSENT**: **serving the instance over TLS.** The prompt mandates HTTPS for *outbound* fetches
  in the SEF boundary and says nothing about inbound. Plex ships a whole article on it because a
  LAN-hosted server cannot easily hold a valid certificate. Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: audio description, second sighting (064). With `files` carrying role
  `media|subtitle|audio|chapters` plus a language, an AD track is an `audio` sidecar — but nothing
  can say it *is* audio description rather than a second language dub. One vocabulary value fixes
  it. Need: **MEDIUM**, and it is the cheapest accessibility win available. (See GAPS.)
- **ABSENT**: UI localisation, second sighting (079).

### 083 https://support.plex.tv/articles/categories/intro-to-plex/plex-subscriptions/
Inventory (6): Plex Pass Overview · Remote Watch Pass Overview · Plex Subscription Management ·
**Early Access & Beta Releases** · Sales Tax information · Upgrading Plex Subscriptions.
- **REFUSED** in bulk: no subscription, no billing, no account service, no premium tier. Note in
  passing that five of six articles in a top-level "Intro to Plex" subcategory are about money;
  that is the shape of the product CanonCore is deliberately not.
- **ABSENT**: **release channels.** "Early Access & Beta Releases" is the third sighting (058,
  079). Whether CanonCore has a stable/beta split matters at the moment the migration ladder meets
  a second person's data. Need: **MEDIUM**, folded into distribution. (See GAPS.)

### 084 https://support.plex.tv/articles/categories/intro-to-plex/quick-start/
Inventory (4): **What is Plex?** · Quick-Start & Step by Step Guides · Plex: Free vs Paid ·
**Exploring More of Plex**.
- The entire onboarding funnel is four documents, two of which are in-product feature discovery
  rather than setup.
- **ABSENT**: **in-product feature discovery** ("Exploring More of Plex"). CanonCore's whole
  premise is a capability nobody has seen before — an item in several orderings at once — and the
  stop condition ends at a page that *shows* it without anything that *explains* it. The worked
  example in the prompt ("Also appears in — Release order (#63), Story order (#1)") is itself the
  explanation, which is good design, so this is mild. Need: **LOW**.
- Setup wizard counted at 082.

### 085 https://support.plex.tv/articles/categories/intro-to-plex/system-requirements/
Inventory (2): **Plex Media Server Requirements** · **Internet and Network Requirements**.
- Smallest category in the corpus, and both entries are absent from the prompt.
- **ABSENT**: **a minimum spec and a supported-platform list.** Second sighting (079). Worth
  noting what CanonCore's would say, because it is unusually short and that is a genuine product
  advantage: no transcoding means no CPU class, no GPU, no "is this NAS powerful enough" — the
  requirements reduce to Postgres, Node and a readable filesystem path. Plex's requirements page
  exists almost entirely to talk about transcoding headroom. Need: **MEDIUM**. (See GAPS.)

## Batch 18 — articles 086–090

### 086 https://support.plex.tv/articles/categories/online-media-sources/
Top-level index for everything that is **not the owner's own files**. Four subcategories —
Discover, Free Live TV Streaming, Video on Demand, Plugins — and 21 articles.
Inventory: Discover Source · Activity Feed (=060) · Profile · Share and Report · Discussions ·
**Lists** · Follow · User Reviews · Friends/People · Mute & Block · Free Live TV Overview + FAQ ·
Movies & Shows Overview · Renting or Purchasing Movies · FAQ Free Movies & Shows · FAQ Rentals ·
Sales Tax · **Plugins: Overview, manual install, Plug-Ins folder, Plugin Log Files**.
- **REFUSED** in bulk, and on four independent grounds, which is worth stating because it is the
  cleanest example in the sweep of the prompt's refusals compounding: the social half (Profile,
  Follow, Friends, Discussions, User Reviews, Share and Report, Mute & Block) needs multi-user AND
  an account service AND cross-instance identity, all three ruled out; the streaming half (Free
  Live TV, VOD, rentals) needs licensed content and a billing relationship, and CanonCore "never
  stores media" and ships as software.
- **ADOPTED**: **Lists.** A user-curated ordered list that is not a library. CanonCore already has
  this and better — it is an ordered container, and unlike a Plex list it can hold items from
  different groups and an item can be in many lists at different positions.
- **ADOPTED, worth naming**: the **watchlist** shape — a list of things you do not own. Plex needs
  a whole separate online-source subsystem for it because a Plex item cannot exist without a file.
  In CanonCore a watchlist is a container of items with zero editions and zero files, using nothing
  new. This is reason 1 in "WHY THIS DOES NOT ALREADY EXIST" cashing out as a feature.
- **DIVERGENT**: **Plugins.** The subcategory is still live with four articles — "How do I manually
  install a plugin?", "How do I find the Plug-Ins folder?" — seven years after Plex closed the
  system. The prompt's history is confirmed and extended: the *documentation* outlives the feature,
  which is what stranding an ecosystem looks like from the support side. CanonCore's providers are
  URLs, never installed code, never a folder.
- **ABSENT**: **per-provider diagnostics** ("Plugin Log Files"). CanonCore's entire extensibility is
  third-party HTTP endpoints behind a Safe External Fetch boundary that can time out, redirect,
  exceed the size cap, fail validation or return well-formed nonsense. The prompt gives one feedback
  channel — "this provider sent 340 things we have no field for" — and nothing for the failures.
  "Why did this provider return nothing?" has no surface. Need: **MEDIUM**. (See GAPS.)

### 087 https://support.plex.tv/articles/categories/online-media-sources/discover/
Inventory (10): Discover Source · Activity Feed · Profile · Share and Report · Discussions · Lists ·
Follow · User Reviews · Friends/People · Mute & Block.
- **REFUSED** wholesale — this is the social product, and it is ten articles deep. Recorded because
  the *size* is the finding: a media server that grows a social layer grows a moderation surface
  (Share and Report, Mute & Block) as an immediate consequence. The prompt's "No fork, no export,
  no import, no cross-instance sharing" plus "No visibility system" avoids all ten at once.
- Need: **LOW**. One residue, already counted at 074: a per-item share link needs none of this.

### 088 https://support.plex.tv/articles/categories/online-media-sources/free-live-tv-streaming/
Inventory (2): Free Live TV Streaming Overview · FAQ.
- **REFUSED**: ad-supported linear channels. Requires content licensing, an ad stack and live
  transcoding. Fourth sighting of live TV (046–052, 068). Need: **LOW**.

### 089 https://support.plex.tv/articles/categories/online-media-sources/plugins/
Inventory (4): Overview · How do I manually install a plugin? · How do I find the Plug-Ins folder? ·
**Plugin Log Files**.
- **DIVERGENT**, and this is the article set the prompt's provider design was written against.
  Plex's model: a folder on the server, code copied into it by hand, running in-process, with its
  own log file. CanonCore's: "A provider is a URL answering a contract — not a plugin, not a repo,
  and never code running inside the app." Every one of these four articles is unwritable under that
  design, which is the point.
- **ABSENT**: per-provider logs — counted at 086.
- Need: **LOW** beyond that. Nothing else transfers.

### 090 https://support.plex.tv/articles/categories/online-media-sources/video-on-demand/
Inventory (5): Movies & Shows Overview · Renting or Purchasing Movies on Plex · FAQ Free Movies &
Shows · FAQ Movie Rentals and Purchases · Sales Tax information.
- **REFUSED**: storefront, entitlements, tax. Nothing transfers.
- One structural note worth a line, because it is the only part that touches the model: a rented
  title is an item you can play for a window and then cannot. That is a *time-bounded access* shape,
  and CanonCore has no equivalent and needs none — a source is a reference, and if the file goes
  away the item stays, media-independent, exactly as designed. Need: **LOW**.

## Batch 19 — articles 091–095

### 091 https://support.plex.tv/articles/categories/player-apps-platforms/
The client index: **15 platform subcategories, 103 articles**. Android mobile · Android TV/Fire TV ·
Apple TV · Chromecast · iOS · NAS devices · NVIDIA SHIELD · PlayStation · Plex HTPC · Plex Web App ·
Roku · Smart TV/TiVo · Sonos · Windows/Mac/Linux desktop · Xbox.
- The number is the finding. CanonCore commits to web now, phone then TV, and the prompt already
  argues that choice against ten comparable projects. Nothing here reopens it. What the index adds
  is the **per-platform tax**: every platform gets its own Settings article, its own log-gathering
  article and its own "what media formats are supported" article. Three documents per client,
  forever, and two of the three are absent from CanonCore entirely.
- **ABSENT**: **a per-client format support statement.** The prompt makes this load-bearing in its
  own words — "direct-play-only makes client codec coverage load-bearing" — and then gives the
  runtime behaviour ("When a file will not play, say so plainly") without any way for the *server*
  to know what the *client* can decode. Plex's per-platform format articles exist because users need
  to know before they buy a device. Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: **client-scoped settings.** Fifteen "Settings: <platform>" articles say that a real
  media server has two settings scopes, per-server and per-client, and they are different sets.
  CanonCore has neither surface (080) and no notion that the distinction exists. Need: **MEDIUM**,
  folded into the owner-preferences gap. (See GAPS.)
- **ABSENT**: **Devices** and **Server Status and Dashboard** (from the web app subcategory) plus
  "How do I see what is being played by Plex apps?" — a session list and a now-playing view. For a
  single-user instance behind one cookie, a session list is the only way to notice a stolen session,
  and it is the natural place to revoke one. Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: **Extras / Cinema Trailers.** A trailer, a featurette, a deleted scene — content
  attached to a work that is not the work. Under the prompt's model this is either a related `work`
  item or a file with a role, and neither is stated. Plex additionally ships a setting to turn their
  retrieval off. Need: **LOW-MEDIUM**.
- **ADOPTED-as-deferred**: "Interface Overview", "Using the Library View", "Viewing Item Details",
  "Customizing the Big Screen Apps", "Manage Recommendations" — the screen taxonomy. The prompt
  explicitly holds these open: "No shelf type, no command palette yet, no fixed item-page tab
  structure. Those are decided when screens exist." Correct call; this index is a good checklist for
  when they do.
- **REFUSED**: Skip TV Show Intros (needs audio fingerprinting), casting, Top Shelf, Android Auto,
  controller mapping, per-platform unlock purchases.

### 092 https://support.plex.tv/articles/categories/player-apps-platforms/android-mobile/
Inventory (12): Navigating the Mobile Apps · **Manage Favorite Libraries** · Settings: Plex Mobile ·
**Mobile System Permissions** · How to Grab App Logs · Unlocking or Activating Plex for Android ·
Features and limitations without unlocking (=006) · Google Play purchase (=030) · Android Auto ·
Plex Pass on Android · Amazon purchase (=035) · **Opening a Local Video File (mobile)**.
- **REFUSED**: four of twelve are the per-platform paid unlock. No billing in CanonCore.
- **ABSENT**: **Manage Favorite Libraries** — a per-client choice of which libraries appear. In
  CanonCore terms, a per-client subset of groups. The prompt makes groups a browsing scope
  server-side; nothing scopes them per device. Need: **LOW**, folded into client-scoped settings.
- **ABSENT**: **Opening a Local Video File** — playing a file that is not in the catalogue at all.
  Genuinely orthogonal to everything CanonCore models and cheap in a client. Need: **LOW**.
- **ABSENT**: OS permission prompts (storage, notifications). Arrives with the phone app; not a
  model gap. Need: **LOW**.

### 093 https://support.plex.tv/articles/categories/player-apps-platforms/android-tv/
Inventory (6): Navigating the Big Screen Apps · **Customizing the Big Screen Apps** · Settings:
Android TV · Android TV/Fire TV Logs · Google Play purchase · Amazon purchase.
- Note that "Navigating/Customizing the Big Screen Apps" is **one shared pair of documents across
  Android TV, Apple TV, PlayStation and Smart TV** — Plex writes the TV experience once and the
  platform shells separately. That is a direct argument for the prompt's TV plan and against its
  own warning case ("Never a second Expo app for TV"): the shared thing is the *design*, not the
  binary. Need: **LOW**; recorded as support for a decision already taken.
- **ABSENT**: shelf/row configuration — deferred by the prompt, counted at 091.

### 094 https://support.plex.tv/articles/categories/player-apps-platforms/apple-tv/
Inventory (7): Navigating/Customizing Big Screen Apps · Settings: Plex for Apple TV · Top Shelf
(=019) · **How do I delete content using the Apple TV app?** (=020) · Do I need an account (=016) ·
Apple TV Logs.
- **ADOPTED, and this is a good confirmation**: Plex documents deletion *per client* because the
  confirmation differs by platform. The prompt already anticipates exactly this failure — "The
  confirmation is never dismissible by accident: never a drawer, never a swipe-away sheet" — which
  is a client-shaped rule written into a model document. It is the right place for it, since the
  rule has to survive three clients.
- **REFUSED / LOW**: Top Shelf and other OS-level integration surfaces.

### 095 https://support.plex.tv/articles/categories/player-apps-platforms/chromecast/
Inventory (8): Casting Support · Cast from Browser or Desktop · Cast from Android · Cast from iOS ·
**Does content stream directly to the Chromecast or through the casting device?** · BT router page ·
Chromecast on Amazon Android devices · Chromecast on iOS 5.
- **REFUSED**: casting, second sighting (067). Needs a receiver app and a discovery protocol.
- **ABSENT, and structurally interesting**: the "does it stream directly or through the phone"
  question is about **who fetches the bytes**. CanonCore routes playback "through an app-owned
  opaque-id route so access control and progress work", which assumes the fetcher is an
  authenticated client. A cast receiver is a third device that holds no session, so casting would
  force a short-lived capability URL on that route — the same primitive as the per-item share link
  at 074. Worth knowing that two deferred features want the same missing thing. Need: **LOW** now,
  but note the shared primitive.

## Batch 20 — articles 096–100

### 096 https://support.plex.tv/articles/categories/player-apps-platforms/ios/
Inventory (13): Navigating the Mobile Apps · Manage Favorite Libraries · Settings: Plex Mobile ·
Grab App Logs · Mobile System Permissions · Unlocking or Activating Plex for iOS · App Store
purchase (=003) · **iOS Media Playback** · Features without unlocking (=006) · Family Sharing
(=038) · **AirPlay with secure connections and DNS Rebinding protection** (=026) · **Will Plex work
on my older iOS devices?** · iOS App System Permissions.
- **ABSENT**: **a minimum-OS / supported-version policy.** "Will Plex work on my older iOS devices?"
  is a support article because dropping a platform version is a promise being broken. CanonCore has
  no supported-platform statement at any layer — not the browser, not Postgres, not Node. Need:
  **MEDIUM**, folded into system requirements (085). (See GAPS.)
- **ABSENT**: **serving the instance over TLS on a LAN**, second sighting (004/026, 082). The
  AirPlay article is the sharp version: requiring secure connections plus a router that blocks
  DNS rebinding breaks playback, because a self-hosted server cannot hold a public certificate for
  a private address. Every self-hoster meets this. CanonCore's answer is probably "a reverse proxy,
  documented, exactly as rclone is documented" — but it is not written down. Need: **MEDIUM**,
  folded with remote access. (See GAPS.)

### 097 https://support.plex.tv/articles/categories/player-apps-platforms/nas-devices-player-apps-platforms/
Inventory (6): **NAS Compatibility List** · NAS Devices and Limitations · Is Plex Media Server on a
NAS Right for Me? · **Mounting Network Resources** · Installing on FreeNAS · Install on TerraMaster.
- **ADOPTED**: "Mounting Network Resources" is the source of the prompt's own rule — content
  mounted over a network "will typically not work" for change notifications, therefore "Support
  explicit periodic scans". Confirmed at the category level: network mounts are a first-class
  deployment shape, not an edge case.
- **ABSENT**: **a hardware compatibility matrix.** Recorded mainly for the contrast, which is a
  genuine CanonCore advantage: Plex's NAS category exists because transcoding needs CPU headroom
  and NAS CPUs do not have it. With no transcoding, CanonCore's answer to "is my NAS powerful
  enough" is yes, and the whole category collapses to one line about filesystem permissions.
  Need: **LOW**.
- **ABSENT**: **the file-permissions story.** Running as a service account that can read someone
  else's media directory is the second-commonest self-hosting failure after remote access, and
  Plex ships a Linux Permissions Guide (108) for it. The prompt says "Build against a FILESYSTEM
  PATH" and nothing about the process identity that reads it. Need: **MEDIUM**. (See GAPS.)

### 098 https://support.plex.tv/articles/categories/player-apps-platforms/nvidia-shield-player-apps-platforms/
Inventory (5): Setting Up and Managing PMS on SHIELD (=043) · Media Storage Options (=041) ·
Accessing SHIELD Storage (=040) · Limitations on SHIELD (=042) · **Moving server data storage
location on NVIDIA SHIELD**.
- **ADOPTED, and this is the strongest confirmation in the shard for a decision already taken.**
  Plex needs a documented per-platform procedure for moving media, and a second one (108) for
  moving the server's own data directory, because relocating files breaks the library. CanonCore's
  file identity is `SHA1(size + SHA1(first 64KB) + SHA1(last 64KB))` with "PATH IS LOCATION, NOT
  IDENTITY, so a moved file is the same file" — the prompt notes Plex computes this exact hash and
  then does not use it to relink moves. Four articles across two categories are the cost of that
  omission. Need: **LOW** — nothing missing; the design already wins here.
- Server *data directory* relocation is a different question and is counted at 108.

### 099 https://support.plex.tv/articles/categories/player-apps-platforms/playstation/
Inventory (9): Navigating/Customizing Big Screen Apps · Settings: PlayStation · What media formats
are supported? · Why can't it find my local server? · **Where is Plex for PlayStation available?** ·
Logging for PlayStation (=037) · PlayStation TV and Vita · Is PlayStation Plus required?
- **REFUSED / out of scope**: console clients. Note that three of nine articles are gating
  questions (region availability, a console subscription requirement, dead hardware) — the cost of
  shipping on a platform whose owner controls distribution. The prompt's client plan (web, then
  Expo phone, then native Swift TV) touches one such platform, and knowingly.
- **ABSENT**: per-client format matrix and per-client logs, both counted at 091.
- Need: **LOW**.

### 100 https://support.plex.tv/articles/categories/player-apps-platforms/plex-htpc/
Inventory (4): HTPC – Getting Started · HTPC – Settings · Plex HTPC Logs · **Plex HTPC Input Maps**.
- A fourth client class: a desktop machine driven by a remote control rather than a mouse.
- **ABSENT**: **an input model.** "Input Maps" is remapping keys and remote buttons to actions.
  CanonCore has one adjacent standing rule — "Every accelerator has an equivalent visible UI path" —
  which presumes accelerators exist and says nothing about what they are or whether they are
  configurable. On TV this stops being cosmetic: the prompt already records that tvOS focus "cannot
  be tested from JavaScript at all because it resolves natively", so input handling is the part of
  the TV client with the least test coverage available to it. Need: **LOW-MEDIUM**.
- Need overall: **LOW**. HTPC itself is out of scope.

## Batch 21 — articles 101–105

### 101 https://support.plex.tv/articles/categories/player-apps-platforms/plex-web-app/
**The most directly useful index in the shard**: the documented surface list of the web client,
which is exactly what CanonCore is building now. Fifteen articles:
Customizing Plex Web · Overview · Opening Plex Web App · **Cinema Trailers & Extras** · Why are
there old or duplicate Server entries in the Dashboard sidebar? · **Interface Overview** · **Using
the Library View** · **Viewing Item Details** · **Plex Web App Settings** · **Plex Web App Player** ·
**Devices** · **Server Status and Dashboard** · Plex Account · Updating Plex Web App · Logs.
- Read as a checklist, the web app decomposes into seven surfaces: browse (Library View), item
  (Item Details), play (Player), configure (Settings), observe (Server Status and Dashboard),
  manage sessions (Devices), and identity (Account). CanonCore has decided the first three
  implicitly and none of the last four.
- **ADOPTED-as-deferred**: Library View, Item Details, Player. The prompt holds their structure open
  until screens exist, and the stop condition names the one thing the item page must show.
- **ABSENT**: **a settings surface**. Third sighting (080, 091). This remains the largest structural
  hole the sweep has found, because the prompt names at least seven tunable values — both enrichment
  thresholds, the source order, the edition order, the completion threshold, scanner roots, the scan
  interval — and gives none of them a home or an editor. Need: **HIGH**. (See GAPS.)
- **ABSENT**: **Server Status and Dashboard** — a live view of what the server is doing. In
  CanonCore's case: a scan in progress, an enrichment run against the thresholds ("Applying runs in
  the background"), a projection rebuild, the review queue depth. The prompt commits to background
  work as a design principle and never gives it a status surface. Need: **MEDIUM**. (See GAPS.)
- **ABSENT**: **Devices** — a session list with revocation. Need: **MEDIUM**, counted at 091.
- **ABSENT**: **Extras** — counted at 091.
- Note "Why are there old or duplicate Server entries in the Dashboard sidebar?": stale device
  records accumulating with no expiry. A cautionary tale for any session list that gets built.

### 102 https://support.plex.tv/articles/categories/player-apps-platforms/roku/
Inventory (7): What models are supported · Roku purchase (=039) · Settings: Plex for Roku · Roku
Logs · Is 4K supported (=023) · Do I need an account (=012) · **Is Plex for Roku open source?**
- **ABSENT**: **a licence posture**, third sighting (011, 079). Plex answers "is this open source"
  with a support article per client because users ask. CanonCore has no stated licence for its own
  code, no third-party attribution page, and — given the CMPP store accepts third-party providers
  and every provider we write "lives in a separate repo in the CanonCore organisation" — a licence
  is load-bearing for whether anyone may write one. Need: **MEDIUM**. (See GAPS.)
- Rest **REFUSED / LOW**: per-platform models, purchases, 4K.

### 103 https://support.plex.tv/articles/categories/player-apps-platforms/smart-tv-tivo/
Inventory (8): Plex for Xumo/Xfinity Overview · Navigating/Customizing Big Screen Apps · Which Smart
TV models are supported · What media formats are supported on Smart TVs · Why can't it find my local
server · How do streaming quality selections work · Logging for Smart TV App (=029).
- **REFUSED / LOW**: smart-TV platform shells and quality selection.
- One observation worth keeping: "Which Smart TV models are supported?" appears in the boilerplate
  popular-articles block on roughly half the pages in this shard, i.e. it is among the most-read
  documents Plex has. Device support is the question users ask most, and it is a question CanonCore
  answers with a browser. Need: **LOW**.

### 104 https://support.plex.tv/articles/categories/player-apps-platforms/sonos/
Inventory (5): Requirements for using Plex for Sonos (=036) · **Control Sonos Playback With a Plex
App** · Installing the Plex for Sonos Service (=033) · Navigating Plex for Sonos (=032) · Sonos
Playback (=034).
- **REFUSED**: a cloud-brokered integration where the speaker fetches from the server directly and
  a phone app only issues commands. Needs an account service and a publicly reachable endpoint,
  both ruled out.
- **ABSENT**: **remote control of another renderer**, third sighting (067 casting, 095 Chromecast).
  Three separate mechanisms in this corpus for "play it there, control it from here", and CanonCore
  has none and no primitive for one. Consistent with direct play only and a single client per
  session. Need: **LOW**, but note it is the third feature wanting a capability URL on the playback
  route (074, 095).

### 105 https://support.plex.tv/articles/categories/player-apps-platforms/windows-mac-desktop/
Inventory (5): Introduction and Installation · Configuration and Usage Options · **Downloads for
Windows, macOS, Linux Desktop** · Desktop App Logs · **Audio Configuration** (=063).
- A fifth client class: a native desktop app distinct from the web app, existing mainly because
  browsers cannot do exclusive audio output or full codec coverage. CanonCore ships web only on the
  desktop and accepts the codec ceiling that comes with it — consistent with direct play only, and
  it is the reason the format question at 091 matters.
- **ABSENT**: audio device configuration (=063), which needs a native player. Need: **LOW**.
- **ABSENT**: **a downloads page / release artefacts** — fourth sighting of distribution (045, 058,
  079, 083). Need: **MEDIUM**, folded. (See GAPS.)

## Batch 22 — articles 106–110

### 106 https://support.plex.tv/articles/categories/player-apps-platforms/xbox/
Inventory (7): Settings: Xbox · Xbox One Logs (=005) · Xbox One Controller Mapping (=009) · What
media formats are supported on Xbox · Why can't the Xbox One app find my local server ·
**What information is sent to Microsoft?** · Is Xbox Live Gold required?
- **REFUSED / LOW**: console client, as 099.
- **ABSENT**: **a telemetry and privacy statement.** "What information is sent to Microsoft?" is a
  per-platform disclosure of what leaves the device. CanonCore has no statement about what it
  collects, sends, or phones home to — including the negative statement, which is the one worth
  making: self-hosted software that says plainly "no analytics, no crash reporting, no update ping"
  is making a claim its users will check. It also is not quite true by default: every provider
  fetch reveals the instance's IP to a third party, and the artwork question at 110 means the
  *browser* may be revealing the visitor's IP to TMDB on every page. Need: **MEDIUM**. (See GAPS.)

### 107 https://support.plex.tv/articles/categories/plex-media-server/
**The server capability inventory: nine subcategories, 115 articles.** Installation and Basic Setup ·
Libraries · Server Settings · Scanners & Agents · Direct Play/Direct Stream/Transcoding · NAS
Devices · NVIDIA SHIELD · FAQ & Troubleshooting · Advanced Topics.
Named capabilities, with the ones absent from CanonCore in bold:
- Install/setup: Overview · Installation · **Basic Setup Wizard** · Uninstall · **Dynamically
  Updated Server Components** · Server Logs.
- Libraries: Library Actions · Creating · Editing · Deleting · **Scanning vs Refreshing a Library** ·
  Matching Process · **Emptying Library Trash** · **Analyze Media** · **Monitoring Library
  activity** · **Migrating a TV library to the new Agent/Scanner** · Advanced Settings TV Agent
  (=061) · **Publishing Collections** · **Manage Recommendations** · **Upgrading an Old Movie
  Library** · Advanced Settings Movie Agent (=062) · Collections.
- Server Settings sections: General · Remote Streaming · Optimized Versions · Agents · Library ·
  Network · Transcoder · **Languages** · **DLNA** · **Scheduled Tasks** · **Extras** ·
  Troubleshooting.
- Scanners & Agents: Scanners · Metadata Agents · Using NFO Metadata Files · **Match Hinting for TV
  Series**.
- **ADOPTED**: library CRUD maps to group CRUD; Matching Process maps to the matching/applying
  split; Collections map to containers. NFO files are explicitly **REFUSED** by the prompt.
- **ABSENT, and the most concrete gap in the whole shard**: **Analyze Media**, i.e. where duration
  comes from. The prompt's completion rule is "TIME REMAINING under a small absolute figure, not a
  percentage", with "Percentage is the fallback only where duration is unknown". Duration is
  therefore load-bearing. But there is no ffmpeg, no analysis pass, and artwork aside, a private
  instance may have no provider connected at all. Nothing in the design produces the number the
  primary completion rule consumes, so the fallback is not a fallback — it is the default. Need:
  **HIGH**. (See GAPS.)
- **ABSENT**: **Scheduled Tasks**, and this one is forced by the stop condition. Condition 1 requires
  TMDB "with the attribution string and the **six-month cache rule** honoured". Honouring a cache
  expiry requires a scheduled job and a cache with timestamps, and the prompt provides neither — it
  mentions periodic scans once, without a scheduler, and mentions no other recurring work
  (projection reconciliation, provider cache expiry, review-queue upkeep). Need: **HIGH**.
  (See GAPS.)
- **ABSENT**: **Emptying Library Trash / what happens when a file disappears.** Plex needs a trash
  state because a Plex item cannot exist without a file, so a vanished file must eventually take the
  item with it. CanonCore's answer should be strictly better — items are media-independent, so a
  missing file tombstones the *file* and leaves the item standing — and the prompt never says it.
  Together with the unanswered "what may a re-scan change" from 002, this is one gap, not two:
  **the scanner's write semantics are undefined**. Need: **HIGH**. (See GAPS.)
- **ABSENT**: **Scanning vs Refreshing.** Two distinct operations — find new files, re-fetch
  metadata — that Plex separates in the UI and documents together because users conflate them.
  CanonCore separates them structurally (the scanner and enrichment are different subsystems) and
  never names either operation to the owner, nor says which one the periodic run performs. Need:
  **MEDIUM**. (See GAPS.)
- **ABSENT**: **DLNA**, and this needs stating carefully so it is not read as re-arguing a closed
  decision. The prompt settles the *apps* question and forbids reopening it. It does not address
  shipping a **read protocol** alongside them, yet it supplies the evidence for one itself: across
  ten comparable projects "the highest-leverage client work by a wide margin was implementing an
  EXISTING CLIENT PROTOCOL", with Komga/OPDS and Navidrome/Subsonic as the worked cases. DLNA is
  Plex's version. Whether CanonCore ships one is undecided rather than decided. Need: **MEDIUM**.
  (See GAPS.)
- **ABSENT**: **Languages as a settings section**, third axis confirmed (079). Need: **HIGH**,
  already counted.
- **ABSENT**: **Match Hinting** — the owner telling the matcher which external record something is,
  before it guesses. CanonCore has no operator-supplied matching hint and no fix-match. Folds into
  the fix-match gap (073). Need: **HIGH**, already counted.
- **ABSENT**: **metadata-model migration** ("Migrating a TV library to the new Agent/Scanner",
  "Upgrading an Old Movie Library"). Second sighting (073). Need: **MEDIUM**, already counted.
- **ABSENT**: **Monitoring Library activity** — counted with the dashboard (101).
- **REFUSED**: Transcoder, Optimized Versions, Publishing Collections (visibility), Recommendations,
  Agents-as-installed-code.

### 108 https://support.plex.tv/articles/categories/plex-media-server/advanced-topics-plex-media-server/
**The richest ABSENT cluster in the shard.** Nineteen articles, and CanonCore has an answer to
almost none of them:
Advanced Hidden Server Settings · Enable repository updating for Linux (=058) · Mounting NTFS Drives
on Linux · **Linux Permissions Guide** · **Authentication for local network access** · unsigned QNAP
Apps · **Repair a Corrupted Database** · **Backing Up Plex Media Server Data** · **Scheduled Server
Maintenance** · **Move Media Content to a New Location** · **Move an Install to Another System** ·
**Move Viewstate/Ratings from One Install to Another** · Repair a Corrupt Database (1.22.0 and
earlier) · **Restore a Database Backed Up via 'Scheduled Tasks'** · **Restart Setup from Scratch** ·
Gather a Process Dump · **Finding an authentication token / X-Plex-Token** · **Plex Media Scanner
via Command Line** · **Plex Media Server URL Commands**.
- **ABSENT — backup and restore.** Four of nineteen articles. Nothing in the prompt mentions backup,
  restore, or corruption recovery. This matters more for CanonCore than for Plex, and the reason is
  in the prompt's own model: a Plex library is *re-derivable* — rescan the files, re-fetch from the
  agents, and you are nearly whole. CanonCore's value is precisely the part that is **not**
  re-derivable: hand-built placements and their positions, owner statements at rank preferred,
  remembered match rejections, the property catalogue, aliases from merges, and an append-only
  progress log. Losing the database loses the curation, and the files on disk cannot rebuild it.
  Need: **HIGH**. (See GAPS.)
- **ABSENT — an API token.** The prompt keeps the generated "oRPC RPC and OpenAPI handlers behind one
  catch-all route ... yields a free OpenAPI reference" and calls it worth keeping. An OpenAPI surface
  whose only credential is a browser cookie is documentation for something nothing can call. Plex
  ships X-Plex-Token for exactly this. Need: **HIGH**. (See GAPS.)
- **ABSENT — a CLI / headless control surface.** "Plex Media Scanner via Command Line" and "URL
  Commands" are how a self-hosted server is driven from cron, a NAS task scheduler or a script.
  CanonCore has a scanner that must be run periodically and no stated way to trigger it from outside
  a browser. Need: **MEDIUM**. (See GAPS.)
- **ABSENT — a clarification, not a feature.** "Move an Install to Another System" and "Move
  Viewstate/Ratings from One Install to Another" sit against the prompt's "No fork, no export, no
  import, no cross-instance sharing". That refusal is aimed at *sharing catalogue data between
  instances*, and Plex treats moving your own install as a different thing: a backup and restore of
  a data directory, not a content export. Which of the two CanonCore's refusal covers is genuinely
  unclear, and an implementer reading it strictly would refuse to build a database backup. That is
  the wrong outcome from a rule meant to prevent something else. Need: **MEDIUM**, and it is a
  wording fix rather than a build. (See GAPS.)
- **ABSENT — LAN authentication bypass.** Plex ships a setting that lets unauthenticated clients on
  the local network in. Against CanonCore's single password and cookie session this is both tempting
  and dangerous, and the prompt neither offers nor forbids it. An explicit refusal costs one line.
  Need: **MEDIUM**. (See GAPS.)
- **ABSENT — filesystem permissions and mount guidance.** Second sighting (097). Need: **MEDIUM**.
- **DIVERGENT — "Advanced, Hidden Server Settings".** A documented set of unsupported toggles: the
  end state of adding a flag whenever a decision was hard. Explicitly the opposite of how CanonCore
  is to be built, and worth recording as a thing not to copy rather than a gap.

### 109 https://support.plex.tv/articles/categories/plex-media-server/direct-play-direct-stream-transcoding/
Inventory (4): Direct Play, Direct Stream, Transcoding Overview · **Streaming Media: Direct Play and
Direct Stream** · Transcoding Media · Troubleshooting.
- **The distinction this category exists to draw is one CanonCore has not made.** Plex has three
  modes, not two: *direct play* (container and codecs both acceptable, bytes sent untouched);
  *direct stream* (codecs acceptable, container is not — remux the container, re-encode nothing);
  *transcode* (re-encode). The prompt says "Direct play only. No transcoding, no ffmpeg, no quality
  ladders", which bans the third and, via the ffmpeg ban, silently bans the second as well.
- **ABSENT**: **whether remux is allowed.** This is not a hair-split. Remuxing is cheap, lossless
  and near-free in CPU, and it is the difference between an MKV playing in a browser and not
  playing at all. The prompt's own client reasoning turns on exactly this ceiling — "expo-video
  wraps AVPlayer with no MKV, no DTS or TrueHD and no PGS subtitles" is the stated reason the TV
  player must be native Swift. If remux is out, that ceiling applies to the web client too, and
  "the file will not play" will be the answer for a large fraction of a real library on day one.
  If remux is in, the ffmpeg ban needs qualifying. Either answer is fine; the silence is not.
  Need: **HIGH**. (See GAPS.)
- **REFUSED**: transcoding itself, and the entire troubleshooting surface under it — which is the
  payoff. This category plus the Transcoder settings section plus the Media Optimizer category
  plus roughly a dozen FAQ entries are all one feature's support cost, and CanonCore does not pay
  any of it.

### 110 https://support.plex.tv/articles/categories/plex-media-server/faq-troubleshooting/
**48 articles: the support burden, itemised.** Grouped by what they are actually about:
transcoding and CPU (11) · remote access and connectivity (6) · the scanner not finding or
releasing content (5) · Windows-specific install and crash failures (5) · logs and diagnostics (4) ·
data directory size, location and caches (4) · subtitles, thumbnails, theme music, extras (4) ·
platform and hardware specifics (4) · the rest.
Entries that name something CanonCore lacks:
- **"Why am I locked out of Server Settings and how do I get in?"** — **ABSENT**: admin lockout
  recovery. With one password, no signup and no account service, CanonCore's recovery story is
  currently "there is none". A documented offline reset (a CLI command, an env var read once at
  boot) is the standard answer. Second sighting with 059. Need: **MEDIUM**. (See GAPS.)
- **"Why is my Plex Media Server directory so large?"** and **"Where are cached images stored?"** —
  **ABSENT**: **an artwork cache, and the decision not to have one.** The prompt stores artwork as a
  provider URL plus a palette extracted "when the artwork is fetched", with no local image store.
  Two consequences follow and neither is stated: TMDB's six-month cache rule presumes a cache, and
  with none the public demo hotlinks TMDB from the visitor's browser, leaking every visitor's IP to
  a third party on the one surface where CanonCore is a publisher. Need: **HIGH**. (See GAPS.)
- **"Clearing Plugin/Channel/Agent HTTP Caches"** — **ABSENT**: a provider response cache with a
  manual clear. Same gap seen from the other side; folds into the cache decision above.
- **"Why does content I deleted on my drive still show up?"** — the missing-file question again;
  folds into the scanner write-semantics gap (107).
- **"How do I see what is being played by Plex apps?"** — now-playing; counted at 101.
- **"How do I get subtitles to work?"** — **ADOPTED** in part: `files` carry role `subtitle` plus a
  language. **ABSENT**: subtitle *search and download* from an external source, and burn-in (which
  needs a transcode and is therefore correctly out). Need: **LOW-MEDIUM**.
- **"Reporting issues with Plex Media Server"** — **ABSENT**: an issue-reporting path that gathers
  logs. Folds into logging and the security-disclosure gap (081).
- **"Why do I get metadata but no images for my library items?"** — **ADOPTED**: this is precisely
  the state the prompt accepts by design ("a private instance with no provider connected has no
  artwork"). Noting that Plex has a support article for it means users do hit this and complain, so
  the empty state needs to explain itself rather than look broken.
- **"Why are ISO, VIDEO_TS, and other Disk Image Formats Not Supported?"** — **ADOPTED** in spirit:
  a plainly documented format refusal, which is what "say so plainly" looks like written down.
- **"What are video preview thumbnails?"**, **"How do I add theme music?"**, **"Skip TV Show
  Intros"** — **REFUSED**: all require decoding media.
- **"Platforms no longer supported by Plex Media Server"** — **ABSENT**: a deprecation policy.
  Folds into system requirements (085). Need: **LOW**.
- **"Does the computer have to stay running?"**, **"What network ports do I need to allow?"** —
  documentation, folds into remote access. Need: **LOW**.
- The distribution of this list is itself the finding, and it is a favourable one: **roughly a
  quarter of Plex's entire FAQ burden is transcoding**, a feature CanonCore refuses outright, and
  another eighth is remote access, which CanonCore intends to document rather than implement. The
  residue that genuinely applies is the scanner, logs, backups and the data directory — which is
  exactly where this sweep's HIGH-rated gaps have landed.

---

# GAPS — ABSENT FROM CANONCORE

All 110 URLs in shard `plex-support-ac` are covered above. Five were dead (015, 051, 076, 077,
078). This section consolidates only the **MEDIUM** and **HIGH** absences; LOW ratings, everything
classified ADOPTED, REFUSED or DIVERGENT, and duplicate sightings of the same gap stay in the
per-article notes.

Nothing here contradicts a closed decision. Where an entry touches something the prompt settles —
transcoding, multi-user, visibility, the client order — it is recorded as the *consequence* of that
decision that is not yet written down, never as a proposal to reopen it.

Deduped, the sweep produces **21 HIGH clusters** and **13 MEDIUM themes**.

## HIGH

**H1 · Technical metadata on a file, and the analysis stage that produces it.**
(023, 044, 048, 054, 056, 107)
`files` carries identity, path and role and nothing about content — no duration, codec, container,
resolution, channel count or subtitle format. Duration is load-bearing three times in the prompt:
completion is "TIME REMAINING under a small absolute figure", force-complete is "anything under five
minutes", and percentage is the fallback "only where duration is unknown". With no ffmpeg, no
analysis pass and possibly no provider connected, nothing produces it — so the fallback is the
default and the primary rule never fires. Plex separates scan (identity, path) from **Analyze
Media** (codec, duration, streams) as two pipeline stages with separate logs; CanonCore has only
the first. This is the single most concrete gap in the shard.

**H2 · Is remux allowed?** (109)
Plex has three modes, not two: direct play, **direct stream** (rewrap the container, re-encode
nothing), and transcode. "Direct play only. No transcoding, no ffmpeg" bans the third explicitly and
the second by side effect. Remux is cheap, lossless and is the difference between an MKV playing in
a browser and not playing at all — and the prompt's own client argument turns on that exact ceiling
("expo-video wraps AVPlayer with no MKV"). Either answer is fine; the silence is not.

**H3 · The client capability profile.** (023, 048, 091)
"When a file will not play, say so plainly" requires knowing, before play, what the client can
decode. There is no mechanism for a client to declare that and no server-side matrix. Plex publishes
a per-platform format table for every one of its fifteen clients precisely because direct play makes
this the user's first question.

**H4 · A scheduler, and one named maintenance window.** (024, 046, 050, 052, 065, 107)
Forced by the stop condition itself: condition 1 requires TMDB "with the attribution string and the
six-month cache rule honoured", and honouring an expiry needs a scheduled job. The prompt mentions
periodic scans once, with no scheduler, and names no other recurring work — projection
reconciliation, provider re-enrichment, cache expiry, hashing, palette extraction. Plex's shape is
worth copying: one window, one setting, and a per-pass policy of `never | scheduled | scheduled and
on add`.

**H5 · A provider response cache and an artwork cache — or the explicit decision to have neither.**
(042, 110)
Artwork is "Provider-supplied URL" with a palette "extracted when the artwork is fetched", so
something fetches images and the prompt never says whether the bytes are kept. If not: TMDB's
six-month cache rule has nothing to expire, and the public demo hotlinks TMDB from each visitor's
browser, leaking every visitor's IP to a third party on the one surface where CanonCore is a
publisher. If so: there is an unbudgeted, unbounded on-disk image store with no eviction rule.

**H6 · Backup, restore, and a named server data directory.** (040, 053, 108)
Nothing in the prompt mentions any of the three. This matters more here than at Plex, and the reason
is in the prompt's own model: a Plex library is re-derivable from files plus agents. CanonCore's
value is exactly the part that is not — hand-built placements and their positions, owner statements
at rank preferred, remembered match rejections, the property catalogue, merge aliases, and the
append-only progress log. Losing the database loses the curation, and the files cannot rebuild it.
Plex spends four of nineteen Advanced Topics articles here.

**H7 · The scanner's write semantics.** (002, 107, 110)
Two unanswered questions that are one gap: **what may a re-scan change on an already-known file**,
and **what happens when a file disappears from disk**. The right answer to the second looks better
than Plex's — items are media-independent, so a vanished file should tombstone the *file* and leave
the item standing, where Plex must eventually take the item with it — and it is not written down.

**H8 · Does "Delete permanently" touch the bytes on disk, and what cleans up the derived rows?**
(020, 053, 081)
The DELETE section is precise about the catalogue and silent about the filesystem; the only rule
covering writes ("The scanner NEVER writes storage") is scoped to the scanner. It is equally silent
about everything derived from a deleted row: the read projection, artwork rows and any cached bytes,
the ancestor closure, statements whose subject placement is gone. Plex needs both a support article
and a server-level "allow media deletion" toggle.

**H9 · First run: how the one `owners` row comes to exist.** (031, 043, 082)
"ONE row. Single user, one password, no signup" never says how the password is first set, or what an
instance does between `docker run` and the owner existing. An instance reachable before a password
exists is claimable by whoever gets there first — the "unclaimed media server" problem Plex manages
with a claim token. The second half is softer but real: with providers all disabled by default, no
seed data, no artwork and no scanner root, a correct fresh install is a blank page.

**H10 · Authentication beyond a browser cookie.** (007, 059, 108)
Three consumers need one and none is served. The committed Expo and Swift clients cannot hold a
cookie session; a tvOS client cannot reasonably have a password typed into it (Plex's answer, a
short link code entered in the web app, is cheap and already known); and the OpenAPI reference the
prompt deliberately keeps is documentation for something nothing can call without a token.

**H11 · An owner-preferences store and a settings surface.** (018, 080, 091, 101)
The prompt names at least seven values as tunable — both enrichment thresholds, the source order,
the edition order, the completion threshold, scanner roots, the scan interval — and gives none of
them a place to live or a way to edit them. `owners` is described purely as an identity row. Plex
additionally shows this has two scopes, server and client, which are different sets.

**H12 · Language, on three axes.** (061, 079, 107)
(i) metadata language — TMDB returns a title in thirty languages, and under "A field can hold
SEVERAL VALUES AT ONCE" they are all live, all competing for one favourite, with the source order
unable to separate them because they came from one source; (ii) playback track language — which
audio and subtitle sidecar opens by default, where the data exists and the rule does not; (iii) UI
language. The prompt does not contain the word. Language is the obvious `statement_qualifiers` use
and is never named as one. Plex ships Languages as a top-level settings section.

**H13 · Correcting a wrong match, and hinting one before it is made.** (073, 107)
Matching, applying, thresholds, a review queue and remembered rejections are all specified. The
operation on an item that matched *above* the high bar and matched **wrongly** is not — and that
item now silently carries another work's statements. The prompt's own justification for requiring
`lookup` is this exact failure. Plex ships Fix Match per media type plus filename Match Hinting.

**H14 · Conflict as a first-class, surfaced, resolvable object.** (049)
The review queue is only ever described as holding match uncertainty. The prompt names four other
conflicts the model guarantees and gives none of them a home: two providers disagreeing on a
single-cardinality field, a placement gone stale after a container was re-derived (called "a
curation fact for the review queue" and never followed through), a property tightened with existing
offenders, and a quarantined vocabulary value.

**H15 · A "what is the server doing" surface, and one-click diagnostics.** (013, 018, 053, 101)
Four long-running background processes are committed to — scanner, enrichment, projection rebuild,
hashing — with no queue, status, progress, cancel or history. The logging gap seen at 005/014/029/
037/040 closes here into something buildable: one page with a download-logs button producing one
shareable archive, plus a list of every long-lived derived artefact the server maintains.

**H16 · Reading the watch event log, and how much of it there is.** (060)
The append-only log is justified because "The event log is what makes re-watches real", and the only
reader named anywhere is the state row behind Continue Watching. No history view, no "when did I
last watch this", no re-watch count, no per-item timeline: the product pays the full cost of event
sourcing and spends none of it. Second half, forced by the prompt's own number: "Save every 10
seconds" is 720 writes per two-hour film, and whether those are 720 rows or one moving row is the
difference between 360 rows/hour/viewer and 1.

**H17 · Playlists, the play queue, post-play and next-up.** (021, 032, 034, 066, 071)
Four related absences. A playlist may well *be* an ordered container — an elegant answer the prompt
does not give — but a play queue (editable during playback), a post-play screen, and On Deck (the
next unwatched item, distinct from Continue Watching) are not containers. Under multi-placement
"what comes next" is genuinely ambiguous — next in *which* ordering? — which makes this a design
question the model raises and does not answer.

**H18 · Bulk operations.** (017)
No multi-select, no "apply to all matching", no bulk enrichment target, no bulk placement. The
stress-test archive has 11,285 stories, 93.4% of them multi-placed.

**H19 · Distribution: the artefact a user runs, and how it updates.** (025, 058)
Exhaustive on the monorepo, the scaffold, its five defects and the pnpm catalog; silent on the
container image, the port, the process topology, the release channel, signing and the update path.
"It is SELF-HOSTED software" is the product's first sentence about itself.

**H20 · Accessibility.** (064)
No statement, no keyboard-navigation commitment beyond "Every accelerator has an equivalent visible
UI path", no screen-reader posture, no contrast rule — the last notable because the palette is
extracted from artwork and presumably drives UI colour. The prompt already commits to design tokens
as plain TypeScript from the first commit *because* such things are expensive to retrofit; this is
in the same class, across three clients.

**H21 · A contradiction, not just a gap: the SEF boundary versus the first provider.** (026)
The Safe External Fetch boundary must "deny localhost, RFC1918, link-local"; the first provider is
"ONE service, run on a machine the owner controls", which on any normal home network has an RFC1918
address. As written, the boundary blocks the provider the stop condition requires. Needs an explicit
carve-out with its own rule, not an exception someone adds under pressure.

## MEDIUM

**M1 · Reaching the instance: TLS, discovery and remote access.** (004, 012, 015, 016, 028, 074,
082, 096) — no inbound-TLS story (the SEF rule is outbound only), no LAN discovery, no manual-address
concept, and no stated posture on port forwarding, reverse proxies or Tailscale. Plex spends a
five-article category plus a dedicated troubleshooting guide here. The likely answer is "documented,
as rclone is documented", and that needs writing down before someone builds a relay.

**M2 · Logging detail.** (005, 014, 029, 037, 054) — log levels and a verbose toggle, what logs
contain (Plex frames this as a privacy question), and the time-boxed debug endpoint idea. The
surface itself is H15.

**M3 · Legal and disclosure posture.** (011, 066, 081, 102, 106) — no licence for CanonCore's own
code (load-bearing, since the CMPP store accepts third-party providers), no third-party attribution
page, no security-disclosure path, no telemetry statement. The last is worth making as a *negative*
claim, and it is not quite free: every provider fetch reveals the instance's IP, and H5 may reveal
each demo visitor's.

**M4 · Versioning and the release story.** (035, 036, 042, 045, 057, 079, 083, 085, 096, 105) —
minimum spec and supported platforms, a minimum-version handshake between server and client, release
notes, release channels, update checking, downgrade/rollback, deprecation policy, a downloads page.
Note the favourable half: with no transcoding, CanonCore's requirements page is Postgres, Node and a
readable path, where Plex's exists almost entirely to discuss transcoding headroom.

**M5 · The filesystem contract.** (002, 041, 097, 108) — the process identity and read permissions
for media it does not own (the second-commonest self-hosting failure after remote access), network
and NTFS mount guidance, read-only versus writable roots, and whether embedded media tags
(ID3/Vorbis/MP4 atoms) are read at scan time. The last matters because with no provider connected
and `.nfo` refused, embedded tags are the only metadata that exists.

**M6 · Provider operations.** (044, 055, 073, 086, 107) — per-provider diagnostics ("why did this
one return nothing?"), a user-visible metadata-model migration when a field set or vocabulary
changes, importing an existing catalogue from another tool, an offline/no-internet mode, and naming
"scanning versus refreshing" as two operations the owner can tell apart.

**M7 · Account and session residue.** (020, 059, 063, 079, 091, 108, 110) — 2FA, session revocation
and a device list, password reset, admin-lockout recovery (currently "there is none"), an explicit
refusal of a LAN authentication bypass, a destructive-actions master switch, and client-scoped
settings as a distinct scope from server settings.

**M8 · Playback and file residue.** (010, 064, 070, 082, 091) — a track-purpose value on sidecars so
an audio-description track is distinguishable from a second dub (the cheapest accessibility win
available), a per-client format statement, offline downloads, and subtitle sourcing.

**M9 · Browse and UI residue.** (010, 017, 047, 061, 062, 065, 091, 101) — pinning and hand-ordering
favourite containers, rule-derived containers reacting to progress (an "unwatched" predicate),
collapsing a degenerate hierarchy level, auto-created containers with a size threshold that does not
retro-apply, explaining why an action is unavailable, extras and trailers, and a server
status/dashboard view.

**M10 · Interop and headless control.** (066, 074, 107, 108) — a CLI or URL-triggered control
surface (a scanner that must run periodically has no non-browser trigger), webhooks, Single Item
Access as a capability URL on the existing public read path, and DLNA. On the last: the prompt
closes the *apps* question and forbids reopening it, but shipping a read protocol alongside them is
undecided rather than decided, and the prompt supplies the evidence for one itself (Komga/OPDS,
Navidrome/Subsonic). Note that Single Item Access, casting and a cast receiver all want the same
missing primitive — a short-lived capability URL on the playback route.

**M11 · Localisation of the UI.** (079) — no i18n, and no statement that English-only is deliberate.
Same retrofit-cost class as the design tokens the prompt already front-loads.

**M12 · Uninstall, and what an install puts on disk.** (081) — the readable half of H6: what to
remove, and where it was.

**M13 · A resource budget for background work.** (051) — hashing, palette extraction, enrichment and
projection rebuilds all compete with serving pages, and no ceiling of any kind is stated.

## One favourable finding, recorded because the sweep is otherwise a list of holes

The 48-article FAQ category (110) and the 115-article server category (107) are an itemised support
burden, and roughly a quarter of it is transcoding — a feature CanonCore refuses outright — with
another eighth remote access, which it intends to document rather than implement. Two further
categories (Media Optimizer, Direct Play/Direct Stream/Transcoding) plus the Transcoder settings
section are the same feature's cost again. Separately, four articles across two categories exist
only because Plex computes the exact file-identity hash CanonCore uses and then does not use it to
relink moved files. The residue that genuinely applies to CanonCore is the scanner, logs, backups
and the data directory — which is precisely where the HIGH ratings above have landed.

STATUS: complete
