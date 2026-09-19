import type { Dirent } from "node:fs";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { repoRoot } from "./testing/repo-root";

/**
 * A prose document cites another by SECTION, never by line number.
 *
 * A line citation is correct only until somebody edits the file above it, and
 * NOTHING REPORTS THE BREAK: the citation still reads as though it names
 * something, and now points at a blank line or the wrong paragraph. That is the
 * same shape `adr-numbering.test.ts` exists to catch -- a citation that stays
 * syntactically fine while becoming false -- and it is caught the same way,
 * because review cannot be asked to hold it by hand.
 *
 * MEASURED RATHER THAN HYPOTHETICAL. CNCORE-85 edited `the-cheap-end.md` on
 * 2026-09-12 and silently moved the text `does-cncore-60-need-a-host.md` was
 * citing: the citation landed on a blank line and a heading. A review of that
 * same diff then found four more already wrong on `main`, all pointing into
 * ADR-0109 -- `:229-238` had drifted onto a paragraph about quotation, `:105-109`
 * onto Storage Box pricing, `:313-318` onto the cron daemon. Each read as though
 * it named the sentence the citing document quoted. None of them did.
 *
 * IT BANS THE FORM RATHER THAN CHECKING THE QUOTE, because a quote checker
 * decides the wrong question. It would pass a citation whose line happens to
 * still hold its text and fail one whose document legitimately rephrased, so it
 * would police edits to the TARGET while leaving the citing document's real
 * defect -- a pointer that cannot survive an edit -- standing. The form is what
 * is unsafe, so the form is what this refuses.
 *
 * IT BANS ONLY CITATIONS THIS TREE CAN RESOLVE, and that exclusion is
 * load-bearing rather than laziness. `docs/research/` cites `SPEC.md`,
 * `decisions.md`, `harry-potter-pass.md` and the forensic record by line, and
 * `docs/research/README.md` rules those left as written: they are accurate about
 * the state of the repo when they were written, resolved through git history,
 * and "editing research to match a later deletion would falsify the record of
 * what was known when". An edit here cannot move a file that is not here, so
 * those citations cannot break the way this guards against. 330 of them are
 * legal and stay legal; the 213 this found pointed at files an edit in this
 * repository moves.
 *
 * CODE IS NOT PROSE. `ci.yml:113-132` and `docker-compose.yml:32` are
 * conventional, an editor resolves them, and a build reports it when they rot.
 * Only markdown citing markdown is matched.
 *
 * IT ASKS THE LISTING RATHER THAN `existsSync`, for the reason
 * `sweep-shard-citations.test.ts` gives at length: a stat answers to the
 * filesystem's own rules, so a mis-cased citation would pass on this
 * case-insensitive Mac and fail on CI's Linux, and one climbing out of the tree
 * on `..` would land on whatever happens to be there. Comparing against the
 * paths the tree actually holds decides it the same way everywhere.
 */

/**
 * The prose this rule governs is everything under `docs/` plus every markdown
 * document at the root, READ FROM THE TREE rather than listed here: `CONTEXT.md`
 * and `CLAUDE.md` are cited by line more than any record is, and a fourth root
 * document added later would otherwise be silently uncovered. A symlinked one
 * is the case that sentence promised to cover and did not, and `markdownIn`
 * below refuses it rather than letting it leave this sweep unremarked.
 */
function rootProse(): string[] {
  return markdownIn(repoRoot);
}

