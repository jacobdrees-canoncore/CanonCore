import { inspect } from "node:util";

import { createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { NextRequest } from "next/server";

import { isARefusal } from "@/answer";
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
 * `ORPCError` at all -- a bug in a handler, a query that failed -- is a genuine
 * fault and is logged in full, with its stack, because that is what this exists
 * for.
 *
 * AND THAT TEST IS NOW IMPORTED RATHER THAN WRITTEN HERE (CNCORE-127). The
 * Server Action path asks the same question of the same errors -- there, to
 * answer with the page instead of a 500 -- and had the line copied into it. The
 * paragraph below about two handlers is the same argument at a smaller scale:
 * one decision written twice is free to drift, and a drift here would mean one
 * of the two surfaces calling a refusal a fault.
 *
 * WHAT THIS CLASSIFIES IS WHAT REACHES IT, AND `createContext` RUNS BEFORE ANY
 * OF IT DOES. `handleRequest` builds the context first, and `seeSession` inside
 * it touches the database for any caller presenting a session cookie -- so a
 * dead pool on THAT path throws out of the handler entirely and is Next's to
 * report rather than this interceptor's. Measured: with `DATABASE_URL` pointed
 * at a closed port and a cookie on the request, the `DrizzleQueryError` escapes
 * `handleRequest` and this function is never called. That is unchanged by
 * CNCORE-120 and is not a hole in the rule above; it is the reason the rule is
 * stated about errors the HANDLERS raise.
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
  if (isARefusal(error)) return;
  console.error(asOneEvent(error));
}

/**
 * ONE ENTRY, AND THE CALLER CANNOT WRITE A SECOND (CNCORE-122).
 *
 * AN ERROR MESSAGE IS CALLER TEXT. `console.error(error)` renders an `Error` as
 * its `stack`, and V8 builds that string by pasting the message in RAW at the
 * top -- so a message holding a newline wrote a line into the owner's log that
 * the owner did not write. A CAUSE IS CALLER TEXT TOO, and by the same
 * mechanism: `inspect` renders a nested `Error` as its own raw stack, which is
 * why one is followed here rather than handed over whole.
 *
 * THE RULE, which ADR-0125 argues under "Bounded in COUNT is not bounded in
 * SHAPE" and does not need repeating here: caller text is QUOTED, and an entry
 * STARTS AT COLUMN 0 while nothing else does. Both are structural rather than
 * hoped for -- every span that could carry a newline goes through `inspect`,
 * and the single `indented` on the way out owns the margin for the whole entry,
 * frames and label included, so no future span can quietly opt out of it.
 *
 * `name` FOR THE SPAN AND THE CONSTRUCTOR FOR THE LABEL, which are two
 * different questions. `pastedAtop` has to be what V8 ACTUALLY pasted, or the
 * slice removing it would leave part of the message behind; the label is what
 * an owner scans for, and `ORPCError` and `DrizzleQueryError` both inherit a
 * `name` of `"Error"` while `console.error` named their class. Where the stack
 * does not begin with that span -- absent, or reassigned since -- no frame is
 * written rather than a guess at which lines came from V8, because a message
 * can carry a line that reads exactly like a frame.
 *
 * WHAT IS CARRIED ALONGSIDE IS WHAT `console.error` ALREADY WROTE: the code and
 * status on an `ORPCError`, the query and parameters on a driver fault. This is
 * about escaping what is written, not writing less than before.
 */
function asOneEvent(error: unknown, follow = FOLLOW_CAUSES): string {
  if (!(error instanceof Error)) return indented(inspect(error, ONE_LINE));

  const pastedAtop = error.message ? `${error.name}: ${error.message}` : error.name;
  const frames = error.stack?.startsWith(pastedAtop) ? error.stack.slice(pastedAtop.length) : "";

  // Rendered below rather than here, so a cause's message is quoted like any other.
  const carried: Record<string, unknown> = { ...error };
  delete carried.cause;
  const alongside = Object.keys(carried).length > 0 ? ` ${inspect(carried, ONE_LINE)}` : "";

  let causedBy = "";
  if (error.cause !== undefined) {
    causedBy =
      follow > 0
        ? `\ncaused by ${asOneEvent(error.cause, follow - 1)}`
        : "\ncaused by a chain longer than one entry follows";
  }

  const label = error.constructor?.name ?? error.name;
  return indented(`${label}: ${inspect(error.message, ONE_LINE)}${frames}${alongside}${causedBy}`);
}

/** Every line below the first belongs to the entry above it, so it is moved off the margin. */
function indented(text: string): string {
  return text.replaceAll("\n", "\n  ");
}

/**
 * `inspect` otherwise breaks a long value across lines to keep it under 80
 * columns, which is the one thing this must not do: the wrapped remainder is a
 * fresh line, and a long message is exactly what a caller controls.
 */
const ONE_LINE = { breakLength: Number.POSITIVE_INFINITY } as const;

/**
 * A CAUSE CHAIN IS SOMEBODY ELSE'S LENGTH, so following it is bounded. Two
 * covers what this surface actually raises -- a driver fault wrapping its pg
 * error, an oRPC failure wrapping its validation error -- and the bound is what
 * stops a cycle recursing and a long chain writing an entry sized by whoever
 * built it, which is the concern ADR-0125 exists for.
 */
const FOLLOW_CAUSES = 2;

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
