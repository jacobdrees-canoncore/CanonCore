import { describe, expect, it } from "vitest";

import { cmppManifest, cmppRecord, picturesToFetch } from "./index";

/**
 * WHICH OF A RECORD'S IMAGE REFERENCES ARE FETCHED, under the provider's own
 * declared `per_role_limit` (ADR-0033, CNCORE-358).
 *
 * THE LIMIT IS HONOURED AT FETCH TIME because ADR-0037 says it cannot wait: what
 * was not chosen is never fetched, so fetching everything and trimming later is
 * the same breach with a delay on it.
 */
const aRecord = (images: { role: string; url: string }[]) =>
  cmppRecord.parse({
    id: "1",
    title: "The Tenth Planet",
    kind: "TV story",
    url: "https://tardis.wiki/wiki/The_Tenth_Planet",
    images,
  });

const declaring = (per_role_limit: number) =>
  cmppManifest.parse({
    name: "provider-wiki",
    operations: ["search", "lookup"],
    images: { stored_variant: null, per_role_limit, quality_floor: 0 },
  });

const pageImage = (n: number) => ({ role: "page image", url: `https://tardis.wiki/${n}.jpg` });

describe("the pictures fetched for a record", () => {
  it("stop at the declared limit for a role", () => {
    const record = aRecord([1, 2, 3, 4, 5, 6, 7].map(pageImage));

    expect(picturesToFetch(record, declaring(5)).map((image) => image.url)).toEqual(
      [1, 2, 3, 4, 5].map((n) => `https://tardis.wiki/${n}.jpg`),
    );
  });

  /**
   * THE CASE THAT PASSES EVERY OTHER TEST WHEN IT IS WRONG. `0` is a provider
   * DECLARING that it serves no images; a fetcher reading it as "no limit set"
   * stops at five above and fetches everything here.
   */
  it("are none at all where the provider declares a limit of zero", () => {
    const record = aRecord([1, 2].map(pageImage));

    expect(picturesToFetch(record, declaring(0))).toEqual([]);
  });

  it("are counted per role, so one role's pictures do not use up another's", () => {
    const record = aRecord([
      { role: "poster", url: "https://image.tmdb.org/p/w500/a.jpg" },
      { role: "poster", url: "https://image.tmdb.org/p/w500/b.jpg" },
      { role: "backdrop", url: "https://image.tmdb.org/p/w780/c.jpg" },
    ]);

    expect(picturesToFetch(record, declaring(1)).map((image) => image.url)).toEqual([
      "https://image.tmdb.org/p/w500/a.jpg",
      "https://image.tmdb.org/p/w780/c.jpg",
    ]);
  });

  /**
   * AND A RECORD'S TOTAL IS CAPPED TOO, because the limit is per ROLE and roles
   * are the source's own words: a provider naming a thousand roles would
   * otherwise have a thousand pictures fetched at once for one record.
   */
  it("stop at eight for a record, however many roles it names", () => {
    const record = aRecord(
      Array.from({ length: 20 }, (_, n) => ({
        role: `role ${n}`,
        url: `https://tardis.wiki/${n}.jpg`,
      })),
    );

    expect(picturesToFetch(record, declaring(5))).toHaveLength(8);
  });

  /**
   * A MANIFEST WITH NO IMAGE POLICY HAS DECLARED NO LIMIT, and an undeclared
   * limit is not an unlimited one. CMPP makes the block optional; a provider
   * that leaves it out has said nothing about what may be fetched, so nothing is.
   */
  it("are none where the provider declares no image policy at all", () => {
    const record = aRecord([pageImage(1)]);
    const manifest = cmppManifest.parse({
      name: "provider-wiki",
      operations: ["search", "lookup"],
    });

    expect(picturesToFetch(record, manifest)).toEqual([]);
  });
});
