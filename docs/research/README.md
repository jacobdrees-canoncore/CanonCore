# Research

The evidence behind `docs/adr/`. Committed rather than deleted, and that is a decision taken
twice: a plan to delete all of this once the spec proved itself was falsified both times it was
tested. A 2026-09-09 supersession check found **29 things** living only here, including a file
containing a decision that forbade its own deletion.

Decisions live in `docs/adr/`. Vocabulary lives in `/CONTEXT.md`. This directory holds the
lookups those rest on, so a reader who doubts an ADR can check it rather than take it on trust.

## The passes, newest first

| Directory / file | What it is | Lines |
|---|---|---|
| `parallel-agent-substrate.md` | **What the substrate lies about under parallel agents**, 2026-09-13, for CNCORE-134. The three defects in the brief are one defect: a machine-global namespace addressed by code that thinks it is worktree-local. Found a **fourth and worse instance** — the turbo cache is shared across every worktree, so a green can be replayed from another worktree's run — and a **second package** replaying stale against the install path. Postgres costs **1.67 MB per connection** measured, so 300 fits the 1.96 GiB VM; the ceiling on agents is **2**, and it is Postgres connections that binds. CNCORE-126's own measurement is shown to test something that cannot fail: the real cause is that macOS never reuses an ephemeral port in 500 binds and Linux repeats by the 59th. Two of its own claims were killed in review and the corrections are in the body, including a CI margin that a passing build falsified. | 652 |
| `ci-and-repo-standards.md` | **CI speed and the three-repo standard**, 2026-09-11. Found the pipeline is not slow (74s median) and the Actions allowance is: the 2,000 free minutes cover **8.1 runs a day**, and a $0 budget stops CI rather than billing. Job COUNT is the cost unit, because GitHub rounds each job up to a whole minute. Eleven proposals, **all decided the same day** — §10 carries the outcomes and the eight corrections the grilling forced back into the body. | 1,419 |
| `verify-adr-login-bound.md` | **What bounds a wrong password, in four products**, 2026-09-12, for CNCORE-117 and ADR-0125. Jellyfin locks the ACCOUNT and the remedy is two `UPDATE`s against `jellyfin.db`; Audiobookshelf rate-limits per IP in memory at 40 per 10 minutes and counts successes too; Immich does nothing in-app by maintainer decision; Nextcloud delays then refuses. Six received claims contradicted, Jellyfin's "3 for users, 5 for admins" and its being on by default among them. | 1,033 |
| `verify-adr-*.md` | **The audit trail.** 246 claims from the 72 ADRs put back to the sources that own them, 2026-09-10. 35 contradicted, 15 unfounded, 11 judgement. No decision was falsified; the failures were citations, numbers and mechanisms. Four files, split by owner: Plex, Jellyfin, standards, other products. The 2026-09-12 login-bound pass above matches this glob and is its own row rather than part of this one. | 7,826 |
| `resolution/` | For every internal contradiction and Tier A gap: what Plex does, what Jellyfin does, what the standards say. **Complete** — all 24 items. This is what the ADRs were argued from. | 8,048 |
| `competitor-sweep/` | A complete pass over Plex and Jellyfin: 1,187 pages plus the Jellyfin source at a pinned commit, every URL enumerated from the sites' own sitemaps so coverage is provable rather than asserted. `CONSOLIDATED-FINDINGS.md` is the output. | 18,616 |
| `supersession-check.md` | Whether four superseded files could be deleted. Answer: none of them, and here are the 29 losses. Three have since been rehoused and deleted; the forensic record was kept. | 836 |
| `build-order/` | Ten comparable self-hosted projects: real build order from git history, first-release contents, when clients arrived, what killed the ones that died. | 1,470 |
| the forensic record | **The one row that is not in a public checkout**, and the only one named rather than pathed: ADR-0114 keeps it in the private repository, so a public tree has every other row and not this one. The original research dump — **not** a duplicate of anything, but the evidence base plus the account of nine prior attempts, and the supersession check verified that eleven of fourteen tested strings return it alone. | 3,701 |
| `plex-schema-dumps/` | Four dumps of Plex's schema. See its own README for the trap: three of the four are table-name lists with no column definitions. | 683 |
| `supersession-check-2.md` | The same check on `tier3-vocabulary.md` and `build-order/sections/`. Both are now deleted: the sections were proven line-by-line to be a strict subset, and the vocabulary file's two unique items were carried first. | 389 |

## Citations to files that no longer exist

Several documents here cite `decisions.md`, `HANDOFF.md`, `GRILL-DECISIONS.md` or
`harry-potter-pass.md` by name and line. Those files were deleted on 2026-09-09 and 2026-09-10,
each only after its unique content was carried into `SPEC.md`, `CONTEXT.md` or an ADR.

`SPEC.md` has itself since been retired, on 2026-09-10, by the same method: `supersession-check-3.md`
inventoried what only it carried, all 40 items were rehomed into `docs/adr/`, `CONTEXT.md` and
`CLAUDE.md`, and its column lists became `docs/physical-schema.md`. Files here that cite `SPEC.md` by
name are accurate about the state of the repo when they were written; they are not stale pointers to
fix.

`docs/physical-schema.md` is one link further along the same chain, retired on 2026-09-10 when
CNCORE-4 landed migration 1 — which is exactly what that file's own header said would happen to it.
The schema is now `packages/db/src/schema/`, and the Drizzle schema file is the authority the column
list never claimed to be. `validate-cncore-4-5.md` and `audit-new-adrs-internal.md` cite it by line;
they are dated evidence, not stale pointers.

The citations are left as they were written. Editing research to match a later deletion would
falsify the record of what was known when. To resolve one, use git history — or read
`supersession-check.md` and `supersession-check-2.md`, which record exactly what moved and where it
went.

## The fetch recipes, which are not obvious

- **Plex support docs**: plain `curl -s "https://support.plex.tv/articles/<slug>/"`. No User-Agent,
  and not WebFetch. The 403s an earlier session hit were a network-level block, not Plex.
- **Plex forums**: append `.json` to a topic URL. That also exposes `staff` and `moderator` flags,
  which is how the "published by a Plex engineer" claim was found to be unfounded.
- **Jellyfin source**: `gh api repos/jellyfin/jellyfin/contents/<path>`. Do not clone; an agent
  stalled doing that.
- **loc.gov** returns 403 to everything. Use web.archive.org for MARC.

## What is NOT here

`~/tardis-pipeline` (3.2G) — the local archive of the independent Tardis Wiki, collected with
permission. It is the test fixture and the owner's own library seed. It stays outside this repo and
is never vendored in. Query it; do not copy it.
