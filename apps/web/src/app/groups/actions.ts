"use server";

import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
import { refresh } from "next/cache";
import { z } from "zod";

import { whatTheProcedureAnswered } from "@/answer";
import { whatTheFormCarries } from "@/form";
import { callerContext } from "@/session";

/**
 * DRAWING, RENAMING AND DELETING A BROWSING SCOPE, as Server Actions
 * (CNCORE-178).
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
 * NO REDIRECT ON ANY OF THE THREE, which is the difference from `createItem`
 * one folder over and follows from where the forms POST. Each of these posts to
 * `/groups`, so the response IS that page rendered again with the scopes as
 * they now stand. `createItem` redirects because an Owner who has just made an
 * Item wants the Item, and a Group has no page of its own to be sent to -- it
 * is a scope other surfaces are read THROUGH (ADR-0010).
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
 * Deleting a scope, WHICH TAKES NO ITEM WITH IT (ADR-0010, story 34).
 *
 * TODO(CNCORE-210): THIS DELETE IS PERMANENT AND CARRIES NO CONFIRMATION, and
 * ADR-0046 asks for one. An earlier draft of this docstring claimed the record
 * endorsed the omission -- "ADR-0046's test applied: what makes an action safe
 * is what it costs to undo" -- and THAT TEST IS NOT IN THE RECORD. What it
 * actually says is "DELETE PERMANENTLY keeps a confirmation that is never
 * dismissible by accident", against "REMOVE FROM THIS CONTAINER gets no dialog
 * at all and offers undo instead". Taking an Item out of a Group is the second
 * kind and rightly has no dialog; deleting the Group is the first kind, and
 * there is no restore procedure for one.
 *
 * WHAT IS TRUE IS THE MITIGATION, NOT THE EXEMPTION: deleting a scope takes no
 * Item with it, so what it costs is the scope's own membership list, and the
 * page says so above the button. That is why this ships without the dialog
 * rather than why it does not need one -- ADR-0046 rules on deleting an ITEM
 * and has never been applied to a Group, so the confirmation is owed and is a
 * surface of its own (CNCORE-69 built the purge's, which is the pattern).
 */
export async function deleteGroup(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, deletedGroup);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.group.delete, input, { context: await callerContext() }),
  );
  if (refused) return;
  refresh();
}
