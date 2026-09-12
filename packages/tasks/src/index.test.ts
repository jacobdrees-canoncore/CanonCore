import { type Database, sessions, startSession, taskRuns } from "@canoncore/db";
import { connect } from "@canoncore/db/testing/catalogue";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { createRegistry, dailyAt, type Task, taskRegistry } from "./index";

let db: Database;

beforeAll(async () => {
  db = await connect();
});

/**
 * A task standing in for a real one, at the package's own export (ADR-0103's
 * first seam).
 *
 * THE REGISTRY IS TESTED WITH TASKS THE TEST WROTE rather than with the one the
 * product ships, and that is the reason `createRegistry` takes its list instead
 * of reading it: two of the three outcomes this registry has to tell apart are
 * a task that BROKE and one that was STOPPED, and `sweepSessions` does neither
 * on demand. A suite that could only run the real task could asssert a third of
 * the behaviour.
 *
 * EVERY KEY IS THIS FILE'S OWN. The db suite shares one database, so two tests
 * sharing a key would read each other's history.
 */
function aTask(task: Partial<Task> & Pick<Task, "key">): Task {
  return {
    name: "A task",
    trigger: dailyAt(3),
    run: async () => "did something",
    ...task,
  };
}

describe("running a task by hand", () => {
  it("records what the task did, readable after the run is over", async () => {
    // THE WHOLE POINT OF THE REGISTRY, in one assertion: ADR-0049's minimum is
    // that last night's run is VISIBLE, and a run nobody can read afterwards is
    // the maintenance job that silently stopped months ago.
    const registry = createRegistry([
      aTask({ key: "recording", run: async () => "Removed 12 sessions" }),
    ]);

    const run = await registry.run(db, "recording");

    expect(await registry.history(db, "recording")).toMatchObject([
      { outcome: "completed", detail: "Removed 12 sessions" },
    ]);
    // AND THE ANSWER MATCHES THE ROW. A run answered as `completed` with no
    // `ended_at` is the one state the table's own check refuses -- running is
    // exactly "has not ended" -- so a caller handed that shape is holding
    // something the database would not have stored. Found in review, by both
    // axes independently: the answer was assembled from the OPENING row plus
    // the ending, and the opening row's `endedAt` is null.
    expect(run).toMatchObject({ outcome: "completed", detail: "Removed 12 sessions" });
    expect(run.endedAt).toBeInstanceOf(Date);
  });
});

describe("a task that breaks", () => {
  it("reads as failed, carrying what broke it", async () => {
    const registry = createRegistry([
      aTask({
        key: "breaking",
        run: async () => {
          throw new Error("the database went away");
        },
      }),
    ]);

    // IT DOES NOT THROW AT THE CALLER, and that is the decision rather than a
    // convenience. A task that breaks is REPORTED rather than raised: the
    // scheduler must survive it to run again tomorrow, and the surface that
    // ran it by hand reports by re-reading the history, where the failure now
    // is. Raising here would put the one fact ADR-0049 wants visible into a
    // stack trace instead.
    const run = await registry.run(db, "breaking");

    expect(run.outcome).toBe("failed");
    expect(await registry.history(db, "breaking")).toMatchObject([
      { outcome: "failed", detail: "the database went away" },
    ]);
  });
});

describe("what a break wrote", () => {
  it("is collapsed onto one line and cut at 300 characters", async () => {
    // NOTHING THAT REACHES THE HISTORY CHOSE ITS OWN LENGTH. A task answers a
    // sentence it wrote; what a task THROWS is written by whatever broke it --
    // Postgres quoting a statement back, zod listing an issue per bad field,
    // which ADR-0123 measured at 378,782 characters. This column is read onto
    // a page.
    //
    // 300 IS WRITTEN OUT rather than read off the export, for the reason
    // `sessions.test.ts` gives about thirty-one days: the constant asserting
    // itself would pass whatever it became, and 300 is ADR-0123's decision.
    const flood = Array.from({ length: 60 }, (_, line) => `line ${line} nobody bounded`).join("\n");
    const registry = createRegistry([
      aTask({
        key: "flooding",
        run: async () => {
          throw new Error(flood);
        },
      }),
    ]);

    await registry.run(db, "flooding");

    const [latest] = await registry.history(db, "flooding");
    expect(latest?.detail).toHaveLength(300);
    // COLLAPSED BEFORE IT IS CUT. A pretty-printed error spends the whole
    // allowance on its own indentation and hands the reader a stack of braces,
    // which is the correction ADR-0123 records against itself.
    expect(latest?.detail).not.toContain("\n");
  });
});

