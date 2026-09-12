-- Migration 12, under CNCORE-119. A RUN OF ONE TASK.
--
-- ADR-0049 decides that recurring work runs on a VISIBLE registry -- keyed
-- tasks, each runnable by hand, cancellable, with a run history -- and its
-- stated minimum is that last night's failure can be SEEN. This table is what
-- makes that minimum reachable: a registry holding its history in memory would
-- answer "what happened last night" only until the process restarted, which is
-- the maintenance job that silently stopped months ago wearing a page.
--
-- THERE IS NO TABLE OF TASKS, and that is a decision rather than a rung still
-- to come. A task is CODE -- `sweep-sessions` is a function this repository
-- ships -- so a table of them would be a second place to add one from, out of
-- step with the code the moment either moved. `task_key` is the join, and a run
-- whose task has since been deleted from the code still reads as history
-- rather than dangling off a row that is gone.
--
-- `outcome` CARRIES `running` rather than leaving it to a null `ended_at`: the
-- two would be one fact stored twice, and the second check below makes them one
-- fact the database keeps. `aborted` is distinct from `failed` because ADR-0049
-- says so in those words -- a job that was STOPPED and a job that BROKE need
-- different answers from whoever reads this.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT ADDS, and it can say so
-- in one line because nothing before it ran a task. No existing row is read or
-- rewritten, and an instance upgrading onto this rung has an empty history --
-- which is the state it was already in, since nothing could run anything.

CREATE TABLE "task_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"task_key" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"outcome" text DEFAULT 'running' NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	CONSTRAINT "task_runs_outcome_is_known" CHECK ("task_runs"."outcome" in ('running', 'completed', 'failed', 'aborted')),
	CONSTRAINT "task_runs_running_has_no_end" CHECK (("task_runs"."outcome" = 'running') = ("task_runs"."ended_at" is null))
);
--> statement-breakpoint
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- WHAT EVERY READ OF THIS TABLE ASKS: this task's runs, newest first. The page
-- reads one task's last run per task, and the history reads one task's runs in
-- order; both are this index.
CREATE INDEX "task_runs_by_task" ON "task_runs" USING btree ("task_key","started_at" DESC NULLS LAST);
--> statement-breakpoint
-- ADR-0075. `updated_at` and the change sequence advance on every change, by
-- trigger rather than by whoever writes the row. Migration 1 attached this to
-- the eleven tables that existed then, in a loop, so a table added by a LATER
-- RUNG is outside that loop entirely and has to say so here -- as migration 10
-- did for `sessions`. A run whose outcome moved from `running` to `failed`
-- without its change sequence moving is a row ADR-0040's reversal cannot see.
CREATE TRIGGER "task_runs_touch" BEFORE UPDATE ON "task_runs" FOR EACH ROW EXECUTE FUNCTION touch_row();
