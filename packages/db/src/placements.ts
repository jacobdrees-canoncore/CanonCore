import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import type { Database } from "./index";
import { owners, placementSources, placements, sources } from "./schema";

/**
 * A transaction, or the database itself.
 *
 * BOTH, because one operation writes a placement whether it arrives alone from
 * the owner's hand or as one of sixty inside a bulk import's transaction. Two
 * copies of the rule below -- one taking a transaction and one not -- is how the
 * import path and the hand path end up disagreeing about what agreement means.
 */
export type Writer = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface AssertedPlacement {
  containerId: string;
  itemId: string;
  /**
   * Where it sits, or NULL when this source asserts membership and no position.
   * A member with no position is still a member (migration 2).
   */
  position: number | null;
  /** Who says so. An ordering is a dated claim by a named source (ADR-0017). */
  sourceId: string;
}

/*
 * NO `rank` PARAMETER, AND ITS ABSENCE IS DELIBERATE. `placement_sources.rank`
 * exists from migration 1 and `findPlacementsOfItem` reads it -- the owner's
 * favourite outranks the whole source order (ADR-0024) -- but NOTHING IN THE
 * PRODUCT SETS ONE. There is no surface where an owner locks a placement
 * against a provider that disagrees, so a parameter here would be a write path
 * with no caller. It arrives with that surface; the column's default is
 * `normal` until then.
 */

/**
 * One source asserting that an item sits in a container at a position.
 *
 * THE ONE PLACE A PLACEMENT IS WRITTEN, reached by `browse` and by the owner's
 * own hand alike, because ADR-0017's rule is about the claim rather than about
 * who is making it.
 *
 * FOUND OR CREATED, NEVER BLINDLY INSERTED. Sources AGREEING about a placement
 * are recorded against ONE row with a source each: the same item at the same
 * position twice is never a deliberate duplicate, it is always agreement, and
 * agreement is corroboration rather than noise. Two rows would turn a second
 * provider confirming an ordering into a second claim a reader has to tell
 * apart from the first.
 *
 * A source DISAGREEING about position needs nothing here. A different position
 * is a different placement, so it takes a row of its own and both stand --
 * which of them SPEAKS is decided at read time, by rank, and
 * `findPlacementsOfItem` is where that lives.
 *
 * AND THE SOURCE ROW IS FOUND OR CREATED TOO, so one provider asserting the
 * same placement twice -- a second browse of a container it already claimed --
 * writes no second row rather than failing on `placement_sources_placement_source`.
 * It moves that row's `observed_at` to now and nothing else (CNCORE-360), so a
 * claim the source withdrew stays withdrawn.
 */
export async function assertPlacement(
  writer: Writer,
  { containerId, itemId, position, sourceId }: AssertedPlacement,
): Promise<string> {
  const ownerId = await theOwnerId(writer);

  const [existing] = await writer
    .select({ id: placements.id })
    .from(placements)
    .where(
      and(
        eq(placements.ownerId, ownerId),
        eq(placements.containerId, containerId),
        eq(placements.itemId, itemId),
        // `= NULL` is never true, so an unpositioned member has to be matched
        // with `IS NULL` or every source asserting one writes its own row --
        // which is the agreement rule broken for exactly the members the
        // constraint's NULLS NOT DISTINCT was widened to cover.
        position === null ? isNull(placements.position) : eq(placements.position, position),
      ),
    );

  const placementId =
    existing?.id ?? (await insertPlacement(writer, { ownerId, containerId, itemId, position }));

  await writer
    .insert(placementSources)
    .values({ ownerId, placementId, sourceId })
    // SAID AGAIN, SO TAKEN AGAIN. `observed_at` is the moment the source last
    // made this claim, and a read refuses one older than the source's declared
    // ceiling (ADR-0036, CNCORE-360). Only the moment moves: `deleted_at` is
    // left as it stood, so this revives nothing.
    .onConflictDoUpdate({
      target: [placementSources.ownerId, placementSources.placementId, placementSources.sourceId],
      set: { observedAt: sql`now()` },
    });

  return placementId;
}

