-- Migration 10, under CNCORE-109. A SESSION PER DEVICE.
--
-- ADR-0043's row, and the thing that decides whether a caller may write. Every
-- procedure in `packages/api` was reachable by anyone who could reach the
-- process -- `provider.purge` deletes a provider's placements and was as
-- reachable as a read -- and what closes that is a caller being able to prove it
-- is the owner. This table is the proof.
--
-- IT ARRIVES WHOLE, which ADR-0043 asks for in those words: client name, device
-- name, stable device id, client version and capabilities ship now and stand
-- empty, because the row is the expensive part rather than any column on it.
-- The measurement behind that instruction is Audiobookshelf, which had a signed
-- token on the user row and no session row, and spent 52 files and 3,168 lines
-- acquiring one.
--
-- THE TOKEN IS NOT IN HERE. `token_hash` holds SHA-256 of the secret the caller
-- presents, so this table is a set of verifiers rather than a set of live
-- credentials: a backup, a dump or a logged query hands over neither.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT ADDS, and it can say so
-- in one line because nothing before it wrote a session. No existing row is read
-- or rewritten, and an instance upgrading onto this rung has every caller logged
-- out -- which is the state it was already in, since nothing could log in.

CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"client_name" text,
	"device_name" text,
	"device_id" text,
	"client_version" text,
	"capabilities" jsonb,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- ADR-0075. `updated_at` and the change sequence advance on every change, by
-- trigger rather than by whoever writes the row. Migration 1 attached this to
-- the eleven tables that existed then, in a loop, so that a later table could
-- not be added to ten of them -- and a table added by a LATER RUNG is outside
-- that loop entirely and has to say so here. A session whose `last_seen_at`
-- moved without its change sequence moving is a row ADR-0040's reversal query
-- cannot see.
CREATE TRIGGER "sessions_touch" BEFORE UPDATE ON "sessions" FOR EACH ROW EXECUTE FUNCTION touch_row();
