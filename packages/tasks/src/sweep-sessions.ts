import { sweepSessions } from "@canoncore/db";

import { dailyAt, type Task } from "./registry";

/**
 * ADR-0049's tombstone compaction, one table at a time: the session rows that
 * can never answer again, removed.
 *
 * THE FIRST TASK THE REGISTRY CARRIES, and the reason ADR-0049 was cheaper to
 * implement than it read. The eight pieces of work that record lists are all
 * unwritten; this one has existed since CNCORE-116, tested at ADR-0103's first
 * seam and called by NOTHING. It was an operation waiting for a runner rather
 * than an unwritten one, so what this ticket had to prove was the registry.
 *
 * NOTHING'S CORRECTNESS WAITS ON IT. `seeSession` refuses a lapsed session on
 * the clock whether or not anything has swept it (ADR-0043), so a night this
 * does not run is a table that grew rather than a door left open -- which is
 * what makes this maintenance, and what makes the history the point.
 *
 * AT THREE IN THE MORNING, which is where Plex puts its own maintenance window
 * and for the same reason: it is when nobody is reading.
 */
export const sweepSessionsTask: Task = {
  key: "sweep-sessions",
  name: "Remove sessions that can no longer answer",
  trigger: dailyAt(3),
  run: async ({ db }) => {
    const swept = await sweepSessions(db);
    // THE COUNT IN A SENTENCE, because the history is read by a person. "0" in
    // a column is a number an owner has to interpret; "Removed no sessions" is
    // a report that the job ran and found nothing, which is the distinction
    // ADR-0049 says this history exists to carry.
    if (swept === 0) return "Removed no sessions.";
    return `Removed ${swept} session${swept === 1 ? "" : "s"}.`;
  },
};
