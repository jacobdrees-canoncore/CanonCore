import { type Database, RUN_HISTORY_DEPTH, sessions, startSession } from "@canoncore/db";
import { connect } from "@canoncore/db/testing/catalogue";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { createRegistry, dailyAt, type Task, taskRegistry, theTasks } from "./index";

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

  /**
   * CUT ON A WHOLE CHARACTER (CNCORE-272).
   *
   * `slice` counts UTF-16 units, so a cut landing between the two halves of an
   * astral character leaves a lone surrogate -- a replacement glyph in the
   * sentence the history shows the Owner.
   *
   * THE ASSERTION OUTLIVED THE COPY IT GUARDED, WHICH IS WHY IT STAYS. This was
   * written by hand beside a hand-written cut, because ADR-0123 kept the shared
   * one out of this package's reach; ADR-0163 moved the levers to
   * `@canoncore/text`, a leaf depending on nothing, and `bounded` now reaches
   * them in one call. What this asserts is the BEHAVIOUR the registry owes its
   * reader, which is the registry's to keep whoever implements it -- and it is
   * the witness that would go red the day this package is pointed at something
   * that cuts differently.
   */
  it("cuts on a whole character when an astral one straddles the boundary", async () => {
    // 300 written out as above, so the constant cannot assert itself. The marker
    // takes the last of them, so the cut falls at unit 299; a U+1F600 opening at
    // unit 298 therefore has one half on each side of it.
    const straddling = `${"a".repeat(298)}\u{1F600}${"b".repeat(10)}`;
    const registry = createRegistry([
      aTask({
        key: "straddling",
        run: async () => {
          throw new Error(straddling);
        },
      }),
    ]);

    await registry.run(db, "straddling");

    const [latest] = await registry.history(db, "straddling");
    // NOT `isWellFormed`, WHICH PASSES HERE WHATEVER HAPPENS. The column is
    // UTF-8 and a lone surrogate has no encoding in it, so the round trip
    // through Postgres turns one into U+FFFD -- well-formed, permanent, and the
    // replacement glyph the guard exists to keep off the page. Measured: this
    // assertion read `...aaa\ufffd\u2026` before the cut was fixed.
    expect(latest?.detail).not.toContain("\ufffd");
    expect(latest?.detail).toBe(`${"a".repeat(298)}\u2026`);
  });

  /**
   * A TASK CHOOSES WHAT ITS TEXT DOES TO THE PAGE, NOT ONLY HOW MUCH OF IT
   * THERE IS (CNCORE-274, ADR-0123).
   *
   * The cut answers the length lever and does nothing about a bidirectional
   * override, which re-orders the glyphs around itself -- so a detail can run
   * backwards through the sentence `tasks/page.tsx` wrote about it. Neither
   * family is whitespace, so collapsing `\s+` never touched them.
   *
   * ASSERTED HERE BECAUSE THE PAGE IS HERE. This was a second hand-written
   * copy of a second property until ADR-0163 moved both levers to
   * `@canoncore/text`; what survives the move is the claim that a DETAIL
   * reaching `tasks/page.tsx` carries neither family, which is this package's
   * to make about its own column whatever applies them.
   */
  it.each([
    ["\u202e", "a right-to-left override"],
    ["\u2066", "a directional isolate"],
    ["\u200b", "a zero-width space"],
    ["\ufeff", "a zero-width no-break space"],
  ])("strips %j from what a task threw, which is %s", async (control, _what) => {
    const key = `rewriting_${control.charCodeAt(0)}`;
    const registry = createRegistry([
      aTask({
        key,
        run: async () => {
          throw new Error(`before${control}after`);
        },
      }),
    ]);

    await registry.run(db, key);

    const [latest] = await registry.history(db, key);
    expect(latest?.detail).toBe("beforeafter");
  });

  /**
   * THE STRIP TAKING THE WHOLE DETAIL (ADR-0179). The witnesses above prove the
   * controls come out of a detail with glyphs either side of them. A detail
   * made of NOTHING BUT them bounds to the empty string, and `tasks/page.tsx`
   * renders it as `{said} Ran {when}.` -- a run whose history opens with a bare
   * space and says nothing about what happened.
   *
   * `?? "It said nothing."` DOES NOT CATCH IT, which is the reason this needs
   * words rather than a null. That fallback tests for NULL, and this detail is
   * a non-null empty string; it would also be the wrong sentence, because a
   * task that threw a message of zero-width spaces did not say nothing, it
   * said something nobody can show. CNCORE-92's rule is that the two do not
   * merge.
   *
   * A WHOLE SENTENCE, NOT A QUOTED NOUN, which is what separates this caller
   * from the four that reach `quotedTo`. A detail IS the sentence the page
   * prints, so it takes a capital and a full stop -- `unshowable` exists for
   * exactly this, and the PHRASE is still the shared one.
   */
  /**
   * A TASK THAT SAID NOTHING SAID NOTHING (ADR-0179). `task.run` answers a
   * string and "" is one a working task may return, so answering it with "A
   * detail made only of characters that cannot be shown." would state that
   * something was stripped when nothing was -- the conflation this record
   * refuses, committed by its own remedy. `tasks/page.tsx`'s "It said nothing."
   * is the sentence for this, and it is reached by the column staying empty.
   */
  it("leaves a task that said nothing saying nothing, rather than claiming a strip", async () => {
    const key = "said_nothing_at_all";
    const registry = createRegistry([aTask({ key, run: async () => "" })]);

    await registry.run(db, key);

    const [latest] = await registry.history(db, key);
    expect(latest?.detail).toBe("");
  });

  it("says a detail was made only of unshowable characters, rather than storing nothing", async () => {
    const key = "rewriting_only_controls";
    const registry = createRegistry([
      aTask({
        key,
        run: async () => {
          throw new Error("\u200b\u200b\u200b");
        },
      }),
    ]);

    await registry.run(db, key);

    const [latest] = await registry.history(db, key);
    expect(latest?.detail).toBe("A detail made only of characters that cannot be shown.");
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

/**
 * A database that refuses the write that opens a run, standing in for one that
 * is gone.
 *
 * THE FAILURE HAS TO COME FROM OUTSIDE THE TASK, which is the whole of what
 * this stand-in is for. Every other way a run can end is something the task
 * did, and `endingOf` writes all of those into the history; this one happens
 * BEFORE there is a history row to write into, so nothing records it and the
 * only evidence is what the registry is left holding.
 */
const aDatabaseThatRefusesToOpenARun = {
  insert() {
    throw new Error("the database went away");
  },
} as unknown as Database;

describe("a run that cannot be opened", () => {
  it("leaves the key free rather than marked running for the rest of the process", async () => {
    // THE KEY IS MARKED BEFORE THE ROW IS OPENED, WHICH IT HAS TO BE. The
    // refusal of a second run reads a map and opening the row is an `await`, so
    // a mark made after that write would let two runs past the check before
    // either was marked. What that ordering costs is this case: the opening
    // write is also the first thing here that can fail, and the mark sat
    // outside the `finally` that clears it.
    //
    // AND WHAT IT LEAVES IS PERMANENT, which is what makes it worth a test
    // rather than a comment. That map is this process's own memory, so nothing
    // clears the key until the process restarts -- every later run of the task,
    // tonight's and every night after, is refused as already running, and an
    // owner pressing Run reads a conflict over a task that is not running at
    // all. At three in the morning, which is when these run.
    const registry = createRegistry([
      aTask({ key: "unopenable", run: async () => "did something" }),
    ]);

    await expect(registry.run(aDatabaseThatRefusesToOpenARun, "unopenable")).rejects.toThrow(
      "the database went away",
    );

    // A RUN RATHER THAN A REFUSAL, and the difference is the defect: this is
    // the registry saying the task is free to run, where it used to say the
    // task was already running.
    expect(await registry.run(db, "unopenable")).toMatchObject({ outcome: "completed" });
  });
});

describe("two tasks declaring one key", () => {
  it("is refused when the registry is built, not resolved silently", () => {
    // THE KEY IS THE IDENTITY OF A TASK AND NOT A LABEL ON ONE. The history is
    // keyed by it, the page's Run and Cancel buttons carry it, and the map that
    // holds the live runs is keyed by it -- so two tasks under one key is two
    // tasks the product cannot tell apart anywhere it matters. Both would
    // render, both would show the same last run, and only whichever the map
    // kept could be run or cancelled at all; the other is a row on the page
    // that does nothing.
    //
    // AT CONSTRUCTION, THE WAY A BAD HOUR IS. `dailyAt` refuses hour 24 where
    // it is written rather than at the firing that never comes, and this is the
    // same fault one level up: a list that cannot be honoured, caught where the
    // list is declared. Anything later is a defect nobody sees until an owner
    // presses a button and nothing happens.
    expect(() =>
      createRegistry([
        aTask({ key: "one-key", name: "The one that would be kept" }),
        aTask({ key: "one-key", name: "The one that would be lost" }),
      ]),
    ).toThrow(/one-key/);
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

  it("is on the list an owner reads, named and in the order this repository wrote it", async () => {
    // BOTH TASKS, IN THE ORDER THIS REPOSITORY WROTE THEM DOWN, which is the
    // order `/tasks` renders and the order `registry.list` keeps on purpose.
    // Asserting the whole list rather than one entry is what makes a task added
    // to `theTasks` and forgotten here fail rather than pass unnoticed.
    //
    // WHEN EACH OF THEM FIRES IS ASSERTED BELOW, as a rule over the list rather
    // than as the two hours these two happen to carry.
    expect(await taskRegistry().list(db)).toMatchObject([
      { key: "sweep-sessions", name: "Remove sessions that can no longer answer" },
      { key: "compact-task-runs", name: "Remove runs the history no longer shows" },
    ]);
  });
});

describe("the run-history compaction", () => {
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

    // ONE RUN MORE THAN THE PAGE CAN SHOW, which is the only thing that makes
    // anything compactable: retention is a DEPTH IN ROWS, so no amount of age
    // would have made this fixture removable and an earlier version of this
    // test that aged a row thirty-one days proved nothing once the rule was
    // corrected. The oldest of these falls off the end; the rest are what
    // `/tasks` would still render.
    const watched = createRegistry([aTask({ key: "compacted", run: async () => "did something" })]);
    for (let made = 0; made < RUN_HISTORY_DEPTH + 1; made++) {
      await watched.run(db, "compacted");
    }

    const run = await registry.run(db, "compact-task-runs");

    expect(run).toMatchObject({ outcome: "completed", detail: "Removed 1 run." });
  });
});

describe("when the tasks this instance runs are due", () => {
  it("is inside the maintenance window, and no two of them at one hour", () => {
    // A RULE OVER THE LIST RATHER THAN THE HOURS THESE TWO HAPPEN TO CARRY.
    // The list assertion above pins both hours, so a third task does not slip
    // past it -- it breaks it, `toMatchObject` refusing a received list longer
    // than the one it was given. But the ordinary answer to that failure is to
    // update the literal, and nothing in that loop mentions a window or a
    // stagger: `atHour: 12` goes green exactly as readily as `atHour: 5`. A
    // rule guarded only by a literal the newcomer is expected to edit is not
    // guarded, so the rule is what is asserted here.
    //
    // THE WINDOW IS PLEX'S 3am-6am, which ADR-0049 takes and for the reason it
    // gives: the small hours are when nobody is reading, and that is a fact
    // about where the owner lives rather than about Greenwich. Six is where the
    // window CLOSES -- Plex's setting is the hour maintenance "should start and
    // end" -- so a daily trigger, which pins only the start, has to be before
    // it. Both numbers are written out rather than read off an export, for the
    // reason `sessions.test.ts` gives about thirty-one days: a constant
    // asserting itself passes whatever it becomes.
    const outsideTheWindow = theTasks.filter(
      ({ trigger }) => trigger.atHour < 3 || trigger.atHour >= 6,
    );
    expect(outsideTheWindow.map((task) => task.key)).toStrictEqual([]);

    // AND STAGGERED, WHICH IS THE OTHER HALF. Two tasks at one instant are two
    // jobs competing for one small machine at no benefit, on a schedule this
    // repository is free to choose -- `compact-task-runs.ts` says exactly that
    // about the hour it picked, and nothing was holding it to it.
    const hours = theTasks.map((task) => task.trigger.atHour);
    expect(hours.filter((hour, at) => hours.indexOf(hour) !== at)).toStrictEqual([]);

    // A STAGGER IS A CLAIM ABOUT MORE THAN ONE TASK, and an emptied list would
    // satisfy both assertions above by having nothing in it to break.
    expect(hours.length).toBeGreaterThan(1);
  });
});
