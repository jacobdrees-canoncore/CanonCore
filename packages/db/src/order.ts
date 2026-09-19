import {
  and,
  eq,
  gt,
  gte,
  is,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * WHAT A KEY IS MADE OF: a column, or an expression over columns.
 *
 * NARROWER THAN `SQLWrapper`, and the difference is what lets an order be
 * SELECTED as well as sorted and compared. An anchor is read by the order's own
 * keys -- `select(theAnchorIn(order))`, which is what the two reads in
 * `queries.ts` do -- so the values cannot come from a list written out
 * beside them, and Drizzle's `select` will not take the broad interface. The
 * catalogue's key is an expression (ADR-0014's projection) and its id is a
 * column, so both arms are in use here rather than one being kept for later.
 */
type AnExpression = SQL | AnyPgColumn;

/**
 * ONE KEY OF AN ORDER: an expression, or an expression with the three things
 * about a key an expression cannot say -- WHICH WAY THE LISTING READS IT,
 * WHETHER THE LISTING HOLDS ROWS WITH NO VALUE FOR IT, and WHAT A DELETE DOES
 * TO IT.
 *
 * A BARE EXPRESSION SAYS ALL THREE THE ORDINARY WAY: read smallest first, with
 * a block of rows that have none at the end of it, and nothing a delete can
 * take away. The block is a real one wherever a key has it -- the items nobody
 * has titled, a container's Unplaced members, a placement no source stands
 * behind.
 *
 * THE FIRST TWO ARE ON THE KEY BECAUSE BOTH STATEMENTS READ THEM.
 * `theOrderBy` renders `desc` and the nulls clause; `pastTheRowIn` compares
 * with `<` instead of `>` and decides whether the keyless block is a branch of
 * the comparison at all. Those are the same two statements every paragraph in
 * this file is about keeping in step, and a property written beside the order
 * rather than on the key would be a second list of its keys -- which is the
 * failure this module exists to abolish.
 *
 * `everyRowHasIt` IS A FACT ABOUT THE LISTING RATHER THAN ABOUT THE EXPRESSION,
 * and it is a claim its Listing has to be able to make. Catalogue search can:
 * every row it lists matched `title ilike ...`, which is NULL without a title,
 * so every row has a title and `similarity()` over one is never null. It was a
 * COMMENT justifying a hand-written predicate until CNCORE-170 and is a
 * declaration the general one reads now.
 *
 * IT IS NOT TIDINESS, AND THE PRICE OF LEAVING IT UNSAID WAS MEASURED. A
 * keyless branch on a key is `key IS NULL`, which for a COMPUTED key is the
 * whole expression evaluated a second time PER ROW -- and PostgreSQL does not
 * fold that away even though `similarity()` is strict.
 *
 * MEASURED 2026-09-14 on the PostgreSQL 18.6 `compose.yaml` pins: an
 * 11,000-row catalogue with a trigram index, a paged search of 101 rows over
 * 10,500 matches, `explain (analyze)` five times per shape and INTERLEAVED,
 * because the first pass at this ran the shapes in blocks on a box that was
 * getting busier and read the drift as the difference. Declared, this walk
 * costs 35.7-41.8 ms against 34.7-48.3 ms for the hand-written predicate it
 * replaces -- parity. Undeclared it costs 50.1-64.1 ms, so the branch that can
 * never be true is the most expensive thing in the statement. A query matching
 * 500 rows, which is the ordinary case, moves 2.3-2.4 ms to 2.3-2.9 ms.
 *
 * AND NO TEST CAN CATCH `everyRowHasIt` DECLARED WRONGLY, which is the honest
 * cost of it and is said here rather than left for a reviewer to find. Declared
 * on a key a listing's rows CAN be null on, it deletes the branch that reaches
 * them and those rows are silently skipped -- and no Listing in this app has
 * such a key, so no test at any seam would go red. What holds it up is the
 * Listing's own `WHERE`: Catalogue search's is `title ilike ...`, and that is
 * the sentence `theRanking` has to keep true. Do not declare it to save the
 * branch; declare it because the listing cannot hold such a row.
 *
 * `destroyedBy` IS THE THIRD, AND ONLY THE READ THAT FINDS AN ANCHOR ASKS IT. A
 * key on ADR-0014's projection reads NULL once its row is deleted: migration 5
 * tombstones every statement of a deleted item, that re-fires the projection,
 * and the projection over no live statements is NULL. So the value is GONE
 * rather than hidden, and the null a delete leaves looks exactly like an
 * untitled row's -- but the untitled row sits in the keyless block and the
 * deleted one sits nowhere, so it is no anchor at all. That is ADR-0119's
 * tombstone split, and the key names the tombstone that tells the two apart;
 * `stillAnAnchorIn` reads it. WHAT a delete does is a fact about the
 * expression, but it is DECLARED per order, and only where it changes an
 * answer: on a key with a keyless block. On a key every row has, a null is no
 * anchor whatever took it and `AnchorIn` already refuses one, so Catalogue
 * search holds the catalogue's key and does not say it. It is on the key, like
 * the other two, because a property written beside the order would be a second
 * list of its keys.
 *
 * A DESCRIBED KEY IS SELECTED BY ITS EXPRESSION, through `theAnchorIn`. Spread
 * into a `select` it would be the description that was read, and that is a
 * type error at the read rather than a column that comes back wrong.
 */
