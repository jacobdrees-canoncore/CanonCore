---
status: accepted
---

# The public read path names every field it emits

It is never the owner payload with fields removed, because a strip-list works until someone adds a
field and forgets.

It carries no internal ids, no owner id and no notes, so a field added later is private by default
and the enumeration oracle goes with the ids.

## The reader's word, not the key

A field whose values come from one of the product's closed sets carries the READER'S WORD for the
value rather than the key it is filed under: `Time span`, never `time_span`. `CONTEXT.md` is binding
on UI copy and is where those words are settled, and the migration that owns a set seeds a label
beside every key in it — so the read path READS the label. A map written in the app would be the
same rule in a second language, and it would go stale the day a migration revises a word.

IT HOLDS ACROSS SURFACES RATHER THAN PER FIELD. The catalogue listing and the item page both emit
`kind`, and one of them answering with the key would make `kind` two conventions inside one read
path — which is what CNCORE-83 found and fixed, the listing having been right and `item.get` wrong.

THE KEY IS NOT EMITTED BESIDE THE LABEL, because no reader branches on one. What a surface actually
branches on for an item is ADR-0004's fold, and `isContainer` carries that. A second field for the
column would be a field added against a reader that does not exist, which is the first sentence of
this record read the other way round.

A SURFACE MAY STILL HAVE WORDS OF ITS OWN, and that is not an exception. The item page calls a
`provider` placement "Imported" where `source_kinds.label` says "Provider", because the question
that list asks is how the item came to be in this container rather than what sort of thing asserted
it. The rule is that a label answering the reader's question is read rather than restated; where the
reader is asking a different question, the surface answers it in its own words.

**AND `placedBy` IS WHAT THAT LOOKS LIKE IN THE PAYLOAD**: it emits the source kind's KEY —
`provider`, `owner` — which paragraph one would otherwise forbid. It is the key because no label in
the catalogue answers the question that list asks, so the surface supplies the words and needs the
key to choose them by. Said here rather than left to be worked out, because a field emitting a key
looks the same from outside whether it is this case or the one CNCORE-83 fixed. The test is whether
a seeded label answers the reader's question: where it does, the read path reads it and emits the
words; where it does not, the read path emits the key and the surface writes the words.

**`everyPlacedBy` JOINED IT UNDER CNCORE-129 AND CARRIES A SECOND REASON BESIDE THAT ONE.** It names
every origin an Item has a Placement from — the set the four words on the chips are chosen from, so
the first reason is `placedBy`'s exactly. The second is that this key is also what a reader SPELLS:
a chip points at `?placed=<kind>`, so a payload of labels would leave the surface mapping words back
onto keys to build the link, which is the same rule in a second language and pointing the wrong way.

**AND IT IS A FIELD BECAUSE IT IS A SECOND QUESTION, which is this record's first sentence read
forwards.** It cannot be derived from the rows it sits beside: `?placed=` narrows the listing in the
query now ([[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]), so a narrowed page
holds the one origin it was cut to and a capped page holds whatever fitted. A surface deriving the
chips from `rows` would offer the reader only the choice they had already made.

## "No notes" is a declaration, not a filter (CNCORE-74)

This record's second paragraph enumerates what the public read path carries and says "no notes",
and until ADR-0096 was built there was no note for that to be true of. It is true of one now, and
HOW it is kept is this record's own first line applied to itself.

`note` declares `"public": false` in its `capabilities` (migration 12) and `findStatementsOfItem`
reads that declaration. The alternative was `name <> 'note'` in the query that builds
`itemPublic.statements` -- which is a strip-list one property wide, and "a strip-list works until
someone adds a field and forgets" is the sentence this record opens with. Declared beside the
property, the exclusion sits where every other fact about that property already lives (ADR-0015,
ADR-0029), and the next property that should not be public is private in the query by declaring it.

THE FIELD ENUMERATION IS UNCHANGED AND THAT IS THE POINT. `itemPublic` gained nothing: the note is
not a field of the public payload that is sometimes filled, it is absent from it. A conditional
field would have made this record's enumeration conditional too -- readable only by knowing who was
asking -- so the note is answered by `item.note`, the one read on that router behind
`ownerProcedure` rather than open (ADR-0044).
