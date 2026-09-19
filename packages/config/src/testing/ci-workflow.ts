import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "./repo-root";

/**
 * One reader for `.github/workflows/ci.yml`, for the suites that ask questions
 * of that file: `ci-workflow.test.ts` and `node-major.test.ts` here, and
 * `@canoncore/env`'s `install-path.test.ts`, which asks the workflow what image
 * it publishes so that `compose.yaml` cannot name a different one (CNCORE-64).
 *
 * PUBLISHED FOR THAT THIRD READER rather than copied to it, which is this
 * module's own reason restated: a second reader of this file is the Shotgun
 * Surgery below, and it does not stop being one for living in another package.
 *
 * Both read it for the reason ADR-0103 gives about the compose file: the values
 * are written where TypeScript cannot see them, so nothing else would catch one
 * of them moving. They had a reader each until CNCORE-56, which is Shotgun
 * Surgery waiting to happen -- `pnpm/setup`'s inputs or the file's job shape
 * changing means editing both, and nothing makes the second one obvious.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT CARRY is the transcribed data. Each
 * suite keeps its own copy of `pnpm/setup`'s input list, the action ref, and
 * Node's release schedule, because restating those locally is what forces
 * someone to go and re-read the vendor before editing them. That reasoning
 * covers the DATA and not the reader, which is why only the reader moved here.
 */

const workflowFile = join(repoRoot, ".github", "workflows", "ci.yml");

type Env = Record<string, unknown>;

export type Step = {
  uses?: string;
  /**
   * READ BY THE CREDENTIAL GATE (CNCORE-203). A job output is written
   * `${{ steps.<id>.outputs.<key> }}`, so the id is the only thing tying the
   * value a gate reads back to the step that computed it -- and therefore to
   * the secret that step was handed. Without it the gate could only be checked
   * for naming SOME output, which a job gated on the wrong provider's
   * credential would satisfy.
   */
  id?: string;
  with?: Record<string, unknown>;
  env?: Env;
  run?: string;
  name?: string;
  if?: unknown;
  "continue-on-error"?: unknown;
};

/**
 * `ports` IS READ, so it belongs here (CNCORE-143). `ci-task-env.test.ts` asks
 * whether a provider container a job starts is one that job actually addresses,
 * and the published host port is the half of that pairing the service owns.
 *
 * IT PARSES AS A STRING. `- 8081:8080` has no space after the colon, so YAML
 * reads a plain scalar rather than a mapping; checked against this very file
 * rather than assumed, for the reason the `on` key above carries.
 */
type Service = {
  image?: string;
  credentials?: Record<string, unknown>;
  ports?: string[];
  /**
   * `env` IS READ TOO (CNCORE-203), because it is where a service says what it
   * cannot start without, and a service that cannot start takes its whole job
   * with it. ADR-0139 carries why that forces the gate onto the job.
   */
  env?: Env;
};

export type Job = {
  steps?: Step[];
  env?: Env;
  services?: Record<string, Service>;
  permissions?: Record<string, string>;
  if?: unknown;
  "continue-on-error"?: unknown;
  /**
   * The two keys the image jobs are read through (CNCORE-63). A matrix that
   * pairs `linux/arm64` with an x64 runner still builds -- under emulation,
   * which Docker's own documentation calls "much slower" -- so which runner
   * each platform lands on is a value worth reading back.
   */
  "runs-on"?: unknown;
  strategy?: { matrix?: { include?: Record<string, unknown>[] } };
  /**
   * The pair a job-level gate is built out of (CNCORE-203): one job answers a
   * question about a secret that no job is allowed to ask itself, and the rest
   * read its answer. ADR-0139 carries which contexts are available where, and
   * why that is the only arrangement available.
   *
   * `needs` PARSES AS EITHER SHAPE. A single dependency may be written as a
   * plain string and a list as a sequence, so the readers of this treat both,
   * and it is typed `unknown` rather than narrowed here for that reason.
   */
  needs?: unknown;
  outputs?: Record<string, string>;
  /**
   * READ BY `ci-timeouts.test.ts` (CNCORE-219). Absent, GitHub gives a job 360
   * minutes, so a hung suite holds a pull request for six hours looking exactly
   * like a slow one. Typed `unknown` because the key also takes an expression.
   */
  "timeout-minutes"?: unknown;
};

/**
 * The workflow file as its readers need it, which is the union of what both
 * suites ask rather than everything the schema allows. A key nothing reads is
 * absent on purpose: this type is a cast over parsed YAML, so every field in it
 * is a claim about the file that nothing checks.
 */
