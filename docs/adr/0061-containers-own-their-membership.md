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

## Built, under CNCORE-7, CNCORE-72 and CNCORE-73 -- and this record is `accepted`

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

**BUILT, UNDER CNCORE-73: reordering a member, and moving one between containers.** The section this
one replaces named three things nothing could do -- remove a member, reorder one, move one between
containers -- and CNCORE-72 did the first. `movePlacementByHand` does the other two as ONE mutation,
because [[0116-a-reorder-writes-the-delta-and-the-tree-is-keyed-on-the-placement]] gives a move "its
new container and its new position": a reorder is a move whose destination is the container the
placement already sits in. A container's page reaches the reorder, by dragging and by Move up and
Move down. Only `placement.move` reaches the move between containers, because the Members list is
flat and no tree was ported; ADR-0116 records what that port still owes.

**THE MOVE BETWEEN CONTAINERS WENT UNOBSERVED UNTIL CNCORE-75.** Every test CNCORE-73 wrote moved a
placement within one container, and the one that named a different destination was the cycle
refusal, which proves a move is REFUSED and says nothing about one succeeding. So the third mutation
was a signature nobody had watched work. `placement.test.ts` now moves a member into a second
container and reads both containers back: the destination holds it at its new position and the
origin holds nothing. Made to ignore its destination, the move turns that test red.

**AND THE MOVE RESETTLES THE DESTINATION ONLY, WHICH THE FLIP MADE WORTH SAYING.** The siblings a
move writes are scoped to the container it moves INTO, so the one it LEFT keeps its remaining
members exactly where they were and a hole stands at the position vacated. That is this record's own
posture on a removal, which tombstones the placement and renumbers nothing, and
[[0116-a-reorder-writes-the-delta-and-the-tree-is-keyed-on-the-placement]]'s "no number is invented".
A caller naming an origin sibling anyway is refused and NOTHING is written, rather than the move
landing and the resettle being dropped: a half-permuted ordering is a state to refuse. Both halves
are in `placement.test.ts`, and removing the refusal turns that test red. Whatever first wants the
gap closed is writing a second operation, not widening this one.

**WHICH IS WHY THIS RECORD IS `accepted` NOW AND WAS NOT UNDER CNCORE-72, when the first draft of
that section had it `accepted`.** The argument for flipping then was that this record's RULE -- a
mutation names a placement -- was built and applied, and that the reorder belonged to ADR-0018 and
ADR-0116 rather than here. That argument was not wrong, and it was still the wrong call: `CLAUDE.md`
says a record whose mechanism you built only half of is not one you implemented, and this record's
own inventory of what was missing listed three mutations. Reasoning about which of them REALLY
belong to it is exactly the move that rule exists to stop, because half a mechanism looks finished
from outside.

**IT WAS TO FLIP ON CNCORE-73, AND DID NOT.** That ticket finished the write path, its pull request
said all four mutations were built, and ADR-0116 flipped on the strength of it, while this record
went on saying the reorder and the move were unbuilt. From that merge on, two records disagreed
about one mechanism, which is the drift `CLAUDE.md` means by "a correction propagates, or it has not
landed". CNCORE-75 found it
while checking every record the public release implements, and flipped this one once the mutation
nobody had observed was observed.

**WHAT A REMOVAL DOES TO THE SOURCES, decided under CNCORE-72 and worth recording here because it is
this record's rule meeting ADR-0017's.** A removal tombstones the PLACEMENT and leaves
`placement_sources` standing. The owner taking a member out of their own ordering is not a provider
withdrawing its claim, and ADR-0017 lets a source take back only what it said itself -- so marking
the provider's row deleted would put words in its mouth, and would be indistinguishable later from
the withdrawal `import.ts` performs when a provider really does stop asserting a member -- a
withdrawal a Container walked in BATCHES does not yet get, since CNCORE-373, because no single batch
holds the whole membership; CNCORE-437 builds it (ADR-0135). The member
therefore comes back from an undo with its origin intact, and the undo is a single-row clear.

**The review queue this record hands staleness to still does not exist** ([[0027-two-thresholds-and-a-review-queue]]).
A container whose source has since reordered itself simply stays as it was imported. That is a
consequence this record HANDS OFF rather than a mechanism of its own: the queue is ADR-0027's to
build. It is named here so a later reader does not count it against `accepted`.
