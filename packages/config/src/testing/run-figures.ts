import { readFileSync } from "node:fs";
import { join } from "node:path";

import { flatten } from "./flatten";
import { repoRoot } from "./repo-root";
import { withoutCommentLeaders } from "./sentences";
import { trackedFiles } from "./tracked-files";

/**
 * THE EQUAL PAIR: a count stated against itself, which is how this tree writes
 * "every one of them". `18 of 18 stayed green`.
 *
 * THE BOUNDARIES ARE THE WHOLE DIFFICULTY, AND THE FIRST VERSION GOT THE BACK
 * ONE WRONG IN THE EXPENSIVE DIRECTION. `1 of 1,566` is a RATIO and not a pair,
 * and a plain `\b` reads its `1 of 1` as one, because the comma is a word
 * boundary. Widening the guard to `(?![\d,.])` fixed that and QUIETLY REFUSED
 * ORDINARY SENTENCE PUNCTUATION with it: `629 of 629.` and `300 of 300,` ended
 * a clause, so the guard saw a `.` or a `,` and threw the match away. Four live
 * figures in this tree escaped the sweep that way and were found by review, not
 * by the check -- a sweep silently matching less than it claims, which is the
 * class this whole file exists to end.
 *
 * SO THE BACK GUARD REFUSES A DIGIT, OR A SEPARATOR THAT IS ITSELF FOLLOWED BY
 * ONE. That is the shape of a longer number continuing, and nothing else.
 */
const EQUAL_PAIR = /(?<![\d,.])(\d[\d,]*) of \1(?![\d]|[,.]\d)/g;

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
 * one. A bare hex run is how a TOOL prints a commit, so `PASSED b409673 16 of
 * 16` inside ADR-0181's merge-gate transcript is a quotation of what something
 * else said rather than a measurement taken here, and reading it as an anchor
 * would let a pasted log vouch for the prose around it.
 *
 * THAT RECORD IS ANCHORED ANYWAY, BY THE SECTION ITS TRANSCRIPT SITS IN, which
 * carries the date the dispatcher ran the gate. The distinction is worth
 * keeping: what anchors those two figures is the prose, not the log.
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
 *
 * EACH LINE GOES THROUGH `flatten` RATHER THAN THROUGH A `trim` WRITTEN HERE,
 * which is that module's own rule -- a caller needing more WRAPS it. The first
 * version trimmed and joined, which left a line's INTERNAL runs of whitespace
 * alone, so `18  of  18` written with two spaces was a figure this sweep could
 * not see. Collapsing per line rather than over the whole file is what keeps
 * the map: a run of whitespace spanning a newline would otherwise become one
 * character and take the line boundary with it.
 */
