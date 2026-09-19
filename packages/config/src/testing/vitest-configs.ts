import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "./repo-root";
import { workspaceDirectories } from "./workspace";

/**
 * ONE READER FOR THE VITEST CONFIGS THIS REPOSITORY HAS, for the suites that
 * hold every one of them to something.
 *
 * `network-gate-wiring.test.ts` had these to itself until CNCORE-199 gave
 * `packages/db` a second claim to make over the same files -- which is the
 * Shotgun Surgery `workspace.ts` and `turbo-dry-run.ts` were each extracted for:
 * a change to what a config is, or to how one is read, meant editing two places
 * and nothing made the second obvious.
 *
 * PUBLISHED RATHER THAN PACKAGE-PRIVATE, unlike `workspace.ts`, and only because
 * the second caller is in another package. `@canoncore/db` cannot depend on
 * `@canoncore/config` the other way round -- `turbo` refuses a cyclic task graph
 * -- so the reader lives at the end everything already depends on.
 */

/**
 * The Vitest configs directly inside ONE directory, with a symlinked one
 * REFUSED rather than dropped (CNCORE-201).
 *
 * `Dirent.isFile()` is lstat, exactly as `isDirectory()` is, so it is FALSE for
 * a symlink pointing at a file and `isSymbolicLink()` is true instead. Filtering
 * on the first alone took such a config out of this list in silence. A package
 * whose ONLY config was a symlink still reddened, through `ungatedPackages`
 * below -- the silent case was a real config plus a symlinked SECOND one, which
 * nothing then held to installing the gate: `unrun` is `onDisk.filter(...)` and
 * iterates only what this function found, and the count guard below is LOOSENED
 * by a miss rather than tightened by it.
 *
 * REFUSED FOR A REASON OF ITS OWN RATHER THAN CNCORE-200'S, which was measured
 * rather than inherited. That one refuses a symlinked package DIRECTORY because
 * pnpm and turbo answer differently about it, and there is no such disagreement
 * here: Vitest loads a symlinked config and runs the suite green, and
 * `testConfig` below imports the same module Vitest does. What is refused
 * instead is a config this sweep cannot PLACE. `isInside` is the rule that keeps
 * a package from being asserted against a config it does not own, and it reads
 * the PATH -- so a symlink, whose path is inside the package while its file may
 * be anywhere, is the one spelling of that climb `isInside` cannot see. The
 * measurement and what the refusal costs are in ADR-0103 under "a symlinked
 * Vitest config is refused for a reason of its own", and are NOT restated here:
 * a figure kept in two places is a figure that drifts in one of them.
 *
 * THE NAME IS READ BEFORE THE LINK IS, so what this refuses is a symlink
 * WEARING A CONFIG'S NAME rather than a symlink in a package. EVERY offender is
 * named and not the first, for the reason `ungatedPackages` is named rather than
 * counted: two are two things to fix.
 */
export function configFilesIn(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true }).filter((entry) =>
    /^vitest\..*config\.ts$/.test(entry.name),
  );
  const symlinked = entries.filter((entry) => entry.isSymbolicLink());
  if (symlinked.length > 0) {
    const paths = symlinked.map((entry) => join(directory, entry.name)).join(", ");
    throw new Error(
      `a symlinked Vitest config names a file this sweep cannot place, so it is refused: ${paths}`,
    );
  }
  return entries.filter((entry) => entry.isFile()).map((entry) => join(directory, entry.name));
}

/**
 * Every Vitest config FILE under the directories the workspace names, found by
 * reading the disk rather than by asking the manifests. That is the whole point
 * of it: the sweep above learns what exists from `scripts`, so it cannot be the
 * thing that notices a config no script it recognises runs.
 */
//
// WHAT IT LOOKS AT IS ONE LEVEL AND ONE FILENAME SHAPE: `vitest.*.config.ts`
// directly inside a package, which is every config this repo has. A `.mts` one,
// a `test` block in a `vite.config.ts`, or one nested deeper is not seen, and
// the assertion below is worth only what this sentence says.
//
// AND IT TAKES AN ABSOLUTE PATH ONE DIRECTORY AT A TIME, which is what lets a
// scratch tree ask the question this repository cannot: no config here is a
// symlink, exactly as no package directory is (CNCORE-201).
export function configFilesOnDisk(): string[] {
  return workspaceDirectories().flatMap((directory) => configFilesIn(join(repoRoot, directory)));
}

/**
 * A config's `test` block as it actually resolves, read by IMPORTING the config
 * rather than by matching specifiers in its text. A commented-out line still
 * reads as present to a text search, and that is the exact state this test
 * exists to catch. Both things asked below -- `setupFiles` and `globalSetup` --
 * come off this one object.
 *
 * A config that is not there resolves to none, which is what a package with no
 * Vitest config of its own has. Absence is reported by the caller as a suite
 * standing open, never as a crash -- it is the ordinary way to be ungated.
 */
export async function testBlockOf(config: string): Promise<TestBlock> {
  if (!existsSync(config)) return {};
  const loaded = (await import(pathToFileURL(config).href)) as { default?: { test?: TestBlock } };
  return loaded.default?.test ?? {};
}

/**
 * What the sweeps ask a config, which is deliberately not Vitest's whole
 * `UserConfig`: naming the three keys is what makes a sweep reading a fourth a
 * compile error rather than a silent `undefined`.
 */
export interface TestBlock {
  setupFiles?: string | string[];
  globalSetup?: string | string[];
  sequence?: { sequencer?: unknown };
}
