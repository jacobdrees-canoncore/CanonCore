import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";

import { assertClaims, propertyId, type Transaction } from "./claims";
import type { Database } from "./index";
import { assertPlacement, theOwnerId } from "./placements";
import { identifiers, items, placementSources, placements, sources, statements } from "./schema";

/** The provider that asserted this, as the owner configured it (ADR-0031). */
export interface ImportingProvider {
  /** The base URL. A provider IS a URL, so that is what identifies it. */
  identity: string;
  /** What the provider calls itself, from its own manifest. */
  label: string;
  /**
   * What this source's licence obliges the app to show, as the provider declared
   * it, or `null` where the source obliges nothing (ADR-0033, ADR-0036).
   *
   * REQUIRED ON THIS INTERFACE, AND `null` IS HOW A CALLER SAYS "NOTHING". It was
   * optional, and review found what that cost: the source row is rewritten on
   * every import so a licence revision cannot go stale, which means a caller who
   * simply omitted the field would NULL a stored notice while the provider's
   * content stayed -- the notice and the content it covers coming apart, which is
   * exactly the split migration 4's own comment says must not happen. Making it
   * required moves that from a rule somebody remembers to a typecheck: an import
   * cannot be written without answering what the provider declared.
   */
  attribution: {
    notice: string;
    logo?: { data_uri: string; alt: string } | null;
  } | null;
}

/**
 * One record from a provider, in the terms the catalogue writes.
 *
 * Deliberately NOT the CMPP shape. `@canoncore/db` knows nothing about HTTP and
 * nothing about a provider's wire format; the caller does the translation, and
 * that is what keeps a change to the protocol out of the catalogue.
 */
export interface ProvidedRecord {
  /** The provider's own id for this record, the one `lookup` takes. */
  externalId: string;
  title: string;
  /** EDTF strings, each at the precision it arrived with (ADR-0073). */
  released: string[];
  /**
   * The record's ids in OTHER id spaces, keyed by Scheme -- `{ imdb: "tt0133093" }`
   * (CNCORE-349). Empty for a source with one id space, which is the wiki's
   * every record. Written as Identifiers, never as Statements: see `identifiers`.
   */
  identifiers: Record<string, string>;
  /**
   * Which of ADR-0005's seven kinds the Item is written under (CNCORE-367). The
   * provider's finer word is not this: it maps its own vocabulary onto the
   * seven, and `items.kind`'s foreign key refuses anything else.
   */
  itemKind: string;
}

export interface ImportedRecord {
  itemId: string;
  /**
   * How many of this record's values were QUARANTINED rather than written as
   * readable claims (CNCORE-29, migration 6).
   *
   * REPORTED BECAUSE THE MARK ALONE IS SILENT. The rows are in the catalogue
   * carrying the provider that said them, so "which ones" is a question the
   * store answers; what no later query can recover is that THIS import was
   * where they arrived. `0` is the ordinary answer and says so.
   *
   * NAMED FOR WHAT IT COUNTS, because `statements.quarantined` is a BOOLEAN one
   * word away. A number and a flag sharing a name through one call path is how
   * a caller writes `if (result.quarantined)` and means something else entirely.
   */
  quarantinedValues: number;
}

/**
 * Writes one provider record into the catalogue, with the provider recorded as
 * the source of everything it asserted.
 *
 * EVERY VALUE CARRIES ITS SOURCE, which is the whole reason this goes through
 * statements rather than through columns. A title written straight to
 * `items.title` is a value nobody said, and `items.title` is a PROJECTION of
 * whichever title statement wins (ADR-0014) -- so the column fills itself here,
 * from the trigger, exactly as it does for the owner's own hand.
 *
 * ONE TRANSACTION. A half-imported item is a row with no title statement, which
 * renders as "Untitled item" forever and reads like something the owner made.
 *
 * WHAT IS DELIBERATELY NOT IMPORTED, and why each is somewhere else:
 *
 * - `writers` would be `created_by`, which takes an ITEM and therefore a person
 *   item per writer. Deciding that "Kit Pedler" here is the same Kit Pedler
 *   already in the catalogue is MATCHING, and ADR-0026 makes matching its own
 *   operation with its own endpoint. Importing them naively mints a fresh person
 *   on every import, which is worse than not having them.
 * - `series` would be a container and a placement, which is what `browse`
 *   returns (ADR-0033) and what CNCORE-7 builds.
 * - `kind` -- the provider's `TV story` -- is finer than the seven item kinds,
 *   and ADR-0005 puts anything finer in a `category` statement. That takes an
 *   item too, so it lands on the same matching question as the writers.
 *
 * AND IT IS FOUND OR CREATED, NEVER BLINDLY INSERTED (CNCORE-28). The record's
 * `externalId` is written as a statement of its own (migration 3), so a second
 * import of one record from one provider finds the item the first wrote and
 * REFRESHES it. It used to write a second item instead, because nothing in the
 * catalogue held an external identifier and only a migration may add a property
 * (ADR-0029).
 *
 * FINDING IT AGAIN IS IDENTITY, NOT MATCHING, and the two are separable for the
 * reason ADR-0026 gives: "this provider's record 265 is the item we already made
 * from this provider's record 265" is one party, one namespace and no judgement,
 * where deciding that two DIFFERENT providers' records describe one work needs a
 * score, a threshold and a review queue. None of that is built, and none of it
 * is needed here.
 */
