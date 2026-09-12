-- Migration 16, under CNCORE-99. THE SETTINGS THE OWNER CONFIGURED.
--
-- `PROVIDER_URLS` and `PROVIDER_ALLOWLIST` move out of the environment and into
-- the catalogue, TOGETHER. That is what `packages/env/src/schema.ts` committed
-- to beside the allowlist itself -- "it is env rather than a settings table
-- because there is no settings table yet. When there is one, this moves into it
-- and the boundary does not change" -- and this is the rung where there is one.
-- ADR-0121 records that the sentence is a CODE COMMENT rather than an ADR, so
-- it is quoted here from where it actually lives.
--
-- BOTH ARE HELD AS THE STRING THE OWNER WROTE, which is what keeps the boundary
-- where it was. `parseProviderUrls` and `parseAllowlist` already take a string
-- from wherever it comes, so only the SOURCE moved: nothing about what an entry
-- means, what a malformed one does, or what an empty one reaches changed in
-- this rung.
--
-- EMPTY DEFAULTS ON BOTH COLUMNS, and the allowlist's is the load-bearing one.
-- ADR-0034 makes an empty allowlist refuse every provider, and an instance
-- nobody has configured is supposed to reach nothing. A settings surface must
-- not quietly turn that into a permissive default, so the safe end of the
-- failure is written into the column rather than into whatever inserts the row.
--
-- ONE ROW, ENFORCED THE WAY `owners` IS (ADR-0044): a unique index on a
-- constant expression, which makes "one" a fact rather than an intention. Two
-- rows would make "what is this instance configured to reach" depend on which
-- one a query read first.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT ADDS, and nothing
-- existing is read or rewritten. There is no row to transform and so nothing to
-- quarantine. An instance upgrading onto this rung has NO settings row at all,
-- which reads as empty on both settings -- the same thing an unset environment
-- variable read as, and the state a fresh install is in either way.
--
-- WHAT AN UPGRADING INSTANCE HAS TO DO, said here because the ladder cannot do
-- it: an owner who had named providers in `PROVIDER_URLS` names them again on
-- the settings surface. The rung cannot carry them across -- the environment of
-- the process running a migration is not the environment the server will run
-- with, and reading one here would be this rung guessing at the other. There is
-- no released version (ADR-0047), so no instance but a developer's own is in
-- that position.

CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"provider_urls" text DEFAULT '' NOT NULL,
	"provider_allowlist" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "settings_single_row" ON "settings" USING btree ((true));--> statement-breakpoint
-- ADR-0075. `updated_at` and the change sequence advance on every change, by
-- trigger rather than by whoever writes the row. Migration 1 attached this in a
-- loop to the eleven tables that existed then, so a table added by a later rung
-- attaches it itself or silently carries columns nothing advances -- which is
-- exactly the write a reversal query needs to find and would not.
--
-- IT MATTERS MORE HERE THAN THE COLUMN COUNT SUGGESTS. Every change an owner
-- makes to this table is an UPDATE of the one row, so the change sequence is
-- the only record that the configuration changed at all: without the trigger
-- the row would read as though it had always said what it says now.
CREATE TRIGGER "settings_touch" BEFORE UPDATE ON "settings" FOR EACH ROW EXECUTE FUNCTION touch_row();
