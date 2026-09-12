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
import { callerContext } from "@/session";

import { annotateItem, retitleItem } from "../actions";

/**
 * ADR-0066: `/items/<id>` is canonical and addresses the item.
 *
 * The router is called IN-PROCESS rather than over HTTP. A server component
 * fetching its own API is a round trip to itself, and oRPC documents `call` as
 * the way to avoid it.
 */
async function readItem(id: string, context?: Context) {
  const { error, data } = await safe(
    call(appRouter.item.get, { id }, { context: context ?? (await createContext()) }),
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
  searchParams: Promise<{ via?: string | string[]; placed?: string | string[] }>;
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
  const item = await readItem(id, context);
  const owner = context.session !== null;
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
  const { via, placed } = await searchParams;
  const arrivedThrough = typeof via === "string" ? via : undefined;
  const showingOnly = typeof placed === "string" ? placed : undefined;

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
      <Members holds={item.holds} />
      <AlsoAppearsIn
        itemId={item.id}
        placements={item.placements}
        arrivedThrough={arrivedThrough}
        showingOnly={showingOnly}
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
function Members({ holds }: { holds: ItemOnThePage["holds"] }) {
  if (holds.length === 0) return null;

  return (
    <section className="mt-8" aria-labelledby="members">
      <h2 id="members" className="font-medium text-sm">
        Members
      </h2>
      <ul className="mt-2 divide-y">
        {holds.map((placement) => (
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

                THE SOURCES' OWN LABELS RATHER THAN "Imported", and the strip in
                `AlsoAppearsIn` below says the kind for a reason that does not
                hold here. That list asks how an item came to be in a container,
                which four words answer; this one asks WHO claims this position,
                and the disagreement a catalogue really holds is a wiki against a
                broadcaster -- two providers, one word between them. `Values`
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
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
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
          <FilterLink itemId={itemId} arrivedThrough={arrivedThrough} showingOnly={showingOnly}>
            All
          </FilterLink>
          {origins.map((origin) => (
            <FilterLink
              key={origin}
              itemId={itemId}
              arrivedThrough={arrivedThrough}
              showingOnly={showingOnly}
              origin={origin}
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
 * One chip of the filter. It carries `?via=` forward, so narrowing the list
 * does not lose the ordering the reader arrived through, and writes the two
 * parameters in a fixed order -- `via` then `placed` -- so one narrowed list is
 * one URL rather than two spellings of it.
 */
function FilterLink({
  itemId,
  arrivedThrough,
  showingOnly,
  origin,
  children,
}: {
  itemId: string;
  arrivedThrough?: string;
  showingOnly?: string;
  origin?: string;
  children: React.ReactNode;
}) {
  // An object rather than a string: Next's typed routes match a string href
  // against the route patterns, and `/items/<id>?<query>` matches none of them.
  // The query keeps insertion order through to the URL, which is what holds the
  // two parameters in one fixed order.
  const query: Record<string, string> = {};
  if (arrivedThrough) query.via = arrivedThrough;
  if (origin) query.placed = origin;

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
