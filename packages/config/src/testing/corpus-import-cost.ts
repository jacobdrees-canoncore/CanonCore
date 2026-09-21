import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./repo-root";
import { blocksOf, sentencesOf, withoutCommentLeaders } from "./sentences";
import { isTrackedAs, trackedFiles } from "./tracked-files";

/**
 * THE SUPERSEDED COST OF IMPORTING THE CORPUS, IN EVERY SPELLING IT HAS BEEN
 * WRITTEN IN (ADR-0135, ADR-0195, CNCORE-327).
 *
 * ADR-0135 estimated the corpus at about five and a half hours and CORRECTED
 * ITSELF: 43.8s is AHistory's cost, the LARGEST page on the wiki, and
 * multiplying it by 465 is a different quantity rather than a bound. The whole
 * corpus landed in roughly ELEVEN MINUTES, measured 2026-09-15 into the Owner's
 * own install.
 *
 * TWO HAND SWEEPS ALREADY RAN AND BOTH MISSED SITES. CNCORE-246 and CNCORE-289
 * each grepped ONE spelling in ONE case, and the dispatcher's own tree-wide
 * `git grep -i` on 2026-09-21 found a fourth neither had. It still missed two,
 * and the reason is in this module's shape rather than in anybody's care: one
 * of them is WRAPPED ACROSS A LINE BREAK inside a docblock, which no `git grep`
 * can match at all, and the other states the multiplication without the words.
 */

/**
 * THE WORDS, IN EVERY CASE AND EVERY HYPHENATION.
 *
 * `[\s-]+` BETWEEN EVERY WORD is what carries the four spellings the hand
 * sweeps split on: `five and a half hours`, `FIVE AND A HALF HOURS`,
 * `five-and-a-half-hour` and `five-and-a-half hours`. The caller flattens a
 * block first, so a break mid-phrase arrives here as a space and is matched by
 * the same class -- which is the spelling `import-list.test.ts:201` hid in for
 * two sweeps.
 *
 * THE UNIT IS LOAD-BEARING AND WAS MEASURED. `five and a half` alone reddens
 * two sentences this ticket has no quarrel with: ADR-0133's "five and a half
 * TIMES on Catalogue search" and `docs/research/resolution/resolve-X1-X6.md`'s
 * "open for five and a half YEARS". The superseded figure is a DURATION IN
 * HOURS, and nothing else wearing those words is it.
 *
 * THE NUMERIC FORMS ARE HERE BEFORE ANYTHING WRITES THEM, which is the one
 * place this reader looks past today's tree. A sweep is defeated by the
 * spelling nobody thought of, so the digit forms and `five point five` are
 * refused now rather than after the next miss.
 *
 * THE SEPARATOR CLASS CARRIES NON-ASCII HYPHENS, and that is not decoration:
 * this tree's prose is full of `--` and en dashes, an editor that
 * "smartens" punctuation turns `five-and-a-half` into a NON-BREAKING hyphen,
 * and `[\s-]` would then match none of it. A spelling that renders identically
 * to the eye and not to the pattern is the exact failure this check exists to
 * end.
 *
 * THE UNIT TAKES `hrs` AS WELL AS `hours`, because an abbreviation is a
 * spelling and the whole argument of this module is that the next miss is a
 * spelling nobody enumerated.
 */
const HYPHEN = "[\\s\\u002d\\u2010-\\u2015\\u2212\\u00ad]";

const THE_WORDS = new RegExp(
  `(?:five${HYPHEN}+and${HYPHEN}+a${HYPHEN}+half|five${HYPHEN}+point${HYPHEN}+five|5\\.5|5${HYPHEN}*1/2|5½)` +
    `${HYPHEN}*(?:hour|hr)`,
  "i",
);

