# Sweep: Plex support articles (shard B, 110 articles)

STATUS: complete

Source list: `urls/shards/plex-support-ab`
Spec under test: `prompt.md`

Classification key:
- **ADOPTED** — CanonCore's prompt already takes this position.
- **REFUSED** — prompt explicitly rejects it (WHAT NOT TO BUILD / STANDING RULES).
- **DIVERGENT** — prompt deliberately does it differently.
- **ABSENT** — prompt says nothing at all. Rated LOW / MEDIUM / HIGH for whether a
  self-hosted media catalogue genuinely needs it.

---

## Progress log

Done: 110 of 110. Shard complete.

---

## Articles

### 1. https://support.plex.tv/articles/201377603-roku-logs/
**Capability:** Client-side diagnostic logging: user-enablable app log, served over HTTP from the device (`http://ROKU_IP:8324/logs`), retrievable by the user without vendor access, plus a documented issue-report procedure ("Provide detailed information… Give exact steps to reproduce… Attach the logs").
**Classification:** ABSENT — the prompt never mentions logging, diagnostics, or how a user reports a fault.
**Need:** MEDIUM. Self-hosted software with no vendor support channel makes user-retrievable logs the only debugging surface; not needed to reach the four stop conditions.

### 2. https://support.plex.tv/articles/201381883-special-keyword-file-folder-exclusion/
**Capability:** Scanner exclusion. Two mechanisms: hardcoded keyword exclusions and a per-folder `.plexignore` pattern file.
**Rules (verbatim):** "Files that include the word sample in the filename and are less than 300MB in size"; "Folders that include the words extras, samples, bonus, or bonus disc"; "Files that have the suffix .dvdmedia, .iso, or .img"; "Currently these filters are excluded before metadata matching begins"; `.plexignore` semantics — "Blank lines are ignored", "Lines starting with # are comments", "The * character is a wildcard", patterns without `/` match filenames in the same directory, patterns with `/` match relative paths, "Always use forward-slashes (/) as path delimiters, even on Windows".
**Classification:** ABSENT. CanonCore has a scanner ("Support explicit periodic scans", "The scanner NEVER writes storage") but says nothing about what the scanner should *skip*.
**Need:** MEDIUM. Any real media tree contains junk the scanner must not ingest; a declarative ignore file is the established answer and costs almost nothing, but note the hardcoded-keyword half is exactly the "ordering lives in filenames" antipattern CanonCore is built against.

### 3. https://support.plex.tv/articles/201424327-why-do-i-get-metadata-but-no-images-for-my-library-items/
**Capability:** Diagnosis of the partial-enrichment case: text metadata arrives but artwork does not. Names four causes: agent choice, source has no image, local network blocking, and filesystem link support.
**Rules (verbatim):** "For most metadata content, Plex makes use of cached metadata served by custom servers. This is done so that those providers don't get slammed by the mass of Plex users querying for content metadata." Unsupported filesystems for the data directory: "FAT16 / FAT32 · exFAT · ReFS".
**Classification:** Mostly ABSENT, one part DIVERGENT. The vendor-operated metadata cache proxy is DIVERGENT (CanonCore providers are direct URLs the instance owner supplies; there is no CanonCore-operated intermediary and there must not be). "You could also manually add your own images in the Plex Web App" is REFUSED ("No artwork uploads"). ABSENT: artwork fetch can fail independently of metadata fetch, and there is no stated behaviour for a per-asset fetch failure; also ABSENT that the data directory has filesystem requirements at all.
**Need (ABSENT parts):** MEDIUM. Artwork rows carry a provider URL; the prompt never says whether artwork is proxied/cached locally or hot-linked, and that decision has licensing, privacy and offline consequences.

### 4. https://support.plex.tv/articles/201426506-why-are-iso-video-ts-and-other-disk-image-formats-not-supported/
**Capability:** A stated refusal — container formats that hide content behind a menu system are out of scope.
**Rule (verbatim):** "Such formats are not supported in Plex." Reason: "They hide content behind built-in menu systems… For television content, disk image formats will lump multiple episodes on a single disk."
**Classification:** ABSENT (compatible in spirit). CanonCore's direct-play-only rule implies it, but the *multi-work-in-one-file* problem is not addressed anywhere: CanonCore's model attaches a file to an item or edition and has no way to say "this file contains parts 10-13".
**Need:** MEDIUM. The one-file-many-items case is real beyond disk images (a compilation MKV, a double-bill, a concatenated serial) and CanonCore's `files` table has no offset/extent, so the answer today is silently "unsupported" rather than "decided".

### 5. https://support.plex.tv/articles/201447956-how-do-i-get-subtitles-to-work/
**Capability:** Subtitles come from two places — external sidecar files matched by filename, and embedded tracks carrying a language flag.
**Rule (verbatim):** "For embedded subtitles, make sure they have the language flag specified appropriately for the best compatibility."
**Classification:** Half ADOPTED, half ABSENT. ADOPTED: files carry `role: media|subtitle|audio|chapters`, "a sidecar references the file it accompanies plus a language". ABSENT: *embedded* tracks inside a media file. CanonCore models subtitle/audio as separate file rows only, so a single MKV with three embedded subtitle languages has nowhere to record them.
**Need:** MEDIUM. Embedded tracks are the common case in real libraries, and the language-selection surface (article 102) depends on knowing what tracks a file holds; needs either a track table or an explicit decision to ignore embedded streams.

### 6. https://support.plex.tv/articles/201447966-why-does-content-i-deleted-on-my-drive-still-show-up/
**Capability:** Soft-delete of catalogue entries whose files vanish, plus a safety heuristic that refuses to act on an unreadable/empty content root.
**Rules (verbatim):** "the item will be marked as 'soft deleted' so that you can restore the item without losing any metadata associated with the item"; "If a content location is inaccessible, Plex Media Server will simply ignore it during a scan to help protect against incorrect removal of library content in situations such as an external hard drive being unplugged"; "a content directory that is completely empty will appear to the filesystem the same as a directory that is inaccessible".
**Classification:** ABSENT, and structurally different. CanonCore items are media-independent, so a vanished file removes a `files` row and never the item — the soft-delete concept collapses. But the scanner's behaviour on a *missing or unmounted root* is entirely unstated, and CanonCore has tombstones without saying what sets them.
**Need:** HIGH. See GAPS. An unmounted drive plus a naive scan reconcile is the single most destructive failure mode in this product category, and CanonCore's `files` table plus periodic scanning has exactly the shape that hits it.

### 7. https://support.plex.tv/articles/201448016-how-do-i-add-theme-music-for-a-tv-show/
**Capability:** Theme music per show, fetched from a vendor-curated database, overridable by a correctly named local MP3, with a community submission path.
**Rule (verbatim):** "Plex maintains a database of theme music clips… your Plex Media Server will grab that theme music file if it's available and if you have your metadata agent set to do so."
**Classification:** REFUSED by extension. This is a provider-supplied non-artwork binary asset plus a local-asset scan; CanonCore says "The scanner takes media files and playback sidecars, and nothing else", and only artwork is a provider-supplied asset table.
**Need:** LOW. Ambient polish, and the local-asset path is the `.nfo`-style scanning CanonCore rules out.

### 8. https://support.plex.tv/articles/201448046-how-do-i-manage-my-media-and-plex-media-server/
**Capability:** All server and library management happens in the web app — there is one administration surface, not a separate admin tool.
**Rule (verbatim):** "Managing both your media as well as your Plex Media Server in general is done through the Plex Web App."
**Classification:** ADOPTED implicitly. CanonCore's web client is Next.js and is the owner surface; phone and TV come later and nothing is gated on them.
**Need:** n/a.

### 9. https://support.plex.tv/articles/201455336-crash-logs-plex-media-server/
**Capability:** Crash capture with automatic telemetry upload to the vendor, and platform-specific crash-report directories.
**Rules (verbatim):** "When crash information is generated, details are also automatically submitted to Plex to help improve the product"; "the crash logs will be uploaded for aggregate analysis of crashes and will then be removed. Therefore, please retrieve the crash log prior to launching Plex Media Server again."
**Classification:** ABSENT. CanonCore says nothing about telemetry in either direction.
**Need:** MEDIUM for the *refusal*. A self-hosted product that phones home is a trust decision, and the prompt's silence means an implementer could wire up Sentry by default without violating any stated rule. Worth an explicit "no telemetry" line rather than a feature.

### 10. https://support.plex.tv/articles/201469176-i-have-plex-pass-so-how-do-i-use-plex-for-android-for-free/
**Capability:** Subscription-gated app unlock; entitlement checked by signing into a vendor account; sideloadable APK distribution outside app stores.
**Classification:** REFUSED / not applicable. CanonCore has no accounts service, no subscription, no entitlement — "Single user, one password, no signup, no multi-tenancy".
**Need:** LOW. Sideloading is the only transferable fragment, and it is an app-distribution question for a client that does not exist yet.

### 11. https://support.plex.tv/articles/201539237-backing-up-plex-media-server-data/
**Capability:** A documented backup and restore procedure for the whole server state, plus the statement of what state actually is (database, viewstates, metadata, settings, cache).
**Rules (verbatim):** "make a backup of the main Plex Media Server data directory"; "you can exclude the Cache directory"; "do not place it inside the same PMS data folder… If PMS sees an unknown file or directory it could potentially delete it as it periodically clears out unused files".
**Classification:** ABSENT. The prompt names nothing about backup, restore, or where instance state lives on disk.
**Need:** HIGH. See GAPS. CanonCore's whole value is hand-curated placements and owner statements that exist nowhere else and cannot be re-derived from files, which makes backup more load-bearing here than in any file-derived catalogue.

### 12. https://support.plex.tv/articles/201543057-why-is-some-of-my-content-not-found/
**Capability:** The exhaustive list of reasons a scan misses a file — naming, exclusion, unsupported container, archives, permissions, and a race with an in-progress copy.
**Rules (verbatim):** "The movie scanners will skip content that is named like a television episode"; "The TV scanners will skip content that is not named like a television episode"; "Content that is inside an archive container (such as ZIP, RAR, GZIP, TAR, or similar files) will be ignored"; "The user account needs to have at least read and execute permission"; "the Plex Media Server scanner can note the change and then wait 60s. If nothing else has changed at that point, it will perform a library scan"; "if your content is copying and takes longer than a minute… the scan occurs before the copy finishes… Subsequent scans would not actually look in the directory because it doesn't appear that the directory changed".
**Classification:** DIVERGENT on the first half, ABSENT on the second. The naming-driven scanner is precisely what CanonCore refuses (reason 2, "ORDERING LIVES IN FILENAMES") and library typing is refused too ("never typed by medium"). ABSENT: the debounce window, the partially-copied-file race, permission failure reporting, and the fact that a scanner needs to tell the owner *why* something was skipped.
**Need:** MEDIUM-HIGH. The copy race is a genuine correctness bug that every scanner rediscovers, and "the scan found nothing and did not say why" is the top self-hosted support complaint. A scan report naming skipped paths and reasons is cheap and the prompt does not ask for one.

### 13. https://support.plex.tv/articles/201543067-why-does-cpu-usage-spike-for-plex-media-server-when-it-s-not-doing-anything/
**Capability:** Background work is attributable — the article's job is telling the owner which background process is spending CPU.
**Rules (verbatim):** "you've probably enabled video preview thumbnails generation"; "the Plex Media Server reads your iTunes library… can cause a brief spike".
**Classification:** ABSENT. CanonCore has real background work (background enrichment application, projection rebuild, periodic scans) and no stated way to see it or attribute cost to it.
**Need:** MEDIUM. Background enrichment "runs in the background against the thresholds", and an owner with no visibility into a queue that is silently working (or silently stuck) has no way to distinguish the two.

### 14. https://support.plex.tv/articles/201543087-how-do-i-see-what-is-being-played-by-plex-apps/
**Capability:** A live "Now Playing" dashboard plus a persisted playback history view.
**Rule (verbatim):** "You can also view historical data of plays from your Plex Media Server in the playback history area of the Dashboard."
**Classification:** Half ADOPTED, half ABSENT. The *data* is adopted and then some: CanonCore's append-only watch events are strictly richer than Plex's mutable state row, and the prompt says so explicitly. ABSENT: any surface that renders that history, and any live-sessions view.
**Need:** MEDIUM. The event log is an asset the prompt argues hard for; with no history screen it is a table nobody reads. Low urgency (post-cap, playback half) but it is the obvious payoff of the design choice.

### 15. https://support.plex.tv/articles/201543147-what-network-ports-do-i-need-to-allow-through-my-firewall/
**Capability:** Documented network surface: one required port, several optional discovery/DLNA/companion ports, with a security posture on exposing them.
**Rules (verbatim):** "TCP: 32400 (access to the Plex Media Server) [required]"; "UDP: 32410, 32412, 32413, 32414 (current GDM network discovery)"; "we very strongly recommend that you do not allow any of these 'additional' ports through the firewall… where your Plex Media Server is running on a machine with a public/WAN IP address".
**Classification:** ABSENT. CanonCore's SECURITY section covers only outbound fetch (SSFB) and the public read path. Nothing about the inbound listening surface, LAN discovery, or deployment posture.
**Need:** MEDIUM. A single documented port and an explicit "no LAN auto-discovery protocol" is a one-line decision now and an architecture argument later; discovery in particular (GDM/Bonjour) is what a phone client will otherwise demand.

### 16. https://support.plex.tv/articles/201553286-scheduled-tasks/
**Capability:** A user-visible schedule of named background maintenance jobs, each individually toggleable, confined to a nightly window. Jobs: database backup, database optimise, remove old bundles, remove old cache files, refresh local metadata, update libraries, upgrade media analysis, refresh metadata periodically, extensive media analysis, fetch photo location names. Advanced: configurable backup directory.
**Rules (verbatim):** "This defaults to starting at 3am and ending at 6am"; "Every three days, a backup of your core SQL database file will be created (if it is not already corrupted)"; "Up to three backup copies will be kept in a rotating manner"; "This task cleans up files which were created over a month ago"; "(Disabled by default.) This will run a standard scan on your libraries during the maintenance period"; "tasks which occur every three days or every week may not occur for the first time until a few days after scheduling is enabled"; "If you modify the backup location, you must first create the specified directory (Plex Media Server will not create the directory automatically)".
**Classification:** ABSENT, and this is the largest single omission in the shard. CanonCore names background work in several places (periodic scans, background enrichment, projection rebuild, six-month TMDB cache expiry) but has no scheduler, no maintenance window, no job registry, no retention policy, and no automatic database backup.
**Need:** HIGH. See GAPS.

