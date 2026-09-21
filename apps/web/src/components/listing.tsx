import type { AppRouterClient } from "@canoncore/api/routers";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@canoncore/ui/components/empty";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { positionLabel } from "./position";
import { inTheFixedOrder, type LinkQuery } from "./query-params";
import { TheirWords } from "./their-words";

/**
 * ONE LISTING, RENDERED -- shared by FOUR surfaces now, and its walk and its
 * count by a fifth: what one Provider holds, on `/import` (CNCORE-187).
 *
 * The front page asks "what is in this catalogue", `/works` asks "what can I
 * watch" (the two questions ADR-0077 names), and `/search` asks "where is the
 * thing I am thinking of" -- which is not one of that record's two, and is a
 * reader of this file all the same. They differ in WHICH items they are handed,
 * in the order they are handed them, and in the words around them; the list
 * itself, the count above it and the walk below it are the same three rules,
 * and those rules are ones that must not drift:
 *
 * - a URL the framework does not rewrite is never hand-built (ADR-0109),
 * - a cap is never silent (the count),
 * - a listing is walked forward from the last item it showed (ADR-0119).
 *
 * Copied into a second page they would be three rules in two places, which is
 * the hazard `packages/db/src/queries.ts` already carries a paragraph about --
 * and the first of them is the one ADR-0109 says costs "a sweep through every
 * file, discovered on the day a host is chosen" when it is scattered.
 */
/**
 * What a listing answers with, taken from the read path so the two cannot drift.
 *
 * READ OFF `list` AND TRUE OF `works` AND `search` TOO, which is not luck: all
 * three procedures declare `cataloguePublic` as their output, because they
 * answer three questions about one catalogue and differ in WHICH items and in
 * what order rather than in what a row is. A test at the router seam holds
 * that agreement.
 *
 * SEARCH WAS THE EXCEPTION UNTIL CNCORE-88, answering a shape of its own
 * because it had no cursor to put in `continuesAfter` -- and null there means
 * "the listing ends here", which a search over a thousand matches must not say.
 * It walks now, so there is one shape.
 */
type ListingAnswer = Awaited<ReturnType<AppRouterClient["catalogue"]["list"]>>;

/** One row of a listing. */
type Row = ListingAnswer["rows"][number];

/**
 * Which surface is rendering, and therefore what its own address is.
 *
 * A UNION OF LITERALS rather than a string, because `typedRoutes` checks a
 * route against the patterns it generated: a computed string matches none of
 * them and would have to be cast, which is the type system being told to stop
 * looking exactly where ADR-0109 wants it looking. A third reading surface adds
 * a member here and the compiler finds every link that needs it.
 *
 * `/import` IS THE FOURTH (CNCORE-187), and the one whose Listing is not the
 * catalogue's: what one Provider holds, walked a page at a time. It is on that
 * page beside things that are not Listings, so it takes the walk and the count
 * here and not `Listing`'s Rows.
 */
export type ListingPath = "/" | "/works" | "/search" | "/import";

/**
 * THE FOURTH LISTING'S ADDRESS, and the one that is not a literal.
 *
 * A Container's own members are a listing by ADR-0119's first sentence, and a
 * Container IS an Item (ADR-0004) -- so the surface they are walked on is
 * `/items/<id>`, whose path carries an id rather than naming a page. That is
 * why `ListingPath` above stays a union of literals and this is separate: the
 * three that ARE their listing can be enumerated, and this one cannot.
 *
 * A TEMPLATE LITERAL RATHER THAN `string`, which narrows this to the shape
 * `typedRoutes` generated for `/items/[id]` -- the same form the member rows
 * themselves are linked with. It is a SHAPE and not a guarantee: `/items/../x`
 * satisfies it too, and what makes every emitted address an item's is that the
 * one caller builds it from `item.id`. A type that could enforce that would be
 * a branded id, which is a change to how every route in this app is written
 * rather than something this listing gets to introduce.
 */
export type MembersPath = `/items/${string}`;

/**
 * WHAT THE LISTING WAS ASKED, where the path alone does not say.
 *
 * The catalogue and work-browsing ARE their address: `/` is the whole question,
 * so the start of the listing is the path with nothing on it. Catalogue search
 * is not -- `/search` with no `q` is the page that ASKS for a query rather than
 * the first page of anybody's results, so a `Back to the start` pointing there
 * would answer a reader who wanted their first page with an empty prompt.
 *
 * SO THE QUERY RIDES ALONGSIDE THE CURSOR rather than being folded into the
 * path. It is what every link on the surface has to keep, which is the same
 * thing the read path needs it for: this order is a function of the query, so
 * the walk resupplies it on every page (ADR-0119).
 *
 * AN OBJECT NEXT'S OWN ROUTER ENCODES, never a string spliced together here.
 * That is ADR-0109's rule -- a URL the framework does not rewrite is never
 * hand-built -- and the encoding is the second half of it: a reader searching
 * for `100%` or `a&b` builds an address this file must not be writing by hand.
 */
type Asked = { q: string };

/**
 * WHAT THE LISTING WAS NARROWED TO: the Group a reader picked, which every link
 * on a narrowed page has to keep -- on the Catalogue since CNCORE-179, and on
 * work-browsing and Catalogue search since CNCORE-180.
 *
 * THE SAME ARRANGEMENT AS `Asked` ABOVE, for the same reason: the start of a
 * narrowed Listing is its address with the Group on it, so a `Back to the
 * start` that dropped it would hand a reader the whole of it from page three of
 * a scope. And a `Next` that dropped it would walk on into Items the Group does
 * not hold.
 *
 * A SLOT OF ITS OWN RATHER THAN A KEY IN `Asked`, because which surfaces may
 * carry it is not which may ask: `/` and `/works` ask nothing and may be
 * narrowed, and the Item page's two listings may not be narrowed at all. The
 * order it is WRITTEN in is not the slot's any more. It was, until CNCORE-181:
 * `queryFor` spread `asked` then `narrowed` then the cursor, and that spread
 * was one of two places the order lived. It is `inTheFixedOrder`'s now, for
 * every surface -- `?q=<query>&group=<id>&after=<id>` on `/search` and
 * `?group=<id>&after=<id>` on the two that ask nothing else. `q` goes first
 * because it was out there first (ADR-0066's rule).
 *
 * THE KEY IS REQUIRED AND THE OBJECT IS OPTIONAL, so a page that is not
 * narrowed passes nothing rather than `{ group: undefined }` -- which Next
 * would write out as `?group=`, a second spelling of the unnarrowed address.
 */
type Narrowed = { group: string };

/**
 * WHAT THE READER CHOSE ABOUT THE ANSWER ITSELF (CNCORE-175): the order this
 * Listing is read in, and the one kind it is narrowed to. Every link on the
 * page carries both, for `Narrowed`'s reason above -- a `Next` that dropped
 * either would walk on into a Listing the reader is not looking at.
 *
 * ONE SLOT FOR THE PAIR RATHER THAN TWO, because they are independent and a
 * slot each would be four members of `Walking` where there is one question:
 * what did the reader choose. The keys are OPTIONAL here where `Narrowed`'s is
 * required, and `inTheFixedOrder` is what makes that safe -- it drops a key
 * with no value rather than letting Next write `?order=`, which is the second
 * spelling that shape exists to prevent.
 *
 * `order` IS ABSENT FOR THE LISTING'S OWN ORDER, never the word `name`. The
 * bare address IS the catalogue in its own order, so spelling the default would
 * mint a second address for the page `/` already is (ADR-0066). `oneOrder` one
 * file over reads it back to `undefined` for the same reason.
 */
