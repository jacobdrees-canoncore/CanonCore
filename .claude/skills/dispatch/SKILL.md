---
name: dispatch
description: "Merge ready PRs, remove their worktrees, recompute the frontier and dispatch what frees up, watching Linear for state the worktrees no longer match. Run it by typing /dispatch; it is never entered by inference."
disable-model-invocation: true
---

`CLAUDE.md`'s **Implementing** is the contract: dispatch mode, whose job the worktree is, the fold
test. This is the LOOP that runs it, and the drift the loop leaks.

You do not implement. You read diffs, merge, remove worktrees, recompute the frontier, dispatch.

## The loop

Run `monitor.sh` (beside this file) under the Monitor tool, `persistent: true`, with `SCRATCH` set.
It wakes you on change and never on a heartbeat. One pass per event.

**1. Read the diff, then re-check its central claim.** A green check is not a review, and the PR's
own reasoning is not evidence either. Take the one load-bearing claim the work rests on and put it
back to its owner yourself: the npm registry, `schedule.json`, the tag ref, the running image, the
file on `main`. Today that confirmed five action digests and a Vitest engines range, and it caught
a PR body asserting a fold it had not done. Done when the claim has a lookup from this run behind
it, not a citation you recognise.

**2. Merge, and remove the worktree in the same action.** Squash where the repo refuses merge
commits — then ancestry is the wrong safety test, so compare CONTENT against `origin/main` before
removing.

**3. Recompute the frontier.** Nothing else is doing it. A ticket is dispatchable when every file
it names is free of every open branch.

**4. Dispatch what the files freed.** One ticket per worktree, `--prompt "/implement"` and nothing
more. Fold only on one reason to change (`CLAUDE.md`).

Done when no open ticket has a free file set and no PR is unmerged. New tickets arriving is the
review working; a ticket arriving that nothing blocks is the loop's next pass, not its end.

## Drift, and why it is yours

Linear cannot see a worktree, so the board lies in two directions and the monitor names both.
`DRIFT-BEHIND` is a ticket at Todo that something is already building — it invites a second agent
onto the same files. `DRIFT-STALE` is In Progress with nothing behind it: the work died, or it
merged and nobody closed the ticket.

Both appear the moment you FOLD, never later, because nothing in Linear knows a ticket is being
built inside another ticket's branch. So move folded tickets to In Progress in the same action as
the brief, and add the pair to `folded.txt`. `DRIFT-FILING` is `tracker-sweep`'s subject; that skill
owns the repair.

## Twins

The two provider repos' `ci.yml` and `dependabot.yml` are deliberate twins. One agent takes both
repos and opens a PR in each naming the other. After merging the pair, diff the two files and
confirm the only difference is the one each repo owns. Two agents, or one repo alone, is how they
diverge — CNCORE-41, 45 and 57 are each that divergence found later.

## Gotchas

- **`orca terminal send` truncates a long message, silently.** The agent acts on the fragment. Keep
  each send to a couple of hundred bytes and split; read the terminal back to confirm it landed.
  This cost CNCORE-40 a whole pass.
- **One worktree can hold two terminals.** Match on `agentIdentity: claude` — a handle list of two
  makes a malformed `--terminal` and the send fails.
- **An agent's view of `main` goes stale while it works.** It will propose stacking on a branch you
  deleted. Say what merged and when.
- **`save-issue` reports `linear_write_unconfirmed` on writes that landed.** Read back rather than
  retry.
