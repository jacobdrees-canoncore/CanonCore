# Supersession check 3 — can `SPEC.md` be deleted?

Checked 2026-09-10 at `7de5955` against the 72 ADRs in `docs/adr/`, `CONTEXT.md` (265 lines), and
Linear `CNCORE-2` through `CNCORE-9` (descriptions and validation comments, fetched with
`orca linear issue CNCORE-N --full --json`), plus the branch's commit bodies.

Same question and same method as `supersession-check.md` and `supersession-check-2.md`: claim by
claim, with grep, and where a check cannot confirm survival it is recorded as a loss rather than
waved through. Because SPEC.md hard-wraps at 80 columns and the ADRs do not, every phrase check was
run against a whitespace-flattened copy of both sides — a line-broken phrase is otherwise reported
missing when it is present, and the first pass of this check made exactly that mistake before it was
caught.

## Outcome, 2026-09-10 — acted on, and the verdict reversed

The recommendation below was "keep `SPEC.md`". It was right at the time and it is now spent: all 40
losses were rehomed and the file is gone.

- **27 new ADRs**, 0073-0099, for the losses that were decision-shaped.
- **13 amendments** to existing proposed records, for the losses that were evidence for a decision
  already recorded (ADR-0005, 0009, 0010, 0012, 0023, 0029, 0033, 0042, 0047, 0051, 0057, 0059, 0065).
- **`CLAUDE.md`** took the reading contract (L34), the three constraints (L37), the words banned in
  code and the accelerator rule (L35), and the closure of the Harry Potter pass (L66).
- **`CONTEXT.md`** gained six headwords: Work-browsing, Catalogue search, Country, Date, Note, The
  fixture — plus the Language split that L58 exists to prevent collapsing.
- **`docs/physical-schema.md`** took L42, and nothing else. It says in its own first line that it
  dies when CNCORE-4 lands migration 1.
- **CNCORE-2, 5, 7 and 9** took L63, L65, B3 and B5.

The 28 contradictions were resolved by DELETION rather than by editing: 24 of them lived in argument
prose that the ADRs already carry correctly, so cutting the file to its column lists removed them.
The four in §3.1 were fixed in place first, before the cut, so the fix is visible as a fix.

By-products B1 (ADR-0027 repeating the claim it had just corrected) and B2 (ADR-0047's pointer facing
the wrong way) are fixed. B4 is answered in `CLAUDE.md`: `proposed` means decided but not yet
implemented, and a record becomes `accepted` when the slice implementing it lands.

Every "returns nothing" grep in §2 was re-run against the new destinations before the file was
removed. All 40 return something.

---

## Verdict

**NOT SAFE TO DELETE.** This is by a wide margin the largest loss found in any of the three checks:
**40 distinct losses**, of which six are whole sections with no destination at all.

| | |
|---|---|
| Candidate | `SPEC.md`, 1,690 lines |
| Verdict | **NOT SAFE** |
| Unique things lost | 40 |
| Contradictions | 28, all of them SPEC.md being stale against a corrected ADR or ticket |

**The headline is the opposite of the brief's worry.** The worry was that the post-cap half — the
scanner, playback, progress, the scheduler, backup, delete, the clients — would turn out to be
uncovered by the `proposed` ADRs. It is covered, and covered *better*: ADR-0039 through ADR-0050 and
ADR-0060 through ADR-0068 carry those decisions with corrected citations SPEC.md never received.

What is not covered is the material that never had a decision shape in the first place, and it
splits three ways:

1. **The physical schema.** No ADR and no ticket carries a column list. `placement_sources`,
   `part_from`/`part_to`, `subject_item_id`/`value_literal`/`valid_until`, `manually_verified`,
   `fetched_at`, `statement_qualifiers` — every one of them appears in SPEC.md and nowhere else.
2. **The standing rules, the facts and the constraints.** These are the sections with no decision to
   ADR-ise, and they are the ones that vanish outright. STANDING RULES loses eight of its twelve
   entries; CONSTRAINTS loses three of seven, including the one the whole forensic record exists to
   produce; FACTS loses two of seven.
3. **The archive and the fixture.** `WHAT EXISTS OUTSIDE THIS REPO` and `WHERE THIS ARCHIVE IS USED`
   are two full sections whose figures, named fixture rows and usage rules survive only in fragments.

**And the drift the brief asked about has already started, in both directions.** Commit `7de5955`
("Correct the ADRs against the ticket validation", 2026-09-10) applied 24 corrections across eleven
ADRs — 15 claims contradicted, 9 unfounded, out of 103 put back to their sources — and its
`--stat` touches `docs/adr/` and `docs/research/` and **not `SPEC.md`**. Its predecessor `abafe13`
had updated both. So the two documents were in step until yesterday and are not now: every one of
those 24 corrections is a contradiction between them, and in four places SPEC.md instructs an
implementer to do something the ADRs and tickets have since established is wrong.

---

## 1. Sections that survive substantially intact

Recorded first, because they are the majority and the brief's stated worry lives here.

| SPEC.md section | Lines | Destination | Assessment |
|---|---|---|---|
| THE GOVERNING RULE | 44-57 | ADR-0059 | **Survives, improved** — the ADR adds the versions checked (LRMoo 1.1.1, BIBFRAME 3.0.1, CIDOC CRM 7.4) and the note that LRMoo F38 has migrated out to CRMsoc |
| HOW ENRICHMENT WORKS | 917-1042 | ADR-0026, 0027, 0028, 0029, 0024, 0025, 0031, 0032, 0033 | **Survives, improved** — except provider distribution, L55. And see C2, C17, C18, C19, C20 |
| PLAYBACK (the analysis pass, direct play) | 1044-1078 | ADR-0041, 0042, 0043 | Survives; but the completion rules below it do not — see L52. And C12, C13, C14, C15 |
| SECURITY | 1165-1204 | ADR-0034, 0035, 0045 | **Survives, much improved** — the ADR now denies by IANA classification rather than an enumerated CIDR list |
| STORAGE | 1206-1218 | ADR-0050 | Survives |
| THE SCANNER | 1220-1247 | ADR-0039 | Survives; see C23 |
| THE SCHEDULER | 1249-1265 | ADR-0049 | Survives; see C21 |
| BACKUP, RESTORE AND THE DUMP | 1267-1297 | ADR-0048 | Survives; see C22 |
| DELETE | 1299-1339 | ADR-0046, 0040 | Survives |
| ADAPTATION VERSUS EDITION | 857-892 | ADR-0067, 0011, 0064 | Survives; but see L47 and C8 |
| MIGRATIONS (the rules) | 789-855 | ADR-0047 | Partly — the mechanics do not, see L67; and see C3, C4 |
| DELIBERATE DIVERGENCES (the six) | 894-915 | ADR-0002, 0003, 0004, 0009, 0011, 0008 | The six survive individually; the LIST does not — see L72 |
| WHAT NOT TO BUILD | 1341-1377 | ADR-0024, 0027, 0029, 0038, 0041, 0048, 0050, 0054, 0072; CNCORE-2 | Thirteen of fourteen bullets survive. The fourteenth is L60 |

The provider half in particular is in better shape in the ADRs than in SPEC.md, and the same is true
of security: ADR-0034 carries a live SSRF hole in OWASP's own published table that SPEC.md's version
of the same rule would have shipped.

---

## 2. LOST if deleted

Numbering continues from the two earlier checks (L1-L30 in `supersession-check.md`, L31-L32 in
`supersession-check-2.md`). Every "returns nothing" below was grepped against a flattened
concatenation of all 72 files in `docs/adr/`, `CONTEXT.md`, and the eight Linear issue bodies with
their validation comments.

### The framing

**L33. What CanonCore actually is.** SPEC.md:24-42. Four claims, none of which survives anywhere:

