# Sweep: Plex support articles (shard plex-support-aa, 110 URLs)

STATUS: complete

All 110 URLs in `shards/plex-support-aa` covered, in order, one entry each.

Method: every URL fetched with `curl` — most via the `r.jina.ai` text proxy, the last
batch (106-110, plus a re-fetch of 037) direct from `support.plex.tv`, which answers
plain requests with HTTP 200. Each article recorded with the capability it documents,
any concrete rule/limit/default, and a classification against `prompt.md`:

- **ADOPTED** — prompt already has this, or an equivalent.
- **REFUSED** — prompt explicitly rules it out (WHAT NOT TO BUILD / STANDING RULES).
- **DIVERGENT** — prompt knows about it and deliberately does something else.
- **ABSENT** — prompt says nothing at all. Rated LOW / MEDIUM / HIGH need.

Consolidated gaps at the end, MEDIUM and HIGH only.

---

## Articles

### 001 — https://support.plex.tv/
Support portal landing page. No product capability. Community forums, status page, billing.
**ABSENT** — self-hosted software still needs a documented status/release-notes channel. **LOW** (not a product capability; a project-website concern outside the repo).

### 002 — https://support.plex.tv/41398-2/
Empty/stub page. No content. **N/A**

### 003 — https://support.plex.tv/articles/
Article index. Reveals Plex's own top-level capability taxonomy: Intro to Plex / Player Apps and
Platforms / Plex Media Server / Features / Your Media / Online Media Sources.
Note the sixth category: **Online Media Sources** — catalogue content that is not the owner's files
at all. **ABSENT** from the prompt as a concept (prompt has providers = metadata only, never
content sources). **LOW** — CanonCore is deliberately a catalogue of references, and "a source is a
reference" already covers the case without a separate online-source subsystem.

### 004 — https://support.plex.tv/articles/115002178853-using-hardware-accelerated-streaming/
Hardware-accelerated transcoding (Intel Quick Sync etc.). Premium-gated.
Rule: "Hardware-accelerated streaming is a premium feature and requires an active Plex Pass subscription."
**REFUSED** — "No transcoding, no ffmpeg, no quality ladders."

### 005 — https://support.plex.tv/articles/115002267687-webhooks/
Outbound webhooks on server events. Event taxonomy is the useful part:
`library.on.deck`, `library.new`, `media.pause`, `media.play`, `media.rate`, `media.resume`,
`media.scrobble`, `media.stop`, `admin.database.backup`, `admin.database.corrupted`, `device.new`,
`playback.started`. Rule: "media.scrobble – Media is viewed (played past the 90% mark)."
Payload has five parts (top-level / Account / Server / Player / Metadata); "the owner ID will always be 1."
Two findings:
1. **Webhooks / outbound event notifications** — **ABSENT**. **MEDIUM** — self-hosters wire media
   servers into home automation and notification stacks, and CanonCore already stores an append-only
   watch-event log, so an outbound hook is a small addition on an existing seam; but nothing in the
   stop condition needs it.
2. **A 90% scrobble threshold** — **DIVERGENT**, and CanonCore is right: the prompt explicitly
   rejects percentage completion in favour of time-remaining, citing exactly this failure.
3. `admin.database.corrupted` as a first-class notifiable event — see 080.

### 006 — https://support.plex.tv/articles/115002453214-android-auto/
Android Auto music playback. Rule: "Android Auto has a limit of 4 presses before it will pause touch
input" — hence "disallowing server selection and combining all music libraries into a single 'Artists'
library". Video is refused outright while driving.
**ABSENT** — in-car / constrained-surface clients. **LOW** — prompt scopes clients to web, then phone,
then TV, explicitly. Worth noting the *shape* though: Plex collapses its typed libraries into one
combined browse when the surface is constrained, which is what CanonCore's non-partitioning groups
give for free.

### 007 — https://support.plex.tv/articles/115002845013-settings-xbox/
Per-client settings inventory (one platform). Notable settings that are *product concepts*, not chrome:
Cinema Trailers (count before a movie), Screen Saver timeout, Auto Play with countdown on Post Play,
Play Theme Music while browsing, Background Style (Blur/Dim), Subtitle Colour (5 values) and Size
(Tiny/Small/Normal/Large/Huge), Burn Subtitles (Always / Automatic (default) / Only image formats),
Allow Display Mode Switching (refresh-rate matching), Allow Direct Play, Allow Direct Stream,
H264 Maximum Level, Manual Servers (IPv4 + port), Allow Fallback to Insecure Connections
(Never (default) / On same network as server / Always).
- Transcoding/direct-stream settings: **REFUSED** (direct play only).
- **Subtitle appearance settings (colour, size)** — **ABSENT**. **MEDIUM** — the prompt models
  subtitle *files* (files.role = subtitle, sidecar + language) but says nothing about how a renderer
  presents them; a player that cannot resize subtitles is unusable for many people.
- **Auto Play / post-play next-item countdown** — **ABSENT**. **MEDIUM** — for an ordered container
  the "what plays next" question is exactly the multi-ordering problem, and CanonCore's answer is
  non-obvious (next in *which* ordering?). See GAPS.
- **Theme music, cinema trailers, screensaver** — **ABSENT**, **LOW** (ambience features).
- **Per-client settings store at all** — **ABSENT**, **MEDIUM**; see GAPS (device/client registry).

### 008 — https://support.plex.tv/articles/115003944134-removing-commercials/
Commercial detection/removal on DVR recordings, via bundled comskip. Rules:
"the feature is disabled by default"; "a 30-minute recording take 2-4 minutes to process";
three-valued setting "Disabled / Detect and delete commercials / Detect commercials and mark for skip";
destructive mode warned against because "detection isn't always perfect".
**REFUSED by implication** — no transcoding, and the scanner "NEVER writes storage".
The transferable idea is *marked intervals inside an edition that a player can skip*
(intro/credits/ad markers). **ABSENT**. **MEDIUM** — CanonCore already has `edition_coverage` as a
set of intervals, so a second interval kind (skippable regions) is a near-free shape, and
skip-intro is table stakes in this category now.

### 009 — https://support.plex.tv/articles/115006771007-install-plex-media-server-on-a-terramaster-nas/
Vendor-specific NAS install steps. Capability: packaged distribution per NAS platform.
**ABSENT** — packaging/distribution story. **MEDIUM** — self-hosted software that ships no container
image or install path is not actually self-hostable; the prompt specifies the stack in detail and the
deployment artefact not at all. See GAPS.

### 010 — https://support.plex.tv/articles/115006976408-opening-a-local-video-file-mobile/
Playing an ad-hoc local file on a mobile device, outside any library. Includes an **Unmatch** action
and a note: "matching is automatic. Manually correcting a match (Fix Match) is not currently
available for local video files."
**ABSENT** — playing a file that is not catalogued. **LOW** — CanonCore's whole premise is the
catalogue; an uncatalogued file has no item, no edition and no progress row to hang on.
Also confirms Plex's own split of Match / Unmatch / Fix Match as three distinct operations, which
maps onto CanonCore's separate match-vs-apply endpoints (**ADOPTED** in shape).

### 011 — https://support.plex.tv/articles/115007570148-automatically-adjust-quality-when-streaming/
Adaptive bitrate. Rules: "Auto quality will automatically select streaming qualities between 192 kbps
and 20 Mbps"; "Limit Cellular Data ... defaults to 0.7 Mbps"; "After 20-60 seconds, the video will
increase or decrease based on your connection speed"; "Auto quality is only used when the video is
being converted (transcoded)"; "Music does not use auto quality."
**REFUSED** — no transcoding, no quality ladders.

### 012 — https://support.plex.tv/articles/115007577087-devices/
Authorized Devices list on the account: inspect, filter, add (by signing in), remove (red x + confirm),
re-add. "the same device is listed several times ... each different browser you use is a separate instance."
**ABSENT** — device/session registry and revocation. **MEDIUM** — CanonCore has one password and a
cookie session; with no device list the owner cannot see or revoke an active session, which is the
minimum credible answer to "my laptop was stolen". See GAPS.

### 013 — https://support.plex.tv/articles/115007686168-chris-s-staging/
404 / staging stub. No content. **N/A**

### 014 — https://support.plex.tv/articles/115007689648-watching-live-tv/
Live TV from a tuner, plus a Program Guide, plus record-vs-watch. Rules: "Live TV requires the ability
to transcode"; "You cannot initiate a recording of what you're currently watching"; guide access is
granted per Home member through a Restrictions tab ("Allow access to Live TV"); "They do not get
access to DVR scheduling."
**REFUSED** — no transcoding; and a broadcast schedule is not a catalogue of works.
The one transferable idea is *scheduled/forthcoming items that do not yet exist as files* — which
CanonCore already handles better than Plex, since "Items are MEDIA-INDEPENDENT" and
"Unproduced and unreleased works are real and have no edition at all." **ADOPTED**.

### 015 — https://support.plex.tv/articles/200220677-local-media-assets-movies/
Local sidecar assets for movies: artwork, subtitles, extras, read from disk by filename convention.
Concrete rules: supported image formats "jpg, jpeg, png, tbn"; poster basenames
`cover|default|folder|movie|poster`; multiples as `name-X.ext`; clear logo `clearlogo|logo`
("PNG files are recommended ... transparent surrounding area"); fanart basenames
`art|backdrop|background|fanart`, "typically uses a 16:9 aspect ratio"; poster "typically of 1:1.5
aspect ratio"; square art `square|squareArt|backgroundSquare`; subtitles SRT/SMI/SSA(ASS) named
`Name.[Language_Code].ext` where the code is "ISO-639-1 (2-letter) or ISO-639-2/B (3-letter)";
and a `.forced.` infix — "'forced' is a special tag which make the subtitle enabled even if it does
not necessarily follow the rules set in your server's language settings."
Also: "Note: If the language code is not added, Plex apps will show 'Unknown' ... and the automatic
process which determines if the subtitle should be shown or not will not work as intended."
- Artwork from disk: **REFUSED** — "No artwork uploads, no artwork scanning, no `.nfo` reading."
- Local subtitle sidecars: **ADOPTED** — files carry role subtitle, sidecar references the file it
  accompanies plus a language.
- **A language-code standard for sidecars** — **ABSENT**. **MEDIUM**; the prompt says "a language"
  and never says in what notation, and this is a freeze-at-creation decision (see GAPS).
- **A `forced` flag on a subtitle sidecar** — **ABSENT**. **MEDIUM** — forced subtitles are a
  different *kind* of track (foreign-dialogue only), not a preference, and without the flag a player
  cannot make the right default choice.
- **Artwork roles beyond the prompt's four** — see 016.

### 016 — https://support.plex.tv/articles/200220717-local-media-assets-tv-shows/
Same for TV, plus season-level artwork and theme music. Adds two artwork roles the prompt does not have:
**banner** ("wide, short images ... typically uses a 5.4:1 aspect ratio") and **square art**
("the background image used on the details screens of shows on the iOS and Android mobile apps").
Also episode art ("either 4:3 or 16:9"), season posters (`SeasonXX.ext`, `season-specials-poster`),
season banners, and `theme.mp3` per show.
- CanonCore's artwork roles are `poster|backdrop|title-logo|still`. Banner and square are
  **ABSENT** — **LOW** individually, but the real finding is that the role list is closed in the
  prompt with no statement that it is closed, unlike `medium`. Worth an explicit note.
