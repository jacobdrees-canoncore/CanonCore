import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * A `"use client"` IN THIS PACKAGE HAS A REASON IN THE MODULE THAT CARRIES IT.
 *
 * `label.tsx` carried one until CNCORE-261 and rendered a bare `<label>` with no
 * state, effect, handler, ref or browser API behind it. The cost is not
 * theoretical: measured on `/login`, the compiled `Label` was served in a client
 * chunk -- 671 bytes plus `cn` and the jsx runtime, measured against the running
 * install on 2026-09-20 -- to render markup the server had already sent.
 *
 * IT IS REGISTRY RESIDUE, WHICH IS WHY A CHECK BEATS CARE. shadcn's
 * `base-lyra/label.json` ships the directive and the CLI keeps it when
 * `rsc: true`, so the defect arrives with the primitive rather than being
 * introduced by anybody, and it arrives again the next time one is added.
 * `header.tsx` records removing the same thing under CNCORE-139: "the
 * `\"use client\"` it carried until then bought nothing."
 *
 * THE RULE IS DERIVED, NOT LISTED, which is ADR-0153's preference and the
 * difference between a check and a note. A list of the modules allowed to carry
 * the directive would pass forever by being edited whenever it failed. This asks
 * the tree instead: does anything in this module, or in a package it imports,
 * actually need a browser?
 *
 * WHAT IT DOES NOT ASK, said here rather than left to be found: whether a module
 * that HAS a reason genuinely needs the directive. A component importing a client
 * library may still be fine as a server component if it only passes props
 * through -- `dropdown-menu.tsx` is that shape, since `@base-ui/react/menu` marks
 * its own boundary -- and deciding that needs the render graph rather than the
 * import graph. CNCORE-276 carries it. The question here is the cheaper half: a
 * directive with NOTHING behind it.
 */

const componentsDirectory = fileURLToPath(new URL(".", import.meta.url));

/** The directive, as the first thing in the file that is not a comment or blank. */
const DIRECTIVE = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/;

/**
 * What makes a module client-only in its own right.
 *
 * A HOOK CALL, A HANDLER, OR A BROWSER GLOBAL. Each is a thing React will refuse
 * to render on the server, so any one of them is a reason the directive exists
 * rather than a sign that it might.
 */
const CLIENT_API = [
  /\buse[A-Z]\w*\s*\(/, // a hook call: useState(, useTheme(, useId(
  /\bon[A-Z]\w*\s*[=:]/, // a handler bound here: onClick=, onOpenChange:
  /\b(?:window|document|localStorage|sessionStorage|navigator)\s*\./,
];

/** Bare package specifiers a module imports for their VALUES, not their types. */
function packagesImportedBy(source: string): string[] {
  const specifiers = [...source.matchAll(/^import\s+(type\s+)?[\s\S]*?from\s+["']([^"']+)["']/gm)]
    .filter(([, type]) => type === undefined)
    .map(([, , specifier]) => specifier ?? "");

  // `@canoncore/*` is this repository, whose modules are the subject rather than
  // the evidence, and a relative import is a sibling this sweep already reads.
  return specifiers.filter((id) => !id.startsWith(".") && !id.startsWith("@canoncore/"));
}

/**
 * Whether a package marks a client boundary of its own.
 *
 * READ OFF THE PACKAGE'S OWN FILES rather than assumed from its name. A library
 * of client components declares the directive on the modules that need it -- and
 * one that does not is a library this module can render on the server. The
 * boolean is derived on every run, so no count of which files carry it is written
 * down here to go stale (ADR-0153).
 *
 * IT STOPS AT THE FIRST HIT AND CAPS THE WALK, because the question is whether
 * ANY module declares it and a deep `node_modules` tree is the one place a test
 * can accidentally read a hundred megabytes.
 */
function marksAClientBoundary(id: string, from: string): boolean {
  let directory: string;
  try {
    directory = dirname(createRequire(`${from}/`).resolve(id, { paths: [from] }));
  } catch {
    return false;
  }

  const seen: string[] = [directory];
  for (let index = 0; index < seen.length && index < 200; index++) {
    const current = seen[index] ?? "";
    for (const entry of globSync("*", { cwd: current })) {
      const path = join(current, entry);
      if (!existsSync(path)) continue;
      if (statSync(path).isDirectory()) {
        if (entry !== "node_modules") seen.push(path);
        continue;
      }
      if (!/\.(?:mjs|cjs|js)$/.test(entry)) continue;
      if (DIRECTIVE.test(readFileSync(path, "utf8").slice(0, 200))) return true;
    }
  }

  return false;
}

/** Whether a module has any reason at all to be a client module. */
function hasAClientReason(source: string): boolean {
  if (CLIENT_API.some((pattern) => pattern.test(source))) return true;

  return packagesImportedBy(source).some((id) => marksAClientBoundary(id, componentsDirectory));
}

/** The package's components, keyed by file name so a failure names the file. */
function theComponents(): Map<string, string> {
  const paths = globSync("*.tsx", { cwd: componentsDirectory }).sort();
  if (paths.length === 0) throw new Error(`no component under ${componentsDirectory}`);

  return new Map(
    paths.map((path) => [basename(path), readFileSync(resolve(componentsDirectory, path), "utf8")]),
  );
}

/** Those of `modules` that declare the directive with nothing behind it. */
function unearnedDirectives(modules: Map<string, string>): string[] {
  return [...modules]
    .filter(([, source]) => DIRECTIVE.test(source) && !hasAClientReason(source))
    .map(([file]) => file)
    .sort();
}

describe("the \"use client\" directives in packages/ui", () => {
  /**
   * THE ROLL CALL ITSELF. `label.tsx` failed this the day it was written, and the
   * next primitive vendored from a registry that ships the directive fails it on
   * arrival rather than after it has shipped a chunk to a browser.
   */
  it("holds every one of them to a reason in the module that carries it", () => {
    expect(unearnedDirectives(theComponents())).toStrictEqual([]);
  });

  /**
   * THE RED, DRIVEN RATHER THAN DESCRIBED. The row above passes on an empty list,
   * and an empty list is also what a check that had stopped reading returns.
   *
   * THE SUBJECT IS BUILT FROM THE REAL `label.tsx`, not from a fixture written to
   * fail: its source with the directive put back is exactly the state CNCORE-261
   * found, so what this proves is that the check would have caught the thing it
   * was written for.
   */
  it("names a module whose directive buys nothing, which the row above cannot say", () => {
    const modules = theComponents();
    const label = modules.get("label.tsx");
    expect(label, "label.tsx has moved or been renamed").toBeDefined();
    expect(DIRECTIVE.test(label ?? ""), "label.tsx still carries the directive").toBe(false);

    modules.set("label.tsx", `"use client";\n\n${label}`);

    expect(unearnedDirectives(modules)).toStrictEqual(["label.tsx"]);
  });

  /**
   * AND THE REASON IS READ FROM THE TREE RATHER THAN GRANTED. `dropdown-menu.tsx`
   * keeps its directive because `@base-ui/react/menu` marks a client boundary of
   * its own; if that stopped being true the row above would start failing, and
   * this says so in one line rather than leaving the next reader to find out by
   * watching an unrelated test go red.
   */
  it("reads a client boundary out of an imported package, not out of its name", () => {
    expect(marksAClientBoundary("@base-ui/react/menu", componentsDirectory)).toBe(true);
    expect(marksAClientBoundary("class-variance-authority", componentsDirectory)).toBe(false);
  });
});
