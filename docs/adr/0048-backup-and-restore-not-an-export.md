---
status: proposed
---

# Build backup and restore, scoped so it is not an export

Placements, statements, favourites and the whole provenance record exist nowhere but the database,
and a forward-only ladder makes restore the only way back from a bad upgrade — the exact consequence
Jellyfin documents for its own users.

An earlier version drew a contrast with Plex that does not hold: Plex draws the SAME line we do. Its
scheduled tasks back up the core database every three days, described as "the database that holds
your media viewstate and other critical information", and warn that "this is only a backup of your
core database; it is not a backup of all of your metadata content". Metadata is re-derivable by
rescanning; viewstate is not, and Plex protects it on a rotation. The conclusion needs no contrast —
it stands on what our own data is.

Scoped as Jellyfin scoped 10.11: a backup "can only restore systems on which the backup was
originally made". That is what stops it becoming cross-instance interchange by the back door.
**THE SYSTEM IS THE OWNER ID**, which ADR-0044 as built already generates per install; the section
below says why that sentence needed an identity naming it, and what forced the question.

The dump is a documented dump of our own schema stamped with its migration-ladder version, NOT a
designed interchange format, so it creates no compatibility promise. Rejected: a versioned
interchange format, whose only benefit is third-party implementations that no ecosystem exists to
write; and exporting to `.nfo` or a bibliographic standard, since no existing format expresses
multi-placement and the export would silently drop the product.

## What counts as the same system, and the case that forced the question

**The identity is the owner id.** ADR-0044 as built generates it PER INSTALL rather than fixing it in
source, so it is already the only value distinguishing one instance from another. A restore refuses
unless the dump's owner id and the target's are the same.

That answers a question this record could not previously answer without weakening itself. A test
environment is FORCED rather than chosen: ADR-0047 says of its own CI gate that it "proves the ladder
composes from nothing; it says nothing about what an existing database will do", and a forward-only
ladder whose released rungs are frozen makes restore the only way back. So somewhere to run a
migration against a POPULATED database first is a requirement — and seeding that somewhere from the
owner's real backup is, on the sentence above as it stood, a restore onto a system the backup was not
made on. The product would have refused the one restore it most needs to allow.

Under the owner id it is the SAME SYSTEM, because it is the same owner, and the rule holds with no
carve-out. Someone else's install generated a different id, so instance-to-instance interchange stays
refused BY CONSTRUCTION rather than by a flag.

**Two alternatives rejected.** An explicit test-restore exception is a flag whose only job is to
weaken a guarantee, and that kind gets set in the wrong place eventually. Seeding the test
environment from the archive (ADR-0057) or from synthetic data leaves this record untouched but
proves less, because the migration is then tested against a database not shaped like the one it will
meet in anger.

**What the restore path must therefore implement**, named now because it is cheapest before this
record ships and impossible to change quietly after. A test instance is not a fresh install that
later receives a dump; it is created FROM the dump and inherits the owner id rather than generating
one. A restore into an instance that already exists refuses unless the ids already match. Both routes
preserve the same property, and naming both stops the check being bolted onto only one of them.

## Rehearsed outside the product, under CNCORE-168, and this record stays PROPOSED

**WHAT WAS BUILT IS THE DUMP AND A DEVELOPMENT RESTORE, AND NOTHING INSIDE THE PRODUCT.** A job on
the Owner's own machine dumps their catalogue, nightly once they load it as a LaunchAgent (a
background service is theirs to start, so it was written and run by hand rather than loaded), and
`pnpm db:restore` makes a worktree's database a copy of one (`packages/db/src/restore.ts`). No backup task sits on ADR-0049's registry,
no surface restores anything, and neither owner-id refusal exists, because the one restore there is
replaces a database nobody owns. That is why this record stays proposed. What follows is what the
rehearsal taught the mechanism that will be built.

**THE LADDER STAMP NEEDED NOTHING INVENTED: THE LEDGER IS INSIDE THE DUMP.** `pg_dump` of the whole
database carries `drizzle.__drizzle_migrations`, so every dump states its own ladder version and the
restore reads it off the copy rather than off a file name or a sidecar. The stamp is the newest
rung's journal `when`, which is Drizzle's `created_at` (the ledger holds that and a hash per rung,
and no tag); the job repeats it
in the file name (`ladder-<when>`) for a person choosing one. Measured 2026-09-19: the Owner's install
stood at `1789387200000`, migration 18, while `main` held migration 20.

**A RESTORE IS HELD TO THE RESTORING CODE'S LADDER BY THE CHECK THAT ALREADY EXISTED.**
`checkAppliedRungsAreFrozen` (ADR-0047) compares a database's ledger with the rungs on disk, and run
against the copy it answers the only question a restore owes: has this dump run a rung this code does
not have, or one that has changed since? Either refuses, and the copy is dropped. A dump BEHIND the
code is carried forward by `migrateToHead`. That is the populated database this record said a
migration must meet first, and it has now happened. On 2026-09-19 this branch's worktree, whose
ladder is `main`'s, restored the Owner's dump, taken at migration 18, and ran migrations 19 and 20 against their 8,052 Items before
the Owner's own install had run either. The copy kept the install's owner id, and this branch's front page
served it: "Showing 100 of 8,052 items".