/**
 * THE SAME QUANTITY STATED AS ARITHMETIC, WITH NO WORDS TO GREP FOR.
 *
 * `465 Containers at 43.8s each` is the five and a half hours exactly, and
 * `import-runs.ts:109` and `import-runs.test.ts:344` both carried it while
 * every worded sweep passed over them. A reader that only knows the words is a
 * reader the multiplication walks straight through.
 *
 * BOTH FACTORS IN ONE SENTENCE, because that is what asserting the product IS:
 * the count and the per-page cost, put beside each other with nothing saying
 * which is which. NEITHER FIGURE IS WRONG ALONE -- the corpus IS 465
 * Containers and AHistory DID take 43.8s -- so neither is refused alone, and
 * this pattern deliberately catches sentences that state both CORRECTLY.
 * `tables.ts:849` and ADR-0033 are two of them. They pass because they say
 * which figure is which, which is the whole of the correction; a sentence that
 * puts both down and says neither is the defect.
 *
 * TWO TESTS RATHER THAN ONE PATTERN WITH A GAP IN THE MIDDLE, and the first
 * draft was the gap. It read `465[^.]{0,160}?43\.8`, bounding the span with
 * "no full stop" to keep it inside a sentence -- which the CALLER already
 * guarantees, since what arrives here IS one sentence. So the exclusion bought
 * nothing and cost real matches: any decimal between the two factors ends the
 * span, and "465 Containers, each 25.5s to 43.8s" went unmatched. Asking for
 * both factors says what the rule means and has no distance limit to be wrong
 * about.
 */
const isTheArithmetic = (sentence: string): boolean =>
  /\b465\b/.test(sentence) && /\b43\.8/.test(sentence);

/**
 * THE CHECK'S OWN TWO FILES, WHICH CANNOT BE ITS OWN SUBJECT.
 *
 * The patterns above ARE the spellings they refuse -- there is no way to write
 * a reader for a phrase without writing the phrase -- and the suite beside it
 * holds a fixture row per spelling, which is the same sentence again. Sweeping
 * either hands the check its own working parts back as findings.
 *
 * BOTH WERE MEASURED RATHER THAN FORESEEN, on 2026-09-21, and separately. The
 * first commit turned three untracked files tracked at once and the run went
 * red naming this module's regexes, having been green before only because
 * `git ls-files` could not yet see them. The suite followed the same way: it
 * stated no spelling until a code review asked for the hand-planted evidence to
 * become rows, and the rows put the spellings in the tree.
 *
 * THE RECORD IS NOT EXEMPT, which is the line worth drawing. ADR-0195 explains
 * this rule and states the figure repeatedly, and every one of those sentences
 * carries its correction, because a record that could not live under its own
 * rule would be a rule nobody should keep. Only the two files that ARE the
 * check are excused.
 *
 * GUARDED BY `isTrackedAs` FOR THE REASON IT EXISTS: "an exclusion that stops
 * excluding reports nothing by its nature". A literal path goes stale in
 * silence on a rename -- handing these files' own spellings to the rule as
 * findings, which is the loud direction -- and `adr-as-built.test.ts` and
 * `adr-identifiers.test.ts` each carry the same guard for the same
 * self-exclusion.
 */
const THE_CHECKS_OWN_FILES = [
  "packages/config/src/testing/corpus-import-cost.ts",
  "packages/config/src/corpus-import-cost.test.ts",
];

/** A sentence stating the superseded cost, and where it stands. */
export interface Statement {
  readonly path: string;
  readonly sentence: string;
}

/**
 * Whether one sentence states the superseded cost, in any spelling.
 *
 * EXPORTED SO THE SPELLINGS ARE FIXTURE ROWS RATHER THAN A CLAIM IN PROSE. The
 * first version of this module was argued entirely from a hand plant into
 * `import-runs.ts` -- a measurement taken once, by a person, into a file that
 * was then restored. Everything it proved is proved again on every run now, and
 * the near misses this pattern must NOT match ("five and a half TIMES", "five
 * and a half YEARS") are rows rather than a sentence promising somebody checked.
 */
export const statesTheSupersededCost = (sentence: string): boolean =>
  THE_WORDS.test(sentence) || isTheArithmetic(sentence);

/**
 * Every tracked file this tree holds as TEXT.
 *
 * DERIVED RATHER THAN LISTED, and that is the difference between this and a
 * third sweep. An extension allowlist is a list of the places a figure has been
 * found before, which is exactly the instrument that missed twice; a NUL byte
 * is what makes a file unreadable as prose, and asking that question covers the
 * extension nobody has added yet. `.sql` is the specimen -- the frozen rung
 * carries this figure and is not a shape a source sweep would have thought to
 * open.
 */
