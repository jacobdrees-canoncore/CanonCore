import { describe, expect, inject, it } from "vitest";

import { documentFrom, sectionIn } from "./document";

/**
 * WHO `/new` TELLS A READER MAY FILL THIS CATALOGUE (CNCORE-144), at ADR-0103's
 * fourth seam.
 *
 * THE SAME THREE ANSWERS OFF THE SAME TWO FACTS AS THE EMPTY STATE AND THE
 * HEADER, which ADR-0094 settles under "SO THE LIST IS RENDERED FOR A SESSION":
 * the owner gets the form, a reader with no session on an instance that HAS a
 * password gets the refusal and the login, and a reader on an instance with
 * NONE gets the refusal and no login. Five surfaces answer it that way since
 * CNCORE-146 — this one, `/import`, `/tasks`, `/settings` and `/devices` — and
 * each is asked in its own file, beside `header.test.ts` and
 * `front-page.test.ts` which ask the two that already did.
 *
 * TWO INSTANCES, BECAUSE THE SECOND FACT IS ABOUT THE INSTANCE. Nothing on one
 * server can distinguish "no password is set" from "this reader has not used
 * it", so the answer that turns on the first needs a server that is in it.
 *
 * THE OWNER'S ANSWER IS NOT ASKED HERE, AND THAT IS WHERE IT LIVES RATHER THAN
 * A GAP. `item-write.test.ts` logs in, reads the `new-item` form off this page
 * and submits it -- the first answer, asserted by the file that then uses it.
 * Standing a second owner up here would assert the same form through a second
 * login, on an instance whose fixture is somebody else's.
 */
const freshBaseUrl = inject("freshBaseUrl");
/**
 * THE INSTANCE MOST PEOPLE RUN: a password is set, so a reader either is the
 * owner and has used it or is not and has not. The reader asked here is the
 * second, and nothing on this server can tell them from a stranger.
 */
const baseUrl = inject("baseUrl");

describe("/new, on an instance nobody can log in to", () => {
  it("offers no login, and says which silence that is", async () => {
    // ADR-0044's read-only instance, which sets no `OWNER_PASSWORD`: every
    // password is refused, so nobody obtains a session INCLUDING the owner. A
    // login offered here is the door with no key cut for it that `/login`
    // itself refuses to render -- follow it and that page says so.
    const { status, text } = await documentFrom(freshBaseUrl, "/new");

    expect(status).toBe(200);
    // THE WHOLE DOCUMENT, WHICH IS A REAL ASSERTION ON THIS INSTANCE. The
    // header offers no login here either (CNCORE-139), so nothing on this page
    // may link one and a narrower reading would assert less than the criterion.
    expect(text).not.toContain('href="/login"');
    // AND IT SAYS WHICH OF THE TWO SILENCES THIS IS, rather than leaving a
    // reader to wonder whether they are missing a button. Read off the page's
    // own refusal like the seeded case below, NOT off the document: `/new` is
    // the only surface here that emits those words today, so a document-wide
    // check would pass against a page that had dropped the section entirely or
    // moved the sentence out of it, and pin the claim to nothing.
    expect(sectionIn(text, "who-can-add").toLowerCase()).toContain("no password");
  });
});

describe("/new, to a reader with no session on an instance that has a password", () => {
  it("still offers the login, which is the step that would make them the owner", async () => {
    // They may BE the owner and simply not have used it -- the README's first
    // instruction is to go and do that -- so the login here is the correct next
    // step rather than a consolation. This is the answer the fix must not cost:
    // reading the instance is what makes the OTHER two honest, and a page that
    // stopped offering a login wherever one exists would have traded one
    // silence for a worse one.
    const { status, text } = await documentFrom(baseUrl, "/new");

    expect(status).toBe(200);
    // READ OFF THE PAGE'S OWN REFUSAL RATHER THAN THE DOCUMENT, which is what
    // this section exists for. Since CNCORE-139 the header offers this reader a
    // login on every page of this instance, so a document-wide check would pass
    // against a `/new` that had gone silent -- asserting the shell and calling
    // it the page.
    expect(sectionIn(text, "who-can-add")).toContain('href="/login"');
  });
});
