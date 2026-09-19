import { createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@canoncore/ui/components/empty";
import { call } from "@orpc/server";
import { connection } from "next/server";
import {
  Holding,
  JumpToALetter,
  Listing,
  NarrowToAGroup,
  NoSuchGroup,
  PastTheEnd,
  theScope,
  Walk,
  type WhereThePageIs,
} from "@/components/listing";
import { oneGroup, oneValue } from "@/components/query-params";
import { TheirWords } from "@/components/their-words";

/**
 * WORK-BROWSING: what can I watch, without the cast.
 *
 * ADR-0077 phrases its rule around THE QUESTION A SURFACE ASKS rather than
 * around a list of surfaces, and this asks the narrow one. The front page asks
 * the wide one -- "what is in this catalogue" -- and hides nothing, which is
 * why these are two surfaces rather than one with a filter bolted to it.
 *
 * THE RULE ITSELF IS NOT HERE, and that is deliberate. `kind = 'work' AND (NOT
 * is_container OR holds_work)` lives in `packages/db/src/queries.ts` beside the
 * catalogue's own predicate, so the listing and the count it reports cannot
 * come to disagree about which question they answered. What this file decides
 * is which question to ask.
 *
 * The router is called IN-PROCESS, as the front page and the item page call it.
 * A server component fetching its own API is a round trip to itself, and oRPC
 * documents `call` as the way to avoid it.
 */
async function readWorkBrowsing(at: WhereThePageIs, group: string | undefined) {
  /*
   * PRERENDERING STOPS HERE (ADR-0117), and the line is the rule rather than
   * the effect.
   *
   * This page reads the catalogue. It also reads `searchParams` for the cursor,
   * which makes it dynamic on its own -- so by that record's letter this call
   * is redundant today. It is here anyway, for the reason the front page gives
   * in the same words: `?after=` is present to walk a listing rather than to
   * promise this page renders per request, and the day paging changes shape the
   * page would go back to being a photograph of itself with nothing in the diff
   * to say so. On self-hosted software that photograph is a browse grid frozen
   * at the moment somebody built the image, which no import would ever change.
   *
   * AND THE CHECK THAT CATCHES IT IS A SHAPE RATHER THAN AN ASSERTION about
   * this page: two instances of one build, pointed at different databases, asked
   * for this same path, must answer differently. ADR-0117 says a new read
   * surface earns that pair rather than merely the line, because "the line
   * without the check is a rule somebody remembers". It is in
   * `apps/web/e2e/works-page.test.ts`.
   */
  await connection();
  const context = await createContext();
  // AND EVERY GROUP THERE IS, which the picker offers and the Group this page
  // was narrowed to is found among -- the front page's pair, for its reason
  // (CNCORE-180).
  const [works, { groups }] = await Promise.all([
    call(appRouter.catalogue.works, { ...at, group }, { context }),
    call(appRouter.group.list, undefined, { context }),
  ]);
  return { works, groups };
}

export default async function WorksPage({
  searchParams,
}: {
  searchParams: Promise<{
    after?: string | string[];
    before?: string | string[];
    letter?: string | string[];
    group?: string | string[];
  }>;
}) {
  // WHERE THE PAGE STARTS, read on the SERVER so the page a reader is served
  // is already the page they asked for: ADR-0119's cursor, the step back and
  // the letter (CNCORE-174). `oneValue` owns what a repeated parameter means,
  // so every reading surface answers that the same way.
  //
  // AND THE GROUP BESIDE IT (CNCORE-180), which `oneGroup` reads for every
  // surface that narrows.
  const { after, before, letter, group } = await searchParams;
  const at = { after: oneValue(after), before: oneValue(before), letter: oneValue(letter) };
  const narrowedTo = oneGroup(group);
  const { works, groups } = await readWorkBrowsing(at, narrowedTo);
  const rows = works.rows;
  const scope = theScope(groups, narrowedTo);
  // NOTHING TO WATCH IN WHAT WAS ASKED, which is the Group's Works when there
  // is one. A Group that is not there is a different fact, and `NoSuchGroup`
  // says it instead.
  const nothingToWatch = works.total === 0 && !scope.gone;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-3xl font-medium">Works</h1>
        {rows.length > 0 && <Holding showing={rows.length} total={works.total} />}
      </div>
      {groups.length > 0 && (
        <NarrowToAGroup path="/works" groups={groups} narrowedTo={narrowedTo} />
      )}
      {works.total > 0 && (
        <JumpToALetter path="/works" narrowed={scope.narrowed} jumpedTo={at.letter} />
      )}
      {scope.gone && <NoSuchGroup path="/works" />}
      {nothingToWatch && <NothingToWatch within={scope.group?.name} />}
      {/*
        ITEMS BEHIND IT AND NOTHING ON THIS PAGE, which is what a cursor makes
        possible: the link was cut at an item, and nothing is after that item
        any more. Rare, and a DEAD END if nothing says so.
      */}
      {works.total > 0 && rows.length === 0 && (
        <PastTheEnd path="/works" narrowed={scope.narrowed} jumpedTo={at.letter} />
      )}
      {rows.length > 0 && (
        <>
          <Listing rows={rows} />
          <Walk
            path="/works"
            narrowed={scope.narrowed}
            continuesAfter={works.continuesAfter}
            continuesBefore={works.continuesBefore}
          />
        </>
      )}
    </main>
  );
}

/**
 * NOTHING TO WATCH, WHICH IS NOT THE SAME AS AN EMPTY CATALOGUE.
 *
 * A catalogue holding only People and Characters is a real state and a
 * confusing one: the front page shows rows, this page shows none, and without a
 * word here the difference reads as a fault. ADR-0077 is what produces it -- a
 * surface answering "what can I watch" excludes the entity kinds -- so naming
 * the rule is what turns an empty grid back into an answer.
 *
 * IT DOES NOT REPEAT THE FRONT PAGE'S ROUTES OUT OF AN EMPTY CATALOGUE. Adding
 * an item by hand and importing from a provider are the two that fill one
 * (ADR-0094), and that page owns those words; a catalogue with entities in it
 * has already been filled by one of them. What this page points at is the
 * surface that can show them.
 *
 * AND IT NAMES THE GROUP, WHERE THE PAGE IS NARROWED TO ONE (CNCORE-180). A
 * scope holding only People is a real state too, and the same rule produces
 * it: the Group is not empty, and the Catalogue narrowed to it lists every one
 * of them. The sentence says which of the two it is about rather than calling
 * a full catalogue empty of Works.
 */
function NothingToWatch({ within }: { within?: string }) {
  return (
    <section aria-labelledby="nothing-to-watch" className="mt-6">
      <Empty className="border">
        <EmptyHeader>
          {/*
            A REAL HEADING INSIDE THE PRIMITIVE. `EmptyTitle` renders a `div`,
            so a section labelled by one is labelled by something that is not a
            heading -- and a reader navigating this page by heading finds only
            the `h1`.
          */}
          <EmptyTitle>
            {/* The Group's name through `TheirWords`, for the reason the picker gives. */}
            <h2 id="nothing-to-watch">
              {within === undefined ? (
                "Nothing to watch yet"
              ) : (
                <>
                  Nothing to watch in <TheirWords>{within}</TheirWords>
                </>
              )}
            </h2>
          </EmptyTitle>
          <EmptyDescription>
            This page shows Works: stories, and the orderings that hold them. People, Characters and
            the other Entity kinds are deliberately left out of it, so{" "}
            {within === undefined ? "a catalogue" : "a Group"} of only those shows nothing here and
            everything on the catalogue page.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}
