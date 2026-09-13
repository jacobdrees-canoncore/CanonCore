---
status: proposed
---

# Work-browsing excludes entities by kind, and search answers a different question

Entities must not leak into work-browsing surfaces. Jellyfin's mechanism is a PAIR — people carry no
`TopParentId` and there is an explicit exclude-by-kind list (`_itemByNameKinds`: Person, Genre,
MusicGenre, MusicArtist, Studio) that a surface must name to get them back. The parent half cannot be
copied here, because the case that justified putting entities in the items table at all (ADR-0005)
is an ordered container whose members are entities: "the Doctors, in order", "companions by first
appearance". Those entities do have a container parent, by design. The kind half is where Jellyfin
already is, so excluding by kind has company rather than being our invention.

So exclude BY KIND, and phrase the rule around THE QUESTION A SURFACE ASKS rather than around a list
of surfaces. A surface answering "what can I watch" returns `work` and ignores the entity kinds. A
surface answering "what is in this catalogue" returns everything. Entity containers are reached
deliberately rather than turning up in "latest".

Naming the question rather than the surfaces matters because the surface list is open: a command
palette, a related-items rail and an API endpoint would each otherwise need classifying by hand, by
whoever builds them, with nothing to guide the choice. Naming the question lets a surface classify
itself.

A KIND FILTER ALONE IS NOT ENOUGH, and an earlier version of this record stopped there. Containers
fold into `work` (ADR-0004), so "the Doctors, in order" is itself an item of kind `work` and a kind
filter cannot exclude it — the mechanism failed on the record's own example.

The missing test is what the container HOLDS. `items.holds_work` is a stored boolean, maintained
when a placement is written: does this container hold at least one `work`. Work-browsing is then
`kind = 'work' AND (NOT is_container OR holds_work)`.

Stored rather than derived, for the reason ADR-0005 gives: this answer must be single-valued and
decidable. A read-time membership walk would also make an empty container watchable and then hide it
the moment its first member arrived.

A BOOLEAN RATHER THAN A KIND, because mixed containers are the normal case rather than the edge one.
**Re-measured against the LIVE wiki on 2026-09-13 (CNCORE-103): 1,877 of the 4,675 categories that
hold a story ALSO hold something that is not one — 40.1% of every category containing a story.**
`Category:Stories set in London` is 1,049 stories among 1,069 pages and 23 subcategories, and it is
exactly the container someone browses for. A rule that demanded one kind per container would refuse
members from 1,877 real containers on import; a rule that hid mixed ones would hide the most useful
containers in the corpus. The archive gave 1,842 and 40% on 2026-09-10, and its "Stories set in
London" gave the same 1,049.

A SUBCATEGORY COUNTS AS SOMETHING THE CONTAINER HOLDS, and that is the whole of the difference
between 40% and a wrong answer. A first pass at this re-measurement compared only `categoryinfo`'s
PAGE count and reported 1,018 — it read a category of stories-plus-subcategories as pure, because
`categoryinfo` reports pages, subcats and files separately and only one of them was being looked
at. The claim this record rests on is about what a container HOLDS.

SEARCH ANSWERS THE SECOND QUESTION AND RETURNS ALL SEVEN KINDS, grouped by kind with works first.
All three incumbents group search results by kind; the ordering within that is ours, since none of
them documents it. Searching "Rose Tyler" and being shown nothing because a character is an entity
is the failure this rule exists to avoid, not to cause.

This rule is what makes the single-items-table decision survivable, and it is why kind must stay
single-valued and decidable (ADR-0005). Getting it wrong in either direction is
visible immediately: either people flood the browse grid, or the containers that justified the
single-table decision cannot be built.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: `items.holds_work`.** Stored, and maintained by a trigger on
`placements` rather than walked at read time -- which is what this record asks
for, and for the reason it gives: a read-time walk makes an empty container
watchable and then hides it the moment its first member arrives. A test places a
work into one container and a person into another and asserts only the first
turns the flag on.

**AND MAINTAINED ON PLACEMENT WRITE ONLY.** A member whose `kind` changes after
it is placed leaves every container holding it stale. Nothing can change an
item's kind yet, so this is a gap named rather than a bug shipped, and it
belongs to whatever first lets a kind be edited.

**AND WHEN THIS WAS WRITTEN, NEITHER QUESTION HAD A SURFACE.** `kind = 'work'
AND (NOT is_container OR holds_work)` was written down here and nowhere else,
and catalogue search did not exist. The column is in migration 1 because the
trigger that maintains it has to see every placement ever written; the rule that
reads it belonged to the first browsing surface. That surface is below.

## The first question gets its surface, under CNCORE-67 -- and this record STAYS PROPOSED

**BUILT: "what can I watch".** `/works`, `catalogue.works` and `readWorks`, and
the predicate is this record's own, whole. `items.holds_work` has a reader for
the first time.

**THE TWO HALVES ARE PINNED SEPARATELY, because passing one while failing the
other is exactly how this record's first draft got it wrong.** The kind half is
a Person and a Character against a story. The container half is TWO CONTAINERS
DIFFERING ONLY IN WHAT THEY HOLD -- both `work`, both `is_container`, one
holding a Character and one holding a story -- so nothing but `holds_work` can
separate them, and a surface filtering on the kind alone passes the first
assertion and fails the second. The entity container is this record's own
example, "the Doctors, in order".

**AND THE OTHER HALF OF THE RULE IS ASSERTED TOO: that an entity container is
EXCLUDED, not DELETED.** This record says entity containers are "reached
deliberately rather than turning up in latest", and a surface that had simply
lost one would satisfy every exclusion test written above. So the catalogue page
is asked for the same container in the same run and has to still show it.

