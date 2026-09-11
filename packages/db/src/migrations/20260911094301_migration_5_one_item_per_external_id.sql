-- Migration 5, under CNCORE-31. ONE PROVIDER'S ID NAMES ONE ITEM, AND THE
-- DATABASE IS WHAT SAYS SO.
--
-- Migration 3 gave the importer a mapping to find an item by, and CNCORE-28's
-- own record was careful about what that did NOT buy: a find-or-create is not
-- mutual exclusion. `db.transaction` sets no isolation level, so it runs at
-- READ COMMITTED, and two callers that both find nothing both insert. This is
-- the index that refuses the second.
--
-- IT COVERS `external_id` ALONE, which is what makes it PARTIAL rather than a
-- plain unique index. Every other property is a claim two items may
-- legitimately share -- one source calling two stories `The Tenth Planet` is a
-- REPEATED TITLE and not a defect -- so uniqueness here is a statement about
-- one property's meaning rather than about statements in general.
--
-- THE PROPERTY'S ID IS A LITERAL BECAUSE POSTGRESQL REFUSES A SUBQUERY IN AN
-- INDEX PREDICATE, and ADR-0044 is what makes a literal available: exactly one
-- owner row, so exactly one `external_id` property row, whose id this rung can
-- read and pin with `format(..., %L)`. `INTO STRICT` is that assumption made
-- CHECKED -- it raises on no row and on a second one, so a future multi-user
-- migration meets a refusal here rather than pinning whichever row came back
-- first.
--
-- (SOURCE, VALUE) RATHER THAN THE VALUE ALONE, for the reason migration 3 gave
-- from the other side: a provider's id is unique in its own namespace and
-- nowhere else, so two providers both calling something `265` have said nothing
-- to each other and must not collide.
--
-- IT INDEXES A HASH, as migration 3's index does and for the same measured
-- reason: a btree tuple is capped at 2704 bytes and `value_literal` is
-- unbounded `text`. `md5` is 32 characters whatever it is given. Here the hash
-- is load-bearing in a way it was not there -- a collision on a NON-unique index
-- only widens a scan the caller then filters, but on a UNIQUE one it REFUSES a
-- write. What it can never do is answer WRONGLY: the lookup compares the value
-- itself, so a collision cannot merge two records, only reject the second.
--
-- AND MD5 IS BROKEN, so say what that does and does not buy an attacker rather
-- than resting on "it will never happen". Accidental collisions are out of
-- reach at 128 bits against ids that are short and few. STEERED ones are not --
-- chosen-prefix attacks on md5 are cheap -- so a provider can craft two ids for
-- one source that collide, and have the second refused. That grants it nothing
-- the allowlist has not already granted: the index is scoped to `source_id`, so
-- it can only ever block ITS OWN records, and a provider that wants its own
-- import to fail can simply serve nonsense. A hash an attacker could steer
-- across SOURCES, or one whose collision merged rather than refused, would be a
-- different decision and would need a different hash. The alternative here is
-- the 2704-byte cap on every literal statement, which migration 3 measured and
-- refused.
--
-- `deleted_at IS NULL`, AND THE TRIGGER BELOW IS WHAT MAKES THAT HOLD. Without
-- it the index breaks a correct import: `itemWithExternalId` honours the item's
-- tombstone (ADR-0075), so a re-import after the owner deletes an item writes a
-- FRESH item and a second `external_id` statement with the same (source, value)
-- -- which this index would refuse. The two halves are one decision and they
-- ship in one rung.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT MIGRATES EVERYTHING, and
-- it ABORTS rather than quarantines if it cannot. A database already holding
-- two live `external_id` statements for one (source, value) fails this rung
-- outright, because row-level quarantine is on ADR-0047's NOT BUILT list and a
-- unique index cannot be created around the rows that violate it anyway. That
-- is the right answer HERE and would not be everywhere: there is no released
-- version, so no database exists that this rung did not build, and the only
-- writer of an `external_id` statement is the importer, which cannot produce a
-- pair (see below).
--
-- HAND-WRITTEN RATHER THAN GENERATED, which is the opposite of what ADR-0047's
-- as-built section tells the next rung to do -- and the difference is that this
-- index CANNOT BE DECLARED IN THE DRIZZLE SCHEMA AT ALL. Its predicate holds a
-- uuid minted per install, and `tables.ts` is one file shared by every install.
-- ADR-0047's warning is about an index the schema DOES declare, where a
-- hand-written rung leaves the snapshot ignorant and the next `generate` emits
-- it twice. Nothing here is in the schema, so nothing can be emitted twice; the
-- note in `tables.ts` is what stops a later reader adding it there.

