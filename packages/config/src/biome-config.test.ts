import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repoRoot } from "./testing/repo-root";
import { trackedFiles } from "./testing/tracked-files";

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
    const tracked = trackedFiles().filter((path) => LINTABLE.test(path));
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

  /**
   * THE SCHEMA THE CONFIG DECLARES IS THE INSTALLED BINARY'S OWN FILE.
   *
   * `biome.jsonc` named a `https://biomejs.dev/schemas/<version>/schema.json` URL
   * until CNCORE-261, against a catalogue and a binary that had both moved past
   * it. A version written into a URL is a second place the dependency's version
   * lives, and [[0101-the-catalogue-is-the-only-place-a-version-is-written]] is
   * the record of what that costs -- one version, expressed twice, one edit away
   * from disagreeing. The numbers are deliberately not restated here: they are
   * the thing that drifts, and this file's job is that there is no number.
   *
   * IT HAD ALREADY DISAGREED THREE TIMES. CNCORE-25 fixed the same drift by
   * LOWERING the schema to match the binary; Dependabot then raised the binary in
   * both provider repos and touched neither schema, and the catalogue here moved
   * to `^2.5.14` with the URL left behind. A fix that has to be reapplied after
   * every bump is a convention, not a mechanism.
   *
   * SO THE VERSION IS NOT WRITTEN DOWN AT ALL. The path points into the installed
   * package, whose schema is by construction the schema of the binary beside it,
   * and a bump moves both together because it is the same install. That removes
   * the failure mode rather than adding a check that detects it -- which is why
   * this row asserts the SHAPE and not a number: a test comparing the URL's
   * version to `biome --version` would go green on every bump only after somebody
   * had already been failed by it.
   */
  it("names a schema with no version in it, inside the installed package", () => {
    const declared = /"\$schema"\s*:\s*"([^"]+)"/.exec(
      readFileSync(join(repoRoot, "biome.jsonc"), "utf8"),
    )?.[1];

    expect(declared, "biome.jsonc declares no `$schema`").toBeDefined();
    expect(declared, "a version written into the schema URL is the drift this removed").not.toMatch(
      /\d+\.\d+\.\d+/,
    );

    const schema = resolve(repoRoot, declared ?? "");
    expect(schema).toBe(
      join(repoRoot, "node_modules", "@biomejs", "biome", "configuration_schema.json"),
    );
    expect(existsSync(schema), `${declared} does not resolve to a file`).toBe(true);
  });

  /**
   * AND THE BINARY DOES NOT OBJECT TO WHAT IT READS.
   *
   * WHAT THIS CATCHES IS A VERSION WRITTEN BACK IN, said plainly because the row
   * above cannot be relied on to catch it alone: `$schema` could be edited to a
   * versioned URL that happens to match today's binary, pass nothing here, and
   * drift on the next bump. This row fails the moment the two disagree.
   *
   * WHAT IT CANNOT CATCH is a path pointing somewhere stale, because Biome does
   * not read a path-shaped `$schema` at all -- `"./nope.json"` produces no
   * diagnostic. An earlier version of this comment claimed the opposite. The
   * resolution is asserted by the row above instead, which is why both exist.
   *
   * THE DIAGNOSTIC IS AN `info`, AND NO FLAG MAKES IT FAIL. Measured on 2026-09-20
   * against a scratch config carrying a versioned schema: `check` and `ci` both
   * print it on stderr and both exit 0, with or without `--error-on-warnings`. So
   * `pnpm lint` printed it on every run and nothing ever went red -- ADR-0105's
   * "visible, ignored, accumulating" in its purest form. (`--config-path` skips
   * the check entirely, which is how this was nearly filed as unreproducible.)
   * The flags are read from the `lint` script rather than repeated, so what this
   * proves is what CI runs.
   */
  it("raises no schema mismatch when the binary reads the configuration it discovers", () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const [, ...flags] = (manifest.scripts.lint ?? "").split(/\s+/);

    const result = spawnSync(biome, flags, { cwd: repoRoot, encoding: "utf8" });
    const output = `${result.stdout}${result.stderr}`;

    expect(output, "biome did not run").toMatch(/Checked \d+ files?/);
    expect(output).not.toContain("configuration schema version does not match");
  });

  /**
   * THE RED FOR THE ROW ABOVE, DRIVEN RATHER THAN DESCRIBED.
   *
   * `not.toContain(...)` passes just as happily against a Biome that stopped
   * emitting the diagnostic, reworded it, or was never run at all -- and the
   * string is the VENDOR'S, so it can change under an upgrade with nothing here
   * to say so. This takes a config carrying a versioned schema, puts it where
   * Biome will DISCOVER it, and requires the diagnostic to appear.
   *
   * DISCOVERED RATHER THAN PASSED: `--config-path` skips the version check
   * altogether, so a fixture handed over that way would prove the opposite of
   * what it claims by being silent for the wrong reason.
   */
  it("still reports a versioned schema that disagrees, which is the string above", () => {
    writeFileSync(
      join(fixtures, "biome.jsonc"),
      '{ "$schema": "https://biomejs.dev/schemas/0.0.1/schema.json" }\n',
    );
    fixture("clean.ts", 'export const greeting = "hello";\n');

    const result = spawnSync(biome, ["ci", "--vcs-enabled=false", "."], {
      cwd: fixtures,
      encoding: "utf8",
    });
    const output = `${result.stdout}${result.stderr}`;

    expect(output, "biome did not run over the fixture").toMatch(/Checked \d+ files?/);
    expect(output).toContain("configuration schema version does not match");
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
