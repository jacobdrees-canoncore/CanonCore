import { describe, expect, inject, it } from "vitest";

import {
  documentAt,
  documentFrom,
  followed,
  itemsListedOn,
  markedCurrentIn,
  scopeLinked,
  sectionIn,
  textOf,
  walkLinked,
} from "./document";

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

/**
 * Where the page says the results carry on, if it says so at all -- on a plain
 * search and on one narrowed to a Group alike, which is why it is out here
 * rather than inside either block.
 *
 * UNESCAPED, because this href carries TWO parameters and React writes the
 * separator as `&amp;`. A test fetching the raw attribute would ask for a
 * query string with a parameter called `amp;after`, which names no cursor --
 * so the walk would restart every page and the bug would look like the app's.
 */
function carriesOnAt(text: string): string | undefined {
  return text.match(/href="(\/search\?[^"]*after=[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
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
    const prompt = sectionIn(text, "nothing-asked");
    expect(prompt.toLowerCase()).toContain("type a name");
  });

  it("says a search found nothing, rather than rendering an empty page", async () => {
    const { text } = await documentAt(`/search?q=${encodeURIComponent("zzzznothinghere")}`);

    // ITS OWN SECTION, for the reason above: an assertion on the whole document
    // cannot tell the page's words from the shell's.
    const nothing = sectionIn(text, "nothing-found");
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

  it("steps back from the third page of results to the second, keeping the query", async () => {
    // THE STEP BACK ON THIS SURFACE (CNCORE-174), from the THIRD page, where
    // two hundred results lie behind: from the second the answer is the start,
    // which a dropped `before` would answer too. Previous keeps `q`, because
    // this order is a function of the query and the walk resupplies it on
    // every page (ADR-0119).
    const pagedBaseUrl = inject("pagedBaseUrl");
    const first = await documentFrom(pagedBaseUrl, `/search?q=${QUERY}`);
    const second = await documentFrom(
      pagedBaseUrl,
      followed(walkLinked(first.text, "Next"), "Next"),
    );
    const third = await documentFrom(
      pagedBaseUrl,
      followed(walkLinked(second.text, "Next"), "Next"),
    );

    const previous = followed(walkLinked(third.text, "Previous"), "Previous");
    const back = await documentFrom(pagedBaseUrl, previous);

    expect(previous).toMatch(new RegExp(`^/search\\?q=${QUERY}&before=`));
    expect(itemsListedOn(back.text)).toStrictEqual(itemsListedOn(second.text));
    // AND IT SAYS IT IS THE SECOND HUNDRED, which is `/search` handing the
    // count through as well as the Rows (ADR-0133).
    expect(back.text).toMatch(/>Showing results 101 to 200 of \d+<\/p>/);
  });

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
      walked.push(...itemsListedOn(text));
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

    expect(itemsListedOn(first.text)).toHaveLength(100);
    expect(first.text).toContain(
      `<p class="text-muted-foreground text-sm">Showing results 1 to 100 of ${searchable}</p>`,
    );
    // THE SAME SIZE ON PAGE TWO, beside the Rows it has moved on to (ADR-0133).
    // A shrinking total renders here as a page quietly reporting a smaller
    // library than the one before it.
    expect(second.text).toContain(
      `<p class="text-muted-foreground text-sm">Showing results 101 to 200 of ${searchable}</p>`,
    );
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
    const last = itemsListedOn(text).at(-1);

    const beyond = await documentFrom(pagedBaseUrl, `/search?q=${QUERY}&after=${last}`);

    expect(beyond.status).toBe(200);
    // THE WAY OUT, and it keeps the query for the reason the test above gives:
    // a reader stranded past the end of their results wants the results, not
    // the prompt.
    expect(sectionIn(beyond.text, "past-the-end")).toContain(`href="/search?q=${QUERY}"`);
    // AND IT CLAIMS TO SHOW NOTHING (ADR-0133). A page with no Rows has no
    // first or last to name, which is why every other surface says nothing
    // above its ending: said here, it read "Showing results 255 to 254".
    expect(beyond.text).not.toMatch(/>Showing results? /);
  });
});

/**
 * CATALOGUE SEARCH WITHIN A GROUP (CNCORE-180): searching Doctor Who does not
 * return Iron Man.
 *
 * ON THE PAGED INSTANCE, whose Group holds the catalogue's own stories and
 * nothing that holds them: `story` matches every titled Item there, so the
 * Group's matches are a strict part of the catalogue's -- the container and the
 * two hundred orderings match too and sit outside it -- and more than one page
 * of them. A search that dropped the scope would read differently from one that
 * kept it, on every page. Nobody writes to it.
 */
