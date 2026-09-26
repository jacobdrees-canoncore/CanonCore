import { afterAll, describe, expect, it } from "vitest";

import {
  BROWSE_OPERATION,
  browseResponse,
  type CmppManifest,
  CONTAINERS_OPERATION,
  containersResponse,
  manifest,
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

/**
 * WHAT EACH PARTICIPANT DID WITH THE CREDENTIAL IT WAS GIVEN: written by the round
 * trip in `its credential`, read by `ADR-0122's optionality` at the end of the file.
 *
 * A RECORD OF WHAT RAN rather than an inference from each manifest afterwards,
 * because what the guard claims is that the ASSERTION ran. Read out of order, or
 * with the round trip deleted, it is empty and the guard fails -- which is the
 * direction a guard has to fail in.
 */
const unlockAnswers: { name: string; outcome: "held" | "refused" }[] = [];

/**
 * WHAT EACH PARTICIPANT'S RECORDS CARRIED BEYOND THE REQUIRED HALF: written by
 * `its keys`, read by `the open wire` at the end of the file. A record of what
 * RAN, for the reason `unlockAnswers` gives of its own.
 */
const keysSent: { name: string; externalIds: boolean; sourceDefined: string[] }[] = [];

/**
 * THE FIELDS EACH IMAGE A PARTICIPANT'S LOOKUP SENT CARRIED, one sorted list per
 * image: written by `its lookup`, read by `an image reference` at the end of the
 * file (CNCORE-358).
 */
const imagesSent: { name: string; fields: string[] }[] = [];

afterAll(async () => {
  await Promise.all(underTest.map((participant) => participant.close()));
});

async function get(participant: Participant, path: string) {
  return read(await fetch(`${participant.baseUrl}${path}`));
}

/**
 * An answer as every assertion here reads it. SHARED BY THE GET AND THE POST,
 * because a refused Unlock owes the same "a reason came back" a refused `search`
 * does, and two readers are two places for that check to mean different things.
 */
async function read(response: Response) {
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
  return read(response);
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
 * that holds what it is given, and it runs after these. Reordered so it ran first, a
 * read taken before each call to such a provider reports `valid`, the strict branch
 * is taken, and the refusal that follows is RED -- which is what a reorder should
 * be, rather than a suite that quietly re-files the credential test's subject as a
 * locked provider. A provider that Spends refuses the suite's value and is still
 * `absent` afterwards (CNCORE-207), so it takes the refusal branch in either order.
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
 * NOT EMPTY rules out `200 {"results":[]}`: "nothing matched" is a claim ABOUT THE
 * SOURCE, and a provider that cannot reach its source has not established it, it
 * has established that it does not know. ADR-0122 refuses that one by name -- it
 * is the fallback corpus in its cheapest form, an empty one rather than a thin
 * one, and it would make an expired session look like a thin wiki.
 *
 * WHAT THE REFUSAL DOES NOT DISPLACE IS THE CALLER'S OWN MISTAKE. A missing or
 * blank `q` is still `400` and an id that addresses nothing in the provider's own
 * id space is still `404`, because both are settled BEFORE the source is reached
 * and neither is a claim about it. Turning those into refusals too would hide a
 * caller who forgot the parameter behind a credential problem.
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
 * A key as a respelling would reduce to: no case, no separator, no plural.
 * `externalIds`, `EXTERNAL_IDS`, `externalid` and `external-id` all come to
 * `externalid`, which is what makes a respelled contract field distinguishable
 * from a property the source genuinely defines under a name of its own.
 */
function spelledAs(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "").replace(/s$/, "");
}

/** Snake_case as CMPP spells it: lower case, digits, single underscores between words. */
const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

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
        const path = `/search?q=${encodeURIComponent(participant.aQuery)}`;
        const response = await get(participant, path);

        if (cannotReachItsSource(declared)) {
          expectSaysItCannotAnswer(response, path);
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
        const path = "/search?q=qzzx%20noitartsnomed%20yreuq";
        const response = await get(participant, path);

        // THE ONE PLACE WHERE AN UNSATISFIED CREDENTIAL INVERTS THIS RULE RATHER
        // THAN QUALIFYING IT. "Nothing matched" is an ANSWER, and it is an answer
        // ABOUT THE SOURCE: a provider that cannot reach its own source has not
        // established that nothing matched, it has established that it does not
        // know. Reporting `[]` here would be the fallback ADR-0122 refuses by
        // name, in its cheapest form -- an empty corpus rather than a thin one.
        if (cannotReachItsSource(declared)) {
          expectSaysItCannotAnswer(response, path);
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
        const path = `/lookup/${encodeURIComponent(participant.aRecord)}`;
        const response = await get(participant, path);

        if (cannotReachItsSource(declared)) {
          expectSaysItCannotAnswer(response, path);
          return;
        }

        expect(response.status).toBe(200);
        const found = record.parse(response.body);
        // IDENTITY RATHER THAN DATA, which is why this is the one value asserted:
        // a provider that answered a different record's id would break every
        // refresh downstream, and nothing else here would notice.
        expect(found.id).toBe(participant.aRecord);
      });

      /**
       * EVERY IMAGE IT SENDS NAMES WHAT IT IS FOR AND WHERE ITS BYTES ARE, and
       * that is all the contract requires of one (ADR-0033). `record.parse`
       * above already refuses an image missing either; this names the two so
       * a failure says which, and records what else each image carried for the
       * check at the end of the file.
       */
      it("files each image it sends with a role and an HTTP url", async () => {
        const declared = await declaredCredential(participant);
        const response = await get(
          participant,
          `/lookup/${encodeURIComponent(participant.aRecord)}`,
        );
        if (cannotReachItsSource(declared)) return;

        const { images = [] } = record.parse(response.body);
        for (const image of images) {
          expect(image.role.length, "an image with no role").toBeGreaterThan(0);
          expect(new URL(image.url).protocol, `\`${image.url}\` is not an HTTP url`).toMatch(
            /^https?:$/,
          );
          imagesSent.push({ name: participant.name, fields: Object.keys(image).sort() });
        }
      });

      it("reports an id it does not hold as an answer, not as a failure", async () => {
        const response = await get(participant, "/lookup/an-id-no-provider-mints");

        // NOT BRANCHED ON THE CREDENTIAL, AND THE MEASUREMENT IS WHY. This id
        // cannot BE an identity in either provider's id space, so a provider
        // settles it without its source and an unsatisfied credential changes
        // nothing -- the same seam as the missing `q` above. `provider-wiki`
        // rejects anything but `^\d{1,18}$` before the wiki is reached
        // (ADR-0066), and CI's locked run proves the contract already had this
        // right: three assertions went red against a locked `provider-wiki` and
        // this one did not.
        //
        // WHAT IS THEREFORE NOT UNDER TEST is a WELL-FORMED id the provider
        // would have to consult its source about, which a locked provider owes
        // a refusal rather than this 404. No fixture here is one, and inventing
        // an id that is well-formed for every provider at once is a claim about
        // their id spaces that CMPP does not make.

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
     * WHAT A RECORD CARRIES BEYOND THE REQUIRED HALF, NAMED AND SHAPED
     * (CNCORE-349).
     *
     * `record` is a `looseObject`, so a key the contract does not name parses
     * whatever it is -- which makes a property the SOURCE defines and a typo of
     * a contract field indistinguishable to a shape check. Both "arrive". So
     * every key is put to one of two tests and never neither: a key the contract
     * NAMES is held to that field's own shape, one at a time, and a key it does
     * not is held to the contract's casing and to not being a respelling of a
     * field it does name. `externalIds` fails the second; `production_code`
     * passes it and is the source's own.
     *
     * A PROVIDER SENDING NEITHER IS UNAFFECTED, since there is then nothing to
     * test -- and `the open wire` below is what stops that being the whole suite.
     */
    describe("its keys", () => {
      it("sends each key the contract names in its shape, and each it does not as a name of its source's own", async () => {
        const declared = await declaredCredential(participant);
        if (cannotReachItsSource(declared)) return;

        const lookup = await get(participant, `/lookup/${encodeURIComponent(participant.aRecord)}`);
        const search = await get(
          participant,
          `/search?q=${encodeURIComponent(participant.aQuery)}`,
        );
        const records = [lookup.body, ...searchResponse.parse(search.body).results] as Record<
          string,
          unknown
        >[];

        const named = new Map(Object.entries(record.shape));
        const respellable = new Map([...named.keys()].map((key) => [spelledAs(key), key]));
        const sourceDefined = new Set<string>();

        for (const sent of records) {
          for (const [key, value] of Object.entries(sent)) {
            const field = named.get(key);
            if (field !== undefined) {
              expect(
                field.safeParse(value).success,
                `\`${key}\` is a contract field and does not have the shape the contract declares for it.`,
              ).toBe(true);
              continue;
            }
            expect(
              key,
              `\`${key}\` is not snake_case. A property a source defines is spelled the way every ` +
                "contract field is (ADR-0033), so a later contract naming it needs no respelling.",
            ).toMatch(SNAKE_CASE);
            expect(
              respellable.get(spelledAs(key)),
              `\`${key}\` respells the contract's own field, so it parses as a property of the ` +
                "source's while the field it meant reads as absent.",
            ).toBeUndefined();
            sourceDefined.add(key);
          }
        }

        keysSent.push({
          name: participant.name,
          externalIds: records.some((sent) => "external_ids" in sent),
          sourceDefined: [...sourceDefined],
        });
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
          ...(declared.operations.includes(BROWSE_OPERATION) && participant.aContainer !== null
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
        // locked, and meets the floor.
        //
        // AND THAT WITNESS IS NOW THE ONLY THING HOLDING IT UP (CNCORE-263). This
        // comment used to add that `provider-wiki` cleared the floor anyway
        // through `browse`, "which still reads its committed fixture", with
        // CNCORE-102 named as future work. That ticket has landed: `browse` reads
        // the live wiki and answers 503 without a credential, which the
        // `browse` row below states in the same file. A locked `provider-wiki`
        // contributes no URL to this floor at all.
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
     * **THIS SUITE UNLOCKS EVERY PROVIDER THAT HOLDS WHAT IT IS GIVEN.** That is
     * not a side effect to be tidied away: ADR-0122 makes the round trip the claim
     * -- POST the declared fields at the declared path, and the provider either
     * holds them and reports `valid`, or Spends them, is refused, and says why --
     * and there is no way to assert it without performing it. CI is where this
     * runs, against ephemeral service containers. It read "every provider that
     * declares a credential" until CNCORE-207, when `provider-wiki` began Spending
     * what it is given and refusing the suite's value.
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

      it("takes the fields it declared, at the path it declared, and holds them or says why not", async () => {
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
        const after = manifest.parse((await get(participant, "/")).body).credential;

        /*
         * REFUSED, WHICH A PROVIDER MAY ANSWER SINCE CNCORE-207 -- IN ONE WAY ONLY.
         *
         * A provider that SPENDS what it is given learns what one that only stores it
         * cannot: whether its upstream accepts it (ADR-0122). This value is one no
         * upstream would, so a provider that Spends it meets a refusal, and holding it
         * anyway would report `valid` about something refused a second earlier.
         *
         * `400` AND NOT MERELY "SOME REFUSAL", for the reason the 503 above is pinned:
         * a contract that let each provider pick its own status would quietly become
         * two integrations. It is right on the merits as well. What failed is the
         * SUBMISSION, which is a fault in the request just made; 401 and 403 describe
         * the caller's standing with the provider, and that is not what happened.
         *
         * AND IT CHANGES NOTHING: the state and the moment it last changed are both
         * what they were. From `absent` that catches a refused value stored anyway,
         * and one recorded as a lapse. The same rule protects a credential the
         * provider already HOLDS -- nothing authenticates this route, so a refusal
         * that wrote anything would let anyone who can reach the port mark the Owner's
         * working session `expired` with a value they made up -- but this suite will
         * not touch a held one, so `participants.test.ts` asserts that half against
         * the witness.
         */
        if (supplied.status === 400) {
          expect(supplied.contentType).toContain("application/json");
          // A refusal with no body is indistinguishable from a provider that fell
          // over, which is what the status on its own cannot carry.
          expect(supplied.body).not.toBeNull();
          expect(after?.state).toBe(before.state);
          expect(after?.state_changed_at).toBe(before.state_changed_at);
          unlockAnswers.push({ name: participant.name, outcome: "refused" });
          return;
        }

        expect(
          supplied.status,
          `\`${before.unlock_path}\` answered ${supplied.status} to a complete submission. It owes one ` +
            "of two answers (ADR-0122): below 400, holding what it was given and reporting `valid`; or " +
            "400 with a reason, having Spent it and been refused, and holding nothing new.",
        ).toBeLessThan(400);
        // VALID MEANS "I HOLD ONE AND NOTHING HAS REFUSED IT YET", which is all it
        // has ever meant. A provider that does not Spend cannot tell this value from
        // a real one until an upstream says otherwise, and neither can one that
        // Spends but could not reach its upstream to do it.
        expect(after?.state).toBe("valid");
        // AND THE MOMENT MOVED. Without this the assertion above passes against a
        // provider that reported `valid` before the POST and ignored it: the
        // state alone cannot tell "it took what I sent" from "it was already
        // like that".
        expect(after?.state_changed_at).not.toBeNull();
        expect(after?.state_changed_at).not.toBe(before.state_changed_at);
        unlockAnswers.push({ name: participant.name, outcome: "held" });
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
        if (!declared.operations.includes(BROWSE_OPERATION)) {
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
        const path = `/browse/${encodeURIComponent(container)}`;
        const response = await get(participant, path);

        /*
         * `browse` OWES THE SAME REFUSAL `search` AND `lookup` DO, and this branch
         * is CNCORE-102's half of CNCORE-141. ADR-0122's obligation is about a
         * provider that cannot reach ITS SOURCE, and it never said "except for
         * browse" -- but until `provider-wiki` moved `browse` to the live wiki, no
         * participant could demonstrate it: that operation read a file on disk, so
         * it answered a container whatever the credential said. It answers `503`
         * now, and a contract that still demanded `200` here would be holding the
         * one provider that obeys ADR-0122 to breaking it.
         *
         * SO THE RULE IS "A CONTAINER, OR A CONFORMANT REFUSAL", AND NOTHING ELSE.
         * What it deliberately does NOT do is check the manifest's `credential`
         * first, the way `search` and `lookup` above do. Those read it BEFORE the
         * call and branch on it; by the time this runs, `its credential` has
         * unlocked every provider that holds what it is given, so such a manifest
         * reports `valid` about a value the upstream has never seen, while one
         * that Spends has refused that value and still reports `absent` -- and a
         * provider can be unable to answer for reasons that are not its
         * credential at all.
         * `provider-wiki` answers 503 with a VALID credential when the wiki
         * declines a query as too large, which is honest and which an assertion
         * keyed on `credential.state` would call a contract breach.
         *
         * WHAT STOPS THIS BECOMING A PERMISSION TO REFUSE EVERYTHING is the same
         * device the other operations lean on: `ADR-0122's optionality` below
         * holds at least one participant to ANSWERING, and `provider-tmdb`
         * declares no credential at all, so the 200 path here is exercised on
         * every run rather than excused on every run.
         */
        if (response.status !== 200) {
          expectSaysItCannotAnswer(response, path);
          return;
        }

        const browsed = browseResponse.parse(response.body);
        expect(browsed.container.id).toBe(container);
        // A container with an EMPTY ordering and no unplaced members is a browse
        // that answered nothing, which no fixture here is.
        expect(browsed.ordering.length + browsed.unplaced.length).toBeGreaterThan(0);
      });

      it("reports an id that addresses no container as an answer, if it declares browse", async () => {
        const declared = manifest.parse((await get(participant, "/")).body);
        if (!declared.operations.includes(BROWSE_OPERATION)) return;

        const response = await get(participant, "/browse/an-id-no-provider-mints");

        // ADR-0066: an id that cannot BE an identity addresses nothing, exactly as
        // one nobody minted does, and a caller must not be able to tell them apart.
        expect(response.status).toBe(404);
        expect(response.body).not.toBeNull();
      });
    });

    describe("its containers, which it may decline", () => {
      it("answers the containers it holds, if it declares the operation", async () => {
        const declared = manifest.parse((await get(participant, "/")).body);
        if (!declared.operations.includes(CONTAINERS_OPERATION)) return;

        const path = `/${CONTAINERS_OPERATION}`;
        const response = await get(participant, path);

        // The same reading `browse` gets one block up, and for the same reason:
        // a provider that cannot reach its source owes the refusal rather than an
        // answer, and the manifest's `credential` is not what decides it here --
        // after `its credential` it no longer says whether this call can be
        // answered, for the reasons `browse` gives.
        if (response.status !== 200) {
          expectSaysItCannotAnswer(response, path);
          return;
        }

        // Records rather than ids, which is the whole of the shape: a container
        // arrives ready to show the Owner rather than as a handle to look up.
        expect(() => containersResponse.parse(response.body)).not.toThrow();
      });

      it("offers ids that browse, if it declares the operation", async () => {
        const declared = manifest.parse((await get(participant, "/")).body);
        if (!declared.operations.includes(CONTAINERS_OPERATION)) return;

        const listed = await get(participant, `/${CONTAINERS_OPERATION}`);
        if (listed.status !== 200) return;
        const { containers } = containersResponse.parse(listed.body);
        // A provider that holds none is answering, not failing, exactly as an
        // empty `results` is an answer -- so there is nothing to follow.
        const first = containers[0];
        if (first === undefined) return;

        /*
         * AN ID IS A PATH SEGMENT HERE, AND IT CAME OUT OF A PROVIDER'S ANSWER.
         * `encodeURIComponent` leaves `.` alone, so `..` would walk the request
         * up to the manifest and fail below as a shape error -- a real defect
         * reported as the wrong one. The contract does not bound an id beyond
         * being a non-empty string, so this is the suite refusing to be misled
         * rather than a rule about ids.
         */
        expect(
          [".", ".."],
          `\`/${CONTAINERS_OPERATION}\` offered ${JSON.stringify(first.id)} as a container id, which addresses this provider's own root rather than a container.`,
        ).not.toContain(first.id);

        const path = `/browse/${encodeURIComponent(first.id)}`;
        const response = await get(participant, path);

        /*
         * THE OPERATION'S WHOLE CLAIM, AND THE ONLY ONE WORTH ASSERTING BEYOND
         * SHAPE. It exists so that browsing does not require knowing an id first
         * (ADR-0033), so an id it hands over that `browse` will not serve is a
         * page of dead ends that satisfies every shape rule. The manifest rule
         * that a lister must declare `browse` is the same claim one layer up;
         * this is it holding on the wire.
         *
         * ONE CONTAINER AND NOT ALL OF THEM. `provider-wiki` lists 465, and a
         * suite that browsed each would be an import rather than a contract test
         * -- the largest of them took 43.8s end to end when CNCORE-159 measured
         * it. What is under test is that a listed id is an id of the same kind
         * `browse` takes, and one witness to that is the claim.
         */
        /*
         * A 503 IS THE ONE REFUSAL THIS TOLERATES, and every other answer is the
         * defect the test exists to catch. A 404 here is a container the provider
         * LISTED and will not serve, so routing it through the credential
         * refusal would report the operation's own failure as somebody else's:
         * ADR-0122's message says the provider "cannot currently reach its
         * source", which is exactly what a 404 does not say.
         */
        if (response.status === 503) {
          expectSaysItCannotAnswer(response, path);
          return;
        }

        expect(
          response.status,
          `\`${path}\` answered ${response.status} for an id this provider itself listed at ` +
            `\`/${CONTAINERS_OPERATION}\`. The operation exists so that browsing needs no id known in advance ` +
            "(ADR-0033), so an id it offers that `browse` will not serve is a page of dead ends that satisfies " +
            "every shape rule in this file.",
        ).toBe(200);
        expect(browseResponse.parse(response.body).container.id).toBe(first.id);
      });

      it("has nothing at that path if it declines the operation", async () => {
        const declared = manifest.parse((await get(participant, "/")).body);
        if (declared.operations.includes(CONTAINERS_OPERATION)) return;

        const response = await get(participant, `/${CONTAINERS_OPERATION}`);

        /*
         * AN ABSENT CAPABILITY IS NOT AN EMPTY ANSWER, which is the one confusion
         * this operation exists to prevent. `200 {"containers":[]}` is a claim
         * ABOUT THE SOURCE -- it says this provider holds none -- and a provider
         * that does not do this at all has established no such thing. A 5xx is
         * the other wrong answer: declining an optional operation is well-formed,
         * not broken.
         *
         * 404 AND NOT 501, and the choice is what lets the rule bind a provider
         * that has never heard of the operation. RFC 9110 gives 404 as "the
         * origin server did not find a current representation for the target
         * resource", which is exactly true of a path a provider does not serve,
         * and it is what every router answers for one anyway -- so the contract
         * can require it of a decliner without obliging anybody to add a route on
         * the day the operation lands, which is the argument ADR-0032 settles
         * every optional addition by. 501's only MUST in RFC 9110 is about an
         * unrecognised METHOD, and the method here is GET.
         *
         * IT CANNOT BE CONFUSED WITH THE OTHER 404 THIS CONTRACT NAMES, because
         * this path carries no id. `browse` answers 404 for a container nobody
         * minted (ADR-0066); there is nothing here whose absence could be the
         * reason, so the status has one meaning at this address.
         *
         * THE BODY IS NOT ASSERTED, where a declared refusal's is. Both real
         * providers answer their framework's plain-text 404 here, and requiring
         * JSON would be the contract obliging a provider to write a route for an
         * operation it never promised -- which is the cost this whole reading is
         * chosen to avoid.
         */
        expect(
          response.status,
          `\`/${CONTAINERS_OPERATION}\` answered ${response.status} at a provider that does not declare the ` +
            "operation. An absent capability is not an empty answer and it is not a fault: a 200 is a claim " +
            "about a source this provider never consulted, and a 5xx says it is broken when it is well-formed.",
        ).toBe(404);
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

    const declining = declared.filter((p) => !p.operations.includes(BROWSE_OPERATION));

    expect(
      declining.length,
      `Every provider under test declares \`${BROWSE_OPERATION}\`, so nothing here is checking that a provider may decline it. ` +
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
      declared.some((operations) => operations.includes(BROWSE_OPERATION)),
      "Nothing under test declares `browse`, so every browse assertion is a no-op.",
    ).toBe(true);
  });

  it("is exercised for `containers` too, in both directions", async () => {
    const declared = await Promise.all(
      underTest.map(
        async (participant) => manifest.parse((await get(participant, "/")).body).operations,
      ),
    );

    // THE SAME DEVICE THE TWO ABOVE ARE, pointed at the operation CNCORE-185
    // added. Without the first half every assertion in `its containers` returns
    // early and the suite is green because nobody was asked; without the second
    // the contract has quietly made an optional operation required, and nothing
    // would find out until a third provider appeared.
    expect(
      declared.some((operations) => operations.includes(CONTAINERS_OPERATION)),
      `Nothing under test declares \`${CONTAINERS_OPERATION}\`, so every assertion in \`its containers\` is a no-op.`,
    ).toBe(true);

    expect(
      declared.filter((operations) => !operations.includes(CONTAINERS_OPERATION)).length,
      `Every provider under test declares \`${CONTAINERS_OPERATION}\`, so nothing here is checking that a provider may decline it. ` +
        "ADR-0033 makes it optional for the reason it makes `browse` optional -- a source with no way to enumerate " +
        "its own containers is still a source. Restore a participant that declines it rather than deleting this test.",
    ).toBeGreaterThan(0);
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

  /**
   * AND THE REFUSAL IS A PERMISSION, NEVER A BRANCH THE WHOLE SUITE MAY TAKE.
   *
   * CNCORE-141 let a provider whose declared credential is not `valid` answer
   * `503` to `search` and `lookup` instead of a record. With every participant in
   * that state, every one of those assertions would check a refusal and NOTHING
   * would hold anybody to `200` and a record -- the contract's central claim,
   * green because nobody was asked. This is the same device `browse` gets above,
   * pointed at the branch this ticket added.
   */
  it("is exercised in the other direction: something under test is held to ANSWERING", async () => {
    const declared = await Promise.all(
      underTest.map(async (participant) => ({
        name: participant.name,
        credential: manifest.parse((await get(participant, "/")).body).credential,
      })),
    );

    expect(
      declared.filter((p) => !cannotReachItsSource(p.credential)).map((p) => p.name),
      "Every provider under test is currently unable to reach its source, so every `search`, " +
        "`lookup` and `browse` assertion took CNCORE-141's refusal branch and nothing checked " +
        "that a provider able to answer still owes `200` and a record. That branch is a " +
        "permission for a provider that cannot answer, never one the whole suite may take.",
    ).not.toHaveLength(0);
  });

  /**
   * AND AN UNLOCK IS EXERCISED IN BOTH ITS ANSWERS, which is the same device again,
   * pointed at the branch CNCORE-207 added.
   *
   * WITH NOBODY HOLDING WHAT IT WAS GIVEN, "refuses everything" would pass for
   * "Spent it and was refused". The suite holds no value any upstream accepts, so it
   * cannot tell those two apart by asking: what keeps the refusal a permission is
   * that something under test is still held to HOLDING. `provider-tmdb` declares no
   * credential, so today that is the locked witness and nothing else.
   *
   * WITH NOBODY REFUSING, the rule that a refusal changes nothing is a branch
   * nothing enters -- as it would be on any machine that cannot pull
   * `provider-wiki`, but for the witness that Spends.
   */
  it("is exercised in both answers to an Unlock: something held what it was given, and something refused it", () => {
    expect(
      unlockAnswers.filter((answer) => answer.outcome === "held").map((answer) => answer.name),
      "Nothing under test held the credential it was given, so every round trip took CNCORE-207's " +
        "refusal branch and nothing checked that a provider can be Unlocked at all. The suite holds " +
        "no value any upstream accepts, so a provider refusing everything would pass for one that " +
        "Spends. Restore a participant that holds what it is given rather than deleting this test.",
    ).not.toHaveLength(0);

    expect(
      unlockAnswers.filter((answer) => answer.outcome === "refused").map((answer) => answer.name),
      "Nothing under test refused the credential it was given, so the rule that a refusal changes " +
        "nothing is a branch no participant entered. Restore the witness that Spends rather than " +
        "deleting this test.",
    ).not.toHaveLength(0);
  });
});

/**
 * THE OPEN WIRE IS EXERCISED IN ALL THREE WAYS A RECORD CAN USE IT (CNCORE-349).
 *
 * `its keys` holds a record's extra keys to a name and a shape, and returns
 * having checked nothing for a provider sending none -- which is the wiki's
 * every record, and is conformant. With nothing sending `external_ids`, or
 * nothing sending a property of its source's own, those assertions are a loop
 * over nothing and the suite is green because nobody was asked. The witness
 * ahead of the contract is what sends both whether or not a real provider does.
 */
describe("the open wire", () => {
  it("is exercised: something sends ids in other id spaces, something a property its source defines, and something neither", () => {
    expect(
      keysSent.filter((sent) => sent.externalIds).map((sent) => sent.name),
      "Nothing under test sent `external_ids`, so its shape was never checked on the wire.",
    ).not.toHaveLength(0);
    expect(
      keysSent.filter((sent) => sent.sourceDefined.length > 0).map((sent) => sent.name),
      "Nothing under test sent a property its source defines, so nothing checked that one is " +
        "named in the contract's casing and is not a contract field respelled.",
    ).not.toHaveLength(0);
    expect(
      keysSent
        .filter((sent) => !sent.externalIds && sent.sourceDefined.length === 0)
        .map((sent) => sent.name),
      "Every provider under test sends something beyond the required half, so nothing shows a " +
        "provider sending none is still conformant.",
    ).not.toHaveLength(0);
  });
});

describe("an image reference", () => {
  /**
   * WHAT IS REQUIRED OF ANY PROVIDER STAYS TWO FIELDS (ADR-0033, CNCORE-358).
   *
   * The wiki sends `id`, `description_url` and `licences`; TMDB sends `width`;
   * they share only `role` and `url`. A contract that took either provider's set
   * as the rule would refuse the other, which is the mistake `cmpp.ts` records
   * itself having made once over `width`. So something under test sends an
   * image carrying NOTHING BUT the two, and conforms -- and something sends one
   * carrying more, so the optional fields are checked on the wire too.
   */
  it("is exercised: something sends one carrying only a role and a url, and something one carrying more", () => {
    expect(
      imagesSent.filter((sent) => sent.fields.join() === "role,url").map((sent) => sent.name),
      "Nothing under test sent an image carrying only `role` and `url`, so nothing shows the " +
        "contract still requires no more than those two.",
    ).not.toHaveLength(0);
    expect(
      imagesSent.filter((sent) => sent.fields.length > 2).map((sent) => sent.name),
      "Nothing under test sent an image carrying more than `role` and `url`, so the optional " +
        "fields were never checked on the wire.",
    ).not.toHaveLength(0);
  });
});
