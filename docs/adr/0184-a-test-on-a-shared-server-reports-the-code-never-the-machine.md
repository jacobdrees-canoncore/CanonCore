---
status: accepted
---

# A test on a shared server reports the code, never the machine

> **ACCEPTED 2026-09-21, whole, in one repository.** Two mechanisms, one reason. `refusal` in
> `packages/db/src/testing/catalogue.ts` answers for SQLSTATE class 23 and throws for every other
> class, naming what it met; `packages/db/src/testing/refusal.test.ts` asserts that against errors
> the server itself produced -- a cancelled statement (57014) and an unreachable server
> (ECONNREFUSED) throw, a CHECK (23514) and a FOREIGN KEY (23503) answer with their constraint
> names -- and the first was checked RED first, resolving
> `'canceling statement due to statement timeout'` where the caller reads a constraint's name. And
> the three suites that reach the shared catalogue -- `packages/db`, `packages/api`,
> `packages/tasks` -- carry `testTimeout: 30_000`, with the new third case in
> `packages/db/src/suite-database-wiring.test.ts` holding every suite with a catalogue above
> Vitest's 5,000ms default and naming each that is not. That case was checked RED first and named
> all three. All 40 pre-existing calls to `refusal` still pass: 132 tests across
> `constraints.test.ts`, `import.test.ts` and `import-runs.test.ts`. No provider repository is
> touched, so nothing is owed at a second one.

## What happened

CNCORE-280 filed one test -- `constraints.test.ts > items > refuses a kind that is not one of the
seven` -- that failed once under a concurrent `pnpm test` and passed three times afterwards. The
run's output was consumed before it was saved, so the assertion message was never captured.

Its filer then caught the same shape somewhere else, and that observation is what widened the
ticket: `packages/api/src/routers/catalogue.test.ts`'s FIRST test died with
`Error: Test timed out in 5000ms.` at 5,004ms, while the same file's other ten passed in 6 to 24ms
each. So the subject is not the kind refusal. It is **a test that reaches the shared catalogue while
the rest of the machine is busy**, and there are two separate ways such a test lies about what it
found.

## Four mechanisms measured and refused

On 2026-09-21, in one worktree:

- **The connection ceiling is not it.** `pg_stat_activity` sampled every 0.5s through a whole green
  `pnpm test`: it peaks at **13** connections of the 300 `docker-compose.yml` grants. Four
  worktrees' worth is about 52. `sorry, too many clients already` is a real failure of this
  container, but it belongs to `pnpm test:e2e`'s ten servers; `turbo`'s `dependsOn: ["^test"]`
  serialises the three suites that reach a database.
- **The dead-database sweep is not it.** `sweepDeadDatabases` never drops a database younger than
  `GRACE_SECONDS`, an hour, and never uses `with (force)`. A suite database is seconds old.
- **A second run of the same suite is not it.** Two runs were pointed at one worktree deliberately,
  so that the second's `drop database ... with (force)` landed under the first. That fails **46**
  tests with 42P01, a whole file at a time. It is loud; the flake was one test.
- **Within-suite ordering was already refused by the filer:** `fileParallelism: false` and
  `StableSequencer` fix the order, and the suite alone passes.

## The first lie: a condition reported as a rule

`refusal` walked an error to the first level carrying a SQLSTATE and answered with its `message`
where there was no constraint name. That branch exists for a good reason -- a trigger's
`RAISE EXCEPTION` carries a sentence and no constraint -- but it never asked WHICH SQLSTATE, and
every error PostgreSQL raises has one. A server that could not RUN the statement therefore came back
in the position where the caller reads the name of the rule that bit. Measured rather than reasoned
about: under `statement_timeout = 1`, `refusal` answered
`"canceling statement due to statement timeout"`, so the assertion prints

```
expected 'canceling statement due to statement timeout' to be 'items_kind_item_kinds_kind_fk'
```

which reads as a broken rule about kinds and is in fact a loaded machine.

**A refusal is SQLSTATE class 23**, integrity constraint violation, and nothing else. The class is
measured, not chosen: all 40 call sites were instrumented and every one answered 23503, 23505 or
23514, because all nine `RAISE EXCEPTION`s in `packages/db/src/migrations/` carry
`USING ERRCODE = 'check_violation'`. A CLASS rather than a list of those three codes, because the
next member is a new kind of RULE rather than a new kind of answer -- and the test is of a
FIVE-CHARACTER code, because that is what a SQLSTATE is and node-postgres puts a libuv errno in the
same field.

## The second lie: a budget that measures the machine

Vitest's per-test default is 5,000ms (`@default 5000` on `testTimeout` in vitest 5.0.0's own types,
and the figure the captured failure printed). For a suite whose work is in its own process that is a
statement about the code. For these three it is a statement about **what three other worktrees are
doing to one PostgreSQL** (ADR-0104), with the first test in each file paying the connection on top.

So the three suites that build a catalogue carry `testTimeout: 30_000`, and
`suite-database-wiring.test.ts` holds every such suite above the default -- above it, rather than at
any particular figure, because what each suite needs is its own to say and what none of them may do
is inherit a number chosen for a suite that reaches nothing. Thirty seconds is `packages/contract`'s
figure, taken rather than invented: that is this repository's other suite whose work happens outside
its own process.

## What this buys, and what it does not

Together the two halves answer CNCORE-280's criterion from both ends: the timeout means a contended
machine no longer fails a test that is not wrong, and the classifier means a failure that DOES get
through names the SQLSTATE that caused it rather than asserting that a constraint is broken.

**It is not a diagnosis of the original run.** That flake was never reproduced, and the four
eliminations above are eliminations, not a cause. What changed is that the next occurrence is
readable.

**It does not cover the suites that do not use `refusal`.** A test asserting on a query's RESULT
rather than on its refusal still reads a server condition as a product defect, and nothing here
changes that.

**A trigger raised without `USING ERRCODE` would be P0001 and would land in the throw.** That is
deliberate and it is the cost: the failure arrives at the change that added the trigger, loudly and
with the code in it, rather than months later as a wrong constraint name. Widening the class is the
wrong repair; giving the trigger an errcode, as all nine existing ones have, is the right one.

`docker-compose.yml`'s note that too many clients "surfaces as an unrelated test failing in
whichever suite asked last rather than as anything naming the limit" is corrected beside itself by
this change, for writes made through `refusal`, and its 100-connection peak is marked as
`pnpm test:e2e`'s rather than `pnpm test`'s.

[[0159-a-database-rule-earns-a-test-when-a-write-can-reach-it]] is the criterion for WHICH rules earn
a test in `constraints.test.ts`; this is about what the answer to one of them may be taken to mean.
[[0104-one-container-a-database-per-worktree]] is the arrangement that makes the machine a variable
in the first place.
