import { createContext } from "@canoncore/api/context";
import { SESSION_LIFETIME_SECONDS } from "@canoncore/db";
import { env } from "@canoncore/env/server";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * WHERE THE OWNER'S TOKEN LIVES between requests.
 *
 * A COOKIE RATHER THAN A HEADER, because the surface that writes is a set of
 * `<form>`s that work with no JavaScript (ADR-0103's fourth seam replays them).
 * Nothing runs on the page to attach an `Authorization` header to a form post,
 * and a hidden field carrying the token would put it in the page's own HTML.
 */
export const SESSION_COOKIE = "canoncore_session";

/**
 * What the request carries, for a caller that may or may not be the owner.
 *
 * EVERY SERVER-SIDE CALLER BUILDS ITS CONTEXT THROUGH HERE, so there is one
 * place that knows a session arrives in a cookie. `packages/api` takes the token
 * itself and stays free of the framework.
 *
 * ONCE PER REQUEST, HOWEVER MANY COMPONENTS ASK (CNCORE-139). Since the header
 * thins itself for a reader with no session, two components of one render want
 * the same answer: the shell, on every page, and the page itself where it reads
 * one too. `seeSession` is an UPDATE rather than a SELECT -- reading a session
 * IS seeing the device (ADR-0043's `last_seen_at`) -- so a second caller is a
 * second write, and two readings inside one request could disagree about who
 * is asking. `cache` is what React documents for exactly this: memoised for the
 * life of the render and nothing wider, so no answer outlives the request it
 * was asked in.
 */
export const callerContext = cache(async () =>
  createContext({ sessionToken: (await cookies()).get(SESSION_COOKIE)?.value }),
);

/**
 * Hands the token to the browser.
 *
 * `httpOnly`, SO NO SCRIPT ON THE PAGE CAN READ IT. The token is the whole
 * credential -- the database keeps only its digest -- so a single injected
 * script reading `document.cookie` would be the write path handed over.
 *
 * `sameSite: "lax"` REFUSES IT ON A CROSS-SITE POST, which is what stands
 * between this and another site's form submitting a purge as the owner. `strict`
 * would also drop it on an ordinary link INTO the catalogue from anywhere else,
 * which would log the owner out by their own bookmark.
 *
 * `secure` IN PRODUCTION, which means CanonCore over plain HTTP in production
 * cannot hold a login. That is the shape ADR-0109 commits to -- one registrable
 * domain with a publicly-routable address -- and a token that travels in the
 * clear on a network the owner does not control is worth more than the
 * convenience. Development is exempt because `http://localhost` is not that
 * network.
 */
export async function rememberSession(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    /*
     * HOW LONG THE BROWSER KEEPS IT, AND THE SESSION'S OWN LIFETIME, which are
     * ONE NUMBER since CNCORE-116 rather than two that happened to agree.
     *
     * The row lapses thirty days after it was minted (ADR-0043) and this is
     * that same thirty days, so neither outlives the other at the OUTSIDE
     * limit. Written out here a second time, the two would be a pair nothing
     * keeps in step, and a session going on being valid for a device that threw
     * its token away is the harmless direction.
     *
     * THE IDLE LIMIT CAN STILL END THE SESSION FIRST, and this cookie will
     * outlive it when it does -- seven days unused ends the row with up to
     * twenty-three days left on the browser's copy. That is not a mismatch to
     * close: what the browser then presents is a token that answers nothing,
     * and what it meets is the login form, which is the right thing to put in
     * front of somebody who has not opened their catalogue in a week. An
     * earlier draft of this comment claimed the two numbers being one closed
     * the gap in both directions; the idle limit landed in the same change and
     * makes that false. Found in review.
     */
    maxAge: SESSION_LIFETIME_SECONDS,
  });
}

/**
 * Takes the token off the browser.
 *
 * THE ROW IS ENDED SEPARATELY, by `session.logOut`, and this is the other half
 * rather than the whole: a cookie deleted while the row lived would log the
 * owner out of this browser and leave the token valid for anyone who had copied
 * it.
 */
export async function forgetSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
