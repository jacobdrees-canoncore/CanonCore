---
status: proposed
---

# Whether a work is watched unions coverage intervals against extent

"Have I watched this WORK" is computed by unioning the coverage intervals of watched editions
against the work's extent. Where the extent is unknown the answer is UNKNOWN, never false and never
a fabricated true.

ADR-0060 makes unknown the absence of a row and forbids deriving extent from
the maximum part any edition covers; this is the computation those rules exist to serve. Without it
written down, the natural implementation is a boolean on the item, which cannot express "a quarter
of this serial survives and I have seen all of it".

Distinct from ADR-0068, which counts members of a container.
This counts parts of one work.
