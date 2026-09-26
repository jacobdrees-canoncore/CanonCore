import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  aliases,
  createGroupByHand,
  type Database,
  groupItems,
  groupProviders,
  identifiers,
  items,
  matchCandidates,
  owners,
  partDisagreements,
  placementSources,
  placements,
  properties,
  sessions,
  settings,
  sources,
  statements,
  taskRuns,
  vocabularyValues,
} from "./index";
import {
  anItem,
  aPlacement,
  aProvider,
  aStatement,
  connect,
  ownerSource,
  propertyNamed,
  readItem,
  refusal,
  theOwner,
} from "./testing/catalogue";

/**
 * WHAT THIS DATABASE REFUSES, ASSERTED BY WRITES THAT TRY IT.
 *
 * ADR-0159 IS THE CRITERION AND THE ROLL CALL. A rule some path in this
 * repository can reach earns a violating write here; one no path can reach is
 * listed in that record with the reason it is left, so a later pass does not
 * re-derive the population. Nine are left as of 2026-09-20, five of them because
 * nothing in version one writes the table at all.
 *
 * EVERY TEST NAMES THE CONSTRAINT IT EXPECTS, because `refusal` answers with the
 * name PostgreSQL gave. A write that trips a neighbouring rule then fails here
 * rather than passing as though it had proved the rule in its title.
 *
 * RUNNING THIS FILE ALONE PROVES NOTHING ABOUT A FLAKE IN IT (ADR-0184). One of
 * these failed once under a concurrent `pnpm test` and passed three times after
 * it, alone and in company -- which is not evidence the rule holds. Every
 * worktree's suites share one server (ADR-0104), so alone is the condition in
 * which the server always serves. That record carries what was measured, and
 * both of the things a test here can otherwise report the machine as: `refusal`
 * answering a server's condition as a constraint's name, and a per-test budget
 * set for a suite that reaches nothing.
 */
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
    const story = await anItem(db);
    const row = { ownerId, containerId: container, itemId: story, position: 1 };
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
 * CNCORE-349. ONE SOURCE SAYS ONE VALUE FOR ONE ITEM IN ONE SCHEME, because
 * CMPP's `external_ids` is a map keyed by scheme: two live rows for one
 * (item, source, scheme) are two answers where the provider gave one.
 * `assertIdentifiers` never writes a second; the index is what makes that a
 * fact rather than a property of the only writer there is.
 */
describe("an Identifier, one per scheme per source", () => {
  it("refuses a second live value for one item in one scheme from one source", async () => {
    const provider = await aProvider(db, "http://127.0.0.1:9412");
    const item = await anItem(db);
    const ownerId = await theOwner(db);
    const one = { ownerId, itemId: item, sourceId: provider, scheme: "imdb" };
    await db.insert(identifiers).values({ ...one, value: "tt0133093" });

    expect(await refusal(db.insert(identifiers).values({ ...one, value: "tt0234215" }))).toBe(
      "identifiers_one_value_per_scheme",
    );
  });
});

/**
 * CNCORE-361. A PAIR IS OFFERED ONCE, and a source counts one work's parts
 * once. `recordWhatWasNotApplied` writes neither twice -- it skips a pair on
 * conflict and refreshes a count in place -- so these indexes are what make
 * that a fact rather than a property of the only writer there is.
 */