describe("/search narrowed to a Group", () => {
  const QUERY = "story";
  const pagedBaseUrl = inject("pagedBaseUrl");
  const group = inject("pagedGroup");
  /**
   * WHAT THE GROUP'S MATCHES ARE: everything put in it, less the two it holds
   * with no title -- which no search reaches, because the match is
   * `title ilike ...` and that is NULL without one.
   */
  const matchedInTheGroup = group.holds.filter((id) => !inject("pagedUntitled").includes(id));

  it("searches within a Group picked from the results, at the size of what it searched", async () => {
    // THE CRITERIA TOGETHER: the matches are the Group's, and "Showing 100 of"
    // counts the Group's matches rather than the catalogue's -- which is the
    // lie a narrowing added to the Rows and not the count would tell here. And
    // the query survives the picking: narrowing a search is not starting over.
    const whole = await documentFrom(pagedBaseUrl, `/search?q=${QUERY}`);
    const picked = scopeLinked(whole.text, group.name);

    const { status, text } = await documentFrom(pagedBaseUrl, picked);

    expect(status).toBe(200);
    // THE QUERY, THEN THE GROUP (ADR-0066): what was asked, then within what.
    expect(picked).toBe(`/search?q=${QUERY}&group=${group.id}`);
    expect(itemsListedOn(text)).toHaveLength(100);
    expect(itemsListedOn(text).every((id) => group.holds.includes(id))).toBe(true);
    expect(text).toContain(
      `<p class="text-muted-foreground text-sm">Showing results 1 to 100 of ${matchedInTheGroup.length}</p>`,
    );
    expect(markedCurrentIn(text)).toStrictEqual([group.name]);
    expect(markedCurrentIn(whole.text)).toStrictEqual(["Everything"]);
  });

  it("walks every match in the Group by following links, keeping the query and the scope", async () => {
    // A `Next` THAT DROPPED EITHER walks into the wrong Listing: without the
    // query it is no search at all, and without the Group it carries on into
    // matches the Group does not hold. The oracle is the fixture's list.
    const first = `/search?q=${QUERY}&group=${group.id}`;
    const walked: string[] = [];
    let path: string | undefined = first;
    for (let pages = 0; pages <= matchedInTheGroup.length; pages += 1) {
      const { status, text } = await documentFrom(pagedBaseUrl, path);
      expect(status).toBe(200);
      walked.push(...itemsListedOn(text));
      if (pages > 0) {
        expect(text).toContain(`href="${first}">Back to the start</a>`);
      }
      path = carriesOnAt(text);
      if (path === undefined) {
        expect([...walked].sort()).toStrictEqual([...matchedInTheGroup].sort());
        expect(new Set(walked).size).toBe(walked.length);
        return;
      }
      expect(path).toMatch(new RegExp(`^/search\\?q=${QUERY}&group=${group.id}&after=`));
    }
    throw new Error(`the walk never ended: ${walked.length} of ${matchedInTheGroup.length}`);
  });

  it("offers the whole catalogue's matches back, keeping the query", async () => {
    // CLEARING THE SCOPE IS NOT CLEARING THE QUESTION. `Everything` on a
    // narrowed search is the same search across the catalogue, not the prompt
    // `/search` alone answers with.
    const narrowed = await documentFrom(pagedBaseUrl, `/search?q=${QUERY}&group=${group.id}`);

    expect(scopeLinked(narrowed.text, "Everything")).toBe(`/search?q=${QUERY}`);
  });

  it("says a Group that names nothing is not there, rather than that nothing matched", async () => {
    // "NOTHING MATCHED" WOULD BE A CLAIM ABOUT A SCOPE THAT DOES NOT EXIST, and
    // a reader who believed it would stop looking for something that is in the
    // catalogue. So the page says the Group is not there, and the way out is
    // the same search unnarrowed.
    for (const missing of [crypto.randomUUID(), "doctor-who"]) {
      const { status, text } = await documentFrom(
        pagedBaseUrl,
        `/search?q=${QUERY}&group=${missing}`,
      );

      expect(status).toBe(200);
      expect(sectionIn(text, "no-such-group")).toContain(`href="/search?q=${QUERY}"`);
      expect(() => sectionIn(text, "nothing-found")).toThrow();
    }
  });

  it("says nothing matched within a Group, by name, and offers the search across everything", async () => {
    // A SEARCH THAT FOUND NOTHING IN A SCOPE HAS NOT SEARCHED THE CATALOGUE,
    // and saying only "Nothing matched" would read as though it had. So the
    // sentence names the Group, and the page offers the wider search.
    const empty = inject("pagedEmptyGroup");

    const { status, text } = await documentFrom(
      pagedBaseUrl,
      `/search?q=${QUERY}&group=${empty.id}`,
    );

    expect(status).toBe(200);
    const said = sectionIn(text, "nothing-found");
    expect(textOf(said)).toContain(`Nothing matched ${QUERY} in ${empty.name}`);
    expect(said).toContain(`href="/search?q=${QUERY}"`);
  });

  it("finds every kind within a Group, where work-browsing narrowed to it hides the entities", async () => {
    // ADR-0077's WIDE QUESTION SURVIVES THE NARROWING. The seeded instance's
    // Group holds a Person, a Character and an Ordering of entities beside two
    // Works; `in` matches the Person, the Ordering of entities and the story,
    // and a Group-narrowed search that consulted `holds_work` would find the
    // story alone. `works-page.test.ts` reads the same Group from `/works`.
    const workBrowsing = inject("workBrowsing");

    const { text } = await documentAt(`/search?q=in&group=${workBrowsing.group.id}`);

    expect(text).toContain(workBrowsing.person);
    expect(text).toContain(workBrowsing.entityContainer);
    expect(text).toContain(workBrowsing.story);
    expect(text).toContain('<p class="text-muted-foreground text-sm">3 results</p>');
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
