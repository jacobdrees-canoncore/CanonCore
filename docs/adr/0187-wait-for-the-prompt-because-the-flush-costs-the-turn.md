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
> and every sentence stating the parked-widget hazard that does not name this record beside it. **That
> tree no longer holds the `dispatch` skill's copy of these sentences:** it moved to the skills
> repository on 2026-09-22, where no such check runs, so this record's check covers `CLAUDE.md` and
> the records here and not the one a dispatcher reads while sending.
> **BUILT AS PROCEDURE, WITH NO CHECK POSSIBLE FROM THIS REPOSITORY: whether a keystroke recipe is
> RIGHT**, whose confirmation is a dispatcher reading a rendered screen; nothing here can observe
> another agent's widget, which is ADR-0162's own limit and unchanged by this record.
> **BUILT AS A CHECK UNDER CNCORE-337: whether a recipe says what screen it was read at.** The same
> suite reads the table below and fails the build on a row that gives a count with its `tab bar at
> rest` cell empty, and on a table that no longer answers one kind-and-question-count pair twice.
> That is not the same question as the one above and does not close it: it refuses a count offered
> without its screen, and says nothing about whether the count is correct.
> **NOT BUILT, BECAUSE NOT MEASURED: the multi-question MULTI-select**, named in the table below and
> left empty rather than derived from the rows around it, because the one assumption this record
> exists to refuse is that a widget's keystroke count can be reasoned out instead of read.
> **NOT BUILT, BECAUSE THE READING IS THE DISPATCHER'S: why two measurements of the SAME
> two-question single-select disagree.** CNCORE-337 put CNCORE-336's one-Enter reading into the
> table beside CNCORE-288's three-Enter one and made the tab bar at rest a column, since the count
> is evidently not fixed by the kind and the question count. Which of the two candidate causes
> holds is UNRESOLVED at the foot of this record, and settling it needs a freshly parked agent read
> before any keystroke — nothing in this repository can observe one.

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

## Getting through the widget: what was read, and at which screen

A parked agent is unreachable until its prompt is answered, and **`--enter` SELECTS the option under
the cursor**. The way through is to answer it deliberately, and **the keystroke count does NOT
follow from the widget's kind and its question count**: the two rows below that share
`single-select` and two questions disagree, one submitting on the third Enter and the other on the
first. This sentence claimed the opposite until CNCORE-337, warning a reader off the narrower
assumption — that the count follows from the kind alone — while making the same mistake one level
up. It is the sentence a dispatcher counted keystrokes from on 2026-09-21 before committing an
answer to a question the widget never rendered. What the count DOES follow from is unresolved, at
the foot of this record.

**A ROW HERE IS A SCREEN SOMEBODY READ, NOT A SHAPE SOMEBODY NAMED.** The tab bar at rest is a
column of its own, because a count taken at one tab-bar state is not a count at another; where the
reader did not write that state down the cell says so, rather than leaving the next reader to
supply it from what the widget ought to have been showing.

| kind | questions | tab bar at rest | keystrokes to submit | measured at |
| --- | --- | --- | --- | --- |
| single-select | one | NOT RECORDED | ONE Enter. It selects and SUBMITS. There is no review screen. | this record's own dispatch, 2026-09-21 |
| single-select | two | NOT RECORDED | THREE Enters. Each selects and ADVANCES to the next question, and after the last comes a "Review your answers" screen whose default is `Submit answers`. | CNCORE-288's parked question, 2026-09-21 |
| single-select | two | `← ☐ Check seam ☐ run-suite ✔ Submit →`, with `Submit` ALREADY carrying its tick while question one's options were the thing displayed and the cursor sat on option 1 of 3 | ONE bare Enter. It submitted BOTH questions at once, each on its `(Recommended)` option. No advance, no review screen, and question two was never rendered at all. | CNCORE-336's parked question, 2026-09-21 |
| multi-select | one | NOT RECORDED | Enter TOGGLES the option under the cursor, `[ ]` to `[✔]`, and the cursor STAYS PUT. Submit is its own row, below the last option and ABOVE "Chat about this", reached with the DOWN ARROW (`orca terminal send --text $'\x1b[B'`) — from option 1 of a four-option question that is four presses, and a fifth overshoots into "Chat about this". Enter there opens the review screen; its default is `Submit answers`. | CNCORE-302's parked question, 2026-09-21 |
| multi-select | several | NOT MEASURED | NOT MEASURED | NOT MEASURED |

