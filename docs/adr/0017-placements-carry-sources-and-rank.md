---
status: accepted
---

# A placement has many sources, and disagreement is resolved by rank

(container, item, position) is unique. Sources agreeing about a placement are recorded against
one row; sources disagreeing about position produce two rows resolved by rank, the same way two
competing statements are.

An ordering is a dated claim by a named source, not a neutral fact — Disney+ revised its own MCU
chronology in August 2025, replacing the work at the head of the timeline. Three origins write
this table: provider `browse`, the scanner's season and episode numbers, and the owner's own hand.

The same item at the same position twice is never a deliberate duplicate; it is always agreement,
and agreement is corroboration rather than noise. A real duplicate — a recap at position 1 and the
episode at position 5 — differs in POSITION, which the constraint permits.

## Evidence

The Disney+ MCU chronology revision of August 2025 is the one external claim here and it was NOT verified in the 2026-09-10 pass. It illustrates the decision rather than carrying it — the argument stands without it.

## As built, under CNCORE-5

**BUILT: the constraint, the sources, and who speaks for a placement.**
`(owner, container, item, position)` is unique, `placement_sources` carries a rank and an observed
date, and the read path answers with the KIND of source that asserted each placement. Which source
speaks for a placement when several do is decided by the same three terms `winning_literal` uses for
a statement, in the same order and for the same reasons: rank first, because the owner's favourite
is the lock and outranks the whole source order ([[0024-the-favourite-is-the-lock]]); then the one
global source order ([[0025-the-source-order-is-global]]); then a stable id. Recency is deliberately
absent from both.

**AND NEITHER SITE HONOURS A DELETED SOURCE.** `winning_literal` does not check `sources.deleted_at`
and neither does the placement's spokesman query, deliberately: the two are ONE RULE IN TWO
LANGUAGES, and a query that is locally more correct than its twin makes one field's provenance
disagree with another's, in a way that compiles perfectly. Nothing can delete a source today, so
this guards an impossible event -- the same reasoning migration 1 used for the `items.kind` trigger
it chose not to write. It belongs to whatever first lets a source be deleted, and it is two lines in
two places, not one.

**NOT BUILT UNDER CNCORE-5: rank RESOLVING a disagreement about position.** Two sources that
disagree did produce two placement rows and both were shown, but nothing picked one, because nothing
yet wrote the second: `browse` did not exist, the scanner did not exist, and the owner's hand is one
source. It was written here as a gap rather than left to be discovered. CNCORE-7 closed it, below.

The half that WAS built under CNCORE-5 is the half that cannot be retrofitted: a placement written
then records who asserted it, and a placement written without that is a claim nobody made, which no
later slice can reconstruct.

## And the rest of it, under CNCORE-7 -- so this record is now ACCEPTED

**BUILT: the resolution, and a second origin to need it.** `browse` writes placements now, so the
second source this record was waiting for exists, and `assertPlacement` is the one place THE PRODUCT
writes a placement -- the owner's hand reaches the same function a provider's import does, because
the rule here is about the CLAIM rather than about who is making it. (Test fixtures still insert
rows directly, deliberately: `aPlacement` can build a placement NO SOURCE stands behind, which this
function cannot and should not.)

Agreement lands on one row. `assertPlacement` finds or creates the placement and then finds or
creates the source against it, so two providers asserting the same (container, item, position) leave
one placement with a source each, and one provider asserting it twice leaves exactly what it left
the first time.

Disagreement lands on two rows, and `findPlacementsOfItem` now RESOLVES it: within one container the
rows come back in the spokesman's order, so the winning claim is the one a reader meets first. Both
are still answered, exactly as competing statements are -- the resolution decides which one SPEAKS,
never which one exists.

**AND IT IS ONE LATERAL JOIN RATHER THAN A SUBQUERY PER TERM**, which is a lesson this record should
carry rather than the file alone. Rank, source order and source kind are three facts about ONE row,
and three correlated subqueries would each re-derive that row from its own copy of the ordering --
three copies of a rule whose whole point is that it is identical to `winning_literal`'s. Picked
once, read three times.

**A REPEAT IS INDISTINGUISHABLE FROM A DISAGREEMENT IN THE SCHEMA, and that is fine.** Both are one
item twice in one container at two positions; nothing stored says which. What separates them is who
asserted them: a repeat's rows come from ONE source, so they tie on every term rank can decide and
fall through to position, and the recap at 1 still reads before the episode at 5. A test pins that,
because it is the case an implementer reaching for a rank-first ordering will break first.

