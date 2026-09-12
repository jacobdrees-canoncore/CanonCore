import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

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
 * those citations cannot break the way this guards against. 407 of them are
 * legal and stay legal; the 136 this found pointed at files an edit in this
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

/** The prose this rule governs: everything under `docs/`, plus the root documents. */
const ROOT_PROSE = ["CONTEXT.md", "CLAUDE.md", "README.md"];

type Citation = { readonly file: string; readonly line: number; readonly cite: string };

/**
 * The three forms the corpus writes a line citation in. A record is cited by
 * path, by `ADR-0109:7-9`, and by its bare number once the surrounding prose has
 * established which record is under discussion (`0077:15-16`).
 */
const FORMS = [
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

/** Every markdown file this rule governs, spelled as the tree spells it. */
function prose(): string[] {
  const underDocs = readdirSync(join(repoRoot, "docs"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => relative(repoRoot, join(entry.parentPath, entry.name)));
  return [...underDocs, ...ROOT_PROSE].sort();
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
  const found: Citation[] = [];

  for (const file of prose()) {
    readFileSync(join(repoRoot, file), "utf8")
      .split("\n")
      .forEach((text, index) => {
        for (const { by, pattern } of FORMS) {
          for (const match of text.matchAll(pattern)) {
            const cited = match[1] ?? "";
            const resolves =
              by === "number"
                ? records.has(cited)
                : [cited, join(dirname(file), cited)].some((path) => held.has(path));
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

  it("names a section rather than a line number", () => {
    const byLine = resolvableLineCitations().map(
      ({ file, line, cite }) => `${file}:${line} cites \`${cite}\``,
    );
    expect(byLine).toEqual([]);
  });
});
