---
status: proposed
---

# Migrations are a forward-only ladder, with the mechanics decided up front

The ordering key is a TIMESTAMP rather than a sequential index, so schema and data-fix migrations
share one sequence. Drizzle's opt-in `migrations: { prefix: "timestamp" }` produces `20260910102311`
— not ISO 8601, and the default `index` prefix must be changed deliberately.

AND THE RUNNER DOES NOT MAKE SPLICING SAFE, which was assumed and is false. Drizzle applies
migrations by HIGH-WATER MARK, not set membership: it reads `folderMillis` from the journal and
selects `order by created_at desc limit 1`. A migration inserted below that mark is SILENTLY SKIPPED
and the run reports success. Demonstrated against real Postgres: the same migration folder produced
two different schemas on two databases, both green.

It cannot detect an EDITED migration either. Drizzle stores a `hash` per journal entry and never
reads it back, so a rung rewritten after it shipped passes silently too. Both checks read the same
table and belong in one pass.

So the one-sequence property buys ordering, not safety. Alembic and Django do carry dependency
graphs — `down_revision` and Django's `dependencies` — which would make a splice detectable, but
neither project documents splice detection as the reason; Alembic's stated purpose for the DAG is
branching and merging, and nothing in either records considering timestamp ordering and rejecting
it. The inference is ours and it is sound; it is not theirs. Either never splice, or add the
membership and hash checks the runner lacks.

TWO MORE COSTS OF THE TIMESTAMP KEY, both measured at source. The filename prefix is NOT the
ordering key — `folderMillis` from the journal is, and the runner never reads the filename. And the
`timestamp` prefix is UTC at one-second granularity, so two migrations generated in the same second
collide, where `index` cannot. Note also that `migrations.prefix` appears only in Drizzle's v0.32.0
release notes and not in its config reference, and that Drizzle 1.0 is reworking the migrator
entirely — everything here holds for 0.x.

CI RUNS EMPTY-TO-HEAD EVERY RELEASE, as a gate — and know what it does NOT catch. Building from
empty applies every migration regardless of the high-water mark, so it goes green on exactly the
spliced-migration divergence described above. It proves the ladder composes from nothing; it says
nothing about what an existing database will do. It is also a local choice rather than industry
practice: Rails prefers `db:schema:load` to replaying history — though its documented reason is that
old migrations rot against evolving application code, not that empty-to-head misses divergence.

The mechanism demonstrably retrofits — Jellyfin added all of it in 2025, to a codebase dating from
2018, in a project large enough that a botched migration made its own release notes — but the
HISTORY does not. (Jellyfin publishes no install count and ships no telemetry, so an earlier
"hundreds of thousands of installs" is withdrawn.) Once a released version has run
migration N on someone's data, migration N is frozen, so any migration written before the rules
exist is a rung you cannot fix and only discover after it ships.

A row that cannot be transformed is QUARANTINED AND COUNTED rather than aborting the migration.
Alembic, Flyway, Rails and Django have no row-level quarantine concept — all four are documented as
succeed-or-roll-back — and Jellyfin without one reports that some instances simply stay broken. The
nearest thing anywhere is Flyway Teams' `errorOverrides`, which downgrades a named SQL error to a
warning; that is statement-level and blanket rather than row-level, so the gap is real, but "the one
place we are ahead" overstated it.

## The mechanics, in the detail an implementer needs

**The version table.** Every major tool has one: Alembic `alembic_version`, Flyway
`flyway_schema_history`, Rails `schema_migrations`, Django `django_migrations`, EF Core
`__EFMigrationsHistory`. (Not quite "no disagreement", as an earlier version had it — three of the
five are configurable defaults, and Flyway renamed `schema_version` to `flyway_schema_history` in
5.0.) Ours records the applied ordering key and
`applied_on`. `head` is a named target so "empty to head" is one command.

**The declared floor** borrows Flyway's baseline concept — "the oldest version we will migrate
from" is confirmed verbatim — but the BEHAVIOUR is ours: below the floor we refuse to start and say
which version to upgrade to first. Flyway does neither; it silently excludes everything up to the
baseline and carries on. (Flyway has two things called baseline; this is the command.)

**The startup compatibility check** reads the version table and refuses to run against a database
from the future or from below the floor. Jellyfin's own check has to fingerprint the schema by
probing `pragma_table_xinfo` for three columns that happen to have arrived in the right releases,
because its old database carries no version stamp at all. That is what a missing stamp costs, paid
in 2025 by a ten-year-old project, and it is the argument for the version table.

