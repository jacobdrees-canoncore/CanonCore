---
status: proposed
---

# Items exist with no file

LRM states that "no work can exist without there being at least one expression (or there having
been at some point in the past)". An item here may have zero editions and zero files, and always.

That parenthetical matters and was truncated in an earlier version: it already covers the lost-work
case, which is most of what makes this model necessary.

A novel you do not own is a complete entry. Neither incumbent can do it for a user: every
user-facing creation path in Jellyfin calls `Directory.CreateDirectory` first and there is no
generic create-item endpoint — though pathless virtual items DO exist internally
(`LocationType.Virtual`, missing episodes), so the honest claim is that an item cannot be CREATED
without a file rather than that it cannot exist. Calibre is the only mature product shipping
anything comparable.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-standards.md`, `docs/research/verify-adr-products.md`.
