import type { AppRouterClient } from "@canoncore/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { describe, expect, inject, it } from "vitest";

import {
  documentAt,
  documentFrom,
  logInAt,
  postFormsIn,
  sectionIn,
  submit,
  submitAsAFilePart,
} from "./document";

/**
 * ADR-0043's PER-DEVICE LOGOUT, over real HTTP (CNCORE-116).
 *
 * THE RECORD CALLS IT THE THING EVERYONE ACTUALLY WANTS, and until this page it
 * was unreachable: `endSession` has named a session since CNCORE-109 --
 * deliberately, so this would be a page rather than a change to the mechanism --
 * and nothing told the owner what the names were.
 *
 * NO BROWSER, like every other file here: the End button is an ordinary form
 * post, so a browser with no script does exactly what this does.
 */
const baseUrl = inject("baseUrl");
const ownerPassword = inject("ownerPassword");

/**
 * The RPC surface as one logged-in device sees it.
 *
 * USED ONLY TO ASK WHICH SESSION A COOKIE IS, which is a question the PAGE
 * deliberately does not answer: a device reads its own row as "This device" and
 * never as an id. The alternative is ending whichever form happens to be first,
 * and the instance under test is shared with every other file in this suite --
 * so a test that ended a session it had not minted would log another file out
 * halfway through its own run.
 */
function as(cookie: string): AppRouterClient {
  return createORPCClient(new RPCLink({ url: `${baseUrl}/api/rpc`, headers: { cookie } }));
}

async function theSessionBehind(cookie: string): Promise<string> {
  const mine = (await as(cookie).session.list()).find(({ current }) => current);
  if (mine === undefined) throw new Error("a logged-in device is not on its own device list");
  return mine.id;
}

/** Every session id the page offers to end, which is its `id` field. */
function endableIn(text: string): string[] {
  return postFormsIn(sectionIn(text, "devices")).flatMap(({ fields }) =>
    fields.filter(([name]) => name === "id").map(([, value]) => value),
  );
}

describe("/devices", () => {
  it("shows the owner the device they are reading it on", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);

    const { status, text } = await documentFrom(baseUrl, "/devices", cookie);

    expect(status).toBe(200);
    expect(sectionIn(text, "devices")).toContain("This device");
  });

  it("offers no way to end the session doing the reading", async () => {
    // THE ONE ROW THE OWNER MUST NOT PRESS END ON. Ending it from here would
    // take the row and leave the cookie, so the browser would hold a token that
    // opens nothing on a page that still said it was logged in. Logging THIS
    // device out is `/login`'s button, which does both halves.
    const cookie = await logInAt(baseUrl, ownerPassword);

    const { text } = await documentFrom(baseUrl, "/devices", cookie);

    expect(endableIn(text)).not.toContain(await theSessionBehind(cookie));
  });

  it("ends the device it is pressed against, and leaves this one logged in", async () => {
    const other = await logInAt(baseUrl, ownerPassword);
    const mine = await logInAt(baseUrl, ownerPassword);
    const ending = await theSessionBehind(other);

    const { text } = await documentFrom(baseUrl, "/devices", mine);
    const [form] = postFormsIn(sectionIn(text, "devices")).filter(({ fields }) =>
      fields.some(([name, value]) => name === "id" && value === ending),
    );
    if (!form) throw new Error("/devices offered no button against the other device");
    await submit(baseUrl, "/devices", form, mine);

    // THE OTHER COOKIE, PRESENTED AGAIN, which is what the browser holding it
    // does: the row is ended, so it opens nothing.
    const ended = await documentFrom(baseUrl, "/login", other);
    expect(ended.text).not.toContain("You are logged in");
    // AND THE HAND ON THE BUTTON IS STILL LOGGED IN, which is the half of this
    // that is easy to get wrong: `endSession` takes an id, and an action that
    // read the caller's own session instead would log the owner out of the
    // browser they were using to tidy up.
    const kept = await documentFrom(baseUrl, "/login", mine);
    expect(kept.text).toContain("You are logged in");
  });

  /**
   * THE SAME RULE AS `items/actions.ts`, ON ANOTHER ACTION FILE (CNCORE-123),
   * which is what makes this worth asserting twice. `FormData.get` answers
   * `File | string | null` on every surface in this app, and the fix is one
   * shared reader rather than a guard per field -- so the assertion that matters
   * is that a SECOND action inherits it without having been taught.
   *
   * ENDING A SESSION IS THE WRITE WITH THE LOUDEST CONSEQUENCE, and it is the
   * one that must not happen on a request that named nothing: the id here is a
   * `z.uuid()`, and a `File` is no more a uuid than it is a string.
   */
  it("ends no device when the id is sent as a file part", async () => {
    const other = await logInAt(baseUrl, ownerPassword);
    const mine = await logInAt(baseUrl, ownerPassword);
    const ending = await theSessionBehind(other);

    const { text } = await documentFrom(baseUrl, "/devices", mine);
    const [form] = postFormsIn(sectionIn(text, "devices")).filter(({ fields }) =>
      fields.some(([name, value]) => name === "id" && value === ending),
    );
    if (!form) throw new Error("/devices offered no button against the other device");

    const refused = await submitAsAFilePart(baseUrl, "/devices", form, "id", mine);

    expect(refused.status).toBe(200);
    expect(refused.text).not.toContain("Internal Server Error");
    // THE OTHER DEVICE IS STILL LOGGED IN, asked with its own cookie rather than
    // read off the list: a row that survived a render is not the same claim as a
    // session that still opens something.
    expect((await documentFrom(baseUrl, "/login", other)).text).toContain("You are logged in");
  });

  it("tells a reader who is not the owner nothing about the devices", async () => {
    // NOT A READ, WHATEVER IT LOOKS LIKE. ADR-0044 leaves the CATALOGUE open --
    // a visitor to the demo sees everything in it -- and who is logged in to an
    // instance is not in the catalogue. A list answered to anybody is a list of
    // what to go looking for.
    const { status, text } = await documentAt("/devices");

    expect(status).toBe(200);
    expect(text).toContain("Log in");
    expect(() => sectionIn(text, "devices")).toThrow();
  });
});