export async function importProvidedRecord(
  db: Database,
  { provider, record }: { provider: ImportingProvider; record: ProvidedRecord },
): Promise<ImportedRecord> {
  return db.transaction(async (tx) => {
    const ownerId = await theOwnerId(tx);
    const sourceId = await providerSource(tx, ownerId, provider);

    // Not a container: what it belongs to is a placement, and nothing here
    // holds members. Its kind is the record's (ADR-0005, CNCORE-367).
    return writeProvidedItem(tx, { ownerId, sourceId, record });
  });
}

/**
 * A container and its ordering, as one `browse` answered them, in the terms the
 * catalogue writes.
 *
 * Deliberately NOT the CMPP shape, for the same reason `ProvidedRecord` is not:
 * this package knows nothing about HTTP or a wire format, and the caller does
 * the translation.
 */
export interface ProvidedContainer {
  /** The container itself, as a record. A container is an item like any other. */
  container: ProvidedRecord;
  ordering: { position: number; record: ProvidedRecord }[];
  /**
   * Members the provider serves that this ordering cannot place. They are
   * members WITH NO POSITION rather than non-members, so they are placed and
   * their position is left unasserted.
   */
  unplaced: ProvidedRecord[];
}

export interface ImportedContainer {
  containerId: string;
  /** Every placement written, container-side, in the order it arrived. */
  placements: { itemId: string; placementId: string }[];
  /**
   * How many values across the WHOLE browse were quarantined -- the container's
   * own and every placed item's, since a container is a record like any other
   * (ADR-0004) and its claims go through the same door.
   *
   * THIS IS THE NUMBER THE BULK PATH EXISTS TO MAKE VISIBLE. One call writes a
   * container's worth of dates, so a bad source fills the catalogue rather than
   * a row of it -- and an import that answered identically whether it had held
   * back nothing or forty would leave the owner no way to tell.
   */
  quarantinedValues: number;
}

/**
 * Writes a container AND its ordering, with the provider recorded as having
 * asserted every placement.
 *
 * THIS IS WHAT `browse` IS FOR (ADR-0033): the container and the ordering
 * arrive together, so sixty episodes are placed by one call rather than by
 * hand. For a source with no public API it is the only viable bulk path.
 *
 * AND EVERY PLACEMENT CARRIES THE PROVIDER, because an ordering is a DATED
 * CLAIM BY A NAMED SOURCE rather than a neutral fact (ADR-0017). A placement
 * written without one is a claim nobody made, and no later slice can
 * reconstruct who made it.
 *
 * ONE TRANSACTION, for the reason `importProvidedRecord` gives and one more: a
 * half-imported container is an ordering with a hole in it, and a hole in an
 * ordering is indistinguishable from a source that never held that member.
 *
 * HOW MUCH ONE CALL MAY WRITE IS BOUNDED BY THE CLIENT'S BODY CAP AND BY
 * NOTHING HERE. `MAX_BODY_BYTES` in `@canoncore/providers` is 4 MiB, so an
 * ordering is bounded at whatever fits in that -- some thousands of records --
 * and this loop writes them in ONE transaction. No row cap is imposed, because
 * there is no number to impose that anybody has chosen or measured, and a byte
 * cap already bounds the work. Named rather than left implicit: an allowlisted
 * provider that is buggy is the case this note is for, and the answer today is
 * "the transaction is large and it completes".
 *
 * WHAT IS DELIBERATELY NOT IMPORTED is what `importProvidedRecord` lists --
 * writers and the provider's own finer `kind` -- and for the same reasons.
 *
 * AND EVERY MEMBER IS FOUND OR CREATED, which bites harder here than it does on
 * one record (CNCORE-28). This is the BULK path, so before the external id was
 * held a second browse of one container wrote a second container and a second
 * copy of every member, with their own placements, silently: the catalogue
 * doubled on the second click of one button. Now the container and all sixty
 * members are found by the ids the provider knows them by, and a second browse
 * adds nothing.
 */
