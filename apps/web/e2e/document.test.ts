import { describe, expect, it } from "vitest";

import { mainOf, sectionIn, steadyMainOf } from "./document";

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

  /**
   * AND A LABEL ON SOMETHING THAT IS NOT A SECTION IS NOT A SECTION. The
   * non-greedy match this replaced required the label to sit inside a
   * `<section>` opening tag, and counting from the nearest `<section` BEFORE the
   * label drops that: the nearest one is then a previous sibling, and the reader
   * hands back a whole section that is not the one asked for.
   *
   * Nothing renders this today -- every `aria-labelledby` in the app is on a
   * `<section>` -- which is what makes it worth a test rather than worth
   * ignoring. A silently wrong section passes every `not.toContain` assertion
   * made against it.
   */
  it("refuses a label carried by something that is not a section", () => {
    const page = [
      '<section aria-labelledby="values">Owner</section>',
      '<nav aria-labelledby="filter">Arrived through</nav>',
    ].join("");

    expect(() => sectionIn(page, "filter")).toThrow(/rendered no/);
  });
});

/**
 * `steadyMainOf` READ DIRECTLY, over markup written here rather than served.
 *
 * WHAT IT IS FOR IS A COMPARISON THAT CANNOT BE MADE ANY OTHER WAY. Two files
 * fetch one address three times and require the three answers to be identical,
 * which is the only way to ask whether the ADDRESS decides the page -- and the
 * shape that breaks it is a Group arriving between two of those fetches, from
 * another file, on the instance they share. A test that waited for that would
 * be waiting on the scheduler: CNCORE-271's flake took four full runs to show
 * once. So the shape is written out here, where it is every run.
 */
describe("steadyMainOf", () => {
  /** A Catalogue page narrowed to a Group, with the picker offering these. */
  function aPageOffering(...groups: string[]): string {
    return [
      '<main class="container mx-auto max-w-3xl px-4 py-8">',
      '<h1 class="text-3xl font-medium">Catalogue</h1>',
      '<nav aria-label="Narrow to a Group" class="mt-2 flex flex-wrap">',
      '<a href="/" class="picked">Everything</a>',
      ...groups.map((name) => `<a href="/?group=${name}" class="picked">${name}</a>`),
      "</nav>",
      '<nav aria-label="Narrow to a kind" class="mt-2"><a href="/">Every kind</a></nav>',
      "<ul><li>a Row</li></ul>",
      "</main>",
    ].join("");
  }

  /**
   * THE DEFECT, AS THE SUITE MEETS IT (CNCORE-253, CNCORE-271). `import-page`
   * creates three Groups on the shared instance while `scope` and
   * `order-and-narrow` compare one address against itself, and the picker
   * renders EVERY Group there is, uncapped, inside the same `<main>`. So one
   * Group landing between two fetches is a byte difference in a region neither
   * test is asking about.
   */
  it("holds still when a Group is added, where the whole main does not", () => {
    const before = aPageOffering("Doctor Who");
    const after = aPageOffering("Doctor Who", "Imported at 12:04:07");

    expect(mainOf(after)).not.toBe(mainOf(before));
    expect(steadyMainOf(after)).toBe(steadyMainOf(before));
  });

  /**
   * AND IT CUTS THE PICKER, NOT THE PAGE. Both assertions above pass against a
   * reading that answered the empty string, or that cut from the picker to the
   * end of `<main>` -- and either would take the Rows with it, which is what
   * the callers are actually comparing. GREEN THE DAY IT WAS WRITTEN, for the
   * reason `sectionIn`'s own guards were: what it pins is that the next reading
   * of this cannot quietly widen.
   */
  it("keeps everything else, so a Row that changed still differs", () => {
    const before = aPageOffering("Doctor Who");
    const rowChanged = before.replace("a Row", "another Row");

    expect(steadyMainOf(rowChanged)).not.toBe(steadyMainOf(before));
    expect(steadyMainOf(before)).toContain("a Row");
    expect(steadyMainOf(before)).toContain("Narrow to a kind");
  });

  /**
   * AND A PAGE WITH NO PICKER IS SAID SO RATHER THAN COMPARED ANYWAY. This is
   * the hazard that comes with cutting a region out at all: a picker that
   * vanished between two fetches -- or on the session-less fetch alone, which
   * is the posture `scope.test.ts` exists to check -- would leave two pages
   * that agree about everything still on them. A reading that shrugged at a
   * missing picker would pass that, and the regression would be invisible.
   */
  it("refuses a page whose picker is gone rather than comparing what is left", () => {
    const noPicker = "<main><h1>Catalogue</h1><ul><li>a Row</li></ul></main>";

    expect(() => steadyMainOf(noPicker)).toThrow(/Narrow to a Group/);
  });

  /**
   * AND A PAGE WITH TWO PICKERS IS REFUSED FOR THE MIRROR REASON. Cutting the
   * first of two leaves the SECOND inside the compared region -- catalogue-wide
   * state back where it started, silently, and passing every run until a Group
   * happens to arrive between two fetches. That is this ticket's own defect
   * wearing the guard that was supposed to end it, which is why `mainOf`
   * refuses two `<main>`s and this refuses two pickers.
   */
  it("refuses a page rendering two Group pickers rather than cutting only the first", () => {
    const twice = aPageOffering("Doctor Who").replace(
      "</nav>",
      '</nav><nav aria-label="Narrow to a Group"><a href="/?group=x">A second picker</a></nav>',
    );

    expect(() => steadyMainOf(twice)).toThrow(/more than one/);
  });
});