export type Chosen = { order?: "added"; kind?: string };

/**
 * WHAT CATALOGUE SEARCH LETS A READER CHOOSE, which is the kind and not the
 * order. Its Rows are ranked by how close a title is to what was typed
 * (ADR-0120), and an order chosen over that would throw away the ranking that
 * IS the answer -- so the slot exists on that surface with one key rather than
 * the surface being left out of the pair entirely.
 */
type ChosenKind = Pick<Chosen, "kind">;

/**
 * WHAT THE ITEM PAGE'S ADDRESS ALREADY CARRIES, which the listing being walked
 * joins rather than replaces.
 *
 * `?via=` names the ordering the reader arrived through and `?placed=` narrows
 * "Also appears in" to one origin; ADR-0066 declares both NON-IDENTIFYING and
 * writes them in a fixed order, `via` then `placed`. A cursor is APPENDED rather
 * than inserted, because re-ordering the pair already out there would mint a
 * second spelling of every link already emitted -- which is the exact thing a
 * fixed order exists to prevent.
 *
 * SO THE ORDER IS `via`, `placed`, `after`, `placedAfter`, each behind the ones
 * that were there before it, and `inTheFixedOrder` writes it -- and BOTH
 * cursors are keys here, because each of the two listings has to carry the
 * OTHER's through. Walking either one must leave the other where the reader
 * left it.
 *
 * EVERY KEY OPTIONAL, and a missing one is ABSENT rather than empty, which
 * `inTheFixedOrder` enforces: `?via=&placed=&after=` is not a URL this app can
 * emit.
 */
export type TheRoute = {
  via?: string;
  placed?: string;
  after?: string;
  placedAfter?: string;
  before?: string;
  placedBefore?: string;
  /**
   * WHAT THE OWNER NARROWED THE PLACEMENT PICKER TO (CNCORE-256), which every
   * link on this page carries for the reason the two cursors do: the picker is
   * a THIRD thing on this address that has a position of its own, and a walk of
   * either listing that dropped it would empty the Owner's search box because
   * they turned a page of something else.
   *
   * IT IS NOT A CURSOR, so it is not one of the pairs above and no `Walk` owns
   * it. A cursor says where in a listing a reader stands and is dropped by a
   * `Back to the start`; this says which items the picker is offering at all,
   * and only the picker's own search and its way out change it.
   *
   * ON THE OWNER'S PAGE ALONE IN PRACTICE, since the picker renders only for
   * them (ADR-0044) -- but it is a key here rather than a parameter passed
   * beside, because `inTheFixedOrder` is what decides where it sits in an
   * address and this type is what that function's callers on this page hand it.
   */
  placing?: string;
};

/**
 * WHICH OF THE ITEM PAGE'S TWO LISTINGS IS BEING WALKED, which the path cannot
 * say because both are walked on `/items/<id>`.
 *
 * A Container IS an Item (ADR-0004), so one address can be both a container with
 * Members and an item sitting in orderings -- and ADR-0066 keeps it ONE address
 * rather than giving the second listing a page of its own. So the surfaces that
 * ARE their listing are told apart by their path, and these two are told apart
 * by this: the sentence each ends with, and the parameter each walks with.
 */
export type ItemPageListing = "members" | "appearances";

/**
 * WHICH LISTING IS BEING WALKED, and therefore whether it owes a query.
 *
 * A UNION RATHER THAN AN OPTIONAL PROP, so the pairing is true by construction
 * rather than by care. `asked` was simply optional, which let
 * `<Walk path="/search" />` compile -- and that renders exactly the failure the
 * type above has a paragraph warning about: a `Back to the start` pointing at
 * `/search` with no `q`, which is the page that ASKS for a query rather than
 * the first page of anybody's results. The ones that are not their address must
 * pass one -- `/search` its query, `/import` its Provider -- and the two that
 * are may not.
 *
 * AND THE THREE THAT ARE THEIR OWN SURFACE MAY BE NARROWED, which is optional
 * because each unnarrowed is its address with no Group on it (CNCORE-179,
 * CNCORE-180). The item page's two may not: an Ordering's Members are not
 * narrowed by a scope, which ADR-0010 records under CNCORE-179 -- and which
 * ADR-0140's figure on a Row depends on, since that figure is what following
 * the Row finds.
 */
type Walking =
  | {
      path: "/" | "/works";
      asked?: never;
      narrowed?: Narrowed;
      chosen?: Chosen;
      listing?: never;
    }
  | { path: "/search"; asked: Asked; narrowed?: Narrowed; chosen?: ChosenKind; listing?: never }
  | {
      path: MembersPath;
      asked: TheRoute;
      narrowed?: never;
      chosen?: never;
      listing: ItemPageListing;
    }
  | { path: "/import"; asked: Picked; narrowed?: never; chosen?: never; listing?: never };

/**
 * THE CONTAINERS ONE PROVIDER HOLDS, ON `/import` (CNCORE-187): a Listing by
 * `CONTEXT.md`'s own word -- a page of them, how many there are, and where the
 * list carries on -- and walked like every other, by the id of the last one a
 * page showed (ADR-0119).
 *
 * WHICH PROVIDER IS WHAT THE PAGE WAS ASKED, and every link on the walk keeps
 * it, as `/search`'s keep the query. NOT the container the Owner picked, which
 * a walk drops: the page it leads to would otherwise run that container's
 * browse again on every step.
 *
 * NOT NARROWED BY A GROUP, which narrows who a SEARCH asks (ADR-0025): this is
 * one Provider the Owner named, and what it holds is not a question a scope
 * changes.
 */
type Picked = { provider: string };

/**
 * PROVIDER SEARCH ON `/import`, WHICH A GROUP NARROWS AND NOTHING WALKS
 * (CNCORE-182).
 *
 * A Group decides which Providers are asked (ADR-0025), so the picker belongs
 * on the one surface that asks them -- with the same address shape as Catalogue
 * search, `?q=<query>&group=<id>`. It is NOT one of `Walking`'s members,
 * because a search a Provider answers is not a Listing: nothing pages it, so
 * it owes the walk no sentence and takes no cursor, and adding it there would
 * make every exhaustive table about Listings name it. The list of what ONE
 * Provider holds, on the same page, is a Listing and is walked (`Picked`).
 */
type Searched = {
  path: "/import";
  asked: Asked;
  narrowed?: Narrowed;
  chosen?: never;
  listing?: never;
};

/**
 * ONE OF THE SURFACES A GROUP NARROWS, as the Group picker sees it: where it
 * is, and what it was asked -- with no Group and no cursor, because those are
 * the two things the picker changes. The three Listings that are their own
 * surface, and Provider search.
 */
type Narrowable = Exclude<Extract<Walking | Searched, { listing?: never }>, { asked: Picked }> & {
  narrowed?: never;
};

/**
 * WHERE ONE OF THOSE LISTINGS STARTS, UNNARROWED: its address with what it
 * was asked and nothing else. The picker's `Everything` is this, and so is the
 * way out of every notice that says a narrowed page has nothing on it.
 *
 * EXPORTED FOR THE ONE NOTICE THAT LIVES ON ITS PAGE (CNCORE-180): Catalogue
 * search's "nothing matched" offers the same search across the catalogue, and
 * writing that address there by hand would be a third spelling of it beside
 * the picker's and `NoSuchGroup`'s -- which ADR-0066's fixed order exists to
 * prevent.
 */
