import { and, eq, or, type SQL, type SQLWrapper, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Database } from "./index";
import { type Catalogue, findTheAnchor, IN_THE_CATALOGUE, SORT_KEY, walkListing } from "./queries";
import { items } from "./schema";

/**
 * Turns what a reader typed into a `LIKE` pattern that matches it AS TEXT.
 *
 * THE ORDER OF THE THREE REPLACEMENTS IS LOAD-BEARING, and it is the only
 * subtle thing in this file. The backslash goes first. Escaping `%` or `_`
 * first inserts backslashes of its own, and a backslash pass running afterwards
 * doubles those -- which turns the escape back into a literal backslash and the
 * metacharacter back into a wildcard. One transposition, and a reader searching
 * for `100%` matches every row in the catalogue.
 *
 * IT RETURNS THE WHOLE PATTERN rather than an escaped fragment, and that is
 * what makes it THE ONLY PATH TO ONE. A helper that escaped and left the caller
 * to wrap it in `%...%` would put half the rule at every call site, which is
 * where the halves stop agreeing.
 *
 * THERE IS NO BUILT-IN THAT DOES THIS. PostgreSQL's `like_escape()` is not a
 * sanitiser -- it rewrites a pattern from one escape character to another, and
 * takes a pattern as its input. Checked rather than assumed.
 *
 * IT IS CNCORE-24'S RULE FROM `provider-wiki`, matched term for term on
 * purpose, so that the catalogue and the provider escape a reader's query the
 * same way rather than each being locally sensible.
 */
export function likePattern(query: string): string {
  const escaped = query
    // FIRST, ALWAYS. See above.
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  // Wrapped on both sides, because a search box matches ANYWHERE in a title:
  // `yler` has to find "Rose Tyler". That is the capability full-text search
  // cannot offer at all, and the reason this is a trigram index rather than a
  // `tsvector` one.
  return `%${escaped}%`;
}

/**
 * THE MATCH ITSELF, named once so that nothing can test a different one.
 *
 * IT EXISTS BECAUSE OF THE PLAN TEST. `catalogue-search.test.ts` asks
 * PostgreSQL whether the trigram index can serve this predicate, and it can
 * only ask by writing a predicate down. Written out a second time there, the
 * probe and the real query were free to drift -- the probe would go on
 * reporting a healthy index for a `where` clause the search had stopped using,
 * which is precisely the silent failure that test exists to catch.
 *
 * `ilike` RATHER THAN `similarity() >`. Every row this returns CONTAINS the
 * query; the ranking is a separate question, answered by the order rather than
 * by the filter. That is what keeps "did it match" a fact a reader could check
 * for themselves rather than a threshold nobody chose.
 */
export function titleMatches(query: string) {
  return sql`${items.title} ilike ${likePattern(query)}`;
}

/**
 * CATALOGUE SEARCH: the owner's own catalogue, across EVERY item kind.
 *
 * `CONTEXT.md` gives this its name and separates it from the CMPP operation
 * also called Search, which asks a PROVIDER for candidate matches. This asks
 * the catalogue about what is already in it.
 *
 * EVERY KIND, which is ADR-0077's rule read the way that record phrases it --
 * around the QUESTION A SURFACE ASKS. Work-browsing answers "what can I watch"
 * and excludes the entity kinds; this answers "where is the thing I am thinking
 * of", and a Character's name has to find the Character. That is why each entry
 * carries its kind: a Person and a Work sharing a name are two rows here, and
 * the kind is what tells a reader which is which.
 *
 * IT ANSWERS `Catalogue`, AND IT USED TO ANSWER A SHAPE OF ITS OWN. The entries
 * were always the listing's entries exactly -- a result and a catalogue row
 * carry the same four facts -- and the one difference was the cursor: a search
 * had none, and ADR-0119 makes `continuesAfter: null` mean "the listing ends
 * here", so a search over a thousand matches answering null would have told
 * every caller the hundred it returned were all of them. A shape that could not
 * say it was better than a field that said it falsely.
 *
 * CNCORE-88 GAVE IT ONE, so the reason for the second shape is spent: `null`
 * here now means what it means everywhere, because there is an `after` that
 * reaches what it is not showing. Two identical interfaces one file apart is
 * the hazard `queries.ts` carries a paragraph about, so there is one.
 *
 * IT IS ORDERED BY RELEVANCE AND IT STILL WALKS (ADR-0119). The anchor's place
 * in that order is RECOMPUTED from the query the request resupplies, rather
 * than read off the anchor row the way a listing reads its sort key -- which is
 * what `past` below is about, and the whole of what this surface costs that the
 * catalogue's walk does not.
 *
 * THE WINNING TITLE ONLY. `items.title` is a projection (ADR-0014), so what is
 * searched is whichever title statement currently wins. Alternative and
 * foreign-language titles are held as statements and are NOT found by this --
 * said here rather than discovered later. Reaching them needs a partial
 * expression index keyed to a property id minted per install, which cannot live
 * in a schema file; it is out of scope for CNCORE-66 on purpose.
 */
