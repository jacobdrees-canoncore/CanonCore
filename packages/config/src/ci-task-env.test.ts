import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Workflow, workflow } from "./testing/ci-workflow";
import { repoRoot } from "./testing/repo-root";

/**
 * A VARIABLE A JOB SETS FOR ITSELF MUST REACH THE TURBO TASK THAT JOB RUNS.
 *
 * The defect is SILENT AND IT WAS LIVE FROM CNCORE-100 UNTIL CNCORE-143. CI's
 * `provider` job started the real `provider-wiki` image as a service container,
 * set `PROVIDER_WIKI_URL` at it, and ran `pnpm test:e2e` -- which is a TURBO
 * task, and `turbo.json` declared only `DATABASE_URL` for it. Turbo 2's env mode
 * is `strict` and there is no `globalPassThroughEnv`, so the variable was
 * filtered out of the task environment, `theProvider()` in
 * `apps/web/e2e/global-setup.ts` saw `undefined`, and fell back to the stub. The
 * job ran the SAME stub as the ordinary `e2e` job and was green throughout.
 *
 * THE FALLBACK IS WHAT MADE IT SILENT, and no guard inside the suite can close
 * this: by the time the harness runs, a filtered variable is simply ABSENT, and
 * a "require the real provider" flag delivered by the environment would be
 * filtered by the very mechanism it is guarding against. The two files have to
 * be read against each other from outside, which is what this suite does.
 *
 * ASKED OF `turbo` RATHER THAN OF `turbo.json`, for the reason
 * `turbo-cache-inputs.test.ts` gives at greater length: reading the config back
 * and asserting the `env` entries are present would restate the fix in a second
 * language and pass by construction wherever it was wrong. Only the dry run
 * knows what a task will actually receive -- `globalPassThroughEnv`, a package's
 * own `turbo.json`, and the env mode all land in the same answer.
 *
 * JOB-LEVEL `env:` IS THE SUBJECT, and workflow-level is not. The file's
 * workflow `env:` block is the shared environment every job gets; a JOB that
 * sets a variable for itself is saying the work it runs needs it. Where that
 * work is a Turbo task, the task is what must receive it. A variable only a
 * shell step needs belongs on that STEP -- which is how `ci.yml` already spells
 * `BASE_REF` -- so the fix for a false positive here is to move the variable to
 * the step that reads it, which is the more precise spelling anyway.
 */
const TURBO = join(repoRoot, "node_modules", ".bin", "turbo");

/**
 * What Turbo will pass to every planned copy of a task, or `null` when the name
 * is not a Turbo task at all.
 *
 * `--dry` resolves the graph and runs nothing, so this is a read even though it
 * is spawned through the runner. A name Turbo does not know exits 1, which is
 * what lets the candidates below be extracted loosely and confirmed here rather
 * than matched against a transcribed list of task names that could go stale.
 */
