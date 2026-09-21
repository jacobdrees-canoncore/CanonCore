import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./testing/repo-root";
import { trackedFiles } from "./testing/tracked-files";
import { withoutComments } from "./testing/without-comments";

/**
 * A ROLL CALL OVER `packages/ui`, HOLDING EVERY MODULE IN IT TO HAVING A CALLER.
 *
 * The package arrived as scaffold output and 59% of it was never reached: ten
 * modules, 891 of the 1,506 lines of TypeScript under its `src/`, including a
 * chat bubble, a message scroller and an attachment tile in a catalogue. That is
 * the state CNCORE-161 deleted, and this is what stops it growing back --
 * [[0138-a-primitive-earns-its-place-by-having-a-caller]] decides the rule, and a
 * rule nothing reads is a rule somebody remembers.
 *
 * IT LIVES IN `packages/config` BECAUSE ITS SUBJECT IS THE WHOLE REPOSITORY. The
 * question is not what `packages/ui` exports but what the rest of the tree
 * imports, so the files that answer it are everywhere except the package under
 * test. This package's `test` task is `cache: false` for exactly that reason
 * (ADR-0126), so nothing here can replay a stale pass over a file it never read.
 * Beside `packages/ui`'s own suite it would be the opposite: cached against the
 * one directory that cannot answer the question.
 *
 * WHAT IT DOES NOT ANSWER, said here rather than left to be found:
 *
 * - WHETHER THE CALLER IS ITSELF REACHABLE. A module imported only by a component
 *   no route renders counts as reached, because the walk starts at every tracked
 *   source outside the package rather than at the router. It catches a module
 *   nothing imports; a subtree that has quietly fallen off the product needs a
 *   different instrument, and none is built.
 * - ANYTHING THAT IS NOT TYPESCRIPT. The sweep reads `.ts` and `.tsx`, so
 *   `globals.css` is outside it in both directions: a dead stylesheet would never
 *   be named, and a module reached only from CSS would be named wrongly. Neither
 *   is the case today -- `apps/web/src/index.css` imports the one stylesheet
 *   there is -- and CNCORE-161 counted lines of TypeScript, which is the question
 *   this answers.
 */

/** Where `packages/ui`'s modules sit, which is the only directory swept here. */
const UI_SOURCE = "packages/ui/src/";

/**
 * A literal, as a regular expression that matches it and nothing else.
 *
 * ONE ESCAPER FOR BOTH PATTERNS BELOW, because there were two and they disagreed:
 * one escaped `.` alone and the other escaped `/`, which is not a metacharacter at
 * all. The one that mattered is the first. `exports` keys are data read off a
 * manifest, and an unescaped metacharacter in one does not throw -- it COMPILES,
 * to a pattern that matches the wrong thing. A subpath like `./blocks/(beta)/*`
 * becomes `^/blocks/(beta)/(.+)$`, whose first capture is `beta`, so the resolver
 * returns a confidently wrong file and the roll call goes green. A silent false
 * pass is the one answer this file must never give.
 */
