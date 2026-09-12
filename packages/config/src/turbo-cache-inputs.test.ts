import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./testing/repo-root";

/**
 * A SUITE THAT READS A FILE OUTSIDE ITS PACKAGE IS CACHED AGAINST THAT FILE.
 *
 * `turbo` hashes a task against the files of its OWN package and nothing else.
 * A suite that reaches out of its package -- `glossary.test.ts` reads the root
 * `CONTEXT.md`, `install-path.test.ts` reads the `README` and the `Dockerfile` --
 * is therefore cached against everything except the thing it is checking, and
 * editing that thing REPLAYS A STALE PASS.
 *
 * CNCORE-132 is the instance: CNCORE-101 added a glossary entry banning `health`,
 * which collides with `healthCheckResult` on the read path. `pnpm test` passed
 * locally across ten tasks and CI failed. The difference was the cache, not the
 * code. Measured before the fix, appending a line to `CONTEXT.md` left
 * `@canoncore/schemas#test` on hash `68c4f053449da0a2` -- unmoved.
 *
 * THE FAILURE POINTS THE WRONG WAY, which is what makes it worth a guard rather
 * than a note. Somebody edits the glossary, runs the full suite, sees green, and
 * concludes the rule is satisfied; the person best placed to fix the name is the
 * one who never sees it fail. ADR-0124 built that check precisely because "a rule
 * nothing reads is a rule somebody remembers", and a cached check is read less
 * often than it looks.
 *
 * ASKED OF `turbo` RATHER THAN OF `turbo.json`. Reading the config files back and
 * asserting the `inputs` entries are present would restate the fix in a second
 * language -- the thing ADR-0124 and `glossary.test.ts` both refuse -- and it
 * would pass by construction wherever it was wrong. An unmatched glob is dropped
 * SILENTLY: `$TURBO_ROOT$/CONTEXT.MD` reads fine, matches nothing, and caches
 * exactly as badly as no entry at all. Only the dry run knows. `repo-root.test.ts`
 * checks its depth against git for the same reason.
 */
const TURBO = join(repoRoot, "node_modules", ".bin", "turbo");

/**
 * What `turbo` will hash for every `test` task, which IS the cache key: a task
 * whose inputs cover a file cannot replay over an edit to it.
 *
 * Run once for the file, at about 0.2s. `--dry` resolves the graph and runs no
 * task, so this is a read even though it is spawned through the runner.
 */
