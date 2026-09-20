import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "./testing/repo-root";

/**
 * A record naming one of THIS REPOSITORY'S symbols is naming something that can
 * be renamed out from under it, and nothing reports the break.
 *
 * That is `doc-line-citations.test.ts`'s shape one step over: a pointer that
 * stays syntactically fine while becoming false. CNCORE-246 found ADR-0119
 * saying a Listing's letter "is on `filedByNameInput`" when CNCORE-175 had
 * renamed that input `browsedInput` months earlier, and the record read as
 * though it named something the whole time.
 *
 * THE OBVIOUS RULE IS THE WRONG ONE, and it was MEASURED before it was refused.
 * "Every backticked identifier a record names resolves in the code" reads well
 * and is false: the corpus names 367 distinct camelCase identifiers and 57 of
 * them do not resolve, of which 47 WERE NEVER OURS. Plex's `playQueueItemID`,
 * schema.org's `bestRating`, Next's `transpilePackages`, Biome's
 * `noUnnecessaryConditions`, Drizzle's `folderMillis` -- a record names those
 * because `CLAUDE.md` asks it to: "Study how established products solve the
 * problem before designing a solution." A check demanding they resolve would
 * demand this repository reimplement every product it learned from.
 *
 * SO THE POPULATION IS WHAT THIS TREE ITSELF ONCE HELD, asked of git rather
 * than of a list somebody maintains -- `adr-numbering.test.ts`'s reason in its
 * own words, "a record added without touching this file is still covered". An
 * identifier the history holds and the tree no longer does was OURS and is
 * GONE, which is the one reading under which a record naming it is making a
 * claim that has quietly stopped being true. The 47 foreign ones are never in
 * the population at all, rather than being 47 entries in a map that taxes every
 * future record for naming another product's API.
 *
 * IT FOUND ONE THE TICKET'S OWN AUDIT MISSED, which is the argument for it
 * existing rather than for the two sentences being fixed by hand. CNCORE-246
 * was filed naming `filedByNameInput`; two independent auditors and a `/verify`
 * pass over the same record did not find `pastTheRow`, which ADR-0119 asserted
 * in the present tense at two sites while `packages/db/src/queries.ts` had
 * called it `pastTheRowIn` since CNCORE-175.
 *
 * WHAT IT CANNOT DECIDE IS TENSE, and that is why the map below exists rather
 * than being an embarrassment. A record correcting itself in place MUST be able
 * to say what it used to claim -- `CLAUDE.md` asks for exactly that ("Put the
 * correction in the sentence it corrects"), ADR-0128 keeps superseded figures
 * "labelled rather than deleted", and ADR-0122 carries a whole dated section
 * this very ticket was told to leave alone because correcting it would erase a
 * measurement. So "`X` WAS REFUSED" and "the reads were `X` until CNCORE-224"
 * are CORRECT sentences naming a gone symbol, and no pattern separates them
 * from a stale one without deciding prose by regex -- the question
 * `doc-line-citations.test.ts` refuses to decide, in its own words: it "bans
 * the form rather than checking the quote". Each is named below with the reason
 * it is not a defect, read rather than assumed.
 */
const adrDirectory = join(repoRoot, "docs", "adr");

/**
 * A CAMELCASE IDENTIFIER AND NOTHING ELSE: lower-case first letter, at least one
 * upper-case letter after it, letters and digits only.
 *
 * NARROW ON PURPOSE. A backtick span in these records is far more often a word
 * (`browse`, `containers`, `source`), a path, a command, a column or a SQL
 * fragment than it is a symbol, and every one of those resolves -- or fails to
 * -- by different rules. The interior capital is what makes a span unambiguously
 * a code identifier in this tree's conventions rather than English inside
 * backticks, and it is the form the defect this file exists for was written in.
 *
 * PASCAL CASE IS LEFT OUT, and deliberately. `Item`, `Container`, `Placement`
 * and `Group` are `CONTEXT.md`'s domain words and appear in backticks as prose
 * constantly; a rule reaching them would be reading the glossary, not the code.
 */
const A_CAMELCASE_IDENTIFIER = /^[a-z][A-Za-z0-9]*$/;

