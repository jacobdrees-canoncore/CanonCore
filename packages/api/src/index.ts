import { os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

/**
 * TODO(CNCORE-109): `public` IS THE WHOLE TRUTH HERE AND SHOULD NOT BE. This is
 * the only builder this package exports, so every procedure in `./routers` is
 * reachable by anyone who can reach the process -- the ones that WRITE
 * included: `provider.purge` deletes a provider's placements and is as
 * reachable as a read.
 *
 * FOUND WHILE BOUNDING A FAILURE REASON (CNCORE-95, ADR-0123). That ticket
 * asked whether an unauthenticated caller should read a raw failure message,
 * and the answer is that the message is not the oracle -- `provider.configured`
 * already hands any caller every configured provider URL -- so the reason was
 * bounded and attributed, and the OPEN SURFACE was filed rather than papered
 * over by degrading a sentence the Owner needs. ADR-0043 and ADR-0044 already
 * decide what closes it.
 */
export const publicProcedure = o;