/** A task that reports when it has started and then waits to be stopped. */
function aTaskThatWaits(key: string): { task: Task; started: Promise<void> } {
  let announce: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    announce = resolve;
  });
  return {
    started,
    task: aTask({
      key,
      run: ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
          announce();
        }),
    }),
  };
}

describe("cancelling a task that is running", () => {
  it("reads as aborted, which is not the same answer as failed", async () => {
    // ADR-0049's OWN INSTRUCTION, and the reason it names Jellyfin's shape: a
    // job that was KILLED and a job that BROKE need different answers. An owner
    // who stopped last night's sweep is reading their own decision back; an
    // owner whose sweep threw is reading an incident. One value for both would
    // put a fortnight of deliberate cancellations in front of them as failures.
    //
    // AND THE OWNER STOPPING IT IS NOT THE SERVER DYING UNDER IT, which is the
    // third value `verify-adr-jellyfin.md` §34 says is the one worth copying:
    // Jellyfin ships `Cancelled` ("manually cancelled by the user") apart from
    // `Aborted` ("due to a system failure or shutdown"), and this record's own
    // argument reaches it -- a job the owner stopped and a job the machine
    // stopped are different answers too.
    const { task, started } = aTaskThatWaits("cancelling");
    const registry = createRegistry([task]);

    const running = registry.run(db, "cancelling");
    await started;
    registry.cancel("cancelling");

    expect((await running).outcome).toBe("cancelled");
    expect(await registry.history(db, "cancelling")).toMatchObject([{ outcome: "cancelled" }]);
  });
});

describe("listing what this instance runs", () => {
  it("answers each task with its last run, and says when there has not been one", async () => {
    const registry = createRegistry([
      aTask({ key: "listed-untouched", name: "Never asked to run" }),
      aTask({ key: "listed-once", name: "Run once", run: async () => "did the thing" }),
    ]);

    await registry.run(db, "listed-once");

    expect(await registry.list(db)).toMatchObject([
      {
        key: "listed-untouched",
        name: "Never asked to run",
        trigger: { kind: "daily", atHour: 3 },
        // NEVER RUN IS NOT "RAN AND DID NOTHING", and the page has to be able to
        // say which. A zero-shaped last run would read as a sweep that found
        // nothing last night on an instance where the sweep has never once
        // fired -- which is precisely the silent stoppage ADR-0049 exists to
        // make visible, reported as health.
        lastRun: null,
      },
      {
        key: "listed-once",
        name: "Run once",
        lastRun: { outcome: "completed", detail: "did the thing" },
      },
    ]);
  });
});

describe("a task that is already running", () => {
  it("is refused a second run rather than started twice", async () => {
    // NOT A THEORETICAL RACE. The scheduler fires a task on its trigger and the
    // owner runs one from a page, so the two meet the first night an owner
    // presses Run at three in the morning -- and two sweeps deleting the same
    // rows is the tamest thing in ADR-0049's list of eight to do it twice at
    // once.
    const { task, started } = aTaskThatWaits("overlapping");
    const registry = createRegistry([task]);

    const first = registry.run(db, "overlapping");
    await started;

    // THE REASON IS PART OF THE REFUSAL, because the two ways a run is turned
    // away are different facts and a surface has to answer them differently: a
    // key this build no longer ships is a stale page, and a task already
    // running is the owner pressing Run twice. One answer for both tells the
    // second owner their task does not exist.
    await expect(registry.run(db, "overlapping")).rejects.toMatchObject({
      reason: "already running",
    });
    await expect(registry.run(db, "a-task-nobody-ships")).rejects.toMatchObject({
      reason: "no such task",
    });

    // AND THE REFUSAL LEAVES NO ROW. A second run that wrote a history entry
    // before being turned away would put a run in the history that never ran.
    registry.cancel("overlapping");
    await first;
    expect(await registry.history(db, "overlapping")).toHaveLength(1);
  });
});

describe("a run whose process went away", () => {
  it("is closed as aborted when the registry next starts, not left reading as running", async () => {
    // THE ROW OUTLIVES THE PROCESS AND THE CONTROLLER DOES NOT. A run lives in
    // one process's memory -- that is where the `AbortController` is -- so a
    // row still reading `running` after a restart is a run nothing will ever
    // write the ending of. Left alone it reads as a sweep that has been going
    // for a fortnight, which is a worse lie than either ending it could have
    // had, and it is the exact shape of the silent stoppage ADR-0049 exists to
    // surface.
    const { task, started } = aTaskThatWaits("orphaned");
    const killed = createRegistry([task]);
    const inFlight = killed.run(db, "orphaned");
    await started;

    // The process came back, with nothing of the old one in it.
    const restarted = createRegistry([task]);
    await restarted.closeRunsLeftOpen(db);

    expect(await restarted.history(db, "orphaned")).toMatchObject([
      { outcome: "aborted", endedAt: expect.any(Date) },
    ]);

    // AND THE OLD RUN CANNOT REOPEN IT. The killed process is a fiction here --
    // it is still running in this test -- so its own ending arrives after the
    // restart has already had the last word, and `endTaskRun` refuses it.
    killed.cancel("orphaned");
    await inFlight;
    expect(await restarted.history(db, "orphaned")).toMatchObject([{ outcome: "aborted" }]);
  });
});