/**
 * The markdown documents under ONE directory, with a symlinked one REFUSED
 * rather than dropped (CNCORE-204).
 *
 * `Dirent.isFile()` is lstat, so it is FALSE for a symlink pointing at a file
 * and `isSymbolicLink()` is true instead. Filtering on the first alone took a
 * symlinked document out of both reads above in silence -- and the silence was
 * wider than a document going unread. `prose()` feeds the `held` set that
 * decides which citations this sweep BANS, and a citation whose target is
 * missing from it reads as HISTORY, the exemption `docs/research/README.md`
 * earns for citations naming files this tree does not hold. So a line citation
 * into a symlinked document was not merely unchecked: it was affirmatively
 * excused, by a rule that meant to excuse something else.
 *
 * REFUSED FOR A REASON OF ITS OWN, and neither of the two above it. CNCORE-200
 * refuses a symlinked package DIRECTORY because pnpm and turbo answer
 * differently about it; there are no two such tools here, and `readFileSync`
 * reads a symlinked document exactly as an editor does. CNCORE-201 refuses a
 * symlinked Vitest config because `isInside` places a config by its PATH and a
 * symlink hides a climb from it; `prose()` has no placement rule at all -- a
 * document's path is simply its name.
 *
 * WHAT IS REFUSED IS A DOCUMENT WHOSE LINES THIS REPOSITORY HOLDS TWO ANSWERS
 * FOR, which is the one thing this sweep is entirely about. Git stores a
 * symlink as mode `120000`, a blob holding the target path, so the document a
 * checkout reads through the link and the document git holds at that path are
 * not the same document and do not have the same lines. The measurement is in
 * ADR-0103 under "a symlinked markdown document has lines on disk and none in
 * git", and is NOT restated here: a figure kept in two places is a figure that
 * drifts in one of them.
 *
 * THE NAME IS READ BEFORE THE LINK IS, so what this refuses is a symlink
 * WEARING A DOCUMENT'S NAME rather than a symlink in the corpus, and a DANGLING
 * one is refused on the name alone -- a measured difference from
 * `directoriesUnder`, which drops one. No stat is taken, which is what keeps
 * this one rule rather than two.
 *
 * A SYMLINKED DIRECTORY IS NOT THIS SHAPE and is left to CNCORE-211: node
 * DESCENDS one on a recursive read, so nothing drops out of this sweep and the
 * silence above is absent. What it leaves instead is a path git does not hold,
 * which is that ticket's subject.
 *
 * EVERY offender is named and not the first, for the reason `ungatedPackages`,
 * `directoriesUnder` and `configFilesIn` are each named rather than counted:
 * two are two things to fix.
 */
function markdownIn(directory: string, { recursive = false } = {}): string[] {
  const entries = readdirSync(directory, { recursive, withFileTypes: true }).filter((entry) =>
    entry.name.endsWith(".md"),
  );
  const at = (entry: Dirent): string => relative(directory, join(entry.parentPath, entry.name));
  const symlinked = entries.filter((entry) => entry.isSymbolicLink());
  if (symlinked.length > 0) {
    const paths = symlinked.map((entry) => join(directory, at(entry))).join(", ");
    throw new Error(
      `a symlinked markdown document has lines on disk and none in git, so it is refused: ${paths}`,
    );
  }
  return entries.filter((entry) => entry.isFile()).map(at);
}

type Citation = { readonly file: string; readonly line: number; readonly cite: string };

/**
 * The three forms the corpus writes a line citation in. A record is cited by
 * path, by `ADR-0109:7-9`, and by its bare number once the surrounding prose has
 * established which record is under discussion (`0077:15-16`).
 */
const FORMS = [
  /**
   * The path form also covers two spellings the corpus uses for the same thing:
   * a record with its slug ELIDED (`docs/adr/0074-...md:5`), and a bare filename
   * whose directory an earlier mention established (`verify-plex-claims.md:317`).
   * Both are resolved in `resolvesPath`. A trailing comma list -- `:111,172,1017`
   * -- is matched on its first line, which is enough to report the citation.
   */
  { by: "path", pattern: /([A-Za-z0-9_./-]+\.md):(\d+)(?:-\d+)?/g },
  { by: "number", pattern: /ADR-(\d{4}):(\d+)(?:-\d+)?/g },
  /**
   * The bare form needs both guards. Without the lookbehind `4700:4700` matches
   * inside the IPv6 address `2606:4700:4700::1111` that ADR-0034 quotes; without
   * the lookahead `2606:4700` does. Neither resolves to a record, so neither
   * would be reported -- but a pattern that relies on the index to reject what it
   * should not have matched is one that reports the wrong thing the day a record
   * takes a number it collides with.
   */
  { by: "number", pattern: /(?<![\w:.-])(\d{4}):(\d+)(?:-\d+)?(?![\d.:])/g },
] as const;

