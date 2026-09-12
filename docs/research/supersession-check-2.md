# Supersession check 2 — can `tier3-vocabulary.md` and `build-order/sections/` be deleted?

Checked 2026-09-10 against `SPEC.md` (1,686 lines), `CONTEXT.md` (265 lines), the 72 ADRs in
`docs/adr/`, `build-order/build-order-research.md`, `competitor-sweep/`, `resolution/`,
`verify-adr-*.md`, the forensic record and the branch's commit bodies.

Same question and same method as `supersession-check.md`: claim by claim, with grep, and where a
check cannot confirm survival it is recorded as a loss rather than waved through.

**One thing changed since the first check and it matters here.** `decisions.md`,
`GRILL-DECISIONS.md` and `harry-potter-pass.md` have been rehoused and deleted (see
`docs/research/README.md`). `tier3-vocabulary.md` points at `decisions.md` twice, by name, for
where its own conclusions went. Those pointers are now dangling.

## Verdicts

| Candidate | Lines | Verdict | Unique things lost |
|---|---|---|---|
| `tier3-vocabulary.md` | 172 | **NOT SAFE**, but only two things need carrying | 2 |
| `build-order/sections/` | 1,071 | **SAFE TO DELETE** — proven by line-level containment | 0 |

Unlike the first check, this one found a genuine supersession. `sections/` is the first artefact in
either pass where "superseded" was tested and held.

---

## 1. tier3-vocabulary.md — NOT SAFE TO DELETE, but cheaply made safe

All 105 terms were checked. The headline is the opposite of the worry stated in the brief: the
DROP reasons are, almost without exception, carried forward — and carried forward better, because
`SPEC.md` and the ADRs give the same arguments at greater length and with sources attached. Two
things are lost. Seven more are **contradicted** by the current documents, which makes the file a
trap to read cold rather than an asset to keep.

### The 105 terms, by verdict

**KEEP (38) — all survive, and the reasons with them.** Spot-checked in full; the load-bearing
ones:

| Term and its stated reason | Where it survives now |
|---|---|
| Owner — `owners` table, one row, `owner_id` on everything | `SPEC.md:152`, ADR-0044 |
| Item — the abstract thing, deliberate divergence from LRM/BIBFRAME | `CONTEXT.md` **Item**, `SPEC.md:900-901`, ADR-0002 |
| Container / Container Behaviour — `is_container`, `is_ordered`, stored not inferred | `SPEC.md:204-205`, ADR-0004 |
| Placement, Position | `CONTEXT.md` **Placement**, **Position**, ADR-0009, ADR-0018 |
| Multi-placed — 93.4% of the stress corpus | `SPEC.md:1445`, `:1461`, `CONTEXT.md` **Multi-placement** |
| Root — the ABSENCE of a placement row | `SPEC.md:295-296`, ADR-0062 |
| Cycle — refused by the database, not the interface | `SPEC.md:780` ("an acyclicity constraint"), ADR-0009 |
| Also Appears In | `SPEC.md:113`, `:1396` |
| Delete — three outcomes, previewed | `SPEC.md:1303`, ADR-0046 |
| Edition — one level, BIBFRAME-style collapse | ADR-0011 |
| Default Edition, CORRECTED — editions are 0..n | `SPEC.md:377-378` ("EDITIONS ARE 0..n, NOT 1..n") |
| Edition Coverage, PROMOTED — a table of intervals with a per-interval kind | `SPEC.md:394-400` |
| Media Source → File — identity is content, path is location | `CONTEXT.md` **File**, ADR-0023 |
| Claim / Provenance — per field, not per item | `SPEC.md:75`, `:480`, ADR-0012 |
| Metadata Source — Owner is a source and sits at the top | `CONTEXT.md` **Owner**, **Source order**, ADR-0025 |
| Scheme — what an identifier IS vs who ASSERTED it | `CONTEXT.md` **Scheme** (near-verbatim) |
| Enrichment — never a wizard | `SPEC.md:981`, `:1359`, ADR-0027 |
| Date — EDTF, precision as asserted | `SPEC.md:1639`, `:1654` |
| Note — owner free-text, never provider-sourced | `SPEC.md:730-732` ("never provider-assertable") |
| Artwork Role — poster / backdrop / title-logo / still | `SPEC.md:684` (verbatim, as a vocabulary) |
| CMPP / Provider | `CONTEXT.md` **CMPP**, **Provider**, ADR-0031 |
| Progress / Watched / Continue Watching | `CONTEXT.md` **Progress**, **Continue Watching**, ADR-0019, ADR-0020 |
| Container Progress — each item counted ONCE even when multi-placed | ADR-0068 (`COUNT(DISTINCT item)`) |
| Stress Fixture — the governing rule inverts the corpus | ADR-0059 |
| Backlink — derived from statements | `SPEC.md` statements model |

