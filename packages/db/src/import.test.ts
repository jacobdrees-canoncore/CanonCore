import { and, eq, isNull, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Database,
  findAttributionOwed,
  importBrowsedContainer,
  importProvidedRecord,
  items,
  owners,
  placementSources,
  placements,
  previewProviderPurge,
  properties,
  purgeProvider,
  sources,
  statements,
} from "./index";
import {
  anItemTitled,
  aPlacement,
  aStatement,
  connect,
  ownerSource,
  readItem,
  refusal,
} from "./testing/catalogue";

let db: Database;

beforeAll(async () => {
  db = await connect();
});

/** What the wiki provider answers for page 265, trimmed to what is imported. */
const TENTH_PLANET = {
  externalId: "265",
  title: "The Tenth Planet (TV story)",
  released: ["1966-10-08"],
};

const wikiProvider = (identity = "http://127.0.0.1:8080") => ({
  identity,
  label: "provider-wiki",
  // The archive imposes no notice and no mark, and `null` is how that is SAID
  // rather than left unsaid: the field is required precisely so an import cannot
  // stay silent about a licence and blank a stored one on the way past.
  attribution: null,
});

/**
 * A provider whose source imposes a licence obligation, which the wiki's does
 * not. The notice is TMDB's verbatim; the mark is a one-pixel GIF here, because
 * what this suite asks is whether the obligation is STORED WITH THE SOURCE, and
 * whether the real bytes are TMDB's mark is the contract test's question.
 */
const tmdbProvider = (identity = "http://127.0.0.1:8081") => ({
  identity,
  label: "provider-tmdb",
  attribution: {
    notice:
      "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
    logo: {
      data_uri: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
      alt: "The Movie Database (TMDB). TMDB does not endorse, certify or approve this application.",
    },
  },
});

/**
 * Every statement about one item, with the property and source that carry it.
 *
 * IT HONOURS THE TOMBSTONE, as every read path does (ADR-0075): a claim a source
 * has withdrawn is gone to `winning_literal` and to `findStatementsOfItem`
 * alike, so a helper that still showed it would be reporting claims no reader
 * can see.
 */
async function claimsAbout(itemId: string) {
  return db
    .select({
      property: properties.name,
      value: statements.valueLiteral,
      sourceKind: sources.kind,
      sourceLabel: sources.label,
      sourceIdentity: sources.identity,
      quarantined: statements.quarantined,
    })
    .from(statements)
    .innerJoin(properties, eq(properties.id, statements.propertyId))
    .innerJoin(sources, eq(sources.id, statements.sourceId))
    .where(and(eq(statements.subjectItemId, itemId), isNull(statements.deletedAt)));
}

/**
 * Runs a body with one property's declaration replaced, and puts back whatever
 * the catalogue held.
 *
 * AN ORDINARY WRITE, not a test reaching around a rule. ADR-0015 freezes
 * `datatype`, `value_kind` and `reference_target` with a trigger and leaves
 * `validation` editable, because a rule that can be tightened later is what
 * makes "start loose, tighten afterwards" survivable -- so changing one here is
 * the same operation the product would perform.
 */
async function declaring(name: string, validation: unknown, body: () => Promise<void>) {
  const [held] = await db
    .select({ validation: properties.validation })
    .from(properties)
    .where(eq(properties.name, name));
  if (!held) throw new Error(`no migration seeds a property named ${name}`);
  await db.update(properties).set({ validation }).where(eq(properties.name, name));
  try {
    await body();
  } finally {
    await db
      .update(properties)
      .set({ validation: held.validation })
      .where(eq(properties.name, name));
  }
}

/**
 * ADR-0036: TMDB's terms oblige the app to show a notice verbatim and prominently,
 * and to show TMDB's mark. The obligation belongs to THE SOURCE, so it is stored on
 * the source row rather than anywhere near the values it covers.
 *
 * THAT PLACEMENT IS THE DECISION, not an implementation detail. Every statement
 * already names its source, so "which claims does this notice cover" is answered by
 * a join rather than by a column on each claim -- and the row that carries the
 * obligation is the row a purge deletes, so the obligation and the content it
 * covers cannot come apart.
 */
describe("the attribution a source's licence obliges the app to show", () => {
  it("stores the notice and the mark on the source, not on what it covers", async () => {
    const provider = tmdbProvider("http://127.0.0.1:9101");
    await importProvidedRecord(db, { provider, record: TENTH_PLANET });

    const [source] = await db
      .select()
      .from(sources)
      .where(and(eq(sources.kind, "provider"), eq(sources.identity, provider.identity)));

    expect(source?.attributionNotice).toBe(provider.attribution.notice);
    expect(source?.attributionLogo).toBe(provider.attribution.logo.data_uri);
    expect(source?.attributionLogoAlt).toBe(provider.attribution.logo.alt);
  });

  /**
   * A SOURCE THAT OWES NOTHING IS THE ORDINARY CASE and must stay writable. The
   * archive imposes no notice, so the wiki provider's row carries none -- and NULL
   * here means "this source requires no attribution" rather than "nobody has filled
   * it in yet", which is a distinction only the provider's own `null` can make.
   */
  it("leaves a source that owes nothing carrying nothing", async () => {
    const provider = wikiProvider("http://127.0.0.1:9102");
    await importProvidedRecord(db, { provider, record: TENTH_PLANET });

    const [source] = await db
      .select()
      .from(sources)
      .where(and(eq(sources.kind, "provider"), eq(sources.identity, provider.identity)));

    expect(source?.attributionNotice).toBeNull();
    expect(source?.attributionLogo).toBeNull();
    expect(source?.attributionLogoAlt).toBeNull();
  });

  /**
   * A LICENCE CHANGES, AND THE ROW MUST FOLLOW IT. The source row is made on the
   * first import and reused after, so a notice written once and never revisited is
   * a notice that goes stale the day the source revises its terms -- and showing
   * last year's is the same breach as showing none.
   */
  it("takes a revised notice on a later import of the same provider", async () => {
    const provider = tmdbProvider("http://127.0.0.1:9103");
    await importProvidedRecord(db, { provider, record: TENTH_PLANET });
    await importProvidedRecord(db, {
      provider: { ...provider, attribution: { notice: "Revised terms.", logo: null } },
      record: TENTH_PLANET,
    });

    const [source] = await db
      .select()
      .from(sources)
      .where(and(eq(sources.kind, "provider"), eq(sources.identity, provider.identity)));

    expect(source?.attributionNotice).toBe("Revised terms.");
    expect(source?.attributionLogo).toBeNull();
  });
});