### 17. https://support.plex.tv/articles/201572843-tv-theme-music-submissions/
**Capability:** Community contribution pipeline into the vendor's own metadata database, with acceptance criteria and a copyright-driven length cap.
**Rules (verbatim):** "Music files hosted by Plex will not exceed 30 seconds in length so as to abide by copyright restrictions"; "The file must not exceed 30 seconds (this is a legal restriction for Fair Use)"; "At this time, one background music file will be used per TV show"; "File name must be TV Show Name – TVDBID.mp3"; "Files must not be less than 128 kbps or exceed 256 kbps".
**Classification:** REFUSED / not applicable. CanonCore is not a metadata publisher and operates no central database; providers are third-party URLs. There is no contribution path and there should not be one.
**Need:** LOW. The one transferable idea — that a hosted asset carries a licence justification — CanonCore already has via artwork licence and attribution columns.

### 18. https://support.plex.tv/articles/201573117-android-android-tv-fire-tv-logs/
**Capability:** Same client-log pattern as article 1, with a time-boxed exposure.
**Rule (verbatim):** "you'll be able to access device logs over your local network for the next 20 minutes"; log endpoints `http://[IPofAndroidDevice]:32500/logging` and `http://[IPofFireTVDevice]:37211/logging`.
**Classification:** ABSENT (same gap as article 1). The time-boxed auto-expiring diagnostic endpoint is the good detail: a debug surface that closes itself.
**Need:** MEDIUM, and it is the same MEDIUM as article 1 rather than a second one.

### 19. https://support.plex.tv/articles/201575036-why-is-my-video-stream-buffering/
**Capability:** Playback failure triage, and the fact that transcoding performance is measurable and exposed (`speed =>` in the log).
**Rules (verbatim):** "Exactly 1.0 – the Server is transcoding exactly in real-time"; "Greater than 1.0 – the Server is able to transcode fast enough"; "If your average is about 1.3 or greater, then transcoding speed is sufficient"; "The streaming speed/quality is controlled in the Plex app you're using. It is not controlled on the Plex Media Server side."
**Classification:** REFUSED (transcoding half). "No transcoding, no ffmpeg, no quality ladders." ABSENT: the general principle that playback failure must be diagnosable. CanonCore says "When a file will not play, say so plainly" — a stated intent with no named mechanism, and with direct-play-only the *reason* (codec, container, missing track) is exactly what a user needs.
**Need:** MEDIUM. Direct-play-only makes "why won't this play" the single most common user question, and "say so plainly" needs the server to know the file's streams to answer it — which loops back to the media-analysis gap in article 42.

### 20. https://support.plex.tv/articles/201580107-plex-subscription-management/
**Capability:** Subscription billing: plans, prorated upgrade credit, cancel-renewal semantics, stored payment method, receipts, app-store billing divergence.
**Rules (verbatim):** "Cancelling a subscription only cancels future renewal, it does not provide any refund for an existing subscription transaction"; "We do not store any of your billing details on our servers. The data is encrypted and securely stored by our payment processor, Braintree."
**Classification:** REFUSED / not applicable. CanonCore is self-hosted software plus one read-only demo; there is no account service, no billing, no entitlement.
**Need:** LOW.

### 21. https://support.plex.tv/articles/201611836-plex-web-app-logs/
**Capability:** Per-client debug logging with a settings-controlled level, viewable in-app at a stable route (`#!/logs`), plus browser-console capture as a fallback.
**Rule (verbatim):** "Choose Enabled from the Debug Level dropdown menu"; the log is reachable by URL in the same window.
**Classification:** ABSENT (same family as 1, 18, 22). Notable specific: an *in-app* log viewer rather than a file on disk.
**Need:** MEDIUM (rolls into the diagnostics gap).

### 22. https://support.plex.tv/articles/201636593-mobile-logs/
**Capability:** One-tap "Download Logs" from the mobile app's About screen.
**Rule (verbatim):** "Include information like exact steps to reproduce, as well as the mobile app (and Plex Media Server) version you're running (the exact version number, not just 'the latest')."
**Classification:** ABSENT. The transferable rule is that the product must display its own exact version somewhere reachable.
**Need:** MEDIUM for the version-display half specifically: CanonCore ships a forward-only migration ladder, so "which version and which migration am I on" is diagnostically load-bearing and nothing in the prompt says it is visible.

### 23. https://support.plex.tv/articles/201638786-plex-media-server-url-commands/
**Capability:** The read API itself, documented for users: token auth via query parameter, a capabilities document at the root, `/library/sections` listing, `/library/sections/{key}/all` listing, and the item payload shape (`ratingKey`, `key`, `titleSort`, `originallyAvailableAt`, `addedAt`, `updatedAt`, nested `Media` → `Part` with codec/container/bitrate/resolution/duration and the on-disk `file` path).
**Rules (verbatim):** "In a default setup, all of your requests to the Plex Media Server must be authenticated"; "Simply add your token as an X-Plex-Token parameter in the URL"; "Each library has a key that identifies it within the database".
**Classification:** Mixed, and the most informative article so far.
 - ADOPTED in spirit: CanonCore gets an OpenAPI reference free from the oRPC handlers, and the public read path names every field it emits.
 - DIVERGENT: `titleSort` and `originallyAvailableAt` as columns is exactly CanonCore's `sort_name` / `release_date` column decision. The `Media`/`Part` two-level split (a logical version with N physical parts) is close to CanonCore's edition/file split but Plex allows one Media to have several ordered Parts — CanonCore has no ordered multi-part file concept.
 - REFUSED: token-in-URL. CanonCore's security section implies a cookie session, and a credential in a query string lands in every log and referrer.
 - ABSENT: (a) a capabilities/discovery document declaring what this instance supports; (b) authentication for the *API* as distinct from the web session, i.e. how a phone or TV client or a script authenticates at all; (c) the multi-part file case.
**Need:** HIGH on (b). See GAPS — CanonCore commits to a phone app and a TV app, and "one password, no signup" has no stated token model for a non-browser client.

### 24. https://support.plex.tv/articles/201643703-reporting-issues-with-plex-media-server/
**Capability:** A structured bug-report procedure, a one-click "Download Logs" zip in server settings, and two distinct log levels with an explicit warning against the higher one.
**Rules (verbatim):** "Enable debug logging in Plex Media Server (DO NOT enable 'verbose' logging unless requested)"; "Please DO NOT turn on the verbose logging option unless specifically instructed to do so. That level of logging is rarely desired and can hamper investigations."
**Classification:** ABSENT.
**Need:** MEDIUM. Rolls into diagnostics; the reusable detail is one-button log export rather than telling users a filesystem path.

### 25. https://support.plex.tv/articles/201674343-scanning-disk-image-format-media/
**Capability:** A pluggable scanner: a Python file dropped into a named directory replaces the built-in scanner for a library, selectable per library under Advanced.
**Rules (verbatim):** "No current Plex apps support the playback of ISO, IMG, VIDEO_TS, BDMV"; "The default media scanners in your Plex Media Server will intentionally skip over unsupported disk image format media"; "You must leave the scanner files named exactly as they are on this site. Spaces and capitalization are important"; "You'll also need to make a change to your library contents so that the server detects that content has changed. You could do that by editing and reverting a filename or directory name or pretty much anything else that updates the directory modification time".
**Classification:** REFUSED. Custom scanners are code running inside the app — the exact thing the provider contract exists to avoid ("not a plugin, not a repo, and never code running inside the app"). Plex's own plug-in history is cited in the prompt as the reason.
**ABSENT sub-point:** that a scan is skipped when directory mtime is unchanged, so a forced full rescan must exist as an explicit user action. CanonCore says "Support explicit periodic scans" but never distinguishes incremental from full, or offers a way to force one.
**Need:** MEDIUM for force-rescan. "Scan found nothing because mtime didn't change" is the failure this workaround exists for, and it needs a button, not a filename trick.

### 26. https://support.plex.tv/articles/201697383-why-is-plex-using-my-cpu/
**Capability:** The full inventory of derived-asset generation jobs a media server runs against files after ingest: intro detection, credits detection, preview/chapter thumbnails, voice-activity detection for subtitle sync, ad detection, loudness and sonic analysis, download preparation, optimisation.
**Rules (verbatim):** "This process essentially requires a transcode of the media file in order to generate a series of small screengrabs"; "If you enable that setting prior to adding a large amount of library content, you can expect the process to be running and using a large amount of CPU for hours or even days"; "it might take days or even weeks (depending on the library size and processor power)".
**Classification:** REFUSED wholesale. Every one of these is transcode-derived ("No transcoding, no ffmpeg") and most are per-medium features CanonCore has no equivalent for. Intro/credit skip is not mentioned anywhere in the prompt and would need chapter/marker data the model does not carry.
**ABSENT sub-point:** CanonCore's `files` role list includes `chapters`, so chapter data enters via sidecar — but nothing says what a chapter file is FOR, and no surface consumes it.
**Need:** LOW. Derived assets are exactly the scope this product cut.

### 27. https://support.plex.tv/articles/201718797-does-content-stream-directly-to-the-chromecast-or-through-the-casting-device/
**Capability:** The control plane and the data plane are separate: the device that initiates playback is not the device that receives bytes.
**Rule (verbatim):** "The casting device is only used to initiate and control playback. The content is streamed directly from the Plex Media Server to the Chromecast."
**Classification:** ABSENT. CanonCore says "playback goes through an app-owned opaque-id route so access control and progress work" — one route, one consumer. A three-party session (controller, renderer, server) means the opaque id must be handed to a device that never authenticated as the owner, and progress events arrive from a party that is not the one that asked to play.
**Need:** MEDIUM. Casting is table stakes the moment a phone app exists, and the opaque-id route as stated is single-party; deciding now whether the id is bearer-capable and time-boxed is cheap, retrofitting it is not.

### 28. https://support.plex.tv/articles/201725267-what-are-video-preview-thumbnails-in-plex/
**Capability:** Scrubber preview thumbnails (BIF index files) generated from the media.
**Classification:** REFUSED. Requires transcoding.
**Need:** LOW.

### 29. https://support.plex.tv/articles/201751006-plex-pass-feature-overview/
**Capability:** The paid-tier feature list, which doubles as Plex's own statement of what it considers premium: credit/intro skip, downloads (offline copies), hardware transcoding, remote streaming, DVR, restrictions on library access by content rating or custom label, bandwidth/transcode limits, early access channel, music sonic analysis, lyrics.
**Rules (verbatim):** "A Remote Watch Pass subscription allows streaming remotely from any Plex Media Server to which you have access. That's all it does."
**Classification:** Mostly REFUSED (transcoding, subscriptions, entitlement) or n/a (DVR, live TV). Two ABSENT items worth naming: (a) OFFLINE DOWNLOADS to a client — a phone app for a self-hosted catalogue will be asked for this on day one, and it means a second copy of a file whose progress must reconcile on reconnect; (b) CONTENT RESTRICTIONS by rating or label, which CanonCore explicitly defers ("No visibility system… Add it when multi-user arrives").
**Need:** MEDIUM on downloads. The prompt commits to a phone app and says nothing about offline; the progress model (append-only events, save every 10s) is actually well shaped for offline replay, but only if someone decides events can be recorded client-side and replayed out of order.

### 30. https://support.plex.tv/articles/201767273-how-do-i-choose-the-right-streaming-quality-in-an-app/
**Capability:** Per-client quality selection, split into separate LOCAL and REMOTE settings, with an explanation grounded in the server's upload bandwidth.
**Rule (verbatim):** "The speed you can use when streaming remotely is most commonly determined largely by how fast the Plex Media Server you're streaming from is able to _upload_ content"; "if multiple users will be streaming remotely from the server at the same time, the total of all their speeds should be less than the maximum available upload".
**Classification:** REFUSED. "No transcoding, no ffmpeg, no quality ladders."
**ABSENT sub-point:** the local/remote distinction itself survives the refusal. Direct play of a 50Mbps 4K remux over a 15Mbps upload simply fails, and CanonCore's answer ("When a file will not play, say so plainly") cannot distinguish "your device cannot decode this" from "your link cannot carry this".
**Need:** LOW-MEDIUM. Diagnosable-failure gap, already counted at article 19.

