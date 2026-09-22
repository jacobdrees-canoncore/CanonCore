# Path filters, and what a skipped job is evidence of

**Researched 2026-09-21**, for CNCORE-341.

CNCORE-341 asks whether this pipeline should stop running all sixteen jobs on every push, and it
identifies its own harder half correctly: `.claude/skills/dispatch/gate.sh` counts a `skipped` job
as evidence of passing, and path filters would make that line load-bearing.

**The question has been asked and answered before.** `ci-and-repo-standards.md`, 2026-09-11, put it
under "Path filters: suspect here, and the brief is right to say so", and its decision list carried
it as entry 5 — *"Do not add path filters, and write down why"* — **decided the same day, as
proposed.**

ADR-0111 names the rejection under "No per-run guard on the boundary", and deliberately keeps only
the name: the reasoning is *"recorded in the research rather than here so `docs/adr/` does not
become a CI changelog"*. **So the research note IS the home of this decision's argument**, which is
why the re-test belongs in one too.

So this note is not a fresh survey of a fresh question. It is a **re-test of a standing decision
against what has changed since**, plus an answer to the one thing CNCORE-341 raises that did not
exist on 2026-09-11: the merge gate. `gate.sh` was written on 2026-09-21 under ADR-0181. The
2026-09-11 pass could not have considered it.

It proposes. It decides nothing — the ADRs are Jacob's to write, and nothing here is one.

## How to read this

Section 0 is the answer. Section 1 is what changed since the standing decision and whether it
survives. Section 2 re-measures the ticket's own figures. Section 3 carries three sentences in the
ticket that measurement refuses, each corrected where it stands. Sections 4 to 6 price the three
things an optimisation could buy, and find two of them worth nothing here. Section 7 is the gate,
which is the part worth reading if you read only one. Section 8 is what would be lost. Section 9 is
the recommendation, and section 10 is what it does not decide.

---

## 0. The short answer

**Edit no workflow, and change no line of `gate.sh`.** Every lever CNCORE-341 reaches for is
either already pulled, worth nothing here, or refused by a decision that still holds.

| The lever | Verdict | Why |
|---|---|---|
| `concurrency` with `cancel-in-progress` | **Already there** | `ci.yml` has carried it since ADR-0111. Not a proposal. |
| Skip jobs to save COMPUTE | **Worth exactly zero** | Standard runners are free in a public repository. ADR-0111 records this in GitHub's own words, and `ci.yml` restates it twice in its own comments. |
| Skip jobs to save RUNNER CONTENTION | **Binds, and costs ≤50s** | The GitHub Free cap is 20 concurrent jobs and this repository was measured hitting exactly 20. But of 325 sampled jobs, median wait **4s**, p90 **7s**, worst **50s**. The queue drains faster than a mechanism would be worth. |
| Skip jobs to save LATENCY | **The only real currency, and the prize is ~8.5 min per ten days** | Only 6 of the last 80 merges were prose-only, and a correctly filtered prose PR still takes 2.6 of its 4.0 min. |
| Workflow-level `paths:` | **Refused, and it would break the gate** | It produces NO check runs, and `gate.sh` answers `BLOCKED NO-RUN`. A docs-only PR would become unmergeable by the gate rather than fast. |
| Remove `skipped` from `gate.sh`'s `GOOD` set | **Would break every PR today** | Measured: every pull request already carries exactly one `skipped` check run. |

**The gate needs no repair for `skipped`.** That set is GitHub's own definition of a passing check
status, quoted; and a cascade skip is always accompanied on the same commit by the failure that
caused it, which `gate.sh` tests *before* it reaches the skipped logic. Section 7 has the argument
and the measurement.

**But the gate has a different defect, and it is MEASURED.** A job killed by its own
`timeout-minutes` concludes **`cancelled`**, which `gate.sh` tolerates by name, and its dependent
concludes **`skipped`**, which `gate.sh` passes. Only the **run** concludes `failure`. So a job that
hung until ADR-0141's ceiling killed it reports the commit as `PASSED` today. Measured in this
repository's own account, both sides: a hang gives a run conclusion of `failure`, a supersession
gives `cancelled`, so the remedy is one API call away. §10.1.

**And the speed CNCORE-341 wants is not in the job graph at all.** One test file,
`item-page-cost.test.ts`, is 136.6s of the 189s critical-path job, and it runs **twice** per run
because `provider` runs the same suite. That is 274 seconds a run, half of it duplication, and
removing the duplicate takes the `provider` job from 231s to about 105s **without skipping
anything**. §6A — this is the recommendation to act on.

> **"the slowest job" was this sentence's own error, corrected 2026-09-22 by CNCORE-343**, which made
> the change: the job it names is `provider`, measured at 118s, while the SLOWEST job is `e2e` and
> `e2e` keeps the file. So the duplicate was worth compute rather than waiting time, and the speed
> CNCORE-341 wants needs the second change in §9.2 as well. §6A.2 carries both measurements.

---

## 1. What has changed since the standing decision, and whether it survives

Four things changed between 2026-09-11 and today. Only one of them bears on path filters at all,
and it strengthens the rejection rather than weakening it.

| What changed | Bears on the decision? |
|---|---|
| CNCORE-80 split the four static checks back into four named jobs, and the pipeline grew from 11 jobs to 15 keys | **No.** It changes the job count, which section 4 shows is not a cost unit here. |
| ADR-0139 added credential-gated skipping for `provider` and `contract` | **Yes, and it matters.** Two coverage-bearing jobs can already skip. Section 7. |
| ADR-0181 and `gate.sh` gave this repository a real merge gate | **Yes.** This is the genuinely new question, and CNCORE-341 is right to lead with it. Section 7. |
| ADR-0141 gave every job a measured `timeout-minutes` | **No.** |

