import { createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { call, isDefinedError, safe } from "@orpc/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Attribution } from "@/components/attribution";

/**
 * ADR-0066: `/items/<id>` is canonical and addresses the item.
 *
 * The router is called IN-PROCESS rather than over HTTP. A server component
 * fetching its own API is a round trip to itself, and oRPC documents `call` as
 * the way to avoid it.
 */
async function readItem(id: string) {
  const { error, data } = await safe(
    call(appRouter.item.get, { id }, { context: await createContext() }),
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
  const item = await readItem(id);
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
          TODO(CNCORE-83): this prints the KEY, so an item of kind `time_span`
          shows a reader `time_span` where `CONTEXT.md` -- binding on UI copy --
          says "Time span". `item_kinds` carries the label beside the kind and
          the catalogue listing already reads it; fixing it here changes what
          `itemPublic.kind` means for every reader of the read path, which is
          why it is a ticket rather than a line.
        */}
        <dd>{item.kind}</dd>
      </dl>
      <Values statements={item.statements} />
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
