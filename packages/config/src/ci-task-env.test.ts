import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { turboTaskInvocations, type Workflow, workflow } from "./testing/ci-workflow";
import { repoRoot } from "./testing/repo-root";
import { plannedTasksIfKnown } from "./testing/turbo-dry-run";

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
 * THE FALLBACK IS WHAT MADE IT SILENT, and no guard inside the HARNESS can
 * close this: by the time `global-setup.ts` runs, a filtered variable is simply
 * ABSENT, indistinguishable from one nobody set -- and a "require the real
 * provider" flag delivered by the environment would be filtered by the very
 * mechanism it is guarding against.
 *
 * A PREFLIGHT IN THE ROOT SCRIPT COULD, AND IS NOT WHAT THIS IS. `pnpm test:e2e`
 * is `turbo run test:e2e`, and that process sees the whole environment before
 * turbo filters anything, so a wrapper could compare the two and refuse. It is
 * rejected rather than overlooked: it puts a script in front of every e2e run
 * to catch a fault introduced by editing `ci.yml` or `turbo.json`, which this
 * suite catches on the PR that edits them, in the `Test` job, naming the fix.
 * A check that fires at the edit beats one that fires at the next run.
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

/**
 * What Turbo will pass to every planned copy of a task, or `null` when the name
 * is not a Turbo task at all.
 *
 * THE REFUSAL-TOLERANT READER, because the names asked for are EXTRACTED rather
 * than literal. That is what lets the candidates below be gathered loosely and
 * confirmed against turbo itself, instead of matched against a transcribed list
 * of task names that could go stale. Why only a refusal is `null` -- and why a
 * crash must not be -- is in `testing/turbo-dry-run.ts`, beside the policy.
 *
 * A REFUSAL IS STILL NOT PROOF THE NAME WAS WRONG -- a broken `turbo.json`
 * refuses every name alike -- so the callers below assert that each job
 * resolved at least one task rather than trusting this to have been asked.
 *
 * AN ABSENT LIST IS READ AS EMPTY HERE, which is this caller's decision and not
 * the reader's: a task declaring no variable passes none, and every assertion
 * below asks whether a name is among those passed.
 */
function specifiedEnvPerTask(task: string): { taskId: string; env: string[] }[] | null {
  return (
    plannedTasksIfKnown(task)?.map(({ taskId, environmentVariables }) => ({
      taskId,
      env: environmentVariables.specified.env ?? [],
    })) ?? null
  );
}

/**
 * Every turbo task a job's `run:` steps invoke, however it invokes them.
 *
 * READ THROUGH THE SHARED READER SINCE CNCORE-160, which is the ticket that
 * made the spelling a question at all: the five suite jobs run turbo through
 * `SUITE_GUARD` rather than naming `pnpm` themselves, and a scraper that knew
 * only `pnpm <task>` lost every subject in this file at once. The canary below
 * is what caught it.
 *
 * Deliberately LOOSE there, because `specifiedEnvPerTask` above confirms each
 * candidate against Turbo itself: `pnpm install` and `pnpm exec` match and are
 * dropped there.
 */
function turboTasksRunBy(job: { steps?: { run?: string }[] }): string[] {
  return [...new Set(turboTaskInvocations(job).map(({ task }) => task))];
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
      hostPorts: (service.ports ?? []).flatMap(publishedPort),
    }));
}

/**
 * The HOST port a mapping publishes, which is the one a job's variables can
 * name.
 *
 * NOT `split(":")[0]`, which is right for `8081:8080` and wrong for every other
 * form the field allows: `127.0.0.1:8081:8080` would give `127.0.0.1` and pair
 * against nothing, failing this suite for a reason that is not the defect. The
 * host port is always the segment immediately before the container port, so it
 * is read from the END. A bare `8080` publishes on a port the runner chooses,
 * which no variable can name ahead of time, so it yields nothing rather than a
 * finding nobody can act on.
 */
function publishedPort(mapping: string): string[] {
  const segments = mapping.split("/")[0]?.split(":") ?? [];
  const host = segments[segments.length - 2];
  return host === undefined ? [] : [host];
}