async function insertPlacement(
  writer: Writer,
  values: { ownerId: string; containerId: string; itemId: string; position: number | null },
): Promise<string> {
  const [written] = await writer.insert(placements).values(values).returning({ id: placements.id });
  if (!written) throw new Error("insert returned no placement");
  return written.id;
}

/** ADR-0044: there is exactly one, and a unique index on a constant says so. */
export async function theOwnerId(writer: Writer): Promise<string> {
  const [owner] = await writer.select({ id: owners.id }).from(owners);
  if (!owner) throw new Error("migration 1 seeds exactly one owner row; none found");
  return owner.id;
}

/**
 * The owner's own source row: kind `owner`, first in the global order at
 * `source_order` 0 (ADR-0025, migration 1).
 *
 * FOUND, NEVER CREATED, which is the difference from `providerSource`. A
 * provider takes a row on its first import because providers arrive over time;
 * there is exactly one owner (ADR-0044) and migration 1 seeds their source, so
 * a missing row here is a broken install rather than a row to write. Writing
 * one would also have to pick a `source_order`, and every value but 0 would
 * silently put the owner behind a provider.
 *
 * IT LIVES HERE RATHER THAN IN `by-hand.ts`, where CNCORE-71 wrote it, because
 * CNCORE-72 gave it a second caller. A title the owner typed and a member the
 * owner placed are the same source making two claims, and two lookups of "which
 * row is the owner" would be two chances to answer differently -- which is the
 * argument `titledByTheOwner` already makes one file over.
 */
export async function theOwnerSource(writer: Writer, ownerId: string): Promise<string> {
  const [source] = await writer
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.ownerId, ownerId), eq(sources.kind, "owner")));
  if (!source) throw new Error("migration 1 seeds the owner as a source; none found");
  return source.id;
}

/**
 * Whether a thrown thing is Postgres refusing a write on one of `codes`.
 *
 * IT WALKS `cause`, because a driver error arrives wrapped: Drizzle's own
 * `message` is only ever "Failed query: ...", and the SQLSTATE is on the error
 * underneath it.
 *
 * SHARED RATHER THAN WRITTEN TWICE, which is the rule `by-hand.ts` already
 * states about `titledByTheOwner`: "SHARED BECAUSE THEY MUST NOT DRIFT, not
 * merely because it is four lines twice". CNCORE-72 wrote a second copy of this
 * walk with a different SQLSTATE set, and review named it -- the SETS differ
 * because they describe different rules, but how you find a SQLSTATE through a
 * wrapped error is one fact about this driver.
 */
export function isRefusalOn(codes: ReadonlySet<string>, error: unknown): boolean {
  for (const code of sqlstatesIn(error)) if (codes.has(code)) return true;
  return false;
}

/**
 * THE SAME WALK, ANSWERING THE REASON INSTEAD OF WHETHER THERE IS ONE
 * (CNCORE-255). A caller that has a sentence per SQLSTATE needs to know WHICH
 * code matched, and `isRefusalOn` throws that away -- which is how
 * `placement.place` and `placement.move` came to answer one cause out of the
 * four and five that reach them.
 *
 * KEYED ON THE RECORD RATHER THAN A SET BESIDE IT, so a code cannot be added to
 * the narrowing without a sentence to report it by. The two-structure version
 * is the shape that lets them drift.
 */
function refusalIn(
  reasons: Readonly<Record<string, { because: PlacementRefusalCause; sentence: string }>>,
  error: unknown,
): { because: PlacementRefusalCause; sentence: string } | undefined {
  for (const code of sqlstatesIn(error)) {
    // `hasOwn`, SO `constructor` AND `toString` ARE NOT REASONS. `code` is a
    // driver's string and this lookup is a plain object, so an inherited member
    // would otherwise answer here and be thrown as the Owner's sentence.
    if (Object.hasOwn(reasons, code)) return reasons[code];
  }
  return undefined;
}

/** Every SQLSTATE on the `cause` chain, outermost first. */
function* sqlstatesIn(error: unknown): Generator<string> {
  let current: unknown = error;
  while (current instanceof Error) {
    const { code } = current as { code?: unknown };
    if (typeof code === "string") yield code;
    current = current.cause;
  }
}

