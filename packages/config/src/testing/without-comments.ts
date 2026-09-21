/**
 * A source with its comments taken out, SCANNED rather than matched, so a `/*` inside a string is
 * text and not the start of a comment.
 *
 * THIS FILE IS BYTE-IDENTICAL IN THREE REPOSITORIES, AND NOTHING ENFORCES THAT. CanonCore holds it
 * at `packages/config/src/testing/without-comments.ts`, and `provider-wiki` and `provider-tmdb`
 * each at `test/setup/without-comments.ts`, because CanonCore's [[0031-a-provider-is-a-url]] lets
 * no code cross the boundary between a provider and the app. A change to one is a change to carry
 * to the other two by hand, and a diff says whether it was. THE PROSE IS COPIED WITH THE CODE
 * (CNCORE-324), so each file named below says which repository holds it, and a sentence corrected
 * in one copy is corrected in all three. Every record cited is in CanonCore's `docs/adr/`.
 *
 * A SUITE THAT READS SOURCE AS TEXT has to do this first, because a comment is prose ABOUT code
 * and a suite counting a token would count its own prose saying it out loud. In CanonCore,
 * `prefetch-condition.test.ts` explains its rule using the word `prefetch`, `tree-figures.ts`
 * quotes `redirect()` in the paragraph above the call it counts, and `turbo-cache-inputs.test.ts`
 * writes `../../../` into a note about climbs. Without this each would argue with whoever
 * documents it. In all three repositories, `stacked-docblocks.test.ts` asks where each comment
 * opens, which is what `commentsIn` answers.
 *
 * IT IS A SCAN BECAUSE A REGULAR EXPRESSION CANNOT DO IT.
 * [[0177-a-stripper-that-must-read-code-is-a-scan-not-a-pattern]] carries the decision, the
 * measurement of what the pattern lost, and the TypeScript scanner that was tried first.
 * `source.replace(/\/\*[\s\S]*?\*\//g, " ")` does not know a string literal from code, so ANY `/*`
 * opens a comment and swallows source to the next `*\/`. This module is one of those `/*`s: the
 * `pair === "/*"` below is in a string. So is the glob `"**\/*"` that CanonCore's
 * `apps/web/browser/gate.ts` passes to `context.route`, and so is a `/*` written inside a `//`
 * comment, which a pattern stripping block comments first reaches first. The four patterns this
 * replaced in CanonCore were four copies of that defect (CNCORE-300), and one had already
 * swallowed an exported declaration whole.
 *
 * A COMMENT IS BLANKED RATHER THAN REMOVED, one space per character and newlines kept, so every
 * line keeps its anchor. Suites sweep the result line by line -- CanonCore's callers for
 * `^[ \t]*import\b` and `^[ \t]*export\b`, and each repository's `without-comments.test.ts` for a
 * `/**` at a line's start -- and a multi-line comment removed rather than blanked joins the line
 * before it to the line after, taking the second line's anchor with it.
 *
 * A REGEX LITERAL IS TRACKED, and CanonCore's first version of this did not track one. A BACKTICK
 * inside a regex opens a template to a scan that does not, and CanonCore's `ui-callers.test.ts`
 * writes `["'`]([^"'`\n]+)["'`]` -- THREE backticks, an odd number -- so that scan entered a
 * template at the first and never left, and every comment below it survived. Five tracked files
 * did this, and every hand-written row stayed green.
 *
 * A `/` OPENS A REGEX ONLY WHERE A VALUE CAN START, which is as far as a scan can resolve that
 * ambiguity without parsing, and the code before it decides, read back past whitespace and
 * blanked comments. After a punctuator ending in `(`, `,`, `=`, `:`, `[`, `!`, `&`, `|`, `?`,
 * `{`, `}`, `;`, `+`, `-`, `*`, `%`, `^`, `~` or `>`, which takes in `=>`, or after a spread's
 * `...`, a `/` opens a regex. So it does after a keyword a value can follow, like `return` or
 * `default`, though not after a property of that name, and after a `)` that closes the head of an
 * `if`, `while`, `for` or `with`. After anything else -- an identifier, a number, `]`, a quote,
 * any other `)`, and `<` in `</div>` -- it divides.
 *
 * A WRONG GUESS IN EITHER DIRECTION CAN DELETE CODE, and the rule above is what keeps them rare. A
 * regex read as division is read as code, so a `/*` inside it opens a comment that runs to the
 * next `*\/`. A regex after `=>` did that until CNCORE-324, and four shapes still would: a regex
 * after `<`, which is left out for `</div>`; after the head of a `for await`, whose `(` follows
 * `await`; as the divisor in `a / /re/`; and opening the line after a statement left without its
 * semicolon, which Biome, the formatter all three repositories run, never leaves. Division read
 * as a regex -- after `i++`, a non-null `x!`, or a variable named `of`, for instance -- is usually
 * harmless, because the run it starts cannot cross a line and is abandoned there. But where a
 * second `/` follows on that line inside a string or template, the run ends inside the literal,
 * the rest of it is read as code, and a `/*` there opens a comment too. Measured 2026-09-21
 * against oxc's parser over every tracked source in the three repositories, 399 files, the scan
 * finds exactly the comments the parser does, each at the same offset.
 *
 * AND IT REFUSES RATHER THAN ANSWERING WHEN IT LOSES ITS PLACE. A source that ends inside a
 * template literal means the scan took a backtick for an opener that was not one, and every
 * comment after it has been kept. Returning that quietly is how the defect above went unnoticed,
 * so it throws instead. Valid TypeScript always closes its templates, so this fires on a scan that
 * is wrong rather than on a file that is.
 *
 * AND AN UNTERMINATED `/*` IS BLANKED TO THE END OF THE FILE. A source with an unterminated block
 * comment does not compile, so no caller can be reading one.
 */
