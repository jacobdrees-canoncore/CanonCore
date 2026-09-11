import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  aliases,
  type Database,
  items,
  owners,
  placements,
  properties,
  sources,
  statements,
  vocabularyValues,
} from "./index";
import {
  anItem,
  aProvider,
  aStatement,
  connect,
  ownerSource,
  propertyNamed,
  readItem,
  refusal,
  theOwner,
} from "./testing/catalogue";

let db: Database;
let ownerId: string;

beforeAll(async () => {
  db = await connect();
  ownerId = await theOwner(db);
});

describe("placements", () => {
  it("refuses the same item at the same position in one container twice", async () => {
    // ADR-0017. Two sources agreeing about a placement are corroboration, and
    // corroboration is recorded against ONE row.
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const member = await anItem(db);
    const row = { ownerId, containerId: container, itemId: member, position: 1 };
    await db.insert(placements).values(row);

    expect(await refusal(db.insert(placements).values(row))).toBe(
      "placements_container_item_position",
    );
  });

  it("refuses that pair whatever `edition_id` holds, null included", async () => {
    // THE DECISION MADE BY LEAVING `edition_id` OUT OF THE KEY, pinned so it
    // cannot be changed by accident: the theatrical and the extended cut of one
    // film may NOT both sit at position 1 of one container. A position holds an
    // ITEM, and which edition opens is decided at read time (ADR-0065). See
    // ADR-0092.
    //
    // It also guards the trap under that: adding `edition_id` to the index
    // without `NULLS NOT DISTINCT` would let two byte-identical rows through,
    // because PostgreSQL holds two nulls unequal -- and null is the ordinary
    // case here. This test fails the moment that happens.
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const film = await anItem(db);
    const shared = { ownerId, containerId: container, itemId: film, position: 1 };
    await db.insert(placements).values(shared);

    expect(await refusal(db.insert(placements).values(shared))).toBe(
      "placements_container_item_position",
    );
    expect(
      await refusal(db.insert(placements).values({ ...shared, editionId: crypto.randomUUID() })),
    ).toBe("placements_container_item_position");
  });

  it("allows two DIFFERENT items to share one position", async () => {
    // ADR-0009, and the absence of a constraint is the decision. A story-order
    // container holding both a novel and the film that adapts it must place
    // them at the same point without inventing an order between them.
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const novel = await anItem(db);
    const film = await anItem(db);

    await db.insert(placements).values([
      { ownerId, containerId: container, itemId: novel, position: 3 },
      { ownerId, containerId: container, itemId: film, position: 3 },
    ]);

    const rows = await db.select().from(placements).where(eq(placements.containerId, container));
    expect(rows).toHaveLength(2);
  });

  it("allows one item twice in a container at different positions", async () => {
    // A REPEAT, never a duplicate: a recap at position 1 and the episode at
    // position 5 are one item, twice, on purpose.
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const episode = await anItem(db);

    await db.insert(placements).values([
      { ownerId, containerId: container, itemId: episode, position: 1 },
      { ownerId, containerId: container, itemId: episode, position: 5 },
    ]);

    const rows = await db.select().from(placements).where(eq(placements.containerId, container));
    expect(rows).toHaveLength(2);
  });
});

describe("vocabulary values", () => {
  it("refuses the same raw value twice for one property", async () => {
    const propertyId = await propertyNamed(db, "category");
    await db.insert(vocabularyValues).values({ ownerId, propertyId, value: "Novelisation" });

    expect(
      await refusal(
        db.insert(vocabularyValues).values({ ownerId, propertyId, value: "Novelisation" }),
      ),
    ).toBe("vocabulary_values_raw_value");
  });

  it("keeps two values that differ only by case, because there is no match key", async () => {
    // ADR-0030. The normalised key was MEASURED against the archive and
    // refuted: it collapses 0 of 70 `Medium` values. The wreckage is semantic,
    // and case-folding does not reach it -- `quarantined` does.
    const propertyId = await propertyNamed(db, "category");
    await db.insert(vocabularyValues).values([
      { ownerId, propertyId, value: "Short story" },
      { ownerId, propertyId, value: "short story" },
    ]);

    const rows = await db
      .select()
      .from(vocabularyValues)
      .where(eq(vocabularyValues.propertyId, propertyId));
    expect(rows.filter((r) => r.value.toLowerCase() === "short story")).toHaveLength(2);
  });
});

describe("the owner", () => {
  it("refuses a second owner row", async () => {
    // ADR-0044. One row. Multi-user is a later migration, and dropping this
    // index is the first thing that migration does.
    expect(await refusal(db.insert(owners).values({ displayName: "Someone else" }))).toBe(
      "owners_single_row",
    );
  });
});

