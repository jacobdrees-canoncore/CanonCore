-- Migration 1, second rung: the closed sets, the single owner, the seeded
-- properties, and the triggers that keep the projection honest.
--
-- A HAND-WRITTEN DATA MIGRATION SHARING ONE LADDER WITH A GENERATED SCHEMA ONE
-- is the property `migrations: { prefix: "timestamp" }` buys (ADR-0047): the
-- runner cannot tell these two rungs apart, and the folder reads in the order
-- it executes.
--
-- STRATEGY (ADR-0047 asks every migration to state one): this rung MIGRATES
-- EVERYTHING. There is nothing to quarantine and nothing to freeze, because
-- there is no prior data — migration 1 runs against an empty database by
-- definition. Later rungs touching real rows must say which of migrate,
-- quarantine or freeze they use.

--> statement-breakpoint
-- ADR-0005. Seven kinds, and the list is closed: anything finer is a `category`
-- statement, which can be sourced and disputed where a kind column cannot.
INSERT INTO "item_kinds" ("kind", "label") VALUES
  ('work', 'Work'),
  ('person', 'Person'),
  ('organisation', 'Organisation'),
  ('place', 'Place'),
  ('time_span', 'Time span'),
  ('character', 'Character'),
  ('concept', 'Concept');
--> statement-breakpoint
-- ADR-0071. Four, and the owner is one of them: a first-class source, not a
-- special case sitting outside the model.
INSERT INTO "source_kinds" ("kind", "label") VALUES
  ('provider', 'Provider'),
  ('owner', 'Owner'),
  ('sidecar', 'Sidecar'),
  ('derived', 'Derived');
--> statement-breakpoint
-- ADR-0024. `preferred` is the owner's favourite AND the lock, so it sorts
-- ahead of the whole source order: re-ordering the source list re-picks the
-- catalogue but can never beat a pin.
INSERT INTO "ranks" ("rank", "label", "precedence") VALUES
  ('preferred', 'Preferred', 0),
  ('normal', 'Normal', 1),
  ('deprecated', 'Deprecated', 2);
--> statement-breakpoint
-- Only what the seeded properties below actually use. More arrive with the
-- slice that needs them, by INSERT in that slice's migration (ADR-0029).
INSERT INTO "property_datatypes" ("datatype", "label") VALUES
  ('text', 'Text'),
  ('date', 'Date'),
  ('url', 'URL'),
  ('item', 'Item reference');
--> statement-breakpoint
INSERT INTO "property_value_kinds" ("value_kind", "label") VALUES
  ('literal', 'Literal'),
  ('item', 'Item');
--> statement-breakpoint
INSERT INTO "property_cardinalities" ("cardinality", "label") VALUES
  ('single', 'Single'),
  ('multiple', 'Multiple');
--> statement-breakpoint
-- ADR-0044. THE owner row. Its id is generated per install rather than being a
-- constant in the source: nothing outside this database needs to name it, and a
-- shared constant is a value waiting to be assumed unique when it is not.
INSERT INTO "owners" ("display_name") VALUES ('Owner');
--> statement-breakpoint
-- The owner as a source, sitting FIRST in the global source order (ADR-0025).
-- Nothing the owner asserts is ever beaten by a provider before ranks are even
-- considered.
INSERT INTO "sources" ("owner_id", "kind", "identity", "label", "source_order")
SELECT "id", 'owner', 'owner', 'Owner', 0 FROM "owners";
--> statement-breakpoint
-- ADR-0015 seeds NINE properties and says the count is exact. It is eleven
-- here, and the two extra are not scope creep: ADR-0014 makes `title` and
-- `sort_name` columns that PROJECT STATEMENTS, so the statements they project
-- need properties to hang on, or migration 1 cannot satisfy its own central
-- decision. ADR-0015 is corrected to say so rather than left to be discovered.
--
-- `cardinality` is declared and NOT yet enforced. ADR-0015 keeps cardinality
-- editable for exactly this reason: start loose, tighten later, and tightening
-- marks the offenders rather than rejecting existing rows.
INSERT INTO "properties"
  ("owner_id", "name", "datatype", "value_kind", "cardinality", "reference_target")
