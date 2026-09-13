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
import { Fragment } from "react";
import { Attribution } from "@/components/attribution";
import { Holding, type MembersPath, PastTheEnd, type TheRoute, Walk } from "@/components/listing";
import { type Reorder, reorderedTo } from "@/components/ordering";
import { oneValue } from "@/components/query-params";
import { SortableMembers } from "@/components/sortable-members";
import { callerContext } from "@/session";

import {
  annotateItem,
  movePlacement,
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
  {
    placed,
    after,
    placedAfter,
    context,
  }: { placed?: string; after?: string; placedAfter?: string; context?: Context } = {},
) {
  const { error, data } = await safe(
    call(
      appRouter.item.get,
      { id, placed, after, placedAfter },
      { context: context ?? (await createContext()) },
    ),
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

/**
 * Every source standing behind one placement, named (ADR-0017).
 *
 * ONE COMPONENT FOR BOTH LISTS, because how a SET of claims reads is one rule
 * and the two lists that render it -- Members from the container's end, "Also
 * appears in" from the item's -- had a byte-identical copy each. Why each list
 * names sources at all differs and stays at each site; this is the part that
 * must not drift, which is the same argument `placements.ts` makes about
 * `isRefusalOn`: shared because they must not diverge, not merely because it is
 * one line twice.
 *
 * THE ONE THAT SPEAKS LEADS, because the read path ordered them by rank, the
 * one global source order and a stable id before they got here -- the
 * spokesman's own three terms. This renders that order and does not re-derive
 * it.
 *
 * A ROW NAMING TWO SOURCES IS TWO SOURCES AGREEING, which is a fact about the
 * placement rather than a competition.
 *
 * SO EACH NAME IS AN ELEMENT, AND WHAT SITS BETWEEN THEM IS LAYOUT (CNCORE-128).
 * They were joined with `", "`, and a label is a provider's own `name` off its
 * manifest -- so one calling itself `Acme, Inc.` read as two names where there
 * is one, which is corroboration forged. Why no separating CHARACTER can be
 * trusted, and exactly how far the gap can, is ADR-0017's CNCORE-128 section.
 *
 * THE SAME GAP THE ROW ALREADY PUTS BETWEEN ITS FACTS, rather than a second
 * spacing rule: both call sites lay their row out as `flex items-baseline
 * gap-3`, which is what separates "Imported" from the names and the names from
 * `#2`. Held here rather than inherited from either parent, so the component
 * owns how a SET reads wherever it is rendered.
 *
 * NOTHING FOR A PLACEMENT NOBODY ASSERTED, rather than the word "nobody". The
 * row is still a placement and still a link; what is absent is a claim, and the
 * page has no business inventing words for one.
 */
function AssertedBy({ sources }: { sources: string[] }) {
  if (sources.length === 0) return null;
  return (
    <span className="flex items-baseline gap-3">
      {sources.map((source, place) => (
        /*
         * KEYED BY PLACE, BECAUSE A NAME IS NOT AN IDENTITY. Sources are unique
         * on their identity and not their label, so two providers can call
         * themselves the same thing and both stand behind one row -- and keyed
         * by name, those are two siblings with one key. The read path carries
         * no source id to key by instead (ADR-0045), and place is safe here:
         * these spans hold no state, so a place that names a different source
         * after a refresh has nothing to carry across to the wrong one.
         */
        <span data-source key={place}>
          {source}
        </span>
      ))}
    </span>
  );
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
    placedAfter?: string | string[];
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
  const { via, placed, after, placedAfter, undo, refused } = await searchParams;
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
   * AND "ALSO APPEARS IN"'S OWN (CNCORE-125). TWO CURSORS ON ONE ADDRESS,
   * because a Container IS an Item (ADR-0004) and one page therefore carries
   * two independent listings: what this item HOLDS, and every ordering it SITS
   * IN. Neither may move the other, which is why the second has a name rather
   * than being a second `after` -- `listing.tsx`'s `CURSOR` has the argument.
   */
  const appearingFrom = oneValue(placedAfter);
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

  /*
   * THE NARROWING GOES TO THE READ PATH (CNCORE-129), where it used to be
   * applied to the rows that came back. The listing answered is the narrow one,
   * so its size, its cap and its walk are the narrowing's own -- and the chips
   * ride back beside it, because they are the one thing narrowing must not
   * change.
   */
  const item = await readItem(id, {
    placed: showingOnly,
    after: from,
    placedAfter: appearingFrom,
    context,
  });
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
        route={theRoute({ arrivedThrough, showingOnly, appearingFrom })}
        owner={owner}
        from={from}
      />
      <AlsoAppearsIn
        itemId={item.id}
        placements={item.placements}
        arrivedThrough={arrivedThrough}
        showingOnly={showingOnly}
        from={from}
        appearingFrom={appearingFrom}
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
  const { rows, total, continuesAfter } = holds;
  /*
   * NOTHING AT ALL FOR AN ITEM THAT HOLDS NOTHING, which is `total` rather than
   * `rows.length`: an item that is not a container and an empty container
   * both hold none, and both rendered nothing before this listing was capped.
   * The two are deliberately not told apart here -- ADR-0004's fold is what
   * `isContainer` above carries, and the `Holds` row in the header is where an
   * owner meets an empty container they have just made.
   *
   * A ROWS-LENGTH TEST WOULD HIDE THE END OF THE WALK, which is the state
   * below: a cursor past the last member answers a page with no rows over an
   * ordering that has plenty.
   */
  if (total === 0) return null;
  // `/items/<id>` is where this listing is walked, because a Container IS an
  // Item and its page is the Item page (ADR-0004, ADR-0066).
  const path: MembersPath = `/items/${itemId}`;

  /*
    WHAT EACH ROW SAYS, RENDERED ONCE (CNCORE-73). The list below is wrapped two
    ways -- sortable for an owner, plain for a visitor -- and a row built twice
    is a row the two wrappers would drift apart on.

    THE POSITION TRAVELS WITH IT, because the sortable list needs it to compute
    what a drop does (ADR-0116) and only this scope has read it.
  */
  const renderedRows = rows.map((placement, index) => ({
    id: placement.id,
    position: placement.position,
    content: (
      <>
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
        {/*
              `ml-auto` RATHER THAN `justify-between` ON THE ROW, because the row
              gained a third child: an owner's rows lead with a drag handle, and
              `justify-between` over three children spreads the title into the
              middle of the line. The trailing group taking the space itself is
              the same layout for two children and for three, which is what lets
              the sortable and the plain wrapper share one row (CNCORE-73).
            */}
        <span className="ml-auto flex items-baseline gap-3 text-muted-foreground text-sm">
          {/*
                WHO SAYS IT SITS HERE, which is what tells a Repeat from two
                sources disagreeing (CNCORE-90). Both are one title twice at two
                positions -- ADR-0009 licences the first and ADR-0017 produces
                the second -- and nothing stored separates them, so a reader
                telling them apart is a reader reading these names: one source
                against two.

                AND ONLY THE NAMES HERE, where `AlsoAppearsIn` below prints them
                beside a kind. That list carries a FILTER whose four words are
                kinds; this one asks only WHO claims this position, which a kind
                cannot answer -- the disagreement a catalogue really holds is a
                wiki against a broadcaster, two providers, one word between them.
                `Values` above prints a statement's source label for the same
                reason.
              */}
          <AssertedBy sources={placement.assertedBy} />
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
          {/*
                THE VISIBLE PATH TO THE DRAG (CNCORE-73). `CLAUDE.md` requires
                every keyboard accelerator to have an equivalent visible UI
                path, and a sortable list is the case that bites: a keyboard
                sensor makes the surface operable and these make it visible.
                They are also the WHOLE capability with no script loaded, which
                is why the page seam can assert reordering without a browser.

                THE FORM CARRIES THE DELTA (ADR-0116), computed here because
                here is where the ordering is. A reorder writes the placement
                that moved and the siblings whose Position actually changed,
                never the rebuilt list.

                NOTHING AT THE ENDS. `reorderedTo` answers null for a landing a
                placement already occupies, so the first row renders no Move up
                and the last no Move down -- a control that cannot do anything
                reads as broken rather than as the end of the list.
              */}
          {owner && (
            <MoveTo
              containerId={itemId}
              to={reorderedTo(rows, placement.id, index - 1)}
              label="Move up"
            />
          )}
          {owner && (
            <MoveTo
              containerId={itemId}
              to={reorderedTo(rows, placement.id, index + 1)}
              label="Move down"
            />
          )}
          {owner && <RemovePlacement placementId={placement.id} containerId={itemId} />}
        </span>
      </>
    ),
  }));

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
        {rows.length > 0 && <Holding showing={rows.length} total={total} noun="member" />}
      </div>
      {/*
        MEMBERS BEHIND IT AND NONE ON THIS PAGE, which is what a cursor makes
        possible: the link was cut at a member, and nothing is after that member
        any more. Rare, and a DEAD END if nothing says so -- the reader would
        get the heading with an empty list under it, which reads as a section
        that failed to load rather than as an ending.
      */}
      {rows.length === 0 && <PastTheEnd path={path} listing="members" asked={route} />}
      {/*
        TWO WRAPPERS, ONE ROW. A visitor gets a plain `<ul>` and no drag code at
        all; an owner gets the sortable list, which is the accelerator on top of
        the Move controls the row already carries (CNCORE-73). What each row
        SAYS is rendered here either way -- its link, its sources, its position
        and its forms -- so the read path, `?via=` and the Server Actions are
        the same markup for both, and only the ordering is a client concern.
      */}
      {owner ? (
        <SortableMembers containerId={itemId} rows={renderedRows} />
      ) : (
        <ul className="mt-2 divide-y">
          {renderedRows.map((row) => (
            <li key={row.id} className="flex items-baseline gap-4 py-2">
              {row.content}
            </li>
          ))}
        </ul>
      )}{" "}
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
      {rows.length > 0 && (
        <Walk
          path={path}
          listing="members"
          asked={route}
          from={from}
          continuesAfter={continuesAfter}
        />
      )}
    </section>
  );
}

/**
 * THE ITEM PAGE'S NON-IDENTIFYING PARAMETERS, in ONE fixed spelling order.
 *
 * ADR-0066 declares `?via=` and `?placed=` non-identifying and writes them
 * "in a fixed order -- `via` then `placed` -- so one narrowed list is one URL
 * rather than two spellings of it". A cursor is appended rather than inserted:
 * re-ordering the pair already out there would give every link already emitted a
 * second spelling, which is the one thing a fixed order exists to prevent.
 *
 * SO THE ORDER IS `via`, `placed`, `after`, `placedAfter`, and this function
 * holds the first three. The fourth is appended by `Walk`, which is where the
 * listing being walked is known.
 *
 * WRITTEN ONCE BECAUSE THREE SURFACES ON THIS PAGE EMIT IT -- the walk below
 * the Members list, the walk below "Also appears in", and every chip of that
 * list's filter. The order held by three copies is the order that drifts.
 *
 * A KEY IS ABSENT RATHER THAN EMPTY where there is no value. Next turns an
 * `undefined` query value into an empty parameter, so an object carrying every
 * key unconditionally would emit `?via=&placed=&after=` on the plainest address
 * this page has.
 */
function theRoute({
  arrivedThrough,
  showingOnly,
  from,
  appearingFrom,
}: {
  arrivedThrough?: string;
  showingOnly?: string;
  /**
   * THE TWO CURSORS, and a caller passes the ones its own links must CARRY.
   *
   * The two listings on this page are independent, so a link that walks or
   * narrows one must not send a reader deep in the other back to its first page.
   * Each walk passes BOTH: `Walk` owns which of the two is its own, setting it
   * where the link goes and dropping it for a `Back to the start`, so neither
   * caller has to remember which cursor it is holding.
   *
   * A CHIP PASSES ONLY `from`, which is the one asymmetry here and is argued at
   * `FilterLink`: narrowing changes what "Also appears in" is ASKING, so its
   * cursor names a place in the listing being left.
   */
  from?: string;
  appearingFrom?: string;
}): TheRoute {
  const route: TheRoute = {};
  if (arrivedThrough) route.via = arrivedThrough;
  if (showingOnly) route.placed = showingOnly;
  if (from) route.after = from;
  if (appearingFrom) route.placedAfter = appearingFrom;
  return route;
}

/**
 * Every ordering this item sits in, at once (ADR-0009). The product's central
 * claim, and the thing no incumbent can express: a `series_index` on the item
 * itself holds one of these and locks the reader out of the rest forever.
 *
 * CAPPED, COUNTED AND WALKED SINCE CNCORE-125, and it was the LAST listing in
 * the app to be none of those. ADR-0119's first sentence is "every listing in
 * CanonCore is capped", and the count matters more here than anywhere: a page
 * reporting a hundred orderings over three hundred would understate exactly the
 * claim this section exists to make.
 */
function AlsoAppearsIn({
  itemId,
  placements,
  arrivedThrough,
  showingOnly,
  from,
  appearingFrom,
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
   * The Members cursor, which this section's links carry FORWARD rather than
   * drop.
   *
   * The two listings on this page are independent, so a reader deep in a
   * container's ordering who narrows or walks this one would otherwise be sent
   * back to that ordering's first page by a link that has nothing to do with it.
   */
  from?: string;
  /** This listing's OWN cursor, if the page was asked with one. */
  appearingFrom?: string;
}) {
  const { rows, total, continuesAfter, everyPlacedBy } = placements;
  /*
   * NOTHING AT ALL FOR AN ITEM IN NO ORDERING, which is `total` rather than
   * `rows.length` for the reason `Members` above gives: a rows-length
   * test would hide the END of the walk, where a cursor past the last ordering
   * answers a page with no rows over a list that has plenty.
   *
   * AND THE ORIGINS BESIDE IT SINCE CNCORE-129, because `total` is the size of
   * the NARROWED listing now: narrowed to an origin the item has nothing from it
   * is zero over a list with plenty in it, and a section that vanished there
   * would take the way back to All with it. The origins are the listing's own
   * whatever it was narrowed to, so they are what says the section belongs on
   * this page at all.
   *
   * THE ONE ITEM BOTH MISS is one whose every ordering is a placement NO SOURCE
   * STANDS BEHIND, narrowed by hand to some origin: it has orderings and no
   * origins, so this hides the section -- and the page without `?placed=` would
   * SHOW it, so that reader is stranded exactly as this ticket describes. It is
   * left, because nothing in the app can make that item: `assertPlacement` writes
   * a source with every placement it writes, a withdrawal tombstones the
   * placement its last source leaves (ADR-0075), and a purge deletes the ones it
   * orphans. The fixture's source-less row is written by hand for the walk's
   * keyless block, and the item it sits on has other origins.
   *
   * AND THE OBVIOUS FIX COSTS A REAL CASE FOR THAT ONE. Gating on the narrowing
   * too -- render whenever `?placed=` is present -- would give an item in NO
   * ordering an "Also appears in" section on any address somebody typed a
   * `placed` onto, which is a non-identifying parameter changing the page when it
   * names nothing (ADR-0066). Telling the two apart needs the unnarrowed size as
   * well, which is a field for an item the app cannot produce.
   */
  if (total === 0 && everyPlacedBy.length === 0) return null;

  // `/items/<id>` is where this listing is walked, for the same reason the
  // Members list is: a Container IS an Item and this is the item's own page.
  const path: MembersPath = `/items/${itemId}`;
  const route = theRoute({ arrivedThrough, showingOnly, from, appearingFrom });

  return (
    <section className="mt-8" aria-labelledby="also-appears-in">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="also-appears-in" className="font-medium text-sm">
          Also appears in
        </h2>
        {/*
          THE CAP IS NEVER SILENT (ADR-0119). This listing had no count at all,
          so an item in three hundred orderings rendered as however many rows the
          page happened to carry -- and multi-placement is the product's central
          claim, so that is the one count it could least afford to get wrong.

          THE NOUN IS `ordering` BECAUSE THAT IS THE GLOSSARY'S OWN WORD FROM
          THIS END. `CONTEXT.md` defines Multi-placement as "one item sitting in
          several orderings at once", and its Placement entry says the same
          construct is "an ordering it sits in" from the item's end and something
          the container "holds" from the other. It is not `container`, either: a
          Repeat is one item twice in ONE ordering, so counting containers would
          make the count disagree with the rows under it.

          AND SINCE CNCORE-129 THE NARROWING IS PART OF THE LISTING, so this one
          count serves both: narrowed, it is the size of the narrowing, its cap
          and its walk. It sat above the chips while it could only describe the
          unnarrowed list and a second notice below carried what the chips did to
          it; there is one number now, and it is the one the reader is looking at.
        */}
        {rows.length > 0 && <Holding showing={rows.length} total={total} noun="ordering" />}
      </div>
      {/*
        A FILTER RATHER THAN A SPLIT LAYOUT. A container the owner filled by
        hand and one a provider imported are the same kind of fact -- they
        differ by who asserted them (ADR-0017) and by nothing else -- so two
        sections would tell the reader they are two kinds of thing.

        Links rather than a control, so the whole thing works server-side and
        a narrowed list is a URL somebody can send, the same argument ADR-0066
        makes for `?via=`.
      */}
      <nav aria-label="Filter by how it was placed" className="mt-2 flex gap-3 text-sm">
        <FilterLink
          itemId={itemId}
          arrivedThrough={arrivedThrough}
          showingOnly={showingOnly}
          from={from}
        >
          All
        </FilterLink>
        {everyPlacedBy.map((origin) => (
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
      {/*
        ORDERINGS BEHIND IT AND NONE ON THIS PAGE, which is what a cursor makes
        possible: the link was cut at an ordering, and nothing sorts after that
        ordering any more. A DEAD END if nothing says so -- the reader would get
        the heading with an empty list under it, which reads as a section that
        failed to load rather than as an ending.
      */}
      {rows.length === 0 && total > 0 && (
        <PastTheEnd path={path} listing="appearances" asked={route} />
      )}
      <ul className="mt-2 divide-y">
        {rows.map((placement) => (
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
                words ADR-0017 settles. Dropping it to save a word would delete
                the filter's only input.

                AND TWO NAMES ON ONE ROW ARE CORROBORATION, which is ADR-0017's
                other named gap closed from this end: sources agreeing land on
                ONE placement carrying a source each, so two providers backing an
                ordering were a single row indistinguishable from one provider
                asserting it.
              */}
              <AssertedBy sources={placement.assertedBy} />
              <span>{positionLabel(placement.position)}</span>
            </span>
          </li>
        ))}
      </ul>
      {/*
        AN ORIGIN WITH NOTHING IN IT, which is the only way this listing is empty
        while the section still renders: the gate above kept it for the chips, so
        the way back to the whole list is a click rather than an edit.

        AND NO QUALIFICATION ABOUT THE PAGE ANY MORE (CNCORE-129). While the
        narrowing ran over the rows the cap had handed the surface, a notice here
        counted it against the page -- "Showing 12 of the 100 orderings on this
        page" -- because that was all the page could honestly claim. The
        narrowing is the query's now and the count above it is the narrowed
        listing's own, so the caveat described a limit that had stopped holding:
        one outliving its cause is worse than none.

        A CHIP NEVER LANDS HERE, because the chips are the origins the item
        actually has. What does is an address typed by hand, which is ADR-0066's
        non-identifying parameter naming nothing.
      */}
      {total === 0 && (
        <p className="mt-2 text-muted-foreground text-sm">
          Nothing placed that way. The whole list is under All.
        </p>
      )}
      {/*
        HOW A READER REACHES THE REST OF IT (ADR-0119), and the same component
        the other four listings walk with -- so the rule that every page past the
        first carries a way back to the start is written once rather than five
        times.

        IT CARRIES `route` FORWARD, which here is `via`, `placed` AND the Members
        cursor: walking this list must not move the other one. `Walk` appends
        `placedAfter` behind all three, which is ADR-0066's fixed spelling order
        with a fourth parameter appended rather than inserted.

        AND IT IS GATED ON THERE BEING ROWS, exactly as the Members walk is:
        past the end of the walk the notice above owns the page, and a walk
        rendering beside it would offer "Back to the start" twice.
      */}
      {rows.length > 0 && (
        <Walk
          path={path}
          listing="appearances"
          asked={route}
          from={appearingFrom}
          continuesAfter={continuesAfter}
        />
      )}
    </section>
  );
}

/**
 * One chip of the filter. It carries `?via=` forward, so narrowing the list does
 * not lose the ordering the reader arrived through, and the Members cursor with
 * it -- in the fixed order `theRoute` holds (ADR-0066).
 *
 * AND IT DROPS THIS LISTING'S OWN CURSOR, which is the one parameter here that
 * is NOT carried forward. A chip changes what "Also appears in" is ASKING, so
 * the answer is a different listing and `?placedAfter=` names a place in the one
 * the reader is leaving. Keeping it would open the narrowed list halfway down
 * for no reason a reader could see. The Members cursor is carried for the exact
 * mirror of that reason: a chip has nothing to do with that listing, so it must
 * not move it.
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
  // parameters in one fixed order.
  //
  // `origin` RATHER THAN `showingOnly` IS WHAT THIS CHIP NARROWS TO: the chip
  // for an origin points AT it, and the `All` chip has none and therefore drops
  // `placed` -- which is what makes it All.
  const query = theRoute({ arrivedThrough, showingOnly: origin, from });

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
   * comment says why, and says since CNCORE-139 that the memo would now make
   * two calls one answer regardless: what passing it buys is that this section
   * is answered from the context the page was, visibly rather than by a memo in
   * another file. The listing itself is open (ADR-0044) --
   * what makes this section the owner's is that the page renders it only for
   * them, which is the same posture `Note` and `EditTitle` take.
   */
  const { rows, total } = await call(appRouter.catalogue.list, {}, { context });

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
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title ?? "Untitled item"}
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
      {rows.length < total && (
        <p className="mt-2 text-muted-foreground text-sm">
          Showing {rows.length} of {total} items. Search for one to place it from its own page.
        </p>
      )}
    </section>
  );
}

