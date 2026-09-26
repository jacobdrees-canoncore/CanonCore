import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { records } from "./testing/adr-records";
import { flatten } from "./testing/flatten";
import { proseIn } from "./testing/markdown-corpus";
import { repoRoot } from "./testing/repo-root";
import { blocksOf, sentencesOf } from "./testing/sentences";

/**
 * A HAZARD SENTENCE CARRIES WHAT IT COSTS, IN THE SENTENCE ITSELF (CNCORE-306).
 *
 * `CLAUDE.md`, the `dispatch` skill's `SKILL.md` and ADR-0162 each tell a
 * dispatcher that a mid-turn `orca terminal send --enter` queues and that
 * `ctrl+x ctrl+s` flushes it. All three were true and all three were
 * INCOMPLETE: none said the flush also INTERRUPTS the turn in progress, which
 * is the difference between "the queued text arrives" -- the harmless reading
 * every one of those sentences invites -- and "the agent drops what it was
 * doing and answers you instead".
 *
 * MEASURED RATHER THAN HYPOTHETICAL. On 2026-09-21 a dispatcher flushed a brief
 * into CNCORE-288's agent mid-search and the transcript answered
 * `|_ Interrupted - What should Claude do instead?`. The agent abandoned the
 * search. Nothing in the three sentences warned that it would.
 *
 * THE SENTENCE IS THE UNIT, and that is `CLAUDE.md`'s own rule rather than a
 * choice made here: "Put the correction in the sentence it corrects -- placed
 * beside one, it leaves the old claim standing." A document-level check would
 * pass a file that warns about the cost three sections away from the recipe,
 * which is the shape the rule exists to refuse.
 *
 * IT ASKS THE TREE rather than the three files that carry the claim today,
 * which is `adr-numbering.test.ts`'s reason in its own words -- "a record added
 * without touching this file is still covered". A named list counts the files
 * that ANSWER the rule and never the fourth one added tomorrow that OWES it.
 *
 * SO THE POPULATION GUARD IS LOAD-BEARING RATHER THAN BOILERPLATE. A derived
 * population that silently goes empty is a green check asking nothing, so the
 * count is asserted before the rule is, and the rule was proved by breaking a
 * passage and watching this go red naming that file rather than by watching it
 * pass.
 */

/*
 * `blocksOf` AND `sentencesOf` MOVED TO `testing/sentences.ts` UNDER CNCORE-327,
 * with the measurements that argue for them. This suite wrote that cutter and
 * the corpus-cost check needs the identical cut over a wider population --
 * `flatten.ts`'s reason for being a module rather than a line each caller
 * repeats, and `tracked-files.ts`'s specimen of what a second copy costs.
 */

/** Every document in the prose corpus, cut into blocks of sentences. */
function corpus(): { path: string; blocks: string[][] }[] {
  return proseIn(repoRoot).map((path) => ({
    path,
    blocks: blocksOf(readFileSync(join(repoRoot, path), "utf8")).map(sentencesOf),
  }));
}

/**
 * A sentence that HANDS A READER THE RECIPE and says it flushes: both halves,
 * in one sentence.
 *
 * THE CONJUNCTION IS THE WHOLE DESIGN, and it was measured rather than
 * foreseen. `flushes it` alone swept in this very correction's own note --
 * ADR-0162 now says the first draft "stopped at `flushes it`" -- and demanded
 * the cost clause of a sentence whose entire job is to quote the claim that
 * lacked it. `adr-as-built.test.ts` hit the same wall from the other side and
 * ruled the same way: "a record correcting itself has to be able to say what it
 * used to claim", so the READER is what gets fixed and not the record.
 *
 * A QUOTATION IS NOT A RECIPE. What this ticket is about is the sentence that
 * tells a dispatcher which keys to press; prose ABOUT that sentence tells
 * nobody to press anything, and holding it to the same rule would be this check
 * legislating a house style rather than reading the one that exists.
 *
 * BOTH SPELLINGS, because the recipe reaches a reader as `ctrl+x ctrl+s` in two
 * carriers and as `printf '\030\023'` in the third, and either alone finds
 * two of the three.
 */
const THE_RECIPE = /ctrl\+x ctrl\+s|\\030\\023/i;

const SAYS_IT_FLUSHES = /flushes it/i;

const isFlushClaim = (sentence: string): boolean =>
  THE_RECIPE.test(sentence) && SAYS_IT_FLUSHES.test(sentence);

/** The cost that claim was missing: the turn in progress ends. */
const THE_COST = /interrupt/i;

function flushClaims(): { path: string; sentence: string }[] {
  return corpus().flatMap(({ path, blocks }) =>
    blocks.flatMap((sentences) =>
      sentences.filter(isFlushClaim).map((sentence) => ({ path, sentence })),
    ),
  );
}

