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
import { Holding, Listing, PastTheEnd, Walk } from "@/components/listing";
import { oneValue } from "@/components/query-params";
import { callerContext } from "@/session";

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
   * forever. IT READS BOTH OF THOSE NOW: `searchParams` for the cursor
   * (ADR-0119), and the caller's COOKIE since CNCORE-133, because who is asking
   * decides what the empty state says. So it is dynamic twice over without this
   * line; the line stays anyway, for the reason at the foot of this comment.
   * Next documents `connection()` for exactly this shape: "a component doesn't
   * use Request-time APIs ... but still needs to produce different output per
   * request".
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
  // ONE CONTEXT FOR ALL THREE, rather than one each. It opens no connection of
  // its own -- the pool is memoised and the allowlist parsed at module load --
  // but three calls to it would be three answers to "what does this request
  // carry", which is the thing a context exists to make one.
  //
  // `callerContext` RATHER THAN `createContext` SINCE CNCORE-133, which is the
  // whole of how the session arrives: the plain constructor takes no token, so
  // this page read every request as a visitor's and could not have told the
  // owner from one if it had tried.
  const context = await callerContext();
  const [catalogue, providers, instance] = await Promise.all([
    call(appRouter.catalogue.list, { after }, { context }),
    call(appRouter.provider.allowlisted, undefined, { context }),
    call(appRouter.session.configured, undefined, { context }),
  ]);
  return {
    catalogue,
    providers,
    owner: context.session !== null,
    aPasswordIsSet: instance.password,
  };
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string | string[] }>;
}) {
  // ADR-0119's cursor, read on the SERVER so the page a reader is served
  // is already the page they asked for. `oneValue` owns what a repeated
  // parameter means, so both reading surfaces answer that the same way.
  const { after } = await searchParams;
  const from = oneValue(after);
  const { catalogue, providers, owner, aPasswordIsSet } = await readFrontPage(from);
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
      {empty && <WhatToDoNext aPasswordIsSet={aPasswordIsSet} owner={owner} />}
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
 * ADR-0034 makes the allowlist empty by default and the empty value refuses
 * every provider. That is the safe end of the failure and it is also completely
 * silent: with nothing allowlisted, an instance nobody has configured and an
 * instance that is broken look identical from here. Two shards of the
 * competitor sweep rated exactly this first run HIGH.
 *
 * IT STANDS WHETHER OR NOT THE CATALOGUE IS EMPTY, because an owner with items
 * already and no allowlist is just as stuck: nothing more can be imported. The
 * condition is read off `providers.any` alone and never off the catalogue's
 * size, which is what makes that true by construction rather than by care.
 *
 * ALL FOUR COMBINATIONS EXIST IN THE SUITE AND THIS PAGE'S ASSERTIONS READ
 * THREE, which is worth saying exactly rather than leaving a reader to assume
 * either number. Empty with an empty allowlist is `fresh`; neither is the
 * seeded instance; empty WITH an allowlist that admits something is `allow`
 * since CNCORE-131, and that is what holds the empty state to being offered
 * whether or not a provider is reachable. ITEMS PRESENT WITH NO ALLOWLIST is
 * the fourth and it is NOT missing -- `place` and `order` are both in it -- but
 * their suites assert container pages rather than `/`, so this notice has never
 * been read in that state. It has cost nothing because the condition here
 * cannot see the catalogue to get it wrong, which is the same reason a server
 * of its own was never worth standing up for it.
 *
 * WHERE THE SETTING IS, NAMED AND LINKED (CNCORE-99). "Allowlist a provider" is
 * the step, and until this ticket the thing an owner had to type was an
 * environment variable -- so the page named `PROVIDER_ALLOWLIST`, because a page
 * that gestured at the step without naming it would leave them exactly where
 * the README left them. The setting is on a page of this app now, so what the
 * notice owes them is the way TO it: a link they can follow rather than a
 * variable they have to go and find a file for.
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
            CanonCore reaches a provider only when its host or address range is on the allowlist in{" "}
            <Link className="underline" href="/settings">
              Settings
            </Link>
            . That setting is empty until you write one, and empty refuses every provider, so
            nothing can be imported yet. An empty result here is this setting rather than a fault.
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
 *
 * TWO ROUTES, AND THE ONE THAT NEEDS NOTHING GOES FIRST (CNCORE-131). It said
 * two STEPS until then and both of them were a provider's: allowlist one, then
 * import from it. That was the whole answer for as long as a provider was the
 * only way in, and v0.2.0 ended it -- `/new` makes an Item with no file and no
 * provider record (ADR-0003), and a Container holding it is a catalogue with
 * nothing allowlisted and nothing running anywhere. So the copy was not wrong
 * and was not the whole answer: a reader whose instance reaches nothing was
 * being sent to find something for it to reach, past the shorter path already
 * on the page they were looking at. Found walking a real v0.2.0 install
 * (CNCORE-75).
 *
 * ROUTES RATHER THAN STEPS, WHICH IS WHY THE PROVIDER'S TWO ARE ONE ITEM. A
 * list of steps is a sequence to complete and a list of routes is a choice
 * between alternatives; naming a provider and importing from it are steps
 * WITHIN one route, because an owner who does the first and stops has filled
 * nothing.
 *
 * AND THE LIST IS THE OWNER'S (CNCORE-133), which is why this page reads a
 * session at all. Both routes end at a surface behind one, so an empty state
 * offered to every reader was advice most of them could not take -- and the
 * page had no way of knowing, because it read the catalogue and the allowlist
 * and nothing about who was asking. `WhoFillsIt` below holds the decision and
 * the two sentences that replace this list for a reader who is not the owner.
 *
 * IT IS NOT CONDITIONAL ON REACHING ANYTHING, and that is the criterion rather
 * than an accident of where the condition sits. The hand-built route is what an
 * owner with no provider has, so an empty state that appeared only where
 * nothing was allowlisted would withhold it from exactly the owner who
 * configured one and still has an empty catalogue. Read off `empty` and the
 * session, NEVER off `providers.any`, and the e2e harness stands up an instance
 * in that combination (`anInstanceAllowlistedAndEmpty`, which carries the owner
 * too since CNCORE-133) to hold it there. That fixture holds one half of it:
 * what no instance here can still hold is an owner with NOTHING allowlisted,
 * and its own docblock says why no server was added to recover that.
 */
function WhatToDoNext({ aPasswordIsSet, owner }: { aPasswordIsSet: boolean; owner: boolean }) {
  return (
    <section aria-labelledby="what-to-do-next" className="mt-6">
      <Empty className="border">
        <EmptyHeader>
          {/* A real heading, for the reason `NoProviderAllowlisted` gives. */}
          <EmptyTitle>
            {/*
              `Your` IS A CLAIM ABOUT THE READER, so it is made only where the
              reader has proved it. A visitor is looking at somebody else's
              catalogue and a sentence calling it theirs is wrong in the one
              direction this page can be wrong in.
            */}
            <h2 id="what-to-do-next">
              {owner ? "Your catalogue is empty" : "This catalogue is empty"}
            </h2>
          </EmptyTitle>
          <EmptyDescription>
            {/*
              THE FIRST SENTENCE IS EVERY READER'S, and that is ADR-0094's other
              half rather than a courtesy: an install that starts empty without
              saying so is a failure of its own, and a visitor who cannot fill a
              catalogue still needs to tell a product that ships none from one
              that is broken.
            */}
            It starts that way on purpose: CanonCore ships no catalogue, so nothing here is anybody
            else&rsquo;s library. <WhoFillsIt aPasswordIsSet={aPasswordIsSet} owner={owner} />
          </EmptyDescription>
        </EmptyHeader>
        {owner && (
          <EmptyContent>
            <ul className="space-y-3 text-left">
              <li>
                {/*
                NO RECORD CITED IN THE COPY ITSELF. ADR-0003 is what makes an
                Item with no file a complete entry, and the reader of this page
                is a stranger on their first run -- so the record belongs in
                this comment and the sentence it justifies belongs on the page.
                Nothing else this page renders cites one.
              */}
                <span className="font-medium">
                  <Link className="underline" href="/new">
                    Add an item yourself
                  </Link>
                  .
                </span>{" "}
                A story, a person, a place &mdash; whether or not you have the file, and whether or
                not a provider has ever heard of it. Make a Container the same way, place items in
                it, and the catalogue is yours. Nothing to configure and no provider to reach.
              </li>
              <li>
                {/*
                ONE ROUTE WITH TWO STEPS IN IT, rather than the two list items
                this was (CNCORE-131). Configuring a provider and importing from
                one were siblings while everything on this list was a step, and
                the list is ROUTES now -- so leaving them apart would offer an
                owner a way of filling a catalogue that fills nothing, which is
                what "name a provider" on its own is.

                THE STEP IS A LINK (CNCORE-68). It used to say to give a
                provider's base URL and the id of one of its records, which is the
                hand-POSTing the import surface exists to remove -- so the copy and
                the product agreed only for as long as there was no surface. A
                record can be found by NAME, and the page that does it is one click
                from here rather than an address to know.
              */}
                <span className="font-medium">
                  <Link className="underline" href="/import">
                    Import from a provider
                  </Link>
                  .
                </span>{" "}
                Two settings first, in{" "}
                <Link className="underline" href="/settings">
                  Settings
                </Link>
                , and a provider needs both:{" "}
                {/*
                BOTH NAMED, AND NAMED AS THAT PAGE NAMES THEM. ADR-0121 makes
                them two settings that are not derivable from each other -- one
                holds URLs and says what IS reached, the other holds hosts and
                ranges and says what MAY be -- so a step naming one leaves an
                owner with a provider that is never reached and nothing on the
                page to say why. They were `PROVIDER_URLS` and
                `PROVIDER_ALLOWLIST` until CNCORE-99 and are rows now, so the
                words here are the headings a reader meets on arrival rather
                than variables they would go looking for in a file.
              */}
                <span className="font-medium">Providers</span> holds its base URL, and the{" "}
                <span className="font-medium">Allowlist</span> holds the host or address range it
                answers on. Neither needs a restart, and a provider is a URL rather than code you
                install, so nothing runs inside your catalogue. Then search it by name and take what
                you find: the record arrives here as an Item, and a provider that offers browse
                imports a whole ordering at once.
              </li>
            </ul>
          </EmptyContent>
        )}
      </Empty>
    </section>
  );
}

/**
 * WHO CAN ACTUALLY FILL THIS CATALOGUE, which is three answers rather than one
 * (CNCORE-133).
 *
 * THE ROUTES BELOW ARE THE OWNER'S, AND THE PAGE SAID SO TO NOBODY. Every
 * surface they lead to is behind a session (ADR-0044): `/new` answers a visitor
 * "Only the owner of this catalogue can add to it", and `/import` renders with
 * its buttons disabled. So an empty catalogue was telling every reader to do
 * two things, and refusing most of them on arrival.
 *
 * A SESSION RATHER THAN A PASSWORD IS WHAT THE ROUTES TURN ON, and the
 * difference is the reader rather than the instance. An instance with a
 * password has an owner who may not be logged in yet -- the README's own first
 * instruction is to go and do that -- but it also has visitors, and gating on
 * the instance would go on offering `/new` to every one of them. So the routes
 * are rendered for a caller who has proved they are the owner, and the caller
 * who has not is offered the one step that would make them one.
 *
 * AND WHERE THERE IS NO PASSWORD THERE IS NO STEP, which is the third answer
 * and the reason this reads a second fact. ADR-0044's read-only instance sets
 * none, so `session.logIn` refuses every password and nobody obtains a session
 * INCLUDING the owner -- a login link here would be the door with no key cut
 * for it that `/login` already refuses to render, and the honest thing to say
 * is the thing that page says.
 *
 * `session.configured` IS THE PROCEDURE THAT ANSWERS IT, which exists for this
 * exact shape one setting over from `provider.allowlisted`: a fact about the
 * instance that a page has to act on, answered once and plainly rather than
 * inferred from a refusal.
 *
 * AND THE PROP IS `aPasswordIsSet` RATHER THAN `login`, because the two facts
 * here are one word apart and the wrong word is the dangerous one: `login`
 * reads as "is logged in", which is precisely what `owner` beside it already
 * means. Named for what the INSTANCE HAS rather than for what the reader has
 * done, so the two cannot be swapped by somebody skimming the signature.
 */
function WhoFillsIt({ aPasswordIsSet, owner }: { aPasswordIsSet: boolean; owner: boolean }) {
  if (owner) return <>Two routes fill it, and neither waits on the other.</>;
  if (aPasswordIsSet)
    return (
      <>
        Only the owner can fill it.{" "}
        <Link className="underline" href="/login">
          Log in
        </Link>{" "}
        if that is you.
      </>
    );
  return (
    <>
      This instance has no password set, so nobody can log in and nothing can be added through it.
    </>
  );
}
