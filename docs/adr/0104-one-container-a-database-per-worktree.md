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

Measured rather than reasoned: running compose from a second worktree answered
`Container canoncore-postgres Running` and left the container id untouched, with one volume between
them.

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

**The recovery is idempotent, and the existing refusal is what makes that safe.** `buildTestDatabase()`
with no suffix, called from a worker, now resolves to the database that worker is already running
against rather than quietly building a `_test_test` below it — and since the next thing it does is
`drop database ... with (force)`, the `name === database` guard is what turns that into a refusal.
Both halves are pinned by `worktree-database.test.ts`.

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

**The budget is full, which is what to know before adding another.** EIGHT of the SEVENTEEN declared
suffixes — `_test_fresh`, `_test_paged`, `_test_purge`, `_test_still`, `_test_place`, `_test_order`,
`_test_allow` and `_test_tasks` — spend all eleven characters, so the longest tail the harness can
derive IS the reservation, exactly. (This read "four of the six" until 2026-09-13, "seven of the
thirteen" until 2026-09-16 and "seven of the fifteen" until 2026-09-18; the set has now grown out
from under this sentence THREE TIMES, which is what a figure quoted beside a list does. **COUNT
`TEST_DATABASE_SUFFIXES` rather than trust the number here.** The load-bearing half is that the
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
running the command again.

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
`buildTestDatabase()` with no suffix is the bare `<worktree>_test`, which that function DROPS
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
38 others: the templates, `postgres`, and databases agents had built by hand. Nothing drops a
removed worktree's databases, and CNCORE-231 is that half. The jump from 62 to 94 MB seen while
four agents ran was one step of the series above rather than a rate: the 32 MB segment's file dates
from 35 seconds after the container started.

**`docker-compose.yml` SETS `shm_size: 256mb`, THE FIRST SIZE THAT HOLDS THE 253 MB STEP.** The
steps the statistics can occupy are 61, 93, 125, 189, 253 and 509 MB, and each candidate is priced
by them:

- 128 MB holds the 125 step, about 2,200 databases. The cluster went from its first database,
  2026-09-10 13:58, to 1,149 in nine days, about 120 a day, so that is nine days' room over what it
  held.
- 256 MB holds the 253 step, about 4,500: roughly four weeks at the same rate, which is the time
  CNCORE-231 has before this fills again. It is also the example the `postgres` image's own
  documentation gives for exactly this error.
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

**A COMPOSE FILE THAT DIFFERS RECREATES THE SHARED CONTAINER, which is how the 64 MB came back.**
`docker compose up` recreates a service's container when its configuration has changed since the
container was created, and `--no-recreate` is what stops it (Compose's `up` reference). At
18:18:06 UTC a worktree on an older `main` ran `pnpm db:start`. Its file set no `shm_size`, the
running container had the Owner's 1 GB, and Compose recreated it at 64 MB underneath every other
worktree. The same holds after this lands: a worktree based before it that runs `db:start` puts the
container back to 64 MB, and one based after puts it back to 256 MB, each time interrupting every
run in every other worktree. CNCORE-233 is that.

**Evidence**, all 2026-09-19: `ls -la /dev/shm` and `df -h /dev/shm` inside the shared container
and the probes. `pg_stat_have_stats('relation', dboid, relid)` counted over `pg_class` in 25 random
databases. `pg_stat_file('base/<oid>/PG_VERSION')` for when each database was created. The schema
came from `pg_dump -s` of a live test database. `colima ssh -- free -m` for the VM. `docker logs`
and `docker inspect` of `canoncore-postgres` for the crash and the recreate, whose compose labels
name the worktree that ran it. The source is `src/backend/utils/mmgr/dsa.c`,
`src/include/utils/dsa.h`, `src/backend/utils/activity/pgstat_shmem.c`, `pgstat.c`,
`src/backend/storage/ipc/dsm.c`, `dsm_impl.c` and `src/backend/access/transam/xlog.c` at
`REL_18_STABLE`. The image's advice is the "Caveats" section of docker-library's `postgres` docs.
