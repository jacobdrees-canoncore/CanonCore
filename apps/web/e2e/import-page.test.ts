import type { AppRouterClient } from "@canoncore/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { describe, expect, inject, it } from "vitest";

import { documentAt, documentFrom, postFormsIn, type RenderedForm, submit } from "./document";

/**
 * THE IMPORT SURFACE, over real HTTP. ADR-0103's fourth seam, which is the one
 * CNCORE-68 names: a page-over-HTTP assertion and no browser, because everything
 * this page renders is in the HTML the server returns -- and the forms it carries
 * are replayed exactly as a browser with JavaScript switched off submits them.
 */
const providerSearch = inject("providerSearch");
const baseUrl = inject("baseUrl");
/**
 * THE SECOND SERVER: the same build, an empty database, no `PROVIDER_ALLOWLIST`
 * and no `PROVIDER_URLS`. That is a stranger's first run of CanonCore (ADR-0094),
 * and neither state exists on the seeded instance -- so without it the two
 * criteria about an unconfigured instance could only be asserted a layer down
 * from the page that has to satisfy them.
 */
const freshBaseUrl = inject("freshBaseUrl");
const client: AppRouterClient = createORPCClient(new RPCLink({ url: `${baseUrl}/api/rpc` }));

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
    const { status, text } = await documentAt(searching(providerSearch.query));

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

    const before = await documentAt(at);
    // THE ROW OFFERS TO TAKE IT AND NAMES NO ITEM, which is the state the POST
    // below has to change. Asserted rather than assumed: without it this test
    // would pass against a page that showed an Item link on every row from the
    // start.
    expect(itemLinkedIn(rowTitled(before.text, title))).toBeUndefined();
    const form = formIn(rowTitled(before.text, title));
    expect(field(form, "recordId")).toBe(recordId);

    const taken = await submit(baseUrl, at, form);

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
    const { text } = await documentAt(searching(providerSearch.query));

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
});

describe("/import, taking a record it already holds", () => {
  it("changes nothing: the same Item, and a catalogue no larger", async () => {
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
    const held = rowTitled((await documentAt(at)).text, providerSearch.held);
    const before = itemLinkedIn(held);
    expect(before).toBeDefined();
    const form = formIn(held);
    const { total } = await client.catalogue.list({});

    const once = await submit(baseUrl, at, form);
    const twice = await submit(baseUrl, at, form);

    expect(once.status).toBe(200);
    expect(twice.status).toBe(200);
    // THE SAME ITEM BOTH TIMES, and the same one it was before either press.
    expect(itemLinkedIn(rowTitled(once.text, providerSearch.held))).toBe(before);
    expect(itemLinkedIn(rowTitled(twice.text, providerSearch.held))).toBe(before);
    // AND NO ITEM ANYWHERE ELSE EITHER, which is the half a row cannot show: a
    // second item for this record would be in the catalogue whether or not this
    // row linked it.
    //
    // TODO(CNCORE-93): this total is catalogue-wide and another test FILE is
    // writing to the same catalogue while it is read -- `multi-placement.test.ts`
    // browses two containers in its own `beforeAll`, in another worker. Measured
    // 2026-09-12 against the real provider images: this failed in two of four
    // full runs and passed every time the file ran alone. Left standing rather
    // than weakened here, because the claim it makes is the right one and the
    // replacement has to be able to see a second Item.
    expect((await client.catalogue.list({})).total).toBe(total);
  });
});

/** One `<section>` of a page, by the heading it is labelled with. */
function section(text: string, label: string): string {
  const found = text.match(new RegExp(`<section[^>]*aria-labelledby="${label}".*?</section>`))?.[0];
  if (!found) throw new Error(`the page rendered no \`${label}\` section`);
  return found;
}

