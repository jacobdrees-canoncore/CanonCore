---
status: proposed
---

# Delete previews its consequences, and confirmation is weighted by outcome

Three outcomes with counts shown first: cancel, remove from this container (offered only when
multi-placed), delete permanently. Deleting a container never deletes its members, and parent edges
are pre-deleted so `ON DELETE SET NULL` cannot turn survivors into phantom roots.

DELETE PERMANENTLY keeps a confirmation that is never dismissible by accident — never a drawer,
never a swipe-away sheet. REMOVE FROM THIS CONTAINER gets no dialog at all and offers undo instead.

NN/g, reviewed 2026-08-07: "Do not use confirmation dialogs for routine actions." Removing a
placement is the most frequent editing act in a product built on multi-placement, and a heavyweight
confirmation on the common action is what teaches people to dismiss the dangerous one unread.

## What the delete path INHERITS, decided under CNCORE-31

Nothing here is built. When it is, know that DELETE PERMANENTLY already has a
consequence it does not have to write: tombstoning an item tombstones the
statements it is the subject of, by trigger (ADR-0075, migration 5). So a delete
is `deleted_at` on the item and nothing else, and the claims go with it.

That is a consequence this record's PREVIEW should count, since it is part of
what the owner is about to lose, and it is the one the preview cannot see by
looking at placements.

The trigger deliberately stops short of the two things this record already
decides: it does not touch placements, because deleting a container never
deletes its members, and it does not touch statements where the deleted item is
the VALUE rather than the subject. A dangling reference to a deleted item is
this record's question, and it is still open.

## What a PROVIDER PURGE does about the three outcomes, decided under CNCORE-34

A provider purge is the first permanent delete built, and it is the delete where
a preview matters most: it is the one an owner runs under time pressure, after a
termination notice, against a provider whose content they can no longer inspect
because the provider is unreachable. The counts are the only description of it
they are going to get. Two of the three outcomes above carry over; one does not.

REMOVE FROM THIS CONTAINER HAS NO MEANING HERE. That outcome is the offer to
stop an item sitting in one place while it goes on sitting in others, and a
purge names no place: it is every claim one source ever made, across every
container at once. The thing that resembles it -- an item the owner also placed
somewhere surviving, untitled, once the provider's words are gone -- is not an
outcome an owner picks. It is what the delete does on its own to anything
somebody else still claims, so offering it as a choice would be offering to do
what happens anyway. The purge's dialogue is CANCEL and PURGE PERMANENTLY, and
the second inherits this record's weighting: never a drawer, never a
swipe-away sheet.

COUNTS SHOWN FIRST IS BUILT, as `provider.previewPurge`. It answers three: the
provider's statements, the placements this provider was the LAST claimant of
(ADR-0017), and the items left with nothing asserting anything about them and
nowhere they sit -- which is not every item the provider ever wrote.

THEY COME FROM THE DELETE ITSELF. `previewProviderPurge` runs the traversal
`purgeProvider` runs, in a transaction it then rolls back, so there is no second
set of predicates that could drift out of step. That costs the work and the
write locks of a real purge, held for the length of the traversal, and it buys
the only guarantee worth having: a preview cannot contradict the delete an owner
already acted on it to authorise. A preview written as its own traversal was
considered and refused on that ground, because SEVEN separate rules decide
whether a row survives -- six `not exists` clauses on an item, plus the
last-claimant test on a placement -- and each is its own chance to answer a
number the delete then contradicts.

WHAT THE ROLLBACK DOES NOT PUT BACK, since "changes nothing" would otherwise be
read wider than it is true: `change_sequence` values. Deleting a statement
reprojects its item, which touches the row and takes a `nextval`, and a
PostgreSQL sequence is outside the transaction -- so a preview leaves gaps in the
sequence that the rollback keeps (measured: 29 to 30 across a rolled-back
update). Harmless, because ADR-0040 needs the sequence's ORDER rather than its
density and any rolled-back write already leaves gaps. The claim this record
makes is therefore about ROWS: a preview changes no row, and takes locks and
sequence values while it runs.

A PURGE IS NOT A TOMBSTONE, which the section above will otherwise mislead a
reader about. `deleted_at` leaves the row in the table, and ADR-0036's
obligation on termination is to PURGE cached content rather than to hide it, so
this path deletes outright -- and `items_tombstone_statements` is `AFTER UPDATE
OF "deleted_at"` (migration 5), so it never fires on it. The statement count a
purge previews is therefore the provider's own claims counted directly, not the
inferred consequence the section above describes.

WHAT OF THIS RECORD IS STILL UNBUILT, and why it stays `proposed`: the
three-outcome chooser, the confirmation weighting, the undo on a placement
removal, and the deletion of an ITEM at all. There is still no UI in front of
any of it. Counts-first is built for one operation, and that is the half.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-products.md`.
