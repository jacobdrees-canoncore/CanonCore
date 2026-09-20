import { randomUUID } from "node:crypto";

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
    expect(container.holds.rows).toStrictEqual([
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
    expect(item.placements.rows).toStrictEqual([
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
    expect(container.holds.rows).toStrictEqual([
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

    const { error } = await safe(call(appRouter.placement.place, placed, { context: asTheOwner }));

    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
    /*
     * AND THE SENTENCE NAMES THIS CAUSE RATHER THAN THE SET (CNCORE-255).
     * `ORPCError.toJSON` serialises `{defined, code, status, message, data}`
     * and drops `cause`, so a handler passing only the cause answers the
     * DECLARED sentence -- which names four causes and leaves the Owner to
     * guess which one they hit. `provider.beginImportRun` asserts its own
     * sentence for the same reason.
     */
    expect(error?.message).toBe(
      "That item is already in that container at that position, or already there with no position given.",
    );
  });

  it("refuses an item that is not there, naming THAT cause", async () => {
    /*
     * THE FOREIGN KEY TO `items`, which is the one cause of the five that no
     * test drove at either layer before CNCORE-255 -- every `randomUUID` in
     * these suites was a PLACEMENT id, which answers NOT_FOUND instead. A
     * sentence with no witness is a sentence nobody has read.
     */
    const container = await anItem(db, { isContainer: true, isOrdered: true });

    const { error } = await safe(
      call(
        appRouter.placement.place,
        { containerId: container, itemId: randomUUID(), position: 1 },
        { context: asTheOwner },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("No such item or container.");
  });

  it("refuses a visitor with no session, on all four procedures", async () => {
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
      safe(
        call(
          appRouter.placement.move,
          { id: crypto.randomUUID(), containerId: container, position: 1, siblings: [] },
          { context },
        ),
      ),
    ]);

    expect(refusals.map(({ error }) => (error as { code?: string })?.code)).toStrictEqual([
      "UNAUTHORIZED",
      "UNAUTHORIZED",
      "UNAUTHORIZED",
      "UNAUTHORIZED",
    ]);
  });
});

describe("placement.move", () => {
  it("reorders a container, and the container's own page reads the new order", async () => {
    // ASSERTED BACK THROUGH `item.get`, which is this file's rule: a write
    // asserted against its own return value proves only that the procedure
    // answered.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const first = await anItemTitled(db, "An Unearthly Child");
    const second = await anItemTitled(db, "The Daleks");

    const a = await call(
      appRouter.placement.place,
      { containerId: releaseOrder, itemId: first, position: 1 },
      { context: asTheOwner },
    );
    const b = await call(
      appRouter.placement.place,
      { containerId: releaseOrder, itemId: second, position: 2 },
      { context: asTheOwner },
    );

    await call(
      appRouter.placement.move,
      {
        id: b.id,
        containerId: releaseOrder,
        position: 1,
        siblings: [{ id: a.id, position: 2 }],
      },
      { context: asTheOwner },
    );

    const container = await call(appRouter.item.get, { id: releaseOrder }, { context });
    expect(container.holds.rows.map(({ id, position }) => ({ id, position }))).toStrictEqual([
      { id: b.id, position: 1 },
      { id: a.id, position: 2 },
    ]);
  });

  it("leaves the item's position in every OTHER ordering alone", async () => {
    // The ticket's third criterion, and ADR-0061's rule: every container owns
    // its membership outright, so reordering one says nothing about another.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const storyOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItemTitled(db, "The Tenth Planet");
    const other = await anItemTitled(db, "The War Machines");

    const here = await call(
      appRouter.placement.place,
      { containerId: releaseOrder, itemId: story, position: 1 },
      { context: asTheOwner },
    );
    const alongside = await call(
      appRouter.placement.place,
      { containerId: releaseOrder, itemId: other, position: 2 },
      { context: asTheOwner },
    );
    await call(
      appRouter.placement.place,
      { containerId: storyOrder, itemId: story, position: 29 },
      { context: asTheOwner },
    );

    await call(
      appRouter.placement.move,
      {
        id: here.id,
        containerId: releaseOrder,
        position: 2,
        siblings: [{ id: alongside.id, position: 1 }],
      },
      { context: asTheOwner },
    );

    const elsewhere = await call(appRouter.item.get, { id: storyOrder }, { context });
    expect(elsewhere.holds.rows).toStrictEqual([
      expect.objectContaining({ itemId: story, position: 29 }),
    ]);
  });

  it("moves a member into ANOTHER container, which then holds it where the first no longer does", async () => {
    // ADR-0061's third mutation, and ADR-0116's shape: a move names the
    // Placement, and `containerId` is where it goes rather than where it was.
    // Every other test here moves within one container, so without this one
    // the cross-container half is a signature nobody has watched succeed.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const storyOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const story = await anItemTitled(db, "The Moonbase");

    const { id } = await call(
      appRouter.placement.place,
      { containerId: releaseOrder, itemId: story, position: 4 },
      { context: asTheOwner },
    );

    await call(
      appRouter.placement.move,
      { id, containerId: storyOrder, position: 1, siblings: [] },
      { context: asTheOwner },
    );

    const destination = await call(appRouter.item.get, { id: storyOrder }, { context });
    expect(destination.holds.rows).toStrictEqual([
      expect.objectContaining({ id, itemId: story, title: "The Moonbase", position: 1 }),
    ]);
    const origin = await call(appRouter.item.get, { id: releaseOrder }, { context });
    expect(origin.holds.rows).toStrictEqual([]);
  });

  it("refuses to resettle the container it LEFT, and writes nothing when asked to", async () => {
    // WHAT A CROSS-CONTAINER MOVE CANNOT DO, pinned because ADR-0061 now reads
    // `accepted` on the strength of this mutation. The siblings a move writes
    // are scoped to its DESTINATION, so the origin keeps its remaining members
    // exactly where they were and a hole is left at the position vacated --
    // which is what a removal does too, and ADR-0116's "no number is invented".
    // Naming an origin sibling anyway takes the WHOLE move down rather than
    // half-applying it.
    const releaseOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const storyOrder = await anItem(db, { isContainer: true, isOrdered: true });
    const leaving = await anItemTitled(db, "The Underwater Menace");
    const staying = await anItemTitled(db, "The Macra Terror");

    const moved = await call(
      appRouter.placement.place,
      { containerId: releaseOrder, itemId: leaving, position: 1 },
      { context: asTheOwner },
    );
    const behind = await call(
      appRouter.placement.place,
      { containerId: releaseOrder, itemId: staying, position: 2 },
      { context: asTheOwner },
    );

    const { error } = await safe(
      call(
        appRouter.placement.move,
        {
          id: moved.id,
          containerId: storyOrder,
          position: 1,
          // The member left behind, asked to close the gap. It is in the ORIGIN.
          siblings: [{ id: behind.id, position: 1 }],
        },
        { context: asTheOwner },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
    // AND THE SENTENCE IS THIS REFUSAL'S, not the cycle's. This is the cause
    // `move` named NOTHING about until CNCORE-255: the declared sentence spoke
    // only of a container holding what it sits inside, which is a different
    // refusal, so the Owner was told the wrong thing rather than too little.
    expect(error?.message).toBe("That move named a placement this container does not hold.");
    // AND NOTHING LANDED, which is the half a refusal alone would not prove.
    const origin = await call(appRouter.item.get, { id: releaseOrder }, { context });
    expect(origin.holds.rows.map(({ id, position }) => ({ id, position }))).toStrictEqual([
      { id: moved.id, position: 1 },
      { id: behind.id, position: 2 },
    ]);
    const destination = await call(appRouter.item.get, { id: storyOrder }, { context });
    expect(destination.holds.rows).toStrictEqual([]);
  });

  it("says NOT_FOUND for a placement that is not there to move", async () => {
    const container = await anItem(db, { isContainer: true, isOrdered: true });

    const { error } = await safe(
      call(
        appRouter.placement.move,
        { id: crypto.randomUUID(), containerId: container, position: 1, siblings: [] },
        { context: asTheOwner },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("NOT_FOUND");
  });

  it("refuses a move that would close a placement cycle, as a sentence", async () => {
    // ADR-0074's container half, reached THROUGH THE MUTATION rather than
    // through a UI guard -- which is the ticket's own criterion, because a
    // client-side guard reads as an enforced rule to everyone except the person
    // who bypasses it.
    const outer = await anItem(db, { isContainer: true, isOrdered: true });
    const inner = await anItem(db, { isContainer: true, isOrdered: true });
    const elsewhere = await anItem(db, { isContainer: true, isOrdered: true });

    await call(
      appRouter.placement.place,
      { containerId: outer, itemId: inner, position: 1 },
      { context: asTheOwner },
    );
    const stray = await call(
      appRouter.placement.place,
      { containerId: elsewhere, itemId: outer, position: 1 },
      { context: asTheOwner },
    );

    const { error } = await safe(
      call(
        appRouter.placement.move,
        { id: stray.id, containerId: inner, position: 1, siblings: [] },
        { context: asTheOwner },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
    // THE ONE CAUSE THE OLD SENTENCE GOT RIGHT, kept as a guard so the change
    // that made the other four true cannot quietly cost this one its answer.
    expect(error?.message).toBe(
      "A container cannot hold itself, or something it already sits inside.",
    );
  });
});
