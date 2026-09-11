# Resolving X1–X6 — evidence against Plex, Jellyfin, and the wider ecosystem

STATUS: all six researched. X1 and X2 done 2026-09-07; X3, X4, X5 and X6 done 2026-09-09.

Started 2026-09-07. Source of the six contradictions:
`docs/research/competitor-sweep/CONSOLIDATED-FINDINGS.md` §2 (INTERNAL CONTRADICTIONS).
Spec under test: `SPEC.md`. X1 and X2 were written when the spec still lived outside the repo as
`prompt.md`; their `prompt.md` line references are to that file, not to `SPEC.md`.

Method for each item: (1) what Plex actually does, (2) what Jellyfin actually does,
(3) what the wider ecosystem and any relevant specification do, (4) which of the
finding's resolution options the evidence supports, and whether there is a better
one none of them named.

Every claim below carries a URL or a file path plus the date it was checked. Where
evidence is thin or I could not verify something, it says so in those words.

---

## X1 — Direct play "say so plainly", time-remaining completion, force-complete under five minutes

The three rules at `prompt.md` L532–542 all need the owner's *file's* duration, container
and codecs. `prompt.md` L532 bans ffmpeg by name; the `files` table (L266–274) is
`bytes, hash, path, role` and holds none of it.

### 1. What Plex actually does

**Plex runs a distinct, automatic analysis pass and stores exactly the fields CanonCore lacks.**

> "Whenever an item is added to one of your Libraries, the Plex Media Server performs some
> analysis on it to gather information… Container: MP4, MKV, AVI, M4A, etc. / Video Codec…
> / Audio Codec… / Resolution / **Duration** / Bitrate / Aspect Ratio / Language"
> — https://support.plex.tv/articles/200289336-analyze-media/ (article last modified
> 16 April 2019; fetched 2026-09-07)

The same page states the purpose in the terms X1 is about: "Your Server, together with your
Plex Apps, can use this information to help determine **whether (and how) content can be
played**." It also confirms duration is a *probed* property that can be wrong and is fixed by
re-probing: "If you encounter problems with media such as **the incorrect duration** or
playback ending prematurely, re-analyzing the item may help fix the issue."

Analysis is a separate pass from scanning and matching, and it is exposed as an explicit
user action at three granularities (whole library, multi-select, single item) — same article.

**Where the values live.** Plex's `Media` element (the per-version record, the closest analogue
of CanonCore's `files` row) carries them as attributes:
`audioCodec`, `bitrate`, `container`, `duration` (ms), `height`, `width`, `videoCodec`,
`videoResolution`, `aspectRatio` — python-plexapi `plexapi/media.py`, `class Media`, lines
11–72 (https://raw.githubusercontent.com/pkkid/python-plexapi/master/plexapi/media.py,
fetched 2026-09-07).

**What tool produces them.** Plex ships *both* candidates, and its licence page names both:

> "Plex Media Server … **MediaInfo – BSD-2-Clause-FreeBSD** … **'Plex New Transcoder' contains
> code from FFmpeg – LGPL-2.1+**"
> — https://support.plex.tv/articles/204096476-license-information/ (fetched 2026-09-07)

So the finding's premise — that MediaInfo "is already in Plex's dependency list" — is
**verified true**. But Plex does not say which of the two performs analysis, and its own docs
warn the two disagree:

> "While the MediaInfo app can provide useful information to you, **it does not analyze media
> in the same way that Plex Media Server does**, so there may be differences in the reported
> information."
> — https://support.plex.tv/articles/201998867-investigate-media-information-and-formats/
> (last modified 15 April 2020; fetched 2026-09-07)

That the transcoder is ffmpeg-derived is confirmed independently by Plex's own transcoder
settings, which document the quality presets as literal `x264opts` strings
(`subme=0:me_range=4:rc_lookahead=10:me=dia:…`) — https://support.plex.tv/articles/transcoder/
(fetched 2026-09-07).

**Plex's answer to "will not play" is not to say so plainly — it is to transcode.** Its
direct-play test is a four-part compatibility check (container, bitrate, codecs, resolution)
against the *client's* declared capabilities, and failing any part falls through to Direct
Stream or transcode:
https://support.plex.tv/articles/200250387-streaming-media-direct-play-and-direct-stream/
(last modified 27 March 2019; fetched 2026-09-07). Plex has no ban to work around, so it never
had to build the "say so plainly" path.

**Does a Plex client report duration back?** Yes, and it is a documented API parameter, not a
workaround. The timeline endpoint takes it:

```
/:/timeline?ratingKey={k}&key={key}&identifier=com.plexapp.plugins.library
           &time={ms}&state={state}&duration={ms}
```
— python-plexapi `plexapi/base.py`, `PlexPartialObject.updateTimeline(self, time,
state='stopped', duration=None)`, lines 1012–1026 (fetched 2026-09-07). Note the default:
when the caller omits `duration`, plexapi substitutes `self.duration` — the value the
*server's own analysis* produced. So the channel exists, but in normal operation the client is
echoing the server, not informing it.

### 2. What Jellyfin actually does

**Jellyfin shells out to ffprobe, and the ffprobe path is derived from the ffmpeg path.**

```csharp
_ffprobePath = FfprobePathRegex().Replace(_ffmpegPath, "ffprobe$1");
```
— `MediaBrowser.MediaEncoding/Encoder/MediaEncoder.cs`, line 221
(https://github.com/jellyfin/jellyfin/blob/master/MediaBrowser.MediaEncoding/Encoder/MediaEncoder.cs,
fetched 2026-09-07). No ffmpeg installation means no probe at all.

The probe command, from `GetMediaInfoInternal` in the same file, lines 503–544:

```
{ffprobe} -i {input} -threads {n} -v warning -print_format json -show_streams -show_chapters -show_format
```

and on empty output it throws `FfmpegException("ffprobe failed - streams and format are both
null.")` (line 571). It also passes `-analyzeduration` and `-probesize` (lines 443–457), which
are ffmpeg's own knobs for how far into the file to read before answering.

**Jellyfin implements "say so plainly" — and it is a 27-member flags enum.**
`MediaBrowser.Model/Session/TranscodeReason.cs` (fetched 2026-09-07) is the closest thing in
this category to the sentence at `prompt.md` L533:

```
ContainerNotSupported, VideoCodecNotSupported, AudioCodecNotSupported,
SubtitleCodecNotSupported, AudioIsExternal, SecondaryAudioNotSupported,
StreamCountExceedsLimit, VideoProfileNotSupported, VideoRangeTypeNotSupported,
VideoCodecTagNotSupported, VideoLevelNotSupported, VideoResolutionNotSupported,
VideoBitDepthNotSupported, VideoFramerateNotSupported, VideoRotationNotSupported,
RefFramesNotSupported, AnamorphicVideoNotSupported, InterlacedVideoNotSupported,
AudioChannelsNotSupported, AudioProfileNotSupported, AudioSampleRateNotSupported,
AudioBitDepthNotSupported, ContainerBitrateExceedsLimit, VideoBitrateNotSupported,
AudioBitrateNotSupported, UnknownVideoStreamInfo, UnknownAudioStreamInfo, DirectPlayError
```

Every one of those names a probed property of the file compared against a declared client
capability. Two of them — `UnknownVideoStreamInfo` and `UnknownAudioStreamInfo` — exist
precisely because the probe can fail.

**Jellyfin's clients do NOT report duration.** `MediaBrowser.Model/Session/PlaybackProgressInfo.cs`
(fetched 2026-09-07) carries `PositionTicks` and `PlaybackStartTimeTicks` and no duration
field of any kind. The only duration in the system is the server's own probed `RunTimeTicks`.

**What Jellyfin does when duration is unknown is worse than anything CanonCore would choose.**
`Emby.Server.Implementations/Library/UserDataManager.cs`, `UpdatePlayState`, lines 491–495
(fetched 2026-09-07):

```csharp
else if (!hasRuntime)
{
    // If we don't know the runtime we'll just have to assume it was fully played
    data.Played = playedToCompletion = true;
    positionTicks = 0;
}
```

An unknown duration marks the item **watched** on the first progress report. That is the
incumbent's fallback, and it is a data-corruption path, not a design.

### 3. Industry standard / best practice

**A scan-time technical-analysis pass is universal in this category. What varies is only which
binary runs it.**

| Project | Probe tool | Evidence (all fetched 2026-09-07) |
|---|---|---|
| Plex | ships both MediaInfo (BSD-2) and an FFmpeg fork | support.plex.tv/articles/204096476-license-information/ |
| Jellyfin | ffprobe, path derived from ffmpeg | `MediaBrowser.MediaEncoding/Encoder/MediaEncoder.cs:221` |
| Emby | same lineage (Jellyfin is a 2018 Emby fork; `Emby.Server.Implementations` is still the namespace) | path name in the file above |
| Audiobookshelf | ffmpeg **and** ffprobe are *required* binaries, auto-downloaded at startup | `server/managers/BinaryManager.js:324-327` — `new Binary('ffprobe', 'executable', 'FFPROBE_PATH', ['5.1'], ffbinaries)`, fetched from ffbinaries.com |
| Sonarr | bundled ffprobe via FFMpegCore — **migrated off libmediainfo** | `src/NzbDrone.Core/MediaFiles/MediaInfo/VideoFileInfoReader.cs`: `// We bundle ffprobe for all platforms`; migration `src/NzbDrone.Core/Datastore/Migration/163_mediainfo_to_ffmpeg.cs` |
| Navidrome | TagLib (default), ffmpeg extractor demoted to legacy | `adapters/gotaglib/gotaglib.go` — `Duration: props.Length…`; the ffmpeg extractor now lives at `scanner/metadata_old/ffmpeg/ffmpeg.go` |

Two of those rows matter a great deal.

**Sonarr's migration is direct evidence against the MediaInfo option.** Sonarr used
libmediainfo and moved *to* ffprobe. The migration file is literally named
`163_mediainfo_to_ffmpeg.cs`, and the class that replaced it is still in a directory called
`MediaInfo/` while importing `FFMpegCore`. The ecosystem's one large project that had chosen
MediaInfo for exactly this job chose to leave it.

**Navidrome is the genuine counter-example, and it is audio-only.** Its default extractor is a
pure-Go WASM TagLib with no native dependency at all, and it gets duration from
`AudioProperties.Length`. TagLib reads container headers; it does not decode. For audio,
ffmpeg-free probing is a live, shipped, default design. For video it is not: no project in
this survey probes video without either ffprobe or MediaInfo.

**Is MediaInfo genuinely a standard alternative?** On licence and provenance, yes:

