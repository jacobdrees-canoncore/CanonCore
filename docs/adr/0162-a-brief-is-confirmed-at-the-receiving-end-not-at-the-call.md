---
status: accepted
---

# A brief is confirmed at the receiving end, not at the call that sent it

> **ACCEPTED 2026-09-20, whole, in two repositories since 2026-09-22,** when the `dispatch` skill
> and its scripts moved to the skills repository; the procedure half below stays in this one's
> `CLAUDE.md` and `docs/agents/issue-tracker.md`. The dispatch loop now confirms a brief where it
> lands rather than where it was sent. **BUILT AS A CHECK: the binding channel only** — `monitor.sh`
> emits `UNBOUND` for a worktree carrying no Linear binding, in every repo the dispatcher runs since
> [[0192-a-cross-repo-tickets-provider-half-gets-a-worktree-of-its-own]] (CanonCore's alone until
> then), reading `linkedLinearIssue`, and `UNBOUND-BLIND` when the listing was truncated, so silence
> means every worktree was seen and bound. **BUILT AS PROCEDURE, WITH NO CHECK POSSIBLE FROM THIS REPOSITORY: the two `terminal send`
> channels**, whose confirmation is a dispatcher reading a rendered screen; nothing here can observe
> another agent's input box. The sentences that told a dispatcher a call's `ok: true` was evidence
> are corrected in place in `CLAUDE.md`, the `dispatch` skill's `SKILL.md` and
> `docs/agents/issue-tracker.md`. **NOT BUILT, and not ours to build: the `orca` CLI's own error
> text**, which lives upstream.

Three times on 2026-09-20 the dispatcher believed an agent had been briefed when it had not, and each
time the call said so. They are one defect with three faces: **an `ok: true` describes the call, not
the arrival.**

## The binding was never the defect

`orca worktree create --linear-issue CNCORE-<n>` **stores the binding and returns it**, and so does
`orca worktree set --linear-issue`, which a note of 2026-09-13 had recorded as binding nothing.
Measured 2026-09-20 against two probe worktrees created and removed for it, one bound at `create`
and one bound afterwards by `set`, each confirmed by an independent `orca worktree list` read rather
than by the write's own response. `linkedLinearIssue` sits in the same object as `ok: true`:

```
"linkedIssue": null,                 <- the GITHUB issue number
"linkedPR": null,
"linkedLinearIssue": "CNCORE-265",   <- the Linear binding, present at create
```

**`linkedIssue` is a different system's field**, null on every CanonCore worktree because GitHub
Issues is unused here (`CLAUDE.md`), and it sits two lines above the one that carries the answer.
Both the 2026-09-13 note and the 2026-09-20 wave read it and concluded a Linear binding was absent.
**That field cannot show a Linear binding's absence OR its presence**, so neither reading
established anything; this record does not claim the five worktrees of the wave were bound, because
they have since merged and been removed and cannot be re-read.

What can be read is every CanonCore worktree standing at the time of writing, all of them bound,
including `cncore-244`, which the dispatcher created through the ordinary dispatch path during this
very ticket. The list is not quoted here because it turns over within the hour — it did so twice
while this record was being written, which is
[[0153-a-figure-about-this-tree-is-derived-or-dated]]'s point exactly. Take it again instead:

```bash
orca worktree list --json | python3 -c 'import json,sys; [print(w["path"].split("/")[-1], w["linkedLinearIssue"]) for w in json.load(sys.stdin)["result"]["worktrees"]]'
```

## Why `--current` answered `linear_no_linked_issue`, which this repository already knew

**`--current` resolves from the CALLER TERMINAL, not the working directory, whenever the caller has
one.** A caller with no Orca terminal -- a plain shell -- is resolved by its working directory instead,
measured 2026-09-22 against Sift's bound `sift-21-absent-tracks`. That is not a new
finding: `docs/research/multi-repo.md` measured it under "The trap, which produced a false negative
inside this research", and ruled under "The chain, measured end to end" that a null
`linkedLinearIssueWorkspaceId` "is not a signal of anything". Checking a binding by hand from
another worktree's shell returns

```
linear_no_linked_issue: "The current worktree is not linked to Linear."
```

about the SHELL's worktree, not the one you are standing in. `ORCA_WORKTREE_ID` cannot be overridden
to fake it either.

Re-measured here on 2026-09-20, because a first pass had missed it and drawn the wrong conclusion:
from a terminal belonging to `cncore-265`, standing in `cncore-281`, `--current` answered
**CNCORE-265**. With a terminal present, the cwd is not consulted at all.

**This invalidated two of this record's own first-draft measurements.** Both probe worktrees had
been bound to CNCORE-265 — the same ticket as the terminal doing the asking — so their `--current`
reads could not distinguish the probe's binding from the caller's, and proved nothing. They are
withdrawn rather than restated. The binding measurements above stand, because they are `worktree
list` reads and never touch `--current`.

### Why it was five for five, and why it reproduces for a dispatcher and not for an agent

The rule is not "sometimes fails". It is **the caller's own worktree answers**, and that makes the
outcome a property of who is asking:

| the caller's terminal belongs to | `--current` answers |
| --- | --- |
| a bound ticket worktree | that terminal's ticket, whatever directory it stands in |
| the MAIN worktree, which is unbound | `linear_no_linked_issue`, every time |

