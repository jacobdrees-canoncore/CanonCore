---
status: proposed
---

# A placement may name an edition

`placements.edition_id` is nullable and earns its keep: a container may hold a SPECIFIC edition
rather than the work. A 4K box set contains the 4K editions, not "the films", and a DVD box set
holds the specific transfers in it.

This reads as an accommodation for one archive's oddities and it is not. It recurs in ordinary
mainstream content, which is why it survives ADR-0059's rule against decisions
justified only by what one dataset contains.

Written down because it is the one column an implementer is most likely to drop as unexplained.
Extends ADR-0009.

## The decision the uniqueness key makes, stated rather than inherited

`edition_id` sits OUTSIDE `(owner, container, item, position)`, so the theatrical cut and the
extended cut of one film may NOT both sit at position 1 of one container. That is intended: a
position in a container holds an ITEM, and which edition opens there is decided at read time
([[0065-which-edition-opens]]). A container that genuinely wants both cuts in sequence is placing
them at two positions, which is what a sequence is.

It is written down because it is a decision made by an ABSENCE -- three columns named and a fourth
not -- and an absence reads as an oversight to everyone who did not make it. A test pins it, and the
test also guards the trap underneath: PostgreSQL holds two nulls unequal, so adding `edition_id` to
the index without `NULLS NOT DISTINCT` would let two byte-identical rows through for the common case
where no edition is named at all. Drizzle exposes `nullsNotDistinct()` for it. Measured on
PostgreSQL 18.6 on 2026-09-10, not recalled: a default unique index accepts `(1, NULL)` twice and
leaves two rows, while the same index declared `NULLS NOT DISTINCT` refuses the second with
`duplicate key value violates unique constraint`.

An earlier version of this line cited **17.11**, which is not a version this project runs: the
compose file and all three CI services pin `postgres:18`. 17.11 is the Homebrew instance
[[0104-one-container-a-database-per-worktree]] exists to warn about, which shadows the container on
5432 and answers as though it were the real one. The behaviour is identical on both, so the
conclusion never moved -- but a measurement taken against the engine a neighbouring record forbids
is not a measurement, and the correction is recorded rather than quietly swapped.

## As built, under CNCORE-4 and CNCORE-5 -- and this record stays PROPOSED

**BUILT: the column.** It ships with migration 1 because placements do.
**NOT BUILT: `editions`, the foreign key, and any read that means anything by the column.** The read
path deliberately does not emit `edition_id`: there is no table behind it, so a reader could do
nothing with the value. It is named in the schemas package as a field kept out on purpose rather
than one nobody thought of.