type AKey =
  | AnExpression
  | {
      readonly key: AnExpression;
      /** The listing leads on the LARGEST value rather than the smallest. */
      readonly largestFirst?: true;
      /**
       * NO ROW OF THIS LISTING HAS NO VALUE HERE, so the key has no keyless
       * block and the comparison needs no branch for one.
       */
      readonly everyRowHasIt?: true;
      /**
       * THE TOMBSTONE THAT DESTROYS THIS KEY: once it is set, a null here means
       * the delete took the key, rather than that the row sits in the keyless
       * block.
       */
      readonly destroyedBy?: AnyPgColumn;
    };

/**
 * ONE KEY WITH EVERY PROPERTY SAID OUT LOUD, which is what the statements
 * below read. The bare expression is the sugar; this is what it means.
 *
 * `"key" in` RATHER THAN AN `instanceof`, and it is safe by measurement rather
 * than by assumption: neither a drizzle `SQL` nor a `Column` carries a `key`
 * property, checked 2026-09-14 on drizzle-orm 0.45.2 for a column, a raw
 * template and a `coalesce` expression.
 */
function described(key: AKey): {
  key: AnExpression;
  largestFirst: boolean;
  everyRowHasIt: boolean;
  destroyedBy?: AnyPgColumn;
} {
  return { largestFirst: false, everyRowHasIt: false, ...("key" in key ? key : { key }) };
}

