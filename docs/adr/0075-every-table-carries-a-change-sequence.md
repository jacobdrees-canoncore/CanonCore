---
status: accepted
---

# Every table carries timestamps, a tombstone and a change sequence

Timestamps, tombstones and a monotonic change sequence sit on every table, from the first migration.

The change sequence is not bookkeeping. It is the substrate ADR-0040 needs: that record makes
reversal a query ("find everything stamped with merge 47 and put it back") rather than a second
history mechanism, and a stamp is only findable across every table if every table is ordered the
same way. ADR-0040 specifies the merge id and is silent on what it sits in; this is that. ADR-0049 schedules tombstone compaction,
which presupposes tombstones exist.

Retrofitting a change sequence means backfilling one for every row already written, and every row
written before it is indistinguishable from every other, so the reversal query cannot see history it
was not present for.

## As built, under CNCORE-4

ONE PostgreSQL sequence for the whole catalogue, not one per table. A per-table
sequence would order each table's rows and nothing else, and what ADR-0040 needs
is an order ACROSS tables -- "find everything stamped with merge 47" has to come
back in the order the merge touched things.

`updated_at` and `change_sequence` are advanced by a BEFORE UPDATE trigger on
every table that carries them, rather than by whoever writes the row. A write
that forgets is exactly the write a reversal query needs to find.

**A THIRD EXCEPTION, beside `owners` and Drizzle's ledger: the REFERENCE
TABLES.** `item_kinds`, `source_kinds`, `ranks` and the three property lookups
carry no `owner_id`, no tombstone and no change sequence. An item kind is not
owned by anybody and is not soft-deleted; it is removed by the migration that
removes it, or not at all (ADR-0029). Stated here rather than left to be
noticed, so the absence reads as a decision.

**And `merges` itself carries no merge stamp**, nor does `owners`. A merge
merges ITEMS: it never rewrites the single owner row, and a merge stamped with
its own id says nothing.

## A tombstone that PROPAGATES, under CNCORE-31

Every table carried a tombstone from migration 1 and every read path honoured
one, but nothing propagated one: an item the owner deleted kept its statements
LIVE. That was invisible until something needed a live statement to mean
something -- ADR-0078's unique index, which a dead item's live claim on a
provider's id then made refuse a correct re-import.

**AN ITEM THAT IS GONE MAKES NO CLAIMS**, and migration 5's
`items_tombstone_statements` trigger is that rule. Three details are decisions:

- **BY TRIGGER**, for the reason migration 1 gave for the projection -- a trigger
  cannot be forgotten, and application-maintained is silently bypassed by
  anything writing directly. It bites harder here, because the path that would
  otherwise carry the rule DOES NOT EXIST. Nothing in the product TOMBSTONES an
  item; ADR-0046 designs the confirmation and no slice has built it. The delete
  slice inherits the rule instead of having to know it. A provider purge does
  delete items, and is not the exception it looks like: it deletes the rows
  outright rather than setting `deleted_at`, because ADR-0036's obligation on
  termination is to purge cached content rather than to hide it -- so this
  trigger, `AFTER UPDATE OF "deleted_at"`, never fires on that path at all
  (ADR-0046, under CNCORE-34). Migration 5's own comment still says "deletes",
  and stays that way: a shipped rung is frozen by its hash and `db:check-ladder`
  enforces it, so this record is where that wording is corrected rather than the
  SQL.
- **AT THE ITEM'S OWN `deleted_at`, NOT `now()`**, so the item and the statements
  it took carry ONE timestamp. That is what keeps the delete reversible by query
  in ADR-0040's shape: "the statements of item X tombstoned at X's `deleted_at`"
  is exactly the set, and is distinguishable from claims a source withdrew on its
  own. `now()` would lose that, because inside one transaction it is equal for
  reasons that mean nothing.
- **AFTER, NOT BEFORE.** Tombstoning a title statement fires
  `statements_reproject_item`, which UPDATEs the very `items` row being deleted;
  from a BEFORE trigger PostgreSQL applies the outer row over that nested write,
  so the reprojection would be silently lost and a deleted item would keep a
  title no live statement supports.

**WHAT IT DOES NOT REACH**, each a decision rather than an oversight: statements
where the item is the VALUE rather than the subject (claims about OTHER items,
made by other sources, and a source may only withdraw what it said itself);
PLACEMENTS, which ADR-0046 settles -- deleting a container never deletes its
members; a statement's QUALIFIERS (ADR-0067), which are only ever read through
the statement they qualify, so one left live under a tombstoned statement is
unreachable rather than wrong; and UN-DELETING, which nothing does, so a trigger
for it would be code with nothing to run against. The matched timestamp is what leaves that door open
without building the door.
