---
status: accepted
---

# The reader chooses the order and the kind; the surface keeps the question

A catalogue of 8,052 Items (ADR-0137) had exactly one order and one filtering control in the whole
product. CNCORE-159's own problem statement counts it: "There is no sorting control on any surface
and exactly one filtering control in the whole product." So seven thousand Rows could be approached
from one direction, and the Owner's answer to "where is the thing I am thinking of" was the alphabet
or nothing.

**The Owner now chooses the ORDER a Listing is read in and the KIND it is narrowed to, and both ride
the address.** `?order=added` and `?kind=person`, beside the `?group=` that was already there.

## Which is the decision, because the ticket and ADR-0077 appeared to disagree

CNCORE-175's own description says narrowing by kind "is a surface rather than a flag on the Listing:
ADR-0077 refuses that". A `/verify` pass raised that against CNCORE-188's shared Listing contract as
a genuine conflict, and the dispatcher ruled on 2026-09-19 that the contract had landed and was the
fact to build with.

**THE CONFLICT DISSOLVES RATHER THAN BEING DECIDED, AND THE DISTINCTION IS WORTH WRITING DOWN.**
ADR-0077 refuses a flag standing in for a surface's QUESTION: "naming the question lets a surface
classify itself", and a boolean on `list` "would make every future caller classify itself by
remembering to pass one, and whatever the default was would decide for the ones that forgot". That
is a rule about which kinds a surface's question INCLUDES -- work-browsing excludes the entity kinds,
the Catalogue and Catalogue search exclude none -- and it is **not the reader's to change**.

`?kind=` changes nothing about that. It narrows whichever question was asked, on the axis a Group
already narrows it, and composes with both. A narrowed `/works` is still work-browsing: its
predicate is unchanged and no value of this parameter can add an entity kind to it. A narrowed `/`
shows a subset of what `/` already showed. **No value of this parameter turns one Listing into the
other**, which is the ticket's own fifth criterion, and it holds by construction rather than by
care: `narrowedToTheKind` is `and`ed onto whatever `within` the Listing asked for, exactly as
`withinTheGroup` is, and cannot widen one.

So the ticket's sentence over-extended ADR-0077 rather than reporting it. That record is untouched
by this one and stays `proposed` for the reason it already gives -- search does not group by kind.

## The narrowing is one control on three Listings, for the reason a Group already is

`withinTheGroup` argues that "a Group that meant one thing on the catalogue and another on Catalogue
search would be two scopes wearing one name". The same sentence holds word for word for a kind, so
`?kind=` reaches all three Listings through one predicate and one picker, and the size follows it on
all three because `theSize` reads the same `within` as the Rows do (CNCORE-172).

**THE SEAM TAKES IT ON ALL THREE; THE PICKER IS ON TWO.** ADR-0138 is why the seam earns it: a
parameter no surface sends is a capability with no caller, and the Catalogue and Catalogue search
both send it. ADR-0077 says search "returns all seven kinds", and it still does -- unnarrowed, a
Character's name finds the Character.

**WORK-BROWSING GETS NO PICKER, AND THAT IS A DECISION RATHER THAN AN OMISSION.** Work-browsing IS a
kind: its predicate is `kind = 'work' AND (NOT is_container OR holds_work)`, so every Row it can
reach is a Work -- measured against the live schema under CNCORE-175, **one distinct kind**. A picker
there would offer seven options of which six answer "nothing to watch" and the seventh changes
nothing, which is a control that cannot be used rather than one a reader might not need. The
nearest question a reader of that page might actually have -- stories or the containers holding them
-- is `is_container` (ADR-0004) and not a kind at all, so a kind picker could not answer it either.

The seam still accepts `kind` there, because `listingInput` is shared by all three questions and the
Listing contract asks every one of them the same thing. Narrowing what a surface OFFERS is a
surface's business; narrowing what the seam ACCEPTS per question would make work-browsing the odd
one out at the contract for a reason that lives in a page.

**AND THE PAGE DOES NOT READ `?kind=` EITHER, which is the other half of offering no picker.**
Honouring a hand-typed `/works?kind=person` would narrow the Listing to nothing with no control on
the page saying so and no way to clear it -- a page that is empty for a reason it does not state,
which is the failure the notices below exist to prevent. A parameter a surface does not offer is one
it does not read.

## The order is on the two browsed Listings and NOT on Catalogue search

Catalogue search leads on how close a title is to what the reader typed (ADR-0120). An order chosen
over that discards the ranking that IS the answer, so it is a different surface rather than this
parameter, and `browsedInput` carries `order` where `listingInput` carries `kind`.

**AND A LETTER BELONGS TO THE ORDER THAT FILES ROWS UNDER LETTERS.** A jump is a SEEK on the leading
key (CNCORE-174, ADR-0119) and the recently-added order leads on a timestamp that nothing is filed
under, so the read path declines a letter there and the two pages hide the alphabet rather than
rendering twenty-six controls that do nothing. It is the deviation `JumpToALetter` already records
for Catalogue search, reached for the same reason.

## Two orders, and the dispatcher chose them

By name -- `coalesce(sort_name, title)`, which the catalogue already had -- and **Recently added**,
`created_at` descending. Chosen by the dispatcher on 2026-09-19 over a release-date order, for two
reasons that are properties of the key rather than preferences:

- **`created_at` is on every row**, so the key declares `everyRowHasIt` and the walk needs no keyless
  block. `release_date` is sparse across this corpus and would have needed one.
- **Recently added is the second view Plex and Jellyfin both lead with**, which is the
  study-the-incumbents rule rather than an invention.

