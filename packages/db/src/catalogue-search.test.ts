import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { titleMatches } from "./catalogue-search";
import {
  createGroupByHand,
  type Database,
  items,
  likePattern,
  putItemInGroupByHand,
  searchCatalogue,
} from "./index";
import { anItem, anItemTitled, aStatement, connect, ownerSource } from "./testing/catalogue";

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

/**
 * THE SAME DATABASE, WITH ONE DELETE WEDGED INTO THE GAP between the first
 * statement a paged search runs and the second.
 *
 * IT IS A PROXY RATHER THAN A SECOND CONNECTION because the window is an
 * ORDERING, not a concurrency: two connections racing would land the delete on
 * whichever side of the gap the scheduler chose, and a test that passes or
 * fails on that is not a test. This hooks the first statement's own resolution,
 * so the delete has committed before the second statement is even built.
 *
 * IT STOPS WRAPPING ONCE THE DELETE HAS LANDED, which is what keeps it to the
 * one statement it is about: everything the walk builds afterwards -- its own
 * select, its count, and the anchor subquery it embeds -- gets the real
 * database, unproxied.
 *
 * AND IT HANDS BACK THE ROWS IT WEDGED BEHIND, because "the FIRST statement" is
 * an assumption about `searchCatalogue` rather than a fact this helper can
 * check. Let anything ever run a select before the anchor read -- or move that
 * read to `db.query` or `db.execute` -- and the delete lands BEFORE the anchor
 * is read instead of after it. The walk would then be resuming from an anchor
 * that was already deleted when it was looked up, which is the test NEXT DOOR,
 * and the assertions of the two are identical: this one would pass while
 * exercising nothing. So the caller asserts what was actually wedged.
 */
function deletingAfterTheFirstStatement(db: Database, anchor: string) {
  const wedgedBehind: unknown[] = [];
  let landed = false;
  const wedge = async () => {
    if (landed) return;
    landed = true;
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, anchor));
  };
  // Drizzle's builders are thenable, so awaiting one calls `then`. That is the
  // one method worth intercepting; the rest are chained and pass their result
  // along.
  const wedgingAfterIt = (builder: object): object =>
    new Proxy(builder, {
      get(target, property) {
        const value: unknown = Reflect.get(target, property);
        if (typeof value !== "function") return value;
        const method = value.bind(target) as (...args: unknown[]) => unknown;
        if (property !== "then") {
          return (...args: unknown[]) => {
            const next = method(...args);
            return typeof next === "object" && next !== null ? wedgingAfterIt(next) : next;
          };
        }
        return (resolve?: (rows: unknown) => unknown, reject?: unknown) =>
          method(async (rows: unknown) => {
            if (!landed && Array.isArray(rows)) wedgedBehind.push(...(rows as unknown[]));
            await wedge();
            return resolve ? resolve(rows) : rows;
          }, reject);
      },
    });
  const racing = new Proxy(db, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property);
      if (typeof value !== "function") return value;
      const method = value.bind(target) as (...args: unknown[]) => unknown;
      if (property !== "select" || landed) return method;
      return (...args: unknown[]) => wedgingAfterIt(method(...args) as object);
    },
  }) as Database;
  return { db: racing, wedgedBehind };
}

