import { describe, expect, inject, it } from "vitest";

import { documentAt, logInAt, mainOf, markedCurrentIn, scopeLinked } from "./document";

/**
 * THE SCOPE IN THE ADDRESS (CNCORE-181), over real HTTP: what a reader picked
 * survives a reload and travels in a link somebody else opens, and an Item it
 * leads to is still one Item at one address.
 *
 * ON THE SEEDED INSTANCE, whose story sits in two Groups: `workBrowsing`'s,
 * and one that holds it and nothing else. Nobody writes to either.
 */
const workBrowsing = inject("workBrowsing");

/** Where a page links one Item, query and all, wherever on the page it does. */
function linksTo(text: string, itemId: string): string[] {
  return [...mainOf(text).matchAll(new RegExp(`href="(/items/${itemId}[^"]*)"`, "g"))].map(
    ([, href]) => href as string,
  );
}

describe("a Group the Owner picked", () => {
  it("survives a reload, and a link to it opens the same page for anybody", async () => {
    // THE SCOPE LIVES IN THE ADDRESS AND NOWHERE ELSE, so the Owner asking it
    // again and a reader with no session opening it are served the page the
    // Owner picked. A scope held in a session, or in a script's memory, would
    // pass the first half and fail the second -- and the page-over-HTTP reader
    // runs no script, so what it is served is what a reload shows.
    const owner = await logInAt(inject("baseUrl"), inject("ownerPassword"));

    for (const surface of ["/", "/works", "/search?q=season"]) {
      const picked = scopeLinked((await documentAt(surface, owner)).text, workBrowsing.group.name);
      const seen = await documentAt(picked, owner);
      expect(markedCurrentIn(seen.text), picked).toStrictEqual([workBrowsing.group.name]);

      const reloaded = await documentAt(picked, owner);
      const shared = await documentAt(picked);

      expect(reloaded.status).toBe(200);
      expect(shared.status).toBe(200);
      expect(mainOf(reloaded.text)).toBe(mainOf(seen.text));
      expect(mainOf(shared.text)).toBe(mainOf(seen.text));
    }
  });
});

describe("an Item reached through a Group", () => {
  it("is linked at its own address whichever Group it was reached through", async () => {
    // ADR-0066: THE PATH IS IDENTITY. An Item in two universes reached through
    // either is one Item, so every narrowed Listing links it at the same bare
    // address -- a Group in the path or the query of that link would give it
    // one address per Group, which is what the canonical link exists to
    // collapse and what this ticket's criterion forbids outright.
    const story = workBrowsing.storyId;
    const reachedFrom = [workBrowsing.group, workBrowsing.crossover].flatMap(({ id }) => [
      `/?group=${id}`,
      `/works?group=${id}`,
      `/search?q=season&group=${id}`,
    ]);

    const linked = new Set<string>();
    for (const path of reachedFrom) {
      const { status, text } = await documentAt(path);
      expect(status).toBe(200);
      const links = linksTo(text, story);
      expect(links, path).not.toStrictEqual([]);
      for (const link of links) linked.add(link);
    }

    expect([...linked]).toStrictEqual([`/items/${story}`]);
    const followed = await documentAt(`/items/${story}`);
    expect(followed.status).toBe(200);
    expect(followed.text).toContain(`<link rel="canonical" href="/items/${story}"/>`);
  });
});