describe("importing one record from a provider", () => {
  it("writes the story as a work", async () => {
    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider(),
      record: TENTH_PLANET,
    });

    const item = await readItem(db, itemId);
    expect(item).toMatchObject({ kind: "work", isContainer: false });
  });

  /**
   * ADR-0014: the column is a PROJECTION of whichever title statement wins, and
   * the trigger fills it. Asserting on the column proves the import wrote a
   * statement rather than the column -- a write straight to `items.title` would
   * leave no statement for anything to be sourced to.
   */
  it("projects the title from the statement it wrote", async () => {
    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider(),
      record: TENTH_PLANET,
    });

    expect((await readItem(db, itemId))?.title).toBe("The Tenth Planet (TV story)");
  });

  /**
   * THE ACCEPTANCE CRITERION, read back off the rows: every imported value
   * carries the provider as its source. Not the owner, and not nothing --
   * a statement with no source is a claim nobody made.
   */
  it("sources every imported value to the provider", async () => {
    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider(),
      record: TENTH_PLANET,
    });

    const claims = await claimsAbout(itemId);

    expect(claims.length).toBeGreaterThan(0);
    for (const claim of claims) {
      expect(claim.sourceKind).toBe("provider");
      expect(claim.sourceLabel).toBe("provider-wiki");
      expect(claim.sourceIdentity).toBe("http://127.0.0.1:8080");
    }
  });

  /**
   * ADR-0073: a date is known only as precisely as it is actually known, and
   * ADR-0081 leaves the earliest known release to the catalogue. So each date
   * arrives as the EDTF string the provider sent -- `2007-03` stays a month --
   * and all of them are kept rather than one being picked here.
   */
  it("keeps every release date, each at the precision it arrived with", async () => {
    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider(),
      record: {
        externalId: "14544",
        title: "Horror of Glam Rock (audio story)",
        released: ["2007-01-07", "2007-03"],
      },
    });

    const released = (await claimsAbout(itemId))
      .filter((claim) => claim.property === "released")
      .map((claim) => claim.value);

    expect(released.sort()).toEqual(["2007-01-07", "2007-03"]);
  });

  /**
   * ADR-0078: identity is a surrogate id WITH EXTERNAL-ID MAPPINGS BESIDE IT.
   * The provider's own id is a value the provider claimed, so it is a statement
   * carrying that provider as its source (ADR-0012) rather than a column -- and
   * that is what lets a second provider hold its own id for the same story
   * without either of them overwriting the other.
   */
  it("records the provider's own id for the record, sourced to the provider", async () => {
    const identity = "http://127.0.0.1:9201";

    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider(identity),
      record: TENTH_PLANET,
    });

    expect(await claimsAbout(itemId)).toContainEqual(
      expect.objectContaining({
        property: "external_id",
        value: TENTH_PLANET.externalId,
        sourceIdentity: identity,
      }),
    );
  });

  it("writes no released statement when the provider holds no date", async () => {
    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider(),
      record: { externalId: "1", title: "Undated", released: [] },
    });

    const claims = await claimsAbout(itemId);
    // The external id is written whatever else is, because it is what finds
    // this item again (migration 3). What must not appear is `released`.
    expect(claims.map((claim) => claim.property).sort()).toEqual(["external_id", "title"]);
  });
});

/**
 * CNCORE-28. THE CLAIM IS IDENTITY, NOT MATCHING: "this provider's record 265 is
 * the item we already made from this provider's record 265" is one party, one
 * namespace and no judgement. Deciding that two DIFFERENT providers' records
 * describe one work is ADR-0026's operation, and it is not built.
 */
describe("finding a record again by the id its provider knows it by", () => {
  it("refreshes the item it already wrote rather than writing a second", async () => {
    const identity = "http://127.0.0.1:9202";

    const first = await importProvidedRecord(db, {
      provider: wikiProvider(identity),
      record: TENTH_PLANET,
    });
    const second = await importProvidedRecord(db, {
      provider: wikiProvider(identity),
      record: TENTH_PLANET,
    });

    expect(second.itemId).toBe(first.itemId);
  });

  /**
   * REFRESHING IS WHAT FINDING IT AGAIN IS FOR. A provider that has changed its
   * mind -- a page renamed, a date corrected -- must end up SAYING ONE THING,
   * because two live claims from one mouth are not a disagreement anything can
   * resolve: `winning_literal` ranks by rank, then the global source order, then
   * the statement id, and one source competing with itself ties on the first two
   * and falls through to a random uuid. The projected title would then flip
   * between the old name and the new one on nothing at all.
   */
  it("takes the provider's new title and stops holding the one it withdrew", async () => {
    const identity = "http://127.0.0.1:9203";
    const record = { externalId: "265", released: ["1966-10-08"] };

    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider(identity),
      record: { ...record, title: "The Tenth Planet" },
    });
    await importProvidedRecord(db, {
      provider: wikiProvider(identity),
      record: { ...record, title: "The Tenth Planet (TV story)" },
    });

    const titles = (await claimsAbout(itemId))
      .filter((claim) => claim.property === "title")
      .map((claim) => claim.value);
    expect(titles).toEqual(["The Tenth Planet (TV story)"]);
    // ADR-0014: the column is the projection of whichever title statement wins,
    // so this is the reader's answer rather than a second copy of the one above.
    expect((await readItem(db, itemId))?.title).toBe("The Tenth Planet (TV story)");
  });

  /**
   * AND IT IS NOT MATCHING, which is the boundary this test holds. A provider's
   * id is unique in ITS OWN namespace and nowhere else, so two providers both
   * calling something `265` have said nothing to each other -- and an importer
   * that treated the bare id as identity would silently merge two unrelated
   * stories on a collision between two numbering schemes.
   *
   * Deciding that two DIFFERENT providers' records describe one work is
   * ADR-0026's operation, with its own endpoint, its own score and its own
   * review queue, and none of it is built. This ticket only claims that a
   * provider's own id identifies its own record.
   */
  it("keeps two providers' records apart even when they share an id", async () => {
    const record = { externalId: "265", title: "The Tenth Planet", released: [] };

    const wiki = await importProvidedRecord(db, {
      provider: wikiProvider("http://127.0.0.1:9204"),
      record,
    });
    const other = await importProvidedRecord(db, {
      provider: { identity: "http://127.0.0.1:9205", label: "provider-other", attribution: null },
      record,
    });

    expect(other.itemId).not.toBe(wiki.itemId);
  });

  /**
   * AN ITEM THE OWNER DELETED IS NOT AN ITEM TO IMPORT INTO. `itemWithExternalId`
   * honours the tombstone (ADR-0075), so a re-import writes a fresh item rather
   * than writing into the grave and reporting success while the owner sees
   * nothing arrive.
   *
   * IT IS THE CASE MIGRATION 5'S INDEX HAD TO DECIDE FIRST. The fresh item needs
   * a second `external_id` statement with the same (source, value) as the dead
   * one, which a unique index refuses -- so the index carries `deleted_at IS
   * NULL` and the trigger beside it takes an item's statements down with the
   * item. Without that pair this import fails, and it is a CORRECT import.
   *
   * NOTHING IN THE PRODUCT DELETES AN ITEM YET, so the tombstone is written here
   * exactly as the delete slice will write it: `deleted_at` on the item, and
   * nothing else. That is the point -- the delete slice inherits the rule rather
   * than having to know it.
   */
  it("writes a fresh item when the owner has deleted the one it first wrote", async () => {
    const identity = "http://127.0.0.1:9206";
    const first = await importProvidedRecord(db, {
      provider: wikiProvider(identity),
      record: TENTH_PLANET,
    });

    await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, first.itemId));

    const second = await importProvidedRecord(db, {
      provider: wikiProvider(identity),
      record: TENTH_PLANET,
    });

    expect(second.itemId).not.toBe(first.itemId);
    expect((await readItem(db, second.itemId))?.title).toBe(TENTH_PLANET.title);
  });
});

/**
 * TWO IMPORTS OF ONE RECORD, GENUINELY AT ONCE (CNCORE-31).
 *
 * The barrier is what makes this a race rather than two imports that happened to
 * run in turn. A third transaction holds `statements` locked, so whichever
 * import gets furthest parks before it can write a statement and cannot commit;
 * only once BOTH are blocked is the lock released and both allowed to finish.
 * Without it the two would very likely run end to end and the test would assert
 * nothing.
 *
 * `EXCLUSIVE` rather than `ACCESS EXCLUSIVE`, deliberately: it blocks writes and
 * allows plain `SELECT`, so an import still reaches and completes the find that
 * the race is about.
 */
async function whileStatementsAreHeld<T>(run: () => Promise<T>): Promise<T> {
  const holder = await connect();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const holding = holder.transaction(async (tx) => {
    await tx.execute(sql`lock table "statements" in exclusive mode`);
    await held;
  });

  const running = run();
  // The race is awaited below; this only stops a failure inside it reading as an
  // unhandled rejection during the wait.
  running.catch(() => {});
  try {
    await whenBothRacersAreBlocked();
  } finally {
    release();
    await holding;
  }
  return running;
}

/**
 * Waits until BOTH racers are stuck on a lock, so the race is joined before the
 * barrier lifts. `fileParallelism: false` is what makes the count honest: no
 * other suite is writing to this database.
 */
