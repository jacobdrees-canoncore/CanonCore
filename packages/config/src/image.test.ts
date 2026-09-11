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
   * THE ONE THAT COSTS SOMETHING IF IT IS WRONG. A pull request comes from a
   * branch nobody has reviewed; a push from it to `:latest` is an unreviewed
   * image under the project's own name, and the people who would notice are the
   * ones who pulled it.
   *
   * Every publishing step is evaluated under both events with GitHub's own
   * expression parser, so a condition that is merely PRESENT but wrong -- keyed
   * on the event name instead of the branch, say -- fails here.
   */
  it("publishes on a push to the default branch and never on a pull request", () => {
    const parsed = workflow();
    const publishers = publishingSteps(parsed);

    // Not vacuous: an image job that stopped pushing, or a renamed action,
    // would empty this list and leave the assertion below agreeing with nothing.
    expect(publishers.length).toBeGreaterThan(0);

    for (const [event, github] of [
      ["a pull request", PULL_REQUEST],
      ["a push to a branch that is not the default", PUSH_TO_A_BRANCH],
    ] as const) {
      const published = publishers
        .filter(({ jobIf, step }) => runs(jobIf, github) && runs(step.if, github))
        .map(({ job, step }) => `${job}: ${step.name ?? step.uses ?? step.run}`);
      expect(published, `these steps publish on ${event}`).toStrictEqual([]);
    }

    const onMain = publishers.filter(
      ({ jobIf, step }) => runs(jobIf, PUSH_TO_MAIN) && runs(step.if, PUSH_TO_MAIN),
    );
    // And the other half: a condition that never fires publishes nothing ever,
    // which passes the assertion above perfectly.
    expect(onMain.length).toBe(publishers.length);
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
   * THE PACKAGE IS PUBLIC, AND NOTHING IN A WORKFLOW CAN MAKE IT SO.
   *
   * GitHub's own documentation: "if you publish a package that is linked to a
   * repository, the package automatically inherits the access permissions (but
   * not the visibility) of the linked repository" -- so a PUBLIC repository
   * publishes a PRIVATE package, and the REST API for organisation packages has
   * no endpoint that changes visibility. It is a web-UI click.
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
