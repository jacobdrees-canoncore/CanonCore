import { createServer, type Server } from "node:http";

import { type Database, writeProviderSettings } from "@canoncore/db";
import { connect } from "@canoncore/db/testing/catalogue";
import { env } from "@canoncore/env/server";
import { call, isDefinedError, safe } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createContext } from "../context";
import { appRouter } from "./index";

/**
 * ADR-0103's second seam: the settings surface's procedures, called in-process.
 *
 * WHAT THIS FILE IS ACTUALLY ABOUT IS THE SOURCE HAVING MOVED. `PROVIDER_URLS`
 * and `PROVIDER_ALLOWLIST` were read once at module load, so a change to either
 * meant a restart; they are a Settings store now (CNCORE-99, ADR-0121), and
 * every test below that says "the next request" is asserting exactly that —
 * a context built AFTER the write sees it, with nothing restarted.
 */
async function aTokenForTheOwner(): Promise<string> {
  const password = env.OWNER_PASSWORD;
  if (password === undefined) {
    throw new Error("this suite's vitest.config.ts sets OWNER_PASSWORD, and it is not set");
  }
  const { token } = await call(
    appRouter.session.logIn,
    { password },
    { context: await createContext() },
  );
  return token;
}

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
    expect(providers.map((provider) => provider.baseUrl)).toEqual([asTyped]);
  });

  it("refuses an entry that is not a URL and changes nothing", async () => {
    const { error } = await safe(
      call(
        appRouter.settings.nameProvider,
        { baseUrl: "wiki.test" },
        { context: await theNextRequest() },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
    const { providers } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );
    expect(providers).toEqual([]);
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
        { allowlist: "*.wiki.test" },
        { context: await theNextRequest() },
      ),
    );

    expect(isDefinedError(error) && error.code).toBe("BAD_REQUEST");
    const { allowlist } = await call(
      appRouter.settings.read,
      {},
      { context: await theNextRequest() },
    );
    expect(allowlist).toBe("");
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
    expect(allowlist).toBe(asTyped);
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
    expect(providers.map(({ baseUrl, reach }) => [baseUrl, reach.kind])).toEqual([
      ["http://wiki.test:8080", "unreachable"],
      ["http://tmdb.test:8080", "not-admitted"],
    ]);
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

    expect(providers[0]?.reach).toEqual({
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