### 31. https://support.plex.tv/articles/201774043-what-kind-of-cpu-do-i-need-for-my-server/
**Capability:** Published hardware sizing guidance with concrete numbers, expressed in a vendor-neutral benchmark (PassMark) rather than model names, plus a stated multiplier for concurrency.
**Rules (verbatim):** "4K HDR (50Mbps, 10-bit HEVC) file: 17000 PassMark score"; "1080p (10Mbps, H.264) file: 2000 PassMark score"; "No transcoding: Intel 'Atom' 1.2GHz"; "This guideline should not be used as a concrete measurement."
**Classification:** REFUSED (the transcoding half). ABSENT: CanonCore states no minimum hardware, no sizing guidance, and no idea of what a catalogue of 373k pages / 11k stories costs to host.
**Need:** MEDIUM. The archive is a 1.8GB DuckDB with 4.5M page links and an EAV design that "ALWAYS grows a denormalised read side"; a self-hosted product whose own stress-test dataset is that size must eventually state what it needs, and the "no transcoding" line is a genuine selling point that only lands if the floor is stated (Atom-class, per Plex's own no-transcode row).

### 32. https://support.plex.tv/articles/201806463-why-does-plex-media-server-say-my-content-is-unavailable/
**Capability:** The user-facing surface for a broken file reference: an "Unavailable" state on the item, click-through to the exact expected path and filename, and an enumerated cause list (renamed, moved, drive unmounted, drive remounted under a different name, permissions).
**Rules (verbatim):** "Please check that the file exists and the necessary drive is mounted"; "If you look in your Plex Web App at the media item and click the Unavailable icon, you'll see the expected full filepath and filename listed."
**Classification:** ABSENT, and it is the exact complement of article 6. CanonCore's `files` row carries a path that is "LOCATION, NOT IDENTITY" and a content hash, which is a strictly better relink story than Plex's. But there is no stated UNAVAILABLE state at all: nothing says what an item page shows when its file is missing, or that the owner is ever shown the path.
**Need:** HIGH. See GAPS — this is the second half of the missing-file gap and it is cheap to fix at design time: the file row needs a "last seen" and a reachable/unreachable state, and the item page needs to show the path.

### 33. https://support.plex.tv/articles/201812803-plex-companion-remote-control-issues/
**Capability:** A remote-control protocol letting one app drive playback on another, discoverable via a server-side client registry at `/clients`.
**Rules (verbatim):** "'Plex Companion' is the name of the remote control protocol that Plex uses to let you control one Plex app from another"; "Verify the controller and receiver Apps are both on your local network with your Plex Media Server"; "if your Plex App doesn't appear in the XML there, then it won't be available".
**Classification:** ABSENT. CanonCore has no concept of a CLIENT/DEVICE as a registered entity at all — no device table, no session, no per-device identity.
**Need:** MEDIUM. Not needed before the cap, but three consequences land later: (a) "which device am I continuing on" for Continue Watching, (b) revoking a lost phone, (c) casting (article 27). One device table with an id, name, last-seen and a token is the cheapest thing that unblocks all three, and the prompt's "one password, no signup" has no device notion in it.

### 34. https://support.plex.tv/articles/201812808-cast-from-android/
**Capability:** Cast UX detail: a persistent "Players" target selector, browse-mirroring to the receiver while browsing, an explicit Disconnect that returns playback to the local device.
**Rules (verbatim):** "As you browse content on your device, details about that content will be mirrored and displayed on Chromecast"; "Casting support is currently only available when using the 'Mobile' Application Layout; it is not available in the 'TV' layout".
**Classification:** ABSENT (same gap as 27/33).
**Need:** MEDIUM, same as 27 rather than an additional one. The transferable detail is that the cast target is a MODE the whole app is in, not a per-play choice.

### 35. https://support.plex.tv/articles/201812818-cast-from-ios/
**Capability:** iOS equivalent of 34; nothing new.
**Classification:** ABSENT (duplicate of 27/34).
**Need:** n/a, already counted.

### 36. https://support.plex.tv/articles/201839548-does-the-computer-have-to-stay-running/
**Capability:** The always-on server model stated plainly.
**Rule (verbatim):** "Yes. … the computer or device with your Server needs to be powered on and that the Server needs to be running."
**Classification:** ADOPTED implicitly. CanonCore is self-hosted server software; nothing suggests otherwise.
**Need:** n/a.

### 37. https://support.plex.tv/articles/201844613-early-access-beta-releases/
**Capability:** A release channel setting on the server (`Update Channel`: public or beta), plus in-app update checking that prompts to install.
**Rule (verbatim):** "Plex Media Server can automatically check for updates and prompt to install them when available. You can choose whether you want to check for regular public releases or beta releases."
**Classification:** ABSENT. CanonCore has a "forward-applicable ladder" of migrations and says "a released version can always migrate forward", so it clearly expects releases — but says nothing about how a self-hosted instance LEARNS about or applies one.
**Need:** MEDIUM. The migration ladder is explicitly justified by "the moment anyone other than you is running it", which presumes an upgrade path exists; an update-check that phones home also collides with the telemetry question in article 9. Decide once: does a CanonCore instance ever call out to check a version? A one-line "no update check, upgrade is `docker pull`" is a real decision the prompt currently leaves open.

### 38. https://support.plex.tv/articles/201862428-plex-accounts/
**Capability:** The full account surface: sign-in (password / Google / Apple), sign-up, username rules, password reset, account deletion, per-account audio/subtitle stream preferences, marketing preferences, privacy page.
**Rules (verbatim):** username "Allowed characters: a-z, A-Z, 0-9, _, ." and "Maximum length: 30 characters"; "If there is no Plex account matching the submitted address or if you have deleted your Plex account, then no email will be sent" (an enumeration-resistant reset flow); "Update your account preferences for automatically selecting audio and subtitle streams".
**Classification:** REFUSED in bulk — "Single user, one password, no signup, no multi-tenancy". Two genuinely ABSENT sub-points survive the refusal:
 - **Password reset / recovery.** One password and no email service means a forgotten password locks the owner out of their own instance permanently. The prompt does not say what the recovery path is (CLI reset command? config file? re-run setup?).
 - **Account-level playback preferences** (preferred audio and subtitle language). These are per-owner settings, not per-item, and CanonCore has no settings surface named anywhere.
**Need:** MEDIUM on password reset specifically. It is the one authentication feature a single-user system still needs, and the answer must be a local operation, not an email.

### 39. https://support.plex.tv/articles/201869908-log-files/
**Capability:** An index page whose whole job is "here is how to get logs from every one of our fourteen client platforms".
**Classification:** ABSENT (the diagnostics gap, articles 1/18/21/22/24).
**Need:** MEDIUM, already counted. The transferable observation is that a multi-client product needs a log story per client and Plex treats that as a first-class documentation obligation.

### 40. https://support.plex.tv/articles/201941078-uninstall-plex-media-server/
**Capability:** Complete uninstall, enumerating every location the product wrote to on each platform: app dir, application support, caches, logs, registry key, macOS defaults domain, the Linux service user.
**Rule (verbatim):** "Following the instructions below will completely remove your Plex Media Server, including all library metadata, viewstates, etc."; "not all package uninstallers will remove all the metadata content in addition to the application itself".
**Classification:** ABSENT. CanonCore names no on-disk footprint at all — no data directory, no cache location, no log location.
**Need:** MEDIUM, and it is the same missing decision as backup (article 11). "Where does an instance keep its state" is one answer that serves backup, restore, uninstall, and the docker-volume story the `dbSetup docker` scaffold implies. Answering it once is cheap; discovering it is scattered across four places later is not.

### 41. https://support.plex.tv/articles/201955473-why-does-the-chromecast-show-my-bt-router-page/
**Capability:** A single-vendor router-interference workaround.
**Classification:** ABSENT / not applicable. No transferable rule.
**Need:** LOW.

### 42. https://support.plex.tv/articles/201998867-investigate-media-information-and-formats/
**Capability:** MEDIA ANALYSIS as a first-class stored fact, and a user-facing "Get Info" window exposing it: container, video codec, audio codec(s), subtitle format, resolution, bitrate, channels, language per stream, plus per-item XML export. Explicitly models a file as Media -> Part -> {Video, Audio[], Subtitle[]} streams.
**Rules (verbatim):** "Your content is much more than just a file extension. Your media has some important properties: File container… Video codec… Audio codec… Subtitle format"; "The information shown within Plex is the actual info used by the server, so it should be considered the 'true' information"; "if the library item has multiple parts, they'll be listed here".
**Classification:** ABSENT, and it is the single most consequential omission in this block.
**Need:** HIGH. See GAPS. CanonCore's `files` table stores identity (SHA1 triple), path and a role, and NOTHING about what is inside the file. Direct-play-only makes stream-level facts load-bearing rather than cosmetic: the client must know the codec before it opens the route, "say so plainly" needs the codec to name a reason, embedded subtitle tracks (article 5) live here, and duration — which the completion rule depends on ("TIME REMAINING under a small absolute figure… Percentage is the fallback only where duration is unknown") — is a stream fact with nowhere to be stored. The prompt treats duration as possibly-unknown, which is right for catalogue metadata and wrong for a file that is physically present and measurable.

### 43. https://support.plex.tv/articles/202188298-play-queues/
**Capability:** The play queue as a distinct, transient, ordered structure separate from a playlist, with two documented insert points and an explicit/implicit distinction that changes where "add to end" lands.
**Rules (verbatim):** "Play Queues are not permanent playlists"; "Play Next will: Add the selection to the Play Queue after the current item"; "Add to Up Next will: Add the selection to the Play Queue at the end of customizations you've already made"; implicit queuing is "where you start something and other things 'come along for the ride'".
**Classification:** ABSENT, and interestingly so. CanonCore has containers with ORDER as its central feature and no playback queue at all. Pressing play on an item inside an ordered container has no stated behaviour: does the next placement play?
**Need:** MEDIUM-HIGH, and see GAPS. The reason it matters more here than in Plex is that CanonCore items sit in MANY orderings at once, so "what plays next" has several correct answers and the container you arrived through is explicitly "navigation state carried alongside the address, never encoded in it". That design choice makes the queue question harder, not easier: the thing that determines what plays next is precisely the piece of state the prompt refuses to put in the URL.

### 44. https://support.plex.tv/articles/202197488-scheduled-server-maintenance/
**Capability:** The user-facing half of article 16 — maintenance is a WINDOW the owner picks, with a recommended length, and some jobs opportunistically ride along inside it.
**Rules (verbatim):** "Choose the start and end times for maintenance (these are based off the local time on your Plex Media Server)"; "Typically, a 3-4 hour window for maintenance is more than sufficient"; "tasks which occur every three days or every week may not occur for the first time until a few days after scheduling is enabled".
**Classification:** ABSENT (same gap as 16).
**Need:** HIGH, already counted at 16. The additional detail worth keeping: the window is expressed in SERVER LOCAL TIME, which is a real decision for a product with a timestamp column on every table.

### 45. https://support.plex.tv/articles/202197528-video-preview-thumbnails/
**Capability:** Preview thumbnails again, with the disk-cost figure and a three-way generation policy (off / maintenance only / maintenance and on-add), toggleable per library.
**Rules (verbatim):** "A typical index will be 10-50MB in size for a single library item"; "It's not uncommon for a single movie to take 10 minutes or more of processing".
**Classification:** REFUSED (transcoding).
**ABSENT sub-point:** the generation-policy shape — off / deferred to the window / immediate — is a good pattern for CanonCore's own expensive background work (enrichment, projection rebuild, palette extraction on artwork fetch). The prompt says palette extraction happens "when the artwork is fetched" and nothing about whether that blocks.
**Need:** LOW for thumbnails; the policy shape rolls into the scheduler gap at 16.

### 46. https://support.plex.tv/articles/202393718-how-do-i-find-duplicate-or-merged-content/
**Capability:** A `Duplicates` filter that surfaces items which were auto-merged because two files matched the same external record, so the owner can inspect and split them.
**Rule (verbatim):** "Sometimes, users may have multiple items in a library matched as the same thing. In that case, those items would be 'merged' together by default, and only one library entry would be shown."
**Classification:** DIVERGENT and partly ABSENT. DIVERGENT: Plex merges automatically on match; CanonCore's merge is an explicit owner operation with a permanent alias ("the loser becomes a PERMANENT ALIAS"). CanonCore also bans the word ("Never 'duplicate'… Two files with the same content are a REDUNDANT FILE").
**ABSENT:** there is no stated way to FIND merge candidates. Merge exists as an operation with no discovery surface, and the enrichment design produces exactly this situation — "agreeing identifiers between providers are evidence they describe the same work" is a merge signal nothing consumes.
**Need:** MEDIUM. The prompt already commits to remembering rejections ("REJECTIONS ARE REMEMBERED, or the queue refills with the same questions forever") which presupposes a candidate queue; a same-item merge queue is the sibling of the same-record match queue and needs the same rejection memory. Worth naming so it does not get built without it.

### 47. https://support.plex.tv/articles/202462186-viewing-item-details/
**Capability:** The item detail page contract itself, enumerated field by field, plus in-page track selection and a personal star rating.
**Rules (verbatim):** field list "Movie poster, Title, Year, Duration, Genres, Star Rating, Content Rating, Director, Cast, Audio/Subtitle information, Summary, Resolution and Audio information"; "Below the movie Poster, you will see a visual progress bar to indicate how far through the movie is if it is in-progress"; "The default selection for audio and subtitle track will be based on the audio/subtitle account settings (for the account currently signed in), as well as the properties of the media item being viewed"; "The screen is largely the same between various media types, but there are minor differences."
**Classification:** Mostly ABSENT, one DIVERGENT. DIVERGENT and in CanonCore's favour: Plex's detail screen is per-media-type with hardcoded fields; CanonCore's page is driven by the properties table and is medium-agnostic. That last quoted line is quiet evidence FOR CanonCore's approach — Plex's own docs admit the screens are 90% identical and still ships four of them.
**ABSENT:** (a) a PERSONAL RATING. CanonCore has no rating of any kind — owner rating is expressible as a `rating` statement sourced to the Owner, but nothing says so and it is not in the seed dozen. (b) The progress bar on a poster, i.e. progress surfacing in browse, not just on the item page. (c) Track selection at play time, which needs article 42's stream data.
**Need:** MEDIUM on personal rating. It is one seed property and a UI control, it fits the statements model exactly, and every comparable product has it; its absence from the seed list is more likely oversight than decision.

### 48. https://support.plex.tv/articles/202485658-restore-a-database-backed-up-via-scheduled-tasks/
**Capability:** The restore half of the automatic backup: where backups land, the date-stamped naming convention, and the exact stop-server / swap-files / fix-permissions / start-server procedure — including the SQLite `-shm` and `-wal` sidecars.
**Rules (verbatim):** "The database backups will have the date in the filename"; "Stop/quit your Plex Media Server"; "The '-shm' and '-wal' are temporary files and may not be there"; "Ensure that Plex Media Server has read/write permissions to the restored database file(s)".
**Classification:** ABSENT (same gap as 11 and 16).
**Need:** HIGH, already counted. The detail worth carrying: a backup nobody has documented a RESTORE for is not a backup, and the restore procedure is where the file-permission and WAL-sidecar traps live. CanonCore is Postgres, so the equivalent is `pg_dump`/`pg_restore` and the same "which volume, which user" question.

### 49. https://support.plex.tv/articles/202526943-plex-free-vs-paid/
**Capability:** The commercial boundary stated explicitly, notably that LOCAL playback of your own media is free and REMOTE playback of your own media is the paywall.
**Rules (verbatim):** "The video/music/photo media you own is yours. Of course, we don't charge you in any way for that"; "'Remote' in this context means not being on the same local network as the Plex Media Server."
**Classification:** REFUSED / n/a. No subscriptions, no tiers, no entitlement.
**ABSENT sub-point:** the LOCAL-versus-REMOTE distinction as a first-class concept. CanonCore's security section covers outbound fetch and a public read path; it never says whether an instance is reachable from outside the LAN, or how. That is the single biggest practical difference between Plex and a bare self-hosted app, and Plex monetised it because it is hard.
**Need:** MEDIUM. Remote access (reverse proxy, TLS, no relay service) is the thing a phone app forces, and the prompt commits to a phone app while saying nothing about how it reaches the server from outside the house.

### 50. https://support.plex.tv/articles/202529153-why-is-my-plex-media-server-directory-so-large/
**Capability:** Disk-footprint accounting for the server's own state directory, an explanation of which subdirectory grows and why, per-library opt-out, a bulk "Delete Preview Thumbnails" reclaim action, and a documented way to relocate the data directory.
**Rules (verbatim):** "the majority of space here will be taken up by metadata—particularly by artwork"; "It isn't uncommon for installs to take several gigabytes of space"; "can easily take dozens or even hundreds of gigabytes"; "disabling the settings will not affect existing video preview thumbnails; only future items will be affected"; "you should make sure you do so to an internal drive… Moving to a network location or an external (e.g. USB) drive can result in poor, unexpected, or even completely broken behavior."
**Classification:** ABSENT.
**Need:** MEDIUM, and there is a CanonCore-specific edge here that generalises badly. The prompt says artwork is "Provider-supplied URL" and that the palette is extracted "when the artwork is fetched". Fetching to extract a palette but storing only a URL means the image is downloaded and thrown away; caching it means Plex's exact problem, artwork dominating the data directory. Nothing in the prompt says which, and it is the difference between a 50MB instance and a 50GB one. Also note the reclaim pattern: a derived-data store needs a purge action, not just a disable toggle.

### 51. https://support.plex.tv/articles/202605013-play-queue-post-play-screen/
**Capability:** Post-play / auto-advance, with unusually precise and well-reasoned firing rules.
**Rules (verbatim):** post-play shows "Interstitially… and at the end of queues and single-item playbacks, except for curated playlists"; "If the video that just completed was > 5 minutes in length"; "If the video that just completed was not a trailer"; auto-advance suppressed "If videos have been playing without user intervention for more than two hours, and the video that just completed is > 20 minutes in length"; stated intents include "prevent having a whole television season get played through if you fall asleep".
**Classification:** ABSENT. CanonCore has no post-play, no auto-advance, and no next-item concept (see article 43).
**Need:** MEDIUM. Note the striking convergence: CanonCore independently arrived at a five-minute threshold for the same class of problem — "Force-complete anything under five minutes so trailers never sit in Continue Watching" — and Plex uses "> 5 minutes" and "not a trailer" to gate post-play. Same number, same reason, different feature. That is evidence the five-minute rule is a genuine constant in this category rather than a guess. The two-hour unattended-playback cutoff is the non-obvious rule worth stealing outright, and it costs one timestamp.

### 52. https://support.plex.tv/articles/202606363-how-do-i-delete-something-from-my-library/
**Capability:** Two deletion paths — remove the file and rescan, or delete from inside the app (which deletes the FILE) — the latter behind an off-by-default server setting, plus a restorable Trash and an explicit Empty Trash action.
**Rules (verbatim):** "Deleting an item this way will immediately remove it from your library and will also delete the corresponding media file. This will usually place it in your operating system's Recycle Bin or Trash, but it could immediately and permanently delete the item from your disk"; "you'll have to make sure that the ability to delete media is enabled… Be very careful with enabling and using this ability"; "If you remove all of the content from a source location, a scan may not remove content as the server may treat things as if the content location was unavailable."
**Classification:** DIVERGENT and partly REFUSED, with one real ABSENT.
 - DIVERGENT: CanonCore's DELETE section is far more developed — three previewed outcomes with counts, "Remove from this container" offered only when multi-placed, pre-deleted parent edges, non-dismissible confirmation. Plex has none of that.
 - REFUSED by implication: deleting the file from the app. "The scanner NEVER writes storage" is about the scanner specifically, but the whole posture is that CanonCore does not modify the media tree. This should be said outright, because delete-the-file is the one destructive capability every comparable product ships and CanonCore's delete section discusses only catalogue rows.
 - ABSENT: a TRASH. CanonCore's delete is immediate and irreversible once confirmed; there is no undo, no restore window, no staging state. It has tombstones on every table but never says a tombstone is user-visible or restorable.
**Need:** HIGH on the trash/undo question. See GAPS.

### 53. https://support.plex.tv/articles/202796273-why-are-there-old-or-duplicate-server-entries-in-the-dashboard-sidebar/
**Capability:** Stale device/server registrations accumulating, and an Authorized Devices screen to revoke them.
**Rule (verbatim):** "Go to Settings > Authorized Devices… Use the X button for any duplicate Plex Media Server entries that no longer actually exist."
**Classification:** ABSENT (device registry gap, article 33). The transferable half is REVOCATION: a device list is useless without one, and stale entries accumulate by default.
**Need:** MEDIUM, same gap as 33.

### 54. https://support.plex.tv/articles/202819226-how-do-i-turn-off-trailers-and-extras-from-being-retrieved/
**Capability:** A provider-side toggle ("Find trailers and extras automatically") controlling whether the agent pulls extra content, plus the fact that removing already-fetched provider data requires a metadata REFRESH rather than a delete.
**Rule (verbatim):** "For content already in your Library, refreshing the metadata will remove the extras."
**Classification:** REFUSED (extras/trailers are provider-supplied non-artwork assets). ABSENT: PER-PROVIDER CONFIGURATION. CanonCore providers are a URL plus a credential answering a contract; nothing says a provider carries owner-settable preferences, and nothing says what happens to already-applied statements when a provider is disconnected or its settings change.
**Need:** MEDIUM. "I disconnected TMDB — do its statements stay?" has no answer in the prompt, and both answers are defensible. Statements carry `source`, so the data model supports either; the decision is missing, not the mechanism.

### 55. https://support.plex.tv/articles/202819366-why-won-t-trailers-or-extras-play/
**Capability:** Playback failure for remotely-hosted content, with an unusual named cause: clock skew breaking a signed request.
**Rule (verbatim):** "Your computer's system time is used as part of the request made to the online service… The computer's timestamp doesn't need to be exactly correct, but if it's too far off then the request will be rejected."
**Classification:** ABSENT. Not about trailers: it is that a self-hosted server making authenticated outbound calls fails in a way the owner cannot diagnose when its clock drifts. CanonCore makes outbound calls to providers (TMDB with a key) and has timestamps and `observed_at` on statements.
**Need:** MEDIUM. Clock skew on a self-hosted box corrupts `observed_at` ordering and the six-month TMDB cache expiry as well as breaking auth, and the failure presents as "provider stopped working". One health check is enough.

### 56. https://support.plex.tv/articles/202915258-where-is-the-plex-media-server-data-directory-located/
**Capability:** The canonical "where does this program keep its state" reference, per platform, including the Docker case.
**Rule (verbatim):** "The location for the data directory for Plex Media Server when running Docker will depend on what you specified when setting up the Docker container."
**Classification:** ABSENT (same gap as 11/40/48/50).
**Need:** MEDIUM, already counted. The observation worth keeping is that this is a SEPARATE, HEAVILY-LINKED article: six other articles in this shard link to it, which is what it looks like when "where is the state" is load-bearing.

### 57. https://support.plex.tv/articles/202920803-extras/
**Capability:** Server settings for Extras/Cinema Trailers, including a pre-roll video feature with a homegrown mini-syntax.
**Rules (verbatim):** "Separate videos with a comma: all specified pre-roll videos will be played sequentially"; "Separate videos with a semi-colon: a single pre-roll video will be chosen randomly from the list"; "When specifying multiple videos, do not insert spaces after (or before) the separator character."
**Classification:** REFUSED (extras). ABSENT and worth flagging as an ANTI-PATTERN rather than a gap: a settings string whose punctuation encodes control flow, with a whitespace trap. CanonCore's equivalent temptation is the "declared SOURCE ORDER" and "declared edition order" — both are ordered lists in settings and both must be real ordered rows, not a delimited string.
**Need:** LOW as a feature; the anti-pattern is worth one line.

### 58. https://support.plex.tv/articles/202934883-cinema-trailers-extras/
**Capability:** Extras as a content class attached to a parent work — trailer, deleted scene, gag reel, behind the scenes — obtainable either from a provider (streamed, not stored) or from local files under a naming convention.
**Rules (verbatim):** "These extras are not downloaded and stored locally; they are streamed as-needed and thus require an active internet connection to use"; "Allow red band trailers"; "Localized subtitles: When available, include additional extras that have subtitles matching your library's language. (Most users will prefer to not have this enabled.)"
**Classification:** REFUSED as designed. But there is a real modelling question underneath that CanonCore ANSWERS BETTER THAN IT REALISES and should say out loud: a deleted scene, a gag reel and a behind-the-scenes featurette are separate WORKS related to the film, not properties of it. CanonCore's model handles this natively (an item with a `part_of` or `based_on` relation, or a placement in an "Extras" container) whereas Plex needed a whole parallel content class with its own naming rules.
**ABSENT:** the "streamed from a provider, never stored" pattern — a playable thing whose bytes CanonCore does not have and never will. CanonCore's `files` table is local paths only; an item whose only edition is a remote URL has nowhere to live.
**Need:** LOW-MEDIUM. Deliberately out of scope ("it never stores media: a source is a reference") but that sentence and the filesystem-path-only storage rule are in mild tension and nobody has reconciled them.

### 59. https://support.plex.tv/articles/202934933-cinema-trailers-extras-plex-web-app/
**Capability:** Client-side half of Cinema Trailers, plus a content-rating-driven selection constraint.
**Rule (verbatim):** "The available pool of trailers will be based on the rating of the movie being played, if the movie has a US content rating (e.g. if you play a PG movie, only G or PG trailers will play). For other movies, the trailers will be restricted to trailers of G, PG, and PG-13 movies."
**Classification:** REFUSED (extras). ABSENT: CONTENT RATINGS as a concept. CanonCore has no age/content rating anywhere — not a column, not a seed property, not a vocabulary.
**Need:** LOW while single-user (the owner already knows), MEDIUM the moment the public demo or multi-user exists. It is expressible as a `content_rating` statement; the note is only that it is not in the seed dozen and the public read path "NAMES every field it emits", so adding it later is a deliberate act.

### 60. https://support.plex.tv/articles/202967086-windows-errors-trying-to-upgrade-install-or-uninstall-plex-media-server/
**Capability:** Platform-specific installer failure recovery.
**Classification:** ABSENT / not applicable. CanonCore's install story is Docker per the scaffold config.
**Need:** LOW.

### 61. https://support.plex.tv/articles/202967376-clearing-plugin-channel-agent-http-caches/
**Capability:** A PER-PROVIDER HTTP response cache, stored in a directory named after the agent, individually clearable by deleting that directory.
**Rules (verbatim):** "Various components of your Plex Media Server will cache HTTP requests… This is almost always beneficial, but there may occasionally be times where clearing a particular cache might be useful"; "To clear the cache, you simply delete the directory for the item in which you're interested"; e.g. `/Plug-in Support/Caches/com.plexapp.agents.lastfm`.
**Classification:** ABSENT, and directly relevant. CanonCore has exactly one cache rule — "the six-month cache rule honoured" for TMDB, which is a LICENCE MAXIMUM, not a caching design. Nothing says provider responses are cached at all, where, keyed how, or how an owner busts one.
**Need:** MEDIUM. Two providers with different rules (the wiki: no limit, local; TMDB: six-month cap, rate-limited, remote) is precisely the case that needs a per-provider cache with a per-provider TTL, and the contract test at stop-condition 4 asserts "same failure modes" across both — a cache is a failure mode. Also: the six-month rule is a maximum RETENTION, so it needs eviction, which is a scheduled job (gap 16) with nothing scheduling it.

### 62. https://support.plex.tv/articles/203064726-if-a-transcode-is-throttled-is-that-bad/
**Capability:** Reassurance that a scary-looking status word is normal.
**Classification:** REFUSED (transcoding). Transferable in one line: status vocabulary shown to owners must not read as an error when it is not.
**Need:** LOW.

### 63. https://support.plex.tv/articles/203082707-supported-plex-companion-apps/
**Capability:** A capability MATRIX across clients — every client is declared Controller, Receiver, or both, with per-platform footnotes.
**Rule (verbatim):** "Controller: This is the Plex app you use for control… Receiver: This is the Plex app that's used to actually display and play back the content"; "Casting to Chromecast is available only via Android (mobile), iOS, or the Plex Web App (using Chrome browser)."
**Classification:** ABSENT. CanonCore commits to three clients (web now, phone later, TV later) with materially different codec coverage — the prompt itself says "direct-play-only makes client codec coverage load-bearing" and that expo-video has "no MKV, no DTS or TrueHD and no PGS subtitles". That is a capability matrix, stated as prose, with nowhere to live in the product.
**Need:** HIGH. See GAPS. Direct-play-only means the SERVER must know what each client can decode before it offers a play button, and the prompt has no client-capability concept at all — no device profile, no declared codec support, nothing. This is the mechanism that turns "when a file will not play, say so plainly" from an intention into behaviour, and it is the difference between finding out before or after pressing play.

### 64. https://support.plex.tv/articles/203088737-dynamically-updated-server-components/
**Capability:** Server-side remote configuration and on-demand component download: the server phones home at launch and periodically, pulls feature flags, and downloads components lazily on first use.
**Rules (verbatim):** "When you launch Plex Media Server (and then occasionally while it's running), the server will contact some cloud services on plex.tv to update information"; "this allows us to release server updates… that might offer support for an upcoming feature and then turn on that feature at a later time"; "components can be downloaded when required, such as when playing new types of content for the first time after updating".
**Classification:** REFUSED in spirit, and this is the clearest example in the shard of what CanonCore is defined against. Vendor-controlled feature flags in software someone else runs on their own hardware; CanonCore's own CLAUDE.md-level principle is "Do not introduce a configuration option, feature flag, or environment variable unless something in the repo reads it in the same change", and the product is self-hosted with no vendor service at all.
**ABSENT:** the explicit statement that a CanonCore instance makes NO outbound call except to the providers the owner configured. That is a genuinely valuable property and the prompt never claims it, so nobody is bound by it.
**Need:** MEDIUM, and it is the same decision as articles 9 and 37. One line — "an instance calls out only to configured providers" — closes telemetry, update checks and remote config at once.

### 65. https://support.plex.tv/articles/203395277-connect-app-to-your-plex-account/
**Capability:** DEVICE LINKING for keyboard-hostile clients: the TV app shows a 4-character code (or QR), the user enters it on a second device in a browser, and the app is authorised without ever typing a password on the TV.
**Rules (verbatim):** "Our big screen apps… generally allow you to connect the app to your account by way of a 4-character link code"; "go to https://plex.tv/link and ensure that you're signed into the appropriate Plex account"; "After the code is submitted, your player app will refresh itself a few seconds later and be linked with your account."
**Classification:** ABSENT.
**Need:** HIGH. See GAPS. CanonCore commits to a native tvOS app and has "one password, no signup". Typing a password on an Apple TV remote is the worst input surface in consumer software, and the device-code flow (RFC 8628, which is what Plex is doing here in miniature) is the established answer. It is the same missing piece as article 23(b) — a non-browser client has no stated way to authenticate — and the TV app is where it stops being optional.

### 66. https://support.plex.tv/articles/203726976-why-can-t-i-see-chromecast-on-my-amazon-based-android-device/
**Capability:** A client capability that depends on an OS service being present, and degrades by silently not appearing.
**Rule (verbatim):** "Android devices which do not have Google Play Services will not be Cast Ready. This includes Amazon devices such as the Kindle."
**Classification:** ABSENT / low transfer. Notable only as the general pattern: a capability that is absent rather than broken produces "why can't I see X" support load, so absent capabilities need to be visible as absent.
**Need:** LOW.

### 67. https://support.plex.tv/articles/203810286-what-media-formats-are-supported/ (Smart TV)
**Capability:** A published DIRECT PLAY PROFILE for one client family — the exact container/codec/resolution/framerate/bit-depth/audio matrix that plays without conversion, plus a separate stricter 4K profile.
**Rules (verbatim):** "Container: MP4 · Resolution: 1920×1080 or smaller · Video Encoding: H.264 (level 4.0 or lower) · Video Framerate: 30fps · Video Bit Depth: 8 · Audio Encoding: AAC"; 4K: "Container: MP4 · Resolution: 3840×2160 or smaller · Video Encoding: HEVC (H.265) · Video Frame Rate: 30fps · Video Bit Depth: 8"; "Plex for Smart TVs uses playback systems provided by the TV manufacturer"; music: "MP3, M4A".
**Classification:** ABSENT — this is the concrete form of the gap named at article 63.
**Need:** HIGH, same gap as 63. The important detail for CanonCore is that a profile is not one flag: it is a CONJUNCTION over container, video codec, level, framerate, bit depth, audio codec, resolution and subtitle format, and it varies by client and by 4K-vs-HD within a client. A direct-play-only product needs this as data on both sides of the wire — what the file is (article 42) and what the client accepts (this) — or "will this play" is unanswerable.

### 68. https://support.plex.tv/articles/203810296-why-can-t-it-find-my-local-server/ (Smart TV)
**Capability:** Redirect stub to the general server-discovery troubleshooting article.
**Classification:** ABSENT (server discovery gap, article 15 / 104).
**Need:** already counted.

### 69. https://support.plex.tv/articles/203810306-how-do-streaming-quality-selections-work/ (Smart TV)
**Capability:** Per-client quality setting, with a warning that a high bitrate strains the client's own memory, not just the network.
**Rule (verbatim):** "TV devices may be able to play higher bitrates but be aware that this increases memory and processor strain on the device."
**Classification:** REFUSED (quality ladders). ABSENT sub-point: a client can fail on a file it nominally supports, for resource reasons. Under direct-play-only there is no fallback at all, so this becomes a hard failure.
**Need:** LOW-MEDIUM, rolls into the client-profile gap (63/67).

### 70. https://support.plex.tv/articles/203815766-what-is-plex-home/
**Capability:** The household multi-user model: managed users with no email who cannot sign in independently, fast switching, PIN protection, per-user content-rating profiles, and a hard member cap.
**Rules (verbatim):** "Free Plex accounts may have up to 14 managed users total in your Home (15 total users including the Home Admin account)"; "Managed Users do not have any email address associated with their account and cannot directly sign in to any app"; "A PIN should not be considered true security and is provided as a convenience to help control access when young children are involved"; "You can only be a member of a single Plex Home"; "The DLNA server will be disabled by default" once a Home exists.
**Classification:** REFUSED for now, deliberately and explicitly: "Single user, one password, no signup, no multi-tenancy… owner_id stays on every table so multi-user is a later migration rather than a rewrite", and "No visibility system… Add it when multi-user arrives".
**ABSENT, and worth recording against the day multi-user arrives:** the managed-user shape is the one part that is not obvious. A profile that has no credential of its own, exists only inside one instance, and is switched INTO from an already-authenticated session is a much smaller thing than a second account — and it is what "the kids' profile" actually needs. CanonCore's `owner_id`-on-every-table plan anticipates accounts, not profiles, and progress is keyed per (owner, edition); a household needs per-profile progress long before it needs per-profile auth.
**Need:** MEDIUM as a note, LOW as work now. The prompt's deferral is sound; the thing to record is that the first multi-user need is PROFILES (separate progress, no separate credential), which is a smaller migration than accounts and should not be pre-empted by a heavier design.

### 71. https://support.plex.tv/articles/203824366-why-can-t-the-xbox-one-app-find-my-local-server/
**Capability:** Redirect stub; the one rule is that some clients require the SERVER to be signed in before they will talk to it.
**Classification:** REFUSED (no account service, so nothing to sign in to). Worth noting as the failure mode CanonCore avoids by construction: a self-hosted server that cannot serve its own LAN because a cloud account is unreachable.
**Need:** LOW.

### 72. https://support.plex.tv/articles/203824396-what-media-formats-are-supported/ (Xbox)
**Capability:** A second, completely different direct-play profile — this one enumerated per CONTAINER, each container listing its own permitted video and audio codecs (ASF, AVI, MOV, MP4, MPEG, MPEGTS/TS, MKV, WMV), plus 4K rules with "No subtitles are enabled" as a condition.
**Rules (verbatim):** e.g. "MKV container · Video Encoding: H.264, hevc (H.265), mpeg4, msmpeg4v2, msmpeg4v3, vc1, vp9, wmv3 · Audio Encoding: aac, ac3, alac, e-ac3, flac, mp2, mp3"; 4K requires "No subtitles are enabled".
**Classification:** ABSENT (client-profile gap).
**Need:** HIGH, same gap. This article is the proof that the profile is a per-container matrix rather than a flat codec list — the same codec is allowed in one container and not another on the SAME device — and that a subtitle track can itself disqualify direct play. CanonCore's model puts subtitles in a separate `files` row with role `subtitle`, which is the good shape for this, but nothing consumes it at play time.

### 73. https://support.plex.tv/articles/203835596-is-xbox-live-gold-required/
**Capability:** Platform entitlement FAQ.
**Classification:** n/a.
**Need:** LOW.

### 74. https://support.plex.tv/articles/203841316-plex-media-server-can-t-sign-in-to-plex-account-or-be-claimed/
**Capability:** TLS failure diagnosis for the server's own outbound HTTPS calls, with the two real causes named and log excerpts shown.
**Rules (verbatim):** "SSL certificate problem: certificate is not yet valid" — "This almost always indicates that the date/time is not set correctly on the computer or device running Plex Media Server. If the date/time is set too far in either the past or future, the mismatch will invalidate usage of the security certificate"; "SSL certificate problem: unable to get local issuer certificate" — "It's typically something 'injecting' itself into the certificate chain", naming security software, proxies, VPNs, and "Internet Service Provider requiring you install a Certificate Authority certificate".
**Classification:** ABSENT, and it lands squarely on CanonCore's Safe External Fetch boundary. SSFB is specified as "HTTPS only; deny localhost, RFC1918, link-local and cloud metadata addresses; re-validate at every redirect hop; cap the response size; set a timeout" — a correct security spec that says nothing about what the owner SEES when it refuses, or how a TLS failure is distinguished from a rejected address, a timeout, or a size cap.
**Need:** MEDIUM. HTTPS-only plus a locked-down fetcher plus a corporate MITM proxy equals "the provider does not work" with no explanation, and the clock-skew case (also article 55) is the same failure twice. SSFB needs a named, distinguishable failure taxonomy surfaced to the owner — which is also what stop-condition 4 means by "same failure modes" across both providers.

### 75. https://support.plex.tv/articles/203868088-unlocking-or-activating-plex-for-android/
**Capability:** App-store activation, per-store purchase non-portability, restore-purchase flow.
**Rules (verbatim):** "The playback restriction mentioned is a 1-minute limit on playback from a Plex Media Server"; "a purchase in Google Play doesn't transfer to the Amazon Appstore or iTunes"; "In-app purchases cannot be refunded".
**Classification:** REFUSED / n/a. No monetisation.
**Need:** LOW. The only durable observation: an unpaid client crippled at ONE MINUTE of playback is the thing self-hosted users switch away from, and CanonCore's clients being unconditionally free is a differentiator worth not accidentally trading away.

### 76. https://support.plex.tv/articles/203888038-how-do-i-leave-a-plex-home/
**Capability:** Teardown semantics for a multi-user grouping, with the destructive case named: the admin leaving destroys the group and irreversibly deletes every dependent profile.
**Rule (verbatim):** "Leaving the Plex Home as the admin will permanently destroy that Home and will immediately (and permanently) delete any existing Managed Users."
**Classification:** REFUSED / n/a now. But the PATTERN is exactly what CanonCore's DELETE section is about: an action whose blast radius is not visible from where you click it. CanonCore already handles this better ("Three outcomes, previewed with counts before acting… Show what would happen first: containers left, children orphaned, survivors").
**Need:** LOW as work. Worth recording as confirmation that the previewed-counts rule generalises beyond items to any owning relationship, including whatever multi-user brings.

### 77. https://support.plex.tv/articles/203948776-managed-users/
**Capability:** The precise definition of a credential-less profile.
**Rules (verbatim):** "No unique username is required · No email address is required · No password is required · Cannot sign in directly themselves… · Cannot be given access to Plex Media Server content except by the Home Admin · Cannot run a Plex Media Server of their own."
**Classification:** REFUSED for now (see 70).
**Need:** MEDIUM as a recorded note. This is the cleanest statement anywhere of what a household profile is, and it is materially cheaper than an account: no credential, no email, no independent session, created and destroyed by the owner. If CanonCore ever wants "the kids can have their own Continue Watching", this is the shape, and it does not require the auth rewrite that "multi-user" implies.

### 78. https://support.plex.tv/articles/203948786-plex-home-security-changes/
**Capability:** Security posture that TIGHTENS AUTOMATICALLY when the threat model changes — creating a Home (or merely setting a PIN) forces all clients to authenticate and disables the unauthenticated DLNA server.
**Rules (verbatim):** "All access to the server requires authentication, regardless of any setting in Settings > Server > Network > List of networks that are allowed without auth"; "The DLNA server built in to Plex Media Server will be disabled completely. DLNA access does not use a specific user account and so it would have full access to all of your media"; "Enabling the DLNA server means that any DLNA device or app will have full, unrestricted access to your content."
**Classification:** ABSENT, and this one is genuinely instructive.
**Need:** MEDIUM-HIGH. Two things CanonCore has no answer for. (a) There is an implied "allowed without auth" concept in every self-hosted media server — a LAN range that skips login — and CanonCore neither offers nor forbids it; an implementer will add it because every product in this category has it, and it is the single most common way these servers get exposed. Say no explicitly. (b) A secondary unauthenticated protocol surface (DLNA here) is exactly the sort of thing that gets bolted on later for TV compatibility and carries no access control; CanonCore's "playback goes through an app-owned opaque-id route so access control and progress work" is the right instinct but is not stated as a rule that BINDS future protocol surfaces.

### 79. https://support.plex.tv/articles/203953173-why-can-t-i-see-chromecast-on-my-ios-5-device/
**Capability:** Minimum-OS consequence of an SDK upgrade.
**Classification:** ABSENT / not applicable. CanonCore states no minimum OS versions for its planned clients.
**Need:** LOW.

### 80. https://support.plex.tv/articles/203960236-consequences-of-being-in-a-plex-home/
**Capability:** The honest consequences page for the household model, including the security-relevant admission that switching users is full impersonation.
**Rules (verbatim):** "When you switch to another user, you really are switching to that user. You effectively BECOME that user"; "If the user runs a Plex Media Server, you can access and change the Server settings"; "In order to use Fast User Switching to switch between members of a Plex Home, you must have an active internet connection. Apps will cache information related to the last-used user, so if you're offline you'll still be able to access an app with that last-used user"; "You should only join a Plex Home if you completely trust the Home admin".
**Classification:** REFUSED / n/a.
**ABSENT sub-point worth keeping:** OFFLINE DEGRADATION as a designed behaviour. Plex documents exactly what still works when the network is gone (last-used profile, cached info) and what does not (switching). CanonCore is self-hosted and mostly LAN, but a phone app off the LAN, or a server whose provider calls fail, needs the same statement: what does the product still do when it cannot reach the outside?
**Need:** MEDIUM. Ties to the offline-downloads point at article 29 and the provider-failure point at 74.

### 81. https://support.plex.tv/articles/204041406-where-are-plex-media-server-cached-images-stored-on-my-computer/
**Capability:** A dedicated on-demand image cache (`PhotoTranscoder`) — images are resized as requested by clients and cached, separate from the metadata/artwork store.
**Rule (verbatim):** "As various Plex apps request images from your Plex Media Server, they will be generated as needed and then cached for future use."
**Classification:** ABSENT, and it is the missing half of the artwork design.
**Need:** MEDIUM. CanonCore's artwork table holds "Provider-supplied URL… and its extracted palette". Three unanswered questions follow, and this article answers all three for Plex: is the image ever stored locally; is it resized per client (a TV poster grid and a phone list want very different bytes); and does the browser fetch it from TMDB directly (leaking the viewer's IP and every page they view to TMDB, and breaking on the public demo the moment TMDB rate-limits). Palette extraction already requires fetching the bytes once, so the cheap decision is: fetch, derive palette, cache one or two sizes, serve from the app. Nothing says so.