function escaped(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/**
 * A resolver from a published specifier to the file it names, built from
 * `packages/ui`'s own `exports` map rather than from the directory layout.
 *
 * READ RATHER THAN ASSUMED, because the map is the package's public surface
 * (ADR-0103's first seam) and it is written in wildcards: `"./components/*"`
 * publishes `"./src/components/*.tsx"`. A walk that hardcoded `src/components`
 * would go on resolving after the map stopped saying that, and would resolve
 * names the map had stopped publishing at all.
 *
 * IT REFUSES A MAP IT CANNOT READ RATHER THAN SKIPPING THE ENTRY, which is the
 * choice `workspace.ts` makes for the same reason: an entry quietly dropped here
 * is a specifier that resolves to nothing, and a module reached only through it
 * would be reported as dead. Conditional exports (`{"import": …}`) and a second
 * `*` are both refused -- Node permits one wildcard per subpath pattern, and a
 * `replace` that substitutes only the first would leave a literal `*` in the path
 * it went on to compare.
 */
function theExportsResolver(): {
  name: string;
  resolve: (specifier: string) => string | undefined;
} {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "packages", "ui", "package.json"), "utf8"),
  ) as { name: string; exports: Record<string, unknown> };

  const published = Object.entries(manifest.exports).map(([subpath, target]) => {
    if (typeof target !== "string") {
      throw new Error(`\`${subpath}\` in packages/ui publishes ${typeof target}, not a path`);
    }
    for (const [side, value] of [
      ["subpath", subpath],
      ["target", target],
    ] as const) {
      if (value.split("*").length > 2) {
        throw new Error(`\`${subpath}\` has more than one \`*\` in its ${side}`);
      }
    }
    return {
      matcher: new RegExp(`^${escaped(subpath.replace(/^\./, "")).replace("\\*", "(.+)")}$`),
      target,
    };
  });

  return {
    name: manifest.name,
    resolve(specifier) {
      const subpath = specifier.slice(manifest.name.length);
      for (const { matcher, target } of published) {
        const found = matcher.exec(subpath);
        if (found === null) continue;
        return join(
          "packages",
          "ui",
          target.replace("*", () => found[1] ?? ""),
        );
      }
      return undefined;
    },
  };
}

/**
 * Every module of `packages/ui` a file IMPORTS, in either spelling reach travels
 * by.
 *
 * AN IMPORT, NOT A MENTION, and that is the difference between this and a grep
 * over the specifier. Matching the string wherever it appeared made any quoted
 * occurrence a caller, so one dead module named in an unrelated string literal --
 * a constant, a fixture, a message -- answered the roll call on behalf of a file
 * nothing renders. Demonstrated under review: a `export const DOCS_PATH =
 * "@canoncore/ui/components/zzdead"` in an unrelated component was enough to keep
 * a genuinely dead module green.
 *
 * THE PUBLISHED SPECIFIER IS HOW THE PACKAGE IMPORTS ITSELF TODAY -- `button.tsx`
 * reaches `lib/utils` as `@canoncore/ui/lib/utils`, not as `../lib/utils` -- so
 * that spelling alone would answer the question as the tree stands. The relative
 * form is read too because the day one module imports its neighbour the short
 * way, a walk that knew only the long one would report the neighbour as reached
 * by nothing and fail against working code.
 */
