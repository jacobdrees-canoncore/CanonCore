import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
const scratchRoots: string[] = [];

afterEach(() => {
  while (scratchRoots.length > 0) {
    rmSync(scratchRoots.pop() as string, { recursive: true, force: true });
  }
});

/** A workspace parent in a temp directory, for the rows to build a tree inside. */
function scratchParent(): string {
  const root = mkdtempSync(join(tmpdir(), "workspace-"));
  scratchRoots.push(root);
  const parent = join(root, "packages");
  mkdirSync(parent);
  return parent;
}

describe("a symlinked package directory", () => {
  it("is refused by name rather than dropped, because pnpm and turbo disagree about it", () => {
    const parent = scratchParent();
    mkdirSync(join(parent, "real"));
    mkdirSync(join(parent, "..", "elsewhere"));
    symlinkSync(join(parent, "..", "elsewhere"), join(parent, "linked"));

    expect(() => directoriesUnder(parent)).toThrow(/linked/);
  });

  it("is not a symlink to a FILE, which neither tool calls a package either way", () => {
    const parent = scratchParent();
    mkdirSync(join(parent, "real"));
    writeFileSync(join(parent, "..", "notes.md"), "");
    symlinkSync(join(parent, "..", "notes.md"), join(parent, "notes.md"));

    expect(directoriesUnder(parent)).toStrictEqual(["real"]);
  });

  it("is not a BROKEN symlink, which stats as nothing rather than as a directory", () => {
    const parent = scratchParent();
    mkdirSync(join(parent, "real"));
    symlinkSync(join(parent, "..", "gone"), join(parent, "dangling"));

    expect(directoriesUnder(parent)).toStrictEqual(["real"]);
  });
});
