import { describe, expect, it } from "vitest";

import { boundedTo, shortenTo } from "./index";

/**
 * ADR-0161. The levers live here so every package that puts a stranger's text
 * in a sentence reaches ONE of them, rather than one package importing the
 * outbound HTTP stack to get at a string function and two others writing the
 * pair out by hand.
 */
describe("boundedTo", () => {
  /**
   * THE LEVER A CUT DOES NOT BUY. A bidirectional override re-orders the glyphs
   * on either side of itself, so a value carrying one runs the sentence
   * CanonCore wrote AROUND it backwards -- and it does that at any length, which
   * is why a ceiling alone leaves it standing.
   */
  it("strips a bidirectional override, which a ceiling alone would leave standing", () => {
    expect(boundedTo("249‮643", 80)).toBe("249643");
  });
});

/**
 * ADR-0123's own witness for the cut, kept at the seam the cut is published
 * from. A U+1F600 opening one unit before the boundary puts one half of it on
 * each side, and a cut counting UTF-16 units keeps the lone high surrogate --
 * which is not a character at all, and renders as a replacement glyph.
 */
describe("shortenTo", () => {
  it("cuts on a whole character, leaving no half of an astral one behind", () => {
    const straddling = `${"a".repeat(78)}\u{1F600}b`;

    const shortened = shortenTo(straddling, 80);

    expect(shortened.isWellFormed()).toBe(true);
    expect(shortened.length).toBeLessThanOrEqual(80);
  });
});
