import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { allSteps, SUITE_GUARD, turboTaskInvocations, workflow } from "./testing/ci-workflow";
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
function scratchWorkspace(task = "test", filter?: string): string {
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
    const target = join(repoRoot, path);
    // Named here rather than left to dangle: a symlink to a missing target is
    // created without complaint, and the fixture would then fail as a confusing
    // pnpm error about a turbo that is not the one this claims to be testing.
    if (!existsSync(target)) {
      throw new Error(`${path} is not installed, so the scratch workspace cannot borrow turbo`);
    }
    symlinkSync(target, join(root, path));
  }
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "scratch",
      private: true,
      packageManager: packageManager(),
      scripts: {
        [task]: filter === undefined ? `turbo run ${task}` : `turbo run ${task} -F ${filter} --`,
      },
    }),
  );
  writeFileSync(join(root, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
  writeFileSync(join(root, "turbo.json"), JSON.stringify({ tasks: { [task]: { cache: false } } }));
  return root;
}

/**
 * What a package declares for the task: one that passes, one that fails, one
 * that passes while writing more than a pipe holds, one that says what it was
 * handed, or none at all.
 */
type Suite = "passes" | "fails" | "deleted" | "chatty" | "echoes";

const COMMANDS: Record<Suite, string | undefined> = {
  passes: 'node --eval ""',
  fails: 'node --eval "process.exit(1)"',
  deleted: undefined,
  // A SUITE THAT OUTRUNS A PIPE BUFFER, which is a real size rather than a
  // large-sounding one: 20,000 lines is well past the 64 KiB a pipe holds, and
  // the hazard the row using this is about only exists once the writer blocks.
  chatty: 'node --eval "for(let i=0;i<20000;i++)console.log(i)"',
  // `echo` RATHER THAN `node --eval`, because node reads a flag after its
  // script as one of its OWN options and refuses it -- so the suite would fail
  // on the very arguments it exists to print.
  echoes: "echo forwarded:",
};

function declares(
  root: string,
  suite: Suite,
  { name = "one", task = "test" }: { name?: string; task?: string } = {},
): void {
  // The DIRECTORY is the name's last segment, because a scoped name has a slash
  // in it and `packages/*` matches one level: `packages/@scratch/db` is not in
  // the workspace at all, and turbo reports it as the package simply not
  // existing rather than as a path mistake.
  const directory = join(root, "packages", name.split("/").at(-1) ?? name);
  const command = COMMANDS[suite];
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ name, scripts: command === undefined ? {} : { [task]: command } }),
  );
}

/**
 * The guard, run the way a CI job runs it: the file EXECUTED, not handed to an
 * interpreter. Its shebang and its executable bit are then part of what is
 * under test, and a lost `+x` fails here rather than only on a runner.
 */
