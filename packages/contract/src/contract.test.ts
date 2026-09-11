import { afterAll, describe, expect, it } from "vitest";

import {
  browseResponse,
  manifest,
  OPTIONAL_OPERATION,
  REQUIRED_OPERATIONS,
  record,
  searchResponse,
} from "./cmpp";
import { type Participant, participants } from "./participants";

/**
 * THE CONTRACT TEST. It calls every provider directly over HTTP and holds them
 * all to one shape, one claim structure and one set of failure modes.
 *
 * WHY IT IS IN THIS REPOSITORY. The contract is CanonCore's, so the test that
 * owns it is CanonCore's. A test in one provider's repo that also called the
 * other would couple the two repos, which is what ADR-0031 forbids; this reaches
 * both over HTTP like any other client.
 *
 * WHY IT DOES NOT GO THROUGH THE APP, which is the part that is easy to get
 * wrong and impossible to notice afterwards. CanonCore's provider layer parses
 * every provider into one normalised shape before anything downstream sees it --
 * so a suite driven through `provider.import` would pass whether or not the two
 * providers agreed about anything, which is the exact failure this exists to
 * catch. The structural guarantee is in `package.json`: this package depends on
 * no `@canoncore/*` package, so it CANNOT reach the app's schema even by
 * accident, and a future import would have to add a dependency somebody reviews.
 *
 * WHAT IT ASSERTS ON, AND WHAT IT WILL NOT. Shape, claim structure and failure
 * modes -- never values. `provider-tmdb` reads a live third-party API, so a suite
 * asserting that The Matrix has two credited writers would go red the day TMDB
 * edits a credit, for a reason that is not a contract failure. The one exception
 * is a record's own id round-tripping through `lookup`, which is identity rather
 * than data.
 */

/**
 * RESOLVED AT MODULE LOAD, NOT IN `beforeAll`, and that is forced rather than
 * chosen: `describe.each` builds its table while the file is being COLLECTED,
 * which happens before any hook runs. Populated in a hook, the table would be
 * empty and the whole suite would pass by having no tests in it -- the loudest
 * possible version of the quiet failure this file is about.
 */
const underTest: Participant[] = await participants();

afterAll(async () => {
  await Promise.all(underTest.map((participant) => participant.close()));
});

async function get(participant: Participant, path: string) {
  const response = await fetch(`${participant.baseUrl}${path}`);
  const text = await response.text();
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    body: (() => {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return null;
      }
    })(),
    text,
  };
}

/**
 * Every camelCase key anywhere in a response, however deeply nested.
 *
 * Walks rather than checking the top level, because the fields most likely to
 * drift are the nested ones -- `images[].url`, `attribution.logo.data_uri`,
 * `images.stored_variant` -- and those are exactly the ones added second by
 * whichever provider needed them first.
 */
function camelCaseKeysIn(body: unknown, found: string[] = []): string[] {
  if (Array.isArray(body)) {
    for (const entry of body) camelCaseKeysIn(entry, found);
    return found;
  }
  if (body === null || typeof body !== "object") return found;
  for (const [key, value] of Object.entries(body)) {
    if (/[a-z0-9][A-Z]/.test(key)) found.push(key);
    camelCaseKeysIn(value, found);
  }
  return found;
}

/**
 * Every value of a URL-BEARING CONTRACT FIELD in a response, however deeply
 * nested: a record's `url`, and an image's `url` and `description_url`.
 *
 * BY FIELD NAME RATHER THAN BY WHAT LOOKS LIKE A URL, and the manifest is why.
 * `attribution.logo.data_uri` is a `data:` URI ON PURPOSE (ADR-0036) -- the
 * bytes travel inline precisely because the reader's browser, not this app,
 * is what fetches a mark -- so a walk that judged anything URL-shaped would
 * report the one field the contract requires to be a `data:` URI.
 */
function contractUrlsIn(body: unknown, found: string[] = []): string[] {
  if (Array.isArray(body)) {
    for (const entry of body) contractUrlsIn(entry, found);
    return found;
  }
  if (body === null || typeof body !== "object") return found;
  for (const [key, value] of Object.entries(body)) {
    if ((key === "url" || key === "description_url") && typeof value === "string") {
      found.push(value);
    }
    contractUrlsIn(value, found);
  }
  return found;
}

/**
 * Every participant, one test each, generated from the same list.
 *
 * ONE TABLE RATHER THAN A DESCRIBE PER PROVIDER, and that is the design. A suite
 * with a `describe("provider-tmdb")` block is a place to put an exception, and an
 * exception is a contract with a hole in it. Nothing below may branch on
 * `participant.name`; the only legitimate branch is on what a provider DECLARES,
 * which is ADR-0033's optionality and is checked as such.
 */