// TODO(CNCORE-211): the recursive read below DESCENDS a symlinked directory
// under `docs/` rather than dropping it, so its documents are swept at paths git
// does not hold -- and one pointing back inside `docs/` reaches every document
// under it twice, which `byBasename` then drops as a real ambiguity.
/** Every markdown file this rule governs, spelled as the tree spells it. */
function prose(): string[] {
  const underDocs = markdownIn(join(repoRoot, "docs"), { recursive: true }).map((path) =>
    join("docs", path),
  );
  return [...underDocs, ...rootProse()].sort();
}

/**
 * Each document's path keyed by its BARE FILENAME, for the corpus's habit of
 * citing `verify-plex-claims.md:317` once the directory is established by an
 * earlier mention. Only names held by exactly one document are keyed: two files
 * sharing a basename make the citation genuinely ambiguous, and guessing which
 * was meant would report a file the author may never have been naming.
 */
function byBasename(): Map<string, string> {
  const seen = new Map<string, string | null>();
  for (const path of prose()) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    seen.set(name, seen.has(name) ? null : path);
  }
  return new Map([...seen].flatMap(([n, p]) => (p === null ? [] : [[n, p] as const])));
}

/** Each record's path, keyed by the four digits its filename opens with. */
function recordsByNumber(): Map<string, string> {
  return new Map(
    readdirSync(join(repoRoot, "docs", "adr"))
      .filter((file) => file.endsWith(".md"))
      .flatMap((file) => {
        const number = /^(\d{4})-/.exec(file)?.[1];
        return number === undefined ? [] : [[number, join("docs/adr", file)] as const];
      }),
  );
}

/**
 * Every line citation whose target this tree holds. A citation the tree cannot
 * resolve is history, and is left where `docs/research/README.md` leaves it.
 */
function resolvableLineCitations(): Citation[] {
  const held = new Set(prose());
  const records = recordsByNumber();
  const named = byBasename();
  const found: Citation[] = [];

  /** Whether this tree holds the document a path citation names. */
  const resolvesPath = (file: string, cited: string): boolean => {
    if ([cited, join(dirname(file), cited)].some((path) => held.has(path))) return true;
    const base = cited.slice(cited.lastIndexOf("/") + 1);
    // `docs/adr/0074-...md:5` — the corpus elides a record's slug and keeps its
    // number, which still names one record exactly.
    const elided = /^(\d{4})-\.{2,}\.?md$/.exec(base);
    if (elided?.[1] !== undefined) return records.has(elided[1]);
    // A bare `verify-plex-claims.md:317`, whose directory an earlier mention set.
    return cited === base && named.has(base);
  };

  for (const file of prose()) {
    readFileSync(join(repoRoot, file), "utf8")
      .split("\n")
      .forEach((text, index) => {
        for (const { by, pattern } of FORMS) {
          for (const match of text.matchAll(pattern)) {
            const cited = match[1] ?? "";
            const resolves = by === "number" ? records.has(cited) : resolvesPath(file, cited);
            if (resolves) found.push({ file, line: index + 1, cite: match[0] });
          }
        }
      });
  }
  return found;
}

describe("a document citing another document", () => {
  it("is read at all, so a green run cannot mean the reader went silent", () => {
    // A moved corpus or a broken pattern empties the list and satisfies the rule
    // below by having nothing left to check. Non-empty rather than a pinned
    // count: the historical citations this deliberately permits are the subject
    // here, and their number is not this suite's to police.
    expect(prose().length).toBeGreaterThan(0);
    expect(recordsByNumber().size).toBeGreaterThan(0);
  });

  it("does not name a line number in a target this tree holds", () => {
    const byLine = resolvableLineCitations().map(
      ({ file, line, cite }) => `${file}:${line} cites \`${cite}\``,
    );
    expect(byLine).toEqual([]);
  });
});

