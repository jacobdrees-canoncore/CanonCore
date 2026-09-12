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
tasks and runs them; `task_runs` (migration 13) holds the history; `task.list`, `task.run`,
`task.history` and `task.cancel` are the owner's surface and `/tasks` is the page. An earlier version of this section
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
interval and startup — and only `dailyAt` exists here, because every task this instance runs wants a
daily one. That was one task when this was written and is two since CNCORE-124, which is the same
sentence rather than a weaker one: a second task earned a second trigger kind only if it needed one,
and nightly maintenance is exactly what `dailyAt` says. `CLAUDE.md` refuses a configuration option nothing in the repo reads, and three
unused trigger kinds are three schedules no test can bite on.

**AND A SECOND KIND CHANGES EVERY READER, which an earlier version of this section denied.** It
claimed `Trigger` was "a union so the second arrives without every reader changing". It is not a
union — it is one object type, `{ kind: "daily"; atHour: number }` — and the readers hardcode that
kind: the router states `z.literal("daily")` and the page's `whenItRuns` takes the daily shape and
writes the sentence for it. Both are correct for one kind and both are edits on the day there are
two, together with `nextFiring`. That is the honest cost of not building the other three, and it is
small; the sentence claiming otherwise was the thing worth removing. Found in review.

**THE SCHEDULE IS NOT THE OWNER'S TO EDIT, and Plex's eight toggles are not adopted.** The trigger is
declared in code beside the task. An owner-editable cadence is a settings surface, a table and a
migration for a catalogue that today runs one task; what that would buy over a sensible hour is
nothing this record argued for. The eight remain what this record says they are — a list of what
needs scheduling, not a list of switches owed.

**THREE NON-SUCCESS OUTCOMES RATHER THAN TWO, WHICH THIS REPOSITORY HAD ALREADY MEASURED AND SAID.**
`cancelled` is the owner stopping a run, `aborted` is the server dying under one, and `failed` is the
task breaking. The first draft of this section collapsed the first two and argued that "a fifth value
would be a column the page renders identically" — which was wrong twice over. `docs/research/verify-adr-jellyfin.md`
§34 had already read Jellyfin's `TaskCompletionStatus`, found `Cancelled` ("manually cancelled by the
user") apart from `Aborted` ("due to a system failure or shutdown"), and reported that the third value
is the one worth copying because THIS RECORD'S OWN ARGUMENT reaches it: a job the owner stopped and a
job the machine stopped are different answers too. And the page does not render them identically — it
says "You stopped it" against "The server stopped while this was running", which is a decision read
back against a machine worth going to look at. Overriding a verified finding on the strength of a
first draft's convenience is the mistake here, and it is recorded rather than quietly fixed.

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

**THE HISTORY IS READ AS A HISTORY, not as a last outcome.** `task.history` answers one task's runs
newest first and `/tasks` renders the ones before the last behind a `details`. An earlier build
surfaced `lastRun` alone, which left "last night failed" reading identically to "every night for a
fortnight has failed" — a glitch and a broken machine, told apart only by the runs in between. The
depth is 30, which is a month of a daily task. Found in review.

**AND THIS TABLE ONLY GROWS, WHICH IS THIS RECORD'S OWN CATEGORY ARRIVING BACK AT IT.** A daily task
writes 365 rows a year and nothing removed them; `task_runs` carries a tombstone and a change
sequence (ADR-0075) that nothing writes and no read filters on. The compaction this record lists was
therefore owed to its own history table, and CNCORE-124 BUILT IT — a second task on the registry,
which is the shape this whole record is for. It was not urgent at one task and a row a night, and it
was not free to forget, so it was a ticket rather than a sentence; the section below is what that
ticket did.

**WHAT A RUN LEAVES BEHIND IS BOUNDED AT ADR-0123's 300.** A task answers a sentence it wrote, but
what a task THROWS is written by whatever broke it, and that column is read onto a page. It is
collapsed onto one line before it is cut, which is the correction that record records against itself.

## The history is compacted by a task on itself, under CNCORE-124

`compact-task-runs` is the second task on this registry, daily at four, and what it compacts is this
record's own run history. The category this record schedules, turned on the table that makes this
record's minimum reachable.

**A SECOND TASK IS WHAT TURNS A REGISTRY INTO A LIST.** CNCORE-119 had to prove the mechanism — a
task listed, run by hand, cancelled and read back — and one task can prove a registry without ever
being a list of them. Nothing in the registry, the page or the scheduler had to change to carry the
second; the whole of the change is a file beside `sweep-sessions.ts`, a line in `theTasks` and a
query in `packages/db`. That is the claim this record has been making since CNCORE-119, tested for
the first time.

**THIRTY DAYS, BECAUSE THAT IS WHERE THE PRODUCT STOPS READING.** `registry.history` asks for 30 runs
and `/tasks` renders what it answers, so for a task on a daily trigger a run older than a month is
already unreachable through every surface this app has. The window sits where the reader stops rather
than at a round number chosen for itself. It is NOT the same constant as that depth and cannot be:
one is a bound in ROWS and the other an AGE, and they coincide only for a task that runs once a day.
A task an owner ran forty times this afternoon keeps all forty for a month while the page shows the
newest thirty — the window may keep more than the page shows, and must never keep less.

**THE LAST RUN OF EVERY TASK SURVIVES, HOWEVER OLD IT IS, AND THAT IS THE WHOLE DESIGN RATHER THAN A
REFINEMENT OF IT.** A window applied on age alone takes every row of a task that stopped in July;
`readLatestTaskRuns` then answers nothing for that key, and `/tasks` renders "Has not run yet". The
compaction would report a machine that silently stopped months ago as a fresh install — this record's
own sentence, manufactured by the maintenance written to serve it, destroying the evidence in the
same act. So the delete exempts each task's newest run and takes everything behind it. A task that
stopped is not thereby a task whose history grows forever; it keeps exactly one row.

**IT IS ALSO WHAT KEEPS AN OPEN RUN SAFE, at no extra clause.** A row still reading `running` is one
something intends to write the ending of, and deleting it under that process would leave `endTaskRun`
with no row to close. The registry refuses a second concurrent run of one key, so a key's open run is
always that key's newest, and the exemption above already covers it.

**IT DELETES OUTRIGHT RATHER THAN TOMBSTONING, though `task_runs` carries a `deleted_at` like every
other table (ADR-0075).** A tombstone here would compact nothing twice over: the row stays in the
table, and no read of this table filters on that column, so the history would go on rendering every
run it had supposedly removed. Compaction is what REMOVES tombstoned rows rather than a thing that
writes them, and `sweepSessions` deletes one table over for the same reason.

**WHICH MEANS THIS COMPACTS BY AGE AND NOT BY TOMBSTONE, and the distinction is worth stating because
ADR-0075 does not draw it.** That record says this one "schedules tombstone compaction, which
presupposes tombstones exist". For the eight pieces of work listed above that is right. It is not what
this task does: a run is not deleted by anybody, so there is nothing to tombstone and nothing to
sweep afterwards — what makes a run removable is that it has aged past every reader. **So
`task_runs`'s own tombstone and change sequence are STILL WRITTEN BY NOTHING AND FILTERED ON BY
NOTHING, exactly as before this ticket.** They are ADR-0075's blanket rather than a mechanism this
table uses, and the ticket that gives them a reader is not this one. Said plainly here because a
history table that now has a compaction task looks from outside like one whose soft-delete path is
in use, and it is not.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`.