function uiImportsIn(
  path: string,
  source: string,
  { name, resolve }: ReturnType<typeof theExportsResolver>,
): string[] {
  const found: string[] = [];

  for (const [, specifier] of source.matchAll(
    new RegExp(
      `(?:from|import|require)\\s*\\(?\\s*["'\`](${escaped(name)}\\/[^"'\`\\n]+)["'\`]`,
      "g",
    ),
  )) {
    const target = resolve(specifier as string);
    if (target !== undefined) found.push(target);
  }

  if (path.startsWith(UI_SOURCE)) {
    for (const [, literal] of source.matchAll(
      /(?:from|import|require)\s*\(?\s*["'](\.[^"']*)["']/g,
    )) {
      const base = join(dirname(path), literal as string);
      found.push(`${base}.ts`, `${base}.tsx`);
    }
  }

  return found;
}

/**
 * Every module under `packages/ui/src` that nothing in the repository reaches.
 *
 * REACH IS INHERITED AND RUN TO A FIXED POINT, which is what makes the answer the
 * set of DEAD modules rather than the set of directly-imported ones. `lib/utils`
 * has no importer outside the package at all; it is alive because eight
 * components import it and the app imports those. A walk stopping at one hop
 * would report the package's most-used module as unreachable.
 *
 * AND ONLY A MODULE ALREADY REACHED PASSES REACH ON. That is the whole difference
 * between this and a grep. Before CNCORE-161, `input-group.tsx` imported `Button`,
 * `Input` and `Textarea` and `attachment.tsx` imported `Button` -- so a walk
 * treating every file as a root would have found the ten dead modules keeping
 * each other's dependencies alive and reported a package with nothing wrong.
 *
 * IT TAKES THE SOURCES RATHER THAN READING THEM, which is what lets the canary
 * below drive the red instead of describing it: the state this file exists to
 * catch is one the repository is not in.
 */
function unimportedModules(sources: Map<string, string>): string[] {
  const resolver = theExportsResolver();
  const reached = new Set<string>();

  for (let settled = false; !settled; ) {
    settled = true;
    for (const [path, source] of sources) {
      if (path.startsWith(UI_SOURCE) && !reached.has(path)) continue;
      for (const target of uiImportsIn(path, source, resolver)) {
        if (sources.has(target) && !reached.has(target)) {
          reached.add(target);
          settled = false;
        }
      }
    }
  }

  return [...sources.keys()]
    .filter((path) => path.startsWith(UI_SOURCE) && !reached.has(path))
    .sort();
}

/**
 * The repository's tracked TypeScript, with comments stripped and test files
 * left out.
 *
 * A TEST IS NOT A CALLER, and that exclusion is what the check MEANS rather than
 * a tidying. A component whose only importer is its own test is still a component
 * the product never renders -- the test would be testing the library rather than
 * anything this repository ships -- and it would answer the roll call with a file
 * written to answer it. The same filter keeps `globals.css.test.ts` from being
 * asked to have a caller, which nothing imports because Vitest RUNS it.
 *
 * COMMENTS ARE STRIPPED because this package's records cite module paths in prose
 * -- `select.tsx`'s own docblock is three paragraphs about what it replaced --
 * and a walk reading those would count a record of a deletion as a caller.
 *
 * `-z` RATHER THAN LINES, so a path is whatever git says it is. Without it git
 * applies `core.quotePath` and hands back a non-ASCII filename double-quoted with
 * its bytes octal-escaped, which then fails to open -- a read throwing ENOENT on
 * a file that is sitting right there.
 *
 * THE READ ITSELF IS `trackedFiles`, and the note that used to sit here is
 * spent. It read "THE SECOND COPY OF THIS READ, and deliberately not folded",
 * which was true when two was under
 * [[0136-a-control-is-a-primitive-and-a-surfaces-words-sit-beside-its-pages]]'s
 * line. It reached five (CNCORE-277), and `turbo-cache-inputs.test.ts` -- the
 * neighbour that note named -- was holding the IDENTICAL pathspec WITHOUT the
 * `-z` argued two paragraphs up. [[0171-the-fold-is-of-the-read-not-of-the-question-it-answers]]
 * carries the fold and that measurement.
 *
 * WHAT STAYS HERE IS WHAT IS THIS SUITE'S OWN: the pathspec and the test-file
 * filter. The comment stripping stood beside them until CNCORE-300 and does not
 * any more, which is [[0171-the-fold-is-of-the-read-not-of-the-question-it-answers]]
 * holding rather than bending: what the five readers disagreed about was the
 * APPROXIMATION each had picked, because a regular expression cannot tell a
 * string literal from code and every one of them had to choose which way to be
 * wrong. `testing/without-comments.ts` scans instead, so there is nothing left
 * to disagree about -- and the defect that argument was hiding was live here,
 * a `/*` inside a string or a line comment swallowing source to the next `*\/`.
 */
function theTrackedSources(): Map<string, string> {
  const tracked = trackedFiles([
    "packages/*.ts",
    "packages/*.tsx",
    "apps/*.ts",
    "apps/*.tsx",
  ]).filter((path) => !/\.(test|test-d)\.tsx?$/.test(path));

  // NON-EMPTINESS IS RAISED HERE, at the root of the chain, which is where
  // `workspace.ts` puts it and for the same reason. An empty answer from the roll
  // call means "no module is unreached"; an empty answer from THIS read makes it
  // mean "no module was asked", and the two are indistinguishable at the
  // assertion. A pathspec that stopped matching, or a package renamed out from
  // under this constant, would turn the whole file green having read nothing.
  //
  // IT THROWS RATHER THAN EXPECTS, and it counts what it found rather than
  // holding a number somebody wrote down -- the floor CNCORE-160 took out was
  // `>= 12`, which only ever caught this by being remembered.
  if (!tracked.some((path) => path.startsWith(UI_SOURCE))) {
    throw new Error(`no tracked module under ${UI_SOURCE}, so the roll call has no subject`);
  }

  return new Map(
    tracked.map((path) => [path, withoutComments(readFileSync(join(repoRoot, path), "utf8"))]),
  );
}

/**
 * Every name a module under `packages/ui/src` PUBLISHES.
 *
 * IT CLASSIFIES EVERY `export` IT FINDS AND REFUSES WHAT IT CANNOT, which is a
 * stronger promise than matching the forms this package happens to write and one
 * this file made and did not keep. The first version collected an `export { ... }`
 * list and a `export <kind> <name>` declaration, and SILENTLY SKIPPED six other
 * legal spellings -- `export type { Foo }`, `export abstract class`,
 * `export function*`, `export async function*`, `export declare function`, and a
 * destructured `export const { a, b } = o`. `export type { Foo }` is the live one:
 * every module here writes an `export { ... }` list today and that is one keyword
 * away from it. A name quietly not collected is a name nothing can ever report as
 * dead, so the walk now starts from every `export` keyword and THROWS on one it
 * cannot read. Caught by review before it ever mattered, which is the only reason
 * this reads as a paragraph rather than as an incident.
 *
 * AN ALIAS PUBLISHES ITS RIGHT-HAND SIDE. `export { Card as Panel }` puts `Panel`
 * on the package's surface and `Card` nowhere, so `Panel` is the name a caller
 * has to import and therefore the name to hold to having one.
 *
 * THE REFUSAL ONLY EVER FIRES ON `packages/ui`, because that is the only tree
 * whose exports are collected. A module elsewhere may spell an export however it
 * likes.
 */
function exportedNamesIn(path: string, source: string): string[] {
  const names: string[] = [];

  for (const keyword of source.matchAll(/^[ \t]*export\b/gm)) {
    const statement = source.slice((keyword.index ?? 0) + keyword[0].indexOf("export"));

    // `export { A, B }` and `export type { A, B }`, each optionally `from` somewhere
    // else -- `lib/utils.ts` publishes `cn` by re-exporting the `cn` package.
    const clause = /^export\s+type\s*\{([^}]*)\}|^export\s*\{([^}]*)\}/.exec(statement);
    if (clause !== null) {
      for (const published of (clause[1] ?? clause[2] ?? "").split(",")) {
        const named = published.trim().replace(/^type\s+/, "");
        if (named.length === 0) continue;
        const parts = named.split(/\s+as\s+/);
        names.push((parts[1] ?? parts[0] ?? "").trim());
      }
      continue;
    }

    const declared =
      /^export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\s*\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/.exec(
        statement,
      );
    if (declared?.[1] !== undefined) {
      names.push(declared[1]);
      continue;
    }

    throw new Error(
      `${path} publishes in a form this roll call cannot name, so it cannot report it dead: ` +
        `\`${(statement.split("\n")[0] ?? "").trim()}\``,
    );
  }

  return names.filter((name) => name.length > 0);
}

