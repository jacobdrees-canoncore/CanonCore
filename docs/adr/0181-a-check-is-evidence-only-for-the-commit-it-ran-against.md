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
and forty-two seconds after the evidence was acted on. THREE of its sixteen check-runs had completed
at the moment of merge (00:11:24, 00:11:32, 00:11:36); the other thirteen had not. It went green, so
again nothing broke.

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

**A conclusion the gate does not know is absent evidence, not good evidence.** The good set is
the closed one — `success`, `skipped`, `neutral` — and anything else is refused by name. Listing the
BAD conclusions and letting the rest past is this defect wearing a third hat: `stale` is a
documented check-run conclusion that **only GitHub sets** ("You cannot change a check run conclusion
to stale, only GitHub can set this", REST docs read 2026-09-21), so it arrives without this
repository doing anything, and beside one `success` it read `PASSED`. Inverting the test is what
survives GitHub adding a value, which is the only assumption worth making about somebody else's
enum.

**Each outcome is named distinctly rather than folded into "red".** `NO-RUN`, `RUNNING`, `FAILED`,
`SUPERSEDED`, `UNREADABLE`, `PASSED`. `cancelled` is `SUPERSEDED` and not a defect: `ci.yml` sets
`cancel-in-progress` on a group keyed by the head ref ([[0111-ci-optimises-billed-minutes-over-named-checks]]),
so every force-push leaves a trail of cancelled runs — #210's head carries THIRTEEN of them beside
nineteen that ran to an answer (18 `success`, 1 `skipped`, counted 2026-09-21). Reading those as
failures produced a false "genuine breakage" claim on 2026-09-20. It still BLOCKS when nothing else ran: a commit whose only runs were killed has no more
evidence behind it than one with none.

**The gate and the merge are one command.** The scratch gate was being run as
`gate.py <pr> | tail -2 && gh pr merge`, and a pipeline's exit status is the LAST command's — `tail` always succeeds, so the
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

## The pull request's own head field lags a force-push

Resolving `headRefOid` is necessary and it is not sufficient, which this branch found by doing it.
Seconds after rebasing and force-pushing CNCORE-288's own branch on 2026-09-21:

```
local HEAD           bd47ff6
git ls-remote        bd47ff6      the branch, already moved
gh pr view #228      06e1936      the PULL REQUEST, still on the pre-rebase commit
gate said            BLOCKED RUNNING 06e1936 ...
```

The gate gave a verdict about a commit that was **no longer on the branch**, which is this record's
own defect committed by the gate that refuses it. Both sources agreed a moment later.

**So the head is confirmed against a second source**: the branch's own ref, read AUTHENTICATED
through `gh api repos/<slug>/git/ref/heads/<branch>`. It was first an unauthenticated `git ls-remote`
on the repository's public HTTPS URL, which is what was correct in the measurement and cannot see
a private repository at all (below). The two disagreeing is not a verdict
either way. It means the question was asked inside the window where GitHub has the push and the
pull request does not, and the honest answer is `LAGGING`: refuse, and look again.

**A closed pull request is named as closed** for the same reason. `--delete-branch` takes the head
ref away with the merge, so the tip check finds no ref and would report a missing branch — a
symptom, phrased as though something were broken, at a dispatcher who would then go looking for it.
Observed on #210 and #221 the moment the tip check landed.

## A draft answers every question but the one being asked

Found by the dispatcher running this gate against real pull requests on 2026-09-21, which is the
check `CLAUDE.md` asks for before a figure travels, applied to a mechanism.

```
#230    isDraft            true
        state              OPEN
        mergeStateStatus   CLEAN
        check-runs         16 of 16 green
        this gate said     PASSED b409673 16 of 16 checks passed on this commit
```

**Nothing else on the pull request reveals it.** A draft is open, its branch is clean, and its CI is
as green as any other's, so every field this gate already read called it mergeable. The fused merge
command would have taken another agent's unfinished work while it was still writing it.

**It is one more field on a `gh pr view` already being made** — the same trade as reading
`mergeStateStatus` to say which zero. `monitor.sh` beside this gate already treats draft as not
ready, firing its `READY` line only on `isDraft==false`, so the gate was the one step in the loop
that did not know. `BLOCKED DRAFT`, named like the rest.

## The second source has to be authenticated

Found on the first provider pull request the gate met, 2026-09-21. provider-tmdb#30's branch
`jacobdrees/cncore-304` existed, with head `bd37c17`, and the gate said:

```
BLOCKED UNREADABLE cannot read refs/heads/jacobdrees/cncore-304 in jacobdrees-canoncore/provider-tmdb
```

**GitHub answers an unauthenticated read of a private repository as though the repository did not
exist**, rather than with a refusal: `git ls-remote` on provider-tmdb's HTTPS URL printed
`remote: Repository not found.` and exited 128. CanonCore is the one PUBLIC repository in the
organisation, and provider-tmdb and provider-wiki are both PRIVATE (`gh repo list`, 2026-09-21), so
the gate could never pass a pull request in either provider. Every pull request it met before
landing was CanonCore's, and so was every world in its test, which is how the one shape it breaks
on went unseen. It failed safe, refusing rather than merging, but a refusal that reads like a
genuinely missing branch sends its reader looking for the wrong thing.

**The dispatcher merged #30 by hand, asking each of the gate's questions through `gh`**: the tip
from `gh api .../git/ref/heads/<branch>` against `headRefOid`, the check-runs paginated against
`total_count`, and draft, state and `mergeStateStatus`. All passed. That is the proof the
authenticated route answers for a private repository, and it is the route the gate now takes.
**Every question the gate asks goes through the one authenticated client**, so no repository is
visible to some of its checks and invisible to others.

Three things measured with gh 2.97.0 on 2026-09-21 hold it in place:

- **The exit status is the verdict, not the output.** A ref GitHub has not got answers 404 with its
  JSON body on STDOUT, `--jq` or not. A gate reading the output alone would compare
  `{"message":"Not Found",...}` with the head and report `LAGGING` behind a commit named `{"messa`.
- **The singular `git/ref` endpoint answers only the exact ref.** Asked for a prefix of CNCORE-319's
  own branch name, it answered 404 rather than the longer branch.
- **A branch name with a slash goes into the path as it is.** `heads/jacobdrees/cncore-319` needed
  no encoding.

**What is NOT measured is whether this source leads the pull request's field inside the
force-push window** the way `ls-remote` did in the measurement above. CNCORE-319 pushed its own
branch twice, the second a force-push, and read `ls-remote`, this endpoint and `headRefOid` back to
back in twelve rounds over fourteen seconds after each: all three agreed from the first round, so
the window did not recur to be measured. The endpoint reads the branch's ref rather than the pull
request, which is the property the check needs; it has not yet been caught leading one.

`merge-gate.test.ts` holds it with #30's own world: a private repository whose stubbed `git`
answers `ls-remote` the way provider-tmdb's did and whose stubbed `gh` answers normally, and a green
head that must read `PASSED`. A second row gives the branch no ref at all, and must read
`UNREADABLE` rather than `LAGGING`.

## What this does not cover

Nothing makes the dispatcher RUN the gate. There are no required checks (ADR-0118) and no required
review, so this is a convention with a mechanism behind it rather than an enforced gate, exactly as
that record says. The gate also asks nothing about whether the checks that ran are the RIGHT set.
`.claude/rules/workflows.md` records that a workflow file which fails to parse creates no run at
all; on that measurement it arrives here as `NO-RUN` against a `mergeStateStatus` that is not
`DIRTY` — correctly blocking, and attributed to the wrong cause. That attribution is the limit, not
the blocking. `actionlint` before pushing is still what catches it.

## As built, under CNCORE-288

**BUILT: the gate, the fused merge command, and the rule at the three places a dispatcher reads.**
`.claude/skills/dispatch/gate.sh` resolves `headRefOid`, `headRefName`, `mergeStateStatus` and
`state` in one `gh pr view`, confirms that head against the branch's own ref (by `git ls-remote` as
built here, by an authenticated `gh api` since CNCORE-319, above), reads
`repos/<slug>/commits/<head>/check-runs` across every page and holds the result against
`total_count`, and exits non-zero on every outcome but `PASSED`. Its outcomes are `PASSED`,
`NO-RUN`, `RUNNING`, `FAILED`, `UNKNOWN-CONCLUSION`, `SUPERSEDED`, `LAGGING`, `DRAFT`,
`MERGED`/`CLOSED` and `UNREADABLE`.
`.claude/skills/dispatch/merge-if-green.sh` runs it and merges only on its exit status, with nothing
piped, and refuses a named worktree that is unreadable, is not the root of its repository, or holds
uncommitted or unpushed work.
`packages/config/src/merge-gate.test.ts` drives both through a stubbed `gh` and `git` over
twenty-three scenarios (twenty-one as built here, and CNCORE-319's two), including #210's own world — the head with no runs beside the pre-rebase commit's green.
The rule is stated in `.claude/skills/dispatch/SKILL.md`, `.claude/rules/workflows.md` and
`CLAUDE.md`.

**NOT BUILT: adoption.** At the time of writing, the dispatcher's scratch copies still exist and are
what its merges actually run; the repository's copy becomes the one in force when they are retired
against this branch's merge. Until that happens this record describes a gate that is whole and not
yet the one in use, which is the distinction `CLAUDE.md` reserves `proposed` for. Flip this record
to `accepted` in the same action as retiring the scratch pair.
