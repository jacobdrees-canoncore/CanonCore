import { type Database, getDb, readProviderSettings, seeSession } from "@canoncore/db";
import { type Allowlist, parseAllowlist, parseProviderUrls } from "@canoncore/providers";

/**
 * WHAT THIS INSTANCE REACHES, parsed: the allowlist that says what MAY be
 * reached and the URLs that say what IS reached (ADR-0034, ADR-0121).
 *
 * Neither is derivable from the other, which is why both are here and why the
 * surface that edits them has to say which of the two is refusing a provider.
 */
export interface ProviderSettings {
  allowlist: Allowlist;
  urls: string[];
}

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
 * presenting none: `seeSession` cannot tell a guess from a logout from a token
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
    session: sessionToken === undefined ? null : await seeSession(db, sessionToken),
    providerSettings: settingsReadOnce(db),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

/**
 * WHAT THIS INSTANCE REACHES, READ PER REQUEST AND ONLY WHEN SOMETHING ASKS.
 *
 * IT USED TO BE READ ONCE FOR THE WHOLE PROCESS (CNCORE-99). Both settings sat
 * in the environment and were parsed at module load, which is why changing
 * either meant editing a file and restarting -- the thing the settings surface
 * exists to end. They are rows now (migration 16), so the read happens inside
 * the request and a provider named a second ago is searched by the request
 * after it.
 *
 * A FUNCTION RATHER THAN A VALUE, because most requests never ask. An item
 * page, the catalogue, a health check and every refusal of an unauthorised
 * caller touch no provider at all, and a context that read the settings row to
 * build itself would put a query in front of all of them -- including the
 * catch-all route's own tests, which state in their config that they need no
 * database.
 *
 * READ ONCE PER REQUEST, THOUGH. The answer is memoised for the life of the
 * context, so a handler that asks twice gets one row and one reading of it:
 * two reads inside one request could disagree, and a request is where "what
 * does this instance reach" has to hold still.
 *
 * THE PARSE STAYED WHERE IT WAS WHEN THE SOURCE MOVED. `parseAllowlist` and
 * `parseProviderUrls` take a string from wherever it comes (ADR-0034,
 * ADR-0121), so only the argument is new.
 *
 * AND THE THROW MOVED WITH IT, WHICH IS THE HALF WORTH READING SLOWLY. Both
 * parsers refuse a malformed entry by throwing, and ADR-0121 records what that
 * cost when it happened per request: a typo in `PROVIDER_ALLOWLIST` turned
 * every read path into 500s, so the parse was moved to module load, where the
 * same typo stopped the server starting instead. There is no module load to
 * move to now. What stands in its place is that every settings WRITE parses
 * what it is given BEFORE it stores it, so a value that cannot be parsed is
 * refused at the surface that typed it and never reaches a row -- the store is
 * validated at its writers rather than at every reader. What that leaves is a
 * value written around the product: it throws where it is READ, which the
 * laziness above keeps to the surfaces that ask what this instance reaches
 * rather than spreading over the whole app.
 *
 * `/settings` IS NO LONGER AMONG THEM, AND THIS SENTENCE SAID IT WAS
 * (CNCORE-329, CNCORE-331). It read "`/settings` among them, so the page that
 * would repair it is down with the rest", and closed by accepting that on the
 * grounds that "whoever wrote it by hand can fix it the same way". Both halves
 * are now false, and the second was the weaker of the two from the start: a
 * self-hoster restoring a dump did not write that row by hand and has no psql
 * prompt to fix it from. `settings.read` does not come through this function
 * at all -- it reads the row itself and parses each setting where the ANSWER
 * can carry the refusal (ADR-0198) -- so that page renders whatever the row
 * holds, says which of the two settings is unreadable, and offers a textarea
 * that replaces it. Every OTHER surface asking what this instance reaches
 * still throws here, and that half stands: they have no repair to offer, and
 * a refusal is the honest answer from a page that cannot fix it.
 */
function settingsReadOnce(db: Database): () => Promise<ProviderSettings> {
  let reading: Promise<ProviderSettings> | undefined;
  return () => {
    reading ??= readProviderSettings(db).then((configured) => ({
      allowlist: parseAllowlist(configured.providerAllowlist),
      urls: parseProviderUrls(configured.providerUrls),
    }));
    return reading;
  };
}
