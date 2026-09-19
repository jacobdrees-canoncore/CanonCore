import type { AppRouterClient } from "@canoncore/api/routers";
import { createDb } from "@canoncore/db";
import { itemsCarrying } from "@canoncore/db/testing/catalogue";
import { REASON_MAX_LENGTH } from "@canoncore/providers";
import { createORPCClient, isDefinedError, safe } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { afterAll, describe, expect, inject, it } from "vitest";
import {
  documentAt,
  documentFrom,
  logInAt,
  postFormsIn,
  type RenderedForm,
  sectionIn,
  submit,
  withFields,
} from "./document";
import { HARNESS_CONNECTIONS } from "./instance";

/**
 * THE IMPORT SURFACE, over real HTTP. ADR-0103's fourth seam, which is the one
 * CNCORE-68 names: a page-over-HTTP assertion and no browser, because everything
 * this page renders is in the HTML the server returns -- and the forms it carries
 * are replayed exactly as a browser with JavaScript switched off submits them.
 */
const providerSearch = inject("providerSearch");
const baseUrl = inject("baseUrl");
/**
 * THE SECOND SERVER: the same build, an empty database, an empty allowlist and
 * no provider named. That is a stranger's first run of CanonCore (ADR-0094),
 * and neither state exists on the seeded instance -- so without it the two
 * criteria about an unconfigured instance could only be asserted a layer down
 * from the page that has to satisfy them.
 */
const freshBaseUrl = inject("freshBaseUrl");
/**
 * THE THIRD SERVER: an empty catalogue with an OWNER on it, which is the only
 * instance here that can show the routes out of one (CNCORE-133). They are a
 * session's since that ticket, and the fresh install above deliberately has no
 * password for anyone to hold one with.
 *
 * IT KEEPS THE NAME IT IS PROVIDED UNDER, as every other server in this suite
 * does. `front-page.test.ts` reads the same instance, and one server under two
 * names in two files is a thing two readers cannot tell is one thing.
 */
const allowlistedBaseUrl = inject("allowlistedBaseUrl");
const client: AppRouterClient = createORPCClient(new RPCLink({ url: `${baseUrl}/api/rpc` }));

/**
 * THE OWNER, LOGGED IN, as a cookie this file sends back.
 *
 * EVERY BUTTON ON THIS PAGE IS THE OWNER'S since CNCORE-109, so a test that
 * presses one asks for the page as the owner AND posts as the owner.
 *
 * "THE READS BELOW DELIBERATELY DO NEITHER" IS WHAT THIS SAID, AND IT STOPPED
 * BEING TRUE AT CNCORE-154. The reads that ask what a PROVIDER says about a
 * container now ask as the owner, because that one read is an `ownerProcedure`
 * (ADR-0131). The reads that ask what this CATALOGUE holds still ask as nobody,
 * and two tests below assert precisely the seam between them. What a visitor to
 * ADR-0044's demo sees is still a page with every result on it and no button,
 * and that is asserted in `login-page.test.ts` rather than assumed here.
 */
const owner = await logInAt(baseUrl, inject("ownerPassword"));

/**
 * THE SAME ROUTER, ASKED AS THE OWNER, for the one procedure on it that is the
 * owner's despite being a read.
 *
 * `provider.container` MOVED BEHIND THE SESSION under CNCORE-154 (ADR-0131): it
 * answers by running the whole browse at a third party, which CNCORE-151 gave
 * sixty seconds, and the anonymous `client` above can no longer ask it. The
 * assertions that read it are asking what the PROVIDER says so they can compare
 * it against what the page rendered, so they need the answer rather than the
 * refusal.
 */
const asOwner: AppRouterClient = createORPCClient(
  new RPCLink({ url: `${baseUrl}/api/rpc`, headers: { cookie: owner } }),
);

/** The same owner on the empty instance, for the one read that needs one. */
const ownerOfTheEmptyOne = await logInAt(allowlistedBaseUrl, inject("ownerPassword"));

/**
 * THE CATALOGUE'S OWN ROWS, which this file reaches for exactly once and for a
 * fact no surface above them can state. `multi-placement.test.ts` opens the same
 * seam in this suite for the same shape of reason.
 */
/**
 * THE SAME RPC SURFACE, ASKED AS THE OWNER, which the client above deliberately
 * is not: the reads in this file are a visitor's, and `provider.import` is an
 * `ownerProcedure` since CNCORE-109 -- so asking it without a session answers
 * `Unauthorized` rather than what the provider said. `purge-page.test.ts` builds
 * one the same way for the same reason.
 */
const asTheOwner: AppRouterClient = createORPCClient(
  new RPCLink({ url: `${baseUrl}/api/rpc`, headers: { cookie: owner } }),
);

const db = createDb(inject("databaseUrl"), { maxConnections: HARNESS_CONNECTIONS });

afterAll(async () => {
  await db.$client.end();
});

/**
 * A candidate this catalogue does not hold, taken from the ROUTER's own answer
 * rather than named here.
 *
 * WHY IT IS ASKED RATHER THAN WRITTEN DOWN: the harness imports some of what
 * these providers answer and not others, so which candidate is unheld is a fact
 * about the fixture at the moment the test runs. A literal would have to be
 * revised every time the fixture imported one more -- and would be revised to
 * whatever the page happened to say, which is the one source that must not be
 * the authority for what the page should say.
 *
 * AND IT IS THE UNHELD ONE THAT MAKES THIS A TEST AT ALL. Every record this
 * harness imports is held before the first assertion runs, so a candidate picked
 * at random would often already link an Item -- and an Import button wired to
 * nothing would satisfy every assertion about it.
 */
async function aCandidateNotHeld(): Promise<{ recordId: string; title: string }> {
  const { answered } = await client.provider.search({ query: providerSearch.query });
  const unheld = answered.flatMap(({ results }) => results).find(({ itemId }) => itemId === null);
  if (!unheld) {
    throw new Error(
      `every candidate for ${providerSearch.query} is already held, so an import proves nothing`,
    );
  }
  return { recordId: unheld.recordId, title: unheld.title };
}

/** A query as `next/form` puts it in the URL: the field's name and its value. */
function searching(query: string): string {
  return `/import?q=${encodeURIComponent(query)}`;
}

/** Every candidate row the results carry. */
function rows(text: string): string[] {
  return [...text.matchAll(/<li\b[^>]*>.*?<\/li>/gs)].map(([whole]) => whole);
}

/** The one form in a row, which is the one that takes that candidate. */
function formIn(candidate: string): RenderedForm {
  const [form] = postFormsIn(candidate);
  if (!form) throw new Error(`that candidate carries no form to submit:\n${candidate}`);
  return form;
}

/** What a rendered form carries under one name. */
function field(form: RenderedForm, name: string): string {
  const found = form.fields.find(([key]) => key === name);
  if (!found) throw new Error(`that form carries no \`${name}\`: ${JSON.stringify(form.fields)}`);
  return found[1];
}

/**
 * The row for one candidate, found by its title as the page renders it.
 *
 * NOT BY THE ROW'S FORM, WHICH IS THE WHOLE DIFFICULTY: a candidate the catalogue
 * already holds has no Import button, so the hidden `recordId` that identifies a
 * row before the import is gone from it afterwards -- which is exactly the
 * transition under test.
 *
 * `>title<` RATHER THAN A SUBSTRING, so the title has to be the whole text of its
 * own element. "The Matrix" is a substring of "The Matrix Reloaded", and a
 * containment check would find either row for either title and never say which it
 * had.
 */
function rowTitled(text: string, title: string): string {
  const found = rows(text).find((candidate) => candidate.includes(`>${title}<`));
  if (!found) throw new Error(`the page showed no candidate titled ${title}`);
  return found;
}