function plannedTestTasks(): {
  taskId: string;
  directory: string;
  inputs: Record<string, string>;
  resolvedTaskDefinition: { cache: boolean };
}[] {
  const dryRun = execFileSync(TURBO, ["run", "test", "--dry=json"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(dryRun).tasks;
}

const tasks = plannedTestTasks();

function testTask(packageName: string) {
  const task = tasks.find(({ taskId }) => taskId === `${packageName}#test`);
  // Vacuous otherwise: every assertion below reads off this object, and a
  // renamed package would take the subject away rather than fail the check.
  expect(task, `no planned test task for ${packageName}`).toBeDefined();
  return task as NonNullable<typeof task>;
}

/**
 * The files a task is hashed against, keyed by ABSOLUTE path.
 *
 * Turbo reports an input path relative to the package that owns the task, so a
 * root file arrives spelled as a climb out of it. Resolving both sides is what
 * lets the assertions name the file rather than a spelling of it -- and keeps
 * them true if turbo ever reports the same input a different way.
 */
function filesHashedFor(packageName: string): Map<string, string> {
  const task = testTask(packageName);
  return new Map(
    Object.entries(task.inputs).map(([path, sha]) => [
      resolve(repoRoot, task.directory, path),
      sha,
    ]),
  );
}

/** What git has for a tracked file, which is the hash turbo reports for it. */
function gitBlobSha(path: string): string {
  return execFileSync("git", ["hash-object", path], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

/**
 * Every package whose `test` task reads a file outside itself, and the files it
 * reads -- each one declared to turbo in that package's own `turbo.json`.
 *
 * NAMED HERE RATHER THAN DERIVED, because the files a suite opens are not
 * knowable from outside it: `install-path.test.ts` reaches `ci.yml` through an
 * import two packages away, and `.env.example` through a list it builds at run
 * time. What IS derived is the set of packages that belong on this list, which
 * the canary below recomputes from the sources -- so a new suite reaching out of
 * its package fails rather than going quietly unlisted.
 */
const READS_OUTSIDE_ITS_PACKAGE = [
  {
    package: "@canoncore/schemas",
    files: ["CONTEXT.md"],
  },
  {
    package: "@canoncore/env",
    // The install path a stranger follows, held to `serverSchema` (ADR-0113).
    // `ci.yml` arrives through `@canoncore/config/testing/ci-workflow`, which is
    // why reading this list off the imports in the file would miss it.
    files: ["README.md", ".env.example", "compose.yaml", "Dockerfile", ".github/workflows/ci.yml"],
  },
];

/**
 * The packages that reach outside themselves and have NOTHING for turbo to hash,
 * each with the reason -- because "not on the list" and "nothing to declare" look
 * identical from here, and only one of them is correct.
 */
const NOTHING_FOR_TURBO_TO_HASH = [
  {
    package: "@canoncore/config",
    // Nine suites here read the repository at large -- `biome-config.test.ts`
    // asks whether the linter reaches every file git tracks -- so the inputs
    // cannot be enumerated and the task opts out of caching entirely instead.
    // Asserted below rather than taken on trust: this excuse rotting back into a
    // cached task would restore the defect across all nine at once.
    why: "its test task is uncached, because its real inputs are the whole repository",
  },
  {
    package: "@canoncore/db",
    // `load-env.ts`, `setup.ts` and `drizzle.config.ts` climb to `apps/web/.env`,
    // which `.gitignore` holds and `git ls-files` does not report. Turbo hashes
    // TRACKED files, so there is no input to declare; what varies with the
    // environment is declared through the task's `env` key instead.
    why: "it reaches only `apps/web/.env`, which is gitignored and so unhashable",
  },
  {
    package: "web",
    // `next.config.ts` sets `outputFileTracingRoot` to the workspace root. That
    // names a DIRECTORY for the build to trace from and opens no file, so no
    // file's content belongs in the key.
    why: "it names the workspace root as a directory to trace from, and reads no file",
  },
];

describe.each(READS_OUTSIDE_ITS_PACKAGE)(
  "$package, whose suite reads outside its package",
  ({ package: packageName, files }) => {
    it("is cached against every file it reads", () => {
      const hashed = filesHashedFor(packageName);

      expect(files.filter((file) => !hashed.has(join(repoRoot, file)))).toStrictEqual([]);
    });

    it("is cached against their CONTENT, so an edit cannot replay a stale pass", () => {
      // The half that earns the acceptance criterion. A path listed in the plan
      // without git's content behind it would satisfy the test above while
      // caching exactly as badly as before: what makes a warm cache MISS on an
      // edit is the file's own bytes sitting inside the key.
      const hashed = filesHashedFor(packageName);

      expect(files.map((file) => hashed.get(join(repoRoot, file)))).toStrictEqual(
        files.map(gitBlobSha),
      );
    });
  },
);

/**
 * The packages whose tracked sources reach outside their own directory, RECOMPUTED
 * from the sources rather than listed.
 *
 * THIS IS THE HALF THAT STOPS THE LISTS ABOVE ROTTING. A hand-kept list of
 * packages goes stale the day a new suite reads a root file: it would be cached
 * against everything except the file it checks, exactly as `glossary.test.ts` was,
 * and nothing here would say so. Silence is the one failure mode a guard must not
 * have -- the argument `glossary.test.ts` makes for its own canary, and ADR-0124's
 * for an EXACT-match allowance over a subset.
 *
 * TWO WAYS OUT OF A PACKAGE, because there are two in the tree. A relative climb
 * is counted against how deep the file sits inside its package, so `../../../` is
 * an escape from `src/` and merely `packages/` from `src/testing/` -- the depth is
 * positional, which is the counting `repo-root.ts` exists to do once. The other is
 * importing `repoRoot` itself, whose whole purpose is to leave.
 *
 * IT CANNOT SEE WHICH FILE a `repoRoot` import goes on to open, which is why the
 * lists above name files and this only names packages. It answers "does this
 * package belong on a list", never "is that list complete".
 */
function packagesReachingOutsideThemselves(): string[] {
  const tracked = execFileSync("git", ["ls-files", "packages/*.ts", "apps/*.ts"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .filter((path) => path.length > 0);

  const owner = new Map(tasks.map(({ directory, taskId }) => [directory, taskId.split("#")[0]]));
  const reaching = new Set<string>();

  for (const path of tracked) {
    const segments = path.split("/");
    // `packages/<name>/<...>/file.ts`: how many directories deep the file sits
    // inside its own package, which is how far a climb may go before it leaves.
    const insideItsPackage = segments.length - 3;
    const source = readFileSync(join(repoRoot, path), "utf8");

    const climbsOut = [...source.matchAll(/["'`]((?:\.\.\/)+)/g)].some(
      (climb) => (climb[1] as string).length / 3 > insideItsPackage,
    );
    if (!climbsOut && !source.includes("testing/repo-root")) continue;

    const packageName = owner.get(segments.slice(0, 2).join("/"));
    if (packageName !== undefined) reaching.add(packageName);
  }
  return [...reaching].sort();
}

describe("the packages that reach outside themselves", () => {
  it("are all accounted for, so a new one cannot go quietly uncached", () => {
    const accounted = [
      ...READS_OUTSIDE_ITS_PACKAGE.map(({ package: name }) => name),
      ...NOTHING_FOR_TURBO_TO_HASH.map(({ package: name }) => name),
    ].sort();

    // AN EXACT MATCH RATHER THAN A SUBSET, on ADR-0124's argument for its own
    // allowance: a package that stops reaching outside has to be DELETED from the
    // list above, or the list grows into a record of what used to be true and the
    // next entry joins it without argument.
    expect(packagesReachingOutsideThemselves()).toStrictEqual(accounted);
  });

  it("really is uncached where that is the excuse given", () => {
    // The one excuse above that could rot back into the defect. `packages/config`
    // holds nine suites reading the repository at large; the day its task caches,
    // all nine start replaying stale passes and no other check would notice.
    const uncached = NOTHING_FOR_TURBO_TO_HASH.filter(({ why }) => why.includes("uncached"));

    expect(uncached.length).toBeGreaterThan(0);
    expect(
      uncached.map(({ package: name }) => testTask(name).resolvedTaskDefinition.cache),
    ).toStrictEqual(uncached.map(() => false));
  });
});