The 2026-09-11 argument rested on two legs. The first was that a path filter is *"a mechanism for
making checks pass without running, by construction"*, against CNCORE-3 and CNCORE-13. That leg is
untouched. The second was that nothing required a check, so a skipped workflow would sit pending
forever the day somebody required one — a trap *"one decision away"*.

**That second leg has since become concrete rather than hypothetical, in a way the 2026-09-11 pass
could not have predicted.** It is no longer about GitHub's required checks, which this repository
still does not use (ADR-0118). It is about `gate.sh`, which is now the only merge gate there is,
and which treats an absent run as `BLOCKED NO-RUN`. Section 7.3 works this through.

---

## 2. The baseline, re-measured

Every figure CNCORE-341 quotes was re-derived today from the Actions API rather than taken from the
ticket. **The headline figures reproduce.**

| Claim in the ticket | Re-measured 2026-09-21 | Verdict |
|---|---|---|
| One workflow file, 1258 lines | `.github/workflows/ci.yml`, 1258 lines | **Holds** |
| 16 jobs | 15 job keys; `image` is a two-way matrix, so **16 job instances** | **Holds**, with the distinction worth keeping: `ci.yml`'s own comments say "fifteen jobs" |
| ZERO path filters | No `paths:` or `paths-ignore:` key anywhere. The only two matches in the file are inside comments | **Holds** |
| 3 job-level `if:` conditions | 3 | **Holds** |
| 3 `needs:` edges | 3 | **Holds** |
| Wall clock 4.1 min, very consistent | 3.83, 3.88, 3.90, 4.00, 4.32 min over the five most recent completed runs | **Holds** |
| Total job-minutes 19.9 | 19.48, 19.68, 19.77, 20.13, 20.45 | **Holds** |

The three `needs:` edges and the three `if:` conditions are the same three jobs: `provider` and
`contract` each take `needs: credentials` with an `if:` on its output (ADR-0139), and
`image-manifest` takes `needs: image` with an `if:` on the ref.

### The critical-path claim is exactly right, and it is the most useful sentence in the ticket

CNCORE-341 says the wall clock is set by the two HTTP jobs and not by the job count, and that
removing the image builds saves compute and zero wall clock. **Measured, both halves hold precisely.**

On the most recent completed run, recomputing the finish time with jobs removed:

| Scenario | Wall clock | Job-minutes |
|---|---|---|
| As it runs today | 4.00 min | 20.45 |
| Without the two image builds | **4.00 min** (unchanged) | 15.65 |
| Without the two HTTP jobs | 2.88 min | 12.87 |

The image builds cost 4.8 job-minutes and **zero** wall clock. An optimisation aimed at the job
count would indeed feel like progress and deliver none.

---

## 3. Three sentences in the ticket that measurement refuses

Each is corrected here in the sentence that carries it, rather than in a note at the end. The
ticket was filed by an agent on 2026-09-21 and is accurate in its headline measurements; these
three are derived claims that do not survive being checked.

### 3.1 "Today nothing is ever skipped, so that is harmless" — FALSE, and it is the load-bearing one

**Something is skipped on every single pull request, and has been since CNCORE-70.**

Measured on the head commit of PR #258, merged today: **16 check runs, 15 `success` and one
`skipped`.** The skipped one is `One image, both architectures` (`image-manifest`), which carries
`if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')` and therefore cannot
run on a pull request at all.

ADR-0181 already knew this and counted it on the same day: it records #210's head as carrying
"18 `success`, 1 `skipped`, counted 2026-09-21".

**The consequence inverts the ticket's framing entirely.** `skipped` in `GOOD` is not a dormant
line that path filters would make dangerous. It is the line that lets every pull request in this
repository merge. Remove it and `gate.sh` answers `BLOCKED UNKNOWN-CONCLUSION` on every PR.

### 3.2 "takes such a PR from 4.1 min to near zero" — arithmetic does not support it

Removing only the two HTTP suites takes a run from 4.00 min to **2.88 min**, not to near zero.
`Test` (2.6 min) and the image builds (2.3 min) still stand behind them.

To actually reach near zero, a prose-only change would have to skip **thirteen of sixteen jobs**,
leaving `Secret scan`, `Agent docs` and `Lint`. Measured on the same run, those three alone finish
**20 seconds** after the run starts. That is the real shape of the prize, and it is a much larger
intervention than "should not run the two HTTP suites".

### 3.3 "This repository ships a great many prose-only changes" — 6 in 80

Measured over the last 80 first-parent merges to `main` (2026-09-19 to 2026-09-21), classifying a
merge as prose-only when every path it touches matches `*.md` or sits under `docs/`:

- **6 of 80 prose-only (7.5%)**
- 7 of 80 (8.75%) if `.claude/` is included as prose

That is not "a great many". Taken with 3.2, the **upper bound** on a perfect path-filtering scheme
is 6 runs in 80 going from 4.0 min to 0.3 min: roughly 22 minutes of wall clock across ten days of
work, against a permanent increase in the number of ways CI can be wrong.

**That upper bound is not reachable, and §8.2 replaces it with the achievable figure**, which is
about a third of it — because three of these jobs take prose as their input and one of them is the
second-slowest in the pipeline.

**One caveat stated rather than glossed:** this counts merges, not pushes, and a prose PR is
typically pushed several times before it merges, so the push-level share is somewhat higher than
7.5%. It is not higher by the order of magnitude the ticket's wording implies.

---

## 4. Compute is not a currency in this repository

**Standard GitHub-hosted runners are free in a public repository, and CanonCore has been public
since CNCORE-62.**

This is not a new finding. ADR-0111 exists as a *correction* to itself on exactly this point, and
it quotes GitHub's billing documentation as read on 2026-09-11:

> "The use of standard GitHub-hosted runners is free: In public repositories."

ADR-0111's own header records the consequence: the 2.98-minute saving that record was originally
bought with is *"exactly zero here"*. `ci.yml` restates it twice in its own comments — "four
minutes and one are both zero here now", and "the fifteen jobs this workflow runs cost $0.00
between them, split or folded".