export function theStartOf(surface: Narrowable) {
  return { pathname: surface.path, query: queryFor(surface, undefined) };
}

/**
 * What each listing calls itself when it has to end a sentence.
 *
 * DERIVED FROM `path` RATHER THAN PASSED BESIDE IT, which is a fix rather than
 * a tidy-up. `PastTheEnd` took a `path` and a free-text `what`, and nothing held
 * the two in step: `what="The works"` met "{what} ends here" and rendered **"The
 * works ends here"**. A caller-supplied noun phrase and a verb written here are
 * two halves of one sentence owned by two files, so each surface writes its own
 * whole clause instead.
 */
const ENDS_HERE = {
  "/": "The catalogue ends here",
  "/works": "The list of Works ends here",
  "/search": "These results end here",
  /*
   * THE TWO THAT ARE NOT KEYED BY THEIR PATH, because both are walked on one
   * address whose path carries an id. `CONTEXT.md` settles "Members" as the
   * reader's word from the container's end and "Also appears in" from the
   * item's, so those are the words these sentences end with -- and the noun
   * inside the second is the glossary's own: an item sits in ORDERINGS.
   */
  members: "This container's Members end here",
  appearances: "The orderings this item appears in end here",
  // A PROVIDER'S LIST, and the noun is the glossary's: what it offers is
  // Containers, whichever word its source uses for them.
  "/import": "The containers this provider lists end here",
} as const satisfies Record<ListingPath | ItemPageListing, string>;

/**
 * WHAT EACH LISTING WALKS WITH, which is the same word for five of the six and
 * a second one for the sixth.
 *
 * ADR-0066 argues `after` for the Members listing precisely because it is "the
 * same word the other three listings walk with", and a parameter named for one
 * surface would be a second convention for one question. That argument holds
 * until ONE PAGE HAS TO SPELL BOTH AT ONCE, which is what CNCORE-125 arrived
 * at: two independent listings on `/items/<id>`, so one of the two cursors has
 * to be qualified or neither can be read.
 *
 * THE BARE WORD STAYS WITH THE ONE THAT ALREADY EMITTED IT. Re-spelling the
 * Members cursor would give every link CNCORE-89 has put into the world a second
 * spelling of itself, which is the one thing ADR-0066's fixed order exists to
 * prevent -- so the parameter arriving later is the one that takes a name.
 *
 * AND IT IS NAMED FOR ITS PAIR RATHER THAN FOR ITS SURFACE. `?placed=` already
 * narrows "Also appears in" to one origin, so `placed` and `placedAfter` read
 * as the one listing's pair; a name like `appearsAfter` would have said the
 * same thing without saying it belonged with the parameter beside it.
 */
const CURSOR = {
  members: { after: "after", before: "before" },
  appearances: { after: "placedAfter", before: "placedBefore" },
} as const satisfies Record<ItemPageListing, { after: string; before: string }>;

/**
 * WHAT THE THREE LISTINGS THAT ARE THEIR OWN SURFACE WALK WITH, which is the
 * bare pair: they each have a page to themselves, so there is no other
 * Listing's cursor to tell theirs from.
 */
const THE_BARE_PAIR = { after: "after", before: "before" } as const;

/**
 * WHERE A LINK TAKES A LISTING (CNCORE-174): on past a Row, back from one, or
 * to a letter. One of the three, because a page starts in one place.
 */
type WhereTo = { after: string } | { before: string } | { letter: string };

/**
 * Which listing is ending, from the address it is walked on.
 *
 * A LOOKUP RATHER THAN A PARAMETER, which is the fix `PastTheEnd` already
 * carries a paragraph about: it took a `path` and a free-text `what`, nothing
 * held the two in step, and `what="The works"` rendered "The works ends here".
 * The four literal paths key themselves; the item page's cannot, so it is named.
 *
 * AND BOTH HALVES ARE CHECKED, WHICH REVIEW OF CNCORE-89 FOUND THEY WERE NOT.
 * This record carried `Record<ListingPath, string>` until a key arrived that is
 * not a path, and dropping the annotation dropped the check with it -- leaving
 * a comment here claiming an exhaustiveness nothing held. The `satisfies` above
 * is one half: every listing path still owes a sentence. The `satisfies` below
 * is the other: a surface added to `Walking` with no sentence fails to compile here,
 * where a bare fallthrough would silently have rendered a container's sentence
 * over somebody else's listing.
 */
function endsHere(walking: Walking): string {
  // NARROWED ON `listing` RATHER THAN ON `path`, which is a fix rather than a
  // preference: `MembersPath` is a TEMPLATE LITERAL type, so excluding the
  // literal paths does not narrow this union the way excluding literals would.
  // `listing` is present on exactly the member whose path is not a literal, so
  // it discriminates where the path cannot.
  if (walking.listing !== undefined) {
    walking.path satisfies MembersPath;
    return ENDS_HERE[walking.listing];
  }
  return ENDS_HERE[walking.path];
}

/**
 * The query one link on this listing carries: everything the address already
 * held, with THIS listing's own cursor set to where the link goes.
 *
 * `to` IS `undefined` FOR A LINK BACK TO THE START, which DROPS this listing's
 * cursor and keeps every other parameter -- including the OTHER listing's
 * cursor, which a reader has not asked to move.
 *
 * WRITTEN IN THE ONE FIXED ORDER `inTheFixedOrder` HOLDS FOR EVERY SURFACE
 * (ADR-0066, CNCORE-181), never in the order this object's keys fall. A spread
 * APPENDS a key that was not already there, and that is a fix this function
 * has already needed once: walking `Members` on a page that already carried
 * `?placedAfter=` appended `after` BEHIND it, a second spelling of one address.
 */
function queryFor(walking: Walking | Searched, to: WhereTo | undefined): LinkQuery {
  const own = walking.listing === undefined ? THE_BARE_PAIR : CURSOR[walking.listing];
  // THIS LISTING'S OWN POSITION IS DROPPED BEFORE THE NEW ONE IS SET, both
  // cursors of it (CNCORE-174): a link names where a page starts, and a Next
  // that kept the `before` it arrived with would name two places at once.
  const startsAt =
    to === undefined
      ? {}
      : "after" in to
        ? { [own.after]: to.after }
        : "before" in to
          ? { [own.before]: to.before }
          : { letter: to.letter };
  return inTheFixedOrder({
    ...walking.asked,
    ...walking.narrowed,
    // WHAT THE READER CHOSE ABOUT THE ANSWER (CNCORE-175), kept by every link
    // this file writes exactly as the Group above it is. `inTheFixedOrder`
    // decides where they sit and drops the ones with no value.
    ...walking.chosen,
    [own.after]: undefined,
    [own.before]: undefined,
    ...startsAt,
  });
}

