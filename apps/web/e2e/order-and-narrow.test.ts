import { A_NARROWING } from "@canoncore/schemas";
import { describe, expect, inject, it } from "vitest";

import {
  aGroupArrivesAt,
  documentAt,
  logInAt,
  mainOf,
  markedCurrentIn,
  markedCurrentInPicker,
  pickedIn,
  steadyMainOf,
} from "./document";

/**
 * THE ORDER AND THE NARROWING IN THE ADDRESS (CNCORE-175), over real HTTP:
 * what a reader picked survives a reload and travels in a link somebody else
 * opens.
 *
 * THIS SEAM AND NOT A UNIT ONE, which is the dispatcher's call (2026-09-19):
 * the ticket's criterion is that both "travel in a shared link and survive a
 * reload", and only a page served over HTTP to a second reader with no session
 * can be asked that. A test of `queryFor` asserts the link this app WRITES; it
 * cannot assert what a reader who follows it is served.
 *
 * WHICH SURFACE OFFERS WHICH PICKER IS ASSERTED BY WHERE EACH IS PICKED FROM.
 * Order is on the two browsed Listings; the kind is on the Catalogue and on
 * Catalogue search, and NOT on work-browsing -- ADR-0077's predicate makes
 * every Row there a Work, so a picker would offer six options that answer
 * nothing. `pickedIn` throws where a picker is absent, so each loop below is
 * also the assertion that the picker is there at all.
 *
 * EVERY SURFACE IS NARROWED TO A GROUP FIRST, which is `scope.test.ts`'s own
 * arrangement and is load-bearing here rather than incidental. The files of
 * this suite share one catalogue and write to it concurrently, and the
 * recently-added order puts whatever arrived last at the TOP -- so two fetches
 * of `/?order=added` seconds apart are two different pages, and the
 * reload-and-share assertion below fails on a catalogue doing exactly what it
 * should. MEASURED: this test passed run alone and failed in the full suite,
 * `expected '<main ...>' to be '<main ...>'`. The seeded Group nobody writes to
 * is a Listing that holds still, and what is under test here is whether the
 * ADDRESS carries the choice -- never whether the catalogue is quiet.
 *
 * AND NARROWING REACHED THE ROWS ONLY, WHICH IS WHY IT WENT RED AGAIN
 * (CNCORE-271). A Group freezes this Listing's ROWS. It cannot freeze the Group
 * PICKER, which renders every Group there is, uncapped, and sits inside the
 * same `<main>` -- so the fix above was never sufficient, and the sentence it
 * is written in is corrected here rather than left standing. MEASURED
 * 2026-09-20: one full run failed on `/search?q=season&...&kind=person` with
 * `expected '<main ...>' to be '<main ...>'` again, and three later runs of the
 * same commit passed. `import-page.test.ts` creates three Groups on this
 * instance, which is where they come from.
 *
 * SO THE COMPARISON IS `steadyMainOf` AND THE TIMING IS FORCED. The picker is
 * cut out of what is compared, for the reason written beside that function
 * (CNCORE-253), and `aGroupArrivesAt` does deliberately what another file
 * was doing by accident -- between two fetches, every run, rather than once in
 * four.
 */
const ORDER = "Order this Listing";
const KIND = "Narrow to a kind";
/** The seeded Group whose Rows nobody writes to, as `scope.test.ts` uses it. */
const GROUP = `group=${inject("workBrowsing").group.id}`;

/**
 * Every address this document links, which is the sink a narrowing's ceiling
 * protects (CNCORE-284).
 *
 * READ AS BYTES RATHER THAN THROUGH `navIn`, deliberately: the copies under
 * test are spread into EVERY link `queryFor` writes -- two pickers, the walk
 * and the jump bar -- and asking one picker at a time would be asking whether
 * the value reached the links this test remembered to name.
 */
function hrefsIn(text: string): string[] {
  return [...text.matchAll(/href="([^"]*)"/g)].map(([, href]) => href ?? "");
}