export async function importBrowsedContainer(
  db: Database,
  { provider, browsed }: { provider: ImportingProvider; browsed: ProvidedContainer },
): Promise<ImportedContainer> {
  return db.transaction(async (tx) => {
    const ownerId = await theOwnerId(tx);
    const sourceId = await providerSource(tx, ownerId, provider);

    const written = await writeProvidedItem(tx, {
      ownerId,
      sourceId,
      record: browsed.container,
      container: true,
    });
    const containerId = written.itemId;
    // The container's own claims go through the same door as a placed item's,
    // so what it held back is part of the same answer.
    let quarantinedValues = written.quarantinedValues;

    /**
     * ADR-0009 allows the same item twice in one container, at two positions,
     * for recaps and bookends -- CONTEXT.md calls it a REPEAT -- and a bulk
     * import that minted a fresh item per entry could not express one. The
     * failure would look like success: two items, each placed once, sharing a
     * title.
     *
     * NOTHING HERE HANDLES THAT ANY MORE, and the absence is the point. This
     * used to carry a Map of what the CALL had written, because finding what an
     * EARLIER call wrote needed an external id nothing held. `writeProvidedItem`
     * now finds an item by (source, external id) whoever wrote it and whenever
     * -- inside this transaction included -- so a repeat and a re-browse are one
     * question with one answer, rather than two mechanisms that could disagree.
     */
    const item = async (record: ProvidedRecord) => {
      const writtenItem = await writeProvidedItem(tx, { ownerId, sourceId, record });
      quarantinedValues += writtenItem.quarantinedValues;
      return writtenItem.itemId;
    };

    const writtenPlacements: { itemId: string; placementId: string }[] = [];
    for (const { position, record } of browsed.ordering) {
      const itemId = await item(record);
      const placementId = await assertPlacement(tx, {
        containerId,
        itemId,
        position,
        sourceId,
      });
      writtenPlacements.push({ itemId, placementId });
    }

    // AND THE ONES THE ORDERING CANNOT POSITION, which are placements all the same.
    // They go through the very same write, with no position: what makes them
    // different is the absence of a claim about where they sit, and nothing
    // else. Dropping them would shrink the container silently.
    for (const record of browsed.unplaced) {
      const itemId = await item(record);
      const placementId = await assertPlacement(tx, {
        containerId,
        itemId,
        position: null,
        sourceId,
      });
      writtenPlacements.push({ itemId, placementId });
    }

    await withdrawPlacementsNotAsserted(tx, {
      ownerId,
      containerId,
      sourceId,
      asserted: writtenPlacements.map((placement) => placement.placementId),
    });

    return { containerId, placements: writtenPlacements, quarantinedValues };
  });
}

/**
 * Takes this source off every placement in the container it no longer asserts.
 *
 * A BROWSE HANDS OVER A WHOLE ORDERING, which is the only reason this can be
 * done here and not in `assertPlacement`: one placement at a time cannot tell a
 * source adding a member from a source that has stopped claiming the rest.
 * `browse` answers with the container's ordering ENTIRE (ADR-0033), so what it
 * leaves out, it no longer says.
 *
 * IT IS `assertClaims` ONE LAYER DOWN, and it is here for the same reason.
 * Finding the container again is what made it reachable: a second browse used to
 * write a whole new container, so no ordering was ever met twice. Now a provider
 * that has MOVED a member would stand behind two positions for it at once --
 * `assertPlacement` matches on position, so a new position is a new placement --
 * and nothing at read time can resolve that, because `findPlacementsOfItem`
 * ranks by rank then the global source order and one source ties with itself.
 * Both rows answer, and the page shows a REPEAT (ADR-0009) the provider never
 * asserted, indistinguishable from a recap it meant.
 *
 * A MEMBER THE PROVIDER HAS DROPPED goes the same way, and that is the same
 * fact rather than a second feature: an ordering that no longer holds a story
 * has stopped claiming it, exactly as one that moved it has stopped claiming
 * where it was.
 *
 * IT WITHDRAWS THE CLAIM, NOT THE PLACEMENT -- until nothing is left standing
 * behind it. Another source that still asserts the same placement keeps it, and
 * ADR-0017's whole design is that a placement carries many sources; this source
 * may only take back what it said itself. A placement whose LAST source has
 * withdrawn is a claim nobody makes, so it is tombstoned too (ADR-0075) rather
 * than left for `findPlacementsOfItem` to render with no origin at all.
 */
