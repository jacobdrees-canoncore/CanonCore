---
status: accepted
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

## As built, under CNCORE-119

**THE REGISTRY IS BUILT, AND SO IS THE THING THAT FIRES IT.** `@canoncore/tasks` holds the keyed
tasks and runs them; `task_runs` (migration 12) holds the history; `task.list`, `task.run` and
`task.cancel` are the owner's surface and `/tasks` is the page. An earlier version of this section
said the registry was not built and tracked it as CNCORE-119; that ticket is this one.

**THE FIRST TASK DID NOT HAVE TO BE WRITTEN FOR IT, which is what made this record cheaper to
implement than it reads.** The eight above were work nobody had written; `sweepSessions` in
`packages/db` was written, tested and called by NOTHING — it removes every session row past its
lifetime, which is the tombstone compaction this record lists, one table at a time. CNCORE-116 built
it and stopped there deliberately: the alternatives were a login, a page render or the container's
boot doing maintenance on the side, and a sweep smuggled into an event that happens to be nearby is
precisely the hidden timer this record refuses. It is `sweep-sessions` now, on a daily trigger, and
the TODO that named this ticket is gone from that file.

**ONE TRIGGER KIND, AND THAT IS THE RULE RATHER THAN A GAP.** Jellyfin carries four — daily, weekly,
interval and startup — and only `dailyAt` exists here, because `sweep-sessions` is the only task and
it wants a daily one. `CLAUDE.md` refuses a configuration option nothing in the repo reads, and three
unused trigger kinds are three schedules no test can bite on. `Trigger` is a union so the second
arrives without every reader changing, and the task that needs it is what earns it.

**THE SCHEDULE IS NOT THE OWNER'S TO EDIT, and Plex's eight toggles are not adopted.** The trigger is
declared in code beside the task. An owner-editable cadence is a settings surface, a table and a
migration for a catalogue that today runs one task; what that would buy over a sensible hour is
nothing this record argued for. The eight remain what this record says they are — a list of what
needs scheduling, not a list of switches owed.

**`aborted` COVERS BOTH WAYS A RUN IS STOPPED, which is this record's distinction used as it means
it.** Jellyfin separates `Cancelled` (a person asked) from `Aborted` (the shutdown killed it); here
both read `aborted` and the detail says which — "Stopped before it finished." against "The server
stopped while this was running." The distinction this record actually asks for is STOPPED against
BROKE, and that is kept. A fifth value would be a column the page renders identically.

**AND THE SIGNAL DECIDES THE OUTCOME, NOT THE TASK'S RETURN.** Cancelling is cooperative, because
nothing else is available: a JavaScript runtime cannot interrupt a promise from outside, so a task
that never consults its `AbortSignal` runs to its own end. What the registry guarantees is the
ANSWER — the run reads `aborted` from the moment the owner asked, whether the task rejected, ignored
it and returned a sentence, or threw something unrelated on the way out. Recording such a run as
`completed` would tell the owner their instruction had no effect AND that everything was fine.

**A RUN IS OPENED WHEN IT STARTS, WHICH IS WHAT MAKES A RUN THAT NEVER FINISHED READABLE.** A history
written only on completion answers "nothing ran" for the one case this record exists to surface — the
night the process died mid-sweep — and answers it in the same words as a night nothing was scheduled.
The cost is rows that outlive the process that opened them, so the scheduler closes every run still
reading `running` before it arms anything, as `aborted`.

**ONE PROCESS IS ASSUMED, and it is ADR-0109's shape rather than an oversight.** The live runs are a
map of `AbortController`s in one process's memory, because the object that can stop a promise is the
object that created it; the startup close treats every open row as the dead process's. Two servers on
one database would each fire every trigger and each close the other's live runs. ADR-0109 commits to
a process that something restarts and the image runs one `node server.js`, so whatever first runs two
is what has to key a run to the process that opened it — and that needs a column `task_runs` does not
have.

**NOTHING'S CORRECTNESS WAITS ON THE SWEEP.** A dead session row is refused by `seeSession` on the
clock whether or not anything has removed it (ADR-0043), so an unswept table is a table that grew.
That is true of tombstone compaction generally and is why this whole category is maintenance rather
than mechanism — but a maintenance job nobody can see is one that silently stopped months ago, which
is this record's own sentence and the reason it exists.

**WHAT A RUN LEAVES BEHIND IS BOUNDED AT ADR-0123's 300.** A task answers a sentence it wrote, but
what a task THROWS is written by whatever broke it, and that column is read onto a page. It is
collapsed onto one line before it is cut, which is the correction that record records against itself.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`.
