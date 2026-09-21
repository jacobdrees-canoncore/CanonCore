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
 * from the pre-rebase commit. PR #221 was merged at 00:11:39 on 2026-09-21 with
 * three of its sixteen check-runs completed; its head's CI finished at
 * 00:15:21, three minutes and forty-two seconds later.
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

/** The real `git`, kept so the stub below can hand it everything but `ls-remote`. */
const realGit =
  (spawnSync("which", ["git"], { encoding: "utf8" }).stdout ?? "").trim() || "/usr/bin/git";

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
/**
 * The fields of a pull request this gate reads, and no others -- a spread of a
 * `Record<string, unknown>` loses every known key, which is what put
 * `headRefOid` out of reach of the default above.
 */
type PullRequestFields = {
  readonly headRefOid?: string;
  readonly headRefName?: string;
  readonly mergeStateStatus?: string;
  readonly state?: string;
};

type World = {
  readonly pr: PullRequestFields;
  readonly checks: Readonly<Record<string, readonly Record<string, unknown>[]>>;
  /** A `total_count` this many higher than the runs actually handed over. */
  readonly shortBy?: number;
  /** What the branch's ref really points at, when it differs from the PR's field. */
  readonly branchTip?: string;
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
  // A BRANCH NAME UNLESS THE WORLD SAYS OTHERWISE, so only the test that is
  // ABOUT its absence has to mention it.
  const pr: PullRequestFields = { headRefName: "jacobdrees/cncore-244", ...world.pr };
  writeFileSync(join(dir, "pr.json"), JSON.stringify(pr));
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
  // A `git` that answers `ls-remote` from the world and hands everything else to
  // the real one, which `merge-if-green.sh` still needs for its worktree check.
  writeFileSync(
    join(bin, "git"),
    [
      "#!/usr/bin/env bash",
      'if [ "$1" = "ls-remote" ]; then',
      // ONLY FOR THE REF ACTUALLY ASKED FOR. A stub answering every ref cannot
      // tell a gate that queries the right branch from one that queries any
      // branch, and the tip check is the thing under test here.
      `  [ "$3" = ${JSON.stringify(`refs/heads/${pr.headRefName}`)} ] || exit 0`,
      `  printf '%s\\t%s\\n' ${JSON.stringify(world.branchTip ?? pr.headRefOid ?? "")} "$3"`,
      "  exit 0",
      "fi",
      `exec ${JSON.stringify(realGit)} "$@"`,
      "",
    ].join("\n"),
  );
  chmodSync(join(bin, "git"), 0o755);
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
    calls,
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

  /**
   * THE PR'S OWN HEAD FIELD LAGS A FORCE-PUSH, which makes resolving the head
   * from it necessary and not sufficient.
   *
   * MEASURED ON THIS TICKET'S OWN BRANCH, 2026-09-21. Seconds after a rebase
   * and force-push, `git ls-remote` reported the new tip while
   * `gh pr view --json headRefOid` still answered with the PRE-REBASE commit,
   * and the gate duly gave a verdict about it -- a commit that was no longer on
   * the branch and would not have been what merged. Both agreed moments later.
   *
   * SO THE HEAD IS CONFIRMED AGAINST A SECOND SOURCE. The two disagreeing is
   * not a verdict either way: it means the question was asked during the window
   * where GitHub has the push and the pull request does not, and the honest
   * answer is to refuse and look again.
   */
  it("refuses while the PR's head and the branch's real tip disagree", () => {
    const { status, output } = gateAgainst({
      pr: { headRefOid: PRE_REBASE, mergeStateStatus: "CLEAN", headRefName: "jacobdrees/x" },
      checks: { [PRE_REBASE]: [check("Test", "success"), check("Build", "success")] },
      branchTip: REBASED,
    });

    expect(output).toContain("BLOCKED");
    expect(output).toContain(REBASED.slice(0, 7));
    expect(output).toContain(PRE_REBASE.slice(0, 7));
    expect(output).not.toContain("PASSED");
    expect(status).not.toBe(0);
  });

  /**
   * A PULL REQUEST THAT IS ALREADY CLOSED IS NOT A MERGE CANDIDATE, and it has
   * to say so in those words. `--delete-branch` takes the head ref away with
   * the merge, so the tip check above finds no ref and would otherwise report
   * `UNREADABLE cannot read refs/heads/...` -- a symptom, phrased as though
   * something were broken, at a dispatcher who would then go looking for it.
   * Observed on #210 and #221 the moment the tip check landed.
   */
  it("says a closed pull request is closed, rather than blaming its missing branch", () => {
    const { status, output } = gateAgainst({
      pr: {
        headRefOid: REBASED,
        headRefName: "jacobdrees/cncore-244",
        mergeStateStatus: "UNKNOWN",
        state: "MERGED",
      },
      checks: { [REBASED]: [check("Test", "success")] },
    });

    expect(output).toContain("MERGED");
    expect(output).not.toContain("UNREADABLE");
    expect(status).not.toBe(0);
  });

  /**
   * A CONCLUSION THIS GATE HAS NEVER HEARD OF BLOCKS, rather than falling
   * through to the pass.
   *
   * The first version listed the bad conclusions and the good ones and let
   * anything else past, which is the spec line's own defect wearing a third
   * hat: `stale` is a documented check-run conclusion that **only GitHub sets**
   * (its REST docs: "You cannot change a check run conclusion to stale, only
   * GitHub can set this"), so it can appear on a commit with no warning and
   * without this repository doing anything. Beside one `success` it read
   * `PASSED`.
   *
   * SO THE GOOD SET IS THE CLOSED ONE and everything else is refused by name.
   * That is the reading that survives GitHub adding a value, which is the only
   * assumption worth making about somebody else's enum.
   */
  it("blocks a conclusion it does not know, naming it rather than passing it", () => {
    const { status, output } = gateAgainst({
      pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN", headRefName: "b" },
      checks: { [REBASED]: [check("Lint", "success"), check("Test", "stale")] },
    });

    expect(output).toContain("Test");
    expect(output).toContain("stale");
    expect(output).not.toContain("PASSED");
    expect(status).not.toBe(0);
  });

  /**
   * THE REPOSITORY ARGUMENT REACHES A URL AND A CLONE ADDRESS, so its shape is
   * checked before either is built. It is typed by a dispatcher rather than
   * taken from a stranger, which is why this is a shape check and not an
   * allowlist: a list of three names is a fourth repository's maintenance
   * burden, while `..` in a path segment is never anything but a mistake.
   *
   * IT REFUSES BEFORE IT ASKS, which is the part worth asserting -- a guard
   * that builds the wrong URL and then judges the answer has already made the
   * request.
   */
  it("refuses a repository name that is not one, before it asks anything", () => {
    const { status, output, calls } = gateAgainst(
      { pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN" }, checks: { [REBASED]: [] } },
      ["210", "../../orgs/somebody-else"],
    );

    expect(calls).toStrictEqual([]);
    expect(output).toContain("BLOCKED");
    expect(status).not.toBe(0);
  });

  /**
   * AND A PULL REQUEST WITH NO BRANCH NAME IS SAID IN THOSE WORDS. Without the
   * check the ref becomes `refs/heads/` and the refusal reads "cannot read
   * refs/heads/ in ...", which sends its reader looking for a git problem --
   * the same misdirection the closed-PR outcome above exists to remove.
   */
  it("says a pull request names no branch, rather than asking for an empty ref", () => {
    const { status, output } = gateAgainst({
      pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN", headRefName: "" },
      checks: { [REBASED]: [check("Test", "success")] },
    });

    expect(output).toContain("BLOCKED");
    expect(output).not.toContain("refs/heads/ ");
    expect(status).not.toBe(0);
  });
});

