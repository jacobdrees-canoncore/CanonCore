import { and, eq, isNull } from "drizzle-orm";

import { assertClaims, type Transaction } from "./claims";
import type { Database } from "./index";
import { isRefusalOn, theOwnerId, theOwnerSource } from "./placements";
import { items } from "./schema";

/**
 * The catalogue REFUSING an item the owner asked for, as opposed to failing to
 * write one it accepted.
 *
 * A TYPE RATHER THAN A `catch` AT THE CALLER, and the difference is the whole
 * reason this class exists. `item.create` used to wrap the call in a bare
 * `try/catch` and answer BAD_REQUEST for anything thrown -- so a dead
 * connection pool, a permissions change or a bug in this file all reported "No
 * such kind of item" to the owner. That is the mistake CNCORE-14 records on
 * `item.get` run backwards: there it was a missing item read as a broken
 * server, here it is a broken server read as a missing kind.
 *
 * THE POSTGRES CODES LIVE HERE, NOT IN THE ROUTER. Which constraint means "you
 * asked for something impossible" is a fact about the schema, and the schema is
 * this package's. The router's job is to turn a refusal into a status.
 */
export class ItemRefused extends Error {}

/**
 * The two refusals the owner can actually provoke, by their SQLSTATE.
 *
 * `23503` is the foreign key on `item_kinds`: a kind that is not one of
 * ADR-0005's seven. `23514` is `items_ordered_implies_container` (migration 1):
 * an ordering on something that holds nothing. Anything else -- a dropped
 * connection, a disk full, a trigger raising for a reason nobody predicted --
 * is NOT the owner's doing and goes on being a fault.
 */
const REFUSALS = new Set(["23503", "23514"]);

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
  try {
    return await db.transaction(async (tx) => {
      const ownerId = await theOwnerId(tx);
      const [written] = await tx
        .insert(items)
        .values({ ownerId, kind, isContainer, isOrdered })
        .returning({ id: items.id });
      if (!written) throw new Error("insert returned no item");

      await titledByTheOwner(tx, ownerId, written.id, title);

      return { itemId: written.id };
    });
  } catch (cause) {
    // NARROWED, SO A FAULT STAYS A FAULT. Only the two rules the owner can
    // break become a refusal; everything else is rethrown untouched.
    if (isRefusalOn(REFUSALS, cause))
      throw new ItemRefused(`the catalogue refused an item of kind ${kind}`, { cause });
    throw cause;
  }
}

/**
 * The owner claiming a title for one item, which is the ONE operation
 * `createItemByHand` above and `retitleItemByHand` below both perform.
 *
 * SHARED BECAUSE THEY MUST NOT DRIFT, not merely because it is four lines
 * twice. A title the owner gave on CREATE and a title they gave by EDITING are
 * the same claim by the same source -- if the two ever assert differently, an
 * item's provenance would depend on which door its title came through, and
 * nothing on the page could say so.
 */
async function titledByTheOwner(
  tx: Transaction,
  ownerId: string,
  itemId: string,
  title: string,
): Promise<void> {
  await assertClaims(tx, {
    ownerId,
    itemId,
    sourceId: await theOwnerSource(tx, ownerId),
    claims: [{ property: "title", values: [title] }],
  });
}

/**
 * The owner saying where one item FILES, which is the one claim the computation
 * cannot make for itself (ADR-0134, CNCORE-173).
 *
 * `[]` FOR THE EMPTY STRING, which is `notedByTheOwner` below rather than
 * `titledByTheOwner` above, and the choice turns on what the empty value
 * LEAVES. An item with no title statement renders "Untitled item", so an empty
 * title has to be refused. An item with no OWNER sort name still has the one
 * `derived:sort-name-v1` computed for it, so clearing this field is not an
 * absence at all -- it hands the item back to the computation, and it is the
 * only route back from a correction the owner regrets.
 */
async function sortedByTheOwner(
  tx: Transaction,
  ownerId: string,
  itemId: string,
  sortName: string,
): Promise<void> {
  await assertClaims(tx, {
    ownerId,
    itemId,
    sourceId: await theOwnerSource(tx, ownerId),
    claims: [{ property: "sort_name", values: sortName === "" ? [] : [sortName] }],
  });
}

/**
 * The owner's note about one item (ADR-0096), and `''` IS ITS REMOVAL.
 *
 * A NOTE IS A STATEMENT LIKE ANY OTHER, which is that record's whole decision:
 * it gets rank, language and provenance from ADR-0012 rather than a table with
 * three of those columns copied onto it. So writing one is `assertClaims` with
 * the owner's source, exactly as a title is -- and the property declares that
 * nothing else may assert it (migration 12), rather than this function being
 * the place that knows.
 *
 * `[]` RATHER THAN `['']` FOR AN EMPTY NOTE, which is the one line in this
 * repository where the removal actually happens. `assertClaims` makes what a
 * source holds EQUAL to what it now claims, so a source claiming nothing
 * withdraws what it said -- tombstoned (ADR-0075) rather than deleted. ADR-0096
 * carries the rest of the argument, including why an empty note is accepted
 * where an empty title is refused; the callers above this point at it rather
 * than restating it, because a reason written out at seven sites is a reason
 * six of them will drift from.
 */
