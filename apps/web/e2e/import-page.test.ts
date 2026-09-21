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
  followed,
  linkedIn,
  logInAt,
  navigatingFormsIn,
  postFormsIn,
  prefetchAt,
  quotesIn,
  type RenderedForm,
  sectionIn,
  submit,
  textOf,
  walkLinked,
  withFields,
} from "./document";
import { HARNESS_CONNECTIONS } from "./instance";
import { TIMELINES, WAR_CHILD_MASTER } from "./wiki-fixture";

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
 * THE SAME RPC SURFACE, ASKED AS THE OWNER, which `client` above deliberately
 * is not. Everything this file asks through it is an `ownerProcedure`, so asking
 * it without a session answers `Unauthorized` rather than what the test is
 * asking about. `purge-page.test.ts` builds its client the same way for the same
 * reason.
 *
 * `provider.container` IS AN `ownerProcedure` DESPITE BEING A READ. It moved
 * behind the session under CNCORE-154 (ADR-0131): it answers by running the
 * whole browse at a third party, which CNCORE-151 gave sixty seconds. The
 * assertions that read it are asking what the PROVIDER says so they can compare
 * it against what the page rendered, so they need the answer rather than the
 * refusal.
 *
 * ONE OWNER CLIENT, ON `owner`'S COOKIE, because there is one Owner: the pages
 * this file reads with `owner` and the procedures it asks here are one caller
 * with one session.
 *
 * TODO(CNCORE-323): building a client at a test instance is written out across
 * `e2e/` and `live/` rather than being one function.
 */
const asTheOwner: AppRouterClient = createORPCClient(
  new RPCLink({ url: `${baseUrl}/api/rpc`, headers: { cookie: owner } }),
);

/** The same owner on the empty instance, for the one read that needs one. */
const ownerOfTheEmptyOne = await logInAt(allowlistedBaseUrl, inject("ownerPassword"));

/**
 * THE CATALOGUE'S OWN ROWS, which this file reaches for exactly once and for a
 * fact no surface above them can state. `multi-placement.test.ts` opens the same
 * seam in this suite for the same shape of reason.
 */
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

/**
 * THE SAME DEFECT `/search` CARRIED, ONE SURFACE OVER (CNCORE-296, folded into
 * CNCORE-291 because it is one reason to change rather than two).
 *
 * `?q=` is composed by anybody and this page speaks it in two sentences of its
 * own: the results heading, and the way back from a candidate. Both went
 * through `TheirWords` alone, which says of itself that it does not "quote,
 * bound or attribute" -- it settles WIDTH, and a value of any length still
 * occupies the page.
 *
 * ASSERTED WHERE `/search`'S THREE AND `?refused=`'S TWO ARE: against a served
 * document, because a bound that holds in a unit test and not over HTTP has not
 * been applied at the seam a reader arrives through.
 */
