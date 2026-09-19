import type { Context } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { Button } from "@canoncore/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@canoncore/ui/components/empty";
import { Input } from "@canoncore/ui/components/input";
import { Select } from "@canoncore/ui/components/select";
import { call } from "@orpc/server";
import Form from "next/form";
import Link from "next/link";
import { counted } from "@/components/counted";
import {
  Holding,
  NarrowToAGroup,
  NoSuchGroup,
  PastTheEnd,
  theScope,
  theStartOf,
  Walk,
} from "@/components/listing";
import { noPasswordSet } from "@/components/no-password";
import { NoProviderAllowlisted } from "@/components/no-provider-allowlisted";
import {
  inTheFixedOrder,
  oneGroup,
  oneValue,
  type WhereThePageStarts,
  whereThePageStarts,
} from "@/components/query-params";
import { Reason } from "@/components/reason";
import { TheirWords } from "@/components/their-words";
import { callerContext } from "@/session";

import { browseOrdering, importRecord, purgeProvider } from "./actions";

/** Which container the owner has asked about, and at which provider. */
interface Asked {
  query?: string;
  /** The Group the query is asked within, which decides who is asked (CNCORE-182). */
  group?: string;
  provider?: string;
  container?: string;
  purge?: string;
  /** Where in the provider's list of containers the page starts (CNCORE-187). */
  startsAt: WhereThePageStarts;
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
async function readImportPage({ query, group, provider, container, purge, startsAt }: Asked) {
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
  /*
   * THE CALLER'S OWN CONTEXT, which on this page decides what is OFFERED as much
   * as what is answered. Nearly every read below is open (ADR-0044's demo is
   * read-only with no login), and the three things that WRITE are the owner's
   * since CNCORE-109 -- so a visitor is shown the whole surface and none of its
   * buttons, rather than buttons that answer 401.
   *
   * "EVERY READ" IS WHAT THIS SAID, AND ONE READ IS NOW THE OWNER'S TOO
   * (ADR-0131, CNCORE-154). `provider.container` answers by running a whole
   * browse at a third party, so it is gated in `aboutTheContainer` below beside
   * `purging` -- the two reads on this page that cost more than a query. What a
   * visitor is shown in its place is `LogIn`, exactly as beside a button.
   */
  const context = await callerContext();
  // ONE CONTEXT FOR ALL OF THEM, for the reason the front page gives: two calls
  // to it would be two answers to "what does this request carry".
  //
  // AND THE CONFIGURATION IS READ FIRST, because what may be asked of a provider
  // depends on whether it is one this instance searches. Not one of these three
  // makes a request of a provider -- two read this instance's own settings,
  // which is one row (CNCORE-99), and the third reads an environment variable --
  // so the ordering costs nothing and buys the narrowing below.
  //
  // THE THIRD IS WHETHER ANYBODY CAN LOG IN HERE AT ALL (CNCORE-146), which is
  // ADR-0094's second fact and is about the INSTANCE rather than the reader: on
  // ADR-0044's read-only instance every password is refused, so nobody obtains
  // a session including the owner, and the notice standing where each control
  // would be must not offer a login there. Joined here rather than awaited on
  // its own, which is the shape the front page reads the same three facts in.
  //
  // AND EVERY GROUP THERE IS (CNCORE-182), which is the picker's list and how a
  // Group that is not there is told from one that asks nobody. Read beside the
  // other three, and only where a query was asked: the picker is offered with
  // a search to narrow and not before.
  const [allowlisted, configured, instance, groups] = await Promise.all([
    call(appRouter.provider.allowlisted, undefined, { context }),
    call(appRouter.provider.configured, undefined, { context }),
    call(appRouter.session.configured, undefined, { context }),
    query === undefined
      ? Promise.resolve(undefined)
      : call(appRouter.group.list, undefined, { context }).then(({ groups }) => groups),
  ]);
  const searchable = searchableProvider(configured.providers, provider);
  /*
   * AND ONLY FOR THE OWNER, WHICH IS THE PREVIEW BEING A WRITE RATHER THAN THE
   * PAGE BEING SHY. `previewPurge` runs the purge traversal and rolls it back
   * (ADR-0046), so it takes a real delete's work and write locks -- it is an
   * `ownerProcedure` for that reason, and asking it on behalf of a visitor would
   * be asking for a 401 in the middle of a page that otherwise renders.
   */
  const purging =
    context.session === null ? undefined : purgeableProvider(configured.providers, purge);

  const [found, namedContainer, preview, offered] = await Promise.all([
    query === undefined
      ? Promise.resolve(undefined)
      : call(appRouter.provider.search, { query, group }, { context }),
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
    /*
     * WHAT THE PICKED PROVIDER HOLDS (CNCORE-187), so the Owner picks a
     * container rather than typing an id it never showed them. Asked for
     * ANYONE, since answering it costs a search's time rather than a browse's
     * (ADR-0131) -- the preview a picked row leads to is still the Owner's.
     *
     * ASKED BESIDE THE PREVIEW RATHER THAN INSTEAD OF IT, so a container picked
     * from page two shows its preview above the page it was picked from.
     */
    searchable === undefined
      ? Promise.resolve(undefined)
      : call(
          appRouter.provider.containers,
          { baseUrl: searchable, after: startsAt.after, before: startsAt.before },
          { context },
        ),
  ]);
  return {
    allowlisted,
    configured,
    found,
    groups,
    namedContainer,
    offered,
    preview,
    purging,
    searchable,
    /**
     * WHETHER THIS READER MAY CHANGE ANYTHING, which is what decides whether a
     * control is rendered at all. A button whose action answers UNAUTHORIZED is
     * worse than no button: with no script loaded a Server Action that throws
     * renders a bare `Internal Server Error`, so an offer this page cannot honour
     * costs the reader the page they were on.
     */
    owner: context.session !== null,
    /**
     * AND WHETHER THERE IS A LOGIN TO OFFER AT ALL (CNCORE-146), read at the
     * top of this function with the other two facts about this instance and
     * handed on from here because the two places that need it are four
     * components deep.
     */
    aPasswordIsSet: instance.password,
  };
}

/**
 * THE TWO QUESTIONS THIS PAGE HAS ABOUT THE CONTAINER THE OWNER NAMED, and they
 * are two because they are asked of two different parties.
 *
 * WHETHER THE CATALOGUE ALREADY HOLDS IT is `held`'s. The owner named this id
 * -- picked it from the list, or typed it -- so, unlike a candidate, which
 * arrives from a search that answered the same question, there is nothing else
 * on the page that knows about THIS one: the list may be on another page of
 * itself, or the provider may list nothing at all. It is also the only
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
    /*
     * AND THE PROVIDER'S HALF IS THE OWNER'S, WHICH IS THE SECOND QUESTION
     * COSTING A WHOLE BROWSE RATHER THAN THE PAGE BEING SHY (ADR-0131,
     * CNCORE-154). `provider.container` answers by running the browse the button
     * runs, and CNCORE-151 gave that sixty seconds -- so an open one let anyone
     * who could reach the instance hold a provider for a minute a request. It is
     * an `ownerProcedure` for that reason, and asking it on behalf of a visitor
     * would be asking for a 401 in the middle of a page that otherwise renders:
     * the same shape, and the same remedy, as `purging` above.
     *
     * THE CATALOGUE'S HALF IS STILL EVERYONE'S, and that is ADR-0072 kept rather
     * than conceded. `held` reads this catalogue's own rows, which a visitor is
     * entitled to whole; what they are not handed is this instance's outbound
     * budget at a third party.
     */
    context.session === null
      ? Promise.resolve(undefined)
      : call(appRouter.provider.container, { baseUrl, containerId }, { context }),
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
 * THE REASON IS THAT THIS SURFACE CAN ONLY OFFER WHAT IT CAN LIST. The
 * providers are the ones this instance names (`/settings`), and a purge target
 * outside that set has no row on the page to sit in and no name an owner could
 * have pressed. The bound that follows is real and worth knowing: a provider
 * REMOVED from the settings cannot be purged until it is named again. Naming it
 * again is how, and ADR-0046 records this as the half that is built.
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

/**
 * WHY NOTHING COULD BE READ FROM A PROVIDER (ADR-0123): the text, and whose
 * sentence it is.
 *
 * TAKEN OFF THE PAYLOAD RATHER THAN IMPORTED FROM `@canoncore/providers`, which
 * publishes the same type. That package is a devDependency here -- the page
 * calls the router, not the provider client -- and a production file importing
 * through one compiles today only because the import is erased.
 */
type FailureReason = Found["failed"][number]["reason"];
/** The container the owner named: what the catalogue holds, and what the provider says. */
type NamedContainer = NonNullable<ImportPage["namedContainer"]>;
/** What the picked provider answered when asked which containers it holds. */
type Offered = NonNullable<ImportPage["offered"]>;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    group?: string | string[];
    provider?: string | string[];
    container?: string | string[];
    purge?: string | string[];
    after?: string | string[];
    before?: string | string[];
  }>;
}) {
  const asked = await searchParams;
  const query = oneValue(asked.q);
  // THE GROUP THE PROVIDERS ARE ASKED WITHIN (CNCORE-182), read by `oneGroup`
  // as every surface that narrows reads it.
  const narrowedTo = oneGroup(asked.group);
  const provider = oneValue(asked.provider);
  const container = oneValue(asked.container);
  // WHERE IN THE PROVIDER'S LIST THE PAGE STARTS, read as every Listing page
  // reads it. This list is filed by nothing but the provider's own order, so it
  // takes no letter.
  const startsAt = whereThePageStarts({ after: asked.after, before: asked.before });
  const {
    allowlisted,
    aPasswordIsSet,
    configured,
    found,
    groups,
    namedContainer,
    offered,
    owner,
    preview,
    purging,
    searchable,
  } = await readImportPage({
    query,
    group: narrowedTo,
    provider,
    container,
    purge: oneValue(asked.purge),
    startsAt,
  });
  // NARROWED ONLY WHERE SOMETHING WAS SEARCHED, for `/search`'s reason: with no
  // query there is no list of Groups to find this one in, and every Group would
  // read as gone.
  const scope = theScope(groups ?? [], query === undefined ? undefined : narrowedTo);
  // NOBODY WAS ASKED: narrowed to a Group that is there, and no Provider in
  // either list. Every Provider asked is in `answered` or in `failed`, so both
  // empty is nobody asked rather than nothing found -- and ONE value decides
  // which of the two notices below renders, so they cannot both, or neither.
  const asksNobody =
    scope.group !== undefined &&
    found !== undefined &&
    found.answered.length === 0 &&
    found.failed.length === 0;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-medium">Import</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Search the providers this instance is configured to reach, and take what you find into your
        catalogue.
      </p>
      {/*
        WHY NOTHING HERE CAN BE IMPORTED, when the reason is the allowlist.

        The front page says this too and it says it for the whole instance;
        here it is the reason this page in particular cannot work, which is
        the clause this surface passes in. ADR-0034 makes the allowlist empty
        by default and the empty value refuses every provider -- so without
        the notice, an owner meets a search that returns a refusal per
        provider and no way to tell a wrong URL from an instance nobody
        configured.

        ONE NOTICE SHARED WITH `/` SINCE CNCORE-177, because this page's copy
        of it had drifted: it had lost the sentence saying an empty result is
        the setting rather than a fault, which is the whole of what the two
        paragraphs were for.
      */}
      {!allowlisted.any && (
        <NoProviderAllowlisted whatIsStopped="nothing here can be searched or imported yet" />
      )}
      {configured.providers.length === 0 && <NoProviderConfigured />}
      {/*
        AND WHETHER ANYBODY CAN LOG IN TO THIS INSTANCE AT ALL (CNCORE-146),
        said ONCE HERE rather than left to be inferred from the notices below.
        Each of those names the operation a reader is not being offered; none of
        them can say that becoming the owner is not on offer either, and a
        reader who is told only "only the owner can import" beside every button
        is left looking for the way to become one.
      */}
      {!owner && !aPasswordIsSet && <NoLogin />}
      <SearchBox group={scope.group?.id} query={query} />
      {/*
        THE PICKER ONCE THERE IS A SEARCH TO NARROW (CNCORE-182), the one the
        three Listings carry. Here a Group narrows WHO IS ASKED rather than
        which Items are listed, which is ADR-0010's third scoped thing beside
        browsing and search -- and `Everything` asks every Provider this
        instance names, which is this page as it always was.
      */}
      {query !== undefined && groups !== undefined && groups.length > 0 && (
        <NarrowToAGroup
          asked={{ q: query }}
          groups={groups}
          narrowedTo={narrowedTo}
          path="/import"
        />
      )}
      {query !== undefined && scope.gone && <NoSuchGroup asked={{ q: query }} path="/import" />}
      {query !== undefined && asksNobody && scope.group !== undefined && (
        <AsksNoProvider
          everything={theStartOf({ path: "/import", asked: { q: query } })}
          group={scope.group.name}
          owner={owner}
        />
      )}
      {found !== undefined && query !== undefined && !scope.gone && !asksNobody && (
        <Results aPasswordIsSet={aPasswordIsSet} found={found} owner={owner} query={query} />
      )}
      <BrowseBox configured={configured.providers} provider={provider} />
      {/*
        A PROVIDER THE ADDRESS NAMED AND THIS INSTANCE DOES NOT SEARCH, whether
        it came with a container or alone: either way nothing is asked of it.
      */}
      {searchable === undefined && (provider !== undefined || container !== undefined) && (
        <NotOneOfOurs />
      )}
      {namedContainer !== undefined && (
        <Container {...namedContainer} aPasswordIsSet={aPasswordIsSet} owner={owner} />
      )}
      {searchable !== undefined && offered !== undefined && (
        <WhatItHolds
          baseUrl={searchable}
          container={container}
          offered={offered}
          startsAt={startsAt}
        />
      )}
      {owner && <PurgeBox configured={configured.providers} />}
      {purging !== undefined && preview !== undefined && (
        <Purge baseUrl={purging} preview={preview} />
      )}
    </main>
  );
}

