"use server";

import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
import { redirect } from "next/navigation";
import { z } from "zod";

import { whatTheProcedureAnswered } from "@/answer";
import { whatTheFormCarries } from "@/form";
import { callerContext, forgetSession, rememberSession } from "@/session";
import { REFUSED } from "./refusal";

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
  const input = whatTheFormCarries(form, offered);
  if (input === undefined) return;

  const { answered, refused } = await whatTheProcedureAnswered(
    call(appRouter.session.logIn, input, { context: await callerContext() }),
  );

  // A REFUSED PASSWORD IS AN ANSWER, NOT A CRASH -- the same rule
  // `provider.import` takes for a URL the allowlist declines, and since
  // CNCORE-127 the rule every action on this app takes. Anything else that went
  // wrong is a genuine fault and goes on being one, thrown before
  // `whatTheProcedureAnswered` hands anything back.
  //
  // TWO REFUSALS AND TWO SENTENCES (ADR-0125). `UNAUTHORIZED` is a fact about
  // the password offered; `TOO_MANY_REQUESTS` is a fact about how often this
  // instance has been asked, and the password in hand may well be the right one.
  // Telling an owner who has just typed theirs correctly that it was refused
  // would send them looking for a password that is not lost. The reason rides in
  // the parameter rather than in a second one, because the page asks one
  // question: what happened.
  if (refused) {
    if (refused.code === "UNAUTHORIZED") redirect(`/login?refused=${REFUSED.password}`);
    if (refused.code === "TOO_MANY_REQUESTS") redirect(`/login?refused=${REFUSED.tooMany}`);
    return;
  }

  await rememberSession(answered.token);
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
 *
 * WHICH IS WHY THIS IS THE ONE ACTION THAT STOPS ON A REFUSAL RATHER THAN
 * CARRYING ON (CNCORE-127). Everywhere else a refusal means "nothing was
 * written, here is the page again", and going on to the next line costs
 * nothing. Here the next line clears the cookie, and a refusal means the row is
 * still there -- so taking it would be exactly the half-logout the paragraph
 * above refuses, arrived at by a shared rule instead of by a bug.
 */
export async function logOut(): Promise<void> {
  const context = await callerContext();
  if (context.session) {
    const { answered } = await whatTheProcedureAnswered(
      call(appRouter.session.logOut, {}, { context }),
    );
    if (answered === undefined) return;
  }
  await forgetSession();
  redirect("/login");
}
