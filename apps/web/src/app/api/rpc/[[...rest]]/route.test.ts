import type { AppRouterClient } from "@canoncore/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

/**
 * ADR-0103 leaves the catch-all route uncovered, on the grounds that Next
 * documents no unit-testing path for route handlers. The handler is an ordinary
 * function of a Request, though, so it can be driven directly without booting
 * Next -- and it is the longest thing in the generated output to get right.
 */
async function callRoute(request: Request): Promise<Response> {
  const handler = request.method === "GET" ? GET : POST;
  // NextRequest extends Request; the handler only reads url, method and body.
  const { NextRequest } = await import("next/server");
  return handler(new NextRequest(request));
}

const client: AppRouterClient = createORPCClient(
  new RPCLink({
    url: "http://localhost/api/rpc",
    fetch: (_url, init) => callRoute(new Request(_url, init)),
  }),
);

/**
 * WHAT THE MOUNT WROTE TO THE OWNER'S LOG. The interceptor is only observable
 * through `console.error`, so the spy IS the seam's output here -- the response
 * says what the caller was told, and this says what the owner was told.
 */
let faultsLogged: unknown[][];
beforeEach(() => {
  faultsLogged = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    faultsLogged.push(args);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("the catch-all oRPC route", () => {
  it("answers healthCheck over the RPC protocol", async () => {
    await expect(client.healthCheck()).resolves.toBe("OK");
  });

  it("serves an OpenAPI document naming healthCheck", async () => {
    const response = await callRoute(
      new Request("http://localhost/api/rpc/api-reference/spec.json"),
    );
    expect(response.status).toBe(200);
    const spec = (await response.json()) as { paths?: Record<string, unknown> };
    expect(Object.keys(spec.paths ?? {})).toContain("/healthCheck");
  });
});

describe("what the mount writes to the owner's log", () => {
  /**
   * ADR-0125: a line per ARRIVING request is a way to fill an owner's disk from
   * the outside. `UNAUTHORIZED` is what `ownerProcedure` answers anyone with no
   * session (CNCORE-109), so this is a refusal a stranger can ask for as fast as
   * the process serves.
   */
  it("says nothing when a caller with no session is refused, however often they ask", async () => {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      await expect(
        client.item.create({ kind: "work", title: "A title nobody is allowed to write" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    expect(faultsLogged).toEqual([]);
  });
});