**WHAT "RESOLVED" MEANS AS BUILT, exactly.** The read path decides, and it expresses the decision as
ORDER: the winning claim comes first. Nothing MARKS it to a reader, and `placementPublic` carries no
rank, so a page showing one container twice at two positions shows two rows labelled with who
asserted each and lets the reader draw the conclusion. That is the same shape competing STATEMENTS
have -- winner first, no marker -- with one difference worth naming: a statement's winner is also
projected onto `items.title`, and a placement has no column to project onto.

**AND NO USER CAN CREATE A DISAGREEMENT YET.** Both writers exist in code, but the owner has no
surface for placing anything: `browse` is a procedure and the hand is a direct catalogue write. So
the resolution is real, tested and unreachable from the product, and the first hand-placement UI is
what makes it something a person can meet. Written down because a reader of the paragraph above will
otherwise take a resolved disagreement to be something the app can currently produce -- which is the
same mistake CNCORE-5's section was written to prevent, one layer along.

**NOR DOES ANYTHING SET A RANK.** `placement_sources.rank` ships from migration 1, the resolution
reads it, and its default is `normal` everywhere. `assertPlacement` deliberately takes no `rank`
parameter: it would be a write path with no caller. ADR-0024's lock arrives with the surface that
locks something.

**STILL NOT BUILT, and it belongs elsewhere: the scanner.** This record names three origins and two
of them now write the table. The scanner's season and episode numbers are a slice of their own
rather than half of this mechanism, and nothing here waits on them.

**AND NEITHER SITE STILL HONOURS A DELETED SOURCE**, unchanged and still belonging to whatever first
lets a source be deleted. Nothing can today.

**THE READER'S HALF IS NOW REAL DATA.** The paragraph below says "the chip for `browse` appears the
day it writes its first placement". That day is this ticket: the end-to-end suite browses a real
fixture container, the owner hand-places the same imported story into a second ordering, and the
page offers Hand-placed and Imported over ONE list -- no longer over a fixture standing in for an
import that had not happened.

## The reader's half: ONE list, filtered by provenance

"Also appears in" is one list holding every ordering an item sits in, whatever put it there, with a
filter over the origins actually present. Never two sections.

That follows from this record rather than from taste. A container the owner filled by hand and one a
provider imported are the SAME KIND OF FACT: they differ by who asserted them and by nothing else,
so a split layout would tell the reader they are two different kinds of thing, and then have to
choose which section a container holding both belongs in. The filter is read off the data, so an
origin nothing arrived by is not offered and the chip for `browse` appears the day it writes its
first placement.

The reader's words are not the source labels: those name WHO ASSERTED a value, and the list is
answering how the item came to be in here. `owner` reads as "Hand-placed", `provider` as
"Imported", `derived` as "Rule-derived", `sidecar` as "From the files".

TODAY THERE IS ONE ORIGIN, because CNCORE-5 seeds by hand on purpose. The filter still renders, and
the end-to-end proof that it narrows is a second, non-demo item placed two ways -- putting a
provider-sourced row into the demo would be pretending an import happened.

## Agreement, from two REAL sources at last -- and a gap the reader still has

**AGREEMENT WAS ONLY EVER DEMONSTRATED BY ONE SOURCE ASSERTING TWICE.** CNCORE-7 built the rule and
proved it by browsing the same container twice, which exercises the find-or-create and leaves the
interesting case -- TWO DIFFERENT SOURCES landing on one row -- to reasoning. CNCORE-9 has both:
`provider-wiki`'s import puts *Rose* first in series 1, TMDB independently says first, and the two
land on ONE placement row carrying a source each.

That case is where the wiki's series 1 and TMDB's season 1 hold the same thirteen stories in the
same order. Series 2 is the opposite -- fifteen members against thirteen -- and is deliberately NOT
matched, because one ordering two sources describe and two orderings that disagree are different
mechanisms, and collapsing the second into the first would make multi-placement untested while every
assertion still passed.