/**
 * Every `packages/ui` name a file IMPORTS, as the module it comes from and the
 * name it is published under.
 *
 * THE IMPORT CLAUSE IS THE WHOLE ANSWER, which is what makes this immune to the
 * false green its module-level counterpart shipped with. A name cannot appear in
 * an import clause by being mentioned: `"CardTitle"` in a constant, in a message
 * or in a record's prose is not inside `import { ... } from`, so it is never read
 * as a caller.
 *
 * AND THE STATEMENT MUST START A LINE, which is the one remaining way a string
 * could pose as an import. A whole `import { X } from "..."` written INSIDE a
 * string literal is still text this reads, and the row below builds exactly that
 * and requires it to count for nothing -- an anchor is what refuses it, because
 * a literal is introduced by the `=` or the `(` that precedes it on its line.
 *
 * `export { X } from` IS AN IMPORT HERE, and leaving it out was an asymmetry with
 * `uiImportsIn` above, which reads a bare `from` and so has always counted the
 * re-export form. A surface that re-published a primitive would have kept the
 * MODULE alive while every NAME in it read as dead -- a red on correct code, which
 * is the failure mode a check gets deleted for.
 *
 * A DEFAULT BINDING MAY PRECEDE THE BRACE. `import Thing, { Card } from` is legal
 * and was invisible to the first version of this, for the same reason and with the
 * same consequence.
 *
 * AND A NAMESPACE IMPORT IS REFUSED RATHER THAN IGNORED. `import * as Ui from
 * "@canoncore/ui/components/card"` reaches every name in that module through
 * `Ui.`, which this walk cannot attribute and a `Ui.` sweep would attribute to the
 * wrong module the moment two namespaces shared a local name. Ignoring it would
 * report every name in a module that IS used as dead; refusing it says so out
 * loud. Nothing in this repository writes one.
 *
 * WHAT IT STILL DOES NOT READ, said rather than left to be found: a dynamic
 * `await import("@canoncore/ui/...")` destructured into names, and an import
 * spelled at the start of a line inside a template literal. Neither occurs here,
 * and a walk that PARSED TypeScript rather than reading it is the instrument if
 * one ever does.
 *
 * AN ALIAS IMPORTS ITS LEFT-HAND SIDE, which is the mirror of `exportedNamesIn`'s
 * rule: `import { Card as Panel }` reaches the name `Card`, whatever it is called
 * here.
 */