describe.each(underTest.map((p) => [p.name, p] as const))(
  "%s",
  (_name: string, participant: Participant) => {
    describe("its manifest", () => {
      it("answers JSON at the root", async () => {
        const response = await get(participant, "/");

        expect(response.status).toBe(200);
        expect(response.contentType).toContain("application/json");
        expect(() => manifest.parse(response.body)).not.toThrow();
      });

      it("names itself, so a claim can say who made it", async () => {
        const declared = manifest.parse((await get(participant, "/")).body);

        // A source answers "who said this", and the URL it happens to be on is a
        // deployment detail -- for a provider on a private network, one a reader
        // has no business being handed.
        expect(declared.name.length).toBeGreaterThan(0);
        expect(declared.name).not.toMatch(/^https?:\/\//);
      });

      it("declares the two operations every provider must answer", async () => {
        const declared = manifest.parse((await get(participant, "/")).body);

        // ADR-0033. `search` and `lookup` are required OF A PROVIDER; `browse` is
        // the one that may be declined, and is deliberately not checked here.
        for (const operation of REQUIRED_OPERATIONS) {
          expect(declared.operations).toContain(operation);
        }
      });

      it("declares a version array, or nothing at all", async () => {
        const raw = (await get(participant, "/")).body as Record<string, unknown>;

        // ADR-0032: ABSENCE MEANS THE FIRST VERSION and the field is never
        // required. What is refused is a bare number, which is the shape that
        // makes straddling two versions a flag day instead of a migration.
        if ("versions" in raw) expect(Array.isArray(raw.versions)).toBe(true);
        expect(manifest.parse(raw).versions.length).toBeGreaterThan(0);
      });
    });

    describe("its search", () => {
      it("answers candidates in one shape", async () => {
        const response = await get(
          participant,
          `/search?q=${encodeURIComponent(participant.aQuery)}`,
        );

        expect(response.status).toBe(200);
        const { results } = searchResponse.parse(response.body);
        // The fixture query is one each provider really matches, so an empty list
        // here is a provider that has stopped answering rather than a contract
        // difference -- and a shape assertion over zero records checks nothing.
        expect(results.length).toBeGreaterThan(0);
      });

      /**
       * THE OTHER HALF OF CNCORE-33'S SENTENCE, and the half nothing was
       * holding anyone to.
       *
       * "An empty result is an answer; a missing query is a mistake" has two
       * claims in it and the two tests below only ever checked the second. A
       * provider answering `404`, or an error, to a query that simply matched
       * nothing would satisfy every assertion here -- and it is a plausible
       * thing to build, since `lookup` answers `404` for an id it does not hold
       * and reusing that reflex for `search` looks consistent.
       *
       * IT BECAME LOAD-BEARING UNDER CNCORE-77, which is why it is pinned now
       * rather than earlier. CanonCore's client reads a provider's refusal as
       * that provider FAILING and an empty `results` as it ANSWERING, and a
       * fan-out across several providers sorts them into different lists on
       * exactly that distinction. A provider that reported "nothing matched" as
       * a failure would show an owner a source that looks broken every time
       * they search for something it does not hold.
       */
      it("answers a query it matches nothing for as an empty result, not as a failure", async () => {
        // Nonsense rather than a plausible title, so that no provider can match
        // it by accident and redden this for a reason that is not a contract
        // failure. Nothing here asserts on a VALUE, only that answering
        // "nothing" is an answer.
        const response = await get(participant, "/search?q=qzzx%20noitartsnomed%20yreuq");

        expect(response.status).toBe(200);
        expect(searchResponse.parse(response.body).results).toEqual([]);
      });

      it("treats a missing query as the caller's mistake, not as an empty result", async () => {
        const response = await get(participant, "/search");

        // ANSWERING `[]` WOULD HIDE A CALLER THAT FORGOT THE PARAMETER, which is
        // the whole reason this is a failure mode rather than a result.
        expect(response.status).toBe(400);
        expect(response.body).not.toBeNull();
      });

      it("reads a present but empty query as that same mistake (CNCORE-33)", async () => {
        const response = await get(participant, "/search?q=");

        // AN EMPTY RESULT IS AN ANSWER; A MISSING QUERY IS A MISTAKE. A `q` that
        // is present and empty is a caller that built a URL and never filled the
        // parameter in, so it is the case above wearing a different spelling --
        // and answering `[]` would hide it exactly as answering `[]` to an absent
        // `q` would. An empty string is not undefined, which is the reading that
        // makes the two look different; a caller cannot see that difference and
        // the contract does not offer it one.
        expect(response.status).toBe(400);
        expect(response.body).not.toBeNull();

        // NOT ASSERTED: that the body names `q`. Both providers say so and this
        // suite still will not check it -- error prose is a value, and this file
        // holds providers to shape, claim structure and failure modes precisely
        // so that rewording a message is not a contract break.
      });
    });

    describe("its lookup", () => {
      it("answers one record, in one shape, at the id it was given", async () => {
        const response = await get(
          participant,
          `/lookup/${encodeURIComponent(participant.aRecord)}`,
        );

        expect(response.status).toBe(200);
        const found = record.parse(response.body);
        // IDENTITY RATHER THAN DATA, which is why this is the one value asserted:
        // a provider that answered a different record's id would break every
        // refresh downstream, and nothing else here would notice.
        expect(found.id).toBe(participant.aRecord);
      });

      it("reports an id it does not hold as an answer, not as a failure", async () => {
        const response = await get(participant, "/lookup/an-id-no-provider-mints");

        // ADR-0033: a record the provider does not hold is what an ambiguous
        // `search` candidate looks like once the candidate turns out to be gone.
        // A 404 with a body, so a client can tell "no such record" from a
        // provider that fell over.
        expect(response.status).toBe(404);
        expect(response.contentType).toContain("application/json");
        expect(response.body).not.toBeNull();
      });
    });

    /**
     * THE DRIFT A SHAPE CHECK CANNOT SEE, and the reason a contract test is not
     * just a schema.
     *
     * The contract permits unknown keys, because ADR-0033 lets a provider declare
     * more than it is asked for and a provider ahead of the contract is
     * well-formed. That tolerance has a hole in it: a provider spelling a
     * CONTRACT field its own way -- `externalIds` beside the contract's
     * `external_ids` -- sends a key the schema treats as an unknown extension and
     * a key the contract's own field is then simply absent from. Both parse. Both
     * are wrong, and each provider's tests pass on its own spelling forever.
     *
     * CMPP IS SNAKE_CASE THROUGHOUT -- `max_cache_age`, `per_role_limit`,
     * `stored_variant`, `external_ids`, `series_id`, `data_uri` -- so a camelCase
     * key is not a new field, it is an old field respelled. Cheap to check and it
     * catches the whole class rather than the four names anybody thought of.
     */
    describe("its spelling", () => {
      it("names every field in the contract's own casing, not a camelCase of it", async () => {
        const seen = [
          (await get(participant, "/")).body,
          (await get(participant, `/lookup/${encodeURIComponent(participant.aRecord)}`)).body,
          (await get(participant, `/search?q=${encodeURIComponent(participant.aQuery)}`)).body,
        ];

        // `(body) => ...` rather than a bare reference: `flatMap` passes the INDEX
        // as the second argument, which lands in the accumulator and makes every
        // response report a key called `0`. Caught by this test failing against a
        // provider whose keys are all correct.
        for (const camel of seen.flatMap((body) => camelCaseKeysIn(body))) {
          expect.fail(
            `\`${camel}\` is camelCase. CMPP is snake_case throughout, so this is either a ` +
              "contract field respelled -- which parses as an unknown extension while the real " +
              "field reads as absent -- or a new one that has to pick the contract's casing.",
          );
        }
      });
    });

    /**
     * WHAT A URL IS FOR, which the shape check above cannot ask.
     *
     * `z.url()` says a string parses as a URL and says nothing about its
     * SCHEME, so until CNCORE-79 the contract admitted `javascript:alert(1)`,
     * `data:text/html,...`, `vbscript:x` and `file:///etc/passwd` as a record's
     * `url` -- measured against zod 4.5.4 rather than reasoned about. ADR-0031's
     * whole position is that a provider is an untrusted URL rather than code we
     * run, and a provider able to put a `javascript:` URL in front of the Owner
     * is that position failing at the one place it has to hold.
     *
     * THE SCHEMA NOW REFUSES ONE, and `src/cmpp.test.ts` is where that is
     * asserted against all four schemes. This is the other half: that the real
     * providers actually send HTTP, checked against their live answers rather
     * than against the specification. A provider whose links stopped being
     * fetchable -- a relative path, a bare `www.`, an id where a URL belongs --
     * fails here rather than at whatever renders it.
     */
    describe("its urls", () => {
      it("sends an HTTP one everywhere the contract declares a URL", async () => {
        const declared = manifest.parse((await get(participant, "/")).body);
        const seen = [
          (await get(participant, `/lookup/${encodeURIComponent(participant.aRecord)}`)).body,
          (await get(participant, `/search?q=${encodeURIComponent(participant.aQuery)}`)).body,
          ...(declared.operations.includes(OPTIONAL_OPERATION) && participant.aContainer !== null
            ? [
                (await get(participant, `/browse/${encodeURIComponent(participant.aContainer)}`))
                  .body,
              ]
            : []),
        ];

        const urls = seen.flatMap((body) => contractUrlsIn(body));
        // A provider whose every operation answered with no URL at all would
        // pass a for-loop over nothing, which is the quiet version of this
        // check never having run. `url` is REQUIRED of a record and each of
        // these responses carries at least one.
        expect(urls.length).toBeGreaterThan(0);

        for (const url of urls) {
          expect(
            new URL(url).protocol,
            `\`${url}\` is not an HTTP URL. CMPP is an HTTP contract and every URL it carries is a ` +
              "CONTENT URL the reader's browser may be handed, so a scheme that executes or reads " +
              "the reader's disk is not one a provider may send (CNCORE-79).",
          ).toMatch(/^https?:$/);
        }
      });
    });

    describe("its browse, which it may decline", () => {
      it("answers a container and its ordering together, if it declares browse", async () => {
        const declared = manifest.parse((await get(participant, "/")).body);
        if (!declared.operations.includes(OPTIONAL_OPERATION)) {
          // THE OPTIONALITY, HONOURED RATHER THAN SKIPPED. A provider that
          // declines `browse` is well-formed, so there is nothing to assert about
          // an operation it never promised -- and the suite-level assertion below
          // is what stops this branch becoming a silent pass for everybody.
          expect(participant.aContainer).toBeNull();
          return;
        }

        const container = participant.aContainer;
        if (container === null)
          throw new Error(`${participant.name} declares browse with no fixture`);
        const response = await get(participant, `/browse/${encodeURIComponent(container)}`);

        expect(response.status).toBe(200);
        const browsed = browseResponse.parse(response.body);
        expect(browsed.container.id).toBe(container);
        // A container with an EMPTY ordering and no unplaced members is a browse
        // that answered nothing, which no fixture here is.
        expect(browsed.ordering.length + browsed.unplaced.length).toBeGreaterThan(0);
      });

      it("reports an id that addresses no container as an answer, if it declares browse", async () => {
        const declared = manifest.parse((await get(participant, "/")).body);
        if (!declared.operations.includes(OPTIONAL_OPERATION)) return;

        const response = await get(participant, "/browse/an-id-no-provider-mints");

        // ADR-0066: an id that cannot BE an identity addresses nothing, exactly as
        // one nobody minted does, and a caller must not be able to tell them apart.
        expect(response.status).toBe(404);
        expect(response.body).not.toBeNull();
      });
    });
  },
);

/**
 * THE ASSERTION CNCORE-8 EXISTS TO KEEP ALIVE, and the device that stops it being
 * retired by accident.
 *
 * The ticket asks the suite to assert that a provider which does not declare
 * `browse` still satisfies the contract, "written so CNCORE-17 landing does not
 * silently retire the assertion". CNCORE-17 HAS LANDED -- `provider-wiki` declares
 * `browse` now, and so does `provider-tmdb` -- so the asymmetry the ticket was
 * written against no longer exists in either real provider, and without this
 * nothing in version one would exercise ADR-0033's optionality at all.
 *
 * What keeps it alive is a PARTICIPANT that declines `browse` and goes through
 * every assertion above unchanged. What stops it being deleted as redundant is
 * this test: the suite fails if every participant declares `browse`, naming what
 * was lost. The failure mode it prevents is a quiet one -- a conformance rule
 * added later that assumes `browse`, with every provider under test happening to
 * offer it, so the rule looks universal and is not.
 */
describe("ADR-0033's optionality", () => {
  it("is exercised: something under test declines browse and conforms anyway", async () => {
    const declared = await Promise.all(
      underTest.map(async (participant) => ({
        name: participant.name,
        operations: manifest.parse((await get(participant, "/")).body).operations,
      })),
    );

    const declining = declared.filter((p) => !p.operations.includes(OPTIONAL_OPERATION));

    expect(
      declining.length,
      `Every provider under test declares \`${OPTIONAL_OPERATION}\`, so nothing here is checking that a provider may decline it. ` +
        "ADR-0033 makes it optional and CNCORE-8 exists to keep that case exercised. " +
        "Restore a participant that declines it rather than deleting this test.",
    ).toBeGreaterThan(0);

    // AND IT CONFORMS. Not merely present: everything above ran against it.
    for (const participant of declining) {
      expect(participant.operations).toEqual(expect.arrayContaining([...REQUIRED_OPERATIONS]));
    }
  });

  it("is exercised in the other direction too: something under test offers browse", async () => {
    const declared = await Promise.all(
      underTest.map(
        async (participant) => manifest.parse((await get(participant, "/")).body).operations,
      ),
    );

    // Otherwise every `browse` assertion above is skipping, and a suite where
    // every branch is the empty one is green for the wrong reason.
    expect(
      declared.some((operations) => operations.includes(OPTIONAL_OPERATION)),
      "Nothing under test declares `browse`, so every browse assertion is a no-op.",
    ).toBe(true);
  });
});
