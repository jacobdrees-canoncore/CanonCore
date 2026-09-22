import { createServer, type Server } from "node:http";

import { type Database, writeProviderSettings } from "@canoncore/db";
import { connect, untilSomebodyWaitsOn } from "@canoncore/db/testing/catalogue";
import { call, isDefinedError, safe } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createContext } from "../context";
import { aTokenForTheOwner } from "../testing/the-owner";
import { appRouter } from "./index";
import type { ProvidersConfigured } from "./settings";

/**
 * ADR-0103's second seam: the settings surface's procedures, called in-process.
 *
 * WHAT THIS FILE IS ACTUALLY ABOUT IS THE SOURCE HAVING MOVED. `PROVIDER_URLS`
 * and `PROVIDER_ALLOWLIST` were read once at module load, so a change to either
 * meant a restart; they are a Settings store now (CNCORE-99, ADR-0121), and
 * every test below that says "the next request" is asserting exactly that —
 * a context built AFTER the write sees it, with nothing restarted.
 */
const sessionToken = await aTokenForTheOwner();

/**
 * THE CONTEXT A REQUEST ARRIVING NOW WOULD CARRY, built fresh every time it is
 * asked for.
 *
 * NOT ONE CONTEXT FOR THE FILE, which is the difference this whole ticket is
 * about. A context held across a write would answer from the configuration the
 * process started with, which is precisely the behaviour the environment
 * variables had and the surface exists to end.
 */
const theNextRequest = () => createContext({ sessionToken });

/** A visitor: no session, so no business reading or changing what this instance reaches. */
const aVisitor = () => createContext();

/**
 * A PROVIDER ON A REAL SOCKET, answering one manifest.
 *
 * Not a mocked fetch: what `settings.read` does with a named Provider is resolve
 * its host, pin the connection and read a manifest over HTTP, and an interceptor
 * would prove the URL was assembled and nothing else.
 */
const providers: Server[] = [];

async function aProviderDeclaring(credential: unknown): Promise<string> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ name: "a provider", credential }));
  });
  providers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) throw new Error("no port");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    providers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

/**
 * THE PROVIDERS A READ NAMED, for the tests whose stored setting parses.
 *
 * `settings.read` answers a union since CNCORE-326 -- THREE ARMS since
 * CNCORE-329 -- and every test but three below arranges two settings that
 * read. Narrowing it in each of them would put a copy of the same `if` in
 * front of a dozen different assertions, and a cast would throw the union's
 * whole point away: the branch it forces is what stops a fourth state arriving
 * on the page as whatever the last one happened to be.
 *
 * IT THROWS RATHER THAN RETURNING EMPTY, because an unreadable setting inside
 * one of those tests is the fixture having gone wrong, and an empty list would
 * satisfy assertions that are about which Providers are there. `reach` is what
 * the third arm has not got, so a test reaching for one through this gets a
 * sentence naming the fixture rather than `undefined` two lines later.
 */
function theProvidersNamed(
  providers: ProvidersConfigured,
): Extract<ProvidersConfigured, { kind: "read" }>["named"] {
  if (providers.kind !== "read") {
    throw new Error(
      `a stored setting did not parse (${providers.kind}), and this test arranged two that should`,
    );
  }
  return providers.named;
}

let db: Database;

/**
 * THE ONE SETTINGS ROW, PUT BACK AS AN UNCONFIGURED INSTANCE'S BEFORE EACH TEST.
 *
 * There is one row per instance (migration 16) and this file's tests all write
 * it, so each arranges its own starting point rather than inheriting whatever
 * the last one left. CNCORE-93 is open on the shape this avoids: an assertion
 * that reads shared state across a write it does not own.
 */
beforeEach(async () => {
  db = await connect();
  await writeProviderSettings(db, { providerUrls: "", providerAllowlist: "" });
});

