/**
 * The container image's own statements, read out of the files that make them:
 * `.dockerignore`, the `Dockerfile` and the image jobs in `ci.yml`.
 *
 * Same reason as `ci-workflow.test.ts` and `docker-compose.test.ts` (ADR-0103):
 * the values are written where TypeScript cannot see them, so nothing else
 * would catch one of them moving. The Node major is NOT here -- it belongs to
 * `node-major.test.ts`, which holds all five of its statements to one rule.
 *
 * WHAT THIS FILE CANNOT DO is say whether the image works. That is the image
 * job's smoke test, which builds it, runs it against a real Postgres and asks
 * it for a page. These are the properties that are SILENT until an image is in
 * somebody's hands: a developer `.env` baked into a published layer says
 * nothing at all until it is read back out.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { data, Evaluator, Lexer, Parser } from "@actions/expressions";
import { describe, expect, it } from "vitest";
import { allSteps, type Step, type Workflow, workflow } from "./testing/ci-workflow";
import { repoRoot } from "./testing/repo-root";

const dockerignore = () => readFileSync(join(repoRoot, ".dockerignore"), "utf8");

/**
 * Paths that must never reach the build context, each with what it costs when
 * it does.
 *
 * `**\/.env*` IS THE ONE THAT MATTERS and it is why this file exists. There was
 * no `.dockerignore` at all when this image was first built, and `.env` is
 * copied into the standalone output by a naive `COPY . .` -- so the first
 * published image would have carried the developer's own database credentials
 * into a public registry, where ADR-0114 records that a string cannot be taken
 * back.
 */
const NEVER_IN_THE_CONTEXT = [
  { pattern: "**/.env*", cost: "a developer's credentials, published" },
  {
    pattern: "**/node_modules",
    cost: "the host's modules, including the wrong platform's binaries",
  },
  { pattern: "**/.next", cost: "a stale build, shadowing the one this image makes" },
  { pattern: ".git", cost: "the whole history, in a layer" },
];

describe("the build context", () => {
  it("excludes every path that must never reach it", () => {
    const lines = dockerignore()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"));

    const missing = NEVER_IN_THE_CONTEXT.filter(({ pattern }) => !lines.includes(pattern)).map(
      ({ pattern, cost }) => `${pattern} (${cost})`,
    );
    expect(missing).toStrictEqual([]);
  });

  /**
   * AND THE WAY BACK IN. `.dockerignore` reads top to bottom and a later `!`
   * line re-includes what an earlier one excluded, so a file can name every
   * pattern above and still ship all of them. That is one line, it looks like
   * an exception somebody needed, and the test above cannot see it.
   */
  it("re-includes none of them further down", () => {
    const reincluded = dockerignore()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("!"))
      .filter((line) =>
        NEVER_IN_THE_CONTEXT.some(({ pattern }) =>
          line.includes(pattern.replace("**/", "").replace("*", "")),
        ),
      );

    expect(reincluded).toStrictEqual([]);
  });
});

/** The registry and repository the image publishes to. */
const IMAGE = "ghcr.io/jacobdrees-canoncore/canoncore";

/** The visibility a stranger's `docker pull` needs the package to have. */
const REQUIRED_VISIBILITY = "public";

/** The slice of the `github` context the publish conditions are keyed on. */
type GithubContext = { ref: string; event_name: string; repository: string };

/** A push to the default branch, which is the only event allowed to publish. */
const PUSH_TO_MAIN: GithubContext = {
  ref: "refs/heads/main",
  event_name: "push",
  repository: "jacobdrees-canoncore/CanonCore",
};

/** A pull request, which must build and smoke-test without publishing. */
const PULL_REQUEST: GithubContext = {
  ref: "refs/pull/7/merge",
  event_name: "pull_request",
  repository: "jacobdrees-canoncore/CanonCore",
};

/**
 * A PUSH TO A BRANCH THAT IS NOT `main`, which `on:` does not admit today and
 * which is the case that tells a correct condition from a coincidence.
 *
 * `github.event_name != 'pull_request'` publishes on exactly the same events as
 * `github.ref == 'refs/heads/main'` while the triggers are what they are, so a
 * suite that only tries the two live events passes both. Widen `on:` by one
 * branch pattern -- or add a `workflow_dispatch` -- and the first one publishes
 * an unreviewed image while nothing in this file has changed. The criterion is
 * "from the default branch", so that is what is asked.
 */
const PUSH_TO_A_BRANCH: GithubContext = {
  ref: "refs/heads/jacobdrees/cncore-63-dockerfile",
  event_name: "push",
  repository: "jacobdrees-canoncore/CanonCore",
};

