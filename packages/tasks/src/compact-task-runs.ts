import { compactTaskRuns } from "@canoncore/db";

import { dailyAt, type Task } from "./registry";

/**
 * ADR-0049's tombstone compaction, turned on the registry's OWN history table.
 *
 * THAT RECORD'S CATEGORY ARRIVING BACK AT ITS OWN TABLE. ADR-0049 lists
 * tombstone compaction among the eight pieces of work its registry exists to
 * run, and `task_runs` -- the table that makes the registry's history readable
 * at all -- only grew: a task on a daily trigger writes 365 rows a year and,
 * until this, nothing removed one.
 *
 * AND IT IS THE SHAPE THE REGISTRY IS FOR, which is why it is a second task
 * rather than a line inside the first. CNCORE-119 had to prove the registry --
 * a task listed, run by hand, cancelled and read back -- and one task can
 * demonstrate a registry without ever being a list. This is the second entry,
 * and the registry is a registry from here on.
 *
 * NOTHING'S CORRECTNESS WAITS ON IT, exactly as with `sweep-sessions`. An
 * uncompacted history is a table that grew and a page that reads the newest
 * thirty rows of it regardless, so a night this does not run costs nothing an
 * owner can see -- which is what makes it maintenance, and what makes its own
 * place in the history the point.
 *
 * AT FOUR IN THE MORNING, inside the 3am-6am window Plex keeps for maintenance
 * and an hour behind the sweep. Nothing here depends on the sweep having run;
 * they are staggered because two tasks sharing one instant is two tasks
 * competing for one small machine, at no benefit, on a schedule this file is
 * free to choose.
 */
export const compactTaskRunsTask: Task = {
  key: "compact-task-runs",
  name: "Remove runs the history no longer shows",
  trigger: dailyAt(4),
  run: async ({ db }) => {
    const removed = await compactTaskRuns(db);
    // THE COUNT IN A SENTENCE, because the history is read by a person -- the
    // reason `sweep-sessions` gives for the same shape. "0" in a column is a
    // number an owner has to interpret; "Removed no runs" reports that the job
    // ran and found nothing to do, which is the distinction ADR-0049 says this
    // history exists to carry.
    if (removed === 0) return "Removed no runs.";
    return `Removed ${removed} run${removed === 1 ? "" : "s"}.`;
  },
};
