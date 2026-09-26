import { Client } from "pg";

/**
 * Seeds ONE item into TWO orderings, by hand, through RAW SQL.
 *
 * BY HAND IS THE POINT, not a shortcut waiting for an importer. It proves the
 * model without waiting for a provider, and it is the artefact that shows the
 * product exists: one item sitting in two orderings at once, at different
 * positions, with neither ordering able to disturb the other (ADR-0018).
 *
 * The raw SQL is the other half of the point. It reaches around the application
 * entirely, which is the argument for ADR-0014's projection being
 * trigger-maintained rather than application-maintained, run as a check: this
 * writes `title` STATEMENTS and never touches `items.title`, and the columns
 * fill themselves because a trigger cannot be bypassed by a writer that never
 * heard of it. Under an application-maintained projection this exact function
 * would leave every title empty and nothing would say so.
 *
 * Shared by `pnpm db:seed` and the end-to-end suite, so the page is proven
 * against the same write path a developer's own database gets.
 */
export interface SeededPlacement {
  id: string;
  containerId: string;
  containerTitle: string;
  position: number;
}

export interface SeededItem {
  id: string;
  title: string;
  /** What the projection made of it. Equal to `title` when the trigger ran. */
  projectedTitle: string | null;
  /** Every ordering the seeded item sits in, in the order they were written. */
  placements: SeededPlacement[];
}

/**
 * The two orderings the demo item sits in. Chosen to disagree: the same story
 * is the 63rd thing released and the 1st thing that happens, which is the case
 * a single `series_index` column on the item cannot hold at all.
 */
const ORDERINGS = [
  { title: "Release order", position: 63 },
  { title: "Story order", position: 1 },
];

export async function seedOneItemInTwoOrderings(
  connectionString: string,
  title = "The Item in Two Orderings",
): Promise<SeededItem> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("begin");
    const id = await titledItem(client, title, { isContainer: false });
    const placements: SeededPlacement[] = [];
    for (const ordering of ORDERINGS) {
      const containerId = await titledItem(client, ordering.title, { isContainer: true });
      placements.push({
        id: await place(client, { containerId, itemId: id, position: ordering.position }),
        containerId,
        containerTitle: ordering.title,
        position: ordering.position,
      });
    }
    await client.query("commit");

    const projected = await client.query<{ title: string | null }>(
      `select "title" from "items" where "id" = $1`,
      [id],
    );
    return { id, title, projectedTitle: projected.rows[0]?.title ?? null, placements };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * An item, and the title STATEMENT the projection column is built from. A
 * container is `is_ordered` too: a release order whose sequence did not matter
 * would not be an ordering.
 */
async function titledItem(
  client: Client,
  title: string,
  { isContainer }: { isContainer: boolean },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `
    with seeded as (
      insert into "items" ("owner_id", "kind", "is_container", "is_ordered")
      select "id", 'work', $2, $2 from "owners"
      returning "id", "owner_id"
    )
    insert into "statements"
      ("owner_id", "subject_item_id", "property_id", "value_literal", "source_id")
    select
      seeded."owner_id",
      seeded."id",
      (select "id" from "properties" where "name" = 'title'),
      $1,
      (select "id" from "sources" where "kind" = 'owner')
    from seeded
    returning "subject_item_id" as "id"
    `,
    [title, isContainer],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("the seed inserted no statement; is the database migrated?");
  return id;
}

/**
 * One placement, and the source that asserted it. ADR-0017: an ordering is a
 * dated claim by a NAMED SOURCE rather than a neutral fact, so a placement with
 * no source beneath it would be a claim nobody made. Here that source is the
 * owner's own hand, which is what "hand-placed" means everywhere else.
 */
async function place(
  client: Client,
  { containerId, itemId, position }: { containerId: string; itemId: string; position: number },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `
    with placed as (
      insert into "placements" ("owner_id", "container_id", "item_id", "position")
      select "id", $1, $2, $3 from "owners"
      returning "id", "owner_id"
    )
    insert into "placement_sources" ("owner_id", "placement_id", "source_id")
    select placed."owner_id", placed."id", (select "id" from "sources" where "kind" = 'owner')
    from placed
    returning "placement_id" as "id"
    `,
    [containerId, itemId, position],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("the seed inserted no placement source");
  return id;
}
