# The substrate under many parallel agents, and what it lies about

**Researched 2026-09-13**, for CNCORE-134. One question: what is the correct substrate for running
many parallel coding agents against this monorepo — local worktrees, the shared Postgres, the test
runner, the turbo cache and CI — so that a failure is always the CODE's fault and never the
substrate's?

It proposes. It decides nothing: the ADRs are Jacob's to write and nothing here is one. **No product
code was changed.** `compose.yaml`, `packages/db/docker-compose.yml`, `turbo.json` and
`.github/workflows/ci.yml` are described here, never edited. Three files were touched during
measurement and restored in the same command — `CONTEXT.md`, `compose.yaml` and
`.github/workflows/ci.yml` — each to prove a cache claim; `git status` was verified clean after each.

## How to read this

Section 0 is the finding that reframes the brief and is the reason to read the rest. Sections 1 to 5
are one per question in the ticket. Section 6 labels each of the five current practices. Section 7
gives the concurrency ceiling and its arithmetic. Section 8 says what would change, ranked.

Where a claim is a measurement, the command that produced it and the date it was taken are given.
**Where a lookup or a measurement contradicted what the ticket, this repo, or an earlier draft of
this note believed, the lookup wins and the paragraph says so in capitals.** Two of those reversals
change what should be done rather than merely why: the ticket's port measurement tests something
that cannot fail (§3), and this note's own first recommendation was rejected in review for circular
arithmetic (§7).

**Machine under test**, read 2026-09-13 with `sysctl` and `docker info`: `Mac16,7`, Apple M4 Pro,
**14 logical cores** (14 physical; Apple Silicon has no SMT), **24 GiB RAM**. Docker is colima,
profile `default`, **2 vCPU and 2 GiB** (`free -m` inside it reports **1,958 MiB** usable). Node
24.19.0, pnpm 12.3.4, turbo 2.10.12, PostgreSQL 18.6 in the container.

---

## 0. The three defects are one defect, and there is a fourth

CNCORE-134 lists three substrate defects found by accident and asks five questions about them. The
three are the same bug wearing three costumes:

> **A namespace that is machine-global, addressed by code that believes it is worktree-local.**

- **Postgres connections.** ADR-0104 gives every worktree its own DATABASE, which is real isolation,
  and the reader concludes the worktrees are isolated. `max_connections` is a property of the
  CLUSTER, so the 300 is one budget spent by everybody.
- **Ephemeral ports.** A stub binds `listen(0)` and calls the port its own. The port space belongs to
  the host, and ADR-0031 makes a provider's identity its base URL — so a reused port silently merges
  two providers.
- **The turbo cache.** A task hashes the files in its own package. The cache it hits is not in the
  package, and as section 2 shows, it is not even in the worktree.

**THE FOURTH INSTANCE WAS NOT IN THE BRIEF AND IS THE WORST OF THEM.** The turbo cache is shared
across every worktree on this machine. Measured 2026-09-13 from
`cncore-134-substrate-research`, running `pnpm turbo run test --filter=@canoncore/schemas`:

```
@canoncore/schemas:test: cache hit, replaying logs 68c4f053449da0a2
@canoncore/schemas:test:  RUN  v5.0.0 ~/orca/workspaces/CanonCore/cncore-99-provider-settings/packages/schemas
```

That green was computed in **a different worktree**, at a different commit, against a different
`CONTEXT.md`. The cache lives at `~/orca/projects/CanonCore/.turbo/cache` — the main checkout,
outside every worktree — and held **6,837 entries** on the day of writing. No worktree has a
`.turbo` of its own (`ls -d .turbo` → no such file). `git rev-parse --git-common-dir` answers
`~/orca/projects/CanonCore/.git`, which is how turbo gets there: a worktree's repository root is the
main checkout. Writes land there too — `turbo run … --force` restamped
`68c4f053449da0a2-{manifest.json,meta.json}` and `.tar.zst` at `00:50:12`, nine seconds before the
`stat` that read them.

So the substrate's failure mode is not only a false RED that costs an agent a debugging cycle. It is
a false GREEN, and a false green crosses worktrees.

**The unifying rule this suggests, offered rather than asserted:** every shared resource on this
machine should either be partitioned per worktree, or be sized for the number of worktrees that will
share it — and the code that reaches for it should be able to tell which it got. Today Postgres is
partitioned (databases) and unpartitioned (connections) at once, and nothing in the code says so.

---

## 1. Postgres: is raising `max_connections` right?

**Short answer: yes, it is right, and it is also not enough. The ceiling is correct as-is; the
per-suite DEMAND it is sized against is the thing that should come down.**

### What the owner's docs say

PostgreSQL 18's `max_connections` documentation (postgresql.org/docs/18/runtime-config-connection,
read 2026-09-13):

> "The default is typically 100 connections, but might be less if your kernel settings will not
> support it (as determined during initdb)."

> "PostgreSQL sizes certain resources based directly on the value of `max_connections`. Increasing
> its value leads to higher allocation of those resources, including shared memory."

