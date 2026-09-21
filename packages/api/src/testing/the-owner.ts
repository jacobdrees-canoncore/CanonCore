import { env } from "@canoncore/env/server";
import { call } from "@orpc/server";

import { createContext } from "../context";
import { appRouter } from "../routers";

/**
 * A SESSION TOKEN FOR THE OWNER, for a suite driving the `ownerProcedure`s
 * (CNCORE-109, ADR-0043) that refuse a caller without one.
 *
 * IT LOGS IN THROUGH THE ROUTER rather than assembling a session object, so the
 * context a suite builds from it is the one a real caller gets. A hand-made
 * session would keep passing on the day the shape of one changes, which is the
 * day it would matter most.
 *
 * IT LOGS IN AS NOBODY, on a context of its own rather than one a caller hands
 * it. Logging in is what an anonymous caller does, and a suite whose own context
 * is already the Owner's (`provider.test.ts` builds its context from this) would
 * otherwise have to log in through the session it is logging in to get.
 *
 * ONE COPY, where every suite that logs the Owner in used to spell its own
 * (CNCORE-316). ADR-0103: "One copy is a function; four is a shape nobody
 * declared." `session.test.ts` keeps a guard of its own for the tests that
 * assert logging in, since they hand `session.logIn` the password themselves.
 */
export async function aTokenForTheOwner(): Promise<string> {
  const password = env.OWNER_PASSWORD;
  if (password === undefined) {
    throw new Error("this suite's vitest.config.ts sets OWNER_PASSWORD, and it is not set");
  }
  const { token } = await call(
    appRouter.session.logIn,
    { password },
    { context: await createContext() },
  );
  return token;
}
