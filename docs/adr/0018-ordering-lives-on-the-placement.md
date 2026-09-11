---
status: accepted
---

# Ordering lives on the placement, never on the item

OAI-ORE states the principle: sequencing "is only true in the context of the specific
Aggregation, and is not a 'global' fact".

Calibre put `series_index` on the book with `UNIQUE(book)` and locked its users into one series per
book forever; they work around it with custom series columns, one per additional series — a user on
its own forum describes "folk that have MANY custom series type columns". A placement also has a stable
surrogate id rather than being keyed on (parent, position), which is what Jellyfin uses — under a
composite key any reorder changes the key and every external reference goes stale.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-standards.md`, `docs/research/verify-adr-products.md`.

## As built, under CNCORE-4 and CNCORE-5

**BUILT.** `position` is a column on `placements` and there is none on `items`, so the Calibre
failure this record is written against is not expressible: an item has no series index to be locked
into. The id is `uuid` with a default, independent of container and position, so a reorder is an
UPDATE to one integer and every external reference survives it.

CNCORE-5 is where that becomes observable. `findPlacementsOfItem` answers with a position PER
ORDERING for one item, and the page prints both. Under a per-item ordering column the same query
could only ever answer one number.

## And under CNCORE-7: a placement may now have NO position

`position` is nullable from migration 2, for members a source declares without placing -- see
[[0009-multi-parent-membership-with-ordering]], which owns that argument and the archive's figures.

It is worth a line HERE because this record is the one about the column. Nullable does not weaken
what it decides: the point was never that a position always exists, it was that WHERE a position
lives is the placement rather than the item. A nullable column on `placements` says "this ordering
has nothing to say about where this member sits", which is a per-placement fact; a nullable
`series_index` on the item would say "this book is in no series", which is a global one, and the
same import that placed the story elsewhere would overwrite it.

`findPlacementsOfItem` answers `null` for one and the page prints "No position given" rather than a
number nobody claimed.
