---
status: accepted
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
`SUPERSEDED`, `KILLED`, `UNREADABLE`, `PASSED`. `cancelled` is `SUPERSEDED` and not a defect **when
something re-ran it** — the qualifier is the section below, added 2026-09-23, and without it this
sentence passed a suite that hung. `ci.yml` sets
`cancel-in-progress` on a group keyed by the head ref ([[0111-ci-optimises-billed-minutes-over-named-checks]]),
so every force-push leaves a trail of cancelled runs — #210's head carries THIRTEEN of them beside
nineteen that ran to an answer (18 `success`, 1 `skipped`, counted 2026-09-21), **and every one of
the thirteen was re-run by name within a minute, which is what makes them evidence of nothing rather
than evidence of breakage**. Reading them as
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

Four things measured with gh 2.97.0 on 2026-09-21 hold it in place:

- **The exit status is the verdict, not the output.** A ref GitHub has not got answers 404 with its
  JSON body on STDOUT, `--jq` or not. A gate reading the output alone would compare
  `{"message":"Not Found",...}` with the head and report `LAGGING` behind a commit named `{"messa`.
- **The singular `git/ref` endpoint answers only the exact ref.** Asked for a prefix of CNCORE-319's
  own branch name, or for the `jacobdrees` directory the dispatched branches sit under, it answered
  404 rather than a longer branch.
- **A slash goes into the path as it is.** `heads/jacobdrees/cncore-319` needed no encoding.
- **Other characters git permits do not, so the name's shape is checked before the request.** The
  branch name is not the dispatcher's to type, the way the repository name is: it is whatever the
  author called the branch, and on a public repository that can be a stranger's fork. Git permits
  names that make this request ask about a DIFFERENT ref. `gh` fills `{branch}` with the caller's
  own checked-out branch and drops everything from `#`, and GitHub resolves an encoded `..`, so
  `x/%2e%2e/main` answered with `main`'s tip. The gate refuses as `UNREADABLE`, before asking,
  anything outside letters, digits, `.`, `_`, `/` and `-`, and any segment that starts with a dot.
  All 309 distinct branch names across the three repositories that day, standing or named by a pull
  request (`gh api .../branches` and `gh pr list --state all`), fit that shape. This ticket's own
  review found it: the unauthenticated read took the name as a ref argument, not as a URL path.

**What is NOT measured is whether this source leads the pull request's field inside the
force-push window** the way `ls-remote` did in the measurement above. CNCORE-319 pushed its own
branch twice, the second a force-push, and read `ls-remote`, this endpoint and `headRefOid` back to
back in twelve rounds over fourteen seconds after each: all three agreed from the first round, so
the window did not recur to be measured. The endpoint reads the branch's ref rather than the pull
request, which is the property the check needs; it has not yet been caught leading one.

`merge-gate.test.ts` holds it with #30's own world: a private repository whose stubbed `git`
answers `ls-remote` the way provider-tmdb's did and whose stubbed `gh` answers normally, and a green
head that must read `PASSED`. A second row gives the branch no ref at all, and must read
`UNREADABLE` rather than `LAGGING`. A third hands the gate each of the three names above, and must
see no ref asked for.

## What this does not cover

Nothing makes the dispatcher RUN the gate. There are no required checks (ADR-0118) and no required
review, so this is a convention with a mechanism behind it rather than an enforced gate, exactly as
that record says. The gate also asks nothing about whether the checks that ran are the RIGHT set.
`.claude/rules/workflows.md` records that a workflow file which fails to parse creates no run at
all; on that measurement it arrives here as `NO-RUN` against a `mergeStateStatus` that is not
`DIRTY` — correctly blocking, and attributed to the wrong cause. That attribution is the limit, not
the blocking. `actionlint` before pushing is still what catches it.

## A JOB KILLED BY ITS OWN CEILING READS AS PASSED, AND THE MISSING RE-RUN IS WHAT CATCHES IT

**Measured 2026-09-21 under CNCORE-341**, on a probe branch pushed to this repository and deleted
after reading — run `35617974088`:

| Job | Conclusion |
|---|---|
| A job that hit `timeout-minutes: 1` on a `sleep 300` | **`cancelled`** |
| A job whose `needs:` job was killed that way | **`skipped`** |
| A STEP that hit its own `timeout-minutes: 1` | **`failure`** |
| **the run itself** | **`failure`** |

