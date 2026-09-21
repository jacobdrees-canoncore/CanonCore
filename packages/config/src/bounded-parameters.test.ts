import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createScanner, LanguageVariant, SyntaxKind } from "typescript/unstable/ast";
import { describe, expect, it } from "vitest";

import { repoRoot } from "./testing/repo-root";
import { trackedFiles } from "./testing/tracked-files";

/**
 * A SURFACE DOES NOT PRINT A VALUE IT DID NOT WRITE INSIDE ONE OF ITS OWN
 * SENTENCES WITHOUT BOUNDING IT FIRST (ADR-0123, ADR-0163, ADR-0170, ADR-0178).
 *
 * WHY A CHECK AND NOT CARE. Seven sites in this tree owe that bound. The sixth
 * and the seventh were `?q=` at `/search` and `/import`, and BOTH WERE FOUND BY
 * A PERSON READING A DIFF: `/search` by inspection while CNCORE-256 was deciding
 * something else, `/import` by the code review ON CNCORE-291 -- in the same
 * sentence where that ticket asserted the set was now complete. ADR-0163 had
 * made the identical claim one record earlier and was wrong the same way. Two
 * for two is not a run of bad luck, it is the absence of an instrument: a count
 * of `boundedTo`'s callers is a count of the sites that ANSWER the rule and
 * never of the sites that OWE it.
 *
 * THE POPULATION IS DERIVED FROM THE TREE, which is ADR-0153's preference and
 * the difference between a check and a note. Nothing here lists the surfaces,
 * the parameters, or even the calls that count as bounding: it reads every
 * `.tsx` under `apps/web/src`, finds what each one takes off its own address,
 * and follows it. A list would pass forever by being edited whenever it failed,
 * and the seventh site is precisely the one a list could not have named.
 *
 * ## The rule
 *
 * A value read from `searchParams` may not reach a JSX CHILD position -- the
 * page's own voice -- unless it has been through a bounding call. Where one
 * does, the FILE and the PARAMETER are named, as `ui-callers.test.ts` names its
 * module rather than failing with a count.
 *
 * ## Where the boundary is, and why it is there rather than anywhere else
 *
 * ADR-0170 settles this in as many words: it "turns on where a value LANDS", and
 * a form field is not a sentence. So these landings are outside the rule, and
 * each is a decision some record already took rather than a hole cut to make
 * this file pass. Every one of them is DRIVEN by a row below, because an
 * exemption nothing executes is an exemption nobody can check:
 *
 * - AN ATTRIBUTE. `defaultValue={placing ?? ""}` on the placement picker's box
 *   and `value={search.q}` in `/import`'s hidden replay field hand the Owner
 *   their own words back inside a form control. ADR-0165 excuses the first and
 *   ADR-0170 the second, both for one reason: a replay built from the bounded
 *   value would resubmit a search for the opening of the query plus a cut
 *   marker.
 * - A GATE. `{refused && <p>...</p>}` on `/items/<id>` reads a parameter as a
 *   BARE BOOLEAN, and every sentence it gates is the page's own. A crafted
 *   `?refused=` of any length changes whether that paragraph appears and nothing
 *   about what it says, which CNCORE-281 measured rather than argued.
 * - A MEMBER OF A SET THIS TREE OWNS. `WHAT_WAS_REFUSED[because]` and
 *   `kinds.find(({ value }) => value === chosen.kind)?.label` are keyed ON the
 *   reader's word and answer WITH one of ours. `?kind=` reaches the front page's
 *   heading only as an `item_kinds` label, which is the closed-set answer
 *   CNCORE-281 took.
 * - A ROUND TRIP. A value handed to an awaited read, or to a call given data that
 *   read answered, comes back as the catalogue's: the Group's name in "Nothing
 *   matched X in Y" is a Group the Owner named, and ADR-0170 keeps it unbounded
 *   on purpose. PROVENANCE, not arity -- see `sealedSpans` for what asking the
 *   arity instead let through.
 * - AN ITERATION. `{Object.entries(carried).map(...)}` renders the callback's
 *   JSX, and every sentence in that is judged where it stands, in its own nested
 *   interpolation and its own scope. ONLY iteration: this bullet used to say ANY
 *   argument, which is what the code did, and `{shortenTo(query)}` walked through
 *   it (see `isIterated`).
 *
 * ## What it does NOT answer, said here rather than left to be found
 *
 * - A VALUE LAUNDERED THROUGH ANOTHER MODULE. The walk is within one file, so a
 *   parameter handed to a component in a DIFFERENT module and printed there is
 *   invisible to this. `{...surface}` is that case today: `surface.asked.q`
 *   reaches `Walk` and `PastTheEnd` in `listing.tsx`, which write it into links
 *   rather than sentences. This is the limit the ticket named when it was filed,
 *   and it is why the cross-file case is worth a second instrument rather than a
 *   looser one here.
 * - A ROUND TRIP THAT REALLY DOES CARRY THE BYTES. The rule above treats an
 *   `await`, and a call given more than one argument, as answering with this
 *   tree's own data, because in this tree every one of them does. A page that
 *   sent `?q=` to a procedure and printed the procedure's echo of it would pass,
 *   and that is a FALSE PASS rather than a false failure -- the direction that
 *   matters. It is tolerable only because the seam below bounds its own refusals
 *   (ADR-0163's five sites), and it is the first thing to revisit if one stops.
 * - WHOSE WORDS THEY ARE ONCE THEY FIT. A bound is not a truth test: a crafted
 *   query of eighty characters is still quoted whole, which ADR-0170 records as
 *   accepted residue rather than as a gap left open.
 * - ANYTHING BUT `apps/web`. FOUR of ADR-0163's five sites are in packages that
 *   render nothing -- `@canoncore/providers`, `@canoncore/db`, `@canoncore/api`
 *   and `@canoncore/tasks` -- so JSX cannot be the instrument for them. The
 *   FIFTH is `?refused=` on `/settings`, which IS in this population and IS
 *   driven by a row below. An earlier draft of this sentence said five were
 *   outside, which both miscounted the list and quietly moved `/settings` into a
 *   package: exactly the error this file exists to end, made about the record it
 *   cites. Corrected here rather than beside itself.
 * - THE TOKENISER IS THE COMPILER'S, FROM AN `unstable/` SUBPATH.
 *   `typescript/unstable/ast` is where TypeScript 7 publishes its scanner, and
 *   the name says what it promises. It is taken rather than a regular expression
 *   because the prose above every bounded site in this tree ARGUES for the bound,
 *   naming the parameters more often than the code does -- so a reader counting
 *   raw bytes finds the argument for the rule and reports it as the rule being
 *   kept. TypeScript is pinned through the catalogue, so this moves when that
 *   does, and a member this file names that a later version drops reads as
 *   `undefined` rather than throwing: the rows below are what turn that into a
 *   red instead of a silent pass.
 */

/** Where the surfaces this rules on live. */
const WEB_SOURCE = join("apps", "web", "src");

/**
 * ADR-0123'S TWO LEVERS, BY THE NAMES `@canoncore/text` PUBLISHES THEM: the
 * STRIP, answering what a stranger's text may DO to the words around it, and the
 * CUT, answering how MUCH of it lands.
 *
 * A BOUNDING CALL IS ONE THAT APPLIES BOTH, AND THAT IS DERIVED RATHER THAN
 * NAMED. Nothing here says `boundedTo`, and the first version of this file did.
 * CNCORE-285 then put `quotedTo` between that function and both wrappers, hours
 * after this landed, and the check went red on three bounded surfaces -- because
 * `@canoncore/text` was not in the swept population, so the chain's middle link
 * was invisible. The population fix is what answered that. Seeding the RULE
 * instead of the name is a SECOND fix for the next such event: the name
 * `boundedTo` would serve today and would stop serving the day it is itself
 * renamed, one hop along from what had just happened.
 *
 * WHICH ALSO MAKES THE `shortenTo` EXCLUSION A CONSEQUENCE RATHER THAN AN
 * ASSERTION. That function is published beside the pair for `shortly`, whose
 * values are parsed URLs rather than prose, and ADR-0163 calls taking the cut
 * alone "the half-mechanism that record keeps finding". It reaches ONE lever, so
 * it is not a bound here, and no line had to say so.
 */
const THE_LEVERS = ["oneLine", "shortenTo"];

/**
 * The calls whose answer is drawn from the RECEIVER rather than from the needle.
 * `kinds.find(...)` answers with one of the catalogue's kinds; the reader's word
 * only chose which.
 */
const LOOKUPS = ["find", "includes"];

/**
 * The calls whose output is rendered ELSEWHERE, in a callback's own JSX and its
 * own scope, so a value named in one is not a value this interpolation speaks.
 */
const ITERATORS = ["map", "flatMap"];

/**
 * What a value is compared with, whose answer is a boolean and never the value.
 *
 * STRICT ONLY, because the loose pair cannot occur here: Biome runs the
 * `recommended` preset, whose `noDoubleEquals` refuses `==`, and
 * `biome-config.test.ts` proves that by feeding the linter `a == b` and
 * requiring a complaint. Carrying the other two would be two entries nothing can
 * reach.
 */
const COMPARISONS = [SyntaxKind.EqualsEqualsEqualsToken, SyntaxKind.ExclamationEqualsEqualsToken];

/**
 * What makes the value BEFORE it a condition rather than the thing rendered.
 *
 * `&&` AND `?` GATE; `||` AND `??` DO NOT, which is a distinction rather than an
 * oversight. `{x && <p>ours</p>}` renders the JSX and tests `x`, so `x` is a
 * condition. `{x || "none"}` and `{x ?? "none"}` render X ITSELF whenever it has
 * anything in it, so the value is spoken and a fallback behind it changes
 * nothing about that. Treating `||` as a gate made `{query || "none"}` silent,
 * measured here.
 */
