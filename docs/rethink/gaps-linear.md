# Gaps: what the 469 CNCORE tickets reveal (2026-09-28)

Read-only. The sources were all 469 issues (`--include-archived`), the 6 projects, and the full text of the open and to-spec issues.

**Ranks:** P1 = "Play Rose on every device"; P2 = orderings and franchises; Later; Not needed.

## The 7 open issues

- **CNCORE-365** (the rebuild walk): superseded. Keep its two unfiled UX findings for P1:
  - connecting a provider took two steps, and the Owner stalled after the first;
  - import progress did not update until a reload.
- **CNCORE-370:** drop. Keep its lesson that a skipped suite must never look like a pass.
- **CNCORE-468 and CNCORE-469:** drop the code, keep the lessons: merge-survivor flakiness, and accents normalised on only one side.
- **CNCORE-344** (the data spec): superseded by 31 to 40. Its 45 user stories remain the best list of what the Owner asked for. Entities are not covered.
- **CNCORE-107:** KEEP, P1. Read the @reboot probe. Decision 7 relies on @reboot plus cron, and that is unmeasured, because the slot has not rebooted since 2026-09-08. (The 2026-09-28 wipe removed the probe; re-add it.)
- **CNCORE-76:** KEEP, Later (awesome-selfhosted). The clock runs from a GitHub Release. The licence must be written `AGPL-3.0`. "Media Streaming" is a redirect tag. They ban LLM-generated submissions.

## Schema

- **Entities (P2):** characters, people, places and species. Picking "a companion's timeline" needs a Character (CNCORE-344 stories 2 to 4 and 11 to 14).
- **Credits and people matching (Later):** CNCORE-362, 369, 449, 452.
- **Release dates by territory (Later):** CNCORE-359. Dropping Editions left them with nowhere to go.
- **Matching needs a confidence band, rejection memory and undo (P1 for linking files, P2 for providers):**
  - CNCORE-363 and 441: 158 of 163 automatic merges were right, and the wrong ones could not be undone.
  - CNCORE-469: accent normalisation.
- **Sorting (P1):** CNCORE-242 needs a "#" bucket, and CNCORE-446 found digit titles filling the first page.
- **Repeat against disagreement (P2):** CNCORE-90, 121 and 236. Count orderings, not placements.
- **Held properties (Later):** CNCORE-371. An unknown provider field is held, counted, then adopted or rejected.

## Providers

- **tardis.wiki (the OLD source) sits behind Cloudflare.**
  - cf_clearance dies within a day and is bound to IPv6 (CNCORE-373, 206).
  - Images return 403 (CNCORE-427, 358).
  - The rethink uses **Tardis Fandom** (tardis.fandom.com api.php) instead, which the prototype read without a challenge. But `static.wikia.nocookie.net` images are Cloudflare-challenged too, so the image path needs a check.
- **Big timelines are slow (P2):** CNCORE-151, 154, 155 and 365.
  - AHistory browse takes 25 s, and resolution runs at about 82 members a second.
  - A full import runs at about 1,700 Items an hour, dominated by picture fetches.
  - Imports must survive a lapsed credential, resume, and tell "refused" apart from "empty" (CNCORE-373, 166, 254).
- **Grants on file (P2):** CNCORE-22 and ADR-0057.
- **TMDB mechanics (P1):**
  - CNCORE-297: a 429 retry left response bodies unconsumed.
  - CNCORE-443 and 457: a `wN` rendition is scaled, so check widths on the stored file.
- **Bound every provider string (P1):** about 20 tickets (223, 445, 460, 465, 467). This belongs in the Zod schemas.
- **Story filter (P2):** CNCORE-21, 350 and 431.

## Clients and UX (P1 unless noted)

- CNCORE-243: there was no clickable route to Settings or Log out.
- CNCORE-256 (P2): the placement picker named a remedy that did not exist.
- walking-the-owners-install.md, "Eight journey problems":
  - no way in;
  - forms ahead of content;
  - reordering 2,907 by Move up and Move down (P2);
  - plumbing in titles.

## Accounts (P1)

- CNCORE-109: every RPC was unauthenticated.
- CNCORE-116: sessions never expired.
- CNCORE-117: unlimited password guesses.
- CNCORE-154: a 60 s blocking read.

Better Auth covers most of this, but rate limiting and expiry must be stated.

## Ops (P1)

- **Backups:** CNCORE-168 and ADR-0048. There is no mechanism yet.
- **Scheduled jobs:** CNCORE-119. Auto-refresh, the TMDB 6-month cache eviction and session sweeps all need a runner.
- **Whatbox:**
  - support ticket 267784 (CNCORE-81);
  - IPv4 is shared, so ports 80 and 443 are not ours (CNCORE-106);
  - load runs from 93 to 140.
- **Images must build for arm64 (Later):** CNCORE-189 and 194.

## Legal

- **CNCORE-32 (P1):** the TMDB logo must be shown.
- **CNCORE-130:** two sources' licence notices collapsed into one.
- **CNCORE-358:** picture licence and credit per file.
- **CNCORE-38 (Later):** AGPL and provider conduct.

## Testing lessons (P1)

- **Mutation-check new tests:** CNCORE-257, ADR-0168 and CNCORE-378.
- **A skip must never read as a pass:** CNCORE-160 and 370.
- **CI truthfulness:**
  - a rebased PR showed the old head's green (CNCORE-288);
  - a job killed by its own timeout reported PASSED (CNCORE-342).
- **Every job needs a timeout:** CNCORE-219.
- **Shared fixtures flake:** CNCORE-93, 253, 271, 464 and 468.
- **Leaks:**
  - temp dirs (CNCORE-336: 7,547);
  - worktree databases (CNCORE-231: 1,135, 10 GB).

## Process

- About 90 self-referential tickets are Not needed: record the pattern, don't port them.
- **Carry forward:**
  - a count checked against the same stored value proves nothing (CNCORE-434);
  - walk the rendered page before merging;
  - the Owner answers agents' questions (CNCORE-387, 420).
- **Groups** (CNCORE-178 to 182, 356, 376) map to franchises. "A Group fills from a rule" and "an Item in several" are not re-decided.
