import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import * as schemas from "./index";

/**
 * `CONTEXT.md` IS BINDING ON NAMES IN CODE, AND THIS IS THE LINE THAT CHECKS IT.
 *
 * Every `_Avoid_` list in the glossary names words that must not stand for the
 * term above them, and until now NOTHING READ THEM. CNCORE-67 made `Member` a
 * first-class name on the read path -- a second noun beside Placement, which is
 * what those lists exist to prevent -- and it passed every check in the repo on
 * its way in. CNCORE-91 is the ticket that fixed the instance; this is the
 * mechanism, because a rule nothing reads is a rule somebody remembers.
 *
 * IT READS THE GLOSSARY RATHER THAN RESTATING IT. A list of banned words copied
 * into this file would be the same rule in a second language, and it would go
 * stale the day an entry gains a word -- the same argument ADR-0045 makes for
 * reading a seeded label instead of mapping it in the app.
 *
 * SCOPED TO WHAT THE READ PATH EMITS, which is ADR-0045's own subject: the
 * schemas this package exports and every field key underneath them. That scope
 * is what makes the check sound rather than merely strict -- `CONTEXT.md` says
 * A PROVIDER'S OWN EXTERNAL RECORD KEEPS THE WORD `record`, so the CMPP contract
 * uses a word the Item entry rejects, licensed and on purpose. Widening this
 * check to the whole repo would fail on that licence.
 *
 * WHAT IT CANNOT SEE IS A TYPE ALIAS. `MemberPublic` is erased before this test
 * runs, so only value exports and their keys are covered. That is the right line
 * rather than a shortfall to apologise for: ADR-0045 is about the fields the read
 * path EMITS, and a type alias is emitted to nobody.
 */
const contextFile = fileURLToPath(new URL("../../../CONTEXT.md", import.meta.url));

/**
 * What the glossary rejects, read off its `_Avoid_` lists, split by how widely
 * each entry is rejected.
 *
 * `anywhere` is rejected as ANY WORD OF A NAME, which is the ordinary case.
 * `bare` is rejected only as a WHOLE NAME, and that is the glossary's own
 * notation rather than a softening invented here: `_Avoid_: search, unqualified`
 * and `_Avoid_: lookup (unqualified)` mark the word as wrong UNQUALIFIED, so
 * `catalogueSearchPublic` is the qualified form the entry is asking for and a
 * check that rejected it would be arguing with the document it reads. Getting
 * this wrong is how the check dies: ADR-0124 records that a check which has to be
 * argued with is one that gets deleted, and a false positive on the next
 * legitimate name is exactly that argument.
 *
 * ONLY WORDS THAT COULD EVER MATCH A NAME PARTICIPATE. An entry carrying a space
 * or a hyphen -- `custom field`, `materialised view`, `cross-listing`, `version
 * 1.0` -- is dropped, because `wordsIn` splits a name on exactly those characters
 * and no name can produce one. They are kept out rather than kept in and left
 * dead: a rejected set padded with entries that can never fire would inflate the
 * canary below into passing on a parser that had stopped working. Where such a
 * phrase's parts are banned on their own the lists say so separately, and `field`
 * does; `licence` and `view` do not, which is the honest limit of this check
 * rather than a claim it can be talked out of.
 */
function wordsTheGlossaryRejects(context: string): {
  anywhere: Set<string>;
  bare: Set<string>;
} {
  const anywhere = new Set<string>();
  const bare = new Set<string>();

  for (const line of context.matchAll(/^_Avoid_:(.*)$/gm)) {
    const raw = line[1] ?? "";
    // A trailing `, unqualified` qualifies every word on its line, and a
    // `(unqualified)` qualifies only the entry carrying it.
    const lineIsBare = /(^|,)\s*unqualified\s*$/.test(raw);
    for (const entry of raw.split(",")) {
      const qualifiedHere = lineIsBare || /\(\s*unqualified\s*\)/.test(entry);
      const word = entry
        .replace(/\([^)]*\)/g, "")
        .trim()
        .toLowerCase();
      if (word.length === 0 || word === "unqualified") continue;
      if (/[^a-z0-9]/.test(word)) continue;
      (qualifiedHere ? bare : anywhere).add(word);
    }
  }
  return { anywhere, bare };
}

