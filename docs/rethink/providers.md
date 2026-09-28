# Providers: the free standard set, with the Doctor Who layer on top (research, 2026-09-28)

The Owner's rules:
- A STANDARD set per medium, like the competitors, with franchise sources on top.
- NO PAID providers.
- Every medium is playable.

Four researchers each read their providers' own terms, docs and pricing on 2026-09-28, and ran small live measurements.
- **F** means checked at the owner or measured.
- **J** means judgement.
- **U** means unverified.

## The recommended free set (J), per medium

| Medium | Primary | Secondary | Local files (read, never written) |
|---|---|---|---|
| **Film and TV** | **TMDB**: items, images, film collections, TV episode groups including Story Order. Ship the project's key with an optional per-user override, as Jellyfin and Kodi do | **TVmaze** (CC BY-SA, keyless, TV cross-check); **fanart.tv**, opt-in and flagged (no image licence); **TheTVDB** only if its free tier is confirmed for self-hosting | Kodi **NFO**; `poster.jpg` / `fanart.jpg` / `season N-poster.jpg` / `clearlogo.png`; filename id hints `{tmdb-…}` and `[tmdbid-…]` |
| **Music and audio** | **MusicBrainz** (identity, release groups, **series with ordering**, "Audio drama" type) + **Cover Art Archive** | **Wikidata**; **Discogs monthly CC0 dumps** (not the API); **AcoustID + Chromaprint** for untagged files; **Deezer** as a keyless art fallback | Embedded audio tags, including `series`/`series-part` with several series separated by `;` |
| **Books and audiobooks** | **Local metadata first** (EPUB OPF `belongs-to-collection`, M4B tags and chapters); **Open Library** (API ≤1 req/s with a contact UA, plus dumps); **Wikidata** (series and ordinals, better than Open Library for Doctor Who) | **Hardcover** (free token, server-side); **AudiobookDB** (free, personal use; check its derivative-works clause); **iTunes Search**, display only | EPUB OPF (calibre and EPUB 3.3 collections), M4B chapters |
| **Comics** | **Metron** (CC BY-SA 4.0; **ordered, typed, source-attributed reading lists**; crosswalks to Comic Vine and GCD) | **GCD** CC BY-SA dump; **Comic Vine** opt-in with the Owner's own key (non-commercial, "no redistribution in other formats") | **ComicInfo.xml** (`StoryArc`/`StoryArcNumber` become placements), **CBL** reading lists |
| **Identity across all media** | **Wikidata** QID as an optional BRIDGE, never the primary key. Every provider id is stored as a sourced statement | Providers' own cross-ids at episode and issue depth (Metron `cv_id`/`gcd_id`, TMDB external ids) | Filename id hints |

**The Doctor Who layer on top:**
- **Tardis Fandom**: timelines and story facts. Permission granted.
- **TARDIS Guide**: API BETA ACCESS GRANTED on 2026-09-28 (Shaun Robinson, 16:46: "I've added access to the API beta!"), for the Owner's Bronze Patron account **Jacobrees**. It was granted after the Owner's first email described CanonCore and asked to use the data. No separate written "yes" to CanonCore use: use is implied by the grant, and can be confirmed with Shaun. Shaun has added sets, playlists and prerequisites to the API. The key is created under My Account → API and stored in `~/.config/canoncore/`.
- **Big Finish**: see the dedicated section below.

## Avoid (F, with the reason)

- **OMDb**: CC BY-NC content, posters for patrons only, apparently unmaintained since 2019.
- **IMDb datasets**: the terms forbid building a database from them. Store the ids only.
- **Trakt**: app creation NO LONGER needs VIP. trakt-api PR #945 was MERGED on 2026-09-23 and requires a verified GitHub account instead (corrected 2026-09-28; see history-in-out.md). The draft API policy (#941, open) explicitly permits a personal or self-hosted tool that syncs the user's own activity. It auto-deletes an app after 30 days unused. Re-decided in the history question.
- **MDBList**: its useful volume is in paid tiers.
- **Spotify**: needs Premium for the app owner, has a 5-user ceiling, and bans databases.
- **TheAudioDB**: apps need an $8 Patreon.
- **Apple Music API**: needs a paid developer programme (U). The Owner has one, but it is not a free provider for users.
- **Last.fm images**: excluded from its terms.
- **Discogs live API as stored data**: its 6-hour staleness rule conflicts with keeping every value.
- **Google Books as a stored source**: no permanent copies, plus branding duties. Live lookup at most.
- **Audible / Audnexus as a primary source**: an undocumented API, scraping, and device credentials.
- **Goodreads**: closed to new keys.
- **StoryGraph**: no API.
- **ISBNdb**: paid.
- **League of Comic Geeks**: no API.
- **Marvel API**: dead (the gateway returned 500).

## Big Finish, and "our own version" (the Owner's lead: abs-agg)

- **abs-agg** (AGPL, active, 16 providers) covers Big Finish well: range, release number, cast, duration, cover.
  - But it POSTs to `bigfinish.com/api/search` with a **spoofed Chrome User-Agent**, and **robots.txt has `Disallow: /api/`**.
  - It then parses the release pages' Next.js payload. It broke and was fixed on 2026-07-19.