async function whenBothRacersAreBlocked(): Promise<void> {
  const both = 2;
  for (let attempt = 0; attempt < 200; attempt++) {
    const { rows } = await db.execute<{ blocked: string }>(
      sql`select count(*) as blocked from pg_stat_activity
          where datname = current_database() and wait_event_type = 'Lock'`,
    );
    if (Number(rows[0]?.blocked ?? 0) >= both) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`waited for ${both} blocked backends and never saw them`);
}

describe("two imports of one record at once", () => {
  /**
   * ONE ITEM, WHICHEVER WAY THE RACE FALLS. Two things hold it, and the ticket
   * only knew about one.
   *
   * THE INDEX (migration 5) is the guarantee: one source's own id names one
   * item, refused by the database rather than by whoever is writing.
   *
   * AND THE IMPORTS CANNOT ACTUALLY OVERLAP PAST THE FIND, which is the finding
   * this test exists to pin down. `providerSource` REWRITES the source row on
   * every import, so that a revised licence cannot go stale (CNCORE-8) -- and two
   * imports from one provider update ONE row, so the second waits on the first's
   * transaction before it ever looks for the item. MEASURED here, not reasoned:
   * with `statements` held, the racers park on `insert into "statements"`
   * (`Lock/relation`) and on `update "sources" set "attribution_notice"`
   * (`Lock/transactionid`) respectively. By the time the loser looks, the winner
   * has committed, so it FINDS the item and refreshes it rather than losing.
   *
   * SO THERE IS NO LOUD FAILURE TO ASSERT HERE, and that is a better outcome
   * than the ticket asked for rather than a missing one: the refusal is asserted
   * in `constraints.test.ts`, where a write that really does put one source's
   * id on a second item is named and refused. What this test holds is that the accident and the
   * guarantee agree -- because the accident is one optimisation away from going.
   */
  it("writes one item, and both imports answer with it", async () => {
    const identity = "http://127.0.0.1:9210";
    // The provider's source row first: two imports that both had to CREATE it
    // would collide on the global source order instead, which is a different
    // rule and would hide this one.
    await importProvidedRecord(db, {
      provider: wikiProvider(identity),
      record: { externalId: "warm", title: "Warming the source row", released: [] },
    });

    // Two handles, so the two imports are two connections rather than two turns
    // on one.
    const one = await connect();
    const other = await connect();
    const [first, second] = await whileStatementsAreHeld(() =>
      Promise.all([
        importProvidedRecord(one, { provider: wikiProvider(identity), record: TENTH_PLANET }),
        importProvidedRecord(other, { provider: wikiProvider(identity), record: TENTH_PLANET }),
      ]),
    );

    expect(second.itemId).toBe(first.itemId);
    // And one item carries the mapping, which is the claim that matters: the
    // pair of answers agreeing would mean nothing if a second item existed
    // beside them holding the same id.
    const mapped = await db
      .select({ itemId: statements.subjectItemId })
      .from(statements)
      .innerJoin(properties, eq(properties.id, statements.propertyId))
      .innerJoin(sources, eq(sources.id, statements.sourceId))
      .where(
        and(
          eq(properties.name, "external_id"),
          eq(statements.valueLiteral, TENTH_PLANET.externalId),
          eq(sources.identity, identity),
          isNull(statements.deletedAt),
        ),
      );
    expect(mapped.map((claim) => claim.itemId)).toEqual([first.itemId]);
  }, 30000);
});

describe("the provider as a source", () => {
  /**
   * ADR-0025: ONE global source order for the whole instance. The owner sits
   * first and is seeded by migration 1, so a provider arriving later takes the
   * next place rather than competing for one.
   */
  it("registers the provider behind the owner in the global source order", async () => {
    await importProvidedRecord(db, {
      provider: wikiProvider("http://127.0.0.1:9001"),
      record: TENTH_PLANET,
    });

    const [provider] = await db
      .select()
      .from(sources)
      .where(and(eq(sources.kind, "provider"), eq(sources.identity, "http://127.0.0.1:9001")));
    const [owner] = await db.select().from(sources).where(eq(sources.kind, "owner"));

    expect(provider).toBeDefined();
    expect(owner).toBeDefined();
    expect(provider?.sourceOrder).toBeGreaterThan(owner?.sourceOrder ?? 0);
  });

  /**
   * A second import from the same provider is the SAME source, not a second
   * one. `sources_identity` would refuse the duplicate outright, so getting
   * this wrong is a crash rather than a quiet split -- but the reason to reuse
   * it is that provenance is about who said it, and that is one party.
   */
  it("reuses the provider's source row on a later import", async () => {
    const identity = "http://127.0.0.1:9002";

    const first = await importProvidedRecord(db, {
      provider: wikiProvider(identity),
      record: TENTH_PLANET,
    });
    const second = await importProvidedRecord(db, {
      provider: wikiProvider(identity),
      record: { externalId: "266", title: "The Power of the Daleks (TV story)", released: [] },
    });

    expect(first.itemId).not.toBe(second.itemId);
    const rows = await db
      .select()
      .from(sources)
      .where(and(eq(sources.kind, "provider"), eq(sources.identity, identity)));
    expect(rows).toHaveLength(1);
  });
});

describe("an import that cannot finish", () => {
  /**
   * ONE TRANSACTION. A half-imported item -- a row with no title statement --
   * renders as "Untitled item" forever and reads as a catalogue entry the owner
   * made rather than as an import that failed.
   *
   * The failure is a REAL refusal by a real constraint rather than an injected
   * one: a statement with neither a literal nor an item value trips
   * `statements_one_value`, which is migration 1's, and it fires after the item
   * row has already been written.
   */
  it("leaves nothing behind when a statement cannot be written", async () => {
    const before = await db.select({ id: items.id }).from(items);

    const refused = await refusal(
      importProvidedRecord(db, {
        provider: wikiProvider("http://127.0.0.1:9003"),
        record: { externalId: "1", title: null as unknown as string, released: [] },
      }),
    );

    expect(refused).toBe("statements_one_value");
    const after = await db.select({ id: items.id }).from(items);
    expect(after).toHaveLength(before.length);
  });
});

/**
 * ADR-0057's fixture container, `Category:Vashta Nerada audio stories` (388305),
 * in the terms the catalogue writes rather than in CMPP's.
 *
 * NIGHT AND DAY SHARE POSITION 1, which is real archive data and not a
 * contrived case: two halves of one box set, both dated 2017-07-27, and the
 * archive asserts no order between them. ADR-0009 has no unique constraint on
 * (container, position) for exactly this.
 */
const NIGHT = {
  externalId: "222467",
  title: "Night of the Vashta Nerada (audio story)",
  released: ["2017-07-27"],
};
const DAY = {
  externalId: "222478",
  title: "Day of the Vashta Nerada (audio story)",
  released: ["2017-07-27"],
};
/**
 * Operation Dusk carries no release date at all, so the archive's own ordering
 * -- which is release order -- cannot place it. 2,199 of the archive's 12,791
 * stories are like it, a sixth of them, so this is ordinary rather than an edge
 * case.
 */
const OPERATION_DUSK = {
  externalId: "355593",
  title: "Operation Dusk (audio story)",
  released: [],
};
const VASHTA_NERADA = {
  container: {
    externalId: "388305",
    title: "Category:Vashta Nerada audio stories",
    released: [],
  },
  ordering: [
    { position: 1, record: NIGHT },
    { position: 1, record: DAY },
  ],
  unplaced: [],
};

/**
 * Every member of a container, with its position and the source that said so.
 *
 * IT HONOURS BOTH TOMBSTONES, as `findPlacementsOfItem` and `spokesmanFor` do
 * (ADR-0075): a placement a source has withdrawn is gone to every reader, and so
 * is the withdrawn claim itself. A helper that still showed them would report an
 * ordering no page renders.
 */