/**
 * THE ORDER ONE LISTING IS READ IN: the keys it sorts on, most significant
 * first, and the id behind them that makes it total.
 *
 * IT IS ONE VALUE BECAUSE A LISTING'S ORDER IS TWO STATEMENTS -- the `ORDER BY`
 * and the cursor comparison that walks it -- and until CNCORE-169 they were two
 * INDEPENDENT statements that had to name the same terms, required to by a
 * sentence in prose and by nothing else. FOUR defects came of it, and ADR-0119
 * carries all four with their measurements; they are not restated here.
 *
 * THEY COME APART AT TWO SEAMS, WHICH IS WHY THIS MODULE HAS THE SHAPE IT HAS.
 * A TERM can go missing from the comparison while the `ORDER BY` still names it
 * (CNCORE-88, CNCORE-125), and that is what `theOrderBy` and `pastTheRowIn`
 * below make impossible. A VALUE for a term can go missing from the ANCHOR
 * (CNCORE-110, CNCORE-113), and that is what `AnchorIn` and `stillAnAnchorIn`
 * are for. Both are the same failure -- rows silently stepped over -- reached
 * from different ends.
 *
 * SO THE KEYS ARE WRITTEN ONCE AND EVERYTHING ELSE IS DERIVED. `theOrderBy`
 * reads them, `pastTheRowIn` reads them, `AnchorIn` is the shape of what an
 * anchor has to carry for them, and `theAnchorIn` and `stillAnAnchorIn` are the
 * read that finds one. There is no other place to write them down differently.
 * Adding a key to an order reaches the sort, the walk and the anchor in the
 * same edit, which is what the four defects each needed and none had.
 *
 * `Order` RATHER THAN `Ordering`, WHICH IS `CONTEXT.md`'S WORD FOR SOMETHING
 * ELSE -- the Placement construct, what a container keeps of its own members.
 * The glossary is binding on names in code and now carries **Order** too. "The
 * order" is what these files had always called this in prose anyway:
 * `pastInTheOrder`, `findInTheOrder`, `PlaceInTheOrder` (`AnchorInTheOrder` since
 * CNCORE-224).
 *
 * THE KEYS ARE NAMED RATHER THAN NUMBERED, and the names are how an anchor is
 * read back. Two parallel lists -- the keys here and their anchor values
 * somewhere else -- can come apart, and the shorter one would silently drop a
 * term, which is the very failure this exists to stop. Named, an anchor is
 * checked against the order that produced it (see `AnchorIn`).
 *
 * THE ORDER OF THE KEYS IS THE OBJECT'S OWN, which is well defined for string
 * keys and is the same thing Drizzle's `select({...})` relies on to decide what
 * a query's columns are called.
 */

export interface TheOrder {
  /** The keys, most significant first, by the name an anchor gives each. */
  readonly keys: Readonly<Record<string, AKey>>;
  /**
   * THE ID BEHIND THEM, which is the whole of the order once every key has
   * tied and is what makes it TOTAL. Two rows sharing every key are separated
   * by it, and a walk without it steps over the second of them.
   *
   * AN EXPRESSION AND NOT A KEY, so it carries no direction. It is read
   * smallest first in every order this app has, including the one that leads on
   * a descending key: Catalogue search ranks closest-first and then breaks its
   * ties the way every other Listing does, because a tie broken differently
   * would list two items in an order no other surface agrees with.
   */
  readonly id: AnExpression;
}

/**
 * WHERE ONE ROW SITS IN ONE ORDER: a value for each of that order's keys, under
 * the name the order gives it, and the row's id.
 *
 * IT IS DERIVED FROM THE ORDER rather than declared beside it, so a key added
 * to an order makes every anchor that does not carry it a TYPE ERROR. That is
 * the compiler saying what the four defects each had to be measured to find:
 * the walk reads a term the anchor was never asked for.
 *
 * AND A KEY EVERY ROW HAS CANNOT BE NULL HERE, which the type refuses rather
 * than the walk checking for. A null value for such a key would mean the anchor
 * is not among the rows the listing holds -- no anchor at all -- and the walk's
 * keyless regime would answer it with a predicate NO ROW SATISFIES, which is an
 * empty page over rows still unseen (the failure CNCORE-113 measured). Nothing
 * produces one, and now nothing can: it is a type error at whichever read tried
 * to, which is louder and cheaper than a branch nothing reaches.
 *
 * A VALUE MAY BE AN EXPRESSION, which is what a key the walk computes for
 * itself needs (see `pastTheRowIn`), AND IT IS SPLICED INTO THE PREDICATE. So
 * an expression here is built from the order's own materials and from values
 * the query builder binds -- `closenessOfTheAnchor` is the only one in this
 * app, and it is a drizzle `select` over a column and a bound parameter. Never
 * `sql.raw`, and never anything a reader typed: what a reader types reaches
 * these statements as a BOUND PARAMETER, which is what `closenessTo` and
 * `titleMatches` one file over are each careful to be.
 */
export type AnchorIn<O extends TheOrder> = {
  readonly [K in keyof O["keys"]]: O["keys"][K] extends { readonly everyRowHasIt: true }
    ? string | number | SQL
    : string | number | null | SQL;
} & { readonly id: string };

