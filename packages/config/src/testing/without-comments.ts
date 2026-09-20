/**
 * A source with its comments taken out, SCANNED rather than matched, so a `/*`
 * inside a string is text and not the start of a comment.
 *
 * FOUR SUITES READ SOURCE AS TEXT and every one of them has to do this first,
 * because a comment is prose ABOUT code and each of those suites counts a token
 * that its own prose says out loud. `prefetch-condition.test.ts` explains the
 * rule using the word `prefetch`; `tree-figures.ts` quotes `redirect()` in the
 * paragraph above the call it is counting; `turbo-cache-inputs.test.ts` writes
 * `../../../` into a note about climbs and measured that sentence alone
 * reporting `packages/config` as reaching outside itself. Without this they each
 * argue with whoever documents them.
 *
 * IT IS A SCAN BECAUSE A REGULAR EXPRESSION CANNOT DO IT, and the four copies
 * this replaces were four copies of the same defect (CNCORE-300).
 * `source.replace(/\/\*[\s\S]*?\*\//g, " ")` does not know a string literal from
 * code, so ANY `/*` opens a comment and swallows source to the next `*\/`. Two
 * spellings in this tree do exactly that -- a glob like `"**\/*"`, which
 * `apps/web/browser/gate.ts` passes to `context.route`, and a `/*` written
 * inside a `//` line comment, which the block pass reaches first because it runs
 * first.
 *
 * MEASURED, not feared. Over the 178 tracked non-test sources on 2026-09-21 the
 * regex lost zero imports and ONE export:
 * `testing/workspace.ts`'s own `isWorkspacePattern`, whose line comment says
 * "Only the `<name>/*` shape this repo uses" and whose `/*` swallowed the
 * fourteen lines to the end of the next docblock, declaration included. That is
 * the SILENT half of the defect rather than the loud one -- a name never
 * collected is a name nothing can report dead, which is the one answer
 * `ui-callers.test.ts` says it must never give.
 *
 * THE FOLD IS OF THE MECHANISM, WHICH IS
 * [[0171-the-fold-is-of-the-read-not-of-the-question-it-answers]]'s seam and not
 * a new one. That record left comment stripping with its callers while it was a
 * one-line regex the callers disagreed about; they disagreed because a regex
 * forced each of them to pick a different lossy approximation, and the two
 * disagreements it names both dissolve here rather than being decided.
 * `turbo-cache-inputs.test.ts` stripped a `//` only after whitespace to protect a
 * protocol-relative `"//fonts.googleapis.com"`, and a scanner knows that one is
 * inside a string; the other two stripped a `//` only at a line start and so
 * kept every trailing comment, and a scanner does not have to choose.
 *
 * A COMMENT IS BLANKED RATHER THAN REMOVED, one space per character and newlines
 * kept. Two callers run line-anchored sweeps over the result -- `^[ \t]*import\b`
 * and `^[ \t]*export\b` -- and the regex collapsed a whole docblock to a single
 * space, so a multi-line comment BETWEEN two statements took the second one's
 * line anchor with it. Keeping the shape can only ever find more of them.
 *
 * WHAT IT DOES NOT READ, said here rather than left to be found: a REGEX LITERAL
 * is not tracked, so a `/*` inside one (`/https:\/*\//`) would still open a
 * comment. Telling a regex literal from division needs the parse this file
 * deliberately does not do, the previous four copies did not track one either,
 * and this tree contains none -- measured 2026-09-21 with
 * `git grep -nE '/[^/*\n]([^/\n]|\\/)*\\/\*'` over the same population, whose
 * only hit is this sentence's neighbour in a docblock.
 *
 * AND AN UNTERMINATED `/*` IS BLANKED TO THE END OF THE FILE, where the regex
 * left it standing for want of a closing delimiter. Either is arbitrary: a
 * source with an unterminated block comment does not compile, so no caller can
 * be reading one.
 */
export function withoutComments(source: string): string {
  let out = "";
  let at = 0;

  // The brace depth at which each enclosing template literal was suspended by a
  // `${`, so the `}` that resumes it is told apart from one merely closing a
  // block inside the expression.
  const suspended: number[] = [];
  let braces = 0;
  let inTemplate = false;

  /** A run of source kept only for its shape: one space per character, newlines as they were. */
  const blanked = (text: string): string => text.replace(/[^\n]/g, " ");

  while (at < source.length) {
    const here = source[at] as string;
    const pair = source.slice(at, at + 2);

    if (inTemplate) {
      if (here === "\\") {
        out += source.slice(at, at + 2);
        at += 2;
      } else if (here === "`") {
        out += here;
        at += 1;
        inTemplate = false;
      } else if (pair === "${") {
        out += pair;
        at += 2;
        suspended.push(braces);
        inTemplate = false;
      } else {
        out += here;
        at += 1;
      }
      continue;
    }

    if (pair === "/*") {
      const closed = source.indexOf("*/", at + 2);
      const stop = closed === -1 ? source.length : closed + 2;
      out += blanked(source.slice(at, stop));
      at = stop;
      continue;
    }

    if (pair === "//") {
      const newline = source.indexOf("\n", at);
      const stop = newline === -1 ? source.length : newline;
      out += blanked(source.slice(at, stop));
      at = stop;
      continue;
    }

    if (here === '"' || here === "'") {
      const closed = endOfQuoted(source, at, here);
      out += source.slice(at, closed);
      at = closed;
      continue;
    }

    if (here === "`") {
      out += here;
      at += 1;
      inTemplate = true;
      continue;
    }

    if (here === "{") braces += 1;
    if (here === "}") {
      if (suspended.length > 0 && braces === suspended[suspended.length - 1]) {
        suspended.pop();
        inTemplate = true;
      } else {
        braces -= 1;
      }
    }

    out += here;
    at += 1;
  }

  return out;
}

/**
 * One past the closing quote of the literal that opens at `from`.
 *
 * A NEWLINE ENDS IT, which is what stops an unbalanced quote in a comment-free
 * file from swallowing the rest of the source: `'` appears in this repository's
 * prose as an apostrophe, and a single quote with no partner is ordinary there.
 * An unterminated string is a syntax error in code, so the file a caller is
 * really reading never has one.
 */
function endOfQuoted(source: string, from: number, quote: string): number {
  let at = from + 1;
  while (at < source.length) {
    const here = source[at];
    if (here === "\\") {
      at += 2;
      continue;
    }
    if (here === quote) return at + 1;
    if (here === "\n") return at;
    at += 1;
  }
  return source.length;
}
