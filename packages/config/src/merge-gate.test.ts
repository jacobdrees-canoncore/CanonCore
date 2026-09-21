import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "./testing/repo-root";

/**
 * THE MERGE GATE, HELD TO THE ONE THING IT EXISTS TO REFUSE (ADR-0181,
 * CNCORE-288).
 *
 * This repository has no required checks (ADR-0118), so nothing at GitHub's
 * level refuses a merge and the whole gate is the dispatcher's. A PR that is
 * rebased and force-pushed goes on displaying the PREVIOUS head's checks:
 * `gh pr checks` reports them without naming the commit they belong to, so the
 * PR reads green while no CI has run on the code that would actually merge.
 *
 * MEASURED TWICE, ONE DAY APART, THE SECOND TIME BY SOMEONE WHO KNEW THE RULE.
 * PR #210 was force-pushed at 22:06:44 on 2026-09-20 and had no run against its
 * new head for four minutes and five seconds, while `gh pr checks` answered
 * from the pre-rebase commit. PR #221 was merged at 00:11:39 on 2026-09-21; its
 * head's CI finished at 00:15:21, three minutes and forty-two seconds later.
 * Both went green afterwards, so nothing broke either time -- which is exactly
 * what makes the class invisible, and why this is a test rather than a sentence
 * added to the gotchas the dispatcher had already read.
 *
 * THE SEAM IS THE SCRIPT'S OWN PROCESS BOUNDARY, and the fixture is a WORLD
 * rather than a recording of calls. `gh` is stubbed to answer for one PR and
 * for each commit's check-runs SEPARATELY, so a gate that asks about the
 * pull request gets the stale green and a gate that asks about the head gets
 * the truth. Nothing here asserts which arguments were passed: the test states
 * the world and reads the verdict, so the gate stays free to change how it
 * asks as long as it keeps asking about the right commit.
 */
const dispatch = (script: string) => join(repoRoot, ".claude", "skills", "dispatch", script);

/**
 * One PR, and what each commit's check-runs say -- the two answers `gh` gives
 * and the only two the gate has to go on.
 *
 * `checks` IS KEYED BY COMMIT because that is the whole subject. A sha the map
 * does not hold is one GitHub has no check-runs for, which the stub answers the
 * way the API does rather than by inventing an empty list: `404`, on stderr,
 * non-zero. An empty ARRAY and a missing COMMIT are different worlds and the
 * gate is entitled to tell them apart.
 */
type World = {
  readonly pr: Record<string, unknown>;
  readonly checks: Readonly<Record<string, readonly Record<string, unknown>[]>>;
  /** A `total_count` this many higher than the runs actually handed over. */
  readonly shortBy?: number;
};

/** A check-run as the gate reads one: a name, a status and a conclusion. */
const check = (name: string, conclusion: string, status = "completed") => ({
  name,
  status,
  conclusion,
});

/**
 * Run the gate against a world, through a `gh` that exists only for this call.
 *
 * The stub goes FIRST on `PATH` in a directory of its own, so the real `gh` is
 * shadowed rather than reconfigured and no test here can reach the network or
 * this repository's actual pull requests.
 */
