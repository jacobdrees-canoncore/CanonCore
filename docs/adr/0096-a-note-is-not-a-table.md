---
status: accepted
---

# An owner note is a statement, never a table

Owner free-text about an item is a statement with a `note` property sourced to the Owner. Never
provider-assertable, never in a public payload.

ADR-0045 says the public read path carries "no notes", which
presupposes a concept nothing else defines. This defines it, and it does so without a table: a note
gets rank, language and provenance for free from
ADR-0012, and "never provider-assertable" becomes a property declaration
rather than a code path.

## As built, under CNCORE-74

`note` is the thirteenth seeded property: `text`, `literal`, `single`, and the first row in the
catalogue to declare a capability. Migration 12 seeds it with
`{"assertableBy": ["owner"], "public": false}`, which is this record's two prohibitions as two keys.

**IT IS TWO KEYS AND THIS RECORD NAMED ONE.** "Never provider-assertable becomes a property
declaration" is the sentence above; "never in a public payload" was left as prose beside it, and the
two are different axes. `assertableBy` names SOURCE KINDS, a closed set of four (ADR-0071), and
answers who may write. `public` is a boolean about the READ path, and a reader is not a source --
there is no kind to name, only the owner and everybody else. One key could not have carried both
without conflating two closed sets in one shape, and the pair is why the column is a capabilities
OBJECT rather than a boolean on the definition (ADR-0012).

**THE ENFORCEMENT IS IN THE DATABASE, WHERE ADR-0012 PUTS `validation`'S IN CODE.** That looks like
an inconsistency and is the opposite: the reason that record gives for its own split is that SQL
cannot parse EDTF, and SQL can compare a source kind against a list of them. So what decides here is
migration 1's argument for the projection trigger -- "a trigger cannot be forgotten.
Application-maintained is silently bypassed by anything writing directly". `assertClaims` is the
only writer today and a provider cannot reach `note` through it, because the import writes three
properties by name; the scanner, the merge and whatever ADR-0026 becomes are writers that do not
exist yet to be taught a rule. `refuse_an_unadmitted_source` reads the declaration and names no
property, so the code path this record rejected has not been rebuilt in plpgsql.

**`public: false` IS READ BY `findStatementsOfItem`**, which is the list `itemPublic.statements` is
built from -- so ADR-0045's sentence holds where a stranger is served rather than in a handler. A
`name <> 'note'` filter there would have been the strip-list that record's first line refuses, one
property wide. The note has a reader of its own, `findNoteOfItem`, behind `item.note` -- the only
read on the router that is the owner's rather than open, because a field on `item.get` would be
public by construction and one emitted only sometimes would make ADR-0045's enumeration conditional.

**`single` CARDINALITY IS WHAT MAKES REMOVAL FREE.** A note is the owner's own free text about an
item and there is one of them, so editing REPLACES -- and `assertClaims` making what a source holds
equal to what it now claims means an empty note withdraws the last one, tombstoned rather than
deleted (ADR-0075). One procedure writes, edits and removes, and the page offers one control.

**AN EMPTY NOTE IS ACCEPTED WHERE AN EMPTY TITLE IS REFUSED**, and the asymmetry is the projection.
An empty title projects onto `items.title` as a heading that renders blank, where an item with no
title statement renders "Untitled item" -- two states, one of them useless. A note projects onto
nothing, so an empty one and an absent one are the same claim.

**WHAT IS NOT BUILT, named rather than left to be found.** Nothing checks that the strings in
`assertableBy` are among ADR-0071's four source kinds. `source_kinds` is a table and a CHECK
constraint cannot reach one, so the alternatives were the closed set written a second time in SQL --
free to drift from the table that owns it -- or a trigger on `properties` guarding a declaration only
a migration may write (ADR-0029). The gap is bounded by the ladder, which is where every property is
written, and its cost is that a misspelled kind would read as "no source may assert this". It is the
same shape of limit ADR-0012 names for `validation`'s `format`, and for the same reason.
