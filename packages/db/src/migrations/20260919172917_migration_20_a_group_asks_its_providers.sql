-- Migration 20, under CNCORE-182. A GROUP ASKS THE PROVIDERS THE OWNER NAMED,
-- AND NO OTHERS.
--
-- ADR-0025 decided this and ADR-0010 lists it among the five things a Group
-- scopes: a Group picks which Providers are asked on its behalf, so a Group that
-- never asks TMDB is never answered by TMDB. Migration 19 made a Group; this is
-- the second relation that record said it needed, one Group to the Providers it
-- asks.
--
-- THE PROVIDER IS ITS BASE URL (ADR-0031), not a foreign key to `sources`, for
-- the reason migration 18 gives for `import_runs`: a Group may ask a Provider
-- this catalogue has never imported from, and `sources` has no row for one until
-- the first import writes it.
--
-- NO ORDER COLUMN, AND THAT ABSENCE IS ADR-0025's DECISION. A Group chooses WHO
-- is asked, never how they rank: the source order is one for the instance,
-- because an Item in two Groups ranked differently would have two answers for
-- one field at one address.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT ADDS. No existing row is
-- read or rewritten. A Group drawn before this rung asks no Provider after it,
-- which is the rule for every Group the Owner has not told anything rather than
-- a gap in the upgrade: searching narrowed to it says it asks nobody, and the
-- Owner names its Providers on `/groups`. Searching across everything asks every
-- configured Provider exactly as before.

CREATE TABLE "group_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	-- The Provider's base URL as the Owner wrote it in settings, which IS its
	-- identity (ADR-0031). Never normalised, for the reason `settings` gives:
	-- rewriting it would make one Provider two.
	"provider_identity" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	-- A GROUP ASKS A PROVIDER ONCE. The tombstone goes on holding this tuple
	-- after the Owner stops asking, which is what `askProviderByHand` resurrects
	-- rather than inserting past -- the same arrangement as `group_items`.
	CONSTRAINT "group_providers_group_provider" UNIQUE("owner_id","group_id","provider_identity")
);
--> statement-breakpoint
ALTER TABLE "group_providers" ADD CONSTRAINT "group_providers_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- A FOREIGN KEY AND NOT A CASCADE, for migration 19's reason: deleting a Group
-- tombstones it and every row naming it (ADR-0075), and `ON DELETE cascade`
-- would describe a DELETE nothing in this product performs.
ALTER TABLE "group_providers" ADD CONSTRAINT "group_providers_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- ADR-0075. `updated_at` and the change sequence advance by trigger, and a table
-- added by a later rung is outside migration 1's loop and has to say so here.
CREATE TRIGGER "group_providers_touch" BEFORE UPDATE ON "group_providers" FOR EACH ROW EXECUTE FUNCTION touch_row();
