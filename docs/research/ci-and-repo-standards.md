# CI speed, and one standard across three repositories

**Researched 2026-09-11.** Two questions were asked. How fast can CanonCore's GitHub Actions
pipeline be made, with speed as the goal; and what should be consistent across the three
repositories `jacobdrees-canoncore` now holds — CanonCore, provider-wiki and provider-tmdb.

It proposes. It decides nothing — the ADRs are Jacob's to write, and nothing here is one. No
workflow file was edited, no repository setting was changed, no Linear ticket was created or moved.
Three implementers were live in this repository while it was written (CNCORE-8, CNCORE-24 and
others) and nothing here touches `.github/workflows` or `docs/adr/`.

## How to read this

Section 0 is the finding that reframes the brief, and it is the reason to read the rest: the
binding constraint on this pipeline is not wall clock and is not the cold cache. Section 1 puts
every measurement in the brief back on the forge and says which held, which drifted and which were
artefacts of how they were taken. Sections 2 to 7 are one per question. Section 8 is the decision
list, ranked by what saves the most for the least. Section 9 says what changes.

**Section 10 records what was decided on 2026-09-11, the same day this file was written**, and it
is not an afterthought: the grilling that produced it corrected **eight factual claims in the body
above**, killed one recommendation the session itself proposed, and surfaced the constraint that
turns out to decide the largest question here — the billing-boundary step function in section 5.
Every entry in section 8 carries a `Decided` note. If you are checking a number this file gave you
before that date, section 10 has the table of which ones moved.

Where a claim is a measurement, the command that produced it is given and the date it was taken.
Where a claim could not be established it is marked as a gap rather than filled in.

**Two of the brief's measurements did not survive, and one finding was not in the brief at all.**
They are in section 1 and section 0 respectively. Neither changes what should be done; both change
why.

---

## 0. The finding that reframes the question

The brief asks for speed and sets a cost bound: everything should be reachable on GitHub Free.
Both of those turn out to be governed by a number nobody has looked at.

```
$ gh api "/orgs/jacobdrees-canoncore/settings/billing/usage?year=2026&month=9"
$ gh api /orgs/jacobdrees-canoncore/settings/billing/budgets
```

Read 2026-09-11:

| Fact | Value |
|---|---|
| Plan | `free` (`gh api /orgs/jacobdrees-canoncore` → `.plan.name`) |
| Included Actions minutes, private repos, Free | **2,000 / month** (GitHub billing docs) |
| Consumed so far in September 2026 | ~~**1,534 minutes**~~ → **2,739 minutes**, re-read 2026-09-11 (see the correction below) |
| Remaining | ~~**466 minutes**~~ → **none; the allowance is exhausted** |
| Charged so far | ~~**$0.00**~~ → **$4.038**, 673 paid minutes |
| Actions budget | ~~**$0**~~ → **$20**, `prevent_further_usage: true`, organisation scope |

**THE STRUCK FIGURES ARE A SNAPSHOT THAT WENT STALE INSIDE THE SAME DAY, AND THEY ARE CORRECTED
HERE RATHER THAN BELOW**, because a reader who stops at this table is the reader who acts on them.
Re-measured 2026-09-11 with `gh api "/orgs/jacobdrees-canoncore/settings/billing/usage?year=2026&month=9"`,
summing the ten Actions Linux line items: **2,739 minutes** — CanonCore 2,374, `provider-wiki` 227,
`provider-tmdb` 138. `discountAmount` totals **$12.396** (2,066 minutes absorbed at the reported
`pricePerUnit` of 0.006) and `netAmount` **$4.038**, so **673 minutes are already billable** and the
first chargeable line appeared at `2026-09-11T07:53:44Z`. The budget was raised to **$20** the same
day — recorded at the end of this document — so the $0 figure was never wrong so much as overtaken.

Two notes for whoever measures next. **The two legacy endpoints are gone**:
`/orgs/{org}/settings/billing/actions` returns `410 "This endpoint has been moved"`, and the
`/users/{user}` form returns 404 and needs a `user` scope this token lacks. And **the API exposes no
`included_minutes` field** — the 2,000 above is a documentation figure, not a measured one; what the
API actually reports is the discount.

The last row is the one that matters. There is an organisation-scoped budget of zero dollars on
the `actions` SKU with `prevent_further_usage` set — and the same on `packages`, `codespaces` and
`git_lfs`. GitHub's billing documentation: *"If your account does not have a valid payment method
on file, usage is blocked once you use up your quota."*

So the failure mode at the end of the allowance is not a bill. **It is Actions stopping, across
all three repositories, until October.**

### How close that is

Billed minutes per run, measured rather than modelled. 2026-09-11 ran 8 CanonCore runs of the
current 11-job pipeline. By the end of that day it had run **19 and billed 255 minutes: 13.4
billed minutes per run.** Real compute for the same pipeline is 7.0 minutes of summed job time, so
the billing overhead is **1.9×**. Section 5 explains where that factor comes from.

(An earlier draft of this file said 12.4, from 99 minutes over the first 8 runs of that day. The
fuller sample is the one to use, and it makes the problem slightly worse rather than better.)

- 466 remaining minutes ÷ 13.4 = **about 35 more runs this month.**
- 2026-09-10, the day three implementers were live, ran **134 CanonCore runs.**
- The full monthly allowance, at today's pipeline shape, is **149 runs — 7.5 runs a day across 20
  active days.**

**That threshold is the durable form of this finding, and it does not depend on 2026-09-10 being
typical.** Every active day this repository has had has beaten 7.5 runs. A deliberately quiet
month of 10 runs a day is already 1.3× over the allowance; 20 a day is 2.7× over. So the pipeline
outgrows its allowance at volumes far below the one exceptional day, and the projection would
still hold if 134 runs never happened again.

That is the reframing. Asked for speed, the pipeline's honest answer is that wall clock is already
fine — 74 second median, 89 at p90 — and the thing about to break is the budget, which stops CI
dead rather than slowing it down. Every option below is therefore priced in **billed minutes**
first and wall clock second, because billed minutes are what runs out.

### Why job count is the cost unit

GitHub's Actions billing documentation: *"GitHub rounds the minutes and partial minutes each job
uses up to the nearest whole minute."* Per **job**, not per run and not per second.

Measured against that rule, across 45 sampled runs (442 jobs): **312 of 442 jobs ran in under 60
seconds** and each of them billed a full minute. The `Lint` job is the clearest case — its `pnpm
lint` step has a median duration of **0 seconds** (Biome across the whole repo, 19 seconds total
across 45 runs) inside a job that bills a whole minute.

This single rule decides most of what follows. A change that makes a job *faster* saves nothing
unless it drops the job below a minute boundary. A change that makes a job *disappear* saves a
minute every run, always.

---

## 1. The measurement, put back on the forge

Every figure in the brief was re-taken on 2026-09-11 from the Actions API over the repository's
full history — 163 runs from 2026-09-03 to 2026-09-11, not a 40-run sample. Scripts are in the
session scratchpad; the API calls are `gh api repos/jacobdrees-canoncore/CanonCore/actions/runs`
and `.../runs/<id>/jobs`.

| Brief's claim | Verdict | What the wider sample says |
|---|---|---|
| No `concurrency` group in **any** workflow | **Partly wrong** | True of CanonCore. **Both provider repos already have one**, and it is already firing. See below. |
| 40 runs sampled, **zero cancelled** | **Holds, and stronger** | 163 CanonCore runs, **zero cancelled**. Confirmed across the whole history, not a sample. |
| Branches re-ran 3 to 6 times | **Holds** | 116 pull_request runs over 32 branches, **mean 3.6 per branch**, worst 16. |
| Median wall clock 85s | **Drifted** | **74s** median over 162 completed runs (min 12s, p90 89s). The brief's 85 is within the noise of a smaller sample. |
| Max 2,371s | **Artefact** | See below. The real maximum is **143s**. |
| 486 job-seconds across 10 jobs | **Holds exactly, shape moved** | 486 median job-seconds confirmed. But the pipeline is now **11 jobs**. |
| 8 of 10 jobs run their own install; 10 checkouts; 4 Postgres services | **Moved** | `origin/main` today: **9** `pnpm/setup@v2`, **11** `actions/checkout@v7`, **4** `postgres:18`. |
| No Turborepo remote cache | **Holds** | No `remoteCache` key in `turbo.json`, no `TURBO_TOKEN` secret, no `actions/cache` step. |
| No descriptions on CanonCore and provider-wiki, no topics anywhere, no licence anywhere | **Holds** | Verified on all three, section 6. |

### The 2,371-second run was a manual re-run, not a slow pipeline

```
$ gh api repos/jacobdrees-canoncore/CanonCore/actions/runs/34528480252
{"run_attempt": 2, "created_at": "2026-09-10T20:47:42Z",
 "run_started_at": "2026-09-10T21:25:40Z", "updated_at": "2026-09-10T21:27:13Z"}
```

`created_at` is stamped by attempt 1; `updated_at` by attempt 2 finishing. Attempt 1 ran in 79
seconds and failed on `The import over HTTP, against the real provider`. The 2,292 seconds between
them is **a person deciding to press re-run**, and measuring `created_at → updated_at` bills that
thinking time to the pipeline. The other apparent outlier, run #152 at 346s, is the same artefact
(`run_attempt: 2`).

Excluding re-run attempts and measuring `run_started_at → updated_at`, the distribution is:

```
min 12s   median 74s   mean 60s   p90 89s   max 143s
```

**This matters because it removes the only evidence that anything here is slow.** There is no
long tail. There is no queueing problem either: the worst observed job queue delay across 45 runs
is 39 seconds, median 3. GitHub Free allows 20 concurrent jobs and this pipeline wants 11 of them
per run, so the limit is reachable with two simultaneous runs — but it has not yet bitten, and no
recommendation below rests on it.

### The providers already have what CanonCore is missing

Both `provider-wiki/.github/workflows/ci.yml` and `provider-tmdb/.github/workflows/ci.yml`, read
2026-09-11, carry:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

So the brief's first sentence is true of CanonCore and false of the organisation. The standard
already exists in two of three repositories; **CanonCore is the outlier, not the pioneer.** That
inverts the framing of question 1 from "should we adopt this" to "why does the largest repository
not have what the two small ones do" — and, as section 2 shows, the version the providers have is
the one with the defect.

---

## 2. Concurrency: what the group key should be

### The syntax, from the owner

