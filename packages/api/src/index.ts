import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

/**
 * The builder both of the ones below are made from, and NOT exported: since
 * `openProcedure` is this object, exporting both would publish one builder under
 * two names -- and the name a procedure is declared with is the only place this
 * surface says who may call it.
 */
const o = os.$context<Context>();

/**
 * ANYONE MAY CALL THIS, and that is a decision rather than the absence of one.
 *
 * ADR-0044 makes the public demo read-only with no login, and ADR-0072 gives a
 * visitor everything on it -- there is no visibility system, because "inherit
 * from which parent?" has no answer once an item is multi-placed. So a read
 * asks for nothing, and the demo is an instance that simply never sets
 * `OWNER_PASSWORD`.
 */
export const openProcedure = o;

/**
 * THE OWNER MAY CALL THIS. Everything that writes is behind it (CNCORE-109).
 *
 * Until this existed `packages/api` exported one builder, named `public`, and it
 * was the whole truth: every procedure was reachable by anyone who could reach
 * the process, `provider.purge` -- which deletes everything one provider ever
 * said -- as reachable as a read. ADR-0043 and ADR-0044 had already decided what
 * closes that, and neither was implemented.
 *
 * A SESSION AND NOT A PASSWORD PER CALL. The password is checked once, by
 * `session.logIn`, and what every later call presents is the token that check
 * minted (ADR-0043). A secret compared on every procedure would be a secret sent
 * on every procedure.
 *
 * IT NARROWS THE CONTEXT rather than only refusing, so a handler behind this
 * reads `context.session` as a session rather than as one that might be null.
 * Nothing needs the owner's id yet; the first thing that writes an `owner_id`
 * from the caller rather than from `theOwnerId` will, and it should not have to
 * re-check what this already proved.
 */
export const ownerProcedure = o.use(({ context, next }) => {
  if (!context.session) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { session: context.session } });
});
