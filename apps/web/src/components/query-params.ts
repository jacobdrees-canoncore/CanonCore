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
