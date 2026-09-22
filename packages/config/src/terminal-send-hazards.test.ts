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
});

/**
 * THE TABLE'S SHAPE WAS THE CLAIM, AND THE CLAIM WAS WRONG (CNCORE-337).
 *
 * ADR-0187 laid its keystroke recipes out as kind DOWN the side and question
 * count ACROSS the top, which says in its structure that a count is a function
 * of those two things. Its prose said so too, in as many words. On 2026-09-21 a
 * two-question single-select submitted BOTH questions on ONE bare Enter where
 * that table says three, and the dispatcher committed an answer to a question
 * that was never rendered.
 *
 * SO THE ROW IS A MEASUREMENT, NOT A SHAPE, and this reads the table that way:
 * one row per screen somebody actually read, with the TAB BAR AT REST beside the
 * count, because that is the variable the two contradicting measurements differ
 * on and the one neither of the earlier readings wrote down.
 *
 * WHAT IT CATCHES IS THE NEXT CELL, not this correction. The record names the
 * multi-question MULTI-select as unmeasured and tells a reader to measure it
 * before driving one; the day somebody does, a count written in without the
 * screen state it was read at is the identical defect, and this reddens on it.
 */
const REQUIRED_COLUMNS = ["kind", "questions", "tab bar at rest", "keystrokes to submit"];

function keystrokeTable(): { headings: string[]; rows: Record<string, string>[] } {
  const path = theRecordThatAnswersIt();
  const lines = readFileSync(join(repoRoot, path), "utf8").split("\n");

  const cellsOf = (line: string): string[] =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());

  // A RUN OF PIPE LINES UNDER A SEPARATOR ROW, rather than the first pipe line
  // in the file, which is not this table. The record quotes a transcript
  // reading `|_ Interrupted - What should Claude do instead?`, and a reader
  // that took the first pipe line took that one -- found by writing this the
  // obvious way and watching it report the record as holding no table at all.
  const runs: string[][] = [[]];
  for (const line of lines) {
    if (line.trimStart().startsWith("|")) runs.at(-1)?.push(line);
    else if ((runs.at(-1)?.length ?? 0) > 0) runs.push([]);
  }
  const run = runs.find(
    ([, separator]) =>
      separator !== undefined && cellsOf(separator).every((cell) => /^:?-+:?$/.test(cell)),
  );

  const [header, , ...body] = run ?? [];
  if (header === undefined) {
    throw new Error(
      `${path} holds no markdown table with a separator row, so the keystroke recipes cannot be ` +
        "read and this suite is asking nothing",
    );
  }

  const headings = cellsOf(header).map((cell) => cell.replace(/[*`]/g, "").trim().toLowerCase());
  const rows = body.map((line) => {
    const cells = cellsOf(line);
    return Object.fromEntries(headings.map((heading, at) => [heading, cells[at] ?? ""]));
  });

  // THE READER IS THE GUARD, which is `theRecordThatAnswersIt` above and
  // `adr-records.unnumbered` in their own words: a helper that cannot answer for
  // what it returned throws, rather than handing back something every caller
  // then has to re-check. Three rules read this table and only one of them was
  // asserting the shape, so a table inserted ABOVE this one in the record -- or
  // this one reverted to the kind-by-question-count grid -- left the other two
  // passing over a population that was not the keystroke recipes at all.
  //
  // THE COLUMNS ARE NAMED HERE AND NOT JUST COUNTED, because the rules below
  // reach for them BY NAME. Renaming `kind` collapses every pair key the
  // contradiction rule builds into one, and it would go green for the wrong
  // reason rather than red.
  const missing = REQUIRED_COLUMNS.filter((column) => !headings.includes(column));
  if (missing.length > 0 || rows.length === 0) {
    throw new Error(
      `${path}'s first table is not the keystroke recipes: it has ${rows.length} row(s) and is ` +
        `missing the column(s) ${missing.join(", ") || "(none)"}. Its headings are ` +
        `${headings.join(", ")}. Every rule below reads those columns by name, so they would ` +
        "otherwise pass over a table that answers a different question.",
    );
  }

  return { headings, rows };
}

