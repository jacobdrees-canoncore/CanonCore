import { describe, expect, inject, it } from "vitest";

import { documentAt } from "./document";

/**
 * WORK-BROWSING, over real HTTP. ADR-0103's fourth seam, which is the one
 * CNCORE-67 names: a page-over-HTTP assertion and no browser, because
 * everything this page renders is in the HTML the server returns.
 *
 * ADR-0077 is the record under test and it names both ways of getting this
 * wrong -- "either people flood the browse grid, or the containers that
 * justified the single-table decision cannot be built". Every assertion below
 * is one of those two.
 */
const workBrowsing = inject("workBrowsing");

describe("/works", () => {
  it("shows a work and not a person", async () => {
    // The failure this surface exists to prevent, in the record's own words:
    // "what can I watch" answerable without the grid filling with cast members.
    const { status, text } = await documentAt("/works");

    expect(status).toBe(200);
    expect(text).toContain(workBrowsing.story);
    expect(text).not.toContain(workBrowsing.person);
  });
});