GitHub's workflow-syntax reference, read 2026-09-11: *"Use `concurrency` to ensure that only a
single job or workflow using the same concurrency group will run at a time."* And *"By default,
any existing `pending` job or workflow in the same concurrency group will be canceled and the new
queued job or workflow will take its place."*

The brief is right that GitHub says nothing about sparing the default branch. It does document the
mechanism that achieves it, in the "fallback value" example:

```yaml
concurrency:
  group: ${{ github.head_ref || github.run_id }}
  cancel-in-progress: true
```

with the reasoning stated outright: *"`github.head_ref` is only defined on `pull_request`
events"*, and *"if `github.head_ref` is undefined, the concurrency group will fallback to the run
ID, which is guaranteed to be both unique and defined for the run."*

**One correction to GitHub's own wording, because it matters if this key is ever reused.** The
contexts reference is more precise than the workflow-syntax page: `head_ref` *"is only available
when the event that triggers a workflow run is either `pull_request` or `pull_request_target`."*
So "only on `pull_request`" is an accurate quote of one page and an inaccurate statement about the
product. Nothing here changes — CanonCore's CI triggers on `pull_request` and `push` only, and
neither provider uses `pull_request_target` — but a workflow that added that trigger would find
`head_ref` defined and its runs grouped with the matching pull request's.

That is the whole answer to question 1. On a pull request, every run of a branch shares a group
and the newest cancels the rest. On a push to `main`, `head_ref` is empty, the group becomes the
run's own id, the group has exactly one member, and **nothing can ever cancel it.** The default
branch is spared as a consequence of the key, not by a condition that has to be maintained.

GitHub also documents a conditional form, `cancel-in-progress: ${{ !contains(github.ref,
'release/') }}`, for sparing named branches. It is the wrong tool here: it spares by matching a
string, so a renamed branch silently loses its protection, and this repository has no release
branches to spare.

Combined with the `github.workflow` prefix the providers already use — documented as *"To only
cancel in-progress runs of the same workflow"* — the proposed key is:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: true
```

### What the providers have is the version with the defect, and it has already fired

`${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true` makes **every** ref its
own group, `refs/heads/main` included. Two merges close together and the first one's CI is
cancelled.

That is not a hypothetical. It happened in this organisation on 2026-09-10:

```
$ gh api "repos/jacobdrees-canoncore/provider-wiki/actions/runs?per_page=100"
run 18  push  main  1be88b47  cancelled  2026-09-10T21:19:00Z
run 19  push  main  aada82e5  success    2026-09-10T21:19:05Z

$ gh api repos/.../actions/runs/<18>/jobs
check   cancelled   2026-09-10T21:19:03Z → 2026-09-10T21:19:28Z
image   cancelled   (never started)
```

Commit `1be88b47` reached `main` in provider-wiki and **its CI was cancelled 28 seconds in and
never re-run.** Its `image` job — the one that builds the container CanonCore's CI pulls as a
service, proves it answers CMPP, publishes it and asserts it is still private — did not run at
all. Run #19 five seconds later is a different commit (`aada82e5`), so nothing covered it.

This collides with a rule this repository already holds. CNCORE-3 deleted a check that could pass
without running and CNCORE-13 restated the rule. A cancelled run is not a false green — it shows
as cancelled, not success — but on the default branch there is no pull request holding it open and
no one waiting on it, so the outcome is the same in practice: **a commit on `main` with no
verdict, and nothing that will ever produce one.** The `head_ref || run_id` key removes the
possibility rather than relying on someone noticing.

### What it would have saved, quantified

This is where the honest answer is unwelcome. Superseded runs were identified by replaying the
full history: a run is superseded if a later run in the same group started before it finished, and
the saving is the doomed run's remaining time.

| Sample | Runs | Superseded | Wall clock reclaimed |
|---|---|---|---|
| All 162 completed runs, keyed by event + branch | 162 | **9 (6%)** | 604s (10.1 min) |
| `pull_request` only, keyed by branch | 116 | **4 (3%)** | 292s (4.9 min) |
| Last 40 completed runs, matching the brief's sample | 40 | **2 (5%)** | 74s (1.2 min) |

Four superseded pull-request runs in eight days. The largest single saving available was 111
seconds, on `jacobdrees/design-multi-repo` run #92.

**Concurrency is not a speed measure at this repository's scale, and it should not be sold as
one.** Runs finish in 74 seconds; an agent rarely pushes twice inside 74 seconds. In billed
minutes the four superseded pull-request runs are worth perhaps 20 to 30 minutes a month against
a 2,000-minute allowance — roughly 1%.

What it is worth doing for is the defect above. It costs three lines, it cannot regress, and it
closes a hole that has already produced one unverified commit on a default branch. Price it as
insurance, not as speed.

---

## 3. The cold-cache problem

### What Turborepo can actually cache here

Before pricing a cache, measure what there is to cache. Run 2026-09-11 in this worktree:

```
$ pnpm turbo run build     --dry=json | jq '[.tasks[] | select(.command != "<NONEXISTENT>")] | length'
1
$ pnpm turbo run typecheck --dry=json | ... → 9
$ pnpm turbo run test      --dry=json | ... → 9
```

`build` executes **exactly one task**: `web#build`. The eight packages export TypeScript source
directly and have no build step, which `README.md` says outright. So the most expensive cacheable
task in the repository is all-or-nothing: any change reaching `apps/web` or anything it imports
invalidates the whole of it, and there is no partial hit to collect.

And from `turbo.json`, every other task in CI is `"cache": false` — `test:e2e`, `db:migrate`,
`db:check-ladder`, `db:seed`, `db:setup`, `db:start`. That is the decisive fact:

**The two slowest jobs in the pipeline run `pnpm test:e2e`, which Turborepo is configured never to
cache. The critical path contains no cacheable task at all.**

| Job | Median | Cacheable turbo task inside it? |
|---|---|---|
| Import and browse over HTTP (provider) | **78s** | No — `test:e2e`, `cache: false` |
| The page over HTTP (e2e) | **73s** | No — `test:e2e`, `cache: false` |
| Test | 68s | Yes — `pnpm test`, 22s of it |
| Migration ladder | 53s | No — `db:*`, all `cache: false` |
| One contract, both providers, no app | 45s | No |
| Build | 43s | Yes — `pnpm build`, 23s of it |
| Typecheck | 26s | Yes — `pnpm typecheck`, 5s of it |

So a **perfect** remote cache hit — every cacheable task restored, which only happens when nothing
those tasks read has changed — removes 23 + 5 + 22 = **50 of 486 job-seconds (10%)** and moves the
**wall clock not at all**, because the 78-second job it would have to shorten has nothing in it to
restore.

### In billed minutes, which is the metric that binds, it is worse

Applying the per-job rounding rule from section 0 to a perfect hit:

| Job | Today | Perfect hit | Billed today | Billed after |
|---|---|---|---|---|
| Build | 43s | 20s | 1 min | 1 min |
| Typecheck | 26s | 21s | 1 min | 1 min |
| Test | 68s | 46s | 2 min | **1 min** |

**A perfect Turborepo cache hit saves exactly one billed minute per run** — the `Test` job
crossing back under sixty seconds. One minute against 13.4, and only on a hit, and a full hit
means nothing changed, and if nothing changed the run had little to tell anyone anyway. At the
2026-09-10 rate of 134 runs that is 134 minutes a day of a 2,000-minute monthly allowance, in the
best case that never occurs on a real pull request.

### Price both, as asked

**Turborepo remote caching via Vercel.** The cost objection does not apply and should be retired:
Turborepo's own documentation says *"Vercel Remote Cache is free to use on all plans, even if you
do not host your applications on Vercel"*, and Vercel's pricing page says *"Vercel Remote Cache is
free for all plans, subject to fair use guidelines"* with the Hobby tier at 100GB/month upload and
100 artifact requests/minute. Artifacts expire after 7 days. Hobby is a non-commercial tier, which
ADR-0100 makes CanonCore eligible for. Setup is a Vercel account, `turbo link`, a `TURBO_TOKEN`
secret and `TURBO_TEAM` variable in every job — or OIDC, which Turborepo now marks *"(recommended)"*
over a long-lived token.

**`actions/cache` over turbo's cacheDir.** No vendor, no account, no token. GitHub's dependency
caching reference: 10 GB per repository, eviction by last-access when full, and *"GitHub will
remove any cache entries that have not been accessed in over 7 days"* — the same 7 days Vercel
gives. Turborepo's own GitHub Actions guide presents it as the alternative: *"you could use
actions/cache to cache your monorepo artifacts on GitHub"*, caching the `.turbo` directory.

The branch scoping is the part that decides whether it would work at all, and it is documented:
*"Workflow runs can restore caches created in either the current branch or the default branch
(usually `main`)"*, and *"If a workflow run is triggered for a pull request, it can also restore
caches created in the base branch"*, but *"Workflow runs cannot restore caches created for child
branches or sibling branches."*

For this repository's shape that is actually favourable — `main` is pushed on every merge, so it
seeds a cache every pull request can read, and branches re-run 3.6 times on average so within-branch
hits exist too. Three implementers on three sibling branches cannot share with each other, but they
can all read `main`.

**Neither option's scoping is the problem. The problem is that there is only one billed minute
behind either of them.**

### The fail-open failure mode is real, and was measured rather than assumed

The brief's worry — "a cache that saves 40s but fails open silently is worse than none" — is
exactly what happens. Turborepo's configuration reference documents the timeouts (`timeout`
default **30** seconds for cache operations, `uploadTimeout` default **60** seconds for uploads)
but **does not document what happens when the cache is unreachable.** That is a gap in the vendor's
documentation, so it was measured here instead:

```
$ TURBO_API=http://127.0.0.1:9 TURBO_TOKEN=fake TURBO_TEAM=fake \
    pnpm turbo run typecheck --force
 WARNING  could not connect to the cache
 WARNING  could not connect to the cache
 Tasks:    9 successful, 9 total
 Time:     980ms
$ echo $?
0
```

**Turbo prints a warning, exits 0, and the build is green.** A remote cache that is misconfigured,
whose token has expired, or whose vendor is down is a silent no-op that still reports success —
and nothing in CI fails to tell anyone. Connection-refused is instant; an endpoint that *hangs*
rather than refuses burns up to the documented 30-second `timeout` per operation before falling
through, which would make the pipeline slower than having no cache at all.

