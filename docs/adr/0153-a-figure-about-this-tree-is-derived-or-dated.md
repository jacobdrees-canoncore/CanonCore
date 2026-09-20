---
status: proposed
---

# A figure this repository states about itself is derived from the tree, or it carries its date

A count of this repository's own files, jobs, configs, call sites or rungs is re-derivable by
anything that can read the tree. Where it is, prose stating it is held to the tree by a check.
Where it genuinely is not -- a duration on the forge, a measurement of a running system, another
repository's corpus -- the figure carries the population it was counted over, the date it was
taken, and the query that would take it again.

## The defect this answers

A figure measured once, written into prose, and never re-measured is this repository's most common
defect. The 688-file scan of 2026-09-20 found roughly thirty-five standing at once (CNCORE-252).
Every one of them was TRUE THE DAY IT WAS WRITTEN, which is what makes the class invisible: nothing
is broken, no test goes red, and the tree simply moves out from under the sentence.

The sample is worth reading, because the range is the argument:

- `CLAUDE.md` rested the four-agent ceiling on "55-60 of 288 usable connections" after the eleventh
  e2e server pushed the peak to 67. The ceiling still held (4 x 67 = 268 < 288), which is exactly
  why nobody noticed.
- `ci.yml` argued from "a fourteenth job" in a workflow that runs fifteen.
- `network-gate.test.ts` counted suites in a test NAME, and printed the wrong number on every run.
- The README said `packages/config` "contains no TypeScript" of the package that holds every check
  this repository makes of its own CI. It held 32 files and 7,882 lines when the scan was taken on
  2026-09-20 -- a figure of the defect AS FOUND, dated here because it is a measurement of a tree
  that has moved since, which is this record's own rule for a figure it does not derive.
- ADR-0119 declared five Listings and closed the question in capitals: "THE FIFTH LISTING HAS
  ADOPTED THIS RECORD, AND IT IS THE LAST ONE THERE IS." ADR-0133 added a sixth two records later.

## The specimen, which is the one with a consequence

