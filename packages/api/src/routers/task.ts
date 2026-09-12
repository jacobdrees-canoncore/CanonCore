import { TaskRefused, type TaskRun, taskRegistry } from "@canoncore/tasks";
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
   * STOPPED IS NOT BROKEN, which is ADR-0049's instruction and the reason this
   * is an enum rather than a boolean and a message: a page that printed
   * "failed" over a fortnight of the owner's own cancellations would be
   * reporting incidents that never happened.
   *
   * AND `cancelled` IS NOT `aborted`: the owner stopped this one, the server
   * died under that one, and only the second is a machine to go and look at.
   * Jellyfin ships both and `verify-adr-jellyfin.md` §34 says the split is
   * worth copying.
   */
  outcome: z.enum(["running", "completed", "failed", "cancelled", "aborted"]),
  /** What the run did, or what broke it. `null` while it is still running. */
  detail: z.string().nullable(),
});

/**
 * HOW LONG A KEY MAY BE.
 *
 * A KEY ARRIVES FROM A FORM, and a key that names no task is quoted back in the
 * refusal -- so an unbounded one is a caller choosing the length of a sentence
 * this app utters, which is the defect ADR-0123 exists to close. Every key this
 * repository ships is a short slug; 100 is far above them and far below a
 * flood. Found in review.
 */
const KEY_LENGTH = 100;

/**
 * A run as this surface publishes it, which is NOT the row.
 *
 * PUBLISHED SO THE PAGE TAKES IT rather than restating the shape: `id` and
 * `taskKey` are deliberately absent here (ADR-0045 names the fields the read
 * path carries), so `TaskRun` from the registry is the wrong type for a reader
 * and copying this shape by hand is how the two drift. Found in review.
 */
export type ReportedRun = z.infer<typeof reportedRun>;

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
    .input(z.object({ key: z.string().max(KEY_LENGTH) }))
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
  /**
   * One task's runs, newest first -- the RUN HISTORY rather than the last of
   * them (ADR-0049).
   *
   * THE RECORD ASKS FOR A HISTORY AND NOT A LAST OUTCOME. "Last night's failure
   * is visible" is its minimum rather than its whole: a sweep that failed last
   * night reads the same as one that has failed every night for a fortnight,
   * and those are a glitch and a broken machine. An earlier version of this
   * surface answered only `lastRun`, which left the depth `readTaskRuns` reads
   * with no reader. Found in review.
   */
  history: ownerProcedure
    .input(z.object({ key: z.string().max(KEY_LENGTH) }))
    .output(z.array(reportedRun))
    .handler(async ({ input, context }) =>
      (await taskRegistry().history(context.db, input.key)).map(reported),
    ),

  cancel: ownerProcedure
    .input(z.object({ key: z.string().max(KEY_LENGTH) }))
    .output(z.object({ cancelled: z.boolean() }))
    .handler(({ input }) => ({ cancelled: taskRegistry().cancel(input.key) })),
};

/**
 * A run as the shape above, naming its fields (ADR-0045).
 *
 * IT TAKES THE PACKAGE'S OWN TYPE rather than restating the union, which an
 * earlier version did in three places -- here, on the shape above, and on the
 * page. A union written down twice is two lists to add a value to, and the one
 * that gets forgotten fails as a page that renders an outcome it has no word
 * for. Found in review.
 */
function reported(run: TaskRun) {
  return {
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    outcome: run.outcome,
    detail: run.detail,
  };
}