/** The `/items/<id>` an Item is reached at, where a row names one. */
function itemLinkedIn(candidate: string): string | undefined {
  return /href="(\/items\/[0-9a-f-]{36})"/.exec(candidate)?.[1];
}

describe("/import", () => {
  it("finds a record by name, with no id known in advance", async () => {
    /*
     * THE ROW, NOT THE DOCUMENT. `toContain(query)` is satisfied by the page's own
     * heading -- it prints "Nothing matched The Matrix" -- so it passes against a
     * search that found nothing at all. That was the first version of this test,
     * and it is the shape of assertion this repo has been caught by twice before
     * (ADR-0103 carries both). What is asserted instead is a candidate ROW
     * carrying the title as the whole text of its own element, and the Import
     * button on it: a result, rather than an echo of the question.
     *
     * AND THE QUERY IS A NAME RATHER THAN AN ID, which is the whole criterion. The
     * record's own id is asserted to be something the search did NOT need: it
     * comes back in the row's form, and it is not what went in.
     */
    // ASKED AS THE OWNER, because the id is read off the Import button's own
    // hidden field and that button is the owner's (CNCORE-109). What a visitor
    // sees on this page instead is asserted in `login-page.test.ts`.
    const { status, text } = await documentAt(searching(providerSearch.query), owner);

    expect(status).toBe(200);
    const found = rowTitled(text, providerSearch.held);
    const recordId = field(formIn(found), "recordId");
    expect(recordId).not.toBe(providerSearch.query);
    expect(recordId.length).toBeGreaterThan(0);
  });
});

describe("/import, taking a record", () => {
  it("imports a candidate the catalogue does not hold, and the Item is reachable", async () => {
    const { recordId, title } = await aCandidateNotHeld();
    const at = searching(providerSearch.query);

    const before = await documentAt(at, owner);
    // THE ROW OFFERS TO TAKE IT AND NAMES NO ITEM, which is the state the POST
    // below has to change. Asserted rather than assumed: without it this test
    // would pass against a page that showed an Item link on every row from the
    // start.
    expect(itemLinkedIn(rowTitled(before.text, title))).toBeUndefined();
    const form = formIn(rowTitled(before.text, title));
    expect(field(form, "recordId")).toBe(recordId);

    const taken = await submit(baseUrl, at, form, owner);

    expect(taken.status).toBe(200);
    // THE SAME ROW, NOW NAMING AN ITEM, which is the import being reported rather
    // than some other candidate that happened to be held all along.
    const link = itemLinkedIn(rowTitled(taken.text, title));
    expect(link).toBeDefined();

    // AND THE ITEM IS ACTUALLY THERE, at the address the page gave, holding the
    // provider's own id for the record -- so it is THIS candidate's Item rather
    // than some other item the page linked.
    const item = await documentAt(link as string);
    expect(item.status).toBe(200);
    expect(item.text).toContain(recordId);
  });
});

describe("/import, across several providers", () => {
  it("names every provider that answered, and the one that could not be reached", async () => {
    /*
     * BOTH PROVIDERS SEARCHED, AND SAYING SO IS THE CRITERION. A provider that
     * matched nothing is still a provider that was asked, and one omitted for
     * having no results is one an owner cannot tell from one that was never asked
     * -- so the page lists it saying it matched nothing rather than leaving it out.
     *
     * AND THE THIRD ONE FAILING DOES NOT EMPTY THE PAGE. The seeded instance is
     * configured with a provider whose host is not allowlisted, so every search it
     * serves has one failure in it; the criterion is that the other providers'
     * answers survive that, and that the owner is told which URL failed and why.
     */
    // AS THE OWNER, for the reason above: what each row posts BACK is on a form
    // only the owner is offered.
    const { text } = await documentAt(searching(providerSearch.query), owner);

    const { answered, failed } = await client.provider.search({ query: providerSearch.query });
    // The providers' own names for themselves, off their manifests, which is what
    // lets an owner choose between two answers rather than inherit one.
    expect(answered.length).toBeGreaterThan(1);
    for (const { provider, results } of answered) {
      expect(text).toContain(provider.name);
      // ATTRIBUTED BY NAME, NOT BY ADDRESS. The candidates sit under a heading
      // carrying the provider's own name for itself, never the loopback address it
      // happens to be deployed at.
      //
      // THE ADDRESS IS STILL IN THE PAGE, in the hidden field the Import form has
      // to post back, and that is not the same thing and not a breach. The rule
      // about keeping a deployment address away is about a READER being handed a
      // source's claims; the reader here is the OWNER, who typed these URLs and is
      // the only person who can change one. So what is asserted is the heading.
      //
      // THE NAME OPENS THE HEADING rather than being its whole text, because a
      // provider that matched nothing says so in the same heading -- which is the
      // point of listing it at all. Matched as a STRING and not built into a
      // regular expression: the name comes off a provider's manifest, so a
      // provider calling itself `a+b` would break the assertion rather than the
      // page.
      expect(text).toContain(`>${provider.name}`);

      // AND EACH ROW IS ATTRIBUTED TO THE PROVIDER IT SITS UNDER, which the
      // heading alone cannot say: a page that grouped the rows correctly and
      // posted the wrong provider back would satisfy every assertion above, and
      // would import somebody else's record under this one's name.
      for (const result of results) {
        expect(field(formIn(rowTitled(text, result.title)), "baseUrl")).toBe(provider.baseUrl);
      }
    }

    // And the one that failed, named by the URL the owner typed -- the only thing
    // about it they can act on, since reading its name is what failed.
    expect(failed.map(({ baseUrl }) => baseUrl)).toContain(providerSearch.unreachable);
    expect(text).toContain(providerSearch.unreachable);
    expect(text).toContain("not an allowlisted host");
  });

  it("heads the providers a search failed on with what is true of one that answered", async () => {
    /*
     * THREE FAULTS SHARE THIS LIST: a URL ADR-0034 refused before a socket
     * opened, a provider that never answered, and one that answered with
     * something `packages/providers` would not parse. "Could not be reached" is
     * false of the third, directly above a reason that says it answered -- the
     * sentence `NotReached` and `/settings` both refuse to say (CNCORE-221).
     *
     * SO THE PROVIDER ASSERTED HERE IS ONE THAT WAS REACHED. The test above uses
     * the one the allowlist refuses, which every heading is true of.
     */
    const { text } = await documentAt(searching(providerSearch.query));
    const { failed } = await client.provider.search({ query: providerSearch.query });

    // REACHED, which is what the reason's author says: zod's report on its
    // manifest rather than this app's refusal of its host.
    const answered = failed.find(({ baseUrl }) => baseUrl === providerSearch.answersBadly);
    expect(answered?.reason.wrote).toBe("provider");

    // SCOPED TO THE LIST, because the browse box names every provider this
    // instance searches and the URL alone is on the page regardless.
    const list = sectionIn(text, "failed");
    expect(list).toContain("Nothing could be read from these providers");
    expect(list).toContain(providerSearch.answersBadly);
    expect(list.toLowerCase()).not.toContain("could not be reached");
  });
});

/**
 * A PROVIDER'S NAME IS ITS OWN PROSE ON THE OWNER'S PAGE, AND IT IS BOUNDED
 * (ADR-0123, CNCORE-165).
 *
 * ASSERTED WHERE IT IS RENDERED, because the name crosses a manifest parse, an
 * RPC procedure's output schema and a React component between the socket and
 * this heading, and the package's own test proves none of that. It is the
 * argument ADR-0123 makes for a failure reason, about a field that record had
 * not counted.
 */
describe("/import, beside a provider that names itself at length", () => {
  it("prints the name the provider declared, at no length the provider chose", async () => {
    const { text } = await documentAt(searching(providerSearch.query));
    const { name } = providerSearch.floodsItsName;

    // LISTED, which the next line cannot tell from being dropped: a page that
    // left this Provider out would print none of its name, and pass.
    expect(text).toContain(name.slice(0, 100));
    // AND NO RUN OF IT LONGER THAN THE OWNER READS of any provider's prose.
    expect(text).not.toContain(name.slice(0, REASON_MAX_LENGTH + 1));
  });
});

