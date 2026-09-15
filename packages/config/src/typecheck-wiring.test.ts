import { describe, expect, it } from "vitest";
import { type PlannedTask, plannedTasks, willRun } from "./testing/turbo-dry-run";
import { packageDirectories } from "./testing/workspace";

/**
 * A test that holds every package in this repository to being TYPECHECKED, for
 * the reason `network-gate-wiring.test.ts` holds every one of them to running a
 * gated suite: the Typecheck job asserts the COUNT turbo printed, and a count is
 * not a roll call.
 *
 * `run-suite.sh` catches the count reaching ZERO -- `pnpm typecheck` running no
 * task at all, which is what a deleted root script or a task nobody declares
 * gives. `typecheck` is declared by ELEVEN packages, so one of them dropping its
 * script leaves ten running, the count stays non-zero, and the job goes green
 * having typechecked one package fewer than it thinks (CNCORE-197). That is the
 * half CNCORE-190 named and deliberately did not build.
 *
 * THE OTHER HALF OF THE PAIR IS IN THE SCRIPT, AND THIS ONE CANNOT BE. The roll
 * call over `test` lives in `run-suite.sh` because a check cannot police the
 * thing that decides whether it runs: delete `@canoncore/config`'s `test` script
 * and no suite in this package runs to complain. `typecheck` is not that case.
 * This file runs under `test`, whose roll call is already held in the script, so
 * the task it polices and the task that decides whether it runs are different
 * ones -- and the script's roll call is what keeps the difference real.
 *
 * NOTHING IS ADDED TO `ci.yml`, which is the point rather than a convenience. A
 * second argument per package would be eleven names transcribed into a workflow,
 * going stale in the direction that matters the first time a package is added:
 * the new one would simply not be a package anybody had written down. Both sides
 * here are DERIVED -- the packages from `pnpm-workspace.yaml`, the plan from
 * turbo itself.
 *
 * WHAT IT DOES NOT HOLD, SAID HERE RATHER THAN LEFT TO BE FOUND: the plan it
 * reads is UNFILTERED, and the root script is what CI actually runs. `pnpm
 * typecheck` is `turbo run typecheck` today, so the two are the same set -- but
 * a root script narrowed to `turbo run typecheck -F web` would typecheck one
 * package with the count non-zero while this file, reading an unfiltered plan,
 * still saw eleven and passed. A filtered root script is a shape this repo uses
 * on purpose (`db:migrate` is `turbo run db:migrate -F @canoncore/db --`), so
 * refusing one outright would be a new rule rather than this one's.
 */

/**
 * Every package the workspace declares that turbo would NOT run the planned
 * task for, which is the whole comparison this file is made of.
 *
 * IT ASKS TURBO RATHER THAN THE MANIFESTS, for the reason `turbo-dry-run.ts`'s
 * header gives: reading `scripts` back and asserting the entry is present
 * restates turbo's decision in a second language and passes by construction
 * wherever the two disagree. What the Typecheck job runs is turbo's plan, so
 * turbo's plan is what has to name every package.
 *
 * IT TAKES A PLAN RATHER THAN A TASK NAME, which is what lets the deletion below
 * be driven rather than described. A function that spawned turbo for itself
 * could only ever be asked about the repository as it stands, and the state this
 * file exists to catch is one the repository is not in.
 *
 * ABSENT FROM THE PLAN COUNTS AS OUTSIDE, alongside planned-but-not-run. No turbo
 * leaves a workspace package out today -- that is the measurement `willRun`
 * carries -- so this is the unreachable side of the `!== true`, kept because the
 * alternative is a package silently dropping out of the question.
 */
function packagesOutside(planned: PlannedTask[]): string[] {
  const runs = new Map(planned.map((task) => [task.directory, willRun(task)]));
  return packageDirectories().filter((directory) => runs.get(directory) !== true);
}

/**
 * One package's planned task as it looks THE MOMENT ITS SCRIPT IS DELETED, taken
 * from turbo rather than written here.
 *
 * `packages/tokens` really does not declare `db:studio`, so the entry turbo
 * plans for it under that task IS the entry it would plan under `typecheck` with
 * the `typecheck` script gone -- same package, same sentinel, turbo's own bytes.
 * Splicing that into the real `typecheck` plan is the deletion, and nothing here
 * restates the sentinel: a hand-written `command: "<NONEXISTENT>"` would go on
 * passing against a string this repository had made up if turbo ever changed it.
 */
function asIfScriptDeleted(directory: string): PlannedTask {
  const declaresNothing = plannedTasks("db:studio").find(
    (task) => task.directory === directory && !willRun(task),
  );
  if (declaresNothing === undefined) {
    throw new Error(`${directory} declares db:studio, so it cannot stand in for a deleted script`);
  }
  return declaresNothing;
}

describe("the typecheck roll call", () => {
  /**
   * THE ROLL CALL ITSELF. Every package this workspace declares is one turbo
   * would run `typecheck` for, so a package that drops the script -- or one
   * added without it -- is named here rather than leaving the count non-zero and
   * the job green.
   *
   * A package with nothing to typecheck is the DEFECT rather than a case to
   * allow for, which is the line `network-gate-wiring.test.ts` takes about a
   * package with no Vitest config: every package here is TypeScript, every one
   * has a `tsconfig.json`, and a package outside `tsc` is a package whose types
   * nothing checks.
   */
  it("holds every package the workspace declares to being one turbo typechecks", () => {
    expect(packagesOutside(plannedTasks("typecheck"))).toStrictEqual([]);
  });

  /**
   * THE RED, DRIVEN RATHER THAN DESCRIBED (CNCORE-197's first acceptance
   * criterion). `run-suite.test.ts` runs the guard against a workspace with the
   * script and then without it; this is the same demonstration over the same
   * transition, and it runs on every CI run rather than sitting in a record as a
   * measurement somebody took once.
   *
   * Measured by hand the same way on 2026-09-15, which is the half a suite
   * cannot reach: with `packages/tokens`' script really deleted,
   * `run-suite.sh typecheck` read `Tasks: 10 successful, 10 total` and exited 0,
   * while `run-suite.sh test @canoncore/config` -- the Test job's own command --
   * exited 1 naming the package. So the job this reddens is the Test one, as it
   * is for a deleted `test` script.
   */
  it("names the package whose script has gone, which is the whole point of it", () => {
    const withoutTokens = plannedTasks("typecheck").map((task) =>
      task.directory === "packages/tokens" ? asIfScriptDeleted("packages/tokens") : task,
    );

    expect(packagesOutside(withoutTokens)).toStrictEqual(["packages/tokens"]);
  });

  /**
   * AND THE CANARY OVER UNTOUCHED DATA, which is what the row above cannot be:
   * it builds its own subject, so a comparison that had stopped asking would
   * still have to answer it. This one is turbo's plan exactly as it comes.
   *
   * `test` is declared by ten of the eleven: `packages/contract` runs its suite
   * as `test:contract`, so turbo plans a task for it that will not run. A
   * comparison reporting nothing HERE reports nothing above for the same reason,
   * and one reporting everything is broken the other way -- naming the package
   * refuses both with one row.
   *
   * `packages/contract` gaining a `test` script fails this loudly, which is a
   * line somebody then changes on purpose rather than a canary that quietly
   * stops meaning anything.
   */
  it("names a package that a task really does leave out, so an empty list means something", () => {
    expect(packagesOutside(plannedTasks("test"))).toStrictEqual(["packages/contract"]);
  });
});
