# Verifying the Linear tickets after the SPEC.md rehome

Read-only audit, 2026-09-10. Nothing in Linear was modified.

**Scope.** The four edits made to CNCORE-2, 5, 7 and 9 at 11:57 on 2026-09-10, then a full pass over
CNCORE-1..9 against the 99 records in `docs/adr/`, `CONTEXT.md`, `docs/physical-schema.md` and
`docs/research/`.

**Method.** `orca linear issue CNCORE-<n> --full --json` for each of 1..9, which returns the
description, threaded comments, recursive children, relations and field-change activity in one call.
Relations live at `result.relations`, children at `result.children`; neither is on `result.issue`,
and `list-issues` returns no parent field at all, so both were read from the per-issue call. Every
ADR cited by a ticket was opened and read rather than recalled.

---

## 1. Did the four edits land?

All four landed and all four read correctly in context.

### CNCORE-2 (a) — the worked example on stop condition 2

Present, at the end of condition 2:

> Worked example: import Breaking Bad, Better Call Saul and El Camino; build a Release order
> container and a Story order container; Better Call Saul's first episode sits in both at
> different positions. Without the three titles named, "#63" is not checkable.

The numbers check out against the titles named: Breaking Bad is 62 episodes, so Better Call Saul's
first episode is #63 in a release ordering that holds all three, and #1 in a story ordering, because
Better Call Saul is a prequel. That is what makes "#63" falsifiable rather than decorative. It also
matches ADR-0095, which picks Breaking Bad for the demo precisely because "release order and story
order interleav[e] at EPISODE level".

### CNCORE-2 (b) — the `versions` array

Present, under **Providers**:

> A `versions` array, absence meaning THE FIRST VERSION (ADR-0032 — the W3C precedent it follows
> numbers that 0.1, not 1).

Matches ADR-0032 exactly, which says the W3C Reconciliation Service API "retrofitted versioning at
v0.2 with exactly it — absence there means 0.1, not 1". The old wording ("absence meaning version
1") is gone.

### CNCORE-2 (c) — SPEC.md becomes `docs/adr/`

Present, in Further Notes:

> `docs/adr/` carries the result and `docs/research/` carries the evidence. (`SPEC.md` did, until
> it was retired on 2026-09-10; its column lists are now `docs/physical-schema.md` and everything
> else is an ADR.)

The live pointer is now `docs/adr/`; the only surviving mention of `SPEC.md` is the historical note
the edit called for. `docs/physical-schema.md` exists (6,442 bytes, added by `a62a6ab`). See §2.

### CNCORE-5 — the ADR-0009 reason on the shared-position criterion

Present, as the eighth acceptance criterion:

> Whether two editions of one item may share a position in one container is stated explicitly
> (ADR-0009 gives the reason a shared position exists at all: a story-order container holding both a
> novel and the film that adapts it must place them at the same point without inventing an order
> between them)

Verbatim against ADR-0009:

> THERE IS NO UNIQUE CONSTRAINT ON (container_id, position): two DIFFERENT items may share a
> position. A story-order container holding both a novel and the film that adapts it must place them
> at the same point without inventing an order between them.

Reads correctly in context: the criterion asks the implementer to decide the *edition* case, and the
parenthetical supplies the *item* case as the precedent, which is the distinction that makes the open
question answerable. No conflict with the criterion two lines above it — `(container, item,
position)` unique and `(container, position)` unconstrained are different tuples.

### CNCORE-7 — the worked example

Present, and it carries the output string:

> Worked example, so the numbers are checkable: import Breaking Bad, Better Call Saul and El Camino;
> build a Release order container and a Story order container; Better Call Saul's first episode sits
> in both at different positions, and its page reads "Also appears in — Release order (#63), Story
> order (#1)".

The string matches ADR-0099 character for character, which names it as "the screen the second stop
condition turns on". It also matches CNCORE-2 and CNCORE-5.

### CNCORE-9 — the fixture section

Present and complete. All three parts landed:

- **Five named serials with part counts**: The Tenth Planet (4 parts, 3 survive, part 4 animated) ·
  The Ice Warriors (6, 4 survive, 2 animated) · The Daleks' Master Plan (12, 3 survive, no animation
  ever made) · The Power of the Daleks (6, none survive, all 6 animated) · Marco Polo (7, none
  survive, no animation, unwatchable). Plus the corpus figures: 29 stories with missing episodes, 13
  with an animated replacement, 11 serials completely missing.
