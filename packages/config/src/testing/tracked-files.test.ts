import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./repo-root";
import { isTrackedAs, trackedFiles } from "./tracked-files";

/**
 * The walk five suites in this package share, asserted at the contract they
 * actually lean on rather than at the command it spawns.
 *
 * NOTHING HERE RE-RUNS `git ls-files` AND COMPARES. That assertion recomputes
 * the answer the way the code does, so it passes by construction and could
 * never disagree. What is checked instead is what every caller goes on to do
 * with the result: open the path.
 */
describe("the tracked-files walk", () => {
  /**
   * IT IS GIT'S ANSWER, NOT THE DIRECTORY'S, which is the whole reason these
   * suites spawn a process instead of walking the tree. `biome-config.test.ts`
   * states it: build output and `node_modules` are not tracked and so cannot
   * produce a false failure.
   *
   * The subject is a file that IS on disk, so a directory walk would find it.
   */
  it("leaves out a file that exists on disk but is untracked", () => {
    const untracked = "node_modules/.bin/biome";
    expect(existsSync(join(repoRoot, untracked))).toBe(true);

    expect(trackedFiles()).not.toContain(untracked);
  });

  /** And it does report the tracked ones, so the row above is not vacuous. */
  it("reports files the repository tracks", () => {
    const all = trackedFiles();

    expect(all).toContain("package.json");
    expect(all).toContain("packages/config/package.json");
    expect(all.length).toBeGreaterThan(100);
  });

  /**
   * EVERY PATH IT HANDS BACK OPENS, which is the guarantee the callers spend.
   * All five read each path straight back with `readFileSync(join(repoRoot, p))`,
   * so a path that is decorated, quoted or split wrong does not fail here -- it
   * fails later as ENOENT on a file that is sitting right there.
   */
  it("hands back paths that open, every one of them", () => {
    const missing = trackedFiles().filter((path) => !existsSync(join(repoRoot, path)));

    expect(missing).toStrictEqual([]);
  });

  /**
   * NO EMPTY STRING SURVIVES. `git ls-files -z` terminates every path with NUL
   * rather than separating on it, so a plain split leaves a trailing "" that
   * resolves to `repoRoot` itself -- a directory, which `readFileSync` throws
   * EISDIR on. Every caller wrote its own filter for this; the filter lives
   * here now, so the next caller cannot forget it.
   */
  it("never hands back an empty path", () => {
    expect(trackedFiles().filter((path) => path === "")).toStrictEqual([]);
  });

  /**
   * A PATHSPEC NARROWS, and what it narrows is the same population -- so a
   * caller's pathspec cannot reach something the unfiltered walk does not hold.
   */
  it("narrows to a pathspec, within the same population", () => {
    const configOnly = trackedFiles(["packages/config/*.ts"]);
    const all = new Set(trackedFiles());

    expect(configOnly.length).toBeGreaterThan(0);
    expect(configOnly.every((path) => path.startsWith("packages/config/"))).toBe(true);
    expect(configOnly.every((path) => all.has(path))).toBe(true);
  });

  /**
   * AN EXCLUSION EXCLUDES. Two suites lean on `:(exclude)` to keep their own
   * prose out of the population they enforce, and an exclusion that silently
   * stopped matching would hand that prose back -- a check going green on its
   * own subject.
   */
  it("honours an exclude pathspec", () => {
    const withoutDocs = trackedFiles([".", ":(exclude)docs/**"]);

    expect(withoutDocs.some((path) => path.startsWith("docs/"))).toBe(false);
    expect(trackedFiles(["."]).some((path) => path.startsWith("docs/"))).toBe(true);
  });

  /** A pathspec matching nothing is empty, rather than one empty string. */
  it("answers nothing for a pathspec that matches nothing", () => {
    expect(trackedFiles(["packages/config/no-such-file-here.ts"])).toStrictEqual([]);
  });
});

/**
 * The self-exclusion guard two suites carry, in one place.
 *
 * Both hold their own path as a literal so they can exclude themselves, and
 * both then check the literal still names a tracked file -- because a rename
 * leaves the exclusion matching nothing and the suite goes GREEN ON ITS OWN
 * SUBJECT. `adr-as-built.test.ts` put it best: "an exclusion that stops
 * excluding reports nothing by its nature".
 */
describe("whether git tracks a path under exactly that name", () => {
  it("is true for a file tracked under the name given", () => {
    expect(isTrackedAs("packages/config/package.json")).toBe(true);
  });

  it("is false for a path the repository does not track", () => {
    expect(isTrackedAs("packages/config/renamed-away.json")).toBe(false);
  });

  /**
   * AND FALSE FOR A DIRECTORY, which is the near miss that matters: a directory
   * pathspec MATCHES every file beneath it, so a guard asking "did git return
   * my path" on a directory would be answered with a child's path and read as a
   * rename. It has to be the name itself or nothing.
   */
  it("is false for a directory, which matches its children rather than itself", () => {
    expect(isTrackedAs("packages/config/src/testing")).toBe(false);
  });

  /**
   * A NAME IS A NAME, NEVER A PATHSPEC DIRECTIVE. Git reads magic even after
   * `--`, so these two would otherwise be a directive and a glob rather than
   * things to look for. Both are false because no file is called either, and
   * neither may answer TRUE by matching something else.
   */
  it("reads a magic-looking or glob-looking name as a name", () => {
    expect(isTrackedAs(":(exclude)docs/**")).toBe(false);
    expect(isTrackedAs("packages/config/*.json")).toBe(false);
  });
});
