import type { AppRouterClient } from "@canoncore/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { describe, expect, inject, it } from "vitest";

import { documentAt, documentFrom } from "./document";

/**
 * THE FRONT PAGE, over real HTTP. ADR-0103's fourth seam, which is the one
 * CNCORE-65 names: a page-over-HTTP assertion and no browser, because
 * everything this page renders is in the HTML the server returns.
 */
const itemId = inject("itemId");
const itemTitle = inject("itemTitle");
/**
 * THE SECOND SERVER: the same build, an empty database, and no
 * `PROVIDER_ALLOWLIST`. That is what a stranger's first run of CanonCore
 * actually is (ADR-0094), and neither state exists on the seeded instance
 * above -- so without it the two criteria below could only be asserted a layer
 * down from the page that has to satisfy them.
 */
const freshBaseUrl = inject("freshBaseUrl");

/** One `<section>` of a page, by the heading it is labelled with. */
function section(text: string, label: string): string {
  const found = text.match(new RegExp(`<section[^>]*aria-labelledby="${label}".*?</section>`))?.[0];
  if (!found) throw new Error(`the page rendered no \`${label}\` section`);
  return found;
}

describe("/", () => {
  it("shows the catalogue", async () => {
    const { status, text } = await documentAt("/");

    expect(status).toBe(200);
    expect(text).toContain(itemTitle);
  });

  it("says how much the catalogue holds", async () => {
    // NO SILENT CAP. The listing is capped at a page, so a page that reported
    // only what it had listed would tell an owner their library is smaller than
    // it is -- the one thing a catalogue must not get wrong about itself.
    //
    // WHAT THIS PROVES IS THE NUMBER, NOT THE CAP. This database holds fewer
    // items than a page, so "how many there are" and "how many are listed" are
    // the same number here and no assertion made against it can tell them
    // apart. Seeding a hundred and one to separate them would push the seeded
    // item off the first page and take the test above down with it. THE CAP
    // ITSELF IS PROVED WHERE IT CAN BE: `readCatalogue` is asked for one entry
    // out of many and has to answer with the size of the whole catalogue
    // (`packages/db/src/catalogue.test.ts`), and the router refuses a limit
    // above a page (`packages/api/src/routers/catalogue.test.ts`).
    //
    // The count is read off the page and compared against the router's own
    // answer over HTTP, rather than against a number written here: a literal
    // would have to be revised every time this suite seeds another fixture, and
    // would be revised to whatever the page happened to say.
    const client: AppRouterClient = createORPCClient(
      new RPCLink({ url: `${inject("baseUrl")}/api/rpc` }),
    );
    const { total } = await client.catalogue.list({});

    const { text } = await documentAt("/");

    expect(text).toContain(`${total} items`);
  });

  it("carries the product's own name, not the scaffold's placeholder", async () => {
    // ADR-0058 settles the name and ADR-0053 says to own the generator's output
    // rather than keep it. `create-better-t-stack` left `title: "canoncore"` in
    // the layout and an ASCII banner on this page; a tab reading `canoncore`
    // beside a heading reading CanonCore is the scaffold showing through.
    const { text } = await documentAt("/");

    expect(text).toContain("<title>CanonCore</title>");
    // The banner the generator ships, and the health-check panel under it.
    expect(text).not.toContain("BETTER T STACK");
    expect(text).not.toContain("API Status");
  });

  it("reaches an item at the address every other surface reaches it at", async () => {
    // THE PATH IS IDENTITY (ADR-0066), so the front page's link has to BE the
    // item's canonical address rather than a second spelling of it -- no
    // `?via=`, which names the ORDERING a reader arrived through and would be a
    // claim this page cannot make: nobody arrives at an item through the
    // catalogue in the sense a placement means.
    //
    // CHECKED AGAINST WHAT THE ITEM PAGE ITSELF DECLARES rather than against a
    // string written here. A constant in this file would agree with a front page
    // and an item page that had BOTH drifted; the page's own `rel=canonical` is
    // the other surface's answer to the same question.
    const { text } = await documentAt("/");
    const linked = [...text.matchAll(/href="(\/items\/[^"?]*)"/g)]
      .map(([, href]) => href)
      .find((href) => href?.endsWith(itemId));
    if (!linked) throw new Error(`the front page linked nothing at /items/${itemId}`);

    const arrived = await documentAt(linked);

    expect(arrived.status).toBe(200);
    expect(arrived.text).toContain(`<link rel="canonical" href="${linked}"/>`);
    expect(arrived.text).toContain(`<h1 class="text-3xl font-medium">${itemTitle}</h1>`);
  });
});

describe("/ on a fresh install", () => {
  it("says the catalogue is empty, and names the two steps that fill it", async () => {
    // ADR-0094 ships no catalogue to a stranger and is explicit that this is
    // only half the decision: "an install that starts empty WITHOUT SAYING WHAT
    // TO DO NEXT is a separate failure this record does not licence". Two
    // shards of the competitor sweep rated that first run HIGH. This is it
    // closed -- words on a page, not rows in a database.
    const { status, text } = await documentFrom(freshBaseUrl, "/");

    expect(status).toBe(200);
    const next = section(text, "what-to-do-next");
    // THE VARIABLE BY ITS OWN NAME. "Allowlist a provider" is the step; the
    // thing an owner has to type is the identifier, and a page that gestured at
    // the step without naming it would leave them where the README left them.
    expect(next).toContain("PROVIDER_ALLOWLIST");
    expect(next.toLowerCase()).toContain("import");
  });

  it("says no provider is allowlisted, where one is not", async () => {
    // ADR-0034's allowlist is empty by default and refuses every provider, so
    // an unconfigured instance and a broken one look identical from a page.
    const fresh = await documentFrom(freshBaseUrl, "/");

    expect(() => section(fresh.text, "no-provider")).not.toThrow();
  });

  it("does not say it where a provider IS allowlisted", async () => {
    // The other half, and the half that makes the one above a test: a page that
    // printed the notice unconditionally would pass that one and fail this.
    const seeded = await documentAt("/");

    expect(() => section(seeded.text, "no-provider")).toThrow();
  });
});
