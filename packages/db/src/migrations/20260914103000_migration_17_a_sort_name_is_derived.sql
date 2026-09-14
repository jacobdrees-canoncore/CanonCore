-- Migration 17, under CNCORE-173. A SORT NAME IS DERIVED, AND THE COMPUTATION
-- IS A SOURCE.
--
-- The column has existed since migration 1 and the projection has always read
-- it. NOTHING EVER WROTE A `sort_name` STATEMENT, so every Listing fell through
-- to `coalesce(sort_name, title)`'s second arm and `The Daleks' Master Plan`
-- filed under T. At corpus size that is not a nicety: it is the list being in
-- the wrong order.
--
-- ADR-0071 IS WHAT THIS RUNG MAKES REAL. Migration 1 seeded `derived` into
-- `source_kinds` and nothing has ever taken a row of that kind, so the record's
-- load-bearing half -- "`derived` names the computation AND ITS VERSION --
-- `derived:palette-v2`, never a bare `derived`" -- has never been exercised.
-- This is the first derived source in the product, and the version is in three
-- places on purpose: the source's identity, the function's name, and this rung.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT MIGRATES EVERYTHING.
-- Every live item is backfilled at the bottom of this file, because an item
-- that kept no sort name would be one the alphabet cannot reach -- the defect
-- this rung exists to fix, left standing on exactly the rows that already
-- existed. Nothing is quarantined: the computation is total over text, and a
-- title it cannot improve comes back unchanged rather than empty.

--> statement-breakpoint
-- THE COMPUTATION, AND ITS NAME CARRIES ITS VERSION.
--
-- A leading article files under the word after it, which is `CONTEXT.md`'s
-- reader in the ticket's words: `The Daleks' Master Plan` under D, `An
-- Unearthly Child` under U. STRIPPED RATHER THAN MOVED TO THE END -- `Daleks'
-- Master Plan` rather than `Daleks' Master Plan, The` -- because the sort name
-- is also what a jump-to-a-letter surface reads (CNCORE-174), and a trailing
-- `, The` is a suffix on every second row that no reader asked to see.
--
-- `\s+` AFTER THE ARTICLE IS THE WHOLE GUARD, and it is why no word list of
-- exceptions is needed. `Theatre of War`, `Andromeda` and `Aliens of London`
-- all begin with an article's letters and none is followed by a space, so none
-- is touched -- verified against this engine rather than reasoned about.
--
-- `btrim` FIRST IS WHY AN ARTICLE-ONLY TITLE SURVIVES. `The`, or `The ` from a
-- sloppy import, has no whitespace left after the trim for `\s+` to match, so it
-- comes back whole instead of becoming the empty string.
--
-- AND `nullif` IS WHAT CATCHES THE CASE THAT ARGUMENT DOES NOT REACH: a title
-- that is nothing but SPACE. It trims to `''` and stays `''`, and an EMPTY sort
-- name is the one value worse than none -- it sorts ahead of the entire
-- catalogue, so one malformed record would take the top of every Listing. It is
-- reachable from outside rather than hypothetical: `cmppRecord` declares a
-- provider's title `z.string().min(1)` with no trim, so `"   "` is a title this
-- catalogue accepts over the wire.
--
-- NULL RATHER THAN THE RAW TITLE, because there is no word to file such an item
-- under and inventing one would be worse than admitting it. The item then reads
-- as one with no sort name at all, which `coalesce(sort_name, title)` and
-- `derive_sort_name` below both already know how to handle -- the same path an
-- item nobody has titled takes.
--
-- ENGLISH ONLY, AND NOT CONFIGURABLE. ADR-0091 puts a statement's language on
-- the statement; nothing declares an instance's own language yet, and an option
-- nothing reads is the thing `CLAUDE.md` refuses. A second computation for a
-- second language is a `sort-name-v2` beside this one, which is exactly the
-- shape ADR-0071's versioning is for.
--
-- IMMUTABLE because it is a pure function of its argument, which is what lets
-- the backfill below run it over every row in one statement.
CREATE FUNCTION "sort_name_v1"("title" text) RETURNS text AS $fn$
  SELECT nullif(regexp_replace(btrim("title"), '^(the|a|an)\s+', '', 'i'), '');
