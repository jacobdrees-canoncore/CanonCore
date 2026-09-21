import {
  closeSync,
  existsSync,
  globSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { repoRoot } from "@canoncore/config/testing/repo-root";
import { describe, expect, it } from "vitest";

/**
 * A `"use client"` IN EITHER COMPONENT TREE HAS A REASON BEHIND IT (ADR-0158,
 * ADR-0164).
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
 * ever passed on that ground. CNCORE-276 measured it rather than arguing it, and
 * the client bundle came out byte-for-byte identical with the directive and
 * without it. ADR-0158 owns that measurement -- its population, its date and the
 * command that takes it again -- and this file does not restate the figure,
 * because a figure stated twice drifts in one of them (ADR-0153).
 *
 * WHAT DECIDED IT WAS THE RENDER GRAPH. `dropdown-menu.tsx` has one importer in
 * this repository, `apps/web/src/components/mode-toggle.tsx`, which declares
 * `"use client"` for itself because it calls `useTheme()`. The `onClick` it hands
 * to `DropdownMenuItem` therefore travels client to client and crosses no
 * serialization boundary. A server component may RENDER a client component; what
 * it may not do is PASS it a function, and here no server component does either.
 *
 * THIS FILE COVERS BOTH COMPONENT TREES SINCE CNCORE-283, where it used to cover
 * `packages/ui` and nothing else. `apps/web` is where most of this application's
 * client modules live, and until that ticket no check looked at one of them.
 *
 * THE SECOND GROUND IS A CONJUNCTION, AND NEITHER HALF STANDS ALONE. A module
 * earns the directive by using a client API itself, or by BOTH having an importer
 * that is a server module AND reaching a client boundary below it. Both failures
 * were MEASURED AGAINST THE BUNDLE rather than argued, and ADR-0164 owns the
 * figures:
 *
 * - ON THE IMPORT HALF ALONE `dropdown-menu.tsx` passes. That is the limb
 *   CNCORE-276 deleted, after the bundle came out identical without its directive.
 * - ON THE IMPORTER HALF ALONE `label.tsx` passes, because its four importers are
 *   all server pages -- and restoring its directive measures real bytes. That half
 *   is the whole of the rule CNCORE-283 was filed proposing, so the ticket's own
 *   rule would have greenlit the exact defect ADR-0158 was written for.
 *
 * THE ROWS BELOW KEEP BOTH REFUTATIONS EXECUTABLE rather than in this comment,
 * because a rule stated in prose drifts from the one the code applies.
 *
 * WHICH SETTLED THE CHAIN THIS FILE USED TO CALL UNTIDY, and the check is what
 * said which. `providers.tsx` keeps its directive: `apps/web/src/app/layout.tsx`
 * is a server module and renders through it, and `next-themes` below it needs a
 * browser. `theme-provider.tsx` does not keep one, its only importer being
 * `providers.tsx`, which is already a client module. Removing `theme-provider`'s
 * measured zero in BOTH dimensions -- the client bundle byte-identical and the
 * per-request RSC payload unmoved -- where removing `providers.tsx`'s as well
 * moved both. The boundary belongs where a SERVER module renders through it.
 */

const componentsDirectory = fileURLToPath(new URL(".", import.meta.url));

/**
 * THE COMPONENT TREES THIS CHECK RULES ON (CNCORE-283).
 *
 * `apps/web` is where most of this application's client modules live, and until
 * this ticket no check looked at any of them.
 */
const SWEPT = ["packages/ui/src/components", "apps/web/src/components"];

/**
 * THE TREES THE IMPORTER GRAPH IS BUILT OVER, which are WIDER than the trees
 * ruled on. `providers.tsx`'s only importer is `apps/web/src/app/layout.tsx`, and
 * a sweep that read only the two component directories could not see it -- so the
 * module whose answer the importer graph exists to get right would be the one
 * module the graph had no evidence about.
 */
const GRAPH_ROOTS = ["packages/ui/src", "apps/web/src"];

/** Where each alias this repository writes imports with resolves to. */
const ALIASES: [string, string][] = [
  ["@canoncore/ui/", "packages/ui/src/"],
  ["@/", "apps/web/src/"],
];

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

/**
 * The swept components, keyed by REPOSITORY-RELATIVE PATH so a failure names the
 * file unambiguously -- two trees are read now, and a bare file name would not
 * say which one a failing module came from.
 */
function theComponents(): Map<string, string> {
  const modules = new Map<string, string>();

  for (const root of SWEPT) {
    const directory = resolve(repoRoot, root);
    const paths = globSync("*.tsx", { cwd: directory }).sort();
    if (paths.length === 0) throw new Error(`no component under ${root}`);

    for (const path of paths) {
      modules.set(`${root}/${path}`, readFileSync(resolve(directory, path), "utf8"));
    }
  }

  return modules;
}

/** A file's first bytes, read without pulling the whole file into memory. */
function headOf(path: string, bytes = 200): string {
  const handle = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    return buffer.toString("utf8", 0, readSync(handle, buffer, 0, bytes, 0));
  } finally {
    closeSync(handle);
  }
}

