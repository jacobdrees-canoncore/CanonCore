import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import {
  createProviderClient,
  OutboundRefused,
  parseAllowlist,
  REASON_MAX_LENGTH,
  reasonFor,
  searchProviders,
} from "./index";

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
 * What `provider-tmdb` answers for the record the contract test names as its
 * fixture. The id and the title are that suite's, chosen because they do not
 * move; the rest is left EMPTY rather than transcribed, because nothing here
 * asserts on a value and a half-remembered credit is a claim this file cannot
 * back. What it is for is a SECOND provider's answer, distinguishable from the
 * first.
 */
const THE_MATRIX = {
  id: "movie:603",
  title: "The Matrix",
  kind: "movie",
  released: [],
  writers: [],
  series: null,
  url: "https://www.themoviedb.org/movie/603",
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

  /**
   * ADR-0033's OTHER REQUIRED OPERATION, and the one this client did without
   * until CNCORE-77: a record reached by NAME rather than by an id obtained
   * from outside the product.
   *
   * `encodeURIComponent` RATHER THAN `URLSearchParams`, which is the obvious
   * choice and spells a space `+`. `%20` is the spelling the contract test
   * reaches both real providers with, so it is the one proven against them;
   * `+` is proven against neither.
   */
  it("finds candidates by name, so a record needs no id known in advance", async () => {
    const baseUrl = await stubProvider((request, response) => {
      expect(request.url).toBe("/search?q=The%20Tenth%20Planet");
      json(response, { results: [TENTH_PLANET] });
    });
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    const found = await client.search("The Tenth Planet");

    expect(found.results.map((candidate) => candidate.id)).toEqual(["265"]);
    expect(found.results[0]).toMatchObject({ title: "The Tenth Planet (TV story)" });
  });

  /**
   * CNCORE-33's READING, HELD FROM A THIRD CALLER OF `?q=`.
   *
   * AN EMPTY RESULT IS AN ANSWER; AN EMPTY QUERY IS A MISTAKE (ADR-0033). Both
   * real providers answer `400` to `?q=`, the contract test pins them to it,
   * and this is the app's side of the same rule: a client that turned that
   * refusal into `{ results: [] }` would hand a caller who never filled the
   * parameter in something shaped exactly like "nothing matched".
   */
  it("carries a provider's refusal of an empty query rather than reading it as no matches", async () => {
    const baseUrl = await stubProvider((request, response) => {
      const q = new URL(request.url ?? "/", "http://127.0.0.1").searchParams.get("q");
      if (q === null || q === "") {
        return json(response, { error: "a `q` query parameter is required" }, 400);
      }
      json(response, { results: [TENTH_PLANET] });
    });
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.search("")).rejects.toThrow(/400/);
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

  /*
   * THE HALF THE STATUS ALONE CANNOT CARRY (CNCORE-140). A provider that cannot
   * reach its own source answers `503` AND SAYS WHY, and until this the body was
   * cancelled unread -- so the sentence naming the remedy died at the boundary
   * and the Owner read `answered 503`.
   */
  it("carries a provider's own reason out of a failing answer, not only its status", async () => {
    const said = "provider-wiki's session was refused by the wiki. Supply a fresh one at /unlock.";
    const baseUrl = await stubProvider((_, response) =>
      json(response, { error: said, provider: "provider-wiki" }, 503),
    );
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.search("dalek")).rejects.toThrow(`/search?q=dalek answered 503: ${said}`);
  });

  /*
   * AND A PROVIDER THAT SAYS NOTHING STILL FAILS WITH SOMETHING READABLE. The
   * sentence the Owner gets is the one they got before CNCORE-140, rather than
   * that sentence with a colon hanging off it -- a body is the provider's
   * choice, and an empty one is a choice it is allowed to make.
   */
  it("still says what happened when a provider fails with no body at all", async () => {
    const baseUrl = await stubProvider((_, response) => {
      response.writeHead(502, { "content-type": "application/json" });
      response.end();
    });
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.search("dalek")).rejects.toThrow("/search?q=dalek answered 502.");
  });

  /*
   * AND A PROVIDER THAT SENDS THE FIELD WITH NOTHING IN IT HAS ALSO SAID
   * NOTHING. It is the same silence as an empty body wearing a different
   * spelling, and the honest answer to it is the same sentence -- not the
   * envelope quoted back with its braces showing, which is the stack of braces
   * ADR-0123 caps against.
   */
  it("reads an empty reason as a provider saying nothing, not as a body to quote", async () => {
    const baseUrl = await stubProvider((_, response) =>
      json(response, { error: "", provider: "a provider" }, 503),
    );
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.search("dalek")).rejects.toThrow("/search?q=dalek answered 503.");
  });

  /*
   * THE REASON THE BODY WAS BEING CANCELLED IS PRESERVED RATHER THAN REVERTED,
   * which is the half of CNCORE-140 that could have been lost fixing the other.
   *
   * THIS PROVIDER NEVER STOPS TALKING, so a client reading to the end waits out
   * `bodyTimeout` -- ten seconds, which is past this suite's own patience -- and
   * a client that read a prefix and walked away without cancelling would leave
   * the socket for `afterEach` to hang on. Both failures are visible here and
   * neither is visible from the message alone.
   */
  it("lets a socket go after reading enough, rather than waiting out a provider that never stops", async () => {
    const opening = "the wiki refused this provider's session.";
    const baseUrl = await stubProvider((_, response) => {
      response.writeHead(503, { "content-type": "text/plain" });
      response.write(opening);
      const talking = setInterval(() => response.write("x".repeat(1024)), 1);
      response.on("close", () => clearInterval(talking));
    });
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    await expect(client.search("dalek")).rejects.toThrow(opening);
  });

  /*
   * THE REMEDY SURVIVES THE CAP WITH THE VARIABLE HALF OF THE SENTENCE AT FULL
   * STRETCH, which is ADR-0123's own lesson about its own test. That record
   * found a cap eating the clause naming the setting to change, and found it
   * only because a value ahead of that clause grew -- while the test guarding it
   * used a short host and exercised the fixed prose alone.
   *
   * SO THE PATH IS A LONG ONE HERE. It is the one value this sentence
   * interpolates, it is the caller's own text, and a client that pasted it in
   * whole would push the provider's last words off the end of a 300-character
   * reason. Asserted AS A PAGE RECEIVES IT, through `reasonFor`, because that is
   * where the cap is actually applied.
   */
  it("keeps a provider's remedy whole when the path it failed on is a long one", async () => {
    const said =
      "provider-wiki could not reach tardis.wiki. Its session looks valid, so this is the " +
      "wiki or the network rather than the credential.";
    const baseUrl = await stubProvider((_, response) => json(response, { error: said }, 503));
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    const thrown = await client.search("dalek ".repeat(100)).catch((error: unknown) => error);

    const reason = reasonFor(thrown);
    expect(reason.text.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
    expect(reason.text).toContain(said);
  });

  /*
   * A FLOODING PROVIDER IS CUT WHERE ITS TEXT ENTERS THE SENTENCE, not only
   * where the sentence is printed.
   *
   * `reasonFor` caps what a PAGE renders, and that cap was already here. This
   * asserts the other consumer: `FailedProvider` in `search.ts` carries this
   * Error itself and reads `reason.message`, so text that was only bounded on
   * the way to a page would reach that one at whatever length the provider
   * chose. ADR-0123's rule is that the value is bounded WHERE IT ENTERS.
   *
   * IT FAILS IF THE INNER BOUND IS REMOVED, which the page-level cap alone does
   * not -- 300 characters get rendered either way, and the Error grows to
   * whatever arrived.
   */
  it("cuts a flooding provider's reason where it enters, not only where it is printed", async () => {
    const flood = `${"x".repeat(50_000)}TAIL`;
    const baseUrl = await stubProvider((_, response) => json(response, { error: flood }, 503));
    const client = createProviderClient({ baseUrl, allowlist: onLoopback() });

    const thrown = await client.search("dalek").catch((error: unknown) => error);

    const message = thrown instanceof Error ? thrown.message : String(thrown);
    // The provider's half is cut at the bound; the framing ahead of it is at
    // most 95 characters, and none of the flood's tail survives either cut.
    expect(message.length).toBeLessThanOrEqual(REASON_MAX_LENGTH + 95);
    expect(message).not.toContain("TAIL");
    expect(reasonFor(thrown).text.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
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

/**
 * A provider answering both operations a fan-out needs: the manifest, for the
 * name the provider gives ITSELF, and the search.
 *
 * It refuses `?q=` exactly as both real providers do (ADR-0033, CNCORE-33), so
 * that a fan-out which fanned an empty query out and then swallowed the
 * refusals would be visible here rather than only in production.
 */
async function stubSearchingProvider(manifest: unknown, results: unknown[]): Promise<string> {
  return stubProvider((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/") return json(response, manifest);
    const q = url.searchParams.get("q");
    if (q === null || q === "") {
      return json(response, { error: "a `q` query parameter is required" }, 400);
    }
    json(response, { results });
  });
}

/**
 * REACHING EVERY PROVIDER AT ONCE, which is a different operation from reaching
 * one and is why it is not a method on the client.
 *
 * ADR-0031 makes a provider a URL and nothing more, so there is no registry to
 * consult: the caller names the URLs, exactly as it names a record id for
 * `lookup`. What this adds over a loop is the two things a loop gets wrong --
 * whose answer each candidate is, and what happens when one of them falls over.
 */
describe("searching every provider at once", () => {
  it("answers each provider's candidates under the name that provider gives itself", async () => {
    // THE NAME RATHER THAN THE URL, because a source answers "who said this"
    // and `http://127.0.0.1:39481` shows a reader a deployment detail. The
    // manifest is where a provider says what it is called, so the fan-out reads
    // it -- the same reason `importRecordFromProvider` reads it before writing.
    const wiki = await stubSearchingProvider(MANIFEST, [TENTH_PLANET]);
    const tmdb = await stubSearchingProvider(TMDB_MANIFEST, [THE_MATRIX]);

    const found = await searchProviders(
      { baseUrls: [wiki, tmdb], allowlist: onLoopback() },
      "The Tenth Planet",
    );

    expect(
      found.answered.map((answer) => [answer.provider.name, answer.results.map((r) => r.id)]),
    ).toEqual([
      ["provider-wiki", ["265"]],
      ["provider-tmdb", ["movie:603"]],
    ]);
  });

  /**
   * ONE PROVIDER FALLING OVER IS NOT THE SEARCH FAILING, and the alternative is
   * worse than it looks: a fan-out that throws on the first failure hands the
   * owner nothing at all because one of the several sources they connected is
   * having a bad day, and it does it non-deterministically -- whichever
   * provider loses the race decides.
   *
   * THE FAILURE IS REPORTED RATHER THAN SWALLOWED. A provider that is down and
   * a provider that matched nothing are different answers, and collapsing them
   * into a short list is how an owner concludes their query was wrong.
   */
  it("goes on answering when one provider falls over, and says which one did", async () => {
    const wiki = await stubSearchingProvider(MANIFEST, [TENTH_PLANET]);
    const broken = await stubProvider((_, response) => json(response, { error: "boom" }, 500));

    const found = await searchProviders(
      { baseUrls: [wiki, broken], allowlist: onLoopback() },
      "The Tenth Planet",
    );

    expect(
      found.answered.map((answer) => [answer.provider.name, answer.results.map((r) => r.id)]),
    ).toEqual([["provider-wiki", ["265"]]]);
    expect(found.failed.map((failure) => failure.baseUrl)).toEqual([broken]);
    // THE ERROR TRAVELS WHOLE rather than flattened to a sentence, so that a
    // caller can still tell an `OutboundRefused` from a provider that answered
    // badly -- which is the distinction `packages/api` maps onto a declared
    // error rather than a 500 (ADR-0034).
    expect(found.failed[0]?.reason.message).toMatch(/500/);
  });

  /**
   * WHERE THIS FILE'S TWO RULES MEET, AND WOULD CANCEL EACH OTHER OUT.
   *
   * `?q=` is the caller's mistake and every provider answers it `400`
   * (ADR-0033, CNCORE-33). A provider that fails is tolerated, just above. Put
   * together without this, an empty query fans out, collects a refusal from
   * every provider, tolerates each one -- and answers `{ answered: [], failed:
   * [...] }`, which an owner reads as "nothing matched". The mistake would have
   * been hidden by the very leniency that makes the fan-out worth having.
   *
   * SO THE FAN-OUT REFUSES WHERE THE CLIENT SENDS, and that is not the two
   * disagreeing. The client is a transport and reports what came back, which is
   * what keeps it a third caller of `?q=`; the fan-out is the thing that
   * tolerates failure, and tolerance is exactly why the mistake has to be
   * caught before it becomes tolerable.
   */
  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["other whitespace", "\t\n"],
  ])(
    "refuses a query that is %s rather than fanning it out and tolerating the refusals",
    async (_description: string, query: string) => {
      const asked: string[] = [];
      const wiki = await stubProvider((request, response) => {
        asked.push(request.url ?? "");
        json(response, MANIFEST);
      });

      await expect(
        searchProviders({ baseUrls: [wiki], allowlist: onLoopback() }, query),
      ).rejects.toThrow();
      // AND NOTHING WAS ASKED. A refusal after the requests went out would
      // still have spent them, and would still have to decide what to do with a
      // provider that answered `400` to a query nobody meant to send.
      expect(asked).toEqual([]);
    },
  );

  /**
   * A URL THE OWNER NEVER ALLOWLISTED IS ONE PROVIDER FAILING, not the search
   * failing -- and it arrives here as the SAME KIND of failure a broken
   * provider does, which is why the two are one list.
   *
   * IT STAYS AN `OutboundRefused`, which is the whole reason `reason` carries
   * the error rather than a sentence. ADR-0034's refusals are answers a UI has
   * to be able to put in front of an owner, and `packages/api` maps them onto a
   * declared error instead of a 500; flattened to a string, that distinction
   * would have to be recovered by reading prose.
   */
  it("reports a provider it may not reach without emptying the answers of the ones it may", async () => {
    const wiki = await stubSearchingProvider(MANIFEST, [TENTH_PLANET]);
    // Refused before a socket opens, so nothing resolves this name and the
    // suite's network gate never sees a request.
    const unallowlisted = "http://provider.invalid/";

    const found = await searchProviders(
      { baseUrls: [wiki, unallowlisted], allowlist: onLoopback() },
      "The Tenth Planet",
    );

    expect(found.answered.map((answer) => answer.provider.name)).toEqual(["provider-wiki"]);
    expect(found.failed.map((failure) => failure.baseUrl)).toEqual([unallowlisted]);
    expect(found.failed[0]?.reason).toBeInstanceOf(OutboundRefused);
  });
});
