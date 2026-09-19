/**
 * WHAT ONE QUERY PARAMETER SAYS, when a reader may have supplied it more than
 * once or not at all.
 *
 * ITS OWN MODULE BECAUSE THERE HAVE TO BE NO SECOND COPIES, and there were three.
 * `cursorFrom` in `listing.tsx` said so in its own words -- "written ONCE here
 * because two surfaces answering it differently would be two conventions for one
 * question" -- and by the time four surfaces read a parameter there were three
 * spellings of the rule, disagreeing about whether a blank value counts:
 * `after !== ""` for the cursor, `typeof q === "string" ? q : ""` on
 * `/search`, and a trimmed one on `/import`. That is the drift the comment
 * predicted, arriving through the surfaces rather than through the listing, which
 * is why the rule now lives beside them all rather than inside one of them.
 */

/**
 * The single value of a parameter, or nothing.
 *
 * AN ARRAY IS NOTHING, never the first of several. A page asks ONE question, so a
 * repeated parameter names no answer rather than whichever answer came first --
 * the rule `/items/<id>` applies to `via` and `placed` (ADR-0066).
 *
 * AND SO IS A BLANK ONE. `?q=` and `?q=%20%20` are a box somebody submitted
 * without filling in, which is the absent case wearing two other spellings; a
 * surface that treated them as a question would search for nothing and report
 * that nothing matched. Trimmed rather than compared to the empty string, because
 * a box a reader tabbed through holds spaces rather than nothing and the two are
 * the same mistake -- which is the reading `searchProviders` already applies one
 * layer down (ADR-0033 under CNCORE-33).
 */
export function oneValue(parameter: string | string[] | undefined): string | undefined {
  return typeof parameter === "string" && parameter.trim() !== "" ? parameter : undefined;
}

/**
 * THE GROUP A PAGE WAS NARROWED TO, read the way `oneValue` reads any parameter
 * -- a repeated or blank `group` names no Group, so the page is its Listing
 * unnarrowed -- and then IN LOWER CASE.
 *
 * THE LOWER CASE IS A FIX FOUND BY REVIEW OF CNCORE-179. A uuid spelled in
 * capitals is the same id to `z.uuid()` and to PostgreSQL, so the Listing
 * narrowed while the Group -- matched as a string among `group.list`'s -- was
 * not found, and the page said "No such Group" over that Group's own Rows.
 * Lowered once here, every reader of it agrees, and every link written from it
 * spells the id the way the picker does: one Group, one address (ADR-0066).
 *
 * ITS OWN FUNCTION SINCE CNCORE-180, when a second and a third surface came to
 * read the parameter. It was one line on the front page with that paragraph
 * above it, and a surface copying the line without the paragraph is the one
 * that would drop the `toLowerCase`.
 */
export function oneGroup(parameter: string | string[] | undefined): string | undefined {
  return oneValue(parameter)?.toLowerCase();
}

/**
 * EVERY NON-IDENTIFYING PARAMETER THAT CAN SHARE A LINK WITH ANOTHER, IN THE
 * ONE ORDER THIS APP WRITES THEM (ADR-0066): what the page is asked, then the
 * scope it is asked within, then where in it the reader stands.
 *
 * NOT EVERY PARAMETER THE APP WRITES. A Member row links `?via=` alone, and a
 * Server Action redirects to one `?refused=` or `?undo=`: an address carrying
 * one parameter has no order to keep, so those are written where they are
 * rather than routed through here. A second parameter on any of them belongs
 * on this list first.
 *
 * STATED ONCE FOR EVERY SURFACE SINCE CNCORE-181. It was two shapes until
 * then: the Item page's four read off an array in `listing.tsx`, and the
 * Listings' `q`, `group`, `after` held by the order `queryFor` spread its slots
 * in -- with the Item page's chips holding a third copy by the order `theRoute`
 * set its keys. Two statements of one order are two that can drift, and a
 * drifted one is a second spelling of one page.
 *
 * WHY THE TWO HALVES INTERLEAVE AS THEY DO. `via` and `placed` are only ever
 * written on an Item's page and `q` and `group` only on a Listing's, so no link
 * carries one of each and their places relative to each other re-spell
 * nothing. Within each half the order is the one already out there: `via`,
 * `placed`, `after`, `placedAfter` on the Item page, and `q`, `group`, `after`
 * on the Listings.
 *
 * `after` IS ONE WORD IN TWO PLACES and sits where both halves need it: behind
 * what the page was asked, and ahead of `placedAfter`, which arrived later.
 *
 * THE ONE SPELLING THIS CANNOT WRITE IS A FORM's, which a browser submits in
 * the order its fields stand in the document: the header's search box puts the
 * reader's `q` first and the `group` it carries behind it, which is this order,
 * and `scope.test.ts` reads that box beside every link.
 */
const IN_THE_FIXED_ORDER = ["via", "placed", "q", "group", "after", "placedAfter"] as const;

/**
 * THE QUERY OF ONE LINK: any of those parameters, each at most once. Not
 * plain "query", which in this app already means what a reader typed into
 * `/search`.
 */
export type LinkQuery = { [name in (typeof IN_THE_FIXED_ORDER)[number]]?: string };

/**
 * A query IN THE FIXED ORDER, each parameter ABSENT rather than empty where it
 * has no value. Next writes an `undefined` or empty value out as `?name=`, a
 * second spelling of the address without it -- so dropping them here is what
 * lets a caller pass every parameter it might carry and set only some.
 */
export function inTheFixedOrder(query: LinkQuery): LinkQuery {
  const written: LinkQuery = {};
  for (const name of IN_THE_FIXED_ORDER) {
    const value = query[name];
    if (value) written[name] = value;
  }
  return written;
}
