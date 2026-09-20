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
 * repository's most common defect (ADR-0153, CNCORE-251). The 688-file scan of
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
  twentieth: 20,
};

/**
 * The tens a compound opens with. `twenty` and `thirty`, because that is as far
 * as any sentence in this tree counts today and a word this does not know
 * THROWS with a message naming it -- so the next one is added when a claim
 * reaches it, rather than guessed at now.
 *
 * `thirty` IS HERE BECAUSE A CLAIM REACHED IT, which is this table working
 * rather than an exception to it. It read `twenty` alone until two tickets
 * pushed the table past twenty-nine in the same week -- CNCORE-255's two
 * placement-refusal claims and CNCORE-253's two about this suite's
 * parallelism -- and each one's throw named the missing word, as the sentence
 * above promises. NO COUNT IS STATED HERE: ADR-0153 is the document that
 * states it, once, and this is the reason rather than the figure.
 */
const TENS: Record<string, number> = { twenty: 20, thirty: 30 };

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
 * The Vitest configs that run their files ONE AT A TIME.
 *
 * `apps/web/vitest.e2e.config.ts` states this count to argue that its own
 * absence of the setting is a decision rather than an oversight (CNCORE-253),
 * and that argument is exactly the kind that goes stale: a sixth config taking
 * the setting would leave the sentence saying five, and a fifth dropping it
 * would leave the sentence arguing against a majority that no longer exists.
 *
 * READ AS TEXT AND ANCHORED AT THE LINE, rather than through `testBlockOf`,
 * because `derive` is synchronous and importing a config is not. The anchor is
 * what makes the text reading safe here: `^\s*fileParallelism` cannot match a
 * commented-out line, which is the failure `testBlockOf`'s own docblock warns a
 * text search has. A line that sets it to anything but `false` is not counted
 * either, since what is being counted is the suites that run serially.
 */
