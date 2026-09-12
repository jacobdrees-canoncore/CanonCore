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

COUNTS SHOWN FIRST IS BUILT, as `provider.previewPurge`. It answers FOUR -- three
under CNCORE-34 and a fourth under CNCORE-69, described in its own section below:
the provider's statements, the placements this provider was the LAST claimant of
(ADR-0017), the items left with nothing asserting anything about them and nowhere
they sit -- which is not every item the provider ever wrote -- and how many of the
items it touched STAY for that reason.

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
three-outcome chooser and the deletion of an ITEM at all. THE UNDO ON A
PLACEMENT REMOVAL IS BUILT, under CNCORE-72, and it is built the way this record
asks for: removing a member from a container gets no dialog at all, and what it
gets instead is an offer back. With no script that offer has to travel in the
URL -- a Server Action's return value reaches a page only through a client hook
-- so the removal redirects to the container with `?undo=` naming the placement,
and the page renders the offer. The placement returns with its position AND its
origin, because the removal tombstones only the placement and leaves every
source that stood behind it standing (ADR-0017, ADR-0061).

Counts-first is built for one operation, and CNCORE-69 put a UI in
front of THAT one -- so "there is still no UI in front of any of it", true when
this section was written, is now true only of the item half. The purge's own
confirmation and its weighting are built; the section below records what
building them settled.

## WHAT THE PURGE'S CONFIRMATION SETTLED, decided under CNCORE-69

The counts now sit in front of an owner rather than in front of a caller. The
surface is `/import`, because that is where an import comes from and an import
with no un-import leaves a mistaken import unrecoverable through the product.

A FOURTH COUNT, BECAUSE THREE DESCRIBE HALF OF WHAT A PURGE DOES. The three above
are removals. This record already says the delete leaves standing anything
somebody else still claims -- and that outcome had no number, so a preview
answered "1 item" about a provider that touched five and read as the whole
answer. The four survivors then turn up UNTITLED, on a page the owner did not
expect to change, because the words that titled them were the purged provider's.
`keptItems` is that number.

IT IS READ OFF THE DELETE RATHER THAN PREDICTED BESIDE IT, which is this record's
existing guarantee applied to the new number rather than an exception to it: the
survivors are the items the traversal DECLINED to take, so the count is
`touched - items` and there is no second predicate to drift. A "which items would
survive" query would have been the seven rules restated, which is the thing
`previewProviderPurge` exists to avoid.

ONE PROVIDER IS PREVIEWED PER RENDER, NEVER THE WHOLE LIST. A preview costs the
work and the write locks of a real purge, held for the length of the traversal --
this record says so above and it is what decides the shape of the page. A surface
that priced every provider it offered a button for would lock the catalogue
against itself on every render, for numbers nobody had asked to see. So the page
lists providers and previews only the one named in its own address.

WHICH IS ALSO WHY THE CONTROL IS A FORM AND NOT A LINK, and this one is a trap
rather than a preference. Next PREFETCHES a `<Link>`'s own address when it enters
the viewport, and the address of a preview RUNS THE TRAVERSAL -- so a list of
links would spend a purge's locks per provider because a reader scrolled past. A
string-action `<Form>` prefetches its ACTION PATH instead -- the fields are not
known until submission -- which here is `/import` naming no provider and
previewing nothing. Next's `<Form>` reference, read 2026-09-12: `prefetch`
defaults to true and what it fetches is "the destination path", with "shared UI
such as layout and loading files for the target route".

A PURGE WITH NOTHING TO TAKE GETS NO CONFIRMATION AT ALL. Offering to permanently
delete "0 statements, 0 placements, 0 items" teaches an owner that this button is
harmless, and the next one they meet is the one that is not -- which is the habit
this record cites NN/g to avoid building, met from the other direction. It says
nothing came from that provider instead, which is also the honest answer to a
reasonable question: an owner may not know whether they ever imported from one.

THE WEIGHTING, READ AS THIS SURFACE CAN READ IT. The record refuses a confirmation
"dismissible by accident" -- never a drawer, never a swipe-away sheet -- and a page
at its own address is the opposite of one: nothing dismisses it, and leaving is a
choice rather than a gesture. Cancel is a plain link and costs nothing, which is
the same rule from the other side: if the way out were expensive, the only safe
move on a page opened by mistake would be closing the tab.

AND THE BOUND THAT CAME WITH IT, stated as a bound on the PAGE rather than on the
operation, because the difference is the whole of it: the page can only OFFER to
purge a provider named in `PROVIDER_URLS`, since that list is the only one it has
and a target outside it has no row to sit in. A provider removed from the setting
is therefore not offered until it is named again, and naming it again is the
remedy. THE PROCEDURE ITSELF IS DELIBERATELY NOT BOUNDED THAT WAY, and the action
behind the button does not narrow either -- because the case this record is
written for is an owner purging a provider whose licence has ended, which is
exactly the provider they are likeliest to have already taken out of their
configuration. The narrowing is a fact about what can be rendered, and making it
a rule would refuse the motivating case.

AND WHY THIS SURFACE OFFERS A BUTTON WHERE THE BROWSE BESIDE IT WOULD NOT, which
needs saying because the two now sit on one page and the comparison is the
obvious one to draw. CNCORE-92's rule for `browse` is that the button appears
only where a browse would actually work -- "nothing to press is the difference
between a refusal reported and a refusal reworded" -- so an unreachable provider
gets a sentence rather than a control. THIS SURFACE OFFERS ONE FOR AN UNREACHABLE
PROVIDER ANYWAY, and that is the same rule rather than an exception to it: a
purge makes NO REQUEST. It is rows in this catalogue, found by the identity the
source row carries, so none of the three refusals `browse` can meet exists here
and the operation works perfectly against a provider that has not answered in
months. That is ADR-0036's case exactly. A later reader applying CNCORE-92's rule
mechanically here would remove a button that works, on a surface whose whole
motive is the provider nobody can reach.

WHICH ALSO SETS WHERE COUNTS-FIRST ACTUALLY HOLDS. It holds through the product:
the page renders no button until `previewPurge` has answered, so an owner moving
through the surface cannot meet the delete before its consequences. It is not
ENFORCED, and a check on the form could not enforce it: it would bound the form
and not the operation, since `/api/rpc` carries the same procedure. So an owner
who calls `provider.purge` directly meets no preview, and that is unchanged.

WHAT DID CHANGE IS WHO CAN, and this paragraph said otherwise until CNCORE-109.
It read "nothing in this version can enforce it -- ADR-0107 ships a single owner
and no login, so `provider.purge` is a public procedure anything reaching the
instance can call directly", and that was true when it was written and is not
now: `purge` is an `ownerProcedure`, so the caller is the owner or the call is
refused (ADR-0043, ADR-0044). The preview is still the OWNER'S discipline rather
than the product's guarantee -- which is the honest version of counts-first, and
is why it is stated here rather than claimed as a boundary.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-products.md`.

The CNCORE-69 section's claim about `<Form>` prefetching was read from Next's own
`<Form>` API reference on 2026-09-12. That reference is the CURRENT one rather
than a copy pinned to 16.3.4, which is what this repo builds with -- so what is
established is the documented behaviour of the component, and the version it was
checked against is not. The decision does not turn on the difference: a form
whose fields are unknown until submission cannot prefetch an address carrying
them, whichever version prefetches.
