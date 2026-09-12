import { createHash, timingSafeEqual } from "node:crypto";
import { endSession, startSession } from "@canoncore/db";
import { env } from "@canoncore/env/server";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { openProcedure, ownerProcedure } from "../index";
import { checkWithinTheBound } from "./login-bound";

/**
 * Whether an offered password is the owner's.
 *
 * CONSTANT TIME, ON DIGESTS RATHER THAN ON THE STRINGS. `timingSafeEqual`
 * refuses buffers of unequal length -- so comparing the raw values would throw
 * on almost every wrong guess and answer in constant time only for the ones that
 * happened to be the right LENGTH, which is the leak it exists to close. Hashing
 * both first makes every comparison 32 bytes against 32 bytes.
 *
 * NO PASSWORD CONFIGURED MEANS NOBODY IS THE OWNER, which is ADR-0044's demo:
 * read-only, with no login, reached by leaving a variable unset. It is checked
 * before anything else, so an instance with no password cannot be logged into by
 * sending none.
 */
function isTheOwner(offered: string): boolean {
  const expected = env.OWNER_PASSWORD;
  if (expected === undefined) return false;
  return timingSafeEqual(digestOf(offered), digestOf(expected));
}

function digestOf(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export const session = {
  /**
   * WHETHER ANYONE CAN LOG IN TO THIS INSTANCE AT ALL.
   *
   * THE SAME SILENCE `provider.allowlisted` NAMES, one setting over. That
   * procedure exists because an instance that reaches no provider refuses
   * imports one at a time with no way to tell a wrong URL from a setting nobody
   * ever wrote; this is the same shape -- an instance with no `OWNER_PASSWORD`
   * refuses every password forever, and "that password was refused" is the wrong
   * sentence to put in front of a visitor to a demo that has none.
   *
   * A BOOLEAN, OBVIOUSLY. The question is whether there is a password, and the
   * answer is never the password.
   *
   * IT IS NOT A DISCLOSURE WORTH WITHHOLDING. An instance's read path is open by
   * ADR-0044 and `provider.configured` already hands any caller every provider
   * URL; whether this one is somebody's catalogue or the demo is answered by
   * whether it has a login form, which is a page anybody can fetch.
   */
  configured: openProcedure
    .output(z.object({ password: z.boolean() }))
    .handler(() => ({ password: env.OWNER_PASSWORD !== undefined })),

  /**
   * The owner's one password, exchanged for the token everything that writes
   * asks for (ADR-0043, ADR-0044).
   *
   * OPEN, NECESSARILY: a caller with no session is precisely who this is for.
   * It is the only procedure on the surface that takes a secret.
   *
   * IT DECLARES NO DEVICE, and the session row's columns for one stand empty.
   * The web UI is not a Client (`CONTEXT.md`) -- the server serves it, at the
   * server's own origin -- and it has nothing to declare: ADR-0043's capability
   * declaration is decided by direct play (ADR-0041), and nothing plays anything
   * yet. The channel a declaration arrives on is Plex's two headers or our own
   * answer to them, and it belongs to the first client rather than to a browser
   * inventing values to fill columns with.
   *
   * ONE ANSWER FOR A WRONG PASSWORD AND FOR AN INSTANCE THAT HAS NONE. A caller
   * who could tell those apart could ask any instance on the internet whether it
   * is somebody's catalogue or the demo, which is a question the surface has no
   * reason to answer.
   *
   * HOW OFTEN IT MAY BE ASKED IS BOUNDED (ADR-0125, CNCORE-117): a burst of
   * wrong passwords are looked at, and after that one is looked at every fifteen
   * seconds. An attempt with no allowance left is refused WITHOUT the password
   * being compared, which is what makes it a bound rather than theatre -- and
   * which is also why it is a different answer from `UNAUTHORIZED`, since it is
   * a fact about this instance rather than about the password offered.
   */
  logIn: openProcedure
    .input(z.object({ password: z.string() }))
    .output(
      z.object({
        /**
         * THE WHOLE SECRET, handed over once. It is stored only as a SHA-256
         * digest, so this is the single moment it exists in a form that opens
         * anything -- which is why the web app puts it straight into an
         * httpOnly cookie rather than anywhere a page can read it.
         */
        token: z.string(),
      }),
    )
    .handler(async ({ input, context }) => {
      const attempt = checkWithinTheBound(() => isTheOwner(input.password));
      if (attempt === "too many attempts") throw new ORPCError("TOO_MANY_REQUESTS");
      if (attempt === "not the owner") throw new ORPCError("UNAUTHORIZED");
      const { token } = await startSession(context.db, {});
      return { token };
    }),

  /**
   * Ends the session the caller is holding.
   *
   * BEHIND THE OWNER BUILDER, which is what makes "the caller's own" a fact
   * rather than an input: `context.session` is the session this request arrived
   * on, so there is no id to pass and no id to get wrong. Logging out a DIFFERENT
   * device is ADR-0043's per-device logout and wants a device list to do it from;
   * `endSession` already takes the session it ends, so that surface is a page
   * rather than a change here.
   */
  logOut: ownerProcedure.output(z.object({ ended: z.uuid() })).handler(async ({ context }) => {
    await endSession(context.db, context.session.id);
    return { ended: context.session.id };
  }),
};
