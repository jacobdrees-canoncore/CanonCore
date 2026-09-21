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
 * spelling nobody thought of, so `5.5 hours`, `5 1/2 hours` and `5½ hours` are
 * refused now rather than after the next miss.
 */
const THE_WORDS = /(?:five[\s-]+and[\s-]+a[\s-]+half|5\.5|5[\s-]*1\/2|5½)[\s-]*hour/i;

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
 */
const THE_ARITHMETIC = /465[^.]{0,160}?43\.8|43\.8[^.]{0,160}?465/;

/**
 * THIS MODULE, WHICH CANNOT BE ITS OWN SUBJECT.
 *
 * The patterns above ARE the spellings they refuse -- there is no way to write
 * a reader for a phrase without writing the phrase -- so sweeping this file
 * hands its own regexes back to it as findings. That was not foreseen: it was
 * MEASURED on 2026-09-21, when the first commit of this work turned three
 * untracked files into tracked ones and the check went red naming its own
 * source, having been green through every run before it while `git ls-files`
 * could not see them.
 *
 * THE RECORD IS NOT EXEMPT AND THE SUITE IS NOT EITHER, which is the line worth
 * drawing. ADR-0195 explains this rule and states the figure repeatedly, and
 * every one of those sentences carries the correction, because a record that
 * could not live under its own rule would be a rule nobody should keep. Only
 * the file that IS the pattern is excused.
 *
 * GUARDED BY `isTrackedAs` FOR THE REASON IT EXISTS: "an exclusion that stops
 * excluding reports nothing by its nature". A literal path goes stale in
 * silence on a rename -- handing this file's own regexes to the rule as
 * findings, which is the loud direction -- and `adr-as-built.test.ts` and
 * `adr-identifiers.test.ts` each carry the same guard for the same
 * self-exclusion.
 */
const THIS_READER = "packages/config/src/testing/corpus-import-cost.ts";

/** A sentence stating the superseded cost, and the block-bounded window it sits in. */
export interface Statement {
  readonly path: string;
  readonly sentence: string;
  readonly beside: string;
}

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
    let text: string;
    try {
      text = readFileSync(join(repoRoot, path), "utf8");
    } catch {
      return [];
    }
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
 * THE WINDOW IS THE SENTENCE AND THE ONES EITHER SIDE OF IT, WITHIN ONE BLOCK,
 * never the document -- `terminal-send-hazards.test.ts`'s bound and its reason.
 * A correction three sections away from an estimate is the shape `CLAUDE.md`
 * refuses in as many words: "placed beside one, it leaves the old claim
 * standing."
 */
export function statementsOfTheSupersededCost(): Statement[] {
  if (!isTrackedAs(THIS_READER)) {
    throw new Error(
      `${THIS_READER} is not tracked under that path, so this check's own patterns would be ` +
        "swept as findings. Move the exclusion with the file.",
    );
  }
  return trackedText()
    .filter(({ path }) => path !== THIS_READER)
    .flatMap(({ path, text }) =>
      blocksOf(withoutCommentLeaders(path, text))
        .map(sentencesOf)
        .flatMap((sentences) =>
          sentences.flatMap((sentence, index) =>
            THE_WORDS.test(sentence) || THE_ARITHMETIC.test(sentence)
              ? [
                  {
                    path,
                    sentence,
                    beside: [sentences[index - 1] ?? "", sentence, sentences[index + 1] ?? ""].join(
                      " ",
                    ),
                  },
                ]
              : [],
          ),
        ),
    );
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
    ({ path, beside }) => !isFrozenProse(path) && !THE_CORRECTION.test(beside),
  );
}

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