describe("/import, taking a record from a provider that has stopped answering", () => {
  /**
   * THE OWNER LANDS BACK ON THE PAGE, AND THE READ THAT FOUND THE RECORD TELLS
   * THEM WHAT TO DO (CNCORE-149).
   *
   * WHAT THEY USED TO GET WAS A BARE 500. `client.ts` reports a non-2xx with a
   * plain `Error`, which is not an `OutboundRefused` -- so it fell past the one
   * `catch` `provider.import` had and became the undeclared throw that catch
   * exists to remove. The READ surfaces have carried the Provider's own sentence
   * since CNCORE-140 and both WRITE surfaces threw it away.
   *
   * THE FORM IS THE PAGE'S OWN, WITH THE PROVIDER SWAPPED, and that is the real
   * case rather than a contrivance: CNCORE-100 makes an expired `cf_clearance` a
   * 503 on every operation, so a Provider whose session lapses between the
   * search that rendered this row and the Take that posts it answers nothing --
   * and a Provider already failing at render time offers no row to press. A form
   * field is input whoever rendered the form, which is what `actions.ts` says of
   * these two in those words.
   *
   * ASSERTED WHERE IT IS RENDERED rather than at the router alone. The reason
   * crosses a package boundary, a declared error's `data` schema, a Server
   * Action and `whatTheProcedureAnswered` between the socket and the page, and
   * the router's own test proves none of that -- a declared error whose STATUS
   * is a 500 is rethrown out of the action and answers the same bare eighteen
   * bytes as the undeclared throw did.
   *
   * THE STATUS IS THE GUARD AND THE SENTENCE IS WHAT IT BUYS. This Provider is
   * one this instance searches, so its row is on the page before the POST as
   * well as after; what was not there before is a page at all.
   */
  it("answers the page carrying the provider's own sentence, rather than a bare 500", async () => {
    const at = searching(providerSearch.query);
    const lapsed = providerSearch.refusesWithASentence;

    const before = await documentAt(at, owner);
    // ANY CANDIDATE'S FORM, because every row carries one: a record already held
    // is offered "Import again", since a second import is a REFRESH rather than a
    // second item. The row is named rather than picked so this test does not
    // depend on which candidates an earlier test in this file has imported.
    //
    // `withFields` RATHER THAN A MAP WRITTEN HERE, because it refuses a name the
    // form does not carry -- so this test fails loudly on the day `baseUrl` is
    // renamed, instead of quietly posting the provider that was already there
    // and asserting a 200 about the wrong one.
    const form = withFields(formIn(rowTitled(before.text, providerSearch.held)), {
      baseUrl: lapsed.url,
    });

    const taken = await submit(baseUrl, at, form, owner);

    // A PAGE, NOT `Internal Server Error`. Measured under CNCORE-68 at eighteen
    // bytes with no HTML at all, which is what a Server Action answers when what
    // it throws is not a refusal the action can read.
    expect(taken.status).toBe(200);
    // AND THE HALF THE OWNER CAN ACT ON, quoted beside the URL they typed --
    // which is the read surface doing what the write surface cannot, and the
    // whole of why a 500 here cost them the remedy. `/` is the manifest, the
    // first thing any operation asks for.
    expect(taken.text).toContain(`<q>/ answered 503: ${lapsed.said}</q>`);
    expect(taken.text).toContain(lapsed.url);
  });
});

describe("/import, taking a record the provider no longer holds", () => {
  /**
   * THE OWNER LANDS BACK ON THE PAGE, WHERE THEY GOT EIGHTEEN BYTES (CNCORE-152).
   *
   * THE TAKE BUTTON IS RENDERED FOR EVERY CANDIDATE, held or not, so this is the
   * ordinary life of the surface rather than an edge of it: a record the provider
   * drops between the search that drew the row and the POST that presses it
   * answers `NO_SUCH_RECORD`, which ADR-0066 makes an ANSWER rather than a fault.
   * It reached the Owner as a bare `Internal Server Error` anyway, because
   * DECLARING the code left it at oRPC's default `status: 500` and `answer.ts`
   * rethrows there -- so the declaration bought nothing this page could render.
   *
   * ASSERTED WHERE IT IS RENDERED rather than at the router alone, which is this
   * ticket's third criterion and is the assertion the router cannot make: the
   * router's own witness passed throughout the defect, because a declared error
   * has its code long before it has a status a Server Action will hand back.
   *
   * THE FORM IS THE PAGE'S OWN, WITH THE PROVIDER SWAPPED, which is the shape
   * CNCORE-149's two witnesses take and for the reason given there: a provider
   * that already holds nothing offers no row to press, so the only way to reach
   * this state is to press a row that WAS drawn and post it at a provider that
   * has since stopped holding it.
   */
  it("answers the page rather than a bare 500", async () => {
    const at = searching(providerSearch.query);
    const before = await documentAt(at, owner);
    // `withFields` REFUSES A NAME THE FORM DOES NOT CARRY, so this fails loudly
    // on the day `baseUrl` is renamed instead of quietly posting the provider
    // that was already there and asserting a 200 about the wrong one.
    const form = withFields(formIn(rowTitled(before.text, providerSearch.held)), {
      baseUrl: providerSearch.holdsNothing.url,
    });

    // PINNED TO THE REFUSAL UNDER TEST, which review caught missing and which the
    // three browse witnesses get from `whatTheProviderSays`. EVERY sub-500
    // refusal lands the Owner on a page, so a witness asserting only "a page"
    // stays green if this provider starts refusing for some OTHER reason -- and
    // would then be re-proving CNCORE-149's `424` while claiming this ticket's
    // `404`. There is no read procedure for a record to ask instead, so the ask
    // is the write itself: it refuses, so it writes nothing.
    const { error } = await safe(
      asTheOwner.provider.import({
        baseUrl: providerSearch.holdsNothing.url,
        recordId: field(form, "recordId"),
      }),
    );
    if (!isDefinedError(error) || error.code !== "NO_SUCH_RECORD") {
      throw new Error(
        `the witness provider answered ${isDefinedError(error) ? error.code : String(error)}`,
      );
    }

    const taken = await submit(baseUrl, at, form, owner);

    // A PAGE, NOT `Internal Server Error`. Measured under CNCORE-68 at eighteen
    // bytes with no HTML at all, which is what a Server Action answers when what
    // it throws is not a refusal the action can read.
    expect(taken.status).toBe(200);
    expect(taken.text).not.toContain("Internal Server Error");
    // AND IT IS THE IMPORT SURFACE THEY LAND ON rather than any 200: the page
    // reports by re-reading, so the row they pressed is still there to press
    // again at a provider that does hold it.
    expect(rowTitled(taken.text, providerSearch.held)).toContain(providerSearch.held);
  });
});

describe("/import, browsing a container the provider does not hold", () => {
  /**
   * THE OTHER MISSING-ID ANSWER, AT THE PAGE (CNCORE-152).
   *
   * ASSERTED HERE AND NOT LEFT TO THE RECORD'S WITNESS, because these two
   * procedures have now had ONE defect with TWO sites twice over: the identical
   * `catch` under CNCORE-149, and the identical missing status under this
   * ticket. A page witness for one of them has twice said nothing true about the
   * other, which is the shape ADR-0123 was written about.
   *
   * THE PAGE OWES A SENTENCE HERE, WHICH THE RECORD'S WITNESS COULD NOT ASK FOR.
   * A browse is posted to the address that NAMES the provider and the container,
   * so the page that comes back re-asks `provider.container` about them -- and
   * the read that offered the button is the read that explains why it failed.
   */
  it("says the provider holds no container at that id, rather than answering a bare 500", async () => {
    const holdsNothing = providerSearch.holdsNothing;

    const browsed = await browsingInsteadAt(holdsNothing.url);

    expect(browsed.status).toBe(200);
    const container = browsed.container();
    // THE PROVIDER'S OWN NAME, off its manifest, because "who says they have not
    // got it" is the half of this the Owner acts on.
    expect(container).toContain(`${holdsNothing.name} holds no container at that id`);
    // AND NOTHING TO PRESS AGAIN, which is the half that makes this more than a
    // nicer error: the button that could not work is gone from the page the
    // owner lands on.
    expect(postFormsIn(container)).toHaveLength(0);
  });
});