/**
 * The catalogue REFUSING a placement the owner asked for, as opposed to failing
 * to write one it accepted.
 *
 * ITS OWN TYPE RATHER THAN `ItemRefused`, though the shape is the same one
 * CNCORE-71 established. The two name different subjects -- a kind that is not
 * one of ADR-0005's seven, against a member already sitting where the owner
 * asked to put one -- and a surface that caught one class for both would report
 * "no such kind of item" when what happened was a Repeat at one position.
 */
export class PlacementRefused extends Error {
  /**
   * WHICH refusal this is, for a surface that has to route on it rather than
   * print it. The message stays the sentence an API caller reads.
   */
  readonly because: PlacementRefusalCause;

  constructor(
    { because, sentence }: { because: PlacementRefusalCause; sentence: string },
    options?: ErrorOptions,
  ) {
    super(sentence, options);
    this.because = because;
  }
}

/**
 * WHY a placement was refused, as a word rather than a sentence.
 *
 * THE CODE TRAVELS AND THE COPY DOES NOT (CNCORE-262, CNCORE-275). A refusal
 * raised in a Server Action reaches the Owner's page through a REDIRECT, so
 * whatever carries the reason sits in a URL the Owner can edit and a stranger
 * can compose. Sending the sentence would let a forged link print arbitrary
 * text in this app's voice; sending a word from a closed set cannot, and it
 * leaves the meaning where [[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]]
 * puts it -- with the action, not with whoever typed the address.
 *
 * NOT THE SQLSTATE, which is this package's private business: `23514` in an
 * address bar tells the Owner nothing and pins a schema detail into a URL.
 */
export const PLACEMENT_REFUSAL_CAUSES = [
  "already-there",
  "no-such-item-or-container",
  "cycle",
  "position-out-of-range",
  "not-in-this-container",
] as const;

/**
 * ONE LIST, AND THE TYPE IS READ OFF IT. Written twice -- a union beside an
 * array -- the two drift, and a surface answering "every cause" would go on
 * compiling while it answered four of five. It is also the tuple `z.enum`
 * needs, so the wire schema is this list rather than a third copy.
 */
export type PlacementRefusalCause = (typeof PLACEMENT_REFUSAL_CAUSES)[number];

/** Whether a word handed in from outside names a cause this catalogue raises. */
export function isAPlacementRefusalCause(word: string): word is PlacementRefusalCause {
  return (PLACEMENT_REFUSAL_CAUSES as readonly string[]).includes(word);
}

/**
 * The refusals the owner can actually provoke here, by their SQLSTATE.
 *
 * `23505` is `placements_container_item_position`: the same item, in the same
 * container, at the same position -- or with no position twice, which NULLS NOT
 * DISTINCT makes the same claim. ADR-0009 licences a Repeat at DIFFERENT
 * positions and this is where the qualification bites.
 *
 * `23503` is the foreign key to `items`: a container or an item that is not
 * there. Anything else -- a dropped connection, a disk full -- is NOT the
 * owner's doing and goes on being a fault, which is the narrowing `by-hand.ts`
 * records at greater length.
 *
 * `23514` is `refuse_placement_cycle` (migration 15): a container asked to hold
 * itself, or to hold something it already sits inside. ADR-0074 makes that the
 * DATABASE's refusal rather than the drag's, and it is the owner asking for
 * something impossible rather than the server breaking -- so it belongs with
 * the other two rather than escaping as a fault. The trigger raises
 * `check_violation` for the reason migration 1's category trigger does: there
 * is no SQLSTATE for "that would make a cycle", and a check is what this is.
 *
 * `22003` is a position the COLUMN CANNOT HOLD. `placements.position` is a
 * 32-bit `integer` (migration 1) and every schema above this one accepts any
 * safe integer, so the gap between the two is reachable by a request composed
 * by hand -- `position=9007199254740991` raised `numeric_value_out_of_range`
 * and escaped as a 500. Measured, not reasoned about. It is the same class as
 * the other three: the owner asked for something the catalogue cannot store.
 * Found by review of CNCORE-73, and it fixes `placeItemByHand` as well as the
 * move because the narrowing is ONE structure read by both -- which is the
 * reason to keep it in one place. It was a SET until CNCORE-255, and that
 * sentence read "a set is the right shape for it": the shape was wrong, because
 * a set can say THAT the owner was refused and not WHICH of these four did it,
 * and both routers pass this message to the Owner verbatim.
 *
 * SO EACH CODE CARRIES THE SENTENCE THE OWNER READS, and a code cannot join the
 * narrowing without one. A fifth refusal is raised directly by
 * `movePlacementByHand` below -- a sibling outside the destination container --
 * which is why `placement.move` names five causes where `place` names these four.
 */