const GATES = [SyntaxKind.AmpersandAmpersandToken, SyntaxKind.QuestionToken, ...COMPARISONS];

/**
 * Where the levers themselves live, which has to be in the population or the
 * rule above has nothing to recognise.
 */
const TEXT_SOURCE = join("packages", "text", "src");

/**
 * The modules under `roots` that git TRACKS, keyed by repository-relative path.
 *
 * GIT RATHER THAN A DIRECTORY WALK, which is `tracked-files.ts`'s own reason and
 * ADR-0171's seam: build output and `node_modules` are not tracked and so cannot
 * produce a false failure here.
 */
function modulesUnder(roots: string[], extension: RegExp): Map<string, string> {
  const modules = new Map<string, string>();
  for (const path of trackedFiles(roots).sort()) {
    if (!extension.test(path)) continue;
    modules.set(path, readFileSync(join(repoRoot, path), "utf8"));
  }
  if (modules.size === 0) throw new Error(`no module matching ${extension} under ${roots}`);
  return modules;
}

/** The surfaces this rules on: everything that can render a sentence. */
function theSurfaces(): Map<string, string> {
  return modulesUnder([WEB_SOURCE], /\.tsx$/);
}

/**
 * Every module a bound can be DEFINED in, which is wider than the surfaces in
 * two directions. `theQueryQuoted` lives in `query-params.ts` and
 * `theEntryRefused` in `settings/refusal.ts`, neither of which renders anything;
 * and the levers they end at are in `@canoncore/text`, another package
 * altogether. Leaving that package out is what made the check red on three
 * bounded surfaces when CNCORE-285 put `quotedTo` between the wrappers and
 * `boundedTo`.
 */
function theModules(): Map<string, string> {
  return modulesUnder([WEB_SOURCE, TEXT_SOURCE], /\.tsx?$/);
}

/** Where a token sits, which is the whole of what this check turns on. */
type Where = "code" | "attribute" | "child";

interface Token {
  kind: SyntaxKind;
  text: string;
  /** The kind of the innermost interpolation this token stands in. */
  where: Where;
  /** Which interpolation that is, so one can be read apart from its neighbours. */
  interpolation: number;
  /** Whether it stands inside `<Tag ...>` itself, where an attribute's name is. */
  inTag: boolean;
}

/**
 * The tokens of a module, each carrying whether it stands in a JSX ATTRIBUTE or
 * among an element's CHILDREN.
 *
 * A SMALL JSX-AWARE WALK OVER THE COMPILER'S SCANNER, because the scanner
 * answers what a token IS and this file's whole question is WHERE it stands. It
 * tracks a stack saying whether we are inside a tag, among children or in
 * ordinary code, and the frames -- interpolations and template substitutions --
 * standing open around the current token.
 *
 * CHILDREN ARE READ WITH `scanJsxToken`, WHICH IS NOT A REFINEMENT BUT WHAT MAKES
 * THIS TERMINATE. Ordinary `scan()` cannot read JSX TEXT: it reads the text as
 * though it were code, and `listing.tsx` prints an ordinal as `#1234`
 * (CNCORE-184). A bare `#` that begins no private identifier comes back as a
 * zero-length `PrivateIdentifier` WITHOUT ADVANCING THE SCANNER, so the loop
 * spins until the process dies -- measured here, at 400,000 tokens on two of the
 * files then swept. An apostrophe in prose is the same class, opening a string
 * literal that swallows the rest of the page. Asking for a JSX token instead
 * yields the whole run as one `JsxText`, which is correct as well as finite.
 *
 * AND A TEMPLATE'S `}` IS RE-SCANNED, for the same kind of reason. `${...}`
 * closes with a `CloseBraceToken`, so a walker counting braces reads it as the
 * end of the JSX interpolation it stands inside, and every state after it is
 * wrong: measured on `/items/<id>`, where a `key` built from a template put the
 * walk back inside a tag, after which the scanner read three thousand characters
 * of DOC COMMENT as template literals before stalling on that `#`.
 * `reScanTemplateToken` is what the compiler's own parser calls there, and it
 * answers `TemplateMiddle` or `TemplateTail` where a brace-counter guesses.
 */
function theTokens(source: string): Token[] {
  // `skipTrivia` first, then the variant: TypeScript 7 dropped the ScriptTarget
  // this call used to open with, and the arguments shift silently rather than
  // failing, which the typechecker caught here and no runtime probe did.
  const scanner = createScanner(true, LanguageVariant.JSX, source);

  const tokens: Token[] = [];
  const stack: ("tag" | "children" | "closing" | "code")[] = ["code"];
  const open: { where: Where; id: number }[] = [];
  /**
   * What stands open around the current token. `depth` is the ordinary braces
   * inside the innermost one, so the `}` that closes it can be told from the `}`
   * of an object literal written within it.
   */
  const frames: { type: "interpolation" | "template"; depth: number }[] = [];
  let interpolations = 0;

  const top = () => stack[stack.length - 1] ?? "code";
  const innermost = () => frames[frames.length - 1];
  const outermost = () => open[open.length - 1];
  const push = (kind: SyntaxKind) =>
    tokens.push({
      kind,
      text: scanner.getTokenText(),
      where: outermost()?.where ?? "code",
      interpolation: outermost()?.id ?? -1,
      inTag: top() === "tag",
    });

  const openAnInterpolation = (kind: SyntaxKind, at: Where) => {
    push(kind);
    open.push({ where: at, id: ++interpolations });
    frames.push({ type: "interpolation", depth: 0 });
    stack.push("code");
  };

  /**
   * WHERE THE SCANNER STOPPED, so a token that does not advance it is a NAMED
   * red rather than a hung suite. The `#` above was found as a hang, and the
   * next character of its kind announces itself instead.
   */
  let lastEnd = -1;

  for (;;) {
    const kind = top() === "children" ? scanner.scanJsxToken() : scanner.scan();
    if (kind === SyntaxKind.EndOfFile) break;

    const end = scanner.getTokenEnd();
    if (end === lastEnd) {
      throw new Error(
        `the scanner stopped advancing at offset ${end}, on ${JSON.stringify(
          source.slice(end, end + 30),
        )}`,
      );
    }
    lastEnd = end;

    if (top() === "children") {
      if (kind === SyntaxKind.OpenBraceToken) {
        openAnInterpolation(kind, "child");
        continue;
      }
      if (kind === SyntaxKind.LessThanSlashToken) {
        // `</Tag>`: these children are over once its `>` arrives.
        push(kind);
        stack.pop();
        stack.push("closing");
        continue;
      }
      if (kind === SyntaxKind.LessThanToken) {
        push(kind);
        stack.push("tag");
        continue;
      }
      push(kind);
      continue;
    }

    if (top() === "closing") {
      push(kind);
      if (kind === SyntaxKind.GreaterThanToken) stack.pop();
      continue;
    }

    if (top() === "tag") {
      if (kind === SyntaxKind.OpenBraceToken) {
        // An attribute's value, or a spread. Neither is a sentence.
        openAnInterpolation(kind, "attribute");
        continue;
      }
      if (kind === SyntaxKind.GreaterThanToken) {
        push(kind);
        stack.pop();
        stack.push("children");
        continue;
      }
      if (kind === SyntaxKind.SlashToken) {
        // `/>`: the element closes itself, so no children follow it.
        push(kind);
        stack.pop();
        continue;
      }
      push(kind);
      continue;
    }

    // Ordinary code, which is where JSX begins and where a frame ends.
    if (kind === SyntaxKind.TemplateHead) {
      push(kind);
      frames.push({ type: "template", depth: 0 });
      continue;
    }
    if (kind === SyntaxKind.OpenBraceToken) {
      const frame = innermost();
      if (frame !== undefined) frame.depth++;
      push(kind);
      continue;
    }
    if (kind === SyntaxKind.CloseBraceToken) {
      const frame = innermost();
      if (frame === undefined) {
        push(kind);
        continue;
      }
      if (frame.depth > 0) {
        frame.depth--;
        push(kind);
        continue;
      }
      if (frame.type === "template") {
        // The compiler's own move here: a `}` in a template is not a brace.
        const resumed = scanner.reScanTemplateToken(false);
        push(resumed);
        if (resumed === SyntaxKind.TemplateTail) frames.pop();
        continue;
      }
      push(kind);
      frames.pop();
      open.pop();
      stack.pop();
      continue;
    }
    if (kind === SyntaxKind.LessThanToken && aValueCanStartAfter(tokens[tokens.length - 1])) {
      push(kind);
      stack.push("tag");
      continue;
    }
    if (kind === SyntaxKind.SlashToken && aValueCanStartAfter(tokens[tokens.length - 1])) {
      // A REGEX IS ONE TOKEN OR IT IS A STALL (ADR-0177). `scan()` answers a bare
      // `/` and leaves the body to be read as code, where a `#` never advances the
      // scanner and a backtick opens a template that runs into the next docblock.
      // `reScanSlashToken` is the compiler's own move, as it is for a template's
      // `}` above.
      push(scanner.reScanSlashToken());
      continue;
    }
    push(kind);
  }

  return tokens;
}

/**
 * Whether a VALUE can start here, which decides two ambiguities at once: whether
 * a `<` opens an element or compares, and whether a `/` opens a regex or divides.
 *
 * DECIDED BY WHAT CAME BEFORE IT, which is what a token stream can answer without
 * a parser: both stand only where an EXPRESSION may, so a `<` after an identifier
 * is `Map<string, string>` or a comparison and a `/` after one is division, while
 * either after `=`, `(`, `,`, `return` or `&&` opens something.
 *
 * ONE PREDICATE FOR BOTH BECAUSE IT IS ONE QUESTION, and the `/` half is what
 * keeps the walk out of ADR-0177's runaway: a regex BODY read as code is code
 * that was never written, and `/(#)/` is a stall in it.
 */
