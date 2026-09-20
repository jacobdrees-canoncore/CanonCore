import { describe, expect, it } from "vitest";

import {
  asCount,
  countStatedIn,
  serversStoodUpByTheHttpSuite,
  serversVia,
} from "./testing/tree-figures";

/**
 * A claim this tree makes about itself, and the count that settles it.
 */
type Claim = {
  readonly file: string;
  readonly pattern: RegExp;
  readonly population: string;
  readonly derive: () => number;
};

const CLAIMS: Claim[] = [
  {
    file: ".github/workflows/ci.yml",
    pattern: /not the (\w+) `The page over HTTP` stands up/g,
    population: "the servers `The page over HTTP` stands up",
    derive: serversStoodUpByTheHttpSuite,
  },
  {
    file: "apps/web/vitest.browser.config.ts",
    pattern: /`e2e` stands up (\w+) instances/g,
    population: "the servers `The page over HTTP` stands up",
    derive: serversStoodUpByTheHttpSuite,
  },
  {
    file: "apps/web/browser/global-setup.ts",
    pattern: /rather than the page seam's (\w+):/g,
    population: "the servers `The page over HTTP` stands up",
    derive: serversStoodUpByTheHttpSuite,
  },
  {
    file: "apps/web/e2e/instance.ts",
    pattern: /the page seam stands up (\w+) instances off ONE build/g,
    population: "the servers `The page over HTTP` stands up",
    derive: serversStoodUpByTheHttpSuite,
  },
  {
    file: "apps/web/e2e/instance.ts",
    pattern: /a helper that built per instance would build (\w+) times/g,
    population: "the servers `The page over HTTP` stands up",
    derive: serversStoodUpByTheHttpSuite,
  },
  {
    file: "apps/web/e2e/instance.ts",
    pattern: /(\w+) of this suite's servers are started by `anInstanceServing`/g,
    population: "the servers started through `anInstanceServing`",
    derive: () => serversVia("anInstanceServing"),
  },
  {
    file: "apps/web/e2e/instance.ts",
    pattern: /and the (\w+) -- the fresh install/g,
    population: "the servers `The page over HTTP` stands up",
    derive: serversStoodUpByTheHttpSuite,
  },
  {
    file: "apps/web/e2e/global-setup.ts",
    pattern: /this file starts ELEVEN, (\w+) through `anInstanceServing`/g,
    population: "the servers started through `anInstanceServing`",
    derive: () => serversVia("anInstanceServing"),
  },
];

describe("a figure this tree states about itself", () => {
  it("counts the servers `The page over HTTP` stands up", () => {
    expect(serversStoodUpByTheHttpSuite()).toBe(11);
  });

  it("reads a count written as a word", () => {
    expect(asCount("seven")).toBe(7);
    expect(asCount("ELEVEN")).toBe(11);
  });

  it("is stated in the tree as the tree counts it", () => {
    const wrong = CLAIMS.flatMap((claim) => {
      const stated = countStatedIn(claim.file, claim.pattern);
      const derived = claim.derive();
      return stated === derived
        ? []
        : [`${claim.file} states ${stated} for ${claim.population}; the tree holds ${derived}`];
    });
    expect(wrong).toStrictEqual([]);
  });
});