### 82. https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
**Capability:** The token model made explicit: a temporary token obtained from the web session for debugging, a separate documented flow for long-lived tokens for third-party tools, and global revocation via password change.
**Rules (verbatim):** "When you have the Plex Media Server signed in to an account, the server always requires authenticated access"; "The method explained in this article will get you a token that is valid temporarily. If you're working on a tool or app that needs more permanent authentication, please instead use the method outlined in our third-party development forum"; revocation: "choose to change your password, and check the Sign out connected devices after password change option… This will invalidate all of your tokens".
**Classification:** REFUSED on the mechanism (token in a URL query parameter), ABSENT on the requirement.
**Need:** HIGH. See GAPS. This closes the loop from articles 23, 33, 53 and 65: CanonCore needs (a) a session for the browser, (b) a long-lived, per-device, individually revocable credential for the phone and TV apps, (c) something for scripts, and (d) revocation that does not require changing the one password. The prompt gives it exactly one sentence — "Single user, one password" — and one architectural consequence, that a public read path exists with no auth at all. Everything between those two poles is unspecified, and it is where a self-hosted product's security actually lives.

### 83. https://support.plex.tv/articles/204074136-where-is-plex-for-playstation-available/
**Capability:** Per-region app-store availability.
**Classification:** n/a. No console client, no store distribution.
**Need:** LOW.

