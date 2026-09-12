import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repoRoot } from "./testing/repo-root";

/**
 * The linter and formatter are shared configuration, which is this package's
 * whole job, so its guarantees are checked here beside the tsconfig ones.
 *
 * These run the REAL binary against the REAL `biome.jsonc`, on fixtures written
 * outside the repository so that `pnpm lint` never meets them. A test that
 * asserted only "a bad file fails" would pass just as well with no linter
 * installed at all, since a missing command also exits non-zero. So every
 * failure below is paired with a clean file that must pass.
 */

const biome = join(repoRoot, "node_modules", ".bin", "biome");

/** The extensions Biome 2.5 parses. It does not handle Markdown, YAML or SQL. */
const LINTABLE = /\.(?:tsx?|jsx?|mjs|cjs|jsonc?|css)$/;

/**
 * git rather than a directory walk, so the question asked is "is anything in
 * the REPOSITORY unlinted?" -- build output and node_modules are not tracked
 * and so cannot produce a false failure.
 */
function gitTrackedFiles(): string[] {
  const result = spawnSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" });
  return result.stdout.split("\0").filter(Boolean);
}

let fixtures: string;

beforeEach(() => {
  fixtures = mkdtempSync(join(tmpdir(), "canoncore-biome-"));
});

afterEach(() => {
  rmSync(fixtures, { recursive: true, force: true });
});

