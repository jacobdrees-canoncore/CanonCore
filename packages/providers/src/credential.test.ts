import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { parseAllowlist, REASON_MAX_LENGTH, reachProviders, unlockUrlFor } from "./index";

/**
 * WHERE THE OWNER IS SENT TO UNLOCK A PROVIDER (ADR-0122, CNCORE-101).
 *
 * THE PROVIDER DECLARES A PATH AND CANONCORE HOLDS THE BASE URL, which is CMPP's
 * one place that distinction is load-bearing: a provider behind a proxy cannot
 * know the URL CanonCore reaches it on, so it names the path and this joins the
 * two.
 */
describe("the unlock URL", () => {
  const PROVIDER = "http://provider-wiki:8080";

  it("joins the provider's base URL with the path it declared", () => {
    expect(unlockUrlFor(PROVIDER, "/unlock")).toBe("http://provider-wiki:8080/unlock");
  });

  /**
   * A BASE URL WITH A PATH ON IT IS THE OWNER'S OWN SPELLING, and a provider may
   * legitimately be mounted under one. The declared path is absolute, so it
   * replaces that path rather than appending to it -- which is the same reason
   * the contract requires the leading slash.
   */
  it("takes the declared path as absolute, whatever the base URL's own path is", () => {
    expect(unlockUrlFor("http://host.test:8080/cmpp", "/unlock")).toBe(
      "http://host.test:8080/unlock",
    );
  });

  /**
   * THE ESCAPE THE CONTRACT'S OWN RULE DOES NOT CATCH, and the reason this is a
   * function rather than a template string.
   *
   * `unlock_path` is specified as starting with `/`, and all three of these do.
   * Measured on node 24.19.0 against `http://provider-wiki:8080`, every one of
   * them resolves to `http://evil.test/` -- the protocol-relative form, the
   * BACKSLASH form the WHATWG parser treats as a second slash, and a leading TAB
   * which that parser strips before it reads the rest. A provider is an
   * untrusted URL (ADR-0031), so a declared path is a provider's string like any
   * other, and the one place it lands is an `href` the Owner is being asked to
   * click and then type a credential into. That is a phishing sink, not a
   * cosmetic defect.
   *
   * SO THE ORIGIN IS CHECKED ON THE JOINED URL rather than the slash on the
   * string. The string check cannot see the escape; the join is where it
   * happens, so the join is where it is caught.
   */
  it.each([
    ["//evil.test/unlock", "the protocol-relative form"],
    ["/\\evil.test/unlock", "a backslash, which the URL parser reads as a second slash"],
    ["/\t/evil.test", "a leading tab, which the URL parser strips"],
  ])("refuses %j, which leaves the provider's origin by %s", (path) => {
    expect(unlockUrlFor(PROVIDER, path)).toBeNull();
  });

  /** A path that stays on the provider is kept, however ugly it looks. */
  it("keeps a path that only looks like an escape", () => {
    expect(unlockUrlFor(PROVIDER, "/..//evil.test")).toBe("http://provider-wiki:8080//evil.test");
  });
});

/**
 * A stand-in for a provider, on a REAL SOCKET on loopback -- the same shape
 * `client.test.ts` uses and for the same reason. What is under test resolves a
 * hostname and reads a manifest over HTTP, and an interceptor would prove the
 * URL was assembled and nothing else.
 */
const servers: Server[] = [];

async function stubProvider(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) throw new Error("no port");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

/** A provider answering one manifest and nothing else, which is all this reads. */
const declaring = (credential: unknown) =>
  stubProvider((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ name: "a provider", credential }));
  });

/** Loopback, which is what these stubs listen on and ADR-0034 admits by name. */
const LOOPBACK = parseAllowlist("127.0.0.1/32");

/**
 * WHAT THE SETTINGS SURFACE IS TOLD ABOUT EACH NAMED PROVIDER (CNCORE-101).
 *
 * THREE OUTCOMES THAT MUST NOT COLLAPSE INTO ONE. A Provider that needs
 * Unlocking, one that cannot be reached, and one the allowlist never admitted
 * are three different things with three different fixes, and the ticket's
 * acceptance criteria name telling them apart as a criterion of its own.
 */
