-- Migration 24, under CNCORE-360. A VALUE IS KEPT NO LONGER THAN ITS SOURCE ALLOWS.
--
-- TMDB forbids caching "any information" for longer than six months (ADR-0036)
-- and declares it as `max_cache_age`. Nothing read the declaration: the app
-- honoured the ceiling only by storing nothing from TMDB at scale, and CNCORE-360
-- is the ticket that starts to. So a source now keeps its declared ceiling, and
-- a read refuses a claim taken longer ago than that.
--
-- THE MOMENT A CLAIM WAS TAKEN IS ALREADY `observed_at`, on statements and on a
-- placement's sources since migration 1 (ADR-0012 lists it among a claim's
-- attributes). An Identifier (migration 23) had no such column, and gains one.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT ADDS. Two columns.
-- `max_cache_age` starts NULL on every existing source and is written by that
-- source's next import, as the attribution already is: nothing kept the value
-- to backfill it from. An existing Identifier takes its `created_at` rather than
-- this rung's `now()`, because a refresh never rewrote an unchanged row, so its
-- creation is the latest moment it is known to have been said -- and the older
-- answer is the one that errs towards refusing rather than towards keeping.
ALTER TABLE "identifiers" ADD COLUMN "observed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "identifiers" SET "observed_at" = "created_at";--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "max_cache_age" integer;