const PLACEMENT_REFUSALS: Readonly<
  Record<string, { because: PlacementRefusalCause; sentence: string }>
> = {
  "23505": {
    because: "already-there",
    sentence:
      "That item is already in that container at that position, or already there with no position given.",
  },
  "23503": { because: "no-such-item-or-container", sentence: "No such item or container." },
  /*
   * TWO RAISES SHARE THIS ONE CODE, so the sentence has to hold for both.
   * `refuse_placement_cycle` (migration 15) raises `container % cannot hold
   * itself` when `item_id = container_id`, and `% already holds % through
   * placements` for the walk -- both `USING ERRCODE = 'check_violation'`. An
   * earlier version of this line named the walk alone, which is the defect
   * CNCORE-255 exists to close, one level down from the router.
   */
  "23514": {
    because: "cycle",
    sentence: "A container cannot hold itself, or something it already sits inside.",
  },
  "22003": {
    because: "position-out-of-range",
    sentence: "That position is outside the range the catalogue can store.",
  },
};

/**
 * THE FIFTH REFUSAL, raised directly by `movePlacementByHand` rather than by a
 * SQLSTATE, which is why it sits beside the map instead of inside it.
 */
const A_PLACEMENT_THIS_CONTAINER_DOES_NOT_HOLD = {
  because: "not-in-this-container",
  sentence: "That move named a placement this container does not hold.",
} as const;

/**
 * THE OWNER PUTTING AN ITEM IN A CONTAINER, naming the placement it creates.
 *
 * NOT `assertPlacement`, AND THAT IS THIS TICKET'S FIRST FINDING (ADR-0116).
 * That one is find-or-create on `(owner, container, item, position)`, so an
 * owner placing an item where a provider already placed it would get ONE row
 * with a second source attached rather than a placement of their own. Right for
 * an import, wrong for a hand: the owner would have corroborated the provider
 * instead of making their own claim.
 */
export async function placeItemByHand(
  writer: Writer,
  {
    containerId,
    itemId,
    position,
  }: { containerId: string; itemId: string; position: number | null },
): Promise<string> {
  try {
    const ownerId = await theOwnerId(writer);
    const placementId =
      (await resurrectTombstoned(writer, { ownerId, containerId, itemId, position })) ??
      (await insertPlacement(writer, { ownerId, containerId, itemId, position }));

    await writer
      .insert(placementSources)
      .values({ ownerId, placementId, sourceId: await theOwnerSource(writer, ownerId) })
      // THE OWNER MAY ALREADY STAND BEHIND A RESURRECTED PLACEMENT, since the
      // removal above left `placement_sources` alone. Placing it back is the
      // same claim by the same source, so it adds nothing rather than failing
      // on `placement_sources_placement_source`.
      .onConflictDoNothing({
        target: [placementSources.ownerId, placementSources.placementId, placementSources.sourceId],
      });

    return placementId;
  } catch (cause) {
    // NARROWED, SO A FAULT STAYS A FAULT. Only the rules the owner can break
    // become a refusal; everything else is rethrown untouched. THE SENTENCE IS
    // THE MATCHED CODE'S, not the set's: `placement.place` answers this message
    // rather than its declared one, so a generic sentence would lose the cause
    // (CNCORE-255). What READS it is the procedure's caller -- the web surface
    // still renders its own copy and discards this, which is CNCORE-275.
    const refused = refusalIn(PLACEMENT_REFUSALS, cause);
    if (refused !== undefined) throw new PlacementRefused(refused, { cause });
    throw cause;
  }
}

