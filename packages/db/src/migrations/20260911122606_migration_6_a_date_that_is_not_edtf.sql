-- Migration 6, under CNCORE-29. A VALUE THAT ARRIVED BROKEN FROM AN IMPORT,
-- HELD APART FROM THE LIVE SET.
--
-- ADR-0073 says a date is an EDTF string and nothing else. Nothing checked it:
-- the wire schema is `z.array(z.string())`, so a provider sending `soon` or
-- `12/03/66` had it written as a `released` statement and rendered on the item
-- page verbatim. That made the record describe what the catalogue WRITES rather
-- than what it ACCEPTS.
--
-- THE POSTURE IS ADR-0030'S, which already answers this for a vocabulary value:
-- take it, mark it, do not silently treat it as good. A date is not a
-- vocabulary value, so the mechanism is not literally that one -- but refusing
-- the whole import over one bad date is the wrong trade, and so is accepting it
-- silently. `browse` is why: one call writes a container's worth of dates at
-- once, so a bad source fills the catalogue rather than a row of it.
--
-- IT IS NOT A SECOND TOMBSTONE. `deleted_at` says a source WITHDREW a claim;
-- this says the claim still stands and the catalogue cannot read it. Two
-- booleans rather than one state column, for the reason `vocabulary_values`
-- gives: they are orthogonal, and a row may carry both.
ALTER TABLE "statements" ADD COLUMN "quarantined" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- AND THE PROJECTION HONOURS IT, not only the read path.
--
-- A MARK NOTHING READS IS HALF A MECHANISM: it looks like a check and behaves
-- like nothing, which is worse than no check, because from outside the door
-- reads as guarded. `findStatementsOfItem` is one of the two readers ADR-0075
-- names for the tombstone; this is the other, and both gain the same clause for
-- the same reason.
--
-- NOTHING PROJECTS A DATE TODAY -- `project_item` writes `title` and
-- `sort_name`, and ADR-0073's own note says no sort key is derived yet. So this
-- clause changes no result now, and it is here rather than in the slice that
-- first sorts on a date because that slice would inherit a function that
-- quietly lets a quarantined value WIN. The rule belongs with the column.
CREATE OR REPLACE FUNCTION "winning_literal"("subject" uuid, "property_name" text)
RETURNS text AS $fn$
  SELECT s."value_literal"
  FROM "statements" s
  JOIN "properties" p ON p."id" = s."property_id"
  JOIN "ranks" r ON r."rank" = s."rank"
  JOIN "sources" src ON src."id" = s."source_id"
  WHERE s."subject_item_id" = "subject"
    AND p."name" = "property_name"
    AND s."deleted_at" IS NULL
    AND s."quarantined" = false
    AND (s."valid_until" IS NULL OR s."valid_until" > now())
  ORDER BY r."precedence", src."source_order", s."id"
  LIMIT 1;
$fn$ LANGUAGE sql STABLE;
