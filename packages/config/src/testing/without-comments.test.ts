import { describe, expect, it } from "vitest";
import { withoutComments } from "./without-comments";

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
      "/** The next docblock, whose `*/` the line comment above reached. */",
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
   * how this row read first. A space before the `//` is the same string and is
   * red on both rules this replaces.
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
      "const url = `http://${host}:${port}/*`;",
      'import { Card } from "@canoncore/ui/components/card";',
      "const done = 1; /* a real comment */",
    ].join("\n");

    const code = withoutComments(source);

    expect(code).toContain("http://${host}");
    expect(code).toContain("@canoncore/ui/components/card");
  });

  /**
   * AND IT STILL DOES THE JOB IT EXISTS FOR. Each of the four callers counts a
   * token its own prose says out loud, so a stripper that stopped stripping
   * would redden every one of them on the paragraph explaining the rule.
   */
  it("takes out a block comment and a line comment alike", () => {
    const source = ["/* a docblock saying redirect( */", "const a = 1; // and a note saying <Link"].join(
      "\n",
    );

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
