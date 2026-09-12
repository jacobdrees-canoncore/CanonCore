import { createContext } from "@canoncore/api/context";
import { SESSION_LIFETIME_SECONDS } from "@canoncore/db";
import { env } from "@canoncore/env/server";
import { cookies } from "next/headers";

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
 */
export async function callerContext() {
  return createContext({ sessionToken: (await cookies()).get(SESSION_COOKIE)?.value });
}

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
     * that same thirty days, so the cookie cannot outlive the session it
     * carries or the reverse. Written out here a second time, the two would be
     * a pair nothing keeps in step: a browser holding a token the server had
     * already stopped honouring, or a session going on being valid for a device
     * that threw the token away.
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
