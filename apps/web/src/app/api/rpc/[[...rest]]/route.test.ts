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
async function callRoute(
  request: Request,
  handler = request.method === "GET" ? GET : POST,
): Promise<Response> {
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
    return await callRoute(
      new Request("http://localhost/api/rpc/boom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"json":{}}',
      }),
      POST,
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
   * EVERY LEVEL, NOT JUST `error`. ADR-0125's claim is that a quieter line was
   * never the answer -- anything written once per ARRIVING request is unbounded
   * whatever it is called -- so a spy watching `console.error` alone would pass
   * a change that moved the line to `console.warn` and left the claim false.
   * Each level is captured separately, because `login-bound.ts` writes its own
   * BOUNDED line at `warn` and the whole point is telling the two apart.
   */
  const written: Record<"error" | "warn" | "info" | "log" | "debug", unknown[][]> = {
    error: [],
    warn: [],
    info: [],
    log: [],
    debug: [],
  };
  beforeEach(() => {
    for (const level of Object.keys(written) as (keyof typeof written)[]) {
      written[level] = [];
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        written[level].push(args);
      });
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Everything the mount wrote, at any level, in one list. */
  const everythingWritten = (): unknown[][] => Object.values(written).flat();

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

    expect(everythingWritten()).toEqual([]);
  });

  /**
   * THE SECOND REFUSAL ADR-0125 NAMES, and the one that shows what the record
   * actually claims: the mount says nothing, and the line an owner DOES get is
   * the one written where the refusal was COUNTED.
   *
   * SO THE ASSERTION IS A RATIO RATHER THAN A COUNT. Every attempt here arrives;
   * only the ones with allowance left are CHECKED, and only a checked refusal
   * writes. Asserting "one line per checked refusal, and fewer lines than
   * arrivals" is the bound itself, and it does not depend on how many attempts
   * the allowance happens to cover on the machine running it.
   */
  it("says nothing when the login bound holds, and leaves that line to the bound", async () => {
    const answers: string[] = [];
    for (let attempt = 0; attempt < 41; attempt += 1) {
      const refusal = await client.session
        .logIn({ password: "not the owner's password" })
        .then(() => "let in")
        .catch((error: unknown) => (error instanceof ORPCError ? error.code : "something else"));
      answers.push(refusal);
    }

    // The bound held: arriving attempts outran checked ones.
    expect(answers).toContain("TOO_MANY_REQUESTS");
    expect(written.error).toEqual([]);
    // One line per CHECKED refusal, and nothing for the attempts turned away.
    expect(written.warn).toHaveLength(answers.filter((code) => code === "UNAUTHORIZED").length);
    expect(written.warn.length).toBeLessThan(answers.length);
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
    expect(written.error).toEqual([[thrown]]);
    expect(written.error[0]?.[0]).toHaveProperty("stack", expect.stringContaining(thrown.message));
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
    expect(written.error).toEqual([[thrown]]);
  });
});
