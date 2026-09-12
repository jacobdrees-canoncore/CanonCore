-- Migration 12, under CNCORE-74. THE OWNER NOTE, AS A PROPERTY AND NOT A TABLE.
--
-- ADR-0096 decides a note is a Statement carrying a `note` property, so it gets
-- rank, language and provenance for free from ADR-0012 rather than needing a
-- table of its own with three of those columns copied onto it. That record also
-- says "never provider-assertable becomes a PROPERTY DECLARATION rather than a
-- code path", and the statements below are those words as mechanism: the
-- declaration, and the rule that reads it.
--
-- GENERATED, THEN HAND-WRITTEN INTO (ADR-0047). The constraint is a plain CHECK
-- on a table this repo's `schema/tables.ts` declares, so it is DECLARED there
-- and `drizzle-kit generate` emitted the `ALTER` below -- which is what keeps
-- the schema and the head snapshot agreeing. Review caught this rung
-- hand-writing the constraint with `tables.ts` untouched: nothing broke today,
-- because `generate` diffs the schema against the snapshot and neither held it,
-- but the first person to add the check beside its sibling would have had
-- `generate` emit it a second time. The data statement and the trigger are
-- hand-written after it, which is the half `generate` cannot produce.
--
-- IT WAS GENERATED AS `20260912174318` AND RENAMED. Drizzle stamps a rung from
-- the real clock, and migration 11 was hand-stamped two hours ahead of it -- so
-- as generated this rung sat BELOW its predecessor, which Drizzle applies by
-- high-water mark and would silently SKIP on an existing database while a fresh
-- one applied it. The file, the journal `tag` and the snapshot were all renamed
-- to the head, which is ADR-0047's own instruction, and `db:check-ladder` is
-- what says it worked.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT MIGRATES EVERYTHING, and
-- there is nothing to transform. The constraint is vacuously true of all
-- thirteen rows already here -- `capabilities` has defaulted to `{}` since
-- migration 1 and nothing has ever written it -- and the property it then seeds
-- is the first row to declare anything. No row can fail, so nothing is
-- quarantined and nothing is frozen.

ALTER TABLE "properties" ADD CONSTRAINT "properties_capabilities_are_an_object" CHECK (jsonb_typeof("properties"."capabilities") = 'object' and coalesce(jsonb_typeof("properties"."capabilities" -> 'assertableBy') = 'array' and jsonb_array_length("properties"."capabilities" -> 'assertableBy') > 0, "properties"."capabilities" -> 'assertableBy' is null) and coalesce(jsonb_typeof("properties"."capabilities" -> 'public') = 'boolean', "properties"."capabilities" -> 'public' is null));

--> statement-breakpoint
-- THE THIRTEENTH PROPERTY, and the first to declare a capability.
--
-- ADR-0015 says the seeded list is short on purpose -- "a speculative property
-- is a freeze event with nothing behind it" -- and adds that anything else
-- "enters when a screen or an import actually needs it". This is that: the
-- surface CNCORE-74 builds has nowhere to write without it.
--
-- `single`, WHERE THE OTHER TWELVE ARE `multiple`. A note is the owner's own
-- free text about an item and there is one of them: editing one REPLACES what
-- they last wrote, which is what `assertClaims` does with a one-value set.
-- Cardinality is declared and not yet enforced (migration 1), so this is the
-- catalogue saying what the surface means rather than a rule biting.
--
-- `assertableBy` IS A POSITIVE LIST rather than a `providerAssertable: false`
-- boolean, which is ADR-0012's own instruction: "prefer a capabilities object
-- over booleans on a property definition, so new capabilities land without
-- changing the definition's shape". A boolean per source kind is four booleans
-- the day a sidecar needs excluding from something; a list of admitted kinds
-- answers all four at once and is what the rule below reads.
--
-- IT NAMES THE OWNER RATHER THAN EXCLUDING THE PROVIDER. ADR-0045 keeps notes
-- out of the public payload and `CONTEXT.md` says a note is the owner's
-- "alone: nothing else can assert one" -- which is a sentence about who MAY,
-- and a sidecar or a derived computation are as excluded as a provider is.
--
-- AND `public: false` IS THE OTHER HALF OF THAT SENTENCE, which ADR-0045 wrote
-- before there was a note to apply it to: the public read path "carries no
-- internal ids, no owner id and NO NOTES". A declaration rather than a
-- `name <> 'note'` in the query that emits statements, because that filter is
-- the strip-list ADR-0045's first line refuses -- it "works until someone adds
-- a field and forgets", and the field it would be forgotten for is the next
-- property that should not be public.
--
-- ABSENT MEANS PUBLIC, which is true of the other twelve and is why this is
-- stated on the exception rather than on all thirteen. It is the opposite
-- default from ADR-0045's own "private by default", and the two are about
-- different things: that sentence is about a FIELD of the payload, which is
-- private until a line names it, and this is about a PROPERTY of the catalogue,
-- which the `statements` line already names as a set.
--
-- WHAT IS NOT CHECKED, named rather than left to be discovered: that each
-- element of `assertableBy` NAMES ONE OF ADR-0071's four source kinds.
-- `source_kinds` is a table and a CHECK cannot reach one, so the alternatives
-- are a literal list of the four in SQL -- the closed set written a second time,
-- free to drift from the table that owns it -- or a trigger on `properties`
-- validating a declaration nothing but a migration may write (ADR-0029). The
-- gap is bounded by the ladder, which is where every property is written, and
-- its cost is a misspelled kind reading as "no source may assert this".
INSERT INTO "properties"
  ("owner_id", "name", "datatype", "value_kind", "cardinality", "reference_target", "capabilities")
