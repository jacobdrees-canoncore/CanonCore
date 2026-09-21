import type { Context } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { isAPlacementRefusalCause, type PlacementRefusalCause } from "@canoncore/db";
import { Button } from "@canoncore/ui/components/button";
import { Input } from "@canoncore/ui/components/input";
import { Label } from "@canoncore/ui/components/label";
import { Select } from "@canoncore/ui/components/select";
import { Textarea } from "@canoncore/ui/components/textarea";
import { call, isDefinedError, safe } from "@orpc/server";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Fragment } from "react";
import { Attribution } from "@/components/attribution";
import { Holding, type MembersPath, PastTheEnd, type TheRoute, Walk } from "@/components/listing";
import { type Reorder, reorderedTo } from "@/components/ordering";
import { positionLabel } from "@/components/position";
import { inTheFixedOrder, type LinkQuery, oneValue } from "@/components/query-params";
import { SortableMembers } from "@/components/sortable-members";
import { TheirWords } from "@/components/their-words";
import { callerContext } from "@/session";

import {
  annotateItem,
  movePlacement,
  placeItemInContainer,
  putItemInGroup,
  removePlacement,
  restorePlacement,
  retitleItem,
  sortItemAs,
  takeItemOutOfGroup,
} from "../actions";

/**
 * ADR-0066: `/items/<id>` is canonical and addresses the item.
 *
 * The router is called IN-PROCESS rather than over HTTP. A server component
 * fetching its own API is a round trip to itself, and oRPC documents `call` as
 * the way to avoid it.
 *
 * ONCE PER REQUEST, HOWEVER MANY TIMES THE ROUTE ASKS (CNCORE-176). Two things
 * on this route want the same item -- `generateMetadata` for the document title
 * and the page for everything else -- and until this ticket each of them called
 * it, so every Item page cost TWO reads. MEASURED at the fourth seam on
 * 2026-09-15: twelve SQL statements where six would do, and invisible to every
 * test in the repository, because the second read answers exactly what the first
 * one did and the served markup is identical either way.
 *
 * `cache` IS WHAT NEXT DOCUMENTS FOR THIS, and it is a MEMOISATION rather than a
 * cache -- which is the distinction ADR-0117 turns on and the reason that record
 * gained a section for this. Next's own glossary: "Caching the return value of a
 * function so that calling the same function multiple times DURING A RENDER PASS
 * (REQUEST) only executes it once", and `generateMetadata` is named among the
 * places that share it. Nothing is held across requests, nothing is revalidated,
 * and the next reader gets their own read. Read from
 * `node_modules/next/dist/docs` at 16.3.4 as `apps/web/AGENTS.md` instructs:
 * `01-app/04-glossary.md` and `02-guides/caching-without-cache-components.md`,
 * whose "Deduplicating requests" section is this shape exactly -- "If you are not
 * using `fetch` ... and instead using an ORM or database directly, you can wrap
 * your data access with the React `cache` function".
 *
 * IT TAKES FOUR LOOSE ARGUMENTS RATHER THAN AN OPTIONS OBJECT, AND THAT IS
 * LOAD-BEARING. `cache` keys on the arguments by identity, so an object literal
 * would be a fresh key every call and this would memoise nothing while looking
 * exactly as it does now. `theItem` below is the only caller for the same
 * reason: the arity has to match too, and two call sites passing three arguments
 * and four are two entries.
 *
 * THE CONTEXT IS READ RATHER THAN PASSED for the same reason, and it is one
 * fewer wrong answer as well as one fewer argument. `generateMetadata` used to
 * build a SECOND context with `createContext()`, so the metadata read the
 * catalogue as a visitor while the page read it as whoever was asking -- two
 * answers to "what does this request carry" on one render. `callerContext` is
 * memoised per request itself (`@/session`), so this costs nothing.
 */
