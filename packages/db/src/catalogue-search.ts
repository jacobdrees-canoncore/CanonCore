import { and, eq, type SQL, type SQLWrapper, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Database } from "./index";
import type { AnchorIn, TheOrder } from "./order";
import {
  type Catalogue,
  findTheAnchor,
  IN_THE_CATALOGUE,
  narrowedToTheKind,
  SORT_KEY,
  theCutAt,
  type WhereAPageIs,
  walkListing,
  withinTheGroup,
} from "./queries";
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
 * of", and a Character's name has to find the Character. That is why each row
 * carries its kind: a Person and a Work sharing a name are two rows here, and
 * the kind is what tells a reader which is which.
 *
 * IT ANSWERS `Catalogue`, AND IT USED TO ANSWER A SHAPE OF ITS OWN. The rows
 * were always the listing's rows exactly -- a result and a catalogue row
 * carry the same facts -- and the one difference was the cursor: a search
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
 * IT IS ORDERED BY RELEVANCE AND IT STILL WALKS (ADR-0119). The anchor's
 * closeness is RECOMPUTED from the query the request resupplies, rather than
 * read off the anchor row the way a listing reads its sort key -- which is what
 * `past` below is about, and the whole of what this surface costs that the
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
  {
    query,
    limit,
    group,
    kind,
    ...at
  }: { query: string; limit: number; group?: string; kind?: string } & WhereAPageIs,
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
  if (wanted === "") {
    return { rows: [], total: 0, rowsBefore: 0, continuesAfter: null, continuesBefore: null };
  }

  const ranking = theRanking(wanted);
  const cut = await theCutAt(at, (id) => findInTheRanking(db, ranking, wanted, id));

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
     *
     * AND WITHIN THE GROUP A READER PICKED, where they picked one (CNCORE-180):
     * the same `withinTheGroup` the catalogue and work-browsing take theirs
     * through, so a scope means one thing on all three. It joins the match
     * rather than replacing it, and it arrives before the size is taken -- so
     * `total` is how many matched IN THE GROUP.
     */
    /*
     * AND NARROWED TO THE KIND A READER PICKED (CNCORE-175), through the same
     * `narrowedToTheKind` the other two Listings take theirs through, so the
     * narrowing means one thing on all three. It joins the match rather than
     * replacing it, and it arrives before the size is taken -- so `total` is
     * how many matched OF THAT KIND.
     *
     * ADR-0077 SAYS SEARCH RETURNS ALL SEVEN KINDS, and it still does: that
     * record decides what this surface's QUESTION includes, and this is the
     * reader narrowing the answer to it. Unnarrowed, a Character's name still
     * finds the Character.
     */
    within: narrowedToTheKind(
      kind,
      withinTheGroup(db, group, and(IN_THE_CATALOGUE, titleMatches(wanted)) as SQL),
    ),
    order: ranking,
    cut,
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

/**
 * THE ORDER ONE SEARCH RANKS IN, and the app's only order with a DESCENDING
 * key.
 *
 * ONE VALUE, AND BOTH STATEMENTS ARE READ OFF IT (ADR-0119). `theOrderBy`
 * renders the `ORDER BY` and `pastTheRowIn` renders the cursor comparison that
 * walks it. Each of the three terms is a separate way to lose results silently,
 * which is why the comparison naming all three cannot be left to care:
 *
 * - CLOSEST FIRST, which is what the trigram index is for beyond speed:
 *   `similarity()` comes from the same `pg_trgm` extension the index needs, so
 *   ranking costs no second mechanism. Every row here CONTAINS the query
 *   already -- `ilike` decided that -- so what this separates is how much else
 *   the title says: a title that is nearly the query outranks one that merely
 *   mentions it. `largestFirst` is what makes it the CLOSEST rather than the
 *   furthest, in the sort and in the walk at once.
 * - THEN THE CATALOGUE'S OWN ORDER, so two equally close titles come back in
 *   the same order twice. `SORT_KEY` is the listings' own, not a second
 *   spelling: the catalogue has one order, and a search that broke ties by a
 *   different one would list two items in an order no other surface agrees
 *   with. Relevance ties are the COMMON case here rather than a corner of one
 *   -- titles of one shape rank identically -- and a cursor comparing closeness
 *   alone steps over every result tied with its anchor (CNCORE-88, measured: a
 *   four-row fixture sharing one title walked to ONE of them).
 * - THEN THE ID, because two results can tie on both: the same title and the
 *   same sort name is one item filmed twice, not a contrivance, and ids are
 *   random, so which of a tied pair a page ends on is luck.
 *
 * BOTH KEYS SAY `everyRowHasIt`, AND IT IS ONE FACT RATHER THAN TWO. The match
 * is `title ilike ...`, which is NULL for an item with no title, so EVERY ROW
 * THIS LISTING HOLDS HAS A TITLE -- and therefore a closeness, because
 * `similarity()` over a title is never null, and therefore a sort key, because
 * `coalesce(sort_name, title)` falls back to that title. THIS ORDER HAS NO
 * KEYLESS BLOCK AT ALL, which is the one thing it does not share with the
 * catalogue's: there the untitled tail is a real block of rows a walk must
 * reach. It was a COMMENT justifying a hand-written predicate until CNCORE-170
 * and is a declaration the shared one reads now. AND SO NEITHER SAYS
 * `destroyedBy`, though a delete destroys both: see `findInTheRanking`.
 *
 * AND THE TIES ARE STILL THE CATALOGUE'S OWN ORDER, which is what the `nulls
 * last` this no longer renders used to say. The identity that matters is the
 * SHARED `SORT_KEY` expression rather than the spelling around it, and the
 * clause it drops was the spelling of a block this listing cannot hold.
 *
 * BUILT PER REQUEST RATHER THAN WRITTEN AS A CONSTANT, because the leading key
 * is a function of what the reader typed rather than a column of the item
 * (ADR-0120). That is the whole of what this Listing has that the catalogue's
 * does not, and `AnchorIn` carries the other half of it -- see `findInTheRanking`
 * below.
 */
