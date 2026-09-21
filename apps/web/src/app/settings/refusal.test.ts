import { describe, expect, it } from "vitest";

import { theEntryRefused, UNSHOWABLE_ENTRY } from "./refusal";

/**
 * ADR-0179. `/settings` reads `?refused=` off an address anybody can compose
 * and renders it as the SUBJECT of a sentence it speaks in its own voice --
 * `<WhichEntry entry={entry} /> was not named, because ...`. An entry that
 * bounds to nothing leaves that clause with no subject at all.
 */
describe("theEntryRefused", () => {
  /**
   * THE FORGEABLE ADDRESS IS THE WHOLE POINT OF THE SEAM. `oneValue` reads a
   * blank parameter as an absent one -- and `trim()` does not remove U+200B, so
   * an entry of three zero-width spaces is NOT blank by that test. It reaches
   * the bound whole and comes back empty, which is the one value that is
   * neither absent (where `WhichEntry` says "That entry") nor showable.
   */
  it("says what could not be shown when the whole entry was stripped", () => {
    expect(theEntryRefused("​​​")).toBe("an entry made only of characters that cannot be shown");
  });

  /**
   * AN ABSENT PARAMETER IS STILL ABSENT, and must not be dressed up as an
   * unshowable one. `WhichEntry` renders `undefined` as "That entry", which is
   * the sentence for a refusal that named nothing -- a different fact from an
   * entry nobody can print, and CNCORE-92's rule is that the two do not merge.
   */
  it("leaves an absent entry absent rather than naming it unshowable", () => {
    expect(theEntryRefused(undefined)).toBeUndefined();
    expect(theEntryRefused("   ")).toBeUndefined();
  });

  /**
   * THE PAGE COMPARES AGAINST THIS EXACT STRING, so the two must not drift.
   * `WhichEntry` renders a real entry inside `TheirWords` and renders this one
   * plainly, because the first is the Owner's text and the second is
   * CanonCore's words ABOUT it (ADR-0123's `wrote` distinction). A rename on
   * either side would silently put our sentence back in their voice, and
   * nothing else in the tree would notice.
   */
  it("answers the exact string the page tells apart from the Owner's own text", () => {
    expect(theEntryRefused("\u200b\u200b\u200b")).toBe(UNSHOWABLE_ENTRY);
  });

  /** The partly-unshowable entry is still quoted, by the strip alone. */
  it("quotes an entry the strip only partly took", () => {
    expect(theEntryRefused("https://wiki‮.test")).toBe("https://wiki.test");
  });
});
