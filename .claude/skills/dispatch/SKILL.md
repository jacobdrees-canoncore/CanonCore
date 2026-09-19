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
It wakes you on change and never on a heartbeat. One pass per event. Its header names every line it
emits; `ROOM` and `IDLE` are read under **How full**, the `DRIFT-` lines under **Drift**.

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

**THE ADR NUMBER IS A RUNG AND IT DOES NOT LOOK LIKE ONE.** `docs/adr/` is a ladder no ticket owns,
so two branches both take the next free number and the loser's CI dies on `adr-numbering.test.ts`.
CNCORE-177 took 0136 while CNCORE-167 was already holding it, 2026-09-16 — the guard caught what
the merge should have announced. Broadcast it with the migration index, and name what is CLAIMED
rather than only what is taken: told "0137 is CNCORE-167's", CNCORE-161 took 0138 unprompted.

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

**AND A TREE IS FILES, NOT A PACKAGE NAME.** Reading titles is not the check. CNCORE-177 was filed
as `packages/ui` and edited `apps/web/src/app/items/[id]/page.tsx` — the file CNCORE-176 was
rewriting, named in 177's own body under a title that says otherwise. 176 went DIRTY three times in
one pass for it. `docs/adr/0103` was edited by five tickets in one day. Run
`git diff --name-only origin/main...HEAD` over every live branch and compare it against what the
candidate actually names.

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

## How full

**`ROOM n` MEANS n SLOTS ARE FREE, AND THE MONITOR COUNTS THEM.** Do not count worktrees yourself; a
freed slot used to wait on you remembering to. Four is a CANONCORE count, from one `pnpm test:e2e`
peaking at 55-60 of 288 usable connections on the shared Postgres (CNCORE-137). `provider-wiki` runs
DuckDB fixtures and `provider-tmdb` hits the live API, so neither is in the four. Six agents with
four contending is the shape, not a breach.

**`IDLE <worktree>` MEANS AN AGENT HAS GONE QUIET: PARKED, FINISHED OR DEAD.** A spinner keeps its
output fresh, so silence is the tell, and one `terminal read` says which. A full slot count cannot
tell any of the three from working — three of four agents sat on their own `AskUserQuestion` prompts
while the count read full. Parked: answer what is technical and yours, and carry up only what
`CLAUDE.md` reserves for the user (money, a licence, a background service). Finished: merge and
remove. Dead: read the terminal before assuming the work is lost.

**`GONE <worktree>` MEANS NO AGENT AT ALL, AND THE WORK IS PROBABLY STILL THERE.** A session restart
killed two agents at once on 2026-09-19. Their worktrees held seven commits between them, five never
pushed, and their PRs read `+0` — which is exactly what an abandoned worktree looks like. Check
`git log @{u}..HEAD` before anything else, then resume the agent in its own session so it keeps its
context rather than re-reading the ticket over work it already committed:

```sh
orca terminal create --worktree path:<worktree> --title "Claude Code" \
  --command "claude --continue --dangerously-skip-permissions"
```

Then tell it to push first. Never remove a `GONE` worktree on the strength of its PR.

**AND SAY WHO IS ANSWERING, because the agent cannot tell.** An `AskUserQuestion` that returns the
option its own asker marked `(Recommended)` looks identical whether the user chose it, the dispatcher
chose it, or nothing did. Two PRs on 2026-09-19 wrote "the Owner chose" over a choice the Owner never
saw; one agent caught it itself and said why, which is that a default answer and a real one arrive the
same way. Name yourself and the date in the answer, so the PR body and any record attribute it to the
mouth it came from.

**FILL IT FROM A FREE TREE RATHER THAN LEAVING IT EMPTY.** Throughput is the goal and the collision
rule is how you reach it, not a reason to under-fill. On 2026-09-16 the corpus run owned
`packages/db`, so the rest went to `ci.yml`, `packages/ui`, one `apps/web` file and a provider repo.
Reach for a candidate that shares a file only when nothing in a free tree is left.

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

## Merging a bump

**A BUMP'S GREEN IS NOT THE SAME GREEN.** Dependabot reads a SEPARATE secret store, and a job whose
service container needs a secret fails on every bump forever when that store is empty — so a bump's
checks say nothing, and a dependency that really broke something looks identical to the noise.
Seventeen arrived on 2026-09-18 each carrying two red checks that meant nothing (CNCORE-203). Check
what a red check is ABOUT before treating it as a verdict on the dependency.

**AND "DOES OUR CODE USE WHAT CHANGED" IS THE WRONG QUESTION.** The break can be in a THIRD
dependency that reads the bumped package's internals. zod 4.6.5 stopped filling `_zod.bag`,
`@orpc/zod` read only the bag, and every `maxLength`, `minLength` and `format` vanished from the
published OpenAPI document — 16, 39 and 79 constraints down to 0, 0 and 7. The bump was read against
this repo's own zod usage, found clean, and merged at 14:09 on 2026-09-19; CNCORE-212 found it after.
Reading the bumped library's release notes could not have caught it, because the affected code was
neither ours nor zod's. What catches it is a test asserting the OUTPUT a dependency produces, which
is what CNCORE-212 left behind.

**AN ACTION BUMP IN ONE PROVIDER REPO IS HALF A CHANGE.** Both pin the same digests at two sites
each, so merging one side diverges the twins. Wait for the pair and merge them together — held from
2026-09-18 until provider-tmdb's own PRs appeared, then all four went in as a set.

**A PATCH PUBLISHED TODAY IS THE ONE THE COOLDOWN IS FOR.** pnpm's `minimumReleaseAge` is 24 hours,
and taking a release inside it writes a `minimumReleaseAgeExclude` waiver — waiving the cooldown for
exactly the case it exists to catch. ADR-0105 already refused that trade. Take the aged version and
let the range pick the newer one up later.

## Gotchas

- **A CROSS-REPO FOLD MAKES BOTH ITS WORKTREES LOOK DEAD, and neither pane is lying.** The agent
  lives in one worktree and reaches into the other with `cd`, so the repo holding the FILES has no
  agent in it and the worktree holding the AGENT shows `+0,-0` until the second half starts. The
  work is in a third place: the other repo's `git status`. Say this when you brief the fold — the
  163/164 pair read as stalled on 2026-09-14 while it was writing a compose file and a 209-line
  test, and the question came back as "the orca worktree isnt doing anyhting".
- **`orca terminal send` TYPES; `--enter` SENDS.** Without that flag the text lands in the agent's
  input box and sits there, and the call still answers `Sent 187 bytes to term_...`. Two briefs
  naming a merged ADR rung sat unsubmitted in two agents' prompts on 2026-09-19 while this loop's own
  report said both had been told. Pass `--enter`, then read the terminal back: a cursor that has not
  advanced is a brief nobody received.
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
