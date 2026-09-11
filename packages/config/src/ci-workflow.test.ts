/**
 * A test that reads `.github/workflows/ci.yml`, for the same reason
 * `packages/db` reads its compose file (ADR-0103): the value is written where
 * TypeScript cannot see it, and nothing else would catch it changing.
 *
 * The defect it guards is SILENT, and was live on `main` from CNCORE-3 until
 * CNCORE-13. GitHub Actions treats an input an action does not declare as a
 * WARNING, never an error: the step runs, the input is dropped, and the job
 * goes green. Seven steps asked `pnpm/setup@v2` for `require-lockfile: true`,
 * an input it has never had, and every run said so in an annotation nobody
 * reads.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { data, Evaluator, Lexer, Parser } from "@actions/expressions";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pnpmSetupSteps, type Step, type Workflow, workflow } from "./testing/ci-workflow";
import { repoRoot } from "./testing/repo-root";

/**
 * The exact ref every step must use, so that the input list below cannot
 * silently go stale: a bump to `@v3` fails this and forces someone to re-read
 * the action's `action.yml` before editing the list.
 *
 * This does constrain one reasonable future change -- pinning the action by
 * commit SHA, as the gitleaks image above it is pinned by digest -- and that is
 * the right trade rather than an oversight. A SHA says nothing about which
 * inputs the action has, so a SHA pin makes the list below unverifiable from
 * the file it describes. Pin by SHA and this constant becomes the only place
 * recording which version was read; update both together.
 */
const PNPM_SETUP_REF = "pnpm/setup@v2";

/**
 * Every input `pnpm/setup@v2` declares, transcribed from the `inputs:` block of
 * the action's own `action.yml` at that ref on 2026-09-10. Restated here rather
 * than fetched, so the suite needs no network -- and so that adding a key to a
 * step means editing this list and checking the vendor first.
 *
 * There is deliberately no lockfile entry. The action has no input of any kind
 * for lockfile strictness; that is pnpm's own setting, and CNCORE-13 moved it
 * to where pnpm reads it.
 */
const PNPM_SETUP_INPUTS = new Set([
  "version",
  "dest",
  "runtime",
  "cache",
  "cache-dependency-path",
  "package-json-file",
  "install",
  "token",
]);

/**
 * The setting that does the work `require-lockfile` was mistaken for. pnpm
 * loads any `PNPM_CONFIG_*` variable as configuration, so this is
 * `--frozen-lockfile` written where every `pnpm install` in the file reads it,
 * including the one pnpm/setup runs for itself before any `run:` step.
 */
const FROZEN_LOCKFILE_VARIABLE = "PNPM_CONFIG_FROZEN_LOCKFILE";

/**
 * The slice of the `github` context a concurrency group can be keyed on, as the
 * webhook delivers it. `head_ref` is the one that matters: the contexts
 * reference says it "is only available when the event that triggers a workflow
 * run is either `pull_request` or `pull_request_target`", so on a push it is
 * simply absent.
 */
type GithubContext = { workflow: string; ref: string; run_id: string; head_ref?: string };

/**
 * Renders a concurrency group the way Actions would: the literal text of the
 * key with each `${{ }}` segment replaced by what it evaluates to.
 *
 * **The evaluation is GitHub's own**, from `@actions/expressions` -- the parser
 * out of `actions/languageservices`, which is what the workflow language server
 * reads expressions with. Hand-rolling it was the first attempt and was wrong
 * for the reason ADR-0106 gives about regexes and YAML: a twelve-line evaluator
 * understands `a || b` and nothing else, so a legitimate key written with `&&`,
 * `format()` or a ternary would be mis-read by the test rather than by GitHub.
 * The only thing left here is splitting the template, which is genuinely
 * trivial.
 *
 * What this buys over comparing the key to a string: a string comparison
 * restates the file and agrees with any key spelled the same way. This asks
 * what the key DOES, which is what the provider-wiki incident was about.
 */
function render(expression: string, github: GithubContext): string {
  const root = new data.Dictionary();
  const context = new data.Dictionary();
  for (const [key, value] of Object.entries(github)) {
    context.add(key, new data.StringData(String(value)));
  }
  root.add("github", context);

  return expression.replace(/\$\{\{(.*?)\}\}/g, (_, inner: string) => {
    const { tokens } = new Lexer(String(inner)).lex();
    return new Evaluator(new Parser(tokens, ["github"], []).parse(), root)
      .evaluate()
      .coerceString();
  });
}

