import { describe, expect, inject, it } from "vitest";

import { documentAt, documentFrom, logInAt } from "./document";

/**
 * THE FRONT PAGE, over real HTTP. ADR-0103's fourth seam, which is the one
 * CNCORE-65 names: a page-over-HTTP assertion and no browser, because
 * everything this page renders is in the HTML the server returns.
 */
const itemId = inject("itemId");
const itemTitle = inject("itemTitle");
/**
 * THE SECOND SERVER: the same build, an empty database, and no
 * an empty allowlist. That is what a stranger's first run of CanonCore
 * actually is (ADR-0094), and neither state exists on the seeded instance
 * above -- so without it the two criteria below could only be asserted a layer
 * down from the page that has to satisfy them.
 */
const freshBaseUrl = inject("freshBaseUrl");
/**
 * THE THIRD SERVER: an empty catalogue on an instance that HAS an allowlist.
 *
 * EMPTY WITHOUT BEING UNCONFIGURED, which the one above cannot be. ADR-0094
 * closes on these being two facts with different remedies, and every other
 * instance in this suite holds them together -- so the criterion that the
 * hand-built route is offered "whether or not one is allowlisted" had only its
 * `or not` half anywhere it could be read.
 */
const allowlistedBaseUrl = inject("allowlistedBaseUrl");

/** One `<section>` of a page, by the heading it is labelled with. */
function section(text: string, label: string): string {
  const found = text.match(new RegExp(`<section[^>]*aria-labelledby="${label}".*?</section>`))?.[0];
  if (!found) throw new Error(`the page rendered no \`${label}\` section`);
  return found;
}

/**
 * THE ROUTES OUT OF AN EMPTY CATALOGUE, one string each, in the order the page
 * offers them.
 *
 * ONE LIST ITEM IS ONE ROUTE, and that is the whole reason this reads `<li>`
 * rather than searching the section for a link. CNCORE-131's criterion is that
 * building a catalogue by hand is "a route of its own, not a footnote to
 * importing" -- and a section CONTAINING `/new` anywhere satisfies a test that
 * only greps the section, including the version of this page where the words
 * were a final sentence hanging off the import step. Splitting first is what
 * lets an assertion say WHICH route a link is in.
 */
function routesOutOf(text: string): string[] {
  return [...section(text, "what-to-do-next").matchAll(/<li[^>]*>(.*?)<\/li>/g)].map(
    ([, inner]) => inner as string,
  );
}

/**
 * THE ONE ROUTE THAT LEADS TO AN ADDRESS, or a failure naming what was found.
 *
 * EXACTLY ONE IS THE CLAIM, which is why it is checked here rather than left to
 * each caller: two routes offering `/new` would be the footnote this ticket
 * removed, growing back as a second bullet.
 *
 * A NESTED LIST WOULD BE CAUGHT RATHER THAN MISREAD. `routesOutOf` splits on
 * `<li>` without the `s` flag, so a route containing a list of its own would
 * split into three where the caller counts two -- and `toHaveLength(2)` below
 * fails on that rather than quietly comparing the wrong strings.
 */
function theRouteLinking(text: string, href: string): string {
  const found = routesOutOf(text).filter((route) => route.includes(`href="${href}"`));
  if (found.length !== 1) {
    throw new Error(`the empty catalogue offered ${found.length} routes to ${href}, not one`);
  }
  return found[0] as string;
}

