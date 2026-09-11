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
