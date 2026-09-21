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
> and every sentence stating the parked-widget hazard that does not name this record beside it.
> **BUILT AS PROCEDURE, WITH NO CHECK POSSIBLE FROM THIS REPOSITORY: the keystroke recipes**, whose
> confirmation is a dispatcher reading a rendered screen; nothing here can observe another agent's
> widget, which is ADR-0162's own limit and unchanged by this record.
> **NOT BUILT, BECAUSE NOT MEASURED: the multi-question MULTI-select.** Three of the four shapes
> below were measured on 2026-09-21; the fourth cell is named and left empty rather than derived
> from the other three, because the one assumption this record exists to refuse is that a widget's
> keystroke count can be reasoned out instead of read.

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

## Getting through the widget, by shape

A parked agent is unreachable until its prompt is answered, and **`--enter` SELECTS the option under
the cursor**. The way through is to answer it deliberately, and the keystroke count is a property of
BOTH the widget's kind and its question count — not of its kind alone, which is the assumption that
sends stray Enters into whatever comes next.

| | one question | several questions |
| --- | --- | --- |
| **single-select** | ONE Enter. It selects and SUBMITS. There is no review screen. | Enter selects and ADVANCES to the next question. After the last comes a "Review your answers" screen whose default is `Submit answers`. Two questions is THREE Enters. |
| **multi-select** | Enter TOGGLES the option under the cursor, `[ ]` to `[✔]`, and the cursor STAYS PUT. Submit is its own row, below the last option and ABOVE "Chat about this", reached with the DOWN ARROW (`orca terminal send --text $'\x1b[B'`) — from option 1 of a four-option question that is four presses, and a fifth overshoots into "Chat about this". Enter there opens the review screen; its default is `Submit answers`. | **NOT MEASURED.** |

Each measured cell was measured on 2026-09-21: the single-question single-select on this record's
own dispatch, the two-question single-select on CNCORE-288's parked question, the single-question
multi-select on CNCORE-302.

**The asymmetry in the first column is the surprising part and is recorded as measured rather than
explained.** A one-question single-select submits on the first Enter with no review screen; a
one-question MULTI-select gets one. Nothing here accounts for why, and a dispatcher who assumes the
review screen is a property of question count will submit a single-select answer one keystroke early.

A bare Enter is `orca terminal send --text "" --enter`. It answers `Sent 1 bytes`. There is no
separate key flag. The down arrow is `orca terminal send --text $'\x1b[B'`.

## Until the review screen clears, the widget eats the chat

**The widget is still open after Submit.** Enter on the Submit row opens a third screen — "Review
your answers / Ready to submit your answers?" — and until that final Enter lands, **every `send`
aimed at the chat goes INTO the widget and is lost, silently, while `orca terminal send` answers
`Sent N bytes`.**

Measured 2026-09-21 on CNCORE-302. The answer registered as `User answered Claude's questions`, and
the three messages sent after it — the dispatcher attribution and both reasons — appear nowhere in
the transcript. The agent was left with a bare choice and no idea who made it or why. It was found
only by reading `--screen` back; no tool result said anything had gone missing. The dispatcher's own
count for the night is FOUR; three are the ones above, read out of that transcript, and the fourth is
taken from that count rather than from a transcript this record has seen.

**So attribution cannot ride in the selection.** An answer arrives looking exactly like a human's,
which the Owner's own standing rule refuses: a dispatched agent's questions are answered by the
dispatcher, and the record has to say so. **That message names the dispatcher AND the date**, since
an answer with an author and no date cannot be placed against the wave that produced it. It is sent
AFTER the widget has closed,
confirmed closed by `--screen` — and it is the one message worth interrupting a turn for.

## Read `--screen` between every keystroke

Not before the first one only, which is as far as ADR-0162 goes. The tab bar
(`← ☐ A ☐ B ✔ Submit →`) shows which question is live and which are answered; the cursor line
(`❯ 1. ...`) shows what an Enter would take. Both change under you, and the cursor row is the only
thing that says whether the next Enter toggles, advances, or submits.

## What this does not decide

The multi-question multi-select, named above and left unmeasured. Measure it before driving one
rather than interpolating this table: the single-question row already contains one asymmetry that
interpolation would have got wrong.

Decided by the DISPATCHER on 2026-09-21, not by the Owner.