const readItem = cache(
  async (
    id: string,
    placed?: string,
    after?: string,
    placedAfter?: string,
    before?: string,
    placedBefore?: string,
  ) => {
    const { error, data } = await safe(
      call(
        appRouter.item.get,
        { id, placed, after, placedAfter, before, placedBefore },
        { context: await callerContext() },
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
  },
);

/**
 * WHAT THE ADDRESS IS ASKING FOR, in one place because two entry points ask it.
 *
 * `generateMetadata` and the page are one render of one route, and CNCORE-176 is
 * what happens when they ask separately: the metadata read with no narrowing and
 * no cursors while the page read with all three, so the two arguments differed,
 * so nothing could have been shared even had it been memoised. Derived once
 * here, they cannot.
 *
 * `oneValue` OWNS WHAT A REPEATED OR BLANK PARAMETER MEANS, which is why the
 * page's own reading of `?via=` and the rest goes through it too.
 */
function theAddressAsks({ id, placed, after, placedAfter, before, placedBefore }: TheAddress) {
  return {
    id,
    placed: oneValue(placed),
    after: oneValue(after),
    placedAfter: oneValue(placedAfter),
    before: oneValue(before),
    placedBefore: oneValue(placedBefore),
  };
}

/**
 * The identity, and the three parameters that shape what is read about it. Taken
 * FROM `TheQuery` rather than restated, so the two cannot come to disagree about
 * what a parameter may arrive as.
 */
interface TheAddress
  extends Pick<TheQuery, "placed" | "after" | "placedAfter" | "before" | "placedBefore"> {
  id: string;
}

/**
 * THE ONE PLACE `readItem` IS CALLED, so its arity and the order of its
 * arguments cannot differ between the two callers -- which is what a memoisation
 * keyed on arguments quietly requires and nothing else would enforce.
 */
function theItem({
  id,
  placed,
  after,
  placedAfter,
  before,
  placedBefore,
}: ReturnType<typeof theAddressAsks>) {
  return readItem(id, placed, after, placedAfter, before, placedBefore);
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
          <TheirWords>{source}</TheirWords>
        </span>
      ))}
    </span>
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<TheQuery>;
}): Promise<Metadata> {
  /*
   * IT READS THE QUERY, WHICH A DOCUMENT TITLE HAS NO USE FOR (CNCORE-176).
   * That is the point: what it reads it for is to ask the read path the SAME
   * question the page asks, so the two share one answer. A `generateMetadata`
   * that asked about the bare item while the page asked about the item narrowed
   * to one origin would be two different questions, and two different questions
   * are two reads however they are memoised.
   *
   * IT COSTS THIS ROUTE NOTHING IN RENDERING TERMS. The page already reads
   * `searchParams` for `?via=` and is dynamic by it (ADR-0117), so touching the
   * same request-time API here changes no route's mode.
   *
   * THE THREE ARE NAMED RATHER THAN SPREAD, AND THAT IS NOT STYLE. `{ id,
   * ...query }` let a query parameter called `id` overwrite the one the PATH
   * names, so `/items/A?id=B` titled A's page after B and pointed its canonical
   * at B while the body described A -- two answers to "which item is this" in
   * one document, off a string anybody can put in a link. ADR-0066 is what it
   * broke: the path is identity, and nothing in the query may become it.
   * `item-page.test.ts` holds this.
   */
  const { id } = await params;
  const { placed, after, placedAfter, before, placedBefore } = await searchParams;
  const item = await theItem(
    theAddressAsks({ id, placed, after, placedAfter, before, placedBefore }),
  );
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

/**
 * EVERY PARAMETER THIS ROUTE READS, named once because `generateMetadata` above
 * takes the same object. Six of the ten are the read's question (ADR-0066's
 * `via`, `placed`, `after`, `placedAfter`, and the two step backs CNCORE-174
 * added, `before` and `placedBefore`), three are what a write just did, and
 * `placing` is what the Owner narrowed the placement picker to (CNCORE-256).
 *
 * `placing` IS NOT THE READ'S QUESTION, which is why it is not in `TheAddress`
 * below and never reaches `theItem`. It changes which items the picker OFFERS
 * and nothing about the item this page is about -- so folding it into the read's
 * arguments would change the memo key that `generateMetadata` and the page share
 * for an answer neither of them would read differently.
 */
interface TheQuery {
  via?: string | string[];
  placed?: string | string[];
  after?: string | string[];
  placedAfter?: string | string[];
  before?: string | string[];
  placedBefore?: string | string[];
  undo?: string | string[];
  refused?: string | string[];
  because?: string | string[];
  placing?: string | string[];
}

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<TheQuery>;
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
  const { via, placed, after, placedAfter, before, placedBefore, undo, refused, because, placing } =
    await searchParams;
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
  /*
   * THE READ'S OWN QUESTION, THROUGH THE SAME FUNCTION `generateMetadata` USES
   * (CNCORE-176). The three below are read off it rather than beside it, so the
   * arguments this page hands the read path are the arguments the metadata hands
   * it -- which is what lets one memoised read serve both. Derived separately
   * they would agree today and drift on the day one of them gained a parameter.
   *
   * `showingOnly` is the narrowing (`?placed=`). `membersAt` is where the
   * Members listing stands -- ADR-0119's cursor or, since CNCORE-174, a step
   * back -- read on the SERVER like `via` above it, so the page a reader is
   * served is the page they asked for. `appearancesAt` is "Also appears in"'s
   * own (CNCORE-125): TWO POSITIONS ON ONE ADDRESS, because a
   * Container IS an Item (ADR-0004) and one page therefore carries two
   * independent listings -- what this item HOLDS, and every ordering it SITS IN.
   * Neither may move the other, which is why the second has a name rather than
   * being a second `after`; `listing.tsx`'s `CURSOR` has the argument.
   */
  const asked = theAddressAsks({ id, placed, after, placedAfter, before, placedBefore });
  const showingOnly = asked.placed;
  // WHERE EACH OF THE TWO LISTINGS STARTS: a cursor on or a step back, never
  // both on one link (CNCORE-174). Carried as a pair per Listing, because a
  // walk of either one carries the OTHER's position through untouched.
  const membersAt = { after: asked.after, before: asked.before };
  const appearancesAt = { placedAfter: asked.placedAfter, placedBefore: asked.placedBefore };
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
   *
   * AND IT IS NEVER PRINTED, WHICH IS WHY IT CARRIES NO CEILING (CNCORE-281).
   * That ticket was filed believing this value reached a sentence unbounded,
   * alongside `/settings`, which did. Measured, it does not reach one at all:
   * `PlaceAnItem` takes it and reads it as `{refused && ...}`, a BARE BOOLEAN,
   * and every sentence it gates is this page's own -- those in
   * `WHAT_WAS_REFUSED`, keyed on `?because=`'s closed set, or the vague
   * fallback. This sentence used to count them, and counted the causes this
   * FORM can provoke rather than the ones that `Record` answers, which are not
   * the same population; its own docblock has the distinction. A crafted
   * `?refused=` of any length therefore changes whether that paragraph appears
   * and nothing about what it says.
   *
   * SO THE THING TO KEEP IS THAT IT STAYS A SWITCH. Rendering it -- naming the
   * item that was refused, the obvious next kindness -- would make this the
   * page's voice, and ADR-0123's bound would be owed in the same edit. The
   * type says `string` because `oneValue` answers one; nothing downstream may
   * read it as words without capping it first.
   */
  const refusedItem = oneValue(refused);
  /*
   * THE SENTENCE THE CATALOGUE ANSWERED, AND ONLY IF IT IS ONE OF OURS
   * (CNCORE-275). `placeItemInContainer` puts `placement.place`'s own refusal
   * in the query so this page can say which of its FOUR causes refused the
   * write. A query is composed by anybody, so it is checked against the closed
   * set rather than rendered on trust: unchecked, a crafted link would put
   * arbitrary text in this app's voice on this app's page, which is the harm
   * ADR-0123 names. Anything else falls back to the sentence below.
   */
  const refusedBecause = ((): PlacementRefusalCause | undefined => {
    const said = oneValue(because);
    return said !== undefined && isAPlacementRefusalCause(said) ? said : undefined;
  })();
  /*
   * WHAT THE OWNER NARROWED THE PLACEMENT PICKER TO (CNCORE-256), read on the
   * SERVER like every other parameter here, so the page they are served is
   * already the page they asked for.
   *
   * IT IDENTIFIES NOTHING (ADR-0066). A query naming no item narrows the picker
   * to nothing and the section says so, which is what an absent row means
   * everywhere else here -- there is nothing a reader can type that this has to
   * refuse, and `catalogue.search` says as much of its own input.
   *
   * IT IS NEVER PRINTED IN THIS PAGE'S OWN VOICE, which is what keeps ADR-0123
   * off this parameter. It goes back into the search box as its `defaultValue`
   * -- the Owner's own words handed back inside a form field, which is what
   * `/import` does with `q` under ADR-0151 -- and every sentence beside the
   * picker is this page's, naming a COUNT rather than what was typed. Rendering
   * it inside one of those sentences is the change that would owe a bound here,
   * as `/settings` owes one on `?refused=`.
   */
  const placingWhat = oneValue(placing);
  /*
   * WHERE THE OWNER IS STANDING, which is what every FORM on this page has to
   * hand back (ADR-0172) and what no link needs, because a link is built from
   * `theRoute` at the point it is written.
   *
   * ONE OBJECT FOR THREE FORMS -- the place, the remove and the undo -- because
   * all three REDIRECT, and a redirect can only carry what its form was given.
   * Built here rather than inside each section so that the three cannot come to
   * disagree about what "the address" means, which is the drift CNCORE-290 and
   * CNCORE-293 were two instances of.
   *
   * BOTH CURSORS, UNLIKE THE ROUTE `Members` WALKS WITH. A walk sets its own
   * cursor per link and so is handed a route WITHOUT one; a form is not a walk
   * of either listing, so it carries the pair exactly as the reader left them.
   */
  const whereTheOwnerIs = theRoute({
    arrivedThrough,
    showingOnly,
    membersAt,
    appearancesAt,
    placing: placingWhat,
  });

  /*
   * THE NARROWING GOES TO THE READ PATH (CNCORE-129), where it used to be
   * applied to the rows that came back. The listing answered is the narrow one,
   * so its size, its cap and its walk are the narrowing's own -- and the chips
   * ride back beside it, because they are the one thing narrowing must not
   * change.
   */
  const item = await theItem(asked);
  const owner = context.session !== null;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      {/*
        The title comes from the PROJECTED COLUMN, which is a cached copy of
        whichever title statement currently wins (ADR-0014). An item with no
        title statement has no title, and says so rather than showing its id.
      */}
      <h1 className="text-3xl font-medium">
        <TheirWords>{item.title ?? "Untitled item"}</TheirWords>
      </h1>
      {item.sortName && (
        <p className="mt-2 text-sm text-muted-foreground">
          Sorts as <TheirWords>{item.sortName}</TheirWords>
        </p>
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
        AND WHERE IT FILES, beside the title it is computed from (CNCORE-173).
        The two belong together: correcting a title is usually what makes a
        reader notice the sort name, and an owner who has just retyped one
        should not have to go looking for the other.
      */}
      {owner && <EditSortName itemId={item.id} sortName={item.sortName} />}
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
          because={refusedBecause}
          placing={placingWhat}
          /*
           * EVERYTHING THE ADDRESS ALREADY CARRIES, so searching the picker
           * leaves both listings where the Owner left them. This is the rule
           * `TheRoute` states about the two cursors, applied to a third control
           * on the same address: a gesture aimed at one of them may not move
           * another. BOTH positions, because this form is not a walk of either.
           */
          whereTheOwnerIs={whereTheOwnerIs}
          context={context}
        />
      )}
      <Members
        itemId={item.id}
        holds={item.holds}
        route={theRoute({ arrivedThrough, showingOnly, appearancesAt, placing: placingWhat })}
        whereTheOwnerIs={whereTheOwnerIs}
        owner={owner}
      />
      <AlsoAppearsIn
        itemId={item.id}
        placements={item.placements}
        arrivedThrough={arrivedThrough}
        showingOnly={showingOnly}
        membersAt={membersAt}
        appearancesAt={appearancesAt}
        placing={placingWhat}
      />
      {/*
        WHICH SCOPES THIS ITEM IS IN (ADR-0010, story 38), AFTER THE ORDERINGS
        AND BEFORE THE NOTICE. The orderings are what a reader browsing came
        for; a scope is the frame they were browsing INSIDE, which is the
        question they ask second -- "why did this appear when I narrowed", or
        why it did not.

        NOT A PLACEMENT, AND THE PAGE SAYS SO BY KEEPING THEM APART. The two
        lists are adjacent and answer different questions: "Also appears in" is
        every Ordering this Item sits in, at a Position, asserted by Sources
        that may disagree, and this is every scope the Owner drew around it.
        Folding them would be the partition ADR-0010 refuses, rendered.
      */}
      <Groups groups={item.groups} itemId={item.id} owner={owner} context={context} />
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
 * WHICH BROWSING SCOPES THIS ITEM IS IN, and the Owner's hand on that list
 * (ADR-0010, CNCORE-178).
 *
 * THE LIST IS OPEN AND THE CONTROLS ARE THE OWNER'S, which is the posture every
 * section on this page takes (ADR-0044, ADR-0072, CNCORE-109). A visitor is
 * shown the scopes and no way to change them.
 *
 * AN EMPTY LIST SAYS SO IN WORDS rather than rendering nothing. An absent
 * section and an Item in no scope are different facts, and only one of them is
 * true -- the same rule `CONTEXT.md` settles for Unplaced, where a member with
 * no Position reads "no position given" rather than disappearing.
 */
