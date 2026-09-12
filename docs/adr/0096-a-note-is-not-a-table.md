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

**WHAT `ownerNote` CARRIES IS TWO FIELDS, and the kind is not one of them.** The note's value and
its source's LABEL, because the page has to say whose words these are and reads that off the row
rather than printing "Owner" for itself. The source KIND was emitted at first and read by nothing --
it can only ever be `owner` while this declaration stands -- which is the "field added against a
reader that does not exist" ADR-0045 is the record for, and the same ground on which the same
docstring had already rejected a `property` field. It was dropped under review.

**`single` CARDINALITY IS WHAT MAKES REMOVAL FREE.** A note is the owner's own free text about an
item and there is one of them, so editing REPLACES -- and `assertClaims` making what a source holds
equal to what it now claims means an empty note withdraws the last one, tombstoned rather than
deleted (ADR-0075). One procedure writes, edits and removes, and the page offers one control.

**AND THAT IS WHY AN UNREADABLE FIELD MUST NOT BECOME AN EMPTY ONE -- under CNCORE-123.** If
clearing the box is the removal, then anything a surface silently reads AS a cleared box performs the
removal too. `FormData.get` answers `File | string | null`, so a note field sent as a file part is
not text at all, and the tempting narrow fix -- coerce it to `""` and carry on -- would withdraw the
owner's note on a request nobody made. It is read as NOT GIVEN instead and the write does not happen:
nothing given is not the same claim as nothing said. ADR-0066 carries the shared rule and why the
refusal takes the shape it does; what belongs here is that this property is the one where getting it
wrong DESTROYS something, which is why the `note` field is where that rule is asserted at the
page-over-HTTP seam.

**AN EMPTY NOTE IS ACCEPTED WHERE AN EMPTY TITLE IS REFUSED**, and the asymmetry is the projection.
An empty title projects onto `items.title` as a heading that renders blank, where an item with no
title statement renders "Untitled item" -- two states, one of them useless. A note projects onto
nothing, so an empty one and an absent one are the same claim.

**THE RULE IS RE-CHECKED ON `UPDATE OF "source_id", "property_id"` AND NOT ON A BARE `UPDATE`, AND
THE FIRST VERSION GOT THAT WRONG.** Those two columns are what the rule is about; a bare `UPDATE`
re-checked it against every other write to a statement as well, and the two that matter are not
assertions at all -- `assertClaims` TOMBSTONING what a source no longer claims by setting
`deleted_at`, and migration 1's cascade taking an item's statements down with the item the same way.
The cost was ADR-0015's own rule broken: `capabilities` is editable so that a declaration can be
tightened later, and that record says tightening "never rejects existing rows either -- it marks the
property as having offenders and lets you list them". Under a bare `UPDATE`, narrowing `assertableBy`
made every statement already written by a no-longer-admitted source impossible to WITHDRAW, and so
its item impossible to DELETE. Tightening trapped the rows instead of marking them. **A DECLARATION
THAT CAN BE TIGHTENED HAS TO BE RE-CHECKED ONLY WHERE THE THING IT DECLARES ABOUT IS CHANGING**,
which is the transferable half and is why it is written here rather than in the migration alone.

**AND THE CONSTRAINT IS DECLARED IN `schema/tables.ts`, NOT ONLY IN THE RUNG.** ADR-0047's rule is
that the schema and the head snapshot must agree -- "declare what can be declared and generate it;
hand-write what cannot". A CHECK on a declared table is the declarable case, so the rung is
GENERATED and the data statement and the trigger are hand-written into it. The first version
hand-wrote all three with `tables.ts` untouched, which broke nothing that day, because `generate`
diffs the schema against the snapshot and neither held the constraint -- and would have emitted it a
second time for whoever next added the check beside its sibling. `generate` answering "no schema
changes" is that record's own test that it is right.

**WHAT IS NOT BUILT, named rather than left to be found.** Nothing checks that the strings in
`assertableBy` are among ADR-0071's four source kinds. `source_kinds` is a table and a CHECK
constraint cannot reach one, so the alternatives were the closed set written a second time in SQL --
free to drift from the table that owns it -- or a trigger on `properties` guarding a declaration only
a migration may write (ADR-0029). The gap is bounded by the ladder, which is where every property is
written, and its cost is that a misspelled kind would read as "no source may assert this". It is the
same shape of limit ADR-0012 names for `validation`'s `format`, and for the same reason.
