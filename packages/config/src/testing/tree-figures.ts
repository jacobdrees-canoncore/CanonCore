import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { pnpmSetupSteps, workflow } from "./ci-workflow";
import { repoRoot } from "./repo-root";
import { configFilesOnDisk, namedConfig, suiteScripts } from "./vitest-configs";

/**
 * Every count this repository states about ITSELF, derived from the tree that
 * is the subject of the claim.
 *
 * A figure measured once, written into prose, and never re-measured is this
 * repository's most common defect (CNCORE-251). The 688-file scan of
 * 2026-09-20 found roughly thirty-five of them, in decision records, in
 * `CLAUDE.md`, in `ci.yml`, and in test NAMES that printed the wrong number on
 * every run. Each was true when it was written.
 *
 * WHAT MAKES ONE CATCHABLE IS THAT THE TREE STILL HOLDS THE ANSWER. A count of
 * this repository's own files, jobs, configs or call sites can be taken again
 * by anything that can read the tree, so the claim and the answer can be put
 * beside each other and a drift reported. That is all this module does: one
 * function per population, and `tree-figures.test.ts` holds each against the
 * sentence that states it.
 */
const read = (path: string): string => readFileSync(join(repoRoot, path), "utf8");

/**
 * The servers `apps/web`'s `test:e2e` stands up, counted where they are started.
 *
 * `anInstanceServing` and `theBuildServing` are the two spawns in
 * `e2e/instance.ts`, and `global-setup.ts` is the only file that calls either
 * to stand a server up for the suite. Counting the CALLS rather than the
 * fixtures is what makes this the servers rather than the exports: a fixture
 * reused by two suites is still one server, and a fixture nothing calls is none.
 */
export function serversStoodUpByTheHttpSuite(): number {
  return serversVia("anInstanceServing") + serversVia("theBuildServing");
}

/**
 * The servers `global-setup.ts` stands up through ONE of the two spawns.
 *
 * THE SPLIT IS STATED AS OFTEN AS THE TOTAL IS -- "ten through
 * `anInstanceServing` and one through `theBuildServing`", "Nine of this suite's
 * servers ... and the tenth" -- and a sentence naming the last of a series
 * states the size of it. So both halves are derivable here rather than the
 * total alone, and a claim can be held to whichever one it makes.
 */
export function serversVia(spawn: "anInstanceServing" | "theBuildServing"): number {
  const setup = read("apps/web/e2e/global-setup.ts");
  return [...setup.matchAll(new RegExp(`\\b${spawn}\\(owned\\b`, "g"))].length;
}

/**
 * A count written the way these files write one, as a numeral or as a word.
 *
 * THE PROSE SPELLS THEM OUT, which is why this exists rather than `Number`.
 * "the seven `The page over HTTP` stands up", "ELEVEN, ten through
 * `anInstanceServing`", "the six jobs", "nine suites here": every figure this
 * module was built for is a word in a sentence, and half of them are shouted.
 * A reader that handled digits alone would match none of them.
 *
 * ORDINALS COUNT TOO, because a sentence naming the last of a series states the
 * size of it: "the tenth -- the fresh install" is a claim that there are ten.
 *
 * AN UNKNOWN WORD THROWS rather than returning `NaN`. A figure that silently
 * became `NaN` would equal no derived count and report as a drift, sending the
 * next reader to re-measure a tree that was never wrong.
 */
const COUNT_WORDS: Record<string, number> = {
  one: 1,
  first: 1,
  two: 2,
  second: 2,
  three: 3,
  third: 3,
  four: 4,
  fourth: 4,
  five: 5,
  fifth: 5,
  six: 6,
  sixth: 6,
  seven: 7,
  seventh: 7,
  eight: 8,
  eighth: 8,
  nine: 9,
  ninth: 9,
  ten: 10,
  tenth: 10,
  eleven: 11,
  eleventh: 11,
  twelve: 12,
  twelfth: 12,
  thirteen: 13,
  thirteenth: 13,
  fourteen: 14,
  fourteenth: 14,
  fifteen: 15,
  fifteenth: 15,
  sixteen: 16,
  sixteenth: 16,
  seventeen: 17,
  seventeenth: 17,
  eighteen: 18,
  eighteenth: 18,
  nineteen: 19,
  nineteenth: 19,
  twenty: 20,
  twentieth: 20,
};

const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50 };

export function asCount(written: string): number {
  const word = written.trim().toLowerCase().replace(/,/g, "");
  if (/^\d+$/.test(word)) return Number(word);

  // A COMPOUND IS ITS TWO HALVES ADDED, which is the only arithmetic here:
  // `twenty-one` is a count these comments really write, and listing every one
  // of them would be a table that runs out exactly where the tree grows past it.
  const [tens, unit] = word.split("-");
  if (unit !== undefined && TENS[tens as string] !== undefined) {
    const ones = COUNT_WORDS[unit];
    if (ones !== undefined && ones < 10) return (TENS[tens as string] as number) + ones;
  }
  if (TENS[word] !== undefined) return TENS[word] as number;

  const known = COUNT_WORDS[word];
  if (known === undefined) {
    throw new Error(
      `\`${written}\` is not a count this reader knows. Either the sentence was reworded and ` +
        "the claim has to follow it, or the word belongs in COUNT_WORDS.",
    );
  }
  return known;
}