/**
 * The words an identifier is built from, lower-cased.
 *
 * TWO CASE BOUNDARIES, NOT ONE. `lower->Upper` splits `placementInContainer`, and
 * `UPPER->UpperLower` is what splits an acronym off the word after it, so
 * `APIKey` is `api` + `key` rather than one unrecognisable token. Without the
 * second rung a banned word hidden behind an acronym walks straight through.
 */
function wordsIn(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase());
}

/**
 * Whether one word of an identifier is a word the glossary rejects, READING A
 * PLURAL AS THE WORD IT IS THE PLURAL OF.
 *
 * THE PLURAL RUNG IS NOT TIDINESS: the name this whole check exists for is a
 * FIELD CALLED `members`, and a glossary that rejects `member` has to catch it,
 * because the plural is the same word making the same claim. `entries` against
 * `entry` is the same shape and is why the `ies` rung is here too.
 *
 * THE GUESS AT ENGLISH IS SAFE BECAUSE IT IS ONLY EVER A LOOKUP. A singular this
 * gets wrong -- `is` read as `i` -- simply fails to match anything on the lists,
 * where a singulariser whose output were reported as "the words of this name"
 * would have to be right about the language. An earlier version of this file put
 * the rung in `wordsIn` and had to be right; this one does not.
 */
function rejects(rejected: ReadonlySet<string>, word: string): boolean {
  if (rejected.has(word)) return true;
  if (word.endsWith("ies") && rejected.has(`${word.slice(0, -3)}y`)) return true;
  return word.endsWith("s") && rejected.has(word.slice(0, -1));
}

/** Whether one emitted name uses a word the glossary rejects, at either width. */
function offends(
  rejected: { anywhere: ReadonlySet<string>; bare: ReadonlySet<string> },
  name: string,
): boolean {
  const words = wordsIn(name);
  if (words.some((word) => rejects(rejected.anywhere, word))) return true;
  // A `bare` word is only wrong ALONE, so a compound built on it is the qualified
  // form the glossary is asking for rather than an offence.
  return words.length === 1 && words[0] !== undefined && rejects(rejected.bare, words[0]);
}

/**
 * Every type this walk stops at because there is nothing underneath it to name.
 *
 * AN ALLOWLIST RATHER THAN A DEFAULT OF STOPPING, and that is the whole design.
 * The walk knows `object`, `array` and `nullable`; the day a schema here uses a
 * `union`, `record`, `tuple`, `lazy` or `discriminatedUnion`, every field beneath
 * it would be skipped and the check would go green over names it never read.
 * Silence is the one failure mode a guard must not have, so an unknown composite
 * THROWS and the suite says which type it was.
 *
 * Measured against `packages/schemas` on 2026-09-12: the only types reachable are
 * the four below plus `object`, `array` and `nullable`.
 */
const NAMES_NOTHING = new Set(["string", "number", "boolean", "literal"]);

/**
 * Every name the read path emits, as `export.path.to.field`, walking into arrays
 * and through nullables so a field's name is checked wherever it sits.
 *
 * The path is the point of the return type: a bare list of offending words would
 * say the read path has one, and a reviewer still has to find it.
 */
function namesEmittedBy(module: Record<string, unknown>): string[] {
  const found: string[] = [];

  function walk(schema: unknown, path: string): void {
    const def = (schema as { def?: { type?: string; shape?: Record<string, unknown> } }).def;
    if (!def) return;
    if (def.type === "object" && def.shape) {
      for (const key of Object.keys(def.shape)) {
        found.push(`${path}.${key}`);
        walk(def.shape[key], `${path}.${key}`);
      }
      return;
    }
    // An array's element and a nullable's inner type carry the same fields under
    // the same names, so the walk has to go through them rather than stop.
    const inner =
      (def as { element?: unknown; innerType?: unknown }).element ??
      (def as { element?: unknown; innerType?: unknown }).innerType;
    if (inner) {
      walk(inner, path);
      return;
    }
    if (!NAMES_NOTHING.has(def.type ?? "")) {
      throw new Error(
        `this walk does not know how to look inside a \`${def.type}\` (at ${path}), so every ` +
          "field under it would go unchecked. Teach it that type rather than widening " +
          "NAMES_NOTHING, unless the type genuinely has no fields beneath it.",
      );
    }
  }

  for (const [name, schema] of Object.entries(module)) {
    found.push(name);
    walk(schema, name);
  }
  return found;
}

