---
status: proposed
---

# A check is evidence only for the commit it ran against

[[0118-mains-history-is-append-only-and-ci-is-not-a-merge-gate]] measured that this repository has
no required checks: a ruleset refuses deletion and force-push on `main`, and nothing at GitHub's
level refuses a merge. **So the merge gate is entirely the dispatcher's**, and a gate that reads the
wrong commit is no gate.

A pull request that is rebased and force-pushed goes on displaying the PREVIOUS head's check
results. `gh pr checks` reports them without naming the commit they belong to, so the pull request
reads green while no CI has run on the code that would actually merge.

## It was measured twice, one day apart

**PR #210, 2026-09-20.** The branch was rebased onto CNCORE-282's and force-pushed:

```
22:06:44  head_ref_force_pushed             head becomes 439cc3c
22:06:44 .. 22:10:49                        NO run against 439cc3c, for 4m05s
          gh pr checks                      pending=0 failing=0, from 48f1083 (pre-rebase)
22:10:49  run 35540856561  pull_request     439cc3c   -> cancelled
22:11:05  closed / 22:11:06 reopened        which starts a fresh run
22:11:08  run 35540874520  pull_request     439cc3c   -> success
22:16:38  merged
```

The gate counted pending and failing checks and would have passed it. Six merges had already gone
through that gate; all six were verified green on `main` afterwards, so nothing broke.

**PR #221, 2026-09-21, by a dispatcher who had already read the ticket.** Its head `3c28ae5` got a
run at 00:11:01. **The merge went in at 00:11:39 and that run finished at 00:15:21** — three minutes
and forty-two seconds after the evidence was acted on. One check-run had completed at the moment of
merge; the other fifteen had not. It went green, so again nothing broke.

**Nothing breaking is what makes this invisible.** Both merges look correct in hindsight, and in
both the gate answered from something other than the commit it was asked about.

## The tell is zero, and zero has no timestamp on it

`.claude/rules/workflows.md` already carried **AN ABSENT CHECK IS THE TELL, NOT A RED ONE**, written
for a CONFLICTED pull request: a `pull_request` workflow runs against `refs/pull/N/merge`, which
GitHub cannot build while the branch conflicts, so it creates no run rather than a failing one.

The rebase case is the same tell with a different cause, and worse in two ways. The pull request
shows an OLDER run rather than nothing, so the absence presents as a pass. And **the two zeros are
indistinguishable at the instant you look**: a commit pushed seconds ago and a commit whose branch
conflicts both answer with no check-runs. The first clears by waiting and the second never does.

That ambiguity is not hypothetical — it is what #221 was. A dispatcher holding the conflicted-PR
gotcha met the not-yet case, read "not yet", and merged. **Knowing the rule was not the mechanism.**

## The decision

**A check is evidence only for the commit it ran against.** The gate resolves the pull request's
head and queries THAT commit's check-runs, never the pull request's rollup.

**Zero blocks, and says which zero it is.** `mergeStateStatus` is read on the call that already
resolves the head: `DIRTY` means the branch conflicts and no run will ever come, so merge `main` and
it fires; anything else means none has come YET, so re-check. Both refuse the merge. Only the
remedy differs, and a gate that leaves that to be inferred gets it inferred wrong under time
pressure.

**Each outcome is named distinctly rather than folded into "red".** `NO-RUN`, `RUNNING`, `FAILED`,
`SUPERSEDED`, `UNREADABLE`, `PASSED`. `cancelled` is `SUPERSEDED` and not a defect: `ci.yml` sets
`cancel-in-progress` on a group keyed by the head ref ([[0111-ci-optimises-billed-minutes-over-named-checks]]),
so every force-push leaves a trail of cancelled runs — #210's head carries THIRTEEN of them beside
nineteen that ran to an answer (18 `success`, 1 `skipped`, counted 2026-09-21). Reading those as
failures produced a false "genuine breakage" claim on 2026-09-20. It still BLOCKS when nothing else ran: a commit whose only runs were killed has no more
evidence behind it than one with none.