/**
 * A placement the owner removed, standing in the way of putting it back.
 *
 * IT EXISTS BECAUSE A TOMBSTONE GOES ON OCCUPYING ITS TUPLE.
 * `placements_container_item_position` carries no `deleted_at` predicate, so
 * the removed row still holds `(owner, container, item, position)` and a plain
 * insert of that tuple fails on a constraint naming a row the owner cannot see.
 * Measured against PostgreSQL 18.
 *
 * SO THE ROW IS RESURRECTED RATHER THAN WRITTEN A SECOND TIME, and the id is the one the
 * placement always had -- which is what an external reference, a `?via=` link or
 * a pending undo is already holding (ADR-0078 makes the id a stable surrogate).
 *
 * THIS IS NOT `assertPlacement`'S FIND-OR-CREATE. That one finds a LIVE row and
 * attaches a source to it, which is agreement between sources; this one finds
 * only a REMOVED row, and a live one at that tuple still refuses -- so an owner
 * placing an item where a provider already placed it goes on getting a refusal
 * rather than silently corroborating the provider (ADR-0116).
 */
async function resurrectTombstoned(
  writer: Writer,
  values: { ownerId: string; containerId: string; itemId: string; position: number | null },
): Promise<string | undefined> {
  const [raised] = await writer
    .update(placements)
    .set({ deletedAt: null })
    .where(
      and(
        eq(placements.ownerId, values.ownerId),
        eq(placements.containerId, values.containerId),
        eq(placements.itemId, values.itemId),
        // `= NULL` is never true, so an unpositioned member has to be matched
        // with `IS NULL` -- the same trap `assertPlacement` documents above, and
        // the same one NULLS NOT DISTINCT makes load-bearing here.
        values.position === null
          ? isNull(placements.position)
          : eq(placements.position, values.position),
        // ONLY A REMOVED ONE. A live row at this tuple is the refusal.
        isNotNull(placements.deletedAt),
      ),
    )
    .returning({ id: placements.id });

  return raised?.id;
}

/**
 * THE OWNER TAKING A MEMBER OUT OF ONE CONTAINER, naming the PLACEMENT.
 *
 * NAMING THE PLACEMENT IS WHAT MAKES IT EXPRESSIBLE AT ALL (ADR-0061). "Remove
 * this item from that container" is ambiguous the moment a Repeat is allowed --
 * a recap at position 1 and the episode at position 5 are two placements of one
 * item, and an item-and-container pair cannot say which one the owner meant.
 *
 * IT TOMBSTONES THE PLACEMENT AND LEAVES ITS SOURCES ALONE, which is the half
 * worth reading twice. ADR-0017 gives a placement many sources and lets a source
 * take back only what IT said; the owner removing a member is not the provider
 * withdrawing its claim, so marking the provider's `placement_sources` row
 * deleted would put words in its mouth -- and would be indistinguishable, later,
 * from the withdrawal `import.ts` performs when a provider really does stop
 * asserting a member. So the claim stands and the placement goes, which is also
 * what makes `restorePlacementByHand` below a single-row clear.
 *
 * A TOMBSTONE RATHER THAN A DELETE (ADR-0075), which is what buys the undo
 * ADR-0046 requires of the most frequent editing act in the product.
 *
 * Answers whether it removed anything, so a stale button is an answer rather
 * than a fault.
 */
export async function removePlacementByHand(writer: Writer, placementId: string): Promise<boolean> {
  const removed = await writer
    .update(placements)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(placements.id, placementId), isNull(placements.deletedAt)))
    .returning({ id: placements.id });

  return removed.length > 0;
}

