import {
  and,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNotNull,
  isNull,
  not,
  or,
  type SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import type { Database } from "./index";
import {
  aliases,
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
  entries: PlacementOfItem[];
  /**
   * How many orderings the item sits in ALTOGETHER, which is not
   * `entries.length` whenever the cap bit. A surface that cannot tell the two
   * apart reports the first hundred as every ordering there is.
   */
  total: number;
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
 * page -- `onePage` below -- and the cursor comparison, `pastTheRow`.
 *
 * THE ORDER IS FIVE TERMS AND THE OTHER TWO WALKS HAVE TWO, which is the thing
 * this ticket had to find out rather than assume. `pastTheRow` takes a LIST of
 * keys for that reason: the container's projected sort key, then ADR-0017's two
 * terms deciding which source speaks, then the position, then the placement's
 * id. Every one of the four keys is nullable and each therefore has the two
 * regimes that comparison is named for.
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
  { limit, after }: { limit: number; after?: string },
): Promise<PlacementsOfItem> {
  const spokesman = spokesmanFor(db);
  const asserters = assertersOf(db);
  const sitsIn = and(
    eq(placements.itemId, itemId),
    isNull(placements.deletedAt),
    // ADR-0075. A deleted container is gone to every reader, so an item
    // cannot go on claiming membership of it.
    isNull(items.deletedAt),
  ) as SQL;
  const place = after === undefined ? undefined : await findInThisItemsOrder(db, itemId, after);

  return onePage({
    limit,
    read: (howMany) =>
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
           * THE SAME PREDICATE THE ENTRIES USE, in the same statement and
           * therefore the same snapshot, and UNCORRELATED so the cursor cannot
           * reach it -- all three for the reasons `walkListing` gives. The
           * subquery names `placements` and `items` in its own FROM, so those
           * names resolve to its own rows rather than to the walk's.
           *
           * NO LATERAL IN IT, because counting does not need to know WHO
           * asserted a row. The spokesman decides the order, and an order is
           * not part of a count.
           */
          total:
            sql<number>`(select count(*) from ${placements} inner join ${items} on ${eq(items.id, placements.containerId)} where ${sitsIn})`.mapWith(
              Number,
            ),
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
        .where(and(sitsIn, place && pastAmongItsOrderings(spokesman, place)))
        .orderBy(
          /*
           * `nulls last` IS THE DEFAULT FOR `asc` AND IS WRITTEN OUT ANYWAY on
           * all four keys, for the reason `readListing` gives: the cursor reads
           * it, and a default a walk depends on is one worth saying out loud.
           * Every one of these four columns can be null, so every one of them
           * has a keyless block behind it that a walk must still reach.
           */
          // ADR-0014 gives `sort_name` its own index for exactly this: it is what
          // the catalogue sorts on, and the title is the fallback when no sort-name
          // statement has ever won.
          sql`${THE_CONTAINERS_KEY} nulls last`,
          // THEN THE DISAGREEMENT IS RESOLVED (ADR-0017). Two sources claiming
          // different positions for one item in one container are two rows, both
          // standing and both answered -- and these two terms are what decide which
          // of them SPEAKS, so the winning claim is the one a reader meets first.
          // A source that says nothing about a placement cannot outrank one that
          // does, and NULLs sorting last is what says so.
          sql`${spokesman.precedence} nulls last`,
          sql`${spokesman.sourceOrder} nulls last`,
          // A REPEAT ties on both of those, because one source asserted both rows.
          // Position is what separates it, so a recap at 1 still reads before the
          // episode at 5 -- and the id keeps even two identical rows in one order.
          sql`${placements.position} nulls last`,
          sql`${placements.id}`,
        )
        .limit(howMany),
    asEntry: ({ id, containerId, containerTitle, position, placedBy, assertedBy }) => ({
      id,
      containerId,
      containerTitle,
      position,
      placedBy,
      assertedBy,
    }),
    sizeOnItsOwn: () => countOrderings(db, sitsIn),
  });
}

/** How many orderings one item sits in, asked on its own. */
async function countOrderings(db: Database, sitsIn: SQL): Promise<number> {
  const [counted] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(placements)
    .innerJoin(items, eq(items.id, placements.containerId))
    .where(sitsIn);
  return counted?.total ?? 0;
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

/** Where one placement sits among all the orderings ONE item sits in. */
interface PlaceAmongOrderings {
  /** The container's projected key. Null for a container with neither column. */
  containerKey: string | null;
  /** ADR-0017's two terms, null where no source stands behind the placement. */
  precedence: number | null;
  sourceOrder: number | null;
  position: number | null;
  id: string;
}

/**
 * Where one placement sits in the order "Also appears in" keeps, by the id a
 * reader arrived with.
 *
 * SCOPED TO THE ITEM, exactly as `findInTheContainersOrder` is scoped to its
 * container and for the same reason: this is one listing per item, so a
 * placement of a DIFFERENT item names a place in somebody else's list and
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
 *
 * A LEADING KEY THAT IS GONE LOSES THE WHOLE PLACE, which is why the survivors
 * behind it cannot rescue it. Resuming from `(null, precedence, ...)` would
 * resume from the untitled-container block with every titled one between
 * skipped, which is exactly the dead end CNCORE-110 measured on the catalogue.
 * So the walk starts the list over: nothing skipped, and the price is that a
 * reader deep in the list walks it again.
 *
 * AND THE UNTITLED CONTAINER IS WHAT THIS SEPARATES THAT FROM. A container
 * nobody has titled has no key either, sits at the end of the order as one
 * block, and is resumed from by the three keys behind it -- so the pair is
 * tested, not `deletedAt` alone.
 */
async function findInThisItemsOrder(
  db: Database,
  itemId: string,
  id: string,
): Promise<PlaceAmongOrderings | undefined> {
  // The shape guard `findItem` uses, for the reason it gives: comparing a
  // non-uuid against a `uuid` column is error 22P02 rather than an empty result.
  if (!canBeAnId(id)) return undefined;
  const spokesman = spokesmanFor(db);
  const [place] = await db
    .select({
      containerKey: THE_CONTAINERS_KEY,
      containerDeletedAt: items.deletedAt,
      precedence: spokesman.precedence,
      sourceOrder: spokesman.sourceOrder,
      position: placements.position,
      id: placements.id,
    })
    .from(placements)
    .innerJoin(items, eq(items.id, placements.containerId))
    .leftJoinLateral(spokesman, sql`true`)
    .where(and(eq(placements.id, id), eq(placements.itemId, itemId)));
  if (place === undefined) return undefined;
  // A KEY MISSING BECAUSE THE CONTAINER IS DEAD, which is the pair and not
  // either half -- `containerDeletedAt` alone would refuse an anchor in a
  // deleted container that still had a key, and a null key alone would refuse
  // the untitled container the paragraph above keeps this walk reaching.
  const { containerDeletedAt, ...place_ } = place;
  if (place_.containerKey === null && containerDeletedAt !== null) return undefined;
  // THE TOMBSTONE DOES NOT TRAVEL WITH THE PLACE. It is read to DECIDE whether
  // there is one, and a place carrying it would read as a term of the order.
  return place_;
}

/**
 * Everything "Also appears in" lists AFTER one of this item's placements
 * (ADR-0119).
 *
 * FIVE TERMS, WHICH IS WHY `pastTheRow` TAKES A LIST. The order is the
 * container's projected key, then ADR-0017's two deciding which source speaks,
 * then ADR-0018's position, then the placement's id -- and each of the four
 * keys is nullable, so each has the keyless block that comparison exists for.
 *
 * THE SPOKESMAN IS PASSED IN RATHER THAN REBUILT, because a lateral is a
 * relation: the columns compared here have to be the ones the SELECT joined, and
 * a second `spokesmanFor(db)` would alias a second subquery this statement never
 * joined.
 */
function pastAmongItsOrderings(
  spokesman: ReturnType<typeof spokesmanFor>,
  place: PlaceAmongOrderings,
): SQL | undefined {
  return pastTheRow(
    [
      { key: THE_CONTAINERS_KEY, at: place.containerKey },
      { key: spokesman.precedence, at: place.precedence },
      { key: spokesman.sourceOrder, at: place.sourceOrder },
      { key: placements.position, at: place.position },
    ],
    { id: placements.id, at: place.id },
  );
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
export interface CatalogueEntry {
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
}

/** What the catalogue holds, and how much of it this answer carries. */
export interface Catalogue {
  entries: CatalogueEntry[];
  /**
   * How many items the catalogue holds ALTOGETHER, which is not
   * `entries.length` whenever the cap bit. A surface that cannot tell the two
   * apart reports the first hundred as the whole library.
   */
  total: number;
  /**
   * The id to walk on from, or `null` where the catalogue ends here.
   *
   * IT SAYS BOTH THINGS AT ONCE -- whether there is more, and where it starts
   * -- because a surface that had to work the first out for itself could only
   * do it by subtracting, and a keyset walk has no offset to subtract from.
   */
  continuesAfter: string | null;
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
  { limit, after }: { limit: number; after?: string },
): Promise<Catalogue> {
  return readListing(db, { limit, after, within: IN_THE_CATALOGUE });
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
  { limit, after }: { limit: number; after?: string },
): Promise<Catalogue> {
  return readListing(db, { limit, after, within: WORK_BROWSING });
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
 * THE ORDER IS `coalesce(sort_name, title)`, which is the pair ADR-0014 gives
 * `sort_name` its own index for, with the id behind it so two items sharing a
 * sort key list in the same order twice.
 *
 * AND `after` WALKS IT (ADR-0119): the id of the last item the page before this
 * one carried. Both halves of the order are load-bearing in that comparison,
 * which is what `pastInTheOrder` below is about -- the cap says what is not being shown,
 * and this is what reaches it.
 */
async function readListing(
  db: Database,
  { limit, after, within }: { limit: number; after?: string; within: SQL },
): Promise<Catalogue> {
  const place = after === undefined ? undefined : await findInTheOrder(db, after);
  return walkListing(db, {
    within,
    /*
     * `nulls last` IS THE DEFAULT FOR `asc` AND IS WRITTEN OUT ANYWAY, because
     * `pastInTheOrder` below reads it: an item with no title at all has no sort key, and
     * where those sit decides which half of the cursor's comparison finds them.
     * A default the walk depends on is one worth saying out loud.
     */
    orderBy: [sql`${SORT_KEY} nulls last`, sql`${items.id}`],
    past: place && pastInTheOrder(place),
    limit,
  });
}

/**
 * ONE PAGE OF ONE LISTING, WALKED -- whatever question the listing asks, and
 * whatever order it asks it in.
 *
 * THE ORDER IS A PARAMETER AND THE CURSOR IS ANOTHER, because those are the
 * two things this repo's listings differ in and NOTHING ELSE IS. The catalogue
 * and work-browsing sort on `coalesce(sort_name, title)`; Catalogue search
 * sorts on how close a title is to what a reader typed, which is a function of
 * the QUERY rather than a column of the item (ADR-0119, ADR-0120). Everything
 * around that -- the fields, the join, the count, the cap, the extra row that
 * says whether to offer another page -- is one rule, and this is the one place
 * it is written.
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
export async function walkListing(
  db: Database,
  { within, orderBy, past, limit }: { within: SQL; orderBy: SQL[]; past?: SQL; limit: number },
): Promise<Catalogue> {
  return onePage({
    limit,
    read: (howMany) =>
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
           *
           * `count(*)` is a `bigint`, which node-postgres hands over as a
           * STRING because the range does not fit a JavaScript number.
           * `mapWith(Number)` is where that becomes the number the type claims;
           * without it `total` is a string wearing a number's type.
           */
          /*
           * THE SAME PREDICATE THE ENTRIES USE, which is what makes `total` the
           * size of the question that was ASKED rather than of the whole table.
           */
          total: sql<number>`(select count(*) from ${items} where ${within})`.mapWith(Number),
        })
        .from(items)
        // INNER, because `items.kind` is a foreign key into this table: a row
        // with no kind cannot exist, so there is nothing for a left join to
        // preserve.
        .innerJoin(itemKinds, eq(itemKinds.kind, items.kind))
        .where(and(within, past))
        .orderBy(...orderBy)
        .limit(howMany),
    asEntry: ({ id, title, kindLabel, isContainer }) => ({ id, title, kindLabel, isContainer }),
    sizeOnItsOwn: () => countListing(db, within),
  });
}