### 84. https://support.plex.tv/articles/204075396-is-it-available-for-the-playstation-tv-and-playstation-vita/
**Capability:** Negative availability statement.
**Classification:** n/a.
**Need:** LOW.

### 85. https://support.plex.tv/articles/204080173-which-smart-tv-models-are-supported/
**Capability:** A tiered client-support policy — some platforms get a customised app with full capabilities, others fall back to a shared "Limited" app with a published, deliberately conservative profile. Includes an in-app way for the user to tell which tier they are on, and per-platform TLS limitations.
**Rules (verbatim):** limited profile is "Bit Rate: 4Mbps max · Resolution: 1080p max · Bit Depth: 8 · Codec: H.264 · Container: mp4, mpegts, mov · Audio: AAC, 2 channels"; "go to Settings > About > App Name… If the value is simply 'Plex for Smart TVs' (and not a specific brand), then that means the app does have limited playback capabilities"; "Due to root certificate limitations with the device OS itself, only webOS 5.0+ devices support secure connections with a personal Plex Media Server"; "most Samsung models will not support secure connections with a personal Plex Media Server… ensure that the app is set to Allow Insecure Connections".
**Classification:** ABSENT on two counts.
 - The client-profile gap again (63/67/72), here with the useful addition that the profile is DISCOVERABLE FROM INSIDE THE APP, so a user can tell which tier they are on.
 - **TLS on the LAN.** This is the non-obvious one. TV platforms cannot validate certificates for a private server, so Plex ships an explicit "Allow Insecure Connections" fallback with a matching server-side "Preferred" (not Required) setting. CanonCore's security stance is "HTTPS only" for outbound fetch and says nothing at all about the INBOUND transport — but a self-hosted server on a LAN with no public hostname cannot easily get a trusted certificate, and a native tvOS client will hit ATS, which is stricter than any of these TVs.
