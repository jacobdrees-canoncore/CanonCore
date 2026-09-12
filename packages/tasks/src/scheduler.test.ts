import type { Database } from "@canoncore/db";
import { connect } from "@canoncore/db/testing/catalogue";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createRegistry, dailyAt } from "./index";
import { nextFiring, startScheduler } from "./scheduler";

/**
 * WHEN A TRIGGER NEXT FIRES, decided without a timer (ADR-0103's first seam).
 *
 * THE DATES ARE BUILT IN LOCAL TIME, by the constructor that takes parts, so
 * these assertions say the same thing on a machine in London and one in
 * Auckland. A daily trigger fires at the owner's three in the morning rather
 * than at Greenwich's, because "when nobody is reading" is a fact about where
 * the owner lives -- so a test written in UTC would be asserting the wrong
 * clock as well as failing outside one zone.
 */
describe("when a daily trigger next fires", () => {
  it("fires today when the hour is still ahead", () => {
    expect(nextFiring(dailyAt(3), new Date(2026, 8, 12, 1, 30))).toEqual(
      new Date(2026, 8, 12, 3, 0, 0, 0),
    );
  });

  it("fires tomorrow when the hour has gone by", () => {
    // THE CASE A SERVER RESTART MAKES ORDINARY. A container that comes back at
    // ten in the morning must not decide that three o'clock is a moment in the
    // past and fire immediately -- ADR-0049 refuses the hidden timer, and a
    // sweep that runs on every deploy is one.
    expect(nextFiring(dailyAt(3), new Date(2026, 8, 12, 10, 0))).toEqual(
      new Date(2026, 8, 13, 3, 0, 0, 0),
    );
  });

  it("fires tomorrow when the hour is exactly now", () => {
    // ON the boundary rather than either side of it, because a run that has
    // just fired must schedule the NEXT one rather than itself again: `>=`
    // against `>` here is the difference between a daily task and a loop.
    expect(nextFiring(dailyAt(3), new Date(2026, 8, 12, 3, 0, 0, 0))).toEqual(
      new Date(2026, 8, 13, 3, 0, 0, 0),
    );
  });

  it("rolls into the next month at the end of one", () => {
    // 30 September, so tomorrow is a different month AND a different number of
    // days from the last one. Hand-rolled date arithmetic is where this breaks.
    expect(nextFiring(dailyAt(3), new Date(2026, 8, 30, 23, 0))).toEqual(
      new Date(2026, 9, 1, 3, 0, 0, 0),
    );
  });
});

let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("the scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires a task on its trigger, and again the night after", async () => {
    // WHAT MAKES THE TRIGGER A TRIGGER. Without this the registry is a button,
    // and "last night's run" -- ADR-0049's stated minimum -- never exists to be
    // read, because no night ever had one.
    vi.useFakeTimers({ now: new Date(2026, 8, 12, 2, 0) });
    let fired = 0;
    const registry = createRegistry([
      {
        key: "scheduled",
        name: "A task on a trigger",
        trigger: dailyAt(3),
        run: async () => {
          fired += 1;
          return "fired";
        },
      },
    ]);

    const stop = await startScheduler(registry, db);
    try {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      // WAITED FOR RATHER THAN ASSERTED IMMEDIATELY. Advancing a fake clock
      // runs the timer, but the run it starts opens a row in a real database --
      // socket I/O, which no amount of fake time completes. `vi.waitFor`
      // advances the fake clock in small steps while the real round trip
      // lands, and its second is far short of the 24 hours to the next firing.
      await vi.waitFor(() => {
        expect(fired).toBe(1);
      });

      // THE SECOND FIRING IS THE HALF THAT ROTS QUIETLY. A scheduler that sets
      // one timer and never sets another works for exactly one night and then
      // looks, from the outside, like a task nobody has needed -- which is this
      // record's own description of the failure it exists to prevent.
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      await vi.waitFor(() => {
        expect(fired).toBe(2);
      });
    } finally {
      stop();
    }
  });

  it("stops firing once it is stopped", async () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 12, 2, 0) });
    let fired = 0;
    const registry = createRegistry([
      {
        key: "stoppable",
        name: "A task on a trigger",
        trigger: dailyAt(3),
        run: async () => {
          fired += 1;
          return "fired";
        },
      },
    ]);

    const stop = await startScheduler(registry, db);
    stop();

    await vi.advanceTimersByTimeAsync(48 * 60 * 60 * 1000);
    expect(fired).toBe(0);
  });
});

describe("what the scheduler does before it arms anything", () => {
  it("closes the runs a process that is gone left open", async () => {
    // ON REAL TIMERS, because nothing here is waiting for an hour to arrive:
    // the assertion is about what starting the scheduler does at once, and the
    // trigger it arms on the way past is cleared by `stop`.
    let announce: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      announce = resolve;
    });
    const waiting = {
      key: "left-open-at-start",
      name: "A task the server died under",
      trigger: dailyAt(3),
      run: ({ signal }: { signal: AbortSignal }) =>
        new Promise<string>((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
          announce();
        }),
    };

    const killed = createRegistry([waiting]);
    const inFlight = killed.run(db, "left-open-at-start");
    await started;

    // The process came back and the scheduler started in it.
    const restarted = createRegistry([waiting]);
    const stop = await startScheduler(restarted, db);
    stop();

    expect(await restarted.history(db, "left-open-at-start")).toMatchObject([
      { outcome: "aborted" },
    ]);

    killed.cancel("left-open-at-start");
    await inFlight;
  });
});
