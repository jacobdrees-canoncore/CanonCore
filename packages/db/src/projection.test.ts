import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { type Database, statements } from "./index";
import {
  anItem,
  aProvider,
  aStatement,
  connect,
  movedToTheEndOfTheSourceOrder,
  ownerSource,
  readItem,
} from "./testing/catalogue";

/**
 * ADR-0014. The statement is the truth; `items.title` is a cached copy of
 * whichever statement currently wins.
 *
 * Every test here writes a STATEMENT and then reads the COLUMN, with no refresh
 * call in between. That is the property the design actually depends on, and the
 * one thing that fails loudly if the projection is ever wired up wrong.
 */
let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("the title projection", () => {
  it("projects a title statement into the item's column", async () => {
    const item = await anItem(db);
    await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "The Daleks' Master Plan",
      sourceId: await ownerSource(db),
    });

    expect((await readItem(db, item))?.title).toBe("The Daleks' Master Plan");
  });

  it("ranks the whole source order, not just the tail of it", async () => {
    // The favourite is a value the OWNER CHOSE, which is routinely a value a
    // provider supplied -- so the pin has to beat the source order rather than
    // merely agree with it. A test that pins the owner's own statement proves
    // nothing here, because the owner already sits first in the order.
    const item = await anItem(db);
    // Created in the order they rank: `aProvider` allocates the next place, so
    // the better-placed source is simply the one made first.
    const betterPlaced = await aProvider(db, "https://provider.test/first-of-two");
    const preferredSource = await aProvider(db, "https://provider.test/last");
    await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "From the better-placed source",
      sourceId: betterPlaced,
    });
    expect((await readItem(db, item))?.title).toBe("From the better-placed source");

    // ADR-0024: the favourite IS the lock. Nothing else is needed to pin it.
    await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "The owner's chosen value",
      sourceId: preferredSource,
      rank: "preferred",
    });

    expect((await readItem(db, item))?.title).toBe("The owner's chosen value");
  });

  it("lets a deprecated value lose to a worse-placed source", async () => {
    // Same shape in the other direction: the deprecated statement comes from
    // the BETTER-placed source, so only rank can decide it.
    const item = await anItem(db);
    const betterPlaced = await aProvider(db, "https://provider.test/deprecated");
    const worsePlaced = await aProvider(db, "https://provider.test/kept");
    await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "The deprecated title",
      sourceId: betterPlaced,
      rank: "deprecated",
    });
    await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "The good title",
      sourceId: worsePlaced,
    });

    expect((await readItem(db, item))?.title).toBe("The good title");
  });

  it("puts the owner ahead of a provider when neither is ranked", async () => {
    // The source-order half, with the owner where migration 1 seeds it: first.
    const item = await anItem(db);
    await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "What the provider says",
      sourceId: await aProvider(db, "https://provider.test/ordinary"),
    });
    await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "What the owner says",
      sourceId: await ownerSource(db),
    });

    expect((await readItem(db, item))?.title).toBe("What the owner says");
  });

  it("never picks a winner by recency", async () => {
    // Importing a remaster must not silently flip every default. The newer
    // statement here is from a worse-placed source and must lose anyway.
    const item = await anItem(db);
    const better = await aProvider(db, "https://provider.test/better");
    const worse = await aProvider(db, "https://provider.test/worse");
    await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "From the better source",
      sourceId: better,
      observedAt: new Date("2020-01-01T00:00:00Z"),
    });
    await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "From the worse source, but newer",
      sourceId: worse,
      observedAt: new Date("2026-01-01T00:00:00Z"),
    });

    expect((await readItem(db, item))?.title).toBe("From the better source");
  });

  it("falls back to the runner-up when the winner is tombstoned", async () => {
    const item = await anItem(db);
    const runnerUp = await aProvider(db, "https://provider.test/runner-up");
    await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "Second choice",
      sourceId: runnerUp,
    });
    const winner = await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "First choice",
      sourceId: await ownerSource(db),
    });
    expect((await readItem(db, item))?.title).toBe("First choice");

    await db.update(statements).set({ deletedAt: new Date() }).where(eq(statements.id, winner));

    expect((await readItem(db, item))?.title).toBe("Second choice");
  });

  /**
   * CNCORE-29. A quarantined value must not WIN, not merely be hidden from the
   * list of claims. `winning_literal` is the second of the two readers ADR-0075
   * names for the tombstone, and a mark only one of them honours is half a
   * mechanism -- the half that surfaces later as a projected value nothing on
   * the page can account for.
   *
   * NOTHING PROJECTS A DATE YET, which is exactly why this is pinned on `title`
   * instead: the rule is `winning_literal`'s rather than `released`'s, and the
   * slice that first sorts on a date should inherit it already working.
   */
  it("passes over a quarantined value, rather than letting it win", async () => {
    const item = await anItem(db);
    const runnerUp = await aProvider(db, "https://provider.test/quarantine-runner-up");
    await aStatement(db, {
      subjectItemId: item,
      property: "title",
      valueLiteral: "What the catalogue can read",
      sourceId: runnerUp,
    });
    await aStatement(db, {
      subjectItemId: item,
      property: "title",
      // Better placed than the runner-up -- the owner sits first in the global
      // source order -- so it wins on every term and loses only on the mark.
      valueLiteral: "What arrived broken",
      sourceId: await ownerSource(db),
      quarantined: true,
    });

    expect((await readItem(db, item))?.title).toBe("What the catalogue can read");
  });

  it("re-picks the catalogue when the source order changes, but never a pin", async () => {
    // ADR-0024. Re-ordering the source list re-picks everything the owner has
    // not pinned. A pin the next refresh silently overwrites is not a pin.
    const unpinned = await anItem(db);
    const pinned = await anItem(db);
    const first = await aProvider(db, "https://provider.test/first");
    const second = await aProvider(db, "https://provider.test/second");

    for (const item of [unpinned, pinned]) {
      await aStatement(db, {
        subjectItemId: item,
        property: "title",
        valueLiteral: "From first",
        sourceId: first,
      });
      await aStatement(db, {
        subjectItemId: item,
        property: "title",
        valueLiteral: "From second",
        sourceId: second,
      });
    }
    // Pinned on the WORSE-placed source, so the pin is doing the work rather
    // than the source order quietly agreeing with it.
    await aStatement(db, {
      subjectItemId: pinned,
      property: "title",
      valueLiteral: "The owner's pin",
      sourceId: second,
      rank: "preferred",
    });

    expect((await readItem(db, unpinned))?.title).toBe("From first");
    expect((await readItem(db, pinned))?.title).toBe("The owner's pin");

    // Re-order the list so `second` outranks `first`. Done by pushing `first` to
    // the END rather than by moving `second` below it: `max + 1` is the one
    // value always free, and picking a number below another source is how a
    // test collides with a slot the allocator has already handed out.
    await movedToTheEndOfTheSourceOrder(db, first);

    expect((await readItem(db, unpinned))?.title).toBe("From second");
    expect((await readItem(db, pinned))?.title).toBe("The owner's pin");
  });

  it("projects sort_name by the same rule", async () => {
    const item = await anItem(db);
    await aStatement(db, {
      subjectItemId: item,
      property: "sort_name",
      valueLiteral: "Daleks' Master Plan, The",
      sourceId: await ownerSource(db),
    });

    expect((await readItem(db, item))?.sortName).toBe("Daleks' Master Plan, The");
  });

  it("leaves release_date alone, because its source is an edition", async () => {
    // ADR-0081 defines release_date as the earliest known release of any
    // EDITION, and editions arrive with their own slice. A `released` statement
    // on the ITEM must not fill the column with a different definition.
    const item = await anItem(db);
    await aStatement(db, {
      subjectItemId: item,
      property: "released",
      valueLiteral: "1965-11-13",
      sourceId: await ownerSource(db),
    });

    expect((await readItem(db, item))?.releaseDate).toBeNull();
  });
});