export async function searchCatalogue(
  db: Database,
  { query, limit, after }: { query: string; limit: number; after?: string },
): Promise<Catalogue> {
  /*
   * AN EMPTY QUERY IS ANSWERED BEFORE THE QUERY RUNS, and this line is a fix
   * rather than a guard against something that cannot happen.
   *
   * MEASURED: an escaped empty query is the pattern `%%`, which matches every
   * row that has a title at all. So the accidental behaviour of a search box
   * somebody pressed Enter on is the WHOLE CATALOGUE returned as though a
   * reader had asked for it.
   *
   * IT IS NOT GUARDED FOR ITS COST, and this comment used to say it was. A
   * one- or two-character query scans just as hard -- the index does nothing
   * below three characters -- and is deliberately NOT short-circuited, because
   * it is a real question with a real answer. ADR-0120 carries the measurement.
   *
   * WHAT MAKES THIS ONE DIFFERENT is that it answers a question nobody asked.
   * The front page already answers "what is in this catalogue" (ADR-0077's wide
   * question), so a search falling back to listing it would be a second surface
   * giving the same reply to a different question.
   *
   * TRIMMED FIRST, so a reader who hit the space bar has typed nothing too.
   * The trimmed query is then what gets searched, rather than the raw one:
   * trimming for the test and searching the untrimmed string would make ` rose`
   * and `rose` two different searches for no reason a reader could see.
   */
  const wanted = query.trim();
  // Nothing was asked, so nothing matched and there is nowhere to walk on to.
  if (wanted === "") return { entries: [], total: 0, continuesAfter: null };

  const anchor = after === undefined ? undefined : await findInTheRanking(db, after);

  return walkListing(db, {
    /*
     * ADR-0075, AND THE LISTINGS' OWN PREDICATE rather than a second spelling
     * of it. A deleted item is gone to every reader, and a reader who can
     * search their way to one has not been told it is deleted -- but the hazard
     * that makes this an import is the day "in the catalogue" gains a term and
     * only one of the two surfaces learns it.
     *
     * AND IT IS WHAT `total` COUNTS, which is the second thing this parameter
     * decides: how many MATCHED, rather than how many the catalogue holds.
     */
    within: and(IN_THE_CATALOGUE, titleMatches(wanted)) as SQL,
    orderBy: [
      // CLOSEST FIRST, which is what the trigram index is for beyond speed:
      // `similarity()` comes from the same `pg_trgm` extension the index needs,
      // so ranking costs no second mechanism. Every row here CONTAINS the query
      // already -- `ilike` decided that -- so what this separates is how much
      // else the title says: a title that is nearly the query outranks one that
      // merely mentions it.
      sql`${closenessTo(items.title, wanted)} desc`,
      /*
       * AND THEN THE CATALOGUE'S OWN ORDER, so two equally close titles come
       * back in the same order twice. `SORT_KEY` is the listings' own, not a
       * second spelling: the catalogue has one order, and a search that broke
       * ties by a different one would list two items in an order no other
       * surface agrees with.
       *
       * `nulls last` IS SPELLED THE WAY THE LISTING SPELLS IT and CANNOT BITE
       * HERE, which is worth the line because the listing's copy says it is
       * load-bearing. There it is: an item with no title at all has no sort key
       * and sorts last as a block. No such row can be in a result set -- the
       * match is `title ilike ...`, which is NULL without a title -- so this is
       * the two orders held identical rather than a case being handled.
       */
      sql`${SORT_KEY} nulls last`,
      sql`${items.id}`,
    ],
    past: anchor && pastInTheRanking(db, anchor, wanted),
    limit,
  });
}