function specifiedEnvPerTask(task: string): { taskId: string; env: string[] }[] | null {
  let dryRun: string;
  try {
    dryRun = execFileSync(TURBO, ["run", task, "--dry=json"], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
  return JSON.parse(dryRun).tasks.map(
    (planned: {
      taskId: string;
      environmentVariables: { specified: { env: string[] | null } };
    }) => ({
      taskId: planned.taskId,
      env: planned.environmentVariables.specified.env ?? [],
    }),
  );
}

/**
 * Every `pnpm <task>` a job's `run:` steps invoke.
 *
 * Deliberately LOOSE, because `specifiedEnvPerTask` above confirms each
 * candidate against Turbo itself: `pnpm install` and `pnpm exec` match here and
 * are dropped there. A flag cannot match at all, which is what keeps
 * `pnpm --filter web exec ...` from arriving as the task `--filter`.
 */
function turboTasksRunBy(job: { steps?: { run?: string }[] }): string[] {
  const candidates = (job.steps ?? [])
    .flatMap(({ run }) => [...(run ?? "").matchAll(/\bpnpm\s+(?:run\s+)?([a-z][a-z0-9:-]*)/g)])
    .flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
  return [...new Set(candidates)];
}

/** Every job that sets a variable for itself, paired with the tasks it runs. */
function jobsSettingTheirOwnEnv(parsed: Workflow) {
  return Object.entries(parsed.jobs ?? {})
    .map(([job, definition]) => ({
      job,
      variables: Object.keys(definition.env ?? {}),
      tasks: turboTasksRunBy(definition),
    }))
    .filter(({ variables, tasks }) => variables.length > 0 && tasks.length > 0);
}

/**
 * Every provider image a job starts, with the host port it publishes.
 *
 * MATCHED ON THE PACKAGE NAME rather than on the service's key, because the key
 * is a label somebody chose: the wiki service was called `provider` in one job
 * and `provider-wiki` in another, for the same image.
 */
function providerServices(job: {
  services?: Record<string, { image?: string; ports?: string[] }>;
}) {
  return Object.entries(job.services ?? {})
    .filter(([, service]) => /\/provider-[a-z]+:/.test(service.image ?? ""))
    .map(([name, service]) => ({
      name,
      image: service.image ?? "",
      hostPorts: (service.ports ?? []).map((mapping) => mapping.split(":")[0]),
    }));
}

describe("a provider container a CI job starts", () => {
  const jobs = Object.entries(workflow().jobs ?? {}).map(([job, definition]) => ({
    job,
    providers: providerServices(definition),
    addresses: Object.values(definition.env ?? {}).map(String),
  }));

  /*
   * The canary, for the reason the one below carries: a job that stopped
   * starting a provider would take this file's subject away silently.
   */
  it("is started by at least one job, so the check below has a subject", () => {
    expect(
      jobs.filter(({ providers }) => providers.length > 0).map(({ job }) => job),
    ).toStrictEqual(["provider", "contract"]);
  });

  /**
   * THE OTHER HALF OF CNCORE-143, and it is the half visible in this file alone.
   *
   * A container that runs and is addressed by nothing answers no request and
   * says so nowhere: `docker logs` on the wiki container after a full provider
   * job held one line, `provider-wiki listening on http://0.0.0.0:8080`. From
   * outside, a job that STARTS the real image reads as a job that TESTS it, and
   * that reading is what kept this defect alive for as long as it lived. A
   * provider nothing points at is either a variable that went missing or a
   * service somebody forgot to delete, and both are worth a red check.
   */
  it("is addressed by that job, or it answers nothing and says so nowhere", () => {
    const unaddressed = jobs.flatMap(({ job, providers, addresses }) =>
      providers
        .filter(
          ({ hostPorts }) =>
            !hostPorts.some((port) => addresses.some((url) => url.endsWith(`:${port}`))),
        )
        .map(
          ({ name, image }) =>
            `the \`${job}\` job starts ${name} (${image}) and no variable it sets addresses it, ` +
            `so the container will run, receive nothing, and report that nowhere.`,
        ),
    );
    expect(unaddressed).toStrictEqual([]);
  });
});

describe("a variable a CI job sets for itself", () => {
  const jobs = jobsSettingTheirOwnEnv(workflow());

  /*
   * The canary. Every assertion below reads off this list, so a job losing its
   * `env:` block or its `pnpm` step would take the subject away rather than fail
   * the check -- which is the silent pass this whole suite is about, arriving
   * through the suite itself.
   */
  it("is set by at least one job, so the checks below have a subject", () => {
    expect(jobs.map(({ job }) => job)).toContain("provider");
  });

  it("reaches the turbo task that job runs", () => {
    const unreached: string[] = [];
    for (const { job, variables, tasks } of jobs) {
      for (const task of tasks) {
        const planned = specifiedEnvPerTask(task);
        if (planned === null) continue;
        for (const variable of variables) {
          for (const { taskId, env } of planned) {
            if (env.includes(variable)) continue;
            unreached.push(
              `the \`${job}\` job sets ${variable} and runs \`pnpm ${task}\`, but ${taskId} ` +
                `does not receive it: turbo's env mode is strict, so the task sees it as unset.`,
            );
          }
        }
      }
    }
    expect(unreached).toStrictEqual([]);
  });
});