describe("/", () => {
  it("shows the catalogue", async () => {
    const { status, text } = await documentAt("/");

    expect(status).toBe(200);
    expect(text).toContain(itemTitle);
  });

  it("carries the product's own name, not the scaffold's placeholder", async () => {
    // ADR-0058 settles the name and ADR-0053 says to own the generator's output
    // rather than keep it. `create-better-t-stack` left `title: "canoncore"` in
    // the layout and an ASCII banner on this page; a tab reading `canoncore`
    // beside a heading reading CanonCore is the scaffold showing through.
    const { text } = await documentAt("/");

    expect(text).toContain("<title>CanonCore</title>");
    // The banner the generator ships, and the health-check panel under it.
    //
    // THE BANNER IS MATCHED BY ITS BOX-DRAWING BYTES rather than by the words
    // it spells. It spelled BETTER T STACK in block capitals assembled from
    // `█` and `╗`, so the string "BETTER T STACK" appears nowhere in the HTML
    // it produced -- an assertion looking for it passes against the scaffold
    // itself, which is what the first version of this line did. Checked:
    // `git show main:apps/web/src/app/page.tsx | grep -c "BETTER T STACK"`
    // answers 0, and the same command for `██████╗` answers 5.
    expect(text).not.toContain("██████╗");
    expect(text).not.toContain("API Status");
  });

  it("reaches an item at the address every other surface reaches it at", async () => {
    // THE PATH IS IDENTITY (ADR-0066), so the front page's link has to BE the
    // item's canonical address rather than a second spelling of it -- no
    // `?via=`, which names the ORDERING a reader arrived through and would be a
    // claim this page cannot make: nobody arrives at an item through the
    // catalogue in the sense a placement means.
    //
    // CHECKED AGAINST WHAT THE ITEM PAGE ITSELF DECLARES rather than against a
    // string written here. A constant in this file would agree with a front page
    // and an item page that had BOTH drifted; the page's own `rel=canonical` is
    // the other surface's answer to the same question.
    const { text } = await documentAt("/");
    const linked = [...text.matchAll(/href="(\/items\/[^"?]*)"/g)]
      .map(([, href]) => href)
      .find((href) => href?.endsWith(itemId));
    if (!linked) throw new Error(`the front page linked nothing at /items/${itemId}`);

    const arrived = await documentAt(linked);

    expect(arrived.status).toBe(200);
    expect(arrived.text).toContain(`<link rel="canonical" href="${linked}"/>`);
    expect(arrived.text).toContain(`<h1 class="text-3xl font-medium">${itemTitle}</h1>`);
  });
});

/**
 * THE OWNER OF AN EMPTY CATALOGUE, which since CNCORE-133 is the only reader
 * the routes out of one are offered to.
 *
 * IT IS THE ALLOWLISTED INSTANCE THAT CARRIES THE OWNER, AND THE SWAP IS FORCED
 * RATHER THAN CHOSEN. These criteria were asserted on the fresh install until
 * this ticket, and that instance's whole fixture is that nobody can log in to
 * it (ADR-0044) -- so it is the one empty instance here that can never show an
 * owner anything. `anInstanceAllowlistedAndEmpty` says what the move costs and
 * why no twelfth server was stood up to recover it.
 */
const ownerOfTheEmptyOne = await logInAt(allowlistedBaseUrl, inject("ownerPassword"));

describe("/ on an empty catalogue, to its owner", () => {
  it("offers building a catalogue by hand as a route of its own", async () => {
    // ADR-0094 ships no catalogue to a stranger and is explicit that this is
    // only half the decision: "an install that starts empty WITHOUT SAYING WHAT
    // TO DO NEXT is a separate failure this record does not licence". Two
    // shards of the competitor sweep rated that first run HIGH. This is it
    // closed -- words on a page, not rows in a database.
    //
    // AND IT USED TO SAY TWO STEPS, BOTH OF THEM A PROVIDER'S (CNCORE-131).
    // Allowlist one, then import from it -- which was the whole answer until
    // v0.2.0 and is not one any more: `/new` fills a catalogue with no provider
    // running, nothing allowlisted and nothing reached. A reader whose instance
    // reaches nothing was being sent to find something for it to reach.
    //
    // A ROUTE OF ITS OWN, WHICH IS WHY THE ASSERTION SPLITS THE LIST FIRST. The
    // hand route is its own list item and the provider's is another, so a
    // sentence about `/new` tacked onto the end of the import step fails this
    // rather than passing it on the strength of the link being somewhere in the
    // section.
    //
    // AND IT IS OFFERED WHERE A PROVIDER *IS* ALLOWLISTED, which is the half
    // CNCORE-131 stood this instance up for: an empty state quietly gated on
    // `!providers.any` -- shown only where nothing is reachable, on the
    // reasoning that an owner who configured a provider wants the import route
    // -- fails here and passes everywhere else. The OTHER half, an owner with
    // nothing allowlisted, lost its witness when the routes became the owner's:
    // the only empty instance with no allowlist is the one with no password,
    // and ADR-0104 refuses a twelfth server to recover it.
    const { status, text } = await documentFrom(allowlistedBaseUrl, "/", ownerOfTheEmptyOne);

    expect(status).toBe(200);
    const byHand = theRouteLinking(text, "/new");
    // AND IT ASKS FOR NO PROVIDER, which is the half that makes it a SECOND
    // route rather than a restatement of the first: a route that sent the
    // reader to Settings on the way would be the provider route again.
    expect(byHand).not.toContain('href="/settings"');
    expect(byHand).not.toContain('href="/import"');
  });

  it("keeps the provider route, and names the two settings it needs", async () => {
    // THE ROUTE IS NOT REPLACED BY THE ONE ABOVE (CNCORE-131). Importing is
    // still how a catalogue gets a provider's claims into it, and an empty
    // state that dropped the step would trade one missing half for another.
    //
    // TWO ROUTES AND NOT THREE. Naming a provider and importing from it are two
    // STEPS OF ONE ROUTE rather than two routes of their own: an owner who does
    // the first and stops has filled nothing, which is exactly what "route"
    // claims and "step" does not.
    //
    // BOTH SETTINGS BY NAME, which is the criterion and is why this asserts two
    // words rather than one link. They are not derivable from each other
    // (ADR-0121): Providers holds URLS and says what IS reached, the Allowlist
    // holds HOSTS AND RANGES and says what MAY be, and a provider needs to be in
    // both -- so a step naming only one leaves an owner with a provider that is
    // never reached and no way to tell why. The names are the ones `/settings`
    // gives its own sections, because a page sending a reader somewhere owes
    // them the words they will find when they arrive. They were the environment
    // variables `PROVIDER_URLS` and `PROVIDER_ALLOWLIST` until CNCORE-99 and are
    // rows now, so naming the variables here would name two things that no
    // longer exist.
    const { text } = await documentFrom(allowlistedBaseUrl, "/", ownerOfTheEmptyOne);

    expect(routesOutOf(text)).toHaveLength(2);
    const fromAProvider = theRouteLinking(text, "/import");
    expect(fromAProvider).toContain('href="/settings"');
    expect(fromAProvider).toContain("Providers");
    expect(fromAProvider).toContain("Allowlist");
  });
});

