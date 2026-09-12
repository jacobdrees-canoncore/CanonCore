import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
 * The single words the glossary rejects, read off its `_Avoid_` lists.
 *
 * ONLY SINGLE WORDS PARTICIPATE. A multi-word entry -- `custom field`,
 * `provider id`, `materialised view` -- is a phrase about prose, and an
 * identifier is not prose: no name is spelled with a space, and the words those
 * phrases are built from appear on the lists separately where they are banned on
 * their own (`field` does, `key` does). A parenthetical qualifier is stripped
 * first, so `lookup (unqualified)` bans `lookup`.
 *
 * THE PARSE IS DELIBERATELY A LITTLE LOOSE IN ONE PLACE, and saying so here is
 * cheaper than pretending otherwise: `_Avoid_: search, unqualified` is one word
 * and a qualifier on it rather than two words, so this reads `unqualified` as
 * banned in its own right. It costs nothing -- no identifier contains it -- and
 * the alternative is grammar in a test.
 */
export function wordsTheGlossaryRejects(context: string): string[] {
  const lines = [...context.matchAll(/^_Avoid_:(.*)$/gm)];
  const entries = lines.flatMap((line) => (line[1] ?? "").split(","));
  return [
    ...new Set(
      entries
        .map((entry) =>
          entry
            .replace(/\([^)]*\)/g, "")
            .trim()
            .toLowerCase(),
        )
        .filter((entry) => entry.length > 0 && !/\s/.test(entry)),
    ),
  ];
}

/** The words an identifier is built from, lower-cased. */
export function wordsIn(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
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
export function rejects(rejected: ReadonlySet<string>, word: string): boolean {
  if (rejected.has(word)) return true;
  if (word.endsWith("ies") && rejected.has(`${word.slice(0, -3)}y`)) return true;
  return word.endsWith("s") && rejected.has(word.slice(0, -1));
}

/**
 * Every name the read path emits, as `export.path.to.field`, walking into arrays
 * and through nullables so a field's name is checked wherever it sits.
 *
 * The path is the point of the return type: a bare list of offending words would
 * say the read path has one, and a reviewer still has to find it.
 */
export function namesEmittedBy(module: Record<string, unknown>): string[] {
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
    if (inner) walk(inner, path);
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

    expect(wordsTheGlossaryRejects(fixture)).toStrictEqual([
      "record",
      "edge",
      "membership",
      "link",
      "enum",
      "lookup",
    ]);
  });

  it("leaves a multi-word entry out, because no identifier is spelled with a space", () => {
    const fixture = "_Avoid_: field, attribute, custom field";
    expect(wordsTheGlossaryRejects(fixture)).toStrictEqual(["field", "attribute"]);
  });

  it("finds the real glossary's lists, so the check cannot pass by reading nothing", async () => {
    // The assertion below would pass vacuously against an empty list, which is
    // exactly how this check would rot: a renamed heading, a moved file, and it
    // goes green while guarding nothing.
    const rejected = wordsTheGlossaryRejects(await readFile(contextFile, "utf8"));
    expect(rejected).toContain("membership");
    expect(rejected).toContain("duplicate");
    expect(rejected.length).toBeGreaterThan(20);
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

  it("uses no word the glossary rejects", async () => {
    const rejected = new Set(wordsTheGlossaryRejects(await readFile(contextFile, "utf8")));

    const offences = namesEmittedBy(schemas).filter((name) => {
      const last = name.split(".").at(-1) ?? name;
      return wordsIn(last).some((word) => rejects(rejected, word));
    });

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

    expect(offences).toStrictEqual(allowedUntil_CNCORE_114);
  });
});
