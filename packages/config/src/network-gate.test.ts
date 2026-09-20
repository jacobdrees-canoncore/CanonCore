import { createServer, type Server } from "node:http";
import { MockAgent, setGlobalDispatcher } from "undici";
import { afterAll, afterEach, describe, expect, it } from "vitest";

/**
 * undici's own code for a request the gate refused. ASSERTED RATHER THAN A BARE
 * `rejects.toThrow()`, and the difference is the whole test: a machine with no
 * network throws on that fetch too, so a bare rejection passes with the gate
 * removed on exactly the runner the gate exists for.
 */
const REFUSED = "UND_MOCK_ERR_MOCK_NOT_MATCHED";

/** What the gate did to a request, or `null` if it let one through. */
async function refusal(request: Promise<Response>): Promise<unknown> {
  return request.then(
    () => null,
    // Node's `fetch` wraps everything the dispatcher throws in a TypeError, so
    // the refusal is the CAUSE and never the message.
    (error: Error) => error.cause,
  );
}

/**
 * A REAL SOCKET on loopback, which is what the carve-out exists for: the
 * end-to-end run reaches the app it started this way, and in CI the provider is
 * a service container reached the same way (`PROVIDER_TMDB_URL` is
 * `http://127.0.0.1:8081`; it named the wiki's until CNCORE-143 moved that
 * image out of the job).
 */
const servers: Server[] = [];

async function onLoopback(): Promise<string> {
  const server = createServer((_, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"answered":true}');
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))),
  );
});

describe("the network gate", () => {
  it("throws on egress to a host no test asked for", async () => {
    expect(await refusal(fetch("https://example.com/"))).toMatchObject({ code: REFUSED });
  });

  it("leaves loopback reachable, which the suites that stand a server up need", async () => {
    const response = await fetch(`${await onLoopback()}/anything`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ answered: true });
  });

  /**
   * The carve-out is the only widening in the gate, so it is the only place a
   * hole can be. Each of these is a host a pattern aiming at loopback and
   * getting sloppy would admit, and the assertion is `REFUSED` rather than any
   * rejection: an unroutable address ALSO fails a real request, so a bare
   * `rejects` here would pass with the carve-out standing wide open.
   *
   * Two shapes are deliberately absent because `fetch` never gets far enough to
   * consult the gate about them: a host ENDING in the address is not a URL at
   * all (the WHATWG parser reads a trailing all-numeric label as an IPv4
   * address and refuses `not-127.0.0.1` outright), and a URL carrying the
   * address as USERINFO is refused by the `Request` constructor before any
   * dispatcher sees it.
   */
  it.each([
    // The SSRF classic. Not loopback, and refused by ADR-0034's content rule
    // too -- but that rule is the app's, and this gate is the harness's.
    "http://169.254.169.254/latest/meta-data/",
    // Starts with the address and keeps going, which a pattern with no closing
    // anchor takes. A registrable domain can be spelled this way for real.
    "http://127.0.0.1.provider.test/",
    // ENDS with `localhost`, which a pattern with no opening anchor takes. Not
    // hypothetical: Debian writes this name into /etc/hosts.
    "http://ip6-localhost/",
  ])("refuses %s, which no suite here binds", async (url) => {
    expect(await refusal(fetch(url))).toMatchObject({ code: REFUSED });
  });
});

/**
 * THE THIRD OF THE THREE PLACES THE GATE COULD NOT SEE (CNCORE-30). The gate
 * sets the global dispatcher as the setup file loads; a test that sets one
 * itself takes that dispatcher's place, and until this pair was written nothing
 * put the gate back -- so the rest of the FILE ran with the gate off.
 *
 * THESE TWO TESTS ARE ORDER-DEPENDENT, deliberately and unavoidably: the
 * property under test is what the SECOND test sees after the FIRST one swapped,
 * and there is no way to observe that from inside one test.
 */
describe("a test that swaps the global dispatcher", () => {
  /**
   * A dispatcher that ANSWERS where the gate refuses, which is what makes the
   * second test below able to tell them apart. `disableNetConnect` with the
   * interceptor persisted, so this agent cannot reach the network on any path:
   * a test whose failure mode is a real request is the thing the gate exists to
   * stop, and it would be absurd here of all files.
   */
  const rogue = new MockAgent();
  rogue.disableNetConnect();
  rogue
    .get("https://example.com")
    .intercept({ path: "/" })
    .reply(200, "the rogue answered")
    .persist();

  afterAll(async () => {
    await rogue.close();
  });

  it("takes effect for the test that swapped it", async () => {
    setGlobalDispatcher(rogue);

    await expect((await fetch("https://example.com/")).text()).resolves.toBe("the rogue answered");
  });

  it("has not left the gate off for the rest of the file", async () => {
    expect(await refusal(fetch("https://example.com/"))).toMatchObject({ code: REFUSED });
  });
});