describe("/import, browsing at a provider that declines browse", () => {
  /**
   * THE THIRD DECLARED ERROR, AND THE ONE THAT IS NOT A MISSING THING
   * (CNCORE-152).
   *
   * ADR-0033 MAKES DECLINING `browse` WELL-FORMED: a provider offering only
   * `search` and `lookup` satisfies CMPP completely, so this is the one of the
   * three where nothing has gone wrong anywhere -- and it was the one answering
   * the Owner that the server was broken. No request even leaves the app for it.
   *
   * WHICH IS WHY ITS STATUS IS NOT THE `404` THE OTHER TWO TAKE, and why this
   * witness is separate from the one above rather than a second case inside it.
   * Both statuses get the Owner a page, so a suite that only asked for a page
   * would pass with the two collapsed -- and the sentence it renders is the
   * remedy, which differs: check the id, against import the records one at a
   * time.
   */
  it("says the provider does not offer browse, rather than answering a bare 500", async () => {
    const declining = providerSearch.declinesBrowse;

    const browsed = await browsingInsteadAt(declining.url);

    expect(browsed.status).toBe(200);
    const container = browsed.container();
    // THE PROVIDER'S OWN NAME AND NOT MERELY THE SENTENCE, which review caught:
    // the page renders the name FIRST, so a suffix match passes while the page
    // names the wrong provider -- and "which provider does not do this" is the
    // half the Owner acts on. Its neighbour above asserted the name from the
    // start and this did not.
    expect(container).toContain(`${declining.name} does not offer browse`);
    expect(postFormsIn(container)).toHaveLength(0);
  });
});

describe("/import, taking a record it already holds", () => {
  it("changes nothing: the same Item, and no second one for that record", async () => {
    /*
     * A RE-IMPORT IS A REFRESH, NOT A SECOND ITEM (ADR-0026 under CNCORE-28,
     * migration 3). An item used to be written again on every import, because
     * nothing in the catalogue held the provider's own id; the mapping now finds
     * the item the first import wrote.
     *
     * ASSERTED HERE RATHER THAN ONLY AT THE ROUTER because the page is where the
     * button is: a surface that offered an import and minted a second item each
     * time would be the defect a reader of this criterion is worried about, and
     * the router passing says nothing about what the page posts.
     *
     * THE CANDIDATE IS ONE THE HARNESS ALREADY IMPORTED, so the very first press
     * of this button is already a re-import.
     */
    const at = searching(providerSearch.query);
    const held = rowTitled((await documentAt(at, owner)).text, providerSearch.held);
    const before = itemLinkedIn(held);
    expect(before).toBeDefined();
    const form = formIn(held);
    // THE PROVIDER AND THE RECORD AS THE PAGE ITSELF NAMES THEM, read off the
    // hidden fields this form posts back rather than written down here. What the
    // assertion below is about is the record this button takes, and the button is
    // the only thing that knows which that is.
    const provider = field(form, "baseUrl");
    const recordId = field(form, "recordId");

    const once = await submit(baseUrl, at, form, owner);
    const twice = await submit(baseUrl, at, form, owner);

    expect(once.status).toBe(200);
    expect(twice.status).toBe(200);
    // THE SAME ITEM BOTH TIMES, and the same one it was before either press.
    expect(itemLinkedIn(rowTitled(once.text, providerSearch.held))).toBe(before);
    expect(itemLinkedIn(rowTitled(twice.text, providerSearch.held))).toBe(before);
    /*
     * AND NO ITEM ANYWHERE ELSE EITHER, which is the half a row cannot show: a
     * second item for this record would be in the catalogue whether or not this
     * row linked it.
     *
     * ONE RECORD RATHER THAN THE CATALOGUE'S SIZE (CNCORE-93). This read
     * `catalogue.list({}).total` either side of the two POSTs, which is a fact
     * about the WHOLE catalogue -- and `multi-placement.test.ts` browses two wiki
     * containers into the same catalogue from its own worker while this runs. A
     * browse landing between the two reads failed this assertion for somebody
     * else's write: measured 2026-09-12 against the real provider images, two of
     * four full runs, and green every time this file ran alone.
     *
     * NARROWER, AND NOT WEAKER -- but say exactly what that means, because two
     * rows are UNREACHABLE in the shipped schema. `sources_identity` is unique on
     * (owner, kind, identity) and migration 5's partial unique index covers
     * (source_id, md5(value_literal)) for a live `external_id`, so an importer
     * that tried to mint a second Item for this record is REFUSED -- and what
     * catches that is `twice.status` above rather than this line. What this line
     * buys is that the suite is not BLIND to the pair the way every procedure
     * above it is: `itemsCarrying` answers with ROWS, so the day that index is
     * dropped, relaxed or gone round it sees the second Item while
     * `provider.held` goes on reporting one.
     *
     * AND NO OTHER WORKER CAN MOVE IT, which a total could never be. Nothing else
     * in this suite writes to (this provider, this record): the only other file
     * that writes to the seeded instance is `multi-placement.test.ts`, and it
     * browses the WIKI provider. Nor would it matter if one did -- a second
     * import of this record FINDS the item the first wrote (ADR-0026 under
     * CNCORE-28), so the answer is one Item and the same Item whoever asks.
     *
     * WHAT IT NO LONGER SEES, said plainly rather than left to be discovered: an
     * Item minted with NO `external_id` statement tying it to this record. Only a
     * catalogue-wide count could see that, which is the thing that cannot be
     * asserted here -- and the import writes the mapping in the same transaction
     * as the Item (`importProvidedRecord`), so an Item without one is a defect in
     * a different mechanism from the one this test is about.
     */
    const carrying = await itemsCarrying(db, { identity: provider, externalId: recordId });
    expect(carrying).toHaveLength(1);
    expect(before).toBe(`/items/${carrying[0]}`);
  });
});

