import { createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { Card, CardDescription, CardHeader, CardTitle } from "@canoncore/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@canoncore/ui/components/empty";
import { call } from "@orpc/server";
import { connection } from "next/server";
import { cursorFrom, Holding, Listing, PastTheEnd, Walk } from "@/components/listing";

/**
 * THE CATALOGUE, which is what opening CanonCore ought to tell you.
 *
 * ADR-0077 phrases its rule around the QUESTION A SURFACE ASKS, and this asks
 * the wide one: "what is in this catalogue", so it shows every kind and hides
 * no People. The narrow question -- "what can I watch" -- is `/works`, a
 * surface of its own rather than this one with a filter bolted to it, and the
 * header offers both so a reader chooses the question rather than inheriting
 * one.
 *
 * The router is called IN-PROCESS, as the item page calls it. A server
 * component fetching its own API is a round trip to itself, and oRPC documents
 * `call` as the way to avoid it.
 */
async function readFrontPage(after: string | undefined) {
  /*
   * PRERENDERING STOPS HERE, and this line is the whole difference between a
   * front page and a photograph of one.
   *
   * This page reads a database, and when the line was added it touched no
   * request-time API at all -- no cookies, no headers, no `searchParams` -- so
   * Next prerendered it at BUILD time and served that HTML to every reader
   * forever. IT READS `searchParams` NOW, for the cursor (ADR-0119), so it is
   * dynamic by that as well; the line stays anyway, for the reason at the foot
   * of this comment. Next documents `connection()` for exactly this shape: "a
   * component doesn't use Request-time APIs ... but still needs to produce
   * different output per request".
   *
   * FOUND BY THE SUITE RATHER THAN BY READING. The fresh-install server and the
   * seeded one served byte-identical pages, because both were serving the
   * catalogue as it stood in the database the BUILD happened to point at. On a
   * self-hosted instance that is a front page frozen at the moment somebody
   * built the image, which no import would ever change.
   *
   * WHY IT STAYS, now that `searchParams` makes it redundant by ADR-0117's
   * letter: the declaration is the rule, and being dynamic is the effect.
   * `?after=` is here to walk the catalogue rather than to promise this page
   * renders per request, and the day paging changes shape the page would go
   * back to being a photograph of itself with nothing in the diff to say so.
   */
  await connection();
  // ONE CONTEXT FOR BOTH, rather than one each. It opens no connection of its
  // own -- the pool is memoised and the allowlist parsed at module load -- but
  // two calls to it would be two answers to "what does this request carry",
  // which is the thing a context exists to make one.
  const context = await createContext();
  const [catalogue, providers] = await Promise.all([
    call(appRouter.catalogue.list, { after }, { context }),
    call(appRouter.provider.allowlisted, undefined, { context }),
  ]);
  return { catalogue, providers };
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string | string[] }>;
}) {
  // ADR-0119's cursor, read on the SERVER so the page a reader is served
  // is already the page they asked for. `cursorFrom` owns what a repeated
  // parameter means, so both reading surfaces answer that the same way.
  const { after } = await searchParams;
  const from = cursorFrom(after);
  const { catalogue, providers } = await readFrontPage(from);
  // ONE NAME FOR ONE FACT. It was three reads of `catalogue.total` in three
  // shapes -- `> 0`, `=== 0`, and a comparison inside `Holding` -- which is one
  // condition spelt three ways with two of them inverted.
  const empty = catalogue.total === 0;
  const listing = catalogue.entries;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-3xl font-medium">Catalogue</h1>
        {listing.length > 0 && <Holding showing={listing.length} total={catalogue.total} />}
      </div>
      {!providers.any && <NoProviderAllowlisted />}
      {empty && <WhatToDoNext />}
      {/*
        A CATALOGUE WITH ITEMS IN IT AND NOTHING ON THIS PAGE, which is what a
        cursor makes possible: the link was cut at an item, and nothing is after
        that item any more. It is rare and it is a DEAD END if nothing says so.
      */}
      {!empty && listing.length === 0 && <PastTheEnd path="/" />}
      {listing.length > 0 && (
        <>
          <Listing entries={listing} />
          <Walk path="/" from={from} continuesAfter={catalogue.continuesAfter} />
        </>
      )}
    </main>
  );
}

