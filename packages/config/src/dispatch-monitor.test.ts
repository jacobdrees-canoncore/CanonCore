import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";

import { repoRoot } from "./testing/repo-root";

/**
 * THE DISPATCHER'S WAKE-UP, HELD TO WHAT IT SEES OF A PROVIDER REPO (ADR-0192,
 * CNCORE-295).
 *
 * A cross-repo ticket's provider half runs in a worktree of its own, never in
 * the provider's main checkout. Both halves of that rule were broken on
 * 2026-09-20/21 in ways nothing reported: CNCORE-261 left both provider main
 * checkouts on its branch after merging, and CNCORE-262 found one there and
 * stopped to ask; and `cncore-264-tmdb` was created by the dispatcher without
 * `--linear-issue`, while `UNBOUND` read CanonCore's worktrees alone.
 *
 * THE SEAM IS THE SCRIPT'S OWN PROCESS BOUNDARY, as `merge-gate.test.ts`'s is,
 * agreed with the dispatcher on 2026-09-21. The fixture is a WORLD: a `HOME`
 * holding real git checkouts, and an `orca` and a `gh` that answer from it. The
 * monitor is a loop that never ends by design, so `sleep` is stubbed to end it
 * after one pass rather than giving the script a flag only this file would read.
 */
const monitor = join(repoRoot, ".claude", "skills", "dispatch", "monitor.sh");

type World = {
  /**
   * Each repo's main checkout, by the branch it stands on, or `not-a-repository` for a directory
   * holding none. A repo the map leaves out has no checkout at all. With no map, all three stand on
   * `main`.
   */
  readonly checkouts?: Readonly<Record<string, string>>;
  /** Orca's worktrees, as `<repo>/<name>` and the Linear ticket each is bound to. */
  readonly worktrees?: Readonly<Record<string, string | null>>;
};

const ALL_ON_MAIN = { CanonCore: "main", "provider-wiki": "main", "provider-tmdb": "main" };

/**
 * A real git checkout at `dir`, standing where the world says.
 *
 * THE DEVELOPER'S OWN GIT CONFIG IS KEPT OUT, so a global signing key or hook cannot shape the
 * fixture, and a git call that fails throws here rather than surfacing later as a wrong line.
 */
function checkout(dir: string, on: string) {
  mkdirSync(dir, { recursive: true });
  if (on === "not-a-repository") return;
  const git = (...args: string[]) => {
    const ran = spawnSync(
      "git",
      ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...args],
      {
        encoding: "utf8",
        env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
      },
    );
    if (ran.status !== 0) throw new Error(`fixture: git ${args.join(" ")} -- ${ran.stderr}`);
  };
  git("init", "-q", "-b", "main");
  git("commit", "-q", "--allow-empty", "-m", "root");
  if (on === "detached") git("checkout", "-q", "--detach");
  else if (on !== "main") git("checkout", "-q", "-b", on);
}