describe("the sentence that says the flush works", () => {
  /**
   * BEFORE THE RULE, because a sweep that found nothing would satisfy "every
   * flush claim states its cost" by having no subject -- the failure
   * `adr-numbering.test.ts` raises at the root of its own chain for the same
   * reason.
   */
  it("is found in the tree at all", () => {
    expect(flushClaims().length).toBeGreaterThan(0);
  });

  it("says in that same sentence that it interrupts the turn", () => {
    const silent = flushClaims()
      .filter(({ sentence }) => !THE_COST.test(sentence))
      .map(({ path, sentence }) => `${path}: ${sentence}`);
    expect(silent).toStrictEqual([]);
  });
});

/** The hazard, in the spelling all three carriers share. */
const THE_HAZARD = /SELECTS the option under the cursor/i;

/**
 * The record holding the way through, in the three spellings this tree cites a
 * record by (`adr-citations.test.ts` enumerates them).
 *
 * THE NUMBER IS WRITTEN OUT rather than derived, and it is load-bearing that it
 * is: ADR numbers are assigned by the dispatcher and have collided before, so a
 * renumbering that orphans these pointers should redden something. This is that
 * something, and `adr-citations.test.ts` catches the other half by refusing a
 * cited number the tree holds no record for.
 *
 * WRITTEN OUT ONCE, THOUGH. The first draft spelled it in the citation regex
 * and again in the resolver's throw, and a mutation run proved they could
 * disagree: pointing the resolver at a number the tree lacks produced the
 * message "0 records are numbered 0187", naming the number it had NOT looked
 * for. A failure that misreports its own subject is worse than no failure.
 */
const ANSWERING_RECORD = "0187";

const THE_WAY_THROUGH = new RegExp(
  `ADR-${ANSWERING_RECORD}\\b|docs/adr/${ANSWERING_RECORD}-|\\[\\[${ANSWERING_RECORD}-`,
);

/** The rule itself: a send, and nothing sent. Bounded by a full stop so the two halves share a sentence. */
const SEND_IT_NOTHING = /\bsen[dt]s?\b[^.]*\bnothing\b/i;

/**
 * The record that IS the answer, which is why it is not asked the question, as
 * the tree spells its path today.
 */
function theRecordThatAnswersIt(): string {
  const [record, ...rest] = records().filter(({ number }) => number === ANSWERING_RECORD);
  if (record === undefined || rest.length > 0) {
    throw new Error(
      `${rest.length + (record === undefined ? 0 : 1)} records are numbered ` +
        `${ANSWERING_RECORD}, not 1, so this suite cannot say which document holds the way through`,
    );
  }
  return record.path;
}

/**
 * THE HAZARD THAT NAMES NO WAY THROUGH IT (CNCORE-306).
 *
 * The same three documents tell a dispatcher that input to a PARKED agent goes
 * to the prompt widget, where `--enter` SELECTS the option under the cursor.
 * True, and stated as a hazard with nothing on the other side of it: a reader
 * who has only that has been told what not to do and not what to do, so the
 * options are to guess the keystrokes or to leave the agent parked. That is
 * what left the widget recipe undocumented for as long as it was, and on
 * 2026-09-21 it cost three measured messages, four by the dispatcher's own
 * count -- sent into a multi-select whose confirm
 * screen was still open, eaten in silence while `orca terminal send` answered
 * `Sent N bytes`.
 *
 * THE WINDOW IS THE SENTENCE AND THE ONES EITHER SIDE OF IT, WITHIN ONE BLOCK,
 * never the document. A pointer three sections away from the warning is the
 * shape `CLAUDE.md` refuses -- "placed beside one, it leaves the old claim
 * standing" -- and a document-level check would pass `CLAUDE.md`, which cites a
 * dozen records elsewhere in the file and would satisfy the rule without the
 * hazard gaining anything. `blocksOf` is what makes that bound real rather than
 * a property of where the full stops happen to fall.
 *
 * THE RECORD EXCLUDES ITSELF. ADR-0187 IS the way through, so it states the
 * hazard in order to answer it; asking it to cite itself beside its own answer
 * would be asking for a pointer to the paragraph underneath.
 *
 * IT EXCLUDES THAT RECORD BY ITS EXACT PATH, RESOLVED THROUGH THE TREE, and the
 * first draft did not -- it asked whether a path CONTAINED `0187-`, which
 * exempts `docs/research/sweep-0187-x.md` and anything under a `0187-` directory
 * as silently as it exempts the record. `slugOf` in `adr-numbering.test.ts`
 * resolves the same way and for the same reason: a record RENAMED should move
 * this exclusion with it rather than leave it looking for a spelling nothing
 * uses.
 */
