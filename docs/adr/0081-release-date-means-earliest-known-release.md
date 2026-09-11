---
status: proposed
---

# `release_date` on an item means the earliest known release of any edition

Editions carry their own dates as statements; the item's projected `release_date` column is the
earliest of them.

Define it or two implementers fill it two ways and a sort key disagrees with itself. One novel in
the archive was published 1997-06-26 in the UK and 1998-09-01 in the US, fifteen months apart, so
"the release date" is a real question with two defensible answers.

ADR-0014 argues the projection for `title` and `sort_name`; `release_date` is the third column of
the same shape and the only one whose definition is genuinely ambiguous, which is why it needs a
record and they do not. Stored under ADR-0073.