**So CNCORE-341's instruction to say "which of the two you are buying, latency or compute" has an
answer that the records already carry: compute cannot be bought here, because it costs nothing.**
Every proposal in this space that is motivated by job-minutes is refused by ADR-0111 before it is
evaluated on its merits. The 19.9 job-minutes figure in the ticket is real and is worth £0.00.

That matters beyond this ticket, because job-minutes is the intuitive metric and it is the wrong
one here. It is also still the RIGHT one in `provider-wiki` and `provider-tmdb`, which stay private
under ADR-0089 and are still billed — ADR-0111 carries which half of it survived and where.

---

## 5. Runner contention is the one compute-shaped argument that survives, and it costs 50 seconds

If minutes are free but concurrent runners are capped, then removing jobs buys **throughput** when
several agents push at once, which is a third argument distinct from both latency and money. This
repository runs up to four agents at a time (CNCORE-137, CNCORE-178), each capable of triggering a
16-job run, so the question is real: **four agents want 64 job slots.**

**The cap is 20 concurrent jobs on GitHub Free**, and the peak this repository was measured
reaching today is **exactly 20**. So the cap is not theoretical here. It binds.

**What binding actually costs was measured, and it is small.** Over the 25 most recent runs, taking
each job's delay from run creation to its own start, and excluding the three jobs that wait on a
`needs:` dependency rather than on a runner:

| | |
|---|---|
| Independent jobs sampled | **325** |
| Median start delay | **4s** |
| p90 | **7s** |
| Worst | **50s** |
| Jobs delayed over 60s | **0 (0.0%)** |

The sample genuinely contains a contended moment: four runs started within about ninety seconds of
each other on 2026-09-21, and the peak simultaneously-running job count was 20 — the cap.

**So jobs did queue, and the queue drained in under a minute.** Not one job in 325 waited longer
than 50 seconds, and the median wait was 4. The reason is that this pipeline's jobs are mostly very
short: the cap is reached, the short jobs clear it in seconds, and the long ones were already
running.

**The honest reading.** Trimming jobs *would* buy throughput under four-agent contention — this is
the one argument in this document that is not simply worth nothing. But the measured prize is
bounded by 50 seconds at the very worst, on the worst job of 325, at peak contention. That is not a
reason to put a new mechanism into the merge path.

**One limit on this measurement, stated rather than glossed.** It samples the 25 most recent runs,
which reached the cap but were not a sustained four-agent wave. A longer wave would queue for
longer. The figure to re-measure, if this is ever revisited, is the start delay at the moment four
agents each push within the same minute.

---

## 6. Latency is the only currency, and it is worth about eight minutes a fortnight

Nothing in sections 4 or 5 leaves compute worth buying: minutes are free here, and the runner cap,
though it does bind, costs at most 50 seconds. What remains is wall clock, on the 6 merges in 80
that a filter could touch at all.

**§3.3's 22 minutes is the ceiling and §8.2 is the floor-to-ceiling truth: about 8.5 minutes across
ten days of work.** The gap between the two is section 8.1, which is the finding this note would
keep if it could keep only one.

Set against that figure, section 7 shows what a filter would cost the merge gate, and section 8
shows what each conditional job would stop catching.

---

## 6A. The lever that is actually there: one test file is 57% of the pipeline

CNCORE-341 looks for speed in the job graph. **It is not in the job graph. It is in one file.**

Step-level timings from the most recent completed run:

| Job | Total | Setup (containers, checkout, pnpm) | The suite step |
|---|---|---|---|
| `The page over HTTP` | 224s | 32s | **189s** |
| `Import and browse over HTTP` | 231s | 33s | **194s** |

So the critical path is the suite, not the preparation. And inside the suite, vitest's own per-file
report is unambiguous:

```
e2e/item-page-cost.test.ts   (4 tests)   136599ms
```

**One file, four tests, 136.6 seconds.** The other twenty-three files sum to **44.1 seconds**
between them. And `provider` runs the same suite, where the same file took **137.1 seconds**.

**274 seconds of every CI run is spent counting SQL statements, and half of it is duplicated.**

### 6A.1 Why it costs that, which is not a defect

`item-page-cost.test.ts` measures what an item page costs the database — the page once read its Item
twice, and no other seam could see it. To count statements, PostgreSQL must publish them, and a
backend publishes on exit. So each measurement starts a server and **stops it inside the measurement
window**, and `statementsWhile` refuses to answer on a figure it has not counted twice (CNCORE-218).
Four tests, at least two server lifecycles each.

**The cost is inherent to the measurement, so this is not a slow test to speed up.** It is an
expensive one, correctly built, sitting on the critical path of every run.

### 6A.2 What that makes available, none of which costs coverage

- **It runs twice per run, and the second time is duplication.** `provider` exists to exercise the
  real provider-tmdb image (ADR-0139). `item-page-cost.test.ts` counts database statements and never
  touches a provider. Running it there buys nothing.
- **It is 136s inside a 189s job.** Given its own job, the remaining e2e suite would be roughly 53s
  of work, and the cost measurement would run beside it rather than in front of it.

Both are ordinary changes to which suite runs where. Neither skips a check, neither touches
`gate.sh`, and both speed up **100% of runs** rather than the 7.5% a path filter could reach.

**A figure worth stating precisely: removing the duplicate alone takes the `provider` job from 231s
to roughly 105s.** Derived: the suite step is 194s, of which 56.9s is overhead (build, server
starts, seeding) and 137.1s is this file as the long pole; the longest remaining file is
`instance.test.ts` at 11.4s, so the suite lands near 68s and the job near 105s. It costs no
coverage at all.