function run(args: string[]): { status: number | null; output: string } {
  const result = spawnSync(biome, [...args], { encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** For paths INSIDE the repository, where the .gitignore is part of what is under test. */
function check(target: string) {
  return run(["check", `--config-path=${repoRoot}`, "--", target]);
}

/**
 * For the fixtures, which live outside the repository.
 *
 * `--vcs-enabled=false` is load-bearing and cost an afternoon to find. This
 * repo's .gitignore contains a bare `tmp` entry, which matches the `/tmp` path
 * SEGMENT, so with the ignore file on Biome silently processes zero fixtures
 * and every assertion below turns vacuous. It only shows up where
 * `os.tmpdir()` is `/tmp`: not under `pnpm --filter`, which inherits macOS's
 * TMPDIR, but yes under `turbo`, whose Strict Environment Mode filters TMPDIR
 * out, and yes on every Linux CI runner.
 *
 * Turning the ignore file off is right here rather than a workaround: these
 * fixtures are testing the RULES, and which repo paths are ignored is covered
 * by the two tests below that run inside the repo.
 */
function checkFixture(target: string) {
  return run(["check", `--config-path=${repoRoot}`, "--vcs-enabled=false", "--", target]);
}

function fixture(name: string, contents: string): string {
  const path = join(fixtures, name);
  writeFileSync(path, contents);
  return path;
}

describe("the shared Biome configuration", () => {
  it("rejects a file the formatter would rewrite, and accepts one it would not", () => {
    const clean = fixture("clean.ts", 'export const greeting = "hello";\n');
    const misformatted = fixture("misformatted.ts", 'export const   greeting="hello"\n');

    expect(checkFixture(clean).status).toBe(0);

    const rejected = checkFixture(misformatted);
    expect(rejected.status).not.toBe(0);
    expect(rejected.output).toContain("Formatter would have printed");
  });

  it("rejects a lint violation in a file the formatter is happy with", () => {
    // Formatted exactly as Biome would print it, so only the linter can object.
    // Naming the rule in the assertion is what proves the LINTER ran: without
    // it, a formatter-only config would pass this test on the whitespace alone.
    const offender = fixture(
      "loose-equality.ts",
      "export function same(a: unknown, b: unknown): boolean {\n  return a == b;\n}\n",
    );

    const rejected = checkFixture(offender);
    expect(rejected.status).not.toBe(0);
    expect(rejected.output).toContain("lint/suspicious/noDoubleEquals");
  });

  it("fails rather than passing when it processes no files at all", () => {
    // The defect CNCORE-3 deleted was a lint task that could exit 0 having run
    // nothing. Biome refuses to, and this pins that: it is the vendor's
    // behaviour rather than ours, so it is exactly the kind of thing that can
    // change under an upgrade without anybody noticing.
    const empty = mkdtempSync(join(tmpdir(), "canoncore-biome-empty-"));
    try {
      const result = checkFixture(empty);
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("No files were processed");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("fails on a warning, not only on an error", () => {
    // Biome grades some rules as warnings, and by default reports them and
    // exits 0. That makes every warning-level rule decorative: reported,
    // never enforced -- the same defect as a task that checks nothing, one
    // severity down. `noNonNullAssertion` is one of them.
    const offender = fixture(
      "assertion.ts",
      "const items: string[] = [];\nexport const first = items[0]!;\n",
    );

    // The flags are read from the `lint` script rather than repeated here, so
    // what this proves is what CI actually runs.
    const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const [binary, ...rest] = (manifest.scripts.lint ?? "").split(/\s+/);
    expect(binary).toBe("biome");
    const flags = rest.filter((argument) => argument !== ".");

    const result = run([
      ...flags,
      `--config-path=${repoRoot}`,
      "--vcs-enabled=false",
      "--",
      offender,
    ]);
    expect(result.output).toContain("noNonNullAssertion");
    expect(result.output).toContain("warning");
    expect(result.status).not.toBe(0);
  });

  it("leaves no file it could lint unlinted", () => {
    // The per-package version of this test only asked whether each package had
    // at least ONE file linted, which a package of forty files and one linted
    // `package.json` would pass. CNCORE-4 landing thirty-odd new files in
    // `packages/db` is exactly the case that makes the difference matter, so
    // this asks the stronger question: of everything git tracks that Biome can
    // parse, is anything being skipped?
    const tracked = gitTrackedFiles().filter((path) => LINTABLE.test(path));
    expect(tracked.length).toBeGreaterThan(0);

    // The one exclusion `biome.jsonc` declares, restated here so that adding a
    // second one means editing this test and justifying it.
    const excluded = tracked.filter((path) => path.startsWith("packages/db/src/migrations/meta/"));
    expect(
      excluded.length,
      "the declared exclusion matches nothing -- is it stale?",
    ).toBeGreaterThan(0);

    // One invocation: Biome reports how many of the paths it was handed it
    // actually processed, and silently drops the rest.
    const batch = run([
      "check",
      `--config-path=${repoRoot}`,
      "--max-diagnostics=0",
      "--",
      ...tracked.map((path) => join(repoRoot, path)),
    ]);
    const checked = Number(/Checked (\d+) files?/.exec(batch.output)?.[1]);

    if (checked !== tracked.length - excluded.length) {
      // Only on failure, because it costs one process per file: name them.
      const skipped = tracked.filter((path) =>
        check(join(repoRoot, path)).output.includes("No files were processed"),
      );
      expect(skipped).toEqual(excluded);
    }

    // A COUNT SHORT BY TWO DURING AN UNCOMMITTED MERGE IS THIS TEST, NOT A GAP.
    // `git ls-files` lists a conflicted path once per stage -- base, ours,
    // theirs -- so one unresolved file inflates `tracked` by two while Biome
    // dedupes and reports the real number. The per-file diagnostic above then
    // says nothing is skipped, which reads as a contradiction and sends the
    // reader hunting for two files that do not exist. `git add` the resolution
    // and re-run. Met 2026-09-12 merging `main` into CNCORE-109.
    expect(checked).toBe(tracked.length - excluded.length);
  });

  it("is what the repository's own `pnpm lint` actually runs", () => {
    // Everything above tests the binary and the config. This tests the SCRIPT,
    // which is the thing CI calls: a `lint` script rewired to something that
    // exits 0 without linting would leave every assertion above passing.
    // Deliberately silent about the exit code -- whether the tree is clean is
    // the lint job's business, and asserting it here would fail the test suite
    // and the lint check for one cause.
    const result = spawnSync("pnpm", ["lint"], { cwd: repoRoot, encoding: "utf8" });
    const output = `${result.stdout}${result.stderr}`;

    const checked = /Checked (\d+) files?/.exec(output);
    expect(checked, `pnpm lint did not run Biome. It printed:\n${output}`).not.toBeNull();
    expect(Number(checked?.[1])).toBeGreaterThan(0);
  });
});