describe("sources", () => {
  it("refuses a bare `derived` identity", async () => {
    // ADR-0071. `derived` names the computation AND ITS VERSION. Invalidating
    // a computed claim when the algorithm changes is the only operation ever
    // performed on one, and a bare flag cannot answer which rows to invalidate.
    expect(
      await refusal(
        db.insert(sources).values({
          ownerId,
          kind: "derived",
          identity: "derived",
          label: "A computation",
          // A number rather than an allocation: this test is about the CHECK
          // on `identity`, the order is incidental, and nothing else picks a
          // number any more -- `aProvider` allocates, so `max + 1` stays in the
          // low tens and never reaches here.
          sourceOrder: 900,
        }),
      ),
    ).toBe("sources_derived_names_its_version");
  });

  it("accepts a derived identity that names its version", async () => {
    const [row] = await db
      .insert(sources)
      .values({
        ownerId,
        kind: "derived",
        identity: "derived:palette-v2",
        label: "Palette extractor",
        sourceOrder: 901,
      })
      .returning({ identity: sources.identity });

    expect(row?.identity).toBe("derived:palette-v2");
  });
});

describe("statements", () => {
  it("refuses a statement with no subject", async () => {
    expect(
      await refusal(
        db.insert(statements).values({
          ownerId,
          propertyId: await propertyNamed(db, "title"),
          valueLiteral: "Nothing owns this",
          sourceId: await ownerSource(db),
        }),
      ),
    ).toBe("statements_one_subject");
  });

  it("refuses a statement that is both a literal and a reference", async () => {
    expect(
      await refusal(
        db.insert(statements).values({
          ownerId,
          subjectItemId: await anItem(db),
          propertyId: await propertyNamed(db, "title"),
          valueLiteral: "Both at once",
          valueItemId: await anItem(db),
          sourceId: await ownerSource(db),
        }),
      ),
    ).toBe("statements_one_value");
  });
});

/**
 * ADR-0078, CNCORE-31. THE MAPPING IS HELD BY THE DATABASE, not by whoever
 * happens to be writing it. A provider's own id names ONE item, and the index
 * that says so is partial: it covers the `external_id` property alone, because
 * every other property is a claim two items may legitimately share.
 */
describe("one provider's id, held to one item", () => {
  it("refuses one source's own id on a second item", async () => {
    const provider = await aProvider(db, "http://127.0.0.1:9410");
    const first = await anItem(db);
    const second = await anItem(db);
    await aStatement(db, {
      subjectItemId: first,
      property: "external_id",
      valueLiteral: "265",
      sourceId: provider,
    });

    expect(
      await refusal(
        aStatement(db, {
          subjectItemId: second,
          property: "external_id",
          valueLiteral: "265",
          sourceId: provider,
        }),
      ),
    ).toBe("statements_one_item_per_external_id");
  });

  /**
   * AN ITEM THAT IS GONE MAKES NO CLAIMS, which is the half that keeps the index
   * above from refusing a CORRECT import -- a re-import after a delete needs the
   * dead item's claim on the provider's id out of the way.
   *
   * IT REACHES ALL OF THEM, not only the mapping, because the rule is about what
   * a tombstone MEANS rather than about one property. And the timestamp is the
   * item's own, so the set this trigger took stays distinguishable from claims a
   * source withdrew itself -- ADR-0040's shape, applied to a delete.
   */
  it("takes an item's statements down with the item, at the item's own timestamp", async () => {
    const provider = await aProvider(db, "http://127.0.0.1:9411");
    const deleted = await anItem(db);
    const survivor = await anItem(db);
    await aStatement(db, {
      subjectItemId: deleted,
      property: "title",
      valueLiteral: "The Tenth Planet",
      sourceId: provider,
    });
    await aStatement(db, {
      subjectItemId: deleted,
      property: "released",
      valueLiteral: "1966-10-08",
      sourceId: provider,
    });
    await aStatement(db, {
      subjectItemId: survivor,
      property: "title",
      valueLiteral: "The Power of the Daleks",
      sourceId: provider,
    });

    const at = new Date("2026-09-11T10:00:00.000Z");
    await db.update(items).set({ deletedAt: at }).where(eq(items.id, deleted));

    const taken = await db
      .select({ deletedAt: statements.deletedAt })
      .from(statements)
      .where(eq(statements.subjectItemId, deleted));
    expect(taken.map((claim) => claim.deletedAt?.toISOString())).toEqual([
      at.toISOString(),
      at.toISOString(),
    ]);

    // ADR-0014: the column is the projection of whichever LIVE statement wins,
    // so it empties with them. This is what a BEFORE trigger would lose --
    // PostgreSQL applies the outer row over a nested write to the same row, so
    // the reprojection would vanish and the dead item would keep a title no
    // statement supports.
    expect((await readItem(db, deleted))?.title).toBeNull();

    // A SOURCE MAY ONLY WITHDRAW WHAT IT SAID ITSELF, and a delete reaches only
    // the item it deleted. Another item's claims are untouched even from the
    // same source.
    expect(
      (
        await db
          .select({ deletedAt: statements.deletedAt })
          .from(statements)
          .where(eq(statements.subjectItemId, survivor))
      ).map((claim) => claim.deletedAt),
    ).toEqual([null]);
  });
});

