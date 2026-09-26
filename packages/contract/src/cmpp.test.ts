import { describe, expect, it } from "vitest";

import { containersResponse, manifest, record } from "./cmpp";

/**
 * WHAT THE SPECIFICATION REFUSES, asserted against the specification itself.
 *
 * The suite next door holds real providers to this shape over HTTP, and it
 * cannot prove this half: no provider under test sends a `javascript:` URL, so
 * an assertion that only watched their traffic would pass forever without the
 * rule existing. What obliges a provider is what this document says, so this is
 * where the obligation is checked.
 */

/** A record that satisfies the contract, so a case below differs in one field. */
const A_RECORD = {
  id: "265",
  title: "The Tenth Planet",
  kind: "TV story",
  released: ["1966-10-08"],
  writers: ["Kit Pedler"],
  series: null,
  url: "https://example.invalid/265",
};

/**
 * THE FOUR SCHEMES THAT ACTUALLY GOT THROUGH, measured against zod 4.5.4 rather
 * than reasoned about: `z.url()` asks whether a string parses as a URL and says
 * nothing about its scheme, so each of these parsed clean.
 *
 * FOUR RATHER THAN ONE REPRESENTATIVE, because they are four different sinks --
 * `javascript:` and `vbscript:` execute, `data:` carries a document with its own
 * origin, `file:` reads the reader's own disk -- and a rule written against one
 * of them can miss the others.
 */
const NOT_HTTP = [
  "javascript:alert(1)",
  "data:text/html,<script>x</script>",
  "vbscript:x",
  "file:///etc/passwd",
];

describe("the contract's record url", () => {
  it.each(NOT_HTTP)("refuses %s, so a provider may not send one", (url) => {
    expect(record.safeParse({ ...A_RECORD, url }).success).toBe(false);
  });

  /**
   * THE HALF THAT STOPS THE RULE BEING "REFUSE EVERYTHING", which the cases
   * above cannot tell apart from the rule the contract wants.
   *
   * The loopback case is the one worth naming. The contract is the INTERSECTION
   * every provider must satisfy, and a provider its owner runs on their own
   * machine is legal by name under ADR-0034 -- so a self-link from one is a
   * conformant value, and a rule that refused it would be the contract quietly
   * requiring a public domain.
   */
  it.each([
    ["https://tardis.wiki/wiki/The_Tenth_Planet", "the ordinary case"],
    ["http://example.invalid/265", "HTTP, because a provider on a LAN has no certificate"],
    ["HTTPS://Example.Invalid/265", "a scheme is case-insensitive, so this is the same scheme"],
    ["http://127.0.0.1:8080/265", "a provider the owner runs on loopback, linking to itself"],
  ])("admits %s: %s", (url) => {
    expect(record.safeParse({ ...A_RECORD, url }).success).toBe(true);
  });
});

/**
 * AN IMAGE REFERENCE CARRIES TWO URLS, and both reach a reader.
 *
 * `url` is where the BYTES are, which ADR-0037's store is filled from, so a
 * non-HTTP one is a value the fetcher is handed. `description_url` is the
 * source's own page for the file, which is rendered as a LINK beside the credit
 * -- the same sink a record's `url` is, one field along. Checking the first and
 * not the second would leave the rule true of the half nobody clicks.
 */
describe("the contract's image urls", () => {
  const anImage = { role: "poster", url: "https://example.invalid/poster.jpg" };

  it.each(NOT_HTTP)("refuses %s where the bytes are", (url) => {
    const images = [{ ...anImage, url }];
    expect(record.safeParse({ ...A_RECORD, images }).success).toBe(false);
  });

  it.each(NOT_HTTP)("refuses %s as the page describing the file", (description_url) => {
    const images = [{ ...anImage, description_url }];
    expect(record.safeParse({ ...A_RECORD, images }).success).toBe(false);
  });

  /**
   * `description_url` IS NULLABLE AND OPTIONAL, and the scheme rule must not
   * have quietly taken that away: TMDB serves no file description pages, so a
   * provider that omits it or sends `null` is conformant and has to stay so.
   */
  it("still lets a source say it has no description page", () => {
    const omitted = record.safeParse({ ...A_RECORD, images: [anImage] });
    const explicit = record.safeParse({
      ...A_RECORD,
      images: [{ ...anImage, description_url: null }],
    });

    expect(omitted.success).toBe(true);
    expect(explicit.success).toBe(true);
  });
});

