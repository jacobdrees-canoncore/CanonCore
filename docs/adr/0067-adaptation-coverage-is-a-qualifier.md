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
