import { and, eq, isNull, sql } from "drizzle-orm";

import type { Database } from "./index";
import { isRefusalOn, theOwnerId, type Writer } from "./placements";
import { groupItems, groups, items } from "./schema";

/**
 * THE CATALOGUE REFUSING WHAT THE OWNER ASKED FOR, as opposed to failing to
 * write something it accepted.
 *
 * A TYPE RATHER THAN A `catch` AT THE CALLER, which is the argument
 * `ItemRefused` makes one file over: a router that caught everything would
 * answer "no such Group" to an Owner whose connection pool had died. And the
 * SQLSTATEs live HERE rather than in the router, because which constraint means
 * "you asked for something impossible" is a fact about the schema.
 */
export class GroupRefused extends Error {}

/**
 * The one refusal the Owner can provoke, by its SQLSTATE.
 *
 * `23503` is `group_items`' foreign keys: a Group or an Item that is not there
 * -- a stale form, a shared link, a scope another tab deleted. Anything else is
 * NOT the Owner's doing and goes on being a fault.
 *
 * AND `23505` IS DELIBERATELY NOT HERE. The unique constraint is MET rather
 * than raised (`putItemInGroupByHand` below), because asking twice is the claim
 * already standing rather than a mistake -- where `placements` treats its own
 * `23505` as a refusal, since a Repeat at one Position is the Owner asking for
 * something ADR-0009 does not licence.
 */
const REFUSALS = new Set(["23503"]);

/**
 * A GROUP AS A READER MEETS IT: what the Owner called it, and the id that
 * addresses it.
 */
export interface Group {
  id: string;
  name: string;
}

/**
 * THE OWNER DRAWING A BROWSING SCOPE (ADR-0010), named in their own words.
 *
 * BY HAND AND ONLY BY HAND. No Provider creates a Group and no import writes
 * one: a scope is the Owner's judgement about their own collection, which is
 * why this function has no `assertGroup` counterpart beside it the way
 * `placeItemByHand` has `assertPlacement`. A Group nobody chose is a partition
 * arriving by another door.
 */
export async function createGroupByHand(writer: Writer, { name }: { name: string }) {
  const [written] = await writer
    .insert(groups)
    .values({ ownerId: await theOwnerId(writer), name })
    .returning({ id: groups.id });
  if (!written) throw new Error("insert returned no group");
  return written.id;
}

/**
 * EVERY GROUP THE OWNER CAN STILL NARROW TO.
 *
 * THE TOMBSTONE IS HONOURED (ADR-0075). A Group the Owner deleted is gone to
 * every reader, which is what makes deletion mean anything on a table nothing
 * ever removes a row from.
 *
 * BY NAME, THEN BY ID, exactly as `findGroupsOfItem` is. Creation order is not
 * an order anybody scans, and the id is what makes the sort TOTAL
 * (`CONTEXT.md`'s Order) now that two Groups may share a name.
 *
 * NOT A LISTING, AND THAT IS A JUDGEMENT THIS TICKET OWNS. Every capped list in
 * CanonCore is one (`CONTEXT.md`), and this is not capped: a Group is a scope
 * the Owner drew by hand, so the count is the number of universes they curate
 * rather than a function of the corpus behind it. The Listing seam is there the
 * day that stops being true, and wrapping an uncapped list in it now would be
 * the cursor machinery with nothing to walk.
 */
export async function findGroups(db: Database): Promise<Group[]> {
  return db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(isNull(groups.deletedAt))
    .orderBy(groups.name, groups.id);
}

/**
 * THE OWNER CORRECTING A NAME THEY CHOSE BADLY (story 32).
 *
 * A COLUMN WRITE AND NOT A STATEMENT, which is the difference from
 * `retitleItemByHand` one file over and is worth reading twice. A title is a
 * CLAIM: Sources assert it, they disagree, and ADR-0012 keeps every version with
 * who said it. A Group's name is not a claim about anything in the world -- it
 * is the Owner's word for their own view, nobody else ever asserts one, and a
 * provenance trail behind it would be machinery with one Source in it forever.
 *
 * ONLY A LIVE GROUP. Renaming a tombstoned one would report success to an Owner
 * who sees nothing change (ADR-0075), which is the same trap `isALiveItem`
 * closes for an edit by hand.
 *
 * Answers whether it renamed anything, so a stale form is an answer rather than
 * a fault (ADR-0066).
 */