/**
 * A PUSH OF A VERSION TAG, which is the release (CNCORE-70) and the second
 * event allowed to publish. It carries no branch at all, so every condition
 * written as `github.ref == 'refs/heads/main'` is false under it and the
 * release would publish nothing.
 */
const PUSH_OF_A_VERSION_TAG: GithubContext = {
  ref: "refs/tags/v0.1.0",
  event_name: "push",
  repository: "jacobdrees-canoncore/CanonCore",
};

/**
 * A PUSH OF A TAG THAT IS NOT A RELEASE, and the case that tells a correct
 * release condition from a lazy one. `startsWith(github.ref, 'refs/tags/')`
 * admits this and reads exactly as plausibly as the condition that does not.
 *
 * NOT HYPOTHETICAL: this is the tag ADR-0115's evidence records against these
 * repositories -- `archive/tardis-pipeline-2026-09-04`, a snapshot of a data
 * pipeline. An image published from it would carry that name in the registry
 * beside the versions.
 *
 * WHAT EXCLUDES IT HERE IS THE `v`, and that is worth saying plainly because
 * the obvious second reason is wrong: `on:` could not have admitted this tag
 * under ANY single-star pattern, since GitHub's `*` does not match `/` and
 * reaching across one needs `**`. So this fixture exercises the step
 * conditions and not the trigger, which the trigger's own test covers.
 */
const PUSH_OF_A_TAG_THAT_IS_NOT_A_RELEASE: GithubContext = {
  ref: "refs/tags/archive/tardis-pipeline-2026-09-04",
  event_name: "push",
  repository: "jacobdrees-canoncore/CanonCore",
};

/**
 * Whether Actions would run a step carrying `condition`, under `github`.
 *
 * EVALUATED WITH GITHUB'S OWN PARSER rather than compared as a string, for the
 * reason `ci-workflow.test.ts` gives about the concurrency key: a string
 * comparison agrees with any condition spelled the same way and says nothing
 * about what it DOES. `github.ref == 'refs/heads/main'` and
 * `github.event_name != 'pull_request'` are different conditions that both read
 * plausibly, and only one of them stays right when a second branch appears.
 */
function runs(condition: unknown, github: GithubContext): boolean {
  if (condition === undefined) return true;
  const root = new data.Dictionary();
  const context = new data.Dictionary();
  for (const [key, value] of Object.entries(github)) {
    context.add(key, new data.StringData(String(value)));
  }
  root.add("github", context);

  const expression = String(condition).replace(/^\s*\$\{\{(.*)\}\}\s*$/s, "$1");
  const { tokens } = new Lexer(expression).lex();
  return (
    new Evaluator(new Parser(tokens, ["github"], []).parse(), root).evaluate().coerceString() ===
    "true"
  );
}

/**
 * A workflow value with `${{ env.X }}` resolved against the workflow's own env
 * block, so a reference written once and used five times reads back as the
 * thing it resolves to rather than as the expression.
 */