async function notedByTheOwner(
  tx: Transaction,
  ownerId: string,
  itemId: string,
  note: string,
): Promise<void> {
  await assertClaims(tx, {
    ownerId,
    itemId,
    sourceId: await theOwnerSource(tx, ownerId),
    claims: [{ property: "note", values: note === "" ? [] : [note] }],
  });
}

/**
 * Whether that id addresses an item anybody can still read.
 *
 * THE TOMBSTONE IS HONOURED (ADR-0075). An item the owner deleted is gone to
 * every reader, so writing a claim about one would write about a grave and
 * report success while the owner sees nothing change.
 *
 * A BOOLEAN, WHICH REVIEW ASKED FOR AND WHICH IS HONEST. This answered the id
 * it was handed -- always the same string, since it resolves no alias -- and a
 * caller threading that back out again read as though the lookup had found
 * something it had not.
 *
 * SHARED BY BOTH EDITS BELOW rather than repeated in each, for the reason
 * `titledByTheOwner` gives one function up: two copies of a tombstone check are
 * two chances for the next edit path to be added to one of them.
 */
async function isALiveItem(tx: Transaction, itemId: string): Promise<boolean> {
  const [found] = await tx
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.id, itemId), isNull(items.deletedAt)));
  return found !== undefined;
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
    if (!(await isALiveItem(tx, itemId))) return false;

    await titledByTheOwner(tx, ownerId, itemId, title);
    return true;
  });
}

/**
 * The owner correcting where an item sorts, which is a title's edit applied to
 * the catalogue's second projected column (CNCORE-173).
 *
 * IT IS `assertClaims` WITH THE OWNER'S SOURCE, exactly as `retitleItemByHand`
 * is, and the two rules that matters for come with it. The owner sits at
 * `source_order` 0 and `derived:sort-name-v1` was allocated behind them, so
 * their sort name wins with no rank set; and a source may only withdraw what it
 * said itself, so the computed claim goes on standing beside theirs rather than
 * being erased by a correction. The item page shows both.
 *
 * IT DOES NOT STOP THE COMPUTATION RUNNING. A later retitle re-derives
 * `derived:sort-name-v1` from the new title as it always would -- the owner's
 * claim simply keeps outranking it. That is what makes clearing this field
 * reliable: what comes back is the computation's answer for the title the item
 * has NOW, not the one it had when the owner first corrected it.
 *
 * ONE SORT NAME AND NOT A SET, for the reason `retitleItemByHand` gives about a
 * title: `assertClaims` makes what this source holds EQUAL to what it now
 * claims, so passing one value withdraws the previous one. An item does not
 * file in two places.
 *
 * Answers `false` when that id addresses no live item, which is an answer
 * rather than a failure (ADR-0066).
 */
export async function sortItemAsByHand(
  db: Database,
  { itemId, sortName }: { itemId: string; sortName: string },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const ownerId = await theOwnerId(tx);
    if (!(await isALiveItem(tx, itemId))) return false;

    await sortedByTheOwner(tx, ownerId, itemId, sortName);
    return true;
  });
}

/**
 * The owner noting something about an item in their own words (ADR-0096), and
 * REMOVING that note by passing an empty one.
 *
 * ONE OPERATION FOR WRITING, EDITING AND REMOVING, because all three are one
 * claim: what the owner now says about this item. `assertClaims` makes what a
 * source holds equal to what it claims, so a second note replaces the first
 * without either becoming a rival value, and an empty one withdraws it.
 *
 * THE OWNER IS THE ONLY SOURCE THAT CAN REACH THIS, and the property is what
 * says so rather than this function: migration 12 declares `note` assertable by
 * a source of kind `owner`, and the database refuses any other -- so the
 * importer, the scanner and a psql session are refused alike, none of which
 * this file could speak for.
 *
 * Answers `false` when that id addresses no live item, which is an answer
 * rather than a failure (ADR-0066) -- the posture `findItem` and
 * `retitleItemByHand` both take.
 */
export async function annotateItemByHand(
  db: Database,
  { itemId, note }: { itemId: string; note: string },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const ownerId = await theOwnerId(tx);
    if (!(await isALiveItem(tx, itemId))) return false;

    await notedByTheOwner(tx, ownerId, itemId, note);
    return true;
  });
}