export async function renameGroupByHand(
  writer: Writer,
  { id, name }: { id: string; name: string },
): Promise<boolean> {
  const renamed = await writer
    .update(groups)
    .set({ name })
    .where(and(eq(groups.id, id), isNull(groups.deletedAt)))
    .returning({ id: groups.id });

  return renamed.length > 0;
}

/**
 * THE OWNER PUTTING AN ITEM IN A SCOPE (stories 35 and 36).
 *
 * IT NAMES THE GROUP AND THE ITEM, never a row of its own the way
 * `removePlacementByHand` names a Placement. That asymmetry is ADR-0009's: a
 * Repeat puts one Item in one Container twice, so only the Placement can say
 * which of the two the Owner meant. There is no Position here and so no Repeat,
 * which makes the pair unambiguous and is why taking an Item back out below
 * names the pair too.
 *
 * ASKING TWICE IS THE CLAIM ALREADY STANDING, not a refusal. `group_items_group_item`
 * is what makes an Item sit in a Group once, and the conflict is met rather
 * than raised: the Owner asking for something already true has not made a
 * mistake, and a surface that offers an Item and a Group cannot know what the
 * last tab did.
 *
 * AND THE SAME STATEMENT RESURRECTS A TOMBSTONE, which is the half that needs
 * the reason `placements.ts` writes out at length: the unique constraint carries
 * no `deleted_at` predicate, so a row the Owner removed goes on occupying its
 * tuple and a plain insert fails on a constraint naming a row they cannot see.
 * Clearing `deleted_at` on conflict is therefore BOTH cases at once -- a live
 * row is set to what it already holds, and a removed one comes back under the id
 * it always had (ADR-0078).
 *
 * WHERE `placeItemByHand` NEEDS TWO STATEMENTS AND THIS NEEDS ONE, because a
 * live Placement at that tuple must REFUSE (ADR-0116): an Owner placing an Item
 * where a Provider already placed it would otherwise corroborate the Provider
 * rather than making their own claim. Nothing asserts a Group but the Owner, so
 * there is no second Source here to be mistaken for.
 *
 * AND BOTH ENDS ARE CHECKED LIVE FIRST, WHICH THE FOREIGN KEYS CANNOT DO. A
 * tombstone is not a DELETE (ADR-0075), so `group_items`' references resolve
 * perfectly well to a Group the Owner deleted or an Item they removed -- the
 * row would be written, this would answer success, and `findGroupsOfItem` would
 * then hide it again because it honours both tombstones. That is the Owner told
 * it worked while the page shows nothing changed, which is exactly the trap
 * `renameGroupByHand` above closes on the other write, and it is reachable from
 * two tabs or one stale form. Found by review.
 */
export async function putItemInGroupByHand(
  writer: Writer,
  { groupId, itemId }: { groupId: string; itemId: string },
): Promise<string> {
  try {
    if (!(await isLive(writer, groups, groupId)) || !(await isLive(writer, items, itemId))) {
      throw new GroupRefused("the catalogue holds no such live Group or Item");
    }

    const ownerId = await theOwnerId(writer);
    const [written] = await writer
      .insert(groupItems)
      .values({ ownerId, groupId, itemId })
      .onConflictDoUpdate({
        target: [groupItems.ownerId, groupItems.groupId, groupItems.itemId],
        set: { deletedAt: null },
      })
      .returning({ id: groupItems.id });
    if (!written) throw new Error("insert returned no row in group_items");
    return written.id;
  } catch (cause) {
    // NARROWED, SO A FAULT STAYS A FAULT. The liveness refusal above is already
    // a `GroupRefused` and passes through untouched; this is the RACE the check
    // cannot close -- a Group deleted between the check and the insert -- which
    // the foreign key does catch, and which is the same refusal either way.
    if (cause instanceof GroupRefused) throw cause;
    if (isRefusalOn(REFUSALS, cause)) {
      throw new GroupRefused("the catalogue refused that Item in that Group", { cause });
    }
    throw cause;
  }
}

/**
 * WHICH GROUPS THIS ITEM IS IN (story 38), so the Owner can tell why it does or
 * does not appear when they narrow.
 *
 * BY NAME, THEN BY ID. The name is what the reader recognises and the id is what
 * makes the order TOTAL (`CONTEXT.md`'s Order) -- two Groups the Owner called
 * the same thing are allowed, and without the second key which of them comes
 * first would be the planner's choice rather than an answer.
 *
 * BOTH TOMBSTONES ARE HONOURED (ADR-0075): a membership the Owner removed, and
 * a Group they deleted. The second is what makes deleting a Group leave nothing
 * behind on the Item page that no longer has a scope to name.
 */