/**
 * ONE PAGE CUT OUT OF A LISTING, whatever rows the listing is made of.
 *
 * THREE RULES, AND EACH OF THEM HAS GONE WRONG HERE ALREADY, which is the
 * argument for their being written once rather than per listing:
 *
 * - THE EXTRA ROW. Whether a listing carries on past this page is not
 *   something `total` can answer -- a keyset walk knows no offset, so it
 *   cannot subtract -- and the cheapest thing that does know is a row that was
 *   there to be read. It is read here and never returned, so the reading and
 *   the discarding cannot come apart: a caller that fetched `limit` rows and
 *   handed them over would answer `continuesAfter: null` at every page, which
 *   ADR-0119 makes mean "the listing ends here".
 * - THE SIZE, IN THE SAME SNAPSHOT. It rides on the rows, so a page with NO
 *   rows carries none -- and a page can be empty with a listing behind it,
 *   when a cursor names the last row in it. `sizeOnItsOwn` is asked exactly
 *   there, where there are no entries for a second moment's answer to
 *   disagree with. Catalogue search kept its own copy of this and its own
 *   `count(*) over ()`, which was right only until it had a cursor
 *   (CNCORE-88).
 * - THE CURSOR. The id of the LAST ROW THIS PAGE SHOWED, in whatever order the
 *   listing was read in.
 *
 * IT TAKES THE READ RATHER THAN THE ROWS, so `limit + 1` is spent here beside
 * the slice that undoes it. WHAT IT DOES NOT TAKE IS THE QUERY: the catalogue,
 * work-browsing and Catalogue search all read `items` and go through
 * `walkListing` above, and a Container's members read `placements` -- a
 * different relation, a different id and a different count, so they supply
 * their own select and share these three rules and nothing else.
 */