A dispatcher works from the main worktree (`CLAUDE.md`: "Dispatch from the main worktree"), and the
repository's own checkout carries `linkedLinearIssue: null` — it is a checkout, not a ticket. So a
by-hand check from there returns `linear_no_linked_issue` for **every** worktree the
dispatcher stands in, bound or not, which is exactly the five-for-five the wave saw and the
re-verification on `cncore-282` that followed it. The research document had measured this same
unbound-caller case; this record adds the bound-caller half, and the two together fix the rule.

**The normal dispatch path is unaffected**, because Orca gives the agent a terminal in its own
worktree — as this ticket's own agent had, resolving CNCORE-265 from `--current` on its first call,
before anybody told it a ticket number.

So the hand-briefing the wave fell back on was not noise: from the dispatcher's terminal the check
could not have returned anything else, and no amount of re-running it would have said otherwise.

## The other two faces, both the dispatcher's measurements

**`orca terminal send --enter` queues rather than submits when the agent is mid-turn.** The text
lands in the input box, the UI shows `ctrl+x ctrl+s to send now`, and the call still answers
`ok: true` with a byte count. Measured three times on 2026-09-20 against cncore-205, cncore-254 and
cncore-252. In all three the message was an attribution correction, and in all three it would have
arrived after the PR body it was meant to correct had been written. `ctrl+x ctrl+s`, sent as
`printf '\030\023'`, flushes it **and INTERRUPTS the turn in progress**: the agent abandons what it
was doing and answers the brief instead. Corrected here on 2026-09-21 under CNCORE-306, which
measured the flush against CNCORE-288's agent mid-search and read back
`|_ Interrupted - What should Claude do instead?`. The first draft of this sentence stopped at
"flushes it", which invites the harmless reading — that the queued text merely arrives — when the
behaviour is closer to Escape followed by Enter.

**Input sent to a PARKED agent goes to the prompt widget, not the chat.** Measured broadcasting a
merge notice to eight agents: six received it, two were sitting on an `AskUserQuestion`. Both known
tells read clean — no `ctrl+x ctrl+s` hint, no unsent text — because the input never reached the
box. Worse, **`--enter` on a parked agent SELECTS the option under the cursor**, and on a
multi-select with a free-text field the text can land in the field. The way through, since the
Owner's ruling of 2026-09-26 (CNCORE-420), is to send it nothing: its question is the Owner's to
answer in that agent's own worktree
([[0187-wait-for-the-prompt-because-the-flush-costs-the-turn]]).
That record carried keystrokes for answering a widget from outside it, added 2026-09-21 under
CNCORE-306 because this record stated the hazard and stopped; the ruling retired them. Neither agent's answer was corrupted here; that was luck, not
design.

## The decision

**Every channel is confirmed by reading the RECEIVING end, and the confirmation names the field or
the pixels that answer it.** Not the call's exit code, which is uniformly `ok: true` across all
three, and not a read that resolves against the asker instead of the subject.

| channel | what a green call proves | what confirms arrival |
| --- | --- | --- |
| `worktree create/set --linear-issue` | the call was accepted | `linkedLinearIssue` on the worktree |
| `terminal send --enter`, mid-turn | bytes were written | `--screen`, with no `ctrl+x ctrl+s` hint |
| `terminal send --enter`, parked | bytes were written | `--screen`, read BEFORE sending, and a parked agent is then sent nothing |

`--screen` is required rather than preferred: the default read returns stacked fragments rather than
what the terminal renders, so it cannot show an input box at all.

**The parked case is read before the send, not after it**, and that is the ordering this record
fixes rather than the check; since 2026-09-26 a read that finds the agent parked ends in no send at
all (CNCORE-420). The other two are recoverable by re-sending — the MESSAGE is, at least,
and that is all this sentence ever meant. A TURN a flush interrupted is not recoverable by anything,
which is the cost corrected into this record above; re-sending the words does not give back the work
the agent abandoned to read them. A send into a prompt widget is recoverable by neither: it may
already have answered a question on the agent's behalf.

**And the binding is read from `worktree list`, never from `--current`.** `--current` answers about
the asker, so it is the right tool for an agent reading its OWN ticket and the wrong one for a
dispatcher auditing somebody else's worktree.

## Why the monitor takes the binding check rather than the prose

A dispatcher reading the wrong field is exactly what prose cannot prevent, because the instruction
and the mistake look identical at the moment of the mistake — twice now, seven days apart, by the
same route. `monitor.sh` already classifies every CanonCore worktree each pass for `ROOM`, `IDLE`
and `GONE`; `UNBOUND` is the same read, widened to every repo the dispatcher runs by
[[0192-a-cross-repo-tickets-provider-half-gets-a-worktree-of-its-own]], and it chooses the field
once so nobody has to choose it again.

It emits on the ABSENCE, which only fails safe if absence is distinguishable from not having looked.
So the listing is checked for `truncated` and a short read emits `UNBOUND-BLIND`, the same shape
`LINEAR-BLIND` already uses for a board that could not be read.

## What this does not decide

The `orca` CLI's error text is upstream and unchanged. A future runtime that separates "not linked"
from "resolved against a different worktree" would make the by-hand check safe and this record's
routing unnecessary; nothing here is a reason to keep the workaround once that lands.

Decided by the DISPATCHER on 2026-09-20, not by the Owner.
