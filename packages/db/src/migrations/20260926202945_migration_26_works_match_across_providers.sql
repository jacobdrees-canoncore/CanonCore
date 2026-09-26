-- Migration 26, under CNCORE-361. WORKS MATCH ACROSS PROVIDERS.
--
-- Two Providers describing one work used to mint two Items, because nothing did
-- ADR-0026's matching. Now a browse scores each arriving work against the Items
-- other Providers hold: above ADR-0027's high bar it lands on that Item, below
-- the low bar nothing is kept, and the band between is handed over here as a
-- candidate pair, for CNCORE-363 to confirm or reject on CNCORE-371's list.
--
-- AND ONE THING THE MATCHER REFUSES IS KEPT TOO: a work one Provider holds as a
-- single record and another as several instalments (CNCORE-368's finding). That is
-- never a match, and the Item page says so rather than staying silent.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT ADDS. Two tables and
-- their indexes; no existing row is read or rewritten. Nothing is backfilled:
-- a pair is found when a browse arrives, so an Item already held gains its
-- candidates on the next browse that meets it.
CREATE TABLE "instalment_disagreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"instalments" integer NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid,
	CONSTRAINT "instalment_disagreements_several" CHECK ("instalment_disagreements"."instalments" > 1)
);
--> statement-breakpoint
CREATE TABLE "match_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"candidate_item_id" uuid NOT NULL,
	"score" double precision NOT NULL,
	"title_signal" text NOT NULL,
	"released_signal" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid,
	CONSTRAINT "match_candidates_two_items" CHECK ("match_candidates"."item_id" <> "match_candidates"."candidate_item_id"),
	CONSTRAINT "match_candidates_title_signal" CHECK ("match_candidates"."title_signal" in ('same', 'subtitle', 'differs')),
	CONSTRAINT "match_candidates_released_signal" CHECK ("match_candidates"."released_signal" in ('same', 'differs', 'unknown'))
);
--> statement-breakpoint
ALTER TABLE "instalment_disagreements" ADD CONSTRAINT "instalment_disagreements_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instalment_disagreements" ADD CONSTRAINT "instalment_disagreements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instalment_disagreements" ADD CONSTRAINT "instalment_disagreements_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instalment_disagreements" ADD CONSTRAINT "instalment_disagreements_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_candidate_item_id_items_id_fk" FOREIGN KEY ("candidate_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instalment_disagreements_one_per_source" ON "instalment_disagreements" USING btree ("item_id","source_id") WHERE "instalment_disagreements"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "match_candidates_item" ON "match_candidates" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "match_candidates_candidate" ON "match_candidates" USING btree ("candidate_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_candidates_one_per_pair" ON "match_candidates" USING btree ("item_id","candidate_item_id") WHERE "match_candidates"."deleted_at" is null;--> statement-breakpoint
-- ADR-0075. `updated_at` and the change sequence advance by trigger, as on every table.
CREATE TRIGGER "match_candidates_touch" BEFORE UPDATE ON "match_candidates" FOR EACH ROW EXECUTE FUNCTION touch_row();--> statement-breakpoint
CREATE TRIGGER "instalment_disagreements_touch" BEFORE UPDATE ON "instalment_disagreements" FOR EACH ROW EXECUTE FUNCTION touch_row();