async function onePage<Row extends { id: string; total: number }, Entry>({
  limit,
  read,
  asEntry,
  sizeOnItsOwn,
}: {
  limit: number;
  read: (howMany: number) => Promise<Row[]>;
  asEntry: (row: Row) => Entry;
  sizeOnItsOwn: () => Promise<number>;
}): Promise<{ entries: Entry[]; total: number; continuesAfter: string | null }> {
  const rows = await read(limit + 1);
  const page = rows.slice(0, limit);
  return {
    entries: page.map(asEntry),
    total: rows[0]?.total ?? (await sizeOnItsOwn()),
    continuesAfter: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
}

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
 * THE KEY THE CATALOGUE SORTS ON (ADR-0014), written once.
 *
 * The order and the cursor that walks it are one rule, and spelling it twice is
 * how they come to disagree about where a page ended.
 *
 * EXPORTED WITHIN THE PACKAGE for the reason above it: Catalogue search breaks
 * its own ties on the catalogue's order, so it is a third reader of this.
 */
export const SORT_KEY = sql<string | null>`coalesce(${items.sortName}, ${items.title})`;

/** Where one item sits in the catalogue's order. */
interface PlaceInTheOrder {
  sortKey: string | null;
  id: string;
}

/**
 * EVERYTHING A LISTING SHOWS AFTER ONE ROW, where the order is a key that may
 * be NULL and an id behind it (ADR-0119). Written ONCE for both such walks.
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
 */
function pastTheRow(
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

/**
 * Everything the catalogue lists AFTER one item (ADR-0119).
 *
 * NAMED FOR THE ORDER IT WALKS, because `walkListing` above takes a `past` of
 * its own -- the SQL rather than the function that builds it -- and a parameter
 * sharing a name with a function in the same file reads as that function.
 * Catalogue search's `pastInTheRanking` is the same pairing one file over.
 *
 * THE ORDER IS ADR-0014's PROJECTED KEY and then the item's id. What that
 * costs to get wrong is on `pastTheRow` above, which is the whole of the
 * comparison.
 */
function pastInTheOrder({ sortKey, id }: PlaceInTheOrder): SQL | undefined {
  return pastTheRow([{ key: SORT_KEY, at: sortKey }], { id: items.id, at: id });
}

/** One row a cursor might name, read the way every walk has to read it. */
export interface TheAnchor {
  /** ADR-0014's projected key. Null for an item with neither column. */
  sortKey: string | null;
  /**
   * WHETHER THE ROW IS A TOMBSTONE, WHICH IS WHAT SEPARATES THE TWO WAYS THE
   * KEY ABOVE CAN BE NULL. An item nobody has titled has no key and is still
   * IN the order -- it sorts last, as one block, and a walk has to reach it. A
   * DELETED item has no key because its key is GONE: migration 5 tombstones
   * every statement of a deleted item, that re-fires the projection, and the
   * projection over no live statements is NULL (ADR-0014). So the columns are
   * absent rather than hidden.
   *
   * THE TWO ROWS ARE IDENTICAL TO ANYTHING READING ONLY THE KEY, and answering
   * the second as though it were the first is what dead-ended a kept link
   * (CNCORE-110): the walk resumed from the untitled tail with every titled
   * item between skipped. Read it and decide, rather than inferring it.
   *
   * A RELEVANCE ORDER NEEDS NO SUCH DISTINCTION, which is why only one caller
   * reads this. Closeness is `similarity(title, ...)`, so Catalogue search has
   * no place for EITHER kind of untitled row and turns both away on the title
   * alone -- the same answer for two facts, arrived at honestly rather than by
   * failing to tell them apart.
   */
  deletedAt: Date | null;
  /**
   * READ BESIDE THE KEY BECAUSE A RELEVANCE-ORDERED WALK NEEDS IT. The
   * catalogue's order is the key alone; Catalogue search ranks on
   * `similarity(title, query)`, so its anchor has no place in the order at all
   * without a title. One read answers both (CNCORE-88).
   */
  title: string | null;
  id: string;
}

/**
 * WHERE ONE ID SITS, by the id a reader arrived with -- the read every walk
 * starts from, written once.
 *
 * WRITTEN ONCE BECAUSE THE RULES BELOW ARE THE HAZARD, not the query. The
 * tombstone exception and the shape guard are two decisions that must hold for
 * every cursor in this app, and they were spelled twice -- here and in
 * `catalogue-search.ts` -- which is the hazard this file already carries a
 * paragraph about. What each caller keeps for itself is what to DO with the
 * answer, because that is the part their orders genuinely differ on.
 *
 * IT DOES NOT HONOUR THE TOMBSTONE, and that is the one place in this file
 * where not honouring it is right. ADR-0075's rule is about what a reader is
 * SHOWN, and this row is never shown: it is a position.
 *
 * IT ALSO DOES NOT DECIDE WHAT A DELETED ROW MEANS, and an earlier version of
 * this paragraph claimed it did -- that reading a deleted item's key "keeps a
 * link to page two working after the item the link was cut at is gone". It
 * does not: a deleted item has NO key to read (see `TheAnchor`), so what comes
 * back is a row with no place in the catalogue's order at all, and the walk
 * answered it as though it were an untitled one. MEASURED 2026-09-12, five
 * items walked two at a time: page two answered the untitled tail rather than
 * the items after the anchor, and nothing at all where there was no tail --
 * which `/` renders as "The catalogue ends here" (ADR-0119, CNCORE-110).
 *
 * SO THE ROW COMES BACK WITH ITS TOMBSTONE AND EACH ORDER DECIDES, which is
 * the split that keeps the exception above worth having. An order this app
 * does not yet have -- on `release_date`, or on when a row was made -- reads a
 * column a delete does NOT destroy, so its anchor still has a place and can
 * still be resumed from. Only the orders built on the projection lose one, and
 * they are the ones that say so: `findInTheOrder` below and `findInTheRanking`
 * one file over.
 *
 * AN ID THAT NAMES NOTHING NAMES NO POSITION, so the walk starts at the
 * beginning rather than erroring. That is ADR-0066's rule for a query
 * parameter, and the shape guard is the one `findItem` uses for the reason it
 * gives: comparing a non-uuid against a `uuid` column is error 22P02 rather
 * than an empty result.
 *
 */
export async function findTheAnchor(db: Database, id: string): Promise<TheAnchor | undefined> {
  if (!canBeAnId(id)) return undefined;
  const [place] = await db
    .select({
      sortKey: SORT_KEY,
      title: items.title,
      id: items.id,
      deletedAt: items.deletedAt,
    })
    .from(items)
    .where(eq(items.id, id));
  return place;
}

/**
 * Where one id sits in THE CATALOGUE'S order, by the id a reader arrived with.
 *
 * THE READ IS `findTheAnchor`'S, AND ONLY THE RULES ARE THIS FUNCTION'S -- the
 * same pairing Catalogue search has one file over, for the same reason: the
 * shape guard and the tombstone exception hold for every cursor in this app,
 * and what to DO with the answer is the part the orders genuinely differ on.
 *
 * A DELETED ANCHOR HAS LOST ITS PLACE RATHER THAN SITTING AT THE END OF THE
 * ORDER, and the two are one predicate apart. This order is
 * `coalesce(sort_name, title)` and a deleted item has neither column left (see
 * `TheAnchor`), so there is nothing to resume from: it names no position, and
 * the walk starts at the beginning. That is the answer ADR-0066 already gives
 * an id that names nothing at all, and the one Catalogue search gives this
 * same fact -- a reader following a kept link is shown the catalogue again and
 * can walk it again, every item still reachable and none skipped, which is the
 * criterion the cap exists to keep (ADR-0119, CNCORE-110).
 *
 * IT IS THE UNTITLED TAIL THIS SEPARATES IT FROM, which is the case that must
 * go on working: an item nobody has titled has no sort key either, sits at the
 * end of the order as one block, and is resumed from by the id alone.
 */
async function findInTheOrder(db: Database, id: string): Promise<PlaceInTheOrder | undefined> {
  const anchor = await findTheAnchor(db, id);
  if (anchor === undefined) return undefined;
  // A KEY MISSING BECAUSE THE ROW IS DEAD, which is the pair and not either
  // half: `deletedAt` alone would refuse an anchor whose key a delete had left
  // alone, and that is the case the paragraph above keeps this exception for.
  if (anchor.sortKey === null && anchor.deletedAt !== null) return undefined;
  return { sortKey: anchor.sortKey, id: anchor.id };
}

/**
 * How many items ONE LISTING holds, asked on its own.
 *
 * IT TAKES THE PREDICATE rather than assuming the catalogue's, for the reason
 * `readListing` gives: the size has to answer the same question the entries do.
 */
async function countListing(db: Database, within: SQL): Promise<number> {
  const [counted] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(items)
    .where(within);
  return counted?.total ?? 0;
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
  entries: PlacementInContainer[];
  /**
   * How many placements the container holds ALTOGETHER, which is not
   * `entries.length` whenever the cap bit. A surface that cannot tell the two
   * apart reports the first hundred as the whole ordering.
   */
  total: number;
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
 * `pastTheRow` -- both written once for every listing here, because those
 * are the rules that have historically gone wrong separately.
 *
 * THE ORDER IS `position` AND THEN THE PLACEMENT'S ID, which is the order this
 * query already had. Both halves are load-bearing in the cursor for the reasons
 * `pastTheRow` gives, and they are the same two regimes the catalogue's
 * own walk has: a position nothing asserted is NULL and sorts last as one
 * block, and two placements may share a position (ADR-0009 keeps no unique
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
  { limit, after }: { limit: number; after?: string },
): Promise<PlacementsInContainer> {
  const asserters = assertersOf(db);
  const held = and(
    eq(placements.containerId, containerId),
    isNull(placements.deletedAt),
    // ADR-0075. A deleted item is gone to every reader, so a container
    // cannot go on listing a placement that reaches one.
    isNull(items.deletedAt),
  ) as SQL;
  const place =
    after === undefined ? undefined : await findInTheContainersOrder(db, containerId, after);
  const past = place && pastInThisContainer(place);

  return onePage({
    limit,
    read: (howMany) =>
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
           * THE SAME PREDICATE THE ENTRIES USE, in the same statement and
           * therefore the same snapshot, and UNCORRELATED so the cursor cannot
           * reach it -- all three for the reasons `walkListing` gives above. The
           * subquery names `placements` and `items` in its own FROM, so those
           * names resolve to its own rows rather than to the walk's.
           */
          total:
            sql<number>`(select count(*) from ${placements} inner join ${items} on ${eq(items.id, placements.itemId)} where ${held})`.mapWith(
              Number,
            ),
        })
        .from(placements)
        .innerJoin(items, eq(items.id, placements.itemId))
        .crossJoinLateral(asserters)
        .where(and(held, past))
        /*
         * `nulls last` IS THE DEFAULT FOR `asc` AND IS WRITTEN OUT ANYWAY, for
         * the reason `readListing` gives: `pastInThisContainer` reads it, and a
         * default the walk depends on is one worth saying out loud.
         */
        .orderBy(sql`${placements.position} nulls last`, sql`${placements.id}`)
        .limit(howMany),
    asEntry: ({ id, title, itemId, position, assertedBy }) => ({
      id,
      title,
      itemId,
      position,
      assertedBy,
    }),
    sizeOnItsOwn: () => countPlacements(db, held),
  });
}

/** How many placements one container holds, asked on its own. */
async function countPlacements(db: Database, held: SQL): Promise<number> {
  const [counted] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(placements)
    .innerJoin(items, eq(items.id, placements.itemId))
    .where(held);
  return counted?.total ?? 0;
}

/** Where one placement sits in its own container's ordering. */
interface PlaceInTheContainer {
  position: number | null;
  id: string;
}

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
 * deleted item has NEITHER column left -- the projection over no live statements
 * is NULL (ADR-0014) -- so its anchor names no position and the walk has to
 * start over. `placements.position` is a stored column that no tombstone
 * touches: the record's own words are that "an order this app does not yet hold
 * ... reads a column a delete does NOT destroy, so its anchor still has a place
 * and can still be resumed from". This is that order, so a kept link into a
 * container RESUMES past its anchor's deletion rather than starting the
 * ordering over.
 */
async function findInTheContainersOrder(
  db: Database,
  containerId: string,
  id: string,
): Promise<PlaceInTheContainer | undefined> {
  // The shape guard `findItem` uses, for the reason it gives: comparing a
  // non-uuid against a `uuid` column is error 22P02 rather than an empty result.
  if (!canBeAnId(id)) return undefined;
  const [place] = await db
    .select({ position: placements.position, id: placements.id })
    .from(placements)
    .where(and(eq(placements.id, id), eq(placements.containerId, containerId)));
  return place;
}

/**
 * Everything a container holds AFTER one of its own placements (ADR-0119).
 *
 * THE ORDER IS ADR-0018's POSITION and then the placement's id, and both halves
 * are load-bearing for the reasons `pastTheRow` gives: the keyless block
 * here is CONTEXT.md's Unplaced -- a placement with no position rather than an
 * absent one -- and the ties are the ones ADR-0009 licenses by keeping no
 * unique constraint on (container_id, position).
 */
function pastInThisContainer({ position, id }: PlaceInTheContainer): SQL | undefined {
  return pastTheRow([{ key: placements.position, at: position }], {
    id: placements.id,
    at: id,
  });
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
 */
function canBeAnId(id: string): boolean {
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
