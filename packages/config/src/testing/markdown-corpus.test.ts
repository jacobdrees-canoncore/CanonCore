import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NOT_PROSE, proseIn } from "./markdown-corpus";
import { repoRoot } from "./repo-root";
import { trackedFiles } from "./tracked-files";

/**
 * The prose corpus, asked of a scratch tree so every row can put the question
 * the repository cannot: what the corpus holds is a fact about which
 * directories it names, and this tree's own directories answer only for today.
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

describe("the markdown this repository tracks", () => {
  it("is all in the prose corpus, bar the documents named as not prose", () => {
    const swept = new Set(proseIn(repoRoot));

    expect(trackedFiles(["*.md"]).filter((path) => !swept.has(path))).toStrictEqual(
      [...NOT_PROSE].sort(),
    );
  });
});
