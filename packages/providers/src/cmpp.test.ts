import { describe, expect, it } from "vitest";
import { z } from "zod";

import { cmppBrowse, cmppManifest, cmppRecord, REASON_MAX_LENGTH } from "./index";

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

  /**
   * AND THE SAME SPLIT AS THE NAME, AT THE SAME SEAM (ADR-0176, ADR-0179).
   *
   * `credential.test.ts` pins the sentence for a label of nothing but whitespace
   * -- "did not say what." -- against a live Provider. A label of three
   * zero-width spaces bounds to the same empty string and that sentence was false
   * about it: this Provider DID say what it needs, in characters the Owner's page
   * cannot print. The Owner still has to be told the Provider wants something,
   * and now also which of the two is wrong with its manifest.
   */
  it("says a label could not be shown, rather than that the provider described nothing", () => {
    const { credential } = cmppManifest.parse({
      ...DECLARING,
      credential: { ...DECLARING.credential, label: "\u200b\u200b\u200b" },
    });

    expect(credential?.label).toBe(
      "this Provider needs something, and named it in words made only of characters that cannot " +
        "be shown.",
    );
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

    expect(name).toContain("did not name itself");
  });

  /**
   * AND THE FLOOR HAS TWO ANSWERS, NOT ONE (ADR-0176, ADR-0179). A name of three
   * zero-width spaces reaches the same empty string `"   "` does, and the
   * sentence above says the Provider named itself in nothing -- which is false
   * about a Provider that named itself in something nobody can print. What is
   * lost is not the same fact, so it does not get the same sentence.
   */
  it("says a name could not be shown, rather than that the provider gave none", () => {
    const { name } = cmppManifest.parse({ name: "\u200b\u200b\u200b" });

    expect(name).toBe("a Provider whose name is made only of characters that cannot be shown");
    // AND IT CLEARS THE CEILING IT REPLACED A BOUNDED VALUE WITH. A fallback is
    // this file's own sentence and never passes through `bounded`, so nothing but
    // this holds it under the length every surface printing a name declares.
    expect(name.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
  });
});

/**
 * A LICENCE'S OWN WORDS ARE REFUSED PAST A CEILING, NEVER CUT (ADR-0123, CNCORE-213).
 *
 * The notice and the mark's alternative text reach every Item page that shows
 * the source's claims, and `Attribution` prints them verbatim because a
 * paraphrased notice breaches the licence as surely as a missing one. So the
 * bound is a refusal, as `data_uri`'s is, and the refusal is the WHOLE
 * manifest: a Provider whose notice this app cannot print is a Provider whose
 * content it cannot show.
 *
 * THE LENGTHS ARE LITERALS, because the ceiling is a decision rather than a
 * value to read back: 1,000 is the number ADR-0123 defends, and TMDB's notice
 * and alt are 107 and 86 characters, measured on 2026-09-19.
 */
describe("a licence notice a provider declares", () => {
  /** TMDB's, as `provider-tmdb` declares them: the one real obligation there is. */
  const TMDB = {
    notice:
      "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
    logo: {
      data_uri: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
      alt: "The Movie Database (TMDB). TMDB does not endorse, certify or approve this application.",
    },
  };

  const declaring = (attribution: unknown) => ({ name: "a provider owing a notice", attribution });

  /**
   * THE HALF THAT STOPS THE RULE BEING "REFUSE EVERYTHING", and the half that
   * costs most if it breaks: a ceiling below TMDB's notice would refuse the one
   * Provider that owes one, whole, on every search and every import.
   */
  it("admits TMDB's notice and alt whole, and one of exactly 1,000", () => {
    expect(cmppManifest.parse(declaring(TMDB)).attribution).toEqual(TMDB);

    const atTheCeiling = {
      notice: "n".repeat(1_000),
      logo: { ...TMDB.logo, alt: "a".repeat(1_000) },
    };
    expect(cmppManifest.parse(declaring(atTheCeiling)).attribution).toEqual(atTheCeiling);
  });

  it.each([
    ["the notice", "notice", { ...TMDB, notice: "n".repeat(1_001) }],
    ["the mark's alt", "logo.alt", { ...TMDB, logo: { ...TMDB.logo, alt: "a".repeat(1_001) } }],
  ])(
    "refuses the whole manifest when %s runs one character past 1,000, and says which",
    (_, field, attribution) => {
      const parsed = cmppManifest.safeParse(declaring(attribution));

      expect(parsed.success).toBe(false);
      // WHICH FIELD, because this is what the Owner reads on the settings page:
      // the issue list is the reason, and its path is the half that says why.
      expect(parsed.error?.issues.map(({ path }) => path.join("."))).toEqual([
        `attribution.${field}`,
      ]);
    },
  );
});

