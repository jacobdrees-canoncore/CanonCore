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
Statement against a `note` property ([[0096-a-note-is-not-a-table]]), which was not among the eleven
migration 1 seeded, so CNCORE-74 added a twelfth -- in migration 12, which is the only door this
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
things we have no field for" is a number nothing computes. There were two doors it would have had to
count at, and since CNCORE-349 there is one.

**THE DOOR A LAYER ABOVE, AT PARSE, IS OPEN (CNCORE-349).** Until then `cmppRecord` was a plain
`z.object`, so a key it did not name was stripped before anything downstream could see it: every
property a source defines beyond the contract, and two fields the contract itself declares,
`images` and `external_ids`. It is a `z.looseObject` now. A source-defined key survives the parse,
and `external_ids` is named and shaped there and written as the item's Identifiers (ADR-0078's
as-built section says why a table and not a Property). Nothing is lost at parse any more.

**THE DOOR AT THE IMPORT DROPS SIX OF THE CONTRACT'S TEN FIELDS, AND EVERY SOURCE-DEFINED KEY.**
Measured on 2026-09-26 against `packages/contract`'s `record`, which declares `id`, `title`, `kind`,
`released`, `writers`, `series`, `url`, `series_id`, `images` and `external_ids`. Four reach the
catalogue: `id` as `external_id`, `title`, `released`, and `external_ids` as Identifiers. Six do
not: `writers`, `series` and the provider's own finer `kind`, which `import.ts` says in as many
words why it does not import; `series_id`, which `provider.containerOf` reads one click at a time
and nothing stores; `url`; and `images`, which since CNCORE-349 survives the parse to be dropped
here instead. This paragraph used to name only the first three at this door, and blamed the
`z.object` for nothing it declared, so it undercounted both doors. Each drop is a decision taken
well rather than a decision the owner is told about. Nothing tallies either loss, so the owner is
never shown the choice this record says is theirs.

**AND THIS RECORD STAYS `proposed`, WITH THE HALF THAT LANDED WRITTEN HERE.** CNCORE-349 opened the
wire and nothing more: a claim now reaches the import to be counted, which it could not while the
parse stripped it. The telling half this record is named for (holding the claim, counting it,
reporting it) is CNCORE-371's. So is the reversal of the refusal half, since adopting a held
property is the Owner defining a field, which this record's first sentence forbids.
