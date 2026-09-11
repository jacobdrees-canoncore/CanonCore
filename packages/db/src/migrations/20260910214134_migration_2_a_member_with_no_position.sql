-- Migration 2, under CNCORE-7. A MEMBER WITH NO POSITION.
--
-- `browse` hands back members a container's ordering cannot place. The wiki's
-- ordering is release order, because the archive holds no sequence of its own
-- for a category, so a story the archive has no release date for cannot go in
-- it -- and 2,199 of the archive's 12,791 stories are like that, a sixth of
-- them. It is the ordinary case rather than an edge one.
--
-- Both other answers assert something the source never said. Dropping the
-- member shrinks the container silently, and a reader cannot tell a small
-- container from a badly dated one. Positioning it last says it came out after
-- everything else. So the absence is RECORDED: a placement, with no position.
--
-- ADR-0009 and ADR-0018 put ordering on the placement, and this is the same
-- decision carried one step further -- "in this container, position unknown" is
-- a fact about a placement, and there is nowhere else in the model for it.
--
-- NULLS NOT DISTINCT on the unique constraint, which is the half that is easy
-- to miss. Under PostgreSQL's default NULL is distinct from NULL, so two
-- sources both saying "a member, position unknown" would be two rows -- and
-- ADR-0017's rule is that sources AGREEING are recorded against one row. The
-- least certain fact in the table would have been the one kind of agreement the
-- constraint failed to record.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT MIGRATES EVERYTHING, and
-- it can say so briefly because it WIDENS. Every row migration 1 wrote has a
-- position and keeps it, so no row can fail to transform and there is nothing
-- to quarantine. A rung that narrowed would owe a real answer here.

ALTER TABLE "placements" DROP CONSTRAINT "placements_container_item_position";--> statement-breakpoint
ALTER TABLE "placements" ALTER COLUMN "position" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_container_item_position" UNIQUE NULLS NOT DISTINCT("owner_id","container_id","item_id","position");