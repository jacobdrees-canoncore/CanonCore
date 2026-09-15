import { existsSync, readdirSync, readFileSync } from "node:fs";
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
 * nothing imports.
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
 */
export function workspaceDirectories(): string[] {
  const { packages } = parse(readFileSync(join(repoRoot, "pnpm-workspace.yaml"), "utf8")) as {
    packages?: string[];
  };
  if ((packages ?? []).length === 0) throw new Error("pnpm-workspace.yaml declares no packages");
  return (packages ?? []).flatMap((pattern) => {
    if (!isWorkspacePattern(pattern)) throw new Error(`unsupported workspace pattern ${pattern}`);
    const [parent] = pattern.split("/");
    const found = readdirSync(join(repoRoot, parent as string), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(parent as string, entry.name));
    if (found.length === 0) {
      throw new Error(`the workspace pattern ${pattern} matches no directory`);
    }
    return found;
  });
}
