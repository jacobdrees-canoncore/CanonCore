import { createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { Button } from "@canoncore/ui/components/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@canoncore/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@canoncore/ui/components/empty";
import { Input } from "@canoncore/ui/components/input";
import { call } from "@orpc/server";
import Form from "next/form";
import Link from "next/link";

import { importRecord } from "./actions";

/**
 * FINDING SOMETHING IN A PROVIDER AND IMPORTING IT, in one motion.
 *
 * Until this page, filling a catalogue meant hand-POSTing RPC with an id
 * obtained from outside the product. `search` is what removes that (ADR-0033),
 * and ADR-0033's own as-built section records that the client omitted the
 * operation deliberately because nothing yet searched -- "it arrives with the
 * surface that searches". This is that surface.
 *
 * NOT CATALOGUE SEARCH, which `CONTEXT.md` defines as the surface that searches
 * the OWNER'S OWN catalogue and explicitly distinguishes from the CMPP operation
 * of the same name. That one is CNCORE-66 and lives at its own address. This page
 * searches PROVIDERS, so the word on it is Import rather than Search.
 */
async function readImportPage(query: string | undefined) {
  /*
   * NO `connection()` HERE, AND THAT IS ADR-0117 OBEYED RATHER THAN SKIPPED.
   * That record's rule is that a read surface declares it needs a request, and
   * names the two ways of declaring it: `connection()`, OR "a request-time API
   * the page was going to touch anyway". This page reads `searchParams` for the
   * query it is asked to run -- the query IS the page -- so it is dynamic by the
   * thing it exists to do rather than by a parameter that happens to be there.
   * That is the `/items/<id>` case the record names, not the front page's.
   *
   * AND THE CHECK IS STILL OWED AND STILL TAKEN. ADR-0117: "a new read surface
   * earns that pair, not merely the `connection()` line" -- two instances of one
   * build, pointed at different configuration, asked for the same path, expected
   * to differ. `import-page.test.ts` asks the seeded instance and the fresh one
   * for `/import` and they answer differently, which is the only arrangement in
   * this repo that can see a build-time artefact at all.
   */
  const context = await createContext();
  // ONE CONTEXT FOR ALL OF THEM, for the reason the front page gives: two calls
  // to it would be two answers to "what does this request carry".
  const [allowlisted, configured, found] = await Promise.all([
    call(appRouter.provider.allowlisted, undefined, { context }),
    call(appRouter.provider.configured, undefined, { context }),
    query === undefined
      ? Promise.resolve(undefined)
      : call(appRouter.provider.search, { query }, { context }),
  ]);
  return { allowlisted, configured, found };
}

type ImportPage = Awaited<ReturnType<typeof readImportPage>>;
type Found = NonNullable<ImportPage["found"]>;

/**
 * One value of a repeated query parameter is no value.
 *
 * The rule `/items/<id>` applies to `via` and `placed` (ADR-0066) and `/` applies
 * to `after` (ADR-0119): a page asks one question, so a repeated parameter names
 * no question rather than the first of several. A third surface answering it
 * differently would be three conventions for one thing.
 */
function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const query = one((await searchParams).q);
  const { allowlisted, configured, found } = await readImportPage(query);

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-medium">Import</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Search the providers this instance is configured to reach, and take what you find into your
        catalogue.
      </p>
      {!allowlisted.any && <NoProviderAllowlisted />}
      {configured.providers.length === 0 && <NoProviderConfigured />}
      <SearchBox query={query} />
      {found !== undefined && <Results found={found} query={query ?? ""} />}
    </main>
  );
}

/**
 * THE QUERY GOES IN THE URL, which is what makes a search a place rather than a
 * state.
 *
 * `Form` RATHER THAN `form`, AND THAT IS ADR-0109's RULE rather than a
 * preference: Next prefixes `<Link>`, `<Form>` and `router.push()` and nothing
 * else, so a raw `<form action="/import">` here would read identically and would
 * point at the wrong place the day this app is served from a path. A string
 * `action` makes this a GET whose fields become search params, which is exactly
 * what a search is.
 */
function SearchBox({ query }: { query?: string }) {
  return (
    <Form action="/import" className="mt-6 flex items-center gap-2">
      <Input
        // `defaultValue` rather than `value`: this is server-rendered markup with
        // no script behind it, so a `value` with no `onChange` would be a field a
        // reader cannot type in at all once React hydrates.
        defaultValue={query}
        name="q"
        type="search"
        placeholder="A title to look for"
        aria-label="A title to look for"
      />
      <Button type="submit">Search</Button>
    </Form>
  );
}