export type Workflow = {
  /**
   * The triggers, read because a condition is only half of whether a step runs
   * (CNCORE-70): `if: startsWith(github.ref, 'refs/tags/v')` on a workflow
   * whose `on:` admits no tag is a publish that reads correct and never fires.
   *
   * `on` SURVIVES THE PARSE AS THE STRING `on`, which is worth saying because
   * YAML 1.1 reads it as the boolean `true` and this key would then be absent
   * with no error. The `yaml` package defaults to the 1.2 core schema, where it
   * is a plain string; checked against this very file rather than assumed.
   */
  on?: { push?: { tags?: string[] } };
  env?: Env;
  jobs?: Record<string, Job>;
  concurrency?: { group?: string; "cancel-in-progress"?: boolean };
};

export function workflow(): Workflow {
  return parse(readFileSync(workflowFile, "utf8")) as Workflow;
}

/**
 * Every step in the file that runs pnpm/setup, named by the job it sits in.
 *
 * MATCHED ON THE ACTION AND NOT ON THE PINNED REF, which is the one thing to
 * keep straight when reading this next to `ci-workflow.test.ts`. That suite
 * asserts every step uses `pnpm/setup@v2` exactly, and it can only do so while
 * a step bumped to `@v3` still arrives in this list. A finder that matched the
 * ref would drop the bumped step instead, and the assertion about it would pass
 * having lost its subject.
 */
export function pnpmSetupSteps(parsed: Workflow): { job: string; step: Step }[] {
  return allSteps(parsed)
    .filter(({ step }) => step.uses?.startsWith("pnpm/setup"))
    .map(({ job, step }) => ({ job, step }));
}

/**
 * Every step in the file, carrying the job it sits in and that job's own `if`.
 *
 * The walk itself -- `Object.entries(jobs).flatMap(steps)` -- had been written
 * out three times across the two suites before `image.test.ts` would have made
 * it four, which is the Duplicated Code this module was created to hold
 * (CNCORE-56). The job's `if` travels with the step because a step's condition
 * is only half of whether it runs: a job-level condition suppresses every step
 * under it, and a reader that returned steps alone would report a publish as
 * unguarded when its job guards it.
 */
export function allSteps(parsed: Workflow): { job: string; jobIf: unknown; step: Step }[] {
  return Object.entries(parsed.jobs ?? {}).flatMap(([job, definition]) =>
    (definition.steps ?? []).map((step) => ({ job, jobIf: definition.if, step })),
  );
}

/**
 * The one script a CI job invokes turbo through (CNCORE-160, CNCORE-191).
 *
 * `turbo run <task>` exits 0 having run ZERO tasks, so a job invoking the
 * runner bare reports success for a task that is no longer there. The script
 * runs the task and fails when the count it printed is none.
 *
 * A SUITE IS NOT THE SUBJECT, THE RUNNER IS. CNCORE-160 put the five suite jobs
 * behind this and left `typecheck`, `build` and the migration ladder bare;
 * CNCORE-191 found they carry the identical hole, so the name reads `SUITE` for
 * its history rather than its scope. It also takes a package as a second
 * argument, which holds a run to that package's task having appeared among the
 * ones turbo ran -- a count is not a roll call, and `test` is declared by ten
 * packages (CNCORE-190). ADR-0103 carries all of it.
 */
export const SUITE_GUARD = ".github/scripts/run-suite.sh";

/**
 * Every turbo task a job's `run:` steps invoke, in BOTH spellings the workflow
 * uses, and which of the two each one is.
 *
 * TWO SPELLINGS IS WHY THIS IS HERE rather than in either suite that asks.
 * `ci-task-env.test.ts` matched `pnpm <task>` alone, and the five suite jobs
 * moving behind `SUITE_GUARD` took every one of its subjects away at once --
 * its canary caught that, and the fix in one file would have left the other
 * reader to be found by whoever broke it next. That is the Shotgun Surgery this
 * module's header describes, arriving for the third time.
 *
 * DELIBERATELY LOOSE, because both callers confirm a candidate against
 * something else: turbo itself in `ci-task-env.test.ts`, and the root
 * manifest's own scripts in `run-suite.test.ts`. So `pnpm install` and
 * `pnpm exec` matching here is ordinary rather than a fault. A flag cannot
 * match at all, which is what keeps `pnpm --filter web exec ...` from arriving
 * as the task `--filter`.
 */
export function turboTaskInvocations(job: {
  steps?: { run?: string }[];
}): { task: string; guarded: boolean }[] {
  const guard = SUITE_GUARD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const spellings = [
    { guarded: true, pattern: new RegExp(`(?:^|\\s)${guard}\\s+([a-z][a-z0-9:-]*)`, "g") },
    { guarded: false, pattern: /\bpnpm\s+(?:run\s+)?([a-z][a-z0-9:-]*)/g },
  ];
  return (job.steps ?? []).flatMap(({ run }) =>
    spellings.flatMap(({ guarded, pattern }) =>
      [...(run ?? "").matchAll(pattern)].flatMap((match) =>
        match[1] === undefined ? [] : [{ task: match[1], guarded }],
      ),
    ),
  );
}
