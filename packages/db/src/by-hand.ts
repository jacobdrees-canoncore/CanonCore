import { and, eq, isNull } from "drizzle-orm";

import { assertClaims, type Transaction } from "./claims";
import type { Database } from "./index";
import { theOwnerId } from "./placements";
import { items, sources } from "./schema";

/**
 * What the owner chooses when they make an Item themselves.
 *
 * NO `externalId`, AND THAT ABSENCE IS THE WHOLE POINT (ADR-0003). An Item may
 * be created with no Provider record and no file, and always -- a novel the
 * owner does not own is a complete entry. `writeProvidedItem` cannot express
 * that: its first act is to look the record up by the id a provider knows it
 * by, and there is no such id here.
 */
export interface ItemByHand {
  /** One of ADR-0005's seven, by its key. */
  kind: string;
  title: string;
  /** ADR-0004: a container is an Item, and whether it is one is STORED. */
  isContainer?: boolean;
  /** ADR-0018: whether its ordering means anything. */
  isOrdered?: boolean;
}

/**
 * Creating an Item by hand, so the catalogue holds things no Provider knows
 * about.
 *
 * THE TITLE IS A STATEMENT, NEVER THE COLUMN. `items.title` is a projection of
 * whichever title statement wins (ADR-0014), maintained by a trigger -- so
 * writing the column here would fill it with a value nobody said, and the next
 * statement written about the item would overwrite it with no trace of where
 * the first came from. The owner is a first-class source (ADR-0071), and this
 * is what makes that true of the create path as well as the edit one.
 *
 * ONE TRANSACTION, for the reason `importProvidedRecord` gives: an item with no
 * title statement renders as "Untitled item" forever.
 */
export async function createItemByHand(
  db: Database,
  { kind, title, isContainer = false, isOrdered = false }: ItemByHand,
): Promise<{ itemId: string }> {
  return db.transaction(async (tx) => {
    const ownerId = await theOwnerId(tx);
    const [written] = await tx
      .insert(items)
      .values({ ownerId, kind, isContainer, isOrdered })
      .returning({ id: items.id });
    if (!written) throw new Error("insert returned no item");

    await assertClaims(tx, {
      ownerId,
      itemId: written.id,
      sourceId: await theOwnerSource(tx, ownerId),
      claims: [{ property: "title", values: [title] }],
    });

    return { itemId: written.id };
  });
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
 */
async function theOwnerSource(tx: Transaction, ownerId: string): Promise<string> {
  const [source] = await tx
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.ownerId, ownerId), eq(sources.kind, "owner")));
  if (!source) throw new Error("migration 1 seeds the owner as a source; none found");
  return source.id;
}

/**
 * The owner editing a title, which is the judgement beating the ranking.
 *
 * IT IS `assertClaims` WITH THE OWNER'S SOURCE, and nothing more, which is why
 * the two rules this has to obey come for free. A source may only withdraw what
 * IT said, so a provider's title is untouched and both claims stand -- the
 * disagreement stays visible on the page rather than being resolved by
 * deletion. And the owner sits at `source_order` 0 (ADR-0025), so the
 * projection picks theirs without anybody ranking anything.
 *
 * ONE TITLE AND NOT A SET, deliberately. `title` is declared `multiple`
 * (migration 1) and a provider genuinely asserts several, but the owner editing
 * a title is REPLACING the value they last typed rather than adding to it --
 * and `assertClaims` makes what this source holds EQUAL to what it now claims,
 * so passing one value withdraws the previous one. An owner who wants two
 * titles wants alternative titles, which is a surface nobody has designed.
 *
 * Answers `false` when that id addresses no live item, which is an answer
 * rather than a failure (ADR-0066) -- the same posture `findItem` takes.
 */
export async function retitleItemByHand(
  db: Database,
  { itemId, title }: { itemId: string; title: string },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const ownerId = await theOwnerId(tx);
    const [found] = await tx
      .select({ id: items.id })
      .from(items)
      // THE TOMBSTONE IS HONOURED (ADR-0075). An item the owner deleted is gone
      // to every reader, so retitling one would write a claim about a grave and
      // report success while the owner sees nothing change.
      .where(and(eq(items.id, itemId), isNull(items.deletedAt)));
    if (!found) return false;

    await assertClaims(tx, {
      ownerId,
      itemId: found.id,
      sourceId: await theOwnerSource(tx, ownerId),
      claims: [{ property: "title", values: [title] }],
    });
    return true;
  });
}
