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
