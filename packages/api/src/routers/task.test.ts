import { env } from "@canoncore/env/server";
import { call, ORPCError, safe } from "@orpc/server";
import { describe, expect, it } from "vitest";

import { createContext } from "../context";
import { appRouter } from "./index";

/**
 * ADR-0049's registry as the owner's surface reaches it, at ADR-0103's second
 * seam -- the router called in the same process.
 *
 * EVERY PROCEDURE HERE IS THE OWNER'S, and that is not the reflex that
 * everything except a catalogue read is. ADR-0044 leaves the READ PATH open
 * because the demo shows a visitor everything in the catalogue; what
 * maintenance an instance runs, when it last ran and what broke are not in the
 * catalogue. `session.list` draws the line in the same place for the same
 * reason.
 */
const anyone = await createContext();

async function refusalOf(promise: Promise<unknown>): Promise<string> {
  const { error } = await safe(promise);
  if (!(error instanceof ORPCError)) throw new Error(`expected a refusal, got ${String(error)}`);
  return error.code;
}

describe("a caller with no session", () => {
  it("is refused the task list", async () => {
    // A LIST OF WHAT AN INSTANCE RUNS AND WHEN IT LAST FAILED, answered to
    // anybody, is a description of this machine's maintenance window handed to
    // whoever asks -- the same reasoning that closed the device list.
    expect(await refusalOf(call(appRouter.task.list, {}, { context: anyone }))).toBe(
      "UNAUTHORIZED",
    );
  });

  it("is refused running a task", async () => {
    // THE ONE THAT WOULD MATTER MOST. Running a task is work this instance does
    // on demand, and ADR-0049's list is full of expensive things -- a scan, a
    // re-refresh of every provider record. Open, it is a button anybody can
    // hold down.
    expect(
      await refusalOf(call(appRouter.task.run, { key: "sweep-sessions" }, { context: anyone })),
    ).toBe("UNAUTHORIZED");
  });

  it("is refused cancelling a task", async () => {
    expect(
      await refusalOf(call(appRouter.task.cancel, { key: "sweep-sessions" }, { context: anyone })),
    ).toBe("UNAUTHORIZED");
  });
});

const OWNER_PASSWORD = env.OWNER_PASSWORD;
if (OWNER_PASSWORD === undefined) {
  throw new Error("this suite's vitest.config.ts sets OWNER_PASSWORD, and it is not set");
}

const logInAs = async () => {
  const { token } = await call(
    appRouter.session.logIn,
    { password: OWNER_PASSWORD },
    { context: anyone },
  );
  return createContext({ sessionToken: token });
};

describe("the owner", () => {
  it("reads every task this instance runs, with its trigger", async () => {
    const listed = await call(appRouter.task.list, {}, { context: await logInAs() });

    // EVERY TASK, IN THE ORDER `theTasks` WAS WRITTEN IN, which `registry.list`
    // keeps rather than sorting. Asserting the whole list is what makes a task
    // added to that file and forgotten here fail rather than pass unseen -- and
    // the second of them is ADR-0049's own compaction, turned on the run history
    // this router publishes (CNCORE-124).
    //
    // THE HOUR IS NOT NAMED HERE, because what this surface owes is that the
    // trigger REACHES the caller rather than what it says. WHICH hours the
    // tasks keep is a rule about the maintenance window and the stagger, and
    // `packages/tasks` asserts it over the whole list as a rule (CNCORE-162);
    // restating it here would be the same decision pinned in a second place,
    // and moving a task an hour would redden a suite that has no stake in it.
    expect(listed).toMatchObject([
      {
        key: "sweep-sessions",
        name: "Remove sessions that can no longer answer",
        trigger: { kind: "daily", atHour: expect.any(Number) },
      },
      {
        key: "compact-task-runs",
        name: "Remove runs the history no longer shows",
        trigger: { kind: "daily", atHour: expect.any(Number) },
      },
    ]);
  });

  it("runs one by hand, and reads back what it did", async () => {
    const context = await logInAs();

    const run = await call(appRouter.task.run, { key: "sweep-sessions" }, { context });

    expect(run).toMatchObject({ outcome: "completed" });
    // AND THE LIST IS WHERE IT SHOWS UP, which is what the page re-reads after
    // the form post rather than trusting the answer above.
    const [task] = await call(appRouter.task.list, {}, { context });
    expect(task?.lastRun).toMatchObject({ outcome: "completed" });
  });

  it("is told which task is not a task, rather than given a fault", async () => {
    // A KEY COMES OFF A PAGE THAT IS A MOMENT OLD, so naming a task this build
    // no longer ships is an ordinary thing for a form post to do -- and the
    // answer the owner wants is a sentence, not a stack trace.
    expect(
      await refusalOf(
        call(appRouter.task.run, { key: "a-task-nobody-ships" }, { context: await logInAs() }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("is told plainly when there was nothing running to cancel", async () => {
    // THE ORDINARY RACE: the page said it was running, it finished, the owner
    // pressed Cancel. That is not a fault and the answer is the same either
    // way -- a list without it running on.
    expect(
      await call(appRouter.task.cancel, { key: "sweep-sessions" }, { context: await logInAs() }),
    ).toEqual({ cancelled: false });
  });
});

describe("the run history", () => {
  it("answers every run of one task, newest first", async () => {
    // THE RECORD ASKS FOR A HISTORY AND NOT A LAST OUTCOME. A sweep that failed
    // last night reads the same as one that has failed every night for a
    // fortnight, and those are a glitch and a broken machine.
    const context = await logInAs();
    await call(appRouter.task.run, { key: "sweep-sessions" }, { context });
    await call(appRouter.task.run, { key: "sweep-sessions" }, { context });

    const history = await call(appRouter.task.history, { key: "sweep-sessions" }, { context });

    expect(history.length).toBeGreaterThanOrEqual(2);
    const [newest, older] = history;
    if (!newest || !older) throw new Error("the history answered fewer runs than it was given");
    expect(newest.startedAt.getTime()).toBeGreaterThanOrEqual(older.startedAt.getTime());
    // EVERY RUN CARRIES ITS END, which the answer did not until review: a run
    // reading `completed` with no `ended_at` is the state the table's own check
    // refuses.
    expect(newest.endedAt).toBeInstanceOf(Date);
  });

  it("is refused to a caller with no session", async () => {
    expect(
      await refusalOf(call(appRouter.task.history, { key: "sweep-sessions" }, { context: anyone })),
    ).toBe("UNAUTHORIZED");
  });
});
