---
status: proposed
---

# Two thresholds, with the uncertain band going to a human

Above the high bar enrichment applies on its own, below the low bar it is discarded, and
everything between goes to a review queue worked when the owner chooses. Rejections are remembered.

This is the standard record-linkage design. Almost nothing remembers rejections: Immich regenerates
dismissed duplicate groups verbatim and OpenRefine has no "not a match" state at all, so the queue
refills with the same questions forever.

Calibre's staged-mode refusal is recorded as a single one (bug #926524, 2012-02-04, Won't Fix — "This
is not worth the effort, for me."). An earlier version said it had refused twice; a second refusal
could not be found.

Enrichment is a background queue and never a wizard. Calibre built a modal per-book matching step,
deleted it in 2011 for a background queue plus optional review, and refused to reinstate a staged
mode.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-products.md`.

## The two bars, built under CNCORE-361 -- and this record stays PROPOSED

**BUILT: BOTH BARS, ON THE WORKS MATCHER.** `WORK_MATCH_BARS` in `packages/db/src/works-match.ts` is
`{ high: 0.9, low: 0.5 }`. A browse applies a match at or above 0.9, discards one below 0.5, and
hands the band between to the Owner as a candidate pair (migration 26, `match_candidates`). Each is
asserted at the router in process (ADR-0103) in `provider.test.ts`, "works matched across Providers",
and each assertion was checked by deleting the behaviour it names.

**THE BARS ARE SET AGAINST A FIXED TABLE OF SCORES, NOT TUNED.** Each combination of title signal and
date signal scores one number: the same title on the same day 1, what follows a colon on the same day
0.7, the same title with no date 0.6, the same title on another day 0.3, and a part-count
disagreement always 0. The bars sit where [[0028-the-confidence-score-is-falsifiable]]'s gate holds
over the labelled set. So the band holds exactly two shapes today: a subtitle on the same day
(`Children in Need: Born Again`), and the same title with no date to compare. The bars should move
only with a re-taken set and that gate re-run.

**NOT BUILT HERE: working the queue.** An offered pair is shown on both Items' pages, with its
signals. Confirming it, rejecting it, and remembering a rejection are CNCORE-363's, on the list
CNCORE-371 builds, and that ticket flips this record. Until then an offered pair stays open. A later
browse that meets the same pair writes no second row (`match_candidates_one_per_pair`).
