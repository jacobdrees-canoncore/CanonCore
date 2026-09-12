import { and, desc, eq, inArray, lte, notInArray, sql } from "drizzle-orm";

import type { Database } from "./index";
import { theOwnerId } from "./placements";
import { taskRuns } from "./schema";

/**
 * How a run ended (ADR-0049).
 *
 * STOPPED IS NOT BROKEN, which is that record's own instruction and the reason
 * it points at Jellyfin's shape: an owner who stopped last night's sweep is
 * reading their own decision back, and an owner whose sweep threw is reading an
 * incident.
 *
 * AND THE OWNER STOPPING IT IS NOT THE SERVER DYING UNDER IT. Jellyfin ships
 * three non-success values rather than two -- `Cancelled` is "manually
 * cancelled by the user" and `Aborted` is "due to a system failure or
 * shutdown" -- and `docs/research/verify-adr-jellyfin.md` §34 read that enum
 * and says the third is the one worth copying, because ADR-0049's own argument
 * reaches it. A fortnight of the owner's own cancellations and a fortnight of
 * the server dying mid-sweep are the same column otherwise, and only one of
 * them is a machine that needs looking at.
 */
export type TaskOutcome = "running" | "completed" | "failed" | "cancelled" | "aborted";

/** One run of one task, as anything reading the history sees it. */
export interface TaskRun {
  id: string;
  taskKey: string;
  startedAt: Date;
  /** `null` exactly while `outcome` is `running`; the table holds them as one fact. */
  endedAt: Date | null;
  outcome: TaskOutcome;
  /** What the run did, or what broke it. `null` while it is still running. */
  detail: string | null;
}

/**
 * Opens a run, and answers the row every later write to it names.
 *
 * THE ROW IS WRITTEN WHEN THE RUN STARTS RATHER THAN WHEN IT FINISHES, which is
 * what makes a run that never finished readable at all. A history written only
 * on completion would answer "nothing ran" for the one case ADR-0049 exists to
 * surface -- the night the process died mid-sweep -- and would answer it in the
 * same words as a night nothing was scheduled.
 *
 * THE OWNER IS READ RATHER THAN PASSED, for the reason `startSession` gives: a
 * caller free to name an owner is a caller free to name the wrong one on the
 * day multi-user arrives (ADR-0044 makes exactly one today).
 */
export async function startTaskRun(db: Database, taskKey: string): Promise<TaskRun> {
  const [row] = await db
    .insert(taskRuns)
    .values({ ownerId: await theOwnerId(db), taskKey })
    .returning();
  if (!row) throw new Error("opening a task run returned no row");
  return asRun(row);
}

/**
 * Closes a run with how it ended and what it did.
 *
 * THE CLOCK IS POSTGRES'S, as everywhere else that compares two moments in this
 * package: `started_at` defaults to the database's `now()`, so an end stamped
 * from this process would be two clocks subtracted. ADR-0043 measured that skew
 * running BACKWARDS here -- a row that ended 60ms before it began.
 *
 * IT CLOSES ONLY A RUN THAT IS STILL OPEN, and answers `null` when there was
 * nothing to close. A run already ended is one something else has already had
 * the last word on -- a restart's startup close and a task's own return racing
 * over the same row -- and the first answer is the true one.
 *
 * IT ANSWERS THE ROW RATHER THAN NOTHING, because the caller's own copy of the
 * run is the one it opened, whose `ended_at` is null. Assembling an answer out
 * of that copy and the ending produces a run reading `completed` with no end --
 * the one state `task_runs_running_has_no_end` refuses, so a shape the database
 * would never have stored. Found in review.
 */
export async function endTaskRun(
  db: Database,
  runId: string,
  outcome: Exclude<TaskOutcome, "running">,
  detail: string,
): Promise<TaskRun> {
  const [ended] = await db
    .update(taskRuns)
    .set({ outcome, detail, endedAt: sql`now()` })
    .where(and(eq(taskRuns.id, runId), eq(taskRuns.outcome, "running")))
    .returning();
  if (ended) return asRun(ended);

  // NOTHING WAS UPDATED, so something else closed this run first -- a restart's
  // startup close, reaching a run whose process was gone. The stored row is the
  // true one and this reads it rather than answering the ending that lost.
  const [stored] = await db.select().from(taskRuns).where(eq(taskRuns.id, runId));
  if (!stored) throw new Error(`no task run is ${runId}`);
  return asRun(stored);
}

