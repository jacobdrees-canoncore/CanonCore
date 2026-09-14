-- Migration 18, under CNCORE-166. A RUN OVER A LIST OF CONTAINERS, AND WHERE IT
-- GOT TO.
--
-- Importing the wiki's corpus is 465 Containers, and until this rung that was
-- 465 form submissions with an id pasted into each. What was missing is not a
-- loop -- a loop is four lines -- but somewhere for the loop's POSITION to live.
-- A walk that keeps where it got to in one process's memory is a walk that
-- starts again from the beginning every time anything interrupts it, and at
-- 43.8s a Container (measured against the live wiki, 2026-09-13) the whole list
-- is about five and a half hours. A lapsed Credential at Container 200 then
-- costs the 200 that already landed rather than the 265 that did not.
--
-- IT IS THE SAME ARGUMENT `task_runs` MAKES ONE TABLE OVER, at a different
-- grain. ADR-0049 opens a run when it STARTS rather than writing one when it
-- finishes, "which is what makes a run that never finished readable at all".
-- This rung applies that per CONTAINER instead of per run, because the thing a
-- resume needs to read back is not whether the run finished but which of its 465
-- Containers did.
--
-- TWO TABLES RATHER THAN ONE, because a run and a Container's place in it are
-- different cardinalities and the alternative is a bag. `import_runs` carries
-- what the whole walk is about -- which Provider -- and `import_run_containers`
-- carries one Container's id, its place in the Owner's list, and how it went.
--
-- WHAT IS DELIBERATELY NOT HERE: a column saying the run has finished. A run is
-- open exactly while a Container of it is still `pending`, which is one fact the
-- rows already hold; a second column saying so is the same fact stored twice and
-- free to disagree, which is the argument migration 13 makes for
-- `task_runs_running_has_no_end` and the reason that table has no `is_running`.
--
-- AND NO CLAIM COLUMN, WHICH IS THE ONE THING A READER WILL EXPECT AND NOT FIND.
-- The obvious shape for this table is a work queue -- claim a row, mark it
-- running, release it on a timeout -- and every part of that machinery exists to
-- stop two workers taking one item. There is one worker here: the walk awaits
-- each Container before it asks for the next, which is what CNCORE-166's "one at
-- a time" means and what the Provider's own measurements demand (two concurrent
-- browses of the largest Ordering took 49.1s each against 25.5s alone, because
-- `provider-wiki` is one Node process). A claim would buy mutual exclusion
-- against a second walk nobody starts, at the price of a stale-claim timeout --
-- a duration nobody has measured -- and a run that strands itself when that
-- duration is wrong. A Container interrupted mid-browse stays `pending` and is
-- simply asked again, which is correct because `importBrowsedContainer` is ONE
-- TRANSACTION: a Container is wholly in the catalogue or wholly absent, never
-- half, so re-asking refreshes rather than doubles (ADR-0026, ADR-0078).
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT ADDS. No existing row is
-- read or rewritten, and an instance upgrading onto this rung has no import runs
-- -- which is the state it was already in, since nothing could record one.

