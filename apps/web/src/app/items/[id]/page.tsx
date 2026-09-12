import type { Context } from "@canoncore/api/context";
import { createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { Button } from "@canoncore/ui/components/button";
import { Input } from "@canoncore/ui/components/input";
import { Label } from "@canoncore/ui/components/label";
import { Textarea } from "@canoncore/ui/components/textarea";
import { call, isDefinedError, safe } from "@orpc/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Attribution } from "@/components/attribution";
import { Holding, type MembersPath, PastTheEnd, type TheRoute, Walk } from "@/components/listing";
import { oneValue } from "@/components/query-params";
import { callerContext } from "@/session";

import {
  annotateItem,
  placeItemInContainer,
  removePlacement,
  restorePlacement,
  retitleItem,
} from "../actions";

/**
 * ADR-0066: `/items/<id>` is canonical and addresses the item.
 *
 * The router is called IN-PROCESS rather than over HTTP. A server component
 * fetching its own API is a round trip to itself, and oRPC documents `call` as
 * the way to avoid it.
 */
async function readItem(
  id: string,
  { after, context }: { after?: string; context?: Context } = {},
) {
  const { error, data } = await safe(
    call(appRouter.item.get, { id, after }, { context: context ?? (await createContext()) }),
  );
  if (!error) return data;
  // Only a missing item is a 404. Anything else -- a database that is down, a
  // contract the handler stopped honouring -- must surface as a 500 rather than
  // be quietly reported as "no such item".
  //
  // A MALFORMED id reaches this line as a NOT_FOUND like any other, and there is
  // deliberately nothing here that special-cases one (CNCORE-14). Whether a
  // string can be an identity is decided where the other rules about what an id
  // means already live -- the tombstone and the alias, in `findItem` -- so every
  // reader gets the same answer and not only this page (ADR-0066).
  if (isDefinedError(error) && error.code === "NOT_FOUND") notFound();
  throw error;
}

/**
 * What the page actually has to render, taken from the read path rather than
 * imported from the contract package. The two cannot drift, and the app names
 * one fewer dependency for it.
 */
type ItemOnThePage = Awaited<ReturnType<typeof readItem>>;

/**
 * The Owner's own note about this item (ADR-0096), on a call of its own.
 *
 * A SECOND READ RATHER THAN A FIELD ON THE FIRST, and ADR-0045 is why: the
 * public read path "carries no internal ids, no owner id and NO NOTES", so the
 * note cannot ride on `item.get` -- which anyone may call (ADR-0044). Asking
 * separately is what lets the procedure that answers it be the owner's.
 *
 * ONLY CALLED FOR THE OWNER, and the procedure refuses everybody else anyway.
 * The page asks at all only when it has a session, so a visitor's page makes no
 * call that would answer UNAUTHORIZED and render as a 500.
 */
async function readNote(id: string, context: Context) {
  return call(appRouter.item.note, { id }, { context });
}

/** What the note section renders, taken from the read rather than restated. */
type NoteOnThePage = Awaited<ReturnType<typeof readNote>>;

/**
 * How a placement got where it is, in the reader's words rather than the
 * model's. The four keys are the four source kinds (ADR-0071) and the map is
 * total over them, so a placement can always say how it arrived.
 *
 * The words differ from the source labels in the database on purpose: those
 * name WHO ASSERTED a value, and these answer the question the reader is
 * actually asking of this list, which is how the item came to be in here.
 */
const PLACED_BY: Record<string, string> = {
  owner: "Hand-placed",
  provider: "Imported",
  sidecar: "From the files",
  derived: "Rule-derived",
};

/**
 * The map is TOTAL over `source_kinds`, which is a closed set only a migration
 * changes. The fallback is not a hedge against a fifth kind arriving unnoticed
 * -- it is there because TypeScript cannot see the foreign key that makes the
 * map total, and it must not print `sidecar` at a reader either way: CONTEXT.md
 * has this list speaking in its own words rather than the model's.
 */
function placedByLabel(kind: string): string {
  return PLACED_BY[kind] ?? "Placed another way";
}

/**
 * A property's name, in the reader's words rather than the model's.
 *
 * UNLIKE `PLACED_BY` THIS ONE HAS A REAL FALLBACK, and the difference is not
 * sloppiness. The source kinds are a closed set of four that only a migration
 * changes, so a fifth arriving is a defect and its fallback is a guard. The
 * PROPERTIES grow -- also only by migration (ADR-0029), but growing is what they
 * are for -- so a property this map has not been taught yet is ordinary, and
 * showing `sort_name` at a reader would be showing them the column.
 *
 * Only literal-valued properties can reach here: an item-valued statement has no
 * literal and the read path leaves it out.
 */
const PROPERTY: Record<string, string> = {
  title: "Title",
  sort_name: "Sorts as",
  released: "Released",
  image: "Image",
};

/**
 * Where a placement sits, in the reader's words.
 *
 * A MEMBER WITH NO POSITION IS STILL A MEMBER (migration 2), and this is where
 * a reader meets one: the source put the item in this container and said
 * nothing about where. Printing `#null` would be the model leaking, and leaving
 * the row out would hide a membership that is real.
 *
 * The words say what is absent rather than guessing at it, because the two
 * other answers -- dropping the row, or numbering it last -- each assert
 * something no source ever claimed.
 */
function positionLabel(position: number | null): string {
  return position === null ? "No position given" : `#${position}`;
}

function propertyLabel(name: string): string {
  const known = PROPERTY[name];
  if (known) return known;
  const spaced = name.replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await readItem(id);
  return {
    title: item.title ?? "Untitled item",
    /*
     * ADR-0066: the path is identity and the query is the route, so
     * `?via=<placement-id>` names the ordering the reader arrived through and
     * identifies nothing. RFC 6596 is what makes that declaration visible to a
     * crawler, a cache or any other consumer, instead of leaving it in a ticket
     * where none of them can see it.
     *
     * SELF-REFERENTIAL and emitted unconditionally, which is the simpler
     * correct thing: the bare URL declares itself canonical and every
     * parameterised form points at it. RFC 6596 section 3 permits both -- the
     * target IRI MAY "be self-referential" and MAY "specify a relative IRI".
     *
     * RELATIVE, because this is self-hosted software with no build-time
     * hostname. Next only makes a canonical absolute when `metadataBase` is
     * set; unset, the string is emitted as written. An origin setting would be
     * a value nothing else in the repo reads, and one more thing to get wrong
     * behind a reverse proxy.
     *
     * The id here is the CANONICAL one the read path answered with, not the one
     * the reader arrived with -- so an alias to a merged-away item points at the
     * survivor rather than declaring itself canonical (ADR-0040).
     */
    alternates: { canonical: `/items/${item.id}` },
  };
}

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    via?: string | string[];
    placed?: string | string[];
    after?: string | string[];
    undo?: string | string[];
    refused?: string | string[];
  }>;
}) {
  const { id } = await params;
  /*
   * THE CALLER'S OWN CONTEXT, which on this page decides what is OFFERED rather
   * than what is answered. Every read here is open (ADR-0044), and the one
   * thing that WRITES is the owner's (CNCORE-109) -- so a visitor is shown the
   * whole item and no way to change it, rather than a button that answers 401.
   *
   * ONE CONTEXT FOR BOTH, for the reason `/import` gives: two calls to it would
   * be two answers to "what does this request carry".
   */
  const context = await callerContext();
  /*
   * ADR-0066: the ordering the reader arrived through. Read HERE, on the
   * server, so it is in the HTML the reader is served rather than filled in by
   * a script afterwards.
   *
   * Next documents `searchParams` as a request-time API, so touching it opts
   * this whole route into dynamic rendering -- the bare canonical URL included,
   * which carries no query at all. That is accepted rather than overlooked: at
   * one hand-seeded item it costs nothing, and the escape hatch when it does
   * cost something is a Suspense boundary around this strip alone.
   *
   * An array means the parameter was repeated; a route is one route, so a
   * repeated one names no ordering rather than the first of several.
   */
  const { via, placed, after, undo, refused } = await searchParams;
  /*
   * `oneValue` OWNS WHAT A REPEATED OR BLANK PARAMETER MEANS, and this page is
   * the surface its own module was extracted for. It read `typeof via ===
   * "string"` here, which is a THIRD spelling of a rule that had already
   * drifted into three across four surfaces -- and the day a cursor arrived
   * beside them was the day one page would have answered `?after=` differently
   * from `/`. The two answers only ever differed on a blank value, which
   * matches no placement either way, so nothing about `via` or `placed` moves.
   */
  const arrivedThrough = oneValue(via);
  const showingOnly = oneValue(placed);
  // ADR-0119's cursor for the Members listing below, read on the SERVER like
  // the two above it, so the page a reader is served is the page they asked for.
  const from = oneValue(after);
  /*
   * THE PLACEMENT A REMOVAL JUST TOOK OUT, so this page can offer it back
   * (ADR-0046). It identifies nothing -- the path is the container's identity
   * and this is how the reader arrived at this view of it -- so a stale or
   * foreign id simply offers an undo that restores nothing.
   */
  const undone = oneValue(undo);
  /*
   * THE PLACEMENT THE CATALOGUE WOULD NOT MAKE, so the page can say so rather
   * than the owner meeting a 500 (ADR-0116). Like `?undo=` it identifies
   * nothing, and an id naming no item simply says an item is already there.
   */
  const refusedItem = oneValue(refused);

  const item = await readItem(id, { after: from, context });
  const owner = context.session !== null;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      {/*
        The title comes from the PROJECTED COLUMN, which is a cached copy of
        whichever title statement currently wins (ADR-0014). An item with no
        title statement has no title, and says so rather than showing its id.
      */}
      <h1 className="text-3xl font-medium">{item.title ?? "Untitled item"}</h1>
      {item.sortName && (
        <p className="mt-2 text-sm text-muted-foreground">Sorts as {item.sortName}</p>
      )}
      {/*
        No `releaseDate` here on purpose. ADR-0081 defines it as the earliest
        known release of any EDITION, and editions arrive with their own slice,
        so the column is deliberately never projected yet (see migration 1's
        second rung). A field that renders only when it is populated, and which
        by design is never populated, is markup nobody will ever see.
      */}
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Kind</dt>
        {/*
          THE READER'S WORD FOR IT, and the read path is where that is decided:
          `kind` carries the label `item_kinds` holds beside the column, so this
          says "Time span" where the column says `time_span` (CNCORE-83). The
          catalogue listing prints the same field for the same reason, and the
          words themselves are settled in `CONTEXT.md`, which is binding on UI
          copy -- so neither surface keeps a map of its own to go stale.
        */}
        <dd>{item.kind}</dd>
        {/*
          WHAT SORT OF THING IT IS BEYOND ITS KIND (ADR-0004, ADR-0018). A
          container folds into `work`, so `kind` alone cannot tell an owner
          whether the item they just made holds things -- and an EMPTY container
          has no Members list to infer it from, which is exactly the state an
          owner meets straight after creating one.
        */}
        {item.isContainer && (
          <>
            <dt className="text-muted-foreground">Holds</dt>
            {/*
              NOT "Unordered container", WHICH THE GLOSSARY RESERVES. CONTEXT.md's
              Unplaced entry `_Avoid_`s `unordered` -- it means a member with NO
              POSITION -- and this page LISTS placements a few sections down,
              where an unplaced member reads "no position given". Two senses of
              one word on one page is exactly what that list exists to stop.
              These words say what the container claims about its own members
              instead, and they match the create form's.
            */}
            <dd>
              {item.isOrdered ? "Other items, in order" : "Other items, in no particular order"}
            </dd>
          </>
        )}
      </dl>
      {/*
        THE OWNER'S OWN HAND ON THE VALUE, directly above the list of who claims
        what -- so an owner who disagrees with a provider edits in the place
        they saw the disagreement.
      */}
      {owner && <EditTitle itemId={item.id} title={item.title} />}
      {/*
        THE OWNER'S NOTE, AND ONLY THE OWNER'S PAGE HAS ONE (ADR-0045). A
        visitor is not shown an empty section either: there is nothing there to
        render and nothing they could put in it.

        ABOVE the claims list for the reason `EditTitle` is: this is the owner's
        own words about the item, and the list under it is everybody's.
      */}
      {owner && <Note itemId={item.id} note={await readNote(item.id, context)} />}
      <Values statements={item.statements} />
      {/*
        BEFORE "Also appears in", because a container's own ordering is what a
        reader browsing into it came for, and where this item sits in OTHER
        orderings is the secondary question. On an item that is not a container
        the section renders nothing, so the order costs a non-container reader
        nothing.
      */}
      {/*
        THE OWNER'S OWN HAND ON THE MEMBERSHIP, directly above the list it
        changes -- so an owner reading an ordering edits it where they read it.
        A visitor is shown neither control (ADR-0044, CNCORE-109).
      */}
      {owner && item.isContainer && (
        <PlaceAnItem
          containerId={item.id}
          undone={undone}
          refused={refusedItem}
          context={context}
        />
      )}
      <Members
        itemId={item.id}
        holds={item.holds}
        route={theRoute(arrivedThrough, showingOnly)}
        owner={owner}
        from={from}
      />
      <AlsoAppearsIn
        itemId={item.id}
        placements={item.placements}
        arrivedThrough={arrivedThrough}
        showingOnly={showingOnly}
        from={from}
      />
      {/*
        LAST ON THE PAGE, AND THAT IS NOT A DEMOTION. TMDB's terms ask for the
        notice "prominently in or on Your Application", which is a requirement
        that it be there and legible rather than that it lead -- and it sits
        directly under the claims it is owed for, which is where it means
        something. What it must not be is hidden behind an interaction, and it is
        not: it is in the HTML the server returns.
      */}
      <Attribution attribution={item.attribution} />
    </main>
  );
}

