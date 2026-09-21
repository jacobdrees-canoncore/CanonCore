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

**THE WATCH CAN END WITHOUT FAILING.** `persistent: true` is not always honoured: on 2026-09-19 the
tool capped it at 30 minutes three times running and said so only in its start message. The one
notice at expiry is easy to read as another event. Re-arm on that notice, with the same `SCRATCH`
so the diff resumes instead of re-announcing the board. A merged change to `monitor.sh` also does
nothing until you stop the running watch and start it again. Its header names every line it
emits; `ROOM`, `IDLE`, `UNBOUND` and `UNBOUND-BLIND` are read under **How full**, `PARKED` under
step 2, the `DRIFT-` lines under **Drift**.

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
commits — then ancestry is the wrong safety test, so CONTENT is compared against `origin/main`
before anything is removed. Two scripts beside this file do both halves and neither is run by hand:
`merge-if-green.sh` merges, `retire.sh` retires.

**MERGE WITH `merge-if-green.sh <n> [repo] [worktree]` (beside this file), NEVER `gh pr merge` BY
HAND.** It resolves the PR's head and asks about THAT COMMIT's check-runs, because a check is
evidence only for the commit it ran against (ADR-0181) and a rebased PR goes on showing the old
head's green. It is one command rather than a gate you read and a merge you then type, because
`gate.py <n> | tail -2 && gh pr merge` once merged over a printed `BLOCKED` in the scratch version
this replaces — a pipeline's exit status is the LAST command's, and `tail` always succeeds. Give it the worktree path too and it
refuses over uncommitted or unpushed work, which is the condition `CLAUDE.md` already puts on
removing one.

**IT REFUSES A DRAFT, WHICH NOTHING ELSE ON THE PULL REQUEST DOES.** A draft answers `OPEN`, `CLEAN`
and sixteen green checks, so every other field calls it mergeable — #230 read `PASSED` on 2026-09-21
while its agent was still writing it. `READY` above is the line that says a PR has left draft; the
gate now says it too.

**RETIRE WITH `retire.sh <worktree> [--aux <name>]...` (beside this file), NEVER BY HAND.** It is the
merge gate's other half and it does the whole retirement: compares CONTENT file by file against
`origin/main`, STOPS on a difference `main` does not explain and removes nothing, then takes the
worktree and drops its databases. Until CNCORE-334 this paragraph was a rule with no mechanism, and
the rule is the one thing a dispatcher cannot run from memory at speed — on 2026-09-21 cncore-316's
removal was chained into the same command as the comparison, so it ran before the DIFF lines were
read. Two files differed, both were `main` running ahead, and nothing was lost by the order the
shell happened to run things.

**A DIFF LINE HAS TWO READINGS AND ONLY ONE IS SAFE**, so the script explains each one or stops:
`main-ahead` when some commit on `main` holds the file EXACTLY as the branch has it, `ticket-named`
when `main`'s history on it carries this ticket's subject. "`main` holds a later commit touching it"
is NOT one of them — that is equally true of a file another ticket edited while this branch's change
to it never merged (ADR-0199).

It needs no branch argument and no repo: the branch comes off the worktree before the removal takes
it, and `--git-dir` against `--git-common-dir` both refuses a MAIN CHECKOUT and derives where the
drop runs, so one script retires a provider worktree and a CanonCore one. The drop itself is
ADR-0191's: it refuses while a live worktree still owns the databases, so it goes AFTER the removal,
and it refuses any list naming `canoncore`, the Owner's own catalogue. A repo with no
`db:drop-worktree` has no databases and the script says so rather than guessing from the repo's name.
`db:setup`'s sweep takes whatever is missed, but only once it is an hour old.

**AND IT FINDS THE WORKTREES `orca worktree list` CANNOT SEE.** A ticket that runs `git worktree add`
for a job of its own — the comment scan's parser oracle wants HEAD, main and the previous commit at
once — leaves trees registered in the repo's `.git/worktrees/` and living anywhere on disk, which
Orca never learns about. cncore-333 had three at `/private/tmp/wt-head`, `wt-main` and `wt-prev` on
2026-09-21. **OWNERSHIP OF ONE IS RECORDED NOWHERE**: the entry holds a path and a detached sha and
no ticket, two of those three sat on commits every branch shares, they were two minutes old, and all
three were clean but for a scratch `node_modules` — so neither reachability, age nor dirtiness
attributes them. The script therefore NEVER infers it. An unattributed tree stops the retirement and
is named; `--aux <name>` is how the dispatcher who made one says so, and a name matching no
registration is refused rather than passed over. A tracked change in one stops it even when
asserted. **Put an auxiliary tree inside your own worktree and none of this arises**, because its
removal takes it.

