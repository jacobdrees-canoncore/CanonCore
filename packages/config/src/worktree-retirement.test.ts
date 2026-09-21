import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";

import { repoRoot } from "./testing/repo-root";

/**
 * THE RETIREMENT GATE, HELD TO THE ONE THING IT EXISTS TO REFUSE (CNCORE-334).
 *
 * `/dispatch` step 2 is "merge, and remove the worktree in the same action",
 * and it states the safety rule for the second half: a squash merge makes
 * ancestry the wrong test, so CONTENT is compared against `origin/main` before
 * anything is removed. `CLAUDE.md` adds the third step, "then drop its
 * databases". Until this suite existed, nothing in the repository implemented
 * either -- `merge-if-green.sh` guards the MERGE half and its last line is
 * `gh pr merge`.
 *
 * MEASURED, AND IT HAS ALREADY COST ONE PASS. On 2026-09-21 cncore-316's
 * worktree was removed in the same command as the content comparison, so the
 * removal ran before the DIFF lines were read. Two files differed; both turned
 * out to be `main` running ahead, so nothing was lost -- by the order the shell
 * happened to run things, not by any check. "main is ahead" and "content was
 * lost" are the two readings of a DIFF line and only one of them is safe.
 *
 * THE SEAM IS THE SCRIPT'S OWN PROCESS BOUNDARY, as it is for the merge gate
 * beside it, and the fixture is a WORLD rather than a recording of calls: a
 * real bare origin, a real linked worktree, and a real squash merge onto
 * `main`. `orca` and `pnpm` are stubbed so the removal and the drop are
 * observable without happening, and nothing here asserts which git commands the
 * script ran. The test states the world and reads the verdict, so the script
 * stays free to change how it asks as long as it keeps asking about content.
 */
const retire = join(repoRoot, ".claude", "skills", "dispatch", "retire.sh");

/** The two files every world below starts with, so a test names only what it changes. */
const CARRIED = "docs/carried.md";
const OTHER = "packages/other.ts";

type Edit = Readonly<Record<string, string>>;

type World = {
  /** What the branch changed, and therefore what the comparison iterates. */
  readonly branch: Edit;
  /** What the squash merge took onto `main` -- by default everything the branch changed. */
  readonly squashed?: Edit;
  /** What `main` did AFTER the squash, under a subject of its own. */
  readonly after?: Edit;
  /** The subject the squash landed under; the repo's shape is `CNCORE-<n>: title (#pr)`. */
  readonly subject?: string;
  /** Work left uncommitted in the worktree when retirement is attempted. */
  readonly uncommitted?: Edit;
  /** Commits the remote never got. */
  readonly held?: Edit;
  /** Files the branch DELETED, and the squash takes the deletion unless `squashed` says otherwise. */
  readonly deleted?: readonly string[];
  /** False for a main checkout's package.json with no `db:drop-worktree` -- a provider repo. */
  readonly databases?: boolean;
  /** Push the branch, so it has an upstream; false is a branch never pushed at all. */
  readonly pushed?: boolean;
  /** The remote branch deleted and pruned, exactly as `--delete-branch` leaves it. */
  readonly upstreamGone?: boolean;
  /** Auxiliary git worktrees registered in the repo, the kind `orca worktree list` cannot see. */
  readonly aux?: readonly Aux[];
  /** A second Orca worktree beside the retiring one, which is another ticket's. */
  readonly sibling?: boolean;
};

/**
 * An auxiliary git worktree: one a ticket made with `git worktree add` for a
 * job of its own, registered in the repo's `.git/worktrees/` and living
 * wherever it was put.
 */
type Aux = {
  readonly name: string;
  /** `branch` is the retiring ticket's tip; `main` is a commit every branch shares. */
  readonly at: "branch" | "main";
  /** A TRACKED file changed in it, which is work somebody would lose. */
  readonly dirty?: boolean;
  /** An untracked scratch install, which is what cncore-333's three really held. */
  readonly scratch?: boolean;
  /** The tree deleted by hand, leaving only the registration behind. */
  readonly treeGone?: boolean;
  /** A `gitdir` file written by hand, for the paths this script must refuse to remove. */
  readonly gitdirSays?: string;
};

const TICKET = 334;
const BRANCH = `jacobdrees/cncore-${TICKET}`;

