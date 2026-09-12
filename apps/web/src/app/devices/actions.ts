"use server";

import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
import { z } from "zod";

import { whatTheProcedureAnswered } from "@/answer";
import { whatTheFormCarries } from "@/form";
import { callerContext } from "@/session";

/**
 * What the End button carries, read as data rather than trusted.
 *
 * A HIDDEN FIELD IS STILL A REQUEST BODY, whoever rendered the form. What it
 * names is a session this instance is about to end, so it is parsed as a uuid
 * here and checked against the caller's own session by `session.end` -- which is
 * the procedure's job rather than this one's, because a second surface would be
 * a second place for the two rules to disagree.
 */
const theDeviceNamed = z.object({ id: z.uuid() });

/**
 * Logs one OTHER device out (ADR-0043's per-device logout).
 *
 * IT RETURNS NOTHING AND THE PAGE REPORTS BY RE-READING, which is the rule
 * `/import` takes and has the same reason: an action's return value reaches a
 * page only through `useActionState`, a client hook, so reporting through it
 * would make this surface's answer depend on JavaScript. The device that was on
 * the list before the POST is not on the one after it, which is the whole
 * report.
 *
 * NOT THIS BROWSER'S OWN SESSION, which `session.end` refuses. Logging THIS
 * device out is `/login`'s button: it ends the row AND takes the cookie off the
 * browser, and the two halves have to happen together.
 */
export async function endDevice(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, theDeviceNamed);
  if (input === undefined) return;

  await whatTheProcedureAnswered(
    call(appRouter.session.end, input, { context: await callerContext() }),
  );
}