**So ADR-0141's ceiling and this record's tolerance of `cancelled` compose into a hole.** That
record gives every job a ceiling at three times its slowest measured run, so that a hung job is
killed rather than holding a pull request for six hours. It IS killed. It then concludes `cancelled`
— which the section above tolerates by name and for a good reason, because `cancel-in-progress`
leaves a trail of cancelled runs on every force-push and reading those as failures produced a false
breakage claim on 2026-09-20. Its dependent concludes `skipped`, which is in the good set. **Every
check-run on the commit is then either good or tolerated, and the gate said `PASSED` over a suite
that hung** — from this record's own landing on 2026-09-21 until CNCORE-342 closed it on 2026-09-23.
**Nothing merged through the hole in those two days, and that is measured rather than assumed:** of
the 362 merged pull requests across this repository and both providers, exactly one head carries a
cancelled check-run at all — #210's, where every one of the thirteen was re-run (swept 2026-09-22).

**`timed_out` is not the value to look for, and that is the trap.** The good set is refused by name
above and `timed_out` sits in the BAD set — but nothing in Actions was observed to emit it. No job
in the probe run reported it, and no job in this repository's history ever has. GitHub's own
documentation never states the conclusion a ceiling produces: its workflow syntax says
`timeout-minutes` is the maximum "before GitHub automatically **cancels** it", while its limits page
says a job reaching the six-hour limit "is terminated and **fails**". **Two GitHub pages, two
answers, so this record cites the measurement rather than either of them.** Nor is the RUN's
`failure` the value to look for, which took a second measurement to see: below.

### THE RUN'S CONCLUSION IS NOT THE REMEDY, AND THIS RECORD SAID IT WAS

The paragraph that stood here until 2026-09-23 read: *"A hang concludes `failure` at the run; a
supersession concludes `cancelled` … refuse a commit whose RUN concluded `failure`, whatever its
individual check-runs say."* **It is wrong, and CNCORE-342 built it before measuring it.** The
table it rested on compared the probe above against three superseded runs:

| Case | Run conclusion | Cancelled jobs |
|---|---|---|
| The probe (`35617974088`) | **`failure`** | 1 |
| Superseded by a newer push (`35603659236`) | **`cancelled`** | 7 |
| Superseded (`35566260535`) | **`cancelled`** | 15 |
| Superseded (`35566183448`) | **`cancelled`** | 7 |

**The probe's run failed because a job in it FAILED.** Its `step_level_timeout` job concluded
`failure`, which the table above this one records and §10.1.2 of the research states as a rule —
a step-level expiry reports `failure`, a job-level one `cancelled`. Attributing that run's
conclusion to the job-level ceiling beside it was the error, and no measurement in either document
isolated the two.

**A JOB-LEVEL HANG ALONE CONCLUDES `cancelled` AT THE RUN**, which
[[0141-every-ci-job-stops-at-three-times-its-slowest-measured-run]] had already measured and
written down under "The hang, demonstrated": run `35454181160` on `38fde90`, a `sleep 86400` after
a passing suite, the job cut at its eight-minute ceiling, every other job green. Re-read from the
API on 2026-09-22: run conclusion **`cancelled`**, jobs 14 `success`, 1 `skipped`, 1 `cancelled`.
That record says it in as many words — *"the job, its check run and the whole workflow run all read
`cancelled`: the same conclusion a person cancelling produces, and the one a run superseded under
the concurrency key gets"*. **So the run's conclusion cannot separate a hang from a supersession,
and a gate built on it would have passed `38fde90` — which it did, in the first implementation of
CNCORE-342, before this was measured.** Across all 84 runs in this repository's history that
concluded `failure`, none did so with no failed job, so that check would also have been close to a
no-op.

### WHAT SEPARATES THEM IS THE RE-RUN, AND IT IS ALREADY ON THE COMMIT

**A supersession re-runs the job it killed; a ceiling does not.** `cancel-in-progress` kills the
old run because a NEWER run for the same ref has started, and that newer run repeats every job — so
each cancelled check-run is followed on the same commit by one of the SAME NAME that answered.
#210's head carries thirteen cancelled check-runs and thirteen matching answers, each within a
minute of its kill (`One image, both architectures` cancelled at 22:11:13, `skipped` at 22:13:21,
which is an answer too). A job killed by ADR-0141's ceiling has no successor at all: nothing
re-ran it, and its `needs:` dependents read `skipped`.

**So `cancelled` stays tolerated and the gate asks a second question: was it re-run?** A cancelled
check-run with no later check-run of its name that concluded `success`, `skipped` or `neutral` is
`BLOCKED KILLED`, named for what happened to the job rather than for the conclusion it carries.
Not tolerating `cancelled` at all would block every force-push and reinstate the defect of
2026-09-20; reading the run's conclusion would catch nothing.

**It needs no extra API call.** `started_at` is already on every check-run in the read this gate
was making, which is what makes "later" answerable at all.

**Three real commits, through the gate, 2026-09-22:**