async function withdrawPlacementsNotAsserted(
  tx: Transaction,
  {
    ownerId,
    containerId,
    sourceId,
    asserted,
  }: { ownerId: string; containerId: string; sourceId: string; asserted: string[] },
): Promise<void> {
  const withdrawn = await tx
    .select({ id: placementSources.id, placementId: placementSources.placementId })
    .from(placementSources)
    .innerJoin(placements, eq(placements.id, placementSources.placementId))
    .where(
      and(
        eq(placementSources.ownerId, ownerId),
        eq(placementSources.sourceId, sourceId),
        eq(placements.containerId, containerId),
        isNull(placementSources.deletedAt),
        isNull(placements.deletedAt),
        // An empty ordering asserts nothing, so everything this source held is
        // withdrawn -- and `notInArray` with no values is not the way to say it.
        asserted.length > 0 ? notInArray(placementSources.placementId, asserted) : undefined,
      ),
    );
  if (withdrawn.length === 0) return;

  await tx
    .update(placementSources)
    .set({ deletedAt: sql`now()` })
    .where(
      inArray(
        placementSources.id,
        withdrawn.map((claim) => claim.id),
      ),
    );

  const orphaned = withdrawn.map((claim) => claim.placementId);
  await tx
    .update(placements)
    .set({ deletedAt: sql`now()` })
    .where(
      and(
        inArray(placements.id, orphaned),
        isNull(placements.deletedAt),
        sql`not exists (
          select 1 from ${placementSources}
          where ${placementSources.placementId} = ${placements.id}
            and ${placementSources.deletedAt} is null
        )`,
      ),
    );
}

/**
 * The provider's record as an item, with every value it claimed written as a
 * statement carrying the provider as its source.
 *
 * SHARED BY BOTH IMPORTS -- one record by `lookup`, and every member of a
 * container by `browse`. Written once because a member imported in bulk is the
 * same fact as one imported alone, and two copies of this would be two answers
 * to "what does an imported story look like".
 *
 * FOUND OR CREATED, NEVER BLINDLY INSERTED, by the id the provider knows the
 * record by (ADR-0078, migration 3) -- which is the one place that rule needs to
 * live, for the same reason this function is shared at all.
 */
async function writeProvidedItem(
  tx: Transaction,
  {
    ownerId,
    sourceId,
    record,
    container = false,
  }: { ownerId: string; sourceId: string; record: ProvidedRecord; container?: boolean },
): Promise<ImportedRecord> {
  const found = await itemWithExternalId(tx, { ownerId, sourceId, externalId: record.externalId });

  // A `browse` naming an id an earlier `lookup` wrote as a plain work: it is a
  // container after all, and `CONTEXT.md`'s Container headword makes that
  // STORED rather than inferred
  // from having members -- so an item left holding members with the flag off is
  // a container to every write path and a plain work to every read, offered by
  // work-browsing as something to watch (ADR-0077).
  //
  // IT ONLY EVER TURNS THEM ON. A `lookup` answers a record and says nothing
  // about members, so it is never evidence that a container has stopped being
  // one.
  if (found !== undefined && container) {
    await tx.update(items).set({ isContainer: true, isOrdered: true }).where(eq(items.id, found));
  }

  const itemId =
    found ?? (await insertProvidedItem(tx, { ownerId, container, kind: record.itemKind }));

  const quarantinedValues = await assertClaims(tx, {
    ownerId,
    itemId,
    sourceId,
    claims: [
      // ADR-0078: the mapping that finds this item again, beside the surrogate
      // id rather than instead of it (migration 3).
      { property: "external_id", values: [record.externalId] },
      { property: "title", values: [record.title] },
      // One statement per date, each keeping the precision it arrived with. The
      // catalogue decides the earliest known release for itself (ADR-0081), so
      // picking one here would be answering a question that is not ours.
      //
      // AND EACH IS CHECKED (CNCORE-29). ADR-0073 says a date is an EDTF string,
      // and the wire schema is `z.array(z.string())` -- so without a check the
      // record described what the catalogue writes rather than what it accepts.
      // A value that fails is kept and QUARANTINED rather than dropped or
      // refused, which is ADR-0030's posture for a value that arrives broken.
      //
      // NOTHING IS NAMED HERE ANY MORE (CNCORE-47). The check used to be an
      // `admits` callback written beside this value; it is now `released`'s own
      // `validation` declaration (ADR-0012, migration 7), which `assertClaims`
      // reads. So this list says what the provider CLAIMS and the catalogue says
      // what may be read back -- and which properties are checked is a query
      // rather than a grep.
      { property: "released", values: record.released },
    ],
  });

  await assertIdentifiers(tx, { ownerId, itemId, sourceId, identifiers: record.identifiers });

  return { itemId, quarantinedValues };
}

