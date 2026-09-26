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
| `metadata-provider-contracts.md` | **The contract between a catalogue and a metadata source**, 2026-09-21. Fifteen systems on primary sources only — nine catalogue-side contracts (Jellyfin, Kodi, Plex legacy and modern, calibre, Audiobookshelf, Komga, Navidrome, Kavita), two wide sources (MusicBrainz, OpenLibrary) and four standards families (schema.org, Dublin Core, BIBFRAME, RDF/Wikidata) — read against the six questions CMPP's own shape raises. **Not a proposal**: nothing in it recommends anything for this repository, and where a source is silent it says so, because "nobody documents this" is itself the finding. The dominant pattern is **a closed flat DTO with exactly one open extension point, and that point is always the external-id namespace** — eight of the nine, the ninth being legacy Plex, which throws `FrameworkException` on an undeclared attribute. **Not one of the nine lets a provider attach a source-defined property to a record**, so the id map is the pressure valve and it already leaks: calibre's Goodreads plugin ships `identifier:grrating` and `identifier:grvotes`, Kodi's own wiki suggests `<uniqueid>` for values like "home" and "doco", and Plex staff bless custom `Guid[]` schemes. **Typed relations are the field's gap and not only ours**: exactly **one of nine** (Kavita) carries a typed edge between two records, and its vocabulary is a 15-member numeric enum already straining — a gap at 15, `Cameo=16` inside a `#region MangaBaka Only`, and a lossy `Other=8` that does not retain the original label. Everywhere else item-to-item is hard-coded hierarchy and item-to-person a role string, and Kodi's `<showlink>` matches by **title** rather than id, dropping the edge when it misses. **The standards answered all of this a decade or more ago and no catalogue has adopted the answer** — `Role`, `bf:Relation`, Wikidata qualifiers, 48 `bf:Identifier` subclasses, and obligation living outside the vocabulary in a DCTAP row or a SHACL shape the consumer owns. The real dissent is not a property bag but **the shape of the unit**, in three positions: Navidrome's **eleven small capability interfaces**, where optionality IS the interface boundary, so a missing export means "not implemented" and every response property can be marked `required`; MusicBrainz's closed vocabulary with an open projection (`inc=`, **697 relationship types each with a UUID**, 48 attribute roots, a BDFL and a ticket queue); and OpenLibrary's **schema as data**, `/type/edition` being a record at revision 37 with an edit history whose undeclared properties are stored, indexed and served — `identifiers` and `remote_ids`, its entire external-id story, are in neither type. On obligation, **modern Plex is the only contract in the sweep with a per-field `Required` column on the wire**, calibre's `touched_fields` the only provider self-declaration of what it can supply and it does real work at merge time, and Komga the only one where `null` deliberately means "no opinion". **Only Kavita records which fields an external provider set**; Jellyfin's merge never copies `Provider` to the target, so a finished record cannot say where any value came from. Language ends up outside the field and is then patched back by hand: Jellyfin hand-writes fallback for exactly two of 68 properties, Kodi has no `lang` attribute anywhere, legacy Plex put language in the **GUID** so a translation is a different record and modern Plex in a request **header** so an item never holds two, and Navidrome has no language field at all — only Kavita models it in the data, and only for titles. The loss is silent by design: Kodi's `ParseNative` drops an unknown element with **no log line at all**, and Audiobookshelf's destructuring whitelist discards unknown keys while its documented `required: [title]` is unenforced (a titleless match yields `{}`), its own Audible provider returning three fields the third-party schema has no slot for. One received premise falsified by measurement and corrected in the body: **Plex has not closed its provider interface** — it published a public HTTP contract on 2025-12-09 with an official `plexinc` reference implementation, and legacy agents are hidden behind a setting rather than removed as of PMS 1.43.4.10903-e5521bd8c. Two calibre documentation defects recorded: `compare_identify_results`, named in `Source.identify`'s docstring, **does not exist anywhere in the codebase**, and neither does `prefer_author_sort`, so any record citing it is wrong. | 1,748 |
| `tardis-wiki-ns0-census.md` | **A census of Tardis Wiki namespace 0**, 2026-09-21, for project 5. Resolves a contradiction in which nothing was wrong: 374,028 pages, 128,281 articles and 40,696 are three different populations, and **40,696 was never ns 0** — it is the pages carrying a parenthetical, 25.4% of it. **ns 0 holds 160,319 pages**, 128,736 non-redirect. So the non-story population is **115,930, not 26,411** — 4.4x the figure the plan was built on. Breaks the remainder down by the wiki's own infobox, a true partition (only **3** pages in ns 0 carry two): **39,173 entities** — Character 23,653, Person 5,315, Place 3,427, Concept 3,246, Species 1,919, Organisation 1,013, Time span 600 — plus 6,942 production pages and **69,815 carrying no infobox, which SMW confirms are untyped AT SOURCE** rather than unmeasured. Confirms `T:TREE`'s four branches hold once maintenance tags are cut (85,076 in-universe, 41,568 real world, 2,053 **Non-DWU material, of which the provider was importing 650** until CNCORE-350), and that The Hub holds **zero** ns-0 articles. Finds **two story definitions shipping in one repository**, disagreeing on **2,515** pages, and that the dab rule refuses **1,003** story-infobox pages, of which `DAB_PREFIX` alone refused **156** in-universe works (CNCORE-350, 2026-09-26). Shows six of seven item kinds are empty for **two** independent reasons, so CMPP needs no change and the fix is two repositories. A category-ancestry classifier was built and **abandoned**: the wiki's own edges make `Vacuum cleaner` a Species. **40,930 pages carry an image** (entities 48.2%, Person 83.0% beating stories' 66.5%) against zero in the install. The **containers are already complete** — 465 `Theory:Timeline` pages on the wiki, 465 imported. `Special:ExportRDF` over all 39,176 entities shows **five of nine empty CanonCore properties have real data** (appears_in 83.5%, category 56.3%, image 48.8%, portrayed_by 33.2%, part_of 16.5%) and three never will. Entities are not stubs (median 1,104B, 5.2% under 500B, against 49.3% of untyped pages), and **74% sit in more than one container**. Dataset frozen at `~/canoncore/wiki-census-2026-09-21/`. **Field-level inventory** of all 89 SMW properties on entity pages, as data shapes: **65 of 89 have no home in the thirteen** (13,354 page-properties), led by a **typed Item-to-Item relation** (21 properties, 8,236 pages) that `part_of` and `appears_in` cannot express. **ADR-0057 re-checked live and REPRODUCES** on all six figures it carries (206,907 triples -> 207,091, 559 properties -> 564); a first pass read 205,470/541 and would have filed a FALSE CORRECTION against an accepted record, caused by not reproducing the ADR's METHOD. Also records that `Special:ExportRDF` returns only ~73% of the SMW store, so no triple count taken that way is a store total. **Entity fill re-measured live on 2026-09-26 under CNCORE-377** after the frozen dataset was deleted: 39,209 entity pages, a median of **3** properties against a story's 11, 479 story-only and 20 shared properties reproduced exactly, four negative controls run, and the ticket's reconciliation refused, since the three double-infobox pages are story-and-production, not entities. Decided in ADR-0204. | 670 |
| `ci-path-filters-and-the-skipped-verdict.md` | **Path filters, and what a skipped job is evidence of**, 2026-09-21, for CNCORE-341. A re-test of `ci-and-repo-standards.md`'s standing rejection, which **survives**. Three of the ticket's premises are refused by measurement, the load-bearing one being "nothing is ever skipped" — something is skipped on **every** pull request. Compute is worth **zero** here (public repo, ADR-0111), the runner cap binds at 20 but costs ≤50s, and the real path-filter prize is **8.5 minutes per ten days**. The gate needs no repair for `skipped`: a cascade skip always arrives beside the failure that caused it, measured on a purpose-built probe where the two skip causes proved **byte-identical**. Two findings the ticket did not ask for: **one test file is 72% of the e2e suite and the long pole of the critical path**, running twice per run for 274s; and a **MEASURED** defect: `gate.sh` reports `PASSED` for a job its own `timeout-minutes` killed, because the ceiling concludes `cancelled` and its dependent `skipped` while only the RUN concludes `failure`. GitHub documents the ceiling as cancelling the job, never states the conclusion, and says "fails" elsewhere, so this cites a probe rather than either page — and the remedy is measured on both sides (hang `failure`, supersession `cancelled`). CNCORE-342 and CNCORE-343 filed. Memory-versus-lookup: the path-filter diff limit is **3,000 files, not 300**. | 825 |
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
