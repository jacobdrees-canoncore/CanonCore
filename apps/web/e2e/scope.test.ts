import type { AppRouterClient } from "@canoncore/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { describe, expect, inject, it } from "vitest";

import {
  documentAt,
  documentFrom,
  logInAt,
  mainOf,
  markedCurrentIn,
  navigatingFormsIn,
  scopeLinked,
  steadyMainOf,
} from "./document";

/**
 * THE SCOPE IN THE ADDRESS (CNCORE-181), over real HTTP: what a reader picked
 * survives a reload and travels in a link somebody else opens, and an Item it
 * leads to is still one Item at one address.
 *
 * ON THE SEEDED INSTANCE, whose story sits in two Groups: `workBrowsing`'s,
 * and one that holds it and nothing else. Nobody writes to either.
 */
const workBrowsing = inject("workBrowsing");

/**
 * THE RPC SURFACE ASKED AS THE OWNER, for `aGroupArrives` below alone.
 * `group.create` is an `ownerProcedure`, so a client with no session would
 * answer `Unauthorized` and create nothing -- and an adversary that created
 * nothing leaves the comparison below passing for the wrong reason.
 */
const asTheOwner: AppRouterClient = createORPCClient(
  new RPCLink({
    url: `${inject("baseUrl")}/api/rpc`,
    headers: { cookie: await logInAt(inject("baseUrl"), inject("ownerPassword")) },
  }),
);

/**
 * ONE GROUP, ARRIVING WHILE A COMPARISON IS HALF-MADE (CNCORE-253).
 *
 * `NarrowToAGroup` renders every Group there is, uncapped, inside the `<main>`
 * this test compares byte-for-byte -- and `import-page.test.ts` creates three
 * on this same instance from its own worker. That made the comparison below a
 * bet on timing. This takes the bet away by forcing it: the page is fetched,
 * a Group arrives, the page is fetched again.
 */
async function aGroupArrives(): Promise<void> {
  await asTheOwner.group.create({ name: `A Group that arrived mid-read ${crypto.randomUUID()}` });
}

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

      await aGroupArrives();
      const reloaded = await documentAt(picked, owner);
      const shared = await documentAt(picked);

      expect(reloaded.status).toBe(200);
      expect(shared.status).toBe(200);
      expect(steadyMainOf(reloaded.text)).toBe(steadyMainOf(seen.text));
      expect(steadyMainOf(shared.text)).toBe(steadyMainOf(seen.text));
      /*
       * AND THE SCOPE IS STILL THE ONE THE ADDRESS NAMES, for all three. This
       * is what the byte comparison used to cover about the picker and
       * `steadyMainOf` no longer does: a scope held in a session would mark
       * nothing current for the reader who has none.
       */
      expect(markedCurrentIn(reloaded.text), picked).toStrictEqual([workBrowsing.group.name]);
      expect(markedCurrentIn(shared.text), picked).toStrictEqual([workBrowsing.group.name]);
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

/**
 * EVERY NON-IDENTIFYING PARAMETER, IN THE ONE ORDER ADR-0066 WRITES THEM:
 * `via` and `placed` on an Item's page and `q` and `group` on a Listing's --
 * what the page is asked -- then the Members cursor and the "Also appears in"
 * one, and behind them the three CNCORE-174 appended: the letter a Listing was
 * jumped to, and each Listing's step back -- and beside the Group, the kind a
 * Listing is narrowed to and the order it is read in (CNCORE-175), which go
 * where the narrowing already is and ahead of every cursor. Behind those,
 * `/import`'s own three: the Provider, the Container and the record. Written
 * out here rather than imported, because a test that read the order off the
 * code would agree with whatever the code said.
 */
const IN_THE_ONE_ORDER = [
  "via",
  "placed",
  "q",
  "group",
  "kind",
  "order",
  // AND `/import`'s OWN THREE, which never share a link with the narrowing
  // above -- `provider` and `container` from CNCORE-187, `record` from
  // CNCORE-239, when the way to a record's Container began carrying the search
  // that found it and one form came to write four parameters at once.
  "provider",
  "container",
  "record",
  "after",
  "placedAfter",
  "letter",
  "before",
  "placedBefore",
];

/** Every address one page sends a reader to with a query: its links and its forms. */
function queriedFrom(text: string): string[] {
  // ANCHORS ONLY: the favicon's `<link>` carries a query of Next's own, which
  // is a cache key rather than anything a reader is sent to.
  const links = [...text.matchAll(/<a\b[^>]*\bhref="(\/[^"]*\?[^"]*)"/g)].map(
    ([, href]) => href as string,
  );
  const forms = navigatingFormsIn(text)
    .filter(({ fields }) => fields.length > 1)
    .map(({ action, fields }) => `${action}?${new URLSearchParams(fields)}`);
  return [...links, ...forms];
}

describe("a link carrying several parameters", () => {
  it("writes them in the one fixed order, on every surface that writes more than one", async () => {
    // ONE PAGE, ONE ADDRESS (ADR-0066). The order was held in two shapes until
    // CNCORE-181 -- the Listings by the slots their walk spread, the Item page
    // by an array of its own four -- so one of them could have moved without
    // the other. This reads every link the surfaces emit where more than one
    // parameter meets, against the one order.
    const pagedBaseUrl = inject("pagedBaseUrl");
    const group = inject("pagedGroup").id;
    const container = inject("pagedContainer").id;
    const member = inject("pagedContainer").holds[99];
    const appearsIn = inject("pagedAppearsIn").id;
    const surfaces = [
      `/?group=${group}`,
      `/works?group=${group}`,
      `/search?q=story&group=${group}`,
      // NOT A LISTING, AND IT WRITES THE SAME TWO (CNCORE-182): a Group
      // decides which Providers `/import` asks, through the same picker.
      `/import?q=story&group=${group}`,
      `/items/${container}?via=nothing-at-all&placed=owner&placedAfter=nothing-either`,
      `/items/${appearsIn}?via=nothing-at-all&placed=owner&after=nothing-either`,
      // THE STEP BACKS AND THE LETTER (CNCORE-174), where each is written
      // BESIDE something: a jump to T lands past every story in this Group, so
      // its page offers Previous with the Group on it, and a second page of
      // Members offers Previous beside "Also appears in"'s own cursor.
      `/?group=${group}&letter=T`,
      `/items/${container}?via=nothing-at-all&placed=owner&after=${member}&placedAfter=nothing-either`,
    ];

    for (const surface of surfaces) {
      const { status, text } = await documentFrom(pagedBaseUrl, surface);
      expect(status).toBe(200);

      const written = queriedFrom(text).map((address) => [
        ...new URLSearchParams(address.slice(address.indexOf("?") + 1)).keys(),
      ]);
      // NOT VACUOUS: every surface here writes at least one address carrying
      // two parameters or more, which is where an order can be wrong at all.
      expect(
        written.some((names) => names.length > 1),
        surface,
      ).toBe(true);
      for (const names of written) {
        expect(names, surface).toStrictEqual(
          IN_THE_ONE_ORDER.filter((name) => names.includes(name)),
        );
      }
    }
  });
});
