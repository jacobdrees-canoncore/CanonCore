import { and, eq, gt, isNull, or, type SQL, type SQLWrapper, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * THE ORDER ONE LISTING IS READ IN: the keys it sorts on, most significant
 * first, and the id behind them that makes it total.
 *
 * IT IS ONE VALUE BECAUSE A LISTING'S ORDER IS TWO STATEMENTS -- the `ORDER BY`
 * and the cursor comparison that walks it -- and until CNCORE-169 they were two
 * INDEPENDENT statements that had to name the same terms. Nothing required them
 * to: `queries.ts` said so in prose, twice, and FOUR defects came from them
 * disagreeing anyway. A relevance order whose comparison named closeness and
 * the id but not the sort key between them, so results tied on closeness were
 * stepped over (CNCORE-88). A deleted anchor read as though it were an untitled
 * one (CNCORE-110). An anchor whose closeness went NULL between two statements,
 * which makes the whole comparison NULL and the page empty (CNCORE-113). And an
 * order of four keys handed to a comparison built for one (CNCORE-125).
 *
 * SO THE KEYS ARE WRITTEN ONCE AND BOTH HALVES ARE DERIVED. `theOrderBy` reads
 * them and `pastTheRowIn` reads them, and there is no third place to write them
 * down differently. Adding a key to an order reaches the sort and the walk in
 * the same edit, which is what the four defects each needed and none had.
 *
 * `Order` RATHER THAN `Ordering`, WHICH IS `CONTEXT.md`'S WORD FOR SOMETHING
 * ELSE. An Ordering there is the Placement construct -- a container's own
 * sequence of what it holds -- and the glossary is binding on names in code, so
 * a second sense of it here would be the hazard this repo already refuses for
 * `duplicate`, `canon`, `record` and `edge`. "The order" is what these files
 * have always called this in prose: `pastInTheOrder`, `findInTheOrder`,
 * `PlaceInTheOrder`. The glossary now carries the entry.
 *
 * THE KEYS ARE NAMED RATHER THAN NUMBERED, and the names are how a place is
 * read back. Two parallel lists -- the keys here and their anchor values
 * somewhere else -- can come apart, and the shorter one would silently drop a
 * term, which is the very failure this exists to stop. Named, a place is
 * checked against the order that produced it (see `PlaceIn`).
 *
 * THE ORDER OF THE KEYS IS THE OBJECT'S OWN, which is well defined for string
 * keys and is the same thing Drizzle's `select({...})` relies on to decide what
 * a query's columns are called.
 */
/**
 * ONE KEY OF AN ORDER: a column, or an expression over columns.
 *
 * NARROWER THAN `SQLWrapper`, WHICH `pastTheRow` BELOW TAKES, and the
 * difference is what lets an order be SELECTED as well as sorted and compared.
 * A place is read by the order's own keys -- `select({ ...order.keys })` -- so
 * the values cannot come from a list written out beside them, and Drizzle's
 * `select` will not take the broad interface. The catalogue's key is an
 * expression (ADR-0014's projection) and its id is a column, so both arms are
 * in use here rather than one being kept for later.
 */
type AKey = SQL | AnyPgColumn;

export interface TheOrder {
  /** The keys, most significant first, by the name a place gives each. */
  readonly keys: Readonly<Record<string, AKey>>;
  /**
   * THE ID BEHIND THEM, which is the whole of the order once every key has
   * tied and is what makes it TOTAL. Two rows sharing every key are separated
   * by it, and a walk without it steps over the second of them.
   */
  readonly id: AKey;
}

/**
 * WHERE ONE ROW SITS IN ONE ORDER: a value for each of that order's keys, under
 * the name the order gives it, and the row's id.
 *
 * IT IS DERIVED FROM THE ORDER rather than declared beside it, so a key added
 * to an order makes every place that does not carry it a TYPE ERROR. That is
 * the compiler saying what the four defects each had to be measured to find:
 * the walk reads a term the anchor was never asked for.
 */
export type PlaceIn<O extends TheOrder> = {
  readonly [K in keyof O["keys"]]: string | number | null;
} & { readonly id: string };

/**
 * THE `ORDER BY` THIS ORDER READS IN.
 *
 * `nulls last` IS THE DEFAULT FOR `asc` AND IS WRITTEN OUT ANYWAY, because
 * `pastTheRow` below reads it: a row with no value for a key sits at the end of
 * that key's block, and where those sit decides which half of the comparison
 * finds them. A default the walk depends on is one worth saying out loud.
 *
 * EVERY KEY ASCENDING, WHICH IS EVERY ORDER THIS APP HAS BUT ONE. Catalogue
 * search leads on `similarity(...) desc`, and it is not on this yet: CNCORE-170
 * moves it, and adds the direction with the reader that needs it rather than
 * ahead of one.
 */
export function theOrderBy(order: TheOrder): SQL[] {
  return [...Object.values(order.keys).map((key) => sql`${key} nulls last`), sql`${order.id}`];
}

/**
 * EVERYTHING ONE ORDER LISTS AFTER ONE ROW -- the cursor comparison, derived
 * from the same keys the sort is (ADR-0119).
 *
 * THE PAIRING IS THE POINT. A key and its anchor value are read out of one
 * object by one name, so the comparison cannot name a term the order does not,
 * and the order cannot name one the comparison misses.
 */
export function pastTheRowIn<O extends TheOrder>(order: O, place: PlaceIn<O>): SQL | undefined {
  const at = place as Readonly<Record<string, string | number | null>> & { readonly id: string };
  return pastTheRow(
    Object.entries(order.keys).map(([name, key]) => {
      const value = at[name];
      // THE TYPE ABOVE ALREADY REFUSES THIS, and it is still worth saying: a
      // missing value read as `null` is the "already among the rows with no
      // key" regime, which walks a listing from the wrong place in silence.
      if (value === undefined) throw new Error(`the order's key ${name} has no value in its place`);
      return { key, at: value };
    }),
    { id: order.id, at: at.id },
  );
}

/**
 * EVERYTHING A LISTING SHOWS AFTER ONE ROW, where the order is a list of keys
 * that may be NULL and an id behind them (ADR-0119). Written ONCE for every
 * such walk.
 *
 * TWO REGIMES, AND A ROW COMPARISON CANNOT EXPRESS BOTH. The order is the rows
 * with a key ascending and then the rows with none, so `(null, x) > (k, y)` --
 * which is NULL rather than true -- would drop that whole keyless block off the
 * walk permanently, from every page. The catalogue's keyless block is the items
 * nobody has titled and a container's is its Unplaced members; both are real
 * rows a reader must reach, and the criterion is that none is skipped.
 *
 * AND THE ID IS THE HALF THAT MAKES IT TOTAL. Two rows sharing a key are
 * separated by their ids, and a cursor comparing only the key steps over the
 * second of them -- a tie in the catalogue's order, and in a container's a pair
 * ADR-0009 licenses by keeping no unique constraint on (container_id, position).
 *
 * BUILT WITH THE QUERY BUILDER'S OWN `or` AND `and` rather than one raw `sql`
 * template, which ADR-0119 records as a precedence bug no walk test can see:
 * `A or (B and C)` written raw and composed with a listing's own `WHERE`
 * renders as `(within and A) or (B and C)`, and the tie branch escapes the
 * listing entirely.
 *
 * ONE FUNCTION AND NOT TWO, WHICH REVIEW OF CNCORE-89 ASKED FOR. The three
 * walks had a copy each, identical but for which columns they named -- and
 * every paragraph above is a rule that has to hold in all of them.
 * `walkListing`'s QUERY is what could not be shared (a different relation),
 * which is a narrower claim than the one the copy was making.
 *
 * IT TAKES A LIST OF TERMS BECAUSE "ALSO APPEARS IN" HAS FOUR, and that is the
 * question CNCORE-125 was told to ask rather than assume: the shared comparison
 * did NOT cover that order and had to grow. One key was never the rule -- it
 * was the number the first four listings happened to need -- and the rule
 * underneath is that the comparison must name EVERY term the `ORDER BY` does.
 * A key left out of it is rows silently stepped over, which is what the two
 * paragraphs above are each an instance of.
 *
 * A TERM IS A KEY AND ITS ANCHOR VALUE TOGETHER, rather than two lists read by
 * the same index. Review of CNCORE-125 made the point and it is this function's
 * own subject: two parallel arrays can come apart, and the shorter one would
 * silently drop a term -- which is precisely the "rows stepped over" failure the
 * paragraph above names. Paired, a mismatch cannot be written down.
 *
 * THE NESTING IS BUILT FROM THE INSIDE OUT, so each key's tie branch is the
 * whole of the comparison on the keys behind it and the id is the innermost. A
 * flat `or` of per-key clauses would be a different and wrong predicate: it
 * would answer true for a row that sorts BEFORE the anchor on an early key and
 * after it on a late one.
 *
 * IT IS `pastTheRowIn` ABOVE THAT LISTINGS REACH FOR, and this is what that is
 * built on. The terms here are a list a caller writes out, which is the half
 * CNCORE-169 took away: an order names its keys once and both statements are
 * read off it. The two listings still on this one move in CNCORE-170.
 */
export function pastTheRow(
  terms: { key: SQLWrapper; at: string | number | null }[],
  row: { id: SQLWrapper; at: string },
): SQL | undefined {
  // The id is the whole order left once every key has tied, and it is total.
  let past: SQL | undefined = gt(row.id, row.at);
  for (const { key, at } of [...terms].reverse()) {
    past =
      at === null
        ? // Already among the rows with no key HERE, so everything still ahead
          // has no key here either and the terms behind it decide.
          and(isNull(key), past)
        : or(
            // Every row with no key sorts after every row with one.
            isNull(key),
            gt(key, at),
            // THE TIE, and it is what carries the comparison to the next term.
            and(eq(key, at), past),
          );
  }
  return past;
}
