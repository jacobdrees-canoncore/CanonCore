import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./repo-root";
import { trackedFiles } from "./tracked-files";
import { commentsIn, withoutComments } from "./without-comments";

/**
 * THE ROWS BELOW ARE A MEASUREMENT OF A DEFECT, not a restatement of the scan.
 *
 * Four suites in this package each held
 * `source.replace(/\/\*[\s\S]*?\*\//g, " ")`, which cannot tell a string literal
 * from code: any `/*` opens a comment and swallows source to the next `*\/`.
 * Each row that names that is RED against the expression it replaces, and the
 * two it costs are the two `ui-callers.test.ts`'s own docblock is about --
 * swallowing an import turns a reached module into one reported dead, and
 * swallowing an `export` list means its names are never collected, so nothing
 * can report them dead at all.
 *
 * PROVED NON-HOLLOW AGAINST TWO MUTATIONS, which is
 * [[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]] applied
 * rather than cited. The rows about literals are red when the body is the old
 * regex; the rows about stripping are red when the body returns its argument
 * unchanged. A row can only pass on both if it names nothing, and none does.
 */
describe("source with its comments taken out", () => {
  /**
   * THE DEFECT IN THE SHAPE IT WAS FILED IN (CNCORE-300). `"**\/*"` is a glob
   * this tree really writes -- `apps/web/browser/gate.ts` passes it to
   * `context.route` -- and under the regex these three lines strip to
   * `const GLOB = "** `, the import gone entirely.
   */
  it("does not read a `/*` inside a string literal as opening a comment", () => {
    const source = [
      'const GLOB = "**/*";',
      'import { Card } from "@canoncore/ui/components/card";',
      "const done = 1; /* a real comment */",
    ].join("\n");

    expect(withoutComments(source)).toContain("@canoncore/ui/components/card");
  });

  /**
   * THE HALF THAT WAS LIVE IN THIS TREE, and the silent one. The block pass ran
   * before the line pass, so a `/*` written inside a `//` comment opened a
   * comment too. `testing/workspace.ts` lost `isWorkspacePattern`'s whole
   * declaration this way -- measured 2026-09-21 as the only export the regex
   * dropped across 178 tracked non-test sources.
   */
  it("does not read a `/*` inside a line comment as opening one", () => {
    const source = [
      "// Only the `<name>/*` shape this repo uses.",
      "export function isWorkspacePattern(pattern: string): boolean {",
      "  return true;",
      "}",
      "",
      "/** The next docblock, whose end the line comment above reached. */",
    ].join("\n");

    expect(withoutComments(source)).toContain("export function isWorkspacePattern");
  });

  /**
   * THE CASE `turbo-cache-inputs.test.ts` CHOSE ITS `//` RULE FOR, now held by
   * the scan rather than by a rule. That suite stripped a `//` only after
   * whitespace because a protocol-relative `"//fonts.googleapis.com"` has a
   * quote before it, and the version without that guard read the rest of the
   * line as a comment and ate a real climb sitting after it.
   *
   * THE WHITESPACE IS WHAT MAKES THIS ROW MEAN ANYTHING. With the `//` written
   * hard against the quote, that rule is saved by the quote and the row passes
   * on the very expression it is meant to disagree with -- measured, and it is
   * how this row read first. A space before the `//` makes it red on the
   * whitespace rule. It stays GREEN on the line-start rule, which strips nothing
   * mid-line and so never had this failure: this row is the one that disagrees
   * with the rule `turbo-cache-inputs.test.ts` chose, not with all of them.
   */
  it("does not read a `//` inside a string literal as opening a comment", () => {
    const source = 'const doc = "see //fonts.googleapis.com"; const climb = "../../../root";';

    expect(withoutComments(source)).toContain("../../../root");
  });

  /**
   * AN ESCAPED QUOTE DOES NOT END THE STRING, which is the rung that keeps the
   * scan from being a worse regex. Without it the literal closes early, what
   * follows is read as code, and the `/*` in it opens a comment that runs to the
   * end of the next docblock -- the original defect, reached by a different door.
   */
  it("does not end a string literal at an escaped quote", () => {
    const source = [
      'const quoted = "a \\" then /* opens";',
      'import { Card } from "@canoncore/ui/components/card";',
      "/** A docblock whose end the literal above reached. */",
    ].join("\n");

    expect(withoutComments(source)).toContain("@canoncore/ui/components/card");
  });

  /**
   * A TEMPLATE IS TEXT, AND STAYS TEXT ACROSS AN INTERPOLATION. `apps/web`
   * builds base URLs as `` `http://${host}:${port}` ``, so the `//` case above
   * arrives here too; the interpolation matters because the expression inside
   * it is code, and a scan that lost its place at `${` would resume reading the
   * rest of the template as code.
   */
  it("reads a template literal as text, across an interpolation", () => {
    const source = [
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the subject of the row
      "const url = `http://${host}:${port}/*`;",
      'import { Card } from "@canoncore/ui/components/card";',
      "const done = 1; /* a real comment */",
    ].join("\n");

    const code = withoutComments(source);

    // biome-ignore lint/suspicious/noTemplateCurlyInString: the text left alone, quoted
    expect(code).toContain("http://${host}");
    expect(code).toContain("@canoncore/ui/components/card");
  });

  /**
   * A BACKTICK INSIDE A REGEX LITERAL DOES NOT OPEN A TEMPLATE, which is the
   * defect the first version of this scan shipped.
   *
   * IT IS THE WORST SHAPE THE DEFECT HAS, because it fails SILENTLY and
   * WHOLESALE: not one swallowed statement but a file that stops being stripped
   * from that point down. `ui-callers.test.ts` writes a character class holding
   * THREE backticks, an odd number, so the scan entered a template at the first
   * and never left.
   */
  it("does not read a backtick inside a regex literal as opening a template", () => {
    const source = [
      "const backtick = /`/;",
      "/** A docblock below it, which must still come out. */",
      "const after = 1;",
    ].join("\n");

    const code = withoutComments(source);

    expect(code).not.toContain("must still come out");
    expect(code).toContain("const after = 1;");
  });

  /**
   * AND THE WHOLE TREE IS THE ROW THAT WOULD HAVE CAUGHT IT.
   *
   * Every row above is a shape somebody thought of. This one is a sweep, and it
   * is here because the shape above was NOT thought of: five tracked files
   * stopped being stripped and every hand-written row stayed green.
   * `turbo-cache-inputs.test.ts` reads `packages/*.ts` with no test-file filter,
   * so it read them unstripped and passed anyway -- none of the surviving prose
   * happened to hold a `"../`.
   *
   * A SURVIVING `/**` IS THE TELL, because it can only mean the scan stopped
   * stripping somewhere above it.
   */
  it("leaves no docblock standing in any tracked source", () => {
    const tracked = trackedFiles(["packages/*.ts", "packages/*.tsx", "apps/*.ts", "apps/*.tsx"]);
    expect(tracked.length).toBeGreaterThan(100);

    const leaky = tracked
      .map((path) => {
        const code = withoutComments(readFileSync(join(repoRoot, path), "utf8"));
        return [path, [...code.matchAll(/^[ \t]*\/\*\*/gm)].length] as const;
      })
      .filter(([, standing]) => standing > 0)
      .map(([path, standing]) => `${path}: ${standing}`);

    expect(leaky).toStrictEqual([]);
  });

  /**
   * AND IT STILL DOES THE JOB IT EXISTS FOR. Each of the four callers counts a
   * token its own prose says out loud, so a stripper that stopped stripping
   * would redden every one of them on the paragraph explaining the rule.
   */
  it("takes out a block comment and a line comment alike", () => {
    const source = [
      "/* a docblock saying redirect( */",
      "const a = 1; // and a note saying <Link",
    ].join("\n");

    const code = withoutComments(source);

    expect(code).not.toContain("redirect(");
    expect(code).not.toContain("<Link");
    expect(code).toContain("const a = 1;");
  });

  /**
   * A COMMENT IS BLANKED RATHER THAN REMOVED, so the lines either side of it
   * keep their anchors. Two callers sweep with `^[ \t]*import\b` and
   * `^[ \t]*export\b`; the regex collapsed a whole comment to ONE space, which
   * joined the line before it to the line after and took the second statement's
   * anchor with it.
   */
  it("keeps the line a statement sits on when a multi-line comment precedes it", () => {
    const source = "export const a = 1; /* one\n   two */ export const b = 2;";

    expect(/^[ \t]*export const b/m.test(withoutComments(source))).toBe(true);
  });
});

