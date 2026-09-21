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
| `ci-path-filters-and-the-skipped-verdict.md` | **Path filters, and what a skipped job is evidence of**, 2026-09-21, for CNCORE-341. A re-test of `ci-and-repo-standards.md`'s standing rejection, which **survives**. Three of the ticket's premises are refused by measurement, the load-bearing one being "nothing is ever skipped" — something is skipped on **every** pull request. Compute is worth **zero** here (public repo, ADR-0111), the runner cap binds at 20 but costs ≤50s, and the real path-filter prize is **8.5 minutes per ten days**. The gate needs no repair for `skipped`: a cascade skip always arrives beside the failure that caused it, measured on a purpose-built probe where the two skip causes proved **byte-identical**. Two findings the ticket did not ask for: **one test file is 72% of the e2e suite and the long pole of the critical path**, running twice per run for 274s; and a **NOT-ESTABLISHED** suspicion that `gate.sh` passes a job killed by its own `timeout-minutes` — GitHub documents the ceiling as cancelling the job but never states the conclusion, and says "fails" elsewhere, so §10.1 says what would settle it. Memory-versus-lookup: the path-filter diff limit is **3,000 files, not 300**. | 793 |
| `parallel-agent-substrate.md` | **What the substrate lies about under parallel agents**, 2026-09-13, for CNCORE-134. The three defects in the brief are one defect: a machine-global namespace addressed by code that thinks it is worktree-local. Found a **fourth and worse instance** — the turbo cache is shared across every worktree, so a green can be replayed from another worktree's run — and a **second package** replaying stale against the install path. Postgres costs **1.67 MB per connection** measured, so 300 fits the 1.96 GiB VM; the ceiling on agents is **2**, and it is Postgres connections that binds — **since 4**, CNCORE-137 having bounded the demand rather than raised the ceiling again. CNCORE-126's own measurement is shown to test something that cannot fail: the real cause is that macOS never reuses an ephemeral port in 500 binds and Linux repeats by the 59th. Two of its own claims were killed in review and the corrections are in the body, including a CI margin that a passing build falsified. Two more were reversed by the tickets that implemented them, each corrected in the sentence it appears in: CNCORE-137 measured the agent ceiling at **4** rather than the 5 this note estimated, and CNCORE-138 found the shared turbo cache is a defect ON ITS OWN rather than only alongside mis-declared inputs (ADR-0127 partitions it, and records that turbo ships the sharing deliberately, for parallel coding agents). | 680 |
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

## Citations to records that never landed

Seven numbers are cited here as though they named a record, and `docs/adr/` has never held any of
them: **ADR-0079, ADR-0080, ADR-0086, ADR-0093, ADR-0095, ADR-0098 and ADR-0099**, cited 40 times
across five files in the three forms `adr-citations.test.ts` matches. A SIXTH file,
`verify-new-adrs-standards.md`, names 0080 twice in the list form `ADR 0005, 0012, 0080`, which that
check does not read — every one of the seven is still caught, because each is cited at least once in
a matched form, but the count is of citations the check sees rather than of every mention.

These are NOT the deleted files above, and the difference is the whole of it. Each was a record on
the 2026-09-10 branch `audit-new-adrs-internal.md` was auditing — its own title is "ADR-0073..0099"
and its method says "every record 0073-0099 was read in full" — and **that audit is what stopped
them merging.** It judged each against the bar for a record at all, found seven that restated,
planned or instructed rather than decided, and named where each one's content belonged instead. So
the citations are accurate about what was known when they were written: they name the proposals the
audit was evaluating, and the audit's own verdict is the reason the number is free.

Where each one's content went, which is what a reader meeting the number needs:

| Number | What it decided | Where the content lives now |
|---|---|---|
| **ADR-0079** | Seed only the properties the first surface needs — "roughly a dozen", nine listed | The irreversible half is the freeze, which 0079 cited rather than owned: `0015-property-definitions-partly-freeze.md`. The seeded set is migration one's, in `packages/db/`. |
| **ADR-0080** | A rating value carries `bestRating` and `worstRating` beside it, Schema.org's shape | `0012-statements-and-a-properties-catalogue.md`, which carries the sentence under its rating property. |
| **ADR-0086** | Report watch progress every 10 seconds, and immediately on any user interaction | `0019-watch-events-are-the-truth.md`, under "How often". The audit called it "an implementation note… or one line in 0019", and that is where it is. |
| **ADR-0093** | Do not name screens before they exist | `CLAUDE.md`, under "Principles", where an instruction to the people doing the work belongs. The audit's own reason: it "introduces no new evidence and no alternative". |
| **ADR-0095** | The demo is four groups, Breaking Bad among them, and needs four providers | `docs/demo.md`. Demo content is the most reversible thing in the product, so it is planning material rather than a decision. |
| **ADR-0098** | Cataloguing and displaying are separable | Already decided: `0003-items-exist-with-no-file.md` holds the rule, and `0063-medium-is-a-playback-medium.md` carried 0098's second paragraph verbatim. What was new was a reversal, and this repo's form for that is a `## Supersedes` section in the affected record. |
| **ADR-0099** | "Also appears in" is one list with a filter, not a split layout | **Nowhere, on purpose.** A list layout versus two lists is reversible in an afternoon, so it is a requirement on the ticket that builds the screen rather than a record. It also broke 0093 on a false premise, which 1.10 of the audit sets out. |

**The citations are left as they were written**, for the reason the section above gives: editing
research to match a later decision would falsify the record of what was known when. This section is
how a dead number resolves, and `adr-citations.test.ts` holds it — every ADR number cited in prose
must name a record this tree holds or be accounted for here, so the eighth is caught rather than
joining these quietly. ADR-0167 records the decision.

## The fetch recipes, which are not obvious

- **Plex support docs**: plain `curl -s "https://support.plex.tv/articles/<slug>/"`. No User-Agent,
  and not WebFetch. The 403s an earlier session hit were a network-level block, not Plex.
- **Plex forums**: append `.json` to a topic URL. That also exposes `staff` and `moderator` flags,
  which is how the "published by a Plex engineer" claim was found to be unfounded.
- **Jellyfin source**: `gh api repos/jellyfin/jellyfin/contents/<path>`. Do not clone; an agent
  stalled doing that.
- **loc.gov** returns 403 to everything. Use web.archive.org for MARC.

## What is NOT here

`~/tardis-pipeline` (3.2G) and `~/tardis-archive.sparsebundle` (66G) — the local archive of the
independent Tardis Wiki, collected with permission. **BOTH WERE DELETED ON 2026-09-13 (ADR-0129)**
once a real `Theory:Timeline` had been imported live end to end, so there is one way wiki data
reaches CanonCore rather than two. Nothing here can be queried against them any more.

`verify-new-adrs-archive.md` and the archive figures in `resolve-tierA.md` and
`supersession-check.md` were taken against that corpus and are LEFT AS WRITTEN, like every other
record in this directory: they say what was known when, and rewriting them to match a later
deletion would falsify that. The live equivalents are re-derivable with `pnpm measure:live` in
`provider-wiki`, and the seven ADRs that quoted archive figures now carry live ones with the date
they were measured.