CREATE TABLE "import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	-- WHICH PROVIDER THIS WALK IS AT, as the base URL that IS its identity
	-- (ADR-0031). It is what `sources.identity` holds for the same Provider, and
	-- it is deliberately NOT a foreign key to that table: a run may be opened
	-- against a Provider this catalogue has never imported from, which is the
	-- ordinary case on a fresh install, and `sources` has no row until the first
	-- import writes one.
	"provider_identity" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_run_containers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	-- The Provider's own id for the Container, the one `browse` takes (ADR-0033).
	"external_id" text NOT NULL,
	-- WHERE THIS CONTAINER SAT IN THE LIST THE OWNER HANDED OVER, and NEVER a
	-- Placement's Position (ADR-0018, `CONTEXT.md`). The two words would be one
	-- word in a query that joined these tables to the catalogue's: a Placement's
	-- Position is a claim about an Ordering that a Source made, and this is the
	-- order somebody typed 465 lines in. Zero-based, because it is an index into
	-- what the caller passed rather than anything a reader is shown.
	"list_position" integer NOT NULL,
	-- `pending` until this Container has been asked for, and then how it went.
	--
	-- `refused` COVERS EVERY WAY ONE CONTAINER CAN FAIL WITHOUT THE RUN FAILING,
	-- which is three: the Provider could not be reached or answered badly, the
	-- Provider declines `browse` at all (ADR-0033 makes that well-formed), and
	-- the Provider holds nothing at that id (ADR-0066 makes that an answer). They
	-- are told apart by the REASON below rather than by three more values here,
	-- because what the Owner does about each is read off the sentence and nothing
	-- in this catalogue branches on which of the three it was.
	"outcome" text DEFAULT 'pending' NOT NULL,
	-- How many Placements landed, and how many values were held apart from the
	-- live set (CNCORE-29). Both are what `browse` already answers, kept so that a
	-- run read back a day later says what it did rather than only that it did it.
	"placements" integer,
	"quarantined_values" integer,
	-- WHY IT REFUSED, in ADR-0123's two fields, because there are two kinds of
	-- string here. `reason_wrote` is `canoncore` when this app is telling the
	-- Owner about their own configuration or about an operation the Provider does
	-- not offer, and `provider` when the text is a third party's. A surface
	-- attributes the second and not the first.
	--
	-- BOUNDED BY WHATEVER WRITES IT RATHER THAN BY THIS COLUMN, exactly as
	-- `task_runs.detail` is: `reasonFor` in `@canoncore/providers` caps every
	-- reason at ADR-0123's 300 and is the single mapping that record names. A
	-- second cap here would be a second place for that number to live.
	"reason_text" text,
	"reason_wrote" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	CONSTRAINT "import_run_containers_outcome_is_known" CHECK ("import_run_containers"."outcome" in ('pending', 'landed', 'refused')),
	-- WHAT LANDED SAYS WHAT IT WROTE, AND WHAT REFUSED SAYS WHY. Stored as an
	-- equivalence rather than as two nullable columns nobody checks, so a row
	-- reading `landed` with no counts -- or `refused` with no sentence, which is
	-- the outcome an Owner cannot act on -- is a row this database will not hold.
	CONSTRAINT "import_run_containers_landed_counts_what_it_wrote" CHECK (("import_run_containers"."outcome" = 'landed') = ("import_run_containers"."placements" is not null and "import_run_containers"."quarantined_values" is not null)),
	CONSTRAINT "import_run_containers_refused_says_why" CHECK (("import_run_containers"."outcome" = 'refused') = ("import_run_containers"."reason_text" is not null and "import_run_containers"."reason_wrote" is not null)),
	CONSTRAINT "import_run_containers_reason_wrote_is_known" CHECK ("import_run_containers"."reason_wrote" is null or "import_run_containers"."reason_wrote" in ('canoncore', 'provider'))
);
--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_run_containers" ADD CONSTRAINT "import_run_containers_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_run_containers" ADD CONSTRAINT "import_run_containers_run_id_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."import_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- WHAT EVERY READ OF A RUN ASKS: this run's Containers, in the order the Owner
-- listed them. It is unique as well as ordered because two Containers cannot
-- share a place in one list, which is the half that makes the order TOTAL rather
-- than merely usual.
CREATE UNIQUE INDEX "import_run_containers_in_list_order" ON "import_run_containers" USING btree ("run_id","list_position");--> statement-breakpoint
-- ONE CONTAINER APPEARS ONCE IN A RUN. A list naming an id twice would browse it
-- twice -- 43.8s spent asking a Provider a question it has already answered --
-- and would give the run two answers for one Container with nothing to say which
-- is current. ADR-0009's REPEAT is the opposite case and is untouched by this: a
-- story may sit twice in one ORDERING, which is a claim about a Container's
-- members rather than about a list of Containers to import.
CREATE UNIQUE INDEX "import_run_containers_named_once" ON "import_run_containers" USING btree ("run_id","external_id");--> statement-breakpoint
-- HOW A RESUME FINDS ITS RUN: the open runs at one Provider, newest first.
CREATE INDEX "import_runs_by_provider" ON "import_runs" USING btree ("provider_identity","created_at" DESC NULLS LAST);--> statement-breakpoint
-- ADR-0075. `updated_at` and the change sequence advance by trigger rather than
-- by whoever writes the row. Migration 1 attached this to the eleven tables that
-- existed then, in a loop, so a table added by a LATER RUNG is outside that loop
-- entirely and has to say so here -- as migrations 10, 13 and 16 did.
CREATE TRIGGER "import_runs_touch" BEFORE UPDATE ON "import_runs" FOR EACH ROW EXECUTE FUNCTION touch_row();--> statement-breakpoint
CREATE TRIGGER "import_run_containers_touch" BEFORE UPDATE ON "import_run_containers" FOR EACH ROW EXECUTE FUNCTION touch_row();