/**
 * This source's Identifiers for one item, brought up to date with what it sent
 * this time (CNCORE-349).
 *
 * SCHEME BY SCHEME, AND A SCHEME LEFT OUT IS NOT WITHDRAWN. A value sent for a
 * scheme replaces this source's value for it, by tombstone, and a new scheme is
 * written. A scheme absent from this answer is left standing, because a
 * provider's answers are not equally full: `provider-tmdb` sends `imdb` on a
 * lookup and only `tmdb` on a browse of the collection a film sits in, and a
 * refresh reading the browse as the full set withdrew the IMDb id the lookup
 * had just written. CI found that against the real image. A scheme a provider
 * truly stops sending therefore stays until that provider is purged.
 *
 * Unlike `assertClaims`, where every answer carries the same properties in
 * full. It reaches only THIS source's rows, since a source may only withdraw
 * what it said itself, and what is unchanged is not rewritten.
 */
async function assertIdentifiers(
  tx: Transaction,
  {
    ownerId,
    itemId,
    sourceId,
    identifiers: sent,
  }: { ownerId: string; itemId: string; sourceId: string; identifiers: Record<string, string> },
): Promise<void> {
  const held = await tx
    .select({ id: identifiers.id, scheme: identifiers.scheme, value: identifiers.value })
    .from(identifiers)
    .where(
      and(
        eq(identifiers.itemId, itemId),
        eq(identifiers.sourceId, sourceId),
        isNull(identifiers.deletedAt),
      ),
    );

  const withdrawn = held
    .filter(({ scheme, value }) => Object.hasOwn(sent, scheme) && sent[scheme] !== value)
    .map(({ id }) => id);
  if (withdrawn.length > 0) {
    await tx
      .update(identifiers)
      .set({ deletedAt: sql`now()` })
      .where(inArray(identifiers.id, withdrawn));
  }

  const fresh = Object.entries(sent).filter(
    ([scheme, value]) => !held.some((row) => row.scheme === scheme && row.value === value),
  );
  if (fresh.length > 0) {
    await tx
      .insert(identifiers)
      .values(fresh.map(([scheme, value]) => ({ ownerId, itemId, sourceId, scheme, value })));
  }
}

async function insertProvidedItem(
  tx: Transaction,
  { ownerId, container, kind }: { ownerId: string; container: boolean; kind: string },
): Promise<string> {
  const [item] = await tx
    .insert(items)
    // THE KIND IS THE PROVIDER'S ANSWER, NOT THIS LINE'S (CNCORE-367). It was
    // `work` for every import, which is why 8,052 Items were all Works. It is
    // written at creation only: an Item found again keeps the kind it has,
    // because migration 11 freezes a kind at creation. A
    // container arrives as `work` because a provider sends none for one, and
    // ADR-0004 folds containers into `work` -- there is no collection kind.
    // `CONTEXT.md`'s Container headword makes `is_container` STORED rather
    // than inferred from having members, and `browse` returns an ORDERING, so
    // a container written from one is ordered.
    .values({ ownerId, kind, isContainer: container, isOrdered: container })
    .returning({ id: items.id });
  if (!item) throw new Error("insert returned no item");
  return item.id;
}