- **BSD 2-Clause**, "Copyright (c) 2002-2025, MediaArea.net SARL" —
  https://raw.githubusercontent.com/MediaArea/MediaInfoLib/master/LICENSE (fetched 2026-09-07),
  corroborated by the README: "This program is freeware under BSD-2-Clause license conditions."
- **Shipped by Plex**, named on Plex's own licence page (above).
- It is not ffmpeg and shares no code with it.

On fitness, with two caveats worth stating plainly: (i) the one comparable project that used
it migrated away (Sonarr, above); (ii) MediaInfo *reports* — it parses containers and reports
codec, profile, level, duration, bit depth, frame rate. It cannot decode, cannot open a
network source, and cannot answer "will this client play it". That last is fine here: nothing
in CanonCore needs decoding, and a reporter that cannot transcode is arguably a *better* fit
for a product whose rule is "no transcoding" than a tool that can.

**Does any player report duration back to the server?** Three answers:

- Plex: **yes**, `/:/timeline?…&duration=` is a first-class parameter (cited above).
- Jellyfin/Emby: **no**.
- The web platform: **the client is the authority**. `MediaSession.setPositionState()` takes
  `{duration, position, playbackRate}` where `duration` is "a floating-point value giving the
  total duration of the current media in seconds" — https://w3c.github.io/mediasession/ and
  https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setPositionState (both fetched
  2026-09-07). Any HTML5 or AVPlayer client already holds the true duration for free.

So a client-reported duration is a **real pattern with one incumbent behind it**, not a
workaround — but it is a *supplement* everywhere it exists, never the primary source, and it
arrives only after someone presses play.

### 4. Which resolution option the evidence supports

The finding offers three: (a) probing is outside the ffmpeg ban, via MediaInfo; (b) duration
arrives from the client and is written back; (c) rewrite the three rules around what is
knowable.

**Option (c) is not actually available as written, and this is the strongest single finding
here.** `prompt.md` L537 says "Percentage is the fallback only where duration is unknown."
A percentage *is a fraction of the duration*. With no duration there is no percentage either.
The stated fallback is incoherent unless something else supplies the fraction — and the only
thing that can is the client, which is option (b). So the prompt's own escape hatch already
silently assumes (b).

**Option (a) is supported and is the primary answer.** A scan-time analysis pass is universal;
MediaInfoLib is BSD-2-Clause, is not ffmpeg, and is already shipped inside the product
CanonCore benchmarks against. The honest caveat is Sonarr's migration in the other direction.
The honest reframing is that "no ffmpeg" in `prompt.md` sits in a paragraph about
*transcoding* ("Direct play only. No transcoding, no ffmpeg, no quality ladders"), and a
reporter that cannot transcode does not reopen that decision.

**Option (b) is supported as a supplement, not a substitute.** Plex ships the channel; the web
platform hands the client the value for nothing. But it cannot serve "say so plainly *in
advance*", because it only exists after playback has begun.

**The better option none of them named: X1 is two problems, and only one of them is about
probing.**

Splitting it:

1. **Duration** (the completion rules, L535–542). Probing solves this completely. So does a
   client write-back. Both work; do both, with probe as the source of truth and the client's
   first report as a backfill for anything the probe could not open. Store it on `files`.
   This is Plex's exact shape.

2. **"Say so plainly" (L532–533).** Probing solves only *half* of it, and the finding does not
   say so. Both incumbents compute playability as `probed file properties × declared client
   capability profile`. Jellyfin's 27 `TranscodeReason` values are all comparisons against a
   `DeviceProfile` the client sends; Plex's direct-play test is against "the client's playback
   capabilities". **CanonCore has no client-capability concept anywhere in `prompt.md`**, even
   though L761 states "direct-play-only makes client codec coverage load-bearing". Adding
   probing without adding a capability profile still cannot say anything plainly — it can only
   say what the file is, not whether *this* device will play it.

   So the missing schema is two things, not one: technical properties on `files`, **and** a
   declared per-client profile (the industry name is DeviceProfile; the minimum viable version
   is a static per-client-type list of supported containers and codecs, checked into the repo,
   not negotiated). Two named, closed lists compared at play time gives the same sentence
   Jellyfin gives, with none of Jellyfin's transcoding machinery.

**Recommended wording of the resolution.** Probing is outside the ffmpeg ban and is done by
MediaInfoLib at scan time, writing container, duration, and per-stream codec/profile/level
onto `files`; a client's first progress report backfills duration where the probe failed; and
each client ships a static declared capability list so the refusal names the property that
failed, in Jellyfin's vocabulary. That keeps all three L532–542 rules live and does not
introduce a transcoder.

---

## X2 — The Safe External Fetch boundary blocks the first provider

`prompt.md` L581–584 mandates one boundary for every user-supplied URL that denies "localhost,
RFC1918, link-local and cloud metadata addresses". L521–524 makes the first provider "ONE
service, run on a machine the owner controls" — an RFC1918 host, or `localhost` in Docker.

### 1. What Plex actually does

**Plex has no documented outbound SSRF boundary, and its documented use of user-supplied
outbound URLs is a LAN one.** Webhooks let the owner "configure one or more URLs to be hit by
the Plex Media Server", and the first use case Plex names is
"home automation (such as dimming lights when you start playback)" —
https://support.plex.tv/articles/115002267687-webhooks/ (fetched 2026-09-07). Dimming lights
means posting to a Hue bridge or Home Assistant on the LAN. The article documents no scheme
restriction, no address restriction, and no allowlist.

**Where Plex does have a private-address carve-out, it is exactly the shape the finding
proposes.** It is inbound rather than outbound, but the design language is the model:

> "**List of IP addresses and networks that are allowed without auth** — The list of IP
> addresses or networks that can connect to Plex Media Server without authorization. Enter a
> comma-separated (no spaces or tabs!) list of IP addresses or specify a range using
> IP/netmask entries… **Private/LAN addresses can be specified either as a range or as an
> individual IP address. Public (WAN) addresses are not valid for this server setting.**"
> — https://support.plex.tv/articles/200430283-network/ (last modified 23 September 2025;
> fetched 2026-09-07)

Note the four properties: it is typed by hand, it is exact addresses or netmasks (no
hostnames, no wildcards), it is **private-only by construction** (public addresses are
rejected), and it carries a warning that names the consequence — "Any app connecting to the
server this way without being signed in will be treated as the admin/owner." The companion
article calls it "an advanced setting and you should only do so if you understand the
consequences" and buries the reset in a hidden preference (`allowedNetworks`) —
https://support.plex.tv/articles/200890058-authentication-for-local-network-access/ (last
modified 30 April 2019; fetched 2026-09-07).

The separate "LAN Networks" preference on the same page does the inverse: it lets the owner
*declare* which CIDRs count as local, defaulting to "only the network subnet on which the
server is located".

### 2. What Jellyfin actually does

**Jellyfin has no Safe External Fetch boundary at all, and it has been bitten repeatedly.**

Plugin repositories — the closest analogue to CanonCore's providers — take an arbitrary URL
from the admin and fetch it with no validation of any kind:

```csharp
PackageInfo[]? packages = await _httpClientFactory.CreateClient(NamedClient.Default)
        .GetFromJsonAsync<PackageInfo[]>(new Uri(manifest), _jsonSerializerOptions, ct);
```
— `Emby.Server.Implementations/Updates/InstallationManager.cs`, `GetPackages`, lines 104–109
(fetched 2026-09-07). No scheme check, no address check, no response-size cap, no redirect
re-validation. The controller that stores the list is equally bare:
`SetRepositories` assigns the posted array straight to configuration —
`Jellyfin.Api/Controllers/PackageController.cs` lines 178–183 (fetched 2026-09-07).

So Jellyfin's answer to "what if the destination is on the LAN?" is that nothing stops it,
because nothing stops anything. Local plugin repositories work in Jellyfin for the same reason
SSRF works in Jellyfin.

**Three SSRF advisories, the most recent five months ago.** From
`gh api repos/jellyfin/jellyfin/security-advisories` (fetched 2026-09-07):

- **GHSA-rgjw-4fwc-9v96** (2021-05-05, medium) — "`/Images/Remote?imageUrl=<URL>`,
  `/Items/RemoteSearch/Image?ImageUrl=…` … are vulnerable to **unauthenticated** Server-Side
  Request Forgery… The SSRF attack can be leveraged to connect to any HTTP Server connected to
  the same network as the Jellyfin server". The fix was **deletion of the endpoints**, not a
  filter.
- **GHSA-8fw7-f233-ffr8** (2026-04-14, **high**) — "The LiveTV M3U tuner endpoint
  (`POST /LiveTv/TunerHosts`) does not validate the tuner URL", giving local file read and
  SSRF, chained to database exfiltration and admin privilege escalation. An M3U tuner URL is
  *normally* a LAN address, which is precisely CanonCore's case.
- **GHSA-jh22-fw8w-2v9x** (2026-04-14, high) — SSRF plus arbitrary file read via ffmpeg
  argument injection through `StreamOptions`.

**The fix for the high-severity one is the interesting part.** Jellyfin patched it by
"improved sanitization of the affected API endpoint **and the removal of the
`EnableLiveTvManagement` permission on new users by default**". Half the remedy was narrowing
*who is allowed to supply the URL*, not filtering *where the URL points*.

### 3. Industry standard / best practice

**OWASP's guidance is that CanonCore's spec has chosen the wrong half of the cheat sheet.**
The Server-Side Request Forgery Prevention Cheat Sheet splits the problem in two
(https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.md,
fetched 2026-09-07):

> "- Application can send request only to **identified and trusted applications**: Case when
>    allowlist approach is available.
>  - Application can send requests to **ANY external IP address or domain name**: Case when
>    allowlist approach is unavailable."

Case 1's protection is: "An allowlist is created after determining all the IP addresses (v4
and v6 to avoid bypasses) of the identified and trusted applications. The valid IP is
cross-checked with that list."

Case 2's protection — the deny-list of RFC1918, loopback, link-local and metadata addresses
that `prompt.md` L582 specifies verbatim — is filed by OWASP under a heading called
**"Deny-list (Last Resort)"**, opening with:

> "**Deny-lists are bypass-prone. Prefer allow-lists.**"

A provider CanonCore's owner adds by hand is an *identified and trusted application*. It is
Case 1. So the allowlist is not a carve-out from the standard: **the allowlist is the standard,
and the deny-list in the spec is the last-resort fallback for the other case.**

