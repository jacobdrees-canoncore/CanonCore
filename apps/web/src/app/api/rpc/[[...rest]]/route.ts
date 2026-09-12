import { createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/session";

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});
const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

async function handleRequest(req: NextRequest) {
  /*
   * THE CALLER'S OWN SESSION, off the request rather than out of `cookies()`.
   * Both work in a route handler; this one is already holding the request, and a
   * handler that reads the ambient store when it has the thing itself is a
   * handler that cannot be called with a `Request` in a test -- which is exactly
   * how ADR-0103's third seam drives this file.
   *
   * BUILT ONCE FOR BOTH HANDLERS, because a session lookup touches the database
   * and the second handler only ever runs when the first declined the request.
   */
  const context = await createContext({
    sessionToken: req.cookies.get(SESSION_COOKIE)?.value,
  });

  const rpcResult = await rpcHandler.handle(req, { prefix: "/api/rpc", context });
  if (rpcResult.response) return rpcResult.response;

  const apiResult = await apiHandler.handle(req, {
    prefix: "/api/rpc/api-reference",
    context,
  });
  if (apiResult.response) return apiResult.response;

  return new Response("Not found", { status: 404 });
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
