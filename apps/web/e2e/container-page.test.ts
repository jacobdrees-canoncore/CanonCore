import { describe, expect, inject, it } from "vitest";

import { documentAt, documentFrom } from "./document";

/**
 * BROWSING INTO A CONTAINER, over real HTTP.
 *
 * A Container IS an Item (ADR-0004), so its page is `/items/<id>` and there is
 * no second address for it: ADR-0066 makes the path identity, and a `/works/<id>`
 * would be one thing at two addresses. What the Item page gains is the MIRROR of
 * the list it already had -- "Also appears in" is every ordering this item sits
 * IN, and this is every item this ordering HOLDS.
 */
const browsed = inject("browsed");
const workBrowsing = inject("workBrowsing");

/**
 * Just the "Members" section, so an assertion cannot match the rest of the page.
 *
 * IT STOPS AT THE FIRST `</section>`, which matters on ONE page: past the end of
 * the walk the listing renders `PastTheEnd`, whose own `<section>` is nested
 * inside this one -- so what comes back there is the heading down to the end of
 * that notice, and the `Walk` below it is outside. Every assertion made on that
 * page is about the notice, so this is a limit to know rather than a fault; an
 * assertion about the walk on a past-the-end page would need the whole section.
 */
function members(text: string): string {
  const found = text.match(/<section[^>]*aria-labelledby="members".*?<\/section>/)?.[0];
  if (!found) throw new Error("the page rendered no `members` section");
  return found;
}

/** The rows of that list, one string each, so an assertion can ask WHICH row. */
function memberRows(text: string): string[] {
  return members(text).match(/<li[^>]*>.*?<\/li>/g) ?? [];
}

describe("/items/<a container>", () => {
  it("lists what the container holds, in position order", async () => {
    // The criterion, asserted against a container whose members were WRITTEN OUT
    // OF ORDER -- third, first, second.
    //
    // THAT IS THE HALF THAT MAKES IT A TEST, and the first version of it did not
    // have it. It asked a browsed container, whose members were inserted in the
    // order the provider handed them over, so PostgreSQL returned them correctly
    // ordered from a query with no `order by` at all. Measured: removing the
    // `orderBy` from `findPlacementsInContainer` left that assertion passing, and
    // only reversing the sort could fail it. This one fails against both.
    const { status, text } = await documentAt(`/items/${workBrowsing.workContainerId}`);

    expect(status).toBe(200);
    const rows = memberRows(text);
    const titles = workBrowsing.inPositionOrder.map((title) =>
      rows.findIndex((row) => row.includes(title)),
    );
    expect(titles).not.toContain(-1);
    expect(titles).toStrictEqual([...titles].sort((a, b) => a - b));
    // AND THE POSITIONS THEMSELVES ASCEND, so a page that happened to render the
    // right titles in the right order while printing the wrong numbers beside
    // them is not passing this either.
    const positions = rows.flatMap((row) => {
      const seen = row.match(/#(\d+)/);
      return seen?.[1] === undefined ? [] : [Number(seen[1])];
    });
    expect(positions).toStrictEqual([1, 2, 3]);
  });

  it("lists a REAL browsed ordering too, in the order the provider gave it", async () => {
    // The fixture above is hand-seeded so that it can be written out of order.
    // This one is a real `provider.browse` through the app, which is what says
    // the surface works on an ordering nobody arranged for it.
    const { status, text } = await documentAt(`/items/${browsed.importedContainerId}`);

    expect(status).toBe(200);
    expect(memberRows(text).length).toBeGreaterThan(1);
    expect(members(text)).toContain(browsed.title);
  });

  it("shows a member it cannot place as unplaced, rather than hiding or ordering it", async () => {
    // CONTEXT.md's Unplaced, in its own words: "The reader's words are 'no
    // position given'", and it is "a PLACEMENT WITH NO POSITION, never an absent
    // placement". Both halves are asserted, because dropping the row and
    // numbering it last are the two wrong answers and only one of them is
    // visible in a count.
    //
    // A REAL BROWSE PRODUCED THIS. The wiki's ordering is release order and the
    // archive holds no release date for this story, so the provider placed it
    // without saying where -- which is a sixth of the archive's stories rather
    // than a corner case this suite invented.
    const { text } = await documentAt(`/items/${browsed.unplacedInId}`);

    const unplaced = memberRows(text).filter((row) => row.includes("No position given"));
    expect(unplaced).toHaveLength(1);
    // AND IT IS STILL A LINK TO THE ITEM, which is what "still a member" means
    // on a page: a row rendered as inert text would be the absence of a position
    // quietly becoming the absence of a membership.
    expect(unplaced[0]).toContain(`/items/${browsed.unplaced}`);
  });

  it("renders a repeat twice, once at each position", async () => {
    // ADR-0009 licences it and CONTEXT.md names it: "a recap at position 1 and
    // the episode at position 5 are one item, twice, on purpose". `duplicate` is
    // banned for exactly this, because collapsing the two is the mistake.
    const { text } = await documentAt(`/items/${workBrowsing.withARecapId}`);

    const rows = memberRows(text).filter((row) => row.includes(workBrowsing.repeated));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("#1");
    expect(rows[1]).toContain("#5");
  });

  it("carries the ordering a reader arrived through into the item page", async () => {
    // ADR-0066: the path is identity and the QUERY is the route. The member link
    // carries `?via=<placement-id>`, and the item page marks that ordering --
    // so the container survives a refresh and a shared link, which is the whole
    // reason the record put it in the URL rather than in client memory.
    //
    // THE LINK IS FOLLOWED RATHER THAN CONSTRUCTED. A `via` written here would
    // pass against a container page that emitted a different one, or none: what
    // is under test is that the two surfaces agree.
    const container = await documentAt(`/items/${workBrowsing.withARecapId}`);
    const recap = memberRows(container.text)[0];
    const href = recap?.match(/href="([^"]*\/items\/[^"]*via=[^"]*)"/)?.[1];
    if (!href) throw new Error("the members list linked nothing carrying a `via`");

    const arrived = await documentAt(href.replaceAll("&amp;", "&"));

    expect(arrived.status).toBe(200);
    expect(arrived.text).toContain("Arrived through");
    // AND THE PATH IS STILL THE IDENTITY. `via` identifies nothing, so the
    // canonical the page declares is the bare address -- which is what makes
    // two routes to one item one page rather than two (RFC 6596, ADR-0066).
    expect(arrived.text).toContain(
      `<link rel="canonical" href="/items/${workBrowsing.repeatedId}"/>`,
    );
  });
});