**Need:** HIGH on the TLS point. See GAPS — it is a real blocker for the TV app that the prompt has not seen, and its "no cloud service" posture removes the escape hatch (Plex solves it with a `*.plex.direct` wildcard certificate service, which CanonCore by design will not have).

### 86. https://support.plex.tv/articles/204096476-license-information/
**Capability:** A published third-party licence manifest, per app, naming every bundled dependency and its licence.
**Rules (verbatim, notable):** "'Plex New Transcoder' contains code from FFmpeg – LGPL-2.1+"; "MediaInfo – BSD-2-Clause-FreeBSD"; "Google Analytics SDK – Creative Commons Attribution 3.0 and/or Apache 2.0"; "Python – Python 2.1.1"; "libfribidi – GPL-2.0+"; "rtmpdump – GPL-2.0+".
**Classification:** ABSENT, and more relevant than it looks.
**Need:** MEDIUM. CanonCore already carries three licence obligations that must be VISIBLE: the TMDB attribution string "shown prominently" plus attribution "in an About or Credits section", per-artwork "licence and attribution string it came with", and CC BY-SA on anything published derived from the archive. Those need a surface, and that surface is exactly this page. There is no About/Credits screen anywhere in the prompt, yet the TMDB terms the prompt quotes REQUIRE one. That is a stated obligation with no stated home. Also note MediaInfo appearing here: it is the standard library for the media-analysis gap (article 42) and is BSD-licensed, so that gap has a cheap answer.

### 87. https://support.plex.tv/articles/204103443-what-information-is-sent-to-microsoft/
**Capability:** An explicit negative privacy statement for one platform.
**Rule (verbatim):** "Microsoft collects no data about your Plex account or its usage on your Xbox One."
**Classification:** ABSENT. CanonCore makes no privacy statement in either direction (see 9, 64).
**Need:** MEDIUM, same decision as 9/64/37. Worth noting that the value here is a NEGATIVE claim stated plainly, which is the cheapest kind of trust and the kind self-hosted users actually check.

### 88. https://support.plex.tv/articles/204151098-what-models-are-supported-for-the-plex-for-roku-channel/
**Capability:** Minimum hardware generation for a client, stated as a model year.
**Rule (verbatim):** "Model year 2017 or newer / 'sixth gen' or newer".
**Classification:** ABSENT / low transfer.
**Need:** LOW.

### 89. https://support.plex.tv/articles/204232453-fast-user-switching/
**Capability:** Profile switching in the client, PIN gating with the exact three prompts, and a per-device opt-out that skips selection entirely.
**Rules (verbatim):** "You will be prompted to enter the PIN for a user if: you choose to switch to a user that's protected by a PIN · you launch a supported app that was previously last signed in to a protected user · you attempt to add or edit a managed user"; "It is always recommended that if you are the server admin in a Plex Home that you set a PIN, else a user could switch to you and edit server settings"; "full regular accounts can choose to skip pin entry and automatically sign into the last used Home account for any given app".
**Classification:** REFUSED / n/a now (see 70, 77).
**Need:** LOW as work. One durable detail: the per-DEVICE skip-PIN setting. Household security is per-device, not per-account — the living room TV wants no prompt, the phone that leaves the house wants one — and any future CanonCore device model should carry that flag rather than putting it on the profile.

### 90. https://support.plex.tv/articles/204232573-restricting-the-shares/
**Capability:** Access restriction by CONTENT RATING (allow-list or exclude-list) and by arbitrary owner-applied LABELS, combined additively, plus per-user feature toggles (downloads, Live TV/DVR).
**Rules (verbatim):** "If you choose G, PG as the restriction to allow, then only content that is rated either 'G' or 'PG' will be able to be accessed"; "A content rating can either be allowed or excluded. If added to one it will be removed from the other"; "If you specify particular ratings, then content matching the chosen Labels will be shared in addition to the ratings. If you have no ratings specified, then only content matching the Labels will be shared"; and the structural one — "restricting by rating will remove the ability to view that type of library 'by Folder'. This is because folder names cannot be hidden."
**Classification:** REFUSED for now ("No visibility system. Not a column, not propagation, not a resolution rule"), and CanonCore's stated reason is sound: "'Inherit from which parent?' has no answer once an item is multi-placed."
**ABSENT, and this is the interesting part:** that last quoted rule is independent evidence FOR CanonCore's design. Plex cannot hide content in folder view because the folder tree leaks names it cannot filter — a hierarchy-derived browsing surface cannot honour a per-item rule. CanonCore has no folder view at all (the scanner never writes structure, placements are the only ordering), so the failure mode does not exist. Worth recording: when visibility does arrive, it must be a filter on PLACEMENT-derived surfaces only, and any future "browse by path" feature would reintroduce exactly Plex's hole.
**Need:** MEDIUM as a recorded constraint on future work; LOW as work now. Also confirms `label` would arrive as a `category` statement, which the prompt already covers ("A tag is an owner-authored `category` statement").

### 91. https://support.plex.tv/articles/204234313-example-plex-home-setup/
**Capability:** A narrative worked example of the whole multi-user setup, with one design detail worth extracting.
**Rule (verbatim):** "Homer decides that he doesn't want to explicitly share All Libraries. Instead, he'll individually select the movie and TV libraries. That way, if a new library is added in the future, Lisa won't automatically get access."
**Classification:** REFUSED / n/a now.
**Need:** MEDIUM as a recorded note, because it names a real trap: "grant all" versus "grant these" differ only in the FUTURE, and a grant that silently widens as content is added is how self-hosted servers leak. CanonCore's groups are the natural grant unit ("Scopes browsing, search, WHICH PROVIDERS ARE ASKED, scanner roots, and the review queue") and this rule says a grant should enumerate groups, never mean "all groups".
**Meta-observation on this article:** it is a worked, named, end-to-end example, which is exactly the form CanonCore's own stop condition 2 takes (Breaking Bad / Better Call Saul / El Camino). Plex uses one for its hardest-to-explain feature. That is weak but real evidence the technique is right.

### 92. https://support.plex.tv/articles/204234323-creating-a-plex-home/
**Capability:** Setup flow, plus a GUEST account concept: a throwaway profile so a visitor does not pollute the owner's state.
**Rule (verbatim):** "The 'Guest' account is kind of a specialized Managed User. It can be useful if you want to let someone who comes over use Plex without affecting your regular account(s). A friend who stops by, the babysitter, or similar."
**Classification:** REFUSED / n/a now.
**ABSENT sub-point:** "watch something without it counting". CanonCore's progress model is append-only watch events with no dismissal and no time window on Continue Watching ("Continue Watching is computed, never stored. No time window, no dismissal"). That is a strong, defensible design, and its one consequence is that a half-watched thing you did not choose can never be removed from the surface. Plex's answer is a guest profile; Jellyfin's is mark-as-watched.
**Need:** MEDIUM. Not a call to add dismissal — the prompt rejected it deliberately — but the escape hatch needs to be named. Force-complete under five minutes handles trailers; nothing handles "I abandoned this 3-hour film at 40 minutes and never want to see it again". Marking an edition watched by hand may be that hatch, but the prompt never says the owner can write a watch event directly.

### 93. https://support.plex.tv/articles/204245033-i-forgot-my-plex-account-pin-how-can-i-reset-it-how-can-i-change-my-pin/
**Capability:** PIN recovery, with the escalation path: the account password resets the PIN, and an admin resets a managed user's PIN.
**Rule (verbatim):** "The account owner must reset or remove their own PIN if they've forgotten it… enter the account's current password".
**Classification:** REFUSED / n/a now, but it is the same shape as the password-reset gap at article 38: every credential needs a documented recovery path, and the recovery path is always a stronger credential. CanonCore's one password is the strongest credential it has, so its recovery cannot be another credential — it has to be filesystem or CLI access.
**Need:** MEDIUM, same gap as 38.

### 94. https://support.plex.tv/articles/204275243-settings-plex-for-roku/
**Capability:** The full settings inventory for one TV client — worth reading as "what a TV client is expected to let you configure". Notably: watched-indicator display control, default library view (Recommended vs Browse), theme, spring loading (focus-settle auto-navigation), theme music toggle, remote-control receive toggle, autoplay Up Next, clock format, language, and watch-state sync.
**Rules (verbatim):** "Watched Indicators are always shown for episode and season list items on details pages regardless of this setting"; "Enable Spring Loading: When enabled content will load automatically when focus has settled on a navigation button"; "Default libraries to open in Recommended or Browse views".
**Classification:** ABSENT. CanonCore names no client settings at all.
**Need:** MEDIUM, and the two non-obvious entries are the reason. (a) WATCHED INDICATORS ARE OPTIONAL — some people find spoiler-adjacent progress markers unwanted, and CanonCore computes two-figure container progress that will render somewhere by default. (b) SPRING LOADING is a tvOS-focus-engine-adjacent behaviour that only exists because TV navigation is focus-driven; the prompt's TV reasoning is all about focus (React Native "TextInput is not built around the tvOS focus engine", "focus cannot be tested from JavaScript"), so this is a concrete example of what native focus buys and is worth having in mind before the TV app starts.

### 95. https://support.plex.tv/articles/204281528-why-am-i-locked-out-of-server-settings-and-how-do-i-get-in/
**Capability:** THE LOCKOUT RECOVERY PROCEDURE. When the server's stored auth state no longer matches any account you can sign in as, the fix is to edit a local preferences store (registry / plist / `Preferences.xml`) and delete specific keys, then restart.
**Rules (verbatim):** "You'll often see this exhibited as a 'You do not have permission to access this server' or sometimes a 'No soup for you' message"; delete "PlexOnlineHome, PlexOnlineMail, PlexOnlineToken, PlexOnlineUsername"; "Correctly following these instructions will not wipe out a server installation or make you have to re-create libraries."
**Classification:** ABSENT.
**Need:** HIGH. See GAPS. This is the general form of the password-reset gap (38) and the PIN-reset gap (93): a self-hosted server whose owner cannot get in needs a LOCAL, physical-access recovery path that does not destroy data, and it must be documented before it is needed. CanonCore has one password, no email, no vendor, and a Docker deployment — so the answer is a documented CLI or env-var reset — and there is nothing in the prompt about it. The valuable detail is the guarantee Plex attaches: recovery does not wipe the library. Any CanonCore reset must make and keep that promise, because the alternative ("delete the volume and re-import") destroys hand-curated placements that exist nowhere else.

### 96. https://support.plex.tv/articles/204310663-plex-apps-roku-supported-video-audio-formats-for-direct-play/
**Fetched 2026-09-06: HTTP 200 but the page body is "Page not found | Plex Support".** The article has been withdrawn. By title it was another per-client direct-play format matrix (Roku), i.e. the same gap as 67/72/85.
**Classification:** n/a — dead URL. Counted under the client-profile gap.

### 97. https://support.plex.tv/articles/204377223-why-can-t-it-find-my-local-server/ (PlayStation)
**Capability:** Redirect stub to article 101.
**Classification:** ABSENT (discovery gap).
**Need:** already counted.

### 98. https://support.plex.tv/articles/204377253-what-media-formats-are-supported/ (PlayStation)
**Capability:** A fourth direct-play profile, differing again — and this one shows the profile varying by hardware GENERATION within one client.
**Rules (verbatim):** PS5 "Container: MP4 · Resolution: 4096×2160 or smaller · Video Encoding: HEVC, H.264 (Level 5.2 or lower) · Audio Encoding: AAC, AC3, EAC3"; PS4 "Resolution: 1920×1080 or smaller · Video Encoding: H.264 (Level 4.1 or lower), (4K, HEVC for PS4 Pro) · Bitrate: 20Mbps or lower"; "All subtitles types are 'burned' into the video stream for playback which requires transcoding"; "The Plex for PlayStation app does not currently support Direct Playing of MKV container videos"; music: "M4A" only; "DTS audio is not currently supported directly."
**Classification:** ABSENT (client-profile gap, 63/67/72/85).
**Need:** HIGH, same gap, and this article carries the most alarming fact in the set for CanonCore specifically: **on this client, ANY subtitle requires transcoding.** Direct-play-only therefore means "no subtitles on some clients" unless the client renders them itself. CanonCore models subtitles as separate `files` rows with role `subtitle` and a language, which is precisely the shape that lets a CLIENT render them without touching the video — but only if the client is written to do it, and only if the API serves the sidecar separately. That is an architectural requirement on the phone and TV apps, derived from a rule the prompt already made, that the prompt does not state. MKV also being direct-play-impossible here echoes the prompt's own expo-video finding ("no MKV, no DTS or TrueHD and no PGS subtitles").

### 99. https://support.plex.tv/articles/204378183-is-a-playstation-plus-subscription-required/
**Capability:** Platform entitlement FAQ; incidentally confirms the 4-character link-code flow is used on consoles too.
**Rule (verbatim):** "You'll need to link with your Plex account using the 4-character code prompt in the app."
**Classification:** n/a for the subscription half; the link-code half is the ABSENT device-authorisation gap (article 65).
**Need:** already counted (HIGH, at 65).

### 100. https://support.plex.tv/articles/204551227-what-are-the-features-and-limitations-without-unlocking-the-app/
**Capability:** The exact shape of the free-tier crippling: one minute of video, one minute of music, watermarked photos, while all non-playback functionality stays unlimited.
**Rules (verbatim):** "Video is limited to one minute of playback · Music is limited to one minute of playback · Photos will have a watermark added"; casting/flinging and browsing are "Unlimited".
**Classification:** REFUSED / n/a.
**Need:** LOW.

