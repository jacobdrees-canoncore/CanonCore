import { createServer, type Server, type ServerResponse } from "node:http";

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
  found.push(await lockedProvider());
  found.push(await listingProvider());
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
 * A JSON answer on a witness's response, which both witnesses need and neither
 * owns. Written twice, the two could drift on the one thing every assertion in
 * the suite reads first: the content type.
 */
function jsonAnswer(response: ServerResponse) {
  return (body: unknown, status = 200) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
}

/**
 * ONE READING OF "THAT IS NOT A QUERY", SHARED BY BOTH WITNESSES.
 *
 * ADR-0033 settled it under CNCORE-33: an absent `q`, a present-and-empty `q`
 * and a blank one are the same caller mistake, and both real providers refuse
 * all three. THE TWO WITNESSES DISAGREED UNTIL THIS EXISTED -- one tested
 * `q === ""` and the other `q.trim() === ""`, so `?q=%20` was a 400 to one and a
 * `200 {"results":[]}` to the other. Two witnesses for one rule quietly holding
 * two readings of it is the drift this whole package exists to catch, arriving
 * inside the instrument.
 */
function isNotAQuery(q: string | null): boolean {
  return q === null || q.trim() === "";
}

/**
 * A witness's server, listening on a free loopback port and described as a
 * Participant.
 *
 * SHARED BECAUSE NEITHER WITNESS OWNS ANY OF IT. What the two stand for is what
 * they DECLARE and what they ANSWER; an ephemeral port, a fixture id and a
 * `close` that actually resolves are none of that, and two copies are two places
 * for a witness to stop being torn down at the end of a run.
 *
 * THE CONTAINER FIXTURE IS THE ONE THING A WITNESS PASSES IN, because it is the
 * one thing that follows from what the witness DECLARES. A witness that named a
 * container while declining `browse` would be inviting the browse assertions it
 * never promised, and one that declared the operation without naming a container
 * would be refused by the suite for declaring it with no fixture.
 */
async function listeningAs(
  server: Server,
  name: string,
  aContainer: string | null = null,
): Promise<Participant> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return {
    name,
    baseUrl: `http://127.0.0.1:${address.port}`,
    aRecord: MINIMAL_RECORD.id,
    aQuery: MINIMAL_RECORD.title,
    aContainer,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

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
    const answer = jsonAnswer(response);
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
      if (isNotAQuery(q)) return answer({ error: "a `q` query parameter is required" }, 400);
      return answer({ results: q === MINIMAL_RECORD.title ? [MINIMAL_RECORD] : [] });
    }
    if (url.pathname === `/lookup/${MINIMAL_RECORD.id}`) return answer(MINIMAL_RECORD);
    if (url.pathname.startsWith("/lookup/")) return answer({ error: "no such record" }, 404);
    return answer({ error: "not found" }, 404);
  });
  return listeningAs(server, MINIMAL_MANIFEST.name);
}

/**
 * A THIRD CONFORMANCE WITNESS: a provider that answers which containers it holds.
 *
 * IT IS HERE FOR THE REASON THE FIRST TWO ARE. CNCORE-185 declares the operation
 * and CNCORE-186 is where the two real providers answer it, so on the day the
 * contract landed NOTHING under test declared it -- every assertion in `its
 * containers` would have returned early and the suite would have been green
 * because nobody was asked. That is the failure this package exists to catch,
 * arriving inside the instrument, and it is what the suite-level assertion in
 * `ADR-0033's optionality` fails on.
 *
 * WHAT IT STANDS FOR IS THE JOURNEY, NOT A SOURCE. The operation exists so that
 * browsing does not require knowing an id first, so the claim under test is that
 * an id this provider LISTED is an id it will BROWSE. A witness that listed
 * containers it declined to serve would satisfy every shape assertion while
 * standing for nothing.
 *
 * SO IT DECLARES `browse` TOO, which the contract obliges rather than this
 * witness choosing: `manifest` refuses the pair the other way round.
 */
async function listingProvider(): Promise<Participant> {
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const answer = jsonAnswer(response);

    if (url.pathname === "/") return answer(LISTING_MANIFEST);

    if (url.pathname === "/containers") return answer({ containers: [LISTED_CONTAINER] });

    if (url.pathname === `/browse/${LISTED_CONTAINER.id}`) {
      return answer({
        container: LISTED_CONTAINER,
        // ONE MEMBER AT ONE POSITION. What browse owes is a container AND its
        // ordering together, and a container answering an empty ordering with
        // nothing unplaced is a browse that answered nothing.
        ordering: [{ position: 1, record: MINIMAL_RECORD }],
        unplaced: [],
      });
    }
    if (url.pathname.startsWith("/browse/")) return answer({ error: "no such container" }, 404);

    if (url.pathname === "/search") {
      const q = url.searchParams.get("q");
      if (isNotAQuery(q)) return answer({ error: "a `q` query parameter is required" }, 400);
      return answer({ results: q === MINIMAL_RECORD.title ? [MINIMAL_RECORD] : [] });
    }
    if (url.pathname === `/lookup/${MINIMAL_RECORD.id}`) return answer(MINIMAL_RECORD);
    if (url.pathname === `/lookup/${LISTED_CONTAINER.id}`) return answer(LISTED_CONTAINER);
    if (url.pathname.startsWith("/lookup/")) return answer({ error: "no such record" }, 404);

    return answer({ error: "not found" }, 404);
  });
  return listeningAs(server, LISTING_MANIFEST.name, LISTED_CONTAINER.id);
}