> **THAT SENTENCE SAID "the pipeline's slowest job" AND THAT WAS WRONG, corrected here on
> 2026-09-22 by CNCORE-343, which made the change and measured it.** The job it describes is
> `provider`; the pipeline's SLOWEST job is `e2e`, and `e2e` is the one that goes on running this
> file. The derivation of the job itself held up well — measured 118s and then 93s against the 105s
> predicted, its suite step 191s to 62s and 57s — but **the pole did not move at all: `e2e` ran 231s
> before and 234s then 228s after.** So removing the duplicate buys compute and not latency, and the
> latency claim in §9.2 below belongs to the SECOND change rather than the first: until the
> measurement has a job of its own, or leaves `e2e` too, something still spends 137s counting
> statements on the critical path.
>
> **A RUN'S OWN TOTAL IS THE WRONG INSTRUMENT HERE, which is worth recording because this note used
> it.** The three runs' wall clocks read 243s, 234s and 265s, and the 265s is the one where nothing
> got slower: a run's total carries how long each job waited for a runner as well as how long it
> took. The longest JOB is the figure that answers "how long does a pull request wait", and it is
> what the correction above rests on. Runs 35741009637 (before), 35742473820 and 35795564409 (after).

**This note does not propose the change**, because sequencing suites across jobs is not what
CNCORE-341 asked about and the constraint in `global-setup.ts` — the counted catalogue is built for
the whole suite — needs reading first. **Filed as CNCORE-343**, which requires the saving to be
measured rather than derived before it closes.

---

## 7. The crux: what a `skipped` conclusion is evidence of

CNCORE-341 asks the gate question first and is right to. This section answers it, and the answer is
that **the gate is correct as written and needs no repair** — but not for the reason it looks like,
and there is a real hole nearby that the ticket does not name.

### 7.1 The `GOOD` set is not a guess. It is GitHub's own definition, quoted

`gate.sh` reads:

```python
GOOD = {"success", "skipped", "neutral"}
```

Those three values are not a judgement call somebody made about what ought to count. They are
GitHub's own enumeration of a passing check status. `ci-and-repo-standards.md` recorded the sentence
on 2026-09-11 and it was re-read from GitHub's own documentation source today:

> "Successful check statuses are `success`, `skipped`, and `neutral`."

GitHub's conclusion reference says the same thing a second way, per value:

> `neutral` — The check run completed with a neutral result. **This is treated as a success for
> dependent checks in GitHub Actions.**
>
> `skipped` — The check run was skipped. **This is treated as a success for dependent checks in
> GitHub Actions.**

and its troubleshooting table carries the row *"A job is skipped by a conditional | The job reports
'Success'"*.

**One reconciliation worth keeping, because it is a trap for anyone reimplementing this.** GitHub's
note says a skipped job "will report its status as 'Success'", but the literal API value is
`skipped` — measured. Both statements are true: the string is `skipped`, and the *treatment* is
success. A consumer that matched the literal string `success` would refuse every skipped job.

ADR-0181 carries the same set as "the closed one", and the reason it is closed rather than open:
listing the BAD conclusions and letting the rest past is how `stale` — a conclusion **only GitHub
can set** — once read as `PASSED`.

**So the line CNCORE-341 flags as a latent defect is the vendor's own contract, transcribed.** That
does not make it automatically right for this repository, but it does move the burden: departing
from it means asserting that GitHub's definition of a passing check is wrong here, which is a
claim that needs its own evidence.

### 7.2 The two skips genuinely cannot be told apart, and the gate does not need to

A job's `conclusion` is `skipped` both when its own `if:` evaluated false and when a job in its
`needs:` failed. **Nothing anywhere in the API carries the difference**, and that was established by
building a throwaway public repository and running the two cases side by side rather than by
reading around the question. The two job objects were diffed with sorted keys:

> Every field is byte-identical except `id`, `name`, `node_id`, the three URL fields and the
> timestamps. Both carry `status: "completed"`, `conclusion: "skipped"`, `steps: []`,
> `runner_id: null`.

The check-run surface agrees, and **timestamps are not a usable discriminator either**: a job
skipped because its dependency was itself *skipped* carries the same early timestamps as one
skipped by its own `if:`, because the dependency resolved instantly. Timestamps track when the
dependency resolved, not why the job was skipped.

GitHub documents the hazard in its own words, in the "Handling skipped but required checks" table:
for the cause *"A job depends on a failed job"*, the result is *"The dependent job is skipped and
**may not block merging**"*, and the documented fix is *"Use `always()` with `needs` for required
checks that depend on other jobs."*

**But the gate never has to ask, because a cascade skip cannot arrive alone.** A job skipped
because its dependency failed is always accompanied, *on the same commit*, by the check run for
that dependency, carrying `failure`. And `gate.sh` tests for failures **before** it reaches the
skipped logic:

- `failed` is computed over `{failure, timed_out, action_required}` and exits `BLOCKED FAILED`
- only then is `unknown` computed, and only then `passed`

So the run blocks — on the failure, named, which is also the more useful message than a complaint
about the skip downstream of it.

**Measured rather than reasoned.** Both of this repository's recent failing runs show exactly this
co-location:

| Run | Conclusions |
|---|---|
| A failing `Agent docs` on a branch | 1 `failure`, 1 `skipped`, 14 `success` |
| A failing `Test` on a branch | 1 `failure`, 1 `skipped`, 14 `success` |

In both, `gate.sh` reaches `BLOCKED FAILED` and never evaluates the skip.

**The hazard is real, and it is bounded precisely by whether the gate looks at the whole commit
rather than at each check in isolation.** `gate.sh` reads every check run on the head, across every
page, and refuses on any failure before it considers any skip. A gate that evaluated one check at a
time would be fooled here; this one is not, and it is not by construction rather than by luck.

**This is the "or evidence that it need not" branch of the ticket's acceptance criterion.** The
gate should not try to distinguish a filtered skip from a cascade skip. It cannot — no field the
API returns carries the difference — and it does not need to, because the cascade case is decided
by a conclusion the gate already refuses.

### 7.3 The real interaction is the opposite of the one feared: a filter would BRICK the gate, not weaken it

