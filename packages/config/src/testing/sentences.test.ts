import { describe, expect, it } from "vitest";

import { blocksOf, sentencesOf, withoutCommentLeaders } from "./sentences";

/**
 * THE CUTTER'S OWN MEASUREMENTS, RUN RATHER THAN RECORDED (CNCORE-327).
 *
 * `blocksOf` and `sentencesOf` came out of `terminal-send-hazards.test.ts` when
 * `corpus-import-cost.test.ts` needed the identical cut. Their docblocks carry
 * measurements that argue for every line of them -- the 634-character sentence a
 * document-wide split gave ADR-0162, the two directions an abbreviation breaks
 * -- and as inline helpers of one suite NOTHING EXECUTED THOSE CLAIMS. Both
 * callers would have gone on passing with the guards quietly removed.
 *
 * That is `bounded-parameters.test.ts`'s rule arriving at a shared reader: "an
 * exemption nothing executes is an exemption nobody can check." Every other
 * module in this directory has a sibling suite for the same reason.
 *
 * NOTHING HERE QUOTES THE SUPERSEDED CORPUS-IMPORT COST, AND THAT IS DELIBERATE
 * RATHER THAN INCIDENTAL. The first draft of these rows reached for it, because
 * the wrapped spelling is what sent CNCORE-327 looking for this cutter -- and
 * `corpus-import-cost.test.ts` sweeps every tracked file for exactly that
 * phrase, so three rows here turned that check red on its own author's branch.
 *
 * THE ANSWER IS NOT TO EXEMPT THIS FILE. A cutter is general: what these rows
 * need is a sentence that WRAPS, and any sentence wraps. The figure was never
 * doing work here, so it is DESCRIBED where it matters -- in that check's own
 * fixtures, where the spelling is the subject and the exclusion is earned --
 * and absent here, which is [[0190-the-prose-corpus-is-named-once-and-claude-is-prose]]'s
 * shape for the same self-reference. An exclusion widened to cover a file that
 * did not need it is a check that has quietly stopped asking.
 */
describe("blocksOf", () => {
  /**
   * THE WHOLE REASON THE BLOCK EXISTS. `flatten` eats newlines and markdown does
   * not end a heading or a bullet with a full stop, so splitting a flattened
   * DOCUMENT gives one 634-character "sentence" with headings swallowed
   * mid-string, and "the sentences beside this one" reaches the rest of the file.
   *
   * A MARKER CLOSES THE BLOCK BEFORE IT, AND OPENS ONE IT CAN SHARE. So a heading
   * and the paragraph under it are ONE block, which is the behaviour and not an
   * accident: each marker line is a place markdown changes subject, and what
   * follows a heading is that heading's subject. Two consecutive bullets are two
   * blocks, because the second marker closes the first.
   */
  it("opens a block at a heading, a bullet and a table row, none of which end in a full stop", () => {
    expect(
      blocksOf(
        ["## A heading", "A paragraph.", "", "- a bullet", "- another", "| a | row |"].join("\n"),
      ),
    ).toEqual(["## A heading\nA paragraph.", "- a bullet", "- another", "| a | row |"]);
  });

  it("keeps a hard-wrapped paragraph whole, which is what the corpus is written as", () => {
    expect(blocksOf("one line\nwrapped onto\na second and third")).toEqual([
      "one line\nwrapped onto\na second and third",
    ]);
  });

  it("closes a block on a blank line", () => {
    expect(blocksOf("first.\n\nsecond.")).toEqual(["first.", "second."]);
  });
});

describe("sentencesOf", () => {
  /**
   * FLATTENED FIRST, which is `flatten.ts`'s measurement reaching this cutter: a
   * claim and its correction routinely sit either side of a 100-column break, and
   * a reader matching raw bytes finds neither.
   */
  it("reads a sentence broken across a wrap as one sentence", () => {
    expect(sentencesOf("a walk of 465 Containers is asked for one\nContainer a call.")).toEqual([
      "a walk of 465 Containers is asked for one Container a call.",
    ]);
  });

  it("splits on a full stop, a question mark and an exclamation", () => {
    expect(sentencesOf("One. Two? Three!")).toEqual(["One.", "Two?", "Three!"]);
  });

  /**
   * BOTH DIRECTIONS OF THE ABBREVIATION GUARD, which its docblock reports as
   * measured and nothing ran. A false split can redden correct prose by cutting
   * a claim off its qualifier, and -- the worse one -- it can let a claim ESCAPE,
   * by leaving no fragment that is a whole claim for a pattern to find.
   */
  it("does not end a sentence at an abbreviation", () => {
    expect(sentencesOf("Flush it, e.g. on a rung broadcast. It interrupts.")).toEqual([
      "Flush it, e.g. on a rung broadcast.",
      "It interrupts.",
    ]);
    expect(sentencesOf("Press it, i.e. Escape then Enter. That flushes it.")).toEqual([
      "Press it, i.e. Escape then Enter.",
      "That flushes it.",
    ]);
  });

  it("still ends a sentence at a word that merely ends in those letters", () => {
    expect(sentencesOf("She read it. Then left.")).toEqual(["She read it.", "Then left."]);
  });
});

describe("withoutCommentLeaders", () => {
  /**
   * A DOCBLOCK'S CLOSING DELIMITER LEAVES AN INERT `/`, recorded rather than
   * removed. The closing line is a star then a slash, and the star is taken as
   * the wrap leader, so the slash left behind becomes a fragment of its own. It
   * carries no word and no digit, so no pattern
   * written against prose can match it and no claim can hide in it; this row
   * pins the behaviour so a future reader meets it here rather than in a
   * puzzling failure. `tree-figures.ts` has read source this way since CNCORE-251
   * without it costing anything.
   */
  it("takes the JSDoc leader off, so a wrapped docblock sentence reads as one", () => {
    expect(
      sentencesOf(
        withoutCommentLeaders("a.ts", "/**\n * asked for one\n * Container a call.\n */"),
      ),
    ).toEqual(["asked for one Container a call.", "/"]);
  });

  it("takes a line comment's leader off at the line start only, because `https://` is not one", () => {
    expect(withoutCommentLeaders("a.ts", "// see\n// https://example.test")).toBe(
      "see\nhttps://example.test",
    );
  });

  /**
   * THE LADDER IS THE ONE POPULATION WHOSE PROSE CANNOT BE AMENDED (ADR-0047), so
   * a reader blind to `--` is blind to the one place a correction can never land.
   */
  it("takes SQL's leader off a rung", () => {
    expect(
      withoutCommentLeaders("m.sql", "-- the whole list\n-- is walked one Container a call."),
    ).toBe("the whole list\nis walked one Container a call.");
  });

  /**
   * SCOPED TO `.sql`, AND THIS ROW IS WHY. YAML opens a document with `---`, and
   * a blanket strip turns that into `-`. `tree-figures.ts` reads `ci.yml` through
   * this function, so the collision is real rather than hypothetical -- it was
   * found by folding this module into that one.
   */
  it("leaves a YAML document separator alone", () => {
    expect(withoutCommentLeaders("ci.yml", "---\nname: CI\n# a comment")).toBe(
      "---\nname: CI\na comment",
    );
  });

  /**
   * MARKDOWN IS RETURNED UNTOUCHED, because `#` opens a heading there and `*`
   * opens a bold span: stripping either rewrites the document being read.
   */
  it("leaves markdown alone", () => {
    const document = "# A heading\n\n* a bullet\n\n**bold**";
    expect(withoutCommentLeaders("a.md", document)).toBe(document);
  });
});
