import { createHash, timingSafeEqual } from "node:crypto";
import { endSession, listSessions, startSession } from "@canoncore/db";
import { env } from "@canoncore/env/server";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { openProcedure, ownerProcedure } from "../index";

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

/**
 * One device on the owner's list.
 *
 * `device` RATHER THAN `session`, WHICH IS THE READER'S WORD AND NOT A SECOND
 * NAME FOR THE ROW. `CONTEXT.md` defines a Session as "one logged-in device", so
 * the two are one thing from two sides: the mechanism is a session all the way
 * down -- `session.list`, `session.end`, `listSessions`, `endSession` -- and what
 * the owner reads is a list of devices, which is also ADR-0043's own phrase for
 * the operation ("per-device logout"). This shape is where the two meet, and it
 * takes the reader's word because a page is what consumes it.
 *
 * IT NAMES ITS FIELDS rather than answering the session row, which is the rule
 * ADR-0045 takes for the read path and the same reason `asSession` leaves
 * `token_hash` behind: a shape that spread the row would publish whatever a
 * later column happened to be called.
 *
 * THE DECLARATION FIELDS ARE OPTIONAL BECAUSE THE ONLY DEVICE THAT LOGS IN
 * TODAY DECLARES NONE. A browser is not a Client (`CONTEXT.md`), so its row
 * holds nulls in all of them and the page has to be able to say so rather than
 * print a placeholder this app invented (ADR-0043).
 *
 * `deviceId`, `clientVersion` AND `capabilities` ARE NOT HERE. An id and an
 * opaque blob the clients have yet to settle are not things a reader deciding
 * which device to log out can act on, and a version number is diagnostics rather
 * than recognition -- the two that are left are the two the schema's own
 * comments say name a device: what the owner would recognise it by, and what it
 * calls its software. `clientVersion` was on this shape until review pointed out
 * that every field here is null for the only device that can log in today, which
 * makes each one a cost to justify rather than a column to mirror.
 */
const listedDevice = z.object({
  id: z.uuid(),
  /**
   * WHETHER THIS IS THE DEVICE READING THE PAGE. The whole safety of the
   * surface rests on it: every row belongs to the same owner and looks alike,
   * so without this the one session the owner must not end is indistinguishable
   * from the ones they came to end.
   */
  current: z.boolean(),
  lastSeenAt: z.date(),
  clientName: z.string().optional(),
  deviceName: z.string().optional(),
});

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
   * TODO(CNCORE-117): NOTHING BOUNDS HOW OFTEN THIS MAY BE ASKED. An instance on
   * a public address answers unlimited guesses at the one password it has, and
   * keeps no record of them -- the twelve-character minimum is a bound on the
   * password rather than on the guessing. A lockout on a single-owner instance is
   * a denial of service against the only person who can lift it, so what to do
   * here wants deciding rather than reaching for.
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
      if (!isTheOwner(input.password)) throw new ORPCError("UNAUTHORIZED");
      const { token } = await startSession(context.db, {});
      return { token };
    }),

  /**
   * Every device the owner is logged in on (ADR-0043's per-device logout).
   *
   * BEHIND THE OWNER BUILDER, and that is not the reflex that everything except
   * a catalogue read is. ADR-0044 leaves the READ PATH open because the demo
   * shows a visitor everything in the catalogue; who is logged in to an instance
   * is not in the catalogue, and a list of an owner's devices answered to
   * anybody is a list of what to go looking for.
   *
   * IT TAKES NO INPUT, so there is no owner to name and none to get wrong --
   * `listSessions` reads the single owner itself, exactly as `startSession`
   * does.
   */
  list: ownerProcedure.output(z.array(listedDevice)).handler(async ({ context }) => {
    const listed = await listSessions(context.db);
    return listed.map((device) => ({
      id: device.id,
      // THE COMPARISON IS AGAINST THE SESSION THE REQUEST ARRIVED ON, which
      // `ownerProcedure` has already resolved from the token. Nothing the caller
      // sent says which device it is, so nothing the caller sends can move the
      // flag onto a row they would rather the owner did not end.
      current: device.id === context.session.id,
      lastSeenAt: device.lastSeenAt,
      ...(device.clientName === undefined ? {} : { clientName: device.clientName }),
      ...(device.deviceName === undefined ? {} : { deviceName: device.deviceName }),
    }));
  }),

  /**
   * Logs one OTHER device out (ADR-0043's per-device logout).
   *
   * IT NAMES A SESSION, which is what `endSession` has taken since CNCORE-109
   * and why that surface needed no change to reach this one: the owner reading
   * their device list holds no token but their own, so the id is the only thing
   * they CAN name.
   *
   * NOT THE CALLER'S OWN, WHICH IT REFUSES. `logOut` is that operation, and it
   * is a different one: the row and the browser's cookie are two halves, and
   * ending the row alone would leave a browser holding a token that opens
   * nothing and a page that still says it is logged in. A refusal here sends the
   * one caller who could get this wrong to the operation that does both.
   *
   * A SESSION THAT WAS ALREADY OVER IS ANSWERED, NOT REFUSED. The list a page
   * renders is a moment old, so pressing End on a device that lapsed in between
   * is an ordinary race rather than a fault -- and the answer the owner wants is
   * the same either way, which is a list without it on.
   */
  end: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ ended: z.boolean() }))
    .handler(async ({ input, context }) => {
      if (input.id === context.session.id) {
        throw new ORPCError("BAD_REQUEST", {
          message: "That is the session you are using. Log out to end it.",
        });
      }
      return { ended: await endSession(context.db, input.id) };
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
