import { describe, expect, inject, it } from "vitest";

import { documentAt, logInAt, mainOf, markedCurrentInPicker, pickedIn } from "./document";

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
 */
const ORDER = "Order this Listing";
const KIND = "Narrow to a kind";

/** The same page asked again, and asked by somebody with no session. */
async function reloadedAndShared(address: string, owner: string) {
  const seen = await documentAt(address, owner);
  const reloaded = await documentAt(address, owner);
  // NO SESSION, which is what makes it a SHARED link rather than a remembered
  // one: a choice held in a session would pass the reload and fail this.
  const shared = await documentAt(address);

  expect(seen.status, address).toBe(200);
  expect(mainOf(reloaded.text), address).toBe(mainOf(seen.text));
  expect(mainOf(shared.text), address).toBe(mainOf(seen.text));
  return seen;
}

describe("the order a reader picked", () => {
  it("survives a reload, and a link to it opens the same page for anybody", async () => {
    const owner = await logInAt(inject("baseUrl"), inject("ownerPassword"));

    for (const surface of ["/", "/works"]) {
      const ordered = pickedIn((await documentAt(surface, owner)).text, ORDER, "Recently added");
      expect(ordered, surface).toContain("order=added");

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
    for (const surface of ["/", "/search?q=season"]) {
      const narrowed = pickedIn((await documentAt(surface, owner)).text, KIND, "Person");
      expect(narrowed, surface).toContain("kind=person");

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

describe("the order and the kind together", () => {
  it("are cleared one at a time, each without clearing the other", async () => {
    const owner = await logInAt(inject("baseUrl"), inject("ownerPassword"));

    // BOTH PICKED IN TURN, so the second is picked from a page the first
    // already ordered -- which is what asserts that neither drops the other.
    // Picking them independently from the start would pass against a pair of
    // controls that each cleared the other.
    const ordered = pickedIn((await documentAt("/", owner)).text, ORDER, "Recently added");
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
