import { createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
import Link from "next/link";

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

export default async function CataloguePage() {
  const { catalogue } = await readFrontPage();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-medium">Catalogue</h1>
      <Listing entries={catalogue.entries} />
    </main>
  );
}

/**
 * Every item, in the order the catalogue keeps them: `sort_name` where a source
 * has claimed one, and the title otherwise (ADR-0014).
 */
function Listing({
  entries,
}: {
  entries: Awaited<ReturnType<typeof readFrontPage>>["catalogue"]["entries"];
}) {
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
