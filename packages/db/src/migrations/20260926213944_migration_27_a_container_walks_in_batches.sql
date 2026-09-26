-- Migration 27, under CNCORE-373. A CONTAINER WALKS IN BATCHES.
--
-- An entity infobox is too large for one browse (`Infobox Individual` is
-- 23,653 pages), so `browse` answers it a batch at a time with a `next` to
-- carry on from. Where a run has got to inside one Container is that cursor,
-- held on the Container's row, so an interruption costs the batch in flight
-- rather than the Container, and running the same list again carries on from
-- it (ADR-0135, extended to a second granularity).
--
-- THE COUNT CHECK LOSES ONE DIRECTION. Migration 18 held a row to counts
-- exactly when it had landed; a Container walked in batches counts what its
-- batches wrote while it is still `pending`, and keeps that when a batch
-- refuses, so only `landed` is held to having one. The two counts still arrive
-- together, and a `landed` row has no batch left to ask for.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT ADDS A COLUMN AND
-- LOOSENS ONE CHECK. Every row a previous rung wrote satisfies the new checks,
-- so nothing is read, rewritten or backfilled.
ALTER TABLE "import_run_containers" DROP CONSTRAINT "import_run_containers_landed_counts_what_it_wrote";--> statement-breakpoint
ALTER TABLE "import_run_containers" ADD COLUMN "batch_cursor" text;--> statement-breakpoint
ALTER TABLE "import_run_containers" ADD CONSTRAINT "import_run_containers_counts_come_together" CHECK (("import_run_containers"."placements" is null) = ("import_run_containers"."quarantined_values" is null));--> statement-breakpoint
ALTER TABLE "import_run_containers" ADD CONSTRAINT "import_run_containers_landed_has_no_batch_left" CHECK ("import_run_containers"."outcome" <> 'landed' or "import_run_containers"."batch_cursor" is null);--> statement-breakpoint
ALTER TABLE "import_run_containers" ADD CONSTRAINT "import_run_containers_landed_counts_what_it_wrote" CHECK ("import_run_containers"."outcome" <> 'landed' or "import_run_containers"."placements" is not null);