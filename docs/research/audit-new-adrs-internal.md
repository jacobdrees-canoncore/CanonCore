# Internal consistency audit: ADR-0073..0099, the 14 amendments, CONTEXT.md, CLAUDE.md, physical-schema.md

Date: 2026-09-10. Scope: `git diff origin/main..HEAD -- docs/adr/ CONTEXT.md CLAUDE.md
docs/physical-schema.md`. No web lookups; every owner cited here is a file in this repo. Every
record 0073-0099 was read in full, as was every amendment and every record either cites.

Method: for each cross-reference in the new and amended text, the TARGET record was read and checked
against the claim the citing record makes about it. Contradiction checks were run over the pairs
named in the brief plus every pair the reading turned up.

---

## 1. Contradictions between records

### 1.1 ADR-0077's exclude-by-kind cannot exclude the thing it says it excludes

`docs/adr/0077-work-browsing-excludes-entities-by-kind.md:13-16` decides "exclude BY KIND", and
closes the paragraph with "Entity containers are reached deliberately rather than turning up in
'latest'."

But `docs/adr/0004-containers-are-items.md:7-8` says "containers fold into `work` rather than getting
a kind of their own", and `CONTEXT.md:19-21` repeats it: "**Work**: The item kind for stories and for
containers. Containers fold into it; there is no separate kind."

So "the Doctors, in order" is an item of kind `work` with `is_container` true
(`docs/physical-schema.md:49-51`). A filter on kind returns it. The kind mechanism excludes the
MEMBERS of an entity container and cannot touch the container itself, which is the case 0077 names.

This is the record's central mechanism failing on the record's own example. Either work-browsing
filters on something besides kind (a category statement, a `is_container` + member-kind test, a
per-container flag), or the sentence at 0077:15-16 is not deliverable. Nothing anywhere else supplies
the missing test.

### 1.2 ADR-0029's reference-table rule contradicts vocabularies

`docs/adr/0029-only-the-product-adds-fields.md:15-17` (new): "A reference table holds no owner data,
and nothing is minted into one outside a migration."

`docs/adr/0030-vocabularies-raw-uniqueness.md:7-8`: "Every vocabulary is a lookup table with
`retired` and a separate `quarantine` state". `CONTEXT.md:184-185`: "**Quarantine**: A vocabulary
value that arrived broken from an import, held apart from the live set."
`docs/physical-schema.md:102-104` calls vocabularies "One lookup table per property's allowed
values".

A quarantine state exists precisely because values ARRIVE AT RUNTIME, from an import, into the lookup
table. A vocabulary is the textbook reference table, and `items.kind` is described as "(lookup)" at
`docs/physical-schema.md:49`. 0029's new paragraph never defines "reference table", so on the plain
reading it forbids the mechanism 0030 is built on.

The fix is one clause: either 0029 says "reference table" excludes vocabularies, or 0030's quarantine
rows are declared not to be minted rows. As written an implementer has to guess.

### 1.3 ADR-0074 conflates the category graph with the container graph, and leaves container cycles
unaddressed

`docs/adr/0074-...md:5` titles the record "CATEGORY cycles are refused by the database". Line 9-10:
"The database carries an acyclicity constraint and an ancestor closure". Line 18: "ADR-0068 reads the
ancestor closure this creates."

`docs/adr/0068-container-progress-is-computed-on-read.md:7-8` derives container progress "from the
ancestor closure, deduped with `COUNT(DISTINCT item)`" — that is the CONTAINER ancestry built from
placements, not the category graph. Two different graphs over two different tables.

`docs/physical-schema.md:31` resolves it the other way, scoping the constraint and closure to "the
category graph (ADR-0074)" — which leaves 0068's closure with no table at all.

Consequence: nothing in 99 records forbids a placement cycle (container A inside B inside A). ADR-0009
allows an item to sit in many containers and ADR-0004 makes containers items, so the placement graph
can cycle exactly as the category graph does. 0068's ancestor walk would not return. The visited-set
half of 0074 would save it; the record's title says the constraint is about categories.

### 1.4 ADR-0033's "archive extract" is the whole archive, and the arithmetic does not hold

`docs/adr/0033-...md:27-29` (new): "roughly 50-150KB each, a few hundred megabytes across the archive
extract's 11,285 stories".

