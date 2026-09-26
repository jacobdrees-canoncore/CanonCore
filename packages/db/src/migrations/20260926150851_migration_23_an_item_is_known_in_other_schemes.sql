-- Migration 23, under CNCORE-349. AN ITEM IS KNOWN IN OTHER SCHEMES.
--
-- The contract has declared `external_ids` since CNCORE-8 -- a record's id in
-- other people's id spaces, keyed by scheme -- and `provider-tmdb` sends it on
-- every record. CanonCore's consumer schema stripped it at parse, so the ids
-- travelled the wire and reached nothing. This is where they land.
--
-- A TABLE AND NOT THE `external_id` PROPERTY, for a measured reason rather than
-- a taste. Migration 5 holds one (source, value) to one item under that
-- property, because it is what finds an item again on a re-import. An id in
-- ANOTHER space is not that: `provider-tmdb` files `tmdb: "603"` on movie 603
-- and on programme 603 alike, since TMDB numbers its films and its programmes
-- separately, and under migration 5's index the second import would be refused.
-- Nor a Property per scheme, which is a provider defining a field (ADR-0029).
--
-- SOURCED, like every claim (ADR-0012): two providers' rows for one scheme and
-- value are ADR-0026's evidence that they describe one work. Nothing here acts
-- on that evidence; this rung only keeps it.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT ADDS. One table and two
-- indexes; no existing row is read or rewritten. It backfills nothing, because
-- nothing kept the ids it would backfill from -- they were stripped at parse --
-- so an Item imported before this rung gains its Identifiers on its next import.

CREATE TABLE "identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"scheme" text NOT NULL,
	"value" text NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid
);
--> statement-breakpoint
ALTER TABLE "identifiers" ADD CONSTRAINT "identifiers_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identifiers" ADD CONSTRAINT "identifiers_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identifiers" ADD CONSTRAINT "identifiers_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identifiers" ADD CONSTRAINT "identifiers_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identifiers_item" ON "identifiers" USING btree ("item_id");--> statement-breakpoint
-- ONE VALUE PER SCHEME PER SOURCE: CMPP's `external_ids` is a map keyed by
-- scheme, so two live rows for one (item, source, scheme) are two answers where
-- the provider gave one. Partial on the tombstone, as migration 5's index is,
-- so a withdrawn value does not refuse the one sent in its place.
CREATE UNIQUE INDEX "identifiers_one_value_per_scheme" ON "identifiers" USING btree ("item_id","source_id","scheme") WHERE "identifiers"."deleted_at" is null;--> statement-breakpoint
-- ADR-0075. `updated_at` and the change sequence advance by trigger rather than
-- by whoever writes the row, as on every table.
CREATE TRIGGER "identifiers_touch" BEFORE UPDATE ON "identifiers" FOR EACH ROW EXECUTE FUNCTION touch_row();
