import type { Database } from "@canoncore/db";
import { connect } from "@canoncore/db/testing/catalogue";
import { beforeAll, describe, expect, it } from "vitest";

import { createRegistry, dailyAt, type Task } from "./index";

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

    await registry.run(db, "recording");

    expect(await registry.history(db, "recording")).toMatchObject([
      { outcome: "completed", detail: "Removed 12 sessions" },
    ]);
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
    const { task, started } = aTaskThatWaits("cancelling");
    const registry = createRegistry([task]);

    const running = registry.run(db, "cancelling");
    await started;
    registry.cancel("cancelling");

    expect((await running).outcome).toBe("aborted");
    expect(await registry.history(db, "cancelling")).toMatchObject([{ outcome: "aborted" }]);
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
