import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { colour, radius } from "@canoncore/tokens";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

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
