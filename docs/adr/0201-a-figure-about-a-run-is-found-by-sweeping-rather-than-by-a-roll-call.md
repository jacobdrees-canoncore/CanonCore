---
status: proposed
---

# A figure about a run is found by sweeping the tree, not by a roll call somebody maintains

> **PROPOSED 2026-09-21. The mechanism is whole and lands in three PRs, so the flip waits for the
> other two.** `packages/config/src/run-figures.test.ts` sweeps every tracked `.ts` and `.md` in
> this repository for a figure stating how a test run went, and reddens on one that neither derives
> from the tree nor says which tree it was taken on. The two provider repositories hold the same
> check, as `test/run-figures.test.ts`, in `provider-wiki#67` and `provider-tmdb#36`. **This record
> reads `accepted` when those two merge**, and not before: no PR in a provider repository reaches
> `docs/adr/`, so a reviewer of this diff cannot check a claim about theirs
> ([[0192-a-cross-repo-tickets-provider-half-gets-a-worktree-of-its-own]]). CNCORE-339 assigned this
> number; the dispatcher issued it.

## The rule was written three times instead of measured once

[[0188-a-count-nobody-routes-by-is-deleted-rather-than-derived]] is correct and is not the problem.
The problem is that nothing asks the tree which sentences it governs.

CNCORE-333 deleted one suite total in `provider-wiki` and ended by naming two more its own grep had
turned up. CNCORE-335 deleted those two and ended by naming two more again. CNCORE-338 is those two.
**Three passes, each one grepping the tree it had just finished editing, each one ending by naming
what it had found somewhere it had not touched.** That is `closing-a-spec` §5's shape exactly, and
it does not converge: the grep is an instrument and the reading is the filter, so the next figure is
found whenever somebody next happens to look.

The cause is written down inside the check that was supposed to catch this. `provider-wiki`'s
`test/corpus-figures.test.ts` says of itself:

> It does not know that a figure is missing -- a new sentence quoting the corpus is caught only by
> being added to `LIVE_FIGURES` below, exactly as a new place stating the Node major is caught only
> by being added to `node-major.test.ts`.

`packages/config/src/tree-figures.test.ts` says the same of itself in its own words: *this is a roll
call, not a sweep of the prose.* **Both are allowlists.** They verify the figures somebody
registered and are blind to every figure nobody did. Neither is wrong; each is one layer, and the
layer under them was missing.

## Registration, not prohibition

A check that deleted every figure would be wrong, and
[[0188-a-count-nobody-routes-by-is-deleted-rather-than-derived]] says why: it keeps a figure an
argument rests on. CNCORE-335 left `provider-wiki`'s "1 failing of 169" standing on purpose, because
the whole sentence is that it is 1 and not 0, and refused that finding in writing so the next reader
would not take it. A ban takes that one too.

So the rule is that **every figure-shaped statement is answered for**, and the sweep is what makes
the question get asked. A figure is lawful three ways:

- **Derived.** [[0153-a-figure-about-this-tree-is-derived-or-dated]]'s first form, held by
  `tree-figures.test.ts`'s table.
- **Anchored.** That record's second form, executed here for the first time: the figure's own
  section, in a document, or its own comment block, in a source file, names the date or the commit
  it was taken on. A reader who knows which tree can go and take it again.
- **Registered**, with the reason written beside it: as `argument`, ADR-0188's carve-out where the
  number IS the claim; as `foreign`, a sentence wearing the shape and not being one; or — in the
  provider repositories only — as `record`, a pass log's account of what a past pass measured,
  bounded by naming where its correction stands. CanonCore keeps no pass log, so that third kind
  has no population here and is left out rather than declared unused.

Anything else is red, naming the file and the line and the three ways out.

**Staleness is not a kind.** A figure that merely went out of date is repaired, never registered. A
row for it would rebuild the allowlist this record exists to put a layer under.

## What the spellings are, and why there are two

**The equal pair**, `18 of 18`, and **vitest's own summary**, `8 failed | 21 passed (29)`. The
second is not a refinement; it is the whole reason this is in three repositories rather than one.

`provider-tmdb` answers **ZERO** to `N of N` and reads clean. It is not clean: it states three
figures, all in vitest's spelling, all in `CLAUDE.md`. Every one of the three hand passes grepped
the first spelling only, so a sweep keyed the same way would have certified the one repository no
ticket has ever swept — and certified it by a new route, which is worse than the first time.

## What was measured, on all three trees

CNCORE-338's two figures are the control, and they were run against the tree that really held them
rather than against a fixture: at `c2e7b0a` the sweep reports `test/install-path.test.ts`'s "18 of
18" and `test/unlock.test.ts`'s "16 of 16". A sweep missing either has a hole.

**A ticket number is not an anchor, and that was measured rather than assumed.** Both controls name
a ticket in their own sentence — CNCORE-206's loop beside one, CNCORE-214's rename beside the other
— and neither names a tree. A rule counting a ticket as an anchor passes both controls green, which
is how this one was chosen.

Measured 2026-09-21 on each branch as it stands. **The counts exclude each repository's own reader
and its suite**, which between them state more figures than the rest of a tree does — every one a
specimen of a spelling — and which are excused by name rather than by row.