**THE PREDICATE LIVES WITH THE CATALOGUE'S OWN AND IS BUILT FROM IT**, in
`packages/db/src/queries.ts`, rather than in the page or the router. The two
questions differ in their WHERE and in nothing else, so the walk that answers
them is written once -- and THE COUNT IS WHY THAT HAD TO BE SHARED rather than
copied: a work-browsing surface reporting the whole catalogue's `total` would
tell an owner it was hiding items it was never asked to show. A test pins it,
and the mutation that reintroduces it fails.

**NOT BUILT WHEN THIS WAS WRITTEN: catalogue search, which is the SECOND
question.** This record also decides that search returns all seven kinds grouped
with works first, and nothing searched the catalogue then. That was CNCORE-66,
and it was the only reason this record was still `proposed`: the half built here
is complete, and the half that was missing was a whole surface rather than a
corner of this one. The surface has since landed, and only part of the decision
with it; the last section says which part.

**THE GAP NAMED ABOVE IS UNCHANGED AND IS NOW READ BY SOMETHING.** `holds_work`
is still maintained on placement write only, so a member whose `kind` changes
after it is placed still leaves every container holding it stale. Nothing can
change an item's kind, so nothing can reach it -- but it has stopped being
invisible: the flag now decides what a reader is shown rather than only sitting
in a column, so whatever first lets a kind be edited owes this surface the
trigger as well as the column.

## The gap is CLOSED, under CNCORE-71 -- by refusal rather than by reprojection

**THE EDIT PATH THE PARAGRAPH ABOVE WAS WAITING FOR HAS ARRIVED, and it does not
let a kind be edited.** CNCORE-71 builds creating an Item by hand and editing its
TITLE. Its own ticket names the two ways to close this gap -- maintain
`holds_work` when `items.kind` changes, or refuse the change -- and the second is
taken.

**WHY REFUSAL IS THE RIGHT HALF RATHER THAN THE CHEAP ONE.** Migration 1 declined
to write the reprojection because it "would be untestable code guarding an
impossible event". Building it under CNCORE-71 would not have changed that: this
slice adds no way to change a kind, so the trigger would still guard an event
nothing can raise, and it would be the first mechanism in this repo whose only
test had to reach around the product to fire it. A refusal is testable today --
`constraints.test.ts` changes a kind and is refused -- so the rule that ships is
the one the suite can actually hold.

**IT IS A TRIGGER, NOT AN ABSENT FORM FIELD, and that distinction is the whole
value.** `item.retitle` takes no `kind`, but an input schema bounds ONE door;
`items_freeze_kind` (migration 11) bounds the TABLE, so `/api/rpc`, a later
surface, an import and a psql session are refused alike. It is modelled on
`properties_freeze_definition` (migration 1, ADR-0015), which freezes three
columns of a property row and leaves the rest editable -- and it freezes
`kind` alone for the same reason: `is_container` is turned on by a real write
path already (`writeProvidedItem`, when a `browse` finds members), so a trigger
refusing every update would break the import that exists today.

**AND IT MAKES THE GAP UNMISSABLE RATHER THAN MERELY UNREACHED, which is what
this record has wanted since migration 1.** Whatever first wants a kind to be
editable has to DROP `items_freeze_kind`, and the drop is where the `holds_work`
reprojection gets written. The rule is no longer a sentence in a migration
comment that a later slice has to happen to read; it is a wall that slice walks
into.

**THIS RECORD'S STATUS IS UNCHANGED BY THIS SLICE.** The gap above is closed, but
the reason the record is `proposed` is the SECOND question -- catalogue search --
and CNCORE-71 touches neither it nor the surface that answers it. Whoever
confirms that half is built owes the flip; this slice does not claim it. The
section below is that check, and it does not flip the record.

## The second question gets its surface, under CNCORE-66 and CNCORE-88 -- and this record STAYS PROPOSED

**BUILT: search returns every kind, and says which kind each result is.**
`searchCatalogue`, `catalogue.search` and `/search` read the catalogue's own
predicate and no kind filter, so a Character's name finds the Character, and
every entry carries its kind, so a Person and a Work sharing a title are two
rows a reader can tell apart. `catalogue-search.test.ts` holds both: an Entity
is found as readily as a Work, and two items sharing a name come back with
different kinds. CNCORE-88 gave the result set a cursor, so a search over more
matches than one page holds is walked rather than cut off
([[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]).

**NOT BUILT: grouped by kind, with works first.** Results are ordered by how
close each title is to the query, through `similarity()` from the same
`pg_trgm` extension the index needs
([[0120-catalogue-search-is-a-trigram-ilike-not-full-text-search]]), then by the
catalogue's own sort key. Kind decides nothing about the order. So a Character
whose name is nearly the query sits above a Work that merely mentions it, which
is the opposite of what this record decides. Nothing superseded that part:
ADR-0120 chose how a title MATCHES and says relevance ordering costs no second
mechanism, and it does not rule on kind. CNCORE-66 did not name grouping in its
acceptance criteria, so it went unbuilt without anybody deciding against it.

**WHICH IS WHY THIS RECORD STAYS `proposed`, found under CNCORE-75.** Checking
every record the public release implements, this one turned out to still say
nothing searched the catalogue, a claim false since v0.1.0. Both questions now
have a surface. The work-browsing half is complete, and the search half is
complete except for its ordering. The grouping has to put kind before closeness
in the order and in the cursor that walks it, because ADR-0119 makes the order
and the walk one rule. So it is a change to the walk and not only to a sort
key, and it is the slice that makes it that flips this record.