function hazardsOwedAnAnswer(): { path: string; beside: string }[] {
  const answersIt = theRecordThatAnswersIt();
  return corpus()
    .filter(({ path }) => path !== answersIt)
    .flatMap(({ path, blocks }) =>
      blocks.flatMap((sentences) =>
        sentences.flatMap((sentence, index) =>
          THE_HAZARD.test(sentence)
            ? [
                {
                  path,
                  // BESIDE MEANS EITHER SIDE, which is what this test is named
                  // for. Looking only forward would redden a pointer written
                  // into the sentence BEFORE the warning, which is as adjacent
                  // as one written after it. Bounded by the block, so "beside"
                  // cannot quietly become "somewhere in this document".
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

describe("the sentence that warns about the prompt widget", () => {
  /** BEFORE THE RULE, for the reason the guard above it carries. */
  it("is found in the tree at all", () => {
    expect(hazardsOwedAnAnswer().length).toBeGreaterThan(0);
  });

  it("names the record holding the way through, beside the warning", () => {
    const unanswered = hazardsOwedAnAnswer()
      .filter(({ beside }) => !THE_WAY_THROUGH.test(beside))
      .map(({ path, beside }) => `${path}: ${beside}`);
    expect(unanswered).toStrictEqual([]);
  });

  /**
   * AND THE WAY THROUGH IS TO SEND IT NOTHING (CNCORE-422).
   *
   * Until 2026-09-26 the pointer beside this warning led to keystrokes: how
   * many Enters get an answer through a widget at each screen. The Owner ruled
   * that day that a parked agent's question stays in its own worktree and is
   * answered there by the Owner, and that the dispatcher sends its widget
   * nothing, not even navigation (CNCORE-420). A pointer can still name the
   * right record while the sentence around it reads as a recipe, which is what
   * `CLAUDE.md`'s "has the keystrokes PER SCREEN" did, so the rule lives beside
   * the warning and not only in the record it names.
   */
  it("says beside the warning that the widget is sent nothing", () => {
    const recipes = hazardsOwedAnAnswer()
      .filter(({ beside }) => !SEND_IT_NOTHING.test(beside))
      .map(({ path, beside }) => `${path}: ${beside}`);
    expect(
      recipes,
      "a sentence warning that input to a parked agent goes to its widget does not say, beside " +
        "it, that the widget is sent nothing. Since the Owner's ruling of 2026-09-26 (CNCORE-420) " +
        "that is the whole of the way through: the Owner answers in that agent's own worktree.",
    ).toStrictEqual([]);
  });
});

/**
 * THE KEYSTROKES ARE RETIRED, NOT KEPT AS A RECIPE NOBODY FOLLOWS (CNCORE-422).
 *
 * ADR-0187 held a table of keystroke counts for answering a parked agent's
 * widget from outside it, measured screen by screen on 2026-09-21, and an
 * attribution message the dispatcher sent once the widget closed. Four rules
 * here guarded that table's shape (CNCORE-337). The Owner ruled on 2026-09-26
 * that the widget is sent nothing and the question is answered in its own
 * worktree (CNCORE-420), so there is no delivery for a table to describe.
 *
 * DELETED RATHER THAN KEPT AS HISTORY. A table of counts in a live record
 * reads as a recipe whatever the paragraph above it says, and the readings
 * survive in git where a reader who needs them can find them. So what this
 * guards is that the table stays gone, and that the record says why in the
 * sentence that replaced it.
 *
 * THE FLUSH HALF IS NOT TOUCHED, and the first describe in this file is what
 * holds it.
 */
function recordText(): string {
  return flatten(readFileSync(join(repoRoot, theRecordThatAnswersIt()), "utf8"));
}

describe("ADR-0187's delivery half", () => {
  it("holds no keystroke table", () => {
    const raw = readFileSync(join(repoRoot, theRecordThatAnswersIt()), "utf8");
    expect(
      raw,
      "ADR-0187 holds a keystroke table again. The Owner's ruling of 2026-09-26 (CNCORE-420) " +
        "retired answering a parked agent's widget from outside it, so a table of counts reads " +
        "as a recipe for something nobody may do.",
    ).not.toMatch(/^\s*\|.*keystrokes to submit/im);
  });

  it("says the 2026-09-26 ruling retired it", () => {
    expect(recordText()).toMatch(/retired by the Owner's ruling of 2026-09-26 \(CNCORE-420\)/);
  });

  it("no longer says a parked agent's question is relayed", () => {
    expect(
      recordText(),
      "ADR-0187 still says a parked agent's question or its answer is relayed by the dispatcher. " +
        "Since 2026-09-26 the question stays in its own worktree and the Owner answers it there.",
    ).not.toMatch(/relay of a parked agent's question|relayed by the dispatcher/i);
  });
});
