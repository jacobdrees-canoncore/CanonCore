import { describe, expect, it } from "vitest";
import { flatten } from "./flatten";

/**
 * The reason this module exists is a MEASURED false green, and the first test
 * below is that measurement rather than a restatement of the one-line body.
 *
 * `adr-as-built.test.ts` recorded it: the first version of its ADR-0081
 * assertion matched the raw bytes, and it PASSED ON THE UNFIXED RECORD, because
 * the sentence it looked for is hard-wrapped at 100 columns and "the" and
 * "earliest" sit either side of a newline.
 *
 * SO THE ASSERTIONS ARE ABOUT PATTERNS MATCHING, not about whitespace. A test
 * that compared `flatten(x)` against a second copy of `x.replace(/\s+/g, " ")`
 * would pass by construction and could never disagree with the code.
 */
describe("a record's prose read as one line", () => {
  /**
   * THE DEFECT ITSELF, in the shape it was met in. A reader wraps prose at 100
   * columns whenever a word above it changes length, so a pattern written
   * against the sentence as a person reads it fails against the bytes.
   */
  it("lets a pattern match a sentence the wrap split in two", () => {
    const wrapped =
      "ADR-0081 asserts a projection nobody built, which is the\nearliest thing this record got wrong.";

    expect(/the earliest thing/.test(wrapped)).toBe(false);
    expect(/the earliest thing/.test(flatten(wrapped))).toBe(true);
  });

  /**
   * A WRAP LEAVES INDENTATION BEHIND, which is the half a `\n` -> `" "` replace
   * would miss: a continuation line in a list item or a quoted block arrives
   * with its leading spaces, so the join has to collapse the RUN rather than
   * the newline.
   */
  it("collapses a newline and the indent after it to a single space", () => {
    const indented = "the population is one, and\n      the figure states two";

    expect(/one, and the figure/.test(flatten(indented))).toBe(true);
  });

  /** Leading and trailing whitespace is not part of any sentence. */
  it("has no whitespace at either end", () => {
    expect(flatten("\n  a record  \n")).toBe("a record");
  });

  /**
   * TABS AND CARRIAGE RETURNS COUNT, because a corpus this reads spans Markdown,
   * JSDoc and YAML and not every one of them is space-indented.
   */
  it("treats a tab and a carriage return as whitespace like any other", () => {
    expect(flatten("a\t\tb\r\nc")).toBe("a b c");
  });

  /** Nothing but whitespace is nothing, which is what lets a caller test for it. */
  it("reads whitespace alone as empty", () => {
    expect(flatten(" \n\t ")).toBe("");
  });
});
