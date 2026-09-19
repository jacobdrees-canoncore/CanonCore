import { describe, expect, inject, it } from "vitest";

import { documentAt, documentFrom, headingOf, sectionIn, sourcesIn } from "./document";

/**
 * The app over real HTTP: a production build of Next, serving a real database.
 *
 * This is the test CNCORE-4's acceptance criterion asks for, and the only one
 * in the repo that would fail if the page, the router, the projection, the
 * migration or the Next build were broken. Everything else passes with the app
 * never having been served.
 */
const itemId = inject("itemId");
const itemTitle = inject("itemTitle");
const placements = inject("placements");
const twoOrigins = inject("twoOrigins");
const imported = inject("imported");
const browsed = inject("browsed");
const attributed = inject("attributed");
const twoInstances = inject("twoInstances");
const timeSpan = inject("timeSpan");
/**
 * THE SAME FIXTURE `container-page.test.ts` READS THE OTHER END OF. Its
 * disagreement and its corroboration are seeded once and rendered twice -- the
 * Members list in position order, "Also appears in" with rank leading -- so the
 * two ends cannot come to be seeded apart and agree by accident.
 */
const workBrowsing = inject("workBrowsing");

/**
 * The rows of the "Also appears in" list, one string each, so an assertion can
 * ask WHICH row carries a marker rather than only whether the page does.
 */
function orderingRows(text: string): string[] {
  // Scoped to the section rather than the document. Matching every `<li>` on
  // the page would make "narrows the list to one" depend on nothing else ever
  // rendering a list, which is a promise no page keeps for long.
  return sectionIn(text, "also-appears-in").match(/<li[^>]*>.*?<\/li>/g) ?? [];
}

describe("/items/<id>", () => {
  it("returns 200 and renders the item's title", async () => {
    const { status, text } = await documentAt(`/items/${itemId}`);

    expect(status).toBe(200);
    // The title was written as a STATEMENT and never into the column, so seeing
    // it here means the projection ran (ADR-0014).
    expect(headingOf(text)).toBe(itemTitle);
  });

  it("puts the title in the document title too", async () => {
    const { text } = await documentAt(`/items/${itemId}`);

    expect(text).toContain(`<title>${itemTitle}</title>`);
  });

  it("answers about the item the PATH names, whatever the query calls itself", async () => {
    /*
     * ADR-0066: the path is identity and the query is the route. `?id=` is not a
     * parameter this route has, so it names nothing and the page is the page at
     * this path -- heading and document title alike.
     *
     * IT IS ASSERTED BECAUSE CNCORE-176 MADE IT REACHABLE. `generateMetadata`
     * reads `searchParams` now, to ask the read path the same question the page
     * asks, and the first spelling of that spread the route param INTO the query
     * -- so `/items/A?id=B` would have titled A's page after B and pointed its
     * canonical at B, while the body went on describing A. Two answers to "which
     * item is this" in one document.
     */
    const { status, text } = await documentAt(`/items/${itemId}?id=${twoOrigins.id}`);

    expect(status).toBe(200);
    expect(headingOf(text)).toBe(itemTitle);
    expect(text).toContain(`<title>${itemTitle}</title>`);
    // AND THE CANONICAL NAMES THE PATH'S ITEM TOO, which is the half a reader
    // never sees and a crawler acts on.
    expect(text).toContain(`href="/items/${itemId}"`);
  });

  it("answers 404 for an id nothing resolves to", async () => {
    const { status } = await documentAt(`/items/${crypto.randomUUID()}`);

    expect(status).toBe(404);
  });

  // CNCORE-14. The path is identity (ADR-0066), so a string that cannot BE an
  // identity addresses nothing and gets the same answer as an id nobody minted.
  // A reader cannot tell a truncated link from an unknown item, because neither
  // of them names anything.
  //
  // 500 is what these used to answer, and it is the wrong story twice over: it
  // tells a reader with a typo that the server is broken, and it puts a stack
  // trace in the log for something that is not an error.
  //
  // One case each rather than a loop inside one `it`, so a regression names the
  // shape that broke instead of stopping at the first and hiding the rest.
  it.each([
    ["a word, not an id", "not-a-uuid"],
    ["a truncated copy-paste", "f25a553c-a2bc-466f-ab55"],
    ["one character too many", "f25a553c-a2bc-466f-ab55-06cca03ba693x"],
    ["a client that stringified a missing value", "undefined"],
    ["an encoded space", "%20"],
  ])("answers 404 rather than 500 for %s", async (_shape, malformed) => {
    const { status } = await documentAt(`/items/${malformed}`);

    expect(status).toBe(404);
  });
});

describe("the kind, in the reader's words", () => {
  /**
   * CNCORE-83. `CONTEXT.md` is binding on UI copy and calls this a Time span,
   * so a page printing `time_span` is showing a reader the schema. The words
   * come from `item_kinds`, which migration 1 seeds a label into beside every
   * kind -- so this asserts a READ rather than a map the app would have to be
   * kept in step with.
   */
  it("says Time span where the column says time_span", async () => {
    const { status, text } = await documentAt(`/items/${timeSpan.id}`);

    expect(status).toBe(200);
    // THE WORDS ARE WRITTEN HERE rather than handed over by the fixture, so
    // they can be checked against the source they come from: `CONTEXT.md`'s
    // entity kinds, which is the glossary UI copy is bound to.
    expect(text).toContain("<dd>Time span</dd>");
  });

  /**
   * AND THE KEY IS NOWHERE IN THE DOCUMENT, which is a stronger claim than the
   * cell above and deliberately so: the page ships its own props to the browser
   * in the flight payload, so a version that rendered the label while still
   * carrying the column alongside it would satisfy the first assertion and hand
   * the schema to every reader anyway.
   */
  it("does not carry the column anywhere in what a reader is served", async () => {
    const { text } = await documentAt(`/items/${timeSpan.id}`);

    // GUARDED, because the negative below is satisfied by a 404 as well as by a
    // page that gets it right.
    expect(text).toContain(timeSpan.title);
    // THE KEY THE FIXTURE ACTUALLY SEEDED, which is a fact about the fixture
    // and so comes from it -- unlike the words above.
    expect(text).not.toContain(timeSpan.kind);
  });
});