SELECT "id", 'note', 'text', 'literal', 'single', NULL::text[],
       '{"assertableBy": ["owner"], "public": false}'::jsonb
FROM "owners";
--> statement-breakpoint
-- AND THE DECLARATION IS ENFORCED WHERE THE CLAIM IS WRITTEN.
--
-- IN THE DATABASE, WHICH IS NOT WHAT ADR-0012 DOES WITH `validation` -- and the
-- difference is the reason that record gives for its own choice. The executor
-- for `validation` stays in TypeScript because SQL cannot parse EDTF, and that
-- record says so in the sentence that makes the point. SQL can compare a source
-- kind against a list of them, so the argument does not reach this rule, and
-- what decides it is migration 1's argument for the projection trigger: "a
-- trigger cannot be forgotten. Application-maintained is silently bypassed by
-- anything writing directly". Today `assertClaims` is the only door, and a
-- provider cannot reach `note` through it -- the import writes three properties
-- by name. Tomorrow the scanner, the merge and whatever ADR-0026 becomes are
-- three more writers, none of which exists to be taught the rule.
--
-- IT IS ALSO ADR-0074'S POSTURE, one property over: a claim the catalogue
-- refuses is refused WHERE IT IS WRITTEN rather than filtered at every read.
--
-- GENERAL OVER THE DECLARATION, never a mention of `note`. A rule naming the
-- property would be the code path ADR-0096 rejected, wearing plpgsql -- and the
-- second property to need this would get a second copy of it.
CREATE FUNCTION "refuse_an_unadmitted_source"() RETURNS trigger AS $fn$
DECLARE
  property_name text;
  admitted jsonb;
  asserting text;
BEGIN
  SELECT p."name", p."capabilities" -> 'assertableBy'
    INTO property_name, admitted
  FROM "properties" p WHERE p."id" = NEW."property_id";
  -- A property declaring nothing admits every source, which is twelve of the
  -- thirteen. Left FIRST and cheap, so the ordinary write pays one lookup.
  IF admitted IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT s."kind" INTO asserting FROM "sources" s WHERE s."id" = NEW."source_id";
  IF NOT admitted @> to_jsonb(asserting) THEN
    RAISE EXCEPTION 'property %: only a source of kind % may assert one; this source is %',
      property_name,
      (SELECT string_agg("kind", ' or ') FROM jsonb_array_elements_text(admitted) AS "kind"),
      asserting
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
--> statement-breakpoint
-- `UPDATE OF "source_id", "property_id"` AND NOT BARE `UPDATE`, WHICH REVIEW
-- FOUND AND WHICH WAS A REAL FAULT.
--
-- The rule is about WHO ASSERTED WHICH PROPERTY, so those two columns are
-- exactly what it has to be re-checked against. A bare `UPDATE` re-checked it
-- against every other write to the row as well -- and the two that matter are
-- not assertions at all: `assertClaims` TOMBSTONES what a source no longer
-- claims by setting `deleted_at`, and migration 1's cascade takes an item's
-- statements down with the item the same way.
--
-- WHAT THAT COST, and it is ADR-0015's own rule broken. `capabilities` is
-- EDITABLE where `datatype` and `reference_target` freeze, because "start loose,
-- tighten later" is what every system that record studied supports -- and
-- "tightening a rule never rejects existing rows either, it marks the property
-- as having offenders and lets you list them". Under a bare `UPDATE`,
-- narrowing `assertableBy` made every statement already written by a
-- no-longer-admitted source impossible to WITHDRAW, and therefore its item
-- impossible to delete. Tightening trapped the rows instead of marking them.
--
-- POSTGRES FIRES `UPDATE OF` WHEN A NAMED COLUMN IS IN THE `SET` LIST, changed
-- or not, which is the right granularity here: a write that does not mention
-- either column cannot be changing who asserted what.
CREATE TRIGGER "statements_refuse_an_unadmitted_source"
BEFORE INSERT OR UPDATE OF "source_id", "property_id" ON "statements"
FOR EACH ROW EXECUTE FUNCTION refuse_an_unadmitted_source();
