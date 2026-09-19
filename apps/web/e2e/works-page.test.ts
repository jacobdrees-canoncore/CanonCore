import { describe, expect, inject, it } from "vitest";

import {
  documentAt,
  documentFrom,
  itemsLinkedFrom,
  markedCurrentIn,
  scopeLinked,
  sectionIn,
} from "./document";

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
    const empty = sectionIn(text, "nothing-to-watch");

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

/**
 * WORK-BROWSING NARROWED TO A GROUP (CNCORE-180): "what can I watch" answered
 * about one universe, picked from this page as it is from the Catalogue's.
 *
 * ON THE SEEDED INSTANCE, WITHIN A GROUP ONLY THIS FILE KNOWS: one of each thing
 * ADR-0077 tells apart, so the same scope read from both surfaces says whether
 * the record's rule survives the narrowing. Its sizes are exact because nothing
 * else in the suite can put an Item in it.
 */
describe("/works narrowed to a Group", () => {
  const scope = workBrowsing.group;

  it("narrows to a Group picked from the page, and still leaves its entities out", async () => {
    // BOTH HALVES AT ONCE. Two Works of the five Items the Group holds -- so a
    // page that ignored the Group lists the rest of the catalogue's Works, and
    // one that replaced work-browsing's question with the Group's lists the
    // Person, the Character and the Ordering of entities. And the size is the
    // two, not the five and not the whole of work-browsing.
    const whole = await documentAt("/works");
    const picked = scopeLinked(whole.text, scope.name);

    const { status, text } = await documentAt(picked);

    expect(status).toBe(200);
    expect(text).toContain(workBrowsing.story);
    expect(text).toContain(workBrowsing.workContainer);
    expect(text).not.toContain(workBrowsing.person);
    expect(text).not.toContain(workBrowsing.character);
    expect(text).not.toContain(workBrowsing.entityContainer);
    expect(text).toContain('<p class="text-muted-foreground text-sm">2 items</p>');
    expect(markedCurrentIn(text)).toStrictEqual([scope.name]);
    expect(markedCurrentIn(whole.text)).toStrictEqual(["Everything"]);
  });

  it("leaves the Catalogue narrowed to the same Group listing every kind in it", async () => {
    // THE CRITERION'S OTHER HALF: the Catalogue keeps showing every kind of
    // Item where work-browsing hides the entities, and a Group changes neither.
    // Picked from the Catalogue's own picker, so this is the page a reader
    // reaches rather than an address built here.
    const whole = await documentAt("/");

    const { text } = await documentAt(scopeLinked(whole.text, scope.name));

    for (const title of [
      workBrowsing.person,
      workBrowsing.character,
      workBrowsing.entityContainer,
      workBrowsing.workContainer,
      workBrowsing.story,
    ]) {
      expect(text).toContain(title);
    }
    expect(text).toContain('<p class="text-muted-foreground text-sm">5 items</p>');
  });

  it("says a Group that names nothing is not there, and offers work-browsing back", async () => {
    // ADR-0066: a parameter that is not an identity answers by what it names.
    // A deleted Group and a typo are the same fact here, and the way out is
    // THIS surface unnarrowed rather than the Catalogue's.
    for (const group of [crypto.randomUUID(), "doctor-who"]) {
      const { status, text } = await documentAt(`/works?group=${group}`);

      expect(status).toBe(200);
      expect(sectionIn(text, "no-such-group")).toContain('href="/works"');
      expect(() => sectionIn(text, "nothing-to-watch")).toThrow();
    }
  });
});

/**
 * AND WALKED, ON THE INSTANCE WHOSE GROUP IS LARGER THAN ONE PAGE (CNCORE-179's
 * fixture). Every Item that Group holds is a story, so work-browsing narrowed
 * to it is the Group entire -- and the Group is a strict part of that
 * instance's Works, so a walk that dropped the scope would arrive at Items it
 * does not hold. Nobody writes to it.
 */
describe("/works narrowed to a Group larger than one page", () => {
  const pagedBaseUrl = inject("pagedBaseUrl");
  const group = inject("pagedGroup");

  /** Where a narrowed page says it carries on, if it says so at all. */
  function carriesOnAt(text: string): string | undefined {
    return text.match(/href="(\/works\?[^"]*after=[^"]+)"/)?.[1];
  }

  it("walks the whole Group by following links, and keeps the scope on every one", async () => {
    // THE CATALOGUE'S OWN WALK WITHIN A GROUP, ON THIS SURFACE. The oracle is
    // the fixture's list of what it put in the Group, and every page past the
    // first sends a reader back to the start of the GROUP's Works rather than
    // of everybody's.
    const first = scopeLinked((await documentFrom(pagedBaseUrl, "/works")).text, group.name);
    const firstPage = await documentFrom(pagedBaseUrl, first);
    expect(firstPage.text).toContain(
      `<p class="text-muted-foreground text-sm">Showing 100 of ${group.holds.length} items</p>`,
    );
    const walked: string[] = [];
    let path: string | undefined = first;
    for (let pages = 0; pages <= group.holds.length; pages += 1) {
      const { status, text } = await documentFrom(pagedBaseUrl, path);
      expect(status).toBe(200);
      walked.push(...itemsLinkedFrom(text));
      if (pages > 0) {
        expect(text).toContain(`href="${first}">Back to the start</a>`);
      }
      path = carriesOnAt(text);
      if (path === undefined) {
        expect([...walked].sort()).toStrictEqual([...group.holds].sort());
        expect(new Set(walked).size).toBe(walked.length);
        return;
      }
      // THE GROUP, THEN WHERE IN IT (ADR-0066), as on the Catalogue.
      expect(path).toMatch(new RegExp(`^/works\\?group=${group.id}&after=`));
    }
    throw new Error(`the walk never ended: ${walked.length} of ${group.holds.length} Items`);
  });

  it("offers work-browsing back unnarrowed, from the narrowed page itself", async () => {
    // NARROWING IS NOT A TRAP (story 44), on this surface as on the Catalogue:
    // `Everything` is the plain address, and following it marks no Group.
    const narrowed = await documentFrom(pagedBaseUrl, `/works?group=${group.id}`);
    const everything = scopeLinked(narrowed.text, "Everything");

    const cleared = await documentFrom(pagedBaseUrl, everything);

    expect(everything).toBe("/works");
    expect(markedCurrentIn(cleared.text)).toStrictEqual(["Everything"]);
  });

  it("says a Group with nothing to watch in it says so, by the Group's name", async () => {
    // AN EMPTY SCOPE LOOKS EXACTLY LIKE A BROKEN ONE until the page says which
    // it is (story 48) -- and on this surface "nothing to watch" is the
    // sentence, since a Group holding only People is empty here and full on the
    // Catalogue.
    const empty = inject("pagedEmptyGroup");

    const { status, text } = await documentFrom(pagedBaseUrl, `/works?group=${empty.id}`);

    expect(status).toBe(200);
    expect(sectionIn(text, "nothing-to-watch")).toContain(empty.name);
    expect(() => sectionIn(text, "no-such-group")).toThrow();
  });
});
