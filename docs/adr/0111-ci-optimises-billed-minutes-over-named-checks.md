---
status: accepted
---

# CI optimises billed minutes over named checks

`.github/workflows/ci.yml` runs Typecheck, Lint, Build and the missing-`DATABASE_URL` guard as four
steps of ONE job called `static-checks`, rather than as four jobs. The pipeline also carries a
workflow-level `concurrency` key whose fallback makes a push to `main` uncancellable.

**This record exists because the merge contradicts a principle the file stated in its own words**,
and a contradiction with no record is one the next reader silently reverses:

> Separate jobs, so a red check names the thing that broke rather than making someone open the log
> to find out.

That sentence was right about what it was defending and wrong about what it cost. It is gone from
the file, and this is where it went.

## The cost unit is job count, not job duration

GitHub bills Actions **per job, rounded up to the whole minute**. That single fact decides the
shape of this pipeline, and it was not something anybody had looked at.

Measured across 45 runs on 2026-09-11: **312 of 442 jobs ran in under 60 seconds and each billed a
full minute.** Four of them were Typecheck (5s of work), Lint (**0s** — Biome checks 144 files in
35ms), Build (23s) and the env guard (1s). Around them sat ~15 seconds each of job setup, checkout
and `pnpm install`. Four jobs, 44 seconds of work between them, **four billed minutes.**

Merged, those same four checks bill **one**. Modelled across the 45-run sample that is **2.98
minutes off a 13.4-minute run, 24% of what CI costs**; measured on the first real run either side of
the change it was **3 minutes off 14, or 21%** (the table under Evidence). Either way it is the
largest single saving available that survives contact with a slow runner.

The stakes are the allowance rather than the money. GitHub Free gives this organisation 2,000
private-repo minutes a month, which at 13.4 min/run is **7.5 runs a day across 20 active days**.
2026-09-10 ran 134. Post-merge the pipeline bills 10.4 min/run and the allowance reaches **9.6 runs
a day**: not comfort, but a third more room on a budget that was already being blown through.

**Wall clock is not what this buys and must not be sold as such.** Runs finish in 74 seconds at the
median, and that number does not move at all — it is pinned by the provider job, which this does
not touch. Anyone optimising this file for speed is optimising the wrong variable.

## What was traded, and what actually replaces it

Eleven checks on a pull request become eight. A red `Static checks` does not say on its face
whether the typecheck, the lint, the build or the env guard broke.

**The step name is what carries that information now.** A failing step is named in the job summary,
so the answer is one click away rather than absent — and the steps are deliberately **fail-fast**
rather than `continue-on-error` with a hand-rolled exit status. Fail-fast reports one failure per
run and names it; the alternative reports four verdicts at the cost of a guard nobody asked for and
a failing run that still pays for the build. The simpler arrangement was taken.

It is a real loss, not a free lunch. It is worth 24% of the CI bill and it is written down.

## Why four and not six

Merging Secret scan and Agent docs as well saves two further minutes on paper. It was rejected, and
the deciding argument is arithmetic rather than taste:

| Merged job | Composition | Total | Headroom under the 60s billing boundary |
|---|---|---|---|
| **Four jobs** (taken) | 15s fixed + 5 typecheck + 0 lint + 23 build + 1 guard | **44s** modelled, **39-53s measured** | **5-20s**, and none on a run that changes the lockfile (below) |
| Six jobs (rejected) | the above + 10 gitleaks + 4 docs | **58s** modelled | **2s** |

**A merged job's saving is not a gradient. It is a step that collapses the moment the job crosses
sixty seconds.** And runners vary: the `Build` job ranges 35s to 110s against a 43s median across
45 runs — **2.6x**. Two seconds of headroom does not survive that; sixteen does. Modelled against
the observed distribution, the four-job merge lands under 60s on **44 of 45 runs**, which is why
the saving is 2.98 minutes rather than a clean 3.

The secondary arguments hold too and did not need to: gitleaks needs `fetch-depth: 0`, which would
drag a full-history checkout across every step for the sake of one, and Agent docs installs nothing
at all, so its separateness is nearly free.

**The Postgres-bearing jobs are the largest job-seconds saving available and merging them is the
worst idea here.** Test, Migration ladder, The page over HTTP and Import and browse pay 26 seconds
of container initialisation each, and they are precisely the four that test different things — the
ladder in particular must run against a database nothing else has touched. Left alone deliberately.

## The env guard shares a job with the build it contradicts

The guard requires `pnpm build` to **fail**; the step above it requires the same command to
succeed. That looks like a conflict and is not, for a reason worth stating because it is the one
thing that could make the guard lie.

`turbo.json` declares `DATABASE_URL` in the `build` task's `env`, so the value is part of the task
hash. Blanking it at step level is a **cache miss** and the build genuinely re-runs. Measured in
this repository against a deliberately warmed cache: `0 cached, 1 total`, exit 1, `Invalid
environment variables`, **0.4 seconds**.

