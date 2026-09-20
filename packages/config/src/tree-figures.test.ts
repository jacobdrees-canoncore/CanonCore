import { describe, expect, it } from "vitest";

import {
  asCount,
  ciJobs,
  configsRunningTheirFilesSerially,
  countStatedIn,
  directiveCarriers,
  handBuiltRedirectsIn,
  jobsRequestingANodeMajor,
  migrationRungs,
  movePlacementRefusalCauses,
  packagesDeclaring,
  packagesInWorkspace,
  peakConnectionsInOneE2eRun,
  placementRefusalCauses,
  procedureAnswerCallSites,
  propertiesSeededByMigrationOne,
  runsInTheTimeoutWindow,
  serversStoodUpByTheHttpSuite,
  serversVia,
  suitesInRepo,
  suitesNamingAConfig,
  suitesReadingTheRepository,
  timeoutWindowAsTheSuiteRestatesIt,
  timeoutWindowBounds,
  visibilityMentionsInTheSchema,
  vitestConfigs,
} from "./testing/tree-figures";

/**
 * EVERY FIGURE THIS REPOSITORY STATES ABOUT ITSELF, HELD TO A COUNT TAKEN FROM
 * THE TREE (ADR-0153, CNCORE-251).
 *
 * ADR-0153 IS THE RULE AND THIS IS ITS DERIVED HALF. That record stays
 * `proposed` because the other half -- a figure that cannot be derived carries
 * its date and its query -- is a convention enforced for one population in
 * `corpus-figures.test.ts` and nowhere else. The record says which half landed.
 *
 * A figure measured once, written into prose, and never re-measured is this
 * repository's most common defect. The scan of 2026-09-20 found roughly
 * thirty-five standing at once, in decision records, in `CLAUDE.md`, in
 * `ci.yml`, in a README saying the package that holds every check this
 * repository makes of its own CI has no TypeScript in it, and in test NAMES
 * that printed the wrong number on every run. Every
 * one of them was true the day it was written, which is what makes the class
 * invisible: nothing is broken, and the tree simply moves out from under the
 * sentence.
 *
 * `corpus-figures.test.ts` had the only mechanism against this and covered ONE
 * population -- the `Theory:Timeline` corpus -- because that is what CNCORE-157
 * asked for. Its own `TODO(CNCORE-158)` asked for the widening and that ticket
 * was Canceled, so the gap read as somebody's and was nobody's. This file is
 * the widening, pointed at the populations that one could not reach.
 *
 * ## What this covers
 *
 * A claim is a FILE, a PATTERN that reads a figure out of its prose, and a
 * DERIVATION that counts the same population off the tree. The claim passes
 * when the two agree. A pattern that stops matching THROWS rather than quietly
 * covering nothing, so a reworded sentence goes red and the table has to follow
 * it -- `node-major.test.ts`'s rule and the actionlint probe's, because an
 * assertion that something must BE there cannot be allowed to pass by no longer
 * finding it.
 *
 * ## What this does NOT cover, said here rather than left to be discovered
 *
 * **A FIGURE MISSING FROM THE TABLE IS NOT CAUGHT.** A new sentence quoting a
 * count is covered only by being added, exactly as a new place stating the Node
 * major is covered only by being added to `node-major.test.ts`. This is a
 * roll call, not a sweep of the prose: nothing here reads an arbitrary number
 * out of an arbitrary document and decides whether it is stale, because
 * deciding which numbers in English are claims about this tree is not a
 * problem a regular expression settles.
 *
 * **A FIGURE THAT IS NOT DERIVABLE FROM THE TREE IS OUT OF SCOPE HERE, AND THE
 * RULE FOR IT IS THE DATE.** Three kinds live in this repository and none of
 * them can be recomputed by reading files:
 *
 * - **Durations on the forge.** `SLOWEST_SECONDS` in `ci-timeouts.test.ts` is
 *   the specimen CNCORE-251 was raised on: that suite enforced
 *   `ceiling == max(5, ceil(3 * slowest / 60))` and stayed green for eight days
 *   while two of the figures it multiplies went stale by 50 per cent. Reading
 *   it from the Actions API would put a network call in a suite the network
 *   gate exists to keep offline, so the rule is ADR-0141's: the window, the
 *   query and the date are written beside the table, and a ceiling moves by
 *   moving the window and taking the measurement again.
 * - **Measurements of a running system.** The peak Postgres connections one
 *   `pnpm test:e2e` takes is 67, taken by sampling `pg_stat_activity` through a
 *   real run. `peakConnectionsInOneE2eRun` does NOT recompute it -- it reads it
 *   out of `apps/web/e2e/global-setup.ts`, which is where it was taken and
 *   where its date and method are written. What the claims below then catch is
 *   the RESTATEMENTS drifting from that one source, which is how `CLAUDE.md`
 *   and the dispatch skill both carried `55-60` for eight days after the
 *   eleventh server pushed it to 67.
 * - **Another repository's corpus.** The `Theory:Timeline` figures belong to
 *   `provider-wiki`. `corpus-figures.test.ts` holds them to carrying their
 *   population and their date, and says at length why no check on this side of
 *   the boundary can do more.
 *
 * **AND TWO POPULATIONS THIS TREE HOLDS ARE DELIBERATELY ABSENT**, because
 * neither has a structural signal a derivation could read without inventing
 * one:
 *
 * - **The Listings.** There are six -- `catalogue.list`, `catalogue.works`,
 *   `catalogue.search`, `item.get`'s members and "Also appears in", and
 *   `provider.containers`. They share no output schema and no input type:
 *   `item.get`'s two take plain optional strings rather than a cursor and
 *   answer inside a larger object, so every signal that finds the other four
 *   misses them. A derivation would be a list of six names checked against
 *   itself, which is a tautology rather than a count.
 * - **The suites that need the loopback carve-out.** "Need" is a judgement
 *   about what a suite does at runtime, not a fact on disk. That figure was in
 *   a test NAME in `network-gate.test.ts` and printed the wrong number on every
 *   run; it is now a phrase rather than a count, which is the honest answer
 *   when nothing derives it.
 */

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
    file: "apps/web/vitest.e2e.config.ts",
    pattern: /([\w-]+) sibling configs set it/g,
    population: "the Vitest configs that run their files serially",
    derive: configsRunningTheirFilesSerially,
  },
  /*
   * THE RECORD THAT ARGUES FROM THE SAME COUNT, held separately. ADR-0153 lets
   * a figure be stated once PER DOCUMENT, so the config and the record each
   * state it once -- and each copy is one that can drift, which is why there
   * are two claims here rather than one covering both.
   */
  {
    file: "docs/adr/0155-a-shared-instance-assertion-holds-only-what-the-address-decides.md",
    pattern: /([\w-]+) sibling configs set it/g,
    population: "the Vitest configs that run their files serially",
    derive: configsRunningTheirFilesSerially,
  },
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
    pattern: /here: (\w+) of this repo's [\w-]+ suites run the package's own/g,
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
    file: "CLAUDE.md",
    pattern: /peaks at (\d+) of 288 usable connections/g,
    population: "the peak connections one `pnpm test:e2e` takes",
    derive: peakConnectionsInOneE2eRun,
  },
  {
    file: ".claude/skills/dispatch/SKILL.md",
    pattern: /peaking at (\d+) of 288 usable connections/g,
    population: "the peak connections one `pnpm test:e2e` takes",
    derive: peakConnectionsInOneE2eRun,
  },
  /*
   * THE RECORD'S OWN FIGURES, held the same way as everything else (ADR-0153).
   * A record arguing that a count about this tree must be derived cannot be the
   * one place stating an underived one, and the first draft of it said "sixteen
   * claims across nine files" when the table held twenty-six across sixteen.
   */
  {
    file: "docs/adr/0153-a-figure-about-this-tree-is-derived-or-dated.md",
    pattern: /holds ([\w-]+) claims across/g,
    population: "the claims this table holds",
    derive: () => CLAIMS.length,
  },
  {
    file: "docs/adr/0153-a-figure-about-this-tree-is-derived-or-dated.md",
    pattern: /claims across ([\w-]+) files to counts taken from the tree/g,
    population: "the files this table reads",
    derive: () => new Set(CLAIMS.map(({ file }) => file)).size,
  },
  {
    file: "packages/config/src/ci-timeouts.test.ts",
    pattern: /over every attempt of the ([\d,]+) runs of `CI` created/g,
    population: "the CI runs ADR-0141's ceilings were measured over",
    derive: runsInTheTimeoutWindow,
  },
  {
    file: "docs/adr/0072-no-visibility-system.md",
    pattern: /returns (\w+) hit/g,
    population: "the mentions of a visibility system in the schema and on the ladder",
    derive: visibilityMentionsInTheSchema,
  },
  {
    file: "packages/config/vitest.config.ts",
    pattern: /what the other (\w+) configs are checked against/g,
    population: "the Vitest configs other than this one",
    derive: () => vitestConfigs() - 1,
  },
  {
    file: "packages/api/src/routers/placement.ts",
    pattern: /(\w+) things can refuse/g,
    population: "the causes `placement.place` can be refused by",
    derive: placementRefusalCauses,
  },
  {
    file: "packages/api/src/routers/placement.ts",
    pattern: /(\w+) CAUSES REACH THAT BAD_REQUEST/g,
    population: "the causes `placement.move` can be refused by",
    derive: movePlacementRefusalCauses,
  },
  /*
   * THE PACKAGE COUNT, WHICH WAS PROSE NOTHING DERIVED (CNCORE-286).
   * `typecheck-wiring.test.ts` is the file whose whole subject is that A COUNT
   * IS NOT A ROLL CALL, and its own header stated a count nothing counted.
   * `@canoncore/text` arriving as the twelfth package (CNCORE-282) left every
   * sentence below stale at once and NOTHING went red; they were corrected by
   * hand in that PR only because a reviewer read for them. The suite counts
   * beside them DID go red, because `suitesInRepo` was already in this table --
   * the contrast that makes this a gap rather than an oversight.
   *
   * THREE POPULATIONS, NOT ONE, and two of them are equal only by accident.
   * The packages declaring `typecheck` is twelve, the packages declaring `test`
   * is eleven, and the packages the workspace declares at all is twelve. A
   * thirteenth package added without a `typecheck` script moves the last of
   * those and leaves the first where it was, so a claim pointed at the wrong
   * one stays green through exactly the change that should redden it.
   *
   * WHAT IS LEFT TO THE DATE RATHER THAN DERIVED, both in ADR-0103 and on
   * purpose. Its "Counted 2026-09-14 ... Recounted 2026-09-20" line carries its
   * date and its method, which is ADR-0153's other half and not this one; and
   * the sentence it quotes to correct -- "`typecheck` and `build` ... eleven
   * packages each" -- is a QUOTATION OF A PAST ERROR, so deriving it would
   * rewrite the record's own evidence.
   */
  {
    file: "packages/config/src/typecheck-wiring.test.ts",
    pattern: /`typecheck` is declared by (\w+) packages/g,
    population: "the packages declaring `typecheck`",
    derive: () => packagesDeclaring("typecheck"),
  },
  {
    file: "packages/config/src/typecheck-wiring.test.ts",
    pattern: /dropping its script leaves (\w+) running/g,
    population: "the packages still typechecked with one script deleted",
    derive: () => packagesDeclaring("typecheck") - 1,
  },
  {
    file: "packages/config/src/typecheck-wiring.test.ts",
    pattern: /would be (\w+) names transcribed into a workflow/g,
    population: "the packages this workspace declares",
    derive: packagesInWorkspace,
  },
  {
    file: "packages/config/src/typecheck-wiring.test.ts",
    pattern: /still saw (\w+) and passed/g,
    population: "the packages this workspace declares",
    derive: packagesInWorkspace,
  },
  {
    file: "packages/config/src/typecheck-wiring.test.ts",
    pattern: /`test` is declared by (\w+) of the/g,
    population: "the packages declaring `test`",
    derive: () => packagesDeclaring("test"),
  },
  {
    file: "packages/config/src/typecheck-wiring.test.ts",
    pattern: /`test` is declared by \w+ of the (\w+):/g,
    population: "the packages this workspace declares",
    derive: packagesInWorkspace,
  },
  /*
   * THE RECORD ARGUING FROM THE SAME COUNTS, held separately for the reason
   * ADR-0155's pair is: a figure may be stated once per document, and each copy
   * is one that can drift on its own.
   */
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /`test` is declared by (\w+) of the/g,
    population: "the packages declaring `test`",
    derive: () => packagesDeclaring("test"),
  },
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /is declared by \w+ of the (\w+) packages while/g,
    population: "the packages this workspace declares",
    derive: packagesInWorkspace,
  },
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /while `typecheck` is declared by all (\w+)/g,
    population: "the packages declaring `typecheck`",
    derive: () => packagesDeclaring("typecheck"),
  },
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /`typecheck` is declared by (\w+) packages and had only the count/g,
    population: "the packages declaring `typecheck`",
    derive: () => packagesDeclaring("typecheck"),
  },
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /dropping its script left (\w+) running/g,
    population: "the packages still typechecked with one script deleted",
    derive: () => packagesDeclaring("typecheck") - 1,
  },
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /would be (\w+) names transcribed into `ci\.yml`/g,
    population: "the packages this workspace declares",
    derive: packagesInWorkspace,
  },
  /*
   * THE NEXT PACKAGE, WHICH IS AN ORDINAL AND STILL A COUNT OF THIS TREE. The
   * sentence names the package that would go unwritten-down, so it is the total
   * plus one and goes stale on the same day the total does -- it read "twelfth"
   * before `@canoncore/text`. `asCount` already reads ordinals, so nothing had
   * to be taught to cover it.
   */
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /and the (\w+) package would simply not be one/g,
    population: "the package a thirteenth would be",
    derive: () => packagesInWorkspace() + 1,
  },
  /*
   * THE DRY RUN'S TRAP, which is the one place this record counts a task NO
   * package but one declares. Both halves are held: `db:studio` is declared
   * once, and a plan names every package anyway -- the measurement the sentence
   * exists for.
   */
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /`db:studio`, declared by exactly (\w+) package/g,
    population: "the packages declaring `db:studio`",
    derive: () => packagesDeclaring("db:studio"),
  },
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /package, plans (\w+)/g,
    population: "the packages this workspace declares",
    derive: packagesInWorkspace,
  },
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /the two name the same (\w+) packages/g,
    population: "the packages this workspace declares",
    derive: packagesInWorkspace,
  },
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /an unfiltered plan of (\w+) and passing/g,
    population: "the packages this workspace declares",
    derive: packagesInWorkspace,
  },
  /*
   * THE PARAGRAPH ABOUT THE COUNT REACHING ZERO, which had gone stale AND was
   * missed by the hand-correction that caught this record's others. It read
   * "`test` is declared by ten: delete one package's and nine still run" until
   * CNCORE-286 -- broken by `@canoncore/text` (CNCORE-282) like the rest, and
   * left standing because a reviewer reading for a figure is a reviewer who can
   * stop reading. It is the argument for this table rather than a row in it.
   */
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /`test` is declared by (\w+): delete/g,
    population: "the packages declaring `test`",
    derive: () => packagesDeclaring("test"),
  },
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /delete one package's and (\w+) still run/g,
    population: "the packages still running `test` with one script deleted",
    derive: () => packagesDeclaring("test") - 1,
  },
  /*
   * THE TASKS ONE PACKAGE DECLARES, which is the case the paragraph contrasts
   * `test` against. THE HIGHEST OF THE THREE rather than one of them: the
   * sentence asserts the same figure for all three at once, so a claim reading
   * only `test:e2e` would stay green while `test:browser` gained a second
   * declarer and the sentence became false.
   */
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /are each declared by (\w+) package/g,
    population: "the packages declaring each of `test:e2e`, `test:browser` and `test:contract`",
    derive: () =>
      Math.max(
        ...["test:e2e", "test:browser", "test:contract"].map((task) => packagesDeclaring(task)),
      ),
  },
  {
    file: "docs/adr/0103-tests-bite-at-package-exports-and-the-router.md",
    pattern: /it is declared by exactly (\w+) package/g,
    population: "the packages declaring `build`",
    derive: () => packagesDeclaring("build"),
  },
];