That is a defect in the same family the repository already legislates against: a mechanism whose
failure is invisible. CanonCore's own `ci.yml` carries a hand-written guard because `turbo run
test` exits 0 having run zero tasks. A remote cache would need an equivalent guard — assert a hit
rate, or assert the cache was reachable — and that guard is more work than the one minute it
protects.

### Verdict

**Neither. Not now.** This is the entry the mid-turn instruction names exactly: a cost with no
case, where "keep paying because it might help" is the answer to reject when nothing needs it. The
cost here is not money — Vercel's is free and `actions/cache` is free — it is a vendor account, a
credential in every job, a `turbo.json` key, and a failure mode that reports success. The case is
one billed minute per run in a scenario that does not occur on a real pull request, and zero
seconds of wall clock.

The trigger that would reopen it is named in section 8: a cacheable task landing on the critical
path, or `web#build` growing past the point where 23 seconds is the number.

---

## 4. The eight installs, and which metric they are wrong against

### Say the metric first, as asked

Three metrics were available and they disagree, which is why the question is worth asking.

| Metric | Today | Is it a problem? |
|---|---|---|
| **Wall clock** | 74s median, 89s p90, 143s max | **No.** Nothing here is slow. |
| **Job-seconds** | 486 per run | Only as a proxy. Nothing bills job-seconds. |
| **Billed minutes** | **13.4 per run; 466 left of 2,000; hard stop at zero** | **Yes. This is the one that binds.** |

So: **billed minutes**, because that is what runs out and what stops the pipeline. Wall clock is
already good enough that optimising it further has no user. Job-seconds are the wrong unit
entirely — GitHub does not bill them, and the 1.9× gap between 7.0 real minutes and 13.4 billed
ones is exactly the error you make by reasoning in them.

### Against that metric, the installs are not the problem

`pnpm/setup@v2` has a median of **13 seconds** across 352 invocations, and that is already the
cached path — the workflow sets `cache: true`, so 13 seconds is restore-plus-link, not a cold
resolve. Nine of them per run is 117 job-seconds, about a quarter of the total.

But they run **concurrently**, so they cost nothing in wall clock. And they cannot be removed from
billed minutes without removing the **jobs**, because a job that goes from 26 seconds to 13 still
bills one minute. **Shaving the install saves nothing. Deleting the job saves a minute.**

So the answer to "should eight parallel installs be a shared workspace" is: the premise is right
that they are redundant and wrong that sharing them is the fix.

### The shared-workspace options, priced

**A prepared-workspace artifact** (one setup job, `upload-artifact`, `download-artifact`
everywhere else). Measured in this worktree 2026-09-11:

```
$ du -sh node_modules
740M    node_modules
$ find node_modules -maxdepth 3 -type l | wc -l
318
```

740 MB, and that is a pnpm store — a symlink farm into `.pnpm`, with 318 links in the top three
levels alone. `actions/upload-artifact`'s README states *"File permissions are not maintained
during zipped artifact upload. All directories will have `755` and all files will have `644`"*,
which breaks any binary in `node_modules/.bin`. The README says nothing about symlink handling —
a genuine gap in the vendor's documentation, and not one worth resolving, because uploading and
downloading 740 MB nine times cannot beat a 13-second cached install on any metric. **Dead on the
measurement.**

**A single setup job the others `needs:`.** This is worse than doing nothing. `needs:` serialises:
every downstream job waits for setup to finish before starting, which converts a 13-second
parallel cost into a 13-second serial one added to the front of the critical path, and the
downstream jobs still have to fetch the workspace somehow. Wall clock goes **up**, billed minutes
stay the same because the job count is unchanged or higher.

**A shared cached store.** Already in place. `cache: true` on `pnpm/setup@v2` is this, and the 13
seconds is what it costs after the cache hit.

### So: the eight parallel installs are correct, and the eight jobs are not

The installs are right for wall clock and irrelevant to billed minutes. The thing that is wrong is
one level up — there are nine jobs each paying a fixed ~15-second entry fee (1s job setup, 1s
checkout, 13s `pnpm/setup`) and each rounding up to a whole minute, several of them to do a few
seconds of work. That is section 5.

---

## 5. Job shape

### Where the time actually goes

Step medians across 45 runs, 2026-09-11:

| Step | n | Median | Total across sample |
|---|---|---|---|
| Initialize containers (the Postgres services) | 172 | **26s** | 4,841s |
| Run `pnpm/setup@v2` | 352 | **13s** | 4,874s |
| Run `pnpm test:e2e` | 76 | 27s | 1,995s |
| Run `pnpm build` | 45 | 23s | 984s |
| Test, and assert a suite actually ran | 45 | 22s | 974s |
| Run gitleaks | 45 | 10s | 486s |
| Run `pnpm typecheck` | 45 | 5s | 216s |
| Run `actions/checkout@v7` | 442 | 1s | 584s |
| Set up job | 442 | 1s | 434s |
| Build must fail (env-guard) | 45 | 1s | 38s |
| Run `pnpm lint` | 45 | **0s** | 19s |

The two largest aggregates are both overhead: **container initialisation, 4,841 seconds** across
four Postgres services per run, and **install, 4,874 seconds** across nine jobs. Together they are
roughly 208 of every run's 486 job-seconds — **43% of the pipeline is getting ready to work.**

### Five of eleven jobs spend more time preparing than working

| Job | Median | Overhead | Real work | Work as % |
|---|---|---|---|---|
| Lint | 22s | ~15s | **0s** (`pnpm lint`) | **~2%** |
| Agent docs | 6s | ~2s | ~4s (two shell loops) | 67% |
| Typecheck | 26s | ~15s | 5s | 19% |
| Missing DATABASE_URL fails the build | 23s | ~15s | 1s | 4% |
| Secret scan | 16s | ~2s | 10s | 63% |
| Build | 43s | ~15s | 23s | 53% |
| One contract, both providers, no app | 45s | ~15s | ~2s | 4% |
| Migration ladder | 53s | ~41s | ~5s | 9% |
| Test | 68s | ~41s | 22s | 32% |
| The page over HTTP | 73s | ~41s | 27s | 37% |
| Import and browse (provider) | 78s | ~41s+ | 27s | 35% |

Biome lints the entire repository in under half a second and the job around it bills a minute.

### The merge options, modelled in billed minutes

Each option holds the pipeline's behaviour constant and changes only how the work is packaged.

| Option | Jobs | Job-seconds | Wall clock | Billed | Δ vs today |
|---|---|---|---|---|---|
| **Today** | 11 | 453 | 78s | ~13.4 min (measured) | — |
| **A.** Remote cache, perfect hit | 11 | 403 | 78s | −1 min | **−8%** |
| **B.** Merge Typecheck + Lint + Build + env-guard | 8 | 384 | 78s | −3 min | **−24%** |
| **D.** Merge all six non-Postgres jobs | 6 | 378 | 78s | −5 min | **−40%** |
| **C.** B plus remote cache | 8 | 334 | 78s | −4 min | −32% |

**Wall clock does not move in any of them.** It is pinned at 78 seconds by the provider job, which
none of these touch. Every gain is in billed minutes.

#### The step function, which is the constraint that actually decides between B and D

Because billing rounds each job up to a whole minute, a merged job's saving is **not a gradient.
It is a step that collapses the moment the job crosses sixty seconds.** Both merges land under
that line, and they land at very different distances from it:

| Merged job | Composition | Total | Bills | Headroom |
|---|---|---|---|---|
| **B**, four jobs | 15s fixed (job setup + checkout + `pnpm/setup`) + 5 typecheck + 0 lint + 23 build + 1 env-guard | **44s** | 1 min | **16s** |
| **D**, six jobs | B + 10 gitleaks + 4 docs | **58s** | 1 min | **2s** |

D saves two more minutes and has two seconds of margin. Any variance at all and it bills 2
minutes, at which point it has saved the same as B while coupling six jobs instead of four and
dragging `fetch-depth: 0` across all of them.

**How much variance is there? Enough to matter, and it was measured rather than assumed.** The
`Build` job ranges 35s to 110s across 45 runs against a 43s median — runners vary by more than
2.6×. Modelling the merged job as the observed `Build` job plus the 6 seconds of extra work it
absorbs:

| | B (44s nominal) |
|---|---|
| Runs landing under 60s (bill 1 min) | **44 of 45 — 98%** |
| Runs landing over 60s (bill 2 min) | 1 of 45 — 2% |
| **Expected billed minutes** | **1.02**, so the saving is **2.98 min/run**, not a clean 3 |

So B's three minutes is real and survives runner variance; D's five minutes does not, because D
starts 2 seconds from the line rather than 16. **This is the argument for B over D, and it is
stronger than the `fetch-depth` one.**

At the 2026-09-10 rate of 134 runs a day: option B saves about **400 minutes a day**, option D
about **670**. Against a 2,000-minute monthly allowance those are not marginal — B alone stretches
the allowance from 149 runs to **192**, which is **9.6 runs a day** rather than 7.5. Post-merge
the pipeline bills **10.4 minutes per run**, down from 13.4.

### What merging costs, said plainly

`ci.yml` states the reason the jobs are separate, in its own words:

> Separate jobs, so a red check names the thing that broke rather than making someone open the log
> to find out.

That is a real property and merging trades it away. Eleven checks in the pull-request UI become
eight or six, and a failed "static checks" job means opening the log to learn whether it was the
typecheck, the lint, the build or the env guard.

Two things soften it, and one does not:

- **Step names survive.** A merged job's failing step is named in the job's own summary, so the
  information is one click away rather than absent.
- **`continue-on-error` would let every step run**, so a merged job reports all four outcomes
  rather than stopping at the first — at the cost of hand-rolling the final exit status, which is
  the kind of guard this repository writes anyway.
- **It does not soften for `env-guard`.** That job's whole purpose is that `pnpm build` must
  **fail**, so it cannot share a job with the `Build` job that requires the same command to
  succeed, unless the merged job runs the build twice under different environments. That is
  buildable and it is also confusing, which is worth weighing against three minutes.

**Option B is the recommendation and option D is not**, and the deciding argument is the two
seconds of headroom above rather than anything about coupling. D's extra two minutes evaporate on
the first slow runner, and runners here vary by 2.6×. The secondary arguments still hold: gitleaks
needs `fetch-depth: 0`, so a full-history checkout would be carried by every merged job for the
sake of one step, on a repository the API already reports at 3,047 KB and growing; and `Agent
docs` is a 6-second job with no install at all, whose independence is nearly free.

