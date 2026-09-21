---
status: accepted
---

# A docblock sits on the declaration it describes, and one stacked on another is refused

> **ACCEPTED 2026-09-21, whole, for CanonCore.** `packages/config/src/stacked-docblocks.test.ts`
> refuses a `/**` standing directly on another `/**` in any tracked `.ts` or `.tsx` under
> `packages/` or `apps/`, except a file's own header. It found 27 at `9e20133`. Every one is now
> moved, merged or deleted, and the check is green. **The provider repositories hold no check.**
> Their instances were fixed by hand under CNCORE-258, and CNCORE-321 carries a check for each. The
> number was assigned by the dispatcher.

## Why a misplaced block is worse than none

This repository keeps its reasoning beside the code. A reader takes the block above a symbol as that
symbol's, so a block standing on the wrong declaration is read, and believed, about the wrong thing.
The declaration it really belongs to is usually left with no block at all. `itemPublic` carried none
while its reasoning about ADR-0045 sat on `placementPublic`. `cancel` carried none while its "NOTHING
RUNNING IS ANSWERED, NOT REFUSED" sat on `history`.

## CNCORE-258 named four in this tree, and the tree held 27

CNCORE-258 was filed from a scan of prose, and it named eleven stacked blocks across three
repositories. Four were in CanonCore. Run over the tree at `9e20133` on 2026-09-21, the check found
27, so 23 had not been named. provider-wiki held two more than the ticket named as well
(`test/corpus-figures.test.ts` and `scripts/live-wiki.ts`).

**Four causes produced the one shape**, and each left a `/**` directly on another:

- **A declaration inserted between a block and its own.** `asTheOwner` landed between `setup`'s block
  and `setup` (`c9e4633`). Five helpers landed between `findPlacementsInContainer`'s block and the
  function, the first of them `whatItHolds` under CNCORE-183.
- **A block rewritten with the old draft left behind.** `turbo-cache-inputs.test.ts` held two drafts
  of `packagesReachingOutsideThemselves`'s block, the older stranded above `publishedHelpers`. The
  place form's block in `apps/web/src/app/items/actions.ts` still described `z.coerce.number()` after
  `positionField` replaced it and carried the same argument in its own words.
- **A declaration split in two, with the block left on the wrong half.** CNCORE-309 split
  `EVERY_LISTING` into `EVERY_QUESTION` and a derived list, and "EVERY LISTING PROCEDURE" stayed above
  the literal it no longer named.
- **Born stacked.** `merge-gate.test.ts` wrote `World`'s block above `PullRequestFields`'s in the
  one commit that created both (`13a552f`).

## How each was fixed

- **Moved onto its declaration**, which covers most of them.
- **Swapped, where the pair was an argument written in order.** Five pairs read as a sequence:
  "FOR THE MIRROR REASON", "the same device again", "THE CHECK ITSELF, against fixtures rather than
  the real file", a second "AND", and "A TASK THAT SAID NOTHING SAID NOTHING" answering the strip
  above it. Moving the upper block would put the second half of the argument before the first. In
  those five the TESTS moved rather than the blocks, so each block sits on its own test and the
  argument still reads in order. They are in
  `apps/web/e2e/document.test.ts`, `packages/config/src/node-major.test.ts`,
  `packages/contract/src/contract.test.ts`, `packages/env/src/install-path.test.ts` and
  `packages/tasks/src/index.test.ts`.
- **Deleted, where the orphan was an older draft** of a block its declaration already carried.
- **Corrected in the sentence, where a moved block was false at its new slot.** "ADDING A LISTING IS
  ADDING A LINE HERE" now names `EVERY_QUESTION`, where the lines are. "The one input on this
  procedure that is not about which item" dropped "the one", since `placed`, `before` and
  `placedAfter` arrived later. "Twelve of the thirteen properties" became the argument it rested on,
  which is that `title` declares no `assertableBy` and the import writes one, by
  [[0188-a-count-nobody-routes-by-is-deleted-rather-than-derived]]. "ADR-0045 again" lost its "again",
  whose antecedent had moved, by [[0193-a-fallback-is-punctuated-for-its-slot-and-argued-from-it]].

## What the check reads

**Only a docblock on a docblock.** A plain `/*` above one is a heading over a run of fields, as
`THE EXTENSIONS` is in `packages/contract/src/cmpp.ts`. A plain `/*` below one is a note on how the
thing is built, as the note on `setup` is in `apps/web/e2e/global-setup.ts`. The tree holds both
lawfully, and a row pins each.

**A file's header is exempt.** A header is the file's first docblock with nothing but imports and a
directive above it. A module's own block sitting on its first declaration's is how this tree writes
a header, dozens of times over.

**The comments come from the scan.** [[0177-a-stripper-that-must-read-code-is-a-scan-not-a-pattern]]
refused a pattern for reading comments, because a pattern cannot tell a `/**` in a string from one
in code. `testing/without-comments.ts` now also answers `commentsIn`, which gives each comment's
position and text. Both come out of the same loop, so there is still one scan and not a second
tokenizer. The one pattern this check does use matches imports and a directive, and it reads only
what the scan left above the first docblock. The comments there are already blanked, so what remains
is statements.

**Every row was checked against the mutation it names**, which is
[[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]] applied. There were six
mutations: dropping the whitespace test, admitting a plain comment on either side, dropping the
header exemption, dropping the directive, and taking the first docblock as the header wherever it
sits. Each turns at least one fixture row red, and not only the sweep over the tree.

## What this does not cover

- **A misplaced block that is also its file's first docblock after the imports**, since it reads as
  a header. `setup`'s block in `global-setup.ts` was one, and was moved by hand.
- **A plain comment stacked on the wrong plain comment.** `item.get`'s note on the members cursor
  was one, and was moved by hand onto `after`.
- **A block on the wrong declaration with no second block beneath it.** Nothing stacks, so there is
  nothing to see. `provider-tmdb`'s `seriesTitle` reasoning sat on `type BrowseResult` in exactly
  this way.
- **A citation that did not move with its subject.** `NotYours` for `WhoCanAdd`, and "both
  functions above" for a helper with one caller above it and one below, are prose, and only reading
  finds them.
- **The provider repositories.** Neither has the scan, and porting it is a second copy to keep in
  step. CNCORE-321 carries that, with a `TODO` naming it at the check.
- **The count this suite moved.** `packages/config` now holds 33 suites that read the repository at
  large, up from 32, and `tree-figures.test.ts` holds the figure where `turbo-cache-inputs.test.ts`
  states it. By ADR-0188's test that count may route nobody. Whether it should be deleted is left to
  a pass about that count.