> It is domain-general. It is a media server in its own right, not a client of Plex or Jellyfin, and
> it never INGESTS media: a file row REFERENCES bytes that stay where the owner put them, and
> playback goes through an app-owned opaque-id route so access control and progress work. The word
> `source` is not available for this: it names who asserted a value — a provider, the owner, a
> sidecar or a computation — and nothing to do with where bytes live.

`domain-general`, `media server in its own right`, `never ingests` and `opaque-id` all return
nothing. CONTEXT.md opens with the folder-tree sentence and CNCORE-2's Problem Statement carries the
multi-ordering framing, so the *product* survives; the *architecture posture* does not. The
opaque-id route is a constraint on the one path SPEC.md otherwise refuses to specify, and the
`source` carve-out is the only place the glossary's most overloaded word is fenced off from bytes —
CONTEXT.md's **Source** headword does not mention them.

**L34. The reading contract.** SPEC.md:8-22.

> Do not look for, read, or reference any previous attempt at this product, in any repository or on
> the web. Do not search for one. This document is complete and self-contained…
> Everything stated here as a decision is CLOSED, and carries the reason it was taken so it is not
> reopened. Everything this document does NOT mention is simply UNSPECIFIED, and yours to decide
> with ordinary judgement — do not stall asking permission for things nobody has ruled on.

`do not look for`, `self-contained`, `unspecified` and `stall asking permission` all return nothing
across the ADRs, CONTEXT.md and all eight tickets. This is the operating contract for whoever builds
the thing: it says what silence means, and it is the direct counterweight to the salvage manifest in
the forensic record, which instructs the opposite. Seventy-two ADRs with no such rule leave an
implementer to guess whether an unmentioned thing is forbidden or free.

### The rules with no decision shape

**L35. STANDING RULES — eight of twelve entries.** SPEC.md:1379-1431. Two survive in ADRs (the
scanner never writes storage, ADR-0039; the palette attaches to the asset, ADR-0038). Three survive
in *vocabulary* form only, as `_Avoid_` lines in CONTEXT.md — `duplicate` under **Multi-placement**
and **Redundant file**, `canon` under **Continuity**, and `record`/`edge` under **Placement**. That
last one is a partial rather than a survival: CONTEXT.md bans the words as vocabulary and SPEC.md
bans them **in code**, which is a different instruction to a different reader, and `banned in code`
returns nothing. So does the rest of rule 1, "surfaced as a suggestion and never auto-deleted".

These return nothing anywhere:

> - Addressable: items, editions, placements. Field-bearing via statements: items, editions,
>   placements.
> - A reference table holds no owner data and nothing minted outside a migration.
> - Every accelerator has an equivalent visible UI path.
> - Cataloguing and displaying are separable: a renderer is needed only when a file is attached and
>   someone presses play. A novel with no reader is a complete entry.
> - "Also appears in" is ONE list containing both hand-placed and rule-derived containers, with a
>   filter rather than a split layout.

Three of these are load-bearing beyond their length. The addressable/field-bearing line is the
one-sentence statement of which tables can be pointed at and which can carry statements —
`supersession-check-2.md` S6 found `tier3-vocabulary.md` had it *wrong* and SPEC.md had it right, and
deleting SPEC.md leaves only the wrong version, in the archive. The cataloguing/displaying line is
the correction that S5 was measured against ("a kind exists only if a renderer for it is committed"),
so the same applies. And "Also appears in is ONE list… with a filter" is a screen rule for the exact
screen stop condition 2 requires, which CNCORE-5 specifies without it.

**L36. The entity-leak rule, and the search rule inside it.** SPEC.md:1398-1423, 26 lines, the
longest rule in the document, and nothing in `docs/adr/` addresses it. `work-browsing`,
`grouped by kind`, `works first` and `Rose Tyler` all return nothing.

> Entities must not leak into work-browsing surfaces… So exclude BY KIND, and phrase the rule around
> THE QUESTION A SURFACE ASKS rather than around a list of surfaces… Naming the question rather than
> the surfaces matters because the surface list is open: a command palette, a related-items rail and
> an API endpoint would each otherwise need classifying by hand…
> SEARCH ANSWERS THE SECOND QUESTION AND RETURNS ALL SEVEN KINDS, grouped by kind with works first…
> Searching "Rose Tyler" and being shown nothing because a character is an entity is the failure this
> rule exists to avoid, not to cause.

It matters because it is the rule that makes ADR-0004's single-items-table decision survivable, and
because CNCORE-2 user stories 21, 22 and 23 ask for exactly the three behaviours it governs and no
destination says how to satisfy them. It also carries the only statement in the repo of what search
returns and in what order.

Lost with it, at SPEC.md:1424-1431: **ENTITY IDENTITY IS A SURROGATE ID with external-id mappings,
NEVER A NAME**, and the Jellyfin evidence — people keyed on their name, so two people sharing one
merge irreversibly, "no easy fix… unlikely to be fixed before the database rewrite" in 2020, and the
October 2025 confirmation that the rewrite landed and the defect did not move.

**L37. CONSTRAINTS — three of seven.** SPEC.md:1671-1683.

> - When an audit says the remaining work is larger than expected, the answer is to CUT SCOPE INSIDE
>   THIS REPOSITORY. Never to start another one.
> - A LIST OF THINGS TWO MATURE PRODUCTS HAVE IS NOT A BACKLOG. Everything in this document was
>   reopened once, deliberately, against advice, and the recorded concern was exactly this…
> - The first version ends in a rendered page, not a report. Reject on sight any proposal that grows
>   the document phase without bringing the render forward.

