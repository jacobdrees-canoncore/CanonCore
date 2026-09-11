---
status: accepted
---

# CI optimises billed minutes over named checks

> **NARROWED, NOT REVERSED, on 2026-09-11 by CNCORE-80.** Everything below about how GitHub bills
> is still true and is still load-bearing — in `provider-wiki` and `provider-tmdb`, which stay
> private under ADR-0089 and were still drawing billed minutes on the day this was written. What
> did not survive is the conclusion for THIS repository. CNCORE-62 made CanonCore public, and
> GitHub's Actions billing documentation read 2026-09-11 says "The use of standard GitHub-hosted
> runners is free: In public repositories." The saving this record was bought with — 2.98 minutes
> off a 13.4-minute run, 24% of what CI cost — is **exactly zero here**, so the four checks are four
> named jobs again and the title above describes the two provider repositories rather than this one.
>
> The title and filename are unchanged deliberately: three records link this one by slug, and the
> decision it names is still in force where it was taken. Each sentence that went false is corrected
> where it stands rather than in a note at the end.

`.github/workflows/ci.yml` ran Typecheck, Lint, Build and the missing-`DATABASE_URL` guard as four
steps of ONE job called `static-checks` rather than as four jobs, from CNCORE-35 until CNCORE-80
split them back out on 2026-09-11. The pipeline also carries a workflow-level `concurrency` key
whose fallback makes a push to `main` uncancellable, and **that half of this record is untouched by
the correction**: it was never bought with money.

**This record exists because the merge contradicted a principle the file stated in its own words**,
and a contradiction with no record is one the next reader silently reverses:

> Separate jobs, so a red check names the thing that broke rather than making someone open the log
> to find out.

That sentence was right about what it was defending and wrong about what it cost — for as long as
it cost anything. It was gone from the file and this is where it went; it is back in the file now,
because in a public repository four jobs and one job bill the same nothing.

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
**private-repo** minutes a month, which at 13.4 min/run is **7.5 runs a day across 20 active days**.
2026-09-10 ran 134. Post-merge the pipeline bills 10.4 min/run and the allowance reaches **9.6 runs
a day**: not comfort, but a third more room on a budget that was already being blown through.

**That word `private-repo` is the whole of what expired, and it expired the day after this was
written.** CNCORE-62 made CanonCore public on 2026-09-11. GitHub's Actions billing documentation,
read the same day: "GitHub Actions usage is free for self-hosted runners and for public
repositories that use standard GitHub-hosted runners", and "The use of standard GitHub-hosted
runners is free: In public repositories." Four billed minutes and one billed minute are both zero
here, so **every figure in this section is now zero for CanonCore and unchanged for the two
providers**, which stay private under ADR-0089 and keep billing against the same 2,000. Read off
the organisation's billing API on 2026-09-11, September's usage
(`GET /orgs/{org}/settings/billing/usage`): `provider-wiki` 227 Actions-Linux minutes at net
$0.474, `provider-tmdb` 142 at net $0.378. The arithmetic did not stop being right. It stopped
being about this repository.

**CanonCore's own line in that same response is not a counter-example, and is stated rather than
tidied away.** It reads 346 minutes, gross $2.076, net **$0.060** — spend from earlier in the month,
while the repository was still private, the flip having happened part-way through the day. The API
returns one rolled-up line per SKU per repository, so it cannot be split by hour: that figure is
reported as the month's total, not attributed to a run either side of the flip.

**"Standard" is load-bearing in that quotation, and the arm64 runners were checked against it**
rather than assumed, because CNCORE-63's matrix landed the same day. GitHub's documented exception
is that larger runners are always charged for, even when used by public repositories.
`ubuntu-24.04-arm` is a standard runner, and the billing response carries CanonCore's Actions Linux
ARM line at 9 minutes, gross $0.045, **net $0.000**. Free here too — but "Actions is free for public
repos" is exactly the sentence a later reader will over-apply to a larger runner, which is why the
exception is written down beside it.

