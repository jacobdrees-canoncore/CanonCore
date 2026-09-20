import { boundedTo } from "@canoncore/text";

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
/**
 * HOW MUCH OF THE READER'S QUERY A PAGE'S OWN SENTENCE QUOTES BACK.
 *
 * THE 80 A VALUE QUOTED IN A SENTENCE TAKES, which is `?refused=`'s on
 * `/settings` and a Container id's in the two refusals that name one. It is not
 * every ceiling in the tree: a REASON and a task's DETAIL take 300, because
 * those are prose a reader has to act on rather than a value being quoted back
 * (`packages/text/src/index.ts` draws that line in as many words). A reader who
 * typed a long query still recognises its opening, and what they cannot do
 * without is the clause saying where to look next.
 *
 * ONE NUMBER FOR BOTH SURFACES, AND THAT IS THIS MODULE'S OWN ARGUMENT. The
 * docblock above exists because `/search` and `/import` had drifted to three
 * spellings of how a parameter is read; two spellings of how much of it may be
 * quoted would be the same defect at the next lever. ADR-0163 keeps each
 * ceiling beside the sentences it bounds, and these ARE those sentences: one
 * app, one reader, one query.
 */
const QUERY_IN_A_SENTENCE = 80;

/**
 * THE QUERY AS A PAGE QUOTES IT, WHICH IS NEVER THE QUERY IT ASKS WITH.
 *
 * TWO VALUES, DELIBERATELY (ADR-0170). What is SEARCHED is the whole query and
 * what is PRINTED is this. A single shortened value would change the ANSWER as
 * well as the sentence -- Catalogue search matches `title ilike '%<query>%'`
 * (ADR-0120), and `/import` sends the words to a Provider -- so a cut query is
 * a different question, and one ending in the cut marker is a question nothing
 * can answer. The links and the hidden field that replay a search carry the
 * whole one for the same reason.
 *
 * BOUNDED WHERE THE PARAMETER IS READ, as `/settings` bounds its own entry
 * (`theEntryRefused`), rather than where it is printed. A value off the address
 * has no earlier seam than the read: a crafted `?q=` reaches either page having
 * touched nothing else, so a bound applied at the search box would guard the
 * one path that was never the problem.
 *
 * AND NOT LEFT TO `TheirWords`. That component says of itself that it does not
 * "quote, bound or attribute": it settles WIDTH by breaking a long word, and a
 * value of any length still occupies the page. ADR-0142 fixes how somebody
 * else's text is laid out; ADR-0123 fixes how much of it this app repeats.
 *
 * BOTH OF ADR-0123'S LEVERS, THROUGH ONE CALL. A cut alone is the
 * half-mechanism that record keeps finding: a bidirectional override re-orders
 * the sentence written AROUND the query at any length, which a ceiling never
 * touches.
 */
// TODO(CNCORE-298): nothing in this tree reports a surface that prints a value
// it did not write inside its own sentence without passing through here. Both
// sites this function exists for were found by a person reading a diff --
// `/search` by inspection, `/import` by the review of the ticket that fixed
// `/search` -- so the list is only ever as good as the last such reading.
export function theQueryQuoted(query: string): string {
  return boundedTo(query, QUERY_IN_A_SENTENCE);
}

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
 * APPENDED, AND THE ORDER IS MATCHED RATHER THAN INVENTED. An Item's page
 * already writes `?refused=<id>&because=<code>` -- CNCORE-255, merged as
 * `5431ab0`, which reached this pair independently -- so the order this list
 * fixes is the one out there, and `/login` carries `?refused=` alone and is
 * re-spelled by nothing. `because` sits behind `refused` since it qualifies
 * it: what was refused, then what was wrong with it, which reads as the
 * sentence it is.
 *
 * AN EARLIER VERSION OF THIS PARAGRAPH SAID `?refused=` WAS CARRIED ALONE
 * EVERYWHERE, and review caught it: `items/actions.ts` had been writing the
 * pair since that merge. The conclusion was right and its premise was not,
 * which is worse than being wrong outright -- a reader checking the claim
 * finds the counter-example and has no way to tell whether the order was
 * chosen or guessed. Corrected in the sentence it corrects, not beside it.
 *
 * SO THE TWO SURFACES SPELL ONE CONCEPT ONE WAY, which `CONTEXT.md` binds and
 * the dispatcher settled on 2026-09-20: `because` on both, never `why` on one.
 *
 * `placing` ARRIVED WITH CNCORE-256 AND IS APPENDED, which is this list's
 * default for a parameter no link out there carries yet -- and here it is the
 * RIGHT default rather than merely the safe one. It is what the Owner narrowed
 * the placement picker to, and the control that carries it is a FORM: the one
 * spelling this list cannot write, because a browser submits fields in the
 * order they stand in the document. Last is the one position that lets the
 * picker's search stand its fields in the fixed order with the query LAST and
 * every parameter the address already carried ahead of it, whichever of them
 * are present -- rather than splitting the hidden fields around a text input to
 * slot the query into the middle of the list.
 *
 * `placing` RATHER THAN `q`, THOUGH BOTH REACH `catalogue.search`. The two
 * name different things and the difference is WHOSE QUESTION it is: `q` is the
 * page's own -- `/search` IS its query, and the shell's box submits one from
 * every page in the app -- where this narrows ONE CONTROL on a page that is
 * about something else entirely. An Item's page carrying `?q=` would read as
 * that page having been searched, beside a header box that submits `q` to
 * `/search` and means the other thing. `CONTEXT.md` binds the CONCEPT, which is
 * Catalogue search, and this is a second surface asking it rather than a second
 * name for it.
 *
 * IT SHARES A LINK WITH `refused` AND `because`, which is why it sits behind
 * them rather than beside `placed`. A refused placement redirects back to the
 * picker the Owner was looking at, and that picker is the narrowed one or their
 * search is gone at the moment they most need it: `?refused=<id>&because=<code>&placing=<query>`
 * is that address, and this is the order it is written in.
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
  "placing",
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
