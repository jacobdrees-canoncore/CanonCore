# Every gap item, reconciled against grill-decisions.md (2026-09-28)

**Sources:**
- OS = gaps-old-schema.md
- DA = gaps-docs-adrs.md
- LN = gaps-linear.md
- CM = competitor-data-models.md

**Buckets:**
- D = decided
- DIP = decided in principle; the detail goes to a named spec
- L = a later project
- X = dropped
- O = still open (grilled in round 1 below)

## Result

About 100 items in total. Every one is D, DIP, L or X, EXCEPT the 12 still-open questions grilled in round 1.

## DIP: detail owned by a spec

**Project 1 spec:**
- table layout per level;
- field list and priority display;
- artwork kinds, sizes and expiry;
- language codes;
- the matching confidence band;
- CMPP wire shapes, paging and errors ("refused" against "empty");
- the proposal diff format;
- TMDB mechanics (429 bodies, wN widths);
- string ceilings in Zod;
- the probe tool (ffprobe) and truncation check;
- the session capability declaration;
- Continue Watching rules;
- the bandwidth budget;
- delete preview and undo;
- the 60 s blocking read;
- the @reboot measurement;
- macOS CI cost;
- temp-dir leaks.

**Project 2 spec:**
- serial and two-parter grouping (re-measure 154/159);
- minimum fields per non-video kind;
- an Item in several franchises;
- placement storage and reorder by delta (2,907 entries);
- person matching, thresholds and the labelled set;
- qualifiers beyond incarnation;
- stripping plumbing from titles;
- resumable big imports;
- the story filter;
- the Tardis Fandom image path;
- per-source notices and per-file picture licence;
- labelled match sets and TMDB expiry;
- the CNCORE-344 user stories as input.

**Design prototype (64):**
- tvOS curation focus;
- entity pages;
- the "Also in" cap;
- home hubs;
- the Settings and logout route;
- remedy copy.

**Project 3 spec:** per-user permissions, and enforcing private orderings. Decision 34 overturns ADR-0072; the founding ADR must name that.

## Later

- Dubs and narrations (5, 6). Note: the default AUDIO track language in project 1 is uncovered, because 49 is subtitles only.
- Music work against recording (5).
- Audio drama and podcast hierarchies (5).
- Watchlist, password recovery, kids rating (3).
- arm64 (10).
- TMDB's destination-website clause and a public demo (10).
- The Cover Art Archive API licence (5).
- awesome-selfhosted (10).

## Dropped

- Held properties: the strict schema means providers return CanonCore shapes.
- About 90 self-referential tickets.
- The old ADRs superseded by new decisions. Editions are partly RESTORED by 31a.
- Live TV, SyncPlay, cloud storage, OPDS and Subsonic.

## Needs /verify

- **TMDB:** the 6-month ceiling, the notice and logo, the destination clause, the rate limit and 429s.
- **Better Auth:** "never lockout", and passkeys and 2FA on SQLite with Kysely.
- **Whatbox:** that @reboot fires, the plan's upload allowance, and whether authenticated traffic counts.
- **CI and backups:** the macOS runner multiplier, B2's free tier.
- **Competitor claims:** the licences of Jellyfin, Audiobookshelf, Navidrome and Immich; Plex and Emby partial hashes; X-Plex-Token and api_key in URLs; Picard and beets rejection memory; how Plex handles a multi-episode file.
- **Tardis Fandom:** the Cloudflare challenge on `static.wikia.nocookie.net`.
- **Story Order:** 154/159.
- **Tooling:** Node 26 LTS on 2026-10-28; XCUITest accessibility audits.
- **awesome-selfhosted rules.**

## /verify results (2026-09-28)

5 contradicted, 3 unfounded, 1 skipped, 17 confirmed. Every correction is applied in grill-decisions.md, in the sentence it corrects.

- **Contradicted:**
  - Whatbox counts CanonCore's traffic;
  - Better Auth's 2FA locks by default;
  - Better Auth limits per IP and path, not per account;
  - macOS CI is free, not multiplied;
  - Story Order is 156 groups, not 154/159.
- **Unfounded:**
  - Plex's and Emby's partial hashes (so 51 is our own design);
  - Picard's rejection memory;
  - beets is partial (skipped directories only).
- **Skipped:** that @reboot fires. It needs a real reboot; the probe is re-added.
- **Confirmed:**
  - TMDB's 6-month ceiling, logo, notice, destination clause, and ~40 req/s with 429s;
  - passkeys and 2FA on SQLite through Kysely (docs only);
  - B2's 10 GB free tier (enough for the database, not for media);
  - Node 26 LTS on 2026-10-28;
  - the XCUITest accessibility audit (iOS 17, tvOS 17, macOS 14);
  - the four competitor licences;
  - X-Plex-Token and api_key in URLs;
  - Plex plays the whole multi-episode file;
  - the Tardis Fandom images return 403 behind a Cloudflare challenge WITHOUT a Referer, and 200 WITH `Referer: https://tardis.fandom.com/` (measured from Whatbox and the Mac, 2026-09-28; decision 80);
  - the awesome-selfhosted rules: they moved to awesome-selfhosted-data, the listing must be human-made, the licence is `AGPL-3.0`, and media-streaming is a redirect tag.
