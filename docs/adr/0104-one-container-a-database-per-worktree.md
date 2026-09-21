---
status: accepted
---

# One Postgres container, a database per worktree, and never port 5432

The development database publishes **55432**, every CanonCore worktree shares the one container, and
each worktree gets its own database inside it, named after its branch.

## Why not 5432, and this is the load-bearing half

A machine that already runs PostgreSQL shadows the container SILENTLY on 5432. It is not a bind
failure and there is no error anywhere:

- Docker publishes on the `0.0.0.0` wildcard.
- A local server (Homebrew's `postgresql@N`, say) binds the more specific `127.0.0.1` and `[::1]`.
- The more specific bind WINS for a connection to `localhost`.

So `docker compose up` reports success, `docker ps` shows the container healthy, and every
connection goes to the other server. Measured on 2026-09-10 with both running:
`psql -h localhost -p 5432` answered `PostgreSQL 17.11 (Homebrew)` while
`docker exec canoncore-postgres psql` answered `PostgreSQL 18.6 (Debian)`.

**CNCORE-4 shipped its entire local test run against the wrong engine because of this**, and
reported "tests pass" truthfully while doing it. The repo pins `postgres:18`; the tests ran on
17.11. Nothing in the suite could have noticed, because both are PostgreSQL and both answer.

The first response to this was a troubleshooting note in the README telling the reader to stop their
own server. That is a workaround for a problem the repo was creating, and it fails the way
documentation always fails: it is read after the confusion, not before. Not contending for the port
is what removes it. `src/docker-compose.test.ts` fails if anybody puts it back — including via
`${CANONCORE_DB_PORT:-5432}`, which the first version of that test passed because it only looked at
the end of the string. The check is itself tested against fixtures of every form, rather than only
being run against the real file.

`apps/web/.env.example` is DELETED rather than updated. It shipped one database name for every
worktree, and copying it — which the README used to instruct — put a worktree back on a shared
database while `db:setup` reported success and left the file alone. `db:setup` writes the file now,
and says plainly when an existing one names a different database.

**55432 rather than 5432 has company.** Supabase's CLI defaults its local database to `54322` for
the same reason (config reference, read 2026-09-10). `CANONCORE_DB_PORT` overrides it, using
Compose's documented `${VAR:-default}` interpolation.

## Why one container, and why not one database

`name: canoncore` in the compose file pins the Compose project, and Compose resolves a project by
name rather than by directory — precedence is `-p`, then `COMPOSE_PROJECT_NAME`, then the top-level
`name:`, then the directory (docs.docker.com, read 2026-09-10). So every CanonCore worktree resolves
the SAME project.

Measured rather than reasoned, and TRUE ONLY WHILE THE TWO COPIES OF THE FILE AGREED: running
compose from a second worktree answered `Container canoncore-postgres Running` and left the
container id untouched, with one volume between them. Where the copies differ, a plain `up`
recreates the container underneath every other worktree, which is why `db:start` passes
`--no-recreate` (CNCORE-233, under "A worktree starts the container and never recreates it"
below).

One container for eight worktrees is fine and cheap. ONE DATABASE IS NOT. The test harness drops and
recreates `<database>_test`, so two worktrees running `pnpm test` at once would take each other's
test database out from under them, mid-run, with a `drop database ... with (force)`. This repo builds
by dispatching a worktree per ticket (ADR-0051), so parallel suites are the normal case rather than
the exotic one.

`pnpm db:setup` therefore derives a database from the branch —
`jacobdrees/cncore-4-item-on-a-page` becomes `canoncore_cncore_4_item_on_a_page` — creates it,
migrates it, seeds it, and writes `apps/web/.env`. One command in a fresh worktree.

## Two ways this could destroy work, and what stops each

**A truncated name.** PostgreSQL truncates an identifier at 63 bytes SILENTLY, and the harness
derives `<name>_test` plus one database per suffix a suite asks for, and DROPS them. A name long
enough for the derived one to truncate back onto it would drop the worktree's own database on a test
run. `build-database.ts` already REFUSES rather than truncating, so the failure was a hard stop
rather than data loss; reserving the room is what turns that stop into a working setup.

**The SET drifted, and the FORMAT drifted too — which took a third ticket to find.** The two
paragraphs below said the format could not, on the grounds that `testDatabaseNameFor` is the one
place that knows how a test database is named and the reservation test builds its derived names by
calling it. Both halves were true and the conclusion did not follow: the test called it ONCE and the
running harness called it TWICE. CNCORE-150 is that sentence being wrong, and what follows it here
is still right about the set. WHICH SUFFIXES EXIST drifted first: `buildTestDatabase` took a
`string`, so the set lived as literals at the call sites with a hand-written copy in the reservation
test, which read `["", "web", "fresh"]` while the web suite had grown to five. Two were missing and
one of those, `_test_purgeable`, was four characters past the reservation — so any worktree whose
branch stem ran to the limit met the hard stop above and could not run `pnpm test:e2e` at all. True
of `cncore_47_properties_validation` on the day it was found, 2026-09-12, and found by adding a
sixth rather than by anything failing.

**THE TAIL WENT ON TWICE, AND ONLY A LONG BRANCH COULD SHOW IT** (CNCORE-150). `global-setup.ts`
builds `<worktree>_test` and `testing/setup.ts` then points DATABASE_URL AT IT, deliberately, so that
a suite builds its context with the real `createContext` rather than a hand-copy (ADR-0103). A file
asking for a second database after that is deriving from the RUN's database rather than from the
worktree's, and gets `<worktree>_test_test_<suffix>` — one whole `_test` past the format this record
describes, which is `<name>_test` plus a SIBLING per suffix. The reservation test modelled the one
step and never the two, so it stayed green while the worst branch derived 68 bytes.

**IT IS LOCAL-ONLY, WHICH IS WHY IT SURVIVED.** `ci.yml` sets DATABASE_URL to a database named
`canoncore`, so the branch never enters the arithmetic and CI derives 25 bytes. The only person who
meets it is the one running the full suite by hand on a long branch, and the obvious reading there is
that they broke something. Measured against every pushed branch on 2026-09-13: **11 of 72** derived
a name that broke, and every one of them sat at the 52-byte cap — `worktreeDatabaseName` slices the
stem at 33, so 52 is the longest name it can make and 68 the longest doubled tail. The dispatcher
names these branches from ticket titles, so it is an ordinary shape rather than a rare one.

**A FIGURE FROM THE TICKET DID NOT SURVIVE BEING CHECKED, and it is recorded here because it is the
kind that travels.** CNCORE-150 reported the worst branch as `cncore-141-locked-provider-contract`
**at 54 bytes**. That is the name BEFORE the stem slice, and no database is ever called it: the real
name is `canoncore_cncore_141_locked_provider_contra_f2eee590`, 52 bytes, like every other branch at
the cap. The ticket's "10 of 66" was 11 of 72 by the day the work was done. Neither changes the
remedy — the breakage is real and the arithmetic above is what it rests on.

**THE FIX WAS THE DERIVATION, NOT THE BUDGET, and that distinction is the whole of it.** Widening
`LONGEST_DERIVED_SUFFIX` from eleven to sixteen is the obvious reading and is the one move the
paragraph below forbids: it shortens every stem and renames databases. Eleven was never too small. It
was TRUE for the format above and a lie only because the tail went on twice, so `testDatabaseNameFor`
now names from the worktree database — recovering it by stripping its own `_test` marker when handed
one of its own derivatives. The worst branch lands on 63 exactly, and no existing worktree is renamed.
`worktreeDatabaseName` ends every name in eight hex characters, so a worktree database can never end
in `_test` and be mistaken for a derived one.

**The recovery is idempotent, and the existing refusal is what makes that safe.**
`buildSuiteDatabase(suffix)`, called from a worker, resolves to the database that
worker is already running against rather than quietly building a `_test_test`
below it — and since the next thing it does is `drop database ... with (force)`,
the `name === database` guard is what turns that into a refusal.
Both halves are pinned by `worktree-database.test.ts`. This sentence said `buildTestDatabase()` with
no suffix until CNCORE-246; CNCORE-199 took the default off both builders and gave the suite's
database its own verb, which the section below states and this paragraph had not caught up with.

**`TEST_DATABASE_SUFFIXES` is the mechanism that ships** (CNCORE-112). One declaration;
`buildTestDatabase` takes a member of it and nothing else; the reservation test ranges over it rather
than over a list of its own. A suffix invented at a call site is now a compile error —
`buildTestDatabase("purgeable")` answers TS2345 — instead of a suite that dies on somebody else's
branch. `""` is a member rather than an absence, because `packages/db`'s own suite takes the bare
`<database>_test` and that case has to be measured like the rest.

**The reservation stays a constant the declaration is HELD TO, never one derived from it.** Widening
it shortens every stem and so RENAMES the database of any worktree already past the new limit,
leaving its `.env` pointing at the one it had — so a suffix that does not fit gets shorter, which is
what CNCORE-93 did to `purgeable`. A `Math.max` over the declared set is the refactor that reverses
this, and it is tempting exactly because the constant and the declaration now sit one import apart:
it would make the budget FOLLOW whatever suffix was added last and widen it silently.
`worktree-database.ts` names that move so the next reader declines it on purpose rather than by luck.

**The budget is full, which is what to know before adding another.** NINE of the TWENTY declared
suffixes — `_test_fresh`, `_test_paged`, `_test_purge`, `_test_still`, `_test_place`, `_test_order`,
`_test_group`, `_test_allow` and `_test_tasks` — spend all eleven characters, so the longest tail the
harness can derive IS the reservation, exactly. (This read "four of the six" until 2026-09-13, "seven
of the thirteen" until 2026-09-16, "seven of the fifteen" until 2026-09-18 and "eight of the
seventeen" until 2026-09-19, which had already missed `_test_group`, and "nine of the nineteen"
until CNCORE-229 added `leak` the same day; the set has now grown out from under this sentence FOUR
TIMES, which is what a figure quoted beside a list does. **COUNT
`TEST_DATABASE_SUFFIXES` rather than trust the number here**, and count its NAMED members: the bare
`""` of `packages/db`'s own suite is no suffix and has never been counted. Counting it is how
CNCORE-229 first wrote "twenty-one" here, and a dispatcher's count caught it. The load-bearing half is that the
budget is SPENT, not by how many: `_test_tasks` is the first addition since CNCORE-112 to land on
eleven rather than under it, so the count moved for the first time as well as the total.)
A new one is likelier to need shortening than to fit, and the test now says so at the point of adding
it rather than on the first branch long enough to break.

**A name shared by two branches, at ANY length.** The name always carries a fingerprint of the whole
branch, not only when it is too long. The readable stem is lossy on purpose — it strips the owner
segment, lowercases, and folds punctuation — so on the stem alone `alice/fix` and `bob/fix` are one
database, and so are `feat/foo-bar` and `feat/foo_bar`. The first version fingerprinted only past the
length limit and so left the common case wide open; review caught it, and the collisions above were
reproduced before the fix.

`setUpWorktreeDatabase` never drops anything and never overwrites an existing `.env`, because being
wrong in that direction costs a developer their work and being wrong the other way costs them
running the command again. `db:setup` DOES drop, since CNCORE-231, but only databases no live
worktree owns and never its own: the sweep runs after the setup and is recorded under "A removed
worktree's databases go at the next `db:setup`" below.

**Concurrent setup is safe**, and needed a lock rather than a caught error. Two runs racing collide
twice: on `create database`, which answers 42P04 or 23505 on `pg_database_datname_index` depending
on how the two overlap, and then again inside the migrator, where both try to create the `drizzle`
schema and the loser dies on `pg_namespace_nspname_index`. A session advisory lock keyed on the
database name covers create and migrate together — the same thing Rails and Django do — and is taken
on a connection to the SERVER, because the database it protects may not exist yet.

It is deliberately NOT on the package's root export. It reaches for `node:fs`, `pg` and the
migrator, and the root export is what the web app bundles — re-exporting that from the root broke
`next build` once already.

## What sharing one container costs, and the ceiling nobody had counted

**ONE CONTAINER MEANS ONE `max_connections`, AND POSTGRES'S DEFAULT IS SIZED FOR ONE APP.** The
decision above is untouched by this; what it needed was a number nobody had put on it.

`pnpm test:e2e` stands up TEN CanonCore servers at once, each a real app process holding the pool a
real one holds, against ten databases in this container. That is ONE worktree. (ELEVEN since
CNCORE-178, which added a scopable instance; the arithmetic below is the ten it was measured on, and
the re-measurement at eleven is at the end of this section.) The whole point of
the decision above is that the next worktree's ten live here too, and the default budget of 100 is
for all of them together.

**MEASURED ON 2026-09-13, sampling `pg_stat_activity` once a second across a full run: one suite
peaks at about 100 CLIENT connections on its own.** So a single worktree was already spending the
entire budget, and a second one running its suite beside it went over. That is not a hypothetical:
it was found under CNCORE-131 as `sorry, too many clients already`, with a neighbouring worktree's
databases visible in `pg_stat_activity` at the moment of the failure.

**IT SURFACES AS SOMETHING ELSE, WHICH IS THE PART WORTH RECORDING.** The connection that loses the
race is whichever one asked last, so the failure lands in an unrelated suite as a single red test
with an internal server error behind it. It reads as a flake in that test rather than as a limit
being hit, and re-running it passes whenever the neighbour has finished.

`docker-compose.yml` sets `max_connections=300`, which is three of those suites. CI is untouched and
needs no equivalent: each job gets a `postgres:18` service container of its own and runs one
worktree against it, so the contention this fixes does not exist there.

## Raising the ceiling was the wrong lever, and bounding the demand was the right one

**`max_connections=300` above is a CEILING ON WHAT IS ALLOWED, and it was being read as a budget
that had to be spent.** CNCORE-131 raised it from Postgres's default hundred because one suite had
grown to fill that hundred; the paragraph above records the raise as three suites' worth of room.
What nobody had asked was why ONE suite wanted a hundred connections.

**IT WANTED THEM BECAUSE NOTHING TOLD IT NOT TO.** `pnpm test:e2e` stands up ten CanonCore servers,
each a real process calling `getDb()`, and `getDb()` called `createDb(env.DATABASE_URL)` with no
bound at all — so each took node-postgres's default `max` of ten. Ten servers times ten is the
hundred, and it was an accident of a library default rather than a number anybody chose. The
harness's own fixture handles had been bounded since CNCORE-99 and were never the cause: two apiece
against the servers' ten.

**FOUR IS WHAT A SERVER ACTUALLY USES, AND IT IS MEASURED (CNCORE-137).** Sampling
`pg_stat_activity` through a full unbounded run on 2026-09-13, no server ever had more than FOUR
connections executing a statement at once: a peak `state = 'active'` of 4 on the busiest databases
and 1 or 2 on the rest. The other six slots of the default ten were idle, and idle is the expensive
kind here, because the budget they sit in belongs to the container every worktree shares.

| Peak, one run | Total | Per database at that same instant |
|---|---|---|
| Unbounded (pool 10) | **97** | 23, 13, 13, 12, 12, 12, 4, 4, 2, 2 |
| Bounded (pool 4) | **55** | 10, 7, 7, 7, 6, 6, 4, 4, 2, 2 |

Each row is ONE run, and the breakdown is the same sampling tick as the total beside it, so the
figures reconcile rather than being two measurements presented as one: both rows sum exactly. Same
suite, same machine, 2026-09-13.

**THE PEAK MOVES BETWEEN RUNS AND THE HONEST FIGURE IS A RANGE.** Across repeated runs it was
**91 to 103** unbounded and **55 to 60** bounded, because how much of a pool is ever opened depends
on how much of a test file happens to overlap. The ceiling below therefore uses the WORST observed
bounded peak rather than the best.

**A PER-DATABASE TOTAL IS NOT ONE SERVER'S POOL**, which is the arithmetic trap in the table above.
Each database carries whatever server is on it PLUS the harness handle held against it, and
`_test_web` carries more than one server — which is why it reads 23 rather than 12. Nothing in
`pg_stat_activity` says which backend belongs to which process, so the rows are given as the totals
that were actually sampled and no split between the two is claimed.

**The agent ceiling moves from 2 to 4.** `288 / 103 = 2.79` before and `288 / 60 = 4.80` after, both
flooring the worst observed peak.

**RE-MEASURED AT ELEVEN SERVERS, 2026-09-19, under CNCORE-178 and with the same sampler: 67.** That
ticket added a scopable instance, because a Group is a catalogue-wide fact and there is nowhere on a
shared instance for a scope to be private. The breakdown at the peak tick: `_test_web` 11, then 7,
7, 7, `_test_group` 6, 6, 6, 4, 4, 3, 2, 2, and `postgres` 2. The ceiling still floors to four
(`288 / 67 = 4.29`), and CI — one `postgres:18` per job, one worktree against it, the default 100 —
has room. **WHAT THIS CORRECTS IS A REFUSAL, NOT THE NUMBER.** `apps/web/e2e/global-setup.ts` and
ADR-0094 both refused an eleventh server citing "about a hundred client connections" from this
record, which is the UNBOUNDED row of the table above; CNCORE-137 superseded it in the row beneath
and neither sentence was updated, so a stale figure went on refusing work for two revisions. Both
are corrected in place.

**AND 288 IS THE CONSERVATIVE READING OF A QUESTION THE OWNER'S DOCS DO NOT ANSWER.** It is
`max_connections` 300 less 3 superuser-reserved less the ~9 background backends, which is
`docs/research/parallel-agent-substrate.md` §7's arithmetic. Measured here on 2026-09-13:
`max_connections` 300, `superuser_reserved_connections` 3, `reserved_connections` 0, 8 non-client
backends live. **Whether those background backends consume a client slot at all is UNVERIFIED** —
postgresql.org/docs/18/runtime-config-connection and runtime-config-resource were read on
2026-09-13 and neither says. If they do not, 297 is usable and `297 / 60 = 4.95`, which is still
four. The generous reading only reaches five against the BEST bounded run (`297 / 55 = 5.4`), and a
ceiling that holds on a good run and not a bad one is the reasoning CNCORE-131 was caused by.

**A SMALLER POOL QUEUES HERE, IT CANNOT DEADLOCK, AND THAT IS A PROPERTY OF THIS CODE RATHER THAN A
GENERAL TRUTH.** A pool below a request's concurrent demand is only slower, PROVIDED nothing holds a
connection while waiting for a second one. The shape that breaks it is a transaction body reaching
for `db` instead of its `tx`: the transaction holds its connection for its whole body, so a nested
acquisition against an exhausted pool waits for a connection only the waiter could release. All
eight `db.transaction(...)` sites thread `tx` down and none closes over `db`, checked 2026-09-13.
**Whatever first writes one that does not has taken this bound out of the realm of throughput and
into correctness**, and it will surface as a hung request rather than an error.

**THE SUITE PEAKED AT 97 WHERE THE RESEARCH MEASURED 101, and neither is wrong.** That note counted
198 tests across 15 files; this one counted 210 across 16, and the peak depends on which files
overlap. The reproduction is of the SHAPE — ten servers, ten connections each — rather than of a
figure to the unit.

## Why the bound is the harness's and not every deployment's

`DATABASE_MAX_CONNECTIONS` is read by `getDb()` and defaults to **ten — node-postgres's own
default** — so an instance that sets nothing holds exactly the pool it held before the variable
existed. The e2e harness sets **four**, in one place: `theServerEnvironment` in
`apps/web/e2e/instance.ts`, which every server in the suite is started through.

**THE MEASUREMENT DOES NOT LICENSE LOWERING THE DEFAULT, and this is the decision rather than a
caution about it.** Those four were measured on servers each running ONE test file, SEQUENTIALLY:
one request in flight at a time, so four is the widest fan-out of a single request and not the
demand of an instance serving several readers at once. Lowering the default everywhere would size a
real deployment's pool on evidence taken from a workload no deployment runs. The suite is the
unusual deployment — ten instances against one server — so the suite is what configures itself.

**IT IS A VARIABLE RATHER THAN A CONSTANT BECAUSE THE CEILING IS NOT OURS TO KNOW.** A self-hoster
pointing CanonCore at a PostgreSQL shared with something else has a budget nothing in this repository
can read, and the symptom of exhausting it lands on whichever application asked last. `.env.example`
explains it, `README.md` lists it, and `compose.yaml` interpolates it EMPTY rather than to a number,
so the default lives in `packages/env` alone and a container cannot be given a second one to
disagree with. **That empty string is load-bearing**: it reaches the default only because
`createEnv` is given `emptyStringAsUndefined`, and bare zod would coerce `""` to 0 and refuse to
start. `server.test.ts` pins it.

**THE BOUND HAS NO UPPER LIMIT ON PURPOSE.** A ceiling in the schema would be this repository
guessing at a budget it cannot see. Too large a number fails loudly on the operator's own server;
too small a cap would refuse a deployment bigger than the one imagined here.

**IT IS NOT a Setting.** `CONTEXT.md` reserves that word for what the Owner configures and CanonCore
STORES, edited from a surface with no restart. A pool is built once at startup from the validated
environment, which is where `DATABASE_URL` lives and why this sits beside it.

## The OTHER thing a worktree was sharing without saying so

Everything above is about ONE shared resource: the connection budget, which this record leaves shared
on purpose and which CNCORE-137 then bounded the demand against. It is not the only one. **The turbo
cache was shared across every worktree too**, by turbo's own default for a git worktree, so a task's
result computed in one worktree was replayed into the others — and unlike the connections, nothing
about it was ever chosen here. [[0127-a-cache-hit-never-crosses-a-worktree]] partitions it, prices
what that costs, and records why turbo ships the sharing in the first place.

**The two are the same shape twice**, which is the reading `docs/research/parallel-agent-substrate.md`
opens with under "The three defects are one defect, and there is a fourth": a namespace that is
machine-global, reached by code that believes it is worktree-local. The database is partitioned and
the budget it spends is not; the cache looked worktree-local and lived in the main checkout. A reader
arriving here to ask what a worktree owns and what it shares should read that record beside this
one.

## Evidence

`docker image inspect postgres:18` (digest `sha256:4ef4dbc9…`), `lsof -nP -iTCP:5432`, and
`select version()` against both servers, all 2026-09-10. Compose interpolation and project-name
precedence from docs.docker.com. Supabase's default from its own config reference. The shared-project
behaviour was tested by running compose from a second worktree rather than inferred.

**The pool bound (CNCORE-137), all 2026-09-13 on this machine.** Peaks across whole `pnpm test:e2e`
runs, sampling this query in a loop for the run's duration and taking the highest tick:

```sql
select 'TOTAL', '-', count(*)::text from pg_stat_activity
  where backend_type = 'client backend' and datname like 'canoncore_<worktree>%'
union all
select 'DB', datname, count(*)::text from pg_stat_activity
  where backend_type = 'client backend' and datname like 'canoncore_<worktree>%'
  group by datname
```

Emitting the total and the per-database breakdown in ONE statement is what makes the two reconcile;
taking them from separate runs is how an earlier draft of this section came to state a total larger
than the sum of its parts. The bound was measured by setting `SERVER_CONNECTIONS` to 10 and to 4 and
running the suite under the same sampler. The per-server figure that chose the four is peak
`state = 'active'` per database across an unbounded run. node-postgres's default `max` of 10 from
node-postgres.com/apis/pool. The eight `db.transaction(...)` sites were read rather than assumed.
`288` is `docs/research/parallel-agent-substrate.md` §7, "The concurrency ceiling on this machine,
with its arithmetic", and its background-backend subtraction is flagged above as unverified rather
than adopted.

## The run database was one name for three suites, and turbo's topology was all that hid it

**`global-setup.ts` IS SHARED BY THREE SUITES AND BUILT THE SAME DATABASE FOR ALL OF THEM.**
`buildTestDatabase()` with no suffix WAS the bare `<worktree>_test`, which that function DROPS
`with (force)` and recreates — and `packages/db`, `packages/api` and `packages/tasks` each list
`@canoncore/db/testing/global-setup`. Everything above is about two WORKTREES colliding on one
database; this is three SUITES inside one worktree colliding on it, and the same record covers both
because it is the same sentence one level down.

**NOTHING BUT `turbo.json`'s `dependsOn: ["^test"]` KEPT THEM APART, and that is TOPOLOGICAL rather
than a lock.** It serialises those three today only because `@canoncore/api` depends on both
`@canoncore/db` and `@canoncore/tasks`. A package added later that took this global setup and was not
upstream of the others would drop a database another suite was reading, and — this is the part worth
recording — **the symptom would be exactly one unexplained failure in a suite that never mentions the
database**, which is the shape of the CNCORE-131 failure described above and of CNCORE-199's own.

**THE CLAIM IS NOW DECLARED, ONE PACKAGE TO ONE SUFFIX.** `SUITE_DATABASE_SUFFIXES` pairs
`@canoncore/db` with `""`, `@canoncore/api` with `api` and `@canoncore/tasks` with `tasks`, and
`suite-database.ts` resolves it from the package's own manifest. `""` is `packages/db`'s and nobody
else's now; it used to be every suite's because it was the PARAMETER'S DEFAULT, which is how three
suites came to share a name without anybody choosing it.

**A PACKAGE ABSENT FROM THE DECLARATION IS REFUSED BY NAME rather than defaulted onto `""`.** That is
the half that makes this hold for the package nobody has written yet, and it is what the old default
could not do: defaulting is silent, and what it defaulted onto was another suite's database.
`suite-database-wiring.test.ts` reads every Vitest config on disk and holds the two sets equal in
BOTH directions, so a config that takes this global setup without declaring fails there, and an entry
naming a package that no longer takes it fails there too.

**VITEST DOES NOT CARRY THE IDENTITY AND THE MANIFEST DOES.** `TestProject.name` is the obvious
reading and is empty — vitest 5.0.0 documents it as "the name of the project or an empty string if
not set", and none of these configs sets one. Measured here on 2026-09-18: `name=""`,
`root=<repo>/packages/api`. `config.root` is the package directory, so the package's own `name` is
one read away and is the identity the workspace uses everywhere else.

**THE STRIP GENERALISED AND THE BUDGET DID NOT MOVE.** `testDatabaseNameFor` recovers the worktree
database by stripping its own `_test` marker, which was TOTAL while `""` was the only run database
there was. With `_test_api` arriving as one, the bare strip would have derived
`<worktree>_test_api_test_<suffix>` — the same doubled tail CNCORE-150 took out, one generation
along. It strips a SUITE'S tail and never a FILE'S: the only names it is ever handed are the run
databases, because `testing/setup.ts` repoints DATABASE_URL at what `global-setup.ts` built, and a
fixture database is never a run database. `worktree-database.test.ts` ranges over the claims rather
than over the bare one, which is what carries the idempotence and the 63-byte budget onto all three.

**`_test_tasks` IS ELEVEN CHARACTERS, WHICH IS THE BUDGET EXACTLY**, and `_test_api` is nine. The
reservation is untouched, which is the direction the paragraphs above insist the constraint runs: the
suffix gave way, not the stem.

**A FIXTURE'S SUFFIX AND A SUITE'S ARE TWO LISTS, AND THE FIRST DRAFT MADE THEM ONE.** That draft put
`api` and `tasks` into `TEST_DATABASE_SUFFIXES`, which is the union `buildTestDatabase` accepts — so
`buildTestDatabase("api")` typechecked from any fixture, including `apps/web/e2e/instance.ts`, and
what that function does with a name is `drop database ... with (force)` against a suite's LIVE run
database. The `name === database` guard refuses a caller its OWN database and cannot see a sibling's.
Review caught it before merge; nothing in the repository had asked yet, which is the only reason it
was harmless.

**IT IS FIXED IN THE TYPE RATHER THAN IN A GUARD, because the guard cannot know the intent.**
`FIXTURE_DATABASE_SUFFIXES` is what a FILE may ask for and `SUITE_DATABASE_SUFFIXES` is what a SUITE
runs in; the two do not overlap, `buildTestDatabase` takes the first and `buildSuiteDatabase` the
second, and `buildTestDatabase("api")` is now TS2345. `TEST_DATABASE_SUFFIXES` remains as the
CONCATENATION of both, because the 63-byte budget is a property of every name the harness derives and
splitting the union without it would have silently halved what `worktree-database.test.ts` ranges
over — which is the one test standing between a long branch and a dropped catalogue.

**`""` MOVED RATHER THAN BEING DELETED, and that is the whole shape of the original defect.** It sat
in the fixture list on the grounds that `packages/db`'s suite takes the bare `<database>_test`. It
was never a fixture's to ask for; it was a SUITE's, reachable by every caller because it was also the
PARAMETER'S DEFAULT. Neither `buildTestDatabase` nor `buildSuiteDatabase` has a default now, so no
caller gets a database by not mentioning one.

**AND THE LOOKUP USES `Object.hasOwn`, which is not defensiveness about a name nobody will write.**
`SUITE_DATABASE_SUFFIXES` is an object literal and the name indexing it is read off a `package.json`
on disk, so `SUITE_DATABASE_SUFFIXES["toString"]` is an inherited FUNCTION rather than `undefined` —
walking past a refusal written as `=== undefined` and carrying a non-suffix into a name this harness
drops. Demonstrated in `suite-database.test.ts` rather than reasoned about: with the old check the
test fails `expected [Function] to throw an error`.

**WHAT THIS COSTS IS TWO MORE DATABASES AND NO MORE CONNECTIONS.** Each of the three suites already
built one from empty and migrated it; they now build three different ones rather than the same one
three times. The ceiling arithmetic above is untouched, because those suites are still serialised by
the same topology — what changed is that the serialisation is no longer load-bearing.

## One container means one /dev/shm too, and what fills it is statistics for the dead

**DOCKER GIVES A CONTAINER 64 MB OF /dev/shm, AND THE SHARED ONE RAN OUT OF IT** (CNCORE-228,
2026-09-19). Suites died in global setup with `could not resize shared memory segment
"/PostgreSQL.…" to 33554432 bytes: No space left on device`, SQLSTATE 53100, seventeen times in two
hours. Each one landed in whichever test asked next, which is CNCORE-131's shape again: a ceiling
the whole container shares, surfacing as one unrelated red test.

**AND IT CAN TAKE THE WHOLE CONTAINER DOWN, NOT ONE QUERY.** Later the same day, at 18:23:15 UTC,
the error came back and an autovacuum worker was then `terminated by signal 11: Segmentation fault`.
The postmaster reinitialized, and every connection in every worktree got `57P03 the database system
is in recovery mode`, including this ticket's own `@canoncore/api` run. Recovery after a crash
DISCARDS the statistics rather than reading them back (`xlog.c`: `if (didCrash)
pgstat_discard_stats()`), so /dev/shm read 72 KB afterwards and began filling again.

**WHAT FILLS IT IS THE CUMULATIVE STATISTICS SYSTEM**, read from PostgreSQL 18's source
(`REL_18_STABLE`) rather than inferred from the sizes:

- `pgstat_shmem.c` creates the shared statistics hash table in a DSA whose first segment, index 0,
  is 256 kB of MAIN shared memory. Every segment the area adds after that is a dynamic shared
  memory segment, and under `dynamic_shared_memory_type = posix`, the Linux default and what this
  container runs, a DSM segment is a file in /dev/shm.
- `dsa.c` sizes the segment at index n as `1 MB << (n / 2)`. Index 0 being the one in main memory,
  /dev/shm sees one 1 MB segment and then two at each size: 1, 2, 2, 4, 4, 8, 8, 16, 16 MB, which
  is exactly the nine the ticket listed beside the small DSM control segment. The 32 MB request that
  failed is index 10.
- `dsm_impl.c` backs each segment with `posix_fallocate` on Linux, so a segment costs its whole
  size in RAM from the moment it exists. `dsa_free` hands one back only when every allocation in it
  is gone.
- There is an entry for every table and index a database has touched, and dropping the DATABASE is
  what drops them (`pgstat_drop_entry_ext` calls `pgstat_drop_database_and_contents`). A clean
  shutdown writes the entries to `pg_stat/pgstat.stat` and startup reads them back. That is why the
  restart the Owner measured re-created the same 62 MB, and why restarting is not a remedy.

**MEASURED: ABOUT 57 KiB PER DATABASE OF THIS SCHEMA, AND 64 MB RAN OUT AT 1,090 OF THEM.** A
throwaway `postgres:18` at Docker's default, filled one database at a time the way the harness
builds one (create it empty, apply the schema), died at database 1,090 with the shared container's
error to the byte. Each such database carries 170 statistics entries; 25 sampled from the shared
container carried 137 to 178. Capacity divided by databases at each new segment converges: 62.5
KiB at 85, 57.2 at 236, 56.0 at 534, 55.8 at 829, 57.5 at the failure. The same probe at 256 MB
took the 32 MB segment at database 1,079 and was still filling cleanly at 1,300, 94 MB used.

Sizes here are binary throughout, as Compose's own are: its `256mb` is 268,435,456 bytes.

| Databases | What they are | Statistics |
|---|---|---|
| about 95 | four agents' worktrees and the main checkout, 19 each (its own, 15 fixture, 3 suite) | about 5 MB |
| 1,090 | what Docker's 64 MB held in the probe | 61 MB of segments |
| 1,149 | what the shared container held on 2026-09-19 | the 32 MB tenth, 93 MB |
| about 4,500 | what 256 MB holds, extrapolated at 57 KiB | 253 MB |

**THE FOUR-AGENT CEILING DID NOT FILL IT, AND THAT IS THE FINDING.** The databases of four agents
and the main checkout need a twelfth of Docker's default. Counted in one query, the 1,149 were 963
test databases, 148 worktree databases (so about 147 worktrees, five of which still existed) and
38 others: the templates, `postgres`, and databases agents had built by hand. Nothing dropped a
removed worktree's databases; since CNCORE-231 `db:setup` does, and the subsection at the end of
this one records how. The jump from 62 to 94 MB seen while
four agents ran was one step of the series above rather than a rate: the 32 MB segment's file dates
from 35 seconds after the container started.

**`docker-compose.yml` SETS `shm_size: 256mb`, THE FIRST SIZE THAT HOLDS THE 253 MB STEP.** The
steps the statistics can occupy are 61, 93, 125, 189, 253 and 509 MB, and each candidate is priced
by them:

- 128 MB holds the 125 step, about 2,200 databases. The cluster went from its first database,
  2026-09-10 13:58, to 1,149 in nine days, about 120 a day, so that is nine days' room over what it
  held.
- 256 MB holds the 253 step, about 4,500: roughly four weeks at the same rate, which was the time
  CNCORE-231 had before this filled again. That rate was the dead accumulating, and CNCORE-231
  bounded it, so the four weeks no longer run down (see below). It is also the example the
  `postgres` image's own documentation gives for exactly this error.
- 512 MB holds the 509 step, and /dev/shm is RAM. The colima VM this container runs in has 1,958
  MB and no swap, and had between 574 and 647 MB available when measured. So 512 MB is most of
  it, and the 1 GB the container was given by hand on 2026-09-19 is more than all of it. Past what
  the VM has, the kernel's OOM killer picks a process anywhere in the VM, not necessarily this
  container, which is a worse failure than PostgreSQL's inside its own.

**`min_dynamic_shared_memory` WAS THE OTHER LEVER, AND IT MOVES THE CEILING WITHOUT REMOVING IT.**
`dsm.c`'s `dsm_create` carves any DSM request out of that preallocated main-memory region before it
touches /dev/shm, and `pgstat_shmem.c` names it as the way to avoid DSM segments. But the
documentation describes it as memory for parallel queries, and past its size every segment goes
back to /dev/shm at Docker's 64 MB. It would need `shm_size` beside it to hold more than it does
itself. `shm_size` alone is one setting, and the one the image documents.

**THE CEILING IS NOT THE LEVER, which "Raising the ceiling was the wrong lever, and bounding the
demand was the right one" above already found once.** Raised without the demand being bounded, it
buys weeks. `src/docker-compose.test.ts` fails if the declaration goes, since absent is Docker's 64
MB and the failure would read as somebody's flaky test again. CI is untouched: each job's own
`postgres:18` holds one worktree's databases.

**A COMPOSE FILE THAT DIFFERS RECREATED THE SHARED CONTAINER, which is how the 64 MB came back.**
`docker compose up` recreates a service's container when its configuration has changed since the
container was created, and `--no-recreate` is what stops it (Compose's `up` reference). At
18:18:06 UTC a worktree on an older `main` ran `pnpm db:start`. Its file set no `shm_size`, the
running container had the Owner's 1 GB, and Compose recreated it at 64 MB underneath every other
worktree. Once CNCORE-228 landed it would have gone on: a worktree based before it that ran
`db:start` would have put the container back to 64 MB, and one based after it back to 256 MB, each
time interrupting every run in every other worktree. CNCORE-233 took that out, and the subsection
below records how.

**Evidence**, all 2026-09-19: `ls -la /dev/shm` and `df -h /dev/shm` inside the shared container
and the probes. `pg_stat_have_stats('relation', dboid, relid)` counted over `pg_class` in 25 random
databases. `pg_stat_file('base/<oid>/PG_VERSION')` for when each database was created. The schema
came from `pg_dump -s` of a live test database. `colima ssh -- free -m` for the VM. `docker logs`
and `docker inspect` of `canoncore-postgres` for the crash and the recreate, whose compose labels
name the worktree that ran it. The source is `src/backend/utils/mmgr/dsa.c`,
`src/include/utils/dsa.h`, `src/backend/utils/activity/pgstat_shmem.c`, `pgstat.c`,
`src/backend/storage/ipc/dsm.c`, `dsm_impl.c` and `src/backend/access/transam/xlog.c` at
`REL_18_STABLE`. The image's advice is the "Caveats" section of docker-library's `postgres` docs.

### A worktree starts the container and never recreates it

**`db:start` IS `docker compose up -d --no-recreate`** (CNCORE-233). `name: canoncore` makes every
worktree's `up` act on the ONE container, so a plain `up` let each worktree decide what that
container is, and the last one to run it won. `max_connections=300` and `shm_size` each set off that
race when they landed, and so would any later change to the service.

**WHEN DOES A WORKTREE NEED `db:start` TO CHANGE THE RUNNING CONTAINER? NEVER.** `up` does one of
three things to this container, measured below:

- **None exists:** it creates one. That is legitimate: the first run on a machine, or the first
  after `db:down`.
- **One is stopped:** it starts it, with the same id. That is legitimate too: after `db:stop`.
- **One differs from this checkout's declaration:** a plain `up` stops it and recreates it, and
  every connection in every worktree dies with it. That is never one worktree's decision, because
  the container belongs to all of them.

**A CONTAINER DIFFERS FROM A CHECKOUT FOR THREE REASONS, AND ONLY ONE OF THEM IS THE FILE.**

- **The file**, as above.
- **The environment the file reads.** The port is `${CANONCORE_DB_PORT:-55432}`, taken from the
  shell of whoever runs `up`. Under a plain `up`, one worktree's shell setting it moved the port
  from under every worktree whose `apps/web/.env` named the old one. Under `--no-recreate` the
  variable counts only when the container is created, whether the container is running or stopped
  afterwards (measured below). So it is chosen once for the machine, not per shell. Moving it
  later is a change like any other and takes the route below with the variable set. Every
  worktree's `apps/web/.env` still names the old port afterwards, because `db:setup` never
  overwrites one. If something else holds the port when the container is first created, `pnpm
  db:down` and then `pnpm db:start` with the variable set creates the container on the new port.
- **The image.** A plain `up` also recreates when the `postgres:18` tag has moved since the
  container was created, even if the declaration has not changed. The Owner's install runs
  `postgres:18` as well, and ADR-0132's route for taking a project onto it is `docker compose pull
  && docker compose up -d`. So each time the install was updated, the next worktree to run
  `db:start` could recreate this container.

`--no-recreate` covers all three.

**A CHANGED DECLARATION REACHES THE CONTAINER BY ONE ROUTE, AND IT IS THE OWNER'S.**

1. A branch that changes `docker-compose.yml` tests the change on a throwaway container of its own,
   never on the shared one. CNCORE-228 measured its `shm_size` with a probe exactly that way.
2. The change lands on `main`.
3. From the main checkout, while no suite is running, the Owner runs `docker compose up -d
   --dry-run` in `packages/db`. `Recreate` means the running container differs, and the dry run
   does not act on it. Then a plain `docker compose up -d` applies it. Both commands take
   `COMPOSE_IGNORE_ORPHANS=true`, for the reason given below.

A recreate keeps the named volume, and with it every worktree's database. The one on 2026-09-19
kept 1,162 of them. What it cuts is the connections.

The route is written down in `docker-compose.yml`, above `name: canoncore`, because that is what the
next person to change the file reads. It is not a script. A script would be one more command every
worktree could run, and running it from a branch based before the change is the defect this section
removes.

**`--no-recreate` IS SILENT ABOUT DRIFT, AND THAT IS ACCEPTED.** It answers `Container
canoncore-postgres Running` whether or not the container differs, so a branch that edits the
declaration and runs `db:start` gets no sign that its change did not apply. That is what step 1
above is for. **Refusing on drift was the alternative, and it was rejected.** Every worktree's setup
would fail between a declaration merging and the Owner applying it. The check would also have to
reproduce Compose's own recreate decision, which covers the config hash, the image digest, the
networks and the volumes, and the copy would drift from Compose's.

**`db:watch` IS DELETED rather than guarded.** It was a second `up`, attached, which recreated the
container just as `db:start` did. Compose's reference says that interrupting an attached `up` stops
its containers, so its Ctrl-C also stopped the container for everyone. `docker logs -f
canoncore-postgres` shows the same log and touches nothing.

**`--remove-orphans` IS NEVER PASSED FROM `packages/db`, BECAUSE HERE THE ORPHANS ARE THE OWNER'S
INSTALL.** The install runs as Compose project `canoncore` as well, so from this directory Compose
calls its app and database orphans, and it suggests the flag on every `up`. `compose.yaml`'s header
records the collision from both sides. From the install's side the flag would take this container.
From this side it takes the Owner's running install: Compose stops each orphan and then removes it.
**It does not delete the catalogue**, which was feared when this was found and does not survive
reading the source. Compose 5.5.1 removes an orphan with `ContainerRemove` and `Force` alone, never
`RemoveVolumes` (`pkg/compose/reconcile.go`, `reconcileOrphans`; `executor_ops.go`,
`execRemoveContainer`). The install keeps its database on the named volume `canoncore_data`, and its
app container mounts nothing. So `docker compose up -d` in the install's directory would bring it
back with its 8,052 Items. What the flag costs is the Owner's instance going down unannounced.
`db:start` sets `COMPOSE_IGNORE_ORPHANS=true`, which Compose documents as not detecting orphans at
all, so the suggestion is never printed. `src/docker-compose.test.ts` refuses a script that runs an
`up` without `--no-recreate`, or with `--force-recreate`. It also refuses one that passes
`--remove-orphans` or sets `COMPOSE_REMOVE_ORPHANS`, which Compose reads in place of the flag.
**What the test cannot see is a shell that exports that variable itself.**

**Evidence**, 2026-09-19, Docker Compose 5.5.1 on Engine 29.5.2. The three cases above, the image
case, the port case and the orphans warning were run against throwaway projects (`cncore233-probe`
and `cncore233-probe2`, each with its own name and container, `alpine:3`) rather than the shared
one. `--remove-orphans` was never run, even there; what it does is read from Compose's source at
the `v5.5.1` tag:

| Starting state | `up -d --no-recreate` | plain `up -d` |
|---|---|---|
| no container | `Created`, `Started` | (not run) |
| `shm_size` changed from 64 to 128 MB | `Running`: same id, still 64 MB | `Recreate`: new id, 128 MB |
| stopped | `Started`: same id | (not run) |
| image tag moved under an unchanged file | `Running`: same id, same image | `Recreate`: new id, new image |
| stopped, then the published port's variable changed | `Started`: same id, old port | (not run) |
| running, then the published port's variable changed | `Running`: same id, old port | (not run) |

`up -d --dry-run` against a container whose declaration had changed printed `Recreate` and
`Recreated`, and afterwards the container still had the same id and the same `shm_size`. With a
second service's container in the same project, `up -d --no-recreate` printed the `Found orphan
containers ... --remove-orphans` warning. With `COMPOSE_IGNORE_ORPHANS=true` it printed nothing, and
the other container was still running. `docker inspect` of the Owner's `canoncore-database-1` reads
`postgres:18`, the same image ID as `canoncore-postgres`, with `canoncore_data` mounted at
`/var/lib/postgresql` and `PGDATA` beneath it; `canoncore-canoncore-1` has no mounts. The flag
descriptions and both `COMPOSE_*_ORPHANS` variables are from Compose's `up` and `create` references
and its environment-variable page on docs.docker.com, read through context7 the same day.

### A removed worktree's databases go at the next `db:setup`

**`orca worktree rm` TAKES THE FILES AND NOTHING ELSE, SO THE CLUSTER ONLY GREW** (CNCORE-231). Each
worktree builds its own database and, through its suites, 20 more; nothing dropped any of them
when the worktree went. Counted on the shared container on 2026-09-19: 1,135 databases at
17:5x UTC and 1,196 at 19:0x, about 60 an hour with four agents running, and **1,250 at 19:26,
11 GB by `pg_database_size` and 12 GB on disk**. Of those, 1,151 were in the families of worktrees
that no longer existed. At 57 KiB each of /dev/shm that is the demand the section above measured,
and it was the whole of it.

**`pnpm db:setup` SWEEPS THEM, AFTER IT HAS SET UP ITS OWN WORKTREE.** Every worktree runs it to
join the container, so it runs at the rate worktrees are made, which is the rate they are removed,
and nobody has to remember it. At any moment the dead are the families of worktrees removed since
the last `db:setup` anywhere, plus any that were younger than an hour when it ran. A removed
worktree's test databases usually were, because its last suite run rebuilt them just before the
merge. That is why the dispatcher now also drops a removed worktree's databases at the removal
([[0191-removing-a-worktree-drops-its-databases-and-no-drop-may-name-canoncore]]), and this sweep
is the backstop. `src/sweep.ts` is the mechanism; `scripts/setup.ts` prints
`swept N databases no live worktree owns`. The other places it could have gone:

- **Orca's `orca.yaml` archive hook**, which is a worktree's own teardown, is skipped by `orca
  worktree rm` unless `--run-hooks` is passed, and misses a worktree removed any other way.
  Remembering a flag is remembering.
- **A schedule** would be a background service on the Owner's machine, which is machine state
  rather than repo state and is asked about first.
- **The suites' global setup** would put a destructive step in front of every test run, in CI too,
  for a cluster that changes when worktrees do rather than when tests do.

**WHAT A SWEEP MAY DROP IS A NAME `worktreeDatabaseName` COULD HAVE PRODUCED, with any tail after
`_test`.** Any tail, rather than the suffixes declared today, because a removed branch keeps the
tails of its own day: 35 `_test_test_gone` from before CNCORE-150 and 4 `_test_purgeable` from
before CNCORE-93 were in the 1,151. Nothing else is a candidate: `postgres`, the templates, the
container's own `canoncore`, the `canoncore_test…` family a CI-style DATABASE_URL derives, and
anything somebody built by hand. `isNamedAfterABranch` in `worktree-database.ts` is the test, beside
the naming it inverts, and `MARKER` moved there from `testing/build-database.ts` so the sweep can
read it under bare node.

**A WORKTREE OWNS TWO ROOTS, AND EITHER ALONE WOULD DROP A LIVE ONE.** The database its branch
derives is what `db:setup` makes, and is all there is before `.env` is written. The database its
`apps/web/.env` names is what it actually uses and what its suites derive theirs from, and after a
`git branch -m` it is no longer the branch's, because `db:setup` never overwrites `.env`. A name is
owned when it IS a root or starts with a root and `_test`. The worktrees are `git worktree list`
from the checkout running the sweep, so the main checkout is one of them and a BRANCH that
outlived its worktree is not.

**NEVER `with (force)`, AND ASKED FIRST.** A connection to a database no worktree owns is a leaked
server or a person, and the sweep names it (`left <database>: ... something is connected to it`)
rather than cutting it off. It asks `pg_stat_activity` before each DROP, because a plain DROP
against a database with a connection does not fail at once: PostgreSQL waited five seconds before
answering 55006 when this was measured. One leaked e2e server holds eleven databases, which would
have added close to a minute to somebody's setup. 55006 is caught too, for a connection that
arrives between the question and the DROP.

**EACH DROP IS UNDER `db:setup`'s OWN LOCK, AND THE OWNERS ARE READ AGAIN INSIDE IT.** A
re-dispatched ticket reuses its branch, so a new worktree's setup can find the old database still
there and adopt it, between a sweep reading the worktrees and reaching that name. Setup holds its
advisory lock across everything it does to a database, so whichever order the two meet in, the
sweep's second question is answered after the adoption or before the creation. `sweep.test.ts`
holds the lock, waits until `pg_locks` shows a backend queued behind a held advisory lock, claims
the database and releases: without the lock the sweep had already dropped it. The wait does not
match the lock's key, so on a busy container another worktree's setup queued at that moment can
end it early. That makes the test weaker for that one run, never falsely red.

**THE LISTING IS READ BEFORE THE WORKTREES**, so a database it lists was made by a worktree that
`git worktree list` already shows, if that worktree is live.

**AND NOTHING YOUNGER THAN AN HOUR IS A CANDIDATE, WHOEVER OWNS IT.** A database's age is its
`PG_VERSION` file's, which `CREATE DATABASE` writes; one whose age cannot be read is never swept.
`git gc` prunes only objects older than `gc.pruneExpire` for the same reason: a sweep must not race
what is still being made. Review found the case in this repository.
`setup-worktree.test.ts` builds `canoncore_db_setup_under_test_…`, a name the family covers and
no worktree owns, and reads it back across tests. A `db:setup` in another worktree landing between
those tests would have turned that suite red with nothing in it to explain why, which is the one
failure CNCORE-231 was warned about. `GRACE_SECONDS` in `sweep.ts` is the hour, and `sweep.test.ts`
holds it.

**WHAT IT COSTS, SAID OUT LOUD.**

- **The owners are ONE repository's worktrees.** A second clone on the same machine shares the
  container but not the worktree list, so each clone's `db:setup` drops the other's databases once
  they are an hour old and idle. Running `db:setup` there again makes a fresh database with one
  seeded Item, not the old one back: anything `db:restore` put in it is gone. A clone on the same
  branch as a worktree here, `main` most often, derives that worktree's name and so is owned by
  it.
- **A worktree mid-rebase shows `detached` in `git worktree list`**, so for its duration only the
  database its `.env` names is owned. That is the one `db:setup` wrote there unless somebody
  changed it.
- **The first sweep after a backlog is slow**: 35.7 s for the 1,151 below, a lock and a `git
  worktree list` for each name. Every sweep after it finds a wave's worth.

**MEASURED, 2026-09-19**, `pnpm db:setup` in this ticket's worktree with four worktrees live
(the main checkout, CNCORE-184, CNCORE-229 and this one):

| | Before, 19:26:03 UTC | After, 19:26:49 UTC |
|---|---|---|
| Databases | 1,250 | 99 |
| `sum(pg_database_size)` | 11 GB | 947 MB |
| `du -sh /var/lib/postgresql` | 12 GB | 1.2 GB |
| /dev/shm in use | 30 MB | 30 MB |
| `db:setup` wall time | 35.7 s, 1,151 dropped | 0.53 s on the next run, 0 dropped |

The four live families came through whole, CNCORE-229's hand-named `_test_leak` among them, and
nothing was in use. **/dev/shm did not move, and it was not expected to**: a segment goes back
only when every entry in it is gone (above), so the sweep frees room inside the segments for the
next entries rather than shrinking them. What it stops is the growth.

**THE 48 OUTSIDE THE FAMILY WERE DROPPED ONCE, BY HAND, and the sweep will never drop their like.**
35 were built by agents with a DATABASE_URL of their own: `cc124_…`, `cc129_…`, `cnc145…`,
`cncore176_probe`, `cncore192_…`, `cncore202_…`, `cncore63_probe`, `cncore8_empty` and
`cncore8_upgrade`. The other 13 were `canoncore_test…`, derived from a DATABASE_URL naming the
container's own `canoncore`. The ticket's question was whether any of them was load-bearing, and
none was. Before this change `git grep` found none of the 35 names anywhere in the repository
(two now appear in `sweep.test.ts`, as examples of what a sweep never takes), and the 13 are what
the harness derives from a `canoncore` nobody's `.env` names. Every ticket they are named for was
Done; each was 7.6 to 11 MB, the size of an empty migrated schema; and none had a
connection. A suite that wanted one builds it from empty on every run. The cluster afterwards was
51 databases, 509 MB, 762 MB on disk: the four live families, `canoncore`, `postgres` and the two
templates. A future hand-built database is its author's to drop.

**THE THREE LIMITS THIS CONTAINER HAS, IN ONE PLACE:**

| Limit | Set in `docker-compose.yml` | What it holds | What bounds the demand |
|---|---|---|---|
| `max_connections` | 300, 288 usable | four agents' `pnpm test:e2e` at 55 to 67 each | `DATABASE_MAX_CONNECTIONS=4` in the e2e harness (CNCORE-137) |
| `shm_size` | 256mb | about 4,500 databases at 57 KiB | this sweep (CNCORE-231) |
| Databases on disk | nothing | the volume | `db:drop-worktree` at each removal (ADR-0191), then this sweep: 21 per live worktree |

**Evidence**, all 2026-09-19. The counts and sizes are `select count(*),
pg_size_pretty(sum(pg_database_size(datname))) from pg_database`, `df -h /dev/shm` and `du -sh
/var/lib/postgresql` inside `canoncore-postgres`, read immediately before and after. The dry run
put the real listing and the real owners through `deadDatabases` without dropping, and named the
same 1,151. The hourly counts are the dispatcher's, on CNCORE-231. The five-second wait is a plain
`drop database` against a probe with one `pg_sleep` session open: `real 5.28`, then `55006 ...
is being accessed by other users` from `dropdb, dbcommands.c:1791`. That Orca skips archive hooks
without `--run-hooks` is `orca worktree rm --help`.
