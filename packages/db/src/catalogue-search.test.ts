import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { type Database, items, likePattern, searchCatalogue } from "./index";
import { anItemTitled, connect } from "./testing/catalogue";

/**
 * THE ESCAPE RULE, which is CNCORE-24's rule from `provider-wiki` matched term
 * for term so that it is one rule in two repositories rather than two.
 *
 * These are LITERALS rather than a second computation of the pattern. An
 * assertion that built the expected string the way the helper does could not
 * disagree with it -- and the ORDER of the replacements is the whole content of
 * this rule, so the test has to know the answer independently. The answers here
 * are read off PostgreSQL's `LIKE` semantics: `\` is the default escape
 * character, so `\%` in a pattern matches a literal per cent and `\\` matches a
 * literal backslash.
 */
describe("likePattern", () => {
  it("treats a per cent sign as text rather than as a wildcard", () => {
    expect(likePattern("100%")).toBe("%100\\%%");
  });

  it("treats an underscore as text rather than as a single-character wildcard", () => {
    expect(likePattern("sort_name")).toBe("%sort\\_name%");
  });

  it("escapes the BACKSLASH FIRST, which is the whole of the rule", () => {
    // THE ORDER IS THE RULE, and this is the one input that can tell a correct
    // implementation from a plausible one. Escaping the metacharacters before
    // the backslash re-escapes the backslashes those replacements just added,
    // which turns the per cent back into a wildcard.
    //
    // `\%` typed by a reader is a backslash followed by a per cent, and both
    // are text. Backslash first: `\` -> `\\`, then `%` -> `\%`, giving
    // `\\\%` -- which PostgreSQL reads as "a literal backslash, then a
    // literal per cent". Per cent first: `%` -> `\%` gives `\\%`, and the
    // backslash pass then doubles BOTH of those backslashes to `\\\\%`,
    // which reads as "two literal backslashes, then MATCH ANYTHING". Wrong
    // about the per cent and wrong about how many backslashes, from one
    // transposition.
    expect(likePattern("\\%")).toBe("%\\\\\\%%");
  });
});