### 101. https://support.plex.tv/articles/204604227-why-can-t-the-plex-app-find-or-connect-to-my-plex-media-server/
**Capability:** The master connection-troubleshooting article, and the clearest statement of Plex's connection model: same-subnet requirement for local discovery, an explicit Remote Access feature for off-LAN, a secure-connections setting that can lock out clients that cannot do TLS, and a documented escape hatch for running unclaimed.
**Rules (verbatim):** "Make sure both the Server and app are on the same subnet of the network"; "Make sure you aren't requiring secure connections on the server while using an app that doesn't support them"; "Disable any VPN on your computer or router · Disable any proxies"; "If you do not wish to claim your Plex Media Server, you have to set the `enableLocalSecurity` advanced, hidden server setting to false"; recover by loading "http://localhost:32400/web or http://127.0.0.1:32400/web".
**Classification:** ABSENT.
**Need:** HIGH. See GAPS. This is the CONNECTION MODEL gap in full: how a client on the LAN finds the server (CanonCore: unspecified — no discovery protocol, no stated "type the address"), how a client off the LAN reaches it (unspecified), and what happens when TLS cannot be established (unspecified, see 85). Plex needs an entire article of workarounds because it bolted a cloud identity layer onto a LAN server; CanonCore has no cloud layer, which removes half these failures for free — but it also removes the mechanism (`plex.direct` certificates, relay, server claiming) that makes the other half work. The prompt commits to phone and TV apps without saying how either finds the server, and `http://localhost:32400/web` is a reminder that the LAST-RESORT path must always be a plain local URL that needs nothing.

### 102. https://support.plex.tv/articles/204985278-account-audio-subtitle-language-settings/
**Capability:** Automatic audio and subtitle track selection driven by account-level language preferences, with a fully specified fallback ladder, three subtitle display modes, a manual-override rule that is permanent, and SDH/forced-subtitle handling.
**Rules (verbatim):** "If you ever manually change the audio or subtitle track for an item… that manual selection will always override any automatic selection… Once you manually select something, it will never automatically change again"; the ladder — "If an audio track that matches your preferred audio language is found, the first one will be used, else · If there are multiple unknown language audio tracks, the first track will be used, else · If there is a single audio track, it will be used even if the language doesn't match"; modes "Manually Selected · Shown with Foreign Audio · Always Enabled"; "Shown with Foreign Audio: If the audio track chosen… is not the same as the 'Primary' language… Plex will try to display the subtitle track with your 'Primary' language"; "A 'Forced' subtitle is for when there's dialog in the movie that's a different language from the main dialog"; "For tracks embedded within the file, the language needs to be set appropriately… If the language is not set, you can do so using various tools (e.g. mkvtoolnix for MKV files)."
**Classification:** ABSENT, and it is the most structurally interesting article in the shard because CanonCore already owns the pattern and has not applied it here.
**Need:** HIGH. See GAPS. Three points. (1) Track selection is CanonCore's own favourite/source-order mechanism in a different costume: a declared preference order decides until the owner pins one, and the pin is permanent. The prompt says that pattern is deliberately reused — "Same mechanism as the source order and the field favourite, deliberately: one pattern used twice, not two patterns" — and this is the third place it belongs. (2) "Shown with Foreign Audio" is a genuinely non-obvious rule that nobody invents from first principles and every user wants. (3) The whole thing is unimplementable without per-track language data, which is the media-analysis gap (42) and the embedded-track gap (article 5) — so those three gaps are one gap wearing three faces.

### 103. https://support.plex.tv/articles/205002628-why-do-i-get-the-this-server-is-not-powerful-enough-to-convert-video-message/
**Capability:** The negotiation between client and server made explicit: the client declares its limits, the server compares them to the file, and if the gap cannot be bridged the play attempt fails with a named reason. Three distinct causes are separated for the user — incompatible file, a client quality setting demanding a conversion, and transcoding deliberately disabled by the admin.
**Rules (verbatim):** "your app tells the Server 'I can only handle up to 4Mbps'"; "The server compares that limitation to the media files and knows that it would need to transcode"; "In cases where your content requires transcoding but the Plex Media Server cannot transcode, there isn't anything that the Server can do to help you here"; "You may wish to manually convert the content to a compatible format (for instance, MP4 container, H.264 video, with AAC 2.0 audio) using third-party tools".
**Classification:** REFUSED on transcoding — and this article is, in effect, Plex documenting what CanonCore's product IS. A Plex server with transcoding disabled is a direct-play-only server, and this page is its failure-mode documentation.
**Need:** HIGH on the ABSENT half, and it is the cleanest statement of it anywhere in the shard. CanonCore says "When a file will not play, say so plainly" and this article shows exactly what "plainly" costs: the client must declare its capabilities, the server must know the file's streams, the comparison must be explicit, and the message must distinguish the causes. CanonCore has none of those three inputs. It also shows the only remedy a direct-play-only product can offer — "convert this file yourself, here is the target format" — which is a genuinely acceptable answer, but only if the product can say which property disqualified the file.

### 104. https://support.plex.tv/articles/205165858-how-to-add-plex-s-package-signing-public-key-to-synology-nas-package-center/
**Capability:** Package signing with a published public key and a verifiable checksum, so a user can confirm a build is authentic.
**Rules (verbatim):** "we have started to sign our packages so users know that they originate from Plex, Inc."; "The key has the 19930ce0357f723e590210e3101321a3 md5sum, if you wish to verify it"; "a new shiny 4096-bit key"; the platform default is "only trust packages from Synology Inc."
**Classification:** ABSENT.
**Need:** MEDIUM. CanonCore ships as a Docker image plus provider services in separate repos, and "PROVIDER DISTRIBUTION" has four tiers with a curated store ("THE CMPP STORE — publicly addable providers, ACCEPTED rather than open"). A curated store implies a trust decision and there is no stated mechanism for it — no signing, no manifest, no pinned digest. Since a provider is "a URL answering a contract", the trust question is really TLS plus a vetting process rather than package signing, but the store cannot be "accepted rather than open" without someone deciding what acceptance means. Also note the MD5 here is 2015-era practice and should not be copied.

### 105. https://support.plex.tv/articles/205556278-unlocking-or-activating-plex-for-ios/
**Capability:** iOS activation, Family Sharing propagation of a one-time purchase, restore-purchase flow.
**Rules (verbatim):** "The purchase is tied to your Apple ID"; "If the activation was purchased by the Family Sharing admin account, then it will be available to other members of the family, too."
**Classification:** REFUSED / n/a. No monetisation.
**Need:** LOW.

### 106. https://support.plex.tv/articles/205568377-adding-local-artist-and-music-videos/
**Capability:** Attaching auxiliary video to music entities via FILENAME SUFFIX TYPING, with a closed vocabulary encoded in the filename, plus a global-folder alternative and a directory-adjacency requirement.
**Rules (verbatim):** "Music/Artist_Name/Album_Name/Descriptive_Name-Video_Type.ext"; types "-behindthescenes · -concert · -interview · -live · -lyrics · -video"; "If you exclude the 'type' from the filename, it will default to the -video type"; "Artist videos must be in a directory that contains at least one music track for the artist"; "it must start with the exact filename of the corresponding music track and must be in the same directory as that track"; "We strongly recommend separating movie and television content into separate main directories… a failure to separate content such as movies and TV shows may result in unexpected or incorrect behavior."
**Classification:** REFUSED, and it is the purest example in the entire shard of the antipattern CanonCore was built against. This is reason 2 of "WHY THIS DOES NOT ALREADY EXIST" — "ORDERING LIVES IN FILENAMES" — generalised: here the filename carries the item's TYPE, its RELATIONSHIP to another item, and its membership, all as string suffixes, and the directory layout carries the library typing that CanonCore explicitly refuses ("never typed by medium").
**Need:** LOW as a feature; HIGH as CONFIRMATION. The relations Plex encodes as `-interview`, `-concert`, `-live` are exactly CanonCore statements (`category` on the item plus a relation to the artist), and CanonCore can express them for any medium with no naming convention at all. Worth keeping as the concrete artefact that shows what the statements model buys, because it is more persuasive than the abstract argument.

### 107. https://support.plex.tv/articles/205651918-will-plex-work-on-my-older-ios-devices/
**Capability:** Minimum OS version, with the App Store purchase-history fallback for older devices.
**Rule (verbatim):** "devices must be running iOS version 14.5 or later"; "The older version of the app is no longer actively supported by Plex. It is available 'as-is'".
**Classification:** ABSENT / low transfer. CanonCore states no minimum OS for its planned clients.
**Need:** LOW.

### 108. https://support.plex.tv/articles/205661857-changing-artist-album-or-track-information/
**Capability:** Manual metadata correction, and the two structural operations it enables: MERGING two wrongly-split entities by retyping the shared field, and SPLITTING one entity into parts by reassigning a disc/part number. Plus multi-select bulk edit with shift-range selection, autocomplete on the field to avoid creating near-duplicate values, and a keyboard shortcut.
**Rules (verbatim):** "it actually got scanned in under an artist named Carmina Burana instead of Carl Orff… we just have to update the metadata for the 'Album Artist'"; "you'll see a new 'Carl Orff' entry in the library, but it might be blank. To populate it, we just need to enter that artist and then do a regular Refresh"; "Some cool autocomplete actions should appear as you type to help you avoid typos"; "You can select the first track, hold down SHIFT, then click the last one to select them all at once"; "type the E keyboard shortcut".
**Classification:** Mixed, and it is one of the more useful articles here.
 - DIVERGENT and worse than CanonCore: Plex merges entities by making a text field equal, which is exactly the failure the prompt names — "ENTITY IDENTITY IS A SURROGATE ID with external-id mappings, NEVER A NAME. Jellyfin keys people on their name, so two people sharing a name merge irreversibly". Plex has the same defect and this article documents it as the intended workflow. Direct confirmation of a claim the prompt makes about a competitor, found in the other competitor.
 - ADOPTED: the keyboard shortcut has a visible UI path (the Edit icon), which is CanonCore's standing rule "Every accelerator has an equivalent visible UI path".
 - ABSENT: **bulk edit / multi-select**. Nothing in the prompt lets an owner act on many items at once — not to set a statement, not to place many items into a container, not to retire a vocabulary value across rows. With an archive of 11,285 stories, 715 properties and vocabularies holding "about 50 one-use wreckage" values, single-item editing cannot clear the mess the prompt already predicts.
 - ABSENT: **autocomplete on value entry.** The prompt has a vocabulary quarantine state for dirty imports but nothing that stops the OWNER creating the next near-duplicate by hand.
**Need:** HIGH on bulk edit. See GAPS.

### 109. https://support.plex.tv/articles/205671068-settings-plex-mobile/
**Capability:** The current mobile settings inventory. Notable beyond article 94: a spoiler-hiding mode, push notifications, an adjustable auto-play countdown with named defaults, and "Passout Protection" as a first-class, user-configurable feature.
**Rules (verbatim):** "Hide Spoilers: Hide TV show episode thumbnails and summaries for unwatched or all shows"; countdown choices "Immediate · 5 seconds · 10 seconds (default for mobile players) · 15 seconds (default for TV players) · 30 seconds · 60 seconds"; "By default auto-playing content will not continue to auto-play the next item, if it's been more than 2 hours since the user last interacted with the app. This is to help prevent content from continually playing if you fall asleep."
**Classification:** ABSENT.
**Need:** MEDIUM, with one item worth more than the rest. **HIDE SPOILERS is a real gap for CanonCore specifically, more than for Plex.** CanonCore's whole product is showing one work sitting in several orderings at once, and a chronological or story-order container is a spoiler surface by construction: a story-order container tells you a character appears later, "Also appears in" reveals which orderings a thing belongs to, and the two-figure container progress reveals how much of a work exists. Plex's version is a display toggle over episode thumbnails; CanonCore's version is harder and more valuable, and the prompt has not noticed the problem exists. Also: the 2-hour passout rule appears here as a user setting, confirming article 51's stated behaviour is durable and worth copying.

### 110. https://support.plex.tv/articles/205671108-media-playback/
**Capability:** The player contract itself. Transport controls with exact skip intervals, a previous-button that is context-sensitive, chapter selection from embedded chapter data, a mini-player for continued playback while browsing, repeat and shuffle modes with stated limits, in-player track and quality switching, and a PLAYBACK INFO panel that tells the user exactly how the stream is being delivered.
**Rules (verbatim):** "Previous – Returns to the beginning of the current video or (if already near the beginning of the item) returns to the previous video in the play queue"; "Jump Back – Jump back 10 seconds"; "Jump Forward – Jump forward 30 seconds"; "'Repeat' modes are only available when more than one item is present in the play queue"; "Shuffle is possible only with the initial playback queue. It is not currently possible to shuffle your queue after adding more items"; "Your video file must contain embedded chapter information for it to be available here"; Playback Info shows "Source – Reflects from where the current file is playing… Video – Reflects whether the current video stream is being played directly or transcoded".
**Classification:** ABSENT.
**Need:** MEDIUM-HIGH, and three parts deserve naming.
 - **The asymmetric skip intervals (back 10, forward 30)** are an industry constant, not a preference: back is for "I missed that", forward is for "skip this". Worth adopting rather than rediscovering.
 - **CHAPTERS.** CanonCore's `files` role list already includes `chapters`, so the data has a home — and this is the only article in the shard that says what a chapter surface is for. But it also says chapters come from EMBEDDED data, which CanonCore cannot read (media-analysis gap, 42). Chapters are additionally the natural rendering of `edition_coverage` intervals, which nothing currently renders.
 - **The Playback Info panel.** A user-visible statement of how the stream is being served is the honest version of "say so plainly", applied to success rather than failure. In a direct-play-only product it collapses to one line ("playing directly from disk"), which is cheap and reassuring — and it is the surface where a failure would otherwise have to appear.

---

STATUS: complete

Covered: all 110 URLs (1-25 by the previous pass, 26-110 here). One dead URL: #96 returns Plex's "Page not found" body.

---

## GAPS — ABSENT FROM CANONCORE

Only MEDIUM and HIGH. Consolidated across the shard; a gap named in several articles appears once.

### HIGH

