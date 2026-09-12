---
status: accepted
---

# A reorder writes the delta, and the tree is keyed on the Placement

A drag sends the Placement that moved — its new container and its new position — together with the
siblings whose Position actually changed. It does NOT send the rebuilt ordering.

The identity the tree renders and drags is the **Placement**, never the Item.

## Keyed on the Placement, because multi-placement is the product

The reference implementation keys each node on the item's own id, which is correct for a tree where a
thing appears once. Here one Item routinely sits in several Containers at once — that is the central
claim — so an item id is not unique within a tree and cannot be a drag identity. Two nodes would
share a key, and a drop would move whichever the reconciler happened to pick.

This is the single largest adaptation between the reference code and this product, and it is
recorded because it looks like a detail and is not.

## The delta, not the ordering

Sending the whole rebuilt ordering is simpler and is what the reference `onDragEnd` hands you. It is
refused for one reason: it rewrites every Placement in the Container on every drop, which **destroys
the distinction between a Position somebody asserted and one a drag recomputed**.

Every Placement carries its sources ([[0017-placements-carry-sources-and-rank]]). A provider placed
an episode at 63; the owner dragged an unrelated row; under whole-ordering writes the provider's
Position is now owner-asserted and the disagreement it might have had is gone. Provenance is what
this product is for, so a write that launders it is the wrong default however convenient.

**The cost is accepted and named: the client must compute which siblings moved**, and a bug there
writes fewer rows than it should rather than more. That fails visibly — an ordering that does not
match what was dragged — where the whole-ordering bug fails invisibly, by rewriting provenance
nobody was looking at.

## `assertPlacement` cannot be the mutation

It is find-or-create on `(owner, container, item, position)`. An owner placing an Item where a
provider already placed it therefore gets ONE row with a second source attached, not an
owner-asserted placement of their own. That is right for import and wrong for an owner's hand.

The write path needs its own mutations that name a Placement by id — place, move, remove, restore —
which was [[0061-containers-own-their-membership]]'s explicitly unbuilt half until CNCORE-72 and
CNCORE-73 built all four, and is why that record is now `accepted` too.

**ALL FOUR ARE BUILT.** Place, remove and restore landed under CNCORE-72; `move` — the one the drag
needs, and the half this record is actually ABOUT — arrived with the drag under CNCORE-73, which is
what flips this record to `accepted`. The four confirmed the paragraph above at the seam:
`assertPlacement` is untouched and goes on being the import path, and the owner's hand has its own
functions that refuse where that one corroborates.

## Positions are nullable and shareable, and the tree must not quietly fix that

A tree assumes a total order. This model does not have one, deliberately:

- **A Position may be absent.** An unplaced member is a member ([[0062-root-is-the-absence-of-a-placement]]
  governs root; absence WITHIN a container is ordinary). Unpositioned members sort after positioned
  ones and keep their absence: **a drag that does not touch them does not give them a number.**
  Dropping INTO the unpositioned group leaves the dropped Placement unpositioned.
- **Two Placements may share a Position.** [[0009-multi-parent-membership-with-ordering]] allows a
  novel and its film at one point in a chronology. A reorder must not break a tie it did not create:
  siblings sharing a position that the drag did not pass through keep sharing it.
- **A repeat is allowed at DIFFERENT positions only.** The unique is
  `(owner, container, item, position)` with `NULLS NOT DISTINCT`, so the same Item twice at one
  position, or twice with no position, is refused by the database. A tree that permits the gesture
  and then fails the write is a worse experience than one that refuses the gesture.

## The server validates the cycle; the client guard is not the check

The reference implementation removes a node's descendants from the drop targets during a drag, so
the gesture cannot express a cycle. That is good interaction design and no guarantee at all. The
mutation validates independently, per [[0074-cycles-are-refused-and-walks-carry-a-visited-set]].

## What a tombstone does to the tuple, found under CNCORE-72

**A REMOVED PLACEMENT GOES ON OCCUPYING `(owner, container, item, position)`.** The unique carries no
`deleted_at` predicate, so the row a removal tombstoned still holds its tuple and nothing can take
it. Measured against PostgreSQL 18 rather than reasoned about: re-inserting the tuple while the
tombstone stands fails on `placements_container_item_position`.