let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("searchCatalogue", () => {
  it("finds a Work by a word inside its title", async () => {
    // INSIDE, not at the front. Prefix matching is what a `LIKE 'x%'` index
    // would give and it is not enough for a search box: `websearch_to_tsquery`
    // answers nothing at all for a fragment, which is why this is a trigram
    // index rather than full-text search (measured under CNCORE-66).
    const id = await anItemTitled(db, "The Dalek Invasion of Earth");

    const { entries } = await searchCatalogue(db, { query: "Invasion", limit: 100 });

    expect(entries).toContainEqual(expect.objectContaining({ id }));
  });

  it("finds an Entity as readily as a Work", async () => {
    // A Character's name has to work as well as a Work's, which is the half
    // that separates Catalogue search from work-browsing. ADR-0077 excludes the
    // entity kinds from the surface answering "what can I watch"; this surface
    // asks "where is the thing I am thinking of", and the answer is often a
    // person or a character.
    const character = await anItemTitled(db, "Sarah Jane Smith", { kind: "character" });

    const { entries } = await searchCatalogue(db, { query: "Sarah Jane", limit: 100 });

    expect(entries).toContainEqual(expect.objectContaining({ id: character }));
  });

  it("answers an empty query with nothing, rather than with the whole catalogue", async () => {
    // MEASURED, NOT ASSUMED: an escaped empty query is the pattern `%%`, which
    // matches every row that has a title at all. So the accidental behaviour of
    // an empty search box is a full scan of the catalogue returned as though it
    // were a result set -- the most expensive query this surface can run,
    // reached by pressing Enter on an empty box.
    //
    // NOTHING is the deliberate answer rather than EVERYTHING, because the
    // front page already answers "what is in this catalogue" and a search that
    // duplicated it would be a second surface giving the same reply to a
    // different question.
    await anItemTitled(db, "An item that exists to be not found");

    expect(await searchCatalogue(db, { query: "", limit: 100 })).toEqual({
      entries: [],
      total: 0,
    });
  });

  it("treats a query of nothing but spaces as empty too", async () => {
    // A reader who hits the space bar and then Enter has typed nothing, and the
    // pattern `% %` is not what they asked for either -- it matches every title
    // with a space anywhere in it, which is most of them.
    //
    // ONE SPACE RATHER THAN THREE. Written with three this passed against the
    // unfixed code, because no title in the fixtures happens to contain three
    // consecutive spaces -- a green that said nothing about the short circuit.
    expect(await searchCatalogue(db, { query: " ", limit: 100 })).toEqual({
      entries: [],
      total: 0,
    });
  });

  it("treats a metacharacter in the query as text, not as a wildcard", async () => {
    // THE HELPER ON THE ACTUAL PATH, which is what the unit tests above cannot
    // prove: they say the pattern is right, and this says the query uses it.
    //
    // THE PAIR IS WHAT GIVES IT TEETH. Unescaped, `100%` becomes `%100%%` --
    // "100 followed by anything" -- which matches BOTH of these. Only the
    // escaped pattern can tell them apart, so a search that quietly stopped
    // escaping fails here rather than looking slightly more generous.
    const literal = await anItemTitled(db, "100% Dalek");
    const wildcard = await anItemTitled(db, "1000 Daleks and counting");

    const { entries } = await searchCatalogue(db, { query: "100%", limit: 100 });
    const found = entries.map((entry) => entry.id);

    expect(found).toContain(literal);
    expect(found).not.toContain(wildcard);
  });

  it("says which kind each result is, so two things sharing a name are told apart", async () => {
    // THE TICKET'S OWN CASE. A Person and a Work can share a name exactly --
    // an author and the book, a composer and the piece -- and a result list
    // that only printed the name would show two identical rows and leave the
    // reader to guess. What separates them is the kind.
    //
    // THE READER'S WORD, NOT THE COLUMN. `CONTEXT.md` is binding on UI copy and
    // `item_kinds` seeds the label beside the key for exactly this (migration
    // 1), so a result printing `time_span` would be showing a reader the
    // schema. `Person` is a capital away from `person`, so the assertion is
    // made on `Time span` as well -- the one seeded pair whose label is not its
    // key with a capital letter, and so the only one that can tell a read of
    // the label from a read of the column.
    const shared = "The Ribos Operation";
    const work = await anItemTitled(db, shared);
    const person = await anItemTitled(db, shared, { kind: "person" });
    const era = await anItemTitled(db, `${shared} era`, { kind: "time_span" });

    const { entries } = await searchCatalogue(db, { query: shared, limit: 100 });

    expect(entries).toContainEqual(expect.objectContaining({ id: work, kindLabel: "Work" }));
    expect(entries).toContainEqual(expect.objectContaining({ id: person, kindLabel: "Person" }));
    expect(entries).toContainEqual(expect.objectContaining({ id: era, kindLabel: "Time span" }));
  });

  it("says how many matched, not merely how many it returned", async () => {
    // THE CAP IS NEVER SILENT, which is the front page's rule (CNCORE-65) and
    // is not weaker for a result list: "3 results" shown over a match set of a
    // thousand tells a reader their catalogue is smaller than it is.
    //
    // ASKED FOR ONE OUT OF THREE, so the two numbers cannot be the same number
    // and an implementation returning `entries.length` fails rather than
    // passing by coincidence.
    const shared = "A Fixed Point In Time";
    await anItemTitled(db, `${shared} one`);
    await anItemTitled(db, `${shared} two`);
    await anItemTitled(db, `${shared} three`);

    const { entries, total } = await searchCatalogue(db, { query: shared, limit: 1 });

    expect(entries).toHaveLength(1);
    expect(total).toBe(3);
  });

  it("leaves out an item that has been deleted", async () => {
    // ADR-0075: a tombstone nothing reads is half a mechanism. A reader who can
    // search their way to a deleted item has not been told it is deleted.
    const id = await anItemTitled(db, "A story that was withdrawn");
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, id));

    const { entries } = await searchCatalogue(db, { query: "withdrawn", limit: 100 });

    expect(entries.map((entry) => entry.id)).not.toContain(id);
  });
});
