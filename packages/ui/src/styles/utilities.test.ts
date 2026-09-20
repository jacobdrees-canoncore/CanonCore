import { existsSync, globSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { __unstable__loadDesignSystem } from "tailwindcss";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * EVERY CLASS THIS PACKAGE WRITES RESOLVES TO SOME CSS (ADR-0158).
 *
 * Nothing asked this before CNCORE-261, and that is why four `cn-*` names sat
 * across five sites for as long as they did: `cn-font-heading` on `card.tsx` and
 * `empty.tsx`, `cn-menu-target cn-menu-translucent` twice on `dropdown-menu.tsx`
 * and `cn-rtl-flip` once. Measured against the Owner's running install on
 * 2026-09-20 by fetching the stylesheet the front page links: 42,260 bytes
 * containing ZERO `cn-` selectors, while `/search` served `cn-font-heading`
 * twice. So three of them shipped to browsers to be matched by nothing.
 *
 * A CLASS THAT RESOLVES TO NOTHING IS INVISIBLE TO EVERY OTHER CHECK HERE. It
 * typechecks, because it is a string. It lints, because it is a valid string. It
 * renders, because the browser is happy to be handed a class no stylesheet
 * mentions. `globals.css.test.ts` beside this one asks whether the stylesheet's
 * TOKENS match `@canoncore/tokens`, which is a different question and would pass
 * against a component whose every class was a typo.
 *
 * THE INSTRUMENT IS TAILWIND'S OWN. `candidatesToCss` returns `null` for a
 * candidate that compiles to nothing, which is precisely the question, and it is
 * what Tailwind's IntelliSense uses to decide whether a class has a hover card.
 * The loader is `__unstable__` and that is worth knowing rather than worth
 * avoiding: the alternative is matching escaped selectors in the built
 * stylesheet with an escaper of our own, which has to agree with Tailwind's
 * character for character on things like `data-[side=bottom]:slide-in-from-top-2`
 * or it reports working classes as broken. An unstable API that answers the
 * question beats a stable one that answers a near-miss of it. If it goes, the
 * failure is a missing export at import time, which is loud.
 */

const stylesheet = fileURLToPath(new URL("./globals.css", import.meta.url));
const componentsDirectory = fileURLToPath(new URL("../components", import.meta.url));

/**
 * The classes Tailwind compiles to nothing BY DESIGN, because they are markers a
 * variant reads rather than utilities in their own right.
 *
 * `group` and `peer` are the whole list, and they earn their place from the
 * other side of the stylesheet: `group-data-[disabled=true]:pointer-events-none`
 * and `peer-disabled:opacity-50` are what style the element, and they only
 * select anything when an ancestor or a sibling carries the bare marker. So the
 * marker resolving to no CSS is the mechanism working, where `cn-font-heading`
 * resolving to no CSS was a marker whose other half was never written.
 *
 * NAMED FORMS COUNT TOO -- `group/card` is how `card.tsx` distinguishes its own
 * group from an outer one -- so the check is on the name before the slash.
 */
const VARIANT_MARKERS = new Set(["group", "peer"]);

/**
 * The directory a bare specifier's package sits in, found by walking `node_modules`
 * upward from `base`.
 *
 * NODE'S OWN RESOLVER CANNOT BE ASKED THIS. `require.resolve("<id>/package.json")`
 * is the obvious way and it throws `ERR_PACKAGE_PATH_NOT_EXPORTED` for any package
 * whose `exports` map does not publish its manifest -- `tw-animate-css` is one, and
 * it publishes nothing BUT stylesheets, so the packages this has to handle are
 * exactly the ones that refuse the question.
 */
function packageDirectory(id: string, base: string): string {
  for (let directory = base; ; directory = dirname(directory)) {
    const candidate = resolve(directory, "node_modules", id);
    if (existsSync(resolve(candidate, "package.json"))) return candidate;
    if (dirname(directory) === directory) throw new Error(`cannot find \`${id}\` from ${base}`);
  }
}

/**
 * `@import`, resolved the way the real build resolves it.
 *
 * THE `style` CONDITION IS THE WHOLE JOB. A package that ships CSS publishes it
 * under `style` and its JavaScript under `import`, so ordinary resolution answers
 * `@import "tailwindcss"` with `dist/lib.js` -- a module, not a stylesheet, which
 * then fails to parse as CSS somewhere a long way from the cause. Both spellings
 * are in this stylesheet's three imports and both are read: `tailwindcss` puts
 * `style` at the top level of its manifest, `tw-animate-css` puts it inside
 * `exports["."]`, and `shadcn/tailwind.css` names the file outright and needs
 * neither.
 */
async function loadStylesheet(id: string, base: string) {
  const read = (path: string) => ({
    path,
    base: dirname(path),
    content: readFileSync(path, "utf8"),
  });

  if (id.startsWith(".")) return read(resolve(base, id));

  if (id.endsWith(".css")) {
    return read(createRequire(`${base}/`).resolve(id, { paths: [base] }));
  }

  const directory = packageDirectory(id, base);
  const manifest = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8")) as {
    style?: string;
    exports?: { "."?: { style?: string } };
  };
  const style = manifest.style ?? manifest.exports?.["."]?.style;
  if (!style) throw new Error(`\`${id}\` publishes no stylesheet under \`style\``);

  return read(resolve(directory, style));
}