- **Big Finish has no official API.** Its T&Cs, section 5, say its Information is for "the personal purposes of the User" and may not be used for "publication, reproduction, or transmission without the express written permission of BFP".
  - robots.txt ALLOWS `/releases`, `sitemap.xml` (about 1,083 release URLs; another count says 4,214 total URLs), `news.xml` and `podcasts.xml`.
- **MusicBrainz** has 2,796 Big Finish releases and 790 Doctor Who audio-drama release groups, and a "Monthly Adventures" series.
  - Its numbering tops out at 259 of 275 and is messy.
- **Recommendation (J):**
  - **Build our own small Big Finish provider.** It discovers releases from `sitemap.xml`, never from `/api/`, fetches release pages slowly with an honest User-Agent, and caches one page per release. It is AGPL-compatible, so abs-agg's parser can be learned from.
  - **And ask Big Finish for written permission.** Serving to invited users is arguably "transmission".
  - Until then, layer it under already-permitted sources (Tardis wiki/Fandom ranges and numbers, and the tags on the Owner's own purchased downloads, which are U).

## Corrections to earlier notes (F)

- **TheTVDB is not "paid per user" across the board.** Its API page says free under $50k/year with attribution. Its own v4 README says end-user apps need a contract or a $12/yr PIN per user. The two pages contradict each other (U).
- **Trakt's limit is now 500 GET per 5 minutes**, not 1,000.
- **fanart.tv's terms have now been read.** "All copyrights are retained by their respective owners". The CC BY 3.0 on api.fanart.tv covers the API spec, not the images.
- **The Eleventh Hour novelisation** is a photo novelisation, not a Target book, per a search result (U).

## Measured highlights (F)

- **TVmaze:** Doctor Who 2005 (id 210) lists 254 episodes, 101 of them non-regular. 25 back-to-back searches all returned 200.
- **Wikidata:**
  - Doctor Who's 905 episode items: 903 have an IMDb id, 179 a Tardis Fandom id, 61 a TVDB id and 19 a TMDB id. Strong for works and series, weak for episodes.
  - New Series Adventures: 55 of 55 with an ordinal. Big Finish: 170 items, 108 with ordinals.
  - Comics: only 4 Doctor Who items with a Comic Vine id.
- **Open Library:** 36 works across all Doctor Who series have series data. The Target Rose and Doctor Who and the Daleks are present.
- **Comic Vine:** the Titan Doctor Who volumes are present (e.g. The Twelfth Doctor 2014, 4050-77596).
- **CBL reading lists:** 2,115 lists, none of them Doctor Who. The repo has no licence.
- **Marvel API:** the gateway returned 500. It is dead.

## Unverified (U)

- Whether a free Trakt account can create an app today (needs a login).
- TheTVDB's free tier across all installs, and its rate limits.
- Whether TMDB permits a key in public code (its terms are silent; the norm is to ship one).
- Google Books' quota with a key.
- Hardcover's Doctor Who coverage.
- Metron's and GCD's Titan coverage (both are behind bot walls).
- Whether Comic Vine arc issues carry an order.
- Deezer's numeric quota.
- Cover-image copyright (Cover Art Archive, Metron, Comic Vine: copyrighted with no licence, but the ecosystem displays them).
- Whether CC BY-SA share-alike reaches a private self-hosted cache (J, not legal advice).
- What Big Finish's download tags contain.

## Sources

Each researcher's full report, with URLs, is in the session. The key owner pages:
- TMDB: themoviedb.org/api-terms-of-use
- TVmaze: tvmaze.com/api
- TheTVDB: thetvdb.com/api-information and github.com/thetvdb/v4-api
- fanart.tv: fanart.tv/terms-and-conditions
- Trakt: developer.trakt.tv guides; trakt-api #897 and #943
- MusicBrainz: musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting and /doc/About/Data_License
- Cover Art Archive: coverartarchive.org
- Discogs: support.discogs.com (Wayback 2026-05-30)
- Deezer: developers.deezer.com/termsofuse
- Open Library: openlibrary.org/developers/api
- Hardcover: the hardcover-docs repo
- AudiobookDB: its terms (effective 2026-05-25)
- Comic Vine: comicvine.gamespot.com/api
- Metron: github.com/Metron-Project/metron (`api/RATELIMIT.md`, `reading_lists/models.py`)
- GCD: github.com/GrandComicsDatabase/gcd-django
- Wikidata: wikidata.org/wiki/Wikidata:Licensing and the WDQS user manual
- Big Finish: bigfinish.com/robots.txt, /sitemap.xml and /pages/v/terms-conditions
- abs-agg: github.com/vito0912/abs-agg (`src/providers/bigfinish/index.ts`)
- Formats: Kodi NFO (xbmc `VideoInfoTag.cpp`), Plex NFO support article, ComicInfo (anansi-project), EPUB 3.3 (w3.org/TR/epub-33)