/** What a key is selected by: its expression, without what it says about it. */
type TheExpressionOf<K extends AKey> = K extends { readonly key: infer E } ? E : K;

/** What `theAnchorIn` selects: each key's expression under its name, and the id. */
type TheColumnsOfAnAnchorIn<O extends TheOrder> = {
  [N in keyof O["keys"]]: TheExpressionOf<O["keys"][N]>;
} & { id: O["id"] };

/**
 * THE COLUMNS AN ANCHOR IS READ BY: each key's expression under the name the
 * order gives it, and the id. So `select(theAnchorIn(order))` answers an
 * `AnchorIn<typeof order>`, and a key the order gains is one the read cannot be
 * left without.
 *
 * THE READS SPREAD `order.keys` UNTIL CNCORE-195, which held only while every
 * key they read was a bare expression. A key that says what a delete does to it
 * is a description, and a description spread into a `select` is not its
 * column.
 */
export function theAnchorIn<O extends TheOrder>(order: O): TheColumnsOfAnAnchorIn<O> {
  return {
    ...Object.fromEntries(
      Object.entries(order.keys).map(([name, aKey]) => [name, described(aKey).key]),
    ),
    id: order.id,
  } as TheColumnsOfAnAnchorIn<O>;
}

/**
 * THE ROWS THAT ARE STILL AN ANCHOR IN THIS ORDER, for the read that finds
 * one: ADR-0119's tombstone split, read off the keys rather than written
 * beside them.
 *
 * AN ANCHOR IS READ PAST ITS TOMBSTONE, because it is a position rather than
 * something a reader is shown -- ADR-0075's rule is about what is shown -- and
 * a delete takes a position away only where it DESTROYS a key. A key that says
 * so is refused on THE PAIR, its value null and its tombstone set, and neither
 * half alone is the rule: the tombstone alone would refuse an anchor whose key
 * a delete had left standing, and the null alone would refuse an untitled row,
 * which sits in the keyless block and is resumed from. Answering a deleted
 * anchor as an untitled one resumed a kept link from the untitled tail with
 * every titled row between skipped (CNCORE-110).
 *
 * A ROW THIS REFUSES IS NOT READ AT ALL, so the read answers `undefined`, which
 * is what it already answers for an id that names nothing: the walk starts over
 * (ADR-0066). The two facts had one answer already and now share one path to
 * it.
 *
 * `undefined` WHERE NO KEY IS DESTROYED BY A DELETE, which drizzle's `and`
 * leaves out of a `where`. A Container's own order is on a stored column no
 * tombstone touches, so an anchor there outlives the delete and a kept link
 * into it resumes.
 */
export function stillAnAnchorIn(order: TheOrder): SQL | undefined {
  return and(
    ...Object.values(order.keys).map((aKey) => {
      const { key, destroyedBy } = described(aKey);
      return destroyedBy === undefined ? undefined : or(isNotNull(key), isNull(destroyedBy));
    }),
  );
}