### Path filters: suspect here, and the brief is right to say so

`paths:` / `paths-ignore:` at the workflow level, or `dorny/paths-filter` at the job level, would
skip jobs whose inputs did not change. For this pipeline the arithmetic is tempting: a
documentation-only pull request — and several of the 116 in this sample are exactly that, this
file's own branch included — could skip nine of eleven jobs.

**It should be rejected, and the reason is structural rather than cautious.** CNCORE-3 deleted a
check that could pass without running, CNCORE-13 restated the rule, and a path filter is a
mechanism for making checks pass without running, by construction.

**And GitHub says not to — though not, it turns out, to us.** The sentence people cite is
*"You should not use path or branch filtering to skip workflow runs if the workflow is required to
pass before merging."* It is verbatim, and it exists **only on the GitHub Enterprise Cloud and
Enterprise Server versions** of the workflow-syntax and required-status-checks pages. Grep count
on the free-pro-team versions: **zero**. It is version-gated because it links to the ruleset rule
"Require workflows to pass before merging", which is a Team and Enterprise feature. So cite it as
GHEC guidance rather than as GitHub telling this organisation anything.

**The behaviour it warns about is documented on the default pages, and that is the part that
binds.** A workflow skipped by a path filter does not report success: its checks *"will remain in
a 'Pending' state"*, and *"A pull request that requires those checks to be successful will be
blocked from merging."* The current documented fix is four words — *"Avoid requiring workflows
that can be skipped."*

**The famous same-name workaround is no longer GitHub's advice, and saying so is the point.** It
did exist: GHES 3.1's troubleshooting page said to *"fix this by creating a generic workflow, with
the same name, that will return true in any case"*, with *"the name key and required job name in
both the workflow files ... the same."* It is absent from GHES 3.5 onward, from GHEC and from
free-pro-team — **GitHub retired it somewhere around GHES 3.2 to 3.4.**

That it was ever vendor guidance is what makes it worth recording, because the technique outlived
the documentation and people still reach for it. It is the CNCORE-3 defect in workflow form: a
second workflow whose entire job is to report success without running anything, wearing the first
one's name so that nothing downstream can tell which of the two produced the green tick. GitHub
appears to have reached the same conclusion, and replaced the recipe with an instruction not to
need it.

**An important contrast, since it is the thing most often got wrong.** Workflow-level filtering
blocks; a job skipped by an `if:` conditional does not. GitHub's troubleshooting table: *"A job is
skipped by a conditional | The job reports 'Success'"*, and *"Successful check statuses are
`success`, `skipped`, and `neutral`."* So the silently-passing failure mode this repository fears
lives in job-level conditionals, not in path filters — path filters fail loudly, by blocking.

Today neither the block nor the workaround bites, by accident rather than by decision: this
organisation is on GitHub Free with private repositories, so there are **no required status checks
at all** (section 6). A skipped job would sit pending and nothing would be waiting on it. But
`CLAUDE.md` already records that every merge gate here is convention rather than enforcement, and
a path filter turns a convention someone is watching into a mechanism that is invisible when it
misfires — and it lays a trap for the day the organisation moves to a plan where checks can be
required, when the pending-forever behaviour arrives with no warning.

If path filtering is ever wanted, the shape that does not break the rule is to make the **skip
visible**: run the job, and have it print what it skipped and why. That costs a billed minute,
which is the whole thing path filters were supposed to save — which is the argument for not doing
it.

### One job shape change that is not a merge

The `Migration ladder` job spends ~41 seconds of overhead (26s container init, 13s install) to do
about 5 seconds of migration work, and `Test`, `The page over HTTP` and `Import and browse` each
pay the same 26-second container initialisation for a Postgres they each use briefly. Four
Postgres service containers per run, 4,841 seconds of initialisation across 45 runs.

Merging the Postgres-bearing jobs is the single largest job-seconds saving available and it is the
**worst** idea in this document, because those four jobs are the four that genuinely test
different things — the suite, the ladder, the page over HTTP, and the page over HTTP against a
real provider — and the ladder job in particular must run against a database nothing else has
touched. They are separate for a reason `ci.yml` states at length. Left alone deliberately.

---

## 6. Three repositories, one standard

### What is actually there

Read 2026-09-11 via `gh api repos/jacobdrees-canoncore/<repo>` and the repositories' file trees.

| | CanonCore | provider-wiki | provider-tmdb |
|---|---|---|---|
| Created | 2026-09-03 | 2026-09-10 | 2026-09-10 |
| Visibility | private | private | private |
| **Description** | **none** | **none** | present |
| **Topics** | **none** | **none** | **none** |
| **LICENSE** | **none** | **none** | **none** |
| README | yes | yes | yes |
| Issues | off | off | off |
| Projects | **on** | off | off |
| Wiki | off | off | off |
| Merge commits | **allowed** | off | off |
| Squash merge | on | on | on |
| Rebase merge | off | off | off |
| Delete branch on merge | on | on | on |
| Auto-merge | off | off | off |
| **Dependabot** | **`.github/dependabot.yml`, 3 ecosystems, grouped** | **none** | **none** |
| **CODEOWNERS** | none | none | none |
| **`concurrency`** | **none** | `github.ref`, cancels main | `github.ref`, cancels main |
| **Top-level `permissions:`** | **`contents: read`** | **none** (per-job only) | **none** (per-job only) |
| **Secret scanning** | **gitleaks job, pinned by tag + digest** | **none** | **none** |
| Action pinning | major tag (`@v7`) | exact patch (`@v7.0.1`) | exact patch (`@v7.0.1`) |
| Node setup | `pnpm/setup@v2` | `pnpm/action-setup` + `actions/setup-node` | `pnpm/action-setup` + `actions/setup-node` |
| Jobs | 11 | 2 | 2 |
| Billed minutes, September | 1,295 | 64 | 13 |

Every row in bold is a divergence. Some should be closed and some should not.

### What GitHub Free actually permits, measured

Before recommending anything, the ceiling. Run against all three repositories 2026-09-11:

```
$ gh api repos/jacobdrees-canoncore/<repo>/rulesets
$ gh api repos/jacobdrees-canoncore/<repo>/branches/main/protection
{"message": "Upgrade to GitHub Pro or make this repository public to enable this feature.",
 "status": "403"}
```

Identical on all three, for both endpoints. **`CLAUDE.md`'s "No branch protection" gotcha holds,
is now measured rather than asserted, and extends to rulesets and to both new repositories.**
GitHub's own rulesets documentation agrees for a different reason — rulesets are *"for customers
on GitHub Team and GitHub Enterprise plans"* — so neither route is open on Free.

The consequence governs three rows of the table at once: **there can be no required status checks,
no required reviews, and no enforced code-owner review in any of these repositories.**

### What should be identical

**`concurrency`, with the corrected key.** All three, `${{ github.workflow }}-${{ github.head_ref
|| github.run_id }}`. CanonCore gains the protection it lacks; the providers lose the
main-cancelling defect that has already fired once. This is the only row where all three
repositories change and all three change to the same thing.

**A description.** GitHub's repository documentation treats the About panel as the repository's
first line of explanation. Two of three have none, and provider-tmdb's is a good model: *"CMPP
provider for TMDB. Decisions live in CanonCore's docs/adr; tickets in Linear team CNCORE."* It
answers what the repository is and where its decisions live in one line — which for a repository
that takes no decisions of its own is exactly the thing a reader most needs. Cost: two API calls.

**A top-level `permissions:` block.** CanonCore has `contents: read`; the providers rely on the
organisation default. That default was checked and is currently safe:

```
$ gh api /orgs/jacobdrees-canoncore/actions/permissions/workflow
{"default_workflow_permissions": "read", "can_approve_pull_request_reviews": false}
```

Identical at repository level on all three. So the providers are not insecure today — they are
**defended by a setting outside the file**, which is the precise objection `ci.yml` already makes
about `PNPM_CONFIG_FROZEN_LOCKFILE`: *"a gate that holds for a reason the file does not state is
one nobody can watch break."* GitHub's own hardening guidance is *"It's good security practice to
set the default permission for the `GITHUB_TOKEN` to read access only for repository contents"*,
with per-job escalation — which is exactly the shape CanonCore already has and the providers
half-have. Three lines each, and the file states its own guarantee.

**Dependabot.** CanonCore has it across three ecosystems with sensible grouping; neither provider
has any. Both providers have a `pnpm-lock.yaml`, a `Dockerfile` and seven pinned actions each, and
GitHub's security feature documentation confirms Dependabot alerts, security updates, version
updates and the dependency graph are **all available on private repositories on the Free plan**.
The providers are currently the only place in the organisation where a pinned action or a base
image can go stale unwatched. Copy CanonCore's file, minus the pnpm-catalogue comment that does
not apply.

### What should deliberately differ

**Secret scanning does not need to be uniform, but the reasoning should be.** GitHub's security
documentation confirms secret scanning and push protection require paid Secret Protection on
private repositories, which is why CanonCore runs gitleaks itself. The providers run nothing. That
is defensible — provider-tmdb's CI is explicitly built to hold no credential, and its own workflow
asserts the image ships none — but it is currently an absence rather than a decision. provider-tmdb
is the repository in the organisation most likely to acquire a real TMDB token by accident, since
its `README` tells a human to create one. **Worth a decision, not automatically worth a job.**

**Merge settings.** CanonCore allows merge commits; both providers allow squash only. The
providers are right and CanonCore is the drift — `docs/agents/issue-tracker.md` has the PR move
the ticket, and a squash keeps one commit per PR on `main`, which is what the ladder-base
computation in the migrations job assumes when it takes `git merge-base`. Low stakes, one setting.

**Action pinning should stay different, and the difference should be inverted.** GitHub's secure-use
reference: *"Pinning an action to a full-length commit SHA is currently the only way to use an
action as an immutable release"*, because *"a tag can be moved or deleted if a bad actor gains
access to the repository storing the action"*, while allowing that *"specifying a tag is more
convenient and is widely used"* if *"you trust the action's creators."* CanonCore uses floating
major tags (`@v7`); the providers use exact patch tags (`@v7.0.1`). Neither is SHA-pinned, so
neither is immutable, and the providers' exact tags buy the appearance of precision without the
property. Meanwhile CanonCore **already SHA-pins the one thing it should** — the gitleaks image,
by tag *and* digest, with a comment explaining that Dependabot cannot reach it. That is the right
instinct applied in exactly one place. If a standard is wanted, it is: first-party `actions/*` and
`pnpm/*` by major tag with Dependabot watching, everything third-party by digest.

