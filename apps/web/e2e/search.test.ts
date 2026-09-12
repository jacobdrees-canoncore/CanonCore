import { describe, expect, inject, it } from "vitest";

import { documentAt, documentFrom } from "./document";

/**
 * CATALOGUE SEARCH over real HTTP. ADR-0103's fourth seam, which is the one
 * CNCORE-66 names by hand: a page-over-HTTP assertion and no browser, because
 * everything this page renders is in the HTML the server returns.
 *
 * `CONTEXT.md` gives the surface its name and separates it from the CMPP
 * operation also called Search, which asks a PROVIDER for candidates.
 */
const itemTitle = inject("itemTitle");
/**
 * An item whose kind's LABEL DIFFERS FROM ITS KEY, which is the only pair that
 * can tell whether a page is printing the reader's word or the column.
 * `time_span` is the key; `Time span` is what `CONTEXT.md` says a reader sees.
 */
const timeSpan = inject("timeSpan");
/** The seeded demo item, which is a WORK (`itemTitle` is its title). */
const itemId = inject("itemId");
/** The same build, an empty database, and no allowlist (ADR-0094). */
const freshBaseUrl = inject("freshBaseUrl");

/** One `<section>` of a page, by the heading it is labelled with. */
function section(text: string, label: string): string {
  const found = text.match(new RegExp(`<section[^>]*aria-labelledby="${label}".*?</section>`))?.[0];
  if (!found) throw new Error(`the page rendered no \`${label}\` section`);
  return found;
}

describe("/search", () => {
  it("finds an item by a word inside its title, and links to its own address", async () => {
    // INSIDE, not at the front, which is the capability the whole mechanism is
    // chosen for: full-text search matches lexemes and answers nothing at all
    // for a fragment.
    const { status, text } = await documentAt(`/search?q=${encodeURIComponent("Hartnell")}`);

    expect(status).toBe(200);
    expect(text).toContain(timeSpan.title);
    // THE ITEM'S OWN ADDRESS (ADR-0066), bare and canonical -- no `?via=`,
    // which names the ORDERING a reader arrived through and is a claim a
    // search result cannot make. The front page emits the same address for the
    // same reason, and the two must not be two spellings of one thing.
    expect(text).toContain(`href="/items/${timeSpan.id}"`);
  });

  it("finds a Work as well as an Entity, at this seam and not only below it", async () => {
    // THE CRITERION IS "WORKS AND ENTITIES ALIKE" AND THIS IS THE SEAM THE
    // TICKET NAMES BY HAND, so both halves have to be visible here rather than
    // only at the package export. Review found the Work half asserted two
    // layers down and only ever asserted ABSENT up here, which is a criterion
    // met by the implementation and unmet by the test that covers it.
    //
    // The seeded demo item is a Work; `timeSpan` is an Entity.
    const work = await documentAt(`/search?q=${encodeURIComponent(itemTitle)}`);
    const entity = await documentAt(`/search?q=${encodeURIComponent("Hartnell")}`);

    expect(work.text).toContain(`href="/items/${itemId}"`);
    expect(entity.text).toContain(`href="/items/${timeSpan.id}"`);
  });

  it("says which kind each result is, in the reader's words", async () => {
    // A Person and a Work sharing a name are distinguishable only by this.
    // `Time span` rather than `time_span`: `CONTEXT.md` is binding on UI copy,
    // and a page printing the column is showing a reader the schema. The pair
    // is the point -- `Work` is a capital away from `work` and could not tell
    // a read of the label from a read of the key.
    const { text } = await documentAt(`/search?q=${encodeURIComponent("Hartnell")}`);

    expect(text).toContain("Time span");
    expect(text).not.toContain(timeSpan.kind);
  });

  it("treats a per cent sign as text rather than as a wildcard", async () => {
    // THE WHOLE CATALOGUE IS WHAT THE BUG LOOKS LIKE. Unescaped, `%` becomes
    // the pattern `%%%` and matches every titled row, so the failure renders as
    // a search that found everything rather than as an error. No fixture here
    // has a per cent in its title, so the right answer is nothing at all.
    //
    // `%25` ON THE WIRE, because a bare `%` is not a legal query string.
    const { status, text } = await documentAt("/search?q=%25");

    expect(status).toBe(200);
    expect(text).not.toContain(itemTitle);
    expect(text).not.toContain(timeSpan.title);
  });

  it("asks for a query rather than listing the catalogue, when none was typed", async () => {
    // DELIBERATE RATHER THAN ACCIDENTAL. An escaped empty query is the pattern
    // `%%`, which matches every titled row, so an empty search box would
    // otherwise answer with the entire catalogue. The front page already
    // answers "what is in this catalogue", and a search falling back to it
    // would be a second surface giving the same reply (ADR-0120).
    const { status, text } = await documentAt("/search?q=");

    expect(status).toBe(200);
    expect(text).not.toContain(itemTitle);
    // THE PROMPT ITSELF, BY ITS OWN SECTION. This was
    // `expect(text.toLowerCase()).toContain("search")`, which the header's own
    // search box satisfies on every page in the app -- so it passed whether or
    // not the page said anything at all, and only the `not.toContain` half had
    // teeth. Caught in review.
    const prompt = section(text, "nothing-asked");
    expect(prompt.toLowerCase()).toContain("type a name");
  });

  it("says a search found nothing, rather than rendering an empty page", async () => {
    const { text } = await documentAt(`/search?q=${encodeURIComponent("zzzznothinghere")}`);

    // ITS OWN SECTION, for the reason above: an assertion on the whole document
    // cannot tell the page's words from the shell's.
    const nothing = section(text, "nothing-found");
    expect(nothing).toContain("zzzznothinghere");
    // ADR-0014's limit, named where a reader hunting a title they have
    // definitely seen will otherwise spend a while disbelieving the search.
    expect(nothing.toLowerCase()).toContain("title");
  });
});

