import { eq, sql } from "drizzle-orm";
import { inject } from "vitest";

import "./provided";

import {
  createDb,
  type Database,
  items,
  owners,
  placementSources,
  placements,
  properties,
  sources,
  statements,
} from "../index";

/**
 * Helpers for reaching the catalogue in tests. They go through the package's
 * own export rather than raw SQL, so a test cannot pass against a shape the
 * package does not actually publish.
 */
export async function connect(): Promise<Database> {
  return createDb(inject("databaseUrl"));
}

export async function theOwner(db: Database): Promise<string> {
  const [owner] = await db.select().from(owners);
  if (!owner) throw new Error("migration 1 seeds exactly one owner row; none found");
  return owner.id;
}

/** The owner's own source: kind `owner`, first in the global order (ADR-0025). */
export async function ownerSource(db: Database): Promise<string> {
  const [source] = await db.select().from(sources).where(eq(sources.kind, "owner"));
  if (!source) throw new Error("migration 1 seeds the owner as a source; none found");
  return source.id;
}

export async function propertyNamed(db: Database, name: string): Promise<string> {
  const [property] = await db.select().from(properties).where(eq(properties.name, name));
  if (!property) throw new Error(`no migration seeds a property named ${name}`);
  return property.id;
}

export async function anItem(
  db: Database,
  values: { kind?: string; isContainer?: boolean; isOrdered?: boolean } = {},
): Promise<string> {
  const [item] = await db
    .insert(items)
    .values({ ownerId: await theOwner(db), kind: values.kind ?? "work", ...values })
    .returning({ id: items.id });
  if (!item) throw new Error("insert returned no item");
  return item.id;
}

/** An item with a title STATEMENT, which the trigger projects onto the column. */
export async function anItemTitled(
  db: Database,
  title: string,
  values: { kind?: string; isContainer?: boolean; isOrdered?: boolean } = {},
): Promise<string> {
  const id = await anItem(db, values);
  await aStatement(db, {
    subjectItemId: id,
    property: "title",
    valueLiteral: title,
    sourceId: await ownerSource(db),
  });
  return id;
}

export async function readItem(db: Database, id: string) {
  const [item] = await db.select().from(items).where(eq(items.id, id));
  return item;
}

/**
 * One item's membership of one container, at one position (ADR-0009), and the
 * source that asserted it (ADR-0017) when one is named.
 */
export async function aPlacement(
  db: Database,
  values: {
    containerId: string;
    itemId: string;
    position: number;
    sourceId?: string;
    rank?: string;
  },
): Promise<string> {
  const { sourceId, rank, ...placement } = values;
  const ownerId = await theOwner(db);
  const [written] = await db
    .insert(placements)
    .values({ ownerId, ...placement })
    .returning({ id: placements.id });
  if (!written) throw new Error("insert returned no placement");
  if (sourceId) {
    await db
      .insert(placementSources)
      .values({ ownerId, placementId: written.id, sourceId, ...(rank ? { rank } : {}) });
  }
  return written.id;
}

/**
 * A provider source, at the NEXT place in the global order (ADR-0025).
 *
 * IT ALLOCATES RATHER THAN TAKING A NUMBER, and that is a fix rather than a
 * simplification. `sources_order` is unique per owner, the whole db suite
 * shares ONE database, and a real import allocates `max + 1` -- so a helper
 * handing out chosen numbers was a second allocator competing with the first
 * over one unique column. It held only while the two never met: CNCORE-7 added
 * enough imports to walk `max + 1` into the band the tests had picked from, and
 * the suite began failing a different test on roughly one run in three.
 *
 * SO A TEST EXPRESSES ORDER BY THE ORDER IT CREATES THEM IN. Earlier is better
 * placed, which is what every assertion here was ever about -- no test wanted a
 * particular number, they wanted one source to outrank another.
 */
export async function aProvider(db: Database, identity: string): Promise<string> {
  const ownerId = await theOwner(db);
  const [source] = await db
    .insert(sources)
    .values({
      ownerId,
      kind: "provider",
      identity,
      label: identity,
      sourceOrder: sql`(select coalesce(max("source_order"), 0) + 1 from "sources" where "owner_id" = ${ownerId})`,
    })
    .returning({ id: sources.id });
  if (!source) throw new Error("insert returned no source");
  return source.id;
}

/**
 * Pushes one source to the END of the global order, so whatever was behind it
 * now outranks it.
 *
 * MOVING SOMETHING UP RATHER THAN DOWN, because `max + 1` is the one value
 * always guaranteed free. Picking a number below another source is how a test
 * collides with a slot the allocator has already handed out.
 */
export async function movedToTheEndOfTheSourceOrder(db: Database, id: string): Promise<void> {
  const ownerId = await theOwner(db);
  await db
    .update(sources)
    .set({
      sourceOrder: sql`(select coalesce(max("source_order"), 0) + 1 from "sources" where "owner_id" = ${ownerId})`,
    })
    .where(eq(sources.id, id));
}

