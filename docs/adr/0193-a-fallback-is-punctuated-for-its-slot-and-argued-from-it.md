---
status: accepted
---

# A fallback is punctuated for its slot, and its docblock argues from that slot rather than from the others

> **ACCEPTED 2026-09-21, whole, for the one docblock it names.** `UNSHOWABLE_BODY`'s docblock in
> `packages/providers/src/client.ts` said "NO FULL STOP, UNLIKE THE OTHER THREE", and that was
> false: `UNSHOWABLE_NAME` in `cmpp.ts` has no stop either. It now states the rule that decides a
> fallback's stop, then gives this one's reason from its own slot. What a page prints as a whole
> sentence takes a stop; a name and a clause do not; this is a clause `failed` finishes. Its "the
> four sentences" is now "the fallbacks built on `unshowable`", by
> [[0188-a-count-nobody-routes-by-is-deleted-rather-than-derived]], and the
> `TODO(CNCORE-315)` is gone. ADR-0188's bullet that held this open is corrected where it stands.
> **No behaviour changes and no test is added.** Every stop the new sentence names was already pinned
> by a test in that fallback's own file. No provider repository is touched, so nothing is owed at a
> second one.

## The claim was false when it was written

It did not drift. `UNSHOWABLE_NAME` arrived without a stop in CNCORE-305 (`a876956`), and the
comparison was written after it, in CNCORE-308 (`521e717`). The sentence described three constants
from what they were for, and nobody read it against them. `cmpp.test.ts` had the truth throughout:
it expects the name fallback to end "cannot be shown", with no stop.

The rule was in the tree too. [[0176-saying-nothing-and-saying-nothing-showable-are-two-sentences]],
under "Both sentences are the caller's, and neither is defaulted", says why `UNNAMED` carries no
stop: "a full stop there would read as part of the name", and
`UNSHOWABLE_NAME` takes its punctuation from `UNNAMED`. The one sentence that compared against it had
not read it.

## A comparison with siblings in other files is ADR-0188's defect in another form

ADR-0188 is about a count of a population the sentence cannot see. "Unlike the other three" is a
claim about the same kind of population: it says how three constants in two other files end, from
a file that shows none of them. Nothing on disk ties the claim to them, so it can be false at
birth, as this one was, and nothing notices.

ADR-0188 settled each count by asking whether an argument rests on it. The same question settles
this. **This site's stop rests on the slot it fills and on nothing its siblings do.** If
`UNSHOWABLE_REASON` lost its stop, `UNSHOWABLE_BODY` would still be a clause that `failed` finishes.
So the docblock argues from that, and names the others only as examples of the rule. ADR-0188 put
it the same way about a list, under "What this does not cover": the number can go and the list can
stay, because the list is evidence rather than the argument.

## Why the examples stay

The ticket asked which fallbacks end in a stop and which do not. The examples also answer a reader
who would otherwise act on the difference. Someone in `client.ts` who sees `reason.ts`'s fallback
end in a stop may take this one's missing stop for an oversight, and add it. The rule with an
example on each side tells them not to. Each example is argued in its own docblock beside the
sentence it pairs with (`SILENT`, `UNNAMED`, `SAID_NOTHING`), and pinned by a test in its own file.

## What this does not cover

- **The examples can go stale.** If one of them moved to another slot, this docblock would name it
  on the wrong side, and no check would notice. That would be a wrong example under a right
  argument, which is the cost of keeping examples at all.
- **`UNSHOWABLE_ENTRY` (`apps/web`) and `UNSHOWABLE_DETAIL` (`@canoncore/tasks`) are left out of
  the docblock, deliberately.** Both are outside this package, and an example list is not a census.
  - Neither constant carries a stop, because each has to equal what `quotedTo` returned.
  - `UNSHOWABLE_ENTRY` is rendered where the entry would be, so it takes none.
  - `@canoncore/tasks`' `bounded` adds the detail's stop AFTER the comparison, because a detail is a
    whole sentence.
  - Both fit the rule. What decides a constant's own stop can differ from what decides the
    printed sentence's, and the rule is about the printed sentence.
- **There was no sweep** for other sentences that compare across files. This one was found by
  CNCORE-311's review, as ADR-0188's counts were.
