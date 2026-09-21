---
status: accepted
---

# Removing a worktree drops its databases, and refuses a list naming canoncore

`.claude/skills/dispatch/retire.sh` runs `pnpm db:drop-worktree <branch>` straight after
`orca worktree rm`, naming the branch the removed worktree had checked out and taking it off that
worktree before the removal deletes it. **Since CNCORE-334 the dispatcher does not run either by
hand** (ADR-0198): the two were a rule in three documents with no mechanism, and the ORDER below is
the reason they had to become one command. It drops that branch's database and every `_test…`
database derived from it, however young, and refuses while any live worktree still owns them.
`dropDatabases`, the one function through which both this command and `db:setup`'s sweep drop
anything, refuses a list that names `canoncore` WHOLE, before it opens a connection. The
dispatcher asked for that when this was dispatched: refuse, not merely avoid.

## Why the sweep was not enough

[[0104-one-container-a-database-per-worktree]] records the sweep CNCORE-231 put in `db:setup`,
under "A removed worktree's databases go at the next `db:setup`". It still runs. It left two gaps,
and the dispatcher who filed CNCORE-312 measured what they cost: at 03:00 on 2026-09-21, six
removed worktrees had left 71 databases and 689 MB in the shared container.

- **It runs when a worktree is set up, not when one is removed.** The dead wait for the next
  `db:setup` anywhere, and a wave ends with removals and no setups.
- **It spares anything younger than an hour, and a removed worktree's test databases usually are.**
  The harness drops and recreates each test database on every run, so a database's age is the age
  of the last suite run that built it. An agent runs its whole suite just before its PR goes ready,
  and the merge often follows within the hour. On this ticket's day the two live agents' test
  databases were 0 to 16 minutes old. The hour protects things no worktree owns yet
  (`sweep.ts`, `GRACE_SECONDS`), so taking it off the sweep would reopen what it closed.

A named command has neither gap. The dispatcher names the one family it has just made dead, so
nothing needs a grace period to be told apart from something still being made.

## Why a command the dispatcher runs, and not Orca's archive hook

ADR-0104 turned the hook down because `orca worktree rm` skips `orca.yaml` archive hooks unless
`--run-hooks` is passed, and "remembering a flag is remembering". The command has to be remembered
too. It is written into the dispatch skill's step 2, where the worktree is removed, because that is
where a dispatcher reads it. The sweep stays as the backstop for anything the dispatcher misses.
Over a hook, the command has three advantages:

- **It works however the worktree went.** It needs only the branch name, so a worktree removed by
  hand, or by an `orca worktree rm` without the flag, is dropped the same way.
- **It runs after the removal**, so "is anything still using these?" has a plain answer: the owner
  check the sweep already uses (`ownedDatabases`). A hook runs while its worktree still exists, and
  the worktree would still own the databases it was dropping.
- **It refuses the mistake that matters.** Run before `orca worktree rm` instead of after, it
  answers `refusing: a live worktree still owns <branch>'s database, <root>, so it and the test
  databases derived from it may be in use. Remove that worktree first.` and drops nothing, where a
  hook has nothing to refuse. How that answer is reported is under "Running it too early is a
  sentence, not a crash", below.

## Why the branch, and not the ticket number

The dispatcher had been dropping by hand with a pattern on `canoncore_cncore_<n>_`, after three
checks. A ticket number is not a family. A re-dispatched ticket has two branches, and one of them
can be live. `worktreeDatabaseName` ends every name in eight hex characters fingerprinting the whole
branch, so a family is the branch's database plus every name starting with it and `_test`, and
nothing else matches. It is held to the sweep's own test as well, `isNamedAfterABranch`, so a
database somebody built by hand under the family's root, `<root>_testing` say, is not a member.

The owner question is asked twice. The first time is before listing, to give the refusal above.
The second is for each name, under `db:setup`'s advisory lock, which is how the sweep asks it. A
ticket re-dispatched straight after its removal gets its branch back, and its `db:setup` adopts
the database still standing. If that happens while this command waits on the lock, the second
question sees it and the database stays.

## Running it too early is a sentence, not a crash

**The refusal while a live worktree owns the family is `DropRefused`, and `db:drop-worktree`
prints its message and exits 1, with no stack trace.** Until CNCORE-317 it was an uncaught `Error`
whose sentence stopped at "so these are its", followed by a stack trace and the Node version. That
is what a crash looks like, and the dispatcher who ran the command in the wrong order had to open
the source to tell a refusal from a bug.

**It matches how `db:setup` reports the refusals it makes itself.** A detached HEAD, or a
`CANONCORE_DB_PORT` that is not a port, is one sentence on stderr and exit 1
(`packages/db/scripts/worktree.ts`), as is every usage line in `packages/db/scripts`. The class
follows `packages/db`'s own refusals: `ItemRefused`, `GroupRefused`, `PlacementRefused` and
`ImportRunRefused`. A caller catches each one by class and reports it, and anything else goes on
being a fault. `packages/api/scripts/import-list.ts` does the same in a script: it prints a
`BAD_REQUEST` and exits 1, and rethrows everything else.

**It says "owns", not "checked out".** After `git branch -m`, the owner is a worktree on the new
branch whose `apps/web/.env` still names the old branch's database, so "still checked out" would be
false there.

**Three things keep their stack trace.** The refusal of a list naming `canoncore` stays a plain
`Error` on purpose. No branch derives that name, so only a caller's broken filter can reach it, and
a bug is what a stack trace is for. A failure is not a refusal: `db:setup`'s "nothing is listening"
is thrown with the refused connection as its cause, so it prints its advice above a trace. And a
branch no database could be named after, `feature/` say, is refused by `worktreeDatabaseName` with
a plain `Error`, as it is under `db:setup` and `db:restore`, which share that function. Its sentence
is whole and names the input, so it cannot be mistaken for the unfinished one. This record leaves
the last two as they are.