function resolveEnv(value: unknown, parsed: Workflow): string {
  return String(value ?? "").replace(/\$\{\{\s*env\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_, name) =>
    String(parsed.env?.[name] ?? `<unset:${name}>`),
  );
}

/**
 * Every step that would PUBLISH: one that pushes to a registry, or logs in so
 * that something else can.
 *
 * Found by what a step DOES rather than by its name. `push: true` and
 * `push-by-digest` are build-push-action's inputs; `imagetools create` writes
 * the manifest list that makes the two architectures one image; and a registry
 * login is included because a login on a pull request is a credential handed to
 * a build that had no business holding one.
 */
function publishingSteps(parsed: Workflow): { job: string; jobIf: unknown; step: Step }[] {
  return allSteps(parsed).filter(({ step }) => {
    const inputs = step.with ?? {};
    return (
      inputs.push === true ||
      inputs.push === "true" ||
      String(inputs.outputs ?? "").includes("push") ||
      step.uses?.startsWith("docker/login-action") === true ||
      /imagetools\s+create/.test(step.run ?? "")
    );
  });
}

/**
 * THE STEPS THAT GET A PAGE OUT OF THE BUILT IMAGE.
 *
 * BOTH HALVES IN ONE STEP, AND THAT IS THE CORRECTION RATHER THAN A DETAIL.
 * This filter asked only for a step that ran `canoncore:smoke` at first, and a
 * mutation caught it: deleting the image from the step that SERVES left the
 * assertion green, because the step below it that proves the container
 * REFUSES to serve an unmigrated database runs the same tag and matched
 * instead. A run and an answer in two different steps is not evidence that the
 * shipped entry point served anything.
 */
function stepsThatServeTheBuiltImage(parsed: Workflow): Step[] {
  const steps = parsed.jobs?.image?.steps ?? [];
  // Not vacuous: a renamed or deleted job would satisfy every assertion below
  // by having no subject, which is the failure this whole file is written
  // against.
  expect(
    steps.length,
    "the `image` job has no steps, so nothing below has a subject",
  ).toBeGreaterThan(0);

  return steps.filter((step) => {
    const shell = theShellOf(step);
    return /docker\s+run\b/.test(shell) && /canoncore:smoke/.test(shell) && /curl/.test(shell);
  });
}

/**
 * A STEP'S SHELL WITH ITS COMMENTS TAKEN OUT, because an assertion about code
 * that prose can satisfy is not an assertion about code.
 *
 * MEASURED, NOT FEARED. The 404 assertion below matched the whole `run:` block
 * at first, and the step EXPLAINS itself in a comment -- "an unknown id must
 * come back 404 -- the app asked and found nothing". So changing the guard
 * itself to `[ "$code" = "200" ]` left the test green: the number it was
 * looking for was still there, in the sentence about the number. That is the
 * vacuous premise [[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]]
 * is about, and the workflow's own comments are unusually long, which makes
 * this file unusually exposed to it.
 *
 * A `#` MUST START A WORD TO BE A COMMENT, which is what keeps `${DIGEST#sha256:}`
 * in the publish steps from being read as one.
 */
function theShellOf(step: Step): string {
  return (step.run ?? "")
    .split("\n")
    .map((line) => line.replace(/(^|\s)#.*$/, "$1"))
    .join("\n");
}

/**
 * THE SMOKE TEST THE E2E SUITE'S ENTRY POINT LEANS ON (ADR-0185, CNCORE-302).
 *
 * THIS IS AN ARGUMENT AND NOT ONLY AN ASSERTION, so it is worth stating the
 * argument before the code. `apps/web/next.config.ts` sets `output:
 * "standalone"` and the e2e harness serves every one of its eleven instances
 * with `next start`, which Next warns is not the entry point that
 * configuration ships. ADR-0185 accepts that warning, and the acceptance is
 * CONDITIONAL: it holds only because SOMETHING ELSE runs the entry point that
 * does ship. That something else is the `image` job below.
 *
 * SO THE CONDITION IS WHAT IS PINNED HERE. `next start` and
 * `.next/standalone/apps/web/server.js` load the same `.next/server` output
 * through the same `startServer`, and differ in which `node_modules` resolve:
 * the shipped tree carries ONLY WHAT TRACING FOUND -- 30 packages, measured on
 * 16.3.4 -- where `next start` resolves from the whole workspace. A module the
 * app reaches that the trace did not carry works under `next start` and fails
 * under the server that ships, and `next start` cannot see the difference
 * because it never consults the subset. That is the one class of defect the
 * e2e suite is structurally blind to.
 *
 * THE `Dockerfile`'S MIGRATOR TREE IS NOT AN INSTANCE OF IT, which is worth
 * saying because this docblock claimed it was at first. That workaround exists
 * because the migrator is code the app NEVER reaches, so tracing correctly
 * left it out. It is evidence of how small the subset is, not of a trace miss.
 *
 * WHICH MAKES THIS THE ASSERTION THAT KEEPS ADR-0185 TRUE. Delete the smoke
 * test, or weaken it to a route that answers without opening a connection, and
 * nothing anywhere runs the shipped entry point -- while the e2e suite goes on
 * reporting its 374 green tests and claiming it tests the page that ships. The
 * claim becomes false with nothing in the diff saying so, which is the shape
 * [[0181-a-check-is-evidence-only-for-the-commit-it-ran-against]] is about.
 */
describe("the smoke test the e2e suite's entry point leans on", () => {
  /**
   * THE IMAGE'S OWN SERVER, not a build on the runner. `docker run` of the tag
   * the build step loaded is what makes this the shipped entry point at all:
   * the Dockerfile's `CMD` is `node apps/web/server.js`, so running the image
   * is the only thing in this repository that executes that file.
   */
  it("runs the server that ships, and gets an answer out of it", () => {
    const parsed = workflow();

    expect(
      stepsThatServeTheBuiltImage(parsed).map(({ name }) => name),
      "no step both runs the built image and asks it for a page, so the standalone entry point is served nowhere",
    ).not.toStrictEqual([]);
  });

  /**
   * AND IT RUNS ON A PULL REQUEST, which is the event this condition is FOR.
   *
   * The assertions either side of this one read the job's steps and never its
   * `if`. So gating the `image` job on `main` would leave both of them green
   * while no pull request ran the shipped entry point at all -- and a branch is
   * exactly where a change that breaks it arrives. The suite's own acceptance
   * (ADR-0185) is about what runs BEFORE a merge, so the event is part of the
   * claim rather than a detail of it.
   */
  it("does that on a pull request, and not only once something has merged", () => {
    const parsed = workflow();
    const serving = stepsThatServeTheBuiltImage(parsed).filter((step) =>
      runs(step.if, PULL_REQUEST),
    );

    expect(
      runs(parsed.jobs?.image?.if, PULL_REQUEST),
      "the `image` job does not run on a pull request, so nothing runs the shipped entry point before a merge",
    ).toBe(true);
    expect(
      serving.map(({ name }) => name),
      "every step that serves the built image is conditioned off on a pull request",
    ).not.toStrictEqual([]);
  });

  /**
   * A ROUTE THAT READS THE DATABASE, which is the half that carries the proof.
   *
   * `/` answers 200 with the server never having opened a connection, so a
   * smoke test that asked only for it would pass against an image whose traced
   * module subset cannot reach PostgreSQL at all. An unknown id must come back
   * 404 -- the app asked and found nothing -- and never 500, which is what an
   * unreachable driver produces. The workflow says so in its own comment; this
   * holds it to it.
   */
  it("asks it a question only a server that reached its database can answer", () => {
    const parsed = workflow();
    const asking = stepsThatServeTheBuiltImage(parsed).filter((step) =>
      /\/items\/[0-9a-f]{8}-[0-9a-f-]+/.test(theShellOf(step)),
    );

    expect(
      asking.map(({ name }) => name),
      "the smoke test asks for no database-backed route, so it would pass against an image that cannot reach PostgreSQL",
    ).not.toStrictEqual([]);

    // THE COMPARISON ITSELF, not the number anywhere in the step. Stripping the
    // comments was not enough: flipping the guard to `= "200"` leaves `not 404.`
    // standing in its own error message, so a bare /404/ went on passing against
    // a step that accepts a 200. What is pinned is the shape that DECIDES --
    // `$code` tested against 404 -- and that granularity is part of the claim
    // ([[0169-a-check-answers-at-one-granularity-and-that-is-part-of-its-claim]]):
    // rename the variable or restructure the guard and this goes red and wants
    // rewriting, which is the right end to fail at.
    for (const step of asking) {
      expect(
        theShellOf(step),
        `${step.name} reads a database-backed route without holding its status to 404`,
      ).toMatch(/\[\s*"\$code"\s*!?=\s*"404"\s*\]/);
    }
  });
});

describe("the image's own labels", () => {
  /**
   * THE LABELS THE DOCKERFILE STATES, which nothing was holding.
   *
   * `image.test.ts` checked the WORKFLOW's `labels:` input and stopped there, so
   * an image built by hand -- `docker build .`, which is what somebody reading
   * the repository does -- carried whatever the Dockerfile happened to say. The
   * two are separate statements of one election and this is what keeps them
   * equal to the manifest, which ADR-0113 makes the election's home.
   */
  it("declares the licence election the manifest declares", () => {
    const { license } = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      license: string;
    };
    const declared = /org\.opencontainers\.image\.licenses="([^"]+)"/.exec(
      readFileSync(join(repoRoot, "Dockerfile"), "utf8"),
    );

    expect(declared?.[1]).toBe(license);
  });

  /**
   * AND THE SOURCE, which is the label that makes the image's AGPL offer
   * reachable: it is how somebody holding only a pulled image finds the
   * corresponding source. It is required by the ticket alongside the licence and
   * was equally unheld.
   */
  it("points at the repository the source is offered from", () => {
    const declared = /org\.opencontainers\.image\.source="([^"]+)"/.exec(
      readFileSync(join(repoRoot, "Dockerfile"), "utf8"),
    );

    expect(declared?.[1]).toBe("https://github.com/jacobdrees-canoncore/CanonCore");
  });
});

