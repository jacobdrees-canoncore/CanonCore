import { afterAll, describe, expect, it } from "vitest";

import {
  browseResponse,
  type CmppManifest,
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
 * A JSON POST, which the contract needs exactly one of: the unlock path.
 *
 * JSON RATHER THAN A FORM, and the suite taking a side here is the point. A
 * provider may accept anything else it likes -- `provider-wiki` also takes a
 * form submission, because the Owner arrives at a page -- but "a script can
 * supply the credential" (ADR-0122) is not a contract until the script knows
 * what to send. Two providers each picking their own body shape is how one
 * contract quietly becomes two integrations, which is this file's whole subject.
 */
async function post(participant: Participant, path: string, body: unknown) {
  const response = await fetch(`${participant.baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, text: await response.text() };
}

/**
 * WHAT A PROVIDER DECLARED ABOUT ITS OWN CREDENTIAL, READ BEFORE IT IS ASKED FOR
 * ANYTHING ELSE -- and the ORDER is the load-bearing part rather than a detail.
 *
 * The declaration is a PROMISE, and what the contract checks is the answer against
 * the promise that was standing when the call was made. Read afterwards instead,
 * a provider that reported `valid`, was refused by its upstream mid-call and came
 * back reporting `expired` would have its 503 excused by the very lapse the call
 * caused -- so the suite would go green on a provider that had just been refused,
 * which is the mis-diagnosis ADR-0122 exists to prevent arriving through the test
 * that checks it.
 *
 * IT ALSO KEEPS THE ORDERING HONEST. `its credential` below UNLOCKS every provider
 * that declares one, and it runs after these. Reordered so it ran first, a read
 * taken before each call reports `valid`, the strict branch is taken, and the
 * refusal that follows is RED -- which is what a reorder should be, rather than a
 * suite that quietly re-files the credential test's subject as a locked provider.
 */
async function declaredCredential(participant: Participant): Promise<CmppManifest["credential"]> {
  return manifest.parse((await get(participant, "/")).body).credential;
}

/**
 * Whether this provider is, right now, unable to reach its own source.
 *
 * BRANCHING ON WHAT A PROVIDER DECLARES, WHICH IS THE ONLY BRANCH THIS FILE
 * ALLOWS. Nothing here may ask which provider it is talking to; `credential.state`
 * is a declaration in the manifest, so this is the same kind of branch ADR-0033's
 * `browse` optionality gets and not an exception carved for one participant.
 *
 * `!== "valid"` RATHER THAN `=== "absent"`, and the two are not the same rule.
 * `expired` is a session that lapsed -- ADR-0122's whole reason for the state --
 * and a provider holding one can answer exactly as little as a provider holding
 * nothing. A contract that named only `absent` would oblige a provider whose
 * credential had just expired to invent an answer.
 */
function cannotReachItsSource(declared: CmppManifest["credential"]): boolean {
  return declared !== undefined && declared.state !== "valid";
}

/**
 * WHAT A PROVIDER OWES `search` AND `lookup` WHILE ITS DECLARED CREDENTIAL IS NOT
 * SATISFIED, which is the obligation CNCORE-141 added and ADR-0122 now records.
 *
 * `CONTEXT.md` states the claim in the product's own words, under **Unlock**: a
 * Provider with no Credential "stays reachable and answers nothing, saying so --
 * it is not broken and it is not empty". Those are TWO wrong answers rather than one, and the
 * contract has to refuse both:
 *
 * NOT BROKEN rules out a dropped connection, a bare 500 and a provider that
 * declines to start. ADR-0122 refuses the last by name -- refusing to start makes
 * a locked provider look like a dead host, which is the wrong diagnosis shown to
 * the one person who can fix it.
 *
 * NOT EMPTY rules out `200 {"results":[]}` from `search` and the `404` that
 * `lookup` owes an id its source genuinely does not hold. Both of those are CLAIMS
 * ABOUT THE SOURCE, and a provider that cannot reach its source is in no position
 * to make either; ADR-0122 refuses the `search` half by name too, because a
 * fallback corpus would make an expired session look like a thin wiki.
 *
 * `503` AND NOT MERELY "SOME REFUSAL". A contract that admitted any 5xx would
 * leave the second provider declaring a credential to pick its own, which is how
 * one contract quietly becomes two integrations -- this file's whole subject.
 * 503 is the status for a server that is up and cannot serve the request, and it
 * is what `provider-wiki` answers today.
 *
 * WHAT IS NOT ASSERTED: the body's SHAPE. `provider-wiki` sends `{error, provider}`
 * and that spelling is its own, not the contract's -- requiring it would be
 * writing "be provider-wiki" into the intersection, which is the mistake `cmpp.ts`
 * records itself having made once over an image's `width`. What a caller needs is
 * that SOMETHING came back, so a refusal carrying a reason can be told from a
 * provider that fell over.
 */
function expectSaysItCannotAnswer(response: Awaited<ReturnType<typeof get>>, path: string) {
  expect(
    response.status,
    `\`${path}\` answered ${response.status}. This provider declares a credential that is not ` +
      "`valid`, so it owes a 503: it stays reachable and answers nothing, SAYING SO (ADR-0122). " +
      "It is not broken, so a bare 500 is wrong; it is not empty, so a 200 with no results and a " +
      "404 are wrong -- each is a claim about a source this provider cannot currently reach.",
  ).toBe(503);
  expect(response.contentType).toContain("application/json");
  // A refusal with no body at all is indistinguishable from a provider that fell
  // over, which is the half the status on its own cannot carry.
  expect(response.body).not.toBeNull();
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
 * Every string under a key named `url` or `description_url`, however deeply
 * nested. Those are the contract's URL-bearing fields: a record's `url`, and an
 * image's `url` and `description_url`.
 *
 * BY KEY NAME RATHER THAN BY WHAT LOOKS LIKE A URL. A walk that judged anything
 * URL-shaped would report a value the contract deliberately allows to be
 * something else -- `attribution.logo.data_uri` is a `data:` URI ON PURPOSE
 * (ADR-0036), because a mark is fetched by the READER'S BROWSER, which nothing
 * promises can reach a provider on a private network. That field is in the
 * manifest, which is not among the bodies walked below; it is named here
 * because it is the standing example of why SHAPE is the wrong criterion.
 *
 * AN EXTENSION SPELLED `url` IS CAUGHT TOO, and that is the right answer rather
 * than over-reach. A record is a `looseObject`, so a provider may nest fields
 * the contract never declared -- but the objection to a `javascript:` URL has
 * nothing to do with whether this document named the field it arrived in.
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
        const declared = await declaredCredential(participant);
        const response = await get(
          participant,
          `/search?q=${encodeURIComponent(participant.aQuery)}`,
        );

        if (cannotReachItsSource(declared)) {
          expectSaysItCannotAnswer(response, "/search");
          return;
        }

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
        const declared = await declaredCredential(participant);
        const response = await get(participant, "/search?q=qzzx%20noitartsnomed%20yreuq");

        // THE ONE PLACE WHERE AN UNSATISFIED CREDENTIAL INVERTS THIS RULE RATHER
        // THAN QUALIFYING IT. "Nothing matched" is an ANSWER, and it is an answer
        // ABOUT THE SOURCE: a provider that cannot reach its own source has not
        // established that nothing matched, it has established that it does not
        // know. Reporting `[]` here would be the fallback ADR-0122 refuses by
        // name, in its cheapest form -- an empty corpus rather than a thin one.
        if (cannotReachItsSource(declared)) {
          expectSaysItCannotAnswer(response, "/search");
          return;
        }

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
        const declared = await declaredCredential(participant);
        const response = await get(
          participant,
          `/lookup/${encodeURIComponent(participant.aRecord)}`,
        );

        if (cannotReachItsSource(declared)) {
          expectSaysItCannotAnswer(response, "/lookup");
          return;
        }

        expect(response.status).toBe(200);
        const found = record.parse(response.body);
        // IDENTITY RATHER THAN DATA, which is why this is the one value asserted:
        // a provider that answered a different record's id would break every
        // refresh downstream, and nothing else here would notice.
        expect(found.id).toBe(participant.aRecord);
      });

      it("reports an id it does not hold as an answer, not as a failure", async () => {
        const declared = await declaredCredential(participant);
        const response = await get(participant, "/lookup/an-id-no-provider-mints");

        // AND "DOES NOT HOLD IT" IS ITSELF A CLAIM ABOUT THE SOURCE. A 404 says
        // the source has no such record, which a provider that cannot reach the
        // source is in no position to say -- it cannot tell an id nobody minted
        // from one it simply cannot look up. So the refusal displaces this answer
        // exactly as it displaces a record, and for the same reason.
        if (cannotReachItsSource(declared)) {
          expectSaysItCannotAnswer(response, "/lookup");
          return;
        }

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
        //
        // THE FLOOR MOVES FOR A PROVIDER THAT CANNOT ANSWER; THE RULE BELOW DOES
        // NOT. A refusal carries no record and so no URL, so holding a locked
        // provider to "at least one" would demand a URL from a provider the
        // contract has just excused from answering. What stops that becoming the
        // silent no-op this floor exists to prevent is `ADR-0122's optionality`
        // below: something under test always DECLINES a credential, is never
        // locked, and meets the floor. Today `provider-wiki` clears it anyway
        // through `browse`, which still reads its committed fixture; CNCORE-102
        // moves that operation live too, and this line is already right for it.
        if (!cannotReachItsSource(declared.credential)) expect(urls.length).toBeGreaterThan(0);

        for (const url of urls) {
          // `URL.parse` RATHER THAN `new URL`, because the constructor THROWS on
          // a string that is not an absolute URL -- and a relative path, a bare
          // `www.` and an id where a URL belongs are exactly the cases this test
          // promises to catch. Thrown, the failure reads `TypeError: Invalid
          // URL` with neither the offending value nor the sentence below, which
          // is the message going missing precisely where it was written to fire.
          const scheme = URL.parse(url)?.protocol ?? "(not an absolute URL at all)";
          expect(
            scheme,
            `\`${url}\` is not an HTTP URL. CMPP is an HTTP contract and every URL it carries is a ` +
              "CONTENT URL the reader's browser may be handed, so a scheme that executes or reads " +
              "the reader's disk is not one a provider may send (CNCORE-79).",
          ).toMatch(/^https?:$/);
        }
      });
    });

    /**
     * WHAT A PROVIDER NEEDS IN ORDER TO ANSWER, AND BEING GIVEN IT (ADR-0122).
     *
     * DECLINED BY DEFAULT, like `browse` and for a different reason: `browse` is
     * an operation a provider may not offer, and this is an upstream that may
     * want nothing. `provider-tmdb` declares no credential and is untouched by
     * the field existing, which is the whole basis on which it could be added to
     * a shipped contract at all.
     *
     * **THIS SUITE UNLOCKS EVERY PROVIDER THAT DECLARES A CREDENTIAL.** That is
     * not a side effect to be tidied away: ADR-0122 makes the round trip the claim
     * -- POST the declared fields at the declared path, and the provider reports
     * `valid` -- and there is no way to assert it without performing it. CI is
     * where this runs, against ephemeral service containers.
     *
     * IT WILL NOT OVERWRITE A CREDENTIAL IT DID NOT PUT THERE, and that guard is
     * in code rather than in a README because the thing it protects is the Owner's
     * real session. A provider already reporting `valid` or `expired` is holding
     * something somebody supplied, and replacing it with a dummy would leave that
     * provider reporting `valid` about garbage -- the exact mis-diagnosis ADR-0122
     * exists to prevent, caused by the suite that checks it. So the round trip
     * runs from `absent` and FAILS LOUDLY otherwise rather than skipping, because
     * a skip is how an assertion stops running without anybody noticing.
     *
     * IT IS NOT CANONCORE CARRYING A CREDENTIAL, which ADR-0122 forbids. This
     * package depends on no `@canoncore/*` package and the app is absent from
     * this seam entirely; what posts here is a conformance harness standing in
     * for the Owner's own browser, which is exactly who the ADR says supplies it.
     */
    describe("its credential, which it may decline", () => {
      it("declares a path the Owner can actually reach, if it declares a credential", async () => {
        const declared = manifest.parse((await get(participant, "/")).body).credential;
        if (declared === undefined) return;

        // The Owner clicks a LINK in CanonCore's settings surface and arrives
        // here (ADR-0122), so a declared path that addresses nothing is the one
        // failure that leaves them with no way in at all. Reachable rather than
        // HTML: a provider may serve a form, or redirect to wherever its own
        // upstream takes a person.
        const reached = await fetch(`${participant.baseUrl}${declared.unlock_path}`);

        expect(
          reached.status,
          `\`${declared.unlock_path}\` is declared as this provider's unlock path and does not answer.`,
        ).toBeLessThan(400);
      });

      it("takes the fields it declared, at the path it declared, and then reports valid", async () => {
        const before = manifest.parse((await get(participant, "/")).body).credential;
        if (before === undefined) return;

        expect(
          before.state,
          `${participant.name} already holds a credential, and this suite will not replace one it ` +
            "did not supply: a dummy value would leave it reporting `valid` about garbage. Point " +
            "PROVIDER_WIKI_URL/PROVIDER_TMDB_URL at a provider with an empty configuration " +
            "directory -- which is what CI's service containers are -- and run it again.",
        ).toBe("absent");

        const supplied = await post(
          participant,
          before.unlock_path,
          Object.fromEntries(
            before.fields.map((field) => [
              field.name,
              "a value supplied by CanonCore's contract suite",
            ]),
          ),
        );

        expect(supplied.status).toBeLessThan(400);
        const after = manifest.parse((await get(participant, "/")).body).credential;
        // VALID MEANS "I HOLD ONE AND NOTHING HAS REFUSED IT YET", which is all
        // it has ever meant -- the provider cannot check a credential without
        // doing its own job, and a dummy value is indistinguishable from a real
        // one until an upstream says otherwise.
        expect(after?.state).toBe("valid");
        // AND THE MOMENT MOVED. Without this the assertion above passes against a
        // provider that reported `valid` before the POST and ignored it: the
        // state alone cannot tell "it took what I sent" from "it was already
        // like that".
        expect(after?.state_changed_at).not.toBeNull();
        expect(after?.state_changed_at).not.toBe(before.state_changed_at);
      });

      it("refuses a submission missing a field it declared, if it declares a credential", async () => {
        const declared = manifest.parse((await get(participant, "/")).body).credential;
        if (declared === undefined) return;

        // A FAILURE MODE RATHER THAN A VALUE. Half a credential stored is a
        // provider reporting `valid` about something its upstream is about to
        // refuse, which points the Owner's diagnosis at the wiki for a fault
        // that is in the form they just submitted.
        const supplied = await post(participant, declared.unlock_path, {});

        expect(supplied.status).toBe(400);
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

/**
 * ADR-0122'S OPTIONALITY, KEPT EXERCISED IN BOTH DIRECTIONS -- the same device
 * ADR-0033's `browse` gets above, and for the same reason.
 *
 * A credential declaration is an addition to a shipped contract, and the entire
 * basis on which it could be added is that a provider wanting nothing declares
 * nothing and is untouched. Both halves of that have to be under test or the
 * claim is only half-checked: with nothing declaring one, every assertion in
 * "its credential" is a no-op returning early; with nothing declining one, the
 * field has quietly become required and nobody would find out until a third
 * provider appeared.
 */
describe("ADR-0122's optionality", () => {
  it("is exercised: something under test declares a credential, and something declares none", async () => {
    const declared = await Promise.all(
      underTest.map(async (participant) => ({
        name: participant.name,
        credential: manifest.parse((await get(participant, "/")).body).credential,
      })),
    );

    expect(
      declared.filter((p) => p.credential !== undefined).length,
      "Nothing under test declares a credential, so every assertion in `its credential` returned early. " +
        "ADR-0122 makes the declaration optional and this suite is what proves it works at all. " +
        "Restore a participant that declares one rather than deleting this test.",
    ).toBeGreaterThan(0);

    expect(
      declared.filter((p) => p.credential === undefined).length,
      "Every provider under test declares a credential, so nothing here is checking that a provider " +
        "may decline one. That optionality is why ADR-0122 could be added to a shipped contract " +
        "without moving its version (ADR-0032), and a required field would break every provider that " +
        "already exists on the day it landed.",
    ).toBeGreaterThan(0);
  });
});
