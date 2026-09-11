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
