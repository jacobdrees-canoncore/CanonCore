---
status: accepted
---

# An untitled Item is one the Owner titles first, and the placement picker is given no second way to it

> **ACCEPTED 2026-09-21, whole, in one repository.** CNCORE-292 asked whether the placement picker
> owes a way to an Item with no title. It does not. The Owner gets to such an Item through a Listing
> they already have, TITLES it there, and the search
> [[0165-a-picker-reaches-past-its-cap-through-the-listings-own-search]] gave the picker then finds
> it. **NO MECHANISM IS ADDED.** Two assertions make this a decision rather than a hope, at
> ADR-0103's first two seams: `catalogue.test.ts` in `packages/db` holds that the keyless block is in
> the answer to every letter jump, sorted last; and `item.test.ts` in `packages/api` holds that
> `item.retitle` makes an Item with no title findable by `catalogue.search`, asked exactly as the
> picker asks it.

ADR-0165 left this half unbuilt and said so, which is why there was a ticket to answer. The answer
is a decision, and a decision recorded is the thing that was missing rather than a control.

## The premise the ticket and ADR-0165 both carried was wrong, and it is the reason to write this down

Both records say the untitled state is CONSTRUCTIBLE, and both reach for `aCatalogueLargerThanOnePage`,
which "seeds two untitled Items deliberately". That names a FIXTURE as the way such an Item comes to
exist, and it reads as though nothing but a test writes one.

**A PURGE WRITES THEM, AND IT IS A PRODUCT PATH THE OWNER DRIVES FROM `/import`.** When a Provider's
licence ends, `purgeProvider` takes every statement that Provider made. An Item the Owner still
PLACES somewhere, or still holds in a LIVE GROUP, is kept, because either is the Owner's own claim and
a Provider's licence ending has no bearing on it. **It is kept UNTITLED WHEREVER EVERY TITLE IT HAD
WAS THAT PROVIDER'S.** A title the Owner gave it, or another Provider did, survives the purge, so the
Item keeps a name. `purge.ts` says so in its own docblock, and two tests in `import.test.ts` hold the
untitled case: "leaves what another source said, and the item it said it about"
(`expect(survivor?.title).toBeNull()`), and "keeps an item the owner put in a group, and leaves it in
the group" (the same, with `keptItems: 1`).

So this is not a shape only a fixture can draw. **It is a shape a catalogue can wear the day a
licence ends**, and the Owner meets it holding Items they chose to keep. The old sentence licensed
the conclusion "nobody will ever have one". The right conclusion is reached another way, below.

**MEASURED RATHER THAN ASSUMED, and the zero is the figure that carries weight.** Counted against the
live install on 2026-09-21 with the catalogue's own predicate (`IN_THE_CATALOGUE`, which is
`deleted_at is null`): **ZERO untitled**, of the 8,052 Items in the catalogue at that moment. **THE
PREDICATE IS THE POINT.** The table holds 8,053 rows, and the one untitled row among them is a
DELETED Item, since a delete tombstones every statement and the projection over none is NULL. A count
that skipped `deleted_at` would report one untitled Item the Owner cannot see. The zero says only
that no Item in the catalogue is untitled today. It does not say how the catalogue got that way.

## The picker cannot NAME an untitled Item, so getting to it is not what was missing

This is the whole of the decision, and it is not an argument from scarcity.

The picker is a `<select>`, and each option is `row.title ?? "Untitled item"`. **So a narrowing that
delivered untitled Items to it would offer the Owner a run of options that all read "Untitled
item".** Two survivors of one purge are two identical rows; forty are forty. The Owner cannot choose
the one they mean, because nothing on the control tells them apart. They would be picking by position
in a list whose order they did not set.

**THAT IS ADR-0165'S OWN LESSON ARRIVING ONE SURFACE ALONG.** That record exists because "a cap that
is named and a remedy that exists are two claims, and a notice satisfying the first tells a reader
nothing about the second". Here: **an option that is OFFERED and an option that can be CHOSEN are two
claims.** A narrowing that put untitled Items on the picker would satisfy the first and leave the
Owner exactly as stuck, while the board recorded the half as built. That false signal costs more than
most, because it looks like a feature.

What the Owner lacks when they meet one of these Items is a NAME, not a way to it. The place a name
is given is the Item's own page.

## The remedy exists, and at the catalogue's real size, which is what this record had to check

ADR-0165 was filed because a notice named a remedy that had never existed. A record answering "the
Owner titles it first" owes the same check, or it repeats the defect it descends from. **And the
check has to be made at the size of the catalogue that exists**, because a way to an Item that works
in a two-row fixture and fails at 8,052 is that same defect in a smaller test.

