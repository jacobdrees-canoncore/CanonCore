import {
  and,
  type Column,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  not,
  or,
  type SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import type { Database } from "./index";
import {
  type ACutIn,
  type AnchorIn,
  stillAnAnchorIn,
  type TheCut,
  type TheOrder,
  theAnchorIn,
  theCut,
  theOrderBy,
} from "./order";
import {
  aliases,
  groupItems,
  groups,
  itemKinds,
  items,
  placementSources,
  placements,
  properties,
  ranks,
  sources,
  statements,
} from "./schema";

export type ItemRow = typeof items.$inferSelect;

/**
 * One item as a reader is about to meet it: the stored row, and its kind IN THE
 * READER'S WORDS beside it.
 *
 * BOTH, UNDER NAMES THAT SAY WHICH IS WHICH, rather than the label written over
 * the key. `items.kind` is the foreign key into `item_kinds` and goes on being
 * the key here, because a field that means `time_span` from one query and
 * `Time span` from another is a hazard nothing in the types would catch.
 *
 * THE LABEL IS READ RATHER THAN MAPPED, exactly as `readCatalogue` reads it:
 * migration 1 seeds a label beside every kind for this, and a map written in
 * TypeScript would be the same rule in a second language -- stale the day the
 * migration that owns the words revises one.
 */
export type FoundItem = ItemRow & { kindLabel: string };

/** One ordering an item sits in, and where it sits (ADR-0009, ADR-0018). */
export interface PlacementOfItem {
  id: string;
  containerId: string;
  /** ADR-0014: the projected column, so a reader sees a title and not an id. */
  containerTitle: string | null;
  /**
   * Where it sits, or NULL when no source has asserted a position for it --
   * a member of the container all the same (migration 2).
   */
  position: number | null;
  /**
   * The KIND of source that asserted this placement -- `owner` for the owner's
   * own hand, `provider` for an imported ordering, and so on (ADR-0071). Null
   * when nothing has claimed it, which is a placement no source stands behind.
   *
   * IT STAYS BESIDE `assertedBy` RATHER THAN BEING REPLACED BY IT. The filter
   * over this list is BY KIND and ADR-0017 settles its four words, so the two
   * fields answer different questions: this one how the item came to be in
   * there, the other who says so.
   */
  placedBy: string | null;
  /**
   * WHO SAYS IT SITS THERE: every source standing behind this placement, by the
   * label each calls itself, the one that SPEAKS for it first (ADR-0017). Empty
   * for a placement no source asserted.
   *
   * THE SET, WHERE `placedBy` IS ONE KIND, and that is the whole of CNCORE-121.
   * One container twice at two positions is a Repeat (ADR-0009) or two sources
   * disagreeing about position (ADR-0017), nothing STORED tells them apart, and
   * the kind cannot: the disagreement this catalogue holds is a wiki against a
   * broadcaster, so `placedBy` prints `provider` on both rows. It is CNCORE-90's
   * field, read from the other end of the same table.
   */
  assertedBy: string[];
}

/**
 * THE THREE TERMS THAT DECIDE WHICH SOURCE SPEAKS, written once because two
 * queries below read them and a third copy of this rule lives in SQL.
 *
 * They are `winning_literal`'s, in its order and for its reasons -- migration 1.
 * Rank first, because the owner's favourite is the lock and outranks the whole
 * source order (ADR-0024); then the one global source order (ADR-0025); then the
 * row id, an arbitrary but stable tiebreak. Recency is deliberately absent.
 *
 * `spokesmanFor` applies them to PICK one source and `assertersOf` to ORDER
 * every source, which is the same rule answering two questions rather than two
 * rules. Named here rather than written out twice: this file already carries a
 * paragraph about three copies of a rule whose whole point is that it is
 * identical, and that paragraph was about the version with three copies.
 *
 * THE COPY IN `winning_literal` CANNOT JOIN THEM, and that is the one place the
 * duplication is real: it is PL/pgSQL in a migration, which no TypeScript
 * constant reaches. Two languages, and the ADR says to keep them identical by
 * hand.
 */
const whoSpeaksFirst = [ranks.precedence, sources.sourceOrder, placementSources.id];

/**
 * THE LIVE CLAIMS BEHIND THE PLACEMENT THIS ROW IS FOR, and the tombstone both
 * readers honour.
 *
 * The placement source's OWN, the exact analogue of the statement's own that
 * `winning_literal` checks. `sources.deleted_at` is deliberately absent from
 * this and from `winning_literal` alike (ADR-0017): a query locally more correct
 * than its twin makes one field's provenance disagree with another's, in a way
 * that compiles perfectly. Nothing can delete a source today; when something
 * can, this is now ONE line rather than two.
 */
const standingBehindThePlacement = and(
  eq(placementSources.placementId, placements.id),
  isNull(placementSources.deletedAt),
);

/**
 * WHICH source speaks for a placement, when several do -- and, when two of them
 * disagree about position, WHICH OF THE TWO PLACEMENTS SPEAKS.
 *
 * THE SAME RULE `winning_literal` APPLIES TO A STATEMENT, written to match that
 * function term for term -- migration 1, `winning_literal`. Rank first, because
 * the owner's favourite is the lock and outranks the whole source order
 * (ADR-0024); then the one global source order (ADR-0025); then the row id, an
 * arbitrary but stable tiebreak. Recency is deliberately absent from both.
 *
 * IT IS ONE RULE IN TWO LANGUAGES, so the two are held identical rather than
 * each being locally sensible. An earlier draft of this query also excluded a
 * soft-deleted SOURCE, which `winning_literal` does not -- a difference that
 * compiles perfectly and quietly makes one field's provenance disagree with
 * another's. Neither honours it now, and ADR-0017 carries that as a named gap
 * belonging to whatever first lets a source be deleted. Nothing can today.
 *
 * The tombstone that IS honoured is the placement source's own, the exact
 * analogue of the statement's own that `winning_literal` checks.
 *
 * A LATERAL JOIN RATHER THAN A SUBQUERY PER FIELD, and that is the point of it.
 * The spokesman's kind, its rank and its place in the source order are three
 * facts about ONE row, and three correlated subqueries would each re-derive
 * that row from its own copy of the ordering -- three copies of a rule that has
 * to stay identical, which is the hazard this file already carries a paragraph
 * about. Picked once, read three times.
 */
function spokesmanFor(db: Database) {
  return db
    .select({
      kind: sources.kind,
      /** ADR-0024, and the FIRST term: the favourite outranks everything. */
      precedence: ranks.precedence,
      /** ADR-0025, the second: one global order for the whole instance. */
      sourceOrder: sources.sourceOrder,
    })
    .from(placementSources)
    .innerJoin(sources, eq(sources.id, placementSources.sourceId))
    .innerJoin(ranks, eq(ranks.rank, placementSources.rank))
    .where(standingBehindThePlacement)
    .orderBy(...whoSpeaksFirst)
    .limit(1)
    .as("spokesman");
}

/** Every ordering one item sits in, and how much of it this answer carries. */
export interface PlacementsOfItem {
  rows: PlacementOfItem[];
  /**
   * How many appearances the item has ALTOGETHER -- its placements, so a
   * Repeat counts twice (CNCORE-236) -- which is not `rows.length` whenever
   * the cap bit. A surface that cannot tell the two apart reports the first
   * hundred as every appearance there is.
   */
  total: number;
  /** How many Rows sort before this page's first: `Catalogue`'s `rowsBefore` (ADR-0133). */
  rowsBefore: number;
  /**
   * The PLACEMENT to walk on from, or `null` where the list ends here.
   *
   * A PLACEMENT'S ID AND NOT A CONTAINER'S, for the mirror of the reason
   * `PlacementsInContainer` gives: a Repeat is one item twice in ONE container
   * (ADR-0009), so from this end too a container id names two rows and cannot
   * say which of them a page ended on. ADR-0119's letter says the cursor is the
   * id of the last Item the page showed; in both listings whose rows are
   * placements it is the row the page ended on instead.
   */
  continuesAfter: string | null;
  /** The placement to step back from, or `null` where nothing comes before this page (CNCORE-174). */
  continuesBefore: string | null;
  /**
   * EVERY ORIGIN THE ITEM HAS A PLACEMENT FROM -- the source kinds of ADR-0071,
   * as `placedBy` on a row carries one.
   *
   * NAMED FOR `CONTEXT.md`'s **Placed by**, which is the glossary's word for
   * this and is binding on names in code. "Origin" is the prose word the
   * records and the ticket use for one of its values, and it stays prose: the
   * glossary gives it no entry, and the same word already means a WEB origin in
   * that file and in ADR-0066, so a field named for it would be a third sense.
   * `every` because this is the whole set and not the narrowing that was asked.
   *
   * IT IS THE ONE FACT HERE THE NARROWING DOES NOT TOUCH, which is what it is
   * for: these are what a reader narrows WITH, so they are the origins of the
   * WHOLE listing whichever page this is and whichever origin it was cut to.
   * Derived from the rows they would collapse to the origin already chosen,
   * and the way back to All would be to edit the address by hand.
   *
   * EMPTY FOR AN ITEM NOTHING HAS ASSERTED A PLACEMENT OF, which is not the same
   * as an item in no ordering: a placement no source stands behind is a real
   * ordering with no origin (ADR-0017), so it is counted in `total` and named
   * here by nothing.
   */
  everyPlacedBy: string[];
}

/**
 * Every ordering one item belongs to -- CAPPED, COUNTED AND WALKED (ADR-0119,
 * CNCORE-125). The product's central claim, read back: one item in many
 * containers at once, each with a position of its own (ADR-0009), and the
 * position lives on the PLACEMENT rather than on the item (ADR-0018) so no
 * ordering can overwrite another's.
 *
 * IT WAS THE LAST UNCAPPED LISTING IN THE APP, which is the whole of why this
 * ticket exists: ADR-0119's first sentence is "every listing in CanonCore is
 * capped", CNCORE-89 capped the other listing on this same page, and this one
 * took no `limit` and no `after` while `item.get` awaited it on every item
 * page. Said with its limit, as the ticket asks: nothing measures how many
 * orderings one item sits in, where ADR-0077 measures a container at 1,049
 * members -- so this is the rule applied for consistency rather than a page
 * anybody has watched fall over.
 *
 * IT DOES NOT GO THROUGH `walkListing` for the reason its mirror does not: that
 * function walks `items`, and this walks `placements`. What it shares is the
 * page -- `onePage` below -- and the order, which since CNCORE-170 is ONE VALUE
 * that `theOrderBy` and `pastTheRowIn` are both read off.
 *
 * THE ORDER IS FOUR KEYS AND THE OTHER TWO WALKS HAVE ONE, which is the thing
 * CNCORE-125 had to find out rather than assume: the container's projected sort
 * key, then ADR-0017's two terms deciding which source speaks, then the
 * position, with the placement's id behind them. Every one of the four is
 * nullable and each therefore has the two regimes that comparison is named for.
 * `thisItemsOrder` below is where they are named, ONCE.
 *
 * AND THE CAP IS WHAT BOUNDS CNCORE-121's LATERAL, which is the figure that
 * ticket measured and handed to this one rather than a coincidence. Each row
 * carries an aggregate naming every source behind it: MEASURED on one item
 * placed in 1,000 orderings with two sources each, 6.3-12.3 ms with it against
 * 3.6-4.1 ms without, over three runs on the PostgreSQL 18.6 `compose.yaml`
 * pins, the planner using `Index Scan using placement_sources_placement_source`
 * exactly as the container's end does. That ticket read it as sharpening the
 * cap's case rather than making it urgent, and said so because it could not
 * bound it itself. It is bounded now: the same lateral rides 100 rows rather
 * than an unbounded count, which is what CNCORE-89 already bought the mirror.
 */
export async function findPlacementsOfItem(
  db: Database,
  itemId: string,
  { limit, placedBy, ...at }: { limit: number; placedBy?: string } & WhereAPageIs,
): Promise<PlacementsOfItem> {
  const spokesman = spokesmanFor(db);
  const asserters = assertersOf(db);
  const sitsIn = whatItSitsIn(itemId, items.deletedAt);
  /*
   * THE NARROWING, AND IT IS PART OF THE QUESTION RATHER THAN OF THE ANSWER
   * (CNCORE-129). `?placed=` ran over the rows the page had been handed, which
   * was every ordering the item sits in only while this listing was uncapped.
   * Asked here it is the listing that is narrow: the cap, the count and the
   * walk are all over the rows that survive it, so a reader can reach past row
   * 100 OF THE NARROWING rather than past row 100 of the list it was cut from.
   *
   * IT COMPARES THE SPOKESMAN'S KIND, which is what `placedBy` on a row already
   * is: one placement can carry several sources, and the one that SPEAKS for it
   * is the one the row names (ADR-0017). Narrowing on any of them would answer
   * rows the page then labels with a different origin than the one asked for.
   *
   * AN ORIGIN THE ITEM HAS NOTHING FROM NARROWS TO NOTHING, which is ADR-0066's
   * rule for a parameter that is not an identity: out of scope it names nothing
   * rather than erroring, and a listing of no rows is what "nothing" looks like.
   */
  const narrowedTo = placedBy === undefined ? undefined : eq(spokesman.kind, placedBy);
  // BUILT FROM THE SPOKESMAN THIS STATEMENT JOINS, for the reason that lateral
  // gives: it is a relation, so the columns sorted and compared have to be the
  // ones the SELECT joined and not a second subquery's.
  const order = thisItemsOrder(spokesman);
  const cut = await theCutAt(at, (id) => findInThisItemsOrder(db, itemId, id));
  /*
   * THE SIZE (CNCORE-172), AND THE NARROWING IS INSIDE IT -- which is what
   * CNCORE-129 bought and what this keeps structural rather than remembered:
   * `size.within` is the whole question this Listing asks, so a narrowed page
   * cannot report the size of the list it was cut out of.
   *
   * THE LATERAL COMES AND GOES WITH THE NARROWING, and that is a measured cost
   * rather than tidiness. Counting does not need to know WHO asserted a row --
   * the spokesman decides an ORDER, and an order is not part of a count -- so
   * unnarrowed there is none. Narrowed, the kind being compared IS the
   * spokesman's, so the join that picks it has to be here. MEASURED under
   * CNCORE-129 on one item in 1,000 orderings with two sources each, over three
   * runs on PostgreSQL 18.6: 2.7-3.4 ms narrowed against 0.24-0.28 ms
   * unnarrowed, the planner using
   * `Index Scan using placement_sources_placement_source`. That is the price of
   * a narrowed count rather than of every count.
   *
   * AND THE PREDICATE RESOLVES IN WHICHEVER SCOPE IT IS SPLICED INTO.
   * `narrowedTo` is built from the walk's own spokesman and renders as
   * `"spokesman"."kind"`; spliced in here it binds to the lateral THIS query
   * joins, because SQL resolves a name in the innermost scope that has one.
   * That is what lets one fragment be the rows' narrowing and the count's at
   * once -- which is the whole reason they cannot drift.
   */
  const size = theSize(and(sitsIn, narrowedTo) as SQL, (reachingItsOrder) => {
    const counting = db
      .select(HOW_MANY)
      .from(placements)
      .innerJoin(items, eq(items.id, placements.containerId));
    // AND THE COUNT BEHIND A CUT NEEDS IT WHETHER OR NOT THIS IS NARROWED: it
    // compares this order's keys, two of which are the spokesman's
    // (`CountedFrom` says what leaving it out answers instead of an error).
    return narrowedTo === undefined && !reachingItsOrder
      ? counting
      : counting.leftJoinLateral(spokesmanFor(db), sql`true`);
  });

  /*
   * TWO READS, AND THE SECOND IS THE HALF THAT IS EASY TO MISS (CNCORE-129).
   * The chips a reader narrows WITH cannot be derived from the rows narrowing
   * hands back: a narrowed page holds the one origin it was narrowed to, so
   * they would collapse to the origin already chosen and leave no way back to
   * All but by hand. Which origins an item has placements from is a question of
   * its own, and this is it being asked.
   *
   * TWO STATEMENTS RATHER THAN ONE, so the two are not in one snapshot: an
   * origin whose last placement goes between them is offered as a chip that
   * answers nothing. The page reads as "nothing placed that way", which is the
   * ordinary answer for an origin with no rows -- where folding the second read
   * into the first would cost the page the lateral over every row of the count
   * to remove a state the reader cannot tell from the truthful one.
   */
  const [page, everyPlacedBy] = await Promise.all([
    onePage({
      limit,
      size,
      order,
      cut: cut && theCut(order, cut),
      read: (howMany, where, orderBy, behindTheCut) =>
        db
          .select({
            id: placements.id,
            containerId: placements.containerId,
            containerTitle: items.title,
            position: placements.position,
            placedBy: spokesman.kind,
            /*
             * WHO SAYS IT SITS THERE (ADR-0017, CNCORE-121). The same lateral the
             * container's end reads, correlated the same way -- one aggregate of
             * every live claim behind this placement, in the spokesman's own order.
             *
             * IT DOES NOT REPLACE THE SPOKESMAN LATERAL ABOVE, and both are needed
             * rather than one being tidier. The spokesman PICKS a row, and its rank
             * and source order are two of the terms this query ORDERS BY -- and now
             * two of the terms its CURSOR compares, since CNCORE-125 (ADR-0119). An
             * aggregate can be neither ordered by nor compared against, so
             * collapsing the two would cost the resolution ADR-0017 expresses as
             * order and the walk that resumes inside it.
             */
            assertedBy: asserters.labels,
            /*
             * THE SAME PREDICATE THE ROWS USE, in the same statement and
             * therefore the same snapshot, and UNCORRELATED so the cursor cannot
             * reach it -- all three for the reasons `walkListing` gives. The
             * subquery names `placements` and `items` in its own FROM, so those
             * names resolve to its own rows rather than to the walk's.
             *
             * THE NARROWING IS IN IT TOO SINCE CNCORE-129, which is what makes a
             * narrowed list report its own size rather than the size of the list
             * it was cut out of. `size` above is where that lives now.
             */
            total: size.onTheRows,
            behindTheCut,
          })
          .from(placements)
          .innerJoin(items, eq(items.id, placements.containerId))
          // LEFT, because a placement no source stands behind is still a placement.
          // An inner join would silently drop it, which is the read path deciding a
          // row does not exist because its provenance was never recorded.
          .leftJoinLateral(spokesman, sql`true`)
          /*
           * CROSS WHERE THE SPOKESMAN IS LEFT, and neither can drop a row: an
           * aggregate with no `group by` answers exactly one row whatever it
           * aggregates, so a placement no source stands behind joins an empty array
           * rather than nothing. The same pairing `findPlacementsInContainer` uses.
           */
          .crossJoinLateral(asserters)
          /*
           * BOTH READ OFF ONE VALUE (ADR-0119). `thisItemsOrder` below names the
           * four keys once; the sort and the comparison that walks it are read
           * off that name, so neither can name a term the other does not. This
           * is the order CNCORE-125 grew from one key to four, and doing that
           * used to mean editing two statements in two places.
           */
          .where(where)
          .orderBy(...orderBy)
          .limit(howMany),
    }),
    readEveryPlacedBy(db, sitsIn),
  ]);
  return { ...page, everyPlacedBy };
}

/**
 * EVERY ORIGIN ONE ITEM HAS A PLACEMENT FROM, and deliberately over `sitsIn`
 * rather than over the narrowing: this is the question the chips ask, and a
 * chip that vanished when the reader used it is a filter a reader cannot leave.
 *
 * THE KIND OF THE SOURCE THAT SPEAKS, which is the same thing `placedBy` on a
 * row is -- so every origin offered names rows the narrowing will actually
 * answer, and one that speaks for nothing is not offered.
 *
 * A CROSS LATERAL WHERE THE WALK'S IS LEFT, and the difference IS the answer: a
 * placement no source stands behind is a placement all the same and has no
 * origin at all, so it belongs in the listing and not in this. An outer join
 * would answer a null here, which is a chip with no word for it.
 *
 * ORDERED BY THE KIND, so the chips do not reorder between one page and the
 * next. It is the key rather than the reader's word because the read path emits
 * keys here (ADR-0045) -- the four words belong to the surface, and sorting on
 * words this query does not hold would be a second place for them to live.
 *
 * AND IT RUNS ON EVERY ITEM PAGE, NARROWED OR NOT, which is the cost the chips
 * carry: the spokesman's lateral over every placement of the item rather than
 * over a capped page of them. MEASURED under CNCORE-129 on one item in 1,000
 * orderings with two sources each: 2.7-2.8 ms over three runs on PostgreSQL
 * 18.6, `Index Scan using placement_sources_placement_source`, where the
 * unnarrowed count beside it takes 0.24-0.28 ms. Nothing measures an item in
 * that many orderings yet, so this is a ceiling a real catalogue has not reached
 * rather than a price anybody pays today.
 */
async function readEveryPlacedBy(db: Database, sitsIn: SQL): Promise<string[]> {
  const spokesman = spokesmanFor(db);
  const found = await db
    .selectDistinct({ kind: spokesman.kind })
    .from(placements)
    .innerJoin(items, eq(items.id, placements.containerId))
    .crossJoinLateral(spokesman)
    .where(sitsIn)
    .orderBy(spokesman.kind);
  return found.map(({ kind }) => kind);
}

/**
 * THE KEY "ALSO APPEARS IN" LEADS ON: the CONTAINER's projected sort key.
 *
 * `SORT_KEY` one section down is the same expression over the same columns, and
 * they are deliberately not shared. That one is the key an item sorts by IN THE
 * CATALOGUE, where `items` is the relation being listed; this one is a key of a
 * row that is joined IN -- the container an ordering belongs to -- and the two
 * happen to be spelled alike because a container is an item (ADR-0004). Sharing
 * the constant would tie a change in how the catalogue sorts to a change in how
 * one item's orderings sort, which are two questions.
 */
const THE_CONTAINERS_KEY = sql<string | null>`coalesce(${items.sortName}, ${items.title})`;

/**
 * THE ORDER "ALSO APPEARS IN" IS READ IN: four keys and the placement's id
 * behind them.
 *
 * ONE VALUE, AND ALL THREE STATEMENTS ARE READ OFF IT (ADR-0119). `theOrderBy`
 * renders the `ORDER BY`, `pastTheRowIn` renders the cursor comparison that
 * walks it, and `AnchorIn` is the shape the read below has to answer with. THIS
 * IS THE ORDER CNCORE-125 GREW FROM ONE KEY TO FOUR, and the growing is what
 * the defect was: the terms lived beside the `ORDER BY` and the comparison was
 * built for one of them, so rows tied with the anchor were stepped over.
 *
 * BUILT FROM A SPOKESMAN RATHER THAN WRITTEN AS A CONSTANT, because two of its
 * keys are columns of a LATERAL and a lateral is a relation: the columns a
 * statement sorts and compares have to be the ones that statement joined, and a
 * second `spokesmanFor(db)` would alias a second subquery it never did.
 *
 * `nulls last` COMES WITH THE ORDER and is load-bearing on every one of the
 * four: each key is nullable, so each has a block of rows with none behind it
 * that a walk must still reach.
 *
 * THE KEYS, IN THE ORDER THEY DECIDE:
 *
 * - THE CONTAINER'S PROJECTED KEY. ADR-0014 gives `sort_name` its own index for
 *   exactly this: it is what the catalogue sorts on, and the title is the
 *   fallback when no sort-name statement has ever won. DESTROYED BY THE
 *   CONTAINER'S DELETE, which is `items` here because `items` is joined in as
 *   the container: see `findInThisItemsOrder` for what that does to an anchor.
 * - THEN THE DISAGREEMENT RESOLVED (ADR-0017). Two sources claiming different
 *   positions for one item in one container are two rows, both standing and
 *   both answered -- and these two terms are what decide which of them SPEAKS,
 *   so the winning claim is the one a reader meets first. A source that says
 *   nothing about a placement cannot outrank one that does, and NULLs sorting
 *   last is what says so.
 * - THEN THE POSITION. A Repeat ties on both of those, because one source
 *   asserted both rows, and the position is what separates it: a recap at 1
 *   still reads before the episode at 5.
 * - AND THE ID BEHIND THEM, which keeps even two identical rows in one order.
 */
function thisItemsOrder(spokesman: ReturnType<typeof spokesmanFor>) {
  return {
    keys: {
      containerKey: { key: THE_CONTAINERS_KEY, destroyedBy: items.deletedAt },
      precedence: spokesman.precedence,
      sourceOrder: spokesman.sourceOrder,
      position: placements.position,
    },
    id: placements.id,
  } satisfies TheOrder;
}

/**
 * Where one placement sits among all the orderings ONE item sits in.
 *
 * DERIVED FROM THE ORDER rather than declared beside it, for the reason that
 * order gives: an anchor written out by hand is a second list of its keys, and
 * two lists come apart.
 */
type AnchorAmongOrderings = AnchorIn<ReturnType<typeof thisItemsOrder>>;

/**
 * Where one placement sits in the order "Also appears in" keeps, by the id a
 * reader arrived with.
 *
 * SCOPED TO THE ITEM, exactly as `findInTheContainersOrder` is scoped to its
 * container and for the same reason: this is one listing per item, so a
 * placement of a DIFFERENT item names an anchor in somebody else's list and
 * resuming at it would cut this one at a row the reader never saw. Out of scope
 * it names nothing, which is ADR-0066's rule for a parameter that is not an
 * identity -- the walk starts at the beginning rather than erroring.
 *
 * IT DOES NOT HONOUR THE PLACEMENT'S TOMBSTONE, for ADR-0119's reason: that
 * rule is about what a reader is SHOWN, and this row is never shown -- it is a
 * position.
 *
 * IT DOES HONOUR THE CONTAINER'S, AND THAT IS ADR-0119's SPLIT REACHING A CASE
 * IT HAD NOT MET. That record says an anchor whose key a delete DESTROYS names
 * no position, while one whose key survives can still be resumed from -- and
 * this is the first order in the app with BOTH KINDS OF TERM IN IT. Three of
 * the four keys are stored columns no tombstone touches (ADR-0017's pair, and
 * the position, which is why a kept link into a container resumes). The one it
 * leads on is not: the container's key is ADR-0014's projection, migration 5
 * tombstones every statement of a deleted item, and the projection over no live
 * statements is NULL -- so a deleted container's key is GONE rather than hidden.
 * The order's key says so, and `stillAnAnchorIn` reads it in this `where`.
 *
 * A LEADING KEY THAT IS GONE LOSES THE WHOLE ANCHOR, which is why the survivors
 * behind it cannot rescue it. Resuming from `(null, precedence, ...)` would
 * resume from the untitled-container block with every titled one between
 * skipped, which is exactly the dead end CNCORE-110 measured on the catalogue.
 * So the walk starts the list over: nothing skipped, and the price is that a
 * reader deep in the list walks it again.
 *
 * AND THE UNTITLED CONTAINER IS WHAT THIS SEPARATES THAT FROM. A container
 * nobody has titled has no key either, sits at the end of the order as one
 * block, and is resumed from by the three keys behind it -- so the refusal
 * tests the pair, not the tombstone alone.
 */
async function findInThisItemsOrder(
  db: Database,
  itemId: string,
  id: string,
): Promise<AnchorAmongOrderings | undefined> {
  // The shape guard `findItem` uses, for the reason it gives: comparing a
  // non-uuid against a `uuid` column is error 22P02 rather than an empty result.
  if (!canBeAnId(id)) return undefined;
  const spokesman = spokesmanFor(db);
  const order = thisItemsOrder(spokesman);
  const [anchor] = await db
    // READ BY THE ORDER'S OWN KEYS, so a key it gains is one this read cannot be
    // left without -- and REFUSED BY THEM, so a key a delete destroys is refused
    // on what the key says rather than on a line written here.
    .select(theAnchorIn(order))
    .from(placements)
    .innerJoin(items, eq(items.id, placements.containerId))
    .leftJoinLateral(spokesman, sql`true`)
    .where(and(eq(placements.id, id), eq(placements.itemId, itemId), stillAnAnchorIn(order)));
  return anchor;
}

/** One value claimed about an item, and who claimed it (ADR-0012, ADR-0071). */
export interface StatementOfItem {
  /** The seeded property's name: `title`, `released` (ADR-0029). */
  property: string;
  value: string;
  /** `provider`, `owner`, `sidecar` or `derived`. */
  sourceKind: string;
  /** What that source calls itself: a provider's manifest name, or `Owner`. */
  sourceLabel: string;
}

/**
 * Every value anybody has claimed about one item, with the source that claimed
 * it -- which is the whole point of a statement over a column (ADR-0012).
 *
 * COMPETING VALUES ARE ALL RETURNED and the winner comes FIRST. The ordering is
 * `winning_literal`'s three terms, in its order and for its reasons: rank first,
 * because the owner's favourite is the lock and outranks the whole source order
 * (ADR-0024); then the one global source order (ADR-0025); then a stable id.
 * Recency is deliberately absent from both.
 *
 * IT IS ONE RULE IN TWO LANGUAGES, exactly as `spokesmanFor` above is, and
 * the reason to keep them identical is the same: a list whose first row
 * disagreed with the projected title in the page heading would be two answers to
 * one question, on one page, both correct by their own lights.
 *
 * LITERALS ONLY. An item-valued statement -- `created_by` pointing at a person --
 * has no literal to show, and rendering its target would mean putting an
 * internal id in the read path (ADR-0045). It arrives with the slice that can
 * render a person as a link.
 *
 * AND THE VALUE ITSELF IS THE LAST TERM BEFORE THE ID, which is a fix rather
 * than a flourish. Two values of one MULTIPLE-valued property from one source
 * at one rank -- two release dates, which is an ordinary shape (ADR-0057 keeps a
 * row for it) -- tie on all three of the terms above, so without this they fell
 * through to a random uuid and the page rendered them in a different order on
 * every import. A test caught it by failing on the second run, having passed on
 * the first.
 *
 * IT IS A TIEBREAK AND NOT A DATE SORT, and the difference matters because the
 * two agree often enough to be confused. EDTF sorts lexically for the ordinary
 * cases, so `2007-01-07` does come before `2007-03` -- but ADR-0073 is explicit
 * that Level 1 qualifiers like `1984?` and `198X` break lexical ordering, and
 * what fixes those is a DERIVED sort key, which nothing needs yet. This term
 * exists so the same rows render in the same order twice.
 */
export async function findStatementsOfItem(
  db: Database,
  itemId: string,
): Promise<StatementOfItem[]> {
  return db
    .select({
      property: properties.name,
      value: sql<string>`${statements.valueLiteral}`,
      sourceKind: sources.kind,
      sourceLabel: sources.label,
    })
    .from(statements)
    .innerJoin(properties, eq(properties.id, statements.propertyId))
    .innerJoin(sources, eq(sources.id, statements.sourceId))
    .innerJoin(ranks, eq(ranks.rank, statements.rank))
    .where(
      and(
        eq(statements.subjectItemId, itemId),
        isNull(statements.deletedAt),
        // CNCORE-29: a value that arrived broken from an import is held apart
        // from the live set (migration 6). The claim still stands and its
        // source still makes it -- what is refused is READING it as good, which
        // is the whole difference from the tombstone above.
        eq(statements.quarantined, false),
        isNotNull(statements.valueLiteral),
        /*
         * ADR-0045: the public read path carries NO NOTES, and this list is
         * what `itemPublic.statements` is built from -- so a note reaching here
         * is a note on every item page a stranger opens.
         *
         * IT READS THE PROPERTY'S OWN DECLARATION (migration 12) rather than
         * naming `note`, which is ADR-0045's argument about strip-lists applied
         * to itself: a filter naming one property "works until someone adds a
         * field and forgets", and the field is the next property that should not
         * be public. `capabilities` is where every other fact about a property
         * already lives (ADR-0015, ADR-0029).
         *
         * ABSENT MEANS PUBLIC, which is true of the other twelve properties and
         * is why the `coalesce` defaults to true. The database refuses a `public`
         * that is not a boolean, so the cast cannot meet a string.
         */
        sql`coalesce((${properties.capabilities} -> 'public')::boolean, true)`,
      ),
    )
    .orderBy(
      properties.name,
      ranks.precedence,
      sources.sourceOrder,
      statements.valueLiteral,
      statements.id,
    );
}

/**
 * The owner's own note about one item (ADR-0096): what they wrote, and the
 * source it is filed under.
 *
 * THE SOURCE IS READ RATHER THAN ASSUMED, even though only the owner can ever
 * assert one (migration 12). The page has to say WHO said this to meet
 * CNCORE-74's criterion that the note is distinguishable from a provider's
 * claim, and a surface that printed the word "Owner" for itself would be
 * asserting what the row says instead of reading it -- which is the rule
 * ADR-0045 settles for every other label the read path carries.
 *
 * THE KIND IS NOT READ BESIDE IT. It can only ever be `owner` while the
 * declaration stands, and nothing branches on it, so emitting it would be a
 * field added against a reader that does not exist (ADR-0045).
 */
export interface NoteOfItem {
  value: string;
  /** What that source calls itself, seeded as `Owner` by migration 1. */
  sourceLabel: string;
}

/**
 * The note on one item, or `null` where nobody has written one.
 *
 * IT IS NOT IN `findStatementsOfItem`, and that is ADR-0045 rather than an
 * oversight: the public read path carries no notes, so a note cannot travel on
 * the list every visitor is served. Reading it separately is what lets the
 * procedure that answers it be the OWNER'S while `item.get` stays open.
 *
 * ONE NOTE, because `note` declares `single` cardinality (migration 12) and a
 * note is the owner's own free text about an item -- editing one replaces it.
 * Cardinality is declared and not yet enforced, so this orders by the same
 * three terms the projection uses (ADR-0024, ADR-0025) and takes the winner:
 * if a second note ever exists, the page shows the same one twice running
 * rather than whichever uuid the planner returned last.
 *
 * THE TOMBSTONE AND THE QUARANTINE ARE BOTH HONOURED, as `findStatementsOfItem`
 * honours them. A withdrawn note has to leave the page -- removing one is how
 * ADR-0075 records the removal -- and a note is free text that no declaration
 * checks, so the quarantine clause is a rule kept in one place rather than a
 * branch anything reaches today.
 */
export async function findNoteOfItem(db: Database, itemId: string): Promise<NoteOfItem | null> {
  const [note] = await db
    .select({
      value: sql<string>`${statements.valueLiteral}`,
      sourceLabel: sources.label,
    })
    .from(statements)
    .innerJoin(properties, eq(properties.id, statements.propertyId))
    .innerJoin(sources, eq(sources.id, statements.sourceId))
    .innerJoin(ranks, eq(ranks.rank, statements.rank))
    .where(
      and(
        eq(statements.subjectItemId, itemId),
        // NAMED HERE, WHERE `findStatementsOfItem` READS A DECLARATION INSTEAD.
        // The difference is what each query is for: that one emits a SET and a
        // filter naming one member of it is the strip-list ADR-0045 refuses,
        // where this one's whole subject is this property.
        eq(properties.name, "note"),
        isNull(statements.deletedAt),
        eq(statements.quarantined, false),
        isNotNull(statements.valueLiteral),
      ),
    )
    .orderBy(ranks.precedence, sources.sourceOrder, statements.id)
    .limit(1);

  return note ?? null;
}

/**
 * What a source's licence obliges the app to show, for one source (ADR-0036).
 */
export interface AttributionOwed {
  /** Who imposed it, in their own words -- `provider-tmdb`, not a URL. */
  sourceLabel: string;
  /** Verbatim, and rendered unaltered. Paraphrasing a licence notice breaches it. */
  notice: string;
  /** The source's mark, where its licence requires one shown. */
  logo: { dataUri: string; alt: string } | null;
}

/**
 * Every attribution this item's page owes, because of what it is about to show.
 *
 * ADR-0036 puts the notice "prominently in or on Your Application", so the page
 * rendering a source's claims is where the obligation falls due -- which makes
 * "which notices does this page owe" a question the read path has to answer.
 *
 * READ OFF THE CLAIMS THEMSELVES rather than from a list kept somewhere. An item
 * owes TMDB a notice because a TMDB statement or a TMDB placement is on it, so
 * this is a join from exactly the rows that get displayed. The consequence is the
 * valuable half: the obligation ends by itself the moment the last of those rows
 * goes, with nothing to remember to update and no way for a notice to outlive the
 * content that incurred it.
 *
 * A PLACEMENT COUNTS AS MUCH AS A VALUE. An ordering is a dated claim by a named
 * source (ADR-0017), so a page listing "also appears in" is showing that source's
 * work just as surely as a title is -- and an item a provider placed but said
 * nothing else about still owes that provider its notice.
 *
 * AND SO DOES A CONTAINER'S TITLE, which is the clause review found missing. The
 * "also appears in" list prints `containerTitle` for every ordering, and that
 * title is a CLAIM BY WHOEVER MADE IT -- routinely the provider that browsed the
 * container into existence. A page showing "The Matrix Collection" is showing
 * TMDB's words, so it owes TMDB's notice, and the first two clauses alone missed
 * it whenever the item itself came from somewhere else. The rule this keeps is
 * simple and worth stating: EVERY SOURCE WHOSE WORDS APPEAR ON THE PAGE IS OWED,
 * and the query has to track what the page actually renders.
 *
 * A SOURCE THAT OWES NOTHING IS ABSENT rather than present with nulls, because
 * the caller's question is what to render and there is nothing to render for one.
 */
export async function findAttributionOwed(
  db: Database,
  itemId: string,
): Promise<AttributionOwed[]> {
  const rows = await db
    .select({
      sourceLabel: sources.label,
      // The column's own nullable type, narrowed below rather than asserted here.
      // It was `sql<string>` wrapping the column purely to launder the null away,
      // which is a cast wearing a query's clothes: the `is not null` filter is in
      // the WHERE, and TypeScript cannot see a WHERE.
      notice: sources.attributionNotice,
      logo: sources.attributionLogo,
      alt: sources.attributionLogoAlt,
    })
    .from(sources)
    .where(
      and(
        isNotNull(sources.attributionNotice),
        isNull(sources.deletedAt),
        sql`(
          exists (select 1 from ${statements}
            where ${statements.sourceId} = ${sources.id}
              and ${statements.subjectItemId} = ${itemId}
              and ${statements.deletedAt} is null)
          or exists (select 1 from ${placementSources}
            join ${placements} on ${placements.id} = ${placementSources.placementId}
            where ${placementSources.sourceId} = ${sources.id}
              and ${placements.itemId} = ${itemId}
              and ${placementSources.deletedAt} is null
              and ${placements.deletedAt} is null)
          or exists (select 1 from ${statements} as container_claims
            join ${placements} as container_placements
              on container_placements.item_id = ${itemId}
             and container_placements.container_id = container_claims.subject_item_id
            where container_claims.source_id = ${sources.id}
              and container_claims.deleted_at is null
              and container_placements.deleted_at is null)
        )`,
      ),
    )
    // ADR-0025's one global source order, so a page showing two obligations shows
    // them in the same order every time rather than in whatever the planner chose.
    .orderBy(sources.sourceOrder);

  return rows.flatMap(({ sourceLabel, notice, logo, alt }) =>
    // NARROWED RATHER THAN ASSERTED. The `is not null` filter above means this
    // never drops a row, and writing it as a filter rather than a `!` is what
    // keeps that true if the WHERE ever changes -- a row with no notice is not an
    // attribution, and there is nothing for a caller to render from one.
    notice === null
      ? []
      : [
          {
            sourceLabel,
            notice,
            // The column pair is constrained to be both-or-neither (migration 4),
            // so the `alt` check is TypeScript's question, not the database's.
            logo: logo !== null && alt !== null ? { dataUri: logo, alt } : null,
          },
        ],
  );
}

/** One item as the catalogue lists it. */
export interface CatalogueRow {
  id: string;
  /** ADR-0014's projected column. An item with no title statement has none. */
  title: string | null;
  /**
   * ADR-0005's kind, IN THE READER'S WORDS: `Time span`, never `time_span`.
   *
   * NAMED `kindLabel` LIKE `FoundItem`'S, so that inside this layer `kind` is
   * always the key a row is filed under and `kindLabel` is always the words a
   * reader is shown. It was `kind` and carried the label, one function away
   * from a `kind` carrying the key -- which is the hazard `FoundItem` above
   * has a paragraph about, standing in the file that states it. The read path
   * is where the label becomes `kind` (ADR-0045), and both routers do that now.
   *
   * READ OFF `item_kinds` RATHER THAN MAPPED IN TYPESCRIPT. Migration 1 seeds
   * that table with a `label` beside every kind for exactly this, so the words
   * a reader sees are the catalogue's own. A map written in the app would be
   * the same rule in a second language -- the hazard this file already carries
   * a paragraph about -- and it would go stale the day a kind's label is
   * revised by the migration that owns it.
   */
  kindLabel: string;
  /**
   * ADR-0004 folds containers into `work`, so the kind alone cannot separate a
   * story from an ordering that holds stories. This is what does.
   */
  isContainer: boolean;
  /**
   * HOW MUCH THIS ONE HOLDS (ADR-0140) -- the size of its own Members
   * listing, which is the number `findPlacementsInContainer` answers as
   * `total` and is read off the same predicate, so the two cannot disagree.
   * That record owns the decision, what it costs and why the name is `holds`.
   *
   * ZERO FOR A STORY, AND ASKED OF IT ANYWAY. `item.get` already settles that
   * argument in the same words: nothing can be placed in an item that is not
   * a container, so a non-container's answer is empty either way -- and a
   * branch on `is_container` here would be a second place for "what is a
   * container" to be decided, free to disagree with the column. Which Rows a
   * reader is SHOWN a figure on is the surface's, off `isContainer`.
   */
  holds: number;
  /**
   * WHICH ORDERINGS THIS ONE SITS IN, AND AT WHAT POSITION IN EACH (ADR-0143)
   * -- the product's central claim, on the page that shows everything. A
   * story's `holds` above is zero; this is the figure that is not.
   *
   * ASKED OF EVERY ROW, containers included, for `holds`'s reason turned
   * round: an Ordering can sit in another, and which Rows a reader is SHOWN
   * this on is the surface's, off `isContainer`.
   */
  sitsIn: SitsIn;
}

/** Where one Row's item sits: the first of its placements, and how many it has. */
export interface SitsIn {
  /**
   * THE FIRST FIVE, in the order the Row reads them: by the container's sort
   * key, then by container, then by Position. Fewer than `total` is the cut,
   * never a hidden placement: `total` is what says how many more there are.
   * `PlacementOfItem` said shorter, as the read path picks the same three.
   */
  first: Pick<PlacementOfItem, "containerId" | "containerTitle" | "position">[];
  /** How many placements it has altogether: "Also appears in"'s own `total`. */
  total: number;
}

/** What the catalogue holds, and how much of it this answer carries. */
export interface Catalogue {
  rows: CatalogueRow[];
  /**
   * How many items the catalogue holds ALTOGETHER, which is not
   * `rows.length` whenever the cap bit. A surface that cannot tell the two
   * apart reports the first hundred as the whole library.
   */
  total: number;
  /**
   * HOW MANY ROWS SORT BEFORE THIS PAGE'S FIRST (ADR-0133), so a page says
   * which of them it is showing: Rows `rowsBefore + 1` to
   * `rowsBefore + rows.length` of `total`. Zero on the first page, and the
   * whole Listing on a page past its end.
   *
   * COUNTED, NEVER TAKEN AS AN OFFSET: the Rows behind the page's Cut are
   * counted in the page's own statement, and nothing reads this back as a
   * place to go. ADR-0119's refusal of a numbered page stands.
   */
  rowsBefore: number;
  /**
   * The id to walk on from, or `null` where the catalogue ends here.
   *
   * IT SAYS BOTH THINGS AT ONCE -- whether there is more, and where it starts
   * -- because a surface working the first out for itself would have to
   * subtract, which a keyset walk could not do until `rowsBefore` counted where
   * a page is (ADR-0133), and would still need this for where.
   */
  continuesAfter: string | null;
  /**
   * The id to step back from, or `null` where nothing comes before this page
   * (CNCORE-174): the page's own first Row, which `before` hands back to ask
   * for the page that ends short of it. `continuesAfter` turned round.
   */
  continuesBefore: string | null;
}

/**
 * ONE OF THE TWO BROWSED LISTINGS: a Listing, and the one thing that is true
 * of these two and of no other -- that its Rows are FILED UNDER LETTERS, so it
 * can be asked what lies before the first of them.
 *
 * A SHAPE OF ITS OWN RATHER THAN A FIELD ON `Catalogue`, which mirrors
 * `browsedInput` one package over and is that input's own argument turned
 * round: Catalogue search leads on how close a title is to what a reader typed
 * (ADR-0120), so nothing in it is filed under a letter and there is no
 * alphabet for anything to sort before. A field there would be one every
 * caller could read and one caller could only ever answer falsely.
 */
export interface BrowsedListing extends Catalogue {
  /**
   * WHETHER ANY ROW OF THIS LISTING SORTS BEFORE A (CNCORE-242), which is
   * whether the jump bar has an entry to offer for them.
   *
   * THE RANGE, NEVER A DIGIT-OR-SYMBOL TEST, and the two are not the same
   * question. Measured on this repository's engine 2026-09-21 under
   * `en_US.utf8`: `42 (TV story)` and `1001 Nights (audio story)` sort before
   * `a`, and so does `£436 (short story)` -- but `!bang` and `-dash first` do
   * NOT, because the collation ignores punctuation at the first level and
   * files them under B and D. A character test would put those two here and
   * file a Cyrillic title here as well, where the collation sorts it past Z.
   * Jellyfin's `#` is the same range: `nameLessThan: 'A'` compared against
   * SortName, never a character class.
   *
   * AND THE TWO ALREADY DISAGREE ON THE OWNER'S CATALOGUE rather than only in
   * principle: 37 against 46 on a 2026-09-20 dump, measured 2026-09-21. The
   * nine a character test would wrongly take include `"Death to the Daleks!"`,
   * which `catalogue.test.ts` already names as filing under D. ADR-0180 lists
   * them, and corrects CNCORE-242's own sentence saying they agree.
   *
   * ASKED AS THE COMPLEMENT OF THE JUMP TO A, so it is one predicate read from
   * both ends rather than a second spelling of it. The Rows behind
   * that Cut are exactly the Rows the jump to A leaves behind, which is the
   * count that Listing already reports as `rowsBefore` -- 37 of the Owner's
   * 8,052 Items, measured 2026-09-20 under CNCORE-242.
   *
   * FALSE IN THE RECENTLY-ADDED ORDER, where it is a question about nothing:
   * that order leads on a timestamp and nothing is filed under a letter in it,
   * which is the same sentence `readListing` below already writes about
   * declining `?letter=`. The surfaces hide the whole bar there.
   */
  beforeTheAlphabet: boolean;
}

/**
 * WHAT IS IN THIS CATALOGUE -- every item, of every kind.
 *
 * ADR-0077 phrases the rule around THE QUESTION A SURFACE ASKS rather than
 * around a list of surfaces, and this asks the WIDE one: work-browsing answers
 * "what can I watch" and excludes the entity kinds, and this excludes nothing.
 * `holds_work` is deliberately not consulted here. `readWorks` below is the
 * surface that does consult it.
 */
export async function readCatalogue(
  db: Database,
  {
    group,
    kind,
    ...at
  }: {
    limit: number;
    group?: string;
    kind?: string;
    letter?: string;
    order?: ChosenOrder;
  } & WhereAPageIs,
): Promise<BrowsedListing> {
  return readListing(db, {
    ...at,
    within: narrowedToTheKind(kind, withinTheGroup(db, group, IN_THE_CATALOGUE)),
  });
}

/**
 * WHAT CAN I WATCH -- ADR-0077's other question, and the first reader
 * `items.holds_work` has ever had.
 *
 * A SECOND QUESTION RATHER THAN A FLAG ON THE FIRST, which is what that record
 * asks for: "naming the question lets a surface classify itself". A boolean
 * parameter would make every caller classify itself by remembering to pass one,
 * and whatever the default was would decide for the ones that forgot.
 *
 * IT WALKS THE SAME WAY (ADR-0119), because it is the same listing asked a
 * narrower question: one ordering, one cap, one cursor cut at an item's id. A
 * second paging shape here would be one rule in two places, and what that rule
 * is protecting is a reader not being handed a page that skips items.
 */
export async function readWorks(
  db: Database,
  {
    group,
    kind,
    ...at
  }: {
    limit: number;
    group?: string;
    kind?: string;
    letter?: string;
    order?: ChosenOrder;
  } & WhereAPageIs,
): Promise<BrowsedListing> {
  return readListing(db, {
    ...at,
    within: narrowedToTheKind(kind, withinTheGroup(db, group, WORK_BROWSING)),
  });
}

/**
 * ONE LISTING, WALKED -- shared by the two questions above, which differ in
 * their WHERE and in nothing else. Catalogue search differs in its ORDER too,
 * so it goes through `walkListing` below rather than through this.
 *
 * WRITTEN ONCE, AND THE COUNT IS WHY IT HAS TO BE. A listing and the size it
 * reports must answer the same question: `readWorks` handing back the whole
 * catalogue's `total` would tell an owner their work-browsing surface was
 * hiding items it was never asked to show, which is the exact lie the cap
 * exists to prevent. Two copies of this function would keep that true by care
 * rather than by construction, which is the hazard this file already carries a
 * paragraph about.
 *
 * IT HONOURS THE TOMBSTONE (ADR-0075) and reads the PROJECTED columns
 * (ADR-0014), so what a reader sees listed is the title statement that
 * currently wins rather than an id.
 *
 * THE ORDER IS `THE_CATALOGUES_ORDER` BELOW, and it is one value rather than
 * two statements (CNCORE-169): `coalesce(sort_name, title)`, which is the pair
 * ADR-0014 gives `sort_name` its own index for, with the id behind it so two
 * items sharing a sort key list in the same order twice.
 *
 * AND `after` WALKS IT (ADR-0119): the id of the last item the page before this
 * one carried. Both halves of the order are load-bearing in that comparison,
 * and neither can go missing from it, because the sort and the comparison are
 * READ OFF THE SAME KEYS -- the cap says what is not being shown, and this is
 * what reaches it.
 */
async function readListing(
  db: Database,
  {
    limit,
    within,
    letter,
    order = "name",
    ...at
  }: { limit: number; within: SQL; letter?: string; order?: ChosenOrder } & WhereAPageIs,
): Promise<BrowsedListing> {
  /*
   * THE ORDER AND THE ANCHOR READ IN IT ARE PICKED TOGETHER, in one branch,
   * which is what keeps them a pair. `theCutAt` is typed `ACutIn<O>` against
   * the order in the same call, so a cursor read in one order cannot reach a
   * walk in the other -- the compiler holds what a sentence used to
   * (`order.ts`, ADR-0119).
   *
   * AND A LETTER IS THE CATALOGUE'S ORDER'S ALONE. A jump is a SEEK on the
   * leading key, and the leading key here is a timestamp: `?letter=` on a
   * recently-added page names nothing to seek to, so this order takes no
   * letter rather than seeking to a value no Row has. The address is answered
   * as the start of the Listing, which is where a parameter naming nothing
   * leaves a page (ADR-0066).
   */
  if (order === "added") {
    const page = await walkListing(db, {
      within,
      order: RECENTLY_ADDED,
      cut: await theCutAt(at, (id) => findInTheAddedOrder(db, id)),
      limit,
    });
    // AND NOTHING SORTS BEFORE AN ALPHABET THIS ORDER DOES NOT HAVE
    // (CNCORE-242). It is the sentence above said once more: a Listing led by
    // a timestamp files nothing under a letter, so there is no first letter
    // for a Row to sort ahead of, and the surfaces hide the whole bar here
    // rather than showing one entry of it.
    return { ...page, beforeTheAlphabet: false };
  }
  // ONE VALUE HANDED OVER, AND THE WALK READS BOTH STATEMENTS OFF IT
  // (CNCORE-169, CNCORE-170). The sort and the comparison that walks it are the
  // same keys because there is one place they are named.
  // A LETTER COUNTS ONLY WHERE NO CURSOR WAS GIVEN, so a cursor naming
  // nothing starts the Listing over as `WhereAPageIs` says, rather than
  // falling through to a letter the same address happens to carry.
  const cut =
    at.after !== undefined || at.before !== undefined
      ? await theCutAt(at, (id) => findInTheOrder(db, id))
      : letter === undefined
        ? undefined
        : { atOrPast: letter.toLowerCase() };
  // TOGETHER, BECAUSE NEITHER WAITS ON THE OTHER: the page is read from the
  // Cut a reader named, and this is a question about the Listing's own far
  // end. The anchor read above is the one that had to come first.
  const [page, beforeTheAlphabet] = await Promise.all([
    walkListing(db, { within, order: THE_CATALOGUES_ORDER, cut, limit }),
    anythingSortsBeforeTheAlphabet(db, within),
  ]);
  return { ...page, beforeTheAlphabet };
}

/**
 * WHETHER THIS LISTING HOLDS A ROW THAT A TO Z CANNOT REACH (CNCORE-242): the
 * Rows BEHIND the Cut a jump to A makes, which is the complement of the Rows
 * ahead of it and therefore the same predicate read from the other side.
 *
 * NOT A SECOND SPELLING OF THE BUCKET, which is the whole reason it is written
 * this way. An implementation testing the first character for a digit or a
 * mark disagrees with this ON THE CATALOGUE THAT EXISTS -- 46 Items against
 * 37, measured 2026-09-21 -- because the collation files a title opening in
 * punctuation under the letter inside it and a non-Latin one past Z.
 * `theCut` renders the comparison the jump itself uses, so the entry the bar
 * offers and the page it lands on cannot come to mean different things.
 *
 * IT ASKS WHETHER, NOT HOW MANY, because nothing shows a figure for it: a
 * count would be a number no surface prints, and the row this stops at is the
 * cheapest answer to the question actually asked. `size.behind` is the shape
 * for the figure if one is ever wanted, and it rides on the Rows.
 *
 * IT DOES NOT GO THROUGH `theSize`, AND THAT SEAM'S OWN REASON IS WHY. That
 * function exists so a Listing's count cannot be drawn from a different
 * relation or a different `WHERE` than its Rows: the caller supplies the FROM
 * and the JOINs and has nowhere to put a predicate. Neither half can bite
 * here. This COUNTS NOTHING and JOINS NOTHING -- it stops at the first Row it
 * finds -- and the predicate it asks is not one it wrote: `theRowsBehind` is
 * the shared complement, over the Listing's own `within` in the same call.
 * Routing it through `TheSize` would mean a method on a shared interface for
 * one caller, or a second `TheSize` built beside the one `walkListing` makes.
 *
 * A SECOND STATEMENT, AND THE SNAPSHOT IT CANNOT SHARE IS NOT ONE ANYTHING
 * READS TOGETHER. A `total` that disagreed with the Rows beside it would
 * report a library that is not there (ADR-0133); this decides whether a
 * NAVIGATION ENTRY is offered, and an entry offered a moment after the last
 * such Row was deleted lands its reader at the start of the Listing, which is
 * where it always pointed.
 */
async function anythingSortsBeforeTheAlphabet(db: Database, within: SQL): Promise<boolean> {
  const { ahead } = theCut(THE_CATALOGUES_ORDER, { atOrPast: THE_ALPHABET_BEGINS });
  const behind = await db
    .select({ id: items.id })
    .from(items)
    .where(theRowsBehind(within, ahead))
    .limit(1);
  return behind.length > 0;
}

/**
 * WHERE THE ALPHABET BEGINS, in the spelling a seek uses: lower case, as
 * `readListing` hands a reader's letter over, and the collation files `a` and
 * `A` together anyway (`catalogue.test.ts` measures that).
 */
const THE_ALPHABET_BEGINS = "a";

/**
 * ONE PAGE OF ONE LISTING, WALKED -- whatever question the listing asks, and
 * whatever order it asks it in.
 *
 * THE ORDER IS A PARAMETER AND THE ANCHOR IN IT IS ANOTHER, because those are
 * the two things this repo's listings differ in and NOTHING ELSE IS. The
 * catalogue and work-browsing sort on `coalesce(sort_name, title)`; Catalogue
 * search sorts on how close a title is to what a reader typed, which is a
 * function of the QUERY rather than a column of the item (ADR-0119, ADR-0120).
 * Everything around that -- the fields, the join, the count, the cap, the extra
 * row that says whether to offer another page -- is one rule, and this is the
 * one place it is written.
 *
 * IT TAKES THE ORDER RATHER THAN THE TWO STATEMENTS READ OFF IT, which is the
 * last of the old shape to go (CNCORE-170). A caller used to hand over an
 * `ORDER BY` and a cursor comparison it had built separately, and NOTHING HERE
 * COULD TELL whether they were the same order: that pairing is the one this
 * whole mechanism exists to make impossible, and leaving it on the seam
 * between two listings and their walk would have been the same defect one
 * function further out. `anchor` is typed `AnchorIn<O>` against the order in the
 * same call, so an anchor read in one order cannot be handed to a walk in
 * another.
 *
 * IT IS WRITTEN ONCE BECAUSE THE COUNT KEPT GOING WRONG SEPARATELY. Catalogue
 * search had its own copy of this shape and its own `count(*) over ()`, which
 * was right only while it had no cursor: CNCORE-82 had already found that a
 * window count is taken AFTER `where`, fixed it here, and left a comment in the
 * other file predicting the day it would have to be fixed there too. That day
 * was CNCORE-88 and the prediction was correct, which is the argument for there
 * being one copy rather than a comment pointing at the other one.
 *
 * EXPORTED WITHIN THE PACKAGE, like `IN_THE_CATALOGUE` and `SORT_KEY` above it
 * and for the same reason. It stays out of the package's public export: a
 * caller outside gets `readCatalogue`, `readWorks` or `searchCatalogue`, never
 * a walk it has to supply an order to.
 */
export async function walkListing<O extends TheOrder>(
  db: Database,
  { within, order, cut, limit }: { within: SQL; order: O; cut?: ACutIn<O>; limit: number },
): Promise<Catalogue> {
  /*
   * THE SIZE (CNCORE-172), AND THE ROWS READ THEIR OWN `WHERE` BACK OFF IT.
   * That is `readListing`'s paragraph above made structural: `readWorks`
   * handing back the whole catalogue's `total` would tell an owner their
   * work-browsing surface was hiding items it was never asked to show.
   *
   * COUNTING `items` ALONE, where the rows join `item_kinds` for the reader's
   * word. A row with no kind cannot exist -- it is a foreign key -- so the join
   * can neither add a row nor drop one, and a count paying for it would be
   * paying to reach a column it does not read.
   */
  const size = theSize(within, () => db.select(HOW_MANY).from(items));
  return onePage({
    limit,
    size,
    order,
    cut: cut && theCut(order, cut),
    read: (howMany, where, orderBy, behindTheCut) =>
      db
        .select({
          id: items.id,
          title: items.title,
          kindLabel: itemKinds.label,
          isContainer: items.isContainer,
          /*
           * THE COUNT COMES BACK ON THE ROWS rather than from a second query: a
           * count taken separately is taken at a different moment, so a page
           * could report 41 items and list 42. A scalar subquery rides in the
           * same statement and therefore in the same snapshot.
           *
           * IT WAS `count(*) over ()`, AND THE CURSOR IS WHY IT NO LONGER IS. A
           * window count is taken after `where`, so with a keyset predicate in
           * there it counts the items PAST THE CURSOR rather than the catalogue
           * -- and page two would report a smaller library than page one. This
           * subquery is uncorrelated, so the cursor cannot reach it.
           */
          total: size.onTheRows,
          behindTheCut,
          /*
           * HOW MUCH THIS ROW HOLDS (CNCORE-183), on the Row rather than from a
           * second read -- for the reason the `total` above gives and one more
           * of its own: this one is a question PER ROW, so a second read would
           * be a round trip for every container on the page.
           *
           * ASKED OF EVERY ROW rather than only of the containers. `item.get`
           * settles that in the same words for the same relation: nothing can
           * be placed in an item that is not a container, so a story's answer
           * is empty either way -- and a `case` on `is_container` here would be
           * a second place for "what is a container" to be decided, free to
           * disagree with the column the surface branches on.
           */
          holds: howMuchItHolds(db),
          sitsIn: whereItSits(db),
        })
        .from(items)
        // INNER, because `items.kind` is a foreign key into this table: a row
        // with no kind cannot exist, so there is nothing for a left join to
        // preserve.
        .innerJoin(itemKinds, eq(itemKinds.kind, items.kind))
        .where(where)
        .orderBy(...orderBy)
        .limit(howMany),
  });
}

/**
 * WHAT A COUNTING QUERY SELECTS -- the field rather than the number, which is
 * why it is spelled as the object `select` takes.
 *
 * `count(*)` IS A `bigint`, which node-postgres hands over as a STRING because
 * the range does not fit a JavaScript number; without `mapWith` a size is a
 * string wearing a number's type. Written once for every Listing, beside the
 * value that reads it.
 *
 * ONE OBJECT, SPLICED INTO THREE SELECTS, which is what `SORT_KEY` below
 * already is: a drizzle `SQL` renders where it is put and is not consumed by
 * being put there, and `as` returns a new alias rather than stamping this one.
 */
const HOW_MANY = { total: sql<number>`count(*)`.mapWith(Number) };

/**
 * A QUERY THAT ANSWERS ONE NUMBER -- widened to what both positions below need
 * of it and no more: it renders into another statement (`SQLWrapper`) and it
 * runs on its own (`PromiseLike`). Drizzle's own select types differ between a
 * count that joins a lateral and one that does not, so the two shapes
 * `findPlacementsOfItem` chooses between meet here rather than in a cast.
 */
type Counting = SQLWrapper & PromiseLike<{ total: number }[]>;

/**
 * THE ROWS A LISTING'S SIZE COUNTS, WITH NO QUESTION ASKED OF THEM YET: the
 * relation and the joins, and a `WHERE` still to come. `theSize` is what
 * supplies that `WHERE`, which is why this is the shape it takes rather than a
 * finished query -- a finished one would arrive carrying a predicate of its
 * own, and comparing it to the Listing's would be the sentence this replaces.
 */
type Countable = { where(within: SQL): Counting };

/**
 * WHERE A LISTING'S ROWS ARE COUNTED FROM, handed over as a way to build one
 * rather than as one, because a Listing now counts TWICE: its size, and the
 * Rows behind the page (ADR-0133). A drizzle select is SPENT by its `where` --
 * the call sets the builder's own predicate and returns the same object -- so
 * one builder asked two questions would answer the second twice.
 *
 * `reachingItsOrder` IS TRUE FOR THE COUNT THAT COMPARES THE ORDER'S KEYS, and
 * a Listing whose keys are read off a relation its size does not need must
 * join that relation there. "Also appears in" is the one: two of its keys are
 * the spokesman's, a LATERAL its size joins only when narrowed (CNCORE-129).
 * Left out, the comparison's `"spokesman"` would not fail -- it would resolve
 * to the PAGE'S spokesman one scope out, and count every Row against whichever
 * one the outer row had. The other four read their keys off the relation they
 * count, and take no argument.
 */
type CountedFrom = (reachingItsOrder: boolean) => Countable;

/**
 * HOW BIG ONE LISTING IS: ONE QUERY, and both the positions a size is read in
 * are derived from it.
 *
 * IT IS THE SAME CONSTRUCTION `TheOrder` IS, for the same reason and against
 * the same failure (ADR-0119). An order was two statements -- the `ORDER BY`
 * and the cursor comparison -- that a sentence required to name the same
 * terms, and four defects came of them disagreeing. A SIZE IS TWO STATEMENTS
 * TOO: the scalar subquery that rides on the Rows, and the count asked on its
 * own for the page that has no Row to carry one. Two defects came of THOSE
 * disagreeing, one file apart (CNCORE-82, then CNCORE-88 in the copy that had
 * been left standing with a comment predicting the day).
 *
 * THE SIZE AND THE ROWS READ ONE PREDICATE, which is the half a count cannot
 * get right by itself. `within` is handed to the counting query rather than
 * chosen by it, and the Listing's own `WHERE` is read back off `size.within` --
 * so the count cannot be asked a question the Rows were not drawn from. A
 * narrowed page reporting the whole catalogue's size is the exact lie the cap
 * exists to prevent (CNCORE-129, and `readListing`'s own paragraph).
 *
 * IT IS NOT THE ROWS' OWN QUERY COUNTED, and that is a decision rather than an
 * omission. Counting a derived table of the Rows would be enforcement a
 * compiler could check -- and it would carry the cursor, which counts what is
 * PAST the reader rather than what the Listing holds, and it would ride every
 * lateral the page pays for over every row instead of over a hundred (4.4 ms
 * against 0.8 ms at 1,049 members, ADR-0017). The predicate is what the two
 * share; the statement is not.
 */
interface TheSize {
  /**
   * THE PREDICATE THE ROWS ARE DRAWN FROM, and the Listing's `WHERE` is read
   * off this rather than written beside it. The cursor is not in it: a keyset
   * predicate would count the Rows past the reader, which is a library
   * emptying as its owner walks it.
   */
  readonly within: SQL;
  /**
   * THE SIZE RIDING ON THE ROWS -- in their statement and therefore in their
   * snapshot, so a page cannot list 42 Rows and report 41. UNCORRELATED, so
   * the cursor beside it cannot reach in: the subquery names its own relations
   * in its own FROM, and those names resolve to its own rows.
   */
  readonly onTheRows: SQL<number>;
  /**
   * THE SIZE ASKED ON ITS OWN, for the page with no Row to carry one -- which
   * is a real page rather than an empty Listing: a cursor naming the last Row
   * of a Listing answers nothing with the whole Listing still behind it.
   * Asked exactly there, where there are no Rows for a second moment's answer
   * to disagree with.
   */
  askedOnItsOwn(): Promise<number>;
  /**
   * HOW MANY ROWS LIE BEHIND A CUT (ADR-0133), riding on the Rows beside the
   * size and therefore in the same snapshot -- so "Rows 3,201 to 3,300 of
   * 7,000" is two counts and a page that cannot disagree with each other.
   *
   * A COUNT AND NOT AN OFFSET. It is the Listing's own predicate and the
   * complement of the Rows ahead of the Cut, which is the one statement the
   * walk already reads them off (`TheCut`); no row is produced to be skipped,
   * and nothing here can be asked for "page seven". It is ADR-0119's `total`
   * asked of a smaller question, which is the whole of ADR-0133's argument.
   */
  behind(ahead: SQL): SQL<number>;
  /**
   * THE ROWS THAT COUNT COUNTS, which a page stepped back to is read from too:
   * one predicate for the Rows and their count, as `within` is for the size.
   */
  rowsBehind(ahead: SQL): SQL;
}

/**
 * ONE LISTING'S SIZE, from the predicate its Rows are drawn from and the
 * relations it has to reach to count them.
 *
 * THIS APPLIES THE `WHERE`, AND THAT IS THE WHOLE OF "enforced rather than
 * remembered". A caller supplies the FROM and the JOINs -- the part that
 * genuinely differs between a Listing of items and a Listing of placements --
 * and has NOWHERE TO PUT A PREDICATE: `Countable` is a query with its `where`
 * still unspent, so the count's question is this function's to ask and the
 * Listing reads the same value back off `within` for its Rows.
 *
 * AN EARLIER SHAPE PASSED THE PREDICATE TO A CALLBACK and was checked rather
 * than assumed: a callback handed `within` that answered
 * `db.select(HOW_MANY).from(items)` -- a count of the whole table, with the
 * Listing's question dropped on the floor -- COMPILED CLEAN. Handing a value to
 * something that need not spend it is convenience, not enforcement. The
 * callback this takes since ADR-0133 is handed NO predicate: it answers a
 * `Countable`, whose `where` is still unspent, and this spends it. A builder
 * that arrived with a `where` already on it is not one, because drizzle drops
 * the method from the type once it is called.
 */
function theSize(within: SQL, countedFrom: CountedFrom): TheSize {
  // ONE QUERY OBJECT, READ IN BOTH POSITIONS. Splicing it renders it; awaiting
  // it runs it. That is what makes this one value rather than two spellings of
  // one count -- and the two spellings were in two DIALECTS, raw SQL on the
  // Rows against the query builder beside it, with one Listing writing the
  // join between `placements` and `items` out by hand in the first.
  const counting = countedFrom(false).where(within);
  return {
    within,
    onTheRows: sql<number>`(${counting})`.mapWith(Number),
    askedOnItsOwn: async () => (await counting)[0]?.total ?? 0,
    behind: (ahead) =>
      sql<number>`(${countedFrom(true).where(theRowsBehind(within, ahead))})`.mapWith(Number),
    rowsBehind: (ahead) => theRowsBehind(within, ahead),
  };
}

/**
 * THE SAME QUESTION, NARROWED TO THE COMPLEMENT OF THE ROWS AHEAD OF A CUT,
 * which `TheCut` says is never NULL on a Row a Listing holds -- so the Rows
 * behind and the Rows ahead are the size between them, exactly.
 */
function theRowsBehind(within: SQL, ahead: SQL): SQL {
  return and(within, not(ahead)) as SQL;
}

/**
 * ONE PAGE CUT OUT OF A LISTING, whatever rows the listing is made of.
 *
 * THREE RULES, AND EACH OF THEM HAS GONE WRONG HERE ALREADY, which is the
 * argument for their being written once rather than per listing:
 *
 * - THE EXTRA ROW. Whether a listing carries on past this page is not
 *   something `total` alone can answer -- a keyset walk knows no offset, so it
 *   cannot subtract, and the count that would let it (below) is not asked of
 *   the first page -- and the cheapest thing that does know on a page read
 *   forward is a row that was there to be read. It is read here and never returned, so the reading and
 *   the discarding cannot come apart: a caller that fetched `limit` rows and
 *   handed them over would answer `continuesAfter: null` at every page, which
 *   ADR-0119 makes mean "the listing ends here".
 * - THE SIZE, AND IT IS THE LISTING'S OWN. `TheSize` above is one query read
 *   in both positions: the caller splices `onTheRows` into its select and this
 *   asks `askedOnItsOwn` where no row came back to carry one. Both are read
 *   off the value the caller's `WHERE` is read off too, so the size cannot
 *   answer a question the rows were not drawn from.
 * - THE CURSOR. The id of the LAST ROW THIS PAGE SHOWED, in whatever order the
 *   listing was read in.
 *
 * AND ONE FACT READ OFF TWO OF THEM: WHERE THE PAGE IS (ADR-0133). The Rows
 * behind the page's Cut are counted beside the size, on the Rows, so
 * `rowsBefore` is in the page's own snapshot -- and so are both step-back
 * links, which are arithmetic on the two counts rather than reads of their
 * own. Something lies behind a page read forward exactly where that count is
 * above zero, and something lies ahead of a page read back exactly where the
 * size is above it, because the Rows behind a Cut are the complement of the
 * Rows ahead of it. CNCORE-174 asked each question with a one-Row read of its
 * own, a second statement that a write between the two could make disagree
 * with the page; the count answers both in the first. THE PRICE is that the
 * links now ride on the count, so dropping the label -- which ADR-0133 says is
 * the move if it ever costs more than the page -- means putting those reads
 * back.
 *
 * IT TAKES THE READ RATHER THAN THE ROWS, so `limit + 1` is spent here beside
 * the slice that undoes it. WHAT IT DOES NOT TAKE IS THE QUERY: the catalogue,
 * work-browsing and Catalogue search all read `items` and go through
 * `walkListing` above, and a Container's members read `placements` -- a
 * different relation, a different id and a different count, so they supply
 * their own select and share these rules and nothing else.
 *
 * AND IT TAKES THE SIZE OFF THE ROW ITSELF, so a listing hands over what it
 * selected and nothing more. Every caller used to pass a function that rebuilt
 * its own row field by field, whose only effect was to leave `total` behind --
 * three identity mappings written out to discard one column, which is a place
 * a field can go missing by being forgotten rather than by being decided. The
 * count behind the Cut is taken off the same way.
 */
async function onePage<Stored extends TheStored>({
  limit,
  size,
  order,
  cut,
  read,
}: {
  limit: number;
  size: TheSize;
  order: TheOrder;
  cut?: TheCut;
  /**
   * One read of the Listing, with `behindTheCut` spliced into its select as
   * `total` is: the count riding on the Rows it is handed.
   */
  read: (
    howMany: number,
    where: SQL,
    orderBy: SQL[],
    behindTheCut: SQL<number>,
  ) => Promise<Stored[]>;
}): Promise<APage<Stored>> {
  if (cut === undefined) {
    const stored = await read(limit + 1, size.within, theOrderBy(order), NOTHING_BEHIND);
    return aPage(stored.slice(0, limit), size, { rowsBefore: 0, after: stored.length > limit });
  }
  if (!cut.readsBack) {
    const stored = await read(
      limit + 1,
      and(size.within, cut.ahead) as SQL,
      theOrderBy(order),
      size.behind(cut.ahead),
    );
    return aPage(stored.slice(0, limit), size, {
      rowsBefore: stored[0]?.behindTheCut ?? 0,
      after: stored.length > limit,
    });
  }
  const stored = await read(
    limit + 1,
    size.rowsBehind(cut.ahead),
    theOrderBy(order, { backward: true }),
    size.behind(cut.ahead),
  );
  // A STEP BACK THAT REACHES THE START ANSWERS THE START, whole (CNCORE-174).
  const [nearest] = stored;
  if (nearest === undefined || stored.length <= limit) return onePage({ limit, size, order, read });
  // READ BACK, THE PAGE IS THE LAST `limit` ROWS BEHIND THE CUT, turned round,
  // and something lies ahead of it exactly where the size is more than what is
  // behind the Cut: the Rows behind and ahead are the Listing between them.
  return aPage(stored.slice(0, limit).reverse(), size, {
    rowsBefore: nearest.behindTheCut - limit,
    after: nearest.total > nearest.behindTheCut,
  });
}

/** What a read hands `onePage`: a Row, and the two counts it carried in on. */
type TheStored = { id: string; total: number; behindTheCut: number };

/** One page of one Listing, as every Listing answers it. */
type APage<Stored> = {
  rows: Row<Stored>[];
  total: number;
  rowsBefore: number;
  continuesAfter: string | null;
  continuesBefore: string | null;
};

/**
 * THE COUNT BEHIND THE START, which is nothing, so it is not counted. The
 * first page is the one every Listing is asked for most, and it pays nothing
 * for saying it is first.
 */
const NOTHING_BEHIND = sql<number>`0`.mapWith(Number);

/**
 * One page of Rows, in the order a reader reads them: where it sits, and the
 * two cursors off either end of it. `after` says whether anything lies past
 * its last Row, which the caller knows by however it read the page.
 *
 * SOMETHING LIES BEFORE IT EXACTLY WHERE `rowsBefore` IS ABOVE ZERO, so the
 * step back is offered off the count rather than off a read of its own.
 *
 * AN EMPTY PAGE HAS EVERY ROW BEHIND IT, which is why its `rowsBefore` needs no
 * count: nothing is ahead of a Cut that answered nothing, so what is behind it
 * is the whole Listing, and the size asked on its own says how much that is.
 */
async function aPage<Stored extends TheStored>(
  page: Stored[],
  size: TheSize,
  { rowsBefore, after }: { rowsBefore: number; after: boolean },
): Promise<APage<Stored>> {
  const [first] = page;
  if (first === undefined) {
    const total = await size.askedOnItsOwn();
    return { rows: [], total, rowsBefore: total, continuesAfter: null, continuesBefore: null };
  }
  return {
    rows: page.map(({ total, behindTheCut, ...row }) => row),
    total: first.total,
    rowsBefore,
    continuesAfter: after ? (page.at(-1)?.id ?? null) : null,
    continuesBefore: rowsBefore > 0 ? first.id : null,
  };
}

/**
 * WHERE IN A LISTING A PAGE IS READ FROM, as a request names it -- and the
 * start, where it names neither.
 *
 * `after` IS ADR-0119's CURSOR, the last Row of the page before; `before` IS
 * THE STEP BACK, the first Row of the page a reader is leaving (CNCORE-174).
 * One Row's id either way, in whichever Listing it names a Row of, and an id
 * that names no position starts the Listing over (ADR-0066).
 *
 * `after` WINS WHERE A REQUEST CARRIES BOTH, which no link this app writes
 * does: one reason is as good as another for a question nobody asks, and
 * `after` was here first.
 */
export interface WhereAPageIs {
  after?: string;
  before?: string;
}

/**
 * THE CUT A REQUEST NAMES, found in the Listing's own order by that Listing's
 * own anchor read -- or none, which is the start.
 *
 * WRITTEN ONCE FOR THE FIVE LISTINGS, which each find an anchor their own way
 * (a Container's is scoped to it, "Also appears in"'s to its Item, Catalogue
 * search's computes its closeness) and agree on everything else: which of the
 * two cursors counts, and that one naming nothing is the start.
 */
export async function theCutAt<O extends TheOrder>(
  { after, before }: WhereAPageIs,
  find: (id: string) => Promise<AnchorIn<O> | undefined>,
): Promise<ACutIn<O> | undefined> {
  if (after !== undefined) {
    const anchor = await find(after);
    return anchor && { after: anchor };
  }
  if (before !== undefined) {
    const anchor = await find(before);
    return anchor && { before: anchor };
  }
  return undefined;
}

/**
 * THE ROW A READER SEES, which is the stored row without the size it carried
 * in on. `CONTEXT.md`'s **Row** names both sides of this seam -- `Stored` for
 * the row that never leaves the database and this for the projection a listing
 * answers with -- and the difference between them is one column.
 */
type Row<Stored> = Omit<Stored, "total" | "behindTheCut">;

/**
 * WHAT IS IN THE CATALOGUE: everything the owner has not deleted (ADR-0075).
 *
 * WRITTEN ONCE because it is read twice in one function -- by the page and by
 * the count beside it -- and it had been written twice, once in Drizzle and
 * once in raw SQL. That is one rule in two languages, which is the hazard this
 * file already carries a paragraph about: the day the rule gains a second term
 * the count agrees with a listing neither of them is describing.
 *
 * EXPORTED WITHIN THE PACKAGE (CNCORE-66), because Catalogue search is a second
 * reader of "what is in the catalogue" and had re-inlined `isNull(deletedAt)`
 * for itself. Two spellings of one rule is the same hazard one file away, and
 * the day this gains a term the two surfaces would disagree about what the
 * catalogue contains. It stays out of the package's public export: a caller
 * outside gets `readCatalogue` or `searchCatalogue`, never a predicate.
 */
export const IN_THE_CATALOGUE = isNull(items.deletedAt);

/**
 * WHAT WORK-BROWSING SHOWS (ADR-0077): `kind = 'work' AND (NOT is_container OR
 * holds_work)`, with the catalogue's own rule on top of it.
 *
 * THE SECOND TERM IS THE ONE THE RECORD'S FIRST DRAFT WAS MISSING, and it says
 * so itself: containers fold into `work` (ADR-0004), so "the Doctors, in order"
 * is an item of kind `work` and a kind filter cannot exclude it -- "the
 * mechanism failed on the record's own example".
 *
 * `holds_work` IS READ, NEVER WALKED. It is a stored boolean maintained by a
 * trigger on `placements` (migration 1), and the record gives the reason: a
 * read-time membership walk "would also make an empty container watchable and
 * then hide it the moment its first member arrived".
 *
 * WRITTEN BESIDE `IN_THE_CATALOGUE` AND BUILT FROM IT, so the narrower question
 * cannot come to disagree with the wider one about what a deleted item is.
 */
const WORK_BROWSING = and(
  IN_THE_CATALOGUE,
  eq(items.kind, "work"),
  or(not(items.isContainer), items.holdsWork),
) as SQL;

/**
 * A LIVE GROUP MEMBERSHIP (ADR-0010, ADR-0075): one the Owner has not taken
 * back out, of a Group they have not deleted. Written as the condition of an
 * INNER join from `group_items` to `groups`, so a reader cannot reach the Group
 * without reading both tombstones.
 *
 * AN INNER JOIN'S AND ONLY THAT. As the `ON` of a left join it would keep
 * every membership, dead or live, and only blank the Group beside a dead one.
 *
 * ONE SPELLING FOR EVERY READER (CNCORE-234): `inTheGroup` below, which
 * narrows every Listing, `findGroupsOfItem`, which the Item page reads, and the
 * purge's `deleteOrphansAmong`, which keeps an Item the Owner put in a Group.
 * Each had its own copy, and they agreed only because each was copied.
 * CNCORE-230 is the day they did not: this file read the membership's
 * tombstone and not the Group's while the Item page read both, so a membership
 * that outlived its Group narrowed a Listing and was hidden on the Item page.
 *
 * THE JOIN CONDITION AND NOTHING MORE, which is the line CNCORE-230's review
 * drew when it rejected a helper around the whole `innerJoin(groups, ...)`
 * shape: the readers select different columns, so a shared query would be a
 * middle-man. Each still writes its own select and its own narrowing to one
 * Group or one Item, and borrows only what "live" means. An inner join reads
 * its `ON` and its `WHERE` as one condition, so the tombstones moving into the
 * `ON` changed no answer and no plan (measured under CNCORE-234, ADR-0010).
 *
 * EXPORTED WITHIN THE PACKAGE, like `IN_THE_CATALOGUE` above, and out of its
 * public export for that constant's reason.
 */
export const LIVE_GROUP_MEMBERSHIP = and(
  eq(groups.id, groupItems.groupId),
  isNull(groupItems.deletedAt),
  isNull(groups.deletedAt),
) as SQL;

/**
 * WHAT A GROUP NARROWS A LISTING TO (ADR-0010): the Items the Owner put in it
 * and has not taken back out.
 *
 * ONE PREDICATE FOR EVERY LISTING, which is the spec's own requirement rather
 * than tidiness: a Group that meant one thing on the catalogue and another on
 * Catalogue search would be two scopes wearing one name. So each Listing `and`s
 * THIS onto its own `within`, through `withinTheGroup` below, and none spells
 * membership for itself: the catalogue since CNCORE-179, and work-browsing and
 * Catalogue search since CNCORE-180.
 *
 * COMPOSED INTO `within` RATHER THAN PASSED TO `walkListing`, which is where a
 * Listing's question is already assembled: Catalogue search `and`s its match
 * onto the catalogue's rule the same way, and `catalogue-search.ts` has already
 * turned down a parameter on `walkListing` that only one caller would pass.
 * What keeps the size honest is `theSize` reading the same `within` as the
 * Rows, so the narrowing only has to arrive there once.
 *
 * IT NARROWS THE LISTING'S OWN QUESTION RATHER THAN REPLACING IT. `and`ed onto
 * whatever `within` the Listing asked, so an Item deleted from the catalogue
 * stays gone from a Group it still sits in -- deleting an Item names no Group,
 * so its membership is live and only the catalogue's rule keeps it out.
 *
 * THE GROUP'S TOMBSTONE AS WELL AS THE MEMBERSHIP'S, read through `groups`
 * rather than trusted to `group_items` (CNCORE-230). `deleteGroupByHand`
 * tombstones both in one transaction and `putItemInGroupByHand` refuses a
 * Group that is not live, but a put that read the Group live before a deletion
 * landed inserts after it, and no foreign key refuses a row whose Group is
 * only tombstoned (ADR-0075). That leaves a live membership under a dead Group,
 * and joining through `LIVE_GROUP_MEMBERSHIP` is what makes it narrow to
 * nothing however the race falls -- the reading `findProvidersAGroupAsks` makes
 * of `group_providers`.
 *
 * UNCORRELATED, which is the lesson `howMuchItHolds` carries a paragraph about.
 * The subquery names `group_items` and `groups` and nothing else, so no inner
 * relation can resolve to the outer `items` and nothing needs an alias to be
 * right. It is the set of the Group's Items, asked once, and the Listing keeps
 * the Rows in it.
 *
 * A GROUP THAT NAMES NOTHING NARROWS TO NOTHING, which is ADR-0066's rule for a
 * parameter that is not an identity: whether it names anything is what the
 * ANSWER says. A cursor naming nothing starts the walk over because it is a
 * position; this is a question, and the honest answer to "what is in a Group
 * nobody drew" is nothing. The shape guard is `findItem`'s, for its reason: a
 * string that is no uuid reaches a `uuid` column as error 22P02, and a typo in
 * a shared link would read as a server fault.
 */
function inTheGroup(db: Database, group: string): SQL {
  if (!canBeAnId(group)) return sql`false`;
  return inArray(
    items.id,
    db
      .select({ itemId: groupItems.itemId })
      .from(groupItems)
      .innerJoin(groups, LIVE_GROUP_MEMBERSHIP)
      .where(eq(groupItems.groupId, group)),
  );
}

/**
 * ONE LISTING'S QUESTION, NARROWED TO THE GROUP A READER PICKED -- or left as
 * it was, where they picked none (CNCORE-180).
 *
 * THE ONE PLACE A LISTING TAKES A GROUP, so the three that do cannot come to
 * disagree about what an absent one means. It was a ternary in `readCatalogue`
 * while the catalogue was the only Listing that narrowed; three copies of it
 * would be the same rule spelled three times, free to drift into one surface
 * reading `?group=` blank as "every Item" and another as "none".
 *
 * ABSENT IS THE LISTING UNNARROWED, which is what clearing the scope is. A
 * Group that names nothing is not absent: it is `inTheGroup`'s to answer, and
 * it narrows to nothing.
 *
 * EXPORTED WITHIN THE PACKAGE, like `IN_THE_CATALOGUE` above, because
 * Catalogue search assembles its question in `catalogue-search.ts` and has to
 * narrow it the same way. It stays out of the package's public export: a
 * caller outside hands a Group to `readCatalogue`, `readWorks` or
 * `searchCatalogue`, never to a predicate.
 */
export function withinTheGroup(db: Database, group: string | undefined, within: SQL): SQL {
  return group === undefined ? within : (and(within, inTheGroup(db, group)) as SQL);
}

/**
 * ONE LISTING'S QUESTION, NARROWED TO THE KIND A READER PICKED (ADR-0150;
 * CNCORE-175, story 25) -- or left as it was, where they picked none.
 *
 * THE READER'S NARROWING, NEVER THE SURFACE'S QUESTION, and ADR-0077 is what
 * draws that line. That record decides which kinds a surface's QUESTION
 * includes: work-browsing answers "what can I watch" and excludes the entity
 * kinds, the catalogue answers "what is in this catalogue" and excludes
 * nothing, and NEITHER is the reader's to change -- "naming the question lets a
 * surface classify itself". This narrows whichever question was asked, which is
 * a different act on a different axis, and it is `and`ed on exactly as
 * `withinTheGroup` above is. So a narrowed `/works` is still work-browsing, and
 * no value of this parameter turns `/` into it: the entity kinds a narrowed
 * catalogue shows are ones the catalogue's own question already included.
 *
 * A KIND THAT NAMES NOTHING NARROWS TO NOTHING, which is ADR-0066's rule for a
 * parameter that is not an identity and the same answer `inTheGroup` gives. It
 * needs no shape guard, which that function does: `kind` is `text` and a
 * comparison against it is a comparison, where a non-uuid against a `uuid`
 * column is error 22P02.
 *
 * IT TAKES NO `Database`, where `withinTheGroup` does, because a kind is a
 * column on the row rather than a membership to be looked up. One `eq` against
 * `items.kind` -- the single-valued, decidable column ADR-0005 insists on -- is
 * the whole of it, and a subquery here would be reaching for a table to learn
 * what the row already says.
 */
export function narrowedToTheKind(kind: string | undefined, within: SQL): SQL {
  return kind === undefined ? within : (and(within, eq(items.kind, kind)) as SQL);
}

/**
 * THE KEY THE CATALOGUE SORTS ON (ADR-0014), written once.
 *
 * The order and the cursor that walks it are one rule, and spelling it twice is
 * how they come to disagree about where a page ended.
 *
 * EXPORTED WITHIN THE PACKAGE for the reason above it: Catalogue search breaks
 * its own ties on the catalogue's order, so it is a third reader of this.
 */
export const SORT_KEY = sql<string | null>`coalesce(${items.sortName}, ${items.title})`;

/**
 * THE ORDER THE CATALOGUE IS READ IN: ADR-0014's projected key, and the item's
 * id behind it so two items sharing a key list in the same order twice.
 *
 * ONE VALUE, AND BOTH STATEMENTS ARE READ OFF IT (CNCORE-169). `theOrderBy`
 * renders the `ORDER BY` and `pastTheRowIn` renders the cursor comparison that
 * walks it, from these keys and no others. Until this ticket they were two
 * independent statements a sentence required to agree, and four defects came
 * from them disagreeing -- which is the whole of what `order.ts` is about.
 *
 * A KEY ADDED HERE REACHES BOTH, and reaches `findInTheOrder` below too: the
 * anchor it answers with is `AnchorIn<typeof THE_CATALOGUES_ORDER>`, so a key
 * this order gains and that read does not is a type error rather than rows
 * silently stepped over.
 *
 * THE KEY SAYS A DELETE DESTROYS IT, because the projection over no live
 * statements is NULL: a deleted item's key is gone, and an item that has lost
 * it is no anchor to be resumed from. `findTheAnchor` reads that off the key.
 *
 * IT IS ONE ORDER FOR TWO QUESTIONS, which is `readListing`'s own subject: the
 * catalogue and work-browsing differ in their WHERE and in nothing else, so a
 * second order here would be the same rule twice.
 */
const THE_CATALOGUES_ORDER = {
  keys: { sortKey: { key: SORT_KEY, destroyedBy: items.deletedAt } },
  id: items.id,
} satisfies TheOrder;

/**
 * Where one item sits in the catalogue's order.
 *
 * DERIVED FROM THE ORDER rather than declared beside it, for the reason that
 * order gives: an anchor written out by hand is a second list of its keys, and
 * two lists come apart.
 */
type AnchorInTheOrder = AnchorIn<typeof THE_CATALOGUES_ORDER>;

/**
 * THE OTHER VIEW ONE CATALOGUE HAS OF ITSELF (CNCORE-175, story 24): what the
 * Owner added most recently, first.
 *
 * A SECOND ORDER RATHER THAN A SECOND LISTING, which is the whole of why
 * `walkListing` takes the order as a parameter: the catalogue asked in this
 * order is the same question over the same Rows, and only the sequence differs.
 * A Listing of its own would be a second cap, a second cursor and a second
 * count to keep honest -- the arrangement `readListing` above carries a
 * paragraph about.
 *
 * `largestFirst`, BECAUSE "RECENTLY ADDED" READS FROM THE NEWEST END. That is
 * one word here and it reaches both statements: `theOrderBy` renders `desc` and
 * `pastTheRowIn` turns the comparison round to match, which is the pairing
 * `order.ts` exists to make impossible to get wrong.
 *
 * `everyRowHasIt`, BECAUSE `created_at` IS `notNull` WITH A DEFAULT: no Row of
 * this Listing is without one, so the key has no keyless block and the walk
 * needs no branch for one. It is the property that made this the order the
 * dispatcher chose over release date, which is sparse and would have needed the
 * block (2026-09-19).
 *
 * AND NO `destroyedBy`, BECAUSE A DELETE LEAVES IT STANDING. The catalogue's
 * own key is a projection that a delete empties (ADR-0014, ADR-0119), so a
 * cursor into it is refused and the walk starts over; `created_at` is a stored
 * column no tombstone touches, so an anchor here outlives the delete and a kept
 * link resumes. `stillAnAnchorIn` reads that difference off these keys rather
 * than being told it.
 *
 * NO LETTER JUMPS IT, and that is not an omission: `atOrPast` seeks on the
 * LEADING key, and nothing in a sequence of timestamps is filed under a letter.
 * It is the deviation `JumpToALetter` already records for Catalogue search,
 * whose order is a ranking, arrived at for the same reason.
 */
const RECENTLY_ADDED = {
  keys: { addedAt: { key: items.createdAt, largestFirst: true, everyRowHasIt: true } },
  id: items.id,
} satisfies TheOrder;

/**
 * WHICH ORDER A READER ASKED A LISTING FOR, by the word its address carries.
 *
 * `name` IS THE ABSENCE, which is what makes the catalogue's own order the one
 * a bare address answers in: the picker's "By name" link is this Listing with
 * no `order` on it, exactly as the Group picker's "Everything" is this Listing
 * with no `group` on it (CNCORE-179). A second spelling of the default would be
 * two addresses for one page, which ADR-0066's fixed order exists to prevent.
 *
 * A WORD RATHER THAN THE ORDER ITSELF, because a caller outside this package
 * gets `readCatalogue`, `readWorks` or `searchCatalogue` and never a walk it
 * has to supply an order to -- `walkListing`'s own rule, applied to the seam
 * one function out.
 */
export const CHOSEN_ORDERS = ["name", "added"] as const;

export type ChosenOrder = (typeof CHOSEN_ORDERS)[number];

/**
 * Where one item sits in the recently-added order, by the id a reader arrived
 * with -- `findInTheOrder`'s pair, reading the key that order names.
 *
 * THE TIMESTAMP IS HANDED OVER AS AN EXPRESSION, never as the `Date` a column
 * read answers with, and `AValueFor` in `order.ts` carries the measurement: a
 * `Date` is millisecond-precision and this column is microsecond-precision, so
 * binding one back skips every Row tied with the anchor. The value is read as
 * TEXT at the column's own precision and cast back here, so the comparison sees
 * exactly the instant the anchor row holds.
 *
 * A BOUND PARAMETER INSIDE THE CAST, never `sql.raw`: the text came from this
 * database a statement ago, and it is bound rather than spliced all the same,
 * which is the rule `AnchorIn` states for every expression an anchor carries.
 *
 * AND THE TEXT IS `to_char` IN UTC RATHER THAN `::text`, which is what makes the
 * round trip independent of the SESSION. A `timestamptz` cast to text renders
 * in that session's `DateStyle`, and the read and the walk are two statements
 * that may be served by two connections of the pool -- so a `DateStyle` that
 * differed between them would parse the anchor as a different instant. Spelling
 * the format here, in UTC and to the microsecond, means neither setting is
 * load-bearing.
 */
async function findInTheAddedOrder(
  db: Database,
  id: string,
): Promise<AnchorIn<typeof RECENTLY_ADDED> | undefined> {
  const anchor = await findTheAnchor(db, RECENTLY_ADDED, id);
  if (anchor === undefined) return undefined;
  return { addedAt: sql`${anchor.addedAt}::timestamptz`, id: anchor.id };
}

/** One row a cursor might name, read the way every walk has to read it. */
export interface TheAnchor {
  /**
   * ADR-0014's projected key, and NULL FOR TWO REASONS THE KEY ALONE CANNOT
   * TELL APART. An item nobody has titled has no key and is still IN the order:
   * it sorts last, as one block, and a walk has to reach it. A DELETED item has
   * no key because its key is GONE: migration 5 tombstones every statement of a
   * deleted item, that re-fires the projection, and the projection over no live
   * statements is NULL. So the columns are absent rather than hidden, and the
   * row is no anchor at all -- which is why `findTheAnchor` is handed the order,
   * whose key says what a delete does to it.
   */
  sortKey: string | null;
  /**
   * READ BESIDE THE KEY BECAUSE A RELEVANCE-ORDERED WALK NEEDS IT. The
   * catalogue's order is the key alone; Catalogue search ranks on
   * `similarity(title, query)`, so without a title an item is no anchor in that
   * order at all. One read answers both (CNCORE-88).
   */
  title: string | null;
  /**
   * WHEN THE CATALOGUE GAINED THE ROW, which the recently-added order walks on
   * (CNCORE-175). READ BESIDE THE OTHER TWO for the reason the title above is:
   * the select does not move with the order, so one read answers every order
   * over `items` and each caller takes the keys its own order names.
   *
   * NO TOMBSTONE DESTROYS IT, which is why this key names no `destroyedBy` and
   * an anchor in that order outlives the delete: a kept link into it resumes
   * where a link into the catalogue's own order would start over.
   *
   * READ AS TEXT AT THE COLUMN'S OWN PRECISION, never as a `Date`. A
   * `timestamptz` keeps microseconds and a `Date` keeps milliseconds, so the
   * round trip through one drops the last three digits and the walk skips every
   * Row tied with its anchor -- measured, and written up on `AValueFor` in
   * `order.ts`, which refuses the lossy type outright.
   */
  addedAt: string;
  id: string;
}

/**
 * WHERE ONE ID SITS, by the id a reader arrived with -- the read every walk
 * over the catalogue's items starts from, written once.
 *
 * WRITTEN ONCE BECAUSE THE RULES BELOW ARE THE HAZARD, not the query. The
 * tombstone exception and the shape guard are two decisions that must hold for
 * every cursor in this app, and they were spelled twice -- here and in
 * `catalogue-search.ts` -- which is the hazard this file already carries a
 * paragraph about. What each caller keeps for itself is what to DO with the
 * answer, because that is the part their orders genuinely differ on.
 *
 * IT READS PAST THE TOMBSTONE, and that is the one place in this file where
 * not honouring it is right. ADR-0075's rule is about what a reader is SHOWN,
 * and this row is never shown: it is a position.
 *
 * EXCEPT WHERE THE DELETE TOOK THE POSITION, AND THE ORDER IS WHAT SAYS SO. A
 * deleted item has no key left (see `TheAnchor`), so in an order on the
 * projection it is no anchor; read anyway and answered as an untitled row, it
 * resumed a kept link from the untitled tail with every titled item between
 * skipped, and answered NOTHING where there was no tail -- which `/` renders
 * as "The catalogue ends here" (MEASURED 2026-09-12, ADR-0119, CNCORE-110). In
 * an order on a column a delete does NOT destroy, the anchor outlives the
 * delete. So this read is handed the order it is finding an anchor in, and
 * `stillAnAnchorIn` refuses the anchor whose key that order says a delete
 * destroyed. Until CNCORE-195 the row came back with its tombstone and each
 * caller wrote the pair out by hand.
 *
 * THE SELECT DOES NOT MOVE WITH THE ORDER, which is what keeps this one read
 * for the two Listings that share it. The catalogue's anchor is checked against
 * its order by the TYPE, and Catalogue search reads a title here its order does
 * not select, because its leading key is computed in the walk's own statement
 * (`closenessOfTheAnchor`). Only the refusal is the order's, spliced into this
 * read's `where` -- so the order is one over `items`, which both callers' are.
 *
 * AN ID THAT NAMES NOTHING NAMES NO POSITION, so the walk starts at the
 * beginning rather than erroring. That is ADR-0066's rule for a query
 * parameter, and the shape guard is the one `findItem` uses for the reason it
 * gives: comparing a non-uuid against a `uuid` column is error 22P02 rather
 * than an empty result.
 */
export async function findTheAnchor(
  db: Database,
  order: TheOrder,
  id: string,
): Promise<TheAnchor | undefined> {
  if (!canBeAnId(id)) return undefined;
  const [anchor] = await db
    .select({
      sortKey: SORT_KEY,
      title: items.title,
      addedAt: sql<string>`to_char(${items.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      id: items.id,
    })
    .from(items)
    .where(and(eq(items.id, id), stillAnAnchorIn(order)));
  return anchor;
}

/**
 * Where one id sits in THE CATALOGUE'S order, by the id a reader arrived with.
 *
 * THE READ IS `findTheAnchor`'S, AND SO IS THE REFUSAL: handed this order, it
 * turns a deleted anchor away on what the order's key says a delete does to
 * it. What is left here is taking this order's anchor off the row.
 *
 * A DELETED ITEM IS NO ANCHOR, RATHER THAN ONE AT THE END OF THE ORDER, and the
 * two are one predicate apart. This order is `coalesce(sort_name, title)` and a
 * deleted item has neither column left (see `TheAnchor`), so there is nothing
 * to resume from: it names no position, and the walk starts at the beginning.
 * That is the answer ADR-0066 already gives an id that names nothing at all,
 * and the one Catalogue search gives this same fact -- a reader following a
 * kept link is shown the catalogue again and can walk it again, every item
 * still reachable and none skipped, which is the criterion the cap exists to
 * keep (ADR-0119, CNCORE-110).
 *
 * IT IS THE UNTITLED TAIL THIS SEPARATES IT FROM, which is the case that must
 * go on working: an item nobody has titled has no sort key either, sits at the
 * end of the order as one block, and is resumed from by the id alone.
 */
async function findInTheOrder(db: Database, id: string): Promise<AnchorInTheOrder | undefined> {
  const anchor = await findTheAnchor(db, THE_CATALOGUES_ORDER, id);
  if (anchor === undefined) return undefined;
  return { sortKey: anchor.sortKey, id: anchor.id };
}

/**
 * One placement read from the container's end, and where that container puts it
 * (ADR-0009).
 *
 * NAMED PLACEMENT RATHER THAN MEMBER, settled by CNCORE-91: `CONTEXT.md` rejects
 * `member` as a name for this, because a row here IS a placement and a second
 * noun for it would be a second name for a relationship the glossary has already
 * settled. "Members" remains the reader's heading over this list.
 */
export interface PlacementInContainer {
  /**
   * The PLACEMENT's id, which is what `?via=` carries (ADR-0066): the ordering
   * a reader arrived through. It is the placement's rather than the item's
   * because a repeat is one item twice, so only the placement can say which of
   * the two arrivals this link is.
   */
  id: string;
  /** ADR-0014's projected title, so a reader sees a name rather than an id. */
  title: string | null;
  /** The placed item's own address: `/items/<id>` is canonical (ADR-0066). */
  itemId: string;
  /** Where this placement sits in this container's ordering (ADR-0018). */
  position: number | null;
  /**
   * WHO SAYS IT SITS HERE: every source standing behind this placement, by the
   * label each calls itself (ADR-0017). Empty for a placement no source
   * asserted, which is a claim nobody made rather than a row to drop.
   *
   * THE SET RATHER THAN A SPOKESMAN, and that is the whole of CNCORE-90. One
   * item twice in one container is a Repeat (ADR-0009) or two sources
   * disagreeing about position (ADR-0017), nothing STORED tells the two apart,
   * and what does is who asserted each row: one source saying it twice against
   * two sources saying it once each.
   */
  assertedBy: string[];
}

/**
 * EVERY SOURCE STANDING BEHIND ONE PLACEMENT, by the label each calls itself.
 *
 * THE SET, WHERE `spokesmanFor` ABOVE PICKS ONE, and the two answer different
 * questions rather than one of them being the other done loosely. What each
 * question is FOR differs by end: from the container's end the rows are what it
 * HOLDS, in position order (ADR-0018), and from the item's end they are
 * competing ORDERINGS whose order rank decides. But a Repeat and a disagreement
 * are the same shape at BOTH ends -- one title twice here, one container twice
 * there -- so the reader is the one who tells them apart, and needs every name
 * to do it either way.
 *
 * SO BOTH ENDS READ THIS ONE AGGREGATE (CNCORE-90, then CNCORE-121). An earlier
 * draft of this comment said one name was the answer from the item's end, which
 * was true only while that end answered `placedBy` alone: it now reads exactly
 * this lateral, and the two cannot come to disagree about who asserted a
 * placement or about which of them leads.
 */
function assertersOf(db: Database) {
  return (
    db
      .select({
        // `whoSpeaksFirst`, ORDERING EVERY NAME WHERE THE SPOKESMAN PICKS ONE.
        // The same three terms, read from the same array rather than written out
        // again, so the source that speaks for a placement leads the list that
        // names them and the two queries cannot come to disagree about which one
        // that is.
        labels: sql<string[]>`coalesce(
          json_agg(${sources.label} order by ${sql.join(whoSpeaksFirst, sql`, `)}),
          '[]'::json
        )`.as("labels"),
      })
      .from(placementSources)
      .innerJoin(sources, eq(sources.id, placementSources.sourceId))
      .innerJoin(ranks, eq(ranks.rank, placementSources.rank))
      // The same predicate the spokesman reads, tombstone and all.
      .where(standingBehindThePlacement)
      .as("asserters")
  );
}

/** What one container holds, and how much of it this answer carries. */
export interface PlacementsInContainer {
  rows: PlacementInContainer[];
  /**
   * How many placements the container holds ALTOGETHER, which is not
   * `rows.length` whenever the cap bit. A surface that cannot tell the two
   * apart reports the first hundred as the whole ordering.
   */
  total: number;
  /** How many Rows sort before this page's first: `Catalogue`'s `rowsBefore` (ADR-0133). */
  rowsBefore: number;
  /**
   * The PLACEMENT to walk on from, or `null` where the ordering ends here.
   *
   * A PLACEMENT'S ID AND NOT AN ITEM'S, which is the one place this walk
   * departs from ADR-0119's letter -- that record says "the cursor is the id of
   * the last Item the page before it showed". A Repeat is one item twice in one
   * container (ADR-0009), so an item id names TWO rows here and cannot say
   * which of them a page ended on: a cursor cut at one would either serve the
   * recap twice or skip the episode. The placement is the only thing that can
   * tell the two apart, which is the same fact that makes `?via=` a placement's
   * id rather than a container's (ADR-0066).
   */
  continuesAfter: string | null;
  /** The placement to step back from, or `null` where nothing comes before this page (CNCORE-174). */
  continuesBefore: string | null;
}

/**
 * WHAT ONE CONTAINER HOLDS, as the predicate rather than as a query -- written
 * once because TWO SURFACES ANSWER THE SAME NUMBER FROM IT and a reader sees
 * both (ADR-0140): the Members listing reports it as its own `total`, and the catalogue
 * Row beside that container reports it as `holds` (CNCORE-183).
 *
 * THE TWO TOMBSTONES ARE THE HALF THAT WOULD HAVE DRIFTED. A count that read
 * only `placements.deleted_at` would answer a Row with members no reader can
 * reach, because ADR-0075 takes a deleted ITEM away from every listing while
 * its placement sits there live -- so the catalogue would promise 2,913 and
 * the container page would show 2,900 and neither would be able to say which
 * was lying. It is the exact shape `IN_THE_CATALOGUE` and `theSize` already
 * exist for one seam out: one rule, one place, both readers pointed at it.
 *
 * THE HELD ITEM'S TOMBSTONE ARRIVES AS A PARAMETER because the two readers
 * reach it through different names. The Members listing joins `items` itself,
 * and the catalogue's Row is ALREADY selecting from `items` -- so that one
 * reads the held item through an alias, and an inner relation spelled here
 * would resolve to the outer Row and count the container against itself.
 *
 * `held` RATHER THAN `member` WHEREVER A NAME IS BEING GIVEN, alias included.
 * `CONTEXT.md`'s **Placement** rejects `member` as a name for this, and its
 * Language section names a SQL alias among the forms an `_Avoid_` list covers.
 * "Members" is the reader's heading from the container's end and is not a
 * second name for the thing in code.
 */
function whatItHolds(container: Column | string, heldTombstone: SQLWrapper): SQL {
  return and(
    eq(placements.containerId, container),
    isNull(placements.deletedAt),
    // ADR-0075. A deleted item is gone to every reader, so a container
    // cannot go on listing a placement that reaches one.
    isNull(heldTombstone),
  ) as SQL;
}

/**
 * HOW MUCH ONE ROW HOLDS, as a scalar subquery riding on the Rows themselves
 * (ADR-0140), which is that record's whole mechanism: the figure in the Row's
 * own statement, and its predicate read off the Listing it counts.
 *
 * IN THE SAME STATEMENT, WHICH IS THE TICKET'S OWN CRITERION and the same
 * argument `theSize` makes for the Listing's `total`: a figure asked for
 * separately is asked at a different moment, so a page could list an ordering
 * and report a size it no longer has. It is also the only shape that answers
 * per Row at all -- a second read would be one round trip per container on the
 * page.
 *
 * CORRELATED, WHERE THE SIZE BESIDE IT IS NOT, and the difference is the
 * point rather than an inconsistency. `theSize` must not see the cursor,
 * because a keyset predicate would count the Rows past the reader; this must
 * see the Row, because the question is about that container and no other. What
 * keeps the cursor out of it is that it reaches `items` for one column only --
 * the id it is correlated on -- and names `placements` and its own alias for
 * everything else.
 *
 * THE HELD ITEM IS ALIASED so the inner `items` cannot be read as the outer
 * one. Unaliased, `placements.item_id = items.id` and `placements.container_id
 * = items.id` would both resolve inward and every Row would answer the count of
 * items placed in themselves, which is 0 for the whole catalogue -- green
 * against a story and wrong against every ordering.
 *
 * AND THE CORRELATION RIDES ON THE OUTER `items` BEING UNALIASED, which is
 * true because `walkListing` is the one statement this is ever spliced into
 * and it selects `.from(items)`. Aliasing it there would not fail quietly: the
 * `items.id` here would name a relation the statement no longer has.
 */
function howMuchItHolds(db: Database): SQL<number> {
  const held = alias(items, "held");
  return sql<number>`(${db
    .select(HOW_MANY)
    .from(placements)
    .innerJoin(held, eq(held.id, placements.itemId))
    .where(whatItHolds(items.id, held.deletedAt))})`.mapWith(Number);
}

/**
 * WHAT ONE ITEM SITS IN, as the predicate rather than as a query -- the mirror
 * of `whatItHolds` above, from the item's end, and written once for the same
 * reason: TWO SURFACES ANSWER THE SAME NUMBER FROM IT. "Also appears in"
 * reports it as its own `total`, and the catalogue Row beside that story
 * reports it as `sitsIn.total` (CNCORE-184) -- and a Row that said "and 12
 * more" over a page listing 11 would leave the reader no way to say which lied.
 *
 * THE CONTAINER'S TOMBSTONE ARRIVES AS A PARAMETER for `whatItHolds`'s reason
 * turned round: "Also appears in" joins `items` as the container, and the
 * catalogue's Row is already selecting from `items` as the STORY, so that one
 * reads the container through an alias.
 */
function whatItSitsIn(item: Column | string, containerTombstone: SQLWrapper): SQL {
  return and(
    eq(placements.itemId, item),
    isNull(placements.deletedAt),
    // ADR-0075. A deleted container is gone to every reader, so an item
    // cannot go on claiming membership of it.
    isNull(containerTombstone),
  ) as SQL;
}

/**
 * HOW MANY PLACEMENTS A ROW NAMES before it says how many more there are
 * (CNCORE-184), chosen against the Owner's corpus rather than a guess: four
 * stories in five sit at five Positions or fewer, and the longest Row is 61.
 * ADR-0143 carries the distribution and why the cut counts PLACEMENTS rather
 * than Orderings -- one story sits at 43 Positions in ONE Ordering.
 */
const ON_A_ROW = 5;

/**
 * WHERE ONE ROW'S ITEM SITS: its first `ON_A_ROW` placements, and how many it
 * has, as ONE scalar subquery riding on the Rows -- ADR-0140's mechanism for
 * `holds`, reached for again (ADR-0143).
 *
 * BOTH FIGURES FROM ONE AGGREGATE, so they are one pass over one set of rows
 * and cannot come apart: the placements named and the count they are cut from
 * are the same rows, where two subqueries would be two readings of a predicate.
 * The array is aggregated whole and then CUT, which reads every placement of
 * the item to name five -- 61 at most in the corpus, off `placements_item`.
 *
 * ITS ORDER IS NOT "ALSO APPEARS IN"'S, and the difference is deliberate.
 * That listing's middle two keys are ADR-0017's spokesman, a lateral per
 * placement, and they decide which of two DISAGREEING sources speaks first. A
 * Row groups a story's Positions under the Ordering they are in, so what it
 * needs after the container's key is the CONTAINER'S ID -- two Orderings that
 * share a title must not interleave -- and then the Position, so a recap at 1
 * reads before the episode at 5. The two agree wherever one source speaks
 * and no two Orderings share a key, which is the whole of the Owner's corpus:
 * one source behind all 30,896 placements, measured 2026-09-19.
 *
 * CORRELATED ON THE OUTER `items`, which is the story, and THE CONTAINER IS
 * ALIASED so the inner `items` cannot be read as the outer one -- the trap
 * `howMuchItHolds` names, one relation over. An empty membership aggregates to
 * NULL rather than to an empty array, which is what the `coalesce` is for: a
 * story in no Ordering is a real answer (ADR-0062), and the Row carries it as
 * one.
 */
function whereItSits(db: Database): SQL<SitsIn> {
  const container = alias(items, "container");
  const order = {
    keys: {
      containerKey: sql`coalesce(${container.sortName}, ${container.title})`,
      containerId: { key: container.id, everyRowHasIt: true },
      position: placements.position,
    },
    id: placements.id,
  } satisfies TheOrder;
  const onePlacement = sql`json_build_object('containerId', ${container.id}, 'containerTitle', ${container.title}, 'position', ${placements.position})`;
  const inOrder = sql`order by ${sql.join(theOrderBy(order), sql`, `)}`;
  return sql<SitsIn>`(${db
    .select({
      sitsIn: sql`json_build_object('first', coalesce(array_to_json((array_agg(${onePlacement} ${inOrder}))[1:${ON_A_ROW}::int]), '[]'::json), 'total', count(*))`,
    })
    .from(placements)
    .innerJoin(container, eq(container.id, placements.containerId))
    .where(whatItSitsIn(items.id, container.deletedAt))})`;
}

/**
 * What one container holds, in its own order -- CAPPED, COUNTED AND WALKED
 * (ADR-0119, CNCORE-89).
 *
 * THE MIRROR OF `findPlacementsOfItem`, which reads the same table the other
 * way round: that one answers every ordering an item sits in, and this one
 * answers every item one ordering holds. Both are the placement, read from the
 * end the reader is standing at.
 *
 * IT DOES NOT GO THROUGH `walkListing`, AND THE REASON IS THE RELATION RATHER
 * THAN THE ORDER. That function is a walk over `items`: it selects an item's
 * id, joins `item_kinds` for the reader's word and counts `items` matching the
 * question asked. This walks `placements` -- a different relation, whose rows
 * carry a placement's id, no kind at all, an aggregate of who asserted them,
 * and a count of memberships rather than of items. What the two DO share is the
 * page itself, and that is shared: the cap, the extra row, the cursor and the
 * count-in-one-snapshot are `onePage` above, and the two-regime cursor is
 * `pastTheRowIn`, which is `order.ts`'s since CNCORE-169 -- both written once
 * for every listing that has one, because those are the rules that have
 * historically gone wrong separately.
 *
 * THE ORDER IS `position` AND THEN THE PLACEMENT'S ID, named once in
 * `THE_CONTAINERS_OWN_ORDER` below. Both halves are load-bearing in the cursor
 * for the reasons `pastTheRowIn` gives, and they are the same two regimes the
 * catalogue's own walk has: a position nothing asserted is NULL and sorts last
 * as one block, and two placements may share a position (ADR-0009 keeps no unique
 * constraint on it, so a novel and the film adapting it can sit at one point
 * without an order being invented between them).
 *
 * AND THE CAP IS WHAT THE LATERAL MADE URGENT, which is CNCORE-90 measuring for
 * this ticket rather than a coincidence. Each row carries a lateral naming who
 * asserted it: 4.4 ms against 0.8 ms without it, over 1,049 members with two
 * sources each, measured 2026-09-12 on the PostgreSQL 18.6 `compose.yaml` pins
 * (ADR-0017 carries the measurement and what it rests on). That was the cost of
 * the uncapped page this replaces; a capped one pays it over 100 rows.
 */
export async function findPlacementsInContainer(
  db: Database,
  containerId: string,
  { limit, ...at }: { limit: number } & WhereAPageIs,
): Promise<PlacementsInContainer> {
  const asserters = assertersOf(db);
  const held = whatItHolds(containerId, items.deletedAt);
  const cut = await theCutAt(at, (id) => findInTheContainersOrder(db, containerId, id));
  /*
   * THE SIZE (CNCORE-172), AND THIS LISTING IS WHERE THE TWO SPELLINGS WERE
   * FURTHEST APART: raw SQL on the rows with the join between `placements` and
   * `items` written out by hand, and the query builder beside it. The join is
   * the load-bearing half -- a count that did not make it would not see
   * ADR-0075's tombstone on a member, and the ordering would report a size
   * holding items no reader can reach.
   */
  const size = theSize(held, () =>
    db.select(HOW_MANY).from(placements).innerJoin(items, eq(items.id, placements.itemId)),
  );

  return onePage({
    limit,
    size,
    order: THE_CONTAINERS_OWN_ORDER,
    cut: cut && theCut(THE_CONTAINERS_OWN_ORDER, cut),
    read: (howMany, where, orderBy, behindTheCut) =>
      db
        .select({
          id: placements.id,
          title: items.title,
          itemId: placements.itemId,
          position: placements.position,
          /*
           * WHO SAYS IT SITS HERE (ADR-0017, CNCORE-90). A CROSS join where the
           * spokesman's is LEFT, and neither can drop a row: an aggregate with
           * no `group by` answers exactly one row whatever it aggregates, so a
           * placement no source stands behind joins an empty array rather than
           * nothing. The refusal is `findPlacementsOfItem`'s -- the read path
           * does not get to decide a row does not exist because its provenance
           * was never recorded.
           *
           * IT IS ON THE PAGE RATHER THAN ON THE COUNT, which is what the cap
           * buys: the lateral is 4.4 ms against 0.8 ms over 1,049 members, and
           * a capped page pays it over 100 rows instead of over all of them.
           */
          assertedBy: asserters.labels,
          /*
           * THE SAME PREDICATE THE ROWS USE, in the same statement and
           * therefore the same snapshot, and UNCORRELATED so the cursor cannot
           * reach it -- all three for the reasons `walkListing` gives above. The
           * subquery names `placements` and `items` in its own FROM, so those
           * names resolve to its own rows rather than to the walk's.
           */
          total: size.onTheRows,
          behindTheCut,
        })
        .from(placements)
        .innerJoin(items, eq(items.id, placements.itemId))
        .crossJoinLateral(asserters)
        /*
         * BOTH READ OFF ONE VALUE (ADR-0119), which is the whole of what this
         * listing's move to `THE_CONTAINERS_OWN_ORDER` buys: the sort and the
         * comparison that walks it name the same keys because there is only one
         * place they are named. `nulls last` comes with the order rather than
         * being written here, and it is load-bearing -- the keyless block here
         * is CONTEXT.md's Unplaced, a placement with no position rather than an
         * absent one, and the comparison reads where that block sits.
         */
        .where(where)
        .orderBy(...orderBy)
        .limit(howMany),
  });
}

/**
 * THE ORDER A CONTAINER'S OWN ORDERING IS READ IN: ADR-0018's position, and the
 * placement's id behind it so two placements sharing one list in the same order
 * twice.
 *
 * ONE VALUE, AND BOTH STATEMENTS ARE READ OFF IT (ADR-0119). `theOrderBy`
 * renders the `ORDER BY`, `pastTheRowIn` renders the cursor comparison that
 * walks it, and `AnchorIn` is the shape the read below has to answer with -- so
 * a key added here reaches all three in this edit rather than in three.
 *
 * `THE_CONTAINERS_KEY` FURTHER UP IS A DIFFERENT CONTAINER-NESS, and the names
 * are close enough to be worth separating. That one is a key of the container a
 * row is joined to, which is how "Also appears in" leads; this is the order
 * INSIDE one container, which is what that container keeps of its own members.
 */
const THE_CONTAINERS_OWN_ORDER = {
  keys: { position: placements.position },
  id: placements.id,
} satisfies TheOrder;

/**
 * Where one placement sits in its own container's ordering.
 *
 * DERIVED FROM THE ORDER rather than declared beside it, for the reason that
 * order gives: an anchor written out by hand is a second list of its keys, and
 * two lists come apart.
 */
type AnchorInTheContainer = AnchorIn<typeof THE_CONTAINERS_OWN_ORDER>;

/**
 * Where one placement sits in THE CONTAINER'S OWN order, by the id a reader
 * arrived with.
 *
 * SCOPED TO THE CONTAINER, which `findTheAnchor` has no equivalent of because
 * the catalogue is one listing and this is one per container. A position is a
 * number inside ONE ordering, so a placement belonging to a different container
 * names a position that means nothing here -- and resuming at it would cut this
 * container at a number a reader never saw. Out of scope it names nothing, which
 * is ADR-0066's rule for a parameter that is not an identity: the walk starts at
 * the beginning rather than erroring.
 *
 * IT DOES NOT HONOUR THE TOMBSTONE, for ADR-0119's reason: that rule is about
 * what a reader is SHOWN, and this row is never shown -- it is a position.
 *
 * AND HERE THE POSITION SURVIVES THE DELETE, WHICH IS THE CASE ADR-0119
 * PREDICTED AND HAD NO INSTANCE OF. That record splits the tombstone exception
 * because the catalogue's own order is `coalesce(sort_name, title)` and a
 * deleted item has NEITHER column left -- the projection over no live
 * statements is NULL (ADR-0014) -- so its anchor names no position and the walk
 * has to start over. `placements.position` is a stored column that no tombstone
 * touches: the record's own words are that "an order this app does not yet hold
 * ... reads a column a delete does NOT destroy, so its anchor outlives the
 * delete and can still be resumed from". This is that order, so a kept link
 * into a container RESUMES past its anchor's deletion rather than starting the
 * ordering over.
 */
async function findInTheContainersOrder(
  db: Database,
  containerId: string,
  id: string,
): Promise<AnchorInTheContainer | undefined> {
  // The shape guard `findItem` uses, for the reason it gives: comparing a
  // non-uuid against a `uuid` column is error 22P02 rather than an empty result.
  if (!canBeAnId(id)) return undefined;
  // READ BY THE ORDER'S OWN KEYS, so a key it gains is one this read cannot be
  // left without -- and refused by them, which here refuses nothing: no key of
  // this order is one a delete destroys, and that is the paragraph above.
  const [anchor] = await db
    .select(theAnchorIn(THE_CONTAINERS_OWN_ORDER))
    .from(placements)
    .where(
      and(
        eq(placements.id, id),
        eq(placements.containerId, containerId),
        stillAnAnchorIn(THE_CONTAINERS_OWN_ORDER),
      ),
    );
  return anchor;
}

/**
 * One item, by the id a reader arrived with.
 *
 * HONOURS THE TOMBSTONE (ADR-0075). A deleted item is gone to every reader, and
 * so is a withdrawn alias. Every table in migration 1 carries `deleted_at`, and
 * a tombstone nothing reads is half a mechanism: it looks like a delete and
 * behaves like nothing.
 *
 * FOLLOWS AN ALIAS (ADR-0040). A merged-away id stays resolvable forever, so no
 * URL ever breaks, and what comes back is the SURVIVOR under its own canonical
 * id -- the path is identity (ADR-0066) and an alias is not the identity.
 *
 * This lives with the catalogue rather than in the router because it is a rule
 * about what an id MEANS, not about how a request is transported. Every reader
 * gets it, including ones that are not the web app.
 */
export async function findItem(db: Database, id: string): Promise<FoundItem | undefined> {
  if (!canBeAnId(id)) return undefined;

  const live = await findLiveItem(db, id);
  if (live) return live;

  const [alias] = await db
    .select({ itemId: aliases.itemId })
    .from(aliases)
    .where(and(eq(aliases.aliasItemId, id), isNull(aliases.deletedAt)));
  if (!alias) return undefined;

  return findLiveItem(db, alias.itemId);
}

/** The shape of every id in this catalogue. Built once rather than per lookup. */
const idShape = z.uuid();

/**
 * Whether a string could address anything here AT ALL.
 *
 * A string that is not shaped like an id addresses nothing, so it resolves to
 * nothing -- the same answer as an id nobody minted (ADR-0066). Asked BEFORE
 * the query rather than after it, because `items.id` is a Postgres `uuid` and
 * comparing it against `not-a-uuid` is error 22P02 rather than an empty result:
 * without this line a typo in a shared link reads as "this server is broken".
 *
 * `z.uuid()` is the SAME check `itemPublic` makes on the way out (ADR-0045).
 * That agreement is the point rather than a coincidence. A guard looser than
 * the output schema would let a row through here and fail it one layer up, as
 * an output-validation error that is not a defined error -- which is the
 * original 500 back again, moved.
 *
 * It can be this strict because every id here is one this system minted:
 * `defaultRandom()` is `gen_random_uuid()`, and an alias id is a merged-away id
 * of ours rather than one from outside (ADR-0040). Postgres would accept
 * shapes RFC 9562 does not, but nothing puts one in these columns.
 *
 * EXPORTED WITHIN THE PACKAGE, not from it, since CNCORE-182:
 * `findProvidersAGroupAsks` takes the same Group parameter `inTheGroup` does,
 * and a second guard would be a second reading of what an id looks like.
 */
export function canBeAnId(id: string): boolean {
  return idShape.safeParse(id).success;
}

async function findLiveItem(db: Database, id: string): Promise<FoundItem | undefined> {
  const [found] = await db
    // THE ROW'S OWN COLUMNS, ASKED FOR BY THE TABLE rather than listed out. A
    // list here would be a strip-list in reverse -- correct until a migration
    // adds a column and nobody comes back -- and the read path's enumeration
    // (ADR-0045) is the router's job, made one layer up and tested there.
    .select({ ...getTableColumns(items), kindLabel: itemKinds.label })
    .from(items)
    // INNER, because `items.kind` is a foreign key into this table: a row with
    // no kind cannot exist, so there is nothing for a left join to preserve.
    .innerJoin(itemKinds, eq(itemKinds.kind, items.kind))
    .where(and(eq(items.id, id), isNull(items.deletedAt)));
  return found;
}

/**
 * WHICH OF ONE PROVIDER'S RECORDS THIS CATALOGUE ALREADY HOLDS, keyed by the id
 * the provider knows each one by.
 *
 * THE READ HALF OF THE MAPPING `importProvidedRecord` WRITES (migration 3,
 * ADR-0078). That function finds an item again by (source, external id) in order
 * to refresh rather than double it, and the finding is private to it because
 * nothing else had asked. A surface showing a provider's candidates asks out
 * loud: which of these do I already have, and at which Item.
 *
 * IT IS IDENTITY RATHER THAN MATCHING, and the distinction is ADR-0026's. "This
 * provider's record 265 is the item we made from this provider's record 265" is
 * one party, one namespace and no judgement. Deciding that two DIFFERENT
 * providers' records describe one work needs a score, a threshold and a review
 * queue, none of which exists -- so a record one provider holds and another does
 * not answers here as absent, correctly.
 *
 * A PROVIDER IS NAMED BY ITS IDENTITY, WHICH IS ITS URL (ADR-0031), exactly as
 * `purgeProvider` names one. The source row is matched on that and on its KIND,
 * so an owner whose own identity happened to collide with a URL could not answer
 * for a provider's records.
 */
export async function findItemsProvided(
  db: Database,
  { identity, externalIds }: { identity: string; externalIds: string[] },
): Promise<Map<string, string>> {
  // NO QUERY FOR AN EMPTY SET. `inArray` against `[]` is a SQL `in ()`, which
  // Drizzle emits as a false predicate -- so this is correctness-neutral and
  // saves a round trip on the ordinary case of a page with no candidates on it.
  if (externalIds.length === 0) return new Map();

  const rows = await db
    .select({ externalId: statements.valueLiteral, itemId: items.id })
    .from(statements)
    .innerJoin(items, eq(items.id, statements.subjectItemId))
    .innerJoin(properties, eq(properties.id, statements.propertyId))
    .innerJoin(sources, eq(sources.id, statements.sourceId))
    .where(
      and(
        eq(properties.name, "external_id"),
        eq(sources.kind, "provider"),
        eq(sources.identity, identity),
        // THE HASH FIRST, THEN THE VALUES, both load-bearing and both for the
        // reason `itemWithExternalId` gives of its own pair: the index is on
        // `md5(value_literal)` because a btree tuple is capped at 2704 bytes and
        // `value_literal` is unbounded, so the first clause is what reaches the
        // index and the second is what makes a collision harmless rather than a
        // wrong answer. One rule, written the same way in both places.
        inArray(
          sql`md5(${statements.valueLiteral})`,
          externalIds.map((id) => sql`md5(${id})`),
        ),
        inArray(statements.valueLiteral, externalIds),
        isNull(statements.deletedAt),
        isNull(items.deletedAt),
        isNull(sources.deletedAt),
      ),
    );

  // NARROWED RATHER THAN ASSERTED, which is the rule `findAttributionOwed` above
  // already records: `value_literal` is nullable on the column, the `in` clauses
  // make a null impossible here, and TypeScript cannot see a WHERE. A
  // `sql<string>` wrapper would launder the null away and would also launder away
  // a real one the day an item-valued statement could reach this query.
  return new Map(
    rows.flatMap(({ externalId, itemId }): [string, string][] =>
      externalId === null ? [] : [[externalId, itemId]],
    ),
  );
}

/** One of ADR-0005's seven kinds: what the column stores, and the reader's word. */
export interface ItemKind {
  value: string;
  label: string;
}

/**
 * ADR-0005's seven kinds, in the order migration 1 seeds them.
 *
 * READ RATHER THAN LISTED, which is the same rule `findItem` follows for one
 * item's kind: the words are `item_kinds`' own and `CONTEXT.md` is binding on
 * them (CNCORE-83), so a create form offering a hardcoded list would go on
 * offering the old word after a migration renamed it -- and would offer seven
 * after a migration added an eighth.
 *
 * ORDERED BY THE READER'S WORD, and that is the only order available rather
 * than the best one. `item_kinds` carries no sort column, so the seed order --
 * which opens on `work`, the kind an owner cataloguing stories wants nearly
 * every time -- is not a fact this query can recover; an unordered select would
 * leave the list to the planner and let it change between two renders of one
 * page. Alphabetical is stable, and WHICH KIND A FORM OPENS ON IS A SEPARATE
 * QUESTION from what order it lists: the create form preselects `work` itself,
 * so nothing here has to carry that preference.
 */
export async function findItemKinds(db: Database): Promise<ItemKind[]> {
  return db
    .select({ value: itemKinds.kind, label: itemKinds.label })
    .from(itemKinds)
    .orderBy(itemKinds.label);
}