async function membersOf(containerId: string) {
  return db
    .select({
      itemId: placements.itemId,
      title: items.title,
      position: placements.position,
      sourceIdentity: sources.identity,
    })
    .from(placements)
    .innerJoin(items, eq(items.id, placements.itemId))
    .innerJoin(placementSources, eq(placementSources.placementId, placements.id))
    .innerJoin(sources, eq(sources.id, placementSources.sourceId))
    .where(
      and(
        eq(placements.containerId, containerId),
        isNull(placements.deletedAt),
        isNull(placementSources.deletedAt),
      ),
    )
    .orderBy(placements.position, items.title);
}

describe("importing a container and its ordering", () => {
  it("writes the container as an ordered container", async () => {
    // ADR-0004: containers fold into `work`, and there is no collection kind.
    // ADR-0009: `is_ordered` is STORED rather than inferred from having members,
    // and browse returns an ORDERING, so this container has one.
    const { containerId } = await importBrowsedContainer(db, {
      provider: wikiProvider("http://127.0.0.1:9101"),
      browsed: VASHTA_NERADA,
    });

    expect(await readItem(db, containerId)).toMatchObject({
      kind: "work",
      isContainer: true,
      isOrdered: true,
      title: "Category:Vashta Nerada audio stories",
    });
  });

  it("places every member at the position the provider gave it", async () => {
    const { containerId } = await importBrowsedContainer(db, {
      provider: wikiProvider("http://127.0.0.1:9102"),
      browsed: VASHTA_NERADA,
    });

    expect(await membersOf(containerId)).toMatchObject([
      { title: DAY.title, position: 1 },
      { title: NIGHT.title, position: 1 },
    ]);
  });

  /**
   * ADR-0017. An ordering is a DATED CLAIM BY A NAMED SOURCE rather than a
   * neutral fact, and a placement written without one is a claim nobody made --
   * which no later slice can reconstruct. Disney+ revised its own MCU
   * chronology in August 2025, and without the source that revision is
   * indistinguishable from the owner having reordered it by hand.
   */
  it("records the provider as having asserted every placement", async () => {
    const identity = "http://127.0.0.1:9103";

    const { containerId } = await importBrowsedContainer(db, {
      provider: wikiProvider(identity),
      browsed: VASHTA_NERADA,
    });

    const members = await membersOf(containerId);
    expect(members).toHaveLength(2);
    for (const member of members) {
      expect(member.sourceIdentity).toBe(identity);
    }
  });

  /**
   * ADR-0009 has no unique constraint on (container, position) for exactly
   * this, and here it is doing its job on real data: two halves of one box set
   * the archive dates the same day. A container that renumbered them would be
   * asserting an order its source never gave.
   */
  it("keeps two members at one position rather than inventing an order", async () => {
    const { containerId } = await importBrowsedContainer(db, {
      provider: wikiProvider("http://127.0.0.1:9104"),
      browsed: VASHTA_NERADA,
    });

    const positions = (await membersOf(containerId)).map((member) => member.position);
    expect(positions).toEqual([1, 1]);
  });

  /**
   * ADR-0077. Work-browsing is `kind = 'work' AND (NOT is_container OR
   * holds_work)`, and the flag is maintained by a trigger on `placements` --
   * so a bulk import has to turn it on for the container it just filled, or
   * every browsed container is invisible to the surface that asks the question.
   */
  it("leaves the container holding a work", async () => {
    const { containerId } = await importBrowsedContainer(db, {
      provider: wikiProvider("http://127.0.0.1:9105"),
      browsed: VASHTA_NERADA,
    });

    expect(await readItem(db, containerId)).toMatchObject({ holdsWork: true });
  });

  /**
   * ADR-0009: DUPLICATES ARE ALLOWED, and the word for one is a REPEAT
   * (CONTEXT.md) -- the same item twice in one container, at two positions, on
   * purpose, for recaps and bookends.
   *
   * A bulk import that could not express one would break that rule silently,
   * because the failure looks like success: two items, each placed once, with
   * the same title. The wiki's own categories cannot produce this -- a page is a
   * member of a category once -- but CMPP does not forbid it and an ordering
   * with a recap in it is exactly what ADR-0009 says the model is for.
   */
  it("places one record twice as a REPEAT, rather than as two items", async () => {
    const { containerId, members } = await importBrowsedContainer(db, {
      provider: wikiProvider("http://127.0.0.1:9107"),
      browsed: {
        ...VASHTA_NERADA,
        ordering: [
          { position: 1, record: NIGHT },
          { position: 2, record: DAY },
          // The recap: the same record the provider already placed at 1.
          { position: 3, record: NIGHT },
        ],
      },
    });

    expect(new Set(members.map((member) => member.itemId)).size).toBe(2);
    expect(await membersOf(containerId)).toMatchObject([
      { title: NIGHT.title, position: 1 },
      { title: DAY.title, position: 2 },
      { title: NIGHT.title, position: 3 },
    ]);
  });

  /**
   * THE SAME HOLE ONE LAYER DOWN, and finding the container again is what opens
   * it. A second browse used to write a whole new container, so nothing ever met
   * an ordering it had claimed before; now it lands on the one it wrote, and a
   * provider that has MOVED a member is claiming two positions for it at once.
   *
   * `assertPlacement` matches on position, so the new position is a new
   * placement and the old one keeps this source standing behind it. Nothing at
   * read time can resolve that: `findPlacementsOfItem` orders by rank, then the
   * global source order, then position, so one source ties with itself on the
   * first two terms and BOTH rows are answered. The page lists the container
   * twice -- a REPEAT (ADR-0009) invented by a re-browse, which is a real shape
   * used for recaps and so cannot be told apart from one the provider meant.
   */
  it("moves a member the provider has re-positioned, rather than claiming both places", async () => {
    const identity = "http://127.0.0.1:9110";
    const ordering = (position: number) => ({
      ...VASHTA_NERADA,
      ordering: [
        { position: 1, record: NIGHT },
        { position, record: DAY },
      ],
    });

    const { containerId } = await importBrowsedContainer(db, {
      provider: wikiProvider(identity),
      browsed: ordering(2),
    });
    await importBrowsedContainer(db, {
      provider: wikiProvider(identity),
      browsed: ordering(3),
    });

    expect(await membersOf(containerId)).toMatchObject([
      { title: NIGHT.title, position: 1 },
      { title: DAY.title, position: 3 },
    ]);
  });

  /**
   * THE SAME FACT, not a second feature: an ordering that no longer holds a
   * story has stopped claiming it, exactly as one that moved it has stopped
   * claiming where it was. Left standing, the container would keep a member the
   * provider has removed and no later browse could ever take it out.
   *
   * AND THE ITEM ITSELF SURVIVES. What the provider withdrew is the MEMBERSHIP,
   * not the story: it may sit in other orderings, and the owner may have placed
   * it by hand.
   */
  it("drops a member the provider no longer holds, keeping the item itself", async () => {
    const identity = "http://127.0.0.1:9111";

    const first = await importBrowsedContainer(db, {
      provider: wikiProvider(identity),
      browsed: VASHTA_NERADA,
    });
    const day = first.members.find((member) => member.itemId !== first.members[0]?.itemId);

    await importBrowsedContainer(db, {
      provider: wikiProvider(identity),
      browsed: { ...VASHTA_NERADA, ordering: [{ position: 1, record: NIGHT }] },
    });

    expect(await membersOf(first.containerId)).toMatchObject([{ title: NIGHT.title, position: 1 }]);
    expect(day).toBeDefined();
    expect(await readItem(db, day?.itemId ?? "")).toMatchObject({ title: DAY.title });
  });

  /**
   * A HOLE FINDING THE ITEM AGAIN OPENS, and so this ticket's to close. Both
   * operations take a provider's own id and the owner supplies it by hand
   * (ADR-0033), so nothing stops them supplying one container's id to `import`
   * and then to `browse` -- and the browse now finds the item the lookup wrote
   * rather than minting its own.
   *
   * ADR-0009 makes `is_container` STORED rather than inferred from having
   * members, which is what makes this a defect instead of a cosmetic flag: an
   * item left holding members with the flag off is a container to every write
   * path and a plain work to every read, and work-browsing offers it as
   * something to watch (ADR-0077).
   *
   * IT ONLY EVER TURNS THEM ON. A `lookup` that answers a record says nothing
   * about members, so it is not evidence that a container has stopped being one.
   */
  it("makes a container of an item it first imported as a plain record", async () => {
    const identity = "http://127.0.0.1:9109";

    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider(identity),
      record: VASHTA_NERADA.container,
    });
    expect(await readItem(db, itemId)).toMatchObject({ isContainer: false, isOrdered: false });

    const { containerId } = await importBrowsedContainer(db, {
      provider: wikiProvider(identity),
      browsed: VASHTA_NERADA,
    });

    expect(containerId).toBe(itemId);
    expect(await readItem(db, containerId)).toMatchObject({ isContainer: true, isOrdered: true });
  });

  /**
   * THE DEFECT A PERSON MEETS, and the reason CNCORE-28 could not wait for the
   * matching operation. `browse` is the BULK path: one call imports a container
   * and every member of it, so a second click of one button used to write a
   * second container and a second copy of all of them, with their own
   * placements, and nothing in the app said so.
   *
   * The placements need nothing new for this -- `assertPlacement` already finds
   * or creates, and a source asserting one twice adds nothing (ADR-0017). What
   * was missing was the item: a fresh one per browse meant every placement was
   * about a different item and there was nothing for that rule to find.
   */
  it("adds no items and no placements on a second browse of one container", async () => {
    const identity = "http://127.0.0.1:9108";
    const browsed = { ...VASHTA_NERADA, unplaced: [OPERATION_DUSK] };

    const first = await importBrowsedContainer(db, { provider: wikiProvider(identity), browsed });
    const itemsBefore = await db.select({ id: items.id }).from(items);
    const placementsBefore = await db.select({ id: placements.id }).from(placements);

    const second = await importBrowsedContainer(db, { provider: wikiProvider(identity), browsed });

    expect(second.containerId).toBe(first.containerId);
    // The same placements, not merely the same number of them: a browse that
    // wrote fresh rows and answered with those would pass a count.
    expect(second.members).toEqual(first.members);
    expect(await db.select({ id: items.id }).from(items)).toHaveLength(itemsBefore.length);
    expect(await db.select({ id: placements.id }).from(placements)).toHaveLength(
      placementsBefore.length,
    );
  });

  /**
   * A MEMBER WITH NO POSITION IS STILL A MEMBER. Dropping Operation Dusk would
   * shrink the container silently, and positioning it last would assert it came
   * out after everything else -- which the archive never said. So it is placed,
   * and its position is left unasserted, because the source asserted none.
   */
  it("keeps a member the source cannot place, rather than dropping it or inventing a place", async () => {
    const { containerId } = await importBrowsedContainer(db, {
      provider: wikiProvider("http://127.0.0.1:9106"),
      browsed: { ...VASHTA_NERADA, unplaced: [OPERATION_DUSK] },
    });

    expect(await membersOf(containerId)).toMatchObject([
      { title: DAY.title, position: 1 },
      { title: NIGHT.title, position: 1 },
      { title: OPERATION_DUSK.title, position: null },
    ]);
  });
});