**Wall clock is not what this buys and must not be sold as such.** Runs finish in 74 seconds at the
median, and that number does not move at all — it is pinned by the provider job, which this does
not touch. Anyone optimising this file for speed is optimising the wrong variable.

## What was traded, and what bought it back

Eleven checks on a pull request became eight. A red `Static checks` did not say on its face whether
the typecheck, the lint, the build or the env guard broke.

**The step name was what carried that information.** A failing step is named in the job summary, so
the answer was one click away rather than absent — and the steps were deliberately **fail-fast**
rather than `continue-on-error` with a hand-rolled exit status. Fail-fast reports one failure per
run and names it; the alternative reports four verdicts at the cost of a guard nobody asked for and
a failing run that still pays for the build. The simpler arrangement was taken.

It was a real loss, not a free lunch. It was worth 24% of the CI bill and it was written down —
which is the only reason it could be reversed deliberately rather than drifted back into.

**CNCORE-80 bought it back for nothing, and the counts were observed rather than reasoned about.**
Both runs are `pull_request` runs on the branch that made the change:

| | Before ([run 34640281757]) | After ([run 34640682237]) |
|---|---|---|
| Jobs | **11** | **14** |
| The four checks | one job, `Static checks`, 41s | `Typecheck` 19s, `Lint` 19s, `Build` 33s, `Env guard` 19s |
| Job-seconds for the four | 41 | **90** |
| Billed minutes for the four | 1 if this were private, 0 as it is | 4 if this were private, **0** as it is |

[run 34640281757]: https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/34640281757
[run 34640682237]: https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/34640682237

**The billed row is GitHub's documented rule applied, not a per-run measurement, and the difference
matters.** The usage API returns one rolled-up line per SKU per repository per month, so no run can
be priced from it individually; what can be said is that these are standard runners in a public
repository, which is the case the documentation quoted above calls free. The job-seconds row is the
honest cost: three extra checkouts and installs, **49 more job-seconds**, worth nothing at this
repository's rate and worth three billed minutes at a private one's.

**Wall clock did not pay for it either, and the reason has moved since this record was written.**
The four ran in parallel and the last of them finished 33 seconds in, while the run itself ran to
1m53s. This record originally said the median was "pinned by the provider job"; since CNCORE-63 it
is pinned by the **image** jobs, which took 65s in the before run and 109s in the after one — a
difference twice the size of anything the split did, and caused by docker layer caching rather than
by this change. Two runs cannot establish a median. What they do establish is that the four checks
are nowhere near the critical path at either shape.

## Why four and not six

**The arithmetic in this section is dead letter here and retained for the repositories that still
pay.** It is the part of the record most worth keeping: it is how to decide a merge anywhere the
minutes are billed, and `provider-wiki` and `provider-tmdb` are both such places. The Postgres
paragraph at the end is the exception — its conclusion is still the live shape of this file, and
since CNCORE-80 it needs no billing argument at all: those four jobs test four different things, so
four jobs is simply what they are.

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

## The env guard runs the build and requires it to fail

The guard requires `pnpm build` to **fail**; the `Build` job requires the same command to succeed.
That looks like a conflict and is not, for a reason worth stating because it is the one thing that
could make the guard lie.

Under the merge the two were adjacent steps of one job, which made the question sharp: the guard
ran against a cache the successful build had just warmed. It is its own job again since CNCORE-80,
so it starts cold and the re-run is not in question at all. **The mechanism is recorded anyway,
because it is what keeps the guard honest under any cache**, including a remote one added later —
which is the use ADR-0053 puts it to.

`turbo.json` declares `DATABASE_URL` in the `build` task's `env`, so the value is part of the task
hash. Blanking it is a **cache miss** and the build genuinely re-runs. Measured in this repository
against a deliberately warmed cache, while the two shared a job: `0 cached, 1 total`, exit 1,
`Invalid environment variables`, **0.4 seconds**.