$fn$ LANGUAGE sql IMMUTABLE;
--> statement-breakpoint
-- THE COMPUTATION AS A SOURCE, at the next place in the one global order
-- (ADR-0025).
--
-- `max + 1` RATHER THAN A CHOSEN NUMBER, which is the rule this product already
-- has for where a new source goes: `writeProviderSource` allocates the same way,
-- because `sources_order` is unique per owner and two allocators competing over
-- one unique column is a collision waiting for enough sources to meet. So this
-- is not a new rule, it is the existing one applied to the first source that is
-- not a provider.
--
-- SO THE OWNER OUTRANKS IT AND THAT IS THE POINT. The owner sits at 0
-- (migration 1) and nothing can be allocated below them, so an owner correcting
-- a sort name beats the computation before ranks are even considered -- and the
-- computed claim STILL STANDS beside theirs, because a source may only withdraw
-- what it said itself (ADR-0075). That pair is what a reader sees on the item
-- page.
--
-- WHAT THIS DOES NOT DECIDE: whether a PROVIDER's sort name should beat the
-- computed one. No provider asserts `sort_name` today -- `importProvidedRecord`
-- claims `external_id`, `title` and `released`, and nothing else -- so the
-- question has no case to answer, and pinning this source permanently last
-- would be a second ordering rule written for a shape that does not exist. A
-- provider registered after this rung takes the place behind it, which is what
-- appending means; an owner who disagrees re-orders the sources and the trigger
-- below re-picks the whole catalogue.
INSERT INTO "sources" ("owner_id", "kind", "identity", "label", "source_order")
SELECT o."id", 'derived', 'derived:sort-name-v1', 'CanonCore (sort name v1)',
       (SELECT coalesce(max("source_order"), 0) + 1 FROM "sources" WHERE "owner_id" = o."id")
FROM "owners" o;
--> statement-breakpoint
-- ONE ITEM'S DERIVED SORT NAME, MADE EQUAL TO WHAT THE COMPUTATION NOW SAYS.
--
-- IT IS `assertClaims` IN SQL, and deliberately the same three rules: one row
-- per value, a value no longer claimed TOMBSTONED rather than deleted
-- (ADR-0075), and a value already held left alone rather than rewritten. A
-- second answer to "what does asserting a value mean" is what this avoids;
-- `claims.ts` carries the argument and this is the one writer that cannot reach
-- it, because it runs inside a trigger.
--
-- IT READS THE *WINNING* TITLE rather than the statement that just changed. The
-- sort name has to file the item under what a reader actually sees, and what a
-- reader sees is `winning_literal`'s answer -- so an owner retitling an imported
-- item moves its place in the alphabet, and the provider's losing title does
-- not.
--
-- NO TITLE MEANS NO SORT NAME, AND THE WITHDRAWAL IS THE HALF THAT MATTERS. An
-- item whose last title statement is withdrawn keeps its heading's honest
-- "Untitled item" (ADR-0003), and a derived sort name left standing over a
-- title that is gone would file it under a word nothing on the page says.
CREATE FUNCTION "derive_sort_name"("subject" uuid) RETURNS void AS $fn$
DECLARE
  the_owner uuid;
  the_source uuid;
  the_property uuid;
  computed text;
BEGIN
  SELECT "owner_id" INTO the_owner FROM "items" WHERE "id" = "subject";
  IF the_owner IS NULL THEN
    RETURN;
  END IF;

  SELECT "id" INTO the_source FROM "sources"
   WHERE "owner_id" = the_owner AND "kind" = 'derived' AND "identity" = 'derived:sort-name-v1';
  SELECT "id" INTO the_property FROM "properties"
   WHERE "owner_id" = the_owner AND "name" = 'sort_name';

  computed := sort_name_v1(winning_literal("subject", 'title'));

  -- What this source said and no longer says. `IS DISTINCT FROM` rather than
  -- `<>` because `computed` is NULL for an item with no title, and that case is
  -- exactly the withdrawal above.
  UPDATE "statements" SET "deleted_at" = now()
   WHERE "subject_item_id" = "subject"
     AND "property_id" = the_property
     AND "source_id" = the_source
     AND "deleted_at" IS NULL
     AND "value_literal" IS DISTINCT FROM computed;

  -- And what it now says, written only if it is not already held. Re-asserting
  -- a value as a second row would make one source corroborate itself, which is
  -- the shape ADR-0017 settles for placements and `assertClaims` for values.
  IF computed IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "statements"
     WHERE "subject_item_id" = "subject"
       AND "property_id" = the_property
       AND "source_id" = the_source
       AND "deleted_at" IS NULL
       AND "value_literal" = computed
  ) THEN
    INSERT INTO "statements"
      ("owner_id", "subject_item_id", "property_id", "value_literal", "source_id")
    VALUES (the_owner, "subject", the_property, computed, the_source);
  END IF;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