/**
 * THE ONE SPELLING A COUNT IS PRINTED IN: grouped, so a four-figure one can be
 * read at a glance rather than counted digit by digit.
 *
 * BUILT ONCE RATHER THAN PER RENDER, which is `Moment`'s own reason one file
 * over: a formatter is expensive to construct and carries no state between
 * calls, so Intl's guidance is to keep one -- and this page prints one per Row.
 *
 * `en-GB` RATHER THAN THE READER'S LOCALE, for the reason that component gives
 * about the server not being able to know it: these pages are rendered on the
 * server with no script to correct them afterwards, so the default locale would
 * be whichever one the machine happens to run under. A grouping the reader did
 * not choose is a cosmetic difference; one that changes between two instances
 * of one build is the sort that shows up as a failing assertion nobody can
 * reproduce.
 *
 * EVERY COUNT THIS FILE PRINTS GOES THROUGH IT. The size of the listing and
 * the size of a Row's own ordering sit on one screen, and two spellings of a
 * count there would be the page disagreeing with itself about how it writes a
 * number -- "Showing 100 of 8052 items" beside "2,913 members". A POSITION IS
 * NOT A COUNT, and since CNCORE-184 this file prints those too: `#1234` is an
 * ordinal, written the way the item page writes it, and grouped it would run
 * into the comma between two of them -- "#1,234, #1,240" (ADR-0143). WHICH
 * ROWS A PAGE SHOWS IS GROUPED, ordinals though they are (ADR-0133): they sit
 * in one sentence with the size they are out of, and no list runs them
 * together -- "items 3,201 to 3,300 of 7,000".
 */
const grouped = new Intl.NumberFormat("en-GB");

/**
 * How much of a listing this page is showing, and how much there is.
 *
 * THE CAP IS NEVER SILENT. A listing capped at a page and reported as the whole
 * thing tells an owner their library is smaller than it is, which is the one
 * lie a catalogue must not tell about itself.
 *
 * THE NOUN IS A PARAMETER BECAUSE CATALOGUE SEARCH COUNTS SOMETHING ELSE
 * (CNCORE-66). The two listings count ITEMS -- what the catalogue holds -- and
 * a search counts RESULTS, which is how many matched rather than how many
 * exist. Same sentence, same cap, different thing being counted, so the word is
 * the argument and the rule is not copied. It defaults to `item`, so the
 * surfaces that were here first say exactly what they said before.
 *
 * PLURALISED WITH AN `s`, which is honest for both words this takes and would
 * not be for every word. A caller needing a different plural is the point at
 * which this takes the pair rather than the stem.
 *
 * THE NOUN'S PLURAL IS `ofWhat` BELOW, read by this sentence and by the Row's
 * own figure alike. Both arms of this expression spelled the pluralisation
 * out, and a third spelling arrived with CNCORE-183 one function down -- which
 * is three places for one rule about English to be decided, in a file whose
 * whole argument is that a rule copied is a rule that drifts.
 */
export function Holding({
  showing,
  rowsBefore,
  total,
  noun = "item",
}: {
  showing: number;
  rowsBefore: number;
  total: number;
  noun?: string;
}) {
  return (
    <p className="text-muted-foreground text-sm">
      {showing < total
        ? `Showing ${theRowsShown(showing, rowsBefore, noun)} of ${grouped.format(total)}`
        : soMany(total, noun)}
    </p>
  );
}

/**
 * WHICH OF THEM THIS PAGE SHOWS (ADR-0133): "items 3,201 to 3,300", by where
 * its first and last sit in the Listing, and "item 465" where a page holds one.
 * "Showing 100 of 7,000" read the same on page one and page seventy.
 *
 * `rowsBefore` IS THE LISTING'S OWN COUNT, never the reader's walk added up:
 * a page opened from a link somebody was sent has no walk behind it, and says
 * where it is all the same. It is where the reader IS, and nothing on this page
 * offers it back as somewhere to go -- the letters are how a reader lands.
 */
function theRowsShown(showing: number, rowsBefore: number, noun: string): string {
  const first = grouped.format(rowsBefore + 1);
  if (showing === 1) return `${ofWhat(1, noun)} ${first}`;
  return `${ofWhat(showing, noun)} ${first} to ${grouped.format(rowsBefore + showing)}`;
}

/**
 * A COUNT AND WHAT IT COUNTS, in the one spelling this file prints both in.
 *
 * GROUPED, so a four-figure one is read at a glance rather than counted digit
 * by digit -- and PLURALISED off the count, so "1 member" is not "1 members".
 * The listing's own size and a Row's ordering sit on one screen, and two
 * spellings there would be the page disagreeing with itself about how it
 * writes a number.
 *
 * THE `showing < total` ARM ABOVE DOES NOT TAKE IT SINCE ADR-0133, because
 * the noun moved to the front of that sentence -- "items 101 to 200 of 465" --
 * and is pluralised there off how many the page shows. Both read the plural
 * off `ofWhat`.
 */
function soMany(count: number, noun: string): string {
  return `${grouped.format(count)} ${ofWhat(count, noun)}`;
}

/**
 * THE NOUN FOR SO MANY OF IT, with an `s` beyond one: the one place this file
 * decides a plural, for the reason `Holding` gives.
 */
