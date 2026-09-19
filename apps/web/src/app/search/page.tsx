import { createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@canoncore/ui/components/empty";
import { call } from "@orpc/server";
import Link from "next/link";
import {
  Holding,
  Listing,
  NarrowToAGroup,
  NoSuchGroup,
  PastTheEnd,
  theScope,
  theStartOf,
  Walk,
} from "@/components/listing";
import {
  oneGroup,
  oneValue,
  type WhereThePageStarts,
  whereThePageStarts,
} from "@/components/query-params";
import { TheirWords } from "@/components/their-words";

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
async function readSearch(query: string, at: WhereThePageStarts, group: string | undefined) {
  // The router is called IN-PROCESS, as the front page and the item page call
  // it. A server component fetching its own API is a round trip to itself, and
  // oRPC documents `call` as the way to avoid it.
  //
  // THE QUERY GOES DOWN WITH THE CURSOR, AND BOTH ARE NEEDED (ADR-0119). This
  // order leads on how close a title is to what was typed, so the anchor's
  // closeness is RECOMPUTED against the query rather than read off the anchor
  // row -- which is why a paged search is `?q=<query>&after=<id>` and not a
  // cursor that could stand on its own.
  //
  // AND WITHIN THE GROUP A READER PICKED, beside every Group there is for the
  // picker to offer -- the front page's pair, for its reason (CNCORE-180).
  const context = await createContext();
  const [results, { groups }] = await Promise.all([
    call(appRouter.catalogue.search, { query, ...at, group }, { context }),
    call(appRouter.group.list, undefined, { context }),
  ]);
  return { results, groups };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    group?: string | string[];
    after?: string | string[];
    before?: string | string[];
  }>;
}) {
  const { q, group, after, before } = await searchParams;
  /*
   * A REPEATED PARAMETER NAMES NO QUERY rather than the first of several. That
   * is the rule `/items/<id>` applies to `via` and `placed` (ADR-0066) and the
   * front page applies to `after`, and a third surface answering it differently
   * would be three conventions for one question.
   */
  // `oneValue` owns what a repeated or blank parameter means, for every
  // surface that reads one. An absent query is a real state here -- the page
  // renders its box and nothing else -- so the empty string is this page's
  // answer to "nothing asked" rather than a second reading of the parameter.
  const query = oneValue(q) ?? "";
  /*
   * THE EMPTY QUERY IS ANSWERED HERE AND AGAIN BELOW THIS SEAM, and the
   * repetition is deliberate. This decides what to RENDER -- a prompt rather
   * than a result list, which is a question about words on a page. The read
   * path decides what to ANSWER, because an escaped empty query is the pattern
   * `%%` and matches every titled row, and that must be impossible for every
   * caller rather than for this page.
   */
  const asked = query.trim() !== "";
  // ADR-0119's cursor and the step back (CNCORE-174), read on the SERVER so
  // the page a reader is served is already the page they asked for. `oneValue`
  // owns what a repeated parameter means, so all three reading surfaces answer
  // that the same way. No letter: a ranking is not filed under one.
  const at = whereThePageStarts({ after, before });
  // AND THE GROUP IT IS ASKED WITHIN (CNCORE-180), which `oneGroup` reads for
  // every surface that narrows.
  const narrowedTo = oneGroup(group);
  const read = asked ? await readSearch(query, at, narrowedTo) : null;
  const results = read?.results ?? null;
  const groups = read?.groups ?? [];
  // NARROWED ONLY WHERE SOMETHING WAS SEARCHED. With no query there is no list
  // of Groups to find this one in, and reading the parameter anyway would call
  // every Group "gone" -- true of nothing, and one missed `results` check from
  // rendering "No such Group" over a page that asked for no Group's answer.
  const scope = theScope(groups, read === null ? undefined : narrowedTo);
  // THIS LISTING AS THE WALK AND THE PICKER SEE IT: its address and the query.
  // The Group rides separately, as `narrowed`, so `queryFor` writes the query,
  // then the Group, then the cursor.
  const surface = { path: "/search", asked: { q: query } } as const;

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
          <Holding showing={results.rows.length} total={results.total} noun="result" />
        )}
      </div>
      {/*
        THE PICKER ONCE THERE IS A SEARCH TO NARROW, and not before. `/search`
        with no query answers nothing, so a Group picked there would narrow a
        prompt. The box that asks the question is in the shell, and carries
        whatever Group the address names (CNCORE-181) -- which, for every link
        this app writes, is a page already narrowed to it. A scope is first
        picked where there is something to narrow.
      */}
      {results !== null && groups.length > 0 && (
        <NarrowToAGroup {...surface} groups={groups} narrowedTo={narrowedTo} />
      )}
      {results === null && <NothingAsked />}
      {results !== null && scope.gone && <NoSuchGroup {...surface} />}
      {results !== null && results.total === 0 && !scope.gone && (
        <NothingFound query={query} within={scope.group?.name} everywhere={theStartOf(surface)} />
      )}
      {/*
        MATCHES, AND NONE OF THEM ON THIS PAGE, which is what a cursor makes
        possible: the link was cut at a result, and nothing ranks after that
        result any more. It is rare and it is a DEAD END if nothing says so --
        an empty list under a heading reads as a page that failed to load.
      */}
      {results !== null && results.total > 0 && results.rows.length === 0 && (
        <PastTheEnd {...surface} narrowed={scope.narrowed} />
      )}
      {results !== null && results.rows.length > 0 && (
        <>
          <Listing rows={results.rows} />
          <Walk
            {...surface}
            narrowed={scope.narrowed}
            continuesAfter={results.continuesAfter}
            continuesBefore={results.continuesBefore}
          />
        </>
      )}
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
 *
 * AND IT NAMES THE GROUP IT SEARCHED, WHERE IT SEARCHED ONE (CNCORE-180). A
 * search that found nothing in a scope has not searched the catalogue, and a
 * bare "Nothing matched" would read as though it had -- so the sentence says
 * where it looked, and the same search across the catalogue is one link away:
 * `everywhere`, which is the picker's `Everything` rather than an address
 * written here a second time.
 */
function NothingFound({
  query,
  within,
  everywhere,
}: {
  query: string;
  within?: string;
  everywhere: ReturnType<typeof theStartOf>;
}) {
  return (
    <section aria-labelledby="nothing-found">
      <Empty className="mt-6 border">
        <EmptyHeader>
          <EmptyTitle>
            {/*
              THE QUERY AND THE GROUP'S NAME ARE NOT THIS PAGE'S WORDS, so each
              goes through `TheirWords` and the sentence around them does not
              (ADR-0142): one unbroken word from either would otherwise set the
              page's width.
            */}
            <h2 id="nothing-found">
              Nothing matched <TheirWords>{query}</TheirWords>
              {within !== undefined && (
                <>
                  {" "}
                  in <TheirWords>{within}</TheirWords>
                </>
              )}
            </h2>
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
        {within !== undefined && (
          <EmptyContent>
            {/*
              QUALIFIED, for the reason the `h1` above gives: `CONTEXT.md`
              avoids "search" unqualified, and this link is Catalogue search
              over the whole catalogue.
            */}
            <Link href={everywhere} className="hover:underline">
              Search the whole catalogue
            </Link>
          </EmptyContent>
        )}
      </Empty>
    </section>
  );
}