/**
 * Whether a PACKAGE marks a client boundary of its own.
 *
 * READ OFF THE PACKAGE'S OWN FILES rather than assumed from its name. A library
 * of client components declares the directive on the modules that need it, and
 * one that does not is a library this module can render on the server.
 *
 * IT STOPS AT THE FIRST HIT, CAPS THE DIRECTORIES AND READS ONLY EACH FILE'S
 * HEAD, because the question is whether ANY module declares it and a deep
 * `node_modules` tree is the one place a test can accidentally read a hundred
 * megabytes.
 *
 * THAT HEAD IS 200 BYTES, WHICH IS AN ASSUMPTION ABOUT BYTES THIS REPOSITORY
 * DOES NOT OWN. A dist file opening with a licence banner longer than that would
 * hide its directive, the package would read as marking no boundary, and
 * `providers.tsx` would be reported unearned -- a false failure rather than a
 * false pass. What holds it is the row below asserting `next-themes` reads as a
 * boundary: the one package a verdict here currently turns on is checked by
 * name, so the assumption breaking is a named red rather than a silent one.
 *
 * RESOLVED FROM THE IMPORTING MODULE'S OWN DIRECTORY, which is not a detail:
 * pnpm's store is strict, so `next-themes` exists under `apps/web` and nowhere
 * near `packages/ui`. Resolving every specifier from one fixed directory would
 * report a boundary as absent because the package was not installed where the
 * check happened to look.
 */
const boundaryCache = new Map<string, boolean>();

function marksAClientBoundary(id: string, from: string): boolean {
  const key = `${from}\u0000${id}`;
  const cached = boundaryCache.get(key);
  if (cached !== undefined) return cached;

  const answer = readsAClientBoundary(id, from);
  boundaryCache.set(key, answer);
  return answer;
}

function readsAClientBoundary(id: string, from: string): boolean {
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
      if (DIRECTIVE.test(headOf(path))) return true;
    }
  }

  return false;
}

/** The specifiers a module imports for their VALUES, not their types. */
function specifiersOf(source: string): string[] {
  return [...source.matchAll(/^(?:import|export)\s+(type\s+)?[\s\S]*?from\s+["']([^"']+)["']/gm)]
    .filter(([, type]) => type === undefined)
    .map(([, , specifier]) => specifier ?? "");
}

/**
 * The repository module a specifier names, or `null` where it names a package.
 *
 * TEST FILES ARE NOT PART OF THE RENDER GRAPH and are left out of it. A suite
 * importing a component is not a server module rendering one, and counting it as
 * an importer would hand every component a server importer and earn every
 * directive in the repository.
 */
