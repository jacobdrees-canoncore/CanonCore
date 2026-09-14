import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SUITE_GUARD, turboTaskInvocations, workflow } from "./testing/ci-workflow";
import { repoRoot } from "./testing/repo-root";

/**
 * The guard every CI job that runs a suite invokes, DRIVEN rather than read.
 *
 * `turbo run <task>` exits 0 having run nothing, so a suite that vanished
 * reports success. This file is the half of CNCORE-160 that shows the flip:
 * a workspace whose package declares a test script, and the same workspace
 * with that script deleted, through the script CI actually runs.
 */

// The one the workflow names, resolved rather than restated: a guard moved
// in `ci.yml` and not here would leave this file driving a script no job
// runs, still green.
const guard = join(repoRoot, SUITE_GUARD);

/**
 * The package manager the root manifest names, which turbo resolves a workspace
 * THROUGH: without a `packageManager` field it refuses the run outright with
 * "Could not resolve workspace" rather than reporting a plan.
 *
 * READ rather than transcribed, because a transcribed version drifts the moment
 * the root manifest moves and takes this whole file down with a failure that
 * says nothing about the guard.
 */
function packageManager(): string {
  const root = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
    packageManager?: string;
  };
  if (root.packageManager === undefined) {
    throw new Error(
      "the root manifest names no packageManager, so turbo cannot resolve a workspace",
    );
  }
  return root.packageManager;
}

/**
 * A turbo workspace of ONE package, built in a temp directory.
 *
 * A SCRATCH WORKSPACE RATHER THAN THIS REPOSITORY, because the demonstration is
 * a test script being DELETED and no suite may edit the tree it runs in. What
 * is borrowed from this repository is the part that must not be a stand-in: the
 * turbo binary it pins, symlinked in so the runner under test is the runner CI
 * runs, and the package manager its root manifest names.
 */
function scratchWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "run-suite-"));
  mkdirSync(join(root, "packages", "one"), { recursive: true });
  mkdirSync(join(root, "node_modules"), { recursive: true });
  mkdirSync(join(root, "node_modules", ".bin"), { recursive: true });
  // BOTH, and the second is not redundant: `.bin` is what pnpm puts on the
  // PATH, and the package directory is what turbo looks for to decide it is
  // locally installed. With only the first it runs, warns that it fell back to
  // a global install, and the fixture's claim about which turbo is under test
  // stops being true.
  for (const path of [join("node_modules", "turbo"), join("node_modules", ".bin", "turbo")]) {
    symlinkSync(join(repoRoot, path), join(root, path));
  }
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "scratch",
      private: true,
      packageManager: packageManager(),
      scripts: { test: "turbo run test" },
    }),
  );
  writeFileSync(join(root, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
  writeFileSync(join(root, "turbo.json"), JSON.stringify({ tasks: { test: { cache: false } } }));
  return root;
}

/** What the one package declares: a suite that passes, one that fails, or none. */
type Suite = "passes" | "fails" | "deleted";

const SCRIPTS: Record<Suite, Record<string, string>> = {
  passes: { test: 'node --eval ""' },
  fails: { test: 'node --eval "process.exit(1)"' },
  deleted: {},
};

function declares(root: string, suite: Suite): void {
  writeFileSync(
    join(root, "packages", "one", "package.json"),
    JSON.stringify({ name: "one", scripts: SCRIPTS[suite] }),
  );
}

function runGuard(root: string): { status: number | null; output: string } {
  const run = spawnSync("bash", [guard, "test"], { cwd: root, encoding: "utf8" });
  if (run.error) throw run.error;
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

describe("the guard a CI suite job runs behind", () => {
  let root: string;

  beforeEach(() => {
    root = scratchWorkspace();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("passes a workspace whose package declares the suite", () => {
    declares(root, "passes");
    const { status, output } = runGuard(root);
    expect(status, output).toBe(0);
  });

  /**
   * CNCORE-160's second acceptance criterion, DEMONSTRATED: the same workspace,
   * the same guard, the test script gone. Turbo reports `Tasks: 0 successful,
   * 0 total` and exits 0, which is the whole defect -- so the pair above and
   * below is what says the guard, and not the runner, is what reddens this.
   */
  it("fails the same workspace once that test script is deleted", () => {
    declares(root, "deleted");
    const { status, output } = runGuard(root);
    expect(status, output).not.toBe(0);
  });

  /**
   * AND THE HALF A COUNT CHECK CAN QUIETLY TAKE AWAY. A suite that ran and
   * failed reports `Tasks: 0 successful, 1 total`, which the count check reads
   * as no suite at all -- so a guard that ran the task and then only looked at
   * the count would report the wrong reason, and one that swallowed the status
   * to reach the count would report none. The pipeline's own failure has to
   * stay fatal ahead of the count.
   */
  it("fails a workspace whose suite ran and failed, on the suite's own status", () => {
    declares(root, "fails");
    const { status, output } = runGuard(root);
    expect(status, output).not.toBe(0);
    expect(output).not.toContain("ran no tasks at all");
  });
});

/**
 * Which scripts a CI job could be running a suite through, READ OFF THE ROOT
 * MANIFEST rather than listed here.
 *
 * A list written here would be a second copy of the root's `scripts` block,
 * going stale the first time a suite is added -- and going stale SILENTLY, in
 * the direction that matters: the new suite's job would simply not be one this
 * file had an opinion about, which is the shape of hole CNCORE-160 is closing.
 *
 * `:watch` is out for ADR-0103's reason rather than this file's: Turborepo's
 * Vitest shape gives a watch twin to every suite, and it is the one script here
 * meant not to run once.
 */
function suiteScripts(): string[] {
  const root = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  return Object.keys(root.scripts ?? {}).filter(
    (name) => /^test(:|$)/.test(name) && !/:watch$/.test(name),
  );
}

/** Every job in the workflow, with the turbo tasks its `run:` steps invoke. */
function jobs(): { job: string; invocations: { task: string; guarded: boolean }[] }[] {
  return Object.entries(workflow().jobs ?? {}).map(([job, definition]) => ({
    job,
    invocations: turboTaskInvocations(definition),
  }));
}

describe("a CI job that runs a suite", () => {
  /*
   * The canary, and it counts what EXISTS. Every suite the root manifest
   * declares is one CI is expected to run, so a suite added and never wired to
   * a job fails here -- and so does the whole file losing its subject, which is
   * the silent pass this suite is about arriving through the suite itself.
   */
  it("runs every suite the root manifest declares, so the check below has a subject", () => {
    const guarded = jobs().flatMap(({ invocations }) =>
      invocations.filter(({ guarded }) => guarded).map(({ task }) => task),
    );
    const unrun = suiteScripts().filter((script) => !guarded.includes(script));
    expect(unrun).toStrictEqual([]);
  });

  /**
   * CNCORE-160's first acceptance criterion. `turbo run <task>` exits 0 having
   * run nothing, so a job invoking the runner BARE reports success for a suite
   * that is no longer there. The `test` job carried the only count check in the
   * file; the other four ran `pnpm test:e2e`, `pnpm test:browser` and
   * `pnpm test:contract` with nothing reading what came back.
   */
  it("never invokes that suite bare, where a missing one would go green", () => {
    const scripts = suiteScripts();
    const bare = jobs().flatMap(({ job, invocations }) =>
      invocations
        .filter(({ task, guarded }) => !guarded && scripts.includes(task))
        .map(
          ({ task }) =>
            `the \`${job}\` job runs \`pnpm ${task}\` directly. \`turbo run ${task}\` exits 0 ` +
            `having run zero tasks, so deleting that suite turns this job green. Run it ` +
            `through \`${SUITE_GUARD}\` instead.`,
        ),
    );
    expect(bare).toStrictEqual([]);
  });
});