**THE DOCS GIVE NO SIZING GUIDANCE AND NO PER-CONNECTION MEMORY FIGURE.** That is worth stating
plainly, because the question "what do the PostgreSQL docs say about its per-connection memory cost"
has an answer, and the answer is *nothing*. They say resources scale with the setting and stop. The
often-quoted per-connection numbers come from elsewhere; on the owner's own pages there is no figure
to cite. `work_mem` is the nearest thing and it is **not** per-connection
(postgresql.org/docs/18/runtime-config-resource, read 2026-09-13):

> "Note that a complex query might perform several sort and hash operations at the same time, with
> each operation generally being allowed to use as much memory as this value specifies… Also,
> several running sessions could be doing such operations concurrently. Therefore, the total memory
> used could be many times the value of `work_mem`."

Per OPERATION, and several per session. So the familiar `max_connections × work_mem` arithmetic is
not a bound in either direction, and this note does not use it.

### So it was measured instead

Opening N idle connections from the host against `canoncore-postgres` and reading `free -m` inside
the container, 2026-09-13, with no neighbouring worktree connected (`pg_stat_activity` showed 8
background workers and one `psql`):

| Connections opened | Live in `pg_stat_activity` | VM used | VM available | Δ over baseline | Per connection |
|---|---|---|---|---|---|
| 0 (baseline) | 9 | 840 MB | — | — | — |
| 100 | 109 | 1,004 MB | 954 MB | 164 MB | **1.64 MB** |
| 200 | 213 | 1,181 MB | 776 MB | 341 MB | **1.70 MB** |
| 280 | 289 | 1,305 MB | 653 MB | 465 MB | **1.66 MB** |

**Linear at about 1.67 MB of real memory per connection.** Extrapolated, a full 300 costs roughly
**500 MB** of a 1,958 MB VM, leaving about 650 MB. `max_connections=300` therefore fits this VM with
room, and the setting CNCORE-131 applied is affordable rather than reckless.

**A TRAP FOR WHOEVER MEASURES NEXT, because it is off by more than an order of magnitude.** Summing
backend RSS says something wildly different: `ps -eo rss` over the 100 backends totalled 2.59 GB with
a mean of **20.6 MB each**, inside a VM holding 1.96 GB. RSS counts the 128 MB `shared_buffers`
mapping once per backend. The `free -m` delta is the honest figure; a per-backend RSS mean is not.

The ceiling behaves exactly as documented at the edge. Attempting 305 against a limit of 300:

```
psql: error: connection to server at "127.0.0.1", port 55432 failed:
FATAL:  sorry, too many clients already
```

### Why not a pooler, a container each, or smaller pools

**A pooler (pgbouncer/pgcat) is the textbook answer and is wrong here, for a reason specific to this
repo.** PgBouncer's own feature page (pgbouncer.org/features.html, read 2026-09-13) advertises "Low
memory requirements (2 kB per connection by default)" against the 1.67 MB measured above, and
transaction pooling is what would collapse 100 mostly-idle pool connections into a handful. But the
same page says transaction pooling "breaks a few session-based features of PostgreSQL" — and
`packages/db/src/setup-worktree.ts:109` runs `select pg_advisory_lock($1)`, a **session-level**
advisory lock, which is precisely such a feature. ADR-0104 chose it deliberately, under "Two ways
this could destroy work, and what stops each": concurrent setup "needed a lock rather than a caught
error", and the lock is "taken on a connection to the SERVER, because the database it protects may
not exist yet". A pooler would either break worktree setup or need a carve-out around it, which is a
new dependency plus a new exception on day one.

**A container per worktree** partitions the budget properly but discards ADR-0104's measured reason
for one container, and multiplies a 1.96 GiB VM's fixed costs (128 MB `shared_buffers` each) by the
worktree count. On this VM three containers would spend 384 MB before a single connection.

**Smaller per-app pools is the answer the numbers point at**, and section 7 does its arithmetic. The
mechanism already exists: `createDb` takes `maxConnections` (`packages/db/src/index.ts:110`), and the
e2e harness's own handles already use it — `HARNESS_CONNECTIONS = 2`, with a comment saying why
(`apps/web/e2e/instance.ts:27`). What is unbounded is the ten SERVERS under test: each is a real app
process, `getDb()` calls `createDb(env.DATABASE_URL)` with no bound, and node-postgres's documented
default for `max` is **10** (node-postgres.com/apis/pool, read 2026-09-13). Ten servers × ten = the
hundred that was measured.

**Fewer concurrent servers** is the remaining lever and is the one to reach for last: the tenth
instance exists because a test needed it, and deleting coverage to fit a budget is the wrong trade.

---

## 2. Turbo: how do you declare a dependency on a file outside a package?

**The documented answer is `$TURBO_ROOT$`, and neither the ticket nor this repo was using it.**

Turborepo's configuration reference (turborepo.dev/docs/reference/configuration, read 2026-09-13 —
note `turborepo.com` now 301s to `turborepo.dev`):

