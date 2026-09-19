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
 * THE TWO PICKERS ARE FOLLOWED IN TURN, so the second is picked from a page the
 * first already ordered -- which is what asserts that neither drops the other.
 * Picking them independently from the start of the Listing would pass against a
 * pair of controls that each cleared the other.
 */
const ORDER = "Order this Listing";
const KIND = "Narrow to a kind";

describe("the order and the kind a reader picked", () => {
  it("survive a reload, and a link to them opens the same page for anybody", async () => {
    const owner = await logInAt(inject("baseUrl"), inject("ownerPassword"));

    for (const surface of ["/", "/works"]) {
      const ordered = pickedIn((await documentAt(surface, owner)).text, ORDER, "Recently added");
      const narrowed = pickedIn((await documentAt(ordered, owner)).text, KIND, "Person");

      // THE SECOND PICK KEPT THE FIRST, which is the half a picker written as
      // "this Listing's start with my parameter on it" gets wrong: the kind
      // picker's links are that start, and the order is part of it.
      expect(narrowed, surface).toContain("order=added");
      expect(narrowed, surface).toContain("kind=person");

      const seen = await documentAt(narrowed, owner);
      const reloaded = await documentAt(narrowed, owner);
      // NO SESSION, which is what makes it a SHARED link rather than a
      // remembered one: a choice held in a session would pass the reload and
      // fail this.
      const shared = await documentAt(narrowed);

      expect(seen.status, narrowed).toBe(200);
      expect(markedCurrentInPicker(seen.text, ORDER), narrowed).toStrictEqual(["Recently added"]);
      expect(markedCurrentInPicker(seen.text, KIND), narrowed).toStrictEqual(["Person"]);
      expect(mainOf(reloaded.text)).toBe(mainOf(seen.text));
      expect(mainOf(shared.text)).toBe(mainOf(seen.text));
    }
  });

  it("are cleared back to the Listing's own start, each without clearing the other", async () => {
    const owner = await logInAt(inject("baseUrl"), inject("ownerPassword"));

    const ordered = pickedIn((await documentAt("/", owner)).text, ORDER, "Recently added");
    const both = pickedIn((await documentAt(ordered, owner)).text, KIND, "Person");

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
