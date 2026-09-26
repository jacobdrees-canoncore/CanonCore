---
status: accepted
---

# Standing dispatch decisions live in `dispatching.md`, and no agent can change them

> **ACCEPTED 2026-09-26, whole, in two repositories.** The mechanism is the `dispatch` skill's, in
> the skills repository, where no PR from here reaches: `claude-skills#29` (CNCORE-418) **MERGED as
> `8d97c05`** before this record was written. It carries the storage rule in `dispatch/asking.md`
> and the refusal in `dispatch/merge-if-green.sh`, held by behavioural tests in
> `dispatch/merge-gate.test.ts` run against the script. **THE FLIP IS ON THIS, THE SECOND TICKET OF
> THE PAIR (CNCORE-419), AND NAMES THE MERGE COMMIT** because that is the one thing a reviewer here
> can check ([[0192-a-cross-repo-tickets-provider-half-gets-a-worktree-of-its-own]]).
> **WHAT IS DELIBERATELY NOT CLAIMED:** this repository's `docs/agents/dispatching.md` holds no
> `## Standing decisions` section yet. The skill creates it, or this project's subsection of it, on
> the new loop's first run, through the same gated write every later change takes. An absent section
> is a state the mechanism handles (the gate reads it as empty, so a PR adding one is refused like
> any other change), not half of it missing.

## What is decided

A project's **standing dispatch decisions** are asked of the Owner once per project and stored,
rather than asked again every wave. There are four kinds: **check-in points**, **held-back
tickets**, **standing permissions** (actions the loop takes without asking) and **precondition
checks**, with any **check-in pause** in progress stored beside them. Their home is the
`## Standing decisions` section of this repository's `docs/agents/dispatching.md`, one
`### <tracker project>` subsection per Linear project. The heading is exact, because the gate
matches on it.

**`merge-if-green.sh` refuses any PR that changes that section unless it is given
`--standing-decisions`.** Only the dispatcher runs the gate, so only the dispatcher's own PR, written
from the Owner's answers, can carry the flag. An agent's PR that touches the section goes back to
its agent. The section is compared at the PR's merge-base and at the commit the gate passed, so a
branch cut before a decision landed does not read as reverting it, and a change elsewhere in the
file merges. A file the gate cannot read is a refusal.

How the loop asks for these, and in what order, is `dispatch/asking.md`'s and is not restated here.

## Why agents cannot change them

**A standing permission is acted on without asking.** That is its whole purpose, and it is also
what makes it dangerous to leave writable: an agent's PR that added a line to the section could
grant itself a permission, and the next pass of the loop would act on it with nobody asked. A
check-in point or a held-back ticket quietly deleted fails the same way, one step removed: the pause
the Owner asked for simply never happens.

**Atlantis is the precedent, and it draws the line in the same place.** Its repo-level
`atlantis.yaml` is read from the pull request itself, "similar to other CI/CD systems", and its docs
say what follows: with custom workflows allowed, "anyone that can create a pull request to your repo
can run arbitrary code on the Atlantis server. By default, this is not allowed." The restricted keys
(`workflows`, `plan_requirements`, `apply_requirements` among them) can be changed from the repo
only where the server-side `repos.yaml` grants it through `allowed_overrides`, and by default it
grants nothing (`runatlantis.io/docs/repo-level-atlantis-yaml.html`, read 2026-09-26). Here the
section is the restricted key, and the dispatcher's flag is the server-side grant.

**Why a file in this repository rather than the dispatcher's own notes:** a fresh window has to find
the decisions, and so does a reader auditing why the loop acted without asking. A tracked file gives
both, and it gives every change a PR, which is the one write path the gate can police.

## What this does not decide

What the Owner's answers are. The section is empty until the first run of the new loop asks, and
this record neither pre-fills it nor says which permissions a project ought to grant.

Decided by the OWNER, in a grilling session with the dispatcher on 2026-09-26, as recorded in
CNCORE-418's PR.
