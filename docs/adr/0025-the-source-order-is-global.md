---
status: proposed
---

# The source order is global; a group picks providers but never re-ranks them

A group chooses which providers are asked, which is what actually delivers "this group prefers the
wiki" — a group that never connects TMDB cannot be beaten by TMDB. The ranking among them is one
order for the whole instance.

Per-group ranking cannot answer the case it would create: an item in two groups whose orders
disagree has two answers for one field, on one page, reached by one URL.

Accepted cost, stated plainly: two providers cannot be ranked differently in two groups that both
ask both.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: the global order.** `sources.source_order` is unique per owner, so
there is exactly one ranking for the instance and it cannot be expressed twice.
The owner is seeded into it at 0.

**NOT BUILT: the group half.** "A group picks providers but never re-ranks them"
needs groups, and groups are not a table yet. The accepted cost this record
states -- two providers cannot be ranked differently in two groups that both ask
both -- is not yet payable, because groups do not exist.

(An earlier version of that sentence said "neither groups nor providers exist".
Providers do: a provider takes a `sources` row on its first import, and takes
the next place in this order rather than competing for one -- CNCORE-6 for
`lookup`, CNCORE-7 for `browse`. Groups are the half that is still missing, and
one of the two is enough to make the cost unpayable.)

## A second site applies this order, under CNCORE-5

`findPlacementsOfItem` decides which source speaks for a PLACEMENT by these same terms, in the same
sequence, so provenance on a placement and provenance on a field cannot disagree. The rule is
written twice, in SQL and in TypeScript, and holding the two identical is a stated obligation of
both -- see [[0017-placements-carry-sources-and-rank]].

## And it decides a second thing now, under CNCORE-7

The same three terms also settle WHICH OF TWO PLACEMENTS SPEAKS when two sources disagree about
position -- two rows, both standing, the winner first. That is not a new rule, it is this one
reaching the case [[0017-placements-carry-sources-and-rank]] was waiting for a second origin to
produce, and `browse` is that origin.

## The owner's place in the order gets a WRITER, under CNCORE-71

**BUILT: something that actually writes at `source_order` 0.** Migration 1 seeded
the owner into the order and, until this slice, nothing in the product ever wrote
a statement against that row -- the seed did, and the purge fixture did, and both
are harness rather than product. `createItemByHand` and `retitleItemByHand` are
the first writers, so "nothing the owner asserts is ever beaten by a provider" is
now a property a user can produce rather than one only a fixture could
demonstrate.

**AND IT IS WHAT MAKES THE ORDER'S POINT VISIBLE.** An owner retitling an imported
item outranks the provider with no rank set and no favourite chosen, because 0
comes first -- and the provider's claim STILL STANDS beside it, since a source may
only withdraw what it said itself. That pair is asserted at all three seams.

**THIS RECORD STAYS `proposed` FOR THE REASON IT ALREADY GAVE.** The group half is
still missing, groups are still not a table, and CNCORE-71 adds neither.
