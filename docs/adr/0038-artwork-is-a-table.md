---
status: proposed
---

# Artwork is a table, not a statement, and comes only from providers

It is the one provider value carrying attributes of its own — role, licence, attribution, palette,
and a pin. A statement carrying all of those is a table wearing a statement's name.

The palette rule is unimplementable otherwise: it attaches to the artwork ASSET, and an item with a
poster and a backdrop has two palettes with no row to hang the second on. `is_default` is per
(item, role), which is how Plex locks thumb, art and clearLogo separately; where nothing is pinned
the declared source order decides, so no rank column is needed. A set pin survives a source-order
change untouched — see the record on the favourite being the lock, which is where that carve-out is
argued and why it exists.

No uploads, no artwork scanning, and nothing taken from an `.nfo` — not embedded, not by following
a local path it names. Accept that a private instance with no provider connected has no artwork.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`.