**SO THE COLLISION THIS RECORD'S TICKET ANTICIPATED CANNOT HAPPEN, and a different one can.**
CNCORE-72 was briefed to decide what an UNDO does when the same tuple was recreated meanwhile. It
cannot be recreated — the tombstone is in the way — so an undo has nothing to collide with and is a
safe single-row clear. What an owner really meets is the other order: they remove a member and then
put it back where it was, and the row standing in the way is one they cannot see.

**THE DECISION: a re-placement RESURRECTS the tombstoned row rather than being refused by it**, and
the placement keeps the id it always had — which is what an external reference, a `?via=` link or a
pending undo is already holding ([[0078-entity-identity-is-a-surrogate-id]]). Refusing would be the
product reporting a conflict with something invisible, which is this record's own rule about
gestures met from the other side: there is no gesture to refuse, because the member is not on the
page.

**IT IS NOT `assertPlacement`'S FIND-OR-CREATE, and the difference is the whole of the paragraph
above.** That one finds a LIVE row and attaches a source to it, which is agreement between sources.
This one finds only a REMOVED row; a live row at that tuple still refuses, so an owner placing an
item where a provider already placed it goes on getting a refusal rather than silently corroborating
the provider.

**AND A REFUSAL REACHES THE OWNER AS A SENTENCE, not a 500.** This record says a UI that permits the
gesture and then fails the write is worse than one that refuses the gesture. A script-less form
cannot refuse this gesture: the item and the position are chosen together at submit time, so the
page cannot know the pair is taken until it asks. What it does instead is say which rule bit — a
Repeat is allowed at a different position — and keep the owner where they were.

## `collapsed` is view state

It has no home in the schema and must not acquire one. Whether a node is expanded is a property of a
person looking at a screen, not of a Placement.

## Consequences

**Fractional indexing was considered and refused here**, though it is what Figma and Linear do and it
would make every drop a single-row write. [[0018-ordering-lives-on-the-placement]] settles Position
as it is; changing what a Position means is a superseding record, not an implementation choice made
inside a drag handler. If the sibling arithmetic becomes painful, that is the record to reopen, and
this one is the reason it would be worth doing.

**The mutation is the seam, not the component.** The tree maths — flatten, project a depth, find the
descendants — stays behind this repository's own boundary rather than living inside the drag
library's component, so a library bump touches one file and not the rules.

## As built, under CNCORE-73: positions are SLOTS, and a reorder permutes the members among them

This record said what a reorder must NOT do — invent numbers, break ties, number the unplaced — and
left the arithmetic to whoever wrote it. Writing it produced one rule that yields all three, and the
rule is worth naming because it is shorter than the list it replaces:

> **THE ORDERING'S POSITIONS STAY ATTACHED TO THEIR INDEX AND THE PLACEMENTS MOVE BETWEEN THEM.**
> The multiset of positions a container holds is invariant under a reorder.

- **No number is invented.** An ordering of 1, 5 and 63 reordered still reads 1, 5 and 63. The
  obvious alternative — shift the neighbours by one — writes positions nobody asserted into rows a
  provider placed, which is the laundering this record refuses whole-ordering writes for. The same
  mistake with a smaller blast radius, and it would have arrived wearing the word "delta".
- **No tie is broken**, including one the drag passes through, because tied slots stay tied.
- **An unplaced member keeps its absence**, because `null` is a slot like any other. "Dropping INTO
  the unpositioned group leaves the dropped Placement unpositioned" falls out of the model rather
  than being special-cased.

**WHAT THE MODEL COSTS IS NAMED HERE BECAUSE IT IS SURPRISING.** Dragging ACROSS the boundary
between positioned and unpositioned MOVES that boundary: pull an unplaced member to the top and the
last positioned row takes the null it left behind. That is the honest reading of a gesture saying
"this one is first and that one is no longer placed", and it is licensed by this record's own
qualification — a drag that does not touch an unpositioned member does not give it a number, and
this one touches it. It is also the arithmetic becoming painful in exactly the place the
Consequences above point at fractional indexing for.