/**
 * A throwaway repository with an upstream, for the worktree half of the merge
 * command. `pushed` commits reach the bare origin; `held` ones stay local, which
 * is the "nothing unpushed" half of the condition `CLAUDE.md` puts on removing a
 * worktree.
 */
function aRepoWith({ held = 0 }: { held?: number } = {}) {
  const origin = mkdtempSync(join(tmpdir(), "merge-gate-origin-"));
  spawnSync("git", ["init", "--bare", "-q", origin]);
  const worktree = mkdtempSync(join(tmpdir(), "merge-gate-wt-"));
  const git = (...args: string[]) =>
    spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: worktree });

  git("init", "-q", "-b", "main");
  writeFileSync(join(worktree, "landed.ts"), "export const landed = 1;\n");
  git("add", "-A");
  git("commit", "-qm", "landed");
  git("remote", "add", "origin", origin);
  git("push", "-q", "-u", "origin", "main");

  for (let i = 0; i < held; i++) {
    writeFileSync(join(worktree, `held-${i}.ts`), `export const held${i} = 1;\n`);
    git("add", "-A");
    git("commit", "-qm", `held ${i}`);
  }
  return worktree;
}

const greenWorld = {
  pr: { headRefOid: REBASED, mergeStateStatus: "CLEAN", headRefName: "b" },
  checks: { [REBASED]: [check("Test", "success")] },
} as const;

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

  /**
   * NOTHING UNPUSHED IS THE OTHER HALF OF THE CONDITION, and the guard was
   * citing it while checking only the first. `CLAUDE.md` makes removing a
   * worktree conditional on "nothing is uncommitted and nothing unpushed", and
   * a commit that never reached the remote is not in the pull request -- so
   * merging lands work that is missing a piece its author already wrote, and
   * the worktree removal that follows destroys it.
   *
   * A HALF-GUARD CITING A WHOLE CONDITION is this ticket's own defect in the
   * comment rather than the code: it reads as covering more than it refuses.
   */
  it("refuses to merge over a worktree holding commits the remote has not got", () => {
    const { merged, output, status } = inAWorldOf(greenWorld, "merge-if-green.sh", [
      "210",
      "CanonCore",
      aRepoWith({ held: 2 }),
    ]);

    expect(merged).toBe(false);
    expect(output).toMatch(/unpushed|not pushed|ahead/i);
    expect(status).not.toBe(0);
  });

  /**
   * AND THE PATH HAS TO BE THE WORKTREE, not merely inside one. `git -C` walks
   * UP to the enclosing repository, so a path that is a subdirectory -- or a
   * mistyped path that still lands inside some checkout -- gets a clean report
   * about a repository nobody asked about, while the worktree meant by the
   * argument goes unread. The guard above only fails safe if the thing it read
   * is the thing that was named.
   */
  it("refuses a path that is inside a repository rather than the root of one", () => {
    const worktree = aRepoWith();
    const inside = join(worktree, "packages");
    mkdirSync(inside);

    const { merged, output, status } = inAWorldOf(greenWorld, "merge-if-green.sh", [
      "210",
      "CanonCore",
      inside,
    ]);

    expect(merged).toBe(false);
    expect(output).toContain("packages");
    expect(status).not.toBe(0);
  });

  /** And a worktree that really is clean and really is pushed does not stop it. */
  it("merges over a worktree that is clean and fully pushed", () => {
    const { merged, status } = inAWorldOf(greenWorld, "merge-if-green.sh", [
      "210",
      "CanonCore",
      aRepoWith(),
    ]);

    expect(merged).toBe(true);
    expect(status).toBe(0);
  });
});