describe("naming a provider", () => {
  it("is searched by the next request, with nothing restarted", async () => {
    await call(
      appRouter.settings.nameProvider,
      { baseUrl: "http://wiki.test:8080" },
      { context: await theNextRequest() },
    );

    const configured = await call(
      appRouter.provider.configured,
      {},
      { context: await theNextRequest() },
    );
    expect(configured.providers).toEqual(["http://wiki.test:8080"]);
  });

  it("stores the entry exactly as the owner typed it", async () => {
    // A PROVIDER'S URL IS ITS IDENTITY (ADR-0031), so the port with no path and
    // no trailing slash is the identity every imported claim will carry. A
    // surface that tidied it would make one provider two.
    const asTyped = "http://wiki.test:8080";
    await call(
      appRouter.settings.nameProvider,
      { baseUrl: asTyped },
      { context: await theNextRequest() },
    );

    const { providers } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );
    expect(theProvidersNamed(providers).map((provider) => provider.baseUrl)).toEqual([asTyped]);
  });

  it("refuses an entry that is not a URL and changes nothing", async () => {
    const { error } = await safe(
      call(
        appRouter.settings.nameProvider,
        { baseUrl: "wiki.test" },
        { context: await theNextRequest() },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("NOT_A_URL");
    const { providers } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );
    expect(theProvidersNamed(providers)).toEqual([]);
  });

  /**
   * THREE MISTAKES THE OWNER CAN MAKE IN ONE BOX, AND THE PROCEDURE TELLS THEM
   * APART (CNCORE-262). One `BAD_REQUEST` covered all three, so the surface
   * above could only ever print one sentence -- and it printed the one about
   * schemes at an Owner who had pasted two URLs that both had schemes.
   *
   * THE CODE AND NOT THE MESSAGE IS WHAT IS ASSERTED. `settings/actions.ts` may
   * not copy a procedure's sentence into an address -- "a sentence nobody owns"
   * -- so the code is the whole of what travels, and a test pinning the wording
   * here would pin it in the one place that is specifically not allowed to
   * carry it.
   */
  it("tells nothing named, several named and not a URL apart", async () => {
    const refusalFor = async (baseUrl: string) => {
      const { error } = await safe(
        call(appRouter.settings.nameProvider, { baseUrl }, { context: await theNextRequest() }),
      );
      return isDefinedError(error) ? error : undefined;
    };

    expect((await refusalFor(""))?.code).toBe("NOTHING_NAMED");
    expect((await refusalFor("   "))?.code).toBe("NOTHING_NAMED");
    expect((await refusalFor("http://a.test:8080 http://b.test:8080"))?.code).toBe(
      "NOT_ONE_PROVIDER",
    );
    expect((await refusalFor("wiki.test"))?.code).toBe("NOT_A_URL");
  });

  /**
   * AND A SETTING THAT NO LONGER PARSES IS A FOURTH THING, NOT ONE OF THE THREE
   * (CNCORE-262).
   *
   * `nameProvider` PARSES THE STORED STRING BEFORE IT PARSES THE ENTRY, so an
   * instance whose `providerUrls` row has gone bad refuses a perfectly good
   * entry -- and the Owner must not be told their URL was the problem. It stays
   * `BAD_REQUEST` and the surface says something else about it.
   */
  it("refuses a good entry when the stored setting is the thing that will not parse", async () => {
    await writeProviderSettings(db, { providerUrls: "wiki.test" });

    const { error } = await safe(
      call(
        appRouter.settings.nameProvider,
        { baseUrl: "http://fine.test:8080" },
        { context: await theNextRequest() },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
  });

  /**
   * AND ALL THREE ARE REFUSALS RATHER THAN FAULTS, which is one line of oRPC
   * away from being false. `fallbackORPCErrorStatus` reads
   * `status ?? COMMON_ORPC_ERROR_DEFS[code]?.status ?? 500`, and none of these
   * three codes is one oRPC knows -- so a definition that left `status` off
   * would answer 500, `isARefusal` in `answer.ts` would stop recognising it,
   * and the Server Action would rethrow into Next's bare `Internal Server
   * Error`. That is the exact outcome `answer.ts` exists to prevent, so the
   * status is asserted here rather than trusted to a default.
   */
  it("answers all three as refusals, under the status `answer.ts` reads", async () => {
    for (const baseUrl of ["   ", "http://a.test:8080 http://b.test:8080", "wiki.test"]) {
      const { error } = await safe(
        call(appRouter.settings.nameProvider, { baseUrl }, { context: await theNextRequest() }),
      );
      expect(isDefinedError(error) && error.status).toBe(400);
    }
  });
});

describe("removing a provider", () => {
  it("stops the next request searching it", async () => {
    await call(
      appRouter.settings.nameProvider,
      { baseUrl: "http://wiki.test:8080" },
      { context: await theNextRequest() },
    );

    await call(
      appRouter.settings.removeProvider,
      { baseUrl: "http://wiki.test:8080" },
      { context: await theNextRequest() },
    );

    const configured = await call(
      appRouter.provider.configured,
      {},
      { context: await theNextRequest() },
    );
    expect(configured.providers).toEqual([]);
  });
});

/**
 * TWO CHANGES TO THE PROVIDERS AT ONCE, AND BOTH SURVIVE (CNCORE-391).
 *
 * THE ORDER IS FORCED, as in `settings.test.ts` beside the store, and for the
 * same reason: a `Promise.all` of two namings would usually interleave the
 * harmless way and pass against the defect. One change is held open in a
 * transaction that has written the row; the router's change then starts, and
 * the holder commits only once the router's connection is blocked on it. A
 * router that read the list before taking the row would read the list from
 * before the held change, park on its UPDATE, and write back a list that
 * leaves the held change out, with no error anywhere.
 *
 * THE HELD CHANGE IS A STORE WRITE RATHER THAN A SECOND ROUTER CALL, because a
 * router call cannot be stopped halfway. It stands for the other request at the
 * one moment that matters: its list written, its commit not yet made.
 */
describe("two changes to the Providers at the same moment", () => {
  async function whileAChangeIsHeldOpen(held: string, change: () => Promise<unknown>) {
    const holding = await connect();
    try {
      let changed!: Promise<unknown>;
      await holding.transaction(async (tx) => {
        await writeProviderSettings(tx, { providerUrls: held });
        changed = change();
        // Awaited below; this only stops a failure inside it reading as an
        // unhandled rejection during the wait.
        changed.catch(() => {});
        await untilSomebodyWaitsOn(db, tx);
      });
      await changed;
    } finally {
      await holding.$client.end();
    }
  }

  it("keeps both when two Providers are named", async () => {
    await writeProviderSettings(db, { providerUrls: "http://a.test" });

    await whileAChangeIsHeldOpen("http://a.test\nhttp://b.test", async () =>
      call(
        appRouter.settings.nameProvider,
        { baseUrl: "http://c.test" },
        { context: await theNextRequest() },
      ),
    );

    const configured = await call(
      appRouter.provider.configured,
      {},
      { context: await theNextRequest() },
    );
    expect(configured.providers).toEqual(["http://a.test", "http://b.test", "http://c.test"]);
  });

  it("keeps a naming made while another Provider is removed", async () => {
    await writeProviderSettings(db, { providerUrls: "http://a.test\nhttp://b.test" });

    await whileAChangeIsHeldOpen("http://a.test\nhttp://b.test\nhttp://c.test", async () =>
      call(
        appRouter.settings.removeProvider,
        { baseUrl: "http://a.test" },
        { context: await theNextRequest() },
      ),
    );

    const configured = await call(
      appRouter.provider.configured,
      {},
      { context: await theNextRequest() },
    );
    expect(configured.providers).toEqual(["http://b.test", "http://c.test"]);
  });
});

describe("editing the allowlist", () => {
  it("admits a provider the next request reaches", async () => {
    // AN INSTANCE NOBODY HAS CONFIGURED REACHES NOTHING (ADR-0034), which is
    // where `beforeEach` leaves this one, and this is the owner changing that.
    const before = await call(
      appRouter.provider.allowlisted,
      {},
      { context: await theNextRequest() },
    );
    expect(before.any).toBe(false);

    await call(
      appRouter.settings.editAllowlist,
      { allowlist: "wiki.test" },
      { context: await theNextRequest() },
    );

    const after = await call(
      appRouter.provider.allowlisted,
      {},
      { context: await theNextRequest() },
    );
    expect(after.any).toBe(true);
  });

  it("refuses an entry the boundary cannot read, and changes nothing", async () => {
    // ADR-0034's allowlist holds exact hosts and CIDRs and NO WILDCARDS, and
    // `parseAllowlist` is what says so. The surface refuses where that function
    // refuses rather than carrying a rule of its own.
    const { error } = await safe(
      call(
        appRouter.settings.editAllowlist,
        { allowlist: "wiki.test, *.wiki.test" },
        { context: await theNextRequest() },
      ),
    );

    /*
     * WHICH ENTRY AND WHICH RULE, RATHER THAN A BARE `BAD_REQUEST`
     * (CNCORE-329). This answered the generic code, so the action above it had
     * nothing to report WITH and reported nothing at all -- the page
     * re-rendered with the Owner's edit gone and no sentence about it. The two
     * rules `parseAllowlist` holds have opposite remedies: a wildcard is
     * replaced by the hosts it stood for, a bad CIDR is corrected in place.
     */
    expect(isDefinedError(error) && error.code).toBe("SETTING_NOT_READ");
    expect(isDefinedError(error) && error.data).toEqual({
      entry: "*.wiki.test",
      why: "wildcard",
    });
    const { allowlist } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );
    expect(allowlist.asWritten).toBe("");
  });

  it("tells a malformed CIDR from a wildcard, since the remedies differ", async () => {
    const { error } = await safe(
      call(
        appRouter.settings.editAllowlist,
        { allowlist: "10.0.0.0/99" },
        { context: await theNextRequest() },
      ),
    );

    expect(isDefinedError(error) && error.data).toEqual({
      entry: "10.0.0.0/99",
      why: "not-a-cidr",
    });
  });

  it("keeps the allowlist the owner wrote, as they wrote it", async () => {
    const asTyped = "wiki.test, 127.0.0.0/8";
    await call(
      appRouter.settings.editAllowlist,
      { allowlist: asTyped },
      { context: await theNextRequest() },
    );

    const { allowlist } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );
    expect(allowlist.asWritten).toBe(asTyped);
  });
});

