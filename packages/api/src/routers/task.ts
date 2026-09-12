import { TaskRefused, taskRegistry } from "@canoncore/tasks";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { ownerProcedure } from "../index";

/**
 * A run, as the owner's page reads it (ADR-0049).
 *
 * IT NAMES ITS FIELDS rather than answering the row, which is ADR-0045's rule
 * for the read path and the same reason `asSession` leaves `token_hash` behind:
 * a shape that spread the row would publish whatever a later column happened to
 * be called.
 */
const reportedRun = z.object({
  startedAt: z.date(),
  /** `null` exactly while the run is still going. */
  endedAt: z.date().nullable(),
  /**
   * `aborted` IS NOT `failed`, which is ADR-0049's instruction and the reason
   * this is a four-value union rather than a boolean and a message: a job that
   * was stopped and a job that broke need different answers, and a page that
   * printed "failed" over a fortnight of deliberate cancellations would be
   * reporting incidents that never happened.
   */
  outcome: z.enum(["running", "completed", "failed", "aborted"]),
  /** What the run did, or what broke it. `null` while it is still running. */
  detail: z.string().nullable(),
});

const listedTask = z.object({
  key: z.string(),
  name: z.string(),
  trigger: z.object({ kind: z.literal("daily"), atHour: z.number().int() }),
  /**
   * `null` WHEN THIS TASK HAS NEVER RUN, which is not a run that did nothing.
   * A zero-shaped last run would read as a sweep that found nothing last night
   * on an instance where the sweep has never once fired -- the silent stoppage
   * ADR-0049 exists to surface, reported as health.
   */
  lastRun: reportedRun.nullable(),
});

/**
 * ADR-0049's visible registry, as the owner's surface.
 *
 * EVERY PROCEDURE IS BEHIND THE OWNER BUILDER, and that is a decision rather
 * than the reflex. ADR-0044 leaves the READ PATH open because the demo shows a
 * visitor everything in the catalogue (ADR-0072); what maintenance this
 * instance runs, when it last ran and what broke are not in the catalogue.
 * `session.list` drew the line in the same place, and running one is a write in
 * the plainest sense -- it does work, on demand, that ADR-0049's own list says
 * will one day include a full provider re-refresh.
 */
export const task = {
  /** Every task this instance runs, each with the last thing it did. */
  list: ownerProcedure.output(z.array(listedTask)).handler(async ({ context }) => {
    const listed = await taskRegistry().list(context.db);
    return listed.map((entry) => ({
      key: entry.key,
      name: entry.name,
      trigger: entry.trigger,
      lastRun: entry.lastRun === null ? null : reported(entry.lastRun),
    }));
  }),

  /**
   * Runs one task NOW, and answers how it went.
   *
   * IT WAITS FOR THE TASK. Answering the moment the work started would make the
   * one surface that calls this -- a form post whose report is the re-rendered
   * page -- show a list that says nothing happened yet, every time.
   *
   * A TASK THAT BROKE IS NOT A REFUSAL. `registry.run` reports a breakage as an
   * outcome rather than raising, so this answers `failed` with the reason in
   * it: the failure belongs in the history the owner is about to read, not in a
   * stack trace. What IS refused is a key this build does not ship and a task
   * already running, which are facts about the request rather than about the
   * work.
   */
  run: ownerProcedure
    .input(z.object({ key: z.string() }))
    .output(reportedRun)
    .handler(async ({ input, context }) => {
      try {
        return reported(await taskRegistry().run(context.db, input.key));
      } catch (thrown) {
        if (thrown instanceof TaskRefused) {
          // A STALE PAGE AND A SECOND PRESS ARE DIFFERENT ANSWERS. `NOT_FOUND`
          // over a task that is running at that moment would tell the owner the
          // thing they can see running does not exist.
          throw new ORPCError(thrown.reason === "no such task" ? "NOT_FOUND" : "CONFLICT", {
            message: thrown.message,
          });
        }
        throw thrown;
      }
    }),

  /**
   * Stops a task that is running, and answers whether there was one.
   *
   * NOTHING RUNNING IS ANSWERED, NOT REFUSED. The list a page renders is a
   * moment old, so pressing Cancel on a task that finished in between is an
   * ordinary race rather than a fault -- and the answer the owner wants is the
   * same either way, which is a list without it running on. `session.end` takes
   * the same posture towards a session that had already lapsed.
   */
  cancel: ownerProcedure
    .input(z.object({ key: z.string() }))
    .output(z.object({ cancelled: z.boolean() }))
    .handler(({ input }) => ({ cancelled: taskRegistry().cancel(input.key) })),
};

function reported(run: {
  startedAt: Date;
  endedAt: Date | null;
  outcome: "running" | "completed" | "failed" | "aborted";
  detail: string | null;
}) {
  return {
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    outcome: run.outcome,
    detail: run.detail,
  };
}
