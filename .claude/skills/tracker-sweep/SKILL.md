---
name: tracker-sweep
description: "Audit every open CNCORE ticket against the filing standard and repair what has drifted: a Backlog state nobody chose, a missing label or assignee, a blocking edge that no longer holds. Use before dispatching a wave, after a batch of merges, or when asked to check the issues."
---

Filing one ticket correctly is `docs/agents/issue-tracker.md`. This is the other job: the board drifts,
and drift is silent.

Agents file tickets mid-implementation, when their attention is on the code they are leaving. What
arrives is a good body with nothing else set. Twelve tickets were filed that way on 2026-09-10 and
2026-09-11; every one had been written by an agent that had read the tracker doc.

## The four kinds of drift, worst first

**A `Backlog` state nobody chose.** `orca linear create` without `--state` lands the ticket in the
team's first Backlog state. It looks filed, it has a number, and it sits outside every view the
workflow uses. This is the one that hides, because nothing about it reads as broken.

**A missing label.** Triage is deliberately off on this team, so a label is the only place triage
state lives. An unlabelled ticket has no triage state at all rather than a default one.

**A missing assignee.** Cosmetic alone; a signal in company. A ticket with no label AND no assignee
was filed by something that set no fields, so read its body harder than you otherwise would.

**A blocking edge that has gone stale.** The graph is what decides the frontier, so a closed blocker
still listed keeps real work invisible, and an edge nobody added lets a ticket be dispatched into a
dependency that does not exist yet.

## Sweep

Read every non-Done ticket with `orca linear list-issues --team CNCORE --json`. For each, take the
state, the labels and the assignee, and flag any of the four above.

**Repair the mechanical three without asking**: state to `Todo`, add `ready-for-agent`, set the
assignee. They have one right answer and the user gains nothing from being consulted about it.

**Do not clear `needs-triage`.** That label is a decision somebody made, not drift. Clear it only
when you have settled the question it marks, and say what you settled.

**Read BOTH the relation list and the body, and check they agree.** `orca linear issue <id>
--relations --json` does carry a reliable direction -- each edge appears as `relationship:
"blockedBy"` with `direction: "inbound"` on the blocked ticket and `"blocks"`/`"outbound"` on the
blocker, measured across 30 issues on 2026-09-14. **The trap is the SPELLING**: `relation add` takes
`--type blocked-by` and the payload answers `blockedBy`, so filtering on the flag's own spelling
matches nothing and reports every ticket as startable.

The `## Blocked by` section in the body is what implementers actually read, so a body and a link that
disagree is itself the defect to report -- version one had two tickets asserting a parent in prose
while carrying no link.

## Two traps that return an empty answer rather than an error

Both cost a wrong conclusion here before they were written down.

- **`children` sits at the result root**, not under `issue`. Asking for `result.issue.children`
  returns nothing and looks like a ticket with no children.
- **`--current` resolves from the caller terminal**, not the working directory, and
  `ORCA_WORKTREE_ID` cannot be overridden. Running it after `cd`-ing into another worktree reports
  no linked issue, convincingly.

When a tracker query comes back empty, suspect the query before the data.

## Before a wave goes out

A swept board is not a dispatchable one. Two more things decide that, and both live elsewhere:
`CLAUDE.md` requires whatever a ticket asserts about a version, limit, price or practice to be
checked with `/verify` first, and two tickets editing one file want an order rather than a race.

## Done when

- Every open ticket carries a state that somebody chose, a label, and an assignee
- Every `needs-triage` either survives with a reason or was settled and cleared
- Every `## Blocked by` names blockers that are still open, and every open ticket whose blockers are
  all closed is either dispatched or has a written reason it is not
- What you repaired is reported, because a silent sweep teaches nobody which way the board drifts