**A CROSS-REPO TICKET'S MERGE TAKES ITS PROVIDER WORKTREES TOO.** Each provider PR goes through
`merge-if-green.sh <pr> <repo> ~/orca/workspaces/<repo>/cncore-<ticket>`, and its worktree through
`retire.sh ~/orca/workspaces/<repo>/cncore-<ticket>` exactly as a CanonCore one does — the script
derives the repo from the worktree and finds no databases there by asking rather than by its name.

**`PARKED <repo> <branch>` IS A MAIN CHECKOUT SOMEBODY WORKED IN**, and it goes back to `main` in
the same action as the merge of the ticket whose branch it names, once `git status` is clean and
nothing is unpushed:

```sh
git -C ~/orca/projects/<repo> switch main && git -C ~/orca/projects/<repo> pull --ff-only
```

CNCORE-261 left both providers' main checkouts on its deleted branch, and the next ticket found one
there. While that ticket is still live, leave the checkout alone: its agent is working in it.
`PARKED <repo> unreadable` means the monitor could not read that checkout's branch, so the line's
silence has not answered for that repo.

**AND AFTER THE LAST PR OF A TICKET WITH THREE OR MORE, READ ITS STATE BACK.** The count is the
variable, not the repos. CNCORE-257, 259 and 263 each opened three, each sat at `In Review` with
every PR merged, and each was closed by hand, while every ticket in the same wave with one or two
closed itself ([[0192-a-cross-repo-tickets-provider-half-gets-a-worktree-of-its-own]]). If the
integration left it open, `orca linear status set CNCORE-<ticket> --to Done`, and read that back
too.

**A merge that claims a RUNG tells every live agent the new number, in the same action.** A rung is
a line on a ladder no ticket owns: the migration index, the shared fixture, a tool list. CNCORE-74
and CNCORE-119 each built `migration_12`; the second was still in its worktree when the first
merged, and one `terminal send` turned a silent overwrite into a renumber.

**RECOGNISE THE SHAPE, BECAUSE THE INSTANCES RUN OUT.** The three above were the known rungs and the
list kept growing under the people reading it. A rung is anything with all four of these, whatever it
is called:

- **One shared list, in one file, that no ticket owns.**
- **Every ticket of a kind appends to it** — so it grows on the wave's schedule, not on any one
  author's.
- **Something states its SIZE, or its next free value** — a count in prose, a highest number taken.
- **Each author sees the row they are adding and not the rows arriving beside it.**

**THE FAILURE MODE FOLLOWS FROM WHERE THE APPENDS LAND**, and it decides what you owe it. Two
branches taking the same NUMBER is a silent overwrite and wants a guard. Two branches APPENDING to
one region of one file is a conflict git reports at merge, which is already the right failure and
wants no mechanism. **Either way the loser's PR goes `DIRTY` and gets NO CI run at all**, so the
guard never fires on the branch that lost — it protects `main`, and the loser learns from git.

**THE ADR NUMBER IS A RUNG AND IT DOES NOT LOOK LIKE ONE.** `docs/adr/` is a ladder no ticket owns,
so two branches both take the next free number and the loser's CI dies on `adr-numbering.test.ts`.
CNCORE-177 took 0136 while CNCORE-167 was already holding it, 2026-09-16 — the guard caught what
the merge should have announced. Broadcast it with the migration index, and name what is CLAIMED
rather than only what is taken: told "0137 is CNCORE-167's", CNCORE-161 took 0138 unprompted.

**A CLAIMS TABLE IS A RUNG TOO, AND ITS FAILURE IS THE SOFTER ONE.**
`packages/config/src/tree-figures.test.ts` holds one row per figure this repository states about
itself and ADR-0153 states how many rows it holds, so it has all four marks. It was contended the day
it landed: three branches appended within two hours of CNCORE-251 merging on 2026-09-20, and
CNCORE-248 went `DIRTY` on the collision. Broadcast an append to it the way you broadcast a number.
Do not reach for a guard — [[0175-a-claims-table-is-a-rung-and-the-removable-part-was-the-self-claim]]
measured the append path going red rather than silent, and found the real hole in the row that holds
the record's OWN figure, which deleted with every test still passing.

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

**A CROSS-REPO TICKET GETS ITS PROVIDER WORKTREES IN THE SAME ACTION, BEFORE ITS AGENT STARTS.** One
per provider repo the ticket reaches, named `cncore-<n>` exactly as its CanonCore worktree is, so
the agent finds `~/orca/workspaces/<repo>/cncore-<n>` from its binding alone:

```sh
git -C ~/orca/projects/<repo> fetch -q origin
orca worktree create --repo name:<repo> --name cncore-<n> --linear-issue CNCORE-<n> --setup skip --json
```

