import { describe, expect, it } from "vitest";

import { oneValue, theQueryQuoted } from "./query-params";

/**
 * ADR-0179. Both surfaces that print a reader's query quote it inside a
 * sentence this app speaks in its own voice, so a query that bounds to NOTHING
 * leaves that sentence without its subject -- `/search` renders it inside
 * `TheirWords` and `/import` carries it through `quoted`.
 */
describe("theQueryQuoted", () => {
  /**
   * IT IS REACHABLE OFF THE ADDRESS, which is what makes it worth words rather
   * than a comment. `oneValue` guards with `parameter.trim() !== ""` and
   * `trim()` does NOT remove U+200B, so `?q=` of three zero-width spaces is a
   * non-empty parameter that reaches here and comes back empty. The guard is
   * asserted beside the words because it is the half that makes this
   * reachable, and a change to it would make this test pass vacuously.
   */
  it("says what could not be shown when the whole query was stripped", () => {
    const zeroWidth = "​​​";

    expect(oneValue(zeroWidth)).toBe(zeroWidth);
    expect(theQueryQuoted(zeroWidth)).toBe("a query made only of characters that cannot be shown");
  });

  /**
   * THE PARTLY-UNSHOWABLE QUERY IS STILL QUOTED, by the strip alone, which is
   * why the words say "made only of". A reader who typed a query with one
   * override in it reads their own query back.
   */
  it("quotes a query the strip only partly took", () => {
    expect(theQueryQuoted("dalek‮master")).toBe("dalekmaster");
  });
});
