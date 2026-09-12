import { createServer, type Server } from "node:http";

import { afterAll, describe, expect, inject, it } from "vitest";

import {
  documentFrom,
  formIn,
  logInAt,
  postFormsIn,
  type RenderedForm,
  sectionIn,
  submit,
  withFields,
} from "./document";

/**
 * WHERE THE OWNER SAYS WHAT THIS INSTANCE REACHES, over real HTTP (CNCORE-99).
 *
 * UNTIL THIS PAGE IT WAS A FILE AND A RESTART. `PROVIDER_URLS` and
 * `PROVIDER_ALLOWLIST` were environment variables read once at boot, so
 * connecting a source meant editing a file on the machine and bringing the
 * instance down -- which is not a thing an owner should have to do to add a
 * Provider (ADR-0121, and CNCORE-96's problem statement).
 *
 * NO BROWSER, like every other file here. Every control on this page is an
 * ordinary form post, so a browser with no script does exactly what this does.
 *
 * ITS OWN INSTANCE, because this file WRITES THE CONFIGURATION. Every other
 * instance in this suite is somebody's fixture and several of them assert on
 * which providers are configured -- CNCORE-93 is open on exactly that shape, an
 * assertion reading shared state across a write it does not own.
 */
const baseUrl = inject("configurableBaseUrl");
const ownerPassword = inject("ownerPassword");

/** Every Provider the page names, read off the rows it renders. */
function providersIn(text: string): string[] {
  return [...sectionIn(text, "providers").matchAll(/data-provider="([^"]*)"/g)].map(
    ([, baseUrl]) => baseUrl ?? "",
  );
}

/** The owner, doing what the owner does: naming one Provider on the page. */
async function name(cookie: string, provider: string): Promise<string> {
  const { text } = await documentFrom(baseUrl, "/settings", cookie);
  const named = await submit(
    baseUrl,
    "/settings",
    withFields(formIn(text, "name-a-provider"), { baseUrl: provider }),
    cookie,
  );
  return named.text;
}

/** The owner editing ADR-0034's allowlist, which is one text they replace. */
async function allow(cookie: string, allowlist: string): Promise<string> {
  const { text } = await documentFrom(baseUrl, "/settings", cookie);
  const edited = await submit(
    baseUrl,
    "/settings",
    withFields(formIn(text, "allowlist"), { allowlist }),
    cookie,
  );
  return edited.text;
}

/**
 * A PROVIDER THE OWNER CAN ACTUALLY UNLOCK, on a real socket on loopback.
 *
 * IT HOLDS ITS OWN STATE, which is what makes the round trip assertable at all.
 * ADR-0122 puts the Provider's own config file at the centre: whatever writes it
 * Unlocks the Provider, and the manifest then REPORTS what the file says. So
 * this stub flips from `absent` to `valid` when its unlock path is posted to,
 * exactly as `provider-wiki` does when it writes `wiki-session.json` -- and the
 * test can then ask CanonCore what it sees WITHOUT CanonCore having been
 * anywhere near the value.
 *
 * IT IS NOT A STAND-IN FOR A REAL PROVIDER and must not grow into one. It serves
 * a manifest and an unlock path, which is the whole of what this page reads.
 */
const stubs: Server[] = [];

interface StubProvider {
  url: string;
  /** What the Owner does in their own browser, which never touches CanonCore. */
  unlock: () => Promise<void>;
}

async function aProviderDeclaring(
  credential: Record<string, unknown> | null,
): Promise<StubProvider> {
  let state = credential;
  const server = createServer((request, response) => {
    if (request.url === "/unlock" && request.method === "POST") {
      // THE PROVIDER'S OWN WRITE. It is the only thing that ever sees a value,
      // and what it reports afterwards is read from what it wrote.
      state =
        state === null
          ? null
          : { ...state, state: "valid", state_changed_at: "2026-09-13T10:00:00.000Z" };
      response.writeHead(204);
      return response.end();
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        name: "a provider",
        ...(state === null ? {} : { credential: state }),
      }),
    );
  });
  stubs.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) throw new Error("no port");
  const url = `http://127.0.0.1:${address.port}`;
  return {
    url,
    unlock: async () => {
      await fetch(`${url}/unlock`, { method: "POST" });
    },
  };
}

