import { describe, expect, it } from "vitest";

import { colour, radius } from "./index";

describe("design tokens", () => {
  it("gives every colour a non-empty value in both themes", () => {
    // The type makes a MISSING half a compile error; this catches the half that
    // is present but blank, which renders as nothing at all.
    const blank = Object.entries(colour).filter(
      ([, value]) => !value.light.trim() || !value.dark.trim(),
    );
    expect(blank.map(([name]) => name)).toEqual([]);
  });

  it("expresses radius as a CSS length", () => {
    expect(radius).toMatch(/^[\d.]+(rem|px|em)$/);
  });
});