describe("/import on a fresh install", () => {
  it("says no provider is allowlisted, rather than returning an empty list", async () => {
    // ADR-0034's allowlist is empty by default and the empty value refuses every
    // provider, which is the safe end of the failure and is completely silent: an
    // unconfigured instance and a broken one look identical from a page. The
    // criterion is that the surface SAYS so, and an empty `<section>` satisfies a
    // test that only asks whether the element is there -- so what is asserted is
    // the way to the setting the owner has to go and change (CNCORE-99).
    const { status, text } = await documentFrom(freshBaseUrl, "/import");

    expect(status).toBe(200);
    const notice = sectionIn(text, "no-provider");
    expect(notice).toContain("/settings");
    expect(notice.toLowerCase()).toContain("no provider is allowlisted");
  });

  it("says an empty result is that setting rather than a fault", async () => {
    /*
     * WHICH KIND OF NOTHING THIS IS, which the heading above does not answer.
     * An instance nobody has configured and an instance that is broken reach
     * the same number of providers, so an owner who has read the heading still
     * cannot tell whether the emptiness below is theirs to go and fix.
     *
     * IT IS THE FRONT PAGE'S SENTENCE AND THIS COPY HAD LOST IT (CNCORE-177),
     * which is the whole argument for the notice being one component: two
     * copies of a paragraph are two places for a reader's answer to go
     * missing from one of them, and nothing was watching either.
     */
    const { text } = await documentFrom(freshBaseUrl, "/import");

    expect(sectionIn(text, "no-provider").toLowerCase()).toContain(
      "an empty result here is this setting rather than a fault",
    );
  });

  it("says no provider is configured either, which is the other setting", async () => {
    // TWO SETTINGS, TWO REMEDIES. An instance reaches no provider either because
    // nothing is allowlisted or because nothing is NAMED, and neither is derivable
    // from the other -- `127.0.0.0/8` carries no scheme and no port. A surface that
    // said only the first would send an owner to fix the wrong one.
    const fresh = await documentFrom(freshBaseUrl, "/import");

    const notice = sectionIn(fresh.text, "no-provider-configured");
    expect(notice).toContain("/settings");
    expect(notice.toLowerCase()).toContain("no provider is configured");
  });

  /**
   * ADR-0117's CHECK, WHICH A NEW READ SURFACE EARNS RATHER THAN INHERITS.
   *
   * That record's rule is that a read surface declares it needs a request, and its
   * check is a SHAPE rather than an assertion about one page: ask two instances of
   * one build, pointed at different configuration, for the same path, and expect
   * different answers. One server cannot see this at all -- its page looks correct,
   * because the state it was built against is the state it is serving.
   *
   * THIS PAGE DECLARES IT BY READING `searchParams`, which is the second of the two
   * ways ADR-0117 names ("a request-time API the page was going to touch anyway"):
   * the query IS the page. So what is owed is this pair, and `next build` naming
   * the route `ƒ` rather than `○` is the other half of the same fact.
   */
  it("is rendered per request, not once at build time", async () => {
    const seeded = await documentAt("/import");
    const fresh = await documentFrom(freshBaseUrl, "/import");

    expect(seeded.status).toBe(200);
    expect(fresh.status).toBe(200);
    expect(fresh.text).not.toBe(seeded.text);
    // AND THEY DIFFER IN THE RIGHT PLACE rather than merely somewhere. Two pages
    // can differ over a build id or a hydration payload while both being
    // photographs of the same configuration, so what is compared is the thing the
    // configuration decides.
    expect(() => sectionIn(seeded.text, "no-provider-configured")).toThrow();
  });
});

/** A container named in the URL, as the browse form's fields put it there. */
function browsing({ provider, container }: { provider: string; container: string }): string {
  return `/import?provider=${encodeURIComponent(provider)}&container=${encodeURIComponent(container)}`;
}

/**
 * PRESSING THE BROWSE BUTTON AT A PROVIDER THAT WILL NOT SERVE IT, and landing
 * wherever that leaves the owner.
 *
 * THE FORM IS THE PAGE'S OWN, WITH THE PROVIDER SWAPPED, which is the only way
 * these states are reachable and is also the real case: the page offers no
 * button for a provider it cannot browse, so a browse can only fail this way if
 * the provider stops serving one between the GET that drew the button and the
 * POST that presses it. CNCORE-100 makes that the ordinary life of an expired
 * `cf_clearance`.
 *
 * WRITTEN ONCE FOR THE THREE WITNESSES THAT NEEDED IT, which review caught at
 * the third copy. They differ in the provider swapped in and in the sentence the
 * page then owes; everything between was the same five lines three times, and a
 * fourth refusal would have been a fourth.
 *
 * `withFields` RATHER THAN A MAP WRITTEN HERE, because it refuses a name the
 * form does not carry -- so this fails loudly on the day `baseUrl` is renamed
 * instead of quietly posting the provider that was already there.
 */
async function browsingInsteadAt(provider: string) {
  const alive = await documentAt(browsing(providerSearch.browsable), owner);
  const [rendered] = postFormsIn(sectionIn(alive.text, "container"));
  if (!rendered) throw new Error("the container section offered no button to press");

  const browsed = await submit(
    baseUrl,
    browsing({ provider, container: providerSearch.browsable.container }),
    withFields(rendered, { baseUrl: provider }),
    owner,
  );
  return { status: browsed.status, container: () => sectionIn(browsed.text, "container") };
}

/** What one provider says about the container the URL names, asked of the router. */
async function whatTheProviderSays(named: { provider: string; container: string }) {
  return asOwner.provider.container({ baseUrl: named.provider, containerId: named.container });
}

describe("/import, before a container's ordering is imported", () => {
  it("does not browse on a visitor's behalf, and says whose the question is", async () => {
    /*
     * THE ONE READ ON THIS PAGE THAT IS THE OWNER'S (ADR-0131, CNCORE-154).
     * Every other section here is rendered for anyone, because every other
     * section answers out of this catalogue's own rows -- which is ADR-0072's
     * demo, whole. This one answers by running a WHOLE BROWSE at a third party,
     * the same work the button does, and CNCORE-151 gave that sixty seconds. So
     * an open one let anybody who could reach the instance hold a provider for a
     * minute a request, and nothing rate-limited it.
     *
     * THE PAGE STILL ANSWERS 200 AND STILL SAYS WHY. A gap where the preview
     * stood would leave a reader looking for what they had done wrong, which is
     * the failure `NoLogin` at the top of this page exists to prevent one notice
     * over.
     */
    const at = browsing(providerSearch.browsable);

    const { status, text } = await documentAt(at);

    expect(status).toBe(200);
    const section = sectionIn(text, "container");
    const said = await whatTheProviderSays(providerSearch.browsable);
    if (said.answer !== "container") {
      throw new Error(`the provider handed over no container: ${said.answer}`);
    }
    // NOT THE PROVIDER'S HALF, asserted against what the provider actually says
    // rather than against a literal, for the reason the tests below give.
    expect(section).not.toContain(said.title);
    expect(section).not.toContain(`${said.placements} members`);
    // AND THE OPERATION IS NAMED, which is what makes this a sentence rather
    // than a gap. `LogIn` renders the door where there is one.
    expect(section).toContain("to ask a provider about a container");
  });

  it("still hands a visitor the catalogue's own half, which was never the provider's", async () => {
    /*
     * ADR-0072 KEPT RATHER THAN CONCEDED, and this is the assertion that says
     * which half moved. CNCORE-154 made the PROVIDER'S half the owner's because
     * answering it costs a whole browse at a third party; `provider.held` reads
     * this catalogue's own rows and is nobody's to withhold. A visitor asking
     * about a container this catalogue already holds is still pointed at it.
     *
     * THE SAME FIXTURE THE OWNER'S VERSION OF THIS USES, one describe below, so
     * the two differ in WHO ASKS and in nothing else.
     */
    const imported = inject("imported");
    const named = { provider: inject("providerWikiUrl"), container: imported.recordId };

    const { status, text } = await documentAt(browsing(named));

    expect(status).toBe(200);
    const container = sectionIn(text, "container");
    expect(container).toContain("Already imported");
    expect(itemLinkedIn(container)).toBe(`/items/${imported.id}`);
    // AND STILL NOT THE PROVIDER'S HALF, which is what keeps this test honest:
    // a page that had simply stayed open would satisfy the three lines above.
    expect(container).toContain("to ask a provider about a container");
    expect(container.toLowerCase()).not.toContain("no container at that id");
  });

  it("shows the container's own title, and not merely the id the owner typed", async () => {
    /*
     * A BROWSE CAN WRITE SIXTY PLACEMENTS, and until this the only thing naming
     * the container about to be written was an id the owner typed into a box.
     * The provider is asked on the GET -- where a read belongs -- so the title
     * is on the page before the button is pressed rather than afterwards.
     *
     * THE TITLE IS TAKEN FROM THE PROVIDER RATHER THAN WRITTEN DOWN HERE, for
     * the reason `aCandidateNotHeld` above gives: this suite runs against a stub
     * on one machine and the real image in CI, and a literal would be asserting
     * that one of those two was running.
     */
    const at = browsing(providerSearch.browsable);

    const { status, text } = await documentAt(at, owner);

    expect(status).toBe(200);
    const said = await whatTheProviderSays(providerSearch.browsable);
    if (said.answer !== "container") {
      throw new Error(`the provider handed over no container: ${said.answer}`);
    }
    // A REAL TITLE RATHER THAN AN ECHO OF THE ID. A page printing back what was
    // typed would satisfy a bare `toContain` against the section.
    expect(said.title).not.toBe(providerSearch.browsable.container);
    expect(sectionIn(text, "container")).toContain(said.title);
  });

  it("says how many placements the browse would write, before it writes them", async () => {
    /*
     * ONE PRESS WRITES A CONTAINER'S WORTH OF PLACEMENTS -- that is the whole
     * reason `browse` exists (ADR-0033) -- and the page used to describe what
     * was about to happen with nothing but the id that had been typed.
     */
    const { text } = await documentAt(browsing(providerSearch.browsable), owner);

    const said = await whatTheProviderSays(providerSearch.browsable);
    if (said.answer !== "container") {
      throw new Error(`the provider handed over no container: ${said.answer}`);
    }
    expect(said.placements).toBeGreaterThan(0);
    expect(sectionIn(text, "container")).toContain(`${said.placements} members`);
  });

  it("writes nothing, which is what asking on the GET has to mean", async () => {
    /*
     * THE READ REACHES THE PROVIDER'S `browse`, which is the very operation the
     * button performs -- so the one thing that must stay true is that reading it
     * IMPORTS NOTHING. A page that quietly wrote sixty placements because
     * somebody followed a link would be a far worse defect than the 500 this
     * ticket removes, and it would be invisible: the page would look exactly
     * like this one.
     *
     * ASKED ABOUT THIS CONTAINER RATHER THAN ABOUT THE CATALOGUE'S SIZE. A total
     * counted either side of the request is a claim about the WHOLE catalogue
     * while other files in this suite are importing into it, so it fails for
     * somebody else's write -- measured against the real provider images, where
     * the windows are wide enough to overlap. `held` asks the one question this
     * test has: is the thing that was read now in the catalogue.
     *
     * IT RUNS BEFORE THE BROWSE BELOW TAKES IT, which is why "not held" is
     * available to assert at all; the assertion before the request is what says
     * so out loud rather than leaving it to file order.
     */
    const { provider, container } = providerSearch.browsable;
    const asked = { baseUrl: provider, recordIds: [container] };
    expect((await client.provider.held(asked)).items).toHaveLength(0);

    const { status, text } = await documentAt(browsing(providerSearch.browsable), owner);

    expect(status).toBe(200);
    expect((await client.provider.held(asked)).items).toHaveLength(0);
    // AND THE PAGE SAYS SO, which is the same fact the owner reads.
    expect(sectionIn(text, "container")).toContain("Not in your catalogue");
  });
});