describe("the comments in a source", () => {
  /**
   * A `/` IS A REGEX OR A DIVISION BY THE TOKEN BEFORE IT, and each row below is one shape of that
   * token. Every source is invented, and this block is the same in all three suites that hold the
   * scan.
   *
   * THIS TABLE IS THE DIRECTION THAT DELETES. A regex read as division is read as code, so the
   * `/*` inside it opens a comment that runs to the next `*\/`, and `/** a *\/` goes with it. The
   * first row is the shape CNCORE-324 was filed in. Every row but `return` and the operator was
   * red before that ticket, and those two are the shapes that already held. The `if` head calls
   * a function, so the scan has to know which `(` its `)` closes and not only the last one opened.
   */
  it.each([
    ["after `=>`", "const hasStar = (s: string) => /a\\/*/.test(s);"],
    ["after the `)` of an `if` head", "if (ready(s)) /a\\/*/.test(s);"],
    ["after `default`", "export default /a\\/*/;"],
    ["after `extends`", "class Pattern extends /a\\/*/.constructor {}"],
    ["after `...`", "const parts = [.../a\\/*/.exec(s)];"],
    ["after `return`", "return /a\\/*/.test(s);"],
    ["after an operator", 'const starred = s === "" || /a\\/*/.test(s);'],
  ])("do not open inside a regex literal %s", (_, line) => {
    const source = [line, "/** a */", "/** b */", "export const b = 1;"].join("\n");

    expect(texts(source)).toStrictEqual(["/** a */", "/** b */"]);
  });

  /**
   * AND THIS ONE IS THE DIRECTION THAT DOES NOT. A division read as a regex runs to the next `/`
   * on its line, so the comment after it is read as code and survives, and a regex cannot span a
   * line, so the loss stops there. Each row is red if its token joins the table above: an
   * expression's `)` is why only a head's `)` does, and `</td>` is why `<` never does.
   */
  it.each([
    ["an identifier", "const half = total / 2; /* a comment */ const third = total / 3;"],
    ["an expression's `)`", "const half = (a + b) / 2; /* a comment */ const third = (a + b) / 3;"],
    ["`]`", "const half = sizes[0] / 2; /* a comment */ const third = sizes[0] / 3;"],
    [
      "the `<` of a closing JSX tag",
      "const cell = <td>{n}</td>; /* a comment */ const row = <tr></tr>;",
    ],
  ])("open after a division that follows %s", (_, line) => {
    expect(texts(line)).toStrictEqual(["/* a comment */"]);
  });
});

function texts(source: string): string[] {
  return commentsIn(source).map((comment) => comment.text);
}