`docs/adr/0057-...md:20-22` measures the ARCHIVE at "stories 11,285". `docs/adr/0057-...md:49-50`:
"The extract is a FIXTURE, not the archive ... it must stay small enough to read." `CONTEXT.md:289-292`
defines "**The fixture**: The small deterministic extract of the archive that is committed".

So 11,285 stories is the archive, not the extract, and 0033 attaches the archive's figure to the word
CONTEXT.md reserves for the small committed fixture.

Separately, the arithmetic: 11,285 x 50KB = 564MB; x 150KB = 1.7GB. "A few hundred megabytes" is
below the bottom of the stated range, and that is one image per story. The bounded-store argument
survives; the number does not.

### 1.5 ADR-0076's "never incrementally" against ADR-0014's trigger option

`docs/adr/0076-...md:7-8`: "Rebuild the read projection WHOLESALE, never incrementally".

`docs/adr/0014-title-is-a-projection.md:13-16`: "the projection is trigger-maintained or
application-maintained, and those have materially different failure modes ... Pick one deliberately."

A trigger maintains the projection incrementally, per write, by definition. If 0076's "never
incrementally" is read as covering steady-state maintenance it forecloses the trigger option 0014
says to choose deliberately; if it is read as covering only the reconciliation pass
(`docs/adr/0049-...md:7-8` schedules "projection reconciliation") it is compatible. The record does
not say which, and 0076 is the record that claims to close 0014's open question.

### 1.6 physical-schema drops ADR-0017's uniqueness constraint

`docs/physical-schema.md:58-60` gives placements as `(id, owner_id, container_id, item_id, position,
edition_id NULL, rank)` with "No unique constraint on `(container_id, position)`, and duplicates
within one container are allowed", citing ADR-0009 and ADR-0092.

`docs/adr/0017-placements-carry-sources-and-rank.md:7`: "(container, item, position) is unique."

The two constraints are compatible — 0009's is about (container, position), 0017's about the triple —
and 0017:15-17 explicitly reconciles them. But the column list states only the NEGATIVE, cites only
the record carrying the negative, and omits the one constraint an implementer must actually create.
Read alone, the placements entry says there is no uniqueness on placements at all.

### 1.7 ADR-0090: country is nullable, and unknown is never absent

`docs/adr/0090-country-is-a-second-axis.md:7`: "A statement carries a NULLABLE `country` alongside its
language." Line 15: "Unknown is the value `none`, never an absent one."

The `none` spelling comes from IIIF and is about language, but the sentence is unqualified and sits in
a record titled for country. `docs/physical-schema.md:88` implements the split reading (`language,
country NULL`). Two unknowns, two representations, in one record, unexplained.

### 1.8 ADR-0012's "every value is a statement" against the column carve-outs

`docs/adr/0012-...md:7-9`: "Every value and every relationship is a statement".
`docs/adr/0042-...md:8` puts duration, container, codecs, resolution, bitrate and chapters on the file
row; `docs/adr/0038-artwork-is-a-table.md:5` makes artwork a table.

0042's new section (`:23-29`) names and answers this ("measured off the bytes rather than claimed by
anybody"), which is the right treatment. 0038 does not, and 0012 itself still asserts the absolute.
Low severity because 0042 defuses it, but 0012's opening sentence is now false as written.

### 1.9 ADR-0094 "no content of any kind" against the committed fixture

`docs/adr/0094-...md:7-8`: "A fresh install by anyone else starts EMPTY, with no content of any kind."
`docs/adr/0057-...md:49`: "The extract is a FIXTURE ... Committing it does not license vendoring the
database."

The fixture ships in the repository, so a fresh clone does contain archive-derived rows. The intent
(test fixture never loaded as seed data) is obvious but unstated, and the two sentences read as a
contradiction to anyone checking whether the fixture may be loaded at first run.

### 1.10 ADR-0099 against ADR-0093

`docs/adr/0093-...md:7-11` forbids naming screens before they exist: "These are decided when screens
exist." `docs/adr/0099-...md:14-16` claims the exemption "because this screen does exist."

It does not: `CLAUDE.md:8` says "Nothing is implemented yet". The screen exists in a stop condition,
which is a requirement, not a screen. 0099 is a screen-layout decision (one list plus a filter, not a
split layout) taken before the screen exists, i.e. the thing 0093 refuses, with the exemption argued
from a false premise.

### 1.11 Pairs checked and found CONSISTENT

