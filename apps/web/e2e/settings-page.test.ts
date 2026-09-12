import { describe, expect, inject, it } from "vitest";

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

  it("removes a provider the owner is finished with", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const provider = "http://no-longer-wanted.test:8080";
    await name(cookie, provider);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);
    const removed = await submit(baseUrl, "/settings", removeFormFor(text, provider), cookie);

    expect(providersIn(removed.text)).not.toContain(provider);
  });

  it("says which setting refuses a provider it does not admit", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    // THE COMMONEST REAL MISCONFIGURATION (ADR-0121): a Provider named and its
    // host never allowlisted. Two settings for one concept is a cost that
    // record accepts, and paying it is this page's job.
    await allow(cookie, "admitted.test");
    const refused = "http://refused-by-the-allowlist.test:8080";

    const { text } = await name(cookie, refused).then(() =>
      documentFrom(baseUrl, "/settings", cookie),
    );

    const row = rowFor(text, refused);
    expect(row).toMatch(/allowlist/i);
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
   */
  it("says what an empty allowlist does", async () => {
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
