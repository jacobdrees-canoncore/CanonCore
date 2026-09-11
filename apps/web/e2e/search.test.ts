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
