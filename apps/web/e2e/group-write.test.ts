import { describe, expect, inject, it } from "vitest";

import { documentFrom, formIn, logInAt, sectionIn, submit, withFields } from "./document";

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

describe("deleting a scope", () => {
  it("deletes it and LEAVES ITS ITEM ALONE", async () => {
    // ADR-0010'S PROMISE (story 34), asserted where the Owner would find out it
    // had been broken: the Item's own page, still rendering its title.
    //
    // THE ITEM IS THE ONE NOTHING ELSE SCOPES, so "it is in no Group now" is a
    // claim about this deletion rather than about whatever else had put it
    // somewhere.
    const id = await aScopeCalled("ccc A scope to delete");
    await putInScope(scopable.loose, id);

    const deleted = await submit(
      baseUrl,
      "/groups",
      formIn(await pageText("/groups"), `delete-${id}`),
      owner,
    );

    expect(scopesIn(sectionIn(deleted.text, "groups"))).not.toContain("ccc A scope to delete");
    const item = await documentAt(`/items/${scopable.loose}`);
    expect(item.text).toContain(scopable.looseTitle);
    expect(sectionIn(item.text, "groups")).toContain("in no Group");
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

  it("offers a visitor no way to change what scopes an Item is in", async () => {
    const doctorWho = await aScopeCalled("bbb Doctor Who");
    await putInScope(scopable.crossover, doctorWho);

    const page = await documentAt(`/items/${scopable.crossover}`);

    expect(scopesIn(sectionIn(page.text, "groups"))).toContain("bbb Doctor Who");
    expect(() => formIn(page.text, "put-in-a-group")).toThrow();
  });
});