/**
 * A repository with a bare origin, a `main` checkout, and a linked worktree
 * holding a merged ticket's branch.
 *
 * THE WORKTREE IS A REAL LINKED ONE, created with `git worktree add`, because
 * telling a worktree from a main checkout is one of the things under test and
 * `--git-dir` against `--git-common-dir` is the only place that difference
 * shows. A directory that merely looks like a worktree cannot exercise it.
 */
function aMergedTicket(world: World) {
  const home = mkdtempSync(join(tmpdir(), "retire-"));
  // EVERY WORLD BELOW LIVES UNDER `home`, AND IT GOES WHEN THE TEST DOES.
  // A suite that leaves its fixtures behind fills `/private/tmp` at the rate it
  // runs: the merge gate's sites beside this one had left 7,547 directories and
  // 1.36 GB there by the morning of 2026-09-21 (CNCORE-336).
  onTestFinished(() => rmSync(home, { recursive: true, force: true }));
  const origin = join(home, "origin.git");
  const main = join(home, "projects", "CanonCore");
  const worktree = join(home, "workspaces", "CanonCore", `cncore-${TICKET}`);
  mkdirSync(join(home, "projects"), { recursive: true });
  mkdirSync(join(home, "workspaces", "CanonCore"), { recursive: true });
  spawnSync("git", ["init", "--bare", "-q", origin]);

  const run = (cwd: string, ...args: string[]) =>
    spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "-C", cwd, ...args], {
      encoding: "utf8",
    });
  const write = (root: string, edits: Edit) => {
    for (const [path, body] of Object.entries(edits)) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), body);
    }
  };

  spawnSync("git", ["clone", "-q", origin, main]);
  run(main, "symbolic-ref", "HEAD", "refs/heads/main");
  write(main, { [CARRIED]: "as forked\n", [OTHER]: "export const other = 1;\n" });
  // A main checkout is told from a provider one by whether it has the script the
  // drop would run, which is what the retirement asks rather than the repo name.
  writeFileSync(
    join(main, "package.json"),
    JSON.stringify({
      name: "root",
      scripts:
        (world.databases ?? true) ? { "db:drop-worktree": "turbo run db:drop-worktree" } : {},
    }),
  );
  run(main, "add", "-A");
  run(main, "commit", "-qm", "the fork point");
  run(main, "push", "-q", "-u", "origin", "main");

  run(main, "worktree", "add", "-q", "-b", BRANCH, worktree);
  write(worktree, world.branch);
  for (const path of world.deleted ?? []) rmSync(join(worktree, path), { force: true });
  run(worktree, "add", "-A");
  run(worktree, "commit", "-qm", `CNCORE-${TICKET}: the branch's own work`);
  if (world.pushed ?? true) run(worktree, "push", "-q", "-u", "origin", BRANCH);

  // THE SQUASH, as `gh pr merge --squash` lands one: `main` takes the branch's
  // CONTENT under a subject of main's own, so none of the branch's commits is an
  // ancestor of `main` afterwards. That is what makes ancestry the wrong test.
  write(main, world.squashed ?? world.branch);
  // THE SQUASH TAKES THE DELETION ONLY WHEN `squashed` DOES NOT SAY OTHERWISE.
  // Applied unconditionally, a world meant to show a deletion that never
  // landed deleted the file on BOTH sides, so there was no difference to
  // report and the test passed the retirement it was written to stop.
  if (world.squashed === undefined) {
    for (const path of world.deleted ?? []) rmSync(join(main, path), { force: true });
  }
  run(main, "add", "-A");
  run(main, "commit", "-qm", world.subject ?? `CNCORE-${TICKET}: the branch's own work (#256)`);
  if (world.after) {
    write(main, world.after);
    run(main, "add", "-A");
    run(main, "commit", "-qm", "CNCORE-313: main moves on afterwards (#249)");
  }
  run(main, "push", "-q", "origin", "main");

  // THE MERGE TAKES THE REMOTE BRANCH WITH IT (`--delete-branch`), so by the
  // time retirement runs `@{u}` no longer resolves. Pruned, because a config
  // with `fetch.prune` set is what makes the stale tracking ref disappear.
  if (world.upstreamGone) {
    run(worktree, "push", "-q", "origin", "--delete", BRANCH);
    run(worktree, "fetch", "-q", "--prune", "origin");
  }

  for (const [path, body] of Object.entries(world.held ?? {})) {
    write(worktree, { [path]: body });
    run(worktree, "add", "-A");
    run(worktree, "commit", "-qm", "held back from the remote");
  }
  if (world.uncommitted) write(worktree, world.uncommitted);

  // ANOTHER TICKET'S ORCA WORKTREE, beside this one in the same workspace
  // directory. It is registered in the same `.git/worktrees/` and must survive
  // untouched: `orca worktree list` can see it and `/dispatch` already owns it.
  const sibling = join(home, "workspaces", "CanonCore", "cncore-999");
  if (world.sibling) run(main, "worktree", "add", "-q", "-b", "jacobdrees/cncore-999", sibling);

  // THE AUXILIARY TREES, PUT WHERE cncore-333 PUT ITS THREE: outside every
  // workspace, so nothing Orca knows about lists them.
  const elsewhere = join(home, "elsewhere");
  mkdirSync(elsewhere, { recursive: true });
  const aux: Record<string, string> = {};
  for (const tree of world.aux ?? []) {
    const path = join(elsewhere, tree.name);
    const at =
      tree.at === "branch"
        ? (run(worktree, "rev-parse", "HEAD").stdout ?? "").trim()
        : (run(main, "rev-parse", "main").stdout ?? "").trim();
    run(main, "worktree", "add", "-q", "--detach", path, at);
    if (tree.dirty) writeFileSync(join(path, CARRIED), "a job in progress\n");
    if (tree.scratch) mkdirSync(join(path, "node_modules"), { recursive: true });
    if (tree.treeGone) rmSync(path, { recursive: true, force: true });
    // THE REGISTRATION'S OWN RECORD OF WHERE THE TREE IS, rewritten. This is
    // the value the script reads out of a file and then removes, so the worlds
    // that matter most are the ones where it says something else.
    if (tree.gitdirSays !== undefined) {
      writeFileSync(join(main, ".git", "worktrees", tree.name, "gitdir"), tree.gitdirSays);
    }
    aux[tree.name] = path;
  }

  /**
   * Where a named auxiliary tree was put, THROWING on a name no world built.
   * `aux[name]` is `string | undefined` here, and an `existsSync(undefined)`
   * assertion reads as a passing test about a tree that was never made.
   */
  const auxPath = (name: string) => {
    const path = aux[name];
    if (path === undefined) throw new Error(`no auxiliary worktree '${name}' in this world`);
    return path;
  };

  return { home, main, worktree, sibling, auxPath, run };
}