Creating them is yours, as removing them is, and the agent never works in a main checkout
([[0192-a-cross-repo-tickets-provider-half-gets-a-worktree-of-its-own]]). Made on request instead,
each one costs a round trip. CNCORE-262 paid one, and CNCORE-264 waited for `cncore-264-tmdb` on
2026-09-21, which the dispatcher then created without `--linear-issue`. `UNBOUND` now reads every
repo, so the same slip reads `UNBOUND provider-tmdb/cncore-264-tmdb`. A provider worktree is not one
of the four (**How full**).

Done when every merged PR's worktree is gone and the frontier is in front of the user. New tickets
arriving is the review working; one arriving that nothing blocks belongs in the next ask rather than
in a worktree.

## How full

**`ROOM n` MEANS n SLOTS ARE FREE, AND THE MONITOR COUNTS THEM.** Do not count worktrees yourself; a
freed slot used to wait on you remembering to. Four is a CANONCORE count, from one `pnpm test:e2e`
peaking at 67 of 288 usable connections on the shared Postgres -- four fit, at 268 of 288
(CNCORE-137, re-measured under CNCORE-178). `provider-wiki` runs
DuckDB fixtures and `provider-tmdb` hits the live API, so neither is in the four. Six agents with
four contending is the shape, not a breach.

**`IDLE <worktree>` MEANS AN AGENT HAS GONE QUIET: PARKED, FINISHED OR DEAD.** A spinner keeps its
output fresh, so silence is the tell, and one `terminal read` says which. A full slot count cannot
tell any of the three from working — three of four agents sat on their own `AskUserQuestion` prompts
while the count read full. Parked: answer what is technical and yours, and carry up only what
`CLAUDE.md` reserves for the user (money, a licence, a background service). Finished: merge and
remove. Dead: read the terminal before assuming the work is lost.

**AND A PARKED AGENT IS UNREACHABLE, so this read comes BEFORE a broadcast and not only after one.**
Anything sent to it goes to the prompt widget rather than the chat, where `--enter` answers the
question on its behalf (ADR-0162). Answer the prompt first, then send.

**`UNBOUND <repo>/<worktree>` MEANS A WORKTREE THAT CANNOT BRIEF ITS OWN AGENT**, because `--prompt
"/implement"` carries no ticket number and the binding is the whole brief. It reads
`linkedLinearIssue`, which is the field the 2026-09-20 wave got wrong by reading `linkedIssue`
beside it. It reads every repo in `REPOS`, and names the repo because a provider worktree carries
its CanonCore twin's name. It emits on the ABSENCE, so a pass with no `UNBOUND` line has already
answered the question — which is the direction that fails safe, since a worktree wrongly reported
bound is the one that sends an agent out blind. **`UNBOUND-BLIND` means the listing itself could not
be trusted** — unparseable, an unexpected shape, or `truncated` on a paged read — so that pass saw
nothing rather than saw nothing wrong, and silence keeps its one meaning.

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

- **AN ABSENT CHECK IS THE TELL, NOT A RED ONE — AND THERE ARE TWO ABSENCES.** A conflicted PR gets
  no CI at all: a `pull_request` workflow runs against `refs/pull/N/merge`, which GitHub cannot build
  while the branch conflicts, so it creates no run rather than a failing one. Merge `main` and it
  fires. That ref keys the run too, so a `--commit <head>` poll finds nothing — watch with
  `gh pr checks <n>`. **THE SECOND ABSENCE PRESENTS AS A PASS, AND `gh pr checks` IS WHAT SHOWS IT
  TO YOU.** After a rebase there is no run for the new head, and the PR displays the OLD head's
  results without naming the commit they belong to (ADR-0181). So that command watches a conflicted
  PR and does NOT gate a merge: it answers about the pull request, and the question is about the
  commit. **ZERO HAS NO TIMESTAMP ON IT EITHER** — a commit pushed seconds ago and one whose branch
  conflicts both read zero, the first clears by waiting and the second never does. #210 waited
  4m05s; on #221 that was read as "not yet" and the merge went in 3m42s before its run finished.
  `gate.sh` names which of the two it is rather than leaving you to infer it at speed.

- **A CROSS-REPO TICKET MAKES BOTH ITS WORKTREES LOOK DEAD, and neither pane is lying.** The agent
  lives in its CanonCore worktree and reaches into its provider worktree,
  `~/orca/workspaces/<repo>/cncore-<n>`, with `cd`, never into the provider's main checkout. So the
  worktree holding the FILES has no agent in it, and the worktree holding the AGENT shows `+0,-0`
  until the second half starts. The work shows in one place only: the provider worktree's
  `git status`. Say this when you put a cross-repo ticket up — the 163/164 pair read as stalled on
  2026-09-14 while it was writing a compose file and a 209-line test, and the question came back as
  "the orca worktree isnt doing anyhting".
