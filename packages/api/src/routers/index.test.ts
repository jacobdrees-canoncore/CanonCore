import { healthCheckResult } from "@canoncore/schemas";
import { call, createRouterClient } from "@orpc/server";
import { describe, expect, it } from "vitest";

import { createContext } from "../context";
import { appRouter } from "./index";

// Built by the real context factory rather than hand-copied from it, so that a
// change to what a request carries reaches these tests instead of passing them.
const context = await createContext();

describe("appRouter", () => {
  // oRPC's own testing guidance is to call procedures in the same process
  // rather than over HTTP: it exercises validation, middleware and the handler
  // without booting Next. The route's HTTP mount is covered separately, in
  // apps/web/src/app/api/rpc/[[...rest]]/route.test.ts.
  it("answers the health check", async () => {
    await expect(call(appRouter.healthCheck, undefined, { context })).resolves.toBe("OK");
  });

  it("answers with a value its published contract accepts", async () => {
    // Ties the router to the shared schema package: if the handler and the
    // contract diverge, the OpenAPI document starts lying about the API.
    const answer = await call(appRouter.healthCheck, undefined, { context });
    expect(healthCheckResult.safeParse(answer).success).toBe(true);
  });

  it("is reachable through a router client", async () => {
    // The other entry point oRPC documents, and the one apps/web uses.
    const client = createRouterClient(appRouter, { context });
    await expect(client.healthCheck()).resolves.toBe("OK");
  });
});