describe("/items/<a container holding more than one page>", () => {
  const pagedBaseUrl = inject("pagedBaseUrl");
  const container = inject("pagedContainer");

  /**
   * Every member one rendered page links at: the PLACEMENT each link names.
   *
   * OFF THE ROWS RATHER THAN OFF THE SECTION, which is a fix rather than a
   * tidy-up. The walk's own `Next` href lives in this section too and carries
   * the page's `?via=` forward, so a scan of the whole section collected that
   * one as though it were a member -- and the composition test below then
   * asserted its cursor against it, which is a test marking its own work.
   */
  function membersLinkedFrom(text: string): string[] {
    return memberRows(text).flatMap((row) => {
      const named = row.match(/href="\/items\/[^"]*via=([^"&]+)/)?.[1];
      return named === undefined ? [] : [named];
    });
  }

  /** Where the page says the ordering carries on, if it says so at all. */
  function carriesOnAt(text: string): string | undefined {
    return members(text)
      .match(/href="(\/items\/[^"]*after=[^"]*)"/)?.[1]
      ?.replaceAll("&amp;", "&");
  }

  it("still shows one page at a time, and says how much it is not showing", async () => {
    // THE CAP, WHICH WAS MISSING HERE ALONE. ADR-0119's first sentence is that
    // every listing in CanonCore is capped, and this one took no limit at all:
    // `browse` imports a whole category in one call and ADR-0077 measures one at
    // 1,049 stories, so an ordinary imported Container rendered a thousand rows.
    const { status, text } = await documentFrom(pagedBaseUrl, `/items/${container.id}`);

    expect(status).toBe(200);
    expect(membersLinkedFrom(text)).toHaveLength(100);
    expect(members(text)).toContain(`Showing 100 of ${container.holds.length} members`);
  });

  it("reaches every member by following links, and lands on none of them twice", async () => {
    // THE OTHER HALF OF THE CAP, at the seam CNCORE-89 names by hand: a surface
    // that says "Showing 100 of 254" and offers no way to reach member 101 has
    // told the owner the size of an ordering it will not let them see.
    //
    // THE ORACLE IS THE PLACEMENTS THE HARNESS WROTE rather than a second
    // reading of the container: a cursor that lost the Unplaced tail would lose
    // it from both sides and the two readings would agree.
    //
    // AND THE WALK IS OVER PLACEMENTS RATHER THAN ITEMS, which is what the
    // Repeat in the fixture is for: one item sits in this ordering twice, so the
    // ids collected here can only come out right if each link names the
    // PLACEMENT it was reached through (ADR-0009, ADR-0066).
    const walked: string[] = [];
    let path: string | undefined = `/items/${container.id}`;
    // BOUNDED, so a cursor that does not advance FAILS rather than hangs.
    for (let pages = 0; pages <= container.holds.length; pages += 1) {
      const { status, text } = await documentFrom(pagedBaseUrl, path);
      expect(status).toBe(200);
      walked.push(...membersLinkedFrom(text));
      const next: string | undefined = carriesOnAt(text);
      if (next === undefined) {
        expect([...walked].sort()).toStrictEqual([...container.holds].sort());
        // SORTED SETS COMPARE EQUAL EVEN WITH A REPEAT IN THEM, so the one
        // criterion the comparison above cannot see gets its own line.
        expect(new Set(walked).size).toBe(walked.length);
        return;
      }
      path = next;
    }
    throw new Error(`the walk never ended: ${walked.length} of ${container.holds.length}`);
  });

  it("keeps the cursor out of the canonical, and composes it with `via` and `placed`", async () => {
    // ADR-0066: the PATH is identity and the QUERY is the route. A third
    // non-identifying parameter has to compose with the two already there, in
    // ONE fixed spelling order so a narrowed list at a given page is one URL
    // rather than several -- and it must leave the canonical alone, because that
    // declaration is what makes every route to this container one page.
    const { text } = await documentFrom(
      pagedBaseUrl,
      `/items/${container.id}?placed=owner&via=nothing-at-all`,
    );

    const next = carriesOnAt(text);
    if (next === undefined) throw new Error("the members list offered no next page");
    expect(next).toBe(
      `/items/${container.id}?via=nothing-at-all&placed=owner&after=${membersLinkedFrom(text).at(
        -1,
      )}`,
    );
    expect(text).toContain(`<link rel="canonical" href="/items/${container.id}"/>`);
  });

  it("offers a way back to the start from every page but the first", async () => {
    // A FORWARD WALK STRANDS A DEEP LINK (ADR-0119): somebody handed page two in
    // a message has no history to go back through, and `Previous` is a second
    // query shape rather than half of this one.
    const first = await documentFrom(pagedBaseUrl, `/items/${container.id}`);
    const next = carriesOnAt(first.text);
    if (next === undefined) throw new Error("the fixture's members fit on one page");

    const second = await documentFrom(pagedBaseUrl, next);

    expect(members(second.text)).toContain("Back to the start");
    // AND NOT ON THE FIRST PAGE, which is the half that makes the line above a
    // test: a page printing it unconditionally would satisfy that and fail this.
    expect(members(first.text)).not.toContain("Back to the start");
  });

  it("says the ordering ends here, where a link outlived the members after it", async () => {
    // THE ONE DEAD END A CURSOR CREATES. `continuesAfter` is handed over only
    // when there is a row past the page, so a link FOLLOWED never lands here --
    // but a link KEPT can. Without this the reader gets a heading and an empty
    // list, which reads as a section that failed to load.
    let text = (await documentFrom(pagedBaseUrl, `/items/${container.id}`)).text;
    for (let pages = 0; pages < 10; pages += 1) {
      const next = carriesOnAt(text);
      if (next === undefined) break;
      text = (await documentFrom(pagedBaseUrl, next)).text;
    }
    const last = membersLinkedFrom(text).at(-1);

    const beyond = await documentFrom(pagedBaseUrl, `/items/${container.id}?after=${last}`);

    expect(beyond.status).toBe(200);
    // THE WAY OUT, not merely the notice. A section that said the ordering ended
    // and offered nothing to click is the same dead end with a caption on it.
    expect(members(beyond.text)).toContain(`href="/items/${container.id}"`);
    expect(members(beyond.text)).toContain("end here");
  });
});