- **Artwork on a container, not just a leaf** (series poster vs season poster vs episode still) —
  **ABSENT**. **MEDIUM**: the prompt never says what an artwork row hangs off. Containers are items
  so `item_id` covers it, but posters differing per *edition* (a remaster's cover) has no home.
  See GAPS.
- **Theme music per series** — **ABSENT**, **LOW**.
- Note the whole article is filename-convention-driven, which CanonCore refuses by design
  ("ORDERING LIVES IN FILENAMES" is reason #2 the product exists). **DIVERGENT, deliberately.**

### 017 — https://support.plex.tv/articles/200241548-scanners/
Scanners: components that decide (a) whether a file belongs in this library and (b) which item it is.
Four broad categories: Videos, TV Shows, Music, Photos. Scanner is chosen per library, changeable
at creation or via Edit > Advanced. Rules: "Video files named like TV episodes (e.g.:
Futurama - s03e07.mp4) are intentionally ignored by movie scanners"; the loose Plex Video Files
Scanner "Does not support stacked content" and "Internet based information will not be fetched";
the music scanner works "by performing acoustic fingerprinting of tracks."
- Typed libraries with typed scanners: **DIVERGENT** — "WHY never typed by medium: a Plex library is
  typed, and that is exactly what stops a container holding mixed media."
- A pluggable/selectable scanner strategy: **ABSENT**, **LOW** (speculative abstraction; prompt says
  choose the simplest implementation).
- **Acoustic fingerprinting / content-based identification** — **ABSENT**. **MEDIUM** — CanonCore's
  file identity is a structural hash (SHA1 of size + first/last 64KB), which answers "is this the
  same file" and never "what work is this"; for music especially, filename matching is far weaker
  than fingerprinting. But it is a provider concern, and the CMPP contract could carry it.
- **Photos as a media type** — **DIVERGENT**: `medium` is closed at `video|audio|text|image`, so
  image is present, but there is no photo-library browsing concept anywhere. Fine.

### 018 — https://support.plex.tv/articles/200241558-agents/
Metadata agents: the enrichment subsystem. This is the closest article to CanonCore's core.
Concrete rules, all of them the exact designs CanonCore names and rejects:
- **Ordered source priority per agent, drag-to-reorder**: "You can adjust the order of the metadata
  sources, which sets their priority ... If a piece of metadata isn't available from your first
  source, then the agent will fallback down the priority list until it finds a source with that
  information." → **ADOPTED in shape, DIVERGENT in behaviour**: CanonCore keeps a single global
  declared source order, but *keeps every value* rather than falling through and discarding losers.
- **Agent is per library**: "Each library has a metadata agent set when it is created." → **DIVERGENT**:
  "A GROUP CHOOSES ITS PROVIDERS; IT DOES NOT RE-RANK THEM. The source order is single and global."
- **Changing the agent is not retroactive**: "Changing the metadata agent for an existing library will
  only affect future content. It does not retroactively change the agent used for existing library
  content." And separately, "If you adjust the agent settings here and wish for the changes to apply
  to existing library content, you must Refresh All Metadata." → **DIVERGENT and better**:
  "re-ordering the source list re-picks the whole catalogue at once."
- **Per-source options behind a gear icon**: "Some metadata agent sources have preferences you can set."
  → **ABSENT**: CMPP has no notion of provider-declared configuration options. **MEDIUM**; see GAPS.
- **A local/embedded metadata source ranked among the online ones** (Local Media Assets, recommended
  topmost) → CanonCore's equivalent is the Owner sitting first in the source order. **ADOPTED**.
- Legacy-agent deprecation with a `Show Legacy Agent during library set up` toggle → **REFUSED** by
  "Do not preserve backward compatibility."

### 019 — https://support.plex.tv/articles/200250357-languages/
Server-level audio and subtitle language preferences. Rule: "These settings only affect the
owner/admin account ... Shared users will need to [set] Account Audio/Subtitle Language Settings in
their account profile."
**ABSENT** — no language preference of any kind in the prompt. **MEDIUM** — with per-file subtitle
and audio sidecars in the model and no preferred-language setting, the player has no rule for which
track to select, and the owner re-picks manually on every play. See GAPS.

### 020 — https://support.plex.tv/articles/200250377-transcoding-media/
Transcoding explained. Rules: temp storage "By default, the temporary files are stored on the OS boot
disk ... can use gigabytes of temporary storage"; CPU over RAM for transcode throughput.
**REFUSED** — "Direct play only. No transcoding, no ffmpeg, no quality ladders. When a file will
not play, say so plainly."

### 021 — https://support.plex.tv/articles/200250387-streaming-media-direct-play-and-direct-stream/
Three playback outcomes: Direct Play / Direct Stream / Transcode. Direct Play requires compatible
container, bitrate, codecs, resolution.
The load-bearing paragraph for CanonCore is **Multi-version media**: "When playing content, the Plex
App will use a series of heuristics to determine which file version to play. The decision may include
things like connection type, resolution, device audio configuration, device capabilities, and more."
**DIVERGENT, and the prompt already names this**: "Plex merges versions but its automatic pick is
about what the client can decode, not about which is canonical." CanonCore picks by `is_default` pin,
then a declared edition order.
Also: "if a subtitle stream is selected and is not compatible with the Plex App, then the Server will
'burn in' the subtitle text within the video. This requires a full transcode of the video stream."
→ **direct-play-only means CanonCore cannot burn in subtitles**, so the client must render every
subtitle format it offers. **ABSENT** as a stated consequence. **MEDIUM** — it constrains which
subtitle formats can be listed as playable at all (image-based PGS/VOBSUB effectively cannot be), and
the prompt's "when a file will not play, say so plainly" needs to extend to tracks, not just files.

### 022 — https://support.plex.tv/articles/200250417-plex-media-server-log-files/
Server logging and a one-click log bundle: "Go to Settings > Manage > Troubleshooting ... Click the
Download Logs button". Per-platform log locations; plugin logs excluded from the zip.
**ABSENT** — no logging, diagnostics or support-bundle story anywhere in the prompt. **MEDIUM** —
self-hosted software is debugged by its owner and by strangers in a forum, and a downloadable log
bundle is the single highest-leverage support affordance in this category. See GAPS.

### 023 — https://support.plex.tv/articles/200264746-quick-start-step-by-step-guides/
First-run flow. Rules: "Plex Media Server does not have its own graphical user interface ... you use
our web app to manage your server"; five library types (movies, TV shows, music, photos, other videos);
default web port 32400 at `/web`; "Video content purchased from online stores such as iTunes, Google
Play, or Amazon will typically be protected by DRM ... and cannot legally be played in other systems
such as Plex."
- Headless server + web admin UI: **ADOPTED** in effect (web is Next.js, now).
- **First-run / setup flow** — **ABSENT**. **MEDIUM**: the prompt says "Single user, one password, no
  signup", which leaves undefined how that password is first set on a fresh install, and "A fresh
  install by anyone else starts EMPTY". See GAPS.
- **DRM'd files** — **ABSENT**, **LOW**; direct play simply fails and the prompt already says to say so.

### 024 — https://support.plex.tv/articles/200264956-iso-img-and-video-ts-movie-files/
A flat capability refusal, published as an article: "Plex does not support the use of ISO, IMG,
Video_TS, or other 'disk image' formats."
**ADOPTED in spirit** — CanonCore's "When a file will not play, say so plainly" is the same posture.
**ABSENT**: a declared list of what the scanner accepts. **MEDIUM** — "The scanner takes media files
and playback sidecars, and nothing else" names no extensions, and a disk image is precisely the case
where one file is really a container of many, which the file-identity hash cannot see.

### 025 — https://support.plex.tv/articles/200265246-personal-media-movies/
Home videos: content that exists in no online database. "The media can be named any way you like. The
name of the file is what will appear in the Plex App." Embedded metadata (MP4/M4V/MOV) used via the
Local Media Assets source.
**ADOPTED** — CanonCore handles this natively: the Owner is a first-class source, items are
media-independent, and a group that connects no providers is a valid configuration.
Embedded-metadata reading is **REFUSED** in the artwork case and unstated for other fields; the
scanner "takes media files and playback sidecars, and nothing else", which reads as refusing embedded
tag reading too. Worth confirming rather than leaving to inference — see GAPS (embedded tags).

### 026 — https://support.plex.tv/articles/200265256-naming-home-series-media/
Forcing personal media into the show/season/episode shape so it can be grouped: "you must make a 'TV'
Library, not a 'Home Videos' Library". Rule/defect: "Currently, the 'shows' will only be named as
'Episode 1' etc. Any additional information included in the filename (like 'Getting Ready') is
currently ignored."
**DIVERGENT — this article is a direct advert for CanonCore.** The user wants an arbitrary ordered
grouping and Plex makes them impersonate a TV series to get it, then loses the titles. CanonCore's
answer is a `work` container with `is_ordered`, no medium typing, and titles as columns.

### 027 — https://support.plex.tv/articles/200265296-adding-music-media-from-folders/
Music library organisation. Rules: `Music/ArtistName/AlbumName/TrackNumber - TrackName.ext`;
"For albums that span more than one disc, you simply prepend the disc number to the front of the
track number. So, track two on disc three would be 302 - TrackName.ext";
"The 'Album Artist' for each track should be the literal Various Artists"; "we also make use of sonic
fingerprinting"; "Using a flat file list of tracks can result in failures".
- **Multi-disc position (disc + track, one composite number)** — CanonCore's `placements.position` is a
  single scalar. **ABSENT** as a stated case. **MEDIUM**: the model *can* express it (disc is a
  container inside the album container), but it can also be expressed as 301/302 in one flat container,
  and two implementers will pick differently. This is the same class of decision as `release_date`,
  which the prompt says to define for exactly this reason. See GAPS.
- **Album Artist vs Artist (a role distinction on a relationship)** — **ADOPTED**: statements carry
  properties, so `performed_by` and `album_artist` are two properties, and `statement_qualifiers`
  covers context.
- "Various Artists" as a magic literal entity — **DIVERGENT**: "ENTITY IDENTITY IS A SURROGATE ID
  with external-id mappings, NEVER A NAME."
- Sonic fingerprinting — see 017; **ABSENT**, **MEDIUM**.

### 028 — https://support.plex.tv/articles/200274018-description/ (Subtitles: Description)
Three subtitle sources: embedded in the file, external files, "Subtitles fetched automatically by the
Plex Media Server via subtitle Agents" (OpenSubtitles.org by default).
Selection algorithm, verbatim: preference is expressed as a *language* for audio and for subtitles;
"If the media file has a German external or embedded subtitle file, Plex will play that"; else fetch
from the internet; "If no external, embedded or matching internet based subtitle file with the correct
language is found, subtitles won't be played."
Timing rule: "These steps are only performed when the media is scanned into your library or when being
force refreshed. Playing the media will not trigger a search for subtitles."
**ABSENT — and this is the largest single gap in this shard.** A subtitle agent is a provider that
returns a **file**, not a field value. CMPP as specified only lets a provider "propose values for
fields that already exist", and artwork is the single exception (its own table, provider-supplied URL).
A subtitle provider fits neither. **HIGH** — see GAPS.
Also **ABSENT**: audio-track and subtitle-track auto-selection rules of any kind. **MEDIUM**.

### 029 — https://support.plex.tv/articles/200274058-troubleshooting-subtitles/
Failure mode of the above, stated as a defect: "Currently, no error or message is given if a matching
subtitle file isn't found on OpenSubtitles.org. You'll only notice that your preferred language
subtitle isn't available." The remedy is reading a per-agent log file.
**ABSENT — provider failure surfacing.** **MEDIUM/HIGH.** CanonCore says a provider's unmatched
fields are "DROPPED AT THE DOOR AND COUNTED, so the owner is told", which is the right instinct for
*extra* data, but says nothing about the opposite case: a provider that returned nothing, timed out,
rate-limited, or 403'd. The prompt even anticipates a permanent 403 from the wiki. A silent
"found nothing" that is indistinguishable from "was never asked" is exactly Plex's bug here.
See GAPS.

### 030 — https://support.plex.tv/articles/200288286-what-is-plex/
Product overview. Declared format support: "Movies, TV Shows, and Home Video: MP4, MKV, AVI, MOV,
DIVX, and more"; "Music: MP3, M4A, FLAC, WMA, and more"; "Photos: JPG, PNG, RAW, TBN, and more".
Five library types; the "one place to find and access all the media that matters to you" framing.
Also names the feature set Plex sells: tracking what you watch, remote access, offline downloads,
parental controls, DVR.
- The one-place framing: **ADOPTED**, and CanonCore goes further (one place *without* typed libraries).
- **A declared supported-format list** — **ABSENT**, **MEDIUM** (see 024; direct-play-only makes the
  answer client-dependent, which is itself a thing to state).
- **Parental controls / content ratings as a restriction** — **REFUSED**: "No visibility system."
- **Offline download / sync to device** — see 076.

### 031 — https://support.plex.tv/articles/200288586-installation/
Install per platform (Windows/macOS/Linux/NAS/Docker), default port **32400** at `/web`, and an SSH
tunnel recipe for first-time remote setup. Constraint: "You'll need to be sure to run your Plex Media
Server on a filesystem that allows symlinks/hardlinks."
Windows quirk: the install path is remembered in a registry key
`HKEY_CURRENT_USER\Software\Plex, Inc.\Plex Media Server\InstallFolder` and must be deleted by hand
to reset it.
**ABSENT** — install/packaging (again; see 009). **MEDIUM**. Also **ABSENT**: a stated filesystem
capability requirement. **LOW** — CanonCore never writes storage, so it needs read only, which is a
weaker requirement than Plex's and worth writing down as a positive.

### 032 — https://support.plex.tv/articles/200288596-linux-permissions-guide/
A full chmod/chown/chgrp tutorial, published because the #1 Linux support issue is Plex not being able
to read the media. Rule: "The Plex Media Server runs as the user 'plex' by default. The plex user must
have read and execute permissions to your media directories and files!"
**ABSENT** — the prompt says "Build against a FILESYSTEM PATH" and nothing about the process identity
or what happens on EACCES. **MEDIUM** — a scan that silently skips unreadable directories is the most
common self-hosting failure in this whole category, and the fix is small: count and report skipped
paths, the same "dropped at the door and counted" discipline the prompt already applies to fields.
See GAPS.

### 033 — https://support.plex.tv/articles/200288597-fetching-internet-sourced-using-your-own-subtitle-files/
Automatic subtitle fetch. **The key rule, verbatim**: "The server looks for the best match for your
particular media file (using the file hash) and preferred language."
Also an **On-Demand Subtitle Search** inside the player app (a user-initiated search at play time,
distinct from the scan-time fetch), and a caveat that OpenSubtitles fetching "only works with the
legacy agents ... It will not work with Plex Movie or Plex TV Series agents."
- **File-hash-as-external-matching-signal** — **ABSENT and genuinely interesting**. CanonCore already
  computes Plex's exact hash "on every file". The prompt uses it only for move detection, and
  explicitly notes Plex "computes this on every file and then does not use it to relink moves". But
  Plex *does* use it for third-party lookup, which CanonCore's identifier-statement design supports
  natively ("Shared identifiers then become MATCHING SIGNALS between providers"). **MEDIUM** — cheap,
  and it extends matching from works to files.
- The subtitle-provider gap from 028 repeats here. **HIGH**.

### 034 — https://support.plex.tv/articles/200288606-mounting-ntfs-drives-on-linux/
NTFS mounting via ntfs-3g and `/etc/fstab`, written because automount gives the wrong ownership.
**ABSENT** — storage mounting guidance. **LOW** — the prompt already says to "Document rclone and
mergerfs for cloud storage rather than implementing any cloud integration", which is the same
posture; this is documentation work, not product work.

### 035 — https://support.plex.tv/articles/200288666-opening-plex-web-app/
Hosted vs local web app. Two rules worth having:
"When using the hosted Plex Web App, your connection does not go 'through' the plex.tv website.
Communication happens between the browser and Plex Media Server directly."
And: "Starting with Plex Media Server v1.29.2, if your server is unclaimed, using Open Plex… will
initiate the process to claim the server. If you do not wish to claim your server, you have to set
the `enableLocalSecurity` advanced, hidden server setting to false."
- Hosted client against a self-hosted server: **REFUSED** by the prompt's shape (Next.js app in the
  monorepo, served by the instance) and by "It is SELF-HOSTED software, plus ONE public read-only demo".
- **"Claiming" — binding a fresh server to an owner identity, and the unclaimed window before it** —
  **ABSENT**. **MEDIUM**: an unclaimed instance reachable on the LAN with no password is exactly the
  hole the "one password, no signup" model has to close on first boot. See GAPS (first-run).

### 036 — https://support.plex.tv/articles/200288896-basic-setup-wizard/
First-run wizard: account sign-in, **Friendly Name**, remote-access opt-in, then library creation.
Rule: "Friendly Name: The Friendly Name identifies this Plex Media Server on your network ...
Identically named Libraries will be identified by using the Friendly Name ... If you leave this blank,
the computer's network name will be used instead." And: "Items in Home Videos Libraries do not get
artwork and other metadata from internet sources."
- Wizard for *setup* (as opposed to per-item enrichment): the prompt refuses "No enrichment wizard.
  No multi-step per-item flow of any kind" — a setup wizard is a different thing and is **ABSENT**.
  **MEDIUM**, folded into the first-run gap.
- **An instance name** — **ABSENT**, **LOW** in a single-instance world, but the demo and the personal
  instance are two instances of the same software and nothing distinguishes them in the UI.
- "Libraries that never fetch from the internet" — **ADOPTED** as group-chooses-its-providers.

### 037 — https://support.plex.tv/articles/200288916-overview/ (Libraries: Overview)
Five library types, each carrying: media type, file locations, the metadata agent, and the item
metadata. "Libraries currently have one of five types: Movies / TV Shows / Music / Photos / Other Videos."
**DIVERGENT** — the prompt's central refusal: "WHY never typed by medium: a Plex library is typed, and
that is exactly what stops a container holding mixed media."
The type also gates enrichment, which sharpens the divergence: "Items in Home Videos Libraries **will
not download artwork or other metadata from internet sources**." In Plex one typed container decides
medium, scanner roots, agent, *and* whether providers are asked at all. The prompt splits that bundle
deliberately — a group "Scopes browsing, search, WHICH PROVIDERS ARE ASKED, scanner roots, and the
review queue" but is "never typed by medium" — so CanonCore keeps the useful half, provider scoping,
without the partition. **ADOPTED, split apart.**

### 038 — https://support.plex.tv/articles/200288926-creating-libraries/
Library creation options. Three findings.
1. **Language per library, driving provider requests**: "Each library has a language that controls the
   information gathered from the internet. If a library's language is set to French, for example, the
   French plot summary, etc., will be downloaded when available."
   **ABSENT — and this is a contract-shaped gap, not a UI one.** CMPP's search/lookup/browse shapes are
   specified with no locale parameter, so every claim is implicitly in whatever language the provider
   defaults to, and two providers can return the same field in two languages with no way to tell them
   apart or prefer one. **HIGH** — see GAPS.
2. **Visibility toggle**: "This setting determines whether content from this library will be included
   in global search or not. If disabled you can only search the library when in the libraries screens."
   Note this is a *search-scoping* switch, explicitly not an access control. **ADOPTED** — CanonCore's
   groups scope "browsing, search, WHICH PROVIDERS ARE ASKED, scanner roots, and the review queue".
   Not to be confused with the refused visibility system.
3. Multiple content locations per library, consolidated. **ADOPTED** (group-scoped scanner roots).
   Warning worth keeping: "Do NOT use the root of your drive such as D:/ as a folder location."

### 039 — https://support.plex.tv/articles/200289266-editing-libraries/
Editing. Two rules that map onto CanonCore decisions:
- "you can change every setting except the type" — type frozen at creation. Same split CanonCore uses
  for properties ("Datatype and reference target FREEZE at creation"). **ADOPTED in shape.**
- "While you can change the language for a Library, you cannot retroactively update the language used
  for existing items. The new language will only apply to newly-added content." — the same
  non-retroactivity as 018. **DIVERGENT**: CanonCore re-picks the whole catalogue on a source-order
  change, and should do the same for a language change.
- Also a **Delete Preview Thumbnails** button, referencing **Video Preview Thumbnails** (scrubbing
  previews / trickplay, generated per library, deletable per library).
  **ABSENT** — generated derivative assets of any kind. **MEDIUM**: trickplay images are the one
  derivative a direct-play player still wants, and generating them needs ffmpeg, which the prompt
  bans. That is a real tension worth stating rather than discovering. See GAPS.

### 040 — https://support.plex.tv/articles/200289286-deleting-libraries/
"Deleting a Library removes all information for that Library irretrievably. You should be very careful
when deleting Libraries! Before you delete a Library, we recommend taking the opportunity to back up
your Plex Media Server data." Single confirmation dialog.
- Delete-with-consequences: **ADOPTED and CanonCore is far stronger** — three outcomes previewed with
  counts, "Show what would happen first: containers left, children orphaned, survivors", and a
  confirmation that "is never dismissible by accident".
- **Backup and restore of the catalogue database** — **ABSENT**. **HIGH** — the entire value of
  CanonCore is hand-curated placements and owner statements that exist in no provider and cannot be
  re-derived from the files; Plex can rebuild a library from disk and still tells you to back up
  first. See GAPS.

### 041 — https://support.plex.tv/articles/200289306-scanning-vs-refreshing-a-library/
**Scan** (find new/changed/removed files) versus **Refresh** (re-fetch metadata for things that
already have it) as two distinct, separately triggerable operations.
Rules, verbatim: "In most cases, this should work for content on local filesystems. It will generally
not work for network shares mounted via SMB, NFS, AFP, or similar"; "you should wait 60 seconds after
all activity on the drive finishes"; periodic frequencies are "every 15 minutes / every 30 minutes /
hourly / every 2 hours / every 6 hours / every 12 hours / daily"; "The periodic frequency is based on
when the Plex Media Server starts up."
- Change notifications not firing on network mounts: **ADOPTED** — the prompt cites this article's
  claim almost word for word and requires explicit periodic scans.
- The scan/refresh split: **ADOPTED in shape** (scanner vs enrichment are separate subsystems), but
  the prompt never names a *refresh* operation, its granularity (item / group / everything), or what
  it does to existing statements. **ABSENT** at that level of detail — **MEDIUM**; with multi-valued
  statements and remembered rejections, "refresh" has a genuinely different meaning here than in Plex
  and needs defining. Also **ABSENT**: a scan/refresh *schedule* of any kind. **MEDIUM**.