describe("the words the glossary rejects", () => {
  it("reads them off the `_Avoid_` lists", () => {
    // A FIXTURE RATHER THAN THE REAL FILE, so the parser is TESTED and not
    // merely exercised -- `docker-compose.test.ts` makes the same argument about
    // the same kind of check. A parser checked only against the live glossary
    // passes by agreeing with whatever it happens to read.
    const fixture = [
      "**Placement**:",
      "One item's membership of one container.",
      "_Avoid_: record, edge, membership, link",
      "",
      "**Vocabulary**:",
      "_Avoid_: enum, lookup (unqualified)",
    ].join("\n");

    const { anywhere, bare } = wordsTheGlossaryRejects(fixture);
    expect([...anywhere]).toStrictEqual(["record", "edge", "membership", "link", "enum"]);
    // `lookup (unqualified)` is wrong ALONE, which is narrower than the rest.
    expect([...bare]).toStrictEqual(["lookup"]);
  });

  it("reads a trailing `unqualified` as qualifying its whole line", () => {
    // CONTEXT.md's Catalogue search entry: `_Avoid_: search, unqualified` is one
    // word and a qualifier on it, NOT two banned words.
    const { anywhere, bare } = wordsTheGlossaryRejects("_Avoid_: search, unqualified");
    expect([...anywhere]).toStrictEqual([]);
    expect([...bare]).toStrictEqual(["search"]);
  });

  it("leaves out any entry no identifier could ever produce", () => {
    // A name is split on spaces and hyphens, so an entry containing one can never
    // match. Dropped rather than kept dead, because dead entries would pad the
    // canary below into passing over a parser that had stopped working.
    const fixture = "_Avoid_: field, attribute, custom field, cross-listing, version 1.0";
    expect([...wordsTheGlossaryRejects(fixture).anywhere]).toStrictEqual(["field", "attribute"]);
  });

  it("finds the real glossary's lists, so the check cannot pass by reading nothing", async () => {
    // The assertion below would pass vacuously against an empty list, which is
    // exactly how this check would rot: a renamed heading, a moved file, and it
    // goes green while guarding nothing.
    const { anywhere, bare } = wordsTheGlossaryRejects(await readFile(contextFile, "utf8"));
    expect(anywhere).toContain("membership");
    expect(anywhere).toContain("member");
    expect(anywhere).toContain("duplicate");
    expect(anywhere.size).toBeGreaterThan(20);
    // The glossary really does use the notation, so the narrower width is live
    // rather than a branch nothing reaches.
    expect(bare).toContain("search");
  });
});

describe("the words an identifier is built from", () => {
  it("splits a camelCase name", () => {
    expect(wordsIn("placementInContainerPublic")).toStrictEqual([
      "placement",
      "in",
      "container",
      "public",
    ]);
  });

  it("says the words, not a guess at their singulars", () => {
    expect(wordsIn("isContainer")).toStrictEqual(["is", "container"]);
    expect(wordsIn("members")).toStrictEqual(["members"]);
  });

  it("splits an acronym off the word after it", () => {
    // Without the second case boundary this is one token, and a banned word
    // hidden behind an acronym walks through unread.
    expect(wordsIn("APIKey")).toStrictEqual(["api", "key"]);
    expect(wordsIn("providerSDKRecord")).toStrictEqual(["provider", "sdk", "record"]);
  });
});

