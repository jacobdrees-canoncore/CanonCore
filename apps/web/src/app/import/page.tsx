import { type Context, createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import type { FailureReason } from "@canoncore/providers";
import { Button } from "@canoncore/ui/components/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@canoncore/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@canoncore/ui/components/empty";
import { Input } from "@canoncore/ui/components/input";
import { call } from "@orpc/server";
import Form from "next/form";
import Link from "next/link";

import { oneValue } from "@/components/query-params";

import { browseOrdering, importRecord, purgeProvider } from "./actions";

/** Which container the owner has asked about, and at which provider. */
interface Asked {
  query?: string;
  provider?: string;
  container?: string;
  purge?: string;
}

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
async function readImportPage({ query, provider, container, purge }: Asked) {
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
  //
  // AND THE CONFIGURATION IS READ FIRST, because what may be asked of a provider
  // depends on whether it is one this instance searches. Neither of these two
  // makes a request or touches the database -- both read what `createContext`
  // parsed at module load -- so the ordering costs nothing and buys the narrowing
  // below.
  const [allowlisted, configured] = await Promise.all([
    call(appRouter.provider.allowlisted, undefined, { context }),
    call(appRouter.provider.configured, undefined, { context }),
  ]);
  const searchable = searchableProvider(configured.providers, provider);
  const purging = purgeableProvider(configured.providers, purge);

  const [found, namedContainer, preview] = await Promise.all([
    query === undefined
      ? Promise.resolve(undefined)
      : call(appRouter.provider.search, { query }, { context }),
    searchable === undefined || container === undefined
      ? Promise.resolve(undefined)
      : aboutTheContainer(context, searchable, container),
    /*
     * WHAT A PURGE WOULD TAKE, AND ONLY WHEN ONE IS ASKED ABOUT.
     *
     * ADR-0046: the preview IS the purge, run in a transaction it then rolls
     * back, so it costs the work and the write locks of a real delete. That is
     * the price of a preview that cannot contradict the delete an owner acted on
     * it to authorise -- and it is why exactly one provider is previewed rather
     * than every configured one. A page that priced every row it offered a button
     * for would lock the catalogue against itself on every render, for numbers
     * nobody had asked to see.
     *
     * IT IS A READ ASKED ON THE GET, which is the same seam `aboutTheContainer`
     * moved to under CNCORE-92 and for a related reason. That one had to move
     * because a POST cannot report a provider's refusal; this one was on the GET
     * already, because the counts ARE the page. What the two share is the rule:
     * a button is offered only once the thing behind it has answered.
     */
    purging === undefined
      ? Promise.resolve(undefined)
      : call(appRouter.provider.previewPurge, { baseUrl: purging }, { context }),
  ]);
  return { allowlisted, configured, found, namedContainer, preview, purging };
}

/**
 * THE TWO QUESTIONS THIS PAGE HAS ABOUT THE CONTAINER THE OWNER NAMED, and they
 * are two because they are asked of two different parties.
 *
 * WHETHER THE CATALOGUE ALREADY HOLDS IT is `held`'s. The owner typed this id,
 * so -- unlike a candidate, which arrives from a search that answered the same
 * question -- there is nothing else on the page that knows. It is also the only
 * way this surface can report a browse: an action's return value reaches a page
 * through `useActionState` alone, which is a client hook with nothing to give
 * when no script has loaded, and a redirect to the new container would emit a
 * URL Next does not rewrite (ADR-0109). So the page reads the catalogue and says
 * what it finds.
 *
 * WHAT THE PROVIDER SAYS ABOUT IT is the other, and `held` cannot reach it: an
 * id the catalogue has never seen is either a container waiting to be imported
 * or nothing at all, and only the provider knows which. ASKED ON THE GET, WHICH
 * IS WHERE A READ BELONGS -- `provider.browse` declares its three refusals so
 * that each is an answer (ADR-0033), and the POST is the one place none of them
 * can be read: a Server Action that throws during a form submission with no
 * script answers a bare `Internal Server Error`, and Next redacts a server
 * error's message before any boundary could carry it. So the provider is asked
 * before the button is offered.
 *
 * THEY TRAVEL AS ONE VALUE because they are answered together or not at all:
 * both need a provider this instance searches AND an id to ask about.
 */
async function aboutTheContainer(context: Context, baseUrl: string, containerId: string) {
  const [held, said] = await Promise.all([
    call(appRouter.provider.held, { baseUrl, recordIds: [containerId] }, { context }),
    call(appRouter.provider.container, { baseUrl, containerId }, { context }),
  ]);
  return { baseUrl, containerId, itemId: held.items[0]?.itemId ?? null, said };
}

/**
 * The provider a URL named, ONLY IF IT IS ONE THIS INSTANCE SEARCHES.
 *
 * A QUERY PARAMETER IS NOT A CONFIG URL, and the distinction is `CONTEXT.md`'s:
 * a Config URL is "a URL the owner typed into settings", which is what makes
 * ADR-0034 check it against an allowlist rather than against the content deny
 * rule. A value arriving in a link somebody followed has none of that standing,
 * and it reaches `provider.browse` -- which fetches it. The allowlist still
 * stands in front of that, so this is not the only thing between a crafted URL
 * and a request; it is the thing that makes the URL bar no wider a door than the
 * form, which offers a `select` for exactly this reason.
 *
 * IT ALSO TURNS A MALFORMED ONE INTO AN ANSWER RATHER THAN A 500. `?provider=x`
 * would otherwise reach `provider.held`'s `z.url()` and throw, where
 * `/items/<id>` turns a URL-supplied id it cannot use into a `notFound()`
 * (CNCORE-14, ADR-0066). Nothing that arrives in an address should be able to
 * crash the page it addresses.
 */
function searchableProvider(configured: string[], named: string | undefined): string | undefined {
  return named !== undefined && configured.includes(named) ? named : undefined;
}

/**
 * The provider a URL named for purging, ONLY IF THIS INSTANCE IS CONFIGURED WITH
 * IT.
 *
 * NOT FOR `searchableProvider`'s REASON, and saying so matters because the two
 * functions look identical and are not. That one narrows because the value
 * reaches `provider.browse`, WHICH FETCHES, and a query parameter has none of a
 * Config URL's standing. NOTHING HERE MAKES A REQUEST: `purge` and
 * `previewPurge` both treat `baseUrl` as an IDENTITY -- the rows are this
 * catalogue's -- and ADR-0034's boundary stands in front of requests, so it has
 * nothing to say about either. A provider whose licence has just ended is
 * precisely the one nothing should be calling, and it is the one an owner most
 * needs to purge.
 *
 * THE REASON IS THAT THIS SURFACE CAN ONLY OFFER WHAT IT CAN LIST. The providers
 * are `PROVIDER_URLS`, and a purge target outside that set has no row on the page
 * to sit in and no name an owner could have pressed. The bound that follows is
 * real and worth knowing: a provider REMOVED from `PROVIDER_URLS` cannot be
 * purged until it is named again. Naming it again is how, and ADR-0046 records
 * this as the half that is built.
 *
 * IT ALSO TURNS A MALFORMED URL INTO AN ANSWER RATHER THAN A 500, which is the
 * rule `/items/<id>` already applies to an id it cannot use (CNCORE-14): `?purge=x`
 * would otherwise reach `previewPurge`'s `z.url()` and throw. Nothing that
 * arrives in an address should be able to crash the page it addresses.
 */
function purgeableProvider(configured: string[], named: string | undefined): string | undefined {
  return named !== undefined && configured.includes(named) ? named : undefined;
}

type ImportPage = Awaited<ReturnType<typeof readImportPage>>;
type Found = NonNullable<ImportPage["found"]>;
/** The container the owner named: what the catalogue holds, and what the provider says. */
type NamedContainer = NonNullable<ImportPage["namedContainer"]>;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    provider?: string | string[];
    container?: string | string[];
    purge?: string | string[];
  }>;
}) {
  const asked = await searchParams;
  const query = oneValue(asked.q);
  const provider = oneValue(asked.provider);
  const container = oneValue(asked.container);
  const { allowlisted, configured, found, namedContainer, preview, purging } = await readImportPage(
    {
      query,
      provider,
      container,
      purge: oneValue(asked.purge),
    },
  );

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
      {found !== undefined && query !== undefined && <Results found={found} query={query} />}
      <BrowseBox configured={configured.providers} container={container} provider={provider} />
      {container !== undefined &&
        (namedContainer === undefined ? <NotOneOfOurs /> : <Container {...namedContainer} />)}
      <PurgeBox configured={configured.providers} />
      {purging !== undefined && preview !== undefined && (
        <Purge baseUrl={purging} preview={preview} />
      )}
    </main>
  );
}

