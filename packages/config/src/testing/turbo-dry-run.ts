import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot } from "./repo-root";

/**
 * One reader for `turbo run <task> --dry=json`, for the suites that ask
 * questions of turbo's plan: `turbo-cache-inputs.test.ts` and
 * `ci-task-env.test.ts`.
 *
 * They had a reader each until CNCORE-145, which is the Shotgun Surgery
 * `ci-workflow.ts` was extracted for under CNCORE-56 -- a change to the dry
 * run's shape, or to where the binary sits, meant editing both, and nothing
 * made the second one obvious.
 *
 * BOTH ASK TURBO RATHER THAN `turbo.json`, which is why the spawn is worth
 * sharing at all. Reading the config back and asserting the entries are present
 * would restate each fix in a second language and pass by construction wherever
 * it was wrong; an unmatched `inputs` glob is dropped SILENTLY, and only the dry
 * run knows. Each suite carries that argument at length for its own subject.
 *
 * PACKAGE-PRIVATE, unlike `ci-workflow.ts` beside it. That module is published
 * because a third reader lives in `@canoncore/env`; both readers here are in
 * this package, so an `exports` entry would be a public surface nothing imports.
 *
 * `--dry` RESOLVES THE GRAPH AND RUNS NO TASK, so every function here is a read
 * even though it is spawned through the runner, and cheap enough to call per
 * task rather than batched. Measured on turbo 2.10.12, 2026-09-13: about 85ms
 * for a known task and 65ms for a refused name, over three warm runs each. The
 * first call after an install is nearer 1.1s.
 */
const turboBinary = join(repoRoot, "node_modules", ".bin", "turbo");

/**
 * One planned copy of a task, as its readers need it -- the union of what both
 * suites ask rather than everything turbo reports, on the argument
 * `ci-workflow.ts` makes for its own `Workflow` type. This is a cast over parsed
 * JSON, so every field in it is a claim about turbo's output that nothing
 * checks, and a key nothing reads is absent on purpose.
 *
 * Turbo 2.10.12 reports twenty-one keys per task; the ones below are the ones
 * read, measured against `turbo run test --dry=json` on 2026-09-13.
 */
export type PlannedTask = {
  taskId: string;
  /** Where the owning package sits, repo-relative -- `packages/config` and such. */
  directory: string;
  /**
   * What the package will actually run, and a sentinel where it declares no such
   * script. Ask `willRun` rather than reading it: the sentinel is what that
   * predicate is for, and the two belong together.
   */
  command: string;
  /**
   * Every file hashed into the task's cache key, which IS the key.
   *
   * KEYED RELATIVE TO `directory`, so a root file arrives spelled as a climb out
   * of the package. Resolving it is the caller's, since only the caller knows
   * whether it wants the path or the file.
   */
  inputs: Record<string, string>;
  resolvedTaskDefinition: { cache: boolean };
  /**
   * `specified.env` is what the task's own config declares, and it is the field
   * that answers whether a variable survives turbo's strict env mode.
   *
   * NULLABLE, and left that way rather than defaulted here. No task in this
   * repository reports `null` today -- every one declares at least
   * `DATABASE_URL`, measured across `test`, `build` and `typecheck` on
   * 2026-09-13 -- but the sibling `passThroughEnv` does report `null`, so the
   * shape is turbo's rather than a guess, and a task declaring nothing would
   * land on it. What an absent list MEANS is the caller's to decide.
   */
  environmentVariables: { specified: { env: string[] | null } };
};

/**
 * The shape a turbo task name may have, asserted at the spawn below.
 *
 * BECAUSE A CALLER'S NAME IS NOT ALWAYS A LITERAL. `ci-task-env.test.ts` scrapes
 * candidates out of `ci.yml`, and a name that began with `-` would reach turbo's
 * argument parser as a FLAG rather than a task -- `--filter=web` arriving where
 * a task belongs makes `run --filter=web --dry=json`, which exits 0 and answers
 * about a different question. That is not a refusal, so the tolerant reader
 * below would hand it back as a plan.
 *
 * The scraper already matches this shape, and asserting it HERE is what stops
 * the guarantee in this module's own header -- that these functions read and run
 * nothing -- from resting on a regex in another file.
 */
const TASK_NAME = /^[a-z][a-z0-9:-]*$/;

/**
 * The spawn both policies share, raising everything that is not turbo answering.
 *
 * `spawnSync` RATHER THAN `execFileSync` BECAUSE A REFUSAL MUST BE TELLABLE FROM
 * A CRASH. `execFileSync` throws on both alike, which is right for the strict
 * caller and useless to the tolerant one. Here `error` is the process never
 * running and a `null` status is a signal, so both are raised and only the exit
 * code is left for a caller to read.
 *
 * The one thing lost with `execFileSync` is that it echoed the child's stderr to
 * the parent even on success, and `spawnSync` captures it instead. Measured on
 * 2026-09-13: a successful `--dry=json` writes 18 bytes there, `• turbo 2.10.12`
 * and a newline, so what is no longer echoed is the version banner. A failure
 * still carries stderr, inside the error `plannedTasks` throws.
 */