describe("publishing the image", () => {
  /**
   * THE TRIGGER, WHICH EVERY CONDITION BELOW IS CONDITIONAL ON. A step guarded
   * `if: startsWith(github.ref, 'refs/tags/v')` on a workflow whose `on:` never
   * admits a tag is a publish that reads correct and has never once run, and
   * every assertion in this file about what it does under a tag passes on the
   * strength of a condition nothing evaluates.
   *
   * AND IT IS THE AUTHORITATIVE GATE, which is why the exact pattern is pinned
   * rather than merely "some tag". The `if:` conditions can only ask
   * `startsWith(..., 'refs/tags/v')`, because Actions expressions have no
   * globbing -- so `vtest` satisfies every one of them and publishes nothing
   * at all, purely because this line refuses to start a run for it. The two
   * gates are deliberately different strengths and this is the strong one.
   *
   * A `v` PREFIX IS NOT A VERSION, which is the mistake this pattern replaced.
   * `v*` reads like "a version tag" and means "starts with v". The shape here
   * is GitHub's own documented one for semantic versions, whose cheat sheet
   * gives `v[12].[0-9]+.[0-9]+`: `[0-9]` is a character range and `+` is
   * one-or-more of what precedes it (read 2026-09-12).
   */
  it("runs at all on a push of a version tag", () => {
    expect(workflow().on?.push?.tags).toStrictEqual(["v[0-9]+.[0-9]+.[0-9]+"]);
  });

  /**
   * THE ONE THAT COSTS SOMETHING IF IT IS WRONG. A pull request comes from a
   * branch nobody has reviewed; a push from it to `:latest` is an unreviewed
   * image under the project's own name, and the people who would notice are the
   * ones who pulled it.
   *
   * Every publishing step is evaluated under both events with GitHub's own
   * expression parser, so a condition that is merely PRESENT but wrong -- keyed
   * on the event name instead of the branch, say -- fails here.
   */
  it("publishes on a push to the default branch or a version tag, and never on a pull request", () => {
    const parsed = workflow();
    const publishers = publishingSteps(parsed);

    // Not vacuous: an image job that stopped pushing, or a renamed action,
    // would empty this list and leave the assertion below agreeing with nothing.
    expect(publishers.length).toBeGreaterThan(0);

    for (const [event, github] of [
      ["a pull request", PULL_REQUEST],
      ["a push to a branch that is not the default", PUSH_TO_A_BRANCH],
      ["a push of a tag that is not a release", PUSH_OF_A_TAG_THAT_IS_NOT_A_RELEASE],
    ] as const) {
      const published = publishers
        .filter(({ jobIf, step }) => runs(jobIf, github) && runs(step.if, github))
        .map(({ job, step }) => `${job}: ${step.name ?? step.uses ?? step.run}`);
      expect(published, `these steps publish on ${event}`).toStrictEqual([]);
    }

    // And the other half: a condition that never fires publishes nothing ever,
    // which passes the assertion above perfectly. BOTH events are required to
    // reach EVERY publishing step -- a release that logs in, pushes one
    // architecture and never binds the manifest list publishes two untagged
    // digests and no version anybody can pull.
    for (const [event, github] of [
      ["a push to the default branch", PUSH_TO_MAIN],
      ["a push of a version tag", PUSH_OF_A_VERSION_TAG],
    ] as const) {
      const published = publishers.filter(
        ({ jobIf, step }) => runs(jobIf, github) && runs(step.if, github),
      );
      expect(published.length, `these steps publish on ${event}`).toBe(publishers.length);
    }
  });

  /**
   * AND THE PIPELINE FIRES AS ONE THING, which the assertion above cannot see.
   *
   * It enumerates the steps that PUBLISH -- the two logins, the digest push and
   * the manifest list -- and two more steps in the `image` job are conditional
   * on the same ref without publishing anything themselves: the one that writes
   * the digest to a file and the one that uploads it. Narrow either and the
   * publish still "runs": both architectures push their digests, the manifest
   * job starts, downloads nothing, and dies on its own `found -ge 2` guard. A
   * release that got as far as two untagged manifests in the registry and no
   * tag binding them.
   *
   * SO THE PROPERTY IS AGREEMENT rather than a second list of steps to keep in
   * step with the file. Every step in these jobs that is keyed on `github.ref`
   * at all must admit exactly the same events, and this asks that of the set
   * without naming a single one of them.
   */
  it("runs every ref-conditional step of the publish on the same events", () => {
    const parsed = workflow();

    const conditioned = allSteps(parsed).filter(({ step }) =>
      String(step.if ?? "").includes("github.ref"),
    );
    // Not vacuous: conditions rewritten to key on anything else would empty
    // this and leave the loop below agreeing about nothing.
    expect(conditioned.length).toBeGreaterThan(2);

    const events = [
      ["a pull request", PULL_REQUEST],
      ["a push to a branch that is not the default", PUSH_TO_A_BRANCH],
      ["a push of a tag that is not a release", PUSH_OF_A_TAG_THAT_IS_NOT_A_RELEASE],
      ["a push to the default branch", PUSH_TO_MAIN],
      ["a push of a version tag", PUSH_OF_A_VERSION_TAG],
    ] as const;

    const disagreeing = events
      .map(([event, github]) => ({
        event,
        // Read off the STEP's own condition rather than the job's, because a
        // job-level `if` suppressing everything under it would make every step
        // in that job agree perfectly on `false`.
        running: conditioned.filter(({ step }) => runs(step.if, github)).length,
      }))
      .filter(({ running }) => running !== 0 && running !== conditioned.length)
      .map(({ event, running }) => `${event}: ${running} of ${conditioned.length}`);

    expect(disagreeing).toStrictEqual([]);
  });

  /**
   * BOTH ARCHITECTURES, EACH ON ITS OWN METAL. A single runner can produce both
   * by emulation -- `platforms: linux/amd64,linux/arm64` is one line and it
   * works -- and Docker's own documentation says emulation is "much slower".
   * The defect is silent: the image is correct, the build is just far slower,
   * and nothing in the file says which of the two arrangements it is.
   */
  it("builds each architecture on a runner of that architecture", () => {
    const parsed = workflow();

    const matrix = Object.values(parsed.jobs ?? {})
      .flatMap((job) => job.strategy?.matrix?.include ?? [])
      .filter((entry) => typeof entry.platform === "string");
    expect(matrix.length).toBeGreaterThan(0);

    const pairs = matrix.map((entry) => ({
      platform: String(entry.platform),
      runner: String(entry.runner ?? ""),
    }));

    expect(pairs.map(({ platform }) => platform).sort()).toStrictEqual([
      "linux/amd64",
      "linux/arm64",
    ]);

    // GitHub spells an Arm runner with an `-arm` suffix and an x64 one without.
    const emulated = pairs.filter(
      ({ platform, runner }) => platform.endsWith("/arm64") !== runner.endsWith("-arm"),
    );
    expect(emulated).toStrictEqual([]);
  });

  /**
   * ONE PLATFORM PER BUILD, which is the other way the arrangement above
   * collapses into emulation: a matrix of two runners that each ask for both
   * platforms builds everything twice, half of it emulated.
   */
  it("asks each build for one platform only", () => {
    const parsed = workflow();

    const builds = allSteps(parsed).filter(({ step }) =>
      step.uses?.startsWith("docker/build-push-action"),
    );
    expect(builds.length).toBeGreaterThan(0);

    const multiple = builds
      .filter(({ step }) => String(step.with?.platforms ?? "").includes(","))
      .map(({ job, step }) => `${job}: ${step.with?.platforms}`);
    expect(multiple).toStrictEqual([]);
  });

  /**
   * THE PRECISE SPDX FORM, WHICH ONLY SURVIVES HERE IF IT IS SAID OUT LOUD.
   *
   * `docker/metadata-action` builds `org.opencontainers.image.licenses` from
   * `this.repo.license?.spdx_id` -- GitHub's own detected value, which for this
   * repository is the DEPRECATED bare `AGPL-3.0` (read from the repositories API
   * on 2026-09-11). `licensee`, which GitHub detects with, "does not parse"
   * SPDX expressions, so the election can never come from there.
   *
   * So the generated label is wrong unless the workflow overrides it, and a
   * label that is wrong looks exactly like one that is right. The action
   * keeps the LAST value given for a label name, which is what makes the
   * override work. The Dockerfile states the same election for a hand-built
   * image, and the two tests above hold both to the manifest.
   */
  it("states the licence election itself rather than inheriting GitHub's", () => {
    const parsed = workflow();
    const { license } = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      license: string;
    };

    const metadata = allSteps(parsed).filter(({ step }) =>
      step.uses?.startsWith("docker/metadata-action"),
    );
    expect(metadata.length).toBeGreaterThan(0);

    const notPinned = metadata
      .filter(
        ({ step }) =>
          !String(step.with?.labels ?? "").includes(`org.opencontainers.image.licenses=${license}`),
      )
      .map(({ job }) => job);
    expect(notPinned).toStrictEqual([]);
  });

  /**
   * THE VERSION IS ON THE IMAGE, which is the whole of what CNCORE-70 buys.
   *
   * The trigger and the conditions above get a tag build as far as PUSHING, and
   * a push whose metadata step writes only `type=ref` and `type=sha` publishes
   * `sha-1a2b3c4` and nothing else -- so the release note has no version to
   * name and `docker pull ...:0.1.0` answers `manifest unknown`. Everything
   * would be green: the build ran, the image published, the assert found the
   * package public.
   *
   * `type=semver,pattern={{version}}` is the tagger for this, and only for
   * this: it is documented as being for push-tag events and produces nothing on
   * a branch push, so `latest` is unaffected and `main` publishes exactly what
   * it published before. On `v0.1.0` it writes `0.1.0` -- the `v` is not part
   * of a semver version, which is why the tag and the image tag differ by it.
   * Read from docker/metadata-action's own README, 2026-09-12.
   *
   * ASKED OF BOTH METADATA STEPS, and the honest reason is that they are one
   * statement written twice rather than that both are load-bearing. Only the
   * MANIFEST step's tags reach the registry: the per-architecture job pushes
   * with `push-by-digest=true`, which ignores tags entirely, and uses its
   * metadata step for the labels alone. The two blocks are identical today,
   * every entry in them, and holding them identical is what stops a later
   * reader wiring the first one up and getting a different tag set from the
   * one this file checks.
   */
  it("tags the image with the version when a version tag builds it", () => {
    const parsed = workflow();

    const metadata = allSteps(parsed).filter(({ step }) =>
      step.uses?.startsWith("docker/metadata-action"),
    );
    expect(metadata.length).toBeGreaterThan(1);

    const versionless = metadata
      .filter(
        ({ step }) => !/type=semver,pattern=\{\{version\}\}/.test(String(step.with?.tags ?? "")),
      )
      .map(({ job }) => job);
    expect(versionless).toStrictEqual([]);
  });

  /**
   * The scope, for the same reason `ci-workflow.test.ts` asserts `packages: read`
   * on the jobs pulling a private image: a push with no `packages: write` fails
   * at the registry with a permission error that names nothing useful.
   */
  it("gives the publishing jobs the scope to write a package", () => {
    const parsed = workflow();

    const publishers = new Set(publishingSteps(parsed).map(({ job }) => job));
    expect(publishers.size).toBeGreaterThan(0);

    const unscoped = [...publishers].filter(
      (job) => parsed.jobs?.[job]?.permissions?.packages !== "write",
    );
    expect(unscoped).toStrictEqual([]);
  });

  /**
   * NO ATTESTATION STEP, and this is a limit rather than a preference.
   * `actions/attest-build-provenance` needs GitHub Enterprise Cloud for private
   * repositories; this organisation is Free. The repository is public today, so
   * the step would work -- and it is still refused here, because the thing that
   * would make it fail again is a visibility flip, which is one click and leaves
   * no diff. A publish that breaks on a setting change is worse than no
   * attestation.
   */
  it("attests nothing, because the plan this organisation is on cannot", () => {
    const attesting = allSteps(workflow())
      .filter(({ step }) => step.uses?.includes("actions/attest") === true)
      .map(({ job, step }) => `${job}: ${step.uses}`);

    expect(attesting).toStrictEqual([]);
  });

  /**
   * ONE IDENTITY, ONE DERIVATION, which is provider-wiki's own recorded defect
   * (CNCORE-45) rather than a hypothetical. The name is written for the tags,
   * for the digest push, for the manifest list and for the visibility assert
   * below -- and until that ticket those were separate derivations that agreed
   * only by coincidence. Rename the package and the push writes the new one
   * while the assert asks about the old, which passes having checked a package
   * nothing published.
   *
   * The references are resolved through the workflow's `env` block, so the
   * property held here is that they all come from ONE place, not that four
   * literals happen to match. The last assertion then pins what that one place
   * says, which is the single literal this suite owns: without it a workflow
   * that consistently named the wrong registry would pass.
   */
  it("names the published image in exactly one place", () => {
    const parsed = workflow();

    const references = allSteps(parsed).flatMap(({ step }) => {
      const inputs = step.with ?? {};
      const named: string[] = [];
      if (step.uses?.startsWith("docker/metadata-action")) {
        named.push(resolveEnv(inputs.images, parsed).trim());
      }
      if (typeof inputs.outputs === "string") {
        const name = /name=([^,\s]+)/.exec(resolveEnv(inputs.outputs, parsed));
        if (name?.[1]) named.push(name[1]);
      }
      return named;
    });

    // Not vacuous: the tags, the digest push, and the manifest job's own tags.
    expect(references.length).toBeGreaterThan(2);
    expect([...new Set(references)]).toStrictEqual([IMAGE]);
    expect(parsed.env?.IMAGE).toBe(IMAGE);
  });

  /**
   * AND A RELEASE DOES NOT MOVE `latest`, SAID RATHER THAN ARRIVED AT.
   *
   * `latest` here means the head of `main`: it is published by the explicit
   * `type=raw,value=latest,enable={{is_default_branch}}` entry, `compose.yaml`
   * names it, and the README documents it as what a merge publishes. A release
   * re-pointing it would change that meaning silently and backwards -- tag an
   * older commit for a 0.1.1 and `latest` would go back in time.
   *
   * IT WAS ALREADY NOT HAPPENING, BY ACCIDENT, WHICH IS WHY THIS IS PINNED.
   * `flavor.latest` defaults to `auto`, and under `auto` metadata-action's
   * `procSemver` computes `latest = true` for any non-prerelease semver tag.
   * The only thing suppressing it is the ORDER of the tag list: `setVersion`
   * is `if (version.latest == undefined) version.latest = latest`, so the
   * first entry processed freezes the flag, and `type=sha` happens to sit
   * above `type=semver` and freezes it `false`. Move one line past the other,
   * or drop `type=sha`, and the next release re-points `latest` with nothing
   * in the diff saying so. Read from `src/meta.ts` on 2026-09-12.
   *
   * `latest=false` MAKES IT A STATEMENT instead, and costs `main` nothing: the
   * flavor governs only the AUTOMATIC latest, while `procRaw` emits the value
   * it was given either way -- so the raw entry above goes on publishing
   * `latest` from the default branch exactly as before.
   */
  it("never lets a release re-point latest", () => {
    const parsed = workflow();

    const metadata = allSteps(parsed).filter(({ step }) =>
      step.uses?.startsWith("docker/metadata-action"),
    );
    expect(metadata.length).toBeGreaterThan(1);

    const automatic = metadata
      .filter(({ step }) => !/latest=false/.test(String(step.with?.flavor ?? "")))
      .map(({ job }) => job);
    expect(automatic).toStrictEqual([]);
  });

  /**
   * AND WHAT IT SAYS IT PUBLISHED IS WHAT IT PUBLISHED.
   *
   * The manifest job ends by inspecting the image and printing it, which is the
   * only human-readable record of a release in the run log. It named `:latest`
   * outright, and that was true for as long as `main` was the only thing that
   * published. A VERSION TAG DOES NOT WRITE `latest` -- `enable={{is_default_branch}}`
   * is false when no branch triggered the run -- so the release run would have
   * inspected the tag the PREVIOUS push wrote and reported it as this one's,
   * which is a false green of the kind that reads like evidence.
   *
   * DERIVED RATHER THAN RESTATED, which is the same rule the `IMAGE` test above
   * holds the four identity references to: the tags this run wrote are an
   * output of the metadata step, so the report takes them from there and cannot
   * name one that was not written.
   */
  it("reports the tags this run wrote rather than a tag it assumes", () => {
    const reports = allSteps(workflow()).filter(({ step }) =>
      /imagetools\s+inspect/.test(step.run ?? ""),
    );
    expect(reports.length).toBe(1);

    const [report] = reports;
    if (!report) throw new Error("nothing reports what was published");
    expect(report.step.run).toContain("DOCKER_METADATA_OUTPUT_JSON");
    // The specific restatement it used to carry, and the one a reader adding a
    // "just show me latest" line back would reach for first.
    expect(report.step.run).not.toContain(":latest");
  });

  /**
   * THE PACKAGE IS PUBLIC, AND NOTHING IN A WORKFLOW CAN MAKE IT SO.
   *
   * GitHub's own documentation: "if you publish a package that is linked to a
   * repository, the package automatically inherits the access permissions (but
   * not the visibility) of the linked repository" -- so a PUBLIC repository
   * publishes a PRIVATE package, and the REST API for organisation packages has
   * no endpoint that changes visibility. It is a web-UI click -- TWO of them, in
   * two different settings pages, which CNCORE-64 found by walking it on
   * 2026-09-11: the organisation's Package creation policy has to admit Public
   * first, or the package's own Change visibility dialog renders Public disabled
   * under "Setting is disabled by organization administrators". `ci.yml`'s
   * failure message names both in order, because a reader who has only the
   * second one arrives at a control they cannot click.
   *
   * WHICH MAKES THIS A FALSE GREEN WAITING TO HAPPEN, and the reason it is
   * asserted rather than trusted: everyone who would test the install path is
   * logged in to ghcr.io, so the pull succeeds for them and fails for every
   * stranger -- the only audience the published image exists for. ADR-0089
   * already requires the mirror of this on the provider images, which assert
   * they have not stopped reading `private`. This is that mechanism with the
   * opposite expected value.
   */
  it("asserts the published package is one a stranger can pull", () => {
    const parsed = workflow();

    const asserts = allSteps(parsed).filter(
      ({ step }) => /packages\/container/.test(step.run ?? "") && /visibility/.test(step.run ?? ""),
    );
    expect(asserts.length).toBe(1);

    const [assertion] = asserts;
    if (!assertion) throw new Error("no step reads the package's visibility");
    const { jobIf, step } = assertion;
    expect(step.run).toContain(REQUIRED_VISIBILITY);

    // It runs where the package exists -- after a publish, never on a pull
    // request, where there is nothing to ask about and no token to ask with.
    expect(runs(jobIf, PULL_REQUEST) && runs(step.if, PULL_REQUEST)).toBe(false);
    expect(runs(jobIf, PUSH_TO_MAIN) && runs(step.if, PUSH_TO_MAIN)).toBe(true);
  });
});
