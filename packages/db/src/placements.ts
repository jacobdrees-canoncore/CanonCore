import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "./index";
import { owners, placementSources, placements } from "./schema";

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