afterAll(async () => {
  await Promise.all(
    stubs.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

/**
 * A loopback URL nothing answers on: ADMITTED by the allowlist and REFUSING the
 * connection, which is the third fault and the one with a third fix.
 *
 * A PORT TAKEN AND THEN RELEASED, rather than a number picked out of the air. A
 * hardcoded one is a port something else on the machine may well be holding, and
 * the test would then read a stranger's server as this Provider.
 */
async function aPortNothingListensOn(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) throw new Error("no port");
  const url = `http://127.0.0.1:${address.port}`;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return url;
}

/** Where a row's row sends the Owner to Unlock the Provider, if anywhere. */
function unlockLinkIn(row: string): string | null {
  return row.match(/<a[^>]+href="([^"]*)"/)?.[1] ?? null;
}

describe("/settings", () => {
  it("names a provider, and still names it on the next request", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const provider = "http://named-and-reloaded.test:8080";

    await name(cookie, provider);

    /*
     * READ AGAIN RATHER THAN READ OFF THE ANSWER. "Survives a reload" is the
     * acceptance criterion and the POST's own re-render cannot prove it: the
     * question is whether the setting was STORED, and a second request is the
     * cheapest thing that asks it of the server rather than of the response.
     */
    const { text } = await documentFrom(baseUrl, "/settings", cookie);
    expect(providersIn(text)).toContain(provider);
  });

  it("keeps the entry exactly as the owner typed it", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    /*
     * NO TRAILING SLASH, AND THAT IS THE ASSERTION. A Provider's URL is its
     * IDENTITY (ADR-0031) and the identity is what the Source row on every
     * imported claim carries, so a surface that tidied this into
     * `http://as-typed.test:8080/` would make one Provider two -- and the
     * catalogue would hold a second Item for everything imported under the
     * other spelling.
     */
    const asTyped = "http://as-typed.test:8080";

    await name(cookie, asTyped);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);
    expect(providersIn(text)).toContain(asTyped);
    expect(providersIn(text)).not.toContain(`${asTyped}/`);
  });

  /**
   * THE ONE THING ON THIS PAGE A PERSON CAN GET WRONG, and the one a re-read
   * cannot report: "that was not a URL" and "nothing happened" render as the
   * same unchanged list. So the action ends at the page with the entry named,
   * and this is the assertion that the owner is actually told.
   */
  it("says an entry that is not a URL was refused, rather than doing nothing", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    // NO SCHEME, which is what `parseProviderUrls` refuses: a provider is a URL
    // and nothing more (ADR-0031), and a bare host is not one.
    const notAUrl = "wiki.test";

    const answer = await name(cookie, notAUrl);

    expect(answer).toContain("was not named");
    expect(answer).toContain(notAUrl);
    expect(providersIn(answer)).not.toContain(notAUrl);
  });

  it("removes a provider the owner is finished with", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const provider = "http://no-longer-wanted.test:8080";
    await name(cookie, provider);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);
    await submit(baseUrl, "/settings", removeFormFor(text, provider), cookie);

    // READ AGAIN RATHER THAN OFF THE POST'S OWN RE-RENDER, for the reason the
    // naming test above gives: what is asserted is that the setting CHANGED,
    // and only a second request asks that of the server rather than of the
    // response.
    const after = await documentFrom(baseUrl, "/settings", cookie);
    expect(providersIn(after.text)).not.toContain(provider);
  });

  it("says which setting refuses a provider it does not admit, and says it of that one alone", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    // THE COMMONEST REAL MISCONFIGURATION (ADR-0121): a Provider named and its
    // host never allowlisted. Two settings for one concept is a cost that
    // record accepts, and paying it is this page's job.
    await allow(cookie, "admitted.test");
    await name(cookie, "http://admitted.test:8080");
    await name(cookie, "http://elsewhere.test:8080");

    const { text } = await documentFrom(baseUrl, "/settings", cookie);

    /*
     * THE NOTICE'S OWN WORDS, AND A HOST THAT DOES NOT CONTAIN THEM. The first
     * version of this asserted `/allowlist/i` against a row whose Provider was
     * `http://refused-by-the-allowlist.test:8080` -- so the URL satisfied the
     * match and the test passed with the notice deleted. Found in review, and it
     * is the shape CNCORE-96 warns about: an assertion that reads back something
     * the fixture put there.
     */
    expect(rowFor(text, "http://elsewhere.test:8080")).toContain("does not admit this host");
    /*
     * AND THE OTHER HALF, WHICH IS WHAT MAKES IT A TEST. A page that printed the
     * notice on every row would pass the assertion above and tell an owner their
     * working Provider was unreachable.
     */
    expect(rowFor(text, "http://admitted.test:8080")).not.toContain("does not admit this host");
  });

  it("edits the allowlist, and still holds it on the next request", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const asTyped = "wiki.example.com, 100.64.0.0/10";

    await allow(cookie, asTyped);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);
    expect(formIn(text, "allowlist").fields).toContainEqual(["allowlist", asTyped]);
  });

  /**
   * THE SENTENCE THAT MOVED OFF `.env.example` (CNCORE-99). ADR-0034 makes the
   * empty allowlist REFUSE EVERY PROVIDER, which is the safe end of the failure
   * and completely silent; an owner who reads an empty box as "nothing
   * restricted yet" has the meaning exactly backwards. `install-path.test.ts`
   * pinned that explanation while the setting was a variable, and this is the
   * surface it is edited on now.
   *
   * IT IS AN ASSERTION ABOUT COPY, NOT ABOUT STATE, and the name says so since
   * review: the explanation is on the page whatever the allowlist currently
   * holds, which is the point -- the moment it is needed is BEFORE an owner has
   * written anything, and a sentence that appeared only when the box was already
   * empty would be a sentence nobody meets while filling it in.
   */
  it("explains what an empty allowlist does, whatever this one holds", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);

    expect(sectionIn(text, "allowlist").toLowerCase()).toMatch(/empty.*refuses every provider/s);
  });

  /**
   * ADR-0044's VISITOR, told where the door is and nothing else -- which is
   * `/devices`'s rule applied to a page that carries MORE than a list of
   * sessions: the allowlist names the hosts and address ranges on this owner's
   * own network, and `provider.allowlisted` answers a yes-or-no to anybody
   * precisely so that it never has to disclose them (ADR-0034).
   */
  it("shows a visitor no settings at all", async () => {
    const { status, text } = await documentFrom(baseUrl, "/settings");

    expect(status).toBe(200);
    expect(() => sectionIn(text, "providers")).toThrow();
    expect(() => sectionIn(text, "allowlist")).toThrow();
    expect(text).toContain("/login");
  });
});

