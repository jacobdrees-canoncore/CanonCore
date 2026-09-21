import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./repo-root";
import { withoutCommentLeaders } from "./sentences";
import { trackedFiles } from "./tracked-files";

/**
 * THE EQUAL PAIR: a count stated against itself, which is how this tree writes
 * "every one of them". `18 of 18 stayed green`.
 *
 * THE BOUNDARIES ARE THE WHOLE DIFFICULTY. `1 of 1,566` is a RATIO and not a
 * pair, and a plain `\b` reads its `1 of 1` as one -- the comma is a word
 * boundary, so three sites in this tree matched before the class below was
 * widened to the separators a grouped number wears.
 */
const EQUAL_PAIR = /(?<![\d,.])(\d[\d,]*) of \1(?![\d,.])/g;

/**
 * ONE PART OF A RUN SUMMARY, IN VITEST'S OWN SPELLING: a count and the outcome
 * it is a count of.
 *
 * THE LEADING CLASS REFUSES A NUMBER THAT IS PART OF SOMETHING ELSE, and the
 * hyphen in it is load-bearing: `CNCORE-223 failed` is a ticket number and a
 * verb, and it was read as a run figure until that character joined the class.
 */
const PART = String.raw`(?<![\d,.\-])\d[\d,]* (?:passed|failed|skipped)\b`;

/**
 * A RUN SUMMARY: parts joined the three ways this tree joins them, with
 * vitest's parenthesised total where the writer kept it.
 */
const SUMMARY = new RegExp(`${PART}(?:(?: \\| |, | and )${PART})*(?: \\(\\d[\\d,]*\\))?`, "g");

/**
 * WHETHER A SUMMARY IS ABOUT A RUN AT ALL, WHICH ONLY `failed` MAKES DOUBTFUL.
 *
 * `passed` and `skipped` follow a count in no other sentence this tree writes.
 * `failed` follows one in several: `port 55432 failed:` opens a psql error,
 * and `10 failed guesses per subnet` is a rate limit. Both were read as run
 * figures before this rule, and neither is one. So a lone `failed` earns its
 * place only by standing beside another outcome or by carrying vitest's total.
 */
const isARunSummary = (summary: string): boolean =>
  /passed|skipped/.test(summary) || summary.endsWith(")");

/**
 * Every figure-shaped statement in one stretch of prose, in reading order.
 *
 * TWO SPELLINGS, AND THE SECOND IS WHY THIS EXISTS (CNCORE-339). Three hand
 * sweeps in a row grepped `N of N` alone. `provider-tmdb` answers ZERO to that
 * one and is not clean: its three figures are in vitest's spelling, so a sweep
 * keyed on the first would have certified the one repository no ticket had
 * ever swept.
 */
export function figuresIn(text: string): string[] {
  return placedFiguresIn(text).map(({ figure }) => figure);
}

/**
 * The same reading, with each figure's offset kept so the sweep can place it.
 *
 * THE OFFSET TRAVELS WITH THE MATCH rather than being looked up by the words
 * afterwards. A file states `29 passed (29)` twice and a lookup by text gives
 * both occurrences the first one's line, which sends a reader to the wrong
 * place and collapses two findings into one.
 */
export function placedFiguresIn(text: string): { figure: string; at: number }[] {
  return [
    ...[...text.matchAll(EQUAL_PAIR)],
    ...[...text.matchAll(SUMMARY)].filter(([summary]) => isARunSummary(summary)),
  ]
    .map((match) => ({ figure: match[0], at: match.index ?? 0 }))
    .sort((a, b) => a.at - b.at);
}

/**
 * THE TREE A FIGURE WAS TAKEN ON, in the two ways this tree names one.
 *
 * ADR-0153 GIVES THE FORM AND THIS EXECUTES IT: a figure that cannot be
 * derived carries its date. A commit counts for the same reason and is the
 * sharper of the two, since a date names a day and a day holds many trees.
 *
 * A TICKET IS NOT ONE, AND THAT WAS MEASURED RATHER THAN ASSUMED. Both figures
 * CNCORE-338 corrected name a ticket in their own sentence and neither names a
 * tree. A rule counting `CNCORE-206` as an anchor passes both controls, which
 * is how this one was chosen.
 *
 * THE COMMIT MUST WEAR ITS BACKTICKS, which is this tree's idiom for naming
 * one. A bare hex run is how a TOOL prints a commit, and the sentences quoting
 * tool output -- ADR-0181's merge-gate transcript -- are specimens of what
 * something else said rather than measurements taken here. They are registered
 * by hand below instead, which says what they are rather than inferring it.
 */