/**
 * One task's runs, newest first.
 *
 * BOUNDED BY THE CALLER, because a page showing every run is a page that gets
 * slower every night it works. `RUN_HISTORY_DEPTH` below is the bound the
 * product passes, and compaction keeps exactly what this read can reach.
 */
export async function readTaskRuns(
  db: Database,
  taskKey: string,
  limit: number,
): Promise<TaskRun[]> {
  const rows = await db
    .select()
    .from(taskRuns)
    .where(eq(taskRuns.taskKey, taskKey))
    .orderBy(desc(taskRuns.startedAt))
    .limit(limit);
  return rows.map(asRun);
}

/**
 * The MOST RECENT run of each of these tasks, keyed by the task's key.
 *
 * ONE STATEMENT RATHER THAN ONE PER TASK, because the page that reads this
 * reads every task at once: ADR-0049 names eight pieces of work that will want
 * a key here, and eight sequential round trips is eight times the latency of
 * one for an answer Postgres composes itself.
 *
 * A TASK WITH NO RUNS IS SIMPLY ABSENT from the answer, which is what lets the
 * caller tell "never run" from "ran and did nothing" -- a distinction a zero
 * row would destroy, and the one that says whether a job silently stopped.
 */
export async function readLatestTaskRuns(
  db: Database,
  taskKeys: string[],
): Promise<Map<string, TaskRun>> {
  if (taskKeys.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([taskRuns.taskKey])
    .from(taskRuns)
    .where(inArray(taskRuns.taskKey, taskKeys))
    .orderBy(taskRuns.taskKey, desc(taskRuns.startedAt));
  return new Map(rows.map((row) => [row.taskKey, asRun(row)]));
}

/**
 * Closes every run still reading `running`, and answers how many it closed.
 *
 * THE ROWS A KILLED PROCESS LEAVES BEHIND. A run lives in one process -- the
 * `AbortController` that could stop it is in that process's memory -- so a row
 * still reading `running` when the registry starts is a run nothing will ever
 * write the ending of.
 *
 * IT CLOSES EVERY OPEN ROW AND NOT ONLY THIS PROCESS'S, which is safe because
 * of the shape this app ships in rather than by luck: ADR-0109 commits to one
 * process that something restarts, and the container runs one `node server.js`.
 * A second server sharing this database would have its live runs closed under
 * it -- so whatever first runs two is what has to key these rows by the process
 * that opened them, and the rows would need a column they do not have.
 *
 * `aborted` AND NOT `failed`, using ADR-0049's distinction exactly as that
 * record means it: the run was STOPPED, by the machine going away, rather than
 * BROKEN by anything it did.
 */
export async function closeTaskRunsLeftOpen(db: Database, detail: string): Promise<number> {
  const closed = await db
    .update(taskRuns)
    .set({ outcome: "aborted", detail, endedAt: sql`now()` })
    .where(eq(taskRuns.outcome, "running"))
    .returning({ id: taskRuns.id });
  return closed.length;
}

/**
 * HOW MANY OF A TASK'S RUNS ARE KEPT, and read (ADR-0049, CNCORE-124).
 *
 * ONE CONSTANT FOR BOTH SIDES, which is the whole reason it sits here rather
 * than beside either caller. `registry.history` passes it to `readTaskRuns` so
 * the page shows this many; `compactTaskRuns` keeps this many so the rows behind
 * them go. The two compare against it in opposite directions -- the same shape
 * `sessions.ts` gives for `SESSION_LIFETIME_SECONDS` and for the same reason:
 * the cutoff written twice is two places to change and one of them forgotten,
 * and the failure it produces here is compaction deleting rows the page is still
 * rendering.
 *
 * THIRTY, WHICH IS A MONTH OF A DAILY TASK -- enough to see that last night
 * failed and that the four before it did not, which is the question ADR-0049
 * says the history is read to answer.
 *
 * A DEPTH IN ROWS AND NOT A WINDOW IN DAYS, and that distinction is the
 * correction this ticket's first implementation needed. Thirty rows is a month
 * ONLY for a task that runs exactly daily; `/tasks` offers a Run-now button, so
 * an owner who ran a task six times across two months has all six on the page.
 * A thirty-day window deleted four of those -- history the product was still
 * displaying, removed by the maintenance meant to remove only what nothing can
 * read. Rank is what the page actually bounds by, so rank is what compaction
 * has to bound by. Found in review.
 */
export const RUN_HISTORY_DEPTH = 30;

/**
 * Removes the runs no surface can reach, and answers how many went.
 *
 * ADR-0049's OWN CATEGORY, ARRIVING BACK AT ITS OWN TABLE. That record lists
 * tombstone compaction among the eight pieces of work its registry exists to
 * run, and `task_runs` -- what makes its history readable at all -- only grew: a
 * daily task writes 365 rows a year and nothing removed one.
 *
 * IT KEEPS EXACTLY WHAT THE PAGE CAN SHOW: the newest `RUN_HISTORY_DEPTH` runs
 * OF EACH TASK, by the same order `readTaskRuns` answers in. So this is not a
 * policy that happens to agree with the read path, it is the read path's own
 * bound turned around -- and a run it removes is one no surface in this app
 * could have rendered.
 *
 * WHICH IS ALSO WHY THERE IS NO EXEMPTION FOR A TASK'S LAST RUN. It needs none:
 * rank one is inside every depth, so the newest run of every task survives by
 * construction, however old it is. That matters because ADR-0049 exists for the
 * job that "silently stopped months ago" -- a rule that could take the last run
 * of a task that stopped in July would leave `readLatestTaskRuns` answering
 * nothing for it, and `/tasks` rendering "Has not run yet": the stoppage this
 * record exists to surface, reported as a fresh install.
 *
 * AND IT IS WHAT KEEPS AN OPEN RUN SAFE, at no clause of its own. A row still
 * reading `running` is one something means to write the ending of, and deleting
 * it under that process would leave `endTaskRun` no row to close. The registry
 * refuses a second concurrent run of one key, so a key's open run is always that
 * key's newest -- rank one, and kept.
 *
 * NO TIEBREAK ON THE ORDER, matching `readTaskRuns` exactly. Two runs of ONE
 * task sharing a `started_at` to the microsecond would need two runs of that key
 * at once, which is the thing the registry refuses; across keys the ranking is
 * partitioned and ties cannot meet.
 *
 * THE ROWS GO OUTRIGHT RATHER THAN BEING TOMBSTONED, though this table carries a
 * `deleted_at` like every other (ADR-0075). A tombstone here would compact
 * nothing twice over: the row stays in the table, and no read of this table
 * filters on that column -- so the history would go on rendering every run it
 * had supposedly removed. `sweepSessions` deletes one table over for the same
 * reason.
 */
export async function compactTaskRuns(db: Database): Promise<number> {
  const ranked = db
    .select({
      id: taskRuns.id,
      rank: sql<number>`row_number() over (partition by ${taskRuns.taskKey} order by ${taskRuns.startedAt} desc)`.as(
        "rank",
      ),
    })
    .from(taskRuns)
    .as("ranked");

  const theRunsThePageCanShow = db
    .select({ id: ranked.id })
    .from(ranked)
    .where(lte(ranked.rank, RUN_HISTORY_DEPTH));

  const removed = await db
    .delete(taskRuns)
    .where(notInArray(taskRuns.id, theRunsThePageCanShow))
    .returning({ id: taskRuns.id });
  return removed.length;
}

function asRun(row: typeof taskRuns.$inferSelect): TaskRun {
  return {
    id: row.id,
    taskKey: row.taskKey,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    outcome: row.outcome as TaskOutcome,
    detail: row.detail,
  };
}