- **Five required shapes**: a story in more than twenty containers · a category cycle · a story with
  two release dates · a medium value that is parse garbage · a work with no edition at all.
- **A labelled match set** "INCLUDING rows whose correct answer is that there is no match".

Every figure matches ADR-0057 exactly, including the three corpus counts. The citation "(ADR-0057
carries these)" is accurate: ADR-0057 gained these rows in `a62a6ab`.

---

## 2. Remaining `SPEC.md` references in tickets

`grep -n "SPEC" CNCORE-*.txt` over all nine descriptions and all six comments returns exactly one
hit, CNCORE-2, and it is the deliberate retirement note quoted in §1(c) above. Nothing points at
`SPEC.md` as a live authority.

For completeness: `docs/research/README.md` records the same retirement and states that research
files citing `SPEC.md` by name are left as written on purpose — "Editing research to match a later
deletion would falsify the record of what was known when." That policy covers the repo, not the
tickets; the tickets are clean either way.

---

## 3. Ticket / ADR contradictions

### 3.1 CNCORE-7 asserts the Disney+ MCU revision as fact; ADR-0017 records it as unverified

CNCORE-7, in the paragraph that carries the ticket's central reason for placements having sources:

> Placements created this way carry the provider as their source, because an ordering is a DATED
> CLAIM BY A NAMED SOURCE rather than a neutral fact — Disney+ revised its own MCU chronology in
> August 2025, replacing the work at the head of the timeline, and without the source that revision
> is indistinguishable from the owner having reordered it by hand.

ADR-0017, Evidence section, added in the 2026-09-10 verification:

> The Disney+ MCU chronology revision of August 2025 is the one external claim here and it was NOT
> verified in the 2026-09-10 pass. It illustrates the decision rather than carrying it — the
> argument stands without it.

This is the known pattern exactly: the qualification reached the ADR and not the ticket. It matters
more in the ticket than in the ADR, because CNCORE-7 uses the claim as the *reason* an implementer
should attach a source to an imported placement, where ADR-0017 explicitly demotes it to
illustration. `docs/adr/0017-placements-carry-sources-and-rank.md` is the only ADR in the set that
carries a "NOT verified" note.

### 3.2 CNCORE-2 says five generator defects; the count is seven

CNCORE-2, under **Scaffold**:

> Fix the five known defects in the generated output on day one, of which the absence of any test
> harness is the first, since this spec requires two committed tests.

CNCORE-3, its own child, is headed "**Seven defects in the generated output. Fix them on day one.**"
and says "The first five were known; the last two were found only by running the thing, and both fail
silently." `docs/research/validate-cncore-3.md` is the source: line 926 "A sixth defect: the three
`interactive: true` turbo db tasks", line 928 "A seventh defect: the env validation does nothing",
line 952 "Add them as defects six and seven, widen defect four to cover [the db package]".

CNCORE-3 was updated with this on 2026-09-10 at 10:42; CNCORE-2 was updated at 10:19 and again at
11:57 and still says five. A stale figure in the parent spec, contradicted by its own child and by
the validation record.

Related, and worth knowing rather than fixing here: defects 6 and 7 exist only in CNCORE-3 and
`docs/research/validate-cncore-3.md`. No ADR carries them — `grep -rn "persistent\|interactive"
docs/adr/` returns only ADR-0036's TMDB quotation. ADR-0053 gained the two flag gotchas and the
evaporated `transpilePackages` reason; it did not gain the two silent defects.

### 3.3 CNCORE-4 lands migration 1 but omits what ADR-0075 requires in the first migration

CNCORE-4:

> This ticket lands migration 1, and migration 1 carries ONLY what cannot be retrofitted — every
> member of that set was tested individually rather than assumed:
>
> * `statements` and the `properties` catalogue [...]
> * `title` and `sort_name` as COLUMNS THAT PROJECT STATEMENTS [...]
> * `aliases`, or the first merge breaks every old URL.
> * The migration ladder's RULES [...]

Four bullets, framed as exhaustive. Against that:

