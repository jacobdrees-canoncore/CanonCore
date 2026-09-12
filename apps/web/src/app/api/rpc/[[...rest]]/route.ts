import { createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/session";

/**
 * THE ONE THING THIS MOUNT SAYS TO THE OWNER, and it says it about faults only
 * (ADR-0125, CNCORE-120).
 *
 * A REFUSED REQUEST IS AN ANSWER, NOT A CRASH -- the rule `login/actions.ts`
 * already states in its own words. `UNAUTHORIZED` is what every write procedure
 * tells a caller with no session (CNCORE-109) and `TOO_MANY_REQUESTS` is the
 * login bound holding; both are things this surface CHOSE to say, and a stack
 * trace for one tells an owner reading their log that their server is broken
 * when what happened is that somebody mistyped a password.
 *
 * AND SAYING IT AT ALL WOULD BE UNBOUNDED, WHICH IS THE HALF THAT IS NOT A
 * MATTER OF TASTE. This runs once per ARRIVING request, so any line written
 * here -- at any level -- is a line a stranger can ask for as fast as the
 * process serves, which is ADR-0125's "a way to fill an owner's disk from the
 * outside". There is no level at which a per-request line is bounded, so the
 * answer is no line. The bounded log of a refusal is written where the refusal
 * is COUNTED: `login-bound.ts` writes one per CHECKED refusal, four a minute at
 * worst, which is the surface that survives a flood.
 *
 * `status` RATHER THAN A LIST OF CODES, because a list would have to be added
 * to by every procedure that learns a new refusal -- and the one nobody
 * remembered would be logged as a fault. `ORPCError` carries the status it will
 * answer with, so "below 500" is the whole test: the caller was told what they
 * asked for was refused. Anything at 500 or above, and anything that is not an
 * `ORPCError` at all -- a dead connection pool, a bug -- is a genuine fault and
 * is logged in full, with its stack, because that is what this exists for.
 *
 * ONE RULE FOR BOTH HANDLERS. They mount the same router and answer the same
 * refusals, so two copies would be one decision written twice and free to
 * drift. It is the CALLBACK that is shared rather than the `onError(...)`
 * around it, because that helper's return type is inferred from the handler it
 * is handed to -- hoisted into a `const` it infers `unknown` and neither
 * handler accepts it.
 *
 * `unknown` RATHER THAN oRPC'S `Error`, because a `throw` is not obliged to
 * carry one and the first branch here has to be allowed to ask.
 */
function sayWhatBroke(error: unknown): void {
  if (error instanceof ORPCError && error.status < 500) return;
  console.error(error);
}

const rpcHandler = new RPCHandler(appRouter, { interceptors: [onError(sayWhatBroke)] });
const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [onError(sayWhatBroke)],
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