The ticket's worry is that path filters would let the gate pass something it should not. For
**workflow-level** filtering the failure runs the other way, and it is worse.

`on.pull_request.paths` that matches nothing means the workflow **does not run**. No run means no
check runs.

**Measured on a purpose-built probe rather than assumed.** A commit that matched no `paths:` entry
answered, for its own SHA:

```
GET .../actions/runs?head_sha=<sha>    →  {"total_count": 0, "runs": []}
GET .../commits/<sha>/check-runs       →  {"total_count": 0, "runs": []}
GET .../commits/<sha>/status           →  {"state": "pending", "total_count": 0}
```

**Zero runs, zero check runs, and a combined status of `pending` with no contexts.** There is
nothing for any consumer to read, ever. GitHub's own wording matches: checks *"will remain in a
'Pending' state"* and *"A pull request that requires those checks to be successful will be blocked
from merging."*

And `gate.sh`'s first branch on an empty list is:

> `BLOCKED NO-RUN <sha> none YET`

**A documentation-only pull request would become permanently unmergeable by the gate**, not fast.
It is the same trap GitHub documents for required checks — *"will remain in a 'Pending' state"*,
*"blocked from merging"*, with the documented fix being the four words *"Avoid requiring workflows
that can be skipped"* — arriving here through `gate.sh` instead of through GitHub, on a repository
that has no required checks at all (ADR-0118).

The 2026-09-11 pass called this trap *"one decision away"*. **It is now zero decisions away**: the
gate exists, it is the only merge gate there is, and it already treats absence as a block.

### 7.3b The asymmetry, which is the single fact to carry away

| | Check created? | Effect on a gate |
|---|---|---|
| Workflow filtered out by `on.<event>.paths` | **No** | Stays pending forever. **Blocks**, and nothing clears it |
| Job skipped by `if:` inside a running workflow | **Yes**, `conclusion: skipped` | Treated as **passing** |

**They are opposites, and that is the whole trap.** Moving a skip from the workflow level to the job
level converts *"blocks forever"* into *"passes silently"*. Neither end is obviously the safe one:
one fails closed and unmergeably, the other fails open and quietly. Choosing between them is a
decision, not a detail, and it is the decision CNCORE-341 was right to insist be made first.

### 7.4 Job-level conditioning is the safe shape, and this repository already runs it

A job skipped by an `if:` inside a *running* workflow keeps the run whole: the workflow runs, a
check run exists for every job, and the skipped ones report `skipped`, which GitHub calls a
success. The gate reads it correctly.

That is not a hypothetical shape. **ADR-0139 already implements it**, gating `provider` and
`contract` on whether `TMDB_READ_ACCESS_TOKEN` is reachable, and it chose that shape for a reason
directly relevant here: a job whose service container cannot start fails at `Initialize containers`
*before* any step, so a step-level condition never gets the chance.

**So if path filtering is ever wanted, the shape is settled in advance: job-level `if:`, never
`on.<event>.paths`.** That is a genuinely useful constraint to have written down, and it falls out
of the gate rather than out of taste.

### 7.5 The real hole is next door, and it is present today

Reading `gate.sh` through for the cancelled case: `cancelled` is deliberately neither good nor
unknown. It is excluded from the `unknown` list, and `BLOCKED SUPERSEDED` fires only when **every**
run on the commit was cancelled.

So a commit carrying `success` alongside `cancelled` reaches `PASSED`, with the cancelled jobs never
having completed. **A cancellation cascades as `cancelled` rather than as `skipped`** — measured against a
purpose-built probe, where a job whose dependency was cancelled concluded `cancelled` with zero
steps, and one carrying `if: always()` ran and concluded `success` — so this is not the skip
question wearing a different hat. It is `cancelled` itself being
tolerated. ADR-0181 chose that deliberately, and for a good reason: `cancel-in-progress`
means a force-push leaves a trail of cancelled runs, and reading those as failures produced a false
breakage claim on 2026-09-20. In the ordinary case the head moves when that happens, so the
`LAGGING` and head-resolution checks cover it.

**What is not covered is a partial cancellation on a head that does not move** — a run cancelled by
hand, or by GitHub's own infrastructure. The gate passes it.

**And ADR-0139's own case is a live instance of the shape the ticket fears, already merged.** On a
fork or Dependabot pull request the token is out of reach, `provider` and `contract` skip, and
`gate.sh` answers `PASSED` on a commit where `test:contract` **ran nowhere at all**. ADR-0139 states
that coverage loss plainly under "What is lost, stated rather than glossed" — but it was written
before the gate existed, so it does not record that the gate reports such a run as passed.

That is worth a ticket. It is not worth conflating with path filters: it is here now, it arrived
with a record that argued for it, and it is a question about what the gate should do with a run
that is *incomplete* rather than one that is *filtered*.

---

## 8. What would be lost, per job

CNCORE-341 asks, for each job proposed to be conditional, what defect class it is the only thing
catching and what would catch it instead. ADR-0139 already answers this shape of question for
`provider` and `contract` under "What is lost, stated rather than glossed", and that section is the
template followed here.

**The answer for almost every job is "nothing else catches it".** This pipeline has very little
redundancy, which is a consequence of ADR-0111's correction: since jobs are free, they were split
for diagnosability rather than folded for cost, and each names one thing.