```
38fde90  BLOCKED KILLED 38fde90 1 of 16 cancelled with nothing re-running it: The page over HTTP
439cc3c  PASSED 439cc3c 19 of 32 checks passed on this commit          #210's force-push trail
3e80458  BLOCKED FAILED 3e80458 step_level_timeout (failure)           the probe, on the failed job
```

The probe reads `FAILED` rather than `KILLED` because its step-level job failed and that outcome
comes first — the precedence is deliberate: a failure names the check that failed.

**And the rule refuses nothing that has merged.** Applied to the head of EVERY merged pull request
in CanonCore, provider-tmdb and provider-wiki — 362 of them, 2026-09-22 — it blocks none. One head
carries cancelled check-runs at all, #210's, and every one of those was re-run.

**GitHub's own rollup agrees, and is not what the gate reads.** `statusCheckRollup` on the commit
answered `FAILURE` for `38fde90` and `SUCCESS` for `439cc3c` (GraphQL, 2026-09-22) — the same split,
from a field whose rules GitHub does not document and which this record already refuses to resolve a
head from.

## As built, under CNCORE-288

**BUILT: the gate, the fused merge command, and the rule at the three places a dispatcher reads.**
The `dispatch` skill's `gate.sh` resolves `headRefOid`, `headRefName`, `mergeStateStatus` and
`state` in one `gh pr view`, confirms that head against the branch's own ref (by `git ls-remote` as
built here, by an authenticated `gh api` since CNCORE-319, above), reads
`repos/<slug>/commits/<head>/check-runs` across every page and holds the result against
`total_count`, and exits non-zero on every outcome but `PASSED`. Its outcomes are `PASSED`,
`NO-RUN`, `RUNNING`, `FAILED`, `UNKNOWN-CONCLUSION`, `SUPERSEDED`, `KILLED` (since CNCORE-342),
`LAGGING`, `DRAFT`, `MERGED`/`CLOSED` and `UNREADABLE`.
Its `merge-if-green.sh` runs it and merges only on its exit status, with nothing
piped, and refuses a named worktree that is unreadable, is not the root of its repository, or holds
uncommitted or unpushed work.
The `dispatch` skill's `merge-gate.test.ts` drives both through a stubbed `gh` and `git` over
twenty-eight scenarios, as `npm test` counts them on 2026-09-23 (twenty-five before CNCORE-342 added
three), including #210's own
world — the head with no runs beside the pre-rebase commit's green.
The rule is stated in the `dispatch` skill's `SKILL.md`, `.claude/rules/workflows.md` and
`CLAUDE.md`.

**BUILT: adoption, and this record was owed its flip before it got one.** The dispatcher retired the
scratch pair on 2026-09-21 against CNCORE-288's merge and did not flip this record in the same
action, as the paragraph this replaces asked. It stood `proposed` for the rest of that day,
describing a gate as not yet in use while the repository's was the only one in use; CNCORE-328
flipped it. A status is evidence only for the moment it was written, which is this record's own
subject in a second medium.

**BUILT, UNDER CNCORE-342: the hang, refused — and not by the remedy this record specified.** The
gate reads no workflow run. It asks whether each cancelled check-run has a later check-run of its
own name that answered, blocks as `KILLED` when one has none, and `merge-gate.test.ts` holds three
worlds for it: ADR-0141's hang, #210's trail with all thirteen re-runs, and a kill that lands after
a green. The run-level read this record asked for was built first and deleted after measurement,
which is recorded above rather than quietly dropped. `jacobdrees/claude-skills` **#5**, merged
2026-09-23; `gate.sh` and its suite live there since 2026-09-22, and `~/.claude/skills` was pulled
in the same action, since until that pull a merged gate is not the one any agent runs.

**NOT RETIRED, AND FOUND BY CNCORE-328 RATHER THAN ASSERTED: one scratch gate outlived the pair.**
No `gate.py` and no scratch `merge-if-green.sh` survive anywhere, so nothing in scratch can MERGE
any more and the repository's fused command is the only one. But a 28-line `gate.sh` was still in a
dispatcher scratchpad on 2026-09-21, last written 2026-09-20 23:13, before this record existed, and
it is a generation older than everything decided above: it reads `check_runs` without
`total_count` or `per_page`, so page two is invisible to it; it asks for no `mergeStateStatus`, so
it cannot say which zero it met; it never confirms the head against the branch's own ref; it does
not know a draft; and it names `failure` as the bad set and lets every other conclusion past, which
is the third hat this record refuses by name. Swept with `find /private/tmp/claude-501 -name
'gate.sh' -o -name 'gate.py' -o -name 'merge-if-green.sh'`, which also returns the repository's own
copy inside three worktree checkouts; the population is every scratchpad on this Mac, and the
command retakes it. **A stale gate that can still be invoked is this record's defect wearing its
last hat**, so the file is named here rather than left for whoever runs it next.
