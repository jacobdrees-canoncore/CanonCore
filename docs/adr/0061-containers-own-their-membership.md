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

## Half built, under CNCORE-7 -- and this record stays PROPOSED

**BUILT: membership owned outright, and now demonstrably.** `browse` writes a container's members
into that container and nowhere else, and the owner then places the same imported story into a
second ordering of their own without the first noticing. Two containers, two positions, two
independent memberships -- which is this record's claim, and it is now something a person can look
at rather than a property of the schema.

The duplication this record accepts is visible in the same place: the story sits in both containers
as two placement rows, and neither is derived from the other.

**NOT BUILT: mutations naming a PLACEMENT.** There are none. Nothing removes a member, reorders one,
or moves one between containers, so the rule that a mutation names a placement rather than an item
has nothing to apply to yet. That is the half worth naming, because it is the half the record adds
over "containers own their membership" -- and it is forced by duplicates being allowed, so it cannot
be inferred from the code as it stands. It arrives with the first edit path.

**And the review queue this record hands staleness to does not exist either** ([[0027-two-thresholds-and-a-review-queue]]).
A container whose source has since reordered itself simply stays as it was imported.
