---
status: accepted
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

## Built, under CNCORE-7 and CNCORE-72

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

**A REORDER IS STILL NOT BUILT, and it is ADR-0116's, not this record's.** That record's write path
names four mutations -- place, move, remove, restore -- and CNCORE-72 built three. `move` arrives
with the drag, under CNCORE-73. This record is about a container OWNING its membership, which
placing and removing is the whole of; where a member sits within the ordering is ADR-0018's subject
and that ticket's work.

**WHAT A REMOVAL DOES TO THE SOURCES, decided under CNCORE-72 and worth recording here because it is
this record's rule meeting ADR-0017's.** A removal tombstones the PLACEMENT and leaves
`placement_sources` standing. The owner taking a member out of their own ordering is not a provider
withdrawing its claim, and ADR-0017 lets a source take back only what it said itself -- so marking
the provider's row deleted would put words in its mouth, and would be indistinguishable later from
the withdrawal `import.ts` performs when a provider really does stop asserting a member. The member
therefore comes back from an undo with its origin intact, and the undo is a single-row clear.

**The review queue this record hands staleness to still does not exist** ([[0027-two-thresholds-and-a-review-queue]]).
A container whose source has since reordered itself simply stays as it was imported. That is a
consequence this record HANDS OFF rather than a mechanism of its own, which is why it does not hold
this record open: the queue is ADR-0027's to build, and what this record owes -- membership owned
outright, and mutations naming a placement -- is built.
