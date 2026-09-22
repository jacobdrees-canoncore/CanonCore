---
name: verify-tickets
description: "Audit a published spec and its tickets from four angles before any of them is dispatched. Run it by typing /verify-tickets; it is never entered by inference."
disable-model-invocation: true
---

# Verify Tickets

`/to-tickets` produces a breakdown that reads well to whoever wrote it. This is the pass that finds
what the author cannot see in their own text, and it runs BEFORE anything reaches `/dispatch`.

Its first run, over a 21-ticket breakdown, found an item kind that does not exist in a closed set, a
design contradicting a record that measured 518,768 rows, three acceptance criteria that were
impossible, a ticket repeating a defect recorded in the docblock of the file it touched, and a set
with exactly one demoable moment — at the end. **The author had already re-read all of it.**

## Four readers, in parallel

Each angle finds a different class of defect and one reader carrying all four dilutes every one.
They do not need to agree and you do not reconcile them: you carry the findings.

## 1. Gather the material

Read the spec and **every** ticket by identifier, in full.

`orca linear list` is not an existence check — it omits issues created minutes ago. `orca linear
create` answers `ok: false` on tickets that landed and on tickets that did not; the identifier
sequence tells them apart, because a create that failed leaves no gap. A read can come back empty and
succeed on retry. `docs/agents/issue-tracker.md` carries the rest.

Note every fold: which ticket absorbed which, and whether the absorbed acceptance criteria survived.

## 2. Dispatch the four angles

Give each agent the spec, the ticket identifiers, the folds and the tracker gotchas above. Each
changes nothing and reports worst first.

**Coverage.** Spec → tickets and tickets → spec. Every decision and obligation in the spec against
the ticket that delivers it; anything with none is the deliverable. Then the reverse, because
invented scope costs what a gap costs. The spec's own testing obligations go missing quietly — hunt
them by name.

**Records.** `docs/adr/` is the authority, so audit against all of it. What does a ticket contradict
outright; what does it break without declaring it; what does it flip, and does a ticket own the flip?
`CLAUDE.md`: a ticket is not done until the ADRs it implements read `accepted`, and a half-built
mechanism stays `proposed` with the missing half written in. **Where a ticket cites a record, verify
the record says what the ticket implies** — a citation reads authoritative whether or not it is true.
COUNT the statuses rather than quoting a figure.

**Slices.** Vertical, or a layer wearing a slice's name? Demoable alone, or only once a later ticket
lands? Sized for one fresh context window? ADR-0051 spent its licence for a non-demoable pull request
on ONE, so every further one is a finding. Count the demoable moments and say where the longest gap
falls. Check the blocking edges are gates rather than ordering preference, and name any ticket
unstartable far longer than it needs to be.

**Conformance.** The spec and the tickets against the literal text of `to-spec` and `to-tickets`:
templates, the user-story form, the four flags, dependency order, and the prohibition on file paths
and code. That last is the most broken rule of the two, so read for it specifically.

## 3. Carry the findings

Report worst first, in your own words. **Say plainly which are yours.** An author's own error found
by an auditor is the most valuable thing this pass produces and the easiest to soften on the way out.

Then put it to the user as a choice: reshape now, read the reports first, or fix what is broken and
leave the shape. Reshaping is a rewrite of most of the set rather than a patch, and that spend is
theirs to authorise.

## 4. Re-verify what you rewrote

A rewrite is unaudited text, written under the same conditions as the errors it corrects. Run the
four angles again over the reshaped set, and hand each one the findings the rewrite was meant to fix
so it rules each **fixed, partial or still open** rather than taking your word for it.

Done when every angle has reported on the current text and every finding carries a verdict.