/**
 * The source with any `defaultVariants: { … }` blanked out.
 *
 * BLANKED RATHER THAN CUT because it is the smaller operation, not because any
 * caller holds an offset into the original -- everything downstream reads the
 * string this returns. An earlier comment claimed the offsets mattered; they do
 * not, and a reason that is not true is worse than none.
 *
 * ITS VALUES NAME VARIANTS, NOT CLASSES. `defaultVariants: { variant: "default",
 * size: "default" }` says which row of the `variants` table to start from, and
 * `default` is no more a class than `icon-sm` is. Left in, it is the one place a
 * variant name reaches a class position, and the check reports it as a class that
 * resolves to nothing -- which it does, correctly and uselessly.
 */
function withoutDefaultVariants(source: string): string {
  const at = source.indexOf("defaultVariants");
  if (at === -1) return source;

  const opened = source.indexOf("{", at);
  if (opened === -1) return source;

  let depth = 0;
  for (let scan = opened; scan < source.length; scan++) {
    if (source[scan] === "{") depth++;
    else if (source[scan] === "}" && --depth === 0) {
      const blanked = source.slice(at, scan + 1).replace(/[^\n]/g, " ");
      return withoutDefaultVariants(source.slice(0, at) + blanked + source.slice(scan + 1));
    }
  }

  return source;
}

/**
 * The string literals a call expression holds that are VALUES, at any depth.
 *
 * SCANNED RATHER THAN PARSED, and the balance is tracked rather than the closing
 * paren guessed at, because `cva`'s second argument is an object of nested
 * objects and its variant values are the classes that matter. Quotes are skipped
 * over while balancing so that a `)` inside a class string -- which
 * `[&_svg:not([class*='size-'])]:size-4` has, twice -- does not end the call
 * early and take the rest of its own class list with it.
 *
 * A LITERAL FOLLOWED BY `:` IS A KEY AND IS DROPPED. `cva`'s size table quotes
 * three of its names because they contain a hyphen -- `"icon-xs"`, `"icon-sm"`,
 * `"icon-lg"` -- and a scan that took every literal reported all three as classes
 * resolving to nothing. They are the names of rows, and the rows' VALUES beside
 * them are the classes.
 *
 * A TEMPLATE LITERAL WITH A SUBSTITUTION IS SKIPPED. Half of it is a runtime
 * value, so the class list it produces is not in the file to be read, and
 * treating the literal part as a whole class would report a fragment as broken.
 * This package has none today; the rule is here so that adding one goes
 * unchecked loudly rather than quietly.
 */
function stringLiteralsInCall(source: string, openParen: number): string[] {
  const found: string[] = [];
  let depth = 0;

  for (let at = openParen; at < source.length; at++) {
    const character = source[at];

    if (character === "(") depth++;
    else if (character === ")") {
      depth--;
      if (depth === 0) break;
    } else if (character === '"' || character === "'" || character === "`") {
      const closed = source.indexOf(character, at + 1);
      if (closed === -1) break;
      const literal = source.slice(at + 1, closed);
      const isKey = /^\s*:/.test(source.slice(closed + 1));
      if (!isKey && !(character === "`" && literal.includes("${"))) found.push(literal);
      at = closed;
    }
  }

  return found;
}

/**
 * Every class a module writes, as Tailwind would see it.
 *
 * THE THREE PLACES A CLASS IS WRITTEN IN THIS PACKAGE, read rather than assumed:
 * `className="…"` on an element, a string argument to `cn(…)`, and a string
 * anywhere inside a `cva(…)`. Every `className={` in the package opens a `cn(`,
 * so the braced form needs no case of its own.
 *
 * NARROW ON PURPOSE, WHERE TAILWIND'S OWN EXTRACTOR IS DELIBERATELY WIDE. The
 * scanner the build runs pulls candidates out of any position in a file and lets
 * the ones that mean nothing compile to nothing -- which is right for a build and
 * wrong for this question, because it would hand back `use client`, `label` and
 * every import specifier, and this file would report them all as broken classes.
 */
function classesWrittenIn(module: string): string[] {
  const source = withoutDefaultVariants(module);
  const written: string[] = [];

  for (const { 0: match, index } of source.matchAll(/\b(?:cn|cva)\s*\(/g)) {
    written.push(...stringLiteralsInCall(source, index + match.length - 1));
  }

  for (const [, literal] of source.matchAll(/className="([^"]*)"/g)) {
    written.push(literal ?? "");
  }

  return written.flatMap((literal) => literal.split(/\s+/)).filter(Boolean);
}

