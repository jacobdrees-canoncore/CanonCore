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
import { globSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { data, Evaluator, Lexer, Parser } from "@actions/expressions";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  allSteps,
  type Job,
  pnpmSetupSteps,
  type Step,
  SUITE_GUARD,
  type Workflow,
  workflow,
} from "./testing/ci-workflow";
import { repoRoot } from "./testing/repo-root";
import { namedConfig, packageScripts, resolvesInside, testBlockOf } from "./testing/vitest-configs";

/**
 * The exact ref every step must use, so that the input list below cannot
 * silently go stale: a bump to `@v4` fails this and forces someone to re-read
 * the action's `action.yml` before editing the list.
 *
 * This does constrain one reasonable future change -- pinning the action by
 * commit SHA, as the gitleaks image above it is pinned by digest -- and that is
 * the right trade rather than an oversight. A SHA says nothing about which
 * inputs the action has, so a SHA pin makes the list below unverifiable from
 * the file it describes. Pin by SHA and this constant becomes the only place
 * recording which version was read; update both together.
 */
const PNPM_SETUP_REF = "pnpm/setup@v3";

/**
 * Every input `pnpm/setup@v3` declares, transcribed from the `inputs:` block of
 * the action's own `action.yml` at that ref on 2026-09-25. Restated here rather
 * than fetched, so the suite needs no network -- and so that adding a key to a
 * step means editing this list and checking the vendor first.
 *
 * Only the `inputs:` block. v3's `outputs:` block names `dest` again beside
 * `bin-dest`, `runtime-name`, `runtime-version`, `runtimes` and `cache-hit`,
 * and none of those can be passed under `with:`.
 *
 * `require-lockfile` is here because v3 added it; v2 never had it, which is
 * the defect this suite was written for (CNCORE-13, ADR-0106). No step passes
 * it: lockfile strictness stays with pnpm's own setting, below, which reaches
 * every install in the file rather than only the one this action runs.
 */
