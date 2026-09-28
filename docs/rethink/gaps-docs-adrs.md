# Gaps: what the 193 ADRs, research and docs cover that the grill does not yet settle (2026-09-28)

Ranks: P1 = project 1, P2 = project 2, L = later, N = never needed.

**Read:** the lead paragraphs of all 193 ADRs, the full text of about 45 ADRs, docs/demo.md, docs/agents/*, and about 13 research files including the competitor sweep.

**Not read in full:** the verify-*, validate-*, supersession-check* and ci-* audits.

## Schema

The detail is in `gaps-old-schema.md`.

- **P1:**
  - typed hierarchy levels;
  - specials and renumbering;
  - progress on the Item or the File (ADR-0020);
  - file identity as a content hash (ADR-0023);
  - one file covering several episodes (ADR-0021);
  - extras (ADR-0087);
  - **a change sequence and tombstones on every table, so the Swift clients can cache a delta (ADR-0075).**
- **P2:**
  - serial against episodes: TMDB's part 1 carries the story title for 132 of the 1963 stories, and Story Order maps 154 of 159;
  - entities;
  - adaptations;
  - the relation vocabulary;
  - what a franchise is, and whether Group survives (ADR-0010, 0202);
  - timeline entries with no Item;
  - repeats (ADR-0009);
  - placement rank (ADR-0017);
  - credits (ADR-0070).
- **L:**
  - language and country (ADR-0090, 0091);
  - EDTF dates (ADR-0073);
  - extent and coverage (ADR-0060, 0082, 0088);
  - held properties (ADR-0029).

## Providers

- **P1: the CMPP operations are undefined:** search, lookup, browse and propose (ADR-0033). 21a only fixes the transport and the manifest.
- **P1: the shape of a proposal:** is it a diff, and are rejections remembered? ADR-0027: "Almost nothing remembers rejections".
- **P1: outbound URL safety (ADR-0034):** an allowlist for configured hosts and a deny-list for returned URLs. This is live on day one, because anyone can paste a provider URL. Tailscale and loopback URLs are refused silently (access-layer.md §5.3).
- **P1: store artwork bytes and expire them on read (ADR-0037, 0038):** the TMDB 6-month ceiling, and a purge on termination (resolve-X7-X13.md X9).
- **P2: matching:**
  - measured by precision and recall over labelled no-match rows (ADR-0028);
  - merge and undo (ADR-0040);
  - fix-match (sweep G9, G25).
- **P2: provider limits and credentials:**
  - caps per kind of question and bounded failure reasons (ADR-0130, 0123);
  - credential declaration, and skipping a job when one is missing (ADR-0122, 0139).
- **P2: polite crawling:** one request at a time, and honour Retry-After.
- **P2: strip source plumbing from titles** ("(TV story)", "Theory:").

## Playback

- **P1: subtitles.** AVPlayer plays no SRT or PGS. SRT to WebVTT conversion, forced and SDH tracks, and default track selection are undecided.
- **P1: the probe tool** (ffprobe or MediaInfo, ADR-0042), and truncation detection: MediaInfo exits 0 on a corrupt file.
- **P1: a session's capability declaration** picks between direct play and remux (ADR-0043).
- **P1: watch events are an append-only log,** reported every 10 s (ADR-0019).
- **P1: completion is time remaining,** and unknown when the duration is unknown (ADR-0085).
- **P1: Continue Watching** has no time window and excludes extras (R9, ADR-0087).
- **P1: the bandwidth budget is the file's own bitrate.**
- **L:**
  - Up Next and auto-advance;
  - intro and credit skip;
  - trickplay;
  - chapters;
  - iPhone offline downloads;
  - casting.

## Clients and UX

- **P1: how AVPlayer's HLS segment requests are authenticated.** ADR-0108 uses one session cookie with no token in any URL, while decision 26 adds bearer tokens. These must be reconciled (access-layer.md §2.4).
- **P1: the tvOS focus design for curation.**
- **P1: mark watched and unwatched by hand** (G28).
- **P2:**
  - listing caps, walked past for 603-entry timelines (ADR-0119, 0133);
  - "Also in" cut at five placements (ADR-0143);
  - reorder by delta (ADR-0116);
  - delete previews and remove with undo (ADR-0046);
  - thin entity pages (ADR-0204).
- **P2: catalogue search.** pg_trgm went with Postgres, and SQLite's replacement (FTS5?) is unchosen.
- **L:**
  - home hubs;
  - accessibility;
  - localisation;
  - spoiler control;
  - watchlist.

## Accounts

- **P1: login throttling.**
  - ADR-0125 measured 70,299 guesses a second, and there is no tailnet in front of Whatbox.
  - Better Auth's limiter has to meet "rate, never lockout". Jellyfin's lockout can lock out the only admin.
- **P1: passkeys and 2FA** need one stable HTTPS domain.
- **L (project 3):**
  - password recovery;
  - per-user permissions;
  - a content-rating field for kids profiles;
  - how a private ordering is enforced. Decision 34 silently overturns ADR-0072 ("no visibility system").

## Ops

- **P1: the deploy path to Whatbox,** and how upgrades run.
- **P1: migration policy:** forward-only, a version floor, backup before migrating, and refuse to start (ADR-0047).
- **P1: a missing file reads as Offline, never deleted.** Jellyfin deletes rows during a storage blip.
- **P1: what triggers a scan.** File-change notifications fail on network mounts (ADR-0050).
- **P2: back up SQLite off-vendor** (ADR-0048, restic). A seedbox can be suspended within 24 hours. This is the sweep's most repeated finding (G12).
- **P2: a visible task registry** for refreshes and TMDB eviction (ADR-0049).
- **L:**
  - a log bundle;
  - a health endpoint;
  - Node LTS: Node 26 becomes LTS on 2026-10-28 (ADR-0112);
  - mDNS discovery.

## Process

- **P1: "used on the Owner's instance"** (ADR-0132) is not yet a standing rule.
- **P1: tests fail when their behaviour is deleted** (ADR-0168), and CI is evidence only for its own commit (ADR-0181).
- **P1: CI for the Swift app.** macOS runners bill at a multiplier; verify it.
- **L:** the release cadence (ADR-0001), and the archive mechanics.

## Testing

- **P1:** a SQLite file per worktree, and the fixture strategy.
- **P1:** how the SwiftUI app is tested.
- **P2:** labelled match sets expire under TMDB's 6-month limit.

## Legal

- **P1: the licence of the new code.** AGPL (ADR-0113) and non-commercial (ADR-0100) are not restated, and non-commercial use is what satisfies TMDB and the Cover Art Archive.
- **P1: TMDB's verbatim attribution notice and logo** (ADR-0036). ADR-0035 "ship no API keys" is reversed by decision 15 without being named.
- **P2: which Tardis wiki.** The old work used tardis.wiki, with permission granted. The grill uses Tardis Fandom. (The Owner says both grants stand; don't re-ask.)
- **L:**
  - TMDB's "destination website" clause;
  - the licence of the Cover Art Archive's live API;
  - whether a public demo exists (ADR-0094).

## Deliberately dropped (N)

- **Replaced by new decisions:**
  - ADR-0041 (direct play only): replaced by 2, 7 and 12b.
  - The old build order (ADR-0054, 0055, 0115, 0152): replaced by R1 and R2.
  - ADR-0044 (one owner): replaced by 13 and 26.
  - ADR-0025 (global source order): replaced by 33.
  - Containers (ADR-0004) and editions (ADR-0011, 0064, 0065, 0092): replaced by 31 and 32.
  - Wiki first (ADR-0069, 0129, 0205): replaced by 15.
  - Postgres and Drizzle (ADR-0109, 0102, 0104, 0120): replaced by 7 and 25.
- **Dropped with nothing replacing them:**
  - ADR-0137: the 8,052-Item design size.
  - ADR-0121: two-step provider setup.
  - Next.js mechanics.
  - ADR-corpus policing.
  - Worktree and dispatch machinery.
- **Refused by competitors and still not needed:**
  - live TV and DVR;
  - SyncPlay;
  - cloud storage;
  - OPDS and Subsonic.
