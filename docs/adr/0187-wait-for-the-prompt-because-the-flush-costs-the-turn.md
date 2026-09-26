---
status: proposed
---

# Wait for the prompt, because the flush costs the turn

> **PROPOSED 2026-09-21. Half the mechanism landed.** [[0162-a-brief-is-confirmed-at-the-receiving-end-not-at-the-call]]
> recorded two hazards about sending input to another agent's terminal and gave neither a way
> through; this record is the way through, and the rule about when to spend one.
> **BUILT AS A CHECK: the two sentences that carry the hazards** —
> `packages/config/src/terminal-send-hazards.test.ts` derives from the tree every sentence that
> hands a reader the flush recipe and fails the build on one that does not say what the flush costs,
> and every sentence stating the parked-widget hazard that does not name this record beside it and
> say there that the widget is sent nothing (CNCORE-422). **That
> tree no longer holds the `dispatch` skill's copy of these sentences:** it moved to the skills
> repository on 2026-09-22, where no such check runs, so this record's check covers `CLAUDE.md` and
> the records here and not the one a dispatcher reads while sending.
> **THE DELIVERY HALF IS RETIRED BY THE OWNER'S RULING OF 2026-09-26 (CNCORE-420)**: the keystrokes
> that answered a parked agent's widget from outside it, the table that counted them screen by screen,
> and the attribution message sent once the widget closed. A parked agent's question stays in its own
> worktree and the Owner answers it there; the dispatcher sends that widget nothing, not even
> navigation, and tells the Owner in one line which worktree is waiting. The `dispatch` skill carries
> that in `monitor.md`'s **Parked** reading (`claude-skills#30`), and its `asking.md` owns only the
> loop's own questions to the Owner. The section below that held the recipe now says why it went.
> Where the loop's standing decisions are kept is
> [[0203-standing-dispatch-decisions-live-in-dispatching-md-and-no-agent-can-change-them]].

ADR-0162 established that a brief is confirmed where it lands. It left two sentences that tell a
dispatcher what goes wrong without telling them what to do instead, and both cost something on
2026-09-21.

## The flush is an interruption, not a delivery

`ctrl+x ctrl+s` (`printf '\030\023'`) submits the queued text **and interrupts the turn in
progress**. ADR-0162's sentence stopped at "flushes it", which invites the harmless reading: that
the text merely arrives. The behaviour is closer to Escape followed by Enter.

Measured 2026-09-21, briefing CNCORE-288's agent mid-search:

```
  Searched for 2 patterns, read 3 files, listed 1 directory
  |_ Interrupted - What should Claude do instead?
> Dispatcher: ADR 0176, 0178, 0180 are claimed by live branches; take 0181. ...
```

The agent abandoned the search and answered the brief.

**So wait for the prompt where the message can wait, and flush only where it cannot.** A queued
message arrives by itself when the turn ends, at no cost; the flush buys earliness and pays a turn
for it. On a rung broadcast that trade is usually fine. On an agent forty minutes into a measurement
it is not, and the thing it abandons is not recoverable by re-sending.

What cannot wait is a message that the agent's CURRENT turn would otherwise act wrongly without: an
ADR number already taken by a live branch, a rung that merged under it, an attribution correction
that the PR body being written right now will otherwise carry. Everything else waits.

## The widget is sent nothing

A parked agent is unreachable until its prompt is answered: input sent to it goes to the widget,
where **`--enter` SELECTS the option under the cursor**, and until the widget closes every `send`
aimed at the chat is lost there silently while `orca terminal send` answers `Sent N bytes`
(measured on CNCORE-302, 2026-09-21: three messages sent after an answer appear nowhere in its
transcript).

This record went on to count, screen by screen, the keystrokes that got an answer through, measured
on four widgets on 2026-09-21 (CNCORE-288, CNCORE-302, CNCORE-336 and this record's own dispatch)
and corrected under CNCORE-337 when two readings of the same widget shape disagreed. It prescribed a
signed message, sent after the widget closed, saying whose answer had gone in. **That delivery half
is retired by the Owner's ruling of 2026-09-26 (CNCORE-420)**, which followed the one of 2026-09-22
that the dispatcher never answers another worktree's question (CNCORE-387, CNCORE-403): an answer
that passes through the dispatcher reaches the agent looking exactly like the Owner's, and on
2026-09-26 a single arrow key, pressed only to read the second tab of CNCORE-349's widget, moved
that widget off the tab the Owner was reading. So the widget is sent nothing, and the table and the
attribution message went with it (CNCORE-422). The readings are in this record's history in git, and
the question they left open, why two readings of one two-question single-select disagreed, is
closed as moot rather than answered.

## What this does not decide

When a flush is worth its turn in a given wave. The rule above says what the trade is; the
dispatcher makes it.

Decided by the DISPATCHER on 2026-09-21, not by the Owner. The delivery half was retired by the
Owner on 2026-09-26.
