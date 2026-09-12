-- ADR-0077, CNCORE-71. An item's KIND freezes at creation.
--
-- WHY THIS IS A REFUSAL RATHER THAN A REPROJECTION. `items.holds_work` is
-- maintained by `maintain_holds_work` on PLACEMENTS, never on `items` --
-- migration 1 says so in its own comment and names the consequence: "a member
-- whose kind changes after it is placed leaves every container holding it
-- stale", and work-browsing READS that flag to decide what an owner is shown
-- (`kind = 'work' AND (NOT is_container OR holds_work)`). Migration 1 left the
-- gap open because nothing could change a kind and the guard would have been
-- "untestable code guarding an impossible event". CNCORE-71 is the edit path it
-- was waiting for, and that ticket names two ways to close it: maintain
-- `holds_work` when the kind changes, or refuse the change.
--
-- THE REFUSAL IS TAKEN, because this slice's acceptance criteria are creating
-- an item and editing its TITLE. Building the reprojection now would be writing
-- the guard for a feature nothing in this slice adds, and it would be the same
-- untestable code migration 1 declined to write -- the event would still be
-- impossible.
--
-- A TRIGGER RATHER THAN AN ABSENT FORM FIELD, and that is the half worth paying
-- for. An absent field bounds ONE door; this bounds the table, so `/api/rpc`, a
-- later surface, an import and a psql session are all refused alike. It also
-- makes the gap unmissable rather than merely unreached: whatever first wants a
-- kind to be editable must DROP this trigger, and the drop is where the
-- `holds_work` reprojection gets written.
--
-- MODELLED ON `freeze_property_definition` (migration 1, ADR-0015), which
-- freezes three columns of a property row and leaves the rest editable. This is
-- the same shape for the same reason.
--
-- IT FREEZES ONE COLUMN AND NOTHING ELSE. `is_container` is turned on by a real
-- write path already -- `writeProvidedItem` sets it when a `browse` finds that
-- a record has members (CNCORE-28) -- so a trigger refusing every update would
-- break the import that exists today.
CREATE FUNCTION "freeze_item_kind"() RETURNS trigger AS $fn$
BEGIN
  IF NEW."kind" IS DISTINCT FROM OLD."kind" THEN
    RAISE EXCEPTION 'item %: kind freezes at creation (% to %)',
      OLD."id", OLD."kind", NEW."kind" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "items_freeze_kind"
BEFORE UPDATE ON "items"
FOR EACH ROW EXECUTE FUNCTION freeze_item_kind();