/**
 * CNCORE-29. ADR-0073 says a date is an EDTF string, and until now nothing
 * checked it: the wire schema is `z.array(z.string())`, so `soon` was written as
 * a `released` statement and rendered on the page verbatim. That made the
 * record's claim describe what the catalogue WRITES rather than what it ACCEPTS.
 *
 * THE POSTURE IS ADR-0030'S: take it, mark it, do not silently treat it as good.
 * Refusing the record would lose the rest of what the provider said over one bad
 * string, and dropping the date would leave nothing recording that a provider
 * sent it -- so the value is kept, carrying the provider that said it, and held
 * apart from the live set exactly as a broken vocabulary value is.
 */
describe("a date that is not EDTF", () => {
  it("keeps the value and marks it, rather than storing it as a date", async () => {
    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider("http://127.0.0.1:9401"),
      record: { externalId: "9401", title: "Coming Soon", released: ["soon"] },
    });

    expect(await claimsAbout(itemId)).toContainEqual(
      expect.objectContaining({ property: "released", value: "soon", quarantined: true }),
    );
  });

  /**
   * "DOES NOT SILENTLY BECOME A STATEMENT" HAS TWO HALVES, and the mark is only
   * one of them. A browse that quarantined forty of sixty dates and answered
   * exactly as a clean one does has still told the caller nothing -- so the
   * operation reports what it held back, and a surface that wants to say so has
   * a number to say it with.
   *
   * A COUNT RATHER THAN THE VALUES. The rows are in the catalogue carrying the
   * provider that said them, so "which ones" is a question the store already
   * answers; what the caller cannot recover afterwards is that this import was
   * the one that wrote them.
   */
  it("answers with how many values it held back", async () => {
    const clean = await importProvidedRecord(db, {
      provider: wikiProvider("http://127.0.0.1:9404"),
      record: TENTH_PLANET,
    });
    expect(clean.quarantinedValues).toBe(0);

    const dirty = await importProvidedRecord(db, {
      provider: wikiProvider("http://127.0.0.1:9405"),
      record: {
        externalId: "9405",
        title: "Two bad, one good",
        released: ["soon", "12/03/66", "1966-10-08"],
      },
    });
    expect(dirty.quarantinedValues).toBe(2);
  });

  /**
   * A COUNT OF WHAT THIS IMPORT HELD BACK, not of what it newly inserted.
   *
   * The difference only shows on the SECOND import, and it is the difference
   * between the field doing its job and reporting the exact opposite. A refresh
   * re-asserts values it already holds without writing them again, so a count of
   * fresh rows answers 0 -- and a second browse of a container full of bad dates
   * would report precisely what a clean one reports, which is the "silently"
   * this whole ticket refuses.
   */
  it("reports a bad date again on a refresh, rather than reporting a clean import", async () => {
    const provider = wikiProvider("http://127.0.0.1:9407");
    const record = { externalId: "9407", title: "Still undated", released: ["soon", "1966"] };

    expect((await importProvidedRecord(db, { provider, record })).quarantinedValues).toBe(1);
    expect((await importProvidedRecord(db, { provider, record })).quarantinedValues).toBe(1);
  });

  /**
   * MIGRATION 6 BACKFILLS NOTHING, and it cannot: the check is an EDTF parse and
   * SQL has no such thing. So a `released` row written before this slice sits
   * unmarked and readable, and the refresh is what reaches it -- a value the
   * provider still claims is re-checked rather than assumed good because it
   * happens to be there already.
   *
   * The un-marking below is what such a row looks like: the same value, still
   * claimed by the same source, with the flag off.
   */
  it("marks a value it already holds but has never checked", async () => {
    const provider = wikiProvider("http://127.0.0.1:9408");
    const record = { externalId: "9408", title: "Written before the check", released: ["soon"] };
    const { itemId } = await importProvidedRecord(db, { provider, record });

    await db
      .update(statements)
      .set({ quarantined: false })
      .where(and(eq(statements.subjectItemId, itemId), isNull(statements.deletedAt)));

    const refreshed = await importProvidedRecord(db, { provider, record });

    expect(refreshed.quarantinedValues).toBe(1);
    expect(await claimsAbout(itemId)).toContainEqual(
      expect.objectContaining({ property: "released", value: "soon", quarantined: true }),
    );
  });

  /**
   * WHICH PROPERTIES ARE CHECKED IS A QUESTION FOR THE CATALOGUE (CNCORE-47).
   * ADR-0012 names validation among what the properties catalogue declares and
   * makes "the metadata catalogue lives in the DATABASE rather than in code" the
   * test of the whole model; `properties.validation` is the column it means.
   *
   * THIS IS WHAT PROVES THE COLUMN IS READ rather than decorative. Withdraw the
   * declaration and the same string the import held back a moment ago is written
   * as an ordinary claim -- which no call-site callback can be made to do.
   */
  it("stops holding a value back when the catalogue withdraws the declaration", async () => {
    const provider = wikiProvider("http://127.0.0.1:9420");
    const record = { externalId: "9420", title: "Undeclared", released: ["soon"] };

    await declaring("released", {}, async () => {
      const { itemId, quarantinedValues } = await importProvidedRecord(db, { provider, record });

      expect(quarantinedValues).toBe(0);
      expect(await claimsAbout(itemId)).toContainEqual(
        expect.objectContaining({ property: "released", value: "soon", quarantined: false }),
      );
    });
  });

  /**
   * AND THE DECLARATION CARRIES THE RULE'S PARAMETERS, not only its name. The
   * EDTF ceiling was `HIGHEST_LEVEL_ACCEPTED = 1`, a constant beside the parser,
   * and ADR-0073's argument for that 1 is a fact about `released` rather than
   * about EDTF: the property is `multiple` (migration 1), so a Level 2 set says
   * in one string what two statements already say. A property whose cardinality
   * were `single` could want a different ceiling.
   *
   * `1984?` is the case that shows the number is READ. It is a Level 1
   * qualifier ADR-0073 names as a real value, so it passes under the ceiling
   * migration 7 declares and fails under a lower one.
   */
  it("checks against the level the catalogue declares, not one held in code", async () => {
    const provider = wikiProvider("http://127.0.0.1:9421");
    const record = { externalId: "9421", title: "Perhaps 1984", released: ["1984?"] };

    await declaring("released", { format: "edtf", level: 0 }, async () => {
      const { itemId, quarantinedValues } = await importProvidedRecord(db, { provider, record });

      expect(quarantinedValues).toBe(1);
      expect(await claimsAbout(itemId)).toContainEqual(
        expect.objectContaining({ property: "released", value: "1984?", quarantined: true }),
      );
    });
  });

  /**
   * AND A LOOSENED RULE RELEASES WHAT IT HELD BACK, which is what makes
   * `validation` EDITABLE rather than merely unfrozen.
   *
   * ADR-0015 freezes `datatype`, `value_kind` and `reference_target` with a
   * trigger and deliberately leaves the rest editable, because "start loose,
   * tighten afterwards" is what the products it studied all support -- and
   * tightening never rejects a row that is already here, it marks it as an
   * offender and lets you list it. `quarantined` is this catalogue's offender
   * mark, so the two halves have to move together: a mark that could be added
   * and never removed would outlive the rule that justified it, and the
   * catalogue would be holding back values its own declaration now admits.
   *
   * THE REFRESH IS THE DOOR, exactly as it is for a row written before a check
   * existed (ADR-0073). Nothing sweeps, because a re-check needs an EDTF parse
   * and SQL has none; what a provider still claims is what gets looked at again.
   */
  it("releases a value a loosened rule now admits", async () => {
    const provider = wikiProvider("http://127.0.0.1:9422");
    const record = { externalId: "9422", title: "Perhaps 1984, again", released: ["1984?"] };

    await declaring("released", { format: "edtf", level: 0 }, async () => {
      const held = await importProvidedRecord(db, { provider, record });
      expect(held.quarantinedValues).toBe(1);
    });

    // Back at the ceiling migration 7 declares, which admits a Level 1 qualifier.
    const { itemId, quarantinedValues } = await importProvidedRecord(db, { provider, record });

    expect(quarantinedValues).toBe(0);
    expect(await claimsAbout(itemId)).toContainEqual(
      expect.objectContaining({ property: "released", value: "1984?", quarantined: false }),
    );
  });

  /**
   * AND A DECLARATION THE CATALOGUE CANNOT EXECUTE STOPS THE IMPORT, rather
   * than being read as "no check" and letting everything through.
   *
   * That silent reading is the exact state CNCORE-47 was filed about -- a column
   * that looks like a check from outside and behaves like nothing -- so it must
   * not be reachable by writing a format into the column. Only the product adds
   * a property (ADR-0029), so this can only be a bug in a migration, and
   * `validation.test.ts` walks the seeded catalogue so one cannot ship. This is
   * what happens if one ever did.
   *
   * NOTHING IS HALF-WRITTEN. The import is ONE TRANSACTION for the reason the
   * function's own comment gives: a half-imported item is a row with no title
   * statement, which renders as "Untitled item" forever and reads like something
   * the owner made. A refusal raised while reading the catalogue is inside it.
   */
  it("refuses the import outright when a declaration names a check it cannot run", async () => {
    const provider = wikiProvider("http://127.0.0.1:9423");
    const record = { externalId: "9423", title: "Unrunnable", released: ["1966-10-08"] };

    await declaring("released", { format: "iso8601" }, async () => {
      await expect(importProvidedRecord(db, { provider, record })).rejects.toThrow(
        /property released declares a validation the catalogue cannot execute/,
      );

      expect(await db.select().from(items).where(eq(items.title, record.title))).toEqual([]);
    });
  });

  it("counts what a whole browsed container held back, across its members", async () => {
    const { quarantinedValues } = await importBrowsedContainer(db, {
      provider: wikiProvider("http://127.0.0.1:9406"),
      browsed: {
        container: { externalId: "9406", title: "Category:Dated badly", released: ["shortly"] },
        ordering: [
          { position: 1, record: NIGHT },
          { position: 2, record: { externalId: "9406-2", title: "One", released: ["soon"] } },
        ],
        unplaced: [{ externalId: "9406-3", title: "Two", released: ["12/03/66", "1999"] }],
      },
    });

    // The container's own bad date counts too: a container is a record like any
    // other (ADR-0004), so its claims are checked at the same door.
    expect(quarantinedValues).toBe(3);
  });

  /**
   * THE WHOLE REASON THIS LANDS AT THE BULK PATH. Under `lookup` a bad date is
   * one row an owner can see and delete; `browse` writes a container's worth at
   * once, so refusing the import over one string would cost a category of sixty
   * stories to save one field of one of them.
   */
  it("keeps the rest of a browsed container when one member's date is not EDTF", async () => {
    const { containerId, members } = await importBrowsedContainer(db, {
      provider: wikiProvider("http://127.0.0.1:9403"),
      browsed: {
        container: { externalId: "9403", title: "Category:Dated badly", released: [] },
        ordering: [
          { position: 1, record: NIGHT },
          { position: 2, record: { externalId: "9403-2", title: "Undatable", released: ["soon"] } },
          { position: 3, record: DAY },
        ],
        unplaced: [],
      },
    });

    expect(members).toHaveLength(3);
    expect((await membersOf(containerId)).map((member) => member.position)).toEqual([1, 2, 3]);

    // The two good dates are readable dates, and the bad one is held apart --
    // in one import, rather than the import being all good or all lost.
    const dates = async (itemId: string) =>
      (await claimsAbout(itemId))
        .filter((claim) => claim.property === "released")
        .map((claim) => ({ value: claim.value, quarantined: claim.quarantined }));

    const [night, undatable, day] = members;
    expect(await dates(night!.itemId)).toEqual([{ value: NIGHT.released[0], quarantined: false }]);
    expect(await dates(undatable!.itemId)).toEqual([{ value: "soon", quarantined: true }]);
    expect(await dates(day!.itemId)).toEqual([{ value: DAY.released[0], quarantined: false }]);
  });

  it("leaves a date that IS EDTF unmarked", async () => {
    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider("http://127.0.0.1:9402"),
      record: TENTH_PLANET,
    });

    expect(await claimsAbout(itemId)).toContainEqual(
      expect.objectContaining({ property: "released", value: "1966-10-08", quarantined: false }),
    );
  });
});