`cut scope`, `not a backlog` and `document phase` return nothing. The first is the operational
conclusion of the entire forensic record: ADR-0051 and CNCORE-2 both carry the *evidence* ("they
died two to four weeks in, four of five within a week of their highest-output day") and neither
carries the *rule* it produces. The second is `supersession-check.md`'s L3, recovered at cost out of
the deleted `GRILL-DECISIONS.md`, and it now lives in exactly one file again.

### The facts

**L38. EDTF and date precision.** SPEC.md:1643-1645.

> Dates need EDTF and a precision column. Padding a partial date to the 1st of January sorts wrongly
> and displays wrongly forever, and roughly 12% of real release dates in the archive are year-only or
> year-month.

`EDTF` returns **nothing** across all 72 ADRs, CONTEXT.md and all eight tickets, and CONTEXT.md has
no Date headword at all. `supersession-check-2.md` recorded EDTF as surviving "at `SPEC.md`:1639,
:1654" — which is this file. It is a modelling requirement with a measurement behind it and it has
no other home in the repo.

**L39. The visited-set rule, and the acyclicity constraint.** SPEC.md:1663 and SPEC.md:780.

> Category graphs contain cycles. Any ancestor expansion MUST carry a visited set.

and

> An acyclicity constraint and an ancestor closure.

ADR-0016 records that the archive's category graph is a cyclic DAG 22 levels deep. Nothing records
what an implementer must therefore do about it. `visited set` and `acyclicity` both return nothing —
so the database-level refusal of cycles is gone as well as the traversal rule.
`supersession-check-2.md` recorded "Cycle — refused by the database, not the interface" as surviving
at "`SPEC.md`:780 ('an acyclicity constraint'), ADR-0009"; ADR-0009 does not in fact mention it.

**L40. Timestamps, tombstones and a change sequence on every table.** SPEC.md:779.
`change sequence` returns nothing. ADR-0049 schedules "tombstone compaction" and ADR-0040 says a
merge stamps its id "on every row it touches" — using a change sequence whose existence is declared
only here. ADR-0040's mechanism has no substrate stated anywhere else.

**L41. How the read projection is rebuilt.** SPEC.md:785-787.

> Rebuild the read projection WHOLESALE, never incrementally, with revision-id versioning on
> projection writes so a stale rebuild cannot overwrite a newer one.

ADR-0012 says budget the projection as a first-class component; ADR-0014 says pick trigger- or
application-maintained and name the failure mode. Neither says how a rebuild runs, and `revision-id`
returns nothing. This is the concurrency rule for the projection ADR-0014 makes mandatory.

### The model

**L42. The physical schema.** No ADR and no ticket carries a column list — by design: CNCORE-2 says
"every decision referenced is an ADR in `docs/adr/`… Neither is restated here". The consequence is
that these identifiers appear in SPEC.md and in no destination at all:

`is_container` · `is_ordered` · `container_id` · `item_id` · `placement_sources` · `part_from` ·
`part_to` · `subject_item_id` · `subject_edition_id` · `subject_placement_id` · `value_literal` ·
`value_item` · `valid_until` · `statement_qualifiers` · `manually_verified` · `fetched_at` ·
`applied_on` · `release_date`

CNCORE-4 and CNCORE-5 name a few tables and columns in prose. Everything else — including the
statements row's full signature at SPEC.md:465-467 and the `CHECK` that stops `is_ordered` being set
on a non-container — is only here.

**L43. The seeded property catalogue.** SPEC.md:560-567.

> SEED ONLY WHAT THE FIRST SURFACE NEEDS. Roughly a dozen to start: category, portrayed_by,
> appears_in, based_on, created_by, credited_to, released, part_of, image. Everything else enters
> when a screen or an import actually needs it. Adding one is an INSERT, not a migration, so there is
> no reason to be speculative.
> THE SEEDED TARGETS AND VALUE-KINDS ARE STATED HERE BECAUSE THEY FREEZE ON THE FIRST INSERT.

ADR-0016 covers `category`, ADR-0070 covers `created_by` / `credited_to` / `published_by` /
`broadcast_by`, ADR-0067 covers `based_on`. `portrayed_by`, `appears_in` and `part_of` return
nothing, and so do the INSERT-not-a-migration rule and the seed-only instruction. This is a
migration-1 list by SPEC.md's own freeze rule, and `portrayed_by` is the property that carries the
person/character distinction ADR-0006 exists to protect.

**L44. A rating carries its scale.** SPEC.md:776-778.

> A RATING CARRIES ITS SCALE, so 4 out of 5 and 8 out of 10 can be compared: `bestRating` and
> `worstRating`, which is Schema.org's shape. Enrichment reaches every provider at once by design, so
> ratings arriving on different scales is the normal case rather than the edge one.

`bestRating` returns nothing. It is a property-definition rule that follows directly from ADR-0026,
and it is the only place in the repo that says what a numeric provider value has to carry.

**L45. Prefer a capabilities object over booleans on a property definition.** SPEC.md:553-554, "so
new capabilities land without changing the definition's shape". ADR-0012 lists what the properties
table declares and stops. `capabilities object` returns nothing.

**L46. What `release_date` on an item means.** SPEC.md:758-762.

> `release_date` ON THE ITEM MEANS THE EARLIEST KNOWN RELEASE OF ANY EDITION. Editions carry their
> own dates as statements. Define it or two implementers fill it two ways and a sort key disagrees
> with itself: one novel here was published 1997-06-26 in the UK and 1998-09-01 in the US, fifteen
> months apart.

`release_date` returns nothing in any destination. It is the third of the three projected columns and
the only one whose definition is genuinely ambiguous.

**L47. The abridgement rule.** SPEC.md:398-402.

> COVERAGE EXPRESSES MISSING PARTS, NOT ABRIDGEMENT. An abridged reading covers the whole extent at
> reduced fidelity; modelled as intervals it either claims full coverage, which is false, or invents
> boundaries, which are fabricated. Abridgement is a category statement on the edition.

`abridg` returns nothing anywhere. This is one of the eight findings SPEC.md:1632-1637 lists as
folded in from the Harry Potter pass — and folding them into SPEC.md is what made
`harry-potter-pass.md` safe to delete at commit `72bdfc2`. Deleting SPEC.md undoes that rescue.

**L48. `edition_coverage`'s shape, and editions being 0..n.** SPEC.md:394-397 and 377-379.
ADR-0060 and CONTEXT.md both define coverage as a set of intervals. Neither gives the table
`(edition_id, part_from, part_to, kind)` with a **per-interval kind**, which is the thing that makes
"three intervals of one kind and one of another" expressible at all. And:

> EDITIONS ARE 0..n, NOT 1..n. Unproduced and unreleased works are real and have no edition at all,
> so is_default has nothing to point at for them.

ADR-0065 specifies `is_default` and never says it may have nothing to point at.

**L49. File roles and the sidecar relation.** SPEC.md:429-433.

> Files carry a role: media|subtitle|audio, and a sidecar references the file it accompanies plus a
> language. This keeps Edition meaning "a different version of the work" rather than "a different
> file": one video plus two subtitle tracks is ONE thing to watch, whereas a second cut is a second
> edition.

ADR-0021 and ADR-0022 carry many-to-many and part/variant. Neither carries the role list, the
sidecar-plus-language relation, or the reason. `supersession-check.md` S7 recorded the closure of
this list at three values as the *resolution* of X10 against `decisions.md`'s four — the resolution
now lives only in SPEC.md.

**L50. Why technical properties are columns rather than statements.** SPEC.md:458-463.

> Columns rather than statements, because they are MEASURED OFF THE BYTES rather than claimed by
> anybody — re-measuring the same file gives the same answer, so there is nothing to disagree about
> and nothing to give provenance to.

ADR-0042 says the pass writes those fields onto the file row and never says why they escape the
statements table — which is the first question ADR-0012 makes an implementer ask.

**L51. Multi-part editions must not be playable before the ordinal exists.** SPEC.md:454-457.

> Progress is one number per (owner, edition), so progress recorded against an unordered three-file
> edition is uninterpretable, and deriving the ordinal later never gives that old number meaning.

ADR-0022 stores the ordinal and ADR-0020 makes progress per edition. Nothing forbids the combination
that makes the number meaningless, which is a sequencing constraint on two slices.

**L52. The completion rules, almost in full.** SPEC.md:1079-1114. ADR-0041 carries two sentences —
completion branches on the locator, and there is no force-complete rule. Everything else returns
nothing:

- the time-remaining rule and its argument ("a six-hour release at 90% still has thirty-six minutes
  to run while a 25-minute episode at 90% is in the closing titles");
- "TWO CLAIMS HERE WERE WRONG AND ARE CORRECTED" — Audiobookshelf's ten seconds is a configurable
  default, and Plex completes at min(90% threshold, first credits marker) rather than on a clock, so
  "the time-remaining rule is still the right one for timed media, but it is ours rather than the
  industry's, and it should be argued rather than attributed";
- the 10-second save interval, with Emby framing it as a CEILING rather than a floor;
- "THE TIMER IS ONLY HALF OF IT — ALSO REPORT IMMEDIATELY ON ANY USER INTERACTION. A 10-second timer
  on its own loses up to ten seconds on a pause-and-close, which is the common case rather than an
  edge one";
- "ONE number clears the position; do not add a second, higher threshold for that";
- and the strongest one, SPEC.md:1095-1100: "WHERE NEITHER THE PROBE NOR THE CLIENT HAS SUPPLIED A
  DURATION, COMPLETION IS UNKNOWN… Jellyfin's fallback in this exact case corrupts data —
  `if (!hasRuntime) { data.Played = true; }` marks an item WATCHED on its first progress report."

`hasRuntime`, `time remaining`, `credits marker` and `10 seconds` all return nothing. The last item
is the sharpest defect citation in the playback half and it is the direct evidence for
"unknown is never a fabricated true", which ADR-0060 asserts without it.

**L53. Extras.** SPEC.md:1150-1163. CONTEXT.md keeps **Extra** as a headword defining what one is.
There is no ADR, and `videoversion`, `idFile` and `itemType = EXTRA` return nothing:

> AN EXTRA DOES NOT SURFACE IN CONTINUE WATCHING FOR ITS PARENT… KODI DOES THE OPPOSITE and is the
> warning rather than the precedent: it files an extra as a file role, one `videoversion` row keyed
> on `idFile` with `itemType = EXTRA` — the same table and the same axis as an alternate version —
> and creates no item row at all, so an extra there cannot carry its own progress.
> …Plex's own design rule in that thread is the shape we are refusing: "Extras store no watched
> status. You can't mark Extras watched or unwatched."

SPEC.md:1116-1117 makes this load-bearing for a decision that DOES survive: the force-complete
refusal in ADR-0041 turns on "the problem it was aimed at is solved properly by EXTRAS, below".
Delete SPEC.md and ADR-0041's refusal points at nothing.

**L54. How "have I watched this WORK" is computed.** SPEC.md:1119-1121: "computed by unioning the
coverage intervals of watched editions against the work's extent." ADR-0060 carries "unknown is the
absence of a row" and the do-not-derive rule; the computation those two exist to serve returns
nothing.

**L55. Provider distribution, the four tiers.** SPEC.md:1008-1014. ADR-0035 carries "bundled provider
definitions ship disabled" and ADR-0031 carries "a provider is a URL". `CMPP store` and
`bundled defaults` return nothing, and with them:

> 2. THE CMPP STORE — publicly addable providers, ACCEPTED rather than open. Curated.
> 3. PRIVATE PROVIDERS — any URL added directly, bypassing the store.
> 4. Providers whose source has licensed them to ONE person are private and stay private: never
>    bundled, never in the store, never pointed at by another instance.

Tier 4 is a licence-compliance rule, and it is the tier the archive's own wiki provider falls into.

**L56. What bounds the artwork store.** SPEC.md:612-621 and 632-634.

> Declaring the stored variant too (a w500 poster, a w780 backdrop) is what makes the image store
> bounded BY THE CATALOGUE at design time — roughly 50-150KB each, a few hundred megabytes across the
> archive extract's 11,285 stories — rather than discovered at runtime. Plex's separate
> PhotoTranscoder cache and its weekly sweep exist because it did the opposite.

`PhotoTranscoder` and `50-150KB` return nothing. ADR-0033 and ADR-0037 carry the declared variant and
the read-time expiry without the sizing that makes "bounded by the catalogue" checkable, or the
counter-example that motivates it. Lost with it: "Width, height and blurhash are NOT needed early.
Storing the bytes made them re-derivable."

**L57. Country is a second axis, and the BCP 47 argument.** SPEC.md:468-478.

> COUNTRY IS A SECOND AXIS, NOT A SYNONYM FOR LANGUAGE. Plex and Jellyfin both carry the two
> separately because content ratings key on country while artwork keys on language, and a language
> column alone does not close that.

`country` returns nothing, and the `country NULL` column of the statements row goes with it. Also
lost: BCP 47 over ISO 639-3 "because it subsumes script into the tag (`ar-latn`), so a third axis
costs nothing; MusicBrainz and IIIF both carry script as its own field", and IIIF section 4.4 as the
literal source of `none`. CONTEXT.md's **Language** headword carries the conclusion with none of the
argument, so an implementer who wonders why not ISO 639-3 has nowhere to look.

**L58. `editions.language`, and the two-axes rule.** SPEC.md:331-345.

> NOTE THIS IS NOT `statements.language`, which says what language a VALUE is written in. A German
> edition can carry an English title. Two axes; collapsing them loses both.

plus `en-GB` and `en-US` being "genuinely different texts". This is `supersession-check.md`'s L6
(harry-potter-pass B9), decided at commit `da03b58` and written into SPEC.md so the pass file could
be deleted. `statements.language`, `en-GB` and the two-axes rule all return nothing — and CONTEXT.md
defines **Language** as the statement axis only, which is precisely the collapse this rule exists to
prevent.

**L59. Why `placements.edition_id` exists.** SPEC.md:248-252.

> A 4K box set contains the 4K editions, not "the films", and a DVD box set holds the specific
> transfers in it. This reads as an accommodation for one archive's oddities and it is not — it
> recurs in ordinary mainstream content.

`supersession-check.md`'s L7, carried out of the deleted `harry-potter-pass.md` into SPEC.md at
commit `da03b58`. CNCORE-5 names the column ("nullable edition") without the reason; no ADR mentions
it at all. It was filed as a loss originally because it is the one column an implementer is most
likely to drop as unexplained, and that is true again.

**L60. The deferred screen names and the 171-screen guard.** SPEC.md:1367-1372.

> No shelf type, no command palette, no local facet tabs, no overlay vocabulary, no fixed item-page
> tab structure. THESE ARE ALL NAMES FOR SCREENS THAT DO NOT EXIST, and the corpus records one
> previous attempt that reached 171 DESIGN SCREENS AND ZERO LINES OF APPLICATION CODE.

This is `supersession-check-2.md`'s L32, carried into SPEC.md by commit `cd56b92` **yesterday** and
into nothing else — verified by reading that commit's diff, which touches `SPEC.md` alone. `171`,
`command palette`, `local facet tabs`, `overlay vocabulary` and `item-page tab` all return nothing in
any destination. Deleting SPEC.md loses, for the second time in two days, the thing the previous
supersession check was run to save. (Its sibling, L31's ban on the string "Universora", went to
ADR-0058 and is safe. Only one of the two was carried somewhere durable.)

### The archive, the fixture and the demo

**L61. The archive's figures.** SPEC.md:1443-1455. The whole `data/db/tardis.duckdb` block — pages
373,513 · redirects 36,620 · `page_properties` 518,768 · `page_categories` 522,385 · `page_links`
4,500,016 · `story_summary` — and the sizing paragraph:

> 93.4% of its stories sit in MORE THAN ONE container, median 4 and maximum 52; its category graph is
> a cyclic DAG up to 22 levels deep with 7,236 categories on a cycle; 715 distinct properties of which
> only 45 exceed a thousand rows; and NO property is ever both a link and a literal across 518,768
> rows, so value-kind is decidable from the property definition rather than per row.

Of all of it, only "11,285 stories" (ADR-0060) and "cyclic DAG 22 levels deep" (ADR-0016) survive.
**The last clause is the one that matters**: it is the measurement that licenses ADR-0012 and
ADR-0016 putting value-kind on the property definition rather than on the row, and it exists in no
ADR. 93.4% is the figure `supersession-check-2.md` cited as the proof of multi-placement, at
"`SPEC.md`:1445, :1461" — this file.

**L62. Where the archive is NOT used — the three negative rules.** SPEC.md:1460-1472.
**Corrected on re-check, and the correction is worth recording because it is the one place this pass
over-claimed.** The two positive jobs DO survive: CONTEXT.md's **The archive** headword reads "A test
fixture and the owner's own library seed, never a source of requirements", which carries both. What
does not survive is the negative half, and `starts empty` returns nothing:

> It is NOT shipped seed data. A fresh install by anyone else starts EMPTY, with no content of any
> kind. It is NOT on the public demo, which is deliberately other material.

CNCORE-2 user story 39 asks for an empty start ("As the owner, I want my instance to start empty, so
that I am not given somebody else's library") and nothing states it as a decision. The
not-on-the-demo rule has no home at all, and it is the rule that keeps the demo's four groups and the
owner's Doctor Who catalogue separate — which is also why L64 losing the demo groups compounds it.

**L63. The named fixture rows and the required shapes.** SPEC.md:1479-1499. ADR-0057 names
*The Daleks' Master Plan* and nothing else. Lost: *The Tenth Planet*, *The Ice Warriors*, *The Power
of the Daleks*, *Marco Polo*, each with its part counts; the corpus counts "29 stories carry missing
episodes, 13 have an animated replacement, and 11 serials are completely missing"; the five other
required shapes —

> Plus: a story in more than twenty containers. A category cycle. A story with two release dates. A
> medium value that is parse garbage. A work with no edition at all.

— and the LABELLED MATCH SET stated as its own requirement. This is `supersession-check.md`'s L14,
recovered from the deleted `decisions.md` into SPEC.md; CNCORE-9 requires a fixture "with rows chosen
for the invariant each proves and NAMED after it" and never says which rows those are.

**L64. The public demo, in full.** SPEC.md:1588-1626. ADR-0036 carries TMDB's terms. CNCORE-2 records
only that the demo is out of scope and needs four providers. Everything else returns nothing —
`Breaking Bad`, `Taylor Swift`, `Grey`, `vault tracks`, `six actors`, `full-cast`,
`Cover Art Archive` — including the four groups and the capability each was chosen to exercise:

> Harry Potter — text, video and audio in one place; THREE audiobook readings as three editions (Fry,
> Dale, and the 2025-26 full-cast productions); one book adapted as two films; one character played
> by SIX actors, TWO OF THEM IN THE SAME FILM, and one of the six only by voice
> Breaking Bad — release order and story order interleaving at EPISODE level
> Taylor Swift — Taylor's Version as one work in two editions, with vault tracks so the newer edition
> covers MORE than the original
> Grey's Anatomy — crossovers interleaving separate series

The Taylor Swift line is the only worked example anywhere of an edition covering MORE than the thing
it derives from, which is `edition_coverage` running in the direction nothing else exercises. Lost
with it: which book provider and that music comes from MusicBrainz and Cover Art Archive (CC0
metadata, licensed covers).

**L65. Breaking Bad as stop condition 2's worked example.** SPEC.md:110-114.

> Worked example: import Breaking Bad, Better Call Saul and El Camino; build a Release order container
> and a Story order container; Better Call Saul's first episode sits in both at different positions,
> and its page reads "Also appears in — Release order (#63), Story order (#1)".

CNCORE-2 and CNCORE-5 both quote the *output string* and neither says what data produces it. "#63" is
not checkable without the three titles.

**L66. The Harry Potter pass is done, and why the demo is not proof.** SPEC.md:1630-1646.

> DO NOT REPEAT IT. If you find yourself rediscovering those, you are re-deriving rules this document
> already states.
> …Harry Potter is clean, complete and precisely dated, so it exercises the EDITION axis hard and the
> playback half not at all… The archive is what proves those. The demo shows the model's range; the
> fixture is what tests it.

Returns nothing in any destination. `harry-potter-pass.md` was deleted at commit `72bdfc2` on the
strength of this paragraph, which both closes the pass and states the standing distinction between
what the demo demonstrates and what the fixture tests.

### Mechanics

**L67. Migration mechanics ADR-0047 does not carry.** SPEC.md:806-855. ADR-0047 names "a version
table, a declared floor, a startup compatibility check, three stages, and declared backups" as a
five-item list. Lost:

- the version-table precedents (`alembic_version`, `flyway_schema_history`, `schema_migrations`,
  `django_migrations`, `__EFMigrationsHistory`) and what ours records (`applied_on`, the applied
  ordering key, `head` as a named target);
- that the floor is Flyway's baseline, and that below it we refuse to start and say which version to
  upgrade to first;
- why the startup check matters: Jellyfin's has to fingerprint the schema by probing
  `pragma_table_xinfo` for three columns, "what a missing stamp costs, paid in 2025 by a ten-year-old
  project";
- the three stages BY NAME — pre-initialisation (avoid it), core initialisation (the default), app
  initialisation — and what each is for;
- "A MIGRATION DECLARES WHAT TO BACK UP, not merely that it should be backed up. For us that is the
  database and the artwork cache", with Jellyfin naming five targets "because restoring half of a
  pair is not a restore";
- and a third strategy stated as a decision rule, SPEC.md:850-855: "Plex avoids migrating
  heterogeneous data by FREEZING it… Migrate everything, quarantine what fails, or freeze the old
  semantics and let the owner choose — all three are legitimate, and which one a given migration uses
  is a decision it should state."

`alembic_version`, `pragma_table_xinfo`, `--fake-initial`, `artwork cache` and `freezing` all return
nothing.

**L68. What a group does NOT scope.** SPEC.md:181-185.

> Scopes browsing, search, WHICH PROVIDERS ARE ASKED, scanner roots, and the review queue. Does NOT
> scope the field set, the vocabularies, progress, entities, or THE SOURCE ORDER.

The positive half survives in ADR-0010 and ADR-0025. `does not scope the field set` returns nothing,
and the negative half is what stops a group becoming a partition by accretion.

**L69. Why `time_span` is a kind, and why species are characters.** SPEC.md:207-213 and 225-227.
ADR-0005 lists seven kinds and argues only the closure and the removal of `nomen`. `LRM-E11`,
`Victorian era` and `schema:Taxon` all return nothing:

> `time_span` is LRM-E11… It earns its slot the same way the entity kinds do: "stories set in the
> Victorian era, in order" is an ordered container whose members are works, which is the same shape as
> "the Doctors, in order"…
> Species go in `character`, because LRMoo F38 covers "individuals OR GROUPS of individuals";
> schema:Taxon is real-biology and wrong.

Two of the seven kinds therefore lose their justification, and the second matters more than it did:
ADR-0059 records that F38 has migrated out of LRMoo 1.1.1 into CRMsoc, so this is a citation someone
will have to re-check and will not be able to find.

**L70. A note is not a table.** SPEC.md:730-732. "Owner free-text about an item is a statement with a
`note` property sourced to the Owner — never provider-assertable, never in a public payload."
ADR-0045 says the public read path carries "no notes", presupposing a concept it never defines.
CNCORE-2 user story 20 asks for it. `supersession-check-2.md` recorded this as surviving at
"`SPEC.md`:730-732".

**L71. Two placement reasons.** SPEC.md:279-282 and 290-294. CNCORE-5's acceptance criteria assert
both behaviours; only SPEC.md says why:

> DUPLICATES ALLOWED: the same item may appear twice in one container. Needed for recaps, bookends and
> framing devices…
> NO UNIQUE CONSTRAINT ON (container_id, position) — two DIFFERENT items may share a position. A
> story-order container holding both a novel and the film that adapts it must place them at the same
> point without inventing an order between them.

The second is the only statement in the repo of what a shared position is *for*, and CNCORE-5 raises
a live question against exactly this constraint ("whether two editions of one item may share a
position… is stated explicitly") that the reason would help answer.

**L72. The list of deliberate divergences, as a list.** SPEC.md:894-915. All six entries survive as
individual ADRs. What does not survive is the fact that they are *the* six — the maintained register
of every place this model knowingly departs from the standards ADR-0059 makes governing. Nothing in
`docs/adr/` says which of the 72 records are divergences: `deliberate divergence` returns exactly one
hit, ADR-0011's own closing line —

> This is a deliberate divergence from the standards and belongs on the list the model already keeps
> of them.

— which points at a list that would no longer exist. Under ADR-0059 ("where a standard genuinely has
no answer, the gap is named rather than papered over") the register is the mechanism that rule
depends on, and its instruction is one line long: "Write these down."

**40 distinct losses**, of which L35, L37, L38, L39, L52, L60, L61 and L64 are the ones that would be
expensive or impossible to recover.

---

## 3. CONTRADICTIONS between SPEC.md and the destinations

Twenty-eight, and every single one is SPEC.md being stale. **None reveals a defect in an ADR or a
ticket.** They exist because commit `7de5955` ("Correct the ADRs against the ticket validation",
2026-09-10) applied its corrections to `docs/adr/` and did not touch `SPEC.md` — the same
correction-reaches-the-ADR-and-not-the-spec pattern `supersession-check-2.md` recorded as a
by-product for the Karakeep rename count.

That has a consequence for the verdict: SPEC.md is simultaneously **the only home for 40 things** and
**wrong in 28 places**. It cannot be deleted and it should not be read cold.

### The four that would send an implementer at a wrong build

**C1. SPEC.md tells you to keep two things that are defects.** SPEC.md:1579-1581 lists, under "Worth
keeping from the generated output":

> the turbo DB task flags; an env package validated at the top of next.config so a missing variable
> fails the BUILD and not the request

CNCORE-3's validation comment, verified by running the generator, records both as **defects 6 and 7**:
the turbo DB tasks carry `interactive: true` without `persistent`, so `db:push`, `db:generate` and
`db:migrate` abort in a non-TTY with `Cannot run interactive task ... without Terminal UI` — which
"breaks this ticket's own CI criterion"; and the env validation resolves to the WEB env, an empty
schema, so `DATABASE_URL` missing "fails the request, not the build, which is the opposite of why it
was worth keeping". SPEC.md recommends both by name.

**C2. The confidence-test rule states the wrong metric.** SPEC.md:955-958:

> that subset MUST INCLUDE ROWS WHOSE CORRECT ANSWER IS "NO MATCH" — without them recall is never
> exercised, and a scorer that says yes to everything scores perfectly.

ADR-0028 and CNCORE-9 both correct this: "It is PRECISION: on a set of only true matches a false
positive is impossible, so precision is pinned at 1.0 however bad the scorer is; recall still varies."
The commit body calls it out as a plain logic error and says why it matters: "an implementer could add
the no-match rows, gate on recall alone, and pass the defective scorer anyway." SPEC.md still carries
the error.

**C3. The migration ordering key is specified as something that cannot be produced.** SPEC.md:800:

> THE ORDERING KEY IS AN ISO8601 TIMESTAMP, never an integer.

ADR-0047 and CNCORE-4: "Drizzle's opt-in `migrations: { prefix: "timestamp" }` produces
`20260910102311` — not ISO 8601, and the default `index` prefix must be changed deliberately."
CNCORE-4 files the original wording as an acceptance criterion that is "UNACHIEVABLE as written".

**C4. The CI gate is claimed to catch something it is blind to.** SPEC.md:846-849:

> CI RUNS EMPTY TO HEAD EVERY RELEASE, and it is a gate rather than a report. A migration that is not
> forward-applicable is otherwise discovered by a user, after it has shipped, when it is already
> frozen.

ADR-0047: Drizzle applies by high-water mark, so a spliced migration is silently skipped and the run
reports success — "the empty-to-head CI gate is blind to it, because building from empty applies
everything." Reading SPEC.md alone leaves an implementer believing the gate closes a hole it does not.

### Standards citations SPEC.md asserts and the ADRs have withdrawn

**C5.** SPEC.md:223-224 — "`person` is real humans only — the one point all four standards agree on".
ADR-0006: "It is not… `schema:Person` is defined as 'A person (alive, dead, undead, or **fictional**)'
… the appeal to unanimity was false".

**C6.** SPEC.md:220-222 — LRMoo "deprecated F16 Container Work, F17 Aggregation Work and F18 Serial
Work". ADR-0004: "F18 Serial Work was NOT deprecated — LRMoo's migration table makes it 'a direct
subclass of F1 Work', and it is still declared in v1.1.1".

**C7.** SPEC.md:586-590 — "The standards have a real gap here — schema:author ranges over Person and
Organization, CIDOC CRM P14 over E39 Actor, and neither admits a fictional author". ADR-0070: "THE
STANDARDS GAP THIS WAS ORIGINALLY ARGUED FROM DOES NOT EXIST", with `E74 Group` naming Betty Crocker
and Ellery Queen. ADR-0059 records the same correction as the worked example of its own honesty rule.
The decision survives on other grounds; SPEC.md's stated reason does not.

**C8.** SPEC.md:865-866 — schema.org `isBasedOn` "unlike IFLA LRM's R22 is NOT cardinality-restricted".
ADR-0067: "Schema.org states no cardinality at all… IFLA LRM's own many-to-many relation here is R21
'is inspired by' rather than R22."

### Competitor citations SPEC.md asserts and the ADRs have corrected

**C9.** SPEC.md:906 — "Jellyfin's `BaseItemKind` has reached 36 values". ADR-0005: 37, with the reason
("generated from all classes that inherit from `BaseItem`").

**C10.** SPEC.md:902-905 — "Jellyfin's `Folder` subclasses are the real precedent, and `Playlist` the
closest analogue". ADR-0004: "Jellyfin's BoxSet is the only real precedent." Two different claims
about the same precedent.

**C11.** SPEC.md:668-681 — Plex keeps `metadata_item_views` "and then ships no feature that reads it",
concluding "neither incumbent can tell you that you watched something three times, or when". ADR-0019:
"the claim here was overstated… it ships Dashboard surfaces over it — 'View Full History', and a Top
Played panel… So the defensible claim is narrower: Plex can, on a paid tier, in an admin dashboard."

**C12.** SPEC.md:1052 — "Jellyfin's 27 `TranscodeReason` values are **each** a comparison against a
profile the client sent". ADR-0041: "28 values at v12.0 (27 at v10.11), and MOST are… four are not."

**C13.** SPEC.md:1074-1078 — "Jellyfin's `PlaybackProgressInfo` carries no duration field at all, and
Plex's client echoes the server's analysed value rather than informing it. Neither incumbent has the
channel this would need." ADR-0042: "Plex's does: `POST /:/timeline` accepts `duration`… So the
channel exists in one of the two." The conclusion survives on a different argument (timing, not
plumbing); SPEC.md's version is factually wrong.

**C14.** SPEC.md:159-162 — "Audiobookshelf began from exactly our position — an opaque anonymous token
with no row behind it". ADR-0043: "a signed JWT persisted on the user row, so it had a row but no
SESSION row."

**C15.** SPEC.md:169-176 — "Plex sends eleven headers and this is the one that matters most:
`X-Plex-Provides`, the device saying what it can do." ADR-0043: "an earlier version of this record
conflated them… the eleven `X-Plex-*` headers are client IDENTITY, `X-Plex-Provides` carries ROLES…
The CODEC decision runs on `X-Plex-Client-Profile-Name`… We need both, and they are not the same
field." SPEC.md names the wrong header for the job the capability declaration exists to do.

**C16.** SPEC.md:355-361 — Audiobookshelf's users "are told to put the narrator in the FILENAME; the
feature is marked not planned". ADR-0065: "the narrator goes in the FOLDER name, which its scanner
parses. The multi-narration request is open rather than declined."

**C17.** SPEC.md:929-931 — "OpenRefine splits /reconcile from /extend". ADR-0026: "both go to the same
endpoint distinguished by parameter rather than to separate paths." SPEC.md uses the split as its
precedent for separate endpoints, which is exactly the half that is wrong.

**C18.** SPEC.md:623-628 — "TMDB's own documented example returns 142 images for ONE item, 109 of them
posters across 15 languages". ADR-0037: "That figure is not on any current TMDB page and could not be
reproduced."

**C19.** SPEC.md:974-976 — the Plex artwork-picker complaint "live since 2011 and still open in 2026".
ADR-0024: "An earlier version dated it to 2011… 2013 is what is actually evidenced."

**C20.** SPEC.md:982-984 — Calibre "has since twice refused to reinstate a staged mode". ADR-0027: "An
earlier version said it had refused twice; a second refusal could not be found." *(ADR-0027 is
internally inconsistent here — it makes the correction at :14-16 and then repeats the uncorrected
"twice refused" at :19. See §5.)*

**C21.** SPEC.md:1259-1261 — "Plex ships the smaller complete version: one maintenance window, one
setting." ADR-0049: "Not 'one setting', as an earlier version had it… EIGHT separately toggleable
tasks with hard-coded cadences."

**C22.** SPEC.md:1273-1276 — "THE REFUSAL HAD TO MOVE BECAUSE CANONCORE IS NOT PLEX. Plex's data can be
re-derived by rescanning the files. Ours cannot". ADR-0048: "An earlier version drew a contrast with
Plex that does not hold: Plex draws the SAME line we do… The conclusion needs no contrast."

**C23.** SPEC.md:1225-1227 — Plex "had declined it since 2008, and moved for portability". ADR-0039
corrects both halves: "Plex does not give portability as the reason… And 'declined since 2008' is
unfounded — 2008 is Plex's founding year, and the earliest retrievable request on its live forum is
2013."

**C24.** SPEC.md:1655-1657 — OpenMRS reached 27 million rows, "at which point each schema change cost
about an hour of **downtime**". ADR-0012: "27 million rows at PIH and around 260 million at AMPATH, at
which point each schema change took about an hour to **RUN** — five of them, which PIH could only
afford by running them **online** with pt-online-schema-change." Downtime is precisely what they
avoided.

**C25.** SPEC.md:1667-1669 — Calibre users "work around it by creating five custom columns".
ADR-0018 has no "five": "custom series columns, one per additional series — a user on its own forum
describes 'folk that have MANY custom series type columns'."

**C26.** SPEC.md:1511-1513 — Komga "has never written an app in six years". ADR-0055: "has still not
written a first-party app seven years on."
And SPEC.md:1526-1528 — Streamyfin "still wrote ~144KB of Swift around MPVKit". ADR-0054: 74KB in
January 2026, 144KB by July, and "at `develop` on 2026-09-09 it carries 537,748 bytes of Swift and
634,101 of Kotlin."

### Version and configuration drift

**C27.** Four in the CLIENTS section, all against ADR-0053 and CNCORE-3:

- SPEC.md:1557 gives the scaffold config as "dbSetup docker". CNCORE-3: "it is `--db-setup`, not
  `--dbSetup`, and `--runtime none` is MANDATORY alongside `--backend self`" — SPEC.md gives neither.
- SPEC.md:1563-1566 — "the time sink in this stack is… getting workspace packages consumed by Next 16
  WITHOUT `transpilePackages`… Both are poorly documented traps." ADR-0053: "it is neither. Next.js
  documents it plainly", and the commit body records this as "one of the two reasons for using a
  generator has evaporated." SPEC.md still gives it as the headline reason to scaffold at all.
- SPEC.md:1569 — "FIVE DEFECTS IN THE GENERATED OUTPUT". CNCORE-3: seven, and its defect 4 is wider
  than SPEC.md's ("the api **and db** packages both").
- SPEC.md:1546 — create-t3-turbo pins better-auth "against a stable 1.7.2"; ADR-0053 measured 1.7.3
  then 1.6.31 the same afternoon. SPEC.md:1550 — ShipFullStack "frozen since 2025-11-03"; ADR-0053:
  "last CODE commit 2025-11-03 though the tip is a README edit from 2026-05-28."

### And one figure that disagrees three ways

**C28.** How much of the archive records extent. SPEC.md:1124-1126: "unknown far more often than it is
known — unrecorded for roughly **two thirds** of the stories in the archive". ADR-0060, measured
2026-09-10: "**NO** property records a part or episode count for **any** of its 11,285 stories, and
only 22 rows across the whole corpus carry a `Runtime` of any kind." Two-thirds and none-at-all are
not the same claim, and the ADR's is the measured one.

And the archive's size: SPEC.md:1496 says "the **1.8GB** database"; ADR-0057 and CNCORE-2 both say
**2.3GB**.

*(28 numbered items, covering 33 individual discrepancies — C26, C27 and C28 each bundle more than one.)*

---

## 4. IN THE ADRs OR TICKETS AND NOT IN SPEC.md — the drift, in the other direction

The brief asked what has arrived since SPEC.md, because that is the measure of how far the two have
already parted. The answer is: a great deal, and it is not evenly spread. Almost all of it landed in
two commits — `abafe13` ("Apply the verification: 50 corrections across 24 ADRs and SPEC.md",
which did touch SPEC.md) and `7de5955` ("Correct the ADRs against the ticket validation", which did
not).

### A whole decision with no representation in SPEC.md

**ADR-0001, "No release-cadence rule in the specification."** SPEC.md contains no cadence rule and no
record that its absence is a decision — which is exactly the failure mode ADR-0001 exists to prevent:
"this record exists so it is not 'fixed' by someone who finds the evidence later and assumes nobody
saw it." With it come the Ubooquity control case (2.1.2 on 2018-10-11, Komga created 2019-08-08 and
Kavita 2020-12-12 inside the gap, "the userbase did not return"), Readarr archived at 3,471 stars,
Sick Beard's "Officially sunset the repo" at 2,855, the two-failure-modes synthesis, and the
awesome-selfhosted four-month rule. This is `supersession-check.md`'s L10, successfully rehoused out
of the deleted `decisions.md` into an ADR — and it never went into SPEC.md.

### Mechanism findings that change what gets built

These are all post-SPEC.md and all actionable:

- **ADR-0014 / CNCORE-4** — the title projection **cannot be a Postgres generated column**, tested:
  `ERROR: cannot use subquery in column generation expression`. So it is trigger-maintained or
  application-maintained, and those fail differently. SPEC.md specifies the projection and never
  addresses the obvious first reach.
- **ADR-0047 / CNCORE-4** — Drizzle applies migrations by **high-water mark**, not set membership, so
  a spliced migration is silently skipped while the run prints success. Demonstrated against real
  Postgres, two databases, two schemas, both green.
- **CNCORE-4** — Drizzle writes a SHA-256 into its migrations table and **never reads it back**, so
  nothing enforces that a shipped migration is frozen.
- **ADR-0034 / CNCORE-6** — deny by **IANA range classification**, not an enumerated CIDR list,
  because OWASP's own published table omits `fd00::/8` while AWS and GCP publish live metadata
  endpoints inside it. Plus: pin via the client's DNS `lookup` hook, because rewriting the URL host
  to an IP breaks SNI and silently degrades certificate validation; check every A and AAAA record
  because Node now defaults `autoSelectFamily` to true; and the deliberate departure from OWASP on
  following redirects.
- **CNCORE-6** — do not build the CI network gate on `nock`: `nock@14.0.17` does not intercept
  `fetch`, so `disableNetConnect()` prints its message and then makes real network calls. Use
  undici's `MockAgent`. And Node's `--allow-net` is Stability 1.1, absent from Node 24 LTS.
  **(CNCORE-50, 2026-09-11: availability was never the binding reason. `--allow-net` is
  all-or-nothing -- it accepts an `=host` value and ignores it -- so it cannot express the gate's
  "closed, except loopback" on any major. ADR-0103 now rests on that instead.)**
- **CNCORE-5** — `searchParams` is a Promise and using it opts the **whole route** out of static
  rendering, including the bare canonical URL. And Postgres's default `NULLS DISTINCT` would defeat
  the placement uniqueness index if `edition_id` were ever added to it.
- **ADR-0066 / CNCORE-5** — the non-identifying query needs a **mechanism**: RFC 6596's canonical link
  relation, emitted on both URL forms. SPEC.md declares it non-identifying and stops there, which
  leaves the declaration invisible to every crawler, cache and consumer.
- **ADR-0035 / CNCORE-8** — TMDB now defaults to the **API Read Access Token as a Bearer header**, not
  the `api_key` query parameter.
- **CNCORE-8** — TMDB documents **no rate-limit headers at all**; the `X-RateLimit-*` family and the
  40-per-10-seconds figure belong to a regime disabled in December 2019. Treat the 429 as the only
  signal.
- **ADR-0036 / CNCORE-8** — a **second TMDB AI clause**, in the 1.C restrictions list, with no
  written-agreement escape; and the image-hosting prohibition is *broader* than SPEC.md's reading
  because of its trailing "etc.".
- **CNCORE-9** — the committed fixture may be TMDB Content, and **a committed fixture is a cache that
  never expires**: no read-time `max_cache_age` check will ever expire a file in git.
- **ADR-0052 / CNCORE-3** — two of the four shared packages **do not exist in the generator's output**
  and are new work; its design tokens ship as CSS custom properties (102 declarations, not the 84 first
  reported), the exact form ADR-0052 rules
  out.
- **ADR-0053 / CNCORE-3** — the `transpilePackages` reason has evaporated, and the verified flags are
  `--db-setup` and a mandatory `--runtime none`.
- **CNCORE-3** — pinned versions as of 2026-09-10: create-better-t-stack 3.42.2 · Next 16.3.4 · oRPC
  1.15.0 · Drizzle ORM 0.45.2 · Drizzle Kit 0.31.10 · Tailwind 4.3.3 · Vitest 5.0.0 · pnpm 12.3.4 ·
  Turborepo 2.10.12 · PostgreSQL 18.6. None of this is in SPEC.md.

### Evidence corrections that strengthen decisions SPEC.md states bare

ADR-0003's `LocationType.Virtual` finding (Jellyfin *does* have pathless virtual items internally, so
the honest claim is that an item cannot be CREATED without a file) · ADR-0004's full deprecation list
(F14, F15, F16, F17, F19, F20, F21) · ADR-0009's explicit scoping of "no standard gives both" to the
standards in play, with METS structMap, EAD and rdf:Seq named as unsurveyed · ADR-0010's Plex
reversal quote of 2025-07-16 ("in hindsight, we recognize this wasn't the right approach") ·
ADR-0011's finding that the Library of Congress never published the reason attributed to BIBFRAME ·
ADR-0012's AMPATH 260 million rows and pt-online-schema-change · ADR-0015's narrowing of the Magento
trigger (Store View to Website is safe; it fires on narrowing to global) · ADR-0016's "same NAME,
matched as strings" for Plex's cross-library collections · ADR-0018's Calibre forum quote ·
ADR-0021's Kodi v22 inclusive form `S01E01-E04` · ADR-0022's THREE Jellyfin arrays rather than two ·
ADR-0023's forum provenance for the hash, the moderator's wrong answer, and the withdrawn watch-state
claim · ADR-0027's Calibre bug #926524 · ADR-0032's note that the W3C spec contradicts itself and a
Version Negotiation section was landed and reverted in July 2026 · ADR-0033's Emby commit hash and
the fact that the retrofit shipped its prioritisation loop dead · ADR-0035's third and fourth
hardcoded Jellyfin keys with no override at all · ADR-0049's eight separately toggleable Plex tasks ·
ADR-0055 and ADR-0054's updated Komga and Streamyfin figures · ADR-0059's dated standard versions ·
ADR-0060's measurement that NO property records extent · ADR-0065's Calibre declared-order-only
finding · ADR-0068's confirmation that Jellyfin 12.0 (2026-09-08) ships `COUNT(DISTINCT)` over an
`AncestorIds` closure · ADR-0070's Betty Crocker and Ellery Queen · ADR-0071's MARC 883 first
indicator having four values, the `#` being the honest answer for unrecorded origin, and the
correction that MusicBrainz has a bot PRIVILEGE bit rather than a naming convention.

### Whole artefacts that exist only on the tracker

- **CNCORE-2's 43 user stories.** SPEC.md has none. They are the only statement in the repo of what
  the product does from the owner's side, and several encode decisions in usable form (story 39, the
  empty fresh install; story 20, the owner's own note).
- **CNCORE-2's two-seam testing decision**, with the argument for why the contract test must not run
  through the app: "the app's provider layer would normalise both into one shape before the assertion
  saw them, so the test would pass whether or not the providers agreed."
- **CNCORE-8's ruling-out of Pact** and the dormant JS OpenAPI-assertion niche.
- **The dependency graph itself** — which ticket blocks which. SPEC.md has no build order.

---

## 5. By-products — problems found inside the surviving documents

Noted because the method turns them up, not because they bear on the verdict.

**B1. ADR-0027 contradicts itself, in the same record, six lines apart.** At `:14-16`:

> Calibre's staged-mode refusal is recorded as a single one (bug #926524, 2012-02-04, Won't Fix…). An
> earlier version said it had refused twice; a second refusal could not be found.

