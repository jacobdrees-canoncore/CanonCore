import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "./repo-root";

/**
 * One reader for `.github/workflows/ci.yml`, for the two suites in this package
 * that ask questions of that file: `ci-workflow.test.ts` and
 * `node-major.test.ts`.
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
  with?: Record<string, unknown>;
  env?: Env;
  run?: string;
  name?: string;
  if?: unknown;
  "continue-on-error"?: unknown;
};

type Service = { image?: string; credentials?: Record<string, unknown> };

type Job = {
  steps?: Step[];
  env?: Env;
  services?: Record<string, Service>;
  permissions?: Record<string, string>;
  if?: unknown;
  "continue-on-error"?: unknown;
};

/**
 * The workflow file as its readers need it, which is the union of what both
 * suites ask rather than everything the schema allows. A key nothing reads is
 * absent on purpose: this type is a cast over parsed YAML, so every field in it
 * is a claim about the file that nothing checks.
 */
export type Workflow = {
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
  return Object.entries(parsed.jobs ?? {}).flatMap(([job, definition]) =>
    (definition.steps ?? [])
      .filter((step) => step.uses?.startsWith("pnpm/setup"))
      .map((step) => ({ job, step })),
  );
}