/**
 * ADR-0036: TMDB's terms end in termination, and termination "requires purging
 * all cached TMDB content". This is that, and the record's own claim about it is
 * that `source` on every row "already makes one delete" -- so what is under test
 * is that the claim is TRUE, not that a purge feature was built.
 *
 * IT IS A DELETE PER TABLE THAT CARRIES A SOURCE, plus the orphans that leaves.
 * An item is not "content from a provider" the way a statement is -- nothing on
 * the row names who made it -- so it goes only when nothing is left asserting
 * anything about it and nothing places it anywhere.
 */
describe("purging everything one provider ever said", () => {
  it("takes the statements, the placements and the source row together", async () => {
    const provider = tmdbProvider("http://127.0.0.1:9201");
    const { containerId, members } = await importBrowsedContainer(db, {
      provider,
      browsed: {
        container: { externalId: "collection:1", title: "A collection", released: [] },
        ordering: [{ position: 1, record: TENTH_PLANET }],
        unplaced: [],
      },
    });

    const purged = await purgeProvider(db, { identity: provider.identity });

    // FIVE STATEMENTS FOR TWO ITEMS: a title each, one `released`, and an
    // `external_id` each since CNCORE-28. The external id is the provider's claim
    // about its own id space like any other, so a purge that spared it would leave
    // a mapping pointing at a deleted item -- and the next import would find it.
    expect(purged).toMatchObject({ statements: 5, placements: 1, items: 2 });
    // The source row goes too, or the next import reuses a row whose attribution
    // belongs to a licence this instance is no longer operating under.
    const left = await db
      .select()
      .from(sources)
      .where(and(eq(sources.kind, "provider"), eq(sources.identity, provider.identity)));
    expect(left).toEqual([]);
    expect(await readItem(db, containerId)).toBeUndefined();
    expect(await readItem(db, members[0]?.itemId ?? "")).toBeUndefined();
  });

  /**
   * THE HALF THAT MAKES IT A PURGE RATHER THAN A TRUNCATE. Another source's
   * claims are another source's, and a provider whose licence ended has no
   * bearing on them -- so an item the owner also placed survives, carrying
   * whatever is left once the provider's own rows are gone.
   */
  it("leaves what another source said, and the item it said it about", async () => {
    const provider = tmdbProvider("http://127.0.0.1:9202");
    const { itemId } = await importProvidedRecord(db, { provider, record: TENTH_PLANET });

    // The owner's own hand, on the item the provider just imported.
    const ownersOrdering = await anItemTitled(db, "An ordering the owner keeps", {
      isContainer: true,
      isOrdered: true,
    });
    await aPlacement(db, {
      containerId: ownersOrdering,
      itemId,
      position: 1,
      sourceId: await ownerSource(db),
    });

    await purgeProvider(db, { identity: provider.identity });

    // The item stays, because the owner still places it somewhere. It has no
    // title any more, and that is the honest outcome rather than a defect: every
    // word it had was the provider's, and keeping those would be keeping the
    // content the purge exists to remove.
    const survivor = await readItem(db, itemId);
    expect(survivor).toBeDefined();
    expect(survivor?.title).toBeNull();
    expect(await readItem(db, ownersOrdering)).toBeDefined();
  });

  /**
   * THE SCOPE OF THE SWEEP, and the bug it is here for.
   *
   * A placement goes when the purged provider was the LAST source asserting it,
   * which reads naturally as "delete every placement nobody asserts" -- and that
   * is a sentence about the WHOLE CATALOGUE rather than about this provider. A
   * placement that was already source-less before the purge began is somebody
   * else's orphan, and sweeping it up here means the next provider purged carries
   * away rows it never touched, reporting a count of them as its own.
   *
   * Caught by the api suite, where the count came back 4 for a purge of 2.
   */
  it("leaves a source-less placement it never spoke for", async () => {
    const provider = tmdbProvider("http://127.0.0.1:9205");
    await importBrowsedContainer(db, {
      provider,
      browsed: {
        container: { externalId: "collection:5", title: "A collection", released: [] },
        ordering: [{ position: 1, record: TENTH_PLANET }],
        unplaced: [],
      },
    });

    // A placement nobody stands behind, made directly because nothing in the
    // public interface can make one: `assertPlacement` requires a source.
    const [orphan] = await db
      .insert(placements)
      .values({
        ownerId: await theOwnerIdForTest(),
        containerId: await anItemTitled(db, "A container nobody asserted into", {
          isContainer: true,
          isOrdered: true,
        }),
        itemId: await anItemTitled(db, "An item nobody asserted"),
        position: 1,
      })
      .returning({ id: placements.id });

    const purged = await purgeProvider(db, { identity: provider.identity });

    expect(purged.placements).toBe(1);
    const survivor = await db
      .select()
      .from(placements)
      .where(eq(placements.id, orphan?.id ?? ""));
    expect(survivor).toHaveLength(1);
  });

  /** A provider nobody ever imported from is not an error, it is nothing to do. */
  it("answers zero for a provider this catalogue never imported from", async () => {
    await expect(purgeProvider(db, { identity: "http://127.0.0.1:9999" })).resolves.toMatchObject({
      statements: 0,
      placements: 0,
      items: 0,
    });
  });
});

