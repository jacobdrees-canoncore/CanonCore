---
status: proposed
---

# `editions.language` and `statements.language` are two different axes

`editions.language` says what language the edition IS. `statements.language` says what language a
VALUE is written in. A German edition can carry an English title.

Two axes; collapsing them loses both. And they are not redundant even within one language: `en-GB`
and `en-US` editions of one novel are genuinely different texts, not one text with two labels.

`editions.language` is itself a column that projects a statement, the same shape `title` and
`sort_name` take on items under ADR-0014, and a BCP 47 tag with `none` for
unknown under ADR-0090.

Decided during the Harry Potter pass on 2026-09-05.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: `statements.language`, one of the two axes.** It ships with migration 1 as a NOT NULL
column defaulting to `none`, and it is the axis this record shares with ADR-0090.

**NOT BUILT: `editions.language`, and the `editions` table under it.** No migration creates an
`editions` table, so the column this record calls "itself a column that projects a statement"
does not exist and projects nothing. The distinction the record is for — a German edition carrying
an English title — cannot be written down at all today, because one of its two axes is ABSENT
rather than empty, and an axis that is absent cannot be collapsed into the other by mistake either.
ADR-0092 records the same missing table from the placement side, and ADR-0081's `release_date`
waits on it too.

The sentence above states `editions.language` in the present tense. It is kept as the DECISION it
is, and this section is what says it describes nothing yet (CNCORE-247).