### 042 — https://support.plex.tv/articles/200289326-emptying-library-trash/
**Library trash.** Verbatim: "If you move or delete the file for a library item or if the file somehow
becomes unavailable, then the library item will be placed into the 'trash' ... It can be particularly
helpful in situations where a drive or network share where content is stored isn't available when a
Library Update occurs. By default, the item will remain in the trash until you perform an 'Empty
Trash'." Restorable "by making the file for the library item available again at the expected location";
trashcan icon on the poster and an "Unavailable" indicator on the details page; an opt-in
"Empty trash automatically after every scan" with the warning "content will be removed from your
Library immediately with no chance to simply restore it if there was a mistake."
**ABSENT — HIGH.** The prompt has no rule for what the scanner does when a file it knew about is gone.
This is not a cosmetic gap: CanonCore is explicitly built for network and FUSE mounts whose change
notifications do not fire, so an unmounted share during a periodic scan looks exactly like a mass
delete. See GAPS.

### 043 — https://support.plex.tv/articles/200289336-analyze-media/
**Media analysis**: a separate pass, run on add, that reads technical properties out of the file —
"Container: MP4, MKV, AVI, M4A, etc.", "Video Codec", "Audio Codec", "Resolution", **"Duration"**,
"Bitrate", "Aspect Ratio", "Language". Also generates fallback artwork from the video itself, and
generates video preview thumbnails ("a CPU-intensive process akin to transcoding the file").
Rule: "new versions of Plex Media Server may update the media analysis capabilities ... content may be
re-analyzed when you access it after the new Server version is installed."
- Artwork extracted from video: **REFUSED** ("no artwork scanning").
- Preview thumbnails: **ABSENT/tension**, see 039.
- **Technical properties of a file, and DURATION above all — ABSENT, HIGH.** CanonCore's completion
  rule is "TIME REMAINING under a small absolute figure ... Percentage is the fallback only where
  duration is unknown", and the container rollup is "Count-based, never duration-weighted, since
  runtime is missing for most of any real catalogue". Both sentences treat duration as a *metadata*
  claim that providers may or may not supply. But for anything with a file attached, duration is a
  *measured property of the bytes* and is never missing. The prompt has no `files` columns for
  container/codec/duration and no analysis step to fill them. See GAPS.
- Also **ABSENT**: knowing a file's tracks at all (which audio and subtitle streams are embedded).
  Direct play makes this the only way to offer a track picker. **MEDIUM/HIGH**, folded into the above.

### 044 — https://support.plex.tv/articles/200289388-overview/ (Plex Web App: Overview)
"a dual-purpose web application: it serves both as a way to manage your server and content as well as
providing a way to access and view or listen to your content." Home screen of rows (On Deck, Recently
Added Movies), "customized with the content you want, in the order you want." Supported browsers:
Chrome, Edge, Firefox, Safari.
- Dual-purpose admin+consumer web app: **ADOPTED** by implication (one Next.js app).
- Customisable home rows: **REFUSED for now** — "No shelf type, no command palette yet, no fixed
  item-page tab structure. Those are decided when screens exist."
- **A declared browser support matrix** — **ABSENT**, **LOW**.