/**
 * ADR-0046 puts COUNTS SHOWN FIRST in front of a permanent delete, and a purge
 * is the delete where that matters most: it is the one an owner runs under time
 * pressure, after a termination notice, against a provider whose content they
 * can no longer inspect because the provider is unreachable.
 */
describe("previewing what a purge would take", () => {
  it("answers the counts, and takes nothing", async () => {
    const provider = tmdbProvider("http://127.0.0.1:9207");
    const { containerId, members } = await importBrowsedContainer(db, {
      provider,
      browsed: {
        container: { externalId: "collection:11", title: "A collection", released: [] },
        ordering: [{ position: 1, record: TENTH_PLANET }],
        unplaced: [],
      },
    });

    const preview = await previewProviderPurge(db, { identity: provider.identity });

    // The same five statements, one placement and two items the purge itself
    // reports for this shape of import.
    expect(preview).toMatchObject({ statements: 5, placements: 1, items: 2 });

    // AND EVERY ROW IS WHERE IT WAS. A preview an owner runs to decide whether
    // to purge must not be the purge. Rows rather than everything: the rollback
    // keeps the `change_sequence` values the traversal spent, which ADR-0046
    // records and nothing reads.
    expect(await readItem(db, containerId)).toBeDefined();
    expect(await readItem(db, members[0]?.itemId ?? "")).toBeDefined();
    const stillThere = await db
      .select()
      .from(sources)
      .where(and(eq(sources.kind, "provider"), eq(sources.identity, provider.identity)));
    expect(stillThere).toHaveLength(1);

    // AND SO THE TEST TAKES IT AWAY ITSELF. This suite's database outlives the
    // run: every other test in this describe is left idempotent by the purge it
    // is about, and a test whose whole point is that it purged NOTHING has to
    // clean up by hand or the next run counts this run's import too.
    await purgeProvider(db, { identity: provider.identity });
  });

  /**
   * THE ONE THAT MAKES THE PREVIEW WORTH HAVING, and the reason it is not a
   * second implementation.
   *
   * Every count here is a SUBSET rather than a total, and each is a different
   * subset for a different reason: a placement survives because somebody else
   * asserts it too (ADR-0017), an item survives because the owner places it, or
   * because it stands as the value of somebody else's claim, or because it is
   * the container end of a placement that survived. A preview built as its own
   * traversal would restate seven rules -- six `not exists` clauses on an item,
   * plus the last-claimant test on a placement -- and each is its own chance to
   * answer a number the delete then contradicts, which is worse than answering
   * nothing, since an owner deciding under a termination notice acted on it.
   */
  it("answers exactly what the delete then takes, where the two could differ", async () => {
    const provider = tmdbProvider("http://127.0.0.1:9208");
    const owner = await ownerSource(db);

    // THREE MEMBERS, because each one is about to survive or not for a
    // different reason, and one traversal has to get all three right.
    const { containerId, members } = await importBrowsedContainer(db, {
      provider,
      browsed: {
        container: { externalId: "collection:12", title: "A collection", released: [] },
        ordering: [
          { position: 1, record: TENTH_PLANET },
          {
            position: 2,
            record: { externalId: "266", title: "The Power of the Daleks", released: [] },
          },
          { position: 3, record: { externalId: "267", title: "The Highlanders", released: [] } },
        ],
        unplaced: [],
      },
    });
    const [coAsserted, placedByTheOwner, claimedByNobodyElse] = members;

    // ONE: THE OWNER STANDS BEHIND THE PROVIDER'S OWN PLACEMENT. The row has two
    // claimants, so losing one leaves it standing -- and its container end keeps
    // the collection alive with it.
    await db.insert(placementSources).values({
      ownerId: await theOwnerIdForTest(),
      placementId: coAsserted?.placementId ?? "",
      sourceId: owner,
    });

    // TWO: THE OWNER PLACES THE SECOND MEMBER SOMEWHERE OF THEIR OWN. The
    // provider's placement of it goes; the item does not.
    await aPlacement(db, {
      containerId: await anItemTitled(db, "An ordering the owner keeps", {
        isContainer: true,
        isOrdered: true,
      }),
      itemId: placedByTheOwner?.itemId ?? "",
      position: 1,
      sourceId: owner,
    });

    // THREE: AN ITEM THIS PROVIDER WROTE, STANDING AS THE VALUE OF THE OWNER'S
    // CLAIM. Nothing places it and the provider's own words about it all go, but
    // a delete would still be refused: `value_item_id` carries no cascade.
    const { itemId: theValue } = await importProvidedRecord(db, {
      provider,
      record: { externalId: "268", title: "The Underwater Menace", released: [] },
    });
    await aStatement(db, {
      subjectItemId: await anItemTitled(db, "A story the owner says is based on it"),
      property: "based_on",
      valueItemId: theValue,
      sourceId: owner,
    });

    const preview = await previewProviderPurge(db, { identity: provider.identity });
    const purged = await purgeProvider(db, { identity: provider.identity });

    // WHAT THIS CATCHES, stated because it is narrower than it looks: both calls
    // run one function, so there are no second predicates here that could drift
    // apart -- that is the point of the design and not something a test can
    // check. What it catches is a ROLLBACK THAT DID NOT HOLD, which would leave
    // the delete with less to do and these two disagreeing.
    expect(purged).toEqual(preview);

    // And the numbers themselves, which are what pins the traversal down: of the
    // five items this provider touched exactly one goes, and of the three
    // placements it spoke for exactly two.
    expect(preview).toEqual({ statements: 11, placements: 2, items: 1 });
    expect(await readItem(db, containerId)).toBeDefined();
    expect(await readItem(db, coAsserted?.itemId ?? "")).toBeDefined();
    expect(await readItem(db, placedByTheOwner?.itemId ?? "")).toBeDefined();
    expect(await readItem(db, theValue)).toBeDefined();
    expect(await readItem(db, claimedByNobodyElse?.itemId ?? "")).toBeUndefined();
  });
});