async function Groups({
  groups,
  itemId,
  owner,
  context,
}: {
  groups: ItemOnThePage["groups"];
  itemId: string;
  owner: boolean;
  context: Context;
}) {
  /*
   * EVERY SCOPE, so the form can offer the ones this Item is NOT in -- asked
   * only for the Owner, because a visitor is offered no form and this would be
   * a query made to render nothing. `PlaceAnItem` above asks its own listing
   * the same way and for the same reason.
   */
  const all = owner ? (await call(appRouter.group.list, {}, { context })).groups : [];
  const joinable = all.filter((group) => !groups.some((held) => held.id === group.id));

  return (
    <section className="mt-8" aria-labelledby="groups">
      <h2 id="groups" className="font-medium text-sm">
        In Groups
      </h2>
      {groups.length === 0 ? (
        <p className="mt-2 text-muted-foreground text-sm">
          This item is in no Group, so it appears however the catalogue is narrowed.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {groups.map((group) => (
            <li className="flex items-center gap-3 text-sm" key={group.id}>
              {/* One marker, for the reason `/groups` gives beside its own. */}
              <span data-group-id={group.id}>
                <TheirWords>{group.name}</TheirWords>
              </span>
              {owner && (
                <section aria-labelledby={`take-out-of-group-${group.id}`}>
                  <h3 className="sr-only" id={`take-out-of-group-${group.id}`}>
                    Take this item out of {group.name}
                  </h3>
                  {/*
                    NO CONFIRMATION (ADR-0046): taking an Item out of one scope
                    leaves every other scope and every Ordering it sits in
                    standing, and putting it back is the form below.
                  */}
                  <form action={takeItemOutOfGroup}>
                    <input type="hidden" name="itemId" value={itemId} />
                    <input type="hidden" name="groupId" value={group.id} />
                    <Button size="sm" type="submit" variant="outline">
                      Take out
                    </Button>
                  </form>
                </section>
              )}
            </li>
          ))}
        </ul>
      )}
      {owner && joinable.length > 0 && (
        <section aria-labelledby="put-in-a-group" className="mt-3">
          <h3 id="put-in-a-group" className="sr-only">
            Put this item in a Group
          </h3>
          <form action={putItemInGroup} className="flex items-end gap-2">
            <input type="hidden" name="itemId" value={itemId} />
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="groupId">Group</Label>
              {/*
                A `<select>` OF THE SCOPES IT IS NOT IN, which is the same
                choice `PlaceAnItem` makes and for the same two reasons: an
                Owner knows the scope they mean by its NAME, and a native select
                posts with no script.

                THE ONES IT IS ALREADY IN ARE LEFT OUT, because putting an Item
                where it already is writes nothing (`putItemInGroupByHand` meets
                the constraint rather than raising) -- so offering them would be
                a control that reports success and changes nothing.
              */}
              <Select id="groupId" name="groupId" required>
                {joinable.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Put it in</Button>
          </form>
        </section>
      )}
      {owner && all.length === 0 && (
        <p className="mt-2 text-muted-foreground text-sm">
          {/*
            THE WAY OUT OF THE EMPTY STATE, rather than a section that offers
            nothing and explains nothing. An Owner who has drawn no scope yet
            cannot put anything in one, and the page says where scopes are made.
          */}
          <Link className="underline" href="/groups">
            Draw a Group
          </Link>{" "}
          to start narrowing this catalogue.
        </p>
      )}
    </section>
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
              <span>
                <TheirWords>{statement.value}</TheirWords>
              </span>
            </span>
            {/*
              The source's own LABEL rather than its kind. "Who asserted this"
              is answered by `provider-wiki`, where `provider` answers only what
              sort of thing said it -- and the reader is asking the first. A
              Provider's label is its declared name, so it is its words too.
            */}
            <span className="text-muted-foreground text-sm">
              <TheirWords>{statement.sourceLabel}</TheirWords>
            </span>
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
  whereTheOwnerIs,
  owner,
}: {
  itemId: string;
  holds: ItemOnThePage["holds"];
  /** ADR-0066's other two parameters, which every link here has to keep. */
  route: TheRoute;
  /**
   * THE WHOLE ADDRESS, WHICH IS NOT `route` ABOVE AND THE DIFFERENCE IS THE
   * CURSOR. `route` is what the WALK links carry, so it holds no Members cursor
   * -- `Walk` sets that per link and drops it for a `Back to the start`. The
   * Remove on each row is a FORM that redirects, and it is not a walk of this
   * listing: it has to hand back the page the reader is on, this listing's own
   * cursor included (ADR-0172, CNCORE-293).
   */
  whereTheOwnerIs: TheRoute;
  /** Whether to offer the controls that CHANGE this ordering (CNCORE-109). */
  owner: boolean;
}) {
  const { rows, total, rowsBefore, continuesAfter, continuesBefore } = holds;
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
          <TheirWords>{placement.title ?? "Untitled item"}</TheirWords>
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
          {owner && (
            <RemovePlacement
              placementId={placement.id}
              containerId={itemId}
              whereTheOwnerIs={whereTheOwnerIs}
            />
          )}
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
        {rows.length > 0 && (
          <Holding showing={rows.length} rowsBefore={rowsBefore} total={total} noun="member" />
        )}
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
          continuesAfter={continuesAfter}
          continuesBefore={continuesBefore}
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
 * SO THE ORDER IS `via`, `placed`, `after`, `placedAfter` -- and this
 * function does not hold it. `inTheFixedOrder` does, for every surface in the
 * app since CNCORE-181; this set the keys in that order by hand, which made
 * the chips below a third statement of it beside two in `listing.tsx`.
 *
 * WRITTEN ONCE BECAUSE THREE SURFACES ON THIS PAGE EMIT IT -- the walk below
 * the Members list, the walk below "Also appears in", and every chip of that
 * list's filter -- so what this page's links carry is decided in one place,
 * and the order they carry it in is decided in the one place every page's is.
 */
function theRoute({
  arrivedThrough,
  showingOnly,
  membersAt,
  appearancesAt,
  placing,
}: {
  arrivedThrough?: string;
  showingOnly?: string;
  /**
   * WHAT THE PLACEMENT PICKER IS NARROWED TO (CNCORE-256), carried by every
   * link this page writes rather than by the picker's own control alone.
   *
   * A THIRD POSITION ON ONE ADDRESS, and the argument is the one the two
   * cursors already make: the picker, the Members list and "Also appears in"
   * are independent, so a link that walks or narrows any one of them must leave
   * the other two exactly where the Owner left them. A `Next` under Members
   * that dropped this would empty the Owner's search box because they turned
   * somebody else's page.
   */
  placing?: string;
  /**
   * WHERE THE TWO LISTINGS STAND, and a caller passes the ones its own links
   * must CARRY. Each is a cursor on or a step back since CNCORE-174, so each is
   * a pair rather than the one cursor it was.
   *
   * The two listings on this page are independent, so a link that walks or
   * narrows one must not send a reader deep in the other back to its first page.
   * Each walk passes BOTH: `Walk` owns which of the two is its own, setting it
   * where the link goes and dropping it for a `Back to the start`, so neither
   * caller has to remember which cursor it is holding.
   *
   * A CHIP PASSES ONLY `membersAt`, which is the one asymmetry here and is
   * argued at `FilterLink`: narrowing changes what "Also appears in" is ASKING,
   * so its position names an anchor in the listing being left.
   */
  membersAt?: Pick<TheRoute, "after" | "before">;
  appearancesAt?: Pick<TheRoute, "placedAfter" | "placedBefore">;
}): TheRoute {
  return inTheFixedOrder({
    via: arrivedThrough,
    placed: showingOnly,
    ...membersAt,
    ...appearancesAt,
    placing,
  });
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
  membersAt,
  appearancesAt,
  placing,
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
   * Where the Members listing stands, which this section's links carry
   * FORWARD rather than drop: its cursor or its step back (CNCORE-174).
   *
   * The two listings on this page are independent, so a reader deep in a
   * container's ordering who narrows or walks this one would otherwise be sent
   * back to that ordering's first page by a link that has nothing to do with it.
   */
  membersAt: Pick<TheRoute, "after" | "before">;
  /** Where THIS listing stands, if the page was asked with a position in it. */
  appearancesAt: Pick<TheRoute, "placedAfter" | "placedBefore">;
  /**
   * What the placement picker is narrowed to, which this section's links carry
   * FORWARD rather than drop (CNCORE-256) -- `membersAt`'s reason, for the
   * third independent thing on this address.
   */
  placing?: string;
}) {
  const { rows, total, rowsBefore, continuesAfter, continuesBefore, everyPlacedBy } = placements;
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
  const route = theRoute({ arrivedThrough, showingOnly, membersAt, appearancesAt, placing });

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

          IT COUNTS PLACEMENTS, ONE PER ROW UNDER IT. Not containers: a Repeat is
          one item twice in ONE ordering, so counting containers would make the
          count disagree with the rows under it.

          SO THE NOUN IS `appearance`, AND IT WAS `ordering` UNTIL CNCORE-236.
          That was the glossary's word for what an item sits in, but this counts
          the rows rather than the orderings, and a Repeat is one ordering twice:
          *The Day of the Doctor* read "61 orderings" for 61 placements in 35 of
          them, and *UNIT HQ* "59 orderings" for 59 in 5. `CONTEXT.md`'s
          Placement entry counts it as appearances from the item's end, and a
          catalogue Row's "and 56 more appearances" links here (ADR-0143), so the
          Row and the section it lands on name one figure with one noun.

          AND SINCE CNCORE-129 THE NARROWING IS PART OF THE LISTING, so this one
          count serves both: narrowed, it is the size of the narrowing, its cap
          and its walk. It sat above the chips while it could only describe the
          unnarrowed list and a second notice below carried what the chips did to
          it; there is one number now, and it is the one the reader is looking at.
        */}
        {rows.length > 0 && (
          <Holding showing={rows.length} rowsBefore={rowsBefore} total={total} noun="appearance" />
        )}
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
          membersAt={membersAt}
          placing={placing}
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
            membersAt={membersAt}
            placing={placing}
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
              <TheirWords>{placement.containerTitle ?? "Untitled container"}</TheirWords>
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
          continuesAfter={continuesAfter}
          continuesBefore={continuesBefore}
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
 * the answer is a different listing and `?placedAfter=` names an anchor in the one
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
  membersAt,
  placing,
  children,
}: {
  itemId: string;
  arrivedThrough?: string;
  showingOnly?: string;
  origin?: string;
  /** Where the Members listing stands, which a chip carries rather than moves. */
  membersAt: Pick<TheRoute, "after" | "before">;
  /**
   * What the placement picker is narrowed to, which a chip carries for the
   * mirror of `membersAt`'s reason: a chip has nothing to do with the picker,
   * so it must not empty it (CNCORE-256).
   */
  placing?: string;
  children: React.ReactNode;
}) {
  // An object rather than a string: Next's typed routes match a string href
  // against the route patterns, and `/items/<id>?<query>` matches none of them.
  // The query keeps insertion order through to the URL, and `theRoute` inserts
  // in the one fixed order `inTheFixedOrder` holds for every surface.
  //
  // `origin` RATHER THAN `showingOnly` IS WHAT THIS CHIP NARROWS TO: the chip
  // for an origin points AT it, and the `All` chip has none and therefore drops
  // `placed` -- which is what makes it All.
  const query = theRoute({ arrivedThrough, showingOnly: origin, membersAt, placing });

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
 * CORRECTING WHERE AN ITEM FILES (CNCORE-173), which is `EditTitle` above
 * applied to the catalogue's other projected column.
 *
 * THE FIELD OPENS ON WHAT THE ITEM SORTS AS NOW, which for an item nobody has
 * corrected is `derived:sort-name-v1`'s own answer. That is the point rather
 * than a convenience: an owner correcting a sort name is DISAGREEING with a
 * computation, and a blank box would make them guess what they are disagreeing
 * with. It is the same argument `EditTitle` makes about opening on the title.
 *
 * NOT `required`, WHICH IS THE ONE ATTRIBUTE THAT DIFFERS FROM `EditTitle`, and
 * the difference is the whole feature: clearing this box and saving withdraws
 * the owner's claim and hands the item back to the computation (ADR-0096's
 * shape, argued at `sortNameByHand` in the router). `required` would take that
 * away, leaving retyping the computed value by hand as the only route back.
 *
 * `defaultValue` RATHER THAN `value`, and the item's id as a hidden field, for
 * the two reasons `EditTitle` gives: a controlled input needs a client
 * component, and a Server Action gets no request URL.
 */