/** The package's components, keyed by file name so a failure names the file. */
function theComponents(): Map<string, string> {
  const paths = globSync("*.tsx", { cwd: componentsDirectory }).sort();

  // NON-EMPTINESS AT THE ROOT OF THE CHAIN, as `ui-callers.test.ts` puts it and
  // for the same reason: with no files read, "no class fails to resolve" and "no
  // class was asked about" are the same green.
  if (paths.length === 0) throw new Error(`no component under ${componentsDirectory}`);

  return new Map(
    paths.map((path) => [basename(path), readFileSync(resolve(componentsDirectory, path), "utf8")]),
  );
}

describe("the classes packages/ui writes", () => {
  let design: Awaited<ReturnType<typeof __unstable__loadDesignSystem>>;

  beforeAll(async () => {
    design = await __unstable__loadDesignSystem(readFileSync(stylesheet, "utf8"), {
      base: dirname(stylesheet),
      loadStylesheet,
    });
  });

  /** Those of `classes` that Tailwind compiles to nothing, ignoring the markers. */
  function resolvingToNothing(classes: string[]): string[] {
    const asked = classes.filter((name) => !VARIANT_MARKERS.has(name.split("/")[0] ?? name));
    const compiled = design.candidatesToCss(asked);

    return asked.filter((_, index) => compiled[index] === null);
  }

  /** The unresolved classes of each module, keyed by file, empty entries dropped. */
  function unresolvedByFile(modules: Map<string, string>): Record<string, string[]> {
    const unresolved = new Map<string, string[]>();

    for (const [file, source] of modules) {
      const broken = resolvingToNothing(classesWrittenIn(source));
      if (broken.length > 0) unresolved.set(file, [...new Set(broken)].sort());
    }

    return Object.fromEntries(unresolved);
  }

  /**
   * THE ROLL CALL ITSELF, file by file so that a failure says which component to
   * open rather than handing back one flat list of names.
   */
  it("holds every one of them to compiling to some CSS", () => {
    expect(unresolvedByFile(theComponents())).toStrictEqual({});
  });

  /**
   * AND EVERY MODULE REALLY WAS ASKED, which the row above cannot say either.
   *
   * `theComponents()` throws when it finds no FILES, but nothing guarded the
   * CLASSES: `classesWrittenIn` recognises `className="…"`, a string in `cn(…)`
   * and a string in `cva(…)`, and a component switching to `clsx`, to
   * `className={"…"}` or to a template literal would leave the sweep silently.
   * The roll call would go green having read a file and extracted nothing, which
   * is the one answer this file must never give.
   *
   * DERIVED, NOT A FLOOR: every module here writes at least one class, so the
   * question is asked per file rather than against a total somebody wrote down.
   */
  it("extracts classes from every module, rather than reading one and finding none", () => {
    const empty = [...theComponents()]
      .filter(([, source]) => classesWrittenIn(source).length === 0)
      .map(([file]) => file);

    expect(empty).toStrictEqual([]);
  });

  /**
   * THE RED, DRIVEN RATHER THAN DESCRIBED. The row above passes on an empty map,
   * and an empty map is also what a check that had stopped reading returns.
   *
   * IT GOES THROUGH THE EXTRACTOR, not around it. An earlier version handed the
   * four names straight to `resolvingToNothing`, which proved Tailwind rejects
   * them and proved nothing about the pipeline that has to FIND them -- so a
   * broken extractor would have left this row and the roll call both green. This
   * one puts the markers back into the real `card.tsx`, exactly where CNCORE-261
   * found one of them, and requires all four to come back named.
   *
   * THE MARKERS ARE THE SUBJECT BECAUSE THEY LOOK LIKE UTILITIES. A canary on
   * `zzz-not-a-class` would prove only that Tailwind rejects gibberish; these are
   * names a real vendor emits, which is how they survived review twice.
   */
  it("names the classes that resolve to nothing, which the row above cannot say", () => {
    const markers = ["cn-font-heading", "cn-menu-target", "cn-menu-translucent", "cn-rtl-flip"];
    const modules = theComponents();
    const card = modules.get("card.tsx") ?? "";

    const restored = card.replace(
      '"text-sm font-medium',
      `"${markers.join(" ")} text-sm font-medium`,
    );
    expect(restored, "card.tsx no longer carries the class list this canary edits").not.toBe(card);
    modules.set("card.tsx", restored);

    expect(unresolvedByFile(modules)).toStrictEqual({ "card.tsx": [...markers].sort() });
  });

  /**
   * AND THE MARKERS A VARIANT READS ARE NOT A HOLE IN THE ROW ABOVE. `group` and
   * `peer` are exempted by name, so this requires the exemption to be doing real
   * work -- if Tailwind ever compiled them to something, the list would be worth
   * shrinking rather than carrying.
   */
  it("exempts only markers Tailwind really does compile to nothing", () => {
    const compiled = design.candidatesToCss([...VARIANT_MARKERS]);

    expect(compiled).toStrictEqual(compiled.map(() => null));
  });
});
