import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "./index";
import { theOwnerId } from "./placements";
import {
  aliases,
  items,
  placementSources,
  placements,
  sources,
  statementQualifiers,
  statements,
} from "./schema";

/**
 * What a purge took, so a caller can say so rather than report "done" -- and,
 * unchanged, what a preview says it WOULD take. ONE TYPE BECAUSE THERE IS ONE
 * TRAVERSAL: a preview free to answer in a shape of its own is a preview free
 * to disagree with the delete, which is worse than having none.
 */
export interface PurgedProvider {
  statements: number;
  placements: number;
  items: number;
  /**
   * The items this provider touched that STAY, because something else still
   * claims them -- the owner's own placement, the owner's own words, or another
   * provider saying the same thing.
   *
   * A COUNT OF WHAT GOES DESCRIBES HALF OF WHAT A PURGE DOES (CNCORE-69). The
   * three above are removals; this is the outcome ADR-0046 says the delete
   * performs on its own to anything somebody else claims, and an owner deciding
   * under a termination notice has to be told about it rather than discover it.
   * Without it a preview answers "1 item" about a provider that touched five and
   * sounds like the whole answer.
   *
   * IT IS `touched - items` AND NOT A SECOND TRAVERSAL, which is the same
   * guarantee the rest of this file is built on: the survivors are the ones the
   * delete DECLINED to take, so the number is read off the delete rather than
   * predicted beside it. A separate "which items would survive" query would be
   * the seven rules restated, which is exactly what `previewProviderPurge`
   * exists to avoid.
   */
  keptItems: number;
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Everything one provider ever said, removed in one operation.
 *
 * ADR-0036: TMDB's terms end in termination, and termination "requires purging
 * all cached TMDB content". That record's own claim about the cost is that
 * `source` on every row "already makes one delete", and this function is that
 * claim being true rather than a purge FEATURE being built -- there is no
 * ownership column to sweep, no tombstone to reconcile and no per-table policy,
 * because every row that can carry a claim already names who made it.
 *
 * ONE TRANSACTION. A half-purged provider is the worst of both: content still
 * rendered, under a licence the instance no longer holds, with the source row
 * that named the obligation already gone.
 */
export async function purgeProvider(
  db: Database,
  { identity }: { identity: string },
): Promise<PurgedProvider> {
  return db.transaction((tx) => purgeWithin(tx, identity));
}

/**
 * The counts, thrown rather than returned, so that the transaction which
 * produced them rolls back on the way out.
 *
 * Drizzle's `transaction` commits on a normal return and rolls back on ANY
 * throw, so throwing is how the preview declines the commit. It carries the
 * counts because they are computed and then deliberately discarded along with
 * everything else, and `rollback()` -- the other way to refuse the commit --
 * has nowhere to put them.
 */
class PreviewTaken extends Error {
  constructor(readonly counts: PurgedProvider) {
    super("A purge preview, rolled back");
    this.name = "PreviewTaken";
  }
}

/**
 * What a purge WOULD take, counted by taking it and then rolling it back.
 *
 * ADR-0046 puts counts in front of a permanent delete, and a purge is the delete
 * where that matters most: it is the one an owner runs under time pressure,
 * after a termination notice, against a provider whose content they can no
 * longer inspect because the provider is unreachable.
 *
 * THIS IS THE PURGE, NOT A DESCRIPTION OF ONE, and that is the whole point. The
 * numbers come from the same statements against the same rows in the same
 * order, so a preview cannot drift from the delete it precedes -- there is no
 * second set of predicates to keep in step. A preview that disagrees with the
 * delete is worse than no preview at all.
 *
 * WHAT IT COSTS is the work and the write locks of a real purge, held for the
 * length of the traversal and then given back -- so two previews of one provider
 * queue behind each other, as does an import from it. That is the price of the
 * guarantee, and an acceptable one here: this is a single-owner catalogue and
 * the alternative is a second implementation free to be wrong.
 *
 * AND ONE THING THE ROLLBACK DOES NOT GIVE BACK: `change_sequence` values.
 * Deleting a statement fires `statements_reproject_item`, which UPDATEs the item
 * and so takes a `nextval` through `touch_row` (migration 1) -- and a PostgreSQL
 * sequence is outside the transaction, so a preview leaves GAPS in the sequence
 * that the rollback keeps. Measured rather than reasoned: 29 to 30 across a
 * rolled-back update. Harmless, because ADR-0040 needs the sequence's ORDER and
 * not its density, and any rolled-back write already leaves gaps -- but it is
 * why "changes nothing" is a claim about ROWS and is written here as one.
 */
export async function previewProviderPurge(
  db: Database,
  { identity }: { identity: string },
): Promise<PurgedProvider> {
  try {
    return await db.transaction(async (tx) => {
      throw new PreviewTaken(await purgeWithin(tx, identity));
    });
  } catch (error) {
    if (error instanceof PreviewTaken) return error.counts;
    throw error;
  }
}

/**
 * The traversal both of them run, inside a transaction it does not own: the
 * delete commits it, the preview rolls it back.
 *
 * THE ORDER IS FORCED BY THE FOREIGN KEYS and worth reading once. Statements and
 * placement sources point AT the source row, so they go first or the source
 * cannot be deleted. Placements go next, but only the ones nothing is left
 * asserting. Items go last, because a statement's `value_item_id` and a
 * placement's two ends all point at items, so an item is only deletable once
 * everything naming it has gone.
 */
async function purgeWithin(tx: Transaction, identity: string): Promise<PurgedProvider> {
  const ownerId = await theOwnerId(tx);
  const [source] = await tx
    .select({ id: sources.id })
    .from(sources)
    .where(
      and(
        eq(sources.ownerId, ownerId),
        eq(sources.kind, "provider"),
        eq(sources.identity, identity),
      ),
    );
  // A provider this catalogue never imported from is nothing to do rather than
  // an error: purging is an operation an owner may reasonably run twice, and the
  // second run must not read as a failure.
  if (!source) return { statements: 0, placements: 0, items: 0, keptItems: 0 };

  // WHICH ITEMS THIS PROVIDER EVER TOUCHED, read BEFORE anything is deleted --
  // afterwards there is nothing left pointing at them, which is the whole
  // problem. Scoped to these, so a purge never reaps an empty item that some
  // other part of the catalogue left lying around; this operation answers for
  // one provider and must not quietly tidy up after anything else.
  const touched = await itemsTouchedBy(tx, source.id);

  // WHICH PLACEMENTS THIS PROVIDER SPOKE FOR, read before its claims are
  // deleted -- afterwards there is no way to tell which source-less placements
  // this purge orphaned from which were already that way.
  const spokeFor = await tx
    .select({ id: placementSources.placementId })
    .from(placementSources)
    .where(eq(placementSources.sourceId, source.id));

  const removedStatements = await tx
    .delete(statements)
    .where(eq(statements.sourceId, source.id))
    .returning({ id: statements.id });

  await tx.delete(placementSources).where(eq(placementSources.sourceId, source.id));

  // A PLACEMENT IS A CLAIM AND MAY HAVE SEVERAL CLAIMANTS (ADR-0017): sources
  // agreeing about where an item sits are recorded against ONE row. So a
  // placement survives this if anybody else still asserts it, and goes only when
  // the purged provider was the last one saying so.
  //
  // SCOPED TO THE PLACEMENTS THIS PROVIDER SPOKE FOR, and that `inArray` is
  // load-bearing rather than an optimisation. Without it the condition reads
  // "every placement nobody asserts", which is a sentence about the whole
  // catalogue: a placement that was already source-less before this purge began
  // -- somebody else's orphan, or a row a later slice leaves that way -- would be
  // swept up by whichever provider happened to be purged next, and the count
  // reported back would be of rows this provider never touched. Found by the
  // suite: the api tests share one database and the count came back 4 for a
  // purge of 2.
  const orphanedByThis = spokeFor.map((row) => row.id);
  const removedPlacements =
    orphanedByThis.length === 0
      ? []
      : await tx
          .delete(placements)
          .where(
            and(
              inArray(placements.id, orphanedByThis),
              sql`not exists (select 1 from ${placementSources} where ${placementSources.placementId} = ${placements.id})`,
            ),
          )
          .returning({ id: placements.id });

  // IN CHUNKS, because `inArray` becomes one bind parameter per id and
  // PostgreSQL refuses a statement with more than 65,535 of them. A purge of the
  // archive's twelve thousand stories is an ordinary size for this operation,
  // not an exotic one, and the failure would arrive as a protocol error at the
  // moment an owner most needs the delete to work.
  const removedItems: { id: string }[] = [];
  for (let at = 0; at < touched.length; at += ID_CHUNK) {
    removedItems.push(...(await deleteOrphansAmong(tx, touched.slice(at, at + ID_CHUNK))));
  }

  // LAST, and only now reachable: everything that pointed at it has gone. The
  // row goes rather than being emptied, because the next import must mint a
  // fresh one -- a reused row carries the attribution of a licence this instance
  // is no longer operating under.
  await tx.delete(sources).where(eq(sources.id, source.id));

  return {
    statements: removedStatements.length,
    placements: removedPlacements.length,
    items: removedItems.length,
    // WHAT THE DELETE DECLINED TO TAKE, read off the delete rather than asked
    // for separately. `touched` is every item this provider asserted anything
    // about or placed anywhere, and `removedItems` is the subset the seven rules
    // above let go -- so the difference is the survivors, and it cannot disagree
    // with the delete because it is computed FROM it.
    keptItems: touched.length - removedItems.length,
  };
}

/**
 * How many ids go into one `in (...)`.
 *
 * PostgreSQL's wire protocol caps a statement at 65,535 bind parameters and
 * `inArray` spends one per id, so the ceiling is real rather than theoretical.
 * 1,000 is comfortably under it with room for the rest of the statement, and
 * small enough that the planner keeps using the index.
 */
const ID_CHUNK = 1_000;

/** Every item this source asserted anything about, or placed anywhere. */
async function itemsTouchedBy(tx: Transaction, sourceId: string): Promise<string[]> {
  const rows = await tx.execute<{ id: string }>(sql`
    select ${statements.subjectItemId} as id from ${statements}
      where ${statements.sourceId} = ${sourceId} and ${statements.subjectItemId} is not null
    union
    select ${placements.itemId} as id from ${placements}
      join ${placementSources} on ${placementSources.placementId} = ${placements.id}
      where ${placementSources.sourceId} = ${sourceId}
    union
    select ${placements.containerId} as id from ${placements}
      join ${placementSources} on ${placementSources.placementId} = ${placements.id}
      where ${placementSources.sourceId} = ${sourceId}
  `);
  return rows.rows.map((row) => row.id);
}

/**
 * Of the items this provider touched, the ones nothing is left saying anything
 * about and nothing places anywhere.
 *
 * AN ITEM IS NOT "CONTENT FROM A PROVIDER" THE WAY A STATEMENT IS. Nothing on the
 * row names who made it, so it is not something the purge can attribute and
 * delete -- what makes it go is that after the provider's own rows are gone there
 * is no claim left on it and nowhere it sits. An item the owner still places
 * somewhere SURVIVES, untitled, because the owner's placement is the owner's
 * claim and a provider's licence ending has no bearing on it.
 */
async function deleteOrphansAmong(
  tx: Transaction,
  candidates: string[],
): Promise<{ id: string }[]> {
  return tx
    .delete(items)
    .where(
      and(
        inArray(items.id, candidates),
        sql`not exists (select 1 from ${statements} where ${statements.subjectItemId} = ${items.id})`,
        // Not the VALUE of somebody else's claim either. `value_item_id` carries
        // no cascade, so an item still standing as another item's `based_on` would
        // refuse the delete rather than be quietly skipped.
        sql`not exists (select 1 from ${statements} where ${statements.valueItemId} = ${items.id})`,
        sql`not exists (select 1 from ${placements} where ${placements.itemId} = ${items.id})`,
        sql`not exists (select 1 from ${placements} where ${placements.containerId} = ${items.id})`,
        // THE TWO THAT ARE UNREACHABLE TODAY AND ARE HERE ANYWAY. Nothing in
        // version one writes a qualifier or a merge alias, so neither of these can
        // hold a row yet -- but both are foreign keys to `items.id` with no cascade
        // (migration 1), so the day one is written the omission stops being
        // theoretical and takes the WHOLE TRANSACTION down rather than skipping a
        // row. The docblock above claims "an item is only deletable once everything
        // naming it has gone"; four clauses did not make that claim true. Found in
        // review by enumerating the foreign keys rather than by a failing test,
        // which is the only way this one could have been found.
        sql`not exists (select 1 from ${statementQualifiers} where ${statementQualifiers.valueItemId} = ${items.id})`,
        sql`not exists (select 1 from ${aliases} where ${aliases.itemId} = ${items.id})`,
      ),
    )
    .returning({ id: items.id });
}
