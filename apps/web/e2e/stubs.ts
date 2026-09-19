import { createServer, type Server } from "node:http";

/*
 * THE CMPP STUB PLUMBING, AND THE ONE STUB TWO PROJECTS STAND UP (CNCORE-217).
 *
 * MOVED OUT OF `global-setup.ts` RATHER THAN COPIED, for the reason
 * `instance.ts` was: the browser suite is a second Vitest project that needs the
 * Provider which floods its name, and a second copy of a stub is where the two
 * quietly stop agreeing about what a CMPP search does. What each piece is and
 * why is in its own docblock, unchanged by the move.
 */

/** What a stub answers one request with: a JSON body and a status. */
type Answer = (body: unknown, status: number) => void;

/** The `q` of a `/search` path, which is the only parameter CMPP's search takes. */
function queryOf(path: string): string {
  return new URL(path, "http://provider.test").searchParams.get("q") ?? "";
}

/**
 * `search`, over whatever records a stub holds, MATCHED ON THE TITLE.
 *
 * THE LEAST A STUB CAN DO AND STILL BE A SEARCH. One answering every query with
 * everything could not tell a query that found something from one that found
 * nothing, so the page's "nothing matched" branch would never be reached here
 * while CI reached it for real.
 *
 * SHARED BY BOTH STUBS, because a second copy is where the two quietly stop
 * agreeing about what a CMPP search does -- the reason `onLoopback` below is
 * shared.
 */
export function searchOver(records: { title: string }[], path: string): unknown {
  const query = queryOf(path);
  if (query.trim() === "") return { error: "a query is required" };
  return {
    results: records.filter((record) => record.title.toLowerCase().includes(query.toLowerCase())),
  };
}

/**
 * `400` FOR A MISSING OR EMPTY QUERY, which is ADR-0033's reading as CNCORE-33
 * settled it: an empty RESULT is an answer and a missing QUERY is a mistake, and
 * `?q=` is the absent case wearing a different spelling. Both real providers
 * answer it that way, so a stub that answered `200 {"results":[]}` would make
 * this suite's two runs disagree about the contract they exist to hold each other
 * to -- which is the exact divergence ADR-0110 records the contract test finding.
 */
export function searchStatus(path: string): number {
  return queryOf(path).trim() === "" ? 400 : 200;
}

/**
 * A JSON server on a loopback port the operating system picks.
 *
 * Shared by the two stubs, which had written it out twice -- the `createServer`,
 * the `writeHead`, the `listen(0)` and the four lines of narrowing `address()`
 * back to a port. None of that is what either stub is about, and a second copy is
 * where the two quietly stop agreeing about what a CMPP stub does.
 */
export async function onLoopback(
  route: (path: string, answer: Answer) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((request, response) => {
    route(request.url ?? "/", (body, status) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * The name the Provider below DECLARES, which is the one thing it stands for.
 *
 * A WORD REPEATED rather than one letter, so a run of it cannot turn up in the
 * page by coincidence, and with nothing HTML escapes, so what the page prints
 * is comparable to what was sent without decoding either.
 */
export const FLOOD = "flood".repeat(20_000);

/**
 * A PROVIDER THAT NAMES ITSELF AT A LENGTH OF ITS OWN CHOOSING (CNCORE-165).
 *
 * A Provider's `name` is prose it wrote about itself, and it reaches the page
 * as the heading over whatever that Provider answered. Until CNCORE-165 its only
 * bound was `MAX_BODY_BYTES`, so a Provider chose how long a heading on the
 * Owner's page was -- ADR-0123's opening sentence, true of a field nothing had
 * covered.
 *
 * IT ANSWERS EVERY SEARCH WITH NOTHING, which is what lets it sit in
 * `providerUrls` without adding a row to any other test's results. `/import`
 * lists a Provider that matched nothing rather than leaving it out, so its name
 * is printed for every query there is -- which is also why the fan-out test in
 * `import-page.test.ts` reaches it without being told to.
 *
 * IT IS NOT A STAND-IN FOR A REAL PROVIDER and must not grow into one, as the
 * stubs in `global-setup.ts` are not. It stands for one field, asserted at two
 * seams: the page seam says how LONG that name reaches the page, and the
 * browser seam how WIDE (CNCORE-217), which is the one of the two no `fetch`
 * can observe.
 */
export async function aProviderThatFloodsItsName(): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const manifest = {
    name: FLOOD,
    versions: [1],
    operations: ["search", "lookup"],
    max_cache_age: 86400,
    images: { stored_variant: null, per_role_limit: 0, quality_floor: 0 },
  };
  return onLoopback((path, answer) => {
    if (path === "/") return answer(manifest, 200);
    if (path.startsWith("/search")) return answer(searchOver([], path), searchStatus(path));
    return answer({ error: "no such record" }, 404);
  });
}

/**
 * A record's fields, each A WORD REPEATED with no break in it (CNCORE-223), for
 * the reason `FLOOD` is one.
 */
export const UNBROKEN = {
  title: "title".repeat(100),
  kind: "kind".repeat(100),
  released: "1963".repeat(100),
};

/**
 * A PROVIDER WHOSE RECORD IS AS WIDE AS IT IS LONG (CNCORE-223).
 *
 * A record's fields are a source's claim and bounded by nothing, on purpose:
 * cutting a title would corrupt the catalogue rather than protect a page
 * (ADR-0123). So this is the stub `aProviderThatFloodsItsName` is not -- its
 * NAME is ordinary, and what it answers a search with is a record for each
 * field it floods, with no break in that field.
 *
 * FOUND ONLY BY ASKING FOR IT. `searchOver` matches on the title, so each
 * record is on `/import` for a query only its own title holds, and the
 * Provider-name witnesses beside it, which ask for `anything`, see this
 * Provider match nothing.
 */
export async function aProviderThatFloodsItsRecord(): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const manifest = {
    name: "provider-unbroken",
    versions: [1],
    operations: ["search", "lookup"],
    max_cache_age: 86400,
    images: { stored_variant: null, per_role_limit: 0, quality_floor: 0 },
  };
  const records = [
    {
      id: "unbroken-title",
      title: UNBROKEN.title,
      kind: "TV story",
      released: ["1963-11-23"],
      url: "http://127.0.0.1/unbroken-title",
    },
    {
      id: "unbroken-kind",
      title: "A record whose kind has no break in it",
      kind: UNBROKEN.kind,
      released: ["1963-11-23"],
      url: "http://127.0.0.1/unbroken-kind",
    },
    {
      id: "unbroken-released",
      title: "A record whose release date has no break in it",
      kind: "TV story",
      released: [UNBROKEN.released],
      url: "http://127.0.0.1/unbroken-released",
    },
  ];
  return onLoopback((path, answer) => {
    if (path === "/") return answer(manifest, 200);
    if (path.startsWith("/search")) return answer(searchOver(records, path), searchStatus(path));
    return answer({ error: "no such record" }, 404);
  });
}
