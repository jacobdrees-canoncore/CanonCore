import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./testing/repo-root";
import { trackedFiles } from "./testing/tracked-files";
import { type Comment, commentsIn, withoutComments } from "./testing/without-comments";

/**
 * A DOCBLOCK SITS ON THE DECLARATION IT DESCRIBES, so one standing directly on
 * another is describing something else (ADR-0196).
 *
 * A reader takes the block above a symbol as that symbol's. Two in a row means
 * the upper one belongs somewhere the reader is not looking, and the symbol it
 * does belong to is usually the one with no block at all. This repository keeps
 * its reasoning beside the code, so reasoning beside the WRONG code is worse than
 * none: it is read, and believed, about the wrong thing.
 *
 * THE SHAPE HAS SEVERAL CAUSES AND ONE SIGNATURE. A declaration inserted between
 * a block and its own; a block rewritten with the old draft left behind; a list
 * split in two with its block left on the half it no longer describes. Each
 * leaves one `/**` standing directly on another, so that is what this reads.
 *
 * A FILE'S HEADER IS EXEMPT, because a module's own docblock sitting on its first
 * declaration's is how this tree writes a header (`headerOf` below).
 *
 * ONLY A DOCBLOCK ON A DOCBLOCK. A plain comment over one is a heading over a run
 * of fields, and one under it is a note on how the thing is built; the tree holds
 * both lawfully, and the rows below pin that each is left alone.
 *
 * WHAT IT CANNOT SEE, stated rather than left to be found:
 * - A misplaced block that is also its file's first docblock after the imports,
 *   which reads as a header. `global-setup.ts`'s block for `setup` was one, and
 *   was moved by hand.
 * - A plain comment stacked on the wrong plain comment. `item.get`'s note on the
 *   members cursor was one, and was moved by hand.
 * - Either provider repository. TODO(CNCORE-321): each needs a check of its own.
 */
describe("a docblock stacked on another", () => {
  it("is reported by the line it opens on", () => {
    const source = [
      "export const first = 1;",
      "",
      "/** What `second` is. */",
      "/** What `third` is. */",
      "export const third = 3;",
    ].join("\n");

    expect(stackedDocblocks(source)).toStrictEqual([3]);
  });

  it("is not a file's own header sitting over its first declaration", () => {
    const source = [
      'import { z } from "zod";',
      "",
      "/** What this module is for. */",
      "/** What `first` is. */",
      "export const first = z.string();",
    ].join("\n");

    expect(stackedDocblocks(source)).toStrictEqual([]);
  });

  it("is not two docblocks with a declaration between them", () => {
    const source = [
      "export const first = 1;",
      "",
      "/** What `second` is. */",
      "export const second = 2;",
      "/** What `third` is. */",
      "export const third = 3;",
    ].join("\n");

    expect(stackedDocblocks(source)).toStrictEqual([]);
  });

  it("is not a plain comment over a docblock", () => {
    const source = [
      "export const first = 1;",
      "",
      "/* THE EXTENSIONS, a heading over the fields below. */",
      "/** What `second` is. */",
      "export const second = 2;",
    ].join("\n");

    expect(stackedDocblocks(source)).toStrictEqual([]);
  });

  it("is not a docblock over a plain comment", () => {
    const source = [
      "export const first = 1;",
      "",
      "/** What `second` is. */",
      "/* AND A NOTE on how it is built. */",
      "export const second = 2;",
    ].join("\n");

    expect(stackedDocblocks(source)).toStrictEqual([]);
  });

  it("is not a header under a directive either", () => {
    const source = [
      '"use server";',
      "",
      'import { z } from "zod";',
      "",
      "/** What these actions are for. */",
      "/** What `first` is. */",
      "export const first = z.string();",
    ].join("\n");

    expect(stackedDocblocks(source)).toStrictEqual([]);
  });

  it("stands nowhere in a tracked source", () => {
    const tracked = trackedFiles(["packages/*.ts", "packages/*.tsx", "apps/*.ts", "apps/*.tsx"]);
    expect(tracked.length).toBeGreaterThan(100);

    const stacked = tracked.flatMap((path) =>
      stackedDocblocks(readFileSync(join(repoRoot, path), "utf8")).map((line) => `${path}:${line}`),
    );

    expect(stacked).toStrictEqual([]);
  });
});

/**
 * The line each stacked docblock opens on: the UPPER one, which is the block
 * describing something other than what it sits on.
 *
 * THE COMMENTS COME FROM THE SCAN, NOT A PATTERN, for ADR-0177's reason: a `/**`
 * inside a string or a regex is text, and only the scan knows which it is.
 */
function stackedDocblocks(source: string): number[] {
  const comments = commentsIn(source);
  const header = headerOf(source, comments);
  return comments
    .filter((comment, index) => {
      const next = comments[index + 1];
      return (
        next !== undefined &&
        comment !== header &&
        isADocblock(comment) &&
        isADocblock(next) &&
        source.slice(comment.at + comment.text.length, next.at).trim() === ""
      );
    })
    .map((comment) => source.slice(0, comment.at).split("\n").length);
}

function isADocblock(comment: Comment): boolean {
  return comment.text.startsWith("/**");
}

/**
 * The file's own header: its first docblock, when nothing but imports and a
 * directive stand above it.
 *
 * A PATTERN IS SAFE HERE WHERE ADR-0177 REFUSED ONE, because this one reads what
 * the scan left behind. The comments above the header are already blanked, so
 * what remains is statements, and the only statements lawful above a header are
 * an import and a directive like `"use server"`.
 */
function headerOf(source: string, comments: readonly Comment[]): Comment | undefined {
  const first = comments.find(isADocblock);
  if (first === undefined) return undefined;
  const above = withoutComments(source.slice(0, first.at))
    .replace(AN_IMPORT, "")
    .replace(A_DIRECTIVE, "");
  return above.trim() === "" ? first : undefined;
}

const AN_IMPORT = /\bimport\b[^;]*?(?:\bfrom\s*)?["'][^"']*["'];?/g;
const A_DIRECTIVE = /^\s*["']use [a-z]+["'];?/;
