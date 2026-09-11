---
status: proposed
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
which is [[0061-containers-own-their-membership]]'s explicitly unbuilt half.

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
