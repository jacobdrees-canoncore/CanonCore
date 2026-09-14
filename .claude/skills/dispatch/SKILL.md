---
name: dispatch
description: "Merge ready PRs, remove their worktrees, recompute the frontier, say what each candidate changes and put it to the user to spend, watching Linear for state the worktrees no longer match. Run it by typing /dispatch; it is never entered by inference."
disable-model-invocation: true
---

`CLAUDE.md`'s **Implementing** is the contract: dispatch mode, whose job the worktree is, the fold
test. This is the LOOP that runs it, and the drift the loop leaks.

You do not implement and you do not dispatch. You read diffs, merge, remove worktrees, recompute
the frontier, and hand it back.

## The loop

Run `monitor.sh` (beside this file) under the Monitor tool, `persistent: true`, with `SCRATCH` set.
It wakes you on change and never on a heartbeat. One pass per event.

**1. Read the diff, then re-check its central claim.** A green check is not a review, and the PR's
own reasoning is not evidence either. Take the one load-bearing claim the work rests on and put it
back to its owner yourself: the npm registry, `schedule.json`, the tag ref, the running image, the
file on `main`, the installed `.d.ts` under `node_modules`, the Postgres on 55432 — which answers a
question about trigger or constraint semantics in one `docker exec` and answers it for the engine
this repo runs. Today that confirmed five action digests and a Vitest engines range, and it caught
a PR body asserting a fold it had not done. Done when the claim has a lookup from this run behind
it, not a citation you recognise.

**Read the declaration whole.** oRPC's `ORPCError` spends a paragraph warning that `instanceof`
breaks across Next.js dependency graphs, and four lines below it overrides
`static [Symbol.hasInstance]` to fix exactly that. Stopping at the warning manufactures a confident
finding the next line refutes.

**2. Merge, and remove the worktree in the same action.** Squash where the repo refuses merge
commits — then ancestry is the wrong safety test, so compare CONTENT against `origin/main` before
removing.

**A merge that claims a RUNG tells every live agent the new number, in the same action.** A rung is
a line on a ladder no ticket owns: the migration index, the shared fixture, a tool list. CNCORE-74
and CNCORE-119 each built `migration_12`; the second was still in its worktree when the first
merged, and one `terminal send` turned a silent overwrite into a renumber.

**3. Recompute the frontier.** Nothing else is doing it. A ticket is dispatchable when every file
it names is free of every open branch.

**A ticket filed mid-wave carries its dependency in PROSE and no edge under it.** Five of seven did
on 2026-09-12: each body named the ticket it was built on top of, and each read dispatchable to the
graph. Add the `blocked-by` yourself before it can reach an ask, and move it to Todo — the CLI
writes as an OAuth integration, so a ticket an agent filed lands in Backlog and Backlog is where the
frontier cannot see it.

**A wave's candidates collide with each other, not only with open branches.** This step frees each
ticket against what is already RUNNING and says nothing about the four you are about to start
together. Grep for the shared file before you claim there is none: CNCORE-160 and CNCORE-163 both
edit `.github/workflows/ci.yml`, one file holding every job, and "zero overlap between any two" was
claimed and then withdrawn in the same pass, 2026-09-14.

**4. Say what each candidate CHANGES.** A manifest is not an explanation.
`packages/tasks/src/registry.ts` and "unblocks 11" tell the user nothing about whether to spend an
agent on it. "A run whose opening write rejects leaves its key marked running for the life of the
process, so every later run is refused as already running — at three in the morning, which is when
these run" tells them exactly. For each candidate write **what is false today and what is true
after**, in the product's own terms. Paths come second, and only where two candidates share one.

You are reading each ticket's "What to build" back in one place rather than inventing it, so a
candidate you cannot put this way is one you have not read.

**5. ASK, with `AskUserQuestion`, and wait.** One option per ticket whose files are free, each
carrying what it CHANGES and what it unblocks, your recommendation first and labelled
`(Recommended)`. A candidate you leave out is named with what still blocks it, so the shape of the
frontier is visible and not just your pick of it.

Recomputing the frontier is yours; SPENDING it is the user's, and they invoke. A prose summary is
not the ask: it reads as a report and the next turn carries on building, which is how four agents
went out on "recalculate", 2026-09-11.

**6. Put the whole wave up before a worktree exists, and wait for a yes.** The chosen set, each
ticket's change in a line or two, the merge order any pair forces, and every file two of them share.
A set picked from options is not yet a wave the user has SEEN: the fold's two repos, the PR that has
to merge first, and the one workflow file two tickets both edit become visible only once the set is
fixed. Create a worktree first and the explanation is a report about work already running.

When the yes comes back: one ticket per worktree, `--prompt "/implement"` and nothing more. Fold
only on one reason to change (`CLAUDE.md`).

Done when every merged PR's worktree is gone and the frontier is in front of the user. New tickets
arriving is the review working; one arriving that nothing blocks belongs in the next ask rather than
in a worktree.

## Drift, and why it is yours

Linear cannot see a worktree, so the board lies in two directions and the monitor names both.
`DRIFT-BEHIND` is a ticket at Todo that something is already building — it invites a second agent
onto the same files. `DRIFT-STALE` is In Progress with nothing behind it: the work died, or it
merged and nobody closed the ticket.

`DRIFT-BEHIND` also fires on every ordinary dispatch, in the window between creating the worktree
and the PR opening, and clears itself when Linear sees the PR. It is a STANDING lie only after a
FOLD, because nothing in Linear knows a ticket is being built inside another ticket's branch. So
move folded tickets to In Progress in the same action as the brief, and add the pair to
`folded.txt`. `DRIFT-FILING` is `tracker-sweep`'s subject; that skill owns the repair.

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
- **`orca worktree set --linear-issue` answers `ok: true` and binds nothing.** Measured twice on
  2026-09-13, by path and by branch: `linkedIssue` stayed `null` both times. Bind at
  `worktree create` or not at all — an unbound worktree is invisible to `--current` and to the
  monitor, so a later `set` is not the repair it looks like.