describe("/import, taking a Container and its ordering", () => {
  it("imports the container and the ordering it holds, in one operation", async () => {
    /*
     * ONE CALL RATHER THAN SIXTY, which is why `browse` exists at all (ADR-0033):
     * the container and its ordering arrive together, so a bulk import yields
     * placements instead of asking the owner to place every member by hand.
     *
     * THE OWNER NAMES THE CONTAINER, because nothing here asks CMPP for one yet
     * -- `search` returns stories and `browse` takes a container's own id, and the
     * `containers` operation ADR-0033 declares under CNCORE-185 is asked by
     * nothing in this app until CNCORE-187, though `provider-wiki` answers it.
     * That record's as-built sections carry the decision, and this form is it.
     *
     * THE MEMBER THIS WATCHES IS ONE THE CATALOGUE ALREADY HOLDS, and that is the
     * point: its Item exists before the browse and has no placement in this
     * container, so what arrives is the ORDERING rather than the item. An import
     * that wrote a second item for a story it already had would be CNCORE-28's
     * defect, and it would not satisfy this.
     */
    const at = browsing(providerSearch.browsable);
    const story = inject("attributed");
    const placedBefore = (await client.item.get({ id: story.id })).placements.rows;

    const offered = await documentAt(at, owner);
    expect(offered.status).toBe(200);
    const container = sectionIn(offered.text, "container");
    expect(itemLinkedIn(container)).toBeUndefined();

    const taken = await submit(baseUrl, at, formIn(container), owner);

    expect(taken.status).toBe(200);
    // THE CONTAINER IS IN THE CATALOGUE, and reachable at the address given.
    const link = itemLinkedIn(sectionIn(taken.text, "container"));
    expect(link).toBeDefined();
    const arrived = await documentAt(link as string);
    expect(arrived.status).toBe(200);
    expect(arrived.text).toContain(providerSearch.browsable.container);

    // AND THE ORDERING CAME WITH IT: the story now sits in that container, at a
    // position, placed by the provider that asserted the ordering (ADR-0017).
    const placedAfter = (await client.item.get({ id: story.id })).placements.rows;
    const containerId = (link as string).slice("/items/".length);
    expect(placedBefore.map(({ containerId: held }) => held)).not.toContain(containerId);
    const placement = placedAfter.find(({ containerId: held }) => held === containerId);
    expect(placement).toBeDefined();
    expect(placement?.position).toBeGreaterThan(0);
    expect(placement?.placedBy).toBe("provider");
  });
});

describe("/import, browsing a container at a provider that has stopped answering", () => {
  /**
   * THE OTHER WRITE SURFACE, AT THE PAGE (CNCORE-149).
   *
   * ASSERTED HERE AND NOT LEFT TO `import`'s WITNESS, because the two procedures
   * had the IDENTICAL `catch` and therefore the identical hole -- which is the
   * shape ADR-0123 was written about, one defect with two sites that each
   * solved it separately. A page witness for one of them says nothing about the
   * other.
   *
   * THE BUTTON WAS RENDERED WHILE THE PROVIDER WAS ALIVE, which is the only way
   * this state is reachable and is also the real one: the page offers no button
   * for a provider it cannot reach, so a browse can only fail this way if the
   * provider stops answering between the GET that drew the button and the POST
   * that presses it -- and CNCORE-100 makes that the ordinary life of an expired
   * `cf_clearance`. The form is the page's own, with the provider swapped, and
   * it is posted to the address that names the provider it now points at.
   *
   * WHICH IS WHY THE REASON IS ON THE PAGE THAT COMES BACK. The container
   * section re-asks `provider.container` about the provider the URL names, so
   * the read that offered the button is the read that explains why it failed.
   */
  it("answers the page carrying the provider's own sentence, rather than a bare 500", async () => {
    const lapsed = providerSearch.refusesWithASentence;

    const browsed = await browsingInsteadAt(lapsed.url);

    expect(browsed.status).toBe(200);
    const container = browsed.container();
    expect(container).toContain(`<q>/ answered 503: ${lapsed.said}</q>`);
    // AND NOTHING TO PRESS AGAIN, which is the half that makes this more than a
    // nicer error: the button that could not work is gone from the page the
    // owner lands on.
    expect(postFormsIn(container)).toHaveLength(0);
  });
});