function runGuard(
  root: string,
  task = "test",
  {
    env = {},
    required,
    forwarded,
  }: { env?: Record<string, string>; required?: string; forwarded?: string[] } = {},
): { status: number | null; output: string } {
  const args = [
    task,
    ...(required === undefined ? [] : [required]),
    ...(forwarded === undefined ? [] : ["--", ...forwarded]),
  ];
  const run = spawnSync(guard, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (run.error) throw run.error;
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

/**
 * THE TWO SHAPES TURBO WRITES A TASK'S OUTPUT IN, pinned rather than inherited,
 * because the roll call below reads that output and the shape is not the same
 * in both places.
 *
 * Turbo detects GitHub Actions and switches to GROUPED output there:
 * `::group::<package>:<task>`, with the task's own lines UNPREFIXED inside it.
 * Everywhere else it STREAMS, prefixing every line `<package>:<task>: `. The
 * roll call was written against the streamed shape alone and passed every row
 * of this file on a laptop while failing on the runner -- which is the one place
 * it exists to work. Measured on turbo 2.10.12: `GITHUB_ACTIONS=true` is the
 * switch, and `CI=true` alone is not.
 *
 * So the rows that read the output ask BOTH, rather than whichever the host
 * happens to be. Inheriting it would make this suite agree with itself in each
 * place and disagree between them, which is the failure that got here.
 */
const OUTPUT_MODES = {
  "streamed, as a terminal gets it": { GITHUB_ACTIONS: "" },
  "grouped, as GitHub Actions gets it": { GITHUB_ACTIONS: "true" },
} as const;

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
    // THE GUARD'S OWN RED, not merely a non-zero status. Turbo refuses a task
    // absent from `turbo.json` outright, so a status check alone would pass by
    // construction the day turbo started refusing this case too, and would
    // stop saying anything about the count at all.
    expect(output).toContain("ran no tasks at all");
  });

  /**
   * CNCORE-190, DEMONSTRATED. A count is not a roll call: `test` is declared by
   * ten packages here, so the one that drops its script leaves nine running and
   * a count check reads that as a pass. This is that workspace in miniature --
   * two packages, one suite deleted, `Tasks: 1 successful, 1 total` and green
   * under the rows above.
   *
   * THE CASE IS NOT MERELY ONE OF TEN. The package that drops it is
   * `packages/config`, whose suite is every check this repository makes of its
   * own CI, so the green it buys switches off the rest of them at the same time.
   * Named as the guard's second argument, the run is held to a roll call that
   * nothing inside a `scripts` block can answer for.
   */
  it.each(Object.entries(OUTPUT_MODES))(
    "fails when the package it was told to watch dropped its suite, though another ran (%s)",
    (_mode, env) => {
      declares(root, "deleted");
      declares(root, "passes", { name: "two" });
      const { status, output } = runGuard(root, "test", { env, required: "one" });
      expect(status, output).not.toBe(0);
      expect(output).toContain("never ran");
      // The count is what makes this a DIFFERENT red from the row above: the
      // suite that vanished is invisible to it, which is the whole defect.
      expect(output).toContain("1 successful, 1 total");
    },
  );

  /**
   * A LOG LONGER THAN THE SEARCH, which is where the roll call was WRONG.
   *
   * The guard strips colour into a reader, and a reader that stops at the first
   * match leaves the stripper writing into a closed pipe: it dies of SIGPIPE,
   * `pipefail` hands that status to the whole pipeline, and the guard reads its
   * own success as a failure. A FALSE RED, and one that needs the match to come
   * before the writer finishes -- so every row above passes while it is live,
   * because their logs are a few lines long and the writer is done first.
   *
   * It was live: measured against this repository's real `pnpm test`, where the
   * package announces itself around line 8 of some two hundred, the guard exited
   * 141 and reported a suite that had just run as missing. The scratch workspace
   * could not have found it, which is the reason this row spells the shape out
   * rather than trusting a small fixture to stand for a real one.
   */
  it("finds the package in a log far longer than the match, without a false red", () => {
    declares(root, "passes");
    declares(root, "chatty", { name: "two" });
    // Pinned to one shape because the hazard is the SIZE of the log rather than
    // its shape: the reader must outlast the writer either way.
    const { status, output } = runGuard(root, "test", {
      env: { GITHUB_ACTIONS: "" },
      required: "one",
    });
    expect(status, output.slice(-2000)).toBe(0);
  });

  /**
   * AND THE OTHER HALF OF THE ROLL CALL, without which the row above is
   * satisfied by a guard that simply always fails when handed a package.
   */
  it.each(Object.entries(OUTPUT_MODES))(
    "passes when the package it was told to watch is among the ones that ran (%s)",
    (_mode, env) => {
      declares(root, "passes");
      declares(root, "passes", { name: "two" });
      const { status, output } = runGuard(root, "test", { env, required: "one" });
      expect(status, output).toBe(0);
    },
  );

  /**
   * THE ROLL CALL THROUGH FORCED COLOUR, which is a sharper question than the
   * count's version below it. Turbo writes the package prefix in colour, and
   * the escape sits BEFORE the name rather than inside it -- so a stripped line
   * begins with the prefix exactly, and an unstripped one begins with `\033[35m`
   * and matches nothing at column one. That would be a FALSE RED on a run where
   * the suite was there all along.
   */
  it("reads the roll call through forced colour", () => {
    declares(root, "passes");
    declares(root, "passes", { name: "two" });
    const { status, output } = runGuard(root, "test", {
      // The STREAMED shape, pinned: it is the one that carries the prefix this
      // row is about. Grouped output writes the package into a `::group::`
      // marker instead, which the row above covers.
      env: { FORCE_COLOR: "1", GITHUB_ACTIONS: "" },
      required: "one",
    });
    expect(status, output).toBe(0);
  });

  /**
   * FORCED COLOUR, which the count check reads THROUGH. Turbo writes `Tasks:`
   * plain when it is not on a terminal and wraps the count in SGR escapes when
   * something forces colour, and neither the anchor nor `[1-9]` matches across
   * one -- so a guard that did not strip them would report a suite that ran as
   * a suite that did not. A false RED rather than a false green, which is why
   * it is worth a row rather than a rewrite.
   */
  it("reads the count through forced colour", () => {
    declares(root, "passes");
    const { status, output } = runGuard(root, "test", { env: { FORCE_COLOR: "1" } });
    expect(status, output).toBe(0);
  });

  /**
   * A NAME THAT WOULD REACH PNPM AS AN ARGUMENT, refused before it is run.
   * `--filter=web` arriving where a task belongs is a different command that
   * succeeds and answers about something else -- the hazard
   * `testing/turbo-dry-run.ts` asserts against for the same reason.
   */
  it("refuses a task name that is really a flag, rather than running it", () => {
    declares(root, "passes");
    const { status, output } = runGuard(root, "--filter=one");
    expect(status, output).toBe(2);
    expect(output).toContain("is not a turbo task name");
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

  /**
   * THE SAME REFUSAL ONE SLOT ALONG, which is the `--` left out rather than a
   * package anybody meant. Held here because the guard would otherwise hold the
   * run to a package named `--exclude` and report the suite as never having run
   * -- a false red over a command whose only fault is a missing separator.
   */
  it("refuses a flag where the package belongs, rather than running it", () => {
    declares(root, "passes");
    const { status, output } = runGuard(root, "test", { required: "--exclude" });
    expect(status, output).toBe(2);
    expect(output).toContain("where a package name belongs");
  });

  /**
   * WHAT FOLLOWS `--` REACHES THE SUITE (CNCORE-343), which is how the
   * `provider` job leaves out the one e2e file that never touches a provider.
   *
   * THE LINE THE SUITE PRINTED, not the command pnpm echoes before running it.
   * Both carry the arguments, and only one of them says the suite received
   * them, so the match is anchored where pnpm's `$ echo ...` cannot satisfy it.
   */
  it.each(Object.entries(OUTPUT_MODES))(
    "hands what follows `--` to the suite, and still counts it (%s)",
    (_mode, env) => {
      declares(root, "echoes");
      const { status, output } = runGuard(root, "test", {
        env,
        forwarded: ["--exclude", "e2e/cost.test.ts"],
      });
      expect(status, output).toBe(0);
      expect(output).toMatch(/^(?:one:test: )?forwarded: --exclude e2e\/cost\.test\.ts$/m);
    },
  );
});

