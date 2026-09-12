import { and, desc, eq, inArray, sql } from "drizzle-orm";

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
 * BOUNDED BY THE CALLER, because this table only grows: a task on a daily
 * trigger writes 365 rows a year and a page showing all of them is a page that
 * gets slower every night it works.
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