SELECT o."id", v."name", v."datatype", v."value_kind", v."cardinality", v."reference_target"
FROM "owners" o
CROSS JOIN (VALUES
  -- ADR-0014. The projections.
  ('title',        'text', 'literal', 'multiple', NULL::text[]),
  ('sort_name',    'text', 'literal', 'multiple', NULL),
  -- ADR-0016. `category` takes an ITEM, never a literal, so categories nest,
  -- carry provenance and are matched by id. Its target is deliberately open:
  -- a category may be any kind of item.
  ('category',     'item', 'item',    'multiple', NULL),
  -- ADR-0006, ADR-0070. `portrayed_by` is what carries the person/character
  -- distinction, which is why it is on the seeded list at all.
  ('portrayed_by', 'item', 'item',    'multiple', ARRAY['person']),
  ('appears_in',   'item', 'item',    'multiple', ARRAY['work']),
  -- ADR-0067. How much of a source an adaptation covers is a QUALIFIER on this
  -- statement, never an edition-coverage figure.
  ('based_on',     'item', 'item',    'multiple', ARRAY['work']),
  -- ADR-0070. `created_by` is who actually made it; `credited_to` is the stated
  -- in-universe author. They must not share a property: in one field the real
  -- and the stated author compete on rank and "who wrote this" stops being
  -- answerable.
  ('created_by',   'item', 'item',    'multiple', ARRAY['person']),
  ('credited_to',  'item', 'item',    'multiple', ARRAY['character']),
  -- ADR-0073. EDTF, so a year-only date stays a year rather than being padded
  -- to the 1st of January, which sorts and displays wrongly forever.
  ('released',     'date', 'literal', 'multiple', NULL),
  ('part_of',      'item', 'item',    'multiple', ARRAY['work']),
  ('image',        'url',  'literal', 'multiple', NULL)
) AS v("name", "datatype", "value_kind", "cardinality", "reference_target");
--> statement-breakpoint
-- ADR-0075. `updated_at` and the change sequence advance on every change, and
-- they advance HERE rather than in whoever writes the row: a write that forgets
-- is exactly the write a reversal query needs to find.
CREATE FUNCTION "touch_row"() RETURNS trigger AS $fn$
BEGIN
  NEW."updated_at" := now();
  NEW."change_sequence" := nextval('change_sequence');
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
-- Every table that carries a change sequence, named once. A loop rather than
-- eleven copy-pasted statements, because eleven copies are eleven chances for
-- a later table to be added to ten of them.
DO $do$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'owners', 'merges', 'sources', 'items', 'properties', 'vocabulary_values',
    'placements', 'placement_sources', 'statements', 'statement_qualifiers', 'aliases'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_row()',
      target || '_touch', target
    );
  END LOOP;
END;
$do$;
--> statement-breakpoint
-- ADR-0014, ADR-0024, ADR-0025. Which statement wins a projected field.
--
-- ORDER, and every term of it is a decision:
--   1. rank precedence  - the owner's favourite is the LOCK and outranks the
--                         whole source order (ADR-0024).
--   2. source order     - one global ranking for the instance (ADR-0025); a
--                         per-group order gives one field two answers on one
--                         page reached by one URL.
--   3. the statement id - an arbitrary but STABLE tiebreak.
--
-- NEVER BY RECENCY, which is the term deliberately absent. Importing a
-- remaster would otherwise silently flip every default, and a display that
-- changes after a refresh nobody asked for is a complaint Plex has carried for
-- over a decade.
--
-- Language is NOT a term either. Picking by language needs a display-language
-- preference, and there is no such setting yet; when there is, it belongs
-- between rank and source order and this comment is the place that says so.
CREATE FUNCTION "winning_literal"("subject" uuid, "property_name" text)
RETURNS text AS $fn$
  SELECT s."value_literal"
  FROM "statements" s
  JOIN "properties" p ON p."id" = s."property_id"
  JOIN "ranks" r ON r."rank" = s."rank"
  JOIN "sources" src ON src."id" = s."source_id"
  WHERE s."subject_item_id" = "subject"
    AND p."name" = "property_name"
    AND s."deleted_at" IS NULL
    AND (s."valid_until" IS NULL OR s."valid_until" > now())
  ORDER BY r."precedence", src."source_order", s."id"
  LIMIT 1;