/**
 * THE LADDER'S SHAPE, which is a FILTERED root script rather than a plain one.
 *
 * `pnpm db:migrate` is `turbo run db:migrate -F @canoncore/db --`, and a filter
 * matching nothing is the third way this guard's header says a run reaches zero
 * tasks -- alongside a deleted script and a task no package declares. It is the
 * one of the three nothing drove until now, and it is the one under ADR-0047's
 * empty-to-head gate, where a green run having applied no rung at all would
 * report a database built from nothing as built correctly.
 *
 * THE FILTER IS LEFT POINTING AT THE PACKAGE AND THE PACKAGE IS RENAMED, rather
 * than the filter being changed to a name that was never there. That is the way
 * it actually goes wrong: the workspace moves and the root script is not the
 * file anybody thinks to update.
 */
describe("the guard behind a job whose root script filters to one package", () => {
  let root: string;

  beforeEach(() => {
    root = scratchWorkspace("db:migrate", "@scratch/db");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("passes while the filtered package declares the task", () => {
    declares(root, "passes", { name: "@scratch/db", task: "db:migrate" });
    const { status, output } = runGuard(root, "db:migrate");
    expect(status, output).toBe(0);
  });

  it("fails once the filtered package drops the script, where turbo exits 0", () => {
    declares(root, "deleted", { name: "@scratch/db", task: "db:migrate" });
    const { status, output } = runGuard(root, "db:migrate");
    expect(status, output).not.toBe(0);
    expect(output).toContain("ran no tasks at all");
    // The silent green itself, named: turbo reports the run as having nothing
    // to do rather than as broken, and hands back 0.
    expect(output).toContain("0 successful, 0 total");
  });

  /**
   * AND THE CASE THE GUARD DOES NOT NEED TO CATCH, pinned because the guard's
   * header CLAIMED IT DID until this row was written.
   *
   * "A filter matching none" was listed beside a deleted script as a way a run
   * reaches zero tasks silently. It is not: measured on turbo 2.10.12, a filter
   * naming a package the workspace does not have is REFUSED -- `x No package
   * found with name '<name>' in workspace`, exit 1 -- so the job reddens on
   * turbo's own status with no guard involved. The two look alike from a
   * distance and behave oppositely, which is why the claim is pinned to the
   * vendor here rather than restated in a comment.
   */
  it("leaves a filter that names no package to turbo, which refuses it outright", () => {
    declares(root, "passes", { name: "@scratch/renamed", task: "db:migrate" });
    const { status, output } = runGuard(root, "db:migrate");
    expect(status, output).not.toBe(0);
    expect(output).toContain("No package found with name");
    expect(output).not.toContain("ran no tasks at all");
  });
});

/**
 * CNCORE-191's second acceptance criterion, and the same flip on a task that is
 * NOT a suite.
 *
 * The hole belongs to the RUNNER rather than to `test`: `Typecheck`, `Build` and
 * the migration ladder ran turbo bare and would each have gone green having done
 * nothing. This drives the guard over a workspace whose task is `typecheck`, so
 * a guard that had grown a special case for the word `test` fails here -- and
 * `db:migrate` is the one whose false green costs most, because ADR-0047's
 * empty-to-head gate would report a database built from nothing as correct.
 */
describe("the guard behind a job that runs no suite", () => {
  let root: string;

  beforeEach(() => {
    root = scratchWorkspace("typecheck");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("passes a workspace whose package declares the task", () => {
    declares(root, "passes", { task: "typecheck" });
    const { status, output } = runGuard(root, "typecheck");
    expect(status, output).toBe(0);
  });

  it("fails the same workspace once that script is deleted", () => {
    declares(root, "deleted", { task: "typecheck" });
    const { status, output } = runGuard(root, "typecheck");
    expect(status, output).not.toBe(0);
    expect(output).toContain("ran no tasks at all");
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
  return Object.keys(rootScripts()).filter(
    (name) => /^test(:|$)/.test(name) && !/:watch$/.test(name),
  );
}

/** The root manifest's `scripts` block, which both readers here ask of it. */
function rootScripts(): Record<string, string> {
  const root = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  return root.scripts ?? {};
}

/**
 * A string made safe to build a regex from, for the readers that match a script
 * name or the guard's path inside a `run:` block. Both are read off disk, so
 * neither is a literal this file controls.
 */
function literally(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * This package's own name, read off the manifest BESIDE this file rather than
 * looked up by a path through the repository root.
 *
 * It is the subject of the roll call below, and the point of reading it here is
 * that a rename cannot leave the two sides disagreeing: the package renamed and
 * `ci.yml` not updated fails, rather than the check quietly asking about a name
 * nothing has any more.
 */
function policingPackage(): string {
  const own = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as {
    name?: string;
  };
  if (own.name === undefined)
    throw new Error("this package's manifest has no name to be run under");
  return own.name;
}

/**
 * Every invocation of the guard in the workflow, with the package it holds the
 * run to.
 *
 * `--` IN THAT SLOT IS NO PACKAGE, which is the script's own parse and has to be
 * this reader's too (CNCORE-343): what follows it is arguments for the task, so a
 * reader that took it for a package would report the `provider` job as holding
 * its run to one called `--`.
 */
function guardInvocations(): { job: string; task: string; required: string | undefined }[] {
  const guard = literally(SUITE_GUARD);
  const pattern = new RegExp(`(?:^|\\s)${guard}\\s+([a-z][a-z0-9:-]*)(?:[ \\t]+(\\S+))?`, "g");
  return runSteps().flatMap(({ job, run }) =>
    [...run.matchAll(pattern)].flatMap((match) =>
      match[1] === undefined
        ? []
        : [{ job, task: match[1], required: match[2] === "--" ? undefined : match[2] }],
    ),
  );
}

/** Every job in the workflow, with the turbo tasks its `run:` steps invoke. */
function jobs(): { job: string; invocations: { task: string; guarded: boolean }[] }[] {
  return Object.entries(workflow().jobs ?? {}).map(([job, definition]) => ({
    job,
    invocations: turboTaskInvocations(definition),
  }));
}

/** Every `run:` script in the workflow, named by the job and the step it sits in. */
function runSteps(): { job: string; step: string; run: string }[] {
  return allSteps(workflow()).flatMap(({ job, step }) =>
    step.run === undefined ? [] : [{ job, step: step.name ?? "<unnamed>", run: step.run }],
  );
}

/**
 * Every root script that is a TURBO TASK, read off the root manifest the same
 * way and for the same reason as `suiteScripts()` above.
 *
 * THE HOLE IS THE RUNNER'S, NOT THE SUITE'S (CNCORE-191). `turbo run <task>`
 * exits 0 having run zero tasks whatever the task is, so `typecheck`, `build`
 * and the ladder's `db:migrate` carry it exactly as `test` does -- and the
 * ladder's is the worst of them, because ADR-0047's empty-to-head gate would
 * report a database built from nothing as built correctly. CNCORE-160 scoped
 * itself to the jobs that run a SUITE and left these four bare.
 *
 * READ FROM THE COMMAND rather than from a list here, so a script switched to
 * turbo arrives in this set on its own. `lint` is `biome ci` and falls out
 * without an exception being written for it, which is the right way round: the
 * reason it needs no guard is that it is not turbo, and that reason is visible
 * in the manifest rather than transcribed into a rule.
 */
function turboScripts(): string[] {
  return Object.entries(rootScripts())
    .filter(([, command]) => /\bturbo\s+run\b/.test(command))
    .map(([name]) => name);
}

/**
 * The unguarded mentions that are RIGHT, each carrying the reason it is, because
 * CNCORE-191's first acceptance criterion allows a written reason in place of
 * the guard.
 *
 * A LIST HERE RATHER THAN A COMMENT IN `ci.yml`, and that is forced rather than
 * chosen: the workflow is read back through a YAML parse, which drops comments
 * entirely, so a reason written beside the step is one no check can see. Written
 * here, an exemption is a line somebody had to add on purpose.
 *
 * AND IT IS HELD TO MATCHING SOMETHING, by the canary below. An exemption whose
 * step has gone is an excuse still standing over nothing, which is how a list
 * like this rots into permission it was never asked for.
 *
 * KEYED TO THE STEP AND NOT THE JOB, so an excuse covers the step somebody wrote
 * it about. Keyed to the job, a second and genuinely bare `pnpm build` added to
 * `env-guard` would inherit a reason nobody wrote for it, and the canary cannot
 * see that -- it catches an entry matching nothing, never one matching more than
 * it was meant to. What remains uncovered is a second bare mention inside the
 * SAME step, which is as far as reading a step's text can narrow it.
 */
const UNGUARDED_ON_PURPOSE: { job: string; step: string; script: string; reason: string }[] = [
  {
    job: "env-guard",
    step: "Missing DATABASE_URL fails the build",
    script: "build",
    reason:
      "this job requires `pnpm build` to FAIL, and a run of zero tasks exits 0 -- so the hole " +
      "the guard closes elsewhere is what reddens this job correctly. Guarding it would invert " +
      "the check. The job also names `build` in its error text and its log file, which the same " +
      "exemption covers.",
  },
  {
    job: "image",
    step: "It carries no .env, no pnpm, no dev dependencies, and the licence",
    script: "dev",
    reason:
      "prose rather than a command: the job's comment and its error text both say `dev " +
      "dependency`, about the modules the runner stage must not carry. `dev` is a persistent " +
      "task, so there is no false green to be had from it in the first place -- a CI step that " +
      "ran it would hang until the job timed out, never pass. The name-matching rule cannot " +
      "tell English from a shell word, and buying that strength back with an exemption is " +
      "cheaper than the alternative: `persistent` lives in `turbo.json`, which is JSONC, and " +
      "reading it here would be a THIRD copy of the 48-line comment walker in " +
      "`turbo-cache-dir.test.ts` -- the two in the tree are not the same function, so there is " +
      "no extraction to borrow.",
  },
];

/**
 * Every place a run step NAMES a turbo script, and whether the guard is what
 * named it.
 *
 * THE SCRIPT'S NAME IS THE SUBJECT, NOT THE COMMAND THAT RUNS IT, and that is
 * the whole strength of it. A rule matching `pnpm <task>` reads only the one
 * spelling this file happens to use today, so `turbo run test:e2e`,
 * `npx turbo run test:e2e` and `pnpm --filter web test:e2e` would all pass it
 * silently -- the check would claim no job invokes a suite bare while a job did.
 * A task cannot be run without its name appearing, so every appearance is held
 * to being the guard's argument instead.
 *
 * The word boundaries take `:` with them, or `test` would match inside
 * `test:e2e` and report the guard's own argument as a bare invocation. They
 * take `/` and `.` too, so that a PATH SEGMENT and a FILENAME STEM are not read
 * as an invocation: `>/dev/null` reported the `dev` task as run bare by five
 * jobs, and `build.log` reported the `build` one. Neither weakens the rule,
 * because every spelling of an invocation has the task standing as its own
 * argument -- `pnpm build`, `turbo run build`, `pnpm --filter web test:e2e` --
 * and none of them has it buried in a path.
 */
function turboMentions(): { job: string; step: string; script: string; guarded: boolean }[] {
  return runSteps().flatMap(({ job, step, run }) =>
    turboScripts().flatMap((script) => {
      const name = new RegExp(`(?<![\\w:./-])${literally(script)}(?![\\w:./-])`, "g");
      return [...run.matchAll(name)].map((match) => ({
        job,
        step,
        script,
        guarded: new RegExp(`${literally(SUITE_GUARD)}\\s+$`).test(run.slice(0, match.index)),
      }));
    }),
  );
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
   * CNCORE-190's other half, and the half a suite CAN hold.
   *
   * The guard's roll call lives in `run-suite.sh` because a check cannot police
   * the thing that decides whether it runs: delete this package's `test` script
   * and this file does not run to complain. That leaves exactly one way to
   * switch the roll call off -- dropping the ARGUMENT from `ci.yml` -- and that
   * one is safe to hold here, because the suite is still running to notice it.
   * The two holes are disjoint, which is what makes the pair whole.
   */
  it("holds the run of this package's own suite to naming it, since nothing else can", () => {
    const unheld = guardInvocations()
      .filter(({ task, required }) => task === "test" && required !== policingPackage())
      .map(
        ({ job, required }) =>
          `the \`${job}\` job runs \`test\` as \`${required ?? "<no package named>"}\` rather than ` +
          `\`${policingPackage()}\`. That package's suite is every check this repository makes of ` +
          `its own CI, and deleting its \`test\` script leaves the other nine running and the ` +
          `count green.`,
      );
    expect(unheld).toStrictEqual([]);
  });

  /**
   * CNCORE-160's first acceptance criterion, WIDENED PAST THE SUITES to every
   * turbo task the workflow runs (CNCORE-191).
   *
   * `turbo run <task>` exits 0 having run nothing, so a job invoking the runner
   * BARE reports success for a task that is no longer there. The `test` job
   * carried the only count check in the file; the other four suite jobs ran
   * `pnpm test:e2e`, `pnpm test:browser` and `pnpm test:contract` with nothing
   * reading what came back, and CNCORE-160 closed those. It left `typecheck`,
   * `build` and the ladder's `db:migrate` and `db:check-ladder`, which carry the
   * identical hole for the identical reason -- so the subject here is the
   * RUNNER rather than the suite, and a task added to `turbo.json` tomorrow is
   * in scope without anybody widening this again.
   */
  it("never invokes a turbo task bare, where a missing one would go green", () => {
    const excused = ({
      job,
      step,
      script,
    }: {
      job: string;
      step: string;
      script: string;
    }): boolean =>
      UNGUARDED_ON_PURPOSE.some(
        (entry) => entry.job === job && entry.step === step && entry.script === script,
      );
    const bare = turboMentions()
      .filter(({ guarded }) => !guarded)
      .filter((mention) => !excused(mention))
      .map(
        ({ job, script }) =>
          `the \`${job}\` job names \`${script}\` somewhere other than as ` +
          `\`${SUITE_GUARD}\`'s argument. \`turbo run ${script}\` exits 0 having run zero ` +
          `tasks, so a job running it directly goes green with that task deleted.`,
      );
    expect(bare).toStrictEqual([]);
  });

  /*
   * The canary over the excuses. An exemption that matches nothing is an excuse
   * standing over a step that has gone -- and the next bare invocation of that
   * task in that job would inherit a reason nobody wrote for it.
   */
  it("excuses only mentions that are really there", () => {
    const stale = UNGUARDED_ON_PURPOSE.filter(
      ({ job, step, script }) =>
        !turboMentions().some(
          (mention) =>
            mention.job === job &&
            mention.step === step &&
            mention.script === script &&
            !mention.guarded,
        ),
    ).map(
      ({ job, step, script }) =>
        `\`${job}\`'s \`${step}\` step is excused for \`${script}\`, which it no longer names bare`,
    );
    expect(stale).toStrictEqual([]);
  });
});