**AND HERE IS THE GAP, WHICH THAT TEST HAD TO ROUTE AROUND: THE READ PATH ANSWERED ONE SOURCE, NEVER
THE SET -- AND IT IS NOW CLOSED AT BOTH ENDS.** `findPlacementsOfItem` returned `placedBy` alone, the
KIND of the source that SPEAKS for the placement, and `placementPublic` carried nothing else. So a
placement two providers corroborate and a placement one provider asserts were indistinguishable to a
reader of THAT list, and the page printed one row reading "Imported" for both. This record's first
sentence is that a placement has many sources; what a reader of the item's own page could see of that
was which kind of thing one of them is. The CONTAINER's end answered the set from CNCORE-90, under
"And under CNCORE-90: the container's end names the SET, and the half of the resolution it cannot
carry"; CNCORE-121 made the same fix for this one, below.

The test asserts the second source through its CONSEQUENCE instead -- the page owes TMDB a notice,
and it can only owe one because a TMDB placement source sits on that item
([[0036-tmdb-licence-constraints]] reads the obligation off the claims themselves). That works, and
it is indirect: attribution is being used as a probe for provenance because provenance has no field.

It was named as a gap rather than fixed here, because the fix is a read-path field and a rendering
decision -- what a reader should be told when two sources agree -- and nothing had asked for one.
Whatever first shows a placement's provenance to a person closes it: CNCORE-90 was that thing and it
closed HALF, the container's end, where a row now names every source behind it and two names on one
row ARE the corroboration. CNCORE-121 closed the rest, so corroboration is visible from the item's
end too and "the opposite of what this record set out to make legible" is now true of NEITHER list.

## And under CNCORE-90: the container's end names the SET, and the half of the resolution it cannot carry

**AND CORROBORATION IS VISIBLE FROM THIS END AT LAST.** Two providers agreeing about one position
are ONE placement row carrying two names, which the end-to-end suite renders and asserts -- so the
gap above ("corroboration being INVISIBLE is the cost until then") is closed for the container's
end rather than merely arguable from the field's existence.

**BUILT: a member list a reader can tell a Repeat from a disagreement in.** `findPlacementsInContainer`
answers `assertedBy` -- every source standing behind a placement, by the label each calls itself --
`placementInContainerPublic` carries it, and the Members list prints the names beside each row. One
source saying it twice is a repeat; two sources saying it once each is a disagreement. Both are one
title at two positions and were rendered identically until this.

**IT NAMES THE SOURCES RATHER THAN THEIR KINDS, and that is the load-bearing choice.** `placedBy`
answers what SORT of thing placed it, which is the right answer for the filter over the item's end,
and it cannot separate the disagreement a catalogue actually holds: the wiki's series against TMDB's
season is two PROVIDERS, so a kind prints "Imported" on both rows and the reader is back where they
started. The reader's four words -- Hand-placed, Imported, From the files, Rule-derived -- stay the
item's end's. This list answers "who claims this position", which is a name.

**WHICH HALF OF THE RESOLUTION RULE IT IMPLEMENTS, exactly.** The spokesman's three terms -- rank,
then the one global source order, then a stable id -- order the NAMES INSIDE a row, so the source
that speaks for a placement is the one a reader meets first, and `spokesmanFor` and this aggregate
cannot come to disagree about which that is. They do NOT order the rows: a container's member list
is in POSITION order by definition ([[0018-ordering-lives-on-the-placement]]), so rank cannot lead
here as it leads across containers. The winning claim of a disagreement is therefore answered, and
named, and not moved to the front.

**AND THE OTHER HALF IS NOT MERELY UNBUILT -- IT IS UNDECIDABLE FROM THIS END.** Marking which of
two rows SPEAKS would mean first deciding which pairs of rows COMPETE, and this record already says
a repeat is indistinguishable from a disagreement in the schema. Across containers that costs
nothing, because `findPlacementsOfItem` expresses the resolution as ORDER and a repeat simply TIES
on every term rank can decide and falls through to position. A MARK has no fall-through: it has to
say yes or no about a pair, on data that cannot answer. So the read path names the sources and the
READER draws the conclusion -- the same shape this record chose for the item's end, winner first and
no marker, arrived at from the other direction.