export async function aStatement(
  db: Database,
  values: {
    subjectItemId?: string;
    subjectPlacementId?: string;
    property: string;
    valueLiteral?: string;
    valueItemId?: string;
    sourceId: string;
    rank?: string;
    observedAt?: Date;
    language?: string;
    /** Arrived broken from an import, and held apart from the live set. */
    quarantined?: boolean;
  },
): Promise<string> {
  const { property, ...rest } = values;
  const [statement] = await db
    .insert(statements)
    .values({
      ownerId: await theOwner(db),
      propertyId: await propertyNamed(db, property),
      ...rest,
    })
    .returning({ id: statements.id });
  if (!statement) throw new Error("insert returned no statement");
  return statement.id;
}

/**
 * Runs a write that the database is expected to REFUSE, and answers with what
 * refused it: the constraint's name, or the message a trigger raised.
 *
 * Drizzle wraps the driver's error, so its own `message` is only ever
 * "Failed query: ..." and says nothing about which rule bit. Asserting on the
 * wrapper would pass for any failure at all, including a typo in the test's own
 * SQL -- so this walks down to the PostgreSQL error underneath.
 */
export async function refusal(write: Promise<unknown>): Promise<string> {
  try {
    await write;
  } catch (error) {
    return describeRefusal(error);
  }
  throw new Error("expected the database to refuse this write; it accepted it");
}

function describeRefusal(error: unknown): string {
  let current: unknown = error;
  while (current instanceof Error) {
    const constraint = (current as { constraint?: unknown }).constraint;
    if (typeof constraint === "string") return constraint;
    // A trigger's RAISE EXCEPTION carries no constraint name, only a message.
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && code !== "") return current.message;
    current = current.cause;
  }
  throw new Error(`not a PostgreSQL refusal: ${String(error)}`);
}

/**
 * A CATALOGUE LARGER THAN ONE PAGE, answering with every id it wrote.
 *
 * IT IS THE ONLY STATE IN WHICH PAGING IS OBSERVABLE AT ALL, and no other
 * fixture here has it: everything the other two instances hold arrives on the
 * first page.
 *
 * IT CARRIES TWO HARD PAIRS rather than distinctly-titled rows alone. A walk
 * over a few hundred distinct titles passes against a cursor that compares only
 * the sort key, and against one that cannot cross into the untitled tail --
 * both of which lose items silently and permanently on a real catalogue. The
 * pairs are what make "none is skipped" bite. They are not returned separately:
 * a walk that has to arrive at EVERY id has already arrived at them, and a
 * field naming them would be one nothing reads.
 *
 * WRITTEN IN BULK, because the per-item helpers above are three round trips
 * each and this is the difference between a fixture costing a moment and one
 * costing a minute.
 */
export async function aCatalogueLargerThanOnePage(db: Database, size: number): Promise<string[]> {
  const ownerId = await theOwner(db);
  const sourceId = await ownerSource(db);
  const title = await propertyNamed(db, "title");
  const sortName = await propertyNamed(db, "sort_name");

  const mint = async (count: number): Promise<string[]> =>
    (
      await db
        .insert(items)
        .values(Array.from({ length: count }, () => ({ ownerId, kind: "work" })))
        .returning({ id: items.id })
    ).map((row) => row.id);

  // FOUR OF THE SIZE ARE THE PAIRS, so the caller asks for the number of items
  // it wants and gets exactly that many -- rather than for a number that turns
  // out to be four short of the catalogue it is about to walk.
  const titled = await mint(size - 4);
  const tied = await mint(2);
  const keyless = await mint(2);
  await db.insert(statements).values([
    // PADDED, so the titles sort the way a reader would count them. Nothing
    // asserts on the order, but a fixture whose tenth item sorts between its
    // first and second is one nobody can read a failure out of.
    ...titled.map((id, index) => ({
      ownerId,
      subjectItemId: id,
      propertyId: title,
      valueLiteral: `Story ${String(index + 1).padStart(4, "0")}`,
      sourceId,
    })),
    ...tied.map((id, index) => ({
      ownerId,
      subjectItemId: id,
      propertyId: title,
      valueLiteral: `A story told twice (${index === 0 ? "novel" : "audio"})`,
      sourceId,
    })),
    // THE TIE ITSELF: one sort key, two items. The order between them is their
    // ids, which is the half of the cursor a key-only comparison leaves out.
    ...tied.map((id) => ({
      ownerId,
      subjectItemId: id,
      propertyId: sortName,
      valueLiteral: "Story told twice, A",
      sourceId,
    })),
  ]);

  // `keyless` gets NO statement at all, which is the whole of its fixture: no
  // title and no sort name is no sort key, and those sort last as one block.
  return [...titled, ...tied, ...keyless];
}