OWASP also names the bypass the spec does not address: DNS rebinding ("an attacker can bind a
legit domain name to an internal IP address… see DNS pinning"). Re-validating at each redirect
hop, which L583 requires, does not cover a hostname that resolves differently on the second
lookup. The standard remedy is resolve-once-then-connect-to-the-resolved-IP.

**Three shipped implementations of the carve-out, in decreasing precision:**

| Product | Mechanism | Granularity |
|---|---|---|
| GitLab | checkbox "**Allow requests to the local network from webhooks and integrations**" plus field "**Local IP addresses and domain names that hooks and integrations can access**" | hostnames, IPv4/IPv6, CIDR, and host:port; max 1000 entries, 255 chars each; **wildcards explicitly not supported** — https://docs.gitlab.com/security/webhooks/ (fetched 2026-09-07) |
| Gitea | `ALLOWED_HOST_LIST`, default `external` | named groups `loopback` / `private` / `external` / `*`, plus CIDR (`192.168.1.0/24`) and wildcard hosts (`*.mydomain.com`) — `custom/conf/app.example.ini` lines 541–546 (fetched 2026-09-07) |
| Nextcloud | `'allow_local_remote_servers' => false` | a single global boolean, no host granularity: "Allow remote servers with local addresses, e.g., in federated shares, webcal services, and more. Defaults to ``false``" — `config/config.sample.php` lines 892–897 (fetched 2026-09-07). Violations raise `OCP\Http\Client\LocalServerException: Host violates local access rules`. |

GitLab's is the strongest and it matches the finding's proposed wording almost word for word:
an owner-declared list of exact hosts, entered deliberately, never wildcarded. Gitea permits
wildcards; Nextcloud has no list at all and only a global on/off, which is the pattern to
avoid — it re-opens the entire private network to reach one host.

**There is no standard specific to this product category.** No media server surveyed publishes
an SSRF policy. Overseerr, Jellyseerr, Sonarr, Radarr and Home Assistant integrations all exist
to talk to LAN services and all rely on "only an admin can configure it" as the whole boundary.
That is convention, not a standard, and it is the convention Jellyfin's April 2026 advisory
shows failing when the permission is not actually admin-only.

### 4. Which resolution option the evidence supports

The finding proposes "an explicit carve-out that has its own rule (e.g. an owner-declared
private-provider allowlist of exact hosts, entered deliberately, never inferred, never
wildcarded)". **The evidence supports this fully**, and GitLab ships almost exactly it. Adopt
it, and adopt GitLab's specific constraints: exact hosts and CIDRs, optional port, no
wildcards, a hard entry cap.

Two corrections and one addition the finding did not make.

**Correction 1 — this is not a carve-out, it is the correct case.** Framing it as an exception
invites the very erosion the finding fears. OWASP's Case 1 says an application that talks only
to identified, trusted destinations should use an allowlist *as its primary control*. Writing
it as "deny-list, plus an exception" makes the exception look like a compromise. Writing it as
"the deny-list applies to Case 2 traffic; provider base URLs are Case 1 and use an allowlist"
makes both rules principled.

**Correction 2 — the deny-list is missing DNS pinning.** L583's redirect re-validation does not
stop a rebinding attack. Resolve the host once, check the resolved address, and connect to that
address. OWASP names this explicitly.

**The better option none of them named: CanonCore has two kinds of URL, not one, and the spec
collapses them.**

L581 says "every user-supplied URL, and a provider IS a user-supplied URL". But in a
single-owner self-hosted product these are two different things with two different threat
models:

1. **Configuration URLs** — a provider base URL the owner typed into settings. The owner is
   the administrator; there is no privilege boundary to confuse. This is not SSRF, it is
   configuration, and the correct control is OWASP Case 1: an allowlist, plus a deliberate
   entry gesture, plus a warning that names the consequence in Plex's style. Jellyfin's own
   remedy for its highest-severity SSRF was partly to make the setting admin-only.

2. **Content URLs** — every URL that arrives *inside* a provider's response body (artwork
   `src`, `part_of` links, `seeAlso`, pagination cursors) and every redirect `Location`. These
   are supplied by a remote party, not the owner. They get the full deny-list from L582 with
   **no exception, ever** — including for a provider that is itself on the allowlist, because
   an allowlisted private provider that has been compromised or is simply buggy must not be
   able to redirect the fetcher onto `169.254.169.254`.

Splitting them makes the private provider legal without weakening anything, and it closes a
hole the current single-boundary wording leaves open: as written, once the boundary has been
relaxed enough to reach the LAN provider at all, nothing distinguishes that provider's *own*
address from an address it *names in its response*. The artwork table (L344–357) fetches
provider-supplied URLs, so this is a live path, not a hypothetical.

**Recommended wording of the resolution.** Two boundaries. Provider base URLs are validated
against an owner-maintained allowlist of exact hosts and CIDRs with optional ports, no
wildcards, admin-entered, with the private-address warning shown at entry time. Every other
outbound fetch — anything derived from a response body or a redirect — uses the L582 deny-list
with no exceptions, with the hostname resolved once and the connection pinned to the resolved
address.

---

## X3 — Placements arrive from providers and carry no provenance

**STATUS: CLOSED IN THE SPEC. Verified 2026-09-09 against `SPEC.md`.**

*A note on line numbers for X3–X6.* `SPEC.md` was being edited by other work while these four were
researched, and grew from 1010 to 1255 lines during the session. Every `SPEC.md` line number below
was re-anchored in one final pass against commit `8246d6a` (1255 lines). If the file has moved
again, match on the quoted anchor text rather than the number.

The finding was written against a `placements` row of
`(id, owner_id, container_id, item_id, position, edition_id)`. `SPEC.md` L185–186 now reads:

```
  placements    (id, owner_id, container_id, item_id, position, edition_id NULL,
                 source)
```

and L187–197 carries the reasoning, in the finding's own terms: "SOURCE IS ON THE ROW, for the
same reason it is on a statement. An ordering is a DATED CLAIM BY A NAMED SOURCE, not a neutral
fact." It names the same three writers the finding named (`browse`, the scanner, the owner), and
it cites the same Disney+ August 2025 chronology revision. L902 wires the scanner to it: sidecar
placements "carry `sidecar` in the placements source column".

So the headline contradiction is gone. The rest of this section is therefore doing a different
job: checking the new column against the incumbents and the standards, and reporting what X3's
*second* half — "there is no `rank` equivalent when two providers order one container
differently" — still leaves open, because that half is **not** closed.

### 1. What Plex actually does

**Plex has three different mechanisms that write collection membership and records which one
wrote a given row nowhere.** The evidence is Plex's own support article, which contains a FAQ
entry that exists only because the provenance is missing:

> "**Where did all these extra collections come from? I didn't add them.**
> There are three ways 'automatic' collections can be made.
> You may have enabled the **Use collection info from The Movie Database** metadata agent
> setting (for legacy agents)… When using the current 'Plex Movie' scanner/agent combo, you've
> set the **Minimum automatic collection size** preference for a library… If you have MP4s with
> an embedded 'Album' tag, the Local Media Assets agent may pick it up as a collection."
> — https://support.plex.tv/articles/201273953-collections/ (last modified 27 December 2024;
> fetched 2026-09-09)

Three origins — a remote provider, a server rule, and a sidecar tag embedded in a file — and the
user's only route to finding out which one acted is to read a support article and reason backwards
from their own settings. That is the exact failure mode L192–197 describes.

Plex's remedy is also instructive, because it is not provenance: it is an undo that does not work.
"This will only prevent collections from getting automatically added to items added to your
library **in the future**. It will not remove collections from existing library items." Without a
source on the row there is nothing to select on, so the cleanup cannot be written.

**Plex's ordering has the same shape.** Membership is a *tag*, and manual order is a drag handle:

> "Custom Collection Order — The content of regular 'dumb' collections can be reordered in any
> arbitrary way the server admin chooses… **This is not available for 'smart' collections**,
> which are always ordered by the sort chosen when creating or editing the filter."
> — same article.

That confirms `SPEC.md` L212–216 ("A container is EITHER hand-placed OR rule-derived… This is the
split Plex ships as manual versus smart collections") is accurately reported.

**The closest Plex gets to naming the source of an ordering is a library-wide setting**, not a
per-row fact:

> "**Episode Ordering**: How episodes are named/numbered on disk. If your naming follows The
> MovieDB or TheTVDB choose that here."
> — https://support.plex.tv/articles/advanced-setting-plex-tv-series-agent/ (last modified
> 13 April 2025; fetched 2026-09-09)

So Plex *knows* two sources order a season differently, and its answer is one library-wide
declaration of which one to believe. It cannot hold both, cannot show which is in force on a
given episode, and cannot record that the aired order and the DVD order disagree.

### 2. What Jellyfin actually does

**A collection member in Jellyfin has no position at all.** `BoxSet` implements
`IHasDisplayOrder`, and ordering is a whole-collection sort key, defaulted in the constructor:

```csharp
public BoxSet()
{
    DisplayOrder = "PremiereDate";
}
```
and