**provider-wiki's settings are not free to match the others.** ADR-0089 pins it to tier 3 —
licensed to one person, *"never bundled, never in the store, never pointed at by another
instance"* — and extends that to its container image. Its CI already asserts the published package
is private and fails if it is not.

**The constraint is narrower than it first appears, and the difference is worth getting right.** A
private repository's *description* is visible only to people with access, so provider-wiki can
carry an ordinary one safely. *Topic names*, by contrast, **"are always public, even if you create
the topic from within a private repository"** — which is the one piece of repository metadata that
would leak a signal about a repository ADR-0089 requires stay invisible. So: **provider-wiki takes
a description like the others and takes no topics, ever**, and any future "make the standard
uniform" pass must exempt it from topics by name.

### What should be dropped for lack of a case

**Topics.** GitHub's own documentation removes the reason to add them here: *"you will only see
private repositories that you have access to in topic search results"*, and *"Private repository
content is not analyzed and does not receive topic suggestions."* Topics exist so strangers can
find a repository. These three are private and the audience is one person who knows where they
are. Worse, *"Topic names are always public, even if you create the topic from within a private
repository"* — so the one measurable effect of tagging provider-wiki is emitting a public signal
about a repository ADR-0089 requires be invisible. **A cost with no case. Do not add topics.**

**CODEOWNERS.** It cannot require anything here — enforcement is the "Require review from Code
Owners" branch-protection or ruleset setting, both 403 on Free, as measured above. Without that it
only auto-requests review, and the organisation has **one member** (`filled_seats: 1`), so it
would request review from the person opening the pull request. A file that names an owner nobody
needs told, enforcing nothing. **A cost with no case. Do not add CODEOWNERS** until the
organisation has a second human or a paid plan, which is also the trigger to revisit.

**A community-standards sweep.** GitHub's community profile checks for CONTRIBUTING, a code of
conduct, issue templates and a pull-request template. All three repositories have Issues disabled
by decision (`docs/agents/issue-tracker.md`), there are no outside contributors and there is no
public to have standards towards. Adding the files to score well on a checklist built for public
open-source projects is the definition of parity-driven work, which `CLAUDE.md` already rejects:
*"A list of things two mature products have is not a backlog."*

### README shape: already consistent, and the gap is in CanonCore

This is the pleasant surprise. Both provider READMEs already share a shape: title, one-line
statement of what the service is and what CMPP is, the distribution/licence posture, **"Where its
decisions and its tickets live"** pointing at CanonCore's `docs/adr/` and Linear team CNCORE, then
"Running it" and the route table. Nothing needs imposing.

The one that is out of step is **CanonCore's**, which has no equivalent of that pointer section.
Its README opens on the product and the layout and never says that `docs/adr/` is the authority or
that tickets live in Linear — facts a reader of the two provider READMEs has been told twice. If
one README changes, it is this one, and the change is a paragraph.

---

## 7. The licence gap

This is the question with a legal shape, so the sources are quoted rather than summarised, and
where a distinction matters it is drawn rather than smoothed over.

### What "no licence file" actually means

GitHub's own page on licensing a repository, read 2026-09-11:

> You're under no obligation to choose a license. However, without a license, the default
> copyright laws apply, meaning that you retain all rights to your source code and no one may
> reproduce, distribute, or create derivative works from your work.

And on what GitHub's Terms of Service add — note that the page states this **conditionally**,
which is the whole point:

> If you publish your source code in a public repository on GitHub, according to the Terms of
> Service, other users of GitHub.com have the right to view and fork your repository.

The Terms themselves condition it twice over, in section D.5: *"By setting your repositories to be
viewed publicly, you agree to allow others to view and 'fork' your repositories"*, and *"By making
a repository public, you grant other Users a nonexclusive, worldwide license"*. The grant is
triggered by publishing. It is never unconditional.

**Both halves matter, and the second one does not apply here.** The view-and-fork right attaches
to *public* repositories; all three of these are private, verified above. So the common worry —
"no licence means people can do what they like" — is doubly wrong for this organisation. Default
copyright already reserves everything, and there is no public audience with even a viewing right.

**The conclusion is therefore the opposite of the brief's framing.** Three private repositories
with no LICENSE file are not in a gap. They are in the maximally restrictive, entirely coherent
default state: all rights reserved, nobody can reach the code anyway. There is no urgency here and
adding a licence today changes nothing about anybody's rights, because there is nobody to grant
rights to.

What is missing is not a file. It is a sentence saying this was noticed and decided.

### ADR-0100 answers a different question than the one it is being asked

The brief says ADR-0100 decides CanonCore is non-commercial, "so that question has an answer
nobody has written down." Reading the record, it answers a neighbouring question and the two
should not be merged.

ADR-0100's text is about **conduct**: *"The software, the self-hosted instances and the one public
demo are all non-commercial. No sale, no subscription, no advertising, no selling traffic."* Its
stated reason is upstream data terms — the Cover Art Archive's metadata is CC BY-NC-SA 3.0 and
*"its NonCommercial term is satisfied only by this"*, and TMDB treats driving traffic as
commercial use.

A NonCommercial term on **inbound data** constrains how this project may use that data. It does
not require, or even mention, how this project's **own source code** is licensed outbound. Those
are separate instruments over separate works, and satisfying CAA's NC term is done by not
charging, which is exactly what ADR-0100 records.

So:

- **"Is CanonCore's conduct non-commercial?"** — closed, by ADR-0100.
- **"Under what licence is CanonCore's source offered to others?"** — genuinely unspecified, and
  ADR-0100 neither answers it nor obliges an answer.

Conflating them would have a real cost: it would make a non-commercial *source* licence look
mandatory when it is a free choice, and a consequential one, because it is the choice that decides
whether this is open source at all.

### If a source licence is ever wanted, what non-commercial intent looks like

**It is not open source, and that is definitional rather than a matter of opinion.** The Open
Source Definition, version 1.9, clause 6:

> **No Discrimination Against Fields of Endeavor.** The license must not restrict anyone from
> making use of the program in a specific field of endeavor. For example, it may not restrict the
> program from being used in a business, or from being used for genetic research.

Any licence forbidding commercial use fails clause 6. A project may still be source-available,
publicly readable and freely self-hostable — but it may not be called open source, and it will not
be accepted by distributions, packaging ecosystems or Linux distributions that gate on OSI
approval. That is the cost of the choice and it should be paid knowingly.

**The instrument, if one is chosen: PolyForm Noncommercial 1.0.0.**

- SPDX short identifier `PolyForm-Noncommercial-1.0.0`, full name *PolyForm Noncommercial License
  1.0.0*. Not listed as OSI Approved and not listed as FSF Libre, consistent with clause 6.
- Grant: *"The licensor grants you a copyright license for the software to do everything you might
  do with the software that would otherwise infringe the licensor's copyright in it for any
  permitted purpose."*
- Scope: *"Any noncommercial purpose is a permitted purpose"*, with permitted purposes spelled out
  as *"personal study, private entertainment, hobby projects, amateur pursuits"* and *"any
  charitable organization, educational institution, public research organization ... or government
  institution ... regardless of the source of funding."*
- Obligation: *"You must ensure that anyone who gets a copy of any part of the software from you
  also gets a copy of these terms."*

It is drafted for software, it is short, it is plain-language, and it has an SPDX identifier so
GitHub and tooling can name it. It is the closest thing to a standard non-commercial software
licence that exists.

**What not to use: a Creative Commons licence.** Creative Commons says so itself: they *"recommend
against using Creative Commons licenses for software"* and encourage *"one of the very good
software licenses which are already available"*. They give **three** reasons, of which source code
is the first: *"CC licenses do not contain specific terms about the distribution of source code,
which is often important to ensuring the free reuse and modifiability of software"*; that software
licences *"also address patent rights, which are important to software"*; and that CC licences
*"are currently not compatible with the major software licenses"*. CC do permit their licences for
*"software documentation, as well as for separate artistic elements such as game art or music"*,
which is a distinction worth keeping if this project ever licenses its docs separately. CC0 is the documented exception, and CC0 is a public-domain
dedication — the opposite of non-commercial. So reaching for CC BY-NC because the upstream CAA
data is CC BY-NC-SA would be copying an instrument across a boundary its own author says not to
cross.

**The alternatives, and why they are a worse fit.** Business Source License 1.1 and the Elastic
License 2.0 are the other well-known source-available options, but both are built to protect a
*commercial* product from competitors — BUSL by converting to an open licence on a date, Elastic by
forbidding managed-service resale. Neither expresses "this project will never be commercial"; they
express "this project is commercial and is defending itself." Wrong shape for ADR-0100's posture.

### What is worth writing down now

Not a LICENSE file. The distinction: that ADR-0100 governs conduct rather than outbound licensing,
that private repositories under default copyright are already all-rights-reserved, and that the
outbound question becomes live at exactly one moment — **the first time any of these repositories
is made public**.

**THE TWO CLAUSES THAT USED TO CLOSE THAT SENTENCE WERE WRONG, AND CNCORE-38 CAUGHT THEM ON THE WAY
INTO AN ADR.** They had ADR-0089 forbidding provider-wiki's repository outright, and provider-tmdb
already carrying a named trigger. ADR-0089 does neither. It governs DISTRIBUTION — bundling, the
store, being pointed at by another instance, and the container image — and states no rule about
repository visibility at all. Its named trigger, *"the named trigger to revisit it is tier 2's CMPP
store becoming real"*, revisits provider-tmdb's IMAGE privacy, which that record explicitly calls a
choice rather than the licence rule operating. Corrected here rather than beside, because this
paragraph is where the error started: it travelled into CNCORE-38's own description and was one
review away from being asserted in `docs/adr/0100`. That record now carries the right version.

Writing the licence before that moment is guessing at terms for an audience that does not exist.
Writing down *when the question becomes live* costs a paragraph and stops it being rediscovered.

---

## 8. The decision list

Ranked by what saves the most for the least, as the brief asked. Eleven entries. The first is not
a speed decision and is first anyway, because the pipeline stops without it.

Jacob writes the records and files the tickets. These are proposals.