DO $do$
DECLARE
  external_id_property uuid;
BEGIN
  SELECT "id" INTO STRICT external_id_property FROM "properties" WHERE "name" = 'external_id';
  EXECUTE format(
    'CREATE UNIQUE INDEX "statements_one_item_per_external_id"
       ON "statements" ("source_id", md5("value_literal"))
       WHERE "property_id" = %L AND "deleted_at" IS NULL',
    external_id_property
  );
END;
$do$;
--> statement-breakpoint
-- AND THE OTHER HALF: AN ITEM THAT IS GONE MAKES NO CLAIMS.
--
-- ADR-0075 gives every table a tombstone and every read path honours it, but
-- nothing propagated one. An item the owner deleted kept its statements live,
-- which was invisible until the index above: it left a dead item holding a live
-- claim on a provider's id, so the next import of that record -- a CORRECT
-- import, writing a fresh item because `itemWithExternalId` honours the
-- tombstone -- was refused by a rule meant for a defect.
--
-- A TRIGGER RATHER THAN A RULE THE DELETE PATH REMEMBERS, and migration 1
-- already made this argument for the projection: a trigger cannot be forgotten,
-- and application-maintained is silently bypassed by anything writing directly.
-- It bites harder here, because the path that would carry the rule DOES NOT
-- EXIST YET. Nothing in the product deletes an item; ADR-0046 designs the
-- confirmation and no slice has built it. A rule written into a function nobody
-- has written is a rule nobody will read.
--
-- IT TAKES THE ITEM'S OWN `deleted_at` RATHER THAN `now()`, so the item and its
-- statements carry one timestamp -- which is what makes the delete REVERSIBLE by
-- query, in ADR-0040's shape: "the statements of item X tombstoned at X's
-- `deleted_at`" is exactly the set this trigger took, and is distinguishable
-- from claims a source withdrew on its own. `now()` would lose that, because
-- inside one transaction it is equal for reasons that mean nothing.
--
-- AFTER, NOT BEFORE, and that is a fix rather than a preference. Tombstoning a
-- title statement fires `statements_reproject_item`, which UPDATEs the very
-- `items` row being deleted; from a BEFORE trigger PostgreSQL applies the outer
-- row over that nested write, so the projection would be silently lost and a
-- deleted item would keep a title no live statement supports. AFTER lets the
-- tombstone land first and the reprojection write over it. The nested UPDATE
-- re-fires this trigger and the `WHEN` clause stops it: `deleted_at` is already
-- set, so `OLD."deleted_at" IS NULL` is false.
--
-- WHAT IT DELIBERATELY DOES NOT REACH, each named rather than left to be found:
--
-- - STATEMENTS WHERE THE ITEM IS THE VALUE, not the subject. Those are claims
--   about OTHER items, made by other sources, and a source may only withdraw
--   what it said itself -- the rule `assertClaims` already holds. A dangling
--   reference to a deleted item is ADR-0046's question, not this one.
-- - PLACEMENTS, and ADR-0046 decides that: deleting a container never deletes
--   its members.
-- - A STATEMENT'S QUALIFIERS (ADR-0067), which carry tombstones of their own and
--   keep them. A qualifier is only ever read through the statement it qualifies,
--   so one left live under a tombstoned statement is unreachable rather than
--   wrong -- and reaping it would be a second rule about what a tombstone
--   cascades to, decided here for a case nothing reads yet.
-- - UN-DELETING. Nothing restores an item, so a trigger for it would be code
--   with nothing to run against; the timestamp above is what leaves the door
--   open without building the door.
--
-- STRATEGY: IT MIGRATES EVERYTHING, trivially. It adds a function and a trigger
-- and transforms no row. It does NOT retrospectively tombstone the statements of
-- items already deleted, and there are none -- nothing in the product deletes an
-- item, which is the same fact that makes the trigger necessary.
CREATE FUNCTION "tombstone_statements_of_item"() RETURNS trigger AS $fn$
BEGIN
  UPDATE "statements"
     SET "deleted_at" = NEW."deleted_at"
   WHERE "subject_item_id" = NEW."id"
     AND "deleted_at" IS NULL;
  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "items_tombstone_statements"
AFTER UPDATE OF "deleted_at" ON "items"
FOR EACH ROW
WHEN (OLD."deleted_at" IS NULL AND NEW."deleted_at" IS NOT NULL)
EXECUTE FUNCTION tombstone_statements_of_item();