function dryRun(task: string): SpawnSyncReturns<string> {
  if (!TASK_NAME.test(task)) {
    throw new Error(`\`${task}\` is not a turbo task name, and would reach turbo as an argument`);
  }
  const run = spawnSync(turboBinary, ["run", task, "--dry=json"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.error) throw run.error;
  if (run.status === null) throw new Error(`turbo was killed by ${run.signal} asking for ${task}`);
  return run;
}

/**
 * The `tasks` array out of a dry run, REFUSING anything that is not one.
 *
 * A turbo that exited 0 and reported no `tasks` key would otherwise yield
 * `undefined` here, and the tolerant reader's caller spells its "not a task"
 * answer `?? null` -- so an answerless success would arrive as "turbo does not
 * know that name" and the findings list would empty in silence. That is the
 * vacuous pass this module is written against, entering through the one door
 * neither failure policy watches.
 */
function plan(stdout: string): PlannedTask[] {
  const tasks = JSON.parse(stdout).tasks;
  if (!Array.isArray(tasks)) {
    throw new Error("turbo's dry run reported no `tasks` array, so there is no plan to read");
  }
  return tasks;
}

/**
 * Turbo's plan for a task, THROWING on anything that is not a plan -- including
 * a name turbo does not know.
 *
 * FOR A CALLER ASKING ABOUT A LITERAL TASK, which is the whole of when this is
 * the right one. A literal that turbo refuses is a broken repository rather than
 * a question answered `no`, so there is nothing for the caller to do about it
 * but stop.
 *
 * IT IS THE PLAINLY-NAMED ONE ON PURPOSE. Its sibling below is a `null` away
 * from the vacuous pass CNCORE-143 removed: a caller that skips a `null` and
 * asserts over what is left reports GREEN having checked nothing, which is the
 * defect these suites exist to catch reproduced inside the guard against it. So
 * the safe policy is what you get by reaching for the obvious name, and the
 * other costs a longer one plus a `null` the type system makes you handle.
 */
export function plannedTasks(task: string): PlannedTask[] {
  const run = dryRun(task);
  if (run.status !== 0) {
    throw new Error(`turbo exited ${run.status} planning \`${task}\`: ${run.stderr.trim()}`);
  }
  return plan(run.stdout);
}

/**
 * Turbo's plan for a task, or `null` when turbo does not know the name.
 *
 * FOR A CALLER ASKING ABOUT AN EXTRACTED NAME, which is the whole of when this
 * is the right one. `ci-task-env.test.ts` gathers `pnpm <task>` candidates out
 * of `ci.yml` loosely and lets turbo settle which are real, so `pnpm install`
 * arriving as a candidate is ordinary rather than a fault.
 *
 * A NON-ZERO EXIT IS NOT PROOF THE NAME WAS WRONG. A `turbo.json` that will not
 * parse refuses every name alike, and this cannot tell that apart from an
 * unknown name -- turbo reports both as exit 1. A caller must therefore assert
 * that SOMETHING resolved, or a broken config empties its findings and passes.
 * That assertion cannot live here, because only the caller knows how many of its
 * candidates were expected to be real.
 */
export function plannedTasksIfKnown(task: string): PlannedTask[] | null {
  const run = dryRun(task);
  return run.status === 0 ? plan(run.stdout) : null;
}

/**
 * What turbo writes as a planned task's command where the owning package
 * declares no such script.
 *
 * THE SENTINEL IS TURBO'S AND IS NOT DOCUMENTED. Its docs describe `--dry=json`
 * as output to build automation on without specifying the shape (read
 * 2026-09-15), so this spelling is measured rather than quoted -- turbo 2.10.12.
 * A turbo that changed it would leave every package reading as one that runs,
 * which is the silent direction, so a caller relying on this carries something
 * that goes red when it stops matching: `typecheck-wiring.test.ts` has a canary
 * over a task this repository really does leave a package out of.
 */
const NOT_DECLARED = "<NONEXISTENT>";

/**
 * Whether turbo would really RUN this planned task, which is not the same
 * question as whether the plan names it.
 *
 * A PLAN NAMES EVERY PACKAGE, WHICH IS THE THING TO KNOW ABOUT A DRY RUN. It is
 * not the list of packages that will run the task -- it is one entry per
 * workspace package whatever the task is, and `command` is the only thing
 * separating the ones that will from the ones that will not. Measured on turbo
 * 2.10.12, 2026-09-15: `turbo run db:studio --dry=json` plans ELEVEN tasks in an
 * eleven-package workspace where exactly ONE package declares the script, and
 * ten of them carry the sentinel.
 *
 * SO A READER ASKING "WOULD TURBO RUN THIS HERE?" MUST ASK IT THROUGH THIS
 * FUNCTION. `typecheck-wiring.test.ts` asks exactly that, and read the plan as
 * the list of runners before this existed -- which passes with the script
 * deleted, the vacuous green its own subject is about (CNCORE-197). It is here
 * beside the type rather than in that suite so the next reader of a plan gets
 * the distinction rather than rediscovering it.
 */
export function willRun(planned: PlannedTask): boolean {
  return planned.command !== NOT_DECLARED;
}