> "Starting a file glob with `$TURBO_ROOT$` will change the glob to be relative to the root of the
> repository instead of the package directory."

with the example `"inputs": ["$TURBO_ROOT$/tsconfig.json", "src/**/*.ts"]`. Also relevant:

> `globalDependencies`: "A list of globs that you want to include in all task hashes. **If any file
> matching these globs changes, all tasks will miss cache.**"

> `inputs`: "A list of file glob patterns relative to the package's `package.json` to consider when
> determining if a package has changed."

> `$TURBO_DEFAULT$`: "Because specifying an `inputs` key immediately opts out of the default
> behavior, you may use the special string `$TURBO_DEFAULT$`… to restore `turbo`'s default behavior."

And the sentence that condemns the current arrangement, from the caching page
(turborepo.dev/docs/crafting-your-repository/caching, read 2026-09-13):

> "Turborepo assumes that your tasks are deterministic. If a task is able to produce different
> outputs given the set of inputs that Turborepo is aware of, caching may not work as expected."

**CNCORE-132 proposes `globalDependencies: ["CONTEXT.md"]` as "the one-line fix". The lookup says
that is the bluntest of the three documented options** — it busts *every* task's cache in the
repository on a glossary edit, by that key's own definition. `$TURBO_ROOT$` in the schemas package's
own `inputs` is narrower, is the documented mechanism for exactly this, and costs no other task a
rebuild.

### The defect reproduces, and it is not one package