describe("a figure this tree states about itself", () => {
  it("counts the servers `The page over HTTP` stands up", () => {
    expect(serversStoodUpByTheHttpSuite()).toBe(11);
  });

  it("counts the suites this repository runs, and the few that name a config", () => {
    expect(suitesInRepo()).toBe(16);
    expect(suitesNamingAConfig()).toBe(4);
  });

  it("counts the packages declaring a task, against ADR-0103's recount", () => {
    expect(packagesDeclaring("typecheck")).toBe(12);
    expect(packagesDeclaring("test")).toBe(11);
    expect(packagesDeclaring("build")).toBe(1);
  });

  /**
   * THE TOTAL IS A DIFFERENT POPULATION FROM `typecheck`'s, and the two are
   * equal only by accident of every package declaring that script today. A
   * thirteenth package added without one moves this and leaves
   * `packagesDeclaring("typecheck")` where it was, which is the drift that
   * would make "eleven of the twelve" wrong in its second half alone.
   */
  it("counts the packages the workspace declares", () => {
    expect(packagesInWorkspace()).toBe(12);
  });

  it("counts the jobs that ask pnpm/setup for a Node major", () => {
    expect(jobsRequestingANodeMajor()).toBe(10);
  });

  it("counts the suites in this package that read the repository at large", () => {
    expect(suitesReadingTheRepository()).toBe(27);
  });

  it("counts the hand-built redirects ADR-0109's rule governs, per file", () => {
    expect(handBuiltRedirectsIn("apps/web/src/app/login/actions.ts")).toBe(4);
    expect(handBuiltRedirectsIn("apps/web/src/app/items/actions.ts")).toBe(4);
    // THREE SINCE CNCORE-262, and it was one. `nameProvider` ended at one
    // address carrying the refused entry; it now ends at one of three, because
    // the three ways an entry can fail to name a Provider have three different
    // remedies and the page writes a sentence for each. The rule this figure
    // governs is unchanged -- every one of them is a hand-built path string
    // that Next does not prefix (ADR-0109), which is what makes them the
    // addresses to revisit on the day a host imposes a `basePath`.
    expect(handBuiltRedirectsIn("apps/web/src/app/settings/actions.ts")).toBe(3);
  });

  it("counts the call sites that read a procedure's answer, and those that redirect on it", () => {
    expect(procedureAnswerCallSites().total).toBe(27);
    expect(procedureAnswerCallSites().redirecting).toBe(7);
  });

  /**
   * ADR-0164's count of them, which was WRONG IN ITS FIRST DRAFT and is the
   * reason this row exists. The record said six while the change it documents
   * removed `theme-provider.tsx`'s directive, leaving five -- a count true when
   * the sentence was drafted and false when it merged, in the record whose own
   * thesis is a sentence that reads as load-bearing and is not.
   */
  it("counts the modules carrying `use client`, against ADR-0164's sentence", () => {
    expect(directiveCarriers()).toBe(
      countStatedIn(
        "docs/adr/0164-a-use-client-directive-is-earned-by-a-server-importer-and-a-boundary-below.md",
        /all (\w+) live in `apps\/web\/src\/components`/g,
      ),
    );
  });

  it("counts the properties migration 1 seeds", () => {
    expect(propertiesSeededByMigrationOne()).toBe(11);
  });

  it("counts the rungs on the migration ladder, off the journal", () => {
    expect(migrationRungs()).toBe(23);
  });

  /**
   * ADR-0141 OWNS THE WINDOW AND `ci-timeouts.test.ts` RESTATES IT, so the two
   * are held together rather than to the forge. Both were moved by hand when
   * the window moved under CNCORE-252 -- a record and the suite that multiplies
   * its figures, edited in one pass by one agent, with nothing checking that
   * the second edit happened. That is the drift this whole file is about,
   * standing in the mechanism's own specimen.
   */
  it("restates ADR-0141's measurement window without moving it", () => {
    expect(timeoutWindowAsTheSuiteRestatesIt()).toStrictEqual(timeoutWindowBounds());
  });

  it("reads a count written as a word", () => {
    expect(asCount("seven")).toBe(7);
    expect(asCount("ELEVEN")).toBe(11);
    expect(asCount("twenty-one")).toBe(21);
    expect(asCount("27")).toBe(27);
    // THE TENS RAN OUT AT THIRTY and this table grew past it (CNCORE-286), which
    // is the failure its own comment predicted: a word list that stops is a
    // reader that throws on the day the count it reads moves past the end.
    expect(asCount("fifty")).toBe(50);
    expect(asCount("fifty-one")).toBe(51);
  });

  /**
   * BEFORE ANY COMPARISON, because a table that matched nothing would satisfy
   * "they all agree" by having no subject -- `corpus-figures.test.ts`'s reason,
   * and `sweep-shard-citations.test.ts`'s for asking whether it found citations
   * at all. Every claim is read here, so a pattern that has stopped matching
   * throws in this test rather than silently shrinking the one below.
   */
  it("reads every claim it lists, and more than one file states one", () => {
    expect(CLAIMS.length).toBeGreaterThan(10);
    expect(new Set(CLAIMS.map(({ file }) => file)).size).toBeGreaterThan(5);

    for (const claim of CLAIMS) {
      const stated = countStatedIn(claim.file, claim.pattern);
      expect(Number.isInteger(stated), `${claim.file} states ${stated}`).toBe(true);
      expect(stated, `${claim.file} states ${stated}`).toBeGreaterThan(0);
    }
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
