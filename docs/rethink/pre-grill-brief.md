# Pre-grill brief: rethinking CanonCore (2026-09-28)

Sources: 8 readers.
- Four covered the ADRs, all 193 of them (0001-0206), each read whole.
- One covered the rest of docs/, CONTEXT.md, the rules and the install.
- One covered the media-server research (about 4 MB, Plex and Jellyfin).
- One covered all 469 Linear tickets.
- One did fresh web research, verified at each claim's owner on 2026-09-28.

## The Owner's new direction
- Their own Plex or Jellyfin, with data from several providers passed into a STRICT CanonCore schema.
- As easy and user-friendly as possible. Not the Tardis wiki.
- Self-hosted on the Mac, with iOS and Apple TV from the start, and playback as soon as possible.
- A prototype first to choose providers, then build up properly rather than converting.
- A full roadmap of projects now.
- Keep Linear and GitHub, and archive the old issues.
- What is bad: what the product is, and how it looks and works. The code and the process are not the complaint.

## What carries forward (KEEP): the data core is sound
- Item vs file (0002, 0003). Containers are Items (0004). Multi-placement: one Item in many orderings, with repeats (0009, 0018, 0061, 0128).
- Statements with provenance, source rank and pins that survive a refresh (0012-0017, 0024, 0025). This is the "strict schema": "a provider never adds a Property".
- Identity is (source, external id), never a name (0078). Match and apply are separate; two thresholds and a review queue; precision and recall over a labelled set that includes "no match" rows (0026-0028). Merges are recorded and can be undone (0040).
- Editions, parts and variants; files many-to-many; a content hash for identity (0011, 0021-0023, 0064, 0083).
- The playback half, designed and never built: watch events, progress per edition, sessions per device with capabilities, completion that stays unknown when unknown (0019, 0020, 0043, 0085, 0088). It is ready to build.
- Engineering discipline:
  - a test must fail when the behaviour is deleted (0168);
  - CI counts only for the commit it ran on (0181);
  - forward-only migrations (0047);
  - backup and restore (0048);
  - a task registry (0049);
  - trigram search (0120);
  - sort names (0134).
- The gate that caught real failures: a project is not done until it is used on the Owner's own instance (0132).

## What the new vision overturns
- **Order:** 0055 (web, then phone, then TV), 0115 (public release before playback) and 0152 (data, then redesign, then playback). These put playback last on purpose; it never got one ticket in 469.
- **Provider:** 0069 and 0129 (the wiki first, the archive deleted), 0205 and the wiki-specific parts of 0033. The measured case against the wiki: a Cloudflare challenge, a session that lapses daily, silent empty refusals and images behind the challenge.
- **Playback:** 0041 (direct play only, no ffmpeg) assumed a browser was the first player.
- **Hosting:** 0109 (a rented box). The Mac is now the host.
- **Ease:** 0121 (naming a provider and allowlisting it as two separate steps, which tripped the Owner up in walk 1).
- **Scale:** 0137 (designed against 8,052 wiki Items).
- **Obsolete:** about 20 records are Next.js mechanics or machinery policing the ADR corpus itself. They are not regrown.

## Facts that shape the choices (verified 2026-09-28)
- **What AVPlayer plays:** H.264, HEVC (fMP4, tagged `hvc1`), AAC, AC-3/E-AC-3/Atmos and FLAC.
  - **No MKV, DTS, TrueHD, SRT or PGS.** Real libraries are full of these, so direct play covers only part of a library.
  - The playback ladder is direct play (with byte-range requests), then remux (`ffmpeg -c copy` to HLS fMP4), then an audio-only transcode, then a video transcode through VideoToolbox. This Mac's FFmpeg 8.1.2 has VideoToolbox.
- **Clients:**
  - Only SwiftUI and React Native have working tvOS support. Flutter has no official tvOS. tvOS has no WebKit.
  - One SwiftUI multiplatform target covers iPhone, iPad, Mac and TV.
  - Swiftfin (the Jellyfin client) uses VLC or AVPlayer. Infuse decodes DTS and TrueHD itself.
  - Existing clients such as Infuse and Swiftfin already speak the Jellyfin API. Comparable projects: 7 of 10 never shipped their own mobile app; Navidrome had a third-party client on day 6.
- **Apple TV needs:**
  - device-code pairing;
  - a device row as the session;
  - Bonjour discovery (tvOS is NOT subject to local-network privacy);
  - HTTPS that Apple's rules accept: Tailscale certificates are free, and the Tailscale tvOS app needs tvOS 17+;
  - a cookie covering the API and the video (0108);
  - TestFlight at $99/yr, or builds that expire every 7 days.
