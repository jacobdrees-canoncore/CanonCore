import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  compactTaskRuns,
  type Database,
  endTaskRun,
  readLatestTaskRuns,
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
 * THE AGES PASSED TO IT ARE LITERALS rather than arithmetic on the exported
 * window. "One day past `RUN_HISTORY_RETENTION_SECONDS`" would pass whatever
 * that constant became, which is the policy asserting itself; thirty-one days
 * is the decision written down, and it fails if somebody widens the window.
 */
async function aged(runId: string, days: number) {
  await db
    .update(taskRuns)
    .set({ startedAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) })
    .where(eq(taskRuns.id, runId));
}

describe("compacting the run history", () => {
  it("removes the runs past the window and leaves the ones inside it", async () => {
    // THE TABLE ADR-0049's OWN CATEGORY ARRIVES BACK AT. A task on a daily
    // trigger writes 365 rows a year and nothing removed any of them, which is
    // the tombstone compaction that record schedules, owed to its own history.
    const stale = await aFinishedRun("compacting", "a run nothing can reach");
    await aged(stale.id, 31);
    const yesterday = await aFinishedRun("compacting", "a run the page still shows");

    expect(await compactTaskRuns(db)).toBe(1);

    expect(await readTaskRuns(db, "compacting", 30)).toMatchObject([
      { id: yesterday.id, detail: "a run the page still shows" },
    ]);
  });
});

describe("a task that stopped months ago", () => {
  it("keeps the last thing it did, however far past the window that is", async () => {
    // THE ONE THING COMPACTION MUST NOT DO, and the reason ADR-0049 exists at
    // all: "a recurring job whose result nobody can see is one that silently
    // stopped months ago" is that record's own sentence. A window applied
    // without this takes every row of a task that stopped in July, and
    // `readLatestTaskRuns` then answers nothing for it -- which `/tasks`
    // renders as "Has not run yet". The compaction written to serve that record
    // would be manufacturing the exact lie it was built to expose, and would
    // erase the evidence of the stoppage in the act of doing it.
    const earlier = await aFinishedRun("stopped-long-ago", "a night further back still");
    await aged(earlier.id, 61);
    const lastWorking = await aFinishedRun("stopped-long-ago", "the last night it ran");
    await aged(lastWorking.id, 60);

    await compactTaskRuns(db);

    const latest = await readLatestTaskRuns(db, ["stopped-long-ago"]);
    expect(latest.get("stopped-long-ago")).toMatchObject({
      id: lastWorking.id,
      detail: "the last night it ran",
    });
    // AND ONLY THE LAST ONE. Keeping the newest is not keeping the task exempt:
    // everything behind it still goes, or a task that stopped would be the one
    // task whose history grew forever.
    expect(await readTaskRuns(db, "stopped-long-ago", 30)).toHaveLength(1);
  });
});