**DROP (48) — the reasons survive too.** This was the specific worry and it does not hold up. The
DROP reasons are either (a) restated at greater length in `SPEC.md` or an ADR, or (b) trivial
("'Container' says it"). Worked examples of the ones that looked most at risk:

- **Library** — "Single-user: there is exactly one, and nothing queries it." Survives twice over:
  `SPEC.md:152` ("owners ONE row. Single user, one password, no signup, no multi-tenancy"), and
  the replacement concept is argued at length at `SPEC.md:190-200`, "WHY a scope and not a
  partition: a partition means an item belongs to exactly one group, and multi-placement is the
  entire product." `CONTEXT.md` bans the word twice, under **Container** (`_Avoid_: folder,
  library, bucket`) and under **Group** (`_Avoid_: library, partition, workspace, section`).
- **Orphan** — "no query could tell the two apart." Survives near-verbatim at `SPEC.md:295-296`:
  "ROOT IS THE ABSENCE OF A ROW, never a parentless one, because nothing can distinguish a
  parentless placement from a real one." Also ADR-0062.
- **Profile / Viewer / Viewer Mode / Withheld Count** and the whole VISIBILITY block (Selected
  Visibility, Effective Visibility, Listed, Unlisted, Inherit, publicly findable) — ADR-0072 and
  `SPEC.md:1353-1356` carry the refusal *and* the argument, including "Inherit from which parent?"
  has no answer once an item is multi-placed" verbatim.
- **Collection** — the LRMoo F16/F17/F18 "use superclass F1 Work" citation survives at
  `SPEC.md:221-222`, ADR-0004, and is *corrected* at `verify-adr-standards.md`,
  the F16/F17/F18 entry ruled "CONTRADICTED on F18" (F18 was retained, not deprecated). The
  surviving documents are strictly better here.
- **Tag** — "an owner-authored `category` statement" survives verbatim at `SPEC.md:1365`.
- **Typed Item Relationship / Entity / Role / Franchise / Canonical CMPP Field / Provider
  Evidence** — all collapse into "it is a statement" or "it is a `category` statement", which
  `SPEC.md:495`, `:570` and `CONTEXT.md` **Statement** all state.
- **Agent (self-hosted) / External Metadata Source / Official-Custom-First-Party-Demo Provider /
  Provider Catalog / CMPP Capability** — `CONTEXT.md` **Provider** collapses all of them into
  **Provider**, with `_Avoid_: plugin, agent, scraper, integration`.
- **Universora Drive Folder / External Storage Sync** — ADR-0050 and the `SPEC.md:1389-1392`
  standing rule ("The scanner NEVER writes storage").
- **Fork** — `SPEC.md:1345`.
- **Version** — `CONTEXT.md` **Edition** (`_Avoid_: version, instance, copy`).
- **Control plane / Provider gateway** — `SPEC.md:1017` ("Separate deploy, separate lifecycle, no
  shared code. CanonCore knows only a URL") plus ADR-0031.

**RULE (9) — seven survive, two are contradicted.** Survivors: "Never duplicate", "`record` and
`edge` are banned", "Canon is the product's name and nothing else / the word is `continuity`",
"a reference table holds no owner data and nothing minted outside a migration", the palette rule,
and the accelerator rule — all at `SPEC.md:1375-1394`. Contradicted: see S3 and S5 below. Lost:
see L31 below.

**RENAME (5) and DEFER (8)** — the renames all landed (Work → `kind=work`, Section → nested
container, Chronology → `CONTEXT.md` **Chronology**, Media Source → File). The DEFERs are the loss; see L32.

### LOST if deleted

**L31. The ban on the string "Universora".** `tier3-vocabulary.md:131`:

> **Never "Universora"** in any identifier, path or component name | RB

Grep for `Universora` across `SPEC.md`, `CONTEXT.md`, `CLAUDE.md` and `docs/adr/` returns
**nothing**. The word survives in the repo only inside the forensic record's
`17-ALL-TERMS-raw.md`, where it appears as historical usage in quoted glossary entries from the old
repos — never as a prohibition.

ADR-0058 and `SPEC.md:1681-1685` carry "THE NAME IS SETTLED. DO NOT RENAME AGAIN", which is a
different rule: it forbids a *future* rename. It does not tell an implementer what to do with the
*previous* one. That matters operationally, because `01-forensic-report.md` §9 and
`06-what-to-bring.md` are a manifest instructing whoever builds this to lift working code out of
nine archived repos, several of which were called Universora and carry the string in table names,
component names, ADR text and paths. The one rule that governs that copy-paste lives only in the
file under consideration.

**L32. Group G — seven terms carrying a DEFER verdict that were never argued, and the guard on
four of them.** `tier3-vocabulary.md:156-172`:

> Only group G is left, and Jacob asked for these ONE AT A TIME, not as a group:
> - **G. The seven DEFERs** — Palette · Public Payload · Public Summary · Command Palette ·
>   Local facet tabs · Overlay vocabulary · Shelf
>
> Note the guard applies to four of these: Command Palette, Local facet tabs, Overlay vocabulary
> and Shelf are names for screens that do not exist yet, and the corpus records one attempt that
> reached 171 design screens and zero lines of application code.

Three of the seven have since been answered: **Palette** at `SPEC.md:1393-1395` and ADR-0038,
**Command Palette** partly at `SPEC.md:1386` ("Every accelerator has an equivalent visible UI
path"), and **Public Payload / Public Summary** by ADR-0045 ("the public read path names every
field it emits… never the owner payload with fields removed").

**Local facet tabs, Overlay vocabulary and Shelf are answered nowhere.** Grep returns no hit for
any of the three across `SPEC.md`, `CONTEXT.md`, `docs/adr/` or the rest of `docs/research/`.
There is no open-questions file in the repo — the first supersession check recommended creating
one and it was not created. So the record that these are open, that they were deferred rather than
refused, and that Jacob asked for them one at a time, dies with this file.

The guard's evidence itself is **not** lost: "852 commits, 171 Figma screens, 41 ADRs, 100-story
PRD… No src/, no tests, no CI" survives at the forensic record's `01-forensic-report.md:33` and
the "171-screen Figma estate" at `:227`, and that record is being kept.

### CONTRADICTS the current documents — stale, and a reason not to read it cold

Seven, and two of them would actively mislead an implementer.

**S1. "Eight standards-derived kinds."** `tier3-vocabulary.md:24`:

> | Kind | **KEEP, REDEFINED** | Eight standards-derived kinds, not a renderer list |

`SPEC.md:195-197` says **SEVEN**, and ADR-0005 is titled "Seven item kinds". The eighth was
`nomen`, refused by name at `SPEC.md:212-216`. This is the same staleness the first check logged
as S4 against `decisions.md`, which has since been deleted; it survives here.

**S2. "Current Path … never in the URL, never identity."** `tier3-vocabulary.md:37`:

> | Current Path | **KEEP** | Navigation state, carried explicitly, never in the URL, never identity |

Reversed by ADR-0066 and `SPEC.md:312-320`. `?via=<placement-id>` **is** in the URL, declared
non-identifying, and `SPEC.md:319` names the old wording as having "overshot": "It forced the
container into client memory only, which is Jellyfin's design and loses the ordering on a page
refresh." Again the same contradiction the first check logged as S8 against the now-deleted
`decisions.md`.

**S3. "Safe External Fetch — ONE SSRF boundary for every user-supplied URL."**
`tier3-vocabulary.md:94`. Reversed by ADR-0034, whose title is "Two outbound boundaries, split by
who supplied the URL" and which says explicitly:

> The single boundary denied the very provider the stop condition requires, and it picked the
> wrong control.

`CONTEXT.md` ships both halves as separate headwords, **Config URL** (allowlist) and
**Content URL** (deny-list, no exception ever). A reader taking tier3's rule at face value would
build the refused design.

**S4. "Entity — DROP."** `tier3-vocabulary.md:73`:

> | Entity | **DROP** | Entities are Items with a kind |

`CONTEXT.md` keeps **Entity** as a live headword: "An item of any kind other than `work`: a
person, character, organisation, place, time span or concept." `SPEC.md:1398-1400` has a standing
rule that begins "Entities must not leak into work-browsing surfaces", which requires the word.
The term was reinstated; the file still says it was dropped.

**S5. Two RULE verdicts that tie kinds to renderers, both reversed.**
`tier3-vocabulary.md:14` and `:62`:

> | Renderer | **RULE** | `kind` determines the renderer. Not a stored term |
> | Supported Attached File | **RULE** | A kind exists only if a renderer for it is committed |

Both are now wrong in both directions. `kind` is the item kind (work / person / character / …)
and determines nothing about rendering; **`medium`** does, per ADR-0063 and `SPEC.md:364`. And the
standing rule at `SPEC.md:1387-1388` inverts the second one outright:

> Cataloguing and displaying are separable: a renderer is needed only when a file is attached and
> someone presses play. A novel with no reader is a complete entry.

**S6. The addressable/field-bearing split is one table short.** `tier3-vocabulary.md:132`:

> Addressable: items, editions, placements. Field-bearing: items, editions

`SPEC.md:1383-1384` says: "Addressable: items, editions, placements. Field-bearing via statements:
items, editions, **placements**." Placements gained statements; the file predates that.

**S7. Both pointers to `decisions.md` are dangling, and one names a file that no longer exists as
a live artefact.** `tier3-vocabulary.md:149-158` says the grilled terms "have all MOVED to
`decisions.md`" and that groups A-F are "Settled in `decisions.md` under 'TIER 3 CONTINUED — GRILL
SESSION 2026-09-05', sections 3.8 to 3.28". `decisions.md` was deleted after the first
supersession check. Relatedly, `tier3-vocabulary.md:121` keeps a term whose definition is that
file: "Review Queue / Decisions file | **KEEP** | The queue asks, the decisions file answers. Both
committed." The review queue survives (`SPEC.md:941-945`, ADR-0027); the decisions file does not.

**Also worth knowing before reading it cold:** the ADR numbers in the NAMING RULES table
(`:128`-`:133` — "RB ADR 0018", "RB ADR 0042", "RB ADR 0043") are the *old repo's* ADR numbers,
not this repo's. In `docs/adr/` today, 0018 is "ordering lives on the placement", 0042 is
"MediaInfo not ffprobe" and 0043 is "sessions carry capabilities". None is about vocabulary.

### Verdict

**NOT SAFE TO DELETE**, but it is the cheapest case in either check: **two things** need carrying
forward, L31 (one line) and L32 (three open terms plus the one-at-a-time instruction). Carry
those and the file becomes safe — and it should then actually be deleted, because seven of its
rows now contradict the documents that superseded it, two of them (S3, S5) in ways that would send
an implementer at a refused design.

---

## 2. build-order/sections/ — SAFE TO DELETE

Nine files, 1,071 lines: `audiobookshelf`, `calibre-web`, `immich`, `karakeep`, `kavita`,
`navidrome`, `romm`, `stash`, `suwayomi`. (There is no `komga.md`; Komga was written straight into
the consolidated file as its first section.)

**The brief's stated worry does not hold, on either count.** Romm, Stash and Suwayomi *are* in the
consolidated file — at `build-order-research.md` under "7 (continued). What a demo actually costs,
and whether it pays", `:731-793` and `:1355-1428`. And
"consolidated" here really does mean superset.

### How this was tested

Not by impression. Two independent mechanical checks:

1. **Range diff.** Each section's counterpart block was cut out of `build-order-research.md` by
   heading position and diffed against the section file. Eight of nine diffed to zero lines unique
   to the section; the ninth (`audiobookshelf.md`) had exactly one.
2. **Range-free containment.** Every non-blank line of all nine section files was tested for a
   verbatim match anywhere in `build-order-research.md`. This does not depend on the ranges chosen
   in check 1, so it catches content that consolidation might have moved elsewhere or dropped
   entirely.

Result of check 2, across all 1,071 lines:

```
--- sections/audiobookshelf.md    1 non-blank line not present verbatim in consolidated
--- sections/calibre-web.md       0
--- sections/immich.md            0
--- sections/karakeep.md          0
--- sections/kavita.md            0
--- sections/navidrome.md         0
--- sections/romm.md              0
--- sections/stash.md             0
--- sections/suwayomi.md          0
==== TOTAL: 1
```

### The one line, and why it is not a loss

`sections/audiobookshelf.md:3`:

> **Research in progress.** Evidence-only, citing dated commits/tags/releases from
> `advplyr/audiobookshelf` (server) and `advplyr/audiobookshelf-app` (mobile client).

`build-order-research.md` under "Survivorship warning + outcome table (measured 2026-09-05, `gh api
repos/<r>`)" carries the same sentence with the first two words removed. That is
a status marker on an unfinished pass, and the pass finished — the consolidated file has all four
numbered subsections for Audiobookshelf plus its own closing note on what remained evidence-thin
(`:572-575`). Keeping the phrase would not preserve a finding; it would preserve a false statement
about the state of the work.

Every figure, date, commit sha, issue number, URL and quoted maintainer statement in the nine
files is present in `build-order-research.md`, character for character. That includes all the
distinctive material the brief asked to be checked: Audiobookshelf's `0.9.61-beta` four-day tag and
its SQLite migration; Kavita's two-repo reconstruction; Immich's 2022-02-03 transfer commit and its
`assets`/`users` split; Navidrome's three names and the DSub commit `f760f892`; Karakeep's
next-auth-to-better-auth PR #2057; Stash's `UNIQUE constraint failed: files.parent_folder_id,
files.basename` migration failure (issues #2939, #2941); Calibre-Web's issue #1633 upstream-schema
break; Romm's four data-layer changes in fifteen months and PR #565; Suwayomi's PR #623 open since
2023-07-29 and the `v2.3.2243` build-number-in-patch-slot trap.

### Consolidation was additive, not lossy

`build-order-research.md` is 1,470 lines against the sections' 1,071. The extra ~400 lines are
cross-cutting analysis that exists **only** in the consolidated file and was interleaved between
the project sections — which is why a naive "the sections are the source, the consolidation is a
summary" reading gets the direction of value backwards. Among them:

- the survivorship warning and the ten-repo outcome table with star counts measured 2026-09-05,
  and the airsonic / Booksonic-Air / BookLore dead-set analysis (`:334-360`);
- the awesome-selfhosted four-month rule with the rejection boilerplate quoted verbatim, and the
  measurement "1,258 entries; 991 carry a Source Code link; 377 (30%) carry a Demo link"
  (`:659-677`);
- the mobile-timing evidence, including Immich's Sync v2 client rewrite 3.5 years in and the
  finding that no maintainer regret statement exists either way (`:650-658`);
- what a demo actually costs, and "**Direct evidence that a demo drives adoption: none found**"
  (`:893-901`);
- the common-shape analysis (`:794-816`, `:1318-1354`), the mobile early-vs-late finding
  (`:994-1020`), the solo-developer sequencing conclusions (`:1021-1080`) and the closing
  day-by-day recommendation (`:1429-1470`).

None of that is in `sections/`.

### Nothing here contradicts SPEC.md, CONTEXT.md or an ADR

And it could not: since every section line is present verbatim in `build-order-research.md`, any
contradiction the sections carry is carried identically by the surviving file, so it is never a
reason to delete the sections specifically. For the record, the research these files feed is live
and load-bearing rather than stale — `SPEC.md:66`, `SPEC.md:1505`, ADR-0001, ADR-0051 and
ADR-0055 all argue from "ten comparable self-hosted projects", and ADR-0001's Ubooquity control
case is the first check's L10, successfully rehoused out of the deleted `decisions.md`.

### Two dangling pointers to fix on deletion

- `build-order/build-order-research.md`, under "Contents" — "Per-project source files:
  `sections/*.md` in this directory."
- `docs/research/README.md`, under "The passes, newest first" — "`sections/` holds the
  per-project source."

### Verdict

**SAFE TO DELETE.** 1,071 lines, zero unique findings, zero unique figures, zero unique citations.
The single differing line asserts the research is unfinished, which is false. Delete the directory
and remove the two pointers above.

---

## Summary

| # | Thing | Where it lives now | Why it matters |
|---|---|---|---|
| L31 | The ban on the string "Universora" in any identifier, path or component name | `tier3-vocabulary.md:131` | Governs the code being lifted out of nine archived repos, several of them named Universora. ADR-0058 forbids a future rename; nothing governs the past one. |
| L32 | Local facet tabs, Overlay vocabulary and Shelf are open DEFERs, to be argued one at a time | `tier3-vocabulary.md:156-172` | The only record that three vocabulary questions are deferred rather than refused. No open-questions file exists in the repo. |

**Two distinct losses**, both from `tier3-vocabulary.md`, both cheap to carry.

## Contradictions found

Seven, all in `tier3-vocabulary.md`, none revealing a defect in the surviving documents:

S1 eight kinds (SEVEN, ADR-0005) · S2 the container is "never in the URL" (reversed, ADR-0066) ·
S3 one SSRF boundary (reversed, ADR-0034) · S4 Entity dropped (reinstated, `CONTEXT.md` **Entity**) ·
S5 kind determines the renderer / a kind needs a committed renderer (both reversed, ADR-0063 and
`SPEC.md:1387`) · S6 field-bearing is two tables (three, `SPEC.md:1384`) · S7 both pointers to the
deleted `decisions.md` dangle.

S3 and S5 are the dangerous pair: an implementer following either would build a design the ADRs
explicitly refuse. Together with the old-repo ADR numbers in its NAMING RULES table, this makes
`tier3-vocabulary.md` a file that should be emptied and deleted rather than kept for reference.

## By-products — contradictions found inside the surviving documents

Noted because the method turns them up, not because they bear on either verdict:

- **The Karakeep rename commit count disagrees between ADR-0058 and `SPEC.md`, and the audit
  already knows the ADR is the corrected one.** `verify-adr-products.md` §"The 3 UNFOUNDED" records the "27
  rename commits" figure as "**Not reproducible by any method tried**… The tight rename cluster is
  14 commits (2025-04-05 → 2025-04-21)." ADR-0058's opening statement was duly corrected to 14. `SPEC.md:1684` still
  says 27. The correction reached the ADR and not the spec. Neither `sections/karakeep.md` nor
  `build-order-research.md` is the source of either figure, so this bears on neither verdict.
- `docs/research/README.md` describes `tier3-vocabulary.md` as having "not been checked against"
  `CONTEXT.md`. That is now done, and the line needs updating whichever way the file goes.

## Recommendation

1. **`build-order/sections/`** — delete, and remove the two pointers in
   `build-order-research.md` under "Contents" and `docs/research/README.md` under "The passes,
   newest first".
2. **`tier3-vocabulary.md`** — add L31 to `SPEC.md`'s STANDING RULES (one line, next to the
   existing rename rule at `:1681`), record L32's three open terms somewhere durable, then delete.
   It is the only file in either check whose remaining content is more likely to mislead than to
   help.