The obvious way to break that is not silent either, which is why no test guards it. Remove the
`env` declaration and Turbo 2's strict env mode stops passing `DATABASE_URL` to the task at all —
so the **successful** `Build` job fails, on every run, with the same validation error. Probed by
removing the declaration and running it: the build failed with a real `DATABASE_URL` in the
environment. There is no arrangement in which this job quietly stops biting.

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
repository's habits, and **does not survive its own measurement.** With the merge reversed there is
no 60-second billing boundary left in this repository to guard, so the proposal is doubly dead
here; the reasoning is kept because it is about measurement rather than about this pipeline.
Against the observed `Build` distribution a 50s threshold fails **27%** of builds, 55s fails 9%,
60s fails 2%. Any threshold
tight enough to warn early fires constantly; any threshold loose enough not to flake says nothing
the bill would not. A red check with no defect behind it gets disabled, and then it rots.

The error generalises and is the part worth keeping: **job duration is a noisy per-run sample, and
"is the merge still paying off" is a distribution over a month. Gating a distribution on a single
sample is a category error.** The instrument is the billing usage API, one call, already alerting
at 75/90/100% of the included allowance.

Also rejected, and recorded in the research rather than here so `docs/adr/` does not become a CI
changelog: Turborepo remote caching (saved 1 billed minute, zero wall clock, and fails open —
measured: warning, exit 0; the billed minute is worth nothing here now, and the fail-open behaviour
is why ADR-0053 cares about the env guard's cache key regardless) and path filters (a skipped
required check sits **Pending** and blocks the merge; the old same-name-workflow trick was retired
around GHES 3.2-3.4).

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
- **Each of the four static checks is its own named job**, since CNCORE-80 reversed the assertion
  this test used to make. It asserted `Set{ 'static-checks' }`; it now asserts four pairwise
  distinct carriers, each found by what its step RUNS rather than by a job name a rename could
  carry away. Merging `pnpm lint` back into the Typecheck job fails it with `exactly one job must
  carry the lint`; dropping a check fails the same assertion with an empty carrier list. Both forms
  were planted and run.
- **Nothing among the four stops failing the build.** Splitting the job back out did NOT retire this
  test, and the reason is worth stating because the first version of this paragraph implied it
  would. It claimed four separate jobs "could not be neutered one at a time without a check
  disappearing from the pull request". **Nothing disappears, under either key.**
  `continue-on-error` is documented as preventing "a workflow run from failing when a job fails":
  the job still runs, still sits on the pull request under its own unchanged name, and the run goes
  green regardless. An `if:` skips the job, and a skipped job is still listed — observed in this
  repository's own runs, where `One image, both architectures` reports `skipped` on every pull
  request rather than being absent. So separate jobs were never the protection that sentence
  claimed, and the assertion is now asked of each of the four rather than of one job's steps.
  **What GitHub renders as that individual check's conclusion is not documented and was not
  measured here**; the run-level pass is what the argument needs and all that is claimed.

  **The job level is checked as well as the step level**, because `continue-on-error` and `if` are
  valid job keys too and defang a whole check at once rather than one step of it — a
  first version of this test read only the steps, which is the half-built mechanism this record
  would otherwise have called complete. Planting `continue-on-error: true` on the Lint job fails it
  with `lint: job level`. A third assertion catches `pnpm lint || true`, the shell form neither key
  covers.

  **On the three one-command jobs that third assertion is not what bites, and the test says so
  rather than implying otherwise.** `pnpm build || true` is not `pnpm build`, so the carrier finder
  stops matching it, the carrier list goes empty and the assertion above fails first — planted, and
  it reports `exactly one job must carry the build`. What the shell form still catches is the env
  guard, whose `run:` is a script rather than a command, and any step added beside one of the four
  later.

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

**Measured while this repository was private, and kept for the two that still are.** Every figure
below is a real observation about how a merged job behaves near the billing boundary. None of it
costs CanonCore anything any more, and all of it still applies in `provider-wiki` and
`provider-tmdb`.

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

**The merge was measured on the runner rather than only modelled**, on the day it landed and while
this repository was still private. Two successful runs of the same pipeline, one either side of the
change:

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
