---
status: accepted
---

# An assertion is checked by deleting the behaviour it names

A test earns its place by DISAGREEING with code that is wrong. So the only check on an
assertion is to delete the behaviour it names and watch it: one that stays green named a
behaviour it never reached, and it will go on being green when that behaviour breaks for
real.

CNCORE-257 ran that check on ten assertions across three repositories. All ten stayed
green with their subject deleted. None of them was a careless line -- eight sit under
docblocks arguing, correctly, for the very thing the assertion below them failed to hold.

## The four ways one goes hollow

They are worth naming because the reading eye cannot tell them from real ones.

**A count over something else already fills.** `expect(rows.length).toBeGreaterThan(0)`
over `sources`, to show a live import recorded its origin. `sources` is never empty on a
migrated database -- migration 1 seeds `owner`, migration 17 seeds
`derived:sort-name-v1`. Measured on a freshly built one: two rows, `items` 0, `placements`
0. The count passed with the entire import deleted, while `kind`, `identity` and `label`
were selected for `console.log` alone.

**An aggregate nobody reads.** Two placement claims aggregated the positions that WERE
their subject -- one Item in several Orderings at different Positions, a story at several
points of one timeline -- printed them, and then asserted the row count. Seeded to a
catalogue where every placement of an item sits at one position, both passed.

**A read the SHELL answers.** Three refusal pages asserted `toContain("/login")` over the
whole document, to show a refused reader is still told the step that would make them the
owner. The header offers that link to every reader with no session on an instance that
has a password, so the document answers whether or not the page does. Measured on the
Owner's install: empty `<main>` entirely and all three stay green. Each of the three files
already carried a `mainOf(...)` twin that reads the page instead.

**A guard whose trigger is unreachable by construction.** `aPortThief` binds whatever port
a spawn names, and the case asserting a server survives it hands that server `--port 0`.
Measured from inside the thief: `resolved port=0, binds=false`. Nothing was ever taken.

## What follows, and what does not

**A hollow assertion is deleted or renamed, not moved.** Where a real twin already exists,
moving the hollow one beside it produces a second copy of a passing test, which is not more
coverage. Where nothing reaches the behaviour, the name changes to what the test holds --
`port-thief.ts` already words it, "A port of 0 names nothing, so it takes nothing" -- and
the docblock says the case is a GUARD against a design returning, rather than a
reproduction of the defect.

**But unreachable is a measurement, not an impression.** Of the ten, one was recorded as
needing a mock the repository did not have; the gate it runs behind is itself a
`MockAgent`, so the honest assertion was one interceptor away and was written rather than
renamed. Check before settling for a rename.

**And the constraint decides what a test may claim.** One case asserted a story repeated at
one position; `placements_container_item_position` is UNIQUE NULLS NOT DISTINCT over
(owner, container, item, position), so that shape cannot exist. Measured on the Owner's
install: of 1,537 groups, zero repeated positions -- and 27 that pass only because a NULL
position sits beside a real one, which is [[0018-ordering-lives-on-the-placement]]'s
absent position rather than a repeat.

## Evidence

CNCORE-257, 2026-09-20. Every figure here is a measurement of a running system rather than
a count of this tree, so each carries what it was taken over and how to take it again
([[0153-a-figure-about-this-tree-is-derived-or-dated]]).

**The seeded `sources`,** over a database `buildTestDatabase("web")` had just built:

```sql
SELECT kind, identity, label FROM sources;                      -- 2 rows
SELECT count(*) FROM items; SELECT count(*) FROM placements;    -- 0, 0
```

**The placement shapes,** over the Owner's own install, whose catalogue is a real live
import rather than a seed:

```sql
WITH g AS (
  SELECT count(*) AS times,
         count(*) FILTER (WHERE p.position IS NULL) AS nulls,
         count(DISTINCT p.position) AS distinct_real
  FROM items i JOIN placements p ON p.item_id = i.id
  GROUP BY i.id, p.container_id HAVING count(*) > 1)
SELECT count(*), count(*) FILTER (WHERE nulls > 0),
       count(*) FILTER (WHERE distinct_real < times - nulls) FROM g;
```

which answered 1,537 / 27 / 0 on 2026-09-20.

**The three refusal pages,** over that same install, with no session: fetch `/tasks`,
`/settings` and `/devices`, replace `<main>.*</main>` with nothing, and the document still
contains `/login` and `Log in`.

**The provider suites,** over each repository at the commit this ticket branched from:
`pnpm test && pnpm exec tsc --noEmit` in `provider-wiki` (21 files / 348 tests) and in
`provider-tmdb` (10 files / 118 tests), each re-run with the mutation named above applied.

## As built, under CNCORE-257

**BUILT: the ten sites, and the practice written down.** Each of the ten was checked by
deleting its subject before it was touched, and each replacement was shown red on that same
mutation. The four shapes above are what that found, and the live-import claims carry the
measurement in the docblock beside the assertion it justifies.

**NOT BUILT UNDER CNCORE-257: the run that applies it.** There was no mutation-testing check in
CI and none is proposed here; a run that deletes behaviour at random is a different decision, with
a cost this record has not priced. So the half that was missing was the half that would catch the
eleventh, and this was a rule reviewers applied by hand -- which is how all ten arrived. **That
half is built under CNCORE-378, below**, as a run that deletes a behaviour somebody NAMES rather
than one it picks at random, so the decision this paragraph declined to take is still not taken.