- **`orca terminal send` TYPES; `--enter` SENDS — AND `--enter` IS STILL NOT DELIVERY.** There are
  three ways a brief fails to arrive and all three answer `ok: true` with a byte count (ADR-0162).
  Without the flag the text lands in the input box and sits there: two briefs naming a merged ADR
  rung sat unsubmitted on 2026-09-19 while this loop's own report said both had been told. **With
  the flag, mid-turn, it QUEUES rather than submits** — the UI shows `ctrl+x ctrl+s to send now` and
  it lands only when the turn ends, measured three times on 2026-09-20 against cncore-205, 254 and
  252, each an attribution correction that would have arrived after the PR body it was correcting.
  `printf '\030\023'` flushes it **and INTERRUPTS the turn in progress**, and the hint
  disappearing is the confirmation. **And with the
  flag, to a PARKED agent, the input goes to the PROMPT WIDGET, where `--enter` SELECTS the option
  under the cursor** — on a multi-select with a free-text field the text can land in the field. The
  keystrokes that answer it are ADR-0187, read PER SCREEN rather than per widget shape — two
  measurements of one shape disagree there — and so is the confirm screen that eats every chat send
  until it clears, on the screens that get one. **So WAIT FOR THE PROMPT where the message can wait, and flush
  only where it cannot**: a queued message arrives by itself when the turn ends, at no cost, and the
  flush buys earliness by spending the turn in progress.
  Measured broadcasting to eight agents on 2026-09-20: six received it, two were parked, and BOTH
  known tells read clean because nothing ever reached the input box. So **read `--screen` BEFORE
  sending, not only after**: `Enter to select` on the screen means the agent is unreachable until
  its prompt is answered. `--screen` is required rather than preferred — the default read returns
  stacked fragments rather than what the terminal renders, so it cannot show an input box at all.
- **`orca terminal send` truncates a long message, silently.** The agent acts on the fragment. Keep
  each send to a couple of hundred bytes and split; read the terminal back to confirm it landed.
  This cost CNCORE-40 a whole pass.
- **One worktree can hold two terminals.** Match on `agentIdentity: claude` — a handle list of two
  makes a malformed `--terminal` and the send fails.
- **An agent's view of `main` goes stale while it works.** It will propose stacking on a branch you
  deleted. Say what merged and when.
- **`save-issue` reports `linear_write_unconfirmed` on writes that landed.** Read back rather than
  retry.
- **A LINEAR BINDING IS READ AT `linkedLinearIssue`. `linkedIssue` IS GITHUB'S FIELD AND IS ALWAYS
  `null` HERE**, because this repo does not use GitHub Issues (`CLAUDE.md`). Reading the wrong one
  is how both of this gotcha's previous versions went wrong: it used to say `set --linear-issue`
  "answers `ok: true` and binds nothing", on a 2026-09-13 measurement of `linkedIssue`, and the
  2026-09-20 wave read five worktrees as unbound the same way. That field cannot show a Linear
  binding's absence OR its presence, so neither reading established anything. **Both
  `create --linear-issue` and `set --linear-issue` bind**, re-measured 2026-09-20 against probe
  worktrees created and removed for it, each confirmed by an independent `orca worktree list` read
  rather than by the write's own response (ADR-0162).
- **`--current` RESOLVES FROM THE CALLER TERMINAL, NOT THE WORKING DIRECTORY, so a dispatcher cannot
  audit a binding with it.** `cd` into another worktree and ask, and you get `linear_no_linked_issue`
  about YOUR shell's worktree while the one you are standing in is bound. Measured from a terminal
  belonging to `cncore-265`, standing in `cncore-281`: it answered **CNCORE-265**.
  `docs/research/multi-repo.md` had already measured this under "The trap, which produced a false
  negative inside this research", and ruled there that a null `linkedLinearIssueWorkspaceId` "is not
  a signal of anything" — so that field is not the tell either. **AND IT IS FIVE FOR FIVE FOR YOU
  SPECIFICALLY**, because you dispatch from the main worktree and that checkout carries no binding
  of its own: `--current` from there returns `linear_no_linked_issue` for EVERY worktree you stand
  in, bound or not, however many times you re-run it. **The dispatched agent is unaffected**, since
  Orca gives it a terminal in its own worktree. So audit a binding with `linkedLinearIssue` from
  `orca worktree list`, or read a `monitor.sh` pass with no `UNBOUND` line as that question already
  answered; leave `--current` to the agent reading its OWN ticket.
