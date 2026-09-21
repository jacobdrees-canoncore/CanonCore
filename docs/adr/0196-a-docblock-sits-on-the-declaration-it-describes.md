---
status: accepted
---

# A docblock sits on the declaration it describes, and one stacked on another is refused

> **ACCEPTED 2026-09-21, whole, for CanonCore.** `packages/config/src/stacked-docblocks.test.ts`
> refuses a `/**` standing directly on another `/**` in any tracked `.ts` or `.tsx` under
> `packages/` or `apps/`, except a file's own header. It found 27 at `9e20133`. Every one is now
> moved, merged or deleted, and the check is green. The provider repositories' instances were fixed
> by hand under CNCORE-258, in two PRs MERGED before this one: `provider-wiki#61` as `8aa5bff` and
> `provider-tmdb#32` as `1f4f3c3`. **Each provider repository holds the check too since
> CNCORE-321**, ported with the scan it reads, in two PRs MERGED before the change recording them:
> `provider-wiki#62` as `d1f6714` and `provider-tmdb#33` as `e14e361`. This record's number was
> assigned by the dispatcher.

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
  whose antecedent had moved below it.

## What the check reads

**Only a docblock on a docblock.** A plain `/*` above one is a heading over a run of fields, as
`THE EXTENSIONS` is in `packages/contract/src/cmpp.ts`. A plain `/*` below one is a note on how the
thing is built, as the note on `setup` is in `apps/web/e2e/global-setup.ts`. The tree holds both
lawfully, and a row pins each. **A blank line between two docblocks does not separate them**, since
only a declaration gives the upper one something to sit on.

**A file's header is exempt.** A header is the file's first docblock with nothing but imports and a
directive above it. A module's own block sitting on its first declaration's is how this tree writes
a header, dozens of times over.

**The comments come from the scan.** [[0177-a-stripper-that-must-read-code-is-a-scan-not-a-pattern]]
refused a pattern for reading comments, because a pattern cannot tell a `/**` in a string from one
in code. `testing/without-comments.ts` now also answers `commentsIn`, which gives each comment's
position and text. Both come out of the same loop, so there is still one scan and not a second
tokenizer. The two patterns this check does use match an import and a directive, and they read only
what the scan left above the first docblock. The comments there are already blanked, so what remains
is statements.

**Every row was checked against the mutation it names**, which is
[[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]] applied. There were seven
mutations: dropping the whitespace test, narrowing it to a single newline, admitting a plain comment
on either side, dropping the header exemption, dropping the directive, and taking the first docblock
as the header wherever it sits. Each turns at least one fixture row red, and not only the sweep over
the tree. **The single-newline one was found by review**, when every fixture row stayed green under
it, and the blank-line row was added for it.

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
- **The provider repositories**, which this check does not read. Each holds its own since
  CNCORE-321, in the section below.
- **The count this suite moved.** This suite reads the repository at large, so it moved the figure
  `tree-figures.test.ts` holds and `turbo-cache-inputs.test.ts` states. By ADR-0188's test that
  count may route nobody. Whether it should be deleted is left to a pass about that count.

## The provider repositories, under CNCORE-321

**Each holds `test/stacked-docblocks.test.ts`**, this check ported, over every tracked `.ts`, naming
each pair as `path:line`. It reads comments through `test/setup/without-comments.ts`, which is
[[0177-a-stripper-that-must-read-code-is-a-scan-not-a-pattern]]'s scan with the code copied line
for line. [[0031-a-provider-is-a-url]] lets no code cross the boundary between a provider and the
app, so a copy was the only route, and a pattern was not one, for 0177's reason. The scan's rows and
the sweep that no docblock is left standing came with it, in `test/without-comments.test.ts`. The
four files, with the `git ls-files` read they share, are byte-identical across the two repositories.

**THAT IS THREE COPIES OF THE SCAN, AND NOTHING HOLDS THEM TOGETHER.** Since CNCORE-324 not even
the prose differs from this tree's: the file is byte-identical in all three, docblock included, and
that docblock says a change to it is a change to carry to the other two by hand. It is the caveat
the provider repositories already carry for their other twinned files.

**The directive exemption is not carried.** Neither provider writes a directive.

**Run on the trees CNCORE-258 found**, the check reports seven pairs in `provider-wiki` at
`f506438`. They are the seven `provider-wiki#61` moved or deleted, two of them ones its ticket had
not named. In `provider-tmdb` at `ffdcdd4` it reports none, and that is right: the two blocks
`provider-tmdb#32` moved were a plain `/*` on a plain `/*` and a single block on the wrong
declaration, both listed above as unseen. So in `provider-tmdb` this check would have caught nothing
CNCORE-258 fixed.

**The no-docblock sweep earns its place there, measured.** `provider-wiki`'s
`test/corpus-figures.test.ts` writes a regex holding three backticks, the shape that broke this
tree's first scan. With regex literals taken out of the scan, three docblocks below it are left
standing. The refusal does not fire, because a later backtick closes the stray template. The
stacked-docblock sweep stays green, because it reads no pair in the part of the file the scan has
lost. Only the no-docblock sweep goes red.

**Neither tree can falsify the scan's handling of literals.** A scan that reads `/*` and `//`
wherever they fall passes both sweeps in both repositories, so the rows hold it over sources they
supply, each saying whether it is quoted or invented. Every mutation run against the two new suites,
23 of them, reddens at least one hand-written row in each repository.