CNCORE-132's claim was verified rather than taken on trust. `pnpm turbo run test
--filter=@canoncore/schemas --dry=json` reports the task hashing **six** files:

```
package.json, src/glossary.test.ts, src/index.test.ts, src/index.ts, tsconfig.json, vitest.config.ts
```

`CONTEXT.md` is not among them, though `glossary.test.ts:35` reads `../../../CONTEXT.md`. Appending a
line to `CONTEXT.md` and re-running returned the same hash, `68c4f053449da0a2`, and the same replayed
log. Confirmed.

**WHAT THE TICKET DOES NOT SAY IS THAT THE GLOSSARY IS THE SECOND-SMALLEST INSTANCE.** Eleven test
files read repo-root files through `packages/config/src/testing/repo-root.ts`:

| File | Reads |
|---|---|
| `packages/env/src/install-path.test.ts` | `README.md`, `.env.example`, `compose.yaml`, `Dockerfile` |
| `packages/config/src/ci-workflow.test.ts` | `.github/workflows/ci.yml` |
| `packages/config/src/image.test.ts` | the `Dockerfile` and the workflow |
| `packages/config/src/adr-numbering.test.ts` | `docs/adr/` |
| `packages/config/src/biome-config.test.ts` | `biome.jsonc` |
| `packages/config/src/licence.test.ts` | `LICENSE` |
| `packages/config/src/doc-line-citations.test.ts`, `sweep-shard-citations.test.ts`, `network-gate-wiring.test.ts`, `node-major.test.ts`, `testing/repo-root.test.ts` | various root files |

**`@canoncore/config` is already immune, on purpose, and the repo wrote down why.**
`packages/config/turbo.json` sets `"cache": false` on its test task with this comment:

> "Uncached, deliberately. This package's suite asks whether the linter reaches every file git
> tracks, so its real inputs are the whole repository… Caching it on a subset means a new file in
> another package replays a stale pass, which is the same false green this suite exists to catch.
> The suite runs in about a second; that is cheaper than the lie."

That is the whole answer to question 2, already in the repository, applied in one package and not in
the other two. **So this is an unapplied precedent rather than an open problem.**

**`@canoncore/env` is exposed and nobody had noticed.** Its test task reports `cache: True` over
seven package-local files, none reaching outside, while `install-path.test.ts` asserts on four root
files. Proven 2026-09-13 by appending a comment to `compose.yaml` — the file whose own header says it
IS the install path — and re-running:

```
=== warm ===
@canoncore/env:test: cache hit, replaying logs 8cb865d552b1aeb3
=== after editing compose.yaml (which install-path.test.ts asserts on) ===
@canoncore/env:test: cache hit, replaying logs 8cb865d552b1aeb3
```

Same hash, cache hit, after editing the file under assertion. `git status` clean afterwards.

**Which fix for which package, and they differ for a principled reason.** Where the outside
dependency is ENUMERABLE, name it: `@canoncore/schemas` reads exactly one root file, so
`"inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/CONTEXT.md"]` is precise and keeps the cache.
`@canoncore/env` reads four, so the same treatment works and is worth the four lines. Where the real
input is "the whole repository" and cannot be listed, `cache: false` is right, which is the judgement
`@canoncore/config` already made.

### What else in a monorepo is commonly cached but should not be

Turbo's own list (caching page, read 2026-09-13) is about economics, not correctness: tasks faster
than a Remote Cache round trip, tasks with outputs so large that transferring costs more than
rebuilding, and tasks with their own internal caching where "configuration can quickly become
complicated". To that, from this repository's evidence, add the correctness case: **any task whose
assertions read files outside the package, and any task asserting a property of the repo as a whole**
— lint reach, file counts, ladder integrity, a licence header sweep. This repo already marks its
genuinely non-deterministic tasks `cache: false` in the root `turbo.json` — `test:e2e`,
`test:browser`, `test:contract`, every `db:*`, `dev` — and those calls are correct.

---

## 3. Ports: is holding sockets open the right pattern?

**The ticket's own measurement proved nothing, and the real mechanism is an operating-system
difference that makes local green and CI green mean different things.**

### What Node and the OS actually document

Node 24's `net` documentation (nodejs.org/docs/latest-v24.x/api/net.html, read 2026-09-13):

> "If `port` is omitted or is 0, the operating system will assign an arbitrary unused port, which can
> be retrieved by using `server.address().port` after the `'listening'` event has been emitted."

> "All `net.Socket` are set to `SO_REUSEADDR`."

> `reusePort`: "For TCP servers, setting `reusePort` to `true` allows multiple sockets on the same
> host to bind to the same port… **Default:** `false`."

> `server.close()`: "Stops the server from accepting new connections and keeps existing connections.
> This function is asynchronous, the server is finally closed when all connections are ended and the
> server emits a `'close'` event."

**`TIME_WAIT` AND `SO_REUSEADDR` ARE A RED HERRING FOR THIS BUG, WHICH IS WHY THE QUESTION AS POSED
CANNOT BE ANSWERED AS POSED.** `TIME_WAIT` is entered by the endpoint that closes an ESTABLISHED
connection; a listening socket closed with no live connections does not enter it, so its port returns
to the ephemeral pool at once. And `SO_REUSEADDR` exists precisely to let a bind succeed over a
`TIME_WAIT` remnant, so it removes a delay rather than adding one. Neither delays reuse here. **The
reuse the stub suffers is immediate and total**, which is what the measurement below shows directly
and is the reason this note does not rest the point on either flag.

**An honest limit on that second sentence.** Node's quoted line says "All `net.Socket` are set to
`SO_REUSEADDR`", and a listening server is a `net.Server`, not a `net.Socket` — so the documentation
quoted does NOT own a claim about the listening socket's flags, and no page on nodejs.org was found
that does. The `TIME_WAIT` half stands on its own without it.

### The measurement the ticket should have taken

CNCORE-134 records: "Measured: 200 simultaneous `listen(0)` calls return 200 distinct ports."
**THAT MEASUREMENT CANNOT FAIL.** Two sockets cannot hold one port simultaneously without
`reusePort`, which is off by default. It tests the operating system's correctness, not the stub's
safety. Reproduced here for completeness (200/200 distinct, on both platforms), and it says nothing.

The pattern a per-test stub actually uses is bind → read port → close → bind again. Measured
2026-09-13, 500 sequential cycles, five trials per platform, the same script on each
(`createServer()`, `listen(0, "127.0.0.1")`, `close()`):

| Trial | macOS 25.6 (host) | Linux 6.8 (`node:24-alpine`) |
|---|---|---|
| 1 | 500/500 distinct, no repeat | 490/500, **first repeat at iteration 63** |
| 2 | 500/500 distinct, no repeat | 484/500, **first repeat at iteration 136** |
| 3 | 500/500 distinct, no repeat | 486/500, **first repeat at iteration 190** |
| 4 | 500/500 distinct, no repeat | 487/500, **first repeat at iteration 99** |
| 5 | 500/500 distinct, no repeat | 474/500, **first repeat at iteration 59** |

**THIS IS THE WHOLE OF CNCORE-126, AND IT IS NOT FLAKINESS.** macOS allocates ephemeral ports
sequentially through `net.inet.ip.portrange.first`–`last` = 49152–65535 (16,384 ports, read with
`sysctl`), so a repeat needs the range to wrap and five runs of 500 never saw one. Linux randomises
selection within `ip_local_port_range` = 32768–60999 (28,232 ports, read from `/proc/sys`), so the
birthday bound bites in **tens** of binds, not thousands. That ticket's "passes locally and fails in
CI" is not timing: it is macOS versus Linux, and the local suite could be run a thousand times
without reproducing it.

### So: is holding sockets open for the file the right pattern?

**It works and it is the wrong shape.** Holding is provably sufficient — measured here, 300 further
binds taken while 200 sockets were held open landed on a held port **0 times**, on both platforms,
because the OS will not hand out a bound port. But it fixes the symptom at one remove: it keeps two
providers from sharing a port, when what ADR-0031 actually requires is that two providers not share
an IDENTITY. Those come apart the moment anything else (a restarted stub, a second suite, a fixture
that closes early) reuses a port.

**The shape that matches the decision is to stop deriving identity from the port.** CNCORE-126's own
first option says this: "a stub whose identity is fixed and whose port is an implementation detail."
A distinct loopback HOST per stub gives it directly — `127.0.0.2`, `127.0.0.3` and up are all
loopback on both platforms, so `http://127.0.0.7:<any port>` is a stable identity whatever the OS
hands out. Holding sockets open is the cheaper patch; this is the one that cannot come apart. Either
belongs to CNCORE-126 rather than to this note.