/**
 * THE UNDO ADR-0046 REQUIRES: the removal above, taken back.
 *
 * ONE ROW, AND THAT IS A CONSEQUENCE OF WHAT `removePlacementByHand` DOES
 * RATHER THAN A SHORTCUT. The removal leaves `placement_sources` alone, so
 * there is no second tombstone to clear and the member returns with every claim
 * that ever stood behind it. CNCORE-72's brief anticipated clearing both, on
 * the assumption that the removal would tombstone both; it does not, for
 * ADR-0017's reason, and so this does not either.
 *
 * IT CANNOT COLLIDE WITH THE UNIQUE CONSTRAINT, which is the other thing that
 * brief anticipated. `placements_container_item_position` carries no
 * `deleted_at` predicate, so a TOMBSTONED placement goes on occupying its
 * tuple: nothing can take that tuple while this row holds it, and clearing the
 * tombstone therefore has nothing to collide with. Measured against PostgreSQL
 * 18 -- re-inserting the tuple while the tombstone stands fails on that
 * constraint. What the owner meets instead is `placeItemByHand` above, which
 * meets the tombstone and resurrects it.
 *
 * Answers whether it restored anything.
 */
export async function restorePlacementByHand(
  writer: Writer,
  placementId: string,
): Promise<boolean> {
  const restored = await writer
    .update(placements)
    .set({ deletedAt: null })
    .where(
      and(
        eq(placements.id, placementId),
        /*
         * NOT ONE A SOURCE WITHDREW, WHICH REVIEW FOUND THIS WOULD REVIVE. This
         * cleared the tombstone on any placement at all -- and a removal is not
         * the only thing that sets one. When a provider stops asserting a
         * member, `import.ts` tombstones its `placement_sources` and then the
         * placement itself, once nothing is left standing behind it. An undo
         * pointed at one of those brought back a member with NO live source:
         * `assertedBy: []`, a claim nobody makes, contradicting the withdrawal
         * the provider actually performed.
         *
         * THE TEST IS "HAS SOURCES, NONE OF THEM LIVE", which is the shape only
         * a withdrawal leaves. A removal leaves `placement_sources` alone, so a
         * placement the OWNER removed still has its live claims and passes here.
         *
         * AND A PLACEMENT NOBODY EVER ASSERTED PASSES TOO, which is why the
         * first half of the test is there rather than a bare "has a live
         * source". A row with no `placement_sources` at all is a real state --
         * `findPlacementsInContainer` renders it with an empty `assertedBy`
         * rather than dropping it -- and an owner may undo removing one.
         *
         * It is ADR-0017's rule in the other direction: a source may take back
         * only what it said itself, so the owner does not get to put a
         * provider's words back either.
         */
        sql`(
          not exists (
            select 1 from ${placementSources}
            where ${placementSources.placementId} = ${placements.id}
          )
          or exists (
            select 1 from ${placementSources}
            where ${placementSources.placementId} = ${placements.id}
              and ${placementSources.deletedAt} is null
          )
        )`,
      ),
    )
    .returning({ id: placements.id });

  return restored.length > 0;
}

/**
 * THE DELTA A REORDER WRITES: what moved, and who shifted for it (ADR-0116).
 *
 * ONE TYPE RATHER THAN THE SAME FOUR FIELDS TWICE. It was written out at the
 * function and again at the transaction it delegated to, which is the shape
 * that goes out of step the first time a field is added. Found by review.
 */
export interface Reorder {
  id: string;
  /** The container it now sits in, which ADR-0116 allows to differ from the old one. */
  containerId: string;
  /** ADR-0018, migration 2: a member with no position is still a member. */
  position: number | null;
  /** Only the ones whose Position actually changed, and all in `containerId`. */
  siblings: readonly { id: string; position: number | null }[];
}

/**
 * THE OWNER DRAGGING A MEMBER INTO A NEW PLACE (ADR-0116), which is the fourth
 * of the four mutations ADR-0061 left unbuilt and the one that record is about.
 *
 * IT TAKES THE DELTA, NOT THE ORDERING. The placement that moved -- its
 * container and its position -- together with the siblings whose Position
 * actually changed. Handing it the rebuilt list would be simpler and is refused
 * for one reason: it rewrites every Placement in the container on every drop,
 * so a position a PROVIDER asserted comes back owner-asserted and the
 * disagreement it might have had is gone (ADR-0017). Provenance is what this
 * product is for.
 *
 * THE ARITHMETIC IS THE CALLER'S, and ADR-0116 accepts that cost by name: a bug
 * in it writes FEWER rows than it should rather than more, which fails visibly
 * as an ordering that does not match what was dragged. The whole-ordering bug
 * fails invisibly, by laundering provenance nobody was looking at.
 *
 * Answers whether it moved anything, so a stale row is an answer rather than a
 * fault -- the posture `removePlacementByHand` takes.
 */
