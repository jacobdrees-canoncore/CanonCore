import type { AppRouterClient } from "./routers";

/**
 * WHAT A CORPUS HOLDS, counted by walking the catalogue's own listings
 * (CNCORE-167).
 *
 * IT TAKES A CLIENT for the reason `import-list.ts` does, and ADR-0135 writes
 * that reason down: `compose.yaml` publishes no database port -- "Only the app
 * talks to this" -- so the app's own API is the only route into a running
 * install. The same function therefore counts the Owner's install, a
 * stranger's, or a test's in-process router with nothing swapped out.
 *
 * AND COUNTING THROUGH THE PRODUCT IS THE POINT RATHER THAN A CONSTRAINT.
 * ADR-0132 says a running instance the Owner opens is the only check in this
 * repository that is not the repository checking itself; a census that reached
 * past the app into Postgres would be the repository checking itself again,
 * one layer lower. Every figure below is one a reader could reach by paging.
 */

/** The Item sitting in the most Orderings, which is CNCORE-184's missing figure. */
export interface MostPlaced {
  itemId: string;
  title: string;
  /** DISTINCT Orderings, so a Repeat does not inflate it. */
  orderings: number;
}

/** One Ordering, as the census found it. */
export interface CountedOrdering {
  id: string;
  title: string;
  /** How many Placements it holds. A Repeat is two of them (ADR-0009). */
  placements: number;
}

export interface CorpusCensus {
  /**
   * EVERY ITEM IN THE CATALOGUE, of every kind: `catalogue.list`'s own `total`
   * rather than a count of what this walk saw. It is the figure the front page
   * shows, so it is the claim worth reading back.
   */
  items: number;
  /** The Containers among them: every Ordering the corpus landed as. */
  orderings: number;
  /**
   * EVERY PLACEMENT ACROSS EVERY ORDERING. A Repeat is two of them (ADR-0009),
   * and one with no Position is still one (CONTEXT.md's Unplaced).
   *
   * `placements` AND NOT `slots`, THOUGH CNCORE-159 AND CNCORE-167 BOTH SAY
   * "SLOTS". This repository has already spent that word on the other side of
   * the relation: ADR-0116 is titled around "positions are SLOTS" and says "two
   * placements sharing a slot are ordered by ids", so a slot is a POSITION that
   * Placements can SHARE. Counting Placements and calling them slots would put
   * two senses of one word in one codebase, which is the hazard CONTEXT.md bans
   * `duplicate` over. The prose keeps the ticket's word; the code uses the
   * model's.
   */
  placements: number;
  /**
   * HOW MANY DISTINCT ITEMS SIT IN AN ORDERING -- the first of the two figures
   * CNCORE-167 takes. CNCORE-159 asserted "about seven thousand" and nothing
   * computed it.
   *
   * `itemsPlaced` AND NOT `storiesPlaced`, because this counts what it can see:
   * distinct Items, of whatever kind. It answers the ticket's "how many
   * DISTINCT stories" exactly when nothing placed is a Container and every
   * placed Item is a Work -- which `orderingsPlaced` below settles for the
   * first half, and which was measured for the second.
   */
  itemsPlaced: number;
  /**
   * HOW MANY OF THOSE PLACED ITEMS ARE THEMSELVES ORDERINGS -- zero in the
   * Doctor Who corpus, and the figure that makes `itemsPlaced` readable as a
   * count of stories.
   *
   * IT IS ASKED RATHER THAN DERIVED, and that is a correction. It was once left
   * to `orderings + itemsPlaced === items`, which proves nothing: one nested
   * Ordering and one Item in no Ordering cancel exactly.
   */
  orderingsPlaced: number;
  /**
   * THE GREATEST NUMBER OF ORDERINGS ANY ONE ITEM SITS IN -- the second, and
   * the one CNCORE-184's truncation cannot be chosen without. `null` where
   * nothing is placed at all.
   */
  mostPlaced: MostPlaced | null;
  /** Every Ordering, largest first: what the surfaces after this are sized against. */
  largest: CountedOrdering[];
}

/**
 * WHAT THE WALK REPORTS AS IT GOES. A corpus-sized census is thousands of
 * requests over several minutes, and `import-list.ts` gives the reason a long
 * operation says where it has got to: silence is indistinguishable from a hang.
 */
export interface CensusProgress {
  /** Once, before the first Ordering is walked: the size of the job. */
  onOrderingsFound?: (found: { orderings: number; items: number }) => void;
  /** Once per Ordering, as it finishes. */
  onOrderingWalked?: (walked: CountedOrdering & { remaining: number }) => void;
}

