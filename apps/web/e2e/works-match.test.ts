import { createDb, matchCandidates } from "@canoncore/db";
import { anItemTitled, theOwner } from "@canoncore/db/testing/catalogue";
import { beforeAll, describe, expect, inject, it } from "vitest";

import { clientAt, documentAt, logInAt, textOf } from "./document";
import { HARNESS_CONNECTIONS } from "./instance";

/**
 * WHAT THE ITEM PAGE SAYS WHEN TWO PROVIDERS DISAGREE ABOUT INSTALMENTS (CNCORE-361),
 * read out of the served bytes rather than out of the absence of a wrong match.
 *
 * The wiki holds *The Tenth Planet* as one story; TMDB holds it as four instalments,
 * `The Tenth Planet (1)` to `(4)` in `tv/121` season 4 (read 2026-09-26, and
 * cached TMDB content under ADR-0036 for that reason). Instalment 1 carries the
 * story's title AND its date, so title and date alone would match it.
 * CNCORE-368's finding makes it a NO MATCH, and the page has to say why TMDB's
 * claims are not on this Item.
 */
const TMDB_SEASON_4 = "season:121:4";
const INSTALMENTS = 4;
const SENTENCE = `provider-tmdb holds this as ${INSTALMENTS} instalments, and no single one of them was matched to this Item.`;

const imported = inject("imported");

beforeAll(async () => {
  const cookie = await logInAt(inject("baseUrl"), inject("ownerPassword"));
  // TMDB'S SEASON, BROWSED FOR REAL: in CI the real image answers, reaching
  // TMDB's own API. The wiki's *The Tenth Planet* is already here, imported by
  // `global-setup.ts` through the app.
  await clientAt(inject("baseUrl"), cookie).provider.browse({
    baseUrl: inject("providerTmdbUrl"),
    containerId: TMDB_SEASON_4,
  });
});

describe("a story one Provider holds as several of the other's instalments", () => {
  it("says so where the Item lists each Provider's claims", async () => {
    const { status, text } = await documentAt(`/items/${imported.id}`);

    expect(status).toBe(200);
    expect(textOf(text)).toContain(SENTENCE);
  });

  /*
   * AND ON A ROW THAT OFFERS A CANDIDATE, so a reader meets the disagreement
   * before confirming as well as after.
   *
   * THE PAIR IS WRITTEN BY HAND, and for a measured reason rather than for
   * convenience: no real pair has both halves. Over every wiki story of the
   * 1963 and 2005 series against every TMDB episode of `tv/121` and
   * `tv/57243`, Specials included, no story that TMDB holds as instalments also
   * scores between the bars against a single episode (measured 2026-09-26). So
   * this Item offers the story by hand, exactly as `recordWhatWasNotApplied`
   * would write it, and what is asserted is what the page then says.
   */
  it("says so again on the row that offers that story as a candidate", async () => {
    const db = createDb(inject("databaseUrl"), { maxConnections: HARNESS_CONNECTIONS });
    try {
      const offering = await anItemTitled(db, "Behind the Sofa: The Tenth Planet");
      await db.insert(matchCandidates).values({
        ownerId: await theOwner(db),
        itemId: offering,
        candidateItemId: imported.id,
        score: 0.7,
        titleSignal: "subtitle",
        releasedSignal: "same",
      });

      const { status, text } = await documentAt(`/items/${offering}`);

      expect(status).toBe(200);
      const queue = text.slice(text.indexOf('id="review-queue"'));
      expect(textOf(queue)).toContain(SENTENCE);
    } finally {
      await db.$client.end();
    }
  });
});