function flattenedWithLines(path: string, text: string): { flat: string; lineAt: number[] } {
  const pieces: string[] = [];
  const lineAt: number[] = [];
  let first = true;
  for (const [index, raw] of withoutCommentLeaders(path, text).split("\n").entries()) {
    const piece = (first ? "" : " ") + flatten(raw);
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
 * THE LINES THAT REALLY OPEN A SECTION, WHICH IS NOT EVERY LINE STARTING `#`.
 *
 * A FENCED BLOCK IS FULL OF THEM, AND THIS WAS MEASURED ON A LIVE SITE RATHER
 * THAN GUARDED AGAINST IN THE ABSTRACT. Forty-two lines in this tree's tracked
 * markdown open with `#` inside a fence. ADR-0181 holds a `gh` transcript whose
 * first line is `#230    isDraft            true`, and reading that as a
 * heading cut a sixteen-line pretend section out of the middle of the block --
 * one carrying no date, when the REAL section around it opens "A draft answers
 * every question but the one being asked" and carries `2026-09-21` two lines
 * down. So the sweep called an anchored figure bare, and the register grew a
 * row to excuse it. That row was bought rather than earned, which is the one
 * thing the register's own docblock forbids, and a check whose blind spot
 * manufactures its own exemptions is worse than no check.
 *
 * A FENCE IS THREE BACKTICKS OR THREE TILDES AT THE LINE START, and it toggles.
 * An unclosed fence runs to the end of the file, which is what a markdown
 * reader does with one too.
 */
function sectionOpenersIn(lines: string[]): Set<number> {
  const openers = new Set<number>();
  let inFence = false;
  for (const [index, line] of lines.entries()) {
    if (/^(?:```|~~~)/.test(line)) inFence = !inFence;
    else if (!inFence && line.startsWith("#")) openers.add(index);
  }
  return openers;
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
  if (path.endsWith(".md")) {
    const headings = sectionOpenersIn(lines);
    let start = at;
    while (start > 0 && !headings.has(start)) start -= 1;
    let end = at + 1;
    while (end < lines.length && !headings.has(end)) end += 1;
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
 * copy, a research shard's progress log, and a record's specimen of a spelling
 * are not claims about how this tree's tests ran, and no anchor would make
 * them truer.
 *
 * THE PROVIDER COPIES CARRY A THIRD, `record`, AND THIS ONE DOES NOT -- which
 * is a fact about the repositories rather than drift between the copies. Each
 * provider's `CLAUDE.md` is a PASS LOG, and CNCORE-142's rule keeps a past
 * pass's sentences standing and corrects them beside rather than rewriting
 * them, so a figure in one needs a kind saying exactly that and naming where
 * its correction stands. This repository keeps no pass log, so that kind would
 * have no population here and is left out rather than declared unused.
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
  /*
   * THE RECORD THAT DEFINES THE SPELLINGS, CAUGHT BY THE CHECK IT ARGUES FOR,
   * on the rebase that added it (CNCORE-339). A record naming which spellings
   * a sweep covers cannot name them without writing them down, and describing
   * them in words would leave a reader unable to tell the covered shape from
   * the near miss beside it -- which is the whole subject of that section.
   *
   * REGISTERED RATHER THAN ADDED TO `THE_IRREDUCIBLE`, deliberately. That list
   * excuses a whole FILE, which is right for the reader and its suite because
   * every figure in them is a specimen. ADR-0201 is prose that could state a
   * figure of its own tomorrow, and excusing the document would excuse that
   * one too. These two rows excuse exactly the two quotations and nothing else.
   */
  {
    path: "docs/adr/0201-a-figure-about-a-run-is-found-by-sweeping-rather-than-by-a-roll-call.md",
    figure: "18 of 18",
    kind: "foreign",
    why: "the record's own specimen of the first spelling this sweep covers, quoting the figure CNCORE-338 deleted from `provider-wiki`; it is an example of a shape rather than a claim about how anything ran",
  },
  {
    path: "docs/adr/0201-a-figure-about-a-run-is-found-by-sweeping-rather-than-by-a-roll-call.md",
    figure: "8 failed | 21 passed (29)",
    kind: "foreign",
    why: "the record's own specimen of the second spelling, which is the one every hand pass missed; quoting it is how the section says which shapes are covered",
  },
  /*
   * ADR-0181 HAD A ROW HERE AND IT IS GONE, which is the register's own rule
   * catching the register. That record's `gh` transcript opens `#230 isDraft
   * true`, the section walk read the `#` as a heading, and the pretend section
   * it cut out carried no date -- so two anchored figures were reported bare
   * and a row appeared to excuse them. Making the walk fence-aware anchored
   * them properly, and holding an entry to excusing something UNANCHORED, not
   * merely to finding something, is what then reported the row as idle.
   */
  {
    path: "docs/research/competitor-sweep/sweep-plex-support-B.md",
    figure: "110 of 110",
    kind: "foreign",
    why: "a research shard's own progress log -- `Done: 110 of 110. Shard complete.` counts the support threads that sweep had read, not anything this tree runs. It was invisible until the back guard stopped refusing a figure that ends a sentence",
  },
];

/**
 * THE TWO FILES THAT CANNOT BE WRITTEN WITHOUT STATING THESE FIGURES.
 *
 * A pattern cannot be written without the spelling it matches, and a fixture
 * cannot prove a spelling is caught without containing it. Both are
 * irreducible in the way `corpus-import-cost.ts` means the word. Between them
 * they state MORE FIGURES THAN THE REST OF THIS TREE DOES, which as register
 * rows would be a register that is mostly itself -- 30 against 37, measured
 * 2026-09-21. THE FIRST DRAFT OF THIS SENTENCE SAID "twenty" AND WAS WRONG THE
 * DAY IT WAS WRITTEN, in the file whose whole subject is a stated count going
 * stale, and it was invisible to this sweep because a count spelled as a WORD
 * is not a spelling this reads. Review found it. That is the honest limit of
 * the mechanism, stated where somebody meets it.
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

/**
 * Whether anybody has answered for this figure by hand.
 *
 * MATCHED ON PATH AND WORDS, NOT ON LINE, and the cost is worth stating: one
 * row excuses EVERY occurrence of those words in that file. That is what a
 * register wants for a record quoting the same transcript twice, and it means
 * a THIRD occurrence appearing later is excused without anybody deciding it
 * should be. A line number would close that and open a worse one -- every row
 * going stale on the edit above it, which is the drift this file is about.
 */
const isRegistered = ({ path, figure }: StatedFigure): boolean =>
  THE_REGISTER.some((entry) => entry.path === path && entry.figure === figure);

/**
 * Every register entry that is not excusing anything.
 *
 * HELD TO EMPTY, so the register cannot rot in any of the three directions. An
 * entry whose figure was repaired leaves a row standing that would excuse the
 * next figure to wear those words at that path; an entry added for a figure
 * that was never there is a row bought rather than earned; and an entry for a
 * figure that is ANCHORED needs no excusing at all.
 *
 * THE THIRD ONE IS MEASURED AND IS WHY THIS READS `unanchoredFigures` RATHER
 * THAN `statedFigures`. The first version asked only whether the figure
 * EXISTED, and a fence bug in the markdown section walk had called ADR-0181's
 * two bare when its section carries a date -- so the register grew a row for
 * them, the row found its figure, and nothing reported that the row was
 * excusing a figure already lawful. A register that quietly absorbs the
 * reader's blind spots is how an allowlist grows back.
 */
export function idleRegistrations(): Registration[] {
  const owed = unanchoredFigures();
  return THE_REGISTER.filter(
    (entry) => !owed.some(({ path, figure }) => path === entry.path && figure === entry.figure),
  );
}

/** Every figure nothing derives, nothing anchors, and nobody has answered for. */
export function unregisteredFigures(): StatedFigure[] {
  return unanchoredFigures().filter(
    (figure) => !isRegistered(figure) && !THE_IRREDUCIBLE.includes(figure.path),
  );
}