/**
 * THE REMOVE BUTTON FOR ONE PROVIDER, found by the Provider it names rather
 * than by its position.
 *
 * `devices-page.test.ts` reads its End buttons the same way and for the same
 * reason: pressing whichever form happens to be first is a test that removes
 * something another test set up, and the failure lands in that other test.
 */
function removeFormFor(text: string, provider: string): RenderedForm {
  const form = postFormsIn(sectionIn(text, "providers")).find(({ fields }) =>
    fields.some(([name, value]) => name === "baseUrl" && value === provider),
  );
  if (form === undefined) throw new Error(`the page offers no way to remove ${provider}`);
  return form;
}

/** One rendered Provider row, by the Provider it is about. */
function rowFor(text: string, provider: string): string {
  const row = sectionIn(text, "providers")
    .split(/<li\b/)
    .find((candidate) => candidate.includes(`data-provider="${provider}"`));
  if (row === undefined) throw new Error(`the page renders no row for ${provider}`);
  return row;
}

/**
 * THE OWNER UNLOCKING A PROVIDER FROM THE SETTINGS SURFACE (CNCORE-101,
 * ADR-0122).
 *
 * WHAT IS RENDERED IS A LINK AND NEVER A FORM, and that is this whole ticket
 * after its correction. The ticket was filed asking for a form CanonCore would
 * POST to the Provider; MCP's 2026-07-28 revision prohibits exactly that
 * mechanism for credentials -- "Servers MUST NOT use form mode elicitation to
 * request sensitive information such as passwords, API keys, access tokens" --
 * and BCP 240 removed OAuth's password grant over the same leak surface. So the
 * Owner supplies the value TO THE PROVIDER and CanonCore shows only the label
 * and the state.
 *
 * ITS OWN INSTANCE, like the file it sits in: these tests WRITE the
 * configuration, and the allowlist each one needs is written by that test.
 */
