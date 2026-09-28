# Audit: decisions 14 to 23 and 21a (2026-09-28)

**F** means read at the owner, and **J** means judgement. The corrections are applied in `grill-decisions.md`.

## At risk: to be re-decided

- **19, comics.** Every competitor uses Comic Vine: Mylar3, Kapowarr, Komf, Calibre-web and Booklore (F). None fetches from Metron or GCD, and Mylar3 closed its Metron request as not planned on 2026-02-28 (F). Metron also needs each install's own account.
- **15, TheTVDB.** It was wrongly excluded.
  - Plex's default agent, Emby and Jellyfin's official plugin all use it (F).
  - Jellyfin ships a project key and makes the user's PIN optional (F).
  - TheTVDB says it is free under $50k/yr with attribution (F).
- **18, AudiobookDB.** Its terms require a licensing agreement for programmatic access, and its API licence excludes covers and descriptions (F).

## Standard sources the competitors use that our set lacks

- TheTVDB and Comic Vine (above).
- ListenBrainz, which is in Navidrome's defaults and bundled with Jellyfin (F).
- OMDb (Jellyfin, Emby) and Google Books (Audiobookshelf, Calibre-web, Booklore). Both are deliberately excluded, and the reasons stand.

## Confirmed

- **TMDB key:** Jellyfin and Kodi both commit their key.
- **TVmaze:** a Jellyfin plugin.
- **fanart.tv:** Jellyfin and Kodi commit a project key plus an optional personal key.
- **MusicBrainz:** 1 req/s with a contact User-Agent.
- **Last.fm:** its terms exclude images.
- **Big Finish:** robots.txt still disallows `/api/`, and the sitemap is live.
- **Open Library:** 1 req/s anonymous, 3 req/s identified.
- **Hardcover:** in beta, 60/min, 5,000/day, and the token is kept secret.
- **Metron:** 20/min and 5,000/day per user.
- **Nominatim:** the limits sum across all users.
- **OpenFreeMap:** no SLA.
- **Olaf:** AGPL-3.0, release 3.2.2, built with Zig.
- **Store precedents:** Plex, Stremio (no review) and Jellyfin (checksums plus an unlisted-repo warning).
