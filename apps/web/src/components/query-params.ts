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
 * WHERE A PAGE OF A LISTING STARTS, as its address says (CNCORE-174): past a
 * Row, short of one, or at a letter -- or at the start, where it says none.
 * The read path decides which counts where an address says several, and no
 * link this app writes does.
 */
export type WhereThePageStarts = { after?: string; before?: string; letter?: string };

/**
 * WHERE THE PAGE STARTS, read off its address the way `oneValue` reads any
 * parameter. One function because every Listing page reads the same three,
 * and two copies of the object were one rule written twice. A surface whose
 * Listing takes no letter hands none in, and none comes back.
 */
export function whereThePageStarts(parameters: {
  after?: string | string[];
  before?: string | string[];
  letter?: string | string[];
}): WhereThePageStarts {
  return {
    after: oneValue(parameters.after),
    before: oneValue(parameters.before),
    letter: oneValue(parameters.letter),
  };
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
 * Server Action redirects to one `?undo=`: an address carrying
 * one parameter has no order to keep, so those are written where they are
 * rather than routed through here. A second parameter on any of them belongs
 * on this list first.
 *
 * `refused` AND `because` ARE THAT SECOND PARAMETER ARRIVING (CNCORE-262), and the
 * sentence above is the instruction being followed rather than a rule being
 * broken. `/settings` refuses an entry in one of THREE ways with three
 * different remedies, and the reason cannot ride in `?refused=` itself: one of
 * the three is an entry that is blank, which `oneValue` reads as an absent
 * parameter -- correctly -- so the page rendered nothing at all. The entry and
 * the word for what is wrong with it are two facts, so they are two
 * parameters, and this is where their order is settled.
 *
 * APPENDED, which is the rule a newcomer meets. `?refused=` is out there today
 * on `/login` and on an Item's page, and each of those carries it ALONE -- so
 * no address anywhere is re-spelled by fixing a position for it here, and the
 * exemption two paragraphs up is exactly why. `because` sits behind `refused`
 * since it qualifies it: what was refused, then what was wrong with it --
 * `?refused=<what>&because=<code>`, which reads as the sentence it is. The name
 * is CNCORE-255's too, reached independently for the same pair on an Item's
 * page, so the two surfaces spell one concept one way (`CONTEXT.md`).
 *
 * STATED ONCE FOR EVERY SURFACE SINCE CNCORE-181. It was two shapes until
 * then: the Item page's four read off an array in `listing.tsx`, and the
 * Listings' `q`, `group`, `after` held by the order `queryFor` spread its slots
 * in -- with the Item page's chips holding a third copy by the order `theRoute`
 * set its keys. Two statements of one order are two that can drift, and a
 * drifted one is a second spelling of one page.
 *
 * WHY THE TWO HALVES INTERLEAVE AS THEY DO. `via` and `placed` are only ever
 * written on an Item's page and `q` and `group` only on a Listing's or on
 * Provider search's (CNCORE-182), so no link
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
 *
 * `letter`, `before` AND `placedBefore` ARRIVED WITH CNCORE-174 AND ARE
 * APPENDED, each behind every parameter already out there, which is the rule
 * this list keeps. A Listing's own `after`, `before` and `letter` never share a
 * link -- each names where the page starts, and a link names one -- so what
 * appending decides is only how one Listing's step back sits beside the OTHER
 * Listing's cursor on the Item page: `?placedAfter=<id>&before=<id>`.
 *
 * `kind` AND `order` ARRIVED WITH CNCORE-175 AND ARE NOT APPENDED EITHER, for
 * the reason the pair below gives: no link out there carried either of them, so
 * placing them inside the list re-spells nothing. `kind` sits BESIDE `group`
 * because the two are the same act on different axes -- both narrow a Listing
 * the reader is already looking at -- and `order` sits behind both because it
 * sequences whatever they leave. All three stand ahead of the cursor, which is
 * a position WITHIN an ordered, narrowed Listing and means nothing without
 * them: `?group=<id>&kind=person&order=added&after=<id>`.
 *
 * `provider` AND `container` ARRIVED WITH CNCORE-187 AND ARE NOT APPENDED,
 * which that rule allows rather than breaks: it exists so that no link already
 * out there is spelt a second way, and no link carried either of them until
 * `/import` walked a Provider's containers -- the only address naming them was
 * the browse box's form, which a browser writes in the order its fields stand.
 * So they sit where this list says what a page is asked sits: behind `q` and
 * `group`, which never share a link with them, and ahead of the cursor.
 * `?provider=<url>&container=<id>&after=<id>` is a container picked from page
 * two, and the form's own `?provider=<url>&container=<id>` is this order too.
 *
 * `record` ARRIVED WITH CNCORE-238 AND JOINED THIS LIST AT CNCORE-239, which is
 * when it first shared an address with anything. It was written by ONE form and
 * nothing else -- and an address carrying a single parameter has no order to
 * keep, which is the exemption two paragraphs up. Then the way to a record's
 * Container began carrying the SEARCH that found it, so that form writes `q`,
 * `group`, `provider` and `record` together and the order became a real
 * question. It sits behind `container` because it is the same half of the list:
 * what the page is asked. A browser submits a form in the order its fields
 * stand in the document, so the fields there stand in this one.
 */
const IN_THE_FIXED_ORDER = [
  "via",
  "placed",
  "q",
  "group",
  "kind",
  "order",
  "provider",
  "container",
  "record",
  "after",
  "placedAfter",
  "letter",
  "before",
  "placedBefore",
  "refused",
  "because",
] as const;

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

/**
 * THE ORDER A READER ASKED THIS LISTING FOR, read off its address (CNCORE-175).
 *
 * ONLY A WORD THIS APP HAS A WALK FOR COMES BACK, and anything else is
 * `undefined` -- which is the Listing in its own order, the same answer an
 * absent parameter gives. That is ADR-0066's rule for a parameter that is not
 * an identity, applied where the set is CLOSED: a Group id is any string
 * because whether it names a Group is the database's to answer, and an order is
 * not, because the orders are the ones `order.ts` has written a comparison for.
 *
 * SO THE SURFACE NEVER SENDS ONE THE SEAM WOULD REFUSE. `browsedInput` declares
 * an enum, so a caller naming no order is a BAD_REQUEST there -- correct for a
 * caller that ought to know the set, and the wrong thing to show a reader who
 * hand-edited a URL. Read here, `?order=banana` is the catalogue in its own
 * order rather than an error page.
 *
 * `name` COMES BACK AS `undefined` RATHER THAN AS ITSELF, because it IS the
 * absence: the bare address is the Listing in its own order, and the picker's
 * "By name" link carries no `order` at all. Answering the word here would make
 * `?order=name` a second address for the page `/` already is (ADR-0066).
 */
export function oneOrder(parameter: string | string[] | undefined): "added" | undefined {
  return oneValue(parameter)?.toLowerCase() === "added" ? "added" : undefined;
}

/**
 * THE KIND A READER NARROWED THIS LISTING TO, read the way `oneGroup` reads a
 * Group and IN LOWER CASE for the same reason (CNCORE-175).
 *
 * THE LOWER CASE IS WHAT KEEPS THE PICKER AND THE LISTING AGREEING. A kind is a
 * lower-case key in `item_kinds` (migration 1) and the picker marks its current
 * chip by matching this against that key, so `?kind=Person` would narrow the
 * Listing while no chip read as current -- the defect review of CNCORE-179
 * found in the Group picker, which is why `oneGroup` lowers too.
 *
 * ANY STRING, UNLIKE `oneOrder` ABOVE, because the seven are the DATABASE's
 * rather than this repository's: a kind nobody defined narrows to nothing and
 * the page says so, which is what an absent row means everywhere else here.
 */
export function oneKind(parameter: string | string[] | undefined): string | undefined {
  return oneValue(parameter)?.toLowerCase();
}