/**
 * The group expression the workflow declares, as written.
 *
 * Thrown rather than asserted, so `render` below is handed a string and the
 * helper carries no hidden `expect`.
 */
function groupExpression(parsed: Workflow): string {
  const expression = parsed.concurrency?.group;
  if (typeof expression !== "string") {
    throw new Error("the workflow declares no concurrency group");
  }
  return expression;
}

/** The group a run lands in, given the event that started it. */
function group(parsed: Workflow, github: GithubContext): string {
  return render(groupExpression(parsed), github);
}

/**
 * A push to `main`: no pull request, so no `head_ref`. Absent from the context
 * entirely rather than set to an empty string, which is how the runner delivers
 * it and is the whole thing the fallback depends on.
 */
function pushToMain(run_id: string): GithubContext {
  return { workflow: "CI", ref: "refs/heads/main", run_id };
}

/**
 * A run of pull request `number`, opened from `branch`.
 *
 * The number is passed rather than derived, because two pull requests genuinely
 * have two and a fixture that gave them one would make `github.ref` look like
 * it conflated them when it does not. The point of these tests is where
 * `github.ref` actually fails, which is `main`; overstating it anywhere else
 * would make the failure message a lie.
 */
function pullRequest(branch: string, number: number, run_id: string): GithubContext {
  return { workflow: "CI", ref: `refs/pull/${number}/merge`, run_id, head_ref: branch };
}

/** The registry the private provider images live in (ADR-0089). */
/** The workflow this suite reads, as `git grep` pathspecs in it spell the path. */
const WORKFLOW_PATH = ".github/workflows/ci.yml";

const PRIVATE_REGISTRY = "ghcr.io/jacobdrees-canoncore/";

/** The jobs holding a step that answers `matches`, named as the file names them. */
function jobsWithStep(parsed: Workflow, matches: (step: Step) => boolean): string[] {
  return Object.entries(parsed.jobs ?? {})
    .filter(([, definition]) => (definition.steps ?? []).some(matches))
    .map(([job]) => job);
}

/** A step whose `run:` is exactly this command, rather than one mentioning it. */
function runsExactly(command: string) {
  return (step: Step) => step.run?.trim() === command;
}

/**
 * The env guard, found by the thing that MAKES it the env guard rather than by
 * its name: a step that blanks `DATABASE_URL` for itself alone. Matching on the
 * name would agree with a step renamed to match and gutted.
 */
const blanksDatabaseUrl = (step: Step) => step.env?.DATABASE_URL === "";

/**
 * The four checks CNCORE-80 split back into named jobs, each mapped to the jobs
 * carrying it -- found by what the step RUNS rather than by the job's name, so
 * a rename cannot carry the subject away and leave a test passing over nothing.
 *
 * Shared by the two tests below because they ask two halves of one question:
 * that the four are four, and that none of the four has been defanged. Written
 * out twice, a check added or renamed in one would silently stop being asked
 * about in the other.
 */
function staticCheckCarriers(parsed: Workflow): Record<string, string[]> {
  return {
    typecheck: jobsWithStep(parsed, runsExactly("pnpm typecheck")),
    lint: jobsWithStep(parsed, runsExactly("pnpm lint")),
    build: jobsWithStep(parsed, runsExactly("pnpm build")),
    "env guard": jobsWithStep(parsed, blanksDatabaseUrl),
  };
}