function EditSortName({ itemId, sortName }: { itemId: string; sortName: string | null }) {
  return (
    <section className="mt-8" aria-labelledby="edit-sort-name">
      <h2 id="edit-sort-name" className="font-medium text-sm">
        Sorts as
      </h2>
      <form action={sortItemAs} className="mt-2 flex items-end gap-2">
        <input type="hidden" name="id" value={itemId} />
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="sortName" className="sr-only">
            Sorts as
          </Label>
          {/*
            `sortName ?? ""` IS AN ITEM WITH NO TITLE, which is the only way an
            item has no sort name: the computation reads the winning title, so
            an item nobody has titled has nothing to file under (ADR-0003). The
            owner can still give it one here.
          */}
          {/*
            THE HINT BELOW IS TIED TO THE FIELD rather than left sitting near it
            (`frontend.md`: accessibility ships with the feature). This is the
            one control on the page whose EMPTY state does something, and a
            reader who cannot see the layout has no other way to learn that
            clearing the box is the undo. Raised by review.
          */}
          <Input
            id="sortName"
            name="sortName"
            defaultValue={sortName ?? ""}
            autoComplete="off"
            aria-describedby="sorts-as-hint"
          />
        </div>
        <Button type="submit">Save</Button>
      </form>
      <p id="sorts-as-hint" className="mt-2 text-muted-foreground text-sm">
        Clear this to file it as CanonCore works it out.
      </p>
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
          <span className="whitespace-pre-wrap">
            <TheirWords>{note.value}</TheirWords>
          </span>
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
 * WHAT EACH REFUSAL SAYS TO A READER, in the reader's words rather than the
 * catalogue's. ADR-0009 licences a Repeat at DIFFERENT positions, so the first
 * of these is about the POSITION rather than about placing the item twice --
 * and saying so is the difference between a rule an owner can work with and a
 * wall.
 *
 * TOTAL ON THE CAUSE, so this cannot answer four of five. `not-in-this-container`
 * cannot reach the place form today -- only `placement.move` raises it -- and it
 * is answered anyway, because a `Record` that skipped it would need a partial
 * type and a partial type is what lets the next cause go unanswered.
 */
const WHAT_WAS_REFUSED: Record<PlacementRefusalCause, string> = {
  "already-there":
    "Nothing was placed. That item is already here at that position, and a Repeat is allowed only at a different one.",
  "no-such-item-or-container": "Nothing was placed. That item is no longer in the catalogue.",
  cycle: "Nothing was placed. A container cannot hold itself, or anything it already sits inside.",
  "position-out-of-range":
    "Nothing was placed. That position is outside the range this catalogue can store.",
  "not-in-this-container":
    "Nothing was placed. That move named a placement this container does not hold.",
};

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
  because,
  placing,
  whereTheOwnerIs,
  context,
}: {
  containerId: string;
  undone?: string;
  /** The item a placement was just refused for, if one was (ADR-0116). */
  refused?: string;
  /** WHY the catalogue refused it, already checked to name a cause we raise. */
  because?: PlacementRefusalCause;
  /** What the Owner narrowed this picker to, if they have searched it. */
  placing?: string;
  /**
   * THE WHOLE ADDRESS THE OWNER IS ON, which both forms in this section carry
   * rather than drop: the ordering the reader arrived through, the origin "Also
   * appears in" is narrowed to, where each of the two listings stands, and what
   * this picker is narrowed to.
   */
  whereTheOwnerIs: TheRoute;
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
   *
   * WHICHEVER QUESTION THE OWNER ASKED (CNCORE-256): the catalogue, or the
   * catalogue narrowed to what they typed. Both are ONE PAGE of the same
   * listing and answer the same shape (`cataloguePublic`), so what changes
   * between them is which items the picker offers and nothing about how this
   * section counts them or words its sentences.
   *
   * `catalogue.search` RATHER THAN A SECOND SEARCH PATH. It is the procedure
   * `/search` asks, which is what stops the picker becoming a second answer to
   * "what is in this catalogue" -- the escaping of `LIKE` metacharacters, the
   * cap, the count and the ranking (ADR-0120) are all one seam's, and a picker
   * that matched titles its own way would be a second set of rules for one
   * question. `list` IS STILL THE UNASKED CASE rather than a search for the
   * empty string: an escaped empty query is the pattern `%%`, which matches
   * every titled row and would silently drop the untitled ones from a picker
   * that had not been searched at all.
   */
  const { rows, total } =
    placing === undefined
      ? await call(appRouter.catalogue.list, {}, { context })
      : await call(appRouter.catalogue.search, { query: placing }, { context });
  // WHERE THE PICKER'S OWN CONTROLS SUBMIT AND POINT: this container's page,
  // which is the one address this section lives at (ADR-0004, ADR-0066).
  const here: MembersPath = `/items/${containerId}`;
  /*
   * AND THE SAME ADDRESS WITHOUT THE NARROWING, for the SEARCH form alone.
   *
   * THAT FORM HAS A TEXT INPUT NAMED `placing`, so a hidden field beside it
   * would submit the name TWICE -- which `oneValue` reads as no narrowing at
   * all, emptying the box the Owner just typed into. The place form has no such
   * input and carries the whole thing.
   *
   * THROUGH `inTheFixedOrder` RATHER THAN BY DELETING A KEY, because that
   * function already drops a parameter with no value and is what fixes the
   * order both forms' fields stand in (ADR-0066).
   */
  const carriedBySearch = inTheFixedOrder({ ...whereTheOwnerIs, placing: undefined });

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
      {undone && (
        <UndoRemoval
          placementId={undone}
          containerId={containerId}
          whereTheOwnerIs={whereTheOwnerIs}
        />
      )}
      {/*
        WHAT THE CATALOGUE WOULD NOT DO, IN ITS OWN WORDS. ADR-0009 licences a
        Repeat at DIFFERENT positions, so the refusal is usually about the
        POSITION rather than about placing the item twice -- and saying so is the
        difference between a rule an owner can work with and a wall.

        THE COPY IS THIS PAGE'S, THE MEANING IS THE ACTION'S (CNCORE-262,
        CNCORE-275). `placeItemInContainer` carries a CAUSE through its redirect
        -- a word from a closed set, never a sentence -- because a redirect puts
        whatever it carries in a URL a stranger can compose, and prose there
        would let a forged link speak in this app's voice (ADR-0123).

        AND THE ANSWER IS TOTAL, which is what stopped this drifting a third
        time. A sentence written here can only name the causes known the day it
        was typed: it named ONE while `PLACEMENT_REFUSALS` held two, review
        caught that, and then CNCORE-255 made `placement.place` answer whichever
        of its FOUR refused the write -- so the hardcoded pair was a false reason
        again, for the two it had never heard of. `WHAT_WAS_REFUSED` is keyed on
        `PlacementRefusalCause`, so a NEW cause is a TYPE ERROR here rather than
        another silent misreport. That is not a hypothesis any more:
        `not-in-this-container` arrived after this was written and the type
        carried it in, which is the mechanism doing what the sentence promised.

        THE FALLBACK IS VAGUE ON PURPOSE, for an old link or a hand-edited query
        where no cause survived. Vague is honest there; naming one would be
        guessing at it.
      */}
      {refused && (
        <p className="mt-2 text-sm text-destructive">
          {because === undefined
            ? "Nothing was placed. The catalogue refused it."
            : WHAT_WAS_REFUSED[because]}
        </p>
      )}
      {/*
        THE WAY TO AN ITEM THE PICKER IS NOT OFFERING (CNCORE-256), and the
        reason it is HERE rather than on the item's own page. ADR-0061 gives
        every container its membership outright, so the control that changes
        this ordering belongs to this ordering -- what was missing was never a
        second control at the item's end but a way to REACH one item through
        this one. The notice below said otherwise and named a control that has
        never existed.

        A `<Form>` RATHER THAN A `<form action="/items/...">`, which is
        ADR-0109's rule and not a preference: Next prefixes `<Link>`, `<Form>`
        and `router.push()` under a `basePath` and nothing else, so a raw form
        here renders identically today and points at the wrong place the day
        this app is served from a path. It also needs no script, which is what
        the whole of this section is built on.

        IT IS A GET AND THE ONE BESIDE IT IS A POST, which is the difference
        between asking this page a narrower question and changing what the
        container holds. A reader with no script gets both.
      */}
      <Form action={here} className="mt-2 flex items-end gap-2">
        {/*
          EVERYTHING THE ADDRESS ALREADY CARRIED, so a search of the picker
          leaves the Members list and "Also appears in" exactly where the Owner
          left them -- `TheRoute`'s rule for the two cursors, applied to a third
          control on one address.

          IN THE FIXED ORDER, WHICH IS WHY THIS IS `TheAddressBack` RATHER THAN
          SEVEN HAND-WRITTEN INPUTS. A browser submits fields in the order they
          stand in the document, so the document order IS the address this
          control writes -- and `carriedBySearch` is `inTheFixedOrder`'s own
          object, whose keys are already in that order. The query goes LAST
          because `placing` is last in that list, which is the position it was
          given so that this form could stand its fields in one run (ADR-0066).

          WITHOUT THE NARROWING, WHICH THE TEXT INPUT BELOW HOLDS. A hidden
          field beside that input would submit `placing` TWICE, which `oneValue`
          reads as no narrowing at all -- emptying the box the Owner just typed
          into. It is the one thing this form carries differently from the three
          that post, and it is why `TheAddressBack` takes any `LinkQuery`.
        */}
        <TheAddressBack query={carriedBySearch} />
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="placing">Find an item</Label>
          {/*
            PREFILLED WITH WHAT WAS ASKED, which is ADR-0151's posture on
            `/import`'s box: a control that cleared itself would make the Owner
            retype the query to change one letter of it, and the box is also the
            only place this section shows them what it is narrowed to.

            AND THAT IS WHY NO SENTENCE HERE QUOTES IT. The Owner's words go
            back into their own field; every sentence beside this picker is the
            page's own and names a COUNT. So `?placing=` never lands inside a
            sentence this app speaks in its own voice, and ADR-0123's bound --
            which `/settings` owes on `?refused=` for exactly that reason -- is
            not owed here.
          */}
          <Input
            id="placing"
            name="placing"
            type="search"
            defaultValue={placing ?? ""}
            placeholder="Part of a title"
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="secondary">
          Find
        </Button>
      </Form>
      {/*
        NO PICKER AT ALL WHERE NOTHING MATCHED, rather than an empty one. The
        select is `required`, so an empty one is a control the Owner can press
        Place on and be refused by for a reason that is not their fault -- and
        ADR-0116's rule is that a UI permitting a gesture and then failing the
        write is worse than one that does not offer it. The sentence below says
        what happened and offers the way back.
      */}
      {rows.length > 0 && (
        <form action={placeItemInContainer} className="mt-2 flex items-end gap-2">
          <input type="hidden" name="containerId" value={containerId} />
          {/*
            WHERE THE OWNER IS STANDING, SO A REFUSAL CAN PUT THEM BACK
            (CNCORE-290). This form posts to the container's own address and the
            response to a SUCCESSFUL placement is that same page rendered again
            -- every position on it included, because the address never changed.
            A REFUSAL is the one that leaves: it redirects to an address the
            action builds (CNCORE-255), and an address built without these would
            answer the Owner by moving three things they did not touch.

            ALL THREE POSITIONS, WHICH IS THE RULE THIS SECTION STATES ARRIVING
            WHOLE. CNCORE-256 carried the narrowing and ADR-0165 wrote down that
            it carried only that: `?via=` and both listings' cursors were not on
            this form, so a reader on page three of Members who was refused one
            placement came back to page one of Members AND page one of "Also
            appears in". The rule was stated five times in that diff and kept in
            one place, which is worse than not stating it -- the next reader
            cannot tell whether the omission was reasoned.

            THROUGH `TheAddressBack`, WHICH ALL FOUR FORMS ON THIS PAGE USE --
            the search above, this, the Remove on each Member row and the Undo.
            They spell these fields once between them, in the one order
            `inTheFixedOrder` fixes (ADR-0066); four copies of the map is four
            chances for one to drop a parameter, which is this defect over
            again.

            IT CARRIES `placing`, WHICH THE SEARCH ABOVE DOES NOT, for the
            reason given there: this form has no text input under that name.

            AND IT CARRIES ANY STANDING `undo`, WHICH NOTHING ELSE DOES. A
            removal leaves the Owner on `?undo=<id>` with the offer above and
            this form below it, so a refusal here rebuilds an address that has
            an offer on it -- one this gesture never touched. Dropped, the
            Owner loses the way back to a member they removed because a
            DIFFERENT item could not be placed. The remove and undo forms carry
            no `undo`, because a removal MINTS one and the undo SPENDS it.
          */}
          <TheAddressBack query={inTheFixedOrder({ ...whereTheOwnerIs, undo: undone })} />
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="itemId">Item</Label>
            {/*
            A `<select>` RATHER THAN AN ID TYPED IN, because an owner curating an
            ordering knows what they want to add by its NAME. It needs no script:
            a select posts its chosen option as an ordinary field, which is the
            same constraint `/new` meets the same way.

            IT WEARS `packages/ui`'s `Select`, which is that `Input`'s metrics
            on a native element (CNCORE-177). This wore stock shadcn's `h-9
            rounded-md text-sm` until review caught it -- the step-taller-and-
            larger mismatch `.claude/rules/frontend.md` files under "Ported code
            is where this slips" -- and then wore a hand-copy of the right
            metrics, which is what drifted on the third surface to copy them.
          */}
            <Select id="itemId" name="itemId" required>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title ?? "Untitled item"}
                </option>
              ))}
            </Select>
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
      )}
      {/*
        THE CAP IS NEVER SILENT (ADR-0119), AND THE COUNT IS THE LISTING'S OWN
        SENTENCE RATHER THAN A SECOND SPELLING OF IT (CNCORE-256). `Holding` is
        what every other Listing in this app counts itself with -- the grouped
        figure, the plural, and ADR-0133's "items 1 to 100 of 8,052" -- and this
        section printed its own `Showing {rows.length} of {total} items` beside
        it, which is one rule in two places and one of them without the
        thousands separator a catalogue this size needs.

        `result` WHERE THE OWNER SEARCHED AND `item` WHERE THEY DID NOT, which
        is the distinction `Holding` takes the noun for: a search counts how
        many MATCHED, and the unasked picker counts what the catalogue holds.
        `rowsBefore` IS ZERO because this picker does not walk -- it is always
        the first page of whichever question was asked, and the way past the
        first page is the search above rather than a cursor.
      */}
      <Holding
        showing={rows.length}
        rowsBefore={0}
        total={total}
        noun={placing === undefined ? "item" : "result"}
      />
      {/*
        AND THE REMEDY IS NAMED ONLY WHERE THERE IS ONE TO NAME, which is the
        whole of CNCORE-256. This sentence read "Search for one to place it from
        its own page" -- and an Item's own page offers no way to place it into
        anything, so the one thing the notice told the Owner to do could not be
        done. The remedy now sits one control above it.

        THE THREE STATES ARE THE THREE ANSWERS, and each names what to do next:
        a capped catalogue points at the search, a capped SEARCH points at
        narrowing it further, and a search that matched nothing offers the whole
        catalogue back. A page showing everything it has says nothing extra,
        because there is nothing the Owner cannot already reach.
      */}
      {rows.length < total && (
        <p className="mt-1 text-muted-foreground text-sm">
          {placing === undefined
            ? "Find an item above to place one that is not on this list."
            : "Narrow the search above to reach the matches that are not on this list."}
        </p>
      )}
      {placing !== undefined && total === 0 && (
        <p className="mt-1 text-muted-foreground text-sm">
          Nothing in the catalogue matches that. Search reads the title each item goes by, so an
          item known here under another title is not found by it yet.
        </p>
      )}
      {/*
        THE WAY OUT OF THE NARROWING, offered whenever there is one to leave --
        including from a search that matched nothing, which is the state a
        reader is most stuck in. It is the picker's address with `placing`
        dropped and everything else the page carries kept, built from `carried`
        rather than spelled out here: an address written by hand would be a
        second spelling of this page (ADR-0066), and a `<Link>` is what Next
        rewrites under a `basePath` (ADR-0109).
      */}
      {placing !== undefined && (
        <p className="mt-1 text-sm">
          <Link href={{ pathname: here, query: carriedBySearch }} className="hover:underline">
            Show the whole catalogue
          </Link>
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
 * THE ADDRESS THE OWNER IS ON, AS HIDDEN FIELDS (ADR-0172).
 *
 * WRITTEN ONCE FOR EVERY FORM ON THIS PAGE THAT CARRIES ONE: the remove and the
 * undo here, and the picker's search and place form in `PlaceAnItem`. The three
 * that POST land wherever their action sends them and a Server Action gets no
 * request URL, so a parameter that is not a field is one the answer cannot
 * carry; the fourth NAVIGATES, and a GET form's fields simply ARE the address
 * it asks for. One mechanism, so one component.
 *
 * `LinkQuery` RATHER THAN `TheRoute`, because the four do not carry the same
 * set: the search drops the narrowing its own text input holds, and the place
 * form adds the `undo` offer standing over it. What they share is that each
 * hands `inTheFixedOrder`'s own object straight here.
 *
 * IN THE FIXED ORDER, WHICH IS WHY THIS IS A MAP AND NOT HAND-WRITTEN INPUTS. A
 * browser submits fields in the order they stand in the document, so document
 * order IS the address these controls write; `whereTheOwnerIs` is
 * `inTheFixedOrder`'s own object, whose keys are already in that order
 * (ADR-0066). A parameter with no value is not a key, so it renders nothing
 * rather than an empty field.
 */
function TheAddressBack({ query }: { query: LinkQuery }) {
  return Object.entries(query).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));
}