describe("/import on a fresh install", () => {
  it("says no provider is allowlisted, rather than returning an empty list", async () => {
    // ADR-0034's allowlist is empty by default and the empty value refuses every
    // provider, which is the safe end of the failure and is completely silent: an
    // unconfigured instance and a broken one look identical from a page. The
    // criterion is that the surface SAYS so, and an empty `<section>` satisfies a
    // test that only asks whether the element is there -- so what is asserted is
    // the identifier the owner has to go and set.
    const { status, text } = await documentFrom(freshBaseUrl, "/import");

    expect(status).toBe(200);
    const notice = section(text, "no-provider");
    expect(notice).toContain("PROVIDER_ALLOWLIST");
    expect(notice.toLowerCase()).toContain("no provider is allowlisted");
  });

  it("says no provider is configured either, which is the other setting", async () => {
    // TWO SETTINGS, TWO REMEDIES. An instance reaches no provider either because
    // nothing is allowlisted or because nothing is NAMED, and neither is derivable
    // from the other -- `127.0.0.0/8` carries no scheme and no port. A surface that
    // said only the first would send an owner to fix the wrong one.
    const fresh = await documentFrom(freshBaseUrl, "/import");

    const notice = section(fresh.text, "no-provider-configured");
    expect(notice).toContain("PROVIDER_URLS");
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
    expect(() => section(seeded.text, "no-provider-configured")).toThrow();
  });
});

/** A container named in the URL, as the browse form's fields put it there. */
function browsing({ provider, container }: { provider: string; container: string }): string {
  return `/import?provider=${encodeURIComponent(provider)}&container=${encodeURIComponent(container)}`;
}

/** What one provider says about the container the URL names, asked of the router. */
async function whatTheProviderSays(named: { provider: string; container: string }) {
  return client.provider.container({ baseUrl: named.provider, containerId: named.container });
}

describe("/import, before a container's ordering is imported", () => {
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

    const { status, text } = await documentAt(at);

    expect(status).toBe(200);
    const said = await whatTheProviderSays(providerSearch.browsable);
    if (said.answer !== "container") {
      throw new Error(`the provider handed over no container: ${said.answer}`);
    }
    // A REAL TITLE RATHER THAN AN ECHO OF THE ID. A page printing back what was
    // typed would satisfy a bare `toContain` against the section.
    expect(said.title).not.toBe(providerSearch.browsable.container);
    expect(section(text, "container")).toContain(said.title);
  });

  it("says how many members the browse would write, before it writes them", async () => {
    /*
     * ONE PRESS WRITES A CONTAINER'S WORTH OF PLACEMENTS -- that is the whole
     * reason `browse` exists (ADR-0033) -- and the page used to describe what
     * was about to happen with nothing but the id that had been typed.
     */
    const { text } = await documentAt(browsing(providerSearch.browsable));

    const said = await whatTheProviderSays(providerSearch.browsable);
    if (said.answer !== "container") {
      throw new Error(`the provider handed over no container: ${said.answer}`);
    }
    expect(said.members).toBeGreaterThan(0);
    expect(section(text, "container")).toContain(`${said.members} members`);
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

    const { status, text } = await documentAt(browsing(providerSearch.browsable));

    expect(status).toBe(200);
    expect((await client.provider.held(asked)).items).toHaveLength(0);
    // AND THE PAGE SAYS SO, which is the same fact the owner reads.
    expect(section(text, "container")).toContain("Not in your catalogue");
  });
});

describe("/import, taking a Container and its ordering", () => {
  it("imports the container and the ordering it holds, in one operation", async () => {
    /*
     * ONE CALL RATHER THAN SIXTY, which is why `browse` exists at all (ADR-0033):
     * the container and its ordering arrive together, so a bulk import yields
     * placements instead of asking the owner to place every member by hand.
     *
     * THE OWNER NAMES THE CONTAINER, because nothing in CMPP hands one over --
     * `search` returns stories and `browse` takes a container's own id, so no
     * operation answers "which containers do you have". ADR-0033's as-built section
     * records that decision, and this form is it.
     *
     * THE MEMBER THIS WATCHES IS ONE THE CATALOGUE ALREADY HOLDS, and that is the
     * point: its Item exists before the browse and has no placement in this
     * container, so what arrives is the ORDERING rather than the item. An import
     * that wrote a second item for a member it already had would be CNCORE-28's
     * defect, and it would not satisfy this.
     */
    const at = browsing(providerSearch.browsable);
    const member = inject("attributed");
    const placedBefore = (await client.item.get({ id: member.id })).placements;

    const offered = await documentAt(at);
    expect(offered.status).toBe(200);
    const container = section(offered.text, "container");
    expect(itemLinkedIn(container)).toBeUndefined();

    const taken = await submit(baseUrl, at, formIn(container));

    expect(taken.status).toBe(200);
    // THE CONTAINER IS IN THE CATALOGUE, and reachable at the address given.
    const link = itemLinkedIn(section(taken.text, "container"));
    expect(link).toBeDefined();
    const arrived = await documentAt(link as string);
    expect(arrived.status).toBe(200);
    expect(arrived.text).toContain(providerSearch.browsable.container);

    // AND THE ORDERING CAME WITH IT: the member now sits in that container, at a
    // position, placed by the provider that asserted the ordering (ADR-0017).
    const placedAfter = (await client.item.get({ id: member.id })).placements;
    const containerId = (link as string).slice("/items/".length);
    expect(placedBefore.map(({ containerId: held }) => held)).not.toContain(containerId);
    const placement = placedAfter.find(({ containerId: held }) => held === containerId);
    expect(placement).toBeDefined();
    expect(placement?.position).toBeGreaterThan(0);
    expect(placement?.placedBy).toBe("provider");
  });
});

