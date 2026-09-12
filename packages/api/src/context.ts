import { getDb, sessionFor } from "@canoncore/db";
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
 * What every request carries.
 *
 * IT TAKES THE TOKEN RATHER THAN THE REQUEST, and that is what keeps this
 * package free of a framework. A cookie is read by whatever served the request
 * -- `cookies()` in a Server Action, `request.cookies` in the route handler --
 * both of which already know how, and neither of which this package should have
 * to know about. What it needs is the secret itself.
 *
 * A TOKEN NOBODY MINTED IS NO SESSION AT ALL, which is the same answer as
 * presenting none: `sessionFor` cannot tell a guess from a logout from a token
 * that expired, and a caller that could would have an oracle for which tokens
 * have ever existed.
 */
export async function createContext({ sessionToken }: { sessionToken?: string } = {}) {
  const db = getDb();
  return {
    db,
    /**
     * WHO IS CALLING, or `null` for anyone who has not proved they are the
     * owner. `ownerProcedure` is what reads it; `openProcedure` never asks.
     */
    session: sessionToken === undefined ? null : await sessionFor(db, sessionToken),
    providerAllowlist,
    providerUrls,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