/**
 * The container this witness lists, and the one it browses. THE SAME RECORD in
 * both answers, because that identity is the operation's whole claim.
 */
const LISTED_CONTAINER = {
  id: "c1",
  title: "A container this provider holds",
  kind: "a container of its own",
  released: [],
  writers: [],
  series: null,
  url: "https://example.invalid/c1",
};

const LISTING_MANIFEST = {
  name: "a provider that lists the containers it holds",
  versions: [1],
  operations: ["search", "lookup", "browse", "containers"],
};

/** Where this witness says to supply it. A PATH, never a URL (ADR-0122). */
export const LOCKED_UNLOCK_PATH = "/unlock";

/**
 * What the locked witness asks for.
 *
 * ONE FIELD RATHER THAN TWO, because the contract requires AT LEAST ONE and a
 * witness standing for "a provider that declares a credential" should not also
 * be standing for "a provider that declares several". `provider-wiki` asks for
 * more; that is its upstream's business and not the contract's.
 */
export const LOCKED_CREDENTIAL_FIELDS = [
  { name: "session", label: "The session its upstream asks a person to pass a challenge for" },
];

/**
 * BOUNDED BEFORE IT IS READ, not after (ADR-0122). Nothing authenticates the
 * unlock route -- by design, since the file is the source of truth and anything
 * able to write it can already Unlock -- so an unbounded body is an unbounded
 * allocation on an open route. 16 KiB is the declared field at its ceiling many
 * times over; `provider-wiki` caps at the same figure for the same reason.
 */
const MAX_UNLOCK_BODY = 16 * 1024;

const LOCKED_MANIFEST = {
  // TRUE BEFORE AND AFTER, which the first spelling was not: this name prints in
  // every test title, and `its credential` Unlocks this witness part-way through
  // the run -- so a name asserting the CURRENT state ("has not been Unlocked")
  // was false for the rest of the suite. It names the REQUIREMENT instead, which
  // is the thing that does not change.
  name: "a provider that must be Unlocked before it answers",
  versions: [1],
  operations: ["search", "lookup"],
};

/**
 * A SECOND CONFORMANCE WITNESS: a provider that is well-formed, reachable, and
 * currently unable to answer -- ADR-0122's "not half a provider; a whole one that
 * currently cannot answer", over a real socket.
 *
 * IT IS HERE FOR THE REASON THE FIRST WITNESS IS. `provider-wiki` is the only real
 * provider that declares a credential, its image is private, and CI supplies it
 * with nothing -- so on any machine that cannot pull it, every assertion about a
 * locked provider is a branch nothing enters, and ADR-0122's own optionality guard
 * fails outright. Measured before this existed: `Tests 2 failed | 48 passed`.
 *
 * WHAT IT STANDS FOR IS THE REFUSAL, NOT THE WIKI. `CONTEXT.md` gives the claim in
 * the product's own words -- a Provider with no Credential "stays reachable and
 * answers nothing, saying so -- it is not broken and it is not empty" -- and those
 * are two distinct wrong answers rather than one. NOT BROKEN rules out a dropped
 * connection and a bare 500; NOT EMPTY rules out `200 {"results":[]}` and the 404
 * that `lookup` answers for an id its source genuinely does not hold. Both of
 * those are claims ABOUT THE SOURCE, and a provider that cannot reach its source
 * is in no position to make either.
 *
 * IT UNLOCKS, AND THEN IT ANSWERS. The round trip in `its credential` POSTs the
 * declared fields at the declared path and requires `valid` afterwards, so a
 * witness that stayed locked for ever would be a participant the suite could not
 * finish -- and one that refused after being Unlocked would be asserting the
 * opposite of what this file is for. What it must never be is a provider that
 * answers the SAME whether or not it holds a credential, which is the shape that
 * would let the branch below pass while proving nothing.
 */
