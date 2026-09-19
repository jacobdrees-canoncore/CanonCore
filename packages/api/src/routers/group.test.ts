import type { Database } from "@canoncore/db";
import { anItem, anItemTitled, connect } from "@canoncore/db/testing/catalogue";
import { env } from "@canoncore/env/server";
import { parseAllowlist } from "@canoncore/providers";
import { call, isDefinedError, safe } from "@orpc/server";
import { beforeAll, describe, expect, it } from "vitest";

import { createContext } from "../context";
import { appRouter } from "./index";

/**
 * ADR-0103's second seam: the router called in the same process, with context
 * built by the real `createContext`.
 *
 * A GROUP IS A BROWSING SCOPE (ADR-0010). Everything that CHANGES one is an
 * `ownerProcedure` (CNCORE-109, ADR-0043) and reading them is open (ADR-0044,
 * ADR-0072), which is asserted at the bottom of this file rather than assumed.
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

describe("group.create", () => {
  it("makes a scope the Owner has named, which the catalogue then lists", async () => {
    // ASSERTED BACK THROUGH `group.list`, which is how a reader meets it. A
    // write asserted against its own return value would prove only that the
    // procedure answered.
    const { id } = await call(
      appRouter.group.create,
      { name: "Doctor Who" },
      { context: asTheOwner },
    );

    const { groups } = await call(appRouter.group.list, {}, { context });
    expect(groups).toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ id, name: "Doctor Who" })]),
    );
  });
});

describe("group.rename", () => {
  it("gives the scope the Owner's new name", async () => {
    const { id } = await call(appRouter.group.create, { name: "Who" }, { context: asTheOwner });

    await call(
      appRouter.group.rename,
      { id, name: "Doctor Who universe" },
      { context: asTheOwner },
    );

    const { groups } = await call(appRouter.group.list, {}, { context });
    expect(groups).toStrictEqual(expect.arrayContaining([{ id, name: "Doctor Who universe" }]));
  });

  it("answers NOT_FOUND for a Group that is not there", async () => {
    // A stale page or a shared link, which is an answer rather than a fault
    // (ADR-0066) -- the posture `placement.remove` takes one router over.
    const { error } = await safe(
      call(
        appRouter.group.rename,
        { id: crypto.randomUUID(), name: "Nowhere" },
        { context: asTheOwner },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("NOT_FOUND");
  });

  it("refuses a name the Owner left empty", async () => {
    // An unnamed scope is a row in a picker with nothing to pick, and there is
    // no honest state for it to fall back to -- see `nameByHand`.
    const { id } = await call(appRouter.group.create, { name: "Named" }, { context: asTheOwner });

    const { error } = await safe(
      call(appRouter.group.rename, { id, name: "   " }, { context: asTheOwner }),
    );

    expect((error as { code?: string })?.code).toBe("BAD_REQUEST");
  });
});

describe("group.put", () => {
  it("puts one Item in SEVERAL scopes, and the Item's own page names them all", async () => {
    // ADR-0010'S DECISION, asserted where a reader meets it (story 38). The
    // Item page is what answers "why does this appear when I narrow", so the
    // scopes ride on `item.get` beside the orderings rather than on a call of
    // their own.
    const doctorWho = await call(
      appRouter.group.create,
      { name: "aaa Doctor Who" },
      { context: asTheOwner },
    );
    const marvel = await call(
      appRouter.group.create,
      { name: "aaa Marvel" },
      { context: asTheOwner },
    );
    const crossover = await anItem(db);

    await call(
      appRouter.group.put,
      { groupId: doctorWho.id, itemId: crossover },
      { context: asTheOwner },
    );
    await call(
      appRouter.group.put,
      { groupId: marvel.id, itemId: crossover },
      { context: asTheOwner },
    );

    const item = await call(appRouter.item.get, { id: crossover }, { context });
    expect(item.groups).toStrictEqual([
      { id: doctorWho.id, name: "aaa Doctor Who" },
      { id: marvel.id, name: "aaa Marvel" },
    ]);
  });

  it("answers BAD_REQUEST for a scope that is not there", async () => {
    // `GroupRefused` translated, and nothing else: a dead pool stays a fault.
    const { error } = await safe(
      call(
        appRouter.group.put,
        { groupId: crypto.randomUUID(), itemId: await anItem(db) },
        { context: asTheOwner },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
  });
});

describe("group.take", () => {
  it("takes the Item out of one scope and leaves the others it is in", async () => {
    // Story 37. The same claim ADR-0061 makes for a Container's membership, one
    // construct over: every scope owns its own list outright.
    const doctorWho = await call(
      appRouter.group.create,
      { name: "bbb Doctor Who" },
      { context: asTheOwner },
    );
    const marvel = await call(
      appRouter.group.create,
      { name: "bbb Marvel" },
      { context: asTheOwner },
    );
    const crossover = await anItem(db);
    await call(
      appRouter.group.put,
      { groupId: doctorWho.id, itemId: crossover },
      { context: asTheOwner },
    );
    await call(
      appRouter.group.put,
      { groupId: marvel.id, itemId: crossover },
      { context: asTheOwner },
    );

    await call(
      appRouter.group.take,
      { groupId: marvel.id, itemId: crossover },
      { context: asTheOwner },
    );

    const item = await call(appRouter.item.get, { id: crossover }, { context });
    expect(item.groups).toStrictEqual([{ id: doctorWho.id, name: "bbb Doctor Who" }]);
  });

  it("answers NOT_FOUND when the Item is not in that scope", async () => {
    const group = await call(
      appRouter.group.create,
      { name: "bbb Empty" },
      { context: asTheOwner },
    );

    const { error } = await safe(
      call(
        appRouter.group.take,
        { groupId: group.id, itemId: await anItem(db) },
        { context: asTheOwner },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("NOT_FOUND");
  });
});

describe("group.delete", () => {
  it("deletes the scope and LEAVES ITS ITEMS ALONE", async () => {
    // ADR-0010'S PROMISE (story 34), asserted where the Owner would find out it
    // had been broken: the Item's own page. A scope is not a container that can
    // be emptied by accident.
    const group = await call(
      appRouter.group.create,
      { name: "ccc A scope to delete" },
      { context: asTheOwner },
    );
    const story = await anItemTitled(db, "The Ark in Space");
    await call(appRouter.group.put, { groupId: group.id, itemId: story }, { context: asTheOwner });

    await call(appRouter.group.delete, { id: group.id }, { context: asTheOwner });

    const item = await call(appRouter.item.get, { id: story }, { context });
    expect(item).toStrictEqual(
      expect.objectContaining({ id: story, title: "The Ark in Space", groups: [] }),
    );
    const { groups } = await call(appRouter.group.list, {}, { context });
    expect(groups).not.toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ id: group.id })]),
    );
  });

  it("answers NOT_FOUND for a scope that is already gone", async () => {
    const group = await call(
      appRouter.group.create,
      { name: "ccc Deleted twice" },
      { context: asTheOwner },
    );
    await call(appRouter.group.delete, { id: group.id }, { context: asTheOwner });

    const { error } = await safe(
      call(appRouter.group.delete, { id: group.id }, { context: asTheOwner }),
    );

    expect(isDefinedError(error) && error.code).toBe("NOT_FOUND");
  });
});

/**
 * An Owner's context on an instance that names exactly these Providers.
 *
 * NO SOCKET BEHIND ANY OF THEM, because nothing in this file asks a Provider
 * anything: which Providers a Group asks is this instance's configuration and
 * the Owner's choice among it. `provider.test.ts` is where the asking is
 * asserted, against stubs that answer.
 */
