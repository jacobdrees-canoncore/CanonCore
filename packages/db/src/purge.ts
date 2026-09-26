import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "./index";
import { theOwnerId } from "./placements";
import { LIVE_GROUP_MEMBERSHIP } from "./queries";
import { rolledBack } from "./rolled-back";
import {
  aliases,
  artwork,
  groupItems,
  groups,
  identifiers,
  items,
  partDisagreements,
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
   * claims them -- the owner's own placement, the owner's own words, a Group the
   * owner put it in, or another provider saying the same thing.
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
   * the eight rules restated, which is exactly what `previewProviderPurge`
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
  return rolledBack(db, (tx) => purgeWithin(tx, identity));
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
 * everything naming it has gone. A Group membership names one too, and is the
 * one row this traversal takes ON THE ITEM'S ACCOUNT rather than the source's:
 * the dead ones go in the same statement as the item they name
 * (`deleteOrphansAmong`).
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
  // ITS IDENTIFIERS GO WITH IT (CNCORE-349): an id in another space is a claim
  // this provider made, exactly as a Statement is, and the source row below
  // cannot go while one still names it.
  await tx.delete(identifiers).where(eq(identifiers.sourceId, source.id));
  // The provider's pictures go with it: bytes it supplied are its content.
  await tx.delete(artwork).where(eq(artwork.sourceId, source.id));
  // Its count of parts goes too (CNCORE-361): the `(n)` titles it was read off
  // were this provider's claim.
  await tx.delete(partDisagreements).where(eq(partDisagreements.sourceId, source.id));

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
    // about or placed anywhere, and `removedItems` is the subset the eight rules
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
 * about, nothing places anywhere, and no live Group holds.
 *
 * AN ITEM IS NOT "CONTENT FROM A PROVIDER" THE WAY A STATEMENT IS. Nothing on the
 * row names who made it, so it is not something the purge can attribute and
 * delete -- what makes it go is that after the provider's own rows are gone there
 * is no claim left on it and nowhere it sits. An item the owner still places
 * somewhere, or still has in a Group, SURVIVES, untitled, because either is the
 * owner's claim and a provider's licence ending has no bearing on it.
 *
 * AND A VALUE CANONCORE DERIVED IS NOT SUCH A CLAIM (CNCORE-173). A derived
 * source is a computation over the claims already held (ADR-0071), so its
 * output exists only as long as its inputs do -- and once the provider's rows
 * are gone there are no inputs. Counting one would keep alive exactly the item
 * this traversal exists to take: nobody's but the purged provider's, now
 * untitled and unplaced, and reachable from no surface. It is the FIRST of the
 * clauses to name a source at all, because it is the first kind of row that can
 * be about an item without anybody having claimed anything.
 *
 * THE CLAUSE IS ABOUT THE SOURCE KIND RATHER THAN ABOUT `sort_name`, so the
 * next derived computation inherits it rather than reopening this. A named
 * property here would be the strip-list ADR-0045 argues against, one table
 * along.
 *
 * WHY A GROUP MEMBERSHIP COUNTS (CNCORE-232, ADR-0036): nobody but the Owner
 * puts an Item in a Group, and `CONTEXT.md`'s Purge says an Item the Owner also
 * claims is not removed. LIVE MEANS THE GROUP TOO: a membership that outlived
 * its Group narrows nothing (CNCORE-230), so it is read through
 * `LIVE_GROUP_MEMBERSHIP`, the one spelling every Listing and the Item page
 * read (CNCORE-234). A purge cannot keep an Item for a membership no surface
 * shows, nor take one a Listing still narrows to.
 *
 * AND A DEAD ONE KEEPS NOTHING BUT STILL NAMES THE ITEM. A membership the Owner
 * took back out is a tombstone, not a DELETE (ADR-0075), so its foreign key
 * refuses the item -- and with no cascade, refuses it by taking the whole purge
 * down rather than by skipping a row. So the doomed items' dead memberships go
 * WITH them, and ONLY theirs, which keeps a kept item's tombstones where
 * `putItemInGroupByHand` comes back to them. They are not counted, because a
 * membership the Owner took out is nothing a preview could show them.
 *
 * ONE STATEMENT, CHOOSING THE DOOMED ITEMS ONCE, and review found why it has to
 * be. As two statements, each asked the predicate on its own snapshot, so an
 * Owner taking a kept item out of its Group between them made the second find
 * it orphaned while the first had left its fresh tombstone standing: 23503, the
 * very failure this exists to remove. Every sub-statement of a `WITH` runs on
 * one snapshot (PostgreSQL's "Data-Modifying Statements in WITH"), so the set
 * whose memberships go and the set of items that go are one set.
 */
async function deleteOrphansAmong(
  tx: Transaction,
  candidates: string[],
): Promise<{ id: string }[]> {
  const orphaned = and(
    inArray(items.id, candidates),
    sql`not exists (
          select 1 from ${statements}
            join ${sources} on ${sources.id} = ${statements.sourceId}
           where ${statements.subjectItemId} = ${items.id} and ${sources.kind} <> 'derived'
        )`,
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
    sql`not exists (
          select 1 from ${groupItems} join ${groups} on ${LIVE_GROUP_MEMBERSHIP}
           where ${groupItems.itemId} = ${items.id}
        )`,
  );

  const doomed = tx.$with("doomed").as(tx.select({ id: items.id }).from(items).where(orphaned));
  const theirMemberships = tx.$with("their_memberships").as(
    tx
      .delete(groupItems)
      .where(inArray(groupItems.itemId, tx.select({ id: doomed.id }).from(doomed)))
      .returning({ id: groupItems.id }),
  );
  return tx
    .with(doomed, theirMemberships)
    .delete(items)
    .where(inArray(items.id, tx.select({ id: doomed.id }).from(doomed)))
    .returning({ id: items.id });
}
