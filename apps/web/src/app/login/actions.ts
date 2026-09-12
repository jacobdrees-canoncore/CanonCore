"use server";

import { appRouter } from "@canoncore/api/routers";
import { call, ORPCError, safe } from "@orpc/server";
import { redirect } from "next/navigation";
import { z } from "zod";

import { callerContext, forgetSession, rememberSession } from "@/session";

/** What the form carries. A password is a string; nothing here judges it. */
const offered = z.object({ password: z.string() });

/**
 * The owner's password, exchanged for the session everything that writes needs.
 *
 * IT REDIRECTS ON BOTH OUTCOMES, which is the one place this surface departs
 * from `/import`'s pattern of letting a page report by re-reading the catalogue.
 * A refused password is an ORDINARY answer that has to be said, and with no
 * script loaded there is nowhere for an action's return value to go
 * (`useActionState` is a client hook). So the outcome is carried in the URL the
 * browser is sent to, which is post/redirect/get and is also what stops a
 * refresh re-submitting the password.
 *
 * BOTH ADDRESSES ARE HAND-BUILT, AND ADR-0109 NAMES THAT CLASS: Next prefixes
 * `<Link>`, `<Form>` and `router.push()` under a `basePath`, and `redirect()`
 * measurably does not. No `basePath` is set, so these are correct today; they
 * join the item page's canonical as what has to be revisited on the day a host
 * imposes one.
 */
export async function logIn(form: FormData): Promise<void> {
  const { password } = offered.parse({ password: form.get("password") });

  const { error, data } = await safe(
    call(appRouter.session.logIn, { password }, { context: await callerContext() }),
  );

  // A REFUSED PASSWORD IS AN ANSWER, NOT A CRASH -- the same rule
  // `provider.import` takes for a URL the allowlist declines. Anything else that
  // went wrong is a genuine fault and goes on being one.
  //
  // TWO REFUSALS AND TWO SENTENCES (ADR-0125). `UNAUTHORIZED` is a fact about
  // the password offered; `TOO_MANY_REQUESTS` is a fact about how often this
  // instance has been asked, and the password in hand may well be the right one.
  // Telling an owner who has just typed theirs correctly that it was refused
  // would send them looking for a password that is not lost. The reason rides in
  // the parameter rather than in a second one, because the page asks one
  // question: what happened.
  if (error instanceof ORPCError) {
    if (error.code === "UNAUTHORIZED") redirect("/login?refused=password");
    if (error.code === "TOO_MANY_REQUESTS") redirect("/login?refused=too-many");
  }
  if (error) throw error;

  await rememberSession(data.token);
  // WHERE THE SESSION IS FOR. Importing is the only thing a session currently
  // unlocks, so an owner who has just logged in is one call away from what they
  // logged in to do.
  redirect("/import");
}

/**
 * Ends this session: the row first, then the cookie.
 *
 * IN THAT ORDER, because the row is the session (ADR-0043). A cookie cleared
 * while the row lived would leave a token that still opens the write path for
 * anyone holding a copy, and the browser -- the one party that no longer has it
 * -- would be the only one logged out.
 */
export async function logOut(): Promise<void> {
  const context = await callerContext();
  if (context.session) await call(appRouter.session.logOut, {}, { context });
  await forgetSession();
  redirect("/login");
}