## The refusal sits at the point of destruction, and it refuses the whole list

**`canoncore` is what the Owner's install calls its catalogue.** Both compose files set
`POSTGRES_DB: canoncore`, so the name exists in both containers.

- **The install's catalogue is in its own container.** `compose.yaml` runs a `database` service
  (`canoncore-database-1`) on the volume `canoncore_data`, and the app reads
  `postgresql://canoncore:…@database:5432/canoncore`. It publishes no port to the host. On
  2026-09-21 it held 8,053 Items.
- **The one in the shared container is that container's own default database.**
  `packages/db/docker-compose.yml` runs `canoncore-postgres` on 55432, the container every
  worktree shares. Its `canoncore` held no migrations and 7.7 MB on 2026-09-21.

CNCORE-312 says the install is "in the same container", and the measurement above does not bear
that out. The rule does not depend on it. A drop is keyed on a name, and which server answers is
decided by `CANONCORE_DB_PORT`, a shell variable. So the guard goes on the name, where a command can
check it.

**IT GUARDS THE TWO DROPS THAT CHOOSE THEIR NAMES FROM A LISTING, AND NOT THE OTHERS.**
`dropDatabases` is what the sweep and this command drop through, and both pick their names out of
`pg_database`. Two other paths in `packages/db` drop by their own route and are not covered:
`restore.ts` drops the worktree's own database, which it derives from the branch, and
`testing/build-database.ts` drops a test database it derives from the run database, refusing the run
database itself. Neither derives `canoncore`, since a worktree's name always carries the prefix and
the fingerprint. They were left alone because the refusal belongs where a name arrives from outside
the code, and neither of them takes one that way.

**Every caller's filter already excludes the name**, so today the refusal can never fire.
`isNamedAfterABranch` requires the fingerprint, and a branch's family requires its root as a
prefix. The refusal is there for when a later caller's filter is wrong. It refuses the whole list
rather than filtering the name out, because a list naming `canoncore` means something upstream has
gone wrong, and the rest of that list is not to be trusted either. It comes before the connection,
so nothing is half done.

**The test never hands the name to a server that could act on it.** `sweep.test.ts` calls
`dropDatabases` against `127.0.0.1:1`, where nothing listens. A refusal that came only after
connecting fails there as `ECONNREFUSED`. That is how the test went red before the guard existed,
and it is what a regression would look like.

## What it does not do

- **A renamed branch.** After `git branch -m`, a worktree's `apps/web/.env` still names the old
  branch's database, and the command, given the new name, does not reach it. The sweep takes it
  once it is an hour old. Given the old name while that worktree lives, the command refuses,
  because the worktree still owns that database.
- **A second clone on the same machine.** The owners are one repository's worktrees, as they are
  for the sweep (ADR-0104, "What it costs, said out loud"). A worktree in another clone on the same
  branch is not an owner here.
- **A detached main checkout.** `scripts/worktree.ts` reads the current branch when it is loaded,
  for `db:setup`, and exits on a detached HEAD. The command shares that file for its server and
  repository, so it cannot run from a main checkout in the middle of a rebase.

## Evidence

All 2026-09-21, on `canoncore-postgres` with four CanonCore worktrees live (the main checkout,
CNCORE-292, CNCORE-311 and this one):

- `pnpm db:drop-worktree jacobdrees/cncore-312`, run from this ticket's own worktree, answered
  `refusing: jacobdrees/cncore-312 is still checked out in a worktree, so these are its`: a
  sentence that stopped before its object, thrown uncaught with a stack trace. CNCORE-317 finished
  it; its evidence is the last entry here.
- A walk on a staged orphan. Five databases were created for `jacobdrees/cncore-312-walk`, a branch
  with no worktree (`canoncore_cncore_312_walk_fd663445` with `_test`, `_test_api`, `_test_web`
  and `_test_gone`), each seconds old and so inside the sweep's hour. `pnpm db:drop-worktree
  jacobdrees/cncore-312-walk` printed `dropped 5` and named each one. `select count(*) from
  pg_database` read 34 before and 29 after, with `canoncore` present both times and the four live
  families unchanged.
- Where the catalogue is: `docker inspect` of `canoncore-canoncore-1` for its `DATABASE_URL`, and
  of both database containers for their volumes. `select count(*) from items` in
  `canoncore-database-1`, and `select count(*) from drizzle.__drizzle_migrations` with
  `pg_database_size('canoncore')` in `canoncore-postgres`.
- The ages: `pg_stat_file('base/<oid>/PG_VERSION')` over the live families.
- The 71 databases and 689 MB are the dispatcher's figures, from CNCORE-312. They were not measured
  again here: by the time this ticket began, the dispatcher had dropped them by hand.
- CNCORE-317, same day. `pnpm db:drop-worktree jacobdrees/cncore-317`, run from that ticket's own
  live worktree, printed the refusal quoted above, naming `canoncore_cncore_317_d71a7768`, then
  pnpm's `Command failed with exit code 1`, with no stack trace. Both of that worktree's databases
  still stood afterwards. The same command with `CANONCORE_DB_PORT=1`, on a branch no worktree
  owns, still printed `AggregateError [ECONNREFUSED]` with its trace, and `pnpm db:drop-worktree
  feature/` printed `branch "feature/" has no name a database could be called after` with its trace.
  In a throwaway repository, a
  worktree renamed from `reviewer/before` to `reviewer/after`, whose `.env` named the first
  branch's database, was refused as `DropRefused` for `reviewer/before` before any connection.
