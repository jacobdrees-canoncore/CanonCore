---
status: proposed
---

# Every container owns its membership outright

Adding an item to one ordering never adds it to another, as an IIIF Range owns its item list.

REFUSED: a source container that other orderings re-sequence. It cannot express a chronology
spanning two ranges, which is the ordinary case rather than an exotic one. The duplication that
comes with independent membership is accepted, and the staleness it produces is a curation fact for
the review queue rather than a schema problem.

Mutations name a PLACEMENT, not an item — forced by duplicates being allowed, since "remove this
from that container" is otherwise ambiguous.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-standards.md`.

## Two thirds built, under CNCORE-7 and CNCORE-72 -- and this record stays PROPOSED

**BUILT: membership owned outright, and now demonstrably.** `browse` writes a container's members
into that container and nowhere else, and the owner then places the same imported story into a
second ordering of their own without the first noticing. Two containers, two positions, two
independent memberships -- which is this record's claim, and it is now something a person can look
at rather than a property of the schema.

The duplication this record accepts is visible in the same place: the story sits in both containers
as two placement rows, and neither is derived from the other.

**BUILT, UNDER CNCORE-72: mutations naming a PLACEMENT.** `placeItemByHand`, `removePlacementByHand`
and `restorePlacementByHand` name a placement by id, and the router and the container's own page
reach them. This was the half the record adds over "containers own their membership", and it is the
half that was missing: until it landed, nothing removed a member, and the rule that a mutation names
a placement rather than an item had nothing to apply to.

It is forced by Repeats being allowed, which is the reason the record gives and which building it
confirmed at the seam rather than in the argument: the container page's Remove control sits on a
ROW, and a row is a placement. Two rows there legitimately share an item id, so a control naming the
item would be one button for two members.

**STILL NOT BUILT: reordering a member, and moving one between containers.** The section this one
replaces named three things nothing could do -- remove a member, reorder one, move one between
containers -- and CNCORE-72 did the first. `move` and the reorder arrive with the drag, under
CNCORE-73, and ADR-0116 is where their shape is decided.

**WHICH IS WHY THIS RECORD STAYS `proposed`, and the first draft of this section had it `accepted`.**
The argument for flipping was that this record's RULE -- a mutation names a placement -- is now built
and applied, and that the reorder belongs to ADR-0018 and ADR-0116 rather than here. That argument is
not wrong, and it is still the wrong call: `CLAUDE.md` says a record whose mechanism you built only
half of is not one you implemented, and this record's own inventory of what was missing listed three
mutations. Reasoning about which of them REALLY belong to it is exactly the move that rule exists to
stop, because half a mechanism looks finished from outside. It flips on the ticket that finishes the
write path, which is CNCORE-73.

**WHAT A REMOVAL DOES TO THE SOURCES, decided under CNCORE-72 and worth recording here because it is
this record's rule meeting ADR-0017's.** A removal tombstones the PLACEMENT and leaves
`placement_sources` standing. The owner taking a member out of their own ordering is not a provider
withdrawing its claim, and ADR-0017 lets a source take back only what it said itself -- so marking
the provider's row deleted would put words in its mouth, and would be indistinguishable later from
the withdrawal `import.ts` performs when a provider really does stop asserting a member. The member
therefore comes back from an undo with its origin intact, and the undo is a single-row clear.

**The review queue this record hands staleness to still does not exist** ([[0027-two-thresholds-and-a-review-queue]]).
A container whose source has since reordered itself simply stays as it was imported. That is a
consequence this record HANDS OFF rather than a mechanism of its own: the queue is ADR-0027's to
build. It is named here so a later reader does not count it against this record when the write path
is finished and the flip is considered again.
