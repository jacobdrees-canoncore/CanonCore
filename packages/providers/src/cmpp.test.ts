import { describe, expect, it } from "vitest";

import { cmppManifest, cmppRecord, REASON_MAX_LENGTH } from "./index";

/** A record that parses, so a case below differs from it in exactly one field. */
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
 * A record's `url` is a CONTENT URL, so the scheme is judged where the record is
 * read rather than where something might later fetch it.
 *
 * THE FOUR CASES ARE THE ONES THAT ACTUALLY GOT THROUGH, measured against the
 * installed zod rather than reasoned about: `z.url()` checks that a string
 * parses as a URL and says nothing about its scheme, so all four of these
 * parsed clean. One representative of them would not be the same test -- each
 * is a different sink (`javascript:` and `vbscript:` execute, `data:` carries a
 * document with its own origin, `file:` reads the reader's disk), and a rule
 * written against one of them can miss the others.
 */
describe("a record's url", () => {
  it.each([
    ["javascript:alert(1)", "it runs script in the reader's browser"],
    ["data:text/html,<script>x</script>", "it is a document with its own origin"],
    ["vbscript:x", "it runs script too, on the browsers that still read it"],
    ["file:///etc/passwd", "it reads the reader's own disk"],
  ])("refuses %s, because %s", (url) => {
    expect(cmppRecord.safeParse({ ...A_RECORD, url }).success).toBe(false);
  });

  /**
   * THE HALF THAT STOPS THE RULE BEING "REFUSE EVERYTHING", which the cases
   * above cannot tell apart from the rule we want.
   *
   * The loopback case is the one worth naming: it is a self-link from a
   * provider the owner runs on their own machine, and ADR-0034 makes such a
   * provider legal BY NAME. The address deny-list this package also carries
   * would refuse it, which is why the scheme is judged here and the address is
   * judged in front of a socket -- nothing fetches this URL.
   */
  it.each([
    ["https://tardis.wiki/wiki/The_Tenth_Planet", "the ordinary case"],
    ["http://example.invalid/265", "HTTP, because a provider on a LAN has no certificate"],
    ["HTTPS://Example.Invalid/265", "a scheme is case-insensitive, so this is the same scheme"],
    ["http://127.0.0.1:8080/265", "a provider the owner runs on loopback, linking to itself"],
  ])("admits %s: %s", (url) => {
    expect(cmppRecord.safeParse({ ...A_RECORD, url }).success).toBe(true);
  });
});

/**
 * WHAT CANONCORE READS OF A DECLARED CREDENTIAL, AND WHAT IT REFUSES TO HOLD
 * (ADR-0122, CNCORE-101).
 *
 * THE INTERESTING ASSERTION IS THE ABSENCE. ADR-0122 corrected an earlier draft
 * in which CanonCore rendered the provider's form and forwarded what the Owner
 * typed; the record now refuses the value "not even in transit", because MCP's
 * 2026-07-28 revision prohibits exactly that mechanism for credentials and BCP
 * 240 removed OAuth's password grant over the same leak surface. A consumer
 * schema that never reads `fields` is how that refusal is made structural rather
 * than remembered: zod strips unknown keys, so there is no property on the
 * parsed manifest for a credential value to sit in.
 */
describe("a declared credential", () => {
  const DECLARING = {
    name: "a provider that needs something",
    credential: {
      label: "a browser session for the wiki",
      fields: [{ name: "cf_clearance", label: "the clearance cookie" }],
      unlock_path: "/unlock",
      state: "absent",
      state_changed_at: null,
    },
  };

  it("reads the label, the path, the state and when it changed", () => {
    const manifest = cmppManifest.parse(DECLARING);

    expect(manifest.credential).toMatchObject({
      label: "a browser session for the wiki",
      unlock_path: "/unlock",
      state: "absent",
      state_changed_at: null,
    });
  });

  /**
   * THE PIN ON "CANONCORE CARRIES NOTHING". `fields` is the provider's list of
   * what to supply, and it exists in the contract so that the Owner knows what
   * is being asked and a script renewing the credential knows what to send --
   * neither of which is CanonCore's job. Reading it here would give the value a
   * place to live in this app the day somebody rendered the form again.
   */
  it("does not read the fields, so no credential value has anywhere to land", () => {
    const manifest = cmppManifest.parse(DECLARING);

    expect(manifest.credential).not.toHaveProperty("fields");
  });

  /**
   * THE SAME RULE AS THE NAME BELOW, AT THE SAME SEAM. This was bounded in
   * `asDeclared` until CNCORE-165 -- correctly, and one surface at a time, which
   * is what left the manifest unable to say which of its fields somebody had
   * thought about. Both are `boundedProse` now.
   */
  it("bounds the label where the manifest is read, not where a page prints it", () => {
    const { credential } = cmppManifest.parse({
      ...DECLARING,
      credential: { ...DECLARING.credential, label: "unbounded ".repeat(500) },
    });

    expect(credential?.label.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
  });

  /** A provider that needs nothing declares nothing, and stays conformant. */
  it("is absent from a provider that declares none", () => {
    expect(
      cmppManifest.parse({ name: "a provider that needs nothing" }).credential,
    ).toBeUndefined();
  });
});

/**
 * A PROVIDER DESCRIBING ITSELF IS A STRANGER'S PROSE ON A PAGE IT DOES NOT OWN
 * (ADR-0123, CNCORE-165).
 *
 * `name` travels further than any other string in this manifest: to the import
 * surface, onto the Source row an import writes, and from there beside every
 * statement on every Item page that source ever claimed a value for. Its only
 * bound was `MAX_BODY_BYTES`, which admits four mebibytes of it.
 */
describe("a provider's declared name", () => {
  it("is cut to what the Owner reads, so a provider does not choose a page's length", () => {
    const flooding = "a".repeat(100_000);

    const { name } = cmppManifest.parse({ name: flooding });

    expect(name.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
  });

  /**
   * AND A FLOOR, FOR THE REASON `reasonFor` HAS ONE. `min(1)` admits a name of a
   * single space, which the cap above collapses to nothing -- and an empty name
   * fails the `min(1)` every surface declares on its OUTPUT, which is the 500 a
   * provider must not be able to cause. Measured on zod 4.6.5: `min(1)` runs
   * before the transform, so `""` is refused outright and `" "` is what actually
   * reaches it.
   */
  it("says so when the provider named itself in nothing but whitespace", () => {
    const { name } = cmppManifest.parse({ name: "   " });

    expect(name).not.toBe("");
  });
});