/**
 * THE `ORDER BY` THIS ORDER READS IN.
 *
 * `nulls last` ON EVERY KEY THAT HAS A KEYLESS BLOCK, whichever way it is read,
 * which is one rule and not two: the rows with no value for a key sit at the
 * END of that key's block and `pastTheRowIn` below is written to that. Where
 * they sit decides which half of the comparison finds them, so it is not a
 * detail either statement may hold an opinion of its own about.
 *
 * ASCENDING IT IS ALSO POSTGRESQL'S DEFAULT and is written out anyway, because
 * a default a walk depends on is one worth saying out loud. DESCENDING IT IS
 * NOT -- `desc` defaults to NULLS FIRST -- so on a descending key the clause is
 * a decision rather than an explicitness.
 *
 * AND A KEY EVERY ROW HAS GETS NO CLAUSE AT ALL, because a rule about rows that
 * do not exist is a statement about nothing. Catalogue search declares it on
 * BOTH its keys -- one `ilike` settles both, see `theRanking` -- so its
 * `ORDER BY` renders `similarity(...) desc`, which is exactly what it rendered
 * before CNCORE-170 moved it, and `coalesce(sort_name, title)`, which is NOT:
 * that term used to carry a `nulls last` written out by hand. THE SORT IS
 * UNCHANGED, and that is PostgreSQL's own default rather than a hope --
 * "NULLS FIRST is the default for DESC order, and NULLS LAST otherwise" -- so
 * an ascending key with no clause is an ascending key with `nulls last`. An
 * earlier draft of this paragraph claimed the whole `ORDER BY` was rendered
 * byte for byte as before, which was measured BEFORE the second key declared
 * anything and never measured again; it is the one thing in this change that
 * was asserted rather than checked, and commit e552b55's message still carries
 * it.
 */
export function theOrderBy(order: TheOrder, { backward = false } = {}): SQL[] {
  return [
    ...Object.values(order.keys).map((aKey) => {
      const { key, largestFirst, everyRowHasIt } = described(aKey);
      // BACKWARD IS EVERY TERM TURNED ROUND, the keyless block included: it sat
      // at the end of each key's block, so read from the other end it comes
      // first (CNCORE-174).
      const read = largestFirst !== backward ? sql`${key} desc` : sql`${key}`;
      if (everyRowHasIt) return read;
      return backward ? sql`${read} nulls first` : sql`${read} nulls last`;
    }),
    backward ? sql`${order.id} desc` : sql`${order.id}`,
  ];
}

/**
 * ONE POINT IN AN ORDER THAT A PAGE IS READ FROM (CNCORE-174), and three ways
 * to name it: just past a Row, just short of one, or where a value of the
 * leading key begins.
 *
 * `after` IS ADR-0119's CURSOR, the walk forward. `before` IS THE STEP BACK:
 * the first Row of the page a reader is on, and the page answered is the one
 * that ends just short of it. `atOrPast` IS THE JUMP: the first Row whose
 * leading key sorts at or past a value, which is a letter for the catalogue --
 * a SEEK on the key the walk already sorts by, and no offset anywhere.
 *
 * TYPED AGAINST THE ORDER, as `AnchorIn` is and for its reason: an anchor read
 * in one order cannot be handed to a walk in another.
 */
export type ACutIn<O extends TheOrder> =
  | { readonly after: AnchorIn<O> }
  | { readonly before: AnchorIn<O> }
  | { readonly atOrPast: string | number };

/**
 * A LISTING SPLIT IN TWO AT ONE POINT: the rows AHEAD of the point, and which
 * side of it a page is read from. Everything else is BEHIND it.
 *
 * ONE PREDICATE AND NOT TWO, which is this module's whole argument applied to a
 * second direction. What lies behind a point is exactly what does not lie ahead
 * of it, so it is `not(ahead)` rather than a second comparison written the
 * other way round -- and the step back cannot disagree with the walk forward
 * about where a tie or the keyless block falls, because there is one statement
 * of it. `pastTheRowIn` says why its predicate is never NULL on a row a Listing
 * holds, which is the property a complement needs.
 */
export interface TheCut {
  /** Every row the order lists ahead of the point. */
  readonly ahead: SQL;
  /** The page is the one BEHIND the point, read back towards the start. */
  readonly readsBack: boolean;
}

/** The cut one point names, as the two sides a page can be read from. */
export function theCut<O extends TheOrder>(order: O, cut: ACutIn<O>): TheCut {
  if ("after" in cut) return { ahead: pastTheRowOrThrow(order, cut.after), readsBack: false };
  if ("before" in cut) {
    // THE ROW NAMED IS AHEAD OF THE POINT, because it is the first Row of the
    // page the reader is stepping back FROM: the page answered ends short of it.
    const id: SQLWrapper = order.id;
    const ahead = or(pastTheRowOrThrow(order, cut.before), eq(id, cut.before.id)) as SQL;
    return { ahead, readsBack: true };
  }
  return { ahead: atOrPastTheValueIn(order, cut.atOrPast), readsBack: false };
}

