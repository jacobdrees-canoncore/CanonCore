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
 * ONE LISTING, RENDERED -- shared by THREE surfaces now.
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
 * what order rather than in what an entry is. A test at the router seam holds
 * that agreement.
 *
 * SEARCH WAS THE EXCEPTION UNTIL CNCORE-88, answering a shape of its own
 * because it had no cursor to put in `continuesAfter` -- and null there means
 * "the listing ends here", which a search over a thousand matches must not say.
 * It walks now, so there is one shape.
 */
type ListingAnswer = Awaited<ReturnType<AppRouterClient["catalogue"]["list"]>>;

/** One row of a listing. */
type Entry = ListingAnswer["entries"][number];

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
type Walking = { path: "/" | "/works"; asked?: never } | { path: "/search"; asked: Asked };

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
const ENDS_HERE: Record<ListingPath, string> = {
  "/": "The catalogue ends here",
  "/works": "The list of Works ends here",
  "/search": "These results end here",
};

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
        ? `Showing ${showing} of ${total} ${noun}s`
        : `${total} ${total === 1 ? noun : `${noun}s`}`}
    </p>
  );
}

/**
 * Every item, in the order the catalogue keeps them: `sort_name` where a source
 * has claimed one, and the title otherwise (ADR-0014).
 */
export function Listing({ entries }: { entries: Entry[] }) {
  return (
    <ul className="mt-6 divide-y">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-baseline justify-between gap-4 py-2">
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
          <Link href={`/items/${entry.id}`} className="hover:underline">
            {entry.title ?? "Untitled item"}
          </Link>
          <span className="flex items-baseline gap-3 text-muted-foreground text-sm">
            {/*
              ADR-0004 folds containers into `work`, so the kind alone cannot
              tell a story from an ordering that holds stories. A reader
              scanning this list is asking which of the two they are looking at.
            */}
            {entry.isContainer && <span>Container</span>}
            <span>{entry.kind}</span>
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
  path,
  asked,
  from,
  continuesAfter,
}: Walking & {
  from?: string;
  continuesAfter: string | null;
}) {
  if (from === undefined && continuesAfter === null) return null;
  return (
    <nav aria-label="More of this listing" className="mt-6 flex items-baseline gap-4">
      {from !== undefined && (
        <Link href={{ pathname: path, query: asked }} className="text-sm hover:underline">
          Back to the start
        </Link>
      )}
      {continuesAfter !== null && (
        <Link
          href={{ pathname: path, query: { ...asked, after: continuesAfter } }}
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
export function PastTheEnd({ path, asked }: Walking) {
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
            <h2 id="past-the-end">{ENDS_HERE[path]}</h2>
          </EmptyTitle>
          <EmptyDescription>
            Nothing sorts after the item this link was cut at. It is the last one in this listing
            now, whether or not it was when the link was made.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href={{ pathname: path, query: asked }} className="hover:underline">
            Back to the start
          </Link>
        </EmptyContent>
      </Empty>
    </section>
  );
}