describe("searchCatalogue", () => {
  it("finds a Work by a word inside its title", async () => {
    // INSIDE, not at the front. Prefix matching is what a `LIKE 'x%'` index
    // would give and it is not enough for a search box: `websearch_to_tsquery`
    // answers nothing at all for a fragment, which is why this is a trigram
    // index rather than full-text search (measured under CNCORE-66).
    const id = await anItemTitled(db, "The Dalek Invasion of Earth");

    const { rows } = await searchCatalogue(db, { query: "Invasion", limit: 100 });

    expect(rows).toContainEqual(expect.objectContaining({ id }));
  });

  it("finds an Entity as readily as a Work", async () => {
    // A Character's name has to work as well as a Work's, which is the half
    // that separates Catalogue search from work-browsing. ADR-0077 excludes the
    // entity kinds from the surface answering "what can I watch"; this surface
    // asks "where is the thing I am thinking of", and the answer is often a
    // person or a character.
    const character = await anItemTitled(db, "Sarah Jane Smith", { kind: "character" });

    const { rows } = await searchCatalogue(db, { query: "Sarah Jane", limit: 100 });

    expect(rows).toContainEqual(expect.objectContaining({ id: character }));
  });

  it("answers an empty query with nothing, rather than with the whole catalogue", async () => {
    // MEASURED, NOT ASSUMED: an escaped empty query is the pattern `%%`, which
    // matches every row that has a title at all, so pressing Enter on an empty
    // box returns the whole catalogue as though a reader had asked for it.
    //
    // NOTHING is the deliberate answer rather than EVERYTHING, because the
    // front page already answers "what is in this catalogue" and a search that
    // duplicated it would be a second surface giving the same reply to a
    // different question. The guard is about answering an unasked question
    // rather than about cost -- a two-character query scans just as hard and is
    // deliberately allowed. ADR-0120.
    await anItemTitled(db, "An item that exists to be not found");

    expect(await searchCatalogue(db, { query: "", limit: 100 })).toEqual({
      rows: [],
      total: 0,
      continuesAfter: null,
      continuesBefore: null,
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
      rows: [],
      total: 0,
      continuesAfter: null,
      continuesBefore: null,
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

    const { rows } = await searchCatalogue(db, { query: "100%", limit: 100 });
    const found = rows.map((row) => row.id);

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

    const { rows } = await searchCatalogue(db, { query: shared, limit: 100 });

    expect(rows).toContainEqual(expect.objectContaining({ id: work, kindLabel: "Work" }));
    expect(rows).toContainEqual(expect.objectContaining({ id: person, kindLabel: "Person" }));
    expect(rows).toContainEqual(expect.objectContaining({ id: era, kindLabel: "Time span" }));
  });

  it("says how many matched, not merely how many it returned", async () => {
    // THE CAP IS NEVER SILENT, which is the front page's rule (CNCORE-65) and
    // is not weaker for a result list: "3 results" shown over a match set of a
    // thousand tells a reader their catalogue is smaller than it is.
    //
    // ASKED FOR ONE OUT OF THREE, so the two numbers cannot be the same number
    // and an implementation returning `rows.length` fails rather than
    // passing by coincidence.
    const shared = "A Fixed Point In Time";
    await anItemTitled(db, `${shared} one`);
    await anItemTitled(db, `${shared} two`);
    await anItemTitled(db, `${shared} three`);

    const { rows, total } = await searchCatalogue(db, { query: shared, limit: 1 });

    expect(rows).toHaveLength(1);
    expect(total).toBe(3);
  });

  it("hands over the id of its last result, where more matched than it showed", async () => {
    // THE OTHER HALF OF THE CAP (ADR-0119). `total` says a walk is owed; this
    // says WHERE it carries on from, and without it a reader told "1 of 3" has
    // been shown the size of a result set the surface will not let them reach.
    //
    // ASKED FOR ONE OUT OF TWO, so the cap provably bit.
    const shared = "A stitch in time saves the Doctor";
    await anItemTitled(db, `${shared} once`);
    await anItemTitled(db, `${shared} twice`);

    const { rows, continuesAfter } = await searchCatalogue(db, { query: shared, limit: 1 });

    // THE LAST ROW THIS PAGE SHOWED, not merely a truthy string: a cursor cut
    // anywhere else skips or repeats whatever lies between the two.
    expect(continuesAfter).toBe(rows.at(-1)?.id);
  });

  it("carries on from that id, and the second page holds what the first did not", async () => {
    // THE TICKET'S FIRST CRITERION: a search matching more than one page can be
    // WALKED to the second page. Until this, `total` could say a hundredth of
    // the matches were being shown and no address existed for the rest.
    const shared = "The Keys of Marinus lie beyond";
    const written = [
      await anItemTitled(db, `${shared} one`),
      await anItemTitled(db, `${shared} two`),
      await anItemTitled(db, `${shared} six`),
    ];

    const first = await searchCatalogue(db, { query: shared, limit: 2 });
    const second = await searchCatalogue(db, {
      query: shared,
      limit: 2,
      after: first.continuesAfter ?? undefined,
    });

    // THE ORACLE IS THE IDS THIS TEST WROTE, never a second reading of the
    // search: asking the mechanism under test what it should have returned
    // would let a cursor that loses a row lose it from both sides.
    const walked = [...first.rows, ...second.rows].map((row) => row.id);
    expect([...walked].sort()).toStrictEqual([...written].sort());
    // SORTED SETS COMPARE EQUAL WITH A REPEAT IN THEM, so the criterion the
    // line above cannot see gets its own.
    expect(new Set(walked).size).toBe(walked.length);
  });

  it("walks a set that TIES on relevance without losing any of it", async () => {
    // THE HAZARD THAT IS SPECIFIC TO THIS ORDER, and the one the test above
    // cannot see: it passed against a cursor comparing `similarity` ALONE,
    // because its three titles happened to rank at three different closenesses.
    // Relevance ties are not the corner case here, they are the common case --
    // titles of one shape rank identically -- so a cursor that compares only
    // closeness steps over every result tied with its own anchor and loses
    // them permanently.
    //
    // THE TIE IS BUILT RATHER THAN HOPED FOR, which is ADR-0119's rule for the
    // catalogue's walk read onto this one: a test for this has to CUT THE PAGE
    // AT THE TIE. All four share ONE title, so all four rank at exactly 1, and
    // `limit: 1` puts a page boundary between every adjacent pair.
    //
    // AND IT TIES TWICE OVER, because the order has three terms and each is a
    // separate way to lose a row:
    //   - the pair with a SORT NAME ties on closeness and differs on the sort
    //     key, so the second term has to be read,
    //   - the pair WITHOUT one ties on closeness AND on the sort key, so only
    //     the id separates them -- the half ADR-0119 measured going green on
    //     one run and red on the next, because ids are random.
    const shared = "The Celestial Toymaker";
    const source = await ownerSource(db);
    const sorted = [await anItemTitled(db, shared), await anItemTitled(db, shared)];
    for (const [index, id] of sorted.entries()) {
      await aStatement(db, {
        subjectItemId: id,
        property: "sort_name",
        valueLiteral: `Toymaker, The Celestial (${index})`,
        sourceId: source,
      });
    }
    const keyless = [await anItemTitled(db, shared), await anItemTitled(db, shared)];
    const written = [...sorted, ...keyless];

    const walked: string[] = [];
    let after: string | undefined;
    // BOUNDED, so a cursor that does not advance fails rather than hangs.
    for (let pages = 0; pages <= written.length; pages += 1) {
      const page = await searchCatalogue(db, { query: shared, limit: 1, after });
      walked.push(...page.rows.map((row) => row.id));
      if (page.continuesAfter === null) break;
      after = page.continuesAfter;
    }

    expect([...walked].sort()).toStrictEqual([...written].sort());
    expect(new Set(walked).size).toBe(walked.length);
  });

  it("keeps its place across a tie whose closeness is not a round number", async () => {
    // A TIE AT A FRACTION, which is what a real catalogue's ties look like.
    // The four above share one title and so rank at exactly 1 -- a value every
    // way of comparing a float agrees about. These two share a SHAPE rather
    // than a title and rank at 0.61538464, measured, which is what a catalogue
    // of "Story 0001".."Story 0250" looks like to a search for "story".
    //
    // WHAT IT PINS IS THE BEHAVIOUR, not the mechanism, and the difference is
    // worth being honest about. `similarity()` returns a `real`, and
    // `similarity(...) = 0.61538464::float8` is FALSE where `::real` is true --
    // so how the anchor's closeness is compared decides whether this tie is
    // crossed at all. `closenessOfTheAnchor` keeps the value inside the server
    // and carries the measurement; this says the walk gets over the tie, by
    // whatever means, which is the part a reader of the search would notice.
    const written = [
      await anItemTitled(db, "Zagreus 0001"),
      await anItemTitled(db, "Zagreus 0250"),
    ];

    const first = await searchCatalogue(db, { query: "zagreus", limit: 1 });
    const second = await searchCatalogue(db, {
      query: "zagreus",
      limit: 1,
      after: first.continuesAfter ?? undefined,
    });

    const walked = [...first.rows, ...second.rows].map((row) => row.id);
    expect([...walked].sort()).toStrictEqual([...written].sort());
  });

  it("counts the whole match set from page two, not the part past the cursor", async () => {
    // THE LINE THIS FILE PREDICTED WOULD HAVE TO MOVE. `total` was a
    // `count(*) over ()`, and a window count is taken AFTER `where` -- so with
    // a cursor in the predicate it counts the results PAST the cursor, and the
    // second page reports a smaller match set than the first. A reader walking
    // a thousand matches would watch the number shrink under them.
    //
    // The catalogue met this under CNCORE-82 and moved to an uncorrelated
    // scalar subquery, which the cursor cannot reach.
    //
    // ASKED FOR ONE AT A TIME OUT OF THREE, so `rows.length` and `total` are
    // never the same number on either page.
    const shared = "The Mind Robber of Cornwall";
    for (const suffix of ["one", "two", "six"]) await anItemTitled(db, `${shared} ${suffix}`);

    const first = await searchCatalogue(db, { query: shared, limit: 1 });
    const second = await searchCatalogue(db, {
      query: shared,
      limit: 1,
      after: first.continuesAfter ?? undefined,
    });

    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
  });

  it("returns nothing on page two that page one would not have matched", async () => {
    // THE CURSOR MUST NOT ESCAPE THE MATCH, and it is a PRECEDENCE bug rather
    // than a logic one -- which is why no other walk test here can see it.
    //
    // `pastInTheRanking` is one raw expression with a top-level `or`, and
    // drizzle's `and()` parenthesises the pair it is handed but NOT the
    // operands inside it. Rendered, the predicate is
    // `(within and A or (B and C))`, and `and` binds tighter than `or` -- so
    // THE TIE BRANCH IS EVALUATED WITHOUT `within`. Anything tying with the
    // anchor and sorting after it comes back on page two whether or not it
    // matched the query at all.
    //
    // THE DECOY IS THE SAME WORDS IN THE OTHER ORDER, which is ADR-0120's own
    // stated limit turned into a fixture: "trigram matching has no notion of
    // word order". pg_trgm pads and splits per WORD, so `Zagreus Antimony` and
    // `Antimony Zagreus` have the identical trigram set and therefore rank
    // identically against any query -- an EXACT tie by construction rather than
    // a coincidence hunted for. Only one of them contains the query as a
    // substring, so only one matches; and the decoy sorts after the other, so
    // the leaked branch admits it.
    //
    // MEASURED: both rank at 1 against `antimony zagreus`;
    // `'Zagreus Antimony' ilike '%antimony zagreus%'` is false.
    const query = "antimony zagreus";
    const matching = await anItemTitled(db, "Antimony Zagreus");
    const decoy = await anItemTitled(db, "Zagreus Antimony");
    // A THIRD, so there is a page two to reach at all.
    const alsoMatching = await anItemTitled(db, "Antimony Zagreus and the Divergence");

    const walked: string[] = [];
    let after: string | undefined;
    for (let pages = 0; pages <= 4; pages += 1) {
      const page = await searchCatalogue(db, { query, limit: 1, after });
      walked.push(...page.rows.map((row) => row.id));
      if (page.continuesAfter === null) break;
      after = page.continuesAfter;
    }

    expect(walked).not.toContain(decoy);
    expect(walked).toContain(matching);
    expect(walked).toContain(alsoMatching);
  });

  it("keeps the ranking ACROSS a page boundary, closest first", async () => {
    // THE SECOND CRITERION: the walk keeps its place in the order the first
    // page used. Every other walk test here asserts set equality and no
    // repeats, and NEITHER CAN SEE ORDER -- a page two handing back rows that
    // outrank page one's last would satisfy both of them.
    //
    // THE ORACLE IS FOUR MEASURED NUMBERS rather than a second reading of the
    // search. Against `menoptra`, these four rank 1, 0.47368422, 0.28125 and
    // 0.15254237 -- strictly decreasing, so ONE sequence is correct and this
    // test knows it without asking the code. Titles get longer as relevance
    // falls, which is the property `similarity()` has: a title that is nearly
    // the query outranks one that merely mentions it.
    //
    // WRITTEN IN THE WRONG ORDER ON PURPOSE, so that a walk returning creation
    // order, or id order, disagrees with this rather than accidentally
    // matching it.
    const query = "menoptra";
    const distant = await anItemTitled(
      db,
      "A very long tale in which the Menoptra appear only once near the end",
    );
    const exact = await anItemTitled(db, "Menoptra");
    const middling = await anItemTitled(db, "The Menoptra and the Animus of Vortis");
    const near = await anItemTitled(db, "Menoptra of Vortis");

    const walked: string[] = [];
    let after: string | undefined;
    // ONE AT A TIME, so every adjacent pair in the expected order is separated
    // by a page boundary: this asserts the ranking the CURSOR reconstructs,
    // not the ranking one query happened to return.
    for (let pages = 0; pages <= 4; pages += 1) {
      const page = await searchCatalogue(db, { query, limit: 1, after });
      walked.push(...page.rows.map((row) => row.id));
      if (page.continuesAfter === null) break;
      after = page.continuesAfter;
    }

    expect(walked).toStrictEqual([exact, near, middling, distant]);
  });

  it("says the results end here, where nothing matched past this page", async () => {
    // THE HALF THAT MAKES THE LINE ABOVE A TEST. An implementation handing over
    // the last id unconditionally passes that one and fails this, and a reader
    // would be offered a next page that is always empty.
    const shared = "An entirely unrepeated arrangement of words";
    await anItemTitled(db, shared);

    const { continuesAfter } = await searchCatalogue(db, { query: shared, limit: 100 });

    expect(continuesAfter).toBeNull();
  });

  it("starts at the beginning where the cursor names nothing", async () => {
    // ADR-0066's rule for a parameter that is not an identity: one naming
    // nothing names no position, so the walk begins rather than erroring. A
    // reader whose bookmark outlived the result it was cut at gets the search
    // back, not an error page.
    //
    // BOTH SHAPES, because they fail differently and only one of them looks
    // like a cursor. A well-formed id for no row is an empty lookup; a
    // MALFORMED one reaches a `uuid` column as PostgreSQL error 22P02, which
    // `canBeAnId` is what stops.
    const shared = "The Underwater Menace at Atlantis";
    for (const suffix of ["one", "two"]) await anItemTitled(db, `${shared} ${suffix}`);

    const beginning = await searchCatalogue(db, { query: shared, limit: 100 });
    const noSuchItem = await searchCatalogue(db, {
      query: shared,
      limit: 100,
      after: crypto.randomUUID(),
    });
    const notAnId = await searchCatalogue(db, {
      query: shared,
      limit: 100,
      after: "page-two-please",
    });

    expect(noSuchItem.rows).toStrictEqual(beginning.rows);
    expect(notAnId.rows).toStrictEqual(beginning.rows);
  });

  it("starts over rather than ending, where the result it was cut at was deleted", async () => {
    // A DELETED ITEM HAS NO TITLE, which is the fact this rests on and it is
    // not obvious: migration 5 tombstones every statement of a deleted item,
    // that re-fires the projection, and the projection over no live statements
    // is NULL. So `items.title` and `items.sort_name` are both gone -- not
    // merely hidden -- the moment an item is deleted.
    //
    // SO THE ITEM IS NO ANCHOR IN THIS ORDER AND CANNOT BE MADE ONE.
    // Closeness is `similarity(title, ...)`, and there is no title left to
    // measure. ADR-0119 reads the anchor WITHOUT the tombstone filter so that a
    // kept link goes on working, and that is still right -- it is what makes
    // this a position rather than something a reader is shown -- but for this
    // order the position it finds is nothing.
    //
    // STARTING OVER IS THE HONEST ANSWER, and the one ADR-0066 already gives an
    // id that names nothing: a reader following a kept link is shown the search
    // again and can walk it again. Every result is still reachable and none is
    // skipped, which is the criterion. The alternative is the one the CATALOGUE
    // walk took until CNCORE-110: a deleted anchor there had a NULL sort key,
    // which its cursor read as "already among the items with no sort key" and
    // resumed from the untitled tail -- MEASURED, an empty page two over a
    // catalogue with three items still unseen, rendered as "The catalogue ends
    // here". It takes this answer now, so the two surfaces agree by decision
    // rather than by this one being careful.
    const shared = "The Macra Terror in the colony";
    for (const suffix of ["one", "two", "six"]) await anItemTitled(db, `${shared} ${suffix}`);

    const cut = await searchCatalogue(db, { query: shared, limit: 2 });
    const anchor = cut.rows.at(-1)?.id;
    await db
      .update(items)
      .set({ deletedAt: new Date() })
      .where(eq(items.id, anchor ?? ""));

    const kept = await searchCatalogue(db, { query: shared, limit: 100, after: anchor });

    // THE TWO THAT ARE LEFT, from the top: the search over again, rather than
    // an empty page claiming the results ran out.
    expect(kept.rows.map((row) => row.id)).toStrictEqual(
      (await searchCatalogue(db, { query: shared, limit: 100 })).rows.map((row) => row.id),
    );
    expect(kept.rows).toHaveLength(2);
    expect(kept.rows.map((row) => row.id)).not.toContain(anchor);
  });

  it("starts over rather than ending, where the anchor is deleted BETWEEN THE TWO STATEMENTS", async () => {
    // THE WINDOW, REACHED RATHER THAN REASONED ABOUT. A paged search runs two
    // statements: one reads the anchor and finds it titled, and the next
    // computes `similarity(anchor.title, $query)` as a subquery. An item
    // deleted in between is titled for the first and untitled for the second,
    // because migration 5 tombstones its statements and the projection empties.
    //
    // WHAT THAT COSTS IS THE WHOLE PAGE, not the anchor. The subquery answers
    // NULL, a NULL on one side makes the entire cursor predicate NULL, and NULL
    // is not true for any row -- so the walk returns nothing and `/search`
    // renders "These results end here" over results still unseen. It is the
    // silent ending CNCORE-110 closed for the listing, two statements wide
    // rather than at read time.
    //
    // THE ANSWER IS THE ONE THE READ-TIME CHECK ALREADY GIVES, which is what
    // makes this a window worth leaving open rather than one to close: an
    // anchor with no closeness names no position, so the search starts over.
    // Both sides of the window now answer the same way, so nothing observable
    // depends on which side of it the delete lands (ADR-0119, CNCORE-113).
    const shared = "The Web of Fear in the Underground";
    for (const suffix of ["one", "two", "six"]) await anItemTitled(db, `${shared} ${suffix}`);

    const cut = await searchCatalogue(db, { query: shared, limit: 2 });
    const stoppedAt = cut.rows.at(-1);
    // Rather than `?? ""`, which reaches a `uuid` column as PostgreSQL 22P02
    // and reports an empty first page as a driver error.
    if (stoppedAt === undefined) throw new Error("page one of three matches returned nothing");
    const racing = deletingAfterTheFirstStatement(db, stoppedAt.id);

    const kept = await searchCatalogue(racing.db, {
      query: shared,
      limit: 100,
      after: stoppedAt.id,
    });

    // THE WEDGE WENT WHERE IT WAS AIMED, asserted rather than assumed. The
    // statement the delete landed behind read the anchor AND FOUND IT STILL
    // TITLED, which is the window's whole precondition -- and the one thing
    // that tells this test apart from the one above it, whose anchor was
    // already deleted when it was looked up.
    expect(racing.wedgedBehind).toStrictEqual([
      expect.objectContaining({ id: stoppedAt.id, title: stoppedAt.title }),
    ]);

    // THE TWO THAT ARE LEFT, from the top -- the same answer as a delete that
    // landed before the search began, which is the point.
    expect(kept.rows.map((row) => row.id)).toStrictEqual(
      (await searchCatalogue(db, { query: shared, limit: 100 })).rows.map((row) => row.id),
    );
    expect(kept.rows).toHaveLength(2);
    expect(kept.rows.map((row) => row.id)).not.toContain(stoppedAt.id);
  });

  it("starts at the beginning where the cursor names an item with no title", async () => {
    // AN ITEM WITH NO TITLE IS NO ANCHOR IN THIS ORDER, which is a state the
    // catalogue's walk has no analogue for: closeness is
    // `similarity(title, ...)` and is NULL without a title, so such an anchor
    // can be ranked against nothing -- and a NULL on one side of the cursor's
    // comparison makes the whole predicate NULL, which answers with an EMPTY
    // PAGE rather than with the results. No search ever handed such an id out,
    // because an untitled item cannot match; this is a hand-typed or long-kept
    // address, and ADR-0066 says it names no position.
    //
    // IT HAS A SORT NAME AND NO TITLE, which is the only shape that can tell
    // this rule from the one beside it. An item with NEITHER has no sort key
    // either, so a walk checking only the sort key turns it away for the wrong
    // reason -- measured: written that way, this passed with the title rule
    // removed.
    const shared = "The Faceless Ones at Gatwick";
    for (const suffix of ["one", "two"]) await anItemTitled(db, `${shared} ${suffix}`);
    const sortedButUntitled = await anItem(db);
    await aStatement(db, {
      subjectItemId: sortedButUntitled,
      property: "sort_name",
      valueLiteral: "Faceless Ones, The",
      sourceId: await ownerSource(db),
    });

    const beginning = await searchCatalogue(db, { query: shared, limit: 100 });
    const from = await searchCatalogue(db, { query: shared, limit: 100, after: sortedButUntitled });

    expect(from.rows).toStrictEqual(beginning.rows);
    expect(from.rows).not.toHaveLength(0);
  });

  it("leaves out an item that has been deleted", async () => {
    // ADR-0075: a tombstone nothing reads is half a mechanism. A reader who can
    // search their way to a deleted item has not been told it is deleted.
    const id = await anItemTitled(db, "A story that was withdrawn");
    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, id));

    const { rows } = await searchCatalogue(db, { query: "withdrawn", limit: 100 });

    expect(rows.map((row) => row.id)).not.toContain(id);
  });
});

