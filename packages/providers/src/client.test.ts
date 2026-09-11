import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { createProviderClient, OutboundRefused, parseAllowlist } from "./index";

/**
 * A stand-in for a provider, on a REAL SOCKET on loopback.
 *
 * Not a mocked fetch. The thing under test is a client that resolves a
 * hostname, pins a connection and reads a redirect, and none of that happens
 * when the transport is replaced -- an interceptor would prove the URL was
 * assembled and nothing else. This is the same address CanonCore's CI reaches
 * the real provider on.
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

const json = (response: ServerResponse, body: unknown, status = 200) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

/** What the wiki provider actually answers, trimmed to one record. */
const MANIFEST = {
  name: "provider-wiki",
  versions: [1],
  operations: ["search", "lookup"],
  max_cache_age: 2592000,
  images: { stored_variant: null, per_role_limit: 0, quality_floor: 0 },
};

/**
 * What the TMDB provider actually answers, captured from the running image on
 * 2026-09-11 and trimmed in exactly one place: `data_uri` carries 3KB of base64
 * SVG there and a one-pixel GIF here, because what this suite is asking is
 * whether the SHAPE parses. Whether the real bytes are an image is the contract
 * test's question, and it asks it of the real provider rather than of a copy.
 *
 * IT IS HERE BECAUSE IT DID NOT PARSE. `images.stored_variant` WAS `string | null`
 * in ADR-0033 and in this package, and TMDB answers a map -- so `client.manifest()`
 * threw a ZodError against the real second provider, and every import through it
 * failed at the first call. That is the divergence CNCORE-8 exists to catch,
 * caught before its test was written; the record has since been corrected in the
 * sentence that fixed the type, and this package widened to match.
 */
const TMDB_MANIFEST = {
  name: "provider-tmdb",
  versions: [1],
  operations: ["search", "lookup", "browse"],
  max_cache_age: 15552000,
  images: {
    stored_variant: { poster: "w500", backdrop: "w780", still: "w300" },
    per_role_limit: 1,
    quality_floor: 300,
  },
  attribution: {
    notice:
      "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
    logo: {
      data_uri: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
      alt: "The Movie Database (TMDB). TMDB does not endorse, certify or approve this application.",
    },
  },
};

const TENTH_PLANET = {
  id: "265",
  title: "The Tenth Planet (TV story)",
  kind: "TV story",
  released: ["1966-10-08"],
  writers: ["Kit Pedler", "Gerry Davis"],
  series: "Doctor Who television stories",
  url: "https://tardis.wiki/wiki/The_Tenth_Planet_(TV_story)",
};

/**
 * ADR-0057's fixture, `Category:Vashta Nerada audio stories` (388305), exactly
 * as `provider-wiki` answers a browse of it.
 *
 * NIGHT AND DAY OF THE VASHTA NERADA SHARE POSITION 1, and that is real data
 * rather than a contrived case: they are two halves of one box set, the archive
 * dates both 2017-07-27, and a provider that ordered them anyway would be
 * handing over a claim its source never made (ADR-0009).
 */
const VASHTA_NERADA = {
  container: {
    id: "388305",
    title: "Category:Vashta Nerada audio stories",
    kind: "category",
    released: [],
    writers: [],
    series: null,
    url: "https://tardis.wiki/wiki/Category:Vashta_Nerada_audio_stories",
  },
  ordering: [
    {
      position: 1,
      record: {
        id: "222467",
        title: "Night of the Vashta Nerada (audio story)",
        kind: "audio story",
        released: ["2017-07-27"],
        writers: ["John Dorney"],
        series: null,
        url: "https://tardis.wiki/wiki/Night_of_the_Vashta_Nerada_(audio_story)",
      },
    },
    {
      position: 1,
      record: {
        id: "222478",
        title: "Day of the Vashta Nerada (audio story)",
        kind: "audio story",
        released: ["2017-07-27"],
        writers: ["John Dorney"],
        series: null,
        url: "https://tardis.wiki/wiki/Day_of_the_Vashta_Nerada_(audio_story)",
      },
    },
  ],
  unplaced: [
    {
      id: "355593",
      title: "Operation Dusk (audio story)",
      kind: "audio story",
      released: [],
      writers: [],
      series: null,
      url: "https://tardis.wiki/wiki/Operation_Dusk_(audio_story)",
    },
  ],
};