/**
 * A file as ONE LINE, with the comment leader taken off first.
 *
 * Every claim below sits in prose hard-wrapped at 100 columns, so a pattern
 * matching raw bytes would break on a reflow that changed no claim -- the
 * reason `corpus-figures.test.ts` flattens before matching. What that file does
 * not have to do is step over a comment leader: these sentences live inside
 * JSDoc and YAML comments, where the wrap inserts ` * ` or ` # ` mid-sentence.
 *
 * MARKDOWN IS LEFT ALONE, because `#` opens a heading there and `*` opens a
 * bold span, and stripping either would rewrite the document this is reading.
 *
 * `//` IS STRIPPED AT THE LINE START ONLY. It is the leader on every line of a
 * wrapped line comment, and a sentence read with those left in has a `//` in
 * the middle of it that no pattern written against the prose would match. Only
 * at the start, because `https://` is two of the same characters in the middle
 * of a word.
 */
function flatten(path: string, text: string): string {
  const stripped = path.endsWith(".md")
    ? text
    : text
        .replace(/^[ \t]*\/\*+[ \t]?/gm, "")
        .replace(/^[ \t]*\/\/[ \t]?/gm, "")
        .replace(/^[ \t]*(?:\*|#)[ \t]?/gm, "");
  return stripped.replace(/\s+/g, " ").trim();
}

/**
 * The one count a pattern reads out of a file, or a throw naming the pattern.
 *
 * EXACTLY ONE MATCH, never the first of several, for `corpus-figures.test.ts`'s
 * reason: a sentence duplicated by a copy edit is two statements of the figure,
 * refreshed one at a time, which is the defect this file exists for in
 * miniature. A pattern that stops matching throws rather than quietly covering
 * nothing, so a reworded sentence goes red and the claim has to follow it.
 */
export function countStatedIn(path: string, pattern: RegExp): number {
  const found = [...flatten(path, read(path)).matchAll(pattern)];
  if (found.length !== 1) {
    throw new Error(
      `${path} has ${found.length} sentences matching ${pattern}, not 1. Either the sentence ` +
        "was reworded and this claim has to follow it, or the figure is now stated twice.",
    );
  }
  return asCount((found[0] as RegExpMatchArray)[1] as string);
}

/**
 * The jobs `.github/workflows/ci.yml` runs.
 *
 * ASKED OF THE PARSED WORKFLOW rather than counted off the indentation, because
 * `on:` holds keys at the same depth as a job and a line-counting rule reads
 * `push` as one of them.
 */
export function ciJobs(): number {
  return Object.keys(workflow().jobs ?? {}).length;
}

/**
 * The Vitest configs this repository holds.
 *
 * `configFilesOnDisk` is the reader `network-gate-wiring.test.ts` and
 * `packages/db` already share, and this is a third claim over the same files
 * rather than a second way of finding them.
 */
export function vitestConfigs(): number {
  return configFilesOnDisk().length;
}

/**
 * The suites this repository runs, counted off the manifests that declare them.
 *
 * A SUITE IS A SCRIPT THAT RUNS ONE, which is `runsASuite`'s rule rather than a
 * second one written here. `test:watch` is not a suite: it runs the config its
 * `run` twin already covers.
 */
export function suitesInRepo(): number {
  return suiteScripts().length;
}

/**
 * The suites that name a config rather than falling back to their package's
 * own `vitest.config.ts`.
 */
export function suitesNamingAConfig(): number {
  return suiteScripts().filter(({ command }) => namedConfig(command) !== undefined).length;
}

/**
 * The jobs that ask `pnpm/setup` for a Node runtime.
 *
 * `pnpmSetupSteps` is `ci-workflow.ts`'s reader, shared with
 * `node-major.test.ts` and `ci-workflow.test.ts` -- the walk this counts over
 * had been written out three times before that module took it (CNCORE-56).
 */
export function jobsRequestingANodeMajor(): number {
  return new Set(pnpmSetupSteps(workflow()).map(({ job }) => job)).size;
}

/**
 * The suites in THIS package that read the repository at large.
 *
 * TRANSITIVELY, because reaching the tree through `ci-workflow.ts` or
 * `workspace.ts` is reaching it. `ci-timeouts.test.ts` imports no path of its
 * own and asks `.github/workflows/ci.yml` every question it has, so a count of
 * direct importers would leave it out and understate what a cached task would
 * break.
 *
 * WHY THE COUNT MATTERS rather than the list: `turbo.json` opts this package's
 * test task out of caching because its real inputs are the whole repository,
 * and the size of that population is the argument. A figure that drifts low
 * makes the excuse look smaller than it is.
 */
export function suitesReadingTheRepository(): number {
  const source = join(repoRoot, "packages", "config", "src");
  const files = readdirSync(source, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => join(entry.parentPath, entry.name));

  const importsOf = new Map<string, string[]>(
    files.map((file) => [
      file,
      [...readFileSync(file, "utf8").matchAll(/from "(\.[^"]+)"/g)].map(
        (match) => `${resolve(dirname(file), match[1] as string)}.ts`,
      ),
    ]),
  );
  const theTree = join(source, "testing", "repo-root.ts");

  const reaches = (file: string, seen = new Set<string>()): boolean => {
    if (seen.has(file)) return false;
    seen.add(file);
    return (importsOf.get(file) ?? []).some((dep) => dep === theTree || reaches(dep, seen));
  };

  return files.filter((file) => file.endsWith(".test.ts") && reaches(file)).length;
}