/**
 * HOW CLOSE ONE TITLE IS TO WHAT THE READER TYPED, written once.
 *
 * The order and the cursor that walks it are ONE RULE (ADR-0119), and spelling
 * it twice is how they come to disagree about where a page ended. `SORT_KEY`
 * next door exists for the same reason and says so.
 */
function closenessTo(title: SQLWrapper, query: string): SQL {
  return sql`similarity(${title}, ${query})`;
}

/** Where one result sits in the ranking one search produced. */
interface PlaceInTheRanking {
  /**
   * NOT NULL, unlike the catalogue's. See `past` below: a result set cannot
   * hold a row without a sort key, so neither can an anchor that has a place
   * in one.
   */
  sortKey: string;
  id: string;
}

/**
 * Everything this search ranks AFTER one result (ADR-0119).
 *
 * THE ORDER HAS THREE TERMS AND SO DOES THIS, because each of the three is a
 * separate way to lose rows silently:
 *
 * - CLOSENESS FIRST, which is the term the catalogue's walk does not have.
 * - THEN THE SORT KEY, because relevance ties are the COMMON case here rather
 *   than a corner of one -- titles of one shape rank identically, and a cursor
 *   comparing closeness alone steps over every result tied with its anchor.
 *   Measured: a four-row fixture sharing one title walked to ONE of them.
 * - THEN THE ID, because two results can tie on both -- the same title and the
 *   same sort name is one item filmed twice, not a contrivance -- and ids are
 *   random, so which of a tied pair a page ends on is luck.
 *
 * A ROW COMPARISON FOR THE LAST TWO, WHICH `readListing`'S `past` CANNOT USE,
 * and the difference is worth the sentence. That one has to write two regimes
 * because an item nobody has titled has no sort key, and `(null, x) > (k, y)`
 * is NULL rather than true -- so a row comparison would drop the untitled tail
 * off the catalogue's walk permanently. NO SUCH ROW CAN BE IN A RESULT SET:
 * matching is `title ilike ...`, which is NULL for an untitled item, so every
 * row here has a title and therefore a sort key. The regime that needs two
 * halves cannot arise, so the comparison is written as the one it is.
 */
function pastInTheRanking(db: Database, { sortKey, id }: PlaceInTheRanking, query: string): SQL {
  const closeness = closenessTo(items.title, query);
  const anchor = closenessOfTheAnchor(db, id, query);
  /*
   * BUILT WITH `or` AND `and` RATHER THAN WRITTEN AS ONE STRING, and that is a
   * FIX rather than a preference. Written as one `sql` template with a
   * top-level `or`, this returned rows the search had not matched.
   *
   * `and(within, past)` parenthesises the PAIR it is handed and not the
   * operands inside it, so the predicate rendered as
   * `(within and A or (B and C))` -- and `and` binds tighter than `or`, so it
   * parsed as `((within and A) or (B and C))`. THE TIE BRANCH ESCAPED THE MATCH
   * ENTIRELY: anything ranking level with the anchor and sorting after it came
   * back on page two whether or not it contained the query.
   *
   * MEASURED, and reachable by construction rather than by luck: pg_trgm pads
   * and splits per WORD, so `Zagreus Antimony` and `Antimony Zagreus` hold the
   * identical trigram set and rank identically against any query (ADR-0120's
   * "trigram matching has no notion of word order", read as a hazard rather
   * than a limit). Only one of them contains the query. The walk returned both.
   *
   * `or()` wraps its own result, so the parenthesising is drizzle's job here
   * rather than something this file has to get right by hand.
   */
  return or(
    sql`${closeness} < ${anchor}`,
    and(sql`${closeness} = ${anchor}`, sql`(${SORT_KEY}, ${items.id}) > (${sortKey}, ${id})`),
  ) as SQL;
}

