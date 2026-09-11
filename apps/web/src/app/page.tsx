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
import Link from "next/link";
import { connection } from "next/server";

/**
 * THE CATALOGUE, which is what opening CanonCore ought to tell you.
 *
 * ADR-0077 phrases its rule around the QUESTION A SURFACE ASKS, and this asks
 * the wide one: "what is in this catalogue", so it shows every kind and hides
 * no People. The narrow question -- "what can I watch" -- is a surface of its
 * own (CNCORE-67) rather than this one with a filter bolted to it.
 *
 * The router is called IN-PROCESS, as the item page calls it. A server
 * component fetching its own API is a round trip to itself, and oRPC documents
 * `call` as the way to avoid it.
 */
async function readFrontPage() {
  /*
   * PRERENDERING STOPS HERE, and this line is the whole difference between a
   * front page and a photograph of one.
   *
   * This page reads a database and touches no request-time API -- no cookies,
   * no headers, no `searchParams` -- so Next prerendered it at BUILD time and
   * served that HTML to every reader forever. The item page is dynamic by
   * accident of reading `searchParams`; this one has nothing to read, so it
   * says so instead. Next documents `connection()` for exactly this shape: "a
   * component doesn't use Request-time APIs ... but still needs to produce
   * different output per request".
   *
   * FOUND BY THE SUITE RATHER THAN BY READING. The fresh-install server and the
   * seeded one served byte-identical pages, because both were serving the
   * catalogue as it stood in the database the BUILD happened to point at. On a
   * self-hosted instance that is a front page frozen at the moment somebody
   * built the image, which no import would ever change.
   */
  await connection();
  // ONE CONTEXT FOR BOTH, rather than one each. It opens no connection of its
  // own -- the pool is memoised and the allowlist parsed at module load -- but
  // two calls to it would be two answers to "what does this request carry",
  // which is the thing a context exists to make one.
  const context = await createContext();
  const [catalogue, providers] = await Promise.all([
    call(appRouter.catalogue.list, {}, { context }),
    call(appRouter.provider.allowlisted, undefined, { context }),
  ]);
  return { catalogue, providers };
}

type FrontPage = Awaited<ReturnType<typeof readFrontPage>>;

export default async function CataloguePage() {
  const { catalogue, providers } = await readFrontPage();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-3xl font-medium">Catalogue</h1>
        {catalogue.total > 0 && <Holding catalogue={catalogue} />}
      </div>
      {!providers.any && <NoProviderAllowlisted />}
      {catalogue.total === 0 ? <WhatToDoNext /> : <Listing entries={catalogue.entries} />}
    </main>
  );
}

/**
 * How much of the catalogue this page is showing, and how much there is.
 *
 * THE CAP IS NEVER SILENT. A listing capped at a page and reported as the whole
 * catalogue tells an owner their library is smaller than it is, which is the
 * one lie a catalogue must not tell about itself.
 */
function Holding({ catalogue }: { catalogue: FrontPage["catalogue"] }) {
  const showing = catalogue.entries.length;
  return (
    <p className="text-muted-foreground text-sm">
      {showing < catalogue.total
        ? `Showing ${showing} of ${catalogue.total} items`
        : `${catalogue.total} ${catalogue.total === 1 ? "item" : "items"}`}
    </p>
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
 * IT STANDS WHETHER OR NOT THE CATALOGUE IS EMPTY. An owner with items already
 * and no allowlist is just as stuck -- nothing more can be imported -- and one
 * condition read off one fact is a page that says a true thing whenever it is
 * true, rather than two conditions that have to be kept in step.
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
          <CardTitle id="no-provider">No provider is allowlisted</CardTitle>
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
          <EmptyTitle id="what-to-do-next">Your catalogue is empty</EmptyTitle>
          <EmptyDescription>
            It starts that way on purpose: CanonCore ships no catalogue, so nothing here is anybody
            else&rsquo;s library. Two steps fill it.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ol className="space-y-3 text-left">
            <li>
              <span className="font-medium">Allowlist a provider.</span> Put the host or address
              range it answers on in PROVIDER_ALLOWLIST, then restart. A provider is a URL rather
              than code you install, so nothing runs inside your catalogue.
            </li>
            <li>
              <span className="font-medium">Import from it.</span> Give the provider&rsquo;s base
              URL and the id of one of its records, and the record arrives here as an Item. A
              provider that offers browse imports a whole ordering at once.
            </li>
          </ol>
        </EmptyContent>
      </Empty>
    </section>
  );
}

/**
 * Every item, in the order the catalogue keeps them: `sort_name` where a source
 * has claimed one, and the title otherwise (ADR-0014).
 */
function Listing({ entries }: { entries: FrontPage["catalogue"]["entries"] }) {
  return (
    <ul className="mt-6 divide-y">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-baseline justify-between gap-4 py-2">
          {/*
            A PLAIN LINK, carrying no `?via=`. ADR-0066 makes the query the
            ROUTE a reader arrived through, and the front page is not an
            ordering -- nobody arrives at an item "through the catalogue" in the
            sense a placement means. So the address here is the bare canonical
            one, which is the same address the item is reached at from anywhere
            else.

            AND IT IS A `Link` RATHER THAN AN `a`, WHICH IS A SEPARATE RULE
            (ADR-0109): a URL the framework does not rewrite is never
            hand-built. Next prefixes `Link`, `Form` and `router.push()` and
            nothing else, so a raw `<a href="/items/...">` here would read
            identically and would point at the wrong place the day this app is
            served from a path. This page emits exactly one URL and it goes
            through the one thing that would be rewritten -- worth saying out
            loud because this is the shell the other reading surfaces hang off,
            and a raw `a`, an `img src` or a `fetch("/api/...")` copied from
            here would scatter the class the rule exists to keep in one place.
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
