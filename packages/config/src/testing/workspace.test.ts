import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  directoriesUnder,
  isWorkspacePattern,
  packageDirectories,
  workspaceDirectories,
} from "./workspace";

/**
 * The predicate's table, beside the predicate. It sat in
 * `network-gate-wiring.test.ts` while the rule did, and moved here with it under
 * CNCORE-197, when a second sweep -- `typecheck-wiring.test.ts` -- started
 * descending from the same function: ADR-0103 keeps a predicate and its table
 * together, and a table two files from its subject is one nobody finds when they
 * change the rule.
 *
 * ASKED DIRECTLY RATHER THAN THROUGH THE REPOSITORY, which is the only way to
 * ask about a pattern this workspace does not happen to have. The two rows
 * marked below went wrong exactly that way: what the rule let through was not in
 * the repo, so every assertion resting on it went on passing while the rule said
 * something else (CNCORE-46).
 */
describe("the rule the workspace sweep is made of", () => {
  it.each<[string, boolean]>([
    ["apps/*", true],
    ["packages/*", true],
    // A LEADING dot is an ordinary directory name. The narrowing below is aimed
    // at relative-path segments, not at dots, so this stays supported.
    [".github/*", true],
    // THE TWO THAT LEAVE THE REPOSITORY, and CNCORE-46's second half: `..`
    // sweeps the repository's PARENT and `.` sweeps the root itself, and both
    // matched the first segment's `[\w.-]+` while the comment on the rule named
    // `../*` as a case it caught.
    ["../*", false],
    ["./*", false],
    // Refused already, and the reason the rule reads the WHOLE pattern.
    ["apps/*/nested", false],
    ["apps/**", false],
    ["apps", false],
    ["*", false],
  ])("reads %s as a workspace pattern: %s", (pattern, supported) => {
    expect(isWorkspacePattern(pattern)).toBe(supported);
  });
});

/**
 * And the two sweeps answering about the repository at all, which is the half a
 * table cannot hold: a rule can be right about every row here while the read
 * around it returns nothing.
 *
 * THE FLOOR IS EACH OTHER RATHER THAN A NUMBER. `>= 12` was what
 * `network-gate-wiring.test.ts` held before CNCORE-160, and it was true when it
 * was written and quietly false afterwards. Every package directory is a
 * workspace directory, so the one list cannot exceed the other, and neither may
 * be empty -- `workspaceDirectories` raises on an empty parse rather than
 * returning one, which is what keeps every sweep descending from it from
 * emptying in silence.
 */
describe("the workspace sweeps", () => {
  it("finds packages, and finds no more of them than there are directories", () => {
    const directories = workspaceDirectories();
    const packages = packageDirectories();

    expect(packages).not.toStrictEqual([]);
    expect(directories.length).toBeGreaterThanOrEqual(packages.length);
    expect(packages.every((directory) => directories.includes(directory))).toBe(true);
  });
});

/**
 * And the shape neither sweep can be right about, ASKED DIRECTLY for the reason
 * the table at the top of this file is: no package directory in this repository
 * is a symlink, so the repository is the one place the question cannot be put
 * (CNCORE-200).
 */
describe("a symlinked package directory", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "canoncore-workspace-"));
    mkdirSync(join(root, "packages"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** The workspace parent under the fixture, for a row to build its tree inside. */
  function parent(): string {
    return join(root, "packages");
  }

  it("is refused by name rather than dropped, because pnpm and turbo disagree about it", () => {
    mkdirSync(join(parent(), "real"));
    mkdirSync(join(root, "elsewhere"));
    symlinkSync(join(root, "elsewhere"), join(parent(), "linked"));

    expect(() => directoriesUnder(parent())).toThrow(/linked/);
  });

  /**
   * NAMED RATHER THAN COUNTED, which is the line this package already takes
   * about `ungatedPackages`: two symlinked packages are two things to fix, and
   * a message carrying the first sends the reader back for the second.
   */
  it("is named alongside every other one, rather than the first standing for them all", () => {
    mkdirSync(join(root, "elsewhere"));
    symlinkSync(join(root, "elsewhere"), join(parent(), "one"));
    symlinkSync(join(root, "elsewhere"), join(parent(), "two"));

    expect(() => directoriesUnder(parent())).toThrow(/one.*two/s);
  });

  it("is not a symlink to a FILE, which neither tool calls a package either way", () => {
    mkdirSync(join(parent(), "real"));
    writeFileSync(join(root, "notes.md"), "");
    symlinkSync(join(root, "notes.md"), join(parent(), "notes.md"));

    expect(directoriesUnder(parent())).toStrictEqual(["real"]);
  });

  it("is not a DANGLING symlink, which stats as nothing rather than as a directory", () => {
    mkdirSync(join(parent(), "real"));
    symlinkSync(join(root, "gone"), join(parent(), "dangling"));

    expect(directoriesUnder(parent())).toStrictEqual(["real"]);
  });
});
