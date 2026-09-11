---
status: proposed
---

# A declared order picks the edition until the owner pins one

`is_default` is the owner's pin — nullable, at most one per item — and where nothing is pinned a
single declared edition order decides. Never by recency: importing a remaster would silently flip
every default.

This is the same mechanism as the source order and the field favourite, deliberately. One pattern
used three times rather than three patterns.

Calibre is the only mature implementation and it ships the DECLARED-ORDER half only: its preferred
format list consults nothing per book, so there is no per-item pin. Audiobookshelf cannot do it at
all — two narrations of one book are two separate library items, and the narrator goes in the FOLDER
name, which its scanner parses. The multi-narration request is open rather than declined; what
exists is a maintainer's "it's unlikely it gets added since it is a lot of work". Plex merges versions but picks by what the
client can decode rather than by what is canonical, and its users are still asking for a way to set
the one they want.

EDITIONS ARE 0..n, NOT 1..n. Unproduced and unreleased works are real and have no edition at all
(ADR-0003), so `is_default` has nothing to point at for them. A NOT NULL
here would make an unproduced work unrepresentable.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-products.md`.