/**
 * THE RULE A FIFTH FIELD MEETS, ENFORCED RATHER THAN LEFT TO REVIEW (CNCORE-165).
 *
 * `name` was the fourth surface to carry a Provider's prose and the first nobody
 * had bounded, and it was spelled exactly as the bounded ones were. A comment on
 * `cmppManifest` states the rule; this is what fails the build when a field is
 * added without anybody deciding which kind it is.
 *
 * EVERY BARE STRING IN THE MANIFEST IS NAMED HERE WITH ITS REASON. A field
 * declared with `boundedProse` is a `ZodPipe` and has been decided by its
 * spelling, so the walk stops there; a bare `z.string()` is either on this list
 * or it is the defect this ticket closed, arriving again.
 *
 * WALKED THROUGH ZOD'S PUBLIC API ONLY -- `.shape`, `.unwrap()`, `.element`,
 * `.options` -- and not `_zod`, which is the internal CNCORE-212 found zod 4.6
 * had quietly stopped filling. And A TYPE THE WALK DOES NOT KNOW IS A FAILURE,
 * not a skip: a wrapper it cannot see inside is a string it cannot see.
 */
describe("every string a provider declares about itself", () => {
  const DECIDED: Record<string, string> = {
    operations: "read for `browse`, never printed",
    "images.stored_variant": "read by nothing in this app yet",
    "images.stored_variant{key}": "read by nothing in this app yet",
    "images.stored_variant{value}": "read by nothing in this app yet",
    "attribution.notice": "verbatim by obligation, refused past MAX_NOTICE_CHARS",
    "attribution.logo.alt": "verbatim by obligation, refused past MAX_NOTICE_CHARS",
    "attribution.logo.data_uri": "verbatim bytes, refused past MAX_LOGO_CHARS",
    "credential.unlock_path": "never printed; `unlockUrlFor` joins it and checks the origin",
  };

  it("is bounded at its field, or named here with the reason it is not", () => {
    expect(bareStringsIn(cmppManifest).sort()).toEqual(Object.keys(DECIDED).sort());
  });
});

/** Where a bare `z.string()` sits in a schema, by path. */
function bareStringsIn(schema: z.ZodType, path = ""): string[] {
  const at = (key: string) => (path ? `${path}.${key}` : key);
  if (schema instanceof z.ZodString) return [path];
  if (schema instanceof z.ZodPipe) return [];
  if (
    schema instanceof z.ZodNumber ||
    schema instanceof z.ZodEnum ||
    schema instanceof z.ZodISODateTime
  ) {
    return [];
  }
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault
  ) {
    return bareStringsIn(schema.unwrap() as z.ZodType, path);
  }
  if (schema instanceof z.ZodArray) return bareStringsIn(schema.element as z.ZodType, path);
  if (schema instanceof z.ZodUnion) {
    return (schema.options as z.ZodType[]).flatMap((option) => bareStringsIn(option, path));
  }
  if (schema instanceof z.ZodRecord) {
    return [
      ...bareStringsIn(schema.keyType as z.ZodType, `${path}{key}`),
      ...bareStringsIn(schema.valueType as z.ZodType, `${path}{value}`),
    ];
  }
  if (schema instanceof z.ZodObject) {
    return Object.entries(schema.shape as Record<string, z.ZodType>).flatMap(([key, field]) =>
      bareStringsIn(field, at(key)),
    );
  }
  throw new Error(
    `the walk does not know ${schema.constructor.name} at \`${path}\`; decide how it reads`,
  );
}

/**
 * A BATCH'S CURSOR IS STORED AND SENT BACK IN A URL (CNCORE-373), so it is
 * bounded like an id: a provider handing over a cursor no id could be is
 * refused at parse rather than written to the run's row.
 */
describe("the cursor a batch carries on from", () => {
  const aBatch = (next: string) => ({
    container: {
      id: "203134",
      title: "Template:Infobox Event or Exhibition",
      kind: "infobox",
      released: [],
      writers: [],
      series: null,
      url: "https://tardis.wiki/wiki/Template:Infobox_Event_or_Exhibition",
    },
    ordering: [],
    next,
  });

  it("is taken as the provider wrote it, up to an id's length", () => {
    expect(cmppBrowse.parse(aBatch("c".repeat(255))).next).toBe("c".repeat(255));
  });

  it("is refused past it", () => {
    expect(cmppBrowse.safeParse(aBatch("c".repeat(256))).success).toBe(false);
  });
});
