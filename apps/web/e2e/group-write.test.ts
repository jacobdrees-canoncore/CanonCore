import { describe, expect, inject, it } from "vitest";

import {
  documentFrom,
  formIn,
  linkedIn,
  logInAt,
  navigatingFormsIn,
  postFormsIn,
  scopeLinked,
  sectionIn,
  submit,
  textOf,
  withFields,
} from "./document";

/**
 * DRAWING, NAMING AND FILLING A BROWSING SCOPE (CNCORE-178), at ADR-0103's
 * fourth seam.
 *
 * NO BROWSER, for `item-write.test.ts`'s reason and on the same terms: every
 * control these surfaces carry is a native `<form>` bound to a Server Action,
 * which posts as an ordinary `multipart/form-data` request when no script has
 * loaded. Replaying the form the server just rendered observes exactly what a
 * browser with JavaScript switched off observes.
 *
 * ON AN INSTANCE OF ITS OWN, and a Group needs that harder than a title does. A
 * scope is a CATALOGUE-WIDE fact: `/groups` renders every Group on the
 * instance, so a second file drawing one would change what this file's page
 * shows -- where an edited title changes only the item that was edited.
 *
 * THIS FILE MAKES EVERY GROUP IT READS, and nothing is seeded. A seeded scope
 * would let the list assertions pass over a create form that had stopped
 * working, which is the failure this suite exists to catch.
 */
const baseUrl = inject("scopableBaseUrl");
const scopable = inject("scopable");

/**
 * THE OWNER, LOGGED IN, as a cookie this file sends back.
 *
 * EVERY CONTROL BELOW IS THE OWNER'S (ADR-0044, CNCORE-109). What a visitor is
 * served instead is asserted at the bottom of this file, because "the demo is
 * read-only" is a claim about these pages rather than about the router under
 * them.
 */
const owner = await logInAt(baseUrl, inject("ownerPassword"));

/** One page of this file's own instance. */
function documentAt(path: string, cookie?: string) {
  return documentFrom(baseUrl, path, cookie);
}

/** One page's HTML, as the Owner is served it. */
async function pageText(path: string): Promise<string> {
  return (await documentAt(path, owner)).text;
}

/**
 * THE OPENING TAGS BEFORE A NAME'S WORDS BEGIN, which since CNCORE-223 are the
 * span `TheirWords` prints it in. Skipped rather than spelled out, so the
 * readers here assert the name a reader sees and not how wide it may run.
 */
const OPENING_TAGS = "(?:<[a-z][^>]*>)*";

/**
 * The scopes a stretch of a page names, in the order it renders them.
 *
 * READ OUT OF A SECTION rather than off the whole document, because the header
 * carries the word Groups too -- and a reader that counted that would pass on a
 * page whose list had gone.
 */
function scopesIn(text: string): string[] {
  return [
    ...text.matchAll(new RegExp(`data-group-id="[^"]*"[^>]*>${OPENING_TAGS}([^<]*)<`, "g")),
  ].map((found) => found[1]?.trim() ?? "");
}

/**
 * A scope's name as a regex LITERAL, for the two readers below that build a
 * pattern from one.
 *
 * ESCAPED RATHER THAN INTERPOLATED RAW, which review asked for. Every name this
 * file uses is one it wrote itself and none carries a metacharacter, so nothing
 * is broken today -- and the day one carries a bracket, the failure is a
 * pattern that quietly matches the wrong row rather than an error that says so.
 */
