import { describe, expect, it } from "vitest";

import {
  asCount,
  ciJobs,
  countStatedIn,
  serversStoodUpByTheHttpSuite,
  serversVia,
  suitesInRepo,
  suitesNamingAConfig,
  vitestConfigs,
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
  {
    file: ".github/workflows/ci.yml",
    pattern: /so the (\w+) jobs this workflow runs cost \$0\.00/g,
    population: "the jobs ci.yml runs",
    derive: ciJobs,
  },
  {
    file: "packages/config/src/network-gate-wiring.test.ts",
    pattern: /comparing (\w+) suites to zero configs/g,
    population: "the suites this repository runs",
    derive: suitesInRepo,
  },
  {
    file: "packages/config/src/network-gate-wiring.test.ts",
    pattern: /of this repo's (\w+) suites run the package's own/g,
    population: "the suites this repository runs",
    derive: suitesInRepo,
  },
  {
    file: "packages/config/src/network-gate-wiring.test.ts",
    pattern: /here: (\w+) of this repo's fifteen suites run the package's own/g,
    population: "the suites that name no config",
    derive: () => suitesInRepo() - suitesNamingAConfig(),
  },
  {
    file: "packages/config/src/network-gate-wiring.test.ts",
    pattern: /the (\w+) that name a config at all are/g,
    population: "the suites that name a config",
    derive: suitesNamingAConfig,
  },
  {
    file: "packages/config/src/network-gate-wiring.test.ts",
    pattern: /only (\w+) of them name a config at all/g,
    population: "the suites that name a config",
    derive: suitesNamingAConfig,
  },
  {
    file: "packages/config/vitest.config.ts",
    pattern: /what the other (\w+) configs are checked against/g,
    population: "the Vitest configs other than this one",
    derive: () => vitestConfigs() - 1,
  },
];

describe("a figure this tree states about itself", () => {
  it("counts the servers `The page over HTTP` stands up", () => {
    expect(serversStoodUpByTheHttpSuite()).toBe(11);
  });

  it("counts the suites this repository runs, and the few that name a config", () => {
    expect(suitesInRepo()).toBe(15);
    expect(suitesNamingAConfig()).toBe(4);
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
