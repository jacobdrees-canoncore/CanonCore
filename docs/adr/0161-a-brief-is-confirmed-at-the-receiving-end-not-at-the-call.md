---
status: accepted
---

# A brief is confirmed at the receiving end, not at the call that sent it

> **ACCEPTED 2026-09-20, whole, in one repository.** The dispatch loop now confirms a brief where it
> lands rather than where it was sent: `monitor.sh` emits `UNBOUND` for a CanonCore worktree carrying
> no Linear binding, reading `linkedLinearIssue`; the three sentences that told a dispatcher a call's
> `ok: true` was evidence are corrected in place in `CLAUDE.md`,
> `.claude/skills/dispatch/SKILL.md` and `docs/agents/issue-tracker.md`. **NOT BUILT, and not ours to
> build: the `orca` CLI's own error text.** `linear_no_linked_issue` conflates two different
> failures and lives upstream, so this record routes around it rather than fixing it.

Three times on 2026-09-20 the dispatcher believed an agent had been briefed when it had not, and each
time the call said so. They are one defect with three faces: **an `ok: true` describes the call, not
the arrival.**

## What was actually wrong with the binding, which is not what it looked like

`orca worktree create --linear-issue CNCORE-<n>` **stores the binding and returns it.** Measured on
2026-09-20 against a probe worktree created and removed for the purpose, and against all seven live
CanonCore worktrees. `linkedLinearIssue` sits in the same object as `ok: true`:

```
"linkedIssue": null,                 <- the GITHUB issue number
"linkedPR": null,
"linkedLinearIssue": "CNCORE-265",   <- the Linear binding, present at create
```

The wave of 2026-09-20 was read as five unbound worktrees. It was not. **`linkedIssue` is a different
system's field**, null on every CanonCore worktree because GitHub Issues is unused here
(`CLAUDE.md`), and it sits two lines above the one that carries the answer. Every worktree in that
wave carries its correct binding today:

```
cncore-245 -> CNCORE-245   cncore-265 -> CNCORE-265   cncore-281 -> CNCORE-281
cncore-262 -> CNCORE-262   cncore-276 -> CNCORE-276   cncore-282 -> CNCORE-282
```

### The half that is measured, and the half that is not

`orca linear issue --current --json` genuinely answered `linear_no_linked_issue` five times that
day. That is the dispatcher's own measurement and this record does not dispute it. **It has not been
reproduced since**, and no cause for it is asserted here, because none was measured.

What the tree does show is why the two cannot be told apart. **The stored binding is a bare
identifier with no workspace attached** -- `linkedLinearIssueWorkspaceId` is `null` on all seven --
so `--current` resolves the workspace at READ time, from whatever is connected. That resolution is a
second step that can fail on its own, and when it does, the error it returns names the BINDING.

A null workspace id is **not** the discriminator, and this was checked before being asserted: it is
null on `cncore-265`, where `--current` resolves correctly. It cannot be the cause of a failure on a
worktree where there is no failure.

So the honest statement is the narrow one: **the binding is stored at create; resolving it is a
separate step; and `linear_no_linked_issue` cannot be read as "never bound".** The check that tells
them apart is `linkedLinearIssue` on the worktree, and `orca linear team list` for the connection --
which `docs/agents/issue-tracker.md` already names as the authorisation test.

## The other two faces, both the dispatcher's measurements

**`orca terminal send --enter` queues rather than submits when the agent is mid-turn.** The text
lands in the input box, the UI shows `ctrl+x ctrl+s to send now`, and the call still answers
`ok: true` with a byte count. Measured three times on 2026-09-20 against cncore-205, cncore-254 and
cncore-252. In all three the message was an attribution correction, and in all three it would have
arrived after the PR body it was meant to correct had been written. `printf '\030\023'` flushes it.

**Input sent to a PARKED agent goes to the prompt widget, not the chat.** Measured broadcasting a
merge notice to eight agents: six received it, two were sitting on an `AskUserQuestion`. Both known
tells read clean -- no `ctrl+x ctrl+s` hint, no unsent text -- because the input never reached the
box. Worse, **`--enter` on a parked agent SELECTS the option under the cursor**, and on a
multi-select with a free-text field the text can land in the field. Neither agent's answer was
corrupted here; that was luck, not design.

## The decision

**Every channel is confirmed by reading the RECEIVING end, and the confirmation names the field or
the pixels that answer it.** Not the call's exit code, which is uniformly `ok: true` across all
three.

| channel | what a green call proves | what confirms arrival |
| --- | --- | --- |
| `worktree create --linear-issue` | the call was accepted | `linkedLinearIssue` on the worktree |
| `terminal send --enter`, mid-turn | bytes were written | `--screen`, with no `ctrl+x ctrl+s` hint |
| `terminal send --enter`, parked | bytes were written | `--screen`, read BEFORE sending |

`--screen` is required rather than preferred: the default read returns stacked fragments rather than
what the terminal renders, so it cannot show an input box at all.

**The parked case is read before the send, not after it**, and that is the ordering this record
fixes rather than the check. The other two are recoverable by re-sending. A send into a prompt widget
is not: it may already have answered a question on the agent's behalf.

## Why the monitor takes the binding check rather than the prose

A dispatcher reading the wrong field is exactly what prose cannot prevent, because the instruction
and the mistake look identical at the moment of the mistake. `monitor.sh` already classifies every
CanonCore worktree each pass for `ROOM`, `IDLE` and `GONE`; `UNBOUND` is the same read, and it would
have answered the whole question of 2026-09-20 in one line without anybody choosing a field.

It emits on the ABSENCE, so a silent monitor means every worktree is bound -- the direction that
fails safe, since a worktree wrongly reported bound is the one that sends an agent out blind.

## What this does not decide

The `orca` CLI's error text is upstream and unchanged. A future runtime that stores
`linkedLinearIssueWorkspaceId` at create, or separates "not linked" from "could not resolve", would
make the read-time step reliable and this record's routing unnecessary; nothing here is a reason to
keep the workaround once that lands.

Figures here are dated and carry their population, which is
[[0153-a-figure-about-this-tree-is-derived-or-dated]]'s rule. Decided by the DISPATCHER on
2026-09-20, not by the Owner.
