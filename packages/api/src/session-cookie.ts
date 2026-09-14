/**
 * WHERE THE OWNER'S TOKEN LIVES between requests, as a name on its own.
 *
 * A COOKIE RATHER THAN A HEADER, because the surface that writes is a set of
 * `<form>`s that work with no JavaScript (ADR-0103's fourth seam replays them).
 * Nothing runs on the page to attach an `Authorization` header to a form post,
 * and a hidden field carrying the token would put it in the page's own HTML.
 *
 * IT IS PUBLISHED FROM THIS PACKAGE BECAUSE IT IS THE WIRE CONTRACT FOR THE
 * ROUTER THIS PACKAGE PUBLISHES: this is the credential a caller sends to reach
 * `appRouter`, and the web app writing it and `scripts/import-list.ts` sending
 * it are two clients of one surface. It lived in `apps/web/src/session.ts` until
 * CNCORE-166, which was fine while the only caller was the app itself -- but that
 * module reads `next/headers`, which exists only inside a request, so nothing
 * else could import from it without pulling Next in and throwing. A second copy
 * of the name in a script is a string free to drift into refusing every call
 * with no message that says why.
 *
 * IT IS A NAME AND NOT A MECHANISM, so `context.ts` is untouched by it: that
 * file still takes a TOKEN and stays free of the framework, and a cookie is
 * still read by whatever served the request.
 */
export const SESSION_COOKIE = "canoncore_session";