/**
 * Every value anybody has claimed about this item, and WHO claimed it.
 *
 * A statement carries its source (ADR-0012), and this is where a reader sees
 * that: an imported title says the provider said it, the owner's own says
 * Owner. Jellyfin merges first-non-empty-wins and DISCARDS the losing answers,
 * which is why it can never tell you where a value came from (ADR-0026); this
 * list is the opposite claim, made visible.
 *
 * THE TITLE APPEARS HERE AS WELL AS IN THE HEADING, on purpose. The heading is
 * the PROJECTION -- whichever statement currently wins (ADR-0014) -- and this is
 * the claim itself with its provenance attached. Leaving it out would mean the
 * one value every item has is the one value whose source a reader cannot see.
 *
 * Competing values for one property are all listed, winner first, by the same
 * three terms the projection uses -- so the first row for `title` is always the
 * one in the heading above.
 */
function Values({ statements }: { statements: ItemOnThePage["statements"] }) {
  if (statements.length === 0) return null;

  return (
    <section className="mt-8" aria-labelledby="values">
      <h2 id="values" className="font-medium text-sm">
        Values
      </h2>
      <ul className="mt-2 divide-y">
        {statements.map((statement) => (
          <li
            // Not the statement's own id: ADR-0045 keeps it out of the read
            // path, so the key is what identifies the row to a reader anyway.
            key={`${statement.property}:${statement.value}:${statement.sourceLabel}`}
            className="flex items-baseline justify-between gap-4 py-2"
          >
            <span className="flex items-baseline gap-3">
              <span className="text-muted-foreground text-sm">
                {propertyLabel(statement.property)}
              </span>
              <span>{statement.value}</span>
            </span>
            {/*
              The source's own LABEL rather than its kind. "Who asserted this"
              is answered by `provider-wiki`, where `provider` answers only what
              sort of thing said it -- and the reader is asking the first.
            */}
            <span className="text-muted-foreground text-sm">{statement.sourceLabel}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * WHAT THIS CONTAINER HOLDS, in its own order (ADR-0018) -- and the mirror of
 * `AlsoAppearsIn` below, which is every ordering this item sits IN.
 *
 * NAMED FOR ITS HEADING RATHER THAN FOR ITS TYPE, which is why `Members`
 * survives CNCORE-91 while `memberPublic` did not. `AlsoAppearsIn` is named the
 * same way -- neither component is called after the shape it renders -- and
 * `CONTEXT.md` settles "Members" as the reader's word from the container's end.
 * The rows are `placementInContainerPublic`, and the reader never sees that.
 *
 * THIS IS WHERE BROWSING INTO A CONTAINER LANDS. A Container is an Item
 * (ADR-0004), so its page is the Item page: ADR-0066 makes the path identity,
 * and a second route for a container would be one thing at two addresses, which
 * is exactly what that record's canonical link relation exists to deny.
 *
 * A REPEAT RENDERS TWICE, which is the point rather than a bug to guard
 * against: CONTEXT.md defines it as "a recap at position 1 and the episode at
 * position 5 ... one item, twice, on purpose", and ADR-0009 is why it is
 * allowed. The `key` is the PLACEMENT's id and not the item's for that reason --
 * two rows here legitimately share one `itemId`, and React given the item id
 * would see one key twice.
 */
function Members({
  itemId,
  holds,
  route,
  from,
  owner,
}: {
  itemId: string;
  holds: ItemOnThePage["holds"];
  /** ADR-0066's other two parameters, which every link here has to keep. */
  route: TheRoute;
  /** The cursor this page was asked with, if it was asked with one. */
  from?: string;
  /** Whether to offer the controls that CHANGE this ordering (CNCORE-109). */
  owner: boolean;
}) {
  const { entries, total, continuesAfter } = holds;
  /*
   * NOTHING AT ALL FOR AN ITEM THAT HOLDS NOTHING, which is `total` rather than
   * `entries.length`: an item that is not a container and an empty container
   * both hold none, and both rendered nothing before this listing was capped.
   * The two are deliberately not told apart here -- ADR-0004's fold is what
   * `isContainer` above carries, and the `Holds` row in the header is where an
   * owner meets an empty container they have just made.
   *
   * AN ENTRIES-LENGTH TEST WOULD HIDE THE END OF THE WALK, which is the state
   * below: a cursor past the last member answers a page with no rows over an
   * ordering that has plenty.
   */
  if (total === 0) return null;
  // `/items/<id>` is where this listing is walked, because a Container IS an
  // Item and its page is the Item page (ADR-0004, ADR-0066).
  const path: MembersPath = `/items/${itemId}`;

  return (
    <section className="mt-8" aria-labelledby="members">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="members" className="font-medium text-sm">
          Members
        </h2>
        {/*
          THE CAP IS NEVER SILENT (ADR-0119). This listing had no count at all,
          so a container of 1,049 stories rendered as an ordering of however
          many rows the page happened to carry.

          THE NOUN IS `member` BECAUSE THAT IS THE READER'S WORD FROM THIS END.
          `CONTEXT.md` bans `member` as a NAME in code -- a row here is a
          Placement -- and settles "Members" as the heading a reader sees from
          the container's end, which is the same word this sentence counts in.
          It is not `item`, either: a Repeat is one item twice, so the count
          would disagree with itself.
        */}
        {entries.length > 0 && <Holding showing={entries.length} total={total} noun="member" />}
      </div>
      {/*
        MEMBERS BEHIND IT AND NONE ON THIS PAGE, which is what a cursor makes
        possible: the link was cut at a member, and nothing is after that member
        any more. Rare, and a DEAD END if nothing says so -- the reader would
        get the heading with an empty list under it, which reads as a section
        that failed to load rather than as an ending.
      */}
      {entries.length === 0 && <PastTheEnd path={path} asked={route} />}
      <ul className="mt-2 divide-y">
        {entries.map((placement) => (
          <li key={placement.id} className="flex items-baseline justify-between gap-4 py-2">
            {/*
              A LINK CARRYING `?via=`, which is the one place on this page that
              owes one. ADR-0066 makes the query the ROUTE a reader arrived
              through, and a reader following this link IS arriving through this
              ordering -- so the item's own page can say so, and a refresh or a
              shared link keeps it. That is the difference from `AlsoAppearsIn`
              below, whose links go to the container ITSELF and therefore carry
              nothing.

              THE PLACEMENT'S ID RATHER THAN THIS CONTAINER'S, because a repeat
              is one item twice in one container: the container cannot say which
              of the two arrivals this was, and the placement is the only thing
              that can.

              AN OBJECT RATHER THAN A STRING, for the reason `FilterLink` below
              gives: Next's typed routes match a string href against the route
              patterns, and `/items/<id>?<query>` matches none of them.
            */}
            <Link
              href={{ pathname: `/items/${placement.itemId}`, query: { via: placement.id } }}
              className="hover:underline"
            >
              {placement.title ?? "Untitled item"}
            </Link>
            <span className="flex items-baseline gap-3 text-muted-foreground text-sm">
              {/*
                WHO SAYS IT SITS HERE, which is what tells a Repeat from two
                sources disagreeing (CNCORE-90). Both are one title twice at two
                positions -- ADR-0009 licences the first and ADR-0017 produces
                the second -- and nothing stored separates them, so a reader
                telling them apart is a reader reading these names: one source
                against two.

                THE SOURCES' OWN LABELS RATHER THAN "Imported", and since
                CNCORE-121 `AlsoAppearsIn` below prints them too -- beside the
                kind rather than instead of it, because that list carries a
                FILTER and the filter's four words are kinds. The two questions
                are different: how an item came to be in a container, which four
                words answer, and WHO claims this position, which they cannot --
                the disagreement a catalogue really holds is a wiki against a
                broadcaster, two providers, one word between them. This list only
                ever asked the second, so it prints only the names. `Values`
                above prints a statement's source label for the same reason.

                THE ONE THAT SPEAKS LEADS (ADR-0017), because the read path
                orders them by rank, the source order and a stable id -- the
                spokesman's own three terms. A comma is enough of a separator: a
                row naming two sources is two sources AGREEING, which is a fact
                about the placement rather than a competition.

                A PLACEMENT NOBODY ASSERTED PRINTS NOTHING rather than "nobody".
                The row is still a member and still a link; what is absent is a
                claim, and the page has no business inventing words for one.
              */}
              {placement.assertedBy.length > 0 && <span>{placement.assertedBy.join(", ")}</span>}
              {/*
                One expression rather than `#{position}`, for the reason
                `AlsoAppearsIn` gives: React server-renders a text literal beside
                an expression with a `<!-- -->` between them.

                AND AN UNPLACED MEMBER SAYS SO rather than being dropped or
                numbered last. `positionLabel` is shared with the list below, so
                the two surfaces cannot come to describe the same absence in two
                different ways -- CONTEXT.md settles the words as "no position
                given" and is binding on UI copy.
              */}
              <span>{positionLabel(placement.position)}</span>
              {/*
                NO CONFIRMATION IN FRONT OF IT, WHICH IS ADR-0046's RULE rather
                than an omission: removing a placement is the most frequent
                editing act in a product built on multi-placement, and NN/g's
                "do not use confirmation dialogs for routine actions" is cited
                there because a heavyweight prompt on the common action is what
                teaches people to dismiss the dangerous one unread. What it gets
                instead is the undo above.

                IT NAMES THE PLACEMENT, never the item (ADR-0061). A Repeat is
                one item twice in one container, so "remove this item from that
                container" cannot say which row the owner pressed.
              */}
              {owner && <RemovePlacement placementId={placement.id} containerId={itemId} />}
            </span>
          </li>
        ))}
      </ul>
      {/*
        HOW A READER REACHES THE REST OF IT (ADR-0119), and the same component
        the catalogue, work-browsing and Catalogue search walk with -- so the
        rule that every page past the first carries a way back to the start is
        written once rather than four times.

        IT CARRIES `route` FORWARD, so walking this ordering does not lose the
        `?via=` a reader arrived through or the origin they narrowed to. The
        cursor goes last of the three, which is ADR-0066's fixed spelling order
        with a third parameter appended rather than inserted.

        AND IT IS GATED ON THERE BEING ROWS, exactly as `/` and `/works` gate
        theirs -- which review of CNCORE-89 found this was not. Past the end of
        the walk BOTH this and `PastTheEnd` above render, and both offer "Back
        to the start": the reader met the same link twice, either side of an
        empty list. The notice owns that page, so the walk stands down on it.
      */}
      {entries.length > 0 && (
        <Walk path={path} asked={route} from={from} continuesAfter={continuesAfter} />
      )}
    </section>
  );
}

/**
 * THE ITEM PAGE'S NON-IDENTIFYING PARAMETERS, in ONE fixed spelling order.
 *
 * ADR-0066 declares `?via=` and `?placed=` non-identifying and writes them
 * "in a fixed order -- `via` then `placed` -- so one narrowed list is one URL
 * rather than two spellings of it". A cursor is the third, and it is appended
 * rather than inserted: re-ordering the existing pair would give every link
 * already emitted a second spelling, which is the one thing a fixed order
 * exists to prevent.
 *
 * WRITTEN ONCE BECAUSE TWO SURFACES ON THIS PAGE EMIT IT -- the walk below the
 * Members list, and every chip of the "Also appears in" filter. The order held
 * by two copies is the order that drifts.
 *
 * A KEY IS ABSENT RATHER THAN EMPTY where there is no value. Next turns an
 * `undefined` query value into an empty parameter, so an object carrying all
 * three keys unconditionally would emit `?via=&placed=&after=` on the plainest
 * address this page has.
 */
function theRoute(arrivedThrough?: string, showingOnly?: string): TheRoute {
  const route: TheRoute = {};
  if (arrivedThrough) route.via = arrivedThrough;
  if (showingOnly) route.placed = showingOnly;
  return route;
}

/**
 * Every ordering this item sits in, at once (ADR-0009). The product's central
 * claim, and the thing no incumbent can express: a `series_index` on the item
 * itself holds one of these and locks the reader out of the rest forever.
 */
function AlsoAppearsIn({
  itemId,
  placements,
  arrivedThrough,
  showingOnly,
  from,
}: {
  itemId: string;
  placements: ItemOnThePage["placements"];
  /**
   * The placement `?via=` named, if it named one of this item's. A stale or
   * foreign id simply matches nothing: the query identifies nothing, so it can
   * neither change which item is served nor fail a page that exists.
   */
  arrivedThrough?: string;
  /** The origin the reader has narrowed to, if any. */
  showingOnly?: string;
  /**
   * The Members cursor, which these chips carry FORWARD rather than drop.
   *
   * The two listings on this page are independent -- `placed` narrows this one
   * and `after` walks the one above -- so a reader deep in an ordering who
   * narrows this list would otherwise be sent back to the ordering's first page
   * by a chip that has nothing to do with it.
   */
  from?: string;
}) {
  if (placements.length === 0) return null;

  // Read off the data rather than written down: an origin nothing arrived by is
  // not offered, and the day a provider's browse writes placements the chip for
  // it appears without anyone adding it.
  const origins = [...new Set(placements.map((p) => p.placedBy).filter((by) => by !== null))];
  const showing = placements.filter((p) => !showingOnly || p.placedBy === showingOnly);

  return (
    <section className="mt-8" aria-labelledby="also-appears-in">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="also-appears-in" className="font-medium text-sm">
          Also appears in
        </h2>
        {/*
          A FILTER RATHER THAN A SPLIT LAYOUT. A container the owner filled by
          hand and one a provider imported are the same kind of fact -- they
          differ by who asserted them (ADR-0017) and by nothing else -- so two
          sections would tell the reader they are two kinds of thing.

          Links rather than a control, so the whole thing works server-side and
          a narrowed list is a URL somebody can send, the same argument ADR-0066
          makes for `?via=`.
        */}
        <nav aria-label="Filter by how it was placed" className="flex gap-3 text-sm">
          <FilterLink
            itemId={itemId}
            arrivedThrough={arrivedThrough}
            showingOnly={showingOnly}
            from={from}
          >
            All
          </FilterLink>
          {origins.map((origin) => (
            <FilterLink
              key={origin}
              itemId={itemId}
              arrivedThrough={arrivedThrough}
              showingOnly={showingOnly}
              origin={origin}
              from={from}
            >
              {placedByLabel(origin)}
            </FilterLink>
          ))}
        </nav>
      </div>
      <ul className="mt-2 divide-y">
        {showing.map((placement) => (
          <li
            key={placement.id}
            aria-current={placement.id === arrivedThrough ? "true" : undefined}
            className="flex items-baseline justify-between gap-4 py-2"
          >
            {/*
              A plain link to the container, and deliberately NOT one carrying
              `?via=` (ADR-0066). The query says which ordering the reader
              arrived through to reach the item AT THE PATH, and a reader
              following this link is arriving at the container itself.
            */}
            <Link href={`/items/${placement.containerId}`} className="hover:underline">
              {placement.containerTitle ?? "Untitled container"}
            </Link>
            {/*
              One expression rather than `#{position}`. React server-renders a
              text literal next to an expression with a `<!-- -->` separator
              between them, so the two would arrive at the reader as `#` and
              `63` with a comment in the middle -- invisible on the page, and
              unfindable to anything reading the HTML.
            */}
            <span className="flex items-baseline gap-3 text-muted-foreground text-sm">
              {placement.id === arrivedThrough && <span>Arrived through</span>}
              {placement.placedBy && <span>{placedByLabel(placement.placedBy)}</span>}
              {/*
                WHO SAYS SO, BESIDE WHAT SORT OF THING SAID IT (CNCORE-121).
                This list shows one container TWICE at two positions for two
                different reasons -- a Repeat, which is one source placing it
                twice on purpose (ADR-0009), and a disagreement, which is two
                sources claiming different positions for one membership
                (ADR-0017). Nothing stored separates them, and the kind beside
                this cannot: the disagreement this catalogue actually holds is
                the wiki's series against TMDB's season, so `placedBy` prints
                "Imported" on both rows and the reader is back where they
                started. The names are what tell them apart.

                BOTH, RATHER THAN THE NAMES INSTEAD OF THE KIND. They answer
                different questions -- how the item came to be in there, and who
                claims it -- and the chips above filter on the kind, whose four
                words ADR-0017 settles. A row reading "Imported" and then its
                provider's own name is the same pairing the Values section makes.

                AND TWO NAMES ON ONE ROW ARE CORROBORATION, which is ADR-0017's
                other named gap closed from this end: sources agreeing land on
                ONE placement carrying a source each, so two providers backing an
                ordering were a single row indistinguishable from one provider
                asserting it. A comma is enough of a separator -- agreeing is a
                fact about the placement rather than a competition -- and the one
                that SPEAKS leads, the read path having ordered them by rank, the
                source order and a stable id.

                A PLACEMENT NOBODY ASSERTED PRINTS NOTHING rather than "nobody",
                exactly as the Members list above does. What is absent is a
                claim, and the page has no business inventing words for one.
              */}
              {placement.assertedBy.length > 0 && <span>{placement.assertedBy.join(", ")}</span>}
              <span>{positionLabel(placement.position)}</span>
            </span>
          </li>
        ))}
      </ul>
      {showing.length === 0 && (
        <p className="mt-2 text-muted-foreground text-sm">
          Nothing placed that way. The whole list is under All.
        </p>
      )}
    </section>
  );
}

/**
 * One chip of the filter. It carries `?via=` forward, so narrowing the list does
 * not lose the ordering the reader arrived through, and the Members cursor with
 * it -- all three in the fixed order `theRoute` holds (ADR-0066).
 */
function FilterLink({
  itemId,
  arrivedThrough,
  showingOnly,
  origin,
  from,
  children,
}: {
  itemId: string;
  arrivedThrough?: string;
  showingOnly?: string;
  origin?: string;
  from?: string;
  children: React.ReactNode;
}) {
  // An object rather than a string: Next's typed routes match a string href
  // against the route patterns, and `/items/<id>?<query>` matches none of them.
  // The query keeps insertion order through to the URL, which is what holds the
  // three parameters in one fixed order.
  //
  // `origin` RATHER THAN `showingOnly` IS WHAT THIS CHIP NARROWS TO: the chip
  // for an origin points AT it, and the `All` chip has none and therefore drops
  // `placed` -- which is what makes it All.
  const query: Record<string, string> = { ...theRoute(arrivedThrough, origin) };
  if (from) query.after = from;

  return (
    <Link
      href={{ pathname: `/items/${itemId}`, query }}
      aria-current={showingOnly === origin ? "true" : undefined}
      className="hover:underline aria-[current]:font-medium"
    >
      {children}
    </Link>
  );
}

/**
 * THE OWNER'S JUDGEMENT BEATING THE RANKING (ADR-0025), as a form.
 *
 * IT WRITES A STATEMENT rather than the column. `items.title` is a projection
 * of whichever title statement currently wins (ADR-0014), so the edit below is
 * a claim with the owner's name on it -- which is why the Values list under it
 * gains a row sourced to Owner rather than silently changing the provider's.
 * Jellyfin cannot express this: its merge discards the losing answer, so there
 * is nothing for the owner's edit to outrank (ADR-0026).
 *
 * THE FIELD OPENS ON THE CURRENT TITLE, because this is an EDIT. An owner
 * correcting one word should not have to retype the sentence, and a blank field
 * beside a heading that shows a title reads as "add another" rather than
 * "change this".
 *
 * `defaultValue` RATHER THAN `value`, which is what keeps this working with no
 * script: a controlled input needs an `onChange` handler and therefore a client
 * component, and the whole surface is asserted at a seam with no browser.
 *
 * THE ITEM'S ID TRAVELS AS A HIDDEN FIELD rather than being read from the URL
 * in the action. A Server Action gets no request URL -- it is a function call,
 * not a route -- so the subject has to be in the form. It is input like any
 * other and the procedure treats it as such.
 */
function EditTitle({ itemId, title }: { itemId: string; title: string | null }) {
  return (
    <section className="mt-8" aria-labelledby="edit-title">
      <h2 id="edit-title" className="font-medium text-sm">
        Title
      </h2>
      <form action={retitleItem} className="mt-2 flex items-end gap-2">
        <input type="hidden" name="id" value={itemId} />
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="title" className="sr-only">
            Title
          </Label>
          {/*
            `title ?? ""` IS AN ITEM WITH NO TITLE STATEMENT, which is a real
            state rather than a defensive default: ADR-0003 lets an item exist
            with nothing said about it, and the heading above renders "Untitled
            item" for one. The field is what an owner fixes that in.
          */}
          <Input id="title" name="title" defaultValue={title ?? ""} required autoComplete="off" />
        </div>
        <Button type="submit">Save</Button>
      </form>
    </section>
  );
}

/**
 * THE OWNER'S OWN WORDS ABOUT AN ITEM (ADR-0096), and the one section of this
 * page a visitor never sees.
 *
 * A NOTE IS A STATEMENT, which is that record's decision and is why this looks
 * like the Values list rather than like a comment box: what the owner wrote,
 * and the source it is filed under, beside each other. `CONTEXT.md` calls a
 * note "the owner's own free text about an item. Theirs alone: nothing else can
 * assert one" -- and the page says whose it is by READING the source off the
 * row rather than printing the word for itself, which is what makes it
 * distinguishable from a provider's claim by the same means every other value
 * on this page is.
 *
 * IT IS NOT IN THE VALUES LIST, and that is ADR-0045 rather than a layout
 * choice: that list is `itemPublic.statements`, which every visitor is served.
 * A note on it would be published by construction.
 *
 * ONE FORM FOR WRITING, EDITING AND REMOVING. The field opens on the note the
 * item already has, so correcting a sentence does not mean retyping the
 * paragraph -- and clearing it and saving is the removal (ADR-0096).
 *
 * A `<textarea>` RATHER THAN AN `<input>`, because a note is prose and an owner
 * writing about an item writes sentences. `defaultValue` keeps it working with
 * no script, for the reason `EditTitle` gives: a controlled field needs an
 * `onChange` and therefore a client component.
 */
function Note({ itemId, note }: { itemId: string; note: NoteOnThePage }) {
  return (
    <section className="mt-8" aria-labelledby="note">
      <h2 id="note" className="font-medium text-sm">
        Note
      </h2>
      {note && (
        <p data-note className="mt-2 flex items-baseline justify-between gap-4 py-2">
          {/*
            `whitespace-pre-wrap` BECAUSE THE OWNER'S LINE BREAKS ARE THEIRS. A
            note is written in a textarea, so a paragraph break is something the
            owner typed on purpose and HTML would otherwise collapse it.
          */}
          <span className="whitespace-pre-wrap">{note.value}</span>
          {/*
            The source's own LABEL rather than its kind, exactly as the Values
            list prints one: "who asserted this" is answered by `Owner`, where
            `owner` answers only what sort of thing said it.
          */}
          <span className="text-muted-foreground text-sm">{note.sourceLabel}</span>
        </p>
      )}
      <form action={annotateItem} className="mt-2 flex flex-col items-start gap-2">
        <input type="hidden" name="id" value={itemId} />
        <Label htmlFor="note-text" className="sr-only">
          Note
        </Label>
        {/*
          NOT `id="note"`, WHICH THE HEADING ABOVE ALREADY HOLDS. `aria-labelledby`
          on the section points at that heading, and two elements sharing one id
          make the document invalid and the reference ambiguous.

          NOT `required`, WHERE THE TITLE FIELD IS. An empty note is a real
          submission here -- it is how the owner removes one -- so a browser
          refusing to submit the empty form would take the removal away.
        */}
        <Textarea
          id="note-text"
          name="note"
          defaultValue={note?.value ?? ""}
          rows={3}
          className="w-full"
          autoComplete="off"
        />
        <Button type="submit">Save</Button>
      </form>
    </section>
  );
}

/**
 * PUTTING AN ITEM IN THIS CONTAINER, and offering back the one just taken out.
 *
 * ON THE CONTAINER'S PAGE, because a Container IS an Item (ADR-0004) and its
 * page is the Item page -- so the place a reader meets an ordering is the place
 * its owner curates it. ADR-0061 is why it belongs here rather than on the
 * item's end: every container owns its membership outright, so this list is
 * this container's to change and nothing else's.
 *
 * THE ITEMS COME FROM THE CATALOGUE LISTING THAT ALREADY EXISTS, capped by
 * ADR-0119 like every other listing -- rather than a new read that would be a
 * second answer to "what is in this catalogue". The cap is named to the owner
 * rather than left silent, which is that record's rule: a picker that quietly
 * showed the first hundred of a thousand would be the listing lying about its
 * own extent.
 */
async function PlaceAnItem({
  containerId,
  undone,
  refused,
  context,
}: {
  containerId: string;
  undone?: string;
  /** The item a placement was just refused for, if one was (ADR-0116). */
  refused?: string;
  context: Context;
}) {
  /*
   * THE CALLER'S OWN CONTEXT, not a second one built here. The page's own
   * comment says why: two calls to `callerContext` would be two answers to
   * "what does this request carry". The listing itself is open (ADR-0044) --
   * what makes this section the owner's is that the page renders it only for
   * them, which is the same posture `Note` and `EditTitle` take.
   */
  const { entries, total } = await call(appRouter.catalogue.list, {}, { context });

  return (
    <section className="mt-8" aria-labelledby="place-an-item">
      <h2 id="place-an-item" className="font-medium text-sm">
        Place an item here
      </h2>
      {/*
        THE UNDO ADR-0046 REQUIRES, ABOVE THE FORM AND NOT IN A DIALOG. It is
        offered only when a removal just happened, which `?undo=` is how a page
        with no script gets told.
      */}
      {undone && <UndoRemoval placementId={undone} containerId={containerId} />}
      {/*
        WHAT THE CATALOGUE WOULD NOT DO, in the reader's words. ADR-0009 licences
        a Repeat at DIFFERENT positions, so the refusal is usually about the
        POSITION rather than about placing the item twice -- and saying so is the
        difference between a rule an owner can work with and a wall.

        IT NAMES BOTH REASONS, BECAUSE `BAD_REQUEST` CARRIES BOTH. Review found
        this asserting the first one alone while `PLACEMENT_REFUSALS` also holds
        `23503` -- an item or container that is not there -- so an owner whose
        item had since been deleted was told it was already placed, which is a
        false reason rather than a vague one. The router's own message says both;
        this is that message in the reader's words.
      */}
      {refused && (
        <p className="mt-2 text-sm text-destructive">
          Nothing was placed. That item is either already here at that position, in which case a
          Repeat is allowed at a different one, or it is no longer in the catalogue.
        </p>
      )}
      <form action={placeItemInContainer} className="mt-2 flex items-end gap-2">
        <input type="hidden" name="containerId" value={containerId} />
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="itemId">Item</Label>
          {/*
            A `<select>` RATHER THAN AN ID TYPED IN, because an owner curating an
            ordering knows what they want to add by its NAME. It needs no script:
            a select posts its chosen option as an ordinary field, which is the
            same constraint `/new` meets the same way.

            THE SAME METRICS AS `packages/ui`'s `Input`, which stands beside it
            in this row: `h-8`, `px-2.5`, `text-xs`, `ring-1`. This wore stock
            shadcn's `h-9 rounded-md text-sm` until review caught it, and that is
            precisely the step-taller-and-larger mismatch `/new` records against
            the Title field -- `.claude/rules/frontend.md`, "Ported code is where
            this slips". There is still no select in `packages/ui` to import, so
            the identity is carried by matching its sibling.
          */}
          <select
            id="itemId"
            name="itemId"
            required
            className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 md:text-xs dark:bg-input/30"
          >
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title ?? "Untitled item"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="position">Position</Label>
          {/*
            NOT `required`, AND THAT IS THE WHOLE OF CONTEXT.md's Unplaced. An
            owner may say "this belongs in here" without claiming where, and an
            empty field is how they say it -- the action reads `""` as no
            position rather than as a number it failed to parse.
          */}
          <Input
            id="position"
            name="position"
            type="number"
            step="1"
            autoComplete="off"
            className="w-28"
          />
        </div>
        <Button type="submit">Place</Button>
      </form>
      {/*
        THE CAP IS NEVER SILENT (ADR-0119). A picker offering the first hundred
        items of a larger catalogue has to say so, or an owner who cannot find
        what they are looking for reads it as the item not existing.
      */}
      {entries.length < total && (
        <p className="mt-2 text-muted-foreground text-sm">
          Showing {entries.length} of {total} items. Search for one to place it from its own page.
        </p>
      )}
    </section>
  );
}

/**
 * TAKING ONE MEMBER OUT, as a form naming the PLACEMENT (ADR-0061).
 *
 * IT CARRIES THE CONTAINER TOO, because the action redirects back to it with
 * the undo offer -- and a Server Action gets no request URL, so anything it
 * needs has to be in the form.
 */
function RemovePlacement({
  placementId,
  containerId,
}: {
  placementId: string;
  containerId: string;
}) {
  return (
    <form action={removePlacement}>
      <input type="hidden" name="id" value={placementId} />
      <input type="hidden" name="containerId" value={containerId} />
      <Button type="submit" variant="ghost" size="sm">
        Remove
      </Button>
    </form>
  );
}

/**
 * THE OFFER BACK (ADR-0046), which is what a removal gets instead of a
 * confirmation.
 *
 * THE PLACEMENT RETURNS WITH ITS POSITION AND ITS ORIGIN, because the removal
 * tombstoned only the placement: every source that ever stood behind it was
 * left standing, so there is nothing here to reconstruct (ADR-0017).
 */
function UndoRemoval({ placementId, containerId }: { placementId: string; containerId: string }) {
  return (
    <form action={restorePlacement} className="mt-2 flex items-baseline gap-3">
      <input type="hidden" name="id" value={placementId} />
      <input type="hidden" name="containerId" value={containerId} />
      <p className="text-muted-foreground text-sm">Removed from this container.</p>
      <Button type="submit" variant="outline" size="sm">
        Undo
      </Button>
    </form>
  );
}
