---
status: proposed
---

# Only the product adds fields

Neither a provider nor the owner can define one. Anything a provider sends with no matching field
is dropped at the door and counted, so the owner is told "this provider sent 340 things we have no
field for" and decides whether to add one.

Owner-defined custom fields are refused because the provenance and per-edition rules have nothing
to attach to when there is no declared field. A tag is likewise not a table — it is an
owner-authored `category` statement, which gets provenance for free.

A REFERENCE TABLE holds the product's own closed sets — item kinds, source kinds, file roles,
artwork roles. It holds no owner data, and nothing is minted into one outside a migration: a row
appearing there at runtime is the same defect as a provider defining a field, arriving by a
different door.

A VOCABULARY IS NOT A REFERENCE TABLE, and the distinction is the whole reason both exist. A
vocabulary backs one property's allowed values, takes values at runtime from imports, and carries a
`quarantine` state precisely because those values arrive broken (ADR-0030). Adding a vocabulary row
at runtime is the system working; adding a reference-table row at runtime is a bug.
