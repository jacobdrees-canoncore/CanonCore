import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "@canoncore/config/testing/repo-root";
import { StableSequencer } from "@canoncore/config/testing/stable-sequencer";
import { configFilesOnDisk, testBlockOf } from "@canoncore/config/testing/vitest-configs";
import { describe, expect, it } from "vitest";

import { SUITE_DATABASE_SUFFIXES } from "./testing/build-database";
import { suiteDatabaseSuffixAt } from "./testing/suite-database";

/**
 * A test that reads every Vitest config in the repository, for the same reason
 * `network-gate-wiring.test.ts` does: what is claimed here is a property of the
 * REPOSITORY, and the two mechanisms below are each only a control where a
 * config wires them in.
 *
 * The unit tests beside `suite-database.ts` and `stable-sequencer.ts` prove that
 * each mechanism works. They prove it for the configs that happen to use it, and
 * would go on passing with a fourth suite silently sharing a database or
 * reshuffling its files.
 */

/**
 * The global setup that builds a catalogue, and so the tell for a suite with one.
 *
 * REACHED AS A FILE RATHER THAN AS A SPECIFIER, because it is spelled two ways.
 * `packages/api` and `packages/tasks` name the published
 * `@canoncore/db/testing/global-setup`; `packages/db` names the same module
 * `./src/testing/global-setup.ts`, since it is its own. A sweep matching one
 * string reads two of the three suites and reports the third as having no
 * catalogue at all -- which is the vacuous half of exactly the claim below.
 *
 * Derived from this file's own location rather than written out, so it moves
 * with the package instead of being a path that outlives it.
 */
const BUILDS_A_CATALOGUE = fileURLToPath(new URL("./testing/global-setup.ts", import.meta.url));

function buildsACatalogue(named: string, config: string): boolean {
  return named.startsWith(".")
    ? resolve(dirname(config), named) === BUILDS_A_CATALOGUE
    : named === "@canoncore/db/testing/global-setup";
}

async function suitesWithACatalogue(): Promise<string[]> {
  const found = [];
  for (const config of configFilesOnDisk()) {
    const declared = (await testBlockOf(config)).globalSetup ?? [];
    const named = typeof declared === "string" ? [declared] : declared;
    if (named.some((setup) => buildsACatalogue(setup, config))) found.push(config);
  }
  return found;
}

describe("a suite that builds a catalogue", () => {
  it("claims a test database no other suite claims", async () => {
    const found = await suitesWithACatalogue();

    // Vacuous otherwise, and in BOTH directions, which is why it is an equality
    // rather than a floor: a config that took this global setup without being
    // declared would leave the set short, and an entry naming a package that no
    // longer takes it would leave the declaration long. The first is the defect
    // this ticket is about; the second is the excuse-list rot that
    // `network-gate-wiring.test.ts` spends a test of its own refusing.
    expect(found.map((config) => relative(repoRoot, config)).length).toBe(
      Object.keys(SUITE_DATABASE_SUFFIXES).length,
    );

    // Resolved through the harness's OWN lookup rather than by reading the
    // declaration a second time here, so a package absent from it fails as the
    // refusal it is, naming itself.
    const claimed = found.map((config) => suiteDatabaseSuffixAt(dirname(config)));
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it("orders its files the same way on every run", async () => {
    const reshuffling = [];
    for (const config of await suitesWithACatalogue()) {
      const { sequence } = await testBlockOf(config);
      if (sequence?.sequencer !== StableSequencer) reshuffling.push(relative(repoRoot, config));
    }

    // WHY IT IS THESE SUITES AND NOT EVERY SUITE. A file's position only decides
    // anything where the files share one catalogue and run serially, which is
    // exactly the set above. Vitest's own sequencer promotes a file that FAILED
    // last run to first, so for these a failure changes the conditions of the
    // next run -- and that is the one arrangement under which a flake cannot be
    // re-observed by repeating the command (CNCORE-199).
    expect(reshuffling).toStrictEqual([]);
  });
});