/**
 * EVERY PROVIDER THIS INSTANCE IS CONFIGURED WITH, and the way to undo one.
 *
 * THE OWNER'S, WHOLE. Every other section of this page is rendered for anyone --
 * the demo shows a visitor everything on the instance (ADR-0044, ADR-0072) and
 * only the buttons are withheld -- and this one is not, because the thing it
 * leads to is not a read: `previewPurge` runs the delete and rolls it back
 * (ADR-0046), so it sits behind the same door as the delete (CNCORE-109). A list
 * whose every entry answered 401 would be a worse surface than no list.
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
 * it, for the reason `BrowseBox` gives: the owner typed these into their own
 * settings and is the only person who can change one. It is also the only
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
            {/* A BASE URL THE OWNER TYPED, and so not this page's words (ADR-0142). */}
            <span className="text-sm">
              <TheirWords>{baseUrl}</TheirWords>
            </span>
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
        Purge everything <TheirWords>{baseUrl}</TheirWords> contributed
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
function SearchBox({ group, query }: { group?: string; query?: string }) {
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
      {/*
        THE GROUP RIDES ALONG, SO A SECOND SEARCH ASKS WHO THE FIRST ASKED
        (CNCORE-182). This box sits on the narrowed page, under a picker that
        still marks the Group, and a search from it that quietly asked every
        Provider would contradict the page it was typed on. After the query,
        so the address is `?q=<query>&group=<id>` in ADR-0066's fixed order --
        the picker's own spelling -- and `Everything` is how it is cleared.
        ONLY A GROUP THAT IS THERE: a dead one would carry "No such Group" on
        to every search typed after it.
      */}
      {group !== undefined && <input name="group" type="hidden" value={group} />}
      <Button type="submit">Search</Button>
    </Form>
  );
}