function inAWorldOf(world: World, script: string, args: readonly string[]) {
  const dir = mkdtempSync(join(tmpdir(), "merge-gate-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(dir, "pr.json"), JSON.stringify(world.pr));
  for (const [sha, runs] of Object.entries(world.checks)) {
    // GITHUB'S OWN PAGING, because it is what the gate has to get past. The
    // check-runs endpoint answers 30 per page by default and states the real
    // size in `total_count`, so an unpaged read of #210's head returned 30 of
    // 32 and said so in a field nothing was reading.
    const total = world.shortBy === undefined ? runs.length : runs.length + world.shortBy;
    writeFileSync(
      join(dir, `checks-${sha}.json`),
      JSON.stringify({ total_count: total, check_runs: runs.slice(0, 30) }),
    );
    writeFileSync(
      join(dir, `checks-${sha}.all.json`),
      JSON.stringify([{ total_count: total, check_runs: runs }]),
    );
  }
  writeFileSync(
    join(bin, "gh"),
    [
      "#!/usr/bin/env bash",
      `dir=${JSON.stringify(dir)}`,
      'printf "%s\n" "$*" >> "$dir/calls.log"',
      'if [ "$1 $2" = "pr view" ]; then cat "$dir/pr.json"; exit 0; fi',
      'if [ "$1 $2" = "pr merge" ]; then exit 0; fi',
      'if [ "$1" = "api" ]; then',
      '  sha=$(printf %s "$*" | sed -n "s|.*/commits/\\([0-9a-f]*\\)/check-runs.*|\\1|p")',
      '  page="$dir/checks-$sha.json"',
      '  case "$*" in *--slurp*) page="$dir/checks-$sha.all.json";; esac',
      '  if [ -f "$page" ]; then cat "$page"; exit 0; fi',
      '  echo "gh: Not Found (HTTP 404)" >&2; exit 1',
      "fi",
      'echo "gh: unstubbed $*" >&2; exit 1',
      "",
    ].join("\n"),
  );
  chmodSync(join(bin, "gh"), 0o755);
  const ran = spawnSync("bash", [dispatch(script), ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
  });
  const calls = existsSync(join(dir, "calls.log"))
    ? readFileSync(join(dir, "calls.log"), "utf8").split("\n").filter(Boolean)
    : [];
  return {
    status: ran.status,
    output: `${ran.stdout}${ran.stderr}`,
    merged: calls.some((call) => call.startsWith("pr merge")),
    dir,
  };
}

const gateAgainst = (world: World, args: readonly string[] = ["210"]) =>
  inAWorldOf(world, "gate.sh", args);

/** PR #210's two commits, by the shas the incident is recorded under. */
const REBASED = "439cc3cd9607c40c0d4850fad4cfa6f67de5f1e5";
const PRE_REBASE = "48f10832e58461df433f9a254fc02dba673199b0";

describe("a check the gate reads", () => {
  it("is evidence only for the commit it ran against, so a rebase blocks on its own outcome", () => {
    const { status, output } = gateAgainst({
      pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" },
      checks: {
        [REBASED]: [],
        [PRE_REBASE]: [check("Test", "success"), check("Build", "success")],
      },
    });

    expect(output).toContain("NO-RUN");
    expect(output).toContain(REBASED.slice(0, 7));
    expect(status).not.toBe(0);
  });

  /**
   * ZERO HAS NO TIMESTAMP ON IT, which is the half the dispatcher was missing
   * rather than the rule itself. A commit pushed seconds ago and a commit whose
   * branch conflicts both answer with no check-runs, and the first clears by
   * waiting while the second never does: `.claude/rules/workflows.md` already
   * carried the second as "AN ABSENT CHECK IS THE TELL", so a reader who knew
   * that gotcha and met the first reads "conflicted" over "not yet" -- or, as
   * on #221, "not yet" over a run that had started and was still going.
   *
   * SO THE GATE SAYS WHICH, and it costs one more field on a call it was
   * already making. It blocks on both: the difference is what the dispatcher
   * does next, and a gate that leaves that to be inferred is one that gets it
   * inferred wrong under time pressure.
   */
  it("distinguishes a zero that will clear from a zero that never will", () => {
    const conflicted = gateAgainst({
      pr: { headRefOid: REBASED, mergeStateStatus: "DIRTY" },
      checks: { [REBASED]: [] },
    });
    const justPushed = gateAgainst({
      pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" },
      checks: { [REBASED]: [] },
    });

    expect(conflicted.output).toContain("NO-RUN");
    expect(conflicted.output).toMatch(/conflict/i);
    expect(conflicted.status).not.toBe(0);

    expect(justPushed.output).toContain("NO-RUN");
    expect(justPushed.output).not.toMatch(/conflict/i);
    expect(justPushed.status).not.toBe(0);
  });

  /**
   * A RUN THAT EXISTS IS NOT A RUN THAT ANSWERED, and this is the half that
   * caught #221 rather than #210. Its head's run was created at 00:11:01 on
   * 2026-09-21 and finished at 00:15:21; the merge went in at 00:11:39, with
   * one check-run completed and the rest still going. It passed afterwards, so
   * the merge looks correct in hindsight and the gate that allowed it was
   * reading a commit whose answer did not exist yet.
   *
   * IT IS A SEPARATE OUTCOME FROM `NO-RUN` because the remedies differ by more
   * than waiting: a commit with no run may need a push or a merge of main to
   * get one, and a commit whose run is going needs nothing but patience.
   */
  it("refuses a head whose run has started and not finished", () => {
    const { status, output } = gateAgainst({
      pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" },
      checks: {
        [REBASED]: [
          check("Lint", "success"),
          check("Test", null as unknown as string, "in_progress"),
        ],
      },
    });

    expect(output).toContain("RUNNING");
    expect(output).toContain("Test");
    expect(output).not.toContain("NO-RUN");
    expect(status).not.toBe(0);
  });

  /** A failure is the outcome the gate was already good at, and it names which. */
  it("refuses a head carrying a failure, and says which check it was", () => {
    const { status, output } = gateAgainst({
      pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" },
      checks: {
        [REBASED]: [check("Lint", "success"), check("Migration ladder", "failure")],
      },
    });

    expect(output).toContain("FAILED");
    expect(output).toContain("Migration ladder");
    expect(output).not.toContain("NO-RUN");
    expect(status).not.toBe(0);
  });

  /**
   * `cancelled` MEANS SUPERSEDED BY A NEWER PUSH, NOT BROKEN. This repository's
   * `ci.yml` sets `cancel-in-progress: true` on a group keyed by the head ref,
   * so every force-push leaves a trail of cancelled runs behind it -- #210's
   * head carries thirteen of them beside nineteen that answered. Reading those as
   * failures produced a false "genuine breakage" claim on 2026-09-20.
   *
   * It still BLOCKS when nothing else ran, because a commit whose only runs
   * were killed has no more evidence behind it than one with no runs at all.
   */
  it("blocks on runs that were all superseded, without calling them failures", () => {
    const { status, output } = gateAgainst({
      pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" },
      checks: { [REBASED]: [check("Test", "cancelled"), check("Build", "cancelled")] },
    });

    expect(output).toContain("SUPERSEDED");
    expect(output).not.toContain("FAILED");
    expect(status).not.toBe(0);
  });

  /** And the one case that lets a merge through: every check ran, on this commit, and passed. */
  it("passes a head whose own checks all completed without failing", () => {
    const { status, output } = gateAgainst({
      pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" },
      checks: {
        [REBASED]: [
          check("Test", "success"),
          check("Build", "success"),
          check("One image, both architectures", "skipped"),
          check("Test", "cancelled"),
        ],
      },
    });

    expect(output).toContain("PASSED");
    expect(output).toContain(REBASED.slice(0, 7));
    expect(status).toBe(0);
  });
  /**
   * THIRTY IS THE PAGE AND THIRTY-TWO WAS THE ANSWER. `/commits/<sha>/check-runs`
   * serves 30 per page by default, and #210's head carries 32 -- nineteen that
   * answered and thirteen a force-push cancelled. An unpaged read saw 30 of
   * them and reported a verdict on the 30, with the real size sitting in a
   * `total_count` field nothing looked at.
   *
   * IT IS THIS RECORD'S OWN DEFECT ONE LEVEL DOWN: a partial read presenting as
   * a complete one. A failure on the second page is a failure the gate passes.
   */
  it("sees a failure that sits beyond the first page of check-runs", () => {
    const many = Array.from({ length: 31 }, (_, i) => check(`Shard ${i}`, "success"));

    const { status, output } = gateAgainst({
      pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" },
      checks: { [REBASED]: [...many, check("Migration ladder", "failure")] },
    });

    expect(output).toContain("FAILED");
    expect(output).toContain("Migration ladder");
    expect(status).not.toBe(0);
  });

  /**
   * AND A READ THAT CAME BACK SHORT IS NOT AN ANSWER EITHER. `total_count` is
   * what the commit really holds; a verdict given over fewer than that is a
   * verdict over a page. It is reported as UNREADABLE rather than as a result,
   * because the gate did not fail to like what it saw -- it failed to see.
   */
  it("refuses a check-runs read that came back short of what it says it holds", () => {
    const { status, output } = gateAgainst({
      pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" },
      checks: { [REBASED]: [check("Test", "success")] },
      shortBy: 4,
    });

    expect(output).toContain("UNREADABLE");
    expect(output).toContain("1 check-runs of 5");
    expect(output).not.toContain("PASSED");
    expect(status).not.toBe(0);
  });
});

/**
 * THE GATE AND THE MERGE ARE ONE COMMAND, so the guard cannot be stepped past.
 *
 * The gate was being run as `gate.py | tail -2 && gh pr merge`, and a
 * pipeline's exit status is the LAST command's -- `tail` always succeeds. The
 * guard printed `BLOCKED` and the merge ran anyway. Separating "show me" from
 * "decide" is what made that possible, so nothing here is piped and the script
 * that decides is the script that merges.
 *
 * This is why the pair landed in the repository together rather than the gate
 * alone. `CLAUDE.md`: "Machine state is not repo state." A gate that lives in
 * the dispatcher's scratch directory is a gate a fresh clone does not have and
 * nothing reviews, and a landed copy that is NOT the one actually run is that
 * same gap with a file in git to make it look closed.
 */
describe("the command that merges", () => {
  it("does not merge when the gate blocks", () => {
    const blocked = inAWorldOf(
      { pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" }, checks: { [REBASED]: [] } },
      "merge-if-green.sh",
      ["210"],
    );

    expect(blocked.merged).toBe(false);
    expect(blocked.output).toContain("NO-RUN");
    expect(blocked.status).not.toBe(0);
  });

  it("merges, squashed and with the branch deleted, when the head's own checks passed", () => {
    const green = inAWorldOf(
      {
        pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" },
        checks: { [REBASED]: [check("Test", "success"), check("Build", "success")] },
      },
      "merge-if-green.sh",
      ["210"],
    );

    expect(green.output).toContain("PASSED");
    expect(green.merged).toBe(true);
    expect(green.status).toBe(0);
  });

  /**
   * A WORKTREE WITH UNCOMMITTED WORK IS NOT ONE TO MERGE OVER. `CLAUDE.md`
   * makes removing the worktree the dispatcher's job "once nothing is
   * uncommitted and nothing unpushed", and the merge is the action that
   * authorises the removal, so the check belongs on this side of it.
   *
   * AND A PATH IT CANNOT CHECK BLOCKS RATHER THAN SKIPS, which is this
   * ticket's own shape applied to the gate's other half. A guard written as
   * "if the directory is there, check it" answers the same way for a clean
   * worktree and for a mistyped path -- an absence that presents as a pass,
   * which is the defect ADR-0181 exists to refuse.
   */
  it("refuses to merge over a worktree holding uncommitted work", () => {
    const worktree = mkdtempSync(join(tmpdir(), "merge-gate-wt-"));
    spawnSync("git", ["init", "-q"], { cwd: worktree });
    writeFileSync(join(worktree, "half-written.ts"), "export const x = 1;\n");

    const { merged, output, status } = inAWorldOf(
      {
        pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" },
        checks: { [REBASED]: [check("Test", "success")] },
      },
      "merge-if-green.sh",
      ["210", "CanonCore", worktree],
    );

    expect(merged).toBe(false);
    expect(output).toContain("half-written.ts");
    expect(status).not.toBe(0);
  });

  it("refuses a named worktree it cannot read, rather than passing over the absence", () => {
    const { merged, output, status } = inAWorldOf(
      {
        pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" },
        checks: { [REBASED]: [check("Test", "success")] },
      },
      "merge-if-green.sh",
      ["210", "CanonCore", join(tmpdir(), "no-such-worktree-cncore-288")],
    );

    expect(merged).toBe(false);
    expect(output).toMatch(/no-such-worktree-cncore-288/);
    expect(status).not.toBe(0);
  });
});
