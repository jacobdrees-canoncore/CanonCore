---
status: proposed
---

# Recurring work runs on a visible task registry

Scans, the six-month TMDB cache eviction, projection reconciliation, provider re-refresh, orphan
collection, tombstone compaction, palette extraction and the analysis pass all need a runner, and
none had one.

Keyed tasks, each visible, runnable by hand, cancellable, with a run history. Jellyfin's shape is
worth copying — named trigger types rather than raw cron, and `Aborted` distinct from `Failed`,
because a job that was killed and a job that broke need different answers.

Plex's own version is one maintenance window (3am-6am by default) plus EIGHT separately toggleable
tasks with hard-coded cadences — database backup every three days, optimise weekly, remove old
bundles and cache files weekly, refresh local metadata every three days, and so on. Not "one
setting", as an earlier version had it, and the eight are worth reading as a list of what actually
needs scheduling in this category.

The minimum is that last night's failure is VISIBLE. A recurring job whose result nobody can see is
one that silently stopped months ago.

## Not built, and one task that now exists -- under CNCORE-116

**THE REGISTRY IS NOT BUILT.** No keyed tasks, no run history, nothing to run by hand and nothing
to cancel. Tracked as CNCORE-119.

**AND THE NINTH TASK NOW EXISTS AS A FUNCTION.** The eight above were work nobody had written;
`sweepSessions` in `packages/db` is written, tested and called by NOTHING -- it removes every
session row past its lifetime, which is the tombstone compaction this record lists, one table at a
time. CNCORE-116 built it and stopped there deliberately: the alternatives were a login, a page
render or the container's boot doing maintenance on the side, and a sweep smuggled into an event
that happens to be nearby is precisely the hidden timer this record refuses. "The minimum is that
last night's failure is VISIBLE" cannot be met by something that was never announced to have run.

**WHICH MAKES THIS RECORD CHEAPER TO IMPLEMENT THAN IT READS.** The first task the registry carries
does not have to be written for it, so what CNCORE-119 has to prove is the registry itself: a task
that can be listed, run, cancelled and read back afterwards, with `Aborted` distinct from `Failed`.

**NOTHING'S CORRECTNESS WAITS ON THE SWEEP.** A dead session row is refused by `seeSession` on the
clock whether or not anything has removed it (ADR-0043), so an unswept table is a table that grew.
That is true of tombstone compaction generally and is why this whole category is maintenance rather
than mechanism -- but a maintenance job nobody can see is one that silently stopped months ago,
which is this record's own sentence and the reason it exists.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`.