- **Mac server:**
  - Jellyfin in Docker on macOS is "NOT supported", because scanning and hardware transcoding break.
  - Jellyfin and Plex ship as menu-bar apps.
  - A sleeping Mac misses scheduled jobs, and an unmounted drive looks like a mass delete, so a missing file must read as Offline, never as deleted.
- **Providers:**

  | Provider | What it offers | Cost and terms |
  |---|---|---|
  | TMDB | film and TV, with episode groups for aired, DVD, absolute and story-arc orders | free for non-commercial use, about 40 req/s, 6-month cache ceiling, logo required |
  | Wikidata | CC0; the crosswalk of every service's ids; follows, followed by and series ordinal, which give orderings across works | free |
  | fanart.tv | the only source of clear logos and art | terms unread |
  | TheTVDB | extra orderings | a $11.99/yr PIN per user |
  | MusicBrainz, Open Library, IGDB, AniList | music, books, games, anime | defer until those domains matter |

  Nobody has compared provider quality, so the prototype has to create that evidence.
- **Schema precedents:**
  - Plex's Custom Metadata Providers (Dec 2025) are "a single URL" with a strict JSON contract, for film and TV only.
  - beets and Stash map every source into one canonical type, with ids as (source, id) pairs.
  - **No incumbent models more than one ordering per item.** Multi-placement stays CanonCore's own.

## Lessons from 469 tickets and 25 days
- About 90 tickets went on the shared agent substrate (flakes, false greens, leaked databases), 48 on agent tooling, and about 87 on correcting records and figures in prose. 28 bounded strings one field at a time.
- Several projects closed green while their headline sentence was false. Use on the Owner's install caught it.
- Scope grew against "cut scope" (the data effort: 72 tickets and five mechanisms before any playback). The previous attempts died two to four weeks in, from over-scoping.
- Carry over two small ideas: accent-normalised matching (469), and a skipped suite saying it measured nothing (370).
- Archive: everything, after saving CNCORE-344's measured evidence, the wiki-failure tickets and the spikes as repo docs, and closing PR #361.

## Open questions for the grill (frontier first)
1. Is multi-placement still the distinguishing core, alongside a Plex-style show, season and episode shape?
2. Client strategy: own SwiftUI app, speak the Jellyfin API so Infuse and Swiftfin work on day one, or both in sequence?
3. Playback v1 floor: LAN direct play only? When do remux and transcode come in?
4. Server stack: keep TypeScript, Node and Postgres, running natively on the Mac (not Docker)? Is the web UI admin-only, or gone?
5. Providers: in-process adapters or separate HTTP services? The prototype's providers and how they are scored?
6. Users: one owner, or household profiles on the Apple TV?
7. Process: how light? Which of the ADR, test and tooling apparatus is kept?
8. Roadmap: the projects and their order. Archiving Linear, and superseding the overturned ADRs.

## Round 2 research (2026-09-28), weighed against the Owner's criteria
The criteria, in order:
1. The best user access on Mac, iPhone and Apple TV.
2. Most impressive to a software developer in September 2026.
3. Playback soon.

