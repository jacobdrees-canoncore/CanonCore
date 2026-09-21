---
status: accepted
---

# A refusal names a rule, never a condition of the server

> **ACCEPTED 2026-09-21, whole, in one repository.** `refusal` in
> `packages/db/src/testing/catalogue.ts` answers for SQLSTATE class 23 and throws for every other
> class, naming the SQLSTATE it actually met. `packages/db/src/testing/refusal.test.ts` asserts the
> distinction against errors the server itself produced -- a cancelled statement (57014) and an
> unreachable server (ECONNREFUSED) throw, a CHECK (23514) and a FOREIGN KEY (23503) answer with
> their constraint names -- and the first of those was checked RED first, resolving
> `'canceling statement due to statement timeout'` where the caller reads a constraint's name. All
> 43 existing calls to `refusal`, across `constraints.test.ts`, `import.test.ts` and
> `import-runs.test.ts`, still pass: 132 tests. No provider repository is touched, so nothing is
> owed at a second one.

## What happened

CNCORE-280 filed a single test, `constraints.test.ts > items > refuses a kind that is not one of
the seven`, that failed once under a concurrent `pnpm test` and passed three times afterwards. The
run's output was consumed before it was saved, so the assertion message was never captured.

Four mechanisms were measured and refused on 2026-09-21, in this worktree:

- **The connection ceiling is not it.** `pg_stat_activity` was sampled every 0.5s through a whole
  green `pnpm test`: it peaks at **13** connections of the 300 `docker-compose.yml` grants. Four
  worktrees' worth of that would be about 52. `sorry, too many clients already` is a real failure of this
  container, but it belongs to `pnpm test:e2e`'s ten servers, not to `pnpm test`.
- **The dead-database sweep is not it.** `sweepDeadDatabases` never drops a database younger than
  `GRACE_SECONDS`, an hour, and never uses `with (force)`. A suite database is seconds old.
- **A second run of the same suite is not it.** Two `pnpm exec vitest run` against one worktree were
  run deliberately, so that the second's `drop database ... with (force)` landed under the first.
  That fails **46** tests with 42P01, a whole file at a time. It is loud; the flake was one test.
- **Within-suite ordering was already refused by the filer:** `fileParallelism: false` and
  `StableSequencer` fix the order, and the suite alone passes.

## What the flake could not have told anybody

`refusal` walked an error to the first level carrying a SQLSTATE and answered with its `message`
when it carried no constraint name. That branch exists for a good reason -- a trigger's
`RAISE EXCEPTION` carries a sentence and no constraint -- but it does not ask WHICH SQLSTATE, and
every error PostgreSQL raises has one. A server that could not RUN the statement therefore came
back in the position where the caller reads the name of the rule that bit.

Measured here rather than reasoned about: under `statement_timeout = 1`, `refusal` answered
`"canceling statement due to statement timeout"`. The assertion then prints

```
expected 'canceling statement due to statement timeout' to be 'items_kind_item_kinds_kind_fk'
```

which reads as a broken rule about kinds and is in fact a loaded machine. **Every suite in every worktree
shares one server** ([[0104-one-container-a-database-per-worktree]]), so this class of answer moves
with what the rest of the machine is doing -- and running the suite alone cannot disagree, because
alone is the condition in which the server always serves.

## The decision

A refusal is **SQLSTATE class 23**, integrity constraint violation, and nothing else. `refusal`
answers with the constraint's name, or with a trigger's sentence when there is no name; for any
other class it throws, naming the SQLSTATE and the server's own message and saying that this is a
condition of the server rather than a rule of the schema.

The class is measured, not chosen: all 43 call sites were instrumented and every one answered
23503, 23505 or 23514, because all nine `RAISE EXCEPTION`s in `packages/db/src/migrations/` carry
`USING ERRCODE = 'check_violation'`. A CLASS rather than a list of those three codes, because the
next member is a new kind of RULE rather than a new kind of answer.

## What this buys, and what it does not

It does not stop the flake. It makes the next occurrence **name itself**: a test that cannot reach
its assertion says which SQLSTATE stopped it, instead of asserting that a constraint is wrong. A
flake nobody can read is one nobody can fix, and this one had already cost a ticket.

It does not cover the suites that do not use `refusal`. A test asserting on a query's RESULT rather
than on its refusal still reads a server condition as a product defect, and nothing here changes
that.

**A trigger raised without `USING ERRCODE` would be P0001 and would land in the throw.** That is
deliberate and it is the cost: the failure arrives at the change that added the trigger, loudly and
with the SQLSTATE in it, rather than months later as a wrong constraint name. Widening the class is
the wrong repair; giving the trigger an errcode, as all nine existing ones have, is the right one.

`docker-compose.yml`'s note that too many clients "surfaces as an unrelated test failing in
whichever suite asked last rather than as anything naming the limit" is corrected beside itself by
this change, for writes made through `refusal`.

[[0159-a-database-rule-earns-a-test-when-a-write-can-reach-it]] is the criterion for WHICH rules
earn a test here; this is about what the answer to one of those tests may mean.
