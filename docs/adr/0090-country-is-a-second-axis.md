---
status: proposed
---

# Country is a second axis, and language tags are BCP 47

A statement carries a nullable `country` alongside its language. COUNTRY IS NOT A SYNONYM FOR
LANGUAGE. Plex and Jellyfin both carry the two separately because content ratings key on country
while artwork keys on language, and a language column alone does not close that.

Language tags are BCP 47 rather than ISO 639-3, because BCP 47 subsumes script into the tag
(`ar-Latn`), so a third axis costs nothing. MusicBrainz has to carry Script (ISO 15924) as a field
of its own PRECISELY BECAUSE it uses ISO 639-3 for language — that is the cost avoided. IIIF, which
is on BCP 47, defines no script property at all and simply notes that "BCP 47 allows the script of
the text to be included after a hyphen, such as `ar-latn`". IIIF is the witness for this choice, not
a counter-example to it. (Its lowercase `ar-latn` is valid — RFC 5646 makes tags case-insensitive —
but the registry form is titlecase, so write `ar-Latn`. The example earns its place: `ar` carries
`Suppress-Script: Arab`, so naming Latin genuinely distinguishes.)

LANGUAGE has no absent value: unknown is the value `none`, copied literally from IIIF Presentation
3.0 section 4.4 where it is a `must`. COUNTRY does — it is nullable, and NULL means the claim is not
country-scoped at all, which is the ordinary case. The two axes differ here on purpose: every string
is written in some language or none, whereas most claims are simply not about a country. Without unknown-language being a real value, "show me the untagged
ones" cannot be expressed at all. Note that §4.4 covers TWO cases under one value — "the language is
either not known **or** the string does not have a language" — and a catalogue number is the second,
not the first.

Related: ADR-0091.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: both columns.** `statements.language` ships NOT NULL with the default `none` and
`statements.country` ships nullable, both in migration 1, and the schema carries this record's own
reasoning beside each of them.

**NOT BUILT: any read or write that means anything by either.** Nothing in `packages` or `apps`
reads or writes either column, so every statement in the catalogue holds the default `none` and a
NULL country, and neither use this record argues from — content ratings keying on country, artwork
keying on language — has anything to key on. **The BCP 47 rule is enforced nowhere**: no validation
reads the column, so `ar-Latn` and `ar-latn` are equally accepted and the registry form is a
convention stated here rather than a shape the catalogue holds.

ADR-0092 carries this note for the same shape one column along, in nearly the same words — BUILT
the column, NOT BUILT any read that means anything by it — which is why the silence here read as
inconsistency rather than terseness (CNCORE-247).
