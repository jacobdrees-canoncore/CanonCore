import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "./index";
import { theOwnerId } from "./placements";
import { taskRuns } from "./schema";

/**
 * How a run ended (ADR-0049).
 *
 * `aborted` IS NOT `failed`, which is that record's own instruction and the
 * reason it points at Jellyfin's shape: a job that was STOPPED and a job that
 * BROKE need different answers from whoever reads the history. An owner who
 * cancelled last night's sweep is reading their own decision; an owner whose
 * sweep threw is reading an incident.
 */
export type TaskOutcome = "running" | "completed" | "failed" | "aborted";

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
 * IT CLOSES ONLY A RUN THAT IS STILL OPEN. A run already ended is one something
 * else has already had the last word on -- the scheduler's shutdown sweep and a
 * task's own return racing over the same row -- and the first answer is the
 * true one.
 */
export async function endTaskRun(
  db: Database,
  runId: string,
  outcome: Exclude<TaskOutcome, "running">,
  detail: string,
): Promise<void> {
  await db
    .update(taskRuns)
    .set({ outcome, detail, endedAt: sql`now()` })
    .where(and(eq(taskRuns.id, runId), eq(taskRuns.outcome, "running")));
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