/**
 * MOVING ONE PLACEMENT UP OR DOWN, as a form carrying the delta (ADR-0116).
 *
 * THE DELTA IS IN THE FORM, which is what lets a Server Action apply it without
 * re-reading the ordering. A reorder sends the placement that moved and the
 * siblings whose Position actually changed; an action that took "move this up"
 * and worked the rest out would be a different mutation from the one that
 * record decides on.
 *
 * `siblingId` AND `siblingPosition` IN PARALLEL, because `FormData` keeps
 * repeated names in document order and zipping them by index is ordinary HTML.
 * The drag posts the identical two fields, so both doors reach one parser.
 *
 * AN ABSENT POSITION IS AN EMPTY FIELD, never a missing one. A member with no
 * position is still a member (CONTEXT.md's Unplaced), and an omitted field and
 * an empty one would be the same request with two meanings.
 *
 * NOTHING AT ALL FOR A MOVE THAT CANNOT HAPPEN. `reorderedTo` answers null for
 * a landing a placement already occupies, so the first row renders no Move up
 * and the last no Move down -- a control that cannot do anything reads as
 * broken rather than as the end of the list. Taking that null HERE is review's
 * finding: the wrapper this replaces did nothing but render two of these.
 */
function MoveTo({
  containerId,
  to,
  label,
}: {
  containerId: string;
  to: Reorder | null;
  label: string;
}) {
  if (!to) return null;
  return (
    <form action={movePlacement}>
      <input type="hidden" name="id" value={to.id} />
      <input type="hidden" name="containerId" value={containerId} />
      <input type="hidden" name="position" value={to.position ?? ""} />
      {to.siblings.map((sibling) => (
        <Fragment key={sibling.id}>
          <input type="hidden" name="siblingId" value={sibling.id} />
          <input type="hidden" name="siblingPosition" value={sibling.position ?? ""} />
        </Fragment>
      ))}
      <Button type="submit" variant="ghost" size="sm">
        {label}
      </Button>
    </form>
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
