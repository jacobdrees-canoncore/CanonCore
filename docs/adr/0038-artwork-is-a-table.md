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

## As built under CNCORE-358 — and this record stays PROPOSED

**BUILT: the table, and three of its five attributes.** Migration 24 creates `artwork`: one row
per stored picture, with its item, its source, its `role` in the source's own word, its `licences`
as the source's own labels, and its `attribution`, which is the credit belonging to THAT FILE
rather than the source's credit line on `sources`. `licences` is NOT NULL and empty is the source
stating none, never a gap a reader may fill. The wiki sends a file page URL where it keeps the
photo credit, so that URL is what `attribution` holds and the page links it; a source with no such
page leaves it null. The same rung deleted the seeded `image` Property, which was artwork held as
a Statement, the thing this record's first sentence refuses.

**A REFRESH REPLACES ROLE BY ROLE, AND A ROLE THAT BROUGHT NOTHING KEEPS ITS PICTURE**, because a
fetch can fail for reasons that say nothing about the record. A replaced row is deleted rather than
tombstoned: the row is the bytes, and a tombstone would keep every superseded picture forever.

**NOT BUILT: the palette and the pin.** No palette is extracted and there is no `is_default`, so
where an item has two pictures of one role the source's order decides by default rather than by
design. Both are CNCORE-372's, which is why this record stays `proposed`. And this record's "comes
only from providers" is built by there being no other way in: no upload, no scan, no `.nfo`.