describe("what the matcher hands over, once each", () => {
  it("refuses one pair offered twice", async () => {
    const ownerId = await theOwner(db);
    const pair = {
      ownerId,
      itemId: await anItem(db),
      candidateItemId: await anItem(db),
      score: 0.7,
      titleSignal: "subtitle",
      releasedSignal: "same",
    };
    await db.insert(matchCandidates).values(pair);

    expect(await refusal(db.insert(matchCandidates).values(pair))).toBe(
      "match_candidates_one_per_pair",
    );
  });

  it("refuses a second count of one work's parts from one source", async () => {
    const one = {
      ownerId: await theOwner(db),
      itemId: await anItem(db),
      sourceId: await aProvider(db, "http://127.0.0.1:9413"),
    };
    await db.insert(partDisagreements).values({ ...one, parts: 4 });

    expect(await refusal(db.insert(partDisagreements).values({ ...one, parts: 6 }))).toBe(
      "part_disagreements_one_per_source",
    );
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
    // THREE RATHER THAN THE TWO WRITTEN ABOVE (CNCORE-173), and the third is the
    // point rather than noise: the title left a derived `sort_name` behind, and
    // it goes down with the item at the item's own timestamp exactly as the two
    // claims a provider made do. A derived statement that outlived the tombstone
    // would be a claim about a grave.
    expect(taken.map((claim) => claim.deletedAt?.toISOString())).toEqual([
      at.toISOString(),
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
    ).toEqual([null, null]);
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

  /**
   * THE SAME ARGUMENT ONE COLUMN OVER (migration 12). `capabilities` is the
   * second declaration on `properties` no foreign key can reach, and ADR-0015
   * leaves it editable -- so its shape is held against every later write rather
   * than only against the seed that first filled it.
   */
  it("refuses capabilities that are not an object", async () => {
    const note = await propertyNamed(db, "note");

    expect(
      await refusal(
        db
          .update(properties)
          .set({ capabilities: ["owner"] })
          .where(eq(properties.id, note)),
      ),
    ).toMatch(/properties_capabilities_are_an_object/);
  });

  /**
   * THE ARM THE MIGRATION SINGLES OUT AS ITS OWN REASON, and it was asserted
   * nowhere until review said so. `jsonb` takes the STRING `"false"` as happily
   * as the boolean, and a string reads as truthy wherever it is cast -- so a
   * private property made public by a pair of quotes is exactly the write this
   * clause exists to refuse.
   */
  it("refuses a `public` that is a string rather than a boolean", async () => {
    const note = await propertyNamed(db, "note");

    expect(
      await refusal(
        db
          .update(properties)
          .set({ capabilities: { assertableBy: ["owner"], public: "false" } })
          .where(eq(properties.id, note)),
      ),
    ).toMatch(/properties_capabilities_are_an_object/);
  });

  /**
   * AN EMPTY LIST OF ADMITTED SOURCES IS A PROPERTY NOTHING MAY ASSERT, which
   * is a typo rather than a decision: a field no source can write is a field
   * with no way in. A property open to everything says so by declaring nothing.
   */
  it("refuses an empty list of admitted sources", async () => {
    const note = await propertyNamed(db, "note");

    expect(
      await refusal(
        db
          .update(properties)
          .set({ capabilities: { assertableBy: [] } })
          .where(eq(properties.id, note)),
      ),
    ).toMatch(/properties_capabilities_are_an_object/);
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

/**
 * ADR-0077, CNCORE-71. `items.holds_work` is maintained by a trigger on
 * `placements`, never on `items` -- so a member whose `kind` changed after it
 * was placed would leave every container holding it stale, and work-browsing
 * READS that flag to decide what an owner is shown.
 *
 * CNCORE-71 is the edit path migration 1 anticipated, and it takes the SECOND
 * of the two options that ticket names: editing a kind is explicitly REFUSED.
 * The refusal is a trigger rather than an absent form field, because an absence
 * bounds one door and this bounds the table -- `/api/rpc`, a later surface and a
 * psql session included. Whatever first wants to edit a kind has to drop this
 * trigger, and dropping it is where the `holds_work` reprojection gets written.
 */
describe("an item's kind", () => {
  it("refuses to change after creation", async () => {
    const person = await anItem(db, { kind: "person" });

    expect(
      await refusal(db.update(items).set({ kind: "character" }).where(eq(items.id, person))),
    ).toMatch(/kind freezes at creation/);
  });

  /**
   * THE OTHER HALF, and it is what makes the freeze a freeze rather than a lock
   * on the row. Everything else about an item stays editable -- the import
   * itself turns `is_container` on when a `browse` finds members (CNCORE-28) --
   * so a trigger that refused every update would break the write path that
   * already exists.
   */
  it("leaves the rest of the row editable", async () => {
    const work = await anItem(db, { kind: "work" });

    await db.update(items).set({ isContainer: true }).where(eq(items.id, work));

    expect((await readItem(db, work))?.isContainer).toBe(true);
  });
});

/**
 * ADR-0096: a note is a Statement with a `note` property, and ADR-0045 says
 * nothing but the Owner can assert one.
 */
describe("the Owner note", () => {
  it("refuses a note from a provider", async () => {
    const story = await anItem(db);
    const provider = await aProvider(db, "provider-that-tries-to-annotate");

    expect(
      await refusal(
        aStatement(db, {
          subjectItemId: story,
          property: "note",
          valueLiteral: "A provider speaking for the owner",
          sourceId: provider,
        }),
      ),
    ).toMatch(/property note: only a source of kind owner may assert one; this source is provider/);
  });

  it("takes one from the Owner", async () => {
    const story = await anItem(db);

    const note = await aStatement(db, {
      subjectItemId: story,
      property: "note",
      valueLiteral: "The one I always come back to",
      sourceId: await ownerSource(db),
    });

    expect(note).toBeTruthy();
  });

  /**
   * THE OTHER HALF, and it is what makes the rule a declaration rather than a
   * lock on the table. `title` declares no `assertableBy`, so it is open to every
   * source, and the import writes one for every record it takes -- so a trigger
   * that refused a provider's claim outright would break the import that exists
   * today.
   */
  it("leaves a property that declares nothing open to a provider", async () => {
    const story = await anItem(db);

    const title = await aStatement(db, {
      subjectItemId: story,
      property: "title",
      valueLiteral: "What the provider calls it",
      sourceId: await aProvider(db, "provider-that-may-still-title"),
    });

    expect(title).toBeTruthy();
  });

  /**
   * THE OTHER HALF OF `UPDATE OF "source_id", "property_id"`, and without it the
   * test below would pass just as well against a trigger that had stopped
   * firing on updates altogether. Moving an existing claim onto a source the
   * property does not admit IS an assertion by that source, and it is refused.
   */
  it("refuses a note moved onto a provider's source", async () => {
    const story = await anItem(db);
    const note = await aStatement(db, {
      subjectItemId: story,
      property: "note",
      valueLiteral: "A note about to change hands",
      sourceId: await ownerSource(db),
    });
    const provider = await aProvider(db, "provider-that-tries-to-adopt-a-note");

    expect(
      await refusal(
        db.update(statements).set({ sourceId: provider }).where(eq(statements.id, note)),
      ),
    ).toMatch(/property note: only a source of kind owner may assert one/);
  });

  /**
   * TIGHTENING A DECLARATION MUST NOT TRAP THE ROWS ALREADY WRITTEN, which is
   * ADR-0015's own rule: `capabilities` is editable, and "tightening a rule
   * never rejects existing rows either -- it marks the property as having
   * offenders and lets you list them".
   *
   * THE ROW THAT CANNOT BE WITHDRAWN IS A ROW THAT CANNOT BE DELETED. Review
   * found this: a rule re-checked on EVERY update of a statement bites the two
   * writes that are not assertions at all -- `assertClaims` tombstoning what a
   * source no longer claims, and migration 1's cascade taking an item's
   * statements down with the item. Narrow `note` to a kind the owner is not,
   * and the owner's own note became impossible to remove and its item
   * impossible to delete.
   */
  it("lets a statement be withdrawn after its property stops admitting its source", async () => {
    const story = await anItem(db);
    await aStatement(db, {
      subjectItemId: story,
      property: "note",
      valueLiteral: "A note written while the owner was still admitted",
      sourceId: await ownerSource(db),
    });
    const note = await propertyNamed(db, "note");

    try {
      await db
        .update(properties)
        .set({ capabilities: { assertableBy: ["sidecar"], public: false } })
        .where(eq(properties.id, note));

      // THE WITHDRAWAL, which is an update of `deleted_at` and asserts nothing.
      await db
        .update(statements)
        .set({ deletedAt: sql`now()` })
        .where(eq(statements.subjectItemId, story));

      // AND THE ITEM GOES DOWN WITH IT (migration 1's cascade), which is the
      // second write the rule must not reach.
      await db.update(items).set({ deletedAt: sql`now()` }).where(eq(items.id, story));
    } finally {
      // PUT IT BACK, or every later test in this file reads a `note` property
      // the migration did not write. The cardinality test above does the same.
      await db
        .update(properties)
        .set({ capabilities: { assertableBy: ["owner"], public: false } })
        .where(eq(properties.id, note));
    }

    expect((await readItem(db, story))?.deletedAt).not.toBeNull();
  });
});

/**
 * ADR-0025's ORDER IS GLOBAL, and `sources_order` is what makes it a total one.
 * Two sources sharing a place would leave which of them outranks the other to
 * the planner, and rank precedence is the first term of the projection's own
 * ordering -- so the field a reader sees would depend on the plan.
 *
 * THIS IS THE CONSTRAINT THE DATA PROJECT MEETS FIRST. `import.ts` allocates
 * with `max(source_order) + 1` per owner on every first import from a new
 * Provider, and a second Provider is a second source row. It has fired in anger
 * once already, under CNCORE-7.
 */
describe("a source's place in the global order", () => {
  it("refuses a second source claiming a place another source already holds", async () => {
    const taken = await aProvider(db, "https://provider.test/order-taken");
    const [holder] = await db.select().from(sources).where(eq(sources.id, taken));

    expect(
      await refusal(
        db.insert(sources).values({
          ownerId,
          kind: "provider",
          identity: "https://provider.test/order-wanted",
          label: "order-wanted",
          sourceOrder: holder!.sourceOrder,
        }),
      ),
    ).toBe("sources_order");
  });
});

/**
 * FOUR CONSTRAINTS WHERE THE AVOIDANCE IS TESTED AND THE REFUSAL IS NOT. Each
 * sits behind a find-or-create path, and each of those paths has a test
 * asserting it does not collide -- `groups.test.ts`'s "puts the same Item in one
 * Group once, however many times the Owner asks" is the shape. What none of them
 * asserts is that the database refuses a collision that gets past the path,
 * which is the half that still holds when a second writer appears or a path is
 * rewritten.
 *
 * EACH NAMES THE CONSTRAINT IT EXPECTS, so a row that trips a neighbouring rule
 * fails here rather than passing as though it had proved this one.
 */
describe("find-or-create, and the refusal underneath it", () => {
  it("refuses one provider's identity written as a source twice", async () => {
    const identity = "https://provider.test/identity-twice";
    await aProvider(db, identity);

    expect(
      await refusal(
        db.insert(sources).values({
          ownerId,
          kind: "provider",
          identity,
          label: "identity-twice, again",
          // ALLOCATED RATHER THAN CHOSEN, so `sources_order` cannot be what
          // fires and pass this test for the wrong reason.
          sourceOrder: sql`(select coalesce(max("source_order"), 0) + 1 from "sources" where "owner_id" = ${ownerId})`,
        }),
      ),
    ).toBe("sources_identity");
  });

  /**
   * ADR-0017. Two sources agreeing about a placement are corroboration and are
   * recorded against one row EACH; one source agreeing with itself is the same
   * claim twice, and there is nothing for a second row to hold.
   */
  it("refuses one source corroborating one placement twice", async () => {
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    const source = await aProvider(db, "https://provider.test/corroborates-twice");
    const placement = await aPlacement(db, {
      containerId: container,
      itemId: story,
      position: 1,
      sourceId: source,
    });

    expect(
      await refusal(
        db.insert(placementSources).values({ ownerId, placementId: placement, sourceId: source }),
      ),
    ).toBe("placement_sources_placement_source");
  });

  /**
   * ADR-0010. A Group SCOPES rather than partitions, so an Item sits in several
   * at once -- but twice in ONE is the same claim twice, and a browse reading
   * both would show the Item twice in a scope that holds it once.
   */
  it("refuses one Item put in one Group twice", async () => {
    const group = await createGroupByHand(db, { name: "Refuses a repeated member" });
    const story = await anItem(db);
    await db.insert(groupItems).values({ ownerId, groupId: group, itemId: story });

    expect(
      await refusal(db.insert(groupItems).values({ ownerId, groupId: group, itemId: story })),
    ).toBe("group_items_group_item");
  });

  /** The same argument at the Group's other edge: asking one Provider twice. */
  it("refuses one Group asking one Provider twice", async () => {
    const group = await createGroupByHand(db, { name: "Refuses a repeated Provider" });
    const providerIdentity = "https://provider.test/asked-twice";
    await db.insert(groupProviders).values({ ownerId, groupId: group, providerIdentity });

    expect(
      await refusal(
        db.insert(groupProviders).values({ ownerId, groupId: group, providerIdentity }),
      ),
    ).toBe("group_providers_group_provider");
  });
});

/**
 * ADR-0049's TWO RULES ABOUT A RUN, which `task-runs.ts` types as "null exactly
 * while `outcome` is `running`" and which nothing tried to break until
 * CNCORE-260.
 */
describe("a run of one task", () => {
  it("refuses an outcome nobody defined, because stopped is distinct from broken", async () => {
    expect(
      await refusal(
        db.insert(taskRuns).values({
          ownerId,
          taskKey: "sweep",
          outcome: "finished",
          // ENDED ON PURPOSE, so `task_runs_running_has_no_end` is satisfied and
          // cannot be what fires: an unknown outcome with a null end breaks both.
          endedAt: new Date(),
        }),
      ),
    ).toBe("task_runs_outcome_is_known");
  });

  /**
   * RUNNING IS EXACTLY "HAS NOT ENDED", stored once rather than as two facts
   * free to disagree. The row this refuses is the one the schema names: one
   * reading `completed` with no end time, which a reader would take for a run
   * still going.
   */
  it("refuses a run that has finished without saying when", async () => {
    expect(
      await refusal(
        db.insert(taskRuns).values({ ownerId, taskKey: "sweep", outcome: "completed" }),
      ),
    ).toBe("task_runs_running_has_no_end");
  });
});

/**
 * ADR-0044's argument at a second table. `settings.ts` calls this index "WHAT
 * MAKES THE RACE LOUD RATHER THAN SILENT": two writers each creating the
 * configuration row would otherwise leave two, and which one a read answers with
 * is then the planner's choice rather than the Owner's.
 */
describe("the settings row", () => {
  /**
   * THE ONE TEST HERE THAT WRITES A ROW IT IS NOT TRYING TO HAVE REFUSED, and it
   * puts the table back. Thirty files share one database in a fixed order
   * (`fileParallelism: false`), and a unique index over `(true)` cannot be
   * provoked without there being exactly one row to collide with -- so this
   * empties the table, writes that one, and empties it again. No migration
   * seeds `settings`, so an empty table is the state a freshly built database
   * is in and the state this leaves behind.
   */
  it("refuses a second settings row", async () => {
    await db.delete(settings);
    await db.insert(settings).values({ ownerId });

    expect(await refusal(db.insert(settings).values({ ownerId }))).toBe("settings_single_row");

    await db.delete(settings);
  });
});

/**
 * THE TOKEN IS THE LOOKUP KEY (ADR-0043), so two rows answering one token would
 * make which session a caller holds -- and therefore which capabilities and
 * which device -- depend on the planner. The column is a SHA-256 of the secret
 * and never the secret, so this writes hashes rather than tokens.
 */
describe("a session's token", () => {
  it("refuses two sessions verifying one token", async () => {
    const tokenHash = createHash("sha256").update("one token, two rows").digest("hex");
    await db.insert(sessions).values({ ownerId, tokenHash });

    expect(await refusal(db.insert(sessions).values({ ownerId, tokenHash }))).toBe(
      "sessions_token_hash_unique",
    );
  });
});

/**
 * THE `touch_row` TRIGGERS, ASSERTED AS A GROUP (CNCORE-260, ADR-0159). The count
 * is stated once, at the floor below, rather than here as well.
 *
 * THIS ASSERTS ATTACHMENT AND NOT THE FUNCTION'S BEHAVIOUR, which is the whole
 * reason it is one test rather than one per table. `touch_row` is ONE shared
 * function, and two tests already prove what it DOES: "gives every row a number
 * and advances it on every change" above, and `settings.test.ts`'s "ADR-0075's
 * SUBSTRATE", which asserts both halves on the one table where every change is
 * an UPDATE. A behavioural test per table would re-prove one function as many
 * times as there are tables, and need a bespoke valid row for each.
 *
 * WHAT VARIES PER TABLE IS WHETHER THE TRIGGER IS ATTACHED, so that is what this
 * queries. Migration 1 attached it to the eleven tables that existed then IN A
 * LOOP -- "a loop rather than eleven copy-pasted statements, because eleven
 * copies are eleven chances for a later table to be added to ten of them" -- and
 * every table since has sat OUTSIDE that loop and had to say so itself.
 * Migrations 10, 13, 16, 18, 19 and 20 each did. This is what fails the day one
 * does not.
 */
describe("touch_row", () => {
  it("is attached to every table that carries a change sequence, and armed to fire", async () => {
    const carryTheColumn = (
      await db.execute<{ table: string }>(sql`
        select c.relname as "table"
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid
        where n.nspname = 'public'
          and c.relkind = 'r'
          and a.attname = 'change_sequence'
          and a.attnum > 0
          and not a.attisdropped
      `)
    ).rows.map(({ table }) => table);

    /*
     * ENABLED, BEFORE, AND PER ROW -- not merely present. A trigger answers
     * `pg_trigger` just as happily after `ALTER TABLE ... DISABLE TRIGGER`, and
     * `touch_row` ASSIGNS TO `NEW`, which does nothing at all from an AFTER
     * trigger and has no `NEW` to assign to from a statement-level one. So a
     * bare existence check would pass on all three ways of attaching it
     * uselessly. `tgenabled` is 'D' when disabled; bit 0 of `tgtype` is
     * FOR EACH ROW and bit 1 is BEFORE (`pg_trigger.h`).
     */
    const armed = (
      await db.execute<{ table: string }>(sql`
        select c.relname as "table"
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        join pg_proc p on p.oid = t.tgfoid
        where n.nspname = 'public'
          and p.proname = 'touch_row'
          and not t.tgisinternal
          and t.tgenabled <> 'D'
          and (t.tgtype & 1) = 1
          and (t.tgtype & 2) = 2
      `)
    ).rows.map(({ table }) => table);

    /*
     * THE POPULATION IS ASSERTED FIRST, because the difference between two empty
     * sets is empty: a query that stopped matching anything would pass this test
     * while proving nothing at all. Nineteen is what both sides measured on
     * 2026-09-20 -- a FLOOR rather than the figure, so a twentieth table WITH
     * its trigger stays green and one without goes red.
     */
    expect(carryTheColumn.length).toBeGreaterThanOrEqual(19);

    expect(carryTheColumn.filter((table) => !armed.includes(table))).toEqual([]);
  });
});

/**
 * THE ROLL CALL (ADR-0159). Every rule this database enforces, read from the
 * catalogue that enforces it, against the ones deliberately left untested.
 *
 * THE POPULATION IS THE APPLIED CATALOGUE RATHER THAN THE MIGRATION TEXT, and
 * that is a choice. Counting `CONSTRAINT` across `migrations/*.sql` answers what
 * the ladder SAYS; a later rung may drop or replace a rule, and only the built
 * database answers what it HOLDS -- which is the thing a violating write
 * actually meets. ADR-0153 asks that a figure be DERIVED where the answer is
 * there to be taken, and this takes it on every run rather than quoting a number
 * somebody counted once.
 */
describe("every rule this database enforces", () => {
  /**
   * THE NINE NO WRITE IN THIS REPOSITORY CAN REACH, named so a later pass reads
   * the decision instead of deriving it again. ADR-0159 carries the reason for
   * each; five share one, which is that nothing in version one writes the table
   * at all -- the category `purge.ts` already names.
   */
  const REACHED_BY_NOTHING = [
    "aliases_do_not_point_at_themselves",
    "properties_datatype_agrees_with_value_kind",
    "properties_name",
    "properties_only_item_values_have_a_reference_target",
    "ranks_precedence_unique",
    "sources_logo_carries_its_alternative_text",
    "sources_logo_comes_with_a_notice",
    "statement_qualifiers_one_value",
    "statements_confidence_is_a_probability",
  ];

  it("has a test for each of its rules, or names the rule as one nothing can reach", async () => {
    const enforced = (
      await db.execute<{ rule: string }>(sql`
        select con.conname as "rule"
        from pg_constraint con
        join pg_class c on c.oid = con.conrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and con.contype in ('c', 'u')
        union
        select i.relname as "rule"
        from pg_index x
        join pg_class i on i.oid = x.indexrelid
        join pg_class t on t.oid = x.indrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and x.indisunique
          and not x.indisprimary
          and not exists (select 1 from pg_constraint con where con.conindid = i.oid)
      `)
    ).rows.map(({ rule }) => rule);

    // The floor again, and for the same reason: thirty-five on 2026-09-20, so a
    // query that matched nothing cannot pass by having nothing to compare.
    expect(enforced.length).toBeGreaterThanOrEqual(35);

    /*
     * THE SUITE IS THE INDEX OF WHAT IS TESTED, read rather than restated --
     * `suite-database-wiring.test.ts` and `docker-compose.test.ts` read the tree
     * the same way. Every rule these tests assert names the constraint, because
     * `refusal` answers with the name PostgreSQL gave, so a rule no file here
     * mentions is a rule nothing holds. Flat: every assertion is in this
     * directory, none in `testing/` and none outside `packages/db`.
     */
    const here = fileURLToPath(new URL("./", import.meta.url));
    const suite = (
      await Promise.all(
        (
          await readdir(here)
        )
          .filter((name) => name.endsWith(".test.ts"))
          .map((name) => readFile(join(here, name), "utf8")),
      )
    )
      /*
       * THE LIST ABOVE IS PART OF THE SUITE, which makes the obvious version of
       * this test pass unconditionally: each of the nine is named in this very
       * file, so a search of the suite finds all nine and reports nothing
       * untested. Stripping the literal is what leaves the question being asked
       * -- does any test ASSERT this rule -- rather than answered by the roll
       * call quoting itself.
       */
      .map((source) => source.replace(/const REACHED_BY_NOTHING = \[[^\]]*\];/, ""))
      .join("\n");

    expect(enforced.filter((rule) => !suite.includes(rule)).sort()).toEqual(
      [...REACHED_BY_NOTHING].sort(),
    );
  });
});
