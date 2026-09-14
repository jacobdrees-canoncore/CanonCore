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

## The reconciliation pass gained a step, under CNCORE-173

**`derive_all_sort_names()` RUNS BEFORE `project_all_items()`, and the order is
the whole of the change.** Re-ordering the sources changes which TITLE wins, and
`sort_name` is computed from the winning title
([[0134-a-sort-name-is-derived-by-stripping-a-leading-article]]) — so a pass
that only reprojected would leave every derived sort name computed from a title
that no longer shows, and the catalogue alphabetised by a claim its own pages do
not make.

**IT IS WHOLESALE FOR THIS RECORD'S REASON, not a new one.** The derivation is a
function of claims already held, so a partial pass leaves the same state no
single revision describes; and it is affordable for the same reason the
projection is, being derived by definition.

**THE COST, STATED: an item whose sort name actually changes is projected
twice** — once by the trigger firing on the derived statement's own write, and
once by the wholesale pass behind it. Both are needed and neither is redundant:
the derive pass cannot reach an item whose winning title changed but whose sort
name did not, and the project pass cannot write a statement. A source re-order
is an administrative act, so the doubling is bounded and rare rather than on any
read path. The revision-id versioning this record still lacks is what would let
the two passes be one.