describe("also appears in", () => {
  it("lists every ordering the item sits in, with its position in each", async () => {
    // THE SLICE ANYONE CAN LOOK AT AND SEE THE PRODUCT (ADR-0009): one item,
    // two orderings, two positions, both true at once. The position lives on
    // the placement, so neither ordering can disturb the other (ADR-0018).
    const { text } = await documentAt(`/items/${itemId}`);

    expect(placements).toHaveLength(2);
    for (const placement of placements) {
      expect(text).toContain(placement.containerTitle);
      expect(text).toContain(`#${placement.position}`);
    }
  });

  it("tells a repeat from two sources disagreeing, by naming who asserted each row", async () => {
    // THE CRITERION, where a reader meets it -- CNCORE-121, and the mirror of
    // the assertion `container-page.test.ts` makes over the Members list. Both
    // pages show ONE CONTAINER twice at two positions: the recap because one
    // source placed it twice on purpose (ADR-0009), and the disputed ordering
    // because two sources claim different positions for one membership
    // (ADR-0017). Nothing STORED separates them, and `placedBy` cannot -- both
    // rows of both pages read "Imported", these being two providers. The only
    // thing that can is the name beside each row.
    //
    // BOTH PAGES IN ONE TEST, because the criterion is a DIFFERENCE. Either
    // alone passes against a list printing the same name on every row.
    const repeat = await documentAt(`/items/${workBrowsing.repeatedId}`);
    const disagreement = await documentAt(`/items/${workBrowsing.arguedId}`);

    const repeated = orderingRows(repeat.text);
    expect(repeated).toHaveLength(2);
    // Counted rather than matched, for the reason the Members list gives.
    expect(repeated.map((row) => sourcesIn(row))).toStrictEqual([
      [workBrowsing.repeatedBy],
      [workBrowsing.repeatedBy],
    ]);

    const argued = orderingRows(disagreement.text);
    expect(argued).toHaveLength(2);
    // AND THE SPOKESMAN'S TERMS STILL LEAD (ADR-0017), which is where this end
    // differs from the container's. Both sources sit at the default rank --
    // nothing in the product sets one -- so it is the one global source order
    // (ADR-0025) that separates them, the wiki sits ahead of the broadcaster in
    // it, and it is the wiki that claims #3. The winning claim is therefore the
    // row a reader meets first: the OPPOSITE of the #1-then-#3 the Members list
    // renders, and naming the sources must not disturb it.
    expect(argued.map((row) => sourcesIn(row))).toStrictEqual([
      [workBrowsing.arguedBy[1]],
      [workBrowsing.arguedBy[0]],
    ]);
    expect(argued[0]).toContain("#3");
    expect(argued[1]).toContain("#1");
  });

  it("shows two sources agreeing as two names on one row", async () => {
    // ADR-0017'S NAMED GAP, closed from the end it was still open at: "a
    // placement two providers corroborate and a placement one provider asserts
    // are indistinguishable to every reader". Sources agreeing land on ONE
    // placement row carrying a source each, so corroboration is only ever
    // visible if the row names them both.
    const { text } = await documentAt(`/items/${workBrowsing.agreedOnId}`);

    const rows = orderingRows(text);
    // ONE ROW, NOT TWO. Agreement is corroboration rather than a second claim,
    // so rendering it twice would show the reader a disagreement the catalogue
    // does not hold.
    expect(rows).toHaveLength(1);
    // AND TWO NAMES ON IT, counted and in the spokesman's order, for the reason
    // the Members list gives (CNCORE-128).
    expect(sourcesIn(rows[0] ?? "")).toStrictEqual([
      workBrowsing.arguedBy[1],
      workBrowsing.arguedBy[0],
    ]);
  });

  it("reads a source whose own name carries a comma as ONE source", async () => {
    // CNCORE-128 FROM THE ITEM'S END, over the same seeded source the Members
    // list reads from the container's.
    //
    // ASSERTED AT BOTH ENDS RATHER THAN ONLY AT ONE, because `AssertedBy` is one
    // component for both lists since CNCORE-121: the whole point of sharing it
    // is that the two cannot drift, and nothing holds them together unless both
    // are read.
    const { text } = await documentAt(`/items/${workBrowsing.singlySourcedId}`);

    const rows = orderingRows(text);
    expect(rows).toHaveLength(1);
    expect(sourcesIn(rows[0] ?? "")).toStrictEqual([workBrowsing.singlySourcedBy]);
  });

  it("goes on filtering by KIND, which is the question the chips ask", async () => {
    // ADR-0017 settles the filter's four words -- Hand-placed, Imported, From
    // the files, Rule-derived -- and they are KINDS. CNCORE-121 adds the names
    // BESIDE `placedBy` rather than in place of it, so the chip survives: both
    // of the disputed rows are a provider's, so "Imported" is offered and
    // narrowing to it keeps both.
    const { text } = await documentAt(`/items/${workBrowsing.arguedId}?placed=provider`);

    expect(orderingRows(text)).toHaveLength(2);
    expect(sectionIn(text, "also-appears-in")).toContain("Imported");
  });
});