function aValueCanStartAfter(previous: Token | undefined): boolean {
  if (previous === undefined) return true;
  return ![
    SyntaxKind.Identifier,
    SyntaxKind.CloseParenToken,
    SyntaxKind.CloseBracketToken,
    SyntaxKind.StringLiteral,
    SyntaxKind.NumericLiteral,
    SyntaxKind.GreaterThanToken,
  ].includes(previous.kind);
}

/** A half-open run of tokens. */
interface Span {
  from: number;
  to: number;
}

/** Whether a token opens or closes one of the three bracketing pairs. */
function opens(kind: SyntaxKind | undefined): boolean {
  return (
    kind === SyntaxKind.OpenParenToken ||
    kind === SyntaxKind.OpenBraceToken ||
    kind === SyntaxKind.OpenBracketToken
  );
}

function closes(kind: SyntaxKind | undefined): boolean {
  return (
    kind === SyntaxKind.CloseParenToken ||
    kind === SyntaxKind.CloseBraceToken ||
    kind === SyntaxKind.CloseBracketToken
  );
}

/** Just past the delimiter matching the one at `from`. */
function pastTheMatch(tokens: Token[], from: number, open: SyntaxKind, close: SyntaxKind): number {
  let depth = 0;
  for (let at = from; at < tokens.length; at++) {
    const kind = tokens[at]?.kind;
    if (kind === open) depth++;
    else if (kind === close && --depth === 0) return at + 1;
  }
  return tokens.length;
}

/**
 * How many tokens the access path at `at` spans, so what FOLLOWS it can be read.
 *
 * COUNTED RATHER THAN ASSUMED FROM THE PATH'S SHAPE. This was `path.includes(".")
 * ? 3 : 1`, which is right for `a` and `a.b` and wrong for `a.b.c`: `mentionsIn`
 * only ever builds two segments, so the third `.` was read as the token after the
 * path and a gate on `a.b.c` looked like a print.
 */
function segmentsOf(tokens: Token[], at: number): number {
  let width = 1;
  while (
    tokens[at + width]?.kind === SyntaxKind.DotToken &&
    tokens[at + width + 1]?.kind === SyntaxKind.Identifier
  ) {
    width += 2;
  }
  return width;
}

/**
 * The first token at or after `from` that is one of `stops` and stands at the
 * SPAN'S OWN bracket depth, or `to` where there is none.
 *
 * ONE WALK BECAUSE THERE WERE SIX, and they were six spellings of one question:
 * where does this initializer end, where does this property end, where does this
 * arrow body end, is there a comparison out here. Each carried its own depth
 * counter, and a counter written six times is five chances to write it wrong.
 */
function atDepthZero(tokens: Token[], span: Span, stops: SyntaxKind[]): number {
  let depth = 0;
  for (let at = span.from; at < span.to; at++) {
    const kind = tokens[at]?.kind;
    if (opens(kind)) depth++;
    else if (closes(kind)) {
      if (depth === 0) return at;
      depth--;
    } else if (depth === 0 && kind !== undefined && stops.includes(kind)) {
      return at;
    }
  }
  return span.to;
}

/** An access path an expression mentions, and where it was mentioned. */
interface Mention {
  path: string;
  at: number;
}

/**
 * The access paths in a run of tokens: `query`, and `search.q` for a member.
 *
 * BOTH FORMS, because a value can be held either way and the shorter one is what
 * catches a whole object being printed. Where the longest matters -- deciding
 * whether what stands here is a SENTENCE -- `theLongest` picks it out.
 */
function mentionsIn(tokens: Token[], span: Span): Mention[] {
  const found: Mention[] = [];
  for (let at = span.from; at < span.to; at++) {
    const token = tokens[at];
    if (token?.kind !== SyntaxKind.Identifier) continue;
    if (tokens[at - 1]?.kind === SyntaxKind.DotToken) continue;
    found.push({ path: token.text, at });
    const property = tokens[at + 2];
    if (tokens[at + 1]?.kind === SyntaxKind.DotToken && property?.kind === SyntaxKind.Identifier) {
      found.push({ path: `${token.text}.${property.text}`, at });
    }
  }
  return found;
}

/**
 * One mention per place, the longest.
 *
 * `{scope.gone && ...}` mentions both `scope` and `scope.gone`, and only the
 * longer one is what stands there: read as a bare `scope` the gate is invisible,
 * because the token after it is a `.` rather than the `&&` that gates.
 */
function theLongest(mentions: Mention[]): Mention[] {
  const best = new Map<number, Mention>();
  for (const mention of mentions) {
    const already = best.get(mention.at);
    if (already === undefined || mention.path.length > already.path.length) {
      best.set(mention.at, mention);
    }
  }
  return [...best.values()];
}

/**
 * The runs of tokens a value cannot carry the reader's bytes out of.
 *
 * FOUR SHAPES, each answering with something other than what was typed:
 *
 * - A BOUNDING CALL, which is the point of the whole file.
 * - A LOOKUP KEYED ON THE VALUE. `kinds.find(...)` answers with one of the
 *   catalogue's kinds; the reader's word only chose which.
 * - AN INDEX INTO SOMETHING THIS TREE WROTE. `WHAT_WAS_REFUSED[because]` is that
 *   same act spelled as a subscript, and `/items/<id>` uses exactly it.
 * - A CALL HANDED THE CATALOGUE'S OWN DATA. `theScope(groups, narrowedTo)` is
 *   given the Groups the catalogue holds AND the id a reader asked for, and
 *   answers with a GROUP -- whose name is the Owner's words, which ADR-0170 keeps
 *   unbounded on purpose. Read as propagation it made every sentence naming a
 *   Group a breach on four pages.
 *
 * THAT LAST ONE USED TO ASK HOW MANY ARGUMENTS THERE WERE, AND THAT WAS A FALSE
 * PASS FOUND BY THE DISPATCHER. Sealing any call of more than one argument
 * sealed `shortenTo(query, 80)` as well -- the CUT ALONE, ADR-0163's
 * half-mechanism, reaching a sentence -- and the row written to catch it tested
 * `shortenTo(query)`, ONE argument, which is a call nobody can make: the real
 * signature is `(text: string, max: number)`. An assertion against a shape that
 * cannot exist proves nothing about the shape that can. What seals now is
 * PROVENANCE rather than arity: a call is sealed when one of its arguments
 * carries data read out of the catalogue, which is what `theScope` gets and what
 * a ceiling never is.
 */
function sealedSpans(
  tokens: Token[],
  span: Span,
  bounding: Set<string>,
  fromTheCatalogue: (at: number, path: string) => boolean,
): Span[] {
  const sealed: Span[] = [];

  for (let at = span.from; at < span.to; at++) {
    const token = tokens[at];
    if (token?.kind !== SyntaxKind.Identifier) continue;

    if (tokens[at + 1]?.kind === SyntaxKind.OpenBracketToken) {
      sealed.push({
        from: at + 1,
        to: pastTheMatch(tokens, at + 1, SyntaxKind.OpenBracketToken, SyntaxKind.CloseBracketToken),
      });
      continue;
    }
    if (tokens[at + 1]?.kind !== SyntaxKind.OpenParenToken) continue;

    const to = pastTheMatch(tokens, at + 1, SyntaxKind.OpenParenToken, SyntaxKind.CloseParenToken);
    const isALookup = LOOKUPS.includes(token.text) && tokens[at - 1]?.kind === SyntaxKind.DotToken;
    const given = mentionsIn(tokens, { from: at + 2, to: to - 1 }).some(({ path, at: where }) =>
      fromTheCatalogue(where, path),
    );

    if (bounding.has(token.text) || isALookup || given) sealed.push({ from: at, to });
  }

  return sealed;
}

function within(spans: Span[], at: number): boolean {
  return spans.some((span) => at >= span.from && at < span.to);
}

/** What a parameter is called on the address, keyed by scope and path. */
type Taint = Map<string, Set<string>>;

function add(taint: Taint, key: string, parameters: Iterable<string>): boolean {
  const already = taint.get(key) ?? new Set<string>();
  const before = already.size;
  for (const parameter of parameters) already.add(parameter);
  taint.set(key, already);
  return already.size > before;
}

/**
 * A lexical scope: a function body, or the module itself.
 *
 * WITHOUT THESE THE CHECK IS UNUSABLE, which was measured rather than foreseen.
 * `?provider=` is read on `/import` and handed to a component as `baseUrl`, and
 * `configured.map((baseUrl) => ...)` binds a DIFFERENT `baseUrl` three screens
 * away: a walk keyed on bare names reported the second because of the first.
 * SIX such collisions stood on an otherwise clean tree, among them the front
 * page's `NoItemsOfThatKind`, whose `kind` is an `item_kinds` LABEL and whose
 * docblock is CNCORE-281 explaining that the typed word no longer reaches it. A
 * check that has to be loosened to get past its own false reds is the thing this
 * ticket refused to build.
 */
interface Scope {
  id: number;
  from: number;
  to: number;
  /** The names bound HERE, which shadow the same name outside. */
  declares: Set<string>;
  /** A function declaration's name, so a component can be found by its tag. */
  name?: string;
}