/**
 * Backticked spans, with FENCED BLOCKS DROPPED FIRST.
 *
 * A fenced block is a transcript -- a shell session, a config file, another
 * product's JSON -- and the identifiers in one belong to whatever is being
 * quoted rather than to the record's own sentences. This file's subject is what
 * a record ASSERTS in its own voice.
 */
function identifiersNamedIn(markdown: string): Set<string> {
  const named = new Set<string>();
  for (const [, span] of markdown.replace(/^```[\s\S]*?^```/gm, "").matchAll(/`([^`\n]+)`/g)) {
    const identifier = span?.trim();
    if (identifier === undefined) continue;
    if (!A_CAMELCASE_IDENTIFIER.test(identifier)) continue;
    if (!/[A-Z]/.test(identifier)) continue;
    named.add(identifier);
  }
  return named;
}

/**
 * THE FIFTH COPY OF THE TRACKED-FILES WALK, and CNCORE-277 already owns the
 * fold rather than this file pretending not to have noticed.
 *
 * [[0136-a-control-is-a-primitive-and-a-surfaces-words-sit-beside-its-pages]]
 * folds at three; `ui-callers.test.ts`, `biome-config.test.ts`,
 * `turbo-cache-inputs.test.ts` and `adr-as-built.test.ts` are the first four,
 * and that last one carries the same note one side of it. CNCORE-277 was filed
 * on the fourth and is where the decision goes: the reads genuinely disagree
 * -- `ui-callers.test.ts` strips comments and drops test files, `adr-as-built`
 * keeps both -- so what they share is about three lines, and whether a seam
 * that small earns a module is a call somebody takes rather than a tidy-up done
 * in passing by a ticket about stale sentences.
 *
 * `-z` RATHER THAN LINES, so a path is whatever git says it is:
 * `ui-callers.test.ts`'s finding, where `core.quotePath` octal-escapes a
 * non-ASCII filename into one that then fails to open.
 *
 * AND IT EXCLUDES ITSELF, which is not tidiness but the defect `adr-as-built`
 * HAD and fixed. This file NAMES `filedByNameInput` and `pastTheRow` in the
 * comments above to explain what they were -- and a walk that read this file
 * would find them, call them resolved, and go green on the very defect it was
 * written for.
 */
const THIS_FILE = "packages/config/src/adr-identifiers.test.ts";

/**
 * AND THE RECORD THAT DEFINES THIS RULE IS OUT OF THE POPULATION IT DEFINES,
 * which is the same defect one level up and was MEASURED rather than foreseen.
 *
 * ADR-0164 states the rule and argues it from examples -- `filedByNameInput`,
 * `pastTheRow`, `globalDependencies`, `thePlaceIn` -- so writing it put twelve
 * gone symbols straight back into the population and reddened this check on its
 * own record. `adr-as-built.test.ts` names the shape exactly: "a check that
 * recruits a record by discussing it would grow its own subject every time
 * somebody explained it."
 *
 * IT IS THE ONE RECORD EXCLUDED, and narrowly: every other record is read, and
 * a record that merely CITES ADR-0164 is still read. What is excused is the
 * record whose subject IS the gone symbol, which cannot state its own rule
 * without naming one.
 */
const THIS_RECORD =
  "0164-an-identifier-a-record-names-is-checked-against-what-this-tree-once-held.md";

function trackedSource(): string[] {
  return execFileSync(
    "git",
    ["ls-files", "-z", "--", ".", ":(exclude)*.md", `:(exclude)${THIS_FILE}`],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  )
    .split("\0")
    .filter((path) => path.length > 0);
}

/** Every identifier-shaped token the tracked source holds TODAY. */
function identifiersInTheTree(): Set<string> {
  const present = new Set<string>();
  for (const path of trackedSource()) {
    let contents: string;
    try {
      contents = readFileSync(join(repoRoot, path), "utf8");
    } catch {
      continue;
    }
    for (const [token] of contents.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
      if (token !== undefined) present.add(token);
    }
  }
  return present;
}

/**
 * Whether this repository's own history ever held the identifier in SOURCE.
 *
 * MARKDOWN IS EXCLUDED FROM THE PICKAXE for the same reason the tree walk
 * excludes it: a record naming a symbol is the thing under test, so a pickaxe
 * that counted the record's own prose would answer "ours" for every identifier
 * any document ever mentioned, and the population would become all 57 again.
 *
 * AND THIS FILE IS EXCLUDED FROM BOTH WALKS, WHICH IS ONE FACT AND NOT TWO.
 * Excluding it from the tree alone is worse than excluding it from neither, and
 * this check REDDENED ON ITSELF proving it: the moment the commit adding this
 * file landed, `bestRating`, `transpilePackages`, `playQueueItemID`,
 * `noUnnecessaryConditions` and `folderMillis` were in the history (this file's
 * own docblock names them as examples of what is FOREIGN) and absent from the
 * tree (which skips this file) -- so five identifiers no Plex, Next, Biome or
 * Drizzle ever handed us were reported as symbols this repository had renamed
 * away. An exclusion applied to one side of a comparison invents the difference
 * it was meant to remove.
 */
function theHistoryHeld(identifier: string): boolean {
  return (
    execFileSync(
      "git",
      [
        "log",
        "--format=%H",
        "-S",
        identifier,
        "--",
        ".",
        ":(exclude)*.md",
        `:(exclude)${THIS_FILE}`,
      ],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    ).trim().length > 0
  );
}

/**
 * The gone symbols a record names ON PURPOSE, each with the sentence that makes
 * it correct, READ rather than assumed.
 *
 * Every one of these was opened and read before it was written down. The first
 * draft of this map was the pickaxe's output taken on trust, and it was wrong
 * about `containerDeletedAt`: ADR-0119:954 says the tombstone the reads selected
 * "is gone", which is a record correctly reporting a removal, not a stale claim
 * about a live one. A map of things a tool flagged is not a map of things a
 * person checked.
 *
 * NOTHING HERE IS A TODO, which is `adr-as-built.test.ts`'s rule and holds for
 * its reason: "a map of work somebody could have done is a backlog wearing an
 * exception's clothes, and the next reader cannot tell it from a record that
 * genuinely has no half to declare". Every entry below is a sentence that is
 * TRUE as written and would be made false by "fixing" it.
 *
 * IT IS EXPECTED TO GROW, and slowly. An entry arrives when a record narrates a
 * rename it lived through, which is a thing the house style asks records to do
 * -- so the cost of this check is one line per record that correctly remembers
 * its own past, against a defect class that outran two auditors and a `/verify`
 * pass on the record where it was already being hunted.
 */
const NAMED_A_GONE_SYMBOL_ON_PURPOSE: Readonly<Record<string, string>> = {
  asEntry: "ADR-0124 reports CNCORE-114 renaming it, as the standing cost of the check's scope",
  catalogueEntryPublic: "ADR-0124 says CNCORE-114 'has since renamed both to `catalogueRowPublic`'",
  containerDeletedAt: "ADR-0119 says the tombstone the reads selected beside the keys is GONE",
  freePort: "ADR-0144 records the port race it caused and the reader that replaced it",
  globalDependencies: "ADR-0126 records it as REFUSED, which is the decision the record exists for",
  pastInTwoRegimes: "ADR-0119 reports that it did not cover the order and grew out of its own name",
  stillHasAPlaceIn:
    "ADR-0119 says the reads 'were `thePlaceIn` and `stillHasAPlaceIn` until CNCORE-224'",
  thePlaceIn: "ADR-0119, the same sentence",
};

type GoneSymbol = { identifier: string; record: string };

function goneSymbolsNamedByRecords(): GoneSymbol[] {
  const inTheTree = identifiersInTheTree();
  const gone: GoneSymbol[] = [];

  for (const file of readdirSync(adrDirectory).filter((name) => name.endsWith(".md"))) {
    if (file === THIS_RECORD) continue;
    const named = identifiersNamedIn(readFileSync(join(adrDirectory, file), "utf8"));
    for (const identifier of named) {
      if (inTheTree.has(identifier)) continue;
      if (identifier in NAMED_A_GONE_SYMBOL_ON_PURPOSE) continue;
      if (!theHistoryHeld(identifier)) continue;
      gone.push({ identifier, record: file });
    }
  }

  return gone.sort((a, b) =>
    `${a.record}${a.identifier}`.localeCompare(`${b.record}${b.identifier}`),
  );
}

describe("an identifier a record names", () => {
  /**
   * THE PICKAXE NEEDS THE HISTORY, and a shallow clone has none.
   *
   * `actions/checkout` fetches depth 1 unless asked otherwise, and under one
   * every identifier would answer "never ours" -- so this whole file would pass
   * having asked nothing, which is the false signal `CLAUDE.md` is about and
   * the shape `ui-callers.test.ts` and `corpus-figures.test.ts` both guard at
   * the root of their own chains. The `test` job in `ci.yml` sets
   * `fetch-depth: 0` for this, and this refuses to run rather than trusting it
   * to stay set.
   */
  it("is checked against a repository that has its history", () => {
    const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();

    expect(
      shallow,
      "this check reads git history with a pickaxe, and a shallow clone would answer 'never ours' for every identifier and pass having asked nothing -- `ci.yml`'s `test` job sets `fetch-depth: 0` for it",
    ).toBe("false");
  });

  /**
   * IT THROWS ON AN EMPTY POPULATION rather than reporting that every record is
   * fine, which is `adr-as-built.test.ts`'s guard for its own reason: a pathspec
   * that stopped matching would turn this file green having read nothing.
   */
  it("is read from a corpus that is actually there", () => {
    const records = readdirSync(adrDirectory).filter((name) => name.endsWith(".md"));
    expect(records.length).toBeGreaterThan(100);

    const named = new Set<string>();
    for (const file of records) {
      for (const identifier of identifiersNamedIn(readFileSync(join(adrDirectory, file), "utf8"))) {
        named.add(identifier);
      }
    }
    expect(
      named.size,
      "the records name no camelCase identifiers at all, so this file read nothing",
    ).toBeGreaterThan(200);
  });

  /**
   * A PICKAXE PER UNRESOLVED IDENTIFIER, over every commit this repository has.
   *
   * VITEST'S DEFAULT IS FIVE SECONDS AND THIS RUNS IN ABOUT FIVE AND A THIRD, so
   * it FLAKED rather than failed -- green alone, red once in eight in the full
   * suite, and the failure said "Test timed out in 5000ms" rather than naming a
   * record. A check whose verdict depends on how busy the machine is teaches a
   * reader to re-run it, which is how a real finding gets re-run away.
   *
   * THE COST IS THE FOREIGN IDENTIFIERS, and it is inherent rather than sloppy:
   * one that WAS ours is found early and stops the walk, where the 47 that never
   * were can only be established by reading every commit to the end.
   */
  it("is not one this repository has renamed away", () => {
    const gone = goneSymbolsNamedByRecords();

    expect(
      gone.map(
        ({ record, identifier }) =>
          `${record} names \`${identifier}\`, which this tree no longer has`,
      ),
      "a record names a symbol this repository's history holds and its tree does not: correct the sentence that carries it, or -- if the sentence is reporting the removal rather than asserting the symbol -- name it in `NAMED_A_GONE_SYMBOL_ON_PURPOSE` with the reason",
    ).toEqual([]);
  }, 60_000);

  /**
   * AND THE MAP IS HELD TO THE SAME STANDARD IT EXCUSES.
   *
   * An entry whose identifier came BACK, or which never left, is an exception
   * guarding nothing -- and it would silently excuse a future rename of that
   * same name. `adr-as-built.test.ts` learned this the expensive way: three of
   * its entries "left because the check below MADE them rather than because
   * anybody remembered".
   */
  it("is not excused by an entry that has stopped being true", () => {
    const inTheTree = identifiersInTheTree();
    const stale = Object.keys(NAMED_A_GONE_SYMBOL_ON_PURPOSE).filter(
      (identifier) => inTheTree.has(identifier) || !theHistoryHeld(identifier),
    );

    expect(
      stale,
      "an entry in `NAMED_A_GONE_SYMBOL_ON_PURPOSE` names an identifier that is back in the tree, or that this history never held -- it is excusing nothing and should go",
    ).toEqual([]);
  }, 60_000);
});