**THE CLAIM THAT KEPT A SURVIVOR IS USUALLY ITS ROAD BACK.** The two claims `purge.ts` names for an
Item the Owner chose to keep are each already a Listing that leads to it:

- **KEPT BY A PLACEMENT, IT IS A MEMBER OF THAT CONTAINER.** The Container's Members list renders it
  "Untitled item" as a link to its own page (`placement.title ?? "Untitled item"` in
  `items/[id]/page.tsx`). The Owner is one click from the page where it is titled.
- **KEPT BY A GROUP, THE CATALOGUE NARROWED TO THAT GROUP LISTS IT.** The narrowing is a membership
  predicate (`withinTheGroup`) with no condition on the title, and a Group is small. This is the one
  case where the Item is untitled AND in no ordering.

**A JUMP TO Z REACHES ANY OF THEM, AND A JUMP TO A DOES NOT.** A letter is a SEEK, and
`atOrPastTheValueIn` renders it `or(isNull(key), atOrPast)` on a key with a keyless block
(`order.ts`), so the untitled tail is in the answer to every jump, sorted last (`nulls last`). **In
the answer is not on the page.** The tail lands on a jump's first page only where fewer titled Rows
than one page (100) sort at or past the letter. Measured on the live install on 2026-09-21 with the
catalogue's sort key: **23** titled Items sort at or past Z, so a jump to Z puts the untitled tail on
its first page; **8,015** sort at or past A, so after a jump to A the tail is about eighty pages
away. Both figures move with the catalogue. The Z one is what this record rests on, and it holds as
long as fewer than a page of titles file past Z.

**AND THE JUMP IS WHAT COVERS EVERYTHING ELSE A PURGE CAN KEEP.** The orphan predicate in `purge.ts`
keeps an Item for more than those two reasons: some other source still says something about it (the
Owner's own note, say) while nothing titled it; it is a Container that still holds members; another
Item's claim names it. None of those is guaranteed a Listing of its own. The keyless tail holds every
untitled Item in the catalogue whatever kept it, so the jump to Z reaches all of them. That is the
general way to an untitled Item, and the two above are the short cuts for the common cases.

**THEN `item.retitle` GIVES IT A NAME, AND `catalogue.search` FINDS IT**, asked as the picker asks
it: `{ query }` and nothing else, no Group. The test asks one query before and after. Before the
retitle the Item is absent, and after it the Item is present. Each half is load-bearing, measured
both ways: an Item titled from the start fails the "before", and a skipped retitle fails the "after".

So "title it first" names a control that exists, on a page the Owner can get to at the size of their
catalogue, and it ends at the picker they started from.

## What is NOT built, and why each is refused rather than deferred

- **NO NARROWING TO THE UNTITLED ON THE PICKER**, and no second search. It would be a second answer
  to "what is in this catalogue", which ADR-0165 and CNCORE-256's fourth criterion both refuse. It
  would also deliver a list nobody can choose from, per the section above.
- **NO `kind` NARROWING ON THE PICKER.** CNCORE-292 offered it as the cheap half, since
  `catalogue.list` already takes one. It is refused for a reason of its own: **narrowing to a kind
  does not make an untitled Item identifiable. It only makes the pile of identical options
  smaller.** Nine "Untitled item" rows narrowed to four are still four rows the Owner cannot tell
  apart.
- **THE PICKER IS NOT STOPPED FROM OFFERING UNTITLED ROWS EITHER.** On a catalogue under one page
  they are already on it, indistinguishable from each other, and that is the one edge this decision
  leaves standing. Removing them would be a mechanism too. It would take away a capability on the
  install where the ambiguity is smallest, and the remedy there is the same: title it. It is named
  here so the next reader can tell it was reasoned rather than missed.

## What would reopen this

A decision resting on a zero owes the condition that overturns it, or the zero silently becomes a
policy. Two things reopen it:

- **AN INSTALL HOLDING UNTITLED ITEMS IN NUMBER**, which is the state after a purge of a Provider the
  Owner kept Items from. Even then, the thing to build is not a second way to the Item. It is
  whatever lets the Owner tell one nameless Item from another: its kind, the Container it already
  sits in, when it arrived. That is a question about what a Row SAYS, which is project 5's ground
  ("The data"), and a control on this picker does not answer it.
- **A PAGE OR MORE OF TITLES FILING PAST Z.** That moves the untitled tail off the first page of a
  jump to Z. The reaches by Container and by Group are untouched by it, and the walk still arrives,
  but the general reach would then take paging to get there. The figure is 23 today.

Until then, an Item with no title is one the Owner titles, and the catalogue holds none today.