/**
 * THE READER THE EMPTY STATE IS NOT ADDRESSED TO (CNCORE-133).
 *
 * BOTH ROUTES ARE THE OWNER'S AND NEITHER SAID SO: `/new` answers a visitor
 * "Only the owner of this catalogue can add to it", and `/import` renders its
 * surface with every button disabled. So the page was telling a reader to do
 * two things the next page would refuse them, which is what this describe holds
 * it out of.
 *
 * TWO INSTANCES, BECAUSE THE ANSWER TURNS ON A SECOND FACT. Where an
 * `OWNER_PASSWORD` is set the reader may BE the owner and simply not be logged
 * in, so the route they can take is the login; where none is set nobody can log
 * in at all (ADR-0044), and offering one would be the door with no key cut for
 * it that `/login` itself refuses to render.
 */
describe("/ on an empty catalogue, to a reader who is not its owner", () => {
  it("offers the login rather than the routes waiting behind it", async () => {
    // THE INSTANCE MOST PEOPLE RUN: a password is set, and this reader has not
    // used it. Nothing here can tell them from a stranger, and nothing needs
    // to -- both want the same next step, and it is the one the README names
    // first: "the first thing to do ... is log in with the one you just
    // generated".
    const { status, text } = await documentFrom(allowlistedBaseUrl, "/");

    expect(status).toBe(200);
    expect(routesOutOf(text)).toHaveLength(0);
    expect(section(text, "what-to-do-next")).toContain('href="/login"');
  });

  it("still says the emptiness is on purpose, which is the half that is theirs", async () => {
    // ADR-0094's other half is not the owner's alone: "an install that starts
    // empty WITHOUT SAYING WHAT TO DO NEXT is a separate failure". A reader who
    // cannot fill a catalogue can still tell a product that ships none from one
    // that is broken, and this sentence is what tells them.
    const { text } = await documentFrom(allowlistedBaseUrl, "/");

    expect(section(text, "what-to-do-next")).toContain("ships no catalogue");
  });

  it("offers no route at all where nobody can log in", async () => {
    // ADR-0044's read-only instance, which sets no `OWNER_PASSWORD`: every
    // password is refused, so nobody obtains a session INCLUDING the owner. A
    // route offered here is one nobody on earth can follow, and a login offered
    // here is worse than none -- `/login` renders no form on this instance for
    // exactly that reason.
    const { status, text } = await documentFrom(freshBaseUrl, "/");

    expect(status).toBe(200);
    expect(routesOutOf(text)).toHaveLength(0);
    const empty = section(text, "what-to-do-next");
    expect(empty).not.toContain('href="/login"');
    // AND IT SAYS WHICH OF THE TWO SILENCES THIS IS, in the words `/login`
    // uses for the same fact, rather than leaving a reader to wonder whether
    // they are missing a button.
    expect(empty.toLowerCase()).toContain("no password");
  });
});

