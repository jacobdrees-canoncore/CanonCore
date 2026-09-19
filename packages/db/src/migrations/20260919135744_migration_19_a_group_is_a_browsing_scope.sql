-- Migration 19, under CNCORE-178. A GROUP IS A BROWSING SCOPE, AND ITS
-- MEMBERSHIP IS ITS OWN RELATION.
--
-- ADR-0010 decided both halves and neither existed. A Group is what a view is
-- narrowed to -- never a partition, never typed by medium -- and the shape that
-- makes that true is the second table here rather than a column on `items`. A
-- column would give an Item exactly one Group, and multi-placement is the entire
-- product: 96.8% of the wiki's stories sit in more than one category, median 4,
-- maximum 52 (measured 2026-09-12). A crossover belongs to both.
--
-- WHAT A GROUP IS NOT, WHICH IS THE HALF ADR-0010 CALLS LOAD-BEARING. A scope
-- becomes a partition by accretion, one reasonable-looking column at a time, so
-- `groups` carries a name and nothing else. It does not carry a medium, a field
-- set, a vocabulary, a source order or a root -- and the ones a Group DOES scope
-- are predicates other surfaces read through this table rather than columns on
-- it.
--
-- TWO TABLES RATHER THAN ONE, because a scope and an Item's presence in it are
-- different cardinalities. `groups` holds what the Owner named; `group_items`
-- holds one Item's presence in one Group, and it is the table a narrowed Listing
-- joins through.
--
-- AND `group_items` IS NOT A PLACEMENT (`CONTEXT.md`). A Placement is one Item's
-- membership of one CONTAINER at one POSITION, carrying every Source that
-- asserted it. This row has no position, is nobody's claim but the Owner's, and
-- names a scope rather than a container. The two would be one table only if a
-- Group were a Container, which is the partition ADR-0010 refuses.
--
-- NO UNIQUE INDEX ON `groups.name`, deliberately. The name is the Owner's own
-- words, so two scopes they have called the same thing is their business -- and
-- a unique constraint here carries the trap migration 14 documents for
-- `placements`: a tombstoned row goes on occupying its tuple, so a Group the
-- Owner deleted would refuse the next one they named after it, citing a row they
-- cannot see.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT ADDS. No existing row is
-- read or rewritten, and no existing table gains a column. An instance upgrading
-- onto this rung has no Groups, which is the state it was already in.
--
-- AND IT RESTORES THE SNAPSHOT, WHICH IS WHY THIS RUNG'S `meta/` FILE IS THE
-- FIRST SINCE MIGRATION 16. Migration 18 declared two tables in `schema/` and
-- committed no snapshot beside them, so `drizzle-kit generate` diffed this rung
-- against migration 16's head and re-emitted `import_runs` and
-- `import_run_containers` into it -- a rung that would have failed on the first
-- database that had already run 18. ADR-0047's rule is that the schema and the
-- snapshot must agree, and the check is that `generate` then emits NOTHING. The
-- re-emitted statements are deleted from this file and the snapshot is kept.

CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	-- The Owner's own words for this scope (ADR-0010). Never a medium, and never
	-- a name this product chose for them.
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	-- ADR-0040's stamp, which `groups` above does not carry and this does. A
	-- merge merges ITEMS, so it can touch this row and cannot touch that one --
	-- the same reading `owners` and `merges` get in migration 1.
	"merge_id" uuid,
	-- ONE ITEM SITS IN A GROUP ONCE. There is no position here, so ADR-0009's
	-- Repeat has nothing to be a repeat OF: an Item named twice in one scope is
	-- the same claim twice, not a recap and an episode. The tombstone goes on
	-- holding this tuple after a removal, which is what `putItemInGroupByHand`
	-- resurrects rather than inserting past.
	CONSTRAINT "group_items_group_item" UNIQUE("owner_id","group_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_items" ADD CONSTRAINT "group_items_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- A FOREIGN KEY AND NOT A CASCADE, either side. Deleting a Group tombstones it
-- and its rows here (ADR-0075) and touches no Item, which is ADR-0010's promise
-- that a scope is not a container that can be emptied by accident; `ON DELETE
-- cascade` would describe a DELETE nothing in this product performs.
ALTER TABLE "group_items" ADD CONSTRAINT "group_items_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_items" ADD CONSTRAINT "group_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_items" ADD CONSTRAINT "group_items_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- WHICH GROUPS THIS ITEM IS IN, which is the read the Item page makes and the
-- one the unique constraint above cannot serve: its leading column is the
-- Group, so an Item-first lookup would scan.
CREATE INDEX "group_items_item" ON "group_items" USING btree ("item_id");--> statement-breakpoint
-- ADR-0075. `updated_at` and the change sequence advance by trigger rather than
-- by whoever writes the row. Migration 1 attached this to the eleven tables that
-- existed then, in a loop, so a table added by a LATER RUNG is outside that loop
-- entirely and has to say so here -- as migrations 10, 13, 16 and 18 did.
CREATE TRIGGER "groups_touch" BEFORE UPDATE ON "groups" FOR EACH ROW EXECUTE FUNCTION touch_row();--> statement-breakpoint
CREATE TRIGGER "group_items_touch" BEFORE UPDATE ON "group_items" FOR EACH ROW EXECUTE FUNCTION touch_row();