/**
 * Run the retirement against a world, through an `orca` and a `pnpm` that exist
 * only for this call.
 *
 * The stubs go FIRST on `PATH` in a directory of their own, so the real
 * commands are shadowed rather than reconfigured: no test here can remove an
 * Orca worktree or reach the shared Postgres.
 */
function retiring(world: World, args?: readonly string[], extra?: readonly string[]) {
  const built = aMergedTicket(world);
  const bin = join(built.home, "bin");
  mkdirSync(bin);
  const log = join(built.home, "calls.log");
  for (const name of ["orca", "pnpm"]) {
    writeFileSync(
      join(bin, name),
      [
        "#!/usr/bin/env bash",
        `printf '${name} %s\\n' "$*" >> ${JSON.stringify(log)}`,
        "exit 0",
        "",
      ].join("\n"),
    );
    chmodSync(join(bin, name), 0o755);
  }

  const ran = spawnSync("bash", [retire, ...(args ?? [built.worktree]), ...(extra ?? [])], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
  });
  const calls = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
  return {
    ...built,
    status: ran.status,
    output: `${ran.stdout}${ran.stderr}`,
    calls,
    removed: calls.some((call) => call.startsWith("orca worktree rm")),
    dropped: calls.some((call) => call.includes("db:drop-worktree")),
  };
}

describe("a content difference the retirement cannot explain", () => {
  /**
   * THE INCIDENT, AS A TEST. The branch changed two files and the squash took
   * only one of them, which is what "content was lost" looks like from the
   * outside: a DIFF line, identical in shape to the one `main` running ahead
   * produces. A guard that cannot tell them apart is the guard cncore-316 did
   * not have.
   *
   * IT NAMES THE FILE, because "a difference main does not explain" without one
   * sends the dispatcher to `git diff` to find out which -- and the whole
   * failure being guarded against is a dispatcher reading a diff at speed.
   */
  it("stops, names the file, and leaves the worktree standing", () => {
    const { status, output, removed, dropped } = retiring({
      branch: { [CARRIED]: "the branch's version\n", [OTHER]: "export const other = 2;\n" },
      squashed: { [CARRIED]: "the branch's version\n" },
    });

    expect(output).toContain("UNEXPLAINED");
    expect(output).toContain(OTHER);
    expect(removed).toBe(false);
    expect(dropped).toBe(false);
    expect(status).not.toBe(0);
  });
});