describe("/import on a query somebody else composed", () => {
  it("quotes back only the opening of a query somebody made enormous", async () => {
    const flood = `zzzznothinghere${"a".repeat(400)}`;

    const { status, text } = await documentAt(searching(flood), owner);

    expect(status).toBe(200);
    const shown = textOf(sectionIn(text, "results"));
    // THE ANSWER IS STILL GIVEN, which is the half a bound must not cost.
    expect(shown).toContain("Nothing matched");
    expect(shown).not.toContain(flood);
    // AND THE READER STILL RECOGNISES WHAT THEY ASKED.
    expect(shown).toContain("zzzznothinghere");
  });

  it("strips a control character rather than letting it re-order its own sentence", async () => {
    // RIGHT-TO-LEFT OVERRIDE, then the scam sentence written backwards -- how
    // it is composed to be READ once the override turns it around inside this
    // page's own heading. Well under any ceiling, which is the point: a cut
    // alone never reaches this.
    const reversing = "\u202esseccaerotseroteyap zzzznothinghere";

    const { status, text } = await documentAt(searching(reversing), owner);

    expect(status).toBe(200);
    const shown = textOf(sectionIn(text, "results"));
    expect(shown).toContain("Nothing matched");
    expect(shown).toContain("zzzznothinghere");
    expect(shown).not.toContain("\u202e");
  });

  it("writes the whole query into the links, not the one it quotes", async () => {
    // THE TWO VALUES, at the place they could collapse back into one with no
    // visible symptom. The Group picker beside a search carries `?q=` forward,
    // so a link built from the QUOTED value would narrow a search for the
    // opening of the query plus a cut marker -- a different question from the
    // one this page answered, asked of the Providers, and the page it was
    // clicked from would look perfectly correct.
    //
    // THE PROVIDER CALL ITSELF NEEDS NO WITNESS HERE, because it does not read
    // this carrier at all: `provider.search` is called with the `query` read
    // off the address, and `search.quoted` cannot reach it. What follows is
    // the half that a carrier CAN get wrong.
    const flood = `zzzznothinghere${"a".repeat(400)}`;

    const { status, text } = await documentAt(searching(flood), owner);

    expect(status).toBe(200);
    // READ OFF THE `href`S AND NOT THE DOCUMENT: Next puts the address into its
    // own flight payload, so the whole query is in these bytes either way.
    const carried = [...text.matchAll(/href="(\/import\?[^"]*)"/g)].flatMap(([, href]) =>
      href === undefined ? [] : [href.replaceAll("&amp;", "&")],
    );
    expect(carried.length).toBeGreaterThan(0);
    for (const href of carried) {
      expect(href).toContain(encodeURIComponent(flood));
      expect(href).not.toContain(encodeURIComponent("\u2026"));
    }
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
     * AND THE ONES FAILING DO NOT EMPTY THE PAGE. The seeded instance is
     * configured with a provider whose host is not allowlisted, and with others
     * that answer badly, so every search it serves has failures in it; the
     * criterion is that the other providers' answers survive them, and that the
     * owner is told which URL failed and why.
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
    const answeredBadly = failed.find(({ baseUrl }) => baseUrl === providerSearch.answersBadly);
    expect(answeredBadly?.reason.wrote).toBe("provider");

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
    expect(quotesIn(taken.text)).toContain(`/ answered 503: ${lapsed.said}`);
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
    expect(textOf(container)).toContain(`${holdsNothing.name} holds no container at that id`);
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
    expect(textOf(container)).toContain(`${declining.name} does not offer browse`);
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
  return asTheOwner.provider.container({ baseUrl: named.provider, containerId: named.container });
}

/** A record's own container, asked of the URL the page builds for it (CNCORE-238). */
function askingAbout({ provider, record }: { provider: string; record: string }): string {
  return `/import?provider=${encodeURIComponent(provider)}&record=${encodeURIComponent(record)}`;
}

/**
 * THE CONTROL ON A CANDIDATE ROW THAT ASKS FOR ITS CONTAINER, and the address
 * submitting it reaches.
 *
 * A NAVIGATING FORM RATHER THAN A LINK, WHICH IS THE CRITERION RATHER THAN A
 * STYLE. This address COSTS A LOOKUP AT A THIRD PARTY, so a link here would put
 * one per candidate on an address a reader reaches without asking -- the "one
 * request per Provider" a search is supposed to cost turned into one per result.
 * A string-action form prefetches its ACTION PATH instead, whose fields are not
 * known until submission (`PurgeBox` takes the same measure for the same
 * reason). Read as a form here so that a regression to a link fails rather than
 * quietly costing what ADR-0149 exists to avoid.
 *
 * NOT "ON A READER WHO MERELY SCROLLED PAST", which is what this said and what
 * ADR-0161 measured as false on 2026-09-20: a prefetch of this dynamic route is
 * skipped. The criterion is unchanged, because the cost returns with one
 * `prefetch={true}` or one `loading.tsx`.
 */
function itsContainerAsked(row: string): {
  provider: string;
  record: string;
  query?: string;
  group?: string;
} {
  const asks = navigatingFormsIn(row).find(({ action }) => action.endsWith("/import"));
  if (!asks) throw new Error(`that candidate offers no way to its container:\n${row}`);
  const carried = (name: string) => {
    const found = asks.fields.find(([key]) => key === name);
    if (!found) throw new Error(`that control carries no \`${name}\`: ${JSON.stringify(asks)}`);
    return found[1];
  };
  const optional = (name: string) => asks.fields.find(([key]) => key === name)?.[1];
  return {
    provider: carried("provider"),
    record: carried("record"),
    // THE SEARCH THAT FOUND THE RECORD (CNCORE-239), optional here so that the
    // assertion about it reads as a missing QUERY rather than a missing form.
    query: optional("q"),
    group: optional("group"),
  };
}

/**
 * WHERE A NAVIGATING CONTROL SENDS A BROWSER: its action with its fields on it,
 * which is what a browser puts in the address bar on submit.
 */
function whereItSubmits(within: string): string {
  const [form] = navigatingFormsIn(within);
  if (!form) throw new Error(`nothing there navigates:\n${within}`);
  return `${form.action}?${new URLSearchParams(form.fields)}`;
}

/**
 * THIS PAGE'S OWN SEARCH BOX, found by the label its input carries.
 *
 * NOT BY ITS FIELDS AND NOT BY ITS POSITION, both of which find the wrong form
 * here and PASS. Three navigating forms on this document carry a `q`: the site
 * header's box, which submits to `/search` and carries the Group too; this
 * page's box; and the way back, whose `q` is hidden. The first draft of this
 * helper took the first form carrying a `q` and matched the HEADER -- so the
 * assertion below went green against a box on another surface entirely, while
 * the box it names carried nothing.
 */
function theSearchBox(text: string): RenderedForm {
  const labelled = /<form\b[^>]*>(?:(?!<\/form>).)*aria-label="A title to look for"/is.exec(text);
  if (!labelled) throw new Error("the page rendered no search box of its own");
  const [form] = navigatingFormsIn(text.slice(labelled.index));
  if (!form) throw new Error("that search box does not navigate");
  return form;
}

/**
 * ONE ADDRESS, READ AS A DESTINATION RATHER THAN AS A STRING: its path and what
 * it carries, each parameter once.
 *
 * BECAUSE A SPACE HAS TWO LAWFUL SPELLINGS HERE and they mean one address. A
 * browser submitting a GET form writes `application/x-www-form-urlencoded`, so
 * a space arrives as `+`, while a link this suite navigates directly writes
 * `%20` through `encodeURIComponent`. Comparing the two as text asserts which
 * road the address came down, which is not what any of these tests are about.
 */
function asADestination(address: string): { path: string; carrying: [string, string][] } {
  const at = new URL(address, "http://import.test");
  return { path: at.pathname, carrying: [...at.searchParams].sort() };
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
     * THE OWNER NAMES THE CONTAINER BY ITS ID, which is what a decliner of
     * `containers` leaves them -- and TMDB, whose collection this is, declines
     * it (ADR-0033 under CNCORE-186). A container picked from a provider's list
     * arrives at this same address; "/import, offering what a provider holds"
     * below takes that road.
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

/** A Provider picked in the browse box, as the box's form puts it in the URL. */
function picking(provider: string): string {
  return `/import?provider=${encodeURIComponent(provider)}`;
}

/** Every container a page of the list offers: its title, and where it leads. */
function offeredIn(text: string): { title: string; href: string }[] {
  return rows(sectionIn(text, "containers")).map((row) => {
    const [, href, words] = /<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/.exec(row) ?? [];
    if (href === undefined) throw new Error(`that row links nothing:\n${row}`);
    return { title: textOf(words ?? ""), href };
  });
}

/** What a page of the list says it is showing, word for word (ADR-0133). */
function theSentenceIn(words: string): string | undefined {
  return /Showing containers? [\d,]+(?: to [\d,]+)? of [\d,]+/.exec(words)?.[0];
}

describe("/import, reaching the Container a found record names", () => {
  it("leads from a record found by searching to its Container's preview, with no id typed", async () => {
    /*
     * SPEC CNCORE-159's STORY 61, END TO END: "reach a Container from a record I
     * found by searching". A search candidate carries no `series_id` at all --
     * `provider-tmdb` hardcodes `null` on that path, because TMDB's multi-search
     * carries no collection and filling one would cost a request per result --
     * so until this the only road from a found film to its collection was
     * typing an id the provider never showed anyone.
     *
     * THE ID IS NEVER TYPED AND NEVER WRITTEN DOWN HERE. It is read off the
     * control the page rendered, and what the page should say about it is asked
     * of the router rather than asserted from a literal: this suite runs against
     * a stub on one machine and the REAL `provider-tmdb` image in CI, and a
     * literal would be asserting which of those two was running.
     */
    const found = await documentAt(searching(providerSearch.query), owner);
    const asked = itsContainerAsked(rowTitled(found.text, providerSearch.held));
    expect(asked.provider).toBe(providerSearch.browsable.provider);

    const named = await documentFrom(baseUrl, askingAbout(asked));

    expect(named.status).toBe(200);
    const said = await client.provider.containerOf({
      baseUrl: asked.provider,
      recordId: asked.record,
    });
    if (said.answer !== "container") {
      throw new Error(`the provider named no container for ${asked.record}: ${said.answer}`);
    }
    // THE CONTAINER'S OWN NAME, WHICH IS NOT THE RECORD'S AND NOT THE ID. A
    // page echoing either would satisfy a bare `toContain` on the section.
    const section = sectionIn(named.text, "its-container");
    expect(said.containerTitle).not.toBe(said.containerId);
    expect(section).toContain(said.containerTitle as string);

    // AND IT LEADS TO THE SAME PREVIEW A CONTAINER PICKED FROM THE LIST
    // REACHES, rather than to a second rendering of one: the address is
    // `?provider=&container=`, and what answers there is `provider.container`
    // behind ADR-0131's door, unwidened by this road to it.
    const to = linkedIn(section, said.containerTitle as string);
    expect(to).toBe(browsing({ provider: asked.provider, container: said.containerId }));

    const preview = await documentFrom(baseUrl, to as string, owner);
    expect(preview.status).toBe(200);
    const whole = await whatTheProviderSays({
      provider: asked.provider,
      container: said.containerId,
    });
    if (whole.answer !== "container") {
      throw new Error(`the provider handed over no container: ${whole.answer}`);
    }
    expect(sectionIn(preview.text, "container")).toContain(whole.title);
  });

  it("looks nothing up until it is asked, so a search still costs one request per Provider", async () => {
    /*
     * THE COST CRITERION, AT THE ONE SEAM THAT CAN SEE IT. What a lookup COSTS
     * is asserted a layer down, where a stub records the paths it was asked for
     * (`provider.test.ts`); in CI this suite runs against the REAL
     * `provider-tmdb` image, which records nothing and cannot be made to. What
     * this seam can see is the thing that would spend it: an ADDRESS Next is
     * allowed to prefetch.
     *
     * A WAY ONWARD SPELLED AS A `<Link>` would put a lookup per candidate on an
     * address a reader reaches without asking -- one request per RESULT, which
     * is exactly the design ADR-0149 rejected as too expensive to do eagerly. A
     * string-action form's fields are not known until submission, so its action
     * path is all that is prefetched. That is why the control is a form, and
     * this is the assertion that fails on the day somebody simplifies it into a
     * link.
     *
     * IT NO LONGER CLAIMS THE COST ARRIVES ON A SCROLL, because it does not
     * (ADR-0161, CNCORE-245). The sentence here said a link "would run a lookup
     * per candidate for a reader who merely scrolled"; measured on 2026-09-20,
     * a prefetch of this dynamic route renders nothing, which the test below
     * this one asserts. THE ASSERTION STAYS AS IT IS: what it reads for is a
     * prefetchABLE address, and that is still the thing that would spend the
     * lookup the moment one `prefetch={true}` or one `loading.tsx` lands.
     */
    const found = await documentAt(searching(providerSearch.query), owner);

    // NOT ONE ROW, BUT THE WHOLE PAGE: a link anywhere on it is prefetchable.
    expect(found.text).not.toContain("record=");
    // AND NOTHING WAS ASKED, which is the other half: the section that reports
    // a lookup is absent from a page that was only searched.
    expect(() => sectionIn(found.text, "its-container")).toThrow();
    // THE CONTROL IS THERE ALL THE SAME, so this passes for the right reason
    // rather than because the feature is missing.
    expect(
      itsContainerAsked(rowTitled(found.text, providerSearch.held)).record.length,
    ).toBeGreaterThan(0);
  });

  it("renders nothing for a prefetch, so scrolling past a link to it spends no Provider request", async () => {
    /*
     * THE COST THE THREE RECORDS RESTED ON, MEASURED RATHER THAN INFERRED
     * (CNCORE-245, CNCORE-240). ADR-0149 and ADR-0151 each said a `<Link>` to an
     * address like this one would spend its cost "because a reader scrolled
     * past". It does not, and ADR-0161 carries the measurement and the
     * CONDITION it holds under.
     *
     * THE ADDRESS IS THE MOST EXPENSIVE ONE THIS PAGE HAS: `q` alone is a whole
     * fan-out, one request to every Provider in scope, which is the cost
     * ADR-0151 refuses to hang on a link.
     *
     * TWO REQUESTS AT ONE ADDRESS, DIFFERING ONLY IN THE HEADERS NEXT'S ROUTER
     * SENDS. Asserting the absence alone would pass against a 404, a redirect
     * or a page that had stopped rendering results at all, so the rendered
     * fetch is what makes the prefetch's silence mean something.
     *
     * THE WITNESS IS A PROVIDER'S NAME RATHER THAN A RESULT, and it has to be.
     * A candidate's title can equal the QUERY -- `providerSearch.held` does --
     * and the prefetch's answer echoes the address back inside its routing
     * payload, so a title would be found there and report a fan-out that never
     * happened. This name reaches the page only because the Provider holding
     * it was ASKED: it matches nothing and is listed anyway, which is what
     * makes it the fan-out's own fingerprint.
     */
    const asked = searching(providerSearch.query);
    const fannedOut = providerSearch.floodsItsName.name.slice(0, 100);
    const rendered = await documentAt(asked);
    const prefetched = await prefetchAt(asked);

    expect(rendered.text).toContain(fannedOut);
    expect(prefetched.status).toBe(200);
    expect(prefetched.text).not.toContain(fannedOut);
  });

  it("renders nothing for a prefetch of the picker's own address either, which is what CNCORE-240 asked", async () => {
    /*
     * THE ADDRESS THAT TICKET IS ACTUALLY ABOUT, asserted rather than inferred
     * from the one above. CNCORE-240 asked "how many Provider requests a
     * scrolled `/import` results page spends on prefetch alone" and named the
     * Group picker's links: `?q=&group=` each, one per Group plus `Everything`,
     * every one an ordinary `<Link>`. A Group here decides WHICH PROVIDERS ARE
     * ASKED (CNCORE-182), so that address is a fan-out of its own rather than
     * the same one narrowed.
     *
     * IT IS THE SAME ROUTE AND SO THE SAME ANSWER -- which is exactly why the
     * ticket's N+1 does not occur, and exactly why asserting only `?q=` would
     * leave a reader to work that out. The seam reads the address somebody
     * worried about.
     *
     * NO COUNT OF REQUESTS, because no seam here can take one: this suite runs
     * against a stub locally and the REAL `provider-tmdb` image in CI, which
     * records nothing and cannot be made to (ADR-0149). What is asserted is the
     * rendering that would have required the requests.
     */
    const scope = await asTheOwner.group.create({
      name: `Only one Provider ${crypto.randomUUID()}`,
    });
    await asTheOwner.group.ask({ id: scope.id, baseUrl: providerSearch.browsable.provider });

    const narrowed = `${searching(providerSearch.query)}&group=${scope.id}`;
    const rendered = await documentAt(narrowed, owner);
    const prefetched = await prefetchAt(narrowed, owner);

    /*
     * A ROW RATHER THAN A TITLE, for the reason the test above gives and this
     * one cannot borrow: the Provider that matches nothing is not in this
     * Group, so its name is no fingerprint here. `>title<` is `rowTitled`'s own
     * reading -- the title as the WHOLE TEXT of an element -- and the routing
     * payload echoes the query as a JSON value, never as markup.
     */
    const row = `>${providerSearch.held}<`;
    expect(rendered.text).toContain(row);
    expect(prefetched.status).toBe(200);
    expect(prefetched.text).not.toContain(row);
    // AND NO PROVIDER OF THIS GROUP WAS NAMED, which the address cannot echo.
    expect(prefetched.text).not.toContain(providerSearch.browsable.provider);
  });

  it("says a Provider names no Container for a record, rather than offering a link to nothing", async () => {
    /*
     * THE ORDINARY ANSWER AT A PROVIDER LIKE `provider-wiki`, where a story
     * sits in many timelines at once and no single one of them is THE
     * container. A row that offered the way onward anyway would lead to a
     * preview of nothing, which is the one outcome worse than saying so.
     *
     * THE CONFORMANCE WITNESS IS THE FIXTURE: it holds one record naming no
     * container, and it is a Provider this instance searches, so the candidate
     * arrives on this page by the ordinary road.
     */
    const found = await documentAt(searching("A work this provider holds"), owner);
    const asked = itsContainerAsked(rowTitled(found.text, "A work this provider holds"));
    expect(asked.provider).toBe(providerSearch.declinesBrowse.url);

    const named = await documentFrom(baseUrl, askingAbout(asked));

    expect(named.status).toBe(200);
    const section = sectionIn(named.text, "its-container");
    expect(textOf(section)).toContain("names no Container");
    // NO WAY ONWARD, which is the half that makes the sentence worth printing.
    expect(linkedIn(section, "A work this provider holds")).toBeUndefined();
    expect(section).not.toContain("container=");
  });

  it("carries the search that found the record, so the way onward keeps it", async () => {
    /*
     * CNCORE-239, THE FIRST HALF. The control CNCORE-238 built submits
     * `provider` and `record` AND NOTHING ELSE, so the search that found the
     * candidate is gone from the page it reaches: an empty box, no results, and
     * the browser's own Back the only way to them.
     *
     * WHAT IS ASSERTED IS THE CONTROL'S OWN FIELDS rather than the page after
     * it, because the fields ARE the address: `next/form` writes them into the
     * query, so a control that carries the query cannot reach a page that lost
     * it. Read off the rendered row for the same reason the record id is --
     * this suite runs against a stub here and the real `provider-tmdb` image in
     * CI, and a literal would assert which one was running.
     */
    const found = await documentAt(searching(providerSearch.query), owner);

    const asks = itsContainerAsked(rowTitled(found.text, providerSearch.held));

    expect(asks.query).toBe(providerSearch.query);
  });

  it("carries the Group the search was narrowed within, which is part of those results", async () => {
    /*
     * CNCORE-239, AND THE REASON `q` ALONE IS NOT THE SEARCH. A Group on this
     * page narrows WHO IS ASKED (CNCORE-182, ADR-0010's third scoped thing), so
     * the same words in a different scope are a different page of results. A
     * way back carrying only the words would land the Owner on results they
     * never saw -- every Provider's, rather than this Group's.
     *
     * THE SCOPE IS MADE HERE RATHER THAN IN THE HARNESS, because it is this
     * assertion's own fixture: one Group asking the one Provider that answers
     * this query. Made through the router as the Owner, which is the road the
     * picker takes, so it is narrowed the way the product narrows it.
     */
    const scope = await asTheOwner.group.create({
      name: `Only one Provider ${crypto.randomUUID()}`,
    });
    await asTheOwner.group.ask({ id: scope.id, baseUrl: providerSearch.browsable.provider });

    const found = await documentAt(`${searching(providerSearch.query)}&group=${scope.id}`, owner);

    const asks = itsContainerAsked(rowTitled(found.text, providerSearch.held));
    expect(asks.query).toBe(providerSearch.query);
    expect(asks.group).toBe(scope.id);
  });

  it("offers the way back to those results, so returning takes no browser Back", async () => {
    /*
     * CNCORE-239's FIRST CRITERION. Until this, the search that found the
     * record was gone from the page it reached -- an empty box, no results, and
     * the browser's own Back the only road to them. Walked against the real
     * `provider-tmdb` image while the ticket was filed: twenty results for The
     * Matrix, none of them on the page after one click.
     *
     * THE WAY BACK IS ASSERTED AS AN ADDRESS rather than as a word on a button,
     * because what makes it a way back is where it goes: the same search, with
     * the same words. A test reading the label would pass against a control
     * that said "Back to results" and went to the front page.
     */
    const found = await documentAt(searching(providerSearch.query), owner);
    const row = rowTitled(found.text, providerSearch.held);

    const named = await documentFrom(baseUrl, whereItSubmits(row));

    expect(named.status).toBe(200);
    expect(asADestination(whereItSubmits(sectionIn(named.text, "its-container")))).toStrictEqual(
      asADestination(searching(providerSearch.query)),
    );
  });

  it("spells the way back as a form, so scrolling past it runs no search", async () => {
    /*
     * THE SECOND CRITERION, AT THE SEAM THAT CAN SEE IT, and it is ADR-0149's
     * own argument applied rather than its conclusion copied. That record made
     * the row's control a form because the address it reached spends a lookup
     * at a third party.
     *
     * THE ADDRESS BACK CARRIES `q`, SO IT SPENDS A WHOLE SEARCH -- a fan-out to
     * every Provider this instance names. A way back spelled as a link would put
     * that on an address a reader reaches without asking for those results,
     * which is the cost ADR-0151 refuses. A string-action form's fields are not
     * known until submission, so `/import` is all that is prefetched and it
     * searches nothing.
     *
     * THE NAME OF THIS TEST IS TRUE FOR A SECOND REASON NOW MEASURED. Scrolling
     * past a link here runs no search either, because a prefetch of this dynamic
     * route is skipped entirely (ADR-0161, 2026-09-20) -- which is what this
     * comment once attributed to the form alone. The form is still the control,
     * and the structural read below is still the assertion, because that second
     * reason ends with one `prefetch={true}` or one `loading.tsx`.
     *
     * READ AS THE ABSENCE OF A PREFETCHABLE `q` ANYWHERE ON THE PAGE, which is
     * the structural shape ADR-0149 asserted the same fact in: not a count of
     * requests, but the thing that would spend them.
     */
    const found = await documentAt(searching(providerSearch.query), owner);
    const row = rowTitled(found.text, providerSearch.held);

    const named = await documentFrom(baseUrl, whereItSubmits(row));

    const anchors = [...named.text.matchAll(/<a\b[^>]*\bhref="(\/[^"]*)"/g)].map(
      ([, href]) => href as string,
    );
    expect(anchors.filter((href) => href.includes("q="))).toStrictEqual([]);
    // AND THE CONTROL IS THERE ALL THE SAME, so this passes for the right
    // reason rather than because nothing offers a way back at all.
    expect(whereItSubmits(sectionIn(named.text, "its-container"))).toContain("q=");
  });

  it("carries the search without asking it, so reaching a Container costs one lookup", async () => {
    /*
     * CNCORE-239's SECOND CRITERION, WHICH IS THE WHOLE TRADE. The obvious way
     * to keep the search is to put `q` in the address, and the obvious
     * consequence is that the page RE-RUNS it -- a Provider fan-out on every
     * click, on a road ADR-0149 built expressly to cost ONE lookup.
     *
     * THE FAN-OUT WAS NEVER A CONSEQUENCE OF THE PARAMETER. It came from a
     * guard that read "a query is in the address" as "run a search", and those
     * are two facts. So the query rides along and is asked only when the Owner
     * asks for it back.
     *
     * ASSERTED AS THE ABSENCE OF THE RESULTS, which is the structural shape
     * this seam can see: the page renders every Provider it asked, including
     * the ones that matched nothing, so a results section is what a search
     * leaves behind. No section, no search -- while `q` is demonstrably on the
     * page, which is what stops this passing for the wrong reason.
     */
    const found = await documentAt(searching(providerSearch.query), owner);
    const row = rowTitled(found.text, providerSearch.held);

    const named = await documentFrom(baseUrl, whereItSubmits(row));

    // THE QUERY IS HERE: the way back carries it, so the page plainly has it.
    expect(whereItSubmits(sectionIn(named.text, "its-container"))).toContain("q=");
    // AND NOTHING WAS SEARCHED FOR IT.
    expect(() => sectionIn(named.text, "results")).toThrow();
  });

  it("returns to the Group's own results, not to every Provider's", async () => {
    /*
     * THE GROUP SURVIVES THE ROUND TRIP (CNCORE-182). A Group narrows WHO IS
     * ASKED, so a way back carrying only the words would land the Owner on a
     * different page of results -- every Provider's rather than this Group's --
     * while looking exactly like the one they left.
     */
    const scope = await asTheOwner.group.create({
      name: `One Provider and no other ${crypto.randomUUID()}`,
    });
    await asTheOwner.group.ask({ id: scope.id, baseUrl: providerSearch.browsable.provider });
    const at = `${searching(providerSearch.query)}&group=${scope.id}`;

    const found = await documentAt(at, owner);
    const named = await documentFrom(
      baseUrl,
      whereItSubmits(rowTitled(found.text, providerSearch.held)),
    );

    expect(asADestination(whereItSubmits(sectionIn(named.text, "its-container")))).toStrictEqual(
      asADestination(at),
    );
  });

  it("keeps the Group in the box too, so a second search asks who the first asked", async () => {
    /*
     * THE BOX AND THE WAY BACK HAVE TO AGREE, which is a thing carrying the
     * query made possible to get wrong. The box is now PREFILLED on this page
     * -- it was empty before -- so pressing Enter in it is a road the Owner
     * has, and one that dropped the Group would quietly ask every Provider and
     * land on results the button one section down would not.
     *
     * `SearchBox`'s own comment already forbids exactly this: "a search from it
     * that quietly asked every Provider would contradict the page it was typed
     * on" (CNCORE-182). Found in review of this ticket.
     */
    const scope = await asTheOwner.group.create({
      name: `A Group the box must keep ${crypto.randomUUID()}`,
    });
    await asTheOwner.group.ask({ id: scope.id, baseUrl: providerSearch.browsable.provider });
    const at = `${searching(providerSearch.query)}&group=${scope.id}`;

    const found = await documentAt(at, owner);
    const named = await documentFrom(
      baseUrl,
      whereItSubmits(rowTitled(found.text, providerSearch.held)),
    );

    expect(theSearchBox(named.text).fields).toContainEqual(["group", scope.id]);
  });
});

describe("/import, offering what a provider holds", () => {
  it("offers its containers to pick from, rather than asking for an id", async () => {
    /*
     * THE WHOLE TICKET IN ONE PAGE (CNCORE-187): the Owner picks a Provider and
     * is shown what it holds, rather than being asked for an id it never showed
     * them. Asked with no session, because the read is open (ADR-0131): it
     * costs a search's time, not a browse's.
     *
     * THE ORACLE IS WHAT THE STUB SERVES, which is the published image's own
     * answer (`wiki-timelines.ts`) -- not whatever the page happens to print.
     */
    const wiki = inject("providerWikiUrl");

    const { status, text } = await documentAt(picking(wiki));

    expect(status).toBe(200);
    const offered = offeredIn(text);
    expect(offered.map(({ title }) => title)).toEqual(
      TIMELINES.slice(0, 100).map(({ title }) => title),
    );
    // THE CAP IS NEVER SILENT, AND SAYS WHICH 100 (ADR-0133): the first of
    // them here, where the walk below reaches the rest.
    expect(textOf(sectionIn(text, "containers"))).toContain("Showing containers 1 to 100 of 465");
    // AND A ROW LEADS WHERE THE ID WOULD HAVE, which is what makes an import
    // from the list the same operation as one by id.
    expect(offered[0]?.href).toBe(
      browsing({ provider: wiki, container: WAR_CHILD_MASTER.container.id }),
    );
  });

  it("walks the list rather than rendering it whole, reaching every one once", async () => {
    /*
     * A PROVIDER MAY HOLD HUNDREDS, and the wiki holds 465: the page carries a
     * page of them and ADR-0119's walk reaches the rest, as on every list in
     * this product. Walked to the end, it must have offered each exactly once
     * and in the provider's own order.
     */
    const seen: string[] = [];
    const said: (string | undefined)[] = [];
    const due: string[] = [];
    let at: string | undefined = picking(inject("providerWikiUrl"));
    while (at !== undefined) {
      const { text } = await documentAt(at);
      const page = offeredIn(text).map(({ title }) => title);
      expect(page.length).toBeLessThanOrEqual(100);
      said.push(theSentenceIn(textOf(sectionIn(text, "containers"))));
      due.push(
        `Showing containers ${seen.length + 1} to ${seen.length + page.length} of ${TIMELINES.length}`,
      );
      seen.push(...page);
      at = walkLinked(text, "Next");
    }

    expect(seen).toEqual(TIMELINES.map(({ title }) => title));
    // AND EVERY PAGE SAYS WHICH OF THEM IT SHOWED (ADR-0133), oracled against
    // the walk: how many the pages before it offered.
    expect(said).toStrictEqual(due);
  });

  it("says a provider declining the operation does not list them, and keeps the id for it", async () => {
    /*
     * AN ABSENT CAPABILITY IS NOT AN EMPTY ANSWER (story 60). `provider-tmdb`
     * declines the operation -- TMDB publishes nothing that lists its
     * collections -- and that is the real image in CI, so this reads what a
     * real decliner makes of the page. Saying it "holds none" would be false.
     *
     * AND THE ID FIELD REMAINS, which is the whole of the Owner's way in there.
     */
    const tmdb = inject("providerTmdbUrl");

    const { status, text } = await documentAt(picking(tmdb), owner);

    expect(status).toBe(200);
    const section = sectionIn(text, "containers");
    expect(textOf(section)).toContain("provider-tmdb does not list the containers it holds");
    expect(textOf(section)).not.toContain("holds no containers");
    const byId = navigatingFormsIn(section).find(({ fields }) =>
      fields.some(([name]) => name === "container"),
    );
    expect(byId?.fields).toContainEqual(["provider", tmdb]);
  });

  it("says a provider could not answer, in its own words, rather than that it holds none", async () => {
    // A LAPSED CREDENTIAL, which this stub answers with a `503` on every path,
    // the manifest included. The live wiki answered its manifest and refused at
    // `/containers` itself (ADR-0033); `provider.test.ts` asks that shape at the
    // router, and here the page has one sentence to carry either way: the
    // provider's own, with the Owner's remedy in it.
    const lapsed = providerSearch.refusesWithASentence;

    const { status, text } = await documentAt(picking(lapsed.url), owner);

    expect(status).toBe(200);
    const section = sectionIn(text, "containers");
    expect(quotesIn(section)).toContainEqual(expect.stringContaining(lapsed.said));
    expect(textOf(section)).not.toContain("holds no containers");
  });

  it("imports one picked from the list, landing what a browse by its id lands", async () => {
    /*
     * PICKED, NOT TYPED, AND THEN THE SAME OPERATION. The row leads to the
     * address the id box reaches, the preview there is the one CNCORE-92 built,
     * and its button is `browse` -- so what lands is what a browse by id lands:
     * the container, and its five members in the wiki's own order, which is not
     * their release order.
     *
     * THIS TIMELINE IS IMPORTED BY NOTHING ELSE, so the list saying "In your
     * catalogue" afterwards is a transition this test caused.
     */
    const wiki = inject("providerWikiUrl");
    const title = WAR_CHILD_MASTER.container.title;
    const before = await documentAt(picking(wiki), owner);
    expect(rowTitled(sectionIn(before.text, "containers"), title)).not.toContain(
      "In your catalogue",
    );
    const at = followed(linkedIn(sectionIn(before.text, "containers"), title), title);

    const offered = await documentAt(at, owner);
    const container = sectionIn(offered.text, "container");
    expect(textOf(container)).toContain("5 members");
    const taken = await submit(baseUrl, at, formIn(container), owner);

    expect(taken.status).toBe(200);
    const itemAt = itemLinkedIn(sectionIn(taken.text, "container"));
    expect(itemAt).toBeDefined();
    const imported = await client.item.get({ id: (itemAt as string).slice("/items/".length) });
    expect(imported.holds.rows.map(({ position, title: named }) => [position, named])).toEqual(
      WAR_CHILD_MASTER.ordering.map(({ position, record }) => [position, record.title]),
    );
    // AND THE LIST NOW SAYS SO, naming the same Item.
    const after = await documentAt(picking(wiki), owner);
    const row = rowTitled(sectionIn(after.text, "containers"), title);
    expect(row).toContain("In your catalogue");
    expect(itemLinkedIn(row)).toBe(itemAt);
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
    expect(quotesIn(container)).toContain(`/ answered 503: ${lapsed.said}`);
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
    expect(quotesIn(container)).toContain(said.reason.text);
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

      // AND NAMED ALONE, which is how the browse box asks what one holds
      // (CNCORE-187): the list is a read at the provider too, so it is no
      // wider a door than the preview.
      const alone = await documentAt(picking(named));
      expect(alone.status).toBe(200);
      expect(() => sectionIn(alone.text, "containers")).toThrow();
      expect(sectionIn(alone.text, "not-configured")).toContain("/settings");
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