The dispatcher has said a third is wiring later. **WHAT A THIRD ACTUALLY COSTS, COUNTED RATHER THAN
ASSERTED** -- an earlier draft of this record said "a value in `order.ts` and a line in
`THE_ORDERS`", and review measured that false. It is SIX places: the order value beside
`RECENTLY_ADDED`, its anchor read, a branch in `readListing`, its words in `THE_ORDERS`, the value
`oneOrder` reads out of the query string in `apps/web/src/components/query-params.ts`, and that
function's own return type, which spells the orders as literals. **THE LAST TWO WERE MISSED WHEN
THIS WAS COUNTED** and are added under CNCORE-252; `oneOrder` answers `"added"` or nothing, so a
third order it does not name is a parameter the page silently drops. Two more that WOULD have
been copies are not:
`CHOSEN_ORDERS` is the read path's own list and the router's `z.enum` reads it, and `Chosen` is
exported so no page retypes it.

**THE BRANCH IN `readListing` IS NOT REDUCIBLE TO A LOOKUP, and that is a decision rather than a
shortfall.** `theCutAt` is typed `ACutIn<O>` against the order in the same call, which is the whole
mechanism `order.ts` exists for -- an anchor read in one order cannot reach a walk in another. A map
from a word to an `{ order, anchorIn }` pair erases that pairing into a union the compiler cannot
discharge, and the cast that would make it compile is exactly the check ADR-0119's four defects were
each missing. A branch per order is what keeps the compiler holding it.

`name` is THE ABSENCE and never a word in the address: the bare address is the Listing in its own
order, so spelling the default would mint a second address for the page `/` already is (ADR-0066).

Migration 21 indexes `(created_at desc, id)` -- both terms in the walk's own directions, because a
keyset walk compares the PAIR and an import writes thousands of Items sharing a `created_at`.

## A key whose column is finer than its JavaScript type hands over an EXPRESSION, not a value

**This is the finding this ticket owes the next order, and it was found by a test rather than by
reading.** ADR-0119 carries defects that came of the sort and the cursor comparison naming different
TERMS. This is the same failure -- Rows silently stepped over -- arriving through the **VALUE**.

PostgreSQL's `timestamptz` keeps MICROSECONDS; a JavaScript `Date` keeps MILLISECONDS. An anchor read
into a `Date` and bound back into the comparison therefore loses its last three digits. Measured on
this repository's own rows 2026-09-19: an anchor at `2026-09-19 22:06:29.990727+00` binds back as
`...990`, so `eq(key, value)` matches NOTHING and `lt(key, value)` excludes the anchor's own tie
group. **The contract test walked 6 Rows of a Listing holding 10, and 24 of 30.**

An import is where it bites rather than a corner case: one statement writes thousands of Items inside
one transaction and `now()` is the transaction's, so they share a `created_at` to the microsecond and
**the tie is the normal case in this order**.

So the anchor is read as TEXT at the column's own precision and cast back, and `AValueFor` in
`order.ts` **refuses `Date` outright** -- which makes the lossy version a type error at the read
rather than rows missing from a page nobody counted. A key computed by the walk already handed over
an expression (Catalogue search's closeness, ADR-0120); this is the second reason to.

## An empty page must say WHICH emptiness it is, and a narrowing adds a reason

`/` already told three of them apart: an empty catalogue, an empty Group, and a Group that is not
there. A kind is a fourth, and review found the Catalogue telling a reader the wrong one --
`/?kind=person` on an install holding 8,052 Items (ADR-0137) rendered `WhatToDoNext`, which says
CanonCore ships no catalogue and offers the routes that fill one.

**THAT NOTICE IS A CLAIM ABOUT THE INSTALL, SO IT IS GATED ON THE PAGE BEING NARROWED BY NEITHER
AXIS.** The rule was already written for a Group -- "an empty GROUP must not [offer those routes],
because the catalogue it was narrowed out of may hold thousands of Items" -- and a kind is the same
fact on the other axis. `NoItemsOfThatKind` says which emptiness it is and carries the way out,
through the same `withEveryKind` the picker's own `Every kind` link is built from, so the escape and
the control cannot become two spellings of one address (ADR-0066).

## As built, under CNCORE-175

**ACCEPTED, AND WHAT THAT COVERS.** Both halves are whole at all three seams: the read path
(`RECENTLY_ADDED`, `narrowedToTheKind`, migration 21), every Listing procedure (`browsedInput`,
`listingInput`), and the surfaces: an order picker on the two browsed Listings, and a kind picker on
the Catalogue and on Catalogue search. The Listing contract test asks `kind` of EVERY Listing, and
the order walk and the letter jump of the ones filed by name -- both are `it.runIf(filedByName)`.
Catalogue search carries `filedByName: false`, which `eachAlsoNarrowed` propagates to its narrowed
twin, so 2 of the 6 skip those two cases today. **A FOURTH LISTING INHERITS WHAT ITS OWN
`filedByName` EARNS**: the `kind` case unconditionally, and the other two only if it is filed by
name. That is this record's own later section stated at the seam rather than only in prose: "the
order is on the two browsed Listings and NOT on Catalogue search".

**WHAT IS DELIBERATELY NOT IN IT**, named so nothing reads as a missing half: Catalogue search takes
no order and work-browsing offers no kind picker (both above), and the two Listings on the Item page
take neither -- a Container's Members are in
its own order (ADR-0018) and "Also appears in" never runs past one page (ADR-0143), and neither is a
question a reader was offered here.

**THE SEAMS WERE THE DISPATCHER'S CALL (2026-09-19)**, including the e2e: the criterion is that both
"travel in a shared link and survive a reload", and only a page served over HTTP to a second reader
with no session can be asked that. A test of `queryFor` asserts the link this app writes and cannot
assert what a reader who follows it is served.