The obvious way to break that is not silent either, which is why no test guards it. Remove the
`env` declaration and Turbo 2's strict env mode stops passing `DATABASE_URL` to the task at all —
so the **successful** build step fails, on every run, with the same validation error. Probed by
removing the declaration and running it: the build failed with a real `DATABASE_URL` in the
environment. There is no arrangement in which this step quietly stops biting.

## Concurrency, which is insurance and not speed

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: true
```

**The fallback is the load-bearing half.** `github.head_ref` is defined only on `pull_request` and
`pull_request_target` events, so on a push to `main` it is empty, the group becomes the run's own
id — unique and defined for every run — the group has exactly one member, and nothing can ever
cancel it. The default branch is spared **by the shape of the key**, not by a condition somebody
has to maintain. GitHub documents a conditional form for sparing named branches; it spares by
matching a string, so a renamed branch loses its protection silently, and there are no release
branches here to spare.

`${{ github.ref }}` is the version with the defect, and **it has already cost this organisation a
verdict.** provider-wiki keys on it, which makes `refs/heads/main` a group like any other. On
2026-09-10 two merges landed five seconds apart and run #18 — commit `1be88b47` on `main` — was
cancelled 28 seconds in. Its `image` job, which builds the container THIS repository pulls as a
service, never started, and nothing re-ran it. A commit on a default branch with no verdict and
nothing that would ever produce one. That is the same hole CNCORE-3 closed in another form: a check
that can pass without running.

**As a saving it is worth almost nothing and should not be argued for on those grounds.** Replaying
162 runs, 9 were superseded, reclaiming 604 seconds in total — roughly 1% of the allowance. An
agent rarely pushes twice inside 74 seconds. It costs three lines, it cannot regress, and it closes
a hole that has already fired. Price it as insurance.

## No per-run guard on the boundary

A guard failing the job if `static-checks` exceeded ~50 seconds was proposed, fits this
repository's habits, and **does not survive its own measurement.** Against the observed `Build`
distribution a 50s threshold fails **27%** of builds, 55s fails 9%, 60s fails 2%. Any threshold
tight enough to warn early fires constantly; any threshold loose enough not to flake says nothing
the bill would not. A red check with no defect behind it gets disabled, and then it rots.

The error generalises and is the part worth keeping: **job duration is a noisy per-run sample, and
"is the merge still paying off" is a distribution over a month. Gating a distribution on a single
sample is a category error.** The instrument is the billing usage API, one call, already alerting
at 75/90/100% of the included allowance.

Also rejected, and recorded in the research rather than here so `docs/adr/` does not become a CI
changelog: Turborepo remote caching (saves 1 billed minute, zero wall clock, and fails open —
measured: warning, exit 0) and path filters (a skipped required check sits **Pending** and blocks
the merge; the old same-name-workflow trick was retired around GHES 3.2-3.4).

## What the tests pin

Four tests in `packages/config/src/ci-workflow.test.ts`, alongside the ones
[[0106-the-frozen-lockfile-is-set-not-inherited]] added, reading `.github/workflows/ci.yml` as a
file for the reason [[0103-tests-bite-at-package-exports-and-the-router]] gives. That suite is
`cache: false` under CNCORE-12, so it cannot replay a pass over a workflow it never read.

The concurrency tests **evaluate the key** against a synthetic `github` context rather than matching
its text, because a string comparison restates the file and agrees with any key spelled the same
way. Each was proven by breaking the thing it guards:

- **Two pushes to `main` never share a group.** Keying on `github.ref` fails it with
  `expected 'CI-refs/heads/main' not to be 'CI-refs/heads/main'` — the provider-wiki incident in
  one line.
- **Two runs of one pull request do share one, and `cancel-in-progress` is on.** A group of
  `${{ github.run_id }}` alone spares `main` perfectly and cancels nothing ever; it passes the test
  above and fails this one.
- **All four static checks are carried by one job.** Splitting Typecheck back out fails it with
  `Set{ 'static-checks', 'typecheck' }`; dropping `pnpm lint` in the merge fails it with `no job
  runs the lint`.
- **Nothing in the merged job stops failing the build.** This is the failure mode the merge
  introduces: four separate jobs could not be neutered one at a time without a check disappearing
  from the pull request, four steps in one job can be, and the job still reports green under an
  unchanged name. `continue-on-error: true` on the lint step fails the test, naming `pnpm lint`,
  and an `if:` does the same. **The job level is checked as well as the step level**, because
  `continue-on-error` and `if` are valid job keys too and defang all four checks at once rather
  than one — a first version of this test read only the steps, which is the half-built mechanism
  this record would otherwise have called complete. A third assertion catches `pnpm lint || true`,
  the shell form neither key covers.

  **It is a list of the forms worth catching, not a proof, and the difference is stated rather than
  glossed.** A shell script can always be written to swallow its own failure and no reading of the
  file will settle that. What the test buys is that the ACCIDENTAL version — reached for to quieten
  a noisy check — does not pass unnoticed.

## One dependency added

`@actions/expressions` (catalogued at `^0.3.61`, a `packages/config` devDependency), to evaluate the
concurrency key in the tests above.

**Checked first, as [[0106-the-frozen-lockfile-is-set-not-inherited]] checked before adding `yaml`:**
nothing in the catalogue evaluates Actions expressions, and the first version of this test
hand-rolled a twelve-line renderer that understood `a || b` and property lookup and nothing else.
That is the same mistake ADR-0106 names about regexes and YAML, one level up — **an expression
parser written badly.** A legitimate key written with `&&`, `format()` or the documented ternary
spelling would have been mis-read by the test rather than by GitHub, and the failure would have
looked like a broken key rather than a broken test.

The package is **GitHub's own**, out of `actions/languageservices`, which is what the workflow
language server parses expressions with — so the test now measures the key the way the product
does. It is 0.x, so the caret pins it below 0.4 and a bump is worth a glance. The template splitting
around each `${{ }}` is still four lines here, because that part genuinely is trivial.

## Evidence

## What the runner taught that the model did not: the lockfile eats the headroom

The research modelled the merged job's risk as runner variance — the `Build` job ranges 35s to
110s, so some proportion of runs cross 60s and bill two minutes. That is true and it is not the
thing that actually bit. **Five real runs of the merged job, taken while implementing it:**

| Run | Commit | `Post Run pnpm/setup@v2` | Job | Bills |
|---|---|---|---|---|
| [34590960698] | the merge itself | 0s | **47s** | 1 min |
| [34591661579] | **added a dependency** | **25s** | **68s** | **2 min** |
| [34591800494] | a comment | 0s | **50s** | 1 min |
| [34592014251] | this record | 0s | **39s** | 1 min |
| [34592199813] | the row above | 0s | **53s** | 1 min |

[34590960698]: https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/34590960698
[34591661579]: https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/34591661579
[34591800494]: https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/34591800494
[34592014251]: https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/34592014251
[34592199813]: https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/34592199813

The second run went over, and **not because the runner was slow.** Its work steps were among the
fastest of the five — typecheck 3s against 5s, build 17s against 24s. Twenty-five of its sixty-eight
seconds were the `pnpm/setup` POST step, which is `actions/cache` writing a fresh store, which
happens only when the cache key changes, which is to say **only when `pnpm-lock.yaml` changes.**
That run is the commit adding `@actions/expressions`.

So the headroom is not a single number. **The merged job sits in a 40-55 second band on an ordinary
run — call it 5 to 20 seconds of slack — and has none at all on a run that changes the lockfile**,
and that second case is predictable rather than random: every dependency change pays about 25
seconds of cache-save inside this job's minute.

**The table stops at five on purpose, and the reason is this record's own argument.** Each run
recorded here was itself produced by a commit that recorded one, so extending it has no natural end.
More importantly, a longer table would still be the wrong instrument: job duration is a per-run
sample and "is the merge still paying off" is a monthly distribution, which is exactly why the
per-run guard below was rejected. The five runs establish the *mechanism*. The **bill** answers the
ongoing question.

**It does not reverse the decision, and the reason is worth stating rather than assumed.** Before
the merge, four separate jobs each restored that cache and one of them paid to save it, so a
lockfile change cost four billed minutes plus the save. Now it costs two. The merge still pays on
its worst run; what is weaker than the research claimed is the *margin*, not the saving. And a
lockfile change is rare — four of the five runs above are the ordinary case.

**The general lesson is the one to keep.** The model priced the variance it had measured, which was
the variance in the *work*. The thing that crossed the boundary was overhead that only appears on a
subset of runs and was invisible in a median. A distribution taken across runs that all had a warm
cache cannot see the cost of a cold one.

**The merge was measured on the runner rather than only modelled.** Two successful runs of the same
pipeline, one either side of the change:

| | Pre-merge (`main`, run 34589848110) | Post-merge (run 34590960698) |
|---|---|---|
| Jobs | 11 | 8 |
| Job-seconds | 442 | 392 |
| **Billed minutes** | **14** | **11** |

The four jobs that merged were Typecheck 23s, Lint 24s, Build 46s and the guard 20s — 113
job-seconds billing **four** minutes. They are now one 47-second job billing **one**: three billed
minutes off a comparable run, **-21%**. Every one of the four still ran and is named in the job
summary (`Run pnpm typecheck`, `Run pnpm lint`, `Run pnpm build`, `Missing DATABASE_URL fails the
build`), and the guard printed `Build failed on env validation, as it should.` one second after it
started — against the cache the successful build step had just warmed, which is the claim above
proven on the runner rather than on a laptop.

`docs/research/ci-and-repo-standards.md`, researched and decided 2026-09-11, carries the full
tables, the commands that produced each measurement, and section 10's record of which figures moved
under verification. GitHub's workflow-syntax and contexts references supplied the `head_ref`
semantics; the billing behaviour came from the usage API and the billing documentation. The Turbo
cache-miss and strict-env probes above were run in this worktree rather than reasoned about.
