import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  compactTaskRuns,
  type Database,
  endTaskRun,
  RUN_HISTORY_DEPTH,
  readTaskRuns,
  startTaskRun,
} from "./index";
import { taskRuns } from "./schema";
import { connect } from "./testing/catalogue";

let db: Database;

beforeAll(async () => {
  db = await connect();
});

/**
 * A finished run of one task, which is what history is made of.
 *
 * EVERY KEY IS THIS FILE'S OWN. Compaction reads the whole table rather than
 * one task's rows, so two tests sharing a key would each be compacting the
 * other's fixture.
 */
async function aFinishedRun(taskKey: string, detail: string) {
  const run = await startTaskRun(db, taskKey);
  return endTaskRun(db, run.id, "completed", detail);
}

/**
 * A run's age, written into the row rather than faked on the clock.
 *
 * BECAUSE THE CLOCK THE WINDOW IS MEASURED AGAINST IS POSTGRES'S, which is the
 * reason `sessions.test.ts` gives for the same helper: `started_at` defaults to
 * the database's `now()`, and ADR-0043 measured this process's clock running
 * 60ms BEHIND it on this machine. A test that stubbed `Date` would move the one
 * clock the policy never consults.
 *
 * THE AGES PASSED TO IT ARE LITERALS rather than arithmetic on any constant.
 * Age is what this file has to prove compaction does NOT consult, so an age
 * computed from the policy would be the policy asserting itself; sixty days is
 * written down, and it is a number no rule here is allowed to care about.
 */
async function aged(runId: string, days: number) {
  await db
    .update(taskRuns)
    .set({ startedAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) })
    .where(eq(taskRuns.id, runId));
}

describe("compacting the run history", () => {
  it("keeps the runs the page can show and removes the ones behind them", async () => {
    // WHAT COMPACTION KEEPS IS WHAT THE PRODUCT CAN READ, exactly. `readTaskRuns`
    // answers the newest `RUN_HISTORY_DEPTH` of a task's runs and `/tasks`
    // renders what it answers, so a run behind that depth is one no surface in
    // this app can reach. Both sides take the same constant and the same order,
    // which is what makes this a boundary rather than two policies that happen
    // to agree today.
    const runs = [];
    for (let made = 0; made < RUN_HISTORY_DEPTH + 2; made++) {
      runs.push(await aFinishedRun("compacting", `run ${made}`));
    }

    expect(await compactTaskRuns(db)).toBe(2);

    const kept = await readTaskRuns(db, "compacting", RUN_HISTORY_DEPTH + 2);
    expect(kept).toHaveLength(RUN_HISTORY_DEPTH);
    // THE OLDEST TWO WENT AND THE NEWEST STAYED, rather than some thirty of
    // them: a count alone would pass an implementation that kept the wrong end.
    expect(kept.at(0)?.id).toBe(runs.at(-1)?.id);
    // THE TWO OLDEST WENT, so the oldest survivor is the third run made.
    expect(kept.at(-1)?.id).toBe(runs.at(2)?.id);
  });
});

describe("a task that stopped months ago", () => {
  it("keeps every run the page would still show, however old they all are", async () => {
    // AGE IS NOT WHAT MAKES A RUN UNREADABLE, and an earlier version of this
    // compaction got that wrong. It took rows past a thirty-DAY window, on the
    // reasoning that the page shows thirty runs and thirty runs is a month --
    // which is true only for a task that runs exactly daily. A task an owner
    // ran six times across two months has all six on the page, and that window
    // deleted four of them: history the product was still displaying, removed
    // by the maintenance meant to remove only what nothing could read.
    //
    // AND THE STOPPAGE IS THE CASE THAT MATTERS, because ADR-0049 exists for it:
    // "a recurring job whose result nobody can see is one that silently stopped
    // months ago". Every run of this task is older than any window anybody would
    // pick, and all of them are still the answer to "what did it do before it
    // stopped".
    const stopped = [];
    for (const daysOld of [62, 61, 60]) {
      const run = await aFinishedRun("stopped-long-ago", `a night ${daysOld} days back`);
      await aged(run.id, daysOld);
      stopped.push(run);
    }

    expect(await compactTaskRuns(db)).toBe(0);

    expect(await readTaskRuns(db, "stopped-long-ago", RUN_HISTORY_DEPTH)).toHaveLength(
      stopped.length,
    );
  });
});
