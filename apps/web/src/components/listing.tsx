import type { AppRouterClient } from "@canoncore/api/routers";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@canoncore/ui/components/empty";
import Link from "next/link";

import { TheirWords } from "./their-words";

/**
 * ONE LISTING, RENDERED -- shared by FOUR surfaces now.
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
 */
export type ListingPath = "/" | "/works" | "/search";

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
 * A SLOT OF ITS OWN RATHER THAN A KEY IN `Asked`, because the order is the
 * point: what the Listing asks, then the Group it asks it within, then where
 * in it the reader stands -- `?q=<query>&group=<id>&after=<id>` on `/search`,
 * and `?group=<id>&after=<id>` on the two that ask nothing else. `queryFor`
 * spreads the three slots in that order, so the order holds by construction
 * rather than by the order some page happened to write its object's keys in.
 * `q` goes first because it was out there first (ADR-0066's rule); no link
 * carrying a query and a Group had been emitted before this, so none acquires
 * a second spelling.
 *
 * THE KEY IS REQUIRED AND THE OBJECT IS OPTIONAL, so a page that is not
 * narrowed passes nothing rather than `{ group: undefined }` -- which Next
 * would write out as `?group=`, a second spelling of the unnarrowed address.
 */
type Narrowed = { group: string };

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
 * that were there before it -- and BOTH cursors are keys here, because each of
 * the two listings has to carry the OTHER's through. Walking either one must
 * leave the other where the reader left it.
 *
 * EVERY KEY OPTIONAL, and a missing one is ABSENT rather than empty: the item
 * page builds this object with only the keys it has, so `?via=&placed=&after=`
 * is not a URL this app can emit.
 */
export type TheRoute = { via?: string; placed?: string; after?: string; placedAfter?: string };

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
 * the first page of anybody's results. The one that is not its address must
 * pass one, and the two that are may not.
 *
 * AND THE THREE THAT ARE THEIR OWN SURFACE MAY BE NARROWED, which is optional
 * because each unnarrowed is its address with no Group on it (CNCORE-179,
 * CNCORE-180). The item page's two may not: an Ordering's Members are not
 * narrowed by a scope, which ADR-0010 records under CNCORE-179 -- and which
 * ADR-0140's figure on a Row depends on, since that figure is what following
 * the Row finds.
 */
type Walking =
  | { path: "/" | "/works"; asked?: never; narrowed?: Narrowed; listing?: never }
  | { path: "/search"; asked: Asked; narrowed?: Narrowed; listing?: never }
  | { path: MembersPath; asked: TheRoute; narrowed?: never; listing: ItemPageListing };

/**
 * PROVIDER SEARCH ON `/import`, WHICH A GROUP NARROWS AND NOTHING WALKS
 * (CNCORE-182).
 *
 * A Group decides which Providers are asked (ADR-0025), so the picker belongs
 * on the one surface that asks them -- with the same address shape as Catalogue
 * search, `?q=<query>&group=<id>`. It is NOT one of `Walking`'s members,
 * because a search a Provider answers is not a Listing: nothing pages it, so
 * it owes the walk no sentence and takes no cursor, and adding it there would
 * make every exhaustive table about Listings name it.
 */
type Searched = { path: "/import"; asked: Asked; narrowed?: Narrowed; listing?: never };

/**
 * ONE OF THE SURFACES A GROUP NARROWS, as the Group picker sees it: where it
 * is, and what it was asked -- with no Group and no cursor, because those are
 * the two things the picker changes. The three Listings that are their own
 * surface, and Provider search.
 */
type Narrowable = Extract<Walking | Searched, { listing?: never }> & { narrowed?: never };

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
} as const satisfies Record<ListingPath | ItemPageListing, string>;

/**
 * WHAT EACH LISTING WALKS WITH, which is the same word for four of the five and
 * a second one for the fifth.
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
  members: "after",
  appearances: "placedAfter",
} as const satisfies Record<ItemPageListing, string>;

/**
 * Which listing is ending, from the address it is walked on.
 *
 * A LOOKUP RATHER THAN A PARAMETER, which is the fix `PastTheEnd` already
 * carries a paragraph about: it took a `path` and a free-text `what`, nothing
 * held the two in step, and `what="The works"` rendered "The works ends here".
 * The three literal paths key themselves; the fourth cannot, so it is named.
 *
 * AND BOTH HALVES ARE CHECKED, WHICH REVIEW OF CNCORE-89 FOUND THEY WERE NOT.
 * This record carried `Record<ListingPath, string>` until a key arrived that is
 * not a path, and dropping the annotation dropped the check with it -- leaving
 * a comment here claiming an exhaustiveness nothing held. The `satisfies` above
 * is one half: every listing path still owes a sentence. The `satisfies` below
 * is the other: a fifth surface added to `Walking` fails to compile here,
 * where a bare fallthrough would silently have rendered a container's sentence
 * over somebody else's listing.
 */
