import { describe, expect, it } from "vitest";

import { temporaryDirectoriesIn } from "./temp-directories";

describe("a temporary directory a suite makes", () => {
  it("is reported as unremoved when nothing removes it", () => {
    const source = [
      'const dir = mkdtempSync(join(tmpdir(), "merge-gate-"));',
      'writeFileSync(join(dir, "pr.json"), "{}");',
    ].join("\n");

    expect(temporaryDirectoriesIn(source)).toStrictEqual([
      { line: 1, call: "mkdtempSync", bound: "dir", removed: false },
    ]);
  });

  /**
   * THE SHAPE THAT LEAKS HARDEST, and the reason this reports a binding at all.
   * `setup-worktree.test.ts` keeps the FILE inside the new directory and never
   * the directory, so there is no name for a removal to take. Reporting it as
   * uncovered is what asks for the name.
   */
  it("is reported as unbound when only a path inside it is kept", () => {
    const source =
      'const envFile = join(await mkdtemp(join(tmpdir(), "canoncore-setup-")), ".env");';

    expect(temporaryDirectoriesIn(source)).toStrictEqual([
      { line: 1, call: "mkdtemp", bound: null, removed: false },
    ]);
  });

  /**
   * PROSE IS NOT A CALL SITE, which this file is itself the proof of: the
   * docblock above says `mkdtemp` out loud, and the sweep that reads this
   * repository would count it. `without-comments.ts` exists for exactly this,
   * and every suite here that reads source as text goes through it first.
   */
  it("is not read out of a comment that only talks about one", () => {
    const source = [
      '/** A suite calling mkdtempSync(join(tmpdir(), "x-")) and never removing it. */',
      '// mkdtemp(join(tmpdir(), "y-"))',
      "export const nothing = 1;",
    ].join("\n");

    expect(temporaryDirectoriesIn(source)).toStrictEqual([]);
  });

  /**
   * THE HOLE A PRESENCE CHECK LEAVES, and the reason this pairs by COUNT. Two
   * sites in one file reusing one name are indistinguishable to a scan, so
   * "somewhere in this file there is an `rmSync(dir)`" reads the second one as
   * covered by the first one's removal -- which is precisely the silent
   * sixteenth site CNCORE-336 asks to make impossible.
   *
   * BOTH ARE REPORTED, not the later one. Without scopes there is nothing to
   * say which of the two the single removal belongs to, and naming one would
   * be a guess a reader would then have to check.
   */
  it("is reported when one removal is shared between two sites of the same name", () => {
    const source = [
      'const dir = mkdtempSync(join(tmpdir(), "first-"));',
      "rmSync(dir, { recursive: true, force: true });",
      'const dir2 = mkdtempSync(join(tmpdir(), "second-"));',
      "rmSync(dir2, { recursive: true, force: true });",
    ].join("\n");
    const shared = source.replaceAll("dir2", "dir").split("\n").slice(0, 3).join("\n");

    expect(temporaryDirectoriesIn(source).map((site) => site.removed)).toStrictEqual([true, true]);
    expect(temporaryDirectoriesIn(shared).map((site) => site.removed)).toStrictEqual([
      false,
      false,
    ]);
  });
});
