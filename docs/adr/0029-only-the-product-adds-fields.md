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

## The rule operating, under CNCORE-74 -- and this record stays PROPOSED

**THE FIRST PROPERTY MINTED SINCE THIS RECORD WENT IN THROUGH A MIGRATION.** The owner note is a
Statement against a `note` property ([[0096-a-note-is-not-a-table]]), which was not among the twelve
migration 1 seeded, so CNCORE-74 added a thirteenth -- in migration 12, which is the only door this
record leaves open. Nothing at runtime writes `properties`, and the owner got their free text
without a field of their own being defined, which is this record's refusal holding in the case most
likely to break it.

**AND THE TRIGGER THIS RECORD WOULD LICENCE WAS DELIBERATELY NOT BUILT.** Migration 12's own comment
names it: `capabilities.assertableBy` should name one of [[0071-four-source-kinds]]'s four kinds, a
`CHECK` cannot reach the `source_kinds` table, and the alternatives were the closed set written a
second time in SQL or a trigger validating a declaration only a migration may write. Neither was
built. The gap is bounded by the ladder -- every property is written there -- and its cost is that a
misspelled kind reads as "no source may assert this".

**NOT BUILT, AND IT IS THE HALF THIS RECORD IS NAMED FOR: the counting.** "This provider sent 340
things we have no field for" is a number nothing computes, and there are two doors it would have to
count at. `cmppRecord` is a plain `z.object`, so a field the contract does not name is stripped at
parse and never reaches the catalogue. And `writeProvidedItem` asserts three properties --
`external_id`, `title`, `released` -- out of a record that also carries `writers`, `series` and the
provider's own finer `kind`; `import.ts` says in as many words why each of those is deliberately not
imported, which is a decision taken well rather than a decision the owner is told about. Nothing
tallies either loss, so the owner is never shown the choice this record says is theirs. That is the
import path's to build and it is why this record stays `proposed`: the refusal half is enforced and
the telling half is absent.