describe("/search on a result set larger than one page", () => {
  /**
   * WHAT `q` IS. Every titled item in the paged instance carries `story` in its
   * title -- 249 of them are "Story 0001".."Story 0249", two are "A story told
   * twice", and one is the container titled "Every story here, in one ordering"
   * -- so this one query matches every item there EXCEPT the two with no title
   * at all, which is the state the walk is asserted against.
   */
  const QUERY = "story";

  /** Every item one rendered page links at, in the order it links them. */
  function itemsLinkedFrom(text: string): string[] {
    return [...text.matchAll(/href="\/items\/([^"?]+)"/g)].map(([, id]) => id as string);
  }

  /**
   * Where the page says the results carry on, if it says so at all.
   *
   * UNESCAPED, because this href carries TWO parameters and React writes the
   * separator as `&amp;`. A test fetching the raw attribute would ask for a
   * query string with a parameter called `amp;after`, which names no cursor --
   * so the walk would restart every page and the bug would look like the app's.
   */
  function carriesOnAt(text: string): string | undefined {
    return text.match(/href="(\/search\?[^"]*after=[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
  }

  it("reaches every match by following links, and lands on none of them twice", async () => {
    // THE TICKET'S CRITERIA AT THE SEAM IT NAMES BY HAND: a search matching
    // more than one page walked to the next, over real HTTP, against a
    // catalogue large enough for the cap to bite.
    //
    // THE ORACLE IS THE IDS THE HARNESS WROTE, minus the two it wrote with no
    // title -- which a search cannot reach, because the match is
    // `title ilike ...` and that is NULL without one. Not a second reading of
    // the search: a cursor that loses rows would lose them from both sides and
    // the two readings would agree.
    const searchable = inject("pagedCatalogue").filter(
      (id) => !inject("pagedUntitled").includes(id),
    );
    const walked: string[] = [];
    let path: string | undefined = `/search?q=${QUERY}`;
    let pages = 0;
    // BOUNDED, so a cursor that does not advance FAILS rather than hangs.
    for (; pages <= searchable.length; pages += 1) {
      const { status, text } = await documentFrom(inject("pagedBaseUrl"), path);
      expect(status).toBe(200);
      walked.push(...itemsLinkedFrom(text));
      const next: string | undefined = carriesOnAt(text);
      if (next === undefined) break;
      path = next;
    }

    expect([...walked].sort()).toStrictEqual([...searchable].sort());
    // SORTED SETS COMPARE EQUAL EVEN WITH A REPEAT IN THEM, so the criterion
    // the comparison above cannot see gets its own line.
    expect(new Set(walked).size).toBe(walked.length);
    // AND IT TOOK MORE THAN ONE PAGE, which is what makes the rest of this a
    // test of a walk rather than of a single answer that happened to fit.
    expect(pages).toBeGreaterThan(1);
  });

  it("still shows one page at a time, and says how much it is not showing", async () => {
    // THE CAP, WHICH PAGING DOES NOT LIFT. `total` counts what MATCHED, and
    // every page has to report the same number: it was a window count taken
    // after `where`, so with a cursor in the predicate page two reported the
    // results left rather than the results found.
    const pagedBaseUrl = inject("pagedBaseUrl");
    const searchable = inject("pagedCatalogue").length - inject("pagedUntitled").length;

    const first = await documentFrom(pagedBaseUrl, `/search?q=${QUERY}`);
    const next = carriesOnAt(first.text);
    if (next === undefined) throw new Error("the fixture's matches fit on one page");
    const second = await documentFrom(pagedBaseUrl, next);

    expect(itemsLinkedFrom(first.text)).toHaveLength(100);
    const holding = `<p class="text-muted-foreground text-sm">Showing 100 of ${searchable} results</p>`;
    expect(first.text).toContain(holding);
    // THE SAME SENTENCE ON PAGE TWO. A shrinking total renders here as a page
    // quietly reporting a smaller library than the one before it.
    expect(second.text).toContain(holding);
  });

  it("offers a way back to the start of the SAME search from every page but the first", async () => {
    // A FORWARD WALK STRANDS A DEEP LINK (ADR-0119): somebody handed page two
    // in a message has no history to go back through.
    //
    // AND THE WAY BACK KEEPS THE QUERY, which is what makes this different from
    // the listing's. `/search` with no `q` is not the start of this search, it
    // is the page that asks for one -- so a link there would answer a reader
    // who wanted the first page of their results with an empty prompt.
    const pagedBaseUrl = inject("pagedBaseUrl");
    const first = await documentFrom(pagedBaseUrl, `/search?q=${QUERY}`);
    const next = carriesOnAt(first.text);
    if (next === undefined) throw new Error("the fixture's matches fit on one page");

    const second = await documentFrom(pagedBaseUrl, next);

    expect(second.text).toContain("Back to the start");
    expect(second.text).toContain(`href="/search?q=${QUERY}"`);
    // AND NOT ON THE FIRST PAGE, which is the half that makes the line above a
    // test: a page printing it unconditionally would satisfy that and fail this.
    expect(first.text).not.toContain("Back to the start");
  });

  it("says the results end here, where a link outlived the matches after it", async () => {
    // THE ONE DEAD END A CURSOR CREATES. `continuesAfter` is handed over only
    // when there is a row past the page, so a link FOLLOWED never lands here --
    // but a link KEPT can, once the results after the one it was cut at are
    // gone. Without this the reader gets a heading and an empty list, which is
    // indistinguishable from a page that failed to load.
    const pagedBaseUrl = inject("pagedBaseUrl");
    let text = (await documentFrom(pagedBaseUrl, `/search?q=${QUERY}`)).text;
    for (let pages = 0; pages < 10; pages += 1) {
      const next = carriesOnAt(text);
      if (next === undefined) break;
      text = (await documentFrom(pagedBaseUrl, next)).text;
    }
    const last = itemsLinkedFrom(text).at(-1);

    const beyond = await documentFrom(pagedBaseUrl, `/search?q=${QUERY}&after=${last}`);

    expect(beyond.status).toBe(200);
    // THE WAY OUT, and it keeps the query for the reason the test above gives:
    // a reader stranded past the end of their results wants the results, not
    // the prompt.
    expect(section(beyond.text, "past-the-end")).toContain(`href="/search?q=${QUERY}"`);
  });
});

describe("the search box", () => {
  it("is on every page, and submits to the search surface", async () => {
    // IT IS IN THE SHELL rather than on the front page, because "finding
    // something does not require knowing its id" is not a thing a reader stops
    // needing once they have opened an item.
    const front = await documentAt("/");
    const item = await documentAt(`/items/${timeSpan.id}`);

    for (const { text } of [front, item]) {
      expect(text).toContain('action="/search"');
      expect(text).toContain('name="q"');
    }
  });
});

describe("/search on a fresh install", () => {
  it("answers the same path differently from the seeded instance", async () => {
    // ADR-0117'S OWN CHECK, and it is a SHAPE rather than an assertion about
    // one page: ask two instances of ONE BUILD, pointed at different databases,
    // for the same path, and expect different answers. Nothing else in this
    // repository can see a build-time artefact at all -- a prerendered page
    // looks correct on the server it was built against, which is every server
    // anyone would think to check.
    //
    // A NEW READ SURFACE EARNS THE PAIR, not merely the declaration in its own
    // file. The line without the check is a rule somebody remembers, and the
    // second surface that forgets it looks exactly like the first one that did
    // not.
    const path = `/search?q=${encodeURIComponent("Hartnell")}`;

    const seeded = await documentAt(path);
    const fresh = await documentFrom(freshBaseUrl, path);

    expect(seeded.text).toContain(timeSpan.title);
    expect(fresh.status).toBe(200);
    expect(fresh.text).not.toContain(timeSpan.title);
  });
});
