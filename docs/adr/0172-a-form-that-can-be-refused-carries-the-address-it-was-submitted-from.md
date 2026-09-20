---
status: accepted
---

# A form that redirects carries back the whole address it was submitted from

> **ACCEPTED 2026-09-20, whole, in one repository.** All three forms on `/items/<id>` that REDIRECT
> -- the place form, the Remove on each Member row, and the Undo -- carry **every parameter of
> `TheRoute`**, which is what the reader's position on this page is made of, as hidden fields
> written through `inTheFixedOrder` by one component; and all three actions rebuild that address
> through one function. The place form carries the standing `undo` offer as well, for the reason
> below. So a refused placement, a removal and an undo each leave the Owner exactly where they found
> them. Five assertions at [[0103-tests-bite-at-package-exports-and-the-router]]'s fourth seam
> (`apps/web/e2e/placement-write.test.ts`) hold it: a refusal from the forward cursors, a refusal
> from the step back, a removal, the undo, and a refusal met with an offer already standing. `undo`
> joins `IN_THE_FIXED_ORDER`, which is what it owes the moment it stops being alone on an address.
> **No procedure changed** -- `placement.place`, `placement.remove` and `placement.restore` are
> asked as they stand -- so nothing is owed at the second seam, and no provider repository is
> touched. **CNCORE-290 and CNCORE-293 in one pass**, folded by the dispatcher on 2026-09-20 because
> they are one reason to change. **Drafted as 0166, then 0168, then 0170, and landed as
> 0172.** The same free number was handed to more than one branch three times on 2026-09-20:
> CNCORE-259 took 0166 and 0167, CNCORE-257 took 0168, and CNCORE-291 took 0170 in an open PR.
> Disclosed rather than quietly renamed, which is
> [[0167-a-citation-to-a-record-that-never-landed-is-disclosed-not-rewritten]]'s posture applied to
> a number that moved rather than one that never landed.
>
> **AND THE NUMBER WAS CHECKED AGAINST `main` ALONE, WHICH IS WHY IT MOVED THREE TIMES.** A record
> is written on a branch and cited there long before it merges, so the numbers in flight are held by
> OPEN PULL REQUESTS rather than by this tree -- and two of the three clashes were with branches
> that had not landed. `adr-numbering.test.ts` caught the second in CI, which is what that guard is
> for; it cannot catch the third, because a number taken on another open branch is not in this tree
> to be counted. **The cheap check is `git ls-tree` over every remote branch**, which answers in one
> command what `ls docs/adr/` cannot.

`/items/<id>` is one address with **three independent positions on it**: where the Members list
stands, where "Also appears in" stands, and what the placement picker is narrowed to. A Container
IS an Item ([[0004-containers-are-items]]), so [[0066-path-is-identity-query-is-the-route]] keeps
all of it on one address rather than giving the second listing a page of its own.

The rule that follows is stated in five places already, and `TheRoute` in
`apps/web/src/components/listing.tsx` puts it best about the two cursors: **a gesture aimed at one
of them may not move another.**

## A redirect rebuilds the address from what the form carried, so the form decides

Every OTHER control on this page is a link, and a link carries the address because `theRoute` hands
it the whole of one. **A form is the one control that cannot**, because what comes back is built
from `FormData` and nothing else -- so a parameter that is not a field is a parameter the redirect
cannot write, whatever the code building it intends.

That is why this is a record rather than a line in a docstring. The rule is about the page, and the
mechanism that keeps it is in three files at once: the fields the form renders, the schema that
reads them, and the one function that orders them.

## Five gestures, three of which redirect

This page renders **nine** mutating forms. Six of them -- `retitleItem`, `sortItemAs`,
`annotateItem`, `putItemInGroup`, `takeItemOutOfGroup` and `movePlacement` -- call `refresh()`
rather than redirecting, so the browser never leaves and the address is kept by doing nothing at
all. **Three redirect, and each one had to be told where to go back to.**

That split is the whole of why this record is about FORMS rather than about actions: a Server Action
gets no request URL, so a redirect can only rebuild what its form was given. The six that refresh
never had the problem and never will. `placeItemInContainer` is the only one of the three that can
also be REFUSED, which is what made it the first place the gap showed:

- **Before CNCORE-256** a refusal dropped all three positions.
- **CNCORE-256** gave the picker a search and made the refusal keep it, and
  [[0165-a-picker-reaches-past-its-cap-through-the-listings-own-search]] wrote down that it kept
  only that one -- "this record's rule applied to one position of three", with a TODO at the form.
- **CNCORE-290**, this record, carries all three.

**Saying which half was kept is what made the third step cheap.** That TODO is the reason this was a
ticket with a measurement in it rather than a defect somebody rediscovered from a reader's
complaint. A rule kept selectively WITHOUT saying so is the thing to refuse: the next reader cannot
tell whether the omission was reasoned, and the sentence arguing the rule five times over is then
evidence that it was not.

## What the form carries is `TheRoute`'s keys, read as fields

`theAddressItCameFrom` in `apps/web/src/app/items/actions.ts` declares seven: `via`, `placed`,
`after`, `placedAfter`, `before`, `placedBefore`, `placing`. That is exactly `TheRoute`, which is
what every LINK on this page carries -- one set, reached two ways, because a refusal is this page's
third way of arriving at itself beside a walk and a chip.