function importedNamesIn(
  path: string,
  source: string,
  { name, resolve }: ReturnType<typeof theExportsResolver>,
): Array<[string, string]> {
  const found: Array<[string, string]> = [];

  for (const [, specifier] of source.matchAll(
    /^[ \t]*import\s+\*\s+as\s+[A-Za-z_$][\w$]*\s+from\s*["'`]([^"'`\n]+)["'`]/gm,
  )) {
    if ((specifier as string).startsWith(`${name}/`)) {
      throw new Error(
        `${path} imports all of \`${specifier}\` as a namespace, which this roll call cannot ` +
          "attribute to a published name",
      );
    }
  }

  for (const [, clause, specifier] of source.matchAll(
    /^[ \t]*(?:import|export)\s+(?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from\s*["'`]([^"'`\n]+)["'`]/gm,
  )) {
    const targets: string[] = [];
    if ((specifier as string).startsWith(`${name}/`)) {
      const target = resolve(specifier as string);
      if (target !== undefined) targets.push(target);
    } else if (path.startsWith(UI_SOURCE) && (specifier as string).startsWith(".")) {
      const base = join(dirname(path), specifier as string);
      targets.push(`${base}.ts`, `${base}.tsx`);
    }
    if (targets.length === 0) continue;

    for (const imported of (clause as string).split(",")) {
      const named = imported.trim().replace(/^type\s+/, "");
      if (named.length === 0) continue;
      const reached = (named.split(/\s+as\s+/)[0] ?? "").trim();
      if (reached.length === 0) continue;
      for (const target of targets) found.push([target, reached]);
    }
  }

  return found;
}

/**
 * Every name `packages/ui` publishes that nothing in the repository imports.
 *
 * ONE RUNG BELOW THE ROLL CALL ABOVE, and the rung CNCORE-263 was filed on.
 * `unimportedModules` asks its question per MODULE, so a module with one live
 * export answers for all of them: `dropdown-menu.tsx` had four callers and
 * fifteen exports, and the eleven dead ones rode on the four live ones with the
 * suite green. Eleven of the fifteen names this repository deleted under that
 * ticket were invisible to a check that was working exactly as designed.
 *
 * IT DOES NOT WALK REACH, AND DOES NOT NEED TO. The module roll call above
 * already holds every module in the package to being reached, in this same file
 * and over this same read -- so by the time this runs, an importing module is a
 * reached module and counting any importer is counting a live one. Were that row
 * ever deleted, this one would start crediting a name imported only by a module
 * nothing renders, which is why the two belong together.
 */
function uncalledExports(sources: Map<string, string>): string[] {
  const resolver = theExportsResolver();

  const called = new Set<string>();
  for (const [path, source] of sources) {
    for (const [target, named] of importedNamesIn(path, source, resolver)) {
      if (sources.has(target)) called.add(`${target} ${named}`);
    }
  }

  const uncalled: string[] = [];
  let published = 0;
  for (const [path, source] of sources) {
    if (!path.startsWith(UI_SOURCE)) continue;
    for (const named of new Set(exportedNamesIn(path, source))) {
      published += 1;
      if (!called.has(`${path} ${named}`)) uncalled.push(`${path} ${named}`);
    }
  }

  // THE SAME NON-EMPTINESS GUARD THE READ ABOVE CARRIES, at the rung that can
  // answer it. An empty list from here means "every published name has a caller";
  // an empty list from a parser that had stopped matching means "no name was
  // asked", and nothing at the assertion tells them apart.
  if (published === 0) {
    throw new Error(`no module under ${UI_SOURCE} publishes a name, so there is nothing to call`);
  }

  return uncalled.sort();
}

describe("the caller roll call over packages/ui", () => {
  /**
   * THE ROLL CALL ITSELF. Ten modules failed this the day it was written, which
   * is the measurement CNCORE-161 was filed on, and the eleventh would fail it
   * the day somebody vendors a primitive nothing goes on to use.
   */
  it("holds every module in the package to having one", () => {
    expect(unimportedModules(theTrackedSources())).toStrictEqual([]);
  });

  /**
   * THE RED, DRIVEN RATHER THAN DESCRIBED. The row above passes on an empty
   * list, and an empty list is also what a walk that had stopped asking returns
   * -- so this one takes the repository's real sources, removes every reference
   * to one module, and requires that module to be named.
   *
   * `Card` is the subject because it sits at the END of the graph: nothing in
   * `packages/ui` imports it, so removing its callers tests the walk's answer
   * rather than its propagation. `Button` would not do -- three of the ten dead
   * modules imported it, and before the deletion it would have stayed "reached"
   * by files that were themselves reached by nothing.
   *
   * THE CALLERS ARE DERIVED, NOT NAMED. A hardcoded importer goes stale the day
   * a second surface renders a Card, and it would go stale in the direction that
   * matters: the canary would still find a caller, report nothing, and pass
   * having demonstrated the opposite of what it claims.
   */
  it("names the module whose callers have gone, which is what the row above cannot say", () => {
    const sources = theTrackedSources();
    const orphaned = new Map(
      [...sources].map(([path, source]) => [
        path,
        source.replaceAll("@canoncore/ui/components/card", ""),
      ]),
    );

    expect(unimportedModules(orphaned)).toStrictEqual(["packages/ui/src/components/card.tsx"]);
  });

  /**
   * AND A MENTION IS NOT AN IMPORT, which is the false green this file shipped
   * with and a reviewer found. Any quoted occurrence of a specifier counted as a
   * caller, so a dead module named in an unrelated string literal answered the
   * roll call on behalf of a file nothing renders.
   *
   * THE SUBJECT IS BUILT, not committed: the row above proves `Card` goes dark
   * when its importers go, and this one puts the specifier back as a bare string
   * and requires it to stay dark. A grep-shaped walk passes the first row and
   * fails this one.
   */
  it("does not take a specifier in an ordinary string for a caller", () => {
    const sources = theTrackedSources();
    const mentioned = new Map(
      [...sources].map(([path, source]) => [
        path,
        path.startsWith(UI_SOURCE)
          ? source
          : `${source.replaceAll("@canoncore/ui/components/card", "")}
             export const NOT_AN_IMPORT = "@canoncore/ui/components/card";`,
      ]),
    );

    expect(unimportedModules(mentioned)).toStrictEqual(["packages/ui/src/components/card.tsx"]);
  });
});

/**
 * THE SAME RULE, ONE RUNG FINER (CNCORE-263).
 *
 * ADR-0138 holds a primitive to having a caller and the roll call above asks it
 * per MODULE, which is the granularity the rule was written at and the
 * granularity a whole package of scaffold needed. It is also why fifteen dead
 * names survived CNCORE-161 in three modules that were themselves alive --
 * eleven of `dropdown-menu.tsx`'s fifteen exports, whose four live ones are all
 * imported by `mode-toggle.tsx` alone.
 *
 * THIS COVERS `packages/ui` AND NOTHING ELSE, WHICH IS A BOUNDARY RATHER THAN A
 * SWEEP THAT RAN OUT OF TIME. `packages/ui` is where the defect was MEASURED, and
 * it is the package the measurement is about: it arrived as a registry's opening
 * move rather than by anyone choosing its contents, so its surface is a guess
 * somebody else made. The other ten packages under `packages/` were written here,
 * export-by-export, by people who wanted each one -- so a roll call over them
 * would be an instrument built on no evidence, which is the speculative
 * abstraction `CLAUDE.md` rules out. The next reader should take the absence of
 * `packages/api` from this sweep as a decision, not as an oversight: the
 * dispatcher made it on 2026-09-20, and CNCORE-263 deleted `packages/api`'s dead
 * `export` keywords BY HAND for exactly that reason.
 */
describe("the export roll call over packages/ui", () => {
  /**
   * THE ROW CNCORE-263 DROVE. Fifteen names failed this the day it was written,
   * in three modules the roll call above reports as perfectly healthy, and that
   * gap between the two rows is the whole reason this one exists.
   */
  it("holds every name the package publishes to having a caller", () => {
    expect(uncalledExports(theTrackedSources())).toStrictEqual([]);
  });

  /**
   * THE RED, DRIVEN RATHER THAN DESCRIBED, in the shape the row above it uses and
   * on the same subject. `CardTitle` is a name whose one importer is outside the
   * package, so removing it tests what this walk ANSWERS rather than how it
   * resolves; and `card.tsx` stays alive throughout, which is the point -- the
   * module roll call cannot see this and would report nothing.
   *
   * THE CALLERS ARE DERIVED, NOT NAMED, for the reason the module canary's are: a
   * hardcoded importer goes stale the day a second surface renders a card title,
   * and it goes stale in the direction that matters -- the canary would still find
   * a caller, report nothing, and pass having shown the opposite of its claim.
   */
  it("names the published name whose callers have gone, while its module stays alive", () => {
    const sources = theTrackedSources();
    const orphaned = new Map(
      [...sources].map(([path, source]) => [
        path,
        path.startsWith(UI_SOURCE) ? source : source.replaceAll("CardTitle", ""),
      ]),
    );

    expect(uncalledExports(orphaned)).toStrictEqual([
      "packages/ui/src/components/card.tsx CardTitle",
    ]);
    expect(unimportedModules(orphaned)).toStrictEqual([]);
  });

  /**
   * AND A NAME IN AN ORDINARY STRING IS NOT A CALLER, which is the false green the
   * module roll call shipped with and a reviewer found one rung up.
   *
   * THE SUBJECT IS BUILT ADVERSARIALLY rather than taken from the tree: not a bare
   * `"CardTitle"`, which parsing the import clause defeats by construction, but a
   * WHOLE import statement written inside a string literal -- the one shape that
   * is still text this file reads. A walk without the line anchor passes the two
   * rows above and fails this one.
   */
  it("does not take an import spelled inside a string for a caller", () => {
    const sources = theTrackedSources();
    const mentioned = new Map(
      [...sources].map(([path, source]) => [
        path,
        path.startsWith(UI_SOURCE)
          ? source
          : `${source.replaceAll("CardTitle", "")}
             export const NOT_AN_IMPORT = "import { CardTitle } from '@canoncore/ui/components/card'";`,
      ]),
    );

    expect(uncalledExports(mentioned)).toStrictEqual([
      "packages/ui/src/components/card.tsx CardTitle",
    ]);
  });
  /**
   * THE READER'S COVERAGE, WHICH THE TREE CANNOT DEMONSTRATE. Every module in
   * `packages/ui` writes one `export { ... }` list, so the rows above exercise
   * exactly one of the spellings TypeScript permits -- and the first version of
   * this file silently collected nothing from six others while its docblock
   * claimed it refused what it could not read. These take the repository's real
   * sources and add one probe module, which is what `unimportedModules` takes its
   * sources rather than reading them FOR: the state a check exists to catch is
   * one the repository is not in.
   */
  const withAProbeModule = (published: string): Map<string, string> =>
    new Map([
      ...theTrackedSources(),
      [`${UI_SOURCE}components/probe.tsx`, published] as [string, string],
    ]);

  it.each([
    ["a type-only list", "export type { Probe };"],
    ["an abstract class", "export abstract class Probe {}"],
    ["a generator", "export function* Probe() {}"],
    ["an async generator", "export async function* Probe() {}"],
    ["an ambient declaration", "export declare function Probe(): void;"],
  ])("collects a name published as %s", (_form, published) => {
    expect(uncalledExports(withAProbeModule(published))).toStrictEqual([
      "packages/ui/src/components/probe.tsx Probe",
    ]);
  });

  /**
   * AND REFUSES THE REST RATHER THAN SKIPPING IT, which is the promise the
   * docblock makes and the one that was untrue. A destructured `export const`
   * publishes names this walk cannot read off the pattern; `default` publishes a
   * name the importing side chooses; `export *` publishes a set that depends on
   * another module. All three are loud rather than empty, because a name quietly
   * not collected is a name nothing can ever report as dead.
   */
  it.each([
    ["a default", "export default Probe;"],
    ["a star re-export", 'export * from "@canoncore/ui/components/card";'],
    ["a destructured const", "export const { Probe } = somewhere;"],
  ])("refuses %s rather than passing over it", (_form, published) => {
    expect(() => uncalledExports(withAProbeModule(published))).toThrow(/cannot name/);
  });

  /**
   * THE CALLING SIDE'S COVERAGE, in the same shape and for the same reason. Each
   * spelling below reaches `CardTitle` and must credit it, with the module's real
   * importer removed so the probe is the only thing keeping it alive. A walk that
   * missed one would report a name that IS used as dead, which is a red on correct
   * code -- the failure mode a check gets deleted for rather than fixed.
   */
  const withAProbeCaller = (spelling: string): Map<string, string> =>
    new Map([
      ...[...theTrackedSources()].map(
        ([path, source]) =>
          [path, path.startsWith(UI_SOURCE) ? source : source.replaceAll("CardTitle", "")] as [
            string,
            string,
          ],
      ),
      ["apps/web/src/components/probe.tsx", spelling] as [string, string],
    ]);

  it.each([
    ["a named import", 'import { CardTitle } from "@canoncore/ui/components/card";'],
    ["a re-export", 'export { CardTitle } from "@canoncore/ui/components/card";'],
    ["an aliased import", 'import { CardTitle as Heading } from "@canoncore/ui/components/card";'],
    [
      "a default beside a named one",
      'import Thing, { CardTitle } from "@canoncore/ui/components/card";',
    ],
  ])("counts %s as a caller", (_spelling, source) => {
    expect(uncalledExports(withAProbeCaller(source))).toStrictEqual([]);
  });

  /**
   * AND REFUSES A NAMESPACE IMPORT, which reaches every name in the module through
   * one local binding. Ignoring it would report every name in a module that is
   * used as dead; a `Ui.` sweep would credit the wrong module the moment two
   * namespaces shared a local name. Saying so out loud is the only honest answer,
   * and nothing in this repository writes one.
   */
  it("refuses a namespace import rather than reading past it", () => {
    expect(() =>
      uncalledExports(withAProbeCaller('import * as Ui from "@canoncore/ui/components/card";')),
    ).toThrow(/namespace/);
  });
});
