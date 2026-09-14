---
status: proposed
---

# A listing says where the reader is, but still cannot be jumped into

A page of a listing says which rows it is showing and how many there are: "3,201–3,300 of 7,000",
not merely "100 of 7,000". **It still offers no jump to page seven.** Those are two different
requests that [[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]] refused together, and
only one of them had to be refused.

## Supersedes

ADR-0119's first bullet under "What this shape cannot do": *"No 'items 101–200 of 4,312'. A keyset
walk has no offset, so a page cannot say WHICH hundred it is showing without counting."*

**That sentence is exactly right and it was read as a refusal.** Its operative words are "without
counting", and this record is what happens when somebody agrees to pay the counting. Nothing else in
ADR-0119 is reopened: the walk stays keyset, the cursor stays a row's own key, the ordering and the
comparison stay one rule, and the second bullet — no jump to page seven, no page numbers AS
NAVIGATION — stands and is restated below.

## The two halves cost different things, and an earlier draft of the successor conflated them

**Saying where you are is a COUNT.** Rank the anchor — how many rows sort before it — and the page
number falls out of the rank and the page size. It is the same shape as the `total` every listing
already computes, because ADR-0119 insists the cap is never silent. So this is a second count beside
a count, not a new kind of work.

**Jumping to page seven is an OFFSET**, and that is a different thing entirely: it means producing
the six hundredth row without having seen the five hundred and ninety-nine before it, which is what a
keyset walk has no way to express and what PostgreSQL's own documentation warns about — *"the rows
skipped by an `OFFSET` clause still have to be computed inside the server."* No count gives you that.

**So the answer differs by half, and the record has to say which.** A reader is told where they are;
a reader is not given a numbered page to land on. **The A–Z jump is the landing mechanism**
(ADR-0119 names it as "the navigation that fits this shape"), and a letter is a better target than a
number anyway: a reader looking for something knows its first letter and does not know its page.

## What it costs, stated rather than waved through

**Two counts per page instead of one**, both growing with the catalogue. The rank is the more
expensive of the two, because a `total` can be answered from a narrower predicate while a rank must
respect the full sort order. Measured evidence that this class of work grows: Albe (Cybertec,
January 2023) put offset pagination at 1.16 ms on page one and 15.36 ms on page one hundred, against
1.40 ms and 1.39 ms for a keyset walk. A rank does the same linear work that offset's first number
describes, so the cost of saying where you are follows the offset curve even though the walk does
not.

**That is the trade being made**: the walk stays flat, and one label on it does not. If the label
ever costs more than the page it sits on, the honest move is to drop the label, not the walk.

**Not everyone pays it.** Stripe's cursor API returns no total at all — only `has_more` — which is
the reminder that a count is a choice rather than a property of pagination. CanonCore already chose
to pay one, for ADR-0119's reason. This record chooses to pay the second, for the reader's.

## Why the refusal did not survive its own reason

ADR-0119's refusal was correct when it was written and was taken forward on a stronger claim than it
made. The spec that inherited it said a page number "cannot be answered without becoming a different
walk", which is false: it can be answered by counting, and counting is not a different walk. The
record said "without counting" and meant it literally.

**It is worth naming why the overstatement happened, because the mechanism is general.** A refusal is
easier to carry forward than its reason, and a reason that says "this costs something" compresses on
each retelling into "this is impossible". The two are different decisions and only one of them is
revisitable. Whatever restates a refusal from another record should quote its reason rather than
summarise it.

## Evidence

ADR-0119's own text, quoted above. PostgreSQL 18 documentation on `LIMIT`/`OFFSET`, read 2026-09-13.
Markus Winand, use-the-index-luke.com — whose "you cannot directly navigate to arbitrary pages" is
about navigation, and whose remark that page numbers are poor navigation is marked as his opinion
rather than a finding. Laurenz Albe, Cybertec, January 2023, for the measured offset curve. Stripe's
published pagination contract for the counterexample.