/** `pastTheRowIn`, which always renders a predicate: the id is always a term. */
function pastTheRowOrThrow<O extends TheOrder>(order: O, anchor: AnchorIn<O>): SQL {
  const past = pastTheRowIn(order, anchor);
  if (past === undefined) throw new Error("an order's comparison rendered nothing");
  return past;
}

/**
 * EVERY ROW WHOSE LEADING KEY SORTS AT OR PAST ONE VALUE, and the rows with no
 * value for it, which sort after every value there is. The jump (CNCORE-174).
 *
 * THE LEADING KEY ONLY, because a value of it is all a reader names: "M" is a
 * place in the alphabet and says nothing about the keys behind it. So the page
 * starts at the first Row of that key's block, ties and all, which is where a
 * seek on the key lands.
 *
 * NEVER NULL ON A ROW, which the cut's complement needs: `>=` is NULL only on a
 * row with no key, and that row is answered by the branch before it.
 */
function atOrPastTheValueIn(order: TheOrder, value: string | number): SQL {
  const [leading] = Object.values(order.keys);
  if (leading === undefined) return sql`true`;
  const { key: theKey, largestFirst, everyRowHasIt } = described(leading);
  const key: SQLWrapper = theKey;
  const atOrPast = largestFirst ? lte(key, value) : gte(key, value);
  return everyRowHasIt ? atOrPast : (or(isNull(key), atOrPast) as SQL);
}

/**
 * EVERYTHING ONE ORDER LISTS AFTER ONE ROW -- the cursor comparison, derived
 * from the same keys the sort is (ADR-0119). Written ONCE for every walk in
 * this app.
 *
 * THE PAIRING IS THE POINT. A key and its anchor value are read out of one
 * object by ONE NAME, so the comparison cannot name a term the order does not,
 * and the order cannot name one the comparison misses. It took a LIST of terms
 * a caller wrote out until CNCORE-170, and two lists read by the same index are
 * two lists that can come apart -- the shorter one silently dropping a term,
 * which is precisely the "rows stepped over" failure the whole module is about.
 *
 * TWO REGIMES, AND A ROW COMPARISON CANNOT EXPRESS BOTH. A key's rows run in
 * its direction and then the rows with NO value for it, so `(null, x) > (k, y)`
 * -- which is NULL rather than true -- would drop that whole keyless block off
 * the walk permanently, from every page. The catalogue's keyless block is the
 * items nobody has titled and a container's is its Unplaced members; both are
 * real rows a reader must reach, and the criterion is that none is skipped.
 *
 * AND THE ID IS THE HALF THAT MAKES IT TOTAL. Two rows sharing every key are
 * separated by their ids, and a cursor comparing only the keys steps over the
 * second of them -- a tie in the catalogue's order, a relevance tie in
 * Catalogue search's, and in a container's a pair ADR-0009 licenses by keeping
 * no unique constraint on (container_id, position).
 *
 * BUILT WITH THE QUERY BUILDER'S OWN `or` AND `and` rather than one raw `sql`
 * template, which ADR-0119 records as a precedence bug no walk test can see:
 * `A or (B and C)` written raw and composed with a listing's own `WHERE`
 * renders as `(within and A) or (B and C)`, and the tie branch escapes the
 * listing entirely.
 *
 * IT COVERS AN ORDER OF ANY WIDTH BECAUSE "ALSO APPEARS IN" HAS FOUR KEYS, and
 * that is the question CNCORE-125 was told to ask rather than assume: the shared
 * comparison did NOT cover that order and had to grow. One key was never the
 * rule -- it was the number the first four listings happened to need -- and the
 * rule underneath is that the comparison must name EVERY term the `ORDER BY`
 * does.
 *
 * THE NESTING IS BUILT FROM THE INSIDE OUT, so each key's tie branch is the
 * whole of the comparison on the keys behind it and the id is the innermost. A
 * flat `or` of per-key clauses would be a different and wrong predicate: it
 * would answer true for a row that sorts BEFORE the anchor on an early key and
 * after it on a late one.
 */
