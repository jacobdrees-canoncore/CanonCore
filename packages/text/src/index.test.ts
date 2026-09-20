import { describe, expect, it } from "vitest";

import { boundedTo, shortenTo } from "./index";

/**
 * ADR-0163. The levers live here so every package that puts a stranger's text
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
    expect(boundedTo("249\u202e643", 80)).toBe("249643");
  });

  /**
   * EVERY MEMBER OF THE CLASS, NOT ONE OF THEM. A single witness over U+202E
   * proves the strip runs; it does not prove the class covers what it claims,
   * and a range endpoint lost while editing would leave the rest of the family
   * passing straight through with the suite still green. That is not
   * hypothetical: this class shipped once spelled with the literal characters,
   * where no reader could have seen an endpoint go missing.
   *
   * BOTH ENDS OF EACH RANGE AND THE LONE MEMBER, which is what makes it a roll
   * call rather than a sample.
   */
  it.each([
    ["\u202a", "a left-to-right embedding, opening the bidi range"],
    ["\u202e", "a right-to-left override, closing it"],
    ["\u2066", "a left-to-right isolate, opening the isolate range"],
    ["\u2069", "a pop-directional-isolate, closing it"],
    ["\u200b", "a zero-width space, opening the zero-width range"],
    ["\u200d", "a zero-width joiner, closing it"],
    ["\ufeff", "a zero-width no-break space, which `\\s` would turn into a space"],
  ])("strips %j, which is %s", (control, _what) => {
    expect(boundedTo(`before${control}after`, 80)).toBe("beforeafter");
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