describe("the path is identity, the query is the route", () => {
  it("declares the bare path canonical, on both forms of the URL", async () => {
    // ADR-0066. A declaration that lives only in a ticket is invisible to every
    // crawler, cache and consumer; RFC 6596 is the mechanism for making it
    // visible, and it explicitly permits both properties used here -- the
    // target IRI MAY "specify a relative IRI" and MAY "be self-referential".
    //
    // RELATIVE because this is self-hosted software that does not know its own
    // origin: there is no build-time hostname to write, and inventing a setting
    // for one would be a config option nothing else reads.
    const canonical = `<link rel="canonical" href="/items/${itemId}"/>`;

    const bare = await documentAt(`/items/${itemId}`);
    const viaAnOrdering = await documentAt(`/items/${itemId}?via=${placements[0]?.id}`);

    expect(bare.text).toContain(canonical);
    expect(viaAnOrdering.text).toContain(canonical);
  });

  it("gives one item and one page whichever way the reader arrived", async () => {
    // ADR-0066, the claim itself: two routes to one item are one page. What may
    // differ between them is the ROUTE -- which ordering the reader came in
    // through -- and nothing about the item itself.
    const bare = await documentAt(`/items/${itemId}`);
    const viaAnOrdering = await documentAt(`/items/${itemId}?via=${placements[0]?.id}`);

    expect(viaAnOrdering.status).toBe(bare.status);
    for (const { text } of [bare, viaAnOrdering]) {
      expect(headingOf(text)).toBe(itemTitle);
      for (const placement of placements) {
        expect(text).toContain(placement.containerTitle);
        expect(text).toContain(`#${placement.position}`);
      }
    }
  });

  it("ignores a `via` that names no ordering of this item, rather than breaking", async () => {
    // The query IDENTIFIES NOTHING, so a stale or foreign placement id cannot
    // change which item is served, and cannot 404 a page that exists. A reader
    // following an old link from a chat window gets the item.
    const { status, text } = await documentAt(`/items/${itemId}?via=${crypto.randomUUID()}`);

    expect(status).toBe(200);
    expect(headingOf(text)).toBe(itemTitle);
  });

  it("marks the ordering the reader arrived through, and only that one", async () => {
    // ADR-0066. The container is IN THE URL rather than in client memory, which
    // is Jellyfin's design: there a refresh loses the ordering and next-up
    // either stops working or silently switches, and "here, in story order" is
    // unshareable. The mark is what a reader sees of that.
    const [first, second] = placements;
    const { text } = await documentAt(`/items/${itemId}?via=${second?.id}`);

    const arrivedThrough = orderingRows(text).filter((row) => row.includes("Arrived through"));
    expect(arrivedThrough).toHaveLength(1);
    expect(arrivedThrough[0]).toContain(second?.containerTitle);
    expect(arrivedThrough[0]).not.toContain(first?.containerTitle);
  });

  it("marks nothing when the reader arrived at the bare path", async () => {
    const { text } = await documentAt(`/items/${itemId}`);

    expect(text).not.toContain("Arrived through");
  });
});