describe("items", () => {
  it("refuses an ordered item that is not a container", async () => {
    expect(await refusal(db.insert(items).values({ ownerId, kind: "work", isOrdered: true }))).toBe(
      "items_ordered_implies_container",
    );
  });

  it("refuses a kind that is not one of the seven", async () => {
    // ADR-0005. The list is closed; anything finer is a `category` statement,
    // which can be sourced and disputed where a kind column cannot.
    expect(await refusal(db.insert(items).values({ ownerId, kind: "episode" }))).toBe(
      "items_kind_item_kinds_kind_fk",
    );
  });
});

describe("the category graph", () => {
  it("refuses an item as its own category", async () => {
    const item = await anItem(db);
    expect(
      await refusal(
        aStatement(db, {
          subjectItemId: item,
          property: "category",
          valueItemId: item,
          sourceId: await ownerSource(db),
        }),
      ),
    ).toMatch(/category cycle/);
  });

  it("refuses a cycle two steps long", async () => {
    const a = await anItem(db);
    const b = await anItem(db);
    const source = await ownerSource(db);
    await aStatement(db, {
      subjectItemId: a,
      property: "category",
      valueItemId: b,
      sourceId: source,
    });

    expect(
      await refusal(
        aStatement(db, {
          subjectItemId: b,
          property: "category",
          valueItemId: a,
          sourceId: source,
        }),
      ),
    ).toMatch(/category cycle/);
  });

  it("allows one item to sit under two categories at once", async () => {
    // ADR-0074 refuses CYCLES, not a DAG. `Category:26th century human
    // students` sits under both `26th century individuals` AND `Human
    // students`, and the archive's real graph is 22 levels deep.
    const child = await anItem(db);
    const first = await anItem(db);
    const second = await anItem(db);
    const source = await ownerSource(db);

    await aStatement(db, {
      subjectItemId: child,
      property: "category",
      valueItemId: first,
      sourceId: source,
    });
    await aStatement(db, {
      subjectItemId: child,
      property: "category",
      valueItemId: second,
      sourceId: source,
    });

    const rows = await db.select().from(statements).where(eq(statements.subjectItemId, child));
    expect(rows).toHaveLength(2);
  });
});

describe("property definitions", () => {
  it("refuses a change of datatype after creation", async () => {
    // ADR-0015. Magento is the one system studied that did not freeze this,
    // and it silently DELETES every scoped value when scope narrows.
    const titleProperty = await propertyNamed(db, "title");

    expect(
      await refusal(
        db.update(properties).set({ datatype: "url" }).where(eq(properties.id, titleProperty)),
      ),
    ).toMatch(/datatype freezes at creation/);
  });

  it("refuses a change of reference target after creation", async () => {
    const portrayedBy = await propertyNamed(db, "portrayed_by");

    expect(
      await refusal(
        db
          .update(properties)
          .set({ referenceTarget: ["character"] })
          .where(eq(properties.id, portrayedBy)),
      ),
    ).toMatch(/reference target freezes at creation/);
  });

  it("allows cardinality to be tightened later", async () => {
    // The other half of ADR-0015: required, cardinality, range and options stay
    // editable, which is what makes "start loose, tighten later" survivable.
    const sortName = await propertyNamed(db, "sort_name");
    await db.update(properties).set({ cardinality: "single" }).where(eq(properties.id, sortName));

    const [row] = await db.select().from(properties).where(eq(properties.id, sortName));
    expect(row?.cardinality).toBe("single");

    await db.update(properties).set({ cardinality: "multiple" }).where(eq(properties.id, sortName));
  });

  /**
   * AND SO DOES A VALIDATION RULE (CNCORE-47). The freeze is a trigger naming
   * three columns, so `validation` stays editable by the absence of a clause --
   * and an absence is what nobody notices breaking. ADR-0015 now makes a claim
   * about it, so something has to hold the claim up.
   *
   * A rule that can be tightened later is what makes "start loose, tighten
   * afterwards" survivable, and tightening one marks offenders at the next
   * refresh rather than rejecting rows already written.
   */
  it("allows a validation rule to be tightened and loosened later", async () => {
    const released = await propertyNamed(db, "released");
    await db
      .update(properties)
      .set({ validation: { format: "edtf", level: 0 } })
      .where(eq(properties.id, released));

    const [row] = await db.select().from(properties).where(eq(properties.id, released));
    expect(row?.validation).toEqual({ format: "edtf", level: 0 });

    await db
      .update(properties)
      .set({ validation: { format: "edtf", level: 1 } })
      .where(eq(properties.id, released));
  });

  /**
   * A DECLARATION NAMES A FORMAT, and `{}` declares nothing. `jsonb` takes a
   * scalar, an array and a null as happily as an object, so this is the one
   * declaration on `properties` no foreign key can reach -- `datatype`,
   * `value_kind` and `cardinality` all have reference tables behind them.
   */
  it("refuses a validation that is not an object", async () => {
    const released = await propertyNamed(db, "released");

    expect(
      await refusal(
        db
          .update(properties)
          .set({ validation: ["edtf"] })
          .where(eq(properties.id, released)),
      ),
    ).toMatch(/properties_validation_declares_a_format/);
  });

  it("refuses a declaration that names no format", async () => {
    const released = await propertyNamed(db, "released");

    expect(
      await refusal(
        db
          .update(properties)
          .set({ validation: { level: 1 } })
          .where(eq(properties.id, released)),
      ),
    ).toMatch(/properties_validation_declares_a_format/);
  });
});