function trackedText(): { path: string; text: string }[] {
  return trackedFiles().flatMap((path) => {
    const text = readFileSync(join(repoRoot, path), "utf8");
    return text.includes("\0") ? [] : [{ path, text }];
  });
}

/**
 * THE POPULATION THIS READER ACTUALLY OPENED, so a caller can floor it.
 *
 * A DERIVED POPULATION THAT SILENTLY GOES EMPTY IS A GREEN CHECK ASKING
 * NOTHING, which is the lesson CNCORE-298 and CNCORE-314 each paid for
 * separately. `trackedFiles` states in its own docblock that it does NOT guard
 * against an empty answer and leaves that to its callers; this is this
 * caller's half of that bargain.
 */
export function filesSwept(): number {
  return trackedText().length;
}

/**
 * Every sentence in the tracked tree that states the superseded cost.
 *
 * THE SENTENCE IS THE UNIT, never the paragraph and never the document, which
 * is `CLAUDE.md`'s rule in its own words: "Put the correction in the sentence it
 * corrects -- placed beside one, it leaves the old claim standing."
 *
 * A WINDOW OF THE NEIGHBOURING SENTENCES WAS TRIED FIRST AND WAS LOOSER THAN
 * THE RULE IT ENFORCES. `largest` stands in 69 tracked files, so a window let
 * any neighbour carrying that word for an unrelated reason excuse a live claim
 * beside it -- "The largest Ordering holds 500 Placements." would have exempted
 * a stale sentence sitting next to it. Tightening cost nothing: measured across
 * the whole tree on 2026-09-21, every statement that passes the window rule
 * passes the sentence rule too, so the looser bound was buying only the
 * loophole.
 */
function statementsIn({ path, text }: { path: string; text: string }): Statement[] {
  return blocksOf(withoutCommentLeaders(path, text))
    .map(sentencesOf)
    .flatMap((sentences) =>
      sentences.flatMap((sentence) =>
        statesTheSupersededCost(sentence) ? [{ path, sentence }] : [],
      ),
    );
}

export function statementsOfTheSupersededCost(): Statement[] {
  const moved = THE_CHECKS_OWN_FILES.filter((path) => !isTrackedAs(path));
  if (moved.length > 0) {
    throw new Error(
      `${moved.join(", ")} is not tracked under that path, so this check's own spellings would ` +
        "be swept as findings. Move the exclusion with the file.",
    );
  }
  return trackedText()
    .filter(({ path }) => !THE_CHECKS_OWN_FILES.includes(path))
    .flatMap(statementsIn);
}

/**
 * What each excluded file WOULD hand this check if it were swept.
 *
 * THE EXEMPTION IS EXECUTED RATHER THAN LISTED, which is the difference between
 * an exclusion and a silencer. A name on a list buys silence for whatever is
 * behind it forever; this answers what that silence is COSTING, so an exclusion
 * that has stopped being necessary reports nothing and the suite refuses it.
 *
 * IT WAS EARNED BY THE FAILURE IT WOULD HAVE CAUGHT. `testing/sentences.test.ts`
 * reached for the wrapped spelling to demonstrate the cut, turned this check red
 * on its own author's branch, and the reflex fix was a third name on the list
 * above. That fix would have been silent forever: the cutter is general, any
 * sentence wraps, and the figure was doing no work in those rows. The row below
 * is what makes taking that shortcut go red instead.
 */
export function statementsExcludedFromTheSweep(): { path: string; found: number }[] {
  return THE_CHECKS_OWN_FILES.map((path) => ({
    path,
    found: statementsIn({ path, text: readFileSync(join(repoRoot, path), "utf8") }).length,
  }));
}