### 045 — https://support.plex.tv/articles/200289408-plex-web-app-settings/
Client-side settings for the web app, separated explicitly from server settings: "These are not
settings for your Plex Media Server. These settings do not affect other Plex apps."
Includes: interface Language, Time Format (12/24h), Remember selected tab, Play Theme Music,
**Subtitle Color / Subtitle Position / Subtitle Size** ("applies for text format-based subtitles
rendered on the client side (not for subtitles burned in by the server)"),
Normalize Multi-Channel Audio, Cinema Trailers count, and a **Debug Level** of
"Disabled / Enabled / Verbose" with a link to view client logs.
- Quality/direct-stream settings: **REFUSED**.
- **The client-settings vs server-settings distinction itself** — **ABSENT**. **MEDIUM**: CanonCore
  is one owner across web, phone and TV, and nothing in the prompt says where a preference lives or
  whether it follows the owner across devices. See GAPS.
- **Subtitle rendering controls** — **ABSENT**, **MEDIUM** (see 007). Direct-play-only means the
  client renders every subtitle itself, so these are not optional polish.
- **Client-side debug logging with a viewer** — **ABSENT**, **MEDIUM** (see 022).

### 046 — https://support.plex.tv/articles/200289476-monitoring-library-activity/
Background-job visibility: a transient toast at the bottom of the web app, plus a persistent
**Activity page** with an "Activity queue at the bottom of the page" and an Alerts view per server.
**ABSENT** — nothing in the prompt surfaces what the system is currently doing. Enrichment
"runs in the background against the thresholds", scans are periodic, and the projection has a
"reconciliation loop", so there are at least three long-running processes with no place to see them.
**MEDIUM** — the review queue is the owner's inbox for *decisions*, not for *work in progress*, and
"is it still importing or did it die?" has no answer.

### 047 — https://support.plex.tv/articles/200289496-general/
Server General settings. Concrete items: Claim the Server; Server Version displayed; an automatic
update check on visiting the settings page; Friendly name; Send crash reports; Server Update Channel
(Public / Beta, Plex Pass only); and update handling — "Ask me" or "Automatically during scheduled
maintenance", with the stated limit "this setting is only available and applicable to Windows or
macOS Plex Media Server installs. Linux installs need to be made manually or via repo updates".
Debug logging and Verbose logging as two separate toggles, with the warning that verbose "can very
quickly fill log files".
- **Version display and update notification** — **ABSENT**. **MEDIUM** — the prompt commits to
  "MIGRATIONS ARE AN ORDERED, FORWARD-APPLICABLE LADDER ... a released version can always migrate
  forward", which presumes releases and upgrades, and nothing tells the owner which version they run
  or that a newer one exists. See GAPS (release/upgrade channel).
- **Two-level debug logging as a toggle** — **ABSENT**, folds into the logging gap (022).
- Crash reporting opt-in — **ABSENT**, **LOW** (and arguably refused by the self-hosted posture: the
  project is not a service and has nowhere to send them).
- Friendly name — duplicate of 036.

### 048 — https://support.plex.tv/articles/200289506-remote-access/
Remote access: automatic port mapping via "UPnP" or "NAT-PMP", manual port forward with an explicit
warning ("If you manually forward a port in your router then you **MUST** enable this setting or else
your server will continue to try and automatically map the port and will almost certainly fail"),
internal port fixed at 32400, plus Internet upload speed and Limit remote stream bitrate (both
Plex Pass).
- Bandwidth caps and per-stream bitrate limits: **REFUSED** — no quality ladders.
- **Reachability from outside the LAN, in any form** — **ABSENT**. **MEDIUM** — CanonCore is
  self-hosted with "playback goes through an app-owned opaque-id route", and the phone client that is
  explicitly next in the roadmap is useless on cellular unless the instance is reachable. The prompt
  never says whether that is the owner's problem (reverse proxy, Tailscale) or the product's. Saying
  "reverse proxy, documented, not implemented" is a legitimate answer and is the same posture already
  taken for rclone/mergerfs; leaving it unstated is not.

### 049 — https://support.plex.tv/articles/200289516-agents/
Stub settings page; pure pointer to 018. Nothing new.

### 050 — https://support.plex.tv/articles/200289526-library/
The densest settings page in the shard. Rules, verbatim where they are rules:
- "**Video played threshold**: Set the progress percentage for video playback at which point the video
  will be marked as played. (Default threshold is **90%**.)" → **DIVERGENT**, and the prompt is right:
  completion is time-remaining, not percentage.
- "**Video play completion behavior**" — four values: "at selected threshold percentage / at final
  credits marker / at first credits marker / **earliest between threshold percent and first credits
  marker**. ... This is the default behavior." Note what this is: Plex has already moved *past* pure
  percentage, and the mechanism it moved to is a **timed marker inside the file**.
  **ABSENT** — CanonCore has no marker concept. **MEDIUM/HIGH**, and it merges with 008: intro
  markers, credits markers and ad markers are all one shape (a named interval on an edition), and
  `edition_coverage` is already a set of intervals so the table shape exists. See GAPS.
- "**Generate intro video markers**", "Generate credits video markers", "Generate ad video markers",
  "Generate chapter thumbnails", "Generate video preview thumbnails", "Analyze audio tracks for
  loudness", "Analyze audio tracks for sonic features" — each a three-valued
  "never / as a scheduled task / as a scheduled task and when media is added", most defaulting to the
  last. **ABSENT** — CanonCore has no scheduled-maintenance window and no derived-asset pipeline at
  all. **MEDIUM** (see 039, 043).
- "**Marker source**: both, try online first / online only (no local detection) / local detection
  only ... if this preference is set to 'both' then any locally detected markers are submitted
  anonymously back to the online database for future use." → **a provider that supplies timed
  markers, and a client that contributes back**. **ABSENT**, and it is the *third* instance in this
  shard of a provider returning something that is not a field value (subtitles at 028, artwork
  already excepted, markers here). **HIGH** as a contract-shape finding; see GAPS.
- "**Weeks to consider for Continue Watching** ... The default value of **16 weeks** is good for the
  vast majority of users. You can lower the value if your Continue Watching is particularly slow to
  appear." Plus "Maximum number of Continue Watching items" and "Include season premieres in Continue
  Watching ... Enabled by default, this setting makes episode one of a new season appear even if it
  falls outside of Weeks to consider". → **DIVERGENT and the prompt is right**: "Continue Watching is
  computed, never stored. No time window, no dismissal." The season-premiere carve-out is a patch on
  a window that should not exist. Worth noting the *reason* Plex has the window is performance, which
  is the one thing that could force it back — the prompt should expect that pressure and not treat a
  slow Continue Watching as a reason to reintroduce a cutoff.
- "**Allow media deletion** ... Deleted items will be immediately removed from your library *and the
  corresponding media file will also be deleted*." Off by default, owner-only even for shared users.
  **ABSENT — and it is a real ambiguity in the prompt.** The DELETE section names "Delete permanently"
  as an outcome and previews "containers left, children orphaned, survivors" — all catalogue
  consequences. It never says whether the *bytes* go. The standing rule "The scanner NEVER writes
  storage" constrains the scanner, not a delete action. **MEDIUM**; see GAPS.
- "Run a partial scan when changes are detected" — scan only the changed folder. **ABSENT**,
  **LOW/MEDIUM** (scan granularity; matters at archive scale).
- "Run scanner tasks at a lower priority ... On low-powered systems (e.g. ARM-based NAS devices)".
  **ABSENT**, **LOW**.
- "**Location visibility** ... photos taken by a mobile phone will often have GPS data embedded, which
  we make use of" — **REFUSED** twice over: no visibility system, and the scanner reads no embedded
  metadata.
- "Group albums by type (e.g. EP, Single, Compilation, Live, etc.)" — **ADOPTED**: a category
  statement, exactly as the prompt says finer typing must be.
- "Enable smart shuffling ... playback will prefer highly rated, popular, and less recently heard
  tracks. When disabled, you'll get true randomness (which, ironically, often feels *less* random)."
  **ABSENT**, **LOW**.
- iTunes library XML import — **REFUSED** ("No fork, no export, no import").
- "Database Cache Size (MB) ... The default value is 40" — a tuning knob for
  "hundreds of thousands of episodes or music tracks". Postgres makes this moot.

### 051 — https://support.plex.tv/articles/200350536-dlna/
The server also speaks **DLNA/UPnP**, so "regular DLNA clients" reach the content with no Plex app.
Settings include per-client quirk profiles ("DLNA client preferences ... Client-specific configuration
settings"), an SSDP announcement lease time defaulting to 1800 seconds, a renderer discovery interval,
a `GetProtocolInfo` string, and — the load-bearing one — "**DLNA server timeline reporting**: Allow
playback via DLNA to report timeline activity. This means that the Plex Media Server will track the
current progress through the item."
**ABSENT** for DLNA specifically. The *category* is not absent: the prompt argues the case at length
("the highest-leverage client work by a wide margin was implementing an EXISTING CLIENT PROTOCOL
rather than writing an app: Komga shipped OPDS at day 34 ... Navidrome implemented Subsonic from its
second commit") and then decides to build apps anyway, deliberately.
**MEDIUM** — DLNA is the third member of that set and the one Plex actually shipped, it costs no
transcoding (which is CanonCore's exact posture), and it reaches dumb TVs that will never run a
CanonCore app. The transferable detail is the timeline-reporting flag: any external protocol needs a
defined way to write back into the per-(owner, edition) progress log, and the prompt's playback
design assumes the only player is CanonCore's own.

### 052 — https://support.plex.tv/articles/200375666-plex-media-server-requirements/
Published minimums: "Intel Core i3 (or equivalent) or faster"; "4GB of RAM is typically more than
sufficient"; a named OS matrix (Windows 10 1607+, macOS 10.13+, CentOS 7 / Debian 8 / Fedora 27 /
SUSE 15 / Ubuntu 16.04+, FreeBSD 11.2+); "Plex Media Server does not currently support ARM-based
systems for Windows". Plus a licence-shaped constraint: "Plex is licensed for personal use and it's
intended and expected that Plex Media Server systems are run from home."
- **A stated requirements/platform matrix** — **ABSENT**. **MEDIUM**, and there is a specific edge
  here worth writing down rather than discovering: the prompt fixes **Postgres with a docker dbSetup**,
  while every NAS-targeted competitor in this category ships SQLite precisely because a consumer NAS
  running an ARM SoC is the modal deployment. Direct-play-only means CanonCore's CPU need is near
  zero, which is a genuine advantage — and the database is then the whole of the requirement. That is
  a deployment consequence of an already-closed decision, not a reason to reopen it. See GAPS.
- Hardware sizing for transcoding: **REFUSED**.

### 053 — https://support.plex.tv/articles/200380843-overview/
Product overview. Three product rules hide in the marketing:
- "the Apps don't store information about your media but fetch it from the Server" — thin clients,
  server-authoritative. **ADOPTED** by the prompt's shape.
- "if you half-watched a show it also remembers where you left off ... **This happens on any App**,
  not just the one you started watching on." — **ADOPTED**: progress is per (owner, edition) on the
  server, so cross-device resume is free.
- "**On Deck** ... includes **the next available episode** for a show after you've finished the
  previous one ... If the next episode isn't available yet, the show will disappear from On Deck,
  only to re-appear once the next episode has been added to the library."
  **ABSENT — and this is the sharpest gap in the batch.** "Continue Watching is computed, never
  stored" answers *what you were in the middle of*. It does not answer *what comes next after you
  finish something*, and in CanonCore that question has no single answer: an item finished inside a
  Release-order container and a Story-order container has two successors. The prompt has
  navigation-state-carried-alongside-the-URL, which is exactly the machinery that could answer it,
  and never connects the two. **MEDIUM/HIGH**; see GAPS, merged with the Post Play/autoplay finding
  at 007.

### 054 — https://support.plex.tv/articles/200381043-multi-version-movies/
**The most important article in this batch.** Plex has TWO levels where CanonCore has one, and states
the line explicitly:
"**Versions all represent the same release of an item.** So, you can have multiple versions (1080p vs
480p, HEVC vs H.264, MP4 vs MKV) of *The Empire Strikes Back*, but they're all for the same theatrical
release of the movie. **Editions represent different releases of an item.** So, the 'theatrical
release' vs the 'Special Edition' ... Or 'Theatrical' vs 'Director's Cut' vs 'Final Cut' of *Blade
Runner*. Editions would also be appropriate for a 2D vs 3D version of a movie."
And they compose: `Blade Runner (1982) {edition-Director's Cut}` as a folder, holding four files
(h264/hevc x 1080p/4k) that are four *versions* of that one edition.
Behaviour: "When a Plex app goes to play the collapsed item, it will automatically request and play
the most suitable item by default. Many apps will also allow you to select a `Play Version` action ...
**Not all Plex apps will allow you to manually choose which version to play. You should not rely on a
choice being presented.**"
- Plex's *Edition* is exactly CanonCore's `editions` row. **ADOPTED**, and CanonCore is stronger:
  Plex's editions live in a filename token and the article warns "you'll want to make sure that you
  use the file naming method and **not just edit the movie information in the web app**", which is an
  admission that its own UI edit does not stick.
- Plex's *Version* has no name in CanonCore. It can only be several `files` rows with role `media`
  hanging off one edition — which the schema permits and the prompt never mentions.
  **ABSENT — HIGH.** See GAPS. Note that the prompt's own criticism ("Plex merges versions but its
  automatic pick is about what the client can decode, not about which is canonical") is aimed at
  Versions but is worded as though it were about editions; for Versions, picking by what the client
  can decode is the *correct* answer, and under direct-play-only it is the only one.
- Content-type separation by top-level directory ("We **strongly** recommend separating movie and
  television content into separate main directories") — **DIVERGENT**: group-scoped scanner roots do
  this without typing anything.

### 055 — https://support.plex.tv/articles/200381093-identifying-music-media-using-embedded-metadata/
Embedded tags (ID3 etc.) as a metadata source, exposed as a per-library **Prefer local metadata**
switch. Rules: it is all-or-nothing — "you're promising that not only is your entire music library
tagged with embedded metadata, but also that it's tagged *correctly*"; the tags used are Track, Album,
Artist and Album Artist; "These will be used **instead** of what we would normally provide"; and
"Most users should **not** enable this option and we do not recommend doing so by default."
- **Reading embedded tags at all** — **ABSENT**, and this closes the question the previous agent left
  open at 025. The prompt refuses `.nfo` and artwork scanning by name, and says "The scanner takes
  media files and playback sidecars, and nothing else", which reads as refusing embedded tags too —
  but by inference rather than by statement, and embedded tags are not a sidecar and not artwork.
  **MEDIUM** — for music this is not a nicety: a ripped library's only trustworthy identification is
  its tags, and the prompt's alternative (filename plus a provider) is strictly worse. See GAPS.
- The all-or-nothing switch is a **DIVERGENT** design CanonCore fixes for free: embedded tags would be
  one more `source` on a statement with an ordinary `rank`, so "trust my tags for this field and the
  provider for that one" needs no library-wide promise. That is the multi-valued design paying off,
  and it is worth having as a worked example.

### 056 — https://support.plex.tv/articles/200392106-library-actions/
The action inventory, and the scopes it offers them at: **global** (Scan Library Files across all
libraries), **per library** (Scan Library Files, Refresh All Metadata, Empty Trash, Analyze, Edit,
Delete, Share, Pin/Unpin, Reorder), and **per item**. Warning: "If you do so and then add the library
again, you will have to fetch new metadata, perform new analysis on the files, etc."
- The **scope ladder itself** (all / one group / one item) for every maintenance operation —
  **ABSENT**, and it sharpens 041: the prompt names no refresh operation, so it names no granularity
  for one either. **MEDIUM**.
- Pin/Unpin and drag-reorder of the sidebar sources — **ABSENT**, **LOW** (the prompt defers screen
  furniture: "No shelf type, no command palette yet").

### 057 — https://support.plex.tv/articles/200392126-using-the-library-view/
The browse surface. Six findings.
1. Filter values "All / Unplayed / **Duplicates** – All items in the library that have more than one
   'version'". **This is a third distinct meaning of the word "duplicate"** in this category (Plex
   means version count; Immich means identical bytes; CanonCore's users would mean multi-placement).
   **ADOPTED** — the standing rule "Never 'duplicate'. Two files with the same content are a
   REDUNDANT FILE" is aimed exactly here, and this article is evidence the ban is right.
2. "**Custom filter…** if you would like to create a complicated filter with multiple variables. For
   instance, you could choose to view 'unplayed' items with the genre 'Drama', which were released in
   '2013'." **ABSENT** — the prompt commits to rule-derived containers ("A container is EITHER
   hand-placed OR rule-derived; a rule-derived container carries NO order") and never says what a rule
   can express. **MEDIUM/HIGH**: over a properties catalogue with multi-valued statements and ranks,
   "genre = Drama" is ambiguous before you decide whether it means *any* statement, the favourite, or
   the source-order winner. See GAPS.
3. "**Type**" switches a TV library between TV Shows / Seasons / Episodes — browsing the same library
   flattened to a chosen depth. **ABSENT**. **MEDIUM** — with arbitrary-depth containers and an
   ancestor closure already in the schema, "all leaves under here" is cheap and is the only way to
   browse a deep chronology.
4. "**The Folders option is available for all media types**, and lets you browse the media folder
   structure directly based on the folder hierarchy on disk." **ABSENT**. **MEDIUM** — CanonCore
   refuses the filesystem as a model, correctly, but a read-only view of what is on disk is the only
   way an owner ever sees what the scanner *missed*. Pairs with 032 (unreadable paths) and 042
   (vanished files).
5. **Multi-select with bulk actions**: Edit (mass-edit metadata fields), Mark as Played, Mark as
   Unplayed, Refresh Metadata, Analyze, Merge, Delete. **ABSENT**. **MEDIUM/HIGH** — the fixture
   archive has 11,285 stories, the prompt refuses a per-item wizard, and the review queue is
   per-item by design. Nothing in the prompt lets the owner act on a hundred things at once. See GAPS.
6. Photos: "**An album is a user-curated grouping of photo and videos** ... **You can add the same
   photo(s) to multiple albums, if you wish.**" — Plex ships multi-placement, in exactly one library
   type, for photos only, and nowhere else. **ADOPTED and generalised**: this is CanonCore's whole
   model, and Plex's own product proves the need exists and that its typed-library design cannot
   extend it past photos.

### 058 — https://support.plex.tv/articles/200392226-plex-web-app-player/
The player's control inventory. Concrete defaults: "Skip Back: Skip the current playback backwards
**10 seconds**"; "Skip Forward: Skip the current playback forward **30 seconds**" (asymmetric on
purpose); Repeat toggles "between Repeat-1, Repeat-All, and Off".
- "**If the media has a Resume point set** ... you will be offered a choice to resume or start from
  the beginning." **ABSENT**, **LOW/MEDIUM** — the prompt's Continue Watching "is offered, never
  auto-played", but the resume-versus-restart choice at press-play is a separate decision and there
  is a wrong answer (silently resuming).
- "**Chapters**: Select chapters within the current video files." **PARTIALLY ADOPTED, with a gap**:
  the prompt already gives files the role `chapters`, so the sidecar is modelled — but nothing says
  what it holds, that a player exposes it, or how it relates to the marker concept from 050.
  **MEDIUM**.
- "**Get Info**: Open the Media Info window, which displays various media properties for the item. If
  signed in as the Plex Media Server owner, the **XML** link is available." A raw-truth inspector for
  the owner. **ABSENT**, **LOW/MEDIUM** — CanonCore's version is far more valuable than Plex's, since
  it can show every claim with its provenance, and the prompt gets most of the way there with
  "several values at once, all live and visible".
- "Note: In some cases, using subtitles will require that the media be transcoded so that subtitles
  are burned into the video. In such cases, **if your Plex Media Server does not support transcoding
  ... you won't be able to see subtitles.**" — Plex stating the exact consequence CanonCore inherits
  permanently from direct-play-only. Confirms the 021 finding. **MEDIUM**.
- Track pickers default from the server Language settings — reinforces 019/028.
- Auto Play toggle, mini-player, Select Player (fling), Play Queue management — see 086/094/102.
- Quality selector, Sync, Optimize — **REFUSED**.

### 059 — https://support.plex.tv/articles/200430283-network/
Server network settings. The security-relevant inventory:
- Secure connections: "**Required** – Only accept secure connections. **Preferred** – (Default)".
  Custom certificate as a PKCS #12 path plus passphrase plus domain. "Strict TLS configuration ...
  prevents Plex Media Server from using or accepting the deprecated TLSv1.0 and v1.1 protocols".
  IPv6 toggle. Preferred network interface, "for systems such as NAS or Docker where there is always
  another network interface". "Custom server access URLs ... if you're using a reverse proxy in front
  of the media server".
  **ABSENT — inbound transport security in any form.** **MEDIUM.** The prompt's SECURITY section is
  entirely about the *outbound* Safe External Fetch boundary and the public read payload's field
  list. Nothing says how the instance is reached. A single-password cookie session defaults to plain
  HTTP on a LAN, and whether the session cookie can be `Secure` depends on an answer nobody has
  given. See GAPS.
- "**List of IP addresses and networks that are allowed without auth** ... **Warning!: Any app
  connecting to the server this way without being signed in will be treated as the admin/owner. That
  means access to all libraries as well as the ability to change server settings.**"
  **REFUSED, and worth recording as a named refusal**: an IP allowlist that grants owner rights is
  precisely the hole a one-password model must not open, however convenient a legacy TV app makes it.
- "**Terminate Sessions Paused for Longer Than** ... The default of **0** (zero) means the server will
  not automatically terminate such paused sessions. This does not affect audio-only sessions or Live
  TV streams." **ABSENT** — no session lifecycle at all. **LOW/MEDIUM**, folds into the device/session
  registry gap at 012.
- "Enable local network discovery (GDM)" — zero-config LAN discovery so clients find the server
  without typing an address. **ABSENT**, **MEDIUM** — the phone and TV apps that are explicitly on
  the roadmap each need a first-connection story, and "type the IP" is the one every project regrets.
- Relay (vendor-proxied connections), remote streams per user, LAN/WAN bandwidth classes — **REFUSED**
  (self-hosted, single user, no quality ladders).

### 060 — https://support.plex.tv/articles/200430303-streaming-overview/
The three-tier playback model, and the mechanism underneath it:
"**The App Understands the Device.** A Plex app understands the device it's running on. It knows the
ideal media resolution, whether it can handle a particular audio format (Dolby Digital, AAC, etc.),
and what file format it prefers. **When the app connects to a server, it tells the server about
itself**, so the server knows how to tailor media sent to it."
- **A client capability profile sent to the server** — **ABSENT**, and it is load-bearing here in a
  way it is not for Plex. **MEDIUM/HIGH**: the prompt promises "When a file will not play, say so
  plainly", which is only implementable if the server knows both what the file contains (the 043
  gap: no codec, container or duration columns) and what the asking client can decode. Direct-play-
  only makes this the *entire* compatibility system rather than an optimisation. See GAPS.
- **Direct Stream** — remux the same streams into a different container, "a little more work required
  by the server, but not a lot", no re-encoding. **DIVERGENT with a stated cost**: "No transcoding,
  no ffmpeg" bans remuxing too, and the case it costs is the common one — an MKV with compatible
  H.264/AAC streams that Safari will not open. The decision is closed; the consequence is that the
  first client CanonCore ships is the one that hits it most. Worth writing down rather than
  rediscovering.
- Subtitle burn-in caveat — repeat of 021/058.

### 061 — https://support.plex.tv/articles/200430313-troubleshooting/
Transcoder troubleshooting. Mostly **REFUSED**, but one line is evidence for a gap already open:
the listed symptoms of bad media analysis are "**The incorrect duration for a show being reported in
the App**", "Media stopping before its proper end", and "Playback could not proceed". Duration being
wrong is a user-visible failure with its own support article, which is the practical case for 043:
duration is a measured property of the bytes, not a metadata claim, and CanonCore has no column and
no step that produces it.
Remedy is "re-analyze the media" — a per-item re-run of a derived-data pass. **ABSENT**, folds into
the refresh-granularity gap (041/056).

### 062 — https://support.plex.tv/articles/200471113-configuring-subtitle-support/
The subtitle auto-display policy. **Subtitle Mode** is a named setting whose values change how a
forced track behaves: "If **Shown with foreign audio** is enabled, the 'Forced' subtitle will be used
even if there is an audio track present that matches your preferred audio language (this is the
behavior that most people expect and desire). If **Always enabled** is selected, the 'Forced'
subtitle will be treated as normal."
And the hard rule on unknown languages: "**If the language for a track is not set (i.e. it is
detected as 'unknown'), it will be treated as if it does not match your preferred language
settings.**"
**ABSENT** — CanonCore has no subtitle mode, no preferred language, and therefore no automatic track
selection at all. **MEDIUM** (merges with 019/028). Note the unknown-language rule is the same shape
as the prompt's own extent rule ("WHERE THE EXTENT IS UNKNOWN THE ANSWER IS UNKNOWN — never false"):
unknown must not be silently coerced into a match.

### 063 — https://support.plex.tv/articles/200471133-adding-local-subtitles-to-your-media/
The definitive subtitle-sidecar article, and the most rule-dense in the batch.
- **Declared format support with a compatibility caveat**: "The following formats are **fully
  supported** either as embedded tracks or external subtitle files. Full support means they are
  compatible with all Plex Apps ... SRT (.srt), SMI (.smi), SSA (or ASS) (.ssa or .ass), WebVTT
  (.vtt). **Other formats such as VOBSUB, PGS, etc. may work on some Plex apps but not all.** For the
  majority of apps, both VOBSUB and PGS subtitles will require the video to be transcoded to 'burn
  in' the subtitles." → the text/image split is exactly the line direct-play-only cannot cross.
  **ABSENT as a stated consequence**, **MEDIUM**: CanonCore should declare the text formats it will
  render and treat image-based subtitle tracks as not playable, in the same voice as "when a file
  will not play, say so plainly".
- "You'll want to make sure a text subtitle file is saved using the **UTF-8** character encoding."
  **ABSENT**, **LOW/MEDIUM** — an encoding column or a detection step; mojibake is silent.
- **Three orthogonal flags on a sidecar**, not one: language code (ISO-639-1 or ISO-639-2/B),
  `forced`, and `sdh`/`cc`. Worked example given verbatim:
  `Avatar (2009).eng.srt` / `.en.forced.ass` / `.en.sdh.srt` / `.de.srt` / `.de.sdh.srt` — five
  sidecars for one film, in two languages, across three kinds.
  **ABSENT** — the prompt's sidecar carries only "the file it accompanies plus a language".
  **MEDIUM**: forced and SDH are different *kinds* of track, not preferences, and without them a
  player has five indistinguishable subtitle files and no basis to pick.
- "Support for SDH/CC subtitles requires Plex Media Server v1.20.3.3401 or newer."
- Subtitles may live in a sibling `subs` or `subtitles` folder as of server 1.41.0 — sidecars are not
  necessarily adjacent. **ABSENT**, **LOW**, but it does mean "the file it accompanies" cannot be
  resolved by adjacency alone.
- The line that vindicates CanonCore's model outright: "**Sometimes there might be several versions of
  an item with extra or fewer scenes. This means you need a subtitle track that matches a particular
  version of the item.**" Plex can only express that through filenames; CanonCore's sidecar
  "references the file it accompanies", so binding a subtitle to one cut is structural. **ADOPTED,
  and stronger.**

### 064 — https://support.plex.tv/articles/200471233-exploring-more-of-plex/
Orientation page. Feature inventory behind the paywall: Live TV & DVR, Parental Controls, "Awesome
Audio: Loudness leveling, Sweet Fades, **automatic lyrics**", Mobile Sync, Early Access releases.
All **REFUSED** or already covered. Two small things:
- Automatic lyrics — a provider returning a **timed text document** per track. Fourth instance of the
  non-field payload shape (subtitles 028, artwork, markers 050, lyrics here). Reinforces the CMPP gap.
- "Our friendly Plex Forums have thousands of questions and answers" as a first-class support channel.
  **ABSENT**, **LOW** (project-website concern, as at 001).

### 065 — https://support.plex.tv/articles/200484203-interface-overview/
Web app shell. Named home-screen hubs, which are worth recording as a vocabulary even though the
prompt defers shelves: "**Rediscover** (TV shows you stopped watching part-way through a
series/season)", "**Start Watching** (TV shows that haven't been watched yet)", "More in [Genre]",
"Most Played in [Month]", "Top Movies by [Director]", "Photos from [Year]", "Recently Added Movies",
"Recently Aired TV", "Artists on Tour" — and "the server will **randomize** some things to help
provide variety for you."
- Shelves generally: **REFUSED for now** — "No shelf type, no command palette yet ... Those are
  decided when screens exist."
- **Rediscover as a shelf distinct from Continue Watching** is the interesting one: Plex needs it
  precisely *because* Continue Watching has a 16-week window (050), so the abandoned items fall out
  and need a second home. CanonCore's windowless Continue Watching absorbs both. **ADOPTED**, and it
  is a concrete second benefit of that decision.
- **Status menu**: Alerts (scanning and matching progress), Sync, Conversion, Now Playing. Confirms
  046: background work has a permanent home in the chrome, not just a toast.
- Search: as-you-type results from the current server, then a full results page scoped to
  "This Server" or "All Servers". **ADOPTED in shape** — groups scope search, and the escape to
  everything is the same affordance.
- **"Announcements from Plex will appear here"** — vendor messages injected into a self-hosted admin
  UI. **REFUSED** by posture: CanonCore is software someone else runs, and the only surface on which
  it is a publisher is the demo. Worth naming as a refusal since it is the obvious place a release
  feed would be bolted on (see 047).

### 066 — https://support.plex.tv/articles/200484903-internet-and-network-requirements/
What breaks with no internet. "**The Plex Media Server generally assumes you will have an active
internet connection when using it.**" The list of things that then fail: adding new library content,
"Playing some media types for the first time", "**Dynamically Updated Server Components**",
downloading the TLS certificate, and any sign-in. Plus a long wired-vs-WiFi primer.
- **Offline behaviour, stated** — **PARTIALLY ADOPTED**. The prompt already answers most of it by
  design: the first provider is "private, local, no credential", and "A private instance with no
  provider connected has no artwork". **LOW** as a gap, but the positive is worth writing down, since
  "works with no internet at all" is a differentiator against exactly this article.
- Server components fetched from the vendor at runtime — **REFUSED** by posture.
- WiFi/MTU guidance — **N/A**.

### 067 — https://support.plex.tv/articles/200871837-status-and-dashboard/
The observability surface: Dashboard (Now Playing, Bandwidth, CPU, RAM, Top Users, **Play History**,
Top Played), Alerts, Conversions. The Activity icon "will change to orange and a badge number will
indicate how many things are going on. When a scan or metadata refresh process ... is taking place, a
line will rotate around the icon."
- "**Play History** displays the historical amount of time users have spent playing items over the
  selected time frame. It can be filtered by media type as well as by individual user. Click on
  '**View Full History**' to see a detailed sortable list."
  **ABSENT, and it is a cheap and pointed one.** The prompt goes out of its way to build an
  append-only watch-event log and to argue for it ("every media server surveyed keeps only a mutable
  state row: Jellyfin has a play count but no dates, and Plex's unscrobble zeroes the count. The
  event log is what makes re-watches real"), then never surfaces it. A log nobody can read is
  indistinguishable from a state row. **MEDIUM**; see GAPS.
- "Now Playing" with a **Stop playback** button and an optional message to the viewer. **ABSENT**,
  **LOW/MEDIUM**, folds into the session-registry gap (012/059).
- The named defect worth not repeating: "**The activity under Alerts here is only for the current
  browser session. If you reload the browser page or access from a different browser, the Alerts
  information will start over.**" Plex's activity feed is client-side and ephemeral. If CanonCore
  builds the activity surface at 046, it should be server-side and durable.
- "Credit detection and Chapter Thumb generation will not show real time progress" — some background
  jobs have no progress at all, an honest admission of a partial implementation.
- Bandwidth/CPU/RAM graphs — **REFUSED**/**LOW** (no transcoding means there is nothing to watch).

### 068 — https://support.plex.tv/articles/200889878-matching-process/
The pipeline, stated as an ordered sequence: scan the folders → analyse each file for
"video and audio codec used, resolution, bitrate, etc." → generate a thumbnail → match against the
agent → fetch metadata. And a **visible per-item state progression**: "During the initial scan you'll
see a generic poster, followed by a screen-grab from the movie and then a '**Matching**' indicator ...
you'll notice tags appear on the generic poster indicating that the match is in-process and then that
the item has been matched."
- **A per-item enrichment state visible on the item itself** — **ABSENT**. **MEDIUM**: CanonCore's
  thresholds put every item into one of at least four states (auto-applied, in review, discarded
  below the low bar, rejected-and-remembered), and the review queue only shows one of them. The other
  three are invisible, including "this provider was asked and found nothing", which is the 029 gap.
- Screen-grab fallback poster — **REFUSED** ("no artwork scanning"), and this is Plex's answer to
  exactly the case the prompt accepts as a cost: "a private instance with no provider connected has
  no artwork".
- Analysis producing codec/resolution/bitrate as step two of the pipeline — reinforces 043.

### 069 — https://support.plex.tv/articles/200890058-authentication-for-local-network-access/
Two rules, both directly relevant.
1. "**When your Plex Media Server is claimed or signed in to a Plex account, then all access to the
   server will require authentication by default.**" — authentication switches on *at claim time*,
   which means an unclaimed server on the LAN is open. Confirms the first-run/claim gap from 035, and
   makes it sharper: the window is not theoretical, it is the documented default state.
2. **A documented lockout recovery path**: "If you have lost access to the Plex Media Server for
   whatever reason ... you can do so manually by editing the `allowedNetworks` advanced, hidden server
   preference on the server computer/device."
   **ABSENT — HIGH.** CanonCore is "Single user, one password, no signup". No signup means no email,
   which means **there is no password reset and no recovery of any kind**. An owner who forgets the
   password is locked out of their own catalogue permanently, and the only possible answer is
   something done on the box: a CLI command, an environment variable read at boot, or a documented
   row to update. The prompt specifies the auth model in one line and never closes this. See GAPS.
   (Note the prompt's own rule "Do not introduce a configuration option, feature flag, or environment
   variable unless something in the repo reads it in the same change" makes the boot-time-secret
   variant a deliberate change rather than an incidental one.)
- The allowedNetworks bypass itself — **REFUSED**, as at 059.

### 070 — https://support.plex.tv/articles/200931138-troubleshooting-remote-access/
The longest article in the shard, and it is entirely about one problem: getting a self-hosted server
reachable from outside the house. Concrete facts: "Port 32400 (TCP) is default, but you can generally
use any available port in the 20,000 to 50,000 range"; "**LAN/Internal Port: This will always be
32400**"; CGNAT identified by a public IP "within the CGNAT range of `100.64.0.0 - 100.127.255.255`";
double-NAT detected by comparing the router's WAN IPv4 against what a public what-is-my-IP service
reports; jumbo frames (MTU > 1500) break it with the specific symptom of "your server showing as
remote access successfully set up with a green checkmark, but still is not actually available
remotely"; and named third-party blockers (Xfinity xFi Advanced Security, for which the only remedy
offered is to turn the security product off).
- Almost everything here is **REFUSED** for CanonCore (no vendor relay, no reachability test service,
  no per-stream limits) or **N/A**. Its real value is as evidence for the 048 gap: remote
  reachability is the single largest support burden in this entire product category, and the prompt
  is silent on it. **MEDIUM**, already counted at 048.
- One design detail is worth naming as a refusal: Plex tests reachability by having **its own cloud
  workers connect back in** to the user's server, from a rotating IP list the user is expected to
  allowlist. That is a phone-home dependency in self-hosted software and CanonCore must not have one.

### 071 — https://support.plex.tv/articles/200933616-plex-account/
Account menu inventory (Account, Users, Announcements, Get Plex Apps, Help, Switch User, Sign Out).
Entirely vendor-account plumbing. **REFUSED** by "Single user, one password, no signup" and by the
self-hosted posture. Nothing new.

### 072 — https://support.plex.tv/articles/200948256-updating-plex-web-app/
The client and the server ship on **different release cadences**: "New versions of Plex Web App are
always released to our hosted version"; "Your Plex Media Server comes with a local copy of Plex Web
App bundled in ... The version 'bundled' with Plex Media Server will, by necessity, typically lag
behind the hosted version. We recommend using the hosted version."
**REFUSED** in the hosted form (CanonCore serves its own Next.js app from the monorepo), but the
underlying problem is **ABSENT** and will arrive: the phone and TV apps ship through app stores on
their own schedule while the server ships on the owner's, so a client and a server will routinely
disagree about the API. The prompt builds "the API contract" as a workspace package from the first
commit, which is the right seam, and says nothing about versioning across it. **MEDIUM** once the
phone app exists; **LOW** before then. See GAPS.

### 073 — https://support.plex.tv/articles/201018248-merge-or-split-items/
Merge and — the important half — **Split Apart**. Rules: "The first item you select is what all
selected items will be merged into"; "The Merged item now has a number badge that indicates how many
items are included"; and "Splitting can be done to: Movies, TV Shows/Series (**not individual
episodes**), Music Artist."
- Merge: **ADOPTED**, and CanonCore's is better specified — "the loser becomes a PERMANENT ALIAS and
  stays resolvable forever ... Statements from both re-point at the survivor and keep their own
  provenance, so a disagreement becomes two claims rather than a lost value."
- **Split / unmerge: ABSENT — HIGH.** An accidental merge is one of the two classic destructive
  mistakes in a catalogue (the other is delete, which the prompt handles at length and calls "the one
  place data is actually lost" — merge is arguably the second). Plex ships an undo. CanonCore cannot
  currently: statements keep their provenance so they know which *source* asserted them, but nothing
  records which *pre-merge item* they hung off, and placements, editions and files carry no such mark
  either. Making merge reversible is a schema decision — a merge record, or a surviving
  `merged_from` on the re-pointed rows — and per the prompt's own FACTS section this is the class of
  thing that "CANNOT be retrofitted". See GAPS.
- The merged-count badge: a merged item visibly declares how many things it absorbed. Cheap, and the
  only warning an owner gets that a merge happened.

### 074 — https://support.plex.tv/articles/201018487-mark-as-watched-or-unwatched/
Manual watch-state control. Three states ("Watched / Unwatched / Partially watched and how far you
are into the item") and three scopes: "The watch state can be adjusted for: Individual items (movies
or television episodes); An entire season for a television series; An entire television series", with
"If you try to set the status for either an entire series or a season, you'll be prompted to confirm
you wish to change multiple items." Plus a bulk toggle over a shift-click range in the library view.
- **Setting watch state by hand at all — ABSENT, MEDIUM/HIGH.** The prompt makes append-only watch
  events the truth and never says the owner can author one. For a product whose premise is a
  catalogue of works you may not own files for, this is not an edge case: most of what an owner has
  seen, they saw before the catalogue existed, or elsewhere, or on disc. Without a manual mark, every
  completion figure and both container rollups start at zero and can only ever be filled by playing
  the file again. The event log makes this *easy* — a manual mark is an event with a different kind
  and the Owner as its source, which is the same provenance shape the statements table already uses.
- **Cascading a watch state down a container — ABSENT, MEDIUM.** In CanonCore this is genuinely
  harder than in Plex and the answer is not obvious: containers are items, progress is per *edition*,
  and members may be multi-placed, so "mark this container watched" has to resolve to a set of
  editions (each leaf's pinned or declared-order default) and must not double-count an item placed
  twice. The COUNT(DISTINCT item) dedup already in the rollup is the same machinery.
- Display rules, worth having: check mark top-right of the poster; unwatched *count* on a
  series/season poster; a progress bar along the bottom for partially-watched; the Play button
  relabelled "**Resume**"; and "On TV clients the button will display as 'Resume' and there will be a
  **time remaining** indicator below the title" — note Plex surfaces time-remaining in the UI while
  still computing completion by percentage, which is the inconsistency the prompt fixes.
- "Watched Indicators for Personal Media" account setting: "Movies & TV Shows (default) / Movies /
  TV Shows / None" — the ability to hide progress markers entirely. **ABSENT**, **LOW**.
- Watch-state sync to a vendor account across servers — **REFUSED** (no cross-instance anything).

### 075 — https://support.plex.tv/articles/201018497-fix-match-match/
The correction flow, and the closest article in the shard to CMPP's match endpoint.
- Two entry points, one flow: "In cases where the item is completely unmatched, the menu will instead
  simply be **Match**, but it otherwise works similarly." **ADOPTED in shape** (matching is one
  operation whether or not a binding exists).
- "By default, when you open the Fix Match window, **a search will be performed** and suggested
  matches will be displayed" — candidates offered before the owner types anything.
- **Search Options let you override the title, the year, and the language.** Third appearance of the
  locale gap (038, 039); here it is a per-lookup override rather than a library setting, which is the
  shape CMPP would need — a language parameter on the search/lookup call.
- **Matching by external identifier, typed in place of a title**: "`imdb-tt1217209`", "`tvdb-110381`",
  "`tmdb-10283`", and for music the MusicBrainz MBID — "To match an Album, enter the MBID for the
  **Release** (not the Release Group)."
  **PARTIALLY ADOPTED**: the prompt has the data model for this ("A SCHEME is what an identifier IS
  (ISBN, MusicBrainz MBID); a PROVIDER is who asserted it ... Shared identifiers then become MATCHING
  SIGNALS between providers"), but **binding an item to a record by pasting its id is ABSENT as an
  operation**. **MEDIUM** — it is the reliable escape hatch when search is ambiguous, and the prompt
  already argues search is "ambiguous forever".
  Note the Release-vs-Release-Group aside: MusicBrainz has exactly the two levels BIBFRAME collapsed
  and the prompt collapses too ("ONE LEVEL ... Do not reintroduce the split"). The Taylor Swift demo
  group will hit this directly, since Taylor's Version is one Release Group with two Releases. The
  prompt's rule already answers it — two editions of one work — but the provider will hand back the
  other shape, and the "excess editions are DROPPED AT THE DOOR AND COUNTED" rule is what absorbs it.
- "For television libraries, Fix Match… is only available at the show level (not at the season or
  episode level)" — a limitation CanonCore does not inherit, since nothing is typed and every item is
  addressable.
- Note the shape: Fix Match is a **modal per-item flow**, which reads at first like the prompt's
  refusal ("No enrichment wizard. No multi-step per-item flow of any kind"). It is not the same
  thing — that refusal is aimed at compulsory bulk enrichment, and the prompt explicitly keeps "a
  review queue with a per-item detail view". Worth stating so an implementer does not read the
  refusal as banning a correction dialog.

### 076 — https://support.plex.tv/articles/201018507-download-media/
"the **Download** action in the web app lets you **download the source file** to the machine you're
using ... The file downloads to the browser's download folder OR the file will load in a player in the
browser window." Owner-only: "Downloading is not available for shared libraries."
**ABSENT** — and it is worth more to CanonCore than it is to Plex. **MEDIUM/HIGH.** Direct-play-only
plus no remuxing (060) means unplayable files are not an edge case but a routine outcome, and the
prompt's answer stops at "When a file will not play, say so plainly". Saying so *and handing over the
file* turns a dead end into a working path through VLC or IINA, and costs one route on top of the
opaque-id playback route the prompt already specifies. See GAPS.
Offline sync / download-for-offline — **REFUSED** (that is the transcoding-and-sync product).

### 077 — https://support.plex.tv/articles/201019537-rename-a-badly-named-file/
An entire support article whose remedy is "rename the file so it matches the correct show details",
because "**Your media files are identified by the way they have been named**".
**DIVERGENT, deliberately, and this is reason #2 the product exists.** One transferable detail: the
diagnostic step is "Get Info → Check the file name in the Media Info pane" — the owner must be able
to see the exact path the catalogue is holding. CanonCore's "PATH IS LOCATION, NOT IDENTITY" makes
the path a displayable attribute rather than a lever, which is the right shape; the prompt just never
says it is shown. **LOW**.

### 078 — https://support.plex.tv/articles/201035968-generating-sample-files-from-media/
A support workflow: cut a <50MB sample that still reproduces the bug, upload it somewhere, link it in
the forum thread. Recipes via `dd`, MKVToolNix, and the bundled transcoder
(`PlexTranscoder -i in.mp4 -t 120 -map 0 -c copy out.mp4` — note `-c copy`, i.e. remuxing, the
capability 060 shows CanonCore is giving up).
The finding is the aside, not the article: "**In most cases, your Plex Media Server will exclude
files with `sample` in the filename.**"
**ABSENT — scanner exclusions of any kind.** **MEDIUM/HIGH.** The prompt says only that "The scanner
takes media files and playback sidecars, and nothing else" — a positive filter with no negative one.
Every real media tree contains things that match that positive filter and must not be catalogued:
`sample` files, `trailer` files, Synology's `@eaDir` thumbnails, `.Trash-1000`, macOS
`.DS_Store`/`._` resource forks, and in-progress downloads. There is no ignore file, no keyword, no
path exclusion and no hidden-file rule in the prompt. See GAPS.

### 079 — https://support.plex.tv/articles/201053748-overview/
Plugins. **This article is the primary source for a claim the prompt already makes**, and it confirms
it verbatim: "**we have officially announced that we'll be slowly removing plugin support in Plex over
time. This is an intentional effort. We have already removed support for using plugins to play content
as well as the ability to install a plugin through Plex Web App (plugins must be installed manually
now).**"
**ADOPTED** — "Plex opened plug-ins, closed them in 2018 at under 2% usage, stranded the ecosystem for
seven years, then reopened in 2025 as a plain HTTP contract. Build it because the model needs many
sources, not as a moat." A provider being a URL and never code in the app is the direct lesson.
One incidental: the uses named for plugins were "managing subtitles, **exporting data about your media
libraries**, or more" — export is what Plex's users had to write plugins to get. CanonCore refuses
export outright ("No fork, no export, no import"); worth knowing that is the demand this closes off.

### 080 — https://support.plex.tv/articles/201100678-repair-a-corrupt-database-1-22-0/
Database corruption and hand repair. Rules: it "might happen if the computer is turned off without
first quitting Plex Media Server"; remedy is `PRAGMA integrity_check` then a dump-and-restore
(`.dump > dump.sql`, delete, reload), and delete the `-shm`/`-wal` sidecars before restarting; "It's
always a good idea make a backup copy of the database file before doing any work on it."
Two findings, one of them large.
1. SQLite-class corruption from an unclean shutdown is **largely designed out by the prompt's Postgres
   choice**. That is a real, uncosted benefit of a decision the prompt made for other reasons, and it
   is worth writing down on the positive side of the Postgres-on-a-NAS tension noted at 052.
2. **The escape hatch Plex has and CanonCore does not**: "You can also simply delete the ...
   database file while the Plex Media Server is not running. Restarting the server will then restore
   your server to a nearly-fresh install state. (i.e. You will **lose your existing libraries and need
   to recreate them**, but you won't be affecting your content itself.)"
   Plex can throw its whole catalogue away and rebuild it from disk, because the filesystem *is* the
   source of truth. **CanonCore's catalogue cannot be rebuilt from anything** — hand-made placements,
   owner statements, ranks, remembered rejections and the ordering that is the entire product exist
   nowhere else. **This is the strongest possible argument for the backup gap already opened at 040,
   and it upgrades it from important to existential.** **HIGH.**

### 081 — https://support.plex.tv/articles/201101586-unmatch-an-item/
"Un-matching an item **removes any matched information** and returns the item to an un-matched
state ... if an obscure item has been incorrectly matched and its correct match doesn't appear in the
on-line databases ... the item should be un-matched in order to **manually enter details**."
- **Unmatch as an operation — ABSENT**, **MEDIUM**. The prompt has remembered rejections at match
  time ("REJECTIONS ARE REMEMBERED, or the queue refills with the same questions forever") but no way
  to revoke a binding that was *accepted* and has since proved wrong. In CanonCore the operation is
  well-defined and cheap — drop the statements sourced to that provider for that item, drop the
  identifier statement that bound them, and record the rejection so the queue does not re-offer it —
  but nothing names it.
- The *reason* Plex gives is a direct contrast where CanonCore is better: you unmatch **so that you
  can hand-author**, because in Plex provider data and owner data occupy the same single-valued slot.
  In CanonCore the Owner is a first-class source that sits first in the source order, so owner
  statements coexist with and outrank provider ones and nothing needs removing first. **ADOPTED and
  stronger** — worth keeping as a worked justification for the multi-valued design.

### 082 — https://support.plex.tv/articles/201105343-advanced-hidden-server-settings/
A whole tier of settings deliberately kept out of the UI, edited in `Preferences.xml`, a plist, or the
Windows registry — and doubling as the recovery mechanism: "If you get into trouble, you can reset the
server to default by deleting the preferences file ... **Deleting the preferences file will not affect
your Plex Media Server library database.**" (Settings and data are separate stores; that separation is
what makes the reset safe.) Also a `PLEX_MEDIA_SERVER_USE_SYSLOG=true` environment variable, with the
exact file to set it in on six distributions.
Findings, in order of weight:
1. **`ArticleStrings` — "A comma-separated list of words considered to be grammatical articles, which
   are removed in sort titles. `the, das, der, a, an, el, la`".**
   **ABSENT — MEDIUM.** `sort_name` is a column in the prompt and nothing says how it is produced.
   Article stripping is the whole of what a sort name is for, it is language-dependent (Plex's
   default list mixes English, German and Spanish in one flat list, which is already wrong for a
   Spanish title beginning "la"), and it is a decision of exactly the same class as `release_date`,
   which the prompt says to define precisely because two implementers would fill it two ways.
   The fixture archive is full of titles beginning "The".
2. **A settings store at all — ABSENT, MEDIUM.** The prompt names at least four pieces of global
   configuration and gives none of them a home: the two enrichment thresholds ("Both numbers
   tunable"), the single global source order, the declared edition order, and the scan schedule
   implied by "Support explicit periodic scans". Each is placeable — provider rank on `providers`,
   thresholds on the one `owners` row — but placing them is a decision, and the prompt's own rule
   ("Do not introduce a configuration option ... unless something in the repo reads it in the same
   change") governs how *new* ones enter, not where the existing four live. See GAPS.
3. **`AlbumSort` — "A `field:direction` value for the default album sort ... `year:desc`"**, with a
   note that later versions moved it to a UI setting "per library/per artist".
   **ABSENT — MEDIUM.** CanonCore defines ordering thoroughly for `is_ordered` containers and says
   nothing about the other kind: an unordered container and a browse grid have no stated default sort,
   and "rule-derived containers carry NO order" makes the question unavoidable rather than optional.
4. Concrete defaults worth having on file: `LogNumFiles` retains 5 past log files;
   `ScheduledLibraryUpdateInterval` 1800s; `GenerateBIFFrameInterval` one preview thumbnail every 2
   seconds with `GenerateBIFKeyframesOnly` on by default; `RadioDaysSinceLastPlayed` 2;
   `RadioDirectoryLimit` 50; `LongRunningJobThreads` defaults to half the CPU's threads;
   `enableLocalSecurity` defaults to 1; `secureConnections` 1 = Preferred, 0 = Required;
   `DlnaEnabled` 0; `GdmEnabled` 1.
5. **`TranscoderDefaultDuration` — "Duration in minutes to use when transcoding something with an
   unknown duration. `120`".** Plex's answer to unknown duration is to assume two hours. CanonCore's
   is better and already stated ("Percentage is the fallback only where duration is unknown"), but
   the existence of this setting is more evidence for 043: unknown duration is common enough to need
   a documented fallback constant.

### 083 — https://support.plex.tv/articles/201105738-creating-and-managing-server-shares/
The whole multi-user sharing story: invite by username or email, per-server or per-library selection,
an invite link that can be passed out of band ("you can copy this link and give it to them"), a
pending-invitations state on both sides ("Library Request Sent" / "Library Invitations Received"),
edit-access and remove-access, and Plex Pass restrictions by content rating "as well as content that
you've set with a specific **label**".
**REFUSED / DEFERRED** — "Single user, one password, no signup, no multi-tenancy" and "No visibility
system ... Add it when multi-user arrives, which is when it first means anything." The prompt's
`owner_id` on every table is what makes this a later migration.
Two things worth carrying forward for that later day: an invite has a **pending state on both sides**,
which is a table not a boolean; and Plex uses **labels as an access-control dimension**, which is the
exact pressure that would turn CanonCore's "a tag is a `category` statement" into a permissions
mechanism. The prompt's refusal of a tag table is what stops that.
**LOW** now.

### 084 — https://support.plex.tv/articles/201106098-how-do-i-find-the-plug-ins-folder/
Filesystem locations for the plug-ins directory on four platforms. **REFUSED** by "a provider is a URL
answering a contract — not a plugin, not a repo, and never code running inside the app." No finding.

### 085 — https://support.plex.tv/articles/201106148-channel-log-files/
Plugin logs live in a **different directory from server logs** (`PMS Plugin Logs`), and — the useful
part — "The third-party '**WebTools**' plugin also allows viewing and downloading logs associated with
your server install."
**ABSENT**, folds into 022: the log-viewing affordance Plex never built was supplied by the community
as a plugin, which is what a missing feature looks like when the product has an extension point.
CanonCore has no extension point that could absorb it (providers answer a metadata contract and
nothing else), so anything of this kind has to be in the product or nowhere. **LOW** on its own,
**MEDIUM** as evidence for the logging gap.

### 086 — https://support.plex.tv/articles/201112887-fling-media/
**Controller/receiver split**: one app drives playback that is happening on another. Two entry modes —
"If you connect to the other app prior to playback, then any playback you start with your controller
app will actually take place on the receiver app. If you connect to the other app **while already
playing** media on your device, then that media will immediately be flung to the receiver app and
begin playing there" — and afterwards "you'll see the Now Playing controller screen on your
controller app."
**ABSENT** — **MEDIUM.** The prompt ships web, then phone, then TV, and "phone as the remote for the
TV app" is the pairing users will expect the moment both exist; it is also the standard way a TV app
avoids ever needing text entry, which matters given the prompt's own note that "React Native's
TextInput is not built around the tvOS focus engine". It needs a session concept the prompt does not
have (see 059/067), and hand-off mid-playback needs the progress row to be authoritative across
devices, which it already is.

### 087 — https://support.plex.tv/articles/201122318-mounting-network-resources/
Mounting the NAS share the media lives on. The load-bearing sentences: "**this resource needs to be
available whenever the PMS is active**. This means that you will need to auto-mount the share so it's
available when you log onto the machine"; and "Using the Login Items method **won't automatically
re-mount a missing mount**. There are 3rd party applications that will handle this condition."
**ABSENT — and it supplies the mechanism behind the 042 gap, which makes both more actionable.**
**MEDIUM/HIGH.** The prompt commits CanonCore to network and FUSE mounts ("DO NOT ASSUME FILESYSTEM
CHANGE NOTIFICATIONS FIRE ... Support explicit periodic scans"), and this article says those mounts
drop and do not come back on their own. A periodic scan over a dropped mount sees an empty directory
and, without a rule, concludes every file was deleted. The mitigation is small and concrete: **before
a scan may conclude that files are missing, verify the scanner root itself is present and
non-empty**, and abort the scan rather than record deletions if it is not. Say it as a rule, next to
the periodic-scan rule it protects. See GAPS.

### 088 — https://support.plex.tv/articles/201128288-why-don-t-videos-from-itunes-amazon-etc-play/
A one-paragraph flat refusal: "Videos purchased from iTunes (and most other similar online stores such
as Amazon) have Digital Rights Management (DRM) ... **third-party applications such as Plex are not
legally allowed to play that content.** This is a limitation implemented by Apple and the content
creators and is not something that Plex has control over."
**ADOPTED in spirit** — the same posture as "When a file will not play, say so plainly", and a good
model for the tone: name the cause, name who owns it, offer no workaround. **LOW** as a gap; a DRM'd
file simply fails to direct play like any other. Worth noting the article exists at all, which says
the case is common enough to need a canned answer.

### 089 — https://support.plex.tv/articles/201142378-deprecated-plex-media-center-windows-os-x/
404 (the article on the deprecated Plex Media Center desktop app is gone). No content. **N/A**.

### 090 — https://support.plex.tv/articles/201154176-overview/
The complete server-settings taxonomy, useful as a checklist of what a mature product in this
category treats as top-level: General, Remote Streaming, **Agents**, **Library**, Plugins, **Network**,
Transcoder, **Languages**, **DLNA**, **Scheduled Tasks**, **Extras**, Libraries, Optimized Versions,
Live TV & DVR, Troubleshooting.
Of the fifteen, CanonCore has no equivalent surface for **Languages** (019/062), **Scheduled Tasks**
(041/050), **Network** (059), **DLNA** (051) or **Troubleshooting** (022), and deliberately refuses
Transcoder, Optimized Versions, Live TV and Plugins. That distribution is itself the finding: the
prompt's refusals are concentrated in playback, and its silences are concentrated in operations.

### 091 — https://support.plex.tv/articles/201154527-move-viewstate-ratings-from-one-install-to-another/
"The watched/unwatched, view progress, and ratings are stored in an **install-independent fashion**
that makes them easy to move between installations or servers." Recipe is a SQLite dump of one table,
`metadata_item_settings`, carried to the other install and replayed.
**REFUSED as a feature** — "No fork, no export, no import, no cross-instance sharing." But two things
survive the refusal:
- Plex deliberately keyed watch state on something portable rather than on library row ids, because
  its library ids churn on every rebuild. CanonCore's ids are stable surrogates from the first
  migration and its aliases table keeps merged ids resolvable forever, so the problem this article
  solves does not arise. **ADOPTED by construction.**
- The article's existence says what its users consider irreplaceable when everything else can be
  re-derived from disk: the watch history. For CanonCore *everything* is in that category. More
  weight behind the backup gap (040, 080).

### 092 — https://support.plex.tv/articles/201154537-move-media-content-to-a-new-location/
**The single best piece of evidence in this shard for a decision the prompt already made.**
Plex's advice for a drive upgrade is to make the new drive lie about being the old one: "the easiest
thing to do is to **name the new location exactly the same as the original one** ... If you've done
things correctly, **your server won't even know that anything has changed**."
And if you cannot, an entire multi-step procedure: disable "Empty trash automatically after every
scan" *first*, stop the server, copy the files, add the new folder **alongside** the old one, scan,
then remove the old folder — one library at a time.
**ADOPTED, and CanonCore is dramatically better**: "PATH IS LOCATION, NOT IDENTITY, so a moved file is
the same file. This is Plex's exact algorithm — it computes this on every file and then does not use
it to relink moves." This article is the proof of that sentence: a whole support procedure exists
solely because Plex declines to relink by a hash it already has.
Transferable detail: **step one of the procedure is to disable the trash auto-empty**, i.e. the first
thing you must do before touching storage is disarm the mass-delete. More weight behind 042/087.

### 093 — https://support.plex.tv/articles/201165546-overview/
How flinging actually works, stated plainly and worth copying: "we may talk about 'flinging playback'
from one app to another, but **that's not actually what's happening** behind the scenes ... what
you're actually doing is: **Ceasing playback on the current App; Instructing the second App to start
playback of particular content at a specific offset** (i.e. at the same timestamp as you were
watching). So, the second App actually initiates the playback itself and thus the playback will be
based on the settings and capabilities of that device/App."
**ABSENT**, **MEDIUM** (with 086), and cheap: there is no stream hand-off, no session migration and no
shared decoder state — just stop, then start elsewhere at an offset. CanonCore already has the two
pieces this needs (a server-side progress row per owner+edition, and an opaque-id playback route), so
fling is a control message rather than a subsystem.
The worked example — the same 1080p TrueHD file transcoded for an iPad and direct-played by Plex HTPC —
is another statement of the 060 point: the playback decision belongs to the receiving client and its
declared capabilities, not to the item.

### 094 — https://support.plex.tv/articles/201165566-controlling-flung-media/
The controller's Now Playing screen drives pause/stop/seek on the remote app. One detail worth having:
on disconnect "you'll be asked whether you wish to **continue playback on your controller device**.
Accepting the offer means playback will stop on the app you were previously controlling and will then
resume on the controller app." Hand-back is an explicit prompt, not an assumption — the same
"offered, never auto-played" instinct the prompt applies to Continue Watching. **ABSENT**, **LOW**,
folded into 086/093.

### 095 — https://support.plex.tv/articles/201187656-how-do-i-manually-install-a-plugin/
Install a plugin by downloading a `.bundle` directory from a forum post or a GitHub zip, renaming it
to strip the `-master` suffix, dropping it into a folder on the server, and restarting.
**REFUSED**, and this article is the argument for the refusal rather than a gap: unsigned code from a
forum post, executed in-process, installed by filename convention. "A provider is a URL answering a
contract — not a plugin, not a repo, and never code running inside the app" is the whole of the fix,
and the prompt's Safe External Fetch boundary is what makes the URL version safe.

### 096 — https://support.plex.tv/articles/201198426-restart-plex-media-server-setup-from-scratch/
Two levels of reset, deliberately distinguished: delete the support folder, which "will restart as a
fresh install" while "retaining some saved server information such as your Plex account sign-in and
**server identity**"; or uninstall fully, which removes everything.
Warning, verbatim: "This procedure will remove your entire Library. **You will have to re-scan, fetch
metadata, and re-do any metadata edits.** It does **not** remove actual media files."
- **A reset-to-empty operation** — **ABSENT**, **LOW/MEDIUM**. Cheap, and the demo instance in
  particular wants one.
- **The split between server identity and catalogue data** — **ABSENT**, **LOW** now, **MEDIUM** once
  clients exist: a client that has paired with an instance needs that instance to keep an identity
  across a catalogue rebuild.
- "re-do any metadata edits" is the cost Plex waves away in a sentence because for Plex it is a
  handful of poster swaps. For CanonCore that phrase covers the placements, the orderings, the ranks
  and every owner statement — i.e. the entire product. Third article in this shard pointing at the
  same missing thing (040, 080, here).

### 097 — https://support.plex.tv/articles/201206866-cast-from-browser-or-desktop/
Chromecast from Chrome. The architectural sentence, stated twice across 097/098: "**the Chromecast
streams content directly from the Plex Media Server**. When you use the Plex Web App to initiate a
cast, the content **does not** go 'through' that browser and then to the Chromecast." Consequences
Plex spells out: "it's possible to start the cast with one device and then connect to the Chromecast
later from a completely different device to control the playback."
Hard requirement worth noting: "**Chromecast also requires secure connections**" — plus the hosted web
app rather than the bundled one, and Chrome specifically.
Also: "It isn't currently possible to simply disconnect from an existing Chromecast session with Plex
Web App and let it continue on its own" — a stated limitation, and the opposite of the fling hand-back
at 094.
**ABSENT** — **MEDIUM**. Casting is how a phone reaches a television without a TV app, and the prompt
puts the TV app last on purpose. The mechanism fits CanonCore's design almost exactly: a cast receiver
needs a URL it can fetch on its own, which "playback goes through an app-owned opaque-id route" already
provides. What it also needs is HTTPS and reachability, which is the 059 gap — this is the concrete
case that makes inbound transport a product question rather than a deployment one.

### 098 — https://support.plex.tv/articles/201214366-casting-support/
Same claim generalised, plus **content mirroring**: "as you browse your content on your device,
details for the item are shown on your Chromecast to help create an immersive experience." Browsing
state on one device driving a display on another. **ABSENT**, **LOW** (folds into 097).

### 099 — https://support.plex.tv/articles/201236446-agents-only-style-guide-examples/
404 — the agent style-guide examples article is gone. No content. **N/A**.
(Worth noting what it *was*: a style guide for agent authors, i.e. rules about how a metadata source
should shape the values it returns. CanonCore's equivalent is that "CanonCore owns the field set and
every vocabulary" and unmatched values are dropped at the door, which enforces in code what Plex
documented in prose.)

### 100 — https://support.plex.tv/articles/201242707-plex-media-scanner-via-command-line/
**An admin CLI, and the most useful structural finding in this batch.** The full verb list, verbatim:
`--refresh`, `--analyze`, `--analyze-deeply` ("Fully read and perform deep media analysis"), `--index`
(preview thumbnails), `--scan`, `--info`, `--list`, `--generate` ("Regenerate thumbnails/fanart"),
`--tree` ("Show a section tree"), `--reset` ("**Delete all media out of a section**"),
`--add-section --type <type:1,2,8> --agent --location **--lang**`, `--del-section`. Scoped by
`--section`, `--item`, `--directory` or `--file`, modified by `--force`, `--no-thumbs`,
`--chapter-thumbs-only`, `--thumbOffset`, `--artOffset`.
`--tree --section 29` prints every item with its file paths beneath it.
**ABSENT — MEDIUM/HIGH.** The prompt describes a monorepo of `apps/` and `packages/` with a web app
and never a command-line surface, and a CLI is the single answer to several gaps opened separately in
this shard: lockout recovery (069), backup and restore (040/080), triggering a scan or refresh at a
chosen scope (041/056), reset to empty (096), and any scripted or cron-driven operation. Self-hosted
software is operated from a shell by the person who installed it. See GAPS.
Two details: the scope flags are the same ladder as 056 (everything / one library / one item / one
path), so a CLI and a UI can share one vocabulary; and even the CLI's `--add-section` carries
`--lang`, which is the fourth appearance of the locale gap (038, 039, 075, here).

### 101 — https://support.plex.tv/articles/201272763-edit-details/
**The article that verifies claim #3 in the prompt's own "WHY THIS DOES NOT ALREADY EXIST".**
Verbatim: "Fields set to **locked** when manual changes are made indicated by the change of field
title color and lock icon being a closed lock. **Locked fields will not update on metadata
refreshes.** Unlock a field by clicking on the field title."
That is the boolean lock, exactly as the prompt describes it: "The ceiling across every comparable
tool is a boolean lock, which answers 'may I overwrite this?' and never 'where did this come from?'"
**DIVERGENT, deliberately, and now confirmed from the primary source.** CanonCore's answer —
"A field can hold SEVERAL VALUES AT ONCE, all live and visible, with the owner marking a favourite ...
THE FAVOURITE IS THE LOCK. There is no separate per-field lock flag" — is a strict improvement, and
note the implicit lock semantics Plex has and CanonCore must reproduce: an owner edit must survive a
refresh without being told to.
Other findings:
- The editable field list: "**Title, Sort Title, Original Title, Edition, Original Release Date,
  Content Rating, Studio, Tagline, and Summary**", described as "simple text entry fields which are
  considered a single entry".
  **`Original Title` is ABSENT — MEDIUM.** In the prompt `title` is a column, single-valued, with no
  language attached, so the original-language title and the localised one cannot both exist. This is
  where the locale gap (038) touches the schema rather than the contract: either `title` gains a
  companion `title` *property* whose statements carry a language qualifier, or the field set has no
  home for it. `Sort Title` being editable is also the other half of the `ArticleStrings` finding at
  082 — a derived sort name must be overridable.
  Note also that Plex's "Edition" here is a **plain text field on the item**, which is why the 054
  article insists you use the filename token instead: their own editor cannot really model it.
- "**Tags** include metadata such as directors, writers, genres/categories, collections and more.
  These are items that can have more than one value and are typically available for sorting or
  filtering." — Plex's word for a multi-valued field. **ADOPTED**: statements, with "Field values AND
  relationships, one mechanism".
- "**Labels** are used for fine-grained restrictions on libraries you give others access to."
  **REFUSED**, and it is the exact failure the prompt's "No tag table" rule prevents: once a label
  exists as its own thing, it becomes an access-control primitive, and then it can never be an
  ordinary owner assertion again.
- Artwork types offered: "Posters/Thumbnails, Backgrounds, **Title Art/Logo** and **Square Art**" —
  three of four match CanonCore's `poster|backdrop|title-logo|still`; square art is the one missing
  (already noted at 016), and `still` is Plex's episode thumbnail.
- "**Pick from the Web (paste in a URL to an image)**" — **ABSENT, and a genuine ambiguity in the
  prompt. MEDIUM.** The refusal reads "no uploads, no artwork scanning, no `.nfo`" and the artwork
  table takes a "Provider-supplied URL". A URL the owner pastes is none of the three refused things,
  and every piece of machinery it needs already exists: the Safe External Fetch boundary is specified
  for exactly "every user-supplied URL", the artwork row already carries a source, and the palette is
  extracted on fetch. It would also cancel the accepted cost that "a private instance with no provider
  connected has no artwork". Whether the Owner may be a source of artwork is a one-line decision the
  prompt does not make. See GAPS.
- Editing is available on **mobile, web and TV** — the TV client is not read-only in Plex. The prompt
  says nothing about which clients can write.

### 102 — https://support.plex.tv/articles/201273953-collections/
**The most important article in the shard for CanonCore's own claims, and it verifies two of them
verbatim.**

*Verification 1 — cross-library collections are string matching.* Prompt claim #4: "A Plex collection
can only appear to span libraries when the collections carry exactly the same NAME, matched as
strings." The article: "The collections details page contains all the items in that library that
belong to the collection. **It can also include items from other libraries that are in a collection
with the exact same name. By adding items in different libraries to identically-named collections, you
can relate them to each other.** For instance, you can have Star Wars movies, TV shows, and music
albums all in a 'Star Wars' collection." **CONFIRMED.**

*Verification 2 — smart collections cannot be hand-ordered.* Prompt: "A container is EITHER
hand-placed OR rule-derived; a rule-derived container carries NO order ... This is the split Plex
ships as manual versus smart collections, and its smart collections deliberately cannot be
hand-ordered." The article: "**Custom Collection Order.** The content of regular 'dumb' collections
can be reordered in any arbitrary way the server admin chooses ... **This is not available for
'smart' collections, which are always ordered by the sort chosen when creating or editing the filter
for the smart collection.**" **CONFIRMED**, with one refinement worth folding in: a smart collection
is not *unordered*, it carries a **derived sort** chosen with the filter. "Carries no order" should be
read as "carries no hand order" — a rule-derived container still needs a sort, which is the same gap
as `AlbumSort` at 082.

The rest, and the design pathology CanonCore avoids:
- **A manual collection is a string tag on the item**: "You can manually create a collection by adding
  a `Collections` tag to an item. Add other items to a collection by giving them the same collection
  tag." There is no membership row and no container row — until you customise one, at which point it
  becomes a ghost: "**Why are there collections with zero items?** You will find after removing all
  the collection tags from items, the collapsed collection itself remains, but with zero items in it.
  These are kept because you might have made customizations to the collection (artwork, a description,
  etc.)."
  **DIVERGENT, and this is the whole argument for the prompt's model**: containers are Items with real
  ids, membership is a `placements` row with a stable surrogate id, and "MUTATIONS NAME A PLACEMENT,
  NOT AN ITEM". None of Plex's three problems here — name-matched identity, phantom empty
  collections, membership that cannot carry per-placement facts — can arise.
- **Provider-supplied containers, with a materialisation threshold**: "In the settings of a movie
  library go to the Advanced tab. Set '**Minimum automatic collection size**'. Options are Disabled, 1,
  2, 3, or 4. Collections will be created when the number of items in the collection exist in the
  library." Plus the honest limitation: "The Movie Database only has collection data for sequels not
  'universes'. There will not be a 'MCU Collection' but there will be an Iron Man collection."
  **PARTIALLY ADOPTED** — CMPP's optional `browse` already "returns a container AND its ordering, so
  browsing a range yields placements for free". **The threshold is ABSENT and is a good idea worth
  taking: MEDIUM.** Without it a catalogue enriched from a provider fills with one-member containers,
  which is precisely the complaint this setting exists to answer ("This may cause many unwanted
  collections to be automatically created, particularly collections where you only have one item").
  Note also, for the third time in this shard, non-retroactivity: "Changing this settings will not
  affect existing collections."
- **How a container and its members share one browse list** — three-valued: "**Disabled**: Don't
  display collections inline at all, show items. **Hide items which are in collections**: If an item
  belongs to a collection, do not show the item in the main library when browsing. **Show collections
  and their items**." With the constraint that inline collections "will only appear when the library
  is filtered by ALL and sorted by Title/Name."
  **ABSENT — MEDIUM.** And harder for CanonCore than for Plex: "hide items which are in a collection"
  is decidable when membership is single, and undecidable when an item is in four containers, which
  is the normal case here (the archive's median is 4). The prompt settles the *item page* ("'Also
  appears in' is ONE list containing both hand-placed and rule-derived containers, with a filter
  rather than a split layout") and says nothing about the browse grid.
- "the collapsed collection has a poster with **up to 4 images from items in that collection**".
  **ABSENT — MEDIUM**, and a cheap fix to a cost the prompt currently accepts. Containers are Items,
  artwork is provider-only, and a hand-built chronology will never have a provider record — so under
  the current rules every owner-made container is permanently blank. A mosaic composed from members'
  existing artwork needs no upload, no scanning and no provider; it is a rendering, not a stored
  asset. See GAPS.
- Containers carry their own fields: "you can edit the collection's own metadata to add a custom
  poster, a summary, a background image (fanart), and (for manual collections) choose the sort order."
  **ADOPTED** — containers are Items and items are field-bearing.
- Typed-library fragmentation, stated plainly: "**Collection tags cannot be added to photos.**" and
  music collections have no details page and never collapse inline. **DIVERGENT** — the prompt's
  "WHY never typed by medium" in one sentence.
- "If you have MP4s with an embedded 'Album' tag, the Local Media Assets agent may pick it up as a
  collection" — embedded tags silently creating containers. Confirms 055 and shows the failure mode of
  an untracked source.

### 103 — https://support.plex.tv/articles/201282253-overview/
The per-item action inventory as a single list: Edit, Refresh, Analyze, Sync, Optimize, Mark
Watched/Unwatched, Fix Match, Unmatch, Download, Media Info, Merge, Collections. Useful as a checklist
of what a mature product offers on one item; CanonCore currently specifies four of the twelve.
One rule worth having verbatim: "**Refreshing an item makes the Server grab fresh information for that
item. This will replace any of the information already downloaded (unless the information has been
locked).**"
**DIVERGENT** — refresh in Plex is destructive overwrite guarded by the boolean lock. In CanonCore a
refresh must *add* statements alongside the existing ones and let rank and source order decide, which
is a genuinely different operation wearing the same name. This is the substance of the 041 gap:
"refresh" cannot be borrowed as a word without redefining it, and the prompt never does.

### 104 — https://support.plex.tv/articles/201358253-choose-a-player/
Fling prerequisites. The one hard-won detail: discovery order matters — "**Server first, Player apps
second, Controller (flinging) app last** ... If you don't start them up in this order and the
controller app doesn't see the player, refresh it." A device registry built on broadcast discovery is
fragile in exactly this way. **ABSENT**, **LOW**, folded into 086/093 and the GDM point at 059.

### 105 — https://support.plex.tv/articles/201358273-converting-iso-video-ts-and-other-disk-image-formats/
"**Plex does not support the use of ISO, IMG, Video_TS, BDMV, or other 'disk image' formats.** If you
wish to use those with Plex, you should convert them to a compatible format." Then two strategies with
real numbers — remux ("quick and retains the full quality ... resulting files can be quite large,
anywhere from 2GB to 50GB") versus transcode ("anywhere up to several times the source content
duration ... 500MB to 15GB") — and named external tools (MakeMKV, HandBrake, ffmpeg with
`-crf 18 -preset veryslow`).
**REFUSED** as a capability, **ADOPTED as posture**: declare what is not supported, point at the
external tool that fixes it, build none of it. That is the same move the prompt makes for cloud
storage ("Document rclone and mergerfs ... rather than implementing any cloud integration"), and it is
the model for how CanonCore should handle every unplayable format.
Reinforces the **ABSENT** finding from 024: CanonCore has no declared accept-list for the scanner and
no declared not-supported list. `BDMV` adds to Plex's. **MEDIUM.**


### 106 — https://support.plex.tv/articles/201370363-move-an-install-to-another-system/
Whole-instance migration to new hardware, as a documented, ordered, human procedure. The order is the
content: disable "Empty trash automatically after every scan" **first**; install on the destination and
"just exit out" of the wizard; sign out of the account on the destination and quit the server; stop the
source server, then copy the data directory ("you can exclude the Cache directory"); copy the settings
that live *outside* it — `HKEY_CURRENT_USER\Software\Plex, Inc.\Plex Media Server\` on Windows,
`~/Library/Preferences/com.plexapp.plexmediaserver.plist` on macOS, nothing extra on Linux/NAS; chown
everything `plex:plex`; reboot; start; then per library add the new folder **alongside** the old one,
scan, verify, and only then remove the old one. Final maintenance, in a stated order: re-enable trash
auto-empty, Empty Trash, Clean Bundles ("wait at least a couple of minutes even after the dialog box
goes away"), Optimize Database.
Two caveats stated up front: cross-OS moves are "not officially supported", and "it may not be possible
to retain any existing library access that may have been granted to other Plex accounts".
- **Instance portability / backup and restore — ABSENT, HIGH.** Fourth article in this shard pointing
  at the same hole (040, 080, 096, here), and the one that shows its shape rather than just its size:
  what a self-hosted product owes its owner is a *named, ordered, restorable* representation of one
  instance. Note explicitly that the prompt's "No fork, no export, no import, no cross-instance
  sharing, no merge semantics between instances" does **not** cover this and must not be read as
  covering it. That refusal is about catalogue interchange *between two live instances*; moving one
  instance to a new machine is a byte-identical copy that keeps the same identity, and it is the
  operation Plex documents here. Refusing import/export makes backup **more** necessary, not less,
  because there is then no second path to the data.
- **State scattered outside the data directory** — Plex's Windows registry / macOS plist step is a
  portability tax paid for a decision made years earlier. **ABSENT, LOW**: "everything constituting an
  instance lives in one enumerable place" is not stated anywhere in the prompt, and it is a one-line
  rule that is free now and expensive later. The prompt's Postgres choice means the answer is
  "the database plus the env package", which is already nearly true.
- **The add-alongside / scan / remove-old dance — ADOPTED and CanonCore is better**, for the same
  reason as 092: content-hash identity, "PATH IS LOCATION, NOT IDENTITY", makes the entire per-library
  ritual unnecessary. This article is a second, independent piece of evidence for that sentence.
- **Disable the mass-delete before touching storage** — third occurrence (042, 092, here). At this
  point it is not an incidental tip but Plex's own consistent first step, and it argues for the
  prompt's DELETE section extending to a scanner-level rule: a storage change never triggers an
  automatic removal pass.

### 107 — https://support.plex.tv/articles/201373203-gather-a-process-dump-or-sample-process/
Hang and crash diagnostics. Windows: Task Manager → Create Dump File, with the trap that on 64-bit
Windows you must use the 32-bit Task Manager at `C:\Windows\SysWow64\Taskmgr.exe`. macOS: Activity
Monitor → Sample Process. Linux/NAS: `kill -SEGV <pid>` to "terminate the Plex Media Server with a
dump", then "Restart the server and ensure crash reporting is enabled", "Wait 5 minutes and then
capture the server logs — these would identify the process dump **that gets uploaded** through the
crash reporting process". Every path ends "by posting on the Plex forums".
- **Crash reporting that uploads to the vendor — REFUSED by posture.** Nothing in the prompt authorises
  telemetry, and a self-hosted product whose security section is built around a Safe External Fetch
  boundary and "SHIP NO API KEYS" has no business opening an outbound channel to its author. Worth
  stating as a decision rather than leaving unspecified, since "add Sentry" is the default reflex.
  **ABSENT, LOW** — the gap is a missing one-line refusal, not missing capability.
- Everything else here is a consequence of Plex being a long-running native binary. A Next.js/Postgres
  instance's equivalent diagnostics are the process manager's and the database's, already solved by the
  platform. **N/A.**
- One transferable observation: the whole article exists because Plex's support channel is a public
  forum, so the artefact has to be something a user can attach to a post. CanonCore has no support
  channel and should not grow one; the artefact that matters is the local log, per 022.

### 108 — https://support.plex.tv/articles/201373793-is-plex-media-server-on-a-nas-right-for-me/
The single best argument in this shard **for** a decision the prompt already made. The whole article is
a decision tree, and every branch of it is the transcoder. "Do you plan to run your Plex Media Server on
the NAS or only use it for storage?" — if storage only, "there isn't really anything specific to Plex
that needs to influence which NAS you buy". If not: x86 with a CPU "fast enough to transcode the type of
media you want to watch", or "a supported ARM model", with the note "**ARM models generally do not
support video transcoding at all**", and for those "the format of your media will need to 100% match the
formats your clients can play".
Hard numbers and rules worth keeping:
- "Only some NAS will be capable of good performance when transcoding 720p type content. **Very few NAS
  will be able to do so for 1080p type content.**"
- The nearest thing to a universal profile, stated verbatim: "**Container: MP4 · Video Codec: H.264
  (level 4.0) · Audio Codec: AAC (2.0 audio) · Total Bit Rate: Less than 8Mbps (8000 Kbps)**", prefaced
  by "there simply does not exist any kind of 'universal format' that is compatible everywhere".
- The properties that constitute a "format": "File container ... Video codec ... Audio codec ...
  Subtitle format ... Resolution ... Bit Rate (of both the video and the audio)".
- Two cases where compatible media still transcodes: subtitles that "have to be 'burned in'", and
  remote access at reduced quality.
- **Transcoding, hardware sizing, CPU guidance — REFUSED** ("No transcoding, no ffmpeg, no quality
  ladders"). But note what the refusal *buys*, because this article prices it: direct-play-only deletes
  this entire decision tree. The question "is a NAS right for me?" collapses back to "can it hold the
  files", which is the branch Plex itself says needs no thought. That is the direct answer to the
  deployment tension flagged at 052 — CanonCore on a low-power ARM NAS is fine on CPU and constrained
  only by Postgres, and the CPU half of the objection does not apply at all.
- **The format profile and the client capability profile — ABSENT, HIGH**, folding into 043 and 060
  rather than opening a new gap. This article supplies the concrete field list those two entries needed:
  container, video codec, audio codec, subtitle format, resolution, and *both* bitrates. That is the
  column set the `files` table lacks, and MP4/H.264 L4.0/AAC 2.0/<8Mbps is the baseline profile a
  first client can be checked against. "When a file will not play, say so plainly" needs exactly these
  two lists and nothing more.
- Subtitle burn-in as a transcode trigger — **DIVERGENT with a stated cost**, repeat of 021/058/060.
  Under direct-play-only, PGS and VOBSUB subtitles are simply unavailable wherever the client cannot
  render them itself. The prompt's `files` role `subtitle` makes them catalogue-visible and unplayable,
  which is the honest outcome and should be said out loud in the UI rather than discovered.

### 109 — https://support.plex.tv/articles/201373803-nas-compatibility-list/
A maintained spreadsheet of NAS models against two transcoding capabilities. Two rules stated:
"**Hardware-accelerated transcoding is a premium feature and requires an active Plex Pass subscription
for the Plex Media Server account**", and that "Hardware-Accelerated Transcoding" in the sheet means
specifically Intel Quick Sync Video. Software transcoding entries are "based on estimation of whether or
not the device is capable of performing a single software transcode of the given quality".
- **REFUSED** entirely as capability. The interesting content is the shape of the obligation: a
  per-device compatibility matrix is a permanent, hand-maintained support artefact that exists solely
  because the transcoder's performance varies per SoC. Direct-play-only means CanonCore never owes
  anyone this document, and that saving is real and ongoing.
- **A paid tier gating a core capability — REFUSED by posture, ABSENT as a stated rule, LOW.** The
  prompt says CanonCore is "SELF-HOSTED software, plus ONE public read-only demo instance", which
  implies no Plex Pass equivalent, but never says it. Note it once: no feature in a self-hosted
  instance is gated on anything the owner has to buy from us, and the provider-credential rule
  ("SHIP NO API KEYS ... the user supplies their own subscription credential") is the only place money
  legitimately enters the design.
- The estimation caveat is a small honest detail worth copying: where a capability claim is a guess,
  say it is a guess.

### 110 — https://support.plex.tv/articles/201373823-nas-devices-and-limitations/
The supported-NAS vendor list (Asustor, Netgear ReadyNAS, QNAP, Seagate, Synology, TerraMaster, unRAID,
Western Digital MyCloud, "Intel, ARM" per vendor) plus a candid limitations section. The limitations are
three: Linux unfamiliarity ("Even something as 'simple' as finding log files could be hard if you don't
know what you're doing"), processor power ("By far the biggest limitation"), and the low-power case.
The last one is the finding, verbatim:
"Some NAS devices — primarily those with processors based on the ARM architecture — have capabilities
low enough that **transcoding is simply disabled altogether** for them in Plex Media Server. For such
NAS, if you attempt to play content that would require transcoding, **you will simply receive an error
instead**."
- **This is CanonCore's shipped playback design, described by Plex as a degraded build.** "Direct play
  only. No transcoding, no ffmpeg, no quality ladders. When a file will not play, say so plainly" is
  precisely Plex's low-power NAS configuration, made universal and made deliberate. **ADOPTED**, and it
  is useful evidence that the behaviour is at least shippable — Plex ships it to real customers on real
  hardware rather than treating it as impossible. It also fixes the expectation to set: the failure mode
  is an error at press-play, so the quality of that error message is the whole of the user experience
  at the boundary, and it needs the 043/060/108 field lists to say anything more useful than "no".
- **Per-vendor packaging — ABSENT, MEDIUM**, folding into 009 and 031 rather than opening a new gap.
  Eight vendor-specific builds is what a native binary costs; a container image is the modern answer and
  the prompt's scaffold already implies one (`dbSetup docker`), but nothing states the distribution
  artefact.
- "Finding log files could be hard" — reinforces 022. On a self-hosted instance the logs must be
  reachable from the UI, not only from a shell the owner may not have.

---

## GAPS — ABSENT FROM CANONCORE

Consolidated from all 110 articles. MEDIUM and HIGH only; LOW findings stay in the entries above.

A gap here means the prompt says **nothing** — not that it decided against. Several of these are
things the prompt would plainly refuse if asked, and the point of listing them is that an implementer
should not have to guess which. Ordered by how expensive they are to add later, not by how visible
they are.

### The three that cannot be retrofitted

These change the schema, and the prompt's own FACTS section says exactly this class of thing "CANNOT
be retrofitted ... exist from the first migration or they never work". They are the only findings in
this shard that must be settled before the first migration is written.

**G1. Technical properties of a file. Duration above all.** (043, 060, 093, 108; also 061, 100)
The `files` table has bytes, a hash, a path and a role. It has no container, no video codec, no audio
codec, no subtitle format, no resolution, no bitrate and — decisively — **no duration**. Three
separate rules in the prompt depend on properties nothing produces:
- "Completion is TIME REMAINING under a small absolute figure ... Percentage is the fallback only
  where duration is unknown" treats duration as a metadata claim providers may not supply. For
  anything with a file attached it is a measured property of the bytes and is never missing.
- "Force-complete anything under five minutes" is unimplementable without it.
- "Container progress ... Count-based, never duration-weighted, since runtime is missing for most of
  any real catalogue" is true of the catalogue and false of the files.
Plex runs a distinct analysis pass on add, producing "Container ... Video Codec ... Audio Codec ...
Resolution, Duration, Bitrate, Aspect Ratio, Language" (043), and 108 gives the canonical field list.
**Decide: does the scanner probe, what columns hold the result, and is re-analysis an operation.**
Knowing the embedded audio and subtitle tracks falls out of the same pass and is the only way to
offer a track picker under direct play.

**G2. Split / unmerge.** (073)
Merge is specified at length; its inverse does not exist. An accidental merge is the second of the two
classic destructive mistakes in a catalogue, and the prompt calls delete "the one place data is
actually lost" while leaving merge silently in the same category. Statements keep provenance, so they
know which *source* asserted them, but nothing records which *pre-merge item* they hung off, and
placements, editions and files carry no such mark at all. Reversibility is a schema decision — a merge
record, or `merged_from` on the re-pointed rows — and the alias table already proves the shape is
affordable. Plex ships an undo (with the useful detail that a merged item wears a badge saying how
many things it absorbed, which is the only warning an owner ever gets).

**G3. Several files for one edition.** (054)
Plex has two levels where CanonCore has one, and states the line cleanly: "**Versions all represent
the same release of an item**" (1080p vs 480p, HEVC vs H.264, MP4 vs MKV) whereas "**Editions
represent different releases**" (Theatrical vs Director's Cut). Plex's Edition is exactly CanonCore's
`editions` row — **ADOPTED, and CanonCore's is stronger**, since Plex's lives in a filename token.
Plex's *Version* has no name here. It can only be several `files` rows with role `media` on one
edition, which the schema permits and the prompt never mentions. Under direct-play-only this is not a
nicety: two files of one edition, one of which a given client can decode, is the **only** mechanism
CanonCore has for playing to a device that cannot handle the primary file. Note also that the prompt's
criticism of Plex ("its automatic pick is about what the client can decode, not about which is
canonical") is aimed at Versions but worded as though it were about Editions. For Versions, picking by
what the client can decode is the correct answer, and here it is the only one.

### HIGH — operational, and each one is a way to lose the catalogue

**G4. Backup and restore, and moving an instance to new hardware.** (040, 080, 096, 106)
Four articles, one hole, and it is the largest finding in the shard. Plex tells you to back up before
deleting a library (040) and before touching the database (080), documents a full machine-to-machine
migration (106), and can in the last resort **throw its whole catalogue away and rebuild it from disk**
because the filesystem is its source of truth (080, 096). CanonCore has no such floor. Hand-made
placements, orderings, ranks, remembered rejections and owner statements exist in no provider and in
no file, and are the entire product. State explicitly that "No fork, no export, no import, no
cross-instance sharing" does **not** cover this: that refusal is about interchange between two live
instances, and it makes backup *more* necessary rather than less, because it removes the second path
to the data. What is needed is small — a named, ordered, restorable representation of one instance,
plus the rule that everything constituting an instance lives in one enumerable place.

**G5. What the scanner does when a file it knew about is gone.** (042, 087, 032, 106)
Verbatim from 042: "If you move or delete the file for a library item or if the file somehow becomes
unavailable, then the library item will be placed into the 'trash' ... It can be particularly helpful
in situations where a **drive or network share where content is stored isn't available** when a
Library Update occurs." Restorable by putting the file back; visible as a trashcan badge and an
"Unavailable" indicator; and the auto-empty option carries the warning "content will be removed from
your Library immediately with no chance to simply restore it if there was a mistake."
The prompt has no rule for this at all, and it is not cosmetic: CanonCore is explicitly committed to
network and FUSE mounts whose change notifications "will typically not work", so **an unmounted share
during a periodic scan is indistinguishable from a mass delete**. 087 supplies the mechanism (a mount
that vanishes leaves an empty directory, not an error). Needed: a soft-missing state, a restore-by-
reappearance rule, and a hard refusal to delete catalogue rows on a scan. Note that Plex's own
migration procedure makes "disable the trash auto-empty" its **first** step, three separate times
across this shard (042, 092, 106) — that is the rule stated as a habit.

**G6. Password recovery.** (069, 035)
"Single user, one password, no signup." No signup means no email, which means no reset and **no
recovery of any kind**: an owner who forgets the password is permanently locked out of their own
catalogue. Plex documents a lockout path (editing `allowedNetworks` on the box). The answer must
likewise be something done on the machine — a CLI command, a boot-time secret, or a documented row to
update — and the prompt's rule against unread configuration variables makes that a deliberate change
rather than an incidental one. Related: 069 also confirms Plex's auth switches on *at claim time*, so
an unclaimed server on the LAN is open by documented default. CanonCore's first-run window has the
same shape and nothing describes it.

### MEDIUM/HIGH

**G7. Bulk operations.** (057, 074, 041, 056)
Plex offers multi-select with a per-item action list (Mark Watched/Unwatched, Refresh, Analyze, Merge,
Delete). CanonCore's fixture is 11,285 stories with 93.4% multi-placement; anything the owner can do
to one item they will need to do to hundreds. Nothing in the prompt is written for more than one item
at a time — which also means no preview-with-counts for a bulk destructive action, where the DELETE
section's care is needed most.

**G8. Setting watch state by hand.** (074)
Append-only watch events are the truth and progress is per edition, but nothing says what a manual
"mark as watched" *is*. It has to be a synthetic event, and its shape (source, timestamp, whether it
is distinguishable from a real one) is a decision the event-log design forces and the prompt does not
make. Cascading down a container is the same question at scale, and interacts with dedup.

**G9. Scanner exclusions.** (078, 024, 105, 030)
"The scanner takes media files and playback sidecars, and nothing else" names no accept-list and no
exclusion mechanism. Plex has both: a declared not-supported list ("Plex does not support the use of
ISO, IMG, Video_TS, BDMV, or other 'disk image' formats", 105) and the practical need to keep sample
files, extras and trailers out of the catalogue (078). Direct-play-only raises the value of the
declared list, since a format CanonCore will not play should be refused at the door with an
explanation rather than catalogued and failed at press-play.

**G10. Provider failure, surfaced.** (029, 068)
Unmatched provider fields are "DROPPED AT THE DOOR AND COUNTED" so the owner is told. Nothing does the
same for a provider that errors, times out, rate-limits or returns nothing. With enrichment reaching
all connected providers at once and running in the background against thresholds, a silently failing
provider is indistinguishable from a provider with nothing to say. Related: no per-item enrichment
state visible on the item itself (068).

**G11. Download for offline.** (076)
Worth more to CanonCore than to Plex, and for the reason the prompt itself creates: with no
transcoding, a phone that cannot decode a file cannot play it at all, and a pre-fetched copy is one
of the few remaining answers. Also the only story for playback with no network.

**G12. Markers and intervals inside a file.** (050, 008)
Intro, credit and ad markers. CanonCore already has `edition_coverage` as a set of intervals, so the
structure exists; nothing says whether a marker is one, a statement, or absent by decision. Note the
prompt's own line — coverage "EXPRESSES MISSING PARTS, NOT ABRIDGEMENT" — means markers are probably
*not* coverage, which is a decision worth writing rather than leaving to the first implementer.

**G13. An operational entry point that is not the web app.** (100, 022)
Plex ships `Plex Media Scanner` with `--scan`, `--refresh`, `--analyze`, `--index`. The prompt
describes a monorepo with a web app and no CLI. Every operation in this shard that a locked-out,
broken or headless instance needs — scan, reindex, reset the password, restore a backup, rebuild the
projection — has no home. This is also where G4 and G6 actually land.

**G14. Mount and permission failures.** (087, 032)
The prompt commits to network and FUSE mounts but says nothing about the process identity, what
happens on EACCES, or how a mount that is present-but-empty is distinguished from a folder that is
genuinely empty. A scan that silently skips unreadable directories is the most expensive silent
failure available here, and it is the same failure as G5 seen from the other side.

### MEDIUM — clustered

**G15. Subtitles and language, end to end.** (015, 019, 028, 062, 063, 007, 045, 021, 108)
The single largest cluster in the shard, and direct-play-only makes it sharper rather than softer. The
prompt's sidecar carries "the file it accompanies plus a language" and nothing else. Missing: a
language-code standard; `forced` and SDH as *kinds* of track rather than preferences; a preferred
audio and subtitle language; automatic track selection of any kind; the text formats CanonCore will
accept; a text-encoding column or detection step (mojibake is silent); and subtitle appearance
controls. Plus the stated consequence that PGS and VOBSUB are unplayable wherever the client cannot
render them itself, since burn-in requires the transcoder the prompt refuses.

**G16. Client and device.** (012, 007, 045, 059, 067, 086, 093, 097)
No device or session registry, no revocation, no session lifecycle, no "now playing" with a stop
control, no per-client settings store, and no client-versus-server settings distinction. Also absent:
server discovery on the LAN so a phone or TV app connects without typing an address, and casting or
flinging, which is how a phone reaches a television before the TV app exists. The prompt commits to
phone and TV clients; none of this is optional once they exist.

**G17. Install, packaging and requirements.** (009, 031, 052, 110, 047)
No distribution artefact is named for software whose whole premise is that someone else runs it.
Eight vendor-specific NAS builds is what a native binary costs (110); a container image is the modern
answer and `dbSetup docker` already implies one. Also absent: a stated requirements matrix, a version
display and update notification. The specific edge worth recording rather than discovering: the prompt
fixes **Postgres**, while every NAS-targeted competitor ships SQLite because a consumer NAS is the
modal deployment. Direct-play-only makes CanonCore's CPU need near zero — 108 prices exactly how much
that is worth, since the entire "is a NAS right for me" decision tree is the transcoder — so the
database is the whole of the requirement.

**G18. Settings, first run and lifecycle.** (082, 023, 036, 035, 096, 041, 050, 056)
No settings store, despite the prompt naming at least four pieces of global state (the two thresholds,
the source order, the edition order). No first-run or claim flow. No refresh operation and therefore
no refresh granularity; no scan or maintenance schedule; no reset-to-empty; no separation between
instance identity and catalogue data, which matters as soon as a client has paired.

**G19. Enrichment mechanics.** (018, 075, 081, 017, 027, 055, 068)
Providers cannot declare configuration options. Binding an item to a record by pasting an external id
is absent as an operation, and it is the reliable escape hatch when search is ambiguous — which the
prompt says it is, "forever". Unmatch is absent: nothing revokes a binding that was accepted and has
since proved wrong (though the prompt is *better* than Plex here, since the Owner outranks providers
and nothing needs removing before hand-authoring). Content-based identification (acoustic
fingerprinting) is absent, and matters because CanonCore's matching is title-driven.

**G20. Logging and diagnostics.** (022, 045, 110)
No logging, diagnostics or support-bundle story anywhere in the prompt. 110's aside is the
requirement: "Even something as 'simple' as finding log files could be hard if you don't know what
you're doing." On a self-hosted instance the logs must be reachable from the UI, not only from a shell
the owner may not have.

**G21. Display and navigation.** (057, 102, 101, 082, 039)
Folder view and depth-flattened browsing; a size threshold below which a provider-derived container is
not worth creating (without one, an imported catalogue fills with one-member containers); hiding items
that are already in a container; `Original Title` as a distinct field; how `sort_name` is produced;
and generated derivative assets of any kind (trickplay/preview images).

**G22. Reachability and transport.** (048, 059, 070, 069)
Nothing in the prompt describes reaching the instance from outside the LAN, and nothing describes
inbound transport security. The SECURITY section is built entirely around *outbound* fetches. For
software other people run at home, HTTPS on the way in is the harder half.

**G23. Webhooks.** (005)
Outbound event notifications. Self-hosters wire media servers into everything they own, and this is
the one integration point that costs almost nothing to provide.

---

STATUS: complete