| Job | The defect class it catches | What else catches it |
|---|---|---|
| `secrets` | a credential committed anywhere in the tree | **Nothing.** gitleaks is the only scanner, and GitHub's own secret scanning needs paid Secret Protection |
| `docs` | `CLAUDE.md` over its 200-line limit; the Owner's hostname, username or absolute path reaching a public tree (ADR-0114); a missing agent doc | **Nothing** |
| `typecheck` | type errors across eleven packages | **Nothing** |
| `lint` | Biome violations | **Nothing.** Not covered by typecheck, the suites, or a production build |
| `build` | a production build failing | **Nothing** |
| `env-guard` | the app building despite a missing `DATABASE_URL`, i.e. env validation not biting | **Nothing** |
| `test` | ten packages' suites, including `@canoncore/config`, which is every check this repository makes of `ci.yml`, the workspace, the Biome config, the Node major **and its own prose** | **Nothing** |
| `migrations` | a rung that will not apply from empty; a rung this branch edited or withdrew relative to the base branch | **Nothing.** The freeze check is meaningful *only* here, against a ledger built from the base branch |
| `e2e` | the page being unreachable over real HTTP | **Nothing.** `ci.yml` says it in its own words: "every other suite passes with the app never having been served" |
| `browser` | the drag and the wrap in a real browser | **Nothing** |
| `credentials` | which provider credentials the run can reach, and a deleted secret on any ref but a pull request | **Nothing**, and it is deliberately ungated so it always reports |
| `provider` | `test:e2e` against the **real** provider image, less the one file that never reaches a provider (CNCORE-343) | `e2e` runs the whole suite against the stub, so what is lost is the real provider specifically (ADR-0139) |
| `contract` | `test:contract`, both providers against one contract | **Nothing. It runs nowhere else** (ADR-0139) |
| `image` | the image builds, migrates a database, serves a page, refuses a bad ladder, and ships no `.env`, no pnpm, no dev dependencies, plus the licence | **Nothing** |
| `image-manifest` | that a stranger can pull the published multi-architecture image | **Nothing**, and it is already ref-gated |

### 8.1 The three jobs whose subject IS prose, which is what breaks the naive filter

The obvious filter is "a change touching only `*.md` or `docs/` skips everything but the cheap
checks". **Three of these jobs take prose as their input, and one of them is the second-slowest job
in the pipeline.**

- `secrets` runs gitleaks over the whole tree, markdown included.
- `docs` greps the whole tree for the Owner's hostname, username and absolute path. A leak in a
  research note is exactly what it exists to catch, and ADR-0114 records that publication cannot be
  undone.
- **`test` reads every markdown document in `docs/`, `.claude/` and the repository root.**
  `markdown-corpus.ts` sets the corpus to those directories plus the root's own documents, and
  three suites sweep it: `adr-citations.test.ts`, `doc-line-citations.test.ts` and
  `terminal-send-hazards.test.ts`.

**Measured today rather than argued.** Writing this note and running those three suites over the
tree passes, 15 tests. Adding two defects to this very file — one prose-to-prose line citation, and
one ADR number this tree does not hold — turns two of them red: `adr-citations.test.ts` on "names a
record this tree holds, or one the amnesty accounts for", and `doc-line-citations.test.ts` on "does
not name a line number in a target this tree holds". Both defects were removed again and the suites
returned to green. The defects are described here rather than quoted, because these suites read
this document too.

**So a filter that skipped `test` on a documentation-only change would skip the only checks whose
subject is documentation**, and it would do so on precisely the changes they exist to police. That
is not a tuning error. It is the `CLAUDE.md` gotcha "CI tells you less than it looks" arriving by
the exact route the ticket warns about.

### 8.2 What that does to the prize

A documentation-only pull request that is filtered *correctly* must still run `secrets`, `docs` and
`test`. Measured on the most recent completed run, `Test` alone finishes **2.58 minutes** after the
run starts.

| Prose-only pull request | Wall clock |
|---|---|
| Today, all sixteen jobs | 4.00 min |
| The ticket's hoped-for "near zero" | 0.33 min, and it is not reachable |
| **Correctly filtered, keeping `secrets` + `docs` + `test`** | **2.58 min** |

**The real saving is 1.4 minutes, on 6 merges in 80.** About **8.5 minutes of wall clock across ten
days of work**, in exchange for a new mechanism in the one script this repository's whole merge
discipline rests on.

---

## 8B. What established projects actually do

Read from the projects' own workflow YAML on 2026-09-21, not from write-ups about them.

| | next.js | turborepo | react | TypeScript | cal.com | grafana |
|---|---|---|---|---|---|---|
| Workflow-level `paths` on main CI | no | no | **yes** (sole mechanism) | no | no | partly |
| `dorny/paths-filter` | no | no | no | no | **yes** | no |
| `tj-actions/changed-files` | no | no | no | no | no | **yes** |
| Hand-rolled git-diff script | **yes** | release-PR only | no | no | no | no |
| `turbo run --affected` | no | **yes** | n/a | n/a | no | n/a |
| `nx affected` | no | no | no | no | no | no |
| Job-level `if:` skips | **yes** (34) | yes | no | no | **yes** (every job) | **yes** |
| `concurrency` + `cancel-in-progress` | yes | PR only | yes | **no** | yes | PR only |
| Aggregating `if: always()` required job | **yes** | per workflow | no | **yes** | **yes** | no |

**Four of six do not use workflow-level `paths` on their main CI at all.** Only React uses it as its
primary mechanism. **`turbo run --affected` is used by exactly one project: turborepo itself** — not
even by Next.js, in the same organisation and using turbo for its builds. Nobody uses
`--filter=...[base]`. Nobody uses `nx affected`. **microsoft/TypeScript deliberately does none of
it**, and carries no `concurrency` on its main CI either.

**Where the field bothers at all, the answer is a path-filter table feeding job-level `if:`, never a
build-graph query.** That is the same shape §7.4 arrives at from the gate, reached independently.

### 8B.1 The aggregating job, and why it is the whole design

Four of six run an aggregating job that the branch rule requires, and **how it treats `skipped` is
the entire design**. Next.js's own comment names precisely the hazard measured in §7.2:

> We block merging unless this job passes. This is enforced by a "require status checks to pass"
> rule on the canary branch.
>
> Note: Some of these jobs are dependencies of other test jobs. If they fail, they'll cause the
> dependent test job to be skipped, **which could cause this aggregation job to incorrectly pass if
> the dependency job is not listed here.**

