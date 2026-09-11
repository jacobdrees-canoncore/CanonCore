---
status: proposed
---

# Category cycles are refused by the database, and every ancestor walk carries a visited set

Two rules, and they are not alternatives to one another.

The database carries an acyclicity constraint and an ancestor closure, so a cycle is refused where
it is written rather than tolerated and worked around at every read.

And any ancestor expansion MUST carry a visited set anyway, because the archive's real graph is a
cyclic DAG 22 levels deep with 28 categories genuinely on a cycle — four non-trivial strongly
connected components plus three self-loops, over 45,115 category edges (measured; see ADR-0057). A
traversal written without one does not return a wrong answer, it does not return at all.
Twenty-eight is enough: one cycle hangs a walk as surely as seven thousand would.

The constraint is what stops new cycles; the visited set is what survives the data already holding
them.

NOTE THE TWO GRAPHS. This record governs the CATEGORY graph. ADR-0068 walks CONTAINER ancestry and
needs its own closure, which is a different table — and nothing yet forbids a placement cycle. That
gap is named here rather than papered over, and belongs to the slice that builds container
progress.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: the constraint.** A trigger on `statements` refuses a `category`
statement that would close a cycle, including an item as its own category. The
walk uses `UNION` rather than `UNION ALL`, and that IS the visited set this
record demands rather than a stylistic choice: `UNION` deduplicates against what
the recursion has already produced, so the walk terminates even against data
that already holds a cycle. `UNION ALL` would not return at all.

**NOT BUILT: the ancestor closure**, and nothing reads ancestors yet. It belongs
with the first surface that walks the category graph, which is also where the
second rule -- every ancestor expansion carries a visited set -- gets a second
place to hold.

The container graph named in this record's own note is likewise untouched: a
placement cycle is still unforbidden, and that gap belonged to container
progress.

## The container half is now owed sooner, and by a different slice

**A sortable TREE is what changes this.** Reordering a flat Container cannot make a cycle. A tree
that lets a Container be dragged into another Container can, and
[[0115-the-public-release-comes-before-the-playback-half]] takes one.

The reference implementation guards it CLIENT-SIDE ONLY — it removes a node's descendants from the
drop targets for the duration of a drag, so the gesture cannot express the cycle. That is correct
for the UI and worthless as an invariant: a crafted call to the placement mutation still writes one,
and the database stores it happily.

So the container half moves off container progress, which is in the playback half and unbuilt, and
onto the slice that first lets an owner reparent a Container. **The mechanism is not new work:** it
is this record's category trigger applied to `placements` instead of `statements`, with `UNION`
doing the same job as the visited set. A port rather than a design.

Stated plainly because the alternative is worse than doing nothing: a UI guard with no server check
reads as an enforced rule to everyone except the person who bypasses it.