describe("/settings, unlocking a provider", () => {
  it("shows the label a provider declared, and links to that provider's own unlock path", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const provider = await aProviderDeclaring({
      label: "a browser session for the wiki",
      fields: [{ name: "cf_clearance", label: "the clearance cookie" }],
      unlock_path: "/unlock",
      state: "absent",
      state_changed_at: null,
    });
    await allow(cookie, "127.0.0.1/32");
    await name(cookie, provider.url);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);

    const row = rowFor(text, provider.url);
    expect(row).toContain("a browser session for the wiki");
    expect(unlockLinkIn(row)).toBe(`${provider.url}/unlock`);
  });

  /**
   * THE PIN ON ADR-0122'S CENTRAL REFUSAL, taken where it would actually be
   * broken. A form on this page posting to CanonCore is precisely the mechanism
   * that record refuses, and it is what an earlier draft of this ticket asked
   * for -- so the assertion is that the Owner's control is an ANCHOR and that
   * the Provider's field names are nowhere on the page.
   */
  it("renders a link rather than a form, and names no field of the credential", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const provider = await aProviderDeclaring({
      label: "a browser session",
      fields: [{ name: "cf_clearance", label: "the clearance cookie" }],
      unlock_path: "/unlock",
      state: "absent",
      state_changed_at: null,
    });
    await allow(cookie, "127.0.0.1/32");
    await name(cookie, provider.url);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);

    const row = rowFor(text, provider.url);
    // The only form on a Provider's row is the one that stops naming it.
    expect(postFormsIn(row).every(({ fields }) => fields.some(([key]) => key === "baseUrl"))).toBe(
      true,
    );
    expect(text).not.toContain("cf_clearance");
  });

  /** A Provider that needs nothing declares nothing, and is untouched by any of this. */
  it("offers no unlock at all for a provider that declares no credential", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const provider = await aProviderDeclaring(null);
    await allow(cookie, "127.0.0.1/32");
    await name(cookie, provider.url);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);

    const row = rowFor(text, provider.url);
    expect(unlockLinkIn(row)).toBeNull();
    expect(row).toContain(provider.url);
  });

  /**
   * THE ROUND TRIP, AND THE ONE ASSERTION THAT PROVES CANONCORE CARRIES NOTHING.
   * The Owner Unlocks AT THE PROVIDER -- this test posts to the Provider itself,
   * which is what their browser does after following the link -- and CanonCore
   * reports it on the NEXT MANIFEST READ, having been nowhere near the value.
   */
  it("reports a provider valid on the next read once it was unlocked at the provider", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const provider = await aProviderDeclaring({
      label: "a browser session",
      unlock_path: "/unlock",
      state: "absent",
      state_changed_at: null,
    });
    await allow(cookie, "127.0.0.1/32");
    await name(cookie, provider.url);
    const before = await documentFrom(baseUrl, "/settings", cookie);
    expect(rowFor(before.text, provider.url).toLowerCase()).toContain("not been unlocked");

    await provider.unlock();

    const after = await documentFrom(baseUrl, "/settings", cookie);
    expect(rowFor(after.text, provider.url).toLowerCase()).toContain("unlocked");
    expect(rowFor(after.text, provider.url).toLowerCase()).not.toContain("not been unlocked");
  });

  /**
   * THREE STATES THAT MUST NOT RENDER ALIKE, and the expired one has to say WHEN.
   * `expired` alone does not tell the Owner whether the session lapsed a minute
   * ago or three weeks ago, which is the difference between renewing it and
   * going to look at what else broke.
   *
   * AND THE EXPIRED ONE STILL CARRIES ITS LINK, which is the criterion that an
   * expired Provider can be re-Unlocked without being removed and re-added.
   */
  it("renders absent, valid and expired differently, and says when an expired one lapsed", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const absent = await aProviderDeclaring({
      label: "a session",
      unlock_path: "/unlock",
      state: "absent",
      state_changed_at: null,
    });
    const valid = await aProviderDeclaring({
      label: "a session",
      unlock_path: "/unlock",
      state: "valid",
      state_changed_at: "2026-09-12T09:00:00.000Z",
    });
    const expired = await aProviderDeclaring({
      label: "a session",
      unlock_path: "/unlock",
      state: "expired",
      state_changed_at: "2026-09-04T11:00:00.000Z",
    });
    await allow(cookie, "127.0.0.1/32");
    for (const provider of [absent, valid, expired]) await name(cookie, provider.url);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);

    const rows = {
      absent: rowFor(text, absent.url).toLowerCase(),
      valid: rowFor(text, valid.url).toLowerCase(),
      expired: rowFor(text, expired.url).toLowerCase(),
    };
    expect(rows.absent).toContain("not been unlocked");
    expect(rows.valid).toContain("unlocked");
    expect(rows.valid).not.toContain("not been unlocked");
    expect(rows.expired).toContain("lapsed");
    // WHEN IT LAPSED, rendered rather than merely carried.
    expect(rows.expired).toContain("2026");
    // AND IT CAN STILL BE RE-UNLOCKED, with nothing removed and re-added.
    expect(unlockLinkIn(rowFor(text, expired.url))).toBe(`${expired.url}/unlock`);
  });

  /**
   * THE THREE FAULTS WITH THREE DIFFERENT FIXES, told apart on the page. A
   * Provider that needs Unlocking, one that cannot be reached, and one the
   * allowlist never admitted are the ticket's own criterion, and a surface that
   * collapsed any two of them would send the Owner to the wrong setting.
   */
  it("tells needing-unlocking, unreachable and not-allowlisted apart", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const locked = await aProviderDeclaring({
      label: "a session",
      unlock_path: "/unlock",
      state: "absent",
      state_changed_at: null,
    });
    const deadUrl = await aPortNothingListensOn();
    await allow(cookie, "127.0.0.1/32");
    await name(cookie, locked.url);
    await name(cookie, deadUrl);
    await name(cookie, "http://never-allowlisted.test:8080");

    const { text } = await documentFrom(baseUrl, "/settings", cookie);

    expect(rowFor(text, locked.url).toLowerCase()).toContain("not been unlocked");
    expect(rowFor(text, deadUrl).toLowerCase()).toContain("nothing could be read from");
    expect(rowFor(text, "http://never-allowlisted.test:8080")).toContain(
      "does not admit this host",
    );
    // AND NOT THE OTHERS' SENTENCES, which is what makes this a test rather than
    // an assertion every row would satisfy.
    expect(rowFor(text, locked.url).toLowerCase()).not.toContain("nothing could be read from");
    expect(rowFor(text, deadUrl).toLowerCase()).not.toContain("not been unlocked");
  });
});