**Every entry below was decided on 2026-09-11, in a grilling session held the same day this file
was written.** Each carries a `Decided` note in the shape `multi-repo.md` and `access-layer.md`
use. The entries themselves are left as they were proposed, because the reasoning that got
overturned is the part worth keeping — and two of the eleven were overturned, one of them a
recommendation this file made and the grilling killed. Decisions taken in that session that no
entry anticipated, and the corrections the grilling forced into the body above, are in section 10.

---

### 1. Decide what happens when the Actions allowance runs out, which is days away.

**Forces:** nothing schedules it, which is the problem. **Saves:** the pipeline.

466 of 2,000 minutes remain on day 11, the `actions` budget was $0 with `prevent_further_usage:
true`, and GitHub blocks usage once the quota is gone. At 13.4 billed minutes per run that is
about 35 runs; 2026-09-10 alone ran 134.

**Options:** (a) cut billed minutes per run, entries 2 and 3 below; (b) raise the budget above $0
and accept a bill at $0.006/min — roughly $8 for a repeat of 2026-09-10, about $88 for ten such
days; (c) make the repositories public, which makes Actions free and which ADR-0089 forbids for
provider-wiki; (d) let it stop and resume in October.

**The evidence favours (a) first and (b) as the deliberate fallback.** (a) is free and buys 30%.
(c) is closed for one repository and is a much larger decision than a CI bill. (d) is what happens
by default if nobody chooses, which is the argument for choosing.

Worth stating against today's rejected GBP 86.60/month box: ten three-implementer days a month is
about GBP 69 of Actions overage. This is the same order of money and it arrives without anyone
approving it.

**Decided 2026-09-11: cut job count AND pay, both.** Option (a) plus option (b), explicitly
because cutting alone does not close the gap — entry 2 saves 24% and the allowance still only
reaches 10.6 runs a day, against days that have run 134. The budget half is entry 1a below. (c) was
not taken: making a repository public to dodge a CI bill is a far larger decision than the bill,
and ADR-0089 closes it for provider-wiki outright.

**Decided 2026-09-11 (1a): a $20/month Actions budget, with GitHub's alerting on.** Tighter
than this file would have recommended — $20 covers about 28 runs a day sustained, so **it will
bite during a 40-runs-a-day sprint**, which is the hard stop entry 1 exists to avoid. Taken with
that known: the ceiling is a runaway guard, not a spending plan, and the alerts are what make the
approach of the ceiling visible rather than sudden. Realistic spend is £8-26/month, not £16.

Thresholds were asked for at 50/75/90 and **are not configurable** — GitHub fixes them at *"75%,
90%, or 100%"*. See section 10.

---

### 2. Merge Typecheck, Lint, Build and env-guard into one static-checks job.

**REVERSED 2026-09-11 by CNCORE-80, and the saving below is now zero for this repository.** CNCORE-62
made CanonCore public, and GitHub bills standard runners nothing in a public repository, so there are
no billed minutes here to save. The four are four named jobs again. The entry stands as researched
because the arithmetic still decides this question in `provider-wiki` and `provider-tmdb`, which stay
private; ADR-0111 carries the correction and the split.

**Forces:** entry 1. **Saves: about 3 billed minutes per run, −24%,** roughly 400 minutes a day at
the 2026-09-10 rate. The largest single saving available.

Four jobs each pay ~15 seconds of entry fee and each round up to a whole minute to do 0s, 5s, 23s
and 1s of work respectively. Merged, they are one ~43-second job billing one minute instead of
four.

**Options:** (a) merge all four; (b) merge Typecheck and Lint only, leaving Build and env-guard
alone; (c) merge all six non-Postgres jobs, saving one more minute.

**The evidence favours (a).** (c) drags `fetch-depth: 0` across everything for gitleaks' sake and
couples a 6-second docs job to a 43-second one, for one minute. (b) leaves two of the four
worst offenders standing.

**What it costs, stated rather than discovered:** `ci.yml`'s own stated reason for separate jobs —
*"so a red check names the thing that broke"* — is partly traded away. Step names survive in the
job summary; `continue-on-error` on each step plus a final exit-status check would preserve
all-four-outcomes reporting at the cost of hand-rolled logic.
- **env-guard is not the obstacle it first looks like.** Its whole point is that `pnpm build` must
  **fail**, which reads like a conflict with the `Build` step that requires the same command to
  succeed. It is not: it is one additional step carrying `env: DATABASE_URL: ""`, and the build
  fails fast on env validation in about a second. The merged job runs the build twice, totals 44
  seconds, and still bills one minute. **The saving is a clean 3 minutes, not "2 or 3 depending".**

**Decided 2026-09-11: merge four, not six.** As proposed, and for a reason this entry did not
have. The deciding argument is not coupling or `fetch-depth` — it is that **D lands 2 seconds
under the billing boundary and B lands 16 seconds under it**, against runners that vary by 2.6×.
Measured against the real `Build` distribution, B bills one minute on 44 of 45 runs and its
expected saving is 2.98 minutes; D's extra two minutes evaporate on the first slow runner.

This entry also overstated the env-guard problem, and the body above is corrected: env-guard is
one extra step with `env: DATABASE_URL: ""`, not a conflict, so the saving is a clean 3 rather
than "2 or 3 depending".

---

### 3. Add `concurrency` to CanonCore, and fix the key in both providers.