const AN_ANCHOR = /\d{4}-\d{2}-\d{2}|`[0-9a-f]{7,40}`/;

/** Whether a stretch of prose names the tree a figure inside it was taken on. */
export const carriesAnAnchor = (context: string): boolean => AN_ANCHOR.test(context);

/**
 * The tracked prose this sweep reads: source and documents alike.
 *
 * BOTH, BECAUSE THE DEFECT AND ITS EXEMPTION LIVE ON OPPOSITE SIDES. All three
 * figures CNCORE-333, CNCORE-335 and CNCORE-338 corrected stood in a test
 * file's comment, and `provider-tmdb`'s only figures stand in a markdown pass
 * record. A sweep of one side certifies the other.
 */
const THE_PROSE = ["*.ts", "*.md"];

/** How many tracked files this sweep opened, which its suite holds to a floor. */
export const filesSwept = (): number => trackedFiles(THE_PROSE).length;

/** A figure-shaped statement, and where a reader goes to look at it. */
export type StatedFigure = {
  readonly path: string;
  readonly line: number;
  readonly figure: string;
};

/**
 * ONE FILE AS ONE STRING, WITH EVERY CHARACTER STILL KNOWING ITS LINE.
 *
 * A FIGURE SURVIVES A WRAP THIS WAY, AND THAT IS THE POINT. Prose here is hard
 * wrapped at 100 columns, so `18 of\n * 18` is one figure to a reader and two
 * lines to a `git grep` -- the spelling `corpus-import-cost.ts` records as
 * having defeated two hand sweeps of a different figure. Flattening first
 * catches it; the offset map is what keeps the line number a reader can go to
 * after flattening has thrown the newlines away.
 */
function flattenedWithLines(path: string, text: string): { flat: string; lineAt: number[] } {
  const pieces: string[] = [];
  const lineAt: number[] = [];
  let first = true;
  for (const [index, raw] of withoutCommentLeaders(path, text).split("\n").entries()) {
    const piece = (first ? "" : " ") + raw.trim();
    first = false;
    pieces.push(piece);
    for (let at = 0; at < piece.length; at += 1) lineAt.push(index + 1);
  }
  return { flat: pieces.join(""), lineAt };
}

/** Every figure-shaped statement this tree states, wherever it states one. */
export function statedFigures(): StatedFigure[] {
  const found: StatedFigure[] = [];
  for (const path of trackedFiles(THE_PROSE)) {
    const { flat, lineAt } = flattenedWithLines(path, readFileSync(join(repoRoot, path), "utf8"));
    for (const { figure, at } of placedFiguresIn(flat)) {
      found.push({ path, line: lineAt[at] ?? 1, figure });
    }
  }
  return found;
}

/**
 * THE STRETCH OF PROSE A FIGURE'S ANCHOR MAY STAND IN.
 *
 * TWO UNITS, BECAUSE A WRITER STATES A MEASUREMENT IN TWO PLACES. A document's
 * is its SECTION: a pass record dates its heading once and then quotes a dozen
 * figures beneath it, and repeating the date at each would be the copy
 * ADR-0153 exists to prevent. A source file's is its COMMENT BLOCK: a docblock
 * names the tree it measured once and reasons from it for a paragraph.
 *
 * THE SOURCE UNIT IS THE BLOCK AND NOT A WINDOW OF N LINES, which is the
 * difference between a rule and a number nobody can defend. A window reaches
 * into the code above and the next docblock below, so a date belonging to a
 * different claim excuses this one; the block is the thing the sentence is
 * actually inside.
 */
export function contextOf(path: string, line: number): string {
  const lines = readFileSync(join(repoRoot, path), "utf8").split("\n");
  const at = line - 1;
  const opensASection = (index: number): boolean => lines[index]?.startsWith("#") === true;
  if (path.endsWith(".md")) {
    let start = at;
    while (start > 0 && !opensASection(start)) start -= 1;
    let end = at + 1;
    while (end < lines.length && !opensASection(end)) end += 1;
    return lines.slice(start, end).join("\n");
  }
  const inComment = (index: number): boolean =>
    /^\s*(?:\/\*|\*|\/\/)/.test(lines[index] ?? "\u0000");
  if (!inComment(at)) return lines[at] ?? "";
  let start = at;
  while (start > 0 && inComment(start - 1)) start -= 1;
  let end = at + 1;
  while (end < lines.length && inComment(end)) end += 1;
  return lines.slice(start, end).join("\n");
}

