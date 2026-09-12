/**
 * WHERE THE SCHEDULER STARTS (ADR-0049, CNCORE-119).
 *
 * `register` IS NEXT'S ONE HOOK FOR "THE SERVER IS STARTING", and the framework
 * documents it as running once when a server instance starts and completing
 * before the first request is handled. That is what a trigger needs and what
 * nothing else here offers: a page render or a login happens per request, and
 * hanging maintenance off one is precisely the hidden timer ADR-0049 refuses.
 *
 * THE NODE RUNTIME ONLY, which is Next's own documented guard. This file is
 * evaluated in the edge runtime too, where there are no sockets to reach
 * Postgres with -- so an unguarded import of the database would be a startup
 * error rather than a scheduler.
 *
 * ONE PROCESS IS ASSUMED, and it is ADR-0109's shape rather than an oversight:
 * that record commits to a process something restarts, and the image runs one
 * `node server.js`. Two servers on one database would each fire every trigger.
 * `closeTaskRunsLeftOpen` records the same assumption from the other end, and
 * whatever first runs two is what has to key a run to the process that opened
 * it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getDb } = await import("@canoncore/db");
  const { startScheduler, taskRegistry } = await import("@canoncore/tasks");

  await startScheduler(taskRegistry(), getDb());
}
