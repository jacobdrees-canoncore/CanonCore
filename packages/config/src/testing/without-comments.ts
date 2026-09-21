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
 * [[0177-a-stripper-that-must-read-code-is-a-scan-not-a-pattern]] carries the
 * decision, the measurement, and the TypeScript scanner that was tried first.
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
 * A REGEX LITERAL IS TRACKED, and the first version of this did not track one.
 * That is not the boundary it reads like: `ui-callers.test.ts` writes
 * `["'`]([^"'`\n]+)["'`]` -- THREE backticks, an odd number -- so the scan
 * entered a template literal at the first and never left, and every comment
 * below it survived. Five tracked files did this, and
 * `turbo-cache-inputs.test.ts` sweeps `packages/*.ts` with NO test-file filter,
 * so it really did read them unstripped. It stayed green only because none of
 * the surviving prose happened to hold a `"../` -- a silent under-strip, which
 * is the same class of failure as the one this module exists to fix.
 *
 * A `/` OPENS ONE ONLY WHERE A VALUE CAN START, which is the safe half of the
 * ambiguity JavaScript cannot resolve without parsing. The preceding token
 * decides: after `(`, `,`, `=`, `:`, `[`, `!`, `&`, `|`, `?`, `{`, `}`, `;`, an
 * operator, or a keyword like `return`, a `/` begins a regex; after anything
 * else -- an identifier, `)`, `]`, a quote, and notably `<` in `</div>` -- it is
 * division and is copied as one character. GUESSING WRONG COSTS AT MOST ONE
 * LINE: a regex literal cannot span one, so a run that reaches a newline without
 * closing is abandoned and the `/` is copied. The scan never DELETES on a wrong
 * guess, it only declines to strip.
 *
 * AND IT REFUSES RATHER THAN ANSWERING WHEN IT LOSES ITS PLACE. A source that
 * ends inside a template literal means the scan took a backtick for an opener
 * that was not one, and every comment after it has been kept. Returning that
 * quietly is how the defect above went unnoticed, so it throws instead. Valid
 * TypeScript always closes its templates, so this fires on a scan that is wrong
 * rather than on a file that is.
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

  // The last token that could decide whether a `/` divides or opens a regex.
  let significant = "";
  let word = "";
  let previousWord = "";

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
        significant = "`";
      } else if (pair === "${") {
        out += pair;
        at += 2;
        suspended.push(braces);
        inTemplate = false;
        significant = "{";
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

    if (here === "/" && regexCanStartAfter(significant, word.length > 0 ? word : previousWord)) {
      const closed = endOfRegex(source, at);
      if (closed !== undefined) {
        out += source.slice(at, closed);
        at = closed;
        significant = "/";
        word = "";
        previousWord = "";
        continue;
      }
    }

    if (here === '"' || here === "'") {
      const closed = endOfQuoted(source, at, here);
      out += source.slice(at, closed);
      at = closed;
      significant = here;
      if (word.length > 0) {
        previousWord = word;
        word = "";
      }
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
    if (!/\s/.test(here)) significant = here;
    if (/[A-Za-z0-9_$]/.test(here)) {
      word += here;
    } else if (word.length > 0) {
      previousWord = word;
      word = "";
    }
  }

  if (inTemplate) {
    throw new Error(
      "the comment scan ended inside a template literal, so it took a backtick for an opener " +
        "it was not and has left every comment after it standing",
    );
  }

  return out;
}

/** The keywords a `/` may follow and still open a regex rather than divide. */
const BEFORE_A_REGEX = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "case",
  "do",
  "else",
  "yield",
  "await",
  "throw",
]);

/**
 * Whether a `/` here can open a regex literal rather than divide.
 *
 * IT ANSWERS FROM THE SAFE SIDE. The listed positions are the ones where a VALUE
 * can start, so everything not listed -- an identifier, `)`, `]`, a quote, and
 * `<` in a closing JSX tag -- is division and the `/` is copied unchanged. The
 * opposite default would take the `/` in `</div>` for a regex opener.
 */
function regexCanStartAfter(significant: string, precedingWord: string): boolean {
  if (significant === "") return true;
  if (BEFORE_A_REGEX.has(precedingWord) && /[A-Za-z0-9_$]/.test(significant)) return true;
  return "(,=:[!&|?{};+-*%^~".includes(significant);
}

/**
 * One past the end of the regex literal opening at `from`, or `undefined` if what
 * is there is not one.
 *
 * A NEWLINE ENDS THE ATTEMPT rather than the literal, because a regex literal
 * cannot span a line. That is what bounds a wrong guess to the line it was made
 * on: the caller copies the `/` and carries on.
 *
 * A `/` INSIDE A CHARACTER CLASS IS NOT THE CLOSER, which is the whole reason
 * this is a scan and not `indexOf`.
 */
function endOfRegex(source: string, from: number): number | undefined {
  let at = from + 1;
  let inClass = false;
  while (at < source.length) {
    const here = source[at];
    if (here === "\n") return undefined;
    if (here === "\\") {
      at += 2;
      continue;
    }
    if (here === "[") inClass = true;
    else if (here === "]") inClass = false;
    else if (here === "/" && !inClass) {
      at += 1;
      while (at < source.length && /[a-z]/.test(source[at] as string)) at += 1;
      return at;
    }
    at += 1;
  }
  return undefined;
}

/**
 * One past the closing quote of the literal that opens at `from`.
 *
 * A NEWLINE ENDS IT, which is what stops an unbalanced quote from swallowing the
 * rest of the source: an apostrophe is ordinary in prose, and JSX text is read
 * here as code, so `don't` opens a literal that must close at the line end.
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