/**
 * WHAT EVERY PROVIDER SAID, AND WHICH OF THEM DID NOT SAY IT.
 *
 * Every provider that answered is listed even when it matched NOTHING, which is
 * the difference between "both providers were searched" being true and being
 * visible. A provider omitted for having no results is one an owner cannot tell
 * from a provider that was never asked.
 */
function Results({ found, query }: { found: Found; query: string }) {
  const matched = found.answered.reduce((total, { results }) => total + results.length, 0);

  return (
    <section aria-labelledby="results" className="mt-8">
      <h2 id="results" className="font-medium text-sm">
        {matched === 0 ? `Nothing matched ${query}` : `${matched} found for ${query}`}
      </h2>
      {found.answered.map(({ provider, results }) => (
        <div key={provider.baseUrl} className="mt-4">
          <h3 className="text-muted-foreground text-sm">
            {/*
              THE PROVIDER'S OWN NAME FOR ITSELF, off its manifest. A source
              answers "who said this", and `http://127.0.0.1:39481` shows an
              owner a deployment detail where `provider-wiki` answers it.
            */}
            {provider.name}
            {results.length === 0 && " matched nothing"}
          </h3>
          {results.length > 0 && (
            <ul className="mt-2 divide-y">
              {results.map((result) => (
                <li key={result.recordId} className="py-3">
                  <Candidate baseUrl={provider.baseUrl} result={result} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {found.failed.length > 0 && <Unreachable failed={found.failed} />}
    </section>
  );
}

/** One candidate: what the provider claims about it, and what to do with it. */
function Candidate({
  baseUrl,
  result,
}: {
  baseUrl: string;
  result: Found["answered"][number]["results"][number];
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span>{result.title}</span>
        {/*
          THE PROVIDER'S OWN WORD for what this is -- `TV story`, `audio story`,
          `movie` -- and not one of the catalogue's seven item kinds. An owner
          choosing between two answers for one title is choosing on exactly this,
          which is why ADR-0033 carries the field at all.
        */}
        <span className="text-muted-foreground text-sm">{result.kind}</span>
        {result.released.length > 0 && (
          <span className="text-muted-foreground text-sm">{result.released.join(", ")}</span>
        )}
        {/*
          THE RECORD'S OWN PAGE AT THE PROVIDER, so an ambiguous candidate can be
          told from its namesakes by looking rather than by guessing -- which is
          the ambiguity ADR-0033 says search has forever.

          A RAW `a` ON PURPOSE, AND IT IS NOT THE CLASS ADR-0109 NAMES. That rule
          is about URLS THIS APP OWNS: a path Next would rewrite under a
          `basePath` and which must therefore go through `Link`. This is a third
          party's absolute URL, and prefixing it would be the bug rather than the
          fix.

          ITS SCHEME IS THE CONTRACT'S TO GUARANTEE, NOT THIS LINE'S. `z.url()`
          alone admits `javascript:`, `data:`, `vbscript:` and `file:` -- measured
          on zod 4.5.4 -- so CNCORE-79 pinned `record.url` to http or https in
          `packages/contract` AND in this app's own reading of CMPP. This `href`
          is the sink that made that worth doing.

          `noreferrer` BECAUSE THE DESTINATION IS A THIRD PARTY'S. A provider runs
          on an address the owner chose, and the path of a page in their own
          catalogue is not something to hand to whoever the record points at.
        */}
        <a
          className="text-muted-foreground text-sm hover:underline"
          href={result.url}
          rel="noreferrer"
        >
          At the provider
        </a>
      </span>
      <span className="flex items-baseline gap-3">
        {result.itemId !== null && <Held itemId={result.itemId} />}
        <Take baseUrl={baseUrl} held={result.itemId !== null} recordId={result.recordId} />
      </span>
    </div>
  );
}

/**
 * THE BUTTON THAT TAKES A CANDIDATE, which is the whole point of the page.
 *
 * A PLAIN `form` RATHER THAN `Form`, and the difference is which of the two Next
 * rewrites. `next/form` is for a form whose fields become SEARCH PARAMS -- a GET,
 * a navigation -- and the search box above is one. This is a POST bound to a
 * Server Action, so Next writes the `action` attribute itself and there is no URL
 * here for anything to get wrong; `Form` with a function action would render the
 * same POST and add a prefetch of a page this never navigates to.
 *
 * THE PROVIDER AND THE RECORD TRAVEL AS HIDDEN FIELDS, which means they travel as
 * input and are parsed as input on the way back in (see `actions.ts`). `baseUrl`
 * then meets ADR-0034's config boundary exactly as it does when an owner POSTs
 * the RPC by hand, so the page is not a way round the allowlist.
 */
function Take({ baseUrl, held, recordId }: { baseUrl: string; held: boolean; recordId: string }) {
  return (
    <form action={importRecord}>
      <input type="hidden" name="baseUrl" value={baseUrl} />
      <input type="hidden" name="recordId" value={recordId} />
      <Button type="submit" variant="secondary">
        {/*
          OFFERED FOR A CANDIDATE ALREADY HELD AS WELL, because a second import is
          a REFRESH rather than a second item: `importProvidedRecord` finds the
          item the first import wrote, by the id the provider knows the record by
          (migration 3), and takes the provider's values again. A source revises a
          title and this is how an owner takes the revision.
          
          WHICH ALSO MAKES "re-importing changes nothing" A FACT ABOUT THE PAGE
          rather than about the RPC alone. With no button there would be nothing on
          this surface to press twice, and the criterion could only be asserted a
          layer down from the thing that has to satisfy it.
        */}
        {held ? "Import again" : "Import"}
      </Button>
    </form>
  );
}

/**
 * A CANDIDATE THIS CATALOGUE ALREADY HOLDS, and the way to the Item.
 *
 * IT IS THE ANSWER TO THE QUESTION AN OWNER HAS -- do I already have this -- and
 * it is also how an import reports itself: the row that offered a button before
 * the POST names its Item after it. That is why `provider.search` answers
 * `itemId` at all, since the alternative is a redirect to the new Item and Next
 * does not give `redirect()` the `basePath` (ADR-0109).
 *
 * `Link` RATHER THAN `a`, which is that same rule from the other side: this path
 * IS one this app owns, so it is one the framework has to be allowed to rewrite.
 */
function Held({ itemId }: { itemId: string }) {
  return (
    <Link className="text-sm hover:underline" href={`/items/${itemId}`}>
      In your catalogue
    </Link>
  );
}

/**
 * WHO WAS ASKED AND DID NOT ANSWER, and why.
 *
 * A provider that is down and a provider that matched nothing are different
 * answers, and an owner who cannot tell them apart concludes their query was
 * wrong when their source was merely offline. Named by URL because that is what
 * the owner typed and the only thing they can act on -- reading the provider's
 * own name for itself is one of the things that failed.
 */
function Unreachable({ failed }: { failed: Found["failed"] }) {
  return (
    <div className="mt-6">
      <h3 className="text-muted-foreground text-sm">Could not be reached</h3>
      <ul className="mt-2 divide-y">
        {failed.map(({ baseUrl, reason }) => (
          <li key={baseUrl} className="py-2 text-sm">
            <span className="font-medium">{baseUrl}</span> <span>{reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * WHY NOTHING CAN BE IMPORTED, when the reason is the allowlist.
 *
 * The front page says this too, and it says it for the whole instance; here it is
 * the reason this page in particular cannot work. ADR-0034 makes
 * `PROVIDER_ALLOWLIST` empty by default and the empty value refuses every
 * provider -- so without this, an owner meets a search that returns a refusal per
 * provider and no way to tell a wrong URL from an instance nobody configured.
 */
function NoProviderAllowlisted() {
  return (
    <section aria-labelledby="no-provider" className="mt-6">
      <Card>
        <CardHeader>
          {/* A real heading inside the primitive: `CardTitle` renders a `div`, so
              a section labelled by one is labelled by something that is not a
              heading and a reader navigating by heading finds only the `h1`. */}
          <CardTitle>
            <h2 id="no-provider">No provider is allowlisted</h2>
          </CardTitle>
          <CardDescription>
            CanonCore reaches a provider only when its host or address range is named in
            PROVIDER_ALLOWLIST. That setting is empty until you write one, and empty refuses every
            provider, so nothing here can be searched or imported yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}

/**
 * AND WHY NOTHING CAN BE IMPORTED WHEN THE REASON IS THE OTHER SETTING.
 *
 * TWO NOTICES RATHER THAN ONE, because there are two settings with two remedies
 * and an owner has to know which to go and set. The allowlist says what MAY be
 * reached; `PROVIDER_URLS` says which providers there ARE. An instance with a
 * generous allowlist and no provider named searches nothing at all, and ADR-0094
 * is explicit that an install which starts empty without saying what to do next
 * is a failure of its own.
 */
function NoProviderConfigured() {
  return (
    <section aria-labelledby="no-provider-configured" className="mt-6">
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>
            <h2 id="no-provider-configured">No provider is configured</h2>
          </EmptyTitle>
          <EmptyDescription>
            Name the providers to search in PROVIDER_URLS, as their base URLs, then restart. A
            provider is a URL answering the CMPP contract rather than code you install, so nothing
            you name here runs inside your catalogue.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}
