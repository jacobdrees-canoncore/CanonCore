/**
 * WHAT THIS INSTANCE RUNS, and the registry that runs it (ADR-0049).
 *
 * THE MECHANISM IS NEXT DOOR, in `registry.ts`, and this file is the list. The
 * split is what keeps the two out of a cycle: a task reaches for `dailyAt` to
 * declare its trigger, so a task defined in the same file that imports it is an
 * import loop -- one that happens to work today only because `dailyAt` is a
 * hoisted declaration, and breaks the day somebody writes it as a `const`.
 */
import { createRegistry, type Task } from "./registry";
import { sweepSessionsTask } from "./sweep-sessions";

export {
  BOUNDED_DETAIL,
  createRegistry,
  dailyAt,
  type ListedTask,
  type Registry,
  type Task,
  type TaskContext,
  type TaskOutcome,
  TaskRefused,
  type TaskRun,
  type Trigger,
} from "./registry";
export { nextFiring, startScheduler } from "./scheduler";
export { sweepSessionsTask } from "./sweep-sessions";

/**
 * EVERYTHING THIS INSTANCE RUNS, in the order an owner reads it.
 *
 * A LIST IN CODE AND NOT A TABLE, which migration 13 says in its own words: a
 * task IS code, so a table of them would be a second place to add one from,
 * out of step with this list the moment either moved.
 *
 * ONE ENTRY TODAY. ADR-0049 names eight more -- scans, the six-month TMDB cache
 * eviction, projection reconciliation, provider re-refresh, orphan collection,
 * tombstone compaction, palette extraction and the analysis pass -- and each
 * arrives as a line here and a file beside this one, when the work it runs
 * exists.
 */
export const theTasks: Task[] = [sweepSessionsTask];

let instance: ReturnType<typeof createRegistry> | undefined;

/**
 * This instance's registry, built once.
 *
 * MEMOISED BECAUSE THE LIVE RUNS ARE IN IT. The map of `AbortController`s is
 * the registry's own memory, so a registry per caller would mean the surface
 * that cancels a run never holding the controller of the run it is cancelling
 * -- Cancel would answer "nothing was running" while the sweep carried on.
 * `getDb` is memoised one package over for a smaller version of this reason.
 */
export function taskRegistry() {
  instance ??= createRegistry(theTasks);
  return instance;
}
