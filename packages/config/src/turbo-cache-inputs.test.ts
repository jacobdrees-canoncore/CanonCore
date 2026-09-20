import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./testing/repo-root";
import { plannedTasks } from "./testing/turbo-dry-run";

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

/**
 * What `turbo` will hash for every `test` task, which IS the cache key: a task
 * whose inputs cover a file cannot replay over an edit to it.
 *
 * THE STRICT READER, because the task asked for is a LITERAL. Every assertion
 * below reads off this array, so a turbo that answered nothing must stop the
 * file rather than empty it -- which is what `plannedTasks` throwing gives, and
 * what its refusal-tolerant sibling would take away.
 */
const tasks = plannedTasks("test");

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
    // The install path a stranger follows, held to `serverSchema`'s required fields.
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
    // Twenty-five suites here read the repository at large -- `biome-config.test.ts`
    // asks whether the linter reaches every file git tracks -- so the inputs
    // cannot be enumerated and the task opts out of caching entirely instead.
    // Asserted below rather than taken on trust: this excuse rotting back into a
    // cached task would restore the defect across all of them at once.
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
  {
    package: "@canoncore/ui",
    // `globals.css.test.ts` holds every `@source` in the stylesheet to matching a
    // file, and one of them points at `apps/**/*.{ts,tsx}` -- so the suite's
    // answer depends on a glob over another package, which is the dependency the
    // stylesheet itself declares (ADR-0158). `utilities.test.ts` reaches into
    // `node_modules`, compiling the stylesheet with the real Tailwind.
    //
    // `directives.test.ts` IS A THIRD REASON AGAIN, having briefly stopped being
    // one. CNCORE-276 deleted the limb that read `@base-ui/react`'s own files,
    // leaving it reading only this package's components; CNCORE-283 then gave it
    // a ground that needs the render graph, so it now sweeps
    // `apps/web/src/components`, builds an importer graph over the whole of
    // `apps/web/src`, and resolves imported packages out of `node_modules` to ask
    // whether they mark a client boundary (ADR-0164). The `why` is unchanged
    // because each of the three holds on its own.
    //
    // A GLOB IS NOT A FILE LIST, which is why this is here rather than in
    // `READS_OUTSIDE_ITS_PACKAGE`. Naming the files under `apps/` would mean a
    // list that churns on every file added there, and naming a representative few
    // would be the "is it represented?" check ADR-0105 warns about. The task opts
    // out of caching instead, exactly as `@canoncore/config`'s does.
    why: "its test task is uncached, because its inputs are a glob over `apps/` and `node_modules`",
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
/**
 * The source with its comments stripped, because this scan reads TEXT and a
 * comment is prose ABOUT code rather than code.
 *
 * WITHOUT THIS THE CHECK ARGUES WITH WHOEVER DOCUMENTS IT. The comment above
 * explains the rule using `../../../` as its example, and that sentence alone was
 * enough to report `packages/config` as reaching outside itself -- measured, not
 * feared. A guard that fires on a description of itself is the
 * arguing-with-the-check death ADR-0124 warns about, and it would fire again on
 * the next person who writes a path into a note.
 *
 * A `//` IS ONLY A COMMENT AFTER WHITESPACE, which is the rung that keeps this
 * from causing the silence it exists to prevent. Excluding a preceding `:` is not
 * enough: a PROTOCOL-RELATIVE `"//fonts.googleapis.com"` has a quote before it,
 * so that version read the rest of the line as a comment and ATE a real climb
 * sitting after it -- a false negative, which is worse here than the false
 * positive it was fixing. Measured both ways before choosing.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/.*$/gm, "$1");
}

/**
 * Where each of `@canoncore/config`'s published helpers actually lives, read off
 * that package's own `exports` rather than guessed -- so a renamed or added helper
 * cannot quietly drop out of the walk below.
 */
function publishedHelpers(): Map<string, string> {
  const manifest: { exports: Record<string, string> } = JSON.parse(
    readFileSync(join(repoRoot, "packages", "config", "package.json"), "utf8"),
  );
  return new Map(
    Object.entries(manifest.exports)
      .filter(([, target]) => target.endsWith(".ts"))
      // `join` normalises a leading `./` itself, so an export written without
      // one still resolves rather than silently losing its first two characters.
      .map(([specifier, target]) => [
        `@canoncore/config${specifier.replace(/^\./, "")}`,
        join("packages", "config", target),
      ]),
  );
}

/**
 * Every module a file imports, as repo-relative paths this walk can follow.
 *
 * BOTH SPELLINGS, because reach travels by either. `ci-workflow.ts` opens
 * `ci.yml` and imports `repo-root` RELATIVELY, while the suites that use it are
 * two packages away and import it by its PUBLISHED specifier -- so a walk that
 * knew only one of the two would break the chain in the middle and report the
 * suite as reaching nothing.
 *
 * The extension is the importer's to omit, so each candidate is offered in the
 * spellings a resolver would try; the caller keeps whichever exists.
 */
function importsOf(path: string, source: string, helpers: Map<string, string>): string[] {
  const found = [...helpers]
    .filter(([specifier]) => source.includes(specifier))
    .map(([, target]) => target);

  // `from "..."`, `import("...")` and `require("...")` alike: reach travels by
  // whichever the file happened to use, and a walk that knew only the static
  // form would break the chain on a lazily imported helper.
  for (const match of source.matchAll(/(?:from|import|require)\s*\(?\s*["'](\.[^"']*)["']/g)) {
    const base = join(dirname(path), match[1] as string);
    found.push(`${base}.ts`, `${base}.tsx`, join(base, "index.ts"));
  }
  return found;
}

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
 * A CLIMB IS COUNTED AGAINST HOW DEEP THE FILE SITS, so `../../../` leaves from
 * `src/` and only reaches `packages/` from `src/testing/`. The depth is
 * positional, which is the counting `repo-root.ts` exists to do once.
 *
 * AND REACH IS INHERITED, which is the rung a first version missed. `repo-root.ts`
 * is the only file in the tree that climbs to the root, and every suite that reads
 * a root file does it by importing that constant rather than by climbing itself --
 * so a walk that read climbs alone would report ONE reaching file and no reaching
 * suites. Propagating it to importers is what makes the answer the set of suites
 * rather than the set of path expressions.
 *
 * IT ANSWERS "does this PACKAGE belong on a list", never "is that list complete":
 * which FILES a suite goes on to open is not visible from here, which is why the
 * lists above name files and this names only packages.
 */
function packagesReachingOutsideThemselves(): string[] {
  const tracked = execFileSync(
    "git",
    ["ls-files", "packages/*.ts", "packages/*.tsx", "apps/*.ts", "apps/*.tsx"],
    { cwd: repoRoot, encoding: "utf8" },
  )
    .split("\n")
    .filter((path) => path.length > 0);

  const sources = new Map(
    tracked.map((path) => [path, withoutComments(readFileSync(join(repoRoot, path), "utf8"))]),
  );
  const helpers = publishedHelpers();

  const reachingFiles = new Set(
    tracked.filter((path) => {
      // RESOLVED RATHER THAN COUNTED. An earlier version counted the leading
      // `../` run against how deep the file sat, which required the climb to
      // begin at the opening quote: `"./nested/../../../shared"` leaves the
      // package and matched NOTHING. Resolving the literal the way the runtime
      // would, then asking whether it landed outside, has no such shape to be
      // written around -- and it drops the arithmetic that needed a comment to
      // be believed.
      //
      // ONLY A RELATIVE SPECIFIER IS A PATH, which is the rung that keeps this
      // from reading prose as a filesystem. A string merely CONTAINING `../` is
      // usually not a path at all: `credential.test.ts` asserts on the URL
      // `"/..//evil.test"` to prove a traversal is refused, and because that
      // string is ABSOLUTE, `resolve` discards everything before it and lands on
      // `/evil.test` -- outside the package, and a false positive that broke CI
      // on an unrelated merge. A path a file actually reaches through opens `./`
      // or `../`; a URL, a regex and a traversal fixture do not.
      const packageDirectory = join(repoRoot, ...path.split("/").slice(0, 2));
      return [...(sources.get(path) ?? "").matchAll(/["'`](\.\.?\/[^"'`\n]*)["'`]/g)].some(
        (literal) =>
          !`${resolve(repoRoot, dirname(path), literal[1] as string)}${sep}`.startsWith(
            `${packageDirectory}${sep}`,
          ),
      );
    }),
  );

  // A helper that reaches outside carries that reach to whatever imports it, and
  // on to whatever imports THAT -- run to a fixed point rather than one hop, so a
  // chain through an intermediate module cannot break in the middle.
  for (let settled = false; !settled; ) {
    settled = true;
    for (const path of tracked) {
      if (reachingFiles.has(path)) continue;
      const imported = importsOf(path, sources.get(path) ?? "", helpers);
      if (imported.some((target) => reachingFiles.has(target))) {
        reachingFiles.add(path);
        settled = false;
      }
    }
  }

  const owner = new Map(tasks.map(({ directory, taskId }) => [directory, taskId.split("#")[0]]));
  const reaching = new Set<string>();

  for (const path of reachingFiles) {
    const directory = path.split("/").slice(0, 2).join("/");
    const packageName = owner.get(directory);
    // LOUDLY rather than skipped. A package with no `test` task has no inputs for
    // this check to read, so dropping it quietly would be the silence the whole
    // check exists to refuse -- the gap arriving through the door marked exit.
    if (packageName === undefined) {
      throw new Error(
        `\`${path}\` reaches outside \`${directory}\`, which has no \`test\` task for this check ` +
          "to read inputs from. Give it one, or its reach goes unchecked.",
      );
    }
    reaching.add(packageName);
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
    // holds twenty-five suites reading the repository at large; the day its task caches,
    // all of them start replaying stale passes and no other check would notice.
    const uncached = NOTHING_FOR_TURBO_TO_HASH.filter(({ why }) => why.includes("uncached"));

    expect(uncached.length).toBeGreaterThan(0);
    expect(
      uncached.map(({ package: name }) => testTask(name).resolvedTaskDefinition.cache),
    ).toStrictEqual(uncached.map(() => false));
  });
});
