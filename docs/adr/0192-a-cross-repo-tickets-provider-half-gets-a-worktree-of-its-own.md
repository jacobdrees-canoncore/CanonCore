---
status: accepted
---

# A cross-repo ticket's provider half gets a worktree of its own

A CanonCore ticket whose work reaches a provider repo gets one worktree in each repo it touches.
Each is named `cncore-<n>`, the same name as the ticket's CanonCore worktree, and sits in that
repo's own workspace directory: `~/orca/workspaces/<repo>/cncore-<n>`, on branch
`jacobdrees/cncore-<n>`, bound with `--linear-issue CNCORE-<n>`. The dispatcher creates all of them
in the same action as the CanonCore worktree, before the agent starts, and removes each one as its
PR merges. The agent works in them and never in a repo's main checkout, which stays on `main`.

`monitor.sh` watches both halves where a script can. `PARKED <repo> <branch>` names a main checkout
standing anywhere but `main`, and names one it cannot read. `UNBOUND` reads the worktrees of every
repo in `REPOS` rather than CanonCore's alone, and prints each as `<repo>/<worktree>`.
`packages/config/src/dispatch-monitor.test.ts` runs one pass of the real script against a stubbed
world and pins both lines.

## What happened: one problem, three answers, one wave

The dispatch skill said a cross-repo fold's agent "lives in one worktree and reaches into the other
with `cd`". That was written for a fold, where one agent owns both halves and nothing else is
running, and it is right there. It never said whose the other worktree was, or what happens when
two cross-repo tickets are in flight at once. Read alone, it sends the agent into the provider's
main checkout. Measured over the wave of 2026-09-20 into 21. What 257, 259, 261, 262 and 263 did
is CNCORE-295's own evidence; CNCORE-258 and CNCORE-264 were read from their agents' session
transcripts on 2026-09-21, when this was built:

- **CNCORE-261** left both provider main checkouts on its branch after merging, a branch the merge
  had deleted.
- **CNCORE-262** found `provider-wiki`'s main checkout on `jacobdrees/cncore-261` and correctly
  refused to commit there, since that would have put its work on another ticket's branch. It
  stopped and asked, and the dispatcher created it a worktree. That cost a round trip.
- **CNCORE-257** held both main checkouts on its own branch. CNCORE-259 and CNCORE-263 worked around
  it by creating provider worktrees of their own, and so did CNCORE-258, naming its `cncore-258`.
- **CNCORE-264**, later in the same wave, was told mid-flight to take a provider worktree of its
  own and to ask the dispatcher for it. It worked on without one until it could not, then asked,
  and the dispatcher created it. `cncore-264-tmdb` arrived with no Linear binding, because the
  dispatcher created it without `--linear-issue`. Its agent found that and bound it by hand.

So the main checkout, a worktree the dispatcher made on request, and a worktree the agent made for
itself: three answers to one question, and two round trips through the dispatcher. Nothing reported
any of it. A parked checkout was found by the next agent to need it, and `UNBOUND` read
`/workspaces/CanonCore/` alone, so it could not see a provider worktree at all. Reading every repo
is what would have caught `cncore-264-tmdb`.

## Why the dispatcher creates it, and up front

Creating a worktree is the dispatcher's everywhere else in this repository, and removing one is the
dispatcher's alone (`CLAUDE.md`, "Implementing"). A worktree an agent made for itself is one the
dispatcher has to discover before it can remove it. The dispatcher already knows which repos a
ticket reaches, because the wave it puts to the user names them before any worktree exists
(dispatch skill, step 6). Creating them then costs nothing, and the agent starts with everything it
needs. Each one created on request costs the round trip that CNCORE-262 and CNCORE-264 paid.

A provider worktree is not one of the four agents the shared Postgres allows, since neither
provider's suite touches that database (dispatch skill, "How full").

An agent that finds it needs a repo nobody foresaw asks for the worktree, as it asks for any value
it cannot find. It does not create one.