/** The names a parameter list binds, stopping where its type annotation begins. */
function bindingNamesIn(tokens: Token[], parens: Span): string[] {
  const inside = { from: parens.from + 1, to: parens.to - 1 };
  // At the parameter list's own level a `:` opens a TYPE, and every name in one
  // belongs to the type rather than to a binding.
  const typed = atDepthZero(tokens, inside, [SyntaxKind.ColonToken]);
  const names: string[] = [];

  for (let at = inside.from; at < typed; at++) {
    const token = tokens[at];
    if (token?.kind !== SyntaxKind.Identifier) continue;
    if (tokens[at - 1]?.kind === SyntaxKind.DotToken) continue;
    names.push(token.text);
  }

  return names;
}

/** Every scope in a module, the module's own first. */
function theScopes(tokens: Token[]): Scope[] {
  const scopes: Scope[] = [{ id: 0, from: 0, to: tokens.length, declares: new Set() }];

  for (let at = 0; at < tokens.length; at++) {
    const kind = tokens[at]?.kind;

    if (kind === SyntaxKind.FunctionKeyword) {
      const named = tokens[at + 1];
      let parens = at + 1;
      while (parens < tokens.length && tokens[parens]?.kind !== SyntaxKind.OpenParenToken) parens++;
      if (parens >= tokens.length) continue;
      const afterParens = pastTheMatch(
        tokens,
        parens,
        SyntaxKind.OpenParenToken,
        SyntaxKind.CloseParenToken,
      );
      let body = afterParens;
      while (body < tokens.length && tokens[body]?.kind !== SyntaxKind.OpenBraceToken) body++;
      if (body >= tokens.length) continue;

      scopes.push({
        id: scopes.length,
        from: at,
        to: pastTheMatch(tokens, body, SyntaxKind.OpenBraceToken, SyntaxKind.CloseBraceToken),
        declares: new Set(bindingNamesIn(tokens, { from: parens, to: afterParens })),
        name: named?.kind === SyntaxKind.Identifier ? named.text : undefined,
      });
      continue;
    }

    if (kind !== SyntaxKind.EqualsGreaterThanToken) continue;

    const previous = tokens[at - 1];
    let from: number;
    let parameters: string[];

    if (previous?.kind === SyntaxKind.CloseParenToken) {
      let depth = 0;
      let opening = at - 1;
      for (; opening >= 0; opening--) {
        const here = tokens[opening]?.kind;
        if (here === SyntaxKind.CloseParenToken) depth++;
        else if (here === SyntaxKind.OpenParenToken && --depth === 0) break;
      }
      if (opening < 0) continue;
      from = opening;
      parameters = bindingNamesIn(tokens, { from: opening, to: at });
    } else if (previous?.kind === SyntaxKind.Identifier) {
      from = at - 1;
      parameters = [previous.text];
    } else {
      continue;
    }

    const bodyStart = at + 1;
    const body = tokens[bodyStart]?.kind;
    let to: number;
    if (body === SyntaxKind.OpenBraceToken) {
      to = pastTheMatch(tokens, bodyStart, SyntaxKind.OpenBraceToken, SyntaxKind.CloseBraceToken);
    } else if (body === SyntaxKind.OpenParenToken) {
      to = pastTheMatch(tokens, bodyStart, SyntaxKind.OpenParenToken, SyntaxKind.CloseParenToken);
    } else {
      to = atDepthZero(tokens, { from: bodyStart, to: tokens.length }, [
        SyntaxKind.CommaToken,
        SyntaxKind.SemicolonToken,
      ]);
    }

    /*
     * AN ARROW BOUND TO A NAME CARRIES IT, because a wrapper is as often written
     * `const f = (q) => …` as `function f(q)`. Without this, `theBoundingCalls`
     * could not see such a wrapper and a page calling it would be reported --
     * a false RED, which costs a reader the trust the check is for.
     */
    const named = tokens[from - 1]?.kind === SyntaxKind.EqualsToken ? tokens[from - 2] : undefined;

    scopes.push({
      id: scopes.length,
      from,
      to,
      declares: new Set(parameters),
      name: named?.kind === SyntaxKind.Identifier ? named.text : undefined,
    });
  }

  return scopes;
}

/** Everything a module knows about where the values it renders came from. */
interface Reading {
  tokens: Token[];
  scopes: Scope[];
  taint: Taint;
  /** Scoped names holding a whole `searchParams`, every property of which is one. */
  objects: Set<string>;
  /**
   * The paths KNOWN to hold nothing, which is not the same as unknown.
   * `search.quoted` is bounded where `search.q` is not, and ADR-0170 named them
   * apart exactly so that a sentence reaching for the wrong one is visible.
   */
  holdsNothing: Set<string>;
  /**
   * What a name is another name FOR, so member precision survives a hand-off.
   * `/import` builds one value, wraps it in a second, and hands that to a
   * component: without this the component's `search.quoted` resolves to whatever
   * the whole object carries, and the bounded field reads as the unbounded one.
   */
  aliases: Map<string, string>;
  /** Every call that leaves a value bounded, derived from the tree. */
  bounding: Set<string>;
  /**
   * The scoped paths holding what an awaited read answered, which is this tree's
   * own data rather than anybody's typing. A call handed one of these answers
   * with it.
   */
  catalogue: Set<string>;
}

/** The single path a run of tokens IS, where it is one and nothing else. */
function aliasFor(tokens: Token[], span: Span): string | undefined {
  const width = span.to - span.from;
  const first = tokens[span.from];
  if (first?.kind !== SyntaxKind.Identifier) return undefined;
  if (width === 1) return first.text;
  if (width !== 3) return undefined;
  const property = tokens[span.from + 2];
  if (tokens[span.from + 1]?.kind !== SyntaxKind.DotToken) return undefined;
  if (property?.kind !== SyntaxKind.Identifier) return undefined;
  return `${first.text}.${property.text}`;
}

/** The scopes around a token, innermost first. */
function scopesAt(scopes: Scope[], at: number): Scope[] {
  return scopes
    .filter((scope) => at >= scope.from && at < scope.to)
    .sort((one, other) => one.to - one.from - (other.to - other.from));
}

/**
 * What a path holds inside one scope, following whatever it is a name for.
 *
 * `undefined` where the scope knows NOTHING about it, so the caller keeps
 * looking outward; an empty set where the scope knows it holds nothing.
 */
function resolveKey(
  reading: Reading,
  scope: number,
  segments: string[],
  depth: number,
): Set<string> | undefined {
  // An alias chain this long is a model that has gone wrong, and answering
  // "holds nothing" would be answering CLEAN to a question this cannot read.
  if (depth > 8) throw new Error(`an alias chain past ${depth}: ${segments.join(".")}`);

  const key = `${scope}:${segments.join(".")}`;
  const held = reading.taint.get(key);
  if (held !== undefined) return held;
  if (reading.holdsNothing.has(key)) return new Set();

  // The longest prefix that is another name for something, first.
  for (let cut = segments.length; cut >= 1; cut--) {
    const alias = reading.aliases.get(`${scope}:${segments.slice(0, cut).join(".")}`);
    if (alias === undefined) continue;
    const marker = alias.indexOf(":");
    return resolveKey(
      reading,
      Number(alias.slice(0, marker)),
      [...alias.slice(marker + 1).split("."), ...segments.slice(cut)],
      depth + 1,
    );
  }

  const [base = "", property] = segments;
  if (segments.length === 2 && property !== undefined && reading.objects.has(`${scope}:${base}`)) {
    return new Set([property]);
  }

  return undefined;
}

/**
 * What a name holds where it stands, read out through the scope chain.
 *
 * IT STOPS AT THE SCOPE THAT BINDS THE NAME, which is what makes a callback's
 * parameter its own value rather than the outer one it happens to spell.
 */
function taintFor(reading: Reading, at: number, path: string): Set<string> {
  const [base = ""] = path.split(".");

  for (const scope of scopesAt(reading.scopes, at)) {
    const resolved = resolveKey(reading, scope.id, path.split("."), 0);
    if (resolved !== undefined) return resolved;
    if (scope.declares.has(base)) return new Set();
  }

  return new Set();
}

/**
 * Whether a path names what an awaited read answered, read through the scope
 * chain the way `taintFor` reads taint.
 */
function holdsCatalogueData(reading: Reading): (at: number, path: string) => boolean {
  return (at, path) => {
    const [base = ""] = path.split(".");
    for (const scope of scopesAt(reading.scopes, at)) {
      if (reading.catalogue.has(`${scope.id}:${base}`)) return true;
      if (scope.declares.has(base)) return false;
    }
    return false;
  };
}

/**
 * The parameters a run of tokens can carry out of itself.
 *
 * TWO MORE WAYS IT CARRIES NOTHING, beside the sealed spans: an `await` answers
 * with the catalogue's data, and a comparison answers with a boolean.
 */
function carried(reading: Reading, span: Span): Set<string> {
  const { tokens } = reading;
  const out = new Set<string>();

  for (let at = span.from; at < span.to; at++) {
    if (tokens[at]?.kind === SyntaxKind.AwaitKeyword) return out;
  }

  // A comparison out here makes the whole thing a boolean.
  if (atDepthZero(tokens, span, COMPARISONS) < span.to) return out;

  const sealed = sealedSpans(tokens, span, reading.bounding, holdsCatalogueData(reading));
  for (const { path, at } of mentionsIn(tokens, span)) {
    if (within(sealed, at)) continue;
    for (const parameter of taintFor(reading, at, path)) out.add(parameter);
  }
  return out;
}

/** The names a `const` binds, and where its initializer runs. */
interface Binding {
  at: number;
  /** Each bound name, with the property it was taken from where they differ. */
  names: { name: string; from: string }[];
  destructured: boolean;
  initializer: Span;
}

