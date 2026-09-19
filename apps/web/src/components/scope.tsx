"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { inTheFixedOrder, oneGroup } from "./query-params";

/**
 * THE GROUP THE ADDRESS NAMES, read where the shell needs it (CNCORE-181): the
 * header's links and its search box carry the scope a reader picked, so it
 * travels with them rather than being picked again on every surface.
 *
 * WHATEVER GROUP THE ADDRESS NAMES, ON ANY PAGE, rather than only a page that
 * is narrowed. The two are the same for every address this app writes, since
 * a Group is linked only onto a surface it narrows: the three Listings, and
 * Provider search on `/import` since CNCORE-182, where it decides who is asked
 * -- one scope, so it is carried from there too. An address naming one
 * anywhere else -- typed by hand, or `/search` submitted with an empty box,
 * which answers nothing and so narrows nothing -- has its Group carried on
 * too, and the next Listing narrows to it, as that address asked.
 *
 * AND A GROUP THAT IS NOT THERE IS CARRIED TOO, where `/import`'s own box
 * carries only one that is. That box sits on a page that has read every
 * Group; the shell has read none, and asking would be a round trip on every
 * page to decide a hidden field. The next Listing then says "No such Group",
 * the answer the page it came from gave. Checking the
 * path first would be a second list of which surfaces narrow, beside the pages
 * that already decide it.
 *
 * A HOOK IN A CLIENT COMPONENT BECAUSE THE SHELL IS A LAYOUT, and Next hands a
 * layout no `searchParams`: a layout is not re-rendered on navigation, so a
 * value read there would go stale the moment a reader picked a Group. Next's
 * own answer is `useSearchParams` in a client component, which re-renders on
 * every navigation -- and which a route rendered per request reads ON THE
 * SERVER too, so the served HTML carries the scope with no script. Every route
 * here is rendered per request, because the header reads the session
 * (ADR-0117). A route that stopped being so would fail the build rather than
 * serve a header missing its scope, since a static page calling this outside a
 * `Suspense` boundary is a build error.
 *
 * READ THE WAY EVERY PAGE READS IT, through `oneGroup`: a repeated or blank
 * `group` names none, and capitals are the same id lowered -- so the header
 * and the page it sits on cannot disagree about which Group the address names.
 */
export function useNarrowedTo(): string | undefined {
  const named = useSearchParams().getAll("group");
  return oneGroup(named.length === 1 ? named[0] : named);
}

/**
 * A LINK TO A SURFACE THAT IS ITS OWN LISTING, carrying the scope and nothing
 * else the page was asked. The cursor stays behind because a position in one
 * Listing is no position in another, and `/search`'s query because it is a
 * question only that surface asks.
 *
 * WRITTEN THROUGH `inTheFixedOrder` though it carries one parameter, because
 * that is where a Listing's links are spelled: absent rather than `?group=`
 * where the address names no Group.
 *
 * `/search` IS NOT AMONG THE PATHS, because that surface is reached through the
 * search box with a query in it: `/search` alone is the page that asks for one.
 */
export function ScopedLink({
  path,
  ...link
}: Omit<React.ComponentProps<typeof Link>, "href"> & { path: "/" | "/works" }) {
  return (
    <Link href={{ pathname: path, query: inTheFixedOrder({ group: useNarrowedTo() }) }} {...link} />
  );
}