**AND IT IS ONE LATERAL AGAIN, MEASURED RATHER THAN ASSUMED.** The aggregate filters
`placement_sources` by `placement_id` alone, and the only index on that table leads with `owner_id`
-- so the seek this depends on is PostgreSQL 18's btree SKIP SCAN over a column holding exactly one
value ([[0044-one-owner-row]]). It works: on a container of 1,049 members with two sources each --
ADR-0077's measured size -- the planner answers `Index Scan using placement_sources_placement_source,
Index Cond: (placement_id = p.id)`, and the list costs 4.4 ms against 0.8 ms for the same query with
the lateral removed. Measured 2026-09-12 on PostgreSQL 18.6, the version `compose.yaml` pins. It is
six times a very small number and it rides on the listing [[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]] has not
capped yet, which is CNCORE-89's decision and now has a figure in it.

**NOR CAN ANYTHING YET WRITE THE DISAGREEMENT IT RENDERS.** Unchanged from "And the rest of it,
under CNCORE-7 -- so this record is now ACCEPTED" above, and worth repeating rather than assuming: `browse` writes one source's claims per call and the owner's
hand still has no surface that places anything, so both the db suite and the e2e suite SEED the two
sources. CNCORE-72 is the first thing that can produce one in a running instance, and this landing
before it is the point -- the list that would have had to render it was already wrong.

**AND THE DELETED SOURCE IS STILL NOT HONOURED -- IN TWO PLACES, WHICH IS FEWER THAN BEFORE.** The
aggregate checks the placement source's own tombstone and not `sources.deleted_at`, exactly as
`spokesmanFor` and `winning_literal` do, for the reason this record gives above: a query locally more
correct than its twins makes one field's provenance disagree with another's. A third copy is what
this query would have meant, so the predicate and the three ordering terms are each written ONCE in
`queries.ts` now and read by both readers -- `standingBehindThePlacement` and `whoSpeaksFirst`.
`winning_literal` cannot read them, being PL/pgSQL in a migration, and that copy is still held
identical by hand. Nothing can delete a source today; when something can, it is two lines in two
places rather than three in three.

## And under CNCORE-121: the item's end names the SET too, so the gap above is closed at both ends

**BUILT: "Also appears in" a reader can tell a Repeat from a disagreement in.** `findPlacementsOfItem`
answers `assertedBy` -- every source standing behind a placement, by the label each calls itself, the
one that speaks first -- `placementPublic` carries it, and the list prints the names beside each row.
One source saying it twice is a Repeat; two sources saying it once each is a disagreement. Both are
one CONTAINER twice at two positions and were rendered identically until this, exactly as the
container's end rendered one TITLE twice identically until CNCORE-90.

**IT IS THE SAME LATERAL, NOT A SECOND ONE.** `assertersOf` was written for the container's end and
this query reads it unchanged, so the two ends cannot come to disagree about who asserted a placement
or about which of them leads -- the aggregate orders its names by `whoSpeaksFirst`, the same three
terms `spokesmanFor` picks with. That is the rule this record has already had to state twice about
`winning_literal`, applied before a third copy could exist rather than after.

**AND `placedBy` SURVIVES BESIDE IT, which is the half that is NOT a mirror of CNCORE-90.** The
container's end carries the set INSTEAD of a kind, because nothing there filters. This list does: the
chips over it are BY KIND and this record's own "reader's half" settles their four words --
Hand-placed, Imported, From the files, Rule-derived. So the kind goes on answering how the item came
to be in there and the names answer who says so, and the row prints both. They are two questions, and
an implementer reading CNCORE-90's asymmetry as the destination would delete the filter's only input.

**THE CORROBORATION GAP THIS RECORD NAMED IS NOW CLOSED AT BOTH ENDS.** "A placement two providers
corroborate and a placement one provider asserts are indistinguishable to every reader" was true of
the item's end until this ticket; agreement lands on ONE placement carrying a source each, so
corroboration is only ever visible as two NAMES on one row, and the end-to-end suite renders and
asserts exactly that. The gap paragraph above is rewritten in place rather than answered from here,
because a correction placed beside a claim leaves the old claim standing.

**RANK STILL LEADS, AND THAT IS THE ASSERTION MOST WORTH KEEPING.** This list is ordered by the
container's sort name, then the spokesman's rank and source order, then position -- so the winning
claim of a disagreement is the row a reader meets first, which is how this record expresses a
resolution it will not MARK. Naming the sources adds a column to the row and touches none of that.
The e2e fixture is shared with the container's end and pins the difference: the source that SPEAKS
FIRST claims position 3, so the Members list renders #1 then #3 and "Also appears in" renders #3 then
#1, off ONE seeded disagreement. A page that had quietly adopted position order here would pass the
container's assertion and fail this one.

**AND IT IS THE SOURCE ORDER DOING THAT, NOT A RANK**, which this record keeps strictly apart
everywhere else and an earlier draft of this section blurred by saying one source "outranks" the
other. Nothing in the product sets a rank -- `assertPlacement` takes no such parameter and the column
defaults to `normal` -- so both fixture sources tie on the FIRST term and it is the one global source
order ([[0025-the-source-order-is-global]]) that separates them. ADR-0024's lock is what would
override that, and it still arrives with the surface that locks something. The db suite covers the
rank term separately, by setting one by hand.

**WHAT IT COSTS, ON THE ONE LISTING THAT IS NOT CAPPED.** The container's end could justify this
aggregate on a measured 4.4 ms against 0.8 ms because CNCORE-89 had capped it; "Also appears in"
takes no `limit`, so the same lateral rides an unbounded row count and CNCORE-125 owns the cap.
MEASURED for that ticket rather than left to it: one item placed in 1,000 orderings with two sources
each costs 6.3-12.3 ms with the aggregate against 3.6-4.1 ms without, over three runs on the
PostgreSQL 18.6 `compose.yaml` pins, the planner answering `Index Scan using
placement_sources_placement_source` exactly as the container's end does. Two to three times a small
number, at a size nothing has been seen to reach -- nothing measures how many orderings one item
really sits in, where ADR-0077 measures a container at 1,049 members. It sharpens the cap's case
rather than making it urgent.

**WHAT IS STILL NOT BUILT is what CNCORE-90 already said was undecidable, and it is unchanged.**
Nothing MARKS which of two rows speaks. From this end it does not need to: the order says it, which
is the fall-through a mark has no equivalent of. Both ends now name the sources and let the reader
draw the conclusion, arrived at from opposite directions.

**NOR CAN ANYTHING STILL WRITE THE DISAGREEMENT IT RENDERS -- and that is now HALF true.** `browse`
writes one source's claims per call, so a disagreement between two providers is still seeded in both
suites. What changed under CNCORE-72 is the owner's hand: `placeItemByHand` is a real surface, so an
owner CAN now place an item into an ordering a provider already claims at another position, and the
two rows that makes are a disagreement this page will render with two names on it. A corroboration
still cannot be produced by hand -- ADR-0116 has the owner's hand make its own claim rather than join
a provider's -- so the agreeing row remains a fixture.

## And these two terms now decide where a PAGE ends, which is a second job -- CNCORE-125

**THE ORDER STOPPED BEING ONLY AN ORDER.** "Also appears in" is capped and walked now
([[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]), and a keyset cursor has to
compare the WHOLE tuple its `ORDER BY` sorts on -- so the rank's precedence (ADR-0024) and the one
global source order (ADR-0025) are terms of that comparison, not just of the sort.

**WHAT THAT CHANGES IS THE COST OF GETTING THEM WRONG.** Until now a mistake in these two terms
showed a reader the rows in the wrong order, which is visible and recoverable. In a cursor a term
left out of the comparison SILENTLY SKIPS ROWS: two placements tied on the container's name and
separated only by which source speaks would have the walk step over the second of them, and the page
would simply not contain it. There is a test for each of the two, each cutting a page at a tie on
that term alone, and each mutation-checked by dropping that term.

**AND BOTH ARE NULLABLE, WHICH IS THE OTHER HALF.** A placement no source stands behind has neither
term -- this record's own "a claim nobody made is still a placement" -- so those rows are a keyless
BLOCK that sorts last, and a plain row comparison loses the whole block from every page because
`(null, x) > (k, y)` is NULL. The rule that "a source that says nothing about a placement cannot
outrank one that does" is now load-bearing twice: once for where those rows appear, and once for
whether a reader can reach them at all.

**AND IT IS WHY THE AGGREGATE ABOVE CANNOT REPLACE THE SPOKESMAN, which CNCORE-121 argued on the
order alone and is now true twice over.** That section keeps both laterals because the spokesman's
rank and source order are terms this query ORDERS BY and an aggregate cannot be ordered by. They are
terms its CURSOR compares now as well, and an aggregate cannot be compared against either -- so
collapsing the two would cost the walk that resumes inside the ordering, not only the ordering.