**ROUTE ONE IS THE ONLY ROUTE DEVELOPMENT NEEDS, AND IT NEEDED NOTHING BOLTED ON.** The copy is
dropped and created FROM the dump, so it holds the dump's owner row and carries its id. Migration 1
generates an owner per database; the restored one replaces it. Route two, a restore into an instance
that already exists, had no caller, because a worktree's database is disposable. The in-product
restore will have one, and it must compare the ids BEFORE it drops anything: a restore replaces the
whole database, so by the time the copy exists the target's own id is gone.

**`--no-owner` AND `--no-privileges` ARE NOT OPTIONAL ANYWHERE BUT THE INSTALL ITSELF.** The
install's role is `canoncore` and the development server's is `postgres`, so restoring ownership
names a role the target lacks. Measured on the Owner's dump: `ALTER SCHEMA drizzle OWNER TO
canoncore` refused with `role "canoncore" does not exist`, and the single transaction left no table. A restore onto the install that
made the dump would not need either. A test instance does.

**THE DUMP IS WRITTEN AND READ BY THE SERVER'S OWN BINARY.** PostgreSQL 18's `pg_dump` page: "it is
not guaranteed that pg_dump's output can be loaded into a server of an older major version — not even
if the dump was taken from a server of that version." So the job runs `pg_dump` inside the install's
container and the restore runs `pg_restore` inside the container serving the copy, both `postgres:18`,
and the archive's header records it ("Dumped from database version: 18.6"). A host binary is whatever
was installed: Homebrew's 17.11 on this Mac. NOTHING CHECKS THE MAJOR YET: a dump from a newer
server reaches `pg_restore` unchecked, and what it does there has not been measured. The in-product
restore should read the header and refuse before it starts.

**THE DATABASE IS THE WHOLE CATALOGUE, TODAY.** The install has one volume, `canoncore_data`, and the
app container none, and there is no artwork yet. So ADR-0047's "a migration declares WHAT to back up"
has one target now, and gains its second when the artwork cache exists.

**THE SCHEDULE IS LAUNCHD'S, AND IT SAYS WHAT THE REGISTRY WILL LACK.** `launchd.plist(5)`, read on
macOS 26.6.2: "Unlike cron which skips job invocations when the computer is asleep, launchd will start
the job the next time the computer wakes up. If multiple intervals transpire before the computer is
woken, those events will be coalesced into one event upon wake from sleep." That promise is about
SLEEP, and the page says nothing of a machine that was off. An ADR-0049 task runs inside a container
that is up only while its host is, so it inherits the gap and none of the catch-up unless it builds
it: a backup task should run when it is OVERDUE, judged from its last success when the instance
starts, rather than at a moment on the clock.

**A FAILED DUMP IS LOUD, AND A STOPPED INSTALL IS NOT A FAILURE.** A nightly job that fails into a log
is a backup that stopped on a date nobody knows, so the job posts a notification when it fails. With
the Docker daemon or the database down it does nothing and says so, because no curation can have been
written since the last dump. ADR-0049's visible registry is the in-product form of the first half.

**SYNC IS NOT HISTORY.** This Mac has no Time Machine destination; `~/Documents` syncs to iCloud
Drive, so that is where the dumps go. Sync replaces a good file with a bad one everywhere, so the job
keeps the newest fourteen and the rotation is the only way back. The in-product backup owes a
retention of its own for the same reason.

**A DUMP IS READ BACK WHOLE BEFORE IT COUNTS.** Each is written under a partial name, restored to a
script sent nowhere (`pg_restore --file=/dev/null`, which touches no database), and only then renamed,
so the rotation never keeps a truncated one; a failed run deletes its partial. `pg_restore --list`
IS NOT A READ-BACK: it reads only the table of contents at the front, and passed an archive cut to
half its length that `--file=/dev/null` refused ("could not read from input file: end of file").
The job's first draft used `--list`, and review measured the difference.

**AT CORPUS SIZE.** The Owner's database is 48 MB, holding 8,052 Items (ADR-0137), and dumps to a
4.9 MB archive in about a second. `pnpm db:restore` made a worktree's copy of it, including the
two migrations, in 3.0 s of wall time.

**NOTHING IN THIS REPOSITORY CAN REACH THE OWNER'S DATABASE, and this is how that holds rather than
how it is hoped.** The install's database publishes no port, which `install-path.test.ts` holds
("publishes no port, so nothing on the host can name it") for the `compose.yaml` an install
downloads. An install runs its OWN copy of that file, which no test here can see, so the property
holds on the Owner's machine only while their copy keeps the service as shipped. `restoreDatabase` reads a file and refuses
anything else, and runs only inside a container that publishes a port on this machine. The job that
does reach it, by `docker compose exec`, lives beside the install rather than in this repository.
The two things here that DO reach the install, `import:list` and `test:corpus`, come in through the
product's own API as the Owner's browser does. That is the front door, not the database.

## Supersedes

An earlier decision read "no fork, no export, no import", broadly enough to refuse backup itself.
That was the most convergent finding of the competitor sweep — ten of eleven independent agents
raised it — and the refusal was NARROWED rather than dropped: instance-to-instance interchange is
still refused.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`.