/**
 * WHAT A SENTENCE HAS TO SAY TO BE STATING A CORRECTED FIGURE RATHER THAN A
 * LIVE ONE.
 *
 * EVERY PHRASE HERE IS ADR-0135'S OR ADR-0137'S OWN, taken from the records
 * that own the correction rather than invented for this reader:
 *
 * - **ELEVEN MINUTES** is the measurement that replaced the estimate, made
 *   2026-09-15 into the Owner's own install. A sentence that gives the real
 *   total has corrected itself by saying so.
 * - **THE LARGEST** is the half that answers the arithmetic. 43.8s is
 *   AHistory's cost, and a sentence naming both factors while saying which one
 *   is the worst case has said the thing the multiplication leaves out.
 * - **NOT A BOUND / A DIFFERENT QUANTITY** is ADR-0135's own refusal of the
 *   product, in its words.
 *
 * `mistake` IS DELIBERATELY NOT HERE, and it is the one exclusion worth writing
 * down. `import-list.test.ts:280` opens "WHERE A FIVE-AND-A-HALF-HOUR MISTAKE
 * WOULD HIDE", which acknowledges the figure is wrong and still spends the
 * reader's attention on it -- the sentence names a quantity nothing pays in
 * order to explain something that has nothing to do with it. CNCORE-327 asks
 * these sites to lean on THEIR OWN REASON rather than on the number, and a
 * vocabulary that accepted `mistake` would have marked that site correct and
 * left it exactly as the two hand sweeps did.
 */
const THE_CORRECTION =
  /eleven minutes|11 minutes|largest|not a bound|different quantity|wrong by an order/i;

/**
 * Every statement of the superseded cost that does NOT carry its correction.
 *
 * THE RULE IS THE CORRECTION BESIDE THE FIGURE, NOT THE FIGURE'S ABSENCE, and
 * that is forced rather than chosen. `adr-as-built.test.ts` settled the same
 * question for the same reason -- "a record correcting itself has to be able to
 * say what it used to claim" -- and ADR-0135 and ADR-0137 are exactly that: the
 * two records that OWN this correction have to be able to state what they are
 * correcting. A rule refusing the figure outright would force the correction
 * out of the only two documents that carry it.
 *
 * SO THE EXEMPTION IS A SENTENCE RATHER THAN A FILENAME, which is what keeps
 * this from going stale. A named list of excused files is a list that survives
 * a rename by matching nothing and survives a rewrite by excusing whatever
 * replaced it; a document that quotes the estimate in order to correct it is
 * covered here without being named, and the day it stops correcting it, it is
 * not.
 */
export function statementsReadingAsALiveCost(): Statement[] {
  return statementsOfTheSupersededCost().filter(
    ({ path, sentence }) => !isFrozenProse(path) && !carriesItsCorrection(sentence),
  );
}

/** Whether a sentence stating the superseded cost also says what is true. */
export const carriesItsCorrection = (sentence: string): boolean => THE_CORRECTION.test(sentence);

/**
 * The rung whose prose states the superseded cost and can never be edited.
 *
 * SPELLED OUT RATHER THAN DERIVED, and that is load-bearing. Nothing offline
 * can ask which rungs an install has APPLIED -- ADR-0047's freeze check reads
 * Drizzle's ledger in a live database -- so a derivation would be guessing at
 * the very fact that makes this one unamendable. Naming it costs one string
 * and buys a red run on the day it moves, which `isTrackedAs` is what turns
 * from a silent miss into a failure.
 */
export const THE_FROZEN_RUNG =
  "packages/db/src/migrations/20260914120000_migration_18_a_run_over_a_list_of_containers.sql";

/** Prose on the migration ladder, which ADR-0047 makes write-once. */
const isFrozenProse = (path: string): boolean => path.startsWith("packages/db/src/migrations/");

/**
 * Every statement of the superseded cost standing in prose that cannot be
 * corrected in place.
 *
 * REPORTED RATHER THAN REFUSED, and reported by NAME so the set can be held to
 * exactly what ADR-0047 froze. This is the difference between an exemption and
 * a hole: the rule below skips this population, and the suite holds this
 * population to one known rung, so nothing joins it in silence.
 */
export function statementsInFrozenProse(): Statement[] {
  return statementsOfTheSupersededCost().filter(({ path }) => isFrozenProse(path));
}