- 0009 (no unique constraint on container_id, position) vs 0018, 0061, 0062: consistent. 0017:15-17
  reconciles duplicates with the triple constraint; 0061:14 depends on duplicates being allowed;
  0062 is unaffected.
- 0085 vs 0041 on force-complete: both refuse it (the CITATION is wrong, see 3.8, but the positions
  agree). 0085 vs 0060 on extent: consistent.
- 0087 vs 0064: an extra is a separate work, an edition is a re-rendering; 0083's closed three-value
  role list keeps them apart. No conflict.
- 0073 vs 0014 and 0081: consistent (0081's storage defers to 0073). The precision column has no home
  in the schema — see 7.
- 0091 vs 0090 and CONTEXT.md's Language headword: consistent.
- 0075 vs 0049: consistent (0049:7-8 does schedule tombstone compaction).
- 0089 vs 0035 and 0069: consistent.
- 0094 vs 0095: consistent (demo content is deliberately not the archive).
- 0010's scope list vs 0025: consistent, and correctly cited.

---

## 2. Records that contradict themselves

### 2.1 ADR-0085 — the no-duration paragraph deletes the book branch

`docs/adr/0085-...md:9-11`: "Where it does not [have a duration] — a book, a comic — completion is
`progression` crossing a threshold".

`docs/adr/0085-...md:16-18`: "WHERE NEITHER THE PROBE NOR THE CLIENT HAS SUPPLIED A DURATION,
COMPLETION IS UNKNOWN. There is no percentage fallback available, because a percentage IS a fraction
of the duration: with no duration there is no percentage either."

A book has no duration ever. By the letter of the third paragraph every book's completion is UNKNOWN,
which deletes the branch two sentences earlier. And "a percentage IS a fraction of the duration"
contradicts `docs/adr/0020-progress-is-per-edition.md:11-13`, where progression is a normalised
`totalProgression` 0..1 adopted precisely "because `text` is a first-class medium and every
clock-shaped rule is inexpressible for a book", and `CONTEXT.md:266-267`: "**Progression**: How far
through an edition a position is, from 0 to 1, whatever the medium."

The intended rule is almost certainly "where the locator is one that HAS a duration behind it and the
duration is missing, completion is unknown". As written the record's three paragraphs cannot all hold.

Secondary, same record: the Evidence section (`:31-36`) says Audiobookshelf "ships the percentage mode
this model rejects elsewhere", while the body (`:9-11`) cites Audiobookshelf as precedent for the
percentage-threshold branch. Both can be true (rejected for timed media, adopted for untimed) but the
record never says so, and this is exactly the "repeats a claim it corrected" shape the brief asks
about.

### 2.2 ADR-0089 — the title counts four tiers, the body says there are three

`docs/adr/0089-...md:5` "Providers come in four distribution tiers"; `:12-13` tier 4 is "Providers
whose source has licensed them to ONE person are private and stay private"; `:15` "Tier 4 is a
licence-compliance rule rather than a packaging preference".

Tier 3 is "PRIVATE PROVIDERS — any URL added directly". Tier 4 is a subset of tier 3 with a rule
attached, and the record admits it is not a distribution tier. Three tiers and one rule.

### 2.3 ADR-0005 — the time_span argument uses the wrong shape

`docs/adr/0005-...md:14-17` (new): time_span "earns its slot the same way the entity kinds do:
'stories set in the Victorian era, in order' is an ordered container whose members are WORKS, which is
the same shape as 'the Doctors, in order' — the case that justified putting entities in the items
table at all."

A container whose members are works is not the same shape as a container whose members are entities.
The entity-kinds argument is that entities must be items because they are MEMBERS of ordered
containers; the time_span example makes the time span the container's SUBJECT and its members works,
which is the ordinary case that needs no new kind. Whatever justifies `time_span`, this paragraph does
not.

### 2.4 ADR-0079 — "roughly a dozen", nine listed

`docs/adr/0079-...md:7-8` says "Roughly a dozen properties to start" and lists nine: `category`,
`portrayed_by`, `appears_in`, `based_on`, `created_by`, `credited_to`, `released`, `part_of`, `image`.
Repeated with the same mismatch at `docs/physical-schema.md:99-100`. Given the record's whole argument
is that a short list is the safe one, the count should be the count.

### 2.5 ADR-0059 — the register claims to be enumerable and is not

`docs/adr/0059-...md:27-29` (new): "the departure is recorded HERE, as a list, so it can be read as a
list ... a divergence nobody can enumerate has not been named, it has been mentioned."

Six entries follow. At least four deliberate divergences already written down elsewhere are missing:

- `docs/adr/0004-...md:13-14`: "This deviates from ORE Aggregations and IIIF Ranges, which are both
  their own classes."
- `docs/adr/0006-...md:9` and `:12-16`: schema.org admits fictional persons; "The reason is ours, not
  the standards'."
- `docs/adr/0034-...md:33-35`: "WE ALSO DEPART FROM OWASP ON REDIRECTS, deliberately ... Written down
  as a departure rather than left as an omission."
- `docs/adr/0070-...md:22-25`: "So the standards would permit one property. We split anyway, for a
  reason of ours."

And one entry does not belong: `docs/adr/0059-...md:41-42` lists ADR-0016, whose argument
(`docs/adr/0016-...md:11-20`) is made from the archive and from Plex's cross-library collections and
names no standard it departs from.

A register that omits four known departures and includes one non-departure fails its own test on the
day it is written.

---

## 3. Wrong or unsupported cross-references

Each was checked by reading the target.

### 3.1 `docs/adr/0074-...md:13-14` cites ADR-0016 for "7,236 categories on a cycle"

`docs/adr/0016-...md:13-14` supports "cyclic DAG 22 levels deep". The 7,236 figure appears only at
`docs/adr/0057-...md:25-26`. Half the claim is uncited.

### 3.2 `docs/adr/0074-...md:18` — "ADR-0068 reads the ancestor closure this creates"

0068 reads the CONTAINER ancestor closure (`docs/adr/0068-...md:7-8`), not the category closure 0074
creates. See 1.3.

### 3.3 `docs/adr/0075-...md:10-12` — "ADR-0040 ... only works if the stamp has a sequence to sit in"

`docs/adr/0040-...md:7-8` says a merge stamps ITS ID on every row it touches and reversal is a query
over that id. Nothing in 0040 needs a monotonic change sequence; it needs a merge-id column. The
change sequence may well be a good idea, but 0040 is not the argument for it, and 0040 is half of
0075's stated justification.

### 3.4 `docs/adr/0076-...md:10` — "ADR-0014 ... requires naming its failure mode. This is that
failure mode named: two rebuilds racing"

`docs/adr/0014-...md:13-16` names two failure modes and neither is a race: a trigger "runs inside every
write", and application-maintained "can be bypassed by anything that writes directly". 0014's actual
demand — "Pick one deliberately" — is not answered by 0076 or anywhere else. See 7.

### 3.5 `docs/adr/0077-...md:8-11` — "the case that justified putting entities in the items table at
all (ADR-0004)"

`docs/adr/0004-...md` is about containers folding into `work` and there being no collection kind. It
says nothing about entities being items. The record that carries that case is ADR-0005, whose own new
text (`docs/adr/0005-...md:16-17`) uses the identical phrase "the case that justified putting entities
in the items table at all". The citation should be 0005.

### 3.6 `docs/adr/0081-...md:14` — "the third of the three columns ADR-0014 projects"

`docs/adr/0014-...md:5` is titled "`title` and `sort_name` are columns that project statements" and
names two. `release_date` becomes a projected column by virtue of 0081 itself
(`docs/physical-schema.md:55` credits both records). 0014 does not project three columns.

### 3.7 `docs/adr/0085-...md:28-29` — "'unknown is never a fabricated true', which ADR-0060 otherwise
asserts bare"

`docs/adr/0060-...md` asserts "unknown is the absence of a row" and forbids deriving extent. The phrase
"a fabricated true, which this model forbids" is asserted bare at `docs/adr/0041-...md:21`, and
repeated at `docs/adr/0088-...md:8-9`. 0060 is the wrong target for that sentence.

### 3.8 `docs/adr/0085-...md:21-22` and `docs/adr/0087-...md:21-22` — what ADR-0041's refusal turns on

Both new records say 0041's refusal of a force-complete rule turns on extras being solved properly
elsewhere. `docs/adr/0041-...md:19-21` gives a different reason entirely: "an earlier one completed by
duration rather than position, so thirty seconds into a four-minute trailer marked it watched — a
fabricated true". Two records now attribute a rationale to 0041 that 0041 does not carry. Either 0041
gains the sentence or the two citing records stop asserting it.

### 3.9 `docs/adr/0094-...md:11-12` — "ADR-0057 gives the archive two jobs, both private: the test
fixture, and the owner's own library"

`docs/adr/0057-...md:7-16` gives it one and a bit: a queried source for a committed fixture, and a
stress test. "The owner's own library" appears at `CONTEXT.md:285-287`, in the glossary, and nowhere in
an ADR. The decision is real and is 0094's own; the citation sends the reader to a record that does
not make it.

### 3.10 `docs/adr/0009-...md:30-32` and `docs/adr/0078-...md:15-17` cite each other; the owner is 0018

0009's new text argues the stable surrogate placement id and cites ADR-0078 ("Same reasoning as").
0078 argues surrogate entity ids and cites "ADR-0009's stable surrogate placement id ... taken for the
same reason". Neither cites `docs/adr/0018-ordering-lives-on-the-placement.md:12-14`, which already
decided it, in the same words, against the same Jellyfin evidence. Circular citation around an
uncited owner.

### 3.11 `docs/adr/0099-...md:14-16` — "because this screen does exist"

Nothing is implemented (`CLAUDE.md:8`). The premise the exemption from 0093 rests on is false.

### Direction of pointers

`docs/adr/0047-...md:23` now correctly reads "described above" (the splice mechanics are at :11-15).
`docs/adr/0051-...md:23` "the forensic record above" points to :11-14. `docs/adr/0059-...md:27` "the
standards above" points to :14-17. No remaining wrong-direction pointers found in the new or amended
text.

---

## 4. Duplication

Verbatim or near-verbatim, with the record that already owned the text:

| Duplicate | Owner | Note |
|---|---|---|
| `0089:20-22` | `0031:14-16` | "Every provider we write lives in a separate repo ... separate deploy, separate lifecycle, no shared code. CanonCore knows only a URL, a credential and a validated response shape" — near-verbatim, whole paragraph. 0089 cites 0031 mid-sentence and restates it anyway. |
| `0098:14-16` | `0063:10-11` | "A stage production and a video game are neither, and both are still complete [catalogue] entries: a `work` item with a category statement and zero editions." Verbatim. |
| `0009:30-32` | `0018:12-14` | Stable surrogate placement id, Jellyfin's (parent, position) key, stale external references. Same argument, same evidence. |
| `0085:13-14`, `0041:18-19`, `0063:14-15` | 0085 (by title) | "Completion branches on the locator rather than the medium enum, so a fifth medium never reopens the rule" is asserted in three records. 0085 is the record whose title it is; the other two state it as a decision without citing it. |
| `0009:36-38` | `0057:24-26` | 93.4% multi-placement, median 4, maximum 52. Same measurement, twice, no citation between them. |
| `0057:44-47` | `0028:11-13` | "on a set of only true matches a false positive is impossible, so precision is pinned at 1.0 however bad the scorer" — near-verbatim. 0057 does cite 0028, then restates the argument in full. |
| `0012:26-28` and `0057:27-28` | either | "no property is ever both a link and a literal across 518,768 rows" appears in both; 0057 cites 0012, so this one is acceptable. |
| `physical-schema.md:22-26` | `0051:16-19` | Migration 1's contents, verbatim. Defensible in a column list, but it is a decision copied rather than referenced. |
| `physical-schema.md:99-100` | `0079:7-8` | Seeded property list, verbatim, including the dozen-versus-nine mismatch. |
| `0089:7-9` | `0035:7-8` | "bundled provider definitions ship disabled" / "all disabled by default". Cited, so acceptable. |
| `0097:19-20`, `CONTEXT.md:7`, `CLAUDE.md:6-7` | — | "domain-general ... a media server in its own right rather than a client of one" in three files. Positioning, not a decision; fine in CLAUDE.md and CONTEXT.md, redundant as the closing paragraph of an ADR about media ingestion. |
| `CLAUDE.md:25` | `0051:21-23` | "cut scope inside this repository" verbatim. Deliberate reinforcement. |
| `CLAUDE.md:27` | `0093` (whole record) | "The first version ends in a rendered page, not a report." CLAUDE.md already carries 0093's entire operative content. |

Two records deciding the same thing: 0083 (role list closed at three, so an extra cannot be a file
role) and 0087 (an extra is a work, not a file role) close the same question from two directions with
different evidence and no cross-reference. Not duplication of text, but a reader who finds one will
not know the other exists.

---

## 5. The ADR three tests

Tests: (a) hard to reverse, (b) surprising without context, (c) a real trade-off with genuine
alternatives.

**Pass:** 0073, 0074, 0075, 0076, 0077, 0078, 0080, 0081, 0082, 0083, 0084, 0085, 0087, 0088, 0089,
0090, 0091, 0092, 0094, 0096, 0097.

**Fail:**

- **ADR-0086** (progress reports every ten seconds and on every interaction). Fails (a) and (c). A
  reporting interval is a constant in a client; changing it costs one line and no data. The record's
  own supporting material — Emby frames it as a ceiling, Plex's docs give the same figure, Jellyfin's
  web client ships it — establishes it as the industry default, i.e. the opposite of a trade-off with
  genuine alternatives. This is a implementation note. It belongs in the ticket for the playback
  slice, or as one line in 0019.
- **ADR-0093** (no screen vocabulary before the screen exists). Fails (a) and (c): it is a process
  instruction, trivially reversible, and its own text says it is "the same evidence ADR-0051 rests on
  read from the other end", i.e. it introduces no new evidence and no alternative. `CLAUDE.md:27`
  already carries it as a principle, which is where an instruction to the people doing the work
  belongs.
- **ADR-0095** (the demo is four groups). Fails (a): demo content is the most reversible thing in the
  product — a different group can be swapped in at any time at zero cost. The genuinely durable part
  is the capability-coverage argument (Taylor Swift as the only case of an edition covering MORE than
  its source), and that is a requirement, not a decision. It belongs on Linear beside the demo ticket,
  or in a `docs/demo.md`. Note that its provider-funding paragraph (`:21-26`) is planning content too.
- **ADR-0098** (cataloguing and displaying are separable). Fails (b) and (c): it is a restatement.
  `docs/adr/0003-...md` already decides items exist with no file; `docs/adr/0063-...md:10-11` already
  contains 0098's second paragraph verbatim. What is new is the reversal of an earlier rule, and this
  repo's established form for that is a `## Supersedes` section inside the affected record
  (`0005:23-31`, `0039:29-33`, `0048:26-31`, `0051:25-29`). It should be a Supersedes section in 0063.
- **ADR-0099** ("Also appears in" is one list with a filter). Fails (a): a list layout with a filter
  versus two lists is a UI choice reversible in an afternoon, and the record makes no claim otherwise.
  It also breaks 0093 on a false premise (1.10). If the stop condition needs the page to read a
  certain way, that is a requirement on the ticket.
- **ADR-0079** (seed only what the first surface needs) — borderline, flagged. It fails (a) by its own
  argument: "Adding one is an INSERT, not a migration, so there is no reason to be speculative"
  (`:9-10`). The irreversible part is 0015's freeze, which 0079 correctly cites rather than owns. What
  remains is a starting list, which is exactly what `docs/physical-schema.md` is for and where it is
  already written. Keep it only if the list itself is meant to be binding.

---

## 6. CONTEXT.md discipline

`CLAUDE.md:72` makes CONTEXT.md "the glossary". A glossary entry says what a word means and what to
avoid. These smuggle in more:

- `CONTEXT.md:44-46` **Work-browsing** — "It returns works and ignores the entity kinds; a surface
  answering 'what is in this catalogue' returns everything." That is ADR-0077's decision, restated. A
  definition would stop at "any surface answering 'what can I watch'".
- `CONTEXT.md:48-51` **Catalogue search** — "returning all seven item kinds grouped by kind with works
  first". Grouping and ordering are output decisions (0077:23-24), not meaning. "Not the CMPP
  operation of the same name" and the `_Avoid_` line are correct glossary content and should be all
  that remains.
- `CONTEXT.md:167-169` **Date** — "held as an EDTF string with its precision beside it" is a storage
  format (ADR-0073). The meaning is "a date value that may be partial"; the rest is implementation.
- `CONTEXT.md:171-173` **Note** — "Never provider-assertable and never in a public payload" is two
  decisions (0096, 0045).
- `CONTEXT.md:163-165` **Country** — "Content ratings key on it where artwork keys on language" is
  0090's rationale, not a definition.
- `CONTEXT.md:285-287` **The archive** — "the owner's own library seed" is a decision that appears in
  no ADR (0094 makes the negative half; see 3.9), and "never shipped to anyone else" is 0094 restated.
- `CONTEXT.md:294-296` **The demo** — "it never stands in for the fixture as proof" is an argument
  from 0095:28-29.
- `CONTEXT.md:289-292` **The fixture** — acceptable, apart from "The fixture is what TESTS the model",
  which is 0095's sentence.
- `CONTEXT.md:7` — "It is domain-general, and it is a media server in its own right rather than a
  client of one" is positioning, and the file's preamble is arguably the right place for it, but it is
  not vocabulary.

Also, but minor:

- `CONTEXT.md:35-37` **Group** defines the scope as "the items, providers and scanner roots a view is
  narrowed to", while `docs/adr/0010-...md:16` closes the list at five: browsing, search, which
  providers are asked, scanner roots, and the review queue. The glossary drops two.
- `CONTEXT.md:157-161` **Language** is now correct and glossary-shaped. Good.
- **Redundant file** (`:128-130`) and **Multi-placement** (`:87-89`) both carry `_Avoid_: duplicate`,
  for two different senses. Meanwhile `docs/adr/0009:22`, `0017:15-16` and `0061:14` use "duplicate"
  in a third sense (the same item twice in one container). See 8.

---

## 7. `docs/physical-schema.md` — what an implementer cannot find

Every table the file names carries columns. The problem is the tables and columns it does NOT name
that ADRs require. In order of how quickly an implementer would hit them:

**Columns missing from tables that ARE listed:**

1. **`files` has no path and no content hash.** `docs/adr/0023-...md:7-8` makes identity
   `SHA1(ascii(decimal size) + hex(SHA1(first 64KB)) + hex(SHA1(last 64KB)))` and path "location".
   `docs/physical-schema.md:72-80` lists role, sidecar reference, ordinal, both derived readings,
   `manually_verified`, `excluded`, and the technical columns — no hash, no size, no path. The record
   is cited; the columns it decides are absent.
2. **No date precision column anywhere.** `docs/adr/0073-...md:7-8` requires "a precision column saying
   what it actually resolves to". `statements` (`:82-90`) has no precision field, and `items` has
   `release_date` (`:55`) with none beside it. Both places need one.
3. **No `bestRating` / `worstRating`.** `docs/adr/0080-...md:7-8` requires them "beside" the value; the
   statements shape has no room for them and no qualifier is nominated.
4. **Confidence carries no component signals.** `docs/adr/0028-...md:22-23`: "The statement records the
   named component signals, not only the total, because 0.8 cannot say which signal fired."
   `physical-schema.md:87` has `confidence NULL` alone.
5. **No merge stamp.** `docs/adr/0040-...md:5-8` stamps the merge id "on every row it touches", and
   `0051:18` puts "a merge stamping its id" in migration 1. The "On every table" list
   (`physical-schema.md:30`) does not include it, and there is no merges table.
6. **`providers` has no enabled flag and no tier.** `docs/adr/0035-...md:7-8` ships definitions
   disabled; `docs/adr/0089-...md:7-13` sorts providers into tiers that govern distribution. Neither
   is a column at `physical-schema.md:106-108`.
7. **`items` has no external-id mapping.** `docs/adr/0078-...md:7`: "a surrogate id with external-id
   mappings beside it". If those are identifier statements (`0064:7-8` suggests so), say it.

**Tables required by an ADR and absent entirely:**

8. **The review queue.** `docs/adr/0027` decides two thresholds and a queue; `0010:16` scopes it by
   group; `CONTEXT.md:240-241` defines it. No table.
9. **The task registry and run history.** `docs/adr/0049-...md:11-13`: "Keyed tasks, each visible,
   runnable by hand, cancellable, with a run history." No table.
10. **Scanner roots.** `0010:16` scopes them by group, `0050` builds against a filesystem path,
    `CONTEXT.md:36` puts them in the Group definition. No table, and no group-to-root join.
11. **The group-to-provider link.** `0010:16` and `0025:7-8` both turn on which providers a group asks.
    No join table.
12. **The source order.** `0025` makes it global and `0071:7-8` ranks all four source kinds in it. It
    has to be stored somewhere; nothing says where.
13. **The container ancestor closure.** `0068:7` reads one. `physical-schema.md:31` provides a closure
    only "over the category graph". See 1.3.

**Decisions with no home at all:**

14. **Trigger-maintained or application-maintained?** `docs/adr/0014-...md:16` says "Pick one
    deliberately." Nothing picks. 0076 was the obvious place and answered a different question (3.4).
15. **What relates an extra to its parent?** `0087` makes an extra a "WORK RELATED TO another work" and
    `CONTEXT.md:98-100` agrees, but no property is named, and none of the nine seeded properties
    (`0079:7-8`) fits.
16. **Does `placements.edition_id` narrow the watched test?** `0092` lets a container hold a specific
    edition; `0020:10-11` makes progress placement-independent; `0068` counts distinct items. Whether a
    4K box set counts as watched when the owner watched the DVD edition is undecided.
17. **Is a report sent at end of playback?** `0086:7` reports every 10 seconds and on interaction;
    `0085:22-23` completes at ten seconds remaining. A play that runs to its end can pass through the
    completion window between two reports, and end-of-playback is not listed as a report trigger.
18. **What is `edition_coverage.kind`?** `physical-schema.md:69-70` introduces a per-interval `kind`
    that neither `0060` nor `0082` mentions. Likely "survives / animated / missing", but it is a
    column with no record behind it.
19. **`owner_id` and a tombstone on `migrations` and `owners`.** `physical-schema.md:30` applies
    ADR-0044's `owner_id`, timestamps, a tombstone and a change sequence to EVERY table, including the
    single-row `owners` table and the migration ladder's own version table (`:121`). Both are
    nonsensical there. The rule needs an exception clause.

---

## 8. CLAUDE.md

Length: 142 lines. Under 200. Confirmed by `wc -l`.

`CLAUDE.md:8` says "99 records"; `ls docs/adr/ | wc -l` gives 99. Correct.

Every path referenced exists: `docs/research/competitor-sweep/`, the forensic record, `docs/adr/`,
`docs/agents/`.

**Internal contradiction, one, in the new section.** `CLAUDE.md:41-43`: "Do not look for, read, or
reference any previous attempt at this product, in any repository or on the web, and do not search for
one. `docs/research/archive-2026-09-04/` is the forensic record of those attempts and its salvage
manifest is superseded: read it as evidence, never as instructions."

Sentence one bans reading or referencing any previous attempt; sentence two instructs the reader to
read the record of those attempts. The intent (do not go hunting for the old repos; the archive
directory is the sanctioned evidence) is recoverable, but the two sentences as written cancel. And
ADR-0051 and ADR-0093 both reference the previous attempts, correctly, as evidence.

**No other contradictions.** The Reading-the-decisions section sits consistently with the Principles:
"a decision found there is CLOSED" (`:32-33`) against "Make architectural decisions for the long term"
(`:19`) and "Do not preserve backward compatibility" (`:13`) — the first governs decisions already
taken, the others govern new ones. No conflict.

**Conventions, two notes:**

- `CLAUDE.md:69`: "`duplicate` is banned in code. Two files with the same content are a REDUNDANT
  FILE; 'duplicate' would otherwise name multi-placement." The rationale mislabels the collision.
  CONTEXT.md avoids "duplicate" under BOTH Multi-placement (`:89`) and Redundant file (`:130`), and
  ADR-0009:22, ADR-0017:15-16 and ADR-0061:14 use "duplicate" for a third thing entirely — the same
  item at two positions in ONE container, which is neither multi-placement nor a redundant file. The
  ban is right; the reason given is not, and the third sense currently has no word.
- `CLAUDE.md:25` and `:27` duplicate ADR-0051 and ADR-0093 respectively (see 4). For :25 that is
  deliberate reinforcement of a rule agents break under pressure. For :27 it means ADR-0093 carries
  nothing CLAUDE.md does not.

---

## Summary of counts

- Contradictions between records: 10 (plus 9 pairs checked and cleared).
- Self-contradictory records: 5.
- Wrong or unsupported cross-references: 11.
- Duplications: 12 text-level, 1 same-question pair.
- New records failing the three tests: 5 outright (0086, 0093, 0095, 0098, 0099), 1 borderline (0079).
- CONTEXT.md entries carrying decisions or implementation: 8, plus 1 incomplete definition.
- physical-schema gaps: 7 missing columns, 6 missing tables, 6 undecided points.
- CLAUDE.md: 142 lines, one internal contradiction, one mislabelled convention rationale.
