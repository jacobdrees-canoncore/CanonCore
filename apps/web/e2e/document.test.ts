import { describe, expect, it } from "vitest";

import { sectionIn } from "./document";

/**
 * `sectionIn` READ DIRECTLY, over markup written here rather than served.
 *
 * IT IS THE ONE READING OF "ONE `<section>` OF A PAGE" IN THIS SUITE
 * (CNCORE-147), and the shapes that break a reading of one are shapes no page in
 * the fixture renders: a `<section>` the page leaves unclosed, a label carried by
 * something that is not one. The whole suite passing cannot go red on any of
 * them, so each is written out here instead -- which is the difference between
 * a reader that counts and a reader that is merely correct about today's pages.
 *
 * THE OTHER HALF OF THE CHECK IS THE SUITE ITSELF. Every assertion in the files
 * beside this one reads its surface through this function, so what they prove is
 * that counting depth returns the same bytes on real markup that the old
 * non-greedy match did.
 */
describe("sectionIn", () => {
  it("takes the whole of a section with one nested inside it", () => {
    const page = [
      '<section aria-labelledby="members">',
      "rows",
      '<section aria-labelledby="past-the-end">the ordering ends here</section>',
      "Back to the start",
      "</section>",
    ].join("");

    expect(sectionIn(page, "members")).toContain("Back to the start");
  });

  /**
   * GREEN THE DAY IT WAS WRITTEN, and written anyway. Counting depth answers
   * this correctly by construction, but the two readings this function replaced
   * both got it wrong in production -- `alsoAppearsIn` ran to the DOCUMENT'S
   * last `</section>` and swallowed the attribution notice (CNCORE-135). What
   * this pins is that the next reading of a section cannot reintroduce it.
   */
  it("stops at its own closing tag rather than the document's last", () => {
    const page = [
      '<section aria-labelledby="also-appears-in">',
      '<section aria-labelledby="past-the-end">the ordering ends here</section>',
      "</section>",
      '<section aria-labelledby="attribution">a licence notice</section>',
    ].join("");

    expect(sectionIn(page, "also-appears-in")).not.toContain("a licence notice");
  });

  /**
   * AND AN UNCLOSED ONE IS SAID SO RATHER THAN GUESSED AT. This is the shape a
   * non-greedy match cannot tell from a closed one: the nested `</section>`
   * below looks like this section's own, so the old reading handed back a slice
   * that ended in the middle of the page and no assertion could tell.
   *
   * THE TWO REFUSALS ARE DISTINGUISHED, because a reader told "the page rendered
   * no `members` section" about a page that plainly renders one would go looking
   * in the wrong place.
   */
  it("says a section is unclosed rather than ending it at a nested close", () => {
    const page = [
      "<main>",
      '<section aria-labelledby="members">',
      "rows",
      '<section aria-labelledby="past-the-end">the ordering ends here</section>',
      "</main>",
    ].join("");

    expect(() => sectionIn(page, "members")).toThrow(/unclosed/);
  });

  /**
   * AND A LABEL THE PAGE DOES NOT CARRY IS THE OTHER REFUSAL. Four files assert
   * a surface is ABSENT by expecting this throw, so a reading that answered the
   * empty string would let every one of them pass against a page missing the
   * whole thing.
   */
  it("refuses a label the page does not carry, distinctly from an unclosed one", () => {
    const page = '<section aria-labelledby="members">rows</section>';

    expect(() => sectionIn(page, "also-appears-in")).toThrow(/rendered no/);
  });
});
