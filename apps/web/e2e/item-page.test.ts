import { describe, expect, inject, it } from "vitest";

/**
 * The app over real HTTP: a production build of Next, serving a real database.
 *
 * This is the test CNCORE-4's acceptance criterion asks for, and the only one
 * in the repo that would fail if the page, the router, the projection, the
 * migration or the Next build were broken. Everything else passes with the app
 * never having been served.
 */
const baseUrl = inject("baseUrl");
const itemId = inject("itemId");
const itemTitle = inject("itemTitle");
const placements = inject("placements");
const twoOrigins = inject("twoOrigins");
const imported = inject("imported");
const browsed = inject("browsed");
const attributed = inject("attributed");

/**
 * Assertions are made against the DECODED document. React escapes `'` as
 * `&#x27;`, and a test that matched that literally would be asserting on
 * React's escaping table rather than on the page's content -- and would break
 * on a title whose punctuation happens to escape differently.
 */
async function documentAt(path: string): Promise<{ status: number; text: string }> {
  const response = await fetch(`${baseUrl}${path}`);
  const raw = await response.text();
  const text = raw
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
  return { status: response.status, text };
}

/**
 * The rows of the "Also appears in" list, one string each, so an assertion can
 * ask WHICH row carries a marker rather than only whether the page does.
 */
function orderingRows(text: string): string[] {
  // Scoped to the section rather than the document. Matching every `<li>` on
  // the page would make "narrows the list to one" depend on nothing else ever
  // rendering a list, which is a promise no page keeps for long.
  return alsoAppearsIn(text).match(/<li[^>]*>.*?<\/li>/g) ?? [];
}

/** Just the "Values" section, so an assertion cannot match the rest of the page. */
function values(text: string): string {
  const section = text.match(/<section[^>]*aria-labelledby="values".*?<\/section>/)?.[0];
  if (!section) throw new Error("the page rendered no `Values` section");
  return section;
}

/** Just the "Also appears in" section, so an assertion cannot match the header. */
function alsoAppearsIn(text: string): string {
  const section = text.match(/<section[^>]*aria-labelledby="also-appears-in".*?<\/section>/)?.[0];
  if (!section) throw new Error("the page rendered no `Also appears in` section");
  return section;
}

describe("/items/<id>", () => {
  it("returns 200 and renders the item's title", async () => {
    const { status, text } = await documentAt(`/items/${itemId}`);

    expect(status).toBe(200);
    // The title was written as a STATEMENT and never into the column, so seeing
    // it here means the projection ran (ADR-0014).
    expect(text).toContain(`<h1 class="text-3xl font-medium">${itemTitle}</h1>`);
  });

  it("puts the title in the document title too", async () => {
    const { text } = await documentAt(`/items/${itemId}`);

    expect(text).toContain(`<title>${itemTitle}</title>`);
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
      expect(text).toContain(`<h1 class="text-3xl font-medium">${itemTitle}</h1>`);
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
    expect(text).toContain(`<h1 class="text-3xl font-medium">${itemTitle}</h1>`);
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

    const section = alsoAppearsIn(text);
    expect(section.match(/<ul/g) ?? []).toHaveLength(1);
    expect(section).toContain(twoOrigins.byHand);
    expect(section).toContain(twoOrigins.imported);
  });

  it("offers a filter over the origins actually present, and no others", async () => {
    const { text } = await documentAt(`/items/${twoOrigins.id}`);

    const filter = alsoAppearsIn(text);
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
 * The provider behind it is ADR-0057's fixture either way: a stub answering the
 * fixture's own row locally, and the real `provider-wiki` image as a service
 * container in CI, chosen by `PROVIDER_WIKI_URL`. The assertions do not know
 * which, which is the point -- they are the contract, and CI is where the real
 * image is held to it.
 */
describe("an item imported from a provider", () => {
  it("renders the title the provider gave it", async () => {
    const { status, text } = await documentAt(`/items/${imported.id}`);

    expect(status).toBe(200);
    expect(text).toContain(`<h1 class="text-3xl font-medium">${imported.title}</h1>`);
  });

  it("shows the provider as the source of every value it claimed", async () => {
    const { text } = await documentAt(`/items/${imported.id}`);

    const section = values(text);
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

    expect(values(text)).toContain(imported.providerLabel);
    expect(values(text)).not.toContain("127.0.0.1");
  });

  it("says the owner said it when the owner did", async () => {
    // The same list, for the hand-seeded demo item: the section is about
    // provenance rather than about imports, so it has to work for both.
    const { text } = await documentAt(`/items/${itemId}`);

    expect(values(text)).toContain("Owner");
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
    expect(text).toContain(`<h1 class="text-3xl font-medium">${browsed.title}</h1>`);
    const section = alsoAppearsIn(text);
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

    const section = alsoAppearsIn(text);
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

    const section = values(text);
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

describe("a member the ordering could not place", () => {
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
