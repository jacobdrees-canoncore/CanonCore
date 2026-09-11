import { and, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";

import type { Database } from "./index";
import { assertPlacement, theOwnerId } from "./placements";
import { items, placementSources, placements, properties, sources, statements } from "./schema";
import { declaredCheck } from "./validation";

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

    // ADR-0005: a story is a `work`. Not a container: what it belongs to is a
    // placement, and nothing here holds members.
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
  /** Every member written, container-side, in the order it arrived. */
  members: { itemId: string; placementId: string }[];
  /**
   * How many values across the WHOLE browse were quarantined -- the container's
   * own and every member's, since a container is a record like any other
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
    // The container's own claims go through the same door as a member's, so
    // what it held back is part of the same answer.
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
      const member = await writeProvidedItem(tx, { ownerId, sourceId, record });
      quarantinedValues += member.quarantinedValues;
      return member.itemId;
    };

    const members: { itemId: string; placementId: string }[] = [];
    for (const { position, record } of browsed.ordering) {
      const itemId = await item(record);
      const placementId = await assertPlacement(tx, {
        containerId,
        itemId,
        position,
        sourceId,
      });
      members.push({ itemId, placementId });
    }

    // AND THE ONES THE ORDERING CANNOT PLACE, which are members all the same.
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
      members.push({ itemId, placementId });
    }

    await withdrawPlacementsNotAsserted(tx, {
      ownerId,
      containerId,
      sourceId,
      asserted: members.map((member) => member.placementId),
    });

    return { containerId, members, quarantinedValues };
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
  // container after all, and ADR-0009 makes that STORED rather than inferred
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

  const itemId = found ?? (await insertProvidedItem(tx, { ownerId, container }));

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

  return { itemId, quarantinedValues };
}

async function insertProvidedItem(
  tx: Transaction,
  { ownerId, container }: { ownerId: string; container: boolean },
): Promise<string> {
  const [item] = await tx
    .insert(items)
    // ADR-0004: a container folds into `work` too -- there is no collection
    // kind. ADR-0009 makes `is_container` STORED rather than inferred from
    // having members, and `browse` returns an ORDERING, so a container written
    // from one is ordered.
    .values({ ownerId, kind: "work", isContainer: container, isOrdered: container })
    .returning({ id: items.id });
  if (!item) throw new Error("insert returned no item");
  return item.id;
}

/**
 * A property as the catalogue declares it: the row's id, and what it says may be
 * read back as a value (ADR-0012).
 */
interface PropertyDeclaration {
  id: string;
  /** `{}` on every property that declares no check, which is most of them. */
  validation: unknown;
}

/** One property, and every value this provider claims for it right now. */
interface Claim {
  /** One of migration 1's or migration 3's seeded properties, by name. */
  property: string;
  values: string[];
}

/**
 * Makes what this source holds about this item EQUAL to what it now claims.
 *
 * A SET PER PROPERTY, because that is what a source actually asserts: `released`
 * is multiple and a story genuinely has two release dates (ADR-0057 keeps a row
 * for it), so "the provider's claim" is the whole set rather than one value.
 *
 * UNCHANGED VALUES ARE LEFT ALONE, which is the difference between refreshing
 * and re-importing. Re-asserting a title as a second row would make one source
 * corroborate itself, and ADR-0017 already settles that shape for placements:
 * agreement is recorded against ONE row, not counted as two claims.
 *
 * AND A VALUE THE PROVIDER NO LONGER CLAIMS IS TOMBSTONED (ADR-0075) rather
 * than left standing. Two live titles from one mouth are not a disagreement
 * anything can resolve -- `winning_literal` orders by rank, then the global
 * source order, then the statement id, so one source competing with itself ties
 * on the first two terms and falls through to a random uuid, and the projected
 * title flips on nothing. The tombstone is what both readers already honour:
 * `winning_literal` and `findStatementsOfItem` each require `deleted_at IS
 * NULL`, so a withdrawn claim leaves the page and the projection together.
 *
 * IT REACHES ONLY THIS SOURCE'S OWN CLAIMS. Another provider's title, and the
 * owner's, are untouched by a refresh here -- a source may only withdraw what it
 * said itself.
 */
async function assertClaims(
  tx: Transaction,
  {
    ownerId,
    itemId,
    sourceId,
    claims,
  }: { ownerId: string; itemId: string; sourceId: string; claims: Claim[] },
): Promise<number> {
  // ONE QUERY FOR THE LOT, both of them. A browse writes a container's worth of
  // records through here, so a select per property per record is the shape that
  // makes a bulk import expensive -- and the index this slice adds would be
  // paying for a cost the loop beside it was still creating.
  const declared = await propertyDeclarations(
    tx,
    ownerId,
    claims.map((claim) => claim.property),
  );
  const held = await tx
    .select({
      id: statements.id,
      propertyId: statements.propertyId,
      value: sql<string>`${statements.valueLiteral}`,
      quarantined: statements.quarantined,
    })
    .from(statements)
    .where(
      and(
        eq(statements.ownerId, ownerId),
        eq(statements.subjectItemId, itemId),
        inArray(
          statements.propertyId,
          [...declared.values()].map((property) => property.id),
        ),
        eq(statements.sourceId, sourceId),
        isNull(statements.deletedAt),
        // LITERALS ONLY, as `findStatementsOfItem` reads them. These properties
        // take literals, so an item-valued row against one of them is not
        // something this import wrote and not its to withdraw.
        isNotNull(statements.valueLiteral),
      ),
    );

  const withdrawn: string[] = [];
  const fresh: (typeof statements.$inferInsert)[] = [];
  // Rows this source still claims whose value its property cannot hold, and
  // which are not marked yet. See `quarantine` below for why they exist.
  const quarantine: string[] = [];
  // And the other direction: rows marked under a rule the catalogue has since
  // loosened, which it can read after all. NOT `release`, which is one letter
  // from `released` and from ADR-0081's sense of the word.
  const readmitted: string[] = [];
  let heldBack = 0;
  for (const claim of claims) {
    const property = declared.get(claim.property);
    if (property === undefined) throw new Error(`no property named ${claim.property}`);
    const propertyId = property.id;
    // WHAT MAY BE READ BACK AS A VALUE OF THIS PROPERTY, AS THE CATALOGUE
    // DECLARES IT (CNCORE-47, ADR-0012). `undefined` is a property declaring no
    // check -- `title` is free text and there is no such thing as a malformed
    // one -- and is the answer for every property but `released` today.
    const check = declaredCheck(claim.property, property.validation);
    // A provider that sends one value twice claims it once. Two identical rows
    // would be the self-corroboration this whole function exists to refuse.
    const wanted = [...new Set(claim.values)];
    const holds = held.filter((statement) => statement.propertyId === propertyId);

    withdrawn.push(
      ...holds.filter((statement) => !wanted.includes(statement.value)).map(({ id }) => id),
    );

    const refused = (value: string) => check !== undefined && !check(value);

    fresh.push(
      ...wanted
        .filter((value) => !holds.some((statement) => statement.value === value))
        .map((valueLiteral) => ({
          ownerId,
          subjectItemId: itemId,
          propertyId,
          valueLiteral,
          sourceId,
          quarantined: refused(valueLiteral),
        })),
    );

    // AND WHAT IS ALREADY HELD IS CHECKED AGAIN, not assumed good for having
    // got in. Two things make that necessary rather than tidy. MIGRATION 6
    // BACKFILLS NOTHING -- the check is an EDTF parse and SQL has no such
    // thing -- so every `released` row written before this slice is unmarked;
    // and a refresh re-asserts a value it already holds WITHOUT rewriting it,
    // so a check that ran only on insert would never reach one. The refresh is
    // the only door those rows come back through.
    // AND THE MARK COMES OFF AGAIN WHEN THE DECLARATION LOOSENS (CNCORE-47).
    // ADR-0015 freezes `datatype` and `reference_target` and leaves the rest
    // editable, because "start loose, tighten afterwards" is what every system
    // it studied supports -- and tightening marks offenders rather than
    // rejecting rows already written. A mark that could only ever be ADDED
    // would outlive the rule that justified it: loosen `released` and the
    // catalogue would go on holding back values its own declaration now admits,
    // with nothing saying why. So the re-check answers both ways.
    //
    // ONE PARTITION RATHER THAN TWO FILTERS, because both ask the same question
    // and differ only in which answer they keep: does the mark still agree with
    // what the catalogue declares. Two filters with negated predicates drift
    // apart the day either gains a clause, and each held value would be parsed
    // twice to answer one question.
    for (const statement of holds) {
      const holdBack = refused(statement.value);
      if (holdBack !== statement.quarantined) {
        (holdBack ? quarantine : readmitted).push(statement.id);
      }
    }

    // WHAT THIS IMPORT HELD BACK, which is a fact about the values the provider
    // CLAIMS RIGHT NOW rather than about which rows happened to be written. A
    // count of fresh rows alone answers 0 on every refresh, so a second browse
    // of a container full of bad dates would report exactly what a clean one
    // reports -- the "silently" this check exists to refuse.
    heldBack += wanted.filter(refused).length;
  }

  if (withdrawn.length > 0) {
    await tx
      // The DATABASE's clock, as `observed_at` and `updated_at` both take.
      .update(statements)
      .set({ deletedAt: sql`now()` })
      .where(inArray(statements.id, withdrawn));
  }
  if (quarantine.length > 0) {
    await tx
      .update(statements)
      .set({ quarantined: true })
      .where(inArray(statements.id, quarantine));
  }
  if (readmitted.length > 0) {
    await tx
      .update(statements)
      .set({ quarantined: false })
      .where(inArray(statements.id, readmitted));
  }
  if (fresh.length > 0) await tx.insert(statements).values(fresh);

  return heldBack;
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

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

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

/**
 * The product's own seeded properties, by name -- migration 1's, and migration
 * 3's `external_id`.
 *
 * NEVER MINTED HERE. ADR-0029: only the product adds properties, and it does so
 * in a migration -- an import that could create one would let a provider define
 * a field, which is that rule broken through a different door. So a name with no
 * row is a defect in this file rather than a row to write.
 */
async function propertyDeclarations(
  tx: Transaction,
  ownerId: string,
  names: string[],
): Promise<Map<string, PropertyDeclaration>> {
  const rows = await tx
    .select({ id: properties.id, name: properties.name, validation: properties.validation })
    .from(properties)
    .where(and(eq(properties.ownerId, ownerId), inArray(properties.name, names)));

  const found = new Map(
    rows.map((property) => [property.name, { id: property.id, validation: property.validation }]),
  );
  for (const name of names) {
    if (!found.has(name)) throw new Error(`no migration seeds a property named ${name}`);
  }
  return found;
}

/** One of them, for the single lookup that needs one. */
async function propertyId(tx: Transaction, ownerId: string, name: string): Promise<string> {
  const found = await propertyDeclarations(tx, ownerId, [name]);
  const declared = found.get(name);
  if (declared === undefined) throw new Error(`no migration seeds a property named ${name}`);
  return declared.id;
}
