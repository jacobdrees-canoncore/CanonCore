---
status: accepted
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

## As built, under CNCORE-71

**THE CLAIM IS NOW USABLE RATHER THAN ONLY TRUE OF THE SCHEMA.** `items` never
required a file and never will, but until this slice there was no way for an
owner to MAKE one: every write path into the catalogue began at a provider
record, so an item with no provider record and no file was a state the model
permitted and the product could not reach. `/new` is that path --
`createItemByHand` writes the row and the owner's own `title` statement in one
transaction, and nothing on it names an external id.

**THE DISTINCTION THIS RECORD DRAWS IS THE ONE THE BUILD HAD TO HONOUR.** The
record corrects itself to say that Jellyfin cannot CREATE a pathless item rather
than that it cannot hold one -- `LocationType.Virtual` exists internally. That is
exactly the line CNCORE-71 crosses: the create path is the half that was
missing here too, and it is the half that was built.

**WHAT IS STILL NOT BUILT IS NOT THIS RECORD'S.** An item with zero EDITIONS is
what this record also permits, and editions arrive with their own slice -- but
that is a table that does not exist yet rather than a claim of this record left
half-implemented. Nothing an owner can do today produces an edition, so "zero
editions, always" is the only state there is.
