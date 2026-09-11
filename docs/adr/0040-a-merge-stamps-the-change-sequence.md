---
status: proposed
---

# A merge stamps its id on every row it touches

Reversal becomes a query — find everything stamped with merge 47 — rather than `merged_from`
columns or a second history mechanism. The loser stays a permanent alias, so no URL ever breaks.

Recording is the half with a deadline; an unmerge UI is not, and can arrive whenever. The
information needed to reverse a merge is destroyed by the merge itself.

The field does not do this: only Plex ships a split at all. Calibre has none, MusicBrainz has eleven
merge edit types and zero unmerge, and Jellyfin's re-points collection references on merge and never
re-points them back. Wikidata's request for an undo tool has been open since 2019 and Open Library's
since 2021, both naming the same cause.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-standards.md`, `docs/research/verify-adr-products.md`.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: the stamp, and nothing that writes one.** `merge_id` sits on every
table a merge can touch, referencing a `merges` table, and rests on the one
global change sequence of ADR-0075. `aliases` exists, is unique on the
merged-away id, and refuses an alias pointing at itself. `item.get` FOLLOWS an
alias and answers with the survivor under its own canonical id, so the promise
that no URL ever breaks is already kept and already tested.

This is in migration 1 because it is the half that cannot be retrofitted: rows
written before the stamp carry no `merge_id` and no ordered change sequence, so
a reversal cannot see them.

**NOT BUILT: the merge itself.** No operation writes a `merges` row. Recording
is the half with a deadline and it is met; the merge and an unmerge UI can
arrive whenever, as this record already says.

`aliases.alias_item_id` carries no foreign key ON PURPOSE: the row it names is
gone, which is what makes it an alias rather than a second pointer at a live
item.