/** A manifest that satisfies the contract, so a case below differs in one field. */
const A_MANIFEST = {
  name: "a provider",
  operations: ["search", "lookup"],
};

/** A credential declaration that satisfies it, for the same reason. */
const A_CREDENTIAL = {
  label: "A browser session for the upstream this provider reads",
  fields: [{ name: "cf_clearance", label: "The cookie a browser gets by passing the check" }],
  unlock_path: "/unlock",
  state: "absent",
  state_changed_at: null,
};

describe("the contract's credential declaration", () => {
  it("is optional, so a provider whose upstream wants nothing declares nothing", async () => {
    // ADR-0122 rests on this and ADR-0032 governs the version: `manifest` is a
    // loose object, so an OPTIONAL field is an addition rather than a change and
    // CMPP's version does not move for it. `provider-tmdb` declares no credential
    // and is untouched by this ticket -- a contract addition that obliged every
    // existing provider to answer for itself would be a new contract.
    const declared = manifest.safeParse(A_MANIFEST);

    expect(declared.success).toBe(true);
    expect(declared.data?.credential).toBeUndefined();
  });

  it("carries a label, the fields, the path and the state when it is there", async () => {
    const declared = manifest.parse({ ...A_MANIFEST, credential: A_CREDENTIAL });

    expect(declared.credential).toEqual(A_CREDENTIAL);
  });

  it.each(["absent", "valid", "expired"])("admits the state %s", (state) => {
    expect(
      manifest.safeParse({ ...A_MANIFEST, credential: { ...A_CREDENTIAL, state } }).success,
    ).toBe(true);
  });

  /**
   * WHAT IS REFUSED, which is the half that stops the rule being "accept
   * anything shaped like an object".
   *
   * The declaration is the ONLY thing CanonCore renders about a credential --
   * it does not render the fields and it never carries the answer (ADR-0122) --
   * so a malformed one is a settings page with a blank where the Owner's
   * instruction should be, and nothing downstream can reconstruct it.
   */
  it.each([
    [
      { ...A_CREDENTIAL, state: "unknown" },
      "a fourth state, which ADR-0122 closes the set against",
    ],
    [{ ...A_CREDENTIAL, label: "" }, "an empty label, which tells the Owner nothing"],
    [{ ...A_CREDENTIAL, fields: [] }, "no fields, so there is nothing to supply"],
    [
      { ...A_CREDENTIAL, unlock_path: "https://example.invalid/unlock" },
      "a URL where a path belongs: the provider does not know the address CanonCore reaches it on",
    ],
    [{ ...A_CREDENTIAL, unlock_path: "unlock" }, "a relative path, which joins to the wrong place"],
    [
      { ...A_CREDENTIAL, state_changed_at: "a while ago" },
      "a time that is not a time, which renders as prose the Owner cannot act on",
    ],
    [
      { ...A_CREDENTIAL, fields: [{ name: "cf_clearance" }] },
      "a field with no label, which is the provider naming itself rather than saying what it wants",
    ],
  ])("refuses %o -- %s", (credential, _why) => {
    expect(manifest.safeParse({ ...A_MANIFEST, credential }).success).toBe(false);
  });

  it("takes a null state_changed_at, because nothing supplied has no moment", async () => {
    // Absent-and-never-supplied is the ordinary case on a fresh install, and a
    // provider inventing `now` for it would tell the Owner it had just lost
    // something it never had.
    const declared = manifest.parse({
      ...A_MANIFEST,
      credential: { ...A_CREDENTIAL, state_changed_at: null },
    });

    expect(declared.credential?.state_changed_at).toBeNull();
  });
});