describe("one list, filtered", () => {
  it("keeps both origins in ONE list rather than splitting the layout", async () => {
    // A container the owner filled by hand and one a provider imported are the
    // same kind of fact, told apart by who asserted them (ADR-0017) and by
    // nothing else. Two sections would say they are two kinds of thing.
    const { text } = await documentAt(`/items/${twoOrigins.id}`);

    const section = sectionIn(text, "also-appears-in");
    expect(section.match(/<ul/g) ?? []).toHaveLength(1);
    expect(section).toContain(twoOrigins.byHand);
    expect(section).toContain(twoOrigins.imported);
  });

  it("offers a filter over the origins actually present, and no others", async () => {
    const { text } = await documentAt(`/items/${twoOrigins.id}`);

    const filter = sectionIn(text, "also-appears-in");
    expect(filter).toContain("Hand-placed");
    expect(filter).toContain("Imported");
    // The other two source kinds exist in the model (ADR-0071) and have placed
    // nothing here, so they are not offered. The filter is read off the data.
    expect(filter).not.toContain("From the files");
    expect(filter).not.toContain("Rule-derived");
  });

  it("narrows the list to one origin, and leaves the way back", async () => {
    const { status, text } = await documentAt(`/items/${twoOrigins.id}?placed=provider`);

    expect(status).toBe(200);
    const rows = orderingRows(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain(twoOrigins.imported);
    expect(text).toContain("All");
  });

  it("still declares the bare path canonical when a filter is on", async () => {
    // A second non-identifying parameter (ADR-0066), so the same declaration
    // has to hold: neither `?via=` nor `?placed=` identifies anything.
    const { text } = await documentAt(`/items/${twoOrigins.id}?placed=owner`);

    expect(text).toContain(`<link rel="canonical" href="/items/${twoOrigins.id}"/>`);
  });
});

/**
 * THE SLICE. One real story, imported from a provider over HTTP, rendered on
 * its page with the provider recorded as its source.
 *
 * The provider behind it is ADR-0057's fixture, answered by the stub in
 * `wiki-fixture.ts`. This comment used to say the real `provider-wiki` image
 * answered it in CI, chosen by `PROVIDER_WIKI_URL`; turbo filtered that
 * variable out of `test:e2e` so it never did, and CNCORE-143 took the wiki
 * image out of that job rather than leaving the claim standing -- it needs a
 * Credential no CI job holds (ADR-0122). The real image CI now runs this suite
 * against is `provider-tmdb`, which `attributed` and `providerSearch` reach.
 * The assertions still do not know which process answered, which is the point.
 */
describe("an item imported from a provider", () => {
  it("renders the title the provider gave it", async () => {
    const { status, text } = await documentAt(`/items/${imported.id}`);

    expect(status).toBe(200);
    expect(headingOf(text)).toBe(imported.title);
  });

  it("shows the provider as the source of every value it claimed", async () => {
    const { text } = await documentAt(`/items/${imported.id}`);

    const section = sectionIn(text, "values");
    // ADR-0073: the date keeps the precision the provider sent, so a page that
    // padded it to a full day would be inventing one.
    expect(section).toContain(imported.released);
    expect(section).toContain(imported.title);
    // Three times: the title, the release date, and the provider's own id for
    // the record (CNCORE-28). Every imported value carries the provider, not
    // just the first.
    expect(section.match(new RegExp(imported.providerLabel, "g")) ?? []).toHaveLength(3);
  });

  it("names the provider rather than the URL it happens to be on", async () => {
    // A source answers WHO said this. `provider-wiki` answers it; a loopback
    // URL with an ephemeral port is a deployment detail.
    const { text } = await documentAt(`/items/${imported.id}`);

    expect(sectionIn(text, "values")).toContain(imported.providerLabel);
    expect(sectionIn(text, "values")).not.toContain("127.0.0.1");
  });

  it("says the owner said it when the owner did", async () => {
    // The same list, for the hand-seeded demo item: the section is about
    // provenance rather than about imports, so it has to work for both.
    const { text } = await documentAt(`/items/${itemId}`);

    expect(sectionIn(text, "values")).toContain("Owner");
  });
});

/**
 * THE STOP CONDITION, and the thing the whole product is for: a REAL IMPORTED
 * item sitting in more than one ordering, on a page that says so.
 *
 * The story arrived through `browse` -- one call, a container and five stories
 * placed at once -- and the owner then put the same item into an ordering of
 * their own at a different position. Calibre put `series_index` on the book
 * with `UNIQUE(book)` and locked its users into one series per book forever
 * (ADR-0018); this page reads both, at once, without either disturbing the
 * other.
 */
describe("a browsed item in more than one ordering", () => {
  it("reads both orderings, each at its own position", async () => {
    const { status, text } = await documentAt(`/items/${browsed.inTwoOrderings}`);

    expect(status).toBe(200);
    expect(headingOf(text)).toBe(browsed.title);
    const section = sectionIn(text, "also-appears-in");
    expect(section).toContain(browsed.imported);
    expect(section).toContain(`#${browsed.importedPosition}`);
    expect(section).toContain(browsed.byHand);
    expect(section).toContain(`#${browsed.byHandPosition}`);
  });

  it("says which of them the provider asserted and which the owner did", async () => {
    // ADR-0017. An ordering is a DATED CLAIM BY A NAMED SOURCE rather than a
    // neutral fact, and this is where a reader meets that: the same story, in
    // two orderings, one of which a provider claims and one of which the owner
    // does.
    const { text } = await documentAt(`/items/${browsed.inTwoOrderings}`);

    const rows = orderingRows(text);
    const fromTheProvider = rows.filter((row) => row.includes(browsed.imported));
    const fromTheOwner = rows.filter((row) => row.includes(browsed.byHand));

    expect(fromTheProvider).toHaveLength(1);
    expect(fromTheProvider[0]).toContain("Imported");
    expect(fromTheOwner).toHaveLength(1);
    expect(fromTheOwner[0]).toContain("Hand-placed");
  });

  it("keeps them in ONE list with a filter, rather than splitting the layout", async () => {
    // The filter is read off the data, and this is the day the `Imported` chip
    // appears on a REAL import rather than on a fixture standing in for one.
    const { text } = await documentAt(`/items/${browsed.inTwoOrderings}`);

    const section = sectionIn(text, "also-appears-in");
    expect(section.match(/<ul/g) ?? []).toHaveLength(1);
    expect(section).toContain("Hand-placed");
    expect(section).toContain("Imported");
  });

  it("narrows to the imported ordering alone, and leaves the way back", async () => {
    const { status, text } = await documentAt(`/items/${browsed.inTwoOrderings}?placed=provider`);

    expect(status).toBe(200);
    const rows = orderingRows(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain(browsed.imported);
    expect(text).toContain("All");
  });
});

/**
 * CNCORE-28, ON THE PAGE. One story, imported twice by two different routes --
 * `lookup` by its own id, and then `browse` of a container that holds it -- and
 * ONE item at the end of it.
 *
 * This suite is where the defect was visible before: it did exactly this and got
 * TWO items for one story, each with its own placements, and nothing in the app
 * said so. `browse` is what made it urgent rather than a nuisance, because one
 * call imports a container and every member of it, so the catalogue doubled on
 * the second click of one button.
 */
describe("one record imported twice, by two routes", () => {
  it("is ONE item, so the looked-up story and the browsed one are one page", () => {
    // Both ids came back from the app's own API, through two real oRPC calls
    // over HTTP -- so this is the app answering, not the library.
    expect(browsed.inTwoOrderings).toBe(imported.id);
  });

  it("shows the provider's own id, sourced to the provider that claimed it", async () => {
    // ADR-0078: the surrogate id stays the identity and the provider's id sits
    // BESIDE it. It is a claimed value like any other, so a reader meets it in
    // the same list, with the same provenance attached.
    const { text } = await documentAt(`/items/${imported.id}`);

    const section = sectionIn(text, "values");
    expect(section).toContain("External id");
    expect(section).toContain(browsed.externalId);
  });

  it("places it once in the browsed ordering rather than twice", async () => {
    // A second import that wrote a second placement would show as a REPEAT --
    // the same container listed twice -- which is a real shape (ADR-0009) and
    // exactly what this must not invent.
    const { text } = await documentAt(`/items/${imported.id}`);

    const rows = orderingRows(text).filter((row) => row.includes(browsed.imported));
    expect(rows).toHaveLength(1);
  });
});

describe("a placement the ordering could not position", () => {
  /**
   * `browse` hands back members its ordering cannot place, and a member with no
   * position is still a member. Operation Dusk carries no release date, and the
   * archive's ordering for a category IS release order -- so the container holds
   * it and says nothing about where.
   *
   * Both other answers assert something the provider never did: dropping it
   * shrinks the container silently, and numbering it last says it came out
   * after everything else.
   */
  it("shows the container it belongs to, and says no position was given", async () => {
    const { status, text } = await documentAt(`/items/${browsed.unplaced}`);

    expect(status).toBe(200);
    const rows = orderingRows(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain(browsed.unplacedIn);
    expect(rows[0]).toContain("No position given");
    expect(rows[0]).toContain("Imported");
    // The model must not leak: `#null` is what a page prints when it assumes a
    // position is always a number.
    expect(rows[0]).not.toContain("#null");
  });
});

/**
 * ADR-0036, and the half of it a code review cannot see: the licence obligation
 * is discharged by what a READER IS SERVED, so this is the only suite in the repo
 * that can tell whether it is discharged at all.
 *
 * TMDB's API Terms paragraph 3 is three obligations, and each has an assertion
 * here: the notice verbatim and prominent, the mark shown, and the mark less
 * prominent than our own.
 */
describe("what the page owes for what it shows", () => {
  it("prints the provider's notice verbatim, in the HTML a reader is served", async () => {
    const { status, text } = await documentAt(`/items/${attributed.id}`);

    expect(status).toBe(200);
    // VERBATIM, character for character. Not a substring of it, and not a
    // normalised form: a paraphrased licence notice breaches the licence as
    // surely as a missing one, so the assertion is the whole sentence.
    expect(text).toContain(attributed.notice);
  });

  /**
   * IN THE SERVED HTML RATHER THAN FILLED IN AFTERWARDS, which is what
   * "prominently in or on Your Application" needs to mean for a page: a notice
   * that arrives only if a script runs is a notice some readers never get. The
   * assertion above already proves this by fetching rather than rendering, and
   * this one says WHY it is fetched rather than mounted.
   */
  it("shows the provider's mark, at the size the page claims it does", async () => {
    const { text } = await documentAt(`/items/${attributed.id}`);

    expect(text).toMatch(/<img[^>]+src="data:image\//);
    expect(text).toContain("does not endorse, certify or approve");
  });

  /**
   * THE COMPARISON, READ OUT OF THE BYTES rather than asserted in prose. TMDB's
   * terms: "Any use of any TMDB logos in Your Application must be less prominent
   * than the logos or marks that primarily describe or identify Your Application."
   *
   * Both numbers are emitted as explicit inline sizes for exactly this -- a
   * `text-xl` against an `h-4` is the same relationship written where nothing can
   * check it. This fails if either number moves the wrong way, and it fails
   * against the page a reader actually gets.
   */
  it("keeps the source's mark smaller than CanonCore's own", async () => {
    const { text } = await documentAt(`/items/${attributed.id}`);

    // THE SIZE IS READ OUT OF THE WORDMARK'S OWN TAG, not out of the document.
    // An earlier version took the first `font-size` anywhere in the HTML and only
    // checked separately that the string `CanonCore</a>` existed, so it passed by
    // layout luck: any other inline size appearing first would have been compared
    // instead. Found in review.
    const wordmarkTag = text.match(/<a\b[^>]*>CanonCore<\/a>/)?.[0];
    const ourMark = wordmarkTag?.match(/font-size:\s*(\d+)px/)?.[1];
    const sourceMark = text.match(/<img[^>]+src="data:image\/[^"]*"[^>]*height="(\d+)"/)?.[1];

    expect(wordmarkTag, "CanonCore's own wordmark is not on the page").toBeDefined();
    expect(ourMark, "the wordmark carries no explicit size to compare against").toBeDefined();
    expect(sourceMark, "the source's mark is not on the page").toBeDefined();
    expect(Number(sourceMark)).toBeLessThan(Number(ourMark));
  });

  /**
   * AND NOTHING IS OWED FOR A SOURCE THAT IMPOSES NOTHING. The wiki's archive
   * obliges no notice, so the item imported from it carries none -- which is the
   * branch that would silently stop mattering if the notice were rendered for
   * every source rather than for the ones that asked.
   */
  it("says nothing on a page whose sources oblige nothing", async () => {
    const { status, text } = await documentAt(`/items/${imported.id}`);

    // GUARDED FIRST, because every assertion below is a NEGATIVE one and a 404
    // would satisfy all of them. This page has to be a real rendered item before
    // "it carries no notice" means anything about the notice.
    expect(status).toBe(200);
    expect(text).toContain(imported.title);

    expect(text).not.toContain(attributed.notice);
    expect(text).not.toMatch(/<img[^>]+src="data:image\//);
  });

  /**
   * AND TWO SOURCES CALLING THEMSELVES THE SAME THING ARE TWO NOTICES
   * (CNCORE-130). A label is not an identity: `sources` is unique on
   * `(owner_id, kind, identity)` and nothing constrains the label, so two
   * instances of one provider are two obligations under one name.
   *
   * THIS IS THE HALF OF THAT TICKET A SEAM CAN SEE. The defect was the React key,
   * and a key is not serialised into HTML -- measured on 19.2.8, the server
   * renders both siblings and warns about neither -- so no assertion anywhere can
   * tell the old markup from the new. What IS observable is the obligation
   * itself: both notices reaching the page a reader is served, which is what
   * ADR-0036 requires and what a dedupe anywhere between the query and this list
   * would break.
   *
   * COUNTED OFF THE ROWS RATHER THAN THE NOTICE TEXT. The two notices are the
   * same sentence -- two instances of one provider declare one licence -- so
   * `toContain` cannot tell one from two, which is exactly the confusion the
   * defect lived in.
   */
  it("shows a notice for each of two sources that call themselves the same thing", async () => {
    const { status, text } = await documentAt(`/items/${twoInstances.id}`);

    expect(status).toBe(200);
    const notices = sectionIn(text, "attribution").match(/<li[^>]*>.*?<\/li>/g) ?? [];
    expect(notices).toHaveLength(2);
    for (const notice of notices) expect(notice).toContain(twoInstances.notice);
  });

  /**
   * AND THE ORDERINGS ABOVE THEM ARE STILL JUST THE ORDERINGS (CNCORE-135).
   *
   * THIS FIXTURE IS THE FIRST THAT IS BOTH, which is why the slice that ran
   * through the notices went unmet until now: `twoInstances` sits in two
   * orderings -- one per instance's browse -- and owes two notices, so it is the
   * first item anything counts the ordering rows of while a notice is on the
   * page. The count the old slice gave was four; the count a reader would agree
   * with is two. `alsoAppearsIn` carries why.
   *
   * THE NOTICE IS ASSERTED PRESENT FIRST, because every assertion after it is a
   * negative one and a page rendering no attribution at all would satisfy them
   * both.
   */
  it("counts the orderings of an item that owes a notice without counting the notices", async () => {
    const { status, text } = await documentAt(`/items/${twoInstances.id}`);

    expect(status).toBe(200);
    expect(sectionIn(text, "attribution")).toContain(twoInstances.notice);

    const rows = orderingRows(text);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).not.toContain(twoInstances.notice);
  });
});

/**
 * The ticket's first criterion, and the one that needs two providers to mean
 * anything: the app imports THROUGH THE TMDB PROVIDER and renders the result with
 * its source recorded.
 */
describe("an item imported from the second provider", () => {
  it("renders the title TMDB gave it, and names TMDB as having said so", async () => {
    const { status, text } = await documentAt(`/items/${attributed.id}`);

    expect(status).toBe(200);
    expect(text).toContain(attributed.title);
    // The provider's OWN name from its manifest, not the loopback URL it happens
    // to be on -- which is a deployment detail and, for a provider on a private
    // network, an address a reader has no business being handed.
    expect(text).toContain("provider-tmdb");
    expect(text).not.toMatch(/127\.0\.0\.1:\d+/);
  });
});

describe("/items/<an item in more orderings than one page>", () => {
  const pagedBaseUrl = inject("pagedBaseUrl");
  const appearsIn = inject("pagedAppearsIn");

  /**
   * Every ordering one rendered page links at: the CONTAINER each row names.
   *
   * THE CONTAINER AND NOT THE PLACEMENT, which is what this listing's rows can
   * be oracled on and is ADR-0066 operating rather than a shortcoming. These
   * links deliberately carry no `?via=`: a reader following one is arriving at
   * the container ITSELF, not at this item through an ordering, so there is no
   * placement id in the markup to collect. What makes that still an exact
   * oracle is comparing MULTISETS -- the fixture's Repeat puts one container in
   * the list twice, and a set comparison would forgive losing one of them.
   *
   * OFF THE ROWS RATHER THAN OFF THE SECTION, for the reason the Members list
   * gives: the walk's own `Next` and the filter's chips are `/items/...` links
   * in this section too, and a scan of the whole section would collect them.
   */
  function orderingsLinkedFrom(text: string): string[] {
    return orderingRows(text).flatMap((row) => {
      const named = row.match(/href="\/items\/([^"?&]+)"/)?.[1];
      return named === undefined ? [] : [named];
    });
  }

  /** Where the page says the list carries on, if it says so at all. */
  function carriesOnAt(text: string): string | undefined {
    return sectionIn(text, "also-appears-in")
      .match(/href="(\/items\/[^"]*placedAfter=[^"]*)"/)?.[1]
      ?.replaceAll("&amp;", "&");
  }

  it("shows one page at a time, and says how many appearances it is not showing", async () => {
    // THE CAP, WHICH WAS MISSING HERE LAST OF ANYWHERE. ADR-0119's first
    // sentence is that every listing in CanonCore is capped; after CNCORE-89
    // this was the only one in the app that took no limit at all.
    const { status, text } = await documentFrom(pagedBaseUrl, `/items/${appearsIn.id}`);

    expect(status).toBe(200);
    expect(orderingsLinkedFrom(text)).toHaveLength(100);
    // APPEARANCES, AND A COUNT OF PLACEMENTS (CNCORE-236). The fixture's Repeat
    // is what lets this tell the two apart: one ordering twice makes one more
    // placement than there are orderings, so a count of containers would be
    // one short of the figure below -- and the noun would be wrong for it.
    expect(appearsIn.sitsIn.length).toBe(appearsIn.containers.length + 1);
    expect(sectionIn(text, "also-appears-in")).toContain(
      `Showing 100 of ${appearsIn.sitsIn.length} appearances`,
    );
  });

  it("reaches every ordering by following links, and lands on none of them twice", async () => {
    // THE OTHER HALF OF THE CAP, at the seam this ticket names by hand: a page
    // that says "Showing 100 of 211" and offers no way to reach the
    // hundred-and-first has told the reader the size of a list it will not let
    // them see.
    //
    // THE ORACLE IS THE PLACEMENTS THE HARNESS WROTE rather than a second
    // reading of the item: a cursor that lost the unnamed orderings would lose
    // them from both sides and the two readings would agree.
    const walked: string[] = [];
    let path: string | undefined = `/items/${appearsIn.id}`;
    // BOUNDED, so a cursor that does not advance FAILS rather than hangs.
    for (let pages = 0; pages <= appearsIn.sitsIn.length; pages += 1) {
      const { status, text } = await documentFrom(pagedBaseUrl, path);
      expect(status).toBe(200);
      walked.push(...orderingsLinkedFrom(text));
      const next: string | undefined = carriesOnAt(text);
      if (next === undefined) {
        // A MULTISET, SORTED BOTH SIDES. The Repeat is one container twice, so
        // this is the comparison that can see it going missing.
        expect([...walked].sort()).toStrictEqual(
          appearsIn.sitsIn.map((placement) => placement.containerId).sort(),
        );
        return;
      }
      path = next;
    }
    throw new Error(`the walk never ended: ${walked.length} of ${appearsIn.sitsIn.length}`);
  });

  it("keeps the cursor out of the canonical, and writes it behind the other three", async () => {
    // ADR-0066: the PATH is identity and the QUERY is the route. A FOURTH
    // non-identifying parameter has to compose with the three already there, in
    // ONE fixed spelling order -- `via`, `placed`, `after`, `placedAfter`, each
    // behind the ones that were out there before it -- and it must leave the
    // canonical alone, because that declaration is what makes every route to
    // this item one page.
    const { text } = await documentFrom(
      pagedBaseUrl,
      `/items/${appearsIn.id}?placed=owner&via=nothing-at-all&after=nothing-either`,
    );

    const next = carriesOnAt(text);
    if (next === undefined) throw new Error("the list offered no next page");
    expect(next).toMatch(
      new RegExp(
        `^/items/${appearsIn.id}\\?via=nothing-at-all&placed=owner&after=nothing-either&placedAfter=[0-9a-f-]+$`,
      ),
    );
    expect(text).toContain(`<link rel="canonical" href="/items/${appearsIn.id}"/>`);
  });

  it("carries the Members cursor through its chips, and drops its own", async () => {
    // ADR-0066: two independent listings on one page, so a chip that dropped the
    // Members cursor would send a reader deep in a container's ordering back to
    // its first page for touching the other list.
    //
    // AND IT DROPS THIS LIST'S OWN, which is the half that is not symmetry. A
    // chip changes what "Also appears in" is ASKING, so the answer is a
    // different listing and the old cursor names an anchor in the one being left.
    const { text } = await documentFrom(
      pagedBaseUrl,
      `/items/${appearsIn.id}?after=nothing-either&placedAfter=${appearsIn.sitsIn[0]?.id}`,
    );

    // SCOPED TO THE FILTER'S OWN `nav`, so the walk's `Next` and the rows
    // themselves cannot be counted as chips.
    const nav = sectionIn(text, "also-appears-in").match(
      /<nav aria-label="Filter by how it was placed".*?<\/nav>/,
    )?.[0];
    if (nav === undefined) throw new Error("the list rendered no filter");
    const chips = [...nav.matchAll(/href="([^"]*)"/g)].map(([, href]) =>
      (href ?? "").replaceAll("&amp;", "&"),
    );

    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip).toContain("after=nothing-either");
      expect(chip).not.toContain("placedAfter=");
    }
  });

  it("offers a way back to the start from every page but the first", async () => {
    // A FORWARD WALK STRANDS A DEEP LINK (ADR-0119): somebody handed page two
    // in a message has no history to go back through.
    const first = await documentFrom(pagedBaseUrl, `/items/${appearsIn.id}`);
    const next = carriesOnAt(first.text);
    if (next === undefined) throw new Error("the fixture's orderings fit on one page");

    const second = await documentFrom(pagedBaseUrl, next);

    expect(sectionIn(second.text, "also-appears-in")).toContain("Back to the start");
    // AND NOT ON THE FIRST PAGE, which is the half that makes the line above a
    // test: a page printing it unconditionally would satisfy that and fail this.
    expect(sectionIn(first.text, "also-appears-in")).not.toContain("Back to the start");
  });

  /**
   * THE CHIPS THE FILTER OFFERS, scoped to their own `nav` so the walk's `Next`
   * and the rows themselves cannot be counted as chips.
   */
  function chipsOn(text: string): string[] {
    const nav = sectionIn(text, "also-appears-in").match(
      /<nav aria-label="Filter by how it was placed".*?<\/nav>/,
    )?.[0];
    if (nav === undefined) throw new Error("the list rendered no filter");
    return [...nav.matchAll(/>([^<>]+)<\/a>/g)].map(([, word]) => word ?? "");
  }

  it("narrows the LISTING, so an origin off this page is still reachable", async () => {
    // CNCORE-129, and the fixture is what makes it observable: one of this
    // item's orderings was placed by a provider and the rest by the owner's own
    // hand, and that one sits past the first page. A filter over the rows the
    // cap handed the surface answers nothing at all here.
    const { text } = await documentFrom(pagedBaseUrl, `/items/${appearsIn.id}?placed=provider`);

    expect(orderingsLinkedFrom(text)).toStrictEqual([appearsIn.imported.containerId]);
    // THE SIZE OF THE NARROWING, not of the list it was cut out of, and not of
    // the page: "1 appearance" is `Holding` saying the cap did not bite. The
    // whole text node, so neither "211 appearances" nor a plural gone wrong
    // could pass for it.
    expect(sectionIn(text, "also-appears-in")).toContain(">1 appearance<");
    expect(sectionIn(text, "also-appears-in")).not.toContain(
      `of ${appearsIn.sitsIn.length} appearances`,
    );
  });

  it("caps and walks the narrowing, so a reader can reach past row 100 of it", async () => {
    // THE OTHER HALF: the narrowed listing is a listing, so it is capped at a
    // page and walked from the row that page ended on -- carrying `placed`
    // alongside its cursor, or page two would answer the whole list again.
    //
    // THE ORACLE IS THE FIXTURE'S OWN ARITHMETIC: every placement it wrote but
    // the one a provider asserted and the one nobody did.
    const byHand = appearsIn.sitsIn.length - 2;
    const first = await documentFrom(pagedBaseUrl, `/items/${appearsIn.id}?placed=owner`);

    expect(sectionIn(first.text, "also-appears-in")).toContain(
      `Showing 100 of ${byHand} appearances`,
    );

    const walked: string[] = [];
    let path: string | undefined = `/items/${appearsIn.id}?placed=owner`;
    for (let pages = 0; pages <= appearsIn.sitsIn.length; pages += 1) {
      const { status, text } = await documentFrom(pagedBaseUrl, path);
      expect(status).toBe(200);
      walked.push(...orderingsLinkedFrom(text));
      const next: string | undefined = carriesOnAt(text);
      if (next === undefined) {
        expect(walked).toHaveLength(byHand);
        // AND NOTHING FROM THE OTHER ORIGIN GOT IN, which is the half a walk
        // that dropped `placed` on page two would fail.
        expect(walked).not.toContain(appearsIn.imported.containerId);
        return;
      }
      path = next;
    }
    throw new Error(`the narrowed walk never ended: ${walked.length} of ${byHand}`);
  });

  it("offers every origin as a chip, whichever page and whichever narrowing", async () => {
    // THE SECOND READ, AT THE SURFACE IT EXISTS FOR. Page one carries a hundred
    // hand-placed orderings and no imported row at all, and the narrowed page
    // carries the imported one alone -- so chips read off the rows would offer
    // the reader only what they were already looking at, and All would be
    // reachable only by editing the address.
    const first = await documentFrom(pagedBaseUrl, `/items/${appearsIn.id}`);
    const narrowed = await documentFrom(pagedBaseUrl, `/items/${appearsIn.id}?placed=provider`);

    expect(orderingsLinkedFrom(first.text)).not.toContain(appearsIn.imported.containerId);
    // The reader's words for the two origins (ADR-0045): the page supplies them
    // and the read path answers the keys.
    expect(chipsOn(first.text)).toStrictEqual(["All", "Hand-placed", "Imported"]);
    expect(chipsOn(narrowed.text)).toStrictEqual(["All", "Hand-placed", "Imported"]);
  });

  it("says nothing about what the page looked at, because it looked at the listing", async () => {
    // CNCORE-125 counted the narrowing against the PAGE -- "Showing 12 of the
    // 100 orderings on this page" -- because that was all a filter over the rows
    // could honestly claim. The narrowing is the query's now, so the caveat
    // describes a limit that no longer holds, and a caveat outliving its cause
    // is worse than none.
    const { text } = await documentFrom(pagedBaseUrl, `/items/${appearsIn.id}?placed=owner`);

    expect(sectionIn(text, "also-appears-in")).not.toContain("on this page");
  });

  it("says the list ends here, where a link outlived the orderings after it", async () => {
    // THE ONE DEAD END A CURSOR CREATES. `continuesAfter` is handed over only
    // when there is a row past the page, so a link FOLLOWED never lands here --
    // but a link KEPT can. Without this the reader gets a heading and an empty
    // list, which reads as a section that failed to load.
    // THE CURSOR COMES FROM THE HARNESS, because this listing's rows link to
    // the CONTAINER and carry no placement id -- so unlike the Members walk,
    // the id of the last row cannot be read off the page that shows it.
    const beyond = await documentFrom(
      pagedBaseUrl,
      `/items/${appearsIn.id}?placedAfter=${appearsIn.endsAt}`,
    );

    expect(beyond.status).toBe(200);
    expect(sectionIn(beyond.text, "also-appears-in")).toContain("end here");
    // THE WAY OUT, not merely the notice. A section that said the list ended and
    // offered nothing to click is the same dead end with a caption on it.
    expect(sectionIn(beyond.text, "also-appears-in")).toContain(`href="/items/${appearsIn.id}"`);
    // AND EXACTLY ONE OF IT, which is the defect CNCORE-89's review found on the
    // mirror: the notice and the walk each offer a way back, and both rendered
    // there until it was fixed. Counted as rendered anchors rather than as the
    // phrase, because the phrase appears again in the RSC flight payload.
    const waysBack =
      sectionIn(beyond.text, "also-appears-in").match(/<a[^>]*>Back to the start<\/a>/g) ?? [];
    expect(waysBack).toHaveLength(1);
  });
});
