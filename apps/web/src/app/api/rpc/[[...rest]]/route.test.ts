import type { AppRouterClient } from "@canoncore/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { ORPCError, os } from "@orpc/server";
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

/**
 * The REAL route module, mounted on a router that does the one thing the app's
 * own procedures will not do to order: fail.
 *
 * A STAND-IN ROUTER RATHER THAN A STAND-IN LOG. What is under test is the
 * interceptor this file's other tests reach through the real router, so the
 * route module, both handlers and the interceptor are all the shipped ones --
 * only what they are mounted on is swapped, because a fault has to come from
 * somewhere and no procedure on this surface can be asked for one. Driving a
 * real database into failure would need the database this suite deliberately
 * does without.
 */
async function callRouteMountedOn(faulting: () => never): Promise<Response> {
  vi.resetModules();
  vi.doMock("@canoncore/api/routers", () => ({ appRouter: { boom: os.handler(faulting) } }));
  try {
    const { POST } = await import("./route");
    const { NextRequest } = await import("next/server");
    return await POST(
      new NextRequest(
        new Request("http://localhost/api/rpc/boom", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: '{"json":{}}',
        }),
      ),
    );
  } finally {
    vi.doUnmock("@canoncore/api/routers");
    vi.resetModules();
  }
}

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

  /**
   * THE OTHER HALF, AND WHAT THE INTERCEPTOR IS ACTUALLY FOR. A fault is a fact
   * about this server rather than about what was asked of it, so it is written
   * whole -- and the stack is the part an owner cannot reconstruct from the
   * response, which says only "Internal server error".
   */
  it("logs a thrown error in full, with its stack", async () => {
    const thrown = new Error("the connection pool is dead");

    const response = await callRouteMountedOn(() => {
      throw thrown;
    });

    expect(response.status).toBe(500);
    expect(faultsLogged).toEqual([[thrown]]);
    expect(faultsLogged[0]?.[0]).toHaveProperty("stack", expect.stringContaining(thrown.message));
  });

  /**
   * AND BEING AN `ORPCError` IS NOT WHAT MAKES SOMETHING AN ANSWER -- the status
   * is. oRPC raises this one itself when a handler answers something its
   * `.output()` does not allow, which is a bug in this app rather than a thing
   * any caller asked for.
   */
  it("logs a fault that arrives as an ORPCError at 500", async () => {
    const thrown = new ORPCError("INTERNAL_SERVER_ERROR");

    const response = await callRouteMountedOn(() => {
      throw thrown;
    });

    expect(response.status).toBe(500);
    expect(faultsLogged).toEqual([[thrown]]);
  });
});