export async function lockedProvider(): Promise<Participant> {
  /*
   * THE CREDENTIAL IS HELD IN MEMORY HERE, AND ADR-0122 REQUIRES A FILE OF A REAL
   * PROVIDER. That is not this witness cutting a corner: the record's reason for
   * the file is surviving a container restart, and this process is torn down in
   * `afterAll` by design. What the contract can observe -- the declared state
   * before, the round trip, the declared state after -- is identical either way.
   */
  let held: Record<string, string> | null = null;
  let changedAt: string | null = null;

  const declaration = () => ({
    ...LOCKED_MANIFEST,
    credential: {
      label: "This provider needs a session before it can reach its source",
      fields: LOCKED_CREDENTIAL_FIELDS,
      unlock_path: LOCKED_UNLOCK_PATH,
      // THREE STATES AND THIS WITNESS REACHES TWO. `expired` is written by
      // whatever met a refusal from the upstream (ADR-0122), and a witness with
      // no upstream has nothing to be refused by. The contract branches on `not
      // valid` rather than on `absent`, so the case it stands for covers both.
      state: held === null ? "absent" : "valid",
      // The moment it last became that, which is what tells "it took what I sent"
      // from "it was already like that". Null until something is supplied.
      state_changed_at: changedAt,
    },
  });

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const answer = jsonAnswer(response);
    /*
     * WHAT IT OWES WHILE IT HOLDS NOTHING: a refusal with a reason, naming who
     * wrote it (ADR-0123). The status is what a caller reads, and the body is
     * what a person does -- a provider that refused with an empty body would be
     * indistinguishable from one that fell over, which is the NOT BROKEN half.
     */
    const refuse = () =>
      answer(
        {
          error: "this provider has not been Unlocked, so it cannot reach its source",
          provider: LOCKED_MANIFEST.name,
        },
        503,
      );

    if (url.pathname === "/") return answer(declaration());

    if (url.pathname === LOCKED_UNLOCK_PATH) {
      // A PAGE FOR THE OWNER AND AN ENDPOINT FOR A SCRIPT AT ONE ADDRESS
      // (ADR-0122). The contract asks only that a GET here ANSWERS, because the
      // Owner reaches it by clicking a link; what it answers with is the
      // provider's business.
      if (request.method !== "POST") return answer({ unlock: LOCKED_CREDENTIAL_FIELDS });
      const chunks: Buffer[] = [];
      let size = 0;
      let overflowed = false;
      request.on("data", (chunk: Buffer) => {
        size += chunk.length;
        // STOPS ACCUMULATING rather than destroying the socket, so `end` still
        // fires and the caller gets an answer instead of a dropped connection.
        if (size > MAX_UNLOCK_BODY) overflowed = true;
        else chunks.push(chunk);
      });
      request.on("end", () => {
        if (overflowed) return answer({ error: "that submission is too large" }, 413);
        const submitted = ((): Record<string, unknown> => {
          try {
            const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString());
            return parsed !== null && typeof parsed === "object"
              ? (parsed as Record<string, unknown>)
              : {};
          } catch {
            return {};
          }
        })();
        // HALF A CREDENTIAL IS REFUSED RATHER THAN STORED IN PART (ADR-0122):
        // storing half leaves a provider reporting `valid` about something its
        // upstream is about to refuse, which points the Owner at their source
        // for a fault that is in what they just submitted.
        const complete = LOCKED_CREDENTIAL_FIELDS.every(
          (field) => typeof submitted[field.name] === "string" && submitted[field.name] !== "",
        );
        if (!complete) return answer({ error: "every declared field is required" }, 400);
        held = Object.fromEntries(
          LOCKED_CREDENTIAL_FIELDS.map((field) => [field.name, String(submitted[field.name])]),
        );
        changedAt = new Date().toISOString();
        return answer(declaration().credential);
      });
      return;
    }

    if (url.pathname === "/search") {
      const q = url.searchParams.get("q");
      /*
       * THE CALLER'S MISTAKE IS STILL THE CALLER'S MISTAKE, and this line is the
       * half of the branch that is easy to miss. A missing `q` is answered
       * BEFORE the source is reached, so being locked does not turn it into a
       * refusal -- the request was malformed whatever this provider holds, and
       * answering 503 to it would hide a caller that forgot the parameter behind
       * a credential problem. `provider-wiki` validates in the same order.
       */
      if (isNotAQuery(q)) return answer({ error: "a `q` query parameter is required" }, 400);
      if (held === null) return refuse();
      return answer({ results: q === MINIMAL_RECORD.title ? [MINIMAL_RECORD] : [] });
    }

    if (url.pathname.startsWith("/lookup/")) {
      /*
       * AN ID THIS PROVIDER COULD NEVER HAVE MINTED IS SETTLED FROM ITS OWN ID
       * SPACE, LOCKED OR NOT -- the same seam as the missing `q` above rather
       * than an exception to the refusal. ADR-0066 makes an id that cannot BE an
       * identity a 404, an address with nothing at it, and deciding that needs
       * no source. `provider-wiki` does exactly this, rejecting anything but
       * `^\d{1,18}$` before the wiki is reached, which is why CI's locked run
       * answers 404 here while `/lookup/265` is refused.
       */
      if (url.pathname !== `/lookup/${MINIMAL_RECORD.id}`)
        return answer({ error: "no such record" }, 404);
      if (held === null) return refuse();
      return answer(MINIMAL_RECORD);
    }

    return answer({ error: "not found" }, 404);
  });
  return listeningAs(server, LOCKED_MANIFEST.name);
}