/**
 * TAKING ONE MEMBER OUT, as a form naming the PLACEMENT (ADR-0061).
 *
 * IT CARRIES THE CONTAINER TOO, because the action redirects back to it with
 * the undo offer -- and a Server Action gets no request URL, so anything it
 * needs has to be in the form.
 *
 * WHICH IS ALSO WHY IT CARRIES THE REST OF THE ADDRESS (CNCORE-293). That same
 * sentence is the whole defect: the action cannot know where the reader was
 * standing unless this form says so, and it did not -- so removing a member
 * from page three of Members answered with page one of Members and page one of
 * "Also appears in". A removal is the most frequent editing act there is
 * (ADR-0046), so it was the commonest gesture on this page that moved the
 * reader furthest.
 */
function RemovePlacement({
  placementId,
  containerId,
  whereTheOwnerIs,
}: {
  placementId: string;
  containerId: string;
  whereTheOwnerIs: TheRoute;
}) {
  return (
    <form action={removePlacement}>
      <input type="hidden" name="id" value={placementId} />
      <input type="hidden" name="containerId" value={containerId} />
      <TheAddressBack query={whereTheOwnerIs} />
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
function UndoRemoval({
  placementId,
  containerId,
  whereTheOwnerIs,
}: {
  placementId: string;
  containerId: string;
  whereTheOwnerIs: TheRoute;
}) {
  return (
    <form action={restorePlacement} className="mt-2 flex items-baseline gap-3">
      <input type="hidden" name="id" value={placementId} />
      <input type="hidden" name="containerId" value={containerId} />
      <TheAddressBack query={whereTheOwnerIs} />
      <p className="text-muted-foreground text-sm">Removed from this container.</p>
      <Button type="submit" variant="outline" size="sm">
        Undo
      </Button>
    </form>
  );
}
