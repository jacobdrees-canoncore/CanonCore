---
status: proposed
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

CNCORE-257, 2026-09-20. Each mutation and its result is in that PR's body. Two were run
against the Owner's own install rather than a seed; the provider-wiki one left 21 files / 348
tests green and `tsc --noEmit` clean.

## What has NOT landed

**NOTHING ENFORCES THIS.** There is no mutation-testing check in CI and none is proposed
here; a run that deletes behaviour at random is a different decision, with a cost this
record has not priced. What landed is the ten sites and the practice written down, so the
half that is missing is the half that would catch the eleventh. Until it exists this is a
rule reviewers apply by hand, which is how all ten arrived.