- **ADR-0075** (new): "Timestamps, tombstones and a monotonic change sequence sit on every table,
  from the first migration." And: "Retrofitting a change sequence means backfilling one for every
  row already written, and every row written before it is indistinguishable from every other, so the
  reversal query cannot see history it was not present for." That is the unretrofittability test
  CNCORE-4's own framing uses, met, and the item is absent from CNCORE-4.
- **`docs/physical-schema.md`**, "On every table": `owner_id` (ADR-0044), created/updated timestamps,
  a tombstone, a monotonic change sequence (ADR-0075), plus an acyclicity constraint and ancestor
  closure over the category graph (ADR-0074).
- **ADR-0051** and **CNCORE-2** both give a seven-item migration-1 list — statements and the
  properties catalogue, title and sort_name as projections, aliases, placements with their sources
  and rank, the migration ladder's rules, the raw uniqueness constraint on vocabularies, and a merge
  stamping its id. CNCORE-4 carries four of the seven. Placements land in CNCORE-5, which is
  defensible as slicing; the raw uniqueness constraint (ADR-0030) and the merge id stamp (ADR-0040)
  appear in no ticket at all — `grep -in "vocabular\|tombstone\|change sequence"` across all nine
  descriptions and comments returns nothing but CNCORE-2's own index line.

So either "migration 1" is split across CNCORE-4 and CNCORE-5 and CNCORE-4 should stop claiming to
land it whole, or CNCORE-4's list is short by three unretrofittable items. Both readings are a
contradiction with the ADRs as written.

### 3.4 `docs/physical-schema.md` names CNCORE-4 as the thing that kills it; CNCORE-4 does not know it exists

`docs/physical-schema.md` line 8: "It exists because a column list has nowhere else to live yet. **It
stops existing when CNCORE-4 lands migration 1**, at which point the Drizzle schema file is the
schema and this is a stale copy. Delete it then; do not maintain it in parallel."

CNCORE-4 has no reference to the file, no acceptance criterion to delete it, and no pointer to it as
the column list migration 1 is built from. A one-way dependency: the doc knows about the ticket, the
ticket does not know about the doc. This is how a "temporary" file survives.

### 3.5 EDTF and date precision are in no ticket

ADR-0073 ("Dates are EDTF with a precision column") is new, and the commit that created it records
why it was expensive to lose: it "returned nothing across all 72 ADRs, `CONTEXT.md` and all eight
tickets". The record says "Roughly 12% of real release dates in the archive are year-only or
year-month, so this is the common case rather than the edge one" and that it is hard to reverse for
the same reason ADR-0014 is, because the sort key reads the column.

The tickets still carry nothing about it, and CNCORE-9's fixture requires "a story with two release
dates" without saying what shape a date takes. Not a contradiction of a ticket assertion — a gap the
ADR closed and the tickets did not hear about.

### 3.6 CNCORE-6 does not record that the wiki provider is tier 4 and can never be distributed

ADR-0089 (new): the four provider distribution tiers, of which tier 4 is "Providers whose source has
licensed them to ONE person are private and stay private: never bundled, never in the store, never
pointed at by another instance", and it names this provider: "it is the tier the archive's own wiki
provider falls into: permission was granted to one person, so ADR-0069's provider can never be
distributed even though it is the first one written."

CNCORE-6 gets the repo boundary right and says nothing about distribution. Its acceptance criteria
say "The provider is a separate repository, deployed separately, sharing no code with the app" and
"Ship no API keys" — neither of which is the tier-4 rule. A licence-compliance constraint that lives
only in an ADR the ticket does not cite.

### 3.7 Checked and clean

Every ADR a ticket cites resolves and says what the ticket says it says:

| Ticket | Citation | Verdict |
|---|---|---|
| CNCORE-2 | ADR-0032, `versions` absence means 0.1 | matches |
| CNCORE-3 | ADR 0052, design tokens as CSS custom properties are the ruled-out form | matches; ADR-0052 carried the same "84 CSS custom properties" figure, recounted as 102 under CNCORE-3 |
| CNCORE-3 (comment) | ADR 0053 amended for `transpilePackages` | matches |
| CNCORE-5 | ADR-0009, shared position | matches, verbatim |
| CNCORE-5 (comment) | ADR 0066 amended to stop calling it an RFC 3986 deviation | matches — ADR-0066 now says "calling this a deviation overstated it" and cites RFC 6596 |
| CNCORE-8 (comment) | ADR 0036, the second AI clause at paragraph 1.C | matches, including the verbatim quotation and "our reading is that it does not bite" |
| CNCORE-9 | ADR 0028, precision not recall | matches — ADR-0028 now reads "Without those rows PRECISION is never exercised" and "An earlier version of this record named the wrong metric" |
| CNCORE-9 | ADR-0057, the five named rows | matches, every figure |