/**
 * ADR-0036: the notice must be "placed prominently in or on Your Application",
 * and TMDB's mark shown. So the page rendering a source's claims is where the
 * obligation falls due, and the read path has to be able to answer WHICH
 * obligations one item incurs.
 *
 * READ OFF THE CLAIMS RATHER THAN LISTED SOMEWHERE. An item owes TMDB a notice
 * because a TMDB statement or a TMDB placement is on it, so the answer is a join
 * from what is actually displayed -- and it stops being owed the moment the last
 * of those rows goes, with nothing to remember to update.
 */
describe("which attribution one item's page owes", () => {
  it("names the source whose claims the page is about to show", async () => {
    const provider = tmdbProvider("http://127.0.0.1:9301");
    const { itemId } = await importProvidedRecord(db, { provider, record: TENTH_PLANET });

    await expect(findAttributionOwed(db, itemId)).resolves.toEqual([
      {
        sourceLabel: "provider-tmdb",
        notice: provider.attribution.notice,
        logo: { dataUri: provider.attribution.logo.data_uri, alt: provider.attribution.logo.alt },
      },
    ]);
  });

  /** A source that owes nothing is not listed, rather than listed with nulls. */
  it("says nothing for an item whose sources oblige nothing", async () => {
    const { itemId } = await importProvidedRecord(db, {
      provider: wikiProvider("http://127.0.0.1:9302"),
      record: TENTH_PLANET,
    });

    await expect(findAttributionOwed(db, itemId)).resolves.toEqual([]);
  });

  /**
   * A PLACEMENT INCURS IT AS MUCH AS A STATEMENT DOES. An ordering is a claim by
   * a named source (ADR-0017), and a page listing "also appears in" is showing
   * that source's work -- so an item TMDB placed but said nothing else about
   * still owes TMDB its notice.
   */
  it("owes it for an ordering too, not only for a value", async () => {
    const provider = tmdbProvider("http://127.0.0.1:9303");
    const { members } = await importBrowsedContainer(db, {
      provider,
      browsed: {
        container: { externalId: "collection:9", title: "A collection", released: [] },
        ordering: [{ position: 1, record: TENTH_PLANET }],
        unplaced: [],
      },
    });

    const owed = await findAttributionOwed(db, members[0]?.itemId ?? "");
    expect(owed.map((o) => o.sourceLabel)).toEqual(["provider-tmdb"]);
  });

  /**
   * THE CONTAINER'S TITLE IS A CLAIM TOO, and it is the one the first draft of
   * this query missed. The page prints `containerTitle` for every ordering the
   * item sits in, so an item the OWNER wrote, hand-placed into a container a
   * provider browsed into existence, is a page showing that provider's words --
   * and owing its notice -- while the item's own claims are the owner's alone.
   *
   * The rule: every source whose words appear on the page is owed, so this query
   * has to track what the page actually renders.
   */
  it("owes it for a container's title, even when the item's own claims are not that source's", async () => {
    const provider = tmdbProvider("http://127.0.0.1:9305");
    const { containerId } = await importBrowsedContainer(db, {
      provider,
      browsed: {
        container: { externalId: "collection:7", title: "A collection TMDB titled", released: [] },
        ordering: [],
        unplaced: [],
      },
    });

    // The owner's own item, and the owner's own hand placing it in that container.
    const owned = await anItemTitled(db, "An item the owner wrote");
    await aPlacement(db, {
      containerId,
      itemId: owned,
      position: 1,
      sourceId: await ownerSource(db),
    });

    const owed = await findAttributionOwed(db, owned);
    expect(owed.map((o) => o.sourceLabel)).toEqual(["provider-tmdb"]);
  });

  /** And it stops being owed once the claims that incurred it are purged. */
  it("stops being owed when the claims that incurred it are gone", async () => {
    const provider = tmdbProvider("http://127.0.0.1:9304");
    const { itemId } = await importProvidedRecord(db, { provider, record: TENTH_PLANET });
    const ownersOrdering = await anItemTitled(db, "An ordering kept by hand", {
      isContainer: true,
      isOrdered: true,
    });
    await aPlacement(db, {
      containerId: ownersOrdering,
      itemId,
      position: 1,
      sourceId: await ownerSource(db),
    });

    await purgeProvider(db, { identity: provider.identity });

    await expect(findAttributionOwed(db, itemId)).resolves.toEqual([]);
  });
});

/** The single owner row (ADR-0044), for the one test that writes a raw placement. */
async function theOwnerIdForTest(): Promise<string> {
  const [owner] = await db.select({ id: owners.id }).from(owners);
  if (!owner) throw new Error("migration 1 seeds one owner row");
  return owner.id;
}