export function pastTheRowIn<O extends TheOrder>(order: O, anchor: AnchorIn<O>): SQL | undefined {
  const at = anchor as Readonly<Record<string, string | number | null | SQL>> & {
    readonly id: string;
  };
  // The id is the whole order left once every key has tied, and it is total.
  //
  // WIDENED TO `SQLWrapper` HERE AND BELOW, which is what drizzle's comparisons
  // take: `AnExpression` is narrower so that an order can be SELECTED, and the
  // narrow union matches neither overload of `gt` on its own.
  const id: SQLWrapper = order.id;
  let past: SQL | undefined = gt(id, at.id);
  for (const [name, aKey] of Object.entries(order.keys).reverse()) {
    const { key: theKey, largestFirst, everyRowHasIt } = described(aKey);
    const key: SQLWrapper = theKey;
    const value = at[name];
    // NOT DEAD CODE, AND THE CAST ABOVE IS WHY. `AnchorIn` refuses a missing
    // key at a call site that knows its order concretely -- but an anchor is
    // READ, and Drizzle cannot infer field types through an order it knows only
    // as `TheOrder`, so the read that produces one casts (measured: the select
    // infers `{ id: unknown }` without it). This is the check that survives the
    // cast. Loud, because the silent answer is the wrong one: a missing value
    // read as `null` is the "already among the rows with no key here" regime,
    // which walks a listing from the wrong place and says nothing.
    if (value === undefined) throw new Error(`the order's key ${name} has no value in its anchor`);
    // WHICH WAY "AFTER" RUNS, and it is the only thing the direction changes
    // here. `theOrderBy` renders `desc` off the same flag, so the two cannot
    // disagree about which end of a key a listing starts from.
    const after = largestFirst ? lt : gt;
    /*
     * THE ROWS WITH NO VALUE FOR THIS KEY, which sit at the end of its block
     * and are therefore past any anchor that has one. Where the listing holds
     * none, the branch is not written: for a computed key it is the whole
     * expression evaluated a second time per row, measured on `AKey` above.
     */
    const theKeylessBlock = everyRowHasIt ? [] : [isNull(key)];
    /*
     * AND THE ANCHOR ITSELF BEING GONE, where its value is one the walk
     * COMPUTES rather than one a read handed over. Catalogue search has the
     * app's only such key: closeness is a function of the QUERY the request
     * resupplied rather than a column of the anchor row (ADR-0120), so it is a
     * scalar subquery in THIS statement and cannot be ruled on a statement
     * earlier. Its NULL means what the guard above means -- no anchor -- and
     * CNCORE-113 is the width of the statement between the two moments: an
     * anchor deleted in the gap is titled for the read and untitled for this,
     * and a NULL on one side of a comparison makes the whole predicate NULL,
     * which answers an EMPTY PAGE over results still unseen.
     *
     * IT IS SPELLED `is null` ON THE VALUE RATHER THAN WRAPPED AROUND THE
     * COMPARISON, and the difference is which NULL it forgives. A `coalesce`
     * over the whole thing would answer "start over" for ANY null in it --
     * including a candidate row with no key of its own, which would then be
     * RETURNED by a listing it does not belong to. This names the anchor's null
     * and no other.
     */
    const theAnchorBeingGone = is(value, SQL) ? [sql`${value} is null`] : [];
    past =
      value === null
        ? // Already among the rows with no key HERE, so everything still ahead
          // has no key here either and the terms behind it decide.
          and(isNull(key), past)
        : or(
            ...theAnchorBeingGone,
            ...theKeylessBlock,
            after(key, value),
            // THE TIE, and it is what carries the comparison to the next term.
            and(eq(key, value), past),
          );
  }
  return past;
}
