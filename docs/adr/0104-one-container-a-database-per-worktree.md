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

**The FORMAT could not drift and the SET did**, which is the distinction this paragraph took two
tickets to state. `testDatabaseNameFor` is the one place that knows how a test database is named and
the reservation test builds its derived names by calling it, so `<name>_test_<suffix>` was never in
question. WHICH SUFFIXES EXIST was: `buildTestDatabase` took a `string`, so the set lived as literals
at the call sites with a hand-written copy in the reservation test, which read `["", "web", "fresh"]`
while the web suite had grown to five. Two were missing and one of those, `_test_purgeable`, was four
characters past the reservation — so any worktree whose branch stem ran to the limit met the hard
stop above and could not run `pnpm test:e2e` at all. True of `cncore_47_properties_validation` on the
day it was found, 2026-09-12, and found by adding a sixth rather than by anything failing.

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

**The budget is nearly full, which is what to know before adding a sixth.** Four of the six declared
suffixes — `_test_fresh`, `_test_paged`, `_test_purge`, `_test_still` — spend all eleven characters.
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

## Evidence

`docker image inspect postgres:18` (digest `sha256:4ef4dbc9…`), `lsof -nP -iTCP:5432`, and
`select version()` against both servers, all 2026-09-10. Compose interpolation and project-name
precedence from docs.docker.com. Supabase's default from its own config reference. The shared-project
behaviour was tested by running compose from a second worktree rather than inferred.