**G1. Media analysis: CanonCore never learns what is inside a file.**
*(articles 42, 5, 19, 103, 110; enables G2)*
`files` stores identity, path and a role, and nothing about container, codecs, streams, track languages, resolution, bit depth or DURATION. Consequences, all of them already-committed features that cannot work without it: (a) "when a file will not play, say so plainly" cannot name a reason; (b) embedded subtitle and audio tracks — the common case in real libraries — have nowhere to be recorded, so the language-selection surface is unimplementable; (c) the completion rule is defined as "TIME REMAINING under a small absolute figure" with percentage only "where duration is unknown", yet duration is a measurable property of a file physically present on disk and there is no column for it; (d) chapters, an existing `files` role, has no source. Analysis-on-scan with MediaInfo (BSD-2-Clause, and already in Plex's own dependency list) is the established answer. This is the largest structural omission found.

**G2. No client capability profile, so direct-play-only cannot be checked before playing.**
*(articles 63, 67, 72, 85, 98, 103, 30)*
The prompt states direct-play-only and states that "client codec coverage load-bearing" is why the TV player must be native Swift — then models nothing. Plex publishes a per-client profile that is a CONJUNCTION over container, video codec, codec LEVEL, framerate, bit depth, audio codec, channels, resolution and subtitle format, varying per client, per hardware generation within a client, and per container within a device (the same codec permitted in MKV and refused in MP4 on one console). Two facts make this urgent rather than deferrable: on PlayStation **any subtitle at all disqualifies direct play**, and on the "Plex for Smart TVs" tier the ceiling is 4Mbps/1080p/H.264/AAC-stereo. With no transcoder there is no fallback — a mismatch is a hard failure — so the profile must exist on both sides of the wire and be compared before the play button is offered. CanonCore's separate-file-row model for subtitles is the right shape to let clients render sidecars themselves, but only if the API serves them separately and the client is written for it; neither is stated.

**G3. Nothing states what happens when a file, or a whole storage root, disappears.**
*(articles 6, 32, 52)*
The scanner is periodic and reconciling, storage is a filesystem path, and rclone/mergerfs mounts are the documented cloud story — the exact configuration where an unmounted or empty root looks identical to "everything was deleted". Plex ships two defences and CanonCore has neither: it refuses to act on an inaccessible content location ("a content directory that is completely empty will appear to the filesystem the same as a directory that is inaccessible"), and it soft-deletes rather than removing. Alongside this, there is no UNAVAILABLE state: nothing says what an item page shows when its file is missing, or that the owner is ever shown the expected path. CanonCore's content hash makes relinking a moved file strictly better than Plex — but only if the row survives long enough to be relinked. Minimum: a reachable/unreachable flag plus last-seen on `files`, a scanner refusal on an unreadable or suspiciously-empty root, and the path shown on the item page.

**G4. No scheduler, no maintenance window, no automatic backup, no restore path.**
*(articles 16, 44, 11, 48, 40, 56, 50, 61)*
The prompt names background work in at least five places — periodic scans, background enrichment against thresholds, wholesale projection rebuild, six-month TMDB cache expiry, palette extraction on artwork fetch — with no scheduler, no job registry, no retention policy, no visibility and no way to force or cancel a run. Plex's answer is a named job list, individually toggleable, confined to an owner-chosen window in server local time, with a rotating database backup every three days keeping three copies, and a separately documented restore. CanonCore needs this more, not less: its value is hand-curated placements and owner statements that exist nowhere else and **cannot be re-derived from the files**, which makes backup more load-bearing here than in any file-derived catalogue. A backup with no documented restore is not a backup. Bundled with this: nothing states where instance state lives on disk, which is one answer that would serve backup, restore, uninstall, the Docker volume and the disk-footprint question at once.

**G5. Authentication has exactly one sentence and three clients.**
*(articles 82, 23, 65, 33, 53, 95, 38, 93, 99)*
"Single user, one password" plus an unauthenticated public read path, and nothing in between — while the prompt commits to a phone app and a native tvOS app. Missing, each independently: a long-lived per-device credential that is individually revocable; a way to authorise a device with no usable keyboard (the device-code flow, RFC 8628, is what Plex's 4-character link code is); any device registry, so no "which devices can reach my server", no revocation, no "which device am I continuing on"; something for scripts and the OpenAPI surface the scaffold yields for free; and **a lockout recovery path**. That last one is not optional: one password, no email, no vendor, Docker deployment — a forgotten password is permanent loss of a catalogue that cannot be re-derived. Plex documents a local, physical-access reset and attaches the guarantee that matters: "Correctly following these instructions will not wipe out a server installation or make you have to re-create libraries." Note also that Plex's token-in-a-query-parameter is the anti-pattern to avoid.

**G6. Inbound transport and the connection model are unspecified.**
*(articles 85, 101, 15, 49, 78)*
How does a client find the server on the LAN? How does it reach it from outside? What happens when TLS cannot be established? None are answered, and the TV app is where this bites hardest: TV platforms routinely cannot validate a certificate for a private server, so Plex ships an explicit "Allow Insecure Connections" client setting paired with a server-side "Preferred" rather than "Required" — and solves the general case with a wildcard-certificate service that CanonCore, by design, will not have. A native tvOS client faces App Transport Security, which is stricter than any of those TVs. Two related decisions belong here: whether a "networks allowed without auth" LAN bypass exists (every product in this category has one, it is how these servers get exposed, and an implementer will add it unless told not to), and a binding rule that any future protocol surface goes through the same access control as the opaque-id playback route — Plex's DLNA server is the cautionary case, since it "does not use a specific user account and so it would have full access to all of your media".

**G7. No bulk operations.**
*(article 108)*
Nothing in the prompt acts on more than one row: not setting a statement across many items, not placing many items into a container, not retiring or merging a vocabulary value across the rows using it, not re-running enrichment over a selection. The prompt's own sizing data makes this untenable — 11,285 stories, 715 properties, a medium vocabulary with "71 distinct values of which about 50 are one-use wreckage", and a quarantine state whose entire purpose is to collect rows that must later be fixed **in bulk**. Multi-select with shift-range and a bulk edit is the established shape. Related and cheap: autocomplete on value entry, which stops the owner hand-creating the next near-duplicate that quarantine exists to catch.

**G8. No trash, no undo, and no "did not mean to watch that".**
*(articles 52, 92)*
CanonCore's delete design is stronger than Plex's in every respect except reversibility: three previewed outcomes with counts, offered-only-when-multi-placed, pre-deleted parent edges, a non-dismissible confirmation — and then it is gone. Tombstones exist on every table but nothing says a tombstone is user-visible or restorable. Plex's Trash is restorable simply by putting the content back. Two adjacent points: it should be stated outright that CanonCore never deletes a media FILE (the scanner rule covers the scanner, not a future delete button, and file deletion is the one destructive capability every comparable product ships); and Continue Watching has no escape hatch, since it is computed with "no time window, no dismissal" — force-complete under five minutes handles trailers, nothing handles a three-hour film abandoned at forty minutes. Whether the owner may write a watch event by hand is unstated and is probably the answer.

### MEDIUM

**G9. Diagnostics and issue reporting.** *(1, 18, 21, 22, 24, 39, 74, 32)* No logging, no log level, no log export, no version display, no scan report. Plex treats per-client log retrieval as a documentation obligation across fourteen platforms, uses time-boxed self-closing debug endpoints, offers one-button export rather than a filesystem path, and warns against its own verbose level. For CanonCore the version display is diagnostically load-bearing because of the forward-only migration ladder ("which version, which migration"). Related: a scan that finds nothing must say WHY — skipped paths, permission failures, unreadable roots.

**G10. Telemetry, update checks, and remote configuration — the missing negative claim.** *(9, 37, 64, 87)* The prompt is silent in both directions, so nothing forbids an implementer wiring up Sentry, an update ping, or a feature-flag fetch. Plex does all three, including vendor-controlled feature flags in software running on someone else's hardware. One line — an instance calls out only to the providers its owner configured — closes all of it and is the cheapest trust guarantee available, exactly the kind of plain negative claim self-hosted users check.

**G11. Provider response caching and per-provider configuration.** *(61, 54, 74, 55)* The only caching statement is TMDB's six-month limit, which is a licence maximum rather than a design: no cache location, no key, no TTL, no eviction (eviction is a scheduled job, and there is no scheduler — G4), no way to bust one. The two required providers have deliberately opposite properties (local/unlimited versus remote/rate-limited/capped), which is precisely the case a per-provider cache with a per-provider TTL exists for, and stop-condition 4 asserts "same failure modes" across both — a cache is a failure mode. Also unanswered: whether a provider carries owner-settable preferences, and what happens to already-applied statements when a provider is disconnected. Both answers are defensible; neither is chosen.

**G12. Safe External Fetch has no failure taxonomy.** *(74, 55)* SSFB is correctly specified as a set of refusals but says nothing about what the owner SEES. A blocked address, a TLS chain broken by a corporate MITM proxy, a clock skewed far enough to invalidate certificates, a timeout, and a size-cap trip all present as "the provider does not work". Clock skew appears twice in this shard as a named cause and additionally corrupts `observed_at` ordering and the six-month cache expiry, so a clock health check earns its place.

**G13. Artwork: fetched, cached, resized, or hot-linked?** *(81, 50, 3)* The artwork table holds a provider URL and a palette, and the palette must be extracted "when the artwork is fetched" — so the bytes are already downloaded once. Nothing says whether they are kept. Hot-linking leaks every viewer's IP and browsing to TMDB and breaks the public demo on rate limits; caching reproduces Plex's problem where artwork dominates the data directory. Plex keeps a separate on-demand resize cache because a TV poster grid and a phone list want different bytes. Cheapest coherent answer: fetch once, derive palette, cache a couple of sizes, serve from the app — but it must be chosen.

**G14. No About / Credits surface, though the prompt's own licences require one.** *(86)* Three obligations are already accepted: TMDB's attribution string "shown prominently" plus attribution "in an About or Credits section", per-artwork licence and attribution strings, and CC BY-SA on anything published from the archive. None has a home. A third-party dependency manifest belongs on the same screen.

**G15. Playback queue, post-play and auto-advance.** *(43, 51, 109, 110)* No next-item concept at all: pressing play inside an ordered container has no stated behaviour. This is harder for CanonCore than for Plex, because an item sits in many orderings and "the container you arrived through is navigation state carried alongside the address, never encoded in it" — so what determines the next item is exactly the state the prompt refuses to put in the URL. Rules worth taking rather than rediscovering: auto-advance suppressed after two hours without user interaction ("passout protection", shipped as both behaviour and setting); post-play only above five minutes and never for trailers — the same five-minute constant CanonCore independently chose for force-complete, which is evidence it is a real constant; asymmetric skip (back 10, forward 30); and countdown defaults of 10s mobile, 15s TV.

**G16. Casting, and the device concept it needs.** *(27, 33, 34, 53)* A three-party session — controller, receiver, server — breaks the assumption behind "playback goes through an app-owned opaque-id route", because the id must be handed to a device that never authenticated as the owner, and progress arrives from a party that did not request playback. Whether that id is bearer-capable and time-boxed is cheap to decide now and expensive later. Ties directly to the device registry in G5.

**G17. Merge candidates have no discovery surface.** *(46)* Merge exists as an operation with a permanent alias, and enrichment produces merge evidence by design ("agreeing identifiers between providers are evidence they describe the same work") — but nothing consumes it and there is no queue. If one is built it needs the rejection memory the prompt already demands of the match queue, or it refills with the same questions forever.

**G18. Spoiler control.** *(109)* Plex ships a toggle to hide unwatched episode thumbnails and summaries. CanonCore's core feature makes this structurally harder and more valuable: a story-order or chronological container is a spoiler surface by construction, "Also appears in" reveals which orderings a thing belongs to, and the two-figure container rollup reveals how much of a work exists. The prompt has not noticed the problem exists.

**G19. Scanner exclusion, force-rescan, and the copy race.** *(2, 12, 25)* No statement of what the scanner skips; a declarative per-folder ignore file is the established answer and costs almost nothing (Plex's hardcoded keyword half is the filename antipattern and should not be copied). Separately: mtime-based incremental scanning silently misses a file still being copied when the scan ran, and there is no distinction between incremental and full, nor any way to force one. "Scan found nothing because mtime did not change" needs a button, not a filename trick.

**G20. Password reset and account-level playback preferences.** *(38, 93, 102)* Rolled into G5 for recovery; the separate half is that there is no settings surface at all for owner preferences, and the first ones needed are preferred audio and subtitle language. That selection ladder is CanonCore's own favourite/source-order pattern in a third costume — a declared order decides until the owner pins one, and the pin is permanent ("Once you manually select something, it will never automatically change again") — and the prompt already says that pattern is deliberately reused. "Shown with Foreign Audio" is the non-obvious mode nobody invents from scratch and everyone wants.

**G21. Offline, and what the product does when it cannot reach the outside.** *(29, 80)* A phone app off the LAN, or a server whose providers are unreachable, has no stated behaviour. The prompt's append-only watch events with a 10-second save cadence are unusually well shaped for offline replay — but only if someone decides that events may be recorded client-side and replayed out of order.

**G22. Personal rating.** *(47)* No rating of any kind. It fits the statements model exactly (a `rating` statement sourced to the Owner), it is one seed property plus a control, and every comparable product has it. Its absence from the seed dozen reads as oversight rather than decision.

**G23. Sizing and hardware guidance.** *(31, 50)* Nothing states what a CanonCore instance needs. The stress-test dataset is a 1.8GB database with 4.5M page links, and the prompt itself warns that "Production EAV ALWAYS grows a denormalised read side". "No transcoding" is a genuine selling point that only lands once the floor is stated — Plex's own no-transcode row is Atom-class.

**G24. Household profiles, when multi-user eventually arrives.** *(70, 77, 89, 90, 91, 92)* Recorded, not proposed. The deferral is sound; the note is that the first real need is PROFILES, not accounts — no credential, no email, no independent session, created and destroyed by the owner, existing only to separate progress. That is a much smaller migration than `owner_id`-everywhere anticipates. Two constraints for that day: a grant must enumerate groups rather than mean "all groups", or it silently widens as content is added; and Plex's inability to hide content in folder view ("folder names cannot be hidden") is independent evidence for CanonCore's design — a hierarchy-derived browsing surface cannot honour a per-item visibility rule, and any future "browse by path" feature would reintroduce exactly that hole.

**G25. Trust model for the CMPP store.** *(104)* "ACCEPTED rather than open. Curated" implies a trust decision with no stated mechanism — no signing, no manifest, no pinned digest, no vetting criteria. Since a provider is a URL rather than a package, the answer is probably TLS plus a documented acceptance process rather than package signing, but "curated" is not yet a policy.

**G26. Client settings, and watched indicators in particular.** *(94, 109)* No client settings are named anywhere. Two entries are non-obvious enough to record: watched indicators should be optional (progress markers are spoiler-adjacent, and CanonCore renders a two-figure rollup by default), and "spring loading" — content loading once focus settles — is a concrete example of what the native tvOS focus engine buys, which is the argument the prompt already makes for native Swift.

