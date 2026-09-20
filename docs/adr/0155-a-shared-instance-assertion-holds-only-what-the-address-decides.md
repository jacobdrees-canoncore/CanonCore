---
status: proposed
---

# A test sharing an instance asserts what the address decides, and nothing the catalogue decides

The page-over-HTTP suite runs its files concurrently against instances they share. A file asserting
that one ADDRESS is served the same page twice compares a REGION, and that region may hold only what
the address decides: the Rows the query selects, the counts of those Rows, the controls the address
marks current. Anything on the page that answers to the whole catalogue -- a list of every Group,
every Provider, every anything -- is outside what such an assertion may compare, because another
file writing to the same instance changes it without the address changing.

Where the assertion genuinely needs the catalogue-wide part, it asserts a FACT about it that does not
move with the catalogue's size, never its bytes.

## The defect this answers

Two files compared `<main>` byte-for-byte across repeated fetches of the shared seeded instance:
`apps/web/e2e/scope.test.ts` and `apps/web/e2e/order-and-narrow.test.ts`. `NarrowToAGroup` renders
every Group there is, uncapped, and it sits inside that `<main>`. `apps/web/e2e/import-page.test.ts`
creates three Groups on that instance from its own worker.

So the comparison was a bet on timing, and it lost twice:

- **CNCORE-175's own run.** Recorded in `order-and-narrow.test.ts`'s docblock: the test passed run
  alone and failed in the full suite, `expected '<main ...>' to be '<main ...>'`.
- **CNCORE-271, 2026-09-20.** One full `pnpm test:e2e` failed on
  `/search?q=season&group=<id>&kind=person` with the same message. Three later runs of the same
  commit passed, 24 files and 337 then 338 tests. So it arrives as a red run on somebody's unrelated
  branch, which is the worst shape a defect can have.

**THE FIRST FIX REACHED THE ROWS AND WAS TAKEN FOR A FIX OF THE PAGE.** Narrowing every surface to a
seeded Group nobody writes to froze the Rows, and the docblock recording that is still correct about
what it did. It could not freeze the picker, which is catalogue-wide and sits in the same `<main>` --
so the sentence stating the fix was, from the day it was written, an account of half of one. That is
why the correction is written INTO that sentence rather than beside it.

## The decision

- **`steadyMainOf` is what a byte-for-byte comparison compares**, in `apps/web/e2e/document.ts`:
  `<main>` with the `Narrow to a Group` picker cut out, spliced by index rather than `replace`d, so
  a Group named with `$&` cannot defeat the cut.
- **It REFUSES a page with no picker.** Cutting a region out is how an assertion quietly stops
  covering it, and a picker absent on the session-less fetch is exactly the regression these files
  exist to catch.
- **What the picker SAYS is still compared, as a fact.** Both callers assert `markedCurrentIn` is the
  same for the Owner's fetch, the reload and the session-less fetch. That is the half of the picker
  the address really does decide, and it does not depend on how many Groups exist.
- **The timing is forced rather than waited for.** `aGroupArrives` creates a Group through the
  router, as the Owner, between two fetches -- doing deliberately what `import-page.test.ts` does by
  accident. What took four full runs to show once now happens every run.
- **`NarrowToAGroup` says what it is.** The component carries a paragraph naming itself as
  catalogue-wide state inside `<main>` that a shared-instance test can see. Nothing about the
  component changes: rendering every Group is what it is FOR.
- **`apps/web/vitest.e2e.config.ts` does NOT set `fileParallelism: false`**, and now says so. Five
  sibling configs set it; that count is held to the tree by `tree-figures.test.ts` under ADR-0153,
  so the argument cannot go stale the way the sentence it replaces would have.

## Alternatives weighed

- **`fileParallelism: false` for this suite.** It would have prevented both failures, by making it
  impossible for another file's write to land between two fetches. It does not fix the assertion: the
  dependency on catalogue-wide state stays, waiting for whoever runs two files at once. It also pays
  the suite's wall clock on every run forever to buy isolation the fix already provides. The five
  configs that DO set it share one database across their files with nothing else separating them,
  which is a different condition from this suite's.
- **Moving the two files to an instance nothing writes to.** The suite already has one:
  `aCatalogueThatHoldsStill`, built by CNCORE-93 for exactly this class of problem. It cannot take
  these tests, and the reason is its own contract rather than an accident. It is created with
  `ownerPassword: ""` because "nothing writes to it" is what it is for, and an instance nobody can
  log in to cannot be written to. These assertions need an OWNER session: what they compare is an
  owner's fetch against a session-less one. Standing up a sixth instance instead would cost a
  database, a server and a connection pool against ADR-0104's four-agent ceiling, and would hide the
  class rather than fix it -- the next assertion written against the shared instance falls into the
  same trap, and "nothing writes to it" is a property nobody can enforce.

## How it is held

- **The shape, every run, on fixture markup.** `apps/web/e2e/document.test.ts` pins `steadyMainOf`:
  that a Group added to the picker leaves it unchanged where `mainOf` differs, that it keeps
  everything else so a changed Row still differs, and that it refuses a page whose picker is gone.
  The first of those is the production failure in miniature and was RED before the fix, with the
  ticket's own message.
- **The property, over real HTTP.** `aGroupArrives` in both files. Measured on this branch on
  2026-09-20: with the adversary armed and `mainOf` still being compared, `scope.test.ts` and
  `order-and-narrow.test.ts` failed 3 of 8 tests, and the diff between the two `<main>`s was exactly
  the anchors of the Groups that had arrived and nothing else. With `steadyMainOf` they pass.
  `git show` of this record's commit takes it again.

## Which half of this landed

**THE RULE IS ENFORCED FOR ONE POPULATION AND STATED FOR ALL OF THEM**, which is why this record is
`proposed` rather than `accepted` -- ADR-0153's own shape, one record earlier.

What landed is the Group picker: the two assertions that compared it no longer do, the component
says what it is, and a test goes red if either changes. What did NOT land is any check that a THIRD
file cannot write the same assertion tomorrow. "Catalogue-wide state" is a judgement about what a
region answers to rather than a fact on disk, so no sweep here derives it, and this record does not
pretend one does. The next file to compare a served region byte-for-byte is held by this sentence
and by review, and by nothing else.
