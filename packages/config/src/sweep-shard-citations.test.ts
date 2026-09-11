import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
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
 * cheapest thing that decides it: the tree is the source of truth, and the
 * citation is the claim checked against it.
 *
 * IT MATCHES SHARD CITATIONS ONLY, and that exclusion is load-bearing rather
 * than laziness. The same documents cite `prompt.md`, which is DELIBERATELY
 * dangling: ADR-0114 rules that the swept prompt never was in the tree and that
 * naming it is the most a dated sweep can honestly do. A gate over every
 * backticked path would fail on a file the project decided not to publish.
 *
 * IT ASKS THE LISTING RATHER THAN `existsSync`, which looks like the long way
 * round and is not. A stat ANSWERS TO THE FILESYSTEM'S OWN RULES: macOS APFS is
 * case-insensitive and CI's Linux is not, so a mis-cased citation would pass on
 * the machine this repo is developed on and fail on the runner. A stat also
 * answers for the whole disk, so a citation climbing out of the corpus on `..`
 * lands on whatever happens to be there and reports GREEN. Comparing against
 * the paths the corpus actually holds decides both the same way everywhere.
 */

const CORPUS = join(repoRoot, "docs/research/competitor-sweep");

/** Every backticked span in a document, which is how this corpus cites a path. */
const BACKTICKED = /`([^`\n]+)`/g;

type Citation = { readonly file: string; readonly line: number; readonly path: string };

/** Every path under the corpus, directories included, spelled as the tree spells it. */
function corpusPaths(): string[] {
  return readdirSync(CORPUS, { recursive: true, withFileTypes: true })
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

function shardCitations(): Citation[] {
  const found: Citation[] = [];
  for (const file of corpusPaths().filter((path) => path.endsWith(".md"))) {
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
  it("finds citations at all, so a green run cannot mean the corpus went silent", () => {
    // Non-empty rather than a pinned count. What this has to catch is the reader
    // going blind -- a moved corpus or a broken pattern, either of which empties
    // the list and passes the test below by having nothing left to check. A
    // number would additionally redden on a document the sweep legitimately
    // drops, which is an edit nobody asked this suite to police.
    expect(shardCitations()).not.toHaveLength(0);
  });

  it("names a path the corpus holds, read from the document that cites it", () => {
    const held = new Set(corpusPaths());
    const dangling = shardCitations()
      .filter(({ file, path }) => !held.has(resolve(dirname(file), path)))
      .map(({ file, line, path }) => `${relative(repoRoot, file)}:${line} cites \`${path}\``);
    expect(dangling).toEqual([]);
  });
});
