import type { Database } from "@canoncore/db";
import { anItem, anItemTitled, connect } from "@canoncore/db/testing/catalogue";
import { env } from "@canoncore/env/server";
import { call, isDefinedError, safe } from "@orpc/server";
import { beforeAll, describe, expect, it } from "vitest";

import { createContext } from "../context";
import { appRouter } from "./index";

/**
 * ADR-0103's second seam: the router called in the same process, with context
 * built by the real `createContext`.
 *
 * THE OWNER'S HAND ON A CONTAINER'S MEMBERSHIP (CNCORE-72). Every procedure
 * here WRITES, so every one of them is an `ownerProcedure` (CNCORE-109,
 * ADR-0043) -- which is asserted at the bottom of this file rather than assumed.
 */
const context = await createContext();

let db: Database;

beforeAll(async () => {
  db = await connect();
});

const asTheOwner = await createContext({ sessionToken: await aTokenForTheOwner() });

async function aTokenForTheOwner(): Promise<string> {
  const password = env.OWNER_PASSWORD;
  if (password === undefined) {
    throw new Error("this suite's vitest.config.ts sets OWNER_PASSWORD, and it is not set");
  }
  const { token } = await call(appRouter.session.logIn, { password }, { context });
  return token;
}

describe("placement.place", () => {
  it("puts an item in a container, where the container's own page then holds it", async () => {
    // ASSERTED BACK THROUGH `item.get`, which is how a reader meets the member:
    // a container is an Item (ADR-0004) and its page lists what it holds. A
    // write asserted against its own return value would prove only that the
    // procedure answered.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItemTitled(db, "The Tenth Planet");

    const { id } = await call(
      appRouter.placement.place,
      { containerId: releaseOrder, itemId: story, position: 63 },
      { context: asTheOwner },
    );

    const container = await call(appRouter.item.get, { id: releaseOrder }, { context });
    expect(container.holds.entries).toStrictEqual([
      expect.objectContaining({ id, itemId: story, title: "The Tenth Planet", position: 63 }),
    ]);
  });
});

describe("placement.remove", () => {
  it("takes the member out of one container and leaves the item's other placements", async () => {
    // ADR-0061's claim, performed: every container owns its membership
    // outright, so removing a member from one ordering is not removing it from
    // the catalogue. Asserted from the ITEM's end, which is where a reader sees
    // the orderings it still sits in.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const storyOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);
    const { id: inRelease } = await call(
      appRouter.placement.place,
      { containerId: releaseOrder, itemId: story, position: 63 },
      { context: asTheOwner },
    );
    await call(
      appRouter.placement.place,
      { containerId: storyOrder, itemId: story, position: 1 },
      { context: asTheOwner },
    );

    await call(appRouter.placement.remove, { id: inRelease }, { context: asTheOwner });

    const item = await call(appRouter.item.get, { id: story }, { context });
    expect(item.placements).toStrictEqual([
      expect.objectContaining({ containerId: storyOrder, position: 1 }),
    ]);
  });

  it("answers NOT_FOUND for a placement that is not there", async () => {
    const { error } = await safe(
      call(appRouter.placement.remove, { id: crypto.randomUUID() }, { context: asTheOwner }),
    );

    expect(isDefinedError(error) && error.code).toBe("NOT_FOUND");
  });
});

describe("placement.restore", () => {
  it("undoes a removal: the member returns with its position and its origin", async () => {
    // ADR-0046: the most frequent editing act gets an undo rather than a
    // dialog. `assertedBy` is asserted because a member coming back anonymous
    // would satisfy "the row is visible again" and fail the owner.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItemTitled(db, "The Daleks");
    const { id } = await call(
      appRouter.placement.place,
      { containerId: releaseOrder, itemId: story, position: 2 },
      { context: asTheOwner },
    );
    await call(appRouter.placement.remove, { id }, { context: asTheOwner });

    await call(appRouter.placement.restore, { id }, { context: asTheOwner });

    const container = await call(appRouter.item.get, { id: releaseOrder }, { context });
    expect(container.holds.entries).toStrictEqual([
      expect.objectContaining({ id, position: 2, assertedBy: ["Owner"] }),
    ]);
  });
});

describe("what the owner is refused", () => {
  it("refuses the same item twice in one container at ONE position, as a BAD_REQUEST", async () => {
    // NOT A 500. The owner asked for something the schema forbids -- ADR-0009
    // licences a Repeat at DIFFERENT positions only -- and a surface has to be
    // able to tell that from a broken catalogue (ADR-0116).
    const season = await anItem(db, { isContainer: true, isOrdered: true });
    const episode = await anItem(db);
    const placed = { containerId: season, itemId: episode, position: 1 };
    await call(appRouter.placement.place, placed, { context: asTheOwner });

    const { error } = await safe(
      call(appRouter.placement.place, placed, { context: asTheOwner }),
    );

    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
  });

  it("refuses a visitor with no session, on all three procedures", async () => {
    // ADR-0044 makes the demo READ-ONLY: everything that changes a catalogue is
    // behind a session (CNCORE-109). Asserted on every procedure rather than on
    // one, because the guard is declared per procedure and a new one added
    // without it would be reachable by anyone who can reach the process.
    const container = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItem(db);

    const refusals = await Promise.all([
      safe(
        call(
          appRouter.placement.place,
          { containerId: container, itemId: story, position: 1 },
          { context },
        ),
      ),
      safe(call(appRouter.placement.remove, { id: crypto.randomUUID() }, { context })),
      safe(call(appRouter.placement.restore, { id: crypto.randomUUID() }, { context })),
    ]);

    expect(refusals.map(({ error }) => (error as { code?: string })?.code)).toStrictEqual([
      "UNAUTHORIZED",
      "UNAUTHORIZED",
      "UNAUTHORIZED",
    ]);
  });
});