/**
 * WHAT THE `containers` OPERATION ANSWERS, asserted against the specification itself.
 *
 * The shape a provider is held to here is the one the suite next door cannot
 * prove: no provider under test sends a bare id, so an assertion that only
 * watched their traffic would pass forever without the rule existing.
 */
describe("the contract's containers response", () => {
  it("carries records, so a container arrives ready to render", async () => {
    const answered = containersResponse.parse({ containers: [A_RECORD] });

    expect(answered.containers[0]?.id).toBe(A_RECORD.id);
  });

  it("admits an empty list, because a source that holds no containers is answering", async () => {
    // The same reading `search`'s empty `results` gets. It is NOT how a provider
    // says it does not offer the operation -- that is declared in the manifest,
    // and conflating the two is what this operation exists to stop.
    const answered = containersResponse.parse({ containers: [] });

    expect(answered.containers).toEqual([]);
  });

  it("refuses a bare id, which is the shape that would cost a second call", async () => {
    // ADR-0004: a container is a record like any other, and `browse` already
    // answers one as a record. A provider sending ids alone would oblige the app
    // to `lookup` every one of them before it could show the Owner a name.
    expect(containersResponse.safeParse({ containers: [A_RECORD.id] }).success).toBe(false);
  });
});

/**
 * WHICH OPERATIONS A MANIFEST MAY DECLARE TOGETHER.
 *
 * The one rule the operations list carries beyond "the required two are there",
 * and it is here rather than in the suite next door because no provider under
 * test declares the pair wrongly -- so watching their traffic would never
 * exercise it.
 */
describe("the contract's operations", () => {
  it("lets a provider decline `containers`, as it declines `browse`", async () => {
    // The whole basis on which an operation can be added to a shipped contract
    // (ADR-0032): a provider that wants nothing to do with it is untouched on
    // the day it lands. Both real providers are exactly this.
    expect(manifest.safeParse(A_MANIFEST).success).toBe(true);
  });

  it("admits a provider that lists its containers and browses them", async () => {
    expect(
      manifest.safeParse({
        ...A_MANIFEST,
        operations: ["search", "lookup", "browse", "containers"],
      }).success,
    ).toBe(true);
  });

  it("refuses listing containers without browse, which offers ids nothing can use", async () => {
    // The operation exists so that browsing does not require knowing an id
    // first, so a provider that answers `containers` while declining `browse` hands
    // the Owner a page of dead ends. The two are separately optional and this
    // one direction is not: a declaration is a promise, and this pair promises
    // ids it will not serve.
    expect(
      manifest.safeParse({ ...A_MANIFEST, operations: ["search", "lookup", "containers"] }).success,
    ).toBe(false);
  });
});

/**
 * `item_kind` IS THE CATALOGUE'S KIND, where `kind` is the source's (CNCORE-367).
 *
 * The source's `Event or Conflict` is its own word and CMPP closes no list of
 * those. What the catalogue files an Item under is ADR-0005's closed seven, so
 * a provider saying which one it means is held to exactly those, spelled as
 * the catalogue spells them -- `time_span`, never `Time span`.
 */
describe("the contract's item kind", () => {
  it.each([
    "work",
    "person",
    "organisation",
    "place",
    "time_span",
    "character",
    "concept",
  ])("admits %s, one of the seven", (itemKind) => {
    expect(record.safeParse({ ...A_RECORD, item_kind: itemKind }).success).toBe(true);
  });

  it.each([
    ["Time span", "the reader's label rather than the key"],
    ["species", "ADR-0005 folds species into character and refuses an eighth kind"],
    ["TV story", "the source's own word, which is what `kind` carries"],
  ])("refuses %s: %s", (itemKind) => {
    expect(record.safeParse({ ...A_RECORD, item_kind: itemKind }).success).toBe(false);
  });

  it("is optional, so a provider serving only works need not say so", () => {
    expect(record.safeParse(A_RECORD).success).toBe(true);
  });
});
