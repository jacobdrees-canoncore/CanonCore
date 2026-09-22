---
status: accepted
---

# A claims table is a rung, and the removable part was the self-claim

A shared append-only list that something states the SIZE of is a rung, and
[[0153-a-figure-about-this-tree-is-derived-or-dated]]'s claims table is one. Its contention is
answered by the conflict git already raises. What is NOT answered by a conflict, and was silent
until CNCORE-278 measured it, is the row that holds the record's own figure: delete it and the
figure stands unchecked with every test passing.

**The guard belongs on the self-claim, not on the append.**

## What made it a rung, and why it did not look like one

The `dispatch` skill's `SKILL.md` names a rung as a line on a ladder no ticket owns, and gave the
migration index, the shared fixture and a tool list. A claims table is that shape exactly:
`packages/config/src/tree-figures.test.ts` holds one row per figure this repository states about
itself, every ticket stating a derived figure appends to it, and ADR-0153 states how many rows it
holds. Each author sees the row they are adding and not the rows arriving beside it.

It was introduced by CNCORE-251 on 2026-09-20 and contended the same day. **Three branches appended
to it independently within two hours**: CNCORE-253, CNCORE-255 (merged as `5431ab0`) and CNCORE-248,
which went `DIRTY` on the collision. Each was individually correct. None could see the others.

So nothing had yet been taught to see it, which is the ordinary way a rung is found: after it has
been stood on.

## The append path is LOUD, which refuses the premise this was filed on

CNCORE-278 asserted that ADR-0153's stated count "IS silently wrong whenever two sets merge and only
one updated it". **That is false, and it was false the day the ticket was filed.** Two claims were
appended to the table on 2026-09-21 with the record's prose left alone, and the comparison reported:

```
docs/adr/0153-a-figure-about-this-tree-is-derived-or-dated.md states 55
for the claims this table holds; the tree holds 57
```

That comparison names the record, the population and both numbers, so the drift is reported rather
than left standing. CNCORE-251 landed the two self-claims WITH the table, so the
derived half of ADR-0153 covered its own figure from the first commit. Every append path ends in a
conflict git reports or a check that goes red:

- Both branches edit the prose line, so git conflicts on it. A conflict is reported, not silent.
- One branch edits the prose and the other does not, so the survivor's figure lands cleanly against
  a table that has grown twice. The comparison goes red.

**The dispatcher filed the premise and the measurement refused it.** Recorded here because a premise
corrected only in conversation is one the next reader re-derives from the ticket; CNCORE-278's own
body was corrected in the sentence that carried it.

## The silent path is the self-claim's absence

ADR-0153 says under "What this does NOT cover, said here rather than left to be discovered" that
**a figure missing from the table is not caught** -- it is a roll
call, not a sweep of the prose. That limit is correct everywhere except at one document, and
ADR-0153 is that document, because it is the one that states the table's size.

Measured 2026-09-21, against the file as it stood at `d10673d` before the guard below existed: with
the two rows holding the record's own figures deleted, **every test in the file still passed.** The
figure ADR-0153 states about itself was then derived by nothing and compared to nothing, in the
record whose whole thesis is that such a figure drifts. The guard that holds every other claim honest
was the one thing no claim held.

**THE COUNT OF TESTS THAT PASSED IS DELIBERATELY NOT QUOTED, AND NEITHER IS THE TABLE'S SIZE.** Both
are figures this tree states about itself, and a copy here would be a drift site of exactly the class
this record governs -- ADR-0153 states the table's size once and this refers to it. The test count is
worse than a copy: it was a property of a file that no longer exists, because **the measurement
cannot be re-taken now and that is the point.** With the guard present the same deletion goes red,
which is the whole difference it makes.

**THE REMOVABLE PART WAS THE SELF-CLAIM.** That is the finding, and it generalises past this table: a
mechanism that checks a population does not check its own presence in that population, so the row
covering the checker is the row whose deletion nothing reports.

[[0169-a-check-answers-at-one-granularity-and-that-is-part-of-its-claim]] is the same shape one step
out, and it was taken three records earlier: a green check is read as the rule being kept rather than
as the question it asked being answered. This table is read as "a figure about this tree is derived"
when what it answers is "these listed figures are derived", and the row stating how many there are is
inside the population it counts.

## What was built

`tree-figures.test.ts` holds those two rows to being PRESENT and to TRACKING the table:

- **Presence**, against the populations named here rather than against a count, so a deleted or
  repointed row goes red.
- **Tracking rather than today's number**, because a row frozen to `() => 55` agrees with the prose
  the day it is written and never moves again. Under that mutation the comparison stayed GREEN and
  the new check went red on 55 against 56, which is the whole argument for it being a separate
  assertion: the freeze is invisible to a check that compares prose to derivation, since both sides
  say the same wrong thing.

Asserting that `derive()` equals `CLAIMS.length` was refused as tautological -- it recomputes the
value the way the row does and passes by construction, which is the hollow assertion CNCORE-257
measured ten of.

**PROVED BY DELETING THE BEHAVIOUR EACH HALF NAMES**, which is
[[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]]'s rule. That record says nothing
enforces it and it is one reviewers apply by hand; all ten of its cases were audited after the fact,
and this is the rule run FORWARD on an assertion as it was written. Four mutations, each red in the
check that should own it: both rows deleted, and one row deleted, go red here; a row frozen to a
constant goes red here while the comparison stays GREEN; a row repointed at a different real
population goes red in the comparison instead, reporting 24 stated against 55 in the tree.

## What this does NOT cover, said here rather than left to be discovered

**ADR-0153's two figures and nothing else.** A sweep of every self-referential claim in the table was
declined by the dispatcher on 2026-09-21 as speculative without evidence that another carries the
same hole. A third figure about that table is covered only by being added, exactly as a claim is --
and the guard is written by CONTAINMENT rather than as an exact list so that adding one does not
redden it, which is what would have made that sentence false.

**No guard on the append, by decision rather than omission.** A conflict is the right failure for a
shared list whose appends land in one region of one file: it is reported at merge, it names the file,
and it costs the loser a rebase rather than a silent overwrite. A mechanism to serialise appends
would buy nothing the conflict does not already say.

**But a conflicted PR gets NO CI run**, which is the real cost and belongs here rather than being
rediscovered. `CLAUDE.md` already records that a conflicted PR gets no run rather than a red one, so
the loser of a race learns from git and never from this check. CNCORE-248 received no run at all on
2026-09-20 for exactly that reason. The check protects `main`; it does not protect the branch that
lost.

## Why this is `accepted`

The mechanism of what was decided is whole: the decision is that the self-claim gets a guard and the
append does not, and the guard is built, runs in `pnpm test`, and was proved non-hollow by two
mutations rather than asserted to work. The boundary above is a scope ruling, not a missing half.
