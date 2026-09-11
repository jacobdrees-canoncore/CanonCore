---
status: proposed
---

# Files relate many-to-many, and several works over one file are never collapsed

One edition may span several files, and one file may cover several works — a double episode, a
compilation disc, an omnibus edition.

The schema half is routine; the irreversible half is the parser. Jellyfin's NFO parser joins N
episode titles with " / ", so two episodes become one item called "Rose / The End of the World"
and the second stops existing as anything anyone can place, watch or link to. Plex and Kodi both
keep N items over one file.

Each work's coverage of a shared file is a SET, not an interval: Kodi's `S01E01E04` names episodes
1 and 4 and EXCLUDES 2 and 3. (Kodi v22 added an inclusive form too, `S01E01-E04` meaning 1 through
4, so there are now two notations — concatenation is still a set.) The honest cost, which Kodi documents and we inherit, is that one
playback offset across a shared file still marks the wrong parts watched.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-products.md`.