### Clients
- **Recommendation:** one SwiftUI multiplatform app for Apple TV, iPhone and Mac.
  - It has the best tvOS feel: the focus engine and Top Shelf.
  - XCUITest with XCUIRemote is the only headless tvOS test path. Maestro has no tvOS support (issue #1515 is open).
  - The API contract: the TS server emits OpenAPI, swift-openapi-generator 1.13.1 generates the Swift client, and CI checks it.
- **Rejected:** React Native everywhere. Its tvOS feel is weaker and its testing is weaker.
- **Hiring signal** (ITJobsWatch UK, six months):
  - React Native: 223 ads (up from 138), median £80k.
  - Swift: 73 ads, £75k.
  - SwiftUI: 40 ads, £60k.
  - Flutter: 25 ads and falling.
  - Shopify moved from React Native to native on 2026-09-10: "coding models… building the same feature in Swift and Kotlin no longer carries the cost".
  - Plex rebuilt its Apple TV app in React Native.
  - A native tvOS app is rare in portfolios.
- **Tooling on this Mac:** Xcode 27, Swift 6.4. The tvOS 27 simulator was installed 2026-09-28; the iOS 27 simulator is being installed.
- **Distribution:** the Apple Developer Program is US$99/yr. Without it there is no TestFlight and builds expire every 7 days. **This spends money, so it is the Owner's decision.**
- **CI:** free for a public repo, macOS runners included.

### Jellyfin-compatible API
- Swiftfin needs about 20 to 25 of 346 operations, plus about 15 stubs.
- Infuse direct-streams original files, syncs progress, and does not follow image redirects.
- It has been done before:
  - Oblecto (TypeScript, AGPL, active);
  - aiofin (TypeScript, tested with Infuse);
  - Silo-Server (Go, about 200 files, which shows what full depth costs).
- **Legal:** write your own handlers, and call it "Jellyfin-compatible", never "Jellyfin".
- **Orderings map to** Playlist plus a BoxSet twin, and Series for TV orders.
- **The adapter is lossy by design:** no provenance, and orderings are not first class. The native client is the showcase.
- **The researchers split:**
  - The Jellyfin researcher says build a direct-play-only adapter first, for fast Apple TV playback through Infuse.
  - The client researcher says do not, because it is a stopgap, against the principle of never taking a stopgap meant to be replaced.
  - **This is a grill decision.**

### Server
- **No Docker in the Owner's install.** Jellyfin says Docker on macOS is "NOT supported": it has no VideoToolbox, and file events do not reach bind mounts outside $HOME (OrbStack #2714).
- **Package** as a SwiftUI menu-bar app wrapping a bundled Node 24, with an SMAppService LaunchAgent and Sparkle. Signing needs the paid program.
- **Database:** SQLite, as Jellyfin, Plex, Navidrome and Audiobookshelf use.
  - node:sqlite is a release candidate; better-sqlite3 is 13.0.3.
  - FTS5 trigram search and triggers were tested on this Mac.
  - **Cost:** rewriting every migration (35 triggers, 20 plpgsql functions, deferrable constraints, pg_trgm). It removes the agent connection ceiling.
- **LAN:** `NSAllowsLocalNetworking = YES` allows plain HTTP to `.local` addresses and IPs, so no HTTPS is needed at home. It is unverified whether that key applies on tvOS: test on a device.
- **Remote:** Tailscale (free, `tailscale serve` handles the certificates, the tvOS app needs tvOS 17+). Avoid Cloudflare Tunnel, whose terms restrict video.
- **Sleep:** hold an IOPMAssertion only while streaming or scanning. An unreachable root is **Offline, never deleted**.
- **First run:**
  1. Install the DMG and drag it to Applications.
  2. A browser wizard picks folders.
  3. The TV finds the server over Bonjour.
  4. The TV shows a code, and the Owner approves it on the Mac. This is Plex's pairing without the cloud account.

### Playback pipeline (run on this Mac)
- ffmpeg 8.1.2 with VideoToolbox, plus DTS, TrueHD and PGS decoders. ffprobe takes about 27 ms.
- **Remuxing MKV to HLS fMP4 worked,** tagged `hvc1` with WebVTT subtitles.
  - Segments follow the source's keyframes (8 s and 4 s), so build the playlist from the real keyframes, as Jellyfin does.
- `decide()` (direct play, remux or transcode, with reasons) is about 40 lines of pure TS.
- fluent-ffmpeg is archived: spawn ffmpeg directly.
- **Parsers and scanning:**
  - `@ctrl/video-filename-parser` 5.11.4 (MIT) for filenames.
  - oshash for content identity.
  - chokidar 5 for watching, used only as a hint; a rescan is the truth.
- **Smallest slice:** folder, scan, probe, match (honouring `{tmdb-}` / `[tmdbid-]` hints), `decide()`, then a Range-served direct play or an on-the-fly remux, plus WebVTT subtitles.
- **Defers:** the file watcher, video transcode, PGS burn-in, Dolby Vision and TV shows.
- **Reference project:** Kyoo (its transcoder is in Go).

### Providers and orderings (measured live)
- **Wikidata:**
  - Release order and numbered series are strong (MCU 41 of 49, Bond 25 of 25, most of Star Trek, Doctor Who 1,062 of 1,479).
  - Multi-placement already shows in the data (Fellowship is in 2 series).
  - Almost no in-universe or watch orders.
  - Film TMDB ids are strong; episodes need IMDb ids.
- **TMDB episode groups:**
  - Real alternative orders within one show: Doctor Who 2005 has 6, The Clone Wars has the official chronology, One Piece has 19.
  - No group spans shows or films.
- **Missing:** cross-media watch orders such as the MCU timeline, and character appearances.
- **Recommended starter set:**
  - TMDB (items, ids, images);
  - Wikidata (series order, crosswalk);
  - Trakt ranked lists (cross-media watch orders, 1,000 GET per 5 min);
  - the Owner's own orderings as a first-class source.
- **Showcase data:** Doctor Who and The Clone Wars.
- **Drop from the starter set:**
  - fanart.tv: it has no image licence.
  - TVDB: its PIN or attribution adds friction, and it adds no orderings beyond TMDB's groups.
- **TMDB key:** incumbents ship their own key with an optional user override. None visibly enforces the 6-month cache ceiling.
