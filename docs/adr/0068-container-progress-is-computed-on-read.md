---
status: proposed
---

# Container progress is computed on read and reports two figures

Derived from the ancestor closure, deduped with `COUNT(DISTINCT item)`, never stored. It reports
BOTH "seen everything that survives" and "seen the whole work". Count-based rather than
duration-weighted, since runtime is missing for most of any real catalogue.

The dedup is load-bearing here in a way it is not elsewhere. Jellyfin's equivalent is correct only
because of an assumption written into its own source — that members of a group are distinct folders
whose leaves cannot overlap. Ours overlap by design.

Computing rather than storing was challenged as the thing Jellyfin switched off for performance. It
survives: Jellyfin 12.0, released 2026-09-08, ships `COUNT(DISTINCT)` over an `AncestorIds` closure
— the same query, arrived at independently.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`.