**The gate and the merge are one command.** The gate was being run as `gate.sh <pr> | tail -2 &&
gh pr merge`, and a pipeline's exit status is the LAST command's — `tail` always succeeds, so the
guard printed `BLOCKED` and the merge ran anyway. Separating "show me" from "decide" is what made
that possible.

## It lives in the repository because machine state is not repo state

The working gate existed, in the dispatcher's scratch directory, before this record did. `CLAUDE.md`
already rules on that: *"Machine state is not repo state. A tool the build or the tests reach for
belongs in the manifests CI and a fresh clone read, never only on this Mac: that gap is silent here
and surfaces as a broken clone nobody is watching."*

A merge gate is exactly such a tool, and it had no test, no review and no reader but its author.
**A landed copy that is not the one actually run is that same gap with a file in git to make it look
closed**, which is why the gate and the fused merge command landed together and the scratch pair is
retired rather than left beside them.

## The rebase DID trigger a run, which the ticket doubted

CNCORE-288 asked whether a rebase triggers a run here at all, "which may be a workflow trigger gap
rather than a timing one". Measured on #210: it is a **timing** gap. `ci.yml` declares a bare
`on: pull_request`, whose default types include `synchronize`, and the force-push at 22:06:44 did
produce a run — four minutes and five seconds later. Nothing in the workflow needs widening.

**Four minutes is the finding.** A dispatcher who polls once and moves on reads zero and concludes
"never", which is the misreading this record's second outcome exists to refuse.

## Thirty is the page, and thirty-two was the answer

Found by running the gate against a real pull request rather than against its fixtures, which is why
it is here: `/commits/<sha>/check-runs` serves **30 per page by default**, and #210's head holds 32.
The first real run reported `PASSED 439cc3c 19 of 30` over a commit with 32 check-runs on it, and
the true size was sitting in a `total_count` field nothing was reading.

**That is this record's own defect one level down** — a partial read presenting as a complete one —
so it is refused the same way. The read is `--paginate --slurp` with `per_page=100`, and the merged
count is held against `total_count`: short means `UNREADABLE`, not a verdict. A failure on page two
was a failure the gate passed.

**`--slurp` cannot be combined with `--jq`** (gh 2.97.0 refuses it outright), which is why this gate
hands raw JSON to a parser rather than asking `gh` to filter.

## What this does not cover

Nothing makes the dispatcher RUN the gate. There are no required checks (ADR-0118) and no required
review, so this is a convention with a mechanism behind it rather than an enforced gate, exactly as
that record says. The gate also asks nothing about whether the checks that ran are the RIGHT set: a
workflow file that fails to parse creates no run at all, which arrives here as `NO-RUN` with a
`mergeStateStatus` that is not `DIRTY` — correctly blocking, and attributed to the wrong cause.
`actionlint` before pushing is still what catches that, and `.claude/rules/workflows.md` still says
so.

## As built, under CNCORE-288

**BUILT: the gate, the fused merge command, and the rule at the three places a dispatcher reads.**
`.claude/skills/dispatch/gate.sh` resolves `headRefOid` and `mergeStateStatus` in one
`gh pr view`, queries `repos/<slug>/commits/<head>/check-runs`, and exits non-zero on every outcome
but `PASSED`. `.claude/skills/dispatch/merge-if-green.sh` runs it and merges only on its exit
status, with nothing piped, and refuses a named worktree that is unreadable or holds uncommitted
work. `packages/config/src/merge-gate.test.ts` drives both through a stubbed `gh` over ten
scenarios, including #210's own world — the head with no runs beside the pre-rebase commit's green.
The rule is stated in `.claude/skills/dispatch/SKILL.md`, `.claude/rules/workflows.md` and
`CLAUDE.md`.

**NOT BUILT: adoption.** At the time of writing, the dispatcher's scratch copies still exist and are
what its merges actually run; the repository's copy becomes the one in force when they are retired
against this branch's merge. Until that happens this record describes a gate that is whole and not
yet the one in use, which is the distinction `CLAUDE.md` reserves `proposed` for. Flip this record
to `accepted` in the same action as retiring the scratch pair.