/**
 * EVERY PROVIDER THIS INSTANCE IS CONFIGURED WITH, and the way to undo one.
 *
 * WHY THE SURFACE EXISTS AT ALL: an import with no un-import leaves a mistaken
 * import unrecoverable through the product, and the owner who most needs this is
 * the one who cannot inspect the provider any more because its licence ended.
 *
 * EVERY CONFIGURED PROVIDER AND NOT ONLY THE ONES WITH SOMETHING TO TAKE. Which
 * of them contributed anything is precisely what the preview answers, and an
 * owner who is not sure whether they ever imported from one is exactly the owner
 * asking. Listing only providers with rows would need a preview per provider to
 * decide the list, which is a purge traversal each, on every render of this page.
 *
 * A FORM RATHER THAN A LINK, WHICH IS NOT A STYLE CHOICE. Next prefetches a
 * `<Link>`'s own address when it enters the viewport, and the address of a
 * preview RUNS THE PURGE TRAVERSAL -- it takes the write locks of a real delete
 * and rolls them back (ADR-0046). A link here would spend that on every provider
 * in this list, for numbers nobody asked to see, because a reader scrolled past.
 * A string-action `<Form>` prefetches its ACTION PATH instead -- its fields are
 * not known until submission -- which here is `/import` naming no provider and
 * previewing nothing (Next's `<Form>` reference, read 2026-09-12).
 *
 * NAMED BY URL, which is a deployment detail shown to the one person entitled to
 * it, for the reason `BrowseBox` gives: the owner typed these into
 * `PROVIDER_URLS` and is the only person who can change one. It is also the only
 * name a purge can use -- reading a provider's own name for itself means asking
 * it, and the provider an owner is purging is frequently the one that no longer
 * answers.
 *
 * AND IT IS OFFERED FOR AN UNREACHABLE PROVIDER TOO, which looks like a breach of
 * the rule the browse half of this page follows and is not. That rule (CNCORE-92)
 * is that a button appears only where the operation behind it would work, so a
 * provider that cannot be reached gets a sentence instead of a control. A PURGE
 * MAKES NO REQUEST: it is rows in this catalogue, found by the identity on the
 * source row, so none of the refusals `browse` can meet exists here and the
 * operation works against a provider that has not answered in months. Which is
 * ADR-0036's case exactly -- a licence ends, the provider goes away, and the
 * obligation to purge does not. Removing this button to match the one above would
 * take the surface away from the owner it was built for.
 */
