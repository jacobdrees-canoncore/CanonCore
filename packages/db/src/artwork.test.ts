import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  artwork as artworkTable,
  type Database,
  type FetchedArtwork,
  findArtworkOfItem,
  importProvidedRecord,
  properties,
  purgeProvider,
  readArtwork,
} from "./index";
import { connect } from "./testing/catalogue";

let db: Database;

beforeAll(async () => {
  db = await connect();
});

const wikiProvider = (identity: string, maxCacheAge: number | null = null) => ({
  identity,
  label: "provider-wiki",
  attribution: null,
  maxCacheAge,
});

const aRecord = (externalId: string) => ({
  externalId,
  title: "The Tenth Planet (TV story)",
  released: [],
  identifiers: {},
  itemKind: "work" as const,
});

/** Eight bytes of a PNG signature: what is asserted is that they come back unchanged. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const aPageImage = (overrides: Partial<FetchedArtwork> = {}) => ({
  role: "page image",
  url: "https://tardis.wiki/wiki/Special:FilePath/Tenth_planet.jpg?width=420",
  licences: ["Screenshot"],
  attribution: "https://tardis.wiki/wiki/File:Tenth_planet.jpg",
  bytes: PNG,
  mediaType: "image/png" as const,
  ...overrides,
});

describe("a picture a provider supplied (ADR-0037, ADR-0038)", () => {
  it("is stored as bytes, with its role, its licences and the credit that belongs to that file", async () => {
    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider("http://127.0.0.1:9601"),
      record: aRecord("265"),
      artwork: [aPageImage()],
    });

    const [artwork, ...more] = await findArtworkOfItem(db, itemId);
    expect(more).toEqual([]);
    expect(artwork).toMatchObject({
      role: "page image",
      licences: ["Screenshot"],
      attribution: "https://tardis.wiki/wiki/File:Tenth_planet.jpg",
      sourceLabel: "provider-wiki",
    });

    const stored = await readArtwork(db, artwork?.id ?? "");
    expect(stored?.mediaType).toBe("image/png");
    expect(new Uint8Array(stored?.bytes ?? [])).toEqual(PNG);
  });

  /**
   * AN EMPTY SET IS THE SOURCE STATING NONE, and it must come back as one. A
   * null here would read as "not recorded", and a reader of an absent licence
   * fills it with whatever they hoped it said.
   */
  it("records a source stating no licence as an empty set, never as nothing", async () => {
    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider("http://127.0.0.1:9602"),
      record: aRecord("265"),
      artwork: [aPageImage({ licences: [], attribution: null })],
    });

    const [artwork] = await findArtworkOfItem(db, itemId);
    expect(artwork?.licences).toEqual([]);
    expect(artwork?.attribution).toBeNull();
  });

  it("is replaced by the picture a later import brings for the same role", async () => {
    const provider = wikiProvider("http://127.0.0.1:9603");
    await importProvidedRecord(db, { provider, record: aRecord("265"), artwork: [aPageImage()] });
    const { itemId } = await importProvidedRecord(db, {
      provider,
      record: aRecord("265"),
      artwork: [aPageImage({ licences: ["Illustration"] })],
    });

    expect((await findArtworkOfItem(db, itemId)).map((artwork) => artwork.licences)).toEqual([
      ["Illustration"],
    ]);
  });

  /**
   * A PICTURE THAT DID NOT ARRIVE THIS TIME IS NOT WITHDRAWN. A fetch can fail
   * for a reason that is nothing to do with the record -- the wiki slow, a
   * redirect refused -- and a refresh must not take the stored picture with it.
   */
  it("is kept when a later import brings none for its role", async () => {
    const provider = wikiProvider("http://127.0.0.1:9604");
    await importProvidedRecord(db, { provider, record: aRecord("265"), artwork: [aPageImage()] });
    const { itemId } = await importProvidedRecord(db, {
      provider,
      record: aRecord("265"),
      artwork: [],
    });

    expect(await findArtworkOfItem(db, itemId)).toHaveLength(1);
  });

  /**
   * EXPIRY IS A READ-TIME CHECK AGAINST THE SOURCE'S DECLARED CEILING (ADR-0037),
   * CNCORE-360's rule for a claim applied to a picture, so a licence is honoured
   * whether or not any job has run. TMDB forbids
   * keeping its content past six months (ADR-0036), and a picture past its
   * source's `max_cache_age` is neither laid out nor served.
   */
  it("is neither laid out nor served once its source's ceiling has passed", async () => {
    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider("http://127.0.0.1:9606", 1),
      record: aRecord("265"),
      artwork: [aPageImage()],
    });
    const [artwork] = await findArtworkOfItem(db, itemId);
    expect(artwork).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 1_100));

    expect(await findArtworkOfItem(db, itemId)).toEqual([]);
    expect(await readArtwork(db, artwork?.id ?? "")).toBeNull();

    // AND THE BYTES DO NOT OUTLIVE THE NEXT IMPORT, OF ANYTHING. A picture kept
    // past its ceiling is still kept, whether or not anybody sees it, so an
    // import is where the expired ones are deleted. The row is asked for
    // directly because what is asserted is the storage, which no reader shows.
    await importProvidedRecord(db, {
      provider: wikiProvider("http://127.0.0.1:9607"),
      record: aRecord("266"),
    });
    expect(
      await db
        .select()
        .from(artworkTable)
        .where(eq(artworkTable.id, artwork?.id ?? "")),
    ).toEqual([]);
  });

  it("goes with its provider when that provider is purged", async () => {
    const identity = "http://127.0.0.1:9605";
    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider(identity),
      record: aRecord("265"),
      artwork: [aPageImage()],
    });
    const [artwork] = await findArtworkOfItem(db, itemId);

    await purgeProvider(db, { identity });

    expect(await readArtwork(db, artwork?.id ?? "")).toBeNull();
  });
});

/**
 * THE SEEDED `image` PROPERTY IS GONE (CNCORE-358), removed by a new rung rather
 * than by editing migration 1. It declared artwork a Statement, which ADR-0012
 * and ADR-0038 both refuse, and nothing ever wrote it.
 *
 * NAMED AND COUNTED, because a count alone passes when the wrong one goes.
 */
describe("the catalogue's properties", () => {
  it("are the twelve the product declares, and `image` is not among them", async () => {
    const declared = (await db.select({ name: properties.name }).from(properties))
      .map((property) => property.name)
      .sort();

    expect(declared).toEqual([
      "appears_in",
      "based_on",
      "category",
      "created_by",
      "credited_to",
      "external_id",
      "note",
      "part_of",
      "portrayed_by",
      "released",
      "sort_name",
      "title",
    ]);
  });
});