**Three stages**, following Jellyfin's names and order: PRE-INITIALISATION for anything that must
change the application before services start (avoid it), CORE INITIALISATION for EF schema
migrations, and APP INITIALISATION for anything that needs the services running. Note that Jellyfin's
own default is APP, not Core: `JellyfinMigrationAttribute`'s constructor overwrites the
`CoreInitialisation` initialiser with `Stage = AppInitialisation`, and nothing sets Core. An earlier
version of this record called Core "the default", inheriting a stale doc comment.

**A migration declares WHAT to back up**, not merely that it should be backed up. For us that is the
database and the artwork cache. Jellyfin's equivalent names five targets and includes on-disk
artefact directories, not just the database, because restoring half of a pair is not a restore.

## A third strategy, and it is not a worse one

Plex avoids migrating heterogeneous data by FREEZING it. When it changed metadata providers in 2019,
"Existing content will not change by default **for now**" and the user opts in per artist.

Read the whole sentence. Plex framed the freeze as a stopgap and twice promised that "In the future,
we'll have existing content automatically upgrade" — which is the shape `CLAUDE.md` tells us to
reject. What makes it citable anyway is better than the quote: the page's `dateModified` is
2026-06-09 and the "for now" is still there, so the freeze has stood seven years unbuilt-past. A
stopgap that outlives its replacement plan by seven years is a strategy in all but name.

