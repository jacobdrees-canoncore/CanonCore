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
 * even though it is spawned through the runner. Measured on turbo 2.10.12,
 * 2026-09-13: a known task answers in about 0.3s warm, a refused name in 0.3s.
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
 * The spawn both policies share, raising everything that is not turbo answering.
 *
 * `spawnSync` RATHER THAN `execFileSync` BECAUSE A REFUSAL MUST BE TELLABLE FROM
 * A CRASH. `execFileSync` throws on both alike, which is right for the strict
 * caller and useless to the tolerant one. Here `error` is the process never
 * running and a `null` status is a signal, so both are raised and only the exit
 * code is left for a caller to read.
 */
function dryRun(task: string): SpawnSyncReturns<string> {
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
  return JSON.parse(run.stdout).tasks;
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
  return run.status === 0 ? JSON.parse(run.stdout).tasks : null;
}
