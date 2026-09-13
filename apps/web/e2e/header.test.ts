import { describe, expect, inject, it } from "vitest";

import { documentFrom, logInAt } from "./document";

/**
 * THE SHELL EVERY PAGE CARRIES, over real HTTP (CNCORE-139).
 *
 * ADR-0103's fourth seam, for the same reason the front page uses it: the
 * header is server-rendered markup, so what a reader is offered is in the HTML
 * the server returns and a browser would observe nothing more.
 *
 * IT IS READ ON A PAGE THAT IS NOT `/`, deliberately. The header is the shell
 * rather than a section of the catalogue page, and an assertion made only on
 * `/` would pass just as well against a header rendered by that page alone.
 */
const freshBaseUrl = inject("freshBaseUrl");
/**
 * THE INSTANCE MOST PEOPLE RUN: a password is set, so a reader either is the
 * owner and has used it or is not and has not. Both readers are asked here.
 */
const baseUrl = inject("baseUrl");

/**
 * The shell of one served page: everything before the content.
 *
 * READ AS THE `header` ELEMENT rather than by class or by position, because
 * that is the landmark the shell IS to anybody navigating by one, and a reader
 * that matched the first `<div>` of the body would be asserting against
 * Tailwind.
 *
 * IT REFUSES A SECOND ONE RATHER THAN TAKING THE FIRST, which is the difference
 * between reading the banner and reading whatever `<header>` happens to come
 * first. There is one in this app today and the banner is it; the day a card or
 * a section grows its own, a helper that quietly picked the earlier tag would
 * assert against the wrong element and pass.
 */
function headerOf(text: string): string {
  const found = [...text.matchAll(/<header\b.*?<\/header>/gs)].map(([element]) => element);
  if (found.length === 0) throw new Error("that page rendered no header");
  if (found.length > 1) throw new Error(`that page rendered ${found.length} headers, not one`);
  return found[0] as string;
}

describe("the header, to the owner", () => {
  it("offers both routes that fill a catalogue, and no login", async () => {
    // WHY THE ROUTES ARE STILL HERE AT ALL, which is the half a thinner header
    // could quietly lose: an import surface or a create form reachable only by
    // typing its address is one an owner has to be told about, and an owner who
    // already has items has no empty state left to be told by.
    const owner = await logInAt(baseUrl, inject("ownerPassword"));

    const { status, text } = await documentFrom(baseUrl, "/works", owner);

    expect(status).toBe(200);
    const header = headerOf(text);
    expect(header).toContain('href="/new"');
    expect(header).toContain('href="/import"');
    expect(header).not.toContain('href="/login"');
  });
});

describe("the header, to a reader with no session", () => {
  it("offers the login rather than the routes waiting behind it", async () => {
    // Nothing here can tell an owner who has not logged in from a stranger, and
    // nothing needs to: both want the same next step, and it is the one the
    // README names first -- "the first thing to do ... is log in with the one
    // you just generated". The link prevents a gap rather than closing one:
    // the path to `/login` ran through `New item` until this ticket -- the
    // refusal at `/new` carries its own login -- and thinning the nav is what
    // takes that path away.
    const { status, text } = await documentFrom(baseUrl, "/works");

    expect(status).toBe(200);
    const header = headerOf(text);
    expect(header).toContain('href="/login"');
    expect(header).not.toContain('href="/new"');
    expect(header).not.toContain('href="/import"');
  });
});

describe("the header, on an instance nobody can log in to", () => {
  it("offers neither of the owner's routes, and no login either", async () => {
    // ADR-0044's read-only instance, which sets no `OWNER_PASSWORD`: every
    // password is refused, so nobody obtains a session INCLUDING the owner.
    // `/new` would answer "Only the owner of this catalogue can add to it" and
    // `/import` would render with every button disabled -- to every reader of
    // every page, with no login anywhere that could change that.
    const { status, text } = await documentFrom(freshBaseUrl, "/works");

    expect(status).toBe(200);
    const header = headerOf(text);
    expect(header).not.toContain('href="/new"');
    expect(header).not.toContain('href="/import"');
    expect(header).not.toContain('href="/login"');
  });
});