describe("reaching /import", () => {
  it("is linked from the catalogue, so the surface is reachable without typing a URL", async () => {
    // A SURFACE NOBODY CAN REACH IS NOT ONE. The ticket hangs this off the front
    // page (CNCORE-65), and an owner who has to know the address is in the position
    // this page exists to get them out of -- knowing an id, or in this case a path,
    // from somewhere outside the product.
    const { text } = await documentAt("/");

    const linked = [...text.matchAll(/href="(\/import)"/g)].map(([, href]) => href);
    expect(linked).not.toHaveLength(0);
    // AND IT IS A `Link`, WHICH IS A SEPARATE RULE (ADR-0109): raw `<a href>` is
    // not rewritten, so under a `basePath` this would point at nothing. Asserted
    // by the address arriving, which is the only part observable from here.
    expect((await documentAt("/import")).status).toBe(200);
  });

  it("is what a fresh install is told to do next, in the words that now work", async () => {
    // ADR-0094's other half: an install that starts empty WITHOUT SAYING WHAT TO DO
    // NEXT is a failure of its own. That copy used to say to give a provider's base
    // URL and the id of one of its records, which is exactly the hand-POSTing this
    // ticket removes -- so the step is now a link to the surface that searches.
    const { text } = await documentFrom(freshBaseUrl, "/");

    const next = text.match(/<section[^>]*aria-labelledby="what-to-do-next".*?<\/section>/)?.[0];
    if (!next) throw new Error("the fresh install's front page says nothing about what to do next");
    expect(next).toContain('href="/import"');
  });
});

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

    const { status, text } = await documentAt(at);

    expect(status).toBe(200);
    const said = await whatTheProviderSays({
      provider: providerSearch.browsable.provider,
      container: "a container this provider does not hold",
    });
    expect(said.answer).toBe("no-such-container");
    const container = section(text, "container");
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
    const named = { provider: providerSearch.declinesBrowse, container: "any container at all" };
    const at = browsing(named);

    const { status, text } = await documentAt(at);

    expect(status).toBe(200);
    const said = await whatTheProviderSays(named);
    if (said.answer !== "browse-not-offered") {
      throw new Error(`the witness provider answered ${said.answer}`);
    }
    const container = section(text, "container");
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

    const { status, text } = await documentAt(at);

    expect(status).toBe(200);
    const said = await whatTheProviderSays(named);
    if (said.answer !== "unreachable") {
      throw new Error(`the unreachable provider answered ${said.answer}`);
    }
    const container = section(text, "container");
    // NOT "could not be reached", WHICH WOULD BE FALSE OF A THIRD CASE THIS
    // BRANCH ALSO CARRIES: a provider that answered, badly. This URL really is
    // unreachable, so either sentence would pass here -- what is asserted is the
    // one the page has to be able to say about all three.
    expect(container.toLowerCase()).toContain("nothing could be learned about that id");
    expect(container).toContain(said.reason);
    // AND NOT EITHER OF THE OTHER TWO, which is what distinguishing them means.
    expect(container.toLowerCase()).not.toContain("no container at that id");
    expect(container.toLowerCase()).not.toContain("does not offer browse");
    expect(postFormsIn(container)).toHaveLength(0);
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

    const { status, text } = await documentAt(browsing(named));

    expect(status).toBe(200);
    const container = section(text, "container");
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
      expect(() => section(text, "container")).toThrow();
      expect(section(text, "not-configured")).toContain("PROVIDER_URLS");
    }
  });
});