Migrate everything, quarantine what fails, or freeze the old semantics and let the owner choose. All
three are legitimate, and WHICH ONE A GIVEN MIGRATION USES IS A DECISION IT SHOULD STATE.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-products.md`.

## As built, under CNCORE-4 — and this record stays PROPOSED

Migration 1 lands the RULES, which is the half that cannot be retrofitted. Half
the mechanism is still unbuilt, and naming which half is the point of this
section: half a mechanism looks finished from outside.

**BUILT.**

- `migrations: { prefix: "timestamp" }` in `drizzle.config.ts`, so a rung is
  `20260910145304_name.sql` and the folder reads in the order it executes.
- The version table, which Drizzle creates itself: `drizzle.__drizzle_migrations`.
- **The splice check.** `checkJournalIsAppendOnly` asserts the journal's `when`
  values strictly increase, so nothing can sit below the high-water mark the
  runner applies from. It also catches two rungs sharing one ordering key, and
  separately two journal entries naming ONE FILE — which is what the one-second
  UTC prefix actually makes reachable, since two rungs generated inside a second
  get the same filename and one overwrites the other on disk. An earlier draft
  of this section claimed the key check caught the same-second case; it does
  not, and the two are now separate checks because they are separate faults.
  Needs no database.
- **The freeze check.** `checkAppliedRungsAreFrozen` compares each applied
  rung's file to the SHA-256 Drizzle wrote and never reads back, using Drizzle's
  own hash: SHA-256 over the whole file as a string. It also catches a rung a
  database has run that the ladder no longer holds.
- Both in one pass, as this record asks: `pnpm db:check-ladder`.
- **The empty-to-head CI gate**, and beside it the gate this record says it
  cannot replace: CI migrates a database with the BASE BRANCH's ladder, runs the
  checks against it, then applies this branch's rungs on top. That is the
  upgrade path a real installation takes, and the only place the freeze check
  means anything -- against a database this branch built itself it compares
  files to their own hashes.
- **A migration states its strategy.** Rung 2 says it migrates everything and
  why that is trivially true at migration 1.

**NOT BUILT, and each needs a released version to mean anything.** The declared
floor and the refusal to start below it; the startup compatibility check; the
three stages; row-level quarantine; a migration declaring what to back up. There
is no released version, no prior schema and no user data, so all five would be
code with nothing to run against. They arrive with the first release.

**A pg_dump comparison of the empty-to-head and upgrade-path databases was
considered and left out.** It would catch a rung silently SKIPPED -- but the
splice check makes a skip unreachable, since Drizzle can only skip what sits
below the high-water mark and nothing is allowed below it. It also needs a
pg_dump matching the server major, which the runner does not ship. The note is
in the workflow beside the decision, and it is worth revisiting only if the
splice check is ever relaxed.

## The first rung after migration 1, under CNCORE-7 -- and this record still stays PROPOSED

Migration 2 -- rung 3 in the journal, since migration 1 is two rungs -- makes `placements.position`
nullable. Nothing in the NOT BUILT list above changes: there is still no released version, so the
floor, the compatibility check, the stages, quarantine and the backup declaration still have nothing
to run against.

What DID change is that the CI upgrade path stopped being vacuous. Migration 1's two rungs were
written and applied together, so "apply this branch's rungs on top of a database built from the base
branch's ladder" had nothing to apply: the base branch's ladder WAS the whole ladder. This is the
first rung that arrives at a database an earlier ladder already built, which is the shape the check
exists for and the only shape in which the freeze check compares a file to a hash some other run
wrote.

**And rung 3 states its strategy**, as this record requires. It migrates everything, and it can say
so briefly because it WIDENS: every row migration 1 wrote has a position and keeps it, so no row can
fail to transform and there is nothing to quarantine. A rung that narrowed would owe a real answer.

## One rung carrying both a schema change and a data change, under CNCORE-28

Migration 3 -- rung 4 -- adds a property row AND an index, in one file, and the
record still stays PROPOSED for the reasons rung 3 gave: nothing in the NOT BUILT
list above has anything to run against yet.

The mechanic is worth writing down because migration 1 did it the other way and
the difference is not a style choice. **Generate the rung from the schema first,
then hand-write the data statements into the generated file.** `drizzle-kit
generate` writes the SQL and a snapshot beside it, and the snapshot describes the
SCHEMA ONLY -- so an INSERT added to the file afterwards is invisible to the next
diff, and `db:generate` run again produces nothing. Hand-writing the CREATE INDEX
into a `--custom` rung instead is what breaks: the snapshot would not know the
index exists and the next generate would emit it a second time.

Migration 1 needed two rungs because its data half was far too large to sit in a
generated file; that was its size, not a rule. **Rename the generated file and its
journal `tag` together**, since `--name` is not available after the fact and the
runner orders by the journal rather than the filename (above).

## What renumbering ACTUALLY costs, and a rung the schema cannot declare, under CNCORE-31

**RENAMING A RUNG IS NOT RENUMBERING IT, and the snapshots are the half that gets
missed.** Beside each rung Drizzle writes a snapshot carrying an `id` and a
`prevId`, and those form a chain independent of both the filename and the
journal. Migration 4 was generated off migration 2 and renamed when CNCORE-28's
rung landed on `main` first -- so its snapshot still pointed at migration 2's,
and two rungs claimed one parent. THE LADDER RAN PERFECTLY AND `drizzle-kit
generate` REFUSED TO RUN AT ALL: "are pointing to a parent snapshot ... which is
a collision". Every migration applies, every test passes, CI is green, and the
next person who needs a rung cannot make one.

Repaired under CNCORE-31 by re-pointing migration 4's `prevId` at migration 3's
snapshot and folding in the one index the off-by-one had left out of it
(`statements_property_literal_source`, migration 3's, which the schema declares).
**The check that it worked is that `generate` then emits NOTHING**, because an
empty diff is the head snapshot agreeing with `schema/`. Note what the branch
cost: CNCORE-8 and CNCORE-28 ran in separate worktrees exactly so this collision
would arrive as a conflict git reports, and it did -- for the `.sql` file and the
journal, which conflict textually. The snapshots did not conflict, because each
branch wrote its own file. **So the renumbering instruction above is incomplete
without this paragraph**: rename the file, the journal `tag` AND re-point the
snapshot, or `generate` dies for everyone after you.

**AND SOME INDEXES CANNOT BE DECLARED IN THE SCHEMA AT ALL**, which is the
opposite case to the one above and needs the opposite handling. Migration 5's
`statements_one_item_per_external_id` is partial on a property id MINTED PER
INSTALL, and `schema/tables.ts` is one file shared by every install, so there is
nothing to write there. It is hand-written in a `--custom` rung, and the failure
mode this section warns about -- the snapshot not knowing the index exists, so the
next `generate` emits it twice -- CANNOT ARISE, because it is in neither the
snapshot nor the schema and `generate` diffs those two against each other. The
rule is therefore not "never hand-write a CREATE INDEX": it is **the schema and
the snapshot must agree**. Declare what can be declared and generate it; hand-write
what cannot, and leave a note where a reader would otherwise add it.