/**
 * THE ROUTE BACK FROM A SETTING THAT WILL NOT PARSE (CNCORE-331).
 *
 * `nameProvider` AND `removeProvider` BOTH PARSE THE STORED STRING FIRST, so
 * while the row is bad both are refused -- and removing is the one that would
 * have repaired it. The Owner's only route was a psql prompt, which is not a
 * route a self-hoster has.
 *
 * WHOLESALE, WHICH IS THE ALLOWLIST'S OWN ARRANGEMENT AND WHY IT NEVER HAD
 * THIS DEFECT. `editAllowlist` parses what is SUBMITTED and never what is
 * stored, so a bad allowlist has always been repairable from its textarea.
 * This is that shape given to the setting beside it.
 *
 * AND IT DOES NOT WEAKEN PARSE-BEFORE-STORE, which is the condition ADR-0121
 * puts on every settings write: what the surface accepts is exactly what a
 * configured instance can read back. The input is parsed before it reaches a
 * row, as the other three are. What changes is only that the STORED value is
 * no longer parsed on the way in -- and it never should have been, since it is
 * the thing being replaced.
 */
describe("replacing the Providers setting", () => {
  it("repairs a stored setting that does not parse, which no other write can", async () => {
    await writeProviderSettings(db, { providerUrls: "wiki.test" });
    // THE STATE IS REAL BEFORE IT IS REPAIRED, so this asserts a route out of
    // somewhere rather than a write into an instance that was already fine.
    const { providers: before } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );
    expect(before.kind).toBe("unreadable");

    await call(
      appRouter.settings.editProviders,
      { providers: "http://wiki.test:8080" },
      { context: await theNextRequest() },
    );

    const { providers: after } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );
    expect(theProvidersNamed(after).map(({ baseUrl }) => baseUrl)).toEqual([
      "http://wiki.test:8080",
    ]);
  });

  /**
   * AN EMPTY BOX IS A LEGAL EDIT, which is `editAllowlist`'s own rule and is
   * the whole of the "clear it and start again" repair. An instance naming no
   * Provider searches none (ADR-0121), which is what a fresh one does.
   */
  it("takes an empty list, which is how a bad row is cleared outright", async () => {
    await writeProviderSettings(db, { providerUrls: "wiki.test" });

    await call(
      appRouter.settings.editProviders,
      { providers: "" },
      { context: await theNextRequest() },
    );

    const { providers } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );
    expect(theProvidersNamed(providers)).toEqual([]);
  });

  it("refuses a list it could not read back, and changes nothing", async () => {
    await writeProviderSettings(db, { providerUrls: "http://wiki.test:8080" });

    const { error } = await safe(
      call(
        appRouter.settings.editProviders,
        { providers: "http://wiki.test:8080, tmdb.test" },
        { context: await theNextRequest() },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("SETTING_NOT_READ");
    // WHICH ENTRY AND WHICH RULE, because the Owner submitted a whole text and
    // "something in it is wrong" leaves them hunting for the line. The page
    // writes the sentence; this carries what it needs to write one about.
    expect(isDefinedError(error) && error.data).toEqual({ entry: "tmdb.test", why: "not-a-url" });
    const { providers } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );
    expect(theProvidersNamed(providers).map(({ baseUrl }) => baseUrl)).toEqual([
      "http://wiki.test:8080",
    ]);
  });
});

