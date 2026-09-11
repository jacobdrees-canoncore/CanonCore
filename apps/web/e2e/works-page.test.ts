import { describe, expect, inject, it } from "vitest";

import { documentAt, documentFrom } from "./document";

/**
 * WORK-BROWSING, over real HTTP. ADR-0103's fourth seam, which is the one
 * CNCORE-67 names: a page-over-HTTP assertion and no browser, because
 * everything this page renders is in the HTML the server returns.
 *
 * ADR-0077 is the record under test and it names both ways of getting this
 * wrong -- "either people flood the browse grid, or the containers that
 * justified the single-table decision cannot be built". Every assertion below
 * is one of those two.
 */
const workBrowsing = inject("workBrowsing");
/**
 * THE SECOND SERVER: the same build, an empty database. ADR-0117 says a new
 * read surface earns this PAIR rather than merely the `connection()` line,
 * because "the line without the check is a rule somebody remembers; the second
 * surface that forgets it looks exactly like the first one that did not".
 */
const freshBaseUrl = inject("freshBaseUrl");

describe("/works", () => {
  it("shows a work and not a person", async () => {
    // The failure this surface exists to prevent, in the record's own words:
    // "what can I watch" answerable without the grid filling with cast members.
    const { status, text } = await documentAt("/works");

    expect(status).toBe(200);
    expect(text).toContain(workBrowsing.story);
    expect(text).not.toContain(workBrowsing.person);
    // AND A CHARACTER TOO, because the criterion names both and a Person alone
    // does not prove the rule. `kind = 'work'` excludes all six entity kinds by
    // construction, but a surface that had listed the kinds it wanted rather
    // than the one it wanted would be one forgotten line from shipping the cast.
    expect(text).not.toContain(workBrowsing.character);
  });

  it("shows a container that holds works and not one that holds only entities", async () => {
    // ADR-0077's SECOND half, which is the half its own first draft was missing:
    // "a kind filter alone is not enough ... the mechanism failed on the
    // record's own example". Containers fold into `work` (ADR-0004), so "the
    // Doctors, in order" is itself an item of kind `work`.
    //
    // THE TWO CONTAINERS DIFFER ONLY IN WHAT THEY HOLD, so a page filtering on
    // the kind alone passes the person assertion above and fails this one --
    // which is the whole reason both are here.
    const { text } = await documentAt("/works");

    expect(text).toContain(workBrowsing.workContainer);
    expect(text).not.toContain(workBrowsing.entityContainer);
  });

  it("shows the whole catalogue's entity containers on the catalogue page", async () => {
    // THE OTHER HALF OF THE SAME RECORD, and the half that makes the assertion
    // above a rule rather than a deletion. ADR-0077 says entity containers are
    // "reached deliberately rather than turning up in 'latest'" -- reached, not
    // removed. A page that had simply lost "the Doctors, in order" would pass
    // the test above and fail this one.
    const { text } = await documentAt("/");

    expect(text).toContain(workBrowsing.entityContainer);
  });

  it("renders per request rather than being prerendered at build time", async () => {
    // ADR-0117, and the check it names is a SHAPE rather than an assertion
    // about one page: "ask two instances of one build, pointed at different
    // databases, for the same path, and expect different answers".
    //
    // NOTHING ELSE CAN SEE THIS DEFECT. A prerendered page is not stale in any
    // way a single server can show -- the database it was built against is the
    // database it is serving, nothing errors, and no warning is raised
    // anywhere. On self-hosted software it is a browse grid frozen at the
    // moment somebody built the image, which no import would ever change.
    //
    // ASSERTED ON THE BYTES, both ways round. A one-directional check passes
    // against a page that always says the same thing, so this pins what each
    // instance says as well as that the two differ.
    const seeded = await documentAt("/works");
    const fresh = await documentFrom(freshBaseUrl, "/works");

    expect(fresh.status).toBe(200);
    expect(seeded.text).not.toBe(fresh.text);
    expect(seeded.text).toContain(workBrowsing.story);
    expect(fresh.text).not.toContain(workBrowsing.story);
  });

  it("says why a catalogue with no works shows nothing here", async () => {
    // The empty state is what makes the pair above readable rather than
    // alarming: a fresh install has nothing to watch, and ADR-0077 is the
    // reason rather than a fault. It names the rule instead of leaving a
    // reader to infer it from a blank page.
    const { text } = await documentFrom(freshBaseUrl, "/works");
    const empty = text.match(/<section[^>]*aria-labelledby="nothing-to-watch".*?<\/section>/)?.[0];
    if (!empty) throw new Error("the page rendered no `nothing-to-watch` section");

    expect(empty).toContain("Works");
    expect(empty).toContain("People");
  });
});

describe("reaching /works", () => {
  it("is linked from the catalogue, so it can be found without typing its address", async () => {
    // A SURFACE NOBODY CAN NAVIGATE TO DOES NOT ANSWER THE QUESTION. The ticket
    // asks for "what can I watch" to be answerable; reachable only by typing a
    // path is the same page nobody opens.
    //
    // ASSERTED BY FOLLOWING THE LINK rather than by matching an href, so this
    // cannot pass against a link pointing somewhere that no longer serves.
    const { text } = await documentAt("/");
    const linked = [...text.matchAll(/href="(\/works[^"]*)"/g)].map(([, href]) => href)[0];
    if (!linked) throw new Error("the catalogue linked nothing at /works");

    const arrived = await documentAt(linked);

    expect(arrived.status).toBe(200);
    expect(arrived.text).toContain(workBrowsing.story);
  });
});
