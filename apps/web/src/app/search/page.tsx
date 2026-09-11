import { createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@canoncore/ui/components/empty";
import { call } from "@orpc/server";
import { Holding, Listing } from "@/components/listing";

/**
 * CATALOGUE SEARCH, which is what finding something without knowing its id
 * looks like.
 *
 * `CONTEXT.md` names this surface and separates it from the CMPP operation also
 * called Search: that one asks a PROVIDER for candidate matches, and this asks
 * the owner's own catalogue about what is already in it.
 *
 * ACROSS EVERY KIND. ADR-0077 phrases its rule around the QUESTION A SURFACE
 * ASKS, and this asks "where is the thing I am thinking of" -- so a Character's
 * name finds the Character, and every result says which kind it is, because a
 * Person and a Work sharing a name are otherwise two identical rows.
 *
 * NO `connection()` HERE, AND THAT IS ADR-0117 FOLLOWED RATHER THAN FORGOTTEN.
 * That record asks for "`await connection()` at the top of the read, OR a
 * request-time API the page was going to touch anyway", and is explicit that
 * "a page that touches a request-time API for its own reasons needs nothing
 * added" -- naming `/items/<id>` and its `searchParams` as the case. This page
 * is that case in its strongest form: `q` is not decoration it might stop
 * reading, it is the entire input, and a search page that no longer read the
 * query would not be this page any more.
 *
 * WHAT ACTUALLY PROVES IT IS THE PAIR, not this paragraph. ADR-0117 is clear
 * that a new read surface earns the CHECK rather than merely the declaration:
 * `e2e/search.test.ts` asks two instances of one build, pointed at different
 * databases, for this same path and expects different answers. A prerendered
 * page looks correct on the server it was built against, which is every server
 * anybody would think to look at.
 */
async function readSearch(query: string) {
  // The router is called IN-PROCESS, as the front page and the item page call
  // it. A server component fetching its own API is a round trip to itself, and
  // oRPC documents `call` as the way to avoid it.
  return call(appRouter.catalogue.search, { query }, { context: await createContext() });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  /*
   * A REPEATED PARAMETER NAMES NO QUERY rather than the first of several. That
   * is the rule `/items/<id>` applies to `via` and `placed` (ADR-0066) and the
   * front page applies to `after`, and a third surface answering it differently
   * would be three conventions for one question.
   */
  const query = typeof q === "string" ? q : "";
  /*
   * THE EMPTY QUERY IS ANSWERED HERE AND AGAIN BELOW THIS SEAM, and the
   * repetition is deliberate. This decides what to RENDER -- a prompt rather
   * than a result list, which is a question about words on a page. The read
   * path decides what to ANSWER, because an escaped empty query is the pattern
   * `%%` and matches every titled row, and that must be impossible for every
   * caller rather than for this page.
   */
  const asked = query.trim() !== "";
  const results = asked ? await readSearch(query) : null;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        {/*
          QUALIFIED, BECAUSE `CONTEXT.md` BINDS UI COPY. It names this surface
          "Catalogue search" and lists "search, unqualified" under _Avoid_ --
          the word alone is the CMPP operation, which asks a provider for
          candidates rather than asking this catalogue what it holds. Every
          other string in this slice qualified it and this one, the only one a
          reader actually sees, did not. Beside the front page's
          `<h1>Catalogue</h1>` the pair now reads Catalogue / Catalogue search.
        */}
        <h1 className="text-3xl font-medium">Catalogue search</h1>
        {results !== null && results.total > 0 && (
          <Holding showing={results.entries.length} total={results.total} noun="result" />
        )}
      </div>
      {results === null && <NothingAsked />}
      {results !== null && results.total === 0 && <NothingFound query={query} />}
      {results !== null && results.entries.length > 0 && <Listing entries={results.entries} />}
    </main>
  );
}

/**
 * A SEARCH PAGE NOBODY HAS SEARCHED FROM, reached by pressing Enter on an empty
 * box or by opening `/search` directly.
 *
 * IT SAYS SO RATHER THAN LISTING THE CATALOGUE. The front page already answers
 * "what is in this catalogue" (ADR-0077's wide question), so a search falling
 * back to it would be a second surface giving the same reply to a different
 * question.
 */
function NothingAsked() {
  return (
    <section aria-labelledby="nothing-asked">
      <Empty className="mt-6 border">
        <EmptyHeader>
          <EmptyTitle>
            {/*
            A REAL HEADING INSIDE THE PRIMITIVE. `EmptyTitle` renders a `div`,
            so a reader navigating by heading would find only the `h1`. The
            front page carries the same note for the same reason.
          */}
            <h2 id="nothing-asked">Search the catalogue</h2>
          </EmptyTitle>
          <EmptyDescription>
            Type a name into the box above. It matches anywhere inside a title, and it searches
            every kind of item &mdash; a character&rsquo;s name finds the character as readily as a
            story&rsquo;s finds the story.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}

/**
 * A SEARCH THAT MATCHED NOTHING, said out loud.
 *
 * An empty results list renders as an empty page, which is indistinguishable
 * from a page that failed to load. It also names the one real limit of what was
 * searched, because a reader who knows the item is there deserves the reason
 * rather than the suspicion that the search is broken.
 */
function NothingFound({ query }: { query: string }) {
  return (
    <section aria-labelledby="nothing-found">
      <Empty className="mt-6 border">
        <EmptyHeader>
          <EmptyTitle>
            <h2 id="nothing-found">Nothing matched {query}</h2>
          </EmptyTitle>
          <EmptyDescription>
            {/*
            ADR-0014: `title` is a PROJECTION -- whichever title statement
            currently wins. Alternative and foreign-language titles are held as
            statements and are not searched, which is a real limit rather than a
            bug, and one a reader hunting a title they have definitely seen will
            otherwise spend a while disbelieving.
          */}
            Search reads the title each item goes by. An item known here under a different title
            &mdash; a translation, or a name a source does not prefer &mdash; is not found by it
            yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}