/** The record, flattened, for the sentences below; `keystrokeTable` reads it by line. */
function recordText(): string {
  return flatten(readFileSync(join(repoRoot, theRecordThatAnswersIt()), "utf8"));
}

/**
 * `NOT MEASURED` IS A DECLARATION ABOUT A ROW; `NOT RECORDED` IS A FACT ABOUT A
 * CELL, and the difference is the whole of the rule below.
 *
 * Nobody has driven a multi-question multi-select, so that row declares itself
 * unmeasured in its keystrokes cell and is owed nothing. Somebody DID drive
 * CNCORE-288's widget and did not write its tab bar down, so that cell says
 * `NOT RECORDED` and the row is still a measurement.
 *
 * MEASURED, AND THE FIRST DRAFT HAD IT WRONG. That draft tested `NOT MEASURED`
 * against the whole row joined, so one cell exempted all five and a row reading
 * `| multi-select | several | NOT MEASURED | FOUR down arrows then TWO Enters |
 * CNCORE-999 |` went GREEN -- a count with no screen state, which is the exact
 * defect the block above says this catches. Found by planting it (CNCORE-337
 * review). A check green on the defect it names is worse than no check.
 */
const DECLARES_THE_ROW_UNMEASURED = /NOT MEASURED/i;

describe("ADR-0187's keystroke table", () => {
  /**
   * BEFORE THE RULES, and it asks the one thing the reader's own throw cannot:
   * that the reader resolves. The throw fires inside whichever rule runs first,
   * which reports a missing column as a failure of that rule; this row says
   * plainly that the population is the keystroke recipes.
   */
  it("is found in the record, under the columns the rules below read", () => {
    expect(() => keystrokeTable()).not.toThrow();
    expect(keystrokeTable().rows.length).toBeGreaterThan(0);
  });

  it("says what screen every count it gives was counted from", () => {
    const { headings, rows } = keystrokeTable();
    const first = headings[0] ?? "";

    const unpinned = rows
      // THE KEYSTROKES CELL ALONE DECLARES THE ROW, for the reason the constant
      // above carries: read across the whole row, one `NOT MEASURED` exempted
      // the count sitting beside it.
      .filter((row) => !DECLARES_THE_ROW_UNMEASURED.test(row["keystrokes to submit"] ?? ""))
      .flatMap((row) =>
        headings.flatMap((heading) => {
          const cell = row[heading] ?? "";
          const label = `${row[first] ?? "(unlabelled row)"}: ${heading}`;
          if (cell === "") return [`${label} is empty`];
          // A ROW THAT GIVES A COUNT IS A MEASUREMENT, so no cell of it can say
          // the measurement was not taken. `NOT RECORDED` is the word for a
          // screen somebody saw and did not write down, and it stays lawful.
          return DECLARES_THE_ROW_UNMEASURED.test(cell) ? [`${label} says NOT MEASURED`] : [];
        }),
      );

    expect(
      unpinned,
      "a row of ADR-0187's keystroke table gives a keystroke count without saying what screen " +
        "it was counted from. That is the defect CNCORE-337 measured: a count read off one " +
        "screen state travels as a property of the widget. Either fill the cell -- with the " +
        "reading, or with NOT RECORDED if nobody wrote it down -- or declare the whole row by " +
        "putting NOT MEASURED in its `keystrokes to submit` cell.",
    ).toStrictEqual([]);
  });

  /**
   * THE FINDING ITSELF, HELD BY THE TABLE'S SHAPE RATHER THAN BY A SENTENCE.
   *
   * Two rows share `single-select` and two questions and give different counts:
   * CNCORE-288's three Enters and CNCORE-336's one. While both stand, a reader
   * CANNOT take a count off the kind and the question count, because the table
   * answers that pair twice and disagrees with itself -- which is what a reader
   * following the old grid did, on the first keystroke, to a question that was
   * never rendered.
   *
   * SO DELETING EITHER ROW IS WHAT THIS REFUSES, and it is the likeliest edit:
   * the pair reads as a duplicate to anybody tidying, and tidying it away
   * restores a table a dispatcher can derive from. If the re-measurement this
   * record is still waiting on DOES account for the difference, the row that
   * goes should take this check with it and say why in the same pass.
   */
  it("holds one kind and question count twice, with the counts disagreeing", () => {
    const { rows } = keystrokeTable();

    const counts = new Map<string, Set<string>>();
    for (const row of rows) {
      if (DECLARES_THE_ROW_UNMEASURED.test(row["keystrokes to submit"] ?? "")) continue;
      const pair = `${row.kind ?? ""}, ${row.questions ?? ""} question(s)`;
      counts.set(pair, (counts.get(pair) ?? new Set()).add(row["keystrokes to submit"] ?? ""));
    }

    const contradicted = [...counts].filter(([, given]) => given.size > 1).map(([pair]) => pair);

    expect(
      contradicted.length,
      "no pair of kind and question count is measured twice with different counts in ADR-0187, " +
        "so the table reads as derivable from that pair again. CNCORE-336's one-Enter reading " +
        "and CNCORE-288's three-Enter reading are both of a two-question single-select and both " +
        "belong in it until a controlled re-measurement says which holds and why.",
    ).toBeGreaterThan(0);
  });

  /**
   * AND THE SENTENCE BESIDE THE TABLE SAID IT TOO, which is the half the table's
   * shape cannot hold.
   *
   * ADR-0187 read "the keystroke count is a property of BOTH the widget's kind
   * and its question count", warning off the narrower assumption one level down
   * while making the same mistake one level up. That sentence is what a
   * dispatcher counted keystrokes from on 2026-09-21.
   *
   * THE OLD CLAIM IS DESCRIBED HERE AND NOT QUOTED IN THE RECORD, which is the
   * wall `adr-as-built.test.ts` hit from the other side -- "a record correcting
   * itself has to be able to say what it used to claim" -- taken the other way
   * round. That suite freed the RECORD by reading its decision block; this
   * sentence lives under a `##` heading, so there is no narrower unit to read
   * and the correction says what it corrects in words instead. A check cannot
   * ask for both.
   *
   * AND THE CORRECTION IS RECORDED rather than quietly swapped, on ADR-0081's
   * reason: a reader who remembers the old count cannot otherwise tell a fix
   * from a drift.
   */
  it("no longer offers the count as a property of the kind and the question count", () => {
    const text = recordText();

    expect(
      text,
      "ADR-0187 states the keystroke count as a property of the widget's kind and its question " +
        "count again. Two measured rows of its own table disagree on exactly that pair, so the " +
        "claim is refused by the record it sits in (CNCORE-337).",
    ).not.toMatch(/count is a property of/i);

    expect(
      text,
      "ADR-0187's keystroke count was corrected without the record saying so, so a reader who " +
        "remembers the three-Enter table cannot tell a fix from a drift.",
    ).toMatch(/CNCORE-337/);
  });

  /**
   * AND THE SAME READING REFUSED THE RECORD'S ADVICE ON HOW TO READ THE SCREEN.
   *
   * ADR-0187 told a dispatcher the cursor row was THE ONLY THING that says
   * whether the next Enter toggles, advances or submits. At CNCORE-336 the
   * cursor sat on option 1 of 3 and the Enter submitted both questions, so the
   * cursor row said nothing of the kind and the tab bar -- `Submit` ticked with
   * neither question answered -- was carrying the answer instead.
   *
   * IT IS A SEPARATE CLAIM FROM THE COUNT, and reddens separately, because a
   * correction that fixed the table and left this standing would leave a
   * dispatcher a rule for deriving the keystroke it had just been told not to
   * derive. `CLAUDE.md`: placed beside one, a correction leaves the old claim
   * standing.
   */
  it("no longer says the cursor row alone tells a reader what the next Enter does", () => {
    const text = recordText();

    expect(
      text,
      "ADR-0187 says the cursor row is the only thing that says what the next Enter does. " +
        "CNCORE-336 read a cursor on option 1 of 3 and an Enter that submitted two questions, " +
        "so the tab bar was carrying it and the cursor row was not.",
    ).not.toMatch(/cursor row is the only thing/i);
  });
});
