import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * THE DELETE-THE-BEHAVIOUR RUN, HELD TO BITING (ADR-0168).
 *
 * A check that passes everything put to it is itself the hollow assertion it
 * exists to find, so this runs it over a fixture holding the four shapes that
 * record catalogues, each beside a twin that reaches the same behaviour, and asks
 * that it names the four and only the four.
 *
 * THE FIXTURE IS RUN FROM A COPY, never in place. The run edits the file it
 * deletes from, and this package's other suites read the tree as text while this
 * one runs; a copy in a scratch directory is a file none of them sweeps. The
 * scratch directory reaches this package's `node_modules` through a symlink,
 * which is `ci-workflow.test.ts`'s way of giving a scratch tree real
 * dependencies.
 */

const script = join(import.meta.dirname, "..", "scripts", "delete-the-behaviour.ts");
const fixture = join(import.meta.dirname, "testing", "hollow-fixture");

let scratch: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "canoncore-hollow-"));
  symlinkSync(join(import.meta.dirname, "..", "node_modules"), join(scratch, "node_modules"));
  copyFileSync(join(fixture, "shapes.ts"), join(scratch, "shapes.ts"));
  copyFileSync(join(fixture, "shapes.check.ts"), join(scratch, "shapes.test.ts"));
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/** The 1-based line of `shapes.ts` that holds `text`, found rather than counted. */
function lineOf(text: string): number {
  const index = readFileSync(join(scratch, "shapes.ts"), "utf8").split("\n").indexOf(text);
  if (index === -1) throw new Error(`shapes.ts holds no line ${JSON.stringify(text)}`);
  return index + 1;
}

/** Each of the four behaviours, as the `--delete` that names it. */
function theFourBehaviours(): string[] {
  return [
    `shapes.ts:${lineOf("  catalogue.items.push(...titles);")}`,
    `shapes.ts:${lineOf("    position: row.position,")}`,
    `shapes.ts:${lineOf(`  main = session === null ? \`<p>This page is the Owner's. <a href="/login">Log in</a></p>\` : main;`)}`,
    `shapes.ts:${lineOf("  if (taken.has(port)) bound = port + 1;")}`,
  ];
}

function run(...args: string[]) {
  const result = spawnSync(process.execPath, [script, "--root", scratch, ...args], {
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function stayedGreen(stdout: string): string[] {
  return stdout
    .split("\n")
    .filter((line) => line.startsWith("STAYED GREEN"))
    .map((line) => line.replace(/^STAYED GREEN\s+/, ""));
}

describe("the delete-the-behaviour run", () => {
  it("fails on the four hollow shapes and names exactly them", () => {
    const deletions = theFourBehaviours().flatMap((deletion) => ["--delete", deletion]);

    const result = run(...deletions);

    expect(result.status, result.stderr).toBe(1);
    expect(stayedGreen(result.stdout).sort()).toStrictEqual(
      [
        "shapes.test.ts > a count over something else already fills hollow: the import recorded its origin",
        "shapes.test.ts > an aggregate nobody reads hollow: one Item sits at different Positions",
        "shapes.test.ts > a read the shell answers hollow: a refused reader is told to log in",
        "shapes.test.ts > a guard whose trigger is unreachable by construction hollow: a server steps aside from a taken port",
      ].sort(),
    );
  }, 60_000);

  it("passes a tree whose every assertion reaches its behaviour, and puts the file back", () => {
    const original = readFileSync(join(scratch, "shapes.ts"), "utf8");
    const deletions = theFourBehaviours().flatMap((deletion) => ["--delete", deletion]);

    const result = run(...deletions, "-t", "reaches");

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("4 of 4 went red");
    expect(readFileSync(join(scratch, "shapes.ts"), "utf8")).toBe(original);
  }, 60_000);

  /**
   * A DELETION THAT BREAKS THE FILE REDDENS EVERYTHING, and read as a report
   * that would say every assertion bit. Deleting the line that opens a function
   * leaves its body and closing brace behind, so the module no longer parses.
   */
  it("refuses a deletion that broke the file rather than a behaviour, and puts it back", () => {
    const original = readFileSync(join(scratch, "shapes.ts"), "utf8");
    const opening = lineOf(
      "export function importInto(catalogue: Catalogue, titles: string[]): void {",
    );

    const result = run("--delete", `shapes.ts:${opening}`);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("a broken file, not a deleted behaviour");
    expect(result.stdout).not.toContain("STAYED GREEN");
    expect(readFileSync(join(scratch, "shapes.ts"), "utf8")).toBe(original);
  }, 60_000);

  it("refuses a tree already red before anything is deleted", () => {
    const suite = join(scratch, "shapes.test.ts");
    writeFileSync(
      suite,
      readFileSync(suite, "utf8").replace('toStrictEqual(["Rose"])', 'toStrictEqual(["Clara"])'),
    );

    const result = run(...theFourBehaviours().flatMap((deletion) => ["--delete", deletion]));

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "shapes.test.ts > a count over something else already fills reaches: the import recorded its Item",
    );
  }, 60_000);
});
