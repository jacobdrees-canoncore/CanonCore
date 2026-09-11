import type { Database } from "@canoncore/db";
import { anItemTitled, connect } from "@canoncore/db/testing/catalogue";
import { call } from "@orpc/server";
import { beforeAll, describe, expect, it } from "vitest";

import { createContext } from "../context";
import { appRouter } from "./index";

/**
 * ADR-0103's second seam: the router called in the same process, with context
 * built by the real `createContext` rather than hand-copied from it.
 */
const context = await createContext();

let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("catalogue.list", () => {
  it("answers with what the catalogue holds, and how much of it there is", async () => {
    const id = await anItemTitled(db, "A story on the front page");

    const catalogue = await call(appRouter.catalogue.list, {}, { context });

    expect(catalogue.entries).toContainEqual(
      expect.objectContaining({ id, title: "A story on the front page" }),
    );
    expect(catalogue.total).toBeGreaterThanOrEqual(catalogue.entries.length);
  });

  it("names every field an entry emits, and no internal one", async () => {
    // ADR-0045. The same enumeration oracle `item.get` carries, for the same
    // reason: never the query's row with fields removed, because a strip-list
    // works right up until somebody adds a column and forgets. `owner_id`, the
    // change sequence, the merge stamp and `holds_work` are all absent because
    // no line was written for them.
    await anItemTitled(db, "Named in a listing");

    const { entries } = await call(appRouter.catalogue.list, { limit: 1 }, { context });
    const [entry] = entries;
    if (!entry) throw new Error("the catalogue answered with nothing to enumerate");

    expect(Object.keys(entry).sort()).toStrictEqual(["id", "isContainer", "kind", "title"]);
  });

  it("refuses to answer with more than a page at a time", async () => {
    // THE CEILING IS THIS APP'S, not the caller's. A limit a request can raise
    // is not a cap on anything -- the cost of one answer would be a function of
    // what somebody asked for rather than of what this app chose to serve.
    const asked = call(appRouter.catalogue.list, { limit: 5_000 }, { context });

    await expect(asked).rejects.toThrow();
  });
});
