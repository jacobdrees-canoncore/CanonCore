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
