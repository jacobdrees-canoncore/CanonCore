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
