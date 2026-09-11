---
status: proposed
---

# The read projection rebuilds wholesale, versioned by revision id

Rebuild the read projection WHOLESALE, never incrementally, with revision-id versioning on
projection writes so a stale rebuild cannot overwrite a newer one.

ADR-0014 makes the projection mandatory and tells an implementer to pick trigger-maintained or
application-maintained deliberately, naming the failure mode of each: a trigger inside every write,
or an application path that can be bypassed. THAT CHOICE IS STILL OPEN and belongs to the slice that
builds the projection.

This record settles a different question that neither option escapes: two rebuilds racing, the
slower finishing last and winning. Incremental rebuilds make it worse rather than better, because a
partial pass leaves the projection in a state no single revision describes. (A trigger is incremental
by nature; this rule governs the reconciliation pass, not the per-write path.)

Wholesale is affordable because the projection is derived by definition: the statements table is the
truth and the columns are a cached copy of whichever statement currently wins.

## As built, under CNCORE-4 — and this record stays PROPOSED

The choice this record left open is made: the projection is TRIGGER-MAINTAINED.
See ADR-0014, which now carries the reasoning and the failure mode.

**BUILT.** `project_all_items()`, the wholesale rebuild. It is what runs when
the source order changes, which ADR-0024 requires to re-pick the whole catalogue
-- and it re-picks WHOLESALE rather than incrementally, exactly as this record
says.

**NOT BUILT: the revision-id versioning.** Nothing schedules a rebuild yet, so
there is no second rebuild for a slow one to finish behind and overwrite. The
race this record exists to settle cannot occur until something runs a rebuild
concurrently with another, and the versioning belongs with the first thing that
does. Recorded here rather than assumed, because a wholesale rebuild that looks
finished is precisely how the race gets shipped.

Note that the per-write path is a trigger and therefore incremental by nature.
This record governs the RECONCILIATION pass, which is `project_all_items`, and
the distinction is the one the record already draws.
