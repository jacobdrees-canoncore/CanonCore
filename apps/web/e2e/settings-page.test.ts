import { lookup } from "node:dns/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { createDb, readProviderSettings, writeProviderSettings } from "@canoncore/db";
import { afterAll, describe, expect, inject, it } from "vitest";

import {
  documentFrom,
  formIn,
  logInAt,
  mainOf,
  momentsIn,
  postFormsIn,
  quotesIn,
  type RenderedForm,
  sectionIn,
  submit,
  textOf,
  withFields,
} from "./document";
import { HARNESS_CONNECTIONS } from "./instance";

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
/**
 * ADR-0044's read-only instance, which sets no `OWNER_PASSWORD`: every password
 * is refused, so nobody obtains a session INCLUDING the owner. This page is the
 * owner's whole, so on that instance it is a refusal nobody can ever lift.
 */
const freshBaseUrl = inject("freshBaseUrl");
/**
 * THE CONFIGURABLE INSTANCE'S OWN DATABASE, and the only way to the state below
 * (CNCORE-326).
 *
 * WRITING ROUND THE SURFACE IS THE POINT RATHER THAN A SHORTCUT. All three
 * settings writes parse before they store, so an instance whose Providers
 * setting does not parse is one NO route through this app can produce -- which
 * is exactly why the refusal raised for it had never been reached from here,
 * and why the assertion below the page's own half conceded it could not get
 * there. A row is how an instance actually arrives in this state: a hand-edited
 * database, a restored dump, a value written by something older than the parse.
 */
const configurableDatabaseUrl = inject("configurableDatabaseUrl");

/**
 * A SETTING WRITTEN STRAIGHT INTO THE INSTANCE'S OWN DATABASE, AND PUT BACK.
 *
 * ROUND THE SURFACE, WHICH IS THE POINT RATHER THAN A SHORTCUT. Every settings
 * write parses before it stores, so a row that does not parse is a state NO
 * route through this app can produce -- and it is how an instance really
 * arrives in one: a hand-edited database, a restored dump, a value written by
 * something older than the parse.
 *
 * TWO GUARDS, BECAUSE THERE ARE TWO THINGS TO PUT BACK AND THEY FAIL
 * INDEPENDENTLY. The outer one ends the pool whatever happens, including a
 * throw from the read itself -- a handle nothing ends is how this suite hangs
 * rather than fails (`instance.ts`, CNCORE-229). The inner one puts the row
 * back, and it sits INSIDE the read that captured the old value and OUTSIDE
 * the assertions, or a failing expectation leaves an unreadable setting behind
 * for every test after it in this file.
 *
 * BOTH COLUMNS GO BACK, not only the one written. A caller that breaks the
 * allowlist and restores the Providers leaves the instance broken in the other
 * direction, which is the shape this file's tests would all then meet.
 */
async function withTheSettingsRow(
  row: { providerAllowlist?: string; providerUrls?: string },
  run: () => Promise<void>,
): Promise<void> {
  const db = createDb(configurableDatabaseUrl, { maxConnections: HARNESS_CONNECTIONS });
  try {
    const before = await readProviderSettings(db);
    try {
      await writeProviderSettings(db, row);
      await run();
    } finally {
      await writeProviderSettings(db, {
        providerAllowlist: before.providerAllowlist,
        providerUrls: before.providerUrls,
      });
    }
  } finally {
    await db.$client.end();
  }
}

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

/**
 * A SERVER ON A LOOPBACK PORT THE OPERATING SYSTEM PICKS.
 *
 * SHARED BY THE TWO STUBS BELOW, which had written it out twice: the
 * `listen(0)`, the narrowing of `address()` back to a port, and the URL built
 * from it. None of that is what either stub is ABOUT, and a second copy is where
 * the two quietly stop agreeing on what a stub provider is.
 */
type Route = (request: IncomingMessage, response: ServerResponse) => void;

async function onLoopback(route?: Route): Promise<{ url: string; server: Server }> {
  const server = route === undefined ? createServer() : createServer(route);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) throw new Error("no port");
  return { url: `http://127.0.0.1:${address.port}`, server };
}

interface StubProvider {
  url: string;
  /** What the Owner does in their own browser, which never touches CanonCore. */
  unlock: () => Promise<void>;
  /** Every path this Provider was asked for, and by whom it was asked. */
  asked: string[];
}

async function aProviderDeclaring(
  credential: Record<string, unknown> | null,
): Promise<StubProvider> {
  let state = credential;
  const asked: string[] = [];
  const { url, server } = await onLoopback((request, response) => {
    asked.push(`${request.method} ${request.url}`);
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
  return {
    url,
    asked,
    unlock: async () => {
      await fetch(`${url}/unlock`, { method: "POST" });
    },
  };
}

/**
 * A PROVIDER THAT IS UP, CANNOT ANSWER, AND SAYS WHY (CNCORE-140, ADR-0122).
 *
 * THE THIRD THING A PROVIDER CAN BE, beside one declaring a Credential and one
 * on a port nothing listens on. This one answers -- so the socket opens, the
 * status comes back, and the sentence the Owner has to act on is in the BODY,
 * which is the half that used to die at the boundary.
 *
 * `503` AND A BODY, which is what `packages/contract` holds every Provider
 * declaring a Credential to: up, answering nothing, and saying so. The body's
 * SHAPE is that file's one deliberate omission, and `{error}` here is the
 * spelling both real Providers happen to use rather than one CMPP requires.
 */
async function aProviderRefusingWith(said: string): Promise<{ url: string }> {
  const { url, server } = await onLoopback((_request, response) => {
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: said, provider: "a provider" }));
  });
  stubs.push(server);
  return { url };
}