function theBindings(tokens: Token[]): Binding[] {
  const bindings: Binding[] = [];

  for (let at = 0; at < tokens.length; at++) {
    const kind = tokens[at]?.kind;
    if (kind !== SyntaxKind.ConstKeyword && kind !== SyntaxKind.LetKeyword) continue;

    const names: { name: string; from: string }[] = [];
    let cursor = at + 1;
    let destructured = false;

    if (tokens[cursor]?.kind === SyntaxKind.OpenBraceToken) {
      destructured = true;
      const end = pastTheMatch(
        tokens,
        cursor,
        SyntaxKind.OpenBraceToken,
        SyntaxKind.CloseBraceToken,
      );
      for (let inner = cursor + 1; inner < end - 1; inner++) {
        const token = tokens[inner];
        if (token?.kind !== SyntaxKind.Identifier) continue;
        if (tokens[inner - 1]?.kind === SyntaxKind.ColonToken) continue;
        const renamed =
          tokens[inner + 1]?.kind === SyntaxKind.ColonToken ? tokens[inner + 2] : undefined;
        names.push({ name: renamed?.text ?? token.text, from: token.text });
      }
      cursor = end;
    } else if (tokens[cursor]?.kind === SyntaxKind.Identifier) {
      const token = tokens[cursor];
      if (token !== undefined) names.push({ name: token.text, from: token.text });
      cursor += 1;
    } else {
      continue;
    }

    // Past any type annotation, to the `=` that begins the initializer.
    while (
      cursor < tokens.length &&
      tokens[cursor]?.kind !== SyntaxKind.EqualsToken &&
      tokens[cursor]?.kind !== SyntaxKind.SemicolonToken
    ) {
      cursor++;
    }
    if (tokens[cursor]?.kind !== SyntaxKind.EqualsToken) continue;

    const from = cursor + 1;
    const to = atDepthZero(tokens, { from, to: tokens.length }, [SyntaxKind.SemicolonToken]);
    if (names.length > 0) bindings.push({ at, names, destructured, initializer: { from, to } });
  }

  return bindings;
}

/** The properties written inside one object literal. */
function propertiesWithin(
  tokens: Token[],
  open: number,
  end: number,
): { name: string; value: Span }[] {
  const properties: { name: string; value: Span }[] = [];
  let depth = 0;

  for (let at = open + 1; at < end - 1; at++) {
    const kind = tokens[at]?.kind;
    if (opens(kind)) {
      depth++;
      continue;
    }
    if (closes(kind)) {
      depth--;
      continue;
    }
    if (depth !== 0 || kind !== SyntaxKind.Identifier) continue;
    const name = tokens[at];
    if (name === undefined) continue;

    if (tokens[at + 1]?.kind !== SyntaxKind.ColonToken) {
      properties.push({ name: name.text, value: { from: at, to: at + 1 } });
      continue;
    }

    const to = atDepthZero(tokens, { from: at + 2, to: end - 1 }, [SyntaxKind.CommaToken]);
    properties.push({ name: name.text, value: { from: at + 2, to } });
    at = to;
  }

  return properties;
}

/**
 * The properties of every object literal an expression can answer with, so
 * `search.q` and `search.quoted` are two values rather than one.
 *
 * WHICH IS ADR-0170'S OWN ARRANGEMENT. `/import` carries the reader's query as
 * `q` and the bounded one as `quoted`, "named apart so a sentence reaching for
 * `q` is visibly the wrong field" -- and a check that could not tell them apart
 * would have nothing to say about the field that matters. BOTH ARMS OF A
 * TERNARY are read, because that is how `/import` writes it and reading only the
 * first would judge one of the two pages it can render.
 */
function propertiesOf(tokens: Token[], span: Span): { name: string; value: Span }[] {
  const properties: { name: string; value: Span }[] = [];
  let depth = 0;

  for (let at = span.from; at < span.to; at++) {
    const kind = tokens[at]?.kind;
    if (kind === SyntaxKind.OpenBraceToken && depth === 0) {
      const end = pastTheMatch(tokens, at, SyntaxKind.OpenBraceToken, SyntaxKind.CloseBraceToken);
      properties.push(...propertiesWithin(tokens, at, Math.min(end, span.to)));
      at = end - 1;
      continue;
    }
    if (opens(kind)) depth++;
    else if (closes(kind)) depth--;
  }

  return properties;
}

/**
 * Everything in a module that holds a value off the address, and which parameter
 * each one holds.
 *
 * SEEDED AT THE READ, because that is where ADR-0123 puts the bound and a value
 * off an address has no earlier seam. Then followed forward to a fixed point:
 * declarations in either order, and the props of components declared in this
 * file, because `/search`'s heading lives in `NothingFound` BELOW the page that
 * hands it the value.
 */
function theReading(tokens: Token[], bounding: Set<string>): Reading {
  const scopes = theScopes(tokens);
  const reading: Reading = {
    tokens,
    scopes,
    taint: new Map(),
    objects: new Set(),
    holdsNothing: new Set(),
    aliases: new Map(),
    bounding,
    catalogue: new Set(),
  };
  const bindings = theBindings(tokens);
  const inner = (at: number) => scopesAt(scopes, at)[0] ?? scopes[0];

  /** The scope a path's own name belongs to, which is where an alias points. */
  const holderOf = (at: number, path: string): number => {
    const [base = ""] = path.split(".");
    for (const scope of scopesAt(scopes, at)) if (scope.declares.has(base)) return scope.id;
    return 0;
  };

  /** Record what a target is: another name, something held, or nothing. */
  const noteWhat = (key: string, value: Span): boolean => {
    const alias = aliasFor(tokens, value);
    if (alias !== undefined) {
      reading.aliases.set(key, `${holderOf(value.from, alias)}:${alias}`);
      return false;
    }
    const held = carried(reading, value);
    if (held.size > 0) return add(reading.taint, key, held);
    reading.holdsNothing.add(key);
    return false;
  };

  // Every name a `const` binds shadows the same name outside it.
  for (const { at, names } of bindings) {
    const scope = inner(at);
    for (const { name } of names) scope?.declares.add(name);
  }

  /*
   * WHAT THE CATALOGUE ANSWERED, WHICH IS EVERY NAME BOUND FROM AN `await`.
   *
   * Read off the tokens rather than inferred, and read BEFORE the taint settles,
   * because it is a fact about where a value came from rather than about what it
   * carries. `searchParams` is the one await that is NOT this: it answers with
   * the reader's address, which is the whole subject here, so it is taken out
   * again below.
   */
  for (const { at, names, initializer } of bindings) {
    const awaited = (() => {
      for (let cursor = initializer.from; cursor < initializer.to; cursor++) {
        if (tokens[cursor]?.kind === SyntaxKind.AwaitKeyword) return true;
      }
      return false;
    })();
    if (!awaited) continue;
    if (mentionsIn(tokens, initializer).some(({ path }) => path === "searchParams")) continue;
    const scope = inner(at);
    if (scope === undefined) continue;
    for (const { name } of names) reading.catalogue.add(`${scope.id}:${name}`);
  }

  // The reads themselves. A destructure names its parameters outright; a whole
  // `await searchParams` is an object every property of which is one.
  for (const { at, names, destructured, initializer } of bindings) {
    if (!mentionsIn(tokens, initializer).some(({ path }) => path === "searchParams")) continue;
    const scope = inner(at);
    if (scope === undefined) continue;

    if (destructured) {
      for (const { name, from } of names) add(reading.taint, `${scope.id}:${name}`, [from]);
      continue;
    }

    const properties: string[] = [];
    for (let cursor = initializer.from; cursor < initializer.to; cursor++) {
      if (tokens[cursor]?.kind !== SyntaxKind.DotToken) continue;
      const property = tokens[cursor + 1];
      if (property?.kind === SyntaxKind.Identifier) properties.push(property.text);
    }
    const only = names[0]?.name;
    if (only === undefined) continue;
    if (properties.length === 0) reading.objects.add(`${scope.id}:${only}`);
    else add(reading.taint, `${scope.id}:${only}`, properties);
  }

  for (let round = 0; ; round++) {
    /*
     * A CAP THAT STOPS WITHOUT SAYING SO IS A FALSE PASS. Reaching it means the
     * walk has not finished propagating, and a value that has not finished
     * propagating reads as clean -- which is the one answer this file must never
     * give quietly (ADR-0168's shape).
     */
    if (round >= 8) throw new Error(`the taint did not settle in ${round} rounds`);
    let grew = false;

    for (const { at, names, destructured, initializer } of bindings) {
      const scope = inner(at);
      if (scope === undefined) continue;

      if (destructured) {
        // Taken apart again: each name carries what that property carried.
        const [base] = mentionsIn(tokens, initializer);
        const whole = carried(reading, initializer);
        for (const { name, from } of names) {
          const inherited =
            base === undefined
              ? whole
              : taintFor(reading, initializer.from, `${base.path}.${from}`);
          if (add(reading.taint, `${scope.id}:${name}`, inherited)) grew = true;
        }
        continue;
      }

      const only = names[0]?.name;
      if (only === undefined) continue;

      const properties = propertiesOf(tokens, initializer);
      if (properties.length > 0) {
        for (const { name, value } of properties) {
          if (noteWhat(`${scope.id}:${only}.${name}`, value)) grew = true;
        }
        continue;
      }

      if (noteWhat(`${scope.id}:${only}`, initializer)) grew = true;
    }

    // And into the props of the components declared beside them.
    for (let at = 1; at < tokens.length; at++) {
      const token = tokens[at];
      if (token?.kind !== SyntaxKind.Identifier) continue;
      if (tokens[at - 1]?.kind !== SyntaxKind.LessThanToken) continue;
      const component = scopes.find((scope) => scope.name === token.text);
      if (component === undefined) continue;

      let cursor = at + 1;
      while (cursor < tokens.length) {
        const here = tokens[cursor];
        if (here === undefined || !here.inTag) break;
        if (here.kind === SyntaxKind.GreaterThanToken || here.kind === SyntaxKind.SlashToken) break;
        if (
          here.kind !== SyntaxKind.Identifier ||
          tokens[cursor + 1]?.kind !== SyntaxKind.EqualsToken ||
          tokens[cursor + 2]?.kind !== SyntaxKind.OpenBraceToken
        ) {
          cursor++;
          continue;
        }
        const closing = pastTheMatch(
          tokens,
          cursor + 2,
          SyntaxKind.OpenBraceToken,
          SyntaxKind.CloseBraceToken,
        );
        if (noteWhat(`${component.id}:${here.text}`, { from: cursor + 3, to: closing - 1 })) {
          grew = true;
        }
        cursor = closing;
      }
    }

    if (!grew) break;
  }

  return reading;
}

