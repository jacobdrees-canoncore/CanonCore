import { describe, expect, it } from "vitest";
import { workflow } from "./testing/ci-workflow";

/**
 * Every CI job stops itself, at a ceiling set from how long it has actually
 * been measured to take (CNCORE-219, ADR-0141).
 *
 * Absent a `timeout-minutes`, GitHub gives a job 360 minutes. On 2026-09-19 two
 * suites on #138 hung with no output for 11, 23 and 30 minutes across three
 * runs, and nothing in the repository would have ended them before six hours:
 * each was cancelled by a person who happened to notice. A job that never exits
 * reports neither a pass nor a failure, which is the hole CNCORE-160, CNCORE-190
 * and CNCORE-197 closed from the other side.
 *
 * THERE IS NO WORKFLOW-WIDE DEFAULT TO SET INSTEAD. The top-level `defaults` key
 * takes `run.shell` and `run.working-directory` and nothing else (GitHub's
 * workflow syntax reference, read 2026-09-19), so each job carries its own and a
 * job added without one is back at six hours. This file is what says so.
 */

/**
 * Each job's SLOWEST SUCCESSFUL RUN, in seconds, which is the measurement its
 * ceiling is derived from.
 *
 * Read from the Actions API over every attempt of the 600 runs of `CI` created
 * 2026-09-11T18:52Z to 2026-09-19T15:50Z, as the job's own `started_at` to
 * `completed_at`. That span includes the wait between a job starting and its
 * first step, which reached two minutes once, so it is the larger of the two
 * readings. The query, and each job's median beside its slowest, are in
 * ADR-0141. A run after the window can be slower -- `typecheck` took 88 seconds
 * on this ticket's own pull request, 68 of them before its first step -- and
 * that is what the multiple below is for.
 *
 * RESTATED HERE RATHER THAN FETCHED, as `ci-workflow.test.ts` restates a
 * vendor's input list: the suite needs no network, and changing a ceiling
 * means changing its measurement, which means taking one.
 *
 * A NEW JOB HAS NO FIGURE UNTIL IT HAS RUN, and that is the order it happens
 * in: the job's first push fails here, CI runs the job anyway, and that run is
 * the first measurement. It still needs a provisional ceiling for that run, or
 * it is the one run in the file with six hours to hang in.
 */
const SLOWEST_SECONDS: Record<string, number> = {
  secrets: 52,
  docs: 41,
  typecheck: 58,
  lint: 84,
  build: 74,
  "env-guard": 83,
  test: 216,
  migrations: 114,
  e2e: 159,
  browser: 116,
  credentials: 4,
  provider: 166,
  contract: 73,
  // The amd64 leg, the slower of the matrix's two, on a cold build: one key
  // sets both.
  image: 413,
  "image-manifest": 64,
};

/**
 * THREE TIMES THE SLOWEST, because for every job whose median is over a minute
 * the slowest is already 1.4 to 2.7 times it: the spread a healthy runner
 * shows is inside the figure, and the rest is room for a suite to grow before
 * its ceiling needs measuring again. The image's is 3.6, and that one is a cold
 * build, which is the run a shorter window would have missed.
 */
const TIMES_THE_SLOWEST = 3;

/**
 * AND NEVER UNDER FIVE MINUTES, for the jobs whose own work is seconds. Two
 * costs land on a job whatever its work is: the wait before its first step,
 * measured at up to 113 seconds, and a setup spike, `pnpm/setup` taking up to 78
 * against its usual ten. Each lands on ONE job of a run at random, so a short
 * job's own sample may contain neither: tripled, `credentials`'s four seconds
 * would be one minute. Both together are about three minutes, and five covers
 * them on top of any floored job's median with a minute to spare. The floor
 * only ever raises a ceiling, and five minutes is still minutes.
 */
const FLOOR_MINUTES = 5;

function ceiling(slowestSeconds: number): number {
  return Math.max(FLOOR_MINUTES, Math.ceil((TIMES_THE_SLOWEST * slowestSeconds) / 60));
}

function jobs() {
  return Object.entries(workflow().jobs ?? {});
}

describe("a CI job that hangs", () => {
  it("is stopped by a timeout of its own rather than GitHub's six hours", () => {
    const untimed = jobs()
      .filter(([, job]) => {
        const minutes = job["timeout-minutes"];
        return !(Number.isInteger(minutes) && (minutes as number) > 0);
      })
      .map(([id]) => id);
    expect(untimed).toStrictEqual([]);
  });

  it("is stopped at three times its slowest measured run, not at a guess", () => {
    const underived = jobs().flatMap(([id, job]) => {
      const slowest = SLOWEST_SECONDS[id];
      if (slowest === undefined) {
        return [
          `the \`${id}\` job has no measured slowest run here. Give it a provisional ` +
            "ceiling generous enough to finish, push it, read its duration off that run, and " +
            "record it here; its ceiling is then derived from that figure.",
        ];
      }
      const minutes = job["timeout-minutes"];
      return minutes === ceiling(slowest)
        ? []
        : [
            `the \`${id}\` job stops at ${String(minutes)} minutes, and its slowest measured run ` +
              `of ${slowest}s puts its ceiling at ${ceiling(slowest)}. Measure it again rather ` +
              "than move the number on its own.",
          ];
    });
    expect(underived).toStrictEqual([]);
  });

  /*
   * The canary over the measurements. A figure for a job that has gone is one
   * the next job to take that id would inherit without ever having run.
   */
  it("is measured only where the job still exists", () => {
    const ids = jobs().map(([id]) => id);
    const stale = Object.keys(SLOWEST_SECONDS).filter((id) => !ids.includes(id));
    expect(stale).toStrictEqual([]);
  });
});
