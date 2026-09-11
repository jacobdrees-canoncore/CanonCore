import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./testing/repo-root";

/**
 * The competitor sweep cites the URL shard each document was written from, and
 * a citation that resolves to nothing costs every reader who tries to open one.
 *
 * THE CONVENTION ITSELF WAS WRONG, not one stray line. Twenty-one citations
 * across nine files all said `shards/<name>` while the lists have always been
 * tracked at `urls/shards/<name>`, so consistency is exactly what hid it:
 * CNCORE-61 stripped an absolute prefix off five of these lines and landed them
 * on the corpus's own convention, which is the edit that exposed the convention
 * rather than broke it. ADR-0114 records that scrub and named `shards/<name>`
 * as the bare form to land on; CNCORE-78 corrects both the corpus and that
 * sentence.
 *
 * A GUARD RATHER THAN A ONE-OFF, because a corpus that drifted once under
 * review is one review cannot be asked to hold again by hand. This is the
 * cheapest thing that decides it: the filesystem is the source of truth, and
 * the citation is the claim checked against it.
 *
 * IT MATCHES SHARD CITATIONS ONLY, and that exclusion is load-bearing rather
 * than laziness. The same documents cite `prompt.md`, which is DELIBERATELY
 * dangling: ADR-0114 rules that the swept prompt never was in the tree and that
 * naming it is the most a dated sweep can honestly do. A gate over every
 * backticked path would fail on a file the project decided not to publish.
 */

const CORPUS = join(repoRoot, "docs/research/competitor-sweep");

/** Every backticked span in a document, which is how this corpus cites a path. */
const BACKTICKED = /`([^`\n]+)`/g;

type Citation = { readonly file: string; readonly line: number; readonly path: string };

function shardCitations(): Citation[] {
  const found: Citation[] = [];
  for (const name of readdirSync(CORPUS)
    .filter((n) => n.endsWith(".md"))
    .sort()) {
    const file = join(CORPUS, name);
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((text, index) => {
        for (const match of text.matchAll(BACKTICKED)) {
          const cited = match[1];
          if (cited?.includes("shards/")) found.push({ file, line: index + 1, path: cited });
        }
      });
  }
  return found;
}

describe("the competitor sweep's shard citations", () => {
  it("cites shards at all, so a green run cannot mean the corpus went silent", () => {
    expect(shardCitations().length).toBeGreaterThan(20);
  });

  it("names a path that resolves, read from the document that cites it", () => {
    const dangling = shardCitations()
      .filter(({ file, path }) => !existsSync(join(dirname(file), path)))
      .map(({ file, line, path }) => `${relative(repoRoot, file)}:${line} cites \`${path}\``);
    expect(dangling).toEqual([]);
  });
});