/**
 * EVERY CALL THAT LEAVES A VALUE BOUNDED, READ OFF THE TREE rather than listed.
 *
 * SEEDED BY THE RULE AND NOT BY A NAME. A function that reaches BOTH of
 * ADR-0123's levers bounds; a function that calls one that bounds bounds too, to
 * a fixed point. So `boundedTo` qualifies because its body is
 * `shortenTo(oneLine(...))`, `quotedTo` because it calls `boundedTo`, and
 * `theQueryQuoted` and `theEntryRefused` because they call `quotedTo` -- none of
 * them named here.
 *
 * WHICH IS THE WHOLE DIFFERENCE BETWEEN THIS AND A LIST, AND THE TREE PROVED IT
 * RATHER THAN THE ARGUMENT. The first version seeded the name `boundedTo`, and
 * CNCORE-285 put `quotedTo` between it and both wrappers hours later. A list
 * would have to be remembered; a rule does not.
 *
 * A COMPONENT IS NOT A BOUND, however much bounding its body does. `SearchPage`
 * calls `theQueryQuoted` and returns a page, so counting it would seal any call
 * to it -- and the roll call asserts the whole derived set below rather than
 * merely that it contains what it should, so a new member has to be argued for
 * rather than noticed. PascalCase is how this repository spells a component
 * (`.claude/rules/frontend.md`), and `CONTEXT.md` binds the convention.
 */
function theBoundingCalls(modules: Map<string, string>): Set<string> {
  const bounding = new Set<string>();
  const read = [...modules.values()].map((source) => {
    const tokens = theTokens(source);
    return { tokens, scopes: theScopes(tokens) };
  });

  /**
   * The functions a scope's body calls, by name.
   *
   * ITS OWN NAME IS NOT ONE OF THEM, and reading it as one was a defect this
   * ticket's review turned up sideways. A scope begins at its `function` keyword,
   * so the declaration's own `name(` sits inside the span and answered as a call
   * to itself -- which let `boundedTo` into the set on the strength of being
   * spelled `boundedTo`, rather than on the strength of reaching both levers. The
   * set came out right for the wrong reason, which is the kind of correct that
   * stops being correct without warning.
   */
  const callsIn = (tokens: Token[], scope: Scope): Set<string> => {
    const called = new Set<string>();
    for (let at = scope.from; at < scope.to; at++) {
      if (at === scope.from + 1) continue;
      const token = tokens[at];
      if (token?.kind !== SyntaxKind.Identifier) continue;
      if (tokens[at + 1]?.kind !== SyntaxKind.OpenParenToken) continue;
      called.add(token.text);
    }
    return called;
  };

  for (let round = 0; ; round++) {
    if (round >= 8) {
      throw new Error(`the bounding calls did not settle in ${round} rounds: ${[...bounding]}`);
    }
    let grew = false;
    for (const { tokens, scopes } of read) {
      for (const scope of scopes) {
        const { name } = scope;
        if (name === undefined || bounding.has(name)) continue;
        if (/^[A-Z]/.test(name)) continue;
        const called = callsIn(tokens, scope);
        const bothLevers = THE_LEVERS.every((lever) => called.has(lever));
        const reachesABound = [...called].some((one) => bounding.has(one));
        if (bothLevers || reachesABound) {
          bounding.add(name);
          grew = true;
        }
      }
    }
    if (!grew) break;
  }

  return bounding;
}

/**
 * Whether the interpolation a token stands in renders the output of an ITERATION
 * rather than a value of its own.
 *
 * `{Object.entries(carried).map(...)}` names a value the page never prints: what
 * reaches the reader is the callback's JSX, and every sentence in it is judged
 * where it stands, in its own nested interpolation and its own scope.
 *
 * IT USED TO EXEMPT ANY VALUE INSIDE ANY PARENTHESES, AND THAT WAS A FALSE PASS
 * -- the direction this file says matters. `{shortenTo(query)}` prints a query
 * with the CUT alone in the page's own voice, which is the exact half-mechanism
 * ADR-0163 names and CNCORE-282 was filed for, and the old rule called it an
 * argument and said nothing. Only iteration is excused now, because only
 * iteration prints somewhere else.
 */
function isIterated(tokens: Token[], at: number): boolean {
  const interpolation = tokens[at]?.interpolation;
  if (interpolation === undefined || interpolation < 0) return false;

  let depth = 0;
  for (let cursor = at; cursor < tokens.length; cursor++) {
    const token = tokens[cursor];
    if (token === undefined || token.interpolation !== interpolation) break;
    if (opens(token.kind)) depth++;
    else if (closes(token.kind)) depth--;
    else if (
      depth === 0 &&
      token.kind === SyntaxKind.Identifier &&
      ITERATORS.includes(token.text) &&
      tokens[cursor - 1]?.kind === SyntaxKind.DotToken &&
      tokens[cursor + 1]?.kind === SyntaxKind.OpenParenToken
    ) {
      return true;
    }
  }

  // The iterator can also sit to the LEFT, with this token inside its receiver:
  // `Object.entries(carried).map(...)` mentions `carried` before the `.map`.
  depth = 0;
  for (let cursor = at; cursor >= 0; cursor--) {
    const token = tokens[cursor];
    if (token === undefined || token.interpolation !== interpolation) break;
    if (closes(token.kind)) depth++;
    else if (opens(token.kind)) {
      if (depth === 0) {
        // Out of the call this token sits in; keep looking for an iterator past it.
        for (let onward = cursor; onward < tokens.length; onward++) {
          const later = tokens[onward];
          if (later === undefined || later.interpolation !== interpolation) break;
          if (
            later.kind === SyntaxKind.Identifier &&
            ITERATORS.includes(later.text) &&
            tokens[onward - 1]?.kind === SyntaxKind.DotToken
          ) {
            return true;
          }
        }
        return false;
      }
      depth--;
    }
  }

  return false;
}

/**
 * The parameters a module prints inside one of its own sentences without a
 * bound, each named as it is spelled on the address.
 */
function unboundedIn(source: string, bounding: Set<string>): string[] {
  const tokens = theTokens(source);
  const reading = theReading(tokens, bounding);
  const sealed = sealedSpans(
    tokens,
    { from: 0, to: tokens.length },
    bounding,
    holdsCatalogueData(reading),
  );
  const named = new Set<string>();

  for (const { path, at } of theLongest(mentionsIn(tokens, { from: 0, to: tokens.length }))) {
    const token = tokens[at];
    if (token === undefined || token.where !== "child" || token.inTag) continue;
    if (within(sealed, at) || isIterated(tokens, at)) continue;

    const parameters = taintFor(reading, at, path);
    if (parameters.size === 0) continue;

    /*
     * A value that only GATES the words after it is not one of them, and the test
     * is what FOLLOWS it. `{refused && <p>our own words</p>}` reads the parameter
     * as a condition; the sentence belongs to the page.
     *
     * WHAT PRECEDES IT IS NOT THE SAME QUESTION, AND TREATING IT AS ONE WAS A
     * FALSE PASS ON THE COMMONEST IDIOM THERE IS. `{cond && q}` puts the
     * parameter AFTER the `&&`, where it is the thing rendered rather than the
     * thing tested, and exempting it said nothing about a page that prints the
     * reader's query outright. Only `!` still excuses from the left, because a
     * negated value is a boolean and never the bytes.
     */
    const after = tokens[at + segmentsOf(tokens, at)]?.kind;
    const before = tokens[at - 1]?.kind;
    const gating =
      (after !== undefined && GATES.includes(after)) || before === SyntaxKind.ExclamationToken;
    if (gating) continue;

    for (const parameter of parameters) named.add(parameter);
  }

  return [...named].sort();
}

/**
 * Every surface printing a parameter in its own voice unbounded, as
 * `<path> ?<parameter>=`.
 *
 * NAMED RATHER THAN COUNTED, which is `ui-callers.test.ts`'s arrangement and
 * `prefetch-condition.test.ts`'s: a count tells whoever broke it that something
 * is wrong, and a name tells them where. The parameter is spelled as it is on
 * the address, because that is what the reader typed and what a walk of the page
 * reproduces.
 */
function unboundedParameters(surfaces: Map<string, string>, bounding: Set<string>): string[] {
  return [...surfaces]
    .flatMap(([path, source]) =>
      unboundedIn(source, bounding).map((parameter) => `${path} ?${parameter}=`),
    )
    .sort();
}

/** The surfaces, with one page put back the way a ticket found it. */
function reverted(path: string, was: string, becomes: string): Map<string, string> {
  const surfaces = theSurfaces();
  const page = surfaces.get(path);
  if (page === undefined) throw new Error(`${path} has moved or been renamed`);
  if (!page.includes(was)) throw new Error(`${path} no longer contains ${was}`);
  surfaces.set(path, page.replace(was, becomes));
  return surfaces;
}