**AND ONE OF THE TEN WAS NOT RUN.** `live-import.test.ts` needs the Owner's tardis.wiki
Credential, which expires within a day and which only the Owner renews. Its three
replacements are typechecked, measured against a seeded catalogue for the red half and
against the Owner's install for the green half, and unexecuted in the file they live in.

## As built, under CNCORE-378

**BUILT: the run.** `pnpm delete-the-behaviour --root <package> --delete <file>:<from>-<to>
[vitest filters]`, in `packages/config/scripts/delete-the-behaviour.ts`. It runs the tree the
filters choose, blanks the named lines, runs the tree again, puts the file's bytes back, and prints
every test that passed both times as `STAYED GREEN`, exiting 1 if there is one. `--delete` repeats
for a behaviour that lives in more than one place. It refuses, exiting 2, a file outside `--root`, a
tree already red before the deletion, and a deletion after which a test stopped running at all: a
line that breaks the file reddens everything, and would otherwise read as every assertion biting.
A crash exits 2 too, so a 1 is always a finding.

**THE TREE IS THE TESTS THAT CLAIM THE BEHAVIOUR, AND CHOOSING IT IS THE DEVELOPER'S.** Every test
the chosen tree runs is expected to go red, so a test that never claimed this behaviour, staying
green, is the tree chosen too wide rather than a finding. Deleting `without-comments.ts`'s `.`
guard over that module's own suite reddens 1 of its 25 rows and names the other 24, which is
[[0177-a-stripper-that-must-read-code-is-a-scan-not-a-pattern]]'s claim that the guard owns one
row; `-t` narrows the tree to the row that claims it.

**IT BITES, AND A SUITE SAYS SO.** `packages/config/src/testing/hollow-fixture/` holds one
behaviour for each of the four shapes above, and for each a hollow assertion and a twin that
reaches the same claim. `delete-the-behaviour.test.ts` runs the run over a copy and holds it to
naming the four hollow ones and only them, to passing the four twins alone, to telling apart two
tests named alike, and to three of the refusals. Six guards were then deleted in turn -- the refusal
of an unreached test, the refusal of a red tree, the refusal of a path outside the root, the
restore, the second run, and the numbering of tests named alike -- and each reddens at least one
case. The refusals of an empty tree and of a tree that does not load have no case.

**ONE GUARD IS HELD BY MEASUREMENT RATHER THAN BY A CASE: the signal listeners.** Review found
their bodies never run, which is true -- `spawnSync` holds the event loop, so a signal is handled
only after Vitest exits and `finally` has restored. But their PRESENCE is what keeps Node from
dying on the spot. Interrupting a run eleven seconds in, inside the deleted run, on 2026-09-26:
with the listeners the file came back and the run refused; with them deleted it died with the line
still blanked. So the listeners are now empty and say why, rather than being deleted as the fourth
shape. A case for it would race a signal against a timer, so there is none.

**WHY NOT STRYKER, which is the established tool, and whose documentation was read rather than
remembered.** It mutates by its own catalogue of operators across the lines it is given and reports
per MUTANT, where this record asks a per-TEST question about a behaviour somebody named. Its
`disableBail` does list every test a mutant fails, but under `coverageAnalysis: "perTest"` only the
tests that covered the mutant run -- which leaves out exactly the assertion that never reached its
behaviour, the first shape above. It was not installed and tried here; that is a reading of its
configuration reference, not a measurement.

**MEASURED, on 2026-09-26 at `38628332`, on an Apple M4 Pro with 14 cores.** The run over
`without-comments.test.ts` alone, 25 tests: 0.86 to 0.90 seconds across three runs. The same
deletion over all of `packages/config`, 41 files and 438 tests: 18.91 and 20.22 seconds across
two, since it runs the tree twice. The suite holding the run to its fixture, six cases: 2.67 to
3.82 seconds across three.

**SO THE SELF-TEST IS IN CI AND THE RUN IS LOCAL-ONLY, each decided by its own figure.** Three
seconds is small beside `packages/config`'s own run, which CI already takes uncached, so the suite
that proves the run bites gates every pull request. The run costs two runs of the chosen tree per
named behaviour: about twenty seconds for this package, for ONE behaviour. A CI gate has no author
to name behaviours, so it would have to name them all -- every line, in every package -- and that
figure multiplied by every line is a whole-corpus check.
[[0057-the-archive-stays-outside-the-repo]] puts that local-only ("Anything needing the whole
corpus is a local-only check, never a CI gate"); its corpus is the wiki, and the ticket that built
this named it as the precedent for a corpus of tests too.

**ACCEPTED, because the mechanism this record decides is whole.** The record decides that an
assertion is checked by deleting its behaviour; it never decided that CI does the deleting. What
was missing was any way to run the check other than by hand, and that exists and is held to
biting. What it does NOT do is choose: which behaviour, and which tests claim it, is still the
author's or the reviewer's call, and a behaviour nobody names is one nobody checks. This is a tool
somebody reaches for, not a gate that reaches them.