**What a suite should know**, gathered: the ephemeral range differs by platform and is readable
(`sysctl net.inet.ip.portrange.first` / `cat /proc/sys/net/ipv4/ip_local_port_range`); Linux
randomises within it and macOS does not; `SO_REUSEADDR` is already on and buys nothing extra;
`reusePort` is off and must stay off, since turning it on would let two stubs share a port and make
the bug constant rather than occasional.

---

## 4. CI: the service containers, and the word that killed the image build

### Why CI never hit the Postgres ceiling

GitHub's documentation (docs.github.com, service containers and hosted-runner references, read
2026-09-13) says a service container is created fresh per job and destroyed when the job completes,
and that each job runs on a fresh instance of the runner image, each a new VM. `.github/workflows/ci.yml`
gives `postgres:18` to each of the jobs that needs one (`image: postgres:18` at lines 287, 323, 409,
448, 496, 696), and **none of them overrides `max_connections`**, so each job is one worktree against
one cluster at the stock 100. This is correct as-is and worth not disturbing: nothing should
"helpfully" consolidate those services into one shared instance.

**THIS NOTE'S FIRST DRAFT SAID CI RUNS WITH "ROUGHLY ONE CONNECTION" OF MARGIN, AND REVIEW KILLED IT
WITH THE OBVIOUS TEST: if one suite peaked at 101 against a ceiling of 100, the `The page over HTTP`
job would fail every time, and it passes every time — including on this branch.** The claim was
false, and the reason is that **the peak is a property of the HOST, not of the suite**: node-postgres
fills a pool lazily, so how many of each server's ten slots are ever opened depends on how much of
the suite runs at once. Measured 2026-09-13 by re-running the same suite with vitest's worker count
constrained, sampling `pg_stat_activity` once a second:

| Worker cap | Peak connections | Duration | Result |
|---|---|---|---|
| unconstrained (14 cores) | **101** | 18.9 s | 198 passed |
| `--maxWorkers=4` (a public-repo runner's core count) | **91** | 15.8 s | 198 passed |
| `--maxWorkers=2` | **93** | 15.5 s | 198 passed |

So the demand does not collapse when concurrency does — the floor is the ten servers themselves, not
the test parallelism — and a 4-core runner lands at about **91 against a ceiling of 100**. That is
why CI passes. **The margin is real but thin, and it is under ten connections rather than the
comfortable multiple "a service container per job" suggests.** ADR-0104's sentence that CI "needs no
equivalent" to the raised ceiling (under "What sharing one container costs, and the ceiling nobody
had counted") therefore stands, with a caveat it does not carry: it holds because of the partitioning
and *not* because of headroom, so raising per-suite demand breaks CI before it breaks any local
worktree.

**Stated as a gap rather than filled:** the CI peak itself was not measured. Doing so means adding a
sampling step to `ci.yml`, and this ticket's own criteria forbid editing that file. The 91 above is
this machine imitating a runner's core count, not a runner.

### The runners are bigger than the machine that shares one database

This repository is **public** (`gh repo view --json visibility` → `PUBLIC`, 2026-09-13), so
`ubuntu-latest` is **4 vCPU / 16 GB RAM / 14 GB SSD**; the private-repo tier would be 2 vCPU / 8 GB
(docs.github.com hosted-runners reference, read 2026-09-13). **The CI Postgres therefore has eight
times the RAM of the local one and twice the CPU.** The colima VM every worktree shares — 2 vCPU,
1.96 GiB — is the smallest Postgres host in the whole system, and it is the one serving the most
clients. That inversion is the substrate's central awkwardness and section 7 turns on it.

### `unauthorized: authentication required`

The failure named in the brief is a Docker Hub anonymous pull, not a GHCR problem, and CLAUDE.md
already records the distinction. The current limits (docs.docker.com/docker-hub/usage/pulls, read
2026-09-13):

| User type | Pulls per 6 hours |
|---|---|
| Unauthenticated | **100 per IPv4 address or IPv6 /64 subnet** |
| Personal (authenticated) | **200** |
| Pro, Team, Business | Unlimited |

The window is 6 hours, reported in the API headers as 21600 seconds. **The per-IP counting is what
makes this bite on hosted runners**, whose addresses are shared with every other GitHub customer, so
a workflow can exhaust an allowance it never spent.

**The documented fix is to authenticate**, and Docker's own GitHub Actions guidance recommends
`docker/login-action` with a username and token in repository secrets, or an OIDC connection for
short-lived tokens. **THE FIX IS NOT DOCUMENTED WHERE YOU WOULD LOOK FOR IT:** `docker/setup-buildx-action`,
which is the action that performs the pull, says nothing about rate limits, authentication or
`moby/buildkit` anywhere in its README (read 2026-09-13). Its only relevant input is `driver-opts`,
with the example `image=moby/buildkit:master`.

Where this repository stands: `ci.yml:711` runs `docker/setup-buildx-action@v4` with **no Docker Hub
login before it**, and at line 951 the same action runs *before* `docker/login-action@v4`, which in
any case targets `ghcr.io`. Everything else the workflow pulls — `provider-wiki`, `provider-tmdb`,
`gitleaks`, the app image — is on GHCR. **So Docker Hub is reached exactly once per image job, by
buildx fetching its own BuildKit container, and that single anonymous pull is the entire exposure.**

Two documented remedies, and the second is cheaper than it looks. Authenticate, which needs a Docker
Hub account and two secrets. Or **avoid the pull**: Docker's builders/drivers page (read 2026-09-13)
says the `docker` driver "uses the BuildKit library bundled into the Docker daemon" while
`docker-container` creates "a dedicated BuildKit container". Only the latter pulls. That is not free
here — `ci.yml` uses `cache-to: type=gha` and a per-platform matrix, which want the container driver
— so authentication is the realistic answer for this workflow. **Filed as an observation, not a
proposal to act on today:** the failure is intermittent, clears on a rerun, and CLAUDE.md already
teaches the reader to recognise it, which is most of the cost recovered.

---

## 5. Concurrency: how many agents, and what signals over-subscription

Answered in full in section 7. The signals belong here.

**A dispatcher is over-subscribing, not finding code bugs, when it sees any of these.** Each was
observed in this repository:

1. **`sorry, too many clients already`**, anywhere. Never a code bug. Reproduced above at the 301st
   connection. Surfaces as one red test with a 500 behind it, in whichever suite asked last — which
   is to say, usually in a file the diff never touched.
2. **A red test in a file the branch does not modify.** The CNCORE-131 signature. A diff of one
   Markdown file cannot break a provider test.
3. **A failure that clears on rerun with no change.** Both the Postgres ceiling and the ephemeral
   port collision have this shape, and so does the Docker Hub limit.
4. **A test that passes locally on macOS and fails on Linux CI** with no platform-specific code.
   Section 3's port allocation is one cause; it will not be the only one.
5. **A cached green whose replayed log names another worktree's path.** Section 0. The tell is in
   turbo's own output and nobody reads it, because it appears under a `cache hit` line.

Signals 1 to 3 say stop dispatching. Signals 4 and 5 say the green was never evidence.

**The cheapest instrument for signal 1 is one query**, and a dispatcher could run it before starting
a wave:

```
docker exec canoncore-postgres psql -U postgres -tAc \
  "select count(*), current_setting('max_connections') from pg_stat_activity"
```

---

## 6. The five current practices, labelled

The ticket asks for each to be called correct as-is, papering over a problem, or actively wrong.

| # | Practice | Verdict | Reason |
|---|---|---|---|
| 1 | `max_connections=300` in `packages/db/docker-compose.yml` | **Correct as-is** | Measured at 1.67 MB/connection, 300 costs ~500 MB of a 1,958 MB VM and leaves ~650 MB. The ceiling is affordable and the number matches the three-worktree intent ADR-0104 states under "What sharing one container costs, and the ceiling nobody had counted". It is a ceiling, not a target, and it buys only 2.85 suites, which is what caps agents at two. |
| 2 | `turbo.json` declaring no `globalDependencies` and `test` no `inputs` | **Actively wrong** | Two cached tasks assert on files they do not hash, and one of them (`@canoncore/env`) asserts on the install path itself. Turbo's own docs say caching assumes determinism; these tasks are not. `@canoncore/config` shows the repo already knows this. |
| 3 | Stub servers on `listen(0)`, closed per test, identity = base URL | **Papering over a problem** | The port is not the defect; deriving identity from it is. Holding sockets open (0 collisions in 300 binds over 200 held) works and leaves the real coupling in place, to come apart the next time anything reuses a port. |
| 4 | A `postgres:18` service container per CI job | **Correct as-is** | GitHub documents fresh-per-job service containers on fresh VMs, which is real partitioning, and no CI service overrides `max_connections`. Flagged, not downgraded: a 4-core runner's peak measures ~91 against the stock 100, so it is correct and THIN rather than correct and roomy. An earlier draft called the margin ~1 connection and predicted a CI failure that does not happen; see section 4. |
| 5 | `docker/setup-buildx-action` with no Docker Hub login | **Papering over a problem** | The 100-per-6-hours anonymous limit is counted per IP on runners whose IPs are shared, so the failure is not controlled by anything this repo does. It is cheap to live with (intermittent, clears on rerun, documented in CLAUDE.md) and cheap to fix (two secrets). |

**A sixth, not in the brief, and it is the one to fix first:** the turbo cache shared across worktrees
at `~/orca/projects/CanonCore/.turbo/cache`. **Actively wrong in combination with
practice 2** — alone it is a sound optimisation, since identical inputs should produce identical
results, and that is exactly what turbo promises. It becomes a defect only because the inputs are
mis-declared, at which point one agent's stale green is served to every other agent on the machine.
Fixing practice 2 fixes this; partitioning the cache per worktree would also work and would throw
away the sharing that makes a cold worktree fast.

**A seventh, observed while measuring and outside this ticket's scope:** the shared container holds
**418 databases** totalling **3,739 MB** across **80 distinct worktree stems**, on a machine with 4
worktrees. `setUpWorktreeDatabase` never drops anything, deliberately and rightly — ADR-0104, under
"Two ways this could destroy work, and what stops each": "being wrong in that direction costs a
developer their work". But nothing else drops them either, so the disk cost grows monotonically with
every ticket ever worked. Worth a ticket of its own; not a
correctness problem today.

---

## 7. The concurrency ceiling on this machine, with its arithmetic

### One suite, measured

`pnpm test:e2e` in this worktree, 2026-09-13, sampling `pg_stat_activity`, container `free -m` and
host `ps` once a second through the run. The suite passed: **15 files, 198 tests, 18.92 s**.

| Quantity | Peak |
|---|---|
| Connections in the container | **110** total, **101** from this worktree |
| Container memory used | 1,148 MB (available fell to 810 MB) |
| Next server processes on the host | **24**, totalling **2,092 MB** RSS |
| Host CPU over the run | 43.91 s user + 8.48 s sys in 20.19 s wall = **2.6 cores mean** |

The 101 independently reproduces ADR-0104's "one suite peaks at about 100 client connections on its
own" (under "What sharing one container costs, and the ceiling nobody had counted"), taken on a
different day by a different method. The arithmetic behind it: **10 app servers ×
node-postgres's default `max` of 10 = 100**, plus harness handles at `HARNESS_CONNECTIONS = 2`.

### The four ceilings

Take the worst case honestly — every agent in its e2e run at the same moment — because "unlikely" is
exactly what produced CNCORE-131.

| Constraint | Budget | Per suite | Agents |
|---|---|---|---|
| **Postgres connections** | 300 − 3 superuser-reserved − ~9 background = **288** | 101 | **2.85** |
| colima VM memory | ~1,130 MB available at baseline | **308 MB** (1,148 peak − 840 baseline, measured) | 3.7 |
| Host RAM | 24 GiB, call it 16 GiB usable beside an editor and browsers | ~2.1 GiB servers + ~0.9 GiB runner | 5.3 |
| Host CPU | 14 cores | 2.6 cores mean | 5.4 |

The VM-memory row uses the **measured** suite delta rather than 101 × 1.67 MB. The idle-connection
slope in section 1 under-counts a running suite, which also holds buffers and sort memory: an earlier
draft of this table said 170 MB and 6.6 agents, and its own evidence two sections up contradicted it.

**The binding constraint is Postgres connections, and it binds at 2.85.**

> ### The recommendation: **two concurrent agents today, and the number to change is the demand, not the ceiling.**
>
> **Two, because 2.85 floors to two and the ticket asked for the substrate where a failure is ALWAYS
> the code's fault.** Nothing weaker than the worst case answers that question: 3 × 101 = 303 exceeds
> the 288 available, so three agents CAN exhaust the cluster, and the resulting `sorry, too many
> clients already` lands in a file the diff never touched.
>
> **An earlier draft of this note recommended three, and the argument for it was circular.** It
> rejected four because 4 × 101 overshoots the hard 300 — an argument that rejects three just as
> squarely, since 303 > 300 — and then rescued three with an unquantified claim that peaks rarely
> coincide. **That is precisely the reasoning that produced CNCORE-131:** the second worktree's suite
> was also unlikely to overlap, right up until it did. Review caught it; the number is two.
>
> Three is what the duty cycle probably supports, and "probably" is the word that costs a debugging
> cycle when it is wrong. Take three only with a dispatcher that checks the live count first, using
> the query in section 5.

**What buys more than an argument does:** section 1's unbounded server pools. This ceiling is a
property of the substrate as it stands, not a law, and it moves the moment per-suite demand does.

### How to buy more, and it is a lot more

The ten servers under test hold ten-connection pools because nothing tells them otherwise:
`getDb()` calls `createDb(env.DATABASE_URL)` with no bound. A server in this suite serves one
sequential test file. If each instance ran with a pool of 3, per-suite demand falls from 101 to about
**32**, and 288 / 32 = **9 agents** on the same 300-connection ceiling, at which point the host's CPU
(5.4) becomes the binding constraint instead and the answer is **5**.

**That is the change worth making: 2 agents → 5, with no new ceiling and no new dependency.** It is
not free and this note does not pretend otherwise. `getDb()` reads only `DATABASE_URL`, so bounding
the servers means a new environment variable — and CLAUDE.md forbids introducing one unless something
in the repo reads it in the same change, which is a ticket's worth of work rather than a line.
`createDb` already takes the option; only the wiring from environment to `getDb()` is missing.

**Two numbers that are NOT the ceiling, recorded so nobody re-derives them.** The PostgreSQL wiki's
pool-sizing formula (wiki.postgresql.org/wiki/Number_Of_Database_Connections, read 2026-09-13) —
"the number of active connections should be somewhere near ((core_count * 2) + effective_spindle_count)"
— gives **4** on this 2-vCPU VM. **That is a throughput target for ACTIVE connections and not a
ceiling on OPEN ones**, and this suite's connections are overwhelmingly idle, so it does not cap
agents at one. It does explain why three suites at once feel slower than three times one suite, and
it is the reason not to answer contention by raising `max_connections` a second time: the same page
warns that "Pg will usually complete the same 10,000 transactions faster by doing them 5, 10 or 20 at
a time than by doing them 500 at a time." The second number is the 300 itself, which is a ceiling on
what is allowed rather than a statement about what performs.

---

## 8. What would change, ranked by harm prevented per line

Nothing here was done. Each is a ticket's worth of work, and items 1 and 2 fall inside CNCORE-132's
existing scope.

1. **Declare the outside inputs, or stop caching — in BOTH packages.** `@canoncore/schemas`:
   `"inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/CONTEXT.md"]`. `@canoncore/env`: the same with
   `README.md`, `.env.example`, `compose.yaml`, `Dockerfile`. Prefer these to `globalDependencies`,
   which the docs say busts every task in the repo. **This is the highest-value item because it is
   the only defect here that produces a false GREEN**, and because it currently crosses worktrees.
   CNCORE-132 must verify the fix on a WARM cache, as its own text insists — and **its scope needs
   widening first**, since it names only the glossary while `@canoncore/env` replays stale against
   the install path. A fix that lands on one package leaves the worse instance standing.
2. **Bound the e2e servers' pools** (section 7). Turns 2 concurrent agents into 5. Needs an
   environment variable and its reader in the same change.
3. **Give each stub a distinct loopback host** rather than holding its port (section 3), so a
   provider's identity stops depending on the OS. Belongs to CNCORE-126.
4. **Log in to Docker Hub before `setup-buildx-action`** (section 4). Two secrets; removes a failure
   this repo cannot otherwise control.
5. **File the database accumulation** (section 6, seventh practice): 418 databases and 3.7 GB for 4
   live worktrees.

**What NOT to do, with reasons, so the next reader declines them on purpose:** do not add a
connection pooler (it breaks `pg_advisory_lock`, which ADR-0104 chose deliberately); do not give each
worktree its own Postgres container (discards ADR-0104's measured decision and multiplies
`shared_buffers` in a 1.96 GiB VM); do not raise `max_connections` again (the wiki's own throughput
argument, and the VM has ~650 MB left, not ~2 GB); do not delete e2e instances to fit the budget;
do not set `reusePort` (it would make the port collision constant rather than occasional); do not
partition the turbo cache per worktree before fixing the input declarations, since sharing is not the
defect.

---

## Evidence

Every figure above was taken on 2026-09-13 on `Mac16,7` unless stated.

**Local, measured:** `sysctl hw.*` and `docker info` for the machine and the colima VM; `docker exec
canoncore-postgres psql` for `pg_settings`, `pg_stat_activity` and `pg_database`; `free -m` inside the
container for every memory figure; N concurrent `psql … pg_sleep` sessions at N = 100, 200, 280 and
305 for the connection slope and the ceiling; `pnpm test:e2e` with a one-second sampler for the suite
peaks; a 500-cycle `listen(0)`/`close()` script run five times on the host and five times in
`node:24-alpine` for port reuse; `pnpm turbo run … --dry=json` for task input sets, and
append-then-restore edits to `CONTEXT.md`, `compose.yaml` and `.github/workflows/ci.yml` for the cache
replays. Scripts were written to the session scratchpad, not to the repository.

**Owners' documentation, read 2026-09-13:** postgresql.org/docs/18 (`runtime-config-connection`,
`runtime-config-resource`); wiki.postgresql.org/wiki/Number_Of_Database_Connections;
turborepo.dev/docs (`reference/configuration`, `crafting-your-repository/caching`);
nodejs.org/docs/latest-v24.x/api/net.html; node-postgres.com/apis/pool; pgbouncer.org/features.html;
docs.docker.com (`docker-hub/usage/pulls`, `build/builders/drivers`); github.com/docker/setup-buildx-action;
docs.github.com (GitHub-hosted runners reference, service containers).

**Not consulted:** blog posts restating any of the above, and any previous attempt at this product.

**Gaps, stated rather than filled.** The 24-process / 2,092 MB figure for Next servers is host RSS and
so double-counts shared pages between the parent and worker of each instance; the true private cost is
lower and was not separated, which makes the host-RAM ceiling in section 7 conservative. The "~9
background connections" subtracted from the 300 was read once at rest, not sampled under load. No
measurement was taken of two suites running concurrently — the failure that motivated the ticket was
reproduced from its own record rather than re-staged, because staging it means deliberately breaking
a neighbouring agent's run.