At `:19`:

> …deleted it in 2011 for a background queue plus optional review, and has twice refused to reinstate
> a staged mode.

The correction was written above the sentence it corrects and the sentence was left standing. Whoever
fixes C20 in SPEC.md should fix this at the same time, or the "corrected" destination is no better.

**B2. ADR-0047 has a broken internal pointer.** `:23` refers to "the spliced-migration divergence
described **below**"; it is described at `:11-15`, above. An artefact of splicing a correction into a
paragraph that was already there.

**B3. `versions` absence means 1 in two places and 0.1 in a third.** ADR-0032 was retitled from
"absence means version 1" to "absence means the first version" and now records that the W3C precedent
means 0.1 rather than 1. SPEC.md:997 and CNCORE-2 both still say "absence means version 1". For CMPP
that is probably correct and merely unqualified — but the ticket did not receive the correction the
ADR did, which is the same drift pattern in miniature.

**B4. All 72 ADRs are `status: proposed`, and CNCORE-2 calls them the authority.** CNCORE-2: "every
decision referenced is an ADR in `docs/adr/`… the ADR is the authority and this is the index." No ADR
has been accepted. Nothing in this check turns on it, but if SPEC.md is deleted, the repo's entire
decision record becomes a set of formally provisional documents that a ticket describes as binding.