describe("a content difference origin/main explains", () => {
  /**
   * `main` AHEAD IS THE OTHER READING OF THE SAME LINE, and it has to pass or
   * the guard refuses every ordinary retirement. The branch's change landed in
   * the squash and `main` edited the file again afterwards under another
   * ticket's subject, which is what cncore-316's two files really were.
   *
   * THE EVIDENCE IS THE BLOB, NOT THE TIMESTAMP. The ticket asked for "`main`
   * holds a later commit touching it", which is equally true of a file some
   * other ticket edited while THIS branch's change to it never merged -- the
   * unsafe reading, passed as though it were the safe one. So what is checked
   * is that some commit on `main` holds this file EXACTLY as the branch has it.
   * The test below that one is the pair this distinction exists for.
   */
  it("passes a file main took and then changed again, and retires the worktree", () => {
    const { status, output, removed, dropped, calls } = retiring({
      branch: { [CARRIED]: "the branch's version\n" },
      after: { [CARRIED]: "main moved on\n" },
    });

    expect(output).toContain("main-ahead");
    expect(output).toContain(CARRIED);
    expect(output).not.toContain("UNEXPLAINED");
    expect(removed).toBe(true);
    expect(dropped).toBe(true);
    expect(status).toBe(0);
    // THE DROP NAMES THE WORKTREE'S OWN BRANCH, read before the removal takes
    // it: `/dispatch` reached for `gh pr view --json headRefName` because by
    // then the local branch is usually gone, and the worktree it is about still
    // has it checked out.
    expect(calls.some((call) => call.includes(BRANCH))).toBe(true);
  });

  /**
   * AND A LATER COMMIT ON THE FILE IS NOT ITSELF THE EXPLANATION. This is the
   * same world as the first test -- the branch's change to `packages/other.ts`
   * never landed -- except that `main` has since edited that very file under
   * another ticket. A guard reading "does main hold a later commit touching it"
   * calls this explained and removes the worktree; the content is gone either
   * way.
   */
  it("refuses a file main edited later but never took the branch's version of", () => {
    const { status, output, removed } = retiring({
      branch: { [CARRIED]: "the branch's version\n", [OTHER]: "export const other = 2;\n" },
      squashed: { [CARRIED]: "the branch's version\n" },
      after: { [OTHER]: "export const other = 3;\n" },
    });

    expect(output).toContain("UNEXPLAINED");
    expect(output).toContain(OTHER);
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });

  /**
   * THE SECOND EXPLANATION THE TICKET NAMES: `main`'s history on the file
   * carries this ticket's subject. It is the case the blob test cannot reach --
   * the work landed and the merge, or a reviewer's amend, altered it on the way
   * -- so the content is on `main` under a version that was never the branch's.
   */
  it("passes a file whose history on main carries this ticket, though no blob matches", () => {
    const { status, output, removed } = retiring({
      branch: { [CARRIED]: "the branch's version\n" },
      squashed: { [CARRIED]: "resolved differently on the way in\n" },
    });

    expect(output).toContain("ticket-named");
    expect(output).toContain(CARRIED);
    expect(output).not.toContain("UNEXPLAINED");
    expect(removed).toBe(true);
    expect(status).toBe(0);
  });
});

