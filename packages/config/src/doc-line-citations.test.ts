import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { markdownIn } from "./testing/markdown-corpus";
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

    const sweep = (): unknown => markdownIn(directory);
    expect(sweep).toThrow(/one\.md/);
    expect(sweep).toThrow(/two\.md/);
  });

  /**
   * A corpus may hold as many symlinks to files as it likes; what it may not
   * hold is one wearing a DOCUMENT'S name, or one a recursive read would
   * descend. Nothing cites a line of a file this sweep never reads, so refusing
   * one would invent a problem.
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
});

/**
 * And the shape a recursive read got wrong by DESCENDING rather than by
 * dropping, asked directly for the same reason: no directory under `docs/` is a
 * symlink, so the repository cannot put the question (CNCORE-211).
 */
describe("a symlinked directory under the corpus", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "canoncore-prose-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("is refused by name rather than descended", () => {
    mkdirSync(join(directory, "elsewhere"));
    writeFileSync(join(directory, "elsewhere", "outside.md"), "");
    mkdirSync(join(directory, "corpus"));
    symlinkSync(join(directory, "elsewhere"), join(directory, "corpus", "linked"));

    expect(() => markdownIn(join(directory, "corpus"), { recursive: true })).toThrow(
      /symlinked directory.*corpus\/linked$/,
    );
  });

  /**
   * REFUSED BEFORE IT IS READ, which the row above cannot tell apart from
   * walking the link first and refusing after. Walking is the cost that matters
   * -- a link out of the repository walks whatever it names -- so the target
   * here is one nothing can open. Node's recursive read throws EACCES on it
   * while a stat of the link still answers, and the first assertion is that
   * control: it fails loudly rather than passing vacuously wherever permission
   * bits are not enforced, as they are not for root.
   */
  /**
   * The corpus's own directory is walked into like every directory under it,
   * and `docs` is an entry git holds exactly as it holds one beneath it -- so a
   * link THERE splits node and git over every document in the corpus at once.
   */
  it("is refused when it is the corpus itself, which a recursive read enters first", () => {
    mkdirSync(join(directory, "elsewhere"));
    writeFileSync(join(directory, "elsewhere", "outside.md"), "");
    symlinkSync(join(directory, "elsewhere"), join(directory, "corpus"));

    expect(() => markdownIn(join(directory, "corpus"), { recursive: true })).toThrow(
      /symlinked directory.*corpus$/,
    );
  });

  it("is refused before it is read through, so a target nothing can open is no obstacle", () => {
    mkdirSync(join(directory, "elsewhere"));
    writeFileSync(join(directory, "elsewhere", "outside.md"), "");
    mkdirSync(join(directory, "corpus"));
    symlinkSync(join(directory, "elsewhere"), join(directory, "corpus", "linked"));
    chmodSync(join(directory, "elsewhere"), 0o000);

    try {
      expect(() => readdirSync(join(directory, "elsewhere"))).toThrow(/EACCES/);
      expect(() => markdownIn(join(directory, "corpus"), { recursive: true })).toThrow(
        /symlinked directory.*corpus\/linked$/,
      );
    } finally {
      chmodSync(join(directory, "elsewhere"), 0o755);
    }
  });

  /**
   * ONE path, named once. Node's recursive read of this tree does not throw: it
   * returns a copy of the document at every depth until it gives up, and a
   * reader that followed the link, or walked it before refusing, would name the
   * link at every depth it reached.
   */
  it("is refused once when it is a cycle, rather than walked until the read gives up", () => {
    mkdirSync(join(directory, "adr"));
    writeFileSync(join(directory, "adr", "0001-a.md"), "");
    symlinkSync("..", join(directory, "adr", "up"));

    expect(() => markdownIn(directory, { recursive: true })).toThrow(
      new RegExp(`symlinked directory.*: ${RegExp.escape(join(directory, "adr", "up"))}$`),
    );
  });

  /**
   * The root read sweeps the root's own documents and enters no directory, so a
   * link beside them is nothing it reads -- refusing one would invent a problem,
   * and stat every link at the root to do it.
   */
  it("is not refused by a read that does not recurse, since that read enters no directory", () => {
    writeFileSync(join(directory, "CLAUDE.md"), "");
    mkdirSync(join(directory, "elsewhere"));
    symlinkSync(join(directory, "elsewhere"), join(directory, "linked"));

    expect(markdownIn(directory)).toStrictEqual(["CLAUDE.md"]);
  });

  it("is named alongside every other refusal, a symlinked document's included", () => {
    mkdirSync(join(directory, "elsewhere"));
    writeFileSync(join(directory, "CLAUDE.md"), "");
    symlinkSync(join(directory, "elsewhere"), join(directory, "linked-one"));
    symlinkSync(join(directory, "elsewhere"), join(directory, "linked-two"));
    symlinkSync(join(directory, "CLAUDE.md"), join(directory, "AGENTS.md"));

    const sweep = (): unknown => markdownIn(directory, { recursive: true });
    expect(sweep).toThrow(/AGENTS\.md/);
    expect(sweep).toThrow(/linked-one/);
    expect(sweep).toThrow(/linked-two/);
  });

  /**
   * A DANGLING one is dropped here where a dangling DOCUMENT is refused, and the
   * difference is the name. A document is refused on the name it wears, before
   * the link is read; a directory wears none, so it is known only by a stat, and
   * a link that stats as nothing has nothing under it to sweep -- the reason
   * `directoriesUnder` drops one. Without `throwIfNoEntry: false` it would throw
   * ENOENT out of the sweep, naming a path and no reason.
   */
  it("is only a link that stats as a directory, so one to a file or to nothing is left alone", () => {
    mkdirSync(join(directory, "adr"));
    writeFileSync(join(directory, "adr", "0001-a.md"), "");
    writeFileSync(join(directory, "adr", "notes.txt"), "");
    symlinkSync(join(directory, "adr", "notes.txt"), join(directory, "adr", "link.txt"));
    symlinkSync(join(directory, "gone"), join(directory, "adr", "dangling"));

    expect(markdownIn(directory, { recursive: true })).toStrictEqual([join("adr", "0001-a.md")]);
  });
});