describe("reaching /import", () => {
  it("is linked from the catalogue, so the surface is reachable without typing a URL", async () => {
    // A SURFACE NOBODY CAN REACH IS NOT ONE. The ticket hangs this off the front
    // page (CNCORE-65), and an owner who has to know the address is in the position
    // this page exists to get them out of -- knowing an id, or in this case a path,
    // from somewhere outside the product.
    //
    // ASKED AS THE OWNER (CNCORE-139), where it used to be asked as nobody in
    // particular -- the same repair the empty state's read below took under
    // CNCORE-133, arriving here for the same reason. The link is the header's
    // and the header offers it to a session now, because every button behind it
    // is one (ADR-0094). The criterion this asserts was always the owner's: it
    // is the sentence above, and a visitor who reached `/import` would meet the
    // surface with every button disabled.
    const { text } = await documentAt("/", owner);

    const linked = [...text.matchAll(/href="(\/import)"/g)].map(([, href]) => href);
    expect(linked).not.toHaveLength(0);
    // AND IT IS A `Link`, WHICH IS A SEPARATE RULE (ADR-0109): raw `<a href>` is
    // not rewritten, so under a `basePath` this would point at nothing. Asserted
    // by the address arriving, which is the only part observable from here.
    expect((await documentAt("/import")).status).toBe(200);
  });

  it("is what an empty catalogue tells its owner to do next, in the words that now work", async () => {
    // ADR-0094's other half: an install that starts empty WITHOUT SAYING WHAT TO DO
    // NEXT is a failure of its own. That copy used to say to give a provider's base
    // URL and the id of one of its records, which is exactly the hand-POSTing this
    // ticket removes -- so the step is now a link to the surface that searches.
    //
    // AND IT IS TOLD TO THE OWNER (CNCORE-133). This read was the fresh
    // install's until that ticket, which asked the page as nobody in
    // particular; every button the link leads to is a session's, so the route
    // is now offered to one and this is the instance that has one.
    const { text } = await documentFrom(allowlistedBaseUrl, "/", ownerOfTheEmptyOne);

    expect(sectionIn(text, "what-to-do-next")).toContain('href="/import"');
  });
});

/**
 * THESE READ AS THE OWNER, AND DID NOT UNTIL CNCORE-154. The provider's half of
 * this section is an `ownerProcedure` since ADR-0131 -- it answers by running
 * the whole browse, which CNCORE-151 gave sixty seconds -- so a visitor's page
 * carries the notice above rather than the answer these assert on. What moved is
 * WHO ASKS; every criterion below is unchanged.
 */
describe("/import, when the provider refuses", () => {
  it("says the provider holds no container at that id, rather than answering a 500", async () => {
    /*
     * THE ONE FIELD ON THIS PAGE THE OWNER TYPES IS THE ONE THAT CAN BE WRONG,
     * and `provider.browse` declares NO_SUCH_CONTAINER for exactly this because
     * ADR-0033 makes "no container at that id" an answer rather than a fault.
     *
     * WHAT THE OWNER USED TO GET WAS A BARE 500. Measured under CNCORE-68: the
     * response was the eighteen bytes `Internal Server Error`, with no HTML at
     * all. An `error.tsx` was written and removed because it DOES NOT FIRE -- a
     * Server Action that throws during a form POST with no script answers the
     * bare 500 regardless -- and it could not have carried the provider's reason
     * anyway, since Next redacts a server error's message before a boundary sees
     * it. So the refusal is read on the GET instead, where a read belongs.
     *
     * AND THE BUTTON IS NOT OFFERED, which is the half that makes this more than
     * a nicer error: there is nothing on the page to press, so the POST that
     * used to 500 cannot be reached from the surface that used to offer it.
     */
    const at = browsing({
      provider: providerSearch.browsable.provider,
      container: "a container this provider does not hold",
    });

    const { status, text } = await documentAt(at, owner);

    expect(status).toBe(200);
    const said = await whatTheProviderSays({
      provider: providerSearch.browsable.provider,
      container: "a container this provider does not hold",
    });
    expect(said.answer).toBe("no-such-container");
    const container = sectionIn(text, "container");
    expect(container.toLowerCase()).toContain("no container at that id");
    // NOTHING TO PRESS. A page that said this and still rendered the button
    // would have moved the 500 rather than removed it.
    expect(postFormsIn(container)).toHaveLength(0);
  });

  it("says a provider declares no browse, rather than reporting a missing container", async () => {
    /*
     * ADR-0033 MAKES `browse` THE OPERATION A PROVIDER MAY DECLINE, so a
     * provider offering only `search` and `lookup` is perfectly well-formed and
     * this is not an error on its part: the owner asked for something this
     * provider does not do.
     *
     * WHICH IS A DIFFERENT ANSWER FROM AN ID THAT ADDRESSES NOTHING, and the
     * difference is the whole of what an owner needs. One says to check the id;
     * the other says to stop looking here whatever the id is. Collapsing them
     * would send somebody back to a box that can never work.
     */
    const named = {
      provider: providerSearch.declinesBrowse.url,
      container: "any container at all",
    };
    const at = browsing(named);

    const { status, text } = await documentAt(at, owner);

    expect(status).toBe(200);
    const said = await whatTheProviderSays(named);
    if (said.answer !== "browse-not-offered") {
      throw new Error(`the witness provider answered ${said.answer}`);
    }
    const container = sectionIn(text, "container");
    // ATTRIBUTED BY THE PROVIDER'S OWN NAME FOR ITSELF, as every other answering
    // provider on this page is.
    expect(container).toContain(said.providerName);
    expect(container.toLowerCase()).toContain("does not offer browse");
    // AND NOT THE OTHER ANSWER, which is the distinction this test exists for.
    expect(container.toLowerCase()).not.toContain("no container at that id");
    expect(postFormsIn(container)).toHaveLength(0);
  });

  it("says a provider could not be reached, rather than that it holds nothing", async () => {
    /*
     * A PROVIDER THAT IS DOWN AND A PROVIDER THAT HOLDS NOTHING ARE DIFFERENT
     * ANSWERS. The seeded instance is configured with a provider it can never
     * reach -- ADR-0034's allowlist refuses the host -- so this is the same
     * distinction the search results above keep, at the surface where it used to
     * be a 500 instead.
     *
     * THE PROVIDER'S OWN REASON IS ON THE PAGE, named by the URL the owner typed
     * rather than by a name: reading the name off the manifest is one of the
     * things that failed, and the URL is the only part of this they can act on.
     */
    const named = {
      provider: providerSearch.unreachable,
      container: providerSearch.browsable.container,
    };
    const at = browsing(named);

    const { status, text } = await documentAt(at, owner);

    expect(status).toBe(200);
    const said = await whatTheProviderSays(named);
    if (said.answer !== "unreachable") {
      throw new Error(`the unreachable provider answered ${said.answer}`);
    }
    const container = sectionIn(text, "container");
    // NOT "could not be reached", WHICH WOULD BE FALSE OF A THIRD CASE THIS
    // BRANCH ALSO CARRIES: a provider that answered, badly. This URL really is
    // unreachable, so either sentence would pass here -- what is asserted is the
    // one the page has to be able to say about all three.
    expect(container.toLowerCase()).toContain("nothing could be learned about that id");
    expect(container).toContain(said.reason.text);
    // AND NOT EITHER OF THE OTHER TWO, which is what distinguishing them means.
    expect(container.toLowerCase()).not.toContain("no container at that id");
    expect(container.toLowerCase()).not.toContain("does not offer browse");
    expect(postFormsIn(container)).toHaveLength(0);
  });

  /*
   * THE THIRD CASE THE BRANCH ABOVE CARRIES: a provider that WAS reached and
   * answered badly, whose reason is therefore its own rather than this app's.
   *
   * ADR-0123 makes those two render differently -- CanonCore's own sentence
   * plainly, anything else in quotation marks beside the provider that produced
   * it -- and every other test here reaches the `canoncore` branch, because the
   * suite's one unreachable provider is refused by the allowlist before a socket
   * opens. Without this, the quoting CNCORE-96 binds every reason surface to is
   * rendered by nothing.
   *
   * THE PROVIDER IS CONFIGURED RATHER THAN STOOD UP HERE, because this page
   * refuses a base URL this instance does not name and renders its
   * `not-configured` notice instead -- so a stub of this test's own never
   * reaches the branch under test.
   */
  it("quotes a provider's own text beside the provider, rather than printing it as CanonCore's", async () => {
    const named = { provider: providerSearch.answersBadly, container: "388305" };

    const { status, text } = await documentAt(browsing(named), owner);
    const said = await whatTheProviderSays(named);

    expect(status).toBe(200);
    if (said.answer !== "unreachable") {
      throw new Error(`a provider that answered badly was reported ${said.answer}`);
    }
    // ITS OWN TEXT, so the Owner can tell this from a refusal -- CNCORE-92's
    // rule that a refusal reworded is not a refusal reported.
    expect(said.reason.wrote).toBe("provider");
    const container = sectionIn(text, "container");
    // QUOTED. `<q>` is the whole of what says the catalogue is not the one
    // making this claim, and the lead sentence names the provider beside it.
    expect(container).toContain(`<q>${said.reason.text}</q>`);
    expect(container).toContain(named.provider);
  });

  it("still names the Item the catalogue holds, when the provider refuses the id", async () => {
    /*
     * A REFUSAL FROM THE PROVIDER IS NOT THE CATALOGUE FORGETTING. These are two
     * parties answering two questions, and the page asks both: a provider that
     * holds no container at that id says nothing about whether this catalogue
     * already has the thing. An owner whose provider has gone down or dropped an
     * id is exactly the owner who most needs the local copy pointed at.
     *
     * THE ID IS ONE THE HARNESS IMPORTED, AND IT IS NOT A CONTAINER. That is the
     * commonest way to reach this state honestly: a record id typed into a box
     * that wants a container's. Measured against the real image as well as the
     * stub -- `/browse/265` answers 404 `no such container` while `/lookup/265`
     * answers 200 -- so both runs of this suite reach the same branch.
     */
    const imported = inject("imported");
    const named = { provider: inject("providerWikiUrl"), container: imported.recordId };

    const { status, text } = await documentAt(browsing(named), owner);

    expect(status).toBe(200);
    const container = sectionIn(text, "container");
    expect(container.toLowerCase()).toContain("no container at that id");
    // AND THE CATALOGUE'S HALF OF THE ANSWER SURVIVES IT.
    expect(container).toContain("Already imported");
    expect(itemLinkedIn(container)).toBe(`/items/${imported.id}`);
  });

  it("treats a provider it does not search as no provider, rather than reaching it", async () => {
    /*
     * A QUERY PARAMETER IS NOT A CONFIG URL. `CONTEXT.md` defines one as "a URL
     * the owner typed into settings", which is what earns it ADR-0034's allowlist
     * rather than the content deny rule -- and a value in a link somebody followed
     * has none of that standing while reaching the same fetch. The browse box
     * offers a `select` for this reason; the address bar must not be the free-text
     * box that comment says would be wrong.
     *
     * AND A MALFORMED ONE IS AN ANSWER RATHER THAN A 500, which is the rule
     * `/items/<id>` already applies to an id it cannot use (CNCORE-14).
     */
    for (const named of ["http://somewhere.else.test", "not a url at all"]) {
      const { status, text } = await documentAt(
        browsing({ provider: named, container: providerSearch.browsable.container }),
      );

      expect(status).toBe(200);
      expect(() => sectionIn(text, "container")).toThrow();
      expect(sectionIn(text, "not-configured")).toContain("/settings");
    }
  });
});

