import { describe, expect, inject, it } from "vitest";

import { documentAt } from "./document";

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

/** Just the "Members" section, so an assertion cannot match the rest of the page. */
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
    // The criterion, and the fixture is a REAL BROWSE: `provider.browse` wrote
    // these placements through the app, so the order asserted is the order a
    // provider actually gave rather than one this suite arranged.
    const { status, text } = await documentAt(`/items/${browsed.importedContainerId}`);

    expect(status).toBe(200);
    const rows = memberRows(text);
    expect(rows.length).toBeGreaterThan(1);
    // POSITIONS ASCENDING, read off the rendered rows. Asserting only that the
    // titles are present would pass against any order at all, which is the one
    // thing this test is about.
    const positions = rows.flatMap((row) => {
      const seen = row.match(/#(\d+)/);
      return seen?.[1] === undefined ? [] : [Number(seen[1])];
    });
    expect(positions).toStrictEqual([...positions].sort((a, b) => a - b));
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