function endsHere(walking: Walking): string {
  // NARROWED ON `listing` RATHER THAN ON `path`, which is a fix rather than a
  // preference: `MembersPath` is a TEMPLATE LITERAL type, so excluding the three
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
 * THE ITEM PAGE'S PARAMETERS IN THEIR ONE FIXED SPELLING ORDER (ADR-0066), read
 * off this array rather than off the order anybody happens to write keys in.
 *
 * A LIST RATHER THAN A SPREAD, WHICH IS A FIX. `Walk` built its query as
 * `{ ...asked, [cursor]: at }` -- and a spread APPENDS a key that was not
 * already there. That is correct while every parameter behind the cursor is
 * absent and wrong the moment one is not: walking `Members` on a page that
 * already carried `?placedAfter=` appended `after` BEHIND it, which is a second
 * spelling of one address and the exact thing a fixed order exists to prevent.
 */
const IN_FIXED_ORDER = [
  "via",
  "placed",
  "after",
  "placedAfter",
] as const satisfies readonly (keyof TheRoute)[];

/**
 * The query one link on this listing carries: everything the address already
 * held, with THIS listing's own cursor set to where the link goes.
 *
 * `at` IS `undefined` FOR A LINK BACK TO THE START, which DROPS this listing's
 * cursor and keeps every other parameter -- including the OTHER listing's
 * cursor, which a reader has not asked to move.
 *
 * THE THREE SURFACES THAT ARE THEIR LISTING TAKE THE OTHER BRANCH, because
 * nothing composes on them: what the Listing asks (`/search`'s query), then
 * the Group it was narrowed to, then the cursor -- each absent where it is.
 */
function queryFor(walking: Walking | Searched, at: string | undefined): Record<string, string> {
  if (walking.listing === undefined) {
    const kept = { ...walking.asked, ...walking.narrowed };
    return at === undefined ? kept : { ...kept, after: at };
  }
  const own = CURSOR[walking.listing];
  const query: Record<string, string> = {};
  for (const key of IN_FIXED_ORDER) {
    const value = key === own ? at : walking.asked[key];
    if (value) query[key] = value;
  }
  return query;
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
 * EVERY NUMBER THIS FILE PRINTS GOES THROUGH IT. The size of the listing and
 * the size of a Row's own ordering sit on one screen, and two spellings of a
 * count there would be the page disagreeing with itself about how it writes a
 * number -- "Showing 100 of 8052 items" beside "2,913 members".
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
 * THE COUNT AND ITS NOUN ARE `soMany` BELOW, shared with the Row's own figure.
 * Both arms of this expression spelled the pluralisation out, and a third
 * spelling arrived with CNCORE-183 one function down -- which is three places
 * for one rule about English to be decided, in a file whose whole argument is
 * that a rule copied is a rule that drifts.
 */
export function Holding({
  showing,
  total,
  noun = "item",
}: {
  showing: number;
  total: number;
  noun?: string;
}) {
  return (
    <p className="text-muted-foreground text-sm">
      {showing < total
        ? `Showing ${grouped.format(showing)} of ${soMany(total, noun)}`
        : soMany(total, noun)}
    </p>
  );
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
 * THE `showing < total` ARM ABOVE CANNOT REACH THE SINGULAR, and takes this
 * anyway rather than spelling the plural itself: that arm renders only where
 * `total` exceeds a page that already has a Row in it, so it is plural by
 * arithmetic. One rule read in both positions is the point (`TheSize`, one
 * package over, for the same argument about a number said twice).
 */
function soMany(count: number, noun: string): string {
  return `${grouped.format(count)} ${count === 1 ? noun : `${noun}s`}`;
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
          <Link href={`/items/${row.id}`} className="hover:underline">
            <TheirWords>{row.title ?? "Untitled item"}</TheirWords>
          </Link>
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
 * HOW A READER REACHES THE REST OF IT (ADR-0119).
 *
 * FORWARD, AND BACK TO THE START. The walk is a keyset one, so `Next` is the
 * direction it has -- reversing it is a second query shape and a capability of
 * its own rather than half of this one. What a reader must never be is
 * STRANDED, and a deep link is exactly where that happens: somebody arriving on
 * page five from a shared URL has no history to go back through. So every page
 * past the first carries the one address that is always somewhere.
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
  from,
  continuesAfter,
  ...walking
}: Walking & {
  from?: string;
  continuesAfter: string | null;
}) {
  if (from === undefined && continuesAfter === null) return null;
  const { path } = walking;
  return (
    <nav aria-label="More of this listing" className="mt-6 flex items-baseline gap-4">
      {from !== undefined && (
        /*
         * WITHOUT THIS LISTING'S OWN CURSOR, which is what makes it the start --
         * and WITH the other listing's, which the reader has not asked to move.
         */
        <Link
          href={{ pathname: path, query: queryFor(walking, undefined) }}
          className="text-sm hover:underline"
        >
          Back to the start
        </Link>
      )}
      {continuesAfter !== null && (
        <Link
          href={{ pathname: path, query: queryFor(walking, continuesAfter) }}
          className="ml-auto text-sm hover:underline"
        >
          Next
        </Link>
      )}
    </nav>
  );
}

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
export function PastTheEnd(walking: Walking) {
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
            Nothing sorts after the one this link was cut at. It is the last one in this listing
            now, whether or not it was when the link was made.
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
    <nav
      aria-label="Narrow to a Group"
      className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-sm"
    >
      <Link
        href={theStartOf(surface)}
        aria-current={narrowedTo === undefined ? "true" : undefined}
        className="hover:underline aria-[current]:font-medium aria-[current]:text-foreground"
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
          className="hover:underline aria-[current]:font-medium aria-[current]:text-foreground"
        >
          <TheirWords>{group.name}</TheirWords>
        </Link>
      ))}
    </nav>
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