-- THE WHOLESALE PASS, beside `project_all_items` and for its reason (ADR-0076):
-- never incremental, because a partial pass leaves the catalogue in a state no
-- single revision describes, and affordable because the value is derived by
-- definition.
CREATE FUNCTION "derive_all_sort_names"() RETURNS void AS $fn$
  SELECT derive_sort_name("id") FROM "items" WHERE "deleted_at" IS NULL;
$fn$ LANGUAGE sql;
--> statement-breakpoint
-- TRIGGER-MAINTAINED, WHICH IS ADR-0014'S ARGUMENT REACHING THE SECOND COLUMN.
--
-- That record chose a trigger over application-maintained for the projection
-- because "a trigger cannot be forgotten by a writer that never heard of it",
-- and named the writers that would forget: the hand seed, the importer, the
-- scanner and a merge. Every one of them writes a TITLE, so every one of them
-- has to leave a sort name behind -- and `pnpm db:seed` is that argument run as
-- a check here exactly as it was there: it writes a title through raw SQL,
-- touches nothing else, and the item files under the right letter anyway.
--
-- ITS FAILURE MODE, stated because the other option's is different: the
-- computation lives in PL/pgSQL rather than in TypeScript, and a new version of
-- it is a MIGRATION rather than a deploy. That is the cost, and it is also the
-- mechanism ADR-0071 asks for -- a `sort-name-v2` is a new function, a new
-- source and a rung that invalidates v1's rows, which is the operation that
-- record says is the only one ever performed on a derived claim.
--
-- ONLY A `title` STATEMENT DERIVES, and that is the recursion guard as well as
-- the rule. The insert above is a `sort_name` statement, so it re-enters this
-- function once, matches nothing, and stops.
CREATE OR REPLACE FUNCTION "reproject_item_from_statement"() RETURNS trigger AS $fn$
DECLARE
  property_name text;
BEGIN
  SELECT p."name" INTO property_name FROM "properties" p
   WHERE p."id" = COALESCE(NEW."property_id", OLD."property_id");

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW."subject_item_id" IS NOT NULL THEN
    IF property_name = 'title' THEN
      PERFORM derive_sort_name(NEW."subject_item_id");
    END IF;
    PERFORM project_item(NEW."subject_item_id");
  END IF;
  -- A statement moved from one item to another leaves the OLD item stale
  -- unless it is reprojected too.
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD."subject_item_id" IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD."subject_item_id" IS DISTINCT FROM NEW."subject_item_id") THEN
    IF property_name = 'title' THEN
      PERFORM derive_sort_name(OLD."subject_item_id");
    END IF;
    PERFORM project_item(OLD."subject_item_id");
  END IF;
  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
-- RE-ORDERING THE SOURCES RE-DERIVES BEFORE IT RE-PROJECTS, and the order of
-- those two calls is the whole of this change.
--
-- Moving a provider ahead of another changes which TITLE wins, and the sort name
-- is computed from the winning title -- so a pass that only re-projected would
-- leave every derived sort name computed from a title that no longer shows. The
-- catalogue would then be alphabetised by a claim the page does not make.
CREATE OR REPLACE FUNCTION "reproject_all_items_on_source_order"() RETURNS trigger AS $fn$
BEGIN
  PERFORM derive_all_sort_names();
  PERFORM project_all_items();
  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
-- EXISTING ITEMS GAIN ONE RATHER THAN BEING LEFT BEHIND, which is this rung's
-- own acceptance criterion and the reason its strategy is "migrate everything".
--
-- The insert inside `derive_sort_name` fires the trigger above, so the column is
-- filled as a consequence of the statement rather than by a second write here --
-- which is the property ADR-0014 wanted and the one thing that would fail
-- loudly if the projection were ever wired up wrong.
SELECT derive_all_sort_names();
