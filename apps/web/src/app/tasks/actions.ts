"use server";

import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
import { z } from "zod";

import { given } from "@/form";
import { callerContext } from "@/session";

/**
 * What the Run and Cancel buttons carry, read as data rather than trusted.
 *
 * A HIDDEN FIELD IS STILL A REQUEST BODY, whoever rendered the form. What it
 * names is a task this instance is about to do work for, so it is parsed here
 * and checked against the registry by the procedure -- which is that
 * procedure's job rather than this one's, because a second surface would be a
 * second place for the two to disagree about which keys exist.
 */
const theTaskNamed = z.object({ key: z.string() });

/**
 * Runs one task now (ADR-0049).
 *
 * IT RETURNS NOTHING AND THE PAGE REPORTS BY RE-READING, which is the rule
 * `/devices` and `/import` both take and has the same reason: an action's
 * return value reaches a page only through `useActionState`, a client hook, so
 * reporting through it would make this surface's answer depend on JavaScript.
 * The run that was not in the history before the POST is in the one after it,
 * which is the whole report.
 *
 * A TASK THAT BROKE DOES NOT THROW HERE. `task.run` answers `failed` with the
 * reason in it, and the re-rendered list is where the owner reads it -- which
 * is ADR-0049's minimum met by the ordinary path rather than by an error page.
 */
export async function runTask(form: FormData): Promise<void> {
  const input = given(form, theTaskNamed);
  if (input === undefined) return;

  await call(appRouter.task.run, input, { context: await callerContext() });
}

/**
 * Stops a task that is running.
 *
 * NOTHING RUNNING IS NOT A FAULT. The list this was pressed from is a moment
 * old, so a task that finished in between is an ordinary race -- and the answer
 * the owner wants is the same either way, which is a list without it running
 * on.
 */
export async function cancelTask(form: FormData): Promise<void> {
  const input = given(form, theTaskNamed);
  if (input === undefined) return;

  await call(appRouter.task.cancel, input, { context: await callerContext() });
}
