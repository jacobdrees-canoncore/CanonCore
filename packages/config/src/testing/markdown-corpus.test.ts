import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { markdownIn, NOT_PROSE, proseIn } from "./markdown-corpus";
import { repoRoot } from "./repo-root";
import { trackedFiles } from "./tracked-files";

/**
 * The prose corpus, asked of a scratch tree so every row can put a question the
 * repository cannot: which directories the reader names is a fact about the
 * reader, and this tree's own directories answer for today's layout only.
 *
 * The rows the three sweeps lean on are proved by what they caught rather than
 * by being green. Four defects planted under `.claude/` passed all three sweeps
 * on the reader-per-suite code and redden them through this one; ADR-0190 has
 * the run.
 */
describe("the prose corpus", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "canoncore-prose-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const write = (...segments: string[]): void => {
    mkdirSync(dirname(join(root, ...segments)), { recursive: true });
    writeFileSync(join(root, ...segments), "");
  };

  it("holds the documents under `.claude/`, beside the ones under `docs/`", () => {
    write("docs", "adr", "0001-a.md");
    write(".claude", "skills", "dispatch", "SKILL.md");

    expect(proseIn(root)).toContain(join(".claude", "skills", "dispatch", "SKILL.md"));
    expect(proseIn(root)).toContain(join("docs", "adr", "0001-a.md"));
  });

  it("holds the root's own documents, and none under a directory it does not name", () => {
    write("CLAUDE.md");
    write("docs", "demo.md");
    write(".claude", "rules", "docs.md");
    write("apps", "web", "AGENTS.md");

    expect(proseIn(root)).toContain("CLAUDE.md");
    expect(proseIn(root)).not.toContain(join("apps", "web", "AGENTS.md"));
  });

  it("is spelled from the root, in one order whichever directory each came from", () => {
    write("docs", "demo.md");
    write(".claude", "rules", "docs.md");
    write("CLAUDE.md");

    expect(proseIn(root)).toStrictEqual([
      join(".claude", "rules", "docs.md"),
      "CLAUDE.md",
      join("docs", "demo.md"),
    ]);
  });
});

/**
 * THE STANDING GUARD, and the one row here about the repository rather than the
 * reader. One reader ends today's divergence by construction; what reopens it
 * is a new directory of prose nobody told the reader about, excused by
 * `doc-line-citations.test.ts` exactly as `.claude/` was. So the reader's list
 * is held against GIT, which owns the question "what markdown exists", and the
 * dispatcher's reason for asking it is that a new directory then gets decided
 * rather than silently left out.
 *
 * `toStrictEqual` IN BOTH DIRECTIONS, because an exclusion that stops matching
 * is as silent as a directory nobody named: a renamed `AGENTS.md` would leave
 * `NOT_PROSE` excusing a path nothing holds.
 */
describe("the markdown this repository tracks", () => {
  it("is all in the prose corpus, bar the documents named as not prose", () => {
    const swept = new Set(proseIn(repoRoot));

    expect(trackedFiles(["*.md"]).filter((path) => !swept.has(path))).toStrictEqual(
      [...NOT_PROSE].sort(),
    );
  });
});

/**
 * The shape no corpus sweep can be right about, ASKED DIRECTLY for the reason
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
   * descend. Nothing cites a line of a file no sweep reads, so refusing
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