describe("a provider container a CI job starts", () => {
  const jobs = Object.entries(workflow().jobs ?? {}).map(([job, definition]) => ({
    job,
    providers: providerServices(definition),
    // Every value the job sets, not only the ones that look like URLs: what
    // makes a value an address here is that it ends at a published port, and
    // deciding that in advance would be this file guessing at the spelling of
    // the thing it is checking.
    values: Object.values(definition.env ?? {}).map(String),
  }));

  /*
   * The canary, for the reason the one below carries: a job that stopped
   * starting a provider would take this file's subject away silently.
   *
   * `toContain` RATHER THAN THE EXACT LIST. Both jobs are named because both
   * are subjects, but a third job starting a provider is an ordinary change and
   * must not redden a canary -- and an exact list is also keyed to the order
   * the keys happen to sit in the YAML.
   */
  it("is started by at least one job, so the check below has a subject", () => {
    const starters = jobs.filter(({ providers }) => providers.length > 0).map(({ job }) => job);
    expect(starters).toContain("provider");
    expect(starters).toContain("contract");
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
    const unaddressed = jobs.flatMap(({ job, providers, values }) =>
      providers
        .filter(
          ({ hostPorts }) =>
            !hostPorts.some((port) => values.some((value) => value.endsWith(`:${port}`))),
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
      const resolved = tasks
        .map((task) => ({ task, planned: specifiedEnvPerTask(task) }))
        .filter((candidate) => candidate.planned !== null);

      /*
       * WITHOUT THIS, A TURBO THAT REFUSES EVERY NAME REPORTS NO FINDINGS. The
       * candidates are extracted loosely on purpose, so `null` normally means
       * "that was `pnpm install`, not a task" -- but a `turbo.json` that will
       * not parse refuses every name identically, and the loop below would then
       * run zero times and pass. Each of these jobs demonstrably runs a task.
       */
      expect(
        resolved.length,
        `no \`pnpm <task>\` in the \`${job}\` job resolved to a turbo task, so nothing below was ` +
          `actually asked. Candidates: ${tasks.join(", ") || "none"}.`,
      ).toBeGreaterThan(0);

      for (const { task, planned } of resolved) {
        for (const variable of variables) {
          for (const { taskId, env } of planned ?? []) {
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

/**
 * THE VARIABLE THE TICKET NAMED IS THE ONE THE CHECKS ABOVE CANNOT SEE.
 *
 * They pair a job's own `env:` against the task it runs, and no CI job sets
 * `PROVIDER_WIKI_URL` for `test:e2e` any more -- so dropping it from
 * `turbo.json` would leave every one of them green while silently breaking the
 * owner who runs this suite against an unlocked `provider-wiki` of their own.
 * CNCORE-143 asks that `test:e2e` not be able to ignore a provider variable,
 * and that is the half of the request the workflow file cannot carry.
 *
 * DERIVED FROM THE HARNESS RATHER THAN TRANSCRIBED. The names are read out of
 * `global-setup.ts` itself, so a provider variable added there arrives here
 * without anybody remembering to add it -- which is the failure this file is
 * about, one level up. A list typed out here would go stale exactly when a
 * third provider was added, and pass while doing so.
 */
describe("a provider URL the e2e harness reads", () => {
  const harness = join(repoRoot, "apps", "web", "e2e", "global-setup.ts");
  const read = [
    ...new Set(
      [...readFileSync(harness, "utf8").matchAll(/process\.env\.(PROVIDER_[A-Z_]+)/g)].flatMap(
        (match) => (match[1] === undefined ? [] : [match[1]]),
      ),
    ),
  ];

  it("is read by that harness at all, so the check below has a subject", () => {
    expect(read).toContain("PROVIDER_WIKI_URL");
    expect(read).toContain("PROVIDER_TMDB_URL");
  });

  it("is declared for `test:e2e`, or the harness can never see it", () => {
    const planned = specifiedEnvPerTask("test:e2e");
    expect(planned, "`test:e2e` is not a turbo task, so nothing here was asked").not.toBeNull();
    const web = (planned ?? []).find(({ taskId }) => taskId === "web#test:e2e");
    expect(web, "no `web#test:e2e` task, and that is where the e2e harness runs").toBeDefined();
    for (const variable of read) {
      expect(
        web?.env ?? [],
        `${variable} is read by apps/web/e2e/global-setup.ts, but turbo does not pass it to ` +
          `web#test:e2e -- so the harness sees it as unset however it is spelled in the shell.`,
      ).toContain(variable);
    }
  });
});
