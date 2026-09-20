---
status: accepted
---

# The fold is of the read, not of the question it answers

[[0136-a-control-is-a-primitive-and-a-surfaces-words-sit-beside-its-pages]] folds a repeated shape
at THREE, and said nothing about a shape whose copies disagree. Three of them in `packages/config`
went past that line while every author was reading the neighbour they had and not the four they did
not, which is the ordinary way a threshold is crossed.

**WHAT FOLDS IS THE MECHANISM -- the command, its arguments, the split, the filter that makes the
result safe to use. WHAT STAYS WITH THE CALLER IS THE QUESTION -- the pathspec, the projection, and
each caller's own guard against an empty answer.** A seam drawn
anywhere else is either an abstraction that lies about what the callers wanted, or a copy waiting to
drift.

The three that crossed, and what each one kept:

| Read | Copies | Folded into | Kept by the caller |
| --- | --- | --- | --- |
| `git ls-files` over the tracked tree | 5 files, 7 sites | `testing/tracked-files.ts` | pathspec, comment stripping, test-file filter, non-emptiness guard |
| `readdirSync` over `docs/adr/` with `/^(\d{4})-/` | 5 files, 7 sites | `testing/adr-records.ts` | status parse, decision-block split, identifier scan, self-exclusion |
| `text.replace(/\s+/g, " ").trim()` | 3 files | `testing/flatten.ts` | comment-leader stripping, in `tree-figures.ts` alone |

## The drift had already happened, which is what settled it

The reads genuinely disagreed, and CNCORE-277 was right that the shared core of the walk is about
three lines. The argument that folding three lines was worth doing anyway is not taste. It is a
measurement.

**`ui-callers.test.ts` argues `-z` at length** -- without it git applies `core.quotePath` and hands
back a non-ASCII filename double-quoted with its bytes octal-escaped, which then fails to open, "a
read throwing ENOENT on a file that is sitting right there". **`turbo-cache-inputs.test.ts` held the
IDENTICAL pathspec and did not have it**, splitting on newlines instead, with no comment anywhere
saying why the guard its neighbour argued for did not apply.

Nothing reported it and nothing could: this tree has no non-ASCII tracked path to fail on. It is
ADR-0136's own sentence -- "a copy does not have to be visibly wrong to be the failure: it drifts in
whatever half nobody is looking at" -- and it had already come true here while the note in
`ui-callers.test.ts` still read "THE SECOND COPY OF THIS READ, and deliberately not folded".

**THE NOTE WAS THE DEFECT, NOT JUST THE CODE.** A docblock recording that a threshold has been
considered and not yet crossed goes stale silently, because the author who adds the copy that
crosses it is reading their own neighbour, not the note. That is the general form, and it is why
this record exists rather than a fourth such note.

## Counting

**COUNT THE CALL SITES BEFORE ASSERTING A FIGURE.** Both tickets said four copies of their shape;
both were five by the time anyone read them. `adr-identifiers.test.ts` (CNCORE-246) was the fifth in
each case, and [[0166-an-identifier-a-record-names-is-checked-against-what-this-tree-once-held]]
had already noticed it for the walk and named this ticket as its owner. That is the same rule
`CLAUDE.md` states for record statuses -- "COUNT the statuses rather than quote a figure" -- and it
holds for copies for the same reason.

CNCORE-277 also named `packages/providers/src/reason.ts` and `packages/tasks/src/registry.ts` as
holding copies of the collapse. **Neither does.** `reason.ts` imports `oneLine` from
`@canoncore/text` and `registry.ts` has no collapse at all -- both were folded by ADR-0163 already.

## What the callers' disagreement actually bought

A fold is a claim that the callers wanted the same thing, so the parts they did NOT want the same
are the test of whether the seam is in the right place. Two of them changed the shape of the answer:

