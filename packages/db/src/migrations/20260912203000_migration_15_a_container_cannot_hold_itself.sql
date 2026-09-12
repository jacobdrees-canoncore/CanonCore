-- Migration 15, under CNCORE-73. A CONTAINER CANNOT HOLD ITSELF, AND THE
-- DATABASE IS WHAT SAYS SO.
--
-- ADR-0074 refuses a cycle WHERE IT IS WRITTEN rather than tolerating one and
-- working around it at every read, and it names TWO GRAPHS: the CATEGORY graph,
-- whose trigger migration 1 carries, and the CONTAINER graph, which that record
-- left unforbidden and assigned to "the slice that first lets an owner reparent
-- a Container". `movePlacementByHand` is that slice: it takes a destination
-- container, so a placement cycle became writable the moment it existed.
--
-- IT IS THE CATEGORY TRIGGER PORTED, NOT A DESIGN. ADR-0074 says so in those
-- words -- "this record's category trigger applied to `placements` instead of
-- `statements`, with UNION doing the same job as the visited set" -- and the
-- walk below is migration 1's with two names changed.
--
-- UNION RATHER THAN UNION ALL, AND THAT IS THE VISITED SET (ADR-0074's second
-- rule), not a stylistic choice. UNION deduplicates against what the recursion
-- has already produced, so the walk TERMINATES against data that already holds
-- a cycle. UNION ALL would not return at all, and one cycle hangs a walk as
-- surely as the archive's twenty-eight would.
--
-- IT WALKS UP, FROM THE CONTAINER. Adding "container C holds item I" closes a
-- cycle exactly when C is already inside I, so the cheap question is whether I
-- is among C's holders. Walking DOWN from I would enumerate everything I
-- contains -- a season's whole membership on every placement -- to answer the
-- same question. Up is the containers only, and `placements_item` (migration 1)
-- is the index the recursive term joins on.
--
-- THE CLIENT GUARD IS NOT THE CHECK. The reference implementation removes a
-- node's descendants from the drop targets for the duration of a drag, so the
-- gesture cannot express a cycle. That is correct interaction design and
-- worthless as an invariant: a crafted call to the mutation still writes one.
-- Stated plainly because the alternative is worse than doing nothing -- a UI
-- guard with no server check reads as an enforced rule to everyone except the
-- person who bypasses it.
--
-- MULTI-PLACEMENT IS NOT A CYCLE, and the walk must not confuse them. One
-- season in both a release order and a story order is a diamond: two holders,
-- no path back. The refusal is reachability, never fan-in.
--
-- TWO TRIGGERS, BECAUSE A REORDER WRITES ROWS THAT CHANGE NO EDGE. A drag
-- writes the moved placement and every sibling whose position shifted
-- (ADR-0116), and a sibling's `position` is not an edge -- so the UPDATE
-- trigger fires only when an endpoint moves or a tombstone is cleared. Sixty
-- episodes reordered is one walk rather than sixty. An INSERT has no OLD to
-- compare against and needs no condition.
--
-- A TOMBSTONED PLACEMENT HOLDS NOTHING, so the walk follows live rows only and
-- the function returns early for a row being removed. That is the same posture
-- the category trigger takes towards a withdrawn statement.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT ADDS A RULE THAT EXISTING
-- DATA MAY BREAK, and it does not repair anything. The trigger is BEFORE INSERT
-- OR UPDATE, so it judges writes from here on and never reads the rows already
-- stored -- an instance that somehow holds a placement cycle today keeps it, and
-- every walk in this repository carries a visited set anyway, which is
-- ADR-0074's whole point about the two rules not being alternatives. Nothing in
-- CanonCore has ever written one: until this rung the only writers were
-- `assertPlacement` and `placeItemByHand`, and no surface offered a container as
-- a member of its own descendant.

CREATE FUNCTION "refuse_placement_cycle"() RETURNS trigger AS $fn$
BEGIN
  IF NEW."deleted_at" IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW."item_id" = NEW."container_id" THEN
    RAISE EXCEPTION 'placement cycle: container % cannot hold itself', NEW."container_id"
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    WITH RECURSIVE "holders"("id") AS (
      SELECT NEW."container_id"
      UNION
      SELECT p."container_id"
      FROM "placements" p
      JOIN "holders" h ON p."item_id" = h."id"
      WHERE p."deleted_at" IS NULL
    )
    SELECT 1 FROM "holders" WHERE "id" = NEW."item_id"
  ) THEN
    RAISE EXCEPTION 'placement cycle: % already holds % through placements',
      NEW."item_id", NEW."container_id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "placements_refuse_cycle_on_insert"
BEFORE INSERT ON "placements"
FOR EACH ROW EXECUTE FUNCTION refuse_placement_cycle();--> statement-breakpoint
CREATE TRIGGER "placements_refuse_cycle_on_update"
BEFORE UPDATE ON "placements"
FOR EACH ROW
WHEN (
  OLD."container_id" IS DISTINCT FROM NEW."container_id"
  OR OLD."item_id" IS DISTINCT FROM NEW."item_id"
  OR (OLD."deleted_at" IS NOT NULL AND NEW."deleted_at" IS NULL)
)
EXECUTE FUNCTION refuse_placement_cycle();