**Forces:** a commit already on provider-wiki's `main` with no verdict. **Saves:** about 1% of
billed minutes, and one class of defect permanently.

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: true
```

**Do not sell this as speed.** Replaying all 162 runs, only 4 of 116 pull-request runs were ever
superseded, reclaiming 292 seconds across eight days. The case is the defect: provider-wiki run
#18 was a push to `main` cancelled 28 seconds in, its `image` job never ran, and commit
`1be88b47` has no CI verdict and never will. `github.head_ref` is undefined on push, so the group
falls back to the unique run id and the default branch cannot be cancelled by construction.

**Decided 2026-09-11: as proposed, in all three repositories.** The counter-argument was put and
rejected: run #19 did test a tree containing `1be88b47`, so on a verdict-only reading cancelling
main is harmless. What defeats it is that the cancelled job has **side effects** — `image` builds,
smoke-tests and publishes the container CanonCore's CI pulls, and asserts the package is still
private under ADR-0089. A run that publishes an artefact and asserts a licence constraint is not
one you skip because a later commit happened to be fine.

**Shape decided at the same time: three independent tickets, one per repository.**
`multi-repo.md` entry 2's prefactor-and-slice split solves a *dependency* problem, and there is no
dependency here — these are three unrelated three-line edits. The new ADR from entry 2a lives in
CanonCore and describes only CanonCore's merge, so nothing flips across a repository boundary and
`CLAUDE.md`'s cross-repo pairing rule does not engage.

---

### 4. Reject Turborepo remote caching and `actions/cache` over turbo's cacheDir, and record why.

**Forces:** nothing. **Saves:** the effort of building it, and a silent failure mode.

A perfect hit removes 50 of 486 job-seconds, moves wall clock by **zero** — the 78-second critical
path runs `test:e2e`, which `turbo.json` marks `cache: false` — and saves **one** billed minute,
only when nothing changed. Vercel's cache is free on all plans so cost is not the objection;
`actions/cache`'s branch scoping is workable so scoping is not the objection. The objection is
that there is one minute behind it.

And it fails open, measured here: an unreachable cache prints `WARNING could not connect to the
cache` and exits **0**. A cache that is misconfigured or expired is invisible, and a hanging
endpoint costs up to the documented 30-second default timeout per operation — slower than no cache
at all.

**Decided 2026-09-11: rejected, as proposed.** An argument *for* it surfaced in grilling and was
also rejected: because the merged job from entry 2 sits 16 seconds from a billing boundary, a
cache hit on `build` and `typecheck` would drop it to ~16s and buy the merge real headroom. That
is a better case than the one this entry argues against — but a cache that **fails open** protects
headroom silently and stops protecting it silently, which is the worst possible property for
something load-bearing.

**A replacement was proposed in the same session and killed by measurement**: guarding the 60-second
boundary with an assertion. See section 10.

---

### 5. Do not add path filters, and write down why.

**Forces:** entry 1 will make them tempting. **Saves:** a trap.

GitHub says it directly: *"You should not use path or branch filtering to skip workflow runs if
the workflow is required to pass before merging."* A skipped workflow leaves its checks *"in a
'Pending' state"* and blocks the pull request, and the documented workaround is a second workflow
*"with the same name, that will return true in any case"* — which is CNCORE-3's deleted defect
reissued as vendor guidance.

Neither behaviour bites today because Free private repositories have no required checks at all.
That is an accident, and it becomes a trap the day the plan changes. **Closing it now is a
sentence; discovering it later is a debugging session.**

**Decided 2026-09-11: as proposed.** Recorded as rejected alongside entry 10's three.

---

### 6. Add Dependabot to both provider repositories.

**Forces:** seven pinned actions and a base image per provider, currently unwatched. **Saves:** no
minutes; closes a staleness gap.

GitHub confirms Dependabot alerts, security updates, version updates and the dependency graph are
all free on private repositories. CanonCore has three ecosystems configured with grouping; the
providers have nothing. Copy the file, drop the pnpm-catalogue comment.

**Cost worth naming:** Dependabot opens pull requests, each of which triggers CI, which spends the
allowance entry 1 is about. Grouped weekly updates on a 2-job pipeline is a few minutes a week.
Worth it; worth knowing.

**Decided 2026-09-11: as proposed, and sequenced last.** Roughly 30-90 minutes a month across both
providers, which is noise against a $20 ceiling. It sits in the housekeeping pass rather than
alongside the merge, because it costs runs and saves none.

---

### 7. Give CanonCore and provider-wiki a description, and add a top-level `permissions:` to both providers.

**Forces:** nothing. **Saves:** nothing measurable. **Costs:** minutes of work.

provider-tmdb's description is the model. For provider-wiki the description should state the
ADR-0089 constraint rather than describe the software.

The `permissions:` block is not a security fix — the organisation default is already `read`,
verified — it is making the file state its own guarantee instead of inheriting one, which is the
objection `ci.yml` already raises about gates that hold for reasons the file does not state.

**Decided 2026-09-11: as proposed, sequenced last, and this entry was over-cautious about
provider-wiki.** A private repository's description is visible only to those with access, so
provider-wiki takes an ordinary description like the others. It is *topic names* that are always
public, which is entry 10's business, not this one's. The body above is corrected.

---

### 8. Add the "where its decisions and tickets live" paragraph to CanonCore's README.

**Forces:** nothing. **Saves:** nothing. Listed because it inverts the expected direction.

Both provider READMEs already carry it; CanonCore's does not. The cross-repo README standard
already exists and the largest repository is the one out of step.

**Decided 2026-09-11: as proposed, sequenced last.**

---

### 9. Turn off merge commits on CanonCore.

**Forces:** nothing. One setting. Both providers are squash-only; CanonCore also allows merge
commits. Squash-only keeps one commit per PR on `main`, which is what the migrations job's
`git merge-base` assumes.

**Decided 2026-09-11: as proposed, sequenced last.**

---

### 10. Do not add topics, CODEOWNERS, or community-standards files to any of the three.

**Forces:** the next "audit against GitHub practice" pass, which will suggest all three.

Each is a cost with no case here, and each has a measured reason rather than a preference:

- **Topics** — private repositories *"will only see private repositories that you have access to
  in topic search results"* and get no topic suggestions, so topics buy nothing. Worse, *"Topic
  names are always public"*, which for provider-wiki emits a public signal about a repository
  ADR-0089 requires stay invisible.
- **CODEOWNERS** — enforcement needs branch protection or rulesets, both measured 403 on all three
  repositories. Without it, it auto-requests review from an organisation with `filled_seats: 1`.
- **Community-standards files** — Issues are off by decision, there are no outside contributors,
  and the checklist is built for public projects. `CLAUDE.md`: *"A list of things two mature
  products have is not a backlog."*

**Recording the rejections is the point.** Otherwise the next sweep proposes them again and the
reasoning is re-derived from scratch.

**Decided 2026-09-11: record all three, with the measurement attached.** The objection was put
that `CLAUDE.md`'s existing rule — *"the next sweep is not automatically owed a response"* —
already covers this and makes three named rejections redundant. Rejected on the grounds that the
general rule defeats *parity* arguments but not a specific proposal backed by GitHub's own
documentation. What settles those is the measurement: the 403 on rulesets and branch protection,
and *"Topic names are always public"*. A future reader can check those rather than re-derive
them.

---

### 11. Record that ADR-0100 governs conduct, not outbound source licensing, and when the licence question becomes live.

**Forces:** nothing today. **Saves:** a wrong decision made under a false obligation.

Three private repositories with no LICENSE are already all-rights-reserved by default copyright,
and GitHub's view-and-fork ToS right applies only to public repositories. There is no gap and no
urgency.

What is worth writing is the distinction: CAA's NonCommercial term constrains **use of CAA's
data**, not the licence on **this project's code**, so a non-commercial source licence is a free
choice rather than an obligation. If it is ever taken, the instrument is
`PolyForm-Noncommercial-1.0.0` — drafted for software, SPDX-identified, and not open source,
because OSD clause 6 forbids restricting *"the program from being used in a business."* Not a
Creative Commons licence: CC *"recommend against using Creative Commons licenses for software"*
themselves. Not BUSL or Elastic, which are built to defend a commercial product and express the
opposite posture.

The question becomes live at exactly one moment: **the first time one of these repositories is
made public.** A sentence naming ADR-0089 as forbidding that for provider-wiki, and as already
carrying a trigger for provider-tmdb, stood here and is GONE rather than softened: it was wrong on
both counts, and section 7 above carries why. Nothing schedules any of the three being published.

**Decided 2026-09-11: accepted, no LICENSE file, and the distinction goes into ADR-0100 itself.**
This entry proposed recording the conduct-versus-licensing distinction; the session put it one
place further along. ADR-0100 is the record people read and misread, so a clarification sitting
beside it in a research file leaves the wrong inference standing — which is `CLAUDE.md`'s own rule
that a correction belongs in the sentence it corrects. **Amending ADR-0100 is therefore a ticket**,
not something this research does, since it was told to stay out of `docs/adr/`.

---

## 9. So what does this change?

**The brief asked for speed and the measurement says speed is not the problem.** 74-second median,
89 at p90, no long tail once manual re-runs are excluded, and the two apparent outliers were
people pressing re-run. Nothing in this pipeline is slow, and no option in this document moves
wall clock at all — it is pinned at 78 seconds by one job whose work cannot be cached, shared or
skipped.

**What is a problem is a number nobody was looking at.** The figure this paragraph was written
against — 1,534 of 2,000 on day 11, with a $0 budget — **was overtaken within the day, and both
halves have moved**: the allowance is spent (2,739 minutes), $4.038 is billable, and the budget is
$20 rather than $0. The conclusion survives and sharpens, because the runway is no longer measured
in free minutes but in budget: at the reported $0.006 per minute, $20 buys roughly 3,300 minutes a
month, and a day recently produced 134. `prevent_further_usage` is still set, so Actions stops
across all three repositories when the budget is reached rather than warning.

**The lever is job count, not job duration**, because GitHub *"rounds the minutes and partial
minutes each job uses up to the nearest whole minute"*, and 312 of 442 sampled jobs ran in under
sixty seconds. That is why merging four cheap jobs (−24%) beats a perfect remote-cache hit (−8%),
and why the install count — the thing the brief flagged — turns out to be the wrong level of the
problem: nine parallel installs are correct for wall clock and irrelevant to the bill, while the
nine **jobs** around them are neither.

**Two things the brief assumed turned out to be the other way round.** Concurrency is not missing
from the organisation — it is missing from CanonCore and *defective* in both providers, where it
has already cancelled a push to `main` and left a commit unverified. And the licence gap is not a
gap: three private repositories under default copyright are in the most restrictive state
available, and ADR-0100 was answering a different question than the one being put to it.

**Four entries cost minutes of work and no risk** — entries 3, 7, 8 and 9. **Three entries are
decisions to *not* build something** — 4, 5 and 10 — and they are in the list because an unwritten
rejection gets re-proposed by the next sweep. **One entry is the only one with a deadline**, and
it is first.

**All eleven were decided on 2026-09-11. Section 10 carries the outcomes, the corrections the
grilling forced back into the body above, and the one measure this file would have recommended
had the measurement not killed it.**

---

## 10. Decided 2026-09-11, and what the grilling corrected

Every entry in section 8 was put to Jacob the day this file was written. Eleven were decided; two
came back differently from how they were argued; one recommendation this file would have made was
killed by measurement before it reached the list. The entries are left as proposed with `Decided`
notes. This section carries what no entry anticipated.

### The corrections the grilling forced into the body above

`CLAUDE.md`: *"A correction propagates, or it has not landed... Put the correction in the sentence
it corrects."* So these are fixed in place above rather than only listed here. They are listed
here too, because a reader who took a number out of this file before 2026-09-11 needs to know
which ones moved.

| # | What this file said | What is true | Where |
|---|---|---|---|
| 1 | The allowance is "about 1.2 days of three-implementer work" | It is **7.5 runs a day across 20 active days** — a threshold that holds even if 2026-09-10 never repeats. A quiet 10-runs-a-day month is already 1.3× over. | §0 |
| 2 | env-guard is "the genuine wrinkle"; the saving is "2 minutes rather than 3" | Not a wrinkle. One step with `env: DATABASE_URL: ""`, build fails fast on validation, job totals 44s. **A clean 3 minutes.** | §5, entry 2 |
| 3 | Option B saves 3 minutes | **2.98** in expectation. 44 of 45 real builds land under 60s; 1 bills 2 minutes. | §5 |
| 4 | Option D saves 4 minutes (−32%) | **5 minutes (−40%)** — the earlier model was wrong — **and it lands 58s, two seconds under the billing boundary.** | §5, entry 2 |
| 5 | *(absent)* | **The billing-boundary step function.** A merged job's saving is not a gradient; it collapses entirely the moment the job crosses 60 seconds. This is the single most important design constraint in the document and it was missing. | §5 |
| 6 | *(absent)* | **Runner variance is 2.6×.** `Build` ranges 35-110s against a 43s median. This is what makes D's 2-second margin unsafe and B's 16-second margin safe. | §5 |
| 7 | provider-wiki "must never gain a description" | A private repo's description is private. **Only topic *names* are always public.** provider-wiki takes a description; it takes no topics. | §6, entry 7 |
| 8 | *(absent)* | Post-merge the pipeline bills **10.4 min/run**, and the allowance reaches **9.6 runs a day**. | §5 |

### The recommendation that was proposed and killed in the same session

Entry 4 rejects remote caching. Grilling produced a better argument *for* it than the entry
argues against — the merged job sits 16 seconds from a billing boundary, and a cache hit on
`build` and `typecheck` would drop it to ~16s and protect that margin as `apps/web` grows.

The proposed replacement was **an explicit guard on the boundary**: fail the job if it exceeds
~50 seconds, so the merge's erosion is loud rather than silent. It fits this repository's habits,
which already include hand-written guards like *"assert a suite actually ran"*.

**It does not survive its own measurement.** Against the observed `Build` distribution:

| Threshold | Builds it would fail |
|---|---|
| 50s | **27%** |
| 55s | 9% |
| 60s | 2% |

Any threshold tight enough to give early warning fires constantly; any threshold loose enough not
to flake tells you nothing the bill would not. And a red check with no defect behind it is worse
than no check — it gets disabled, and then it rots.

**The deeper error is worth keeping, because it generalises.** Job duration is a noisy per-run
measurement. "Is the merge still paying off" is a statistical property over a month. **Gating a
distribution on a single sample is a category error**, and the right instrument is the billing
usage API — one call, already used by this research, already alerting at 50/75/90% under entry 1a.

**Decided: no per-run guard. Read it off the bill when the 50% alert fires.**

### Decisions no entry anticipated

1. **A $20/month Actions budget with alerts at 50/75/90%**, `prevent_further_usage` retained at
   that ceiling rather than at $0. Recorded against entry 1, and taken in full knowledge that $20
   covers ~28 runs a day and will bite in a 40-run sprint.
2. **Sequencing, which no entry gave.** Budget first, because it costs zero CI runs and removes
   the hard-stop risk immediately. Then one CanonCore ticket for merge-4 plus concurrency plus the
   ADR. Housekeeping (entries 6-9) last. The constraint that forces the order: **67 runs remained
   in September at the then-current rate**, and every change here spends some of them proving
   itself. (That figure was itself wrong when written — it divided by the post-merge rate in a
   pre-merge situation. The correct number at the time was **51**, and by the evening re-read it
   was **35**. The ordering is unaffected.)
3. **One new ADR, and one amendment.** The new record is *why CI optimises billed minutes over
   named checks* — it earns a record because the merge **actively contradicts a principle `ci.yml`
   states in its own words**, so without one the next reader splits the jobs back and the saving
   silently reverses. The amendment is ADR-0100 gaining the conduct-versus-licensing distinction.
   Rejected as ADR candidates: the $20 budget (reversible, unsurprising, barely a trade-off) and
   the remote-cache rejection (kept as research, since `docs/adr/` should not become a CI
   changelog).
4. **Three tickets, independent.** Entry 3's note carries why `multi-repo.md`'s prefactor-and-slice
   rule does not engage: it solves a dependency problem that three identical three-line edits do
   not have.
5. **`CONTEXT.md` is untouched, deliberately.** "Billed minute", "job-second" and "critical path"
   are CI vocabulary, not product domain. The glossary governs Placements and Items; nothing in
   this research belongs in it.

### What was done on 2026-09-11, and where it went

The budget was changed and the tickets were filed the same day, so this file is not only a
proposal any more. What landed:

| Action | Where |
|---|---|
| Actions budget raised from **$0 to $20**, `prevent_further_usage` kept | Organisation billing, verified in the UI: *Actions / Stop usage Yes / $0 spent / $20.00 budget* |
| Included-usage alerts confirmed **On** | Same page. This is the toggle that warns about the **free 2,000**, which is what runs out first |
| Merge-4 + concurrency + the new ADR | **CNCORE-35** |
| provider-wiki concurrency, `permissions:`, Dependabot, description | **CNCORE-36** |
| provider-tmdb, the same | **CNCORE-37** |
| ADR-0100 amendment | **CNCORE-38** |

**One correction to the budget plan, found by reading the page rather than the API.** Entry 1a
says "alerts at 50/75/90%". Those thresholds are **not configurable**: GitHub's budget
documentation gives them as *"75%, 90%, or 100% of a defined budget"*, fixed. The API exposes only
`will_alert` and `alert_recipients`, with no threshold field, and the UI offers none either. So
the alerting that exists is 75/90/100 on the $20 ceiling, plus the separate included-usage alerts
on the free 2,000. That is enough for the purpose — the 75% alert on the included allowance is the
signal entry 6 relies on — but the 50% figure was wishful and is withdrawn.

`CONTEXT.md` was not touched, and neither was `.github/workflows` or `docs/adr/`: three
implementers were live, and the tickets above describe those changes rather than making them.

### What was NOT decided, and stays open

- **Whether $20 is the right ceiling.** It is known to be tight. The trigger to revisit is the 90%
  alert firing in a month that was not exceptional.
- **Whether option D becomes worth it later.** If `pnpm build` ever gets materially faster, D's
  margin grows and its extra two minutes become real. Nothing schedules a re-check.
- **Whether the per-run baseline holds. It already moved once, the same day.** The 12.4 figure
  rested on 8 runs from a partial day; by that evening the complete day gave **13.4** over 19
  runs, and the verification pass corrected it throughout. A fortnight of post-merge data would
  settle it properly. The billing usage API answers it in one call, which is the same instrument
  entry 4 chose over a per-run guard — so this open question has a tool and needs no new one.
- **Whether the $20 ceiling's coverage is what entry 1a assumed.** At the corrected post-merge
  rate of 10.4 min/run, $20 buys about **25.6 runs a day**, not the 28.4 quoted when the decision
  was taken. The decision was made knowing the ceiling was tight; it is slightly tighter than
  stated.

---

## Sources

Every source was read on **2026-09-11** unless stated. Measurements taken in this worktree or
against the forge are marked **[measured]** and carry the command that produced them in the body.

**GitHub, on its own product**

- Workflow syntax, `concurrency`: <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax>
- Control the concurrency of workflows and jobs (the `head_ref || run_id` fallback, quoted via the syntax reference)
- Actions limits (20 concurrent jobs on Free; 6h job limit): <https://docs.github.com/en/actions/reference/limits>
- Actions billing, included minutes and Linux per-minute rate: <https://docs.github.com/en/billing/concepts/product-billing/github-actions>
- **Per-job rounding to the whole minute**: <https://docs.github.com/en/billing/reference/actions-runner-pricing> — and this is the **only** GitHub page that states the rule. The main billing page never restates it and its worked examples are phrased at run level, which reads as per-run if that is the only page you see. An earlier draft of this file cited that page instead; it does not carry the sentence.
- Dependency caching reference (10 GB, 7-day eviction, branch scoping): <https://docs.github.com/en/actions/reference/dependency-caching-reference>
- Troubleshooting required status checks (skipped-but-required blocks the PR; *"Avoid requiring workflows that can be skipped"*): <https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks>
- The *"You should not use path or branch filtering..."* sentence, **GHEC/GHES only**, absent from free-pro-team: <https://docs.github.com/en/enterprise-cloud@latest/actions/reference/workflows-and-actions/workflow-syntax>
- The **retired** same-name-workflow workaround, surviving only in archived GHES 3.1: <https://docs.github.com/en/enterprise-server@3.1/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/troubleshooting-required-status-checks>
- `github.head_ref` is available on `pull_request` **and `pull_request_target`**: <https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#github-context>
- Secure use reference (SHA pinning, minimum `GITHUB_TOKEN` permissions): <https://docs.github.com/en/actions/reference/secure-use-reference>
- About rulesets (Team and Enterprise only): <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets>
- GitHub security features, Free vs paid on private repositories: <https://docs.github.com/en/code-security/getting-started/github-security-features>
- Licensing a repository (default copyright, the ToS fork right): <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository>
- Classifying your repository with topics (private-repo limits, public topic names): <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics>
- About READMEs: <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes>
- `actions/upload-artifact` README (permissions not preserved): <https://github.com/actions/upload-artifact>

**Turborepo and Vercel, on their own products**

- Remote caching (free on all plans, self-hosting, signatures): <https://turborepo.dev/docs/core-concepts/remote-caching>
- GitHub Actions guide (OIDC recommended; `actions/cache` as the alternative): <https://turborepo.dev/docs/guides/ci-vendors/github-actions>
- Configuration reference (`remoteCache.timeout` 30s, `uploadTimeout` 60s): <https://turborepo.dev/docs/reference/configuration>
- Vercel Remote Caching, pricing and fair-use table, 7-day artifact expiry: <https://vercel.com/docs/monorepos/remote-caching>

**Licensing**

- Open Source Definition v1.9, clauses 5 and 6: <https://opensource.org/osd>
- PolyForm Noncommercial License 1.0.0: <https://polyformproject.org/licenses/noncommercial/1.0.0>
- SPDX identifier `PolyForm-Noncommercial-1.0.0`: <https://spdx.org/licenses/PolyForm-Noncommercial-1.0.0.html>
- Creative Commons FAQ, on CC licences and software: <https://creativecommons.org/faq/>

**Measurements taken here [measured]**

| What | How |
|---|---|
| 163 runs, durations, supersession replay | `gh api repos/jacobdrees-canoncore/CanonCore/actions/runs?per_page=100`, pages 1-2 |
| 442 jobs, per-job and per-step medians | `gh api .../actions/runs/<id>/jobs` over the most recent 45 runs |
| The 2,371s and 346s outliers are `run_attempt: 2` | `gh api .../actions/runs/34528480252` |
| provider-wiki run #18: a push to `main`, cancelled, `image` never ran | `gh api repos/.../provider-wiki/actions/runs?per_page=100` and `.../jobs` |
| 1,372 of 2,000 minutes; $0 budget with `prevent_further_usage` | `gh api "/orgs/jacobdrees-canoncore/settings/billing/usage?year=2026&month=9"` and `.../budgets` |
| Branch protection and rulesets 403 on all three | `gh api repos/.../rulesets`, `gh api repos/.../branches/main/protection` |
| Org and per-repo default workflow permissions are `read` | `gh api /orgs/jacobdrees-canoncore/actions/permissions/workflow` |
| Repository metadata for all three | `gh api repos/jacobdrees-canoncore/<repo>` |
| `build` executes 1 task; `typecheck` and `test` 9 each | `pnpm turbo run <task> --dry=json` |
| Turbo fails **open** on an unreachable cache: warning, exit 0 | `TURBO_API=http://127.0.0.1:9 pnpm turbo run typecheck --force` |
| `node_modules` is 740 MB with 318 symlinks in three levels | `du -sh node_modules`, `find node_modules -maxdepth 3 -type l` |