**The record reader returns a LIST, not a map keyed by number.** `adr-numbering.test.ts` exists to
catch TWO RECORDS SHARING ONE NUMBER -- it happened on 2026-09-11, when CNCORE-66 and CNCORE-68 both
took 0120 and git merged them clean because the slugs differ. A map keyed by number keeps the last of
a colliding pair, so the obvious shape would have handed that suite a corpus in which the defect it
is looking for cannot be represented. **A fold that silently disarms one of its callers' checks is
worse than the duplication it removed.**

**It reports what it could not number rather than filtering it away.** The same suite asks whether
every record is named with four digits, and can only ask it of a reader that kept the ones that are
not. The guard it replaced compared two counts; the guard it has now names the file. That was driven
red against a deliberately misnamed record before it landed.

**The collapse is not `@canoncore/text`'s `oneLine`, and that is a graph fact rather than a
preference.** `oneLine` is the same expression with control characters stripped first, for a
stranger's text rather than this repository's own prose. Reaching it would mean `@canoncore/config`
depending on `@canoncore/text`, which devDepends on this package -- closing a cycle `turbo.json`'s
`test` task (`dependsOn: ["^test"]`) would refuse to build a graph for. It is the cycle
`testing/repo-root.ts` already names for `@canoncore/env`.

## What is held by construction rather than by assertion, said plainly

**The `-z` guarantee is NOT tested, and cannot be against this tree.** The defect it prevents needs a
non-ASCII or newline-bearing tracked path to show itself, and there is none here; adding one to
assert against would be putting a hostile filename in the repository permanently to test a helper.
What replaced the assertion is that there is now ONE call site, so the two halves cannot disagree --
which is the only thing that was ever wrong.

**AND FOUR OF THE FIVE GUARD AN EMPTY ANSWER, NOT ALL FIVE.** `ui-callers.test.ts`,
`adr-as-built.test.ts` and `adr-identifiers.test.ts` each throw in their own words about their own
population; `biome-config.test.ts` asserts a count above zero. `turbo-cache-inputs.test.ts` has no
worded guard at all -- an empty walk reddens it only through a list comparison that would then
report the wrong thing. That is a gap in that suite rather than a reason to move the guard into the
shared reader, and it is named here because the first draft of this record said "every caller",
which was the tidier sentence and the false one.

**THE SHARED READER DOES NOT REFUSE A SYMLINK, and neither did any of the five it replaced.**
`git ls-files` reports a tracked symlink as an ordinary path and `readFileSync` follows it, so a
tracked link pointing outside the tree would be read and scanned. ADR-0103 spent a section on
exactly this for `configFilesIn` and `prose()` and refused it there; this fold carried the previous
behaviour rather than changing five suites at once, and `tracked-files.test.ts`'s "every path it
hands back opens" row passes straight through a link. Stating the boundary is what the fold makes
possible -- there is now one place for a future refusal to go.

`tracked-files.test.ts` asserts the contract that IS observable: git's answer rather than the
directory's, every path it returns opens, no empty string survives the split, a pathspec narrows
within the same population, an exclusion excludes, and `isTrackedAs` is false for a directory --
the near miss where a directory pathspec matches its children and a rename reads as fine.

**A CALLER THAT NEEDS MORE WRAPS THESE RATHER THAN REWRITING THEM.** `tree-figures.ts` is the worked
example: it strips the ` * ` and ` # ` leaders a wrap inserts into a JSDoc or YAML comment, then
calls `flatten`. That is a caller of the shared read, not a fourth copy of it.

## What this does not decide

**It is about reads inside one package, not about every repetition.** The threshold
[[0136-a-control-is-a-primitive-and-a-surfaces-words-sit-beside-its-pages]] sets is unchanged and so
is its argument; what is added is where to cut when the copies disagree.

**Copies of the collapse OUTSIDE `packages/config` are left alone.** `apps/web/e2e/item-write.test.ts`
holds two, and the graph rules out sharing this package's module with an app. They are two, which is
under the line.