/**
 * A PROVIDER THAT IS UP, ANSWERS A MANIFEST, AND OWES A NOTICE OF A LENGTH OF
 * ITS OWN CHOOSING (CNCORE-213).
 *
 * IT IS NOT A STAND-IN FOR A REAL PROVIDER and must not grow into one. It
 * serves a manifest, which is the whole of what this page reads.
 */
async function aProviderWhoseNoticeIs(notice: string): Promise<{ url: string }> {
  const { url, server } = await onLoopback((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ name: "a provider owing a notice", attribution: { notice } }));
  });
  stubs.push(server);
  return { url };
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
  const { url, server } = await onLoopback();
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

  /**
   * A BOX OF SPACES IS REFUSED OUT LOUD (CNCORE-262), and it used to be the one
   * refusal on this page that rendered NOTHING.
   *
   * THE WHOLE CHAIN WORKED AND THE OWNER STILL SAW AN UNCHANGED PAGE.
   * `z.string().min(1)` accepts `" "`, `parseProviderUrls` splits the space
   * away to no entries, the procedure refused, the action redirected to
   * `?refused=%20` -- and `oneValue` reads a blank parameter as an ABSENT one,
   * correctly, so the page had nothing to render. Every step was right and the
   * outcome was the exact thing this surface's own docstring forbids: "your
   * entry was not a URL" and "nothing happened" rendering identically.
   *
   * WHICH IS WHY THE REASON TRAVELS SEPARATELY FROM THE ENTRY. A value the
   * Owner typed can be blank; the word saying what was wrong with it cannot.
   */
  it("says a box of nothing but spaces named nothing, rather than saying nothing", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);

    const answer = await name(cookie, "   ");

    expect(answer).toContain("Nothing was named");
  });

  /**
   * TWO PROVIDERS AT ONCE IS ITS OWN MISTAKE, WITH ITS OWN REMEDY (CNCORE-262).
   *
   * THE OLD SENTENCE WAS FALSE OF IT TWICE OVER. It said "it is not a URL" and
   * "name it by its base URL, scheme included" at an Owner who had pasted two
   * entries that were both URLs and both had schemes -- so the one fact they
   * needed, that a Provider is named one at a time, was the one thing the page
   * did not say. `packages/providers` raised that sentence all along; the
   * surface just had no way to tell which refusal it had met.
   */
  it("tells an Owner who pasted two to name them one at a time, not to add a scheme", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    // BOTH ARE URLS AND BOTH CARRY A SCHEME, which is what makes the old
    // sentence untrue rather than merely unhelpful.
    const two = "http://a.test:8080 http://b.test:8080";

    const answer = await name(cookie, two);

    expect(answer).toContain("one at a time");
    expect(answer).not.toContain("it is not a URL");
    expect(providersIn(answer)).not.toContain(two);
  });

  /**
   * AN EMPTY BOX IS THE COMMONEST MISTAKE AND WAS THE SILENT ONE (CNCORE-262).
   *
   * IT NEVER REACHED THE PROCEDURE AT ALL. `theProviderNamed` declared
   * `z.string().min(1)`, so `whatTheFormCarries` refused it and the action
   * returned before calling anything -- the page re-rendered unchanged and said
   * nothing. Found by review of this ticket's own first pass, which had fixed
   * the box of SPACES and left the emptier case beside it untouched.
   */
  it("says an empty box named nothing, which is the same mistake as a box of spaces", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);

    const answer = await name(cookie, "");

    expect(answer).toContain("Nothing was named");
  });

  /**
   * A REFUSAL THAT IS NOT ABOUT WHAT THE OWNER TYPED STILL ENDS SOMEWHERE.
   *
   * THE ACTION MATCHES ON THREE CODES AND THE PROCEDURE CAN ANSWER A FOURTH:
   * the Providers already stored may not parse, which is `BAD_REQUEST` and is
   * not about the entry. Three `if`s with no fall-through redirected NOWHERE,
   * which is this page's original defect reintroduced by the fix for it --
   * review caught it, and the catch-all is what closes it.
   *
   * THE PAGE'S HALF IS WHAT IS ASSERTED HERE, BY DRIVING THE ADDRESS DIRECTLY.
   * This reads `?because=` off an address and renders the sentence for it,
   * which is the page's whole end of the mechanism and is worth asserting on
   * its own: a hand-typed address reaches this page having touched nothing
   * else.
   *
   * AND THE ACTION'S HALF IS THE TEST BELOW, WHICH DID NOT EXIST UNTIL
   * CNCORE-326. This docblock used to close by saying that reaching it "needs a
   * stored setting this surface refuses to write" -- true, and taken as a
   * reason not to, so the redirect that builds this address was asserted by
   * nothing and had in fact never been written. The way in is the ROW: the
   * instance's own database, which `configurableDatabaseUrl` now hands over.
   */
  it("says a refusal that was not about the entry was not about the entry", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);

    const { text } = await documentFrom(
      baseUrl,
      "/settings?refused=http%3A%2F%2Ffine.test%3A8080&because=setting-unreadable",
      cookie,
    );

    expect(text).toContain("cannot read the Providers it already has");
  });

  /**
   * AND THE ACTION'S HALF, WHICH NOTHING COULD REACH UNTIL CNCORE-326.
   *
   * THE TEST ABOVE DRIVES THE ADDRESS BY HAND AND SAYS SO. Its own docblock
   * conceded the gap -- "reaching the action's half needs a stored setting this
   * surface refuses to write" -- and while that was true, the redirect that
   * builds the address was run by nothing at all, so the fall-through it needed
   * was never written. ADR-0197 carries the history; this is what would have
   * caught it.
   *
   * THE STATE IS REACHED THROUGH THE ROW, BECAUSE NO SURFACE WILL WRITE IT.
   * `nameProvider` parses the stored string before it parses the entry, so a
   * row that no longer reads refuses a perfectly good entry -- and the Owner
   * must not be told their URL was the problem, since it was not.
   *
   * IT ASSERTS THE ADDRESS AS WELL AS THE SENTENCE, and the two are different
   * halves. The address is what the ACTION chose, read off where the response
   * landed rather than rebuilt here (`Submitted.url` says why); the sentence is
   * what the PAGE wrote once it got there. A test holding only the sentence
   * would pass on a page that says it for its own reasons, which this page now
   * does -- the read reports an unreadable setting in the Providers section
   * above, so the silence would be covered over by the very thing that makes
   * the section honest.
   *
   * THE ROW GOES BACK IN A `finally`, because this file's other tests read the
   * Providers this instance names, and an unreadable setting left behind is one
   * they would all meet.
   */
  it("tells an Owner naming a good Provider that the stored setting is what refused", async () => {
    const db = createDb(configurableDatabaseUrl, { maxConnections: HARNESS_CONNECTIONS });
    /*
     * TWO GUARDS, BECAUSE THERE ARE TWO THINGS TO PUT BACK AND THEY FAIL
     * INDEPENDENTLY. The outer one ends the pool whatever happens, including a
     * throw from the read itself -- a handle nothing ends is how this suite
     * hangs rather than fails (`instance.ts`, CNCORE-229). The inner one puts
     * the row back, and it has to sit INSIDE the read that captured the old
     * value and OUTSIDE the assertions, or a failing expectation leaves an
     * unreadable setting behind for every test after it in this file.
     */
    try {
      const before = await readProviderSettings(db);
      try {
        await writeProviderSettings(db, { providerUrls: "wiki.test" });
        const cookie = await logInAt(baseUrl, ownerPassword);
        const entry = "http://fine.test:8080";

        const { text } = await documentFrom(baseUrl, "/settings", cookie);
        const named = await submit(
          baseUrl,
          "/settings",
          withFields(formIn(text, "name-a-provider"), { baseUrl: entry }),
          cookie,
        );

        expect(named.url).toContain("because=setting-unreadable");
        expect(named.url).toContain(encodeURIComponent(entry));
        const shown = textOf(mainOf(named.text));
        expect(shown).toContain("was not named");
        expect(shown).toContain("cannot read the Providers it already has");
        // AND NOT ONE OF THE THREE, which is the whole of what this refusal is
        // not. Telling the Owner to add a scheme to an entry that has one is the
        // wrong remedy CNCORE-262 exists to have stopped.
        expect(shown).not.toContain("it is not a URL");
        expect(shown).not.toContain("one at a time");
      } finally {
        await writeProviderSettings(db, { providerUrls: before.providerUrls });
      }
    } finally {
      await db.$client.end();
    }
  });

  /**
   * THE OTHER SETTING, WHICH COST THE SAME PAGE FOR THE SAME REASON
   * (CNCORE-329).
   *
   * `parseAllowlist` sat inside `reachProviders`' argument list, so a stored
   * allowlist that does not parse threw out of the one read behind this page --
   * bare, not an `ORPCError`, with no error boundary anywhere in `apps/web` to
   * catch it. The Owner got no page at all.
   *
   * WORSE THAN THE PROVIDERS HALF, WHICH IS WHY IT IS ITS OWN TICKET. CNCORE-326
   * deliberately kept the allowlist readable when the PROVIDERS are bad, because
   * that textarea is the one control still worth using. When the ALLOWLIST is
   * the bad one, that control is exactly what was unreachable.
   *
   * IT SAYS WHICH OF THE TWO, AND SAYS IT OF THE RIGHT ONE. ADR-0121 accepts two
   * settings for one concept only on the condition that the SURFACE says which
   * refuses, so the negative assertion is half the witness: a page that reported
   * "cannot read the Providers" here would send the Owner to repair a setting
   * that is perfectly good and leave the broken one alone.
   */
  it("renders when the stored allowlist will not parse, and names the allowlist", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    await withTheSettingsRow(
      { providerAllowlist: "*.wiki.test", providerUrls: "http://fine.test:8080" },
      async () => {
        const { status, text } = await documentFrom(baseUrl, "/settings", cookie);

        expect(status).toBe(200);
        const shown = textOf(mainOf(text));
        expect(shown).toContain("cannot read the Allowlist it already has");
        expect(shown).not.toContain("cannot read the Providers it already has");
        /*
         * THE PROVIDERS ARE STILL LISTED AND THE TEXT IS STILL IN THE BOX, and
         * both are the repair rather than decoration. `removeProvider` never
         * parses the allowlist, so those rows are live; and the textarea holds
         * the Owner's own bad text, which is the only thing they can correct it
         * from.
         */
        expect(providersIn(text)).toEqual(["http://fine.test:8080"]);
        expect(formIn(text, "allowlist").fields).toContainEqual(["allowlist", "*.wiki.test"]);
      },
    );
  });

  /**
   * BOTH SETTINGS AT ONCE, WHICH IS ONE STATE AND OWES TWO SENTENCES.
   *
   * ADR-0121's condition is that the surface says WHICH of the two refuses, and
   * an instance whose rows are both bad needs both remedies carried out. A page
   * reporting only the first fault it met would send the Owner round twice --
   * and this is the arrangement CNCORE-326 left inverted, since the allowlist's
   * parse sat INSIDE the Providers' readable arm: both rows bad rendered, and
   * only the allowlist bad did not.
   */
  it("names both settings when neither will parse", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    await withTheSettingsRow(
      { providerAllowlist: "*.wiki.test", providerUrls: "wiki.test" },
      async () => {
        const { status, text } = await documentFrom(baseUrl, "/settings", cookie);

        expect(status).toBe(200);
        const shown = textOf(mainOf(text));
        expect(shown).toContain("cannot read the Providers it already has");
        expect(shown).toContain("cannot read the Allowlist it already has");
      },
    );
  });

  /**
   * THE ROUTE BACK, WHICH DID NOT EXIST UNTIL CNCORE-331.
   *
   * `nameProvider` and `removeProvider` both parse the STORED string before
   * they look at the entry, so while the row is bad every control on this page
   * refused -- and removing is the one that would have repaired it. ADR-0197
   * recorded, under "what this costs", that the page could SAY what was wrong
   * and offer nothing to do about it. The Owner's only route was a psql prompt.
   *
   * THE WHOLE ROUND TRIP, THROUGH THE PAGE. The row is written round the
   * surface because no surface will write it; everything after that is the
   * Owner: they open `/settings`, they type into the box the page offers them,
   * and the instance they get back is one that reads. A witness that stopped at
   * the textarea RENDERING would pass on a form posting to nothing.
   */
  it("offers a way back from a Providers setting that will not parse", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    await withTheSettingsRow({ providerUrls: "wiki.test" }, async () => {
      const { text } = await documentFrom(baseUrl, "/settings", cookie);
      expect(textOf(mainOf(text))).toContain("cannot read the Providers it already has");

      const repaired = await submit(
        baseUrl,
        "/settings",
        withFields(formIn(text, "providers"), { providers: "http://fine.test:8080" }),
        cookie,
      );

      expect(providersIn(repaired.text)).toEqual(["http://fine.test:8080"]);
      expect(textOf(mainOf(repaired.text))).not.toContain(
        "cannot read the Providers it already has",
      );
    });
  });

  /**
   * AND THE REPAIR ITSELF CAN BE REFUSED, WHICH IS COPY THAT NEEDS A WITNESS.
   *
   * ADR-0197's whole subject is a sentence declared, rendered and reached by
   * nothing: the state it was written for was one no surface could produce, so
   * the branch looked covered from a grep and had never run. A textarea added
   * for a state only a hand-edited row reaches is exactly that shape again, so
   * the refusal ON that textarea is asserted from the state it lives in rather
   * than reasoned about.
   *
   * THE ENTRY IS NAMED BECAUSE THE CONTROL TAKES A LIST. An Owner who typed
   * forty lines cannot be sent back to "an entry".
   */
  it("says which line it would not save, when the Providers repair is refused", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    await withTheSettingsRow({ providerUrls: "wiki.test" }, async () => {
      const { text } = await documentFrom(baseUrl, "/settings", cookie);

      const refused = await submit(
        baseUrl,
        "/settings",
        withFields(formIn(text, "providers"), {
          providers: "http://fine.test:8080\ntmdb.test",
        }),
        cookie,
      );

      expect(refused.url).toContain("because=providers-not-a-url");
      expect(refused.url).toContain("tmdb.test");
      const shown = textOf(mainOf(refused.text));
      expect(shown).toContain("That list was not saved");
      /*
       * AND THE BOX IS STILL THERE TO TRY AGAIN IN, which is the half a
       * sentence alone does not settle: the stored row is untouched by a
       * refused save, so the page is back in the state the repair exists for.
       */
      expect(shown).toContain("cannot read the Providers it already has");
    });
  });

  /**
   * A SAVE THAT WAS REFUSED SAYS SO, AND UNTIL CNCORE-329 IT SAID NOTHING.
   *
   * `editAllowlist`'s action dropped what the procedure answered on the floor
   * -- it did not even bind `refused` -- so a wildcard the Owner typed was
   * answered with the page re-rendered, the textarea holding the STORED value,
   * and their edit gone with no sentence about it. That is worse than the
   * eleven call sites ADR-0156 lists under "not built": those end
   * `if (refused) return;` and at least report through a re-read that SHOWS
   * something. A textarea reverting shows the opposite of what happened.
   *
   * WHICH RULE, BECAUSE THE TWO REMEDIES ARE OPPOSITE. A wildcard is replaced
   * by the hosts it stood for; a malformed CIDR is corrected in place. That is
   * CNCORE-262's whole argument, arriving at the setting beside the one it was
   * made about.
   *
   * THE ADDRESS AS WELL AS THE SENTENCE, for the reason ADR-0197 states: the
   * sentence alone cannot tell a fixed action from a silent one on a page that
   * has its own reasons to mention the allowlist.
   */
  it("says which entry it would not save, when the allowlist is refused", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const { text } = await documentFrom(baseUrl, "/settings", cookie);

    const refused = await submit(
      baseUrl,
      "/settings",
      withFields(formIn(text, "allowlist"), { allowlist: "wiki.test, *.wiki.test" }),
      cookie,
    );

    expect(refused.url).toContain("because=allowlist-wildcard");
    expect(refused.url).toContain(encodeURIComponent("*.wiki.test"));
    const shown = textOf(mainOf(refused.text));
    expect(shown).toContain("was not saved");
    expect(shown).toContain("no wildcards");
    // AND THE STORED ALLOWLIST IS UNTOUCHED, which is parse-before-store: the
    // refusal is the whole of what happened.
    expect(formIn(refused.text, "allowlist").fields).not.toContainEqual([
      "allowlist",
      "wiki.test, *.wiki.test",
    ]);
  });

  /**
   * A `?because=` THIS PAGE DOES NOT RECOGNISE SAYS NOTHING (ADR-0123).
   *
   * THE PARAMETER IS IN AN ADDRESS THE OWNER CAN EDIT, so a page that printed
   * what it carried would be a way to put a stranger's sentence in front of a
   * reader under CanonCore's own styling. `/login/page.tsx` states that rule of
   * its own parameter and this is the same rule asserted rather than assumed.
   */
  it("renders no notice at all for a reason it does not recognise", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const forged = "Your account has been suspended, telephone 0800";

    const { text } = await documentFrom(
      baseUrl,
      `/settings?refused=x&because=${encodeURIComponent(forged)}`,
      cookie,
    );

    /*
     * READ OFF WHAT A READER IS SHOWN, never off the document. Next puts the
     * address into its own flight payload in a `<script>`, so EVERY query
     * parameter on every page is somewhere in the bytes -- asserting over the
     * whole document would fail on a page that renders the value nowhere,
     * which is exactly the state being asserted. `textOf` drops every tag and
     * with it every script, which is the distinction that matters here: the
     * sentence is not put in front of the Owner.
     */
    const shown = textOf(mainOf(text));
    expect(shown).not.toContain("was not named");
    expect(shown).not.toContain("telephone 0800");
  });

  /**
   * THE ECHOED ENTRY IS BOUNDED, AND THE ADDRESS IS WHY (ADR-0123).
   *
   * `?refused=` lands inside a sentence this page speaks in its OWN voice, and
   * anybody can compose the address it arrives in -- so its LENGTH is no more
   * the composer's to choose than its words are. `TheirWords` does not close
   * this: that component says of itself that it does not "quote, bound or
   * attribute", because it settles WIDTH by breaking a long word, and a value
   * of any length still fills the page.
   *
   * IT IS BOUNDED WHERE IT IS READ rather than where the redirect is built.
   * A hand-typed address never passes through the Server Action at all, so a
   * bound applied there would guard the one path that was never the problem.
   * This test drives the address directly for exactly that reason.
   */
  it("quotes back only the opening of an entry somebody made enormous", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const flood = `http://${"a".repeat(400)}.test:8080`;

    const { text } = await documentFrom(
      baseUrl,
      `/settings?refused=${encodeURIComponent(flood)}&because=not-a-url`,
      cookie,
    );

    const shown = textOf(mainOf(text));
    // THE REFUSAL IS STILL SAID, which is the half a bound must not cost.
    expect(shown).toContain("was not named");
    expect(shown).not.toContain(flood);
    // AND THE OWNER STILL RECOGNISES WHAT THEY ARE BEING TOLD ABOUT.
    expect(shown).toContain("http://aaaaaaaaaa");
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
   * ADR-0044's VISITOR, shown nothing -- which is `/devices`'s rule applied to a
   * page that carries MORE than a list of sessions: the allowlist names the
   * hosts and address ranges on this owner's own network, and
   * `provider.allowlisted` answers a yes-or-no to anybody precisely so that it
   * never has to disclose them (ADR-0034).
   *
   * IT NO LONGER SAYS "TOLD WHERE THE DOOR IS", because the assertion that said
   * so was the shell's and is gone (ADR-0168). Where the door is, is asserted at
   * the bottom of this file, on the page.
   */
  it("shows a visitor no settings at all", async () => {
    const { status, text } = await documentFrom(baseUrl, "/settings");

    expect(status).toBe(200);
    /*
     * AND NOT `expect(text).toContain("/login")`, WHICH STOOD HERE UNTIL CNCORE-257
     * (ADR-0168).
     * The header offers `/login` to every reader with no session on an instance
     * that has a password (CNCORE-139), so that read the SHELL: measured on the
     * Owner's install, emptying `<main>` entirely leaves it green. The page's own
     * naming of that step is asserted at the bottom of this file, through
     * `mainOf`, which is the only read that can tell the two apart.
     */
    expect(() => sectionIn(text, "providers")).toThrow();
    expect(() => sectionIn(text, "allowlist")).toThrow();
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

/** Every CIDR a refusal quotes back, as the Owner would copy them. */
function cidrsIn(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)]
    .flatMap((match) => (match[1] ?? "").split(", "))
    .filter((entry) => /\/\d+$/.test(entry));
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
    /*
     * AND MARKED AS A TIME, on both rows that carry one (CNCORE-177). This page
     * copied its formatter out of `/devices` and a third copy on `/tasks` had
     * lost the element -- the words right, the markup saying nothing. The three
     * are one component now, and this is what says this surface did not lose it
     * on the way.
     */
    for (const provider of [valid, expired]) {
      const moments = momentsIn(rowFor(text, provider.url));
      expect(moments).toHaveLength(1);
      expect(moments[0]?.printed).toContain("UTC");
      const machine = moments[0]?.machine ?? "";
      expect(Number.isNaN(Date.parse(machine)), `\`${machine}\` is not a moment`).toBe(false);
    }
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

  /**
   * THE HALF OF THE FAILURE THE OWNER CAN ACT ON, ON THE PAGE (CNCORE-140).
   *
   * The row above tells this Provider from the other two, and that is a
   * different claim from this one: "Nothing could be read from this Provider"
   * names the fault and not the fix. A Provider whose session expired is asking
   * for one specific thing at one specific address, it SAYS so in the body of
   * its 503, and CanonCore drained that body unread until this ticket -- so the
   * Owner read `answered 503` and had to go and ask the Provider themselves.
   *
   * ASSERTED WHERE IT IS RENDERED rather than at the client alone. The reason
   * crosses a package boundary, an RPC procedure and a React component between
   * being read off the socket and being printed, and the client's own test
   * proves none of that.
   *
   * AND QUOTED, because it is the Provider's sentence and not this catalogue's
   * (ADR-0123). The existing witness for that branch answers `200` with a
   * malformed manifest, so the text it quotes is zod's; this is the first one
   * whose quoted text is the Provider's own words.
   */
  it("prints the sentence a Provider failed with, not only the status it failed on", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const refusing = await aProviderRefusingWith(
      "this Provider holds no tardis.wiki session. Supply one at /unlock.",
    );
    await allow(cookie, "127.0.0.1/32");
    await name(cookie, refusing.url);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);

    // THE WHOLE SENTENCE THE OWNER READS, and it carries the remedy -- which is
    // all this ticket is for. QUOTED, because the Provider wrote it and this
    // catalogue is not the one making the claim (ADR-0123); the row names the
    // Provider beside it. `/` is the manifest, which is the one path this
    // surface ever asks for.
    expect(quotesIn(rowFor(text, refusing.url))).toContain(
      "/ answered 503: this Provider holds no tardis.wiki session. Supply one at /unlock.",
    );
  });

  /**
   * A NOTICE THIS APP CANNOT PRINT REFUSES THE PROVIDER WHOLE, AND THIS IS WHERE
   * THE OWNER IS TOLD (ADR-0123, CNCORE-213).
   *
   * The notice is printed verbatim or not at all, so past its ceiling nothing is
   * read from this Provider: no search, no import. What the Owner needs from
   * this page is which fault it is. The reason is zod's issue list for the
   * Provider's manifest, quoted, and its path names the field.
   *
   * AND THE NOTICE ITSELF IS NOWHERE ON THE PAGE, which is the other half.
   * A refusal that quoted the value would put the flood on the page.
   */
  it("says nothing could be read from a Provider whose notice runs past the ceiling, and why", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const flood = "licence".repeat(200);
    const owing = await aProviderWhoseNoticeIs(flood);
    await allow(cookie, "127.0.0.1/32");
    await name(cookie, owing.url);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);
    const row = rowFor(text, owing.url);

    expect(row.toLowerCase()).toContain("nothing could be read from");
    expect(quotesIn(row)).toContainEqual(
      expect.stringMatching(/^\[ \{ "origin": "string", "code": "too_big"/),
    );
    expect(row).toContain('"path": [ "attribution", "notice" ]');
    expect(text).not.toContain("licencelicence");
  });

  /**
   * THE REFUSAL CANONCORE ITSELF RAISED, IN CANONCORE'S OWN VOICE (CNCORE-192).
   *
   * THIS IS THE README'S SCENARIO AND NOT A CONSTRUCTED ONE. `### A Provider
   * beside it` tells a stranger to allowlist the Provider they stood up, and an
   * allowlist holding its HOST and not the CIDR its address sits in is what
   * they get by doing exactly that: the name is admitted, and the socket is
   * refused by `assertConfigAddresses` at connect time. Found by walking that
   * section by hand on 2026-09-14, on a real install.
   *
   * TWO THINGS WERE WRONG AND THE SECOND IS THE WORSE ONE. The remedy was gone
   * -- the Owner read `fetch failed`, and the sentence naming what to do was on
   * the `cause` nothing unwrapped. And it was ATTRIBUTED TO THE PROVIDER: a
   * wrapped refusal is neither an `OutboundRefused` nor a `config` one, so the
   * page QUOTED this catalogue's own sentence about the Owner's own settings as
   * a stranger's claim. ADR-0123 is "a failure reason says who wrote it", and
   * that was it answering wrongly rather than not at all.
   *
   * SO THE ABSENCE OF `<q>` IS THE HALF THIS ASSERTS THAT THE CLIENT'S OWN TEST
   * CANNOT. `reasonFor` decides WHOSE the sentence is and `Reason` decides how
   * the page says so, and the reason crosses a package boundary, an RPC
   * procedure and a React component in between. Quoted, this sentence would be
   * telling the Owner that their Provider said something about their allowlist.
   */
  it("prints a refusal CanonCore raised in its own voice, with the remedy in it", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    // A PROVIDER THAT IS UP AND WOULD ANSWER, because the point is that nothing
    // ever asks it. One on a dead port would produce a refusal too and prove
    // nothing about WHICH boundary raised it.
    const alive = await aProviderDeclaring(null);
    // THE HOST, BY NAME, AND NO CIDR UNDER IT -- which is the whole scenario.
    // Named by HOSTNAME rather than by the address the stub listens on: a bare
    // address is filed under the RANGES by `parseAllowlist`, so the host check
    // would refuse it before a socket opened and the pinned lookup would never
    // run.
    const named = `http://localhost:${new URL(alive.url).port}`;
    await allow(cookie, "localhost");
    await name(cookie, named);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);
    const row = rowFor(text, named);

    // WHAT `localhost` ANSWERS WITH HERE, ASKED RATHER THAN ASSUMED. It is
    // dual-stack on the machine this was written on -- `::1` and then
    // `127.0.0.1`, in that order -- and a single record elsewhere. The promise
    // the refusal makes does not vary with that, which is why this asserts the
    // promise instead of the environment.
    const resolved = await lookup("localhost", { all: true });
    // A RESOLVER THAT ANSWERED NOTHING WOULD MAKE THE LOOP BELOW ASSERT
    // NOTHING, and it would do it while passing. That is ADR-0168's hollow
    // assertion arriving through the ENVIRONMENT rather than through the code,
    // which is the one door a mutation test cannot watch.
    expect(resolved.length).toBeGreaterThan(0);

    // THE HALF THE OWNER ACTS ON, which `fetch failed` has none of.
    expect(row).toContain("no allowlisted CIDR covers");
    // BOTH HALVES OF IT SINCE CNCORE-244, and this row is where the defect was
    // reachable: the Owner has allowlisted `localhost` and is being told to go
    // and allowlist a host by name, which is what they just did.
    expect(row).toContain("Its host is allowlisted");
    // AND A CIDR FOR EVERY ADDRESS THAT NEEDS ONE, SINCE CNCORE-287. This
    // assertion accepted EITHER address until now, which ENCODED the defect
    // rather than closing it: the hook refused on whichever record came back
    // first, so an Owner on a dual-stack host allowlisted the address they were
    // given and was refused again for the other one. Asserting the resolver's
    // whole answer is what makes a second round trip a failing test.
    for (const { address, family } of resolved) {
      expect(row).toContain(`${address}/${family === 6 ? 128 : 32}`);
    }
    // AND ONE REFUSAL ACCOUNTS FOR ALL OF THEM, which the loop alone does not
    // say: it would pass just as well on a sentence that named the right CIDR
    // and then a second sentence naming another. The count is the promise.
    expect(cidrsIn(row)).toHaveLength(resolved.length);
    expect(row).not.toContain("fetch failed");
    // AND SAID PLAINLY, because it is this catalogue's sentence about the
    // Owner's own settings rather than a Provider's claim.
    expect(row).not.toContain("<q>");
  });
  /**
   * THE ASSERTION THAT CANONCORE NEVER WALKS THROUGH THE DOOR IT RENDERS.
   *
   * ADR-0122's refusal is that the Credential never reaches this app, "not even
   * in transit", and the schema half of that is pinned at the router. This is the
   * other half: the unlock path is somewhere CanonCore LINKS to and must never
   * REQUEST, because a request is how a value would come to pass through its
   * client. The Provider records what it was asked for, so the assertion is made
   * from the Provider's side rather than from CanonCore's account of itself.
   */
  it("never requests the unlock path it links to", async () => {
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

    await documentFrom(baseUrl, "/settings", cookie);

    expect(provider.asked.length).toBeGreaterThan(0);
    expect(provider.asked.every((one) => one === "GET /")).toBe(true);
  });

  /**
   * A DECLARED PATH THAT LEAVES THE PROVIDER IS REFUSED, AND THE OWNER IS TOLD
   * WHY.
   *
   * `unlockUrlFor` withholds the link, because the value's one destination is an
   * `href` the Owner is about to click and then type a credential into. Saying
   * nothing about it would leave them reading "has not been Unlocked" beside no
   * way to Unlock it -- a Provider that looks merely locked when it is actually
   * misbehaving, which is the collapse this ticket exists to prevent one row up.
   */
  it("says why there is no link when the declared path leaves the provider", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const provider = await aProviderDeclaring({
      label: "a browser session",
      unlock_path: "//evil.test/unlock",
      state: "absent",
      state_changed_at: null,
    });
    await allow(cookie, "127.0.0.1/32");
    await name(cookie, provider.url);

    const { text } = await documentFrom(baseUrl, "/settings", cookie);

    const row = rowFor(text, provider.url);
    // NO LINK ANYWHERE ON THE ROW, and `evil.test` nowhere on the page.
    expect(unlockLinkIn(row)).toBeNull();
    expect(text).not.toContain("evil.test");
    // AND THE OWNER IS TOLD, rather than left with a Provider that cannot be
    // Unlocked and does not say so.
    expect(row.toLowerCase()).toContain("unlock path");
    // The state it declared still renders: the Provider is up, and what it says
    // about itself is still worth reading.
    expect(row.toLowerCase()).toContain("not been unlocked");
  });
});