function theRanking(query: string) {
  return {
    keys: {
      closeness: {
        key: closenessTo(items.title, query),
        largestFirst: true,
        everyRowHasIt: true,
      },
      sortKey: { key: SORT_KEY, everyRowHasIt: true },
    },
    id: items.id,
  } satisfies TheOrder;
}

/**
 * Where one result sits in the ranking one search produced.
 *
 * DERIVED FROM THE ORDER rather than declared beside it, for the reason that
 * order gives: an anchor written out by hand is a second list of its keys, and
 * two lists come apart. CNCORE-88 was this list being one term short.
 */
type AnchorInTheRanking = AnchorIn<ReturnType<typeof theRanking>>;

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
 * IT IS READ THREE TIMES PER PAGE, MEASURED, because the comparison names it three
 * times -- once for `is null`, once for `<` and once for `=`. It was TWICE until
 * CNCORE-113 added the first of those, and the number is corrected here rather
 * than beside it because this is the sentence that carries it. `explain
 * (analyze)` on the real paged statement shows three `InitPlan`s, each an
 * `Index Scan using items_pkey` at `loops=1` on the same id: uncorrelated, so
 * three times per page rather than per row, at two shared buffer hits each.
 * Folding them into one would mean joining the anchor in as a relation and
 * putting a parameter on `walkListing` that only this caller would ever pass,
 * which is a worse trade than a third lookup on a unique key -- the same trade
 * ADR-0119 priced at two, and it does not turn over on the third.
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
 * function owns the decisions every cursor in this app shares -- the shape
 * guard, reading past the tombstone because an anchor is a position rather
 * than something a reader is shown, and refusing an anchor whose key the order
 * says a delete destroyed -- and they were spelled twice here until review.
 * What is left below is the part a RELEVANCE order genuinely decides
 * differently.
 *
 * HANDED THIS RANKING, THAT LAST REFUSAL REFUSES NOTHING, and deliberately.
 * Neither key says `destroyedBy`, because both say `everyRowHasIt`: on such a
 * key a null is no anchor whatever took it, a delete or a title nobody wrote,
 * and the check below turns both away on the title alone.
 */
async function findInTheRanking(
  db: Database,
  ranking: ReturnType<typeof theRanking>,
  query: string,
  id: string,
): Promise<AnchorInTheRanking | undefined> {
  const anchor = await findTheAnchor(db, ranking, id);
  if (anchor === undefined) return undefined;
  /*
   * AN ITEM WITH NO TITLE IS NO ANCHOR IN THIS ORDER, which is a state the
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
   * the same reason: a deleted item is no anchor in either order, so it names
   * no position (CNCORE-110, `findInTheOrder` in `queries.ts`).
   *
   * AND THE SAME FACT LEFT A RACE THIS CHECK CANNOT SEE, WHICH IS NOW HARMLESS
   * RATHER THAN CLOSED (CNCORE-113). The anchor is read here and its closeness
   * is computed in the NEXT statement, so an item deleted between the two is
   * titled for this check and untitled for that one. The window is still two
   * statements wide -- closing it would mean joining the anchor in as a
   * relation, which ADR-0119 prices as a worse trade than the extra lookup, and
   * that record deliberately keeps the closeness on the server -- but
   * the anchor below carries the closeness as an EXPRESSION, and `pastTheRowIn`
   * reads a computed value that is NULL as "no position" and starts the search
   * over -- which is exactly what this check does a statement earlier.
   * BOTH SIDES OF THE WINDOW ANSWER THE SAME WAY, so which side a delete lands
   * on is no longer something a reader can tell. Asserted rather than reasoned:
   * `catalogue-search.test.ts` wedges the delete into the gap.
   *
   * ADR-0119 PRICES THE WIDER VERSION OF THE SAME RACE -- an anchor retitled
   * "inside the seconds between two clicks" -- as the cost of a cursor that is
   * an id, and that one is untouched: a retitle leaves a closeness to rank by,
   * so the cursor moves rather than losing its place.
   *
   * THE CATALOGUE'S WALK HAS NO EQUIVALENT. It embeds the anchor's sort key as
   * a VALUE read in the first statement, so a delete between the two changes no
   * predicate. Only a relevance order re-derives the anchor on the server.
   */
  if (anchor.title === null || anchor.sortKey === null) return undefined;
  /*
   * THE CLOSENESS IS AN EXPRESSION AND THE SORT KEY IS A VALUE, which is the
   * one place in this app where an anchor carries both -- and it is the shape
   * the ticket had to make the interface carry rather than work around.
   *
   * THE SORT KEY WAS READ, a statement ago, and a value read is a value the
   * read has already ruled on: this function answers `undefined` where the
   * item is no anchor, so what it does hand back is one.
   *
   * THE CLOSENESS CANNOT BE. It is a function of the QUERY the request
   * resupplied rather than a column of the anchor row (ADR-0120), so it is
   * computed in the walk's own statement -- and it is deliberately not carried
   * out through the driver and back, for the reason `closenessOfTheAnchor`
   * gives: what a `real` compares equal to depends on its inferred type, and
   * relevance ties are the common case.
   */
  return {
    closeness: closenessOfTheAnchor(db, anchor.id, query),
    sortKey: anchor.sortKey,
    id: anchor.id,
  };
}
