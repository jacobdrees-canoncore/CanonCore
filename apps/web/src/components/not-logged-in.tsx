import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
import Link from "next/link";

import { callerContext } from "@/session";
import { noPasswordSet } from "./no-password";

/**
 * A SURFACE THAT IS THE OWNER'S WHOLE, ANSWERING A READER WHO IS NOT THEM
 * (CNCORE-146).
 *
 * THREE PAGES ARE THIS PAGE. `/tasks`, `/settings` and `/devices` differ in
 * their heading and in one sentence saying whose business the thing is; every
 * other part of the refusal was the same markup written out three times, and
 * CNCORE-146 was about to make each of them a two-branch version of the same
 * markup written out three times. `no-password.ts` beside this file carries the
 * argument for why a copy per surface is the thing to avoid, and review made
 * the fair point that the argument applies to the paragraph as much as to the
 * sentence inside it.
 *
 * NOT `/new` OR `/import`, WHICH ARE A DIFFERENT SHAPE AND STAY THEIR OWN.
 * Those two do not hide their surface: `/new` renders its own heading and
 * standfirst and swaps only the form, and `/import` shows a visitor everything
 * and withholds the buttons (ADR-0072). This is for the pages that ARE the
 * refusal, and stretching it to cover the other two would mean parameters for
 * everything they do differently.
 *
 * IT READS THE INSTANCE ITSELF RATHER THAN TAKING IT AS A PROP. The fact is the
 * same question on all three pages and the answer is the same answer, so a prop
 * would be three identical reads and three copies of the comment explaining
 * them -- which is what this file exists to end. `callerContext` is memoised for
 * the life of the render and `session.configured` reads a setting and nothing
 * else, so this opens no connection and costs no query.
 *
 * THE CALLER HAS ALREADY ESTABLISHED THERE IS NO SESSION, which is why nothing
 * here checks. Each page early-returns this where `context.session === null`;
 * rendering it for an owner would tell them they are not one.
 */
export async function NotLoggedIn({
  title,
  whoseBusiness,
}: {
  /** The page's own heading, unchanged by the refusal. */
  title: string;
  /**
   * Why this surface is the owner's, in that page's words, as a COMPLETE
   * SENTENCE. It is followed by one of two others and ends before either, so
   * the page that supplies it is not also deciding how the paragraph continues.
   */
  whoseBusiness: string;
}) {
  const context = await callerContext();
  /*
   * WHETHER ANYBODY CAN LOG IN TO THIS INSTANCE AT ALL, which is the second of
   * ADR-0094's two facts and is about the INSTANCE rather than the reader.
   * ADR-0044's read-only instance sets no `OWNER_PASSWORD`, so `session.logIn`
   * refuses every password and nobody obtains a session INCLUDING the owner --
   * and "this page asks you to be them first" is a step on one instance and an
   * impossibility on the other, with the link going to a page that renders no
   * form.
   */
  const { password: aPasswordIsSet } = await call(appRouter.session.configured, undefined, {
    context,
  });

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-medium">{title}</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        {whoseBusiness}{" "}
        {aPasswordIsSet ? "So this page asks you to be them first." : noPasswordSet("changed")}
      </p>
      {/*
        AND THE STEP ITSELF, OFFERED ONLY WHERE IT EXISTS. A reader on an
        instance with a password may BE the owner and simply not have used it,
        which is the one the README names first.
      */}
      {aPasswordIsSet && (
        <Link className="mt-6 inline-block text-sm hover:underline" href="/login">
          Log in
        </Link>
      )}
    </main>
  );
}