/**
 * A SEARCH WITHIN A GROUP THAT ASKS NO PROVIDER (CNCORE-182, ADR-0025).
 *
 * IT REPLACES THE RESULTS RATHER THAN SITTING ABOVE THEM, because "Nothing
 * matched" would be a claim about Providers nobody asked -- the confusion
 * `Results` already keeps apart for a Provider that is down. A Group asks only
 * the Providers the Owner told it to, and a new one has been told none.
 *
 * TOLD APART FROM A GROUP THAT ASKED AND HEARD NOTHING BY THE ANSWER ITSELF:
 * every Provider that was asked is in `answered` or in `failed`, so both empty
 * is nobody asked. No second read is needed to know it.
 *
 * THE WAY ON IS BOTH REMEDIES: choose the Group's Providers, which is the
 * Owner's and is offered only to them, or ask every Provider this instance
 * names, which is anybody's.
 */
function AsksNoProvider({
  everything,
  group,
  owner,
}: {
  everything: ReturnType<typeof theStartOf>;
  group: string;
  owner: boolean;
}) {
  return (
    <section aria-labelledby="asks-no-provider" className="mt-8">
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>
            <h2 id="asks-no-provider">
              <TheirWords>{group}</TheirWords> asks no Provider
            </h2>
          </EmptyTitle>
          <EmptyDescription>
            Searching within a Group asks only the Providers it has been told to ask, and this one
            asks none this instance searches.
            {owner && (
              <>
                {" "}
                Choose its Providers in{" "}
                <Link className="underline" href="/groups">
                  Groups
                </Link>
                .
              </>
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link className="hover:underline" href={everything}>
            Search every Provider
          </Link>
        </EmptyContent>
      </Empty>
    </section>
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
function Results({
  aPasswordIsSet,
  found,
  owner,
  query,
}: {
  aPasswordIsSet: boolean;
  found: Found;
  owner: boolean;
  query: string;
}) {
  const matched = found.answered.reduce((total, { results }) => total + results.length, 0);

  return (
    <section aria-labelledby="results" className="mt-8">
      <h2 id="results" className="font-medium text-sm">
        {/*
          THE READER'S OWN QUERY, which nothing bounds in width and a link
          carrying `?q=` shows to whoever follows it. It goes through
          `TheirWords` and the sentence around it does not, as on `/search`
          (ADR-0142).
        */}
        {matched === 0 ? "Nothing matched " : `${matched} found for `}
        <TheirWords>{query}</TheirWords>
      </h2>
      {found.answered.map(({ provider, results }) => (
        <div key={provider.baseUrl} className="mt-4">
          <h3 className="text-muted-foreground text-sm">
            {/*
              THE PROVIDER'S OWN NAME FOR ITSELF, off its manifest. A source
              answers "who said this", and `http://127.0.0.1:39481` shows an
              owner a deployment detail where `provider-wiki` answers it.
              Bounded in length by `cmppManifest` and in width by
              `TheirWords`, since neither is the Provider's to choose.
            */}
            <TheirWords>{provider.name}</TheirWords>
            {results.length === 0 && " matched nothing"}
          </h3>
          {results.length > 0 && (
            <ul className="mt-2 divide-y">
              {results.map((result) => (
                <li key={result.recordId} className="py-3">
                  <Candidate
                    aPasswordIsSet={aPasswordIsSet}
                    baseUrl={provider.baseUrl}
                    owner={owner}
                    result={result}
                  />
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
  aPasswordIsSet,
  baseUrl,
  owner,
  result,
}: {
  aPasswordIsSet: boolean;
  baseUrl: string;
  owner: boolean;
  result: Found["answered"][number]["results"][number];
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/*
          A RECORD'S FIELDS ARE THE PROVIDER'S WORDS AND BOUNDED BY NOTHING, so
          this title, the kind and the release dates beside it each go through
          `TheirWords`: they are flex items here, and a word with no break in it
          would grow one to the word and the page with it (ADR-0142).
        */}
        <span>
          <TheirWords>{result.title}</TheirWords>
        </span>
        {/*
          THE PROVIDER'S OWN WORD for what this is -- `TV story`, `audio story`,
          `movie` -- and not one of the catalogue's seven item kinds. An owner
          choosing between two answers for one title is choosing on exactly this,
          which is why ADR-0033 carries the field at all.
        */}
        <span className="text-muted-foreground text-sm">
          <TheirWords>{result.kind}</TheirWords>
        </span>
        {result.released.length > 0 && (
          <span className="text-muted-foreground text-sm">
            <TheirWords>{result.released.join(", ")}</TheirWords>
          </span>
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
        <Take
          aPasswordIsSet={aPasswordIsSet}
          baseUrl={baseUrl}
          held={result.itemId !== null}
          owner={owner}
          recordId={result.recordId}
        />
      </span>
    </div>
  );
}

/**
 * WHAT STANDS WHERE A CONTROL WOULD, for a reader who is not the owner.
 *
 * THE SURFACE IS NOT HIDDEN, only its buttons -- AND, SINCE CNCORE-154, the two
 * reads that cost more than a query. ADR-0044's demo is read-only with no login
 * and ADR-0072 gives a visitor everything on the instance, so a visitor still
 * searches the providers and still sees what this CATALOGUE holds. What they are
 * not offered is the operation, and this says which operation it was rather than
 * leaving a gap where a button was.
 *
 * WHICH IS WHY THIS NOW STANDS IN FOR READS AS WELL AS BUTTONS. It said "still
 * sees what a container holds and still reads what a purge would take", and
 * neither is a visitor's any more: `previewPurge` runs the purge and rolls it
 * back (ADR-0046), and `provider.container` runs a whole browse at a third party
 * (ADR-0131). A read that spends somebody else's time is refused the same way a
 * write is, and named the same way.
 *
 * `Link` RATHER THAN `a` (ADR-0109): a path this app owns is one the framework
 * has to be allowed to rewrite.
 */
function LogIn({ aPasswordIsSet, to }: { aPasswordIsSet: boolean; to: string }) {
  /*
   * AND WHERE NOBODY CAN LOG IN, THE OPERATION IS STILL NAMED AND THE DOOR IS
   * NOT (CNCORE-146). The paragraph above is why a gap is refused: the reader
   * is entitled to know which operation stood here. What they are not offered
   * on ADR-0044's read-only instance is a login, because `session.logIn`
   * refuses every password there and `/login` renders no form -- so this said
   * "Log in to import" once per control, down a whole page of controls, and
   * every one of them led to a page saying nobody can.
   *
   * WHICH SILENCE IT IS, IS SAID ONCE BY THE PAGE rather than here. This notice
   * stands beside a control and repeats per control; the instance is one fact
   * about the whole page, and `NoLogin` at the top is where it belongs.
   */
  if (!aPasswordIsSet) {
    return <span className="text-muted-foreground text-sm">{`Only the owner can ${to}.`}</span>;
  }

  return (
    <span className="text-muted-foreground text-sm">
      <Link className="underline" href="/login">
        Log in
      </Link>
      {` to ${to}.`}
    </span>
  );
}

/**
 * WHAT AN INSTANCE NOBODY CAN LOG IN TO SAYS ABOUT ITSELF, ONCE (CNCORE-146).
 *
 * A LABELLED SECTION BESIDE THE OTHER TWO NOTICES, because it is the same kind
 * of thing as `NoProviderAllowlisted` and `NoProviderConfigured`: a fact about
 * this instance that a reader cannot discover by trying, and that makes the
 * rest of the page legible. Nothing allowlisted explains an empty result;
 * nothing configured explains the same; no password explains why every control
 * on this page is a notice and no login stands anywhere near them.
 *
 * SHOWN TO A READER WITH NO SESSION ONLY. An owner cannot be on an instance
 * with no password -- that is the whole of ADR-0044's read-only mode -- so the
 * condition is belt and braces rather than a case that arises.
 */
function NoLogin() {
  return (
    <section aria-labelledby="no-login" className="mt-4">
      <h2 className="sr-only" id="no-login">
        Logging in to this instance
      </h2>
      <p className="text-muted-foreground text-sm">{noPasswordSet("changed")}</p>
    </section>
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
function Take({
  aPasswordIsSet,
  baseUrl,
  held,
  owner,
  recordId,
}: {
  aPasswordIsSet: boolean;
  baseUrl: string;
  held: boolean;
  owner: boolean;
  recordId: string;
}) {
  // A VISITOR IS TOLD WHAT THE BUTTON WOULD BE RATHER THAN SHOWN ONE THAT FAILS.
  // `provider.import` is the owner's since CNCORE-109, and with no script loaded
  // a Server Action that throws renders a bare `Internal Server Error` -- so an
  // offer this page cannot honour costs the reader the page they were reading.
  if (!owner) return <LogIn aPasswordIsSet={aPasswordIsSet} to="import" />;

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
 * WHO WAS ASKED AND GAVE NOTHING THIS SEARCH COULD USE, and why.
 *
 * A provider that is down and a provider that matched nothing are different
 * answers, and an owner who cannot tell them apart concludes their query was
 * wrong when their source was merely offline. Named by URL because that is what
 * the owner typed and the only thing they can act on -- reading the provider's
 * own name for itself is one of the things that failed.
 *
 * THE HEADING IS NOT "COULD NOT BE REACHED", for the reason `NotReached` below
 * gives. It is `/settings`' sentence made plural.
 */
function Unreachable({ failed }: { failed: Found["failed"] }) {
  return (
    <section aria-labelledby="failed" className="mt-6">
      <h3 id="failed" className="text-muted-foreground text-sm">
        Nothing could be read from these providers
      </h3>
      <ul className="mt-2 divide-y">
        {failed.map(({ baseUrl, reason }) => (
          <li key={baseUrl} className="py-2 text-sm">
            <span className="font-medium">
              <TheirWords>{baseUrl}</TheirWords>
            </span>{" "}
            <Reason reason={reason} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * AND WHY NOTHING CAN BE IMPORTED WHEN THE REASON IS THE OTHER SETTING.
 *
 * TWO NOTICES RATHER THAN ONE, because there are two settings with two remedies
 * and an owner has to know which to go and set. The allowlist says what MAY be
 * reached; the providers beside it say which there ARE. An instance with a
 * generous allowlist and no provider named searches nothing at all, and ADR-0094
 * is explicit that an install which starts empty without saying what to do next
 * is a failure of its own.
 *
 * BOTH REMEDIES ARE ON ONE PAGE NOW (CNCORE-99), which changes the link and not
 * the notices: they are still two, because which of the two settings is refusing
 * is still the thing an owner cannot work out for themselves.
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
            Name the providers to search in{" "}
            <Link className="underline" href="/settings">
              Settings
            </Link>
            , as their base URLs. Nothing needs a restart. A provider is a URL answering the CMPP
            contract rather than code you install, so nothing you name there runs inside your
            catalogue.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}

/**
 * PICKING A PROVIDER TO BROWSE, which is the whole of what the Owner has to say:
 * the page then shows what it holds (CNCORE-187). Until then the Owner typed a
 * container's own id here, one the provider never showed them -- so a reader
 * who found a record by searching could not reach the Ordering it sits in.
 *
 * A GET RATHER THAN THE BROWSE ITSELF, which is what puts the provider -- and,
 * once one is picked, the container -- in the URL. That is load-bearing rather
 * than tidy: the POST that performs the browse comes back to this same address,
 * so the page can read the catalogue and say whether the container arrived.
 *
 * THE PROVIDERS ARE OFFERED BY URL, which is a deployment detail shown to the one
 * person entitled to it: the owner typed these into their own settings and is
 * the only person who can change one. A manifest read per provider would buy their
 * own names for themselves at the cost of a request per provider on every render
 * of this page, for a control the owner recognises by the URL they wrote.
 */
function BrowseBox({ configured, provider }: { configured: string[]; provider?: string }) {
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
          A `select` RATHER THAN A URL FIELD. The providers are the configured
          set, so a free-text box would invite a URL this instance is not
          configured to search and would answer it with a refusal.

          `defaultValue` for the reason the search box gives: this is
          server-rendered markup with no script behind it.

          THE TOKENS `Input` CARRIES, INHERITED RATHER THAN SPELT OUT
          (CNCORE-177), and `max-w-xs` is the cap the id box below carries.
        */}
        <Select
          aria-label="Which provider holds it"
          className="max-w-xs"
          defaultValue={provider ?? configured[0]}
          name="provider"
        >
          {configured.map((baseUrl) => (
            <option key={baseUrl} value={baseUrl}>
              {baseUrl}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Show what it holds
        </Button>
      </Form>
    </section>
  );
}

/**
 * WHAT THE PICKED PROVIDER HOLDS, to pick from (CNCORE-187): its containers, a
 * page at a time, or the sentence that says why there is no list.
 *
 * THREE ANSWERS AND NONE OF THEM IS AN EMPTY BOX, which is the Owner's story 60.
 * A provider that declines the operation says so (ADR-0033); one that could not
 * answer says why, in its own words; and only one that answered with nothing is
 * a provider saying it holds none.
 *
 * A PICKED ROW LEADS TO THE ADDRESS THE ID BOX REACHES, and that is the whole
 * of how importing from the list lands what browsing by id lands: it IS a
 * browse by id, previewed on the GET by `Container` above and performed by its
 * button. It keeps this page's own position in the list, so the Owner comes
 * back to the page they picked from.
 *
 * AND THE ID BOX STAYS, UNDER EVERY ANSWER. For a decliner it is the only way
 * in. For a provider that lists, it is the way to what the list leaves out --
 * `provider-wiki` browses its categories and lists only its timelines, because a
 * category is not an ordering its source asserts (ADR-0033 under CNCORE-186).
 */
function WhatItHolds({
  baseUrl,
  container,
  offered,
  startsAt,
}: {
  baseUrl: string;
  container?: string;
  offered: Offered;
  startsAt: WhereThePageStarts;
}) {
  return (
    <section aria-labelledby="containers" className="mt-6">
      {/*
        AN `h2`, A SECTION OF THE PAGE IN ITS OWN RIGHT, which is also what lets
        the walk's own notice -- `PastTheEnd`, headed `h2` on every Listing --
        sit in it without a heading outranking the one above it.
      */}
      <h2 className="font-medium text-sm" id="containers">
        {/*
          BY ITS OWN NAME WHERE IT ANSWERED, and by the URL the Owner typed
          where it did not, since reading the name is one of the things that
          failed -- the rule `NotReached` below gives.
        */}
        What{" "}
        <TheirWords>{offered.answer === "unreachable" ? baseUrl : offered.providerName}</TheirWords>{" "}
        holds
      </h2>
      {offered.answer === "containers" && (
        <ItsContainers
          baseUrl={baseUrl}
          container={container}
          offered={offered}
          startsAt={startsAt}
        />
      )}
      {offered.answer === "containers-not-offered" && (
        <p className="mt-1 text-muted-foreground text-sm">
          <TheirWords>{offered.providerName}</TheirWords> does not list the containers it holds, so
          name the one you want by its own id.
        </p>
      )}
      {offered.answer === "unreachable" && (
        <p className="mt-1 text-muted-foreground text-sm">
          Nothing could be learned about what it holds. <Reason reason={offered.reason} />
        </p>
      )}
      <ById baseUrl={baseUrl} container={container} />
    </section>
  );
}

/**
 * ONE PAGE OF A PROVIDER'S CONTAINERS, and the walk to the rest (ADR-0119):
 * the wiki holds 465, so the page carries a Listing's page of them and says how
 * many there are.
 */
function ItsContainers({
  baseUrl,
  container,
  offered,
  startsAt,
}: {
  baseUrl: string;
  container?: string;
  offered: Extract<Offered, { answer: "containers" }>;
  startsAt: WhereThePageStarts;
}) {
  const walking = { path: "/import", asked: { provider: baseUrl } } as const;
  /*
   * A PROVIDER THAT ANSWERED WITH NOTHING, which is a claim about its source
   * and the one answer here that may say "none" (ADR-0033 under CNCORE-185).
   */
  if (offered.total === 0) {
    return (
      <p className="mt-1 text-muted-foreground text-sm">
        <TheirWords>{offered.providerName}</TheirWords> says it holds no containers.
      </p>
    );
  }
  // A LINK THAT OUTLIVED THE CONTAINERS AFTER IT, which the walk's own notice
  // answers as it does on every Listing.
  if (offered.containers.length === 0) return <PastTheEnd {...walking} />;

  return (
    <>
      <div className="mt-1">
        <Holding
          showing={offered.containers.length}
          rowsBefore={offered.rowsBefore}
          total={offered.total}
          noun="container"
        />
      </div>
      <ul className="mt-2 divide-y">
        {offered.containers.map(({ containerId, title, kind, itemId }) => (
          <li
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-2"
            key={containerId}
          >
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {/*
                THE PROVIDER'S OWN TITLE, AND IT IS THE LINK: picking it is the
                whole of what the Owner does here. Its id stays out of the row --
                it is what the Owner was spared -- and travels in the address.
              */}
              <Link
                aria-current={containerId === container ? "true" : undefined}
                className="hover:underline aria-[current]:font-medium"
                href={{
                  pathname: "/import",
                  query: inTheFixedOrder({
                    provider: baseUrl,
                    container: containerId,
                    after: startsAt.after,
                    before: startsAt.before,
                  }),
                }}
              >
                <TheirWords>{title}</TheirWords>
              </Link>
              {/* The PROVIDER'S word for what it is, as on a search candidate. */}
              <span className="text-muted-foreground text-sm">
                <TheirWords>{kind}</TheirWords>
              </span>
            </span>
            {itemId !== null && <Held itemId={itemId} />}
          </li>
        ))}
      </ul>
      <Walk
        {...walking}
        continuesAfter={offered.continuesAfter}
        continuesBefore={offered.continuesBefore}
      />
    </>
  );
}

/**
 * A CONTAINER NAMED BY THE PROVIDER'S OWN ID, for whatever the list does not
 * offer -- which is everything, at a provider that declines the operation.
 *
 * `defaultValue` for the reason the search box gives, and it is the id the
 * address already names, so a mistyped one is there to correct.
 */
function ById({ baseUrl, container }: { baseUrl: string; container?: string }) {
  return (
    <Form action="/import" className="mt-4 flex flex-wrap items-center gap-2">
      <input name="provider" type="hidden" value={baseUrl} />
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
  );
}

/**
 * A CONTAINER NAMED AT A PROVIDER THIS INSTANCE DOES NOT SEARCH.
 *
 * It says so rather than showing nothing, for the reason the two notices above
 * say their own thing: an address that quietly produces no section is one an
 * owner reads as breakage. The likely way to arrive here is a link kept past a
 * change to the providers this instance names, which is exactly the case where
 * saying where that setting lives is the whole of the help somebody needs.
 */
function NotOneOfOurs() {
  return (
    <section aria-labelledby="not-configured" className="mt-4">
      <h3 className="sr-only" id="not-configured">
        That provider
      </h3>
      <p className="border-t py-3 text-muted-foreground text-sm">
        That is not a provider this instance searches. The ones it does are named in{" "}
        <Link className="underline" href="/settings">
          Settings
        </Link>
        , and the list above is what it currently holds.
      </p>
    </section>
  );
}

/**
 * THE CONTAINER THE OWNER NAMED, AS THE PROVIDER ANSWERS FOR IT.
 *
 * AND THE FIFTH BRANCH IS THE PROVIDER NEVER BEING ASKED (ADR-0131, CNCORE-154).
 * That read is the Owner's, so for a visitor there is no answer to render and
 * `said` is `undefined` -- which is a sentence too, and the one `LogIn` writes.
 *
 * EVERY BRANCH HERE IS A SENTENCE RATHER THAN A FAILURE, which is what asking on
 * the GET buys: `provider.container` reaches the provider, and each of the things
 * it can say -- here it is, there is nothing at that id, this provider does not
 * do browse, nothing could be learned from this provider -- is page copy an
 * owner can act on. Until CNCORE-92 all three refusals were found out by
 * PRESSING the button, where they arrived as a bare `Internal Server Error` with
 * the provider's own reason redacted out of it.
 *
 * SO THE BUTTON IS OFFERED ONLY WHERE A BROWSE WOULD WORK. Nothing to press is
 * the difference between a refusal reported and a refusal merely reworded.
 */
function Container({
  aPasswordIsSet,
  baseUrl,
  containerId,
  itemId,
  owner,
  said,
}: NamedContainer & { aPasswordIsSet: boolean; owner: boolean }) {
  return (
    <section aria-labelledby="container" className="mt-4">
      <h3 className="sr-only" id="container">
        The container you named
      </h3>
      {said === undefined ? (
        /*
          THE PROVIDER WAS NOT ASKED, BECAUSE ASKING IS THE OWNER'S (ADR-0131).

          KEYED ON `said` RATHER THAN ON `owner`, WHICH IS THE SAME FACT TWICE
          AND IS DELIBERATE. `owner` is on this component already, and the two
          cannot disagree -- `said` is `undefined` exactly when the session was
          null. What `said === undefined` buys that `!owner` does not is the
          NARROWING: every branch after this one reads `said.answer`, and a test
          on `owner` leaves `said` possibly-undefined for all of them. So the
          check that proves the value is there is the one made, rather than a
          check on the reason it is missing.

          A GAP HERE WOULD BE THE WORSE ANSWER: a reader who typed a container id
          and got back an empty section learns nothing about why, and goes
          looking for what they did wrong. So the operation is NAMED, by the same
          `LogIn` every other control on this page is refused with -- which
          renders the door where there is one and says only that the owner has it
          where there is not (CNCORE-146).

          AND THE CATALOGUE'S OWN ANSWER SURVIVES IT, exactly as it survives the
          three provider refusals below. `held` is open to anyone (ADR-0072), so
          a visitor who asks about a container this catalogue already holds is
          still shown the Item -- which is the half of this section that was
          never the provider's to answer.
        */
        <div className="border-t py-3">
          <LogIn aPasswordIsSet={aPasswordIsSet} to="ask a provider about a container" />
          {itemId !== null && <StillHeld itemId={itemId} />}
        </div>
      ) : said.answer === "container" ? (
        <ItsOrdering
          aPasswordIsSet={aPasswordIsSet}
          baseUrl={baseUrl}
          containerId={containerId}
          itemId={itemId}
          owner={owner}
          said={said}
        />
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
  aPasswordIsSet,
  baseUrl,
  containerId,
  itemId,
  owner,
  said,
}: {
  aPasswordIsSet: boolean;
  baseUrl: string;
  containerId: string;
  itemId: string | null;
  owner: boolean;
  said: Extract<NamedContainer["said"], { answer: "container" }>;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t py-3">
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/*
          THE PROVIDER'S OWN TITLE FOR IT, which is what an owner has to go on
          before sixty placements are written. The id they typed stays beside
          it: it is what they can correct, and it is the only thing tying this
          row to the box above.
        */}
        <span>
          <TheirWords>{said.title}</TheirWords>
        </span>
        <span className="text-muted-foreground text-sm">
          <TheirWords>{containerId}</TheirWords>
        </span>
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
          {`${said.placements} ${said.placements === 1 ? "member" : "members"}`}
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
        {owner ? (
          <form action={browseOrdering}>
            <input type="hidden" name="baseUrl" value={baseUrl} />
            <input type="hidden" name="containerId" value={containerId} />
            <Button type="submit" variant="secondary">
              {/*
              OFFERED AGAIN ONCE HELD, for the reason the record's button is: a
                second browse refreshes the container and its ordering rather
                than writing a second copy of either (migration 3).
              */}
              {itemId === null ? "Import its ordering" : "Import its ordering again"}
            </Button>
          </form>
        ) : (
          <LogIn aPasswordIsSet={aPasswordIsSet} to="import an ordering" />
        )}
      </span>
    </div>
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
      Nothing could be learned about that id from{" "}
      <span className="font-medium">
        <TheirWords>{baseUrl}</TheirWords>
      </span>
      . <Reason reason={reason} />
    </p>
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
      <TheirWords>{providerName}</TheirWords> does not offer browse, so it was not asked for one. It
      can still be searched, and its records imported one at a time.
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
      <TheirWords>{providerName}</TheirWords> holds no container at that id. A browse takes a
      container's own id rather than a record's, so check it at the provider before trying again.
    </p>
  );
}
