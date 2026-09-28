Raw log of the 2026-09-28 grill, in the order decided. The consolidated record is grill-decisions.md.

# Grill decisions: the rethink (2026-09-28)

The Owner answered these in the dispatch session. Each becomes an ADR (or supersedes one) when the grill ends.

1. **The core:** a great library first, with orderings (multi-placement) as the standout. It works like Plex by default: films, shows, seasons, episodes, playing. The distinctive feature is choosing a watch order and playing through it: an official story order, a chronology, the Owner's own. The alternative, making orderings the whole point, was rejected.
2. **Clients:** one SwiftUI multiplatform app for Apple TV, iPhone and Mac, with no Jellyfin-compatible adapter. It plays through AVPlayer, and the server remuxes to HLS and converts audio (DTS and TrueHD are not in Apple's HLS spec). A file that needs a video transcode or subtitle burn-in (VC-1, MPEG-2, VP9, 10-bit H.264, interlaced, PGS/VobSub) is flagged (audit 2026-09-28; the in-app fallback is re-decided below).
3. **The server runs on the Owner's Whatbox slot** (yuzu.whatbox.ca), not on the Mac. The Mac is a client.
   - Inspected read-only 2026-09-28:
     - Node 24.14, pnpm 11, ffmpeg and ffprobe 8.1.2, SQLite 3.53, Postgres server binaries, and rootless Podman 6.1.
     - Whatbox's nginx serves a wildcard certificate for `*.finestarling.box.ca`.
     - Cron works; slskd uses a `*/5` watchdog. There is no systemd and no usable GPU.
     - The host is a shared 64-core EPYC at load about 140. The home directory is empty apart from `~/apps/slskd`.
   - Whatbox's rules, read at source on 2026-09-28:
     - "Can I run my own apps? Yes." The AUP bans "IPTV hosting ... VOD hosting, VOD sharing, public media streaming, public video libraries". "VOD hosting" and "VOD sharing" have NO "public" qualifier, and no Whatbox text says a private invited library is allowed (audit 2026-09-28; AT RISK, see decision 10).
     - HTTPS comes through a managed link, `<name>.finestarling.box.ca`, with the wildcard certificate, no body cap (100G) and a `proxy_read_timeout` of 10m between reads (measured in ADR-0109).
     - The upload allowance is per plan (10 to 40 TB on HDD, 50 TB+ on NVMe; the Owner's plan is unchecked), then "100 Mbps unmetered". CanonCore's streams COUNT against the upload allowance. Only FTP, SSH/SFTP, HTTPS from the pre-provided directories, OpenVPN, Plex and Jellyfin are exempt (whatbox.ca/faq, verified 2026-09-28). The "log into it" line in /policies/traffic refers to the same named list. Past 10 TB, upload drops to 100 Mbit/s for the rest of the cycle, with no fee. Downloads to the server are never counted. Plex and Jellyfin are exempt; the 5 Mbit/s figure in older notes was Pulsed Media's, not Whatbox's.
     - The FAQ says "You may not transcode 4K HEVC video streams", and there is a "burdening the server" clause.
     - Containers "may stop working at any time" (from /wiki/Bookshelf, not the FAQ or AUP). The wildcard certificate, the 10m timeout and "no body cap" are measurements, not published rules.
4. **Web:** a full web client from the start, including playback (hls.js outside Safari). HEVC plays in Safari, Chrome and Edge with hardware decode; in other browsers (Firefox) an HEVC file is flagged, because there is no transcode.
5. **Every client does everything** (Owner: "all need all"). Web, Apple TV, iPhone and Mac each browse, play and curate. One API serves all of them, and its contract is typed and checked in CI (OpenAPI to a generated Swift client, and TypeScript types for the web). Curation on Apple TV needs a design made for a remote.
6. **Apple Developer Program:** the Owner is ALREADY a member. TestFlight (each build lasts 90 days; invited people are external testers, which needs Beta App Review), signing and notarisation are available now, at no new spend.

7. **The server shape on Whatbox (the OWNER'S DEPLOYMENT; see the host-agnostic principle below for the product):** a plain Node 24 process with a SQLite file.
   - A cron watchdog (`@reboot` plus `*/5`, like slskd) keeps it running.
   - It is exposed as a Whatbox managed link over HTTPS, and CanonCore requires its OWN login on every route.
   - Playback is direct play, remux, or audio-only conversion. There is NO video transcoding (Whatbox bans 4K HEVC transcoding, and a shared CPU risks the "burdening" clause). A file that would need it is flagged, with the reason shown.
   - No containers ("may stop working"), and no Postgres process to babysit.
   - The dispatcher chose this under the ethos below, which the Owner delegated.

## PRINCIPLE: the product is EVERYTHING-agnostic (the Owner, 2026-09-28)
"CanonCore is not just host-agnostic but everything-agnostic, e.g. I love Doctor Who but many others won't."
- **Franchise-agnostic:** nothing in the core schema, the UI or the defaults names Doctor Who. Franchise pages, "As broadcast" / "As a timeline" and "Also in" work for any franchise: the MCU, Star Wars, Star Trek, the Arrowverse, a book series. Doctor Who is the hardest TEST CASE, never the target. Its providers (Tardis Fandom, TARDIS Guide, Big Finish) are the Owner's own installs, working through the same Store mechanism as anyone's.
- **Host-agnostic:**
"We can't just focus on my use case." CanonCore is for anyone who self-hosts, on a NAS with a GPU, a Mac mini, a Linux box in Docker, a VPS or a seedbox. **Whatbox is ONE deployment, the Owner's, and he may move** (a cheaper or better host is being researched).
- A host's limits become the product's SETTINGS or CAPABILITY CHECKS, never its rules.
- Decisions 3 and 7 describe the OWNER'S DEPLOYMENT. Their product-level meaning:
  - the server runs as a single process with SQLite;
  - it installs as a Docker image or a plain binary;
  - it runs under whatever supervisor the host has (systemd, launchd, Docker restart, or cron on a seedbox);
  - transcoding is a capability the install turns on when its host allows it. It is off on Whatbox.

## ETHOS (the Owner, 2026-09-28): governs every decision in the rebuild
"Whatever the most impressive but best option it is for the users - this should be the ethos of the entire rebuild."
- The best option for the people using it comes first. Within that, choose what is most impressive to a software developer in September 2026.
- Every question is still put to the Owner (their correction). The ethos picks the (Recommended) option. Decision 7 was proposed under the ethos and confirmed by the Owner ("yes").

## Criteria (Owner), in order
1. The best user access on Mac, iPhone and Apple TV (and now the web).
2. Most impressive to a software developer in September 2026.
3. Playback soon.
8. **Users:** ~~household profiles on one account~~ SUPERSEDED by decision 13 below. (Originally: household profiles from the start.)
   - One Owner account plus profiles (like Plex Home or Netflix). Each profile has its own watched state, progress, Continue Watching and orderings, keyed per profile from migration 1.
   - Each device signs in once with a device code shown on screen and approved from another device: a device-code flow like plex.tv/link and Jellyfin Quick Connect, built to RFC 8628.
   - This supersedes ADR-0044's one owner with one password.
9. **All current code is archived and not reused** (the Owner, 2026-09-28): "We will drop all current CanonCore and provider repo code, or archive and not use it."
   - This covers the CanonCore app, provider-wiki and provider-tmdb.
   - The rebuild starts fresh inside the same GitHub repo and Linear workspace, which the Owner keeps.
   - The ADRs, research and CONTEXT.md stay as EVIDENCE and lessons, not as binding rules.
   - **How the old material is used** (the Owner): "We can learn from old CanonCore code and issues and tickets and docs, but only when you think so, and prefer new stuff."
     - The old code, Linear issues, ADRs and docs are a reference, consulted when judged useful for a specific decision.
     - New work is preferred by default. Nothing old is reused or ported unless there is a stated reason.
   - HOW to archive (a tagged branch, an archive folder, or git history only) is open.
10. **Who connects** (the Owner, 2026-09-28): "wants to be from Whatbox, and any person's Mac, iOS, Apple TV can connect".
    - The server runs on Whatbox. ANY invited person can connect from their OWN Mac, iPhone or Apple TV, not only the Owner's devices.
    - **This reopens decision 8** (household profiles on one account). Other people on their own devices point to invited accounts, each with its own login, watched state and orderings, like sharing a Plex library. To be put back to the Owner.
    - AT RISK (audit 2026-09-28): "Whatbox allows private, invited sharing" is unfounded. The AUP also forbids "VOD hosting, VOD sharing" without "public". Written approval from Whatbox support is needed. Its AUP forbids a PUBLIC library and "20 or more concurrent Plex streams".
11. **The library model** (the Owner: "okay yeah i love", after the real-data prototype `prototypes/library-model/`).
    - ONE combined library, not provider modes. Each story is one thing holding facts from every source, each labelled with its source (provenance shown).
    - A franchise page (Doctor Who) offers two ways to watch:
      - **As broadcast:** EVERY TMDB show together (Doctor Who 1963–89 grouped into serials, 2005–22 with specials, 2023–), season by season.
      - **As a timeline:** you PICK a timeline (a Doctor or companion, from Tardis Fandom), then walk it era by era. Non-TV entries (audio, novels, comics) sit between episodes, greyed out when not in the library, with an "Only what I can play" filter.
    - Every story shows "Also in": each ordering it sits in, with its position (e.g. The Beast Below: Series 5 E2, #4 of 603 in the Eleventh Doctor's timeline, #7 of 311 in Amy's), each linking into that ordering.
    - Provider modes (variant A) and timeline-first (variant C) were rejected.
    - Measured in the prototype: 8 real timelines matched to TMDB at 70-100% of their TV entries (lowest: the Fifteenth Doctor, 16 of 23; recomputed by the audit, 2026-09-28) (First Doctor 37 of 40 using TMDB's "Story Order" group; River Song 20 of 20). The misses are mostly stories outside the three TMDB shows fetched (Sarah Jane Adventures crossovers, mini-episodes).
12. **Media: everything playable** (the Owner, 2026-09-28).
    - Video (TV, films), audio (Big Finish, audiobooks), novels (an EPUB reader) and comics (a CBZ/CBR reader): Plex, Audiobookshelf and Komga in one.
    - Every timeline entry can open when the file is in the library. "Only what I can play" still hides the rest.
    - The roadmap phases it. Video comes first ("playback soon"), then audio, then the readers. The order is to be confirmed in the roadmap step.
13. **Users: invited accounts, each with profiles** (the Owner, 2026-09-28). This supersedes 8.
    - The Owner invites people, like sharing a Plex library. Each person has their own login on their own devices, and each account can hold profiles (a household sharing one Apple TV).
    - Watched state, progress and personal orderings belong to each person or profile, keyed that way from migration 1.
    - The Owner keeps settings and curation.
    - Each device pairs by a code shown on screen and approved from a signed-in device: a device-code flow like plex.tv/link and Jellyfin Quick Connect (neither of which is RFC 8628), built to RFC 8628.
    - Within Whatbox's AUP: AT RISK, as decision 10 says. The AUP bans "VOD hosting, VOD sharing" unqualified, and nothing allows a private invited library in writing yet.
14. **Providers: a STANDARD set per medium (every departure from the competitors' default is recorded with its reason; audit 2026-09-28), with franchise sources on top** (the Owner, 2026-09-28).
    - "Don't think about Doctor Who specific ones. We need a standard list that the others all do, with Doctor Who ones on top."
    - The standard layer covers every medium: film/TV, music/audio, books/audiobooks, comics, identity (a crosswalk) and local files.
    - The franchise layer is Tardis Fandom (timelines) and TARDIS Guide (curated orders; NO permission yet, and the API is Patrons-only; asked 2026-09-28).
    - **HARD RULE: NO PAID PROVIDERS.** Nothing the Owner or any user must pay for. Free with strings attached (non-commercial terms, no image licence) is flagged per provider.
    - Four researchers (one per medium) were started 2026-09-28. The set is chosen once they report.
15. **Film and TV providers** (the Owner, 2026-09-28):
    - **TMDB** (was "primary"; NO provider is a default, per the provider-neutral principle below): items, images, film collections, episode groups including Story Order. The project ships its key, with an optional per-user override. TMDB's terms apply: attribution, non-commercial use, a 6-month cache ceiling.
    - **TVmaze** is the TV cross-check (CC BY-SA, keyless), strong on UK specials.
    - **Wikidata** is the id bridge and film-series order.
    - **Local files:** NFO, artwork, and `{tmdb-}` / `[tmdbid-]` hints.
    - **fanart.tv** is OPT-IN, labelled "no image licence".
    - TheTVDB: AT RISK of being wrongly excluded (audit 2026-09-28). Plex, Emby and Jellyfin all use it. Jellyfin ships a project key and makes the subscriber PIN optional, and TheTVDB says it is free under $50k/yr with attribution. Re-decided below. OMDb, IMDb datasets and Trakt are out.
16. **Music and audio providers** (the Owner, 2026-09-28):
    - **MusicBrainz** is primary: identity, release groups, series with ordering, the "Audio drama" type.
    - **Cover Art Archive** for covers.
    - **Embedded audio tags** are read first (including several series separated by `;`).
    - **AcoustID + Chromaprint** fingerprint untagged files.
    - **Wikidata** is the id bridge.
    - **Discogs monthly CC0 dumps** for credits, never the live API.
    - **Deezer** is the keyless artwork fallback.
    - Out: Spotify, TheAudioDB, Last.fm images, iTunes.
17. **Big Finish: CanonCore builds its OWN provider** (the Owner, 2026-09-28): "Build our own. They've let me."
    - The Owner states Big Finish has given permission. The grant's text is not yet on file; save it as a research note when available.
    - The provider discovers releases from `sitemap.xml` and reads release pages politely, with an honest User-Agent. It caches each page once and never uses the robots-disallowed `/api/`. The sitemap lists 1,083 release URLs, while MusicBrainz holds 2,796 Big Finish releases, so the sitemap's coverage is checked against the catalogue before sitemap-only discovery is relied on (audit 2026-09-28).
    - abs-agg's parser (AGPL) may be learned from. abs-agg itself is not a dependency.
18. **Books and audiobooks providers** (the Owner, 2026-09-28):
    - **The files' own metadata comes FIRST:** EPUB OPF, both calibre series and EPUB 3.3 `belongs-to-collection` with `group-position`, several allowed; M4B tags and embedded chapters.
    - **Open Library** for editions, ISBNs and covers (1 req/s anonymous, 3 req/s with an app name and contact in the User-Agent; the monthly dumps are used for bulk).
    - **Wikidata** for series order (all 55 NSA novels numbered).
    - **Secondaries:**
      - **Hardcover** (the Owner's own free token, server-side only. It is in beta and "may reset tokens without notice", with limits of 60/min and 5,000/day; other users supplying theirs would need OAuth).
      - **AudiobookDB**: AT RISK (audit 2026-09-28). Its terms say "Programmatic access ... commercial integration ... require a separate licensing agreement", and "The API license does not cover cover art or book descriptions". It is in alpha. Re-decided below.
      - **iTunes Search** for audiobook discovery only, with its artwork displayed and not stored.
    - Out: Google Books as stored data, Audible/Audnexus as primary, Goodreads, StoryGraph, ISBNdb.
19. **Comics providers** (the Owner, 2026-09-28):
    - **The files' own ComicInfo.xml comes FIRST.** `StoryArc`/`StoryArcNumber` pairs become placements. `StoryArcNumber` is in the v2.1 draft.
    - **Metron** is primary: ordered, typed, source-attributed reading lists, a direct fit for multi-placement. CC BY-SA 4.0, 20/min and 5,000/day per authenticated user; every endpoint needs auth, so each install needs its own Metron account. AT RISK (audit 2026-09-28): every comics competitor (Mylar3, Kapowarr, Komf, Calibre-web, Booklore) uses Comic Vine, and none uses Metron. Re-decided below.
    - **GCD** via its CC BY-SA dump for depth. Its unstable API is not used.
    - **Comic Vine** is OPT-IN with the Owner's own key, labelled with its terms: non-commercial, "no competing products", no redistribution in other formats. It covers Titan's Doctor Who.
    - **CBL reading lists** can be imported, flagged as unlicensed.
    - TARDIS Guide supplies the Doctor Who (Titan) reading order.
    - Out: League of Comic Geeks (no API), Marvel API (dead).
20. **Identity and local files** (the Owner, 2026-09-28):
    - **Identity:** every provider id is stored as a sourced statement. **Wikidata's QID is an optional bridge, never the primary key.**
      - At work and series level, resolve through Wikidata by external id, batched, with a descriptive UA and a cache.
      - At episode and issue level, rely on the providers' own cross-ids (TMDB external ids; Metron `cv_id`/`gcd_id`) and on filename hints.
      - Measured: 903 of 905 Doctor Who episodes have an IMDb id, but only 19 a TMDB id. 511 items carry a Tardis Fandom id.
    - **Local files: READ everything, WRITE nothing.**
      - Read: Kodi NFO, ComicInfo.xml, EPUB OPF, embedded audio tags, CBL, local artwork names, and both filename-id syntaxes (`{tmdb-…}` and `[tmdbid-…]`).
      - CanonCore never modifies the Owner's media files. Its richer data lives in its own database, which is backed up.
      - Exporting orderings (CBL or ComicInfo arcs) may come later as an explicit action.
21. **A CMPP Provider Store in CanonCore** (the Owner, 2026-09-28): "Store has every provider, with an option for users to install private ones too for their CanonCore."
    - Providers speak the CMPP contract and are installable from an in-app Store that lists every PUBLIC provider (TMDB, TVmaze, MusicBrainz, Metron and so on).
    - Any user can also install a PRIVATE provider on their own instance, unlisted. Tardis Fandom and Big Finish, which rest on permission given to the Owner personally, are private installs on the Owner's server.
    - Open: how a provider runs. It could be in-process, a separate service reached by URL (old CMPP), or both, with the Store installing either. To be grilled.
22 (asked). **New feature: filming locations on a map** (the Owner, 2026-09-28): "filming locations via an API and Mapbox". Data source and Mapbox's free terms are being researched, since no paid providers are allowed.
23 (asked). **New feature: songs in an episode** (the Owner, 2026-09-28): "finding songs that are playing, e.g. these songs play in this episode". Data sources are being researched.

22. **Filming locations:** Wikidata P915 (coordinates, CC0) plus Tardis Fandom's per-story "Filming locations" sections, each place geocoded once by a one-off job against a configurable geocoder endpoint (Nominatim for the Owner's own install; its limits count all installs together, and periodic app requests are "strongly discouraged". Self-hosted Photon otherwise) and stored. OpenFreeMap offers no SLA and "may discontinue it at any time", so the PMTiles fallback stays. Only places below city level are kept. The map is MapLibre GL JS on the web (OpenFreeMap tiles to start, a self-served PMTiles extract later) and native MapKit on iPhone, Mac and Apple TV. Mapbox is out: its real free tier needs a card, every install needs its own account, and it has no tvOS. Evidence: `filming-locations.md`.
23. **Songs:** every film and show shows its soundtrack ALBUM, from Wikidata P406 and the MusicBrainz release group (1,850 films and 546 TV series linked, measured 2026-09-28), and any track in the library plays. Per-episode songs are stored as sourced links (episode, recording, time, duration, order: Wikidata P10664's shape) and imported where P10664 exists. The server LISTENS for songs with Olaf (AGPL-3.0), which fingerprints the library's own music, matches each episode's audio and suggests what plays when. A person confirms each suggestion, and hand entry fills the rest. It finds only songs the library holds. Accuracy under dialogue is unmeasured, so one real episode is tested before the feature is promised. Tunefind and WhatSong are out (paid or closed), and so are AcoustID (not built for fragments) and AudD/ACRCloud (paid). Olaf 3.2.2 (2026-09-27) is built with Zig and needs ffmpeg at run time. It is installed to a user prefix, and one Whatbox build is proven first. Evidence: `songs-in-episodes.md`.
21a. **How providers run (settles the open half of 21):** CMPP is an HTTP protocol with a manifest URL, and the Store lists manifest URLs. A private provider is installed by pasting its URL, and can be written in any language and hosted anywhere. First-party providers implement the same interface but load in-process, so the shared Whatbox runs no always-on process per provider. Only trusted code runs in-process: Node 24's permission model is Stable, but its docs say "Malicious code can bypass the permission model", so strangers' code always stays behind a URL. The Owner reviews each Store listing; a manifest carries a semver `version`; adding an unlisted URL shows a trust warning, as Jellyfin does for third-party repositories (audit 2026-09-28). Precedent, verified 2026-09-28:
    - Plex Custom Metadata Providers (announced 2025-12-09): "enter the URL for the locally running provider".
    - Stremio addons: a manifest URL plus a central catalogue.
    - Audiobookshelf custom providers: a URL plus a token, with an OpenAPI spec.
    - Jellyfin: in-process DLLs from manifest repositories, the older model.

## Re-decided after the audit (2026-09-28)

10a. **Whatbox permission (settles the AT RISK on 10 and 13):** the Owner says Whatbox has ALLOWED his personal use AND inviting friends. Any other person running CanonCore on their own Whatbox slot must ask Whatbox themselves; the install docs say so. The text of Whatbox's permission is to be saved beside the other grants when the Owner forwards it.
12a. **What "everything playable" means (the Owner, 2026-09-28):** EVERY MEDIUM plays on EVERY CLIENT: video, audio, EPUB and CBZ, on web, iOS, macOS and tvOS. That is its meaning, not "every codec". Codec coverage is its own decision (12b).
12b. **Unsupported video codecs (for any host):** handled both ways, as Swiftfin does.
    - **Apple apps:** Apple's player (AVPlayer) for anything in the HLS spec. A built-in software player (VLCKit or MPVKit) decodes everything else on the device, with no server work.
    - **Server:** transcoding (ffmpeg, with hardware acceleration where the host has it) is a capability each install turns on or off. When on, it serves the web and acts as a fallback.
    - **Whatbox:** transcoding is off, so odd files play in the Apple apps and the web shows "open in the app".
    - Precedent: Plex, Jellyfin and Emby transcode on the server, Infuse decodes on the device, and Swiftfin does both (audit 2026-09-28).
19a. **Comics, re-decided:**
    - **Comic Vine** (was "PRIMARY"; NO provider is a default, per the provider-neutral principle below). Each user supplies their own free key, as in Mylar3 and Kapowarr. This matches every competitor.
    - **Metron** is added on top for its ordered, typed reading lists, which feed orderings. It needs each install's own free account.
    - **ComicInfo.xml** in the files comes first. The **GCD dump** is optional.
    - This supersedes Metron-primary in 19.
15a. **TheTVDB is in the Store** beside TMDB (the earlier "TMDB stays primary" is void under the provider-neutral principle).
    - It ships with the project's free key and attribution, and a user's subscriber PIN is optional, as in Jellyfin.
    - Its alternate episode orders become more orderings.
    - This supersedes "out until confirmed" in 15.
18a. **AudiobookDB is dropped:** its terms need a licensing agreement and exclude covers and descriptions.
    - Audiobooks use M4B tags and chapters first, then Open Library and Wikidata, then Hardcover. iTunes Search provides display-only art.
    - Audible and Audnexus stay out.

## The stack (the Owner, 2026-09-28; evidence in `stack-research.md`)
24. **Server:** Node 24 with **Hono 4** on @hono/node-server.
    - Routes are declared with **Zod 4** schemas through **@hono/zod-openapi**, and the OpenAPI 3.1 spec is generated from them (code-first, like Jellyfin, Immich, Kavita and Komga).
    - The spec feeds **swift-openapi-generator** (1.13.1) for the Apple app and the web's types.
    - Fastify was the runner-up.
25. **Database:** SQLite through **Kysely** (0.29, with its Migrator) on **better-sqlite3 13**, which ships prebuilt binaries.
    - Move to `node:sqlite` once it is Stable.
    - Drizzle was passed over because it is still 0.x (1.0 is RC).
26. **Auth: Better Auth with our own profiles** (re-decided by the Owner the same day, after "which is more impressive?").
    - **Better Auth** handles accounts, passwords, sessions, device-code pairing (its `device-authorization` plugin, RFC 8628), bearer tokens and API keys (`@better-auth/api-key`), on SQLite through its Kysely adapter.
    - **Profiles** are our own tables under an account, chosen after login like Netflix. Every piece of watch state is keyed by profile.
    - **Why:** "don't roll your own auth" is the 2026 norm a reviewer looks for. The product-specific part (profiles, pairing an Apple TV) stays ours.
    - **Passkeys and 2FA** are to be verified before they are relied on.
    - **Risk accepted:** Vercel has owned Better Auth since 2026-07-07. It is open source, and the data stays in our tables.
    - **Rejected:** hand-rolled auth like Jellyfin and Kavita.
27. **Web:** **React 19 + Vite + TanStack Router** as a single-page app served by the same Node process.
    - **hls.js 1.7** plays the streams, with the **Media Chrome 4** player UI.
    - Next.js was passed over (static export cannot serve runtime routes). TanStack Start is RC, and the SvelteKit SPA carries a performance warning.

28. **A fresh slate for EVERYTHING (the Owner, 2026-09-28):** "We need new everything. Fresh slate."
    - **Linear:** keep the paid workspace. Issues start from **1**, and the old tickets are kept (an export is fine). The mechanism is being verified: a new team, since team numbering can't be reset.
    - **Records:** new ADRs from 0001, a new CONTEXT.md and a new CLAUDE.md. The old ones are archived as evidence only.
    - **Process:** rebuilt fresh too. What survives from the old process is chosen on purpose, not carried over.
    - **Standing rule (the Owner):** every spec and ticket starts from what competitors do and verifies its claims.
29. **Where orderings come from, for any franchise:** layered sources plus shareable lists. Evidence: `ordering-sources.md`.
    - **As broadcast:** TMDB collections, episode groups and v4 lists, plus TheTVDB's alternate orders (e.g. Firefly's DVD order).
    - **As a timeline:**
      - Fandom wikis: ONE provider, with a small adapter per wiki page format (the MCU wiki's table, Wookieepedia's `MediaRow`, Tardis's `Theory:Timeline`). Each wiki's licence is honoured; Memory Alpha is non-commercial.
      - MDBList community lists (free key; Kometa's source).
      - Orders the user builds.
    - **Sharing:** every ordering imports and exports as an ordered list of TMDB, TVDB or IMDb ids, the same shape as Kometa's `text` builder.
    - **Ordinary shows** (Friends) just show As broadcast.
    - **The Owner's Doctor Who sources** (Tardis `Theory:Timeline`, TARDIS Guide) plug in the same way.
    - **Avoided as defaults:** Trakt (a draft policy against mirroring), IMDb (scraping forbidden), Letterboxd (no API for personal projects).
30. **The archive is a separate repo** (the Owner, 2026-09-28): the whole old tree goes to the private `canoncore-history` repo, which already holds the pre-publication history and the forensic record. Then main is cleared down to `docs/rethink/`, `prototypes/`, LICENSE and a new README.
    - main's own git history still holds everything as well.
    - The provider repos (provider-wiki and provider-tmdb) are archived the same way: pushed to `canoncore-history` or set read-only. That detail is settled when it is executed.
    - Carried out only after the grill, and shown to the Owner before anything is removed.

## The schema (grill, 2026-09-28)
31. ~~Item → File~~ AMENDED by 31a (editions restored after the competitor check).
    ~~**Item → File, like Plex:**~~ one Item (a film, an episode, a book, a track) holds any number of Files: its versions, such as 4K and 1080p copies, or an EPUB and an M4B.
    - There is no separate Edition layer. The Owner chose this over Work → Edition → File, so a theatrical cut and an extended cut are versions of one Item and share its orderings.
    - Plex's metadata item → media versions → parts is the precedent.
32. **Structure: a fixed hierarchy per medium, with orderings on top** (the Owner agreed after the prototype, `prototypes/schema-structure/`).
    - **Hierarchies:** Show → Season → Episode; Artist → Album → Track; Book series → Book; Comic series → Issue; Film, optionally in a Collection.
    - **The hierarchy is "As broadcast"**, so an ordinary show (Friends) looks exactly like Plex, with seasons, "S2E3", next episode and Continue Watching.
    - **Orderings are a separate layer** (ordering + placement), holding timelines, lists and TheTVDB alternate orders, across media. They appear on franchise pages as "As a timeline", and on every item as "Also in" beside its fixed HOME.
    - **Every fact carries its source**, through a statement table.
    - **Rejected:** "everything is an ordering" (the old Containers), which makes ordinary shows generic and takes away the timelines' special status.
33. **Provider conflicts: keep every value.**
    - Every provider's value is stored as a sourced statement, and nothing is discarded.
    - A per-field priority order picks the one shown, e.g. titles: local file > TMDB > TVDB; Doctor Who story facts: Tardis Fandom first.
    - An edit becomes a statement of its own that wins and LOCKS the field, like Jellyfin's lock.
    - The item page can show every provider's value side by side.
    - Precedent: Jellyfin and Plex use a priority order and a lock but keep only the winner. We go further, because the source badges need every value.
34. **Who can change what:**
    - **Admins** (the Owner, plus anyone he grants it to) edit metadata, set overrides, add providers and invite people. Their edits apply to everyone.
    - **Any profile** builds its own orderings. They are private by default, and can be shared with the whole install or exported as an id list.
    - **Provider timelines** (Fandom, TARDIS Guide) are install-wide.
    - **Watch state** is always per profile, and a kids profile can be restricted to watching.
    - Precedent: Plex (owner-only edits, per-user playlists) and Jellyfin (permissioned edits, shareable playlists).
35. **Full catalogue** (the Owner chose this over "owned first, unowned greyed"): everything the providers know about is browsable, whether owned or not, so CanonCore is a reference as much as a player. Owned and playable items are marked, and a filter like "Only what I can play" narrows any view. How far the catalogue reaches is decided in 36.
36. ~~The catalogue grows from seeds~~ SUPERSEDED by 37 (files are not seeds). Kept: never mirror whole providers.
    ~~**The catalogue grows from seeds.**~~ Seeds are the library's files and the orderings turned on.
    - **An owned item pulls in its whole show** (every season and episode) **and its franchise's other works.**
    - **An enabled ordering pulls in every entry it lists.** The Eleventh Doctor timeline brings 603.
    - **Anything else:** live provider search, kept only with "Add to catalogue".
    - **Never mirror whole providers.** That is the old "way too much" problem.
    - A Friends-only install holds just Friends.

## PRINCIPLE: schema first; providers propose, the user decides (the Owner, 2026-09-28)
37. **The catalogue is CanonCore's own schema, built by the user from providers, and media files only link to it.**
    - **Providers PROPOSE through CMPP, into the strict schema:** a show, a film, a franchise and its members, a timeline. The user reviews each proposal and IMPORTS what they choose, for example ticking Torchwood and unticking Doctor Who Confidential in the franchise Wikidata proposes. The precedent is MusicBrainz Picard: look up, compare, accept.
    - **A media file NEVER creates an item or seeds the catalogue.** It LINKS to an existing CanonCore item: Rose.mkv attaches to the Rose item already imported.
    - **This supersedes the seed half of 36.** The Owner: "it should be focused on CanonCore schema, don't suggest via files".
    - **This supersedes 35's "everything providers know is browsable":** the catalogue is what the user has imported. Live provider search is how new things are found and proposed.
38. **Linking files: suggested, then confirmed.**
    - **The scanner suggests.** It reads the filename, the folder, embedded tags, an NFO or a `{tmdb-…}` hint, and suggests "file → item" against items ALREADY in the catalogue.
    - **Confident matches confirm in bulk.** An exact provider id, or S01E01 inside an imported show, can be confirmed with one click.
    - **Unmatched files wait.** They sit in "Unlinked files" until the user links them, or imports the item first.
    - **A file never creates an item** (37).
39. **After import:** facts about imported items refresh on their own: overview, poster, air date and runtime. Each value is a sourced statement, and the user's edits always win (33).
    - **Anything that would ADD to or restructure the catalogue arrives as a proposal:** a new episode, a new franchise member, a changed timeline order.
40. **Franchises are imported like anything else (from 37).**
    - **Providers propose a franchise and its members:** Wikidata reads its three links (P8345 media franchise, P1434 fictional universe and P179 part of the series), and TMDB collections cover films. The Fandom and curated-list providers can propose too.
    - **The user ticks what to import**, for example unticking the Wizarding World fan films.
    - **Measured 2026-09-28**, as films / TV with TMDB ids across the three links:
      - Doctor Who: 23 / 17. Good.
      - Star Wars: 29 / 26. Good.
      - MCU: 49 / 27. Good.
      - Star Trek: 25 / 12. Good.
      - Wizarding World: 14 / 0, including fan films.
      - The Conjuring: 3 / 0, weak.

## The roadmap (grill, 2026-09-28)
R1. **Project 1: "Play Rose on every device"**, a thin end-to-end slice.
    - **Server:** runs on Whatbox (Hono, SQLite, Better Auth), with the Owner's account only.
    - **Import and link:** the TMDB provider proposes a show or film, and the Owner imports it. Files are linked by suggestion.
    - **Playback:** direct play plus a remux to HLS.
    - **Clients:** ONE SwiftUI app for Apple TV, iPhone and Mac, plus the web player.
    - **Done when:** the Owner imports Doctor Who (2005), links Rose.mkv, watches it on the Apple TV, and resumes it on the iPhone, the Mac and the web.
    - Every later project is a layer on top.
R2. **The order after project 1** (the Owner chose the draft):
    1. Play Rose on every device.
    2. **Orderings and franchises**, the standout:
       - Wikidata franchise proposals;
       - the Fandom provider with adapters, starting with Tardis `Theory:Timeline`;
       - TARDIS Guide sets, once the API key arrives;
       - "As a timeline" and "Also in";
       - id-list import and export.
    3. Friends and profiles: invites, profiles, device-code pairing.
    4. The CMPP Store and more TV/film providers: TheTVDB, TVmaze, URL providers.
    5. Music, including the Owner's Big Finish provider, since audio lands here.
    6. Books and audiobooks.
    7. Comics.
    8. Odd codecs: the on-device software player, and server transcoding as a capability.
    9. Filming locations and songs.
    10. Public release: a Docker image, install docs, and the "ask your host" note for seedboxes.
    - The placement of the Doctor Who providers inside 2 and 5 is the dispatcher's allocation, to be confirmed in each project's spec.

## The process (grill, 2026-09-28)
P1. **Linear:** a NEW team with key **CC** (CC-1, CC-2 …) in the paid `jacobrees-canoncore` workspace.
    - The old CNCORE team is exported to CSV and RETIRED: read-only, restorable, and its CNCORE-n ids stay valid as history. It is never deleted or rekeyed.
    - The "delete the old team" advice in the setup skill and the memory is corrected to "retire". Evidence: `linear-fresh-start.md`.
P2. **Records follow Matt Pocock's current setup, plus our verify step.** Evidence: `matt-pocock-setup.md`.
    - **Founding ADRs:** this grill becomes about 15 ADRs numbered from 0001, one paragraph each. Later ADRs are written only when a choice is hard to reverse, surprising, and a real trade-off.
    - **CLAUDE.md** is a pointer file of about 40 lines: what CanonCore is, the commands, and pointers into `docs/agents/`.
    - **Repeated gotchas become checks** (lint, hooks, CI) through his `retro` skill, not prose.
    - **One CONTEXT.md glossary.**
    - **The flow is grill → spec → tickets → implement.** Our addition: a competitor check and `/verify` before a spec publishes and before a ticket leaves Backlog.
    - **Counts at the time:** the old records were 193 ADRs (134 accepted, 59 proposed) and a 199-line CLAUDE.md.

## Schema, after the gap checks (2026-09-28)
31a. **Item → Edition → File, Plex's split.**
    - **An EDITION is a different cut.** It carries its own runtime and watch state: broadcast against remastered, extended, or the director's cut.
    - **A FILE is a version of one edition:** 1080p, 4K or NTSC.
    - **Every Item has a default edition,** so ordinary shows look unchanged.
    - **Orderings place the ITEM,** so "Also in" covers whichever cut is watched.
    - **Precedent:** Plex says "Versions all represent the same release… Editions represent different releases", and each edition keeps its own watched state. Jellyfin and Kodi have only versions. Evidence: `competitor-data-models.md`.
    - **The Owner's files already carry the labels:** `{edition-Blu-Ray}`, "Remastered Version", "NTSC Blu-Ray Version".
41. **Character and Person are real entities.**
    - Both are catalogue entities with their own pages and sourced statements, imported by proposal like anything else.
    - **A credit is Person × Item × role × Character,** optionally with an incarnation (the Tenth Doctor), as Wikidata's P4649 does.
    - **A timeline can belong to a Character,** such as "Rose Tyler's timeline".
    - **Precedent:** Wikidata, where the Doctor Q34358 has 15 performers qualified by incarnation, Metron and TheTVDB. Plex, Jellyfin, Kodi and TMDB keep the character as a string, and TMDB splits the Doctor ("Doctor Who" against "The Doctor").
42. **Relationships: typed, directed, sourced links between Items, from a SMALL FIXED vocabulary.**
    - **The vocabulary:** adaptation of / based on, spin-off of, soundtrack of, remake of, version of, crossover with.
    - **Sequel and prequel are NOT stored,** because orderings already say what comes next.
    - **Imported from Wikidata by proposal:** P144 based on, P4969 derivative work, P2512 has spin-off, P406 soundtrack release. They are editable, and show as "Based on" and "Adapted as".
    - **Precedent:** Wikidata, MusicBrainz and Kavita `RelationKind`. Plex and Jellyfin have none.
43. **Multi-part stories: the STORY is the Item, and its parts are episodes beneath it.**
    - This follows TMDB's "Story Order" episode group (type 5, id 6211072396670e006ba4e521). Measured 2026-09-28: 156 story groups, 713 episodes, with The Trial of a Time Lord as one 14-episode group and Shada as group 108.5. The old "154 of 159" is replaced. The project 2 spec counts stories against a named story list.
    - **The hierarchy is Show → Season → Story → Part,** but only where a show has multi-part stories. Modern episodes stay one level.
    - **Timelines place the story.**
    - **Linking files:** a whole-story file (a fan omnibus) links to the story, and part files link to their parts.
    - **Per-part watch state is kept.**
    - **Unmeasured:** how modern two-parters (Aliens of London / World War Three) are grouped. Measure in the project 2 spec.
44. **Extras are Items owned by a parent,** following Jellyfin's `OwnerId` + `ExtraType`.
    - **Types:** trailer, featurette, interview, behind the scenes, deleted scene, commentary, short, sample, clip, other.
    - **Owners:** an episode, story, season, show, film or franchise.
    - **Each extra has its own files, metadata and watch state.** They show in an "Extras" row and are left out of Continue Watching.
    - **Files link using Plex and Jellyfin naming:** Plex's `-trailer -featurette -behindthescenes -deleted -interview -scene -short -other` and folders, plus Jellyfin's `-clip -deletedscene -extra -sample`.
    - **An extra can be placed in an ordering** when it matters, such as a prequel minisode.
45. **Licence:** the code is **AGPL-3.0** (as before, and as Immich uses).
    - **Provider data** is used under each provider's own terms, most of them non-commercial. The README says so, and each provider's attribution is shown in the app (Settings › About, plus TMDB's logo and notice).
    - **Competitor licences, verified with the GitHub API on 2026-09-28:** Jellyfin GPL-2.0, Audiobookshelf GPL-3.0, Navidrome GPL-3.0, Immich AGPL-3.0.
46. **Outbound URL safety (SSRF): safe by default.**
    - **Only admins add provider URLs.**
    - **Refused:** private, loopback, link-local and cloud-metadata addresses, `file://`, and redirects into any of them. The check runs after DNS resolution and on every redirect.
    - **Public hosts need HTTPS,** and responses are capped in size and time.
    - **An admin can explicitly allow a local provider** (the same box, or a Tailscale address) behind a warning.
    - **URLs a provider returns** (images, links) pass the same check.
    - Precedent in the old records: ADR-0034 (an allowlist and a deny-list), and access-layer.md §5.3 on Tailscale and loopback.
47. **Login protection: slow down, never lock out.**
    - **Rate limits:** Better Auth's limiter is per IP and per path, in a fixed window (`window`, `max`, `X-Retry-After`), and sets no account lock (verified in v1.7.6 source and docs, 2026-09-28). The per-account limit and the growing delays are OURS to build, through `customStorage` or a hook. `ipAddressHeaders` must be set behind the Whatbox proxy.
    - **Better Auth's 2FA plugin LOCKS accounts by default** (`ACCOUNT_TEMPORARILY_LOCKED`, "Enabled by default"). CanonCore sets its lockout `enabled: false` to keep "no lockout ever".
    - **No lockout ever,** because Jellyfin-style lockout lets an attacker lock out the only admin.
    - **Sessions** expire, and can be revoked per device (Settings › Devices).
    - **Sign-in:** passkeys are the main method, possible on the stable `finestarling.box.ca` domain. A password is the fallback, and 2FA is optional.
    - **Every route requires auth** except login and health.
    - Evidence: ADR-0125 measured 70,299 guesses a second; CNCORE-109, 116 and 117.
48. **Streams are authenticated with short-lived signed URLs.**
    - **The flow:** the app starts a playback session through the API with its normal bearer token. The server returns an HLS URL signed for that item, that session and a few hours.
    - **Segment URLs carry the signature,** never the account's token, so a leaked URL expires and grants nothing else.
    - **It works the same** in AVPlayer, hls.js and AirPlay.
    - **Precedent:** CloudFront and Mux signed URLs.
    - **Rejected:** account tokens in stream URLs, and cookies everywhere. Plex documents passing `?X-Plex-Token=` as a URL parameter, and Jellyfin's AuthorizationContext reads `api_key` from the query string (both verified 2026-09-28).
    - **This reconciles** ADR-0108's no-token-in-URL rule with decision 26's bearer tokens.
49. **Subtitles.**
    - **Text subtitles** (SRT and ASS, embedded or in sidecar files) are converted to WebVTT in the HLS stream. That works everywhere with no transcode.
    - **Image subtitles** (PGS and VobSub) play in the Apple app's on-device player (12b). They are burned in where the host has transcoding on. Otherwise the web shows "open in the app".
    - **Default tracks:** the profile's language, "forced" subtitles on automatically, and SDH tracks labelled.
    - **Precedent:** Plex and Jellyfin convert text subtitles and burn in image ones with a full transcode.
50. **Watch progress is kept per profile, per EDITION, as an append-only event log.**
    - Versions of one edition (1080p, 4K, NTSC) share progress. A different edition (Remastered) has its own. This matches Plex.
    - **Players report about every 10 seconds.** Position and "watched" are derived from the log, so history is never lost and sync conflicts resolve by time (ADR-0019).
    - **"Watched" means about 2 minutes or less remaining,** measured as time remaining, not a percentage (ADR-0085).
    - **Watched and unwatched can be set by hand.**
    - **Edge case for the spec:** a PAL and an NTSC version of one edition differ in runtime (PAL speed-up), so a resume point must be mapped by proportion, not by seconds.
51. **A file is recognised by a content fingerprint, and a missing file goes Offline.**
    - **The fingerprint:** size plus hashes of a few chunks, so a rename or move keeps the file's link, edition and progress (ADR-0023). This is OUR design: neither Plex nor Emby documents its file hash (verify found only a non-staff 2013 forum post about `media_parts.hash`).
    - **A missing file is marked Offline,** never deleted, and comes back when the file returns. Removal is deliberate only.
    - **Why:** Jellyfin deletes rows during a storage blip (where-it-runs.md §6.6).
    - **Scans run on a schedule and on demand,** because file-change events are unreliable on network disks (ADR-0050).
52. **Backups run nightly, go off the host, and are encrypted.**
    - **Snapshot:** CanonCore takes a consistent SQLite snapshot with SQLite's online backup, and keeps 7 daily and 4 weekly copies locally.
    - **Off-host copy:** an encrypted copy is pushed with restic to a destination the admin chooses (the Mac over SSH, a Backblaze B2 free tier, and so on; verify B2's free allowance before recommending it).
    - **Restore is one command, and is tested in CI.**
    - **Only the catalogue is backed up,** not the media.
    - **Settings › Backups** shows the last result, with "Back up now" and "Restore".
    - **Why:** a seedbox can be suspended within 24 hours (where-it-runs.md §9.4), and it was the old sweep's most repeated finding (G12).
    - **For the Owner:** the Mac isn't always online (he travels), so an always-on destination is better for his install. Choose it in project 1.
53. **Deploys are versioned releases with a one-command update.**
    - **Each merge to main** builds a versioned release in CI: a Node bundle with the web app inside, and a Docker image for other hosts.
    - **`canoncore update`** downloads the release, backs up the database, runs migrations, swaps the folder, restarts, and checks health. `canoncore rollback` returns to the last release.
    - **Migrations** are forward-only. The server refuses to start on a database newer than it knows (ADR-0047).
    - **Later,** CI may deploy to the Owner's slot automatically over SSH after each release.
    - **Rejected:** building on the Whatbox (a shared, loaded CPU), and containers on Whatbox ("may stop working").
54. **A built-in task scheduler with its own page.**
    - **Jobs live in a SQLite table,** so they survive restarts and never run twice.
    - **Settings › Tasks** lists each job with its last run, result, next run and "Run now", like Jellyfin's Scheduled Tasks.
    - **The jobs:** provider refresh (39), TMDB 6-month expiry, nightly backup (52), scans (51) and session cleanup.
    - **Long jobs report progress live,** fixing CNCORE-365's "progress did not update until a reload".
    - **Cron stays only as the watchdog.**
55. **Apps keep a local copy of the catalogue, fed by a change feed.**
    - **Every table carries a change number, and deletions leave a tombstone** (ADR-0075). Clients ask "what changed since N".
    - **The Apple app** keeps the catalogue on the device. **The web app** keeps it in the browser.
    - **Browsing and search are instant,** and a 603-entry timeline scrolls smoothly. Playback streams from the server as normal.
    - **Progress made offline is queued,** and merges by time through the event log (50).
    - **The Owner normally has good wifi,** so the choice is about speed and craft, not offline use. Precedent: Infuse keeps a full local library; Plex and Jellyfin fetch per screen.

## PRINCIPLE: provider-neutral, NO default provider (the Owner, 2026-09-28)
56. **No CMPP provider is a default.** The Owner: "No CMPP provider should be default, as users can install whatever."
    - **Every provider is installed by the user from the Store,** TMDB included. A fresh install has none.
    - **Decisions 14 to 20 are what the Store OFFERS per medium, not what an install uses.** Their "primary", "secondary" and "opt-in" wording describes coverage, not a product preference.
    - **The hierarchy's numbering follows the provider the user imported that show from.** Another provider's numbering (TheTVDB's DVD order, air order with specials) is importable as an ordering.
    - **Per-field priority (33) is the user's to set.** The product ships no global ranking.
57. **Rejections are remembered, and every decision is undoable.**
    - **Rejecting or unticking** part of a proposal records a decision against that provider's id. It is not proposed again unless the provider's data changes meaningfully, or the user clears it.
    - **Settings › Rejected** lists everything turned down, with Undo, like Sonarr's import list exclusions. The partial precedent is beets' `incremental_skip_later`, which remembers skipped directories but not rejected matches.
    - **Accepted imports and file links can be undone too** (CNCORE-441: about 3% of the old merges were wrong and irreversible).
    - **Why:** ADR-0027 found that almost nothing remembered rejections.
    - Picard's rejection memory is unfounded, since its docs are silent. beets remembers skipped directories only (verified 2026-09-28).
58. **First run is a guided setup,** fixing the old "no way in" (walking-the-owners-install.md, problem 1).
    1. **Create the admin account** with a passkey.
    2. **Pick providers from the Store** by what the person collects (TV and film, music, books, comics). Each provider's terms and key needs show up front, and **nothing is pre-ticked** (56).
    3. **Point at media folders.** This is optional: CanonCore works as a pure catalogue.
    4. **First import:** search a show or franchise, review the proposal, and import.
    - **It ends on a real page,** not an empty dashboard.
    - **Precedent:** the Plex and Jellyfin setup wizards, which pick agents FOR the user. CanonCore doesn't.
59. **CMPP: a manifest plus declared capabilities,** like Stremio's resources.
    - **The capabilities:**
      - search (text);
      - lookup (full record by id);
      - children (seasons, episodes, parts);
      - orderings (a timeline or list, with sections);
      - related (franchise members, spin-off, based-on);
      - match (suggest an item for a filename or tags);
      - artwork.
    - **Each returns data in the CanonCore schema,** with a source on every value. The manifest also names the provider's kinds, version and terms.
    - **A provider implements only what it has:** TMDB search, lookup, children and artwork; Tardis Fandom orderings and related; Wikidata related.
    - **Precedent:** Plex Custom Metadata Providers (match + metadata), Stremio (declared resources), Audiobookshelf (search).
60. **Search runs on the device, with an FTS5 index on the server.**
    - **Apps search their local copy (55) as the user types:** titles, alternate titles, characters and people. Search ignores accents and case, and matches prefixes (CNCORE-469 was accents normalised on only one side).
    - **The server** keeps the same index in SQLite FTS5, for the web and for clients still syncing.
    - **Results are grouped by kind:** shows, episodes, films, books, characters, orderings.
    - **"Search providers"** finds things not yet imported (37).
    - **Replaces** pg_trgm (ADR-0120).
61. **Timeline entries with no matching Item become catalogue Items,** of the right kind: novel, comic, audio, episode, home video.
    - **Each carries what the source says** (title, medium, source link), marked "from <provider> only".
    - **Each gets a page, "Also in", and search.**
    - **A later provider proposal enriches it,** with no duplicate. For example, Open Library proposes Apollo 23 by Justin Richards, the user accepts, and it gains a cover and an ISBN.
    - **The same entry twice in one timeline is one Item placed twice:** Meanwhile in the TARDIS is at #3 and #15 of the Eleventh Doctor timeline.
    - **Real data:** of the first 15 Eleventh Doctor entries, 5 match TMDB and 10 do not.
62. **Repeats are allowed, shown as repeats, and counted once.**
    - **An Item may appear more than once in one ordering.** The later appearance shows "Repeat of #3", so it never reads as an error or a provider disagreement (CNCORE-90, 121).
    - **"Also in" lists each ordering once, with all its positions:** "Eleventh Doctor #3, #15". It counts orderings, not placements (CNCORE-236).
    - **Playing straight through plays it each time,** and the watch state is shared.
    - **Precedent:** ADR-0009 (repeats for recaps and bookends).
63. **Testing: a fixture corpus, layered tests, and a mutation check.**
    - **Each test gets its own throwaway SQLite file.** Nothing is shared (CNCORE-93, 253, 271, 464, 468).
    - **CI fixtures:** a small checked-in set of tiny GENERATED files with the same shapes as the Owner's Doctor Who corpus:
      - two editions;
      - a 4-part serial and an omnibus;
      - PGS subtitles;
      - an M4B with chapters;
      - an EPUB and a CBZ;
      - an extra.
    - **The manual walk:** the REAL Doctor Who corpus on Whatbox (`~/fixtures-work/selection.json`, 124 files) is walked before a project closes.
    - **Layers:**
      - unit tests (Vitest);
      - the API contract (the OpenAPI spec checked);
      - end-to-end on the web (Playwright);
      - end-to-end on the Apple app (XCUITest on the tvOS, iOS and macOS simulators).
    - **Every new test is mutation-checked:** delete the feature and watch the test fail (ADR-0168).
    - **A skipped suite fails CI** (CNCORE-160, 370).
    - **Every CI job has a timeout** (CNCORE-219).
    - **macOS CI is free:** "GitHub Actions usage is free for … public repositories that use standard GitHub-hosted runners", and the repo is public (verified 2026-09-28). Stay on standard `macos-*` runners, because larger runners are never free. For contrast, private-repo rates are macOS $0.062/min and Linux $0.006/min.
64. **Design is decided later, through a design prototype on ALL clients** (the Owner, 2026-09-28): the web, iPhone, Mac and Apple TV.
    - It runs after the grill output and before project 1's spec. "This will take a while and is when we'll decide design really."
    - It is not decided in the grill. The native-Apple-first option was offered as a starting point for the prototype, not chosen.
P3. **The order after the grill** (the Owner chose it):
    1. Finish the grill.
    2. **Clear the slate:**
       - the old code goes to `canoncore-history` (30);
       - the CNCORE team is exported and RETIRED;
       - team CC is created (P1).
    3. **Write the outputs:**
       - about 15 one-paragraph founding ADRs from 0001;
       - CONTEXT.md;
       - a short CLAUDE.md;
       - the roadmap as Linear projects, with NO tickets yet.
    4. **Design prototype** on the web, iPhone, Mac and Apple TV, with the Doctor Who data (64).
    5. `/to-spec` for project 1, with the design in hand.
    6. `/to-tickets`, then `/verify`, then `/dispatch`.
65. **Franchises can nest.**
    - **Torchwood** is its own franchise page (its show, its Big Finish audios, its novels, its timelines) AND sits inside Doctor Who.
    - **The parent page** shows "Franchises within: Torchwood · The Sarah Jane Adventures · Class". Its "As broadcast" can include or hide the spin-offs.
    - **Membership arrives by proposal (40).**
    - **Precedent:** Wikidata puts the spin-offs inside the Doctor Who franchise, and Marvel holds the MCU. This supersedes the old flat, hand-made Group (ADR-0010, 0202).

## Round after the reconciliation (2026-09-28; `gaps-reconciled.md`)
66. **One file holding several episodes links to EACH episode,** with that episode's start and end time in the file.
    - Playing an episode plays only its span, and each episode keeps its own progress and watched state.
    - The link is found from the filename (`S04E12-E13`) or chapters, and confirmed like any link (38).
    - This avoids Jellyfin's merged-item trap (ADR-0021), and goes further than Plex, where "playing any of the represented episodes will play the full file" (support.plex.tv naming guide, verified 2026-09-28). The times in the example were illustrative.
67. **Every Item has a sort title.**
    - **Leading articles are dropped** ("The Christmas Invasion" files under C), and punctuation is ignored.
    - **Titles starting with a digit** group under "#" in the A–Z jump bar (CNCORE-242, 446).
    - **It's a sourced value,** overridable and lockable (33); for example, to keep a title under "T".
    - Plex and Jellyfin behave this way; confirm in the spec.
68. **Providers declare their credential and rate limit, and the server enforces them** (the Owner: "the best for the user").
    - **The manifest declares** the credential (none, a user-pasted key, or a shipped project key) and the rate limit.
    - **The server runs one limiter per provider:**
      - it honours "retry later" replies;
      - it pauses and resumes long imports;
      - it records "refused" separately from "nothing found" (CNCORE-373, 166, 254).
    - **Setup shows what each provider needs** before it is installed.
69. **Accessibility gates every merge.**
    - **Web:** WCAG 2.2 AA, checked by axe in the Playwright tests. Zero violations are required.
    - **Apple:** every control has a VoiceOver label, text follows Dynamic Type, and focus works with the Apple TV remote and Switch Control. This is checked with Xcode's accessibility audits in the UI tests (the XCUITest audit API needs verifying).
70. **Default audio track: the one the file marks as default** (the Owner chose this over "profile language, never extras"). Other tracks are switched by hand.
71. **Process rules follow INDUSTRY PRACTICE, not the old repo's rules** (the Owner: "whatever is industry practice, don't focus on the old repo").
    - **CI speed is a first-class requirement.** The Owner: "the CI/CD pipeline was a bottleneck of how fast we could go last time". Before, a docs change ran the whole pipeline.
    - **The CI design is settled in 72.**
72. **CI: affected-only and tiered.** The repo is a pnpm + Turborepo monorepo.
    - **A docs-only change runs docs checks only.**
    - **A code change runs typecheck, lint and unit tests for affected packages only,** through `turbo run … --affected`. That covers changed packages and their dependents; it needs full git history, and a shallow clone falls back to running everything (verified in the Turborepo docs, 2026-09-28). The target is under about 5 minutes.
    - **Playwright + axe run only when web code is affected. Xcode build + XCUITest run only when Apple code is affected,** on free standard macOS runners.
    - **A nightly job runs everything.**
    - **A merge requires CI to have passed on the exact commit that lands:** a merge queue if the repo's plan allows it (unverified: check at setup), otherwise "branch must be up to date".
    - **Caching is added only where measurement shows it helps.** Whether Turborepo's remote cache is free is unverified.
73. **Entity kinds, franchise-agnostic** (the Owner: "yes" to the best-for-the-user option). Beyond Person and Character (41):
    - **Group:** a team or organisation, such as the Avengers, Starfleet or S.H.I.E.L.D.
    - **Place:** Gotham, Hogwarts, Tatooine. This ties into the filming-locations map (22).
    - **Company:** studios, networks, publishers, such as the BBC, Marvel Studios or Big Finish.
    - **Any entity can have a page, appearances, and its own timelines.**
    - **Species or origin, concepts and objects wait** until providers commonly supply them.
    - **UNVERIFIED precedent:** the entity lists of Comic Vine (character, team, location, concept, object, origin, story arc) and Metron (character, team, universe, arc, creator) are from memory. The check was interrupted; verify before the ADR. TMDB's companies and networks were read earlier this session.
74. **Positions in an ordering.**
    - **Every entry has a whole-number position.**
    - **An entry can be flagged "at the same time as the previous one",** shown as a bracket. Playing straight through still plays them in sequence.
    - **Entries a source cannot place** go in a final "Placement unknown" section, still shown and playable.
    - **Reordering by hand stays a drag.** The MCU examples in the question were illustrative, not sourced placements.
75. **Up Next follows the ordering the user started from.** Playing from a timeline "walks" it.
    - **The next entry plays next.**
    - **An entry the user can't play** (a novel or comic they don't own) shows as a card with Skip and Open. It is never silently jumped. An owned EPUB or CBZ opens in the reader (12a).
    - **Continue Watching remembers the ordering being walked,** e.g. "Amy Pond's timeline · #9".
    - **Starting from a show's page walks the show as normal.**
    - This is the core of decision 1.
76. **Dates carry a precision and an optional country.**
    - **Precision is day, month or year,** as Wikidata stores dates. "2010" shows as 2010, never as 1 Jan 2010.
    - **A film can hold several country releases.**
    - **Date sorting respects precision.**
    - **The item shows the profile's country date** when there is one, otherwise the earliest.
    - **Each date is a sourced value (33).** The Endgame dates in the example were illustrative, not verified.
77. **Missing and reconstructed episodes.**
    - **A lost episode is an ordinary Item with no file,** marked "missing" (broadcast lost), so seasons and timelines stay complete and honest.
    - **A reconstruction is an EDITION of that episode (31a),** with its own files and watched state, like a remaster: animated, telesnap or fan recon.
    - **There is no separate coverage concept** (the old ADR-0060, 0082 and 0088 are dropped).
    - The Power of the Daleks animation (2016) in the example is from memory.
78. **Continuity has no concept of its own.**
    - **An alternative continuity is a nested franchise (65) with its own orderings.** For example, Star Wars › Legends with a Legends timeline.
    - **The word "continuity" stays reserved** (old CLAUDE.md), and is not built.
79. **Features without a home are placed in the roadmap.**
    - **Project 8 becomes "Playback polish and odd codecs":** the on-device player, server transcoding, skip intro and credits, trickplay, chapters, offline downloads, Chromecast and spoiler control.
    - **Project 10, "Public release", gains** localisation, local-network discovery and the support log bundle.
80. **Fandom images come server-side with a Referer header, and only that.**
    - **The Owner's condition:** "no images from Fandom, unless there's a good way round Cloudflare", and not the old iteration's browser-session workaround.
    - **Measured 2026-09-28:** `static.wikia.nocookie.net/.../Apollo_23.jpg` returns **403** without a Referer and **200 image/webp** with `Referer: https://tardis.fandom.com/`, from both Whatbox and the Mac. There are no cookies and no session to expire.
    - **If the challenge returns,** the provider marks "image unavailable" and moves on. It never falls back to a browser session.
    - **Other providers' covers** (Open Library, Comic Vine, TMDB, Big Finish) are used where installed, under the user's priority (33, 56).

## Glossary (the Owner, 2026-09-28): `docs/rethink/CONTEXT.md`
81. **The canonical words, agreed term by term.**
    - **Ordering** is the umbrella word, and a Timeline is one kind of Ordering.
    - **Library** means EVERYTHING imported, owned or not. The Owner chose it over "catalogue" plus "library".
    - **Edition** is a cut, and **Version** is a copy (Plex's word).
    - **Match** is attaching a media file. "Link" is reserved for Relationships.
    - **A Statement comes from a Source.**
    - **Where earlier decisions here say "catalogue", read "Library".** Where they say "File" for a copy of an Edition, read "Version". CONTEXT.md governs names in code, UI and tickets.

## After the consistency audit (2026-09-28; `audit-consistency.md`)
82. **Project 1 ships a minimal Store** (store v0).
    - **First run lists Providers** (TMDB first), with Install, a key field where needed, and "Add provider by URL".
    - **Nothing is installed until the user chooses,** so "no default" (56) holds from day one.
    - **Project 4 grows it:** TheTVDB, TVmaze, updates, trust warnings and browsing.
83. **A show's structure is chosen at import, per show,** from what its Provider offers.
    - **The options** are the default numbering, or one of the Provider's groupings: TMDB episode groups such as "Story Order", or TheTVDB's alternate orders.
    - **Choosing a story grouping gives the show a Story level** (Show › Season › Story › Part). Every other grouping stays available as an Ordering.
    - **Shows without groupings** (Friends) just use the default.
    - **This reconciles 32, 43, 29 and 56,** with nothing Doctor Who-specific in the core. The episode counts shown in the example were illustrative.
84. **Before the user sets any priority, INSTALL ORDER decides:** the first-installed Provider's Statement wins, for every field.
    - **Settings › Providers** reorders it per field, e.g. Tardis Fandom first for story facts.
    - **The user's own Statement always wins and locks.**
    - **This replaces 33's example rankings,** which are NOT defaults.
85. **One rule for files that cover several Items: segments.**
    - **The file is matched to each Part or episode with a start and end time,** and each keeps its own watched state (66).
    - **Where the Parts form a Story, "Play story" plays the whole file.**
    - **A Version is backed by a file, or by a time span of one.** CONTEXT.md is updated accordingly.
    - **This supersedes 43's "a whole-story file links to the story".** The times in the example were illustrative.
86. **"Local metadata" is a built-in Provider, ALWAYS ON.**
    - **It speaks CMPP** like any Provider, reading tags, NFO, ComicInfo and EPUB metadata.
    - **Its facts are Statements from Source "local file",** ranked by install order (84); it can be ranked last. Anything structural (an Ordering from a ComicInfo story arc) is a Proposal the user accepts.
    - **Files still never create Items (37).** Matching (38) reads filenames and tags only to suggest which Item a file belongs to.
    - **This is the ONE exception to "no default Provider" (56),** because it only reads the user's own files. The Owner chose "always on" over "installed like any other".
    - **It supersedes 18 and 19's "file facts come first" and "StoryArc pairs become placements".**
87. **Sign-in works on every host: always a password, a passkey when possible.**
    - **Setup always creates a password.**
    - **On a secure HTTPS domain** (the Owner's `finestarling.box.ca`, a Tailscale HTTPS name), it offers "Add a passkey", and passkeys become the fast way in.
    - **On a plain http:// LAN install,** the passkey option is hidden.
    - **2FA stays optional,** with its lockout disabled (47).
    - **This supersedes 47's "passkeys are the main method" and 58's "create the admin with a passkey".**
88. **Importing an Ordering is ONE Proposal, ticked by medium,** which reconciles 61 with 37.
    - **The Proposal shows what it would add, grouped by medium** (TV, novels, comics, audio…) with checkboxes. The user accepts once.
    - **Ticked entries become Items.**
    - **Unticked entries stay in the Ordering as text entries marked "not imported",** and can be imported later.
    - **Rejections are remembered (57).**
    - **The counts in the example were illustrative.**
89. **Wikidata is an ordinary, optional Provider.**
    - **With it installed,** it proposes franchises, relationships and cross-media ids.
    - **Without it:**
      - TV and film still line up across Providers through shared ids (TMDB lists TheTVDB and IMDb ids);
      - franchises and cross-media relationships (the Rose novel based on the Rose episode) are added BY HAND, or proposed by another Provider (Tardis Fandom, TMDB collections).
    - **First run says what Wikidata adds.**
    - **Local metadata stays the ONLY always-on Provider (86).**
    - **This clarifies 20, 40 and 42.**
90. **On Apple TV the local Library copy is a rebuildable cache.** This amends 55 and 60 for tvOS.
    - **Why:** tvOS guarantees only 500 KB of persistent storage, and "all other data must be purgeable" (Apple's tvOS guide, confirmed 2026-09-28).
    - **After a wipe:**
      - sign-in and the server address survive (Keychain and persistent defaults);
      - screens load live from the server, and search uses the server's index;
      - the copy rebuilds from the change feed in the background.
    - **iPhone, iPad and Mac keep a permanent copy.**
    - **Precedent (confirmed from its source):** Swiftfin keeps its store in the tvOS caches directory and reads the server live. Infuse's approach is partly unconfirmed.
91. **A new device finds the server by invite link, iCloud sync, or local-network discovery.**
    - **An invite link carries the server address.** Opened on an iPhone, it adds the server.
    - **The server list syncs across the same Apple ID's devices** through `NSUbiquitousKeyValueStore` (tvOS 9+, iOS, macOS; 1 MB total; confirmed 2026-09-28).
    - **On the same network, the app discovers the server,** as Jellyfin does with UDP 7359 (confirmed).
    - **Typing the address is the fallback.**
    - **The device then pairs by code (13).**
    - **Several servers are supported from day one.**
    - **There is no central CanonCore service.** How Plex's apps find servers after plex.tv/link is an inference (via the account's server list), not a Plex statement.
92. **The API is additive-only within a major version, and CI enforces it.**
    - **An old app keeps working with a newer server.**
    - **CI runs `oasdiff breaking`** against the last release's OpenAPI spec and fails any breaking change. oasdiff v1.32.1 detects breaking changes and has a GitHub Action (confirmed 2026-09-28).
    - **A truly breaking change bumps the major version.** The server then advertises a minimum app version, and old apps show "Please update CanonCore" instead of erroring.
93. **Each progress event carries a position suited to its medium,** in the same event log (50).
    - **Video and audio:** seconds.
    - **EPUB:** a location in the book (EPUB CFI or a Readium locator), so it survives a font-size change.
    - **Comics:** a page.
    - **"Finished" is defined per medium:** about the last 2 minutes, or the last chapter or page.
    - **Watch events also carry a source field** (the app, or an import), so a later history import (P3) fits in.
    - **Precedent:** Kavita's two-way progress sync with KOReader (its wiki, via the completeness sweep).
    - **The glossary's Progress entry is widened accordingly.**
94. **Admins are told when something fails: an in-app banner plus an iPhone push.**
    - **Covers:** failed backups, a Provider key rejected or expired, failed scans, and the host's upload allowance nearing its cap.
    - **The banner appears at the top of every app for admins.**
    - **The push goes to the admin's iPhone.**
    - **Outbound webhooks come later (project 10).**
    - **Precedent:** Plex webhooks (a Plex Pass feature, confirmed).
    - **CAVEAT, grilled in 95:** Apple push needs the app developer's APNs key, which a self-hosted server run by someone else cannot hold.
95. **Push works where an APNs key is configured; banners work everywhere.**
    - **The Owner's install holds his APNs key** and pushes to his iPhone.
    - **Other installs get in-app banners.**
    - **An optional push relay may come in project 10.**
    - **No central service now (91).**
    - The claim that Plex and Home Assistant run central push relays is from memory; verify before the ADR.
96. **Security housekeeping ships in project 1.**
    - **A SECURITY.md,** with GitHub's private vulnerability reporting switched on.
    - **Renovate** opens grouped weekly dependency updates through the affected-only CI (72).
    - **No telemetry.** The only call home is an update check against GitHub Releases, which can be switched off.
97. **Smart Orderings: a saved filter plus a sort that fills itself** (CNCORE-344 story 28).
    - **It updates as the Library changes, and cannot be hand-reordered.**
    - **Examples:** "every Star Trek episode with the Borg, by air date"; "unwatched stories with Rose Tyler".
    - **Precedent:** Plex smart collections, Navidrome smart playlists.
    - **Project 2.**
98. **Entities link to each other with a small fixed vocabulary, plus the source's own wording** (CNCORE-344 stories 14 and 15).
    - **The vocabulary:**
      - family: parent, child, sibling, spouse;
      - member of (a Group);
      - located in (a Place);
      - "other", which carries the source's own label ("companion of", "nemesis").
    - **Links are sourced and editable,** show on entity pages, and feed Smart Orderings (97).
    - **Project 2.**
99. **Friends' privacy: an admin sees live sessions only, never history** (project 3).
    - **Each account can export its own data:** its watch history and Orderings, as JSON plus the id-list format.
    - **Each account can delete itself.** Its shared Orderings are given to the admin or deleted, as their owner chooses.
    - **This departs from Plex,** which shows friends' activity to the server owner. The reason: friends' privacy.
100. **Per-account stream limits, a usage view, and a cellular warning** (project 3).
    - **Admins set per account:** the number of streams at once, plus a maximum bitrate where transcoding is on.
    - **Settings shows "Now streaming"** with each stream's bitrate, and this cycle's upload total against the host's allowance.
    - **On cellular, the app warns before playing a large file that can't be transcoded.**
    - **Precedent:** Jellyfin's per-user bitrate limits (not verified this session).
101. **Per profile: favourites, a watchlist and 1 to 5 star ratings** (project 3).
    - **Anything can be favourited:** an Item, an Entity or an Ordering.
    - **They feed home rows and filters,** and stay private to the profile.
    - **There is no recommendation engine.**
    - The competitor feature claims (Plex, Jellyfin and Infuse favourites, watchlist and ratings) are from memory; verify in the project 3 spec.
103. **The Apple app goes on the App Store (project 10), with a public demo server of public-domain content.**
    - **The demo** is fully usable without the user's own server, serves as the App Store reviewer's demo account (Review Guidelines, updated 8 June 2026), and doubles as the portfolio showcase.
    - **Constraints to respect:**
      - It must NOT run on Whatbox, whose AUP bans public video libraries. A small separate host is needed (Oracle Always Free's 200 GB fits a small demo).
      - Its metadata must avoid TMDB's "destination website" clause. Use public-domain Local metadata or Wikidata.
    - **Friends meanwhile use TestFlight.**
104. **The ease-of-use gate is the Owner's own walk-through.**
    - **Each project closes only after the Owner has walked it on his own install,** as with the old "used on the Owner's instance" rule. Stalls become tickets before close.
    - **The Owner chose this over "a real person does it unaided".**
    - **The accessibility gate (69) still applies.**
105. **CanonCore helps users compare Providers on their own Library.** This replaces the originally asked provider-choosing prototype.
    - **Before install, the Store shows coverage:** "TMDB knows 212 of your 214 Items". The figures in the example were illustrative.
    - **Item pages can show every Provider's Statements side by side (33).**
    - **The Store core arrives in project 1 (82).** Coverage and comparison are project 4, measured on the Doctor Who corpus.
106. **The README showcase starts in project 1 and grows with every project,** serving criterion 2 (impressive to a developer).
    - **Each project's close adds:**
      - a short screen recording (project 1: Rose on the Apple TV, resumed on the iPhone);
      - an architecture diagram;
      - links to the founding ADRs.

## Step 5 grill (2026-09-28, clearing the slate)

- `o.txt` (a saved BBC episode-guide page) is deleted; a copy sits in the Documents backup.
- The old trees go into `canoncore-history` as snapshot folders under `final/` on its main, not as prefixed history branches.
- Vercel and Neon are ticked on the evidence: only the unrelated `portfolio` project remains on Vercel, and the Neon deletes of 2026-09-27 stand.
- `~/canoncore/` goes to `canoncore-history` as `final/install/` without its `.env`.
- The old CLAUDE.md and `.claude/rules/` are not carried; `.claude/settings.json` is.
- An interim README sits on main until step 7's showcase; the Owner sees its wording first.
- PR #361 closes and its branch is deleted.
- **D-92 amended: a NEW GitHub repo.** The Owner: "i dont mind deleting and reconnecting". The old repo is renamed `canoncore-v0`, made private and archived; step 6's `/setup-orca-linear-project` creates the new `CanonCore`, its repo-creation step no longer skipped.
- **D-101 extended (2026-09-29): kind and area labels.** Kinds `to-spec`, `spike`, `skills-repo`; areas `server`, `web`, `swift`, `ios`, `macos`, `tvos`, and `provider-<name>` made on first use. None is a label group (Linear allows one label per group). `provider-repo` is dropped.
