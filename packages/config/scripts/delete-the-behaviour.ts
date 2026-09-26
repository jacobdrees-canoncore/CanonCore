/**
 * Deletes a named behaviour and reports which assertions stayed green (ADR-0168).
 *
 *   pnpm delete-the-behaviour --root packages/db --delete src/ladder.ts:40-52 src/ladder.test.ts
 *
 * `--root` is the directory Vitest runs in, normally a package, and is resolved
 * from where `pnpm` was invoked. Each `--delete` names lines of a file under it,
 * as `file:line` or `file:from-to`, and repeats for a behaviour that lives in
 * more than one place. Everything else goes to Vitest as it is, so the tree the
 * run asks about is chosen the way any run is narrowed: file filters, `-t`.
 *
 * AN ASSERTION THAT STAYS GREEN WITH ITS BEHAVIOUR DELETED NAMED A BEHAVIOUR IT
 * NEVER REACHED, so every test the chosen tree holds is expected to go red, and
 * each one that does not is printed as `STAYED GREEN` and fails the run. Choose
 * the tree as the tests that CLAIM the behaviour; a test that never said it
 * held this one staying green is the tree chosen too wide, not a finding.
 *
 * IT RUNS THE TREE TWICE. Once as it stands, and a test already red there is
 * refused rather than counted: red after the deletion would say nothing about
 * it. And once with the lines deleted, where a test the first run held and the
 * second did not reach at all is refused too -- the usual cause is a deletion
 * that broke the file rather than the behaviour, which reddens everything and
 * would read as every assertion biting.
 *
 * IT EDITS THE FILE IN PLACE and writes the original bytes back when it
 * finishes, fails or is interrupted. So it wants a tree nothing else is running
 * over at the time, and a SIGKILL leaves the deletion in the working tree for
 * `git diff` to show.
 *
 * Exit 0 when every test went red, 1 when any stayed green, 2 when the run
 * was refused. Node builtins only, so bare `node` runs it with no loader.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

type Deletion = { file: string; from: number; to: number };
type Outcome = { key: string; status: string };

class Refusal extends Error {}

function parse(argv: string[]): { root: string; deletions: Deletion[]; filters: string[] } {
  let root: string | undefined;
  const deletions: Deletion[] = [];
  const filters: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index] as string;
    if (argument === "--root") {
      root = argv[++index];
    } else if (argument === "--delete") {
      const named = argv[++index] ?? "";
      const match = /^(.+):(\d+)(?:-(\d+))?$/.exec(named);
      if (match === null)
        throw new Refusal(`--delete takes file:line or file:from-to, not ${named}`);
      const [, file, from, to] = match as unknown as [string, string, string, string | undefined];
      deletions.push({ file, from: Number(from), to: Number(to ?? from) });
    } else {
      filters.push(argument);
    }
  }
  if (root === undefined) throw new Refusal("--root names the directory Vitest runs in");
  if (deletions.length === 0) throw new Refusal("--delete names the behaviour to delete");
  const base = process.env.INIT_CWD ?? process.cwd();
  // Real, because Vitest reports each file by its real path and a report is read against this.
  return { root: realpathSync(resolve(base, root)), deletions, filters };
}

/** Every test the tree holds, keyed by file and full name, with its status. */
function runTheTree(root: string, filters: string[]): { outcomes: Outcome[]; unloaded: string[] } {
  const vitest = join(
    dirname(createRequire(join(root, "noop.js")).resolve("vitest/package.json")),
    "vitest.mjs",
  );
  const scratch = mkdtempSync(join(tmpdir(), "canoncore-delete-the-behaviour-"));
  try {
    const report = join(scratch, "report.json");
    spawnSync(
      process.execPath,
      [vitest, "run", "--reporter=json", `--outputFile=${report}`, ...filters],
      {
        cwd: root,
        stdio: "ignore",
      },
    );
    let parsed: {
      testResults: {
        name: string;
        message: string;
        assertionResults: { fullName: string; status: string }[];
      }[];
    };
    try {
      parsed = JSON.parse(readFileSync(report, "utf8"));
    } catch {
      throw new Refusal(`Vitest wrote no report in ${root}; run it there by hand to see why`);
    }
    const outcomes: Outcome[] = [];
    const unloaded: string[] = [];
    for (const file of parsed.testResults) {
      const name = relative(root, file.name);
      if (file.assertionResults.length === 0 && file.message)
        unloaded.push(`${name}: ${file.message}`);
      for (const test of file.assertionResults) {
        // A test `-t` or `.skip` left out is outside the tree chosen, not a red one inside it.
        if (test.status === "skipped" || test.status === "pending" || test.status === "todo")
          continue;
        outcomes.push({ key: `${name} > ${test.fullName}`, status: test.status });
      }
    }
    return { outcomes, unloaded };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** Deletes the named lines, and returns what puts every file back. */
function applyDeletions(root: string, deletions: Deletion[]): () => void {
  const originals = new Map<string, string>();
  for (const { file } of deletions) {
    const path = resolve(root, file);
    if (!originals.has(path)) originals.set(path, readFileSync(path, "utf8"));
  }
  const restore = () => {
    for (const [path, text] of originals) writeFileSync(path, text);
  };
  for (const [path, text] of originals) {
    const lines = text.split("\n");
    const here = deletions.filter((deletion) => resolve(root, deletion.file) === path);
    for (const { file, from, to } of here) {
      if (from < 1 || to < from || to > lines.length) {
        restore();
        throw new Refusal(`${file}:${from}-${to} is not a range of its ${lines.length} lines`);
      }
    }
    // Blanked rather than removed, so two ranges in one file keep the numbers they were named by.
    for (const { from, to } of here) lines.fill("", from - 1, to);
    writeFileSync(path, lines.join("\n"));
  }
  return restore;
}

function main(): number {
  const { root, deletions, filters } = parse(process.argv.slice(2));

  const before = runTheTree(root, filters);
  if (before.unloaded.length > 0)
    throw new Refusal(`the tree does not load as it stands:\n${before.unloaded.join("\n")}`);
  if (before.outcomes.length === 0)
    throw new Refusal("the tree holds no tests, so nothing could stay green");
  const alreadyRed = before.outcomes.filter((outcome) => outcome.status !== "passed");
  if (alreadyRed.length > 0) {
    throw new Refusal(
      `already red before anything was deleted:\n${alreadyRed.map((outcome) => outcome.key).join("\n")}`,
    );
  }

  const restore = applyDeletions(root, deletions);
  const interrupted = () => {
    restore();
    process.exit(130);
  };
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  let after: ReturnType<typeof runTheTree>;
  try {
    after = runTheTree(root, filters);
  } finally {
    restore();
    process.off("SIGINT", interrupted);
    process.off("SIGTERM", interrupted);
  }

  const reached = new Map(after.outcomes.map((outcome) => [outcome.key, outcome.status]));
  const unreached = before.outcomes.filter((outcome) => !reached.has(outcome.key));
  if (unreached.length > 0) {
    throw new Refusal(
      `the deletion stopped ${unreached.length} test(s) running at all, which is a broken file, not a deleted behaviour:\n` +
        [...after.unloaded, ...unreached.map((outcome) => outcome.key)].join("\n"),
    );
  }

  const green = before.outcomes.filter((outcome) => reached.get(outcome.key) === "passed");
  for (const outcome of green) console.log(`STAYED GREEN  ${outcome.key}`);
  console.log(`${before.outcomes.length - green.length} of ${before.outcomes.length} went red`);
  return green.length > 0 ? 1 : 0;
}

try {
  process.exitCode = main();
} catch (error) {
  if (!(error instanceof Refusal)) throw error;
  console.error(`refused: ${error.message}`);
  process.exitCode = 2;
}