describe("the condition CLAUDE.md puts on removing a worktree", () => {
  /**
   * "Once nothing is uncommitted and nothing unpushed". `merge-if-green.sh`
   * checks both before the merge that AUTHORISES the removal; this checks them
   * again at the removal itself, because the two are separate commands with a
   * review between them and the work can arrive in that window.
   */
  it("stops on uncommitted work and names it", () => {
    const { status, output, removed } = retiring({
      branch: { [CARRIED]: "the branch's version\n" },
      uncommitted: { "docs/half-written.md": "still typing\n" },
    });

    expect(output).toContain("half-written.md");
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });

  /**
   * A COMMIT THAT NEVER REACHED THE REMOTE IS NOT IN THE PULL REQUEST, so the
   * merge landed work missing a piece its author already wrote and the removal
   * would destroy the only copy.
   *
   * IT IS ASSERTED ON THE GUARD'S OWN WORD, not on the file's name. Written
   * with a fixture called `held.md` this test passed before the guard existed:
   * the content comparison reported `UNEXPLAINED docs/held.md` and the word
   * "held" in the PATH satisfied the regex. The comparison is a real backstop
   * here, which is exactly what made the vacuous version look sound.
   */
  it("stops on commits the remote never got, saying so rather than leaving it to the diff", () => {
    const { status, output, removed } = retiring({
      branch: { [CARRIED]: "the branch's version\n" },
      held: { "docs/extra.md": "committed here only\n" },
    });

    expect(output).toMatch(/unpushed/i);
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });

  /**
   * AND A MISSING UPSTREAM IS THE NORMAL STATE HERE, WHICH INVERTS
   * `merge-if-green.sh`'S READING OF THE SAME FACT. That script STOPS when a
   * worktree has no upstream to compare against, and it is right to: before the
   * merge, a branch with no upstream is one whose work is not in the pull
   * request. By the time retirement runs, `gh pr merge --squash
   * --delete-branch` has taken the remote branch away, so "no upstream" is what
   * a correctly merged ticket looks like. A guard copied across from the merge
   * side refuses every retirement it is handed.
   *
   * NOTHING IS GIVEN UP BY PASSING IT, because the content comparison above is
   * the stronger test: a branch that was never pushed has every file
   * UNEXPLAINED and stops there instead.
   */
  it("retires a merged worktree whose upstream the merge deleted", () => {
    const { status, output, removed } = retiring({
      branch: { [CARRIED]: "the branch's version\n" },
      upstreamGone: true,
    });

    expect(output).not.toMatch(/no upstream/i);
    expect(removed).toBe(true);
    expect(status).toBe(0);
  });
});

/**
 * AUXILIARY WORKTREES: THE LEAK `orca worktree list` CANNOT SEE.
 *
 * A ticket can run `git worktree add` for a job of its own -- the comment
 * scan's parser oracle wants HEAD, main and the previous commit checked out at
 * once -- and those trees are registered in the repo's `.git/worktrees/` while
 * living anywhere on disk. Orca never learns about them, so nothing lists them
 * and nothing retires them.
 *
 * MEASURED ON cncore-333, 2026-09-21: three trees at `/private/tmp/wt-head`,
 * `wt-main` and `wt-prev`, registered in `provider-wiki/.git/worktrees/`
 * beside its real Orca worktree and absent from `orca worktree list`.
 *
 * OWNERSHIP IS RECORDED NOWHERE, WHICH IS THE WHOLE DIFFICULTY. Each entry
 * holds a `gitdir` naming a path and a detached `HEAD` naming a sha, and
 * nothing that names a ticket. Of cncore-333's three, only `wt-head` sat on a
 * commit unique to its branch; `wt-main` and `wt-prev` sat on commits every
 * branch in the repo shares, so reachability cannot attribute them either. Age
 * cannot: they were two minutes old. Nor can uncommitted work: all three were
 * clean but for an untracked `node_modules` from a scratch install.
 *
 * SO THIS SCRIPT NEVER INFERS OWNERSHIP. It is TOLD, with `--aux <name>`, or
 * it STOPS and names what it found. Inferring it from what happens to be
 * reachable is the same move as reading "main holds a later commit" as "the
 * content landed" -- a plausible reading of a record that does not carry the
 * answer, which is the defect this whole script exists to refuse.
 */