describe("the CI workflow", () => {
  /**
   * THE DEFECT THIS KEY EXISTS TO REMOVE, and it has already fired in this
   * organisation rather than being a hypothetical. provider-wiki keys on
   * `github.ref`, which makes `refs/heads/main` a group like any other: on
   * 2026-09-10 two merges landed five seconds apart, and run #18 -- commit
   * `1be88b47` on `main` -- was cancelled 28 seconds in. Its `image` job, which
   * builds the container THIS repository pulls as a service, never started, and
   * nothing re-ran it. A commit on a default branch with no verdict and nothing
   * that will ever produce one.
   *
   * `head_ref` is undefined on a push, so the group falls back to the run's own
   * id, which is unique per run. A group with one member cannot be cancelled by
   * anything -- and that is a property of the key rather than a condition
   * somebody has to maintain.
   */
  it("never lets one push to main cancel another", () => {
    const parsed = workflow();

    expect(group(parsed, pushToMain("101"))).not.toBe(group(parsed, pushToMain("102")));
  });

  /**
   * And the half the key is FOR. Sparing `main` is satisfied just as well by a
   * group of `${{ github.run_id }}` alone, which would spare every run from
   * every other and cancel nothing ever -- so the test above cannot tell a
   * working key from a useless one, and this is what does.
   *
   * Two runs of one pull request must land in ONE group, two pull requests must
   * not, and the cancellation has to actually be switched on: `concurrency`
   * without `cancel-in-progress` queues the second run behind the first instead
   * of replacing it, which is slower than having no key at all.
   */
  it("puts two runs of one pull request in the same group, and two branches in different ones", () => {
    const parsed = workflow();

    expect(group(parsed, pullRequest("jacobdrees/a", 1, "201"))).toBe(
      group(parsed, pullRequest("jacobdrees/a", 1, "202")),
    );
    expect(group(parsed, pullRequest("jacobdrees/a", 1, "201"))).not.toBe(
      group(parsed, pullRequest("jacobdrees/b", 2, "203")),
    );

    expect(parsed.concurrency?.["cancel-in-progress"]).toBe(true);
  });

  /**
   * WHY FOUR JOBS RATHER THAN ONE, which is a diagnosability decision that a
   * cost decision overrode for as long as the cost was real. ADR-0111 merged
   * these four into `static-checks` because GitHub bills per job ROUNDED UP TO
   * THE WHOLE MINUTE, and four jobs doing 44 seconds of work between them
   * billed four minutes. CNCORE-62 made this repository public, and GitHub's
   * billing documentation read 2026-09-11 says "The use of standard
   * GitHub-hosted runners is free: In public repositories". Four billed minutes
   * and one are now both zero, so the thing the merge was bought with is gone
   * and the principle it overrode comes back: a red check names the thing that
   * broke rather than making someone open the log to find out.
   *
   * This test is the split's guard rail in both directions. Merging them back
   * fails it -- which is the point, because the merge is what the next reader
   * will be tempted by, and the arithmetic that justified it still holds in the
   * two PRIVATE provider repositories (ADR-0089) and nowhere here. Dropping a
   * check on the way through fails it too: each of the four must still be
   * findable.
   */
  it("runs each static check as its own named job", () => {
    const parsed = workflow();

    const carriers = staticCheckCarriers(parsed);

    // Non-vacuous first, and named: a split that quietly dropped `pnpm lint`
    // would otherwise satisfy the distinctness assertion below perfectly. The
    // message says "exactly one" rather than "none" because both failures land
    // here -- zero jobs when a check is dropped, two when one is merged back in.
    for (const [check, jobs] of Object.entries(carriers)) {
      expect(jobs, `exactly one job must carry the ${check}`).toHaveLength(1);
    }

    // FOUR CHECKS, FOUR JOBS, PAIRWISE DISTINCT. This is the whole property:
    // the pull request carries a check per thing that can break, so a red one
    // says which. Two of them sharing a job fails here with the job they share.
    expect(new Set(Object.values(carriers).flat()).size).toBe(4);
  });

  /**
   * A CHECK CAN BE TURNED INTO DECORATION WITHOUT LEAVING THE PULL REQUEST, and
   * that is what this test is about. Splitting the four back out did not fix
   * it: `continue-on-error: true` on a job makes its failure not fail the
   * workflow, and the job still reports a green check under its own unchanged
   * name. An `if:` makes it not run at all. Either one is invisible to anyone
   * reading the checks list rather than the file.
   *
   * So the assertion is the same one the merged job carried, now asked of each
   * of the four -- all four must still be able to fail the build
   * INDEPENDENTLY. Four named jobs is diagnosability, not a weakening, and this
   * is what stops the second being quietly traded for the first.
   *
   * The jobs are found by what they RUN rather than by name, for the reason
   * `blanksDatabaseUrl` gives: a rename would otherwise carry the subject away
   * and leave this passing over nothing.
   */
  it("lets nothing in the four static-check jobs stop failing the build", () => {
    const parsed = workflow();

    const carrying = staticCheckCarriers(parsed);
    // Not vacuous: renamed or deleted jobs would make every filter below empty
    // and this test a formality.
    expect(Object.keys(carrying)).toHaveLength(4);

    for (const [check, [name]] of Object.entries(carrying)) {
      const job = parsed.jobs?.[name ?? ""];
      const steps = job?.steps ?? [];
      expect(steps.length, `${check}: no steps`).toBeGreaterThan(0);

      // THE JOB LEVEL FIRST, because it is the cheaper mistake and it defangs a
      // whole check at once rather than one step of it. `continue-on-error` and
      // `if` are both valid job keys, and a job carrying either reports green
      // having decided nothing.
      const defangedJob = ["continue-on-error", "if"].filter(
        (key) => job?.[key as "if"] !== undefined,
      );
      expect(defangedJob, `${check}: job level`).toStrictEqual([]);

      const defanged = steps
        .filter((step) => step["continue-on-error"] !== undefined || step.if !== undefined)
        .map((step) => step.name ?? step.run ?? step.uses);
      expect(defanged, `${check}: step level`).toStrictEqual([]);

      // And the shell form, which neither key catches: a step that runs the
      // check, discards its verdict and exits 0.
      //
      // ON THE THREE ONE-COMMAND JOBS THIS IS NOT THE ASSERTION THAT BITES, and
      // saying so is the point of the comment. `pnpm build || true` is not
      // `pnpm build`, so `runsExactly` stops matching it, the carrier list goes
      // empty and the test above fails first -- probed, and it reports
      // `exactly one job must carry the build`. What this catches is the env
      // guard, whose `run:` is a script rather than a command, and any step
      // added beside one of the four later.
      //
      // It is a list of the forms worth catching rather than a proof -- a shell
      // script can always be written to swallow its own failure, and no reading
      // of the file will ever settle that. What it buys is that the ACCIDENTAL
      // version, reached for to quieten a noisy check, does not pass unnoticed.
      const swallowed = steps
        .filter((step) => /\|\|\s*(true|:)\b/.test(step.run ?? ""))
        .map((step) => step.name ?? step.run);
      expect(swallowed, `${check}: shell form`).toStrictEqual([]);
    }
  });

  it("passes pnpm/setup nothing it does not declare as an input", () => {
    const steps = pnpmSetupSteps(workflow());

    // Without this the whole test is vacuous: a renamed action, or a file that
    // failed to parse into jobs, would produce an empty list and pass.
    expect(steps.length).toBeGreaterThan(0);

    const undeclared = steps.flatMap(({ job, step }) =>
      Object.keys(step.with ?? {})
        .filter((input) => !PNPM_SETUP_INPUTS.has(input))
        .map((input) => `${job}: ${input}`),
    );
    expect(undeclared).toStrictEqual([]);

    // The list above describes v2 and nothing else.
    expect(steps.map(({ step }) => step.uses)).toStrictEqual(steps.map(() => PNPM_SETUP_REF));
  });

  /**
   * WHAT A MISSING `packages: read` LOOKS LIKE, which is why this is a test and
   * not a convention. A job with a private GHCR service and no package read
   * scope fails at `Initialize containers` with one word -- `denied` -- before a
   * single step runs. There is no suite output, no stack, and nothing naming the
   * permission: the log says a docker pull was refused and stops.
   *
   * It is half of the story and the half a repository can check. The other half
   * is a grant in the package's own settings, which lives outside git and which
   * no test can reach -- so when this passes and the pull still fails, the
   * remaining answer is "grant this repository Read on that package". That
   * sentence is the value here as much as the assertion is.
   */
  it("gives every job with a private image the scope to pull it", () => {
    const parsed = workflow();

    const withPrivateImages = Object.entries(parsed.jobs ?? {}).filter(([, job]) =>
      Object.values(job.services ?? {}).some((service) =>
        service.image?.startsWith(PRIVATE_REGISTRY),
      ),
    );

    // Not vacuous: two jobs run provider images today, and a rename that emptied
    // this list would otherwise pass having asked nothing.
    expect(withPrivateImages.length).toBeGreaterThan(0);

    const unscoped = withPrivateImages
      .filter(([, job]) => job.permissions?.packages !== "read")
      .map(([name]) => name);
    expect(unscoped).toStrictEqual([]);
  });

  /**
   * AND THE CREDENTIALS BESIDE THE SCOPE. `packages: read` widens the workflow's
   * own `GITHUB_TOKEN`; it does not hand that token to the docker pull. A service
   * with no `credentials:` block is pulled anonymously, which for a private image
   * is the same `denied` from a different cause -- and the two are indistinguishable
   * in the log.
   */
  it("gives every private image the credentials to pull it with", () => {
    const parsed = workflow();

    const anonymous = Object.entries(parsed.jobs ?? {}).flatMap(([name, job]) =>
      Object.entries(job.services ?? {})
        .filter(
          ([, service]) =>
            service.image?.startsWith(PRIVATE_REGISTRY) && service.credentials === undefined,
        )
        .map(([service]) => `${name}: ${service}`),
    );
    expect(anonymous).toStrictEqual([]);
  });

  /**
   * THE GATE MUST NOT BE THE LEAK. CNCORE-61 took a personal host name and a set
   * of absolute paths out of the tree so that seeding a public repository from
   * it carries neither, and ADR-0114 is why that is a scrub rather than a
   * history rewrite: once published, a string cannot be taken back.
   *
   * A gate written the obvious way spells the thing it removes, and EVERY file
   * here is seeded -- this suite included -- so the gate, or a test restating
   * its patterns, becomes the last copy of its own target and fails the
   * ticket's acceptance criterion on the very code that exists to satisfy it.
   * Nothing below names a forbidden value. The patterns are read out of the
   * workflow and checked against the workflow, so this suite pins the property
   * without holding the data.
   *
   * What it guards is the gate going quiet: excluded into silence, defanged, or
   * left unable to tell "found nothing" from "could not look".
   */
  it("keeps the publishability gate biting, without the gate becoming the leak", () => {
    const parsed = workflow();

    const steps = parsed.jobs?.docs?.steps ?? [];
    // Not vacuous: a renamed or deleted job would empty every filter below.
    expect(steps.length).toBeGreaterThan(0);

    // Found by what MAKES it the gate -- a search of the tree that excludes this
    // one file from itself -- rather than by its name, which a rename takes with
    // it while leaving a gutted step behind.
    const gates = steps.filter((step) => step.run?.includes("git grep") === true);
    expect(gates.length).toBe(1);
    const run = gates[0]?.run ?? "";

    const defanged = gates
      .filter(
        (step) =>
          step["continue-on-error"] !== undefined ||
          step.if !== undefined ||
          /\|\|\s*(true|:)\b/.test(step.run ?? ""),
      )
      .map((step) => step.name ?? step.run);
    expect(defanged).toStrictEqual([]);

    // ONE EXCLUSION, AND IT IS THIS FILE. Quieting the gate by excluding the
    // directory a finding sits in is the cheap fix that leaves it reporting
    // green over the thing it was added to catch.
    const excluded = [...run.matchAll(/':!([^']+)'/g)].map((match) => match[1]);
    expect(excluded).toStrictEqual([WORKFLOW_PATH]);

    // `git grep` exits 1 on no match but 2 or 128 on error, and an `if` cannot
    // tell those apart -- a mistyped pathspec would report green having searched
    // nothing. ADR-0111 and CNCORE-3 are about exactly this shape of silence.
    expect(run).toMatch(/-gt 1/);

    // AND THE GATE IS NOT ITSELF THE LEAK. Its patterns are read back out of the
    // file and required to appear nowhere in it but the lines that search for
    // them, so spelling a forbidden value into a comment or a second step fails
    // here. CI cannot catch that: the gate excludes itself from its own search.
    const patterns = [...run.matchAll(/^\s*scan\s+'([^']+)'/gm)].map((match) => match[1] ?? "");
    // Not vacuous: two values are scrubbed, so an empty list means the scan lines
    // moved and this assertion lost its subject.
    expect(patterns.length).toBeGreaterThanOrEqual(2);

    const file = readFileSync(join(repoRoot, WORKFLOW_PATH), "utf8");
    const elsewhere = file
      .split("\n")
      .filter((line) => !/^\s*scan\s+'/.test(line))
      .join("\n");
    const leaked = patterns.filter((pattern) => elsewhere.includes(pattern));
    expect(leaked).toStrictEqual([]);
  });

  it("turns the frozen lockfile on where every job can see it", () => {
    const parsed = workflow();

    // Workflow level rather than seven copies at step level: one place to read,
    // and a job added later is covered without anybody remembering to.
    expect(parsed.env?.[FROZEN_LOCKFILE_VARIABLE]).toBe(true);
  });

  it("lets no job or step quietly take it away again", () => {
    const parsed = workflow();

    // The same guard the first test carries, for the same reason: with no jobs
    // parsed, nothing shadows anything and this passes having asked nothing.
    expect(Object.keys(parsed.jobs ?? {}).length).toBeGreaterThan(0);

    // A job-level `env:` block does not replace the workflow's wholesale, but a
    // key redefined in one shadows the outer value for that job -- silently,
    // and only for the job that did it. A step-level one does the same for its
    // own step, which is the live shape in this file: the `env-guard` job blanks
    // DATABASE_URL on its single step rather than on the job, so that a step
    // added beside it later would get the real value. Both levels are checked,
    // because either would hide this setting from the install beneath it.
    const shadowed = Object.entries(parsed.jobs ?? {}).flatMap(([job, definition]) => [
      ...(FROZEN_LOCKFILE_VARIABLE in (definition.env ?? {}) ? [job] : []),
      ...(definition.steps ?? []).flatMap((step, index) =>
        FROZEN_LOCKFILE_VARIABLE in (step.env ?? {}) ? [`${job}: step ${index}`] : [],
      ),
    ]);
    expect(shadowed).toStrictEqual([]);
  });

  /**
   * Everything above reads the file. This asks the only question that matters
   * about it: does the name written there mean anything to pnpm?
   *
   * The variables are lifted OUT of the workflow rather than repeated, so a
   * typo -- `PNPM_CONFIG_FROZEN_LOCK_FILE`, say, which pnpm would load as a
   * setting it does not have and ignore -- fails this rather than passing a
   * test of a string that only this file believes in.
   *
   * On a throwaway project outside the repository, so the real lockfile is
   * never touched, and `--offline` throughout so the registry is never reached:
   * pnpm makes the frozen-lockfile decision before it resolves anything, which
   * is what makes an offline check meaningful here.
   */
  describe("the frozen lockfile it sets", () => {
    /**
     * Every PNPM_CONFIG_* the workflow exports, as the environment CI gets.
     *
     * Forwarded verbatim and not filtered, which is the point: a name only this
     * file believes in would not be caught by a test that retyped it. That does
     * mean whatever the workflow puts here reaches the pnpm spawned below, and
     * some of those settings would change where it writes or what it reaches --
     * `PNPM_CONFIG_STORE_DIR` and `PNPM_CONFIG_REGISTRY` among them. So the set
     * is pinned to the one key this file knows about, in the manner of the
     * exclusions in `biome-config.test.ts`: adding a second means editing this
     * line and saying why it is safe to hand a subprocess.
     */
    function pnpmSettingsFromWorkflow(): Record<string, string> {
      const declared = Object.entries(workflow().env ?? {}).filter(([key]) =>
        key.startsWith("PNPM_CONFIG_"),
      );
      expect(declared.map(([key]) => key)).toStrictEqual([FROZEN_LOCKFILE_VARIABLE]);
      return Object.fromEntries(declared.map(([key, value]) => [key, String(value)]));
    }

    /**
     * The environment every pnpm call below starts from, with two things taken
     * out of it, because this suite runs INSIDE the thing it is testing.
     *
     * `PNPM_CONFIG_*` goes because the workflow exports the very setting under
     * test, so the assertions would be measuring the ambient value and would
     * pass whatever the workflow said. This one was found by running the suite
     * under the runner's environment rather than reasoned about: with it
     * inherited, the fixture cannot even be SEEDED, since a frozen install
     * refuses a project that has no lockfile yet.
     *
     * `CI` goes because the runner sets it and pnpm turns frozen-lockfile on by
     * default when it sees it, which would leave the control below unable to
     * say which of the two did the work.
     */
    function baseEnvironment(): Record<string, string | undefined> {
      return Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => key !== "CI" && !key.startsWith("PNPM_CONFIG_"),
        ),
      );
    }

    function install(environment: Record<string, string>): string {
      const result = spawnSync("pnpm", ["install", "--offline"], {
        cwd: fixture,
        encoding: "utf8",
        env: { ...baseEnvironment(), ...environment },
      });
      return `${result.stdout}${result.stderr}`;
    }

    function manifest(dependencies?: Record<string, string>): void {
      writeFileSync(
        join(fixture, "package.json"),
        `${JSON.stringify({ name: "frozen-probe", version: "0.0.0", private: true, packageManager, ...(dependencies ? { dependencies } : {}) }, null, 2)}\n`,
      );
    }

    /**
     * The pnpm the repository itself pins, so the test runs the one CI runs --
     * on the runner this is the same value pnpm/setup installed, so the fixture
     * needs no second copy fetched. Asserted rather than cast: dropped from the
     * root manifest it would vanish from the fixture too, silently, and the
     * fixture would quietly run whichever pnpm happened to be on PATH.
     */
    const { packageManager } = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      packageManager?: string;
    };
    expect(packageManager).toMatch(/^pnpm@\d/);

    let fixture: string;

    beforeEach(() => {
      fixture = mkdtempSync(join(tmpdir(), "canoncore-frozen-"));
      manifest();
      // A lockfile that matches the manifest, written by pnpm rather than by
      // hand so that what the assertions below meet is a real one.
      //
      // The ONE install here without `--offline`, and it was tried with it:
      // pinning `packageManager` makes pnpm resolve pnpm itself as a config
      // dependency, which offline cannot do against a cold store. On a runner
      // that fails the seed outright with ERR_PNPM_BAD_CONFIG_DEP rather than
      // falling back (run 34504945322). It is not an extra point of failure:
      // a registry this cannot reach has already failed the job at
      // pnpm/setup, several steps earlier.
      const seeded = spawnSync("pnpm", ["install", "--lockfile-only"], {
        cwd: fixture,
        encoding: "utf8",
        env: baseEnvironment(),
      });
      expect(seeded.status, `${seeded.stdout}${seeded.stderr}`).toBe(0);
    });

    afterEach(() => {
      rmSync(fixture, { recursive: true, force: true });
    });

    it("fails an install whose manifest has moved ahead of the lockfile", () => {
      // Paired with the clean case in the same test: an assertion that only
      // watched a bad manifest fail would pass just as well with pnpm missing,
      // since a command that is not there also exits non-zero.
      expect(install(pnpmSettingsFromWorkflow())).not.toContain("ERR_PNPM_OUTDATED_LOCKFILE");

      manifest({ "canoncore-not-a-real-package": "^1.0.0" });

      expect(install(pnpmSettingsFromWorkflow())).toContain("ERR_PNPM_OUTDATED_LOCKFILE");
    });

    it("is the workflow's own doing, and not something the environment was going to do anyway", () => {
      // The control. Same desynced manifest, same command, same absent CI --
      // only the workflow's variables removed. pnpm gets as far as resolving,
      // which is precisely what a frozen install never does.
      //
      // The fixture is SEEDED with no dependencies -- the manifest gains one
      // here, the lockfile it was seeded from records none -- and that is what
      // keeps this honest rather than being a detail of it. pnpm's CI default
      // did not fire on a project in that state when it was measured, though it
      // does on one whose lockfile records a real dependency (ADR-0106). So on
      // THIS project the workflow's own variable is the only thing that can
      // produce the error above, which is what the assertion needs to measure.
      manifest({ "canoncore-not-a-real-package": "^1.0.0" });

      const output = install({});

      // Both halves, because the negative alone is satisfied by pnpm being
      // missing, crashing, or never having run -- the same trap the first test
      // avoids by pairing its failure with a clean file that must pass. Getting
      // as far as resolution is the positive evidence that pnpm ran and did not
      // freeze.
      expect(output).toContain("Failed to resolve dependency");
      expect(output).not.toContain("ERR_PNPM_OUTDATED_LOCKFILE");
    });
  });
});
