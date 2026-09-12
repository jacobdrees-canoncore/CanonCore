import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { Database } from "./index";
import { properties, statements } from "./schema";
import { declaredCheck } from "./validation";

/**
 * WHAT A SOURCE CLAIMS ABOUT AN ITEM, and the one door every claim comes
 * through -- a provider's on import, and the owner's own by hand (CNCORE-71).
 *
 * IT LIVES HERE RATHER THAN IN `import.ts` FOR THE REASON `assertPlacement`
 * lives in `placements.ts`: ADR-0012 is a rule about the CLAIM rather than
 * about who is making it, so a second copy for the owner would be a second
 * answer to "what does asserting a value mean". The rules below -- one row per
 * value, agreement recorded rather than counted twice, a withdrawn value
 * tombstoned, a value the property cannot hold quarantined -- are not an
 * import's rules, they are the catalogue's.
 *
 * AND THE OWNER REACHING IT IS WHAT MAKES ADR-0025 TRUE RATHER THAN DECLARED.
 * The owner sits at `source_order` 0, so an owner title written through here
 * outranks every provider's before ranks are considered -- and because a
 * source may only withdraw what it said itself, a later re-import cannot touch
 * it.
 */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * A property as the catalogue declares it: the row's id, and what it says may be
 * read back as a value (ADR-0012).
 */
export interface PropertyDeclaration {
  id: string;
  /** `{}` on every property that declares no check, which is most of them. */
  validation: unknown;
}

/** One property, and every value this provider claims for it right now. */
export interface Claim {
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
export async function assertClaims(
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
 * The product's own seeded properties, by name -- migration 1's, and migration
 * 3's `external_id`.
 *
 * NEVER MINTED HERE. ADR-0029: only the product adds properties, and it does so
 * in a migration -- an import that could create one would let a provider define
 * a field, which is that rule broken through a different door. So a name with no
 * row is a defect in this file rather than a row to write.
 */
export async function propertyDeclarations(
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
export async function propertyId(tx: Transaction, ownerId: string, name: string): Promise<string> {
  const found = await propertyDeclarations(tx, ownerId, [name]);
  const declared = found.get(name);
  if (declared === undefined) throw new Error(`no migration seeds a property named ${name}`);
  return declared.id;
}
