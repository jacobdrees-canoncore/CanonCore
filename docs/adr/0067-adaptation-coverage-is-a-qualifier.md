---
status: proposed
---

# How much of a source an adaptation covers is a qualifier

It is a qualifier on the `based_on` statement, never `edition_coverage` — which describes what
fraction of its OWN work an edition covers and cannot see across an adaptation at all.

One novel adapted as two films, and one novel adapted as a whole season of episodes, are the same
mechanism running in opposite directions, and both must work.

An adaptation is a separate item linked by schema.org `isBasedOn`. Schema.org states no
cardinality at all, so nothing prevents a work adapting several sources — which is what we need.
IFLA LRM's own many-to-many relation here is R21 "is inspired by" rather than R22.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-standards.md`.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: the `based_on` statement, the table a qualifier would hang on, and the refusal.**
Migration 1 seeds `based_on` as an item-valued property with `reference_target` frozen to `work`,
and ships `statement_qualifiers` as a table. The half of this record that REFUSES
`edition_coverage` holds by ABSENCE and is the soundest part of it: no `edition_coverage` column,
property or qualifier exists anywhere, so nothing has ever keyed coverage the wrong way.

**NOT BUILT: any coverage qualifier, and so the mechanism itself.** Nothing writes a
`statement_qualifiers` row — `purge.ts` READS the table to decide what an item still stands in,
and that is the only code that touches it — and nothing writes a `based_on` statement outside a
test. So "one novel adapted as two films, and one novel adapted as a whole season of episodes",
the pair this record requires to work in both directions, is a pair the catalogue cannot express
in either. What is recorded here is a shape and a refusal, not a behaviour.
