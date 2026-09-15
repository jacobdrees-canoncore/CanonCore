import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "./repo-root";

/**
 * One reader for the list of packages this workspace declares, for the suites
 * that hold the repository to something every package must have:
 * `network-gate-wiring.test.ts` and `typecheck-wiring.test.ts`.
 *
 * They had a reader each until CNCORE-197, which is the same Shotgun Surgery
 * `turbo-dry-run.ts` was extracted for under CNCORE-145 -- a change to the
 * workspace file's shape, or to what counts as a package, meant editing both,
 * and nothing made the second one obvious.
 *
 * PACKAGE-PRIVATE, like `turbo-dry-run.ts` and unlike `repo-root.ts`: both
 * readers are in this package, so an `exports` entry would be a public surface
 * nothing imports. `workspace.test.ts` beside it holds `isWorkspacePattern`'s
 * table, which came here with the predicate: ADR-0103 keeps the two together.
 *
 * IT THROWS RATHER THAN EXPECTS, which is the one thing that changed on the way
 * out of the suite that held it. What these functions guard is that the
 * REPOSITORY is readable at all -- a workspace file that parsed to nothing is
 * not a subject failing an assertion, it is every sweep below it silently
 * emptying -- and a module that raised through `expect` would be a helper only
 * a Vitest worker could call. Either way the suite importing it goes red with
 * the reason attached.
 */

// Only the `<name>/*` shape this repo uses. A pattern of any other shape is not
// quietly ignored -- it would take packages out of the sweeps that descend from
// here, which is the one failure they cannot afford. Checked as a WHOLE rather
// than by its second segment: `apps/*/nested` has `*` there too and sweeps
// somewhere other than where the pattern says.
//
// A first segment of ONLY dots is refused ahead of the rest, because `[\w.-]+`
// matches `..` and `.` -- so `../*` swept the repository's parent and `./*` its
// root, the two places a sweep most obviously should not go, while the sentence
// above claimed the whole-shape check caught them (CNCORE-46).
export function isWorkspacePattern(pattern: string): boolean {
  const [parent, ...rest] = pattern.split("/");
  return rest.length === 1 && rest[0] === "*" && /^(?!\.+$)[\w.-]+$/.test(parent as string);
}

/**
 * Every workspace directory that is really a package, which is the list a
 * repository-wide claim is held against (CNCORE-160).
 *
 * A directory with no manifest is NOT one: pnpm reads it that way too, and a
 * stray directory under `packages/` would otherwise be reported as a package
 * that dropped whatever the caller is asking about.
 */
export function packageDirectories(): string[] {
  return workspaceDirectories().filter((directory) =>
    existsSync(join(repoRoot, directory, "package.json")),
  );
}

/**
 * Every directory `pnpm-workspace.yaml` calls a package, read from the file.
 *
 * NON-EMPTINESS IS RAISED HERE RATHER THAN COUNTED BY EACH CALLER (CNCORE-160).
 * Every sweep that descends from this one function empties at once if the
 * workspace file parses to no packages -- and a guard in one test derived from
 * another of those sweeps would then be comparing nothing to nothing and
 * passing. The floors were `>= 12` and caught that only by being a number
 * somebody had written down, which is the thing CNCORE-160 took out. So the
 * root of the chain is where it is held: the file must declare at least one
 * pattern, and each pattern must find at least one directory.
 *
 * WHAT A DIRECTORY IS is `directoriesUnder`'s, below, which refuses a symlinked
 * one rather than letting it leave this list unremarked (CNCORE-200).
 */
export function workspaceDirectories(): string[] {
  const { packages } = parse(readFileSync(join(repoRoot, "pnpm-workspace.yaml"), "utf8")) as {
    packages?: string[];
  };
  if ((packages ?? []).length === 0) throw new Error("pnpm-workspace.yaml declares no packages");
  return (packages ?? []).flatMap((pattern) => {
    if (!isWorkspacePattern(pattern)) throw new Error(`unsupported workspace pattern ${pattern}`);
    const [parent] = pattern.split("/");
    const found = directoriesUnder(join(repoRoot, parent as string)).map((name) =>
      join(parent as string, name),
    );
    if (found.length === 0) {
      throw new Error(`the workspace pattern ${pattern} matches no directory`);
    }
    return found;
  });
}

/**
 * The directories directly under ONE workspace parent, with a symlinked one
 * REFUSED rather than dropped (CNCORE-200).
 *
 * `Dirent.isDirectory()` is lstat, so it is FALSE for a symlink pointing at a
 * directory -- `isSymbolicLink()` is true instead. Filtering on the first alone
 * took a symlinked package out of every sweep descending from here in silence,
 * which is the vacuous pass CNCORE-160 spent a ticket removing from these
 * files, arriving through the directory read rather than through a count.
 *
 * REFUSED RATHER THAN RESOLVED, because the two tools that read this workspace
 * DISAGREE about the shape, and no sweep can be right about one they answer
 * differently. Measured 2026-09-15, on a scratch workspace whose
 * `packages/linked` was a symlink to a directory: pnpm 12.3.4 left it out of
 * `pnpm ls -r` and out of `Scope: all 2 workspace projects`, before and after
 * an install and with nothing on stderr, while turbo 2.10.12 listed it in
 * `--dry=json`'s `packages` and planned `linked#typecheck` for it. So resolving
 * it would take turbo's side and make `workspaceDirectories`' own sentence
 * false the other way -- demanding a Vitest config and a `typecheck` script
 * from a directory pnpm never installed into. The ticket proposed resolving it
 * on the premise that BOTH tools count one; that half is what the measurement
 * overturned.
 *
 * A SYMLINK POINTING AT A DIRECTORY IS THE ONLY AMBIGUOUS ONE, so it is the
 * only one refused. A symlink to a file is not a package to either tool, and a
 * BROKEN one stats as nothing: `throwIfNoEntry: false` is what keeps that an
 * entry dropped for the same reason as the file rather than an ENOENT naming a
 * path and no reason.
 */
export function directoriesUnder(parent: string): string[] {
  const entries = readdirSync(parent, { withFileTypes: true });
  const symlinked = entries.find(
    (entry) =>
      entry.isSymbolicLink() &&
      statSync(join(parent, entry.name), { throwIfNoEntry: false })?.isDirectory() === true,
  );
  if (symlinked !== undefined) {
    const path = join(parent, symlinked.name);
    throw new Error(
      `${path} is a symlink to a directory, which pnpm does not count as a package and turbo does`,
    );
  }
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}
