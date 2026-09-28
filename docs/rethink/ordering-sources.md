# Ordering sources for any franchise (research, 2026-09-28)

**Verify result:** 3 contradicted, 5 unfounded, 24 confirmed, 4 judgement.

## Corrections to what we assumed

- **Kometa removed Trakt** in v2.4.9 (logged under v2.5.0, 2026-09-21), after Trakt blocked MDBList and SIMKL. Trakt's draft API policy (#941) bans mirroring lists.
- **Trakt API apps are no longer VIP-only.** PR #945, merged 2026-09-23, requires a verified GitHub account instead. A personal self-hosted tool using the user's own account is allowed.
- **Memory Alpha is CC-BY-NC.** Wookieepedia and the MCU wiki are CC-BY-SA.

## Competitors

- **Plex:** manual collections can be dragged into order. Episode Ordering offers TMDB aired, or TVDB aired, DVD or absolute.
- **Jellyfin:** box sets sort by premiere date. Playlists are ordered, shareable, and imported from m3u/wpl/zpl. The TMDb Box Sets plugin builds franchise collections.
- **Infuse:** TMDB collections are on by default, and custom collections can mix films, series and seasons.
- **Kometa is the nearest precedent.**
  - Its **Franchise** defaults use TMDB collections in release order.
  - Its **Universe** defaults (17: MCU, Star Wars, Star Trek, Arrowverse, Middle Earth, Wizarding World, Conjuring...) and its **"(Timeline Order)" playlists** come from curated IMDb and MDBList lists, ordered `custom`.
  - The order is whatever a stranger's list says.

## Free structured sources

- **TMDB:**
  - Collections give membership, ordered by release.
  - v4 lists can be public or private, sorted by the owner, including `original_order`.
  - Episode groups have 7 types, including story arc, with an explicit order.
  - Non-commercial use, attribution, and a 6-month cache limit.
- **TheTVDB:** season types (official, dvd, absolute, alternate, regional, altdvd) and ordered user lists.
- **Wikidata:** CC0, no key.
  - MCU: 85 works, 41 with an ordinal. Star Wars: 62 works, only the 9 saga episodes with an ordinal.
  - **It holds release and numbering order only, never an in-universe chronology.**
- **Fandom:** api.php needs no key, but each wiki's timeline page has its own format.
  - Wookieepedia uses `{{MediaRow}}` templates.
  - The MCU wiki uses a raw wikitable.
  - Memory Alpha has no watch order.
  - One generic provider with **a small adapter per page format** (J).
- **MDBList:** free key, 1,000 requests a day, community timeline lists (Kometa relies on it).
- **AniList:** no key, 30 requests a minute, typed relations (not a total order).
- **Metron:** ordered reading lists.
- **MusicBrainz:** ordered series.
- **Avoid:**
  - IMDb: scraping forbidden.
  - Letterboxd: no API for personal projects.
  - Trakt: its policy is hostile to mirroring.

## User-made orderings

There is no interchange standard. The de facto format is an ordered list of IMDb, TMDB or TVDB ids: Kometa's `text` builder (v2.5.0) (J).

## Recommendation (J)

- **"As broadcast":** TMDB collections, episode groups and v4 lists, plus TheTVDB's alternate orders.
- **"As a timeline":**
  - Fandom, per wiki with an adapter per page format. It is the only free in-universe chronology.
  - MDBList community timeline lists.
  - The Owner's private Tardis `Theory:Timeline` and TARDIS Guide.
- **Native format:** an ordered id-list import and export, the same shape as Kometa's `text`, so anyone can build and share an order.