/**
 * WHETHER THIS SURFACE OFFERS A LOGIN IT CANNOT HONOUR (CNCORE-146).
 *
 * `/import` DOES NOT HIDE ITSELF, ONLY ITS BUTTONS (ADR-0044, ADR-0072): a
 * visitor still searches the providers, still reads what this CATALOGUE holds,
 * and `LogIn` stands where each control would. It no longer reads what a
 * PROVIDER says about a container: that one read is the Owner's since CNCORE-154
 * (ADR-0131), because answering it runs a whole browse at a third party, and
 * `LogIn` stands where it would have been like any other control. That notice linked `/login`
 * without reading whether this instance HAS one, so on ADR-0044's read-only
 * demo it was a door with no key cut for it, repeated once per control down the
 * whole page.
 *
 * AND THE PER-CONTROL HALF OF THAT FIX HAS NO INSTANCE TO BE READ ON, WHICH IS
 * NAMED HERE RATHER THAN LEFT TO BE DISCOVERED. `LogIn` renders only where
 * there is a control to stand in for -- a candidate row, or a named container
 * -- and both need a provider this instance is configured to reach. THREE
 * servers here set no owner password: the fresh install, `aCatalogueLargerThan
 * OnePage` and `aCatalogueThatHoldsStill`. Every one of them also passes
 * `providers: []`, so not one renders a control, and the notice that stands
 * where a control would has nowhere to be read. An instance in the missing
 * combination -- no password AND a provider configured -- would recover it, and
 * ADR-0104 refuses an eleventh server: a single run of this suite already peaks
 * at about the whole of a default PostgreSQL connection budget. So what is
 * asserted below is the PAGE-LEVEL notice, which does render there; what is not
 * is the sentence beside a control. ADR-0094 records the same shape for the
 * empty state's own missing half.
 *
 * THE FIRST DRAFT OF THIS PARAGRAPH SAID "the only server in this suite with no
 * owner password is the fresh install", WHICH WAS FALSE AND WOULD HAVE BEEN
 * READ AS FACT. Three do. The conclusion survives for a different reason than
 * the one given, which is exactly the failure CNCORE-144 was about: a claim
 * about another file's current state, written without reading it.
 */
describe("/import, on an instance nobody can log in to", () => {
  it("says which silence that is, rather than leaving a reader to look for a way in", async () => {
    const { status, text } = await documentFrom(freshBaseUrl, "/import");

    expect(status).toBe(200);
    // THE WHOLE DOCUMENT FOR THE NEGATIVE, which is a real assertion on this
    // instance: the header offers no login here either (CNCORE-139).
    expect(text).not.toContain('href="/login"');
    // AND THE PAGE SAYS SO ONCE, AT THE TOP, rather than per control. A reader
    // told only "only the owner can import", beside every button, still has to
    // work out for themselves that becoming the owner is not on offer here.
    expect(sectionIn(text, "no-login").toLowerCase()).toContain("no password set");
  });
});

describe("/import, to a reader with no session on an instance that has a password", () => {
  it("still offers the login where a control would be", async () => {
    // The answer the fix must not cost, and the one that made this page's
    // notice worth having: this reader may BE the owner and simply not have
    // used the password yet.
    const { status, text } = await documentFrom(baseUrl, searching(providerSearch.query));

    expect(status).toBe(200);
    // THE ROW, NOT THE DOCUMENT, for the reason the search assertions above
    // give and one more since CNCORE-139: the header offers this reader a login
    // on every page of this instance, so the document carries one whatever the
    // row does.
    expect(rowTitled(text, providerSearch.held)).toContain('href="/login"');
  });

  it("offers it where the OTHER control would be too, which is the ordering", async () => {
    // `LogIn` stands in for two controls on this page and they are reached by
    // different routes: the Import button on a candidate row, and Import its
    // ordering on a named container. Review found the second asserted in
    // neither instance state -- a notice threaded through a second chain of
    // components, with nothing reading it back.
    const { status, text } = await documentFrom(baseUrl, browsing(providerSearch.browsable));

    expect(status).toBe(200);
    expect(sectionIn(text, "container")).toContain('href="/login"');
  });

  it("says nothing about a password that is set", async () => {
    // The notice above is the read-only instance's alone. On an instance with a
    // password, "nobody can log in" is false and the login beside each control
    // is the true answer.
    const { text } = await documentFrom(baseUrl, "/import");

    expect(() => sectionIn(text, "no-login")).toThrow();
  });
});