**B5. If SPEC.md goes, four research files point at nothing.** `docs/research/README.md` and the
three `verify-adr-*.md` files reference `SPEC.md` by name, as do all three supersession checks and
four files under `resolution/`. CNCORE-2's Further Notes reference it too: "`SPEC.md` carries the
result and `docs/research/` carries the evidence." That is on the tracker and cannot be fixed by a
commit in this repo.

---

## 6. Recommendation

**Keep `SPEC.md`, and stop treating it as superseded.** The comparison this check was asked to make
does not come out the way the previous two did. `decisions.md`, `GRILL-DECISIONS.md`,
`harry-potter-pass.md` and `tier3-vocabulary.md` were all *predecessors* that a successor had mostly
absorbed. SPEC.md is not a predecessor of the ADRs — the ADRs were extracted **from** it, and the
extraction took the decisions and left the rules, the facts, the constraints, the schema, the
fixture, the archive and the demo behind.

If the aim is to end up with SPEC.md deleted, the work is real and it is roughly four commits:

1. **Carry the sections with no ADR home.** STANDING RULES (L35, L36), CONSTRAINTS (L37), FACTS
   (L38-L41), the reading contract (L34) and the product description (L33) need somewhere to live.
   They are rules and facts rather than decisions, so ADRs are the wrong shape; `CONTEXT.md` is the
   wrong shape too. The natural home is `CLAUDE.md` for the operating rules and a short
   `docs/adr/`-adjacent `RULES.md` for the rest — but that is a decision, not a finding.