describe("an auxiliary worktree the repo has registered", () => {
  it("stops the retirement, names it and its path, and removes nothing", () => {
    const { status, output, removed, dropped, auxPath } = retiring({
      branch: { [CARRIED]: "the branch's version\n" },
      aux: [{ name: "wt-main", at: "main", scratch: true }],
    });

    expect(output).toContain("UNATTRIBUTED");
    expect(output).toContain("wt-main");
    expect(output).toContain(auxPath("wt-main"));
    expect(existsSync(auxPath("wt-main"))).toBe(true);
    expect(removed).toBe(false);
    expect(dropped).toBe(false);
    expect(status).not.toBe(0);
  });

  /**
   * AND IT IS NOT ATTRIBUTED BY SITTING ON THE BRANCH'S OWN TIP EITHER, which
   * is the inference this script was closest to making. `wt-head` did sit on a
   * commit unique to cncore-333's branch -- but a tree checked out at your
   * commit is not a tree you own, and the agent that owns it may be mid-run.
   */
  it("stops on one sitting at the retiring branch's own tip", () => {
    const { status, output, removed } = retiring({
      branch: { [CARRIED]: "the branch's version\n" },
      aux: [{ name: "wt-head", at: "branch" }],
    });

    expect(output).toContain("UNATTRIBUTED");
    expect(output).toContain("wt-head");
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });

  /**
   * TOLD, IT TAKES THEM -- the tree AND its registration. `git worktree` is
   * denied by `.claude/settings.json` (`Bash(git worktree:*)`, which covers
   * `list`, `prune` and `remove` alike, measured 2026-09-21), so there is no
   * `git worktree remove` to call and the entry under `.git/worktrees/` has to
   * go by hand. Left behind, it is a registration git still honours pointing at
   * a path that no longer exists.
   */
  it("removes an asserted one, its registration included, and retires the worktree", () => {
    const { status, output, removed, auxPath, main } = retiring(
      {
        branch: { [CARRIED]: "the branch's version\n" },
        aux: [
          { name: "wt-head", at: "branch", scratch: true },
          { name: "wt-main", at: "main", scratch: true },
        ],
      },
      undefined,
      ["--aux", "wt-head", "--aux", "wt-main"],
    );

    expect(output).not.toContain("UNATTRIBUTED");
    expect(existsSync(auxPath("wt-head"))).toBe(false);
    expect(existsSync(auxPath("wt-main"))).toBe(false);
    expect(existsSync(join(main, ".git", "worktrees", "wt-head"))).toBe(false);
    expect(existsSync(join(main, ".git", "worktrees", "wt-main"))).toBe(false);
    expect(removed).toBe(true);
    expect(status).toBe(0);
  });

  /**
   * AN ASSERTION IS NOT A LICENCE TO DESTROY WORK. A tracked file changed in an
   * auxiliary tree is somebody's edit, and the retiring dispatcher naming the
   * tree does not make it theirs -- this is the same condition `CLAUDE.md` puts
   * on the worktree itself, applied wherever the work sits.
   */
  it("stops on one holding a tracked change, though it was asserted", () => {
    const { status, output, removed, auxPath } = retiring(
      {
        branch: { [CARRIED]: "the branch's version\n" },
        aux: [{ name: "wt-head", at: "branch", dirty: true }],
      },
      undefined,
      ["--aux", "wt-head"],
    );

    expect(output).toMatch(/uncommitted|tracked/i);
    expect(output).toContain("wt-head");
    expect(existsSync(auxPath("wt-head"))).toBe(true);
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });

  /**
   * A REGISTRATION WHOSE TREE IS ALREADY GONE IS PRUNED UNASKED, because there
   * is nothing left to break: no files, no agent, no work. This is what `git
   * worktree prune` would do, and it is denied here.
   */
  it("prunes a registration whose tree no longer exists", () => {
    const { status, output, removed, main } = retiring({
      branch: { [CARRIED]: "the branch's version\n" },
      aux: [{ name: "wt-gone", at: "main", treeGone: true }],
    });

    expect(output).not.toContain("UNATTRIBUTED");
    expect(existsSync(join(main, ".git", "worktrees", "wt-gone"))).toBe(false);
    expect(removed).toBe(true);
    expect(status).toBe(0);
  });

  /**
   * AND ANOTHER TICKET'S ORCA WORKTREE IS NOT AN AUXILIARY TREE. It is
   * registered in the same `.git/worktrees/`, but Orca lists it and
   * `/dispatch` retires it on its own PR. Sweeping it up here would remove a
   * live ticket's whole checkout.
   */
  it("leaves another ticket's Orca worktree alone", () => {
    const { status, output, removed, sibling } = retiring({
      branch: { [CARRIED]: "the branch's version\n" },
      sibling: true,
    });

    expect(output).not.toContain("cncore-999");
    expect(existsSync(sibling)).toBe(true);
    expect(removed).toBe(true);
    expect(status).toBe(0);
  });
});

/**
 * WHERE THE PATHS COME FROM, which is the half that made the scratch version
 * unusable for half the worktrees this repo creates.
 *
 * Nothing below is written down in the script. In a linked worktree `--git-dir`
 * is `<main>/.git/worktrees/<name>` while `--git-common-dir` is `<main>/.git`;
 * in a main checkout the two are equal. So ONE question both refuses a main
 * checkout and hands back where the drop has to run, and the same script
 * retires `~/orca/workspaces/provider-wiki/cncore-333` as it does a CanonCore
 * one. These worlds live under a fresh temporary directory, nowhere near
 * `~/orca`, which is the whole assertion.
 */
