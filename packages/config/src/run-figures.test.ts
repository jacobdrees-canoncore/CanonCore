import { describe, expect, it } from "vitest";

import {
  carriesAnAnchor,
  contextOf,
  figuresIn,
  figuresInTheIrreducible,
  filesSwept,
  idleRegistrations,
  statedFigures,
  unanchoredFigures,
  unregisteredFigures,
} from "./testing/run-figures";

describe("a figure stating how a run went", () => {
  it.each([
    ["the equal pair", "and **18 of 18 stayed green**, because the inverted sentence", "18 of 18"],
    ["the equal pair, grouped", "12,791 of 12,791 against the archive", "12,791 of 12,791"],
    ["vitest's total", "Taken out with `git checkout`, `7 passed (7)`.", "7 passed (7)"],
    ["vitest's split", "green now: `8 failed | 21 passed (29)`, then", "8 failed | 21 passed (29)"],
    [
      "vitest's three parts",
      "applied: 1 failed, 390 passed, 1 skipped",
      "1 failed, 390 passed, 1 skipped",
    ],
    [
      "vitest's parts joined by a word",
      "// 1 failed and 151 passed of 152",
      "1 failed and 151 passed",
    ],
    ["a bare total", "and every one was green: 199 passed.", "199 passed"],
  ])("is read out of prose: %s", (_, sentence, figure) => {
    expect(figuresIn(sentence)).toStrictEqual([figure]);
  });

  it.each([
    ["a ratio, which is not all of them", "1 of 1,566 `Writer` values"],
    ["a port that precedes the word", 'connection to server at "127.0.0.1", port 55432 failed:'],
    ["a noun the word governs", "the aggregate ceiling is roughly 10 failed guesses per subnet"],
    ["a ticket number", "the nine witnesses the file had under CNCORE-223 failed"],
  ])("is not read into: %s", (_, sentence) => {
    expect(figuresIn(sentence)).toStrictEqual([]);
  });
});

describe("the sweep for them", () => {
  /**
   * BEFORE THE RULE, because a sweep that opened nothing would satisfy every
   * rule below by having no subject -- the vacuous pass CNCORE-298, CNCORE-314
   * and CNCORE-327 each paid for.
   */
  it("reads the whole tracked tree", () => {
    expect(filesSwept()).toBeGreaterThan(500);
  });

  it("finds figures in it, each placed where a reader can go and look", () => {
    const found = statedFigures();
    expect(found.length).toBeGreaterThan(30);
    expect(found.every(({ path, line }) => path.length > 0 && line > 0)).toBe(true);
  });
});

/**
 * THE ANCHOR IS WHAT MAKES A FIGURE CHECKABLE, and ADR-0153 already names it:
 * a figure that cannot be derived carries the tree it was taken on. A reader
 * who knows which tree can go and take it again; a reader who does not cannot
 * tell a stale figure from a live one, which is the whole of this defect.
 */
describe("the anchor a figure is lawful by", () => {
  it.each([
    ["a date", "Measured 2026-09-21 at this pass's own three edits in and nothing else"],
    ["a commit", "run over the two trees as CNCORE-258 found them, `provider-wiki` at `f506438`"],
    ["a date inside a longer measurement", "Recounted 2026-09-20 over the whole ladder"],
  ])("is recognised: %s", (_, context) => {
    expect(carriesAnAnchor(context)).toBe(true);
  });

  /**
   * A TICKET NUMBER IS NOT AN ANCHOR, AND THIS ROW IS THE ONE THAT MATTERS.
   * Both figures CNCORE-338 corrected name a ticket in their own sentence --
   * `CNCORE-206`'s loop beside "18 of 18", `CNCORE-214`'s rename beside
   * "16 of 16" -- and neither names the tree the figure was taken on. A rule
   * that read a ticket as an anchor would have passed both controls green,
   * which is the measurement that rejected it.
   */
  it.each([
    ["a ticket, which says who and not which tree", "CNCORE-206's loop -- and 18 of 18 stayed"],
    ["nothing at all", "after that rename it passed with the carve-out deleted -- 16 of 16 --"],
    ["a version, which is not a tree", "pnpm 12 rejects it, and vitest 5.0.0 does not"],
  ])("is not read into: %s", (_, context) => {
    expect(carriesAnAnchor(context)).toBe(false);
  });
});

describe("the context an anchor is looked for in", () => {
  /**
   * A DOCUMENT'S IS ITS SECTION AND A SOURCE FILE'S IS ITS COMMENT BLOCK,
   * because those are the units a writer states a measurement in. A pass
   * record dates its section once and then quotes a dozen figures under it;
   * a docblock names the tree once and then reasons from it.
   */
  it("is the section, in a document", () => {
    const context = contextOf(
      "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
      1505,
    );
    expect(context).toMatch(/^#/);
    expect(context.split("\n").length).toBeGreaterThan(1);
  });

  it("is the comment block, in a source file", () => {
    const context = contextOf("packages/config/src/testing/stable-sequencer.ts", 18);
    expect(context).toContain("2026-09-14");
    expect(context).not.toContain("export");
  });
});

describe("a figure with no anchor and nothing deriving it", () => {
  it("is fewer than every figure, because the anchor excuses the dated ones", () => {
    expect(unanchoredFigures().length).toBeLessThan(statedFigures().length);
  });

  it("is never one whose context carries an anchor after all", () => {
    const wrong = unanchoredFigures().filter(({ path, line }) =>
      carriesAnAnchor(contextOf(path, line)),
    );
    expect(wrong).toStrictEqual([]);
  });
});

describe("the register that answers for a figure no anchor excuses", () => {
  /**
   * AN ENTRY EARNS ITS PLACE OR IT GOES, which is what stops this list growing
   * whenever the check is inconvenient. `corpus-import-cost.test.ts` holds its
   * exclusions to the same rule in the same words: an entry that finds nothing
   * is either a figure somebody already fixed, leaving a row that now excuses
   * whatever lands on that path next, or a row added to buy silence.
   */
  it("holds no entry that finds nothing, so it cannot buy silence or go stale", () => {
    expect(idleRegistrations()).toStrictEqual([]);
  });

  /**
   * THE SAME RULE POINTED AT THE FILES EXCUSED BY NAME rather than by a row.
   * A name that stops finding anything is a name that now excuses whatever
   * lands on that path next, which is the silent half of an exemption.
   */
  it("excuses only files that would otherwise be found, so a name cannot buy silence", () => {
    expect(figuresInTheIrreducible().filter(({ found }) => found === 0)).toStrictEqual([]);
  });

  /**
   * THE RULE, AND THE ONLY THING THIS WHOLE FILE IS FOR. A figure nothing
   * derives, nothing anchors and nobody has answered for is red, naming where
   * it is. Three tickets in a row found this class by hand and each ended by
   * naming two more in files it had not touched (CNCORE-333, CNCORE-335,
   * CNCORE-338). That does not converge, because a grep is an instrument and
   * the reading is the filter; this asks the tree instead.
   */
  it("is the only way a figure passes without one", () => {
    expect(
      unregisteredFigures().map(
        ({ path, line, figure }) =>
          `${path}:${line} states "${figure}". Anchor it with the date or commit it was ` +
          `measured on, register it below as an argument or as foreign, or delete it.`,
      ),
    ).toStrictEqual([]);
  });
});