**The asymmetry between the two one-question readings is the surprising part and is recorded as
measured rather than explained.** A one-question single-select submits on the first Enter with no
review screen; a one-question MULTI-select gets one. Nothing here accounts for why, and a
dispatcher who assumes the review screen follows from the question count will submit a
single-select answer one keystroke early.

A bare Enter is `orca terminal send --text "" --enter`. It answers `Sent 1 bytes`. There is no
separate key flag. The down arrow is `orca terminal send --text $'\x1b[B'`.

## Until the review screen clears, the widget eats the chat

**WHERE AN ENTER OPENS A REVIEW SCREEN, THE WIDGET IS STILL OPEN BEHIND IT.** Enter on the Submit
row opens a third screen — "Review your answers / Ready to submit your answers?" — and until that
final Enter lands, **every `send` aimed at the chat goes INTO the widget and is lost, silently,
while `orca terminal send` answers `Sent N bytes`.**

**But a submission does not always get one** (CNCORE-337). CNCORE-336's two-question single-select
submitted on one bare Enter with no review screen at all, so there was nothing left to clear, and a
dispatcher waiting for one would have pressed its Enter into the chat instead. The table above says
per row whether a review screen came. **Confirm the widget has closed with `--screen`, never from
the count** — which is this record's rule everywhere else and is not suspended here.

Measured 2026-09-21 on CNCORE-302. The answer registered as `User answered Claude's questions`, and
the three messages sent after it — the dispatcher attribution and both reasons — appear nowhere in
the transcript. The agent was left with a bare choice and no idea who made it or why. It was found
only by reading `--screen` back; no tool result said anything had gone missing. The dispatcher's own
count for the night is FOUR; three are the ones above, read out of that transcript, and the fourth is
taken from that count rather than from a transcript this record has seen.

**So attribution cannot ride in the selection.** An answer arrives looking exactly like a human's,
so nothing in it says whose it is. On 2026-09-21 the dispatcher answered these questions itself;
the Owner ruled that out on 2026-09-22 ("dispatch should never answer another worktrees questions
to speed things along", CNCORE-387), so the answer delivered through the widget is the Owner's,
relayed by the dispatcher, and the record has to say so. **That message says the answer is the
Owner's, relayed by the dispatcher, AND gives the date**, since an answer with an author and no
date cannot be placed against the wave that produced it. It is sent
AFTER the widget has closed,
confirmed closed by `--screen` — and it is the one message worth interrupting a turn for.

## Read `--screen` between every keystroke

Not before the first one only, which is as far as ADR-0162 goes. **READ THE TAB BAR AND THE CURSOR
LINE TOGETHER, AND NEITHER ON ITS OWN.** The tab bar (`← ☐ A ☐ B ✔ Submit →`) shows which question
is live, which are answered, and — this is the part CNCORE-337 added — whether `Submit` is already
carrying its tick; the cursor line (`❯ 1. ...`) shows which option an Enter would take. Both
change under you.

This record used to say the cursor row alone told you whether the next Enter toggles, advances or
submits. CNCORE-336 refused that on 2026-09-21: the cursor sat on option 1 of 3, which says
nothing about submission, and the Enter submitted two questions because the tab bar had `Submit`
ticked at rest. **A tick on `Submit` beside unticked questions is not a report of answers given**,
and it is the one thing on that screen that says an Enter will END the widget rather than move
through it.

## What this does not decide

The multi-question multi-select, named above and left unmeasured. Measure it before driving one
rather than interpolating this table: the one-question readings already contain one asymmetry that
interpolation would have got wrong.

**And WHY the two readings of a two-question single-select disagree. UNRESOLVED, with two
candidates and no measurement that separates them (CNCORE-337):**

1. **A two-question single-select submits on ONE Enter**, and CNCORE-288's three-Enter reading was
   of a screen that differed in some way nobody wrote down. Then the older row is the wrong one.
2. **The widget was already focused on its `Submit` tab** while displaying question one, so one
   Enter submitted every default. Then both counts are right and what this record was missing is
   the state that says which of them applies — the more dangerous gap of the two, because a record
   missing a state reads as complete.

**The second is the likelier, on the `✔` alone**: CNCORE-336's tab bar carried the tick on `Submit`
while question one was still the thing on screen, which is a state no row of the earlier table
described. That is not a measurement, and this record does not get to assume it. The reading that
settles it is the DISPATCHER's, taken at the next freshly parked agent by reading the tab bar
BEFORE any keystroke, and it FLIPS a row of the table rather than being added beneath it.

Decided by the DISPATCHER on 2026-09-21, not by the Owner.
