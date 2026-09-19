import type { AppRouterClient } from "@canoncore/api/routers";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@canoncore/ui/components/empty";
import Link from "next/link";

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
 * the first page of anybody's results. The two surfaces that ARE their address
 * may not pass one, and the one that is not must.
 */
type Walking =
  | { path: "/" | "/works"; asked?: never; listing?: never }
  | { path: "/search"; asked: Asked; listing?: never }
  | { path: MembersPath; asked: TheRoute; listing: ItemPageListing };

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
 * nothing composes on them: `/search` carries its query and the cursor, and `/`
 * and `/works` carry the cursor alone.
 */
function queryFor(walking: Walking, at: string | undefined): Record<string, string> {
  if (walking.listing === undefined) {
    return at === undefined ? { ...walking.asked } : { ...walking.asked, after: at };
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
        ? `Showing ${grouped.format(showing)} of ${grouped.format(total)} ${noun}s`
        : `${grouped.format(total)} ${total === 1 ? noun : `${noun}s`}`}
    </p>
  );
}

/**
 * WHAT A CONTAINER'S ROW SAYS IT IS, AND HOW MUCH OF IT THERE IS (CNCORE-183).
 *
 * ONE PHRASE RATHER THAN A SECOND CHIP BESIDE THE FIRST. The words around a Row
 * are already two -- "Container" and the kind -- and a third would read as
 * "Container 2,913 members Work", three greys with nothing saying which two
 * belong together. The size is a fact ABOUT the container rather than a fact
 * beside it, so it is in the same sentence.
 *
 * THE WORD IS THE READER'S ONE. `CONTEXT.md` settles "Members" as what a reader
 * is shown from the container's end, where `member` is a name it rejects in
 * code -- which is why the field this reads is `holds` and the word here is not.
 *
 * AND AN EMPTY ORDERING SAYS SO. "Container, 0 members" is a real state and a
 * useful one: an ordering an import left empty looks exactly like a full one
 * otherwise, which is the thing a reader opens it to find out.
 */
function holding(holds: number): string {
  return `Container, ${grouped.format(holds)} ${holds === 1 ? "member" : "members"}`;
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
            {row.title ?? "Untitled item"}
          </Link>
          <span className="flex items-baseline gap-3 text-muted-foreground text-sm">
            {/*
              ADR-0004 folds containers into `work`, so the kind alone cannot
              tell a story from an ordering that holds stories. A reader
              scanning this list is asking which of the two they are looking at,
              and since CNCORE-183 the same words answer how much of it there is.
            */}
            {row.isContainer && <span>{holding(row.holds)}</span>}
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
