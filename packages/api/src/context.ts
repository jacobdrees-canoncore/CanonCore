import { getDb } from "@canoncore/db";
import { env } from "@canoncore/env/server";
import { parseAllowlist, parseProviderUrls } from "@canoncore/providers";

/**
 * ADR-0034's allowlist, parsed ONCE at module load rather than per request.
 *
 * `parseAllowlist` THROWS on a malformed entry, deliberately, and that made
 * where it is called a real decision rather than a detail. Called inside
 * `createContext` it ran on every request -- including a page render that
 * touches no provider at all -- so a typo in `PROVIDER_ALLOWLIST` turned the
 * whole read path into 500s. Found in review.
 *
 * At module load the same typo stops the server from starting, which is what a
 * bad configuration value should do and what the missing-DATABASE_URL guard
 * already does for the other one.
 */
const providerAllowlist = parseAllowlist(env.PROVIDER_ALLOWLIST);

/**
 * WHICH PROVIDERS THIS INSTANCE SEARCHES, parsed ONCE at module load for exactly
 * the reason the allowlist above is: `parseProviderUrls` throws on an entry that
 * is not a URL, and a typo that stops the server starting is a typo an owner
 * meets at once rather than as a 500 out of the first search.
 */
const providerUrls = parseProviderUrls(env.PROVIDER_URLS);

/**
 * What every request carries. Takes no argument: nothing in it is derived from
 * the request yet, and the route handler was passing one only because the
 * generator's signature asked for it. A session or a locale will want the
 * request back, and can add it then.
 */
export async function createContext() {
  return {
    db: getDb(),
    auth: null,
    session: null,
    providerAllowlist,
    providerUrls,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