**BOTH CURSORS OF BOTH LISTINGS, THOUGH NO ADDRESS CARRIES ALL FOUR.** `after` and `before` never
share a link, since each names where ONE page starts. But which of the pair the Owner is holding is
theirs rather than the action's, and a form carrying only the forward one would send a reader who
stepped BACK to the start. `inTheFixedOrder` writes the parameters that have values and drops the
rest, so the address that comes back carries what the address that went in carried and nothing
else. **That is also why the second assertion exists**: the forward pair proves nothing about the
backward one, and it was checked by removing the two fields and watching only that test go red.

## Through `inTheFixedOrder` on BOTH ends, which is the whole of "one spelling"

A browser submits a form's fields in the order they stand in the document, which
`query-params.ts` already names as "the one spelling this list cannot write". So **all four forms on
this page that carry an address now render those fields through ONE component**, `TheAddressBack`,
over `inTheFixedOrder`'s own object: the picker's search, the place form, the Remove on each Member
row, and the Undo.

**The search is a GET and the other three POST, and that difference does not reach this.** A
navigating form's fields simply ARE the address it asks for; a posting form's are the only thing its
redirect can rebuild one from. Both come down to the same mechanism, so a second copy of the map was
a second place for the order to drift -- and the order IS the rule (ADR-0066): one view of this
page, one address. **This was two copies when the record was first written**, with the search
keeping a hand-written map; review caught it against this paragraph's own claim.

**The place form carries `placing` and the search form does not**, and that asymmetry is load-
bearing rather than untidy. The search has a TEXT INPUT under that name; a hidden field beside it
would submit `placing` twice, which `oneValue` reads as no narrowing at all -- emptying the box the
Owner just typed into. The place form has no such input, so the narrowing rides as a field like the
rest.

## The write's fields are named and the remainder is the address

`placeItemInContainer` lifts `containerId`, `itemId` and `position` off the parsed input and treats
**everything else** as where the Owner was standing. Written the other way round -- a `placing`
lifted off and the remainder handed to the procedure -- it held while the surface carried ONE field
of its own, and the seventh would have been the one somebody forgot to lift.

What `placement.place` takes is the CLOSED set here and what the surface carries is the open one,
so the destructure names the closed set. A procedure handed a field it never declared would be this
action deciding what that procedure takes.

## The removal and the undo, and why `undo` joined the list

`removePlacement` redirected to `/items/<containerId>?undo=<id>` and `restorePlacement` to
`/items/<containerId>`, and **neither carried any of the seven**. So the defect CNCORE-290 closed
for a refused placement stood on the two controls beside it -- on the gesture
[[0046-delete-previews-its-consequences]] calls "the most frequent editing act in a product built
on multi-placement". **The commonest gesture on this page was the one that moved the reader
furthest**, and the undo offered as a remedy moved them a second time for accepting it.

**`undo` IS NOW ON `IN_THE_FIXED_ORDER`, APPENDED.** `query-params.ts` had carried the exemption in
its own words -- "an address carrying one parameter has no order to keep" -- with the standing
instruction that "a second parameter on any of them belongs on this list first". A removal that
carries where the reader was standing is exactly that second parameter, so the exemption expired
rather than being overruled.

It sits LAST, behind `placing`, and the merits agree with ADR-0066's appending default. It is the
only parameter on the list that no reader and no link ever asks for: a removal MINTS it,
`restorePlacement` spends it, and no control carries it forward. It is neither what the page was
asked nor where in it the reader stands, which is what the rest of the list is made of.

**THIS WAS FILED AS A SEPARATE TICKET AND FOLDED BACK IN.** CNCORE-293 was raised from the TODOs
this work left at both actions, and the dispatcher folded it into the same pass on 2026-09-20:
`CLAUDE.md`'s rule is that tickets sharing ONE REASON TO CHANGE go in one pass, and two agents on
one redirect path is the collision that rule exists to stop. Recorded because the ticket trail says
"filed, then closed by the diff that filed it", and a reader finding that wants the reason.

## `refused` and `because` are NOT carried, and that is the same rule

Three parameters of `IN_THE_FIXED_ORDER` reach this address and are deliberately absent from every
form: `refused`, `because` and -- on two of the three forms -- `undo`.

**They are MINTED BY A GESTURE rather than describing where the reader stands.** A refusal writes
its own `refused` and `because` over whatever stood there, a removal writes its own `undo`, and the
undo spends one. Carrying an old value forward would re-assert an outcome that has been superseded:
a page saying "Nothing was placed" about a placement two gestures ago.

**The place form is the exception, and the exception proves the rule.** It is the only form that can
meet an offer it has nothing to do with: a removal leaves the Owner on `?undo=<id>` with both
controls rendered, so a refusal from that page must leave the offer standing. There the offer IS
part of where the reader is, because nothing this form does bears on it. Found by review of the
first half against the second.

## What a query with nothing in it writes

`restorePlacement` spends the only parameter its address is guaranteed to carry, so it is the one of
the three redirects that can end with an EMPTY query -- and `/items/<id>?` is a second spelling of
the bare address, which is what ADR-0066 exists to refuse. `theContainerAt` writes no `?` for a
query with nothing in it. The other two always carry something and would never have found this.