export function withoutComments(source: string): string {
  return scan(source).code;
}

/** Every comment in a source, where it opens and what it says, from the same scan. */
export function commentsIn(source: string): Comment[] {
  return scan(source).comments;
}

export type Comment = { readonly at: number; readonly text: string };

function scan(source: string): { code: string; comments: Comment[] } {
  let out = "";
  const comments: Comment[] = [];
  let at = 0;

  // The brace depth at which each enclosing template literal was suspended by a
  // `${`, so the `}` that resumes it is told apart from one merely closing a
  // block inside the expression.
  const suspended: number[] = [];
  let braces = 0;
  let inTemplate = false;

  // Whether each open `(` began the head of an `if`, `while`, `for` or `with`, and whether the
  // last `)` closed one. It is the one thing about the code before a `/` that `out` cannot say.
  const heads: boolean[] = [];
  let closedAHead = false;

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
      comments.push({ at, text: source.slice(at, stop) });
      out += blanked(source.slice(at, stop));
      at = stop;
      continue;
    }

    if (pair === "//") {
      const newline = source.indexOf("\n", at);
      const stop = newline === -1 ? source.length : newline;
      comments.push({ at, text: source.slice(at, stop) });
      out += blanked(source.slice(at, stop));
      at = stop;
      continue;
    }

    if (here === "/" && regexCanStartAfter(out, closedAHead)) {
      const closed = endOfRegex(source, at);
      if (closed !== undefined) {
        out += source.slice(at, closed);
        at = closed;
        continue;
      }
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
    if (here === "(") heads.push(HEADS.has(keywordEnding(out)));
    if (here === ")") closedAHead = heads.pop() === true;

    out += here;
    at += 1;
  }

  if (inTemplate) {
    throw new Error(
      "the comment scan ended inside a template literal, so it took a backtick for an opener " +
        "it was not and has left every comment after it standing",
    );
  }

  return { code: out, comments };
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
  "default",
  "extends",
  "do",
  "else",
  "yield",
  "await",
  "throw",
]);

/** The keywords whose parenthesised head a statement follows, which may open with a regex. */
const HEADS = new Set(["if", "while", "for", "with"]);

/**
 * Whether a `/` after `code` can open a regex literal rather than divide, read from the last thing
 * in `code` that is not whitespace. A blanked comment is whitespace, so it is read past.
 *
 * `<` IS LEFT OUT ALTHOUGH A VALUE CAN FOLLOW IT, because the `/` of a closing JSX tag like
 * `</div>` follows it too. Read as a regex, that `/` would run to the next one on its line and
 * take whatever lay between, a `{/* comment *\/}` among it, for the regex's body.
 */
function regexCanStartAfter(code: string, closedAHead: boolean): boolean {
  const end = endOfCode(code);
  const last = code[end - 1];
  if (last === undefined) return true;
  if (last === ")") return closedAHead;
  if (last === ".") return code.slice(end - 3, end) === "...";
  if (/[A-Za-z0-9_$]/.test(last)) return BEFORE_A_REGEX.has(keywordEnding(code));
  return "(,=:[!&|?{};+-*%^~>".includes(last);
}

/**
 * The word `code` ends in, past any whitespace, or `""` if it ends in something else.
 *
 * A WORD AFTER A `.` IS A PROPERTY AND NOT A KEYWORD, so `mod.default` and `Symbol.for(key)` end
 * in `""`: the `/` after either divides.
 */
function keywordEnding(code: string): string {
  const end = endOfCode(code);
  let start = end;
  while (start > 0 && /[A-Za-z0-9_$]/.test(code[start - 1] as string)) start -= 1;
  return code[endOfCode(code, start) - 1] === "." ? "" : code.slice(start, end);
}

/** One past the last character of `code` before `from` that is not whitespace, or 0. */
function endOfCode(code: string, from = code.length): number {
  let end = from;
  while (end > 0 && /\s/.test(code[end - 1] as string)) end -= 1;
  return end;
}

/**
 * One past the end of the regex literal opening at `from`, or `undefined` if what
 * is there is not one.
 *
 * A NEWLINE ENDS THE ATTEMPT rather than the literal, because a regex literal
 * cannot span a line. That is what bounds a wrong guess that finds no second `/`
 * to the line it was made on: the caller copies the `/` and carries on.
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
 * rest of the source: an apostrophe is ordinary in prose, and CanonCore's JSX text
 * is read here as code, so `don't` opens a literal that must close at the line end.
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
