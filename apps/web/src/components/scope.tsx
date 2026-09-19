"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { oneGroup } from "./query-params";

/**
 * THE GROUP THE ADDRESS IS NARROWED TO, read where the shell needs it
 * (CNCORE-181): the header's links and its search box carry the scope a reader
 * picked, so it travels with them rather than being picked again on every
 * surface.
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
 * `/search` IS NOT AMONG THE PATHS, because that surface is reached through the
 * search box with a query in it: `/search` alone is the page that asks for one.
 */
export function ScopedLink({
  path,
  ...link
}: Omit<React.ComponentProps<typeof Link>, "href"> & { path: "/" | "/works" }) {
  const group = useNarrowedTo();
  return <Link href={{ pathname: path, query: group === undefined ? {} : { group } }} {...link} />;
}