describe("/ on a fresh install", () => {
  it("says no provider is allowlisted, where one is not", async () => {
    // ADR-0034's allowlist is empty by default and refuses every provider, so
    // an unconfigured instance and a broken one look identical from a page.
    const fresh = await documentFrom(freshBaseUrl, "/");

    // THE COPY, NOT MERELY THE SECTION. The criterion is that the page SAYS
    // so, and an empty `<section aria-labelledby="no-provider">` satisfies a
    // test that only asks whether the element is there. What an owner needs is
    // the way to the setting they have to go and change.
    const notice = section(fresh.text, "no-provider");
    expect(notice).toContain("/settings");
    expect(notice.toLowerCase()).toContain("no provider is allowlisted");
  });

  it("does not say it where a provider IS allowlisted", async () => {
    // The other half, and the half that makes the one above a test: a page that
    // printed the notice unconditionally would pass that one and fail this.
    const seeded = await documentAt("/");

    expect(() => section(seeded.text, "no-provider")).toThrow();
  });
});

describe("/ on a catalogue larger than one page", () => {
  /** Every item one rendered page links at, in the order it links them. */
  function itemsLinkedFrom(text: string): string[] {
    return [...text.matchAll(/href="\/items\/([^"?]+)"/g)].map(([, id]) => id as string);
  }

  /** Where the page says the catalogue carries on, if it says so at all. */
  function carriesOnAt(text: string): string | undefined {
    return text.match(/href="(\/\?after=[^"]+)"/)?.[1];
  }

  it("reaches every item by following links, and lands on none of them twice", async () => {
    // THE TICKET'S THREE CRITERIA, all at the one seam it names: every item
    // reachable from `/` by following links however many there are, no item
    // twice and none skipped, over real HTTP against a catalogue larger than
    // one page.
    //
    // THE ORACLE IS THE FIXTURE'S OWN LIST -- the ids the harness wrote -- and
    // not a second reading of the catalogue. Asking the API to say what should
    // have been walked would be asking the mechanism under test to mark its own
    // work: a cursor that loses the untitled tail would lose it from both
    // sides and the two would agree.
    const everyItem = inject("pagedCatalogue");
    const walked: string[] = [];
    let path: string | undefined = "/";
    // BOUNDED, so a cursor that does not advance FAILS rather than hangs.
    for (let pages = 0; pages <= everyItem.length; pages += 1) {
      const { status, text } = await documentFrom(inject("pagedBaseUrl"), path);
      expect(status).toBe(200);
      walked.push(...itemsLinkedFrom(text));
      path = carriesOnAt(text);
      if (path === undefined) {
        expect([...walked].sort()).toStrictEqual([...everyItem].sort());
        // SORTED SETS COMPARE EQUAL EVEN WITH A REPEAT IN THEM, so the one
        // criterion the comparison above cannot see gets its own line.
        expect(new Set(walked).size).toBe(walked.length);
        return;
      }
    }
    throw new Error(`the walk never ended: ${walked.length} of ${everyItem.length} items`);
  });

  it("offers a way back to the start from every page but the first", async () => {
    // A FORWARD WALK STRANDS A DEEP LINK. Browser history is the reverse of a
    // walk somebody took; it is no use to a reader handed page two in a
    // message, and `Previous` is a second query shape rather than half of this
    // one (ADR-0119). So every page past the first carries the one address that
    // is always somewhere.
    const pagedBaseUrl = inject("pagedBaseUrl");
    const first = await documentFrom(pagedBaseUrl, "/");
    const next = carriesOnAt(first.text);
    if (next === undefined) throw new Error("the fixture fits on one page");

    const second = await documentFrom(pagedBaseUrl, next);

    expect(second.text).toContain("Back to the start");
    // AND NOT ON THE FIRST PAGE, which is the half that makes the line above a
    // test: a page printing it unconditionally would satisfy that and fail this.
    expect(first.text).not.toContain("Back to the start");
    // AN EMPTY `after` NAMES NO PLACE, exactly as a repeated one does not
    // (ADR-0066). `/?after=` is the start of the catalogue, so it must not
    // offer to send a reader back to where they already are.
    const empty = await documentFrom(pagedBaseUrl, "/?after=");
    expect(empty.text).not.toContain("Back to the start");
  });

  it("says the catalogue ends here, where a link outlived the items after it", async () => {
    // THE ONE DEAD END A CURSOR CREATES. `continuesAfter` is only handed over
    // when there is a row past the page, so a link FOLLOWED never lands here --
    // but a link KEPT can, once the items after the one it was cut at are gone.
    // Without this the reader gets a heading and an empty list.
    const pagedBaseUrl = inject("pagedBaseUrl");
    let text = (await documentFrom(pagedBaseUrl, "/")).text;
    for (let pages = 0; pages < 10; pages += 1) {
      const next = carriesOnAt(text);
      if (next === undefined) break;
      text = (await documentFrom(pagedBaseUrl, next)).text;
    }
    const last = itemsLinkedFrom(text).at(-1);

    const beyond = await documentFrom(pagedBaseUrl, `/?after=${last}`);

    expect(beyond.status).toBe(200);
    // THE WAY OUT, not merely the notice. A page that said the catalogue ended
    // and offered nothing to click is the same dead end with a caption on it.
    expect(section(beyond.text, "past-the-end")).toContain('href="/"');
  });

  it("still shows one page at a time, and says how much it is not showing", async () => {
    // THE CAP, WHICH PAGING DOES NOT LIFT. The other half was already built --
    // a listing that says what it is not showing -- and this is the state it
    // was built for and has never been asserted in: every catalogue in this
    // suite until now arrived whole on the first page, so "Showing 100 of 254"
    // and "254 items" were the same sentence.
    const everyItem = inject("pagedCatalogue");

    const { text } = await documentFrom(inject("pagedBaseUrl"), "/");

    expect(itemsLinkedFrom(text)).toHaveLength(100);
    expect(text).toContain(
      `<p class="text-muted-foreground text-sm">Showing 100 of ${everyItem.length} items</p>`,
    );
  });
});