**A TIE THE DRAG LANDS IN CANNOT BE LANDED IN PRECISELY, and that is the model telling the truth.**
The read path orders by `(position, id)`, so two placements sharing a slot are ordered by ids nobody
chose, and a drop between them renders wherever those ids put it. Refusing the gesture would be
worse — the tie is legal and [[0009-multi-parent-membership-with-ordering]] put it there on purpose
— so the drop is honoured and the page shows where it actually landed.

**THE ARITHMETIC RUNS OVER THE PAGE, NOT THE ORDERING.** The Members list is walked
([[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]), so a reorder permutes the slots
the reader can see and cannot move a member onto a page it is not on. That is a consequence of the
cap rather than a rule chosen here, and it is honest: the gesture cannot express what the page
cannot show.

## The mutation is one rule called from two doors

**THE DRAG IS AN ACCELERATOR, NOT THE CAPABILITY.** `CLAUDE.md` requires every keyboard accelerator
to have an equivalent visible UI path, so each row carries Move up and Move down as native forms
bound to a Server Action — and those are the whole of reordering before any script loads. A reader
who never gets the drag loses nothing, and the page seam can assert reordering without a browser.

**BOTH DOORS POST THE IDENTICAL REQUEST**, which is what stops them drifting: `reorderedTo` is a
pure module this repository owns, the fields are the same `siblingId`/`siblingPosition` pairs
whether a button or a drop built them, and one parser reads both. A page where the mouse and the
keyboard disagreed about what a reorder means would be two products.

**THE FORM CARRIES THE DELTA RATHER THAN THE GESTURE.** The page has the ordering, so it computes
what each button would do and renders that consequence into the form. An action that took "move this
up" and re-read the ordering to work the rest out would be a different mutation from the one this
record decides on, and it would put the arithmetic somewhere the drag could not share.

## A reorder is one permutation, and the unique had to learn that — migration 14

**`placements_container_item_position` IS CHECKED ROW BY ROW, AND A PERMUTATION'S INTERMEDIATE
STATES NEED NOT KEEP A RULE ITS END STATE KEEPS.** A Repeat dragged past its own other copy lands on
that copy's tuple mid-transaction and fails on a constraint the finished ordering does not break.
Measured against PostgreSQL 18: an owner dragging an episode above its own recap got
`duplicate key value violates unique constraint`.

[[0009-multi-parent-membership-with-ordering]] licences the Repeat and this record makes the tuple
the rule, so neither is the thing to weaken. What was wrong is WHEN the rule is read: "the same item
is never in one container twice at one position" is a claim about a container, and a container is
only observable between transactions. The constraint is now `DEFERRABLE INITIALLY IMMEDIATE`, so
every other write in the repository is checked exactly where it was and only the move defers, for
itself.

**THE COST IS THAT A DEFERRED REFUSAL ARRIVES AT THE COMMIT**, where the row that broke it is no
longer in hand. `placements.ts` catches it there rather than at the statement; the SQLSTATE is the
same `23505`, so the owner still meets the sentence this record asks for rather than a 500.

## The tree, and what it will owe when it arrives

**NO TREE WAS PORTED UNDER CNCORE-73.** The Members list is flat and sortable; a Container cannot be
dragged INTO another Container from the page. That was the right scope — every acceptance criterion
on that ticket is about reordering within one container — but this record talks about a tree
throughout, so what the port still owes is written here rather than left to be rediscovered:

- **`buildTree` SILENTLY DROPS ORPHANS.** The reference implementation's `if (!parent) continue;`
  makes a member whose parent is not in the projected set VANISH from the rendering. A member that
  disappears is the same failure as a dropped Placement, which this model refuses everywhere else:
  the port makes it an explicit error or reparents to root, and does not inherit the `continue`.
- **The descendant guard is interaction, never the invariant**, which the section above already
  says. The database refuses the cycle and already does — migration 15, under
  [[0074-cycles-are-refused-and-walks-carry-a-visited-set]].
- **Keying is already settled**, and it is the part most likely to be "simplified" back to the item
  id by whoever ports the reference file.

**THE MUTATION IS ALREADY TREE-SHAPED.** `placement.move` takes a DESTINATION container, because
this record's own first sentence is "its new container and its new position" — so the cycle a tree
could express is expressible today through the mutation, which is why the refusal was built with the
drag rather than deferred to the tree.