**Their fix is structural rather than clever**: list every intermediate job in the aggregator's
`needs:`, so no failure can hide behind a skipped dependent.

**This repository does not need that pattern, and it is worth saying why.** An aggregating job
exists to give GitHub's required-checks system one context to require. CanonCore requires no checks
(ADR-0118); `gate.sh` is the aggregator, it reads every check run on the commit, and it already
refuses on any failure before considering any skip. Next.js's hazard is one that arises from
*listing* dependencies; `gate.sh` avoids it by *enumerating* them.

---

## 8A. What GitHub itself says, for whoever revisits this

Everything here was read from GitHub's own documentation source on 2026-09-21, and the load-bearing
behaviours were additionally measured against a throwaway probe repository.

### 8A.1 The guidance table, verbatim

GitHub's *Troubleshooting required status checks* page carries a section called "Handling skipped
but required checks":

| Cause | Result | How to fix or check |
|---|---|---|
| A workflow is skipped by path filtering, branch filtering, or a commit message | Associated checks stay in a "Pending" state and block merging | Avoid requiring workflows that can be skipped. |
| A job is skipped by a conditional | The job reports "Success" | See Control jobs with conditions. |
| A job depends on a failed job | The dependent job is skipped and may not block merging | Use `always()` with `needs` for required checks that depend on other jobs. |

**Row three is this ticket's question, in GitHub's own words, with GitHub's own answer.** The remedy
is `always()` on the dependent job, not a change to how a consumer reads `skipped`.

**And the "one aggregate job that always runs and reports the verdict" idiom is NOT GitHub
guidance.** It is widespread in practice, but no GitHub documentation page names or prescribes it.
What is documented is the `always()` + `needs` ingredient it is built from. Worth knowing, because
the idiom is what somebody will reach for first.

### 8A.2 The mechanics of `paths`, which are not what memory says

- **`paths` and `paths-ignore` cannot both be used for the same event.** To include and exclude, use
  `paths` with `!`-prefixed entries, and order matters: a negative after a positive excludes, a
  positive after a negative re-includes.
- **Path filters are not evaluated for pushes of tags.** This repository's release trigger is a tag
  pattern, so a filter would not touch the release path at all.
- The changed-file list is a **three-dot** diff for pull requests and a **two-dot** diff for pushes.
- **If there are no files changed, the workflow will not run.**

**Three documented limits change the answer, and they do not fail in the same direction:**

| Limit | Behaviour | Fails |
|---|---|---|
| A push of more than 1,000 commits | The workflow **always** runs | **Open** — a check appears |
| The diff generation times out | The workflow **always** runs | **Open** — a check appears |
| The diff exceeds **3,000** files and the matched files are not in the first 3,000 | The workflow **does not** run | **Closed** — no check appears at all |

**The figure is 3,000, not 300.** GitHub's docs source renders it through a feature flag,
`actions-paths-filter-limit`, which is enabled unversioned for GitHub.com Free/Pro/Team and
Enterprise Cloud; the 300 figure survives only for Enterprise Server older than 3.22. **Any record
this repository writes must state 3,000.** This is exactly the class `CLAUDE.md` means by "verify,
don't recall": 300 is the remembered number and it is wrong here.

**Force-push behaviour is NOT ESTABLISHED.** GitHub's page describes pushes in terms of two-dot
diffs and does not call out force pushes as a distinct case. No documentation specific to it was
found, and none is inferred here.

---

## 9. The recommendation

**Per change, naming what it buys, as CNCORE-341 asks.**

| Proposal | Buys | Verdict |
|---|---|---|
| Workflow-level `on.pull_request.paths` | latency on 7.5% of merges | **Reject.** It produces no check runs, and `gate.sh` reads that as `BLOCKED NO-RUN`. It makes prose PRs unmergeable, not fast |
| `dorny/paths-filter` + job-level `if:` | ~1.4 min on 7.5% of merges | **Reject on cost/benefit.** The shape is *safe* (§7.4), but §8.2 prices the prize at 8.5 min per ten days, and §8.1 shows the largest skippable job cannot actually be skipped |
| `turbo run --affected` | latency and compute | **Reject, and it collides with an existing mechanism.** See §9.1 |
| Drop the two image builds from PRs | 4.8 job-minutes, **zero** wall clock | **Reject.** Compute is free here (§4), so this buys nothing at all while removing the only check on the shipped artefact |
| `concurrency` / `cancel-in-progress` | compute | **Already implemented.** Not a proposal |
| Change `gate.sh`'s `GOOD` set | — | **Reject.** It is GitHub's own definition, and removing `skipped` blocks every PR today (§3.1) |

**So: edit no workflow in this pass.** That is also what the ticket's own last acceptance criterion
asks for unless the note justifies otherwise, and for path filtering the note does not.

### 9.2 What to do instead, ranked by what it buys

| Do this | Buys | Costs |
|---|---|---|
| **Stop running `item-page-cost.test.ts` in the `provider` job** (CNCORE-343, done 2026-09-22) | Measured: the `provider` job 228s to 118s and 93s, on **every** run. **No latency**: the `e2e` job is the pole, keeps the file, and did not move (231s, then 234s and 228s) (§6A.2) | Nothing. It counts database statements and never touches a provider (§6A) |
| **Give the cost measurement its own job** | The latency the row above does not buy: the `e2e` job's remaining files are ~53s of work | A job, which is free here (§4) |
| **Make `gate.sh` refuse a commit whose RUN concluded `failure`** (CNCORE-342) | A hang stops reporting `PASSED` | One extra API call per run. Measured and ready to specify (§10.1) |
| Path filters, in any form | ~8.5 min per ten days | A new mechanism in the merge path, and §8.1's trap |

**The first two are worth more than the fourth by a wide margin, and neither skips a check.** That
is the answer to "as good as possible, and as fast as possible": the speed is in the suite, not in
the job graph, and the quality question to settle next is the timeout, not the skip.