## Why the same name as the CanonCore worktree

Dispatch sends `--prompt "/implement"` and nothing more, because the binding is the brief
([[0162-a-brief-is-confirmed-at-the-receiving-end-not-at-the-call]]). So the agent has to be able to
work out its provider worktree's path from the binding alone, and
`~/orca/workspaces/<repo>/cncore-<n>` allows that: the directory already names the repo, and the
rest is the agent's own worktree name. A suffix per repo (`cncore-264-tmdb`) repeats what the
directory says, and adds a rule the agent has to know before it can find the path. The suffix was
the dispatcher's choice on 2026-09-21, and the dispatcher dropped it when this was decided the same
day.

The name keeps the drift lines right with no change to them. They count a ticket as live while any
directory under `~/orca/workspaces/` carries `cncore-<n>`. And it was measured working before it was
chosen: CNCORE-258 stood in three worktrees named `cncore-258`, one per repo, each bound to
CNCORE-258. A probe created `--repo name:provider-wiki` with `--linear-issue` from the main checkout
on 2026-09-21, and a separate `orca worktree list` read showed it bound. `orca worktree rm` took its
branch with it.

The one cost is that a bare name no longer says which repo, which is why `UNBOUND` now prints the
repo too. `IDLE` and `GONE` still read CanonCore alone. That is where the agent lives, and a
provider half has no agent of its own.

## Why the main checkout is watched rather than locked

Nothing stops an agent from checking out a branch in a main checkout, and nothing here could. What
can be done is to see it at once, rather than when the next ticket trips over it. The one thing
`PARKED`'s silence has to mean is that every main checkout is on `main`. So a checkout the monitor
cannot read is named too, as `unreadable`, for the same reason `UNBOUND-BLIND` refuses to read a
failed listing as all clear. That includes a directory that is not a repository: `git -C` would
walk up and answer for whatever encloses it, so the read stops at `~/orca/projects`, the trap
`merge-if-green.sh` already guards.

A parked checkout whose ticket is still live is left where it is. The agent is working in it, and
taking the branch out from under it would cost that work. It goes back to `main` in the same action
as its ticket's merge, once nothing in it is uncommitted or unpushed.

## A ticket with three PRs does not close itself

This turned up in the same wave, at the same merge step, and the filer's second comment on
CNCORE-295 narrowed it. CNCORE-257, 259 and 263 each opened three PRs naming the ticket, one per
repo. Each stayed at `In Review` after its last PR merged, and each was moved to `Done` by hand.
Tickets with one or two closed themselves, the two-PR set CNCORE-297, 299 and 301 among them. So the
variable is the number of PRs, not the number of repos. This record re-read the activity logs on
2026-09-21: the three-PR tickets' `Done` was set by a user, and the two-PR CNCORE-262, 264 and 297's
by the GitHub integration.

Why three fails is not known, and nothing here depends on knowing it. It is three observations and
no counter-example, so the rule is a read rather than a prediction: after the last PR of a ticket
with three or more merges, the dispatcher reads the ticket's state back and moves it to `Done` only
if the integration did not. The read comes first, so setting the state by hand does not hide whether
the linkage works, which is what `docs/agents/issue-tracker.md` refuses hand-set states for.

## What is a check and what is procedure

- **A check.** `PARKED`, and `UNBOUND` over every repo, in `monitor.sh`, pinned by
  `dispatch-monitor.test.ts` at the script's process boundary. The dispatcher agreed that seam on
  2026-09-21, on the condition that the script grows no flag only the test would read. So the test
  ends the loop by stubbing `sleep`.
- **Procedure, in the dispatch skill.** Creating the provider worktrees at dispatch, removing them
  at merge, returning a parked checkout to `main`, and reading back a three-PR ticket's state.
  Nothing in this repository can observe the order in which a dispatcher does things. The two lines
  above are what make a missed step visible.
- **For the agent, in `CLAUDE.md`.** Where its provider half is, and that the main checkout is not
  it.