/**
 * And the shape this sweep cannot be right about, ASKED DIRECTLY for the reason
 * `workspace.test.ts` and `network-gate-wiring.test.ts` ask theirs directly: no
 * markdown document in this repository is a symlink, so the repository is the
 * one place the question cannot be put (CNCORE-204).
 */
describe("a symlinked markdown document", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "canoncore-prose-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("is refused by name rather than dropped out of the sweep", () => {
    writeFileSync(join(directory, "CLAUDE.md"), "");
    symlinkSync(join(directory, "CLAUDE.md"), join(directory, "AGENTS.md"));

    expect(() => markdownIn(directory)).toThrow(/AGENTS\.md/);
  });

  it("is refused under a nested directory too, which is where the corpus lives", () => {
    mkdirSync(join(directory, "adr"));
    writeFileSync(join(directory, "adr", "0001-a.md"), "");
    symlinkSync(join(directory, "adr", "0001-a.md"), join(directory, "adr", "mirror.md"));

    expect(() => markdownIn(directory, { recursive: true })).toThrow(/adr\/mirror\.md/);
  });

  /**
   * NAMED RATHER THAN COUNTED, which is the line this package already takes
   * about `ungatedPackages`, `directoriesUnder` and `configFilesIn`: two
   * symlinked documents are two things to fix, and a message carrying the first
   * sends the reader back for the second.
   */
  it("is named alongside every other one, rather than the first standing for them all", () => {
    writeFileSync(join(directory, "CLAUDE.md"), "");
    symlinkSync(join(directory, "CLAUDE.md"), join(directory, "one.md"));
    symlinkSync(join(directory, "CLAUDE.md"), join(directory, "two.md"));

    expect(() => markdownIn(directory)).toThrow(/one\.md.*two\.md/s);
  });

  /**
   * A corpus may hold as many symlinks as it likes; what it may not hold is one
   * wearing a DOCUMENT'S name. Nothing cites a line of a file this sweep never
   * reads, so refusing one would invent a problem.
   */
  it("is not an ordinary symlink that no markdown filename matches", () => {
    writeFileSync(join(directory, "CLAUDE.md"), "");
    writeFileSync(join(directory, "notes.txt"), "");
    symlinkSync(join(directory, "notes.txt"), join(directory, "link.txt"));

    expect(markdownIn(directory)).toStrictEqual(["CLAUDE.md"]);
  });

  /**
   * REFUSED WHEN IT DANGLES, where `directoriesUnder` drops one -- a measured
   * difference rather than an inconsistency. There, a thing that stats as
   * nothing is not a package to pnpm or to turbo either, so all three readers
   * agree. Here the name is read BEFORE the link is, and a path at the root of
   * the corpus wearing `.md` that nothing can open is exactly the unremarked
   * document this refuses. Reading it would throw ENOENT out of the sweep at a
   * line naming no reason; this names one.
   */
  it("is refused when it dangles, because the name is read before the link is", () => {
    symlinkSync(join(directory, "gone.md"), join(directory, "AGENTS.md"));

    expect(() => markdownIn(directory)).toThrow(/AGENTS\.md/);
  });

  /**
   * AND A SYMLINKED DIRECTORY IS READ THROUGH RATHER THAN REFUSED, which is
   * pinned here because it is the opposite of what the entry case would lead a
   * reader to assume. `readdirSync` with `recursive: true` DESCENDS a symlinked
   * directory and returns what is inside it as ordinary files -- measured on
   * node v24.19.0 -- so nothing drops out and this ticket's silence is absent.
   * It is not therefore harmless: git holds the directory as a link, so every
   * path under it is one no reader of the published repository has. That is
   * CNCORE-211, and it is a different shape from this one.
   */
  it("is descended rather than dropped, so its documents are swept under it", () => {
    mkdirSync(join(directory, "elsewhere"));
    writeFileSync(join(directory, "elsewhere", "outside.md"), "");
    symlinkSync(join(directory, "elsewhere"), join(directory, "linked"));

    expect(markdownIn(directory, { recursive: true })).toContain(join("linked", "outside.md"));
  });
});