describe("how widely a rejected word is rejected", () => {
  const rejected = { anywhere: new Set(["member"]), bare: new Set(["search"]) };

  it("rejects an `anywhere` word as any part of a name", () => {
    expect(offends(rejected, "memberPublic")).toBe(true);
    expect(offends(rejected, "members")).toBe(true);
  });

  it("rejects a `bare` word only when it is the whole name", () => {
    expect(offends(rejected, "search")).toBe(true);
    // THE QUALIFIED FORM THE GLOSSARY IS ASKING FOR. A check that rejected this
    // would be arguing with the entry it read, and ADR-0124 records that a check
    // which has to be argued with is one that gets deleted.
    expect(offends(rejected, "catalogueSearchPublic")).toBe(false);
    expect(offends(rejected, "searchQuery")).toBe(false);
  });
});

describe("matching a name's word against the glossary", () => {
  it("catches a plural of a rejected word", () => {
    // The name this whole check exists for is a plural field.
    expect(rejects(new Set(["member"]), "members")).toBe(true);
    expect(rejects(new Set(["entry"]), "entries")).toBe(true);
  });

  it("catches the word itself", () => {
    expect(rejects(new Set(["edge"]), "edge")).toBe(true);
  });

  it("leaves a word the glossary says nothing about alone", () => {
    // `is` mis-singularises to `i`, which is the case that proves the guess at
    // English only ever has to be lucky enough to miss.
    expect(rejects(new Set(["member", "i"]), "container")).toBe(false);
    expect(rejects(new Set(["member"]), "is")).toBe(false);
  });
});

describe("every name the read path emits", () => {
  it("walks into arrays and nullables, so a nested field is not missed", () => {
    // Against the real schemas: `containerTitle` sits inside an array of objects
    // on `itemPublic`, which is the shape a walk that stopped at the top would
    // report clean.
    const names = namesEmittedBy({ itemPublic: schemas.itemPublic });
    expect(names).toContain("itemPublic.placements.containerTitle");
  });

  it("refuses to walk past a composite it does not understand", () => {
    // THE FAILURE MODE A GUARD MUST NOT HAVE is going quiet. A `union` holding
    // objects would hide every field under it, and a walk that shrugged at
    // unknown types would report the read path clean.
    expect(() =>
      namesEmittedBy({ odd: z.union([z.object({ membership: z.string() }), z.string()]) }),
    ).toThrow(/does not know how to look inside a `union`/);
  });

  it("uses no word the glossary rejects", async () => {
    const rejected = wordsTheGlossaryRejects(await readFile(contextFile, "utf8"));

    const offences = namesEmittedBy(schemas).filter((name) =>
      offends(rejected, name.split(".").at(-1) ?? name),
    );

    /**
     * THE TWO NAMES THIS CHECK CAUGHT THAT CNCORE-91 DID NOT FIX, and they are
     * here rather than in a comment because an allowance nothing reads is how a
     * finding gets forgotten. `entry` is on the **Item** entry's `_Avoid_` list
     * and nothing licenses it: the one licensed use of a word from that list is
     * `record`, which `CONTEXT.md` grants to a provider's own external record.
     * CNCORE-114 owns the rename -- it reaches the catalogue, work-browsing and
     * Catalogue search, and the replacement name is an open question because the
     * glossary has no term for a listing's row.
     *
     * AN EXACT MATCH RATHER THAN A SUBSET, which is the half that makes this
     * self-expiring: the day CNCORE-114 renames one of these, this assertion
     * fails until the name is DELETED from the list. An allowance written as
     * "offences ⊆ allowed" would go on passing over a list of names that no
     * longer exist, and the next offence could be added to it without argument.
     */
    const allowedUntil_CNCORE_114 = ["catalogueEntryPublic", "cataloguePublic.entries"];

    // SORTED BOTH SIDES, because an exact match on walk order would make
    // reordering the exports in `index.ts` fail this test for no domain reason --
    // which is the arguing-with-the-check death ADR-0124 warns about, arriving by
    // a different door.
    expect([...offences].sort()).toStrictEqual([...allowedUntil_CNCORE_114].sort());
  });
});
