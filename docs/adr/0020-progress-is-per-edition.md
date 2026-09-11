---
status: proposed
---

# Progress is per edition, not per item

Finishing a novelisation must not mark its film watched, and this is the decision that justifies
editions existing at all.

It is placement-independent, so watching a thing once marks it watched in every ordering it
appears in. Position is stored as a Readium locator — a normalised `totalProgression` 0..1 (Readium's
`progression` is per-resource, which is not what we mean) plus an opaque per-medium locator — because `text` is a first-class medium and every clock-shaped rule is
inexpressible for a book. Jellyfin's ebook reader fakes it, returning `duration() { return 1000 }`,
and reports every book as a thousand milliseconds long.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-standards.md`.
