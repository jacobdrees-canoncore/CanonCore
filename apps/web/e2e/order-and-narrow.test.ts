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
    expect(mainOf(text)).toContain("Nothing here is");
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
