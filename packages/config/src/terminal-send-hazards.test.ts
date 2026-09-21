import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { flatten } from "./testing/flatten";
import { markdownIn } from "./testing/markdown-corpus";
import { repoRoot } from "./testing/repo-root";

/**
 * A HAZARD SENTENCE CARRIES WHAT IT COSTS, IN THE SENTENCE ITSELF (CNCORE-306).
 *
 * `CLAUDE.md`, `.claude/skills/dispatch/SKILL.md` and ADR-0162 each tell a
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

/** Everything the corpus is swept from: the records, the agent docs, the root. */
const SWEPT = ["docs", ".claude"] as const;

/**
 * Flattened prose, cut into sentences.
 *
 * FLATTENED FIRST because every document here is hard-wrapped at 100 columns,
 * so the claim and its cost routinely sit either side of a newline --
 * `flatten.ts` carries the measurement of what matching raw bytes cost
 * `adr-as-built.test.ts`.
 */
function sentencesOf(text: string): string[] {
  return flatten(text).split(/(?<=[.!?])\s+/);
}

/** Every markdown document under `docs/` and `.claude/`, plus the root's own. */
function corpus(): { path: string; sentences: string[] }[] {
  const paths = [
    ...SWEPT.flatMap((directory) =>
      markdownIn(join(repoRoot, directory), { recursive: true }).map((path) =>
        join(directory, path),
      ),
    ),
    ...markdownIn(repoRoot),
  ];
  return paths.map((path) => ({
    path,
    sentences: sentencesOf(readFileSync(join(repoRoot, path), "utf8")),
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
  return corpus().flatMap(({ path, sentences }) =>
    sentences.filter(isFlushClaim).map((sentence) => ({ path, sentence })),
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

/**
 * THE HAZARD THAT NAMES NO WAY THROUGH IT (CNCORE-306).
 *
 * The same three documents tell a dispatcher that input to a PARKED agent goes
 * to the prompt widget, where `--enter` SELECTS the option under the cursor.
 * True, and stated as a hazard with nothing on the other side of it: a reader
 * who has only that has been told what not to do and not what to do, so the
 * options are to guess the keystrokes or to leave the agent parked. That is
 * what left the widget recipe undocumented for as long as it was, and on
 * 2026-09-21 it cost four messages -- sent into a multi-select whose confirm
 * screen was still open, eaten in silence while `orca terminal send` answered
 * `Sent N bytes`.
 *
 * THE WINDOW IS THE SENTENCE AND THE ONE AFTER IT, not the document. A pointer
 * three sections away from the warning is the shape `CLAUDE.md` refuses --
 * "placed beside one, it leaves the old claim standing" -- and a
 * document-level check would pass `CLAUDE.md`, which cites a dozen records
 * elsewhere in the file and would satisfy the rule without the hazard gaining
 * anything.
 *
 * THE RECORD EXCLUDES ITSELF, which is `adr-records.ts`'s idiom in its own
 * words. ADR-0187 IS the way through, so it states the hazard in order to
 * answer it; asking it to cite itself beside its own answer would be asking for
 * a pointer to the paragraph underneath.
 */

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
 */
const THE_WAY_THROUGH = /ADR-0187\b|docs\/adr\/0187-|\[\[0187-/;

/** The record that IS the answer, which is why it is not asked the question. */
const ANSWERS_IT = "0187-";

function hazardsOwedAnAnswer(): { path: string; window: string }[] {
  return corpus()
    .filter(({ path }) => !path.includes(ANSWERS_IT))
    .flatMap(({ path, sentences }) =>
      sentences.flatMap((sentence, index) =>
        THE_HAZARD.test(sentence)
          ? [{ path, window: [sentence, sentences[index + 1] ?? ""].join(" ") }]
          : [],
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
      .filter(({ window }) => !THE_WAY_THROUGH.test(window))
      .map(({ path, window }) => `${path}: ${window}`);
    expect(unanswered).toStrictEqual([]);
  });
});
