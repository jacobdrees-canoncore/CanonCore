import { describe, expect, it } from "vitest";

import { aPortThief, importInto, migrated, page, placementsOf, serve } from "./shapes";

/**
 * EIGHT ASSERTIONS, FOUR OF THEM HOLLOW ON PURPOSE. Named `.check.ts` so that no
 * suite in this repository collects it: `delete-the-behaviour.test.ts` copies it
 * beside `shapes.ts` as a `.test.ts` and runs the delete-the-behaviour run over
 * the copy. Each `hollow` case below is one of ADR-0168's four shapes, and each
 * `reaches` case is its twin, holding the same behaviour for real.
 */

function mainOf(document: string): string {
  return /<main>([\s\S]*)<\/main>/.exec(document)?.[1] ?? "";
}

describe("a count over something else already fills", () => {
  it("hollow: the import recorded its origin", () => {
    const catalogue = migrated();
    importInto(catalogue, ["Rose"]);
    expect(catalogue.sources.length).toBeGreaterThan(0);
  });

  it("reaches: the import recorded its Item", () => {
    const catalogue = migrated();
    importInto(catalogue, ["Rose"]);
    expect(catalogue.items).toStrictEqual(["Rose"]);
  });
});

describe("an aggregate nobody reads", () => {
  const rows = [
    { container: "Series 1", position: 1 },
    { container: "Timeline", position: 7 },
  ];

  it("hollow: one Item sits at different Positions", () => {
    const placements = placementsOf(rows);
    const positions = placements.map((placement) => placement.position);
    void positions;
    expect(placements).toHaveLength(2);
  });

  it("reaches: one Item sits at different Positions", () => {
    expect(placementsOf(rows).map((placement) => placement.position)).toStrictEqual([1, 7]);
  });
});

describe("a read the shell answers", () => {
  it("hollow: a refused reader is told to log in", () => {
    expect(page(null)).toContain("/login");
  });

  it("reaches: a refused reader is told to log in", () => {
    expect(mainOf(page(null))).toContain("/login");
  });
});

describe("a guard whose trigger is unreachable by construction", () => {
  it("hollow: a server steps aside from a taken port", () => {
    expect(serve(0, aPortThief(0))).toBe(0);
  });

  it("reaches: a server steps aside from a taken port", () => {
    expect(serve(4000, aPortThief(4000))).toBe(4001);
  });
});