$fn$ LANGUAGE sql STABLE;
--> statement-breakpoint
-- `release_date` is NOT projected here, and its absence is deliberate.
-- ADR-0081 defines it as the earliest known release of any EDITION, and
-- `editions` arrives with its own slice. Projecting it from item statements now
-- would fill the column with the wrong definition of the value, which is worse
-- than leaving it empty.
CREATE FUNCTION "project_item"("subject" uuid) RETURNS void AS $fn$
  UPDATE "items" SET
    "title" = winning_literal("subject", 'title'),
    "sort_name" = winning_literal("subject", 'sort_name')
  WHERE "id" = "subject";
$fn$ LANGUAGE sql;
--> statement-breakpoint
-- ADR-0076. The wholesale rebuild. Never incremental: a partial pass leaves the
-- projection in a state no single revision describes. Affordable because the
-- projection is derived by definition.
--
-- WHAT IS NOT BUILT: the revision-id versioning ADR-0076 also asks for, which
-- stops a slow rebuild finishing last and overwriting a newer one. Nothing runs
-- this concurrently yet — there is no background rebuild job — so there is no
-- race to lose. It belongs with the first thing that schedules one.
CREATE FUNCTION "project_all_items"() RETURNS void AS $fn$
  UPDATE "items" SET
    "title" = winning_literal("id", 'title'),
    "sort_name" = winning_literal("id", 'sort_name');
$fn$ LANGUAGE sql;
--> statement-breakpoint
-- TRIGGER-MAINTAINED, chosen over application-maintained deliberately, which is
-- what ADR-0014 and ADR-0076 both leave to this slice.
--
-- ITS FAILURE MODE, stated because the other option's is different: the
-- projection logic lives in PL/pgSQL rather than in the TypeScript codebase,
-- and it runs inside every statement write, serialising concurrent writes that
-- touch one item's title.
--
-- WHY THAT ONE: a trigger cannot be forgotten. Application-maintained is
-- silently bypassed by anything writing directly, and this ticket seeds an item
-- BY HAND, which is exactly such a path — as are the importer, the scanner and
-- a merge, none of which exist yet to be taught the rule.
CREATE FUNCTION "reproject_item_from_statement"() RETURNS trigger AS $fn$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW."subject_item_id" IS NOT NULL THEN
    PERFORM project_item(NEW."subject_item_id");
  END IF;
  -- A statement moved from one item to another leaves the OLD item stale
  -- unless it is reprojected too.
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD."subject_item_id" IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD."subject_item_id" IS DISTINCT FROM NEW."subject_item_id") THEN
    PERFORM project_item(OLD."subject_item_id");
  END IF;
  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "statements_reproject_item"
AFTER INSERT OR UPDATE OR DELETE ON "statements"
FOR EACH ROW EXECUTE FUNCTION reproject_item_from_statement();
--> statement-breakpoint
-- ADR-0024: re-ordering the source list re-picks the whole catalogue. It cannot
-- disturb a pin, because rank sorts ahead of source order in `winning_literal`.
CREATE FUNCTION "reproject_all_items_on_source_order"() RETURNS trigger AS $fn$
BEGIN
  PERFORM project_all_items();
  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "sources_reproject_all_items"
AFTER UPDATE OF "source_order" ON "sources"
FOR EACH STATEMENT EXECUTE FUNCTION reproject_all_items_on_source_order();
--> statement-breakpoint
-- ADR-0074. A cycle is refused WHERE IT IS WRITTEN rather than tolerated and
-- worked around at every read.
--
-- The walk uses UNION rather than UNION ALL, and that is the visited set
-- ADR-0074's second rule demands, not a stylistic choice: UNION deduplicates
-- against what the recursion has already produced, so the walk TERMINATES even
-- against data that already holds a cycle. UNION ALL would not return at all.
-- The measured archive is a cyclic DAG 22 levels deep with 28 categories on a
-- cycle, and one cycle hangs a walk as surely as seven thousand would.
CREATE FUNCTION "refuse_category_cycle"() RETURNS trigger AS $fn$
DECLARE
  property_name text;
