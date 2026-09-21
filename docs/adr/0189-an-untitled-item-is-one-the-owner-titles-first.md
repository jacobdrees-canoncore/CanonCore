---
status: accepted
---

# An untitled Item is one the Owner titles first, and the placement picker owes no second reach

> **ACCEPTED 2026-09-21, whole, in one repository.** CNCORE-292 asked whether the placement picker
> owes a reach to an Item with no title. It does not. The Owner reaches such an Item through the
> Listing they already have, TITLES it there, and the reach [[0165-a-picker-reaches-past-its-cap-through-the-listings-own-search]]
> built then finds it. **NO MECHANISM IS ADDED**, and the two assertions that make this a decision
> rather than a hope are at ADR-0103's first two seams: `catalogue.test.ts` holds that the keyless
> block rides every letter jump, and `catalogue.test.ts` in `packages/api` holds the whole path --
> searched and not found, jumped to and reached, titled, then found.

ADR-0165 left this half unbuilt and said so, which is why there was a ticket to answer. The answer
is a decision, and a decision recorded is the thing that was missing rather than a control.

## The premise the ticket and ADR-0165 both carried was wrong, and it is the reason to write this down

Both records say the untitled state is CONSTRUCTIBLE -- ADR-0165 reaches for
`aCatalogueLargerThanOnePage`, which "seeds two untitled Items deliberately", and CNCORE-292 repeats
it. That sentence names a FIXTURE as the way such an Item comes to exist, and it reads as though
nothing but a test writes one.

**A PURGE WRITES THEM, AND IT IS A PRODUCT PATH THE OWNER DRIVES FROM `/import`.** When a Provider's
licence ends, `purgeProvider` takes every statement that Provider made. An Item the Owner still
PLACES somewhere, or still holds in a LIVE GROUP, is kept -- because either is the Owner's own claim
and a Provider's licence ending has no bearing on it -- and it is kept **with no title at all**,
because every word it had was the Provider's. `purge.ts` says so in its own docblock and two tests
in `import.test.ts` hold it: "leaves what another source said, and the item it said it about"
(`expect(survivor?.title).toBeNull()`) and "keeps an item the owner put in a group, and leaves it in
the group" (the same, with `keptItems: 1`).

So this is not a shape only a fixture can draw. **It is the shape a catalogue wears the day a
licence ends**, and the Owner meets it holding Items they chose to keep. Correcting it matters
because the old sentence licensed the conclusion "nobody will ever have one", and the right
conclusion is reached a different way -- below.

**MEASURED RATHER THAN ASSUMED, and the zero is the figure that carries weight.** Counted against
the live install on 2026-09-21 with the catalogue's own predicate (`IN_THE_CATALOGUE`, which is
`deleted_at is null`): **ZERO untitled**, of the 8,052 Items it held at that moment. The total is
written with its date because it moves; the zero is what this record rests on, and it says the Owner
has never purged a Provider they were keeping Items from.

## The picker cannot NAME an untitled Item, so reaching it is not the thing that was missing

This is the whole of the decision, and it is not an argument from scarcity.

The picker is a `<select>`, and each option is `row.title ?? "Untitled item"`. **So a reach that
delivered untitled Items to it would offer the Owner a run of options that all read "Untitled
item".** Two survivors of one purge are two identical rows; forty are forty. The Owner cannot choose
the one they mean, because nothing on the control distinguishes them -- they would be picking by
position in a list whose order they did not set.

**THAT IS ADR-0165'S OWN LESSON ARRIVING ONE SURFACE ALONG.** That record exists because "a cap that
is named and a remedy that exists are two claims, and a notice satisfying the first tells a reader
nothing about the second". Here: **an option that is OFFERED and an option that can be CHOSEN are
two claims.** A narrowing that put untitled Items on the picker would satisfy the first and leave
the Owner exactly as stuck, while the board recorded the half as built. It would be reach without
identification, which is the more expensive kind of false signal because it looks like a feature.

What is actually missing when an Owner meets one of these Items is not a way to REACH it. It is a
NAME. And the place a name is given is the Item's own page.

## The remedy exists, which is the claim this record had to assert rather than state

ADR-0165 was filed because a notice named a remedy that had never existed. A record answering
"the Owner titles it first" owes the same check, or it repeats the defect it descends from.

**THE ITEM IS REACHED BY THE LISTING THE OWNER ALREADY HAS**, three ways, none of them new:

- **EVERY LETTER JUMP CARRIES THE KEYLESS BLOCK.** A letter is a SEEK, and `atOrPastTheValueIn`
  renders it `or(isNull(key), atOrPast)` on a key with a keyless block (`order.ts`). So the untitled
  tail rides on whichever letter the reader pressed, and sorts last within it (`nulls last`). A jump
  to A reaches it and so does a jump to Z: asserted on both, because a seek that FILTERED would
  answer neither and one that OR'd the block in at a hardcoded Z would answer only the second.
- **THE GROUP NARROWING REACHES A GROUP-KEPT SURVIVOR DIRECTLY**, which is the shape a purge leaves
  when the Owner's claim was a membership rather than a Placement -- the one case where the Item is
  untitled AND unplaced.
- **AND THE WALK REACHES IT**, as `catalogue.test.ts` already held before this ticket: "walks on
  into the items with no sort key at all, and through them".

**THEN `item.retitle` GIVES IT A NAME, AND `catalogue.search` FINDS IT** -- the procedure the picker
itself asks. The router test walks that whole path in one test, and each step is load-bearing:
removing the retitle call leaves the final search answering `[]`, measured.

So the sentence "title it first" names a control that exists, on a page the Owner can get to, and
ends at the picker they started from.

## What is NOT built, and why each is refused rather than deferred

- **NO `?untitled=` NARROWING ON THE PICKER**, and no second search. It would be a second answer to
  "what is in this catalogue", which is the thing ADR-0165 and CNCORE-256's fourth criterion both
  refuse -- and it would deliver a list nobody can choose from, per the section above.
- **NO `kind` NARROWING ON THE PICKER.** CNCORE-292 offered it as the cheap half, since
  `catalogue.list` already takes one. It is refused for a reason of its own: **narrowing to a kind
  does not make an untitled Item identifiable, it only makes the pile of identical options
  smaller.** Nine "Untitled item" rows narrowed to four is not a reach.
- **THE PICKER IS NOT STOPPED FROM OFFERING UNTITLED ROWS EITHER.** On a catalogue under one page
  they are already on it, indistinguishable from each other, and that is the one edge this decision
  leaves standing. Removing them would be a mechanism too, it would take away a capability on the
  install where the ambiguity is smallest, and the remedy is the same one: title it. Named here so
  the next reader can tell it was reasoned rather than missed.

## What would reopen this

A decision resting on a zero owes the condition that overturns it, or the zero silently becomes a
policy. **This is reopened by an install holding untitled Items in NUMBER** -- the state after a
purge of a Provider the Owner kept Items from -- **and the thing to build then is still not a
second reach.** It is whatever lets the Owner tell one nameless Item from another: the kind, the
Container it already sits in, when it arrived. That is a question about what a Row SAYS, which is
project 5's ground ("The data"), and it is not answered by a control on this picker.

Until then, an Item with no title is one the Owner titles, and the catalogue has never held one.