function moduleFor(specifier: string, from: string, graph: Map<string, string>): string | null {
  let base: string | null = null;

  if (specifier.startsWith(".")) {
    base = join(dirname(from), specifier);
  } else {
    for (const [alias, target] of ALIASES) {
      if (specifier.startsWith(alias)) base = specifier.replace(alias, target);
    }
  }
  if (base === null) return null;

  for (const candidate of [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (graph.has(candidate)) return candidate;
  }
  return null;
}

/** Every module in both trees, keyed by repository-relative path. */
function theGraph(): Map<string, string> {
  const graph = new Map<string, string>();

  for (const root of GRAPH_ROOTS) {
    const directory = resolve(repoRoot, root);
    for (const path of globSync("**/*.{ts,tsx}", { cwd: directory }).sort()) {
      if (/\.test\.tsx?$/.test(path)) continue;
      graph.set(`${root}/${path}`, readFileSync(resolve(directory, path), "utf8"));
    }
  }

  return graph;
}

/** The repository modules a module imports. */
function localImportsOf(path: string, graph: Map<string, string>): string[] {
  return specifiersOf(graph.get(path) ?? "")
    .map((specifier) => moduleFor(specifier, path, graph))
    .filter((target): target is string => target !== null);
}

/**
 * Every module that ends up in the CLIENT bundle: the directive's carriers, and
 * everything they import transitively.
 *
 * THIS IS WHAT "A SERVER MODULE" IS THE COMPLEMENT OF. A module without the
 * directive that only a client module imports is compiled into the client bundle
 * anyway, so asking merely whether an importer carries the directive would call
 * it a server module and be wrong.
 */
function clientGraph(graph: Map<string, string>): Set<string> {
  const client = new Set<string>();
  const queue = [...graph].filter(([, source]) => DIRECTIVE.test(source)).map(([path]) => path);

  while (queue.length > 0) {
    const current = queue.pop() ?? "";
    if (client.has(current)) continue;
    client.add(current);
    queue.push(...localImportsOf(current, graph));
  }

  return client;
}

/**
 * Whether anything BELOW a module needs a browser: a repository module carrying
 * the directive, or a package that marks a boundary of its own.
 */
function reachesAClientBoundary(path: string, graph: Map<string, string>): boolean {
  const seen = new Set<string>([path]);
  const queue = [path];

  while (queue.length > 0) {
    const current = queue.pop() ?? "";
    const source = graph.get(current) ?? "";
    const from = dirname(resolve(repoRoot, current));

    for (const specifier of specifiersOf(source)) {
      const target = moduleFor(specifier, current, graph);
      if (target === null) {
        // A SPECIFIER THAT NAMED A REPOSITORY MODULE AND DID NOT RESOLVE IS
        // SKIPPED, and this is the one place this check answers "no" where it
        // means "could not tell". A relative import landing outside the swept
        // trees is a `.css` or a type-only module; a `@canoncore/` one is a
        // workspace package other than `ui`, whose modules are not in the graph.
        //
        // THE LIMIT IS THAT A WORKSPACE PACKAGE DECLARING A BOUNDARY WOULD READ
        // AS NO BOUNDARY, and the verdict that follows is a FALSE UNEARNED --
        // the failure direction this whole check exists to avoid. It is
        // tolerable only because `@canoncore/ui` is the one package here holding
        // components and it IS in the graph, aliased; the rest are server
        // packages with no React in them. A client component appearing in one of
        // them is the day this needs the alias list extended rather than this
        // comment re-read.
        if (specifier.startsWith(".") || specifier.startsWith("@canoncore/")) continue;
        if (marksAClientBoundary(specifier, from)) return true;
        continue;
      }
      // A repository module carrying the directive is a boundary in its own right,
      // whether it sits directly below the subject or further down the chain.
      if (DIRECTIVE.test(graph.get(target) ?? "")) return true;
      if (!seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }

  return false;
}

/**
 * Those of `modules` that declare the directive with nothing behind it.
 *
 * TWO GROUNDS EARN ONE, AND THE SECOND IS A CONJUNCTION (CNCORE-283, ADR-0164).
 * A module earns the directive by using a client API itself, or by BOTH reaching
 * a client boundary below it AND having an importer that is a server module.
 *
 * NEITHER HALF OF THAT CONJUNCTION WORKS ALONE, and both failures are measured
 * rather than argued. On the import half alone `dropdown-menu.tsx` passes, which
 * is the limb CNCORE-276 deleted after the bundle came out identical without it.
 * On the importer half alone `label.tsx` passes -- its four importers are all
 * server pages -- and restoring its directive costs real bytes (ADR-0164 has the
 * figure), the founding defect of ADR-0158 walking back in through the check
 * written to catch it.
 */
function importersWithin(graph: Map<string, string>): Map<string, string[]> {
  const importers = new Map<string, string[]>();

  for (const path of graph.keys()) {
    for (const target of localImportsOf(path, graph)) {
      importers.set(target, [...(importers.get(target) ?? []), path]);
    }
  }

  return importers;
}

/**
 * The graph a module is judged against, and the two facts read off it.
 *
 * THE SUBJECT'S OWN SOURCE GOES OVER THE REPOSITORY'S, so a row can hand in
 * `label.tsx` with its directive put back and have the whole graph judged as if
 * that were the tree. Derived once here rather than in each caller, because the
 * client closure and the importer map are two readings of one walk.
 */
function judgeAgainst(modules: Map<string, string>): {
  graph: Map<string, string>;
  client: Set<string>;
  importers: Map<string, string[]>;
} {
  const graph = new Map(theGraph());
  for (const [path, source] of modules) graph.set(path, source);

  return { graph, client: clientGraph(graph), importers: importersWithin(graph) };
}

/**
 * The importers of a module that are SERVER modules.
 *
 * This is the whole of the ground CNCORE-283 was filed proposing, and the row
 * that reads it is the row proving that ground is not enough on its own.
 */
function serverImportersOf(path: string, modules: Map<string, string>): string[] {
  const { client, importers } = judgeAgainst(modules);
  return (importers.get(path) ?? []).filter((one) => !client.has(one)).sort();
}

function unearnedDirectives(modules: Map<string, string>): string[] {
  const { graph, client, importers } = judgeAgainst(modules);

  return [...modules]
    .filter(([path, source]) => {
      if (!DIRECTIVE.test(source)) return false;
      if (usesAClientApiDirectly(source)) return false;

      const hasAServerImporter = (importers.get(path) ?? []).some((one) => !client.has(one));
      return !(hasAServerImporter && reachesAClientBoundary(path, graph));
    })
    .map(([path]) => path)
    .sort();
}

describe('the "use client" directives in packages/ui and apps/web', () => {
  /**
   * THE ROLL CALL ITSELF. `label.tsx` failed this the day it was written, and the
   * next primitive vendored from a registry that ships the directive fails it on
   * arrival rather than after it has shipped a chunk to a browser.
   *
   * IT PASSES ON AN EMPTY SET, AND NO LONGER BECAUSE THE SET IS EMPTY. While this
   * file swept `packages/ui` alone, an empty list meant what it looked like: no
   * module there has carried the directive since CNCORE-276. Since CNCORE-283 it
   * sweeps `apps/web/src/components` as well, where modules DO carry one and
   * every one of them is judged EARNED -- so the empty list is a verdict now
   * rather than an absence. That is why the two rows below exist: an empty list
   * is also what a check that had stopped reading returns.
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
    const label = modules.get("packages/ui/src/components/label.tsx");
    expect(label, "label.tsx has moved or been renamed").toBeDefined();
    expect(DIRECTIVE.test(label ?? ""), "label.tsx still carries the directive").toBe(false);

    modules.set("packages/ui/src/components/label.tsx", `"use client";\n\n${label}`);

    expect(unearnedDirectives(modules)).toStrictEqual(["packages/ui/src/components/label.tsx"]);
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
    const dropdown = modules.get("packages/ui/src/components/dropdown-menu.tsx");
    expect(dropdown, "dropdown-menu.tsx has moved or been renamed").toBeDefined();
    expect(
      DIRECTIVE.test(dropdown ?? ""),
      "dropdown-menu.tsx still carries the directive CNCORE-276 removed",
    ).toBe(false);

    modules.set("packages/ui/src/components/dropdown-menu.tsx", `"use client";\n\n${dropdown}`);

    expect(unearnedDirectives(modules)).toStrictEqual([
      "packages/ui/src/components/dropdown-menu.tsx",
    ]);
  });

  /**
   * THE SWEEP REACHES BOTH TREES (CNCORE-283). Most of this application's client
   * modules live in `apps/web`, and until this ticket no check looked at them.
   */
  it("sweeps apps/web's components as well as this package's", () => {
    const swept = [...theComponents().keys()];

    expect(swept).toContain("packages/ui/src/components/label.tsx");
    expect(swept).toContain("apps/web/src/components/providers.tsx");
  });

  /**
   * THE MODULE THIS TICKET REMOVED THE DIRECTIVE FROM, if it ever comes back.
   *
   * `theme-provider.tsx` is the half of the chain that was redundant: its only
   * importer is `providers.tsx`, which is already a client module, so the
   * directive here marked a boundary already crossed one level up. Removing it
   * measured zero in BOTH dimensions -- the client bundle stayed byte-identical
   * and the per-request RSC payload did not move -- which ADR-0164 owns.
   */
  it("names theme-provider.tsx's directive if it ever comes back", () => {
    const modules = theComponents();
    const path = "apps/web/src/components/theme-provider.tsx";
    const themeProvider = modules.get(path);
    expect(themeProvider, "theme-provider.tsx has moved or been renamed").toBeDefined();
    expect(DIRECTIVE.test(themeProvider ?? ""), "it still carries the directive").toBe(false);

    modules.set(path, `"use client";\n\n${themeProvider}`);

    expect(unearnedDirectives(modules)).toStrictEqual([path]);
  });

  /**
   * AND THE MODULE THAT KEEPS ITS DIRECTIVE, with the two facts that earn it.
   *
   * `providers.tsx` is what the server component `apps/web/src/app/layout.tsx`
   * renders, and the boundary this application declares is the one it declares
   * THERE. It holds no client API of its own, so it earns the directive on the
   * conjunction: a server module renders through it, and something below it --
   * `next-themes`, by way of `theme-provider.tsx` -- needs a browser.
   *
   * BOTH HALVES ARE ASSERTED rather than just the verdict, because the verdict
   * alone would go on passing if one half quietly stopped being true.
   */
  it("earns providers.tsx its directive on a server importer and a boundary below", () => {
    const modules = theComponents();
    const path = "apps/web/src/components/providers.tsx";
    expect(DIRECTIVE.test(modules.get(path) ?? ""), "providers.tsx carries the directive").toBe(
      true,
    );

    expect(serverImportersOf(path, modules)).toStrictEqual(["apps/web/src/app/layout.tsx"]);
    expect(reachesAClientBoundary(path, judgeAgainst(modules).graph)).toBe(true);
    expect(unearnedDirectives(modules)).not.toContain(path);
  });

  /**
   * THE ROW THAT REFUTES THE RULE THIS TICKET WAS FILED PROPOSING (CNCORE-283).
   *
   * CNCORE-283 specified one ground: a directive earned by a direct client API,
   * OR by the module having an importer that is itself a server module. Run over
   * `apps/web` that is right about the chain and WRONG about the primitives, and
   * `label.tsx` is the proof -- its importers are four server pages, so the
   * proposed rule would have earned its directive and greenlit the exact defect
   * ADR-0158 was written for, and restoring it costs bytes ADR-0164 measured.
   *
   * SO THE SECOND GROUND IS A CONJUNCTION, and this row holds it to that by
   * asserting the half that would have passed alongside the verdict that refuses
   * it. A rule stated in a comment drifts; a rule with its counterexample
   * executed does not.
   */
  it("refuses the importer graph alone, which would have earned label.tsx's", () => {
    const modules = theComponents();
    const path = "packages/ui/src/components/label.tsx";
    const label = modules.get(path);
    expect(label, "label.tsx has moved or been renamed").toBeDefined();

    modules.set(path, `"use client";\n\n${label}`);

    // The ground CNCORE-283 proposed: every one of its importers is a server
    // module, so that rule earns it. NAMED RATHER THAN COUNTED, because the
    // argument in ADR-0164 rests on WHICH modules these are -- four route
    // entries, none of them reachable from a client boundary.
    expect(serverImportersOf(path, modules)).toStrictEqual([
      "apps/web/src/app/groups/page.tsx",
      "apps/web/src/app/items/[id]/page.tsx",
      "apps/web/src/app/login/page.tsx",
      "apps/web/src/app/new/page.tsx",
    ]);
    // The ground it is actually held to: nothing below it needs a browser.
    expect(reachesAClientBoundary(path, judgeAgainst(modules).graph)).toBe(false);
    expect(unearnedDirectives(modules)).toContain(path);
  });

  /**
   * AND THE BOUNDARY IS READ OUT OF A PACKAGE'S FILES, NOT OUT OF ITS NAME.
   *
   * `next-themes` is what makes `providers.tsx` earn its directive, so if that
   * package stopped declaring one the row above would start failing; this says so
   * in one line rather than leaving the next reader to find out by watching an
   * unrelated test go red.
   *
   * RESOLVED FROM THE IMPORTING TREE, which is the part pnpm makes load-bearing:
   * `next-themes` is installed under `apps/web` and not under this package.
   */
  it("reads a client boundary out of an imported package, not out of its name", () => {
    const web = resolve(repoRoot, "apps/web/src/components");

    expect(marksAClientBoundary("next-themes", web)).toBe(true);
    expect(marksAClientBoundary("@base-ui/react/menu", componentsDirectory)).toBe(true);
    expect(marksAClientBoundary("class-variance-authority", componentsDirectory)).toBe(false);
  });
});
