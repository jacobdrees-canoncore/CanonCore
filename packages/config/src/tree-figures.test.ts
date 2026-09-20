import { describe, expect, it } from "vitest";

import {
  asCount,
  ciJobs,
  countStatedIn,
  handBuiltRedirectsIn,
  jobsRequestingANodeMajor,
  migrationRungs,
  procedureAnswerCallSites,
  propertiesSeededByMigrationOne,
  serversStoodUpByTheHttpSuite,
  serversVia,
  suitesInRepo,
  suitesNamingAConfig,
  suitesReadingTheRepository,
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
    file: "packages/config/src/node-major.test.ts",
    pattern: /which only exists while the (\w+) jobs agree/g,
    population: "the jobs that ask pnpm/setup for a Node major",
    derive: jobsRequestingANodeMajor,
  },
  {
    file: "packages/config/src/turbo-cache-inputs.test.ts",
    pattern: /([\w-]+) suites here read the repository at large/g,
    population: "the suites in packages/config that read the repository at large",
    derive: suitesReadingTheRepository,
  },
  {
    file: "packages/config/src/turbo-cache-inputs.test.ts",
    pattern: /holds ([\w-]+) suites reading the repository at large/g,
    population: "the suites in packages/config that read the repository at large",
    derive: suitesReadingTheRepository,
  },
  {
    file: "apps/web/src/app/items/actions.ts",
    pattern: /`login\/actions\.ts`'s (\w+) redirects/g,
    population: "the hand-built redirects in login/actions.ts",
    derive: () => handBuiltRedirectsIn("apps/web/src/app/login/actions.ts"),
  },
  {
    file: "apps/web/src/app/login/actions.ts",
    pattern: /ALL (\w+) OF THIS FILE'S ADDRESSES ARE HAND-BUILT/g,
    population: "the hand-built redirects in login/actions.ts",
    derive: () => handBuiltRedirectsIn("apps/web/src/app/login/actions.ts"),
  },
  {
    file: "apps/web/src/answer.ts",
    pattern: /works by THROWING and ([\w-]+) of the twenty-seven call sites/g,
    population: "the call sites that redirect on a procedure's answer",
    derive: () => procedureAnswerCallSites().redirecting,
  },
  {
    file: "apps/web/src/answer.ts",
    pattern: /of the ([\w-]+) call sites redirect on what comes back/g,
    population: "the call sites that read a procedure's answer",
    derive: () => procedureAnswerCallSites().total,
  },
  {
    file: "docs/adr/0029-only-the-product-adds-fields.md",
    pattern: /which was not among the (\w+) migration 1 seeded/g,
    population: "the properties migration 1 seeds",
    derive: propertiesSeededByMigrationOne,
  },
  {
    file: "docs/adr/0102-drizzle-stays-on-the-stable-line.md",
    pattern: /the ladder has ([\w-]+) rungs/g,
    population: "the rungs on the migration ladder",
    derive: migrationRungs,
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

  it("counts the jobs that ask pnpm/setup for a Node major", () => {
    expect(jobsRequestingANodeMajor()).toBe(10);
  });

  it("counts the suites in this package that read the repository at large", () => {
    expect(suitesReadingTheRepository()).toBe(21);
  });

  it("counts the hand-built redirects ADR-0109's rule governs, per file", () => {
    expect(handBuiltRedirectsIn("apps/web/src/app/login/actions.ts")).toBe(4);
    expect(handBuiltRedirectsIn("apps/web/src/app/items/actions.ts")).toBe(4);
    expect(handBuiltRedirectsIn("apps/web/src/app/settings/actions.ts")).toBe(1);
  });

  it("counts the call sites that read a procedure's answer, and those that redirect on it", () => {
    expect(procedureAnswerCallSites().total).toBe(27);
    expect(procedureAnswerCallSites().redirecting).toBe(7);
  });

  it("counts the properties migration 1 seeds", () => {
    expect(propertiesSeededByMigrationOne()).toBe(11);
  });

  it("counts the rungs on the migration ladder, off the journal", () => {
    expect(migrationRungs()).toBe(22);
  });

  it("reads a count written as a word", () => {
    expect(asCount("seven")).toBe(7);
    expect(asCount("ELEVEN")).toBe(11);
    expect(asCount("twenty-one")).toBe(21);
    expect(asCount("27")).toBe(27);
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