/**
 * The allowlist all but one of the clients below is built with. A loopback base
 * URL is legal BY NAME, which is the allowlist's whole job -- and it is WHAT
 * KEEPS THIS SUITE OFF THE NETWORK. The repository's network gate cannot see
 * these requests: the client hands each `fetch` one of its own two dispatchers,
 * which is how ADR-0034's boundaries are hung, and a dispatcher that was named
 * is never the global one the gate installs. Measured under CNCORE-27 -- with
 * the gate's loopback carve-out narrowed to match nothing, every test in this
 * file still passes.
 *
 * So a client built here with a public host allowlisted would reach that host
 * for real, on whichever machine happens to have a network. CNCORE-30 decided
 * not to close that with a harness control; this line is the control.
 *
 * THE ONE EXCEPTION IS BELOW AND IS SAFE, which is worth knowing before reading
 * it as a counter-example: one test allowlists `wiki.example.com` while pointing
 * the client at a loopback stub, so the base URL is REFUSED before a socket
 * opens -- that refusal is what the test is about. A public host in the
 * allowlist AND in the base URL together is the shape nothing here stops.
 */
const onLoopback = () => parseAllowlist("127.0.0.0/8");

describe("the CMPP client", () => {
  it("reads a provider's manifest over HTTP", async () => {
    const baseUrl = await stubProvider((_, response) => json(response, MANIFEST));
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).resolves.toMatchObject({
      name: "provider-wiki",
      versions: [1],
      operations: ["search", "lookup"],
    });
  });

  /**
   * ADR-0032: a provider declares an ARRAY, and ABSENCE MEANS THE FIRST
   * VERSION. Never make the field required -- the W3C spec this rule comes from
   * contradicts itself by listing `versions` under `required` in its schema
   * while inferring 0.1 from absence in its prose, and we take the prose.
   */
  it("reads a manifest with no versions field as the first version", async () => {
    const { versions: _, ...silent } = MANIFEST;
    const baseUrl = await stubProvider((_, response) => json(response, silent));
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).resolves.toMatchObject({ versions: [1] });
  });

  /**
   * ADR-0033 FIXED `images.stored_variant` as `string | null` and gave TMDB's
   * `w500` as the example. TMDB cannot answer that: `/configuration` puts `w500`
   * in `poster_sizes` and in NEITHER `backdrop_sizes` NOR `still_sizes`, so one
   * string for every role names a size that 404s for two of the three.
   *
   * So the field is widened here rather than the second provider being held to a
   * shape its source makes impossible. A CONSUMER'S schema widens cheaply --
   * nothing in this app reads the value yet -- and narrowing a provider that is
   * already right would have been spending a correction to create a bug. The
   * record carries the correction now, in the sentence that fixed the type.
   */
  it("reads a stored variant that names a size per role, not one size for all", async () => {
    const baseUrl = await stubProvider((_, response) => json(response, TMDB_MANIFEST));
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).resolves.toMatchObject({
      name: "provider-tmdb",
      images: { stored_variant: { poster: "w500", backdrop: "w780", still: "w300" } },
    });
  });

  /**
   * ADR-0033: "a third party's licence terms stay declared fields rather than
   * special cases in our core". The notice is one of those terms, so it arrives
   * on the wire and the app renders what it was handed -- rather than CanonCore
   * holding a table of which provider owes which sentence, which is the same rule
   * broken through a different door.
   */
  it("reads the attribution a source's licence obliges the app to show", async () => {
    const baseUrl = await stubProvider((_, response) => json(response, TMDB_MANIFEST));
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).resolves.toMatchObject({
      attribution: {
        notice:
          "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
        logo: {
          data_uri: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
          alt: "The Movie Database (TMDB). TMDB does not endorse, certify or approve this application.",
        },
      },
    });
  });

  /**
   * THE LEGAL OTHER FORM OF A `data:` URI. `data:image/svg+xml,%3Csvg%3E` is
   * percent-encoded rather than base64 and is perfectly valid -- and everything
   * downstream here assumes base64, because that is what a provider that read the
   * comment sends. Refused at the schema rather than rendered as a broken image:
   * this value reaches an `img` on every page the source's claims appear on, and
   * a mark that does not render is an unmet obligation that looks like whitespace.
   */
  it("refuses a logo that is legal and not base64", async () => {
    const baseUrl = await stubProvider((_, response) =>
      json(response, {
        ...TMDB_MANIFEST,
        attribution: {
          notice: "A notice.",
          logo: { data_uri: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E", alt: "A mark." },
        },
      }),
    );
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).rejects.toThrow(/base64/);
  });

  /**
   * AND ONE THAT IS BASE64 AND ENORMOUS. `MAX_BODY_BYTES` caps the manifest at
   * 4 MiB, which is a cap on ONE RESPONSE and not on what this field costs: the
   * bytes are inlined into every page the source's claims appear on, and into
   * every row of the page's HTML that carries them. A mark is a wordmark, so the
   * ceiling is generous and finite rather than absent.
   */
  it("refuses a mark far larger than any mark", async () => {
    const baseUrl = await stubProvider((_, response) =>
      json(response, {
        ...TMDB_MANIFEST,
        attribution: {
          notice: "A notice.",
          logo: { data_uri: `data:image/png;base64,${"A".repeat(300_000)}`, alt: "A mark." },
        },
      }),
    );
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).rejects.toThrow();
  });

  /**
   * A SOURCE THAT OWES NOTHING SAYS SO, and the wiki provider is one: the archive
   * imposes no notice and no mark. `null` rather than an absent key, so "this
   * source requires no attribution" is a declaration the app can act on instead of
   * a silence it has to interpret -- the same shape ADR-0033 gives `per_role_limit`
   * of 0, where "0 says this provider serves no images, which is a declaration and
   * not an unset field".
   */
  it("reads a provider that owes no attribution as owing none", async () => {
    const baseUrl = await stubProvider((_, response) => json(response, MANIFEST));
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).resolves.toMatchObject({ attribution: null });
  });

  /** And the incumbent shape goes on parsing, which is the half a widening breaks. */
  it("goes on reading a single stored variant, and one that is absent", async () => {
    const baseUrl = await stubProvider((_, response) =>
      json(response, { ...MANIFEST, images: { ...MANIFEST.images, stored_variant: "w500" } }),
    );
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });
    await expect(client.manifest()).resolves.toMatchObject({
      images: { stored_variant: "w500" },
    });

    const nullVariant = await stubProvider((_, response) => json(response, MANIFEST));
    const other = createProviderClient({ baseUrl: nullVariant, allowlist: onLoopback() });
    await expect(other.manifest()).resolves.toMatchObject({
      images: { stored_variant: null },
    });
  });

  it("looks one record up by its stable id", async () => {
    const baseUrl = await stubProvider((request, response) => {
      expect(request.url).toBe("/lookup/265");
      json(response, TENTH_PLANET);
    });
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.lookup("265")).resolves.toMatchObject({
      id: "265",
      released: ["1966-10-08"],
      writers: ["Kit Pedler", "Gerry Davis"],
    });
  });

  it("answers with nothing for an id the provider does not hold", async () => {
    const baseUrl = await stubProvider((_, response) => json(response, { error: "no" }, 404));
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.lookup("9999")).resolves.toBeNull();
  });

  /**
   * A provider that answers something else is a provider we cannot read, and
   * saying so beats importing `undefined` into the catalogue under the
   * provider's name.
   */
  it("refuses a response that is not in the CMPP shape", async () => {
    const baseUrl = await stubProvider((_, response) => json(response, { id: "265" }));
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.lookup("265")).rejects.toThrow();
  });

  it("reads a container and its ordering together", async () => {
    // THE WHOLE REASON `browse` EXISTS (ADR-0033): the container and the
    // ordering arrive in one answer, so a bulk import is one call rather than
    // one per member plus a guess at the order.
    const baseUrl = await stubProvider((request, response) => {
      expect(request.url).toBe("/browse/388305");
      json(response, VASHTA_NERADA);
    });
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    const browsed = await client.browse("388305");

    expect(browsed?.container).toMatchObject({ id: "388305", kind: "category" });
    expect(browsed?.ordering.map((placed) => [placed.position, placed.record.id])).toEqual([
      [1, "222467"],
      [1, "222478"],
    ]);
    expect(browsed?.unplaced.map((record) => record.id)).toEqual(["355593"]);
  });

  it("answers with nothing for a page that addresses no container", async () => {
    // A story holds nothing, so its page id addresses no container -- the same
    // answer as an id nobody minted (ADR-0066), and the caller cannot tell them
    // apart because neither names anything.
    const baseUrl = await stubProvider((_, response) =>
      json(response, { error: "no such container" }, 404),
    );
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.browse("265")).resolves.toBeNull();
  });

  it("refuses a browse whose ordering is missing rather than reading it as empty", async () => {
    // `ordering` is required and NOT defaulted: an absent ordering is a
    // malformed browse, and reading it as an empty one would import a container
    // with no members and call that success.
    const { ordering: _, ...malformed } = VASHTA_NERADA;
    const baseUrl = await stubProvider((_, response) => json(response, malformed));
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.browse("388305")).rejects.toThrow();
  });

  it("reports a provider that fails rather than answering empty", async () => {
    // A 500 is the provider being broken, which is not the same answer as a 404
    // -- that one means "no such record" and resolves to null.
    const baseUrl = await stubProvider((_, response) => json(response, { error: "boom" }, 500));
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.lookup("265")).rejects.toThrow(/500/);
  });
});

