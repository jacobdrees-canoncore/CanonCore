import { execFileSync } from "node:child_process";

import { repoRoot } from "./repo-root";

/**
 * What git tracks at the repository root, for the suites that ask the INDEX
 * rather than the directory.
 *
 * Five suites in this package asked it: `ui-callers.test.ts`,
 * `biome-config.test.ts`, `turbo-cache-inputs.test.ts`, `adr-as-built.test.ts`
 * and `adr-identifiers.test.ts`. `ADR-0171` carries the fold and its argument;
 * what is here is the part that has to be true for all five.
 *
 * GIT RATHER THAN A DIRECTORY WALK, which is `biome-config.test.ts`'s reason in
 * its own words: build output and `node_modules` are not tracked and so cannot
 * produce a false failure. A tree walk would have to re-implement `.gitignore`
 * to say the same thing, and would be wrong about it.
 *
 * `-z` RATHER THAN LINES, AND THIS IS THE SENTENCE THE FOLD EXISTS FOR. Without
 * it git applies `core.quotePath` and hands back a non-ASCII filename
 * double-quoted with its bytes octal-escaped, which then fails to open -- a read
 * throwing ENOENT on a file that is sitting right there. A newline in a filename
 * breaks a line split the same way. `ui-callers.test.ts` argued this at length
 * and `turbo-cache-inputs.test.ts`, holding the IDENTICAL pathspec, did not have
 * it: same read, same population, one guard, no comment saying why. Nothing
 * reported it and nothing could, because this tree has no non-ASCII path to
 * fail on. That is the drift ADR-0136 predicts -- "it drifts in whatever half
 * nobody is looking at" -- and one call site is what stops the next one.
 *
 * THE EMPTY FILTER IS PART OF THE CONTRACT, not tidying. `-z` TERMINATES each
 * path rather than separating on them, so a split leaves a trailing "" that
 * joins back to `repoRoot` itself -- a directory, which `readFileSync` throws
 * EISDIR on. All five callers wrote that filter out by hand; a sixth would have
 * had to know to.
 *
 * IT DOES NOT GUARD AGAINST AN EMPTY ANSWER, deliberately. Three of the five
 * raise on one in their own words about their own population -- "no tracked
 * module under packages/ui/src", "no tracked source file cites a record" --
 * and `biome-config.test.ts` asserts the count is above zero. A guard here
 * could only say "git found nothing", which is the one phrasing that tells a
 * reader least, and it would make `isTrackedAs` below impossible: that one is
 * ASKING whether the answer is empty.
 *
 * THE FIFTH, `turbo-cache-inputs.test.ts`, HAS NO WORDED GUARD and is named
 * here rather than counted in: an empty walk reddens it only indirectly,
 * through a list comparison that would report the wrong thing. That is a gap in
 * that suite, not a reason to put the guard here, and stating it is cheaper
 * than a sentence claiming all five are covered.
 *
 * IT THROWS WHERE ONE CALLER USED TO SHRUG. `biome-config.test.ts` spawned this
 * with `spawnSync` and read `result.stdout` without checking the status, so a
 * git that ran and failed handed it an empty list rather than an error.
 * `execFileSync` throws on a non-zero exit, which is the louder of the two and
 * the one a suite wants.
 *
 * `maxBuffer` IS THE UNION OF WHAT THE CALLERS SET, taken rather than argued:
 * two of the five raised it to 32MB for the whole-tree pathspec and the others
 * ran on node's 1MB default. One home means one number, and the larger is the
 * one that cannot truncate.
 */
export function trackedFiles(pathspec: string[] = []): string[] {
  return execFileSync("git", ["ls-files", "-z", "--", ...pathspec], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\0")
    .filter((path) => path.length > 0);
}

/**
 * Whether git tracks a file under EXACTLY this path.
 *
 * THE GUARD TWO SUITES CARRY FOR THEIR OWN SELF-EXCLUSION.
 * `adr-as-built.test.ts` and `adr-identifiers.test.ts` each hold their own path
 * as a literal in order to exclude their own prose from the population they
 * enforce, and a literal goes stale silently: rename the file and the exclusion
 * matches nothing, handing the suite's own comments back to the check it feeds.
 * `adr-as-built.test.ts` named the shape -- "an exclusion that stops excluding
 * reports nothing by its nature".
 *
 * IT COMPARES THE NAME RATHER THAN COUNTING MATCHES, and that is the near miss
 * worth stating: a pathspec naming a DIRECTORY matches every file beneath it,
 * so a guard asking only "did git return anything" would be satisfied by a
 * child and read a rename as fine.
 *
 * `:(literal)` MAKES THE COMMAND SAY WHAT THE SENTENCE ABOVE SAYS, and it is
 * belt-and-braces rather than a fix for a live defect -- the distinction is
 * worth writing down because the tidier claim would be the false one. Git reads
 * pathspec MAGIC even after `--`, so a path opening with `:` is a directive
 * rather than a name; but comparing git's answer to `path` ITSELF already
 * rejects anything magic or a glob would produce, since a match found that way
 * comes back spelled differently from the pattern that found it. The prefix
 * closes the gap at the command instead of relying on that, which is worth one
 * string on a helper that is now shared and will meet paths this file has not
 * seen.
 */
export function isTrackedAs(path: string): boolean {
  return trackedFiles([`:(literal)${path}`])[0] === path;
}
