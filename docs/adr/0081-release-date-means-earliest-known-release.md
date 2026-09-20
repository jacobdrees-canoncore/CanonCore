---
status: proposed
---

# `release_date` on an item means the earliest known release of any edition

Editions carry their own dates as statements, and the item's `release_date` column is DEFINED as
the earliest of them. Defined rather than filled: nothing projects the column today, and the
section below says why that is deliberate.

Define it or two implementers fill it two ways and a sort key disagrees with itself. One novel in
the archive was published 1997-06-26 in the UK and 1998-09-01 in the US, fifteen months apart, so
"the release date" is a real question with two defensible answers.

ADR-0014 argues the projection for `title` and `sort_name`; `release_date` is the third column of
the same shape and the only one whose definition is genuinely ambiguous, which is why it needs a
record and they do not. Stored under ADR-0073.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: the column, and the definition above it.** `items.release_date` ships with migration 1,
and this record is what says which of two defensible dates belongs in it.

**NOT BUILT: the projection, and the `editions` table it would read.** `project_item()` sets
`title` and `sort_name` and stops there. The migration excludes the column in as many words —
"`release_date` is NOT projected here, and its absence is deliberate" — because projecting it from
ITEM statements would fill the column with a different definition of the value than this record
gives, which is worse than leaving it empty. `projection.test.ts` pins that: a `released`
statement on an item leaves the column null. `editions` does not exist at all, which ADR-0092
records as the same absence from the other side.

**THE SENTENCE ABOVE USED TO ASSERT THE PROJECTION AS FACT**, and it is corrected where it stands
rather than annotated beneath. It read "the item's projected `release_date` column is the earliest
of them", which was never true of anything that shipped. That is the worst shape this defect takes:
the migration said the opposite in a comment, the test pinned the column null, and the authority
went on stating the built behaviour of a thing nobody had built (CNCORE-247).
