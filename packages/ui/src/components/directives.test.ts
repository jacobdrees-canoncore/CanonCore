import { globSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * A `"use client"` IN THIS PACKAGE HAS A REASON IN THE MODULE THAT CARRIES IT
 * (ADR-0158).
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
 * `"use client"` it carried until then bought nothing."
 *
 * THE RULE IS DERIVED, NOT LISTED, which is ADR-0153's preference and the
 * difference between a check and a note. A list of the modules allowed to carry
 * the directive would pass forever by being edited whenever it failed. This asks
 * the module instead: does anything in it actually need a browser?
 *
 * THE RULE USED TO HAVE A SECOND, WEAKER LIMB, AND CNCORE-276 DELETED IT. A
 * module was also allowed the directive when a package it imported marked a
 * client boundary of its own, and `dropdown-menu.tsx` was the only module that
 * ever passed on that ground. CNCORE-276 measured it rather than arguing it:
 * `apps/web` built clean three times, and the client bundle came to 930,306
 * bytes with the directive and 930,306 without, every content-addressed chunk
 * byte-identical. The directive bought nothing, so it went, and with it the limb
 * that was only ever keeping it.
 *
 * WHAT DECIDED IT WAS THE RENDER GRAPH. `dropdown-menu.tsx` has one importer in
 * this repository, `apps/web/src/components/mode-toggle.tsx`, which declares
 * `"use client"` for itself because it calls `useTheme()`. The `onClick` it hands
 * to `DropdownMenuItem` therefore travels client to client and crosses no
 * serialization boundary. A server component may RENDER a client component; what
 * it may not do is PASS it a function, and here no server component does either.
 *
 * THIS FILE COVERS `packages/ui` AND NOTHING ELSE, which is a boundary rather
 * than an oversight. Inside this package the rule above is complete: every
 * component here is a primitive, and no module in it carries the directive at
 * all since CNCORE-276.
 *
 * ONE DIRECTORY OVER THE SAME RULE WOULD FIRE FALSELY, and the counterexample is
 * named here so the next reader does not have to rediscover it.
 * `apps/web/src/components/theme-provider.tsx` carries the directive and holds no
 * hook, no bound handler and no browser global -- it spreads props onto
 * `next-themes`' provider and nothing else, which is exactly the shape
 * `dropdown-menu.tsx` had. Its answer is the opposite one, because
 * `apps/web/src/app/layout.tsx` is a SERVER component and reaches `next-themes`
 * through it. Something in that chain has to declare the boundary and that module
 * is where it lands, so its reason is the render graph rather than anything a
 * reader could find inside the file.
 *
 * WHAT SEPARATES THE TWO IS NOT WHAT THEY IMPORT, IT IS WHO IMPORTS THEM, and a
 * check that asked the importer graph would judge both correctly. CNCORE-283 is
 * open on building it and on extending the sweep to `apps/web`; until it lands,
 * pointing this check at that directory would report `theme-provider.tsx` as
 * unearned and be wrong.
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
  // A handler BOUND here, not one merely declared in a props type. `onClick={fn}`
  // and `onClick: () => …` are bindings; `onClick: () => void` in an interface is
  // a type, and matching it would hand a module a reason it does not have -- a
  // false pass in the permissive direction, which is the one that matters.
  /\bon[A-Z]\w*=\{/,
  /\bon[A-Z]\w*:\s*(?:\(|function\b|[A-Za-z_$][\w$]*\s*(?:,|\)|$))/m,
  /\b(?:window|document|localStorage|sessionStorage|navigator)\s*\./,
];

/** Whether the module itself does something only a browser can do. */
function usesAClientApiDirectly(source: string): boolean {
  return CLIENT_API.some((pattern) => pattern.test(source));
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
    .filter(([, source]) => DIRECTIVE.test(source) && !usesAClientApiDirectly(source))
    .map(([file]) => file)
    .sort();
}

describe('the "use client" directives in packages/ui', () => {
  /**
   * THE ROLL CALL ITSELF. `label.tsx` failed this the day it was written, and the
   * next primitive vendored from a registry that ships the directive fails it on
   * arrival rather than after it has shipped a chunk to a browser.
   *
   * IT PASSES ON AN EMPTY SET SINCE CNCORE-276, because no module in this package
   * carries the directive any more. That is why the two rows below exist: an
   * empty list is also what a check that had stopped reading returns.
   */
  it("holds every one of them to a reason in the module that carries it", () => {
    expect(unearnedDirectives(theComponents())).toStrictEqual([]);
  });

  /**
   * THE RED, DRIVEN RATHER THAN DESCRIBED.
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
   * THE SAME RED, FOR THE MODULE CNCORE-276 REMOVED THE DIRECTIVE FROM.
   *
   * This is the row that would have gone quietly green under the old rule and is
   * the reason the weaker limb is gone: `dropdown-menu.tsx` imports
   * `@base-ui/react/menu`, which declares client boundaries of its own, so the
   * import-graph limb granted it a reason it did not need. With that limb deleted
   * the module is judged on itself, and it holds no state, no effect and no
   * handler -- every one of its components spreads props onto a base-ui
   * primitive.
   *
   * SO THE DIRECTIVE COMING BACK IS A FAILURE, not a matter of taste, and the
   * bundle measurement in this file's header is what stands behind that.
   */
  it("names the directive CNCORE-276 removed, if it ever comes back", () => {
    const modules = theComponents();
    const dropdown = modules.get("dropdown-menu.tsx");
    expect(dropdown, "dropdown-menu.tsx has moved or been renamed").toBeDefined();
    expect(
      DIRECTIVE.test(dropdown ?? ""),
      "dropdown-menu.tsx still carries the directive CNCORE-276 removed",
    ).toBe(false);

    modules.set("dropdown-menu.tsx", `"use client";\n\n${dropdown}`);

    expect(unearnedDirectives(modules)).toStrictEqual(["dropdown-menu.tsx"]);
  });
});
