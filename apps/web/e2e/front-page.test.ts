import { describe, expect, inject, it } from "vitest";

import { documentAt } from "./document";

/**
 * THE FRONT PAGE, over real HTTP. ADR-0103's fourth seam, which is the one
 * CNCORE-65 names: a page-over-HTTP assertion and no browser, because
 * everything this page renders is in the HTML the server returns.
 */
const itemId = inject("itemId");
const itemTitle = inject("itemTitle");

describe("/", () => {
  it("shows the catalogue", async () => {
    const { status, text } = await documentAt("/");

    expect(status).toBe(200);
    expect(text).toContain(itemTitle);
  });

  it("reaches an item at the address every other surface reaches it at", async () => {
    // THE PATH IS IDENTITY (ADR-0066), so the front page's link has to BE the
    // item's canonical address rather than a second spelling of it -- no
    // `?via=`, which names the ORDERING a reader arrived through and would be a
    // claim this page cannot make: nobody arrives at an item through the
    // catalogue in the sense a placement means.
    //
    // CHECKED AGAINST WHAT THE ITEM PAGE ITSELF DECLARES rather than against a
    // string written here. A constant in this file would agree with a front page
    // and an item page that had BOTH drifted; the page's own `rel=canonical` is
    // the other surface's answer to the same question.
    const { text } = await documentAt("/");
    const linked = [...text.matchAll(/href="(\/items\/[^"?]*)"/g)]
      .map(([, href]) => href)
      .find((href) => href?.endsWith(itemId));
    if (!linked) throw new Error(`the front page linked nothing at /items/${itemId}`);

    const arrived = await documentAt(linked);

    expect(arrived.status).toBe(200);
    expect(arrived.text).toContain(`<link rel="canonical" href="${linked}"/>`);
    expect(arrived.text).toContain(`<h1 class="text-3xl font-medium">${itemTitle}</h1>`);
  });
});