**Verification pass, 2026-09-11**

Every claim above was put back to its owner the same day, after the decisions in section 8 were
taken. Four claims were contradicted, three were misattributed and one was stale; all are
corrected in place above, and the corrections are the ones listed in section 10's table plus the
four below. No decision changed as a result — the errors moved numbers and attributions, not
conclusions.

| Corrected | Was | Is |
|---|---|---|
| Billed minutes per run | 12.4 (99 min ÷ 8 runs, partial day) | **13.4** (255 ÷ 19, full day) |
| Jobs under 60s | 218 of 316 | **312 of 442** (316 was a filtered subset) |
| Runner variance | 2.5× | **2.6×** |
| The same-name-workflow workaround | "GitHub's documented workaround" | **Retired by GitHub** around GHES 3.2-3.4 |

**Gaps, marked rather than filled**

- Turborepo does not document what happens when the remote cache is unreachable. Measured here
  instead; the measurement is above.
- `actions/upload-artifact` does not document symlink handling. Not resolved, because the
  740 MB measurement settles the option without it.
- GitHub's Free-plan concurrency ceiling of 20 jobs is documented but was **not** observed biting:
  the worst job queue delay in 45 runs was 39 seconds. No recommendation rests on it.
- **No docs.github.com page carries a published or last-modified date.** Page freshness cannot be
  judged from the pages themselves; the only dates in the raw HTML are REST API version strings.
  Indirect signals say the Actions pages are current (examples use `actions/checkout@v6` and
  `actions/setup-node@v7`). Every GitHub citation here is therefore dated by *when it was read*,
  2026-09-11, and not by when it was written.
- **Whether the dependency graph is on by default on a private repository** is no longer stated.
  The page that used to say so now repeats one paragraph twice against two different link targets,
  an editing artefact, and has lost the sentence. This matters to entry 6: Dependabot version
  updates are free on private repos, but **free does not mean on** — *"Repository administrators
  can enable or disable the dependency graph"*, and security updates need the graph and alerts
  enabled first.