describe("the checkout the retirement is pointed at", () => {
  /**
   * A MAIN CHECKOUT IS NOT A WORKTREE TO RETIRE, and this is the refusal that
   * matters most: `~/orca/projects/CanonCore` is the Owner's own checkout and
   * its databases are the live install's (ADR-0192, ADR-0191). Nothing else in
   * the loop would catch it -- `orca worktree rm` is given the path it is
   * given.
   */
  it("refuses a main checkout, where removal would take the Owner's own", () => {
    const world = aMergedTicket({ branch: { [CARRIED]: "the branch's version\n" } });
    const { status, output, removed } = retiring({ branch: { [CARRIED]: "v\n" } }, [world.main]);

    expect(output).toMatch(/main checkout/i);
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });

  /** And a path it cannot read is refused rather than passed over. */
  it("refuses a path that is not a checkout at all", () => {
    const { status, output, removed } = retiring({ branch: { [CARRIED]: "v\n" } }, [
      join(tmpdir(), "no-such-worktree-cncore-334"),
    ]);

    expect(output).toContain("no-such-worktree-cncore-334");
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });

  /**
   * A PROVIDER WORKTREE HAS NO DATABASES, and that is asked of the checkout
   * rather than inferred from its name: does the drop this script would run
   * exist there at all. Listing the provider repos here instead would make a
   * fourth repository someone's maintenance burden.
   */
  it("retires a worktree whose repo has no database script, dropping nothing", () => {
    const { status, output, removed, dropped } = retiring({
      branch: { [CARRIED]: "the branch's version\n" },
      databases: false,
    });

    expect(removed).toBe(true);
    expect(dropped).toBe(false);
    expect(output).toMatch(/no db:drop-worktree/);
    expect(status).toBe(0);
  });

  /**
   * AND AN ASSERTION THAT MATCHED NOTHING IS A TYPO READING AS A CLEAN PASS.
   * The dispatcher named a tree, nothing was removed under that name, and
   * without this the retirement reports RETIRED over a tree still standing --
   * an absence presenting as a pass, which is the class ADR-0181 refuses.
   */
  it("refuses an --aux name that matches no registration", () => {
    const { status, output, removed } = retiring(
      {
        branch: { [CARRIED]: "the branch's version\n" },
        aux: [{ name: "wt-head", at: "branch", scratch: true }],
      },
      undefined,
      ["--aux", "wt-haed"],
    );

    expect(output).toMatch(/matches no registration/);
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });
});

/**
 * WHAT THE REMOVAL WILL NOT ACT ON, which is the half a review found rather
 * than the half that was designed.
 *
 * `$tree` is read out of a file under `.git/worktrees/<name>/gitdir` and is
 * then handed to `rm -rf`. The first guard written for it was a depth test,
 * `case "$tree" in /*\/*)`, which the OWNER'S HOME DIRECTORY passes -- two
 * components is all it has -- so a `gitdir` naming it would have removed it on
 * one `--aux`, and
 * `cd && pwd -P` resolves symlinks INTO whatever it names. What replaced it
 * asks git whether the path is a worktree sharing this repository's own common
 * directory, which is a question no unrelated path can answer.
 */
describe("a path the registration claims is a worktree", () => {
  it("is refused when git does not vouch for it, though it was asserted", () => {
    const outsider = mkdtempSync(join(tmpdir(), "retire-outsider-"));
    writeFileSync(join(outsider, "precious.txt"), "not this script's to remove\n");

    const { status, output, removed } = retiring(
      {
        branch: { [CARRIED]: "the branch's version\n" },
        aux: [{ name: "wt-head", at: "branch", gitdirSays: `${outsider}/.git` }],
      },
      undefined,
      ["--aux", "wt-head"],
    );

    expect(output).toContain("UNATTRIBUTED");
    expect(output).toMatch(/does not answer as a worktree/);
    expect(existsSync(join(outsider, "precious.txt"))).toBe(true);
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
    rmSync(outsider, { recursive: true, force: true });
  });

  /**
   * AND A `gitdir` OF MORE THAN ONE LINE IS REFUSED ON PURPOSE. The plan of
   * what to remove was once newline records split by `read -r entry tree`, so a
   * second line in this file became a second record whose first field was an
   * arbitrary absolute path -- and that path was `rm -rf`'d. The plan is
   * NUL-delimited now, which closes the injection; this refusal is the other
   * half, so the malformed file is reported rather than quietly pruned.
   */
  it("is refused when the registration names more than one path", () => {
    const { status, output, removed } = retiring(
      {
        branch: { [CARRIED]: "the branch's version\n" },
        aux: [{ name: "wt-head", at: "branch", gitdirSays: "/tmp/one/.git\n/tmp/two/.git\n" }],
      },
      undefined,
      ["--aux", "wt-head"],
    );

    expect(output).toMatch(/more than one line|not an absolute path/);
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });

  /**
   * NAMING A SIBLING ORCA WORKTREE IS REFUSED BY NAME. Skipped silently by the
   * sibling rule, the assertion then failed as "matches no registration" about
   * a registration that plainly does exist, which sends the dispatcher looking
   * for the wrong thing.
   */
  it("refuses an --aux naming another ticket's Orca worktree, saying which it is", () => {
    const { status, output, removed, sibling } = retiring(
      { branch: { [CARRIED]: "the branch's version\n" }, sibling: true },
      undefined,
      ["--aux", "cncore-999"],
    );

    expect(output).toMatch(/Orca worktree/);
    expect(output).not.toMatch(/matches no registration/);
    expect(existsSync(sibling)).toBe(true);
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });
});