BEGIN
  SELECT p."name" INTO property_name FROM "properties" p WHERE p."id" = NEW."property_id";
  IF property_name IS DISTINCT FROM 'category' THEN
    RETURN NEW;
  END IF;
  IF NEW."value_item_id" IS NULL OR NEW."subject_item_id" IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW."value_item_id" = NEW."subject_item_id" THEN
    RAISE EXCEPTION 'category cycle: item % cannot be its own category', NEW."subject_item_id"
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    WITH RECURSIVE "ancestors"("id") AS (
      SELECT NEW."value_item_id"
      UNION
      SELECT s."value_item_id"
      FROM "statements" s
      JOIN "properties" p ON p."id" = s."property_id" AND p."name" = 'category'
      JOIN "ancestors" a ON s."subject_item_id" = a."id"
      WHERE s."deleted_at" IS NULL AND s."value_item_id" IS NOT NULL
    )
    SELECT 1 FROM "ancestors" WHERE "id" = NEW."subject_item_id"
  ) THEN
    RAISE EXCEPTION 'category cycle: % already reaches % through categories',
      NEW."value_item_id", NEW."subject_item_id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "statements_refuse_category_cycle"
BEFORE INSERT OR UPDATE ON "statements"
FOR EACH ROW EXECUTE FUNCTION refuse_category_cycle();
--> statement-breakpoint
-- ADR-0015. Datatype, value-kind and reference target FREEZE at creation;
-- required, cardinality, range and options stay editable.
--
-- Enforced rather than intended, because the one system studied that did not
-- enforce it — Magento — silently DELETES every scoped value when an
-- attribute's scope narrows, with no confirmation and no reverse.
CREATE FUNCTION "freeze_property_definition"() RETURNS trigger AS $fn$
BEGIN
  IF NEW."datatype" IS DISTINCT FROM OLD."datatype" THEN
    RAISE EXCEPTION 'property %: datatype freezes at creation (% to %)',
      OLD."name", OLD."datatype", NEW."datatype" USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."value_kind" IS DISTINCT FROM OLD."value_kind" THEN
    RAISE EXCEPTION 'property %: value kind freezes at creation (% to %)',
      OLD."name", OLD."value_kind", NEW."value_kind" USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."reference_target" IS DISTINCT FROM OLD."reference_target" THEN
    RAISE EXCEPTION 'property %: reference target freezes at creation',
      OLD."name" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "properties_freeze_definition"
BEFORE UPDATE ON "properties"
FOR EACH ROW EXECUTE FUNCTION freeze_property_definition();
--> statement-breakpoint
-- ADR-0077. Work-browsing is `kind = 'work' AND (NOT is_container OR
-- holds_work)`, and a kind filter alone is not enough: containers fold into
-- `work` (ADR-0004), so "the Doctors, in order" is itself an item of kind
-- `work` and a kind filter cannot exclude it.
--
-- Stored and maintained on placement write rather than walked at read time,
-- because a read-time walk makes an empty container watchable and then hides it
-- the moment its first member arrives.
--
-- ON PLACEMENT WRITE, AND ONLY THAT. A member whose `kind` changes after it is
-- placed leaves every container holding it stale. Nothing can change an item's
-- kind yet -- there is no edit path -- so this is a gap named rather than a bug
-- shipped, and it belongs to whatever first lets a kind be edited. The fix is a
-- trigger on `items.kind` reprojecting that item's containers; it is not
-- written now because it would be untestable code guarding an impossible event.
CREATE FUNCTION "maintain_holds_work"() RETURNS trigger AS $fn$
DECLARE
  affected uuid[];
  container uuid;
BEGIN
  affected := ARRAY[]::uuid[];
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    affected := affected || NEW."container_id";
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    affected := affected || OLD."container_id";
  END IF;
  FOREACH container IN ARRAY affected LOOP
    UPDATE "items" SET "holds_work" = EXISTS (
      SELECT 1
      FROM "placements" pl
      JOIN "items" member ON member."id" = pl."item_id"
      WHERE pl."container_id" = container
        AND pl."deleted_at" IS NULL
        AND member."deleted_at" IS NULL
        AND member."kind" = 'work'
    )
    WHERE "id" = container;
  END LOOP;
  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "placements_maintain_holds_work"
AFTER INSERT OR UPDATE OR DELETE ON "placements"
FOR EACH ROW EXECUTE FUNCTION maintain_holds_work();