const PNPM_SETUP_INPUTS = new Set([
  "version",
  "dest",
  "runtime",
  "node-version-file",
  "cache",
  "cache-dependency-path",
  "working-directory",
  "package-json-file",
  "require-lockfile",
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

/** The workflow this suite reads, as `git grep` pathspecs in it spell the path. */
const WORKFLOW_PATH = ".github/workflows/ci.yml";

/** The registry the private provider images live in (ADR-0089). */
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
 * A step that runs its check and then throws the verdict away: `pnpm lint ||
 * true`, or the shell's do-nothing builtin `pnpm lint || :`.
 *
 * `true` carries a word boundary so `|| truthy` is not a match; `:` must not,
 * because `\b` after a non-word character requires a word character next and
 * `|| :` at the end of a line has none. The regex spelled `(true|:)\b` -- which
 * is what this was until CNCORE-80 -- therefore never matched the `:` form at
 * all, while two comments and an ADR claimed it did. Probed both ways.
 */
const swallowsFailure = (step: Step) => /\|\|\s*(true\b|:)/.test(step.run ?? "");

/**
 * The four checks CNCORE-80 split back into named jobs, each mapped to the jobs
 * carrying it -- found by what the step RUNS rather than by the job's name, so
 * a rename cannot carry the subject away and leave a test passing over nothing.
 *
 * Shared by the two tests below because they ask two halves of one question:
 * that the four are four, and that none of the four has been defanged. Written
 * out twice, a check added or renamed in one would silently stop being asked
 * about in the other.
 *
 * TWO OF THE FOUR RUN BEHIND THE GUARD (CNCORE-191), and that is exactly the
 * Shotgun Surgery `testing/ci-workflow.ts`'s header describes, arriving again:
 * moving `typecheck` and `build` behind `run-suite.sh` emptied both finders at
 * once, and this file went red rather than quietly passing over nothing --
 * which is what finding them by what they RUN buys. `lint` is not among them
 * because `pnpm lint` is `biome ci` rather than turbo, and biome exits 1 when
 * it processes no files, so it needs no guard.
 *
 * THE GUARD'S PATH IS RESOLVED RATHER THAN SPELLED, so the script moving in
 * `ci.yml` cannot leave these finders looking for a command nothing runs.
 */
function staticCheckCarriers(parsed: Workflow): Record<string, string[]> {
  return {
    typecheck: jobsWithStep(parsed, runsExactly(`${SUITE_GUARD} typecheck`)),
    lint: jobsWithStep(parsed, runsExactly("pnpm lint")),
    build: jobsWithStep(parsed, runsExactly(`${SUITE_GUARD} build`)),
    "env guard": jobsWithStep(parsed, blanksDatabaseUrl),
  };
}

/**
 * The one secret every run has whether a store holds it or not: GitHub mints
 * `GITHUB_TOKEN` per run. It is why the private image PULLS fine on a Dependabot
 * pull request while the container still refuses to start -- the credentials
 * block is satisfied and the `env:` block is empty -- and therefore why a gate
 * keyed on it would gate on nothing.
 *
 * `secret` RATHER THAN `Credential`, DELIBERATELY, and they are not one noun
 * here. `CONTEXT.md` defines a Credential as what a Provider needs to reach its
 * own upstream, and tells this repository to avoid `secret` for it. A GitHub
 * Actions secret is the STORE SLOT this workflow reads: GitHub's own word for
 * GitHub's own thing, which is the allowance `CLAUDE.md` already makes for a
 * provider's own external record. So the functions name the Credential and
 * their fields name the slot, and the split is the subject rather than drift --
 * `TMDB_READ_ACCESS_TOKEN` is ONE Credential living in TWO stores, and only one
 * of the two has it.
 */
const SECRET_MINTED_PER_RUN = "GITHUB_TOKEN";

/** Every `secrets.NAME` a value names, in the one spelling an expression has. */
function secretsNamed(value: unknown): string[] {
  return [...String(value).matchAll(/secrets\.([A-Za-z_][A-Za-z0-9_]*)/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

/**
 * `needs:` in BOTH shapes the schema allows -- one name as a plain string, or a
 * sequence of them. Reading only the list form would report a singly-dependent
 * job as depending on nothing, which here means reporting a gated job as
 * ungated.
 */
function dependencies(job: Job): string[] {
  if (typeof job.needs === "string") return [job.needs];
  return Array.isArray(job.needs)
    ? job.needs.filter((name: unknown): name is string => typeof name === "string")
    : [];
}

/**
 * Every stored secret a job's SERVICE CONTAINERS need before that job can
 * start, named by the service asking for it.
 *
 * SERVICES RATHER THAN STEPS, because that is where the timing bites: a service
 * that cannot start takes the job down at `Initialize containers`, so this is
 * the set of secrets whose absence is unrecoverable rather than merely awkward.
 */
function jobsNeedingACredential(
  parsed: Workflow,
): { job: string; service: string; secret: string }[] {
  return Object.entries(parsed.jobs ?? {}).flatMap(([job, definition]) =>
    Object.entries(definition.services ?? {}).flatMap(([service, { env }]) =>
      Object.values(env ?? {})
        .flatMap(secretsNamed)
        .filter((secret) => secret !== SECRET_MINTED_PER_RUN)
        .map((secret) => ({ job, service, secret })),
    ),
  );
}

/**
 * The two words the probe job and the gates agree on, and the ONLY place either
 * meaning is written down in this suite.
 *
 * Catching an INVERTED gate requires knowing which verdict means reachable, and
 * that knowledge has to live somewhere. Here it is the contract between the two
 * jobs rather than an implementation detail of either: change the probe to emit
 * `yes`/`no` and this is the one line that moves with it.
 */
const REACHABLE = "true";
const NOT_REACHABLE = "false";

/** A nested plain object as the evaluator's data, so a fixture reads as the YAML does. */
function asData(value: Contexts[string] | string): data.ExpressionData {
  if (typeof value === "string") return new data.StringData(value);
  const dictionary = new data.Dictionary();
  for (const [key, inner] of Object.entries(value)) dictionary.add(key, asData(inner));
  return dictionary;
}

type Contexts = Record<string, { [key: string]: Contexts[string] | string }>;

/**
 * Whether a condition RUNS the job or step it sits on, given the contexts it
 * can see.
 *
 * **The evaluation is GitHub's own**, for the reason `render` above gives: a
 * test that matched an `if:` as TEXT would restate the file and agree with any
 * condition spelled the same way -- including the INVERTED one. Asking what a
 * condition DOES is the only form that can tell `== 'true'` from `== 'false'`,
 * and both reviewers of CNCORE-203 found that gap in the version of this that
 * matched text.
 */
function conditionRuns(condition: string, contexts: Contexts): boolean {
  const root = new data.Dictionary();
  for (const [name, value] of Object.entries(contexts)) root.add(name, asData(value));

  // `if:` is evaluated as an expression whether or not it is wrapped, and both
  // spellings are legal, so the wrapper is stripped rather than required.
  const inner = /^\s*\$\{\{(.*)\}\}\s*$/s.exec(condition)?.[1] ?? condition;
  const { tokens } = new Lexer(inner).lex();
  const result = new Evaluator(
    new Parser(tokens, Object.keys(contexts), []).parse(),
    root,
  ).evaluate();

  /*
   * Actions' own truthiness, which is NOT JavaScript's, and the bare form is
   * the whole trap. `if: needs.credentials.outputs.tmdb` reads like a boolean
   * and is a STRING: the value `false` is a non-empty string, so the job would
   * run exactly when the credential is missing. Measured against this
   * evaluator rather than assumed -- that expression returns Kind.String
   * `"false"`, where the comparison forms return Kind.Boolean.
   */
  switch (result.kind) {
    case data.Kind.Null:
      return false;
    case data.Kind.Boolean:
      return result.coerceString() === "true";
    case data.Kind.Number:
      return result.number() !== 0;
    case data.Kind.String:
      return result.coerceString() !== "";
    default:
      return true;
  }
}

/**
 * Whether this job runs only when THIS secret is reachable, walked end to end
 * and then EVALUATED, rather than pattern-matched on the `if:` text.
 *
 * The chain has four links and every one of them can be wired wrong while
 * reading right: the gate names `needs.<job>.outputs.<key>`; that job is really
 * in `needs:` (naming an output of a job you do not depend on is an expression
 * that evaluates to nothing, silently, and skips the job forever); it really
 * publishes that key; and the step whose id that key's value reads was handed
 * THIS secret rather than another one.
 *
 * AND THEN THE POLARITY, which is the link none of the other four can see.
 * `== 'false'` satisfies every one of them and inverts the fix -- running both
 * jobs exactly when the token is absent, which is the state they cannot start
 * in. So the condition is run twice, against a verdict each way, and has to
 * agree with both.
 */
function gatesOn(parsed: Workflow, job: string, secret: string): boolean {
  const definition = parsed.jobs?.[job];
  if (definition === undefined) return false;
  const gate = typeof definition.if === "string" ? definition.if : "";
  const needed = dependencies(definition);
  return [...gate.matchAll(/needs\.([\w-]+)\.outputs\.([\w-]+)/g)].some(([, answerer, key]) => {
    if (answerer === undefined || key === undefined || !needed.includes(answerer)) return false;
    const answering = parsed.jobs?.[answerer];
    const published = answering?.outputs?.[key];
    const computedBy = /steps\.([\w-]+)\.outputs\./.exec(published ?? "")?.[1];
    // An output that is not a step's is not a verdict this can vouch for, and
    // the `undefined` would otherwise MATCH the first step carrying no `id` --
    // passing on that step's env, which is a false green in the one check whose
    // whole purpose is refusing one.
    if (computedBy === undefined) return false;
    const step = (answering?.steps ?? []).find(({ id }) => id === computedBy);
    const handedThisSecret = Object.values(step?.env ?? {})
      .flatMap(secretsNamed)
      .includes(secret);
    const given = (verdict: string): Contexts => ({
      needs: { [answerer]: { outputs: { [key]: verdict } } },
    });
    return (
      handedThisSecret &&
      conditionRuns(gate, given(REACHABLE)) &&
      !conditionRuns(gate, given(NOT_REACHABLE))
    );
  });
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
   * it. GitHub documents `continue-on-error` as preventing "a workflow run from
   * failing when a job fails": the job still runs, still sits on the pull
   * request under its own name, and the run goes green regardless. An `if:`
   * skips the job, and a skipped job is still listed rather than absent -- as
   * `One image, both architectures` is on every pull request here. Neither key
   * takes a check away, which is what a reader of the checks list would notice.
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
    // Not vacuous, and it is the VALUES that are counted rather than the keys.
    // Counting the keys would be counting the object literal the helper returns,
    // which is four whatever `ci.yml` contains -- an assertion that cannot fail
    // is not a guard. A check that is dropped, or whose command changes, empties
    // its carrier list, which this catches and that would not. A job RENAMED
    // empties nothing, because these finders read what a step runs rather than
    // what its job is called; that is the point of finding them that way.
    expect(Object.values(carrying).flat()).toHaveLength(4);

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
      const swallowed = steps.filter(swallowsFailure).map((step) => step.name ?? step.run);
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

    // The list above describes v3 and nothing else.
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
   * CNCORE-203, and the defect is that a check CANNOT pass rather than that it
   * fails. `provider-tmdb` refuses to start without `TMDB_READ_ACCESS_TOKEN`
   * (ADR-0035), GitHub keeps a SEPARATE secret store for Dependabot, and this
   * repository has nothing in it -- so on every Dependabot pull request the two
   * jobs that start that image died at `Initialize containers` with
   * `Failed to initialize container`, before their first step. Measured
   * identically on #120, #122 and #123 on 2026-09-18: `fail 2, pass 12`. A bump
   * whose checks cannot pass has no merge gate at all, so a dependency that
   * really broke the contract suite would look exactly like the seventeen that
   * did not.
   *
   * THE GATE HAS TO SIT ON THE JOB, and that is forced rather than chosen: a
   * service container that will not start fails the job before any step runs,
   * so a step-level `if:` never gets the chance. And `jobs.<job_id>.if` cannot
   * see the `secrets` context -- GitHub's context availability table gives it
   * `github, needs, vars, inputs` -- so the job cannot ask the question itself.
   * `jobs.<job_id>.outputs` CAN see it. One job answers, the rest read the
   * answer through `needs`, which is the only shape that works.
   *
   * IT IS CHECKED PAIRWISE, secret by secret, rather than as "has some gate".
   * A second provider with a second credential is the ordinary next change here
   * -- `provider-wiki` already runs beside `provider-tmdb` in `contract` -- and
   * a job gated on the wrong one reads exactly like a job gated on the right
   * one. So the chain is walked all the way: the gate names an output, a job in
   * `needs` publishes it, and the step that computed it was handed THIS secret.
   */
  it("gates every job on the credential its service containers cannot start without", () => {
    const parsed = workflow();
    const needing = jobsNeedingACredential(parsed);

    // Not vacuous: two jobs start a provider that will not boot without a
    // stored token today. Dropping the service's `env:` block would otherwise
    // empty this and pass, which is the same silent green this test is about.
    expect(needing.length).toBeGreaterThan(0);

    const ungated = needing.flatMap(({ job, service, secret }) =>
      gatesOn(parsed, job, secret)
        ? []
        : [
            `the \`${job}\` job starts ${service}, which cannot start without ` +
              `\`${secret}\`, and nothing gates the job on that secret being reachable. ` +
              `A run without it dies at \`Initialize containers\` before the first step, ` +
              `so the check reports red about the credential rather than about the change.`,
          ],
    );
    expect(ungated).toStrictEqual([]);
  });

  /**
   * THE ANSWERER MUST NOT BE GATEABLE, which is the hole the gate above opens
   * and cannot see. A condition on the job that publishes the verdict makes it
   * SKIP, a skipped job's outputs are empty, every gate reading one evaluates
   * false, and every job behind it skips too -- so the whole provider half of
   * CI disappears and the run goes GREEN having checked none of it. That is
   * worse than the defect CNCORE-203 fixed: red about the wrong thing is at
   * least visible.
   *
   * `continue-on-error` IS CHECKED BESIDE `if`, for the reason ADR-0111 gives
   * about the four static checks: both are valid job keys, and the second
   * defangs a whole job at once. A verdict job allowed to fail soft would
   * publish nothing and skip everything just the same.
   *
   * AND `needs` IS CHECKED BESIDE BOTH, because it is the INDIRECT form and the
   * one nobody would think to look for. A verdict job made to wait on another
   * job inherits that job's skip: nothing about the verdict job itself reads
   * conditional, and everything behind it disappears all the same. So the rule
   * is that this job waits on nothing at all, which is also what `ci.yml`
   * claims about it on its face.
   */
  it("lets nothing gate or defang the job those gates read their answer from", () => {
    const parsed = workflow();

    const answerers = [
      ...new Set(
        jobsNeedingACredential(parsed).flatMap(({ job }) =>
          dependencies(parsed.jobs?.[job] ?? {}).filter(
            (needed) => Object.keys(parsed.jobs?.[needed]?.outputs ?? {}).length > 0,
          ),
        ),
      ),
    ];

    // Not vacuous: a gate rewired to read a job that publishes nothing would
    // otherwise empty this list and pass having asked about no job at all.
    expect(answerers.length).toBeGreaterThan(0);

    const conditional = answerers.flatMap((job) => {
      const definition = parsed.jobs?.[job] ?? {};
      const keys = [
        ...(definition.if === undefined ? [] : ["if"]),
        ...(definition["continue-on-error"] === undefined ? [] : ["continue-on-error"]),
        ...(definition.needs === undefined ? [] : ["needs"]),
      ];
      return keys.length === 0
        ? []
        : [
            `the \`${job}\` job publishes the verdict other jobs gate on, and carries ` +
              `\`${keys.join("` and `")}\`. Its outputs are empty when it does not run, so ` +
              `every job gated on one skips and the run goes green having checked none of them.`,
          ];
    });
    expect(conditional).toStrictEqual([]);
  });

  /**
   * THE OTHER WAY THIS GATE COULD GO QUIET, and it is the one keying on the
   * credential rather than on the author buys: a repository secret DELETED or
   * RENAMED would skip both jobs on `main` too, green, with `test:contract`
   * then running nowhere at all. Trading a red that means nothing for a green
   * that checks nothing would be no fix.
   *
   * A PULL REQUEST HAS TWO INNOCENT EXPLANATIONS AND A PUSH HAS NONE --
   * Dependabot reads its own store, a fork gets no repository secret -- so the
   * honest report off a pull request is red. The four cases are asked of the
   * condition rather than of its text, the way the concurrency tests above ask
   * what the key DOES: a condition that merely mentions `event_name` would
   * satisfy any reading of the words and none of these.
   */
  it("refuses an absent credential on a ref where no pull request could explain it", () => {
    const parsed = workflow();

    const answerers = [
      ...new Set(
        jobsNeedingACredential(parsed).flatMap(({ job }) =>
          dependencies(parsed.jobs?.[job] ?? {}).filter(
            (needed) => Object.keys(parsed.jobs?.[needed]?.outputs ?? {}).length > 0,
          ),
        ),
      ),
    ];

    const unguarded = answerers.flatMap((job) => {
      const steps = parsed.jobs?.[job]?.steps ?? [];
      const verdicts = Object.values(parsed.jobs?.[job]?.outputs ?? {}).flatMap(
        (published) => /steps\.([\w-]+)\.outputs\.([\w-]+)/.exec(published) ?? [],
      );
      const [, computedBy, key] = verdicts;
      if (computedBy === undefined || key === undefined) {
        return [
          `the \`${job}\` job publishes no verdict computed by a step, so nothing here applies`,
        ];
      }

      const context = (reachable: string, event: string) => ({
        steps: { [computedBy]: { outputs: { [key]: reachable } } },
        github: { event_name: event },
      });
      // Every step that can redden the job, which is every one carrying a
      // condition: the refusal is whichever of them runs in the bad case, and
      // naming it here would pin the shape rather than the behaviour.
      const refuses = (reachable: string, event: string) =>
        steps.some(
          (step) =>
            typeof step.if === "string" && conditionRuns(step.if, context(reachable, event)),
        );

      const wrong = [
        ...(refuses(REACHABLE, "push") ? ["reddens a push that HAS the credential"] : []),
        ...(refuses(REACHABLE, "pull_request") ? ["reddens a pull request that HAS it"] : []),
        ...(refuses(NOT_REACHABLE, "pull_request")
          ? ["reddens a pull request without it, which Dependabot and every fork cannot help"]
          : []),
        ...(refuses(NOT_REACHABLE, "push")
          ? []
          : ["lets a push with NO credential pass, so a deleted secret skips both jobs green"]),
      ];
      return wrong.map((fault) => `the \`${job}\` job ${fault}.`);
    });
    expect(unguarded).toStrictEqual([]);
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
          step["continue-on-error"] !== undefined || step.if !== undefined || swallowsFailure(step),
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

/** The suite whose files the jobs below divide between them. */
const E2E_TASK = "test:e2e";

/**
 * The root Vitest resolves an e2e `--exclude` against, DERIVED rather than
 * spelled `apps/web` here: the package that declares `test:e2e` is the one the
 * runner starts in, so a suite that moved would take this reader with it rather
 * than leave it globbing the wrong tree.
 *
 * IT THROWS ON ANY ANSWER BUT ONE, the way `workspace.ts` throws: two packages
 * declaring the task means an exclusion resolves against two roots and the rows
 * below cannot say which, and none means there is no e2e suite to be asking
 * about at all.
 */
function e2eRoot(): string {
  const declared = packageScripts().filter(({ script }) => script === E2E_TASK);
  if (declared.length !== 1) {
    throw new Error(
      `${declared.length} packages declare \`${E2E_TASK}\`, so what a \`--exclude\` resolves ` +
        `against is not one directory`,
    );
  }
  return join(repoRoot, declared[0]?.directory ?? "");
}

/**
 * Every run of the e2e suite through the guard, with the files it is told to
 * leave out (CNCORE-343).
 *
 * READ OFF WHAT THE GUARD FORWARDS, in both spellings Vitest takes:
 * `--exclude <glob>` and `--exclude=<glob>`. A reader that knew only one would
 * count a job written in the other as leaving nothing out -- and the row below
 * would then report a file as running somewhere while it ran nowhere, which is
 * the one failure this pair exists to prevent. The shape of what it reads is
 * asserted rather than trusted, in the second row.
 *
 * THE WALK IS `allSteps`, not a fourth copy of it: `testing/ci-workflow.ts`
 * exists to hold exactly that, and its header names the Shotgun Surgery a
 * private copy here would be.
 */
function e2eRuns(parsed: Workflow): { job: string; excluded: string[]; filters: string[] }[] {
  const guard = SUITE_GUARD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const invocation = new RegExp(`(?:^|\\s)${guard}\\s+${E2E_TASK}(?![\\w:-])(.*)`, "g");
  return allSteps(parsed).flatMap(({ job, step }) =>
    [...(step.run ?? "").matchAll(invocation)].map((match) => {
      const words = (match[1] ?? "").trim().split(/\s+/);
      const excluded = words.flatMap((word, index) => {
        if (word === "--exclude") return words.slice(index + 1, index + 2);
        return word.startsWith("--exclude=") ? [word.slice("--exclude=".length)] : [];
      });
      /*
       * AND THE FILES IT NAMES, which is how a job runs ONE file (CNCORE-396).
       * A positional argument is a Vitest filter, and a job that has any runs
       * only the files one of them matches. Read as a job with nothing left out,
       * it would count as running every file -- so the row below would report a
       * file as covered by the job that names another. Only what follows `--`
       * reaches Vitest; before it sits at most the roll call's package.
       */
      const forwarded = words.slice(words.indexOf("--") + 1);
      const filters = words.includes("--")
        ? forwarded.filter(
            (word, index) => !word.startsWith("-") && forwarded[index - 1] !== "--exclude",
          )
        : [];
      return { job, excluded, filters };
    }),
  );
}

/**
 * The e2e files no job runs: every job leaves each one out, or names others.
 *
 * A FILTER MATCHES AS VITEST'S DOES, by containment in the file's path rather
 * than as a glob -- so `item-page` names `item-page-cost.test.ts` too. The last
 * row of this block drives Vitest to hold it to that.
 */
function filesRunNowhere(parsed: Workflow, files: string[]): string[] {
  const runs = e2eRuns(parsed).map(({ excluded, filters }) => {
    const leftOut = new Set(excluded.flatMap(filesMatching));
    return (file: string) =>
      !leftOut.has(file) &&
      (filters.length === 0 || filters.some((filter) => filesNamedBy(filter, [file]).length > 0));
  });
  return files.filter((file) => !runs.some((runsIt) => runsIt(file)));
}

/**
 * Every file the suite collects, off its own config's `include` (CNCORE-396).
 * The files some job leaves out were enough while every job ran the whole suite
 * less a few; a job that NAMES its files can miss one nobody left out.
 */
async function e2eFiles(): Promise<string[]> {
  const root = e2eRoot();
  const command = packageScripts().find(({ script }) => script === E2E_TASK)?.command ?? "";
  const config = namedConfig(command);
  if (config === undefined) throw new Error(`\`${E2E_TASK}\` names no Vitest config`);
  // Imported, so held inside the package first: `namedConfig` says why.
  if (!resolvesInside(root, join(root, config))) {
    throw new Error(`\`${E2E_TASK}\` names \`${config}\`, which is not inside ${root}`);
  }
  const { include } = await testBlockOf(join(root, config));
  if (include === undefined) throw new Error(`\`${config}\` sets no \`include\``);
  return include.flatMap(filesMatching).sort();
}

/** The files of `files` a filter a job names matches, the way Vitest matches it. */
function filesNamedBy(filter: string, files: string[]): string[] {
  return files.filter((file) => file.includes(filter));
}

/** The files under the e2e root that a glob a job leaves out matches. */
function filesMatching(glob: string): string[] {
  return globSync(glob, { cwd: e2eRoot() });
}

describe("the e2e files a job leaves out or names", () => {
  /**
   * A FILE LEFT OUT OF EVERY JOB RUNS NOWHERE, AND THAT IS GREEN. The `e2e`
   * and `provider` jobs leave out `item-page-cost.test.ts` because the `cost`
   * job names it, so pointing that job at another file would stop the
   * measurement entirely with every job still passing -- the count in
   * `run-suite.sh` cannot see it, because the task still runs and still reports
   * one.
   */
  it("reads a job that names its files as running those files and no others", () => {
    const run = (argumentsForVitest: string) => ({
      steps: [{ run: `${SUITE_GUARD} ${E2E_TASK} -- ${argumentsForVitest}` }],
    });
    // Real files, because an exclusion is globbed against the tree.
    const files = ["e2e/item-page-cost.test.ts", "e2e/search.test.ts"];

    const divided = {
      jobs: {
        e2e: run("--exclude e2e/item-page-cost.test.ts"),
        cost: run("e2e/item-page-cost.test.ts"),
      },
    };
    expect(filesRunNowhere(divided, files)).toStrictEqual([]);

    // THE CASE THE FILTER EXISTS TO CATCH: the job that names one file is not a
    // job that runs every file, so leaving a second one out of `e2e` leaves it
    // out of the run.
    const dropped = {
      jobs: {
        e2e: run("--exclude e2e/item-page-cost.test.ts --exclude e2e/search.test.ts"),
        cost: run("e2e/item-page-cost.test.ts"),
      },
    };
    expect(filesRunNowhere(dropped, files)).toStrictEqual(["e2e/search.test.ts"]);
  });

  it("leaves no file out of every job that runs the suite", async () => {
    const parsed = workflow();
    // Not vacuous: over no runs at all, nothing is left out of every one.
    expect(e2eRuns(parsed).map(({ job }) => job)).toContain("e2e");
    const files = await e2eFiles();
    expect(files).toContain("e2e/item-page-cost.test.ts");
    expect(filesRunNowhere(parsed, files)).toStrictEqual([]);
  });

  /**
   * AN EXCLUSION THAT MATCHES NOTHING IS A SAVING THAT QUIETLY WENT. Rename the
   * file and Vitest runs it again in the job that meant to leave it out, which
   * costs that job its longest file and reports nothing.
   *
   * AND ITS SHAPE IS ASSERTED FIRST, because the reader above splits a `run:`
   * line on whitespace: a QUOTED glob arrives with its quotes, an ABSOLUTE one
   * makes `cwd` inert and answers about another tree, and either would leave the
   * row above under-reporting what a job leaves out -- silently, which the dead
   * exclusion below at least is not.
   */
  it("leaves out and names only files that are there, as relative globs", async () => {
    const files = await e2eFiles();
    const named = e2eRuns(workflow()).flatMap(({ job, excluded, filters }) => [
      ...excluded.map((glob) => ({ job, glob, verb: "leaves out", matches: filesMatching(glob) })),
      ...filters.map((glob) => ({
        job,
        glob,
        verb: "names",
        matches: filesNamedBy(glob, files),
      })),
    ]);
    // Not vacuous: the `e2e` and `provider` jobs leave one file out today, and
    // the `cost` job names it. Put all three back and this row has nothing to
    // check, which is when to delete it.
    expect(named).not.toStrictEqual([]);
    const misshapen = named
      .filter(
        ({ glob }) =>
          /^["']|["']$/.test(glob) || glob.startsWith("/") || glob.split("/").includes(".."),
      )
      .map(
        ({ job, glob, verb }) =>
          `the \`${job}\` job ${verb} \`${glob}\`, which is not a relative unquoted glob, so ` +
          `what this job runs cannot be read off it`,
      );
    expect(misshapen).toStrictEqual([]);
    const dead = named
      .filter(({ matches }) => matches.length === 0)
      .map(
        ({ job, glob, verb }) => `the \`${job}\` job ${verb} \`${glob}\`, which matches no file`,
      );
    expect(dead).toStrictEqual([]);
  });
  /**
   * AND THAT VITEST HONOURS THE FLAG AT ALL, DRIVEN RATHER THAN TRUSTED. The two
   * rows above read `ci.yml` and would agree with a spelling Vitest had stopped
   * taking: the file would run in the `provider` job again, both rows green and
   * nothing saying so. Measured on the version this repository pins, so a major
   * bump that renamed or dropped `--exclude` fails here.
   *
   * THE ORACLE IS A FILE THAT FAILS, not a count of files. A count says two
   * became one, which a `--exclude` that matched the WRONG file satisfies just as
   * well. A run that is red until the named file is left out and green once it is
   * can only be that file -- and the third run, which leaves out the OTHER file
   * and stays red, is what says the flag removes what it names rather than
   * whatever it likes.
   *
   * AND A GREEN CANNOT BE AN EMPTY RUN. Measured on the pinned version: an
   * exclusion matching every file exits 1 with "No test files found", so there is
   * no way for the middle run to pass by having collected nothing.
   *
   * IT BORROWS THIS PACKAGE'S OWN `node_modules`, the way `run-suite.test.ts`
   * borrows turbo: the runner under test has to be the runner CI runs, and a
   * scratch directory cannot resolve `vitest` without it.
   */
  it("is a flag Vitest honours, so the named file really does not run", () => {
    const scratch = mkdtempSync(join(tmpdir(), "canoncore-exclude-"));
    try {
      symlinkSync(join(import.meta.dirname, "..", "node_modules"), join(scratch, "node_modules"));
      writeFileSync(
        join(scratch, "kept.test.ts"),
        'import { expect, it } from "vitest";\nit("passes", () => expect(1).toBe(1));\n',
      );
      writeFileSync(
        join(scratch, "left-out.test.ts"),
        'import { expect, it } from "vitest";\nit("fails", () => expect(1).toBe(2));\n',
      );
      const vitest = (args: string[]) =>
        spawnSync(join(repoRoot, "node_modules", ".bin", "vitest"), ["run", ...args], {
          cwd: scratch,
          encoding: "utf8",
        });

      const both = vitest([]);
      const withoutTheFailure = vitest(["--exclude", "left-out.test.ts"]);
      const withoutThePass = vitest(["--exclude", "kept.test.ts"]);

      // The control: the failing file is found and red while nothing leaves it
      // out, so the green below is the flag rather than a file Vitest never
      // collected in the first place.
      expect(both.status, `${both.stdout}${both.stderr}`).not.toBe(0);
      expect(
        withoutTheFailure.status,
        `${withoutTheFailure.stdout}${withoutTheFailure.stderr}`,
      ).toBe(0);
      // And the flag took the file it NAMED: leaving the other one out leaves the
      // failure in the run, where an exclusion that dropped files indiscriminately
      // would have gone green here too.
      expect(withoutThePass.status, `${withoutThePass.stdout}${withoutThePass.stderr}`).not.toBe(0);

      // AND A NAMED FILE IS THE ONLY ONE RUN (CNCORE-396), matched by
      // CONTAINMENT, which is how `filesRunNowhere` reads it: `ept` is neither
      // a glob nor a name that matches `kept.test.ts`, only a part of its path.
      // Green is the failing file left uncollected.
      const onlyTheNamed = vitest(["ept"]);
      expect(onlyTheNamed.status, `${onlyTheNamed.stdout}${onlyTheNamed.stderr}`).toBe(0);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
