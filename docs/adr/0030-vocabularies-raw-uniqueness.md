---
status: accepted
---

# Uniqueness sits on the raw vocabulary value, and there is no normalised key

Every vocabulary is a lookup table with `retired` and a separate `quarantine` state, and no
database enums anywhere. Uniqueness is on the raw value, as Jellyfin's is.

The normalised match key was MEASURED and refuted, and **re-measured against the LIVE wiki on
2026-09-13 (CNCORE-103), where it is refuted again: it collapses 0 of 70 `Medium` values and 1 of
1,557 `Writer` values.** The one `Writer` collision is `Paul W Robinson` against
`Paul W. Robinson` — a stop, which is exactly the class of thing case-folding DOES reach, and it is
one row. The archive gave 0 of 70 and 1 of 1,566 on 2026-09-10, so the refutation survived the
source being replaced.

The wreckage is SEMANTIC — free text typed into a field expecting a term — and no amount of
case-folding reaches it. That is evidence for the quarantine state we already have rather than a
gap beside it.

WHERE A NORMALISED KEY *WOULD* BITE IS A FIELD THIS DECISION DOES NOT COVER, and it is worth
naming so the refutation is not read wider than it was measured. `Series` collapses 70 of 1,016,
because the wiki types wikitext into it: `Virgin New Adventures`, `[[Virgin New Adventures]]` and
`''[[Virgin New Adventures]]''` are three values for one series. That is a parsing defect on the
way IN rather than an argument for a match key on the way out.

Where uniqueness sits is the one frozen decision here: moving the constraint later means resolving
whatever collided in the meantime.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`. **The archive is deleted (ADR-0129) and every figure above was re-derived from the LIVE wiki on 2026-09-13 by `provider-wiki`'s `pnpm measure:live`.** The archive-era working is `docs/research/verify-new-adrs-archive.md`, which stays as the frozen record it is: it describes a corpus taken 2026-09-04, not the wiki.

## As built, under CNCORE-4

"One lookup table per property" is the model, not the DDL. The table is
`vocabulary_values`, one row per allowed value, keyed by property -- and the
name follows CONTEXT.md, where a VOCABULARY is the lookup backing one property
and a row in it is a VALUE. The retired column list CNCORE-4 worked from called
the table `vocabularies`, which read as though one row were one vocabulary; the
glossary settles it the other way.

`retired` and `quarantined` are two booleans rather than one state column,
because they are orthogonal: retired is a value deliberately deprecated and kept
for the rows already using it, quarantined is a value that arrived broken from
an import. A value can be both.

The uniqueness is on `(owner_id, property_id, value)` -- the RAW value. A test
stores "Short story" and "short story" side by side and asserts both survive,
which is the measured decision made falsifiable.

## The posture, copied to a statement, under CNCORE-29

`quarantined` HAS A SECOND HOME: `statements.quarantined` (migration 6), where a
date that is not EDTF lands. A date is not a vocabulary value and gets no row
here, so the mechanism is not shared -- what is shared is the posture this record
argued for, take it and mark it rather than refuse it at the door, and the reason
is the same one: values ARRIVE AT RUNTIME from imports, and a bulk import that
aborted over one bad string would cost a container to save a field. ADR-0073
carries what the check is and which half of it is built.

Nothing about the vocabulary decision changes. Named here because a reader
looking for "where does quarantine live" would otherwise find one of the two.