function PurgeBox({ configured }: { configured: string[] }) {
  if (configured.length === 0) return null;

  return (
    <section aria-labelledby="providers" className="mt-10">
      <h2 className="font-medium text-sm" id="providers">
        Purge a provider&apos;s contributions
      </h2>
      <p className="mt-1 text-muted-foreground text-sm">
        You are shown what a purge would remove before anything is removed.
      </p>
      <ul className="mt-3 divide-y">
        {configured.map((baseUrl) => (
          <li
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-3"
            key={baseUrl}
          >
            <span className="text-sm">{baseUrl}</span>
            <Form action="/import">
              <input type="hidden" name="purge" value={baseUrl} />
              {/*
                IT SAYS WHAT PRESSING IT DOES, WHICH IS SHOW RATHER THAN REMOVE.
                This button was "Remove everything", and that is mislabelled in
                the one direction that matters: it promises a destruction it does
                not perform, so an owner either presses it expecting to be asked
                (and is, which teaches them the label lies) or does not press it
                at all for fear of what it claims. The button that removes is the
                one at the end of the confirmation, and it is the only one on this
                surface that says Purge.
              */}
              <Button type="submit" variant="outline">
                See what would go
              </Button>
            </Form>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * WHAT A PURGE WOULD TAKE, IN FRONT OF THE PURGE (ADR-0046).
 *
 * A purge is the delete where a preview matters most. It is the one an owner
 * runs under time pressure, after a termination notice, against a provider whose
 * content they can no longer inspect -- so these counts are the only description
 * of it they are going to get.
 */
function Purge({ baseUrl, preview }: { baseUrl: string; preview: PurgePreview }) {
  /*
   * A PURGE THAT WOULD CHANGE NOTHING GETS NO CONFIRMATION, which is a criterion
   * rather than a nicety. A dialogue offering to permanently delete "0
   * statements, 0 placements, 0 items" teaches an owner that this button is
   * harmless, and the next one they meet is the one that is not. It is also the
   * ordinary answer to a reasonable question -- an owner who is not sure whether
   * they ever imported from a provider -- and an answer is what it should read as.
   *
   * `keptItems` IS IN THE TEST, and leaving it out is the way to get this wrong.
   * The other three count REMOVALS, so all three are zero for a provider whose
   * only contribution is AGREEMENT: one that co-asserts placements another source
   * already made says nothing of its own to delete, and its items survive on the
   * other source's claim. A purge of it still deletes real rows -- its claim on
   * every one of those placements, and its source row -- so a page reading only
   * the removals would report "nothing to remove" about an operation that does
   * something, and would offer no button to perform it.
   *
   * NOTHING IN THE PRODUCT WRITES THAT STATE TODAY, because every import path
   * writes the statements that carry a title, so a source with placements and no
   * statements cannot currently arise. It is guarded anyway: the cost is one
   * clause, and the failure it prevents is an operation an owner cannot reach at
   * all rather than a sentence that reads oddly.
   */
  const takesNothing =
    preview.statements === 0 &&
    preview.placements === 0 &&
    preview.items === 0 &&
    preview.keptItems === 0;

  return (
    <section aria-labelledby="purge" className="mt-10">
      <h2 className="font-medium text-sm" id="purge">
        Purge everything {baseUrl} contributed
      </h2>
      {takesNothing ? (
        <NothingLeft />
      ) : (
        <>
          <p className="mt-1 text-muted-foreground text-sm">
            This cannot be undone. Purging it would take
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            <li>{counted(preview.statements, "statement")}</li>
            <li>{counted(preview.placements, "placement")}</li>
            <li>{counted(preview.items, "item")}</li>
          </ul>
          <Stays howMany={preview.keptItems} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/*
              CANCEL FIRST AND AS A PLAIN LINK, which is the weighting ADR-0046
              asks for read the only way this surface can read it. The record
              refuses a confirmation "dismissible by accident" -- never a drawer,
              never a swipe-away sheet -- and a page at its own address is the
              opposite of one: nothing dismisses it, and leaving is a choice an
              owner makes rather than a gesture they make by mistake.

              `Link` RATHER THAN `a`, which is ADR-0109's rule: this is a path
              this app owns, so it is one the framework has to be allowed to
              rewrite under a `basePath`.
            */}
            <Link className="text-sm hover:underline" href="/import">
              Cancel
            </Link>
            {/*
              A POST BOUND TO A SERVER ACTION, for the reason `Take` gives: Next
              writes the target itself, so there is no URL here for a later
              `basePath` to get wrong -- and it needs no JavaScript, which is what
              lets this surface be asserted with no browser.
            */}
            <form action={purgeProvider}>
              <input type="hidden" name="baseUrl" value={baseUrl} />
              <Button type="submit" variant="destructive">
                Purge permanently
              </Button>
            </form>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * A PROVIDER WITH NOTHING LEFT TO PURGE, which is TWO states the page cannot tell
 * apart and must not try to.
 *
 * One is a provider nothing was ever imported from. The other is a provider
 * purged a moment ago -- a purge deletes the source row, so asking again finds
 * nothing either way, and this is the only report of the outcome the surface can
 * give (an action's return value reaches a page through `useActionState` alone,
 * which is a client hook with nothing to give when no script has loaded).
 *
 * SO IT CLAIMS ONLY WHAT IS TRUE OF BOTH. This copy used to say "no statement,
 * placement or item in your catalogue came from this provider", which is false in
 * the second state and falsest at the worst moment: the owner has just been told
 * that some items STAY, and those came from exactly there. What holds either way
 * is that there is nothing left to purge.
 */
function NothingLeft() {
  return (
    <p className="mt-1 text-muted-foreground text-sm">
      There is nothing to purge: this provider has no claims left in your catalogue.
    </p>
  );
}

/**
 * WHAT A PURGE LEAVES STANDING, which is the half the removals cannot describe.
 *
 * An item this provider wrote and the owner ALSO claims does not go: the owner's
 * placement is the owner's claim, and a provider's licence ending has no bearing
 * on it (ADR-0046). It survives STRIPPED -- the provider's words are gone, so an
 * item whose only title came from here is left untitled -- and an owner who is
 * not told that discovers it afterwards on a page full of blanks.
 *
 * SAID ONLY WHEN THERE IS SOMETHING TO SAY. A standing sentence about survivors
 * on a purge that leaves none is a reassurance about nothing, and the next owner
 * to read it believes it about a purge where it is false.
 */
function Stays({ howMany }: { howMany: number }) {
  if (howMany === 0) return null;

  /*
   * ONE EXPRESSION AND NOT A COUNT WITH PROSE AROUND IT, for two reasons that
   * happen to have one fix. The sentence has to AGREE -- "1 item stay" is the
   * count and the verb disagreeing in the one sentence an owner has to trust --
   * and React separates adjacent text nodes in server-rendered HTML with an empty
   * `<!-- -->` comment, so a number and its sentence written as two expressions
   * arrive spliced apart. Invisible to a reader; not invisible to anything
   * reading the document.
   */
  const one = howMany === 1;

  return (
    <p className="mt-3 text-muted-foreground text-sm">
      {`${counted(howMany, "item")} ${one ? "stays" : "stay"}, stripped of what this provider said about ${one ? "it" : "them"}, because you or another source still ${one ? "claims" : "claim"} ${one ? "it" : "them"}.`}
    </p>
  );
}

/** What `previewPurge` answers, which is what `purge` then takes. */
type PurgePreview = NonNullable<ImportPage["preview"]>;

/**
 * A count and the thing it counts, agreeing about number.
 *
 * THE COUNTS ARE THE CONTENT of this surface rather than decoration on it, so
 * "1 statements" is not a typo an owner reads past -- it is the one part of a
 * permanent delete they have to trust, printed by something that plainly did not
 * read what it was printing.
 */
function counted(howMany: number, noun: string): string {
  return `${howMany} ${noun}${howMany === 1 ? "" : "s"}`;
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
            <span className="font-medium">{baseUrl}</span>{" "}
            <Reason baseUrl={baseUrl} reason={reason} />
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

/**
 * NAMING A CONTAINER TO BROWSE, which the owner has to do because nothing in CMPP
 * answers "which containers do you have".
 *
 * ADR-0033's as-built section records that decision and its reason: a record's
 * `series` field is a NAME, and the archive links members by name while a page id
 * does not move -- so deriving the container from `series` would bind an import to
 * a string that can be renamed out from under it.
 *
 * A GET RATHER THAN THE BROWSE ITSELF, which is what puts the container in the
 * URL -- and that is load-bearing rather than tidy. The POST that performs the
 * browse comes back to this same address, so the page can read the catalogue and
 * say whether the container arrived. A form that browsed directly would lose the
 * id it was given the moment it answered.
 *
 * THE PROVIDERS ARE OFFERED BY URL, which is a deployment detail shown to the one
 * person entitled to it: the owner typed these into `PROVIDER_URLS` and is the
 * only person who can change one. A manifest read per provider would buy their
 * own names for themselves at the cost of a request per provider on every render
 * of this page, for a control the owner recognises by the URL they wrote.
 */
function BrowseBox({
  configured,
  container,
  provider,
}: {
  configured: string[];
  container?: string;
  provider?: string;
}) {
  if (configured.length === 0) return null;

  return (
    <section aria-labelledby="browse" className="mt-10">
      <h2 className="font-medium text-sm" id="browse">
        Import a container and its ordering
      </h2>
      <p className="mt-1 text-muted-foreground text-sm">
        A provider that offers browse hands over a container and its ordering together, so its
        members arrive placed rather than waiting to be placed by hand.
      </p>
      <Form action="/import" className="mt-3 flex flex-wrap items-center gap-2">
        {/*
          A `select` RATHER THAN A SECOND URL FIELD. The providers are the
          configured set, so a free-text box would invite a URL this instance is
          not configured to search and would answer it with a refusal.

          `defaultValue` for the reason the search box gives: this is
          server-rendered markup with no script behind it.
        */}
        {/*
          THE SAME TOKENS `Input` CARRIES, spelt out rather than inherited,
          because `packages/ui` vendors no select and this control sits directly
          beside an `Input` in the same row. A control an eighth of an inch taller
          than its neighbour, in a different type size and with no focus ring, is
          the "reads as part of this product" test failing at the one place a
          keyboard user needs it most: `.claude/rules/frontend.md` puts
          accessibility with the feature, and a select nobody can see the focus on
          is operable and invisible.
        */}
        <select
          aria-label="Which provider holds it"
          className="h-8 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"
          defaultValue={provider ?? configured[0]}
          name="provider"
        >
          {configured.map((baseUrl) => (
            <option key={baseUrl} value={baseUrl}>
              {baseUrl}
            </option>
          ))}
        </select>
        <Input
          aria-label="The provider's own id for the container"
          className="max-w-xs"
          defaultValue={container}
          name="container"
          placeholder="The provider's id for it"
        />
        <Button type="submit" variant="outline">
          Find it
        </Button>
      </Form>
    </section>
  );
}

/**
 * A CONTAINER NAMED AT A PROVIDER THIS INSTANCE DOES NOT SEARCH.
 *
 * It says so rather than showing nothing, for the reason the two notices above
 * say their own thing: an address that quietly produces no section is one an
 * owner reads as breakage. The likely way to arrive here is a link kept past a
 * change to `PROVIDER_URLS`, which is exactly the case where naming the setting
 * is the whole of the help somebody needs.
 */
function NotOneOfOurs() {
  return (
    <section aria-labelledby="not-configured" className="mt-4">
      <h3 className="sr-only" id="not-configured">
        That provider
      </h3>
      <p className="border-t py-3 text-muted-foreground text-sm">
        That is not a provider this instance searches. The ones it does are named in PROVIDER_URLS,
        and the list above is what it currently holds.
      </p>
    </section>
  );
}

/**
 * THE CONTAINER THE OWNER NAMED, AS THE PROVIDER ANSWERS FOR IT.
 *
 * EVERY BRANCH HERE IS A SENTENCE RATHER THAN A FAILURE, which is what asking on
 * the GET buys: `provider.container` reaches the provider, and each of the things
 * it can say -- here it is, there is nothing at that id, this provider does not
 * do browse, this provider could not be reached -- is page copy an owner can act
 * on. Until CNCORE-92 all three refusals were found out by PRESSING the button,
 * where they arrived as a bare `Internal Server Error` with the provider's own
 * reason redacted out of it.
 *
 * SO THE BUTTON IS OFFERED ONLY WHERE A BROWSE WOULD WORK. Nothing to press is
 * the difference between a refusal reported and a refusal merely reworded.
 */
function Container({ baseUrl, containerId, itemId, said }: NamedContainer) {
  return (
    <section aria-labelledby="container" className="mt-4">
      <h3 className="sr-only" id="container">
        The container you named
      </h3>
      {said.answer === "container" ? (
        <ItsOrdering baseUrl={baseUrl} containerId={containerId} itemId={itemId} said={said} />
      ) : (
        /*
          A REFUSAL FROM THE PROVIDER IS NOT THE CATALOGUE FORGETTING, so the
          catalogue's own answer survives all three of them. These are two
          parties answering two questions -- `provider.container` speaks for the
          provider and `provider.held` for this catalogue -- and an owner whose
          provider has gone down or dropped an id is exactly the owner who most
          needs the local copy pointed at. Dropping the link here was the first
          version of this section and it lost something the page had before
          CNCORE-92.
        */
        <div className="border-t py-3">
          {said.answer === "no-such-container" && (
            <NoSuchContainer providerName={said.providerName} />
          )}
          {said.answer === "browse-not-offered" && (
            <DeclinesBrowse providerName={said.providerName} />
          )}
          {said.answer === "unreachable" && <NotReached baseUrl={baseUrl} reason={said.reason} />}
          {itemId !== null && <StillHeld itemId={itemId} />}
        </div>
      )}
    </section>
  );
}

/**
 * WHAT THE PROVIDER HOLDS AT THAT ID, and the button that takes it and its whole
 * ordering.
 */
function ItsOrdering({
  baseUrl,
  containerId,
  itemId,
  said,
}: {
  baseUrl: string;
  containerId: string;
  itemId: string | null;
  said: Extract<NamedContainer["said"], { answer: "container" }>;
}) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t py-3">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {/*
            THE PROVIDER'S OWN TITLE FOR IT, which is what an owner has to go on
            before sixty placements are written. The id they typed stays beside
            it: it is what they can correct, and it is the only thing tying this
            row to the box above.
          */}
          <span>{said.title}</span>
          <span className="text-muted-foreground text-sm">{containerId}</span>
          {/*
            AND WHAT PRESSING THE BUTTON COSTS. One press writes this many
            placements, which is the whole reason `browse` exists (ADR-0033) and
            was the one thing the page could not say before it happened.

            PLURALISED WITH AN `s`, as `Holding` does it, which is honest for
            this word.

            ONE TEMPLATE STRING RATHER THAN TWO EXPRESSIONS SIDE BY SIDE, which
            is also how `Holding` writes it. React separates adjacent text nodes
            with a `<!-- -->` marker so it can find the boundary again when it
            hydrates, so `{n} {noun}` reaches the document as `2<!-- --> <!--
            -->members` -- correct on screen, and not a string anything reading
            the HTML can match.
          */}
          <span className="text-muted-foreground text-sm">
            {`${said.members} ${said.members === 1 ? "member" : "members"}`}
          </span>
          <span className="text-muted-foreground text-sm">
            {itemId === null ? "Not in your catalogue" : "Already imported"}
          </span>
        </span>
        <span className="flex items-baseline gap-3">
          {itemId !== null && <Held itemId={itemId} />}
          {/*
            A POST BOUND TO A SERVER ACTION, for the reason `Take` above gives:
            Next writes the target itself, so there is no URL here for a later
            `basePath` to get wrong (ADR-0109).
          */}
          <form action={browseOrdering}>
            <input type="hidden" name="baseUrl" value={baseUrl} />
            <input type="hidden" name="containerId" value={containerId} />
            <Button type="submit" variant="secondary">
              {/*
                OFFERED AGAIN ONCE HELD, for the reason the record's button is: a
                second browse refreshes the container and its ordering rather than
                writing a second copy of either (migration 3).
              */}
              {itemId === null ? "Import its ordering" : "Import its ordering again"}
            </Button>
          </form>
        </span>
      </div>
    </>
  );
}

/**
 * WHAT THIS CATALOGUE HOLDS AT THAT ID, said even though the provider refused.
 *
 * `Held` ALONE WOULD BE A LINK WITH NO SENTENCE. The row above pairs the link
 * with "Already imported" and this branch has no row, so the words come with it
 * -- an owner who has just been told a provider holds nothing needs to be told
 * what they have, not handed an unexplained link.
 */
function StillHeld({ itemId }: { itemId: string }) {
  return (
    <p className="mt-2 flex items-baseline gap-3 text-sm">
      <span className="text-muted-foreground">Already imported</span>
      <Held itemId={itemId} />
    </p>
  );
}

/**
 * A PROVIDER THAT GAVE THIS INSTANCE NOTHING IT COULD USE.
 *
 * THE THIRD OF THE THREE, AND IT MUST NOT READ AS EITHER OF THE OTHER TWO. A
 * provider that is down and a provider that holds nothing are different answers,
 * and an owner who cannot tell them apart concludes their id was wrong when
 * their source was merely offline -- which is the same reason `Unreachable`
 * above exists for search, and the same distinction this codebase keeps
 * everywhere else.
 *
 * IT DOES NOT SAY "COULD NOT BE REACHED", AND THAT IS NOT A SMALLER CLAIM BUT A
 * TRUE ONE. The answer this renders covers three things: a URL ADR-0034 refused
 * before a socket opened, a provider that never answered, and a provider that
 * answered with something `packages/providers` would not parse -- a `500`, or a
 * browse with no `ordering`. "Could not be reached" is false of the third, and
 * it is false of it while the reason printed underneath says `answered 500`,
 * which is a sentence contradicting itself in two lines.
 *
 * NAMED BY THE URL THE OWNER TYPED, where the two answers above are named by the
 * provider's own name for itself. That is not the inconsistency it looks like:
 * reading the name off the manifest is one of the things that just failed, and
 * the URL is the only part of this the owner can go and fix.
 *
 * AND THE PROVIDER'S OWN REASON IS PRINTED, because ADR-0034 refusing a host, a
 * provider being switched off, and one answering badly have three different
 * remedies, and the sentence is the only thing that separates them.
 */
function NotReached({ baseUrl, reason }: { baseUrl: string; reason: FailureReason }) {
  return (
    <p className="text-muted-foreground text-sm">
      {/*
        THE URL IS NOT NAMED TWICE. `Reason` names the provider itself when the
        sentence is the PROVIDER'S, and ADR-0034's own refusals open `refused
        <origin>:` when it is CANONCORE'S -- so either branch already tells the
        owner which provider this is about, and the lead sentence saying it too
        read as a stutter.
      */}
      Nothing could be learned about that id. <Reason baseUrl={baseUrl} reason={reason} />
    </p>
  );
}

/**
 * A REASON, SAID BY WHOEVER SAID IT (ADR-0123, CNCORE-95).
 *
 * TWO KINDS OF STRING ARRIVE HERE AND THEY ARE NOT THE SAME KIND. CanonCore's
 * own sentence is this app telling the owner about a setting only they can
 * change -- ADR-0034's config boundary refused a URL they typed -- so it is
 * printed as this catalogue speaking, which is what it is.
 *
 * A PROVIDER'S TEXT IS QUOTED AND ATTRIBUTED TO IT. The provider chose those
 * words, and run on unmarked after the app's own sentence they read as the
 * app's: CNCORE-96 binds every reason surface to saying "which Provider it came
 * from so the Owner reads it as a Provider's claim rather than as CanonCore
 * speaking". The LENGTH is not the provider's to choose either, and that is
 * already settled before it arrives here -- `reasonFor` caps it at the seam
 * rather than the page truncating what it is handed.
 *
 * NOT A REWORDING, THOUGH. CNCORE-92's rule is that a provider which cannot be
 * reached must never look like one that holds nothing, and a reason replaced by
 * a house sentence would do exactly that -- "a refusal reworded is not a
 * refusal reported". It is marked as theirs and left as theirs.
 */
function Reason({ baseUrl, reason }: { baseUrl: string; reason: FailureReason }) {
  if (reason.wrote === "canoncore") return <span>{reason.text}</span>;
  return (
    <span>
      <span className="font-medium">{baseUrl}</span> said: <q>{reason.text}</q>
    </span>
  );
}

/**
 * A PROVIDER THAT DOES NOT DO THIS AT ALL, which is not an error on its part.
 *
 * ADR-0033 makes `browse` OPTIONAL AND DECLARED: a provider offering only
 * `search` and `lookup` satisfies CMPP, and the manifest is what says so. The
 * owner asked for something this provider does not do, which is a sentence to
 * put in front of them rather than an empty result to puzzle over.
 *
 * NAMED FOR WHAT THE PROVIDER DOES rather than after `BrowseNotOffered`, which
 * is the Error `packages/api` raises for the same fact on the write path. One
 * word for two kinds of thing, a layer apart, is one grep that answers twice.
 *
 * AND IT IS NOT THE SAME SENTENCE AS `NoSuchContainer` BELOW, which is the point
 * of having two: one says to check the id, this one says that no id will work
 * here. An owner handed the first for the second goes back to a box that can
 * never answer.
 *
 * IT SAYS WHAT STILL WORKS, because "this provider does not do that" with
 * nothing after it reads as a provider that is broken. Search and lookup are
 * required of every provider, so this one remains perfectly useful one record at
 * a time -- which is the import the page already offers above.
 */
function DeclinesBrowse({ providerName }: { providerName: string }) {
  return (
    <p className="text-muted-foreground text-sm">
      {providerName} does not offer browse, so it was not asked for one. It can still be searched,
      and its records imported one at a time.
    </p>
  );
}

/**
 * AN ID THAT ADDRESSES NO CONTAINER AT THAT PROVIDER.
 *
 * THE SENTENCE `provider.browse` DECLARES, REACHING THE OWNER AT LAST. ADR-0066
 * makes this an answer rather than a fault -- an id that cannot BE an identity
 * addresses nothing, exactly as one nobody minted does -- and ADR-0033's
 * `NO_SUCH_CONTAINER` exists to say so. It used to arrive as a 500 with the
 * message redacted out of it; here it is what the page says instead of offering
 * a button.
 *
 * NAMED BY THE PROVIDER'S OWN NAME FOR ITSELF, off its manifest, as every other
 * answering provider on this page is.
 *
 * IT SAYS WHICH KIND OF ID IS WANTED, because that is the likeliest mistake: a
 * browse takes a CONTAINER'S own id, and a record id -- which the results above
 * are full of -- reaches exactly this answer at a provider that holds the record
 * perfectly well.
 */
function NoSuchContainer({ providerName }: { providerName: string }) {
  return (
    <p className="text-muted-foreground text-sm">
      {providerName} holds no container at that id. A browse takes a container's own id rather than
      a record's, so check it at the provider before trying again.
    </p>
  );
}