/**
 * THE ANCHOR'S OWN CLOSENESS, COMPUTED INSIDE THE QUERY rather than carried out
 * through the driver and back -- because the equality below has to hold on a
 * `real`, and what a `real` compares equal to depends on its TYPE rather than
 * on its digits.
 *
 * MEASURED on this repo's PostgreSQL, against
 * `similarity('Zagreus 0001', 'zagreus')`, which is `0.61538464`:
 *
 *   = $1 (untyped)     true      $1 = 0.61538464 read back out of that same row
 *   = $1::float8       FALSE
 *   = $1::real         true
 *
 * SO CARRYING IT OUT AND BACK WOULD WORK TODAY, and that is the reason to say
 * this precisely rather than to claim it would not: node-postgres sends a
 * JavaScript number UNTYPED, and PostgreSQL then infers `real` from the
 * comparison itself. The value survives because of an inference nothing at the
 * call site says out loud -- and the day anything types that parameter as a
 * double, every tie compares false and the walk steps over every result tied
 * with its own anchor, silently and permanently. Ties are the common case here
 * rather than a corner of one: titles of one shape rank identically.
 *
 * THIS DEPENDS ON NEITHER. The value is never rendered as text and never
 * re-parsed, so there is no type to infer and no digits to round.
 *
 * IT IS READ TWICE PER PAGE, MEASURED, because the comparison names it twice -- once
 * for `<` and once for `=`. `explain (analyze)` shows two `InitPlan`s, each an
 * `Index Scan using items_pkey` at `loops=1`: uncorrelated, so twice per page
 * rather than per row. Folding them into one would mean joining the anchor in
 * as a relation and putting a parameter on `walkListing` that only this caller
 * would ever pass, which is a worse trade than a second lookup on a unique key.
 *
 * ALIASED, so the inner `items` cannot be read as the outer one.
 */
function closenessOfTheAnchor(db: Database, id: string, query: string): SQL {
  const anchor = alias(items, "anchor");
  return sql`(${db
    .select({ closeness: closenessTo(anchor.title, query) })
    .from(anchor)
    .where(eq(anchor.id, id))})`;
}

/**
 * Where one id sits in THIS search's ranking, by the id a reader arrived with.
 *
 * THE READ IS `findTheAnchor`'S, AND ONLY THE RULES ARE THIS FILE'S. That
 * function owns the two decisions every cursor in this app shares -- the shape
 * guard, and reading past the tombstone because an anchor is a position rather
 * than something a reader is shown -- and they were spelled twice here until
 * review. What is left below is the part a RELEVANCE order genuinely decides
 * differently.
 */
async function findInTheRanking(db: Database, id: string): Promise<PlaceInTheRanking | undefined> {
  const anchor = await findTheAnchor(db, id);
  if (anchor === undefined) return undefined;
  /*
   * AN ITEM WITH NO TITLE HAS NO PLACE IN THIS ORDER, which is a state the
   * catalogue's walk has no analogue for. Closeness is
   * `similarity(title, ...)` and is NULL without a title, so such an anchor can
   * be ranked against nothing -- and a NULL on one side of the comparison makes
   * the whole predicate NULL, which answers with an EMPTY PAGE rather than with
   * the results. No search ever handed such an id out, because an untitled item
   * cannot match. It names no position, so the walk starts at the beginning:
   * the same answer ADR-0066 gives an id that names nothing at all.
   *
   * A DELETED ITEM IS THIS CASE, which is not obvious. Migration 5 tombstones
   * every statement of a deleted item, that re-fires the projection, and a
   * projection over no live statements is NULL -- so `title` and `sort_name`
   * are GONE rather than hidden. A link kept past a delete therefore starts the
   * search over rather than resuming, and every result is still reachable. The
   * catalogue's walk meets the same fact and now answers it the same way, for
   * the same reason: a deleted anchor has no place in either order, so it names
   * no position (CNCORE-110, `findInTheOrder` in `queries.ts`).
   *
   * AND THE SAME FACT LEAVES A RACE THIS DOES NOT CLOSE. The anchor is read
   * here and its closeness is computed in the NEXT statement, so an item
   * deleted between the two is titled for this check and untitled for that one:
   * the subquery answers NULL, the predicate is NULL, and the page renders
   * "These results end here" rather than starting over. The window is two
   * statements wide, where ADR-0119 already prices a WIDER version of the same
   * race -- an anchor retitled "inside the seconds between two clicks" -- as
   * the cost of a cursor that is an id.
   *
   * TODO(CNCORE-113): AND IT IS THAT TICKET'S, NOT CNCORE-110'S. This comment
   * named CNCORE-110 as owning it, and that one has since closed by answering
   * what a walk does with an anchor that has lost its place AT READ TIME --
   * which is the check above, not the window below it. The catalogue's walk has
   * no equivalent race: it embeds the anchor's sort key as a VALUE read in the
   * first statement, so a delete between the two changes no predicate. Only a
   * relevance order re-derives the place on the server, and closing the window
   * means deciding against ADR-0119's reason for keeping that value there.
   */
  if (anchor.title === null || anchor.sortKey === null) return undefined;
  return { sortKey: anchor.sortKey, id: anchor.id };
}
