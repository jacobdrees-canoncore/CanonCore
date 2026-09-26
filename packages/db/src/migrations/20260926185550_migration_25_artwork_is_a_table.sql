-- Migration 25, under CNCORE-358. ARTWORK IS A TABLE, AND THE `image` PROPERTY
-- IS GONE.
--
-- ADR-0037 stores a picture's bytes rather than pointing at them, and ADR-0038
-- makes artwork a table rather than a Statement, because it carries a role, its
-- licences and the credit that belongs to the file. This is where both land.
--
-- THE SEEDED `image` PROPERTY IS DELETED HERE, BY A NEW RUNG, AND MIGRATION 1 IS
-- LEFT AS IT WAS. The ladder is applied by high-water mark (ADR-0047), so an
-- edit to the rung that seeded it would be skipped on every install that had
-- already climbed past it, silently, while the run reported success. It
-- declared a picture to be a Statement holding a URL, which is the arrangement
-- ADR-0037's first sentence replaces, and nothing ever wrote it: searched across
-- every package before this rung was written, its one reader was a label on the
-- Item page, deleted beside it.
--
-- `observed_at` IS WHEN THE BYTES WERE FETCHED, and it is read against the
-- source's `max_cache_age` by migration 24's rule (CNCORE-360): a picture past
-- its source's ceiling is neither laid out nor served (ADR-0037), which TMDB's
-- six-month ceiling needs from the first poster stored (ADR-0036). The bytes
-- are deleted by the next import of anything, a write that happens anyway
-- rather than a sweep.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT ADDS A TABLE AND DELETES
-- ONE ROW. No existing row is read or rewritten. If any Statement had used
-- `image` after all, the delete is refused by that Statement's foreign key and
-- the rung fails LOUDLY, which is the right answer to a premise that did not hold.

CREATE TABLE "artwork" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"role" text NOT NULL,
	"url" text NOT NULL,
	"licences" text[] NOT NULL,
	"attribution" text,
	"media_type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid
);
--> statement-breakpoint
ALTER TABLE "artwork" ADD CONSTRAINT "artwork_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork" ADD CONSTRAINT "artwork_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork" ADD CONSTRAINT "artwork_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork" ADD CONSTRAINT "artwork_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artwork_item" ON "artwork" USING btree ("item_id");
--> statement-breakpoint
-- ADR-0075. `updated_at` and the change sequence advance by trigger rather than
-- by whoever writes the row, as on every table.
CREATE TRIGGER "artwork_touch" BEFORE UPDATE ON "artwork" FOR EACH ROW EXECUTE FUNCTION touch_row();--> statement-breakpoint
DELETE FROM "properties" WHERE "name" = 'image';