const naming = (...providers: string[]) => ({
  ...asTheOwner,
  providerSettings: async () => ({ allowlist: parseAllowlist(""), urls: providers }),
});

describe("group.ask", () => {
  it("refuses a Provider this instance does not search, rather than keeping a hidden list", async () => {
    // A GROUP PICKS AMONG THE CONFIGURED PROVIDERS AND DOES NOT ADD TO THEM
    // (ADR-0121). A URL asked for here that settings does not name would be a
    // second list of Providers nobody can see, reached the day somebody named
    // it for some other reason.
    const { id } = await call(
      appRouter.group.create,
      { name: "Asks the wrong thing" },
      { context: asTheOwner },
    );

    const { error } = await safe(
      call(
        appRouter.group.ask,
        { id, baseUrl: "http://tmdb.test" },
        { context: naming("http://wiki.test:8080") },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
  });

  it("refuses a Group that is not there", async () => {
    const { error } = await safe(
      call(
        appRouter.group.ask,
        { id: crypto.randomUUID(), baseUrl: "http://wiki.test:8080" },
        { context: naming("http://wiki.test:8080") },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
  });
});

describe("group.asks", () => {
  it("answers the Providers the Group asks, among those this instance names, in its order", async () => {
    // WHAT `/groups` RENDERS, and the same answer `provider.search` acts on:
    // one reading of "which Providers does this Group ask", so the page cannot
    // show a Provider as asked that the search would not reach.
    const wiki = "http://wiki.test:8080";
    const archive = "http://archive.test";
    const removed = "http://removed.test";
    const { id } = await call(
      appRouter.group.create,
      { name: "Asks two of three" },
      { context: asTheOwner },
    );
    for (const baseUrl of [archive, wiki, removed]) {
      await call(appRouter.group.ask, { id, baseUrl }, { context: naming(wiki, archive, removed) });
    }

    expect(
      await call(
        appRouter.group.asks,
        { id },
        { context: naming(wiki, "http://tmdb.test", archive) },
      ),
    ).toStrictEqual({ providers: [wiki, archive] });
  });
});

describe("who may ask", () => {
  it("refuses a visitor with no session on every mutation, and answers their read", async () => {
    // ADR-0044 makes the demo READ-ONLY: everything that changes a catalogue is
    // behind a session (CNCORE-109). Asserted on EVERY procedure rather than on
    // one, because the guard is declared per procedure and a new one added
    // without it would be reachable by anyone who can reach the process.
    //
    // AND THE READ IS ASSERTED IN THE SAME TEST, because "which scopes exist"
    // being open is a decision rather than an omission: ADR-0072 gives a
    // visitor everything on the catalogue, and the buttons are what refuse
    // them. A suite that only checked the refusals would go green on a `list`
    // that had quietly become the Owner's.
    const group = await call(
      appRouter.group.create,
      { name: "ddd Visible to a visitor" },
      { context: asTheOwner },
    );
    const story = await anItem(db);

    const refusals = await Promise.all([
      safe(call(appRouter.group.create, { name: "Mine now" }, { context })),
      safe(call(appRouter.group.rename, { id: group.id, name: "Mine now" }, { context })),
      safe(call(appRouter.group.delete, { id: group.id }, { context })),
      safe(call(appRouter.group.put, { groupId: group.id, itemId: story }, { context })),
      safe(call(appRouter.group.take, { groupId: group.id, itemId: story }, { context })),
      safe(call(appRouter.group.ask, { id: group.id, baseUrl: "http://wiki.test" }, { context })),
      safe(
        call(
          appRouter.group.stopAsking,
          { id: group.id, baseUrl: "http://wiki.test" },
          { context },
        ),
      ),
      // AND THE ONE READ THAT IS THE OWNER'S: which Providers a scope asks is
      // this instance's configuration rather than the catalogue (CNCORE-182).
      safe(call(appRouter.group.asks, { id: group.id }, { context })),
    ]);

    expect(refusals.map(({ error }) => (error as { code?: string })?.code)).toStrictEqual([
      "UNAUTHORIZED",
      "UNAUTHORIZED",
      "UNAUTHORIZED",
      "UNAUTHORIZED",
      "UNAUTHORIZED",
      "UNAUTHORIZED",
      "UNAUTHORIZED",
      "UNAUTHORIZED",
    ]);
    const { groups } = await call(appRouter.group.list, {}, { context });
    expect(groups).toStrictEqual(
      expect.arrayContaining([{ id: group.id, name: "ddd Visible to a visitor" }]),
    );
  });
});
