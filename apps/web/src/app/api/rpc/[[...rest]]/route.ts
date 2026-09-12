import { inspect } from "node:util";

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
 * `ORPCError` at all -- a bug in a handler, a query that failed -- is a genuine
 * fault and is logged in full, with its stack, because that is what this exists
 * for.
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
  if (error instanceof ORPCError && error.status < 500) return;
  console.error(asOneEvent(error));
}

/**
 * ONE ENTRY, AND THE CALLER CANNOT WRITE A SECOND (CNCORE-122).
 *
 * AN ERROR MESSAGE IS CALLER TEXT, which is the fact this exists for.
 * `console.error(error)` renders an `Error` as its `stack`, and V8 builds that
 * string by pasting the message in RAW at the top -- so a message holding a
 * newline writes a line into the owner's log that the owner did not write, and
 * an owner or the fail2ban-style tooling ADR-0125 names cannot tell it from a
 * line this process wrote. The driver is the live way in and needs no attack to
 * show it: a `DrizzleQueryError`'s message is `Failed query: <sql>` then
 * `params: <params>`, ALREADY TWO LINES, with the caller's parameters
 * interpolated into the second.
 *
 * THE BOUNDARY IS DRAWN TWICE, because "one line per event" cannot mean
 * discarding the stack -- a stack is multi-line by nature and is the half
 * CNCORE-120 kept on purpose:
 *
 * 1. **Caller text is quoted.** The message is rendered by `inspect`, so it
 *    arrives in quotes with its newlines escaped as `\n` -- the same rendering
 *    every other string in the entry already got, which is why the values in an
 *    output-validation failure were never the hole the message was. Inside the
 *    quotes is what somebody sent; outside them is what this process said.
 * 2. **An entry starts at column 0, and nothing else does.** V8 indents its own
 *    frames, `indented` puts the carried properties under the same rule, and
 *    `breakLength` stops `inspect` from wrapping a long value onto a fresh line
 *    of its own. So a line flush to the left margin is this app speaking, every
 *    time -- which is the rule a reader skims by and a log pattern is written
 *    against.
 *
 * WHAT IS CARRIED ALONGSIDE IS WHAT `console.error` ALREADY WROTE: the code and
 * status on an `ORPCError`, the query and parameters on a driver fault, and the
 * `cause` -- which is where oRPC puts the offending value when a handler answers
 * something its `.output()` does not allow. This ticket is about escaping what
 * is written, not about writing less than before.
 *
 * `name` FOR THE SPAN AND THE CONSTRUCTOR FOR THE LABEL, which are two
 * different questions. `said` has to be what V8 ACTUALLY pasted, or the slice
 * that removes it would leave some of the message behind; the label is what an
 * owner scans for, and `ORPCError` and `DrizzleQueryError` both inherit `name`
 * of `"Error"` while `console.error` named their class. If the stack does not
 * begin with the span -- no stack at all, or one reassigned since -- then where
 * the caller's text ends is not known, and no frame is written rather than a
 * guess at which ones came from V8.
 */
function asOneEvent(error: unknown): string {
  if (!(error instanceof Error)) return indented(inspect(error, ONE_LINE));

  const said = error.message ? `${error.name}: ${error.message}` : error.name;
  const frames = error.stack?.startsWith(said) ? error.stack.slice(said.length) : "";
  const carried = { ...error, ...(error.cause === undefined ? {} : { cause: error.cause }) };
  const rest = Object.keys(carried).length > 0 ? ` ${indented(inspect(carried, ONE_LINE))}` : "";

  return `${error.constructor.name}: ${inspect(error.message, ONE_LINE)}${frames}${rest}`;
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