2. **Give the schema a home.** L42, L43, L48, L49, L57 and the statements row signature. Migration 1's
   contents are named in ADR-0051 and CNCORE-2/4 without a single column between them, and the freeze
   rules (SPEC.md:565-567, "THE SEEDED TARGETS AND VALUE-KINDS ARE STATED HERE BECAUSE THEY FREEZE ON
   THE FIRST INSERT") make that a migration-1 problem rather than a documentation one.
3. **Write the missing ADRs.** On the evidence of this check the gaps are: the completion rules (L52),
   extras (L53), provider distribution (L55), the abridgement rule (L47), `release_date`'s definition
   (L46), rating scales (L44), the projection rebuild rule (L41), and the demo (L64).
4. **Extend ADR-0057 and add a fixture record.** The archive's figures (L61), its two private jobs
   (L62) and the named fixture rows with the required shapes (L63).

Until then, and this is the part that should not wait: **SPEC.md is wrong in 28 places and four of
them would produce a wrong build.** C1 recommends keeping two generator defects by name, C2 states the
wrong metric for the confidence gate, C3 specifies an unachievable ordering key, and C4 claims the CI
gate closes a hole it is blind to. Fixing those four is cheap and does not depend on any decision
about deletion.

Note also what this check did **not** find, since it was the stated worry: the post-cap half is
covered. The scanner, playback, progress, watch events, backup, restore, the scheduler, delete, merge,
artwork, the clients and the archive's role all have ADRs, and those ADRs are better sourced than
SPEC.md's versions of the same material. The losses are not in the half nobody has built yet. They are
in the half that was never a decision.