describe("the dead-session sweep", () => {
  /**
   * A row's age, written into the row rather than faked on the clock, for the
   * reason `sessions.test.ts` gives: the lifetime is measured against
   * POSTGRES'S clock, and stubbing `Date` moves the only clock the policy does
   * not consult.
   */
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  it("runs from the registry, and reports what it removed", async () => {
    // THE CRITERION THIS TICKET TURNS ON. `sweepSessions` has existed since
    // CNCORE-116 and was called by NOTHING -- an operation waiting for a
    // runner. This asserts the runner reaches it, which is what makes the
    // registry carry a real task rather than a demonstration.
    const registry = taskRegistry();
    // Whatever earlier rows this shared database holds, swept first, so the
    // count below is this test's own session and not a tally of the suite.
    await registry.run(db, "sweep-sessions");

    const { session } = await startSession(db, { deviceName: "A laptop sold last month" });
    await db
      .update(sessions)
      .set({ createdAt: daysAgo(31) })
      .where(eq(sessions.id, session.id));

    const run = await registry.run(db, "sweep-sessions");

    // THIRTY-ONE DAYS IS THE DECISION WRITTEN DOWN, not arithmetic on the
    // exported limit, so widening the window fails this rather than passing
    // whatever it became.
    expect(run).toMatchObject({ outcome: "completed", detail: "Removed 1 session." });
  });

  it("is on the list an owner reads, named and triggered", async () => {
    // BOTH TASKS, IN THE ORDER THIS REPOSITORY WROTE THEM DOWN, which is the
    // order `/tasks` renders and the order `registry.list` keeps on purpose.
    // Asserting the whole list rather than one entry is what makes a task added
    // to `theTasks` and forgotten here fail rather than pass unnoticed.
    //
    // AND EACH WITH ITS OWN TRIGGER. Two tasks at one instant would be two jobs
    // competing for one small machine at no benefit, and a page that could not
    // tell an owner which hour either runs at would leave them unable to tell a
    // job that is not due from one that has stopped.
    expect(await taskRegistry().list(db)).toMatchObject([
      {
        key: "sweep-sessions",
        name: "Remove sessions that can no longer answer",
        trigger: { kind: "daily", atHour: 3 },
      },
      {
        key: "compact-task-runs",
        name: "Remove runs the history no longer shows",
        trigger: { kind: "daily", atHour: 4 },
      },
    ]);
  });
});

describe("the run-history compaction", () => {
  /**
   * A run's age, written into the row rather than faked on the clock, for the
   * reason `task-runs.test.ts` gives at greater length: the window is measured
   * against POSTGRES'S clock, and stubbing `Date` moves the only clock the
   * policy never consults.
   */
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  it("runs from the registry, and reports what it removed", async () => {
    // ADR-0049's OWN CATEGORY, ARRIVING BACK AT ITS OWN TABLE. That record
    // lists tombstone compaction among the eight things its registry exists to
    // run, and `task_runs` is a table that only grew: a daily task writes 365
    // rows a year and nothing removed one. This asserts the registry reaches
    // the operation -- which is what makes the second task the shape the
    // registry is FOR rather than another demonstration of it.
    const registry = taskRegistry();
    // Compacted first, so the count below is this test's own fixture rather
    // than a tally of what the tests above happened to leave lying around.
    await registry.run(db, "compact-task-runs");

    // A TASK WITH A HISTORY BEHIND IT. Two runs, because the newer one is what
    // makes the older one compactable at all -- a key's last run never goes.
    const watched = createRegistry([aTask({ key: "compacted", run: async () => "did something" })]);
    const stale = await watched.run(db, "compacted");
    await watched.run(db, "compacted");
    await db
      .update(taskRuns)
      .set({ startedAt: daysAgo(31) })
      .where(eq(taskRuns.id, stale.id));

    const run = await registry.run(db, "compact-task-runs");

    // THIRTY-ONE DAYS IS THE DECISION WRITTEN DOWN, not arithmetic on the
    // exported window, so widening it fails this rather than passing whatever
    // it became.
    expect(run).toMatchObject({ outcome: "completed", detail: "Removed 1 run." });
  });
});
