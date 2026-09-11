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