export async function findGroupsOfItem(db: Database, itemId: string): Promise<Group[]> {
  return db
    .select({ id: groups.id, name: groups.name })
    .from(groupItems)
    .innerJoin(groups, eq(groups.id, groupItems.groupId))
    .where(
      and(eq(groupItems.itemId, itemId), isNull(groupItems.deletedAt), isNull(groups.deletedAt)),
    )
    .orderBy(groups.name, groups.id);
}

/**
 * THE OWNER TAKING AN ITEM BACK OUT OF ONE SCOPE (story 37), leaving every
 * other Group it sits in standing.
 *
 * IT NAMES THE PAIR, for the reason `putItemInGroupByHand` gives: no Position
 * here means no Repeat, so a Group and an Item name exactly one row -- where a
 * Container and an Item name one or two and ADR-0061 makes the removal name the
 * Placement instead.
 *
 * A TOMBSTONE RATHER THAN A DELETE (ADR-0075), which is what lets putting the
 * Item back come to the same row under the same id rather than to a second one.
 *
 * NO CONFIRMATION BELONGS IN FRONT OF THIS (ADR-0046), for the reason removing
 * a Placement gets none: it is a frequent editing act on a product built around
 * multi-placement, and a dialog on the common action teaches people to dismiss
 * the dangerous one unread. Putting it back is one click and the same id.
 *
 * Answers whether it took anything out, so a stale button is an answer rather
 * than a fault (ADR-0066).
 */
export async function takeItemOutOfGroupByHand(
  writer: Writer,
  { groupId, itemId }: { groupId: string; itemId: string },
): Promise<boolean> {
  const removed = await writer
    .update(groupItems)
    .set({ deletedAt: sql`now()` })
    .where(
      and(
        eq(groupItems.groupId, groupId),
        eq(groupItems.itemId, itemId),
        isNull(groupItems.deletedAt),
      ),
    )
    .returning({ id: groupItems.id });

  return removed.length > 0;
}

/**
 * THE OWNER DELETING A SCOPE THEY NO LONGER USE (story 33), WHICH TOUCHES NO
 * ITEM (story 34).
 *
 * THAT IS ADR-0010's PROMISE AND IT IS WHAT THIS FUNCTION IS FOR. A Group is a
 * browsing scope rather than a container, so deleting one narrows nothing away
 * permanently: every Item it named is exactly where it was, in every Ordering it
 * sat in, and in every other Group. An Owner who cannot trust that will not put
 * anything in a scope in the first place.
 *
 * BOTH TOMBSTONES, IN ONE TRANSACTION (ADR-0075). The Group and the rows naming
 * it go together, and leaving the memberships live would be a row that comes
 * back the day something reads `group_items` without joining `groups` -- which
 * is precisely what a narrowed Listing does. A transaction rather than two
 * statements, because a Group deleted with its memberships still standing is the
 * state no reader can see and every later query would trip over.
 *
 * AND `items` IS NOT IN THIS FUNCTION AT ALL, which is the strongest form the
 * promise can take: there is nothing here to get wrong later.
 *
 * Answers whether it deleted anything (ADR-0066).
 */
export async function deleteGroupByHand(db: Database, id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const deleted = await tx
      .update(groups)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(groups.id, id), isNull(groups.deletedAt)))
      .returning({ id: groups.id });
    if (deleted.length === 0) return false;

    await tx
      .update(groupItems)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(groupItems.groupId, id), isNull(groupItems.deletedAt)));

    return true;
  });
}

/**
 * Whether that id addresses a row anybody can still read.
 *
 * ONE HELPER OVER BOTH TABLES, because the question is the same one twice and
 * `by-hand.ts` already has `isALiveItem` for its own half -- a third copy of
 * "is the tombstone null" is a third place for the next tombstoned table to be
 * added to one of them and not the others.
 */
async function isLive(
  writer: Writer,
  table: typeof groups | typeof items,
  id: string,
): Promise<boolean> {
  const [found] = await writer
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), isNull(table.deletedAt)));
  return found !== undefined;
}
