import { z } from "zod";

/**
 * HOW MANY ROWS ONE ANSWER CARRIES, when the caller does not say.
 *
 * A CAP RATHER THAN THE WHOLE LISTING, because the front page is the surface
 * every reader opens first and an uncapped listing makes its cost a function of
 * the library behind it. The number is arbitrary in the way a first page always
 * is: enough that a small catalogue arrives whole, small enough that a large one
 * does not arrive at all.
 *
 * AND THE CAP IS NEVER SILENT. `total` comes back beside the rows precisely
 * so a surface can say what it is not showing; a listing that reported only what
 * it returned would present the first hundred as the library.
 *
 * AND THE OTHER HALF IS `after`, which is what REACHES the rows past this
 * ceiling (ADR-0119). The cap is unchanged by it: one answer still costs one
 * page, and a reader walks as many as they care to.
 *
 * IT LIVES BESIDE THE ROUTERS RATHER THAN INSIDE ONE OF THEM, because FOUR
 * listings read it now and only three of them are on the catalogue router. A
 * container's own members are the fourth and they hang off `item.get`, since a
 * Container is an Item and its page is the Item page (ADR-0004, ADR-0066) --
 * so a copy of this number over there would be a second ceiling nobody chose,
 * which is the drift `listingInput` already carries a paragraph about.
 */
export const A_PAGE = 100;

/**
 * WHERE TO CARRY ON FROM: the id of the last row the page before this one
 * carried, which `continuesAfter` handed over (ADR-0119).
 *
 * `z.string()` RATHER THAN `z.uuid()`, which is ADR-0066's rule for a parameter
 * that is not an identity: any string may be asked about, and the answer says
 * whether it named anything. One that names no row names no position either,
 * so the walk starts at the beginning rather than raising -- and a reader whose
 * bookmark outlived the row it was cut at gets the listing rather than an
 * error page.
 *
 * WRITTEN ONCE FOR EVERY LISTING, rows of items and rows of placements
 * alike. What the cursor NAMES differs between them -- an item for the three
 * listings of the catalogue, a placement for a container's members, because a
 * Repeat is one item twice and only the placement can say which row a page
 * ended on -- and the rule above holds for both regardless.
 */
export const aCursor = z.string().optional();
