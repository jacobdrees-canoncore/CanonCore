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

## The container half is built, under CNCORE-73 — and this record STILL stays proposed

**BUILT: the constraint on `placements`** (migration 15). It is this record's category trigger with
two names changed, which is what the section above promised — "a port rather than a design". A
`BEFORE INSERT OR UPDATE` trigger refuses a container asked to hold itself, and refuses one asked to
hold something it already sits inside; the walk is `WITH RECURSIVE ... UNION`, and the `UNION` is
the visited set for the same reason it is one in migration 1.

**THE SLICE THAT BUILT IT IS NOT THE SLICE THIS RECORD EXPECTED, and the difference is worth
reading.** This record assigned the container half to "the slice that first lets an owner reparent a
Container", meaning a tree. CNCORE-73 ships no tree: its Members list is flat. What made the cycle
writable anyway is the MUTATION — `placement.move` takes a destination container, because
[[0116-a-reorder-writes-the-delta-and-the-tree-is-keyed-on-the-placement]] says a drag sends "its
new container and its new position". So the hazard arrived with the mutation rather than with the
gesture, which is this record's own point made from the other end: a UI that cannot express a cycle
is not a reason the database will not be asked to store one.

**OBSERVED THROUGH THE MUTATION RATHER THAN THROUGH THE UI**, deliberately, because that is the only
observation that means anything here. A test that dragged and found it could not would be testing
the drop targets.

**THE WALK GOES UP, FROM THE CONTAINER.** Adding "container C holds item I" closes a cycle exactly
when C is already inside I, so the cheap question is whether I is among C's holders. Walking DOWN
from I would enumerate everything I contains — a season's whole membership on every placement — to
answer the same question.

**TWO TRIGGERS, BECAUSE A REORDER WRITES ROWS THAT CHANGE NO EDGE.** A drag writes the moved
placement and every sibling whose position shifted, and a sibling's `position` is not an edge — so
the UPDATE trigger carries a `WHEN` and fires only when an endpoint moves or a tombstone is cleared.
Sixty episodes reordered is one walk rather than sixty.

**MULTI-PLACEMENT IS NOT A CYCLE**, and the test that guards that is in the suite rather than only
in this sentence: one season in both a release order and a story order is a diamond, two holders and
no path back. A refusal written as fan-in rather than as reachability would refuse the thing this
catalogue is for.

**NOT BUILT, STILL: BOTH ANCESTOR CLOSURES.** The category closure this record asked for under
CNCORE-4 is unbuilt and nothing reads category ancestors yet; the CONTAINER closure is likewise
unbuilt, and container progress — which is in the playback half — is still where it belongs. What
CNCORE-73 moved off that slice was the constraint alone. **The record is therefore half implemented
in both graphs and stays `proposed`**, which is the honest state: the rule that stops new cycles is
in place twice, and the closure that makes ancestors cheap to read is in place nowhere.
