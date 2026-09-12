import type { ClientPromiseResult, ORPCErrorCode } from "@orpc/client";
import { ORPCError, safe } from "@orpc/server";

/**
 * WHAT A PROCEDURE ANSWERED, read as the two things an answer can be.
 *
 * A REFUSAL IS AN ANSWER, NOT A CRASH -- the rule `/api/rpc` already applies to
 * the same errors one layer over, and `login/actions.ts` already states in its
 * own words. A Server Action calls its procedure with `call(...)`, and oRPC
 * raises an `ORPCError` for anything that procedure declines: an input its
 * `.input()` schema refuses, a caller with no session (CNCORE-109), a row that
 * is not there. Thrown out of a Server Action, none of those is a redirect and
 * none is an HTTP access-fallback error -- so Next answers the bare
 * `Internal Server Error` (`action-handler.js`, the non-fetch branch), which
 * tells a reader the server is broken when what happened is that they asked.
 *
 * `status` RATHER THAN A LIST OF CODES, which is the reason `/api/rpc` gives
 * and which holds harder here: a list would have to be added to by every
 * procedure that learns a new refusal, and the one nobody remembered would
 * reach the owner as a 500. `ORPCError` carries the status it would answer
 * with, so "below 500" is the whole test. Anything at 500 or above, and
 * anything that is not an `ORPCError` at all -- a bug in a handler, a query
 * that failed -- is a genuine fault and goes on being thrown.
 *
 * A REFUSAL IS AN `ORPCError` AND THE TYPE SAYS SO, which is what stops the
 * caller asking again. `call` infers its error as the procedure's declared map
 * WIDENED to anything throwable -- the honest type for a `throw`, and the
 * reason `login/actions.ts` used to open with `error instanceof ORPCError`
 * before it could read a code. Everything throwable that is not a refusal has
 * already been rethrown by the time this is handed back, so the intersection is
 * a narrowing this function has actually done rather than a claim about it.
 */
export type Answered<TOutput, TError> =
  | { readonly answered: TOutput; readonly refused: undefined }
  | {
      readonly answered: undefined;
      readonly refused: TError & ORPCError<ORPCErrorCode, unknown>;
    };

/**
 * ONE ASK, AND WHAT COMES BACK IS THE ANSWER OR THE REFUSAL (CNCORE-127).
 *
 * THE RULE IS WRITTEN ONCE, WHICH IS THE POINT OF IT. `whatTheFormCarries` is
 * the same shape one step earlier: a form field is input whoever rendered the
 * form, and a procedure's refusal is an answer whoever asked for it. Written
 * per action instead, the site nobody remembered would be the site that 500s --
 * which is exactly how this defect survived CNCORE-123, where two actions
 * happened to declare `z.uuid()` on both sides and the rest did not.
 *
 * AND NOT BY RESTATING THE ROUTER'S SCHEMA IN THE ACTION, which is the obvious
 * move and the wrong one: `items/actions.ts` says "the rule about what a write
 * accepts lives in one place", and a second copy is a second place for the two
 * to disagree. The action goes on declaring only what it needs to READ the
 * form; what a write ACCEPTS stays the procedure's to say.
 *
 * WHAT A REFUSAL MEANS IS THEN THE ACTION'S, and most of them have nothing to
 * add: the action writes nothing and the page it was posted to renders again,
 * which is what five of these docstrings already say they do. That is Next's
 * whole palette rather than a preference -- ADR-0066 reads the four ways an
 * action can end out of the installed 16.3.4 and finds no 400 among them. An
 * action WITH something to say about a particular refusal reads `refused`
 * instead, which is how `/login` tells a mistyped password from a bound that is
 * holding.
 *
 * `safe` RATHER THAN `try`, because `redirect()` works by THROWING and every
 * caller here redirects. It is only the `call` that is handed over, so a
 * redirect raised on the outcome is nobody's to catch -- but a `try` written at
 * a call site would be one `catch` away from swallowing it as a refusal.
 */
export async function whatTheProcedureAnswered<TOutput, TError>(
  work: ClientPromiseResult<TOutput, TError>,
): Promise<Answered<TOutput, TError>> {
  const answer = await safe(work);
  if (answer.isSuccess) return { answered: answer.data, refused: undefined };
  if (answer.error instanceof ORPCError && answer.error.status < 500) {
    return { answered: undefined, refused: answer.error };
  }
  throw answer.error;
}