describe("the ticket the explanations are read for", () => {
  /**
   * `--ticket` OVERRIDES THE DERIVATION, and until a review reproduced it the
   * flag was parsed and then thrown away by a leftover positional read four
   * lines on -- so it was advertised in the usage string, covered by no test,
   * and silently ignored. That matters for the provider criterion: a provider
   * worktree whose branch and directory carry no `CNCORE-<n>` loses the
   * `ticket-named` explanation with no way to supply it.
   */
  it("reads the explanations for the ticket the argument names", () => {
    const { output } = retiring({ branch: { [CARRIED]: "v\n" } }, undefined, [
      "--ticket",
      "CNCORE-999",
    ]);

    expect(output).toContain("CNCORE-999");
    expect(output).not.toContain("CNCORE-334");
  });

  it("refuses a --ticket that is not a CNCORE-<n>, since it reaches a grep pattern", () => {
    const { status, output, removed } = retiring({ branch: { [CARRIED]: "v\n" } }, undefined, [
      "--ticket",
      "CNCORE-.*",
    ]);

    expect(output).toMatch(/is not a CNCORE/);
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });
});

describe("what a stopped retirement leaves alone", () => {
  /**
   * AN ASSERTED TREE STILL GOES NOWHERE IF THE TICKET HAS NOT LANDED, which is
   * the dispatcher's added criterion -- "refuses to touch one whose owning
   * ticket is still open" -- met by construction rather than by a second
   * lookup. Ownership is recorded nowhere, so there is no ticket state to read;
   * what IS readable is whether THIS branch's content reached `main`, and every
   * removal sits behind that gate. A retirement that stops removes nothing.
   */
  it("removes no asserted auxiliary tree when the content comparison stops", () => {
    const { status, output, removed, auxPath } = retiring(
      {
        branch: { [CARRIED]: "the branch's version\n", [OTHER]: "export const other = 2;\n" },
        squashed: { [CARRIED]: "the branch's version\n" },
        aux: [{ name: "wt-head", at: "branch", scratch: true }],
      },
      undefined,
      ["--aux", "wt-head"],
    );

    expect(output).toContain("UNEXPLAINED");
    expect(existsSync(auxPath("wt-head"))).toBe(true);
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });

  /**
   * AND A DELETION THAT LANDED IS NOT A DIFFERENCE AT ALL, which is why the
   * blob test never having a blob for a deleted file is not the gap it looks
   * like. If the deletion reached `main`, neither side has the file and it is
   * never iterated; if `main` still HAS it, the deletion did NOT land and
   * stopping is the right answer. The one reading that would be wrong -- a
   * landed deletion reported UNEXPLAINED -- cannot arise.
   */
  it("does not report a deletion that landed on main", () => {
    const { status, output, removed } = retiring({
      branch: { [CARRIED]: "the branch's version\n" },
      deleted: [OTHER],
    });

    expect(output).not.toContain("UNEXPLAINED");
    expect(output).not.toContain(OTHER);
    expect(removed).toBe(true);
    expect(status).toBe(0);
  });

  /** And one that did NOT land stops it, because the file is still on `main`. */
  it("stops on a deletion main never took", () => {
    const { status, output, removed } = retiring({
      branch: { [CARRIED]: "the branch's version\n" },
      deleted: [OTHER],
      squashed: { [CARRIED]: "the branch's version\n", [OTHER]: "export const other = 1;\n" },
    });

    expect(output).toContain("UNEXPLAINED");
    expect(output).toContain(OTHER);
    expect(removed).toBe(false);
    expect(status).not.toBe(0);
  });
});