/**
 * CATALOGUE SEARCH WITHIN ONE GROUP (CNCORE-180, ADR-0010): searching Doctor
 * Who does not return Iron Man.
 *
 * EXACT, WHERE THE REST OF THIS FILE SAYS "CONTAINS", because the Group is
 * drawn by the test that reads it: nothing else in the suite knows its id, so
 * what it holds is what this test put in it. The tombstones and a Group naming
 * nothing are the shared predicate's, asked in `catalogue.test.ts`.
 */
describe("searchCatalogue, narrowed to a Group", () => {
  it("answers the matches inside that Group, of every kind, at the Group's own size", async () => {
    // BOTH HALVES OF THE QUESTION HAVE TO HOLD AT ONCE, so each is given a Row
    // that satisfies only the other: a match OUTSIDE the scope, which a search
    // that ignored the Group would list, and a Row INSIDE the scope that does
    // not match, which a narrowing that replaced the match would list.
    //
    // AND A CHARACTER AMONG THE MATCHES, because this is the wide question
    // (ADR-0077): narrowed or not, a Character's name finds the Character.
    // Work-browsing hides it; this must not.
    const scope = await createGroupByHand(db, { name: "A scope searched within" });
    const story = await anItemTitled(db, "Zygon Gambit, inside the scope");
    const character = await anItemTitled(db, "A Zygon Gambit commander", { kind: "character" });
    const unmatched = await anItemTitled(db, "A story in the scope that matches nothing");
    await anItemTitled(db, "Zygon Gambit, outside the scope");
    for (const itemId of [story, character, unmatched]) {
      await putItemInGroupByHand(db, { groupId: scope, itemId });
    }

    const found = await searchCatalogue(db, { query: "Zygon Gambit", limit: 100, group: scope });

    expect(found.rows.map((row) => row.id).sort()).toStrictEqual([story, character].sort());
    // THE SIZE OF WHAT IT SEARCHED, against a literal: a Group narrowing the
    // Rows and not the count reports every match in the catalogue over a page
    // of two.
    expect(found.total).toBe(2);
  });
});