/**
 * The item this provider's own id already names, if it names one.
 *
 * (SOURCE, EXTERNAL ID) IS THE PAIR, never the external id alone. A provider's
 * id is unique in ITS OWN namespace and nowhere else, so two providers both
 * calling something `265` are two records about two items until something
 * decides otherwise -- and deciding that is matching, which is ADR-0026's
 * operation and is not built.
 *
 * IT HONOURS THE TOMBSTONE (ADR-0075), joining `items` for no other reason. An
 * item the owner deleted is gone to every reader, so a re-import must not write
 * into the grave and report success while the owner sees nothing arrive; it
 * writes a fresh item instead.
 *
 * THE DATABASE IS WHAT HOLDS ONE PROVIDER'S ID TO ONE ITEM, not this function
 * (CNCORE-31). A find-or-create is not mutual exclusion -- the transaction
 * around it gives atomicity, and `db.transaction` sets no isolation level, so at
 * READ COMMITTED two callers that both find nothing here would both insert.
 * `statements_one_item_per_external_id` (migration 5) refuses the second,
 * whoever is writing and whatever path they came by.
 *
 * AND A SECOND THING ALREADY PREVENTED IT, BY ACCIDENT (measured under
 * CNCORE-31, not reasoned). `providerSource` REWRITES the source row on every
 * import so a revised licence cannot go stale, and two imports from one provider
 * update ONE row -- so the second waits on the first's transaction before it
 * reaches this find, and then FINDS the item rather than writing a second. It is a
 * lock nobody meant to take, one plausible optimisation away from going
 * ("only write the attribution when it changed"), and it would go silently.
 * That is the argument for the index rather than against it.
 */
async function itemWithExternalId(
  tx: Transaction,
  { ownerId, sourceId, externalId }: { ownerId: string; sourceId: string; externalId: string },
): Promise<string | undefined> {
  const [found] = await tx
    .select({ id: items.id })
    .from(statements)
    .innerJoin(items, eq(items.id, statements.subjectItemId))
    .where(
      and(
        eq(statements.ownerId, ownerId),
        eq(statements.propertyId, await propertyId(tx, ownerId, "external_id")),
        // THE HASH FIRST, THEN THE VALUE, and both are load-bearing. The index
        // is on `md5(value_literal)` because a btree tuple is capped at 2704
        // bytes and `value_literal` is unbounded (see `tables.ts`), so this
        // clause is what reaches it -- and the comparison below is what makes a
        // collision harmless rather than a wrong answer.
        sql`md5(${statements.valueLiteral}) = md5(${externalId})`,
        eq(statements.valueLiteral, externalId),
        eq(statements.sourceId, sourceId),
        isNull(statements.deletedAt),
        isNull(items.deletedAt),
      ),
    );
  return found?.id;
}

/**
 * The provider's source row, made on its first import and reused after.
 *
 * ADR-0025: ONE global source order for the whole instance, and the owner sits
 * first in it (migration 1). A provider arriving later takes the next place --
 * `max + 1` -- rather than competing for one, because `sources_order` is unique
 * per owner and two providers claiming the same place is a refused write.
 */
async function providerSource(
  tx: Transaction,
  ownerId: string,
  provider: ImportingProvider,
): Promise<string> {
  // The attribution as this import found it. Written on every import rather than
  // only on the first, because A LICENCE CHANGES: the source row is made once and
  // reused forever, so a notice captured at first import and never revisited goes
  // stale the day the source revises its terms -- and showing last year's notice is
  // the same breach as showing none.
  const attribution = {
    attributionNotice: provider.attribution?.notice ?? null,
    attributionLogo: provider.attribution?.logo?.data_uri ?? null,
    attributionLogoAlt: provider.attribution?.logo?.alt ?? null,
  };

  const [existing] = await tx
    .select({ id: sources.id })
    .from(sources)
    .where(
      and(
        eq(sources.ownerId, ownerId),
        eq(sources.kind, "provider"),
        eq(sources.identity, provider.identity),
      ),
    );
  if (existing) {
    await tx.update(sources).set(attribution).where(eq(sources.id, existing.id));
    return existing.id;
  }

  const [written] = await tx
    .insert(sources)
    .values({
      ownerId,
      kind: "provider",
      identity: provider.identity,
      label: provider.label,
      sourceOrder: sql`(select coalesce(max("source_order"), 0) + 1 from "sources" where "owner_id" = ${ownerId})`,
      ...attribution,
    })
    .returning({ id: sources.id });
  if (!written) throw new Error("insert returned no source");
  return written.id;
}