describe("the client's outbound boundaries", () => {
  /**
   * The base URL is checked BEFORE anything is sent. A client that refuses only
   * once the socket is open has already told an unallowlisted host that it
   * exists.
   */
  it("refuses a base URL the owner never allowlisted, without connecting", async () => {
    let reached = false;
    const baseUrl = await stubProvider((_, response) => {
      reached = true;
      json(response, MANIFEST);
    });
    const client = createProviderClient({ baseUrl, allowlist: parseAllowlist("wiki.example.com") });

    await expect(client.manifest()).rejects.toThrow(OutboundRefused);
    expect(reached).toBe(false);
  });

  /**
   * THE NO-EXCEPTION HALF, and the reason both boundaries exist rather than one.
   *
   * This provider's base URL is allowlisted. The redirect it returns is NOT
   * covered by that: a redirect is a content URL, and an allowlisted provider
   * that is compromised or merely buggy must not be able to walk the fetcher
   * onto the metadata endpoint.
   */
  it("refuses a redirect onto the cloud metadata endpoint", async () => {
    const baseUrl = await stubProvider((_, response) => {
      response.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
      response.end();
    });
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).rejects.toThrow(OutboundRefused);
    await expect(client.manifest()).rejects.toThrow("169.254.169.254");
  });

  /**
   * AND THE ALLOWLIST DOES NOT REACH THE REDIRECT EITHER. `127.0.0.0/8` is what
   * makes the base URL legal, and it buys the hop nothing: content is untrusted
   * whatever network it names, so loopback is refused here exactly as
   * Tailscale's `100.64.0.0/10` would be.
   */
  it("refuses a redirect onto loopback even though loopback is allowlisted", async () => {
    const elsewhere = await stubProvider((_, response) => json(response, MANIFEST));
    const baseUrl = await stubProvider((_, response) => {
      response.writeHead(302, { location: elsewhere });
      response.end();
    });
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).rejects.toThrow(OutboundRefused);
    await expect(client.manifest()).rejects.toThrow("loopback");
  });

  /**
   * The redirect is READ AND JUDGED, not merely un-followed. A client that
   * simply returned the 302 as a response would also fail this call, so the
   * refusal has to name the target to prove which of the two happened.
   */
  it("names the refused hop rather than failing on the 302 itself", async () => {
    const baseUrl = await stubProvider((_, response) => {
      response.writeHead(307, { location: "http://[fd00:ec2::254]/" });
      response.end();
    });
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).rejects.toThrow("fd00:ec2::254");
  });
});

