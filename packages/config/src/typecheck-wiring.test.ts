import { describe, expect, it } from "vitest";
import { plannedTasks } from "./testing/turbo-dry-run";
import { packageDirectories } from "./testing/workspace";

/**
 * A test that holds every package in this repository to being TYPECHECKED, for
 * the reason `network-gate-wiring.test.ts` holds every one of them to running a
 * gated suite: the Typecheck job asserts the COUNT turbo printed, and a count
 * is not a roll call.
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
 * thing that decides whether it runs: delete `@canoncore/config`'s `test`
 * script and no suite in this package runs to complain. `typecheck` is not that
 * case. This file runs under `test`, whose roll call is already held in the
 * script, so the task it polices and the task that decides whether it runs are
 * different ones -- and the script's roll call is what keeps the difference
 * real.
 *
 * NOTHING IS ADDED TO `ci.yml`, which is the point rather than a convenience. A
 * second argument per package would be eleven names transcribed into a
 * workflow, going stale in the direction that matters the first time a package
 * is added: the new one would simply not be a package anybody had written down.
 * Both sides here are DERIVED -- the packages from `pnpm-workspace.yaml`, the
 * plan from turbo itself.
 */

/**
 * The task under this file, and the one other task a plan is read for below.
 *
 * `build` is NOT here and the reason is `run-suite.sh`'s own: it is declared by
 * exactly ONE package, `web`, so the count reaching zero and the script being
 * deleted are the same event and the guard already catches it. Counted
 * 2026-09-15: `typecheck` 11, `test` 10, `build` 1. Count before adding a task
 * to this file rather than reading the figure here.
 */
const TYPECHECK = "typecheck";
const TEST = "test";

/**
 * What turbo writes as a task's command where the package declares no such
 * script, and the whole of what separates a planned task that RUNS from one
 * that does not.
 */
const NOT_DECLARED = "<NONEXISTENT>";

/**
 * Every package the workspace declares that turbo would NOT run `task` for,
 * which is the whole comparison this file is made of.
 *
 * IT ASKS TURBO RATHER THAN THE MANIFESTS, for the reason `turbo-dry-run.ts`'s
 * header gives: reading `scripts` back and asserting the entry is present
 * restates turbo's decision in a second language and passes by construction
 * wherever the two disagree. What the Typecheck job runs is turbo's plan, so
 * turbo's plan is what has to name every package.
 *
 * AND BEING IN THE PLAN IS NOT RUNNING, which is the thing that nearly made
 * this file worthless. A dry run reports one task PER WORKSPACE PACKAGE
 * whatever the task is -- `turbo run db:studio --dry=json` plans eleven in a
 * workspace where one package declares it -- so a check reading the plan as a
 * list of packages that will run the task reads every package as running every
 * task, and passes with the script deleted. The command is the discriminator
 * and the canary below is what holds it to being one. Measured on turbo
 * 2.10.12, 2026-09-15.
 */
function packagesOutside(task: string): string[] {
  const declared = new Map(
    plannedTasks(task).map((planned) => [planned.directory, planned.command]),
  );
  return packageDirectories().filter(
    (directory) => (declared.get(directory) ?? NOT_DECLARED) === NOT_DECLARED,
  );
}

describe("the typecheck roll call", () => {
  /**
   * THE ROLL CALL ITSELF. Every package this workspace declares appears in
   * turbo's plan for `typecheck`, so a package that drops the script -- or one
   * added without it -- is named here rather than leaving the count non-zero
   * and the job green.
   *
   * A package with nothing to typecheck is the DEFECT rather than a case to
   * allow for, which is the same line `network-gate-wiring.test.ts` takes about
   * a package with no Vitest config: every package here is TypeScript, every
   * one has a `tsconfig.json`, and a package outside `tsc` is a package whose
   * types nothing checks.
   */
  it("holds every package the workspace declares to being in turbo's plan", () => {
    expect(packagesOutside(TYPECHECK)).toStrictEqual([]);
  });

  /**
   * THE CANARY, AND IT IS WHAT MAKES THE ASSERTION ABOVE WORTH ANYTHING. An
   * empty list passes that test, and an empty list is also what a comparison
   * that can no longer SEE a missing package returns -- a sweep quietly
   * narrowed, a directory spelled one way by turbo and another by the workspace
   * read, a filter inverted. Green on a repository that is right and green on a
   * check that has stopped asking look identical from outside, which is the
   * exact failure CNCORE-190 and this ticket are both about.
   *
   * So the same comparison is run over a task this repository really does leave
   * a package out of. `test` is declared by ten of the eleven: `packages/contract`
   * runs its suite as `test:contract`, so turbo's plan for `test` does not name
   * it. A comparison that reports nothing here reports nothing above for the
   * same reason, and a comparison that reports everything is broken the other
   * way.
   *
   * IT NAMES THE PACKAGE RATHER THAN COUNTING ONE, so both wrong answers are
   * refused by the same row -- and `packages/contract` gaining a `test` script
   * fails LOUDLY here, which is a line somebody then has to change on purpose,
   * rather than a canary that quietly stops meaning anything.
   */
  it("names a package that a task really does leave out, so an empty list means something", () => {
    expect(packagesOutside(TEST)).toStrictEqual(["packages/contract"]);
  });
});