`ci-timeouts.test.ts` enforces `ceiling == max(5, ceil(3 x slowest / 60))` and passed for eight days
while the figures it multiplies went stale. Over the runs after ADR-0141's window closed, `The page
over HTTP` ran 243s against a recorded 159 and the real-provider job 260s against 166, so both kept
about 2x headroom where the rule means 3x.

**The check was green and its own premise was not.** Nothing was failing, and nothing would have
reported it. That is the disease in one file: the test's input is the figure nobody re-measures.

## The rule

**Derived where the tree holds the answer.** `packages/config/src/tree-figures.test.ts` is a table
of
claims -- a file, a pattern that reads a figure out of its prose, and a derivation that counts the
same population off the tree. The claim passes when the two agree. A pattern that stops matching
THROWS rather than quietly covering nothing, so a reworded sentence goes red and the table follows
it; that is `node-major.test.ts`'s rule, and an assertion that something must BE there cannot be
allowed to pass by no longer finding it.

**Dated where it does not.** Three kinds cannot be recomputed by reading files, and each keeps its
date and its query where the figure is stated:

- **Durations on the forge.** Reading them from the Actions API would put a network call inside a
  suite the network gate exists to keep offline. ADR-0141 carries the window, the query and the
  method, and a ceiling moves by moving the window and taking the measurement again.
- **Measurements of a running system.** The 67 connections were taken by sampling `pg_stat_activity`
  through a real run. `apps/web/e2e/global-setup.ts` is where it was taken and where its date and
  method live; `CLAUDE.md` and the dispatch skill RESTATE it, and the check holds the restatements
  to that one source rather than to each other.
- **Another repository's corpus.** The `Theory:Timeline` figures are `provider-wiki`'s.
  `corpus-figures.test.ts` holds them to carrying their population and their date, and says why no
  check on this side of the boundary can do more.

**A figure that is stated twice is a figure that drifts in one of them**, which `vitest-configs.ts`
already says in its own words. So a count is stated once per document and referred to afterwards,
rather than repeated: `turbo-cache-inputs.test.ts` had one figure written four times and every copy
was wrong.

## What this does NOT cover, said here rather than left to be discovered

**A figure missing from the table is not caught.** This is a roll call, not a sweep of the prose.
Nothing reads an arbitrary number out of an arbitrary document and decides whether it is stale,
because deciding which numbers in English are claims about this tree is not a problem a regular
expression settles. A new sentence quoting a count is covered only by being added, exactly as a new
place stating the Node major is covered only by being added to `node-major.test.ts`.

**Two populations this tree holds are deliberately absent**, because neither has a structural signal
a derivation could read without inventing one. The six Listings share no output schema and no input
type -- `item.get`'s two take plain optional strings rather than a cursor and answer inside a larger
object -- so a derivation would be a list of six names checked against itself, which is a tautology
rather than a count. And "the suites that need the loopback carve-out" is a judgement about what a
suite does at runtime, not a fact on disk; that figure is now a phrase rather than a number, which
is the honest answer when nothing derives it.

## Why this stays PROPOSED

**Half the mechanism landed.** The DERIVED half is built and runs: `tree-figures.test.ts` holds
thirty-three claims across twenty-one files to counts taken from the tree, and it caught every drift
CNCORE-252 fixed in those populations. Those two figures are themselves claims in that table, which
is the rule applied to the record that states it.

**The DATED half is a convention, not a mechanism.** It is enforced for exactly one population --
ADR-0128's corpus figures, by `corpus-figures.test.ts`, which asserts that each sentence stating one
carries a date and the population it was counted over. Nothing holds ADR-0141's window, the
connection measurement, or any other undated figure to the same rule. A record is `accepted` when
its MECHANISM is whole rather than when its own gate was met, and half a mechanism looks finished
from outside, so this says which half.

**What would finish it** is the date rule applied to the records that state an underivable figure,
the way `corpus-figures.test.ts` applies it to one. That is a sweep of `docs/adr/` rather than a
line of code.

**AND ONE CRITERION OF CNCORE-251 IS NOT MET, NAMED HERE RATHER THAN LEFT TO BE FOUND.** That
ticket asked that "`SLOWEST_SECONDS` is derived from the forge, **or** the test fails when the
recorded figure is more than a stated distance from the real one". NEITHER limb is built. The
figures were re-measured by hand under CNCORE-252 and `ci-timeouts.test.ts` still multiplies a
number nothing re-checks, so the disease can recur in its own specimen. Both limbs need the real
figure, and the real figure is on the forge: a suite that fetched it would need the network the
gate exists to refuse, so this cannot be a unit test. What it could be is a CI job or a scheduled
script that re-reads the window and fails when a recorded figure has fallen a stated distance
behind -- which is a mechanism of its own, and the dispatcher ruled on 2026-09-20 that this PR was
not to build a second staleness mechanism beside the one it already carries.

**WHAT DID LAND AGAINST THAT CRITERION** is smaller and worth having: ADR-0141 owns the window,
`ci-timeouts.test.ts` restates it, and `tree-figures.test.ts` now holds the restatement to the
record. Both were moved by hand when the window moved, by one agent in one pass, with nothing
checking that the second edit happened. That is caught now. The figures themselves are not.

## The cancelled predecessor, recorded so it is not proposed again

`corpus-figures.test.ts` carried `TODO(CNCORE-158)` asking for exactly this widening. That ticket
reads `Canceled`, and its own acceptance criteria ended with "the TODO in that file pointing at this
ticket is removed" -- so the TODO was written to be deleted by work that was then declined. It read
as a gap somebody was going to close, and nobody was. It is resolved under CNCORE-251, which is the
work CNCORE-158 was cancelled instead of doing.