/** The same page asked again, and asked by somebody with no session. */
async function reloadedAndShared(address: string, owner: string) {
  const seen = await documentAt(address, owner);
  // THE ADVERSARY, FORCED RATHER THAN WAITED FOR: what `import-page.test.ts`
  // does to this instance by accident, and what CNCORE-271 was.
  await aGroupArrivesAt(inject("baseUrl"), owner);
  const reloaded = await documentAt(address, owner);
  // NO SESSION, which is what makes it a SHARED link rather than a remembered
  // one: a choice held in a session would pass the reload and fail this.
  const shared = await documentAt(address);

  expect(seen.status, address).toBe(200);
  expect(steadyMainOf(reloaded.text), address).toBe(steadyMainOf(seen.text));
  expect(steadyMainOf(shared.text), address).toBe(steadyMainOf(seen.text));
  /*
   * AND WHAT THE GROUP PICKER SAYS, which `steadyMainOf` stops comparing as
   * bytes and this keeps as a FACT: the scope the address names is the one
   * marked current, for the Owner, on a reload and for a reader with no
   * session. That is the half of the picker the address really does decide,
   * and it does not depend on how many Groups exist.
   */
  expect(markedCurrentIn(reloaded.text), address).toStrictEqual(markedCurrentIn(seen.text));
  expect(markedCurrentIn(shared.text), address).toStrictEqual(markedCurrentIn(seen.text));
  return seen;
}

describe("the order a reader picked", () => {
  it("survives a reload, and a link to it opens the same page for anybody", async () => {
    const owner = await logInAt(inject("baseUrl"), inject("ownerPassword"));

    for (const surface of [`/?${GROUP}`, `/works?${GROUP}`]) {
      const ordered = pickedIn((await documentAt(surface, owner)).text, ORDER, "Recently added");
      expect(ordered, surface).toContain("order=added");
      // THE GROUP IS STILL ON IT, which is the other half of "keeps everything
      // else": an order picked inside a scope must not walk the reader out of it.
      expect(ordered, surface).toContain(GROUP);

      const seen = await reloadedAndShared(ordered, owner);
      expect(markedCurrentInPicker(seen.text, ORDER), ordered).toStrictEqual(["Recently added"]);
    }
  });
});

describe("the kind a reader narrowed to", () => {
  it("survives a reload, and a link to it opens the same page for anybody", async () => {
    const owner = await logInAt(inject("baseUrl"), inject("ownerPassword"));

    // THE CATALOGUE AND CATALOGUE SEARCH, which are the two whose kinds differ.
    // Search carries its query through the narrowing, which is the half that
    // would break if the picker wrote this Listing's start without `q`.
    for (const surface of [`/?${GROUP}`, `/search?q=season&${GROUP}`]) {
      const narrowed = pickedIn((await documentAt(surface, owner)).text, KIND, "Person");
      expect(narrowed, surface).toContain("kind=person");
      expect(narrowed, surface).toContain(GROUP);

      const seen = await reloadedAndShared(narrowed, owner);
      expect(markedCurrentInPicker(seen.text, KIND), narrowed).toStrictEqual(["Person"]);
    }
  });

  it("is not offered on work-browsing, where every Row is a Work already", async () => {
    // ADR-0077's predicate is `kind = 'work' AND (NOT is_container OR
    // holds_work)`, so a kind picker here could only offer six options that
    // answer nothing and a seventh that changes nothing.
    const { text } = await documentAt("/works");

    expect(text).toContain('aria-label="Order this Listing"');
    expect(text).not.toContain('aria-label="Narrow to a kind"');
  });
});

describe("a Listing narrowed to a kind it holds none of", () => {
  it("says which emptiness it is, rather than that the catalogue is empty", async () => {
    // THE LIE THIS REPLACES: `WhatToDoNext` says CanonCore ships no catalogue
    // and offers the routes that fill one, which is a claim about the INSTALL.
    // A reader who narrowed to a kind the catalogue holds none of was being
    // told their catalogue was empty while it held everything it always had.
    // The rule already existed for a Group -- "an empty GROUP must not offer
    // those routes, because the catalogue it was narrowed out of may hold
    // thousands of Items" -- and a kind is the same fact on the other axis.
    //
    // `concept` IS THE KIND CHOSEN BECAUSE NOTHING SEEDS ONE. This instance
    // holds a Work, a Person, a Character and a Time span, so narrowing to any
    // of those leaves Rows on the page and asserts nothing about an empty one.
    const { status, text } = await documentAt(`/?${GROUP}&kind=concept`);

    expect(status).toBe(200);
    // THE RESOLVED LABEL AND NOT THE BARE STEM (CNCORE-281). `concept` IS a
    // kind, so this heading names it -- and "Nothing here is" alone now also
    // matches "Nothing here is of that kind", the heading for a kind that is
    // no kind at all. Asserting the stem would pass on either, which is one
    // test covering two states and telling them apart on neither.
    expect(mainOf(text)).toContain("Nothing here is Concept");
    expect(mainOf(text)).not.toContain("ships no catalogue");
    // AND THE WAY OUT IS ON THE PAGE, which is what makes it a state rather
    // than a dead end.
    expect(mainOf(text)).toContain("Show every kind");
  });
});