export function configsRunningTheirFilesSerially(): number {
  return configFilesOnDisk().filter((config) =>
    /^\s*fileParallelism:\s*false\b/m.test(readFileSync(config, "utf8")),
  ).length;
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

/**
 * The hand-built `redirect()` calls in ONE file, which is the population
 * ADR-0109's coding rule governs.
 *
 * COMMENTS ARE STRIPPED FIRST, and that is the whole difficulty. Every file
 * holding one of these also EXPLAINS it, quoting `redirect()` in the prose
 * above the call: a naive count of the token reads `login/actions.ts` as five
 * and `items/actions.ts` as five, and the figure that goes into the comment is
 * then wrong in the same file that states it.
 *
 * PER FILE RATHER THAN PER FUNCTION, because that is the unit the sentences
 * use -- "`login/actions.ts`'s four redirects" -- and because a function-scoped
 * count would need a parser to say where one ends. The file is what a reader
 * opens.
 */
export function handBuiltRedirectsIn(path: string): number {
  return [...codeOf(path).matchAll(/\bredirect\(/g)].length;
}

/** The code of a file, with every comment taken out of it. */
function codeOf(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * The call sites that read what a procedure answered, and how many of them sit
 * in a function that redirects on it.
 *
 * WHY THE SECOND NUMBER IS THE ONE WITH A CONSEQUENCE. `answer.ts` uses oRPC's
 * `safe` rather than a `try` precisely because `redirect()` works by throwing,
 * and a `try` written at one of these call sites would be one `catch` away from
 * swallowing the redirect as though it were the refusal. The size of the
 * population that could make that mistake is the argument for the design, so a
 * figure that drifts low makes the design look more cautious than it needs to
 * be.
 *
 * PER FUNCTION, because "redirects on what comes back" is a claim about one
 * function's control flow: the answer is read and then, in the same body, a
 * redirect is raised on it. A file-level count would read `items/actions.ts` as
 * ten call sites that all redirect, when four of its ten do.
 *
 * THE SPLIT IS ON THE EXPORT, which is where a Server Action begins. It is
 * cruder than a parser and it is enough: nothing in this tree nests one action
 * inside another.
 */
export function procedureAnswerCallSites(): { total: number; redirecting: number } {
  const files = ["devices", "groups", "import", "items", "login", "settings", "tasks"].map(
    (area) => `apps/web/src/app/${area}/actions.ts`,
  );
  files.push("apps/web/src/app/groups/page.tsx");

  let total = 0;
  let redirecting = 0;
  for (const file of files) {
    for (const body of codeOf(file).split(/\n(?=export (?:async )?(?:function|const) )/)) {
      const calls = [...body.matchAll(/\bwhatTheProcedureAnswered\(/g)].length;
      if (calls === 0) continue;
      total += calls;
      if (/\bredirect\(/.test(body)) redirecting += calls;
    }
  }
  return { total, redirecting };
}

/**
 * The properties migration 1 seeds into the catalogue.
 *
 * ADR-0029 refuses runtime writes to `properties`, so this number only ever
 * moves in a migration -- and the record that refuses it quotes the number
 * while arguing about the door it leaves open. Read off the `VALUES` list the
 * migration inserts, which is the only place it exists.
 */
export function propertiesSeededByMigrationOne(): number {
  const sql = read(
    "packages/db/src/migrations/20260910145307_migration_1_catalogue_and_projection.sql",
  );
  const values = /INSERT INTO "properties"[\s\S]*?CROSS JOIN \(VALUES([\s\S]*?)\n\)/.exec(sql);
  if (values === null) {
    throw new Error("migration 1 no longer seeds `properties` through a CROSS JOIN (VALUES ...)");
  }
  return [...(values[1] as string).matchAll(/^\s*\('[a-z_]+'/gm)].length;
}

/**
 * The rungs on ADR-0047's forward-only migration ladder.
 *
 * THE JOURNAL RATHER THAN THE HIGHEST NUMBER, and the two differ by one.
 * ADR-0047 settles it in the repo's own words -- "Migration 2 -- rung 3 in the
 * journal, since migration 1 is two rungs" -- because migration 1 ships as two
 * files. A record quoting the highest migration NUMBER as the ladder's length
 * is off by one for that reason and no other.
 */
export function migrationRungs(): number {
  const journal = JSON.parse(read("packages/db/src/migrations/meta/_journal.json")) as {
    entries: unknown[];
  };
  return journal.entries.length;
}

/**
 * The modules carrying `"use client"` across both component trees.
 *
 * ADR-0164 sweeps its rule over `packages/ui/src/components` and
 * `apps/web/src/components` and states how many carriers stand today, so the
 * sentence and the tree are put beside each other here. The count moved by one
 * the day that record was written -- CNCORE-283 removed `theme-provider.tsx`'s
 * directive in the same change -- which is exactly the drift ADR-0153 is about.
 *
 * THE DIRECTIVE IS THE FIRST THING THAT IS NOT A COMMENT OR BLANK, the same
 * test `directives.test.ts` applies. `header.tsx` discusses the directive at
 * length in its own doc comment and carries none, so a looser grep would count
 * it.
 */
export function directiveCarriers(): number {
  const directive = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/;

  return ["packages/ui/src/components", "apps/web/src/components"]
    .flatMap((root) =>
      readdirSync(join(repoRoot, root), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
        .map((entry) => read(`${root}/${entry.name}`)),
    )
    .filter((source) => directive.test(source)).length;
}

/**
 * The mentions of a visibility system in the schema and on the ladder.
 *
 * WHY A REFUSAL NEEDS THIS MORE THAN A COUNT DOES. ADR-0072 decides that this
 * product HAS no visibility system, and the evidence it rests on is a search
 * that comes back empty of one. An absence is the one claim that goes false
 * without anybody touching the sentence stating it: the record stays true right
 * up until somebody adds the column, and then it is wrong in a file nobody was
 * asked to reread. So the search is RUN here rather than quoted there.
 *
 * ONE HIT IS EXPECTED AND IT IS NOT A VISIBILITY SYSTEM. `tables.ts` calls an
 * ADR-0049 task-run row "THE VISIBILITY", meaning a failure that can still be
 * seen in the morning rather than a rule about who may see what. It is COUNTED
 * rather than skipped by a pattern, because a filter written to step over the
 * one known hit is a filter that would step over a real one worded the same
 * way -- and the number moving at all is the signal worth having.
 *
 * LINES RATHER THAN MATCHES, which is what `grep -c` counts and what the
 * record's sentence means by a hit.
 */
const A_VISIBILITY_SYSTEM = /visibilit|unlisted|is_public/i;

export function visibilityMentionsInTheSchema(): number {
  let mentions = 0;
  let filesRead = 0;

  for (const place of ["schema", "migrations"]) {
    const directory = join(repoRoot, "packages", "db", "src", place);
    for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.(ts|sql)$/.test(entry.name)) continue;
      filesRead += 1;
      mentions += readFileSync(join(entry.parentPath, entry.name), "utf8")
        .split("\n")
        .filter((line) => A_VISIBILITY_SYSTEM.test(line)).length;
    }
  }

  // THE ABSENCE NEEDS A SUBJECT, which is `ui-callers.test.ts`'s rule at the
  // root of its own chain: a walk that read nothing would report "no visibility
  // system" having looked at no schema, and that reads identically to the
  // record being right.
  if (filesRead === 0) {
    throw new Error("no schema or migration file was read, so the absence has no subject");
  }
  return mentions;
}

/**
 * The peak Postgres connections one `pnpm test:e2e` takes.
 *
 * NOT DERIVED FROM THE TREE, AND SO READ FROM THE ONE PLACE THAT OWNS IT.
 * This is a measurement of a running suite against a running database -- it
 * cannot be recomputed by reading files, and `apps/web/e2e/global-setup.ts` is
 * where it was taken and where its date and method are written down. What this
 * function is for is the OTHER statements of it: `CLAUDE.md` and the dispatch
 * skill both rest the four-agent ceiling on this number, and both carried
 * `55-60` for the eight days after the eleventh server pushed it to 67.
 *
 * So the rule here is corpus-figures.test.ts's rather than this file's usual
 * one: one population has one size, and the restatements are held to the
 * source rather than to each other.
 */
export function peakConnectionsInOneE2eRun(): number {
  return countStatedIn("apps/web/e2e/global-setup.ts", /THE PEAK IS (\d+), with the new/g);
}

/** ADR-0141's measurement window, as that record states it. */
const TIMEOUT_WINDOW =
  /Every attempt of the ([\d,]+) runs of `CI` created (\S+) to (\S+), successful/g;

const TIMEOUTS_RECORD =
  "docs/adr/0141-every-ci-job-stops-at-three-times-its-slowest-measured-run.md";

/**
 * The number of CI runs ADR-0141's ceiling figures were measured over.
 *
 * NOT DERIVABLE FROM THE TREE, for the reason that record gives: the durations
 * live on the forge, and reading them here would put a network call inside a
 * suite the network gate exists to keep offline. So the RECORD owns the window
 * and `ci-timeouts.test.ts` restates it -- and a restatement is the thing that
 * drifts. Both were moved by hand when the window moved under CNCORE-252, which
 * is exactly the edit nothing would have caught.
 */
export function runsInTheTimeoutWindow(): number {
  return countStatedIn(TIMEOUTS_RECORD, TIMEOUT_WINDOW);
}

/** The window's own bounds, so the two statements of it can be compared whole. */
export function timeoutWindowBounds(): { from: string; to: string } {
  const found = [...flatten(TIMEOUTS_RECORD, read(TIMEOUTS_RECORD)).matchAll(TIMEOUT_WINDOW)];
  if (found.length !== 1) {
    throw new Error(
      `${TIMEOUTS_RECORD} states its measurement window ${found.length} times, not 1`,
    );
  }
  const [, , from, to] = found[0] as RegExpMatchArray;
  return { from: from as string, to: to as string };
}

/** What `ci-timeouts.test.ts` says that window was, which must be the same one. */
export function timeoutWindowAsTheSuiteRestatesIt(): { from: string; to: string } {
  const suite = flatten(
    "packages/config/src/ci-timeouts.test.ts",
    read("packages/config/src/ci-timeouts.test.ts"),
  );
  const found = [...suite.matchAll(/runs of `CI` created (\S+) to (\S+), as the job's own/g)];
  if (found.length !== 1) {
    throw new Error(`ci-timeouts.test.ts states its window ${found.length} times, not 1`);
  }
  const [, from, to] = found[0] as RegExpMatchArray;
  return { from: from as string, to: to as string };
}

/**
 * The causes `placement.place` can be refused by: the SQLSTATEs
 * `placements.ts` narrows, each keyed to a cause and the sentence it carries.
 *
 * THE MAP IS THE POPULATION, not a list written beside it. CNCORE-255 made that
 * record `code -> { because, sentence }` precisely so a code cannot join the
 * narrowing without both, and this counts the same keys the router's prose
 * claims.
 */
export function placementRefusalCauses(): number {
  const body =
    /const PLACEMENT_REFUSALS: Readonly<\s*Record<string, \{ because: PlacementRefusalCause; sentence: string \}>\s*> = \{([\s\S]*?)\n\};/.exec(
      read("packages/db/src/placements.ts"),
    );
  if (body === null) {
    throw new Error(
      "`PLACEMENT_REFUSALS` is no longer a record literal in `packages/db/src/placements.ts`",
    );
  }
  return [...(body[1] as string).matchAll(/^\s*"(\d{5})":/gm)].length;
}

/**
 * The causes `placement.move` can be refused by: `place`'s four, plus the one
 * it raises directly rather than through a SQLSTATE.
 *
 * `PLACEMENT_REFUSAL_CAUSES` IS THE WHOLE SET and the type is read off it, so
 * counting it is counting what every surface must answer -- which is the point
 * of the list being one list.
 */
export function movePlacementRefusalCauses(): number {
  const body = /export const PLACEMENT_REFUSAL_CAUSES = \[([\s\S]*?)\n\] as const;/.exec(
    read("packages/db/src/placements.ts"),
  );
  if (body === null) {
    throw new Error(
      "`PLACEMENT_REFUSAL_CAUSES` is no longer an `as const` array in `packages/db/src/placements.ts`",
    );
  }
  return [...(body[1] as string).matchAll(/^\s*"[a-z-]+",$/gm)].length;
}