describe("/settings, on an instance nobody can log in to", () => {
  it("offers no login, and says which silence that is", async () => {
    // ADR-0044's read-only instance, which sets no `OWNER_PASSWORD`: every
    // password is refused, so nobody obtains a session INCLUDING the owner.
    // "Be them first" is a step on an instance with a password and an
    // impossibility on one without, and the link went to a page that renders no
    // form for exactly that reason.
    const { status, text } = await documentFrom(freshBaseUrl, "/settings");

    expect(status).toBe(200);
    // THE WHOLE DOCUMENT FOR THE NEGATIVE, which is a real assertion on this
    // instance: the header offers no login here either (CNCORE-139), so nothing
    // on this page may link one.
    expect(text).not.toContain('href="/login"');
    expect(mainOf(text).toLowerCase()).toContain("no password set");
  });
});

describe("/settings, to a reader with no session on an instance that has a password", () => {
  /**
   * A SESSION THAT DIED IS NOT THE STORED SETTING FAILING TO PARSE (CNCORE-326).
   *
   * `ownerProcedure` refuses a caller with no session by throwing
   * `ORPCError("UNAUTHORIZED")`, which carries status 401 -- MEASURED, not
   * assumed -- and `answer.ts` reads anything under 500 as a refusal. So it
   * arrives at `nameProvider`'s fall-through exactly as the stored-setting
   * refusal does, and a catch-all that NAMES a cause names the wrong one:
   * `?because=setting-unreadable` says this instance cannot read its Providers
   * at an Owner whose Providers are fine and whose session simply expired
   * between the GET and the POST.
   *
   * THE PAGE HIDES IT, WHICH IS WHY THE ADDRESS IS WHAT IS ASSERTED. The
   * session check returns `NotLoggedIn` before `searchParams` is read, so the
   * false sentence renders nowhere and every assertion about the TEXT passes
   * either way. That is precisely the shape this ticket exists to refuse: a
   * mechanism that is wrong where nothing looks. ADR-0156 asks for a branch for
   * "a refusal this page cannot name", and one that names a cause is not it.
   */
  it("is not told the stored setting is unreadable when it is the session that is gone", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const { text } = await documentFrom(baseUrl, "/settings", cookie);

    // The same form, posted with NO cookie: the refusal is UNAUTHORIZED.
    const named = await submit(
      baseUrl,
      "/settings",
      withFields(formIn(text, "name-a-provider"), { baseUrl: "http://fine.test:8080" }),
    );

    expect(named.url).not.toContain("setting-unreadable");
    /*
     * AND IT IS STILL ANSWERED, which the line above does not settle on its
     * own: a silent return satisfies it too, and silence is the thing this
     * ticket exists to end. The fall-through carries the word that names no
     * cause, so both halves of the correction are pinned here.
     */
    expect(named.url).toContain("because=unexplained");
  });

  it("still names the step that would make them the owner", async () => {
    // The answer the fix must not cost. This reader may BE the owner and simply
    // not have used the password yet.
    const { status, text } = await documentFrom(baseUrl, "/settings");

    expect(status).toBe(200);
    // READ OFF THE PAGE, NOT THE DOCUMENT: the header offers this reader a
    // login on every page of this instance, so a document-wide check would pass
    // against a page that had gone silent inside a shell that had not.
    expect(mainOf(text)).toContain('href="/login"');
  });
});