/**
 * Found in review: values arriving from the provider that reach something which
 * ACTS on them. A base URL is the owner's; everything below is the provider's,
 * and a provider can be buggy or compromised -- which is ADR-0034's own stated
 * reason for the content boundary existing at all.
 */
describe("what the client will take from a provider", () => {
  it("refuses a Location it cannot even parse, rather than throwing a TypeError", async () => {
    // `new URL("http://[invalid", base)` throws a bare TypeError, which is not
    // an OutboundRefused -- so it escaped the router's error mapping and became
    // a 500. A provider must not be able to crash the request that reads it.
    const baseUrl = await stubProvider((_, response) => {
      response.writeHead(302, { location: "http://[invalid" });
      response.end();
    });
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).rejects.toThrow(OutboundRefused);
  });

  it("refuses a Location naming a scheme that is not HTTP", async () => {
    const baseUrl = await stubProvider((_, response) => {
      response.writeHead(302, { location: "file:///etc/passwd" });
      response.end();
    });
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).rejects.toThrow(OutboundRefused);
  });

  /**
   * A body with no end is a body that fills memory. `bodyTimeout` caps how LONG
   * a provider may take and says nothing about how MUCH it may send, and on
   * loopback ten seconds is a great deal of it.
   */
  it("refuses a response body past the size it will read", async () => {
    const baseUrl = await stubProvider((_, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      // Valid JSON that simply never stops arriving.
      response.write('{"name":"provider-wiki","versions":[1],"operations":[');
      const chunk = `"${"x".repeat(64 * 1024)}",`;
      for (let written = 0; written < 6 * 1024 * 1024; written += chunk.length) {
        response.write(chunk);
      }
      response.end('"search"]}');
    });
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).rejects.toThrow(/too large|size/i);
  });

  it("still reads an ordinary response", async () => {
    const baseUrl = await stubProvider((_, response) => json(response, MANIFEST));
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.manifest()).resolves.toMatchObject({ name: "provider-wiki" });
  });
});