describe("the change sequence", () => {
  it("gives every row a number and advances it on every change", async () => {
    // ADR-0075. Retrofitting this means every row written before it is
    // indistinguishable from every other, so a reversal query cannot see the
    // history it was not present for.
    const item = await anItem(db);
    const first = (await readItem(db, item))?.changeSequence;
    expect(first).toBeGreaterThan(0);

    await db.update(items).set({ sortName: "Nudged" }).where(eq(items.id, item));
    const second = (await readItem(db, item))?.changeSequence;

    expect(second).toBeGreaterThan(first!);
  });

  it("draws every table's numbers from ONE sequence, so a merge is findable across them", async () => {
    const item = await anItem(db);
    const source = await aProvider(db, "https://provider.test/sequence");
    const statement = await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "Ordered against the item",
      sourceId: source,
    });

    const [itemRow] = await db.select().from(items).where(eq(items.id, item));
    const [sourceRow] = await db.select().from(sources).where(eq(sources.id, source));
    const [statementRow] = await db.select().from(statements).where(eq(statements.id, statement));

    // Three tables, three DIFFERENT numbers: one sequence, not one per table.
    // That is what lets "find everything stamped with merge 47" be answered in
    // the order the merge touched things.
    const numbers = [
      sourceRow!.changeSequence,
      statementRow!.changeSequence,
      itemRow!.changeSequence,
    ];
    expect(new Set(numbers).size).toBe(3);

    // And the item comes LAST, after the statement that caused it: writing the
    // statement re-projected the item, which is a change to the item's row and
    // takes a number of its own. An item that kept its insert-time number would
    // mean the projection had happened outside the sequence.
    expect(itemRow!.changeSequence).toBeGreaterThan(statementRow!.changeSequence);
    expect(statementRow!.changeSequence).toBeGreaterThan(sourceRow!.changeSequence);
  });
});

describe("holds_work", () => {
  it("is set when a container gains a work, and not when it gains an entity", async () => {
    // ADR-0077. A kind filter alone cannot exclude "the Doctors, in order",
    // because containers fold into `work` (ADR-0004). What the container HOLDS
    // is the missing test.
    const ofWorks = await anItem(db, { isContainer: true, isOrdered: true });
    const ofPeople = await anItem(db, { isContainer: true, isOrdered: true });
    expect((await readItem(db, ofWorks))?.holdsWork).toBe(false);

    await db.insert(placements).values([
      { ownerId, containerId: ofWorks, itemId: await anItem(db, { kind: "work" }), position: 1 },
      { ownerId, containerId: ofPeople, itemId: await anItem(db, { kind: "person" }), position: 1 },
    ]);

    expect((await readItem(db, ofWorks))?.holdsWork).toBe(true);
    expect((await readItem(db, ofPeople))?.holdsWork).toBe(false);
  });
});

describe("aliases", () => {
  it("refuses two aliases for one merged-away id", async () => {
    // ADR-0040. The loser stays a permanent alias, so no URL ever breaks -- and
    // an id that resolved to two survivors would break exactly that promise.
    const survivor = await anItem(db);
    const other = await anItem(db);
    const merged = crypto.randomUUID();
    await db.insert(aliases).values({ ownerId, aliasItemId: merged, itemId: survivor });

    expect(
      await refusal(db.insert(aliases).values({ ownerId, aliasItemId: merged, itemId: other })),
    ).toBe("aliases_alias_item");
  });
});