/**
 * WHY AN EMPTY CATALOGUE IS EMPTY, when the reason is configuration.
 *
 * ADR-0034 makes `PROVIDER_ALLOWLIST` empty by default and the empty value
 * refuses every provider. That is the safe end of the failure and it is also
 * completely silent: with nothing allowlisted, an instance nobody has
 * configured and an instance that is broken look identical from here. Two
 * shards of the competitor sweep rated exactly this first run HIGH.
 *
 * IT STANDS WHETHER OR NOT THE CATALOGUE IS EMPTY, because an owner with items
 * already and no allowlist is just as stuck: nothing more can be imported. The
 * condition is read off `providers.any` alone and never off the catalogue's
 * size, which is what makes that true by construction rather than by care.
 *
 * ONLY ONE OF THE TWO COMBINATIONS IS EXERCISED, and saying so is cheaper than
 * letting a reader assume both are. The suite has an instance with an empty
 * catalogue AND an empty allowlist, and one with neither; items-present-with-no-
 * allowlist would need a third server, and the page's condition cannot see the
 * catalogue to get it wrong.
 *
 * THE VARIABLE IS NAMED. "Allowlist a provider" is the step; `PROVIDER_ALLOWLIST`
 * is the thing an owner has to type, and a page that gestured at the step
 * without naming it would leave them exactly where the README left them.
 */
function NoProviderAllowlisted() {
  return (
    <section aria-labelledby="no-provider" className="mt-6">
      <Card>
        <CardHeader>
          {/*
            A REAL HEADING INSIDE THE PRIMITIVE. `CardTitle` and `EmptyTitle`
            both render a `div`, so a section labelled by one is labelled by
            something that is not a heading -- and a reader navigating this page
            by heading finds only the `h1`. The id goes on the `h2` so
            `aria-labelledby` points at the heading itself.
          */}
          <CardTitle>
            <h2 id="no-provider">No provider is allowlisted</h2>
          </CardTitle>
          <CardDescription>
            CanonCore reaches a provider only when its host or address range is named in
            PROVIDER_ALLOWLIST. That setting is empty until you write one, and empty refuses every
            provider, so nothing can be imported yet. An empty result here is this setting rather
            than a fault.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}

/**
 * WHAT TO DO WITH AN EMPTY CATALOGUE.
 *
 * ADR-0094 ships no catalogue to a stranger, and is explicit that this is only
 * half of the decision: "an install that starts empty WITHOUT SAYING WHAT TO DO
 * NEXT is a separate failure this record does not licence". This is the other
 * half, and it is deliberately WORDS ON A PAGE rather than rows in a database --
 * nothing here softens the refusal to ship somebody else's library.
 */
function WhatToDoNext() {
  return (
    <section aria-labelledby="what-to-do-next" className="mt-6">
      <Empty className="border">
        <EmptyHeader>
          {/* A real heading, for the reason `NoProviderAllowlisted` gives. */}
          <EmptyTitle>
            <h2 id="what-to-do-next">Your catalogue is empty</h2>
          </EmptyTitle>
          <EmptyDescription>
            It starts that way on purpose: CanonCore ships no catalogue, so nothing here is anybody
            else&rsquo;s library. Two steps fill it.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ol className="space-y-3 text-left">
            <li>
              <span className="font-medium">Name a provider, and allowlist it.</span> Put its base
              URL in PROVIDER_URLS and the host or address range it answers on in
              PROVIDER_ALLOWLIST, then restart. Both: one says which providers to search and the
              other says what may be reached. A provider is a URL rather than code you install, so
              nothing runs inside your catalogue.
            </li>
            <li>
              {/*
                THE STEP IS A LINK NOW (CNCORE-68). This used to say to give a
                provider's base URL and the id of one of its records, which is the
                hand-POSTing the import surface exists to remove -- so the copy and
                the product agreed only for as long as there was no surface. A
                record can be found by NAME, and the page that does it is one click
                from here rather than an address to know.
              */}
              <span className="font-medium">
                <Link className="underline" href="/import">
                  Import from it
                </Link>
                .
              </span>{" "}
              Search it by name and take what you find: the record arrives here as an Item. A
              provider that offers browse imports a whole ordering at once.
            </li>
          </ol>
        </EmptyContent>
      </Empty>
    </section>
  );
}
