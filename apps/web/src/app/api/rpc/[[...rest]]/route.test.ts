import type { AppRouterClient } from "@canoncore/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { describe, expect, it } from "vitest";

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