| repository | files swept | figures now | anchored | registered | deleted here | dated here |
| -- | -- | -- | -- | -- | -- | -- |
| CanonCore | 549 | 37 | 33 | 4 | 9 | 0 |
| `provider-wiki` | 60 | 45 | 42 | 3 | 3 | 2 |
| `provider-tmdb` | 28 | 3 | 3 | 0 | 0 | 0 |

So 97 figures stood before this pass and 85 stand after it.

**97 figures, and 14 of them needed work** — twelve deleted and two dated. The rest were lawful
before this check existed and are lawful now, which is the answer to the ticket's own warning that
the upper bound is not the finding.

**Twelve deleted under ADR-0188**, nine here and three in `provider-wiki`. Most are a load-bearing
failure count with an unrouted total beside it, and the total goes while the count stays. **They
are not all that shape**, and saying so would be this record making the kind of blanket claim it
exists to refuse: ADR-0036's is a BEFORE and AFTER pair whose before is a green total, where what
carries the argument is the change between them and the sentence "the one is this test". The test
applied was ADR-0188's in every case — does an argument rest on the number — not a pattern.

**Two dated rather than deleted**, in `provider-wiki`'s `test/search.test.ts`. Not every repair is
a deletion: that sentence's subject is that the fixture figure MOVES with the roster, so the
figures are the claim and only the day they were taken was missing — which `src/archive.ts` had
carried at 2026-09-11 for the same mutation all along.

**One of the twelve could not have been found by any `git grep`.** `test/browse.test.ts`'s total was
wrapped across a line break — `64 of` ending one comment line and `64 passing` opening the next — so
every one of the three hand passes was structurally incapable of seeing it. The sweep flattens each
file before reading it and keeps an offset map so the line number survives the flattening.

## What this does not cover, said here rather than left to be discovered

- **It reads two spellings.** `44 of 45`, an unequal pair, is not read, and neither is a count
  written as a word. The unequal pair is left out deliberately: it is overwhelmingly a figure about
  something other than a test run, and this tree states dozens of them. **THE WORD IS A REAL HOLE
  AND IT HAS ALREADY COST SOMETHING.** `run-figures.ts`'s own docblock said its two excused files
  state "twenty" figures when they state thirty, and this sweep could not see it: a count spelled
  as a word, standing unanchored in the very file arguing against unanchored counts. Code review
  found it, which is what found all three of the sweeps this record replaces.
- **An entry excuses a file's words, not a line.** One row covers every occurrence of those words
  in that file, which is what a record quoting one transcript twice wants and means a third
  occurrence later is excused without anybody deciding it should be. A line number would close
  that hole and open a worse one: every row going stale on the edit above it.
- **It cannot tell a stale figure from a fresh one.** It asks whether a reader could check the
  figure, never whether the figure is true. An anchored figure that is wrong stays green.
- **A lone `N failed` is not read**, because `port 55432 failed:` and `10 failed guesses per subnet`
  are not run summaries and both are in this tree. A `failed` earns its place beside another
  outcome or with vitest's parenthesised total.
- **Two files in each repository are excused by name**: the reader and its suite, which cannot be
  written without stating the spellings they match. Each is held to finding something, so a third
  name added to buy silence reddens the run that adds it.

## As built, under CNCORE-339 — and this record stays PROPOSED

**BUILT: the sweep, the rule and the register, in this repository.**
`packages/config/src/run-figures.test.ts` and `testing/run-figures.ts` read every tracked `.ts` and
`.md`, in both spellings, and redden on a figure that neither derives nor carries an anchor. The
floor is held before the rule, so an emptied pattern goes red rather than passing on an empty
population. Nine defects in this tree were repaired under
[[0188-a-count-nobody-routes-by-is-deleted-rather-than-derived]], and the register holds four
entries across three documents, each of which must keep finding its figure.

**NOT BUILT HERE, BECAUSE IT CANNOT BE: the two provider halves, which are the same check in
`provider-wiki#67` and `provider-tmdb#36`.** `docs/adr/` is in this repository and no PR in a
provider repository reaches it, so a claim about their trees is one a reviewer of this diff cannot
check against the diff
([[0192-a-cross-repo-tickets-provider-half-gets-a-worktree-of-its-own]]). Both PRs are open and
green. **This record reads `accepted` when they merge, and the ticket that flips it is the second
one**, which is CLAUDE.md's rule for a cross-repo pair.

**AND THE CHECK CAUGHT THIS RECORD, on the rebase that added it.** The section naming the two
spellings has to write them down, so the sweep reported both. They are registered as `foreign`
rather than excused by filename: this document could state a figure of its own tomorrow, and
excusing the file would excuse that one too.

## What this leaves for its own record

[[0153-a-figure-about-this-tree-is-derived-or-dated]] stays `proposed`, and this narrows what is
missing rather than closing it. Its second form is *a figure that cannot be derived carries its date
AND ITS QUERY*. The date is executed now, in three repositories. **The query is not**: nothing
checks that an anchored figure also says how to take it again, and a sentence carrying a date and no
method is still a figure a reader cannot re-derive. That record says which half landed.