### 9.1 `turbo run --affected` deserves its own paragraph, because it fails for a repo-specific reason

Turborepo 2.10.13 is already the runner here, so `--affected` looks like the cheapest possible win.
**It is refused by a mechanism this repository built on purpose.**

`.github/scripts/run-suite.sh` exists because `turbo run <task>` **exits 0 having run nothing**, and
a suite that vanished would otherwise turn its job green. The script fails when the count turbo
printed is zero, and ADR-0103 carries why.

**`--affected` makes "zero tasks ran" the normal case.** Wiring it in means teaching `run-suite.sh`
that zero is sometimes fine, which reopens exactly the hole it was written to close, and reopens it
in the one place that cannot be checked from outside. The guard and the flag want opposite things
from the same number.

---

## 10. What this does not decide, and what is worth a ticket

**Nothing here is a decision.** ADR-0111 already holds the path-filter rejection; if this re-test is
accepted, what it adds is the gate reasoning in §7.3 and §7.4, which belongs in a record rather than
only here.

Three things were found on the way that are **not** CNCORE-341's subject and should not be folded
into it:

1. **`gate.sh` passes a partially cancelled run.** A commit carrying `success` + `cancelled` +
   `skipped` reaches `PASSED`, because `BLOCKED SUPERSEDED` fires only when *every* run was
   cancelled. The common cause moves the head and is caught by the tip check; a hand-cancelled or
   infrastructure-cancelled run on a still-current head is not. **Worth a ticket.**

2. **A run with `provider` and `contract` skipped reports `PASSED` with `test:contract` having run
   nowhere.** ADR-0139 states the coverage loss plainly but predates the gate, so it does not record
   what the gate does with it. This is the ticket's feared shape, already live, on every fork and
   Dependabot pull request. **Worth a ticket**, and it is the strongest argument in this document
   that the gate's relationship to `skipped` deserves a record of its own — just not the change
   CNCORE-341 proposed.

3. **`gate.sh` passes a job that hung until ADR-0141 killed it.** Measured, reproducible, and worse
   than the defect the ticket describes. **Filed as CNCORE-342**, and ADR-0181 now names the gap
   under "A JOB KILLED BY ITS OWN CEILING READS AS PASSED". See §10.1.

### 10.1 The finding this ticket should actually have been about

CNCORE-341 is titled "the merge gate already counts a skipped one as passed". **The gate's real
defect is that it counts a TIMED-OUT one as passed**, and unlike the skip question this one is not
benign.

**STATUS: MEASURED, in this repository's own account, and reproducible.** A probe branch carrying
three jobs was pushed to CanonCore on 2026-09-21 and deleted after reading. Run `35617974088`:

| Job | Conclusion | Steps |
|---|---|---|
| `job_level_timeout` — hit `timeout-minutes: 1` on a `sleep 300` | **`cancelled`** | `Run sleep 300` = `cancelled` |
| `step_level_timeout` — a STEP hit its own `timeout-minutes: 1` | **`failure`** | `slow step` = `failure`, next step `skipped` |
| `needs_the_timed_out_job` | **`skipped`** | none |
| **the run itself** | **`failure`** | |

**So a job killed by its own ceiling concludes `cancelled`, which `gate.sh` tolerates by name, and
its dependent concludes `skipped`, which `gate.sh` passes. Only the RUN says `failure`.** A hung job
therefore reports the commit as `PASSED` today.

**GitHub documents the neighbourhood and not the mechanism**, which is why this had to be measured.
Its workflow-syntax reference says `timeout-minutes` is "The maximum number of minutes to let a job
run before GitHub automatically **cancels** it", which points the right way, but **no GitHub page
states the resulting `conclusion`**. Worse, its limits page contradicts itself: "the expected
behavior when a limit is reached is that the workflow/job will get cancelled", against the six-hour
row's "the job is terminated and **fails**". A record citing GitHub for either would be citing prose
GitHub has not kept consistent. **This section cites a measurement instead.**

### 10.1.1 The remedy, and why it works — also measured

The run-level conclusion is the discriminator, and **both sides of it were measured** rather than
only the one that motivated the fix:

| Case | Run conclusion | Cancelled jobs |
|---|---|---|
| A job killed by its own ceiling (run `35617974088`) | **`failure`** | 1 |
| Superseded by a newer push (run `35603659236`) | **`cancelled`** | 7 |
| Superseded (run `35566260535`) | **`cancelled`** | 15 |
| Superseded (run `35566183448`) | **`cancelled`** | 7 |

**A hang concludes `failure`; a supersession concludes `cancelled`.** That is exactly the
distinction `gate.sh` cannot make from check-run conclusions alone, and it is available one API call
away.

**The remedy is therefore NOT to stop tolerating `cancelled`**, which would block every force-push
and reintroduce the false breakage claim of 2026-09-20. It is to refuse a commit whose RUN concluded
`failure`, whatever its individual check-runs say.

### 10.1.2 Two details that are not interchangeable

- **A *step*-level `timeout-minutes` expiry reports `failure`, not `cancelled`** — measured above.
  So step-level and job-level ceilings behave oppositely at the gate, and only the step-level one
  blocks. `ci.yml` carries **job**-level ceilings throughout (ADR-0141), which is the non-blocking
  one. Anyone tempted to "just use timeouts" as a safety net should read that twice.
- **A dependent job's conclusion depends on the SCOPE of what killed its dependency.** A run-wide
  cancel marks dependents `cancelled`; a single job dying — by failure or by its own ceiling —
  marks them `skipped`. Both measured, and both are in `gate.sh`'s passing set or its tolerated set.

**NOT re-measured here:** an earlier probe reported that `continue-on-error: true` on a timing-out
step erases the signal entirely, reporting `success` at both step and job. That probe no longer
exists and this one did not test it. `ci.yml` uses `continue-on-error` nowhere, so nothing rests on
it today — but anyone adding it should measure this first.