describe("reaching each named provider", () => {
  it("reports what a provider declared about its credential", async () => {
    const baseUrl = await declaring({
      label: "a browser session for the wiki",
      fields: [{ name: "cf_clearance", label: "the clearance cookie" }],
      unlock_path: "/unlock",
      state: "expired",
      state_changed_at: "2026-09-04T11:00:00.000Z",
    });

    const [reached] = await reachProviders({ baseUrls: [baseUrl], allowlist: LOOPBACK });

    expect(reached).toEqual({
      baseUrl,
      reach: {
        kind: "reached",
        credential: {
          label: "a browser session for the wiki",
          unlockUrl: `${baseUrl}/unlock`,
          state: "expired",
          changedAt: "2026-09-04T11:00:00.000Z",
        },
      },
    });
  });

  /** A provider that needs nothing declares nothing, and is unaffected by any of this. */
  it("reports no credential for a provider that declares none", async () => {
    const baseUrl = await declaring(undefined);

    const [reached] = await reachProviders({ baseUrls: [baseUrl], allowlist: LOOPBACK });

    expect(reached?.reach).toEqual({ kind: "reached", credential: null });
  });

  /**
   * THE ALLOWLIST REFUSING A PROVIDER IS NOT THE PROVIDER FAILING, and the Owner
   * goes to a different setting to fix each. Answered WITHOUT A REQUEST: the
   * boundary would refuse it anyway, and refusing after connecting has already
   * told an unallowlisted host that this instance exists (ADR-0034).
   */
  it("tells a provider the allowlist never admitted apart from one that failed", async () => {
    const baseUrl = await declaring({
      label: "a session",
      unlock_path: "/unlock",
      state: "absent",
      state_changed_at: null,
    });

    const [refused] = await reachProviders({
      baseUrls: [baseUrl],
      allowlist: parseAllowlist("somewhere.else.test"),
    });

    expect(refused?.reach).toEqual({ kind: "not-admitted" });
  });

  /**
   * A PROVIDER THAT WAS REACHED AND ANSWERED BADLY, which is the third outcome
   * and the one that carries a THIRD PARTY'S TEXT. The reason is bounded and
   * attributed (ADR-0123) so the page can quote it beside the provider rather
   * than print it in CanonCore's own voice.
   */
  it("carries a bounded, attributed reason for a provider that answered badly", async () => {
    // Well-formed JSON and not a CMPP manifest, so zod's report -- not this
    // app's prose -- is what travels back.
    const baseUrl = await declaring(12345);

    const [failed] = await reachProviders({ baseUrls: [baseUrl], allowlist: LOOPBACK });

    expect(failed?.reach.kind).toBe("unreachable");
    if (failed?.reach.kind !== "unreachable") throw new Error("expected it to be unreachable");
    expect(failed.reach.reason.wrote).toBe("provider");
    expect(failed.reach.reason.text.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
  });

  /**
   * ONE DEAD PROVIDER MUST NOT EMPTY THE PAGE OF THE OTHERS, which is the whole
   * reason each provider catches its own. `Promise.all` over uncaught rejections
   * would take the working provider's state down with the broken one's.
   */
  it("answers for every provider when one of them fails", async () => {
    const working = await declaring({
      label: "a session",
      unlock_path: "/unlock",
      state: "valid",
      state_changed_at: "2026-09-12T09:00:00.000Z",
    });
    const broken = await declaring(12345);

    const reached = await reachProviders({
      baseUrls: [broken, working],
      allowlist: LOOPBACK,
    });

    // IN THE ORDER THE OWNER NAMED THEM, not the order they answered in.
    expect(reached.map(({ baseUrl }) => baseUrl)).toEqual([broken, working]);
    expect(reached[1]?.reach).toMatchObject({ kind: "reached", credential: { state: "valid" } });
  });

  /**
   * THE DECLARED PATH THAT LEFT THE PROVIDER, carried through the fan-out rather
   * than stopped at `unlockUrlFor`. The provider is up and its state is worth
   * showing, so the label and the state still arrive and only the link is
   * withheld -- refusing the whole manifest would report a reachable provider as
   * unreachable, which is the wrong diagnosis shown to the one person who can
   * fix it.
   */
  it("withholds the link, not the state, when the declared path leaves the provider", async () => {
    const baseUrl = await declaring({
      label: "a session",
      unlock_path: "//evil.test/unlock",
      state: "absent",
      state_changed_at: null,
    });

    const [reached] = await reachProviders({ baseUrls: [baseUrl], allowlist: LOOPBACK });

    expect(reached?.reach).toEqual({
      kind: "reached",
      credential: { label: "a session", unlockUrl: null, state: "absent", changedAt: null },
    });
  });

  /**
   * THE LABEL IS A STRANGER'S PROSE ON THE OWNER'S PAGE, and ADR-0123's argument
   * reaches it exactly as it reaches a failure reason: a provider choosing the
   * LENGTH of text on a page it does not own. The contract bounds it only by
   * `min(1)`, so nothing upstream stops a provider sending a manifest whose
   * label is the whole page.
   *
   * CUT RATHER THAN REFUSED, which is the choice `unlockUrlFor` makes for the
   * same reason: refusing the manifest over its label would report a reachable,
   * working provider as unreachable, and the Owner would go looking at their
   * network for a fault that is one field of prose.
   *
   * THE SAME CAP AND THE SAME FUNCTION as every other provider text this app
   * prints. ADR-0123's own words are that four sites mapping their own catch is
   * how that defect came to have two sites already.
   */
  it("cuts a label the provider made too long to be one sentence", async () => {
    const baseUrl = await declaring({
      label: "unbounded ".repeat(500),
      unlock_path: "/unlock",
      state: "absent",
      state_changed_at: null,
    });

    const [reached] = await reachProviders({ baseUrls: [baseUrl], allowlist: LOOPBACK });

    if (reached?.reach.kind !== "reached") throw new Error("expected it to be reached");
    expect(reached.reach.credential?.label.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
  });

  /**
   * A LABEL OF NOTHING IS STILL A PROVIDER ASKING FOR SOMETHING.
   *
   * The contract's `min(1)` admits a single space, which the cap collapses to
   * nothing — so without a floor the page renders an empty quotation where the
   * instruction goes, and the procedure's own `min(1)` on the way out turns that
   * into the 500 a Provider must not be able to cause. Found in review.
   *
   * IT REPORTS THE SILENCE RATHER THAN DRESSING IT UP, which is CNCORE-92's rule
   * and the one `reasonFor` already follows for a failure that named no reason.
   */
  it("says a provider needs something even when it described it in no words", async () => {
    const baseUrl = await declaring({
      label: "   ",
      unlock_path: "/unlock",
      state: "absent",
      state_changed_at: null,
    });

    const [reached] = await reachProviders({ baseUrls: [baseUrl], allowlist: LOOPBACK });

    if (reached?.reach.kind !== "reached") throw new Error("expected it to be reached");
    expect(reached.reach.credential?.label).toBe(
      "this Provider needs something, and did not say what.",
    );
  });
});