function ofWhat(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

/**
 * WHERE ONE ROW'S ITEM SITS, IN ONE LINE (ADR-0143): each Ordering by name,
 * with every Position the Row carries in it, so *The Day of the Doctor* reads
 * as one fact rather than three Rows a reader has to assemble.
 *
 * "In no ordering" RATHER THAN "Unplaced", though the ticket says Unplaced.
 * `CONTEXT.md` spends that word on a PLACEMENT with no Position -- "never an
 * absent placement" -- and a story in no Ordering has no Placement at all
 * (ADR-0062). The noun is the glossary's own for what an item sits in, which
 * is `CONTEXT.md`'s Placement from the item's end.
 *
 * GROUPED BY ORDERING, so a Repeat reads "#1, #5" under one name rather than
 * the name twice -- the order `sitsIn.first` arrives in keeps each Ordering's
 * Positions together. A Position no source gave reads "no position given",
 * the glossary's words for the reader, and never as a number.
 *
 * AND THE CUT SAYS SO, and points at the rest: "and 56 more appearances" is a
 * link to the story's own "Also appears in", where every one of the Owner's
 * stories fits on the first page -- the most any one of them has is 61, and a
 * page is 100. "APPEARANCES" BECAUSE THE CUT COUNTS PLACEMENTS: after every
 * Ordering a Row has already named, a bare "and 56 more" reads as 56 more
 * Orderings, and a Repeat is one Ordering twice (`CONTEXT.md`, **Placement**).
 */
function WhereItSits({ id, sitsIn }: { id: string; sitsIn: Row["sitsIn"] }) {
  if (sitsIn.total === 0) return <p className="text-muted-foreground text-sm">In no ordering</p>;
  const more = sitsIn.total - sitsIn.first.length;
  return (
    <p className="text-muted-foreground text-sm">
      Also appears in{" "}
      {byOrdering(sitsIn.first).map(({ containerId, containerTitle, positions }, index) => (
        <Fragment key={containerId}>
          {index > 0 && " · "}
          <Link href={`/items/${containerId}`} className="hover:underline">
            <TheirWords>{containerTitle ?? "Untitled container"}</TheirWords>
          </Link>
          {atPositions(positions)}
        </Fragment>
      ))}
      {more > 0 && (
        <>
          {" · and "}
          <Link href={`/items/${id}#also-appears-in`} className="hover:underline">
            {soMany(more, "more appearance")}
          </Link>
        </>
      )}
    </p>
  );
}

/** The Row's placements, one entry per Ordering in the order they arrived. */
function byOrdering(first: Row["sitsIn"]["first"]) {
  const orderings: {
    containerId: string;
    containerTitle: string | null;
    positions: (number | null)[];
  }[] = [];
  for (const { containerId, containerTitle, position } of first) {
    const last = orderings.at(-1);
    if (last?.containerId === containerId) last.positions.push(position);
    else orderings.push({ containerId, containerTitle, positions: [position] });
  }
  return orderings;
}

/**
 * " #1, #5" after an Ordering's name, ", no position given" where no source gave
 * one, and both where a Repeat has one of each -- the words come last because a
 * missing Position sorts after every numbered one, and after a comma because
 * they would otherwise run into the name. `positionLabel`'s words, in lower
 * case because they sit mid-sentence here. ONE STRING rather than text beside
 * an expression, which React would split with a comment.
 */
function atPositions(positions: (number | null)[]): string {
  return positions
    .map((position, index) => {
      const said = positionLabel(position).toLowerCase();
      return index === 0 && position !== null ? ` ${said}` : `, ${said}`;
    })
    .join("");
}

/**
 * Every item, in the order the catalogue keeps them: `sort_name` where a source
 * has claimed one, and the title otherwise (ADR-0014).
 */
export function Listing({ rows }: { rows: Row[] }) {
  return (
    <ul className="mt-6 divide-y">
      {rows.map((row) => (
        <li key={row.id} className="flex items-baseline justify-between gap-4 py-2">
          {/*
            A PLAIN LINK, carrying no `?via=`. ADR-0066 makes the query the
            ROUTE a reader arrived through, and neither of these surfaces is an
            ordering -- nobody arrives at an item "through the catalogue" in the
            sense a placement means. So the address here is the bare canonical
            one, which is the same address the item is reached at from anywhere
            else. The place a `?via=` IS owed is a container's own member list,
            which is an ordering (see `Members` on the item page).

            AND IT IS A `Link` RATHER THAN AN `a`, WHICH IS A SEPARATE RULE
            (ADR-0109): a URL the framework does not rewrite is never
            hand-built. Next prefixes `Link`, `Form` and `router.push()` and
            nothing else, so a raw `<a href="/items/...">` here would read
            identically and would point at the wrong place the day this app is
            served from a path. Every URL both reading surfaces emit goes
            through this file and the one below it, which is the whole point of
            that rule: routed through one place, a later `basePath` is one line.
          */}
          <div className="min-w-0">
            <Link href={`/items/${row.id}`} className="hover:underline">
              <TheirWords>{row.title ?? "Untitled item"}</TheirWords>
            </Link>
            {/*
              A STORY SAYS WHERE IT SITS, "In no ordering" included, and an
              ORDERING does not: root is where Orderings live, so the line on
              every one of the corpus's 465 would be noise the story's version
              drowned in. None of them sits in another (ADR-0137), and the
              ticket asks for a story's Row, so that case is left to the day
              an Ordering is placed in one.
            */}
            {!row.isContainer && <WhereItSits id={row.id} sitsIn={row.sitsIn} />}
          </div>
          <span className="flex items-baseline gap-3 text-muted-foreground text-sm">
            {/*
              ADR-0004 folds containers into `work`, so the kind alone cannot
              tell a story from an ordering that holds stories. A reader
              scanning this list is asking which of the two they are looking at,
              and since ADR-0140 the same phrase answers how much of it there is.

              ONE PHRASE RATHER THAN A SECOND CHIP BESIDE THIS ONE. The words
              around a Row are already two, and a third would read as
              "Container 2,913 members Work" -- three greys with nothing saying
              which two belong together. The size is a fact ABOUT the container
              rather than one beside it.

              THE WORD IS THE READER'S. `CONTEXT.md` settles "Members" as what
              a reader is shown from the container's end, and rejects `member`
              as a NAME -- which is why the field behind this is `holds`.

              AND AN EMPTY ORDERING SAYS SO: "Container, 0 members" is a real
              state, and one an import that landed nothing leaves behind.
            */}
            {row.isContainer && <span>Container, {soMany(row.holds, "member")}</span>}
            <span>{row.kind}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * HOW A READER REACHES THE REST OF IT (ADR-0119): on, back, and to the start.
 *
 * BACK IS A STEP AND NOT ONLY A RETURN, SINCE CNCORE-174. This said the walk
 * went forward and back to the start and no further, because reversing a keyset
 * walk was "a capability of its own rather than half of this one" -- and
 * ADR-0119 deferred it "until something needs it". Seven thousand Items needed
 * it: page thirty back to page twenty-nine was thirty presses. `Previous` is the
 * page that ends just short of this one's first Row, and the start stays beside
 * it for the reader who wants the top rather than the page before.
 *
 * BOTH ARE READ OFF `continuesBefore`, which is what makes them honest. Offered
 * off the address -- "the page was asked with a cursor" -- they appeared on a
 * page a jump or a step back had landed at the very start of, pointing at the
 * page the reader was already on. The Listing says whether anything comes
 * before this page, the same way `continuesAfter` says whether anything comes
 * after it.
 *
 * IT WALKS ITS OWN SURFACE. `path` is why this takes a parameter at all: a
 * `Next` on `/works` that went to `/?after=` would hand a reader the catalogue
 * they were trying not to be shown, cut at a work-browsing cursor.
 *
 * EVERY `href` HERE IS AN OBJECT, including the one carrying no query.
 * `typedRoutes` resolves a `Link`'s href against the routes it generated, and a
 * union of two literal paths satisfies neither on its own -- so a plain
 * `href={path}` is a type error, and the honest fix is the object form rather
 * than a cast. It emits the same bytes.
 *
 * THE CURSOR IS ENCODED ON THE WAY INTO THE URL. It is a uuid today and every
 * uuid survives encoding unchanged, so this changes no byte the app currently
 * emits -- which is the point: what makes it safe is then the call here rather
 * than an invariant held in a schema two packages away, and ADR-0119 leaves the
 * cursor's format open to revisit. `query` is an object, so Next does the
 * encoding rather than a template literal doing it by hand.
 */
export function Walk({
  continuesAfter,
  continuesBefore,
  ...walking
}: Walking & {
  continuesAfter: string | null;
  continuesBefore: string | null;
}) {
  if (continuesBefore === null && continuesAfter === null) return null;
  const { path } = walking;
  return (
    <nav aria-label="More of this listing" className="mt-6 flex items-baseline gap-4">
      {continuesBefore !== null && (
        <>
          {/*
           * WITHOUT THIS LISTING'S OWN POSITION, which is what makes it the
           * start -- and WITH the other listing's, which the reader has not
           * asked to move.
           */}
          <Link
            href={{ pathname: path, query: queryFor(walking, undefined) }}
            className="text-sm hover:underline"
          >
            Back to the start
          </Link>
          <Link
            href={{ pathname: path, query: queryFor(walking, { before: continuesBefore }) }}
            className="text-sm hover:underline"
          >
            Previous
          </Link>
        </>
      )}
      {continuesAfter !== null && (
        <Link
          href={{ pathname: path, query: queryFor(walking, { after: continuesAfter }) }}
          className="ml-auto text-sm hover:underline"
        >
          Next
        </Link>
      )}
    </nav>
  );
}

/**
 * THE LETTERS A READER JUMPS TO (CNCORE-174), on the two Listings filed by
 * name. Each is the first Row filed under it, or the first after it where
 * nothing is: a SEEK on the sort key the walk already reads, which ADR-0119
 * names as the navigation that fits a keyset walk. There is no numbered page to
 * jump to beside it, and that half of ADR-0119 stands.
 *
 * NOT ON CATALOGUE SEARCH, whose order is how close a title is to what a reader
 * typed: nothing in a ranking is filed under a letter. Nor on a Container's
 * Members, which are in its own order. "ALSO APPEARS IN" IS AN ALPHABET, by the
 * Container's sort name, and goes without one because it never runs past a
 * page: 61 Rows at the longest on the Owner's catalogue, against a cap of 100.
 * ADR-0119 records that as a deviation from CNCORE-174, which asked for the
 * jump on every Listing.
 *
 * LINKS RATHER THAN A CONTROL, for `NarrowToAGroup`'s reason: it works with no
 * script, and a jump is an address somebody can send. Each keeps the Group the
 * page is narrowed to, and drops the page's position, since a letter IS one.
 *
 * `aria-current` MARKS THE LETTER THIS PAGE WAS JUMPED TO, for as long as the
 * address says so: a `Next` from it names a Row rather than a letter, so the
 * mark does not follow the reader on.
 *
 * AND ONE ENTRY AHEAD OF A FOR THE ROWS NO LETTER REACHES (CNCORE-242,
 * ADR-0180). The sort key files a title opening in a digit ahead of A, and on
 * the Owner's own catalogue that is 37 Items of 8,052 that this bar could not
 * reach: `/?letter=A` answers "Showing items 38 to 137" and nothing on the
 * page said what the first 37 were. It goes FIRST because that is where they
 * sort.
 *
 * IT IS THE START OF THIS LISTING, AND THAT IS THE WHOLE ADDRESS. Everything
 * sorting before A sorts before everything else too, so the seek a letter
 * makes and the start of the Listing are one page here -- and writing the jump
 * as anything else would be a second spelling of an address this file already
 * has (ADR-0066). `queryFor(walking, undefined)` is what "Back to the start"
 * links, which keeps the Group, the kind and the order the reader chose.
 *
 * SO NOTHING MARKS IT CURRENT, which is honest rather than an omission: the
 * address records no jump, and a page that marked it would mark it on every
 * unjumped first page too.
 *
 * OFFERED ONLY WHERE SUCH ROWS EXIST, which is PLEX'S BEHAVIOUR and a decision
 * rather than an accident. Plex builds the index server side and returns only
 * the characters that have items; JELLYFIN DOES THE OPPOSITE, rendering `#`
 * beside a fixed A-Z whether or not anything is filed there. ADR-0180 carries
 * which is copied and why, and `beforeTheAlphabet` is the read path's answer
 * asked of the Listing IN FRONT OF THE READER -- narrowed to their Group and
 * their kind, so a bar over a Group holding nothing before A offers none.
 */
export function JumpToALetter({
  jumpedTo,
  beforeTheAlphabet,
  ...walking
}: Extract<Walking, { path: "/" | "/works" }> & {
  jumpedTo?: string;
  /** Whether this Listing holds a Row that A to Z cannot reach (ADR-0180). */
  beforeTheAlphabet: boolean;
}) {
  return (
    <nav
      aria-label="Jump to a letter"
      className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground text-sm"
    >
      {beforeTheAlphabet && (
        <Link
          href={{ pathname: walking.path, query: queryFor(walking, undefined) }}
          /*
           * THE ONE ENTRY HERE WHOSE WORDS ARE NOT ITS OWN NAME. A letter read
           * aloud is the letter; `#` is read as "number sign", which says
           * nothing about what following it does. The label LEADS WITH THE
           * VISIBLE CHARACTER, so the accessible name still contains the words
           * on screen -- a name that replaced them would be the mismatch
           * WCAG's Label in Name is about.
           */
          aria-label={`${BEFORE_THE_ALPHABET}, filed before A`}
          className={PICKED}
        >
          {BEFORE_THE_ALPHABET}
        </Link>
      )}
      {THE_ALPHABET.map((letter) => (
        <Link
          key={letter}
          href={{ pathname: walking.path, query: queryFor(walking, { letter }) }}
          aria-current={jumpedTo?.toUpperCase() === letter ? "true" : undefined}
          className={PICKED}
        >
          {letter}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The letters a Listing filed by name offers, A to Z. What sorts ahead of them
 * is `BEFORE_THE_ALPHABET` below, which this bar offers alongside.
 *
 * THIS DOCBLOCK SAID THOSE ROWS NEEDED NO ENTRY, in these words: "the sort key
 * files a title opening in a digit or a mark ahead of A, which is where the
 * start of the Listing already is". Both halves were wrong. Being where the
 * start is made them reachable, not ADDRESSED -- a reader who jumps to A and
 * does not press Previous never learns they exist (CNCORE-242). And "a digit
 * OR A MARK" is not what the collation does: it ignores punctuation at the
 * first level, so `!bang` files under B.
 */
const THE_ALPHABET = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/**
 * WHAT THE ROWS SORTING BEFORE A ARE LABELLED (CNCORE-242, ADR-0180).
 *
 * `#` IS ATTESTED RATHER THAN CHOSEN. Plex's own API reference returns
 * `{"size":2,"key":"%23","title":"#"}` at the head of `firstCharacters`, and
 * Jellyfin hard-codes `letters = ['#']` before its A-Z. It is not universal --
 * Unicode's ICU calls the same bucket the UNDERFLOW and labels it `...`,
 * Android's `AlphabetIndexer` uses a leading space, and Kodi has no synthetic
 * bucket at all -- so the two products this one is built beside decide it.
 *
 * `CONTEXT.md` HAS NO WORD OF ITS OWN FOR THIS and bars none: `canon`,
 * `record`, `edge` and `duplicate` are the banned names and none of them is
 * near it. So the attested label stands rather than a coined one.
 */
const BEFORE_THE_ALPHABET = "#";

/**
 * A LINK THAT OUTLIVED THE ITEMS AFTER IT.
 *
 * A cursor is cut at an item, and this is what a reader gets when nothing sorts
 * after that item any more -- a bookmark kept while the items that followed it
 * were deleted, or an address typed by hand. Saying the listing ends here, and
 * pointing at the one address that is always somewhere, is the difference
 * between an ending and a page that looks broken.
 *
 * NOT AN ANCHOR DELETED ITSELF, AND THE COPY BELOW SAID IT WAS. A deleted item
 * has no sort key left to place it by, so it names no position at all and the
 * walk starts the listing over rather than arriving here (ADR-0119,
 * CNCORE-110). The sentence read "or it may have been removed since", which
 * named a state this page can no longer be in.
 */
export function PastTheEnd({ jumpedTo, ...walking }: Walking & { jumpedTo?: string }) {
  const { path } = walking;
  return (
    <section aria-labelledby="past-the-end" className="mt-6">
      <Empty className="border">
        <EmptyHeader>
          {/*
            A REAL HEADING INSIDE THE PRIMITIVE. `EmptyTitle` renders a `div`,
            so a section labelled by one is labelled by something that is not a
            heading -- and a reader navigating by heading finds only the `h1`.
          */}
          <EmptyTitle>
            <h2 id="past-the-end">{endsHere(walking)}</h2>
          </EmptyTitle>
          <EmptyDescription>
            {/*
              A JUMP PAST THE LAST LETTER ANYTHING IS FILED UNDER lands here too
              (CNCORE-174), and it was cut at no Row, so it says what it did
              find rather than borrowing the cursor's sentence. IT NAMES THE
              LETTER ONLY WHERE IT IS ONE: anything else a link carries is words
              this page did not write, and they do not go in its sentence.
            */}
            {jumpedTo === undefined
              ? "Nothing sorts after the one this link was cut at. It is the last one in this listing now, whether or not it was when the link was made."
              : THE_ALPHABET.includes(jumpedTo.toUpperCase())
                ? `Nothing here is filed under ${jumpedTo.toUpperCase()} or any letter after it.`
                : "Nothing here is filed where this link jumped to, or after it."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {/* The start of THIS listing, with the other one left where it is. */}
          <Link
            href={{ pathname: path, query: queryFor(walking, undefined) }}
            className="hover:underline"
          >
            Back to the start
          </Link>
        </EmptyContent>
      </Empty>
    </section>
  );
}

/** One Group as the picker offers it, read off the procedure that answers it. */
type Group = Awaited<ReturnType<AppRouterClient["group"]["list"]>>["groups"][number];

/**
 * THE GROUP A PAGE WAS NARROWED TO, AS THE PAGE NEEDS IT: what every link on it
 * carries forward, the Group itself where it is there, and whether it is gone.
 *
 * WRITTEN ONCE FOR THE THREE SURFACES THAT NARROW (CNCORE-180). Each has to
 * tell the same three states apart -- not narrowed, narrowed to a Group, and
 * narrowed to one that is not there -- and they were written inline on the
 * front page while it was the only one. Three copies would be three readings
 * of when a Group is "not there".
 *
 * FOUND BY ITS ID AMONG EVERY GROUP THERE IS, which is also how a link naming
 * no Group is told apart from a Group that holds nothing (CNCORE-179): the
 * Listing narrows to nothing either way, and only this says which.
 *
 * `narrowedTo` IS ALREADY LOWER CASE, which `oneGroup` owns: a uuid spelled in
 * capitals is the same id to PostgreSQL, and this match is a string's.
 */
export function theScope(groups: Group[], narrowedTo: string | undefined) {
  if (narrowedTo === undefined) return { narrowed: undefined, group: undefined, gone: false };
  const group = groups.find(({ id }) => id === narrowedTo);
  return { narrowed: { group: narrowedTo }, group, gone: group === undefined };
}

/**
 * WHERE A READER PICKS A GROUP (ADR-0010): one universe at a time, on every
 * surface that is its own Listing -- the Catalogue since CNCORE-179, and
 * work-browsing and Catalogue search since CNCORE-180 -- and on Provider search
 * since CNCORE-182, where the Group decides who is asked rather than which
 * Items are listed.
 *
 * ONE PICKER, BESIDE THE WALK, because it is the walk's own rule applied to a
 * different parameter: every link it writes is this Listing's start, through
 * `queryFor`, with the Group set or cleared and the query kept. A copy per page
 * would be three spellings of one address, which ADR-0066's fixed order exists
 * to prevent.
 *
 * LINKS RATHER THAN A CONTROL, which is the item page's own argument for its
 * `?placed=` chips: the whole thing works with no script, and a narrowed
 * Listing is an address somebody can send. It is a GET for a page that
 * already exists, so there is nothing for a form to post.
 *
 * `Everything` FIRST, AND IT IS THIS LISTING UNNARROWED. Clearing the scope is
 * one click from any narrowed page (story 44), and it drops the cursor as well
 * as the Group -- a position in one scope is no position in another. On
 * `/search` it keeps the query, because clearing the scope is not clearing the
 * question.
 *
 * `Everything` RATHER THAN `All`, which is the word the item page's chips use
 * and would read wrongly here. Beside a row of Group names, "All" reads as
 * every GROUP -- and an Item in no Group at all is in the catalogue and in no
 * scope, so the union of the Groups is not what clearing shows.
 *
 * EVERY GROUP THERE IS, IN THE OWNER'S OWN ALPHABET, which is `group.list`'s
 * order and story 47: which scopes exist is what a reader needs before they
 * narrow. Uncapped, for the reason `findGroups` gives -- a Group is drawn by
 * hand, so there are as many as universes the Owner curates.
 *
 * SO THIS IS CATALOGUE-WIDE STATE, SITTING INSIDE `<main>`, AND A TEST THAT
 * SHARES AN INSTANCE CAN SEE IT (CNCORE-253, CNCORE-271). Everything else on a
 * narrowed Listing answers to the address: the Rows are the Group's, and
 * `Holding`'s count is that Group's size. This picker answers to the whole
 * catalogue, so a Group created ANYWHERE -- by another test file, by an import
 * running beside it -- changes this page without its address changing. Two e2e
 * files compare one address against itself byte-for-byte to prove the address
 * decides the page, and for four months they were comparing this too: the fix
 * is `steadyMainOf` in `apps/web/e2e/document.ts`, which cuts this `<nav>` out
 * of what they compare. Nothing here needs to change for that, and that is the
 * point -- rendering every Group is what the picker is FOR (ADR-0155).
 *
 * `aria-current` MARKS THE ONE THE PAGE IS NARROWED TO, and it is what makes
 * the narrowing visible rather than inferred from a smaller count. No chip is
 * current on a page naming a Group that is not there, which is `NoSuchGroup`'s
 * to explain.
 *
 * `TheirWords` BECAUSE THE NAME IS THE OWNER'S OWN WORDS WITH NO CAP on them
 * (`group.create`), so one unbroken word would otherwise push the page
 * sideways -- the width CNCORE-217 found a Provider's name taking.
 */
export function NarrowToAGroup({
  groups,
  narrowedTo,
  ...surface
}: Narrowable & { groups: Group[]; narrowedTo?: string }) {
  return (
    <Picker label="Narrow to a Group">
      <Link
        href={theStartOf(surface)}
        aria-current={narrowedTo === undefined ? "true" : undefined}
        className={PICKED}
      >
        Everything
      </Link>
      {groups.map((group) => (
        <Link
          key={group.id}
          href={{
            pathname: surface.path,
            query: queryFor({ ...surface, narrowed: { group: group.id } }, undefined),
          }}
          aria-current={group.id === narrowedTo ? "true" : undefined}
          className={PICKED}
        >
          <TheirWords>{group.name}</TheirWords>
        </Link>
      ))}
    </Picker>
  );
}

/**
 * A LINK NAMING A GROUP THAT IS NOT HERE: deleted since the link was kept, or
 * never one at all.
 *
 * ADR-0066's RULE FOR A PARAMETER THAT IS NOT AN IDENTITY, said on the page.
 * The Listing narrows to nothing because a Group nobody drew holds nothing;
 * what a reader is owed beside that is WHY, since "this Group is empty" -- or
 * "nothing to watch", or "nothing matched" -- would be a claim about a scope
 * that does not exist. So on every surface this replaces that surface's own
 * empty state rather than sitting beside it.
 *
 * AND IT SAYS THE ITEMS ARE SAFE, which is ADR-0010's promise and the thing a
 * reader following a dead link to their own scope most needs to hear: deleting
 * a Group takes no Item with it.
 *
 * THE WAY OUT IS THIS LISTING UNNARROWED, the same address the picker's
 * `Everything` is -- `/works` from work-browsing, the same query from
 * Catalogue search, and the same query asked of every Provider from `/import`
 * -- rather than the Catalogue, which is a different question.
 */
export function NoSuchGroup(surface: Narrowable) {
  return (
    <section aria-labelledby="no-such-group" className="mt-6">
      <Empty className="border">
        <EmptyHeader>
          {/* A real heading, for the reason `PastTheEnd` gives. */}
          <EmptyTitle>
            <h2 id="no-such-group">No such Group</h2>
          </EmptyTitle>
          <EmptyDescription>
            This link narrows to a Group that is not here: it may have been deleted since the link
            was made. Deleting a Group leaves its Items alone, so everything it held is still in the
            catalogue.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href={theStartOf(surface)} className="hover:underline">
            Show everything
          </Link>
        </EmptyContent>
      </Empty>
    </section>
  );
}

/**
 * A SURFACE WHOSE LISTING A READER MAY ORDER (CNCORE-175): the two that are
 * browsed. Catalogue search is not one, for the reason `ChosenKind` gives.
 *
 * THE SURFACE ARRIVES WITH ITS `chosen` STILL ON IT, unlike `Narrowable` above,
 * and that is the difference between a picker that keeps the reader's other
 * choice and one that clears it. Each link below is this Listing's start with
 * ONE key of the pair replaced, so picking an order keeps the kind and picking
 * a kind keeps the order.
 */
type Orderable = Extract<Walking, { path: "/" | "/works" }>;

/**
 * WHAT EVERY PICKER ON A LISTING LOOKS LIKE, written once for the three of them
 * (CNCORE-175). The Group picker, the kind and the order are one shape -- a
 * labelled `nav` of links, one of them marked current -- and they had three
 * copies of the same two class lists between them, which is the drift this file
 * already carries a paragraph about for the rules it shares.
 *
 * THE LABEL IS WHAT TELLS THEM APART, for a reader with a screen reader and for
 * the suite alike: `navIn` finds a picker by it.
 */
function Picker({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-sm"
    >
      {children}
    </nav>
  );
}

/** How one option of a picker reads, marked or not. */
const PICKED = "hover:underline aria-[current]:font-medium aria-[current]:text-foreground";

/**
 * WHETHER THIS LISTING IS FILED UNDER LETTERS, which is whether a jump to one
 * means anything (CNCORE-174, ADR-0119).
 *
 * READ OFF THE ORDER THE READER CHOSE, in one place, because the rule was
 * written three times: the read path declines a letter in the recently-added
 * order, and each of the two pages gated its own alphabet on the same
 * condition. The read path's is the authority over what a letter DOES; this is
 * the one statement of what a page OFFERS.
 */
export function filedByLetter(chosen: Chosen | undefined): boolean {
  return chosen?.order === undefined;
}

/**
 * THIS LISTING WITH THE KIND CLEARED AND EVERYTHING ELSE KEPT -- the picker's
 * `Every kind` as an address, exported for the notice that stands where a
 * narrowed Listing has nothing on it. Written here rather than on the page so
 * that the way out and the picker cannot become two spellings of one address
 * (ADR-0066), which is `theStartOf`'s own reason one export up.
 */
export function withEveryKind(surface: Extract<Walking, { path: "/" | "/works" | "/search" }>) {
  return {
    pathname: surface.path,
    query: queryFor({ ...surface, chosen: { ...surface.chosen, kind: undefined } }, undefined),
  };
}

/**
 * THE TWO ORDERS ONE CATALOGUE HAS OF ITSELF (story 24), in the words a reader
 * picks them by.
 *
 * TWO, AND THE DISPATCHER CHOSE THEM (2026-09-19) for two reasons worth keeping
 * beside the words: `created_at` is on every row, so the walk needs no keyless
 * block where a release date -- sparse across this corpus -- would have needed
 * one; and "Recently added" is the second view Plex and Jellyfin both lead
 * with. A THIRD IS NOT A LINE HERE ALONE: the `satisfies` below names the orders
 * this list may hold, so a third line will not compile until it is widened, and
 * ADR-0150 names every other place a third order reaches.
 *
 * `By name` IS THE ABSENCE and is written first, which is the arrangement the
 * Group picker's `Everything` already has: the default is the Listing with
 * nothing on it, so the address a reader starts at is the one they return to.
 */
const THE_ORDERS = [
  { order: undefined, words: "By name" },
  { order: "added", words: "Recently added" },
] as const satisfies readonly { order?: "added"; words: string }[];

/**
 * WHERE A READER CHOOSES THE ORDER (story 24), beside the walk and the Group
 * picker and built the same way: every link is this Listing's start, through
 * `queryFor`, with the order set or cleared and everything else kept.
 *
 * LINKS RATHER THAN A CONTROL, which is `NarrowToAGroup`'s own argument: it
 * works with no script, and an ordered Listing is an address somebody can send.
 * It is a GET for a page that already exists, so there is nothing to post.
 *
 * IT DROPS THE CURSOR, because a position in one order is no position in
 * another -- the same reason picking a Group drops it. `queryFor(_, undefined)`
 * is what does that, and it is the one call every picker on this page makes.
 *
 * `aria-current` MARKS THE ORDER THE PAGE IS READ IN, which is what makes the
 * choice visible rather than inferred from the Rows being in a different
 * sequence.
 */
export function OrderTheListing({ chosen, ...surface }: Orderable) {
  return (
    <Picker label="Order this Listing">
      {THE_ORDERS.map(({ order, words }) => (
        <Link
          key={words}
          href={{
            pathname: surface.path,
            query: queryFor({ ...surface, chosen: { ...chosen, order } }, undefined),
          }}
          aria-current={chosen?.order === order ? "true" : undefined}
          className={PICKED}
        >
          {words}
        </Link>
      ))}
    </Picker>
  );
}

/** One Item kind as the picker offers it, read off the procedure that answers it. */
type Kind = Awaited<ReturnType<AppRouterClient["item"]["kinds"]>>["kinds"][number];

/**
 * WHERE A READER NARROWS A LISTING TO ONE KIND (story 25), so People and Time
 * spans do not crowd out what they can watch.
 *
 * NOT WORK-BROWSING BY ANOTHER ROUTE, and ADR-0077 is the line. That record
 * decides which kinds a surface's QUESTION includes and says the surface
 * classifies ITSELF by naming the question -- `/works` excludes the entity
 * kinds whatever a reader picks here. This narrows whichever question was
 * asked, on the same axis a Group narrows it, and composes with both: a
 * narrowed `/works` is still work-browsing, and no value here turns `/` into
 * it. So the two controls sit beside each other rather than one standing in for
 * the other.
 *
 * THE KINDS ARE THE DATABASE'S OWN, read through `item.kinds` and offered by
 * the LABEL it carries beside each -- `Time span`, never `time_span`. A list
 * written here would go on offering the old word after a migration renamed one,
 * and would offer seven after a migration added an eighth, which is the
 * argument `findItemKinds` already makes for the create form.
 *
 * `Every kind` RATHER THAN `Everything`, which is the Group picker's word one
 * line up. Two pickers on one page both saying "Everything" would leave a
 * reader no way to tell which of the two they had just cleared -- and this one
 * clears less: a Listing narrowed to a Group and to a kind, with the kind
 * cleared, is still narrowed.
 *
 * `TheirWords` IS NOT NEEDED HERE, unlike the Group picker: these labels are
 * the catalogue's own seven rather than the Owner's free text, so none of them
 * is an unbroken word that pushes the page sideways.
 */
export function NarrowToAKind({
  kinds,
  chosen,
  ...surface
}: Extract<Walking, { path: "/" | "/works" | "/search" }> & { kinds: Kind[] }) {
  return (
    <Picker label="Narrow to a kind">
      <Link
        href={withEveryKind({ ...surface, chosen })}
        aria-current={chosen?.kind === undefined ? "true" : undefined}
        className={PICKED}
      >
        Every kind
      </Link>
      {kinds.map((kind) => (
        <Link
          key={kind.value}
          href={{
            pathname: surface.path,
            query: queryFor({ ...surface, chosen: { ...chosen, kind: kind.value } }, undefined),
          }}
          aria-current={chosen?.kind === kind.value ? "true" : undefined}
          className={PICKED}
        >
          {kind.label}
        </Link>
      ))}
    </Picker>
  );
}