/**
 * Every figure this tree states whose own context does not say which tree it
 * was taken on.
 *
 * THIS IS THE POPULATION THE REGISTER ANSWERS FOR, and it is what three hand
 * sweeps were each computing by eye. The sweep finds it now, so a figure
 * written tomorrow is in it on the run that adds it rather than on whichever
 * day somebody next greps.
 */
export function unanchoredFigures(): StatedFigure[] {
  return statedFigures().filter(({ path, line }) => !carriesAnAnchor(contextOf(path, line)));
}

/**
 * A figure answered for by hand, because no anchor and no derivation can.
 */
type Registration = {
  readonly path: string;
  readonly figure: string;
  readonly kind: "argument" | "foreign";
  readonly why: string;
};

/**
 * THE TWO KINDS A FIGURE CAN BE LAWFUL AS WITHOUT SAYING WHICH TREE IT CAME
 * FROM, AND THERE ARE ONLY TWO.
 *
 * `argument` IS ADR-0188'S CARVE-OUT AND IT IS WHY THIS IS NOT A BAN. That
 * record keeps a figure an argument rests on: CNCORE-335 left
 * `provider-wiki`'s "1 failing of 169" standing on purpose, because the whole
 * sentence is that it is 1 and not 0. A check deleting every figure would take
 * that one too and destroy the claim it is part of.
 *
 * `foreign` IS A SENTENCE WEARING THE SHAPE AND NOT BEING ONE. A page's own
 * copy, and another tool's transcript, are not claims about how this tree's
 * tests ran and no anchor would make them truer.
 *
 * WHAT IS NOT A KIND: stale. A figure that merely went out of date is not
 * registered, it is repaired -- anchored to the tree it was taken on, or
 * deleted under ADR-0188. Giving staleness a row here would rebuild the
 * allowlist this file exists to replace.
 */
const THE_REGISTER: Registration[] = [
  {
    path: "docs/adr/0133-a-listing-says-where-the-reader-is.md",
    figure: "465 of 465",
    kind: "foreign",
    why: "the page's own copy, quoted: `Showing item 465 of 465` is what a reader sees on a listing of one, and it moves with the catalogue rather than with this tree's tests",
  },
  {
    path: "docs/adr/0181-a-check-is-evidence-only-for-the-commit-it-ran-against.md",
    figure: "16 of 16",
    kind: "foreign",
    why: "a transcript of what `gh` and the merge gate printed about GitHub's check-runs on one commit, which is a record of another tool's output and not a count of tests",
  },
];

/**
 * THE TWO FILES THAT CANNOT BE WRITTEN WITHOUT STATING THESE FIGURES.
 *
 * A pattern cannot be written without the spelling it matches, and a fixture
 * cannot prove a spelling is caught without containing it. Both are
 * irreducible in the way `corpus-import-cost.ts` means the word, and both were
 * measured: between them they state twenty of the figures this sweep finds,
 * which as register rows would be a register that is mostly itself.
 *
 * NAMED BY PATH AND HELD TO FINDING SOMETHING, which is what keeps this an
 * exemption rather than a hole. A third name added to buy silence reddens the
 * suite on the run that adds it, exactly as an idle register entry does.
 */
const THE_IRREDUCIBLE = [
  "packages/config/src/run-figures.test.ts",
  "packages/config/src/testing/run-figures.ts",
];

/**
 * What each excused file states, so a name that has stopped earning its place
 * can be seen to have stopped.
 */
export function figuresInTheIrreducible(): { path: string; found: number }[] {
  const found = statedFigures();
  return THE_IRREDUCIBLE.map((path) => ({
    path,
    found: found.filter((figure) => figure.path === path).length,
  }));
}

/** Whether anybody has answered for this figure by hand. */
const isRegistered = ({ path, figure }: StatedFigure): boolean =>
  THE_REGISTER.some((entry) => entry.path === path && entry.figure === figure);

/**
 * Every register entry that finds nothing in the tree.
 *
 * HELD TO EMPTY, so the register cannot rot in either direction. An entry
 * whose figure was repaired leaves a row standing that would excuse the next
 * figure to wear those words at that path, and an entry added for a figure
 * that was never there is a row bought rather than earned.
 */
export function idleRegistrations(): Registration[] {
  const found = statedFigures();
  return THE_REGISTER.filter(
    (entry) => !found.some(({ path, figure }) => path === entry.path && figure === entry.figure),
  );
}

/** Every figure nothing derives, nothing anchors, and nobody has answered for. */
export function unregisteredFigures(): StatedFigure[] {
  return unanchoredFigures().filter(
    (figure) => !isRegistered(figure) && !THE_IRREDUCIBLE.includes(figure.path),
  );
}