describe("the trigram index", () => {
  it("can serve the ILIKE the search runs", async () => {
    // THE FAILURE THIS CATCHES IS SILENT, which is the only reason a test
    // reaches for a query plan at all. An index built with the wrong access
    // method or the wrong operator class is still an index: every assertion
    // above goes on passing, every result is still correct, and the search
    // sequentially scans the whole catalogue for the rest of the product's
    // life. Nothing errors and nothing looks wrong.
    //
    // `set local enable_seqscan = off` IS WHAT MAKES IT ASKABLE HERE. The
    // fixtures hold a handful of rows and a sequential scan genuinely IS the
    // cheaper plan for them, so on this data the planner would refuse the index
    // even when the index is perfect. Turning the alternative off asks the
    // question this test actually means: not "would PostgreSQL choose it today"
    // -- which is about the size of the table -- but "CAN PostgreSQL use it for
    // this operator at all", which is about the index being right.
    //
    // `local`, so it lasts the transaction rather than the pooled connection.
    // A bare `SET` would leak the setting to whichever test drew that
    // connection next.
    const plan = await db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      // THE REAL PREDICATE, imported rather than written out again. Spelled a
      // second time here, this probe and `searchCatalogue` were free to drift:
      // it would go on reporting a healthy index for a `where` clause the
      // search had stopped using, which is exactly the silent failure it is
      // here to catch. Caught in review.
      const explained = await tx.execute(
        sql`explain select "id" from "items" where ${titleMatches("invasion")}`,
      );
      return explained.rows.map((row) => String(row["QUERY PLAN"])).join("\n");
    });

    expect(plan).toContain("items_title_trigram");
  });
});