describe("what the settings surface reads", () => {
  /**
   * THE COMMONEST REAL MISCONFIGURATION, which ADR-0121 accepts rather than
   * designs around: two settings for one concept, and the likely mistake is
   * naming a provider and forgetting to allowlist its host. The page can only
   * say which of the two refuses a provider if the read tells it.
   */
  it("says which named providers the allowlist does not admit", async () => {
    await call(
      appRouter.settings.editAllowlist,
      { allowlist: "wiki.test" },
      { context: await theNextRequest() },
    );
    await call(
      appRouter.settings.nameProvider,
      { baseUrl: "http://wiki.test:8080" },
      { context: await theNextRequest() },
    );
    await call(
      appRouter.settings.nameProvider,
      { baseUrl: "http://tmdb.test:8080" },
      { context: await theNextRequest() },
    );

    const { providers } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );
    /*
     * `not-admitted` IS THE ASSERTION, AND THE OTHER ROW IS WHAT MAKES IT ONE.
     * A read that reported every provider as refused by the allowlist would
     * satisfy half of this and tell the Owner their working Provider was
     * unreachable. The admitted row's own outcome is `unreachable` here --
     * `wiki.test` resolves to nothing -- which is the distinction this ticket
     * exists to draw: the allowlist refusing a Provider and the Provider not
     * answering are two different faults with two different fixes.
     */
    expect(theProvidersNamed(providers).map(({ baseUrl, reach }) => [baseUrl, reach.kind])).toEqual(
      [
        ["http://wiki.test:8080", "unreachable"],
        ["http://tmdb.test:8080", "not-admitted"],
      ],
    );
  });

  /**
   * A STORED SETTING THAT NO LONGER PARSES IS AN ANSWER, NOT A CRASH
   * (CNCORE-326).
   *
   * THIS READ IS THE ONLY WAY TO `/settings`, so a throw here is the Owner
   * losing the page rather than losing a list. `parseProviderUrls` refuses a
   * row that no longer reads -- which is a state only something writing ROUND
   * this surface can reach, since all three writes parse before they store --
   * and it threw out of the handler bare: not an `ORPCError`, no code and no
   * status, so `answer.ts` could not have read it as a refusal either.
   *
   * AND THE ALLOWLIST IS STILL ANSWERED, which is the half that makes this
   * worth answering rather than refusing. They are two settings and neither is
   * derivable from the other (ADR-0121), and a read that refused wholesale
   * would take the allowlist's textarea -- the one control on that page still
   * worth using -- away over a fault in the setting beside it.
   *
   * WHAT IS ASSERTED IS THAT THE STORED STRING COMES BACK, NOT THAT IT PARSES.
   * On this path `parseAllowlist` is never called: it sits in the other arm,
   * behind the Providers that did not read. So this pins the echo, which is
   * what the textarea renders, and the allowlist's own parse is CNCORE-329's.
   */
  it("answers that the stored Providers setting cannot be read, and still reads the allowlist", async () => {
    await writeProviderSettings(db, {
      providerUrls: "wiki.test",
      providerAllowlist: "wiki.test",
    });

    const { providers, allowlist } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );

    /*
     * AND THE STRING ITSELF COMES BACK, WHICH IS THE REPAIR (CNCORE-331). The
     * page renders it into a textarea `editProviders` replaces wholesale, so
     * withholding it would offer the Owner an empty box whose Save wipes the
     * setting they came to fix. It is their OWN text rather than a refusal's
     * message -- ADR-0197 keeps the message out of the page and this is not
     * one.
     */
    expect(providers).toEqual({ asWritten: "wiki.test", kind: "unreadable" });
    expect(allowlist.asWritten).toBe("wiki.test");
    // AND THE ALLOWLIST BESIDE IT READ PERFECTLY WELL, which is the half that
    // makes this an answer rather than a refusal: two settings, neither
    // derivable from the other (ADR-0121), and the page must say WHICH.
    expect(allowlist.kind).toBe("read");
  });

  /**
   * AND THE OTHER SETTING, WHICH THREW OUT OF THE SAME HANDLER (CNCORE-329).
   *
   * `parseAllowlist` sat in `reachProviders`' argument list, so a stored
   * allowlist that does not parse cost the Owner `/settings` exactly as the
   * Providers row did -- worse, because the allowlist textarea is the one
   * control CNCORE-326 deliberately kept working when the OTHER setting is bad.
   * When this is the bad one, that control is what they cannot reach.
   *
   * THE PROVIDERS ARE STILL NAMED AND NONE IS REACHED, and both halves are the
   * assertion. ADR-0034 makes the allowlist the boundary every config URL is
   * held to, so a boundary that will not parse admits nothing and no request
   * may be made -- but the Owner's Providers are stored, readable and still
   * theirs to remove, so a read that dropped the list would hide a setting that
   * is fine over a fault in the one beside it.
   */
  it("answers that the stored allowlist cannot be read, and still names the Providers", async () => {
    await writeProviderSettings(db, {
      providerUrls: "http://wiki.test:8080",
      providerAllowlist: "*.wiki.test",
    });

    const { providers, allowlist } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );

    expect(allowlist).toEqual({ asWritten: "*.wiki.test", kind: "unreadable" });
    expect(providers).toEqual({
      kind: "allowlist-unreadable",
      named: [{ baseUrl: "http://wiki.test:8080" }],
    });
  });

  /**
   * BOTH AT ONCE, WHICH IS ONE STATE AND NOT TWO HALVES OF ANOTHER.
   *
   * ADR-0121's condition on accepting two settings for one concept is that the
   * SURFACE says which of the two refuses, and "both" is one of the answers it
   * has to be able to give: the remedies are different and the Owner has to
   * carry out both. A read that reported only the first fault it met would send
   * them round twice, fixing one setting to be told about the other.
   */
  it("answers that neither setting can be read, when neither can", async () => {
    await writeProviderSettings(db, {
      providerUrls: "wiki.test",
      providerAllowlist: "*.wiki.test",
    });

    const { providers, allowlist } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );

    expect(providers).toEqual({ asWritten: "wiki.test", kind: "unreadable" });
    expect(allowlist).toEqual({ asWritten: "*.wiki.test", kind: "unreadable" });
  });

  /**
   * WHAT THE SETTINGS SURFACE NEEDS IN ORDER TO OFFER AN UNLOCK AT ALL
   * (ADR-0122, CNCORE-101). The state comes off the manifest CanonCore was
   * fetching anyway, so this read is what turns a Provider's own declaration
   * into a row the Owner can act on.
   */
  it("carries a provider's declared credential through to the page", async () => {
    const provider = await aProviderDeclaring({
      label: "a browser session for the wiki",
      fields: [{ name: "cf_clearance", label: "the clearance cookie" }],
      unlock_path: "/unlock",
      state: "expired",
      state_changed_at: "2026-09-04T11:00:00.000Z",
    });
    await call(
      appRouter.settings.editAllowlist,
      { allowlist: "127.0.0.1/32" },
      { context: await theNextRequest() },
    );
    await call(
      appRouter.settings.nameProvider,
      { baseUrl: provider },
      { context: await theNextRequest() },
    );

    const { providers } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );

    expect(theProvidersNamed(providers)[0]?.reach).toEqual({
      kind: "reached",
      credential: {
        label: "a browser session for the wiki",
        unlockUrl: `${provider}/unlock`,
        state: "expired",
        changedAt: "2026-09-04T11:00:00.000Z",
      },
    });
  });

  /**
   * THE PIN ON ADR-0122'S CENTRAL REFUSAL, taken at the seam a caller actually
   * reads. The Credential must appear nowhere in CanonCore's storage, logs or
   * request path -- and `fields` is the contract's list of what the Owner
   * supplies, so a read that carried it would be this app holding the shape of
   * somebody's secret and would be the place a value landed the day anybody
   * rendered the form again.
   *
   * ASSERTED ON THE WHOLE ANSWER rather than on the credential alone, because
   * the claim is about the ANSWER: there is nowhere in it for a value to be.
   */
  it("carries no part of the credential itself, anywhere in the answer", async () => {
    const provider = await aProviderDeclaring({
      label: "a browser session",
      fields: [{ name: "cf_clearance", label: "the clearance cookie" }],
      unlock_path: "/unlock",
      state: "valid",
      state_changed_at: "2026-09-12T09:00:00.000Z",
    });
    await call(
      appRouter.settings.editAllowlist,
      { allowlist: "127.0.0.1/32" },
      { context: await theNextRequest() },
    );
    await call(
      appRouter.settings.nameProvider,
      { baseUrl: provider },
      { context: await theNextRequest() },
    );

    const answer = await call(appRouter.settings.read, {}, { context: await theNextRequest() });

    expect(JSON.stringify(answer)).not.toContain("cf_clearance");
    expect(JSON.stringify(answer)).not.toContain("fields");
  });
});

describe("who may configure this instance", () => {
  /**
   * A VISITOR IS REFUSED, AND THE ALLOWLIST IS WHY IT IS THE WHOLE SURFACE.
   * `provider.allowlisted` answers a yes-or-no to anybody precisely so that it
   * never discloses a private network's address ranges (ADR-0034); this read
   * hands over the ranges themselves, because it is the owner's own editor.
   */
  it("refuses a visitor the settings", async () => {
    const { error } = await safe(call(appRouter.settings.read, {}, { context: await aVisitor() }));

    /*
     * READ OFF THE ERROR RATHER THAN THROUGH `isDefinedError`, which is how
     * `item.test.ts` asserts the same refusal: `ownerProcedure`'s middleware
     * throws this before any procedure runs, so it is not one of the errors a
     * procedure DEFINED and that helper answers false for it.
     */
    expect((error as { code?: string })?.code).toBe("UNAUTHORIZED");
  });

  it("refuses a visitor naming a provider", async () => {
    const { error } = await safe(
      call(
        appRouter.settings.nameProvider,
        { baseUrl: "http://wiki.test:8080" },
        { context: await aVisitor() },
      ),
    );
    expect((error as { code?: string })?.code).toBe("UNAUTHORIZED");
  });
});
