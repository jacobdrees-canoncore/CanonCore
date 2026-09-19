---
status: accepted
---

# Every CI job stops at three times its slowest measured run

Every job in `.github/workflows/ci.yml` carries a `timeout-minutes` of its own: three times the
slowest successful run that job has been measured taking, rounded up to a whole minute, and never
under five. `packages/config/src/ci-timeouts.test.ts` holds the measurements and the rule, and fails
when a job has no ceiling, when a ceiling is not what its measurement derives, or when a
measurement names a job that has gone.

## The defect: a hung job is not a red one

Absent `timeout-minutes`, GitHub gives a job **360 minutes** (the workflow syntax reference, read
2026-09-19 from its source in `github/docs`). The file set none, anywhere.

On 2026-09-19 CNCORE-178's pull request, #138, hung on three consecutive runs:
`The page over HTTP` and `Import and browse over HTTP, against the real provider-tmdb` stopped
printing inside their suite step and never ended. Measured off the Actions API:

| Run           | `The page over HTTP` | against the real provider-tmdb | Ended by             |
| ------------- | -------------------- | ------------------------------ | -------------------- |
| `35449043194` | 11.4 min             | 11.4 min                       | a person, cancelling |
| `35449620352` | 23.2 min             | 23.1 min                       | a person, cancelling |
| `35450796466` | 30.0 min             | 29.9 min                       | a person, cancelling |

Both jobs have a median under a minute and a half. Nothing in the repository would have ended them
before six hours, and nothing said they were stuck: a job that never exits reports neither a pass
nor a failure. **That is the hole CNCORE-160, CNCORE-190 and CNCORE-197 closed from the other
side.** They made every job prove its suite ran rather than exit zero having run nothing. A job that
never exits at all is the same silence, and since CI here is a convention rather than a required
check ([[0118-mains-history-is-append-only-and-ci-is-not-a-merge-gate]]), the only thing that ended
it was somebody's patience.

What made #138 hang was CNCORE-178's to find, and it did (`9eb795d`, "close the scopable instance,
which was hanging CI"): a server the e2e setup started and its teardown never closed outlived the
suite and held the step's output open, so every test had passed and the step still never ended.
This record makes a hang END. It says nothing about why one started.

## There is no default to set once

The obvious fix is one line at the top of the file. It does not exist: the workflow-level
`defaults` key takes `run.shell` and `run.working-directory` and nothing else. So every job carries
its own, and a job added tomorrow without one is back at six hours with nothing in its diff saying
so. That is why the check is a test rather than a convention.

**It is established practice, not a local invention.** ghalint, a linter for Actions workflows,
carries the same rule as its policy 012, `job_timeout_minutes_is_required`, for the same reason.
It was run against this file (v1.5.6, 2026-09-19) rather than adopted. It flagged all fifteen jobs
for the timeout, and alongside them every job for a missing `permissions` block, every action for
not being pinned by commit SHA, and a checkout for `persist-credentials`. The SHA rule is one
`ci-workflow.test.ts` refuses on purpose, and none of the rest was asked for here. Adopting the tool
for one policy would mean a binary in CI and a config switching the others off, where the existing
suite already parses this file. And ghalint can ask whether a ceiling exists. It cannot ask whether
the ceiling came from anything.

## The measurement

**The owner of a CI job's duration is the runner, not a laptop.** The ticket pointed at ADR-0104
and CNCORE-137 for figures, and those carry Postgres connection counts on the development Mac: a
different machine answering a different question. The durations below come from the Actions API.

Every attempt of the 600 runs of `CI` created 2026-09-11T18:52Z to 2026-09-19T15:50Z, successful
jobs only, each timed from the job's own `started_at` to its `completed_at`:

| Job                                                                     | Runs | Median | Slowest | Ceiling |
| ----------------------------------------------------------------------- | ---: | -----: | ------: | ------: |
| `secrets`: Secret scan                                                  |  608 |    12s |     52s |   5 min |
| `docs`: Agent docs                                                      |  604 |     6s |     41s |   5 min |
| `typecheck`: Typecheck                                                  |  559 |    20s |     58s |   5 min |
| `lint`: Lint                                                            |  561 |    17s |     84s |   5 min |
| `build`: Build                                                          |  553 |    33s |     74s |   5 min |
| `env-guard`: Env guard                                                  |  562 |    17s |     83s |   5 min |
| `test`: Test                                                            |  574 |    81s |    216s |  11 min |
| `migrations`: Migration ladder                                          |  593 |    46s |    114s |   6 min |
| `e2e`: The page over HTTP                                               |  575 |    80s |    159s |   8 min |
| `browser`: The page in a browser                                        |  350 |    81s |    116s |   6 min |
| `credentials`: Which provider credentials this run can reach            |   69 |     3s |      4s |   5 min |
| `provider`: Import and browse over HTTP, against the real provider-tmdb |  207 |    86s |    166s |   9 min |
| `contract`: One contract, both providers, no app                        |  540 |    42s |     73s |   5 min |
| `image`: The image, built and run (linux/amd64, ubuntu-latest)          |  549 |   114s |    413s |  21 min |
| `image`: The image, built and run (linux/arm64, ubuntu-24.04-arm)       |  557 |    99s |    245s |  21 min |
| `image-manifest`: One image, both architectures                         |  134 |    19s |     64s |   5 min |

A job can succeed more often than there are runs, because a rerun is a second attempt at it.

**The span is the larger of the two readings, on purpose.** A job's `started_at` can precede its
first step by two minutes (the slowest `Test` above spent 113 seconds before `Set up job` began), so
timing from the job rather than from its steps can only over-state a duration, never under-state it.

**The window is 600 runs because 200 missed the image's shape.** The first measurement took the
200 most recent, 2026-09-13 onward, and put `image` at 13 minutes off an arm64 run of 245 seconds.
The slowest image run is older: a push to `main` on 2026-09-12 (`34710132555`) whose build step took
330 seconds against a median of 63, a cold cache doing the whole build, and 413 seconds in all. A
13-minute ceiling would have held that build, but with under twice its length to spare where the
rule means three times, so the image's ceiling is 21. "The image builds have their own shape" turned
out to mean the cold build.

**Two legs, one ceiling.** `image` is a matrix over two runners and a job carries one
`timeout-minutes`, so it takes the slower leg's figure: amd64's cold build. Giving each leg its own
would mean a matrix field and an expression the test would have to evaluate, to buy back minutes
that only a hung arm64 build would spend.

## The rule

`ceiling = max(5, ceil(3 × slowest / 60))`, in minutes.

**Three times the slowest, not the median.** For every job whose median is over a minute, the
slowest run is already 1.4 to 2.7 times it, and 3.6 for the image's cold build. So the spread a
healthy runner shows is inside the figure before any headroom is added. Tripling it leaves room for
the suite to grow before its ceiling has to be measured again, and the cost of being wrong is
lopsided in a known direction: a ceiling set too tight costs one rerun, and one set too loose costs
its own length on every hang.

**Five minutes at least, for the jobs whose own work is seconds.** Two costs land on a job whatever
its work is, and each lands on ONE job of a run at random rather than on the whole run. The first is
the wait between a job starting and its first step: a second at the median, and up to 113. Of 7,972
successful jobs, 23 waited over half a minute, each the only one in its run to do so while the next
longest waited one or two seconds. The second is a setup spike: `pnpm/setup` takes a median of ten
seconds across 5,566 successful steps, and eleven of them took between 26 and 78. Each time, the
next slowest `pnpm/setup` in the same run took 11 to 14 seconds, so this is not a cold cache, which
would slow the whole run. A short job's own sample may contain neither: tripled, `credentials`'s
four seconds would be one minute.

Together the two come to about three minutes, and the largest median among the jobs the floor
raises is `contract`'s 42 seconds, so five minutes covers the worst of both on top of any of them
with over a minute to spare. That is the measurement five stands on; the number itself is chosen
above it, and it is still minutes. The floor raises seven ceilings: `secrets`, `docs`, `typecheck`,
`build`, `credentials`, `contract` and `image-manifest`. `lint` and `env-guard` reach five by the
rule itself, which is why nine jobs read five.

## Moving a ceiling

A number in `ci.yml` does not move on its own: the test fails unless it is what its measurement
derives. **A ceiling moves by measuring again.** This query produced the slowest column above; move
the `--created` window forward to take a new measurement:

```sh
gh run list --workflow CI --created '2026-09-11T18:52:14Z..2026-09-19T15:50:02Z' --limit 1000 \
    --json databaseId --jq '.[].databaseId' |
  while read -r id; do
    gh api "repos/jacobdrees-canoncore/CanonCore/actions/runs/$id/jobs?per_page=100&filter=all" \
      --jq '.jobs[] | select(.conclusion == "success")
            | [.name, ((.completed_at | fromdate) - (.started_at | fromdate))] | @tsv'
  done | sort -t$'\t' -k1,1 -k2,2n |
  awk -F'\t' '{slowest[$1] = $2} END {for (j in slowest) print slowest[j] "\t" j}'
```

**The query was run as printed**, over that window, on 2026-09-19. It read 600 runs and printed 18
lines: the 16 figures in the table above, exactly, and two names no job carries any more. `Static
checks` is the job `cb270bf` split into four on 2026-09-11, and `Import and browse over HTTP,
against the real provider` is the `provider` job's name before CNCORE-143 gave it one provider. The
query reads names rather than job ids, so a renamed job's history stays behind under its old name.

**A new job fails the test on its first push, and that is the order it happens in.** It has no
figure until it has run. CI runs it anyway, and that run is its first measurement. It still needs a
provisional ceiling generous enough to finish, or that first run is the one in the file with six
hours to hang in.

**A healthy run reaching its ceiling is a finding, not a flake.** It means the suite has tripled
since it was last measured. The job's recent runs will all have been cut at the ceiling, so none of
them is a measurement: lift the number for one run, read what it took, and record that.

## The hang, demonstrated

Commit `38fde90` added one step to `The page over HTTP`, after its suite: `sleep 86400`, which
restages #138's shape: the suite passes, and the job never ends. Commit `f13845d` reverted it. Run
`35454181160`, job `105926444645`, read back from the Actions API:

| Step                                                   | Began    | Ended    | Conclusion  |
| ------------------------------------------------------ | -------- | -------- | ----------- |
| Set up job                                             | 16:12:00 | 16:12:01 | `success`   |
| The page over HTTP, and a count that says a suite ran  | 16:12:37 | 16:14:22 | `success`   |
| Hang after the suite has passed, as #138 did           | 16:14:22 | 16:20:12 | `cancelled` |
| Complete job                                           | 16:20:13 | 16:20:13 | `success`   |

The job ran from 16:11:59 to 16:20:15, **8m16s against a ceiling of eight**, where #138's ran for
half an hour and would have run for six hours. Every other job in that run passed. It was the second
run of the fifteen ceilings on a real runner, and neither cut anything healthy. On the first, for
`e178b40`, `Typecheck` took 88 seconds against the window's slowest of 58, and 68 of them were
spent before its first step: the first of the two costs the floor is for, landing on one job at
random.

**GitHub records a timeout as `cancelled`, not `failure`, and that is the finding worth keeping.**
The job, its check run and the whole workflow run all read `cancelled`: the same conclusion a person
cancelling produces, and the one a run superseded under the concurrency key gets. What tells them
apart is the check run's two failure-level annotations:

```
The job has exceeded the maximum execution time of 8m0s
The operation was canceled.
```

**The pull request is not fooled.** The commit's check rollup read `FAILURE`, so the PR showed red,
and `gh pr checks` listed the job as `fail`. So a reader of the PR sees a failure, and a reader of
the run list sees a cancellation and has to open it to learn which kind. Anything that later counts
runs by conclusion must read that annotation rather than the conclusion, or it will count every
timeout as somebody's click.

**Which clock the ceiling runs on, this run cannot say.** The job started one second before its
first step, so eight minutes from either lands within a second of the other, and the hang was
cancelled thirteen seconds past the one and twelve past the other. A run with a long wait before its
first step would settle it. Nothing depends on the answer: the figures are timed from the job, which
is the larger reading, so a ceiling counted from the first step has more room rather than less.

## What this does not do

- **It does not end a hang quickly.** It ends one within minutes rather than hours: up to 21 for
  `image` and 11 for `Test`, against 360. A job that stops printing is visibly stuck well before its
  ceiling. CircleCI's `no_output_timeout` (default ten minutes) and Travis CI's ten-minute limit on
  a job producing no output both kill on exactly that, read from their own documentation 2026-09-19.
  GitHub has no such mechanism, and building one would mean wrapping every step, which is not asked
  for here.
- **It does not say why a job hung.** The log shows which step was running when the ceiling fell.
- **Two figures rest on small samples.** `credentials` has 69 runs behind it, since it has existed
  only since 2026-09-18, and `image-manifest` 134, since it runs only on `main` and version tags.
  Both are far under the floor, so neither ceiling depends on its figure yet.