/**
 * A surface written here rather than taken from the tree, for a landing the tree
 * does not currently hold.
 *
 * THE REPOSITORY'S PREFERENCE IS A REAL PAGE REVERTED, and every row that can
 * take one does. These two cannot: no page in this tree prints a parameter after
 * a `&&`, or through the cut alone, so there is nothing to revert. Both shapes
 * were FALSE PASSES until the review of this ticket measured them, so what they
 * guard is a regression rather than a hypothetical.
 */
function aSurfaceThat(renders: string): string {
  return `import { oneValue } from "@/components/query-params";
import { shortenTo } from "@canoncore/text";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const query = oneValue(q) ?? "";
  const ok = query.trim() !== "";
  const rows = [query];
  return <p>${renders}</p>;
}
`;
}

const FRONT = join("apps", "web", "src", "app", "page.tsx");
const SEARCH = join("apps", "web", "src", "app", "search", "page.tsx");
const IMPORT = join("apps", "web", "src", "app", "import", "page.tsx");
const SETTINGS = join("apps", "web", "src", "app", "settings", "page.tsx");
const AN_ITEM = join("apps", "web", "src", "app", "items", "[id]", "page.tsx");

describe("the parameters this app quotes inside its own sentences", () => {
  const bounding = theBoundingCalls(theModules());

  /**
   * THE ROLL CALL ITSELF, which went red on `/search` and `/import` until
   * CNCORE-291 landed and is what stops the eighth site arriving unremarked.
   *
   * IT PASSES ON AN EMPTY LIST, and an empty list is also what a walk that had
   * stopped asking returns -- which is why every row below it exists.
   */
  it("holds every one of them to a bound taken where the parameter is read", () => {
    expect(
      unboundedParameters(theSurfaces(), bounding),
      "ADR-0178: each of these prints a value off the address in the page's own voice",
    ).toStrictEqual([]);
  });

  /**
   * THE POPULATION IS REAL, so nothing above passes by having found nothing. The
   * figures are floors rather than counts, because a count here is a figure
   * about this tree that would need its own date (ADR-0153).
   */
  it("reads surfaces that really are there, and really do read an address", () => {
    const surfaces = theSurfaces();
    expect(surfaces.size).toBeGreaterThan(20);

    const reading = [...surfaces].filter(([, source]) => source.includes("searchParams"));
    expect(reading.length).toBeGreaterThan(5);
    expect(theSurfaces().get(SEARCH)).toBeDefined();
  });

  /**
   * THE RED, DRIVEN RATHER THAN DESCRIBED, and it is the state CNCORE-291 found:
   * `/search` read `?q=` and put the read's own value in its heading. Reverting
   * the bound AT THE READ is exactly that page, so what this proves is that the
   * check would have caught the thing it was written for.
   */
  it("names /search's query where the page prints the value it asks with", () => {
    const surfaces = reverted(SEARCH, "theQueryQuoted(query)", "query");

    expect(unboundedParameters(surfaces, bounding)).toStrictEqual([`${SEARCH} ?q=`]);
  });

  /**
   * AND THE SEVENTH SITE, which is the one that matters most here: `/import` was
   * found by a REVIEWER reading the diff of the ticket that fixed `/search`, in
   * the same sentence where that ticket said the set was complete. A check that
   * caught the sixth and not the seventh would have shipped the same mistake.
   */
  it("names /import's query, which no count of the bound's callers could", () => {
    const surfaces = reverted(IMPORT, "quoted: theQueryQuoted(query)", "quoted: query");

    expect(unboundedParameters(surfaces, bounding)).toStrictEqual([`${IMPORT} ?q=`]);
  });

  /**
   * AND THE FIFTH SITE, whose bound is taken through a wrapper in ANOTHER
   * MODULE. `/settings` never says `boundedTo`: it calls `theEntryRefused`,
   * which `settings/refusal.ts` defines. This row is what proves the derived set
   * of bounding calls reaches it, because with a hardcoded pair this page reads
   * as a breach.
   */
  it("names /settings' entry where the bound its own wrapper takes is dropped", () => {
    const surfaces = reverted(
      SETTINGS,
      "theEntryRefused(asked.refused)",
      "oneValue(asked.refused)",
    );

    expect(unboundedParameters(surfaces, bounding)).toStrictEqual([`${SETTINGS} ?refused=`]);
  });

  /**
   * THE BOUNDING CALLS ARE DERIVED, NOT LISTED, and this says which ones the
   * tree yields. `theEntryRefused` is the whole argument: it shares no name with
   * `boundedTo`, lives in a module that renders nothing, and counts because of
   * what its body does.
   *
   * AND `shortenTo` IS NOT ONE, which is the half-mechanism ADR-0163 keeps
   * finding. A tree where the cut alone began to count would go quietly green on
   * the exact defect CNCORE-282 was filed for.
   */
  it("derives what counts as a bound from the tree, wrappers and all", () => {
    expect([...bounding].sort()).toContain("boundedTo");
    expect([...bounding].sort()).toContain("theQueryQuoted");
    expect([...bounding].sort()).toContain("theEntryRefused");
    expect([...bounding].sort()).not.toContain("shortenTo");
  });

  /**
   * A WRAPPER WRITTEN AS AN ARROW COUNTS TOO.
   *
   * `const f = (q) => …` is as ordinary a way to write one as `function f(q)`,
   * and until this ticket's review the walk named only the second -- so a page
   * calling the first would have been reported for a bound it had taken. That is
   * a false RED, which spends the trust the check exists to earn.
   */
  it("derives a bound written as an arrow, not only one written as a function", () => {
    const anArrow = new Map([
      [
        join("packages", "text", "src", "index.ts"),
        "export const bothLevers = (t: string, m: number) => shortenTo(oneLine(t), m);\n" +
          "export const aWrapper = (t: string) => bothLevers(t, 80);\n",
      ],
    ]);

    expect([...theBoundingCalls(anArrow)].sort()).toStrictEqual(["aWrapper", "bothLevers"]);
  });

  /**
   * AND A DECLARATION IS NOT A CALL TO ITSELF.
   *
   * A scope starts at its `function` keyword, so its own `name(` sits inside the
   * span and read as a call. `shortenTo` calling the OTHER lever is what makes
   * that observable: counted as calling itself it reaches both and is admitted,
   * which would make the CUT ALONE a bound and hand ADR-0163's half-mechanism a
   * pass from the check written to refuse it.
   */
  it("does not take a function's own declaration for a call to itself", () => {
    const halfALever = new Map([
      [
        join("packages", "text", "src", "index.ts"),
        "export function shortenTo(text: string): string {\n  return oneLine(text);\n}\n",
      ],
    ]);

    expect([...theBoundingCalls(halfALever)]).toStrictEqual([]);
  });

  /**
   * A FORM FIELD IS NOT A SENTENCE, and the exemption is EXECUTED rather than
   * listed. `?placing=` goes back into the placement picker's box as its
   * `defaultValue`, which ADR-0165 excuses and ADR-0170 restates -- so the page
   * passes as it stands, and the same value moved into the page's own voice is
   * named. The pair is what keeps the exemption honest: without the second row
   * this would be indistinguishable from the walk simply not reaching the file.
   */
  it("excuses ?placing= in a form field, and names it in a sentence", () => {
    expect(unboundedParameters(theSurfaces(), bounding)).not.toContain(`${AN_ITEM} ?placing=`);

    const spoken = reverted(
      AN_ITEM,
      'defaultValue={placing ?? ""}',
      'defaultValue=""/><span>{placing}</span><input',
    );
    expect(unboundedParameters(spoken, bounding)).toStrictEqual([`${AN_ITEM} ?placing=`]);
  });

  /**
   * AND SO IS `/import`'s HIDDEN REPLAY FIELD, which carries the WHOLE query on
   * purpose: a replay built from the bounded value would resubmit a search for
   * the opening of the query plus a cut marker (ADR-0170). The field reads
   * `search.q` where the sentences read `search.quoted`, "named apart so a
   * sentence reaching for `q` is visibly the wrong field" -- and this is the row
   * that shows the walk can tell the two fields apart at all.
   */
  it("excuses /import's replay field, and names the same field in a sentence", () => {
    expect(unboundedParameters(theSurfaces(), bounding)).not.toContain(`${IMPORT} ?q=`);

    const spoken = reverted(
      IMPORT,
      "<TheirWords>{search.quoted}</TheirWords>",
      "<TheirWords>{search.q}</TheirWords>",
    );
    expect(unboundedParameters(spoken, bounding)).toStrictEqual([`${IMPORT} ?q=`]);
  });

  /**
   * AND THE HIDDEN FIELD'S OWN LANDING, moved out of the attribute it lives in.
   *
   * The row above proves the walk tells `search.q` from `search.quoted` inside a
   * SENTENCE. This one proves the exemption is about WHERE the field's value
   * stands: `TheSearchCarried` renders `<input name="q" type="hidden"
   * value={search.q}>`, and the same value spoken beside that input is named.
   * Without this the attribute exemption is executed for `?placing=` and merely
   * asserted for the other case the ticket names.
   */
  it("excuses the replay field where it stands, and names its value once spoken", () => {
    const spoken = reverted(
      IMPORT,
      '<input name="q" type="hidden" value={search.q} />',
      '<input name="q" type="hidden" value="" />\n      <span>{search.q}</span>',
    );
    expect(unboundedParameters(spoken, bounding)).toStrictEqual([`${IMPORT} ?q=`]);
  });

  /**
   * A VALUE AFTER A `&&` IS THE THING RENDERED, NOT THE THING TESTED.
   *
   * THIS WAS A FALSE PASS AND IT IS THE WORST ONE THIS TICKET'S REVIEW FOUND.
   * `{cond && value}` is the commonest render idiom there is, and the gate rule
   * excused anything with a `&&` on EITHER side of it -- so a page printing the
   * reader's query outright, one token after a condition, reported nothing. Only
   * what FOLLOWS a value can gate it.
   */
  it("names a query rendered after a gate, and excuses the one doing the gating", () => {
    expect(unboundedIn(aSurfaceThat("{ok && query}"), bounding)).toStrictEqual(["q"]);
    expect(unboundedIn(aSurfaceThat("{query && query}"), bounding)).toStrictEqual(["q"]);
    expect(unboundedIn(aSurfaceThat('{query || "none"}'), bounding)).toStrictEqual(["q"]);
    expect(unboundedIn(aSurfaceThat('{query ?? "none"}'), bounding)).toStrictEqual(["q"]);
    expect(unboundedIn(aSurfaceThat('{ok ? query : "none"}'), bounding)).toStrictEqual(["q"]);

    // And the value that really is only a condition stays excused.
    expect(
      unboundedIn(aSurfaceThat("{query && <span>our own words</span>}"), bounding),
    ).toStrictEqual([]);
    expect(
      unboundedIn(aSurfaceThat("{!query && <span>our own words</span>}"), bounding),
    ).toStrictEqual([]);
  });

  /**
   * THE CUT ALONE IS NOT A BOUND, AND A SENTENCE TAKING IT IS NAMED.
   *
   * A FALSE PASS TWICE OVER, AND THE SECOND TIME IS THE INSTRUCTIVE ONE. First
   * the rule excusing a value inside parentheses -- written for an iterated
   * expression -- excused every call, so `{shortenTo(query)}` said nothing. That
   * was fixed, and the row written to prove it asserted against
   * `shortenTo(query)`: ONE argument, a call NOBODY CAN MAKE, because the real
   * signature is `(text: string, max: number)`. The fix was real and the row was
   * vacuous, so the two-argument shape -- every shape there is -- went on
   * passing, sealed by a rule that excused any call of more than one argument.
   * The dispatcher found it by reading the signature.
   *
   * SO THE SIGNATURE IS ASSERTED HERE, and the plant is a real page's own text.
   * A row that tests a call shape has to be held to the shape that exists, or it
   * is a row about nothing.
   */
  it("names a query printed through the cut alone, which is half the mechanism", () => {
    // THE SHAPE THIS ROW IS ABOUT, held to the tree rather than to memory of it.
    const levers = readFileSync(join(repoRoot, "packages", "text", "src", "index.ts"), "utf8");
    expect(levers, "`shortenTo`'s signature has moved; the plants below are its shape").toContain(
      "export function shortenTo(text: string, max: number)",
    );

    // Planted into the page, with the arity a caller really writes.
    const spoken = reverted(SEARCH, "theQueryQuoted(query)", "shortenTo(query, 80)");
    expect(unboundedParameters(spoken, bounding)).toStrictEqual([`${SEARCH} ?q=`]);

    // And with the ceiling spelled as this repository spells one, which is a NAME.
    // That is the spelling the old rule was blindest to: two identifiers.
    expect(
      unboundedIn(aSurfaceThat("{shortenTo(query, QUERY_IN_A_SENTENCE)}"), bounding),
    ).toStrictEqual(["q"]);
    // The other half of the mechanism, alone, is no better.
    expect(unboundedIn(aSurfaceThat("{oneLine(query)}"), bounding)).toStrictEqual(["q"]);
    // And a call that is neither, however many arguments it takes, carries.
    expect(unboundedIn(aSurfaceThat("{anything(query, 1, 2)}"), bounding)).toStrictEqual(["q"]);

    // A REAL bound stays silent, so the row above is not simply reporting calls.
    expect(unboundedIn(aSurfaceThat("{boundedTo(query, 40)}"), bounding)).toStrictEqual([]);

    // An ITERATED expression is still excused, which is what that rule was for:
    // the sentence is the callback's, judged in its own scope where it stands.
    expect(
      unboundedIn(aSurfaceThat("{rows.map((row) => <span>{row}</span>)}"), bounding),
    ).toStrictEqual([]);
  });

  /**
   * A LABEL LOOKED UP IN A CLOSED SET IS OURS, AND THE PARAMETER IS NOT.
   *
   * `?kind=` reaches the front page's heading only as an `item_kinds` label,
   * which CNCORE-281 settled by looking the reader's word up rather than
   * printing it. Driven from the real page: put the typed word back where the
   * label goes and it is named.
   */
  it("excuses a kind looked up in the catalogue's own set, and names the typed word", () => {
    expect(unboundedParameters(theSurfaces(), bounding)).not.toContain(`${FRONT} ?kind=`);

    const spoken = reverted(FRONT, "kind={theKindsName}", "kind={chosen.kind}");
    expect(unboundedParameters(spoken, bounding)).toStrictEqual([`${FRONT} ?kind=`]);

    // `.includes` answers about the set too, and a boolean is never the bytes.
    expect(
      unboundedIn(aSurfaceThat("{rows.includes(query) && <span>ours</span>}"), bounding),
    ).toStrictEqual([]);
  });

  /**
   * AND A GROUP'S NAME IS THE OWNER'S WORDS, WHICH ADR-0170 KEEPS UNBOUNDED.
   *
   * `within` is read back off the catalogue after a round trip -- `theScope` is
   * handed the Groups it holds AND the id a reader asked for -- so the sentence
   * "Nothing matched X in Y" names a Group that exists. Hand it the parameter
   * instead and it is named.
   */
  it("excuses a Group's name read back off the catalogue, and names the parameter", () => {
    expect(unboundedParameters(theSurfaces(), bounding)).not.toContain(`${SEARCH} ?group=`);

    const spoken = reverted(SEARCH, "within={scope.group?.name}", "within={narrowedTo}");
    expect(unboundedParameters(spoken, bounding)).toStrictEqual([`${SEARCH} ?group=`]);
  });

  /**
   * THE DERIVED SET OF BOUNDS, WHOLE, so over-reach is a red rather than a
   * shrug.
   *
   * `toContain` WAS NOT ENOUGH, which this ticket's review measured: the walk
   * counted a function as a bound merely for mentioning one, so three PAGES were
   * in the set. A page is not a bound -- it returns a page -- and asserting the
   * whole set is what makes a new member something to argue for.
   *
   * `shortenTo` IS ABSENT BY THE RULE rather than by exclusion: it reaches ONE
   * lever. `quotedTo` is present although nothing here names it, which is
   * CNCORE-285's rename being absorbed instead of breaking the check.
   */
  it("derives the whole set of bounds from the tree, and admits no page to it", () => {
    expect([...bounding].sort()).toStrictEqual([
      "boundedTo",
      "quotedTo",
      "theEntryRefused",
      "theQueryQuoted",
    ]);
  });

  /**
   * THE WALK SURVIVES THE THREE SHAPES THAT RUN THE SCANNER AWAY, which ADR-0177
   * measured over 178 files and could not reduce to a mechanism. They are here
   * reduced: a `#` in a REGEX BODY, a BACKTICK in one -- which opens a template
   * that runs on into the next docblock, where a `#` in prose then stalls -- and
   * JSX TEXT holding either. A `#` in a comment alone is harmless, which is why
   * the minimal case that record tried did not reproduce.
   *
   * IT IS HELD HERE RATHER THAN LEFT TO THE SWEEP because no surface in the tree
   * carries these today, so the roll call above would go on passing if the
   * handling were removed. The guard that throws is asserted too: a scanner that
   * stops advancing has to say so rather than hang a suite forever.
   */
  it("survives a regex, a backtick and JSX text that would run the scanner away", () => {
    expect(() => theTokens("const r = /(#)/g;\n/** an ordinal `#1234` */\n")).not.toThrow();
    expect(() => theTokens("const r = /a`b/;\n/** prose `#1` here */\n")).not.toThrow();
    expect(() =>
      theTokens("export const A = () => <p>ordinal #1234 and don't {x}</p>;\n"),
    ).not.toThrow();

    // And JSX text is read AS text, so a `#` in it is never taken for a value.
    const tokens = theTokens("export const A = () => <p>#1234 {q}</p>;\n");
    expect(tokens.some(({ kind }) => kind === SyntaxKind.JsxText)).toBe(true);
    expect(tokens.filter(({ where }) => where === "child").map(({ text }) => text)).toContain("q");
  });

  /**
   * AND THE GUARD ITSELF THROWS, which until this ticket's review nothing
   * asserted while two docblocks said it did.
   *
   * THE THREE RE-SCANS ABOVE MADE IT DEAD CODE FOR THIS TREE, which is why
   * deleting it changed no test: every stall they leave is one no surface holds.
   * A bare `#` in code position is not valid TypeScript and still reaches it, so
   * this is the shape that proves the guard rather than a tree that needs it --
   * and the point of the guard is that the NEXT such character says so instead of
   * hanging the suite forever.
   */
  it("throws where the scanner stops advancing, rather than spinning", () => {
    expect(() => theTokens("const x = 1;\n# 2\n")).toThrow(/stopped advancing/);
  });

  /**
   * A GATE IS NOT A SENTENCE EITHER. `/items/<id>` reads `?refused=` as a bare
   * boolean and every sentence it gates is the page's own, which CNCORE-281
   * measured rather than argued -- so it passes. Printed instead of tested, it
   * is named, and that is the edit that would owe a bound.
   */
  it("excuses a parameter read as a bare boolean, and names it once printed", () => {
    expect(unboundedParameters(theSurfaces(), bounding)).not.toContain(`${AN_ITEM} ?refused=`);

    const spoken = reverted(AN_ITEM, "{refused && (", "{<span>{refused}</span> && (");
    expect(unboundedParameters(spoken, bounding)).toStrictEqual([`${AN_ITEM} ?refused=`]);
  });
});
