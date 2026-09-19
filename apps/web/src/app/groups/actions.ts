"use server";

import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { whatTheProcedureAnswered } from "@/answer";
import { whatTheFormCarries } from "@/form";
import { callerContext } from "@/session";

/**
 * DRAWING, RENAMING AND DELETING A BROWSING SCOPE, and choosing which
 * Providers it asks, as Server Actions (CNCORE-178, CNCORE-182).
 *
 * THE PROCEDURE IS WRITTEN ONCE AND EXPOSED TWICE, which is the shape every
 * action file here takes: `group.create`, `group.rename` and `group.delete`
 * carry their own Zod input in the router, and these are a second door onto
 * them. So what a write accepts is decided in one place.
 *
 * THEY NEED NO JAVASCRIPT. React posts a form bound to a Server Action as an
 * ordinary `multipart/form-data` request when no script has loaded, which is
 * why this surface is asserted at the page-over-HTTP seam with no browser.
 *
 * A FORM FIELD IS INPUT, whoever rendered the form, so everything below is read
 * through `whatTheFormCarries` rather than trusted -- and a procedure's refusal
 * is an answer rather than a crash, which is `whatTheProcedureAnswered`.
 *
 * NO REDIRECT ON DRAWING OR RENAMING, which is the difference from `createItem`
 * one folder over and follows from where the forms POST. Each posts to
 * `/groups`, so the response IS that page rendered again with the scopes as
 * they now stand. `createItem` redirects because an Owner who has just made an
 * Item wants the Item, and a Group has no page of its own to be sent to -- it
 * is a scope other surfaces are read THROUGH (ADR-0010). Deleting is the
 * exception, and `deleteGroup` gives the reason.
 *
 * `refresh()` IS FOR THE HALF THIS APP'S TEST SEAM CANNOT SEE, exactly as
 * `retitleItem` records: with no script the sentence above is the whole story,
 * and with script loaded there is a CLIENT router cache holding the page the
 * Owner is looking at.
 */

/** What the draw form carries: what the Owner is calling this scope. */
const drawnGroup = z.object({ name: z.string() });

export async function drawGroup(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, drawnGroup);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.group.create, input, { context: await callerContext() }),
  );
  if (refused) return;
  refresh();
}

/** What the rename form carries: which scope, and what the Owner now calls it. */
const renamedGroup = z.object({ id: z.string(), name: z.string() });

export async function renameGroup(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, renamedGroup);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.group.rename, input, { context: await callerContext() }),
  );
  if (refused) return;
  refresh();
}

/** What the delete form carries: which scope. */
const deletedGroup = z.object({ id: z.string() });

/**
 * Deleting a scope, WHICH TAKES NO ITEM WITH IT (ADR-0010, story 34), once the
 * Owner has been shown what it does take (ADR-0046, CNCORE-210).
 *
 * THE ONE OF THE THREE THAT REDIRECTS, because it is the one that does not post
 * from `/groups`: its button is on the confirmation at `/groups?delete=<id>`,
 * and the page to come back to is the list. A redirect whether or not the
 * procedure refused, because a scope another tab deleted first is the same
 * answer: the list, without it.
 *
 * COUNTS-FIRST IS THE PAGE'S SHAPE RATHER THAN THIS ACTION'S GUARANTEE, for
 * `purgeProvider`'s reason: `/api/rpc` carries `group.delete` too, so a check
 * here would bound the form and not the operation.
 */
export async function deleteGroup(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, deletedGroup);
  if (input === undefined) return;

  await whatTheProcedureAnswered(
    call(appRouter.group.delete, input, { context: await callerContext() }),
  );
  redirect("/groups");
}

/** What an ask or a stop carries: which scope, and which Provider by the URL that is its identity. */
const askedProvider = z.object({ id: z.string(), baseUrl: z.string() });

/**
 * Telling a scope to ask one Provider when the Owner searches within it
 * (CNCORE-182, ADR-0025).
 */
export async function askProvider(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, askedProvider);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.group.ask, input, { context: await callerContext() }),
  );
  if (refused) return;
  refresh();
}

/**
 * Telling a scope to stop asking one Provider. No confirmation, for the reason
 * taking an Item out gets none (ADR-0046): asking again is one click and the
 * same row.
 */
export async function stopAskingProvider(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, askedProvider);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.group.stopAsking, input, { context: await callerContext() }),
  );
  if (refused) return;
  refresh();
}
