import { createServer, type Server } from "node:http";

/**
 * Who is under test, and what to ask each of them for.
 *
 * A participant is a BASE URL AND TWO IDS, and nothing else. The suite never
 * learns which provider it is talking to, because a contract test that branched
 * on the provider's name would be two bespoke test suites sharing a file -- which
 * is the exact thing this test exists to prove the system is not.
 */
export interface Participant {
  /** For the test name only. Nothing in the assertions may branch on it. */
  name: string;
  baseUrl: string;
  /** An id this provider really holds, for `lookup`. */
  aRecord: string;
  /** A query this provider really matches, for `search`. */
  aQuery: string;
  /** A container id this provider really holds, where it offers `browse`. */
  aContainer: string | null;
  /** Closed at the end of the run. A no-op for a provider somebody else is running. */
  close: () => Promise<void>;
}

/**
 * Where each real provider is, and what to ask it for.
 *
 * THE IDS ARE FIXTURES OF THE PROVIDER, not of this suite. `265` is ADR-0057's
 * committed page and `movie:603` is a 1999 film; both are chosen because they do
 * not move. Nothing here asserts on their CONTENT beyond the contract's shape,
 * precisely so TMDB revising a synopsis cannot redden this suite for a reason
 * that is not a contract failure.
 */
const REAL: Record<string, Omit<Participant, "baseUrl" | "close">> = {
  PROVIDER_WIKI_URL: {
    name: "provider-wiki",
    aRecord: "265",
    // The archive's search matches a title from its start rather than anywhere
    // inside it, so a bare word finds nothing. That is a quality-of-results
    // choice and the contract says nothing about it -- what is under test here is
    // the SHAPE of a non-empty result, so the query has to actually match.
    aQuery: "The Tenth Planet",
    aContainer: "91997",
  },
  PROVIDER_TMDB_URL: {
    name: "provider-tmdb",
    aRecord: "movie:603",
    aQuery: "The Matrix",
    aContainer: "collection:2344",
  },
};

/**
 * Every provider this run can reach, plus the witness below.
 *
 * A PROVIDER WHOSE URL IS UNSET IS SKIPPED, AND THE SUITE SAYS SO OUT LOUD rather
 * than passing quietly with one participant. Both images are private on GHCR, so
 * a machine that cannot pull them still gets the contract checked against what it
 * has -- but a green run that checked one provider proves nothing about a
 * CONTRACT, and CI asserts the count for that reason.
 */
export async function participants(): Promise<Participant[]> {
  const found: Participant[] = [];
  for (const [variable, fixture] of Object.entries(REAL)) {
    const baseUrl = process.env[variable];
    if (baseUrl) found.push({ ...fixture, baseUrl, close: async () => {} });
  }
  found.push(await minimalProvider());
  return found;
}

/** The manifest the witness declares: the required half of CMPP and nothing more. */
const MINIMAL_MANIFEST = {
  name: "a provider that declines browse",
  versions: [1],
  operations: ["search", "lookup"],
};

const MINIMAL_RECORD = {
  id: "1",
  title: "A work this provider holds",
  kind: "a kind of its own",
  released: ["1999"],
  writers: [],
  series: null,
  url: "https://example.invalid/1",
};

/**
 * A CONFORMANCE WITNESS: the smallest thing that satisfies CMPP, over a real
 * socket, declining the operation a provider is allowed to decline.
 *
 * IT IS HERE BECAUSE THE ASYMMETRY IT STANDS FOR IS GONE. CNCORE-8's ticket says
 * the contract test must assert "that a provider which does not declare `browse`
 * still satisfies the contract -- not merely skip it", and says to write it so
 * that CNCORE-17 landing "does not silently retire the assertion". CNCORE-17 has
 * landed: `provider-wiki` declares `browse` now, and so does `provider-tmdb`, so
 * NO REAL PROVIDER LACKS IT and there is nothing left in version one exercising
 * ADR-0033's optionality. This is that case kept alive.
 *
 * IT IS NOT A STAND-IN FOR A REAL PROVIDER and must never grow into one. It
 * stands for exactly one claim -- that the contract is SATISFIABLE without
 * `browse` -- and it earns that by going through the identical assertions the
 * real providers do, on a real socket, with nothing in the suite able to tell it
 * apart. The day a conformance rule is written that assumes `browse`, this is
 * what goes red.
 *
 * `browse` ANSWERS 404 rather than being absent, deliberately. A provider that
 * does not DECLARE the operation is under no obligation about what the path does,
 * and 404 is what an undeclared route answers anyway -- so the witness cannot
 * accidentally pass a test that asked for a browse it never promised.
 */
async function minimalProvider(): Promise<Participant> {
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const answer = (body: unknown, status = 200) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (url.pathname === "/") return answer(MINIMAL_MANIFEST);
    if (url.pathname === "/search") {
      const q = url.searchParams.get("q");
      // The contract's rule about a missing query, which covers one that is
      // present and empty (ADR-0033): an empty string is not a query, so `?q=`
      // is the same caller mistake as no `q` at all and gets the same answer.
      //
      // THE WITNESS TAKES A SIDE HERE RATHER THAN ABSTAINING, which is not a
      // free choice and is why it reads as one. ADR-0103 carries what abstaining
      // cost the last time: a neutral answer is counted as a dissenting one by
      // anything measuring this population for agreement.
      if (q === null || q === "")
        return answer({ error: "a `q` query parameter is required" }, 400);
      return answer({ results: q === MINIMAL_RECORD.title ? [MINIMAL_RECORD] : [] });
    }
    if (url.pathname === `/lookup/${MINIMAL_RECORD.id}`) return answer(MINIMAL_RECORD);
    if (url.pathname.startsWith("/lookup/")) return answer({ error: "no such record" }, 404);
    return answer({ error: "not found" }, 404);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return {
    name: MINIMAL_MANIFEST.name,
    baseUrl: `http://127.0.0.1:${address.port}`,
    aRecord: MINIMAL_RECORD.id,
    aQuery: MINIMAL_RECORD.title,
    aContainer: null,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