```csharp
private IEnumerable<BaseItem> Sort(IEnumerable<BaseItem> items, User user)
{
    if (!Enum.TryParse<ItemSortBy>(DisplayOrder, out var sortBy))
    {
        sortBy = ItemSortBy.PremiereDate;
    }

    if (sortBy == ItemSortBy.Default)
    {
        return items;
    }

    return LibraryManager.Sort(items, user, new[] { sortBy }, SortOrder.Ascending);
}
```
— `MediaBrowser.Controller/Entities/Movies/BoxSet.cs` (fetched 2026-09-09,
https://github.com/jellyfin/jellyfin/blob/master/MediaBrowser.Controller/Entities/Movies/BoxSet.cs).
`ItemSortBy.Default` means "return insertion order", i.e. the array order of `LinkedChildren`.
There is no per-member position column, so there is nothing for a source to be attached *to*.

**The membership row does carry an origin field, and it is not a source.** `LinkedChild` has a
`Type`:

```csharp
public enum LinkedChildType
{
    Manual = 0,
    Shortcut = 1,
    LocalAlternateVersion = 2,
    LinkedAlternateVersion = 3
}
```
— `MediaBrowser.Controller/Entities/LinkedChildType.cs` (fetched 2026-09-09). This distinguishes
"an admin added it" from "a `.mblink` shortcut file on disk produced it". It is a link-mechanism
enum, not provenance: no provider can appear in it, and there is no date.

**The ordering that actually matters in Jellyfin — episode number — is written by
first-non-empty-wins with the losing value discarded.** `MergeBaseItemData`:

```csharp
if (replaceData || !target.IndexNumber.HasValue)
{
    target.IndexNumber = source.IndexNumber;
}
…
if (replaceData || !target.ParentIndexNumber.HasValue)
{
    target.ParentIndexNumber = source.ParentIndexNumber;
}
```
— `MediaBrowser.Providers/Manager/MetadataService.cs` lines 1194–1196 and 1225–1227 (fetched
2026-09-09). The caller loops the configured providers in order and merges each result into one
accumulator (`MergeData(result, temp, [], replaceData, false);`, line 998).

Two details make this worse than the spec's summary of it. First, Jellyfin *does* know the
provider — line 990 is literally `result.Provider = provider.Name;` — and then throws it away by
merging into a shared `temp` and never persisting the attribution. Second, **the ordering is the
one thing the owner cannot even lock.** The lockable set is nine values:

```csharp
public enum MetadataField
{
    Cast, Genres, ProductionLocations, Studios, Tags, Name, Overview, Runtime, OfficialRating
}
```
— `MediaBrowser.Model/Entities/MetadataField.cs` (fetched 2026-09-09). `IndexNumber` is absent,
and correspondingly the two merge blocks quoted above are the only ones in that function with no
`lockedFields.Contains(...)` guard. In Jellyfin an ordering is unattributable *and* unlockable: a
refresh can silently renumber a season and the owner has no column to appeal to.

**One correction to `SPEC.md` L198–200, in the spec's favour.** The spec says Jellyfin uses "a key
made of (parent, position)". What Jellyfin actually keys on is (parent, *item id*):

```csharp
var item = playlist.LinkedChildren.FirstOrDefault(i => string.Equals(entryId,
    i.ItemId?.ToString("N", CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase));
```
— `Emby.Server.Implementations/Playlists/PlaylistManager.cs`, `MoveItemAsync` (fetched
2026-09-09); the route is `POST {playlistId}/Items/{itemId}/Move/{newIndex}`
(`Jellyfin.Api/Controllers/PlaylistsController.cs` line 408), and the DTO's `PlaylistItemId` is
just the item's own guid (line 559). Position is the array index in `LinkedChildren`.

The consequence is stronger than the spec claims. Because the entry key is the item id, an item
placed **twice** in one Jellyfin playlist has two entries with the same `PlaylistItemId`, and
`FirstOrDefault` means only the first copy is ever addressable — the second can never be moved or
removed independently. `SPEC.md` L201–202 ("DUPLICATES ALLOWED… Needed for recaps, bookends and
framing devices") and L223–224 ("MUTATIONS NAME A PLACEMENT, NOT AN ITEM") are therefore fixing a
bug that is live in the incumbent, not guarding against a hypothetical. The spec's stated reason
(reordering changes the key) is true of the array index; the sharper reason is that the incumbent's
key cannot address a duplicate at all.

### 3. Industry standard / best practice

**Here there IS a standard, it is one the spec already cites for the neighbouring rule, and it
requires provenance on the ordering.**

OAI-ORE 1.0 makes creator and date **mandatory** on the Resource Map — the document that asserts
an aggregation and its sequencing:

> "A Resource Map MUST express minimal metadata properties about the Resource Map. Those metadata
> properties are: The identity of the authoring authority (human, organization, or agent) of the
> Resource Map, using the `dcterms:creator` predicate…"

and the conformance table lists `ReM-1 dcterms:creator Agent (1, *)` and
`ReM-1 dcterms:modified literal (1, 1)`, both marked Required.
— https://www.openarchives.org/ore/1.0/datamodel (fetched 2026-09-09), §4.2.

ORE goes further and puts *lineage* on the Proxy, which is the standards' name for a placement:

> "…which indicates that an Aggregated Resource originated or was sourced from another
> Aggregation. **Lineage or provenance is one basis of integrity** in scholarly communication.
> A Resource Map MAY assert triples with the predicate **`ore:lineage`** to express this notion.
> The subject of `ore:lineage` MUST be a Proxy specific to the Aggregation and the object MUST be
> a Proxy specific to another Aggregation."
> — same document, §5.3.3.

So the standard the spec already leans on for "order lives on the join row" (L207–209) also says
the join row is a legitimate subject for provenance, and that the ordering document must name its
author and its date. `source` on `placements` is not an extension of ORE; it is the part of ORE
Plex and Jellyfin skipped.

**Wikibase carries the ordering as an ordinary statement, which means it gets rank and references
for free.** `P1545` "series ordinal" is defined as

> "position of an item in its parent series (most frequently a 1-based index), **generally to be
> used as a qualifier**"
> — https://www.wikidata.org/w/api.php?action=wbgetentities&ids=P1545 (fetched 2026-09-09)

and a real item shows the exact CanonCore shape. *Star Wars: Episode IV – A New Hope* (Q17738)
carries **two** `part of the series` (P179) statements: one with `series ordinal` 4 and
`follows` *Revenge of the Sith*, one with `series ordinal` 1 and `followed by` *The Empire Strikes
Back*. Both come back with `"rank": "normal"`
(`action=wbgetclaims&entity=Q17738&property=P179`, fetched 2026-09-09).

That is one item in two orderings at two positions — the product's central case — expressed as two
statements, each of which can hold references and each of which has a rank.

**And Wikibase answers the question the `source` column newly raises.** Where two sources *agree*,
Wikibase does not create two claims; it creates one claim with two references. Q23's `spouse`
statement comes back as `rank normal, nrefs 2` (fetched 2026-09-09). Disagreement makes two
statements and rank picks between them; agreement makes one statement with two references.

**Where the incumbents disagree with the standards, and with each other.** On ordering provenance
they do not disagree — neither has any. On the shape of ordering they disagree completely: Plex
gives a manual collection a real hand-set order and gives a smart collection none; Jellyfin gives
a collection no per-member position at all and sorts the whole set by a key. Neither has anything
resembling a per-placement source. There is no industry standard *practice* here to copy, only a
standards-body *specification* (ORE) that both incumbents ignore.

### 4. Which resolution the evidence supports

**X3 as written is closed, and the resolution taken is the one the evidence supports.** Put source
on the placement row. ORE requires the equivalent; Wikibase demonstrates it; both incumbents omit
it and both have a documented user-visible symptom as a result — Plex's "where did these
collections come from?" FAQ, and Jellyfin's unlockable, unattributable `IndexNumber`.

Two things remain open, and they are worth deciding now rather than discovering at implementation.

**Open 1 — the second half of X3 is still open: nothing resolves two sources ordering one
container differently.** The finding's own words were that there is "no `rank` equivalent when two
providers order one container differently", and adding `source` does not supply one. Concretely:
TMDB and TheTVDB number the same season differently — Plex ships a whole library setting because
of it — and a `browse` from each writes two placement rows for the same item in the same container
at different positions. `SPEC.md` L201–206 says duplicates are allowed and positions may collide,
so the schema accepts both rows silently, and the container then renders the episode twice at two
positions with nothing marking one as the believed answer.

The evidence points at one of two answers, and they are not equivalent for users:

- *Wikibase's answer*: put a rank on the placement row too, so the owner can prefer one source's
  ordering exactly as they prefer one source's value, and losing orderings stay visible rather
  than being discarded. This is `SPEC.md`'s own stated pattern — L234–235 calls `is_default` "the
  same mechanism as the source order and the field favourite, deliberately: one pattern used twice,
  not two patterns" — and it would make it three times, which is an argument *for* it, not against.
- *The spec's likely intent*: two providers' orderings are two **containers**, not two claims about
  one container, because L217–222 says "EVERY CONTAINER OWNS ITS MEMBERSHIP OUTRIGHT… Do NOT build
  a source container that other orderings re-sequence."

I judge the second to be what the spec means and the first to be better for users, and the two are
reconcilable: containers stay separate when the orderings are separate *editorial* objects
("Release order", "Story order"), and rank applies when two sources are describing what the user
thinks of as **one** ordering ("season 3, in order") and simply disagree. A user asking "what order
is season 3 in?" does not want two containers called "Season 3 (TMDB)" and "Season 3 (TheTVDB)" in
their sidebar; they want one season with a resolvable disagreement, which is precisely what the
field-level design already gives them everywhere else. Plex's Episode Ordering setting is the
incumbent conceding the same point at library granularity.

**Whichever is chosen, the spec must say so in the placements block**, because as written an
implementer meeting two `browse` results has no rule at all.

**Open 2 — agreement is not deduplicated, and `source` is single-valued.** Where two sources
produce the *same* placement, the schema as written stores two rows, and L201–202 has already
declared duplicate rows meaningful ("recaps, bookends and framing devices"). So a
double-source agreement and a genuine bookend are the same shape in the table, distinguishable only
by comparing sources, and the container renders the item twice either way. Wikibase's rule is the
one to copy: **identical value and qualifiers collapse to one claim carrying two references;
different values stay as separate claims and rank decides.** For placements that means one row per
(container, item, position) with a *set* of sources, not one row per source.

**Recommended wording of the resolution.** Keep `source` on `placements` exactly as L185–197 has
it. Add two sentences to that block: (i) where two sources assert the same (item, position) in one
container it is ONE placement with several sources, never two rows, so that a real duplicate stays
meaningful; (ii) where two sources assert different positions for one item in one container it is
two placement rows and a `rank` on the row decides, set by hand by the owner, defaulting to the
global source order — the same mechanism as the field favourite and `is_default`, used a third
time rather than a third mechanism being invented.

---

## X4 — `title` is a column, but providers propose titles, and columns have neither provenance nor a rank

**STATUS: OPEN. `SPEC.md` L511–513 is unchanged from the version the finding was written
against.**

> "title, sort_name and release_date are COLUMNS, not statements: production schemas are mixed,
> and the hot, always-present, always-single-valued fields are columns. Everything else is a
> statement."

Against L657 ("A provider may only propose values for fields that already exist"), L670–675
(enrichment reaches every connected provider at once, and a single primary source with others
filling gaps is refused), and L689–703 (several values at once, a source order, an owner
favourite that is also the lock). A title arriving from two providers has none of that machinery
available to it, because it is not a statement.

### 1. What Plex actually does

**Plex ships three title columns and no provenance on any of them.** The server's own object
model, as exposed by the reference client library:

```python
title (str): Name of the movie.
titleSort (str): Title to use when sorting (defaults to title).
originalTitle (str): Original title, often the foreign title (転々; 엽기적인 그녀).
```
— python-plexapi `plexapi/video.py`, `class Video` lines 35/59–60 and `class Movie` lines 361/399
(https://raw.githubusercontent.com/pkkid/python-plexapi/master/plexapi/video.py, fetched
2026-09-09). `Show` carries the same three (lines 571, 620).

So the incumbent has already conceded half the finding's point: `title` alone was not enough, and
Plex grew a second column (`originalTitle`) rather than a second *value*. That is the column
design's characteristic failure mode — each new competing title becomes a new column.

**Plex's control over which title wins is a per-library language setting, applied once, at scan
time, and explicitly non-retroactive:**

> "**Language** — The language to use for metadata gathered from the internet. Each Library has a
> Primary Language that controls the information gathered from the Internet. If a Library's
> language is set to French, for example, the French plot summary, etc., will be downloaded when
> available.
> **Note**: While you can change the language for a Library, **you cannot retroactively update the
> language used for existing items. The new language will only apply to newly-added content.**"
> — https://support.plex.tv/articles/200289266-editing-libraries/ (fetched 2026-09-09)

That note is the whole argument for X4 in the incumbent's own documentation. The reason the change
cannot be applied retroactively is that the losing titles were never stored: there is one column,
it holds one string, and re-deriving the French title means re-querying the provider. Compare
`SPEC.md` L692: "re-ordering the source list re-picks the whole catalogue at once." That sentence
is true of statements and cannot be true of a column.

**Plex's only per-field protection is a boolean lock, not a favourite:**

> "Metadata fields you have locked will not be changed, however… Locked fields will have the
> padlock icon colored orange."
> — https://support.plex.tv/articles/upgrading-a-movie-library-to-the-use-the-new-plex-movie-agent/
> (fetched 2026-09-09)

`SPEC.md` L693 and L986 refuse exactly that flag ("THE FAVOURITE IS THE LOCK. There is no separate
per-field lock flag" / "No per-field lock flag. The favourite does that job"). For every statement
field that refusal works. For `title` it leaves nothing at all: no favourite, because there is one
column; and no lock, because the spec banned the flag. **A title in CanonCore as specified is the
only field in the product that a provider refresh can overwrite with no owner recourse whatsoever.**
That is a consequence the finding did not spell out and it is the sharpest form of the problem.

### 2. What Jellyfin actually does

**Jellyfin ships four title columns, merges first-non-empty-wins, and has a 5.5-year-old open bug
that is exactly this contradiction.**

The columns: `Name`, `OriginalTitle`, `SortName` (derived), `ForcedSortName` —
`MediaBrowser.Controller/Entities/BaseItem.cs` lines 225, 525–553, 943–945 (fetched 2026-09-09).

The merge:

```csharp
if (!lockedFields.Contains(MetadataField.Name))
{
    if (replaceData || string.IsNullOrEmpty(target.Name))
    {
        // Safeguard against incoming data having an empty name
        if (!string.IsNullOrWhiteSpace(source.Name))
        {
            target.Name = source.Name;
        }
    }
}

if (replaceData || string.IsNullOrEmpty(target.OriginalTitle))
{
    target.OriginalTitle = source.OriginalTitle;
}
```
— `MediaBrowser.Providers/Manager/MetadataService.cs`, `MergeBaseItemData` lines 1148–1163
(fetched 2026-09-09). The caller loops every configured provider and merges each result into one
accumulator (line 998). First non-empty wins; every later provider's title is discarded unread.
This is `SPEC.md` L673–675's description of Jellyfin, verified — and it applies to `Name`, which
CanonCore has classified as a column rather than a statement.

**Jellyfin does record which provider answered, and then throws it away.** Line 990 of the same
file is literally `result.Provider = provider.Name;`. The attribution exists on the transient
result object for the duration of one merge and is never persisted. There is no schema slot for it,
for the same reason CanonCore would have none: the destination is a column.

**Jellyfin built a language-fallback mechanism and gave it to exactly two fields, neither of them
the title.** Lines 976–992 reset `Overview` and `Tagline` when a later provider answers in the
preferred language, using `MetadataLanguageUtils.MatchesPreferredLanguage`
(`MediaBrowser.Providers/Manager/MetadataLanguageUtils.cs`, fetched 2026-09-09). `Name` is not in
that mechanism. A wrong-language title set by an earlier provider is permanent until a human
intervenes.

**The user-visible result, in the incumbent's own tracker:** jellyfin/jellyfin issue **#5236,
"Metadata in English, not in selected language"** — opened 2021-02-14, **still open**, 35 comments,
last updated 2026-09-07 (checked 2026-09-09 via `gh api repos/jellyfin/jellyfin/issues/5236`).
The reporter's configuration is the ordinary one:

> "I noticed that metadata is in English in my library instead of French. If I manually identify
> each video I get metadata in French. But when automatic metadata refresh runs, it overwrite
> metadata to English. **I'm using TMDB and TVDB as sources.**"

Two providers proposing different titles, a column with no rank to resolve them, and the owner's
manual correction destroyed by the next refresh. That is X4's consequence paragraph, observed in
production, open for five and a half years, in the product `SPEC.md` positions itself against.

### 3. Industry standard / best practice

**The standards do not merely permit multiple titles; two of the four the spec names make the
title a first-class, multi-valued, provenanced thing.**

**BIBFRAME 2.0 makes Title a CLASS, with six variant subclasses.** From the Library of Congress
ontology (https://id.loc.gov/ontologies/bibframe.rdf, fetched 2026-09-09):

> `bf:Title` — "Title entity": "Title information relating to a resource: work title, preferred
> title, instance title, transcribed title, translated title, variant form of title, etc."
> `bf:VariantTitle` — "Title associated with the resource that is different from the Work or
> Instance title", with subclasses `bf:KeyTitle`, `bf:AbbreviatedTitle`,
> `bf:ParallelTitle` ("Title in another language and/or script"), `bf:CollectiveTitle`,
> `bf:TransliteratedTitle`, plus a `bf:variantType` literal ("Type of title variation, e.g.,
> acronym, cover, spine, earlier, later, series version").

`bf:titleOf` (added 2021-06-09) relates a Title resource back to the Work, Instance, Item or Event.
A title in BIBFRAME is a resource with its own identity, exactly like CanonCore's other statements.

**Wikibase — the system `SPEC.md` L325 borrows `rank` from — ships BOTH designs at once, and this
is the most useful single fact in X4.** The Wikibase data model splits an item into a *Fingerprint*
and *Statements*:

> "Fingerprint, consisting of: Multilingual **label** / Multilingual **description** / Multilingual
> **aliases**" … "**Statements**, each consisting of: Claim (Property, Value, Qualifiers),
> **References**, **Rank**"
> — https://www.mediawiki.org/wiki/Wikibase/DataModel/Primer (fetched 2026-09-09), §Data model.

References and Rank live under Statements only. **The label — the column — has neither.** And
labels are constrained to one per language: "an entity's combination of label and description in a
certain language must be unique" (same source).

Now the same real item, checked live on 2026-09-09 (*Star Wars: Episode IV – A New Hope*, Q17738):

- **Label (the column):** one per language. en `Star Wars: Episode IV – A New Hope`,
  de `Krieg der Sterne`, fr `La Guerre des étoiles`, ja `スター・ウォーズ エピソード4/新たなる希望`.
- **Aliases:** eight in English alone — `Star Wars: Episode IV`, `A New Hope`, `Star Wars IV`,
  `Star Wars: A New Hope`, `Star Wars: Episode IV A New Hope`, `Star Wars`,
  `Star Wars: Episode IV: A New Hope`, `1977 Star Wars`. Also no references, no rank.
- **`title` (P1476) statements:** *two*, both English.
  `"Star Wars: Episode IV – A New Hope"` at `"rank": "normal"`, and `"Star Wars"` at
  **`"rank": "preferred"`**, qualified `object of statement has role (P3831) → original title
  (Q1294573)` and carrying a `stated in (P248)` reference.
  (`action=wbgetclaims&entity=Q17738&property=P1476`, fetched 2026-09-09. P1476 is defined as
  "published name of a work… " with datatype `monolingualtext`.)

So Wikibase's answer to "is a title a column or a statement?" is **both, for different jobs**: a
label for display, sort, search and disambiguation, which is single-valued per language and
deliberately unprovenanced; and `title` statements for the *claims about what this work is called*,
which are multi-valued, ranked, qualified and referenced. The finding assumed the spec had to
choose. The system the spec already copies did not choose.

**schema.org sits with the column side but still gives three fields**: `name` ("The name of the
item"), `alternateName` ("An alias for the item"), `alternativeHeadline` ("A secondary title of the
CreativeWork") — https://schema.org/version/latest/schemaorg-current-https.jsonld (fetched
2026-09-09).

**Where the incumbents disagree with the standards:** completely, and in one direction. Every
standard the spec names treats a work as having many titles; every media server treats it as
having one plus escape-hatch columns. There is no industry *practice* to adopt here. There is a
standards-side answer (Wikibase's split) that no media server implements, which is the same
position `SPEC.md` already occupies on per-field provenance generally.

**One claim in the spec that the evidence contradicts.** L512 says these are "the hot,
always-present, **always-single-valued** fields". Four independent checks say otherwise: Plex needs
three title columns, Jellyfin needs four, schema.org defines three, BIBFRAME defines a class with
six variant subclasses, and one ordinary Wikidata item carries one label per language plus eight
English aliases plus two ranked title statements. "Always-single-valued" is not true of titles in
any system surveyed, including both incumbents. `sort_name` and `release_date` are a different
matter and the sentence is defensible for them — `release_date` already has its own disambiguating
rule at L514–517.

### 4. Which resolution the evidence supports

**Not "make `title` a statement". Not "leave `title` a column". Do what Wikibase does: both, with
one of them derived.**

The finding framed this as a choice and neither branch is good for users:

- *Title becomes a statement only.* Every list, every sort, every search, every URL slug and every
  breadcrumb then resolves a multi-valued field through a source order before it can render a
  label. `SPEC.md` L528–530 already commits to a read projection, so this is implementable, but it
  makes the single most-read field in the product the most expensive one, and it makes an
  unenriched item titleless.
- *Title stays a column only.* Then the product's own reason for existing does not apply to the
  field users actually look at, the owner cannot pin a preferred title (no favourite for columns,
  and L693/L986 refuse a lock flag), a second provider's title is discarded unread exactly as in
  Jellyfin, and re-ordering the source list cannot re-pick titles, exactly as in Plex.

**The resolution the evidence supports, judged on users:**

1. **`title` (and `sort_name`) stay columns on `items` and `editions`** — the hot path, always
   present, never null, what every list and every URL slug reads. This is Wikibase's *label*, and
   it is why Wikibase has one.
2. **Add a `title` property to the properties catalogue** (L412–414 seeds "roughly a dozen"
   properties and says adding one is an INSERT, not a migration — so this costs nothing
   structurally). Provider-proposed titles land there as ordinary statements, with `source`,
   `observed_at`, `rank` and the owner's favourite, and the losing titles stay visible instead of
   being discarded. **The language axis is already there**: while this section was being written,
   `SPEC.md` L326 gained `language` (a BCP 47 tag) and `country` on `statements`, for unrelated
   reasons. A `title` statement therefore carries what Plex's per-library setting cannot — two
   titles in two languages, both true, both kept — with no qualifier machinery to invent.
3. **The column is a PROJECTION of the winning statement**, recomputed by the same rule as every
   other field — owner favourite if set, else the source order — and written by the projection
   rebuild L528–530 already specifies. That makes L692 ("re-ordering the source list re-picks the
   whole catalogue at once") true of titles as well, which is exactly what Plex's non-retroactive
   language note proves is otherwise impossible.
4. **Where no statement exists, the column holds what the scanner or the owner typed**, sourced to
   the Owner or the sidecar like any other value. An unenriched item still has a title, which is
   the property a pure-statement design would lose.

This costs one property row, one projection rule, and one sentence in the schema block. It buys the
owner a pinnable preferred title, a visible record of every competing title with its source, a
title that survives a refresh, and a source-order change that actually re-picks titles. Against
that, the column design's saving is one join the projection was going to do anyway.

**Recommended wording of the resolution.** Replace L511–513 with: `title` and `sort_name` are
columns because every list and every URL reads them, but they are DERIVED — the projection of the
winning `title` statement under the ordinary favourite-then-source-order rule, falling back to what
the owner or the scanner supplied. Titles proposed by providers are statements like everything
else, carrying source, rank and the `language` column `statements` already has (L326), and losing
titles stay visible. Note the
precedent explicitly: this is Wikibase's label-versus-`P1476` split, and it is why Wikibase can
hold "Star Wars" and "Star Wars: Episode IV – A New Hope" as two ranked, referenced claims while
still having exactly one label per language to render. `release_date` and `sort_name` keep their
existing treatment; only `title` gains a statement behind it.

---

## X5 — `medium` is closed at four values including `text`, and every completion rule is a clock

**STATUS: OPEN. The completion rules at `SPEC.md` L782–802 are still written entirely in
seconds, and `medium` at L230 still includes `text` and `image`.**

The four values: `medium (video|audio|text|image)` (L230), described at L248–249 as "how an
edition is consumed by **a renderer this product has**". The rules:

- L782–785: "Completion is TIME REMAINING under a small absolute figure, not a percentage…
  Audiobookshelf marks finished at ten seconds remaining for the same reason."
- L786–791: with no duration, completion is UNKNOWN.
- L792–799: save every 10 seconds, plus immediately on any user interaction.
- L800–802: "ONE number clears the position; do not add a second… Force-complete anything under
  five minutes so trailers never sit in Continue Watching."

L1174 ships the Harry Potter novels on the public demo as `text` editions, so this is a first-version
surface, not a later concern.

### 1. What Plex actually does

**Plex's answer to `text` is that it does not exist.** The library types Plex offers are five, and
books are not among them:

> "**Select a type of media for this library** — Choose the basic type of media this library
> represents. Available choices: Movies / TV Shows / Music / Photos / Other Videos"
> — https://support.plex.tv/articles/200288926-creating-libraries/ (fetched 2026-09-09)

A search of Plex's entire support site for "ebooks" returns no article
(`https://support.plex.tv/?s=ebooks`, fetched 2026-09-09; the only hit is the unrelated security
page). Audiobooks exist only as a naming convention inside a **Music** library
(`https://support.plex.tv/?s=audiobooks` returns one article,
"Adding Music Media From Folders"). So Plex has `video`, `audio` and `image` and simply refuses
the fourth value CanonCore has declared.

**And Plex's video completion rule is not a clock — it is a percentage, refined by content
markers.** From the server's Library settings:

> "**Video played threshold** — Set the progress percentage for video playback at which point the
> video will be marked as played. (**Default threshold is 90%.**)
> **Video play completion behavior** — Decide whether to use end credits markers to determine the
> 'played' state of video items. When markers are not available the selected threshold percentage
> (from the above setting) will be used.
> · *at selected threshold percentage* … · *at final credits marker* … · *at first credits marker*
> … · ***earliest between threshold percent and first credits marker*: Use the first credits marker
> only if it is earlier than the manually set percentage, otherwise use the manually set percentage.
> This is the default behavior.**"
> — https://support.plex.tv/articles/200289526-library/ (last modified 4 May 2025; fetched
> 2026-09-09)

This matters for X5 because `SPEC.md` L782–784 argues *against* a percentage on the grounds that
"a six-hour release at 90% still has thirty-six minutes to run". Plex hit the same problem and
solved it in a third way neither the spec nor the finding considered: **it asks the content where
it ends.** Credits detection is an analysis pass (Plex Pass, PMS 1.31.0+ —
https://support.plex.tv/articles/credits-detection/, fetched 2026-09-09) that produces a marker,
and the default rule is "whichever comes first, the marker or 90%". That is neither a percentage
nor an absolute clock; it is a per-item boundary derived from the work itself.

### 2. What Jellyfin actually does

**All five constants the finding cited are real, and their defaults are as stated.**
`MediaBrowser.Model/Configuration/ServerConfiguration.cs` (fetched 2026-09-09):

```csharp
public int MinResumePct { get; set; } = 5;
public int MaxResumePct { get; set; } = 90;
public int MinResumeDurationSeconds { get; set; } = 300;
public int MinAudiobookResume { get; set; } = 5;      // minutes
public int MaxAudiobookResume { get; set; } = 5;      // minutes
```

Verified: 5, 90, 300, 5, 5. The finding's "`MinAudiobookResume` 5 min and `MaxAudiobookResume`
5 min" is correct, and the XML doc comment on `MaxAudiobookResume` still describes the value as a
percentage ("If this percentage is crossed…") while the type is minutes — the copy-paste scar of
the second code path being bolted on.

**The second code path is a literal `else if` on the item's class**, in
`Emby.Server.Implementations/Library/UserDataManager.cs`, `UpdatePlayState` (fetched 2026-09-09):

```csharp
if (positionTicks > 0 && hasRuntime && item is not AudioBook && item is not Book)
{
    var pctIn = decimal.Divide(positionTicks, runtimeTicks) * 100;
    if (pctIn < _config.Configuration.MinResumePct) { positionTicks = 0; }
    else if (pctIn > _config.Configuration.MaxResumePct
             || positionTicks >= (runtimeTicks - TimeSpan.TicksPerSecond)) { … data.Played = true; }
    else { /* Enforce MinResumeDuration */ … }
}
else if (positionTicks > 0 && hasRuntime && item is AudioBook)
{
    var playbackPositionInMinutes = TimeSpan.FromTicks(positionTicks).TotalMinutes;
    var remainingTimeInMinutes = TimeSpan.FromTicks(runtimeTicks - positionTicks).TotalMinutes;
    if (playbackPositionInMinutes < _config.Configuration.MinAudiobookResume) { positionTicks = 0; }
    else if (remainingTimeInMinutes < _config.Configuration.MaxAudiobookResume
             || positionTicks >= runtimeTicks) { … data.Played = true; }
}
else if (!hasRuntime)
{
    // If we don't know the runtime we'll just have to assume it was fully played
    data.Played = playedToCompletion = true;
    positionTicks = 0;
}
```

Three things follow, and the third is the one the finding did not have.

**(a) The audiobook branch exists because percentage rules failed on long-form audio** — the same
reasoning `SPEC.md` L782–784 gives — and Jellyfin's fix was *not* to replace the percentage rule
but to add a parallel one guarded by the item's class. So the incumbent's evidence is that one rule
did not survive contact with a second medium.

**(b) `Book` is excluded from both numeric branches by name** (`item is not AudioBook && item is
not Book`) and there is no `else if (item is Book)`. A `Book`'s runtime comes from
`GetRunTimeTicksForPlayState()`, which returns `RunTimeTicks ?? 0`
(`MediaBrowser.Controller/Entities/BaseItem.cs` line 3044–3047), and nothing probes an EPUB for a
duration. `Book` nonetheless declares `SupportsPlayedStatus => true` and
`SupportsPositionTicksResume => true` (`MediaBrowser.Controller/Entities/Book.cs`, fetched
2026-09-09). So a book with no runtime falls through to the third branch and is **marked read on
its first progress report** — the same data-corruption path `SPEC.md` L789–791 already cites, except
that for books it is not an edge case, it is the only case. *I could not find any code path that
populates `RunTimeTicks` on a `Book`; if one exists I did not locate it, and the conclusion above
depends on there being none.*

**(c) Jellyfin's ebook reader stuffs a reading percentage into the clock field.** From
jellyfin-web `src/plugins/bookPlayer/plugin.js` (fetched 2026-09-09):

```js
currentTime() {
    return this.progress * 1000;
}

duration() {
    return 1000;
}
```

and, inside the epub.js setup:

```js
return this.rendition.book.locations.generate(1024).then(async () => {
    const percentageTicks = options.startPositionTicks / 10000000;
    if (percentageTicks !== 0.0) {
        const resumeLocation = book.locations.cfiFromPercentage(percentageTicks);
        await rendition.display(resumeLocation);
    }
    …
    rendition.on('relocated', (locations) => {
        this.progress = book.locations.percentageFromCfi(locations.start.cfi);
```

The reader computes a 0..1 fraction from a CFI, declares a fake duration of 1000, and multiplies to
get a "time". That is precisely the workaround an implementer will invent when handed
`SPEC.md` L782–802 and a `text` edition, and the incumbent has already shipped it.

**It does not work.** jellyfin-web issue **#2582, "Book Position Not Remembered"** — opened
2021-04-11, **still open**, 13 comments (checked 2026-09-09):

> "When I open a book and scroll through the position isn't remembered. When the book is opened
> again it is at the start of the book… The problem is that `startPositionTicks` is never
> populated."

Five years open, because the position for a book is being carried through a field the server's
completion logic does not maintain for books.

### 3. Industry standard / best practice

**There IS a standard here, it is well specified, and it is medium-neutral by design.**

**Readium's Locator model** (https://readium.org/architecture/models/locators/, fetched
2026-09-09) is the answer the whole ebook and audiobook ecosystem uses. Its stated first use case is
literally the one in question: "There are many different use cases for locators: **reporting and
saving the current progression**; bookmarks; highlights & annotations; …"

A Locator is `href` + `type` (both required) plus a `locations` object:

| Key | Definition | Format |
|---|---|---|
| `fragments` | "Contains one or more fragment in the resource referenced by the Locator Object." | Array of strings |
| `progression` | "Progression in the resource expressed as a percentage." | Float 0..1 |
| `position` | "An index in the publication." | Integer > 0 |
| `totalProgression` | "Progression in the publication expressed as a percentage." | Float 0..1 |

And the crucial design note:

> "Given the flexible nature of the Readium Web Publication Manifest, we need the ability to provide
> locations into **all sorts of resources (text, audio, video, images)**. Fragments are flexible
> enough to achieve that goal… They're **by nature media-specific** and should always be understood
> in the context of the resource that the locator points to."

with the registered fragment specifications named per medium: HTML (`id`), **Media Fragment URI 1.0
for Audio, Video and Images** (`t=67`, `xywh=160,120,320,240`), and PDF (`page=12`).

That is the whole shape of the answer: **one medium-neutral number (`totalProgression`) that every
medium can produce, plus one medium-specific fragment string that only that medium's renderer
understands.** `t=67` for video is a timestamp; a CFI for an EPUB is a text offset; `page=12` for a
PDF is a page. One column each, not one rule per medium.

**Audiobookshelf ships exactly this, on one row, for both media at once.**
`server/models/MediaProgress.js` (fetched 2026-09-09):

```js
duration: DataTypes.FLOAT,
currentTime: DataTypes.FLOAT,
isFinished: DataTypes.BOOLEAN,
ebookLocation: DataTypes.STRING,
ebookProgress: DataTypes.FLOAT,
```

`currentTime`/`duration` for the audio clock; `ebookLocation` (a locator string) and
`ebookProgress` (a fraction) for the text; and `isFinished` as an explicit boolean rather than a
derived one. The project that actually ships both media did not pick one representation.

**And its auto-complete rule is guarded on having a duration at all:**

```js
const timeRemaining = this.duration - this.currentTime
let shouldMarkAsFinished = false
if (this.duration) {
  if (!isNullOrNaN(progressPayload.markAsFinishedPercentComplete) && progressPayload.markAsFinishedPercentComplete > 0) {
    const markAsFinishedPercentComplete = Number(progressPayload.markAsFinishedPercentComplete) / 100
    shouldMarkAsFinished = markAsFinishedPercentComplete < this.progress
  } else {
    const markAsFinishedTimeRemaining = isNullOrNaN(progressPayload.markAsFinishedTimeRemaining) ? 10 : Number(progressPayload.markAsFinishedTimeRemaining)
    shouldMarkAsFinished = timeRemaining < markAsFinishedTimeRemaining
  }
}
```
— same file. For an ebook there is no `duration`, so the clock rule never runs and the **only**
route to finished is the client sending `isFinished` explicitly (`applyProgressUpdate`, same file).

**Two corrections to `SPEC.md` L784–785 fall out of this.** The spec says "Audiobookshelf marks
finished at ten seconds remaining for the same reason". The ten seconds is right — it is the
default of `markAsFinishedTimeRemaining`. But (i) it is a per-request, user-configurable value, not
a constant; and (ii) **Audiobookshelf also ships the percentage mode the spec rejects**
(`markAsFinishedPercentComplete`, a library setting — it appears in
`server/models/Library.js` and `client/components/modals/libraries/LibrarySettings.vue`, found via
GitHub code search 2026-09-09), and the caller chooses which of the two applies. Audiobookshelf did
not decide between time-remaining and percentage; it shipped both and let the owner pick. Citing it
as authority for "not a percentage" overstates what it does.

**Komga is the paginated-text answer and it is an exact equality, not a threshold.**
`ReadProgress` is:

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
  …
)
```
— `komga/src/main/kotlin/org/gotson/komga/domain/model/ReadProgress.kt` (fetched 2026-09-09).
Note `locator: R2Locator?` — Komga implements the Readium locator model, and exposes it as
`R2Progression(modified, device, locator)` (`R2Progression.kt`, same commit).

Completion:

```kotlin
val progress = ReadProgress(book.id, user.id, page, page == media.pageCount, locator = locator)
```
— `BookLifecycle.kt`, `markReadProgress` (fetched 2026-09-09). `page == media.pageCount`. No
threshold, no tolerance, no "under five minutes", because in a discrete medium the last unit *is*
the end. The trailer problem the spec's five-minute rule solves does not arise in text, and the rule
has no meaning there.

**Where the incumbents disagree:** completely. Plex refuses `text` outright and completes video on a
percentage crossed with a content marker. Jellyfin admits `text`, gives it no rule, and marks it
read immediately. Neither is a model to copy. The standard (Readium) and the two projects that
actually ship text (Audiobookshelf, Komga) agree with each other and with neither incumbent.

### 4. Which resolution the evidence supports

The finding offered two: a per-medium completion variant, or declaring `text` and `image`
non-playable. **The evidence supports neither as stated, and points at a third that is better for
users than both.**

Against *"declare `text` and `image` non-playable"*: it contradicts L248–249 ("how an edition is
consumed by a renderer this product has") and it deletes a shipped demo capability — L1174 puts the
Harry Potter novels on the public demo as text. It also loses the thing that makes the product's
own case: the demo's point is that a novel, a film and three audiobooks sit in one place, and a
novel you cannot open or resume is not in the same place as the others.

Against *"add a per-medium completion variant"*: this is Jellyfin's `else if (item is AudioBook)`,
and Jellyfin is the worked example of where it leads — five constants, two of them documented in
the wrong unit, a third medium with no branch at all, and a five-year-old open bug. Branching the
*rule* per medium is the failure. It also collides head-on with L800 ("ONE number clears the
position; do not add a second"), which is a rule the spec is right to want.

**The resolution the evidence supports: branch the POSITION, not the RULE. Adopt Readium's
Locator.** Concretely:

1. **Progress stores two things, not one**: a medium-neutral `progression` (float 0..1, the
   fraction of the edition consumed) and a `locator` (an opaque, medium-specific string the
   renderer wrote and only the renderer parses — a timestamp for video and audio, an EPUB CFI or a
   page for text, nothing for image). This is Readium's `totalProgression` + `fragments`, it is
   what Audiobookshelf stores as `ebookProgress` + `ebookLocation`, and it is what Komga stores as
   `page` + `R2Locator`. The spec's `files` analysis pass (L760–764) already produces duration for
   video and audio, so `progression` is derivable there and reported directly by a reader for text.
2. **ONE completion rule survives, and it is stated in `progression`, not in seconds.** L800's
   instinct is right and it becomes *more* true, not less: one number clears the position, and that
   number is the fraction. The absolute-time reasoning at L782–784 is then re-expressed as what it
   actually is — a per-edition *end boundary* — and Plex shows the mature form of that: the boundary
   comes from the content where the content can supply one (a credits marker, a last page,
   `page == pageCount`), and falls back to a fixed figure where it cannot. For video and audio that
   fixed figure stays "time remaining under a small absolute figure", computed from `progression ×
   duration`; for text it is simply the end of the last unit, as Komga has it.
3. **`image` has no completion at all**, and the spec should say so in one clause rather than
   leaving an implementer to invent one. An image is viewed, not progressed through; `progression`
   is null and there is no resume. This is the one place "declare it non-playable" is right, and it
   applies to exactly one of the four values.
4. **Keep L786–791 exactly as it is.** "Where nothing has supplied a duration, completion is
   UNKNOWN" is correct, is well argued, and is what stops the Jellyfin `!hasRuntime` corruption. It
   generalises unchanged: where nothing has supplied a `progression`, completion is unknown.
5. **Keep the five-minute force-complete, but scope it to `video` and `audio` in the sentence
   itself.** It exists to keep trailers out of Continue Watching (L801–802), trailers are a video
   phenomenon, and a five-minute rule applied to a novel is meaningless. Scoping a rule in its own
   wording is not the same as branching the rule per medium.
6. **The 10-second save interval (L792–799) needs a second trigger for text**, and the spec already
   has the right instinct at L797: "ALSO REPORT IMMEDIATELY ON ANY USER INTERACTION". For a reader
   the user interaction *is* the page turn, and a timer alongside it is harmless. One added clause:
   for `text`, the page turn is the save trigger and the timer is a backstop.

**Recommended wording of the resolution.** Progress records a `progression` (0..1) and an opaque
per-medium `locator` string, following Readium's Locator model, which is what Audiobookshelf and
Komga both implement and what Jellyfin's ebook reader is badly imitating by scaling a CFI percentage
into ticks. There stays ONE completion rule and it is stated in `progression`; the end boundary is
taken from the content where the content declares one (last page for text; Plex's credits marker is
the video precedent) and from a small absolute time-remaining figure for `video` and `audio` where
it does not. `image` editions have no progress and no resume. The five-minute force-complete names
`video` and `audio` in its own sentence. Where no `progression` can be computed, completion is
UNKNOWN, unchanged.

---

## X6 — "The container is navigation state, never in the URL" versus anything that plays next

**STATUS: OPEN. The rule is unchanged and the product still names no next-item concept.**

> "MUTATIONS NAME A PLACEMENT, NOT AN ITEM — forced by duplicates, since 'remove this from that
> container' is otherwise ambiguous. **URLs address ITEMS. The container you arrived through is
> navigation state carried alongside the address, never encoded in it, never identity.**"
> — `SPEC.md` L223–227

Against L831–832 ("Continue Watching is computed, never stored… It is offered, never auto-played"),
L822–829 (container progress), L32–33 ("playback goes through an app-owned opaque-id route"), and
L1011 ("Addressable: items, editions, placements"). An item in a Release-order container and a
Story-order container has two next-ups; what decides which is exactly the state the rule refuses to
put in the address.

### 1. What Plex actually does

**Plex's answer is a first-class, server-side, identified object, and it is the strongest single
piece of evidence in X6.** A PlayQueue is created by posting the *container* and the *starting
item* together, and the server hands back an id:

```python
args["uri"] = f"server://{server.machineIdentifier}/{server.library.identifier}{items.key}"
…
if startItem:
    args["key"] = startItem.key
```
— python-plexapi `plexapi/playqueue.py`, `PlayQueue._createArgs` (fetched 2026-09-09). For an
ad-hoc list of items it builds `library:///directory/<url-encoded list of metadata keys>` instead.
`create()` POSTs those to `/playQueues`, and `get()` reads one back at `/playQueues/{playQueueID}`.

The object it returns carries, verbatim from the same file's docstring:

```
playQueueID (int): ID of the PlayQueue.
playQueueLastAddedItemID (int): Defines where the "Up Next" region starts.
playQueueSelectedItemID (int): The queue item ID of the currently selected item.
playQueueSelectedItemOffset (int): The offset of the selected item in the PlayQueue,
    from the beginning of the queue.
playQueueSelectedMetadataItemID (int): ID of the currently selected item, matches ratingKey.
playQueueShuffled (bool): True if shuffled.
playQueueSourceURI (str): Original URI used to create the PlayQueue.
playQueueTotalCount (int): How many items in the PlayQueue.
playQueueVersion (int): Version of the PlayQueue. Increments every time a change is made.
```

Three of those matter here.

- **`playQueueSourceURI`** — "Original URI used to create the PlayQueue" — is *the container,
  recorded on the queue.* Plex stores exactly the fact X6 says CanonCore has nowhere to put.
- **`playQueueItemID`** is a per-membership identity, documented on the `Playable` mixin as
  "PlayQueue item ID (**only populated for** PlayQueue items)" alongside `playlistItemID`
  (`plexapi/base.py` lines 852–860, fetched 2026-09-09). It is the analogue of CanonCore's
  placement id, and it exists *only inside the queue*, never in the item's own address.
- The `continuous` parameter is Plex's "what plays next", and it is documented as container-derived:
  "include additional items after the initial item. **For a show this would be the next episodes,
  for a movie it does nothing**" (`PlayQueue.create` docstring, same file).

**And Plex's shareable web URL for an item contains no container at all:**

```python
return self._server._buildWebURL(base=base, endpoint='details', key=self.key)
…
return f'{base}#!/server/{self.machineIdentifier}/{endpoint}{utils.joinArgs(kwargs)}'
```
— `plexapi/base.py` line 833 and `plexapi/server.py` lines 1018–1034 (fetched 2026-09-09),
producing `https://app.plex.tv/desktop/#!/server/<machineIdentifier>/details?key=/library/metadata/<ratingKey>`.

So Plex already implements *both halves* of `SPEC.md` L225–227: the URL addresses the item, and the
container context lives somewhere else. The half CanonCore is missing is that "somewhere else" is a
named, identified, server-side object, not ambient client state.

### 2. What Jellyfin actually does

**Jellyfin's next-up is scoped to the single-parent tree and cannot see a collection.**
`GET /Shows/NextUp` takes:

> `seriesId` — "Optional. Filter by series id."
> `parentId` — "Optional. Specify this to localize the search to a specific item or folder. Omit to
> use the root."

— `Jellyfin.Api/Controllers/TvShowsController.cs`, `GetNextUp` XML docs, lines 57–77 (fetched
2026-09-09). It lives on `/Shows`, so it is TV-only; a BoxSet of films has no next-up endpoint of
any kind. This is the direct consequence of a single-parent model: "next" is well-defined because
there is only one parent it could be relative to.

**Jellyfin's actual play queue is browser memory with a synthetic id that resets on reload.**
`jellyfin-web/src/components/playback/playqueuemanager.js` (fetched 2026-09-09):

```js
let currentId = 0;
function addUniquePlaylistItemId(item) {
    if (!item.PlaylistItemId) {
        item.PlaylistItemId = 'playlistItem' + currentId;
        currentId++;
    }
}

class PlayQueueManager {
    constructor() {
        this._sortedPlaylist = [];
        this._playlist = [];
        …
```

A module-scope counter producing `playlistItem0`, `playlistItem1`. There is no server-side queue
object, nothing addressable, and nothing that survives a refresh — and correspondingly no way for
the queue to appear in a URL even if someone wanted it there.

**So the two incumbents disagree completely on this question**, and the disagreement is exactly the
choice X6 poses: Plex materialises the playback context into a server-side resource with an id;
Jellyfin keeps it in client memory and loses it. Plex's design is the one that survives a page
refresh, a link share, and a handoff to another device — Plex Companion transfers playback by
handing another client the `playQueueID`.

### 3. Industry standard / best practice

**On the URL question there IS a governing standard, and it does not say what the spec's wording
assumes.** RFC 3986 §3.4:

> "The query component contains non-hierarchical data that, **along with data in the path component
> (Section 3.3), serves to identify a resource** within the scope of the URI's scheme and naming
> authority (if any)."
> — https://www.rfc-editor.org/rfc/rfc3986.txt (fetched 2026-09-09)

This is decisive for the wording at L225–227. Under RFC 3986, a query parameter is **part of the
identifier**, not something carried beside it. So "never encoded in it, never identity" rules out
`?container=…` as much as `/containers/12/items/34`. Read strictly, the rule forces the container
into client-side state — which is Jellyfin's design, and Jellyfin's design loses the ordering on
every refresh. **The spec's phrasing is stricter than the thing it was trying to protect**, which
was that an item must have ONE canonical address so it cannot be two different pages depending on
route.

**Every mainstream product outside this category solves it with a query parameter, and the
vocabulary is settled.**

YouTube: the video is the resource and the list is a parameter.

> "**Loading a video** — For an IFrame embed, the YouTube video ID for the video that you want to
> load is specified in the IFrame's `src` URL. `https://www.youtube.com/embed/VIDEO_ID`
> **Loading a playlist** — Set the `listType` player parameter to `playlist`. In addition, set the
> `list` player parameter to the YouTube playlist ID that you want to load.
> `https://www.youtube.com/embed?listType=playlist&list=PLAYLIST_ID`"
> — https://developers.google.com/youtube/player_parameters (fetched 2026-09-09)

Spotify's Web API names the concept outright — the parameter is literally called *context*:

> `context_uri` — "Optional. Spotify URI of the **context** to play. Valid contexts are albums,
> artists & playlists."
> `offset` — "Optional. Indicates **from where in the context** playback should start. Only
> available when `context_uri` corresponds to an album or playlist object. `"position"` is zero
> based… Example: `"offset": {"position": 5}`. `"uri"` is a string representing the uri of the item
> to start at."
> — https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
> (fetched 2026-09-09)

So the industry has one shape with two implementations of where it lives: **(item, context,
offset-in-context)** passed to the player either as URL parameters (YouTube), as a request body
(Spotify), or as a server-side object referenced by id (Plex). Nobody keeps it only in client
memory except Jellyfin, and Jellyfin is the one with no persistence.

There is **no standard for the container-progress or next-up semantics themselves** — that part is
genuinely unspecified across the industry, and the incumbents' behaviour differs because their data
models differ.

### 4. Which resolution the evidence supports

The finding notes that "the model makes this answerable — pass the placement id to the player — but
nothing says so". That instinct is right and the evidence sharpens it in three ways.

**(a) The rule at L225–227 is defending something real, and its wording overshoots.** What it
protects is that an item has one canonical address, so that `/items/34` reached from Release order
and from Story order is the same page with the same identity, and so that a merge or an alias never
has to rewrite two URL shapes. That is worth keeping and it is why Plex's own share URL carries only
`key=/library/metadata/<ratingKey>`. But "never in the URL" is a stronger claim than "never
identity", and under RFC 3986 the two are not the same sentence. Rewrite it as: **the item's
identity is the path; the container is a non-identifying parameter that MAY appear in the URL and
never participates in resolution, equality or canonicalisation.** That keeps one canonical address
(strip the parameter and you have it), and it lets the back button, a refresh, and a pasted link
keep the ordering — all three of which the current wording silently forbids.

**(b) The addressable placement id is the parameter, and the spec already has it.** L1011 says
"Addressable: items, editions, placements", and L185 gives placements a stable surrogate id
precisely so external references do not go stale. A placement id names (container, item, position)
in one opaque token, which means `?from=<placement id>` is not "the container in the URL" in the
sense the rule fears — it does not identify the item, it identifies *the route*, and dropping it
still resolves. It is the same trick as Plex's `playQueueItemID` and Spotify's
`offset: {uri: …}`. **A `placement` is CanonCore's `playQueueItemID`, and the spec built it without
noticing it had built the answer to X6.**

**(c) The product needs a named next-item concept, and the evidence says derive it, do not store
it.** Two candidate designs:

- *Plex's:* materialise a play queue as a server-side row when playback starts, holding the
  ordering, the source container and the selected offset. Strongest for handoff between devices,
  and it is what makes Plex Companion work — but it is a new table, a new lifecycle, and an
  eviction policy, for a product whose first version stops at a rendered page.
- *Derived:* "next" is a pure function of a placement — `next(placement) = the placement in the same
  container with the next position`, with the same tie rule the schema already allows for shared
  positions. Nothing stored. Container progress is already computed on read (L822–823) and Continue
  Watching is already computed, never stored (L831), so this matches the design the spec has
  committed to everywhere else.

**The derived version is the right one for this product**, and it is better for users than
Jellyfin's because it works at all in a multi-parent model, where `/Shows/NextUp` cannot. The
server-side queue is the correct *later* addition, when device handoff arrives; it is not needed to
answer "what plays next" and building it now would be the speculative abstraction the project's own
principles refuse.

**What the spec must add, in one place.** X6's real content is that four things are unstated and an
implementer will each invent them differently:

1. **Where the placement context lives once the player is open.** Answer: the player is opened with
   a placement id, not an item id. `SPEC.md` L32–33 already routes playback through "an app-owned
   opaque-id route"; that opaque id should be minted from the placement, not the edition alone.
2. **What "next" means.** Answer: the next placement in the same container by position. Where two
   items share a position (L203–206), they are alternatives at one point and neither is "next" to
   the other; next is the lowest position strictly greater than the current one.
3. **What happens when there is no placement context** — a user arriving at an item from search,
   from Continue Watching, or from a bare `/items/34`. Answer: there is no next, and the product
   says so rather than picking a container for them. This is the case Plex handles by `continuous`
   doing nothing for a movie, and it is the honest answer in a multi-placement model: the product
   must not guess which of an item's orderings the user meant.
4. **What Continue Watching resumes into.** L831–832 says it is computed and offered, never
   auto-played. If a progress row is per (owner, edition) and placement-independent — which L453–456
   states deliberately, so that watching a thing once marks it watched in every ordering — then a
   Continue Watching entry has no container, and resuming from it lands in case (3). That is
   coherent, but it means Continue Watching cannot offer "next", only "resume this". The spec should
   say that in as many words, because the alternative an implementer will reach for is storing the
   last-used container on the progress row, which quietly reintroduces a primary parent.

**Recommended wording of the resolution.** Replace L225–227 with: URLs address ITEMS; the item's
identity is the path alone, and stripping every parameter yields the canonical address. The route
the user arrived by is carried as a NON-IDENTIFYING parameter holding a PLACEMENT ID — the same
trick as Plex's `playQueueItemID` and Spotify's `offset.uri` — so that a refresh, the back button
and a shared link all keep the ordering. It never participates in resolution, equality or
canonicalisation, and two URLs differing only in it are the same page. Then add, next to Continue
Watching: the player is opened with a placement, not an item; NEXT is the next placement in the same
container by position, and where an item was reached with no placement — search, Continue Watching,
a bare item URL — there is NO next and the product says so rather than choosing an ordering on the
user's behalf. Do not store a play queue and do not put a last-used container on the progress row:
"next" is derived, as container progress and Continue Watching already are.
