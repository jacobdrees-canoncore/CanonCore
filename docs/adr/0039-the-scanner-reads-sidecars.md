---
status: proposed
---

# The scanner reads `.nfo` and embedded tags, and never writes storage

It takes media files, playback sidecars, `.nfo` files and the tags inside media. It never creates
folders, moves files, writes an `.nfo` back, or writes its structure to disk.

Reading `.nfo` reverses an earlier refusal. It did not survive Plex shipping NFO support in PMS
v1.43.1, while Kodi, Emby and Jellyfin already read it.

Two details were wrong and are corrected. Plex does not give portability as the reason — its article
names three, none of them that: "particularly useful for personal media collections, content not
found in online databases, or when you simply prefer full control over your metadata". The nearest
portability claim it makes is scoped to one server: watch status survives "across rescans". And
"declined since 2008" is unfounded — 2008 is Plex's founding year, and the earliest retrievable
request on its live forum is 2013. Embedded tags come free with the analysis pass, since MediaInfoLib returns
`Album`, `Album/Performer` and `Track/Position` in the same call as duration; refusing them means a
provider-less instance shows filenames instead of track titles.

Both are SIDECAR sources, never the Owner — usually another scraper's output from years ago, so
filing them as the owner would hand stale third-party data the top rank and make it unbeatable.

Every catalogue that writes the filesystem has a single-parent model, and that is a requirement
rather than a coincidence.

## Supersedes

An earlier decision refused `.nfo` reading outright, and refused it for eighteen years' worth
of good reasons that stopped being good. It is recorded here rather than deleted, because a reader
who finds the old refusal elsewhere should be able to see it was reversed on evidence rather than
forgotten.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-products.md`.
