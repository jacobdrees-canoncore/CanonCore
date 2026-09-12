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
 * adds nothing rather than failing on `placement_sources_placement_source`.
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
    .onConflictDoNothing({
      target: [placementSources.ownerId, placementSources.placementId, placementSources.sourceId],
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
 * The catalogue REFUSING a placement the owner asked for, as opposed to failing
 * to write one it accepted.
 *
 * ITS OWN TYPE RATHER THAN `ItemRefused`, though the shape is the same one
 * CNCORE-71 established. The two name different subjects -- a kind that is not
 * one of ADR-0005's seven, against a member already sitting where the owner
 * asked to put one -- and a surface that caught one class for both would report
 * "no such kind of item" when what happened was a Repeat at one position.
 */
export class PlacementRefused extends Error {}

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
 */
const PLACEMENT_REFUSALS = new Set(["23505", "23503"]);

/** Whether a thrown thing is Postgres refusing on a rule the owner broke. */
function isPlacementRefusal(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    const { code } = current as { code?: unknown };
    if (typeof code === "string" && PLACEMENT_REFUSALS.has(code)) return true;
    current = current.cause;
  }
  return false;
}

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
    // become a refusal; everything else is rethrown untouched.
    if (isPlacementRefusal(cause)) {
      throw new PlacementRefused("the catalogue refused that placement", { cause });
    }
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
 * SO THE ROW IS RESURRECTED RATHER THAN DUPLICATED, and the id is the one the
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
    .where(eq(placements.id, placementId))
    .returning({ id: placements.id });

  return restored.length > 0;
}