describe("the order and the kind together", () => {
  it("are cleared one at a time, each without clearing the other", async () => {
    const owner = await logInAt(inject("baseUrl"), inject("ownerPassword"));

    // BOTH PICKED IN TURN, so the second is picked from a page the first
    // already ordered -- which is what asserts that neither drops the other.
    // Picking them independently from the start would pass against a pair of
    // controls that each cleared the other.
    const ordered = pickedIn((await documentAt(`/?${GROUP}`, owner)).text, ORDER, "Recently added");
    const both = pickedIn((await documentAt(ordered, owner)).text, KIND, "Person");
    expect(both).toContain("order=added");
    expect(both).toContain("kind=person");

    // CLEARING ONE LEAVES THE OTHER, which is the whole of "narrows it to one
    // kind and clears the narrowing again": a reader who clears the kind has
    // not asked for the order back.
    const kindCleared = pickedIn((await documentAt(both, owner)).text, KIND, "Every kind");
    expect(kindCleared).toContain("order=added");
    expect(kindCleared).not.toContain("kind=");

    const orderCleared = pickedIn((await documentAt(both, owner)).text, ORDER, "By name");
    expect(orderCleared).toContain("kind=person");
    expect(orderCleared).not.toContain("order=");
  });
});

describe("a Listing narrowed to a kind that is not a kind at all", () => {
  it("does not speak a crafted word in its own voice", async () => {
    // A QUERY IS COMPOSED BY ANYBODY (ADR-0123). `oneKind` passes any string
    // deliberately -- the seven kinds are the DATABASE's rather than this
    // repository's -- so the page cannot tell a typo from a forged link, and
    // it is the FORGED one that decides what this heading may do. Echoed, a
    // link somebody else composed puts their sentence inside this app's `h2`,
    // under this app's styling, on this app's page.
    //
    // A CRAFTED SENTENCE RATHER THAN `?kind=banana`. The block above drives
    // `?kind=concept` -- a REAL kind this catalogue holds none of, which is a
    // different state from this one and names its label in the heading. What
    // is under test here is the kind that is no kind at all, and a one-word
    // `banana` would pass an assertion that the echo is gone while proving
    // nothing about the harm: ADR-0123's is a value shaped like something the
    // catalogue would say.
    //
    // LOWER CASE, because `oneKind` lowercases what it reads -- a crafted
    // value with capitals in it would be absent from the page in that
    // spelling whether or not the echo is, and would pass without the fix.
    //
    // NO MARKUP, BUT NOT BECAUSE REACT ESCAPES IT. `documentAt` un-escapes
    // what it reads, deliberately, so `&lt;b&gt;` arrives back as `<b>` and a
    // tag WOULD be caught here. It is left out because the harm ADR-0123
    // names is a sentence in this app's voice, and a reader meets that as
    // prose rather than as markup that never renders.
    const crafted = "unavailable in your region. pay to restore access";
    const { status, text } = await documentAt(`/?${GROUP}&kind=${encodeURIComponent(crafted)}`);
    const main = mainOf(text);

    expect(status).toBe(200);
    // THE PAGE'S PROSE, AND NOT EVERY BYTE OF IT. The crafted value is still
    // in this document, percent-encoded, inside the `?kind=` every picker and
    // walk link carries forward -- which is the address being kept, not a
    // sentence, and is what those links are for. The spaces are why the two do
    // not collide here: `crafted` holds them literally and an `href` holds
    // `%20`. So this reaches the heading and would NOT catch an echo that had
    // been URL-encoded first. Bounding that copy is a separate question from
    // whose voice the page speaks in.
    //
    // AND CNCORE-284 HAS ANSWERED THAT QUESTION, WHICH DOES NOT MAKE THE COPY
    // GO AWAY (ADR-0182). The ceiling bounds HOW MUCH may be carried, not
    // WHETHER: `crafted` is 48 characters, well inside `A_NARROWING`, so it
    // still travels in every `href` on this page -- deliberately, because
    // carrying the reader's narrowing forward is what those links are for. What
    // the ceiling ends is the copy whose SIZE a stranger picks, and the test
    // below drives that one.
    expect(main).not.toContain(crafted);

    // AND IT IS STILL THE RIGHT EMPTINESS, which is what stops the fix being
    // "render nothing". The three wrong answers are all reachable from here:
    // the install-level notice (`WhatToDoNext`), the Group's own emptiness --
    // false, since this Group holds Rows that a real kind would show -- and a
    // blank page with no way out of the narrowing.
    expect(main).toContain("Nothing here is of that kind");
    expect(main).toContain("Show every kind");
    expect(main).not.toContain("ships no catalogue");
    expect(main).not.toContain("holds nothing yet");
  });

  /*
   * AND A NARROWING PAST THE CEILING REACHES NO LINK ON THE PAGE (CNCORE-284,
   * ADR-0182).
   *
   * THE `href`s RATHER THAN THE WHOLE DOCUMENT, and the difference was MEASURED
   * rather than reasoned about. This assertion was first written over `text`
   * entire and went red with the ceiling in place: Next serialises the address
   * it was asked for into the RSC flight payload -- `0:{"P":null,"c":["","?group=
   * ...&kind=..."]}` -- so the request URL is echoed there three times whatever
   * this app does with the parameter. That echo is NEXT'S copy of the address,
   * not a link CanonCore wrote, and it is a CONSTANT three rather than one per
   * Group: the harm CNCORE-284 describes is the document growing with the shape
   * of the catalogue, and that is what the ceiling ends. ADR-0182 records the
   * residue rather than this test hiding it.
   *
   * THE SINK IS EVERY `href`: `Everything`, each Group's link, both order links
   * and the `#` entry CNCORE-242 added, each spread from `walking.chosen` by
   * `queryFor`. That is where one copy per Group came from.
   *
   * AN ALPHANUMERIC NEEDLE, SO ONE ASSERTION CATCHES BOTH SPELLINGS. The test
   * above needed prose to reach a heading and was blind to the encoded copies
   * for exactly that reason: its spaces are `%20` in an `href`. This value
   * percent-encodes to itself, so a copy in a link and a copy in a sentence are
   * the same needle and neither hides behind the other.
   *
   * BOTH SIDES OF THE CEILING IN ONE TEST, because only the pair says what was
   * built. A kind INSIDE the bound is still carried into every link -- that is
   * what those links are for -- and asserting only the absence would pass just
   * as well against a page that had stopped carrying narrowings at all.
   *
   * THE PAGE IS THE LISTING UNNARROWED, which is the other half of the decision.
   * `oneKind` answers nothing past the bound, so the address records no
   * narrowing and the picker describes the page that was served. "Nothing here
   * is of that kind" would mean a narrowing had been honoured and its value
   * hidden, which is not what was built.
   */
  it("carries a kind past the ceiling into no link, and one inside it into every link", async () => {
    const flood = "kindflood".repeat(Math.ceil((A_NARROWING + 1) / "kindflood".length));
    expect(flood.length).toBeGreaterThan(A_NARROWING);

    const { status, text } = await documentAt(`/?${GROUP}&kind=${encodeURIComponent(flood)}`);
    expect(status).toBe(200);

    const flooded = hrefsIn(text);
    // THE PREMISE IS PINNED: a page writing no links at all would satisfy the
    // assertion below while proving nothing. `/` carries the pickers, the walk
    // and the jump bar, so this floor is far under what it serves.
    expect(flooded.length).toBeGreaterThan(10);
    // NOT AN OPENING OF IT EITHER, which is why the needle is the REPEATED unit
    // rather than the whole value: a cut at `A_NARROWING` leaves eleven whole
    // `kindflood`s in every one of those links, so this line reddens against
    // the answer ADR-0182 refused as readily as against no bound at all.
    // Mutation-checked, both ways.
    expect(flooded.filter((href) => href.includes("kindflood"))).toStrictEqual([]);

    // AND `kind=` ITSELF IS NOT THE TEST, because the kind PICKER writes one
    // into each option it offers -- that is the picker working. What says the
    // narrowing was dropped is which option the picker marks CURRENT, below.

    const main = mainOf(text);
    expect(main).not.toContain("Nothing here is of that kind");
    expect(markedCurrentInPicker(main, KIND)).toStrictEqual(["Every kind"]);

    // AND THE SAME PAGE, ASKED WITH A KIND INSIDE THE BOUND, CARRIES IT.
    const narrowed = await documentAt(`/?${GROUP}&kind=person`);
    expect(hrefsIn(narrowed.text).some((href) => href.includes("kind=person"))).toBe(true);
  });
});