describe("/ on a catalogue nothing is writing to", () => {
  it("says how much the catalogue holds", async () => {
    /*
     * NO SILENT CAP. The listing is capped at a page, so a page that reported
     * only what it had listed would tell an owner their library is smaller than
     * it is -- the one thing a catalogue must not get wrong about itself.
     *
     * WHAT THIS PROVES IS THE NUMBER, NOT THE CAP. This catalogue holds fewer
     * items than a page, so "how many there are" and "how many are listed" are
     * the same number here and no assertion made against it can tell them apart.
     * THE CAP IS PROVED ABOVE, on the paged instance, where the two numbers
     * differ: "Showing 100 of 254 items" is the same sentence with the total
     * disagreeing with the count. What only THIS instance can prove is
     * `Holding`'s OTHER arm, the one a catalogue smaller than a page renders.
     *
     * ON AN INSTANCE OF ITS OWN, WHICH IS THE WHOLE POINT OF IT (CNCORE-93).
     * This used to be asserted against the seeded server, whose catalogue two
     * other files import into from their own workers -- so it read a total,
     * fetched a page, and compared two numbers taken at two moments from shared
     * mutable state. Measured in CI on 2026-09-12: the page reported 59 items
     * against a total read as 58, and a re-run of the same commit passed. That
     * was not flaky, it was wrong; the assertion was not entitled to pass on the
     * runs where it did.
     *
     * AND THE NUMBER COMES FROM THE FIXTURE, not from asking the router what it
     * thinks. The page reads its total by calling that same procedure, so the
     * two agreeing was one code path agreeing with itself -- worth accepting
     * when nothing here could know the number, and not worth keeping now that
     * the fixture does.
     */
    const everyItem = inject("stillCatalogue");

    const { status, text } = await documentFrom(inject("stillBaseUrl"), "/");

    expect(status).toBe(200);
    // THE WHOLE ELEMENT, not a substring of it. ``toContain(`${n} items`)`` is
    // also satisfied by "Showing 3 of 42 items", so it could not tell the two
    // arms apart even in a catalogue large enough to have both.
    expect(text).toContain(
      `<p class="text-muted-foreground text-sm">${everyItem.length} items</p>`,
    );
  });
});
