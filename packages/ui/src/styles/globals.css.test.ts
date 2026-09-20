import { globSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { colour, radius } from "@canoncore/tokens";
import { describe, expect, it } from "vitest";

const stylesheet = fileURLToPath(new URL("./globals.css", import.meta.url));
const css = readFileSync(stylesheet, "utf8");

/** `--primary-foreground` in CSS is `primaryForeground` in TypeScript. */
function camelCase(property: string): string {
  const [head = "", ...rest] = property.split("-");
  return head + rest.map((word) => (word[0] ?? "").toUpperCase() + word.slice(1)).join("");
}

/**
 * The custom properties declared in one top-level rule, keyed by their
 * TypeScript name. Takes a literal CSS selector: it is escaped here, so no
 * caller has to remember to, and it is anchored to the start of a line so that
 * `.dark` cannot match `.sidebar-dark {`.
 */
function customProperties(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`^${escaped}\\s*\\{(.*?)\\n\\}`, "ms").exec(css);
  if (!block?.[1]) throw new Error(`no \`${selector}\` block in globals.css`);

  const declared: Record<string, string> = {};
  for (const [, name, value] of block[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    if (name && value) declared[camelCase(name)] = value.trim();
  }
  return declared;
}

describe("globals.css against @canoncore/tokens", () => {
  // A stylesheet cannot import TypeScript, so the same values are written in
  // both places. That is only safe while something fails when they disagree.
  const light = customProperties(":root");
  const dark = customProperties(".dark");

  it("declares exactly the colours the tokens define, in :root", () => {
    const { radius: _radius, ...colours } = light;
    expect(Object.keys(colours).sort()).toEqual(Object.keys(colour).sort());
  });

  it("declares exactly the colours the tokens define, in .dark", () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(colour).sort());
  });

  it("matches every light value", () => {
    for (const [name, value] of Object.entries(colour)) {
      expect(light[name], `--${name} in :root`).toBe(value.light);
    }
  });

  it("matches every dark value", () => {
    for (const [name, value] of Object.entries(colour)) {
      expect(dark[name], `--${name} in .dark`).toBe(value.dark);
    }
  });

  it("matches the radius", () => {
    expect(light.radius).toBe(radius);
  });
});

/**
 * The globs `globals.css` hands Tailwind, in the order they are written.
 *
 * `@source` IS RESOLVED AGAINST THE DIRECTORY OF THE STYLESHEET, not against the
 * working directory, which is the whole reason this check exists: a glob one `..`
 * short still parses, still builds, and quietly scans nothing.
 */
function sourceGlobs(sheet: string): string[] {
  return [...sheet.matchAll(/@source\s+"([^"]+)"\s*;/g)].map(([, glob]) => glob ?? "");
}

/** Those of them that match no file at all. */
function matchingNothing(sheet: string): string[] {
  return sourceGlobs(sheet).filter((glob) => globSync(glob, { cwd: dirname(stylesheet) }).length === 0);
}

/**
 * EVERY `@source` IN THE STYLESHEET POINTS AT FILES THAT EXIST.
 *
 * `globals.css:4` read `@source "../../../apps/**\/*.{ts,tsx}"` until CNCORE-261.
 * From `packages/ui/src/styles`, three `..` is `packages/`, so the glob was
 * `packages/apps/**` -- a directory this repository has never had. It matched
 * zero files, and the line a reader takes to be what puts the app's classes in
 * the stylesheet contributed nothing: the app was styled by
 * `@tailwindcss/postcss` falling back to `base = e.base ?? process.cwd()`, with
 * Next running from `apps/web`.
 *
 * NOTHING FAILS WHEN A GLOB GOES STALE, which is why this is worth a test rather
 * than a careful reading. Tailwind does not warn about an `@source` that matches
 * nothing -- there is no legitimate way to tell a typo from a directory a
 * consumer has not created yet -- so the only signal is a missing utility in a
 * stylesheet nobody diffs.
 *
 * NODE'S OWN GLOB RATHER THAN TAILWIND'S SCANNER, and the numbers were checked
 * against the scanner before choosing. `@tailwindcss/oxide@4.3.3`, which is what
 * the build actually runs, returns 0, 10 and 91 for the three globs at issue;
 * `node:fs`'s `globSync` returns 0, 10 and 91. Asking the question through a
 * package Tailwind treats as internal would mean pinning its version in the
 * catalogue beside the `tailwindcss` that already owns it, to learn the same
 * answer.
 */
describe("globals.css's @source globs", () => {
  it("holds every one of them to matching a file", () => {
    expect(sourceGlobs(css).length).toBeGreaterThan(0);
    expect(matchingNothing(css)).toStrictEqual([]);
  });

  /**
   * THE RED, DRIVEN RATHER THAN DESCRIBED. The row above passes on an empty list,
   * and an empty list is also what a check that had stopped asking returns. This
   * one puts the defect back -- the real stylesheet with one `..` taken off the
   * app glob, which is exactly the state CNCORE-261 found -- and requires it to
   * be named.
   */
  it("names a glob that matches nothing, which the row above cannot say", () => {
    const shortByOne = css.replace('@source "../../../../apps/', '@source "../../../apps/');
    expect(shortByOne, "the app glob is not spelled as this canary expects").not.toBe(css);

    expect(matchingNothing(shortByOne)).toStrictEqual(["../../../apps/**/*.{ts,tsx}"]);
  });
});