export async function readCorpusCensus(
  client: AppRouterClient,
  progress: CensusProgress = {},
): Promise<CorpusCensus> {
  const { items, orderings } = await theOrderingsIn(client);
  progress.onOrderingsFound?.({ orderings: orderings.length, items });

  /*
   * WHICH ORDERINGS EACH ITEM SITS IN, accumulated as the walk goes. A `Set`
   * per Item rather than a count, because the same Item reached twice in ONE
   * Ordering is a Repeat (ADR-0009) and two Placements there are still one
   * Ordering.
   */
  const orderingsOf = new Map<string, { title: string; sitsIn: Set<string> }>();
  const counted: CountedOrdering[] = [];
  const isAnOrdering = new Set(orderings.map((ordering) => ordering.id));
  let placements = 0;

  for (const [walked, ordering] of orderings.entries()) {
    let held = 0;
    for await (const placement of thePlacementsOf(client, ordering.id)) {
      held += 1;
      /*
       * THE TITLE COMES OFF THE PLACEMENT ROW, which is what makes this one walk
       * rather than two: the container's own listing names what it holds, so
       * reading a title costs no second request per Item -- and at corpus size
       * that difference is thousands of round trips.
       */
      const sits = orderingsOf.get(placement.itemId) ?? {
        title: placement.title ?? "Untitled item",
        sitsIn: new Set<string>(),
      };
      sits.sitsIn.add(ordering.id);
      orderingsOf.set(placement.itemId, sits);
    }
    placements += held;
    const done = { ...ordering, placements: held };
    counted.push(done);
    progress.onOrderingWalked?.({ ...done, remaining: orderings.length - walked - 1 });
  }

  return {
    items,
    orderings: orderings.length,
    placements,
    itemsPlaced: orderingsOf.size,
    orderingsPlaced: [...orderingsOf.keys()].filter((id) => isAnOrdering.has(id)).length,
    mostPlaced: theMostPlacedIn(orderingsOf),
    largest: [...counted].sort((one, other) => other.placements - one.placements),
  };
}

/**
 * THE FIRST ITEM AT THE HIGHEST COUNT, and the tie is broken by nothing.
 *
 * A TIE IS NOT A DEFECT HERE. The figure CNCORE-184 needs is the NUMBER -- how
 * far a membership list has to be truncated -- and the Item naming it is there
 * so a reader can go and look. Which of several equally-placed Items is named
 * is arbitrary, and pretending otherwise would mean sorting thousands of
 * entries to make an arbitrary choice look decided.
 */
function theMostPlacedIn(
  orderingsOf: Map<string, { title: string; sitsIn: Set<string> }>,
): MostPlaced | null {
  let most: MostPlaced | null = null;
  for (const [itemId, { title, sitsIn }] of orderingsOf) {
    if (most !== null && sitsIn.size <= most.orderings) continue;
    most = { itemId, title, orderings: sitsIn.size };
  }
  return most;
}

/**
 * Every Container in the catalogue, by walking `catalogue.list` to its end.
 *
 * THE WIDE QUESTION RATHER THAN `works`, because ADR-0077 makes those two
 * different questions rather than one with a flag: `list` excludes nothing, so
 * a census built on it cannot miss an Ordering for being of an unexpected kind.
 */
async function theOrderingsIn(client: AppRouterClient) {
  const orderings: Array<{ id: string; title: string }> = [];
  let after: string | undefined;
  let items = 0;
  do {
    const page = await client.catalogue.list({ after });
    /*
     * THE LISTING'S OWN CLAIM ABOUT ITS SIZE, and the LAST page's claim is the
     * one kept. `total` is the figure a reader is shown, so it is the one worth
     * reading back rather than a count of what this walk happened to see.
     *
     * A CATALOGUE EDITED MID-WALK WOULD MAKE THE PAGES DISAGREE, and nothing
     * here detects that -- the last answer simply wins. That is honest for what
     * this is: a census of an install nobody is curating while it runs, where
     * every page answers the same number. Detecting it would mean deciding what
     * a census of a moving catalogue even means, which nothing needs.
     */
    items = page.total;
    for (const row of page.rows) {
      if (row.isContainer) orderings.push({ id: row.id, title: row.title ?? "Untitled item" });
    }
    after = page.continuesAfter ?? undefined;
  } while (after !== undefined);
  return { items, orderings };
}

/**
 * Every Placement of one Ordering, walked a page at a time.
 *
 * `item.get` RATHER THAN A LISTING PROCEDURE OF ITS OWN, because a Container is
 * an Item and its members hang off the Item page (ADR-0004, ADR-0066). `after`
 * is that listing's cursor and `continuesAfter` is where it carries on
 * (ADR-0119) -- so walking the whole of the largest Ordering here is the same
 * walk a reader makes, at the size CNCORE-159 says nothing has ever tried.
 */
async function* thePlacementsOf(client: AppRouterClient, id: string) {
  let after: string | undefined;
  do {
    const page = await client.item.get({ id, after });
    yield* page.holds.rows;
    after = page.holds.continuesAfter ?? undefined;
  } while (after !== undefined);
}