function literal(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The id a page gives a scope, READ OFF THE PAGE rather than kept from the
 * write that made it.
 *
 * WHICH IS WHAT A BROWSER HAS. An id this file remembered would assert against
 * the write path rather than against what the page actually renders -- and the
 * Item page's form offers the scopes by id, so the id being on the page is part
 * of what is under test.
 */
function idOfScope(text: string, name: string): string {
  const found = new RegExp(
    `data-group-id="([^"]+)"[^>]*>${OPENING_TAGS}\\s*${literal(name)}\\s*<`,
  ).exec(text);
  if (!found?.[1]) throw new Error(`no scope called ${name} is named on this page`);
  return found[1];
}

/** Draws a scope through the page, and answers the page it was drawn onto. */
async function drawAScope(name: string): Promise<string> {
  const drawn = await submit(
    baseUrl,
    "/groups",
    withFields(formIn(await pageText("/groups"), "draw-a-group"), { name }),
    owner,
  );
  return drawn.text;
}

/**
 * The id of a scope by that name, drawing one only if the page does not already
 * carry it.
 *
 * FIND-OR-DRAW, WHICH THE MODEL MAKES NECESSARY RATHER THAN CONVENIENT. Nothing
 * stops the Owner calling two scopes the same thing -- `groups` carries no
 * unique index on `name`, deliberately -- so a helper that always drew would
 * leave two rows with one name and no way for this file to say which it meant.
 * Each test below therefore sets up what it needs without depending on which of
 * its neighbours has run.
 */
async function aScopeCalled(name: string): Promise<string> {
  const listed = sectionIn(await pageText("/groups"), "groups");
  if (
    new RegExp(`data-group-id="[^"]*"[^>]*>${OPENING_TAGS}\\s*${literal(name)}\\s*<`).test(listed)
  ) {
    return idOfScope(listed, name);
  }
  return idOfScope(sectionIn(await drawAScope(name), "groups"), name);
}

/** Puts one Item in one scope through the Item's own page. */
async function putInScope(itemId: string, groupId: string): Promise<string> {
  const at = `/items/${itemId}`;
  const put = await submit(
    baseUrl,
    at,
    withFields(formIn(await pageText(at), "put-in-a-group"), { groupId }),
    owner,
  );
  return put.text;
}

describe("the Groups page", () => {
  it("draws a scope the Owner has named, and lists it", async () => {
    // Stories 30 and 31: one catalogue holds several universes, and each reads
    // the way the Owner thinks of it.
    const listed = await drawAScope("Drawn and listed");

    expect(scopesIn(sectionIn(listed, "groups"))).toContain("Drawn and listed");
  });

  it("renames a scope, and the old name is gone from the page", async () => {
    // Story 32: a name chosen badly is not permanent.
    const drawn = await drawAScope("aaa Named badly");
    const id = idOfScope(drawn, "aaa Named badly");

    const renamed = await submit(
      baseUrl,
      "/groups",
      withFields(formIn(drawn, `rename-${id}`), { name: "aaa Named well" }),
      owner,
    );

    const scopes = scopesIn(sectionIn(renamed.text, "groups"));
    expect(scopes).toContain("aaa Named well");
    expect(scopes).not.toContain("aaa Named badly");
  });
});

describe("an Item's scopes, from its own page", () => {
  it("puts one Item in SEVERAL scopes, and the Item's page names them all", async () => {
    // ADR-0010'S CENTRAL CLAIM, on the surface a reader meets it (stories 36
    // and 38): a crossover belongs to both rather than being forced into one.
    const doctorWho = await aScopeCalled("bbb Doctor Who");
    const marvel = await aScopeCalled("bbb Marvel");

    const first = await putInScope(scopable.crossover, doctorWho);
    expect(scopesIn(sectionIn(first, "groups"))).toContain("bbb Doctor Who");

    const second = await putInScope(scopable.crossover, marvel);

    expect(scopesIn(sectionIn(second, "groups"))).toStrictEqual(["bbb Doctor Who", "bbb Marvel"]);
  });

  it("takes the Item out of one scope and leaves the other", async () => {
    // Story 37, and the half that makes it safe: correcting a mistake in one
    // scope is not correcting it in every scope.
    //
    // IT ARRANGES ITS OWN STATE rather than leaning on the test above, which
    // `group.put` being idempotent is what makes free: asking again for what is
    // already true writes nothing. A test that depended on a neighbour having
    // run would report that neighbour's failure as its own.
    const doctorWho = await aScopeCalled("bbb Doctor Who");
    const marvel = await aScopeCalled("bbb Marvel");
    await putInScope(scopable.crossover, doctorWho);
    const both = await putInScope(scopable.crossover, marvel);
    const at = `/items/${scopable.crossover}`;

    const after = await submit(baseUrl, at, formIn(both, `take-out-of-group-${marvel}`), owner);

    expect(scopesIn(sectionIn(after.text, "groups"))).toStrictEqual(["bbb Doctor Who"]);
  });

  it("says plainly when an Item is in no scope, rather than rendering nothing", async () => {
    // An absence a reader can SEE, which is the rule `CONTEXT.md` already
    // settles for Unplaced: a section rendered empty reads as a broken one.
    const page = await pageText(`/items/${scopable.loose}`);

    expect(sectionIn(page, "groups")).toContain("in no Group");
  });
});

/**
 * WHERE THE LIST'S DELETE BUTTON GOES, read off the page as a browser would
 * follow it: a navigating form's action, with its fields as the query.
 *
 * AND IT IS ONLY EVER A NAVIGATION. A `POST` form in that section would be a
 * delete one press away, which is the thing ADR-0046 refuses (CNCORE-210).
 */
function askedFrom(text: string, id: string): string {
  const section = sectionIn(text, `delete-${id}`);
  expect(postFormsIn(section)).toStrictEqual([]);
  const [asks] = navigatingFormsIn(section);
  if (!asks) throw new Error(`the \`delete-${id}\` section carries no form to follow`);
  return `${asks.action}?${new URLSearchParams(asks.fields)}`;
}

/**
 * How many of something the confirmation says the deletion takes, by the noun
 * it counts -- `removing` in `purge-page.test.ts`, for a Group.
 */
function taking(confirmation: string, noun: string): number {
  const found = new RegExp(`(\\d+)\\s+${noun}s?\\b`).exec(textOf(confirmation));
  if (!found) throw new Error(`the confirmation counted no ${noun}s:\n${confirmation}`);
  return Number(found[1]);
}

describe("deleting a scope", () => {
  /**
   * ONE TEST FOR THE WHOLE PATH, for the reason `purge-page.test.ts` gives its
   * confirm path one: a deletion is observed once. And the Items it counts are
   * this instance's only two, so a scope a first test had asked about and left
   * standing would still hold them when a second test said they were in none.
   */
  it("asks first, says what goes and that no Item does, and LEAVES ITS ITEMS ALONE", async () => {
    // THE COUNTS ARE THIS TEST'S OWN ARRANGEMENT rather than read off the
    // procedure: a scope nothing else touches, holding both Items and asking
    // one Provider.
    const id = await aScopeCalled("ccc A scope to delete");
    await putInScope(scopable.loose, id);
    await putInScope(scopable.crossover, id);
    await setAsking(id, providers.wiki.url, true);
    const at = askedFrom(await pageText("/groups"), id);

    const asked = await pageText(at);

    // ADR-0046: DELETE PERMANENTLY ASKS FIRST, and says what it costs.
    const confirmation = sectionIn(asked, "delete-group");
    expect(textOf(confirmation)).toContain("ccc A scope to delete");
    expect(taking(confirmation, "Group membership")).toBe(2);
    expect(taking(confirmation, "Provider")).toBe(1);
    expect(textOf(confirmation)).toContain("No Item is deleted");
    // CANCEL IS A PLAIN LINK BACK, so leaving costs nothing and is a choice
    // rather than a gesture -- and the one form is the deletion.
    expect(linkedIn(confirmation, "Cancel")).toBe("/groups");
    expect(postFormsIn(confirmation)).toHaveLength(1);
    // AND ASKING WAS NOT DELETING.
    expect(scopesIn(sectionIn(await pageText("/groups"), "groups"))).toContain(
      "ccc A scope to delete",
    );

    const deleted = await submit(baseUrl, at, formIn(asked, "delete-group"), owner);

    // ADR-0010'S PROMISE (story 34), asserted where the Owner would find out it
    // had been broken: the Item's own page, still rendering its title. THE
    // ITEM IS THE ONE NOTHING ELSE SCOPES, so "it is in no Group now" is a
    // claim about this deletion rather than about whatever else had put it
    // somewhere.
    // THE CONFIRMATION'S OWN ADDRESS IS THE REPORT: the scope is gone, so the
    // page it posted from renders the list without it.
    expect(() => sectionIn(deleted.text, "delete-group")).toThrow();
    expect(scopesIn(sectionIn(deleted.text, "groups"))).not.toContain("ccc A scope to delete");
    const item = await documentAt(`/items/${scopable.loose}`);
    expect(item.text).toContain(scopable.looseTitle);
    expect(sectionIn(item.text, "groups")).toContain("in no Group");
  });

  it("asks about a scope whose id is written in capitals, which is the same scope", async () => {
    // ONE GROUP, ONE ADDRESS (ADR-0066): `oneGroup`'s reason, on this page.
    const id = await aScopeCalled("ccc Asked about in capitals");

    const asked = await pageText(`/groups?delete=${id.toUpperCase()}`);

    expect(textOf(sectionIn(asked, "delete-group"))).toContain("ccc Asked about in capitals");
  });
});

/**
 * WHICH PROVIDERS A SCOPE ASKS (CNCORE-182, ADR-0025), chosen on `/groups` and
 * acted on by searching the Providers from `/import` within it.
 *
 * THIS INSTANCE SEARCHES TWO PROVIDERS, each answering the query with a record
 * under a name of its own, so which were ASKED is read off the page by those
 * names: `/import` lists every Provider that answered, even one that matched
 * nothing, so a name missing from a narrowed page is a Provider nobody asked.
 */
const { providers } = scopable;

/** The section `/groups` renders for one scope asking one Provider. */
function asking(groupId: string, providerUrl: string): string {
  return `ask-${groupId}-${providerUrl}`;
}

/**
 * Makes a scope ask a Provider, or not, through the button `/groups` renders
 * for the pair -- and answers the page as it then stands.
 *
 * TO A STATE RATHER THAN A TOGGLE, and it presses the button only when the
 * page shows the other state. A toggle made each test depend on what its
 * neighbours had pressed on a shared scope, which review caught: one test
 * silently turned off the wiki the next one relied on. This keeps the promise
 * `aScopeCalled` makes, that each test sets up what it needs.
 */
async function setAsking(groupId: string, providerUrl: string, asked: boolean): Promise<string> {
  const page = await pageText("/groups");
  const asksNow = textOf(sectionIn(page, asking(groupId, providerUrl))).includes("Stop asking");
  if (asksNow === asked) return page;
  return (await submit(baseUrl, "/groups", formIn(page, asking(groupId, providerUrl)), owner)).text;
}

/** Provider search from `/import`, across everything, as the Owner is served it. */
async function searchedFromImport(): Promise<string> {
  return pageText(`/import?q=${encodeURIComponent(providers.query)}`);
}

describe("which Providers a scope asks", () => {
  it("asks a Provider for a scope from `/groups`, and stops when told", async () => {
    const id = await aScopeCalled("eee Asks, then stops");

    const asked = await setAsking(id, providers.wiki.url, true);
    expect(textOf(sectionIn(asked, asking(id, providers.wiki.url)))).toContain("Stop asking");
    expect(textOf(sectionIn(asked, asking(id, providers.database.url)))).not.toContain(
      "Stop asking",
    );

    const stopped = await setAsking(id, providers.wiki.url, false);
    expect(textOf(sectionIn(stopped, asking(id, providers.wiki.url)))).not.toContain("Stop asking");
  });

  it("searches only the Providers a scope asks, picked from `/import`", async () => {
    // THE TICKET'S FIRST CRITERION WHERE THE OWNER MEETS IT. Across everything
    // both Providers answer; within the scope, only the one it asks does -- and
    // the scope is PICKED on `/import`, off the same picker the Listings carry.
    const id = await aScopeCalled("fff Asks the wiki alone");
    await setAsking(id, providers.wiki.url, true);
    const everything = await searchedFromImport();
    expect(everything).toContain(providers.wiki.name);
    expect(everything).toContain(providers.database.name);

    const within = await pageText(scopeLinked(everything, "fff Asks the wiki alone"));

    expect(within).toContain(providers.wiki.name);
    expect(within).not.toContain(providers.database.name);
  });

  it("searches again within the same scope from the narrowed page's own box", async () => {
    // THE BOX SITS UNDER A PICKER THAT STILL MARKS THE SCOPE, so a second
    // search from it that asked every Provider would contradict the page it
    // was typed on. What it submits is read off the form the page renders --
    // query first, then the scope, which is the picker's own spelling.
    const id = await aScopeCalled("fff Searched twice within");
    await setAsking(id, providers.wiki.url, true);
    const within = await pageText(
      scopeLinked(await searchedFromImport(), "fff Searched twice within"),
    );

    // BY ITS ACTION, because the shell's header carries Catalogue search's box
    // on every page and that one takes a `q` too.
    const box = navigatingFormsIn(within).find(({ action }) => action.endsWith("/import"));

    expect(box?.fields.map(([name]) => name)).toStrictEqual(["q", "group"]);
    expect(box?.fields.find(([name]) => name === "group")?.[1]).toBe(id);
  });

  it("says a scope asks no Provider, rather than that nothing matched", async () => {
    // A SCOPE NOBODY TOLD ANYTHING ASKS NOBODY (ADR-0025), and "Nothing
    // matched" would be a claim about Providers that were never asked -- the
    // exact confusion `/import` already keeps apart for one that is down.
    await aScopeCalled("ggg Asks nobody");
    const everything = await searchedFromImport();

    const within = await pageText(scopeLinked(everything, "ggg Asks nobody"));

    expect(textOf(sectionIn(within, "asks-no-provider"))).toContain("asks no Provider");
    expect(within).not.toContain(providers.wiki.name);
    expect(within).not.toContain("Nothing matched");
  });
});

describe("what a visitor is served", () => {
  it("shows a visitor the scopes and offers them no control", async () => {
    // ADR-0044 and ADR-0072: reading the catalogue is open, and which scopes
    // exist is part of it. The BUTTONS are what refuse a visitor, which is why
    // this asserts the list IS there and the form is not -- a page that hid the
    // list would be a visibility system, and there is none (ADR-0072).
    await aScopeCalled("ddd Visible to a visitor");

    const page = await documentAt("/groups");

    expect(scopesIn(sectionIn(page.text, "groups"))).toContain("ddd Visible to a visitor");
    expect(() => formIn(page.text, "draw-a-group")).toThrow();
  });

  it("offers a visitor no deletion to confirm, even at the address that asks", async () => {
    // THE PREVIEW IS THE DELETE ROLLED BACK (ADR-0046), so it is the Owner's
    // like the delete, and a visitor who has the address is served the list.
    const id = await aScopeCalled("ddd Not a visitor's to delete");

    const page = await documentAt(`/groups?delete=${id}`);

    expect(page.status).toBe(200);
    expect(() => sectionIn(page.text, "delete-group")).toThrow();
    expect(scopesIn(sectionIn(page.text, "groups"))).toContain("ddd Not a visitor's to delete");
  });

  it("shows a visitor which Providers a scope asks, and offers no button to change it", async () => {
    // READ LIKE THE LIST IT SITS IN (CNCORE-182): searching within a scope is
    // open and names the Providers it asked, so the page hides nothing by
    // leaving them off -- it would only make a visitor search to find out.
    const id = await aScopeCalled("ddd Asks for a visitor to see");
    await setAsking(id, providers.wiki.url, true);

    const page = await documentAt("/groups");

    expect(textOf(sectionIn(page.text, asking(id, providers.wiki.url)))).toContain("Asked");
    expect(() => formIn(page.text, asking(id, providers.wiki.url))).toThrow();
  });

  it("offers a visitor no way to change what scopes an Item is in", async () => {
    const doctorWho = await aScopeCalled("bbb Doctor Who");
    await putInScope(scopable.crossover, doctorWho);

    const page = await documentAt(`/items/${scopable.crossover}`);

    expect(scopesIn(sectionIn(page.text, "groups"))).toContain("bbb Doctor Who");
    expect(() => formIn(page.text, "put-in-a-group")).toThrow();
  });
});