export async function movePlacementByHand(
  db: Database,
  { id, containerId, position, siblings }: Reorder,
): Promise<boolean> {
  try {
    /*
     * `await` INSIDE THE `try`, WHICH IS WHAT PUTS THE COMMIT INSIDE IT. The
     * unique is DEFERRED for this transaction (migration 14), so a Repeat that
     * really is a Repeat at one position surfaces at the COMMIT rather than at
     * the statement -- and a bare `return db.transaction(...)` would hand the
     * promise back before the catch could see it. The SQLSTATE is the same
     * `23505` either way, and this is the place that turns it into a sentence.
     */
    return await db.transaction(async (tx) => {
      /*
       * THE RULE IS ABOUT THE ORDERING, WHICH IS ONLY OBSERVABLE BETWEEN
       * TRANSACTIONS (migration 14). `placements_container_item_position` is
       * checked row by row, and a permutation's intermediate states need not
       * keep a rule its end state keeps: a Repeat dragged past its own other
       * copy lands on that copy's tuple mid-way and fails on a constraint the
       * finished ordering does not break. Deferring reads it where it means
       * something.
       *
       * FOR THIS TRANSACTION ONLY. The constraint is `INITIALLY IMMEDIATE`, so
       * every other write in this repository is checked exactly where it was --
       * an import's refusal still arrives at the statement that caused it
       * rather than at a commit where the offending row is no longer in hand.
       */
      await tx.execute(sql`set constraints "placements_container_item_position" deferred`);

      const [moved] = await tx
        .update(placements)
        .set({ containerId, position })
        .where(and(eq(placements.id, id), isNull(placements.deletedAt)))
        .returning({ id: placements.id });
      if (!moved) return false;

      for (const sibling of siblings) {
        /*
         * A SIBLING IS A MEMBER OF THE CONTAINER BEING REORDERED, and the
         * `where` is what says so rather than the caller. ADR-0116 hands the
         * ARITHMETIC to the client and in the same breath says "the client
         * guard is not the check" about the cycle; the sibling SET is the same
         * shape of guard, so a request naming a placement in another ordering
         * would otherwise rewrite a position nobody dragged, in a container the
         * owner was not looking at. Matched on id alone until review read it.
         *
         * THE DESTINATION rather than where the placement came from, because
         * the moved row is already in its new container by this line and the
         * siblings that shift are the ones it now sits among.
         */
        const [shifted] = await tx
          .update(placements)
          .set({ position: sibling.position })
          .where(
            and(
              eq(placements.id, sibling.id),
              eq(placements.containerId, containerId),
              isNull(placements.deletedAt),
            ),
          )
          .returning({ id: placements.id });

        /*
         * AND A SIBLING IT MAY NOT REACH TAKES THE WHOLE MOVE DOWN. Skipping it
         * would leave the ordering half-permuted -- the moved row at its new
         * position and the rows that were to make room for it still where they
         * were -- which is the "writes fewer rows than it should" failure
         * ADR-0116 accepts for a BUG in the arithmetic, not a state to write on
         * purpose. One transaction, so nothing lands.
         */
        if (!shifted) {
          throw new PlacementRefused(A_PLACEMENT_THIS_CONTAINER_DOES_NOT_HOLD);
        }
      }

      return true;
    });
  } catch (cause) {
    // NARROWED, SO A FAULT STAYS A FAULT -- `placeItemByHand`'s rule. The
    // refusal thrown just above is already the right type and passes through.
    if (cause instanceof PlacementRefused) throw cause;
    const refused = refusalIn(PLACEMENT_REFUSALS, cause);
    if (refused !== undefined) throw new PlacementRefused(refused, { cause });
    throw cause;
  }
}