/** One pass of the real monitor against a world, and every line it emitted. */
function onePassOf(world: World): string[] {
  const home = mkdtempSync(join(tmpdir(), "dispatch-monitor-"));
  // REGISTERED HERE RATHER THAN IN THE THREE CALLERS, because this is where the
  // directory is made: a caller that forgot would leak, and one of three is the
  // shape CNCORE-336 found across the repository.
  onTestFinished(() => rmSync(home, { recursive: true, force: true }));
  const bin = join(home, "bin");
  const scratch = join(home, "scratch");
  mkdirSync(bin);
  mkdirSync(scratch);
  // `HOME` IS ITSELF A REPOSITORY ON `main`, so a checkout that is not one cannot pass by being
  // read through whatever encloses it: `git -C` walks UP until it finds a repository.
  checkout(home, "main");
  for (const [repo, on] of Object.entries(world.checkouts ?? ALL_ON_MAIN)) {
    checkout(join(home, "orca", "projects", repo), on);
  }
  // THE LISTING'S OWN SHAPE, with a path and a binding per worktree.
  const worktrees = Object.entries(world.worktrees ?? {}).map(([where, linear]) => ({
    path: join(home, "orca", "workspaces", where),
    linkedLinearIssue: linear,
  }));
  writeFileSync(join(home, "worktrees.json"), JSON.stringify({ result: { worktrees } }));

  const stub = (name: string, lines: readonly string[]) => {
    writeFileSync(join(bin, name), ["#!/usr/bin/env bash", ...lines, ""].join("\n"));
    chmodSync(join(bin, name), 0o755);
  };
  stub("orca", [
    'case "$1 $2" in',
    `  "terminal list") echo '{"result":{"terminals":[]}}' ;;`,
    `  "worktree list") cat ${JSON.stringify(join(home, "worktrees.json"))} ;;`,
    `  "linear list-issues") echo '{"result":{"issues":[]}}' ;;`,
    '  *) echo "orca: unstubbed $*" >&2; exit 1 ;;',
    "esac",
  ]);
  // NO OPEN PULL REQUESTS, answered as an empty listing rather than a failure,
  // so the pass is not the blind one the monitor refuses to report from.
  stub("gh", ["exit 0"]);
  // THE LOOP ENDS HERE. The pass has already printed by the time it sleeps.
  stub("sleep", ["kill -TERM $PPID"]);

  const ran = spawnSync("bash", [monitor], {
    encoding: "utf8",
    env: { ...process.env, HOME: home, SCRATCH: scratch, PATH: `${bin}:${process.env.PATH ?? ""}` },
  });
  return ran.stdout.split("\n").filter(Boolean);
}

describe("a main checkout the monitor reads", () => {
  it("is named when it stands anywhere but main, and not when it stands on main", () => {
    const lines = onePassOf({
      checkouts: {
        CanonCore: "main",
        "provider-wiki": "jacobdrees/cncore-261",
        "provider-tmdb": "detached",
      },
    });

    expect(lines).toContain("PARKED provider-wiki jacobdrees/cncore-261");
    expect(lines).toContain("PARKED provider-tmdb detached");
    expect(lines.filter((line) => line.startsWith("PARKED CanonCore"))).toEqual([]);
  });

  /**
   * SILENCE HAS TO MEAN "ON MAIN", which is the rule this script already keeps
   * for `UNBOUND-BLIND` and `LINEAR-BLIND`. A checkout that is missing or not a
   * repository answers nothing about its branch, and reading that as on `main`
   * is a false all-clear about exactly the thing the line exists to report.
   *
   * NOT A REPOSITORY IS THE HARDER CASE, because `git -C` walks up to whatever
   * repository encloses the directory and answers for that one instead --
   * `merge-if-green.sh` guards the same walk. Here the enclosing repository is on
   * `main`, so reading through it would be silence.
   */
  it("names a checkout it cannot read, rather than reading it as on main", () => {
    const lines = onePassOf({
      checkouts: { CanonCore: "main", "provider-wiki": "not-a-repository" },
    });

    expect(lines).toContain("PARKED provider-wiki unreadable");
    expect(lines).toContain("PARKED provider-tmdb unreadable");
    expect(lines.filter((line) => line.startsWith("PARKED CanonCore"))).toEqual([]);
  });
});

describe("a worktree with no binding", () => {
  /**
   * EVERY REPO THE DISPATCHER RUNS, NOT ONLY CANONCORE. `cncore-264-tmdb` was
   * created by the dispatcher on 2026-09-21 without `--linear-issue`, and its
   * agent found that and bound it by hand; `UNBOUND` read `/workspaces/CanonCore/`
   * alone and could not have said so. Reading every repo in `REPOS` is what would
   * have caught it.
   *
   * THE REPO IS IN THE NAME because a provider worktree is named `cncore-<n>`
   * exactly as its CanonCore twin is, so the bare name no longer says which one.
   */
  it("is named with its repo, in every repo the dispatcher runs and no other", () => {
    const lines = onePassOf({
      worktrees: {
        "CanonCore/cncore-264": null,
        "provider-tmdb/cncore-264-tmdb": null,
        "provider-wiki/cncore-258": "CNCORE-258",
        "Sift/sift-18-periods": null,
      },
    });

    expect(lines.filter((line) => line.startsWith("UNBOUND"))).toEqual([
      "UNBOUND CanonCore/cncore-264",
      "UNBOUND provider-tmdb/cncore-264-tmdb",
    ]);
  });
});