Other ticket claims checked against their owning records and found sound:

- CNCORE-2's four verification figures. `docs/research/competitor-sweep/CONSOLIDATED-FINDINGS.md`
  executive summary: C1-C19 = **19** factual corrections, X1-X13 = **13** internal contradictions,
  Tier A = **11** gaps, R1-R13 = **13** counter-signals. All four match the ticket.
- CNCORE-2's "246 of its factual claims were put back to their owning sources, and 50 were wrong".
  `docs/research/README.md`: "246 claims from the 72 ADRs [...] 35 contradicted, 15 unfounded, 11
  judgement". 35 + 15 = 50. Matches.
- CNCORE-2's "the three ADRs whose claims were NOT verified say so in their own text". Only ADR-0017
  uses that phrasing. ADR-0037 ("could not be reproduced") and ADR-0051 ("self-reported rather than
  externally verifiable") are the other two on a reasonable reading, so the claim holds, but it is
  the weakest sentence in the ticket and a future reader will not find three by grepping.
- CNCORE-2's "the full 2.3GB archive" — ADR-0057 says 2.3GB DuckDB archive. Matches.
- CNCORE-2's "seven kinds", "Root is the absence of a placement", "Four source kinds", "the public
  demo [...] needs four providers rather than two" — ADR-0005, ADR-0062, ADR-0071, ADR-0095. All
  match. ADR-0095 states the four-provider point in the same terms: "THE DEMO NEEDS FOUR PROVIDERS
  AND THE STOP CONDITION FUNDS TWO."
- CNCORE-6's SSRF section against ADR-0034 — IANA classification not an enumerated CIDR list, the
  ULA metadata endpoints, DNS `lookup` hook pinning, SNI, every A and AAAA record, the deliberate
  redirect departure from OWASP. Every point present in both, in the same terms.
- CNCORE-8's licence section against ADR-0036 — the six-month ceiling, "any information", verbatim
  and prominent attribution, the broadened "etc." on image hosting, both AI clauses, purge on
  termination. All present in both.
- CNCORE-4's migration mechanics against ADR-0047 — timestamp prefix not ISO 8601, high-water mark,
  the silent splice, the empty-to-head gate not catching it, Rails preferring a schema load. All
  present in both.
- Stop-condition coverage is complete and unambiguous: condition 1 and 4 → CNCORE-8, condition 2 →
  CNCORE-7, condition 3 → CNCORE-9.

### 3.8 Two glossary observations, neither a contradiction

- CNCORE-5 uses "duplicate" for a repeated placement ("never a deliberate duplicate", "Duplicates at
  DIFFERENT positions stay legal"). `CONTEXT.md` lists `duplicate` under **Multi-placement** as a
  word to avoid, and `CLAUDE.md` bans it in code. But ADR-0009 ("DUPLICATES ARE ALLOWED") and
  ADR-0017 ("never a deliberate duplicate") use it identically, so the ticket agrees with the
  records rather than contradicting them. Flagged only so it is not mistaken for drift later.
- CNCORE-5's criterion "render the same item and the same record" uses `record`, which `CONTEXT.md`
  lists under **Placement** as a word to avoid. It is lifted from ADR-0066's own sentence ("the same
  page and the same record"), where "record" means the database row rather than the placement, so
  again the ticket matches the ADR.

---

## 4. The dependency graph

Read from `result.relations` on each issue. Every edge appears from both ends, with matching relation
ids, so nothing is half-written.

| Edge | Relation id | Seen from |
|---|---|---|
| 3 blocks 4 | `c26ec6a4` | both |
| 4 blocks 5 | `1285ff70` | both |
| 4 blocks 6 | `db819c24` | both |
| 5 blocks 7 | `1ef9e763` | both |
| 6 blocks 7 | `c3216ac1` | both |
| 6 blocks 8 | `715f0dcf` | both |
| 7 blocks 9 | `2454daaf` | both |
| 8 blocks 9 | `94f5fbb1` | both |

Eight edges, exactly the expected shape, no extras. Acyclic: a topological order exists —
3, 4, 5, 6, 7, 8, 9 — and every edge runs strictly left to right in it, so there is no cycle. CNCORE-1
and CNCORE-2 carry no relations, which is right: CNCORE-1 is the throwaway PR-automation check and
CNCORE-2 is the parent.

**Parentage.** `result.children` on CNCORE-2 returns all seven: CNCORE-9, 8, 7, 6, 5, 4, 3. Each of
those bodies also opens with a `## Parent` section naming CNCORE-2, so the structural link and the
prose agree. (`list-issues` returns no parent field, and `result.issue` has no parent key either —
the children array on the parent is the only place this is visible through the CLI.)

**One defect, in the prose rather than the graph.** CNCORE-7's "Blocked by" section reads:

> * Ticket 3 (one item, two orderings, hand-placed)
> * Ticket 4 (the wiki provider)

Those titles are CNCORE-5 and CNCORE-6. The numbering is a leftover from a pre-Linear "ticket 1..7"
scheme, off by two. Every other ticket uses the Linear key — CNCORE-4 says "CNCORE-3 (scaffold, test
harness, CI)", CNCORE-9 says "CNCORE-7 (...)" and "CNCORE-8 (...)". The Linear relations on CNCORE-7
are correct; only the body text is stale, and it is the one place a reader following the prose would
land on the wrong tickets.

---

## 5. State, labels, assignment

| Issue | State | Labels | Assignee | Priority | Estimate |
|---|---|---|---|---|---|
| CNCORE-1 | Done (completed) | — | jacobreesnew | none | — |
| CNCORE-2 | Todo (unstarted) | `ready-for-agent` | jacobreesnew | none | — |
| CNCORE-3 | Todo | `ready-for-agent` | jacobreesnew | none | — |
| CNCORE-4 | Todo | `ready-for-agent` | jacobreesnew | none | — |
| CNCORE-5 | Todo | `ready-for-agent` | jacobreesnew | none | — |
| CNCORE-6 | Todo | `ready-for-agent` | jacobreesnew | none | — |
| CNCORE-7 | Todo | `ready-for-agent` | jacobreesnew | none | — |
| CNCORE-8 | Todo | `ready-for-agent` | jacobreesnew | none | — |
| CNCORE-9 | Todo | `ready-for-agent` | jacobreesnew | none | — |

All of CNCORE-3..9 are Todo, carry `ready-for-agent` and only that, and are assigned. Todo is the
right state: `docs/agents/issue-tracker.md`'s rule is that issues are filed `--state Todo` so they do
not land in the team's default Backlog. Nothing is in Backlog, nothing is unassigned, nothing carries
`needs-triage` or `needs-info` left over.

CNCORE-1 being Done with no label is correct for a throwaway.

No priority and no estimate is set anywhere. Neither was asked for and neither is a defect; noted
because a seven-ticket dependency chain with no estimates gives the ordering nothing to sort on
beyond the blocking edges.

---

## 6. Edit timing, from the field-change activity

Useful for reading the results above. All times 2026-09-10.

| Issue | Created | Last updated |
|---|---|---|
| CNCORE-2 | 10:04 | **11:57** |
| CNCORE-3 | 10:16 | 10:42 |
| CNCORE-4 | 10:16 | 10:43 |
| CNCORE-5 | 10:16 | **11:57** |
| CNCORE-6 | 10:16 | 10:44 |
| CNCORE-7 | 10:16 | **11:57** |
| CNCORE-8 | 10:16 | 10:44 |
| CNCORE-9 | 10:16 | **11:57** |

Linear stamps these in UTC; git stamps commits at +0100. Normalised to UTC:

- 10:42Z — `eb32d25`, "Correct the ADRs against the ticket validation", which is the same pass that
  wrote the validation comments onto CNCORE-3..9 at 10:42-10:44Z.
- 11:57Z — the four edits under audit, and no others. Exactly CNCORE-2, 5, 7 and 9 were touched.
- 11:58Z — `a62a6ab`, "Rehome everything SPEC.md was the only home for, then delete it", which
  created ADR-0073 through ADR-0099 and amended thirteen more.

That one-minute gap is the mechanical reason the findings in §3.3, §3.5 and §3.6 exist: the 27 new
records landed a minute after the last write to any ticket, so nothing in the tickets has been read
against them until now.
